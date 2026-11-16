import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { standAus, text } from '$lib/server/formular';
import { Schreibkonflikt } from '$lib/domain/schreibstand';
import { LEITUNGSFELDER } from '$lib/domain/versammlung';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { holeVersammlungstag, setzeAbendleitung } from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/** Ein Zeitpunkt in hiesiger Zeit — der Kern liest keine Uhr (AD-1, AD-12). */
function jetzt(): string {
	return new Date().toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}

/**
 * Die Zusammenstellung des Abends (Story 7.5b).
 *
 * **Keine Speicherung, kein Entwurf, keine Fassungen** — anders als beim
 * Protokoll einer einzelnen Versammlung. Der Grund steht im Kern
 * (`domain/gemeinsamesprotokoll.ts`): Die Zusammenstellung ist kein Protokoll im
 * Rechtssinn. Ein gespeicherter Text, den jemand danach bearbeitet, wäre genau
 * das Gegenteil davon — eine zweite Wahrheit neben den sieben Protokollen, die
 * gelten. Sie entsteht deshalb bei jedem Aufruf neu aus dem, was gerade steht.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	/*
	 * **Die Wahl steht in der Adresse, nicht in der Datenbank.** Sie betrifft die
	 * Ausgabe und nicht den Bestand — und sie muss vom Bildschirm in denselben
	 * PDF-Aufruf durchreichen, damit beide dasselbe Dokument zeigen. Vorgabe ist
	 * «mit»: Das Gesetz verlangt keine Unterschrift, die meisten Reglemente schon.
	 */
	const unterschriften = url.searchParams.get('unterschrift') !== 'ohne';

	const zusammenstellung = await stelleAbendzusammenstellungZusammen(
		locals.benutzer.operatorId,
		params.id,
		jetzt(),
		locals.benutzer.displayName,
		unterschriften
	);
	if (!zusammenstellung) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const tag = await holeVersammlungstag(locals.benutzer.operatorId, params.id);

	return { zusammenstellung, unterschriften, tag };
};

export const actions: Actions = {
	/**
	 * **Warum hier und nicht bei den Angaben des Abends** (Auftraggeber, 26.08.2026):
	 * Wer den Vorsitz führte, steht erst am Abend fest; die Angaben werden Wochen
	 * vorher gesetzt. Gebraucht wird der Name genau hier — im Kopf und über der
	 * Unterschriftszeile des Dokuments, das auf dieser Seite entsteht.
	 *
	 * Die Zusammenstellung wird bei jedem Aufruf neu gebaut, ein Nachziehen des
	 * Textes entfällt also: Nach dem Speichern steht der Name sofort drin.
	 */
	leitung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const mitgeschickt = standAus(daten, Object.keys(LEITUNGSFELDER));
		try {
			await setzeAbendleitung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				{
					sitzungsleitung: text(daten.get('sitzungsleitung')),
					protokollfuehrung: text(daten.get('protokollfuehrung'))
				},
				mitgeschickt
			);
			return { hinweis: 'Vorsitz und Protokollführung festgehalten.' };
		} catch (fehler) {
			/*
			 * **Mit dem neuen Stand zurück.** `use:enhance` lädt bei einer Absage
			 * nicht neu; ohne `stand` schickten die versteckten Felder wieder den
			 * alten mit, und der zweite Versuch liefe in denselben Konflikt.
			 */
			if (fehler instanceof Schreibkonflikt) {
				return fail(409, {
					werte: Object.fromEntries(daten),
					stand: fehler.aktuell,
					fehler: { nachricht: fehler.message }
				});
			}
			if (fehler instanceof FachlicherFehler) {
				// Der mitgeschickte Stand geht zurück: Bei einer fachlichen Absage hat
				// sich in der Datenbank nichts geändert, er bleibt also der geltende.
				return fail(400, {
					werte: Object.fromEntries(daten),
					stand: Object.fromEntries(
						Object.entries(mitgeschickt).map(([f, w]) => [f, w ?? ''])
					),
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	}
};
