/**
 * Die Zuordnung, die die Leitung vor dem Freigeben einer Abstimmung bestätigt
 * (Ä-05, nur der Kern; `docs/freigabe.md`, Abschnitt 0; Auftrag M4).
 *
 * **Was bleibt von Ä-05.** Die Zweitprüfung verlangte einen Zustandsautomaten
 * mit acht Auslösern und drei Pflichtfeldern. Entschieden ist weniger: Die
 * Leitung bestätigt Geschäftsart, Ausstand und Stimmberechtigte vor dem
 * Öffnen, mit einem Klick und ohne Hindernis, und die Bestätigung steht im
 * Verlauf. Die Warnung beim milderen Mehr ist schon gebaut
 * (`domain/einladungsmehr.ts`) und hier nicht berührt.
 *
 * **Der Klick ist der Knopf zum Freigeben.** Ein eigenes Häkchen davor wäre
 * ein Pflichtfeld, das die Entscheidung ausschliesst; ohne Pflicht wäre es
 * nichts wert. Bestätigt wird deshalb, was über dem Knopf steht, und der
 * Server prüft, dass es noch gilt (`zuordnungsmarke`).
 */

import { GESCHAEFTSARTEN, type Geschaeftsart } from './regelwerk';

/** Die Zuordnung eines Traktandums, wie sie beim Laden oder Freigeben gilt. */
export interface Zuordnung {
	/**
	 * Die Geschäftsart des Traktandums (`requirement_business_kind`), als
	 * Codewort; `null`, wo das Erfordernis keine trägt, etwa aus einer
	 * Reglementsregel ohne Geschäftsart.
	 */
	geschaeftsart: Geschaeftsart | null;
	/** Die nötige Mehrheit, also der Titel des Erfordernisses; `null` ohne eines. */
	erfordernis: string | null;
	/** Wer im Ausstand ist, mit Namen, in der Reihenfolge der Erklärung. */
	imAusstand: string[];
	/** Wie viele Stimmparteien anwesend sind (vertreten zählt mit), und von wie vielen. */
	anwesend: number;
	gesamt: number;
	/** Was Seite und Server vergleichen, siehe `zuordnungsmarke`. */
	marke: string;
}

/**
 * Woran der Server erkennt, dass die bestätigte Zuordnung noch gilt.
 *
 * **Geschäftsart, Mehrheit und Ausstand, nicht die Anwesenheit.** Wer im Saal ist,
 * ändert sich laufend, und beim Freigeben zählt der Stand des Servers; so hält
 * es die Seite schon bei der Beschlussfähigkeit. Geschäftsart, Mehrheit und
 * Ausstand dagegen ändert nur ein Eingriff. Hat ihn ein anderes Gerät vorgenommen,
 * bestätigte der Klick etwas, das nicht mehr gilt.
 *
 * Die Fassung und der Knoten gehören dazu: Zwei Erfordernisse können denselben
 * Titel tragen und verschieden rechnen.
 */
export function zuordnungsmarke(
	erfordernis: { fassung?: unknown; knotenId?: unknown; titel?: unknown } | null,
	geschaeftsart: string | null,
	ausstandParteiIds: readonly string[]
): string {
	const e = erfordernis
		? [erfordernis.fassung, erfordernis.knotenId, erfordernis.titel].map((x) => String(x ?? ''))
		: null;
	return JSON.stringify({ e, g: geschaeftsart, a: [...ausstandParteiIds].sort() });
}

/** Die Geschäftsart in Worten, wie die Reglementsseite sie nennt. */
function geschaeftsartInWorten(art: Geschaeftsart | null): string | null {
	return GESCHAEFTSARTEN.find((g) => g.art === art)?.bezeichnung ?? null;
}

/**
 * Der Satz über dem Knopf. `knopf` ist dessen Beschriftung, weil die Seiten sie
 * verschieden nennen («Abstimmung freigeben», «Abstimmung eröffnen»).
 */
export function zuordnungssatz(z: Omit<Zuordnung, 'marke'>, knopf: string): string {
	const art = geschaeftsartInWorten(z.geschaeftsart);
	const mehr = z.erfordernis ? `«${z.erfordernis}»` : 'keine festgelegt';
	const ausstand = z.imAusstand.length > 0 ? z.imAusstand.join(', ') : 'niemand';
	return (
		`Mit «${knopf}» bestätigen Sie: ` +
		(art ? `Geschäftsart «${art}», ` : '') +
		`nötige Mehrheit ${mehr}; im Ausstand ${ausstand}; ` +
		`anwesend oder vertreten ${z.anwesend} von ${z.gesamt} Parteien.`
	);
}

/** Die Angaben für den Verlauf beim Eröffnen. Leere Liste heisst «keine», nicht «fehlt». */
export function zuordnungImVerlauf(z: Omit<Zuordnung, 'marke'>): {
	geschaeftsart: Geschaeftsart | null;
	erfordernis: string | null;
	imAusstand: string[];
	anwesend: string;
} {
	return {
		geschaeftsart: z.geschaeftsart,
		erfordernis: z.erfordernis,
		imAusstand: z.imAusstand,
		anwesend: `${z.anwesend} von ${z.gesamt} Parteien`
	};
}

/** Die Absage, wenn sich Geschäftsart, Mehrheit oder Ausstand seit dem Laden geändert haben. */
export const ZUORDNUNG_GEAENDERT =
	'Seit Sie die Seite geladen haben, hat sich die Geschäftsart, die nötige Mehrheit oder der ' +
	'Ausstand geändert. ' +
	'Die Abstimmung ist nicht freigegeben. Laden Sie die Seite neu, prüfen Sie den Satz über ' +
	'dem Knopf und geben Sie dann frei.';
