import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { holeAlleVersammlungen } from '$lib/server/versammlungen';
import { hausDesAbends, nimmAusTag, nimmInTagAuf } from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Wer an dieser gemeinsamen Versammlung mittagt.
 *
 * Drei Befunde vom 11.08.2026 stecken in dieser Seite:
 *
 *   * **Herausnehmen war endgültig.** «Ich wollte das rückgängig machen und
 *     konnte nicht» — der Weg zurück führte über eine Auswahlliste mit zehn
 *     ähnlich benannten Einträgen. Jetzt steht «Rückgängig» direkt neben der
 *     Meldung, samt der alten Stelle im Ablauf.
 *   * **Die Liste bot Versammlungen an, die schon anderswo eingeplant waren.**
 *     Ein Klick riss sie dort still heraus. Jetzt sagt der Eintrag, wo sie
 *     hängt, und das Aufnehmen verlangt eine Bestätigung.
 *   * **Die Absage kam als Serverfehler.** Wer eine zweite Versammlung derselben
 *     Gemeinschaft aufnahm, bekam «duplicate key value violates unique
 *     constraint» zu sehen. Die Schranke stammt aus Migration 028 und ist
 *     richtig; sie steht jetzt als Prüfung im Kern (`domain/zuordnung.ts`) und
 *     nennt Grund und Ausweg.
 */
export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const { rahmenTag } = await parent();
	const alle = await holeAlleVersammlungen(locals.benutzer.operatorId, 'alle');

	return {
		/**
		 * Was hier schon mittagt, in der Reihenfolge des Ablaufs.
		 *
		 * **Ausdrücklich sortiert.** `holeAlleVersammlungen` ordnet nach Datum, und
		 * bei einer gemeinsamen Versammlung haben alle dasselbe — dann entschied
		 * die Reihenfolge der Datenbankseiten. Eine gelöste und wieder aufgenommene
		 * Versammlung stand danach irgendwo, obwohl das Aufnehmen ihre alte Stelle
		 * genau wiederherstellt (Prüflauf 11.08.2026).
		 */
		/*
		 * **Auch die archivierten** (25.08.2026, aus dem Code-Review). Eine
		 * archivierte Versammlung behält ihren Abend und belegt weiter den
		 * eindeutigen Platz je Gemeinschaft (Migration 028). Fiele sie hier
		 * heraus, gäbe es keinen «lösen»-Knopf mehr — und der Versuch, eine
		 * Ersatzversammlung aufzunehmen, scheiterte mit dem Verweis auf eine
		 * Zeile, die nirgends zu sehen ist.
		 */
		dabei: alle
			.filter((v) => v.tagId === params.id)
			.sort((a, b) => (a.stelle ?? 0) - (b.stelle ?? 0))
			.map((v) => ({
				id: v.id,
				gemeinschaft: v.gemeinschaftName,
				datum: v.datum,
				ort: v.ort,
				stufe: v.stufe,
				zustand: v.zustand,
				archiviertAm: v.archiviertAm ?? v.gemeinschaftArchiviertSeit ?? null
			})),
		/*
		 * Wählbar ist, was noch nicht eröffnet ist. Auch Versammlungen, die schon
		 * zu einer anderen gemeinsamen Versammlung gehören — sie zu verstecken
		 * hiesse, den Umzug unmöglich zu machen. Aber sie sagen, wo sie hängen.
		 */
		waehlbar: alle
			.filter(
				(v) =>
					v.tagId !== params.id &&
					// Weder einzeln archiviert noch als Teil einer archivierten Gruppe.
					!v.archiviertAm &&
					!v.gemeinschaftArchiviertSeit &&
					(v.zustand === 'entwurf' || v.zustand === 'freigegeben')
			)
			.map((v) => ({
				id: v.id,
				gemeinschaft: v.gemeinschaftName,
				datum: v.datum,
				ort: v.ort,
				stufe: v.stufe,
				schonWo: v.tagId ? (v.tagId === rahmenTag.id ? null : 'anderswo') : null
			}))
	};
};

function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

export const actions: Actions = {
	/*
	 * abend: versammlung — hier gehört die Versammlung noch **nicht** zum Abend,
	 * das ist der Zweck der Handlung; `hausDesAbends` wäre die falsche Frage und
	 * sperrte den einzigen Weg hinein.
	 *
	 * **Und es gibt hier keine Zugehörigkeitsschranke, mit Absicht** (Code-Review
	 * 08.09.2026, zweiter Durchgang — der erste Anlauf dieser Zeile behauptete,
	 * `nimmInTagAuf` weise ab, was schon anderswo mittagt; das tut es nicht).
	 * `pruefeAufnahme` sperrt allein, was in **diesem** Abend schon vorkommt.
	 * Eine Versammlung aus einem anderen Abend ergibt eine **Rückfrage**, und
	 * bestätigt zieht sie um. Genau so ist es gewollt und im Drehbuch
	 * `e2e/zuordnung.mjs` festgehalten.
	 *
	 * Die Grenze ist deshalb der Betreiber (`alsBetreiber`, Zeilenschutz),
	 * geschrieben wird `meeting_day_id = params.id`. Eine untergeschobene
	 * Kennung holt eine fremde Versammlung **in den eigenen Abend** — sichtbar,
	 * nicht verdeckt, und rückgängig zu machen.
	 */
	aufnehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		const stelle = Number(text(daten.get('stelle')) || '0');
		try {
			const plan = await nimmInTagAuf(
				handelnder(locals),
				params.id,
				versammlung,
				stelle,
				text(daten.get('bestaetigt')) === 'ja'
			);
			/*
			 * **Was dabei umgestellt wurde, steht im Satz** (25.08.2026). Seit die
			 * Zuordnung die harten Angaben des Abends übernimmt, ist «tagt jetzt
			 * mit» nur noch die halbe Auskunft: Tag, Ort oder Abstimmungsweise
			 * können sich mit geändert haben. Eine Änderung, die man erst im Saal
			 * bemerkt, ist eine stille.
			 */
			const geaendert = plan.aendern[0]?.was ?? [];
			const gesperrt = plan.gesperrt[0];
			return {
				hinweis:
					'Die Gemeinschaft tagt jetzt mit.' +
					(geaendert.length > 0
						? ` Vom gemeinsamen Anlass übernommen: ${geaendert.join(', ')}.`
						: '') +
					(gesperrt
						? ` Ihre eigenen Angaben bleiben stehen: ${gesperrt.grund}.`
						: '')
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die Rückfrage ist kein Fehler, sondern eine Zwischenstufe: Die
				// Seite zeigt sie mit einem Knopf, der dasselbe noch einmal
				// abschickt — diesmal bestätigt.
				if (fehler.feld === 'bestaetigt') {
					return fail(400, {
						rueckfrage: { text: fehler.message, versammlung, stelle }
					});
				}
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine Versammlung wieder aus dem Abend lösen.
	 *
	 * **Erst prüfen, dass sie überhaupt zu diesem Abend gehört** (08.09.2026,
	 * aus dem neuen `check-abendbindung`). `nimmAusTag` setzt `meeting_day_id`
	 * allein über die Kennung auf NULL und kennt den Abend nicht; ohne die
	 * Schranke löste die Seite des einen Abends eine Versammlung aus dem
	 * anderen, und im Saal fehlte sie erst, wenn niemand mehr sucht.
	 */
	loesen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const versammlung = text(daten.get('versammlung'));
		/*
		 * **Mit Auffangnetz, seit hier eine Schranke steht** (Code-Review
		 * 08.09.2026). `nimmAusTag` warf damals nie fachlich (seit 27.10.2026 bei
		 * einer Versammlung, die es nicht gibt), deshalb kam die Handlung ohne
		 * `try` aus. `hausDesAbends` wirft — ohne das hier wäre aus einer
		 * fremden oder leeren Kennung eine 500-Seite geworden statt einer Absage
		 * im Formular.
		 */
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id, versammlung);
			const vorher = await nimmAusTag(handelnder(locals), versammlung);
			return {
				hinweis: 'Die Versammlung steht wieder für sich.',
				// Alles, was das Rückgängigmachen braucht — ohne die alte Stelle käme
				// sie ans Ende der Reihe zurück.
				rueckgaengig: { versammlung, stelle: vorher.stelle }
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
