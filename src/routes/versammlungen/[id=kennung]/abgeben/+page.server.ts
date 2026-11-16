import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/fehler';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { erhebeLage, gibAb, holeAbgaben, nimmAbgabeZurueck } from '$lib/server/abgabe';
import { holeGeraete } from '$lib/server/geraete';
import { festeHerkunft } from '$lib/server/herkunft';
import type { Actions, PageServerLoad } from './$types';

/**
 * Der Zeitpunkt in hiesiger Zeit (AD-12).
 *
 * Er steht später im Manifest neben Uhrzeiten, die niemand umrechnet, und auf
 * dem Notebook kann die Uhr ohne Netzabgleich falsch gehen.
 */
function jetzt(): string {
	return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Eine Versammlung an das Gerät im Saal abgeben.
 *
 * Eine Seite mit zwei Handlungen, die einander ausschliessen: abgeben, solange
 * nichts unterwegs ist, und zurücknehmen, wenn etwas unterwegs ist und nicht
 * zurückkommt.
 *
 * **Kein Schlüssel geht durch diese Seite.** Ein früherer Entwurf gab nach der
 * Abgabe einen Schlüssel zum Abtippen aus; entschieden wurde am 18.09.2026 für
 * die Geräteregistrierung. Das Paket wird für den öffentlichen Teil des
 * eingetragenen Geräts verschlüsselt, und der geheime Teil hat dieses Haus nie
 * verlassen, weil er dort entstanden ist, wo er gebraucht wird.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, lage, verlauf, geraete] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		erhebeLage(locals.benutzer.operatorId, params.id, versammlung),
		holeAbgaben(locals.benutzer.operatorId, params.id),
		holeGeraete(locals.benutzer.operatorId)
	]);

	return {
		versammlung,
		gemeinschaft,
		lage,
		verlauf,
		/*
		 * Nur die gültigen: An ein widerrufenes Gerät wird nicht abgegeben, und es
		 * in der Auswahl stehen zu lassen hiesse, die Absage erst nach dem Klick zu
		 * zeigen.
		 */
		geraete: geraete.filter((g) => !g.widerrufenAm),
		/*
		 * **Nur die feste Adresse, kein Rückfall auf die laufende Anfrage**
		 * (dieselbe Strenge wie beim Erinnerungslauf). Im Saal lautet die Herkunft
		 * der Anfrage auf das Notebook selbst; als Rückgabeadresse im Paket wäre
		 * das eine Adresse, die auf das Gerät zeigt, das zurückgeben soll.
		 */
		herkunft: festeHerkunft()
	};
};

export const actions: Actions = {
	abgeben: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');

		const formular = await request.formData();
		const geraetId = String(formular.get('geraet') ?? '');

		try {
			const bericht = await gibAb(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				versammlung,
				{ geraetId, herkunft: festeHerkunft(), jetzt: jetzt() }
			);
			return { abgegeben: true, geraet: bericht.abgabe.geraet };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: fehler.message, feld: fehler.feld });
			}
			throw fehler;
		}
	},

	zuruecknehmen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const formular = await request.formData();
		const grund = String(formular.get('grund') ?? '');

		try {
			await nimmAbgabeZurueck(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				grund
			);
			return { zurueckgenommen: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: fehler.message, feld: fehler.feld });
			}
			throw fehler;
		}
	}
};
