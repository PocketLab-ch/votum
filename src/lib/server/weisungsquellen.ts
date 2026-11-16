/**
 * Beschlüsse, aus denen sich eine Weisung ableiten lässt (Story 7.4).
 *
 * Gesucht wird in den Versammlungen der Gemeinschaft, auf die eine Partei
 * lautet: geschlossene, nicht überholte Durchgänge. Angeboten wird nur, was
 * wirklich ein Ergebnis hat — ein laufender Durchgang wäre eine Zusage auf
 * etwas, das noch niemand beschlossen hat.
 */
import { alsBetreiber } from './db';
import type { Id } from '$lib/domain/types';

export interface Weisungsquelle {
	versammlungId: Id;
	durchgangId: Id;
	/** Was in der Auswahlliste steht: Datum, Traktandum, Durchgang. */
	text: string;
}

export async function holeMitgliedsgemeinschaft(
	operatorId: Id,
	parteiId: Id
): Promise<Weisungsquelle[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				meeting_id: string;
				round_id: string;
				meeting_date: Date;
				title: string;
				ordinal: number;
			}[]
		>`
			SELECT v.meeting_id, v.id AS round_id, m.meeting_date, a.title, v.ordinal
			FROM party p
			JOIN meeting m       ON m.stweg_id = p.member_stweg_id
			JOIN voting_round v  ON v.meeting_id = m.id
			JOIN agenda_item a   ON a.id = v.agenda_item_id
			WHERE p.id = ${parteiId}
			  AND p.member_stweg_id IS NOT NULL
			  AND v.state = 'geschlossen'
			  AND v.superseded_at IS NULL
			ORDER BY m.meeting_date DESC, a.position, v.ordinal
			LIMIT 100
		`;
		return zeilen.map((z) => ({
			versammlungId: z.meeting_id,
			durchgangId: z.round_id,
			text:
				`${z.meeting_date.toISOString().slice(0, 10)} · ${z.title}` +
				(Number(z.ordinal) > 1 ? ` (${z.ordinal}. Durchgang)` : '')
		}));
	});
}

/**
 * Der Hausbeschluss zu **diesem** Geschäft — je weisungspflichtiger Partei.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Ja, und die Weisung müsstest du dann auch
 * bauen, dass dann korrekt abgestimmt wird.»
 *
 * **Warum das Geschäft die Verbindung ist und nicht eine neue Spalte.** Ein
 * Siedlungsgeschäft wird einmal angelegt und läuft in jedem Haus und in der
 * Miteigentümergemeinschaft als eigenes Traktandum — verbunden über
 * `agenda_item.business_id`. Damit ist ohne weiteres Zutun bekannt, welcher
 * Hausbeschluss zu welchem Punkt der MEG gehört. Eine zusätzliche Spalte wäre
 * ein zweiter Schreiber für dieselbe Tatsache und liefe irgendwann auseinander.
 *
 * Geliefert wird nur, was **feststeht**: geschlossene, nicht überholte
 * Durchgänge. Ein laufender wäre eine Zusage auf etwas, das noch niemand
 * beschlossen hat.
 */
export interface Hausbeschluss {
	parteiId: Id;
	name: string;
	versammlungId: Id;
	durchgangId: Id;
	/** Das Traktandum im Haus — für die Meldung, welcher Punkt gemeint ist. */
	traktandumId: Id;
	/**
	 * Hat ein Folgeantrag den Beschluss des Hauses nach einem Rückkommen ersetzt,
	 * sein Titel; sonst null. Der Beschluss gilt dann einem anderen Wortlaut als
	 * dem Punkt, und eine Weisung daraus leitet die Anwendung nicht von selbst
	 * ab (Codeprüfung B2a, M3).
	 */
	folgeantrag: string | null;
}

/**
 * Ob der Punkt zu einem gemeinsamen Geschäft gehört, und welche
 * Mitgliedsgemeinschaften es **mitführen**.
 *
 * **Warum beides aus einer Abfrage kommt** (Code-Review 08.09.2026). Der erste
 * Anlauf stellte zwei Fragen in zwei Transaktionen — und zwei Leser derselben
 * Tatsache laufen auseinander, sobald einer von beiden angepasst wird. Das CTE
 * hat `business_id` ohnehin in der Hand.
 *
 * **Warum es diese Zwischenfrage überhaupt braucht** (08.09.2026, im
 * Browserlauf über den Verbund gemessen). Die Sammelableitung kannte
 * zwei Zustände: Beschluss da oder nicht. Der häufigere dritte fiel in den
 * zweiten — das Haus führt den Punkt gar nicht unter diesem Geschäft — und
 * bekam denselben Satz: «kein geschlossener Beschluss zu diesem Geschäft». Wer
 * ihn las, ging ins Haus und fand dort einen sauber geschlossenen Beschluss.
 *
 * Der Abend fasst lose Traktanden **über den Titel** zusammen
 * (`fasseZusammen`). Zwei Punkte, die dasselbe meinen, aber verschieden heissen
 * — «Sitzbank beim Sandkasten» hier, «Sitzbank beim Sandkasten (Weisung an den
 * Vertreter)» im Haus —, bleiben deshalb zwei Geschäfte. Das ist keine Störung,
 * sondern die Regel; sie muss nur gesagt werden.
 *
 * bindung: traktandumId — der Punkt wird über seine eigene Kennung gelesen und
 * gibt Geschäft und Gemeinschaft für alles Weitere vor; eine fremde Kennung
 * liefert eine leere Menge.
 */
export async function holeGeschaeftslage(
	operatorId: Id,
	traktandumId: Id
): Promise<{ gemeinsam: boolean; haeuser: Set<Id> }> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Ohne `WHERE`, dafür mit einer Spalte `fuehrt`.** Ein Filter auf die
		 * Verbindung hätte die Zeile weggeworfen, die allein die erste Frage
		 * beantwortet: Ein Punkt ohne Geschäft hat gar keine verbundenen Häuser
		 * und muss trotzdem eine Zeile liefern, sonst sähe er aus wie ein Punkt,
		 * den es nicht gibt.
		 */
		const zeilen = await tx<
			{ business_id: string | null; party_id: string | null; fuehrt: boolean }[]
		>`
			WITH punkt AS (
				SELECT a.business_id, m.stweg_id
				FROM agenda_item a
				JOIN meeting m ON m.id = a.meeting_id
				WHERE a.id = ${traktandumId}
			)
			SELECT DISTINCT punkt.business_id, p.id AS party_id, (h.id IS NOT NULL) AS fuehrt
			FROM punkt
			LEFT JOIN party p       ON p.stweg_id = punkt.stweg_id AND p.kind = 'gemeinschaft'
			LEFT JOIN meeting hm    ON hm.stweg_id = p.member_stweg_id
			LEFT JOIN agenda_item h ON h.meeting_id = hm.id AND h.business_id = punkt.business_id
		`;
		return {
			gemeinsam: zeilen.some((z) => z.business_id !== null),
			haeuser: new Set(
				zeilen.filter((z) => z.fuehrt && z.party_id).map((z) => z.party_id as Id)
			)
		};
	});
}

export async function holeHausbeschluesseZumGeschaeft(
	operatorId: Id,
	/** Das Traktandum der Miteigentümergemeinschaft. */
	traktandumId: Id
): Promise<Hausbeschluss[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				party_id: string;
				display_name: string;
				meeting_id: string;
				round_id: string;
				agenda_item_id: string;
				folgeantrag: string | null;
			}[]
		>`
			WITH punkt AS (
				SELECT a.meeting_id, a.business_id, m.stweg_id
				FROM agenda_item a
				JOIN meeting m ON m.id = a.meeting_id
				WHERE a.id = ${traktandumId}
			)
			SELECT DISTINCT ON (p.id)
			       p.id AS party_id, p.display_name,
			       h.meeting_id, v.id AS round_id, h.id AS agenda_item_id,
			       (SELECT f.title FROM agenda_item f
			         WHERE f.id = v.agenda_item_id AND f.id <> h.id) AS folgeantrag
			FROM punkt
			JOIN party p          ON p.stweg_id = punkt.stweg_id AND p.kind = 'gemeinschaft'
			JOIN meeting hm       ON hm.stweg_id = p.member_stweg_id
			JOIN agenda_item h    ON h.meeting_id = hm.id AND h.business_id = punkt.business_id
			-- Dazu der massgebende Durchgang der Sache (Migration 133): Hat im Haus
			-- ein Folgeantrag den Beschluss nach einem Rückkommen ersetzt, liegt
			-- der geltende Beschluss an ihm, nicht am Geschäft. Ohne ihn
			-- verschwand der Hausbeschluss als Weisungsquelle (Codeprüfung B1).
			JOIN voting_round v   ON v.agenda_item_id = h.id OR v.id = massgebender_durchgang(h.id)
			WHERE punkt.business_id IS NOT NULL
			  AND v.state = 'geschlossen'
			  AND v.superseded_at IS NULL
			-- Der jüngste geschlossene Durchgang je Haus: Nach einem Rückkommen
			-- gilt der zweite, nicht der erste.
			ORDER BY p.id, v.closed_at DESC NULLS LAST, v.ordinal DESC
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			name: z.display_name,
			versammlungId: z.meeting_id,
			durchgangId: z.round_id,
			traktandumId: z.agenda_item_id,
			folgeantrag: z.folgeantrag
		}));
	});
}
