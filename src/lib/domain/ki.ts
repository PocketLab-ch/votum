/**
 * Die KI-Unterstützung — was sie darf und was nicht (rein).
 *
 * **Die KI entscheidet nie.** Sie prüft, schlägt vor und formuliert; jedes
 * Ergebnis geht durch die Hand der Sitzungsleitung, bevor es Wirkung entfaltet.
 * Das ist keine Vorsichtsfloskel, sondern eine Anforderung: Ein Beschluss,
 * dessen Mehrheitserfordernis eine Maschine bestimmt hat, wäre in einer
 * Anfechtung schwer zu verteidigen.
 *
 * **Das Modell ist Konfiguration, nicht Programm** (Vorgabe des Auftraggebers vom
 * 05.08.2026). Wird die Anwendung öffentlich, entscheidet jeder Betreiber
 * selbst, welches Modell er befragt und ob er eine Ausweichstufe braucht — auch
 * ein lokales Modell im eigenen Haus. Deshalb steht hier keine Liste von
 * Anbietern und kein Vorzugsmodell.
 */
// Aus `fehler.ts`, nicht aus `gemeinschaft.ts`: sonst entstünde ein Ring —
// `gemeinschaft.ts` holt `KI_FUNKTIONEN` von hier.
import { FachlicherFehler } from './fehler';

/**
 * Die Funktionen, die einzeln abschaltbar sind (FR-62).
 *
 * Eine Gemeinschaft kann die Traktandenprüfung wollen und den Protokollentwurf
 * nicht. Beides an einem Schalter hiesse, dass die Zurückhaltung bei einem
 * Punkt die Hilfe bei allen anderen kostet.
 */
export const KI_FUNKTIONEN = [
	'traktandenpruefung',
	'erfordernisvorschlag',
	'antragspruefung',
	'protokollentwurf'
] as const;
export type KiFunktion = (typeof KI_FUNKTIONEN)[number];

export const KI_FUNKTIONSNAMEN: Record<KiFunktion, string> = {
	traktandenpruefung: 'Traktanden prüfen',
	erfordernisvorschlag: 'Mehrheitserfordernis vorschlagen',
	antragspruefung: 'Anträge auf Zulässigkeit prüfen',
	protokollentwurf: 'Protokollentwurf erzeugen'
};

export interface Kilage {
	/** Ob überhaupt eine Kette eingerichtet ist. */
	eingerichtet: boolean;
	/** Ob die Gemeinschaft die KI zugelassen hat. */
	zugelassen: boolean;
	/** Ob die Anwendung im Betrieb ohne Netz läuft. */
	offline: boolean;
	/** Funktionen, die diese Gemeinschaft ausgenommen hat. */
	ausgenommen: readonly string[];
	/**
	 * Ob Hinweise auf nicht verfügbare KI-Funktionen ausgeblendet werden.
	 *
	 * **Ausgeblendet ist nicht abgeschaltet.** Die Angabe verändert keine
	 * Schranke; sie entscheidet nur, ob von der Sache die Rede ist. Wo die KI
	 * zugelassen ist, bleiben die Abschnitte sichtbar — sonst versteckte ein
	 * Anzeigeschalter eine Funktion, die läuft.
	 */
	hinweiseAusblenden?: boolean;
}

export interface Verfuegbarkeit {
	verfuegbar: boolean;
	/** Warum nicht — für die Oberfläche, die den Knopf dann grau zeigt. */
	grund: string | null;
	/**
	 * Ob der Abschnitt überhaupt erscheinen soll.
	 *
	 * Der Grund ist beim ersten Mal eine Auskunft und ab dem zehnten Mal
	 * Gerümpel: Wer keine KI will, liest an vier Stellen dauerhaft, warum er
	 * sie nicht hat. Verfügbar heisst immer auch sichtbar.
	 */
	anzeigen: boolean;
}

/**
 * Ob eine Funktion jetzt benutzt werden kann (FR-62).
 *
 * **Sichtbar deaktiviert statt fehlerhaft.** Wer im Versammlungsraum ohne Netz
 * auf einen Knopf drückt und eine Fehlermeldung bekommt, hält die Anwendung für
 * kaputt. Der Knopf gehört grau, mit dem Grund daneben.
 */
export function verfuegbarkeit(lage: Kilage, funktion: KiFunktion): Verfuegbarkeit {
	const zeigen = lage.hinweiseAusblenden !== true;
	if (lage.offline) {
		return {
			verfuegbar: false,
			anzeigen: zeigen,
			grund:
				'Die Anwendung läuft ohne Netz. Die KI-Unterstützung ist deshalb nicht verfügbar — ' +
				'alles andere geht weiter wie sonst.'
		};
	}
	if (!lage.eingerichtet) {
		return {
			verfuegbar: false,
			anzeigen: zeigen,
			grund:
				'Es ist kein Modell eingerichtet. Welches befragt wird, bestimmt die Bewirtschaftung; ' +
				'ohne Eintrag bleibt die Anwendung ohne KI vollständig benutzbar.'
		};
	}
	if (!lage.zugelassen) {
		return {
			verfuegbar: false,
			anzeigen: zeigen,
			grund:
				'Für diese Gemeinschaft ist die KI-Unterstützung nicht zugelassen. Es werden dabei ' +
				'Inhalte an ein Modell übermittelt; wer das will, schaltet es bewusst ein.'
		};
	}
	if (lage.ausgenommen.includes(funktion)) {
		return {
			verfuegbar: false,
			anzeigen: zeigen,
			grund: `«${KI_FUNKTIONSNAMEN[funktion]}» ist für diese Gemeinschaft ausgenommen.`
		};
	}
	// Verfügbar heisst immer auch sichtbar: Ein Anzeigeschalter darf keine
	// Funktion verstecken, die läuft.
	return { verfuegbar: true, grund: null, anzeigen: true };
}

// ── Befunde einer Prüfung (FR-58) ───────────────────────────────────────────

export const SCHWEREGRADE = ['hoch', 'mittel', 'tief'] as const;
export type Schweregrad = (typeof SCHWEREGRADE)[number];

export interface Befund {
	schwere: Schweregrad;
	/** Was nicht stimmt — in einem Satz. */
	was: string;
	/** Was stattdessen dastehen könnte. Ohne Vorschlag kein Befund (FR-58). */
	vorschlag: string;
}

/**
 * Nimmt entgegen, was das Modell geantwortet hat — und wirft weg, was nicht
 * taugt.
 *
 * **Warum so streng.** Die Antwort kommt aus einem fremden Haus und ist keine
 * Zusage. Ein Befund ohne Vorschlag wäre für die Sitzungsleitung wertlos
 * («irgendetwas stimmt nicht»), ein unbekannter Schweregrad brächte die Sortierung
 * durcheinander, und erfundene Felder haben in der Anzeige nichts verloren. Was
 * hier nicht durchkommt, verschwindet — lieber ein Befund weniger als einer,
 * den niemand einordnen kann.
 */
export function lesbareBefunde(roh: unknown): Befund[] {
	const liste = Array.isArray(roh)
		? roh
		: typeof roh === 'object' && roh !== null && Array.isArray((roh as { befunde?: unknown }).befunde)
			? ((roh as { befunde: unknown[] }).befunde)
			: [];

	const aus: Befund[] = [];
	for (const e of liste) {
		if (typeof e !== 'object' || e === null) continue;
		const b = e as Record<string, unknown>;
		const was = typeof b.was === 'string' ? b.was.trim() : '';
		const vorschlag = typeof b.vorschlag === 'string' ? b.vorschlag.trim() : '';
		const schwere = typeof b.schwere === 'string' ? b.schwere.trim().toLowerCase() : '';
		// zeichenzahl-frei: Plausibilität einer KI-Antwort, keine Eingabeschranke.
		if (was.length < 3 || vorschlag.length < 3) continue;
		if (!(SCHWEREGRADE as readonly string[]).includes(schwere)) continue;
		aus.push({ schwere: schwere as Schweregrad, was, vorschlag });
	}

	// Das Schwerste zuerst: Wer im Saal drei Zeilen liest, soll die richtigen
	// lesen.
	const rang: Record<Schweregrad, number> = { hoch: 0, mittel: 1, tief: 2 };
	return aus.sort((a, b) => rang[a.schwere] - rang[b.schwere]);
}

// ── Was die Sitzungsleitung damit gemacht hat (FR-63) ───────────────────────

export const ENTSCHEIDE = ['angenommen', 'abgelehnt', 'veraendert'] as const;
export type Entscheid = (typeof ENTSCHEIDE)[number];

export function verlangeEntscheid(wert: string): Entscheid {
	if (!(ENTSCHEIDE as readonly string[]).includes(wert)) {
		throw new FachlicherFehler(
			'entscheid_unbekannt',
			'Zu einem Vorschlag gehört, was damit geschehen ist: angenommen, abgelehnt oder verändert übernommen.',
			'entscheid'
		);
	}
	return wert as Entscheid;
}

/**
 * Woher ein Befund stammt — und warum das dabeisteht (Audit B-09).
 *
 * **Der Text, den die Prüfung liest, bestimmt mit, was zurückkommt.** Ein
 * Traktandum darf von einem Eigentümer stammen; wer einen Antrag einreicht, kann
 * hineinschreiben, was er will — auch Anweisungen an das Modell. Der übliche
 * Schaden fällt hier aus, weil Svelte Text als Text setzt und keine der vier
 * Funktionen dem Modell etwas zu ändern gibt. Was bleibt, ist die
 * **Beeinflussung eines Menschen**: Ein Satz im Ton der Anwendung liest sich wie
 * eine Auskunft des Werkzeugs, stammt aber womöglich aus dem Antrag desjenigen,
 * der von der milderen Hürde profitiert.
 *
 * **Kein Filter, sondern eine Kennzeichnung.** Ein Filter wäre umgehbar und
 * erzeugte falsche Sicherheit. Wer dagegen weiss, dass der Satz vor ihm eine
 * Modellantwort auf einen fremden Text ist, liest ihn anders — und genau das
 * genügt, weil am Ende ohnehin ein Mensch entscheidet.
 */
export function modellherkunft(stufe: string | null | undefined): string {
	// Ohne Namen bleibt die Angabe trotzdem stehen. Sie sagt dann weniger, aber
	// das Entscheidende — «das hat kein Mensch geschrieben» — sagt sie weiter.
	return `Antwort von ${stufe?.trim() || 'einem unbenannten Modell'}`;
}

/**
 * Der Satz, der neben einer Modellantwort steht.
 *
 * Absichtlich ohne Beschwichtigung: nicht «in seltenen Fällen», sondern was
 * gilt. Wer den Satz einmal gelesen hat, weiss beim zweiten Befund, was er vor
 * sich hat.
 */
export const HERKUNFTSHINWEIS =
	'Formuliert hat das ein Sprachmodell, und zwar aus dem geprüften Text. Steht dort eine ' +
	'Anweisung an die Maschine, kann sie hier als Befund erscheinen — im Ton der Anwendung. ' +
	'Sie entscheiden, nicht das Werkzeug.';

/**
 * Der Satz, der im Protokoll ausweist, dass eine Maschine mitgeschrieben hat
 * (FR-63).
 *
 * Rechtlich nicht zwingend, aber ehrlich — und im Streitfall entlastend: Wer
 * offenlegt, dass ein Entwurf maschinell vorbereitet und von einem Menschen
 * verantwortet wurde, steht besser da als jemand, dem man es nachweist.
 */
export function maschinenvermerk(anbieter: string, wer: string): string {
	return (
		`Dieser Entwurf wurde maschinell vorbereitet (${anbieter}) und von ${wer} durchgesehen und ` +
		'verantwortet.'
	);
}

/**
 * Ob im Zeitbudget eines Sammellaufs noch ein Aufruf Platz hat.
 *
 * **Die Frage ist «werde ich fertig», nicht «darf ich anfangen»**
 * (02.09.2026). Ein Aufruf, der startet, läuft zu Ende. Wer nur die
 * verstrichene Zeit gegen das Budget hält, hängt die Dauer dieses letzten
 * Aufrufs hinten an: Bei 100 s Budget und 24 s Kettenzeit endet der Lauf dann
 * nach 124 s. Eine Zusicherung, die «insgesamt» heisst und ein Viertel
 * obendrauf zulässt, ist keine.
 *
 * **`reserveMs` ist der bisher längste Aufruf, nicht die zulässige
 * Höchstgeduld.** Die erste Fassung dieser Regel rechnete mit der
 * konfigurierten Geduld der ganzen Kette, und das war ein Rückschritt gegenüber
 * dem, was sie ersetzte (Code-Review 02.09.2026): Die Geduld ist je Stufe bis
 * 120 s einstellbar, zwei solche Stufen ergeben 120 s Reserve gegen 100 s
 * Budget — der Sammellauf hätte ab dem zweiten Punkt immer abgebrochen, auch
 * wenn das Modell in zwei Sekunden antwortet. Eine 20er-Liste wäre nie
 * durchgelaufen. Gemessen wird deshalb, was tatsächlich gebraucht wurde.
 *
 * **Damit ist die Frist eine gute Schätzung und keine Garantie.** Antworten
 * neunzehn Aufrufe in zwei Sekunden und hängt der zwanzigste, wird das Budget
 * überschritten. Das ist der richtige Tausch: Der Zweck ist eine Seite, die
 * nicht minutenlang stumm bleibt, und keine harte Schranke. Ein Proxy davor
 * braucht deshalb eine Frist mit Reserve (`docs/installation.md`).
 *
 * **`schonGeprueft` ist die Notbremse gegen den toten Knopf.** Ohne eine
 * einzige Messung gibt es keine Reserve, und ohne den ersten Aufruf gäbe es nie
 * eine Messung. Der erste darf deshalb immer.
 */
export function reichtDieZeit(lage: {
	verstrichenMs: number;
	/** Die längste bisher gemessene Dauer eines einzelnen Aufrufs. */
	reserveMs: number;
	budgetMs: number;
	schonGeprueft: number;
}): boolean {
	if (lage.schonGeprueft === 0) return true;
	return lage.verstrichenMs + lage.reserveMs <= lage.budgetMs;
}
