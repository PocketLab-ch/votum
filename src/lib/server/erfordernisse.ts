/**
 * Ein Mehrheitserfordernis an ein Traktandum schreiben — innerhalb einer
 * laufenden Transaktion.
 *
 * **Warum als eigene Datei.** Drei Stellen brauchen dasselbe: die
 * Pflichttraktanden beim Anlegen einer Versammlung, die Musterübernahme am Abend
 * und das Erfassen eines Traktandums mit gewähltem Quorum. Lägen die Helfer bei
 * einer davon, müssten die anderen sie importieren — und `vorlagen.ts` und
 * `geschaeft.ts` importieren einander bereits über Kreuz.
 *
 * **Das Erfordernis wird je Gemeinschaft hergeleitet, nie je Abend.** Eine
 * Reglementsabweichung gilt für ein Haus (`bylaw_quorum_rule.stweg_id`);
 * dasselbe Vorhaben kann dort ein anderes Mehr verlangen als nebenan. Deshalb
 * nehmen beide Funktionen die Gemeinschaft und nicht die gemeinsame Versammlung.
 */
import type postgres from 'postgres';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Enthaltungseinstellung } from '$lib/domain/reglement';
import type { holeReglementsregeln } from './reglement';
import type { Id } from '$lib/domain/types';
import type { Handelnder } from './audit';
import { achteEinladungsmehr } from './einladungsmehr';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { istImEntwurf } from '$lib/domain/versammlung';
import type { Traktandum } from '$lib/domain/traktanden';
import {
	VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG,
	VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN,
	VERWALTUNG_HAKEN_ABSAGE_WAHL
} from '$lib/domain/mehrhinweise';

export type Reglementsregeln = Awaited<ReturnType<typeof holeReglementsregeln>>;

/**
 * L8 (Migration 184): Die Knoten, an denen das Häkchen am Traktandum nicht
 * wirkt. Bei Wahl und Wiederwahl ruhen die Vollmachten nach dem Bundesgericht
 * nicht (BGE 134 III 481 E. 3.5 und 3.8), bei der Abberufung ist es nicht
 * geklärt; das Häkchen gehört zur Entschädigung, dem Vertrag und der
 * Entlastung, die sich trennen lassen. Die Kennungen sind Daten des Regelwerks
 * und stehen deshalb im Server und nicht im Kern.
 */
export const VERWALTUNGSKNOTEN: ReadonlySet<string> = new Set([
	'k-bewirtschaftung-waehlen',
	'k-bewirtschaftung-waehlen-erweitert',
	'k-bewirtschaftung-abberufen'
]);

/**
 * L8 (Migration 184): Die beiden Knoten der Wahl und der Wiederwahl der
 * Verwaltung. Entscheid 8 (07.11.2026): Zeigt sich nach der Freigabe, dass
 * ein Traktandum mit Häkchen eine Wahl oder Wiederwahl der Verwaltung ist,
 * lässt Votum dieses Erfordernis zu; an diesen Knoten wirkt das Häkchen
 * dann nicht, und der Ausstand aus L8 entfällt. Die Abberufung lässt Votum
 * nach der Freigabe nur an einem Folgeantrag zu (Entscheid 0045, Punkt 9;
 * `ABBERUFUNGSKNOTEN`).
 */
export const VERWALTUNGSWAHLKNOTEN: ReadonlySet<string> = new Set([
	'k-bewirtschaftung-waehlen',
	'k-bewirtschaftung-waehlen-erweitert'
]);

/**
 * L8, Entscheid 0045, Punkt 9 (07.11.2026): Der Knoten der Abberufung. Nach
 * der Freigabe nimmt Votum ihn unter einem Traktandum mit Häkchen an einem
 * Folgeantrag an, nicht am Grundantrag. Das geerbte Häkchen wirkt dort nicht
 * von selbst; ob die Vollmachten ruhen, entscheidet die Leitung über den
 * erklärten Ausstand (Entscheid 0044, Anhang 3).
 */
export const ABBERUFUNGSKNOTEN = 'k-bewirtschaftung-abberufen';

/**
 * Die Absage am Häkchen am Traktandum, je Lage (G1, 06.11.2026): Im Entwurf
 * nennt sie je Knoten den Satz zur Wahl und Wiederwahl oder den zur
 * Abberufung. Nach der Freigabe ist das Häkchen gesperrt (Entscheid 7) und
 * die Einladung richtet sich nach der Kennzeichnung; dann steht derselbe
 * Satz, gleich welcher Knoten gewählt würde. **Entscheid 8 (07.11.2026):**
 * Wahl und Wiederwahl nimmt Votum nach der Freigabe an, die Absage entfällt
 * dort; `null` heisst deshalb zulässig, und der Aufrufer prüft es.
 * **Entscheid 0045, Punkt 9 (07.11.2026):** Die Abberufung nimmt Votum nach
 * der Freigabe an einem Folgeantrag an; am Grundantrag bleibt die Absage,
 * und ihr Satz nennt den Folgeantrag als Weg. Im Entwurf gibt es keine
 * Folgeanträge.
 */
export function verwaltungsabsageAmWahlknoten(
	knotenId: string,
	entwurf: boolean,
	folgeantrag = false
): string | null {
	if (!entwurf) {
		return knotenId === ABBERUFUNGSKNOTEN && !folgeantrag ? VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN : null;
	}
	return knotenId === ABBERUFUNGSKNOTEN
		? VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG
		: VERWALTUNG_HAKEN_ABSAGE_WAHL;
}

/**
 * L8 (Migration 184): Das Häkchen am Traktandum und eines dieser Knoten
 * vertragen sich nicht, in beiden Richtungen. Diese Fassung prüft das Häkchen
 * aus der Eingabe, bevor es gespeichert ist, und kennt nur den Entwurf
 * (`bearbeiteTraktandum`, G2: gegen das Erfordernis, das nach dem Speichern
 * gilt).
 */
export function verlangeKeinVerwaltungsgeschaeftAmWahlknoten(
	t: Pick<Traktandum, 'verwaltungsGeschaeft'>,
	knotenId: string | null
): void {
	if (t.verwaltungsGeschaeft && knotenId && VERWALTUNGSKNOTEN.has(knotenId)) {
		// Im Entwurf gibt es an jedem dieser Knoten einen Satz; das `null` der
		// Freigabe (Entscheid 8) erreicht diesen Weg nicht, er prüft die
		// Eingabe vor dem Speichern.
		throw new FachlicherFehler(
			'verwaltungsgeschaeft_am_wahlknoten',
			verwaltungsabsageAmWahlknoten(knotenId, true)!,
			'verwaltungsGeschaeft'
		);
	}
}

/**
 * L8 (Migration 184): Dieselbe Prüfung, das Häkchen und der Zustand der
 * Versammlung aus der Datenbank. Sie sitzt an der gemeinsamen Schreibstelle
 * des Erfordernisses (M6, 06.11.2026), sodass jeder Weg, der ein Erfordernis
 * schreibt, sie durchläuft — auch das gemeinsame Geschäft am Abend
 * (`geschaeft.ts`), das nicht über `haltErfordernisAmTraktandumFest` geht.
 */
export async function verlangeKeinVerwaltungsgeschaeftAmWahlknotenIn(
	tx: postgres.TransactionSql,
	traktandumId: Id,
	knotenId: string | null
): Promise<void> {
	if (!knotenId || !VERWALTUNGSKNOTEN.has(knotenId)) return;
	const [z] = await tx<{ concerns_management: boolean; zustand: string; spontaneous_kind: string | null }[]>`
		SELECT a.concerns_management, m.state AS zustand, a.spontaneous_kind
		FROM agenda_item a
		JOIN meeting m ON m.id = a.meeting_id
		WHERE a.id = ${traktandumId}
	`;
	if (!z?.concerns_management) return;
	// Entscheid 8 (07.11.2026): Nach der Freigabe lässt Votum Wahl und
	// Wiederwahl unter einem Traktandum mit Häkchen zu; die Absage entfällt
	// dort, und `null` heisst zulässig. Entscheid 0045, Punkt 9: am Folgeantrag
	// auch die Abberufung.
	const absage = verwaltungsabsageAmWahlknoten(
		knotenId,
		istImEntwurf({ zustand: z.zustand as never }),
		z.spontaneous_kind === 'folgeantrag'
	);
	if (absage === null) return;
	throw new FachlicherFehler(
		'verwaltungsgeschaeft_am_wahlknoten',
		absage,
		'verwaltungsGeschaeft'
	);
}

/** Die Reglementsregeln einer Gemeinschaft innerhalb einer laufenden Transaktion. */
export async function holeReglementsregelnIn(
	tx: postgres.TransactionSql,
	stwegId: Id
): Promise<Reglementsregeln> {
	const zeilen = await tx<
		{
			id: string;
			stweg_id: string;
			business_kind: string;
			head_numerator: number;
			head_denominator: number;
			head_mode: string;
			head_base: string;
			quota_numerator: number | null;
			quota_denominator: number | null;
			quota_mode: string | null;
			quota_base: string;
			source_reference: string;
			abstention_counts: boolean;
			note: string | null;
			node_id: string | null;
		}[]
	>`SELECT * FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId}`;

	return zeilen.map((z) => ({
		id: z.id,
		stwegId: z.stweg_id,
		geschaeftsart: z.business_kind as never,
		/*
		 * **Der zweite Leser** (Nachprüfung 23.08.2026). Die Regeln werden an zwei
		 * Stellen aus der Datenbank geholt: hier und in `reglement.ts`. Als die
		 * Fallbeschränkung dazukam (Migration 076), habe ich nur die eine
		 * angepasst — und diese hier liefert die Regeln an die
		 * Traktandenvorlagen.
		 *
		 * Die Folge war genau der Befund, gegen den die Beschränkung gebaut wurde:
		 * Ein Traktandum aus der Vorlage bekam die Regel ohne ihren Fall und damit
		 * für alles; dasselbe Geschäft von Hand angelegt bekam sie richtig. Zwei
		 * Traktanden desselben Falls standen mit verschiedenen Erfordernissen in
		 * derselben Liste.
		 *
		 * Wer ein Feld hinzufügt, muss jede Lesestelle suchen — nicht die, an die
		 * er gerade denkt.
		 */
		knotenId: z.node_id,
		kopfSchwelle: {
			zaehler: z.head_numerator,
			nenner: z.head_denominator,
			art: z.head_mode as never
		},
		kopfbasis: z.head_base as never,
		quotenSchwelle:
			z.quota_numerator !== null && z.quota_denominator !== null
				? {
						zaehler: z.quota_numerator,
						nenner: z.quota_denominator,
						art: z.quota_mode as never
					}
				: null,
		quotenbasis: z.quota_base as never,
		fundstelle: z.source_reference,
		enthaltungZaehltMit: z.abstention_counts,
		hinweis: z.note ?? undefined
	}));
}

/**
 * Die Einstellung der Gemeinschaft zu den Enthaltungen beim einfachen Mehr
 * (Migration 151), als dritter Wert für `wendeReglementAn`.
 *
 * **Neben den Regeln geladen, nicht in ihnen.** Jede Stelle, die das
 * Erfordernis herleitet, lädt beides; `wendeReglementAn` verlangt die
 * Einstellung als Pflichtwert, damit eine neue Stelle sie nicht still
 * vergisst.
 */
export async function holeEnthaltungseinstellungIn(
	tx: postgres.TransactionSql,
	stwegId: Id
): Promise<Enthaltungseinstellung | null> {
	const [z] = await tx<{ abstention_excluded: boolean; abstention_excluded_source: string | null }[]>`
		SELECT abstention_excluded, abstention_excluded_source FROM stweg WHERE id = ${stwegId}
	`;
	return z?.abstention_excluded && z.abstention_excluded_source
		? { fundstelle: z.abstention_excluded_source }
		: null;
}

/**
 * Schreibt das fertige Erfordernis Spalte für Spalte ans Traktandum.
 *
 * Samt Fassungskennung und Pfad durch den Entscheidbaum: Ohne sie liesse sich
 * später nicht mehr belegen, **warum** dieses Mehr galt — und genau das ist im
 * Streitfall die Frage (AD-4).
 *
 * **`requirement_abstention_counts` trägt `null`, wo nichts entschieden ist**
 * (04.09.2026). `null` heisst «Enthaltungen zählen mit»: So wurde vorher
 * gerechnet, und so wird ein damals festgeschriebenes Erfordernis auch später
 * nachgerechnet. Ein bereits gefasster Beschluss darf durch eine Erweiterung
 * nicht die Seite wechseln.
 */
export async function schreibeErfordernisIn(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	traktandumId: Id,
	e: Erfordernis
): Promise<void> {
	// Das Mehr der Einladung ist die Untergrenze (Migration 144). Vor jedem
	// Schreiben, weil drei der Wege hierher auch nach der Freigabe greifen.
	await achteEinladungsmehr(tx, handelnder, traktandumId, e);
	// L8 (Migration 184): Das Häkchen am Traktandum verträgt sich mit keinem
	// der Wahlknoten (M6, 06.11.2026). Hier an der gemeinsamen Schreibstelle,
	// damit jeder Weg sie durchläuft; die Absage nennt je Zustand der
	// Versammlung den Satz (G1).
	await verlangeKeinVerwaltungsgeschaeftAmWahlknotenIn(tx, traktandumId, e.knotenId);

	await tx`
		UPDATE agenda_item SET
			requirement_version = ${e.fassung},
			requirement_branch = ${e.astId},
			requirement_node = ${e.knotenId},
			requirement_type = ${e.typ},
			requirement_title = ${e.titel},
			requirement_legal_basis = ${e.rechtsgrundlage},
			requirement_head_base = ${e.kopfbasis},
			requirement_quota_base = ${e.quotenbasis},
			requirement_head_numerator = ${e.kopfSchwelle?.zaehler ?? null},
			requirement_head_denominator = ${e.kopfSchwelle?.nenner ?? null},
			requirement_head_mode = ${e.kopfSchwelle?.art ?? null},
			requirement_quota_numerator = ${e.quotenSchwelle?.zaehler ?? null},
			requirement_quota_denominator = ${e.quotenSchwelle?.nenner ?? null},
			requirement_quota_mode = ${e.quotenSchwelle?.art ?? null},
			requirement_business_kind = ${e.geschaeftsart ?? null},
			requirement_needs_affected_consent = ${e.zustimmungBetroffenerNoetig},
			requirement_affected_consent_form = ${e.betroffenenzustimmung ?? null},
			requirement_source = ${e.quelle},
			requirement_reason = ${e.begruendung ?? null},
			requirement_risk = ${e.risiko ?? null},
			requirement_reference = ${e.fundstelle ?? null},
			requirement_abstention_counts = ${e.enthaltungZaehltMit ?? null},
			requirement_reading = ${e.gemeinschaftslesart ? tx.json(e.gemeinschaftslesart as never) : null},
			requirement_statutory = ${e.gesetzlich ? tx.json(e.gesetzlich as never) : null},
			-- Nur das Rückkommen setzt sie; jedes andere Schreiben löscht sie (Migration 181).
			requirement_reading_reconsidered = ${e.lesartDesBeschlusses ? tx.json(e.lesartDesBeschlusses as never) : null},
			requirement_path = ${tx.json(e.pfad as never)}
		WHERE id = ${traktandumId}
	`;
}
