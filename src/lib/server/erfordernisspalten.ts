/**
 * Das Mehrheitserfordernis eines Traktandums, wie es spaltenweise in
 * `agenda_item` steht, und wie es daraus gelesen wird.
 *
 * **Eigenes Modul seit 07.10.2026** (Codeprüfung Block A, «Nur noch aufmerksam
 * machen»): Bis dahin stand `erfordernisAusZeile` in `traktanden.ts`. Die
 * Warnung im Saal und der Verlaufseintrag beim Eröffnen (`einladungsmehr.ts`)
 * brauchen dieselbe Lesart, und `traktanden.ts` bindet `einladungsmehr.ts`
 * schon ein. Von hier holen beide sie ohne Ring.
 */
import type { Erfordernis, Erfordernisquelle, Gesetzesmass, Schritt } from '$lib/domain/entscheidbaum';
import type {
	Betroffenenzustimmung,
	Ergebnistyp,
	Geschaeftsart,
	Kopfbasis,
	Quotenbasis
} from '$lib/domain/regelwerk';
import type { Schwelle, Schwellenart } from '$lib/domain/mehrheit';
import type {
	Angehoerigenlesart,
	AngewandteLesart,
	Ausstandswahl,
	Einsprachewahl,
	Kopfzaehlweise
} from '$lib/domain/lesarten';

/** Die Spalten des Erfordernisses in `agenda_item`. */
export interface ErfordernisSpalten {
	requirement_version: string | null;
	requirement_branch: string | null;
	requirement_node: string | null;
	requirement_type: Ergebnistyp | null;
	requirement_title: string | null;
	requirement_legal_basis: string | null;
	requirement_head_base: Kopfbasis | null;
	requirement_quota_base: Quotenbasis | null;
	requirement_head_numerator: number | null;
	requirement_head_denominator: number | null;
	requirement_head_mode: Schwellenart | null;
	requirement_quota_numerator: number | null;
	requirement_quota_denominator: number | null;
	requirement_quota_mode: Schwellenart | null;
	requirement_business_kind: Geschaeftsart | null;
	requirement_needs_affected_consent: boolean;
	requirement_affected_consent_form: Betroffenenzustimmung | null;
	requirement_source: Erfordernisquelle | null;
	requirement_reason: string | null;
	requirement_risk: boolean | null;
	requirement_abstention_counts: boolean | null;
	/** Seit Migration 169; `null` ohne Lesart. */
	requirement_reading: AngewandteLesart | null;
	/** Seit Migration 170, gesetzt vom Auslöser; `null` heisst Vorgabe. */
	requirement_reading_l1: Ausstandswahl | null;
	/** Seit Migration 172, gesetzt vom Auslöser; `null` heisst Vorgabe. */
	requirement_reading_l3: Einsprachewahl | null;
	/** Seit Migration 189, gesetzt vom Auslöser; `null` heisst Vorgabe. */
	requirement_reading_l10: Angehoerigenlesart | null;
	/** Seit Migration 192, gesetzt vom Auslöser; `null` heisst Vorgabe. */
	requirement_reading_l13?: Kopfzaehlweise | null;
	/** Seit Migration 173; `null` ohne Abweichung der Leitung. */
	requirement_statutory?: Gesetzesmass | null;
	/** Seit Migration 181; nur am Rückkommen, sonst `null`. */
	requirement_reading_reconsidered?: Erfordernis['lesartDesBeschlusses'] | null;
	/** Seit Migration 198; `null` ohne Satz zum Häkchen an der Karte. */
	requirement_rule_secured?: boolean | null;
	requirement_reference: string | null;
	requirement_path: Schritt[] | null;
}

function schwelleAus(z: number | null, n: number | null, art: Schwellenart | null): Schwelle | null {
	return z !== null && n !== null && art !== null ? { zaehler: z, nenner: n, art } : null;
}

/**
 * Baut das Erfordernis aus den Spalten zusammen.
 *
 * Bewusst ohne Rückgriff auf das Regelwerk: Ein Traktandum aus dem Vorjahr trägt
 * eine ältere Fassung, und die Erklärbarkeit darf nicht daran hängen, dass die
 * Fassung noch geladen werden kann (AD-4).
 */
export function erfordernisAusZeile(z: ErfordernisSpalten): Erfordernis | null {
	if (!z.requirement_type || !z.requirement_version) return null;
	return {
		fassung: z.requirement_version,
		// Beim Lesen ist das nicht mehr feststellbar und auch nicht nötig: Die
		// Anzeige holt den Vermerk aus der geladenen Fassung, wo es sie gibt.
		juristischGegengelesen: false,
		astId: z.requirement_branch ?? '',
		knotenId: z.requirement_node ?? '',
		typ: z.requirement_type,
		titel: z.requirement_title ?? '',
		rechtsgrundlage: z.requirement_legal_basis ?? '',
		kopfbasis: z.requirement_head_base ?? 'anwesend_vertreten',
		quotenbasis: z.requirement_quota_base ?? 'keine',
		kopfSchwelle: schwelleAus(
			z.requirement_head_numerator,
			z.requirement_head_denominator,
			z.requirement_head_mode
		),
		quotenSchwelle: schwelleAus(
			z.requirement_quota_numerator,
			z.requirement_quota_denominator,
			z.requirement_quota_mode
		),
		geschaeftsart: z.requirement_business_kind ?? undefined,
		// `null` in der Spalte heisst «nicht festgehalten», also wie vor dem
		// 04.09.2026: Enthaltungen zählen mit. `undefined` trägt genau das.
		enthaltungZaehltMit: z.requirement_abstention_counts ?? undefined,
		zustimmungBetroffenerNoetig: z.requirement_needs_affected_consent,
		// `null` heisst: vor Migration 124 gespeichert; `betroffenenzustimmungVon`
		// ordnet dann über die Kennung des Knotens zu.
		betroffenenzustimmung: z.requirement_affected_consent_form ?? undefined,
		pfad: z.requirement_path ?? [],
		quelle: z.requirement_source ?? 'hergeleitet',
		begruendung: z.requirement_reason ?? undefined,
		risiko: z.requirement_risk ?? undefined,
		fundstelle: z.requirement_reference ?? undefined,
		gemeinschaftslesart: z.requirement_reading ?? undefined,
		ausstandslesart: z.requirement_reading_l1 ?? undefined,
		einspracheLesart: z.requirement_reading_l3 ?? undefined,
		angehoerigenlesart: z.requirement_reading_l10 ?? undefined,
		kopfzaehlweise: z.requirement_reading_l13 ?? undefined,
		gesetzlich: z.requirement_statutory ?? undefined,
		lesartDesBeschlusses: z.requirement_reading_reconsidered ?? undefined,
		regelGesichert: z.requirement_rule_secured ?? undefined
	};
}
