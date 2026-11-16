/**
 * Datenzugriff auf die Reglementsabweichungen (Story 2.4).
 *
 * Die Schale: holt, was der Kern zum Entscheiden braucht, ruft ihn auf und
 * schreibt sein Ergebnis samt Ereignissen in einer Transaktion (AD-1).
 */
import postgres from 'postgres';
import { FASSUNGEN, holeRegelwerk, knotenDerFassung } from '$lib/rules';
import { alsBetreiber } from './db';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import {
	aendereReglementsregel,
	bestaetigeReglementspruefung,
	hebeReglementsregelAuf,
	legeReglementsregelAn,
	setzeReglementspruefungZurueck,
	type Enthaltungseinstellung,
	type Reglementsregel,
	type ReglementsregelEingabe,
	type Reglementspruefstand,
	wendeReglementAn
} from '$lib/domain/reglement';
import {
	angehoerigeNachzuziehen,
	angehoerigenlesartWirkt,
	waehleErfordernis,
	type Erfordernisquelle
} from '$lib/domain/entscheidbaum';
import { knotenVon } from '$lib/domain/regelwerk';
import {
	holeEnthaltungseinstellungIn,
	holeReglementsregelnIn,
	schreibeErfordernisIn
} from './erfordernisse';
import type { Geschaeftsart, Kopfbasis, Quotenbasis } from '$lib/domain/regelwerk';
import type { Schwellenart } from '$lib/domain/mehrheit';
import {
	hebeWeisungsregelAuf,
	legeWeisungsregelAn,
	type OhneBeschluss,
	type Weisungsregel,
	type WeisungsregelEingabe
} from '$lib/domain/weisungsregel';
import {
	pruefeErschwerung,
	type Beschlussfaehigkeitsregel,
	type Versammlungsstufe
} from '$lib/domain/beschlussfaehigkeit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { pruefeEinberufungsfrist, type Einberufungsfrist } from '$lib/domain/einberufungsfrist';
import { pruefeFondsgrenze, type Fondsgrenze, type Fondsgrenzenart } from '$lib/domain/fondsgrenze';
import {
	pruefeZweitversammlungsfrist,
	type Zweitversammlungsfrist
} from '$lib/domain/versammlung';
import { pruefeAenderungsschranke, type Aenderungsschranke } from '$lib/domain/reglement';
import { FachlicherFehler } from '$lib/domain/fehler';
import { pruefeReglementsregelGehoert } from './zugehoerigkeit';
import type { Id } from '$lib/domain/types';
import {
	kopfzaehlweiseDesMehrs,
	kopfzaehlweiseWirkt,
	wahlInWorten,
	wahlOhneGespeicherte,
	zaehlweisemerkmaleAus,
	zaehlweiseVeraltet,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { holeLesartenIn } from './lesarten';

type Tx = postgres.TransactionSql;

interface DbZeile {
	id: string;
	stweg_id: string;
	business_kind: Geschaeftsart;
	node_id: string | null;
	head_numerator: number;
	head_denominator: number;
	head_mode: Schwellenart;
	head_base: Kopfbasis;
	quota_numerator: number | null;
	quota_denominator: number | null;
	quota_mode: Schwellenart | null;
	quota_base: Quotenbasis;
	source_reference: string;
	abstention_counts: boolean;
	note: string | null;
}

function ausDb(z: DbZeile): Reglementsregel {
	return {
		id: z.id,
		stwegId: z.stweg_id,
		geschaeftsart: z.business_kind,
		knotenId: z.node_id,
		kopfSchwelle: { zaehler: z.head_numerator, nenner: z.head_denominator, art: z.head_mode },
		kopfbasis: z.head_base,
		quotenSchwelle:
			z.quota_numerator !== null && z.quota_denominator !== null && z.quota_mode !== null
				? { zaehler: z.quota_numerator, nenner: z.quota_denominator, art: z.quota_mode }
				: null,
		quotenbasis: z.quota_base,
		fundstelle: z.source_reference,
		enthaltungZaehltMit: z.abstention_counts,
		hinweis: z.note ?? undefined
	};
}

/**
 * Dieselbe Abfrage innerhalb einer bestehenden Transaktion.
 *
 * Nötig, wo schon eine läuft: Ein zweites `alsBetreiber` daneben öffnete eine
 * eigene Verbindung mit eigenem `SET LOCAL` — das ginge zwar, liefe aber neben
 * der Transaktion her und läse einen Stand, der zu ihr nicht gehört.
 */
export async function leseReglementsregeln(tx: Tx, stwegId: Id): Promise<Reglementsregel[]> {
	const zeilen = await tx<DbZeile[]>`
		SELECT * FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId} ORDER BY business_kind
	`;
	return zeilen.map(ausDb);
}

/** Die Einstellung zu den Enthaltungen beim einfachen Mehr, ausserhalb einer Transaktion. */
export async function holeEnthaltungseinstellung(
	operatorId: Id,
	stwegId: Id
): Promise<Enthaltungseinstellung | null> {
	return alsBetreiber(operatorId, (tx) => holeEnthaltungseinstellungIn(tx, stwegId));
}

export async function holeReglementsregeln(operatorId: Id, stwegId: Id): Promise<Reglementsregel[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<DbZeile[]>`
			SELECT * FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId} ORDER BY business_kind
		`;
		return zeilen.map(ausDb);
	});
}

export async function holePruefstand(operatorId: Id, stwegId: Id): Promise<Reglementspruefstand> {
	return alsBetreiber(operatorId, async (tx) => {
		const [zeile] = await tx<
			{ bylaw_reviewed_on: Date | null; bylaw_reviewed_by: string | null; bylaw_note: string | null }[]
		>`SELECT bylaw_reviewed_on, bylaw_reviewed_by, bylaw_note FROM stweg WHERE id = ${stwegId}`;
		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId}
		`;
		return {
			geprueftAm: zeile?.bylaw_reviewed_on
				? new Date(zeile.bylaw_reviewed_on).toISOString().slice(0, 10)
				: null,
			geprueftDurch: zeile?.bylaw_reviewed_by ?? null,
			anzahlRegeln: anzahl,
			freitext: zeile?.bylaw_note ?? null
		};
	});
}

export async function erstelleReglementsregel(
	handelnder: Handelnder,
	eingabe: ReglementsregelEingabe
): Promise<Reglementsregel> {
	const operatorId = handelnder.operatorId as string;
	return alsBetreiber(operatorId, async (tx) => {
		const [{ id }] = await tx<{ id: string }[]>`SELECT gen_random_uuid() AS id`;
		const regel = await schreibeUebergang(tx, handelnder, legeReglementsregelAn(id, eingabe, holeRegelwerk()));

		const zeilen = await tx<{ id: string }[]>`
			INSERT INTO bylaw_quorum_rule (
				id, operator_id, stweg_id, business_kind, node_id,
				head_numerator, head_denominator, head_mode, head_base,
				quota_numerator, quota_denominator, quota_mode, quota_base,
				source_reference, abstention_counts, note
			) VALUES (
				${regel.id}, ${operatorId}, ${regel.stwegId}, ${regel.geschaeftsart},
				${regel.knotenId ?? null},
				${regel.kopfSchwelle.zaehler}, ${regel.kopfSchwelle.nenner}, ${regel.kopfSchwelle.art}, ${regel.kopfbasis},
				${regel.quotenSchwelle?.zaehler ?? null}, ${regel.quotenSchwelle?.nenner ?? null},
				${regel.quotenSchwelle?.art ?? null}, ${regel.quotenbasis},
				${regel.fundstelle}, ${regel.enthaltungZaehltMit}, ${regel.hinweis ?? null}
			)
			-- Je Geschäftsart UND Fall genau eine Regel: Eine zweite ersetzt die
			-- erste, statt daneben zu stehen. Zwei widersprüchliche wären schlimmer
			-- als keine. Seit 22.08.2026 mit dem Fall im Schlüssel — eine allgemeine
			-- Regel für die Art und eine schärfere für einen einzelnen Fall stehen
			-- nebeneinander, ohne sich zu verdrängen (Migrationen 076/077).
			ON CONFLICT (stweg_id, business_kind, coalesce(node_id, '')) DO UPDATE SET
				head_numerator = EXCLUDED.head_numerator,
				head_denominator = EXCLUDED.head_denominator,
				head_mode = EXCLUDED.head_mode,
				head_base = EXCLUDED.head_base,
				quota_numerator = EXCLUDED.quota_numerator,
				quota_denominator = EXCLUDED.quota_denominator,
				quota_mode = EXCLUDED.quota_mode,
				quota_base = EXCLUDED.quota_base,
				source_reference = EXCLUDED.source_reference,
				abstention_counts = EXCLUDED.abstention_counts,
				note = EXCLUDED.note
			RETURNING id
		`;
		/*
		 * **Die Kennung aus der Datenbank, nicht die eben gewuerfelte**
		 * (03.09.2026, gefunden vom Kerntest des Aenderungswegs).
		 *
		 * Traf das `ON CONFLICT` zu, blieb die bestehende Zeile mit ihrer alten
		 * Kennung stehen — zurueckgegeben wurde aber die neue, die nie in der
		 * Tabelle stand. Bis hierhin folgenlos, weil die Seite den Rueckgabewert
		 * wegwirft; der erste Aufrufer, der damit weiterarbeitet, sucht eine Regel,
		 * die es nicht gibt. `RETURNING` liefert bei `DO UPDATE` die Kennung der
		 * getroffenen Zeile.
		 */
		return { ...regel, id: zeilen[0].id };
	});
}

/**
 * Die Absage, wenn Geschaeftsart und Fall schon eine andere Regel tragen.
 *
 * Zweimal gebraucht und deshalb einmal geschrieben: Die Abfrage vor dem
 * Schreiben findet den Regelfall, der eindeutige Schluessel den Wettlauf. Zwei
 * Wortlaute fuer dieselbe Lage waeren fuer den Benutzer zwei verschiedene
 * Fehler.
 */
function schluesselBelegt(): FachlicherFehler {
	return new FachlicherFehler(
		'reglementsregel_schluessel_belegt',
		'Für diese Geschäftsart und diesen Fall ist schon eine andere Abweichung ' +
			'hinterlegt. Ändern Sie jene, oder heben Sie sie zuerst auf.',
		'geschaeftsart'
	);
}

/**
 * Eine hinterlegte Abweichung aendern (03.09.2026).
 *
 * **Die Zugehoerigkeit prueft die Funktion selbst.** Nicht der Aufrufer: Sie
 * ist der einzige Schreibweg auf eine bestehende Regel ueber ihre Kennung, und
 * eine Pruefung, die man an der Aufrufstelle vergessen kann, wird sie irgendwann
 * vergessen (dieselbe Lehre wie beim Aufheben am 26.08.2026, wo eine fremde
 * Regel gefunden und geloescht wurde). Sie laeuft **vor** `alsBetreiber`, damit
 * nicht eine zweite Verbindung neben der Transaktion herlaeuft.
 *
 * **Die Gemeinschaft kommt aus der Zeile, nicht aus der Eingabe.** Sonst waere
 * das Aendern ein Weg, eine Regel in eine fremde Gemeinschaft zu schieben.
 *
 * @returns `geaendert: false`, wenn das Formular unveraendert abgeschickt wurde
 * — dann steht auch kein Ereignis im Verlauf.
 */
export async function aendereReglementsregelAn(
	handelnder: Handelnder,
	stwegId: Id,
	regelId: Id,
	eingabe: Omit<ReglementsregelEingabe, 'stwegId'>
): Promise<{ regel: Reglementsregel; geaendert: boolean }> {
	const operatorId = handelnder.operatorId as string;
	await pruefeReglementsregelGehoert(operatorId, stwegId, regelId);

	return alsBetreiber(operatorId, async (tx) => {
		const [zeile] = await tx<DbZeile[]>`SELECT * FROM bylaw_quorum_rule WHERE id = ${regelId}`;
		if (!zeile) {
			throw new FachlicherFehler(
				'reglementsregel_fehlt',
				'Diese Abweichung gibt es nicht mehr. Vermutlich hat sie jemand anderes aufgehoben.'
			);
		}
		const bisher = ausDb(zeile);

		/*
		 * **Der Zielschluessel darf nicht schon belegt sein.**
		 *
		 * Je Gemeinschaft, Geschaeftsart und Fall gibt es genau eine Regel. Wer
		 * beim Aendern die Art oder den Fall umstellt, schiebt die Regel auf einen
		 * anderen Schluessel — und traf der eine bestehende Regel, verdraengte das
		 * `ON CONFLICT ... DO UPDATE` des Anlegewegs sie stillschweigend, waehrend
		 * die eigene Zeile daneben stehen blieb. Ein Verdraengen, das niemand
		 * sieht, ist schlimmer als eine Absage, die den Weg nennt.
		 */
		const [belegt] = await tx<{ id: string }[]>`
			SELECT id FROM bylaw_quorum_rule
			 WHERE stweg_id = ${bisher.stwegId}
			   AND business_kind = ${eingabe.geschaeftsart}
			   AND coalesce(node_id, '') = coalesce(${eingabe.knotenId ?? null}, '')
			   AND id <> ${regelId}
		`;
		if (belegt) throw schluesselBelegt();

		const uebergang = aendereReglementsregel(
			bisher,
			{ ...eingabe, stwegId: bisher.stwegId },
			holeRegelwerk()
		);
		const regel = await schreibeUebergang(tx, handelnder, uebergang);

		/*
		 * **Und derselbe Fall noch einmal, von der Datenbank her** (03.09.2026, aus
		 * dem Code-Review). Die Abfrage oben und dieses `UPDATE` liegen in einer
		 * Transaktion, aber ein zweiter Schreiber kann dazwischen committen. Dann
		 * greift der eindeutige Schluessel aus Migration 076, und ohne diese
		 * Uebersetzung kaeme statt der Absage eine leere Fehlerseite: Der Bestand
		 * bliebe richtig, die Antwort nicht.
		 */
		try {
			await tx`
			UPDATE bylaw_quorum_rule SET
				business_kind = ${regel.geschaeftsart},
				node_id = ${regel.knotenId ?? null},
				head_numerator = ${regel.kopfSchwelle.zaehler},
				head_denominator = ${regel.kopfSchwelle.nenner},
				head_mode = ${regel.kopfSchwelle.art},
				head_base = ${regel.kopfbasis},
				quota_numerator = ${regel.quotenSchwelle?.zaehler ?? null},
				quota_denominator = ${regel.quotenSchwelle?.nenner ?? null},
				quota_mode = ${regel.quotenSchwelle?.art ?? null},
				quota_base = ${regel.quotenbasis},
				source_reference = ${regel.fundstelle},
				abstention_counts = ${regel.enthaltungZaehltMit},
				note = ${regel.hinweis ?? null}
			 WHERE id = ${regelId}
			`;
		} catch (fehler) {
			if (fehler instanceof postgres.PostgresError && fehler.code === '23505') {
				throw schluesselBelegt();
			}
			throw fehler;
		}

		return { regel, geaendert: uebergang.ereignisse.length > 0 };
	});
}

export async function loescheReglementsregel(handelnder: Handelnder, regelId: Id): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		const [zeile] = await tx<DbZeile[]>`SELECT * FROM bylaw_quorum_rule WHERE id = ${regelId}`;
		if (!zeile) return;
		await schreibeUebergang(tx, handelnder, hebeReglementsregelAuf(ausDb(zeile)));
		await tx`DELETE FROM bylaw_quorum_rule WHERE id = ${regelId}`;
	});
}

export async function vermerkePruefung(
	handelnder: Handelnder,
	stwegId: Id,
	tag: string
): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Die Gemeinschaft vorweg unter dem eigenen Betreiber suchen.** Ohne
		 * Treffer liefen die Abfragen unter dem Zeilenschutz ins Leere, und der
		 * Verlauf hielt trotzdem einen Eintrag über eine fremde Kennung fest,
		 * unentfernbar (Klasse K2; Durchstich `e2e/fremdbetreiber.mjs`,
		 * 27.10.2026).
		 */
		const [gemeinschaft] = await tx`SELECT 1 FROM stweg WHERE id = ${stwegId}`;
		if (!gemeinschaft) throw fremdeGemeinschaft('stwegId');
		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId}
		`;
		const vermerk = await schreibeUebergang(
			tx,
			handelnder,
			bestaetigeReglementspruefung(stwegId, tag, handelnder.label, anzahl)
		);
		await tx`
			UPDATE stweg
			SET bylaw_reviewed_on = ${vermerk.geprueftAm}, bylaw_reviewed_by = ${vermerk.geprueftDurch}
			WHERE id = ${stwegId}
		`;
	});
}

export async function setzePruefungZurueck(
	handelnder: Handelnder,
	stwegId: Id,
	grund: string
): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		// Wie bei `vermerkePruefung`: kein Verlauf über eine fremde Gemeinschaft.
		const [gemeinschaft] = await tx`SELECT 1 FROM stweg WHERE id = ${stwegId}`;
		if (!gemeinschaft) throw fremdeGemeinschaft('stwegId');
		await schreibeUebergang(tx, handelnder, setzeReglementspruefungZurueck(stwegId, grund));
		await tx`
			UPDATE stweg SET bylaw_reviewed_on = NULL, bylaw_reviewed_by = NULL WHERE id = ${stwegId}
		`;
	});
}

/** Der Freitextvermerk zum Reglement. Was sich nicht als Regel fassen liess. */
export async function speichereVermerk(
	handelnder: Handelnder,
	stwegId: Id,
	text: string
): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		await tx`UPDATE stweg SET bylaw_note = ${text.trim() || null} WHERE id = ${stwegId}`;
	});
}

/**
 * Die Einberufungsfrist des Reglements (Praxisdurchlauf 28.08.2026).
 *
 * **Ein eigener Schreibweg, nicht ein Feld mehr im Angabenformular.** Die
 * Spalten hängen an `stweg`, das Formular unter «Angaben» schreibt diese Zeile
 * ebenfalls — aber ohne diese beiden Felder. Stünden sie in
 * `GemeinschaftEingabe`, löschte jedes Speichern dort die Frist. Genau diese
 * Klasse ist der Anwendung schon einmal begegnet, weshalb jenes Formular seine
 * versteckten Felder trägt.
 *
 * `tage === null` nimmt die Frist heraus und räumt die Fundstelle mit weg: Ein
 * Verweis, der nichts mehr belegt, ist schlimmer als keiner.
 */
export async function speichereEinberufungsfrist(
	handelnder: Handelnder,
	stwegId: Id,
	tage: number | null,
	fundstelle: string | null
): Promise<Einberufungsfrist> {
	const geprueft = pruefeEinberufungsfrist(tage, fundstelle);
	const operatorId = handelnder.operatorId as string;

	await alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ invitation_lead_days: number | null }[]>`
			SELECT invitation_lead_days FROM stweg WHERE id = ${stwegId}
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		await tx`
			UPDATE stweg
			SET invitation_lead_days   = ${geprueft.tage},
			    invitation_lead_source = ${geprueft.fundstelle}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einberufungsfristGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					// Beides mitschreiben: Im Anfechtungsfall zählt, welche Frist zur
					// Zeit der Einberufung galt, und die vorherige beantwortet das für
					// alles, was davor hinausging.
					vorher: vorher.invitation_lead_days,
					tage: geprueft.tage,
					fundstelle: geprueft.fundstelle
				}
			)
		);
	});

	return geprueft;
}

/**
 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt
 * (Migration 193, `domain/fondsgrenze.ts`). Ein eigener Schreibweg aus
 * demselben Grund wie bei der Einberufungsfrist darüber. Ohne Art ist die
 * Bestimmung herausgenommen, Wortlaut und Fundstelle gehen mit.
 */
export async function speichereFondsgrenze(
	handelnder: Handelnder,
	stwegId: Id,
	art: string | null,
	wortlaut: string | null,
	fundstelle: string | null
): Promise<Fondsgrenze | null> {
	const geprueft = pruefeFondsgrenze(art, wortlaut, fundstelle);
	const operatorId = handelnder.operatorId as string;

	await alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ renewal_fund_limit_kind: Fondsgrenzenart | null }[]>`
			SELECT renewal_fund_limit_kind FROM stweg WHERE id = ${stwegId}
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		await tx`
			UPDATE stweg
			SET renewal_fund_limit_kind   = ${geprueft?.art ?? null},
			    renewal_fund_limit_text   = ${geprueft?.wortlaut ?? null},
			    renewal_fund_limit_source = ${geprueft?.fundstelle ?? null}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.fondsgrenzeGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					fondsgrenzenartVorher: vorher.renewal_fund_limit_kind,
					fondsgrenzenart: geprueft?.art ?? null,
					wortlaut: geprueft?.wortlaut ?? null,
					fundstelle: geprueft?.fundstelle ?? null
				}
			)
		);
	});

	return geprueft;
}

/**
 * Die längste hinterlegte Frist zur zweiten Versammlung über mehrere Häuser.
 *
 * **Für den gemeinsamen Abend.** Dort wird der Termin der zweiten Versammlung
 * einmal gerechnet und allen Häusern fest vorgegeben — rechnete jedes für sich,
 * ergäbe eine abweichend datierte Versammlung einen eigenen Abend. Ein
 * gemeinsamer Termin muss deshalb für **jedes** Haus zulässig sein, und damit
 * entscheidet die längste Frist, nicht die des ersten Hauses.
 *
 * Gibt `null` zurück, wenn keines der Häuser eine Frist hinterlegt hat; dann
 * gilt überall die gesetzliche.
 */
export async function laengsteZweitfrist(
	operatorId: Id,
	stwegIds: Id[]
): Promise<number | null> {
	if (stwegIds.length === 0) return null;
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ tage: number | null }[]>`
			SELECT max(second_meeting_interval_days)::int AS tage
			FROM stweg WHERE id = ANY(${stwegIds}::uuid[])
		`;
		return z?.tage ?? null;
	});
}

/**
 * Die Frist zur zweiten Versammlung aus dem Reglement hinterlegen.
 *
 * **Der Unterschied zur Einberufungsfrist daneben**: Dort gibt es keine
 * gesetzliche Zahl, hier schon. Ohne hinterlegten Wert rechnet die Anwendung
 * mit den zehn Tagen aus ZGB Art. 712p Abs. 2; diese Spalte trägt nur den
 * Fall, dass ein Reglement mehr verlangt. Weniger weist der Kern ab, und die
 * Datenbank ebenfalls (Migration 122).
 */
export async function speichereZweitversammlungsfrist(
	handelnder: Handelnder,
	stwegId: Id,
	tage: number | null,
	fundstelle: string | null
): Promise<Zweitversammlungsfrist> {
	const geprueft = pruefeZweitversammlungsfrist(tage, fundstelle);
	const operatorId = handelnder.operatorId as string;

	await alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ second_meeting_interval_days: number | null }[]>`
			SELECT second_meeting_interval_days FROM stweg WHERE id = ${stwegId}
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		await tx`
			UPDATE stweg
			SET second_meeting_interval_days   = ${geprueft.tage},
			    second_meeting_interval_source = ${geprueft.fundstelle}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.zweitversammlungsfristGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					// Beides mitschreiben, aus demselben Grund wie bei der
					// Einberufungsfrist: Im Anfechtungsfall zählt, welche Frist zur Zeit
					// der Einberufung galt.
					vorher: vorher.second_meeting_interval_days,
					tage: geprueft.tage,
					fundstelle: geprueft.fundstelle
				}
			)
		);
	});

	return geprueft;
}

/**
 * Die Schranke des Reglements über seine eigene Änderung (Migration 101).
 *
 * **Ein eigener Schreibweg**, aus demselben Grund wie bei der Einberufungsfrist:
 * Die Spalten hängen an `stweg`, und das Angabenformular schreibt dieselbe Zeile
 * ohne sie. Stünden sie in `GemeinschaftEingabe`, löschte jedes Speichern der
 * Anschrift die Schranke — und niemand sähe es, bis ein Beschluss mit dem
 * falschen Quorum gefasst wäre.
 */
export async function speichereAenderungsschranke(
	handelnder: Handelnder,
	stwegId: Id,
	einstimmig: boolean,
	fundstelle: string | null
): Promise<Aenderungsschranke> {
	const geprueft = pruefeAenderungsschranke(einstimmig, fundstelle);
	const operatorId = handelnder.operatorId as string;

	await alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ bylaw_amendment_unanimous: boolean }[]>`
			SELECT bylaw_amendment_unanimous FROM stweg WHERE id = ${stwegId}
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		await tx`
			UPDATE stweg
			SET bylaw_amendment_unanimous = ${geprueft.einstimmig},
			    bylaw_amendment_source    = ${geprueft.fundstelle}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.aenderungsschrankeGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					// Beides: Im Anfechtungsfall zählt, welche Schranke zur Zeit des
					// Beschlusses galt.
					vorher: vorher.bylaw_amendment_unanimous,
					einstimmig: geprueft.einstimmig,
					fundstelle: geprueft.fundstelle
				}
			)
		);
	});

	return geprueft;
}

// ── Beschlussfähigkeit (Story 2.6) ──────────────────────────────────────────

interface AnwesenheitsZeile {
	id: string;
	stweg_id: string;
	meeting_kind: Versammlungsstufe;
	head_numerator: number;
	head_denominator: number;
	quota_numerator: number | null;
	quota_denominator: number | null;
	min_heads: number;
	source_reference: string;
}

function anwesenheitAusDb(z: AnwesenheitsZeile): Beschlussfaehigkeitsregel {
	return {
		kopf: { zaehler: z.head_numerator, nenner: z.head_denominator, art: 'mindestens' },
		quoten:
			z.quota_numerator !== null && z.quota_denominator !== null
				? { zaehler: z.quota_numerator, nenner: z.quota_denominator, art: 'mindestens' }
				: null,
		mindestens: z.min_heads,
		fundstelle: z.source_reference
	};
}

/**
 * Die hinterlegten Anwesenheitsregeln je Versammlungsstufe.
 *
 * Fehlt eine, gilt für diese Art das Gesetz. Kein Rückfall auf die Regel der
 * anderen Art: Erste und zweite Versammlung haben verschiedene Schwellen, und
 * eine übernommene Regel wäre an der falschen Stelle streng.
 */
export async function holeAnwesenheitsregeln(
	operatorId: Id,
	stwegId: Id
): Promise<Partial<Record<Versammlungsstufe, Beschlussfaehigkeitsregel>>> {
	return alsBetreiber(operatorId, async (tx) => leseAnwesenheitsregeln(tx, stwegId));
}

/**
 * Dieselbe Abfrage innerhalb einer bestehenden Transaktion.
 *
 * Nötig, wo schon eine läuft (`rueckkommenZuEroeffnen` und das Schliessen in
 * `server/abstimmung.ts` prüfen die Beschlussfähigkeit eines früheren
 * Durchgangs): Ein zweites `alsBetreiber` daneben öffnete eine eigene
 * Verbindung mit eigenem `SET LOCAL` — das ginge zwar, liefe aber neben der
 * Transaktion her und läse einen Stand, der zu ihr nicht gehört. Dasselbe
 * Muster wie `leseReglementsregeln`.
 */
export async function leseAnwesenheitsregeln(
	tx: Tx,
	stwegId: Id
): Promise<Partial<Record<Versammlungsstufe, Beschlussfaehigkeitsregel>>> {
	const zeilen = await tx<AnwesenheitsZeile[]>`
		SELECT * FROM bylaw_attendance_rule WHERE stweg_id = ${stwegId}
	`;
	return Object.fromEntries(zeilen.map((z) => [z.meeting_kind, anwesenheitAusDb(z)]));
}

export async function erstelleAnwesenheitsregel(
	handelnder: Handelnder,
	stwegId: Id,
	art: Versammlungsstufe,
	regel: Beschlussfaehigkeitsregel
): Promise<void> {
	// Die Zulässigkeitsprüfung läuft im Kern und **vor** dem Schreiben: Eine
	// erleichternde Regel wäre ungültig, und eine ungültige Regel im System sähe
	// aus wie eine gültige.
	const geprueft = pruefeErschwerung(art, regel);
	const operatorId = handelnder.operatorId as string;

	await alsBetreiber(operatorId, async (tx) => {
		const [{ id }] = await tx<{ id: string }[]>`SELECT gen_random_uuid() AS id`;
		await schreibeVerlauf(tx, handelnder, [
			{
				art: EREIGNISARTEN.reglementsregelHinterlegt,
				gegenstandArt: 'stweg',
				gegenstandId: stwegId,
				angaben: {
					gegenstand: 'beschlussfaehigkeit',
					versammlungsart: art,
					kopf: `${geprueft.kopf.zaehler}/${geprueft.kopf.nenner}`,
					quoten: geprueft.quoten ? `${geprueft.quoten.zaehler}/${geprueft.quoten.nenner}` : null,
					mindestens: geprueft.mindestens,
					fundstelle: geprueft.fundstelle
				}
			}
		]);

		await tx`
			INSERT INTO bylaw_attendance_rule (
				id, operator_id, stweg_id, meeting_kind,
				head_numerator, head_denominator, quota_numerator, quota_denominator,
				min_heads, source_reference
			) VALUES (
				${id}, ${operatorId}, ${stwegId}, ${art},
				${geprueft.kopf.zaehler}, ${geprueft.kopf.nenner},
				${geprueft.quoten?.zaehler ?? null}, ${geprueft.quoten?.nenner ?? null},
				${geprueft.mindestens}, ${geprueft.fundstelle}
			)
			ON CONFLICT (stweg_id, meeting_kind) DO UPDATE SET
				head_numerator = EXCLUDED.head_numerator,
				head_denominator = EXCLUDED.head_denominator,
				quota_numerator = EXCLUDED.quota_numerator,
				quota_denominator = EXCLUDED.quota_denominator,
				min_heads = EXCLUDED.min_heads,
				source_reference = EXCLUDED.source_reference
		`;
	});
}

export async function loescheAnwesenheitsregel(
	handelnder: Handelnder,
	stwegId: Id,
	art: Versammlungsstufe
): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Erst löschen, dann bezeugen** (Sicherheitsdurchgang 06.09.2026).
		 *
		 * Der Verlaufseintrag stand vorher davor und ohne Bedingung. Traf das
		 * `DELETE` keine Zeile — weil für diese Stufe gar keine Regel hinterlegt
		 * war —, blieb ein Eintrag stehen, der eine Aufhebung bezeugt, die es nie
		 * gab. Über die Oberfläche fällt das nicht auf: Den Knopf gibt es nur an
		 * einer vorhandenen Regel. Ein zweites Absenden oder eine gebaute Anfrage
		 * genügt aber, und im Protokoll steht dann etwas Falsches.
		 *
		 * Dieselbe Klasse wie bei den Vollmachten (`vermerkeVorlageInTx`,
		 * 69f107c): Ein Schreibvorgang, der nichts trifft, sieht von aussen aus
		 * wie ein erfolgreicher.
		 */
		const geloescht = await tx`
			DELETE FROM bylaw_attendance_rule WHERE stweg_id = ${stwegId} AND meeting_kind = ${art}
		`;
		if (geloescht.count === 0) return;

		await schreibeVerlauf(tx, handelnder, [
			{
				art: EREIGNISARTEN.reglementsregelAufgehoben,
				gegenstandArt: 'stweg',
				gegenstandId: stwegId,
				angaben: { gegenstand: 'beschlussfaehigkeit', versammlungsart: art }
			}
		]);
	});
}

// ── Die Weisungsregel (Migration 085) ──────────────────────────────────────
//
// Wie ein Haus über die Weisung an seinen Vertreter entscheidet. Eine Zeile je
// Gemeinschaft; die Schranken stehen in der Datenbank, die Sätze im Kern.

interface WeisungsZeile {
	id: string;
	stweg_id: string;
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
	no_decision: string;
	note: string | null;
}

function weisungAusDb(z: WeisungsZeile): Weisungsregel {
	return {
		id: z.id,
		stwegId: z.stweg_id,
		kopfSchwelle: {
			zaehler: Number(z.head_numerator),
			nenner: Number(z.head_denominator),
			art: z.head_mode as Schwellenart
		},
		kopfbasis: z.head_base as Kopfbasis,
		quotenSchwelle:
			z.quota_numerator !== null
				? {
						zaehler: Number(z.quota_numerator),
						nenner: Number(z.quota_denominator),
						art: z.quota_mode as Schwellenart
					}
				: null,
		quotenbasis: z.quota_base as Quotenbasis,
		fundstelle: z.source_reference,
		enthaltungZaehltMit: z.abstention_counts,
		ohneBeschluss: z.no_decision as OhneBeschluss,
		hinweis: z.note
	};
}

/**
 * Ob dieses Haus in einer anderen Gemeinschaft als Mitglied geführt wird.
 *
 * **Nicht `parent_stweg_id`** (03.09.2026, im Drehbuch aufgefallen). Das ist
 * die Frage, ob eine Gemeinschaft strukturell unter einer übergeordneten hängt.
 * Für die Weisung zählt etwas anderes: Ob in einer anderen Gemeinschaft eine
 * **Eigentümerzeile auf dieses Haus lautet** (`party.member_stweg_id`) — dann
 * hat es dort eine Stimme, und dann stellt sich die Frage, wie es zu ihr kommt.
 *
 * Gemessen am 03.09.2026: Die fünf Häuser des Verbunddrehbuchs tragen alle
 * `parent_stweg_id IS NULL` und sind trotzdem Mitglieder. Wer die Bedingung an
 * der Struktur festmacht, nimmt genau ihnen die Einstellung weg — dieselbe
 * Fehlerklasse, die `holeMitgliedsgemeinschaftId` in `weisung.ts` seit jeher
 * richtig löst.
 *
 * **Archivierte Zeilen zählen nicht** (aus dem Code-Review): Eine archivierte
 * Eigentümerzeile hielte das Haus für ein Mitglied, obwohl die übergeordnete
 * Gemeinschaft es nicht mehr führt. Jede andere aktive Sicht auf `party`
 * filtert ebenso.
 */
export async function istMitgliedsgemeinschaft(operatorId: Id, stwegId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM party
			 WHERE member_stweg_id = ${stwegId} AND archived_at IS NULL
		`;
		return Number(z?.anzahl ?? 0) > 0;
	});
}

/** Die Weisungsregel einer Gemeinschaft, oder null. */
export async function holeWeisungsregel(
	operatorId: Id,
	stwegId: Id
): Promise<Weisungsregel | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<WeisungsZeile[]>`
			SELECT * FROM bylaw_instruction_rule WHERE stweg_id = ${stwegId}
		`;
		return z ? weisungAusDb(z) : null;
	});
}

/**
 * Legt die Weisungsregel an oder ersetzt sie.
 *
 * **Ersetzen statt zweite Zeile:** Eine Gemeinschaft hat eine Regel; zwei
 * nebeneinander wären zwei Antworten auf dieselbe Frage. Der Verlauf hält
 * beide Fassungen fest — dort steht, was wann galt.
 */
export async function speichereWeisungsregel(
	handelnder: Handelnder,
	eingabe: WeisungsregelEingabe
): Promise<Weisungsregel> {
	const operatorId = handelnder.operatorId as string;
	return alsBetreiber(operatorId, async (tx) => {
		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const u = legeWeisungsregelAn(id, eingabe);
		const r = u.ergebnis;

		await tx`
			INSERT INTO bylaw_instruction_rule (
				id, operator_id, stweg_id,
				head_numerator, head_denominator, head_mode, head_base,
				quota_numerator, quota_denominator, quota_mode, quota_base,
				source_reference, abstention_counts, no_decision, note
			) VALUES (
				${id}, ${operatorId}, ${r.stwegId},
				${r.kopfSchwelle.zaehler}, ${r.kopfSchwelle.nenner},
				${r.kopfSchwelle.art}, ${r.kopfbasis},
				${r.quotenSchwelle?.zaehler ?? null}, ${r.quotenSchwelle?.nenner ?? null},
				${r.quotenSchwelle?.art ?? null}, ${r.quotenbasis},
				${r.fundstelle}, ${r.enthaltungZaehltMit}, ${r.ohneBeschluss}, ${r.hinweis ?? null}
			)
			ON CONFLICT (stweg_id) DO UPDATE SET
				head_numerator = EXCLUDED.head_numerator,
				head_denominator = EXCLUDED.head_denominator,
				head_mode = EXCLUDED.head_mode,
				head_base = EXCLUDED.head_base,
				quota_numerator = EXCLUDED.quota_numerator,
				quota_denominator = EXCLUDED.quota_denominator,
				quota_mode = EXCLUDED.quota_mode,
				quota_base = EXCLUDED.quota_base,
				source_reference = EXCLUDED.source_reference,
				abstention_counts = EXCLUDED.abstention_counts,
				no_decision = EXCLUDED.no_decision,
				note = EXCLUDED.note,
				updated_at = now()
		`;

		await schreibeUebergang(tx, handelnder, u);
		const [frisch] = await tx<WeisungsZeile[]>`
			SELECT * FROM bylaw_instruction_rule WHERE stweg_id = ${r.stwegId}
		`;
		return weisungAusDb(frisch);
	});
}

export async function loescheWeisungsregel(handelnder: Handelnder, stwegId: Id): Promise<void> {
	const operatorId = handelnder.operatorId as string;
	await alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<WeisungsZeile[]>`
			SELECT * FROM bylaw_instruction_rule WHERE stweg_id = ${stwegId}
		`;
		if (!z) return;
		await schreibeUebergang(tx, handelnder, hebeWeisungsregelAuf(weisungAusDb(z)));
		await tx`DELETE FROM bylaw_instruction_rule WHERE stweg_id = ${stwegId}`;
	});
}

/**
 * Ein Traktandum, dessen gespeichertes Erfordernis nicht mehr zu dem passt, was
 * heute hergeleitet würde.
 */
export interface VeraltetesErfordernis {
	traktandumId: Id;
	versammlungId: Id;
	ziffer: string;
	titel: string;
	/** Was heute dasteht — für die Anzeige «von … auf …». */
	bisher: string;
	/** Was nach der heutigen Regellage gälte. */
	neu: string;
}

/**
 * Welche offenen Traktanden ein Erfordernis von gestern tragen.
 *
 * **Der Anlass** (Prüflauf II, B-01): Ein Erfordernis wird beim Anlegen eines
 * Traktandums hergeleitet und in die Zeile geschrieben — eine Momentaufnahme,
 * keine Ableitung. Wer die Reglementsregel danach erfasst, ändert damit nichts
 * mehr an dem, was schon dasteht. Im Prüflauf standen deshalb zwei
 * verschiedene Erfordernisse für denselben Fall in derselben Traktandenliste:
 * «mehr als die Hälfte der Anwesenden» beim älteren, «mindestens zwei Drittel
 * aller Eigentümer» beim jüngeren. Die Traktandenliste dient als Einladung —
 * angekündigt war damit das falsche Mehr, und der Beschluss wäre anfechtbar.
 *
 * **Erkannt wird die Abweichung durch Nachrechnen, nicht durch einen
 * Zeitstempel.** Ein «geändert am» der Regel mit dem des Traktandums zu
 * vergleichen sagte nur, dass etwas passiert ist, nicht ob es hier etwas
 * ändert. Hier wird jedes offene Traktandum einmal neu hergeleitet und mit dem
 * verglichen, was gespeichert ist. Was gleich bleibt, taucht nicht auf.
 *
 * **Nur bis zur Eröffnung.** Nach welchem Mehr ausgezählt wird, muss vor der
 * Abstimmung feststehen (dieselbe Schranke wie beim Ändern von Hand,
 * `geschaeft.ts`). Eröffnete, geschlossene und versiegelte Versammlungen
 * bleiben unberührt.
 *
 * **Von Hand Gesetztes bleibt.** Trägt ein Traktandum eine Begründung der
 * Sitzungsleitung (`requirement_reason`), hat jemand bewusst vom Vorschlag
 * abweichen wollen; das wieder einzuebnen wäre schlimmer als die Lücke.
 */
export async function veralteteErfordernisse(
	operatorId: Id,
	stwegId: Id
): Promise<VeraltetesErfordernis[]> {
	return alsBetreiber(operatorId, (tx) => veralteteErfordernisseIn(tx, stwegId));
}

async function veralteteErfordernisseIn(
	tx: postgres.TransactionSql,
	stwegId: Id
): Promise<VeraltetesErfordernis[]> {
	/*
	 * Die Ziffer, wie sie in der Liste steht: von Hand gesetzt vor bei der
	 * Freigabe festgeschrieben (dieselbe Rangfolge wie in
	 * `domain/traktandenbaum.ts`), sonst die Stelle. Die zusammengesetzte Ziffer
	 * eines Sammeltraktandums («9.2») entsteht dort aus dem Baum und lässt sich
	 * hier nicht nachbilden — für die Gegenüberstellung genügt, woran man die
	 * Zeile wiedererkennt; der Verweis daneben führt hin.
	 *
	 * Der Kommentar steht **vor** dem Template und nicht darin: Ein
	 * Rückwärtsakzent beendete es sonst mitten im SQL. Heute zum dritten Mal
	 * beinahe passiert.
	 */
	const zeilen = await tx<
		{
			id: string;
			meeting_id: string;
			ziffer: string | null;
			title: string;
			requirement_version: string | null;
			requirement_node: string | null;
			requirement_title: string | null;
			requirement_head_numerator: number | null;
			requirement_head_denominator: number | null;
			requirement_head_mode: string | null;
			requirement_head_base: string | null;
			requirement_abstention_counts: boolean | null;
			requirement_quota_numerator: number | null;
			requirement_quota_denominator: number | null;
			requirement_quota_mode: string | null;
			requirement_quota_base: string | null;
			requirement_type: string | null;
			requirement_source: string | null;
			requirement_reference: string | null;
			requirement_needs_affected_consent: boolean | null;
			lesart_kennung: string | null;
			lesart_wahl: string | null;
			requirement_reading_l10: string | null;
			requirement_legal_basis: string | null;
			andere_typ: string | null;
			andere_rechtsgrundlage: string | null;
			andere_kopfbasis: string | null;
		}[]
	>`
		SELECT a.id, a.meeting_id, a.title, a.requirement_reading->>'kennung' AS lesart_kennung,
		       a.requirement_reading->>'wahl' AS lesart_wahl,
		       a.requirement_reading->'andere'->>'typ' AS andere_typ,
		       a.requirement_reading->'andere'->>'rechtsgrundlage' AS andere_rechtsgrundlage,
		       a.requirement_reading->'andere'->>'kopfbasis' AS andere_kopfbasis,
		       a.requirement_reading_l10, a.requirement_legal_basis,
		       coalesce(a.manual_number, a.released_number, a.position::text) AS ziffer,
		       a.requirement_version, a.requirement_node, a.requirement_title,
		       a.requirement_head_numerator, a.requirement_head_denominator,
		       a.requirement_head_mode, a.requirement_head_base,
		       a.requirement_quota_numerator, a.requirement_quota_denominator,
		       a.requirement_quota_mode, a.requirement_quota_base,
		       a.requirement_type, a.requirement_source, a.requirement_reference,
		       a.requirement_needs_affected_consent, a.requirement_abstention_counts
		  FROM agenda_item a
		  JOIN meeting m ON m.id = a.meeting_id
		 WHERE m.stweg_id = ${stwegId}
		   AND m.state IN ('entwurf', 'freigegeben')
		   AND a.item_kind = 'abstimmung'
		   AND a.requirement_node IS NOT NULL
		   AND a.requirement_reason IS NULL
		 ORDER BY a.position
	`;
	if (zeilen.length === 0) return [];

	const regeln = await holeReglementsregelnIn(tx, stwegId);
	const enthaltung = await holeEnthaltungseinstellungIn(tx, stwegId);
	const rw = holeRegelwerk();
	const aus: VeraltetesErfordernis[] = [];
	// Je Versammlung: im Entwurf die Lesart der Gemeinschaft, ab der Freigabe die
	// eingefrorene (Migration 169). Nach einer Umstellung erscheinen so genau die
	// Traktanden, die noch nicht freigegeben sind.
	const lesartenJe = new Map<string, Lesartenwahl>();
	const nachzuziehen = (z: (typeof zeilen)[number]): boolean =>
		angehoerigeNachzuziehen(
			{
				knotenId: z.requirement_node,
				fassung: z.requirement_version,
				kopfbasis: z.requirement_head_base,
				quelle: z.requirement_source
			},
			lesartenJe.get(z.meeting_id)?.L10
		);
	// Bisher rechnet das Traktandum mit den Angehörigen in der Zahl, künftig ohne
	// sie, wo L10 am neu hergeleiteten Erfordernis wirkt.
	const l10Bisher = (z: (typeof zeilen)[number]): string | null => (nachzuziehen(z) ? 'bleiben' : null);
	const l10Jetzt = (z: (typeof zeilen)[number], neu: Parameters<typeof angehoerigenlesartWirkt>[0]): string | null =>
		nachzuziehen(z) && angehoerigenlesartWirkt(neu) ? 'fallen_heraus' : null;
	/*
	 * Seit Migration 192: L13 ändert die Kopfbasis, und der Vergleich unten
	 * sieht das schon (`requirement_head_base`). Der Zusatz «Lesart L13» sagt in
	 * der Gegenüberstellung, warum, wie bei L10; er geht nicht in den Vergleich
	 * ein, sonst erschiene jedes Traktandum einer früheren Fassung «von X auf X».
	 * Dieselbe Bedingung wie die Absage der Freigabe (`zaehlweiseVeraltet`).
	 */
	const l13Bisher = (z: (typeof zeilen)[number]): string | null => {
		const m = zaehlweisemerkmaleAus({
			fassung: z.requirement_version,
			typ: z.requirement_type,
			rechtsgrundlage: z.requirement_legal_basis,
			kopfbasis: z.requirement_head_base,
			quelle: z.requirement_source,
			enthaltungZaehltMit: z.requirement_abstention_counts
		});
		return m && kopfzaehlweiseWirkt(m) ? kopfzaehlweiseDesMehrs(m) : null;
	};
	/*
	 * Dieselbe Bedingung wie die Absage der Freigabe (`zaehlweiseVeraltet`, wie
	 * `angehoerigeNachzuziehen` zu L10): Sie geht als eigene Stelle in den
	 * Vergleich ein, damit der Kasten jedes Traktandum zeigt, zu dem die
	 * Freigabe absagt, auch eines einer früheren Fassung (Codeprüfung Block C, N1).
	 */
	const l13Veraltet = (z: (typeof zeilen)[number]): string | null =>
		zaehlweiseVeraltet(
			{
				fassung: z.requirement_version,
				typ: z.requirement_type,
				rechtsgrundlage: z.requirement_legal_basis,
				kopfbasis: z.requirement_head_base,
				quelle: z.requirement_source,
				enthaltungZaehltMit: z.requirement_abstention_counts,
				andere: z.andere_typ
					? { typ: z.andere_typ, rechtsgrundlage: z.andere_rechtsgrundlage, kopfbasis: z.andere_kopfbasis }
					: null
			},
			lesartenJe.get(z.meeting_id)?.L13
		)
			? 'zaehlweise_veraltet'
			: null;
	const l13Jetzt = (neu: Parameters<typeof kopfzaehlweiseWirkt>[0]): string | null =>
		kopfzaehlweiseWirkt(neu) ? kopfzaehlweiseDesMehrs(neu) : null;
	/*
	 * Der Zusatz nur, wo eine Seite «Alle Eigentümer» rechnet: Unter der
	 * Vorgabe stünde er an jeder Zeile dieser Karten, auch wo das Traktandum
	 * aus einem anderen Grund erscheint.
	 */
	const l13Zusatz = (z: (typeof zeilen)[number], neu: Parameters<typeof kopfzaehlweiseWirkt>[0]) => {
		const bisher = l13Bisher(z);
		const jetzt = l13Jetzt(neu);
		return bisher === 'alle' || jetzt === 'alle' ? { bisher, jetzt } : { bisher: null, jetzt: null };
	};

	for (const z of zeilen) {
		/*
		 * **Ein Erfordernis ausserhalb des Regelwerks lässt sich nicht aus ihm
		 * neu herleiten** (01.10.2026). Der Rückkommensantrag am abgelehnten
		 * Zielantrag trägt die Fassung `ordnungsantrag-2026-08-05`, die
		 * `FASSUNGEN` nicht kennt: Daran gibt es nichts zu veralten und nichts
		 * nachzuziehen, also wird das Traktandum ausgelassen, bevor
		 * `waehleErfordernis` es sieht. Das Merkmal ist die Fassung und nicht der
		 * Knotenname (`k-rueckkommen`), und ein `try/catch` wäre hier falsch:
		 * Eine echte Fassung mit einem Knoten, den die geltende nicht kennt,
		 * soll weiter laut werfen.
		 *
		 * **Nicht gedeckt ist der leere Knoten an echter Fassung** (Codeprüfung
		 * 01.10.2026): `setzeErfordernis` schreibt `knotenId: ''`, und das
		 * Rückkommen am angenommenen Ziel übernimmt ihn ohne Begründung. Ein
		 * solches Traktandum wirft hier weiter. Offen im Plan
		 * `docs/plan-beschluss-von-hand-2026-09-30.md`, «Offen aus Block 2»,
		 * Punkt 8.
		 */
		if (!z.requirement_version || !Object.hasOwn(FASSUNGEN, z.requirement_version)) continue;

		/*
		 * **Ein Grenzfall am Traktandum ist ein zulässiger Zustand, kein
		 * Datenfehler** (01.10.2026). `erfordernisSteht` kennt ihn, und die
		 * Erfordernisseite schreibt ihn: `?/kifolgen` und `?/uebernehmen`
		 * halten den Lauf fest, auch wenn er auf einem Grenzfall endet
		 * (Produktentscheid 01.10.2026 auf die Frage, ob eine KI-Empfehlung,
		 * die auf einem Grenzfall endet, übernommen werden kann: «A, ja
		 * annehmen.»). Ein Grenzfall besagt gerade, dass kein Erfordernis
		 * feststeht: Hier gibt es also nichts zu veralten und nichts
		 * nachzuziehen. Ohne diese Zeile wirft `waehleErfordernis` mit
		 * `typ_nicht_waehlbar`, und die Reglementseite antwortet mit 500.
		 *
		 * **Nur der Grenzfall, kein `try/catch`.** Ein allgemeiner Fänger
		 * verschluckte auch `knoten_unbekannt`, und ein still übersprungenes
		 * Traktandum sieht aus wie «nichts veraltet».
		 */
		if (knotenVon(rw, z.requirement_node!)?.typ === 'grenzfall') continue;

		const gewaehlt = waehleErfordernis(rw, z.requirement_node!);
		if (!gewaehlt.ergebnis) continue;
		if (!lesartenJe.has(z.meeting_id)) {
			lesartenJe.set(z.meeting_id, await holeLesartenIn(tx, { meetingId: z.meeting_id }));
		}
		const neu = wendeReglementAn(gewaehlt.ergebnis, regeln, enthaltung, lesartenJe.get(z.meeting_id)!)
			.erfordernis;
		/*
		 * **Ohne gespeicherte Wahl rechnet das Traktandum, was der Knoten seiner
		 * Fassung rechnet** (Codeprüfung Lesarten Block 3, M2; Entscheid 0048,
		 * Block A): L2 hängt an einem Knoten, den es schon vorher gab. Ein
		 * Traktandum aus einer Fassung vor der Lesart trägt keine Wahl. Gefragt
		 * wird `wahlOhneGespeicherte`, dieselbe Funktion wie in der Freigabe,
		 * nicht die Vorgabe des Katalogs: Stellt eine spätere Fassung sie um,
		 * rechnet das alte Traktandum weiter wie bisher. Nur, wo das neu
		 * hergeleitete Erfordernis eine Lesart trägt, wie bis Block A: Unter einer
		 * Regel des Reglements fällt sie weg, und es gibt nichts zu vergleichen.
		 */
		const wahlOhneLesart = neu.gemeinschaftslesart
			? wahlOhneGespeicherte(
					neu.gemeinschaftslesart.kennung,
					knotenDerFassung(z.requirement_version, z.requirement_node!),
					{ typ: z.requirement_type, kopfbasis: z.requirement_head_base, quotenbasis: z.requirement_quota_base }
				)
			: undefined;

		/*
		 * Verglichen wird, was die Auszählung entscheidet: die beiden Schwellen
		 * mit ihrer Lesart und Bezugsgrösse, der Ergebnistyp und ob die
		 * Zustimmung der Betroffenen nötig ist.
		 *
		 * **Nicht verglichen wird die Quelle** (`requirement_source`). Der erste
		 * Anlauf nahm sie mit — und meldete prompt acht Traktanden, von denen
		 * sechs unverändert blieben: Ein Traktandum aus der Vorlage trägt
		 * «hergeleitet», ein von Hand gewähltes «gewaehlt», und die Neuherleitung
		 * setzt wieder ihre eigene. Das sagt, wie das Erfordernis zustande kam,
		 * nicht was gilt. Ein Kasten, der sechs Zeilen «von X auf X» zeigt, wird
		 * beim zweiten Mal überblättert.
		 *
		 * Der Preis: Eine Regel, die genau das Gesetz wiederholt, fällt nicht auf.
		 * Für die Auszählung ändert sie nichts; im Protokoll stünde dann «nach
		 * Gesetz» statt «nach Reglement Ziff. X». Das ist der kleinere Schaden.
		 *
		 * Titel und Rechtsgrundlage bleiben ebenfalls aussen vor — sie ändern sich
		 * mit jeder Regelwerksfassung, ohne dass sich am Ergebnis etwas ändert.
		 */
		const bisher = [
			z.requirement_type,
			z.requirement_head_numerator,
			z.requirement_head_denominator,
			z.requirement_head_mode,
			z.requirement_head_base,
			z.requirement_quota_numerator,
			z.requirement_quota_denominator,
			z.requirement_quota_mode,
			z.requirement_quota_base,
			z.requirement_needs_affected_consent,
			// Seit dem 04.09.2026: Eine Regel, die allein die Enthaltungen aus der
			// Bezugsgrösse nimmt, ändert das Ergebnis, ohne eine der Zahlen darüber
			// zu bewegen. Ohne diese Zeile meldete der Kasten nichts.
			z.requirement_abstention_counts,
			// Seit Migration 169: Die Freigabe sagt ab, solange ein Traktandum
			// nach einer anderen Lesart rechnet; ohne diese Zeile liesse es sich
			// nicht nachziehen, wenn zwei Lesarten dasselbe Mehr ergäben.
			//
			// **Ohne Lesart gilt die Wahl, die das Traktandum rechnet**
			// (`wahlOhneLesart` oben): Nach ihr hergeleitet ergäbe sich dasselbe
			// Mehr, und der Kasten zeigte «von X auf X». Steht die Gemeinschaft
			// auf der anderen Wahl, bleibt der Unterschied und das Traktandum
			// erscheint; ebenso, wenn sich keine Wahl bestimmen lässt.
			z.lesart_wahl ?? wahlOhneLesart ?? null,
			// Seit Migration 189: L10 hängt an keinem Knoten, sondern an der
			// Zählung. Nachzuziehen ist nur ein Traktandum, das fest mit den
			// Angehörigen in der Zahl rechnet, während die Gemeinschaft auf
			// «fallen_heraus» steht (`angehoerigeNachzuziehen`, dieselbe Bedingung
			// wie die Absage der Freigabe). Sonst steht hier nichts, und der Zusatz
			// erscheint an keiner Zeile (Codeprüfung E1 Block D, H2 und M3).
			l10Bisher(z),
			l13Veraltet(z)
		].join('|');
		const jetzt = [
			neu.typ,
			neu.kopfSchwelle?.zaehler ?? null,
			neu.kopfSchwelle?.nenner ?? null,
			neu.kopfSchwelle?.art ?? null,
			neu.kopfbasis,
			neu.quotenSchwelle?.zaehler ?? null,
			neu.quotenSchwelle?.nenner ?? null,
			neu.quotenSchwelle?.art ?? null,
			neu.quotenbasis,
			neu.zustimmungBetroffenerNoetig,
			neu.enthaltungZaehltMit ?? null,
			neu.gemeinschaftslesart?.wahl ?? null,
			l10Jetzt(z, neu),
			null
		].join('|');
		if (bisher === jetzt) continue;

		aus.push({
			traktandumId: z.id,
			versammlungId: z.meeting_id,
			ziffer: z.ziffer ?? '—',
			titel: z.title,
			/*
			 * A5, Punkt 1c: Ein Traktandum ohne eigene Lesart rechnet die Wahl
			 * seines Knotens (siehe den Vergleich oben; meist die Vorgabe, an sechs
			 * frühen Fassungen die andere Wahl, Test `lesart-am-knoten`). Die Zeile
			 * «bisher» nennt deshalb diese Wahl,
			 * nicht die der Gemeinschaft: Weicht die ab, erscheint das Traktandum
			 * genau deswegen. Lässt sich keine bestimmen, nennt sie keine Lesart.
			 */
			bisher: mehrheitInWorten(
				z.requirement_head_numerator,
				z.requirement_head_denominator,
				z.requirement_head_mode,
				z.requirement_head_base,
				z.requirement_source,
				z.requirement_reference,
				z.requirement_abstention_counts,
				z.lesart_kennung && z.lesart_wahl
					? { kennung: z.lesart_kennung, wahl: z.lesart_wahl }
					: neu.gemeinschaftslesart && wahlOhneLesart
						? { kennung: neu.gemeinschaftslesart.kennung, wahl: wahlOhneLesart }
						: null,
				z.requirement_quota_numerator !== null && z.requirement_quota_denominator !== null
					? {
							zaehler: z.requirement_quota_numerator,
							nenner: z.requirement_quota_denominator,
							art: z.requirement_quota_mode
						}
					: null,
				l10Bisher(z),
				l13Zusatz(z, neu).bisher
			),
			neu: mehrheitInWorten(
				neu.kopfSchwelle?.zaehler ?? null,
				neu.kopfSchwelle?.nenner ?? null,
				neu.kopfSchwelle?.art ?? null,
				neu.kopfbasis,
				neu.quelle,
				neu.fundstelle ?? null,
				neu.enthaltungZaehltMit ?? null,
				neu.gemeinschaftslesart ?? null,
				neu.quotenSchwelle
					? { zaehler: neu.quotenSchwelle.zaehler, nenner: neu.quotenSchwelle.nenner, art: neu.quotenSchwelle.art ?? null }
					: null,
				l10Jetzt(z, neu),
				l13Zusatz(z, neu).jetzt
			)
		});
	}
	return aus;
}

/**
 * Ein Erfordernis in einem Satz — nur so genau, wie die Gegenüberstellung
 * «von … auf …» es braucht. Die vollständige Fassung steht im Traktandum
 * selbst und in der Traktandenliste.
 */
function mehrheitInWorten(
	zaehler: number | null,
	nenner: number | null,
	art: string | null,
	basis: string | null,
	quelle: string | null,
	fundstelle: string | null,
	/**
	 * Seit dem 07.10.2026: Die Einstellung der Gemeinschaft ändert nur dieses
	 * Merkmal. Ohne es stünde im Kasten «von X auf X».
	 */
	enthaltungZaehltMit: boolean | null,
	/**
	 * Seit Migration 169: Die Lesart geht in den Vergleich ein; ohne sie im
	 * Satz stünde «von X auf X», wenn zwei Lesarten dasselbe Mehr ergeben.
	 */
	lesart: { kennung: string; wahl: string } | null,
	/** Laien- und Fachprüfung A5, H3: Ohne sie hiesse qualifiziert wie einfach. */
	quoten: { zaehler: number; nenner: number; art: string | null } | null,
	/**
	 * Seit Migration 189: Die Wahl zu L10 geht in den Vergleich ein; ohne sie im
	 * Satz stünde «von X auf X», wenn nur die Zahl der Angehörigen im Ausstand
	 * sich ändert.
	 */
	angehoerigenlesart: string | null,
	/** Seit Migration 192: die Zählweise der Köpfe, wo sie wirkt (L13). */
	kopfzaehlweise: string | null
): string {
	const bruch =
		zaehler === null || nenner === null
			? 'kein Mehr'
			: `${art === 'mindestens' ? 'mindestens' : 'mehr als'} ${zaehler}/${nenner}`;
	const wovon =
		basis === 'alle_eigentuemer'
			? 'aller Eigentümer'
			: basis === 'alle_ausser_betroffene'
				? 'aller ausser den Betroffenen'
				: // «oder» (Produktentscheid 08.10.2026), wie im Protokoll.
					'der Anwesenden oder Vertretenen';
	const woher = quelle === 'reglement' ? ` · Reglement${fundstelle ? `, ${fundstelle}` : ''}` : '';
	const enthaltung = enthaltungZaehltMit === false ? ', Enthaltungen nicht mitgezählt' : '';
	const nachLesart = lesart ? ` · Lesart: ${wahlInWorten(lesart.kennung, lesart.wahl)}` : '';
	const nachAngehoerigen = angehoerigenlesart
		? ` · Lesart L10: ${wahlInWorten('L10', angehoerigenlesart)}`
		: '';
	const nachKoepfen = kopfzaehlweise ? ` · Lesart L13: ${wahlInWorten('L13', kopfzaehlweise)}` : '';
	const nachQuoten = quoten
		? ` und ${quoten.art === 'mindestens' ? 'mindestens' : 'mehr als'} ${quoten.zaehler}/${quoten.nenner} aller Wertquoten`
		: '';
	return `${bruch} ${wovon}${nachQuoten}${enthaltung}${woher}${nachLesart}${nachAngehoerigen}${nachKoepfen}`;
}

/**
 * Die Erfordernisse der offenen Traktanden neu herleiten.
 *
 * Ausdrücklich angestossen, nie im Vorbeigehen: Wer eine Regel hinterlegt, soll
 * sehen, was sie an bestehenden Traktanden ändert, und es dann tun — nicht es
 * geschehen lassen. Was sich nicht ändert, wird nicht angefasst.
 */
export async function erfordernisseNachziehen(
	handelnder: Handelnder & { operatorId: string },
	stwegId: Id
): Promise<{ nachgezogen: number; uebersprungen: string[] }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const offen = await veralteteErfordernisseIn(tx, stwegId);
		if (offen.length === 0) return { nachgezogen: 0, uebersprungen: [] };

		const regeln = await holeReglementsregelnIn(tx, stwegId);
		const enthaltung = await holeEnthaltungseinstellungIn(tx, stwegId);
		const rw = holeRegelwerk();
		const [zeilen] = [
			await tx<{ id: string; meeting_id: string; requirement_node: string }[]>`
				SELECT id, meeting_id, requirement_node FROM agenda_item
				 WHERE id = ANY(${offen.map((o) => o.traktandumId)}::uuid[])
			`
		];
		/*
		 * **Jedes Traktandum für sich** (Codeprüfung 06.10.2026). Seit Migration
		 * 144 kann die Schreibstelle ein Traktandum einer freigegebenen Versammlung
		 * abweisen, wenn das neue Mehr milder ist und die erfasste Frist für eine
		 * berichtigte Einladung vorbei ist. Ohne Sicherungspunkt fiel damit das
		 * Nachziehen der ganzen Gemeinschaft zurück, bei jedem Versuch wieder.
		 * Abgewiesene bleiben stehen und werden genannt.
		 */
		const uebersprungen: string[] = [];
		const geschriebeneIds = new Set<string>();
		for (const z of zeilen) {
			const gewaehlt = waehleErfordernis(rw, z.requirement_node);
			if (!gewaehlt.ergebnis) continue;
			const e = wendeReglementAn(
				gewaehlt.ergebnis,
				regeln,
				enthaltung,
				await holeLesartenIn(tx, { meetingId: z.meeting_id })
			).erfordernis;
			try {
				await tx.savepoint((sp) => schreibeErfordernisIn(sp, handelnder, z.id, e));
				geschriebeneIds.add(z.id);
			} catch (f) {
				if (!(f instanceof FachlicherFehler)) throw f;
				uebersprungen.push(f.message);
			}
		}
		const geschrieben = geschriebeneIds.size;
		// Ohne Geschriebenes kein Verlaufseintrag (Codeprüfung, dritter Blick).
		if (geschrieben === 0) return { nachgezogen: 0, uebersprungen };

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.erfordernisseNachgezogen,
				{ art: 'stweg', id: stwegId },
				{
					anzahl: geschrieben,
					// Nur was geschrieben wurde; Abgewiesene stehen unter `uebersprungen`.
					traktanden: offen
						.filter((o) => geschriebeneIds.has(o.traktandumId))
						.map((o) => `${o.ziffer} ${o.titel}: ${o.bisher} → ${o.neu}`),
					...(uebersprungen.length > 0 ? { uebersprungen } : {})
				}
			)
		);
		return { nachgezogen: geschrieben, uebersprungen };
	});
}
