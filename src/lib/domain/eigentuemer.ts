/**
 * Eigentümer und ihre Stimmkraft (Story 1.6, FR-3, AD-2).
 *
 * Der Kern der ganzen Anwendung sitzt in `stimmkraft`: Wer eine Kopfstimme hat
 * und wie viel Wertquote, entscheidet über jeden Beschluss. Das Vorgängerprojekt
 * hängte die Kopfstimme an die **Einheit** — ein Eigentümer mit drei Wohnungen
 * bekam dort still drei Kopfstimmen. ZGB Art. 712o Abs. 1 gibt ihm eine, sofern
 * das Reglement nichts anderes bestimmt. Hier hängt sie deshalb an der Person.
 */
import type { HeadCountMode, Id, PartyKind, UnitKind } from './types';
import { FachlicherFehler } from './gemeinschaft';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';

export const PERSONENARTEN: PartyKind[] = ['natural', 'legal', 'gemeinschaft'];

export interface EigentuemerEingabe {
	stwegId: Id;
	kind: PartyKind;
	displayName: string;
	/**
	 * Bei gemeinschaftlichem Eigentum die Person, die die eine Stimme ausübt
	 * (ZGB Art. 712o Abs. 1); bei einer juristischen Person die vertretungs-
	 * berechtigte Person.
	 */
	representativeName: string | null;
	/** Wahr, wenn die Einheit mehreren Personen gemeinsam gehört. */
	isCommunity: boolean;
	/**
	 * Auf welche Gemeinschaft die Partei lautet — nur bei `kind = 'gemeinschaft'`
	 * (Story 7.1). Der Anteil 1/5 an der Umgebungs-MEG gehört keinem Menschen,
	 * sondern dem Haus.
	 */
	memberStwegId?: Id | null;
	email?: string;
	phone?: string;
	address?: string;
}

export interface Eigentuemer extends EigentuemerEingabe {
	id: Id;
	/**
	 * Die Authentik-Kennung, sofern eine hinterlegt ist.
	 *
	 * Sie kommt aus der Übernahme und wird hier **nur gelesen** — geändert wird
	 * sie dort, wo sie herkommt. Sichtbar ist sie, weil ein Wert, den niemand
	 * sieht, nicht überprüfbar ist: Die Frage «wer von diesen Leuten kann sich
	 * später selbst anmelden» muss sich beantworten lassen, ohne in die
	 * Datenbank zu schauen.
	 */
	authentikSubject?: string | null;
	/** Seit wann die Zeile im Archiv liegt (Migration 086). */
	archiviertAm?: string | null;
	archivnotiz?: string | null;
}

/**
 * Welche Angaben ein Eigentümer dieser Art überhaupt führt.
 *
 * **Warum das im Kern steht.** Dieselbe Verzweigung entschied bisher an drei
 * Stellen: in der Seite (welche Felder zu sehen sind), in der Aktion (ob eine
 * Personenklammer gesetzt wird) und in `pruefeEigentuemer` (ob ein Vertreter
 * Pflicht ist). Laufen sie auseinander, kann die Seite ein Feld zeigen, das der
 * Server verwirft — oder umgekehrt eines verlangen, das nie ankommt.
 *
 * **Die Personenklammer gibt es nur für einen einzelnen Menschen oder eine
 * Firma.** Nicht bei gemeinschaftlichem Eigentum — «Erbengemeinschaft Meier»
 * ist keine Person, die anderswo dieselbe wäre —, und nicht bei einer
 * Mitgliedsgemeinschaft: Dahinter steht ein Haus, kein Mensch.
 */
export function eigentuemerfelder(
	kind: PartyKind,
	isCommunity: boolean
): { personenklammer: boolean; vertreter: boolean; mitgliedsgemeinschaft: boolean } {
	return {
		personenklammer: kind !== 'gemeinschaft' && !isCommunity,
		vertreter: kind === 'gemeinschaft' || kind === 'legal' || isCommunity,
		mitgliedsgemeinschaft: kind === 'gemeinschaft'
	};
}

export function pruefeEigentuemer(eingabe: EigentuemerEingabe): EigentuemerEingabe {
	const displayName = eingabe.displayName?.trim() ?? '';
	if (zeichenzahl(displayName) < 2) {
		throw new FachlicherFehler('name_zu_kurz', 'Der Name fehlt oder ist zu kurz.', 'displayName');
	}
	if (zeichenzahl(displayName) > 200) {
		throw new FachlicherFehler('name_zu_lang', 'Der Name ist länger als 200 Zeichen.', 'displayName');
	}

	if (!PERSONENARTEN.includes(eingabe.kind)) {
		throw new FachlicherFehler('art_unbekannt', `Unbekannte Personenart: ${eingabe.kind}.`, 'kind');
	}

	const vertreter = eingabe.representativeName?.trim() || null;

	/*
	 * **Bei gemeinschaftlichem Eigentum ist die Vertretung freiwillig**
	 * (Produktentscheid 27.08.2026). Hier stand bis heute eine Absage
	 * `vertreter_fehlt`, und in der Datenbank die Schranke
	 * `party_vertreter_bei_gemeinschaft` (Migration 006, gefallen mit 096).
	 *
	 * Ist nur einer der Mitberechtigten anwesend, darf die Sitzungsleitung
	 * annehmen, dass er die Gemeinschaft gültig vertritt, und zwar ohne
	 * Vollmacht (Wermelinger, Rz. 19 ad Art. 712o). Am Einlass entscheidet
	 * ohnehin der Zugangscode und nicht der gedruckte Name.
	 *
	 * **Die beiden Prüfungen darunter bleiben** und meinen etwas anderes: Eine
	 * juristische Person und eine Mitgliedsgemeinschaft handeln nie selbst.
	 * `party_vertretung_bei_juristisch` hält beide auch in der Datenbank.
	 */

	// Eine juristische Person handelt nie selbst. Ohne benannte Person wäre am
	// Eingang nicht prüfbar, ob die erschienene Person auftreten darf.
	if (eingabe.kind === 'legal' && !vertreter) {
		throw new FachlicherFehler(
			'vertretung_fehlt',
			'Bei einer juristischen Person ist mindestens eine vertretungsberechtigte Person anzugeben.',
			'representativeName'
		);
	}

	// ── Die Gemeinschaft als Eigentümerin (Story 7.1) ──────────────────────
	const mitglied = eingabe.kind === 'gemeinschaft' ? (eingabe.memberStwegId ?? null) : null;

	if (eingabe.kind === 'gemeinschaft' && !mitglied) {
		throw new FachlicherFehler(
			'mitglied_fehlt',
			'Eine Gemeinschaft als Eigentümerin muss auf eine Gemeinschaft zeigen.',
			'memberStwegId'
		);
	}
	if (eingabe.kind !== 'gemeinschaft' && eingabe.memberStwegId) {
		// Sonst entstünde eine natürliche Person mit einer Gemeinschaft im
		// Rücken, und keine Abfrage wüsste, was daraus folgt.
		throw new FachlicherFehler(
			'mitglied_ohne_art',
			'Nur eine Partei der Art «Gemeinschaft» kann auf eine Gemeinschaft zeigen.',
			'memberStwegId'
		);
	}
	if (mitglied && mitglied === eingabe.stwegId) {
		throw new FachlicherFehler(
			'selbstbezug',
			'Eine Gemeinschaft kann nicht Mitglied ihrer selbst sein.',
			'memberStwegId'
		);
	}
	// Art. 7 Ziff. 3 verlangt einen bezeichneten Vertreter. Ohne ihn stünde die
	// Sitzungsleitung im Moment der Abstimmung vor der Frage, wen sie zählen
	// darf — dieselbe Lücke wie beim gemeinschaftlichen Eigentum.
	if (eingabe.kind === 'gemeinschaft' && !vertreter) {
		throw new FachlicherFehler(
			'vertreter_fehlt',
			'Die Gemeinschaft übt ihre Stimme durch einen bezeichneten Vertreter aus. Tragen Sie ihn ein.',
			'representativeName'
		);
	}

	const email = eingabe.email?.trim() || undefined;
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new FachlicherFehler('email_ungueltig', 'Die E-Mail-Adresse ist unvollständig.', 'email');
	}

	return {
		...eingabe,
		displayName,
		representativeName: vertreter,
		memberStwegId: mitglied,
		email,
		phone: eingabe.phone?.trim() || undefined,
		address: eingabe.address?.trim() || undefined
	};
}

export function legeEigentuemerAn(id: Id, eingabe: EigentuemerEingabe): Uebergang<Eigentuemer> {
	const geprueft = pruefeEigentuemer(eingabe);

	return uebergang(
		{ ...geprueft, id },
		ereignis(
			EREIGNISARTEN.eigentuemerAngelegt,
			{ art: 'party', id },
			{
				name: geprueft.displayName,
				art: geprueft.kind,
				gemeinschaftlich: geprueft.isCommunity,
				mitgliedsgemeinschaft: geprueft.memberStwegId ?? null,
				vertreter: geprueft.representativeName
			}
		)
	);
}

export function aendereEigentuemer(
	bisher: Eigentuemer,
	eingabe: EigentuemerEingabe
): Uebergang<Eigentuemer> {
	const geprueft = pruefeEigentuemer(eingabe);
	const geaendert: Eigentuemer = { ...bisher, ...geprueft };

	const felder: Record<string, { vorher: unknown; nachher: unknown }> = {};
	for (const feld of [
		'displayName',
		'kind',
		'representativeName',
		'isCommunity',
		'email',
		'phone',
		'address'
	] as const) {
		if (bisher[feld] !== geaendert[feld]) {
			felder[feld] = { vorher: bisher[feld] ?? null, nachher: geaendert[feld] ?? null };
		}
	}

	if (Object.keys(felder).length === 0) return uebergang(geaendert);

	return uebergang(
		geaendert,
		ereignis(EREIGNISARTEN.eigentuemerGeaendert, { art: 'party', id: bisher.id }, { felder })
	);
}

// ── Stimmkraft ──────────────────────────────────────────────────────────────

/** Eine Einheit, wie die Stimmkraftrechnung sie braucht. */
export interface StimmkraftEinheit {
	unitId: Id;
	/** Einheit oder Nebenobjekt — entscheidet, ob die Einstellung der Gemeinschaft greift. */
	kind: UnitKind;
	/** Trägt bei der Zählweise «je Einheit» eine eigene Kopfstimme. */
	countsAsHead: boolean;
	/** Wert der Stammquote. Kostenschlüssel spielen für das Stimmrecht keine Rolle. */
	stammquote: number;
}

export interface Stimmkraft {
	partyId: Id;
	kopfstimmen: number;
	wertquote: number;
}

/**
 * Ermittelt die Stimmkraft einer Partei.
 *
 * Bei `per_owner` — dem gesetzlichen Grundsatz — hat jede Partei **eine**
 * Kopfstimme, gleichgültig wie viele Einheiten ihr gehören. Bei `per_unit` zählt
 * jede Einheit, die eine Kopfstimme trägt; ob Nebenobjekte dazugehören, bestimmt
 * die Einstellung der Gemeinschaft.
 *
 * Die Wertquote ist in beiden Fällen die Summe der Stammquoten. Ein
 * Kostenschlüssel wie der Aufzug verändert kein Stimmrecht (ZGB Art. 712e).
 *
 * Eine Partei ohne Einheit hat keine Kopfstimme: Sie ist nicht Mitglied der
 * Gemeinschaft. Das kommt beim Erfassen vor, solange die Zuordnung noch fehlt.
 */
export function stimmkraft(
	partyId: Id,
	einheiten: StimmkraftEinheit[],
	modus: HeadCountMode,
	nebenobjekteZaehlen: boolean
): Stimmkraft {
	const wertquote = einheiten.reduce((summe, e) => summe + e.stammquote, 0);

	// Dieselbe Stelle wie in der Auszählung (`kopfgewicht`), damit die
	// Stimmkraftliste und die Abstimmung nicht auseinanderlaufen.
	return { partyId, kopfstimmen: kopfgewicht({ units: einheiten }, modus, nebenobjekteZaehlen), wertquote };
}

/**
 * Ob eine Einheit bei der Zählung je Einheit eine Kopfstimme trägt.
 *
 * Zwei Ebenen, und die Reihenfolge ist entscheidend: Die Einstellung der
 * Gemeinschaft ist die Obergrenze. Sagt sie «Nebenobjekte zählen nicht», hilft
 * auch ein gesetztes Häkchen bei der einzelnen Einheit nichts — sonst liesse
 * sich die Reglementsregel Einheit für Einheit aushebeln.
 *
 * Eigens herausgezogen, weil die Auszählung dieselbe Frage stellt: Sie muss
 * wissen, welcher Einheit sie eine Kopfstimme zurechnet. Zwei Umsetzungen
 * derselben Regel liefen früher oder später auseinander — und dann zählte die
 * Stimmkraftliste anders als die Abstimmung.
 */
export function traegtKopfstimme(
	einheit: Pick<StimmkraftEinheit, 'kind' | 'countsAsHead'>,
	nebenobjekteZaehlen: boolean
): boolean {
	if (!einheit.countsAsHead) return false;
	if (einheit.kind === 'parking' && !nebenobjekteZaehlen) return false;
	return true;
}

/**
 * Das Gewicht einer Partei bei der Zählung nach Köpfen.
 *
 * **Eine Stelle statt vier** (Lesarten Block 5, Kriterium 11): Der Ausdruck
 * stand viermal in `auszaehlung.ts` und `vonhand.ts`, und eine fünfte Lesart
 * (L3, die Zählung an der Einsprache) hätte ihn erneut verlangt. Bei `per_owner`
 * hat jede Partei mit Einheiten eine Stimme; bei `per_unit` zählt jede Einheit,
 * die eine Kopfstimme trägt (`traegtKopfstimme`). Eine Partei nur mit einem
 * Nebenobjekt ohne Kopfstimme hat je Einheit 0, je Eigentümer 1. Ein Wächter
 * (`scripts/check-kopfgewicht.mjs`) hält fest, dass der Ausdruck ausserhalb
 * dieser Funktion nicht wieder entsteht.
 */
export function kopfgewicht(
	partei: { units: readonly Pick<StimmkraftEinheit, 'kind' | 'countsAsHead'>[] },
	zaehlweise: HeadCountMode,
	nebenobjekteZaehlen: boolean
): number {
	if (zaehlweise === 'per_owner') {
		return partei.units.length > 0 ? 1 : 0;
	}
	return partei.units.filter((u) => traegtKopfstimme(u, nebenobjekteZaehlen)).length;
}

/**
 * Stimmkraft aller Parteien einer Gemeinschaft.
 *
 * Nebeneinander gerechnet und nicht je Partei einzeln, damit die Bezugsgrössen —
 * Summe der Kopfstimmen und Summe der Wertquoten — aus derselben Menge stammen
 * wie die einzelnen Werte. Rechnete man sie getrennt, könnten sie auseinanderfallen.
 */
export interface StimmkraftUebersicht {
	je: Stimmkraft[];
	summeKopfstimmen: number;
	summeWertquote: number;
}

export function stimmkraftAller(
	parteien: { partyId: Id; einheiten: StimmkraftEinheit[] }[],
	modus: HeadCountMode,
	nebenobjekteZaehlen: boolean
): StimmkraftUebersicht {
	const je = parteien.map((p) => stimmkraft(p.partyId, p.einheiten, modus, nebenobjekteZaehlen));
	return {
		je,
		summeKopfstimmen: je.reduce((s, k) => s + k.kopfstimmen, 0),
		summeWertquote: je.reduce((s, k) => s + k.wertquote, 0)
	};
}
