/**
 * Die Versammlung und ihr Lebenslauf (Story 3.1, FR-8, AD-10, AD-1).
 *
 * Der Zustand einer Versammlung wird ausschliesslich über die hier definierten
 * Übergänge geändert. Kein direktes Setzen des Feldes — jeder Übergang prüft
 * seine Vorbedingungen und gibt seinen Verlaufseintrag mit zurück, sodass es
 * keinen Weg gibt, den einen ohne den anderen zu haben.
 *
 * Das ist keine Formsache. Ein Zustand, der an zwei Stellen fortgeschrieben
 * wird, wird an einer davon irgendwann anders fortgeschrieben: Die eine Stelle
 * prüft, ob Traktanden vorhanden sind, die andere vergisst es, und plötzlich
 * ist eine leere Versammlung freigegeben und der Stimmberechtigtenstand
 * eingefroren.
 */
import { FachlicherFehler } from './gemeinschaft';
import type { Id, Zeitpunkt } from './types';
import type { Versammlungsstufe } from './beschlussfaehigkeit';
import { EREIGNISARTEN, ereignis, uebergang, type Uebergang } from './verlauf';
import { zeichenzahl } from './zeichenzahl';
import { datumLang, istKalendertag } from './datum';

/** Zustände nach AD-10. Die Reihenfolge ist die des Ablaufs. */
export type Versammlungszustand =
	| 'entwurf'
	| 'freigegeben'
	| 'laufend'
	| 'geschlossen'
	| 'versiegelt';

/**
 * Ob der Abend vorbei ist: geschlossen **oder** versiegelt.
 *
 * **Warum es diese Funktion gibt** (04.09.2026). Der Zustand hat fünf Werte,
 * und `versiegelt` kam als fünfter dazu. Sechs Stellen fragten weiterhin nur
 * `=== 'geschlossen'` und behandelten die versiegelte Versammlung, als wäre sie
 * noch offen: Die Führung zeigte zurück auf einen Vorbereitungsschritt, die
 * Protokollseite nannte die Zahlen «vorläufig», obwohl die Datenbank sie gerade
 * gegen jede Änderung gesperrt hatte, und die Leinwand fiel mit demselben Code
 * auf die Eingabe zurück, der eben noch die Beschlussliste zeigte.
 *
 * Beim Layout war es ein **Rückfall**: Der Kommentar, der genau das verhindern
 * soll, stand seit dem 04.08.2026 direkt über der Zeile.
 *
 * **Die Frage «ist der Abend vorbei» ist nicht dieselbe wie «darf noch
 * versiegelt werden».** Wo eine Stelle den Unterschied zwischen geschlossen und
 * versiegelt wirklich braucht, vergleicht sie weiter von Hand, und das ist
 * richtig so: `archivieren.ts` erklärt, warum ohne Siegel nicht archiviert
 * wird, und die Siegelliste fragt genau nach dem Zustand vor dem Siegel.
 */
export function abgeschlossen(zustand: Versammlungszustand): boolean {
	return zustand === 'geschlossen' || zustand === 'versiegelt';
}

/**
 * Wie lange ein Zugang nach dem Schluss noch **zeigen** darf: eine Stunde.
 *
 * **Der Anlass war die Leinwand** (21.08.2026). Vorher entwertete das
 * Schliessen den Anzeigecode, und die Wand fiel im selben Augenblick vor dem
 * ganzen Saal auf die Code-Eingabe zurück. Seit es eine Abschlussseite gibt,
 * ist das die falsche Stelle zum Aufhören.
 *
 * **Seit dem 04.09.2026 gilt dieselbe Frist auf dem Telefon** (Produktentscheid):
 * Der Verlauf der Beschlüsse war sonst nur während des Abends sichtbar, also
 * gerade nicht in dem Augenblick, für den er gedacht ist.
 *
 * Die Grenze nach oben ist keine technische: Was im Saal vorgelesen wurde, soll
 * nicht Wochen später noch Beschlüsse hergeben. Dafür gibt es das Protokoll.
 *
 * **Eine Zahl, zwei Verwender.** Stünde sie zweimal da, liefe sie auseinander,
 * und dann gälte auf der Wand etwas anderes als auf dem Telefon.
 */
export const NACHLAUF_MS = 60 * 60 * 1000;


/**
 * Ordentlich oder ausserordentlich.
 *
 * Die ordentliche Versammlung ist die jährliche mit ihren wiederkehrenden
 * Geschäften (ZGB Art. 712m Abs. 1). Die ausserordentliche wird aus einem
 * Anlass einberufen, der zu nennen ist — er gehört in die Einladung und ins
 * Protokoll, weil sich an ihm bemisst, ob die Einberufung berechtigt war.
 */
export type Versammlungsart = 'ordentlich' | 'ausserordentlich';

/**
 * Wie die Versammlung geführt wird.
 *
 * Nicht jede Gemeinschaft hat einen Beamer, und in einer Vierergemeinschaft am
 * Küchentisch wäre eine Zugangskarte mit QR-Code eine Zumutung. Die
 * **einfache** Betriebsart erfasst Anwesenheit auf Papier und Stimmen durch die
 * Sitzungsleitung; die **geführte** arbeitet mit Check-in und eigenem Gerät.
 *
 * Die Wahl gehört ins Protokoll: Sie erklärt, warum bei der einfachen Führung
 * keine einzelnen Zugriffszeitpunkte festgehalten sind. Ohne diesen Vermerk
 * sähe das später wie eine Lücke aus.
 */
export type Betriebsart = 'gefuehrt' | 'einfach';

/**
 * Ab wann geführt vorgeschlagen wird.
 *
 * Bis und mit fünf Parteien passen alle an einen Tisch, und die Sitzungsleitung
 * kennt jeden beim Namen. Darüber lohnt sich das Erfassen am eigenen Gerät.
 * Eine Schwelle ist immer willkürlich — deshalb ist sie ein Vorschlag und keine
 * Bedingung.
 */
export const SCHWELLE_GEFUEHRT = 5;

/**
 * Stellt der Einlass dieser Versammlung die Frage «digital oder von Hand»?
 *
 * **An einer Stelle, weil sie an vieren gebraucht wird**: die schmale
 * Einlass-Seite, die Anwesenheitssicht, die Sitzungsleitung und der gemeinsame
 * Abend. Viermal `papierfrage && betriebsart === 'gefuehrt'` getippt liefe
 * auseinander, und der eine Eingang fragte dann, während der andere daneben
 * schwieg.
 *
 * **Am gemeinsamen Abend gilt sie je Haus** (10.09.2026). Im Verbund hat jedes
 * Haus seine eigene Betriebsart und seinen eigenen Schalter: Vier können
 * `gefuehrt` fahren und das fünfte `einfach`. Die Frage hängt deshalb dort am
 * einzelnen Eintrag der Liste und nicht am Kasten darüber.
 *
 * **Und sie ist keine reine Anzeigeentscheidung mehr.** `vermerkePapierabgabe`
 * ruft dieselbe Funktion, bevor es schreibt. Vorher glaubte der Schreibweg
 * jedem Formular, das `papier=ja` mitschickte — auch bei abgeschalteter Frage,
 * und ein gesetzter Vermerk sperrt das Telefon der Partei.
 *
 * **Warum die Betriebsart mit hineingehört.** In `einfach` trägt die
 * Sitzungsleitung ohnehin alle Stimmen ein; die Frage hätte dort nur eine
 * Antwort. Sie zu stellen wäre kein Mehr an Genauigkeit, sondern ein Knopf, der
 * nichts ändert, und der Verdacht, er ändere doch etwas.
 */
export function fragtNachPapier(v: { betriebsart: Betriebsart; papierfrage: boolean }): boolean {
	return v.papierfrage && v.betriebsart === 'gefuehrt';
}

export function betriebsartVorschlag(anzahlParteien: number): Betriebsart {
	return anzahlParteien > SCHWELLE_GEFUEHRT ? 'gefuehrt' : 'einfach';
}

/**
 * Die gesetzliche Frist zwischen erster und zweiter Versammlung, in Tagen
 * (ZGB Art. 712p Abs. 2). Sie steht in den Texten, nicht in der Rechnung.
 */
export const FRIST_TAGE = 10;

/**
 * Der erste zulässige Abstand in Tagen, und deshalb elf statt zehn.
 *
 * Art. 712p Abs. 2 lässt die zweite Versammlung «nicht vor **Ablauf** von zehn
 * Tagen seit der ersten» stattfinden, und nach **Rz. 41 ad Art. 712p** beginnt
 * die Frist erst am Tag **nach** der ersten Versammlung zu laufen (allgemeine
 * Fristbestimmungen, abgeleitet von Art. 76 f. OR). Erste Versammlung am
 * 1. Oktober: Die Frist läuft vom 2. bis zum 11. Oktober, der erste zulässige
 * Termin ist der 12. Oktober, der Abstand also elf Tage.
 *
 * **Warum zwei Konstanten und nicht eine** (Befund R-1, 23.09.2026). Bis dahin
 * trug eine Zahl beide Bedeutungen: In den Texten war sie die gesetzliche Frist
 * (zehn, richtig), in der Prüfung und in den Terminvorschlägen der Abstand
 * (zehn, einen Tag zu mild). Wer die eine Bedeutung berichtigte, verdarb die
 * andere.
 *
 * **Die Vorschläge hängen mit daran.** `folgeversammlung`, der
 * Vertagungsvorschlag der Leitung und die Abendsteuerung setzen den Termin auf
 * diesen Abstand. Mit zehn schlug die Anwendung den einen Tag vor, den das
 * Gesetz ausschliesst.
 */
export const MINDESTABSTAND_TAGE = FRIST_TAGE + 1;

/**
 * Die drei Sätze über die Zehntagesfrist, an **einer** Stelle.
 *
 * **Der Anlass** (Fachprüfung vom 23.09.2026, Befund 1). Dieselbe Regel stand
 * im Werkzeug an sieben Stellen, jede mit eigenem Wortlaut: hier, im Formular,
 * in `klartext.ts`, zweimal in `beschlussfaehigkeit.ts`, im Hilfetext am
 * Terminfeld und in zwei Vertagungssätzen. Nach der Berichtigung von R-1 hätten
 * vier von ihnen «zehn Tage» gesagt und vier «elf»; der Erklärtext im
 * Aufklapper «Was heisst das?» stand rund 25 Zeilen unter der Fehlermeldung und
 * widerlegte sie.
 *
 * **Warum die Folge die Monatsfrist nennt** (Produktentscheid 23.09.2026, nach
 * Befund 2 der Fachprüfung). Rz. 39 ad Art. 712p sagt, eine früher einberufene
 * Versammlung vermöge «keine rechtsgültigen Beschlüsse zu fassen». Ob das
 * Nichtigkeit oder Anfechtbarkeit heisst, sagt der Kommentar für Abs. 2 nicht;
 * für die Verletzung von **Abs. 1** benutzt derselbe Autor in Rz. 30 fast
 * dieselbe Wendung und löst sie in Rz. 31 mit «Im Zweifelsfall anfechtbar» auf.
 * Der Text entscheidet die Streitfrage deshalb nicht, sondern nennt die
 * Handlung: Wer anficht, wahrt die Frist, und gilt der Beschluss ohnehin nicht,
 * schadet die Anfechtung nichts. Die strenge Fassung allein wäre die
 * gefährlichere, weil sie zum Nichtstun einlädt und die Monatsfrist ablaufen
 * lässt.
 *
 * **«gesetzlich» ist kein Füllwort** (Befund 3): Nach Rz. 40 darf ein Reglement
 * eine längere Frist vorsehen. Ohne das Wort verspricht die Anwendung eine
 * Zulässigkeit, die nur das Gesetz deckt.
 *
 * **Die Folge nennt jetzt Person, Ort und Beginn der Frist** (Fachprüfung vom
 * 24.09.2026, Befunde F-1, F-5 und F-6). Bis dahin stand hier «sind sie innert
 * eines Monats anfechtbar» — drei Lücken in einem Halbsatz, und die erste war
 * ein Rückschritt: Der Vorschlag vom 23.09.2026 hatte «ab Kenntnis» bereits
 * enthalten, übernommen wurde nur die Rechtsfolge.
 *
 *   1. **Der Beginn.** Art. 75 lässt die Frist «binnen Monatsfrist, nachdem es
 *      von ihnen Kenntnis erhalten hat» laufen, nicht ab dem Versammlungstag.
 *      Wer anfechten will, ist typischerweise der, der **nicht da war** — sonst
 *      hätte die zweite Versammlung nichts mit erleichtertem Quorum zu
 *      beschliessen gehabt. Er bekommt das Protokoll Wochen später, rechnet ab
 *      dem Versammlungsdatum und hält sich für zu spät. Er ist es nicht.
 *   2. **Die Person.** Art. 75 gibt das Recht nur dem Mitglied, «das nicht
 *      zugestimmt hat». Der Satz stand ohne Bedingung in der Einladung an alle.
 *   3. **Der Ort.** «Beim Gericht», wie Art. 75 sagt. Die Laienprüfung hat
 *      gefragt, bei wem man denn anfängt, und der Text gab keine Antwort.
 *
 * **Und nebenbei entschärft die neue Fassung F-5.** «sind sie anfechtbar» trat
 * als entschieden auf, obwohl Rz. 32 die Rechtsfolge ausdrücklich als in der
 * Lehre umstritten führt und Rz. 33 Fälle nennt, in denen Nichtigkeit
 * anzunehmen sei. Ein Satz, der die **Handlung** nennt statt der Einordnung,
 * behauptet nichts über nichtig oder anfechtbar und ist in jeder Lesart
 * richtig — dieselbe Überlegung, die oben schon die Monatsfrist hereingeholt
 * hat, nur konsequent zu Ende geführt.
 *
 * **«stattfindet», nicht «einberufen»** (Befund 4): Art. 712p Abs. 2 knüpft an
 * das Stattfinden, und die Anwendung misst Versammlungsdaten, keine
 * Einladungsdaten. Die Einberufungsfrist ist eine andere Zehntagesfrist und
 * wird laut `quellen/themen/stockwerkeigentum/gesetz.md` regelmässig damit
 * verwechselt.
 */
export const FRISTLAUF =
	'Die gesetzliche Frist von zehn Tagen beginnt am Tag nach der ersten Versammlung ' +
	'(ZGB Art. 712p Abs. 2; Wermelinger, Rz. 41 ad Art. 712p).';

export const FRISTFOLGE =
	'Eine früher stattfindende Versammlung darf keine Beschlüsse fassen. Werden trotzdem ' +
	'welche gefasst, kann jeder Eigentümer, der nicht zugestimmt hat, sie beim Gericht ' +
	'anfechten; die Frist dafür beträgt einen Monat und beginnt, sobald er von ihnen ' +
	'erfahren hat (ZGB Art. 712m Abs. 2 i.V.m. Art. 75).';

/**
 * Dieselbe Regel für Stellen, die **keine** Gemeinschaft zur Hand haben.
 *
 * **Die Zahlwörter stehen hier ausgeschrieben**, nicht als `${FRIST_TAGE}`.
 * Die Laienprüfung vom 23.09.2026 hat die Kette «9, 10, 11» in drei Sätzen als
 * den Grund benannt, aus dem die Meldung wie ein Rechenfehler der Anwendung
 * aussieht. Damit die Wörter nicht von den Konstanten wegdriften, hält
 * `tests/domain/versammlung.test.ts` beide gegeneinander.
 *
 * **Und der Satz muss ohne den Wert wahr sein** (Code-Review 24.09.2026,
 * Befund 1). Bis dahin sagte er unbedingt «am elften Tag». Seit die Frist je
 * Gemeinschaft hinterlegbar ist (Migration 122), stand er neben einem
 * Terminvorschlag, der bei einer längeren Reglementsfrist einen anderen Tag
 * nannte — zwei Zahlen für dieselbe Regel, gleichzeitig sichtbar, und die
 * falsche bei der Rechtsauskunft. Der Halbsatz über das Reglement löst das
 * ohne jede Verdrahtung: Er ist für jede Gemeinschaft richtig.
 *
 * Wo der Wert zur Hand ist, nimmt man `fristKurz(tage)`; wo mehrere
 * Gemeinschaften nebeneinanderstehen, `fristAmAbend(tage)`.
 */
export const FRIST_KURZ =
	'Nach Gesetz darf eine zweite Versammlung frühestens am elften Tag nach der ersten ' +
	`stattfinden; ein Reglement kann eine längere Frist vorsehen. ${FRISTLAUF}`;

/**
 * Derselbe Hinweis für Stellen, die **eine** Gemeinschaft kennen.
 *
 * Ohne hinterlegte Frist gibt er `FRIST_KURZ` zurück, also genau den Satz, der
 * vorher überall stand. Mit einer längeren nennt er den Tag, der hier gilt.
 *
 * **Ab hier Ziffern statt Zahlwörter**, und das ist eine bewusste Abweichung
 * von der Vorgabe der Laienprüfung vom 23.09.2026 (siehe `FRIST_KURZ`): Der
 * Tag wird gerechnet, für «einundzwanzigsten» gibt es keine Worttabelle, und
 * eine hätte denselben zweiten Schreiber wie jede andere Zahl. Die Regel gilt
 * weiter für die festen Sätze; der Wächter erfasst diesen hier nicht.
 */
export function fristKurz(reglementstage?: number | null): string {
	const tage = geltendeZweitfrist(reglementstage);
	if (tage === FRIST_TAGE) return FRIST_KURZ;
	return (
		`Eine zweite Versammlung darf hier frühestens am ${tage + 1}. Tag nach der ersten ` +
		`stattfinden: Ihr Reglement verlangt ${tage} Tage statt der gesetzlichen zehn. ${FRISTLAUF}`
	);
}

/**
 * Derselbe Hinweis, wenn **mehrere** Gemeinschaften nebeneinanderstehen.
 *
 * **Der Anlass** (Code-Review 24.09.2026, zweiter Durchgang, Befund 2). Am
 * gemeinsamen Abend nahm die erste Fassung `fristKurz(längsteFrist)`. Der
 * **Tag** war damit richtig, weil die längste Frist für jedes Haus zulässig
 * ist. Die **Zuschreibung** war es nicht: «Ihr Reglement verlangt 20 Tage»
 * stand dann auch vor Gemeinschaften, die keine solche Klausel haben — eine
 * Rechtsaussage über ein fremdes Reglement.
 *
 * Der Satz sagt deshalb, was er weiss: dass an diesem Abend die längste
 * hinterlegte Frist gilt, ohne sie einer der anwesenden Gemeinschaften
 * zuzuschreiben.
 */
export function fristAmAbend(laengsteFrist?: number | null): string {
	const tage = geltendeZweitfrist(laengsteFrist);
	if (tage === FRIST_TAGE) return FRIST_KURZ;
	return (
		`An diesem Abend gilt die längste hinterlegte Frist: ${tage} Tage statt der ` +
		`gesetzlichen zehn, also frühestens der ${tage + 1}. Tag nach der ersten Versammlung. ` +
		`Sie stammt aus dem Reglement einer der beteiligten Gemeinschaften und ist für alle ` +
		`zulässig. ${FRISTLAUF}`
	);
}

export interface VersammlungEingabe {
	stwegId: Id;
	/** Kalendertag, `JJJJ-MM-TT`. */
	datum: string;
	/** Ortszeit `HH:MM`. */
	uhrzeit: string;
	ort: string;
	art: Versammlungsart;
	stufe: Versammlungsstufe;
	betriebsart: Betriebsart;
	/** Bei der ausserordentlichen Versammlung Pflicht. */
	anlass?: string;
	/** Bei der Zweitversammlung: die erste, auf die sie folgt. */
	vorgaengerId?: Id | null;
	/** Datum der ersten Versammlung, für die Fristprüfung. */
	vorgaengerDatum?: string | null;
}

/**
 * Die beiden Leitungsfelder und wie sie in einem Satz heissen.
 *
 * An **einer** Stelle, weil drei Stellen sie brauchen: der Schreibweg der
 * einzelnen Versammlung, der des gemeinsamen Abends und die Formulare, die den
 * bekannten Stand mitschicken. Zweimal getippt wäre es zweimal zu pflegen — und
 * ein Feld, das im einen Verzeichnis fehlt, würde dort still nicht geprüft.
 */
export const LEITUNGSFELDER = {
	sitzungsleitung: 'der Vorsitz',
	protokollfuehrung: 'die Protokollführung'
} as const;

/**
 * Prüft die Namen für Vorsitz und Protokollführung — und macht leeren Text zu
 * «nicht angegeben».
 *
 * **Hier im Kern, weil es zwei Aufrufer gibt**: die einzelne Versammlung
 * (`meeting`, Migration 091) und den gemeinsamen Abend (`meeting_day`,
 * Migration 092). Beide tragen dieselben Schranken; zweimal geschrieben liefen
 * sie irgendwann auseinander.
 *
 * **Gezählt wird über die Zeichen, nicht über `.length`.** `'😀'.length` ist 2,
 * `length(btrim('😀'))` in Postgres ist 1 — beides nachgemessen. Ein einzelnes
 * solches Zeichen käme sonst durch und schlüge in der Datenbank als
 * `check_violation` durch: eine rohe 500 statt eines Satzes.
 */
export function pruefeLeitungsnamen(angaben: {
	sitzungsleitung: string | null;
	protokollfuehrung: string | null;
}): { sitzungsleitung: string | null; protokollfuehrung: string | null } {
	const geprueft = {
		sitzungsleitung: angaben.sitzungsleitung?.trim() || null,
		protokollfuehrung: angaben.protokollfuehrung?.trim() || null
	};

	for (const feld of ['sitzungsleitung', 'protokollfuehrung'] as const) {
		const wert = geprueft[feld];
		if (!wert) continue;

		/*
		 * **Steuerzeichen raus, bevor die Datenbank sie sieht** (26.08.2026, aus
		 * dem Code-Review). `.trim()` streift kein NUL — und ein NUL-Byte ist für
		 * Postgres kein zu langer Name, sondern «invalid byte sequence for
		 * encoding UTF8» (22021), also eine rohe 500 statt eines Satzes. Dasselbe
		 * gilt für einen Zeilenumbruch: Er stünde im Protokollkopf als eigene
		 * Zeile und könnte dort eine Überschrift vortäuschen.
		 */
		if (/\p{Cc}/u.test(wert)) {
			throw new FachlicherFehler(
				'name_ungueltig',
				'Der Name enthält Steuerzeichen oder Zeilenumbrüche. Schreiben Sie ihn auf eine Zeile.',
				feld
			);
		}

		const zeichen = zeichenzahl(wert);
		if (zeichen < 2) {
			throw new FachlicherFehler(
				'name_zu_kurz',
				'Der Name braucht mindestens zwei Zeichen. Lassen Sie das Feld leer, wenn Sie ihn nicht angeben wollen.',
				feld
			);
		}
		if (zeichen > 120) {
			throw new FachlicherFehler(
				'name_zu_lang',
				`Der Name ist länger als 120 Zeichen (${zeichen}). Kürzen Sie ihn auf die Person, die unterschreibt.`,
				feld
			);
		}
	}
	return geprueft;
}

export interface Versammlung extends VersammlungEingabe {
	id: Id;
	operatorId: Id;
	zustand: Versammlungszustand;
	anlass?: string;
	vorgaengerId: Id | null;
	/**
	 * Der Vermerk zur Zehntagesfrist, wenn sie nicht eingehalten ist
	 * (Migration 119, Befund R-2b). `null`, wenn sie eingehalten ist.
	 *
	 * **Keine Eingabe**, deshalb steht er hier und nicht an `VersammlungEingabe`:
	 * Er wird beim Anlegen und bei jeder Änderung aus Datum und Vorgängerdatum
	 * gerechnet (`fristvermerk`) und lässt sich von aussen nicht setzen. Der
	 * Vorgänger des Feldes war eine Begründung, die die Sitzungsleitung selbst
	 * eintippte und die die Fristprüfung abschaltete.
	 */
	fristvermerk?: string | null;
	/** Gesetzt beim Eröffnen; das gerade behandelte Traktandum (AD-10). */
	aktuellesTraktandumId?: Id | null;
	/**
	 * Wann dieser Punkt aufgerufen wurde (Migration 084).
	 *
	 * **Wozu die Uhrzeit.** Am gemeinsamen Abend führt jedes Haus seinen eigenen
	 * Punkt; welchen der Saal gerade bespricht, ist der **zuletzt aufgerufene**.
	 * Ohne diese Angabe musste die gemeinsame Wand raten — sie nahm den am
	 * häufigsten aufgerufenen und blieb bei Gleichstand für immer beim ersten
	 * Haus in alphabetischer Reihenfolge.
	 *
	 * Sie steht und fällt mit `aktuellesTraktandumId`; ein CHECK hält beides
	 * zusammen.
	 */
	aufgerufenSeit?: Zeitpunkt | null;
	/**
	 * Wer den Vorsitz führte und wer das Protokoll schrieb (Migration 091).
	 *
	 * Freier Text und freiwillig: Der Vorsitz muss weder der Verwalter noch ein
	 * Eigentümer noch ein Konto dieser Anwendung sein (ZGB Art. 712n Abs. 1), und
	 * der gesetzliche Mindestinhalt des Protokolls sind allein die Beschlüsse
	 * (Abs. 2). Gebraucht wird die Angabe für die Unterschriftszeilen.
	 */
	sitzungsleitung?: string | null;
	protokollfuehrung?: string | null;
	/**
	 * Fragt der Einlass je Partei, ob von Hand oder digital abgestimmt wird?
	 * (Migration 108)
	 *
	 * **Nur in der Betriebsart `gefuehrt` von Bedeutung.** In `einfach` stimmen
	 * ohnehin alle von Hand; die Frage hätte dort nur eine Antwort und wäre eine
	 * Handreichung, die niemandem etwas sagt.
	 *
	 * Ab Werk gestellt, weil der Schaden einseitig ist: Wer nicht gefragt wird,
	 * gilt als digital, und wenn er es nicht ist, fällt es erst bei der
	 * Abstimmung auf. Wer gefragt wird und digital abstimmt, hat einen Knopf
	 * mehr gedrückt.
	 */
	papierfrage: boolean;
	/** Seit wann sie im Archiv liegt (Migration 086). */
	/**
	 * Nur gesetzt, wo die Abfrage es mitliest — der Kern rechnet nicht damit.
	 * Pflicht ist das Feld dort, wo es die Anzeige traegt: an
	 * `Versammlungseintrag` in `domain/versammlungsliste.ts`.
	 */
	archiviertAm?: Zeitpunkt | null;
	/**
	 * Seit wann die **Gruppe** ihrer Gemeinschaft im Archiv liegt.
	 *
	 * Getrennt von `archiviertAm`, weil beides verschiedene Wege heraus hat: Die
	 * eigene Archivierung nimmt der Knopf auf dieser Seite zurück, die der Gruppe
	 * nur die Klammer. Ohne die Unterscheidung meldete das Hervorholen «steht
	 * wieder in Liste und Suche» — und sie stand dort nicht.
	 */
	gemeinschaftArchiviertSeit?: Zeitpunkt | null;
	archivnotiz?: string | null;
	freigegebenAm?: Zeitpunkt | null;
	/**
	 * Wann die Traktandenliste als vollständig bestätigt wurde (Migration 033).
	 *
	 * Null heisst: noch nicht durchgegangen — auch dann, wenn die
	 * Pflichttraktanden aus der Vorlage bereits stehen. Sie sollen nicht blind
	 * übernommen werden.
	 */
	traktandenlisteBestaetigtAm?: Zeitpunkt | null;
	eroeffnetAm?: Zeitpunkt | null;
	geschlossenAm?: Zeitpunkt | null;
	/** Was an der Wand steht, solange kein Geschäft läuft (Migration 035). */
	wandbild?: Wandbild;
	/**
	 * Die Unterbrechung (Migration 073).
	 *
	 * **Keine vierte Wandbildart, sondern eine Schicht darüber.** Die Wandbilder
	 * greifen nur, solange kein Geschäft läuft; die Pause überlagert alles — auch
	 * eine offene Abstimmung. Genau deshalb gibt es sie: «Für die Pause braucht
	 * es einen eigenen Knopf bei der Steuerung» (Auftraggeber, 21.08.2026), weil der
	 * eigene Text nie erschien, solange ein Traktandum aufgerufen war.
	 */
	pause?: Pause | null;
}

/**
 * Die Unterbrechung — Kaffee, Störung, Notfall.
 *
 * Sie schliesst nichts ab: Ein offener Durchgang bleibt offen, die abgegebenen
 * Stimmen bleiben stehen. Gesperrt ist nur das Weiterstimmen, damit niemand mit
 * offener Seite in die Pause hinein abstimmt.
 */
export interface Pause {
	/** Seit wann unterbrochen wird. */
	seit: Zeitpunkt;
	/** Was an der Wand steht, etwa «Weiter um 20:15». Darf fehlen. */
	text?: string | null;
}

/**
 * Die drei Bilder für die stillen Zeiten einer Versammlung.
 *
 * Sie greifen nur, wenn weder eine Abstimmung offen noch ein Traktandum
 * aufgerufen ist. Ein laufendes Geschäft geht immer vor: Die Wand darf nicht
 * «Weiter um 20:15» zeigen, während im Saal abgestimmt wird.
 */
export type Wandbildart = 'traktanden' | 'begruessung' | 'frei';

export interface Wandbild {
	art: Wandbildart;
	/** Nur bei «frei» belegt und dort Pflicht. */
	text?: string | null;
	/** Woran die Saalsicht erkennt, dass sie nachladen muss. */
	geaendertAm?: Zeitpunkt | null;
}

export const WANDBILDARTEN: { art: Wandbildart; titel: string; wofuer: string }[] = [
	{
		art: 'traktanden',
		titel: 'Traktandenliste',
		wofuer: 'Während der Versammlung zwischen zwei Geschäften.'
	},
	{
		art: 'begruessung',
		titel: 'Begrüssung',
		wofuer: 'Vor dem Beginn, solange die Leute eintreffen.'
	},
	{ art: 'frei', titel: 'Eigener Text', wofuer: 'Für die Pause: «Weiter um 20:15».' }
];

const ZEIT_MUSTER = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Tage zwischen zwei Kalendertagen. Ganzzahlig, ohne Zeitzone (AD-12). */
export function tageZwischen(frueher: string, spaeter: string): number {
	const a = Date.UTC(
		Number(frueher.slice(0, 4)),
		Number(frueher.slice(5, 7)) - 1,
		Number(frueher.slice(8, 10))
	);
	const b = Date.UTC(
		Number(spaeter.slice(0, 4)),
		Number(spaeter.slice(5, 7)) - 1,
		Number(spaeter.slice(8, 10))
	);
	return Math.round((b - a) / 86_400_000);
}

/**
 * Prüft den Abstand zur ersten Versammlung.
 *
 * Gibt zurück, was fehlt — und wirft nicht. Der Verstoss soll angezeigt und
 * begründet werden können, nicht die Erfassung verhindern: Wer die zweite
 * Versammlung zu früh ansetzt, hat oft einen Grund, und ihn zum Abbruch zu
 * zwingen führte nur dazu, dass die Versammlung gar nicht erst erfasst wird.
 */
export interface Fristbefund {
	eingehalten: boolean;
	abstandTage: number;
	/** Der erste Kalendertag, an dem die zweite Versammlung stattfinden darf. */
	fruehesterTermin: string;
	hinweis: string;
}

/**
 * Der erste zulässige Termin der zweiten Versammlung.
 *
 * **Eine Rechnung für alle**: Fristprüfung, Terminvorschlag beim Vertagen und
 * die Abendsteuerung holen sich den Tag von hier. Bis zum 23.09.2026 rechnete
 * jede Stelle selbst, und das Formular tat es ein viertes Mal mit einer eigenen
 * Zahl.
 */
export function fruehesterZweitTermin(ersteAm: string, reglementstage?: number | null): string {
	return tageSpaeter(ersteAm, mindestabstand(reglementstage));
}

/** Eine Frist über einem Jahr ist keine Frist mehr, sondern ein Tippfehler. */
export const ZWEITFRIST_HOECHSTENS_TAGE = 365;

export interface Zweitversammlungsfrist {
	/** Tage zwischen erster und zweiter Versammlung. `null` heisst: nicht hinterlegt. */
	tage: number | null;
	/** Wo das im Reglement steht. Pflicht, sobald eine Zahl dasteht. */
	fundstelle: string | null;
}

/**
 * Prüft eine hinterlegte Reglementsfrist zur zweiten Versammlung.
 *
 * **Nur verlängern, nie verkürzen.** Das ist nicht aus dem Aufbau der
 * Bestimmung geschlossen, sondern belegt: «Ein Reglement darf die Frist
 * verlängern, nicht verkürzen (Rz. 40)», `quellen/themen/stockwerkeigentum/
 * gesetz.md`. Dieselbe Richtung gilt für Abs. 1, und dort setzt sie
 * `pruefeErschwerung` in `beschlussfaehigkeit.ts` durch — dieselbe Regel, aber
 * eine andere Grösse (Brüche statt Tage), deshalb eine eigene Prüfung und
 * nicht dieselbe Funktion.
 *
 * **Warum die Absage hart ist und kein Hinweis.** Eine kürzere Frist wäre
 * ungültig, und eine ungültige Regel im System sähe aus wie eine gültige.
 * Vor allem aber wäre sie genau der Ausweg, den R-2b am 24.09.2026 geschlossen
 * hat: Bis dahin schaltete ein Begründungsfeld die Prüfung ab, einmalig. Eine
 * frei kürzbare Reglementszahl täte dasselbe, dauerhaft und je Gemeinschaft.
 *
 * **Der gleiche Wert wie das Gesetz ist zugelassen.** Reglemente wiederholen
 * die gesetzliche Frist oft, und die Fundstelle dazu ist etwas wert: Sie
 * belegt, dass jemand nachgesehen hat. Gerechnet wird ohnehin dasselbe.
 */
export function pruefeZweitversammlungsfrist(
	tage: number | null | undefined,
	fundstelle: string | null | undefined
): Zweitversammlungsfrist {
	if (tage === null || tage === undefined) return { tage: null, fundstelle: null };

	if (!Number.isInteger(tage) || tage > ZWEITFRIST_HOECHSTENS_TAGE) {
		throw new FachlicherFehler(
			'zweitfrist_ungueltig',
			`Die Frist ist eine ganze Zahl bis ${ZWEITFRIST_HOECHSTENS_TAGE} Tage. Lassen Sie das ` +
				'Feld leer, solange die Frist des Reglements nicht bekannt ist.',
			'zweitversammlungsfristTage'
		);
	}

	if (tage < FRIST_TAGE) {
		throw new FachlicherFehler(
			'zweitfrist_zu_kurz',
			`Diese Frist ist kürzer als die gesetzliche von ${FRIST_TAGE} Tagen. Ein Reglement darf ` +
				'sie verlängern, nicht verkürzen (ZGB Art. 712p Abs. 2; Wermelinger, Rz. 40 ad ' +
				'Art. 712p). Eine kürzere Klausel ist ungültig, auch wenn sie im Reglement steht.',
			'zweitversammlungsfristTage'
		);
	}

	const beleg = fundstelle?.trim() ?? '';
	if (zeichenzahl(beleg) < 3) {
		// Dieselbe Begründung wie bei der Einberufungsfrist: Wer den Beschluss
		// anficht, greift die Einberufung an. Eine Frist ohne Fundstelle liesse
		// sich dann nicht verteidigen.
		throw new FachlicherFehler(
			'zweitfrist_ohne_fundstelle',
			'Zur Frist aus dem Reglement gehört die Fundstelle.',
			'zweitversammlungsfristFundstelle'
		);
	}

	return { tage, fundstelle: beleg };
}

/**
 * Die Frist, die tatsächlich gilt: die gesetzliche oder die längere des
 * Reglements.
 *
 * **Nur nach oben** (Rz. 40 ad Art. 712p): Ein Reglement darf die Frist
 * verlängern, nicht verkürzen. Ein kleinerer Wert kommt gar nicht erst herein,
 * `pruefeZweitversammlungsfrist` weist ihn ab — hier steht das `>` trotzdem,
 * weil diese Funktion auch Werte aus der Datenbank sieht und eine Sperre, die
 * nur am Eingang steht, den Bestand nicht deckt (AD-6).
 */
export function geltendeZweitfrist(reglementstage?: number | null): number {
	return reglementstage && reglementstage > FRIST_TAGE ? reglementstage : FRIST_TAGE;
}

/** Der erste zulässige Abstand: einen Tag mehr als die geltende Frist. */
function mindestabstand(reglementstage?: number | null): number {
	return geltendeZweitfrist(reglementstage) + 1;
}

/**
 * Der Satz über den Fristenlauf, für die Frist, die tatsächlich gilt.
 *
 * `FRISTLAUF` nennt die zehn Tage ausgeschrieben, und das bleibt so: Die
 * Laienprüfung vom 23.09.2026 hat die Kette «9, 10, 11» in Ziffern als den
 * Grund benannt, aus dem die Meldung wie ein Rechenfehler aussieht. Hat eine
 * Gemeinschaft eine längere Frist hinterlegt, tritt nicht eine andere Zahl an
 * dieselbe Stelle, sondern ein zweiter Satz daneben — das Gesetz bleibt
 * sichtbar, und das Reglement steht als das da, was es ist: eine Verschärfung.
 */
export function fristlaufSatz(reglementstage?: number | null): string {
	const tage = geltendeZweitfrist(reglementstage);
	if (tage === FRIST_TAGE) return FRISTLAUF;
	return (
		`${FRISTLAUF} Das Reglement Ihrer Gemeinschaft verlangt mehr, nämlich ${tage} Tage; ` +
		'massgebend ist dann die längere Frist.'
	);
}

export function pruefeZehntagesfrist(
	ersteAm: string,
	zweiteAm: string,
	reglementstage?: number | null
): Fristbefund {
	const abstand = tageZwischen(ersteAm, zweiteAm);
	const fruehesterTermin = fruehesterZweitTermin(ersteAm, reglementstage);
	// Nicht `>= geltend`, sondern `>= geltend + 1`: Die Frist läuft ab dem Tag
	// nach der ersten Versammlung (Rz. 41 ad Art. 712p). Ohne hinterlegte
	// Reglementsfrist ist das genau `MINDESTABSTAND_TAGE`; siehe dort.
	const geltend = geltendeZweitfrist(reglementstage);
	if (abstand >= geltend + 1) {
		return {
			eingehalten: true,
			abstandTage: abstand,
			fruehesterTermin,
			hinweis:
				`Abstand ${abstand} Tage. ` +
				(geltend === FRIST_TAGE
					? 'Die gesetzliche Frist von zehn Tagen ist eingehalten; '
					: `Die Frist Ihres Reglements von ${geltend} Tagen ist eingehalten; `) +
				`frühester zulässiger Termin: ${datumLang(fruehesterTermin)}.`
		};
	}
	return {
		eingehalten: false,
		abstandTage: abstand,
		fruehesterTermin,
		hinweis:
			`Die zweite Versammlung liegt ${abstand} ${abstand === 1 ? 'Tag' : 'Tage'} nach der ersten. ` +
			`${fristlaufSatz(reglementstage)} Frühester zulässiger Termin: ` +
			`${datumLang(fruehesterTermin)}. ${FRISTFOLGE}`
	};
}

/**
 * Der Vermerk, wenn die Zehntagesfrist nicht eingehalten ist.
 *
 * **Er ersetzt das Begründungsfeld** (Befund R-2b, Produktentscheid vom
 * 23.09.2026). Bis dahin fragte das Formular «Warum ist der Abstand kürzer?»
 * und liess die Erfassung weiter, sobald irgendetwas dastand. Das war die
 * falsche Reihenfolge: Ein Pflichtfeld sieht aus wie ein vorgesehener Weg, und
 * den gibt es nicht. Rz. 39 ad Art. 712p kennt neben der Universalversammlung
 * keine Ausnahme, und nach Rz. 33 spricht gerade die Willentlichkeit für die
 * schwerere Rechtsfolge — wer begründet, belegt also, dass er es wusste.
 *
 * **Was an seine Stelle tritt, ist kein Verbot.** Erfassen bleibt möglich; das
 * Werkzeug hält niemanden auf (`leitplanken.md`, Verhalten «stellt fest»). Was
 * sich ändert, ist die Richtung: Statt dass die Sitzungsleitung dem Werkzeug
 * etwas erklärt, sagt das Werkzeug den Eigentümern, was gilt. Der Vermerk steht
 * in der Einladung und im Protokoll, also in den beiden Dokumenten, die im
 * Anfechtungsfall auf dem Tisch liegen, und er lässt sich nicht wegklicken.
 *
 * **Er wird gerechnet und in `meeting.interval_note` festgehalten**
 * (Migration 119), weil `vorgaengerDatum` zwar zum Typ gehört, aus der
 * Datenbank aber nie zurückgelesen wird; ohne die Spalte hätte jede Lesestelle
 * das Datum selbst nachziehen müssen.
 *
 * **Festhalten heisst hier nicht einfrieren** (Code-Review vom 24.09.2026,
 * Befund 1). Die erste Fassung dieses Kommentars behauptete, ein später
 * geändertes Datum der **ersten** Versammlung dürfe den Wortlaut stehen lassen,
 * «weil die Einladung so hinausgegangen ist». Das war falsch, und der Beweis
 * stand unverändert zwanzig Zeilen weiter in einer anderen Datei:
 * `routes/versammlungen/[id=kennung]/+page.server.ts` rechnet den Fristbefund
 * bei jeder Anzeige neu, ausdrücklich «damit der Verstoss mitwandert». Zwei
 * Lehren, beide gebaut, auf derselben Seite untereinander.
 *
 * **Und die gefährlichere Richtung war nicht die fehlende Aussage, sondern die
 * falsche.** Wird die erste Versammlung nach vorn geschoben, ist die Frist
 * plötzlich eingehalten — der gespeicherte Vermerk hätte weiter behauptet, die
 * Beschlüsse dieses Abends seien anfechtbar. Eine unrichtige Rechtsaussage in
 * einer Einladung ist schlimmer als gar keine.
 *
 * Deshalb rechnet `schreibeAbhaengigeVermerke` in `server/versammlungen.ts` die
 * Vermerke aller abhängigen Zweitversammlungen nach, sobald sich eine
 * Versammlung ändert, die Vorgängerin ist.
 *
 * Gibt `null` zurück, wenn die Frist eingehalten ist, wenn kein Vorgängerdatum
 * vorliegt oder wenn die zweite Versammlung vor der ersten läge — der letzte
 * Fall ist keine Fristverletzung, sondern ein Datenfehler, und
 * `pruefeVersammlung` weist ihn zurück.
 *
 * ## Der Wortlaut, und warum er nach der Laienprüfung vom 24.09.2026 anders ist
 *
 * Die erste Fassung begann mit «Diese Versammlung findet 4 Tage nach der ersten
 * statt.» Die Laienprüfung hat daran drei Dinge gemessen, und alle drei kosten
 * den Vermerk seine Wirkung:
 *
 * **Er sagte nirgends, dass etwas nicht stimmt** (Befund B1). Kein «zu früh»,
 * kein «nicht eingehalten». Dass hier ein Mangel vorliegt, musste die Leserin
 * sich aus zehn minus vier selbst ausrechnen — und das tut niemand, der eine
 * Einladung überfliegt. Der Text war im Ton streng und in der Wirkung harmlos.
 * Er sagt es jetzt im ersten Halbsatz.
 *
 * **Das Datum der ersten Versammlung fehlte** (B2). Es geht in die Rechnung
 * ein, stand aber nicht im Satz; wer die Angabe nachprüfen wollte, musste die
 * alte Einladung suchen. Jetzt stehen beide Daten da.
 *
 * **«Der erste zulässige Termin ist der 12. Dezember»** las sich als
 * Terminangabe für **diese** Versammlung (B4): zwei Daten in einem Schreiben,
 * das zweite im Präsens und mit dem Wort «Termin». Die Folge wäre gewesen, dass
 * jemand den falschen Tag in den Kalender einträgt und nicht erscheint. Jetzt
 * steht der Konjunktiv der Vergangenheit, der in einem Satz klarmacht, was
 * vorher drei Sätze nicht schafften.
 *
 * **Und der Nullfall** (B5): Bei gleichtägigem Abstand entstand «findet 0 Tage
 * nach der ersten statt». Nachgemessen am lebenden Code. Ein Vermerk, der nicht
 * wegklickbar sein soll, darf nicht aussehen, als sei er kaputt — sonst traut
 * die Leserin auch dem Rest nicht mehr. Null und eins haben deshalb eigene
 * Wendungen.
 *
 * **`FRISTLAUF` und `FRISTFOLGE` bleiben wörtlich**, weil sie am 23.09.2026
 * durch beide Prüfungen gegangen sind. Geändert ist nur, was davor steht — und
 * ihre Reihenfolge (B3).
 *
 * **«Nach Gesetz» ist die Grenze der Zusage** (Fachprüfung, Befund F-2). Der
 * Satz hiess zuerst «Der erste zulässige Termin ist der 12. Dezember 2026» und
 * dann «Zulässig wäre sie frühestens am … gewesen». Beide Fassungen sagten
 * etwas über die Zulässigkeit schlechthin, und das kann die Anwendung nicht:
 * Nach Rz. 40 ad Art. 712p darf ein Reglement eine **längere** Frist vorsehen,
 * und dann ist der errechnete Tag eben nicht der erste zulässige. `FRISTLAUF`
 * trägt das Wort «gesetzlich» seit dem 23.09.2026 aus genau diesem Grund; die
 * daraus gezogene Folgerung hatte es verloren. Die Bewirtschafterin hätte den
 * Termin auf einen Tag verschoben, den die Anwendung ihr schwarz auf weiss als
 * zulässig bestätigt, und damit die Reglementsfrist verletzt.
 *
 * **Der Konjunktiv der Vergangenheit ist kein Stil, sondern die Abgrenzung**
 * (F-3). Im Präsens («ist der 12. Dezember») standen in einem Schreiben zwei
 * Daten, beide im Präsens, das zweite mit dem Wort «Termin» — und zwar fett,
 * ohne Vorspann, an der Stelle, an der man in einer Einladung Termine erwartet.
 * Die Folge wäre gewesen, dass jemand am falschen Tag erscheint und am Tag
 * darauf fragt, warum ohne ihn beschlossen wurde.
 *
 * **Die Reihenfolge der beiden Bausteine: zuerst `FRISTLAUF`, dann
 * `FRISTFOLGE`** — und das ist eine Korrektur an einer Korrektur.
 *
 * Die Laienprüfung hatte gemeldet, dass sie an der ersten Klammer aufhört zu
 * lesen («Rz.», «ad»), und dahinter stand die Rechtsfolge (B3). Der naheliegende
 * Schluss war, die Rechtsfolge vorzuziehen. **Der zweite Code-Review vom
 * 24.09.2026 hat gezeigt, dass das schlimmer ist** (Befund 4): Dann enden die
 * Sätze auf «… die Frist dafür beträgt einen Monat und **beginnt**, sobald er
 * von ihnen erfahren hat. Die gesetzliche Frist von zehn Tagen **beginnt** am
 * Tag nach der ersten Versammlung.» Zwei Fristen, beide mit «beginnt», direkt
 * hintereinander — und die zweite liest sich als der Anfang der ersten. Das
 * stellt genau den Irrtum wieder her, den F-1 gerade beseitigt hat, und der
 * Anlass dafür war meine eigene Umstellung.
 *
 * **Die Ordnung ist deshalb die sachliche:** Was ist, wann es zulässig gewesen
 * wäre, warum dieser Tag, und was folgt. `FRISTLAUF` steht damit neben dem Satz,
 * den er erklärt, und zwischen den beiden Fristen liegt ein Satz.
 *
 * **B3 trägt der erste Satz.** Er sagt jetzt im ersten Halbsatz, dass die
 * Versammlung zu früh angesetzt ist — wer nach der ersten Klammer aufhört, hat
 * den Kern bereits. Das war zum Zeitpunkt des Befundes B3 noch nicht so.
 */
export function fristvermerk(
	vorgaengerDatum: string | null | undefined,
	datum: string,
	reglement?: Zweitversammlungsfrist | null
): string | null {
	if (!vorgaengerDatum || !istKalendertag(vorgaengerDatum) || !istKalendertag(datum)) return null;
	const befund = pruefeZehntagesfrist(vorgaengerDatum, datum, reglement?.tage);
	if (befund.eingehalten || befund.abstandTage < 0) return null;

	const abstand =
		befund.abstandTage === 0
			? 'am selben Tag wie die erste'
			: befund.abstandTage === 1
				? 'nur einen Tag nach der ersten'
				: `nur ${befund.abstandTage} Tage nach der ersten`;

	// **Woher die Frist kommt, gehört in den Vermerk.** Er steht in der Einladung
	// und im Protokoll; wer ihn liest, soll nachschlagen können, ob die Schranke
	// aus dem Gesetz oder aus dem eigenen Reglement stammt.
	const laenger = geltendeZweitfrist(reglement?.tage) > FRIST_TAGE;
	const quelle = laenger
		? `Nach dem Reglement Ihrer Gemeinschaft${reglement?.fundstelle ? ` (${reglement.fundstelle})` : ''}`
		: 'Nach Gesetz';

	return (
		`Diese Versammlung ist zu früh angesetzt: Sie findet ${abstand} vom ` +
		`${datumLang(vorgaengerDatum)} statt. ${quelle} hätte sie frühestens am ` +
		`${datumLang(befund.fruehesterTermin)} stattfinden dürfen. ` +
		`${fristlaufSatz(reglement?.tage)} ${FRISTFOLGE}`
	);
}

export function pruefeVersammlung(eingabe: VersammlungEingabe): VersammlungEingabe {
	if (!istKalendertag(eingabe.datum ?? '')) {
		throw new FachlicherFehler('datum_fehlt', 'Das Datum der Versammlung fehlt.', 'datum');
	}
	if (!ZEIT_MUSTER.test(eingabe.uhrzeit ?? '')) {
		throw new FachlicherFehler('uhrzeit_fehlt', 'Die Uhrzeit fehlt oder ist ungültig.', 'uhrzeit');
	}

	const ort = eingabe.ort?.trim() ?? '';
	if (zeichenzahl(ort) < 2) {
		throw new FachlicherFehler(
			'ort_fehlt',
			'Der Versammlungsort fehlt. Er gehört in die Einladung.',
			'ort'
		);
	}

	if (eingabe.art !== 'ordentlich' && eingabe.art !== 'ausserordentlich') {
		throw new FachlicherFehler('art_fehlt', 'Die Art der Versammlung ist zu wählen.', 'art');
	}

	// Der Anlass ist bei der ausserordentlichen Versammlung keine Zierde: An ihm
	// bemisst sich, ob die Einberufung berechtigt war, und er steht in der
	// Einladung. Fehlt er dort, fehlt er auch im Protokoll.
	const anlass = eingabe.anlass?.trim() || undefined;
	if (eingabe.art === 'ausserordentlich' && !anlass) {
		throw new FachlicherFehler(
			'anlass_fehlt',
			'Bei einer ausserordentlichen Versammlung ist der Anlass zu erfassen. Er gehört in die Einladung und ins Protokoll.',
			'anlass'
		);
	}

	if (eingabe.stufe !== 'erste' && eingabe.stufe !== 'zweite') {
		throw new FachlicherFehler('stufe_fehlt', 'Erst- oder Zweitversammlung ist zu wählen.', 'stufe');
	}
	if (eingabe.betriebsart !== 'gefuehrt' && eingabe.betriebsart !== 'einfach') {
		throw new FachlicherFehler(
			'betriebsart_fehlt',
			'Die Betriebsart ist zu wählen.',
			'betriebsart'
		);
	}

	// Eine Zweitversammlung ohne Bezug zur ersten ist keine: Die erleichterte
	// Beschlussfähigkeit nach Art. 712p Abs. 3 gilt nur, weil eine erste
	// stattgefunden hat und beschlussunfähig war.
	if (eingabe.stufe === 'zweite' && !eingabe.vorgaengerId) {
		throw new FachlicherFehler(
			'vorgaenger_fehlt',
			'Eine Zweitversammlung braucht den Bezug zur ersten. Ohne sie gilt die erleichterte Beschlussfähigkeit nicht.',
			'vorgaengerId'
		);
	}
	if (eingabe.stufe === 'erste' && eingabe.vorgaengerId) {
		throw new FachlicherFehler(
			'vorgaenger_ueberzaehlig',
			'Nur eine Zweitversammlung hat eine Vorgängerin.',
			'vorgaengerId'
		);
	}

	// Ein Datum **vor** der ersten Versammlung ist keine Fristverletzung, sondern
	// ein Datenfehler: Die Reihenfolge stimmt nicht, und kein Vermerk könnte das
	// festhalten, weil es die Lage gar nicht gibt. Die zu kurze Frist dagegen
	// hält nicht mehr auf — sie erzeugt den Vermerk aus `fristvermerk`, den
	// Einladung und Protokoll ungefragt führen (R-2b).
	if (eingabe.stufe === 'zweite' && eingabe.vorgaengerDatum) {
		if (pruefeZehntagesfrist(eingabe.vorgaengerDatum, eingabe.datum).abstandTage < 0) {
			throw new FachlicherFehler(
				'vorgaenger_spaeter',
				'Die zweite Versammlung liegt vor der ersten.',
				'datum'
			);
		}
	}

	return {
		stwegId: eingabe.stwegId,
		datum: eingabe.datum,
		uhrzeit: eingabe.uhrzeit,
		ort,
		art: eingabe.art,
		stufe: eingabe.stufe,
		betriebsart: eingabe.betriebsart,
		// Bei der ordentlichen Versammlung wird ein mitgeschickter Anlass
		// verworfen, nicht mitgeschleppt: Er hätte dort keine Bedeutung und
		// erschiene doch in der Einladung.
		anlass: eingabe.art === 'ausserordentlich' ? anlass : undefined,
		vorgaengerId: eingabe.stufe === 'zweite' ? (eingabe.vorgaengerId ?? null) : null,
		vorgaengerDatum: eingabe.stufe === 'zweite' ? (eingabe.vorgaengerDatum ?? null) : null
	};
}

/**
 * Der Vorschlag für die zweite Versammlung, wenn die erste vertagt wird.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
 * durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
 * später. Wobei auch die Gemeinschaft entscheiden kann, die Sitzung zu
 * verschieben.»
 *
 * **Warum das eine eigene Rechnung ist und kein Formularfeld.** Die zweite
 * Versammlung braucht drei Angaben, die zusammengehören: die Stufe, die
 * Vorgängerin und ein Datum, das die Zehntagesfrist einhält (ZGB 712p Abs. 2).
 * Wer sie von Hand anlegt, setzt erfahrungsgemäss das Datum und vergisst die
 * anderen beiden — und dann sieht die zweite Versammlung aus wie eine erste.
 * Die Anwendung verlangt dann ein Quorum, das das Gesetz für sie gar nicht mehr
 * verlangt, und meldet eine Beschlussunfähigkeit, die es nicht gibt.
 *
 * Das Datum ist ein **Vorschlag**, kein Zwang: Der frühestmögliche Tag ist
 * selten der passende. Wer ihn ändert, prüft die Frist wie sonst auch.
 */
/**
 * Ein Kalendertag, um so viele Tage verschoben.
 *
 * **Mittags in UTC gerechnet**, nicht um Mitternacht: Sonst wandert das Datum
 * beim Umstellen der Sommerzeit um einen Tag, und ausgerechnet die
 * Zehntagesfrist stünde dann auf neun.
 */
export function tageSpaeter(datum: string, tage: number): string {
	const t = new Date(`${datum}T12:00:00Z`);
	t.setUTCDate(t.getUTCDate() + tage);
	return t.toISOString().slice(0, 10);
}

export function folgeversammlung(
	vorgaengerin: {
		id: Id;
		stwegId: Id;
		datum: string;
		uhrzeit: string;
		ort: string;
		art: Versammlungsart;
		anlass?: string | null;
		betriebsart: Betriebsart;
	},
	/**
	 * Wie viele Tage nach der ersten. Vorgabe: `MINDESTABSTAND_TAGE`, also der
	 * erste zulässige Abstand (elf), nicht die gesetzliche Frist (zehn). Die
	 * beiden auseinanderzuhalten ist der Kern von Befund R-1.
	 */
	abstandTage = MINDESTABSTAND_TAGE,
	/**
	 * Die Stufe der Folgeversammlung (`folgestufeNachVertagung`). Eine neue
	 * erste hat keine Vorgängerin: Art. 712p Abs. 2 und die Zehntagesfrist
	 * gelten nur für die zweite (C3, F4c).
	 */
	stufe: Versammlungsstufe = 'zweite'
): VersammlungEingabe {
	return {
		stwegId: vorgaengerin.stwegId,
		datum: tageSpaeter(vorgaengerin.datum, abstandTage),
		// Uhrzeit und Ort werden übernommen: Wer vertagt, plant meist dieselbe
		// Stunde am selben Ort. Beides steht danach im Formular und lässt sich
		// ändern.
		uhrzeit: vorgaengerin.uhrzeit,
		ort: vorgaengerin.ort,
		art: vorgaengerin.art,
		stufe,
		betriebsart: vorgaengerin.betriebsart,
		anlass: vorgaengerin.anlass ?? undefined,
		...(stufe === 'zweite'
			? { vorgaengerId: vorgaengerin.id, vorgaengerDatum: vorgaengerin.datum }
			: {})
	};
}

export function legeVersammlungAn(
	id: Id,
	operatorId: Id,
	eingabe: VersammlungEingabe,
	reglement?: Zweitversammlungsfrist | null
): Uebergang<Versammlung> {
	const geprueft = pruefeVersammlung(eingabe);

	const vermerk = fristvermerk(geprueft.vorgaengerDatum, geprueft.datum, reglement);

	const v: Versammlung = {
		...geprueft,
		id,
		operatorId,
		zustand: 'entwurf',
		vorgaengerId: geprueft.vorgaengerId ?? null,
		fristvermerk: vermerk,
		aktuellesTraktandumId: null,
		// Dieselbe Vorgabe wie in der Datenbank (Migration 108). Sie steht hier
		// noch einmal, weil dieser Wert vor dem ersten Schreiben gebraucht wird
		// und nicht erst beim Zurücklesen.
		papierfrage: true
	};

	return uebergang(
		v,
		ereignis(
			EREIGNISARTEN.versammlungAngelegt,
			{ art: 'meeting', id },
			{
				gemeinschaft: geprueft.stwegId,
				datum: geprueft.datum,
				art: geprueft.art,
				stufe: geprueft.stufe,
				betriebsart: geprueft.betriebsart,
				// Ausdrücklich mitgeschrieben: Wurde die Frist verletzt, steht der
				// Vermerk mit dem Wortlaut von damals im Verlauf. Am Datensatz
				// wird er bei jeder Änderung neu gerechnet; der Verlauf ist die
				// eine Stelle, an der das nicht passieren darf.
				fristvermerk: vermerk
			}
		)
	);
}

/**
 * Ändert die Angaben einer Versammlung im Entwurf.
 *
 * Nach der Freigabe ist Schluss: Datum und Ort stehen dann in versandten
 * Einladungen, und eine stille Änderung im System machte die Einladung zur
 * Falschauskunft.
 */
export function aendereVersammlung(
	bisher: Versammlung,
	eingabe: VersammlungEingabe,
	reglement?: Zweitversammlungsfrist | null
): Uebergang<Versammlung> {
	verlangeZustand(bisher, ['entwurf'], 'ändern');
	const geprueft = pruefeVersammlung({ ...eingabe, stwegId: bisher.stwegId });

	// Der Vermerk wird mitgerechnet, nicht mitgeschleppt: Wer das Datum korrigiert
	// und damit die Frist wieder einhält, soll den Vermerk loswerden — und wer sie
	// dabei erst verletzt, soll ihn bekommen. Ein Wert aus `bisher` täte weder das
	// eine noch das andere.
	const neu: Versammlung = {
		...bisher,
		...geprueft,
		vorgaengerId: geprueft.vorgaengerId ?? null,
		fristvermerk: fristvermerk(geprueft.vorgaengerDatum, geprueft.datum, reglement)
	};
	const felder: Record<string, { vorher: unknown; nachher: unknown }> = {};
	for (const feld of [
		'datum',
		'uhrzeit',
		'ort',
		'art',
		'stufe',
		'betriebsart',
		'anlass',
		'vorgaengerId',
		// **Nicht `vorgaengerDatum`** (Code-Review vom 24.09.2026, Befund 2). Es
		// steht am Typ, wird aus der Datenbank aber nie zurückgelesen: `bisher`
		// trägt dort immer `undefined`, `neu` ein Datum oder `null`, und
		// `undefined !== null` schlägt **immer** an. Die Folge wäre ein
		// `meeting.updated` bei jeder Speicherung, auch ohne Änderung, mit einem
		// Eintrag, der ein `nachher` ohne `vorher` zeigt, als sei das Datum eben
		// erst gesetzt worden. Die Wirkung deckt `fristvermerk` ohnehin ab: Ändert
		// sich das Vorgängerdatum wirklich, ändert sich der Vermerk mit.
		'fristvermerk'
	] as const) {
		if (bisher[feld] !== neu[feld]) felder[feld] = { vorher: bisher[feld], nachher: neu[feld] };
	}

	if (Object.keys(felder).length === 0) return uebergang(neu);

	return uebergang(
		neu,
		ereignis(EREIGNISARTEN.versammlungGeaendert, { art: 'meeting', id: bisher.id }, { felder })
	);
}

/**
 * Wechselt die Betriebsart.
 *
 * Bis zur Eröffnung, danach nicht mehr. Ein Wechsel mitten in der Versammlung
 * hiesse, dass die Erfassungswege wechseln: Wer schon am Telefon abgestimmt
 * hat, müsste plötzlich auf der Papierliste stehen — oder umgekehrt, und
 * niemand wüsste, welche der beiden Erfassungen gilt.
 */
export function wechsleBetriebsart(
	v: Versammlung,
	neue: Betriebsart,
	grund?: string
): Uebergang<Versammlung> {
	verlangeZustand(v, ['entwurf', 'freigegeben'], 'die Betriebsart wechseln');
	if (v.betriebsart === neue) return uebergang(v);

	return uebergang(
		{ ...v, betriebsart: neue },
		ereignis(
			EREIGNISARTEN.betriebsartGewechselt,
			{ art: 'meeting', id: v.id },
			{ vorher: v.betriebsart, nachher: neue, grund: grund?.trim() || null }
		)
	);
}

// ── Zustandsübergänge ───────────────────────────────────────────────────────

/**
 * Der Name jedes Zustands.
 *
 * **Ausgeführt und nicht als Liste**, damit der Compiler auf Vollständigkeit
 * besteht: `Record<Versammlungszustand, string>` lässt keinen Zustand aus. Die
 * Probe zu `abgeschlossen()` leitet ihre Prüfmenge daraus ab, statt sie zu
 * tippen; eine getippte Liste bliebe grün, wenn ein sechster Zustand dazukäme.
 */
export const ZUSTANDSNAMEN: Record<Versammlungszustand, string> = {
	entwurf: 'Entwurf',
	freigegeben: 'freigegeben',
	laufend: 'laufend',
	geschlossen: 'geschlossen',
	versiegelt: 'versiegelt'
};

export function zustandsname(z: Versammlungszustand): string {
	return ZUSTANDSNAMEN[z] ?? z;
}

/**
 * Verlangt einen der zulässigen Zustände.
 *
 * Die Fehlermeldung nennt den Ist-Zustand. «Nicht erlaubt» allein liesse die
 * Sitzungsleitung im Saal ratlos zurück.
 */
export function verlangeZustand(
	v: Pick<Versammlung, 'zustand'>,
	erlaubt: Versammlungszustand[],
	handlung: string
): void {
	if (!erlaubt.includes(v.zustand)) {
		throw new FachlicherFehler(
			'zustand_unpassend',
			`Eine Versammlung im Zustand «${zustandsname(v.zustand)}» lässt sich nicht ${handlung}. ` +
				`Möglich ist das im Zustand ${erlaubt.map(zustandsname).map((n) => `«${n}»`).join(' oder ')}.`,
			'zustand'
		);
	}
}

/**
 * Eröffnet die Versammlung.
 *
 * Ab hier zählt die Anwesenheit, und ab hier ist die Momentaufnahme
 * unveränderlich — die Rücknahme der Freigabe ist damit versperrt (AD-3). Der
 * Übergang verlangt nichts weiter: Ob die Versammlung beschlussfähig ist,
 * entscheidet sich erst bei der einzelnen Abstimmung und nicht hier. Eine
 * beschlussunfähige Versammlung darf eröffnet werden — sie muss es sogar, damit
 * die Beschlussunfähigkeit überhaupt festgestellt und protokolliert werden kann.
 */
export function eroeffne(v: Versammlung): Uebergang<Versammlung> {
	verlangeZustand(v, ['freigegeben'], 'eröffnen');

	return uebergang(
		{ ...v, zustand: 'laufend' },
		ereignis(
			EREIGNISARTEN.versammlungEroeffnet,
			{ art: 'meeting', id: v.id },
			{ datum: v.datum, betriebsart: v.betriebsart }
		)
	);
}

/**
 * Schliesst die Versammlung.
 *
 * Danach ist jeder Zugangscode wertlos, und es kommt keine Stimme mehr dazu.
 * Offene Abstimmungen werden ab Epic 5 vorher geschlossen; hier wird nur
 * verlangt, dass keine mehr offen ist — eine Abstimmung, die nach dem Schliessen
 * der Versammlung noch offen wäre, könnte niemand mehr zu Ende bringen.
 */
export function schliesse(v: Versammlung, offeneAbstimmungen = 0): Uebergang<Versammlung> {
	verlangeZustand(v, ['laufend'], 'schliessen');

	if (offeneAbstimmungen > 0) {
		throw new FachlicherFehler(
			'abstimmung_offen',
			`${offeneAbstimmungen} ${offeneAbstimmungen === 1 ? 'Abstimmung ist' : 'Abstimmungen sind'} ` +
				`noch offen. Schliessen Sie sie zuerst — nach dem Schliessen der Versammlung liesse sie ` +
				`sich nicht mehr zu Ende bringen.`,
			'abstimmungen'
		);
	}

	return uebergang(
		{ ...v, zustand: 'geschlossen', aktuellesTraktandumId: null },
		ereignis(EREIGNISARTEN.versammlungGeschlossen, { art: 'meeting', id: v.id }, { datum: v.datum })
	);
}

/**
 * Setzt das gerade behandelte Traktandum.
 *
 * Ein Feld der Versammlung und damit eine einzige Wahrheit (AD-10):
 * Steuerungssicht, Präsentationssicht und Teilnehmersicht lesen dieses Feld und
 * halten keinen eigenen Begriff davon. Hielten sie einen, zeigte der Beamer ein
 * anderes Traktandum als das Telefon — und im Saal weiss niemand, worüber gerade
 * gesprochen wird.
 */
export function setzeAktuellesTraktandum(
	v: Versammlung,
	traktandumId: Id | null
): Uebergang<Versammlung> {
	verlangeZustand(v, ['laufend'], 'auf ein Traktandum stellen');
	if ((v.aktuellesTraktandumId ?? null) === traktandumId) return uebergang(v);

	return uebergang(
		{ ...v, aktuellesTraktandumId: traktandumId },
		ereignis(
			EREIGNISARTEN.traktandumAufgerufen,
			{ art: 'meeting', id: v.id },
			{ vorher: v.aktuellesTraktandumId ?? null, nachher: traktandumId }
		)
	);
}

/**
 * Setzt, was an der Wand steht, solange kein Geschäft läuft.
 *
 * Anders als das aufgerufene Traktandum schon vor dem Eröffnen erlaubt: Die
 * Begrüssung gehört an die Wand, **bevor** die Versammlung beginnt — das ist
 * ihr ganzer Zweck. Nach dem Schliessen nicht mehr; dort ist der Abend vorbei.
 */
export function setzeWandbild(
	v: Versammlung,
	art: Wandbildart,
	text: string | null,
	jetzt: Zeitpunkt
): Uebergang<Versammlung> {
	verlangeZustand(v, ['freigegeben', 'laufend'], 'das Wandbild wechseln');

	const wortlaut = (text ?? '').trim();
	if (art === 'frei' && wortlaut === '') {
		throw new FachlicherFehler(
			'wandbild_ohne_text',
			'Für den eigenen Text fehlt der Wortlaut. Ohne ihn bliebe die Wand leer.',
			'text'
		);
	}

	// Ein Text an einer Art, die keinen kennt, wäre eine Angabe ohne Ort — und
	// stünde beim nächsten Wechsel auf «frei» unversehens wieder da.
	const neu: Wandbild = {
		art,
		text: art === 'frei' ? wortlaut : null,
		geaendertAm: jetzt
	};

	return uebergang(
		{ ...v, wandbild: neu },
		ereignis(
			EREIGNISARTEN.wandbildGesetzt,
			{ art: 'meeting', id: v.id },
			// Der Wortlaut geht in den Verlauf: Was im Saal an der Wand stand, ist
			// später eine Tatsache und keine Randnotiz.
			{ vorher: v.wandbild?.art ?? 'traktanden', nachher: art, text: neu.text }
		)
	);
}

/** Ist die Versammlung noch änderbar — Traktanden, Angaben, Betriebsart? */
export function istImEntwurf(v: Pick<Versammlung, 'zustand'>): boolean {
	return v.zustand === 'entwurf';
}

/** Läuft sie gerade — nimmt sie also Anwesenheit und Stimmen entgegen? */
export function istLaufend(v: Pick<Versammlung, 'zustand'>): boolean {
	return v.zustand === 'laufend';
}

/** Ab hier gilt die Momentaufnahme, nicht mehr die Stammdaten (AD-3). */
export function rechnetAufMomentaufnahme(v: Pick<Versammlung, 'zustand'>): boolean {
	return v.zustand !== 'entwurf';
}

/**
 * Der Satz im Ausklapper «Vertagen», wenn die Versammlung an diesem Abend
 * schon beschlussfähig war und die Folgeversammlung deshalb eine neue erste
 * wird (C3, F4c; `folgestufeNachVertagung`). Leitung und Anwesenheit zeigen
 * ihn gleich; der Fall ohne Beschlussfähigkeit behält seinen Satz.
 */
export function vertagenNeueErsteSatz(datum: string): string {
	return (
		'Die Versammlung war heute schon beschlussfähig: Die Beschlussfähigkeit ist festgehalten, oder es wurde ' +
		'verbindlich abgestimmt. Was beschlossen ist, bleibt gültig. Votum legt deshalb keine zweite Versammlung an, ' +
		'sondern eine neue erste, und rechnet dort vorsichtig mit der Beschlussfähigkeit einer ersten. ' +
		NEUE_ERSTE_HUERDE +
		' Ausdrücklich geregelt ist der Fall nicht (SVIT-Kommentar Rz. 20 und 34 ad Art. 712p: Eine zweite folgt ' +
		'auf eine erste, die nicht durchgeführt werden konnte). Die neue erste entsteht sofort als Entwurf, mit ' +
		'den Traktanden aus der Einladung, über die nicht verbindlich abgestimmt wurde. Sie hat dieselbe Uhrzeit ' +
		'und denselben Ort, Datum ' +
		`${datum}. ${NEUE_ERSTE_TERMIN} Uhrzeit, Ort und Traktanden lassen sich dort ebenso ändern. Wird auch ` +
		'die neue erste nicht beschlussfähig, folgt ihr eine zweite.'
	);
}

/**
 * Die Hürde der neuen ersten in Worten (Laienprüfung F4c, Block 2): «die
 * Beschlussfähigkeit einer ersten» allein sagt der Leitung nicht, wie viele
 * kommen müssen. Das Reglement kann mehr verlangen (Art. 712p Abs. 1 ist
 * dispositiv nach oben).
 */
const NEUE_ERSTE_HUERDE =
	'Nach Gesetz müssen dafür die Hälfte aller Eigentümer anwesend oder vertreten sein, mit zusammen der ' +
	'Hälfte der Wertquoten, mindestens zwei Eigentümer. Das Reglement kann mehr verlangen.';

/**
 * Der Termin einer neuen ersten ist ein Vorschlag (Laien- und Fachprüfung
 * F4c, Block 2, R1-b): Die Einladungsfrist einer ersten prüft Votum nicht, und
 * gälte doch die mildere Lesart, wäre die Folgeversammlung eine zweite mit der
 * zwingenden Zehntagesfrist (Rz. 39 ad Art. 712p). Der Vorschlag hält sie ein.
 */
const NEUE_ERSTE_TERMIN =
	'Prüfen Sie vor dem Versand zwei Dinge: Liegt zwischen Versand und Termin mindestens die Einladungsfrist ' +
	'Ihres Reglements, ohne eine solche eine angemessene? Und liegt der Termin frühestens am elften Tag nach ' +
	'dieser Versammlung? Das zweite trägt auch, falls doch die Regeln einer zweiten Versammlung gelten. Der ' +
	'Vorschlag hält nur den elften Tag sicher ein; Votum prüft beides nicht, auch nicht nach einer Änderung. ' +
	'Reicht die Frist nicht, verschieben Sie das Datum im Entwurf.';

/** Die Überschrift des Ausklappers «Vertagen», nach der Stufe der Folgeversammlung (C3, F4c). */
export function vertagenUeberschrift(zeitweiseBeschlussfaehig: boolean): string {
	return zeitweiseBeschlussfaehig
		? 'Vertagen und neue Versammlung ansetzen'
		: 'Vertagen und zweite Versammlung ansetzen';
}

/** Ein Haus, das vertagt wurde, mit der Stufe seiner Folgeversammlung. */
export interface Folgestufe {
	gemeinschaft: string;
	folgestufe: Versammlungsstufe;
}

/**
 * Welche Folgeversammlung als zweite und welche als neue erste tagt, für die
 * Meldung nach dem Vertagen und die Bemerkung am Folgeabend (C3, F4c). Bis F4c
 * stand dort für alle «Art. 712p Abs. 3, ohne Mindestzahl beschlussfähig»;
 * Abs. 3 verlangt aber ein Drittel der Eigentümer, mindestens zwei.
 */
export function folgestufenSatz(haeuser: readonly Folgestufe[]): string {
	const liste = (stufe: Versammlungsstufe) => {
		const n = haeuser.filter((h) => h.folgestufe === stufe).map((h) => `«${h.gemeinschaft}»`);
		return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} und ${n.at(-1)}`;
	};
	const anzahl = (stufe: Versammlungsstufe) => haeuser.filter((h) => h.folgestufe === stufe).length;
	const saetze: string[] = [];
	if (anzahl('zweite') > 0) {
		saetze.push(
			`Als zweite Versammlung ${anzahl('zweite') === 1 ? 'tagt' : 'tagen'} ${liste('zweite')}. ` +
				ZWEITE_HUERDE.replace('dort', 'Dort')
		);
	}
	if (anzahl('erste') > 0) {
		const eine = anzahl('erste') === 1;
		saetze.push(
			`Als neue erste Versammlung ${eine ? 'tagt' : 'tagen'} ${liste('erste')}, weil ${eine ? 'sie' : 'diese'} ` +
				`am vertagten Abend schon beschlussfähig ${eine ? 'war' : 'waren'}; Votum rechnet dort vorsichtig ` +
				'mit der Beschlussfähigkeit einer ersten. Für die Einladung dazu gilt die Frist einer ersten Versammlung. ' +
				'Prüfen Sie vor dem Versand, ob der gemeinsame Termin sie einhält und frühestens am elften Tag nach dem ' +
				'vertagten Abend liegt.'
		);
	}
	return saetze.join(' ');
}

/**
 * Was an der zweiten genügt, in Worten (Laienprüfung F4c, Block 2). Nur für
 * die Geschäfte, die in der Einladung zur ersten zur Abstimmung angekündigt waren: Für neue und für
 * übernommene Kenntnisnahmen gilt die Lesart L5 (C1, C2), und das Reglement
 * kann mehr verlangen.
 */
const ZWEITE_HUERDE =
	'dort genügt nach Gesetz ein Drittel aller Eigentümer, mindestens zwei (ZGB Art. 712p Abs. 3). Das gilt für ' +
	'die Geschäfte, die in der Einladung zur vertagten Versammlung zur Abstimmung angekündigt waren.';

/** Die Meldung nach dem Vertagen einer einzelnen Versammlung (Leitung, Anwesenheit). */
export function vertagtMeldung(
	folge: { datum: string; uhrzeit: string; ort: string },
	folgestufe: Versammlungsstufe,
	datumText: string
): string {
	return folgestufe === 'zweite'
		? `Vertagt. Die zweite Versammlung steht als Entwurf bereit: ${datumText}, ${folge.uhrzeit} Uhr, ` +
				`${folge.ort}. ${ZWEITE_HUERDE.replace('dort', 'Dort')}`
		: 'Vertagt. Die Versammlung war schon beschlussfähig; die Folgeversammlung steht deshalb als neue erste ' +
				`Versammlung im Entwurf bereit: ${datumText}, ${folge.uhrzeit} Uhr, ${folge.ort}. Votum rechnet dort ` +
				`mit der Beschlussfähigkeit einer ersten. ${NEUE_ERSTE_HUERDE} ${NEUE_ERSTE_TERMIN}`;
}
