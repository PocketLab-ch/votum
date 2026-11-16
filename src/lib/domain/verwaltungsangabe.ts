/**
 * Die Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen
 * (Entscheid 0045, Punkt 11, Produktentscheid 08.11.2026; Migration 185).
 *
 * **Der Anlass.** Ein Folgeantrag erbt das Häkchen «Geschäft der Verwaltung»
 * seines Grundantrags (Entscheid 0045, Punkt 5), und unter «Vollmachten
 * ruhen» ruhen dort die Vollmachten der Verwaltung. Nach Punkt 9 gibt es zwei
 * Lagen, in denen das die Falschen träfe:
 *
 *   - **Eine andere Verwaltung** (Fach R8-2): Ist am Grundantrag ein
 *     Folgeantrag zur Wahl angenommen, kann ein anderer Folgeantrag die
 *     Gewählten betreffen, etwa ihre Entschädigung. Für die bisherige
 *     Verwaltung gibt es dort nach Art. 68 ZGB keinen Ausschlussgrund; nicht
 *     gezählte Stimmen machten den Beschluss anfechtbar (BGer 5A_972/2020
 *     E. 7.2.4).
 *   - **Die Kündigung nach nicht angenommener Abberufung** (Fach R7-2): Sie
 *     wird behandelt wie die Abberufung (als Folgerung aus Rz. 25b ad
 *     Art. 712r; Fachprüfung Runde 14, H1), und wie dort
 *     ruht nichts von selbst; die Leitung entscheidet über den erklärten
 *     Ausstand.
 *
 * **Ein Weg mit zwei Gründen** statt des Mehrs der Abberufung an der
 * Kündigung (Bauweise in Punkt 11): Deren Protokollzeile sagt «ging es um die
 * Abberufung». Votum prüft, was es prüfen kann (das Geschwister ist entschieden
 * wie verlangt); ob der Antrag wirklich eine andere Verwaltung oder die
 * Kündigung betrifft, sagt die Leitung, und das Protokoll nennt ihre Angabe.
 *
 * Hier stehen die Werte, die Wörter für den Verlauf und die Schranken als
 * reine Prüfung; das Lesen und Schreiben steht in `server/verwaltungsangabe.ts`,
 * die Sätze an die Leitung und ins Protokoll in `mehrhinweise.ts`.
 */
import { FachlicherFehler } from './fehler';
import type { Verwaltungsvollmachtwahl } from './lesarten';

export const VERWALTUNGSANGABEN = ['andere_verwaltung', 'kuendigung'] as const;

export type Verwaltungsangabe = (typeof VERWALTUNGSANGABEN)[number];

export function istVerwaltungsangabe(wert: unknown): wert is Verwaltungsangabe {
	return typeof wert === 'string' && (VERWALTUNGSANGABEN as readonly string[]).includes(wert);
}

/**
 * Die Angabe im Verlauf, in Worten (`verlaufswerte.ts`). Derselbe Inhalt wie
 * die Sätze an die Leitung, als Feststellung ohne Anrede.
 */
export const VERWALTUNGSANGABE_IM_VERLAUF: Readonly<Record<Verwaltungsangabe, string>> = {
	andere_verwaltung: 'Der Antrag betrifft eine andere als die bisherige Verwaltung',
	kuendigung: 'Es geht um die Kündigung des Vertrags nach der nicht angenommenen Abberufung'
};

/**
 * Ein entschiedener Folgeantrag zur Wahl oder Abberufung am selben
 * Grundantrag, wie ihn `leseTeilentschiedenIn` liefert (`Teilentscheid`).
 */
export interface Geschwisterentscheid {
	titel: string;
	art: 'wahl' | 'abberufung';
	angenommen: boolean;
}

/**
 * Das Geschwister, das einen Grund trägt: für die andere Verwaltung eine
 * angenommene Wahl, für die Kündigung eine nicht angenommene Abberufung
 * (abgelehnt oder ohne Beschluss, wie `Teilentscheid.angenommen` es führt).
 */
export function tragendesGeschwister(
	grund: Verwaltungsangabe,
	teile: readonly Geschwisterentscheid[]
): Geschwisterentscheid | undefined {
	return teile.find((t) =>
		grund === 'andere_verwaltung' ? t.art === 'wahl' && t.angenommen : t.art === 'abberufung' && !t.angenommen
	);
}

/** Die Gründe, die die entschiedenen Geschwister zulassen, je mit dem Titel des tragenden. */
export function moeglicheVerwaltungsangaben(
	teile: readonly Geschwisterentscheid[]
): { grund: Verwaltungsangabe; titel: string }[] {
	return VERWALTUNGSANGABEN.flatMap((grund) => {
		const t = tragendesGeschwister(grund, teile);
		return t ? [{ grund, titel: t.titel }] : [];
	});
}

/** Was die Prüfung über das Traktandum wissen muss. */
export interface Verwaltungsangabelage {
	/** `spontaneous_kind = 'folgeantrag'`. */
	folgeantrag: boolean;
	/** Das (geerbte) Häkchen «Geschäft der Verwaltung». */
	haekchen: boolean;
	/** Die eingefrorene Wahl L8. */
	wahl: Verwaltungsvollmachtwahl;
	/** Das Erfordernis des Folgeantrags ist die Wahl oder die Abberufung der Verwaltung. */
	verwaltungsknoten: boolean;
	/** Ob am Folgeantrag schon ein Durchgang besteht, und ob er offen ist. */
	durchgang: 'keiner' | 'offen' | 'gewesen';
	gesetzt: Verwaltungsangabe | null;
	teile: readonly Geschwisterentscheid[];
}

// ── Die Absagen ─────────────────────────────────────────────────────────────

export const VERWALTUNGSANGABE_NICHT_HIER =
	'Diese Angabe gibt es nur an einem Folgeantrag mit dem Häkchen «Geschäft der Verwaltung», wenn Ihre ' +
	'Gemeinschaft «Vollmachten ruhen» eingestellt hat.';

/** Am Knoten der Wahl oder Abberufung ruht ohnehin nichts von selbst (Entscheid 8, Punkt 9). */
export const VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN =
	'Bei der Wahl und bei der Abberufung der Verwaltung gibt es diese Angabe nicht: Dort ruhen ihre ' +
	'Vollmachten ohnehin nicht von selbst.';

export const VERWALTUNGSANGABE_OHNE_WAHL =
	'Diese Angabe ist erst möglich, wenn die Versammlung bei diesem Traktandum eine Wahl in einem ' +
	'Folgeantrag angenommen hat.';

export const VERWALTUNGSANGABE_OHNE_ABBERUFUNG =
	'Diese Angabe ist erst möglich, wenn die Versammlung bei diesem Traktandum eine Abberufung in einem ' +
	'Folgeantrag nicht angenommen hat.';

/**
 * Nach dem ersten Durchgang, ausser einem ohne Ergebnis abgebrochenen
 * (Laienprüfung Runde 14, R14-4; `leseLageIn` in `server/verwaltungsangabe.ts`):
 * Die Stimmsperre las die Lage beim Abgeben, und der Schluss hat sie
 * eingefroren; eine Änderung danach liesse Protokoll und Zählung
 * auseinanderlaufen. Der abgebrochene hat kein Ergebnis und verbraucht nichts.
 */
export const VERWALTUNGSANGABE_ABGESTIMMT =
	'Über diesen Antrag ist schon abgestimmt worden; die Angabe lässt sich nicht mehr ändern.';

export const VERWALTUNGSANGABE_OFFEN =
	'Über diesen Antrag wird gerade abgestimmt; die Angabe lässt sich nicht mehr ändern.';

export const VERWALTUNGSANGABE_SCHON_GEMACHT =
	'Die Angabe ist schon gemacht. Um den Grund zu ändern, nehmen Sie sie zuerst zurück.';

export const VERWALTUNGSANGABE_KEINE = 'Es ist keine Angabe gemacht; nichts geändert.';

export const VERWALTUNGSANGABE_GRUND_FEHLT = 'Wählen Sie, worum es bei diesem Antrag geht.';

/**
 * Die Schranken, die Setzen und Zurücknehmen teilen: am Folgeantrag mit
 * Häkchen unter «Vollmachten ruhen», vor seinem ersten Durchgang (ein ohne
 * Ergebnis abgebrochener zählt nicht). Den
 * Zustand der Versammlung prüft die Schale (`verlangeZustand`).
 */
function verlangeAenderbar(lage: Verwaltungsangabelage): void {
	if (!lage.folgeantrag || !lage.haekchen || lage.wahl !== 'ruhen') {
		throw new FachlicherFehler('angabe_nicht_hier', VERWALTUNGSANGABE_NICHT_HIER, 'traktandum');
	}
	if (lage.durchgang === 'offen') {
		throw new FachlicherFehler('durchgang_offen', VERWALTUNGSANGABE_OFFEN, 'traktandum');
	}
	if (lage.durchgang === 'gewesen') {
		throw new FachlicherFehler('schon_abgestimmt', VERWALTUNGSANGABE_ABGESTIMMT, 'traktandum');
	}
}

/**
 * Ob sich die Angabe mit diesem Grund setzen lässt; wirft sonst mit dem Satz
 * an die Leitung. Liefert das Geschwister, das den Grund trägt, für den
 * Verlauf.
 */
export function verlangeVerwaltungsangabe(lage: Verwaltungsangabelage, grund: unknown): Geschwisterentscheid {
	if (!istVerwaltungsangabe(grund)) {
		throw new FachlicherFehler('grund_fehlt', VERWALTUNGSANGABE_GRUND_FEHLT, 'grund');
	}
	verlangeAenderbar(lage);
	// Nach den gemeinsamen Schranken: Ein Folgeantrag zur Wahl ohne Häkchen
	// hört zuerst den Satz, wo es die Angabe gibt.
	if (lage.verwaltungsknoten) {
		throw new FachlicherFehler('angabe_am_verwaltungsknoten', VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN, 'traktandum');
	}
	if (lage.gesetzt) {
		throw new FachlicherFehler('schon_gemacht', VERWALTUNGSANGABE_SCHON_GEMACHT, 'grund');
	}
	const geschwister = tragendesGeschwister(grund, lage.teile);
	if (!geschwister) {
		throw new FachlicherFehler(
			'geschwister_fehlt',
			grund === 'andere_verwaltung' ? VERWALTUNGSANGABE_OHNE_WAHL : VERWALTUNGSANGABE_OHNE_ABBERUFUNG,
			'grund'
		);
	}
	return geschwister;
}

/**
 * Ob sich die gesetzte Angabe zurücknehmen lässt. Ohne die Bedingung am
 * Geschwister und ohne die am Knoten: Zurücknehmen stellt die Vorgabe wieder
 * her und soll auch gehen, wenn das Erfordernis seither gewechselt hat.
 */
export function verlangeVerwaltungsangabeZuruecknehmbar(lage: Verwaltungsangabelage): Verwaltungsangabe {
	if (!lage.gesetzt) {
		throw new FachlicherFehler('keine_angabe', VERWALTUNGSANGABE_KEINE, 'traktandum');
	}
	verlangeAenderbar(lage);
	return lage.gesetzt;
}

/**
 * Was die Leitung am aufgerufenen Folgeantrag sieht: die gesetzte Angabe mit
 * dem Knopf zum Zurücknehmen, oder die Angebote mit dem Knopf zum Angeben.
 * `null`, wo es keine Angabe gibt oder sie sich nicht mehr ändern lässt; die
 * Angebote nur, wo die Verwaltung eine Vollmacht hält, die hier ruhen würde
 * (`vollmachtenRuhen`): ein Angebot zu einem Fall, den es nicht gibt,
 * verlängerte die Leitung nur.
 */
export function verwaltungsangabeImSaal(
	lage: Verwaltungsangabelage | null,
	vollmachtenRuhen: boolean
): { gesetzt: Verwaltungsangabe | null; angebote: { grund: Verwaltungsangabe; titel: string }[] } | null {
	if (!lage || !lage.folgeantrag || !lage.haekchen || lage.wahl !== 'ruhen') return null;
	if (lage.durchgang !== 'keiner') return null;
	if (lage.gesetzt) return { gesetzt: lage.gesetzt, angebote: [] };
	if (lage.verwaltungsknoten || !vollmachtenRuhen) return null;
	const angebote = moeglicheVerwaltungsangaben(lage.teile);
	return angebote.length > 0 ? { gesetzt: null, angebote } : null;
}
