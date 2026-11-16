/**
 * Archivieren und Hervorholen — an **einer** Stelle für alle vier Gegenstände.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Alles. Gemeinschaften, Eigentümer und
 * Versammlungen.» Vier Tabellen, ein Vorgang: `archived_at` setzen oder leeren,
 * einen Verlaufseintrag schreiben, fertig.
 *
 * **Warum eine Stelle und nicht vier.** Der Vorgang ist derselbe, und vier
 * Abschriften liefen auseinander, sobald eine davon etwas mehr tut — heute
 * dreimal beobachtet. Was sich je Gegenstand unterscheidet, ist genau zweierlei:
 * die Tabelle und die Frage, ob der Zustand es zulässt. Beides steht unten in
 * einer Tabelle, nicht in vier Funktionen.
 *
 * **Der Tabellenname wird nicht zusammengesetzt, sondern nachgeschlagen.** Er
 * kommt aus einer festen Zuordnung; eine Zeichenkette aus dem Formular käme nie
 * in die Nähe eines SQL-Bezeichners.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	ARCHIVARTEN,
	pruefeArchivieren,
	pruefeEigentuemerArchivierbar,
	pruefeHervorholen,
	type Archivart
} from '$lib/domain/archivieren';
import type { Versammlungszustand } from '$lib/domain/versammlung';
import type { Id } from '$lib/domain/types';

/** Wo der Gegenstand steht, woraus sein Name kommt und wie er im Verlauf heisst. */
const TABELLE: Record<
	Archivart,
	{ tabelle: string; namensspalte: string; gegenstandArt: string }
> = {
	gemeinschaft: { tabelle: 'stweg', namensspalte: 'name', gegenstandArt: 'stweg' },
	versammlung: { tabelle: 'meeting', namensspalte: 'location', gegenstandArt: 'meeting' },
	eigentuemer: { tabelle: 'party', namensspalte: 'display_name', gegenstandArt: 'party' },
	person: { tabelle: 'person', namensspalte: 'display_name', gegenstandArt: 'person' }
};

interface Zeile {
	name: string;
	archived_at: Date | null;
	state?: string;
}

/**
 * Wessen Archivierung eine Gemeinschaft mitnimmt — `null`, wenn keine.
 *
 * Nur für `art === 'gemeinschaft'`: Die Gruppe hängt am Baum über
 * `parent_stweg_id`, und nur dort gibt es ein «wegen».
 */
async function gruppenlage(
	tx: postgres.TransactionSql,
	id: Id
): Promise<{ id: string; name: string } | null> {
	const [z] = await tx<{ id: string; name: string }[]>`
		SELECT w.id, w.name FROM stweg w WHERE w.id = stweg_archiv_wegen(${id})
	`;
	return z && z.id !== id ? z : null;
}

/**
 * Liest Name und Archivstand.
 *
 * `unsafe` mit gebundenem Parameter: Der **Bezeichner** (Tabelle, Spalte) kommt
 * aus `TABELLE` und nie von aussen; die **Kennung** reist als `$1` und wird
 * nicht in die Zeichenkette geschrieben. Das ist der Unterschied, auf den es
 * ankommt — `unsafe` heisst «ungeprüfter Bezeichner», nicht «ungeprüfte Werte».
 */
async function leseLage(
	tx: postgres.TransactionSql,
	art: Archivart,
	id: Id
): Promise<Zeile | null> {
	const t = TABELLE[art];
	const zusatz = art === 'versammlung' ? ', state' : '';
	const [z] = await tx.unsafe<Zeile[]>(
		`SELECT ${t.namensspalte} AS name, archived_at${zusatz} FROM ${t.tabelle} WHERE id = $1`,
		[id]
	);
	return z ?? null;
}

/**
 * **Wer noch mitzaehlt, wird nicht archiviert** — geprueft am Schreibweg
 * (25.08.2026, aus beiden Reviews).
 *
 * Die Schranke stand vorher in der Eigentuemerroute, hinter einem `if (zeile)`:
 * Fand die Stimmkraftansicht der Gemeinschaft aus der Adresse die Partei nicht
 * — etwa, weil die Kennung zu einer **anderen** Gemeinschaft gehoerte —, wurde
 * die einzige Pruefung stillschweigend uebersprungen. «Ein Filter ohne Treffer
 * filtert nichts.» Und fuer die Person gab es sie ueberhaupt nicht, obwohl sie
 * das umfassendere Objekt ist: eine Person traegt Parteien in mehreren
 * Gemeinschaften.
 *
 * Hier kann sie kein Aufrufer uebergehen. Gefragt wird die Zuordnung selbst
 * (`unit_ownership`), nicht eine daraus gebaute Ansicht — und ohne Stichtag:
 * Eine Zuordnung, die erst naechsten Monat beginnt, zaehlt am Versammlungstag
 * mit, waehrend sie «heute» keine Einheit zeigt.
 *
 * **`valid_to` in der Zukunft ist keine beendete Zuordnung** (25.08.2026,
 * zweite Reviewrunde). Die erste Fassung fragte `valid_to IS NULL`. Wer einen
 * Verkauf per 01.01.2027 erfasst, hat danach ein Datum stehen — die Schranke
 * fand nichts, das Archivieren gelang, und fuer jede Versammlung bis dahin
 * stand die Alteigentuemerin mit voller Stimmkraft in der Momentaufnahme und
 * fehlte zugleich in der Liste. `stimmkraftAnsicht` rechnet genauso
 * (`valid_to > stichtag`); zwei Fassungen derselben Frage waeren eine zu viel.
 *
 * Gemeinschaft und Versammlung haben eigene Schranken im Kern
 * (`domain/archivieren.ts`); fuer sie ist hier nichts zu tun.
 */
async function pruefeStimmeZaehltNichtMehr(
	tx: postgres.TransactionSql,
	art: Archivart,
	id: Id,
	name: string
): Promise<void> {
	if (art !== 'eigentuemer' && art !== 'person') return;

	const zeilen =
		art === 'eigentuemer'
			? await tx<{ label: string }[]>`
					SELECT u.label
					FROM unit_ownership uo
					JOIN unit u ON u.id = uo.unit_id
					WHERE uo.party_id = ${id}
					  AND (uo.valid_to IS NULL OR uo.valid_to > current_date)
					ORDER BY u.label
				`
			: await tx<{ label: string }[]>`
					SELECT u.label
					FROM unit_ownership uo
					JOIN unit u ON u.id = uo.unit_id
					JOIN party p ON p.id = uo.party_id
					WHERE p.person_id = ${id}
					  AND (uo.valid_to IS NULL OR uo.valid_to > current_date)
					ORDER BY u.label
				`;
	// Die Meldung steht im Kern und wird hier nicht abgeschrieben — zwei
	// Fassungen desselben Satzes liefen sonst auseinander (AD-1).
	pruefeEigentuemerArchivierbar(
		name,
		zeilen.map((z) => z.label)
	);
}

/**
 * **Keine Gruppe ins Archiv, solange eine ihrer Versammlungen unterwegs ist**
 * (25.08.2026, zweite Reviewrunde).
 *
 * Für die einzelne Versammlung sagt der Kern das ab: Archiviert wird, was
 * versiegelt ist (Auftraggeber, 25.08.2026). Über die **Gemeinschaft** war die Regel
 * umgehbar.
 *
 * Wer die Klammer archivierte, nahm die laufende Versammlung ihres Hauses mit
 * aus der Startseite: Im Saal läuft sie weiter, in «Läuft jetzt» steht sie
 * nicht mehr.
 *
 * Der Entwurf ist hier ausdrücklich **nicht** dabei. Er ist ein Plan, keine
 * unfertige Arbeit; ein Haus mit drei Terminentwürfen liesse sich sonst nie
 * stilllegen, ohne sie vorher einzeln zu löschen. Entwürfe gehen mit ins Archiv
 * und kommen mit zurück — verloren geht nichts.
 *
 * Gefragt wird die **ganze Gruppe**, nicht nur die eigenen Versammlungen —
 * genau darum geht es ja.
 */
async function pruefeKeineVersammlungUnterwegs(
	tx: postgres.TransactionSql,
	stwegId: Id,
	name: string
): Promise<void> {
	const zeilen = await tx<
		{ stweg_name: string; location: string; state: string; hat_vollmachten: boolean }[]
	>`
		SELECT s.name AS stweg_name, m.location, m.state,
		       EXISTS (SELECT 1 FROM proxy p WHERE p.meeting_id = m.id) AS hat_vollmachten
		  FROM meeting m
		  JOIN stweg s ON s.id = m.stweg_id
		 WHERE m.archived_at IS NULL
		   AND m.state IN ('laufend', 'freigegeben', 'geschlossen')
		   -- Ringerkennung statt Tiefenkappung, wie in Migration 090. Die
		   -- Kappung bei zehn Stufen hätte hier dasselbe getan wie dort: bei
		   -- einem tieferen Baum die laufende Versammlung nicht gefunden und
		   -- die Gruppe klaglos archiviert.
		   AND ${stwegId} IN (
		       WITH RECURSIVE kette (id, parent_stweg_id) AS (
		           SELECT k.id, k.parent_stweg_id FROM stweg k WHERE k.id = m.stweg_id
		           UNION ALL
		           SELECT o.id, o.parent_stweg_id
		             FROM stweg o JOIN kette ON o.id = kette.parent_stweg_id
		       ) CYCLE id SET im_ring USING pfad
		       SELECT id FROM kette WHERE NOT im_ring
		   )
		 ORDER BY s.name, m.meeting_date
	`;
	if (zeilen.length === 0) return;

	const z = zeilen[0];
	const wo = z.stweg_name === name ? '' : ` von «${z.stweg_name}»`;
	const grund =
		z.state === 'laufend'
			? `Die Versammlung in ${z.location}${wo} läuft gerade. Schliessen Sie sie zuerst.`
			: z.state === 'freigegeben'
				? /* Mit einer Vollmacht ist die Freigabe endgültig (Nachzug Block 3,
				   * Entscheid E vom 03.10.2026); der Weg über die Rücknahme fiele
				   * dann in eine Absage. */
					z.hat_vollmachten
					? `Die Versammlung in ${z.location}${wo} ist freigegeben: Die Einladungen sind ` +
						'draussen. Die Freigabe lässt sich nicht mehr zurücknehmen, weil bereits eine ' +
						'Vollmacht daran hängt. Eröffnen Sie die Versammlung, stellen Sie die ' +
						'Beschlussunfähigkeit fest, schliessen Sie sie und versiegeln Sie sie. Danach ' +
						'lässt sich die Gruppe archivieren.'
					: `Die Versammlung in ${z.location}${wo} ist freigegeben: Die Einladungen sind ` +
						'draussen. Nehmen Sie die Freigabe zurück, oder eröffnen Sie die Versammlung, ' +
						'stellen Sie die Beschlussunfähigkeit fest, schliessen Sie sie und versiegeln ' +
						'Sie sie. Danach lässt sich die Gruppe archivieren.'
				: `Die Versammlung in ${z.location}${wo} ist geschlossen, aber nicht versiegelt. ` +
					'Das Siegel ist der Nachweis — versiegeln Sie sie zuerst, danach lässt sich die ' +
					'Gruppe archivieren.';
	throw new FachlicherFehler('versammlung_unterwegs', grund, 'archiv');
}

/**
 * Legt einen Gegenstand ins Archiv.
 *
 * Die Notiz ist freiwillig und steht später an der Zeile: «Mandat beendet per
 * 31.12.2026» beantwortet die Frage, die jemand hat, der die Gemeinschaft im
 * Archiv wiederfindet.
 */
export async function archiviere(
	handelnder: Handelnder & { operatorId: string },
	art: Archivart,
	id: Id,
	notiz?: string | null
): Promise<{ name: string }> {
	const t = TABELLE[art];
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const z = await leseLage(tx, art, id);
		if (!z) {
			throw new FachlicherFehler(
				'unbekannt',
				`${ARCHIVARTEN[art].einzahl} nicht gefunden.`,
				'id'
			);
		}
		/*
		 * **Ob eine Vollmacht hängt, entscheidet den Satz** (Nachzug Block 3,
		 * Entscheid E vom 03.10.2026). Mit der ersten Vollmacht ist die Freigabe
		 * endgültig; ein Hindernissatz, der weiter zur Rücknahme rät, schickte
		 * die Leitung in die Absage `vollmachten_haengen`. Gezählt wird wie in
		 * der Schranke: alle Zeilen, in jedem Zustand.
		 */
		const vollmachtenHaengen =
			art === 'versammlung'
				? Number(
						(
							await tx<{ anzahl: number }[]>`
								SELECT count(*)::int AS anzahl FROM proxy WHERE meeting_id = ${id}
							`
						)[0]?.anzahl ?? 0
					) > 0
				: false;
		pruefeArchivieren({
			art,
			name: z.name,
			archiviertAm: z.archived_at?.toISOString() ?? null,
			zustand: z.state as Versammlungszustand | undefined,
			vollmachtenHaengen
		});
		await pruefeStimmeZaehltNichtMehr(tx, art, id, z.name);

		/*
		 * **Ein Haus in einer archivierten Gruppe ist schon im Archiv**
		 * (Auftraggeber, 25.08.2026: «Gruppen müssen als gesamte Gruppe archiviert und
		 * wiederhergestellt werden»). Es noch einmal zu archivieren setzte ein
		 * eigenes `archived_at` — sichtbar würde davon nichts, und beim
		 * Hervorholen der Klammer bliebe genau dieses Haus zurück. Also absagen,
		 * statt eine Wirkung vorzutäuschen.
		 */
		if (art === 'gemeinschaft') {
			const wegen = await gruppenlage(tx, id);
			if (wegen) {
				throw new FachlicherFehler(
					'gruppe_im_archiv',
					`«${z.name}» liegt bereits im Archiv, weil «${wegen.name}» archiviert ist. ` +
						'Die Gruppe geht gemeinsam ins Archiv und kommt gemeinsam zurück.',
					'archiv'
				);
			}
			await pruefeKeineVersammlungUnterwegs(tx, id, z.name);
		}

		/*
		 * **Eine Versammlung unter einer archivierten Gemeinschaft liegt schon im
		 * Archiv** (Sicherheitsdurchgang 15.09.2026).
		 *
		 * Migration 087 leitet den Archivstand der Gruppe ab, statt ihn zu
		 * schreiben: Die Versammlung trägt weiterhin `archived_at IS NULL` und
		 * ist nur über `stweg_archiv_wegen` aus den Listen genommen. Ohne diese
		 * Prüfung setzte ein Archivieren ihr ein **eigenes** Datum — und nach dem
		 * Hervorholen der Gemeinschaft bliebe genau diese Versammlung unsichtbar.
		 *
		 * Wörtlich dieselbe Falle wie bei den Gemeinschaften, eine Ebene tiefer.
		 * Die Liste zeigte dafür bereits kein Kästchen mehr; das war Oberfläche,
		 * und Oberfläche hält keine Kennung auf, die jemand selbst mitschickt.
		 */
		if (art === 'versammlung') {
			const [w] = await tx<{ name: string }[]>`
				SELECT s.name
				  FROM meeting m
				  JOIN stweg s ON s.id = stweg_archiv_wegen(m.stweg_id)
				 WHERE m.id = ${id}
			`;
			if (w) {
				throw new FachlicherFehler(
					'gemeinschaft_im_archiv',
					`Die Versammlung in ${z.name} liegt bereits im Archiv, weil «${w.name}» ` +
						'archiviert ist. Sie kommt mit der Gemeinschaft zurück.',
					'archiv'
				);
			}
		}

		const gesetzt = notiz?.trim() || null;
		await tx.unsafe(
			`UPDATE ${t.tabelle} SET archived_at = now(), archived_note = $2 WHERE id = $1`,
			[id, gesetzt]
		);

		await schreibeVerlauf(tx, handelnder, [
			{
				art: EREIGNISARTEN.archiviert,
				gegenstandArt: t.gegenstandArt,
				gegenstandId: id,
				angaben: { was: art, name: z.name, notiz: gesetzt }
			}
		]);
		return { name: z.name };
	});
}

/** Holt ihn wieder hervor. Die Notiz fällt dabei weg — sie galt fürs Archiv. */
export async function holeAusArchiv(
	handelnder: Handelnder & { operatorId: string },
	art: Archivart,
	id: Id
): Promise<{ name: string }> {
	const t = TABELLE[art];
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const z = await leseLage(tx, art, id);
		if (!z) {
			throw new FachlicherFehler(
				'unbekannt',
				`${ARCHIVARTEN[art].einzahl} nicht gefunden.`,
				'id'
			);
		}
		/*
		 * **Aus einer archivierten Gruppe wird nicht einzeln hervorgeholt.** Das
		 * Haus trägt kein eigenes `archived_at`; das Leeren einer bereits leeren
		 * Spalte täte nichts, und die Zeile bliebe unsichtbar. Der Weg zurück
		 * steht an der Klammer, und die Meldung nennt sie beim Namen.
		 */
		if (art === 'gemeinschaft') {
			const wegen = await gruppenlage(tx, id);
			if (wegen) {
				throw new FachlicherFehler(
					'gruppe_im_archiv',
					`«${z.name}» liegt im Archiv, weil «${wegen.name}» archiviert ist. ` +
						`Holen Sie «${wegen.name}» hervor — die Gruppe kommt gemeinsam zurück.`,
					'archiv'
				);
			}
		}

		pruefeHervorholen({ art, name: z.name, archiviertAm: z.archived_at?.toISOString() ?? null });

		await tx.unsafe(
			`UPDATE ${t.tabelle} SET archived_at = NULL, archived_note = NULL WHERE id = $1`,
			[id]
		);

		await schreibeVerlauf(tx, handelnder, [
			{
				art: EREIGNISARTEN.hervorgeholt,
				gegenstandArt: t.gegenstandArt,
				gegenstandId: id,
				angaben: { was: art, name: z.name }
			}
		]);
		return { name: z.name };
	});
}

/**
 * Wie viele Gegenstände eine Sammelarchivierung höchstens annimmt.
 *
 * Die Zahl ist grosszügig gegenüber dem, was ein Mensch je auswählt — die
 * grösste Bewirtschaftung hier führt keine 200 Gemeinschaften — und eng genug,
 * dass eine zusammengebaute Anfrage nicht tausend Transaktionen auslöst. Wer
 * mehr braucht, macht es in zwei Durchgängen und sieht dabei, was er tut.
 */
export const SAMMELGRENZE = 200;

/**
 * Sieht diese Zeichenkette überhaupt wie eine Kennung aus?
 *
 * **Warum das hier steht und nicht nur im Routenprüfer** (aus dem Code-Review,
 * 15.09.2026). Der Einzelweg geht über `/gemeinschaften/[id=kennung]`, und der
 * Prüfer dort lässt eine Route mit krummer Kennung gar nicht erst zu. Der
 * Sammelweg nimmt die Kennungen aus **Formularfeldern** — daran kommt kein
 * Routenprüfer. Ohne diese Zeile antwortet PostgreSQL mit «invalid input syntax
 * for type uuid», die Anwendung mit einer rohen 500, und weil die Vorfahrenkette
 * vor der Schleife läuft, wird dabei **keine einzige** gültige Kennung
 * archiviert: Ein krummer Wert nimmt die ganze Auswahl mit.
 *
 * Dasselbe Muster wie in `traktanden.ts` («hält auch einen manipulierten
 * Nicht-UUID-Wert im fachlichen Fehlerpfad»), nur vorgelagert statt im SQL.
 */
const KENNUNGSFORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Was aus einem Sammelauftrag wurde, Stück für Stück. */
export interface Sammelergebnis {
	gelungen: { id: Id; name: string }[];
	/**
	 * Je Gegenstand der Grund, warum er nicht ging — im Wortlaut der Einzelabsage.
	 *
	 * **Der Name gehört dazu** (aus dem Code-Review, 15.09.2026). Ohne ihn stand
	 * in der Liste dreimal derselbe Satz: Häuser, die an derselben gescheiterten
	 * Klammer hängen, erben deren Wortlaut, und die Zeilen waren nicht mehr
	 * auseinanderzuhalten. «3 blieben stehen» und dreimal dieselbe Begründung ist
	 * keine Arbeitsliste, sondern ein Rätsel. `null`, wo sich kein Name mehr
	 * ermitteln lässt — dann steht wenigstens der Grund da.
	 */
	abgelehnt: { id: Id; name: string | null; grund: string }[];
	/**
	 * Gemeinschaften, die mit einer **ebenfalls gewählten** Klammer ins Archiv
	 * gegangen sind.
	 *
	 * **Warum die nicht unter «abgelehnt» stehen.** Wer eine MEG und ihre fünf
	 * Häuser zusammen auswählt, hat genau eine Absicht: alles wegräumen. Die
	 * Klammer nimmt die Häuser mit (Migration 087), und die Einzelabsage für
	 * jedes Haus lautete danach «liegt bereits im Archiv, weil …». Fünf rote
	 * Zeilen für einen gelungenen Vorgang — das liest sich wie ein Fehlschlag
	 * und ist einer Wiederholung wert, die nichts ändert.
	 */
	mitgegangen: { id: Id; wegen: string }[];
}

/**
 * Archiviert mehrere Gegenstände — einzeln, nicht alles oder nichts.
 *
 * **Der Auftrag** (Auftraggeber, 15.09.2026): «ein Bulk zum Massenarchivieren. Das bei
 * Versammlungen, Gemeinschaften und Personen.»
 *
 * **Warum Stück für Stück und nicht in einer Transaktion.** Die Regeln sind
 * gegenstandsbezogen: Diese Versammlung ist nicht versiegelt, jene Person hält
 * noch eine Stimme. Bei zwanzig Ausgewählten trifft das fast immer einen — und
 * alles-oder-nichts hiesse, dass ein einziger Grund neunzehn richtige Vorgänge
 * verhindert, ohne dass jemand daran etwas ändern könnte ausser durch
 * Abwählen. Also geht jeder für sich, und am Ende steht, was ging und was
 * nicht.
 *
 * Archivieren ist dafür der richtige Vorgang: Es nimmt nichts weg und lässt
 * sich einzeln zurücknehmen. Beim **Entfernen** wäre dieselbe Bauart falsch.
 *
 * **Die Reihenfolge ist die der Eingabe** — und das ist bei Gemeinschaften
 * wichtig: Steht ein Haus vor seiner Klammer, geht es zuerst einzeln ins Archiv
 * und trägt danach ein eigenes `archived_at`. Es käme beim Hervorholen der
 * Klammer nicht mit zurück. Deshalb sortiert `archiviereMehrere` die Klammern
 * nach vorn, siehe unten.
 */
export async function archiviereMehrere(
	handelnder: Handelnder & { operatorId: string },
	art: Archivart,
	ids: Id[],
	notiz?: string | null
): Promise<Sammelergebnis> {
	if (ids.length > SAMMELGRENZE) {
		throw new FachlicherFehler(
			'zu_viele',
			`Höchstens ${SAMMELGRENZE} auf einmal. Gewählt waren ${ids.length}.`,
			'auswahl'
		);
	}

	/*
	 * **Doppelte Kennungen fliegen raus**, bevor gezählt wird. Sonst stünde
	 * derselbe Name einmal unter «archiviert» und einmal unter «ging nicht»,
	 * und beides stimmte.
	 */
	const eindeutig = [...new Set(ids)];

	/*
	 * Krumme Kennungen fliegen vor der ersten Abfrage heraus und kommen als
	 * gewöhnliche Absage zurück — nicht als Serverfehler, der die ganze Auswahl
	 * mitnimmt.
	 */
	const brauchbar = eindeutig.filter((id) => KENNUNGSFORM.test(id));
	const krumm = eindeutig.filter((id) => !KENNUNGSFORM.test(id));

	/*
	 * **Die Zugehörigkeit, nicht nur die Tiefe** (aus dem Code-Review,
	 * 15.09.2026). Die erste Fassung sortierte bloss Klammern nach vorn. Das
	 * genügt, solange die Klammer durchgeht — und genau dort lag die Lücke:
	 * Scheitert sie (etwa weil in einem ihrer Häuser eine freigegebene
	 * Versammlung läuft und die Prüfung die ganze Gruppe betrachtet), gingen
	 * ihre Kinder danach **einzeln** ins Archiv und trugen ein eigenes
	 * `archived_at`. Wird die Klammer später archiviert und wieder
	 * hervorgeholt, bleiben genau diese Häuser zurück — wörtlich der Fehler,
	 * den die Sortierung verhindern sollte, nur eine Stufe später.
	 */
	const ketten =
		art === 'gemeinschaft'
			? await vorfahrenkette(handelnder.operatorId, brauchbar)
			: new Map<Id, Id[]>();

	// Flachste zuerst; `Array.sort` ist stabil, die Reihenfolge innerhalb einer
	// Tiefe bleibt also die der Liste.
	const reihenfolge = [...brauchbar].sort(
		(a, b) => (ketten.get(a)?.length ?? 0) - (ketten.get(b)?.length ?? 0)
	);

	const namen = await namenVon(handelnder.operatorId, art, brauchbar);
	const ergebnis: Sammelergebnis = { gelungen: [], abgelehnt: [], mitgegangen: [] };
	const gewaehlt = new Set(brauchbar);
	/** Klammern aus dieser Auswahl, die nicht durchkamen. */
	const gescheitert = new Map<Id, string>();

	for (const id of krumm) {
		ergebnis.abgelehnt.push({ id, name: null, grund: 'Das ist keine gültige Kennung.' });
	}

	for (const id of reihenfolge) {
		/*
		 * **Wessen Klammer scheiterte, bleibt stehen.** Sonst entstünde genau das
		 * eigene `archived_at`, das die Reihenfolge oben vermeiden soll. Gemeldet
		 * wird der Grund der Klammer, nicht ein eigener: Das Haus selbst hat
		 * keinen, und «liegt bereits im Archiv» stünde falsch da.
		 */
		const blockiert = (ketten.get(id) ?? []).find((v) => gescheitert.has(v));
		if (blockiert) {
			ergebnis.abgelehnt.push({
				id,
				name: namen.get(id) ?? null,
				grund: gescheitert.get(blockiert)!
			});
			continue;
		}

		try {
			const { name } = await archiviere(handelnder, art, id, notiz);
			ergebnis.gelungen.push({ id, name });
		} catch (fehler) {
			/*
			 * **Auch ein unerwarteter Fehler darf den Bericht nicht wegwerfen**
			 * (aus dem Code-Review, 15.09.2026). Ein `throw` mitten in der Schleife
			 * hätte eine rohe 500 ergeben — und die siebzehn Vorgänge, die vorher
			 * durchgingen, sind bereits geschrieben. Der Betreiber sähe einen
			 * Serverfehler und wüsste nicht, welche davon im Archiv liegen; er
			 * versuchte es erneut und bekäme siebzehnmal «liegt bereits im Archiv».
			 *
			 * Verschluckt wird er trotzdem nicht: Er geht ins Serverprotokoll, mit
			 * Kennung und Art.
			 *
			 * **Nur die Meldung, nicht das Fehlerobjekt** (Sicherheitsdurchgang
			 * 15.09.2026). Hier stand zuerst `console.error(…, fehler)` mit dem
			 * Zusatz, das verrate nichts über den Menschen dahinter — und das war
			 * falsch: Ein `PostgresError` übernimmt die Serverfelder, darunter
			 * `detail`, und das trägt bei einer verletzten Schranke die ganze
			 * Zeile («Failing row contains …»), also auch Namen und Notiz. Die
			 * Meldung allein sagt, wo es klemmt; eine Kennung führt zur Zeile,
			 * wenn jemand wirklich nachsehen muss.
			 */
			if (!(fehler instanceof FachlicherFehler)) {
				const meldung = fehler instanceof Error ? fehler.message : String(fehler);
				console.error(`[sammelarchiv] ${art} ${id} unerwartet gescheitert: ${meldung}`);
				const grund =
					'Unerwarteter Fehler. Die Einzelheiten stehen im Serverprotokoll; ' +
					'die übrigen Gegenstände wurden trotzdem bearbeitet.';
				ergebnis.abgelehnt.push({ id, name: namen.get(id) ?? null, grund });
				gescheitert.set(id, grund);
				continue;
			}
			/*
			 * Der eine Fall, der kein Fehlschlag ist: Das Haus liegt im Archiv,
			 * weil eine Klammer aus **derselben Auswahl** es mitgenommen hat.
			 * Lag es wegen einer Klammer dort, die gar nicht gewählt war, ist es
			 * eine echte Absage und bleibt eine.
			 */
			if (art === 'gemeinschaft' && fehler.kennung === 'gruppe_im_archiv') {
				const wegen = await klammerVon(handelnder.operatorId, id);
				if (wegen && gewaehlt.has(wegen.id)) {
					ergebnis.mitgegangen.push({ id, wegen: wegen.name });
					continue;
				}
			}
			ergebnis.abgelehnt.push({ id, name: namen.get(id) ?? null, grund: fehler.message });
			gescheitert.set(id, fehler.message);
		}
	}
	return ergebnis;
}

/**
 * Die Vorfahren jeder gewählten Gemeinschaft, innerhalb der Auswahl.
 *
 * Liefert je Kennung die Kette nach oben — daraus ergibt sich beides, was
 * `archiviereMehrere` braucht: die **Tiefe** für die Reihenfolge und die
 * **Zugehörigkeit** für den Fall, dass eine Klammer scheitert.
 *
 * `CYCLE` statt einer Tiefenkappung, wie in Migration 090 und in
 * `pruefeKeineVersammlungUnterwegs`: Eine Kappung bei zehn Stufen fände bei
 * einem tieferen Baum die Klammer nicht und archivierte klaglos daneben.
 */
async function vorfahrenkette(
	operatorId: string,
	ids: Id[]
): Promise<Map<Id, Id[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ start: string; vorfahr: string }[]>`
			WITH RECURSIVE kette (start, id, parent_stweg_id) AS (
				SELECT s.id, s.id, s.parent_stweg_id FROM stweg s WHERE s.id = ANY(${ids})
				UNION ALL
				SELECT k.start, o.id, o.parent_stweg_id
				  FROM stweg o JOIN kette k ON o.id = k.parent_stweg_id
			) CYCLE id SET im_ring USING pfad
			SELECT start, id AS vorfahr FROM kette WHERE NOT im_ring AND id <> start
		`;
		const karte = new Map<Id, Id[]>();
		for (const id of ids) karte.set(id, []);
		for (const z of zeilen) karte.get(z.start)?.push(z.vorfahr);
		return karte;
	});
}

/**
 * Die Namen der gewählten Gegenstände, für die Rückmeldung.
 *
 * Eine Abfrage statt einer je Absage. Der Bezeichner kommt aus `TABELLE` und nie
 * von aussen, die Kennungen reisen als `$1` — dieselbe Bauart wie `leseLage`.
 */
async function namenVon(
	operatorId: string,
	art: Archivart,
	ids: Id[]
): Promise<Map<Id, string>> {
	if (ids.length === 0) return new Map();
	const t = TABELLE[art];
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx.unsafe<{ id: string; name: string }[]>(
			`SELECT id::text AS id, ${t.namensspalte} AS name FROM ${t.tabelle} WHERE id = ANY($1)`,
			[ids]
		);
		return new Map(zeilen.map((z) => [z.id, z.name]));
	});
}

/** Wessen Archivierung diese Gemeinschaft mitgenommen hat — `null`, wenn keine. */
async function klammerVon(
	operatorId: string,
	id: Id
): Promise<{ id: string; name: string } | null> {
	return alsBetreiber(operatorId, async (tx) => gruppenlage(tx, id));
}
