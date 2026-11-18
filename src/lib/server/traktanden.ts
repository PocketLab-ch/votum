/**
 * Datenzugriff auf Traktanden und ihren Baum (Stories 3.2, 3.3).
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis, type Ereignis } from '$lib/domain/verlauf';
import { offeneFolgeantraege, type Antragsknoten } from '$lib/domain/folgeantrag';
import { entscheidetDasGeschaeft } from '$lib/domain/konsultativ';
import {
	aendereTraktandum,
	entferneTraktandum,
	legeTraktandumAn,
	setzeTraktandumErfordernis,
	type Antragstellerart,
	type Spontanart,
	type Traktandum,
	type TraktandumEingabe,
	type Traktandumart
} from '$lib/domain/traktanden';
import {
	GROESSTE_TIEFE,
	nummeriere,
	ordneUm,
	pruefeNummer,
	verlangeVorwaertsgerichtet,
	type NummerierterKnoten,
	type Verschiebung
} from '$lib/domain/traktandenbaum';
import { istImEntwurf, verlangeZustand } from '$lib/domain/versammlung';
import {
	verlangeRuecknehmbar,
	verlangeRueckzugsgrund,
	verlangeZurueckziehbar
} from '$lib/domain/traktanden';
import {
	erfordernisFuerRueckkommen,
	rueckkommenstitel,
	rueckkommenswortlaut,
	verlangeRueckkommbar
} from '$lib/domain/rueckkommen';
import { entfernungshinweis, FESTE_TRAKTANDEN, JAHRESGESCHAEFTE } from '$lib/domain/traktandenvorlage';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { hindernisAlsGrundantrag, hindernisRueckkommenAufFolgeantrag } from '$lib/domain/folgeantrag';
import {
	NICHT_ANGEKUENDIGT_AM_ABEND,
	NICHT_ANGEKUENDIGT_GRUNDSATZ,
	NICHT_ANGEKUENDIGT_OHNE_REGLEMENT,
	NICHT_ANGEKUENDIGT_WEGE,
	universalgruende,
	type Ausnahmegrund
} from '$lib/domain/ausnahmen';
import { leseUniversallage } from './universal';
import {
	verlangeBetroffeneAmMehr,
	waehlbareErfordernisse,
	waehleErfordernis,
	type Erfordernis,
	type Erfordernisauswahl
} from '$lib/domain/entscheidbaum';
import {
	erfordernisAusRegel,
	wendeReglementAn,
	wendeReglementAnNachFreigabe,
	type Regelanwendung
} from '$lib/domain/reglement';
import {
	durchgangAngenommenInTx,
	durchgangMitAllenJaInTx,
	durchgangOhneBeschlussInTx,
	rueckkommenOffenIn
} from './abstimmung';
import { loescheVorabvermerkeNachNeuemWortlaut } from './betroffene';
import { raeumeTraktandenAb } from './traktandenreste';
import { achteEinladungsmehr, schreibeEinladungsmehr } from './einladungsmehr';
import { erfordernisAusZeile, type ErfordernisSpalten } from './erfordernisspalten';
import { holeRegelwerk } from '$lib/rules';
import {
	holeEnthaltungseinstellung,
	holeReglementsregeln,
	leseReglementsregeln
} from './reglement';
import {
	gespeichertNachFreigabe,
	holeEnthaltungseinstellungIn,
	verlangeKeinVerwaltungsgeschaeftAmWahlknoten,
	verlangeKeinVerwaltungsgeschaeftAmWahlknotenIn
} from './erfordernisse';
import { holeLesarten, holeLesartenIn } from './lesarten';
import { leseNeueTraktandenDerZweitenIn } from './neutraktanden';
import type { Id } from '$lib/domain/types';
import type { Verwaltungsangabe } from '$lib/domain/verwaltungsangabe';
import { kalendertag } from '$lib/domain/datum';

interface AgendaZeile extends ErfordernisSpalten {
	id: string;
	operator_id: string;
	meeting_id: string;
	parent_id: string | null;
	position: number;
	manual_number: string | null;
	released_number: string | null;
	title: string;
	item_kind: Traktandumart;
	withdrawn_at: Date | null;
	reconsiders_item_id: string | null;
	withdrawn_by_label: string | null;
	withdrawn_reason: string | null;
	body: string | null;
	summary: string | null;
	motion_text: string | null;
	proposer_kind: Antragstellerart;
	proposer_party_id: string | null;
	proposer_stweg_id: string | null;
	proposer_name: string | null;
	is_spontaneous: boolean;
	spontaneous_kind: Spontanart | null;
	concerns_management: boolean;
	/** Migration 185, Entscheid 0045, Punkt 11. */
	management_exemption: Verwaltungsangabe | null;
	unannounced_basis: Ausnahmegrund | null;
	approved_by_item_id: string | null;
	added_during_meeting_at: Date | null;
	copied_from_meeting_id: string | null;
	from_template: boolean;
}

function ausDb(
	z: AgendaZeile,
	betroffene: Id[],
	herkunft: string | null,
	antragsteller: { id: Id; name: string }[] = []
): Traktandum {
	return {
		id: z.id,
		operatorId: z.operator_id,
		meetingId: z.meeting_id,
		parentId: z.parent_id,
		position: z.position,
		nummerManuell: z.manual_number,
		nummerFest: z.released_number,
		titel: z.title,
		art: z.item_kind,
		inhalt: z.body ?? undefined,
		kurzfassung: z.summary ?? undefined,
		antragswortlaut: z.motion_text ?? undefined,
		antragstellerart: z.proposer_kind,
		antragstellerId: z.proposer_party_id ?? z.proposer_stweg_id,
		antragstellerName: z.proposer_name ?? undefined,
		antragstellerIds: antragsteller.map((a) => a.id),
		antragstellerNamen: antragsteller.map((a) => a.name),
		betroffeneParteiIds: betroffene,
		erfordernis: erfordernisAusZeile(z),
		uebernommenAus:
			z.copied_from_meeting_id && herkunft
				? { versammlungId: z.copied_from_meeting_id, datum: herkunft }
				: null,
		ausVorlage: z.from_template,
		spontan: z.is_spontaneous,
		spontanart: z.spontaneous_kind,
		verwaltungsGeschaeft: z.concerns_management,
		// Nur gesetzt, wenn die Leitung eine Angabe gemacht hat; `undefined`
		// statt `null`, damit Traktanden ohne sie gleich aussehen wie bisher.
		...(z.management_exemption ? { verwaltungsangabe: z.management_exemption } : {}),
		ausnahme: z.unannounced_basis,
		genehmigungTraktandumId: z.approved_by_item_id,
		aufgenommenAm: z.added_during_meeting_at?.toISOString() ?? null,
		rueckkommenZielId: z.reconsiders_item_id,
		rueckzug: z.withdrawn_at
			? {
					am: z.withdrawn_at.toISOString(),
					durch: z.withdrawn_by_label ?? '',
					grund: z.withdrawn_reason ?? ''
				}
			: null
	};
}

/** Alle Traktanden einer Versammlung, nummeriert und in Anzeigereihenfolge. */
export async function holeTraktanden(
	operatorId: Id,
	meetingId: Id
): Promise<NummerierterKnoten<Traktandum>[]> {
	return alsBetreiber(operatorId, (tx) => leseTraktanden(tx, meetingId));
}

async function leseTraktanden(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<NummerierterKnoten<Traktandum>[]> {
	const zeilen = await tx<(AgendaZeile & { copied_from_date: Date | null })[]>`
		SELECT a.*, q.meeting_date AS copied_from_date
		FROM agenda_item a
		LEFT JOIN meeting q ON q.id = a.copied_from_meeting_id
		WHERE a.meeting_id = ${meetingId}
		ORDER BY a.position
	`;
	const betroffene = await tx<{ agenda_item_id: string; party_id: string }[]>`
		SELECT b.agenda_item_id, b.party_id
		FROM agenda_item_affected b
		JOIN agenda_item a ON a.id = b.agenda_item_id
		WHERE a.meeting_id = ${meetingId}
	`;
	// Die gemeinsam Antragstellenden samt Namen (Migration 034). Der Name kommt
	// aus den lebenden Stammdaten: Die Traktandenliste zeigt an, sie friert nicht
	// ein — das tut erst die Momentaufnahme.
	const antragsteller = await tx<
		{ agenda_item_id: string; party_id: string; display_name: string }[]
	>`
		SELECT ap.agenda_item_id, ap.party_id, p.display_name
		FROM agenda_item_proposer ap
		JOIN agenda_item a ON a.id = ap.agenda_item_id
		JOIN party p ON p.id = ap.party_id
		WHERE a.meeting_id = ${meetingId}
		ORDER BY p.display_name
	`;

	const jeTraktandum = new Map<string, Id[]>();
	for (const b of betroffene) {
		const liste = jeTraktandum.get(b.agenda_item_id) ?? [];
		liste.push(b.party_id);
		jeTraktandum.set(b.agenda_item_id, liste);
	}

	const stellerJeTraktandum = new Map<string, { id: Id; name: string }[]>();
	for (const a of antragsteller) {
		const liste = stellerJeTraktandum.get(a.agenda_item_id) ?? [];
		liste.push({ id: a.party_id, name: a.display_name });
		stellerJeTraktandum.set(a.agenda_item_id, liste);
	}

	const traktanden = zeilen.map((z) =>
		ausDb(
			z,
			jeTraktandum.get(z.id) ?? [],
			z.copied_from_date ? kalendertag(z.copied_from_date) : null,
			stellerJeTraktandum.get(z.id) ?? []
		)
	);
	return nummeriere(traktanden);
}

interface Versammlungsstand {
	stwegId: Id;
	datum: string;
}

async function versammlungsstand(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<Versammlungsstand> {
	const [m] = await tx<{ stweg_id: string; meeting_date: Date }[]>`
		SELECT stweg_id, meeting_date FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	return { stwegId: m.stweg_id, datum: kalendertag(m.meeting_date) };
}

/**
 * Neue Personenverweise brauchen Eigentum am Tag der Versammlung.
 *
 * Bereits im selben Feld gespeicherte Kennungen bleiben zulässig. So lässt sich
 * ein historisches Traktandum berichtigen, ohne dabei seine damalige Referenz zu
 * verlieren. Die Ausnahme kommt ausdrücklich vom jeweiligen Feld; eine alte
 * betroffene Partei wird dadurch nicht als neue Antragstellerin zugelassen.
 */
async function verlangeEigentumAmVersammlungstag(
	tx: postgres.TransactionSql,
	stand: Versammlungsstand,
	parteiIds: Id[],
	bisherInDiesemFeld: Id[],
	feld: string,
	rolle: string
): Promise<void> {
	const neu = [...new Set(parteiIds)].filter((id) => !bisherInDiesemFeld.includes(id));
	if (neu.length === 0) return;

	// Der Vergleich als Text hält auch einen manipulierten Nicht-UUID-Wert im
	// fachlichen Fehlerpfad, statt eine rohe PostgreSQL-Umwandlung auszulösen.
	const eigene = await tx<{ id: string }[]>`
		SELECT id::text AS id FROM party
		WHERE stweg_id = ${stand.stwegId} AND id::text = ANY(${neu})
	`;
	if (eigene.length !== neu.length) {
		throw new FachlicherFehler(
			'fremde_partei',
			`Als ${rolle} kommen nur Eigentümer dieser Gemeinschaft in Frage.`,
			feld
		);
	}

	const gueltig = await tx<{ id: string }[]>`
		SELECT DISTINCT p.id::text AS id
		FROM party p
		JOIN unit_ownership o ON o.party_id = p.id
		WHERE p.stweg_id = ${stand.stwegId}
		  AND p.id::text = ANY(${neu})
		  AND o.valid_from <= ${stand.datum}
		  AND (o.valid_to IS NULL OR o.valid_to > ${stand.datum})
	`;
	if (gueltig.length !== neu.length) {
		throw new FachlicherFehler(
			'kein_eigentum_am_versammlungstag',
			`Als ${rolle} kommen nur Parteien in Frage, die am ${stand.datum} mindestens eine Einheit halten.`,
			feld
		);
	}
}

async function verlangeWaehlbareEigentuemer(
	tx: postgres.TransactionSql,
	stand: Versammlungsstand,
	t: Traktandum,
	bisher?: Traktandum
): Promise<void> {
	await verlangeEigentumAmVersammlungstag(
		tx,
		stand,
		t.antragstellerart === 'eigentuemer' && t.antragstellerId ? [t.antragstellerId] : [],
		bisher?.antragstellerart === 'eigentuemer' && bisher.antragstellerId
			? [bisher.antragstellerId]
			: [],
		'antragstellerId',
		'Antragsteller'
	);
	await verlangeEigentumAmVersammlungstag(
		tx,
		stand,
		t.antragstellerart === 'mehrere_eigentuemer' ? (t.antragstellerIds ?? []) : [],
		bisher?.antragstellerart === 'mehrere_eigentuemer' ? (bisher.antragstellerIds ?? []) : [],
		'antragstellerIds',
		'Antragsteller'
	);
	await verlangeEigentumAmVersammlungstag(
		tx,
		stand,
		t.betroffeneParteiIds,
		bisher?.betroffeneParteiIds ?? [],
		'betroffene',
		'unmittelbar Betroffene'
	);
	await verlangeWaehlbareUntergemeinschaft(tx, stand, t);
}

/**
 * Eine antragstellende Untergemeinschaft muss die sein, die die Maske anbietet.
 *
 * **Der Anlass** (Kreuzteil des Fremdbetreiber-Durchstichs, 27.10.2026): Das
 * Feld `antragstellerGemeinschaft` ging ungeprüft in `proposer_stweg_id`, und
 * der einfache Fremdschlüssel nahm eine Gemeinschaft eines anderen Betreibers
 * an. Seit Migration 176 hält das Schema den Betreiber; die Absage hier sagt
 * es fachlich und bindet ausserdem an die Versammlung.
 *
 * Zugelassen ist genau die Auswahl der Maske
 * (`versammlungen/[id]/traktanden/+page.server.ts`, `untergemeinschaften`):
 * eine unmittelbare Untergemeinschaft der Gemeinschaft dieser Versammlung,
 * eine archivierte nur, wenn ein Traktandum der Versammlung sie schon nennt.
 * Gelesen wird unter dem eigenen Betreiber; eine fremde Gemeinschaft gibt es
 * hier nicht.
 */
async function verlangeWaehlbareUntergemeinschaft(
	tx: postgres.TransactionSql,
	stand: Versammlungsstand,
	t: Traktandum
): Promise<void> {
	if (t.antragstellerart !== 'untergemeinschaft' || !t.antragstellerId) return;
	const [g] = await tx<{ id: string }[]>`
		SELECT s.id FROM stweg s
		WHERE s.id = ${t.antragstellerId}
		  AND s.parent_stweg_id = ${stand.stwegId}
		  AND (
		    stweg_archiv_wegen(s.id) IS NULL
		    OR EXISTS (SELECT 1 FROM agenda_item a
		               WHERE a.meeting_id = ${t.meetingId} AND a.proposer_stweg_id = s.id)
		  )
	`;
	if (!g) {
		throw new FachlicherFehler(
			'fremde_untergemeinschaft',
			'Als antragstellende Untergemeinschaft kommt nur eine Untergemeinschaft dieser Gemeinschaft in Frage.',
			'antragstellerId'
		);
	}
}

/**
 * Schreibt die Nummern fest, unter denen eingeladen wurde (Migration 072).
 *
 * Gehört zur Freigabe und läuft in deren Transaktion — zusammen mit der
 * Momentaufnahme des Stimmberechtigtenstands. Der Grund ist derselbe: Was mit
 * der Einladung hinausgeht, muss nachher noch dasselbe sein.
 *
 * **Danach ändert Verschieben die Nummer nicht mehr.** Das ist der ganze Zweck.
 * Die Reihenfolge bleibt frei — sie ist ein Ordnungsentscheid der Versammlung —,
 * aber die «Décharge an die Bewirtschaftung» heisst am Abend noch so, wie sie
 * auf der Einladung stand.
 *
 * Vorhandene Nummern werden nicht überschrieben: Wird eine Freigabe
 * zurückgenommen und erneut erteilt, löscht die Rücknahme sie zuvor
 * (`loescheFreigabenummern`). Bliebe hier ein Rest stehen, trüge die Liste nach
 * dem zweiten Anlauf zwei Stände nebeneinander.
 */
export async function schreibeFreigabenummern(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<number> {
	const traktanden = await leseTraktanden(tx, meetingId);
	if (traktanden.length === 0) return 0;

	const paare = traktanden.map((t) => [t.knoten.id, t.nummer]);
	const zeilen = await tx`
		UPDATE agenda_item a SET released_number = v.nummer
		  FROM (VALUES ${tx(paare)}) AS v(id, nummer)
		 WHERE a.id = v.id::uuid AND a.meeting_id = ${meetingId}
	`;
	return zeilen.count;
}

/**
 * Hält bei der Freigabe das Mehr fest, das die Einladung je Traktandum nennt
 * (Migration 144, `einladungsmehr.ts`). Liest dieselbe Liste wie
 * `schreibeFreigabenummern`, damit Nummer und Mehr derselben Einladung gehören.
 */
export async function schreibeEinladungsmehrBeiFreigabe(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	const traktanden = await leseTraktanden(tx, meetingId);
	await schreibeEinladungsmehr(
		tx,
		traktanden.map((t) => ({ id: t.knoten.id, art: t.knoten.art, erfordernis: t.knoten.erfordernis }))
	);
}

/**
 * Nimmt die festgeschriebenen Nummern zurück.
 *
 * Gegenstück zu `schreibeFreigabenummern`, aufgerufen beim Zurücknehmen der
 * Freigabe. Im Entwurf rechnet die Liste wieder frei: Wer dort ein Traktandum
 * einfügt, erwartet, dass die Nummern nachrücken — genau das, was ab der
 * Freigabe nicht mehr geschehen darf (AD-3: verwerfen, nicht fortschreiben).
 */
export async function loescheFreigabenummern(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	await tx`
		UPDATE agenda_item SET released_number = NULL
		 WHERE meeting_id = ${meetingId} AND released_number IS NOT NULL
	`;
}

/** Verlangt, dass die Versammlung noch im Entwurf ist — Traktanden sind ab der Freigabe gesperrt. */
async function nurImEntwurf(tx: postgres.TransactionSql, meetingId: Id): Promise<void> {
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	verlangeZustand({ zustand: m.state as never }, ['entwurf'], 'in den Traktanden ändern');
}

async function naechstePosition(
	tx: postgres.TransactionSql,
	meetingId: Id,
	parentId: Id | null
): Promise<number> {
	const [z] = await tx<{ hoechste: number | null }[]>`
		SELECT max(position) AS hoechste FROM agenda_item
		WHERE meeting_id = ${meetingId}
		  AND parent_id IS NOT DISTINCT FROM ${parentId}
	`;
	return (z?.hoechste ?? 0) + 1;
}

/**
 * Betroffene aus dem Formular nur, wo auch der Saal sie annimmt (Entscheid
 * 0050, Antwort 3; `verlangeBetroffeneAmMehr`), **gegen das Mehr, das nach dem
 * Speichern gilt**, in derselben Transaktion, wie bei L8 (G2, 06.11.2026): Die
 * Route ruft danach `setzeGewaehltesErfordernis`, und das schreibt den Knoten
 * aus dem Formular nur, wo er sich vom bisherigen unterscheidet. Sonst bleibt
 * das bisherige Mehr; eine Kenntnisnahme verliert es beim Speichern.
 */
async function verlangeBetroffeneNachDemSpeichern(
	tx: postgres.TransactionSql,
	stand: Versammlungsstand,
	t: Traktandum,
	knotenId: string | null,
	bisher: Traktandum | null
): Promise<void> {
	if (t.betroffeneParteiIds.length === 0) return;
	const neuerKnoten = knotenId && knotenId !== (bisher?.erfordernis?.knotenId ?? null) ? knotenId : null;
	const mehr = neuerKnoten
		? await erfordernisAmHausIn(tx, { meetingId: t.meetingId, stwegId: stand.stwegId }, neuerKnoten)
		: t.art === 'kenntnisnahme'
			? null
			: (bisher?.erfordernis ?? null);
	verlangeBetroffeneAmMehr(mehr, t.betroffeneParteiIds);
}

async function schreibeBetroffene(
	tx: postgres.TransactionSql,
	operatorId: Id,
	traktandumId: Id,
	meetingId: Id,
	parteiIds: Id[]
): Promise<void> {
	/*
	 * **Nur entfernen, wer nicht mehr gewählt ist** (seit Migration 124). Bis
	 * dahin löschte diese Stelle alle Zeilen und schrieb sie neu. Seit die Zeile
	 * einen Vorab-Vermerk trägt, der nach einer zurückgenommenen Freigabe hier
	 * wieder durchläuft, verlöre jedes Speichern des Formulars ihn still.
	 *
	 * Wer hier eine Partei samt Vermerk abwählt, löscht den Vermerk mit; im
	 * Verlauf steht dann die Änderung des Traktandums, nicht die Angabe des
	 * Vermerks. Der Weg im Saal (`trageBetroffeneAus`) hält sie fest.
	 */
	await tx`
		DELETE FROM agenda_item_affected
		WHERE agenda_item_id = ${traktandumId} AND NOT (party_id = ANY(${parteiIds}::uuid[]))
	`;
	if (parteiIds.length === 0) return;

	const [m] = await tx<{ stweg_id: string }[]>`
		SELECT stweg_id FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');

	// Nur Parteien dieser Gemeinschaft. Der Fremdschlüssel fängt es ohnehin ab;
	// hier gibt es dafür eine Meldung, die im Saal jemand versteht.
	const eigene = await tx<{ id: string }[]>`
		SELECT id FROM party WHERE stweg_id = ${m.stweg_id} AND id = ANY(${parteiIds})
	`;
	if (eigene.length !== parteiIds.length) {
		throw new FachlicherFehler(
			'fremde_partei',
			'Als betroffen kommen nur Eigentümer dieser Gemeinschaft in Frage.',
			'betroffene'
		);
	}

	for (const parteiId of parteiIds) {
		await tx`
			INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id)
			VALUES (${traktandumId}, ${parteiId}, ${operatorId}, ${m.stweg_id})
			ON CONFLICT (agenda_item_id, party_id) DO NOTHING
		`;
	}
}

/**
 * Die gemeinsam Antragstellenden (Migration 034).
 *
 * Gebaut wie `schreibeBetroffene` und aus demselben Grund: Nur Eigentümer
 * dieser Gemeinschaft kommen in Frage. Der Fremdschlüssel fängt es ohnehin ab,
 * aber eine Datenbankmeldung ist im Saal keine Auskunft.
 */
async function schreibeAntragsteller(
	tx: postgres.TransactionSql,
	operatorId: Id,
	traktandumId: Id,
	meetingId: Id,
	parteiIds: Id[]
): Promise<void> {
	await tx`DELETE FROM agenda_item_proposer WHERE agenda_item_id = ${traktandumId}`;
	if (parteiIds.length === 0) return;

	const [m] = await tx<{ stweg_id: string }[]>`
		SELECT stweg_id FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');

	const eigene = await tx<{ id: string }[]>`
		SELECT id FROM party WHERE stweg_id = ${m.stweg_id} AND id = ANY(${parteiIds})
	`;
	if (eigene.length !== parteiIds.length) {
		throw new FachlicherFehler(
			'fremde_partei',
			'Als Antragsteller kommen nur Eigentümer dieser Gemeinschaft in Frage.',
			'antragstellerIds'
		);
	}

	for (const parteiId of parteiIds) {
		await tx`
			INSERT INTO agenda_item_proposer (agenda_item_id, party_id, operator_id, stweg_id)
			VALUES (${traktandumId}, ${parteiId}, ${operatorId}, ${m.stweg_id})
		`;
	}
}

/**
 * Verlangt, dass ein angegebener Elternteil zu **dieser** Versammlung gehört.
 *
 * Ohne Elternteil ist nichts zu prüfen: Ein Traktandum auf oberster Ebene hat
 * keinen.
 */
async function verlangeElternteilIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	parentId: Id | null
): Promise<void> {
	if (!parentId) return;
	const [g] = await tx<{ id: string }[]>`
		SELECT id FROM agenda_item WHERE id = ${parentId} AND meeting_id = ${meetingId}
	`;
	if (!g) {
		throw new FachlicherFehler(
			'fremdes_traktandum',
			'Der übergeordnete Punkt muss ein Traktandum derselben Versammlung sein.',
			'parentId'
		);
	}
}

export async function erstelleTraktandum(
	handelnder: Handelnder & { operatorId: string },
	eingabe: TraktandumEingabe,
	/*
	 * **Das Erfordernis, das gleich gewählt wird** (M-3, 07.11.2026): der
	 * Knoten aus dem Formular. Die Route ruft danach erst
	 * `setzeGewaehltesErfordernis`, in einer eigenen Transaktion; prüfte das
	 * Anlegen gar nicht, stünde das Traktandum mit Häkchen schon gespeichert,
	 * wenn die Absage am Wahlknoten käme. Hier, in derselben Transaktion wie
	 * das Anlegen, entsteht bei der Absage kein Traktandum — dieselbe Bauart
	 * wie beim Bearbeiten (G2, 06.11.2026).
	 */
	knotenIdNachDemAnlegen?: string | null
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurImEntwurf(tx, eingabe.meetingId);
		const stand = await versammlungsstand(tx, eingabe.meetingId);

		/*
		 * **Auch der Elternteil gehört zu dieser Versammlung** (Code-Review
		 * 07.09.2026). `parentId` kommt aus dem Formular; die Fremdschlüssel der
		 * Tabelle binden ihn an den Betreiber, nicht an die Versammlung
		 * (`migrations/012_traktanden.sql`). Ohne diese Zeile entstünde in
		 * Versammlung A eine Zeile, deren Elternteil in B liegt: `leseTraktanden`
		 * baut den Baum dann über einen Knoten, den es hier gar nicht gibt.
		 *
		 * `nimmTraktandumAuf` prüft das seit je. Diese Nachbarfunktion nicht, und
		 * sie war deshalb der einzige Schreibweg, den der Umbau vom 07.09.2026
		 * offen liess.
		 */
		await verlangeElternteilIn(tx, eingabe.meetingId, eingabe.parentId ?? null);

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const position = await naechstePosition(tx, eingabe.meetingId, eingabe.parentId ?? null);
		const u = legeTraktandumAn(id, handelnder.operatorId, position, eingabe);
		const t = u.ergebnis;
		await verlangeWaehlbareEigentuemer(tx, stand, t);
		// M-3 (07.11.2026): vor dem Anlegen, in derselben Transaktion; das
		// Anlegen ist nur im Entwurf möglich, deshalb die Absage je Knoten.
		verlangeKeinVerwaltungsgeschaeftAmWahlknoten(t, knotenIdNachDemAnlegen ?? null);
		await verlangeBetroffeneNachDemSpeichern(tx, stand, t, knotenIdNachDemAnlegen ?? null, null);

		await tx`
			INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
			                         item_kind, body, summary, motion_text, proposer_kind,
			                         proposer_party_id, proposer_stweg_id, proposer_name,
			                         concerns_management)
			VALUES (${t.id}, ${handelnder.operatorId}, ${t.meetingId}, ${t.parentId}, ${t.position},
			        ${t.titel}, ${t.art}, ${t.inhalt ?? null}, ${t.kurzfassung ?? null},
			        ${t.antragswortlaut ?? null}, ${t.antragstellerart},
			        ${t.antragstellerart === 'eigentuemer' ? (t.antragstellerId ?? null) : null},
			        ${t.antragstellerart === 'untergemeinschaft' ? (t.antragstellerId ?? null) : null},
			        ${t.antragstellerName ?? null}, ${t.verwaltungsGeschaeft})
		`;

		await schreibeBetroffene(
			tx,
			handelnder.operatorId,
			t.id,
			t.meetingId,
			t.betroffeneParteiIds
		);
		await schreibeAntragsteller(
			tx,
			handelnder.operatorId,
			t.id,
			t.meetingId,
			t.antragstellerIds ?? []
		);

		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Ein Traktandum lesen, **gebunden an seine Versammlung**.
 *
 * **Warum die Versammlung ein Parameter ist und kein Ergebnis**
 * (Sicherheitsdurchgang 07.09.2026). Bis dahin las diese Funktion allein über
 * die Kennung und gab die Versammlung aus der Zeile zurück; die Aufrufer
 * bekamen ihre Kennung aus dem Formular oder dem Pfad und hielten sie nie
 * gegen die Versammlung aus der Adresse. Die Betreibergrenze hielt, innerhalb
 * derselben Bewirtschaftung liess sich damit an einem Traktandum einer
 * **anderen** Versammlung arbeiten: löschen, umnummerieren, das Erfordernis
 * setzen.
 *
 * Dieselbe Bauart wie bei den Vollmachten am 06.09.2026 (`69f107c`), und
 * dieselbe Antwort: Kein Treffer heisst «gibt es nicht», nicht «gehört
 * woandershin». Wer die Versammlung erst aus der Zeile erfährt, kann sie nicht
 * mehr prüfen.
 */
async function leseEines(
	tx: postgres.TransactionSql,
	meetingId: Id,
	id: Id
): Promise<Traktandum> {
	const [z] = await tx<AgendaZeile[]>`
		SELECT * FROM agenda_item WHERE id = ${id} AND meeting_id = ${meetingId}
	`;
	if (!z) throw fremdesTraktandum('id');
	const betroffene = await tx<{ party_id: string }[]>`
		SELECT party_id FROM agenda_item_affected WHERE agenda_item_id = ${id}
	`;
	const antragsteller = await tx<{ party_id: string; display_name: string }[]>`
		SELECT ap.party_id, p.display_name
		FROM agenda_item_proposer ap
		JOIN party p ON p.id = ap.party_id
		WHERE ap.agenda_item_id = ${id}
		ORDER BY p.display_name
	`;
	return ausDb(
		z,
		betroffene.map((b) => b.party_id),
		null,
		antragsteller.map((a) => ({ id: a.party_id, name: a.display_name }))
	);
}

export async function bearbeiteTraktandum(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	eingabe: TraktandumEingabe,
	/*
	 * **Das Erfordernis, das nach dem Speichern gilt** (G2, 06.11.2026): der
	 * Knoten aus dem Formular, sonst das bisherige. Die Route ruft danach
	 * erst `setzeGewaehltesErfordernis`, in einer eigenen Transaktion; prüfte
	 * das Speichern nur gegen das bisherige Erfordernis, stünde das Häkchen
	 * schon gespeichert, wenn die Absage käme. Hier, in derselben
	 * Transaktion wie das Speichern, bleibt bei der Absage alles, wie es war.
	 */
	knotenIdNachDemSpeichern?: string | null
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Versammlung als eigener Parameter, nicht aus der Eingabe**
		 * (Code-Review 07.09.2026). `eingabe.meetingId` stünde bereit, stammt
		 * aber aus demselben Objekt, dessen übrige Felder aus dem Formular
		 * kommen. Heute füllt der einzige Aufrufer es aus der Adresse; ein
		 * zweiter, der es aus dem Formular nimmt, prüfte Formularwert gegen
		 * Formularwert, und nichts würde rot. Als Parameter erzwingt ihn der Typ
		 * bei jedem künftigen Weg, wie bei den fünf Nachbarn.
		 */
		const bisher = await leseEines(tx, meetingId, id);
		await nurImEntwurf(tx, bisher.meetingId);
		const stand = await versammlungsstand(tx, bisher.meetingId);

		const u = aendereTraktandum(bisher, eingabe);
		const t = u.ergebnis;
		await verlangeWaehlbareEigentuemer(tx, stand, t, bisher);
		verlangeKeinVerwaltungsgeschaeftAmWahlknoten(
			t,
			knotenIdNachDemSpeichern ?? bisher.erfordernis?.knotenId ?? null
		);
		await verlangeBetroffeneNachDemSpeichern(tx, stand, t, knotenIdNachDemSpeichern ?? null, bisher);

		await tx`
			UPDATE agenda_item SET
				title = ${t.titel},
				item_kind = ${t.art},
				body = ${t.inhalt ?? null},
				summary = ${t.kurzfassung ?? null},
				motion_text = ${t.antragswortlaut ?? null},
				proposer_kind = ${t.antragstellerart},
				proposer_party_id = ${t.antragstellerart === 'eigentuemer' ? (t.antragstellerId ?? null) : null},
				proposer_stweg_id = ${t.antragstellerart === 'untergemeinschaft' ? (t.antragstellerId ?? null) : null},
				proposer_name = ${t.antragstellerName ?? null},
				concerns_management = ${t.verwaltungsGeschaeft},
				copied_from_meeting_id = NULL,
				requirement_type = CASE WHEN ${t.art} = 'kenntnisnahme' THEN NULL ELSE requirement_type END,
				-- Ohne Erfordernis keine Lesart (Migration 169).
				requirement_reading = CASE WHEN ${t.art} = 'kenntnisnahme' THEN NULL ELSE requirement_reading END,
				requirement_statutory = CASE WHEN ${t.art} = 'kenntnisnahme' THEN NULL ELSE requirement_statutory END,
				requirement_reading_reconsidered = CASE WHEN ${t.art} = 'kenntnisnahme' THEN NULL ELSE requirement_reading_reconsidered END,
				-- Ohne Erfordernis keine Karte, also kein Satz zum Häkchen (Migration 198).
				requirement_rule_secured = CASE WHEN ${t.art} = 'kenntnisnahme' THEN NULL ELSE requirement_rule_secured END
			WHERE id = ${id}
		`;

		await schreibeBetroffene(tx, handelnder.operatorId, id, t.meetingId, t.betroffeneParteiIds);
		/*
		 * **Ein neuer Wortlaut nimmt die Vorab-Zustimmungen mit** (Fachprüfung
		 * 25.09.2026, Block A2, V1-1). Eine schriftliche Zustimmung gilt dem
		 * Antrag, dem sie erteilt wurde (SVIT-Kommentar 2023, Art. 712g Rz. 209
		 * bis 211). Vermerkt wird ab der Freigabe; nach deren Rücknahme lässt sich
		 * der Wortlaut hier ändern, und der Vermerk stünde sonst unter einem
		 * Antrag, dem niemand zugestimmt hat. Die Änderung des Traktandums steht
		 * im Verlauf; die Leitung vermerkt nach neuer Zustimmung neu.
		 */
		if ((bisher.antragswortlaut ?? '').trim() !== (t.antragswortlaut ?? '').trim()) {
			await loescheVorabvermerkeNachNeuemWortlaut(tx, handelnder, id, t.titel);
		}
		await schreibeAntragsteller(
			tx,
			handelnder.operatorId,
			id,
			t.meetingId,
			t.antragstellerIds ?? []
		);

		return schreibeUebergang(tx, handelnder, u);
	});
}

export async function loescheTraktandum(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const t = await leseEines(tx, meetingId, id);
		await nurImEntwurf(tx, t.meetingId);

		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM agenda_item WHERE parent_id = ${id}
		`;

		// Bei einem festen Traktandum wird der Hinweis mitgeschrieben. Die
		// Zuordnung geschieht über den Titel: Die Vorlagenkennung steht nicht an
		// der Zeile, weil sie sich mit dem ersten Bearbeiten überlebt hätte.
		const vorlage = t.ausVorlage
			? [...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE].find((x) => x.titel === t.titel)
			: undefined;
		// Wirft bei Untertraktanden, bevor etwas gelöscht ist.
		entferneTraktandum(t, Number(anzahl));

		await tx`DELETE FROM agenda_item WHERE id = ${id}`;
		const reste = await raeumeTraktandenAb(tx, [id]);
		const u = entferneTraktandum(
			t,
			Number(anzahl),
			vorlage ? entfernungshinweis(vorlage.schluessel) : null,
			reste.get(id)
		);
		await schreibeVerlauf(tx, handelnder, u.ereignisse);
	});
}

export async function setzeNummer(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	nummer: string
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const t = await leseEines(tx, meetingId, id);
		await nurImEntwurf(tx, t.meetingId);
		const geprueft = pruefeNummer(nummer);
		await tx`UPDATE agenda_item SET manual_number = ${geprueft} WHERE id = ${id}`;
		await schreibeVerlauf(tx, handelnder, [
			{
				art: 'agenda.item.updated',
				gegenstandArt: 'agenda_item',
				gegenstandId: id,
				angaben: { felder: { nummerManuell: { vorher: t.nummerManuell, nachher: geprueft } } }
			}
		]);
	});
}

/**
 * Verschiebt ein Traktandum im Baum.
 *
 * Beim Umsortieren durchläuft die Liste zwangsläufig Zwischenstände, in denen
 * zwei Zeilen dieselbe Stelle beanspruchen. Die Eindeutigkeitsbedingung wird
 * deshalb für diese Transaktion aufgeschoben und gilt erst beim Commit — also
 * genau dann, wenn die Liste wieder stimmen muss. Der sonst übliche Kniff, die
 * Zeilen über Hilfswerte herumzuschieben, hinterliesse bei einem Abbruch einen
 * Zustand, den niemand vorgesehen hat.
 */
export async function verschiebeTraktandum(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	v: Verschiebung
): Promise<NummerierterKnoten<Traktandum>[]> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// **Verschieben bleibt während der Sitzung möglich** (Story 5.11, FR-14).
		// Anders als der Inhalt: Titel und Antragswortlaut stehen in versandten
		// Einladungen und sind deshalb ab der Freigabe festgeschrieben. Die
		// Reihenfolge steht dort nicht als Zusage, sondern als Vorschlag — sie zu
		// ändern ist ein Ordnungsentscheid der Versammlung, und der gehört in den
		// Verlauf, nicht in eine Sperre. Wer ihn verbietet, zwingt die
		// Sitzungsleitung dazu, ihn ohne Spur zu treffen.
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand(
			{ zustand: m.state as never },
			['entwurf', 'freigegeben', 'laufend'],
			'in der Reihenfolge ändern'
		);

		const nummeriert = await leseTraktanden(tx, meetingId);
		const vorher = nummeriert.map((n) => n.knoten);

		/*
		 * **Ein Folgeantrag bleibt unter seinem Traktandum** (Codeprüfung 3 vom
		 * 06.10.2026). Nach dessen Ankündigung richtet sich, ob er zulässig ist,
		 * und in dieser Anwendung, welches Mehr er mindestens braucht
		 * (Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»;
		 * `untergrenzeUeberVorfahren`). Unter einem anderen Elternteil hielte er
		 * dessen Untergrenze statt seiner eigenen. Die Reihenfolge unter demselben
		 * Elternteil bleibt frei. Der Ausweg nach Laien- und Fachprüfung Runde 3
		 * vom 06.10.2026 (FP3-12,
		 * `quellen/pruefung/zu-pruefen-2026-10-06-votum-einladungsmehr-folgeantrag-runde3.md`;
		 * Ort nach Runde 4, damit der Satz auch auf der Traktandenseite stimmt):
		 * mit «Antrag zurückziehen» oder «Jetzt möglich» und dem Grund
		 * «falsch zugeordnet» festhalten und beim richtigen neu aufnehmen, sofern
		 * er sich in dessen Kern hält und darüber noch nicht abgestimmt ist.
		 */
		const bewegt = vorher.find((k) => k.id === v.id);
		if (bewegt?.spontanart === 'folgeantrag' && (bewegt.parentId ?? null) !== v.neuerElternteil) {
			throw new FachlicherFehler(
				'folgeantrag_bleibt_beim_traktandum',
				'Ein Folgeantrag bleibt unter dem Traktandum, zu dem er gestellt wurde. Nach dessen ' +
					'Ankündigung richtet sich, ob er zulässig ist, und in dieser Anwendung, welches Mehr ' +
					'er mindestens braucht. Hängt er am falschen Traktandum, halten Sie das mit dem Grund ' +
					'«falsch zugeordnet» fest. Das geht in der Leitung der Versammlung mit «Antrag ' +
					'zurückziehen» in seiner Zeile oder, wenn er gerade aufgerufen ist, unter «Jetzt ' +
					'möglich» bei «Zurückziehen». Beim richtigen nehmen Sie ihn ' +
					'neu auf, sofern er sich im Kern dieses Traktandums hält und darüber noch nicht ' +
					'abgestimmt ist.',
				'elternteil'
			);
		}

		/*
		 * **Nicht in die Vergangenheit schieben** (21.08.2026). Nur während der
		 * Sitzung: Im Entwurf und nach der Freigabe ist noch nichts behandelt, und
		 * die Abfrage wäre umsonst.
		 */
		if (m.state === 'laufend') {
			const behandelt = new Set(
				(
					// Auch ein über einen Folgeantrag ersetzter Beschluss (Migration 133).
					await tx<{ agenda_item_id: string }[]>`
						SELECT DISTINCT agenda_item_id FROM voting_round
						 WHERE meeting_id = ${meetingId} AND superseded_at IS NULL
						UNION
						SELECT id FROM agenda_item
						 WHERE meeting_id = ${meetingId} AND durch_anderes_traktandum_ersetzt(id)
					`
				).map((z) => z.agenda_item_id)
			);
			const [aktuell] = await tx<{ current_agenda_item_id: string | null }[]>`
				SELECT current_agenda_item_id FROM meeting WHERE id = ${meetingId}
			`;
			const laufend = aktuell?.current_agenda_item_id ?? null;

			const lage = (id: Id) => ({
				id,
				behandelt: behandelt.has(id),
				aufgerufen: id === laufend,
				nummer: nummeriert.find((n) => n.knoten.id === id)?.nummer ?? '?'
			});

			verlangeVorwaertsgerichtet({
				geschwister: nummeriert
					.filter(
						(n) => (n.knoten.parentId ?? null) === v.neuerElternteil && n.knoten.id !== v.id
					)
					.map((n) => lage(n.knoten.id)),
				stelle: v.stelle,
				bewegt: lage(v.id)
			});
		}

		const u = ordneUm(meetingId, vorher, v);

		const alt = new Map(vorher.map((k) => [k.id, k]));
		const geaendert = u.ergebnis.filter((k) => {
			const a = alt.get(k.id);
			return a && (a.parentId !== k.parentId || a.position !== k.position);
		});

		if (geaendert.length > 0) {
			await tx`SET CONSTRAINTS agenda_position_je_elternteil DEFERRED`;
			// In Kennungsfolge, wie `schliesseVersammlung` sperrt (Codeprüfung F6):
			// In Positionsfolge hielte das Umordnen ein Traktandum, auf das der
			// Schluss wartet, und wartete selbst auf eines, das der Schluss schon
			// hält. Die Reihenfolge der Anweisungen ändert am Ergebnis nichts, die
			// Positionsschranke ist bis zum Festschreiben aufgeschoben.
			for (const k of [...geaendert].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
				await tx`
					UPDATE agenda_item SET parent_id = ${k.parentId}, position = ${k.position}
					WHERE id = ${k.id}
				`;
			}
		}

		await schreibeVerlauf(tx, handelnder, u.ereignisse);
		return leseTraktanden(tx, meetingId);
	});
}

/**
 * Nimmt ein Traktandum während der laufenden Versammlung auf (Story 5.11, FR-14).
 *
 * Es wird als **Spontantraktandum** gekennzeichnet, und das ist keine Formalie:
 * In der Liste sähe es sonst aus wie jedes andere, und ein Jahr später liesse
 * sich nicht mehr sagen, welcher Fall vorlag.
 *
 * Zwei Fälle, seit Migration 031 getrennt und seit 032 ungleich behandelt:
 *
 *   - **Folgeantrag** — hält sich im Kern des angekündigten Grundantrags, unter
 *     dem er hängt. Darüber darf abgestimmt werden: Angekündigt sein muss der
 *     Gegenstand, nicht jeder Antrag dazu.
 *   - **Neues Geschäft** — nicht angekündigt. Darüber wird nur beschlossen,
 *     wenn das Reglement es ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m.
 *     Art. 712m Abs. 2, Migration 127) oder die Versammlung als
 *     Universalversammlung tagt (Migration 128); sonst kann es nur als
 *     Kenntnisnahme auf die Liste.
 *
 * Die zweite Schranke steht hier und nicht erst bei der Freigabe. Bei der
 * Freigabe wäre sie zwar auch wirksam, käme aber zu spät: Dann steht der Antrag
 * bereits in der Liste, auf dem Beamer und in den Köpfen, und die Absage träfe
 * eine Versammlung, die sich schon auf den Beschluss eingestellt hat.
 */
export async function nimmTraktandumAuf(
	handelnder: Handelnder & { operatorId: string },
	eingabe: TraktandumEingabe,
	spontanart: Spontanart = 'neu'
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<
			{ state: string; stweg_id: string; meeting_date: Date; meeting_day_id: string | null }[]
		>`
			SELECT state, stweg_id, meeting_date, meeting_day_id FROM meeting WHERE id = ${eingabe.meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand({ zustand: m.state as never }, ['laufend'], 'als Spontantraktandum aufnehmen');

		/*
		 * **Ein neues Geschäft zur Abstimmung nur mit einer Ausnahme** (Migration
		 * 127). Bis zum 29.09.2026 hiess es hier, darüber könne «auch nicht, wenn
		 * die Versammlung einverstanden ist» beschlossen werden. Das Gesetz
		 * enthält dieses Verbot nicht (Fachprüfung 29.09.2026, Befund D).
		 * Gelesen wird die Momentaufnahme: Es gilt, was bei der Freigabe stand.
		 */
		let ausnahme: Ausnahmegrund | null = null;
		if (spontanart === 'neu' && eingabe.art === 'abstimmung') {
			/*
			 * **Zuerst das Reglement, dann die Universalversammlung** (Migration
			 * 128). Gestattet das Reglement es, trägt das den Beschluss auch dann,
			 * wenn später jemand geht oder widerspricht (Fachprüfung Runde 2 zu
			 * 5c: «Greift zugleich (a), entsteht der Beschluss über (a)»). Die
			 * Universalversammlung nur, wenn sie im Moment vollzählig ist; ob sie
			 * es beim Eröffnen noch ist, prüft `pruefeDurchgangsfreigabe`.
			 */
			const lage = await leseUniversallage(tx, eingabe.meetingId);
			const e = lage?.einstellung;
			if (!m.meeting_day_id && e?.reglementGestattet) {
				ausnahme = 'reglement';
			} else if (!m.meeting_day_id && lage?.befund.vollzaehlig) {
				ausnahme = 'universal';
			} else {
				const gruende = m.meeting_day_id
					? [NICHT_ANGEKUENDIGT_AM_ABEND]
					: [
							'Beides liegt im Moment nicht vor.',
							NICHT_ANGEKUENDIGT_OHNE_REGLEMENT,
							...(lage
								? universalgruende({
										variante: lage.einstellung.universalvariante,
										befund: lage.befund,
										bestaetigt: true
									})
								: [])
						];
				throw new FachlicherFehler(
					'nicht_angekuendigt',
					`${NICHT_ANGEKUENDIGT_GRUNDSATZ} ${gruende.join(' ')} ${NICHT_ANGEKUENDIGT_WEGE}`,
					'art'
				);
			}
		}

		// Ein Folgeantrag ohne Grundantrag ist keiner. Die Prüfung steht hier und
		// nicht erst bei der Freigabe: Dort ist die Versammlung schon im Gang und
		// der Antrag längst aufgerufen — die Meldung käme im ungünstigsten Moment.
		// Entscheid 5 (06.11.2026): Folge- und Gegenantrag erben das Häkchen vom
		// Grundantrag; die Lesung steht hier, weil nur dieser Zweig einen hat.
		let verwaltungsGeschaeftDesGrundantrags = false;
		if (spontanart === 'folgeantrag') {
			if (!eingabe.parentId) {
				throw new FachlicherFehler(
					'ohne_grundantrag',
					'Ein Folgeantrag braucht den angekündigten Antrag, in dessen Kern er liegt. ' +
						'Wählen Sie ihn aus — oder nehmen Sie das Geschäft als neues auf.',
					'grundantrag'
				);
			}
			const [g] = await tx<
				{ is_spontaneous: boolean; item_kind: string; withdrawn_at: Date | null; concerns_management: boolean }[]
			>`
				SELECT is_spontaneous, item_kind, withdrawn_at, concerns_management FROM agenda_item
				WHERE id = ${eingabe.parentId} AND meeting_id = ${eingabe.meetingId}
			`;
			if (!g) {
				throw new FachlicherFehler(
					'fremdes_traktandum',
					'Der Grundantrag muss ein Traktandum derselben Versammlung sein.',
					'grundantrag'
				);
			}
			verwaltungsGeschaeftDesGrundantrags = g.concerns_management;
			/*
			 * **Der massgebende Durchgang, nicht irgendeiner** (Code-Review
			 * 07.09.2026). Die erste Fassung fragte nach «irgendein geschlossener,
			 * nicht überholter Durchgang». Zwischen einem angenommenen Rückkommen
			 * und dem Schliessen des zweiten Durchgangs stehen beide nebeneinander:
			 * der alte geschlossen, der neue offen, keiner überholt — überholt wird
			 * der alte erst beim Schliessen des neuen. Der Server hätte dort
			 * abgewiesen, während die Seite den Antrag anbot, weil sie über
			 * `massgebender` rechnet. Genau der Widerspruch, den dieser Block
			 * beseitigen soll.
			 *
			 * `ORDER BY ordinal DESC LIMIT 1` über die nicht überholten ist
			 * `massgebender` in SQL. Seit Migration 133 über
			 * `massgebender_durchgang`: Hat ein Folgeantrag den Beschluss nach
			 * einem Rückkommen ersetzt, liegt der massgebende Durchgang dort, und
			 * der Grundantrag bleibt entschieden (Plan Folgeantrag nach
			 * Rückkommen, Ist 4).
			 */
			const [durchgang] = await tx<{ state: string; consultative: boolean }[]>`
				SELECT state, consultative FROM voting_round
				WHERE id = massgebender_durchgang(${eingabe.parentId})
			`;
			/*
			 * **Die Regel wird gelesen, nicht abgeschrieben** (Code-Review
			 * 07.09.2026). Sie stand hier als vier eigene Prüfungen mit eigenen
			 * Sätzen neben derselben Regel im Kern — und die beiden Abschriften
			 * waren beim ersten Anlauf schon auseinander.
			 */
			const hindernis = hindernisAlsGrundantrag({
				// Was nicht «abstimmung» heisst, ist eine Kenntnisnahme: die
				// vorsichtigere der beiden Antworten, wie im Aufnahmeformular.
				art: g.item_kind === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme',
				spontan: g.is_spontaneous,
				// Nach einer konsultativen Abstimmung ist nichts entschieden
				// (Migration 158; Codeprüfung 14.10.2026, M4): Die Absage nennte
				// sonst das Rückkommen, und das gibt es dort nicht. Wie beim
				// Eröffnen (`leseMassgebendenDerSache`).
				entschieden: durchgang?.state === 'geschlossen' && !durchgang.consultative,
				durchgangOffen: durchgang?.state === 'offen',
				zurueckgezogen: g.withdrawn_at != null,
				// Dieselbe Abfrage wie beim Eröffnen (`rueckkommenZuEroeffnen`).
				rueckkommenOffen:
					durchgang?.state === 'geschlossen' &&
					(await rueckkommenOffenIn(tx, eingabe.meetingId, eingabe.parentId))
			});
			if (hindernis) {
				throw new FachlicherFehler(hindernis.code, hindernis.meldung, 'grundantrag');
			}
		}

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const position = await naechstePosition(tx, eingabe.meetingId, eingabe.parentId ?? null);
		// Entscheid 5 (06.11.2026): Das Häkchen kommt vom Grundantrag, nicht
		// aus dem Formular — der Saal fragt es nicht. Über die Eingabe und nicht
		// direkt in die Zeile, damit der Kern es normalisiert: An einer
		// Kenntnisnahme ruhen keine Vollmachten, und das geerbte Häkchen wäre
		// eine Angabe ohne Wirkung.
		const u = legeTraktandumAn(id, handelnder.operatorId, position, {
			...eingabe,
			verwaltungsGeschaeft: verwaltungsGeschaeftDesGrundantrags
		});
		const t = u.ergebnis;
		await verlangeWaehlbareEigentuemer(
			tx,
			{ stwegId: m.stweg_id, datum: kalendertag(m.meeting_date) },
			t
		);

		await tx`
			INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
			                         item_kind, body, summary, motion_text, proposer_kind,
			                         proposer_party_id, proposer_stweg_id, proposer_name,
			                         is_spontaneous, spontaneous_kind, approved_by_item_id,
			                         added_during_meeting_at, unannounced_basis, concerns_management)
			VALUES (${t.id}, ${handelnder.operatorId}, ${t.meetingId}, ${t.parentId}, ${t.position},
			        ${t.titel}, ${t.art}, ${t.inhalt ?? null}, ${t.kurzfassung ?? null},
			        ${t.antragswortlaut ?? null}, ${t.antragstellerart},
			        ${t.antragstellerart === 'eigentuemer' ? (t.antragstellerId ?? null) : null},
			        ${t.antragstellerart === 'untergemeinschaft' ? (t.antragstellerId ?? null) : null},
			        ${t.antragstellerName ?? null},
			        true, ${spontanart}, NULL, now(), ${ausnahme}, ${t.verwaltungsGeschaeft})
		`;

		/*
		 * **Auch der im Saal aufgenommene Antrag kann mehrere Antragsteller
		 * haben** (21.08.2026). Die Tabelle gibt es seit Migration 034; gefüllt
		 * wurde sie bisher nur beim Erfassen im Entwurf und beim Ändern — der
		 * Gegenantrag im Saal ging leer aus, obwohl gerade dort mehrere
		 * gemeinsam auftreten.
		 */
		await schreibeAntragsteller(
			tx,
			handelnder.operatorId,
			t.id,
			t.meetingId,
			t.antragstellerIds ?? []
		);

		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Die Traktandenliste als vollständig bestätigen (Migration 033).
 *
 * **Warum das nicht hergeleitet werden kann.** Das Anlegen einer Versammlung
 * setzt die Pflichttraktanden selbst; «es liegt ein Traktandum vor» sagt
 * deshalb nichts darüber, ob jemand die Liste je gesehen hat. Und was fehlt,
 * weiss nur die Bewirtschaftung: Die Vorlage kennt die Jahresgeschäfte, aber
 * kein einmaliges Bauvorhaben.
 *
 * Der Vermerk ist deshalb eine Erklärung, keine Rechnung — und darum jederzeit
 * zurückzunehmen, solange die Versammlung im Entwurf ist. Mit der Freigabe wird
 * die Liste ohnehin gesperrt.
 */
export async function bestaetigeTraktandenliste(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurImEntwurf(tx, meetingId);

		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM agenda_item WHERE meeting_id = ${meetingId}
		`;
		if (anzahl === 0) {
			throw new FachlicherFehler(
				'leere_liste',
				'Eine leere Traktandenliste lässt sich nicht bestätigen. Erfassen Sie zuerst die ' +
					'Geschäfte der Versammlung.',
				'traktanden'
			);
		}

		await tx`UPDATE meeting SET agenda_confirmed_at = now() WHERE id = ${meetingId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.traktandenlisteBestaetigt, { art: 'meeting', id: meetingId }, { anzahl })
		);
	});
}

/** Die Bestätigung zurücknehmen — die Liste ist doch noch nicht fertig. */
export async function oeffneTraktandenlisteWieder(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurImEntwurf(tx, meetingId);
		await tx`UPDATE meeting SET agenda_confirmed_at = NULL WHERE id = ${meetingId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.traktandenlisteWiedergeoeffnet, { art: 'meeting', id: meetingId })
		);
	});
}

/**
 * Ob das Mehrheitserfordernis noch gesetzt werden darf.
 *
 * **Nicht dieselbe Sperre wie beim Inhalt.** Titel und Antragswortlaut stehen
 * nach der Freigabe in versandten Einladungen und sind deshalb festgeschrieben.
 * Das Erfordernis ist etwas anderes: Es ist die rechtliche Einschätzung der
 * Sitzungsleitung, und sie wird regelmässig erst im Saal getroffen: bei einem
 * Spontantraktandum ohnehin, aber auch dann, wenn eine Wortmeldung zeigt, dass
 * das Vorhaben doch nützlich und nicht notwendig ist. Wäre sie mit der Freigabe
 * gesperrt, könnte die Sitzungsleitung eine abgewiesene Abstimmung nicht mehr
 * freigeben, und der Hinweis «bestimmen Sie es über den Entscheidbaum» ginge
 * ins Leere.
 *
 * **Die Einladung nennt das Mehr aber** (seit 22.08.2026, `fusszeileZu`). Hier
 * stand bis zum 06.10.2026, sie tue es nicht. Deshalb gilt seither eine zweite
 * Schranke neben dieser: Im Saal darf das Mehr nicht milder werden als das der
 * Einladung (`achteEinladungsmehr`, Produktentscheid 27.09.2026). Diese Funktion
 * bleibt bei der Frage, ob überhaupt noch gesetzt werden darf.
 *
 * Gesperrt wird sie erst, wenn dazu **abgestimmt** wurde und der Durchgang
 * gilt: Dann stünde am Traktandum eine andere Regel als die, nach der gezählt
 * wurde.
 *
 * **Wieder frei nach einem angenommenen Rückkommen** (H6). Bis dahin hiess der
 * Weg Neuabstimmung: Sie überholte den Durchgang, und die Sperre fiel. Seit die
 * Leitung kein verkündetes Ergebnis mehr überholt, führt er über das
 * Rückkommen, und bis zur erneuten Abstimmung bleibt der frühere Durchgang
 * stehen; ohne diese Ausnahme liefe sie unter dem Erfordernis, das falsch war.
 * Am Gezählten ändert das nichts: Jeder Durchgang trägt sein Erfordernis seit
 * dem Eröffnen selbst (AD-4), und Protokoll und Auswertung lesen es dort.
 * Freigegeben wird nur, solange der Rückkommensbeschluss seinen Durchgang
 * noch nicht getragen hat (`rueckkommenOffenIn`).
 *
 * **Nur, wenn es das Ergebnis geändert hätte** (Fachprüfung 14.10.2026, F-2).
 * Anfechtbar ist ein Verfahrensfehler, der das Ergebnis beeinflussen konnte
 * (BGE 132 III 503 E. 5.3, über Art. 712m Abs. 2). Ein unnötiges Rückkommen
 * kann dagegen einen tragfähigen Beschluss kosten: Nach «Nein heisst Nein»
 * hebt auch eine neue Ablehnung den alten auf.
 */
export const ERFORDERNIS_NACH_DER_ABSTIMMUNG =
	'Über dieses Traktandum ist bereits abgestimmt. Am Traktandum stünde sonst eine andere ' +
	'Regel als die, nach der gezählt wurde. War das Erfordernis falsch und hätte das Ergebnis ' +
	'nach dem richtigen anders gelautet, beantragen Sie das Rückkommen; ist es angenommen, ' +
	'lässt sich das Erfordernis für die erneute Abstimmung berichtigen.';

async function erfordernisAenderbar(
	tx: postgres.TransactionSql,
	meetingId: Id,
	traktandumId: Id
): Promise<void> {
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	if (['geschlossen', 'versiegelt'].includes(m.state)) {
		throw new FachlicherFehler(
			'geschlossen',
			'Die Versammlung ist geschlossen. Das Mehrheitserfordernis steht damit fest.',
			'zustand'
		);
	}

	// Auch ein über einen Folgeantrag ersetzter Beschluss (Migration 133): Er
	// ist nach der Regel dieses Traktandums gezählt worden.
	//
	// Nicht ein konsultativer Durchgang (Produktentscheid 14.10.2026, H7 Teil
	// D): Er hat nichts entschieden, und ein Rückkommen, das die Absage nennt,
	// gibt es dort nicht. Sein Erfordernis trägt er seit dem Eröffnen selbst;
	// der nächste Durchgang nimmt das dann geltende (`entscheidetDasGeschaeft`).
	const [d] = await tx<{ anzahl: number }[]>`
		SELECT (SELECT count(*)::int FROM voting_round
		         WHERE agenda_item_id = ${traktandumId}
		           AND state = 'geschlossen' AND superseded_at IS NULL
		           AND NOT consultative)
		     + durch_anderes_traktandum_ersetzt(${traktandumId})::int AS anzahl
	`;
	if (Number(d?.anzahl ?? 0) > 0 && !(await rueckkommenOffenIn(tx, meetingId, traktandumId))) {
		throw new FachlicherFehler('schon_abgestimmt', ERFORDERNIS_NACH_DER_ABSTIMMUNG, 'erfordernis');
	}
}

export async function haltErfordernisAmTraktandumFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	e: Erfordernis,
	/*
	 * **Was der Übergang zum Erfordernis sonst noch festhält** (Durchstich
	 * 30.09.2026). `uebersteuere()` liefert neben dem Erfordernis das Ereignis
	 * `requirement.overridden` mit Vorschlag, übergangener Grundlage,
	 * Begründung und Risiko. Die Route gab bis dahin nur das Erfordernis
	 * weiter, und das Ereignis ging verloren: Auf Dev stand es kein einziges
	 * Mal im Verlauf, obwohl seit 96eb4b5 allein es die Herkunft trägt.
	 */
	begleitend: Ereignis[] = []
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const t = await leseEines(tx, meetingId, id);
		await erfordernisAenderbar(tx, t.meetingId, id);
		await achteEinladungsmehr(tx, handelnder, id, e);
		// L8 (Migration 184): Die Gegenrichtung zur Prüfung beim Speichern des
		// Traktandums — das Häkchen steht schon, und das Erfordernis käme auf
		// einen Knoten, an dem die Vollmachten nicht ruhen. Die Prüfung liest
		// den Zustand der Versammlung mit und nennt je Lage die Absage (G1,
		// M6, 06.11.2026): im Entwurf je Knoten, nach der Freigabe die eigene.
		await verlangeKeinVerwaltungsgeschaeftAmWahlknotenIn(tx, id, e.knotenId);

		await schreibeVerlauf(
			tx,
			handelnder,
			begleitend.map((b) => ({
				...b,
				gegenstandArt: b.gegenstandArt ?? 'agenda_item',
				gegenstandId: b.gegenstandId ?? id,
				angaben: { traktandum: t.titel, ...b.angaben }
			}))
		);

		const u = setzeTraktandumErfordernis(t, e);

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
				-- Das Häkchen zum Satz an der Karte (Migration 198), wo wendeReglementAn es setzt.
				requirement_rule_secured = ${e.regelGesichert ?? null},
				requirement_path = ${tx.json(e.pfad as never)},
				copied_from_meeting_id = NULL
			WHERE id = ${id}
		`;

		return schreibeUebergang(tx, handelnder, u);
	});
}

/** Ob die Traktanden noch geändert werden dürfen. */
export async function traktandenAenderbar(operatorId: Id, meetingId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		return m ? istImEntwurf({ zustand: m.state as never }) : false;
	});
}

/**
 * Ein unmittelbar gewähltes Erfordernis am Traktandum festhalten.
 *
 * Der kurze Weg neben dem Entscheidbaum, gewünscht am 02.08.2026. Drei Dinge
 * stecken darin, und alle drei sind nötig:
 *
 *   1. **Leere Auswahl heisst «nichts tun».** Wer nur den Titel ändert, darf
 *      nicht nebenbei den Pfad einer Herleitung, die Begründung einer
 *      Abweichung oder die Fundstelle aus dem Reglement verlieren.
 *   2. **Derselbe Knoten heisst ebenfalls «nichts tun».** Sonst schriebe jedes
 *      Speichern die Quelle auf «gewählt» um, obwohl niemand etwas gewählt hat.
 *   3. **Das Reglement geht vor.** Dieselbe Anwendung wie im Entscheidbaum —
 *      ohne sie liesse sich die Regel der Gemeinschaft dadurch umgehen, dass
 *      man das Erfordernis im Traktandumformular statt dort setzt.
 *
 * Steht hier und nicht in einer Route, weil zwei Formulare sie brauchen: die
 * Traktandenliste in der Vorbereitung und der Folgeantrag im Saal.
 */
/**
 * **Versammlung und Gemeinschaft als benanntes Paar** (Code-Review
 * 07.09.2026). Beide sind `Id`, also derselbe TypeScript-Typ; nebeneinander in
 * der Argumentliste liesse sich ihre Vertauschung fehlerfrei übersetzen. Zur
 * Laufzeit suchte der Leser das Traktandum dann unter der Gemeinschaftskennung
 * und meldete «Traktandum nicht gefunden», während die Reglementsregeln unter
 * einer Versammlungskennung gesucht würden: eine Absage, die zwei Parameter
 * neben der Ursache steht. In einer Funktion, deren Zweck die Unterscheidung
 * zweier Kennungen ist, ist das mehr als Geschmack.
 */
export async function setzeGewaehltesErfordernis(
	handelnder: Handelnder & { operatorId: string },
	wo: { meetingId: Id; stwegId: Id },
	traktandumId: Id,
	knotenId: string,
	bisher: string | null
): Promise<void> {
	if (!knotenId || knotenId === bisher) return;

	await haltErfordernisAmTraktandumFest(
		handelnder,
		wo.meetingId,
		traktandumId,
		await erfordernisAmHaus(handelnder.operatorId, wo, knotenId)
	);
}

/** Was eine Gemeinschaft an Regeln und Lesarten über ein Mehr legt. */
async function hausregeln(operatorId: Id, wo: { meetingId: Id; stwegId: Id }) {
	const [regeln, enthaltung, lesarten] = await Promise.all([
		holeReglementsregeln(operatorId, wo.stwegId),
		holeEnthaltungseinstellung(operatorId, wo.stwegId),
		holeLesarten(operatorId, { meetingId: wo.meetingId })
	]);
	return { regeln, enthaltung, lesarten };
}

/**
 * Das Erfordernis eines Knotens, wie es an diesem Haus gilt: mit hinterlegter
 * Regel und Lesart der Gemeinschaft, für diese Versammlung (vor der Freigabe
 * aus der Gemeinschaft, danach eingefroren). Dasselbe, was
 * `setzeGewaehltesErfordernis` schreibt.
 *
 * **Eine Stelle für alle, die mit dem Mehr eines Knotens vergleichen** (Rest
 * aus Lesarten Block 1, Codeprüfung zum Review DeepSeek, Befund 7). Der
 * Folgeantrag und der KI-Vorschlag verglichen mit dem Typ des Knotens, also mit
 * der Vorgabe und ohne Reglement. Mit L4 «qualifiziert» warnte der Folgeantrag
 * «schwächer», wo beide gleich waren.
 */
export async function erfordernisAmHaus(
	operatorId: Id,
	wo: { meetingId: Id; stwegId: Id },
	knotenId: string
): Promise<Erfordernis> {
	return alsBetreiber(operatorId, (tx) => erfordernisAmHausIn(tx, wo, knotenId));
}

/**
 * `erfordernisAmHaus` in einer laufenden Transaktion: für das
 * Traktandenformular, das vor dem Speichern wissen muss, ob das Mehr nach dem
 * Speichern Betroffene kennt (`verlangeBetroffeneAmMehr`).
 */
async function erfordernisAmHausIn(
	tx: postgres.TransactionSql,
	wo: { meetingId: Id; stwegId: Id },
	knotenId: string
): Promise<Erfordernis> {
	const gewaehlt = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
	return wendeReglementAn(
		gewaehlt,
		await leseReglementsregeln(tx, wo.stwegId),
		await holeEnthaltungseinstellungIn(tx, wo.stwegId),
		await holeLesartenIn(tx, { meetingId: wo.meetingId })
	).erfordernis;
}

/**
 * Die Regeln dieses Hauses auf ein Erfordernis angewandt, das auf der
 * Erfordernisseite für dieses Traktandum hergeleitet wird: Anzeige der Karte und
 * die drei Aktionen, die es festhalten (`uebernehmen`, `kifolgen`, der Vorschlag
 * in `setzen`). Eine Stelle für alle vier, damit Karte und gespeichertes
 * Erfordernis dasselbe sagen.
 *
 * **Nach der Freigabe mit dem Häkchen von damals** (Migration 198; Entscheid des
 * Auftraggebers vom 18.11.2026, «Auch Häkchen einfrieren»): Wo das Häkchen nur
 * den Satz an der Karte ändert, nimmt `wendeReglementAnNachFreigabe` es vom
 * gespeicherten Erfordernis statt von der Regel. Vor der Freigabe gilt das
 * Häkchen der Gemeinschaft, wie die Lesarten (Migration 169).
 */
export async function regelanwendungAmTraktandum(
	operatorId: Id,
	wo: { meetingId: Id; stwegId: Id },
	traktandumId: Id,
	hergeleitet: Erfordernis
): Promise<Regelanwendung> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<
			{
				meeting_state: string;
				requirement_node: string | null;
				requirement_source: string | null;
				requirement_reference: string | null;
				requirement_rule_secured: boolean | null;
			}[]
		>`
			SELECT m.state AS meeting_state, a.requirement_node, a.requirement_source,
			       a.requirement_reference, a.requirement_rule_secured
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE a.id = ${traktandumId} AND a.meeting_id = ${wo.meetingId}
		`;
		return wendeReglementAnNachFreigabe(
			hergeleitet,
			await leseReglementsregeln(tx, wo.stwegId),
			await holeEnthaltungseinstellungIn(tx, wo.stwegId),
			await holeLesartenIn(tx, { meetingId: wo.meetingId }),
			z ? gespeichertNachFreigabe(z) : null
		);
	});
}

/**
 * Die wählbaren Erfordernisse mit dem Typ, der an diesem Haus gilt, für die
 * Auswahl im Saal und den Vergleich mit dem Grundantrag (`erfordernisabweichung`).
 * Die Beschriftung `kurz` bleibt die des Knotens; sie nennt beide Lesarten.
 */
export async function waehlbareErfordernisseAmHaus(
	operatorId: Id,
	wo: { meetingId: Id; stwegId: Id }
): Promise<Erfordernisauswahl[]> {
	const rw = holeRegelwerk();
	const { regeln, enthaltung, lesarten } = await hausregeln(operatorId, wo);
	return waehlbareErfordernisse(rw).map((e) => ({
		...e,
		typ: wendeReglementAn(waehleErfordernis(rw, e.knotenId).ergebnis, regeln, enthaltung, lesarten)
			.erfordernis.typ
	}));
}

/**
 * Zieht einen Antrag zurück (FR-45).
 *
 * **Zurückgezogen ist nicht abgelehnt** — und deshalb entsteht hier auch kein
 * Durchgang und kein Ergebnis. Das Traktandum bleibt in der Liste stehen: Ein
 * verschwundener Antrag liesse die versandte Traktandenliste und das Protokoll
 * auseinanderlaufen, und niemand könnte erklären, wohin Nummer 7 gekommen ist.
 *
 * Möglich, solange nicht abgestimmt ist. Danach gehört das Ergebnis der
 * Versammlung, und wer es ändern will, braucht ihre Zustimmung — den
 * Rückkommensantrag.
 *
 * **Auch nach einer konsultativen Abstimmung** (Produktentscheid 14.10.2026,
 * H7 Teil D; Migration 159): Sie hat kein Ergebnis, das der Versammlung
 * gehörte. Das Protokoll nennt dann den Rückzug und die konsultativen Zahlen.
 */
export async function ziehAntragZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	grund: string
): Promise<Traktandum> {
	const wortlaut = verlangeRueckzugsgrund(grund);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// **Über denselben Leser wie die vier Nachbarn** (Code-Review 07.09.2026).
		// Eine eigene Abfrage daneben wäre eine zweite Abschrift der Bindung, und
		// die dritte käme mit dem nächsten Weg.
		const z = await leseEines(tx, meetingId, traktandumId);

		// Auch ein über einen Folgeantrag ersetzter Beschluss (Migration 133).
		// Ein geschlossener konsultativer Durchgang zählt nicht, ein offener
		// schon: Während abgestimmt wird, zieht niemand zurück (Migration 159).
		const [abgestimmt] = await tx<{ anzahl: number }[]>`
			SELECT (SELECT count(*)::int FROM voting_round
			         WHERE agenda_item_id = ${traktandumId} AND superseded_at IS NULL
			           AND NOT (consultative AND state = 'geschlossen'))
			     + durch_anderes_traktandum_ersetzt(${traktandumId})::int AS anzahl
		`;

		/*
		 * **Nur während der Sitzung**, wie beim Zurücknehmen darüber
		 * (Sicherheitsdurchgang 06.09.2026). Ein Rückzug nach dem Schliessen
		 * schriebe einen Satz ins Protokoll, den die Versammlung nie gehört hat.
		 */
		const [mz] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId}
		`;
		verlangeZustand(
			{ zustand: (mz?.state ?? 'entwurf') as never },
			['laufend'],
			'einen Antrag zurückziehen'
		);

		verlangeZurueckziehbar({
			art: z.art,
			rueckzug: z.rueckzug,
			wurdeAbgestimmt: abgestimmt.anzahl > 0,
			offeneFolgeantraege: await offeneFolgeantraegeIn(tx, meetingId, traktandumId)
		});

		await tx`
			UPDATE agenda_item
			   SET withdrawn_at = now(),
			       withdrawn_by = ${handelnder.userId},
			       withdrawn_by_label = ${handelnder.label},
			       withdrawn_reason = ${wortlaut}
			 WHERE id = ${traktandumId}
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.antragZurueckgezogen, { art: 'agenda_item', id: traktandumId }, {
				titel: z.titel,
				grund: wortlaut
			})
		]);

		const alle = await leseTraktanden(tx, meetingId);
		return alle.find((t) => t.knoten.id === traktandumId)!.knoten;
	});
}

/**
 * Die Folgeanträge, die an einem Antrag noch offen hängen.
 *
 * **Eine Stelle für beide Wege.** Die Sitzungsleitung liest sie, um die
 * Reihenfolge vorzuschlagen; der Rückzug liest sie, um abzusagen. Die Route
 * hatte dafür eine eigene Abbildung — zwei Abschriften derselben Frage, und
 * die zweite wäre beim nächsten Weg dazugekommen.
 *
 * **Was «offen» heisst, entscheidet der Kern** (`offeneFolgeantraege`): weder
 * entschieden noch zurückgezogen. Hier wird nur gelesen.
 *
 * bindung: traktandumId — Die Abfrage holt alle Traktanden über `meetingId`;
 *   `offeneFolgeantraege` wählt daraus die Kinder aus. Eine fremde Kennung
 *   findet keine.
 */
async function offeneFolgeantraegeIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	traktandumId: Id
): Promise<Antragsknoten[]> {
	const alle = await leseTraktanden(tx, meetingId);
	/*
	 * **Der massgebende Durchgang, nicht irgendeiner** (Code-Review 08.09.2026).
	 * Die erste Fassung fragte «gibt es einen geschlossenen, nicht überholten».
	 * Im Rückkommensfenster steht der alte geschlossen da, während der neue
	 * läuft, und beide sind nicht überholt — der Folgeantrag hätte als
	 * entschieden gegolten, und der Grundantrag liesse sich zurückziehen,
	 * während im Saal offen über die Änderung an ihm abgestimmt wird. Genau
	 * diese Fassung hat der Code-Review vom 07.09.2026 schon einmal in
	 * `nimmTraktandumAuf` verworfen.
	 */
	/*
	 * Seit Migration 133 über `massgebender_durchgang`: Ein Folgeantrag, dessen
	 * Beschluss nach einem weiteren Rückkommen seinerseits ersetzt wurde, ist
	 * entschieden, obwohl er keinen eigenen geltenden Durchgang mehr hat.
	 */
	const letzte = await tx<{ agenda_item_id: string; state: string; consultative: boolean }[]>`
		SELECT a.id AS agenda_item_id, v.state, v.consultative
		  FROM agenda_item a
		  JOIN voting_round v ON v.id = massgebender_durchgang(a.id)
		 WHERE a.meeting_id = ${meetingId}
	`;
	/*
	 * Das ist der Zustand eines **Durchgangs**, nicht der einer Versammlung:
	 * `voting_round.state` kennt genau zwei Werte, `CHECK (state IN ('offen',
	 * 'geschlossen'))` in `020_abstimmung.sql:87`. «versiegelt» gibt es dort
	 * nicht.
	 */
	const entschieden = new Set(
		// zustand-nur-geschlossen: Durchgang, nicht Versammlung — siehe darüber.
		// Ein Folgeantrag nach einer konsultativen Abstimmung ist offen (H7, Teil D).
		letzte
			.filter((z) => entscheidetDasGeschaeft({ zustand: z.state, konsultativ: z.consultative }))
			.map((z) => z.agenda_item_id)
	);
	return offeneFolgeantraege(
		alle.map((t) => ({
			id: t.knoten.id,
			nummer: t.nummer,
			titel: t.knoten.titel,
			art: t.knoten.art,
			hatErfordernis: t.knoten.erfordernis != null,
			grundantragId: t.knoten.parentId,
			entschieden: entschieden.has(t.knoten.id),
			zurueckgezogen: t.knoten.rueckzug != null
		})),
		traktandumId
	);
}

/**
 * Dasselbe von aussen, für die Sitzungsleitung.
 *
 * bindung: traktandumId — Reicht an `offeneFolgeantraegeIn` weiter, das über
 *   `meetingId` liest und die Kinder im Kern auswählt.
 */
export async function holeOffeneFolgeantraege(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Antragsknoten[]> {
	return alsBetreiber(operatorId, (tx) => offeneFolgeantraegeIn(tx, meetingId, traktandumId));
}

/**
 * Nimmt einen Rückzug zurück — der Antrag steht wieder zur Abstimmung.
 *
 * Gemeldet am 21.08.2026: «Rückzug kann aber zurückgenommen werden, wenn
 * gewünscht und das vom Recht her korrekt ist.» Warum er das ist, steht bei
 * `verlangeRuecknehmbar`.
 *
 * **Der Verlauf behält beides.** Der Rückzug wird nicht gelöscht, sondern
 * beendet: Im Verlauf stehen danach zwei Einträge, und das Protokoll erwähnt
 * einen zurückgenommenen Rückzug gar nicht mehr — über den Antrag wurde ja
 * abgestimmt. Wer wissen will, was im Saal geschah, findet es im Verlauf
 * (AD-5).
 */
export async function nimmRueckzugZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Über denselben Leser wie das Gegenstück darüber.
		const z = await leseEines(tx, meetingId, traktandumId);

		// Auch ein über einen Folgeantrag ersetzter Beschluss (Migration 133).
		// Dieselbe Grenze wie beim Rückzug: Ein geschlossener konsultativer
		// Durchgang zählt nicht (H7, Teil D).
		const [abgestimmt] = await tx<{ anzahl: number }[]>`
			SELECT (SELECT count(*)::int FROM voting_round
			         WHERE agenda_item_id = ${traktandumId} AND superseded_at IS NULL
			           AND NOT (consultative AND state = 'geschlossen'))
			     + durch_anderes_traktandum_ersetzt(${traktandumId})::int AS anzahl
		`;

		/*
		 * **Nur während der Sitzung** (Sicherheitsdurchgang 06.09.2026). Die
		 * Nachbarfunktionen prüfen den Zustand seit je; diese und ihr
		 * Gegenstück taten es nicht. Die Sitzungsleitungssicht rendert den Knopf
		 * zwar nur bei einer laufenden Versammlung, aber die Aktion ist davon
		 * unabhängig erreichbar: Ein Absenden zwischen Schliessen und Siegeln
		 * hätte den Rückzug getilgt, und weil das Protokoll live aus
		 * `agenda_item` gebaut wird, verschwände der Satz «Der Antrag wurde vor
		 * der Abstimmung zurückgezogen» aus jeder danach erzeugten Fassung. Nach
		 * dem Siegel sperrt der Auslöser aus Migration 041; davor gab es nichts.
		 */
		const [m] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId}
		`;
		verlangeZustand(
			{ zustand: (m?.state ?? 'entwurf') as never },
			['laufend'],
			'einen Rückzug zurücknehmen'
		);

		verlangeRuecknehmbar({
			rueckzug: z.rueckzug,
			wurdeAbgestimmt: abgestimmt.anzahl > 0
		});

		await tx`
			UPDATE agenda_item
			   SET withdrawn_at = NULL,
			       withdrawn_by = NULL,
			       withdrawn_by_label = NULL,
			       withdrawn_reason = NULL
			 WHERE id = ${traktandumId}
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.rueckzugZurueckgenommen,
				{ art: 'agenda_item', id: traktandumId },
				{ titel: z.titel, frühererGrund: z.rueckzug?.grund ?? null }
			)
		]);

		const alle = await leseTraktanden(tx, meetingId);
		return alle.find((t) => t.knoten.id === traktandumId)!.knoten;
	});
}

/**
 * Stellt den Rückkommensantrag zu einem behandelten Traktandum (FR-44).
 *
 * **Ein eigenes Traktandum, über das gesondert abgestimmt wird.** Nicht ein
 * Knopf, der das Traktandum einfach wieder öffnet: Über das Rückkommen
 * entscheidet die **Versammlung**, nicht die Sitzungsleitung. Erst wenn dieser
 * Antrag angenommen ist, lässt sich zur Sache erneut abstimmen.
 *
 * Titel, Wortlaut und Erfordernis setzt die Anwendung. Der Wortlaut, weil
 * «Nochmals Traktandum 5» offenliesse, ob über die Sache oder über das
 * Zurückkommen abgestimmt wird. Das Erfordernis, weil es im ZGB nicht geregelt
 * ist — behandelt als Ordnungsantrag mit einfachem Mehr, und dieser Vorbehalt
 * steht sichtbar an der Seite (RUECKKOMMEN_VORBEHALT).
 *
 * bindung: zielId — `alle.find((t) => t.knoten.id === zielId)` sucht in der
 *   Liste, die `meetingId` geliefert hat.
 */
export async function stelleRueckkommensantrag(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	zielId: Id
): Promise<Traktandum> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string; stweg_id: string }[]>`
			SELECT state, stweg_id FROM meeting WHERE id = ${meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand({ zustand: m.state as never }, ['laufend'], 'einen Rückkommensantrag stellen');

		const alle = await leseTraktanden(tx, meetingId);
		const ziel = alle.find((t) => t.knoten.id === zielId);
		if (!ziel) {
			throw fremdesTraktandum('ziel');
		}

		/*
		 * **«Steht schon einer?» heisst «wirkt noch einer?»** (berichtigt am
		 * 20.08.2026).
		 *
		 * Bis dahin genügte, dass je ein Rückkommensantrag gestellt worden war —
		 * für immer. Nach einem abgelehnten oder einem verbrauchten Rückkommen
		 * liess sich nie wieder eines beantragen, und die Anwendung widersprach
		 * sich dabei selbst: Die Absage am Geschäft nannte «einen neuen
		 * Rückkommensantrag» als Weg, und genau der war versperrt.
		 *
		 * Beschlüsse der Versammlung sind abänderbar, soweit sie keine
		 * Gestaltungswirkung entfalten und nicht bereits realisiert wurden
		 * (Rz. 202a ad Art. 712g). Verhindert werden soll deshalb nur,
		 * was tatsächlich stört: zwei Anträge nebeneinander. Erledigt ist ein
		 * Antrag, wenn er abgelehnt wurde — oder wenn er seinen einen Durchgang
		 * schon getragen hat.
		 *
		 * Ob er angenommen wurde, steht nicht in der Tabelle: Das rechnet die
		 * Auszählung. Hier wird deshalb nur der **offene** und der **verbrauchte**
		 * Fall in SQL beantwortet; über den geschlossenen entscheidet der Aufrufer
		 * mit `durchgangAngenommenInTx` (siehe unten).
		 */
		const [stand] = await tx<
			{
				behandelt: boolean;
				antrag_id: string | null;
				antrag_durchgang_id: string | null;
				antrag_offen: boolean;
				antrag_verbraucht: boolean;
				antrag_traegt_offenen: boolean;
				durchgang_id: string | null;
			}[]
		>`
			WITH letzter_antrag AS (
				-- Die Kennung als zweites Ordnungsmerkmal: added_during_meeting_at
				-- ist now() und damit der Beginn der Transaktion; zwei rasch
				-- aufeinanderfolgende Anträge können denselben Zeitstempel tragen.
				-- Eine uuidv7 ist selbst zeitsortiert — ohne sie wäre unbestimmt,
				-- welchen Antrag Server und Seite meinen.
				SELECT a.id
				  FROM agenda_item a
				 WHERE a.reconsiders_item_id = ${zielId}
				 ORDER BY a.added_during_meeting_at DESC NULLS LAST, a.id DESC
				 LIMIT 1
			)
			-- Behandelt ist auch ein über einen Folgeantrag ersetzter Beschluss,
			-- und dessen Durchgang ist dann der massgebende (Migration 133).
			SELECT (EXISTS (
			         SELECT 1 FROM voting_round v
			          WHERE v.agenda_item_id = ${zielId}
			            AND v.state = 'geschlossen' AND v.superseded_at IS NULL
			       ) OR durch_anderes_traktandum_ersetzt(${zielId})) AS behandelt,
			       (SELECT id FROM letzter_antrag) AS antrag_id,
			       (SELECT v.id FROM voting_round v
			         WHERE v.agenda_item_id = (SELECT id FROM letzter_antrag)
			           AND v.superseded_at IS NULL
			         ORDER BY v.ordinal DESC LIMIT 1) AS antrag_durchgang_id,
			       EXISTS (
			         SELECT 1 FROM voting_round v
			          WHERE v.agenda_item_id = (SELECT id FROM letzter_antrag)
			            AND v.state = 'offen'
			       ) AS antrag_offen,
			       -- Wie «verbrauchtDenRueckkommensantrag» im Kern: Ein durch eine
			       -- Neuabstimmung überholter Durchgang verbraucht den Antrag nicht.
			       EXISTS (
			         SELECT 1 FROM voting_round v
			          WHERE v.reconsideration_item_id = (SELECT id FROM letzter_antrag)
			            AND v.supersede_kind IS DISTINCT FROM 'korrektur'
			       ) AS antrag_verbraucht,
			       -- Ein offener Durchgang, der sich auf den Antrag stützt: Er liegt
			       -- nach einem Rückkommen auch an einem Folgeantrag (Codeprüfung
			       -- B2a, M1). Solange er läuft, wirkt das Rückkommen noch.
			       EXISTS (
			         SELECT 1 FROM voting_round v
			          WHERE v.reconsideration_item_id = (SELECT id FROM letzter_antrag)
			            AND v.state = 'offen'
			       ) AS antrag_traegt_offenen,
			       massgebender_durchgang(${zielId}) AS durchgang_id
		`;

		/*
		 * Der Antrag wirkt noch, solange über ihn nicht entschieden ist — oder er
		 * angenommen ist und seinen Durchgang noch vor sich hat.
		 */
		let rueckkommenWirkt = false;
		if (stand.antrag_id) {
			if (!stand.antrag_durchgang_id || stand.antrag_offen || stand.antrag_traegt_offenen) {
				rueckkommenWirkt = true;
			} else if (!stand.antrag_verbraucht) {
				rueckkommenWirkt = await durchgangAngenommenInTx(
					tx,
					meetingId,
					stand.antrag_durchgang_id
				);
			}
		}

		// «Kein Beschluss» am massgebenden Durchgang (Migration 128), gelesen
		// wie überall über die Festschreibung und `ergebnislage`.
		const ohneBeschluss = stand.durchgang_id
			? await durchgangOhneBeschlussInTx(tx, meetingId, stand.durchgang_id)
			: null;

		verlangeRueckkommbar({
			id: zielId,
			nummer: ziel.nummer,
			titel: ziel.knoten.titel,
			keinBeschluss: ohneBeschluss !== null,
			konsultativ: ohneBeschluss === 'konsultativ',
			konsultativNeu:
				ohneBeschluss === 'konsultativ' &&
				(
					await tx<{ consultative_reason: string | null }[]>`
						SELECT consultative_reason FROM voting_round
						 WHERE id = ${stand.durchgang_id} AND meeting_id = ${meetingId}
					`
				)[0]?.consultative_reason === 'neu_an_zweiter',
			behandelt: stand.behandelt,
			rueckkommenOffen: rueckkommenWirkt,
			zurueckgezogen: ziel.knoten.rueckzug != null
		});

		/*
		 * **Beim Folgeantrag wird auf den Grundantrag zurückgekommen, sobald er
		 * entschieden ist** (Produktentscheid 30.09.2026). Nur ein Rückkommen auf
		 * ihn trägt dann einen Durchgang (`rueckkommenZuEroeffnen`); eines auf
		 * den Folgeantrag nähme die Versammlung an, und eröffnen liesse sich
		 * danach nichts.
		 */
		const grund =
			ziel.knoten.spontanart === 'folgeantrag' && ziel.knoten.parentId
				? alle.find((t) => t.knoten.id === ziel.knoten.parentId)
				: undefined;
		if (grund) {
			const [g] = await tx<{ entschieden: boolean }[]>`
				SELECT state = 'geschlossen'
				       AND coalesce(universal_json->'keinBeschluss'->>'grund', '') <> 'weggang'
				       AND NOT consultative
				       AS entschieden
				  FROM voting_round WHERE id = massgebender_durchgang(${grund.knoten.id})
			`;
			const hindernis = hindernisRueckkommenAufFolgeantrag(
				{ nummer: ziel.nummer, titel: ziel.knoten.titel },
				{ nummer: grund.nummer, titel: grund.knoten.titel, entschieden: g?.entschieden === true }
			);
			if (hindernis) throw new FachlicherFehler(hindernis.code, hindernis.meldung, 'ziel');
		}

		/*
		 * **Angenommen oder abgelehnt — daran hängt alles Weitere** (Einwand
		 * des Auftraggebers vom 05.08.2026).
		 *
		 * Wurde der Antrag abgelehnt, gibt es keinen Beschluss aufzuheben: Das
		 * Rückkommen ist ein Ordnungsantrag mit einfachem Mehr. Wurde er
		 * angenommen, zielt das Rückkommen auf die Aufhebung — dann gilt dasselbe
		 * Mehr wie für den Erlass, und der Wortlaut sagt es ausdrücklich.
		 */
		const zielAngenommen = stand.durchgang_id
			? await durchgangAngenommenInTx(tx, meetingId, stand.durchgang_id)
			: false;

		/*
		 * **Das Mehr des Beschlusses, der aufgehoben werden soll** (Codeprüfung
		 * B1, M-2). Hat ein Folgeantrag den Beschluss nach einem Rückkommen
		 * ersetzt, ist der geltende Beschluss der zum Folgeantrag, gezählt nach
		 * dessen Erfordernis; der Folgeantrag darf ein anderes tragen
		 * (`erfordernisabweichung`). Mit dem Erfordernis des Grundantrags liesse
		 * sich ein qualifiziert gefasster Folgeantrag mit einfachem Mehr
		 * aufheben. Sonst ist es das Traktandum selbst.
		 */
		const [geltend] = stand.durchgang_id
			? await tx<{ agenda_item_id: string }[]>`
					SELECT agenda_item_id FROM voting_round WHERE id = ${stand.durchgang_id}
				`
			: [];
		const beschlussquelle =
			(geltend && alle.find((t) => t.knoten.id === geltend.agenda_item_id)) || ziel;

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;

		/*
		 * **Der Rückkommensantrag hängt unter seinem Traktandum** (Produktentscheid
		 * 21.08.2026): «Es gilt ja der Grundsatz, es kann nur abgestimmt werden,
		 * was angekündigt wurde. Ergo sind Folgeanträge, Wiedereintretungsanträge
		 * etc. Subtraktanden X.1 X.1.1 oder so.»
		 *
		 * Bis hierher legte ihn die Anwendung auf oberster Ebene an, hinten
		 * angehängt. Er bekam damit eine eigene Traktandennummer — eine, die auf
		 * keiner Einladung stand. Wer ihn dann dorthin zog, wo er hingehört,
		 * schob die Nummern aller nachfolgenden Punkte um eins.
		 *
		 * Als Untertraktandum stimmt beides: Die Nummer leitet sich aus dem
		 * angekündigten Punkt ab («8.1»), und sie sagt zugleich, worauf sich der
		 * Antrag bezieht. Folgeanträge stehen aus demselben Grund schon länger
		 * dort (`nimmTraktandumAuf`).
		 *
		 * **Ausweg bei voller Tiefe:** Liegt das Ziel schon auf der vierten Ebene,
		 * wäre ein Kind die fünfte — mehr als `GROESSTE_TIEFE`, und die Nummer
		 * («2.1.3.4.1») liest im Saal ohnehin niemand mehr. Dann steht der Antrag
		 * neben seinem Ziel statt darunter; welchen Punkt er meint, sagt sein
		 * Titel.
		 */
		const elternteil = ziel.tiefe < GROESSTE_TIEFE ? zielId : (ziel.knoten.parentId ?? null);
		const position = await naechstePosition(tx, meetingId, elternteil);
		// Hat ein Folgeantrag den Beschluss ersetzt, nennen Titel und Wortlaut ihn
		// (Codeprüfung B1; Plan Folgeantrag nach Rückkommen, Soll 7).
		const geltendZu =
			beschlussquelle.knoten.id !== ziel.knoten.id
				? { nummer: beschlussquelle.nummer, titel: beschlussquelle.knoten.titel }
				: null;
		const titel = rueckkommenstitel({ nummer: ziel.nummer, titel: ziel.knoten.titel }, geltendZu);
		const wortlaut = rueckkommenswortlaut(
			{ nummer: ziel.nummer, titel: ziel.knoten.titel },
			zielAngenommen,
			geltendZu
		);

		// Entscheid 5 (06.11.2026): Das Rückkommen erbt das Häkchen vom
		// Traktandum, auf das es zurückkommt; es ist selbst eine Abstimmung,
		// und an ihr ruhen dieselben Vollmachten wie an dem Beschluss, den es
		// aufheben will.
		await tx`
			INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
			                         item_kind, motion_text, proposer_kind, is_spontaneous,
			                         spontaneous_kind, reconsiders_item_id, added_during_meeting_at,
			                         concerns_management)
			VALUES (${id}, ${handelnder.operatorId}, ${meetingId}, ${elternteil}, ${position},
			        ${titel}, 'abstimmung', ${wortlaut}, 'bewirtschaftung', true, 'rueckkommen',
			        ${zielId}, now(), ${ziel.knoten.verwaltungsGeschaeft})
		`;

		/*
		 * Das Erfordernis gleich mit: Ohne eines liesse sich der Antrag nicht zur
		 * Abstimmung freigeben, und im Saal wäre das ein Umweg über den
		 * Entscheidbaum, der diesen Fall gar nicht kennt.
		 *
		 * **Und zwar dasselbe Mehr wie der Beschluss, auf den zurückgekommen
		 * wird.** Nicht «einfaches Mehr, es ist ja nur ein Ordnungsantrag»: Wird
		 * zurückgekommen und die Sache scheitert im zweiten Durchgang, ist der
		 * frühere Beschluss beseitigt. Über diesen Umweg liesse sich ein
		 * qualifizierter Beschluss mit einfacher Mehrheit aufheben.
		 */
		/*
		 * **Was das Reglement zum Rückkommen selbst sagt**, falls hinterlegt (PRD-
		 * Annahme 5: «sofern das Reglement nichts anderes sagt»). Angewandt wird es
		 * nur, wenn es nicht hinter dem Erfordernis des Beschlusses zurückbleibt —
		 * die Prüfung dazu steht im Kern.
		 */
		const eigeneRegel = (await leseReglementsregeln(tx, m.stweg_id)).find(
			(r) => r.geschaeftsart === 'rueckkommen'
		);
		/*
		 * **Ob der Beschluss die Ja-Stimmen aller hatte** (F4c B2b, B2-F-4), aus
		 * der Auszählung seines geltenden Durchgangs: Unter L6 hängt daran, ob
		 * seine Aufhebung nach beiden Lesarten besteht. Nur am angenommenen;
		 * unbekannt bleibt `undefined`.
		 */
		const beschlussMitAllen =
			zielAngenommen && stand.durchgang_id
				? await durchgangMitAllenJaInTx(tx, meetingId, stand.durchgang_id)
				: undefined;
		const hergeleitet = erfordernisFuerRueckkommen(
			beschlussquelle.knoten.erfordernis ?? null,
			zielAngenommen,
			eigeneRegel ? erfordernisAusRegel(eigeneRegel) : null,
			beschlussMitAllen
		);
		/*
		 * **Der Rückfall auf das einfache Mehr des Ordnungsantrags trägt die
		 * Einstellung zu den Enthaltungen** (Codeprüfung 07.10.2026, Befund 3).
		 * Es ist ein einfaches Mehr der Anwesenden wie jedes andere. Nur am
		 * abgelehnten Ziel: Am angenommenen ohne bekanntes Erfordernis hebt es
		 * einen Beschluss unbekannten Mehrs auf (zweiter Durchgang der
		 * Codeprüfung, Befund 4). Und nur er: Wer
		 * das Mehr des Beschlusses übernimmt, übernimmt es so, wie es damals
		 * galt, und eine Reglementsregel zum Rückkommen trägt ihre eigene Angabe.
		 */
		const e =
			hergeleitet.fassung === 'ordnungsantrag-2026-08-05' && !zielAngenommen
				? wendeReglementAn(
						hergeleitet,
						[],
						await holeEnthaltungseinstellungIn(tx, m.stweg_id),
						await holeLesartenIn(tx, { meetingId })
					).erfordernis
				: hergeleitet;
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
				-- **Die Quotenschwelle gehört mit.** Ohne sie fiele beim Übernehmen
				-- eines qualifizierten Mehrs genau der Teil weg, der es qualifiziert
				-- macht — und das Rückkommen käme doch wieder mit Kopfmehrheit durch.
				requirement_quota_numerator = ${e.quotenSchwelle?.zaehler ?? null},
				requirement_quota_denominator = ${e.quotenSchwelle?.nenner ?? null},
				requirement_quota_mode = ${e.quotenSchwelle?.art ?? null},
				requirement_business_kind = ${e.geschaeftsart ?? null},
				requirement_needs_affected_consent = ${e.zustimmungBetroffenerNoetig},
				requirement_affected_consent_form = ${e.betroffenenzustimmung ?? null},
				requirement_source = ${e.quelle},
				requirement_reference = ${e.fundstelle ?? null},
				requirement_abstention_counts = ${e.enthaltungZaehltMit ?? null},
				requirement_reading = ${e.gemeinschaftslesart ? tx.json(e.gemeinschaftslesart as never) : null},
				requirement_statutory = ${e.gesetzlich ? tx.json(e.gesetzlich as never) : null},
				-- Nur das Rückkommen setzt sie; jedes andere Schreiben löscht sie (Migration 181).
				requirement_reading_reconsidered = ${e.lesartDesBeschlusses ? tx.json(e.lesartDesBeschlusses as never) : null},
				-- Das Häkchen zum Satz an der Karte (Migration 198), wo wendeReglementAn es setzt.
				requirement_rule_secured = ${e.regelGesichert ?? null},
				requirement_path = ${tx.json(e.pfad as never)}
			WHERE id = ${id}
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.rueckkommenBeantragt, { art: 'agenda_item', id }, {
				ziel: ziel.knoten.titel,
				zielNummer: ziel.nummer,
				zielAngenommen,
				erfordernis: e.titel,
				// L8 (Migration 184), G-6 (07.11.2026): Das geerbte Häkchen im
				// Verlauf, wie beim Anlegen; nur gesetzt, wenn es trägt.
				...(ziel.knoten.verwaltungsGeschaeft ? { verwaltungsGeschaeft: true } : {})
			})
		]);

		const nachher = await leseTraktanden(tx, meetingId);
		return nachher.find((t) => t.knoten.id === id)!.knoten;
	});
}

/**
 * Die neuen Abstimmungstraktanden einer zweiten Versammlung (Ä-17 B), nach
 * `neueTraktandenDerZweiten`. Leer an einer ersten Versammlung.
 */
export async function holeNeueTraktandenDerZweiten(operatorId: Id, meetingId: Id): Promise<Set<string>> {
	return alsBetreiber(operatorId, (tx) => leseNeueTraktandenDerZweitenIn(tx, meetingId));
}
