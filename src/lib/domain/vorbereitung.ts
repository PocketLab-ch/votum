/**
 * Der geführte Vorbereitungsablauf (Story 6.2, FR-65).
 *
 * **Sichtbar gesperrt statt versteckt.** Ein Schritt, der erst später möglich
 * ist, verschwindet nicht — er steht da und sagt, was ihn freischaltet. Wer nur
 * sieht, was gerade geht, weiss nicht, wie viel noch kommt, und kann den Abend
 * nicht planen. Wer eine graue Zeile mit «erst nach der Freigabe möglich» sieht,
 * weiss beides.
 *
 * **Gesperrt wird nur, was sachlich nicht geht.** Die Reihenfolge der Liste ist
 * die übliche, keine Vorschrift: Traktanden lassen sich erfassen, bevor der
 * letzte Eigentümer eingetragen ist, und das Mehrheitserfordernis lässt sich
 * setzen, sobald das Traktandum steht. Eine erzwungene Reihenfolge wäre bequem
 * zu bauen und im Betrieb eine Zumutung — die Vorbereitung läuft über Wochen und
 * springt zwischen den Stellen, an denen gerade Angaben eintreffen.
 *
 * Rein: hinein geht die Lage, heraus kommt die Schrittfolge. Kein Zugriff auf
 * Datenbank oder Uhr (AD-1).
 */
import { fristlage } from './einberufungsfrist';
import type { Versammlungszustand } from './versammlung';
import type { Id } from './types';

export type Schrittzustand = 'erledigt' | 'offen' | 'gesperrt';

export interface Schritt {
	kennung: string;
	titel: string;
	/** Was in diesem Schritt zu tun ist — ein Satz, keine Anleitung. */
	beschreibung: string;
	zustand: Schrittzustand;
	/**
	 * Warum der Schritt noch nicht möglich ist. Nur bei `gesperrt` gesetzt, und
	 * dann immer: Eine Sperre ohne Grund ist eine Sackgasse.
	 */
	sperrgrund?: string;
	/** Der Weg dorthin, angehängt an die Versammlung oder die Gemeinschaft. */
	pfad: string;
	/** Was noch fehlt, wenn der Schritt offen ist — bei Bedarf mit Zahl. */
	stand?: string;
	/**
	 * Eine Lücke, die auch dann sichtbar bleibt, wenn der Schritt nicht dran ist.
	 *
	 * Der `stand` steht in der Leiste nur bei der Zeile, auf der man gerade steht
	 * oder als Nächstes hinsoll — sonst stünden unter vierzehn Punkten vierzehn
	 * Sätze. Eine Warnung steht immer, samt Zeichen: Sie ist der Grund, warum
	 * jemand hinsehen soll (Auftraggeber, 12.08.2026: «damit der Nutzer es sofort sieht»).
	 *
	 * Deshalb sparsam setzen. Ein Schritt, an dem noch gar nicht gearbeitet wurde,
	 * ist keine Lücke, sondern der Anfang.
	 */
	warnung?: string;
	/**
	 * Die Fassung der Warnung für die Seitenleiste, wo die volle dort zu lang
	 * wäre (Produktentscheid 06.10.2026, «Kurz in der Leiste, ganz auf der
	 * Seite»). Nur zusammen mit `warnung` gesetzt; die Leiste nimmt sie vor
	 * `warnung` (`alsPunkt`), die Seite Vorbereitung zeigt immer `warnung`.
	 */
	warnungKurz?: string;
}

export interface Vorbereitungslage {
	meetingId: string;
	stwegId: string;
	versammlungszustand: Versammlungszustand;
	/**
	 * Der Versammlungstag — der Stichtag, auf den hier gerechnet wird
	 * (22.08.2026, Befund B-01).
	 *
	 * Bis dahin fehlte er, und das war der ganze Fehler: Die Zuordnungen werden
	 * auf den Versammlungstag geprüft, die verlinkte Eigentümerseite rechnet auf
	 * **heute**. Im Prüflauf meldete diese Zeile «5 Einheiten ohne Eigentümer»,
	 * und die Zielseite zeigte «5 von 5 · alles zugeordnet». Zwei Wahrheiten über
	 * dieselben Daten, ohne dass eine von beiden ihren Stichtag genannt hätte.
	 */
	datum: string;
	/** Wertquoten der Gemeinschaft gehen auf. */
	quotenGehenAuf: boolean;
	anzahlEinheiten: number;
	anzahlEigentuemer: number;
	einheitenOhneEigentuemer: number;
	/**
	 * Wie viele der Einheiten ohne Eigentümer erst **nach** dem Versammlungstag
	 * eine Zuordnung bekommen.
	 *
	 * Die Zahl trennt zwei Lagen, die gleich aussehen und Verschiedenes
	 * verlangen: Entweder ist eine Einheit wirklich nicht erfasst — dann fehlt
	 * Arbeit —, oder sie ist erfasst und die Zuordnung beginnt zu spät, dann
	 * gehört das Datum berichtigt. Ohne diese Unterscheidung macht der zweite
	 * Fall die Arbeit ein zweites Mal (Bedienbarkeitsprüfung 05.09.2026).
	 */
	einheitenErstSpaeter: number;
	/**
	 * Wann das Reglement zuletzt nachgesehen wurde (Kalendertag) — null, wenn nie.
	 *
	 * Der Vermerk und nicht die Zahl der Regeln: «keine Abweichung» und «noch
	 * nie nachgesehen» sind im Bestand beide null Regeln.
	 */
	reglementGeprueftAm: string | null;
	/** Hinterlegte Abweichungen vom gesetzlichen Mehrheitserfordernis. */
	anzahlReglementsregeln: number;
	/** Eigene Schwellen für die Beschlussfähigkeit, je Versammlungsstufe. */
	anzahlAnwesenheitsregeln: number;
	anzahlTraktanden: number;
	/** Wie viele davon nur aus der Vorlage stammen und nie angefasst wurden. */
	traktandenAusVorlage: number;
	/** Ob die Liste ausdrücklich als vollständig bestätigt wurde (Migration 033). */
	traktandenlisteBestaetigt: boolean;
	/** Traktanden der Art «abstimmung» ohne gesetztes Erfordernis. */
	traktandenOhneErfordernis: number;
	/** Ob die Traktandenliste als PDF schon erzeugt wurde. */
	einladungErzeugt: boolean;
	/**
	 * Ob jemand von Hand gesagt hat, die Einladung sei hinausgegangen
	 * (Migration 102).
	 *
	 * **Die Anwendung sieht nur, was durch sie hindurchgeht.** Wer die Einladung
	 * im eigenen Mailprogramm schreibt, erzeugt hier kein PDF — und bekam die
	 * Fristwarnung bis zum 02.09.2026 trotzdem, bis die Versammlung vorbei war.
	 * Der Vermerk ist die Antwort darauf: eine Aussage eines Menschen, kein
	 * Nachweis der Anwendung.
	 */
	versandVermerkt: boolean;
	/**
	 * Die Einberufungsfrist der Gemeinschaft in Tagen — `null` heisst: nicht
	 * hinterlegt (Migration 098).
	 */
	einberufungsfristTage: number | null;
	/**
	 * Der heutige Kalendertag, in hiesiger Zeit.
	 *
	 * **Übergeben und nicht geholt** (AD-1): Der Kern fasst keine Uhr an. Nur so
	 * lässt sich «morgen läuft die Frist ab» prüfen, ohne die Systemzeit zu
	 * stellen.
	 */
	heute: string;
	/**
	 * Ob unter «Betreiber» ein Briefkopf hinterlegt ist (Prüflauf I, B-14).
	 *
	 * Der Schritt versprach ihn unbesehen. Wer keinen hinterlegt hat, erfuhr es
	 * am ausgedruckten Brief — dann sind die Einladungen schon im Umschlag.
	 */
	briefkopfHinterlegt: boolean;
	/**
	 * **Welche** Unterlagen der Ausfallsicherung geholt wurden, nicht wie viele.
	 *
	 * Beobachtet wird der Abruf, nicht der Drucker: Ob jemand die Blätter
	 * wirklich mitnimmt, kann die Anwendung nicht wissen — deshalb heisst der
	 * Schritt «geholt» und nicht «bereit».
	 *
	 * **Namen statt Anzahl** (02.09.2026, aus dem Code-Review). Vorher standen
	 * hier zwei Zahlen, und zwei Zahlen können übereinstimmen, ohne dass dieselbe
	 * Sache gemeint ist: Wer Traktanden, Stimmzettel und Auszählmappe geholt hat,
	 * steht auf «3 von 4». Wird während der Versammlung das einzige
	 * quotenrelevante Traktandum zurückgezogen, entfällt die Mappe — nötig sind
	 * dann 3, geholt sind 3, der Schritt meldet «erledigt». Geholt wurde die
	 * Unterschriftenliste trotzdem nie.
	 *
	 * Das ist dieselbe Fehlerklasse, die dieser Block schliessen soll: eine Zahl,
	 * die für eine Menge einsteht.
	 */
	ausfallunterlagenGeholt: string[];
	/**
	 * Welche Unterlagen es bei DIESER Versammlung gibt (Prüflauf II, C-02).
	 *
	 * Die Auszählmappe entsteht nur, wo es etwas zu rechnen gibt: bei
	 * Wertquotenschranken, bei Bezugsgrössen mit Abwesenden oder bei ungleichen
	 * Kopfstimmen. Sonst genügt Handzählen. Vorher stand hier fest die Drei, und
	 * eine Versammlung ohne Rechenbedarf blieb für immer auf «2 von 3 Unterlagen
	 * geholt» — ein Schritt, der sich nicht abschliessen liess.
	 */
	ausfallunterlagenNoetig: string[];
	anzahlZugaenge: number;
	anzahlStimmberechtigte: number;
	/** Ob das Abschlusspaket besteht (FR-51). */
	versiegelt: boolean;
	/** Traktanden mit einer Protokollnotiz (FR-46). */
	protokollnotizen: number;
	/** Ob die Arbeitsfassung des Protokolls besteht (FR-48). */
	protokollEntwurf: boolean;
	/** Wie viele Fassungen festgehalten sind (FR-50). */
	protokollfassungen: number;
	/**
	 * Der gemeinsame Abend, zu dem diese Versammlung gehört — null, wenn sie für
	 * sich tagt.
	 *
	 * **Eine Sitzung, ein Protokoll** (Auftraggeber, 12.08.2026: «Es gibt dann ein
	 * Protokoll für die Versammlung. Nicht pro Haus.»). Gehört die Versammlung zu
	 * einem Abend, führt der Schritt dorthin; was hier bleibt, sind die Notizen.
	 */
	gemeinsamerTagId?: Id | null;
	/** Vollmachten, die erfasst und noch nicht geprüft sind (FR-24). */
	vollmachtenOffen: number;
	/** Bestätigte und damit wirksame Vollmachten. */
	vollmachtenWirksam: number;
	/** Ob mindestens eine Abstimmung geschlossen und nicht überholt ist. */
	beschluesseGefasst: boolean;
}

const NACH_FREIGABE = 'Erst nach der Freigabe der Versammlung möglich.';

/** «1 Traktandum» / «9 Traktanden» — die Einzahl fällt sonst überall auf. */
function traktandenzahl(n: number): string {
	return n === 1 ? '1 Traktandum' : `${n} Traktanden`;
}

function traktandenstand(
	lage: Vorbereitungslage,
	nurVorlage: boolean,
	abFreigabe: boolean
): string {
	if (lage.anzahlTraktanden === 0) return 'noch kein Traktandum';
	if (lage.traktandenlisteBestaetigt) return `${traktandenzahl(lage.anzahlTraktanden)}, bestätigt`;
	// Ab der Freigabe ist die Liste gesperrt; ein Hinweis auf eine fehlende
	// Bestätigung wäre eine Aufforderung zu etwas, das nicht mehr geht.
	if (abFreigabe) return traktandenzahl(lage.anzahlTraktanden);
	if (nurVorlage) {
		return `${traktandenzahl(lage.anzahlTraktanden)} aus der Vorlage — durchgehen und ergänzen`;
	}
	return `${traktandenzahl(lage.anzahlTraktanden)} — noch nicht als vollständig bestätigt`;
}

/**
 * Warum am Versammlungstag ein Eigentümer fehlt — soweit es die Anwendung weiss.
 *
 * **Der teuerste Befund der Bewirtschaftersicht** (Bedienbarkeitsprüfung
 * 05.09.2026). Alle fünf Eigentümer waren richtig erfasst; die Zuordnung begann
 * am Tag der Erfassung, und die Versammlung lag davor. Die Meldung nannte nur
 * die Zahl. Der Prüfer schloss daraus, seine Arbeit sei verloren, tilgte fünf
 * Zuordnungen und legte sie neu an: sechs Minuten, fünfzehn Klicks, null
 * inhaltliche Arbeit.
 *
 * Der Satz trennt jetzt, was gleich aussah: Fehlt die Erfassung, fehlt Arbeit.
 * Beginnt sie zu spät, gehört ein Datum berichtigt. Ohne Angabe bleibt es beim
 * blossen Befund — die Anwendung behauptet dann nichts, was sie nicht weiss.
 */
function ursache(lage: Vorbereitungslage): string {
	if (lage.einheitenErstSpaeter === 0) return '';
	if (lage.einheitenErstSpaeter < lage.einheitenOhneEigentuemer) {
		return `, bei ${lage.einheitenErstSpaeter} beginnt die Zuordnung erst danach`;
	}
	return lage.einheitenErstSpaeter === 1
		? ': die Zuordnung beginnt erst danach'
		: ': die Zuordnungen beginnen erst danach';
}

/**
 * Die Schrittfolge zur Lage.
 *
 * Die Reihenfolge im Rückgabewert ist die Anzeigereihenfolge und entspricht dem
 * üblichen Ablauf. Sie ist keine Abhängigkeitskette — welche Schritte einander
 * bedingen, steht allein in den Sperren.
 */
export function vorbereitungsschritte(lage: Vorbereitungslage): Schritt[] {
	const geschlossen = lage.versammlungszustand === 'geschlossen' || lage.versammlungszustand === 'versiegelt';
	const abFreigabe =
		lage.versammlungszustand !== 'entwurf';

	const schritte: Schritt[] = [];

	// ── Stammdaten ─────────────────────────────────────────────────────────
	schritte.push({
		kennung: 'einheiten',
		titel: 'Einheiten und Wertquoten',
		beschreibung: 'Jede Einheit mit ihrer Stammquote erfassen, bis der Saldo aufgeht.',
		zustand: lage.anzahlEinheiten > 0 && lage.quotenGehenAuf ? 'erledigt' : 'offen',
		pfad: `/gemeinschaften/${lage.stwegId}/einheiten`,
		stand:
			lage.anzahlEinheiten === 0
				? 'noch keine Einheit erfasst'
				: lage.quotenGehenAuf
					? `${lage.anzahlEinheiten} Einheiten, Saldo geht auf`
					: `${lage.anzahlEinheiten} Einheiten, Wertquotensaldo geht nicht auf`
	});

	schritte.push({
		kennung: 'eigentuemer',
		titel: 'Eigentümer und Zuordnung',
		beschreibung: 'Wer welche Einheit besitzt — die Grundlage jeder Stimmkraft.',
		zustand:
			lage.anzahlEigentuemer > 0 && lage.einheitenOhneEigentuemer === 0 ? 'erledigt' : 'offen',
		/*
		 * **Der Stichtag reist mit** (22.08.2026, Befund B-01). Ohne ihn führte
		 * dieser Weg auf eine Seite, die einen anderen Tag zeigt — und damit auf
		 * eine Lage, in der das gemeldete Problem gar nicht besteht. Der Prüfer
		 * hielt die Warnung daraufhin für einen Fehler der Anwendung und zog fünf
		 * Zuordnungen von Hand nach, die es längst gab.
		 */
		pfad: `/gemeinschaften/${lage.stwegId}/eigentuemer?stichtag=${lage.datum}`,
		stand:
			lage.anzahlEigentuemer === 0
				? 'noch kein Eigentümer erfasst'
				: lage.einheitenOhneEigentuemer > 0
					? // Die Zahl ohne ihren Stichtag ist mehrdeutig: Eine Zuordnung, die
						// morgen beginnt, fehlt heute — und umgekehrt.
						`${lage.einheitenOhneEigentuemer} ${lage.einheitenOhneEigentuemer === 1 ? 'Einheit' : 'Einheiten'} ohne Eigentümer am Versammlungstag${ursache(lage)}`
					: `${lage.anzahlEigentuemer} Eigentümer, alle Einheiten zugeordnet`
	});

	/*
	 * ── Regelwerk ──────────────────────────────────────────────────────────
	 *
	 * **Nur sichtbar, nie sperrend** (Produktentscheid 10.08.2026). Beide
	 * Schritte führen auf Seiten der Gemeinschaft und halten nichts auf: Die
	 * Freigabe prüft weiterhin, was sie immer geprüft hat — mindestens ein
	 * Traktandum und einen aufgehenden Wertquotensaldo. Hier geht es darum,
	 * dass niemand die Frage übersieht.
	 *
	 * **Der Prüfvermerk entscheidet, nicht die Zahl der Regeln.** «Keine
	 * Abweichung» und «noch nie nachgesehen» sehen im Bestand gleich aus —
	 * beides null Regeln. Genau dafür trägt die Gemeinschaft einen Vermerk mit
	 * Datum und Person. Ein Schritt, der erst mit einer hinterlegten Abweichung
	 * abhakt, bliebe bei jeder Gemeinschaft offen, deren Reglement dem Gesetz
	 * folgt — und stünde damit dauerhaft als Aufgabe da, an der nichts zu tun
	 * ist.
	 */
	schritte.push({
		kennung: 'reglement',
		titel: 'Reglement und Quoren',
		beschreibung: 'Nachsehen, ob das Reglement vom Gesetz abweicht, und die Fundstelle festhalten.',
		zustand: lage.reglementGeprueftAm ? 'erledigt' : 'offen',
		pfad: `/gemeinschaften/${lage.stwegId}/reglement`,
		stand: lage.reglementGeprueftAm
			? lage.anzahlReglementsregeln === 0
				? `nachgesehen am ${lage.reglementGeprueftAm}, keine Abweichung`
				: `nachgesehen am ${lage.reglementGeprueftAm}, ${lage.anzahlReglementsregeln} ${
						lage.anzahlReglementsregeln === 1 ? 'Abweichung' : 'Abweichungen'
					}`
			: 'noch nie nachgesehen'
	});

	schritte.push({
		kennung: 'beschlussfaehigkeit',
		titel: 'Beschlussfähigkeit',
		beschreibung: 'Welche Schwelle gilt — die des Gesetzes oder eine strengere aus dem Reglement.',
		// Erledigt auch ohne eigene Regel: Wer das Reglement nachgesehen hat,
		// weiss, dass keine besteht. Das Gesetz gilt dann bewusst, nicht mangels
		// Wissen.
		zustand:
			lage.anzahlAnwesenheitsregeln > 0 || lage.reglementGeprueftAm ? 'erledigt' : 'offen',
		pfad: `/gemeinschaften/${lage.stwegId}/beschlussfaehigkeit`,
		stand:
			lage.anzahlAnwesenheitsregeln > 0
				? `${lage.anzahlAnwesenheitsregeln} eigene ${
						lage.anzahlAnwesenheitsregeln === 1 ? 'Regel' : 'Regeln'
					} aus dem Reglement`
				: lage.reglementGeprueftAm
					? 'nach Gesetz (ZGB Art. 712p)'
					: 'noch nicht nachgesehen — es gilt das Gesetz'
	});

	// ── Traktanden ─────────────────────────────────────────────────────────
	//
	// **Erledigt heisst bestätigt, nicht vorhanden.** Das Anlegen einer
	// Versammlung setzt die Pflichttraktanden selbst; ein Häkchen dafür stünde
	// eine Sekunde nach dem Anlegen, ohne dass jemand die Liste gesehen hätte.
	// Was fehlt, weiss die Vorlage nicht: Sie kennt die Jahresgeschäfte, aber
	// kein einmaliges Bauvorhaben (Migration 033).
	const nurVorlage =
		lage.anzahlTraktanden > 0 && lage.traktandenAusVorlage === lage.anzahlTraktanden;
	// Die Freigabe ist die stärkere Feststellung: Ab da ist die Liste gesperrt,
	// und sie war durchgegangen — sonst hätte niemand freigegeben.
	const listeSteht = lage.traktandenlisteBestaetigt || abFreigabe;
	schritte.push({
		kennung: 'traktanden',
		titel: 'Traktandenliste',
		beschreibung: 'Die Geschäfte der Versammlung, in der Reihenfolge der Behandlung.',
		// Eine bestätigte leere Liste gibt es nicht — der Vermerk ohne Gegenstand
		// wäre ein Häkchen auf nichts.
		zustand: lage.anzahlTraktanden > 0 && listeSteht ? 'erledigt' : 'offen',
		pfad: `/versammlungen/${lage.meetingId}/traktanden`,
		stand: traktandenstand(lage, nurVorlage, abFreigabe)
	});

	// Bewusst nicht an die Traktandenliste gesperrt: Ohne Traktandum gibt es
	// nichts zu bestimmen, und die Liste sagt das mit ihrer eigenen Zahl. Eine
	// Sperre zeigte hier dieselbe Auskunft ein zweites Mal.
	//
	// **Aber auch nicht erledigt, solange die Liste offen ist.** Die Vorlage
	// bringt ihre Erfordernisse mit; sie sind Vorschläge aus der Geschäftsart und
	// keine Entscheide. Ein Häkchen darauf hiesse, jemand habe je Antrag geprüft,
	// welche Mehrheit nötig ist — und genau das ist die Arbeit, die dieser
	// Schritt meint.
	schritte.push({
		kennung: 'erfordernis',
		titel: 'Mehrheitserfordernisse',
		beschreibung: 'Je Antrag über den Entscheidbaum bestimmen, welche Mehrheit nötig ist.',
		zustand:
			lage.anzahlTraktanden > 0 && listeSteht && lage.traktandenOhneErfordernis === 0
				? 'erledigt'
				: 'offen',
		pfad: `/versammlungen/${lage.meetingId}/traktanden`,
		stand:
			lage.anzahlTraktanden === 0
				? 'wartet auf Traktanden'
				: lage.traktandenOhneErfordernis > 0
					? `${lage.traktandenOhneErfordernis} ohne Erfordernis — im Saal nachholbar`
					: listeSteht
						? 'alle Anträge haben ein Erfordernis'
						: 'wartet auf die bestätigte Traktandenliste'
	});

	// ── Freigabe ───────────────────────────────────────────────────────────
	schritte.push({
		kennung: 'freigabe',
		titel: 'Freigeben',
		beschreibung:
			'Wer stimmberechtigt ist, steht dann fest. Ab hier ändert eine Korrektur an den ' +
			'Stammdaten nichts mehr an dieser Versammlung.',
		zustand: abFreigabe ? 'erledigt' : 'offen',
		pfad: `/versammlungen/${lage.meetingId}/freigabe`
	});

	/*
	 * **Die Einladung ist ein eigenes Dokument** (23.08.2026, Prüflauf I, B-14).
	 *
	 * Bis dahin führte dieser Schritt auf `traktandenliste.pdf` — die Einladung
	 * war buchstäblich die Traktandenliste, ohne Absender, Anrede,
	 * Einberufungssatz und Vollmachtshinweis. Und erledigt wurde er nie: Der
	 * Zustand hing an einem Ereignis, das keine Stelle schrieb.
	 */
	/*
	 * **Der Termin gehört an den Schritt, nicht in eine Fussnote** (01.09.2026).
	 * Die Einberufungsfrist steht im Reglement, der letzte Versandtag ergibt sich
	 * daraus — und gerechnet hat ihn bis hierher jeder von Hand. Ohne hinterlegte
	 * Frist bleibt die Zeile leer statt eine Zahl zu erfinden.
	 */
	/**
	 * Ob an dieser Versammlung noch etwas zu retten ist. Ab dem Eröffnen ist die
	 * Einberufung Geschichte — richtig oder falsch, sie steht.
	 */
	const nochZuBeeinflussen =
		lage.versammlungszustand === 'entwurf' || lage.versammlungszustand === 'freigegeben';

	const frist = fristlage(lage.heute, {
		versammlungsdatum: lage.datum,
		tage: lage.einberufungsfristTage,
		/*
		 * **Ein Signal, dasselbe wie am Zustand des Schrittes** (01.09.2026, aus
		 * der eigenen Gegenlese). Der Mailversand der Anwendung schickt die
		 * Zugangskarten; die Einladung mit Traktandenliste geht daneben hinaus,
		 * und der Begleittext sagt das ausdrücklich. Sein Ereignis hier
		 * mitzuzählen hiesse, die Fristwarnung abzuschalten, obwohl die Einladung
		 * selbst noch nirgends steht. Und der Schritt daneben zeigte weiter
		 * «offen»: zwei Aussagen über dieselbe Zeile.
		 */
		/*
		 * **Der Vermerk zählt hier mit, der Schritt bleibt davon unberührt**
		 * (02.09.2026). Die Fristwarnung fragt, ob die Eigentümer rechtzeitig
		 * eingeladen sind — darauf antwortet der Vermerk. Der Schritt daneben
		 * fragt, ob in dieser Anwendung ein Brief entstanden ist, und darauf
		 * antwortet er nicht: Ein «erledigt» wäre eine Aussage über ein PDF, das
		 * es nicht gibt.
		 */
		versendet: lage.einladungErzeugt || lage.versandVermerkt
	});

	schritte.push({
		kennung: 'einladung',
		titel: 'Einladung erzeugen',
		beschreibung: lage.briefkopfHinterlegt
			? 'Anschreiben mit Einberufung, Vollmachtshinweis und Traktanden — als PDF, mit ' +
				'Briefkopf der Bewirtschaftung.'
			: 'Anschreiben mit Einberufung, Vollmachtshinweis und Traktanden — als PDF. Es ist ' +
				'kein Briefkopf hinterlegt: Der Brief geht ohne Logo und Absenderzeile hinaus ' +
				'(Betreiber → Briefkopf).',
		zustand: lage.einladungErzeugt ? 'erledigt' : abFreigabe ? 'offen' : 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/einladung.pdf`,
		// Der Stand nennt den Termin, solange er noch zu halten ist.
		stand:
			nochZuBeeinflussen && (frist.art === 'offen' || frist.art === 'knapp')
				? frist.satz
				: undefined,
		/*
		 * **Gewarnt wird bei zweierlei**: wenn die Frist abgelaufen ist (dann ist
		 * die Versammlung anfechtbar) und wenn gar keine hinterlegt ist (dann
		 * rechnet niemand mit, und die Erinnerung bleibt aus). Der knappe Fall
		 * steht im Stand — er ist eine Auskunft, keine Störung.
		 *
		 * **Nur, solange sich noch etwas ändern lässt** (01.09.2026, aus dem
		 * Code-Review). Nach dem Schluss bleibt die Seite als Zusammenfassung
		 * stehen; eine Handlungsaufforderung an einer abgehaltenen Versammlung
		 * wäre dauerhaft und ohne Ausweg. Der Zeitgeber zieht dieselbe Grenze
		 * (`state IN ('entwurf', 'freigegeben')` in Migration 099).
		 */
		warnung:
			nochZuBeeinflussen && (frist.art === 'verpasst' || (frist.art === 'ohne_frist' && abFreigabe))
				? frist.satz
				: undefined,
		warnungKurz: nochZuBeeinflussen && frist.art === 'verpasst' ? frist.kurz : undefined
	});

	schritte.push({
		kennung: 'zugaenge',
		titel: 'Zugänge erzeugen',
		beschreibung: 'Je Eigentümer ein QR-Blatt für die Anmeldung im Saal.',
		zustand: lage.anzahlZugaenge > 0 ? 'erledigt' : abFreigabe ? 'offen' : 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/zugaenge`,
		stand:
			lage.anzahlZugaenge === 0
				? undefined
				: lage.anzahlZugaenge < lage.anzahlStimmberechtigte
					? `${lage.anzahlZugaenge} von ${lage.anzahlStimmberechtigte} Stimmberechtigten`
					: `${lage.anzahlZugaenge} Zugänge erzeugt`
	});

	/*
	 * **Die Ausfallsicherung gehört in die Vorbereitung** (Auftraggeber, 20.08.2026:
	 * «Die Ausfallsicherung zu machen gehört zur Vorbereitung»).
	 *
	 * Sie stand bisher nur unter «Jederzeit» — dort findet sie, wer sie sucht,
	 * und das ist genau der Fall, der nicht eintritt: Wer an den Ausfall denkt,
	 * hat ihn schon. Als Schritt in der Liste steht sie zwischen den anderen
	 * Vorbereitungen und fällt auf, solange sie offen ist.
	 *
	 * **Nach der Freigabe**, weil die Unterlagen auf der Momentaufnahme
	 * rechnen: Wer sie vorher zöge, hätte Blätter mit einem Stimmberechtigtenstand,
	 * der bis zur Freigabe noch wandert.
	 */
	/*
	 * Verglichen werden **Namen**, nicht Anzahlen: Eine Unterlage, die
	 * zwischenzeitlich wegfällt, darf keine andere decken, die nie geholt wurde.
	 * Was geholt, aber nicht mehr nötig ist, zählt nicht als Rückstand.
	 */
	const geholteUnterlagen = lage.ausfallunterlagenNoetig.filter((u) =>
		lage.ausfallunterlagenGeholt.includes(u)
	);
	const fehlendeUnterlagen = lage.ausfallunterlagenNoetig.filter(
		(u) => !lage.ausfallunterlagenGeholt.includes(u)
	);

	schritte.push({
		kennung: 'ausfall',
		titel: 'Ausfallsicherung holen',
		/*
		 * **Die Unterschriftenliste steht mit** (02.09.2026). Sie lag seit dem
		 * 23.08.2026 auf der Ausfallseite, wurde aber weder gezählt noch genannt —
		 * und sie ist die einzige der Unterlagen, die im Totalausfall den
		 * Anwesenheitsnachweis trägt.
		 */
		/*
		 * **Die Weiche fragt nach der Mappe, nicht nach der Anzahl** (aus dem
		 * Code-Review). `>= 4` hätte den kürzeren Satz beim Hinzufügen einer
		 * fünften Unterlage still unerreichbar gemacht.
		 */
		beschreibung: lage.ausfallunterlagenNoetig.includes('auszaehlung')
			? 'Traktandenliste, Unterschriftenliste, Stimmzettel und Auszählmappe — auf Papier ' +
				'oder auf einen Stick. Wer sie braucht, hat den Server nicht mehr, von dem er sie ' +
				'holen könnte.'
			: 'Traktandenliste, Unterschriftenliste und Stimmzettel — auf Papier oder auf einen ' +
				'Stick. Wer sie braucht, hat den Server nicht mehr, von dem er sie holen könnte.',
		zustand:
			fehlendeUnterlagen.length === 0 ? 'erledigt' : abFreigabe ? 'offen' : 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/ausfall`,
		stand:
			geholteUnterlagen.length === 0 || fehlendeUnterlagen.length === 0
				? undefined
				: `${geholteUnterlagen.length} von ${lage.ausfallunterlagenNoetig.length} Unterlagen geholt`
	});

	/*
	 * **Vollmachten stehen vor der Anwesenheit**, nicht daneben.
	 *
	 * Sie kommen mit der Post, und am Eingang liegen sie auf dem Tisch. Wer sie
	 * erst nach dem Einlassen prüft, hat die vertretene Partei bereits als
	 * abwesend geführt — und die Beschlussfähigkeit einmal falsch festgestellt.
	 *
	 * Kein Häkchen ohne Vollmachten: «erledigt» hiesse, es seien alle geprüft,
	 * und wo gar keine sind, gibt es nichts zu erledigen. Deshalb bleibt der
	 * Schritt offen und trägt die Zahl.
	 */
	schritte.push({
		kennung: 'vollmachten',
		titel: 'Vollmachten',
		beschreibung:
			'Wer sich vertreten lässt, braucht eine geprüfte Vollmacht. Erfasst überträgt nichts — ' +
			'erst die Bestätigung macht sie wirksam.',
		zustand: abFreigabe ? (lage.vollmachtenOffen > 0 ? 'offen' : 'erledigt') : 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/vollmachten`,
		/*
		 * **«keine erfasst» erst ab der Freigabe** (02.09.2026). Vorher ist das
		 * keine Auskunft, sondern die Definition: Eine Vollmacht bezieht sich auf
		 * eine Versammlung, deren Stimmberechtigte feststehen, und die stehen im
		 * Entwurf noch nicht fest. Solange die Vorbereitungsseite den Stand eines
		 * gesperrten Schrittes verschluckte, fiel das nicht auf — seit sie ihn
		 * neben dem Sperrgrund zeigt, stuende dort eine leere Zeile.
		 */
		stand: !abFreigabe
			? undefined
			: lage.vollmachtenOffen > 0
				? `${lage.vollmachtenOffen} zu prüfen`
				: lage.vollmachtenWirksam > 0
					? `${lage.vollmachtenWirksam} wirksam`
					: 'keine erfasst'
	});

	// ── An der Versammlung ─────────────────────────────────────────────────
	//
	// **Die Anwesenheit ist ein Schritt, kein Zusatz.**
	//
	// Sie stand bisher nur in der Seitenleiste, als Eintrag neben den Schritten.
	// Die Weiter-Leiste rechnet aber mit den Schritten — und übersprang sie
	// deshalb: Wer bei den Zugängen stand, las «Als Nächstes: Versammlung
	// führen», obwohl zuerst der Eingang kommt. Gemeldet am 02.08.2026.
	//
	// Erledigt ist sie erst mit dem Schluss: Bis dahin kommen und gehen Leute,
	// und jede Abstimmung rechnet auf dem Stand ihres Augenblicks (AD-16). Ein
	// Häkchen vorher hiesse, die Anwesenheit stehe fest — sie steht nie fest,
	// solange die Versammlung läuft.
	schritte.push({
		kennung: 'anwesenheit',
		titel: 'Anwesenheit und Beschlussfähigkeit',
		beschreibung: 'Wer eintrifft, wird eingelassen; daraus ergibt sich die Beschlussfähigkeit.',
		zustand: geschlossen ? 'erledigt' : abFreigabe ? 'offen' : 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/anwesenheit`,
		stand:
			lage.versammlungszustand === 'laufend'
				? 'die Versammlung läuft — der Stand wandert mit'
				: undefined
	});

	schritte.push({
		kennung: 'durchfuehrung',
		titel: 'Versammlung führen',
		beschreibung: 'Eröffnen, Traktanden aufrufen, abstimmen, verkünden.',
		zustand: geschlossen
			? 'erledigt'
			: lage.versammlungszustand === 'laufend'
				? 'offen'
				: abFreigabe
					? 'offen'
					: 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/leitung`
	});

	schritte.push({
		kennung: 'auswertung',
		titel: 'Auswertung',
		beschreibung: 'Je Traktandum das Erfordernis, die Zahlen und das Ergebnis — für das Protokoll.',
		zustand: geschlossen ? 'offen' : 'gesperrt',
		sperrgrund: geschlossen
			? undefined
			: lage.beschluesseGefasst
				? 'Erst nach dem Schliessen der Versammlung — vorher wären die Zahlen vorläufig.'
				: 'Erst nach dem Schliessen der Versammlung.',
		pfad: `/versammlungen/${lage.meetingId}/auswertung`
	});

	schritte.push({
		kennung: 'siegel',
		titel: 'Versiegeln',
		beschreibung:
			'Das Abschlusspaket mit Inhaltsverzeichnis und Prüfsummen. Danach lassen sich Abstimmungen, ' +
			'Anwesenheit und Vollmachten nicht mehr ändern — das Protokoll schon.',
		zustand: lage.versiegelt ? 'erledigt' : geschlossen ? 'offen' : 'gesperrt',
		sperrgrund: geschlossen ? undefined : 'Erst nach dem Schliessen der Versammlung.',
		pfad: `/versammlungen/${lage.meetingId}/siegel`,
		stand: lage.versiegelt ? 'versiegelt' : undefined
	});

	/*
	 * **Am gemeinsamen Abend gibt es kein eigenes Protokoll.** Der Schritt bleibt
	 * stehen — er ist Teil des Ablaufs, und wer ihn sucht, soll ihn finden —, führt
	 * aber auf die Notizen dieser Versammlung und nennt im Stand, wo das Protokoll
	 * geführt wird. Ihn zu verstecken hiesse, dass jemand ihn vermisst und ein
	 * zweites Protokoll von Hand schreibt.
	 *
	 * **Nie «erledigt» am Abend:** Die Fassungen entstehen dort, und ob das PDF
	 * unterzeichnet wurde, erfährt die Anwendung nicht.
	 */
	const amAbend = Boolean(lage.gemeinsamerTagId);
	schritte.push({
		kennung: 'protokoll',
		titel: amAbend ? 'Voten' : 'Protokoll',
		beschreibung: amAbend
			? 'Was zu den einzelnen Traktanden ins Protokoll soll. Das Protokoll selbst wird für den ganzen Abend geführt.'
			: 'Voten je Traktandum, daraus der Entwurf, daraus das Dokument. Nicht Teil des Siegels — ' +
				'es entsteht nach der Sitzung und wird von der nächsten Versammlung genehmigt.',
		// Offen ab der Freigabe, weil die Notizen **während** der Sitzung
		// entstehen; erledigt erst mit einer festgehaltenen Fassung. Ein Häkchen
		// beim blossen Entwurf wäre eines zu früh: Versandt ist er dann nicht.
		zustand: amAbend
			? abFreigabe
				? 'offen'
				: 'gesperrt'
			: lage.protokollfassungen > 0
				? 'erledigt'
				: abFreigabe
					? 'offen'
					: 'gesperrt',
		sperrgrund: abFreigabe ? undefined : NACH_FREIGABE,
		pfad: `/versammlungen/${lage.meetingId}/protokoll`,
		stand: amAbend
			? lage.protokollnotizen > 0
				? `${lage.protokollnotizen} ${lage.protokollnotizen === 1 ? 'Votum' : 'Voten'} · Protokoll am Abend`
				: 'Protokoll wird am Abend geführt'
			: lage.protokollfassungen > 0
				? `${lage.protokollfassungen} Fassung${lage.protokollfassungen === 1 ? '' : 'en'} festgehalten`
				: lage.protokollEntwurf
					? 'Entwurf besteht, noch keine Fassung festgehalten'
					: lage.protokollnotizen > 0
						? `${lage.protokollnotizen} ${lage.protokollnotizen === 1 ? 'Votum' : 'Voten'}, noch kein Entwurf`
						: undefined
	});

	return schritte;
}

/**
 * Die vier Abschnitte eines Versammlungsablaufs.
 *
 * Neun gleich aussehende Punkte untereinander sind eine Liste, keine Führung.
 * Erst die Bündelung sagt, worum es im jeweiligen Abschnitt geht: **Vorbereiten**
 * geschieht am Schreibtisch, **Ausgeben** verlässt das Haus (Einladung, Zugänge —
 * ab hier wird ein Fehler teuer), **An der Versammlung** und **Danach** sprechen
 * für sich.
 *
 * Die Zuordnung steht hier und nicht in der Oberfläche: Kommt ein Schritt dazu,
 * soll an einer Stelle entschieden werden, wohin er gehört.
 *
 * **Der Versand steht hinter dem Siegel** (Block 8; Nachzug Block 1b). Er ist
 * kein eigener Schritt: «Als versandt festhalten» gehört zur Protokollseite,
 * und wählbar ist die Art erst, wenn die Versammlung versiegelt ist. Deshalb
 * führt «Danach» den Schritt «Protokoll» nach dem Siegel — dieselbe Folge, in
 * der `vorbereitungsschritte` die Schritte anlegt: Auswertung, Siegel,
 * Protokoll.
 */
export const ABSCHNITTE: { titel: string; kennungen: string[] }[] = [
	{
		titel: 'Vorbereiten',
		kennungen: [
			'einheiten',
			'eigentuemer',
			'reglement',
			'beschlussfaehigkeit',
			'traktanden',
			'erfordernis'
		]
	},
	{ titel: 'Ausgeben', kennungen: ['freigabe', 'einladung', 'zugaenge', 'ausfall'] },
	{ titel: 'An der Versammlung', kennungen: ['vollmachten', 'anwesenheit', 'durchfuehrung'] },
	{ titel: 'Danach', kennungen: ['auswertung', 'siegel', 'protokoll'] }
];

export interface Schrittgruppe {
	titel: string;
	schritte: Schritt[];
}

/**
 * Die Schrittfolge in ihre Abschnitte gegliedert.
 *
 * Ein Schritt ohne Abschnitt fiele lautlos aus der Führung heraus. Damit das
 * nicht geschieht, sammelt der letzte Abschnitt auf, was keiner Kennung
 * zugeordnet ist — sichtbar, statt still verloren.
 */
export function schrittgruppen(schritte: Schritt[]): Schrittgruppe[] {
	const vergeben = new Set<string>();
	const gruppen: Schrittgruppe[] = [];

	for (const abschnitt of ABSCHNITTE) {
		const dazu = abschnitt.kennungen
			.map((k) => schritte.find((s) => s.kennung === k))
			.filter((s): s is Schritt => s !== undefined);
		dazu.forEach((s) => vergeben.add(s.kennung));
		if (dazu.length > 0) gruppen.push({ titel: abschnitt.titel, schritte: dazu });
	}

	const uebrige = schritte.filter((s) => !vergeben.has(s.kennung));
	if (uebrige.length > 0) gruppen.push({ titel: 'Weiteres', schritte: uebrige });

	return gruppen;
}

/**
 * Wie weit die Vorbereitung ist.
 *
 * Gezählt werden nur die Schritte, die überhaupt möglich sind. Gesperrte
 * mitzuzählen ergäbe eine Anzeige, die am Anfang jeder Versammlung bei einem
 * Drittel steht und dort minutenlang klebt, obwohl gerade viel geschieht.
 */
export function vorbereitungsfortschritt(schritte: Schritt[]): {
	erledigt: number;
	moeglich: number;
	anteil: number;
} {
	const moegliche = schritte.filter((s) => s.zustand !== 'gesperrt');
	const erledigt = moegliche.filter((s) => s.zustand === 'erledigt').length;
	return {
		erledigt,
		moeglich: moegliche.length,
		anteil: moegliche.length === 0 ? 0 : Math.round((erledigt / moegliche.length) * 100)
	};
}
