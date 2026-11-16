/**
 * Was als Nächstes zu tun ist (Story 6.7, Nachtrag).
 *
 * Die Seitenleiste zeigt den ganzen Ablauf und beantwortet damit «wo bin ich».
 * Sie beantwortet **nicht** «wie geht es weiter»: Wer eine Seite ausgefüllt und
 * gespeichert hat, steht danach auf derselben Seite, und der nächste Schritt
 * liegt in einer Liste am Rand, die auf dem Telefon zugeklappt ist. Gemeldet am
 * 31.07.2026 nach einem Selbstversuch: «Ich habe hier alles erfasst und komme
 * nicht weiter, sondern bleibe auf der Seite.»
 *
 * Der Kern rechnet, welcher Schritt der nächste ist. Die Anzeige hängt daran.
 */
import type { Schritt } from './vorbereitung';

export interface Weiterweg {
	/**
	 * `weiter` — ein offener Schritt, dorthin führt ein Weg.
	 * `ausblick` — nichts mehr offen ausser hier, aber es kommt noch etwas: der
	 * nächste gesperrte Schritt, mit seinem Grund. **Nicht verlinkt**, denn eine
	 * verschlossene Tür anzubieten ist schlimmer als sie zu nennen.
	 * `abschluss` — der Weg endet hier. Kein Schritt, sondern ein Satz.
	 */
	art: 'weiter' | 'ausblick' | 'abschluss';
	/** Fehlt beim Abschluss: Dort gibt es nichts mehr, wohin zu zeigen wäre. */
	schritt?: Schritt;
	/**
	 * Ob die Seite, auf der man steht, selbst noch offen ist.
	 *
	 * Der Unterschied steht in der Überschrift: «Als Nächstes» drängt weiter,
	 * «Wenn Sie hier fertig sind» wartet ab. Wer noch mitten in der Erfassung
	 * steht, soll nicht gedrängt werden — er soll nur wissen, wohin es geht.
	 */
	hierNochOffen: boolean;
}

/** Vergleicht Pfade ohne Abfrageteil — `?zur=…` gehört nicht zur Seite. */
function gleicherPfad(a: string, b: string): boolean {
	return a.split('?')[0] === b.split('?')[0];
}

/**
 * Wohin es von der Seite aus weitergeht, auf der man steht.
 *
 * Regeln, in dieser Reihenfolge:
 *
 *   1. Nur **offene** Schritte sind ein Ziel. Ein erledigter wäre eine
 *      Wiederholung.
 *   2. Der eigene Schritt zählt nicht: «weiter» dorthin, wo man schon steht,
 *      ist keine Führung.
 *   3. Steht man im Ablauf, geht es **vorwärts**: der erste offene Schritt
 *      danach.
 *   4. **Zurück nur, solange die Versammlung noch läuft.** Vorher ist ein
 *      übersprungener Schritt eine Lücke, die man schliessen kann; nachher ist
 *      er Vergangenheit. Der Auftraggeber hat es am 04.08.2026 gemeldet: Vom Protokoll —
 *      dem letzten Schritt — führte die Leiste zurück zu «Einladung erzeugen».
 *      Für eine geschlossene Versammlung ist das keine Führung, sondern eine
 *      Irreführung: Die Einladung wäre vor der Sitzung fällig gewesen.
 *   5. Ist nichts mehr offen, aber noch etwas gesperrt, wird der gesperrte
 *      Schritt als **Ausblick** genannt. Sonst endete die Führung ausgerechnet
 *      dort, wo eine Seite den Weg für alles Weitere erst freischaltet: Wer auf
 *      der Freigabe steht, sieht sonst nichts mehr — obwohl gleich danach
 *      Einladung und Zugänge kommen.
 *   6. Bleibt nichts, endet der Weg mit einem **Abschluss** statt mit
 *      Schweigen. Wer auf der letzten Seite steht, soll das auch lesen können.
 */
export function naechsterSchritt(
	schritte: Schritt[],
	hier: string,
	/**
	 * Ob der Ablauf noch läuft.
	 *
	 * Steuert allein den Rückgriff (Regel 4). Voreingestellt `true`, damit
	 * Aufrufer ausserhalb einer Versammlung — die Gemeinschaftsseiten — nichts
	 * mitgeben müssen.
	 */
	offenerAblauf = true
): Weiterweg | null {
	const stelle = schritte.findIndex((s) => gleicherPfad(s.pfad, hier));
	const hierNochOffen = stelle >= 0 && schritte[stelle].zustand === 'offen';

	const offen = schritte
		.map((s, i) => ({ s, i }))
		.filter(({ s, i }) => s.zustand === 'offen' && i !== stelle);

	if (offen.length > 0) {
		const vorwaerts = stelle >= 0 ? offen.find(({ i }) => i > stelle) : undefined;
		const ziel = vorwaerts ?? (offenerAblauf ? offen[0] : undefined);
		if (ziel) return { art: 'weiter', schritt: ziel.s, hierNochOffen };
	}

	const gesperrt = schritte.filter((s, i) => s.zustand === 'gesperrt' && i !== stelle);
	if (gesperrt.length > 0) {
		return { art: 'ausblick', schritt: gesperrt[0], hierNochOffen };
	}

	return { art: 'abschluss', hierNochOffen };
}
