/**
 * Der Kopf der Momentaufnahme, wie ihn beide Leser bauen.
 *
 * **Der Anlass** (Konzept Lesarten, 20.10.2026). Es gibt zwei Leser:
 * `holeMomentaufnahme` in `freigabe.ts` mit eigener Verbindung und
 * `holeMomentaufnahmeIn` in `abstimmung.ts` innerhalb einer laufenden
 * Transaktion. Seit Migration 127 gab nur der erste die eingefrorenen Ausnahmen
 * weiter. Gelesen hat sie über den zweiten noch niemand; der erste Leser dort
 * hätte die Vorgaben gesehen. Ein Kopf, ein Weg: Wer eine Spalte einfriert,
 * trägt sie hier ein, und beide Leser haben sie.
 *
 * Gelesen wird `SELECT *`, damit eine neue Spalte nicht an einer zweiten
 * Spaltenliste hängen bleibt.
 */
import type { Universalvariante } from '$lib/domain/ausnahmen';
import type { Lesartenwahl } from '$lib/domain/lesarten';
import type { HeadCountMode, Id, Snapshot, Stichentscheid } from '$lib/domain/types';

/** Die Spalten von `snapshot`, die der Kopf liest. */
export interface Momentaufnahmezeile {
	meeting_id: string;
	taken_at: Date;
	head_count_mode: HeadCountMode;
	parking_counts_as_head: boolean;
	head_count_rule_source: string | null;
	tie_break: Stichentscheid | null;
	total_quota: number | string;
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
	reading_l15: Lesartenwahl['L15'];
	reading_l16: Lesartenwahl['L16'];
}

export function momentaufnahmeKopf(k: Momentaufnahmezeile, meetingId: Id): Omit<Snapshot, 'parties'> {
	return {
		meetingId,
		takenAt: k.taken_at.toISOString(),
		headCountMode: k.head_count_mode,
		parkingCountsAsHead: k.parking_counts_as_head,
		headCountRuleSource: k.head_count_rule_source,
		tieBreak: k.tie_break ?? 'keiner',
		totalQuota: Number(k.total_quota),
		ausnahmen: {
			reglementGestattet: k.unannounced_bylaw_allowed,
			reglementFundstelle: k.unannounced_bylaw_source,
			universalvariante: k.universal_meeting_mode,
			universalFundstelle: k.universal_meeting_source,
			leitungsvollmachtenZaehlen: k.universal_chair_proxies_count
		},
		lesarten: {
			L1: k.reading_l1,
			L2: k.reading_l2,
			L3: k.reading_l3,
			L4: k.reading_l4,
			L5: k.reading_l5,
			L6: k.reading_l6,
			L7: k.reading_l7,
			L8: k.reading_l8,
			L9: k.reading_l9,
			L10: k.reading_l10,
			L11: k.reading_l11,
			L12: k.reading_l12,
			L13: k.reading_l13,
			L15: k.reading_l15,
			L16: k.reading_l16
		}
	};
}
