/**
 * Was das Reglement zur Höhe der Einlage in den Erneuerungsfonds sagt (Auftrag
 * «Erneuerungsfonds im Regelwerk und Obergrenze aus dem Reglement»,
 * 15.11.2026; Migration 193).
 *
 * **Gezeigt, nicht gerechnet** (Produktentscheid 15.11.2026, «Frage im Finder
 * und Eintrag», kein Betragsvergleich). Die Grenze steht in Einheiten, die von
 * Haus zu Haus wechseln, und der Betrag des Antrags steht als Text im Antrag.
 * Die Anwendung nennt die hinterlegte Bestimmung an der Frage
 * `f4-1-fonds-reglement` und hebt die Antworten hervor, die zu ihrer Art
 * passen; welche zutrifft, entscheidet die Leitung am Antrag. Dasselbe Muster
 * wie die Änderungsschranke an `f3-1-selbst`.
 *
 * **Die Kennungen stehen wörtlich hier** wie in `regelNurFallgenau`: Der Kern
 * kann die Fassungsdaten nicht einbinden. Die Probe
 * `tests/domain/fondsgrenze.test.ts` hält sie an der Fassung 2026-11-18 fest.
 *
 * Wortlaut der Sätze nach der Website (`/ratgeber/erneuerungsfonds/`, Karte
 * «Einlagen festlegen und ändern»), Laien- und Fachprüfung in `quellen`
 * `pruefung/berichte/2026-11-15-votum-erneuerungsfonds-*`.
 */
import type { Erfordernis } from './entscheidbaum';
import { FachlicherFehler } from './fehler';
import { zeichenzahl } from './zeichenzahl';

export const FONDSGRENZE_ARTEN = ['fest', 'in_der_regel', 'mindest', 'hoehe_anpassbar', 'hoehe_fest'] as const;
export type Fondsgrenzenart = (typeof FONDSGRENZE_ARTEN)[number];

export function istFondsgrenzenart(x: unknown): x is Fondsgrenzenart {
	return typeof x === 'string' && (FONDSGRENZE_ARTEN as readonly string[]).includes(x);
}

/** Die Beschriftung je Art, für die Maske und den Verlauf. */
export const FONDSGRENZE_ART_TEXT: Record<Fondsgrenzenart, string> = {
	fest: 'Feste Obergrenze, die nicht überschritten werden darf',
	in_der_regel: 'Obergrenze, die nur «in der Regel» gilt',
	mindest: 'Mindesteinlage oder Stand, ab dem die Einzahlungen ruhen',
	hoehe_anpassbar: 'Höhe oder Grenze, die die Versammlung ohne besonderes Mehr anpassen darf',
	hoehe_fest: 'Feste Höhe, ohne Anpassung durch die Versammlung'
};

/** Was daraus für das Mehr folgt, je Art (Website, Karte «Einlagen festlegen und ändern»). */
export const FONDSGRENZE_FOLGE: Record<Fondsgrenzenart, string> = {
	fest:
		'Bis zu dieser Grenze beschliesst die Versammlung mit einfachem Mehr. Darüber braucht es dasselbe Mehr wie ' +
		'für eine Reglementsänderung.',
	in_der_regel:
		'Bis zu dieser Grenze beschliesst die Versammlung mit einfachem Mehr. Darüber ist offen, ob eine begründete ' +
		'Ausnahme mit einfachem Mehr genügt; sicher ist der Beschluss mit dem Mehr einer Reglementsänderung.',
	// Enger nach der Fachprüfung Runde 2 (N-3): Eine Einlage über der Mindesteinlage hält sie ein.
	mindest:
		'Bleibt der Antrag unter der Mindesteinlage oder lässt er weiter einzahlen, obwohl der Stand erreicht ist, ' +
		'braucht es dasselbe Mehr wie für eine Reglementsänderung. Sonst genügt das einfache Mehr.',
	// Fachprüfung Runde 2, N-7; Laienprüfung Runde 2, N2: wie Votum ein eigenes Anpassungsmehr rechnet.
	hoehe_anpassbar:
		'Die Versammlung passt sie mit einfachem Mehr an, soweit dieses Recht reicht; darüber braucht es das Mehr einer ' +
		'Reglementsänderung. Nennt das Reglement für die Anpassung ein eigenes Mehr, rechnet Votum es nur, wenn Sie es ' +
		'zusätzlich unter «Reglement und Quoren», «Hinterlegte Abweichungen», für die Einlage in den Erneuerungsfonds ' +
		'hinterlegen.',
	// Ohne «in der Regel»: Die Ausnahme, die der Vorbehalt meint, ist die anpassbare Höhe (Laienprüfung 10).
	hoehe_fest: 'Eine andere Höhe braucht das Mehr einer Reglementsänderung.'
};

/** Die Frage im Finder, an der die Bestimmung steht. */
export const FONDSGRENZE_FRAGE = 'f4-1-fonds-reglement';

/** Die Antworten der Frage, die zur hinterlegten Art passen. */
export const FONDSGRENZE_ANTWORTEN: Record<Fondsgrenzenart, string[]> = {
	fest: ['f4-1-fonds-im-rahmen', 'f4-1-fonds-ueber-fest'],
	in_der_regel: ['f4-1-fonds-im-rahmen', 'f4-1-fonds-in-der-regel'],
	mindest: ['f4-1-fonds-im-rahmen', 'f4-1-fonds-mindest'],
	hoehe_anpassbar: ['f4-1-fonds-anpassbar', 'f4-1-fonds-ueber-fest', 'f4-1-fonds-in-der-regel'],
	hoehe_fest: ['f4-1-fonds-im-rahmen', 'f4-1-fonds-hoehe']
};

/** Die Karten zur Einlage, an denen die Bestimmung am Traktandum und in der Leitung steht; nicht das Errichten. */
export const FONDSGRENZE_KARTEN = [
	'k-erneuerungsfonds',
	'k-erneuerungsfonds-ueber-reglement',
	'k-erneuerungsfonds-grenze-in-der-regel'
] as const;

export interface Fondsgrenze {
	art: Fondsgrenzenart;
	/** Die Bestimmung, wie sie im Reglement steht. */
	wortlaut: string;
	fundstelle: string;
}

/**
 * Prüft die Eingabe der Maske. Ohne Art `null`: Die Bestimmung ist dann
 * herausgenommen, und Wortlaut und Fundstelle gehen mit, wie bei der
 * Einberufungsfrist.
 */
export function pruefeFondsgrenze(
	art: string | null | undefined,
	wortlaut: string | null | undefined,
	fundstelle: string | null | undefined
): Fondsgrenze | null {
	if (art === null || art === undefined || art === '') return null;
	if (!istFondsgrenzenart(art)) {
		throw new FachlicherFehler('fondsgrenze_art_unbekannt', 'Wählen Sie, was Ihr Reglement zur Höhe der Einlage sagt.', 'fondsgrenzeArt');
	}
	const text = wortlaut?.trim() ?? '';
	if (zeichenzahl(text) < 3) {
		throw new FachlicherFehler(
			'fondsgrenze_ohne_wortlaut',
			'Schreiben Sie die Bestimmung so ab, wie sie im Reglement steht.',
			'fondsgrenzeWortlaut'
		);
	}
	const beleg = fundstelle?.trim() ?? '';
	if (zeichenzahl(beleg) < 3) {
		throw new FachlicherFehler(
			'fondsgrenze_ohne_fundstelle',
			'Zur Bestimmung über den Erneuerungsfonds gehört die Fundstelle im Reglement.',
			'fondsgrenzeFundstelle'
		);
	}
	return { art, wortlaut: text, fundstelle: beleg };
}

/**
 * Die Änderungsschranke an der Frage zur Einlage (Migration 101; Codeprüfung
 * 15.11.2026, M3). Die Karten über Grenze oder Höhe rechnen mit dem
 * qualifizierten Mehr oder einer hinterlegten Regel, nicht mit der Schranke;
 * ob sie für eine abweichende Einlage gilt, ist nicht geklärt.
 */
export function fondsgrenzeSchrankeSatz(fundstelle: string | null): string {
	return (
		// Ohne «rechnen nicht damit»: Mit einer hinterlegten Regel der Zustimmung aller rechnen die Karten
		// seit M4 sehr wohl damit (Fachprüfung Runde 4, N4-3). Reichweite vorne, Schritt hinten (Laien N4-3).
		'Weicht der Antrag vom Reglement ab: Diese Gemeinschaft hat hinterlegt, dass das Reglement für seine eigene ' +
		'Änderung Einstimmigkeit verlangt' +
		(fundstelle ? ` (${fundstelle})` : '') +
		'. Ob diese Klausel auch für eine solche Einlage gilt, ist nicht geklärt; sicher ist der Beschluss mit der ' +
		'Zustimmung aller. Lassen Sie das vor der Versammlung durch Ihre Verwaltung oder eine Fachperson klären.'
	);
}

/** Der Satz, der die hinterlegte Bestimmung nennt, mit Fundstelle, Art und Folge. */
export function fondsgrenzeSatz(g: Fondsgrenze): string {
	return (
		`Ihre Gemeinschaft hat aus dem Reglement hinterlegt: «${g.wortlaut}» (${g.fundstelle}). ` +
		`Art: ${FONDSGRENZE_ART_TEXT[g.art]}. ${FONDSGRENZE_FOLGE[g.art]} ` +
		// Laienprüfung 12: Der Satz soll nicht wie ein geprüfter Betrag aussehen.
		'Votum vergleicht den beantragten Betrag nicht; ob der Antrag die Bestimmung einhält, entscheiden Sie.'
	);
}

/**
 * Der Satz an einer Karte zur Einlage, am Traktandum und vor der Abstimmung.
 * `null` an jeder anderen Karte und ohne hinterlegte Bestimmung: Dann bleibt
 * alles wie ohne diesen Baustein.
 */
export function fondsgrenzeKartensatz(
	e: Pick<Erfordernis, 'knotenId'> | null | undefined,
	g: Fondsgrenze | null | undefined
): string | null {
	if (!e || !g) return null;
	if (!(FONDSGRENZE_KARTEN as readonly string[]).includes(e.knotenId)) return null;
	return fondsgrenzeSatz(g);
}
