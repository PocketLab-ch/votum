/**
 * Den Erfordernisvorschlag für ein Neuladen der Seite sichern (Befund
 * Praxisdurchlauf 03.10.2026, Punkt 2).
 *
 * **Warum im Browser und nicht auf dem Server.** Der Vorschlag ist eine
 * Momentaufnahme des Modells, ausdrücklich nicht reproduzierbar und nicht Teil
 * des Nachweises. `ai_usage` trägt seit Migration 050 «ohne Anfragen und
 * Antworten»; ihn dort abzulegen hiesse, Modelltext mit möglichen Personennamen
 * an einer Stelle zu behalten, die zum Beschluss gehört (AD-5). Der
 * Sitzungsspeicher des Tabs endet mit dem Tab und trägt genau so weit, wie der
 * Vorschlag im Saal gebraucht wird: ein Neuladen der Seite.
 *
 * **Und nicht im `localStorage`.** Der überlebt auch das Schliessen des
 * Browsers und stünde am nächsten Tag noch da — für eine Einschätzung, die die
 * Anwendung selbst «nicht reproduzierbar» nennt.
 *
 * **Prüfen statt glauben.** Was im Sitzungsspeicher liegt, kann von Hand
 * verändert oder aus einer älteren Fassung stammen. Es wird deshalb nur
 * zurückgegeben, wenn die Felder da sind, die die Karte liest; sonst gilt es
 * als nicht vorhanden. Die Prüfung ist eine Formprüfung, keine
 * Inhaltsprüfung: Angezeigt wird weiterhin genau der Text, den der Server
 * geliefert hat. Der Vergleich wird nicht geprüft, weil er beim Anzeigen
 * gegen den heutigen Stand neu gerechnet wird (`aktualisiereVergleich`).
 */
import { gegenpruefung, type Gegenpruefung } from './domain/erfordernisvorschlag';
import type { Vorschlagsergebnis } from './server/erfordernisvorschlag';

/**
 * Der kleinste Speicher, den dieser Baustein braucht.
 *
 * Als Schnittstelle und nicht als `Storage`: So lässt sich die Prüfung ohne
 * Browser proben, und im privaten Modus, wo der Zugriff gesperrt ist, bleibt
 * der Aufruf trotzdem eine Zeile.
 */
export interface Ablage {
	getItem(schluessel: string): string | null;
	setItem(schluessel: string, wert: string): void;
}

/**
 * Was die Anzeige erwartet — derselbe Vertrag, unter dem der Server liefert.
 *
 * Eigener Name, damit die Seite nicht den Serverbaustein einbinden muss; die
 * Form ist `Vorschlagsergebnis`, ergänzt um die Gegenprüfung. Die legt die
 * Anzeige dazu (`aktualisiereVergleich`), sie steht nicht in `holeVorschlag`.
 */
export type VorschlagAnzeige = Vorschlagsergebnis & {
	vergleich?: Gegenpruefung | null;
	/**
	 * Das Traktandum, für das der Vorschlag geholt wurde (Zweitprüfung
	 * 04.10.2026, mittel 1). Der Pfadname ist für alle Traktanden derselbe;
	 * ohne die Kennung könnte eine Antwort, die nach einem Wechsel eintrifft,
	 * am falschen Traktandum angezeigt und gemerkt werden. Beim gemerkten
	 * Eintrag trägt ihn der Schlüssel; darum ist das Feld optional.
	 */
	traktandumId?: string;
};

/**
 * Gehört der Vorschlag zu diesem Traktandum?
 *
 * Ein Vorschlag ohne Kennung gilt als fremd: Er stammt aus einer Fassung vor
 * dieser Prüfung, und lieber einmal zu wenig angezeigt als am falschen Ort.
 */
export function gehoertZuTraktandum(
	anzeige: Pick<VorschlagAnzeige, 'traktandumId'> | null,
	traktandumId: string
): boolean {
	return anzeige?.traktandumId === traktandumId;
}

/** Der Schlüssel je Versammlung und Traktandum — jede Karte hat ihren eigenen. */
export function vorschlagMerker(versammlungId: string, traktandumId: string): string {
	return `versammlung:erfordernisvorschlag:${versammlungId}:${traktandumId}`;
}

/**
 * Ist der Vorschlag erledigt — steht das Erfordernis schon auf seinem Fall?
 *
 * **Damit die Karte nach dem Übernehmen nicht wieder auftaucht** (Codeprüfung
 * 04.10.2026, M3). `kifolgen` leitet auf die Traktandenliste um; eine
 * Rücknahme des Vorschlags gibt es auf diesem Weg nicht. Ohne diese Frage
 * stünde beim nächsten Aufruf derselben Seite im selben Tab wieder «Ich folge
 * der Empfehlung», obwohl das Erfordernis gesetzt ist — und ein zweiter Klick
 * schriebe einen zweiten «angenommen»-Vermerk in den Nachweis.
 *
 * Steht das Erfordernis auf einem anderen Fall, bleibt die Karte: Der
 * Vorschlag ist dann wieder eine brauchbare Auskunft.
 */
export function istErledigt(
	vorschlag: VorschlagAnzeige,
	knotenId: string | null | undefined
): boolean {
	return Boolean(knotenId) && vorschlag.vorschlag?.knotenId === knotenId;
}

/**
 * Den Vergleich gegen den heutigen Stand rechnen.
 *
 * **Warum er nicht gemerkt wird** (Codeprüfung 04.10.2026, mittel 1). Er wurde
 * in der Aktion gegen den Stand der Anfrage gerechnet und mitgemerkt; nach
 * einem Neuladen stand er unverändert über einem inzwischen anderen
 * Erfordernis und behauptete etwas über einen Stand, den es nicht mehr gibt.
 * Er ist eine reine Funktion des Vorschlags und des gesetzten Erfordernisses
 * (`gegenpruefung`); hier gerechnet, gilt er immer für den Stand, der gerade
 * dasteht. Ein mitgemerkter Altbestand wird dabei ersetzt.
 *
 * Fehlschläge und Vorschläge ohne Rechenweg bleiben unberührt: Ohne
 * `vorschlag` gibt es keinen Vergleich.
 */
export function aktualisiereVergleich(
	anzeige: VorschlagAnzeige | null,
	gesetzt: Parameters<typeof gegenpruefung>[0] | undefined
): VorschlagAnzeige | null {
	if (!anzeige) return null;
	if (!anzeige.vorschlag) return anzeige;
	return { ...anzeige, vergleich: gegenpruefung(gesetzt ?? null, anzeige.vorschlag) };
}

/** Merkt den Vorschlag. Scheitert der Speicher, bleibt es beim alten Verhalten. */
export function merkeVorschlag(
	ablage: Ablage,
	schluessel: string,
	vorschlag: VorschlagAnzeige
): void {
	try {
		ablage.setItem(schluessel, JSON.stringify(vorschlag));
	} catch {
		/* Privater Modus oder voller Speicher: dann überlebt er das Neuladen nicht. */
	}
}

/**
 * Holt den gemerkten Vorschlag — oder `null`.
 *
 * `null` heisst «nichts Brauchbares gemerkt»: kein Eintrag, kein JSON, eine
 * andere Form oder ein gesperrter Speicher. Alle vier Fälle führen zur selben
 * Anzeige wie vor dem Merker.
 */
export function holeGemerktenVorschlag(
	ablage: Ablage,
	schluessel: string
): VorschlagAnzeige | null {
	let roh: string | null;
	try {
		roh = ablage.getItem(schluessel);
	} catch {
		return null;
	}
	if (roh === null) return null;

	let wert: unknown;
	try {
		wert = JSON.parse(roh);
	} catch {
		return null;
	}
	return istVorschlagsergebnis(wert) ? wert : null;
}

/**
 * Trägt das Ergebnis die Felder, die die Karte liest?
 *
 * Absichtlich an der Anzeige entlang und nicht am Serververtrag: Was hier
 * durchkommt, aber fehlt, führte zu leeren Stellen statt zu einem Fehler. Die
 * Begründungen und Unsicher-Marken sind freier Text des Modells und werden
 * nicht inhaltlich geprüft.
 */
function istVorschlagsergebnis(wert: unknown): wert is VorschlagAnzeige {
	if (typeof wert !== 'object' || wert === null) return false;
	const e = wert as Record<string, unknown>;

	if (typeof e.nutzungId !== 'string' && e.nutzungId !== null) return false;
	if (typeof e.hinausgegangen !== 'string') return false;
	if (typeof e.stufe !== 'string' && e.stufe !== null) return false;
	if (typeof e.dauerMs !== 'number') return false;
	if (typeof e.namenGeschuetzt !== 'number') return false;
	if (!Array.isArray(e.fehlschlaege)) return false;
	if (e.grund !== null && typeof e.grund !== 'string') return false;

	const v = e.vorschlag;
	/*
	 * **Auch der Fehlschlag überlebt das Neuladen** (Codeprüfung 04.10.2026,
	 * M2): Bei «Keine Einschätzung möglich» ist `vorschlag` null, und trotzdem
	 * hat der Aufruf gekostet. Die Karte zeigt dann die Fehlschläge und den
	 * Kasten «Was übermittelt wurde» — beides kommt aus dem gemerkten Ergebnis.
	 *
	 * Ein `nutzungId` von `null` ist hier erlaubt: Beim gelöschten Traktandum
	 * gibt es keine Nutzung, und die Karte bietet in diesem Zweig auch keinen
	 * Entscheid an (Codeprüfung Runde 2, niedrig 3).
	 */
	if (v === null) return true;
	if (typeof v !== 'object') return false;
	// Für den Erfolgszweig braucht es dagegen eine brauchbare Kennung: Die
	// Entscheidknöpfe schicken sie mit.
	if (typeof e.nutzungId !== 'string' || e.nutzungId === '') return false;
	const k = v as Record<string, unknown>;
	if (typeof k.astId !== 'string' || typeof k.astTitel !== 'string') return false;
	if (typeof k.titel !== 'string' || typeof k.rechtsgrundlage !== 'string') return false;
	// `knotenId` und `typ` liest die Anzeige mittelbar: `istErledigt` vergleicht
	// die Kennung, `aktualisiereVergleich` rechnet mit dem Typ.
	if (typeof k.knotenId !== 'string' || typeof k.typ !== 'string') return false;
	if (typeof k.grenzfall !== 'boolean') return false;
	if (!Array.isArray(k.schritte)) return false;

	return k.schritte.every((s) => {
		if (typeof s !== 'object' || s === null) return false;
		const x = s as Record<string, unknown>;
		return (
			typeof x.frageId === 'string' &&
			typeof x.frageText === 'string' &&
			typeof x.antwortId === 'string' &&
			typeof x.antwortText === 'string' &&
			typeof x.begruendung === 'string' &&
			typeof x.unsicher === 'boolean'
		);
	});
}
