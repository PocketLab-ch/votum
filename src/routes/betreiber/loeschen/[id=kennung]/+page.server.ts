import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { darfStammdatenAendern, VERWALTUNG_VORBEHALTEN } from '$lib/domain/rollen';
import { datumLang } from '$lib/domain/datum';
import type { Loeschangaben } from '$lib/domain/loeschfrist';
import { jaNein, text } from '$lib/server/formular';
import {
	erhebeLoeschlage,
	loescheNachFrist,
	pruefeLoeschungVorab
} from '$lib/server/aufbewahrung';
import type { Actions, PageServerLoad } from './$types';

/**
 * Eine Versammlung nach Ablauf der Anfechtungsfrist löschen (Produktentscheid
 * 17.09.2026).
 *
 * **Der Verwaltung vorbehalten, auch das Lesen**, wie die Betreiberseite, von
 * der man herkommt: Die Seite nennt Gemeinschaften, Daten und Zahlen des ganzen
 * Bestands.
 *
 * **Zwei Schritte.** Der erste Druck prüft alles und fragt dann mit Zahlen vom
 * Server nach, was verschwindet. Erst der zweite löscht. So kommt eine Absage
 * vor der Frage und nicht nach dem «Ja» (`docs/gestaltung.md`, «Löschen steht
 * leise unten und fragt mit Zahlen»).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);
	try {
		return { lage: await erhebeLoeschlage(locals.benutzer.operatorId, params.id) };
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) error(404, fehler.message);
		throw fehler;
	}
};

function angabenAus(daten: FormData): Loeschangaben {
	return {
		zugestelltAm: text(daten.get('zugestelltAm')),
		paketArchiviert: jaNein(daten.get('paketArchiviert')),
		protokollArchiviert: jaNein(daten.get('protokollArchiviert')),
		keineAnfechtung: jaNein(daten.get('keineAnfechtung'))
	};
}

export const actions: Actions = {
	loeschen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

		const daten = await request.formData();
		const angaben = angabenAus(daten);
		let meldung: string;

		try {
			if (text(daten.get('bestaetigt')) !== 'true') {
				const lage = await pruefeLoeschungVorab(locals.benutzer.operatorId, params.id, angaben);
				return fail(400, { rueckfrage: { zahlen: lage.zahlen }, werte: angaben });
			}

			const lage = await erhebeLoeschlage(locals.benutzer.operatorId, params.id);
			const ergebnis = await loescheNachFrist(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				angaben
			);

			const erste = lage.versammlungen[0];
			meldung =
				ergebnis.versammlungen === 1
					? `Gelöscht: ${erste.gemeinschaft}, Versammlung vom ${datumLang(erste.datum)}.`
					: `Gelöscht: der Abend «${lage.abend ?? ''}» mit ${ergebnis.versammlungen} Versammlungen.`;
			if (ergebnis.dateienUebrig > 0) {
				meldung += ` ${ergebnis.dateienUebrig} Dateien liessen sich nicht aus der Ablage entfernen; das Protokoll des Dienstes nennt sie.`;
			}
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: angaben
				});
			}
			throw fehler;
		}

		// Ausserhalb des `try`: `redirect` wirft, und der Fänger oben hielte ihn fest.
		redirect(303, `/betreiber?geloescht=${encodeURIComponent(meldung)}`);
	}
};
