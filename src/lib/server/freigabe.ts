/**
 * Freigabe und Rücknahme in der Datenbank (Story 3.5, AD-3).
 *
 * Alles in einer Transaktion: Momentaufnahme schreiben, Zustand setzen,
 * Verlaufseintrag anlegen. Bräche eines davon ab, gäbe es eine freigegebene
 * Versammlung ohne Stimmberechtigtenstand oder umgekehrt — und beides fiele
 * erst im Saal auf.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeUebergang, type Handelnder } from './audit';
import {
	gibFrei,
	lesartVeraltetInWorten,
	nimmFreigabeZurueck,
	pruefeFreigabe,
	type Freigabebefund,
	type Freigabelage
} from '$lib/domain/freigabe';
import { STAMMQUOTE } from '$lib/domain/einheiten';
import { brauchtReglementsbeleg, FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { HeadCountMode, Id, Snapshot, SnapshotParty, Stichentscheid, UnitKind } from '$lib/domain/types';
import type { Versammlung } from '$lib/domain/versammlung';
import { AUSNAHMEN_VORGABE, type Universalvariante } from '$lib/domain/ausnahmen';
import { LESARTEN_VORGABE, wahlOhneGespeicherte, zaehlweiseVeraltet, type Lesartenwahl } from '$lib/domain/lesarten';
import { holeRegelwerk, knotenDerFassung } from '$lib/rules';
import { holeVersammlung } from './versammlungen';
import { holeLesartenIn } from './lesarten';
import { momentaufnahmeKopf, type Momentaufnahmezeile } from './momentaufnahmekopf';
import { stimmkraftAnsicht } from './eigentuemer';
import { pruefeGemeinschaftSalden } from './einheiten';
import {
	holeTraktanden,
	loescheFreigabenummern,
	schreibeEinladungsmehrBeiFreigabe,
	schreibeFreigabenummern
} from './traktanden';
import { loescheEinladungsmehrBeiRuecknahme } from './einladungsmehr';
import {
	angehoerigeNachzuziehen,
	AUSSCHLUSSKLAGE_KNOTEN,
	EINSPRACHE_KNOTEN
} from '$lib/domain/entscheidbaum';

/**
 * Stellt zusammen, was der Freigabe entgegensteht.
 *
 * Wird zweimal gebraucht: für die Anzeige vor der Freigabe und beim Freigeben
 * selbst. Zwei getrennte Zusammenstellungen liefen auseinander — dann zeigte die
 * Seite grün und die Freigabe scheiterte, oder schlimmer: umgekehrt.
 */
export async function erhebeFreigabelage(
	operatorId: Id,
	meetingId: Id
): Promise<{ versammlung: Versammlung; lage: Freigabelage; befund: Freigabebefund }> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

	const [stimmkraft, salden, traktanden, lesartVeraltet] = await Promise.all([
		// Zum Versammlungsdatum, nicht zu heute: Wer im August für den September
		// freigibt, will den Stand vom September.
		stimmkraftAnsicht(operatorId, versammlung.stwegId, versammlung.datum),
		pruefeGemeinschaftSalden(operatorId, versammlung.stwegId),
		holeTraktanden(operatorId, meetingId),
		// Gegen die Lesarten, die eine Freigabe jetzt einfröre: vor der Freigabe
		// die der Gemeinschaft (`holeLesartenIn`). Nach der Freigabe gibt es
		// nichts mehr freizugeben; die Lage bleibt dann leer.
		alsBetreiber(operatorId, async (tx) => {
			const [s] = await tx`SELECT 1 FROM snapshot WHERE meeting_id = ${meetingId}`;
			if (s) return [];
			return veralteteLesartenIn(tx, meetingId, await holeLesartenIn(tx, { meetingId }));
		})
	]);

	const eigeneEbene = salden.zeilen.filter(
		(z) => z.stwegId === versammlung.stwegId && z.istStammquote
	);

	const lage: Freigabelage = {
		versammlungsdatum: versammlung.datum,
		anzahlTraktanden: traktanden.length,
		ohneErfordernis: traktanden
			.filter((t) => t.knoten.art === 'abstimmung' && !t.knoten.erfordernis)
			.map((t) => ({ nummer: t.nummer, titel: t.knoten.titel })),
		grenzfaelle: traktanden
			.filter((t) => t.knoten.erfordernis?.typ === 'grenzfall')
			.map((t) => ({ nummer: t.nummer, titel: t.knoten.titel })),
		quotenabweichungen: eigeneEbene
			.filter((z) => z.abweichung !== 0)
			.map((z) => ({ ebene: z.stwegName, abweichung: z.abweichung })),
		einheitenOhneEigentuemer: stimmkraft.einheitenOhneEigentuemer.map((e) => ({
			label: e.label
		})),
		anzahlParteien: stimmkraft.zeilen.filter((z) => z.einheiten.length > 0).length,
		ausschlussklageOhneBeklagten: traktanden
			.filter(
				(t) =>
					t.knoten.art === 'abstimmung' &&
					t.knoten.erfordernis?.knotenId === AUSSCHLUSSKLAGE_KNOTEN &&
					t.knoten.betroffeneParteiIds.length === 0
			)
			.map((t) => ({ nummer: t.nummer, titel: t.knoten.titel })),
		// Ebenso die Einsprache (ab Fassung 2026-10-20).
		einspracheOhneBetroffene: traktanden
			.filter(
				(t) =>
					t.knoten.art === 'abstimmung' &&
					t.knoten.erfordernis?.knotenId === EINSPRACHE_KNOTEN &&
					t.knoten.betroffeneParteiIds.length === 0
			)
			.map((t) => ({ nummer: t.nummer, titel: t.knoten.titel })),
		lesartVeraltet
	};

	return { versammlung, lage, befund: pruefeFreigabe(lage) };
}

/**
 * Liest die Momentaufnahme, wie sie bei der Freigabe entstehen würde.
 *
 * Aus denselben Daten und über dieselbe Aufbereitung wie die Stimmkraftansicht:
 * Es gibt genau einen Weg, aus Stammdaten eine Momentaufnahme zu machen.
 */
async function baueMomentaufnahme(
	tx: postgres.TransactionSql,
	versammlung: Versammlung
): Promise<Snapshot> {
	const [gemeinschaft] = await tx<
		{
			head_count_mode: HeadCountMode;
			parking_counts_as_head: boolean;
			head_count_rule_source: string | null;
			tie_break: Stichentscheid | null;
			quota_denominator: number;
			unannounced_bylaw_allowed: boolean;
			unannounced_bylaw_source: string | null;
			universal_meeting_mode: Universalvariante;
			universal_meeting_source: string | null;
			universal_chair_proxies_count: boolean;
			reading_l4: Lesartenwahl['L4'];
			reading_l1: Lesartenwahl['L1'];
			reading_l2: Lesartenwahl['L2'];
			reading_l3: Lesartenwahl['L3'];
			reading_l5: Lesartenwahl['L5'];
			reading_l6: Lesartenwahl['L6'];
			reading_l7: Lesartenwahl['L7'];
			reading_l8: Lesartenwahl['L8'];
			reading_l9: Lesartenwahl['L9'];
			reading_l10: Lesartenwahl['L10'];
			reading_l11: Lesartenwahl['L11'];
			reading_l12: Lesartenwahl['L12'];
			reading_l13: Lesartenwahl['L13'];
		}[]
	>`
		SELECT head_count_mode, parking_counts_as_head, head_count_rule_source, tie_break,
		       quota_denominator, unannounced_bylaw_allowed, unannounced_bylaw_source,
		       universal_meeting_mode, universal_meeting_source, universal_chair_proxies_count,
		       reading_l4, reading_l1, reading_l2, reading_l3, reading_l5, reading_l6, reading_l7, reading_l8,
		       reading_l9, reading_l10, reading_l11, reading_l12, reading_l13
		FROM stweg WHERE id = ${versammlung.stwegId}
	`;
	if (!gemeinschaft) {
		throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
	}

	const zeilen = await tx<
		{
			party_id: string;
			display_name: string;
			is_community: boolean;
			representative_name: string | null;
			authentik_subject: string | null;
			unit_id: string | null;
			label: string | null;
			kind: UnitKind | null;
			counts_as_head: boolean | null;
			stammquote: number | null;
			usufruct_holder_name: string | null;
			usufruct_has_agreement: boolean | null;
			usufruct_agreement_summary: string | null;
			usufruct_has_document: boolean | null;
			usufruct_contract_on_file: boolean | null;
		}[]
	>`
		SELECT p.id AS party_id, p.display_name, p.is_community, p.representative_name,
		       -- Mitkopiert, damit die Anmeldung über das eigene Konto am
		       -- eingefrorenen Stand hängt und nicht an den heutigen Stammdaten
		       -- (Migration 067).
		       p.authentik_subject,
		       u.id AS unit_id, u.label, u.kind, u.counts_as_head,
		       (SELECT uq.value
		        FROM unit_quota uq
		        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
		        WHERE uq.unit_id = u.id AND qk.key = ${STAMMQUOTE}) AS stammquote,
		       -- **Die am Versammlungstag gültige Nutzniessung** (FR-22). Sie wird
		       -- mit eingefroren: Wer sie später beendet oder eine Vereinbarung
		       -- nachträgt, darf damit nicht ändern, wer an dieser Versammlung
		       -- stimmberechtigt war (AD-3).
		       n.holder_name AS usufruct_holder_name,
		       n.has_agreement AS usufruct_has_agreement,
		       n.agreement_summary AS usufruct_agreement_summary,
		       -- Der Ratgeber der Webseite verlangt die Kopie des Vertrags; ob sie
		       -- vorliegt, gehört an die Momentaufnahme (FR-4).
		       EXISTS (
		         SELECT 1 FROM attachment a
		          WHERE a.subject_type = 'usufruct' AND a.subject_id = n.id
		       ) AS usufruct_has_document,
		       n.contract_on_file AS usufruct_contract_on_file
		FROM party p
		LEFT JOIN unit_ownership o
		       ON o.party_id = p.id
		      AND o.valid_from <= ${versammlung.datum}
		      AND (o.valid_to IS NULL OR o.valid_to > ${versammlung.datum})
		LEFT JOIN unit u ON u.id = o.unit_id
		LEFT JOIN usufruct n
		       ON n.unit_id = u.id
		      AND n.valid_from <= ${versammlung.datum}
		      AND (n.valid_to IS NULL OR n.valid_to > ${versammlung.datum})
		WHERE p.stweg_id = ${versammlung.stwegId}
		ORDER BY p.display_name, u.label
	`;

	const jePartei = new Map<string, SnapshotParty>();
	for (const z of zeilen) {
		let eintrag = jePartei.get(z.party_id);
		if (!eintrag) {
			eintrag = {
				partyId: z.party_id,
				displayName: z.display_name,
				isCommunity: z.is_community,
				representativeName: z.representative_name,
				authentikSubject: z.authentik_subject,
				units: []
			};
			jePartei.set(z.party_id, eintrag);
		}
		if (z.unit_id) {
			eintrag.units.push({
				unitId: z.unit_id,
				label: z.label as string,
				kind: z.kind as UnitKind,
				countsAsHead: z.counts_as_head ?? true,
				quota: z.stammquote ?? 0,
				nutzniessung: z.usufruct_holder_name
					? {
							holderName: z.usufruct_holder_name,
							hasAgreement: z.usufruct_has_agreement ?? false,
							agreementSummary: z.usufruct_agreement_summary,
							contractOnFile: z.usufruct_contract_on_file ?? false,
							hasDocument: z.usufruct_has_document ?? false
						}
					: null
			});
		}
	}

	// Parteien ohne Einheit zum Stichtag kommen nicht in die Momentaufnahme: Sie
	// sind an diesem Tag nicht stimmberechtigt. Sie stehenzulassen ergäbe
	// Stimmberechtigte mit null Stimmen, die in jeder Anwesenheitsliste als
	// fehlend erschienen.
	const parteien = [...jePartei.values()].filter((p) => p.units.length > 0);

	return {
		meetingId: versammlung.id,
		takenAt: new Date().toISOString(),
		headCountMode: gemeinschaft.head_count_mode,
		parkingCountsAsHead: gemeinschaft.parking_counts_as_head,
		// Nur führen, wo sie etwas belegt: Bei der gesetzlichen Auffangregel wäre
		// ein Verweis aufs Reglement irreführend.
		headCountRuleSource: brauchtReglementsbeleg(gemeinschaft.head_count_mode)
			? (gemeinschaft.head_count_rule_source?.trim() || null)
			: null,
		tieBreak: gemeinschaft.tie_break ?? 'keiner',
		totalQuota: gemeinschaft.quota_denominator,
		// Eingefroren wie die Zählweise (Migration 127).
		ausnahmen: {
			reglementGestattet: gemeinschaft.unannounced_bylaw_allowed,
			reglementFundstelle: gemeinschaft.unannounced_bylaw_source,
			universalvariante: gemeinschaft.universal_meeting_mode,
			universalFundstelle: gemeinschaft.universal_meeting_source,
			leitungsvollmachtenZaehlen: gemeinschaft.universal_chair_proxies_count
		},
		// Eingefroren wie die Ausnahmen (Migration 169).
		lesarten: {
			L1: gemeinschaft.reading_l1,
			L2: gemeinschaft.reading_l2,
			L3: gemeinschaft.reading_l3,
			L4: gemeinschaft.reading_l4,
			L5: gemeinschaft.reading_l5,
			L6: gemeinschaft.reading_l6,
			L7: gemeinschaft.reading_l7,
			L8: gemeinschaft.reading_l8,
			L9: gemeinschaft.reading_l9,
			L10: gemeinschaft.reading_l10,
			L11: gemeinschaft.reading_l11,
			L12: gemeinschaft.reading_l12,
			L13: gemeinschaft.reading_l13
		},
		parties: parteien
	};
}

/**
 * **Die Einladung rechnet nach der Lesart, die eingefroren wird** (Migration
 * 169). Ein Traktandum bekommt sein Erfordernis meist vor der Freigabe, nach der
 * Lesart der Gemeinschaft in diesem Augenblick. Stellt jemand danach um, rechnete
 * das Traktandum nach der alten Wahl, die Momentaufnahme hielte die neue fest,
 * und Karte und Protokoll nennten zwei Lesarten. Die Freigabe sagt deshalb ab
 * und nennt den Weg: die Erfordernisse auf der Seite «Lesarten» nachziehen.
 */
async function pruefeLesartenDerTraktanden(
	tx: postgres.TransactionSql,
	meetingId: Id,
	lesarten: Lesartenwahl
): Promise<void> {
	const [erstes] = await veralteteLesartenIn(tx, meetingId, lesarten);
	if (!erstes) return;
	throw new FachlicherFehler('lesart_veraltet', lesartVeraltetInWorten(erstes.titel), 'lesart');
}

/**
 * Die Traktanden, deren Mehr nach einer anderen Lesart gebildet ist als `lesarten`.
 * Eine Abfrage für die Freigabe und die Freigabelage, damit die Seite vor dem
 * Klick dasselbe sagt wie die Absage danach.
 */
async function veralteteLesartenIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	lesarten: Lesartenwahl
): Promise<{ nummer: string; titel: string }[]> {
	const zeilen = await tx<
		{
			title: string;
			nummer: string;
			knoten: string;
			quelle: string | null;
			kennung: string | null;
			wahl: string | null;
			kopfbasis: string | null;
			fassung: string | null;
			typ: string | null;
			quotenbasis: string | null;
			rechtsgrundlage: string | null;
			enthaltung: boolean | null;
			andere_typ: string | null;
			andere_rechtsgrundlage: string | null;
			andere_kopfbasis: string | null;
		}[]
	>`
		SELECT title, coalesce(manual_number, released_number, position::text) AS nummer,
		       requirement_node AS knoten, requirement_source AS quelle,
		       requirement_reading->>'kennung' AS kennung, requirement_reading->>'wahl' AS wahl,
		       requirement_head_base AS kopfbasis, requirement_version AS fassung,
		       requirement_type AS typ, requirement_quota_base AS quotenbasis,
		       requirement_legal_basis AS rechtsgrundlage, requirement_abstention_counts AS enthaltung,
		       requirement_reading->'andere'->>'typ' AS andere_typ,
		       requirement_reading->'andere'->>'rechtsgrundlage' AS andere_rechtsgrundlage,
		       requirement_reading->'andere'->>'kopfbasis' AS andere_kopfbasis
		  FROM agenda_item
		 WHERE meeting_id = ${meetingId}
		   -- Dieselben Bedingungen wie der Kasten «Erfordernisse nachziehen»
		   -- (veralteteErfordernisseIn): Sagte die Freigabe zu einem Traktandum
		   -- ab, das der Kasten nicht zeigt, gäbe es keinen Weg hinaus
		   -- (Codeprüfung Lesarten, Teil 1).
		   AND item_kind = 'abstimmung' AND requirement_type IS NOT NULL
		   AND requirement_node IS NOT NULL AND requirement_reason IS NULL
		 ORDER BY position
	`;
	/*
	 * **Ohne Lesart rechnet ein Traktandum, was der Knoten seiner Fassung
	 * rechnet** (Review DeepSeek zu Block 3, V1 und B1; Entscheid 0048,
	 * Block A): L2 hängt an einem Knoten, den es vor der Lesart gab. Ein
	 * Traktandum aus einer älteren Fassung trägt keine Wahl; steht die
	 * Gemeinschaft auf einer anderen Wahl als der seines Knotens, rechnete die
	 * Einladung nach der Wahl des Knotens, während die Momentaufnahme die der
	 * Gemeinschaft einfröre. Welche Wahl das ist, sagt
	 * `wahlOhneGespeicherte`, nicht die Vorgabe des Katalogs: Die kann eine
	 * spätere Fassung umstellen, das alte Traktandum rechnet weiter wie bisher.
	 * Der Kasten «nachziehen» zeigt dasselbe Traktandum
	 * (`veralteteErfordernisseIn` fragt dieselbe Funktion), der Weg hinaus
	 * besteht also.
	 * Damit ist auch B1 erledigt: Der Folgeantrag traf nur in einer so
	 * freigegebenen Versammlung auf ein Traktandum ohne Lesart.
	 *
	 * **Nicht unter einer Regel des Reglements** (Codeprüfung der Behebung,
	 * F1): Dort fällt die Lesart bewusst weg (`wendeReglementAn`), das
	 * Traktandum rechnet nach dem Reglement, und der Kasten zeigt es nicht. Die
	 * Absage nennte einen Weg, den es nicht gibt.
	 */
	const amKnoten = new Map(
		holeRegelwerk()
			.knoten.filter((k) => k.lesart)
			.map((k) => [k.id, k.lesart!.kennung])
	);
	/*
	 * **L10 hängt an keinem Knoten** (Migration 189): Sie wirkt an der
	 * Ausschlussklage, wo die Mehrheit an allen Eigentümern ohne den Beklagten
	 * gemessen wird, und nur ab der Fassung 2026-11-10. Ein Traktandum aus den
	 * Fassungen ab 2026-10-25 und davor rechnet fest mit den Angehörigen in der
	 * Zahl (eines von noch früher schon ohne sie); steht die Gemeinschaft
	 * auf «fallen_heraus», rechnete die Einladung nach der alten Regel, während
	 * die Momentaufnahme die neue Wahl einfröre. Dieselben Bedingungen wie im
	 * Kasten «Erfordernisse nachziehen» (`veralteteErfordernisseIn`), sonst
	 * nennte die Absage einen Weg, den es nicht gibt.
	 */
	const l10Veraltet = (z: (typeof zeilen)[number]): boolean =>
		angehoerigeNachzuziehen(
			{ knotenId: z.knoten, fassung: z.fassung, kopfbasis: z.kopfbasis, quelle: z.quelle },
			lesarten.L10
		);
	/*
	 * **L13 hängt an keinem Knoten** (Migration 192), ändert aber das Mehr: Wo
	 * sie wirkt, setzt die Wahl die Kopfbasis. Rechnet ein Traktandum nach einer
	 * anderen Zählweise, als die Gemeinschaft eingestellt hat, rechnete die
	 * Einladung nach der alten, während die Momentaufnahme die neue einfröre.
	 * Dieselbe Bedingung wie im Kasten (`zaehlweiseVeraltet`).
	 */
	const l13Veraltet = (z: (typeof zeilen)[number]): boolean =>
		zaehlweiseVeraltet(
			{
				fassung: z.fassung,
				typ: z.typ,
				rechtsgrundlage: z.rechtsgrundlage,
				kopfbasis: z.kopfbasis,
				quelle: z.quelle,
				enthaltungZaehltMit: z.enthaltung,
				andere: z.andere_typ ? { typ: z.andere_typ, rechtsgrundlage: z.andere_rechtsgrundlage, kopfbasis: z.andere_kopfbasis } : null
			},
			lesarten.L13
		);
	return zeilen
		.filter((z) => {
			if (l10Veraltet(z)) return true;
			if (l13Veraltet(z)) return true;
			const kennung = z.kennung ?? (z.quelle === 'reglement' ? undefined : amKnoten.get(z.knoten));
			if (!kennung) return false;
			const gewaehlt = lesarten[kennung as keyof Lesartenwahl];
			const wahl =
				z.wahl ??
				wahlOhneGespeicherte(kennung, z.fassung ? knotenDerFassung(z.fassung, z.knoten) : undefined, {
					typ: z.typ,
					kopfbasis: z.kopfbasis,
					quotenbasis: z.quotenbasis
				});
			return gewaehlt !== undefined && gewaehlt !== wahl;
		})
		.map((z) => ({ nummer: z.nummer, titel: z.title }));
}

/**
 * Das Netz unter den Zustandsprüfungen von Freigabe und Rücknahme (Befund D6).
 *
 * Beide Wege sperren die Zeile, bevor sie den Zustand lesen, und jedes andere
 * `UPDATE meeting` wartet auf diese Sperre. Ein `UPDATE`, das am alten Zustand
 * nichts mehr findet, kommt deshalb nur vor, wenn dieser Weg selbst umgebaut
 * wird und die Sperre wegfällt oder hinter das Lesen rutscht. Dann soll der
 * Satz die Lage nennen, statt dass still ein Zustand überschrieben wird.
 */
function zustandGewechselt(): FachlicherFehler {
	return new FachlicherFehler(
		'zustand_unpassend',
		'Die Versammlung hat inzwischen ihren Zustand gewechselt. Laden Sie die Seite neu.',
		'zustand'
	);
}

export async function gibVersammlungFrei(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Erst sperren, dann die Lage lesen** (Sicherheitsdurchgang 09.10.2026,
		 * Befund D6). Bis dahin las dieser Weg Lage und Zustand vor der Sperre,
		 * und die Prüfung lief auf diesem Stand. Zwei gleichzeitige Freigaben
		 * gingen beide durch, und die zweite baute die Momentaufnahme der ersten
		 * neu; nach einem Eröffnen dazwischen fing erst eine Schranke der
		 * Datenbank den Lauf, mit einer rohen Ausnahme statt eines Satzes.
		 *
		 * Gesperrt auch, damit ein gleichzeitig geschriebenes Erfordernis nicht
		 * nach der Untergrenze landet, die hier festgehalten wird
		 * (`achteEinladungsmehr` sperrt dieselbe Zeile). Die Lage liest über
		 * eigene Verbindungen, nicht über `tx`. Für den Zustand trägt das, weil
		 * jeder Zustandswechsel diese Zeile ebenfalls sperrt. Den Rest der Lage
		 * hält die Sperre nicht fest: Ein Traktandum, das im Entwurf zugleich
		 * bearbeitet wird, und die Stammdaten der Gemeinschaft liest sie in
		 * ihrem eigenen Augenblick, wie vor dem Befund (Codeprüfung H5).
		 */
		await tx`SELECT id FROM meeting WHERE id = ${meetingId} FOR UPDATE`;
		const { versammlung, befund } = await erhebeFreigabelage(handelnder.operatorId, meetingId);

		/*
		 * **Nicht freigeben, was im Archiv liegt** (25.08.2026, aus beiden Reviews).
		 * Sonst entsteht eine Versammlung, die freigegeben ist — Einladungen
		 * draussen, Zugangscodes verteilt — und zugleich aus Liste, Suche und
		 * Startseite verschwunden. Die Sitzungsleitung sucht sie am Abend
		 * vergeblich.
		 */
		if (versammlung.archiviertAm) {
			throw new FachlicherFehler(
				'im_archiv',
				'Diese Versammlung liegt im Archiv. Holen Sie sie zuerst hervor — freigeben lässt ' +
					'sich nur, was in der Liste steht.',
				'archiv'
			);
		}

		/*
		 * **Und die Gruppe zählt mit** (25.08.2026, dritte Reviewrunde).
		 *
		 * Der Weg, den das schliesst, war über die Oberfläche vollständig begehbar:
		 * Eine Klammer archivieren, während ein Haus darunter noch einen Entwurf hat
		 * — Entwürfe gehen bewusst mit —, dann auf der Hausseite freigeben. Die
		 * Versammlung trug nie ein eigenes `archived_at`, die Prüfung oben griff
		 * also nicht. Ergebnis: freigegeben, Einladungen und Zugangscodes draussen,
		 * und in keiner Liste zu finden.
		 */
		const [archiv] = await tx<{ name: string }[]>`
			SELECT w.name FROM stweg w WHERE w.id = stweg_archiv_wegen(${versammlung.stwegId})
		`;
		const wegen = archiv?.name ?? null;
		if (wegen) {
			throw new FachlicherFehler(
				'im_archiv',
				`Diese Versammlung liegt im Archiv, weil «${wegen}» archiviert ist. Holen Sie ` +
					`«${wegen}» zuerst hervor — freigeben lässt sich nur, was in der Liste steht.`,
				'archiv'
			);
		}

		const momentaufnahme = await baueMomentaufnahme(tx, versammlung);
		const ausnahmen = momentaufnahme.ausnahmen ?? AUSNAHMEN_VORGABE;
		const lesarten = momentaufnahme.lesarten ?? LESARTEN_VORGABE;
		await pruefeLesartenDerTraktanden(tx, meetingId, lesarten);
		const u = gibFrei(versammlung, befund, momentaufnahme);

		// Eine ältere Momentaufnahme darf es hier nicht geben — die Rücknahme
		// verwirft sie. Der Aufräumschritt steht trotzdem: Bliebe nach einem
		// abgebrochenen Lauf eine liegen, entstünde beim nächsten Versuch ein
		// Gemisch aus zwei Ständen.
		await tx`DELETE FROM snapshot_party WHERE meeting_id = ${meetingId}`;
		await tx`DELETE FROM snapshot WHERE meeting_id = ${meetingId}`;
		// Und die Nummern aus einem früheren Anlauf desgleichen — sie werden gleich
		// neu geschrieben.
		await loescheFreigabenummern(tx, meetingId);

		await tx`
			INSERT INTO snapshot (meeting_id, operator_id, as_of_date, head_count_mode,
			                      parking_counts_as_head, head_count_rule_source, tie_break,
			                      total_quota, unannounced_bylaw_allowed, unannounced_bylaw_source,
			                      universal_meeting_mode, universal_meeting_source,
			                      universal_chair_proxies_count, reading_l4, reading_l1, reading_l2, reading_l3, reading_l5, reading_l6, reading_l7, reading_l8,
			                      reading_l9, reading_l10, reading_l11, reading_l12, reading_l13)
			VALUES (${meetingId}, ${handelnder.operatorId}, ${versammlung.datum},
			        ${momentaufnahme.headCountMode}, ${momentaufnahme.parkingCountsAsHead},
			        ${momentaufnahme.headCountRuleSource}, ${momentaufnahme.tieBreak},
			        ${momentaufnahme.totalQuota}, ${ausnahmen.reglementGestattet},
			        ${ausnahmen.reglementFundstelle}, ${ausnahmen.universalvariante},
			        ${ausnahmen.universalFundstelle}, ${ausnahmen.leitungsvollmachtenZaehlen},
			        ${lesarten.L4}, ${lesarten.L1}, ${lesarten.L2}, ${lesarten.L3}, ${lesarten.L5}, ${lesarten.L6}, ${lesarten.L7}, ${lesarten.L8},
			        ${lesarten.L9}, ${lesarten.L10}, ${lesarten.L11}, ${lesarten.L12}, ${lesarten.L13})
		`;

		/*
		 * **L1 am Traktandum nachführen** (Migration 170). Die Wahl kam beim
		 * Speichern des Erfordernisses aus der Gemeinschaft; stellte jemand
		 * seither um, trüge das Traktandum die alte. Anders als bei L4 ändert L1
		 * das Mehr nicht, die Einladung bleibt also, wie sie ist; deshalb keine
		 * Absage wie bei `pruefeLesartenDerTraktanden`, sondern die eingefrorene
		 * Wahl. Der Auslöser setzt sie ohnehin aus der eben geschriebenen
		 * Momentaufnahme; der Wert hier sagt dasselbe ausdrücklich.
		 */
		await tx`
			UPDATE agenda_item SET requirement_reading_l1 = ${lesarten.L1}
			 WHERE meeting_id = ${meetingId} AND requirement_type IS NOT NULL
			   AND requirement_reading_l1 IS DISTINCT FROM ${lesarten.L1}
		`;

		// **L3 ebenso** (Migration 172): Die Zählung ändert das Mehr nicht; die
		// eingefrorene Wahl gilt, wie L1.
		await tx`
			UPDATE agenda_item SET requirement_reading_l3 = ${lesarten.L3}
			 WHERE meeting_id = ${meetingId} AND requirement_type IS NOT NULL
			   AND requirement_reading_l3 IS DISTINCT FROM ${lesarten.L3}
		`;

		// **L10 ebenso** (Migration 189): die Zahl der Angehörigen im Ausstand an
		// der Ausschlussklage. Sie ändert das Mehr nicht, nur die Zählung.
		await tx`
			UPDATE agenda_item SET requirement_reading_l10 = ${lesarten.L10}
			 WHERE meeting_id = ${meetingId} AND requirement_type IS NOT NULL
			   AND requirement_reading_l10 IS DISTINCT FROM ${lesarten.L10}
		`;

		/*
		 * **L13 erst nach der Absage** (Migration 192): Wo sie wirkt, ändert sie
		 * das Mehr, und ein Traktandum nach einer anderen Wahl hat
		 * `pruefeLesartenDerTraktanden` oben schon abgewiesen. Hier bleibt die
		 * Wahl an den übrigen nachzuführen, vor allem dort, wo die
		 * Enthaltungsklausel L13 verdrängt: Die Sätze dort nennen die eingestellte
		 * Wahl (`kopfzaehlweiseKartensatz`).
		 */
		await tx`
			UPDATE agenda_item SET requirement_reading_l13 = ${lesarten.L13}
			 WHERE meeting_id = ${meetingId} AND requirement_type IS NOT NULL
			   AND requirement_reading_l13 IS DISTINCT FROM ${lesarten.L13}
		`;

		for (const p of momentaufnahme.parties) {
			const [{ id }] = await tx<{ id: string }[]>`
				INSERT INTO snapshot_party (operator_id, meeting_id, party_id, display_name,
				                            representative_name, is_community, authentik_subject)
				VALUES (${handelnder.operatorId}, ${meetingId}, ${p.partyId}, ${p.displayName},
				        ${p.representativeName}, ${p.isCommunity}, ${p.authentikSubject ?? null})
				RETURNING id
			`;
			for (const e of p.units) {
				await tx`
					INSERT INTO snapshot_unit (operator_id, meeting_id, snapshot_party_id, unit_id,
					                           label, kind, counts_as_head, quota,
					                           usufruct_holder_name, usufruct_has_agreement,
					                           usufruct_agreement_summary, usufruct_has_document,
					                           usufruct_contract_on_file)
					VALUES (${handelnder.operatorId}, ${meetingId}, ${id}, ${e.unitId}, ${e.label},
					        ${e.kind}, ${e.countsAsHead}, ${e.quota},
					        ${e.nutzniessung?.holderName ?? null},
					        ${e.nutzniessung?.hasAgreement ?? false},
					        ${e.nutzniessung?.agreementSummary ?? null},
					        ${e.nutzniessung?.hasDocument ?? false},
					        ${e.nutzniessung?.contractOnFile ?? false})
				`;
			}
		}

		/*
		 * **Die Nummern gehören zur Momentaufnahme** (Migration 072, 21.08.2026).
		 * Ab hier ist die Traktandennummer das, was in der Einladung steht — auch
		 * wenn die Versammlung die Reihenfolge am Abend ändert. Ohne diesen Schritt
		 * rechnete die Liste weiter aus der Position, und ein vorgezogener Punkt
		 * schöbe die Nummern aller nachfolgenden um eins.
		 */
		await schreibeFreigabenummern(tx, meetingId);

		/*
		 * **Und das Mehr, das die Einladung nennt** (Migration 144). Es ist ab
		 * hier die Untergrenze im Saal. Geschrieben, solange die Versammlung noch
		 * im Entwurf steht: Die Sperre in der Datenbank lässt die Spalte nur vor
		 * Beginn bewegen.
		 */
		await schreibeEinladungsmehrBeiFreigabe(tx, meetingId);

		// Das Netz unter der Prüfung oben (Befund D6): Die Zeile ist gesperrt,
		// der Zustand also derselbe wie beim Prüfen (`zustandGewechselt`).
		const freigegeben = await tx`
			UPDATE meeting SET state = 'freigegeben', released_at = now()
			 WHERE id = ${meetingId} AND state = 'entwurf'
		`;
		if (freigegeben.count !== 1) throw zustandGewechselt();

		return schreibeUebergang(tx, handelnder, u);
	});
}

export async function nimmVersammlungsfreigabeZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	grund?: string
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Erst sperren, dann lesen (Befund D6, wie bei der Freigabe): Sonst prüfte
		// der Kern einen Stand von vor einem gleichzeitigen Eröffnen.
		await tx`SELECT id FROM meeting WHERE id = ${meetingId} FOR UPDATE`;
		const versammlung = await holeVersammlung(handelnder.operatorId, meetingId);
		if (!versammlung) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

		const u = nimmFreigabeZurueck(versammlung, grund);

		/*
		 * **Vor dem Löschen prüfen, nicht den Datenbankfehler übersetzen**
		 * (Auftrag E, 03.10.2026). Die Rücknahme verwirft die Momentaufnahme;
		 * die Vollmacht hängt per `ON DELETE CASCADE` an ihr, und der Auslöser
		 * `proxy_nur_lebensweg` (Migration 036) weist das Löschen ab. Ohne
		 * diese Prüfung endete der Weg in der rohen Ausnahme, die die Route als
		 * Serverfehler durchreichte. Gezählt wird über alle Zustände: Der
		 * Auslöser sperrt jedes `DELETE`, auch das einer zurückgewiesenen oder
		 * widerrufenen Zeile. Die Schranke steht im Server und nicht im Kern,
		 * wie bei `loescheGeschaeft` und `setzeBeteiligte`, wo ebenfalls eine
		 * gezählte Zeilenmenge die Löschung aufhält.
		 *
		 * **Die Zeile der Versammlung wird gesperrt, bevor gezählt wird**
		 * (Codeprüfung der Abnahme, 03.10.2026). Jede Erfassung sperrt sie in
		 * `verlangeVollmachtsgrenze`, auch die Selbstvollmacht über den
		 * Eigentümerzugang. Ohne die Sperre oben käme eine Vollmacht, die zwischen
		 * Zählung und Löschen eintrifft, wieder als rohe Ausnahme an.
		 */
		const [vollmachten] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM proxy WHERE meeting_id = ${meetingId}
		`;
		if (vollmachten.anzahl > 0) {
			throw new FachlicherFehler(
				'vollmachten_haengen',
				'An dieser Versammlung hängen bereits Vollmachten. Die Rücknahme verwürfe, wer ' +
					'stimmberechtigt ist, und daran hängen die Vollmachten. Löschen lassen sie sich ' +
					'nicht, auch eine zurückgewiesene oder widerrufene nicht. Die Freigabe ' +
					'lässt sich damit nicht mehr zurücknehmen.',
				'freigabe'
			);
		}

		// Vollständig verwerfen, nicht fortschreiben (AD-3). Die Einheiten hängen
		// per ON DELETE CASCADE an den Parteien.
		await tx`DELETE FROM snapshot_party WHERE meeting_id = ${meetingId}`;
		await tx`DELETE FROM snapshot WHERE meeting_id = ${meetingId}`;
		// Die festgeschriebenen Nummern gehören dazu: Im Entwurf rücken sie wieder
		// nach, und wer dort ein Traktandum einfügt, erwartet genau das.
		await loescheFreigabenummern(tx, meetingId);
		// Ebenso das Mehr der Einladung, und der Versandvermerk fällt zurück: Die
		// neue Freigabe ist eine neue Einladung (Produktentscheid 06.10.2026).
		await loescheEinladungsmehrBeiRuecknahme(tx, handelnder, meetingId);

		// Das Netz unter der Prüfung oben, wie bei der Freigabe (Befund D6).
		const zurueck = await tx`
			UPDATE meeting SET state = 'entwurf', released_at = NULL
			 WHERE id = ${meetingId} AND state = 'freigegeben'
		`;
		if (zurueck.count !== 1) throw zustandGewechselt();

		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Liest die festgeschriebene Momentaufnahme.
 *
 * Ab der Freigabe die **einzige** Quelle für jede Zählung dieser Versammlung.
 * Wer hier `null` bekommt, darf nicht auf die Stammdaten ausweichen — dann ist
 * die Versammlung noch im Entwurf, und es gibt schlicht nichts zu zählen.
 */
export async function holeMomentaufnahme(
	operatorId: Id,
	meetingId: Id
): Promise<Snapshot | null> {
	return alsBetreiber(operatorId, async (tx) => {
		// Der Kopf über denselben Weg wie `holeMomentaufnahmeIn` (Migration 169).
		const [kopf] = await tx<Momentaufnahmezeile[]>`SELECT * FROM snapshot WHERE meeting_id = ${meetingId}`;
		if (!kopf) return null;

		const zeilen = await tx<
			{
				snapshot_party_id: string;
				party_id: string;
				display_name: string;
				representative_name: string | null;
				is_community: boolean;
				unit_id: string | null;
				label: string | null;
				kind: UnitKind | null;
				counts_as_head: boolean | null;
				quota: number | null;
				usufruct_holder_name: string | null;
				usufruct_has_agreement: boolean | null;
				usufruct_agreement_summary: string | null;
				usufruct_has_document: boolean | null;
				usufruct_contract_on_file: boolean | null;
			}[]
		>`
			SELECT p.id AS snapshot_party_id, p.party_id, p.display_name, p.representative_name,
			       p.is_community, u.unit_id, u.label, u.kind, u.counts_as_head, u.quota,
			       u.usufruct_holder_name, u.usufruct_has_agreement, u.usufruct_agreement_summary,
			       u.usufruct_has_document, u.usufruct_contract_on_file
			FROM snapshot_party p
			LEFT JOIN snapshot_unit u ON u.snapshot_party_id = p.id
			WHERE p.meeting_id = ${meetingId}
			ORDER BY p.display_name, u.label
		`;

		const jePartei = new Map<string, SnapshotParty>();
		for (const z of zeilen) {
			let eintrag = jePartei.get(z.snapshot_party_id);
			if (!eintrag) {
				eintrag = {
					partyId: z.party_id,
					displayName: z.display_name,
					isCommunity: z.is_community,
					representativeName: z.representative_name,
					units: []
				};
				jePartei.set(z.snapshot_party_id, eintrag);
			}
			if (z.unit_id) {
				eintrag.units.push({
					unitId: z.unit_id,
					label: z.label as string,
					kind: z.kind as UnitKind,
					countsAsHead: z.counts_as_head ?? true,
					quota: z.quota ?? 0,
					nutzniessung: z.usufruct_holder_name
						? {
								holderName: z.usufruct_holder_name,
								hasAgreement: z.usufruct_has_agreement ?? false,
								agreementSummary: z.usufruct_agreement_summary,
								contractOnFile: z.usufruct_contract_on_file ?? false,
								hasDocument: z.usufruct_has_document ?? false
							}
						: null
				});
			}
		}

		return {
			...momentaufnahmeKopf(kopf, meetingId),
			parties: [...jePartei.values()]
		};
	});
}
