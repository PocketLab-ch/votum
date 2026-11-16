/**
 * Eine Versammlung an ein anderes Gerät abgeben (Produktentscheid 18.09.2026).
 *
 * **Warum es das gibt.** Im Versammlungsraum läuft die Anwendung auf einem
 * Notebook ohne Netz. Bis hierher kam von dort nur das fertige Abschlusspaket
 * zurück, und zwar als Fund: Migration 061 legt eine Nachweiszeile an, keine
 * Versammlung. Damit hängt an einer offline geführten Versammlung kein
 * Protokoll, keine Genehmigung und kein Fristenlauf.
 *
 * **Das Ausleihmodell.** Die vorbereitete Versammlung wird abgegeben und hier
 * gesperrt; sie kommt mit ihrem Abschlusspaket zu ihrer eigenen Zeile zurück.
 * Die Sperre selbst steht in der Datenbank (Migration 117) und nicht hier:
 * Erhoben am 18.09.2026 gibt es in der Anwendung keinen Ort, durch den alle
 * Schreibwege einer Versammlung laufen. Was hier steht, sind die Regeln davor,
 * also die Frage, ob abgegeben werden darf, und die Sätze, die das erklären.
 *
 * Entwurf: `docs/plan-notebook-und-protokollzustellung-2026-09-18.md`.
 */
import { FachlicherFehler } from './fehler';
import { verlangeZustand, type Versammlung } from './versammlung';
import { zeichenzahl } from './zeichenzahl';

/** Der Leihschein, wie ihn die Anwendung sieht. */
export interface Abgabe {
	id: string;
	versammlungId: string;
	/** Das Gerät, für das das Paket verschlüsselt wurde. */
	geraetId: string;
	/** Wie es zum Zeitpunkt der Abgabe hiess: «Notebook Saal». */
	geraet: string | null;
	abgegebenAm: string;
	abgegebenDurch: string | null;
	paketPruefsumme: string;
	paketGroesse: number;
	zurueckAm: string | null;
	zurueckDurch: string | null;
	zurueckSiegel: string | null;
	zurueckgenommenAm: string | null;
	zurueckgenommenDurch: string | null;
	zurueckgenommenGrund: string | null;
}

/** Ist diese Abgabe noch offen, die Versammlung also unterwegs? */
export function istUnterwegs(a: Pick<Abgabe, 'zurueckAm' | 'zurueckgenommenAm'>): boolean {
	return a.zurueckAm === null && a.zurueckgenommenAm === null;
}

export interface Abgabelage {
	moeglich: boolean;
	hindernisse: string[];
	offen: Abgabe | null;
}

/**
 * Darf diese Versammlung abgegeben werden?
 *
 * **Nur im Zustand «freigegeben»**, und das ist keine Vorsicht, sondern folgt
 * aus AD-3: Mit der Freigabe steht die Momentaufnahme, und ab da rechnet die
 * Versammlung auf ihr statt auf den Stammdaten. Eine Versammlung im Entwurf
 * abzugeben hiesse, die Momentaufnahme auf dem anderen Gerät entstehen zu
 * lassen — aus Stammdaten, die inzwischen hier weiterlaufen. Zwei
 * Stimmberechtigtenstände zur selben Versammlung, und keiner wüsste, welcher
 * gilt.
 *
 * Eine laufende Versammlung ist ohnehin zu spät: Wer im Saal sitzt, gibt nichts
 * mehr ab.
 */
export function erhebeAbgabelage(
	versammlung: Pick<Versammlung, 'zustand'>,
	offen: Abgabe | null
): Abgabelage {
	const hindernisse: string[] = [];

	if (offen) {
		return { moeglich: false, hindernisse: [], offen };
	}

	if (versammlung.zustand !== 'freigegeben') {
		hindernisse.push(
			versammlung.zustand === 'entwurf'
				? 'Diese Versammlung ist noch im Entwurf. Geben Sie sie erst frei: Damit steht fest, wer stimmberechtigt ist, und genau dieser Stand reist mit.'
				: versammlung.zustand === 'laufend'
					? 'Diese Versammlung läuft bereits. Abgegeben wird vor dem Saal, nicht darin.'
					: 'Diese Versammlung ist abgeschlossen. Abgegeben wird eine vorbereitete Versammlung.'
		);
	}

	return { moeglich: hindernisse.length === 0, hindernisse, offen: null };
}

/** Wirft, wenn nicht abgegeben werden darf. */
export function verlangeAbgebbar(
	versammlung: Pick<Versammlung, 'zustand'>,
	offen: Abgabe | null
): void {
	if (offen) {
		throw new FachlicherFehler(
			'schon_abgegeben',
			'Diese Versammlung ist bereits an ein anderes Gerät abgegeben. Eine zweite Abgabe daneben ergäbe zwei Geräte, die dieselbe Versammlung führen.',
			'abgabe'
		);
	}
	verlangeZustand(versammlung, ['freigegeben'], 'abgeben');
}

/**
 * Der Grund für eine Rücknahme ist Pflicht.
 *
 * Eine Sperre, die ohne Begründung verschwindet, sieht ein Jahr später aus wie
 * ein Fehler in der Anwendung. Und sie ist der einzige Weg, eine Abgabe ohne
 * Paket zu beenden: Danach gilt hier wieder der Stand von vor dem Abend, und
 * was auf dem anderen Gerät geschah, ist verloren. Das gehört benannt.
 */
export function verlangeRuecknahmegrund(grund: string): string {
	const sauber = grund.trim();
	if (zeichenzahl(sauber) < 5) {
		throw new FachlicherFehler(
			'grund_fehlt',
			'Sagen Sie, warum die Abgabe zurückgenommen wird, etwa «Notebook defekt, Versammlung wird hier geführt». Der Satz steht später im Verlauf.',
			'grund'
		);
	}
	return sauber;
}

/**
 * Was auf der Seite steht, solange die Versammlung unterwegs ist.
 *
 * Ein Satz und kein Wort: Wer die Seite öffnet und die Knöpfe vermisst, soll
 * nicht suchen müssen, warum.
 */
export function abgabehinweis(a: Abgabe, datum: (iso: string) => string): string {
	const wohin = a.geraet?.trim() ? `an ${a.geraet.trim()}` : 'an ein anderes Gerät';
	return (
		`Diese Versammlung ist ${wohin} abgegeben, am ${datum(a.abgegebenAm)}. ` +
		'Bis zur Rückgabe wird sie dort geführt und hier nicht verändert.'
	);
}

/**
 * Wie ein Fingerabdruck am Bildschirm steht: acht Gruppen zu vier Zeichen.
 *
 * **Im Kern und nicht neben der Krypto**, obwohl er dort entsteht: Die Seite
 * zeigt ihn, und die Seite läuft im Browser. Ein Aufruf in das Servermodul
 * zöge `node:crypto` mit, und das bricht dort.
 *
 * Verglichen werden die ersten 32 Zeichen. Wer 64 Zeichen von Auge vergleicht,
 * vergleicht in Wahrheit die ersten und die letzten vier; die Hälfte eines
 * SHA-256 ist für diesen Zweck mehr als genug.
 */
export function fingerabdruckInGruppen(wert: string): string {
	return (wert.slice(0, 32).match(/.{4}/g) ?? []).join(' ');
}
