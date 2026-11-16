import { error, fail } from '@sveltejs/kit';
import { archiviereMehrere } from '$lib/server/archivieren';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { darfStammdatenAendern, VERWALTUNG_VORBEHALTEN } from '$lib/domain/rollen';
import { holeAlleVersammlungen } from '$lib/server/versammlungen';
import { holeVersammlungstage } from '$lib/server/versammlungstag';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import type { Versammlungseintrag } from '$lib/domain/versammlungsliste';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Übersicht führt Einzelversammlungen und Abende zusammen.
 *
 * Beides in einer Liste, weil beides dieselbe Frage beantwortet: Was steht an?
 * Zwei getrennte Ansichten hiessen, an zwei Stellen nachzusehen, ob heute etwas
 * läuft. Gruppiert und gefiltert wird im Kern (`domain/versammlungsliste`), hier
 * wird nur geholt.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const [versammlungen, tage, gemeinschaften] = await Promise.all([
		// **Auch die archivierten** — die Seite filtert selbst, damit der Schalter
		// ohne Seitenwechsel wirkt und der Archivhinweis exakt zählt.
		holeAlleVersammlungen(locals.benutzer.operatorId, 'alle'),
		holeVersammlungstage(locals.benutzer.operatorId),
		// Nur fuer «gibt es ueberhaupt eine Gemeinschaft?» — die Frage stellt
		// sich fuer die aktiven.
		listeGemeinschaften(locals.benutzer.operatorId, 'aktiv')
	]);

	// Nur, was die Liste anzeigt und wonach sie sucht. Das ganze Versammlungsobjekt
	// mitzuschicken hiesse, Wandbild, Zeitstempel und Momentaufnahme über die
	// Leitung zu tragen, damit ein Datum in einer Zeile steht.
	const eintraege: Versammlungseintrag[] = versammlungen.map((v) => ({
		id: v.id,
		datum: v.datum,
		uhrzeit: v.uhrzeit,
		ort: v.ort,
		gemeinschaftName: v.gemeinschaftName,
		art: v.art,
		stufe: v.stufe,
		anlass: v.anlass ?? null,
		zustand: v.zustand,
		tagId: v.tagId,
		// Ohne diese Zeile filterte die Seite gegen `undefined`: Archiviertes
		// stand weiter in der Liste, und der Schalter erschien nie (25.08.2026).
		archiviertAm: v.archiviertAm ?? null,
		/*
		 * **Der Archivstand der Gruppe, nicht nur der Versammlung** (25.08.2026,
		 * zweite Reviewrunde). Ohne dieses Feld filterte und zählte die Seite
		 * allein nach der Archivmarke der Versammlung: Die zwölf Versammlungen
		 * einer archivierten Gemeinschaft standen weiter in der Liste, und der
		 * Schalter erschien nicht — während die Startseite sie längst ausblendete.
		 * Zwei Ansichten, zwei Antworten.
		 */
		gemeinschaftArchiviertSeit: v.gemeinschaftArchiviertSeit ?? null
	}));

	return {
		versammlungen: eintraege,
		tage,
		hatGemeinschaften: gemeinschaften.length > 0,
		// Die Meldung nach dem Löschen reist über die Adresse hierher: Die
		// gelöschte Versammlung hat keine Seite mehr, auf der sie stehen könnte.
		geloescht: url.searchParams.get('geloescht')
	};
};

export const actions: Actions = {
	/**
	 * Mehrere Versammlungen auf einmal ins Archiv (Auftraggeber, 15.09.2026).
	 *
	 * **Die Rolle wird hier geprüft und nicht über den Pfad** (Vorgabe des Auftraggebers:
	 * «Nur die Verwaltung»). `/versammlungen` steht bewusst nicht in
	 * `VERWALTUNGSBEREICHE`: Unter diesem Pfad liegen 99 schreibende Handlungen,
	 * davon 32 allein in der Sitzungsleitung — Traktanden aufrufen, Abstimmungen
	 * schliessen, versiegeln. Wer den Bereich pauschal einträgt, nimmt der
	 * Sitzungsleitung genau das, wofür es sie gibt.
	 *
	 * Archivieren ist dagegen Aufräumen am Bestand und gehört zur Verwaltung.
	 * Also eine Schranke an dieser einen Handlung.
	 */
	sammelArchivieren: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

		const daten = await request.formData();
		const ids = daten.getAll('id').map(String).filter(Boolean);
		const notiz = String(daten.get('notiz') ?? '').trim() || null;

		if (ids.length === 0) {
			return fail(400, {
				quelle: 'sammel',
				fehler: { nachricht: 'Nichts ausgewählt.', feld: 'auswahl' }
			});
		}

		try {
			const ergebnis = await archiviereMehrere(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				'versammlung',
				ids,
				notiz
			);
			return { quelle: 'sammel', ergebnis };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'sammel',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	}
};
