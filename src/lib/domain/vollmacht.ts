/**
 * Vertretung und Vollmacht (Welle 2, FR-23 bis FR-25).
 *
 * **Erst prüfen, dann aktivieren.** Eine erfasste Vollmacht überträgt nichts.
 * Erst die ausdrückliche Bestätigung durch die Sitzungsleitung macht sie
 * wirksam. Die Reihenfolge stammt aus dem Vorgängerprojekt und hat einen
 * nüchternen Grund: Wer eine Vollmacht vorlegt, behauptet etwas — bestätigt
 * wird sie von der Person, die im Saal dafür einsteht.
 *
 * **Zwei Wörter, zwei Wortstämme.** Wer die Stimme ausübt, heisst überall die
 * **bevollmächtigte Person**; wessen Stimme ausgeübt wird, steht als
 * **«Vollmacht für …»**. Das frühere Paar «Vertreter / Vertretener» unterschied
 * sich um zwei Buchstaben — in einer Liste im Saal ist das die Verwechslung
 * eingebaut. Und «Vertretener» wäre ohnehin falsch, wo eine Gemeinschaft
 * vertreten wird.
 *
 * **Was hier nicht steht: die Anwesenheit.** Eine bestätigte Vollmacht ändert
 * keine Zählfunktion. Trifft die bevollmächtigte Person ein, wird für jede
 * Partei, für die sie eine Vollmacht hält, ein Anwesenheitsereignis geschrieben
 * (Weg `vertretung`); geht sie, gehen sie mit. Würde die Anwesenheit statt dessen beim Lesen aus der Vollmacht
 * abgeleitet, gäbe es zwei Quellen für dieselbe Aussage — und ein später
 * geändertes Vollmachtsverhältnis verschöbe rückwirkend das Ergebnis einer
 * Abstimmung von 20:00 Uhr (AD-16).
 *
 * **Die Vollmacht gilt für die ganze Partei, nicht je Einheit.** FR-23 nennt
 * «für alle oder für einzelne Einheiten»; umgesetzt ist die ganze Partei. Eine
 * Teilvollmacht hiesse, dass eine Partei für zwei ihrer drei Einheiten anwesend
 * wäre und für die dritte nicht — das kann die Anwesenheit als Ereignisfolge
 * nicht ausdrücken, und es zöge sich durch Beschlussfähigkeit, Auszählung und
 * Präsentationssicht. Der praktische Fall dahinter ist selten: Wer eine
 * Vollmacht ausstellt, gibt sie für seine Beteiligung, nicht für eine Wohnung
 * davon.
 */
import { FachlicherFehler } from './gemeinschaft';
import type { Stimmfuehrungswahl } from './lesarten';
import type { Id, Zeitpunkt } from './types';
import { zeichenzahl } from './zeichenzahl';

/**
 * Der Lebensweg einer Vollmacht.
 *
 * `erfasst` überträgt nichts, `bestaetigt` überträgt die Ausübung.
 * `zurueckgewiesen` und `widerrufen` sind Enden — eine beendete Vollmacht lebt
 * nicht wieder auf, es entsteht allenfalls eine neue.
 */
export type Vollmachtszustand = 'erfasst' | 'bestaetigt' | 'zurueckgewiesen' | 'widerrufen';

export const ZUSTANDSNAMEN: Record<Vollmachtszustand, string> = {
	erfasst: 'erfasst, noch nicht wirksam',
	bestaetigt: 'bestätigt und wirksam',
	zurueckgewiesen: 'zurückgewiesen',
	widerrufen: 'beendet'
};

export interface Vollmacht {
	id: Id;
	meetingId: Id;
	/** Wer vertreten wird — die Zeilenkennung der Momentaufnahme. */
	vertreteneId: Id;
	vertreteneName: string;
	/** Die bevollmächtigte Person, wenn sie selbst Eigentümerin dieser Versammlung ist. */
	bevollmaechtigtId: Id | null;
	/** Ihr Name, wenn sie eine dritte Person ist. Genau eines von beiden. */
	bevollmaechtigtName: string | null;
	zustand: Vollmachtszustand;
	/** Ob sie im Saal erfasst oder über den persönlichen Zugang erklärt wurde. */
	herkunft: Vollmachtsherkunft;
	/**
	 * Handelt diese Person für die Eigentümerin selbst statt kraft
	 * gewöhnlicher Vollmacht (Organ, gesetzliche Vertretung, mitberechtigt)?
	 * `null` heisst: gewöhnliche Vollmacht, zählt zur Höchstzahl (Ä-28).
	 * Gewählt wird es seit dem 03.11.2026 bei «Handelt für die Eigentümerin
	 * selbst?» (`GRUNDFRAGE`); `mitberechtigt` leitet Votum meist selbst her.
	 */
	vertretungsgrund: Vertretungsgrund | null;
	/**
	 * Bei `mitberechtigt`: Hat Votum die Mitberechtigung aus dem Register
	 * hergeleitet, oder hat die Leitung sie für eine nicht eingetragene Person
	 * gewählt? `null` bei jedem anderen Grund und bei Vollmachten aus der Zeit
	 * vor dem 03.11.2026; die gelten weiter als belegpflichtig (`nachweisFehlt`).
	 *
	 * Gelesen aus dem Verlaufseintrag `proxy.recorded`, nicht aus dem heutigen
	 * Register (`server/vollmacht.ts`, `MITBERECHTIGUNG_AUS_VERLAUF`).
	 */
	mitberechtigung: Mitberechtigung | null;
	/** Original am Eingang vorgelegt und von der Sitzungsleitung gesehen. */
	nachweisVorgelegt: boolean;
	/**
	 * Die bevollmächtigte Person ist die Verwaltung (L8, Migration 184). Nur
	 * bei einem Vertreter ohne Eigentum: Eine Partei dieser Versammlung wäre
	 * selbst stimmberechtigt, und ihr Ausstand ist erklärbar (Migration 062).
	 * An Traktanden, die als Geschäft der Verwaltung gekennzeichnet sind,
	 * ruhen diese Vollmachten nach der Einstellung der Gemeinschaft.
	 */
	istVerwaltung: boolean;
	/** Zahl der hinterlegten Dateien (PDF oder Foto). */
	anzahlDateien: number;
	bemerkung: string | null;
	erfasstAm: Zeitpunkt;
	erfasstDurch: string | null;
	bestaetigtAm: Zeitpunkt | null;
	bestaetigtDurch: string | null;
	beendetAm: Zeitpunkt | null;
	beendetGrund: string | null;
	beendetDurch: string | null;
}

/**
 * Wer von Gesetzes wegen vertritt statt kraft Vollmacht (Ä-28, Migration 120).
 *
 * **Der Anlass.** Die Zweitprüfung vom 17.09.2026 hält fest: «Organvertreter
 * juristischer Personen, gesetzliche Vertreter und Mitberechtigte zählen nicht
 * zur Höchstzahl.» Seit dem 24.09.2026 sperrt die Anwendung beim Erfassen,
 * wenn die Höchstzahl des Reglements überschritten würde — und hätte damit eine
 * rechtlich einwandfreie Vertretung abgewiesen, ohne Weg daran vorbei.
 *
 * **Warum das kein zweites Begründungsfeld ist.** Befund R-2b hat am 23.09.2026
 * ein Feld entfernt, das freien Text entgegennahm und damit eine Prüfung
 * abschaltete. Hier stehen drei **Tatsachen** zur Wahl, die zutreffen oder
 * nicht, jede mit eigener Rechtsgrundlage. Wer den falschen Wert wählt, benutzt
 * keinen vorgesehenen Weg, sondern macht eine Falschangabe.
 *
 * **Warum sie trotzdem als Vollmacht geführt werden.** Ein Organvertreter hat
 * keine Vollmacht, er **ist** die Eigentümerin im Handeln. Die Anwendung führt
 * ihn dennoch in derselben Tabelle, weil die Wirkung dieselbe ist: Eine Person
 * übt die Stimme einer anderen Zeile aus. Alles andere hiesse, den Einlass,
 * die Auszählung und das Protokoll auf zwei Wege zu bauen, von denen einer
 * selten benutzt und deshalb selten gepflegt würde.
 */
export const VERTRETUNGSGRUENDE = ['organ', 'gesetzlich', 'mitberechtigt'] as const;
export type Vertretungsgrund = (typeof VERTRETUNGSGRUENDE)[number];

/**
 * Wie die drei Gründe heissen, wo jemand sie liest.
 *
 * An **einer** Stelle, weil drei Verbraucher sie brauchen: die Auswahl beim
 * Erfassen, die Vollmachtenliste und das Protokoll. Dreimal getippt wäre
 * dreimal zu pflegen, und die Fassung im Protokoll ist die, die im
 * Anfechtungsfall gelesen wird.
 *
 * **Der Verlauf speichert den Rohwert** (Code-Review vom 24.09.2026, B7):
 * Er ist ein Nachweis, und was dort einmal steht, lässt sich nicht mehr
 * ändern. In der Datenbank steht deshalb `organ`, nicht dieser Text.
 *
 * **Die Verlaufsseite liest diesen Text seit dem 06.10.2026 als vierter
 * Leser mit** (V1, über `domain/verlaufswerte.ts`) und zeigt «Organ einer
 * juristischen Person»; gespeichert bleibt der Rohwert. Das Verlaufsblatt im Siegelpaket zeigt
 * weiter `organ`, bis der Block «Verlaufsblatt lesbar» mit Laienprüfung
 * kommt (Kommentar in `server/siegel.ts`, `trageZusammen`).
 */
export const VERTRETUNGSGRUND_TEXT: Record<Vertretungsgrund, string> = {
	organ: 'Organ einer juristischen Person',
	gesetzlich: 'gesetzliche Vertretung',
	mitberechtigt: 'mitberechtigt an derselben Einheit'
};

/**
 * Woher Votum bei `mitberechtigt` weiss, dass die Person mitberechtigt ist
 * (Produktentscheid 03.11.2026, Fachprüfung F1 Runde 2, Frage 1.4).
 *
 *   eingetragen        Die bevollmächtigte Partei steht im Register als
 *                      Mitglied der vertretenen gemeinschaftlichen Zeile
 *                      (`party_member`). Votum leitet den Grund selbst her,
 *                      ohne Nachweis: Ein allein anwesender Mitberechtigter
 *                      führt die Stimme kraft vermuteter Vollmacht (Rz. 19,
 *                      24 ad Art. 712o).
 *   nicht_eingetragen  Die Leitung hat den Grund gewählt, weil die Person im
 *                      Register fehlt (etwa ein Erbe). Dann steht die
 *                      Mitberechtigung nicht fest, und es braucht einen
 *                      Nachweis der Mitberechtigung statt einer Vollmacht
 *                      (Folgerung aus Rz. 27 ad Art. 712m und Rz. 19 ad
 *                      Art. 712o).
 *
 * **Ohne neue Spalte.** In der Datenbank steht beide Male `mitberechtigt`; der
 * Unterschied steht im Verlaufseintrag der Erfassung, der sich nicht mehr
 * ändern lässt. Aus dem heutigen Register liesse er sich nicht nachträglich
 * lesen: Trägt die Verwaltung den Erben nach der Versammlung ein, sagte das
 * Protokoll danach etwas anderes als am Abend.
 */
export const MITBERECHTIGUNGEN = ['eingetragen', 'nicht_eingetragen'] as const;
export type Mitberechtigung = (typeof MITBERECHTIGUNGEN)[number];

/**
 * Der Vermerk für Protokoll, Verlauf und Vollmachtenliste.
 *
 * **«im Register», nicht bloss «eingetragen»** (Laienprüfung 03.11.2026,
 * C-1): Wer «eingetragen» liest, denkt beim Eigentum ans Grundbuch, und der
 * Grundbuchauszug ist gerade einer der Nachweise. Gemeint ist das Register
 * der Verwaltung in Votum.
 */
export const NICHT_EINGETRAGEN_TEXT =
	'nicht als Mitberechtigte im Register eingetragen, Nachweis der Mitberechtigung';

export const MITBERECHTIGUNG_TEXT: Record<Mitberechtigung, string> = {
	// «kein Nachweis nötig» statt «ohne Nachweis»: Im Protokoll klang das nach
	// einem Mangel (Laienprüfung 03.11.2026, C9-1).
	eingetragen: 'als Mitberechtigte im Register eingetragen, kein Nachweis nötig',
	nicht_eingetragen: NICHT_EINGETRAGEN_TEXT
};

/**
 * Der Grund in Worten, mit dem Vermerk, wenn die Person nicht eingetragen ist.
 * `null` bei einer gewöhnlichen Vollmacht.
 *
 * Für jede Stelle, die den Grund anzeigt (Protokoll, Vollmachtenliste,
 * `vertretungszeitraeume`): Wer «mitberechtigt» liest, soll sehen, ob Votum
 * es aus dem Register weiss oder ob ein Nachweis dahintersteht.
 */
export function vertretungsgrundInWorten(
	v: Pick<Vollmacht, 'vertretungsgrund' | 'mitberechtigung'>
): string | null {
	if (!v.vertretungsgrund) return null;
	const text = VERTRETUNGSGRUND_TEXT[v.vertretungsgrund];
	return v.vertretungsgrund === 'mitberechtigt' && v.mitberechtigung === 'nicht_eingetragen'
		? `${text}, ${NICHT_EINGETRAGEN_TEXT}`
		: text;
}

/**
 * Die Frage nach dem Grund in den drei Formularen (Einlass, Einlass einer
 * dritten Person, Vollmachtenseite), an einer Stelle.
 *
 * **«mitberechtigt» steht nur noch als «nicht eingetragen» zur Wahl.** Wer im
 * Register als Mitberechtigte steht, wird erkannt (`bestimmeVertretungsgrund`);
 * die alte Frage «Vertritt von Gesetzes wegen?» traf diese Person ohnehin
 * nicht, sie ist Eigentümerin der Einheit und keine Vertreterin.
 */
export const GRUNDFRAGE = 'Handelt für die Eigentümerin selbst?';

export const GRUNDWAHL: readonly { wert: '' | Vertretungsgrund; text: string }[] = [
	{ wert: '', text: 'nein, gewöhnliche Vollmacht' },
	{ wert: 'organ', text: `ja, als ${VERTRETUNGSGRUND_TEXT.organ}` },
	{ wert: 'gesetzlich', text: `ja, als ${VERTRETUNGSGRUND_TEXT.gesetzlich}` },
	{ wert: 'mitberechtigt', text: 'ja, mitberechtigt, aber nicht im Register (mit Nachweis)' }
];

/**
 * Die Hilfe, wo die bevollmächtigte Person eine Partei dieser Versammlung ist.
 *
 * **«Partei», nicht «Einheit»** (Fachprüfung 03.11.2026, C3): Eine
 * gemeinschaftliche Partei kann mehrere Einheiten halten; wer «eine einzige
 * Einheit» liest, erfasst den Einstellplatz der Erbengemeinschaft gesondert.
 * **Auch für eine Einzelperson** (C6): Stirbt die Alleineigentümerin, gehört
 * die Einheit den Erben gemeinsam, bevor das Register es weiss.
 */
export function grundhilfe(stimmfuehrung: Stimmfuehrungswahl = 'ausserhalb'): string {
	// L15 (Migration 194; Codeprüfung M1): die Höchstzahl nach der Wahl der Gemeinschaft.
	return (
		(stimmfuehrung === 'mitzaehlen'
			? 'Mitberechtigte, die im Register von Votum stehen, erkennt Votum selbst, und es braucht keinen ' +
				'Nachweis. Ihre Stimme für die gemeinsame Partei zählt nach der Einstellung Ihrer Gemeinschaft zur ' +
				'Höchstzahl. Ein '
			: 'Mitberechtigte, die im Register von Votum stehen, erkennt Votum selbst: Für ihre gemeinsame ' +
				'Partei zählt Votum die Stimme nicht zur Höchstzahl, und es braucht keinen Nachweis. Ein ') +
		'Grund gilt nur für eine einzige Partei. «Nicht im Register» geht nur mit Nachweis der ' +
		'Mitberechtigung: bei Erben die Erbbescheinigung, sonst etwa ein Grundbuchauszug. Das gilt auch für ' +
		'die Partei einer verstorbenen Alleineigentümerin.'
	);
}

/**
 * Der Vermerk an einer Vertretung mit Grund (Seite «Vollmachten»), nach L15
 * (Codeprüfung M1): Unter «mitzaehlen» zählt die Stimmführung als
 * Mitberechtigte mit, Organ und gesetzliche Vertretung nicht.
 */
export function grundvermerk(
	v: Pick<Vollmacht, 'vertretungsgrund'>,
	stimmfuehrung: Stimmfuehrungswahl = 'ausserhalb'
): string {
	return zaehltZurHoechstzahl(v, stimmfuehrung)
		? 'Zählt nach der Einstellung Ihrer Gemeinschaft zur Höchstzahl'
		: 'Zählt nicht zur Höchstzahl';
}

/** Die Hilfe beim Einlass einer dritten Person: Sie steht nie im Register. */
export const GRUNDHILFE_DRITTE =
	'Wer als dritte Person kommt, steht nicht im Register von Votum. Ist die Person trotzdem ' +
	'mitberechtigt, etwa als Erbe, wählen Sie «nicht im Register». Das geht nur für eine ' +
	'einzige Partei mit allen ihren Einheiten und nur mit Nachweis der Mitberechtigung: bei ' +
	'Erben die Erbbescheinigung, sonst etwa ein Grundbuchauszug. Auch jeder andere Grund gilt nur für ' +
	'eine einzige Partei.';

/**
 * Die Absage, wenn der Nachweis der Mitberechtigung fehlt (Bestätigen und
 * Einlass). **Mit dem Ausweg** (Laienprüfung 03.11.2026, C4-1): Wer an der
 * Tür nichts dabeihat, stimmt nicht als Mitberechtigte, wohl aber mit einer
 * Vollmacht der übrigen.
 */
export const OHNE_NACHWEIS_DER_MITBERECHTIGUNG =
	'Ohne Nachweis der Mitberechtigung keine Bestätigung, denn die Person steht nicht als ' +
	'Mitberechtigte im Register von Votum. Vermerken Sie, dass der Nachweis vorliegt (bei Erben ' +
	'die Erbbescheinigung, sonst etwa ein Grundbuchauszug), oder hinterlegen Sie ihn als Datei. ' +
	'Fehlt er, kann die Person nicht als Mitberechtigte stimmen. Mit einer Vollmacht der übrigen ' +
	'Mitberechtigten geht es als gewöhnliche Vollmacht; bei Miteigentum genügt ihre Mehrheit.';

const OHNE_NACHWEIS =
	'Ohne Nachweis keine Bestätigung: Bestätigen Sie, dass Ihnen das Original vorgelegen hat, ' +
	'oder hinterlegen Sie es als Datei.';

/**
 * Der Hinweis bei der Höchstzahl (Fachprüfung F1 Runde 2, 1.2), nach der Wahl
 * zu L15 (Migration 194).
 *
 * **Als Einstellung der Gemeinschaft, nicht als Rechtslage.** Ob eine
 * reglementarische Höchstzahl die Stimmführung für die eigene gemeinsame
 * Einheit erfasst, ist nicht geklärt (`quellen`, Frage 77). Ein Satz «zählt
 * nicht mit» ohne den zweiten Teil gäbe eine offene Frage als gesichert aus.
 */
export function hoechstzahlMitberechtigte(wahl: Stimmfuehrungswahl): string {
	return (
		'Die Stimme einer Mitberechtigten für die eigene gemeinsame Einheit zählt nach der Einstellung Ihrer ' +
		`Gemeinschaft ${wahl === 'mitzaehlen' ? 'zur' : 'nicht zur'} Höchstzahl. Ob eine Höchstzahl sie erfasst ` +
		// Fachprüfung F-7: beide offenen Fragen.
		'und ob ein Reglement sie ausdrücklich einbeziehen darf, ist nicht geklärt.'
	);
}

/**
 * Welcher Grund für **diese eine** Vertretung gilt (Produktentscheid
 * 03.11.2026, Punkte 1, 3 und 6).
 *
 * **Herleitung statt Klick.** Ist die bevollmächtigte Partei im Register
 * Mitglied der vertretenen gemeinschaftlichen Zeile, gilt `mitberechtigt`,
 * auch wenn niemand etwas gewählt hat. Die Herleitung gilt je Vertretenem:
 * Wer für die eigene gemeinsame Wohnung und daneben für drei Nachbarn
 * erscheint, führt eine Stimme ausserhalb der Höchstzahl und drei
 * gewöhnliche Vollmachten.
 *
 * **Von Hand** bleiben `organ` und `gesetzlich`, wie gewählt, und
 * `mitberechtigt` für eine Person, die nicht im Register steht. Dass sie
 * einen Nachweis braucht, prüft das Bestätigen (`nachweisFehlt`).
 *
 * **Auch für eine Partei, die keine gemeinschaftliche Zeile ist** (Fachprüfung
 * 03.11.2026, C6, Stufe hoch; Produktentscheid E1). Hier stand eine Absage
 * «keine gemeinschaftliche Einheit, also gibt es dort keine Mitberechtigten».
 * Das schloss vom Register aufs Recht: Stirbt die Alleineigentümerin, erwerben
 * die Erben die Einheit kraft Gesetzes und gemeinsam (Art. 560 Abs. 2, 602
 * Abs. 2 ZGB), lange bevor die Verwaltung sie erfasst. Die einzige anwesende
 * Erbin mit Erbbescheinigung wurde abgewiesen. Die übrigen Schranken bleiben:
 * genau eine Partei, Nachweis Pflicht, Vermerk im Protokoll.
 *
 * **Was hier nicht steht:** «nur für eine Partei». Das sieht nur, wer alle
 * gewählten Vertretenen kennt (`verlangeEinGrundEinePartei`).
 */
export function bestimmeVertretungsgrund(e: {
	gewaehlt: Vertretungsgrund | null;
	vertreteneIstHuelle: boolean;
	bevollmaechtigtIstMitglied: boolean;
}): { vertretungsgrund: Vertretungsgrund | null; mitberechtigung: Mitberechtigung | null } {
	if (e.gewaehlt === 'organ' || e.gewaehlt === 'gesetzlich') {
		return { vertretungsgrund: e.gewaehlt, mitberechtigung: null };
	}
	if (e.bevollmaechtigtIstMitglied && e.vertreteneIstHuelle) {
		return { vertretungsgrund: 'mitberechtigt', mitberechtigung: 'eingetragen' };
	}
	if (e.gewaehlt === 'mitberechtigt') {
		return { vertretungsgrund: 'mitberechtigt', mitberechtigung: 'nicht_eingetragen' };
	}
	return { vertretungsgrund: null, mitberechtigung: null };
}

/**
 * Ein Grund von Hand gilt für genau eine Partei (Produktentscheid
 * 03.11.2026, Punkt 4).
 *
 * **Der Anlass.** Beim Einlass galt der gewählte Grund für alle angekreuzten
 * Vertretenen. Wer für die eigene Firma «Organ» wählte und daneben zwei
 * gewöhnliche Vollmachten mitbrachte, nahm die beiden mit aus der Höchstzahl.
 * Die Sperre gilt für jeden Grund, weil die Klasse dieselbe ist.
 */
export function verlangeEinGrundEinePartei(
	gewaehlt: Vertretungsgrund | null | undefined,
	anzahlVertretene: number
): void {
	if (gewaehlt && anzahlVertretene > 1) {
		throw new FachlicherFehler(
			'grund_mehrere',
			'Ein Grund bei «' + GRUNDFRAGE + '» gilt nur für eine einzige Partei. Wählen Sie hier nur ' +
				'die Partei, für die er zutrifft, und erfassen Sie die übrigen Vollmachten derselben ' +
				'Person einzeln als gewöhnliche Vollmacht. Mitberechtigte, die im Register stehen, ' +
				'erkennt Votum dabei selbst.',
			'vertretungsgrund'
		);
	}
}

/**
 * Der Hinweis, wenn mehrere Mitberechtigte derselben Einheit da sind
 * (Produktentscheid 03.11.2026, Punkt 2; Rz. 18a, 26 bis 28 ad Art. 712o).
 *
 * **Ein Hinweis, keine Sperre.** Die Einigung geschieht im Saal vor der
 * Leitung und braucht nichts Schriftliches; Votum kann sie nicht prüfen. Dass
 * eine Einheit nicht zweimal vertreten wird, hält schon der eindeutige
 * Schlüssel `proxy_eine_je_partei`, und wer selbst anwesend ist, lässt sich
 * nicht zusätzlich vertreten (`erfasseInTx`, «bereits anwesend»).
 *
 * **Der Vorbehalt des Reglements gehört dazu** (Fachprüfung Runde 2, 1.4 c):
 * Rz. 28 ist die Folge ohne reglementarische Bestimmung, Rz. 26 stellt die
 * Weiche davor.
 *
 * **Mit der Handlung in Votum** (Laienprüfung 03.11.2026, C8-1, hoch): Ohne
 * sie nimmt die Leitung «ungültig» zur Kenntnis, und die Stimme wird trotzdem
 * gezählt. Dazu die Mehrheit beim Miteigentum (Rz. 18 ad Art. 712o,
 * Fachprüfung C8) und «die anwesenden Mitberechtigten» statt «die
 * Anwesenden» (C8-2).
 */
export function mitberechtigtenhinweis(l: { huelle: string; fuehrt: string | null }): string {
	return (
		`Bei ${l.huelle} sind mehrere Mitberechtigte da` +
		(l.fuehrt ? `; die Stimme führt zurzeit ${l.fuehrt}` : '') +
		'. Die anwesenden Mitberechtigten bestimmen, wer die eine Stimme führt. Bei Miteigentum ' +
		'genügt die Mehrheit, bei Gesamteigentum wie einer Erbengemeinschaft braucht es in der Regel ' +
		'alle. Einen Nachweis braucht es nicht. Führt eine andere Person, beenden ' +
		'Sie auf der Seite Vollmachten die laufende Vertretung und erfassen die gewählte. Kommt ' +
		`keine Einigung zustande, ist die Stimme von ${l.huelle} nach dem Kommentar ungültig, sofern ` +
		'das Reglement nichts anderes bestimmt. Erfassen Sie dann für diese Abstimmung keine ' +
		`Stimme von ${l.huelle}.`
	);
}

/**
 * Zählt diese Vertretung zur Höchstzahl des Reglements?
 *
 * **Die Regel steht an drei Stellen, und das ist bewusst hingenommen**
 * (Code-Review vom 24.09.2026, B8). Hier für die Warnung, in
 * `verlangeVollmachtsgrenze` als frühes `return` für die neu erfasste Zeile,
 * und ein drittes Mal in der Abfrage über
 * den Bestand. Die dritte lässt sich nicht hierher holen: Sie filtert in der
 * Datenbank, und alle Zeilen zu laden, um sie danach zu verwerfen, wäre eine
 * Rechnung mehr für dieselbe Antwort.
 *
 * Wer die Ausnahme je einschränkt, ändert drei Stellen, und die dritte sucht
 * niemand im Kern. Deshalb steht sie hier genannt.
 *
 * **L15 schränkt sie ein** (Migration 194, Entscheid 0054 Punkte 2 und 6):
 * Unter «mitzaehlen» zählt die Stimmführung als Mitberechtigte mit, Organ und
 * gesetzliche Vertretung bleiben ausserhalb. Die beiden anderen Stellen lesen
 * dieselbe Wahl (`verlangeVollmachtsgrenze` in `server/vollmacht.ts`).
 */
export function zaehltZurHoechstzahl(
	v: Pick<Vollmacht, 'vertretungsgrund'>,
	stimmfuehrung: Stimmfuehrungswahl = 'ausserhalb'
): boolean {
	return !v.vertretungsgrund || (v.vertretungsgrund === 'mitberechtigt' && stimmfuehrung === 'mitzaehlen');
}

/** Überträgt diese Vollmacht die Ausübung? Genau ein Zustand tut das. */
export function istWirksam(v: Pick<Vollmacht, 'zustand'>): boolean {
	return v.zustand === 'bestaetigt';
}

/** Offen heisst: erfasst und noch nicht bestätigt — sie wartet auf die Prüfung. */
export function istOffen(v: Pick<Vollmacht, 'zustand'>): boolean {
	return v.zustand === 'erfasst';
}

// ── Erfassen ────────────────────────────────────────────────────────────────

export interface Vollmachtseingabe {
	vertreteneId: Id;
	/** Entweder die Kennung einer anderen Partei ... */
	bevollmaechtigtId?: Id | null;
	/** ... oder der Name einer dritten Person. */
	bevollmaechtigtName?: string | null;
	/**
	 * Der Grund, den die Leitung bei «Handelt für die Eigentümerin selbst?»
	 * gewählt hat (`GRUNDFRAGE`). Leer heisst: gewöhnliche Vollmacht, solange
	 * `bestimmeVertretungsgrund` nicht `mitberechtigt` herleitet.
	 *
	 * **Keine Pflichtangabe**, und das ist Absicht: Die Vorgabe ist der
	 * Normalfall, und wer nichts wählt, bekommt die strengere Behandlung. Ein
	 * Pflichtfeld zwänge die Sitzungsleitung, bei jeder gewöhnlichen Vollmacht
	 * eine Rechtsfrage zu beantworten, die sich nicht stellt.
	 */
	vertretungsgrund?: Vertretungsgrund | null;
	bemerkung?: string | null;
	/**
	 * Woher die Erklärung stammt.
	 *
	 * «leitung» heisst: im Saal erfasst, ein Mensch hat den Nachweis gesehen.
	 * «zugang» heisst: die vertretene Person hat sie über ihren persönlichen
	 * Zugang selbst erklärt. Der Unterschied gehört in den Nachweis — wer ihn
	 * einebnet, behauptet später mehr, als er weiss.
	 */
	herkunft?: Vollmachtsherkunft;
	/**
	 * Die bevollmächtigte Person ist die Verwaltung (L8, Migration 184).
	 * **Keine Pflichtangabe** wie der Vertretungsgrund: Die Vorgabe ist der
	 * Normalfall (eine beliebige dritte Person), und das Häkchen ändert keine
	 * Zahl, solange kein Traktandum mit Häkchen abstimmungspflichtig dazukommt.
	 * Wird es bei einer Partei dieser Versammlung gesetzt, gilt es als nicht
	 * gesetzt: Unter `/z/` zeigt die Maske das Häkchen immer, auch wenn eine
	 * Partei gewählt ist, und der Kern verwirft es dann still, statt
	 * abzusagen; die Schranke der Datenbank (`proxy_verwaltung_nur_dritte`)
	 * bleibt die Rückfallebene für jeden Weg, der die Eingabe nicht über
	 * `pruefeEingabe` schickt.
	 */
	istVerwaltung?: boolean;
}

export const HERKUENFTE = ['leitung', 'zugang'] as const;
export type Vollmachtsherkunft = (typeof HERKUENFTE)[number];

export interface GepruefteEingabe {
	vertreteneId: Id;
	bevollmaechtigtId: Id | null;
	bevollmaechtigtName: string | null;
	vertretungsgrund: Vertretungsgrund | null;
	bemerkung: string | null;
	herkunft: Vollmachtsherkunft;
	istVerwaltung: boolean;
}

/**
 * Prüft eine Eingabe, bevor sie in die Datenbank geht.
 *
 * Die Datenbank prüft dasselbe noch einmal (AD-6) — hier steht es, damit die
 * Meldung im Formular einen Satz und keine Regelverletzung nennt.
 */
export function pruefeEingabe(e: Vollmachtseingabe): GepruefteEingabe {
	const bevollmaechtigtId = e.bevollmaechtigtId?.trim() || null;
	const bevollmaechtigtName = e.bevollmaechtigtName?.trim() || null;

	if (!e.vertreteneId?.trim()) {
		throw new FachlicherFehler('ohne_vertretene', 'Es ist niemand gewählt, für den die Vollmacht gilt.', 'vertreteneId');
	}
	if (bevollmaechtigtId && bevollmaechtigtName) {
		throw new FachlicherFehler(
			'zwei_bevollmaechtigte',
			'Wählen Sie entweder eine Eigentümerin oder einen Eigentümer dieser Versammlung oder tragen Sie eine dritte Person ein — nicht beides.',
			'bevollmaechtigtId'
		);
	}
	if (!bevollmaechtigtId && !bevollmaechtigtName) {
		throw new FachlicherFehler(
			'ohne_bevollmaechtigte',
			'Es fehlt die bevollmächtigte Person: entweder aus dieser Versammlung oder eine dritte Person mit Namen.',
			'bevollmaechtigtId'
		);
	}
	if (bevollmaechtigtName && zeichenzahl(bevollmaechtigtName) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Name der bevollmächtigten Person fehlt oder ist zu kurz.',
			'bevollmaechtigtName'
		);
	}
	if (bevollmaechtigtId && bevollmaechtigtId === e.vertreteneId.trim()) {
		throw new FachlicherFehler(
			'sich_selbst',
			'Niemand bevollmächtigt sich selbst.',
			'bevollmaechtigtId'
		);
	}

	const grund = e.vertretungsgrund ?? null;
	if (grund && !VERTRETUNGSGRUENDE.includes(grund)) {
		// Die Datenbank prüft dasselbe (Migration 120). Hier steht es, damit die
		// Meldung einen Satz nennt und keine Regelverletzung.
		throw new FachlicherFehler(
			'vertretungsgrund_unbekannt',
			'Der Grund der Vertretung ist keiner der drei zulässigen.',
			'vertretungsgrund'
		);
	}

	/*
	 * **Hier stand bis zum 24.09.2026 eine Absage, und sie war falsch.** Sie
	 * wies `organ` und `gesetzlich` ab, sobald eine Partei dieser Versammlung
	 * gewählt war, mit der Begründung, ein Organvertreter sei gerade keine
	 * Eigentümerin. Der Code-Review desselben Tages hat gezeigt, dass das nicht
	 * durchgehend trägt: Sie ist keine Eigentümerin **der vertretenen Einheit**,
	 * kann aber sehr wohl Partei derselben Versammlung sein.
	 *
	 *   - Frau X besitzt Wohnung 3 persönlich und ist Geschäftsführerin der
	 *     GmbH, der Wohnung 5 gehört.
	 *   - Ein Vater besitzt Wohnung 1 und hat die elterliche Sorge über das
	 *     Kind, dem Wohnung 2 gehört.
	 *
	 * Beide Lagen sind nicht selten, und die Absage sperrte sie. Der Ausweg, den
	 * sie nannte («als dritte Person mit Namen eintragen»), machte es schlimmer:
	 * Eine Vollmacht ohne Parteikennung verliert im Protokoll die Verknüpfung
	 * zur Zeile dieser Person, und dann steht sie im Saal, führt zwei Stimmen,
	 * und ihre eigene Zeile bleibt leer.
	 *
	 * **Geprüft wird hier deshalb nur der Wert selbst.** Ob `organ` oder
	 * `gesetzlich` zutrifft, weiss die Anwendung nicht; das ist der Preis
	 * dafür, dass es Tatsachen sind und keine Rechnung.
	 *
	 * **Für `mitberechtigt` gilt das seit dem 03.11.2026 nicht mehr**
	 * (Produktentscheid, Fachprüfung F1). Ob Vertreter und Vertretene eine
	 * Einheit teilen, steht im Register, und das kennt dieser Kern nicht. Die
	 * Prüfung steht deshalb in `bestimmeVertretungsgrund`, die `erfasseInTx` mit
	 * den Tatsachen aus der Datenbank aufruft, und «ein Grund, eine Partei» in
	 * `verlangeEinGrundEinePartei` bei den drei Wegen, die mehrere Vertretene
	 * auf einmal erfassen.
	 */

	return {
		vertreteneId: e.vertreteneId.trim(),
		bevollmaechtigtId,
		bevollmaechtigtName,
		vertretungsgrund: grund,
		bemerkung: e.bemerkung?.trim() || null,
		herkunft: e.herkunft === 'zugang' ? 'zugang' : 'leitung',
		// L8 (Migration 184): Nur ein Vertreter ohne Eigentum kann die
		// Verwaltung sein; bei einer Partei dieser Versammlung gilt das
		// Häkchen als nicht gesetzt, und der Kern verwirft es still (G5,
		// 06.11.2026): Die Maske bietet es dort gar nicht an, und eine Absage
		// mit eigenem Wortlaut wäre für einen Fall gebaut, den kein Weg der
		// Anwendung erreicht. Die Schranke der Datenbank
		// (`proxy_verwaltung_nur_dritte`) bleibt die Rückfallebene.
		istVerwaltung: e.istVerwaltung === true && !bevollmaechtigtId
	};
}

/** Wie der Nachweis heisst, wenn er über den persönlichen Zugang erklärt wurde. */
export const NACHWEIS_UEBER_ZUGANG =
	'Elektronisch über den persönlichen Zugang erklärt';

/**
 * Der Nachweissatz einer Vollmacht — für Liste, Protokoll und Abschlusspaket.
 *
 * Die drei Fälle auseinanderzuhalten ist der Punkt: Ein vorgelegtes Original
 * ist etwas anderes als eine elektronische Erklärung, und beide sind etwas
 * anderes als gar nichts.
 */
export function nachweisInWorten(
	herkunft: Vollmachtsherkunft,
	vorgelegt: boolean,
	anzahlDateien: number
): string {
	const teile: string[] = [];
	if (herkunft === 'zugang') teile.push(NACHWEIS_UEBER_ZUGANG);
	if (vorgelegt) teile.push('Original vorgelegt');
	if (anzahlDateien > 0) {
		teile.push(`${anzahlDateien} ${anzahlDateien === 1 ? 'Datei' : 'Dateien'} hinterlegt`);
	}
	return teile.length > 0 ? teile.join(' · ') : 'Kein Nachweis vermerkt';
}

// ── Bestätigen, zurückweisen, beenden ───────────────────────────────────────

/**
 * Darf diese Vollmacht bestätigt werden?
 *
 * Zwei Bedingungen, und beide sind fachlich: Sie muss offen sein, und es muss
 * einen Nachweis geben. «Original vorgelegt» genügt — das ist der übliche Weg
 * am Eingang, und das Foto kommt später (FR-24). Ohne beides bestätigte die
 * Sitzungsleitung etwas, das sie nicht gesehen hat.
 *
 * **Die elektronische Erklärung ist selbst der Nachweis.** Wer über seinen
 * persönlichen Zugang bevollmächtigt, hat es mit dem Merkmal getan, das ihm
 * zugestellt wurde — ein Original, das daneben vorzulegen wäre, gibt es nicht.
 * Diese Ausnahme fehlte zuerst, und die Folge war eine Vollmacht, die sich
 * überhaupt nicht bestätigen liess: erfasst, aber für immer wirkungslos.
 * Aufgefallen im Prüflauf, nicht im Saal.
 *
 * Die Sitzungsleitung prüft trotzdem — nur eben die Erklärung und nicht ein
 * Blatt. Zweifelt sie, weist sie zurück; dafür ist der Weg da.
 */
/**
 * Ob sich diese Vollmacht bestätigen lässt — die Frage, die
 * `verlangeBestaetigbar` mit einer Absage beantwortet.
 *
 * **Damit die Sicht die Regel nicht abschreibt** (Code-Review 06.09.2026): Der
 * erste Anlauf baute die Bedingung im Markup nach. Kommt eine dritte
 * Nachweisart dazu oder ändert sich die Ausnahme für den Zugangsweg, stünde
 * dort wieder ein Knopf, der nur scheitern kann — oder ein Absagesatz vor
 * einer Vollmacht, die sehr wohl bestätigbar wäre.
 */
export function istBestaetigbar(
	v: Pick<
		Vollmacht,
		'zustand' | 'nachweisVorgelegt' | 'anzahlDateien' | 'vertretungsgrund' | 'mitberechtigung'
	> & {
		herkunft?: Vollmachtsherkunft;
	}
): boolean {
	try {
		verlangeBestaetigbar(v);
		return true;
	} catch (fehler) {
		/*
		 * **Nur die fachliche Absage heisst «nein»** (Code-Review 08.09.2026).
		 * Ein blosses `catch { return false }` verschluckt auch einen
		 * Programmierfehler: Der Knopf verschwände lautlos, und an seiner Stelle
		 * stünde ein Absagesatz, der sachlich falsch ist. Alles andere gehört
		 * weitergeworfen, damit es auffällt.
		 */
		if (fehler instanceof FachlicherFehler) return false;
		throw fehler;
	}
}

/**
 * Fehlt der Nachweis, ohne den nicht bestätigt werden darf?
 *
 * **Damit die Sicht auch diesen Satz nicht abschreibt** (Code-Review
 * 08.09.2026). `istBestaetigbar` beantwortet «geht es überhaupt», und das ist
 * auch bei beendetem Zustand `false`. Wer im Markup begründen will, **warum**
 * es nicht geht, braucht genau diese eine Frage; nachgebaut stand sie dort
 * zuletzt als `herkunft !== 'zugang' && !nachweisVorgelegt && nachweise.length
 * === 0`, also die Regel ein zweites Mal.
 */
export function nachweisFehlt(
	v: Pick<
		Vollmacht,
		'nachweisVorgelegt' | 'anzahlDateien' | 'vertretungsgrund' | 'mitberechtigung'
	> & { herkunft?: Vollmachtsherkunft }
): boolean {
	if (!brauchtNachweis(v)) return false;
	return !v.nachweisVorgelegt && v.anzahlDateien === 0;
}

/**
 * Verlangt diese Vertretung überhaupt einen Nachweis?
 *
 * Zwei Ausnahmen. Die elektronische Erklärung ist selbst der Nachweis (oben).
 * **Und die eingetragene Mitberechtigte** (Produktentscheid 03.11.2026): Sie
 * führt die Stimme der eigenen gemeinsamen Einheit kraft vermuteter Vollmacht,
 * ohne ausdrückliche (Rz. 19, 24 ad Art. 712o); sind mehrere da, einigen sie
 * sich im Saal, ohne Schriftliches (Rz. 18a). Ein verlangter Nachweis wiese
 * das Ehepaar ab, das gemeinsam eine Wohnung hält, also den häufigsten Fall
 * gemeinsamen Eigentums (Fachprüfung F1 Runde 2, 1.4 b).
 *
 * **Nicht eingetragen braucht einen**, nämlich den der Mitberechtigung. Und
 * `mitberechtigt` ohne Vermerk (vor dem 03.11.2026 erfasst) bleibt
 * belegpflichtig, wie es beim Erfassen galt.
 */
export function brauchtNachweis(
	v: Pick<Vollmacht, 'vertretungsgrund' | 'mitberechtigung'> & { herkunft?: Vollmachtsherkunft }
): boolean {
	if (v.herkunft === 'zugang') return false;
	return !(v.vertretungsgrund === 'mitberechtigt' && v.mitberechtigung === 'eingetragen');
}

/** Welcher Nachweis gemeint ist, in den Beschriftungen und Absagen. */
export function nachweisart(v: Pick<Vollmacht, 'vertretungsgrund' | 'mitberechtigung'>): string {
	return v.vertretungsgrund === 'mitberechtigt' && v.mitberechtigung === 'nicht_eingetragen'
		? 'Nachweis der Mitberechtigung (bei Erben die Erbbescheinigung)'
		: 'Original der Vollmacht';
}

export function verlangeBestaetigbar(
	v: Pick<
		Vollmacht,
		'zustand' | 'nachweisVorgelegt' | 'anzahlDateien' | 'vertretungsgrund' | 'mitberechtigung'
	> & {
		herkunft?: Vollmachtsherkunft;
	}
): void {
	if (v.zustand === 'bestaetigt') {
		throw new FachlicherFehler('schon_bestaetigt', 'Diese Vollmacht ist bereits bestätigt.', 'zustand');
	}
	if (v.zustand !== 'erfasst') {
		throw new FachlicherFehler(
			'beendet',
			'Diese Vollmacht ist beendet und lässt sich nicht mehr bestätigen. Erfassen Sie eine neue.',
			'zustand'
		);
	}
	if (nachweisFehlt(v)) {
		throw new FachlicherFehler(
			'ohne_nachweis',
			v.vertretungsgrund === 'mitberechtigt' && v.mitberechtigung === 'nicht_eingetragen'
				? OHNE_NACHWEIS_DER_MITBERECHTIGUNG
				: OHNE_NACHWEIS,
			'nachweis'
		);
	}
}

/** Darf sie noch beendet werden? Ein Ende ist endgültig. */
export function verlangeBeendbar(v: Pick<Vollmacht, 'zustand'>): void {
	if (v.zustand === 'zurueckgewiesen' || v.zustand === 'widerrufen') {
		throw new FachlicherFehler('schon_beendet', 'Diese Vollmacht ist bereits beendet.', 'zustand');
	}
}

/** Eine Begründung ist Pflicht (FR-25) — ohne sie wäre der Eintrag im Protokoll wertlos. */
export function verlangeGrund(grund: string | null | undefined, feld = 'grund'): string {
	const wortlaut = (grund ?? '').trim();
	if (zeichenzahl(wortlaut) < 3) {
		throw new FachlicherFehler(
			'ohne_grund',
			'Bitte begründen Sie es in einem Satz. Die Begründung steht im Verlauf und später im Protokoll.',
			feld
		);
	}
	return wortlaut;
}

/** Der Grund, der eingetragen wird, wenn die vertretene Person selbst erscheint. */
export const SELBST_ERSCHIENEN =
	'Die vertretene Person ist selbst erschienen; die Vertretung endet ab diesem Zeitpunkt.';

// ── Die Schranke aus dem Reglement ──────────────────────────────────────────

export interface Vollmachtsschranke {
	hoechstzahl: number | null;
	fundstelle: string | null;
	/**
	 * Die Wahl zu L15 (Migration 194). Ohne Angabe die Vorgabe: Die
	 * Stimmführung als Mitberechtigte zählt nicht mit.
	 */
	stimmfuehrung?: Stimmfuehrungswahl;
}

/**
 * Der Schlüssel, unter dem eine bevollmächtigte Person gezählt wird.
 *
 * **Der Anlass** (Sicherheitsprüfung vom 24.09.2026, Befund 1). Gezählt wurde
 * über den Anzeigenamen als **exakte** Zeichenkette. Der Name einer dritten
 * Person ist aber Freitext des Aufrufers, und zwar auch auf dem Eigentümerpfad
 * `/z`, der ohne Benutzerkonto erreichbar ist: Wer einmal «Aebi», einmal «aebi»
 * und einmal «Hans  Aebi» mit zwei Leerzeichen eintippt, erzeugt drei
 * Zählgruppen und überschreitet die Grenze des Reglements beliebig weit.
 *
 * **Das Schlimmere war, dass die Warnung denselben blinden Fleck hatte.**
 * `ueberschreitungen` bildete den Schlüssel genauso. Die Umgehung erzeugte
 * damit weder eine Absage beim Erfassen noch eine Warnung auf der
 * Vollmachtenseite — und die überzähligen Stimmen zählten bei Köpfen und
 * Wertquoten voll mit. Genau die Fehlerklasse, gegen die die Sperre gebaut
 * wurde.
 *
 * **Deshalb steht er hier und nicht an der Abfrage.** Sperre und Warnung müssen
 * dieselbe Gruppierung benutzen; zwei Fassungen ergäben zwei Zahlen für
 * dieselbe Lage. `verlangeVollmachtsgrenze` in `server/vollmacht.ts` holt die
 * Namen und ruft **diese** Funktion auf.
 *
 * **Der erste Versuch bildete den Ausdruck in SQL nach, und daran ist er
 * gescheitert** (zweiter Code-Review vom 24.09.2026): `\s` heisst in
 * JavaScript und in Postgres nicht dasselbe. Ein geschütztes Leerzeichen
 * überlebte die eine Normalisierung und nicht die andere, und die Sperre liess
 * durch, was die Warnung zählte. Es war nicht die falsche Zeichenklasse, es war
 * die zweite Umsetzung — und die hätte sich durch Angleichen nur bis zum
 * nächsten Zeichen retten lassen.
 *
 * **Was normalisiert wird und was nicht.** Unicode-Form (NFC), Innenleerraum,
 * Rand und Gross-/Kleinschreibung. **Nicht** Abkürzungen, Vornamen oder
 * Schreibvarianten eines Namens: «H. Aebi» und «Hans Aebi» bleiben zwei
 * Personen. Das ist Absicht — wer sie zusammenführen wollte, müsste raten, und
 * eine Sperre, die aus Ähnlichkeit schliesst, weist irgendwann die falsche
 * Vollmacht ab.
 */
export function vollmachtsschluessel(name: string): string {
	return name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Ob der Name am Einlass derselbe ist wie der einer vorab erfassten Vollmacht
 * an eine dritte Person (E3, 11.11.2026).
 *
 * Unter demselben Schlüssel, unter dem Votum Vollmachten je Bevollmächtigtem
 * zählt und kennzeichnet. Der Einlass (`lasseDurchDritteEin`) und die Auswahl
 * in der Maske (`sperrgrundAmEinlass`) fragen beide hier, damit die Maske
 * nicht anbietet, was der Server abweist, und nicht sperrt, was er annähme.
 * Bis zum 11.11.2026 verglich der Server wörtlich, die Maske gar nicht.
 */
export function gleicheDrittePerson(erfasst: string | null | undefined, eingegeben: string): boolean {
	const k = vollmachtsschluessel(eingegeben);
	return !!erfasst && k.length > 0 && vollmachtsschluessel(erfasst) === k;
}

/**
 * Der Sperrgrund eines Eintrags in «Vollmacht für …» beim Einlass einer
 * dritten Person, abhängig vom eingegebenen Namen.
 *
 * Eine vorab erfasste Vollmacht, etwa an die Verwaltung, sperrt die Partei
 * für jede andere Person. Für dieselbe Person ist sie der Grund des Einlasses:
 * Der Server übernimmt die Zeile, bestätigt sie und lässt die Partei ein. Vor
 * dem 11.11.2026 stand sie auch dann ausgegraut «bereits bevollmächtigt an …»
 * (gemessen beim Bau von `e2e/lesarten-l8.mjs`, 08.11.2026), und der Weg im
 * Handbuch führte zu einer Vollmacht, die im Saal nicht wirkte.
 */
export function sperrgrundAmEinlass(
	eintrag: { gesperrt?: string | null; vorabFuer?: string | null },
	name: string
): string | null {
	if (gleicheDrittePerson(eintrag.vorabFuer, name)) return null;
	return eintrag.gesperrt ?? null;
}

/**
 * Das Häkchen «Bevollmächtigt ist die Verwaltung» beim Einlass einer dritten
 * Person, aus den beiden Feldern der Maske (E3, 11.11.2026).
 *
 * Ein angekreuztes, nicht vorbelegtes Kästchen heisst «die Verwaltung». Ein leeres heisst nur
 * dann «nicht die Verwaltung», wenn die Maske es vorbelegt hatte, weil der Name
 * schon eine gekennzeichnete Vollmacht trägt (`istVerwaltungVorher` = «ja»): Dann
 * hat jemand es bewusst abgewählt. Sonst heisst es «nicht angegeben», und die
 * Kennzeichnung bleibt, wie sie ist (Codeprüfung Lauf 5, B1): Ein nie
 * vorbelegtes Kästchen nähme sonst bei jedem Einlass still weg, was die Leitung
 * vorab gesetzt hat. Bis zum 11.11.2026 konnte der Einlass das Häkchen nur
 * setzen, und wer es zurücknehmen wollte, musste unter «Vollmachten»
 * (Featureprüfung 2, G4).
 *
 * Ein vorbelegtes und unberührtes Kästchen heisst «keine Änderung», nicht
 * «die Verwaltung» (Codeprüfung E3, M1): Die Seite lädt nicht nach, solange
 * das Formular offen ist, und hat die Leitung die Kennzeichnung inzwischen
 * unter Vollmachten entfernt, setzte ein «ja» sie am ganzen Namen wieder. Eine
 * neue Zeile übernimmt deshalb den Stand des Namens aus der Datenbank
 * (`lasseDurchDritteEin`).
 *
 * Gelesen mit dem Vergleich auf «ja» und nicht mit `jaNein()`, das nur `true`
 * und `on` kennt (Häkchenwächter).
 */
export function verwaltungshakenAmEinlass(gesetzt: unknown, vorher: unknown): boolean | undefined {
	const vorbelegt = vorher === 'ja';
	if (gesetzt === 'ja') return vorbelegt ? undefined : true;
	return vorbelegt ? false : undefined;
}

/**
 * Die Kennung eines Vertreters, der keine Partei ist, etwa einer Verwaltung
 * ohne Eigentum (Migration 167, Ä-26).
 *
 * **Wozu eine Kennung.** Die Zählung führt Vertretungen und Ausstand über
 * Kennungen (`Vertretung.bevollmaechtigtId`, `imAusstand`); ohne eine Kennung
 * liess sich ein solcher Vertreter dort weder führen noch ausschliessen. Sie
 * stammt aus dem Namen der Vollmacht, unter demselben Schlüssel, unter dem
 * Votum Vollmachten je Bevollmächtigtem zusammenzählt. Der Vorsatz trennt
 * sie von jeder Partei: Eine Parteikennung ist eine UUID und beginnt nie so.
 */
export const VERTRETERKENNUNG_VORSATZ = 'vertreter:';

export function vertreterkennung(name: string): string {
	return VERTRETERKENNUNG_VORSATZ + vollmachtsschluessel(name);
}

export function istVertreterkennung(kennung: string): boolean {
	return kennung.startsWith(VERTRETERKENNUNG_VORSATZ);
}

/**
 * Die Absage, wenn eine Vollmacht die Höchstzahl überschritte
 * (`verlangeVollmachtsgrenze` in `server/vollmacht.ts`). Im Kern, damit beide
 * Fassungen und der Zusatz zu L15 ohne Datenbank prüfbar sind.
 *
 * **Der Grund steht dabei, wo L15 ihn liefert** (Migration 194, Akzeptanz-
 * kriterium 4 des Auftrags): Zählt unter «mitzaehlen» eine Stimmführung als
 * Mitberechtigte mit, sagt der Satz das, sonst sucht die Leitung eine
 * Vollmacht, die sie nicht findet. Der Ausweg über den Grund nennt dann nur
 * noch Organ und gesetzliche Vertretung.
 */
export function vollmachtsgrenzeSatz(l: {
	herkunft: 'zugang' | 'leitung';
	waere: number;
	name: string;
	hoechstzahl: number;
	fundstelle: string | null;
	/** Ob unter den gezählten, die neue eingeschlossen, eine Stimmführung als Mitberechtigte ist (L15). */
	stimmfuehrungGezaehlt: boolean;
	/**
	 * Die Wahl zu L15. Unter «mitzaehlen» nennt der Ausweg nur Organ und
	 * gesetzliche Vertretung, auch ohne gezählte Stimmführung (Codeprüfung
	 * Durchgang 2, N1): Der Grund «mitberechtigt» hülfe dort nicht.
	 */
	stimmfuehrung?: Stimmfuehrungswahl;
}): string {
	const quelle = l.fundstelle ? ` (${l.fundstelle})` : '';
	if (l.herkunft === 'zugang') {
		return (
			`Diese Person hat die Zahl von Vollmachten erreicht, die Ihr Reglement zulässt${quelle}. ` +
			(l.stimmfuehrungGezaehlt
				? // Laienprüfung L-5: in Worten des Eigentümers.
					'Dazu zählt nach der Einstellung Ihrer Gemeinschaft auch ihre Stimme für eine Einheit, die ihr mit ' +
					'anderen zusammen gehört. '
				: '') +
			'Lassen Sie sich von jemand anderem vertreten.'
		);
	}
	return (
		`Diese Vollmacht wäre die ${l.waere}. für ${l.name}; das Reglement lässt ${l.hoechstzahl} zu${quelle}. ` +
		(l.stimmfuehrungGezaehlt
			? 'Nach der Einstellung Ihrer Gemeinschaft zählt dabei die Stimme mit, die die Person als ' +
				'Mitberechtigte für eine eigene gemeinsame Einheit führt. '
			: '') +
		'Lassen Sie die weiteren Einheiten von einer anderen Person vertreten. Wird die Grenze überschritten, ' +
		'zählt die Stimme trotzdem mit, und der Beschluss wäre angreifbar. ' +
		// **Der zweite Ausweg gehört genannt** (Code-Review vom 24.09.2026, B2).
		// Seit Ä-28 steht er auf demselben Formular zwei Zeilen über der Meldung.
		(l.stimmfuehrungGezaehlt || l.stimmfuehrung === 'mitzaehlen'
			? `Handelt die Person als Organ oder von Gesetzes wegen? Dann wählen Sie den Grund bei «${GRUNDFRAGE}». ` +
				// Laienprüfung L-6: das Feld nennt auch die Mitberechtigte.
				'Diese Vertretungen zählen nicht mit; die Stimme als Mitberechtigte zählt nach der Einstellung Ihrer ' +
				'Gemeinschaft mit.'
			: `Handelt die Person nicht kraft Vollmacht? Dann wählen Sie den Grund bei «${GRUNDFRAGE}». ` +
				'Solche Vertretungen zählen nicht mit.')
	);
}

export interface Ueberschreitung {
	bevollmaechtigt: string;
	anzahl: number;
	hoechstzahl: number;
	fundstelle: string | null;
	satz: string;
}

/**
 * Wer die Schranke des Reglements überschreitet.
 *
 * **Seit dem 24.09.2026 ist das ein Nachlauf, kein Wächter.** Das Erfassen
 * sperrt (`verlangeVollmachtsgrenze` in `server/vollmacht.ts`, Produktentscheid
 * vom 24.09.2026), eine neue Überschreitung entsteht also gar nicht mehr. Diese
 * Liste fängt, was die Sperre nicht erreicht:
 *
 *   - Vollmachten, die erfasst wurden, **bevor** eine Grenze hinterlegt war.
 *   - Vollmachten, die eine **nachträglich gesenkte** Grenze überschreiten.
 *
 * **Hier stand bis dahin «Es warnt, es sperrt nicht»**, mit der Begründung, über
 * die Zulassung entscheide die Versammlung. Das trägt nicht: Die überzählige
 * Vollmacht bleibt nicht folgenlos stehen, sie zählt bei den Köpfen und den
 * Wertquoten mit und kann das Ergebnis drehen. Produktentscheid im Wortlaut:
 * «Wenn nämlich ein Beschluss zustande kommt, weil das Reglement nicht
 * eingehalten wird, könnte der Beschluss seine Gültigkeit verlieren (nichtig
 * oder ungültig) und das Protokoll wird anfechtbar.»
 *
 * Ohne hinterlegte Schranke wird nichts geprüft: Das Gesetz kennt keine.
 *
 * Gezählt werden nur wirksame und noch offene Vollmachten; zurückgewiesene und
 * beendete zählen nicht mit, sonst wüchse die Zahl mit jeder Berichtigung.
 * **Dieselbe Zählweise gilt in der Sperre**, über den angezeigten Namen und
 * nicht über die Kennung — zwei Zählweisen ergäben zwei Zahlen für dieselbe
 * Lage.
 */
export function ueberschreitungen(
	vollmachten: Pick<Vollmacht, 'zustand' | 'bevollmaechtigtId' | 'bevollmaechtigtName' | 'vertretungsgrund'>[],
	schranke: Vollmachtsschranke,
	namen: Map<Id, string> = new Map()
): Ueberschreitung[] {
	if (!schranke.hoechstzahl) return [];

	// Gezählt wird über den normalisierten Schlüssel, angezeigt wird der Name in
	// der Schreibweise, in der er zuerst vorkam: Der Schlüssel ist
	// kleingeschrieben und taugt nicht für einen Satz, den jemand liest.
	const jeBevollmaechtigt = new Map<string, { anzahl: number; anzeige: string }>();
	for (const v of vollmachten) {
		if (v.zustand !== 'erfasst' && v.zustand !== 'bestaetigt') continue;
		// **Ä-28**: Organvertreter, gesetzliche Vertreter und, nach L15,
		// Mitberechtigte zählen nicht zur Höchstzahl. Die Warnung muss hier
		// dasselbe tun wie die Sperre, sonst meldet sie eine Überschreitung, die
		// keine ist.
		if (!zaehltZurHoechstzahl(v, schranke.stimmfuehrung)) continue;
		const anzeige = v.bevollmaechtigtId ? (namen.get(v.bevollmaechtigtId) ?? v.bevollmaechtigtId) : (v.bevollmaechtigtName ?? '');
		if (!anzeige) continue;
		const schluessel = vollmachtsschluessel(anzeige);
		if (!schluessel) continue;
		const bisher = jeBevollmaechtigt.get(schluessel);
		jeBevollmaechtigt.set(schluessel, {
			anzahl: (bisher?.anzahl ?? 0) + 1,
			anzeige: bisher?.anzeige ?? anzeige
		});
	}

	const aus: Ueberschreitung[] = [];
	for (const [, { anzahl, anzeige: bevollmaechtigt }] of jeBevollmaechtigt) {
		if (anzahl <= schranke.hoechstzahl) continue;
		aus.push({
			bevollmaechtigt,
			anzahl,
			hoechstzahl: schranke.hoechstzahl,
			fundstelle: schranke.fundstelle,
			// **Nicht mehr «Über die Zulassung entscheidet die Versammlung».** Seit
			// die Erfassung sperrt, wäre das eine Einladung zu etwas, das die
			// Anwendung gar nicht mehr zulässt. Der Satz nennt jetzt die Folge und
			// den Weg zurück.
			satz:
				`${bevollmaechtigt} hält ${anzahl} Vollmachten; das Reglement lässt ${schranke.hoechstzahl} zu` +
				(schranke.fundstelle ? ` (${schranke.fundstelle})` : '') +
				'. Neu erfassen lässt sich das nicht mehr; diese Vollmachten stammen also aus ' +
				'der Zeit vor der Grenze oder vor einer Senkung. Die überzähligen zählen mit ' +
				'und machen den Beschluss angreifbar: Weisen Sie sie zurück oder lassen Sie ' +
				'die Einheiten von einer anderen Person vertreten.'
		});
	}
	return aus.sort(
		(a, b) => b.anzahl - a.anzahl || a.bevollmaechtigt.localeCompare(b.bevollmaechtigt, 'de-CH')
	);
}

// ── Übersicht ───────────────────────────────────────────────────────────────

export interface Vollmachtsuebersicht {
	alle: Vollmacht[];
	/** Wirksame Vollmachten je vertretener Partei — die Frage der Anwesenheit. */
	wirksamJeVertretene: Map<Id, Vollmacht>;
	/** Wirksame Vollmachten je bevollmächtigter Person, sofern sie selbst Partei ist. */
	wirksamJeBevollmaechtigt: Map<Id, Vollmacht[]>;
	anzahlOffen: number;
	anzahlWirksam: number;
}

export function uebersicht(vollmachten: Vollmacht[]): Vollmachtsuebersicht {
	const wirksamJeVertretene = new Map<Id, Vollmacht>();
	const wirksamJeBevollmaechtigt = new Map<Id, Vollmacht[]>();

	for (const v of vollmachten) {
		if (!istWirksam(v)) continue;
		wirksamJeVertretene.set(v.vertreteneId, v);
		if (v.bevollmaechtigtId) {
			const bisher = wirksamJeBevollmaechtigt.get(v.bevollmaechtigtId) ?? [];
			bisher.push(v);
			wirksamJeBevollmaechtigt.set(v.bevollmaechtigtId, bisher);
		}
	}

	return {
		alle: vollmachten,
		wirksamJeVertretene,
		wirksamJeBevollmaechtigt,
		anzahlOffen: vollmachten.filter(istOffen).length,
		anzahlWirksam: wirksamJeVertretene.size
	};
}

/** Eine Vertretung, die nur für einen Teil der Abstimmungen galt. */
export interface Vertretungszeitraum {
	durch: string;
	/** Bestätigt nach einer geschlossenen Abstimmung; sonst `null`. */
	ab: Zeitpunkt | null;
	/** Beendet; `null` bei einer Vollmacht, die bis zum Schluss galt. */
	bis: Zeitpunkt | null;
	/**
	 * Die Traktanden, bei deren Abstimmung sie galt und die Partei anwesend
	 * war, in der Reihenfolge der Abstimmungen, ohne Doppel. Erst sie machen
	 * die Angabe nachprüfbar: Die Traktanden tragen im Protokoll keine
	 * Uhrzeit (Laien- und Fachprüfung 16.10.2026; Rz. 23 ad Art. 712p,
	 * Rz. 129 ad Art. 712n).
	 */
	traktanden: string[];
	/**
	 * Warum sie endete: Die vertretene Person erschien selbst
	 * (`SELBST_ERSCHIENEN`), oder die Vollmacht wurde sonst beendet. Wer nur
	 * das Protokoll hat, sieht den Verlauf nicht und kann aus dem Ende allein
	 * nicht schliessen, ob die Partei danach selbst abstimmte (Laienprüfung
	 * 16.10.2026, Runde 2). `null` bei einer laufenden Vollmacht.
	 */
	ende: 'selbst_erschienen' | 'beendet' | null;
}

/**
 * Die Vollmachten, die nicht für alle Abstimmungen des Abends galten, je
 * vertretener Partei (Ä-09, Block 2 der Freigabeliste).
 *
 * **Der Anlass.** Die Anwesenheitsliste des Protokolls nennt die Vertretung,
 * wie sie am Schluss steht. Erscheint die vertretene Person nach dem dritten
 * Traktandum selbst, endet die Vollmacht (`SELBST_ERSCHIENEN`), und die Liste
 * nannte sie als anwesend, ohne Vertreter. Dass für die ersten drei Beschlüsse
 * jemand anders gestimmt hatte, stand nirgends. Umgekehrt ebenso: Wer geht und
 * jemanden bevollmächtigt, stand als «vertreten durch» da, als hätte die
 * Vertretung von Beginn an gegolten.
 *
 * **Wo es steht, ist entschieden** (Produktentscheid 16.10.2026): in der
 * Anwesenheitsliste mit Uhrzeit, nicht als Satz unter jedem Beschluss.
 *
 * **Nur, was eine Abstimmung berührt.** Eine beendete Vollmacht steht nur
 * da, wenn bei mindestens einer Abstimmung in ihrer Geltung die vertretene
 * Partei im festgeschriebenen Stand des Durchgangs anwesend war. Allein über
 * die Uhrzeit stünde «vertreten durch Bucher bis 20:40 Uhr» auch dort, wo
 * Bucher nie im Saal war (gefunden beim Bau am 16.10.2026). Anwesend über
 * eine wirksame Vollmacht heisst vertreten: Wer selbst erscheint, beendet sie.
 * Massgebend ist das Schliessen, weil der Durchgang den Stand dort festschreibt
 * (`attendance_json`). Die Zeitstempel kommen von der Vollmacht, nicht aus den
 * festgeschriebenen Vertretungen: Die kennen nur Bevollmächtigte, die selbst
 * Partei sind.
 *
 * Ein Durchgang ohne festgeschriebenen Stand (`anwesende: null`) zählt allein
 * nach der Uhrzeit; einen besseren Beleg gibt es dort nicht.
 *
 * **Nur Durchgänge, die einen Beschluss trugen**, wählt der Aufrufer aus
 * (Codeprüfung 16.10.2026, M1): Ein abgebrochener oder als Korrektur
 * überholter Durchgang ist keine Abstimmung, unter der jemand vertreten war.
 *
 * Eine zurückgewiesene Vollmacht galt nie und fehlt deshalb hier.
 */
export function vertretungszeitraeume(
	vollmachten: readonly Pick<
		Vollmacht,
		| 'vertreteneId'
		| 'bevollmaechtigtName'
		| 'zustand'
		| 'bestaetigtAm'
		| 'beendetAm'
		| 'beendetGrund'
		| 'vertretungsgrund'
		| 'mitberechtigung'
	>[],
	abstimmungen: readonly {
		geschlossenAm: Zeitpunkt;
		anwesende: readonly Id[] | null;
		/** Die Nummer des Traktandums, wie das Protokoll sie führt. */
		traktandum: string;
	}[]
): Map<Id, Vertretungszeitraum[]> {
	const geschlossen = abstimmungen
		.map((a) => ({ zeit: Date.parse(a.geschlossenAm), anwesende: a.anwesende, nummer: a.traktandum }))
		.filter((a) => !Number.isNaN(a.zeit))
		.sort((a, b) => a.zeit - b.zeit);
	const ergebnis = new Map<Id, Vertretungszeitraum[]>();
	for (const v of vollmachten) {
		if (!v.bestaetigtAm) continue;
		const von = Date.parse(v.bestaetigtAm);
		let bis: number | null = null;
		if (v.zustand === 'widerrufen' && v.beendetAm) bis = Date.parse(v.beendetAm);
		else if (v.zustand !== 'bestaetigt') continue;

		const galtBei = geschlossen.filter(
			(a) =>
				a.zeit >= von &&
				(bis === null || a.zeit < bis) &&
				(a.anwesende === null || a.anwesende.includes(v.vertreteneId))
		);
		const spaeterBestaetigt = geschlossen.some((a) => a.zeit < von);
		// Bis zum Schluss gültig und von Anfang an: der Normalfall, kein Eintrag.
		if (bis === null && !spaeterBestaetigt) continue;
		// Beendet, ohne dass dazwischen abgestimmt wurde: hat nichts vertreten.
		if (bis !== null && galtBei.length === 0) continue;

		const liste = ergebnis.get(v.vertreteneId) ?? [];
		/*
		 * Mit dem Grund nach Ä-28 wie bei `vertretenDurch` im Protokoll, damit
		 * eine beendete Organvertretung nicht ohne ihn dasteht (Codeprüfung
		 * 16.10.2026, N1) und die laufende sich am Namen wiederfindet.
		 */
		const name = v.bevollmaechtigtName ?? '';
		const grund = vertretungsgrundInWorten(v);
		liste.push({
			durch: grund ? `${name} (${grund})` : name,
			ab: spaeterBestaetigt ? v.bestaetigtAm : null,
			bis: bis === null ? null : v.beendetAm,
			traktanden: [...new Set(galtBei.map((a) => a.nummer))],
			ende: bis === null ? null : v.beendetGrund === SELBST_ERSCHIENEN ? 'selbst_erschienen' : 'beendet'
		});
		ergebnis.set(v.vertreteneId, liste);
	}
	return ergebnis;
}
