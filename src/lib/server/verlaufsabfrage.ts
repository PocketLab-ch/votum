/**
 * Den Verlauf lesen.
 *
 * Geschrieben wird er in `audit.ts`; hier wird er nur abgefragt. Getrennt, weil
 * das Lesen andere Rücksichten braucht: Es liefert viele Zeilen, es braucht
 * Seitenweise, und es darf niemals etwas verändern.
 *
 * **Gefiltert wird in der Datenbank, nicht im Gerät.** Der Verlauf kommt
 * seitenweise; ein Filter im Browser sähe nur die gerade geladenen fünfzig
 * Zeilen und meldete «nichts gefunden», während der Treffer auf Seite vier
 * steht. Die Regel dazu steht im Kern (`domain/verlaufsfilter.ts`), die
 * Ausführung hier.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { alsKennung } from './kennungen';
import type { Verlaufsfilter } from '$lib/domain/verlaufsfilter';
import { EREIGNISARTEN, PROTOKOLLVORGANGSARTEN } from '$lib/domain/verlauf';

export interface Verlaufszeile {
	id: string;
	art: string;
	gegenstandArt: string | null;
	gegenstandId: string | null;
	handelnder: string;
	angaben: Record<string, unknown>;
	zeitpunkt: Date;
	zeitquelle: string;
}

/** Voreinstellung der Seitengrösse. Bewusst klein — der Verlauf wird lang. */
export const SEITENGROESSE = 50;

/**
 * Bereitet den Suchbegriff für ILIKE vor.
 *
 * `%` und `_` sind dort Platzhalter: Wer nach «100%» sucht, bekäme sonst jede
 * Zeile, die mit «100» beginnt. Der Gegenschrägstrich muss zuerst verdoppelt
 * werden, sonst entwertet die Ersetzung ihre eigenen Fluchtzeichen.
 */
/**
 * Nur echte Kennungen duerfen in die Abfrage.
 *
 * Ein Tippfehler in der Adresse — `?versammlung=abc` — landete sonst als
 * Zeichenkette in einem `::uuid`, und PostgreSQL antwortete mit «invalid input
 * syntax»: HTTP 500 fuer eine Eingabe, die einfach nicht stimmt. Was nicht
 * passt, wird zu `null` und filtert nicht. Die Prüfung steht seit dem
 * 16.10.2026 in `kennungen.ts`; hier stand eine der drei Kopien.
 */
function suchmuster(suche: string): string {
	const entschaerft = suche.trim().replace(/\\/g, '\\\\').replace(/[%_]/g, (z) => `\\${z}`);
	return `%${entschaerft}%`;
}

/**
 * Ein Kalendertag wird in Schweizer Zeit verstanden.
 *
 * `occurred_at` trägt eine Zone; ein blosser Vergleich mit `'2026-05-19'`
 * schnitte in UTC und verlöre je nach Jahreszeit die ersten ein bis zwei
 * Stunden des Tages — im Verlauf einer Versammlung, die um 17 Uhr beginnt,
 * fällt das nicht auf, im Verlauf einer Nachtsitzung schon.
 */
/**
 * Die Kennungen der Traktanden, die aus dieser Versammlung entfernt wurden.
 *
 * **Der gemeinsame Baustein für Verlauf und Protokoll** (Auftrag D,
 * Produktentscheid 01.10.2026). `gehoertZu` braucht ihn, damit die Einträge
 * eines entfernten Traktandums im Verlauf der Versammlung bleiben;
 * `holeVorgaengeFuerProtokoll` braucht ihn, damit dieselben Einträge bei den
 * Protokollvorgängen mitkommen. Zwei Kopien derselben Unterabfrage liefen beim
 * nächsten Mal auseinander. Dieselbe Bedingung steht ausserdem in SQL, in
 * `versammlungen_endgueltig_loeschen` (Migration 137); wer sie hier ändert,
 * ändert sie dort mit.
 *
 * **Im Protokoll steht ein solcher Vorgang trotzdem nicht.** `holeAuswertung`
 * hängt Vorgänge an die Zeile ihres Traktandums, und ein entferntes hat keine.
 * Das bleibt so (Produktentscheid 03.10.2026: «ok, wenn der Verlauf das
 * festhält»); der Verlauf führt ihn, belegt in `tests/db/protokoll.test.ts`.
 *
 * **Warum die Angaben tragen.** `detail` ist frei geformt und nennt die
 * Versammlung nicht verlässlich, für diese eine Ereignisart aber schon: Alle
 * Schreibstellen (`entferneTraktandum`, `loescheGeschaeft`, `setzeBeteiligte`)
 * setzen `versammlung` aus der gelöschten Zeile, nie aus einer Eingabe. Wer
 * eine weitere Schreibstelle baut, muss das halten, sonst fällt der Eintrag
 * still wieder heraus.
 */
function entfernteTraktanden(tx: postgres.TransactionSql, versammlung: string | null) {
	return tx`
		SELECT e.subject_id FROM audit_entry e
		WHERE e.subject_type = 'agenda_item'
		  AND e.event_type = ${EREIGNISARTEN.traktandumEntfernt}
		  AND e.detail->>'versammlung' = ${versammlung}
	`;
}

/**
 * Die Bedingung «gehoert zu dieser Versammlung» bzw. «zu dieser Gemeinschaft».
 *
 * **Warum das mehr ist als `subject_id = …`.** Ein Verlaufseintrag traegt den
 * Gegenstand, an dem er geschah — und das ist bei einer Abstimmung das
 * Traktandum, bei einer Vollmacht die Vollmacht, beim Einlass die Zeile der
 * Momentaufnahme. Alle drei tragen ihre eigene Kennung, nicht die der
 * Versammlung. Wer «Verlauf dieser Versammlung» sucht und nur auf `subject_id`
 * filtert, bekommt die Haelfte: das Eroeffnen und Schliessen, aber nichts von
 * dem, was dazwischen geschah.
 *
 * Die Untermengen sind klein — die Traktanden EINER Versammlung —, und
 * `audit_entry_subject_idx (subject_type, subject_id)` traegt die Suche.
 *
 * **`voting_round` hängt direkt an der Versammlung.** Die Tabelle trägt
 * neben `agenda_item_id` eine eigene `meeting_id` (Migration 020); der
 * Verlaufseintrag einer Handzählung trägt die Kennung des Durchgangs. Ohne
 * eigenen Zweig fiele gerade der Eintrag heraus, der im Streitfall zeigt, wer
 * wann Summen erfasst oder zurückgenommen hat.
 *
 * **Und ein entferntes Traktandum bleibt zugehörig** (Produktentscheid
 * 01.10.2026). Ein Traktandum wird hart gelöscht; Anlegen, Ändern und Entfernen
 * hängen danach an einer Kennung ohne Zeile und fielen aus dem Verlauf der
 * Versammlung, in der Anzeige wie im Siegelpaket. Das Paket wäre kleiner, das
 * Siegel hielte, die Paketprüfung meldete nichts. Das Ereignis
 * `traktandumEntfernt` nennt Traktandum und Versammlung in seinen Angaben; es
 * ist die Zuordnung, die den Weg zurück trägt, und sie gilt rückwirkend für
 * alles, was je ein solches Ereignis bekam. Traktanden, die früher über ein
 * Geschäft verschwanden (`loescheGeschaeft`, `setzeBeteiligte`), bekamen
 * keines und bleiben ohne Zuordnung. Für Gemeinschaft und Abend führt der Weg
 * über die Versammlung, die das Ereignis nennt. Die Zuordnung selbst und das
 * Warum ihrer Verlässlichkeit stehen bei `entfernteTraktanden`; dieselbe
 * Unterabfrage trägt dort auch die Protokollvorgänge (Auftrag D).
 */
function gehoertZu(
	tx: postgres.TransactionSql,
	versammlung: string | null,
	gemeinschaft: string | null,
	abend: string | null
) {
	return tx`
		(${versammlung}::text IS NULL OR (
			(subject_type = 'meeting' AND subject_id = ${versammlung})
			OR (subject_type = 'agenda_item' AND subject_id IN (
				SELECT id::text FROM agenda_item WHERE meeting_id = ${versammlung}::uuid))
			OR (subject_type = 'agenda_item' AND subject_id IN (
				${entfernteTraktanden(tx, versammlung)}))
			OR (subject_type = 'voting_round' AND subject_id IN (
				SELECT id::text FROM voting_round WHERE meeting_id = ${versammlung}::uuid))
			OR (subject_type = 'proxy' AND subject_id IN (
				SELECT id::text FROM proxy WHERE meeting_id = ${versammlung}::uuid))
			OR (subject_type = 'snapshot_party' AND subject_id IN (
				SELECT id::text FROM snapshot_party WHERE meeting_id = ${versammlung}::uuid))
		))
		AND (${gemeinschaft}::text IS NULL OR (
			(subject_type = 'stweg' AND subject_id = ${gemeinschaft})
			OR (subject_type = 'meeting' AND subject_id IN (
				SELECT id::text FROM meeting WHERE stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'party' AND subject_id IN (
				SELECT id::text FROM party WHERE stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'unit' AND subject_id IN (
				SELECT id::text FROM unit WHERE stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'agenda_item' AND subject_id IN (
				SELECT a.id::text FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
					WHERE m.stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'agenda_item' AND subject_id IN (
				SELECT e.subject_id FROM audit_entry e
				JOIN meeting m ON m.id::text = e.detail->>'versammlung'
				WHERE e.subject_type = 'agenda_item'
				  AND e.event_type = ${EREIGNISARTEN.traktandumEntfernt}
				  AND m.stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'voting_round' AND subject_id IN (
				SELECT r.id::text FROM voting_round r JOIN meeting m ON m.id = r.meeting_id
					WHERE m.stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'proxy' AND subject_id IN (
				SELECT p.id::text FROM proxy p JOIN meeting m ON m.id = p.meeting_id
					WHERE m.stweg_id = ${gemeinschaft}::uuid))
			OR (subject_type = 'snapshot_party' AND subject_id IN (
				SELECT s.id::text FROM snapshot_party s JOIN meeting m ON m.id = s.meeting_id
					WHERE m.stweg_id = ${gemeinschaft}::uuid))
		))
		AND (${abend}::text IS NULL OR (
			(subject_type = 'meeting_day' AND subject_id = ${abend})
			OR (subject_type = 'meeting' AND subject_id IN (
				SELECT id::text FROM meeting WHERE meeting_day_id = ${abend}::uuid))
			OR (subject_type = 'agenda_item' AND subject_id IN (
				SELECT a.id::text FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
					WHERE m.meeting_day_id = ${abend}::uuid))
			OR (subject_type = 'agenda_item' AND subject_id IN (
				SELECT e.subject_id FROM audit_entry e
				JOIN meeting m ON m.id::text = e.detail->>'versammlung'
				WHERE e.subject_type = 'agenda_item'
				  AND e.event_type = ${EREIGNISARTEN.traktandumEntfernt}
				  AND m.meeting_day_id = ${abend}::uuid))
			OR (subject_type = 'voting_round' AND subject_id IN (
				SELECT r.id::text FROM voting_round r JOIN meeting m ON m.id = r.meeting_id
					WHERE m.meeting_day_id = ${abend}::uuid))
			OR (subject_type = 'proxy' AND subject_id IN (
				SELECT p.id::text FROM proxy p JOIN meeting m ON m.id = p.meeting_id
					WHERE m.meeting_day_id = ${abend}::uuid))
			OR (subject_type = 'snapshot_party' AND subject_id IN (
				SELECT s.id::text FROM snapshot_party s JOIN meeting m ON m.id = s.meeting_id
					WHERE m.meeting_day_id = ${abend}::uuid))
		))
	`;
}

export async function leseVerlauf(
	operatorId: string,
	optionen: Verlaufsfilter & { seite?: number } = {}
): Promise<{ zeilen: Verlaufszeile[]; weitere: boolean; gesamt: number }> {
	// Nur ganze Seiten (Codeprüfung B2, 16.10.2026): `?seite=0.01` oder `1e20`
	// liefen als Bruch oder Exponent in `OFFSET`, PostgreSQL wies das mit 22P02
	// ab, und die Seite antwortete mit 500.
	const seite = Number.isSafeInteger(optionen.seite) && optionen.seite! > 0 ? optionen.seite! : 0;
	// Eine Zeile über die Seitengrösse hinaus, um ohne zweite Abfrage zu wissen,
	// ob es weitergeht.
	const grenze = SEITENGROESSE + 1;

	const art = optionen.art?.trim() || null;
	const bereich = optionen.bereich?.trim() || null;
	const gegenstand = optionen.gegenstand?.trim() || null;
	const versammlung = alsKennung(optionen.versammlung);
	const gemeinschaft = alsKennung(optionen.gemeinschaft);
	const abend = alsKennung(optionen.abend);
	const muster = optionen.suche?.trim() ? suchmuster(optionen.suche) : null;
	const von = optionen.von?.trim() || null;
	const bis = optionen.bis?.trim() || null;

	const zeilen = await alsBetreiber(operatorId, async (tx) => {
		return tx<
			{
				id: string;
				event_type: string;
				subject_type: string | null;
				subject_id: string | null;
				actor_label: string;
				detail: Record<string, unknown>;
				occurred_at: Date;
				clock_source: string;
				gesamt: string;
			}[]
		>`
			SELECT id, event_type, subject_type, subject_id, actor_label, detail, occurred_at,
			       clock_source, count(*) OVER () AS gesamt
			FROM audit_entry
			WHERE (${art}::text IS NULL OR event_type = ${art})
			  AND (${bereich}::text IS NULL OR split_part(event_type, '.', 1) = ${bereich})
			  AND (${gegenstand}::text IS NULL OR subject_id = ${gegenstand})
			  AND ${gehoertZu(tx, versammlung, gemeinschaft, abend)}
			  AND (${von}::text IS NULL
			       OR occurred_at >= (${von}::date)::timestamp AT TIME ZONE 'Europe/Zurich')
			  AND (${bis}::text IS NULL
			       OR occurred_at < ((${bis}::date + 1)::timestamp AT TIME ZONE 'Europe/Zurich'))
			  AND (${muster}::text IS NULL
			       OR actor_label ILIKE ${muster}
			       OR event_type ILIKE ${muster}
			       OR coalesce(subject_type, '') ILIKE ${muster}
			       OR coalesce(subject_id::text, '') ILIKE ${muster}
			       OR detail::text ILIKE ${muster})
			ORDER BY occurred_at DESC, id DESC
			LIMIT ${grenze} OFFSET ${seite * SEITENGROESSE}
		`;
	});

	const weitere = zeilen.length > SEITENGROESSE;

	return {
		weitere,
		// Ohne Treffer gibt es keine Zeile und damit kein Fenster, aus dem die
		// Gesamtzahl käme — dann sind es null.
		gesamt: zeilen.length > 0 ? Number(zeilen[0].gesamt) : 0,
		zeilen: zeilen.slice(0, SEITENGROESSE).map((z) => ({
			id: String(z.id),
			art: z.event_type,
			gegenstandArt: z.subject_type,
			gegenstandId: z.subject_id,
			handelnder: z.actor_label,
			angaben: z.detail,
			zeitpunkt: z.occurred_at,
			zeitquelle: z.clock_source
		}))
	};
}

/**
 * Welche Bereiche im Bestand überhaupt vorkommen, mit ihrer Zahl.
 *
 * Nur die vorhandenen: Ein Auswahlfeld mit allen fünfundzwanzig Bereichen wäre
 * zur Hälfte eine Sackgasse — man wählt «Nutzniessung» und bekommt eine leere
 * Liste, ohne zu erfahren, dass es dazu nie einen Eintrag gab.
 *
 * Gezählt wird **ohne** den Bereichsfilter selbst, aber mit allen übrigen
 * Einschränkungen: Sonst stünde neben jedem Bereich ausser dem gewählten eine
 * Null, und man sähe nicht mehr, wohin zu wechseln sich lohnt.
 */
export async function holeBereiche(
	operatorId: string,
	optionen: Verlaufsfilter = {}
): Promise<{ bereich: string; anzahl: number }[]> {
	const gegenstand = optionen.gegenstand?.trim() || null;
	const versammlung = alsKennung(optionen.versammlung);
	const gemeinschaft = alsKennung(optionen.gemeinschaft);
	const abend = alsKennung(optionen.abend);
	const muster = optionen.suche?.trim() ? suchmuster(optionen.suche) : null;
	const von = optionen.von?.trim() || null;
	const bis = optionen.bis?.trim() || null;

	const zeilen = await alsBetreiber(operatorId, async (tx) => {
		return tx<{ bereich: string; anzahl: string }[]>`
			SELECT split_part(event_type, '.', 1) AS bereich, count(*) AS anzahl
			FROM audit_entry
			WHERE (${gegenstand}::text IS NULL OR subject_id = ${gegenstand})
			  AND ${gehoertZu(tx, versammlung, gemeinschaft, abend)}
			  AND (${von}::text IS NULL
			       OR occurred_at >= (${von}::date)::timestamp AT TIME ZONE 'Europe/Zurich')
			  AND (${bis}::text IS NULL
			       OR occurred_at < ((${bis}::date + 1)::timestamp AT TIME ZONE 'Europe/Zurich'))
			  AND (${muster}::text IS NULL
			       OR actor_label ILIKE ${muster}
			       OR event_type ILIKE ${muster}
			       OR coalesce(subject_type, '') ILIKE ${muster}
			       OR coalesce(subject_id::text, '') ILIKE ${muster}
			       OR detail::text ILIKE ${muster})
			GROUP BY 1
			ORDER BY 1
		`;
	});

	return zeilen.map((z) => ({ bereich: z.bereich, anzahl: Number(z.anzahl) }));
}

/** Ein Vorgang des Abends, der ins Protokoll gehört. */
export interface Protokollvorgang {
	art: string;
	/** Das betroffene Traktandum — `null` bei Vorgängen der ganzen Versammlung. */
	traktandumId: string | null;
	handelnder: string;
	angaben: Record<string, unknown>;
	zeitpunkt: string;
}

/**
 * Was am Abend geschah, ausser dem Abstimmen (22.08.2026, Befund D-02).
 *
 * **Vier Vorgänge fehlten im Protokoll**, obwohl die Anwendung alle vier kennt:
 * Ausstand, Rückzug, dessen Rücknahme und die Unterbrechung. Bei Traktandum 7
 * stand «(von 4)» statt «(von 5)» — ohne ein Wort dazu, warum. Wer das
 * Protokoll später liest, sieht eine Zahl, die er sich nicht erklären kann; und
 * ein Rückzug, der zurückgenommen wurde, verschwand spurlos, weil das Traktandum
 * hinterher wieder aussah wie jedes andere.
 *
 * **Aus dem Verlauf, nicht aus einem zweiten Merker.** Der Verlauf wird ohnehin
 * geschrieben, ist unveränderlich und trägt Zeitpunkt und handelnde Person. Ein
 * Merker am Traktandum liesse sich mit dem nächsten Speichern verlieren — und
 * genau das ist beim zurückgenommenen Rückzug passiert.
 *
 * Ohne Seitengrösse: Diese Arten sind je Versammlung eine Handvoll, und ein
 * Protokoll, dem die Hälfte fehlt, weil sie auf Seite zwei stand, wäre schlimmer
 * als keines.
 */
export async function holeVorgaengeFuerProtokoll(
	operatorId: string,
	meetingId: string
): Promise<Protokollvorgang[]> {
	// Die Liste steht im Kern, damit der Wächter sie gegen `ABWEICHUNGSARTEN`
	// halten kann: Eine Abweichung der Leitung geht nie ins Protokoll.
	const ARTEN = [...PROTOKOLLVORGANGSARTEN];

	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Zwei Wege zur Versammlung**, weil die Ereignisse verschieden hängen:
		 * Die Unterbrechung am `meeting`, Rückzug und Ausstand am `agenda_item`.
		 *
		 * **Und ein dritter für entfernte Traktanden** (Auftrag D,
		 * Produktentscheid 01.10.2026: «Folgeblock»). Ein Ausstand lässt sich im
		 * Entwurf erklären, und dort lässt sich das Traktandum entfernen; seine
		 * Kennung steht danach in keiner Zeile mehr, und ohne den Zweig fehlte
		 * der Vorgang hier, während der Verlauf ihn behielt. Gefunden heisst
		 * nicht gedruckt: Im Protokoll hat ein entferntes Traktandum keine Zeile,
		 * an die `holeAuswertung` den Vorgang hängen könnte, und das bleibt so
		 * (siehe `entfernteTraktanden`). `entfernteTraktanden` ist derselbe Baustein,
		 * den `gehoertZu` dafür braucht, und die Angaben des Entfernen-Ereignisses
		 * tragen die Versammlung für diese eine Art verlässlich; das Warum steht
		 * bei der Funktion. Für die Zuordnung über `detail` gibt es keinen
		 * vierten Weg.
		 */
		/*
		 * **`id::text` in der Unterabfrage**, weil `audit_entry.subject_id` text ist
		 * und `agenda_item.id` uuid. Ohne die Umwandlung sagt Postgres «operator
		 * does not exist: text = uuid», und die Protokollseite antwortet mit einem
		 * 500er. Gefunden hat es der Durchstich, kein Fachtest — die sehen kein SQL.
		 *
		 * **Und die Begründung steht HIER, nicht als `--`-Kommentar im SQL:** Ein
		 * Backtick um einen Spaltennamen beendet das Tagged Template mitten im
		 * Text; die Datei ist danach nicht mehr parsebar, und die ganze Anwendung
		 * antwortet mit 500. Zweites Mal am selben Tag hineingelaufen (das erste
		 * Mal in Migration 072).
		 *
		 * `svelte-check` meldet das zuverlässig (TS1005). Aufgefallen ist es
		 * trotzdem erst im Durchstich — weil ich nach der Änderung direkt den
		 * Durchstich startete, statt zuerst zu prüfen. Der Prüflauf hat hier keine
		 * Lücke; ich hatte ihn nur nicht laufen lassen.
		 */
		const zeilen = await tx<
			{
				event_type: string;
				subject_type: string | null;
				subject_id: string | null;
				actor_label: string;
				detail: Record<string, unknown>;
				occurred_at: Date;
			}[]
		>`
			SELECT a.event_type, a.subject_type, a.subject_id, a.actor_label, a.detail, a.occurred_at
			  FROM audit_entry a
			 WHERE a.event_type = ANY(${ARTEN})
			   AND (
			         (a.subject_type = 'meeting' AND a.subject_id = ${meetingId})
			      OR (a.subject_type = 'agenda_item' AND a.subject_id IN (
			            SELECT id::text FROM agenda_item WHERE meeting_id = ${meetingId}
			         ))
			      OR (a.subject_type = 'agenda_item' AND a.subject_id IN (
			            ${entfernteTraktanden(tx, meetingId)}
			         ))
			   )
			 ORDER BY a.occurred_at
		`;

		return zeilen.map((z) => ({
			art: z.event_type,
			traktandumId: z.subject_type === 'agenda_item' ? z.subject_id : null,
			handelnder: z.actor_label,
			angaben: z.detail ?? {},
			zeitpunkt: z.occurred_at.toISOString()
		}));
	});
}
