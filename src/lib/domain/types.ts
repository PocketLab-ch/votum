/**
 * Verbindliche Begriffe aus dem PRD-Glossar, einmal festgelegt.
 *
 * Kein Synonym, kein `Tenant` — der Begriff war im Vorgängerprojekt zweideutig
 * belegt (mal Gemeinschaft, mal Betreiber). Wer hier einen neuen Domänenbegriff
 * einführt, trägt ihn zuerst ins Glossar des PRD ein.
 *
 * Diese Datei gehört zum Kern und ist frei von I/O (AD-1).
 */

import type { AusnahmenNichtangekuendigtes } from './ausnahmen';
import type { Lesartenwahl } from './lesarten';

/** Zeitpunkt in koordinierter Weltzeit, als ISO-Zeichenkette (AD-12). */
export type Zeitpunkt = string;

/** Kennung. UUID v7, damit sie zeitlich sortierbar ist und keine Menge verrät. */
export type Id = string;

// ── Struktur ────────────────────────────────────────────────────────────────

/** Die Bewirtschaftungsfirma. Oberste Mandantenebene; in Version 1 gibt es genau eine. */
export interface Operator {
	id: Id;
	name: string;
}

/**
 * Zählweise der Kopfstimme (AD-2).
 *
 * `per_owner` ist der gesetzliche Grundsatz: Jeder Stockwerkeigentümer hat eine
 * Kopfstimme, unabhängig von der Zahl seiner Einheiten. `per_unit` gilt nur, wo
 * das Reglement die Zuteilung je Einheit ausdrücklich vorsieht.
 */
export type HeadCountMode = 'per_owner' | 'per_unit';

/**
 * Wie ein Gleichstand der Kopfstimmen aufgelöst wird.
 *
 * `keiner` ist die gesetzliche Lage: Wer die Mehrheit nicht hat, hat sie nicht —
 * sieben Ja gegen sieben Nein heisst abgelehnt. `wertquote` gilt nur, wo das
 * Reglement es vorsieht; dann entscheidet bei gleicher Kopfzahl die
 * Anteilsberechtigung (so etwa Art. 30 des Reglements der STWEG Nirgendheim
 * GB 9999). Die Regel hängt an der Gemeinschaft, nicht am einzelnen Geschäft.
 */
/**
 * Wie ein Gleichstand aufgelöst wird, wo das Reglement es regelt.
 *
 *   - `keiner`    — die gesetzliche Lage: Gleichstand heisst nicht angenommen.
 *   - `wertquote` — es entscheidet die Anteilsberechtigung (STOWE Nirgendweg 5
 *                   Haus 4, Art. 30). Rechenbar.
 *   - `verwalter` — das Reglement sieht den Verwalter vor (etwa
 *                   Art. 7 Ziff. 5). Die Anwendung hält beim Gleichstand an,
 *                   bis der Entscheid eingetragen ist (Produktentscheid
 *                   28.09.2026); empfohlen ist die Ablehnung.
 */
export type Stichentscheid =
	| 'keiner'
	| 'wertquote'
	| 'verwalter'
	| 'vorsitz'
	| 'wertquote_verwalter'
	| 'wertquote_vorsitz';

/*
 * Die drei Werte nach `verwalter` (Migration 149, Auftrag 07.10.2026) bilden
 * zwei Dinge ab, die eine Einzelwahl nicht kann:
 *
 *   - `vorsitz` — die Person im Vorsitz entscheidet. Das ist nicht zwingend
 *     der Verwalter: Die Versammlung kann jemand anderen wählen (Rz. 75 und
 *     76a ad Art. 712n). Wer es ist, ergibt sich erst im Saal.
 *   - `wertquote_…` — eine **Kaskade**: erst die Anteilsberechtigung, und nur
 *     wenn die Wertquoten auf beiden Seiten gleich sind, die Person. Ohne die
 *     zweite Stufe ist der Antrag bei gleichen Quoten abgelehnt (`wertquote`).
 *
 * Gelesen wird die Regel über `quotenstufe` und `personenstufe` in
 * `gemeinschaft.ts`, nicht über den Wert selbst.
 */

/** Stockwerkeigentümergemeinschaft. Bildet Mehrhausanlagen über `parentStwegId` ab. */
export interface Stweg {
	id: Id;
	operatorId: Id;
	parentStwegId: Id | null;
	name: string;
	/** Nenner der Wertquoten, üblich 1000. Null bedeutet: reine Klammer ohne eigene Quote. */
	quotaDenominator: number;
	headCountMode: HeadCountMode;
	/** Bei `per_unit`: ob Nebenobjekte eine eigene Kopfstimme tragen. */
	parkingCountsAsHead: boolean;
	/** Wie ein Gleichstand aufgelöst wird; `keiner` ist die gesetzliche Lage. */
	tieBreak: Stichentscheid;
}

export type UnitKind = 'unit' | 'parking';

/**
 * Eine Quotenart der Gemeinschaft.
 *
 * Reglemente kennen selten nur einen Schlüssel: Neben der **Stammquote** aus dem
 * Grundbuch stehen Verteiler für Aufzug, Heizung oder Waschküche, an denen nicht
 * jede Einheit gleich beteiligt ist. Genau eine Art je Gemeinschaft ist die
 * Stammquote; sie ist die Bezugsgrösse für das Stimmrecht nach Wertquote
 * (ZGB Art. 712e). Die übrigen sind Kostenschlüssel und verändern kein Quorum,
 * solange das Reglement nichts anderes vorsieht.
 */
export interface QuotaKind {
	id: Id;
	stwegId: Id;
	/** Kurzschlüssel, gemeinschaftsweit eindeutig: `stamm`, `lift`, `heizung`. */
	key: string;
	name: string;
	/** Nenner dieser Art. Jede Art hat ihren eigenen; 1000 für die eine, 100 für die andere. */
	denominator: number;
	/** Genau eine Art je Gemeinschaft trägt dies. */
	isPrimary: boolean;
	sortOrder: number;
}

/** Eine Stockwerkeinheit oder ein Nebenobjekt. */
export interface Unit {
	id: Id;
	stwegId: Id;
	kind: UnitKind;
	label: string;
	/**
	 * Werte je Quotenart, als Ganzzahl in der kleinsten Einheit des jeweiligen
	 * Nenners. Nie Gleitkomma (AD-12). Eine Art ohne Eintrag bedeutet: an diesem
	 * Schlüssel nicht beteiligt — etwa eine Erdgeschosswohnung am Aufzug.
	 */
	quotas: Record<string, number>;
}

/**
 * Wer eine Einheit halten kann.
 *
 *   - `natural`      — ein Mensch.
 *   - `legal`        — eine juristische Person; handelt nie selbst.
 *   - `gemeinschaft` — eine **andere Gemeinschaft dieses Systems** (Story 7.1).
 *     Der Fall der Miteigentümerschaft, deren Anteile den beteiligten Häusern
 *     gehören: MEG Umgebung Art. 7 Ziff. 3. Die Stimme übt ein bezeichneter
 *     Vertreter aus.
 */
export type PartyKind = 'natural' | 'legal' | 'gemeinschaft';

/** Eine stimmberechtigte Person oder Personengruppe. Trägt die Kopfstimme, nicht die Einheit. */
export interface Party {
	id: Id;
	stwegId: Id;
	kind: PartyKind;
	displayName: string;
	/** Bei gemeinschaftlichem Eigentum: die Person, die die eine Stimme ausübt (ZGB 712o Abs. 1). */
	representativeName: string | null;
}

// ── Momentaufnahme (AD-3) ───────────────────────────────────────────────────

/**
 * Der bei der Freigabe eingefrorene Stimmberechtigtenstand.
 *
 * Alle Berechnungen lesen ausschliesslich diese Struktur, nie die lebenden
 * Stammdaten. Ein Eigentümerwechsel im März verändert damit das Ergebnis der
 * Februar-Versammlung nicht.
 */
export interface SnapshotParty {
	partyId: Id;
	displayName: string;
	/** Bei gemeinschaftlichem Eigentum: die Person, die die eine Stimme ausübt (ZGB 712o Abs. 1). */
	representativeName: string | null;
	isCommunity: boolean;
	/**
	 * Die Authentik-Kennung, über die sich diese Partei selbst anmelden kann.
	 *
	 * Beim Einfrieren mitkopiert und ab da unveränderlich — wie alles hier.
	 * Sie beantwortet «wer bist du», nie «was zählst du»: Die Stimme steht in
	 * `units` und in den Quoten.
	 */
	authentikSubject?: string | null;
	/**
	 * Einheiten dieser Partei mit ihrer Stammquote.
	 *
	 * Nur die Stammquote, nicht alle Schlüssel: Die Auszählung nach Wertquoten
	 * stützt sich auf sie. Führte die Momentaufnahme mehrere, müsste bei jeder
	 * Zählung entschieden werden, welche gilt — und diese Entscheidung gehört
	 * nicht in die Auszählung.
	 */
	units: {
		unitId: Id;
		label: string;
		kind: UnitKind;
		countsAsHead: boolean;
		quota: number;
		/**
		 * Die am Versammlungstag gültige Nutzniessung (FR-4, FR-22) — mit
		 * eingefroren, weil sich sonst nachträglich änderte, wer stimmberechtigt
		 * war. `null` heisst: keine.
		 */
		nutzniessung?: {
			holderName: string;
			hasAgreement: boolean;
			agreementSummary: string | null;
			/** Ob der Vertrag bei der Freigabe der Bewirtschaftung vorlag (Vermerk). */
			contractOnFile: boolean;
			/** Ob zusätzlich eine Kopie hinterlegt war. */
			hasDocument: boolean;
		} | null;
	}[];
}

export interface Snapshot {
	meetingId: Id;
	takenAt: Zeitpunkt;
	headCountMode: HeadCountMode;
	parkingCountsAsHead: boolean;
	/**
	 * Die Fundstelle im Reglement, auf die sich die Zählung je Einheit stützt —
	 * mit eingefroren, weil sie sonst in der Auswertung einer alten Versammlung
	 * mit dem heutigen Stand der Stammdaten erschiene. Null bei der gesetzlichen
	 * Auffangregel und bei Momentaufnahmen aus der Zeit vor Migration 022.
	 */
	headCountRuleSource: string | null;
	/**
	 * Der beim Freigeben geltende Stichentscheid — eingefroren wie die Zählweise.
	 * Ein später geändertes Reglement darf ein gefasstes Ergebnis nicht mehr
	 * verschieben.
	 */
	tieBreak: Stichentscheid;
	/** Summe aller Wertquoten der Gemeinschaft — Bezugsgrösse für das qualifizierte Mehr. */
	totalQuota: number;
	/**
	 * Wann über ein nicht angekündigtes Geschäft doch beschlossen werden darf,
	 * wie es bei der Freigabe stand (Migration 127). Eingefroren wie die
	 * Zählweise: Im Saal umgestellt, gälte für die Anwesenden eine andere Regel
	 * als für die, die der Einladung vertraut haben. Fehlt es, gelten die
	 * Vorgaben, also keine Ausnahme des Reglements.
	 */
	ausnahmen?: AusnahmenNichtangekuendigtes;
	/**
	 * Die Lesarten der Gemeinschaft bei der Freigabe (Migration 169). Gerechnet
	 * wird nach dem Erfordernis am Traktandum, das sie beim Herleiten trägt;
	 * hier stehen sie für Traktanden, die erst nach der Freigabe ein
	 * Erfordernis bekommen, und als Beleg. Fehlt es, gelten die Vorgaben.
	 */
	lesarten?: Lesartenwahl;
	parties: SnapshotParty[];
}

// ── Abstimmung ──────────────────────────────────────────────────────────────

/**
 * Stimmzustände je Einheit und Durchgang (AD-15).
 *
 * Die drei Zustände werden nie ineinander überführt. Ob eine Nichtabgabe wie
 * eine Enthaltung wirkt, bestimmt allein das Regelwerk — nie eine Voreinstellung
 * im Code. Das Vorgängerprojekt setzte fehlende Stimmen still auf `abstain`, und
 * weil eine Enthaltung beim einfachen Mehr wie ein Nein wirkt, entschied diese
 * Voreinstellung über Annahme oder Ablehnung.
 */
export type VoteChoice = 'yes' | 'no' | 'abstain';

export interface Vote {
	partyId: Id;
	unitId: Id;
	choice: VoteChoice;
	castAt: Zeitpunkt;
	/** Wahr, wenn die Sitzungsleitung sie erfasst hat und nicht die Person selbst. */
	recordedByChair: boolean;
}

/** Beim Schliessen festgeschriebener Anwesenheitsstand (AD-16). */
export interface AttendanceState {
	presentPartyIds: Id[];
	/** Für Welle 2: vertretene Parteien mit ihrem Vertreter. */
	representedPartyIds: Id[];
}
