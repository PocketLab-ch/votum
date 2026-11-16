/**
 * Datenzugriff auf die Gemeinschaften (Story 1.4).
 *
 * Die Schale: Sie holt, was der Kern zum Entscheiden braucht, ruft ihn auf und
 * schreibt sein Ergebnis samt Ereignissen in einer Transaktion (AD-1).
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import {
	aendereGemeinschaft,
	FachlicherFehler,
	legeGemeinschaftAn,
	type AngelegteGemeinschaft,
	type GemeinschaftEingabe,
	type Traegerschaft
} from '$lib/domain/gemeinschaft';
import type { HeadCountMode, Id, Stichentscheid } from '$lib/domain/types';
import type { Universalvariante } from '$lib/domain/ausnahmen';
import type { Neuabstimmungsart } from '$lib/domain/neuabstimmung';
import type { Fondsgrenzenart } from '$lib/domain/fondsgrenze';
import type { Sicht } from '$lib/domain/archivieren';
import {
	entfernungshindernis,
	type Anhaengendes,
	type Hindernis
} from '$lib/domain/entfernbarkeit';

export interface GemeinschaftZeile extends AngelegteGemeinschaft {
	untergemeinschaften: number;
	/**
	 * Wessen Archivierung diese Zeile mitnimmt — `null`, wenn sie selbst
	 * archiviert wurde oder gar nicht im Archiv liegt.
	 *
	 * Der Unterschied trägt die Anzeige: Auf der Seite eines Hauses steht dann
	 * «Im Archiv, weil «MEG Sonnenhof» archiviert ist» **statt** eines Knopfes
	 * zum Hervorholen. Der Knopf steht an der Klammer, und nur dort — sonst
	 * risse man ein Haus aus einer archivierten Gruppe heraus.
	 */
	imArchivWegen: { id: string; name: string; seit: string | null } | null;
	/** Seit wann sie im Archiv liegt — eigen oder geerbt. */
	imArchivSeit: string | null;
}

interface DbZeile {
	id: string;
	operator_id: string;
	parent_stweg_id: string | null;
	name: string;
	strasse: string | null;
	plz: string | null;
	ort: string | null;
	quota_denominator: number;
	head_count_mode: HeadCountMode;
	parking_counts_as_head: boolean;
	head_count_rule_source: string | null;
	tie_break: Stichentscheid;
	tie_break_rule_source: string | null;
	abstention_excluded: boolean;
	abstention_excluded_source: string | null;
	proxy_limit: number | null;
	proxy_limit_rule_source: string | null;
	proxy_by_access: boolean;
	proxy_by_access_source: string | null;
	ai_enabled: boolean;
	ai_disabled_functions: string[];
	invitation_lead_days: number | null;
	invitation_lead_source: string | null;
	second_meeting_interval_days: number | null;
	second_meeting_interval_source: string | null;
	bylaw_amendment_unanimous: boolean;
	bylaw_amendment_source: string | null;
	unannounced_bylaw_allowed: boolean;
	unannounced_bylaw_source: string | null;
	universal_meeting_mode: Universalvariante;
	universal_meeting_source: string | null;
	universal_chair_proxies_count: boolean;
	revote_after_quorum: Neuabstimmungsart;
	relax_after_invitation_deadline: boolean;
	renewal_fund_limit_kind: Fondsgrenzenart | null;
	renewal_fund_limit_text: string | null;
	renewal_fund_limit_source: string | null;
	archived_at: Date | null;
	archived_note: string | null;
	traegerschaft: Traegerschaft | null;
}

function ausDb(z: DbZeile): AngelegteGemeinschaft {
	return {
		id: z.id,
		operatorId: z.operator_id,
		parentStwegId: z.parent_stweg_id,
		name: z.name,
		strasse: z.strasse ?? undefined,
		plz: z.plz ?? undefined,
		ort: z.ort ?? undefined,
		quotaDenominator: z.quota_denominator,
		headCountMode: z.head_count_mode,
		parkingCountsAsHead: z.parking_counts_as_head,
		headCountRuleSource: z.head_count_rule_source ?? undefined,
		tieBreak: z.tie_break,
		tieBreakRuleSource: z.tie_break_rule_source ?? undefined,
		abstentionExcluded: z.abstention_excluded,
		abstentionExcludedSource: z.abstention_excluded_source ?? undefined,
		proxyLimit: z.proxy_limit,
		proxyLimitRuleSource: z.proxy_limit_rule_source ?? undefined,
		proxyByAccess: z.proxy_by_access,
		proxyByAccessSource: z.proxy_by_access_source ?? undefined,
		aiEnabled: z.ai_enabled,
		aiDisabledFunctions: z.ai_disabled_functions ?? [],
		einberufungsfristTage: z.invitation_lead_days,
		einberufungsfristFundstelle: z.invitation_lead_source,
		zweitversammlungsfristTage: z.second_meeting_interval_days,
		zweitversammlungsfristFundstelle: z.second_meeting_interval_source,
		aenderungsschranke: z.bylaw_amendment_unanimous,
		aenderungsschrankeFundstelle: z.bylaw_amendment_source,
		ausnahmen: {
			reglementGestattet: z.unannounced_bylaw_allowed,
			reglementFundstelle: z.unannounced_bylaw_source,
			universalvariante: z.universal_meeting_mode,
			universalFundstelle: z.universal_meeting_source,
			leitungsvollmachtenZaehlen: z.universal_chair_proxies_count
		},
		neuabstimmungNachQuorum: z.revote_after_quorum,
		milderungNachFrist: z.relax_after_invitation_deadline,
		// Ganz oder gar nicht, wie die Migration 193 es erzwingt.
		fondsgrenze:
			z.renewal_fund_limit_kind && z.renewal_fund_limit_text && z.renewal_fund_limit_source
				? { art: z.renewal_fund_limit_kind, wortlaut: z.renewal_fund_limit_text, fundstelle: z.renewal_fund_limit_source }
				: null,
		archiviertAm: z.archived_at?.toISOString() ?? null,
		archivnotiz: z.archived_note,
		traegerschaft: z.traegerschaft
	};
}

/**
 * Die Kette der Vorfahren einer Gemeinschaft, von ihr aufwärts, ohne sie selbst.
 * Der Kern braucht sie, um einen Ring zu erkennen, bevor er entsteht.
 */
async function vorfahren(tx: postgres.TransactionSql, id: Id | null): Promise<Id[]> {
	if (!id) return [];
	const zeilen = await tx<{ id: string }[]>`
		WITH RECURSIVE aufwaerts AS (
			SELECT id, parent_stweg_id FROM stweg WHERE id = ${id}
			UNION ALL
			SELECT s.id, s.parent_stweg_id
			FROM stweg s JOIN aufwaerts a ON s.id = a.parent_stweg_id
		)
		SELECT id FROM aufwaerts
	`;
	return zeilen.map((z) => z.id);
}

/**
 * Die Gemeinschaften — vorgabemässig **ohne** die archivierten.
 *
 * **Die Vorgabe ist die sichere Seite** (Migration 086): Wer eine neue Liste
 * baut und nicht an das Archiv denkt, bekommt das erwartete Verhalten. Wer
 * Archiviertes braucht, schreibt `'alle'` hin — und dann steht im Aufruf,
 * warum.
 *
 * `'alle'` gehört überall dorthin, wo **nachgeschlagen** wird: Verlauf,
 * Personenseite, der Name einer Mitgliedsgemeinschaft. Dort fehlte sonst die
 * Beschriftung, und die Zeile stünde ohne Namen da.
 */
export async function listeGemeinschaften(
	operatorId: Id,
	/**
	 * Ob Archiviertes mitkommt — **ohne Vorgabe, mit Absicht** (25.08.2026).
	 *
	 * Eine Vorgabe `'aktiv'` entschied still für jeden neuen Aufrufer, und
	 * dreimal traf sie das Falsche: Die Elternauswahl verlor die archivierte
	 * Klammer und loeste das Haus beim naechsten Speichern heraus, die
	 * Doppelpruefung beim Anlegen sah die archivierte Erstversammlung nicht
	 * mehr, und am Einlass fehlte die archivierte Person in der Auswahl.
	 * Wer liest, entscheidet jetzt sichtbar: Listen filtern, Pruefungen und
	 * Abendabfragen nie.
	 */
	sicht: Sicht
): Promise<GemeinschaftZeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Die Gruppe ist eine Einheit** (Auftraggeber, 25.08.2026). Gefiltert wird nicht
		 * nach der eigenen Spalte, sondern nach `stweg_archiv_wegen` (Migration
		 * 087): Wer eine Klammer archiviert, nimmt ihre Häuser mit — und wer sie
		 * hervorholt, holt sie mit zurück. Geschrieben wird das Archiv trotzdem
		 * nur auf einer Zeile; die Zugehörigkeit leitet sich beim Lesen ab und
		 * kann deshalb nicht auseinanderlaufen.
		 *
		 * `wegen_name` steht für den Satz auf der Seite des Hauses: «Im Archiv,
		 * weil «MEG Sonnenhof» archiviert ist» — sonst fände niemand den Weg
		 * zurück, denn der Knopf steht an der Klammer.
		 */
		const zeilen = await tx<
			(DbZeile & {
				untergemeinschaften: number;
				wegen_id: string | null;
				wegen_name: string | null;
				wegen_seit: Date | null;
			})[]
		>`
			SELECT s.*,
			       -- Ohne die zweite Bedingung stünde an der Klammer «2
			       -- Untergemeinschaften» und darunter eine (25.08.2026).
			       (SELECT count(*)::int FROM stweg u
			         WHERE u.parent_stweg_id = s.id AND stweg_archiv_wegen(u.id) IS NULL)
			         AS untergemeinschaften,
			       w.id AS wegen_id, w.name AS wegen_name, w.archived_at AS wegen_seit
			/*
			 * **Die Funktion gehoert nicht in eine Join-Bedingung** (25.08.2026,
			 * dritte Reviewrunde).
			 *
			 * Als LEFT JOIN stweg w ON w.id = stweg_archiv_wegen(...) geschrieben
			 * darf der Planer sie in den Join-Filter ziehen und wertet sie dann
			 * einmal je **Zeilenpaar** aus statt einmal je Zeile. Gemessen bei 29
			 * Versammlungen und 38 Gemeinschaften: 1102 Auswertungen, 53 ms. Bei
			 * 800 Versammlungen und 200 Gemeinschaften waeren das 160 000 — und
			 * diese Abfrage traegt vier Seiten.
			 *
			 * Ein blosses LATERAL genuegt **nicht**: Der Planer zieht eine
			 * triviale Unterabfrage flach, und der schlechte Plan war zurueck
			 * (nachgemessen). OFFSET 0 ist die Optimierungsschranke, die das
			 * verhindert — die Funktion wird je aeusserer Zeile genau einmal
			 * ausgewertet, auch wenn dem Planer Hash- und Merge-Join genommen
			 * werden. Gemessen: 5.4 statt 53 ms.
			 */
			FROM stweg s
			LEFT JOIN LATERAL (SELECT stweg_archiv_wegen(s.id) AS id OFFSET 0) k ON true
			LEFT JOIN stweg w ON w.id = k.id
			WHERE ${sicht === 'aktiv' ? tx`w.id IS NULL` : tx`true`}
			ORDER BY s.parent_stweg_id NULLS FIRST, s.name
		`;
		return zeilen.map((z) => ({
			...ausDb(z),
			untergemeinschaften: z.untergemeinschaften,
			imArchivWegen:
				z.wegen_id && z.wegen_id !== z.id
					? { id: z.wegen_id, name: z.wegen_name ?? '', seit: z.wegen_seit?.toISOString() ?? null }
					: null,
			imArchivSeit: z.wegen_seit?.toISOString() ?? null
		}));
	});
}

export async function holeGemeinschaft(
	operatorId: Id,
	id: Id
): Promise<AngelegteGemeinschaft | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [zeile] = await tx<DbZeile[]>`SELECT * FROM stweg WHERE id = ${id}`;
		return zeile ? ausDb(zeile) : null;
	});
}

/**
 * Ob Gemeinschaften Mitglied dieser Gemeinschaft sind, also eine Eigentümerzeile
 * der Art «Gemeinschaft» besteht. Dann verlangen Anlegen und Speichern die
 * Trägerschaft gemäss Grundbuch (Ä-43).
 */
async function hatHaeuserIn(tx: postgres.TransactionSql, id: Id): Promise<boolean> {
	const [z] = await tx<{ ja: boolean }[]>`
		SELECT EXISTS (SELECT 1 FROM party WHERE stweg_id = ${id} AND kind = 'gemeinschaft') AS ja
	`;
	return z.ja;
}

export async function hatHaeuserAlsMitglieder(operatorId: Id, id: Id): Promise<boolean> {
	return alsBetreiber(operatorId, (tx) => hatHaeuserIn(tx, id));
}

export async function erstelleGemeinschaft(
	handelnder: Handelnder & { operatorId: string },
	eingabe: GemeinschaftEingabe,
	/** Ob danach Gemeinschaften als Mitglieder aufgenommen werden (Ä-43). */
	mitHaeusern = false
): Promise<AngelegteGemeinschaft> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Kennung vorab, damit der Kern sie im Ereignis führen kann und die
		// Ringprüfung sich auf denselben Wert bezieht wie das Einfügen.
		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const kette = await vorfahren(tx, eingabe.parentStwegId);
		/*
		 * **Eine übergeordnete, die es hier nicht gibt, ist eine Absage.** Die
		 * Kette beginnt bei ihr selbst; leer heisst, der Zeilenschutz zeigt sie
		 * nicht. Bis dahin hielt erst der Fremdschlüssel
		 * `stweg_eltern_gleicher_betreiber` sie ab, als 500-Seite (Feldteil von
		 * `e2e/fremdbetreiber.mjs`, 27.10.2026).
		 */
		if (eingabe.parentStwegId && kette.length === 0) throw fremdeGemeinschaft('parentStwegId');

		const u = legeGemeinschaftAn(id, handelnder.operatorId, eingabe, kette, mitHaeusern);
		const g = u.ergebnis;

		await tx`
			INSERT INTO stweg (id, operator_id, parent_stweg_id, name, strasse, plz, ort,
			                   quota_denominator, head_count_mode, parking_counts_as_head,
			                   head_count_rule_source, tie_break, tie_break_rule_source,
			                   abstention_excluded, abstention_excluded_source,
			                   proxy_limit, proxy_limit_rule_source,
		                   proxy_by_access, proxy_by_access_source,
			                   ai_enabled, ai_disabled_functions, traegerschaft)
			VALUES (${g.id}, ${g.operatorId}, ${g.parentStwegId}, ${g.name},
			        ${g.strasse ?? null}, ${g.plz ?? null}, ${g.ort ?? null},
			        ${g.quotaDenominator}, ${g.headCountMode}, ${g.parkingCountsAsHead},
			        ${g.headCountRuleSource ?? null}, ${g.tieBreak ?? 'keiner'},
		        ${g.tieBreakRuleSource ?? null},
		        ${g.abstentionExcluded ?? false}, ${g.abstentionExcludedSource ?? null},
		        ${g.proxyLimit ?? null},
		        ${g.proxyLimitRuleSource ?? null},
		        ${g.proxyByAccess ?? false}, ${g.proxyByAccessSource ?? null},
		        ${g.aiEnabled ?? false}, ${g.aiDisabledFunctions ?? []},
		        ${g.traegerschaft ?? null})
		`;

		return schreibeUebergang(tx, handelnder, u);
	});
}

export async function bearbeiteGemeinschaft(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	eingabe: GemeinschaftEingabe
): Promise<AngelegteGemeinschaft> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<DbZeile[]>`SELECT * FROM stweg WHERE id = ${id}`;
		if (!zeile) throw new Error('Gemeinschaft nicht gefunden');

		const kette = await vorfahren(tx, eingabe.parentStwegId);
		/*
		 * Nur zählen, wenn es darauf ankommt: Der Kern weist eine Klammer mit
		 * eigenen Einheiten ab, und die Datenbank täte es auch — aber als
		 * Fremdschlüsselverletzung, die als «500 Internal Error» bei der
		 * Sitzungsleitung ankäme (gemessen am 12.08.2026).
		 */
		const einheiten =
			eingabe.quotaDenominator === 0
				? (
						await tx<{ n: number }[]>`
							SELECT count(*)::int AS n FROM unit WHERE stweg_id = ${id}
						`
					)[0].n
				: 0;
		const u = aendereGemeinschaft(
			ausDb(zeile),
			eingabe,
			kette,
			einheiten,
			await hatHaeuserIn(tx, id)
		);
		const g = u.ergebnis;

		await tx`
			UPDATE stweg SET
				parent_stweg_id = ${g.parentStwegId},
				name = ${g.name},
				strasse = ${g.strasse ?? null},
				plz = ${g.plz ?? null},
				ort = ${g.ort ?? null},
				quota_denominator = ${g.quotaDenominator},
				head_count_mode = ${g.headCountMode},
				parking_counts_as_head = ${g.parkingCountsAsHead},
				head_count_rule_source = ${g.headCountRuleSource ?? null},
				tie_break = ${g.tieBreak ?? 'keiner'},
				tie_break_rule_source = ${g.tieBreakRuleSource ?? null},
				abstention_excluded = ${g.abstentionExcluded ?? false},
				abstention_excluded_source = ${g.abstentionExcludedSource ?? null},
				proxy_limit = ${g.proxyLimit ?? null},
				proxy_limit_rule_source = ${g.proxyLimitRuleSource ?? null},
				proxy_by_access = ${g.proxyByAccess ?? false},
				proxy_by_access_source = ${g.proxyByAccessSource ?? null},
				ai_enabled = ${g.aiEnabled ?? false},
				ai_disabled_functions = ${g.aiDisabledFunctions ?? []},
				traegerschaft = ${g.traegerschaft ?? null}
			WHERE id = ${id}
		`;

		return schreibeUebergang(tx, handelnder, u);
	});
}


/**
 * Zählt, was an einer Gemeinschaft hängt.
 *
 * **Die eine Stelle, an der diese Liste steht** (15.09.2026). Sie wird von zwei
 * Seiten gelesen: vom Vollzug in `entferneGemeinschaft`, der daraus eine Absage
 * macht, und von `holeEntfernungshindernis`, das daraus die Anzeige speist.
 *
 * Wer hier eine Tabelle ergänzt, ergänzt sie damit an beiden Orten zugleich.
 * Das ist der Zweck: In derselben Funktion stand einmal eine zweite Liste
 * neben dem SQL-Aufräumskript, und die beiden liefen auseinander, bis eine
 * Gemeinschaft mit Weisungsregel sich nur noch mit einer rohen 500 entfernen
 * liess.
 */
async function zaehleAnhaengendes(tx: postgres.TransactionSql, id: Id): Promise<Anhaengendes> {
	const [z] = await tx<Anhaengendes[]>`
		SELECT
			(SELECT count(*)::int FROM meeting WHERE stweg_id = ${id}) AS versammlungen,
			(SELECT count(*)::int FROM stweg WHERE parent_stweg_id = ${id}) AS kinder,
			(SELECT count(*)::int FROM party WHERE member_stweg_id = ${id}) AS mitgliedschaften,
			(SELECT count(*)::int FROM agenda_item WHERE proposer_stweg_id = ${id}) AS traktanden,
			(SELECT count(*)::int FROM representation WHERE stweg_id <> ${id}
			  AND party_id IN (SELECT id FROM party WHERE stweg_id = ${id})) AS vertretungen,
			(SELECT count(*)::int FROM imported_meeting WHERE stweg_id = ${id}) AS eingespielt
	`;
	return z;
}

/**
 * Was dem Entfernen entgegensteht — für die Anzeige, **bevor** jemand drückt.
 *
 * Gibt `null` zurück, wenn nichts entgegensteht; dann ist der Knopf offen.
 *
 * **Der Name kommt vom Aufrufer** (aus dem Code-Review, 15.09.2026). Die erste
 * Fassung holte ihn selbst — eine zweite Abfrage in einer dritten Transaktion
 * je Seitenaufruf, und bei einer Umbenennung dazwischen nannte dieselbe Seite
 * zwei verschiedene Namen: einen in der Überschrift, einen im Hinderungsgrund.
 * Die Seite hat den Namen ohnehin aus `holeGemeinschaft`; so steht er genau
 * einmal.
 */
export async function holeEntfernungshindernis(
	operatorId: string,
	id: Id,
	name: string
): Promise<Hindernis | null> {
	return alsBetreiber(operatorId, async (tx) =>
		entfernungshindernis(name, await zaehleAnhaengendes(tx, id))
	);
}

/**
 * Eine Gemeinschaft entfernen (Story 6.7, Nachtrag vom 01.08.2026).
 *
 * **Warum das eng geschnitten ist.** Eine Gemeinschaft ist der Anker von
 * allem: Einheiten, Eigentümer, Reglement, Versammlungen. Wer sie entfernt,
 * entfernt keine Zeile, sondern eine Kartei. Deshalb geht es nur, solange
 * nichts daran hängt, das später Fragen beantworten muss — und die Schranken
 * nennen ihren Grund, statt bloss abzuweisen.
 *
 * **Der Verlauf bleibt.** `audit_entry` ist nur anfügbar (AD-5), und
 * `subject_id` ist Text ohne Fremdschlüssel: Der Nachweis überlebt seinen
 * Gegenstand. Ein Nachweis, den das Löschen mitnimmt, wäre keiner — und das
 * Entfernen selbst wird als Ereignis festgehalten.
 */
export async function entferneGemeinschaft(
	handelnder: Handelnder & { operatorId: string },
	id: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [g] = await tx<{ name: string }[]>`SELECT name FROM stweg WHERE id = ${id}`;
		if (!g) throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'id');

		/*
		 * **Dieselbe Liste, die auch die Seite liest** (15.09.2026).
		 *
		 * Die Zählung steht in `zaehleAnhaengendes`, die Bewertung in
		 * `domain/entfernbarkeit`. Vorher stand beides hier, und die Seite konnte
		 * vorher nichts anzeigen — der Knopf war immer offen, die Absage kam erst
		 * nach der Rückfrage. Jetzt fragt `holeEntfernungshindernis` denselben Weg
		 * ab und sperrt den Knopf, **ohne** dass diese Prüfung entfällt: Ein
		 * gesperrter Knopf im Browser ist keine Schranke, sondern eine Auskunft.
		 */
		const hindernis = entfernungshindernis(g.name, await zaehleAnhaengendes(tx, id));
		if (hindernis) {
			throw new FachlicherFehler(hindernis.kennung, hindernis.nachricht, hindernis.feld);
		}

		// Von unten nach oben, wie im Aufräumskript: Die Fremdschlüssel auf
		// `stweg` sind RESTRICT, damit genau das hier bewusst geschehen muss.
		await tx`DELETE FROM usufruct WHERE stweg_id = ${id}`;
		await tx`DELETE FROM unit_ownership WHERE stweg_id = ${id}`;
		await tx`DELETE FROM unit_quota WHERE stweg_id = ${id}`;
		await tx`DELETE FROM unit WHERE stweg_id = ${id}`;
		await tx`DELETE FROM representation WHERE stweg_id = ${id}`;
		await tx`DELETE FROM party WHERE stweg_id = ${id}`;
		await tx`DELETE FROM quota_kind WHERE stweg_id = ${id}`;
		await tx`DELETE FROM bylaw_quorum_rule WHERE stweg_id = ${id}`;
		await tx`DELETE FROM bylaw_attendance_rule WHERE stweg_id = ${id}`;
		/*
		 * **Die Weisungsregeln und die Traktandenordnung gehören dazu**
		 * (01.09.2026). Beide hängen mit einem Fremdschlüssel ohne `ON DELETE` an
		 * der Gemeinschaft, und beide fehlten hier: `bylaw_instruction_rule` seit
		 * Migration 085, `agenda_template_order` seit 097. Eine Gemeinschaft, die
		 * eine Weisungsregel oder eine gespeicherte Reihenfolge trägt, liess sich
		 * dann nicht mehr entfernen — und zwar mit einer rohen 500, weil 23503
		 * bewusst nicht übersetzt wird.
		 *
		 * Im SQL-Aufräumskript standen beide längst. Die Anwendungsfunktion und
		 * das Skript sind zwei Listen derselben Sache, und sie sind
		 * auseinandergelaufen.
		 */
		await tx`DELETE FROM bylaw_instruction_rule WHERE stweg_id = ${id}`;
		await tx`DELETE FROM agenda_template_order WHERE stweg_id = ${id}`;
		/*
		 * **Anhänge gehören dazu** (01.09.2026, aus dem Code-Review). `attachment`
		 * hat keinen Fremdschlüssel auf die Gemeinschaft und blieb deshalb still
		 * als Waise liegen, samt Datei in der Ablage. Im Aufräumskript stand die
		 * Zeile längst.
		 */
		await tx`DELETE FROM attachment WHERE stweg_id = ${id}`;
		await tx`DELETE FROM agenda_item_affected WHERE stweg_id = ${id}`;
		await tx`DELETE FROM stweg WHERE id = ${id}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.gemeinschaftEntfernt, { art: 'stweg', id }, { name: g.name })
		);
	});
}
