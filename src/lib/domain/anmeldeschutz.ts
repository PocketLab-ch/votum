/**
 * Schutz gegen wiederholtes Durchprobieren von Kennwörtern.
 *
 * Reine Rechenregel ohne Datenbank und ohne Uhr (AD-1): Die Funktion bekommt die
 * Fehlversuche und den Bezugszeitpunkt übergeben und sagt, ob und wie lange
 * gesperrt ist. Damit ist das Verhalten mit einer Wertetabelle prüfbar, statt
 * mit einem Test, der echte Zeit verstreichen lässt.
 */

/** Ab dem wievielten Fehlversuch in Folge gesperrt wird. */
export const FEHLVERSUCHE_BIS_SPERRE = 5;

/**
 * Wartezeit in Sekunden, gestaffelt nach der Zahl der Fehlversuche.
 *
 * Bewusst nicht unbegrenzt wachsend: Eine Sperre von Stunden würde im
 * Versammlungsraum den Sitzungsleiter aussperren, und dann steht die Versammlung.
 * Fünf Minuten bremsen das Durchprobieren wirksam und sind vor Ort überbrückbar.
 */
const STAFFELUNG_SEKUNDEN = [30, 60, 120, 300];

export interface Fehlversuch {
	/** Zeitpunkt in Millisekunden seit Epochenbeginn. */
	zeitpunkt: number;
}

export interface Sperrzustand {
	gesperrt: boolean;
	/** Verbleibende Sperrzeit in Sekunden; null, wenn nicht gesperrt. */
	verbleibendSekunden: number | null;
	/** Wie viele Fehlversuche in die Bewertung eingeflossen sind. */
	beruecksichtigteVersuche: number;
}

/**
 * Fenster, innerhalb dessen Fehlversuche zusammengezählt werden.
 * Ältere Versuche zählen nicht mehr mit, sonst sperrt ein einzelner Vertipper
 * von letzter Woche zusammen mit vier neuen.
 */
export const FENSTER_SEKUNDEN = 900;

export function pruefeSperre(
	fehlversuche: Fehlversuch[],
	jetzt: number,
	fensterSekunden: number = FENSTER_SEKUNDEN
): Sperrzustand {
	const fenstergrenze = jetzt - fensterSekunden * 1000;
	const imFenster = fehlversuche
		.filter((v) => v.zeitpunkt > fenstergrenze)
		.sort((a, b) => a.zeitpunkt - b.zeitpunkt);

	if (imFenster.length < FEHLVERSUCHE_BIS_SPERRE) {
		return { gesperrt: false, verbleibendSekunden: null, beruecksichtigteVersuche: imFenster.length };
	}

	const ueberzaehlige = imFenster.length - FEHLVERSUCHE_BIS_SPERRE;
	const stufe = Math.min(ueberzaehlige, STAFFELUNG_SEKUNDEN.length - 1);
	const wartezeit = STAFFELUNG_SEKUNDEN[stufe];

	const letzter = imFenster[imFenster.length - 1].zeitpunkt;
	const verstrichen = Math.floor((jetzt - letzter) / 1000);
	const verbleibend = wartezeit - verstrichen;

	if (verbleibend <= 0) {
		return { gesperrt: false, verbleibendSekunden: null, beruecksichtigteVersuche: imFenster.length };
	}

	return {
		gesperrt: true,
		verbleibendSekunden: verbleibend,
		beruecksichtigteVersuche: imFenster.length
	};
}

// ── Die zweite Zählung: nach Herkunft ───────────────────────────────────────

/**
 * **Was die Sperre nach Benutzernamen offenlässt.**
 *
 * Sie bremst, wer *ein* Konto durchprobiert. Wer stattdessen *viele Namen* je
 * einmal versucht, läuft an ihr vorbei: Jeder Name hat seinen eigenen Zähler,
 * und keiner erreicht fünf. Genau so sehen Wörterbuchangriffe auf
 * Benutzernamen aus.
 *
 * **Gezählt werden deshalb verschiedene Namen von derselben Herkunft, nicht
 * Versuche.** Das ist der Unterschied, an dem alles hängt: Im Versammlungsraum
 * sitzen Sitzungsleitung, Beamergerät und Notebook hinter **einer** Adresse.
 * Zählte diese Sperre Versuche, spräche sie im Saal an — und dann steht die
 * Versammlung wegen dreier Vertipper. Wer sein eigenes Kennwort fünfmal
 * falsch eingibt, ist hier ein Name und bleibt unberührt; erst wer sich an
 * vielen verschiedenen Konten versucht, wird gebremst.
 *
 * **Und sie ist nur so viel wert wie die Adresse, die hereinkommt.** Steht die
 * Anwendung hinter einem Reverse Proxy, ist die Adresse ohne gesetzte
 * `VERSAMMLUNG_ADRESSKOPFZEILE` die des Proxys, und dann träfe die Sperre alle
 * zugleich. Gesperrt wird nur, wo überhaupt eine Adresse vorliegt (siehe
 * `server/auth.ts`); welche das ist, entscheidet `herkunft()` in
 * `hooks.server.ts` mit `adresseAusKopfzeile` unten.
 */
export const NAMEN_BIS_HERKUNFTSSPERRE = 8;

/**
 * Die Adresse des Aufrufers aus der Weiterleitungskopfzeile, oder `null`.
 *
 * **Gezählt wird der hinterste Eintrag, nicht der erste** (Befund A4,
 * 09.10.2026). Ein Proxy wie nginx (`$proxy_add_x_forwarded_for`) hängt die
 * Adresse, von der er die Verbindung bekam, **hinten** an das an, was der
 * Aufrufer schon mitschickte. Vorne steht damit, was der Aufrufer selbst
 * hineinschrieb, und das wechselt ein Angreifer mit jedem Versuch. Hinten steht
 * das Einzige, was der Proxy selbst gesehen hat.
 *
 * Das gilt für **genau einen** Proxy vor der Anwendung. Stünden zwei
 * hintereinander, wäre der hinterste Eintrag die Adresse des vorderen Proxys,
 * und die Sperre träfe wieder alle zugleich. Die Annahme steht in
 * `.env.example` und `docs/installation.md`.
 */
export function adresseAusKopfzeile(wert: string | null | undefined): string | null {
	const hinterste = wert?.split(',').at(-1)?.trim();
	return hinterste || null;
}

/** Wartezeit der Herkunftssperre, gestaffelt wie bei der Namenssperre. */
const HERKUNFT_STAFFELUNG_SEKUNDEN = [60, 300, 900];

export interface Namensversuch {
	zeitpunkt: number;
	/** Der versuchte Benutzername, kleingeschrieben verglichen. */
	username: string;
}

export function pruefeHerkunftssperre(
	versuche: Namensversuch[],
	jetzt: number,
	fensterSekunden: number = FENSTER_SEKUNDEN
): Sperrzustand {
	const fenstergrenze = jetzt - fensterSekunden * 1000;
	const imFenster = versuche
		.filter((v) => v.zeitpunkt > fenstergrenze)
		.sort((a, b) => a.zeitpunkt - b.zeitpunkt);

	const namen = new Set(imFenster.map((v) => v.username.trim().toLowerCase()));

	if (namen.size < NAMEN_BIS_HERKUNFTSSPERRE) {
		return { gesperrt: false, verbleibendSekunden: null, beruecksichtigteVersuche: namen.size };
	}

	const ueberzaehlige = namen.size - NAMEN_BIS_HERKUNFTSSPERRE;
	const stufe = Math.min(ueberzaehlige, HERKUNFT_STAFFELUNG_SEKUNDEN.length - 1);
	const wartezeit = HERKUNFT_STAFFELUNG_SEKUNDEN[stufe];

	const letzter = imFenster[imFenster.length - 1].zeitpunkt;
	const verbleibend = wartezeit - Math.floor((jetzt - letzter) / 1000);

	if (verbleibend <= 0) {
		return { gesperrt: false, verbleibendSekunden: null, beruecksichtigteVersuche: namen.size };
	}

	return { gesperrt: true, verbleibendSekunden: verbleibend, beruecksichtigteVersuche: namen.size };
}

/**
 * Gültigkeitsdauer einer Anmeldesitzung.
 *
 * Zwölf Stunden: Eine Versammlung dauert einen Abend, und der Sitzungsleiter
 * soll sich nicht mitten in der Auszählung neu anmelden müssen. Länger wäre bei
 * einem Gerät, das im Sitzungszimmer liegen bleibt, unnötig grosszügig.
 */
export const SITZUNGSDAUER_SEKUNDEN = 12 * 3600;

export function sitzungAbgelaufen(ablaufZeitpunkt: number, jetzt: number): boolean {
	return jetzt >= ablaufZeitpunkt;
}
