/**
 * Suchen in einer Liste — eine Regel für alle Ansichten (AD-1).
 *
 * **Warum das ein eigener Baustein ist.** Die Versammlungsübersicht bekam am
 * 10.08.2026 eine Suche, und sofort wollten die Eigentümerliste (27 Bildschirme
 * ohne ein einziges Suchfeld) und die Gemeinschaftsliste dieselbe. Drei
 * Umsetzungen nebeneinander liefen auseinander: Die eine fände «Petrović» nur
 * mit Häkchen, die andere verstünde zwei Wörter als «oder», und niemand könnte
 * mehr sagen, warum dieselbe Eingabe hier trifft und dort nicht.
 *
 * Die Vergleichsform (ohne Gross-/Kleinschreibung, ohne Akzente) stammt aus
 * [historiesuche], die es schon für die Suche in früheren Geschäften brauchte —
 * sie wird hier wiederverwendet und nicht nachgebaut.
 */
import { vergleichsform } from './historiesuche';

/**
 * Zerlegt die Eingabe in Suchwörter.
 *
 * Mehrere Wörter werden **und**-verknüpft: «berger nirgendweg» soll die eine
 * Zeile finden und nicht alles, was eines von beiden trägt. Bei einer
 * Oder-Verknüpfung wächst die Trefferliste mit jedem getippten Wort — das
 * Gegenteil einer Suche.
 */
export function suchwoerter(suche: string): string[] {
	return vergleichsform(suche.trim()).split(/\s+/).filter(Boolean);
}

/** Ob ein Text alle Suchwörter enthält. Ohne Suchwörter trifft alles. */
export function trifft(text: string, woerter: string[]): boolean {
	if (woerter.length === 0) return true;
	const heuhaufen = vergleichsform(text);
	return woerter.every((w) => heuhaufen.includes(w));
}

/**
 * Filtert eine Liste über den Text, den `textVon` je Eintrag liefert.
 *
 * Die Reihenfolge bleibt, wie sie kam: Sie ist anderswo begründet — nach Datum,
 * nach Name, nach Rang der Gemeinschaft — und eine Suche ist kein Anlass, sie
 * umzustellen.
 */
export function filtereNach<T>(liste: T[], suche: string, textVon: (eintrag: T) => string): T[] {
	const woerter = suchwoerter(suche);
	if (woerter.length === 0) return liste;
	return liste.filter((e) => trifft(textVon(e), woerter));
}

/**
 * Filtert eine Liste, die einen Baum bildet — Treffer **samt ihren Vorfahren**.
 *
 * Ohne die Vorfahren schwebte eine getroffene Untergemeinschaft eingerückt unter
 * nichts: Die Einrückung behauptet eine Zugehörigkeit, deren Bezugspunkt die
 * Suche gerade weggefiltert hat. Der Vorfahr steht deshalb mit da, auch wenn er
 * selbst nicht passt — er ist Kontext, nicht Treffer.
 */
export function filtereMitVorfahren<T>(
	liste: T[],
	suche: string,
	textVon: (eintrag: T) => string,
	idVon: (eintrag: T) => string,
	elternVon: (eintrag: T) => string | null
): T[] {
	const woerter = suchwoerter(suche);
	if (woerter.length === 0) return liste;

	const jeId = new Map(liste.map((e) => [idVon(e), e]));
	const behalten = new Set<string>();

	for (const eintrag of liste) {
		if (!trifft(textVon(eintrag), woerter)) continue;
		let lauf: T | undefined = eintrag;
		// Die Kette aufwärts, bis zur Wurzel oder bis zu einem schon bekannten
		// Vorfahren. `gesehen` bricht einen Ring ab, den die Daten nicht haben
		// sollten — hier ist eine Endlosschleife teurer als eine Zeile Vorsicht.
		const gesehen = new Set<string>();
		while (lauf && !gesehen.has(idVon(lauf))) {
			gesehen.add(idVon(lauf));
			behalten.add(idVon(lauf));
			const eltern = elternVon(lauf);
			lauf = eltern ? jeId.get(eltern) : undefined;
		}
	}

	return liste.filter((e) => behalten.has(idVon(e)));
}

/** «11.09.2026» — wonach man tippt, wenn man ein Datum sucht. */
export function punktdatum(iso: string): string {
	const [jahr, monat, tag] = iso.split('-');
	return jahr && monat && tag ? `${tag}.${monat}.${jahr}` : iso;
}

/**
 * Ab wann ein Feld oder eine Liste eine Suche braucht.
 *
 * **Der Anlass** (Auftraggeber, 26.08.2026): «Bei Eigentümer fehlt die Möglichkeit nach
 * Einheit zu suchen. Im Dropdown muss dann gescrollt werden. Prüfe bei allen
 * Dropdown ob die Suchfunktion hinterlegt ist.»
 *
 * **Warum acht — und warum nicht neu erfunden.** Die Zahl stand damals schon
 * zweimal und unabhängig voneinander im Haus: Die Gemeinschaftsliste blendete
 * ihre Suchleiste ab `bestand.length > 8` ein, und die übergeordnete
 * Gemeinschaft im `GemeinschaftFormular` tat dasselbe mit dem Satz «Bis acht
 * liest man die Liste, ab neun sucht man».
 *
 * Gezählt wird deshalb: **bis acht ohne Suche, ab neun mit.**
 *
 * **Sie steht im Kern und nicht in der Schale** (Umzug am 27.08.2026), weil
 * inzwischen drei Stellen sie brauchen: `Suchauswahl.svelte` blendet das
 * Suchfeld eines Auswahlfelds ab dieser Zahl ein, der ESLint-Wächter
 * `versammlung/durchsuchbare-auswahl` lässt bis zu dieser Zahl fest aufgezählte
 * `<option>` in einem rohen `<select>` durchgehen, und [brauchtSuchfeld] hier
 * entscheidet über die Suchleiste einer Liste.
 * `tests/waechter/durchsuchbare-auswahl.test.ts` vergleicht die ersten beiden
 * Zahlen miteinander — der Wächter kann diese Datei nicht einbinden, weil er
 * als `.mjs` neben ESLint läuft.
 */
export const SUCHSCHWELLE = 8;

/**
 * Ab wann eine Liste ein Suchfeld bekommt.
 *
 * **Der Anlass** (Auftraggeber, 27.08.2026): «Fehlt bei Gemeinschaft die Schnellsuche?»
 * Sie fehlte nicht. Sie stand unter einer anderen Regel als die Nachbarliste:
 * Gemeinschaften ab neun Einträgen, Personen und Eigentümer schon ab einem.
 * Drei gleichartige Übersichtslisten, zwei Regeln, kein Grund dafür.
 *
 * **Gilt für Übersichtslisten, nicht für jedes Suchfeld.** Gezählt am
 * 27.08.2026 stehen 15 Suchfelder in `src`. Vier folgen dieser Regel: die drei
 * Übersichtslisten und der Baustein `Suchauswahl`. Die übrigen elf haben je
 * einen Grund, ohne Schwelle dazustehen: Saalsichten, Serversuchen,
 * Auswahlbausteine und zwei ausdrückliche Vorgaben.
 * `tests/waechter/suchschwelle.test.ts` führt sie namentlich, mit Grund und
 * Anzahl, und liest dafür den Syntaxbaum.
 * Nachtrag 06.10.2026 (UI-Durchgang): Die Saalgeräteliste folgt der Regel
 * jetzt ebenfalls. Gezählt an diesem Tag rufen fünf Dateien `brauchtSuchfeld`
 * auf: Personen, Gemeinschaften, Eigentümer, Saalgeräte und `Suchauswahl`.
 *
 * **Die Zahl kommt aus [SUCHSCHWELLE]** und wird hier nicht zweitgeschrieben:
 * Es ist dieselbe Frage wie beim Auswahlfeld — bis acht liest man die Liste, ab
 * neun sucht man.
 *
 * **`archiviert` gehört dazu** (25.08.2026, aus der vierten Reviewrunde der
 * Personenliste): Liegt alles im Archiv, ist der Bestand leer, und mit dem
 * Suchfeld verschwände der Archivschalter daneben, also der einzige Weg zurück.
 *
 * **Benannte Angaben und keine Zahlenreihe** (27.08.2026, aus dem Code-Review):
 * Drei gleichartige Zahlen hintereinander lassen sich vertauschen, ohne dass
 * der Übersetzer etwas merkt, und `brauchtSuchfeld(n, meineSchwelle)` wäre
 * `archiviert > 0` gewesen, also immer wahr. Ein Ausweichen, das nach «Feld
 * immer sichtbar» führt, fällt niemandem auf.
 *
 * **Gezählt wird, was die Suche erreicht, nicht was die Tabelle führt**
 * (27.08.2026, aus dem Code-Review). Auf der Personenseite hängen zwei Listen
 * an einem Feld, auf der Eigentümerseite stehen die Mitberechtigten in der
 * Zelle ihrer Hülle und werden mitdurchsucht. Wer dort `bestand.length`
 * einsetzt, blendet das Feld aus, während vierzig Zeilen darunter stehen.
 */
export function brauchtSuchfeld({
	durchsuchbar,
	archiviert,
	schwelle = SUCHSCHWELLE
}: {
	/** Wie viele Einträge dieser Suchbegriff erreicht. */
	durchsuchbar: number;
	/** Wie viele davon im Archiv liegen. */
	archiviert: number;
	/** Nur für `Suchauswahl`, das seinen Aufrufern eine eigene Zahl anbietet. */
	schwelle?: number;
}): boolean {
	return durchsuchbar > schwelle || archiviert > 0;
}

/** Wie viele Zeilen eine Liste ohne Suchbegriff höchstens zeigt. */
export const LISTENGRENZE = 25;

/**
 * Eine lange Liste auf ein Bildschirmmass kürzen — bis jemand sucht.
 *
 * **Der Anlass** (Prüflauf II, A-47 bis A-49). Die Eigentümerliste war 7,8
 * Bildschirmhöhen lang, «Ackermann» stand sechsundzwanzigmal untereinander; die
 * Gemeinschaftsliste 3,6, die Startseite 4,2 mit neununddreissig Versammlungen
 * unter «Steht an». Suchfelder gab es überall — nur muss man erst merken, dass
 * man sie braucht, und dazwischen liegt das Blättern.
 *
 * **Gekürzt wird nur ohne Suchbegriff.** Wer sucht, hat schon eingegrenzt; ihm
 * die Treffer zu beschneiden wäre die zweite Hürde nach der ersten. Und wer
 * alles sehen will, klickt einmal — die Zahl der Verborgenen steht daneben, so
 * dass niemand eine gekürzte Liste für die ganze hält.
 *
 * **Keine Seitenzahlen.** Blättern heisst, sich zu merken, wo man war; das ist
 * bei einer Suchliste die falsche Bewegung. Entweder man sucht, oder man will
 * alles.
 */
export function begrenzt<T>(
	zeilen: readonly T[],
	suche: string,
	alleZeigen: boolean,
	grenze = LISTENGRENZE,
): { zeigen: T[]; verborgen: number } {
	if (alleZeigen || suche.trim() || zeilen.length <= grenze) {
		return { zeigen: [...zeilen], verborgen: 0 };
	}
	return { zeigen: zeilen.slice(0, grenze), verborgen: zeilen.length - grenze };
}
