import { error, fail } from '@sveltejs/kit';
import { darfLesartenUmstellen, LESARTEN, LESARTENRECHT_IN_WORTEN } from '$lib/domain/lesarten';
import { FachlicherFehler } from '$lib/domain/fehler';
import { text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { erfordernisseNachziehen, veralteteErfordernisse } from '$lib/server/reglement';
import { UNIVERSALVARIANTE_VORGABE } from '$lib/domain/ausnahmen';
import { holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Lesarten der Gemeinschaft (Migration 169, Entscheid 0018).
 *
 * **Eine eigene Seite, damit die Sitzungsleitung umstellen kann**, wenn die
 * Gemeinschaft es erlaubt. Die Reglementsseite bleibt der Verwaltung (Pfadwächter
 * in `rollen.ts`); dieser Pfad ist dort ausgenommen. **Zwei Aktionen, nicht
 * mehr** (Wächter `tests/waechter/lesartenseite.test.ts`):
 *
 *   - `lesarten` ruft `speichereLesarten`, und die prüft Rolle und Erlaubnis in
 *     der Transaktion selbst.
 *   - `nachziehen` zieht Traktanden mit älterem Erfordernis nach (Codeprüfung
 *     Teil 2): Wer umstellt, macht schon hergeleitete Traktanden veraltet, und
 *     die Freigabe sagt dann ab. Ohne diesen Weg stünde die Sitzungsleitung vor
 *     einer zweiten Absage auf der Reglementsseite. Sie gewinnt damit kein Recht
 *     dazu: Das Erfordernis eines Traktandums setzt sie ohnehin selbst, auf der
 *     Erfordernisseite der Versammlung.
 *
 * Wer umstellen darf und die Universalversammlung zeigt die Seite nur an.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');
	const [einstellung, veraltet] = await Promise.all([
		holeLesarteneinstellung(locals.benutzer.operatorId, params.id),
		veralteteErfordernisse(locals.benutzer.operatorId, params.id)
	]);

	return {
		gemeinschaft,
		lesarten: LESARTEN,
		einstellung,
		recht: LESARTENRECHT_IN_WORTEN[einstellung.recht],
		darfUmstellen: darfLesartenUmstellen(locals.benutzer.role, einstellung.recht),
		universalvariante: gemeinschaft.ausnahmen?.universalvariante ?? UNIVERSALVARIANTE_VORGABE,
		veraltet,
		// Für das Layout: Diese Seite führt ihre Rechte selbst und sagt sie; der
		// allgemeine Satz «Nur zum Nachsehen» stimmte hier nicht.
		eigeneRechte: true
	};
};

export const actions: Actions = {
	lesarten: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const eingabe = Object.fromEntries(LESARTEN.map((l) => [l.kennung, text(daten.get(l.kennung))]));
		try {
			// Die Rolle vom angemeldeten Konto, nie aus dem Formular.
			await speichereLesarten(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				locals.benutzer.role,
				params.id,
				eingabe
			);
			return { lesartenGespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(fehler.kennung === 'nicht_erlaubt' ? 403 : 400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	nachziehen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const { nachgezogen, uebersprungen } = await erfordernisseNachziehen(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			if (uebersprungen.length > 0) {
				return {
					nachgezogen,
					fehler: { nachricht: `Nicht nachgezogen: ${uebersprungen.join(' ')}`, feld: 'erfordernis' }
				};
			}
			return { nachgezogen };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
