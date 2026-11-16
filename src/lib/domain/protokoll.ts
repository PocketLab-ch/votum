/**
 * Der Protokollentwurf (Welle 2, FR-48) — als reine Funktion.
 *
 * **Warum im Kern.** Ein Protokoll ist der Text, den ein Gericht liest, wenn
 * ein Beschluss angefochten wird. Was darin steht, muss sich mit einer
 * Wertetabelle belegen lassen: dieselben Daten hinein, derselbe Text heraus,
 * ohne Datenbank, ohne Uhr, ohne Zufall (AD-1). Der Zeitpunkt der Erstellung
 * kommt deshalb von aussen herein.
 *
 * **Was der Entwurf tut und was nicht.** Er setzt zusammen, was feststeht:
 * Kopf, Feststellung der Beschlussfähigkeit mit Zahlen, Anwesenheitsliste mit
 * Vollmachten, je Traktandum Antragswortlaut, Notizen und Ergebnis mit
 * Kopfstimmen, Wertquoten und angewandtem Erfordernis. **Er formuliert nichts
 * neu.** Zahlen und Beschlusswortlaute werden übernommen; wo etwas fehlt, steht
 * das ausdrücklich da, statt dass eine glatte Formulierung darüber hinweggeht.
 *
 * **Das Ergebnis ist Text, kein Dokument.** Er wird danach von Hand
 * überarbeitet (FR-49) und erst zur Ausgabe in Word oder PDF gesetzt. Eine
 * winzige Auszeichnung genügt dafür und bleibt in einem Textfeld lesbar:
 *
 *   `# `   Titel des Protokolls
 *   `## `  Abschnitt (ein Traktandum, die Anwesenheit, der Schluss)
 *   `### ` Unterabschnitt
 *   `- `   Aufzählung
 *   `| a | b |`  eine Tabellenzeile
 *   leer   Absatz
 *
 * Mehr nicht. Wer mehr braucht, bearbeitet das ausgegebene Word-Dokument —
 * genau dafür ist Word das Standardformat (FR-49).
 *
 * **Die Tabellenzeile kam am 03.09.2026 dazu**, auf Vorlage des Auftraggebers hin: «Struktur
 * im Sinne von hier.» Bis dahin stand hier ausdrücklich «bewusst keine
 * Tabellen» — mit dem Argument, wer mehr brauche, habe ja Word. Das Argument
 * trägt für Gestaltung, nicht für **Struktur**: Der Kopf eines Protokolls ist
 * eine Feldliste, und eine Feldliste ohne Spalten ist eine Aufzählung, die man
 * lesen muss, statt sie zu überfliegen.
 *
 * Bewusst nur **eine** Tabellenform: zwei Spalten, keine Kopfzeile, keine
 * Ausrichtung. Sie bleibt im Textfeld lesbar und übersteht eine Bearbeitung von
 * Hand. Wer Spalten ausrichtet, zerlegt sie beim ersten Tippen.
 */
import { datumLang, uhrzeit as uhrzeitAusZeitpunkt } from './datum';
import { mitQuelle } from './gemeinschaft';
import { ausstandsbefund, beteiligungDerAnwesenden, type Anwesenheitszustand } from './anwesenheit';
import {
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeitsregel,
	type Beteiligung,
	type Versammlungsstufe
} from './beschlussfaehigkeit';
import type { Stimmkraftliste } from './stimmkraft';
import type { Id } from './types';
import {
	NICHT_IM_STAND,
	ausstandProtokollInWorten,
	beklagtenwohnungSatz,
	herleitung,
	imAusstandInWorten,
	stimmtNichtInWorten,
	vonHandZahlen,
	type Auszaehlung,
	type Protokollhinweis,
	type Vertretung
} from './auszaehlung';
import {
	AUSSTAND_ZAEHLT_PROTOKOLL,
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	verwaltungsangabeProtokollsatz,
	neuAnZweiterProtokoll
} from './mehrhinweise';
import type { Ausstandsbeschlussfaehigkeit, Neutraktandenwahl } from './lesarten';
import { pendenzSatz, type Pendenzangabe } from './pendenz';
import { ruegeSatz, type Ruegeangabe } from './ruege';
import { stimmabgabeabschnitt } from './stimmabgabe';
import {
	nurDurchLeitungSatz,
	TRAKTANDIEREN_VERLANGEN,
	type AusnahmenNichtangekuendigtes,
	type Leitungsvertretung
} from './ausnahmen';
import { ersetzungInKuerze, type Ersetzungslage } from './folgeantragsersetzung';
import type { Vertretungszeitraum } from './vollmacht';
import type { Verwaltungsangabe } from './verwaltungsangabe';
import { FRISTFOLGE } from './versammlung';

/**
 * Die Rechtsfolge des Fristvermerks, wie das Protokoll sie führt (Ä-17,
 * Block 3 der Freigabeliste, 17.10.2026).
 *
 * **Der Anlass.** Der Vermerk sagte im Protokoll unbedingt «darf keine
 * Beschlüsse fassen», auch wenn alle Eigentümer da waren. Rz. 39 ad
 * Art. 712p kennt genau diese eine Ausnahme: «ausser es handle sich um eine
 * Universalversammlung»; nach Rz. 28 ad Art. 712n verzichtet, wer ohne
 * Vorbehalt teilnimmt, darauf, die Einberufung zu rügen.
 *
 * **Nur der Satz, kein Weg** (Produktentscheid 17.10.2026: «Nur das Nötigste
 * bauen»). Votum stellt nicht fest, ob die Ausnahme vorlag; es nennt sie in der
 * Regel. Die Einladung behält den unbedingten Satz: Bei der Planung weiss
 * niemand, wer kommt.
 *
 * **Wer als da gilt, sagt die Einstellung der Gemeinschaft**, dieselbe wie bei
 * den nicht angekündigten Geschäften (`domain/ausnahmen.ts`), aus der
 * Momentaufnahme. Bei «keine» bleibt der Satz, wie er ist; ohne Momentaufnahme
 * gilt die Vorgabe «persönlich».
 */
export function fristfolgeImProtokoll(
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'> | null
): string {
	const variante = einstellung?.universalvariante ?? 'persoenlich';
	if (variante === 'keine') return FRISTFOLGE;
	/*
	 * **Die Einstellung als Wahl der Gemeinschaft, nicht als Rechtslage**
	 * (Fachprüfung 17.10.2026, Stelle 1, Befund 2): Rz. 28 ad Art. 712n sagt
	 * nur «anwesend», ob eine Vertretung genügt, sagt keine Quelle. Die
	 * Laienprüfung las die Fassung mit den Vollmachten der Leitung als Gesetz.
	 */
	const wer =
		variante === 'persoenlich'
			? 'diese Gemeinschaft zählt nur persönlich Anwesende'
			: einstellung?.leitungsvollmachtenZaehlen
				? 'diese Gemeinschaft zählt auch Vertretene'
				: 'diese Gemeinschaft zählt auch Vertretene, nicht aber über eine Vollmacht der ' +
					'Sitzungsleitung oder der Verwaltung';
	/*
	 * «bei jedem Beschluss» (Fachprüfung, Befund 3; OR Art. 701 Abs. 2
	 * «solange»), «hat … widersprochen» in der Vergangenheit, weil das Protokoll
	 * nach der Versammlung gelesen wird (Laienprüfung, Befund 1).
	 */
	return (
		'Eine früher stattfindende Versammlung darf keine Beschlüsse fassen, ausser es handelt ' +
		'sich um eine Universalversammlung: Bei jedem Beschluss sind alle Eigentümer anwesend, ' +
		'und niemand hat an der Versammlung der Durchführung widersprochen (Wermelinger, Rz. 39 ' +
		'ad Art. 712p, Rz. 28 ad Art. 712n). Ob dafür eine Vertretung genügt, sagt das Gesetz ' +
		`nicht; ${wer}. Werden ausserhalb dieser Ausnahme Beschlüsse gefasst, kann jeder ` +
		'Eigentümer, der nicht zugestimmt hat, sie beim Gericht anfechten; die Frist dafür ' +
		'beträgt einen Monat und beginnt, sobald er von ihnen erfahren hat (ZGB Art. 712m ' +
		'Abs. 2 i.V.m. Art. 75).'
	);
}

/**
 * Der gespeicherte Vermerk mit der Rechtsfolge fürs Protokoll. Er endet auf
 * `FRISTFOLGE` (`fristvermerk` in `domain/versammlung.ts`); endet er anders,
 * stammt er aus einer Fassung, deren Wortlaut hier niemand kennt, und bleibt.
 */
export function fristvermerkImProtokoll(
	vermerk: string,
	einstellung: Parameters<typeof fristfolgeImProtokoll>[0]
): string {
	if (!vermerk.endsWith(FRISTFOLGE)) return vermerk;
	return vermerk.slice(0, vermerk.length - FRISTFOLGE.length) + fristfolgeImProtokoll(einstellung);
}

/**
 * Ein Stimmenspiegel, wie das Protokoll ihn braucht: die vier Eimer, die
 * Bezugsgrösse und die Schwelle.
 *
 * **Die Schwelle steht neu dabei** (28.08.2026). Bis dahin trug sie der
 * Ergebnissatz («nötig 5»), und weil der nur die gescheiterte Seite nennt,
 * fehlte sie bei der anderen. Wer prüfen wollte, ob die Wertquoten gereicht
 * hätten, fand die Zahl, an der es sich entscheidet, nirgends.
 */
export interface Protokollspiegel {
	ja: number;
	nein: number;
	enthaltung: number;
	ohneAbgabe: number;
	/**
	 * Nicht erschienen und nicht vertreten.
	 *
	 * **Seit die Zahlen nur noch hier stehen, muss die Rechnung aufgehen**
	 * (28.08.2026, aus dem Code-Review). Bei einer Bezugsgrösse, die alle
	 * Stimmberechtigten umfasst, zählt `basis` die Abwesenden mit — «8 Ja, 1
	 * Nein, 0 Enthaltung, 0 ohne Abgabe (von 15)» liess dann sechs Stimmen
	 * unerklärt. Auswertungsseite und Auswertungs-PDF nennen sie seit je.
	 */
	nichtAnwesend: number;
	/**
	 * In der Bezugsgrösse, stimmt aber nicht ab: die gemeinsame Wohnung des
	 * Beklagten an der Ausschlussklage (`Stimmenspiegel.stimmtNicht`, seit
	 * Fassung 2026-10-11), bei den Wertquoten unter dem Mehr aller Wertquoten
	 * auch seine eigene Quote (seit A2). Fehlt der Wert, war er null.
	 */
	stimmtNicht?: number;
	/**
	 * Im Ausstand, aber in der Zahl (1e, `Stimmenspiegel.imAusstand`, ab
	 * Fassung 2026-10-25). Fehlt der Wert, war er null.
	 */
	imAusstand?: number;
	basis: number;
	schwelle: number | null;
}

export interface Protokollzeile {
	nummer: string;
	tiefe: number;
	titel: string;
	art: string;
	antragswortlaut: string | null;
	kurzfassung: string | null;
	/** Was die Sitzungsleitung während der Sitzung notiert hat (FR-46). */
	notiz: string | null;
	/**
	 * Der Text in diesem Votenfeld ist ein Beschluss, den Votum nicht führt
	 * (Block 7, Migration 135). Gesetzt wird er auf der Protokollseite, nach
	 * dem Schluss und auch nach dem Versiegeln.
	 *
	 * **Was er bewirkt:** Der letzte Zweig unten schreibt «Über diesen Antrag
	 * wurde nicht abgestimmt.» nicht, und das Protokoll des Abends zählt den
	 * Punkt nicht als Lücke. Seit Block 7b zählen ihn auch Tafel und Leiste des
	 * Abends nicht mehr als offen, und die Auswertung schreibt
	 * `AUSWERTUNG_VON_HAND_ABGESTIMMT`; seit Block 7c zählt ihn die Wand als
	 * «von Hand abgestimmt». **Was er nicht ist:** ein Ergebnis. Der
	 * Stimmnachweis kennt ihn nicht, und Auswertung und Wand führen dazu weder
	 * Zahlen noch Ausgang.
	 */
	beschlussvermerk?: boolean;
	/**
	 * Wer den Antrag gestellt hat, als Satz — «Aebi, Bucher & Christen».
	 *
	 * **Er steht getrennt vom Antragstext**, und zwar in der Datenhaltung
	 * (21.08.2026): Nur so bleibt der Text frei von Personendaten und lässt sich
	 * an ein Sprachmodell geben. Im Protokoll gehören beide zusammen — deshalb
	 * setzt es den Satz davor.
	 */
	antragsteller: string | null;
	/**
	 * Ein Folgeantrag zu diesem Antrag wurde **angenommen**.
	 *
	 * Gefragt am 21.08.2026: «Wenn der Folgeantrag angenommen wird und nicht über
	 * den Hauptantrag abgestimmt wurde, was geschieht dann? Nicht eingetreten?»
	 *
	 * Weder noch — «nicht eingetreten» hiesse, die Versammlung habe die Sache
	 * gar nicht erst beraten. Sie hat beraten und entschieden, nur eben in der
	 * Fassung des Gegenantrags; der ursprüngliche ist damit **gegenstandslos**.
	 * Das Protokoll muss den Zusammenhang nennen, sonst steht dort ein Antrag
	 * ohne Ergebnis und ohne Grund.
	 *
	 * **Alle, in der Folge ihrer Nummern** (Entscheid 0045, Punkt 9, beim Bau
	 * geklärt 07.11.2026): Teilt die Leitung einen Antrag in Folgeanträge auf,
	 * etwa Wahl und Entschädigung, können mehrere angenommen sein. Bis dahin
	 * trug das Feld einen, den zuletzt gefundenen. `null`, wo keiner
	 * angenommen ist; sonst nie leer.
	 */
	folgeantraegeAngenommen: { nummer: string; titel: string }[] | null;
	/**
	 * Entscheid 0045, Punkt 9 (Codeprüfung P9, M-2): Unter dem Häkchen ist über
	 * Folgeanträge zur Wahl oder Abberufung abgestimmt, keiner angenommen, und
	 * Votum hat den Grundantrag gesperrt. `null`, wo das nicht zutrifft.
	 */
	teileEntschieden?: { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[] | null;
	/**
	 * Vor einem Traktandum mit kleinerer Nummer behandelt.
	 *
	 * Seit die Nummer bei der Freigabe festgeschrieben wird (Migration 072), darf
	 * die Versammlung die Reihenfolge ändern, ohne dass die Nummern wandern. Dann
	 * steht im Protokoll aber eine Folge wie «7, 9, 8» — und ohne Vermerk sähe
	 * das nach einem Fehler aus statt nach einem Ordnungsentscheid.
	 */
	vorgezogen: boolean;
	/** Die nötige Mehrheit in Worten — «mehr als die Hälfte der Anwesenden». */
	erfordernis: string | null;
	/** Der Fallname dazu, als Einordnung neben der Regel (22.08.2026). */
	fall?: string | null;
	/** Die Leitung hat die Mehrheit gesetzt; dann keine Herleitung (`mehrheitGesetzt`). */
	mehrheitGesetzt?: boolean;
	/**
	 * Was an diesem Geschäft ausser dem Abstimmen geschah (22.08.2026).
	 *
	 * Ausstand, Rückzug und dessen Rücknahme — sie erklären, was sonst
	 * unerklärlich bliebe: eine Bezugsgrösse, die kleiner ist als die Zahl der
	 * Stimmberechtigten, oder ein Antrag, über den doch abgestimmt wurde, obwohl
	 * er einmal zurückgezogen war.
	 */
	/**
	 * `danachAbgestimmt` nur bei der Rücknahme eines Rückzugs: ob danach noch ein
	 * Durchgang eröffnet wurde (Schritt F2). Fehlt sie, gilt der frühere Satz.
	 */
	vorgaenge?: {
		art: string;
		wer: string;
		angaben: Record<string, unknown>;
		zeitpunkt: string;
		danachAbgestimmt?: boolean;
	}[];
	rechtsgrundlage: string | null;
	/**
	 * Die Fassung des Regelwerks, nach der das Erfordernis hergeleitet wurde,
	 * als Kalendertag (AD-4). Bis Block 2 der Freigabeliste stand sie nur im
	 * Entscheidungsweg des Abschlusspakets (`server/siegel.ts`); Ä-09 verlangt
	 * sie je Beschluss im Protokoll, neben dem Klartext und nicht an seiner
	 * Stelle. Fehlt sie, steht der Satz nicht.
	 */
	regelfassung?: string | null;
	/**
	 * Nach welcher Lesart der Gemeinschaft gerechnet wurde (Migration 169,
	 * Entscheid 0018), als Satz (`lesartProtokollsatz`). Fehlt sie, trug das
	 * Erfordernis keine.
	 */
	lesart?: string | null;
	/**
	 * Neu an einer zweiten Versammlung (Ä-17 B, `neueTraktandenDerZweiten`):
	 * Beim Beschluss steht dann die Zeile aus `neuAnZweiterProtokoll`, die mit
	 * `NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL` beginnt. Fehlt das Feld, gilt «nein».
	 */
	neuAnZweiterVersammlung?: boolean;
	/**
	 * Die Wahl zu L5 aus der Momentaufnahme (Migration 174): Die Zeile nennt
	 * dann die Einstellung der Gemeinschaft (F3, `neuAnZweiterProtokoll`). Fehlt
	 * sie, steht die Tatsache allein.
	 */
	neuAnZweiterWahl?: Neutraktandenwahl | null;
	/**
	 * A5, Punkt 8 (Entscheid 0032): die hinterlegte Anwesenheitsregel des
	 * Reglements für die zweite Versammlung, für die Zeile aus
	 * `neuAnZweiterProtokoll`. Fehlt sie, nennt die Zeile das Drittel nach
	 * Gesetz.
	 */
	neuAnZweiterRegel?: Beschlussfaehigkeitsregel | null;
	/** Wo Weg oder Frist der Anfechtung anders laufen (`anfechtungsabschnitt`). */
	anfechtungssonderfall?: Anfechtungssonderfall | null;
	/**
	 * Ob bei diesem Beschluss die Beschlussfähigkeit einer ersten fehlte
	 * (`ersteFehlteAmBeschluss`); `null`, wo es sich nicht bestimmen lässt.
	 */
	neuAnZweiterErsteFehlte?: ErsteFehlte;
	/**
	 * Vor der Abstimmung zurückgezogen (FR-45), mit Grund.
	 *
	 * **Kein Fall von «abgelehnt».** Es gab keine Abstimmung und damit keine
	 * Mehrheit dagegen; das Protokoll muss den Unterschied hergeben, sonst
	 * behauptet es etwas, das nie gezählt wurde.
	 */
	rueckzug: string | null;
	/**
	 * Die Wertung aus der Auszählung — **ohne die Zahlen** (`ergebniswertung`).
	 *
	 * Nicht derselbe Satz wie auf der Leinwand: Dort steht er für sich, hier
	 * folgt der vollständige Spiegel unmittelbar darunter. Beide Fassungen
	 * nebeneinander ergaben die Ungleichheit, die der Auftraggeber am 28.08.2026 meldete —
	 * die Kopfzahlen zweimal, die Wertquoten einmal.
	 */
	satz: string | null;
	/**
	 * Details, Präzisierungen oder Änderungen zum Beschluss (Auftraggeber, 09.09.2026).
	 *
	 * **Er fehlte hier zuerst** (Code-Review 09.09.2026): Der erste Anlauf gab
	 * ihn nur im Abendprotokoll aus, und die Erfolgsmeldung «steht im Protokoll»
	 * war im Haus schlicht falsch. Zwei Protokollfassungen sind zwei Leser
	 * derselben Tatsache; wer nur einen bedient, hat es nicht gebaut, sondern
	 * halb gebaut.
	 *
	 * Steht **unter** dem Ergebnissatz und über dem Stimmenspiegel: Er gehört
	 * zum Beschluss, nicht zur Auszählung.
	 */
	beschlusstext: string | null;
	/**
	 * Was jemand aus diesem Traktandum zu tun hat (Migration 106).
	 *
	 * **Ohne Zustand, und das ist der Entscheid an dieser Stelle.** Das Protokoll
	 * hält fest, was an dieser Versammlung vereinbart wurde — und vereinbart
	 * wurde eine offene Pendenz. Ihr Zustand ändert sich danach, oft erst ein
	 * Jahr später; stünde er hier, sagten zwei festgehaltene Fassungen desselben
	 * Protokolls Verschiedenes, ohne dass sich an der Versammlung etwas geändert
	 * hätte. Wer wissen will, wie es heute steht, sieht bei der Gemeinschaft
	 * nach, nicht im Protokoll von damals.
	 *
	 * Steht am **Schluss** des Traktandums: Sie ist die Folge aus allem darüber,
	 * auch aus einer Kenntnisnahme ohne Abstimmung («Die Revisoren behalten sich
	 * vor, für 2027 den Antrag zu stellen»).
	 */
	pendenzen: Pendenzangabe[];
	/**
	 * Die Rügen im Saal zu diesem Traktandum (Ä-06, Migration 160).
	 *
	 * **Steht gleich unter der Überschrift**, vor allem anderen: Gerügt wird
	 * vor der Abstimmung, und auf diese Reihenfolge kommt es an.
	 *
	 * **Freiwillig im Typ**, damit die Testaufbauten dieser Zeile, die keine
	 * Rüge brauchen, unverändert bleiben (Codeprüfung H8). Der einzige
	 * Erzeuger im Betrieb, `stelleEntwurfZusammen`, setzt es immer.
	 */
	ruegen?: Ruegeangabe[];
	zahlen: {
		koepfe: Protokollspiegel;
		quoten: Protokollspiegel;
	} | null;
	/**
	 * Geheime Abstimmung (Produktentscheid 28.09.2026, Migration 141).
	 *
	 * Dann fehlt `zahlen`, und der Satz nennt nur «erreicht» oder «nicht
	 * erreicht». Der Vermerk sagt, dass geheim abgestimmt wurde; die
	 * Einzelstimmen stehen getrennt im Abschlusspaket (Stimmnachweisblatt).
	 */
	geheim?: boolean;
	/**
	 * Die Versammlung hat offen beschlossen, geheim abzustimmen, und die
	 * Leitung hat es beim Eröffnen bestätigt (Migration 165, Ä-38). Das
	 * Protokoll nennt den Beschluss als Grundlage (Pflichtpunkt 8 der
	 * Fachprüfung vom 28.09.2026). Fehlt er, steht der Satz nicht.
	 */
	geheimBeschlossen?: boolean;
	/** Das Reglement sieht die geheime Abstimmung vor (Migration 166, Ä-38). */
	geheimNachReglement?: boolean;
	/**
	 * Ermächtigung zur Ausschlussklage: die gemeinsamen Wohnungen der Beklagten
	 * mit der Angabe der Sitzungsleitung (`Auszaehlung.beklagtenwohnungen`).
	 * Bis zum 30.09.2026 stand die Angabe nur im Verlauf und in den Hinweisen des
	 * Ergebnisses; wer das Protokoll liest, erfuhr nicht, warum die Wohnung in
	 * der Zahl stand oder nicht.
	 */
	beklagtenwohnungen?: { name: string; alleBeklagt: boolean }[];
	/**
	 * Ob die Wertquoten überhaupt erhoben wurden.
	 *
	 * **Das Protokoll war der vierte Leser** (28.08.2026). Leitungssicht,
	 * Auswertungsseite und Auswertungs-PDF fragen `quotenErhoben` seit der
	 * Handzählung ab; das Protokoll nahm den Spiegel, wie er kam, und schrieb
	 * «Wertquoten: 0 Ja, 0 Nein, 0 Enthaltung, 0 ohne Abgabe (von 0)». Das ist
	 * keine Null, sondern eine Zahl, die niemand gezählt hat — in dem Dokument,
	 * das im Anfechtungsfall gelesen wird.
	 */
	quotenErhoben: boolean;
	/**
	 * Was der Ausstand an den Bezugsgrössen geändert hat, mit Zahlen
	 * (`ausstandswirkung` in `auszaehlung.ts`). `null` ohne Ausstand.
	 */
	ausstandswirkung?: string | null;
	/**
	 * Die Vermerke der Auszählung fürs Protokoll, mit eigener Fassung und
	 * Ordnung (Fachprüfung 08.10.2026). `bezugsgroesse` erklärt die Zahlen,
	 * `ausgang` begründet oder relativiert das Ergebnis. Leer bei Ergebnissen,
	 * die vor dem Bau festgeschrieben wurden; Test- und Hilfsaufrufer setzen
	 * das Feld nicht.
	 */
	protokollhinweise?: Protokollhinweis[];
	/**
	 * Von Hand gezählt, mit dem Vermerk der Sitzungsleitung.
	 *
	 * Auftraggeber, 28.08.2026: «Handabstimmung fehlt im Protokoll.» Sie fehlte
	 * tatsächlich, und zwar ganz: Weder stand dort, dass die Zahlen aus einer
	 * Handzählung stammen, noch wie gezählt wurde.
	 */
	handzaehlung: { vermerk: string | null } | null;
	/**
	 * Der Beschluss ist von der Sitzungsleitung von Hand festgehalten
	 * (`Auszaehlung.vonHand`). **Das Protokoll sagt es nicht** (Produktentscheid
	 * 30.09.2026); das Merkmal bestimmt nur, was wegbleibt: kein Erfordernis,
	 * kein «ohne Abgabe», kein «von N», kein «nötig», weil gegen keine Schwelle
	 * gerechnet wurde. Die Zahlen stehen, soweit eingetragen.
	 */
	vonHand?: boolean;
	/**
	 * Die im Saal eingewendete Bestimmung, wo die Leitung den Antrag ihretwegen
	 * als abgelehnt festgehalten hat (`Auszaehlung.vonHand.einwand`, Entscheid
	 * 0046, A7). Das Protokoll nennt sie mit `einwandSatz`; den Weg nennt es
	 * auch hier nicht.
	 */
	einwand?: string | null;
	/** Wie die eingewendete Bestimmung eingeführt wurde, nach Angabe der Leitung. */
	einwandEinfuehrung?: string | null;
	/** Die eingewendete Bestimmung betraf die notwendige bauliche Massnahme. */
	einwandNotwendig?: boolean;
	/**
	 * Die Versammlung war bei diesem Beschluss nicht beschlussfähig.
	 *
	 * **Woher die Angabe kommt** (Auftrag Block 5): aus der Tatsache, nicht aus
	 * dem Verlauf. Die Schale rechnet sie aus dem beim Durchgang eingefrorenen
	 * Anwesenheitsstand (`attendance_json.anwesende`) mit derselben Kernfunktion
	 * wie beim Eröffnen (`stelleBeschlussfaehigkeitFest`); gelesen wird weder
	 * der Eintrag des Beschlusses von Hand noch sein Feld `uebergangen`. Gesetzt
	 * ist das Merkmal nur bei einem von Hand festgehaltenen Beschluss; dort trägt
	 * das Protokoll dann den Satz aus `beschlussfaehigkeitFehlteSatz`.
	 *
	 * **Mit der Grundlage, nach der gerechnet wurde** (Fachprüfung 01.10.2026):
	 * Hat die Gemeinschaft eine eigene Regel hinterlegt, nennt der Satz deren
	 * Fundstelle und nicht ZGB Art. 712p, der dann nicht verletzt sein muss. Die
	 * Regel des Reglements darf nur erschweren (`pruefeErschwerung`); wer sie
	 * verfehlt, hat die massgebende Regel verfehlt.
	 *
	 * **Mit dem Ausgang:** Bei «Abgelehnt» steht nach der Tatsache, dass der
	 * Antrag erneut vorgelegt werden kann, und danach die Anfechtung (siehe
	 * `beschlussfaehigkeitFehlteSatz`).
	 *
	 * **Der Stand ist der beim Eintragen, nicht der bei der Abstimmung im Saal.**
	 * Wird nach einem Ausfall später nachgetragen, misst die Angabe den späteren
	 * Stand; das Handbuch sagt es («Wenn Votum ausgefallen ist»).
	 */
	beschlussfaehigkeitFehlte?: BeschlussfaehigkeitFehlte | null;
	/**
	 * L7 (Migration 183): Die Beschlussfähigkeit hing bei diesem Beschluss an
	 * den Personen im Ausstand, mit der eingefrorenen Wahl. Unter «Zählt mit»
	 * trägt das Protokoll `AUSSTAND_ZAEHLT_PROTOKOLL`; unter «Zählt nicht mit»
	 * sperrt das Eröffnen, und ein Beschluss, der trotzdem steht, ging von
	 * Hand an der Prüfung vorbei: Dann trägt es `ausstandNichtBeschlussfaehigSatz`
	 * mit der Anfechtung (Produktentscheid 06.11.2026). Gerechnet aus dem
	 * beim Durchgang eingefrorenen `attendance_json` mit derselben
	 * Kernfunktion wie beim Eröffnen (`ausstandFehlteAmBeschluss`). Nicht
	 * gesetzt, wo die Beschlussfähigkeit selbst fehlte: Das sagt die Zeile
	 * daneben.
	 */
	ohneAusstandFehlte?: AusstandFehlte | null;
	/**
	 * L8 (Migration 184), Entscheid 8 (07.11.2026): Das Traktandum trägt das
	 * Häkchen, und sein Erfordernis steht nach der Freigabe auf der Wahl oder
	 * der Wiederwahl der Verwaltung. Nur unter «Vollmachten ruhen» trägt das
	 * Protokoll `VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL`: Die Einladung hatte
	 * angekündigt, dass die Vollmachten der Verwaltung nicht zählen, und bei
	 * der Wahl zählten sie doch. Unter «Die Sitzungsleitung entscheidet» sagt
	 * die Einladung seit G7 (08.11.2026) nur, dass die Leitung entscheidet, ob
	 * sie zählen, und kündigt kein Ergebnis an; dass sie an der Wahl zählen,
	 * widerspricht ihr nicht, und die Zeile bliebe ohne Gegenstück
	 * (Codeprüfung 08.11.2026, M-1: Begründung nachgezogen, Ergebnis gleich).
	 */
	wahlTrotzHaekchen?: boolean;
	/**
	 * L8, Entscheid 0045, Punkt 9 (07.11.2026): dieselbe Lage an der
	 * Abberufung, die Votum nach der Freigabe nur als Folgeantrag annimmt.
	 * Nur unter «Vollmachten ruhen», aus demselben Grund wie oben;
	 * `VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL`.
	 */
	abberufungTrotzHaekchen?: boolean;
	/** Dazu: Die Leitung hat den Ausstand der Verwaltung dort erklärt. */
	abberufungAusstandErklaert?: boolean;
	/**
	 * L8, Entscheid 0045, Punkt 11 (08.11.2026): An diesem Folgeantrag hat
	 * die Leitung angegeben, dass er eine andere als die bisherige
	 * Verwaltung oder die Kündigung ihres Vertrags betrifft; dazu, ob sie
	 * den Ausstand der Verwaltung trotzdem erklärt hat. Nur unter
	 * «Vollmachten ruhen» und nicht an Wahl oder Abberufung, aus demselben
	 * Grund wie oben; `verwaltungsangabeProtokollsatz`.
	 */
	verwaltungsangabe?: { grund: Verwaltungsangabe; ausstandErklaert: boolean } | null;
	/**
	 * Betroffene, deren nach ZGB Art. 712g Abs. 4 nötige Zustimmung fehlt.
	 *
	 * **Namentlich, und das ist Absicht:** Dort ist der Name der Nachweis, nicht
	 * ein Stimmverhalten. Er steht in einer eigenen Zeile statt in der Wertung,
	 * damit diese frei von Namen und Zahlen bleibt.
	 */
	ohneZustimmung: string[];
	/**
	 * Die Veto-Entscheide im Ausstand, mit Weg: `Name (am eigenen Gerät)`,
	 * `Name (durch ihre Vertretung)` oder `Name (mündlich, von der Sitzungsleitung erfasst)`,
	 * je mit dem Zusatz, ob zugestimmt
	 * wurde (26.09.2026).
	 *
	 * **Warum im Protokoll.** Im Ausstand gibt es keine Stimme, die den
	 * Beschluss trägt; das Veto ist der Nachweis der Zustimmung. Ohne diese
	 * Zeile stünde «angenommen» da, ohne dass etwas die Zustimmung belegt.
	 * Die fehlenden Zustimmungen nennt daneben die Zeile
	 * `ohneZustimmung`.
	 */
	veto?: string[];
	/**
	 * Wie die Zustimmung der Betroffenen erteilt wird (Block A3a,
	 * 26.09.2026): `im_saal_oder_vorab` bei den Nutzungsrechten (ZGB
	 * Art. 712g Abs. 4), `nachher` bei den Wertquoten (Art. 712e Abs. 2),
	 * `null` oder fehlend, wo keine nötig ist. Bestimmt, welche Zeilen
	 * `betroffenenzeilen` bildet und welche Norm sie nennen.
	 */
	zustimmungsform?: 'im_saal_oder_vorab' | 'nachher' | null;
	/**
	 * Gezählte Vorab-Zustimmungen, je `Name (laut Sitzungsleitung: Vermerk)`.
	 * Nur die, die die Auswertung zählt, nicht widerrufene.
	 */
	vorabZugestimmt?: string[];
	/**
	 * Bei `nachher`: wessen Unterschrift auf der Abänderungsurkunde aussteht.
	 * Kann `NICHT_IM_STAND` enthalten; der Fall bekommt eine eigene Zeile.
	 */
	ausstehend?: string[];
	/**
	 * Bei `nachher`: die Nutzniessungen an Einheiten der Betroffenen, je
	 * `Name (Einheit)`, aus dem festgehaltenen Stand
	 * (`nutzniessungenDerBetroffenen`). Ihre schriftliche Zustimmung braucht das
	 * Grundbuch, wenn sich die Quote der Einheit ändert (Produktentscheid
	 * 03.11.2026; SVIT-Kommentar 2023, Art. 712e Rz. 80, 88). Fehlt es, ist
	 * keine erfasst.
	 */
	ausstehendNutzniessung?: string[];
	durchgang: number | null;
	frueherenDurchgaenge: number;
	/**
	 * Frühere Durchgänge ohne Beschluss nach einem Weggang, beim Neueröffnen
	 * überholt (Migration 128). Fehlt es, gab es keine.
	 */
	nachWeggang?: {
		nummer: number;
		namen: string[];
		handzaehlung: boolean;
		/** Wer davon nur über die Leitung vertreten war (Codeprüfung Block 4a, N-4). */
		nurDurchLeitung?: Leitungsvertretung[];
	}[];
	/**
	 * Frühere konsultative Durchgänge, die ein späterer überholt hat, mit ihren
	 * Zahlen (Migration 158, `konsultativFruehererSatz`). `zahlen` ist null bei
	 * geheimer Abstimmung. Fehlt es, gab es keine. Nach einem Rückzug auch der
	 * letzte, nicht überholte: Dann gibt es keinen späteren, und der Satz zum
	 * Rückzug nennt ihn (H7, Teil D).
	 */
	konsultativFrueher?: {
		nummer: number;
		zahlen: { koepfe: Protokollspiegel; quoten: Protokollspiegel | null } | null;
		/** Konsultativ nach der Sperre von L5 (Migration 174): eigener Grund im Satz. */
		neuAnZweiter?: boolean;
	}[];
	/**
	 * Jede von der Leitung angesetzte Neuabstimmung auf einen früheren Durchgang,
	 * mit Begründung und Ergebnis des überholten (Produktentscheid 30.09.2026:
	 * «Ja, immer nennen»). Ohne die, die `neuabstimmungOffen` und
	 * `neuabstimmungNachRueckkommen` schon nennen. Fehlt es, gab es keine.
	 */
	neuabstimmungen?: {
		nummer: number;
		begruendung: string | null;
		ergebnis: 'angenommen' | 'abgelehnt' | null;
		/** Der überholte endete mit offenem Gleichstand; seit H6 der Regelfall. */
		unentschieden?: boolean;
		/** Die Leitung hat die laufende Abstimmung ohne Ergebnis abgebrochen (H6). */
		abgebrochen?: boolean;
	}[];
	/** Abgestimmt, Neuabstimmung angesetzt, nicht mehr eröffnet (Block 4a, F-1). */
	neuabstimmungOffen?: {
		nummer: number;
		begruendung: string | null;
		/** Wie der überholte Durchgang ausging; null ohne lesbares Ergebnis (Fachprüfung 30.09.2026, F-6). */
		ergebnis?: 'angenommen' | 'abgelehnt' | null;
		/** Der überholte endete mit offenem Gleichstand; seit H6 der Regelfall. */
		unentschieden?: boolean;
		/** Die Leitung hat die laufende Abstimmung ohne Ergebnis abgebrochen (H6). */
		abgebrochen?: boolean;
	} | null;
	/**
	 * Nach dem Rückkommen neu abgestimmt, dann Neuabstimmung angesetzt; der
	 * frühere Beschluss gilt weiter. Seit H6 nur nach einem Durchgang mit
	 * offenem Stichentscheid, denn ein verkündeter lässt sich nicht überholen.
	 */
	neuabstimmungNachRueckkommen?: {
		nummer: number;
		begruendung: string | null;
		/** Wie der überholte Durchgang ausging; null ohne lesbares Ergebnis. */
		ergebnis: 'angenommen' | 'abgelehnt' | null;
		/**
		 * Der überholte Durchgang endete unentschieden, mit offenem
		 * Stichentscheid. Seit H6 neben dem Abbruch der einzige Fall, der
		 * hierher führt.
		 */
		unentschieden?: boolean;
		/** Die Leitung hat die laufende Abstimmung ohne Ergebnis abgebrochen (H6). */
		abgebrochen?: boolean;
		/** Der Durchgang, der weiter gilt. */
		geltenderDurchgang: number;
		/** Ob dort abgelehnt wurde: Dann bleibt es bei der Ablehnung. */
		geltendAbgelehnt: boolean;
	} | null;
	/**
	 * Wie viele der früheren Durchgänge durch ein **Rückkommen** ersetzt wurden
	 * (FR-44).
	 *
	 * Der Unterschied gehört ins Protokoll: «überholt» heisst, der Durchgang war
	 * fehlerhaft und die Versammlung hat nie so entschieden. «Ersetzt nach
	 * Rückkommen» heisst, sie hat **zweimal** entschieden — beide Male gültig,
	 * der erste bis zum zweiten.
	 */
	frueherenDurchRueckkommen: number;
	/**
	 * Am Rückkommensantrag selbst: Er ist angenommen, aber nicht erneut
	 * abgestimmt worden; die Nummer des Geschäfts, auf das er zielt. Sonst liest
	 * man unter 4.1 «… beschliesst die Sache erneut …: angenommen» und meint, es
	 * sei neu abgestimmt worden (Laienprüfung 30.09.2026, Reste, L4).
	 */
	rueckkommenNichtGenutzt?: string | null;
	/**
	 * Der Durchgang ohne Beschluss nach dem Rückkommen hatte einen offenen
	 * Stichentscheid (Reste vom 30.09.2026, Punkt 3). Dann ist nichts
	 * entschieden, und das Protokoll sagt «nicht festgestellt» statt «kein
	 * Beschluss».
	 */
	rueckkommenStichentscheidOffen?: boolean;
	/**
	 * Ein angenommener Rückkommensantrag, der keinen neuen Durchgang getragen
	 * hat (Fachprüfung 30.09.2026, F-8). Nach seiner Bedingung gilt der frühere
	 * Beschluss weiter; ohne Satz dazu stünde unter dem Rückkommensantrag
	 * «… wird der bisherige aufgehoben …: angenommen» und beim Geschäft das
	 * frühere Ergebnis ohne Erklärung.
	 */
	rueckkommenOhneDurchgang?: {
		/** Die Nummer des Rückkommensantrags, etwa «4.1». */
		antrag: string;
		geltenderDurchgang: number;
		geltendAbgelehnt: boolean;
		/**
		 * Liegt der geltende Beschluss am Folgeantrag, der den Grundantrag nach
		 * einem früheren Rückkommen ersetzt hat: dessen Nummer (B2b, zweiter
		 * Randfall, Produktentscheid 15.10.2026).
		 */
		folgeantrag?: string | null;
	} | null;
	/**
	 * Durchgänge, die ein **Rückkommen** ersetzt hat, mit ihrem Ergebnis
	 * (Produktentscheid 30.09.2026, «Nein heisst Nein»). Seit auch eine
	 * Ablehnung ersetzt, ist der geltende Durchgang nach einem Rückkommen oft
	 * nicht mehr der erste, und die Zeile «… Durchgang; weitere Durchgänge siehe
	 * Verlauf» verschwieg das Rückkommen (Fachprüfung 30.09.2026, F-11).
	 */
	ersetztNachRueckkommen?: { nummer: number; ergebnis: 'angenommen' | 'abgelehnt' | null; folgeantrag?: string | null }[];
	/**
	 * Es wurde zurückgekommen und erneut abgestimmt, ein Beschluss kam dabei aber
	 * nicht zustande (die Universalversammlung hielt nicht, oder ein
	 * Stichentscheid ist offen); der frühere Beschluss blieb in Kraft. Nach einer
	 * Ablehnung nicht mehr: Die ersetzt ihn seit dem 30.09.2026 («Nein heisst
	 * Nein», `docs/freigabe.md`, Punkt (a)).
	 */
	rueckkommenErfolglos: boolean;
	/**
	 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit (Migration 139,
	 * `domain/neuabstimmung.ts`). Ersetzt er den von Hand ohne Beschlussfähigkeit
	 * festgehaltenen Beschluss (`ersetzt: true`), nennt das Protokoll beide
	 * Durchgänge mit Uhrzeit und Präsenz; endete er ohne Beschluss, bleibt der
	 * frühere in Kraft.
	 *
	 * Die Zahlen sind die je Durchgang eingefrorenen Bezugsgrössen
	 * (`beteiligungDerAnwesenden`); `null` heisst, dass der Stand fehlt — dann
	 * lässt der Satz die Zahlen zu diesem Durchgang weg, statt eine Null zu
	 * behaupten.
	 */
	nachQuorum?: {
		/**
		 * Der Durchgang ohne Beschlussfähigkeit (von Hand).
		 *
		 * `angenommen` unterscheidet, ob dort ein Beschluss oder eine Ablehnung
		 * festgehalten wurde: Der Satz nennt sonst einen «Beschluss», den es nie
		 * gab (Codeprüfung 03.10.2026).
		 */
		ohneQuorum: {
			nummer: number;
			zeitpunkt: string;
			anwesend: Beteiligung | null;
			angenommen: boolean;
		};
		/**
		 * Der Durchgang nach Eintritt der Beschlussfähigkeit. `vonHandGezaehlt`:
		 * Die Präsenz ist dann die beim Zählen der Hände, nicht die beim Schluss
		 * (Migration 156, `erfasseSummen`).
		 */
		danach: {
			nummer: number;
			zeitpunkt: string;
			anwesend: Beteiligung | null;
			vonHandGezaehlt?: boolean;
		};
		/**
		 * Wie der zweite Durchgang ausging. **Nur die Annahme ersetzt** den
		 * früheren Beschluss (Rz. 202a ad Art. 712g); Ablehnung und
		 * «kein Beschluss» lassen ihn in Kraft (Rz. 207 ad Art. 712m).
		 */
		ausgang: 'angenommen' | 'abgelehnt' | 'kein_beschluss';
		/** Die Grundlage der Beschlussfähigkeit, an der es beim ersten fehlte. */
		grundlage: 'gesetz' | 'reglement';
		fundstelle: string | null;
	} | null;
	/**
	 * Das Rückkommen, das über einen Folgeantrag lief, von diesem Traktandum aus
	 * gesehen (`domain/folgeantragsersetzung.ts`; Plan Folgeantrag nach
	 * Rückkommen, Soll 6). Fehlt die Angabe, gab es keines.
	 */
	ersetzung?: Ersetzungslage | null;
	stichentscheid: {
		wer: string;
		wahl: 'yes' | 'no';
		begruendung: string | null;
		/** Die Person im Vorsitz ist selbst Stockwerkeigentümer (Migration 150). */
		eigentuemer?: boolean;
	} | null;
	/**
	 * Stimmen, die die Sitzungsleitung stellvertretend erfasst hat — mit Grund.
	 *
	 * **Warum sie ins Protokoll gehören** (gemeldet am 20.08.2026): Dass die
	 * Sitzungsleitung für eine anwesende Partei stimmen darf, ist richtig — sonst
	 * kostete ein leerer Akku eine Stimme. Ohne festgehaltenen Grund ist es aber
	 * kein Stimmrecht mehr, sondern ein Eingriff, und im Anfechtungsfall ist genau
	 * das die Frage.
	 *
	 * **Leer, wo kein Grund festgehalten wurde**, und das sind zwei Fälle:
	 *
	 *   · die einfache Betriebsart, in der die Sitzungsleitung ohnehin alle
	 *     Stimmen erfasst;
	 *   · die Papierparteien der Mischform, deren Grund am Eingang liegt.
	 *
	 * **Die Behauptung «sie steht weiter oben» war falsch** (10.09.2026
	 * nachgemessen). Hier stand, der Grund sei die Betriebsart und die stehe im
	 * Kopf des Protokolls. Sie steht dort nicht: Das Protokoll nennt die
	 * Zählweise (je Eigentümer oder je Einheit), nie die Betriebsart. Für die
	 * Mischform ist die Lücke jetzt geschlossen, der Abschnitt «Stimmabgabe»
	 * nennt die Parteien auf Papier. Für die einfache Betriebsart bleibt sie
	 * offen, und zwar nach Vorgabe: «Wenn alle von Hand abstimmen, braucht es
	 * nach mir keinen Protokolleintrag» (Auftraggeber, 09.09.2026).
	 */
	stellvertretend: { name: string; grund: string }[];
	spontan: boolean;
	/**
	 * Worauf sich ein nicht angekündigtes Geschäft stützt, das zur Abstimmung
	 * durfte, als fertiger Satz (Migration 127). Null bei allem anderen.
	 */
	ausnahmeVermerk?: string | null;
}

export interface Protokollteilnehmer {
	name: string;
	einheiten: string[];
	zustand: Anwesenheitszustand;
	/** Wer die Stimme ausübt, wenn nicht die Partei selbst. */
	vertretenDurch: string | null;
	/** Für wen diese Partei ihrerseits Vollmachten hält. */
	bevollmaechtigtFuer: string[];
	/**
	 * Vollmachten, die nicht für alle Abstimmungen galten, mit Uhrzeit (Ä-09,
	 * `vertretungszeitraeume`). Ein Eintrag ohne `bis` ist die Vertretung aus
	 * `vertretenDurch`, die erst im Lauf des Abends begann. Fehlt das Feld,
	 * galt jede Vertretung den ganzen Abend.
	 */
	vertretungszeitraeume?: Vertretungszeitraum[];
}

export interface Protokolleingabe {
	gemeinschaft: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	art: string;
	stufe: string;
	/**
	 * Der Vermerk zur Zehntagesfrist, wenn sie nicht eingehalten ist
	 * (Befund R-2b, Produktentscheid vom 23.09.2026); sonst `null`.
	 *
	 * **Er gehört in den Kopf, nicht in eine Fussnote.** Das Protokoll ist der
	 * Text, den ein Gericht liest, wenn ein Beschluss angefochten wird. Ob die
	 * Versammlung überhaupt beschliessen durfte, entscheidet sich vor dem ersten
	 * Traktandum — und steht deshalb dort, wo auch die Stufe steht.
	 */
	fristvermerk?: string | null;
	/**
	 * Wer an einer Universalversammlung als da gilt, aus der Momentaufnahme
	 * (Ä-17, `fristfolgeImProtokoll`). Fehlt es, gilt die Vorgabe «persönlich».
	 */
	universaleinstellung?: Pick<
		AusnahmenNichtangekuendigtes,
		'universalvariante' | 'leitungsvollmachtenZaehlen'
	> | null;
	/** Uhrzeit des Schlusses, wie sie festgehalten wurde. Leer, solange offen. */
	schlusszeit: string | null;
	/**
	 * Wer den Vorsitz führte und wer schrieb — beides freiwillig.
	 *
	 * Der gesetzliche Mindestinhalt sind die Beschlüsse (ZGB Art. 712n Abs. 2);
	 * der Vorsitz gehört nicht dazu. Er steht hier, weil das Protokoll
	 * unterzeichnet werden soll «durch den Verfasser und den Vorsitzenden»
	 * (SVIT-Kommentar, Wermelinger 2023, Rz. 107 ad Art. 712n; vertieft in
	 * Rz. 124: nicht gesetzlich verlangt, aber vernünftig) — und eine
	 * Unterschriftszeile ohne Namen darüber ist wertlos. Fehlt der Name, bleibt
	 * die Zeile leer wie zuvor.
	 */
	sitzungsleitung: string | null;
	protokollfuehrung: string | null;
	beschlussfaehigkeit: {
		beschlussfaehig: boolean;
		satz: string;
		kopfstimmenAnwesend: number;
		kopfstimmenGesamt: number;
		/**
		 * Die Zahl, auf der Art. 712p beruht — Personen.
		 *
		 * `null` bei Feststellungen von vor dem 26.08.2026; dort stand sie noch
		 * nicht zur Verfügung.
		 */
		eigentuemerAnwesend: number | null;
		eigentuemerGesamt: number | null;
		quotenAnwesend: number;
		gesamtquote: number;
		/**
		 * Wann und durch wen festgestellt wurde (Migration 080).
		 *
		 * Null heisst: **nicht festgehalten**. Dann stehen hier die Zahlen aus dem
		 * Moment der Protokollerstellung, und das Protokoll sagt es auch — sonst
		 * läse sich eine Rechnung wie eine Feststellung.
		 */
		festgehalten: { zeitpunkt: string; durch: string } | null;
	} | null;
	/**
	 * Weitere Feststellungen im Lauf der Versammlung (ZGB Art. 712p).
	 *
	 * Beschlussfähig ist die Versammlung nicht einmal, sondern für jeden
	 * Beschluss. Wer nach der Pause erneut feststellt, hält damit fest, dass ab
	 * jetzt andere Zahlen gelten — und genau das muss im Protokoll stehen, sonst
	 * hinge der Beschluss von halb zehn an der Feststellung von halb sieben.
	 */
	weitereFeststellungen?: {
		zeitpunkt: string;
		durch: string;
		satz: string;
		kopfstimmenAnwesend: number;
		kopfstimmenGesamt: number;
		quotenAnwesend: number;
		gesamtquote: number;
	}[];
	zaehlweise: string | null;
	stichentscheid: string | null;
	/**
	 * Der Nenner der Wertquoten aus der Momentaufnahme (`snapshot.total_quota`),
	 * meist 1000. Daraus nennt das Protokoll die Einheit der Wertquotenzahlen
	 * je Beschluss (Ä-09): «498 Ja» sagt sonst nicht, ob Tausendstel oder
	 * Hundertstel gemeint sind. Fehlt er, steht keine Einheit.
	 */
	quotennenner?: number | null;
	/**
	 * Wer an dieser Versammlung auf Papier abgestimmt hat (Migration 108).
	 *
	 * Nur die Namen, in der Reihenfolge der Anwesenheitsliste. Ob daraus ein
	 * Abschnitt wird, entscheidet `istMischform` gegen die Zahl der Parteien:
	 * Keiner auf Papier ist der Regelfall, alle auf Papier ist die
	 * Handabstimmung, und beides braucht keinen eigenen Absatz.
	 *
	 * Fehlt das Feld, verhält sich das Protokoll wie vor dem 10.09.2026.
	 */
	aufPapier?: string[];
	teilnehmer: Protokollteilnehmer[];
	zeilen: Protokollzeile[];
	/**
	 * Die Unterbrechungen des Abends (22.08.2026, Befund D-02).
	 *
	 * Sie stehen nicht unter einem Geschäft, sondern im Ablauf — deshalb eine
	 * eigene Liste. Im Protokoll fehlten sie ganz, obwohl eine Pause den Abend
	 * ebenso prägt wie ein Beschluss: Wer eine halbe Stunde nicht im Saal war,
	 * findet hier, was in dieser Zeit nicht geschah.
	 */
	unterbrechungen?: {
		art: 'unterbrochen' | 'fortgesetzt';
		zeitpunkt: string;
		text: string | null;
	}[];
	/** Steht am Schluss, wenn Absätze maschinell vorbereitet wurden (FR-63). */
	maschinenvermerk?: string | null;
	/** Wer den Entwurf erzeugt hat und wann — der Kern liest keine Uhr. */
	erzeugtAm: string;
	erzeugtDurch: string;
	/**
	 * Das Siegel des Abschlusspakets, wenn eines besteht (22.08.2026).
	 *
	 * **Wozu es im Protokoll steht.** Das Protokoll geht an alle Eigentümer.
	 * Steht der Abdruck darin, halten danach so viele Menschen eine Kopie davon,
	 * wie die Gemeinschaft Mitglieder hat — jeder mit einem eigenen
	 * Empfangszeitpunkt, den die Bewirtschaftung nicht in der Hand hat. Wer
	 * später ein anderes Paket vorlegt, müsste alle diese Kopien erklären. Das
	 * ist beweisrechtlich mehr wert als der Zeitstempel selbst, denn eine
	 * Bestreitung der Echtheit muss «ausreichend begründet» werden (ZPO
	 * Art. 178).
	 *
	 * **Und es rettet die Bezeugung.** Die Antwort des Zeitstempeldienstes liegt
	 * sonst nur im Paket: Geht das Paket verloren, stirbt der Beweis mit der
	 * Sache, die er beweisen soll. Im Protokoll überlebt die Aussage.
	 */
	siegel?: Protokollsiegel | null;
}

export interface Protokollsiegel {
	/** SHA-256 über das Manifest — der Wert, auf den auch der Zeitstempel lautet. */
	abdruck: string;
	/** Bezeugter Zeitpunkt, falls der Zeitstempel vorliegt. */
	bezeugtAm?: string | null;
	/** Name des Zeitstempeldienstes. */
	stelle?: string | null;
	/** SHA-256 über die Antwort des Dienstes. */
	bezeugungAbdruck?: string | null;
}

/** «19:30» aus einer Zeitangabe, die auch Sekunden tragen kann. */
function uhrzeit(wert: string): string {
	return wert.slice(0, 5);
}

/**
 * Die Zeilen zu den unmittelbar Betroffenen unter einem Beschluss (Block A3a,
 * 26.09.2026), ohne Aufzählungszeichen.
 *
 * **Eine Stelle für Haus und Abend.** Das Protokoll des gemeinsamen Abends
 * hatte bis hierher keine dieser Zeilen; eine Zustimmung im Ausstand oder
 * eine fehlende Zustimmung hinterliess dort keine Spur (Laienprüfung Runde 10
 * zum Veto, im Code bestätigt). Zwei Fassungen desselben Absatzes liefen
 * auseinander, deshalb bauen beide Protokolle mit dieser Funktion.
 *
 * **Die Norm kommt aus der Form**, nicht fest «712g Abs. 4»: Bei den
 * Wertquoten (Art. 712e Abs. 2) fehlt keine Zustimmung im Saal, sie steht
 * aus, und die Zeilen dazu fehlten ganz (Plan A3, `docs/freigabe.md`,
 * «Gebaut, A1», offen (a)).
 */
export function betroffenenzeilen(
	t: Pick<
		Protokollzeile,
		| 'ohneZustimmung'
		| 'veto'
		| 'zustimmungsform'
		| 'vorabZugestimmt'
		| 'ausstehend'
		| 'ausstehendNutzniessung'
		| 'geheim'
	> & {
		/** Am Abend statt der Namen: wie viele Veto-Entscheide Ja und Nein lauten. */
		vetoAnzahl?: { ja: number; nein: number };
	},
	/*
	 * **Ohne Vorgabe** (Codeprüfung A3a): Mit `namentlich: true` als Vorgabe gäbe
	 * ein Aufruf, der das Argument beim Umbau verliert, am Abend Namen aus, und
	 * keine Probe merkte es. So muss jeder Aufrufer sagen, welche Fassung er will.
	 */
	art: { namentlich: boolean }
): string[] {
	const z: string[] = [];
	const nachher = t.zustimmungsform === 'nachher';
	/*
	 * **Der Platzhalter ist kein Name** (28.08.2026, zweiter Code-Review).
	 * Steht eine als betroffen bezeichnete Partei gar nicht im festgehaltenen
	 * Stand, trägt der Befund dort `NICHT_IM_STAND`; in einer Zeile, die sagen
	 * soll, bei wem nachzufragen ist, wäre das eine Verlegenheitsangabe. Sie
	 * bekommt eine eigene Zeile, die den Zustand benennt.
	 */
	const liste = nachher ? (t.ausstehend ?? []) : t.ohneZustimmung;
	const benannt = liste.filter((n) => n !== NICHT_IM_STAND);
	const unbenannt = liste.length - benannt.length;
	const vorab = nachher ? [] : (t.vorabZugestimmt ?? []);
	/*
	 * **Wer ausser den Eigentümern zustimmen muss** (Fachprüfung A3a, Rz. 78,
	 * 79 und 88 ad Art. 712e): Die Zeile tritt sonst als vollständige Liste
	 * auf, und die Verwaltung bereitete den Termin beim Notar ohne die Banken
	 * vor. Wortlaut aus dem Freigabevermerk der Fassung 2026-09-28.
	 */
	const auchDritte =
		'Zustimmen müssen zudem die Grundpfandgläubiger der Einheiten, deren Quote sich ändert (in ' +
		'der Regel die Bank mit der Hypothek); ' +
		'welche weiteren dinglich Berechtigten zustimmen müssen, klärt der Notar.';
	/*
	 * **Die Nutzniesser an Einheiten der Betroffenen** (Produktentscheid
	 * 03.11.2026; SVIT-Kommentar 2023, Art. 712e Rz. 80, 88): Ihre schriftliche
	 * Zustimmung braucht das Grundbuch, wenn sich die Quote ihrer Einheit
	 * ändert. Eine Stimme im Saal ist sie nicht. «Wenn», weil Votum die
	 * Betroffenen als Parteien kennt, nicht die Einheiten mit geänderter Quote.
	 */
	const nutzniessung = nachher ? (t.ausstehendNutzniessung ?? []) : [];

	if (art.namentlich) {
		// Laienprüfung A3a, P1: «steht aus, mit der Unterschrift» las sich, als
		// fehle die Unterschrift zusätzlich; jetzt sagt der Satz, wie sie erteilt wird.
		if (nachher && benannt.length > 0) {
			z.push(
				'Noch aus steht die Zustimmung nach ZGB Art. 712e Abs. 2; sie wird mit der ' +
					`Unterschrift auf der Abänderungsurkunde erteilt: ${benannt.join(', ')}. ${auchDritte}`
			);
		} else if (benannt.length > 0) {
			/*
			 * Bei geheimer Abstimmung zählt nur die offene Erklärung (Ä-38); der
			 * Satz sagt das, sonst läse man den Namen als «hat Nein gestimmt»
			 * (Laienprüfung 16.10.2026, Runde 2).
			 */
			z.push(
				t.geheim
					? `Ohne offen erklärte Zustimmung nach ZGB Art. 712g Abs. 4: ${benannt.join(', ')}`
					: `Ohne die nach ZGB Art. 712g Abs. 4 nötige Zustimmung: ${benannt.join(', ')}`
			);
		}
		if (nutzniessung.length > 0) {
			z.push(
				'Für das Grundbuch steht zudem die schriftliche Zustimmung der nutzniessenden ' +
					`${nutzniessung.length === 1 ? 'Person' : 'Personen'} aus, wenn sich die Quote ` +
					`ihrer Einheit ändert: ${nutzniessung.join(', ')}`
			);
		}
		if (vorab.length > 0) z.push(`Vorab schriftlich zugestimmt: ${vorab.join('; ')}`);
		/*
		 * **Das Veto ist der Nachweis der Zustimmung** (26.09.2026). Wer im
		 * Ausstand ist, stimmt nicht mit; trägt der Beschluss trotzdem, steht
		 * hier, woher die Zustimmung kam und auf welchem Weg. «Entscheid im
		 * Ausstand» las sich wie ein Widerspruch (Laienprüfung Runde 9, Stelle 7).
		 */
		if (t.veto && t.veto.length > 0) {
			z.push(
				'Entscheid der Betroffenen im Ausstand über die Zustimmung (ohne Stimme bei der ' +
					`Mehrheit): ${t.veto.join('; ')}`
			);
		}
	} else {
		/*
		 * **Am gemeinsamen Abend ohne Namen** (10.09.2026, Sicherheitsdurchgang
		 * zum Abenddokument): Es geht an die Eigentümer aller beteiligten
		 * Gemeinschaften, und ein Name darin läge danach in jedem anderen Haus.
		 *
		 * **Als Rechnung geordnet** (Laienprüfung A3a): Erst was vorliegt, dann
		 * was fehlt. Stand «fehlt bei 1» vor «1 nicht zugestimmt», las man zwei
		 * Parteien, wo es eine war.
		 */
		const parteien = (n: number) => `${zahl(n)} betroffenen ${n === 1 ? 'Partei' : 'Parteien'}`;
		const ja = t.vetoAnzahl?.ja ?? 0;
		const nein = t.vetoAnzahl?.nein ?? 0;
		if (vorab.length > 0) {
			z.push(
				`${zahl(vorab.length)} betroffene ${vorab.length === 1 ? 'Partei hat' : 'Parteien haben'} ` +
					'vorab schriftlich zugestimmt.'
			);
		}
		if (ja + nein > 0) {
			z.push(
				'Betroffene im Ausstand (ohne Stimme bei der Mehrheit) haben gesondert erklärt, ob sie ' +
					`zustimmen: ${zahl(ja)} ja, ${zahl(nein)} nein.`
			);
		}
		if (nachher && benannt.length > 0) {
			z.push(
				`Bei ${parteien(benannt.length)} steht die Zustimmung nach ZGB Art. 712e Abs. 2 noch ` +
					`aus; sie wird mit der Unterschrift auf der Abänderungsurkunde erteilt. ${auchDritte}`
			);
		} else if (benannt.length > 0) {
			// «Insgesamt»: Die Zahl schliesst ein Nein im Ausstand ein; ohne das Wort
			// las man eine weitere Partei (Laienprüfung A3a, Runde 2).
			z.push(
				`Insgesamt fehlt die nach ZGB Art. 712g Abs. 4 nötige Zustimmung bei ${parteien(benannt.length)}.`
			);
		}
		if (nutzniessung.length > 0) {
			const eine = nutzniessung.length === 1;
			z.push(
				`An ${zahl(nutzniessung.length)} ${eine ? 'Einheit' : 'Einheiten'} der Betroffenen ist ` +
					`eine Nutzniessung erfasst. Ändert sich ${eine ? 'ihre' : 'deren'} Quote, steht für ` +
					'das Grundbuch auch die schriftliche Zustimmung der nutzniessenden ' +
					`${eine ? 'Person' : 'Personen'} aus; wer das ist, weiss die Verwaltung.`
			);
		}
		if (benannt.length > 0 || vorab.length > 0 || ja + nein > 0) {
			z.push(
				'Die Namen stehen in der Auswertung der jeweiligen Gemeinschaft; einsehen lässt sie sich ' +
					'bei der Verwaltung.'
			);
		}
	}
	if (unbenannt > 0) {
		// Laienprüfung A3a, P2: «unterzeichnen muss» las sich als Pflicht; die
		// Fachprüfung riet zu «Stockwerkanteil» statt «Recht».
		z.push(
			`${zahl(unbenannt)} als unmittelbar betroffen bezeichnete ` +
				`${unbenannt === 1 ? 'Partei steht' : 'Parteien stehen'} nicht im ` +
				'festgehaltenen Stand der Stimmberechtigten' +
				(nachher
					? ', etwa nach einem Verkauf. Die Unterschrift auf der Abänderungsurkunde muss von ' +
						'der Person kommen, der der Stockwerkanteil bei der Unterzeichnung gehört. Um ' +
						'welche Einheit es geht, klärt die Verwaltung.'
					: '; die Zustimmung liess sich nicht prüfen.')
		);
	}
	return z;
}

function zahl(n: number): string {
	return n.toLocaleString('de-CH');
}

/**
 * Die Anwesenheitszeile einer Partei.
 *
 * Der Zustand steht dabei, nicht nur der Name: «anwesend» und «gegangen» sind
 * für die Beschlussfähigkeit verschiedene Dinge, und wer das Protokoll liest,
 * muss sehen können, dass jemand um 20:15 ging.
 */
function teilnehmerzeile(t: Protokollteilnehmer): string {
	const teile = [t.name];
	if (t.einheiten.length > 0) teile.push(`(${t.einheiten.join(', ')})`);
	/*
	 * **Die Vertretung mit ihrem Zeitraum** (Ä-09, Produktentscheid
	 * 16.10.2026): Die Liste zeigt den Stand am Schluss. Galt eine Vollmacht
	 * nur für einen Teil der Abstimmungen, stehen die Traktanden und die
	 * Uhrzeit dabei, damit sich jeder Beschluss der richtigen Vertretung
	 * zuordnen lässt.
	 */
	teile.push(...zeitraeumeInWorten(t));
	if (t.vertretenDurch) {
		const spaet = (t.vertretungszeitraeume ?? []).find(
			(v) => v.bis === null && v.ab && v.durch === t.vertretenDurch
		);
		teile.push(
			`— vertreten durch ${t.vertretenDurch}` + (spaet ? ` ${zeitraumInWorten(spaet)}` : '')
		);
	}
	if (t.bevollmaechtigtFuer.length > 0) {
		teile.push(`— bevollmächtigt für ${t.bevollmaechtigtFuer.join(', ')}`);
	}
	/*
	 * **Ein Zustand statt einer Handlung, wo eine Vertretung endete** (Laien-
	 * und Fachprüfung 16.10.2026, Runde 3). Endet eine Vertretung, auf der die
	 * Anwesenheit beruhte, steht die Partei auf «gegangen», auch wenn sie nie
	 * selbst im Saal war. «Hat verlassen» legte das nahe. Die Anwendung kann
	 * hier nicht unterscheiden, ob die Person später selbst kam und wieder
	 * ging; der Satz unten stimmt in beiden Fällen. Ohne beendete Vertretung
	 * bleibt der bisherige.
	 */
	if (t.zustand === 'gegangen') {
		teile.push(
			(t.vertretungszeitraeume ?? []).some((v) => v.ende === 'beendet')
				? '— am Schluss weder anwesend noch vertreten'
				: '— hat die Versammlung vorzeitig verlassen'
		);
	}
	return `- ${teile.join(' ')}`;
}

/**
 * Die beendeten Vertretungen einer Partei, je als «— vertreten durch X bei
 * Traktanden 1 bis 3 (bis 20:15 Uhr)» (Ä-09). Die laufende steht bei
 * `vertretenDurch`.
 */
function zeitraeumeInWorten(
	t: Pick<Protokollteilnehmer, 'vertretungszeitraeume'>
): string[] {
	return (t.vertretungszeitraeume ?? [])
		.filter((v) => v.bis !== null)
		.map((v) => `— vertreten durch ${v.durch} ${zeitraumInWorten(v)}`);
}

/**
 * «bei den Traktanden 1, 2 und 4 (bis 20:15 Uhr, danach selbst anwesend)».
 * **Die Traktanden zuerst**,
 * weil sie den Beschluss der Vertretung zuordnen; die Uhrzeit sagt, wann sie
 * begann oder endete (Laien- und Fachprüfung 16.10.2026).
 */
function zeitraumInWorten(v: Vertretungszeitraum): string {
	const uhr =
		v.ab && v.bis
			? `von ${uhrzeitAusZeitpunkt(v.ab)} bis ${uhrzeitAusZeitpunkt(v.bis)} Uhr`
			: v.bis
				? `bis ${uhrzeitAusZeitpunkt(v.bis)} Uhr`
				: `ab ${uhrzeitAusZeitpunkt(v.ab!)} Uhr`;
	/*
	 * Was nach dem Ende galt (Laienprüfung 16.10.2026, Runde 2). **Nicht
	 * «Vollmacht beendet»** (Fachprüfung Runde 3): Das behauptete einen
	 * Widerruf durch die vertretene Person (OR Art. 34), und den kennt die
	 * Anwendung nicht; sie hält nur fest, dass die Vertretung endete.
	 */
	const danach =
		v.ende === 'selbst_erschienen'
			? ', danach selbst anwesend'
			: v.ende === 'beendet'
				? ', danach nicht mehr vertreten'
				: '';
	const n = v.traktanden;
	if (n.length === 0) return `(${uhr}${danach})`;
	const liste =
		n.length === 1
			? `bei Traktandum ${n[0]}`
			: `bei den Traktanden ${n.slice(0, -1).join(', ')} und ${n[n.length - 1]}`;
	return `${liste} (${uhr}${danach})`;
}

/**
 * Die Einheit der Wertquotenzahlen aus dem Nenner (Ä-09). Die drei üblichen
 * Nenner (`NENNER_VORSCHLAEGE`) mit Namen, jeder andere als Bruchteil.
 */
export function quoteneinheit(nenner: number): string {
	if (nenner === 1000) return 'Tausendstel';
	if (nenner === 100) return 'Hundertstel';
	if (nenner === 10000) return 'Zehntausendstel';
	return `Anteile von ${zahl(nenner)}`;
}

/**
 * «Berechnungsregeln der Software Votum, Stand 18. Oktober 2026.» (Ä-09).
 *
 * **Nicht «Regelwerk von Votum»** (Laien- und Fachprüfung 16.10.2026): Das
 * las sich als verbindliche Regel neben dem Reglement, und wer nicht weiss,
 * dass Votum ein Programm ist, hielt es für ein Dokument, das er nie bekam.
 * Massgebend sind Gesetz und Reglement; die Angabe dient der
 * Nachvollziehbarkeit (Rz. 131 ad Art. 712n).
 */
export function regelfassungSatz(fassung: string): string {
	return `Berechnungsregeln der Software Votum, Stand ${datumLang(fassung)}.`;
}

const ZUSTANDSRANG: Record<Anwesenheitszustand, number> = {
	anwesend: 0,
	gegangen: 1,
	wartet: 2,
	nicht_erschienen: 3
};

/**
 * Die Bedingung des letzten Zweigs von `protokollentwurf`: Votum führt zu
 * diesem Traktandum kein Ergebnis.
 *
 * **Eine Stelle für Protokoll und Server.** Der Text setzt dort den Satz
 * «Über diesen Antrag wurde nicht abgestimmt.»; `setzeBeschlussvermerk` lässt
 * den Beschlussvermerk (Block 7) nur zu, wo genau diese Lage vorliegt. Zwei
 * Fassungen derselben Bedingung liefen beim ersten neuen Zweig auseinander;
 * wer in der Kette unten einen Zweig einzieht, zieht ihn hier nach.
 *
 * `zahlen` und `neuabstimmungOffen` werden nur auf Vorhandensein geprüft — so
 * passt dieselbe Funktion auf die fertige `Protokollzeile` und auf die
 * Auswertungszeile, aus der der Server die Lage liest.
 */
export function ohneErgebnis(t: {
	art: string;
	rueckzug: string | null;
	satz: string | null;
	zahlen: unknown;
	ersetzung?: Ersetzungslage | null;
	neuabstimmungOffen?: unknown;
	folgeantraegeAngenommen: { nummer: string; titel: string }[] | null;
	teileEntschieden?: unknown[] | null;
}): boolean {
	return (
		t.art !== 'kenntnisnahme' &&
		!t.rueckzug &&
		!(t.satz && t.zahlen) &&
		!(t.ersetzung && !t.neuabstimmungOffen) &&
		!t.folgeantraegeAngenommen &&
		!(t.teileEntschieden && t.teileEntschieden.length > 0) &&
		!t.neuabstimmungOffen
	);
}

/**
 * Der Satz beim Antrag, über den nicht abgestimmt wurde, weil Folgeanträge zu
 * ihm angenommen sind.
 *
 * **«Folgeantrag», nicht «Gegenantrag»** (Entscheid 0045, Punkt 9, beim Bau
 * geklärt 07.11.2026): Das Protokoll lesen die Eigentümer, und ein Antrag, der
 * nur einen Teil herauslöst, etwa die Wahl, ist kein Gegenantrag. Die Maske
 * der Leitung heisst den Knopf weiter «Gegenantrag». Mehrere stehen in der
 * Folge ihrer Nummern, mit «und» vor dem letzten.
 */
export function folgeantraegeAngenommenSatz(f: { nummer: string; titel: string }[]): string {
	const je = [...f]
		.sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }))
		.map((x) => `${x.nummer} «${x.titel}»`);
	const liste = je.length === 1 ? `den Folgeantrag ${je[0]}` : `die Folgeanträge ${je.slice(0, -1).join(', ')} und ${je[je.length - 1]}`;
	return (
		`Über diesen Antrag wurde nicht abgestimmt: Die Versammlung hat ${liste} angenommen. ` +
		'Der ursprüngliche Antrag ist damit gegenstandslos.'
	);
}

/**
 * Der Satz beim Grundantrag, den Votum unter dem Häkchen gesperrt hat, wenn
 * keiner der entschiedenen Folgeanträge zur Wahl oder Abberufung angenommen
 * ist (Entscheid 0045, Punkt 9; Codeprüfung P9, M-2). Er sagt, warum nicht
 * abgestimmt wurde, wie der Satz zu den angenommenen.
 */
export function teileEntschiedenSatz(
	teile: { nummer: string; titel: string; art: 'wahl' | 'abberufung' }[]
): string {
	const je = [...teile]
		.sort((a, b) => a.nummer.localeCompare(b.nummer, 'de', { numeric: true }))
		.map((x) => `${x.nummer} «${x.titel}»`);
	// Codeprüfung P9, N-M1: die Art aus allen, nicht nur dem ersten.
	const arten = new Set(teile.map((x) => x.art));
	const was =
		arten.size > 1 ? 'die Wahl und die Abberufung' : arten.has('abberufung') ? 'die Abberufung' : 'die Wahl';
	const wo =
		je.length === 1 ? `im Folgeantrag ${je[0]}` : `in den Folgeanträgen ${je.slice(0, -1).join(', ')} und ${je[je.length - 1]}`;
	return (
		`Über diesen Antrag wurde nicht abgestimmt: Er enthält ${was} der Verwaltung, über die die ` +
		`Versammlung ${wo} entschieden hat.`
	);
}


/**
 * Der Satz am Haken auf der Protokollseite (Block 7).
 *
 * **Im Kern, nicht in der Seite** (Auftrag): Derselbe Satz erklärt drinnen,
 * was der Haken bedeutet, und die Abnahme lässt ihn durch die Laien- und
 * Fachprüfung gehen. Zwei Fassungen an zwei Orten wären zwei Wahrheiten.
 */
export const BESCHLUSSVERMERK_TEXT =
	'Dieser Text hält einen Beschluss fest, angenommen oder abgelehnt. Abgestimmt wurde von Hand, ohne Votum.';

/**
 * Der Vermerk zur geheimen Abstimmung im Protokoll (Migration 141,
 * Produktentscheid 28.09.2026: «Vermerk auf geheime Abstimmung im Protokoll»).
 *
 * Er tritt an die Stelle des Zahlenspiegels. Der Satz darüber sagt nur
 * «erreicht» oder «nicht erreicht»; der Vermerk erklärt, wo die Einzelstimmen
 * liegen. Er nennt keine Zahl und keine Person.
 */
export const GEHEIM_VERMERK =
	'Die Einzelstimmen stehen auf dem Stimmnachweisblatt im Abschlusspaket, das die Verwaltung ' +
	'aufbewahrt; im Protokoll steht nichts, was sie zuordnet.';

/** Die Grundlage der geheimen Abstimmung im Protokoll (Ä-38, Punkt 8, Migration 165). */
export const GEHEIM_BESCHLUSS_SATZ =
	'Die Versammlung hat zuvor offen beschlossen, über diesen Antrag geheim abzustimmen.';

/** Die zweite Grundlage (Migration 166). */
export const GEHEIM_REGLEMENT_SATZ =
	'Das Reglement der Gemeinschaft sieht die geheime Abstimmung hier vor.';

/**
 * Die Sätze zur Grundlage, was angekreuzt war, in fester Folge (Ä-38,
 * Produktentscheid 16.10.2026: «Warum nicht beides?»). Leer bei Durchgängen
 * von vor Migration 165: Dort behauptet das Protokoll keine Grundlage.
 * Haus und Abend rufen dieselbe Funktion.
 */
export function geheimGrundlage(t: {
	geheimBeschlossen?: boolean;
	geheimNachReglement?: boolean;
}): string[] {
	return [
		...(t.geheimBeschlossen ? [GEHEIM_BESCHLUSS_SATZ] : []),
		...(t.geheimNachReglement ? [GEHEIM_REGLEMENT_SATZ] : [])
	];
}

/**
 * Was die Auswertung beim Traktandum mit Beschlussvermerk schreibt, statt «Es
 * wurde nicht abgestimmt.» (Block 7b, Produktentscheid 02.10.2026: «ok, ja»).
 *
 * **Keine Zahlen, kein Ausgang.** Votum kennt beides nicht; was beschlossen
 * wurde, steht allein im Text der Leitung. Seite und PDF lesen diese eine
 * Konstante.
 *
 * **Der Satz sagt nur, was der Haken erklärt** (`BESCHLUSSVERMERK_TEXT`): von
 * Hand abgestimmt, angenommen oder abgelehnt. Der Entwurf des Auftrags lautete
 * «Votum führt zu diesem Traktandum kein Ergebnis; der Beschluss steht im
 * Protokoll.» und fiel in der Prüfung vom 02.10.2026 durch: Die Auswertung
 * geht an alle Eigentümer, und wer nur das Blatt hat, kennt «Votum» als
 * Stimmabgabe, nicht als Anwendung, und liest «der Beschluss» als
 * «angenommen» (Laienprüfung); «der Beschluss» behauptet zudem das
 * Zustandekommen (Fachprüfung). Bericht:
 * `quellen/pruefung/berichte/2026-10-02-votum-beschlussvermerk-block-7b.md`.
 *
 * **Ungeprüft bleibt «steht im Protokoll».** Votum weiss nicht, ob der Text in
 * der Fassung steht, die verschickt wird; besteht schon ein Entwurf, trägt die
 * Leitung ihn dort von Hand nach. Das Handbuch nennt die Handlung dazu.
 */
export const AUSWERTUNG_VON_HAND_ABGESTIMMT =
	'Über diesen Antrag wurde von Hand abgestimmt. Diese Auswertung enthält dazu weder Zahlen noch ' +
	'Ergebnis. Ob der Antrag angenommen oder abgelehnt wurde, steht im Protokoll der Versammlung.';

/**
 * Weg und Frist der Anfechtung, einmal je Protokoll (A5, Punkt 2; Laienprüfung
 * Block 5, L5-16 und R2-8). Das Protokoll setzt für Abwesende die Frist in Gang
 * (Rz. 230 ad Art. 712m). Auch im gemeinsamen Protokoll.
 */
export const ANFECHTUNG_IM_PROTOKOLL =
	'Verletzt ein Beschluss Gesetz oder Reglement, kann er beim Gericht angefochten werden, innert ' +
	'eines Monats, seit man davon weiss (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Bei einem angenommenen ' +
	'Antrag kann das, wer nicht zugestimmt hat; bei einem abgelehnten, wer nicht Nein gestimmt hat ' +
	'(Schluss aus ZGB Art. 75; vgl. SVIT-Kommentar Rz. 235a ad Art. 712m und Rz. 49 ad Art. 712r). Das Gericht hebt eine Ablehnung in der Regel nur auf; ' +
	'angenommen ist der Antrag damit nicht. Wer anwesend oder vertreten war, rechnet ab der ' +
	'Versammlung. Wer weder da noch vertreten war, erfährt es in der Regel mit diesem Protokoll; dann ' +
	'beginnt die Frist mit dessen Erhalt. Wer es vorher vollständig erfahren hat, rechnet ab dann ' +
	'(Rz. 230 ad Art. 712m).';

/** Wo Weg oder Frist anders laufen als im Satz oben (Fachprüfung A5, Befunde B und C). */
export type Anfechtungssonderfall = 'abberufung' | 'einsprache';

/** Der Abschnitt, mit den Sätzen zu den Sonderfällen, die in diesem Protokoll vorkommen. */
export function anfechtungsabschnitt(sonderfaelle: readonly (Anfechtungssonderfall | null | undefined)[]): string {
	return (
		ANFECHTUNG_IM_PROTOKOLL +
		(sonderfaelle.includes('abberufung')
			? '\n\nAnders bei einer abgelehnten Abberufung der Verwaltung: Wer sie wegen wichtiger Gründe ' +
				'beim Gericht verlangt, klagt innert eines Monats (ZGB Art. 712r Abs. 2). Das kann nur, wer nicht ' +
				'gegen die Abberufung gestimmt hat. Nach dem SVIT-Kommentar läuft die Frist ab der Versammlung, auch für Abwesende ' +
				'(Rz. 54 ad Art. 712r).'
			: '') +
		(sonderfaelle.includes('einsprache')
			? '\n\nFür die Einsprache selbst läuft eine eigene, kürzere Frist. Die Einsprache muss innert ' +
				'14 Tagen seit der ersten Mitteilung des Vertrags beim Eigentümer sein, der verkauft, vermietet ' +
				'oder belastet (ZGB Art. 712c Abs. 2, Rz. 190). Auf die Monatsfrist ' +
				'darf sie nicht warten. Ob ein Fehler bei der Zählung danach noch angefochten werden kann, ist ' +
				'nicht geklärt.'
			: '')
	);
}

/** Ob ein Ergebnissatz einen Beschluss festhält, nicht sein Ausbleiben. */
export function zeigtBeschluss(satz: string | null | undefined): boolean {
	return !!satz && !satz.startsWith('Kein Beschluss') && !satz.startsWith('Stimmengleichheit');
}

/**
 * Die Zeilen zu L8 an einem Beschluss, nur unter «Vollmachten ruhen» (die
 * Bedingungen rechnet `l8Zeilenlage` in der Schale): die Wahl und die
 * Abberufung trotz Häkchen, die Angabe der Leitung am Folgeantrag mit ihrem
 * Grund. **Eine Stelle für das Hausprotokoll und das gemeinsame
 * Abenddokument** (Codeprüfung P11, H1, 08.11.2026): Am gemeinsamen Abend
 * ist das Abenddokument das Protokoll, und die Zeilen fehlten dort.
 */
export function l8Protokollzeilen(
	t: Pick<
		Protokollzeile,
		'wahlTrotzHaekchen' | 'abberufungTrotzHaekchen' | 'abberufungAusstandErklaert' | 'verwaltungsangabe'
	>
): string[] {
	const zeilen: string[] = [];
	if (t.wahlTrotzHaekchen) zeilen.push(VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL);
	if (t.abberufungTrotzHaekchen) {
		zeilen.push(
			t.abberufungAusstandErklaert
				? VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL
				: VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL
		);
	}
	if (t.verwaltungsangabe) {
		zeilen.push(verwaltungsangabeProtokollsatz(t.verwaltungsangabe.grund, t.verwaltungsangabe.ausstandErklaert));
	}
	return zeilen;
}

/**
 * Der Hinweis vor dem Versiegeln (Block 7c, auf Anweisung des Auftraggebers
 * vom 02.10.2026 nach Block 7b).
 *
 * **Der Anlass.** `Auswertung.pdf` im Abschlusspaket entsteht einmal, beim
 * Versiegeln. Der Beschlussvermerk lässt sich danach noch setzen, das Blatt im
 * Paket folgt ihm nicht mehr und sagt dauerhaft «Es wurde nicht abgestimmt.»
 * neben einem Protokoll mit Beschluss. Das Handbuch rät deshalb zum Haken vor
 * dem Versiegeln; dieser Satz sagt es dort, wo versiegelt wird.
 *
 * **Er hält nichts auf.** Eine Abstimmung ohne Ergebnis ist kein Fehler: Ein
 * vertagter oder nie aufgerufener Antrag hat keines. Der Satz nennt deshalb
 * zuerst den Fall, in dem nichts zu tun ist.
 *
 * Im Kern, weil ihn zwei Seiten lesen: das Siegel der Versammlung und das
 * Siegel des Abends. `titel` sind die Abstimmungen ohne Ergebnis und ohne
 * Vermerk, in der Reihenfolge der Traktandenliste; leer heisst kein Hinweis.
 */
export function hinweisVorDemVersiegeln(titel: string[]): string | null {
	if (titel.length === 0) return null;
	const GENANNT = 4;
	const liste = titel
		.slice(0, GENANNT)
		.map((t) => `«${t}»`)
		.join(', ');
	const rest = titel.length - GENANNT;
	const folge =
		'Die Auswertung im Abschlusspaket entsteht beim Versiegeln und lässt sich danach nicht ' +
		'mehr ändern; ohne Haken steht dort «Es wurde nicht abgestimmt.».';
	/*
	 * **Die Entwarnung vor der Handlung, und drei Fälle statt zwei**
	 * (Laienprüfung 02.10.2026). Zuerst stand die Entwarnung am Schluss; wer
	 * nichts nachzutragen hatte, las drei Sätze über einen unumkehrbaren
	 * Schritt, bevor er erfuhr, dass sie ihn nicht betreffen. «Und halten Sie
	 * den Beschluss fest»: Wer bewusst keinen Beschluss festhält, setzt den
	 * Haken nicht (Handbuch), auch wenn von Hand abgestimmt wurde.
	 */
	if (titel.length === 1) {
		return (
			`Zu ${liste} ist in Votum kein Ergebnis festgehalten. Wurde darüber gar nicht ` +
			'abgestimmt, etwa weil der Antrag vertagt wurde, ist nichts zu tun. Wurde von Hand ' +
			'abgestimmt und halten Sie den Beschluss fest, tragen Sie ihn vor dem Versiegeln im ' +
			`Protokoll bei «Voten» ein und setzen Sie den Haken darunter. ${folge}`
		);
	}
	// «Einzelne davon»: Bei mehreren ist der gemischte Fall die Regel, und
	// «darüber» las sich als alle oder keine (Laienprüfung).
	return (
		`Zu ${titel.length} Abstimmungen ist in Votum kein Ergebnis festgehalten: ${liste}` +
		(rest > 0
			? ` und ${rest === 1 ? 'eine weitere' : `${rest} weitere`}. Gemeint sind die ` +
				'Traktanden, bei denen im Protokoll unter «Voten» der Haken angeboten wird. '
			: '. ') +
		'Wurde über einzelne davon von Hand abgestimmt und halten Sie den Beschluss fest, tragen ' +
		'Sie ihn vor dem Versiegeln im Protokoll bei «Voten» ein und setzen Sie je den Haken. ' +
		`Für die übrigen, etwa vertagte Anträge, ist nichts zu tun. ${folge}`
	);
}

export function protokollentwurf(e: Protokolleingabe): string {
	const z: string[] = [];

	/*
	 * ── Kopf ──────────────────────────────────────────────────────────────
	 *
	 * **Als Tabelle, nicht als Aufzählung** (Auftraggeber, 03.09.2026, mit einer
	 * Word-Vorlage: «Struktur im Sinne von hier. Das wäre meine Vorstellung.»).
	 * Seine Vorlage führt den Kopf als zweispaltige Tabelle — Bezeichnung links,
	 * Wert rechts — mit Betreff, Datum/Zeit, Ort, Teilnehmenden, Entschuldigten
	 * und der Protokollführung.
	 *
	 * Das ist die übliche Form eines Sitzungsprotokolls, und sie leistet, was
	 * eine Aufzählung nicht leistet: Die Werte stehen untereinander an derselben
	 * Kante, und man findet ein Feld, ohne zu lesen.
	 *
	 * **Datum und Beginn in einer Zeile**, wie in der Vorlage («Datum/Zeit:
	 * dd.mm.yyyy / hh:MM Uhr»): Zwei Zeilen für eine Angabe waren der Anfang
	 * der Lücken, über die der Auftraggeber gestolpert ist.
	 */
	z.push(`# Protokoll der ${e.art === 'ausserordentlich' ? 'ausserordentlichen ' : ''}Versammlung`);
	z.push('');
	z.push(`| Gemeinschaft | ${e.gemeinschaft} |`);
	z.push(`| Datum, Beginn | ${datumLang(e.datum)}, ${uhrzeit(e.uhrzeit)} Uhr |`);
	z.push(`| Ort | ${e.ort} |`);
	if (e.stufe === 'zweite') {
		z.push('| Stufe | Zweite Versammlung nach ZGB 712p Abs. 3 |');
	}
	/*
	 * Unmittelbar unter der Stufe, weil er nur dort eine Bedeutung hat und die
	 * Angabe darüber erst vollständig macht: «zweite Versammlung» allein liest
	 * sich wie eine ordnungsgemässe.
	 *
	 * **Die Beschriftung trägt das Ergebnis, nicht das Thema** (Laienprüfung
	 * vom 24.09.2026, Befund B9). «Frist» allein sah zwischen «Gemeinschaft»,
	 * «Ort» und «Vorsitz» aus wie ein weiteres Stammdatenfeld und konnte
	 * ebenso gut «Einladungsfrist: eingehalten» heissen. Dass die Zeile nur
	 * existiert, wenn etwas nicht stimmt, sieht ihr niemand an — schon gar
	 * nicht, wer das Protokoll ein Jahr später ohne Vergleichsstück liest.
	 */
	if (e.fristvermerk) {
		z.push(
			`| Frist nicht eingehalten | ${fristvermerkImProtokoll(e.fristvermerk, e.universaleinstellung ?? null)} |`
		);
	}
	if (e.sitzungsleitung) z.push(`| Vorsitz | ${e.sitzungsleitung} |`);
	if (e.protokollfuehrung) z.push(`| Protokollführung | ${e.protokollfuehrung} |`);
	z.push('');

	// ── Anwesenheit ─────────────────────────────────────────────────────────
	z.push('## Anwesenheit und Vertretung');
	z.push('');
	const anwesende = e.teilnehmer
		.filter((t) => t.zustand === 'anwesend' || t.zustand === 'gegangen')
		.sort((a, b) => ZUSTANDSRANG[a.zustand] - ZUSTANDSRANG[b.zustand] || a.name.localeCompare(b.name, 'de-CH'));
	const abwesende = e.teilnehmer
		.filter((t) => t.zustand !== 'anwesend' && t.zustand !== 'gegangen')
		.sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));

	if (anwesende.length === 0) {
		z.push('Es ist niemand als anwesend erfasst.');
	} else {
		z.push(`Anwesend oder vertreten (${anwesende.length}):`);
		z.push('');
		for (const t of anwesende) z.push(teilnehmerzeile(t));
	}
	z.push('');

	if (abwesende.length > 0) {
		z.push(`Nicht erschienen (${abwesende.length}):`);
		z.push('');
		/*
		 * Ohne Zeiträume (Ä-09): Wer über eine Vollmacht abstimmte, war anwesend;
		 * endet sie, steht die Partei auf «gegangen» (`server/vollmacht.ts`,
		 * «Wer nur durch die Vertretung anwesend war»), also oben.
		 */
		for (const t of abwesende) z.push(`- ${t.name}`);
		z.push('');
	}

	// ── Beschlussfähigkeit ──────────────────────────────────────────────────
	/*
	 * **Sie steht an einer Stelle, nicht an zweien** (28.08.2026, Befund des Auftraggebers:
	 * «Beschlussfähigkeit steht zweimal — am Anfang und in der Ziffer. Sie gehört
	 * in die Ziffer»).
	 *
	 * Vorher stand hier immer ein eigener Abschnitt mit den Zahlen, und im
	 * Verhandlungsteil daneben ein Traktandum «Begrüssung und Feststellung der
	 * Beschlussfähigkeit», unter dem nichts weiter stand als «Zur Kenntnis
	 * genommen». Dasselbe Geschäft an zwei Orten, einmal mit Inhalt und einmal
	 * ohne.
	 *
	 * **Der Rückfall ist der eigene Abschnitt.** Erkannt wird das tragende
	 * Traktandum am Titel, und ein Titel ist frei gewählt: Wer seines anders
	 * nennt, bekommt das Protokoll wie bisher. Die Feststellung kann also nicht
	 * verschwinden, sie kann nur an der weniger schönen Stelle stehen. Die
	 * Einschränkung auf Kenntnisnahmen hält einen Antrag *über* eine
	 * Beschlussfähigkeitsregel davon ab, die Zahlen an sich zu ziehen.
	 */
	const feststellung = feststellungszeilen(e);
	const traegerNummer =
		e.zeilen.find((t) => t.art === 'kenntnisnahme' && TRAEGT_FESTSTELLUNG.test(t.titel))?.nummer ??
		null;
	if (traegerNummer === null) {
		z.push('## Feststellung der Beschlussfähigkeit');
		z.push('');
		z.push(...feststellung);
	}

	/*
	 * **Die Stimmabgabe steht vor der Zählweise**, weil sie ihr vorausgeht: Erst
	 * wird abgestimmt, dann gezählt. Und sie steht im Kopf und nicht unter einem
	 * Traktandum, weil sie für den ganzen Abend gilt.
	 *
	 * Der Abschnitt erscheint nur in der Mischform; `stimmabgabeabschnitt`
	 * entscheidet das und liefert sonst nichts.
	 *
	 * **Gemessen wird gegen die Anwesenden, nicht gegen alle Parteien**
	 * (10.09.2026, im Code-Review gefunden). Ein Papiervermerk entsteht am
	 * Eingang; wer nicht erschienen ist, steht nie im Zähler und stünde immer im
	 * Nenner. Fünf Anwesende von vierzehn Parteien, alle fünf von Hand, wären
	 * sonst als «Mischform» ausgewiesen worden.
	 */
	z.push(...stimmabgabeabschnitt(e.aufPapier ?? [], anwesende.length));

	/*
	 * **Zählweise und Stichentscheid bleiben im Kopf.** Sie sind keine
	 * Feststellung, sondern der Rahmen des ganzen Abends — dieselben Stimmen
	 * ergeben je nach Zählweise Annahme oder Ablehnung. Sie unter ein einzelnes
	 * Traktandum zu schieben hiesse, sie auf dieses zu beschränken.
	 */
	if (e.zaehlweise || e.stichentscheid) {
		z.push('## Zählweise und Stichentscheid');
		if (e.zaehlweise) {
			z.push('');
			z.push(`Zählweise: ${e.zaehlweise}`);
		}
		if (e.stichentscheid) {
			z.push('');
			// Ohne Vorsatz: Jeder Satz aus `stichentscheidInWorten` nennt die
			// Stimmengleichheit selbst, und davor stand sie zweimal (Codeprüfung
			// 07.10.2026, N1).
			z.push(e.stichentscheid);
		}
		z.push('');
	}

	/*
	 * A5, Punkt 2 (Laienprüfung Block 5, L5-16 und R2-8): Weg und Frist der
	 * Anfechtung standen bisher nur bei fehlender Beschlussfähigkeit
	 * (`beschlussfaehigkeitFehlteSatz`) und bei zu früh abgehaltener
	 * Versammlung (`fristvermerkImProtokoll`), nicht beim gewöhnlichen
	 * Beschluss, obwohl das Protokoll für Abwesende die Frist in Gang setzt
	 * (Rz. 230 ad Art. 712m). Einmal je Protokoll genügt: Der Satz gilt jedem
	 * Beschluss, nicht nur dem ersten.
	 */
	const mitBeschluss = e.zeilen.filter(
		(t) => t.art === 'abstimmung' && !t.rueckzug && (t.beschlussvermerk || zeigtBeschluss(t.satz))
	);
	if (mitBeschluss.length > 0) {
		z.push('## Anfechtung');
		z.push('');
		z.push(anfechtungsabschnitt(mitBeschluss.map((t) => t.anfechtungssonderfall)));
		z.push('');
	}

	/*
	 * ── Die Traktanden im Überblick ────────────────────────────────────────
	 *
	 * **Erst der Kopf, dann die Traktanden, dann die Inhalte** (Auftraggeber,
	 * 03.09.2026: «Das Protokoll soll wie ein Protokoll aufgebaut sein … Erste
	 * Seite im Kopf alles relevante dann Traktanden und dann die Inhalte.»).
	 *
	 * Bis hierher sprang das Dokument vom Kopf unmittelbar in die Verhandlungen.
	 * Wer wissen wollte, worüber der Abend ging, musste sich durch alle Ergebnisse
	 * lesen — und wer ein einzelnes Traktandum suchte, hatte kein Register.
	 *
	 * **Nur Nummer und Titel**, nichts weiter: Die Übersicht soll auf einen Blick
	 * lesbar sein. Ein Ergebnis daneben wäre eine zweite Fassung des Beschlusses
	 * und liefe bei der ersten Berichtigung auseinander.
	 *
	 * **Keine Einrückung nach der Tiefe** (aus dem Code-Review). Der erste Anlauf
	 * setzte führende Leerzeichen; im Textfeld sah das gut aus, im PDF verschwand
	 * es. `umbrich` zerlegt jede Zeile in Wörter (`split(/\s+/)`), und Word kennt
	 * für den Listenabsatz nur einen festen Einzug. Ein Einzug, den nur eine der
	 * drei Ausgaben zeigt, ist keiner — die Gliederung steht ohnehin in der
	 * Nummer: «2.1» sagt, wozu der Punkt gehört.
	 */
	if (e.zeilen.length > 0) {
		z.push('## Traktanden');
		z.push('');
		for (const t of e.zeilen) {
			z.push(`- ${t.nummer} ${t.titel}`);
		}
		z.push('');
	}

	// ── Traktanden ──────────────────────────────────────────────────────────
	z.push('## Verhandlungen');
	z.push('');
	if (e.zeilen.length === 0) {
		z.push('Es sind keine Traktanden erfasst.');
		z.push('');
	}

	for (const t of e.zeilen) {
		// Die Einrückung des Traktandenbaums als Überschriftenebene: Ein
		// Untertraktandum ist kein eigenes Geschäft, sondern gehört unter seines.
		z.push(`${'#'.repeat(Math.min(3 + t.tiefe, 6))} ${t.nummer} ${t.titel}`);
		z.push('');

		const ruegen = t.ruegen ?? [];
		if (ruegen.length > 0) {
			z.push(ruegen.length === 1 ? 'Rüge im Saal:' : 'Rügen im Saal:');
			for (const r of ruegen) z.push(`- ${ruegeSatz(r)}`);
			z.push('');
		}

		/*
		 * **Die Pendenzen als Griff, nicht als Block am Ende der Schleife**
		 * (Probe «nennt sie auch ohne Abstimmung», 09.09.2026). Der erste Anlauf
		 * stand ganz unten — und wurde bei einer Kenntnisnahme und bei einem
		 * zurückgezogenen Antrag nie erreicht, weil beide mit `continue`
		 * aussteigen. Genau das sind die beiden Fälle, in denen eine Zusage am
		 * häufigsten fällt: «(Informativ)» und «wir ziehen zurück und klären
		 * zuerst ab».
		 */
		const pendenzenAnhaengen = () => {
			if (t.pendenzen.length === 0) return;
			z.push(t.pendenzen.length === 1 ? 'Pendenz:' : 'Pendenzen:');
			for (const p of t.pendenzen) z.push(`- ${pendenzSatz(p)}`);
			z.push('');
		};

		if (t.spontan) {
			z.push('Während der Versammlung aufgenommen.');
			z.push('');
		}
		// Worauf sich der Beschluss über ein nicht angekündigtes Geschäft stützt.
		// Im Anfechtungsfall ist das die erste Frage.
		if (t.ausnahmeVermerk) {
			z.push(t.ausnahmeVermerk);
			z.push('');
		}
		if (t.vorgezogen) {
			// Was die Versammlung dabei bewogen hat, weiss die Anwendung nicht — den
			// Grund trägt die Sitzungsleitung als Notiz nach. Festgehalten wird hier
			// nur, dass die Reihenfolge ein Entscheid war und kein Versehen.
			z.push('Vorgezogen behandelt; die Versammlung hat die Reihenfolge geändert.');
			z.push('');
		}
		if (t.kurzfassung) {
			z.push(t.kurzfassung);
			z.push('');
		}
		if (t.antragswortlaut) {
			if (t.antragsteller) z.push(`Antrag von ${t.antragsteller}:`);
			z.push(`Antrag: ${t.antragswortlaut}`);
			z.push('');
		}
		if (t.notiz) {
			z.push(t.notiz.trim());
			z.push('');
		}

		// Die Feststellung gehört unter das Traktandum, das sie ankündigt.
		if (traegerNummer !== null && t.nummer === traegerNummer) z.push(...feststellung);

		/*
		 * **Was ausser dem Abstimmen geschah** (22.08.2026, Befund D-02).
		 *
		 * Vor den Zahlen, weil der Vorgang sie einordnet: «3 von 4» wirft sonst
		 * eine Frage auf, die das Protokoll gar nicht stellt.
		 *
		 * **Der Satz hier bleibt unbestimmt, die Zahlen stehen unten** (Code-Review
		 * 24.09.2026, Befund 3; Produktentscheid vom selben Tag). Seit Ä-25 sagt
		 * er nur, die Wirkung hänge am Erfordernis; das stimmt für jeden
		 * Ausstand und jedes Erfordernis. Was sie in diesem Durchgang war, steht
		 * seit dem 24.09.2026 bei den Zahlen, aus `ausstandswirkung`: Dort steht
		 * das Ergebnis des massgebenden Durchgangs, hier nur der Vorgang, und ein
		 * Ausstand kann erklärt und wieder zurückgenommen worden sein.
		 */
		for (const v of t.vorgaenge ?? []) {
			const wer = typeof v.angaben.partei === 'string' ? v.angaben.partei : null;
			const grund = typeof v.angaben.grund === 'string' ? v.angaben.grund : null;
			if (v.art === 'agenda.item.recusal.declared' && v.angaben.vertreter === true) {
				/*
				 * **Ein Vertreter, der nicht Eigentümer ist** (Migration 167, Ä-26):
				 * Er hat keine eigene Stimme, die er nicht abgeben könnte; was der
				 * Ausstand bewirkt, sind die ruhenden Vollmachten, und die nennen die
				 * Vermerke zur Bezugsgrösse beim Ergebnis.
				 */
				z.push(
					`${wer ?? 'Ein Vertreter'}, nicht Eigentümer, ist bei diesem Traktandum als Vertreter in ` +
						'den Ausstand getreten; Vollmachten dieses Vertreters ruhten hier, soweit es welche gab.' +
						(grund ? ` Grund: ${grund}` : '')
				);
				z.push('');
			} else if (v.art === 'agenda.item.recusal.declared') {
				/*
				 * **Die Protokollfassung, nicht die Saal-Fassung** (H3, Fachprüfung
				 * 08.10.2026): Vergangenheit, ohne den Überleitungssatz «hängt vom
				 * Erfordernis ab». Im Saal und in der Auswertung bleibt der eine
				 * Wortlaut (`ausstandsmeldung`), die Urkunde stellt fest.
				 */
				z.push(
					ausstandProtokollInWorten(wer ? [wer] : [], false) + (grund ? ` Grund: ${grund}` : '')
				);
				z.push('');
			} else if (v.art === 'agenda.item.recusal.withdrawn') {
				z.push(`Der Ausstand ${wer ? `von ${wer} ` : ''}wurde zurückgenommen.`);
				z.push('');
			} else if (v.art === 'agenda.item.withdrawal.revoked') {
				// Der Rückzug selbst steht weiter unten nur, solange er GILT. Wurde er
				// zurückgenommen, verschwand er bisher spurlos — und damit die
				// Erklärung, warum über einen einmal zurückgezogenen Antrag doch
				// abgestimmt wurde. Wurde danach nicht abgestimmt, sagt der Satz
				// das (Schritt F2; Codeprüfung H7 Teil D, Befund 9): Bis dahin stand
				// «und es wurde darüber abgestimmt» auch dort.
				z.push(
					v.danachAbgestimmt === false
						? // Ohne «mehr» (Laienprüfung F2, S2: klang nach einer früheren Abstimmung).
							'Der Antrag war zurückgezogen worden; der Rückzug wurde zurückgenommen. Danach ' +
								'wurde über ihn nicht abgestimmt.'
						: 'Der Antrag war zurückgezogen worden; der Rückzug wurde zurückgenommen, und es ' +
								'wurde darüber abgestimmt.'
				);
				z.push('');
			}
		}

		/*
		 * **Nach einer konsultativen Abstimmung zurückgezogen** (Produktentscheid
		 * 14.10.2026, H7 Teil D). «Vor der Abstimmung» und «es wurde nicht
		 * abgestimmt» stimmten dann nicht, und die konsultativen Zahlen sind der
		 * einzige Inhalt des Durchgangs (Teil B); sie stehen hier mit ihm.
		 */
		const konsultativVorRueckzug = t.rueckzug ? (t.konsultativFrueher ?? []) : [];
		if (t.rueckzug && konsultativVorRueckzug.length > 0) {
			z.push(rueckzugssatz(t.rueckzug, true));
			z.push('');
			// Ohne Ordnungszahl, wo es nur diesen einen Durchgang gab: «Im 1.
			// Durchgang» liess nach dem zweiten suchen (Laienprüfung 14.10.2026, D3).
			const einziger = konsultativVorRueckzug.length === 1 && !t.frueherenDurchgaenge;
			/*
			 * Davor überholte verbindliche Durchgänge, etwa abgebrochen oder mit
			 * offenem Stichentscheid neu angesetzt (Codeprüfung 14.10.2026, Befund
			 * 3): Sie stehen mit ihrem Satz da, und «Verbindlich abgestimmt wurde
			 * nicht» wäre dann falsch.
			 */
			const verbindlichDavor = t.neuabstimmungen ?? [];
			// Nach der Nummer, gleich welcher Art: Ein konsultativer kann auch vor
			// einem abgebrochenen verbindlichen liegen (Codeprüfung Runde 2, N2).
			const saetze = [
				...verbindlichDavor.map((f) => ({ nummer: f.nummer, satz: neuabstimmungssatz(f, null) })),
				...konsultativVorRueckzug.map((k) => ({
					nummer: k.nummer,
					satz: konsultativFruehererSatz(k, !einziger)
				}))
			].sort((a, b) => a.nummer - b.nummer);
			for (const x of saetze) z.push(x.satz);
			z.push('');
			z.push(
				verbindlichDavor.length > 0 || (t.nachWeggang ?? []).length > 0
					? 'Ein Beschluss ist nicht gefasst worden.'
					: 'Verbindlich abgestimmt wurde nicht; ein Beschluss ist nicht gefasst worden.'
			);
			z.push('');
			pendenzenAnhaengen();
			continue;
		}
		if (t.rueckzug) {
			z.push(rueckzugssatz(t.rueckzug, false));
			z.push('');
			z.push('Es wurde nicht abgestimmt; ein Beschluss ist nicht gefasst worden.');
			z.push('');
			pendenzenAnhaengen();
			continue;
		}

		if (t.art === 'kenntnisnahme') {
			z.push('Zur Kenntnis genommen; es wurde nicht abgestimmt.');
			z.push('');
			pendenzenAnhaengen();
			continue;
		}

		/*
		 * **Die Mehrheit im Hauptsatz, der Fall in Klammern** (22.08.2026).
		 *
		 * Vorher: «Erforderliche Mehrheit: Décharge und Protokollgenehmigung
		 * (Reglement der Gemeinschaft, § 15 Reglement)». Das erste ist ein
		 * Fallname und keine Mehrheit, und das zweite stimmte nach einer
		 * Übersteuerung nicht mehr. Wer den Beschluss anficht, liest jetzt in
		 * einem Satz, welche Schwelle galt, welcher Fall vorlag und woher die
		 * Schwelle stammt.
		 */
		/*
		 * **Der Fall ist eine Fallgruppe, und das muss dastehen** (Auftraggeber,
		 * 03.09.2026, mit Bild von Traktandum 3).
		 *
		 * Dort stand: «Erforderliche Mehrheit: mehr als die Hälfte der Anwesenden
		 * und Vertretenen (Décharge und Protokollgenehmigung, ZGB Art. 712m Abs. 1
		 * (Praxis))» — unter der **Protokollgenehmigung**. Das Wort «Décharge»
		 * gehört dort nicht hin, und wer das Protokoll liest, hält es für einen
		 * Fehler.
		 *
		 * Es ist keiner: `k-decharge` im Entscheidbaum deckt beide Geschäfte ab,
		 * weil sie dieselbe Schwelle haben. Der Knotentitel ist also die
		 * **Fallgruppe**, nicht die Bezeichnung dieses Geschäfts — nur sagte das
		 * niemand, und in einer blossen Klammer neben der Fundstelle liest es sich
		 * wie eine Aussage über das Traktandum.
		 *
		 * **Nicht im Regelwerk zu beheben:** Eine Fassung bleibt unverändert
		 * stehen (AD-4), und der Fallname ist am Traktandum gespeichert, seit sein
		 * Erfordernis hergeleitet wurde. Ein neuer Knotentitel träfe nur neue
		 * Traktanden und liesse die bestehenden ungereimt.
		 *
		 * Also sagt es der Satz: «hergeleitet als …». Damit ist die Klammer als
		 * Herleitungsnachweis erkennbar, und die Fundstelle steht weiter dabei —
		 * beides, was im Anfechtungsfall gebraucht wird.
		 */
		if (t.erfordernis) {
			const herkunft = herleitung(t.fall, t.rechtsgrundlage, t.mehrheitGesetzt);
			/*
			 * **Die Fassung des Regelwerks hinter den Klartext** (Ä-09): Wer den
			 * Beschluss anficht, soll die Herleitung nachvollziehen können, und
			 * die hängt an der Fassung. Allein genügte der Verweis nicht, deshalb
			 * steht er nach der Regel, nicht statt ihr. **Nicht bei einer Mehrheit,
			 * die die Leitung gesetzt hat** (Codeprüfung 16.10.2026, M2): Dort
			 * lässt `herleitung` die Herleitung absichtlich weg, und der Satz läse
			 * sich wie die Herleitung, die eben entfernt wurde.
			 */
			z.push(
				`Erforderliche Mehrheit: ${t.erfordernis}` +
					(herkunft ? ` (${herkunft})` : '') +
					(t.regelfassung && !t.mehrheitGesetzt ? `. ${regelfassungSatz(t.regelfassung)}` : '')
			);
			if (t.lesart) z.push(t.lesart);
			z.push('');
		}

		if (t.satz && (t.zahlen || t.geheim)) {
			z.push(t.satz);
			if (t.beschlusstext) z.push(t.beschlusstext);
			// Ä-17 B: Beim Beschluss, nicht am Kopf, wie die fehlende
			// Beschlussfähigkeit darunter; wer anficht, liest diesen einen Beschluss.
			if (t.neuAnZweiterVersammlung) {
				const fehlte = t.neuAnZweiterErsteFehlte ?? null;
				// Fehlte schon die Beschlussfähigkeit selbst, sagt der Satz darunter es;
				// «abgestimmt mit der Beschlussfähigkeit der zweiten» widerspräche ihm
				// (Codeprüfung Block 7, R3-N3). Dann nur die Tatsache.
				z.push(
					t.beschlussfaehigkeitFehlte
						? neuAnZweiterProtokoll(null)
						: neuAnZweiterProtokoll(
								t.neuAnZweiterWahl,
								fehlte === null ? null : fehlte !== false,
								t.neuAnZweiterRegel ?? null
							)
				);
				// Nicht doppelt, wo schon die Beschlussfähigkeit selbst fehlte.
				if (t.neuAnZweiterWahl === 'erste' && fehlte && fehlte.angenommen && !t.beschlussfaehigkeitFehlte) {
					z.push(neuAnZweiterAnfechtungssatz(fehlte.vonHand));
				}
			}
			/*
			 * **Die fehlende Beschlussfähigkeit gehört an den Beschluss**
			 * (Produktentscheid 01.10.2026): Der Abwesende liest nur das
			 * Protokoll, und die Feststellung am Anfang sagt nichts über diesen
			 * einen Beschluss. Die Tatsache, nicht der Weg.
			 */
			if (t.beschlussfaehigkeitFehlte) {
				z.push(beschlussfaehigkeitFehlteSatz(t.beschlussfaehigkeitFehlte));
			}
			/*
			 * **L7, die Vorgabe am Beschluss** (Migration 183): Hing die
			 * Beschlussfähigkeit an den Personen im Ausstand, steht die
			 * Tatsache am Beschluss, wie die fehlende daneben. Nicht doppelt,
			 * wo die Beschlussfähigkeit selbst fehlte: Der Satz darüber sagt
			 * es, und «wäre nicht beschlussfähig gewesen» läse sich dann als
			 * ein Vorbehalt zu ihm.
			 */
			if (t.ohneAusstandFehlte && !t.beschlussfaehigkeitFehlte) {
				z.push(ausstandFehlteSatz(t.ohneAusstandFehlte));
			}
			/*
			 * **L8, die Wahl trotz Häkchen am Beschluss** (Entscheid 8,
			 * 07.11.2026): Die Einladung hatte bei diesem Traktandum
			 * angekündigt, dass die Vollmachten der Verwaltung nicht zählen;
			 * bei der Wahl zählten sie doch, und das Protokoll hält die
			 * Abweichung fest.
			 */
			// Dazu die Abberufung und die Angabe der Leitung (Entscheid 0045,
			// Punkte 9 und 11); dieselben Zeilen im Abenddokument.
			for (const s of l8Protokollzeilen(t)) z.push(s);
			/*
			 * **Der zweite Durchgang nach Eintritt der Beschlussfähigkeit**
			 * (Migration 139). Er steht unter dem Ergebnis, weil er es erklärt:
			 * Der frühere Durchgang war nicht beschlussfähig, der neue ersetzt
			 * ihn (oder liess ihn mangels Beschluss in Kraft).
			 */
			if (t.nachQuorum) z.push(nachQuorumSatz(t.nachQuorum));
			// Unter dem Ergebnis, das er erklärt (Entscheid 0046, A7).
			if (t.einwand) {
				z.push(
					einwandSatz({
						bestimmung: t.einwand,
						einfuehrung: t.einwandEinfuehrung,
						notwendig: t.einwandNotwendig === true
					})
				);
			}
			z.push('');
			if (t.geheim) {
				/*
				 * **Der Vermerk zur geheimen Abstimmung** (Produktentscheid
				 * 28.09.2026: «Vermerk auf geheime Abstimmung im Protokoll»).
				 * Er tritt an die Stelle des Zahlenspiegels; der Satz darüber
				 * nennt nur erreicht/nicht erreicht.
				 */
				for (const s of geheimGrundlage(t)) z.push(s);
				z.push(GEHEIM_VERMERK);
			} else {
			const k = t.zahlen!.koepfe;
			const q = t.zahlen!.quoten;
			// Die Einheit der Wertquoten je Beschluss (Ä-09), aus dem Nenner.
			const einheit = e.quotennenner ? ` (${quoteneinheit(e.quotennenner)})` : '';
			/*
			 * **Wie gezählt wurde, vor dem, was gezählt wurde** (28.08.2026). Eine
			 * Handzählung erklärt beides: warum keine Namen dastehen und warum die
			 * Wertquoten fehlen. Stünde der Vermerk hinter den Zahlen, läse man
			 * erst die Lücke und dann ihren Grund.
			 */
			if (t.handzaehlung) {
				z.push(
					'- Von Hand gezählt, ohne Zuordnung zu Personen' +
						(t.handzaehlung.vermerk ? `: ${t.handzaehlung.vermerk}` : '.')
				);
			}
			if (t.vonHand) {
				// Nur was eingetragen ist, und ohne Bezugsgrösse (`vonHandZahlen`).
				const koepfe = vonHandZahlen(k, zahl);
				const quoten = t.quotenErhoben ? vonHandZahlen(q, zahl) : null;
				if (koepfe) z.push(`- Kopfstimmen: ${koepfe}`);
				if (quoten) z.push(`- Wertquoten${einheit}: ${quoten}`);
			} else z.push(`- Kopfstimmen: ${spiegelInWorten(k, 'koepfe')}`);
			for (const w of t.beklagtenwohnungen ?? []) z.push(`- ${beklagtenwohnungSatz(w)}`);
			if (t.vonHand) {
				// Die Wertquoten stehen oben oder sind nicht eingetragen; der Satz
				// «nicht erhoben» gehört zur Handzählung und spräche hier vom Erfordernis.
			} else if (t.quotenErhoben) {
				z.push(`- Wertquoten${einheit}: ${spiegelInWorten(q, 'quoten')}`);
			} else {
				/*
				 * **«Nicht erhoben» ist nicht «null».** Der Quotenspiegel steht bei
				 * der Handzählung überall auf null, weil es nichts zu zählen gab —
				 * ausgeschrieben las sich das als «0 Ja, 0 Nein … (von 0)», also als
				 * ein Ergebnis. `summenhindernis` lässt die Handzählung nur dort zu,
				 * wo das Erfordernis keine Quotenmehrheit verlangt; deshalb ist die
				 * Lücke hier keine, sondern eine Feststellung.
				 *
				 * **«Stimmen nach Wertquoten», nicht «Wertquoten»** (Block A3c,
				 * Laien- und Fachprüfung 26.09.2026). Seit die Handzählung bei einer
				 * Änderung der Wertquoten geht, stand «Wertquoten: nicht erhoben» im
				 * selben Punkt wie die Genehmigung neuer Quoten und las sich als
				 * «nichts beschlossen». Und «zugestimmt» klang nach der Zustimmung der
				 * Betroffenen, auf die es im Saal nicht ankommt.
				 */
				// Den Teil zum Erfordernis nur, wo die Zeile «Erforderliche Mehrheit»
				// dasteht: Nach einer konsultativen Abstimmung fehlt sie, und der Satz
				// verwiese auf etwas, das das Protokoll nicht nennt (Befund 7, H7 Teil D).
				z.push(
					'- Stimmen nach Wertquoten: nicht erhoben' +
						(t.handzaehlung
							? '. Aus gezählten Händen lässt sich nicht ablesen, welche Einheiten ' +
								'dafür gestimmt haben' +
								(t.erfordernis
									? '; das angewandte Erfordernis verlangt hier keine Mehrheit der Wertquoten.'
									: '.')
							: '.')
				);
			}
			}
			/*
			 * **Unmittelbar unter den Zahlen, die er erklärt** (Befund D-02,
			 * 22.08.2026: «die Bezugsgrösse springt von 5 auf 4, ohne ein Wort der
			 * Erklärung»). Vor den Zeilen zu den Betroffenen, nicht danach: Die
			 * stehen gerade dann da, wenn ein Betroffener im Ausstand ist, und
			 * schöben sich sonst zwischen Zahl und Erklärung (Code-Review
			 * 24.09.2026 zu `ausstandswirkung`, Befund 6).
			 */
			if (t.ausstandswirkung) z.push(`- ${t.ausstandswirkung}`);
		/*
		 * **Die Vermerke zur Bezugsgrösse** (Fachprüfung 08.10.2026). Sie
		 * erklären die Zahlen, also direkt darunter, vor den Zeilen zu den
		 * Betroffenen: ruhende Vertretung, der Beklagte unter einer anderen
		 * Bezugsgrösse, die Lesart bei der Einstimmigkeit, uneinheitliche
		 * Stimmabgabe, die Differenz der Wertquoten.
		 */
		for (const h of t.protokollhinweise ?? []) {
			if (h.ort === 'bezugsgroesse') z.push(`- ${h.satz}`);
		}
			/*
			 * **Wer nicht zugestimmt hat, wo es auf die Person ankommt.** Die
			 * Wertung sagt, dass eine Zustimmung fehlt; wessen, steht hier, sonst
			 * wüsste niemand, bei wem nachzufragen ist. Die Zeilen bildet
			 * `betroffenenzeilen`, dieselbe Funktion wie am gemeinsamen Abend.
			 *
			 * **«nicht stimmberechtigt» wäre etwas anderes** (23.09.2026): Wer im
			 * festgehaltenen Stand fehlt, kann sehr wohl stimmberechtigt sein,
			 * erfasst war er nur nicht. Die Zeile dazu sagt deshalb «steht nicht im
			 * festgehaltenen Stand»; `tests/domain/protokoll.test.ts` hält es fest.
			 */
			for (const zeile of betroffenenzeilen(t, { namentlich: true })) z.push(`- ${zeile}`);
			const mitWeggang = !!t.durchgang && t.durchgang > 1 && (t.nachWeggang ?? []).length > 0;
			if (mitWeggang) {
				/*
				 * **Warum es einen zweiten Durchgang gab, im Protokoll selbst**
				 * (Fachprüfung Block 3, Runde 3, Befund 2). Aufzubewahren und
				 * einzusehen ist das Protokoll, nicht der Verlauf (Rz. 126b ad
				 * Art. 712n). Gefragt wird es, wenn die Durchgänge verschiedene
				 * Mehrheiten zeigen. Ohne Zahlen des früheren Durchgangs (Rz. 131).
				 */
				z.push(`- ${t.durchgang}. Durchgang.`);
				for (const w of t.nachWeggang!) {
					/*
					 * Wer nur über die Leitung vertreten war, ist nicht gegangen
					 * und kam nicht «wieder» (Codeprüfung Block 4a, N-4). Der Satz
					 * dazu ist derselbe wie im Vermerk des Durchgangs.
					 */
					const leitung = new Set((w.nurDurchLeitung ?? []).map((l) => l.name));
					const gegangen = w.namen.filter((n) => !leitung.has(n));
					const hatte = gegangen.length === 1 ? 'hatte' : 'hatten';
					z.push(
						`- Der ${w.nummer}. Durchgang ergab keinen Beschluss: ` +
							(gegangen.length > 0
								? `${gegangen.join(', ')} ${hatte} die Versammlung ` +
									(w.handzaehlung
										? 'während der Abstimmung verlassen. '
										: 'vor dem Schluss der Abstimmung verlassen, ohne vorher abzustimmen. ')
								: '') +
							(leitung.size > 0 ? `${nurDurchLeitungSatz(w)} ` : '') +
							(leitung.size === 0
								? 'Nachdem wieder alle da waren, wurde die Abstimmung neu eröffnet. '
								: // «dafür», nicht «für diese Versammlung» (Fachprüfung
									// 30.09.2026, Befund 1). Nicht «B war selbst da»: Nach einem
									// berichtigten Kreuz träfe das nicht zu. Auch im Mischfall,
									// weil «wieder alle da» die Vertretung nicht deckt
									// (Codeprüfung 30.09.2026, N-3).
									'Nachdem alle so da oder vertreten waren, wie es dafür zählt, wurde die ' +
									'Abstimmung neu eröffnet. ') +
							`Die Stimmen des ${w.nummer}. Durchgangs bleiben festgehalten und bewirken nichts.`
					);
				}
			}
			const neuabstimmungen = t.neuabstimmungen ?? [];
			const ersetzt = t.ersetztNachRueckkommen ?? [];
			const konsultativ = t.konsultativFrueher ?? [];
			/*
			 * **Jede Erklärung eine eigene Zeile, keine Kette** (Produktentscheid
			 * 30.09.2026, «Nein heisst Nein»; Fachprüfung F-11). Bis dahin
			 * verdrängte ein Zweig den nächsten: War der geltende Durchgang nicht
			 * der erste, stand nur «… Durchgang; weitere Durchgänge siehe Verlauf»,
			 * und ein Rückkommen oder ein Rückkommen ohne Beschluss fiel weg. Seit
			 * auch eine Ablehnung ersetzt, ist das der häufige Fall.
			 */
			/*
			 * Der Satz «… bleibt in Kraft» nur, wenn das stimmt (Codeprüfung
			 * 30.09.2026, M1): nicht, wenn ein späteres Rückkommen den erhaltenen
			 * Beschluss doch ersetzt hat, und nicht neben einem Weggang, der
			 * denselben Durchgang schon erklärt. Dann bleibt der Durchgang
			 * unerklärt, und die Zeile «Weitere frühere Durchgänge …» steht.
			 */
			const ohneBeschlussNachRueckkommen =
				t.rueckkommenErfolglos &&
				!t.neuabstimmungNachRueckkommen &&
				ersetzt.length === 0 &&
				!mitWeggang;
			/*
			 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit erklärt
			 * den früheren bereits selbst (Migration 139); die generischen Zeilen
			 * zu früheren Durchgängen bleiben weg.
			 */
			const nachQuorum = !!t.nachQuorum;
			const erklaert =
				(mitWeggang ? t.nachWeggang!.length : 0) +
				konsultativ.length +
				neuabstimmungen.length +
				ersetzt.length +
				(ohneBeschlussNachRueckkommen ? 1 : 0) +
				(nachQuorum ? 1 : 0);
			const mitErklaerung =
				konsultativ.length > 0 ||
				neuabstimmungen.length > 0 ||
				ersetzt.length > 0 ||
				ohneBeschlussNachRueckkommen ||
				nachQuorum;
			// Den massgebenden nennen die Sätze nur, wenn eine Neuabstimmung vor ihm
			// liegt; sonst hier, wie vorher in der Zeile «… Durchgang; weitere
			// Durchgänge siehe Verlauf» (Codeprüfung 30.09.2026, M2). Neben dem
			// Weggang steht die Zeile schon oben.
			if (
				!mitWeggang &&
				mitErklaerung &&
				!nachQuorum &&
				!!t.durchgang &&
				t.durchgang > 1 &&
				!neuabstimmungen.some((n) => n.nummer < t.durchgang!)
			) {
				z.push(`- ${t.durchgang}. Durchgang.`);
			}
			for (const k of konsultativ) z.push(konsultativFruehererSatz(k));
			// Den massgebenden nur, wenn der überholte vor ihm liegt: Liegt er danach,
			// führte die Anordnung zu einem späteren Durchgang, und der massgebende
			// gilt aus einem anderen Grund (etwa ein Rückkommen ohne Beschluss).
			for (const n of neuabstimmungen) {
				const davor = !!t.durchgang && n.nummer < t.durchgang;
				z.push(neuabstimmungssatz(n, davor ? t.durchgang : null, !!t.durchgang && !davor));
			}
			for (const r of ersetzt) {
				// Die Versammlung hat entschieden, nicht die Leitung: Hier steht die
				// Wirkung, anders als bei der Neuabstimmung (Fachprüfung 30.09.2026,
				// F-3). Das Ergebnis in Worten, die Zahlen auf Anfrage. «Erneut
				// abgestimmt», nicht «neu entschieden», und ohne lesbares Ergebnis
				// kein «Beschluss»: Mit offenem Stichentscheid ist nichts entschieden
				// (Codeprüfung 30.09.2026, M3).
				//
				// **Der Folgeantrag wird als Ersetzer genannt** (Produktentscheid
				// 08.10.2026, Laien- und Fachprüfung 09.10.2026): Im Randfall
				// (erster Durchgang am Grundantrag, dann Folgeantrag nach
				// Rückkommen, dann wieder der Grundantrag) ersetzte nicht die
				// erneute Abstimmung am Grundantrag den Durchgang, sondern der
				// Folgeantrag. «Damit ersetzt» liesse beide Lesarten offen, und
				// nach Rz. 133 und 133b ad Art. 712n wirkt der protokollierte
				// Wortlaut; deshalb fällt das «damit» in diesem Zweig.
				z.push(
					'- Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt. ' +
						(r.ergebnis
							? r.folgeantrag
								? `Der Beschluss aus dem ${r.nummer}. Durchgang («${r.ergebnis}») ist durch den Folgeantrag zu Traktandum ${r.folgeantrag} ersetzt; `
								: `Der Beschluss aus dem ${r.nummer}. Durchgang («${r.ergebnis}») ist damit ersetzt; `
							: `Der ${r.nummer}. Durchgang gilt damit nicht mehr; `) +
						`seine Zahlen ${AUF_ANFRAGE}.`
				);
			}
			if (ohneBeschlussNachRueckkommen) {
				z.push(
					// «Kein Beschluss», nicht «das Mehr nicht erreicht»: Auch eine
					// Universalversammlung, die nicht hielt, endet hier (Migration 128),
					// und dort kann eine Ja-Mehrheit stehen. Eine Ablehnung endet hier
					// seit dem 30.09.2026 nicht mehr («Nein heisst Nein»).
					'- Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt; ' +
						(t.rueckkommenStichentscheidOffen
							? // Nichts entschieden, nur nicht festgestellt (Reste, Punkt 3), mit
								// Grund und nächstem Schritt (Laienprüfung Reste, L11, L15, L20).
								'es stand unentschieden. Nach dem Reglement entscheiden dann die Wertquoten; die ' +
								'liessen sich nicht ausrechnen, weil die Stimmen nur als Summen gezählt wurden und ' +
								'nicht festgehalten ist, wer wie gestimmt hat. Eine weitere Abstimmung mit einzeln ' +
								'erfassten Stimmen fand nicht statt. Der oben festgehaltene Beschluss bleibt in ' +
								'Kraft. Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung ' +
								'traktandiert werden, auch an einer eigens einberufenen; Anträge dazu gehen möglichst ' +
								'bald an die Stelle, die die Versammlung einberuft.'
							: 'ein Beschluss kam dabei nicht zustande. Der oben festgehaltene Beschluss bleibt in Kraft.')
				);
			}
			if (t.rueckkommenOhneDurchgang) z.push(rueckkommenOhneDurchgangSatz(t.rueckkommenOhneDurchgang));
			if (t.rueckkommenNichtGenutzt) {
				z.push(`- Erneut abgestimmt wurde nicht; siehe Traktandum ${t.rueckkommenNichtGenutzt}.`);
			}
			/*
			 * **Nach einem Rückkommen über einen Folgeantrag** (Produktentscheid
			 * 30.09.2026; Soll 6): am Folgeantrag, woran er ersetzt; am
			 * Rückkommensantrag, worüber erneut abgestimmt wurde; am Grundantrag,
			 * dessen Beschluss ohne neuen blieb. Derselbe Satz wie in Auswertung,
			 * Stimmnachweis, Leitung und Wand.
			 */
			if (t.ersetzung) z.push(`- ${ersetzungInKuerze(t.ersetzung)}`);
			if (t.neuabstimmungNachRueckkommen) {
				/*
				 * **Der frühere Beschluss gilt weiter** (Migration 131). Eigener
				 * Zweig neben dem Weggang, nicht in der Kette darunter: Beides kann
				 * am selben Geschäft stehen (Codeprüfung zu Punkt 9, Befund 3), und
				 * die übrigen Zeilen zu früheren Durchgängen träfen hier nicht zu,
				 * weil der überholte nach dem geltenden liegt.
				 *
				 * Mit dem Ergebnis des überholten (Fachprüfung 29.09.2026, Rz. 129
				 * ad Art. 712n), mit dem Satz, dass es zur Neuabstimmung nicht mehr
				 * kam, und mit der Nummer des geltenden: Wer im Saal den Überblick
				 * verloren hat, hält sonst die Zahlen oben für die des letzten
				 * Durchgangs (Laienprüfung 29.09.2026).
				 *
				 * **Ohne «gilt deshalb nicht»** (H6, Fachprüfung 08.10.2026, Frage
				 * 65). Der Satz schrieb der Anordnung der Leitung die Wirkung zu. Seit
				 * die Leitung nur noch überholt, was nicht verkündet ist, führt nur der
				 * unentschiedene oder der abgebrochene Durchgang hierher: Er hat nie
				 * etwas ersetzt, und
				 * es bleibt beim früheren Beschluss, weil der neue nicht zustande kam,
				 * nicht wegen der Anordnung. Deshalb steht der Grund, und die
				 * Neuabstimmung ist nur noch, was geschah.
				 */
				const n = t.neuabstimmungNachRueckkommen;
				const bleibt = n.geltendAbgelehnt
					? `Es bleibt bei der Ablehnung aus dem ${n.geltenderDurchgang}. Durchgang, wie oben festgehalten.`
					: `Es bleibt beim Beschluss aus dem ${n.geltenderDurchgang}. Durchgang, wie oben festgehalten.`;
				// Nach einem Abbruch (H6): erneut abgestimmt wurde nicht zu Ende,
				// und der Rückkommensantrag hält den früheren Beschluss in Kraft.
				if (n.abgebrochen) {
					z.push(
						`- Auf dieses Traktandum wurde zurückgekommen; die Abstimmung im ${n.nummer}. ` +
							'Durchgang hat die Sitzungsleitung ohne Ergebnis abgebrochen' +
							`${n.begruendung ? ` (Begründung: ${n.begruendung.replace(/[.\s]+$/, '')})` : ''}, ` +
							'und erneut abgestimmt wurde nicht mehr; die abgegebenen Stimmen bewirken ' +
							`nichts, ihre Zahlen ${AUF_ANFRAGE}. ` +
							`${bleibt}${naechsterSchritt(t)}`
					);
				} else {
					z.push(
						`- Auf dieses Traktandum wurde zurückgekommen und im ${n.nummer}. Durchgang erneut ` +
							'abgestimmt' +
							(n.unentschieden
								? '; es stand unentschieden, und der Stichentscheid wurde nicht festgestellt. '
								: `${n.ergebnis ? ` (${n.ergebnis})` : ''}. `) +
							'Die Sitzungsleitung hat danach eine Neuabstimmung angesetzt' +
							`${n.begruendung ? ` (Begründung: ${n.begruendung.replace(/[.\s]+$/, '')})` : ''}; ` +
							`zu ihr kam es nicht mehr. ${bleibt}${naechsterSchritt(t)}`
					);
				}
			} else if (mitWeggang || mitErklaerung) {
				// Bleibt ein früherer Durchgang unerklärt, sagt die Zeile, wer seine
				// Zahlen nennt (Laienprüfung 30.09.2026, L4, L5).
				if (t.frueherenDurchgaenge > erklaert) {
					z.push(
						'- Weitere frühere Durchgänge sind hier nicht einzeln aufgeführt; ihre Zahlen ' +
							`${AUF_ANFRAGE}.`
					);
				}
			} else if (t.durchgang && t.durchgang > 1) {
				// Nach einem Beschluss von Hand nur die Nummer (Produktentscheid
				// 01.10.2026: «Nummer ohne Verweis»): Der Verweis zeigte auf den Ort,
				// an dem der Weg steht, und Wand und Protokoll tragen keinen Hinweis
				// darauf. Sonst «weitere»: Ein erfolgloser kann nach dem massgebenden
				// liegen.
				z.push(
					t.vonHand
						? `- ${t.durchgang}. Durchgang.`
						: `- ${t.durchgang}. Durchgang; weitere Durchgänge siehe Verlauf`
				);
			} else if (t.frueherenDurchgaenge > 0) {
				z.push(
					`- ${t.frueherenDurchgaenge} frühere${t.frueherenDurchgaenge === 1 ? 'r' : ''} ` +
						'Durchgang wurde überholt; siehe Verlauf'
				);
			}
			if (t.stichentscheid) {
				/*
				 * **Der Wert in Worten, nicht als Rohwert.** Bis zum 04.10.2026
				 * stand hier «mit yes» bzw. «mit no», während das Auswertungs-PDF
				 * daneben «angenommen»/«abgelehnt» schrieb. Der Entwurf geht an
				 * die Eigentümer und nennt den Entscheid jetzt in derselben Form
				 * wie die Auswertung (Entscheid 04.10.2026, zweiter Blick zu
				 * Lauf B, Frage zur Protokollzeile).
				 */
				z.push(
					`- Bei Stimmengleichheit entschied ${t.stichentscheid.wer}` +
						// Ohne den Vermerk sähe eine Stimme zu viel aus wie ein Zählfehler
						// (Fachprüfung 07.10.2026, F3).
						(t.stichentscheid.eigentuemer
							? ' im Vorsitz, selbst Stockwerkeigentümer (der Stichentscheid ist in der Zählung ' +
								'nicht enthalten)'
							: '') +
						': ' +
						(t.stichentscheid.wahl === 'yes' ? 'Annahme' : 'Ablehnung') +
						(t.stichentscheid.begruendung
							? `. Begründung: ${t.stichentscheid.begruendung}`
							: '')
				);
			}
			/*
			 * **Die Vermerke zum Ausgang** (Fachprüfung 08.10.2026). Sie
			 * begründen oder relativieren das Ergebnis, also nach den Zahlen:
			 * der Stichentscheid nach Wertquoten und die Stimmen, die nicht
			 * gezählt wurden.
			 */
			for (const h of t.protokollhinweise ?? []) {
				if (h.ort === 'ausgang') z.push(`- ${h.satz}`);
			}
			for (const v of t.stellvertretend) {
				z.push(`- Für ${v.name} erfasste die Sitzungsleitung die Stimme: ${v.grund}`);
			}
			z.push('');
		} else if (t.ersetzung && !t.neuabstimmungOffen) {
			/*
			 * **Abgestimmt, nur ohne Ergebnis an diesem Traktandum** (Soll 6). Beim
			 * Grundantrag, dessen Beschluss ein Folgeantrag ersetzt hat, und beim
			 * Folgeantrag, über den kein Beschluss zustande kam oder dessen
			 * Beschluss später ersetzt wurde. Bis dahin stand hier «Über diesen
			 * Antrag wurde nicht abgestimmt», und beim Grundantrag sogar, er sei
			 * durch den Gegenantrag gegenstandslos geworden. Die Zahlen nennt das
			 * Protokoll nicht, wie bei jedem ersetzten Durchgang.
			 */
			// Zuerst, was geschah, dann die Zahlen: Begann der Absatz mit «Abgestimmt
			// wurde im 1. Durchgang («angenommen»)», las ein Überfliegender beim
			// Traktandum «angenommen» (Laienprüfung 30.09.2026, Stelle 2).
			const e = t.ersetzung;
			const zahlen = e.rolle === 'grundantrag' ? e.frueher : null;
			z.push(
				ersetzungInKuerze(e) +
					(zahlen ? ` Die Zahlen des ${zahlen.nummer}. Durchgangs ${AUF_ANFRAGE}.` : '') +
					(e.rolle === 'folgeantrag' ? ` Die Zahlen dieses Durchgangs ${AUF_ANFRAGE}.` : '')
			);
			// Ein späteres, angenommenes Rückkommen ohne Durchgang (B2b, zweiter
			// Randfall): Der Rückkommensantrag verweist hierher.
			if (t.rueckkommenOhneDurchgang) z.push(rueckkommenOhneDurchgangSatz(t.rueckkommenOhneDurchgang));
			z.push('');
		} else if (t.folgeantraegeAngenommen) {
			/*
			 * **Gegenstandslos, nicht «nicht eingetreten».** Die Versammlung hat die
			 * Sache beraten und entschieden — in der Fassung des Gegenantrags. Ein
			 * blosses «wurde nicht abgestimmt» liesse offen, ob das Absicht war
			 * oder vergessen wurde.
			 */
			z.push(folgeantraegeAngenommenSatz(t.folgeantraegeAngenommen));
			z.push('');
		} else if (t.teileEntschieden && t.teileEntschieden.length > 0) {
			// Entscheid 0045, Punkt 9 (Codeprüfung P9, M-2): nicht «wurde nicht
			// abgestimmt» allein, sondern warum.
			z.push(teileEntschiedenSatz(t.teileEntschieden));
			z.push('');
		} else if (t.neuabstimmungOffen) {
			// Wortlaut der Fachprüfung Block 4a, Runde 3, F-1. «Ein Beschluss ist
			// nicht gefasst worden» trägt seit H6 ohne Vorbehalt: Überholt war
			// ein Durchgang, dessen Ergebnis nicht verkündet war (offener
			// Gleichstand), einen Beschluss gab es also nie.
			const n = t.neuabstimmungOffen;
			// Mit dem Gleichstand als Grund (H6, Laienprüfung 14.10.2026): Ohne ihn
			// las sich der Satz, als habe die Leitung ein Ergebnis verworfen. Nach
			// einem Abbruch eigener Wortlaut: Angesetzt wurde dort nichts.
			const grundOffen = n.begruendung
				? ` (Begründung: ${n.begruendung.replace(/[.\s]+$/, '')})`
				: '';
			if (n.abgebrochen) {
				z.push(
					`Die Abstimmung im ${n.nummer}. Durchgang hat die Sitzungsleitung ohne Ergebnis ` +
						`abgebrochen${grundOffen}. Ein Beschluss ist nicht gefasst worden.`
				);
				for (const f of t.neuabstimmungen ?? []) z.push(neuabstimmungssatz(f, null));
				for (const k of t.konsultativFrueher ?? []) z.push(konsultativFruehererSatz(k));
				if (t.ersetzung) z.push(`- ${ersetzungInKuerze(t.ersetzung)}`);
				// Die Stimmen auf Anfrage wie bei jedem überholten Durchgang
				// (Fachprüfung 14.10.2026, Runde 2, R-1): Ohne sie liesse sich nicht
				// nachprüfen, ob ein Ausgang abgebrochen wurde, der sich abzeichnete.
				z.push(
					'- Neu abgestimmt wurde nicht; die abgegebenen Stimmen bewirken nichts. Ihre Zahlen ' +
						`${AUF_ANFRAGE}.${naechsterSchritt(t)}`
				);
				z.push('');
			} else {
				z.push(
					`Abgestimmt wurde im ${n.nummer}. Durchgang` +
						(n.unentschieden
							? '; es stand unentschieden, und der Stichentscheid wurde nicht festgestellt. Die ' +
								'Sitzungsleitung hat eine Neuabstimmung '
							: '; die Sitzungsleitung hat eine Neuabstimmung ') +
						`angesetzt${n.begruendung ? ` (Begründung: ${n.begruendung.replace(/[.\s]+$/, '')})` : ''}. ` +
						'Ein Beschluss ist nicht gefasst worden.'
				);
				// Frühere Neuabstimmungen darunter, ohne massgebenden Durchgang; dann
				// das Ergebnis, das der Satz oben nicht nennt (Laienprüfung 30.09.2026,
				// L8). In Worten, weil Wirkung hat, was im Protokoll steht, und ein
				// Weglassen die offene Frage (b) faktisch entschiede (Fachprüfung
				// 30.09.2026, F-6). Die Zahlen nur auf Anfrage: Ob sie ins Protokoll
				// gehören, hängt an (b).
				for (const f of t.neuabstimmungen ?? []) z.push(neuabstimmungssatz(f, null));
				for (const k of t.konsultativFrueher ?? []) z.push(konsultativFruehererSatz(k));
				// Am Folgeantrag nach dem Rückkommen: statt welches Antrags, ohne die
				// Wirkung der Neuabstimmung zu nennen (offene Frage (b), Soll 6).
				if (t.ersetzung) z.push(`- ${ersetzungInKuerze(t.ersetzung)}`);
				// «Zur Neuabstimmung kam es nicht mehr»: Sonst liest man «angenommen»
				// unter «kein Beschluss» und weiss nicht, ob noch etwas kam
				// (Laienprüfung 30.09.2026, L10).
				z.push(
					'- Zur Neuabstimmung kam es nicht mehr. ' +
						(n.ergebnis
							? `Der ${n.nummer}. Durchgang hatte «${n.ergebnis}» ergeben; die Zahlen ${AUF_ANFRAGE}.`
							: n.unentschieden
								? // Nicht «hängig» stehen lassen (Laienprüfung 14.10.2026): wie
									// nach einem Rückkommen ohne Durchgang, mit dem nächsten Schritt.
									`Die Zahlen des ${n.nummer}. Durchgangs ${AUF_ANFRAGE}.${naechsterSchritt(t)}`
							: // Das Subjekt vorn: «Das Ergebnis … gibt bekannt, wer …» las sich,
								// als verrate das Ergebnis den Aufbewahrer (Laienprüfung
								// 30.09.2026, L12).
								`Wer das Protokoll aufbewahrt, gibt das Ergebnis des ${n.nummer}. Durchgangs ` +
								'auf Anfrage bekannt.')
				);
				z.push('');
			}
		} else if (t.beschlussvermerk && ohneErgebnis(t)) {
			/*
			 * **Mit dem Beschlussvermerk entfällt der Satz ersatzlos** (Block 7):
			 * Der Beschluss der Leitung steht schon oben im Votenfeld. «Über
			 * diesen Antrag wurde nicht abgestimmt.» wäre daneben nicht nur
			 * überflüssig, sondern falsch — der Vermerk ist gerade die
			 * Erklärung, dass im Saal entschieden wurde und Votum es nur nicht
			 * führt.
			 *
			 * `ohneErgebnis` steht daneben, obwohl dieser Zweig nur mit dieser
			 * Lage erreichbar ist: Träfe es nicht zu, bliebe der Satz stehen.
			 * Die sichere Richtung — ein Vermerk, dessen Grundlage weggefallen
			 * ist, verschweigt dann nichts.
			 */
			// Ä-17 B auch hier: Entschieden wurde im Saal (Codeprüfung 3d, M3).
			// Nur die Tatsache: Abgestimmt wurde in Votum nicht (Review DeepSeek
			// zu Block 7, Befund 1).
			if (t.neuAnZweiterVersammlung) {
				z.push(neuAnZweiterProtokoll(null));
				z.push('');
			}
		} else {
			z.push('Über diesen Antrag wurde nicht abgestimmt.');
			z.push('');
		}

		// Zuletzt, weil die Zusage die Folge aus allem darüber ist.
		pendenzenAnhaengen();
	}

	// ── Schluss ─────────────────────────────────────────────────────────────
	/*
	 * **Die Unterbrechungen** (22.08.2026, Befund D-02). Als eigener Abschnitt
	 * nach den Verhandlungen und nicht zwischen den Traktanden: Eine Pause fällt
	 * oft mitten in ein Geschäft, und sie dorthin zu schreiben zerrisse den
	 * Ablauf, den das Protokoll erzählt. Mit Uhrzeiten, weil genau die im
	 * Streitfall zählen — wer wann nicht im Saal war.
	 *
	 * **Vor der Unterschrift** (berichtigt in der Nachprüfung 23.08.2026). Zuerst
	 * stand der Abschnitt hinter ihr, zwischen Maschinenvermerk und Siegel. Was
	 * unterschrieben wird, muss über der Unterschrift stehen — sonst bezeugt sie
	 * es nicht.
	 */
	const pausen = e.unterbrechungen ?? [];
	if (pausen.length > 0) {
		z.push('## Unterbrechungen');
		z.push('');
		for (const p of pausen) {
			/*
			 * **Die Zeitpunkt-Uhrzeit, nicht die lokale Kurzform.** Die Funktion
			 * `uhrzeit` hier oben schneidet fünf Zeichen ab — richtig für «19:00»
			 * aus dem Formular, falsch für einen ISO-Zeitstempel, aus dem sonst
			 * «2026-» würde. Die aus `datum.ts` rechnet in hiesige Zeit um.
			 */
			const uhr = uhrzeitAusZeitpunkt(p.zeitpunkt);
			if (p.art === 'unterbrochen') {
				z.push(`${uhr} Uhr — die Versammlung wird unterbrochen.${p.text ? ` ${p.text}` : ''}`);
			} else {
				z.push(`${uhr} Uhr — die Versammlung wird fortgesetzt.`);
			}
		}
		z.push('');
	}

	z.push('## Schluss');
	z.push('');
	z.push(
		e.schlusszeit
			? `Die Sitzungsleitung schloss die Versammlung um ${uhrzeit(e.schlusszeit)} Uhr.`
			: 'Die Versammlung ist noch nicht geschlossen; die Schlusszeit ist nachzutragen.'
	);
	z.push('');
	// Der Name über der Zeile, nicht dahinter: Unterschrieben wird darunter, und
	// wer den Ausdruck in die Hand bekommt, soll wissen, wessen Unterschrift dort
	// zu stehen hat. Ohne Angabe bleibt es bei der blossen Zeile.
	z.push(e.sitzungsleitung ? `Die Sitzungsleitung — ${e.sitzungsleitung}:` : 'Die Sitzungsleitung:');
	z.push('');
	z.push(
		e.protokollfuehrung ? `Die Protokollführung — ${e.protokollfuehrung}:` : 'Die Protokollführung:'
	);
	z.push('');
	z.push(
		`Entwurf erzeugt am ${e.erzeugtAm} durch ${e.erzeugtDurch}. Zahlen und Beschlusswortlaute ` +
			'stammen aus der Anwendung und wurden nicht neu formuliert.'
	);
	/*
	 * **Der Maschinenvermerk** (FR-63). Rechtlich nicht zwingend, aber ehrlich —
	 * und im Streitfall entlastend: Wer offenlegt, dass Absätze maschinell
	 * vorbereitet und von einem Menschen verantwortet wurden, steht besser da als
	 * jemand, dem man es nachweist.
	 *
	 * Er steht **unter** dem Erzeugungsvermerk und nicht im Text: Welcher Absatz
	 * aus welcher Feder stammt, liesse sich nach dem Überarbeiten ohnehin nicht
	 * mehr sagen — die Auskunft gilt dem Dokument.
	 */
	if (e.maschinenvermerk) {
		z.push('');
		z.push(e.maschinenvermerk);
	}

	/*
	 * **Der Siegelabschnitt** (22.08.2026) — ganz am Schluss, nach den
	 * Unterschriften.
	 *
	 * Drei Dinge stehen hier bewusst so und nicht anders:
	 *
	 * **Der Prüfweg gehört dazu.** Eine Zeichenkette ohne Anleitung ist
	 * Dekoration; wer prüfen will, muss wissen, womit.
	 *
	 * **Die Reichweite wird ausdrücklich genannt.** Das Siegel deckt Zahlen,
	 * Anwesenheit, Vollmachten und den Verlauf — **nicht diesen Text**. Stünde
	 * der Abdruck unbeschriftet unter dem Protokoll, entstünde der gegenteilige
	 * Eindruck, und der fiele im Streitfall auf den Verwender zurück. Nach der
	 * Rechtsprüfung vom 22.08.2026 ist das die Bedingung, unter der der Aufdruck
	 * überhaupt trägt.
	 *
	 * **Kein «gerichtsfest», kein «rechtssicher».** Es gibt keine Beweisregel,
	 * nur freie Beweiswürdigung (ZPO Art. 157). Eine Zusage, die mehr verspricht,
	 * müsste die Bewirtschaftung gegen sich gelten lassen.
	 */

	if (e.siegel) {
		z.push('');
		z.push('### Abschlusspaket dieser Versammlung');
		z.push('');
		/*
		 * **Beides nebeneinander, nicht das eine statt des anderen.**
		 * «Manifest» ist Hausjargon und fiel dem Textwächter auf; ein blosses
		 * «Inhaltsverzeichnis» nimmt dem Leser aber den Prüfweg: Er muss dann
		 * erraten, welche Datei gemeint ist. Der Kopf von `check-texte.mjs`
		 * verlangt für genau solche Fälle Klartext **und** Fachbegriff, «denn
		 * ein Prüfweg, den man nicht wiederfindet, ist keiner».
		 *
		 * Der Bestand führt es ebenso (`server/paketpruefung.ts`:
		 * «kein Inhaltsverzeichnis («manifest.json»)»). Der Wächter lässt es
		 * durch, weil `ohneDateinamen()` den Dateinamen vor der Jargonprüfung
		 * herausschneidet — die Datei heisst nun einmal so.
		 *
		 * Eine erste Fassung schrieb nur «Inhaltsverzeichnis» und behauptete im
		 * Kommentar, der Dateiname stehe zwei Zeilen tiefer. Er stand in keinem
		 * Zweig (Code-Review 23.09.2026).
		 */
		z.push(
			`Siegel (SHA-256 über das Inhaltsverzeichnis «manifest.json»): ${e.siegel.abdruck}`
		);
		if (e.siegel.bezeugtAm && e.siegel.stelle) {
			z.push(`Bezeugt am ${e.siegel.bezeugtAm} durch ${e.siegel.stelle}.`);
			if (e.siegel.bezeugungAbdruck) {
				z.push(`Prüfsumme der Bezeugung (SHA-256): ${e.siegel.bezeugungAbdruck}`);
			}
		} else {
			z.push('Ein Zeitstempel liegt zu diesem Siegel nicht vor.');
		}
		z.push('');
		z.push(
			'Das Abschlusspaket enthält den festgehaltenen Stand der Stimmberechtigten und ' +
				'den Anwesenheitsverlauf. Dazu die Vollmachten, die Traktanden, jeden ' +
				'Abstimmungsdurchgang und den lückenlosen Verlauf. Wer es prüft, bildet den ' +
				'SHA-256 über die Datei «manifest.json» und muss genau den oben genannten Wert ' +
				'erhalten.'
		);
		z.push('');
		z.push(
			/*
			 * **Ohne Sternchen** (04.09.2026, aus dem Prüfdurchgang). Hier stand
			 * `**…**`, und weder `docx.ts` noch der PDF-Satz kennen Fettdruck
			 * («Kein Fettdruck, keine Bilder»). Die Sterne standen deshalb wörtlich
			 * im Word-Dokument und im PDF, gemessen in beiden.
			 *
			 * Der Satz steht ohnehin allein in seinem Absatz; das trägt ihn.
			 */
			'Dieser Protokolltext ist nicht Teil des Siegels. Er entsteht nach der ' +
				'Versammlung, wird überarbeitet und von der nächsten Versammlung genehmigt. Das ' +
				'Siegel bezeugt die Zahlen und den Ablauf, nicht die Formulierung.'
		);
	}

	return z.join('\n');
}

/**
 * Die Absage, wenn jemand einen leeren Protokolltext sichern will.
 *
 * Steht als Konstante da, weil sie an zwei Orten gebraucht wird: Der Server
 * wirft sie, und das sichernde Feld im Browser zeigt sie, bevor es überhaupt
 * sendet. Zwei Formulierungen für dieselbe Absage wären zwei Fassungen der
 * Wahrheit.
 */
export const LEERES_PROTOKOLL =
	'Das Protokoll ist leer. Ein leerer Text wird nicht gespeichert.';

/**
 * Darf dieses Feld leer gesichert werden?
 *
 * **Die beiden Felder sind hier verschieden, und das ist Absicht.** Eine
 * Protokollnotiz zu einem Traktandum darf man löschen: Wer ein Votum
 * fälschlich erfasst hat, muss es wieder wegbekommen. Der Protokolltext nicht
 * — ein Protokoll ohne Inhalt ist keines.
 *
 * **Warum die Frage hier steht und nicht in der Maske** (08.09.2026):
 * `SicherndesFeld` bedient beide Felder mit demselben Weg und schickte
 * deshalb auch den leeren Protokolltext. Der Server wies ihn zu Recht ab, aber
 * als 400 in der Browserkonsole — sichtbar im Durchstich, unerklärlich für
 * jeden, der ihn dort fand. Die Unterscheidung gehört an eine Stelle, sonst
 * steht sie zweimal da und driftet.
 */
export function darfLeerSein(feld: 'notiz' | 'body'): boolean {
	return feld === 'notiz';
}

/**
 * Prüft den bearbeiteten Text, bevor er gespeichert wird.
 *
 * Bewusst sehr wenig: Das Protokoll gehört der Sitzungsleitung, nicht der
 * Anwendung. Verhindert wird nur das Leere — ein Protokoll ohne Inhalt ist
 * keines, und ein versehentlich geleertes Feld wäre der teuerste Klick des
 * Abends.
 *
 * **Die Schranke bleibt hier, auch wenn die Maske sie vorwegnimmt.** Das
 * sichernde Feld schickt einen leeren Protokolltext seit dem 08.09.2026 gar
 * nicht mehr. Das ist Bequemlichkeit für die Bedienung, kein Ersatz: Ohne
 * JavaScript sendet dasselbe Formular weiterhin klassisch, und wer den
 * Endpunkt von Hand anspricht, kommt ohnehin hier vorbei.
 */
export function pruefeProtokolltext(text: string): string {
	const wortlaut = (text ?? '').trim();
	if (wortlaut.length === 0) {
		throw new Error(LEERES_PROTOKOLL);
	}
	return wortlaut;
}

export type Fassungsart = 'versandt' | 'genehmigt' | 'festgehalten';

export const FASSUNGSARTEN: Record<Fassungsart, string> = {
	versandt: 'versandt',
	genehmigt: 'von der Versammlung genehmigt',
	festgehalten: 'festgehalten'
};

/**
 * Der Satz, der eine festgehaltene Fassung im Verzeichnis beschreibt.
 *
 * Warum überhaupt: «Fassung 2» sagt nichts. «Fassung 2, versandt am 12.08.2026»
 * beantwortet die Frage, die im Streitfall gestellt wird — welchen Text haben
 * die Eigentümer bekommen.
 */
export function fassungInWorten(f: {
	nummer: number;
	art: Fassungsart;
	zeitpunkt: string;
	durch: string | null;
}): string {
	const wer = f.durch ? ` durch ${f.durch}` : '';
	return `Fassung ${f.nummer}, ${FASSUNGSARTEN[f.art]} am ${f.zeitpunkt}${wer}`;
}

/**
 * Der Satz zu einer von der Leitung angesetzten Neuabstimmung (Produktentscheid
 * 30.09.2026: «Ja, immer nennen»).
 *
 * **Die Anordnung, nicht ihre Wirkung** (Fachprüfung 30.09.2026, F-3; Produktentscheid
 * Richtung (a)). Ob die Leitung einen verkündeten Durchgang allein überholen
 * darf, war offen (`docs/freigabe.md`, Punkt (b); Rz. 207 ad Art. 712m) und ist
 * seit H6 verneint: Sie überholt nur noch, was nicht verkündet ist. «Gilt
 * deshalb nicht» stellte das als geklärt dar; «massgebend ist nach ihrer
 * Anordnung» gibt wieder, was geschah, und sagt trotzdem, welches Ergebnis
 * Votum anwendet. Zuerst die Überholung, dann das Ergebnis: Stand es vorn,
 * hielt man es beim Überfliegen für das geltende (Laienprüfung 30.09.2026, L1).
 */
function neuabstimmungssatz(
	n: NonNullable<Protokollzeile['neuabstimmungen']>[number],
	massgebend: number | null,
	nachDemMassgebenden = false
): string {
	const grund = n.begruendung ? ` (Begründung: ${n.begruendung.replace(/[.\s]+$/, '')})` : '';
	/*
	 * **Der Abbruch** (H6, `brecheAbstimmungAb`): Es gab kein Ergebnis, das
	 * überholt worden wäre, und keine Neuabstimmung, die angesetzt wurde. Der
	 * nächste gilt, weil die Versammlung darin entschieden hat.
	 */
	if (n.abgebrochen) {
		const danach = massgebend
			? ` Massgebend ist der ${massgebend}. Durchgang.`
			: nachDemMassgebenden
				? ` Neu abgestimmt wurde im ${n.nummer + 1}. Durchgang.`
				: '';
		return (
			`- Die Sitzungsleitung hat die Abstimmung im ${n.nummer}. Durchgang ohne Ergebnis ` +
			`abgebrochen${grund}; die abgegebenen Stimmen bewirken nichts, ihre Zahlen ${AUF_ANFRAGE}.` +
			danach
		);
	}
	/*
	 * **Der Gleichstand als Grund** (H6, Laienprüfung 14.10.2026). Seit die
	 * Leitung nur überholt, was nicht verkündet ist, endete der überholte
	 * unentschieden. Ohne das läse sich die Anordnung, als habe die Leitung ein
	 * Ergebnis verworfen. Und der nächste gilt dann nicht «nach ihrer
	 * Anordnung», sondern weil die Versammlung darin entschieden hat.
	 */
	const ergebnis = n.unentschieden
		? 'Er endete unentschieden, und der Stichentscheid wurde nicht festgestellt'
		: n.ergebnis
			? `Er hatte «${n.ergebnis}» ergeben`
			: null;
	// Liegt der überholte nach dem massgebenden, gilt dieser aus einem anderen
	// Grund; dann steht nur, wo neu abgestimmt wurde, sonst bleibt offen, ob die
	// Neuabstimmung stattfand (Laienprüfung 30.09.2026, L13). Durchgänge sind
	// fortlaufend nummeriert, der nächste ist der, zu dem die Anordnung führte.
	const geltend = massgebend
		? n.unentschieden
			? `massgebend ist der ${massgebend}. Durchgang.`
			: `massgebend ist nach ihrer Anordnung der ${massgebend}. Durchgang.`
		: nachDemMassgebenden
			? `neu abgestimmt wurde im ${n.nummer + 1}. Durchgang.`
			: null;
	const schluss =
		ergebnis && geltend
			? ` ${ergebnis}; ${geltend}`
			: ergebnis
				? ` ${ergebnis}.`
				: geltend
					? ` ${geltend.charAt(0).toUpperCase()}${geltend.slice(1)}`
					: '';
	return (
		`- Die Sitzungsleitung hat den ${n.nummer}. Durchgang überholt und eine Neuabstimmung ` +
		`angesetzt${grund}.${schluss}`
	);
}

/**
 * Wer die Zahlen früherer Durchgänge nennt (Produktentscheid 30.09.2026: «Nur
 * die Zahlen, auf Anfrage»). Kein Ort und kein Einsichtsrecht ins
 * Abschlusspaket: Es enthält auch Einzelstimmen mit Namen und Weisungen der
 * Vollmachtgeber, belegt ist ein Einsichtsrecht nur für das Protokoll (Rz. 126b
 * ad Art. 712n; Fachprüfung 30.09.2026, F-17). Der Verlauf trägt die Zahlen
 * nicht (F-8). «Wer das Protokoll aufbewahrt», weil das Paket seit dem
 * Produktentscheid vom 30.09.2026 bei derselben Person liegt, also bei der
 * Verwaltung, sonst beim Vorsitz (Art. 712n Abs. 2 sinngemäss; das Gesetz
 * spricht nur vom Protokoll; F-16).
 */
const AUF_ANFRAGE = 'gibt auf Anfrage bekannt, wer das Protokoll aufbewahrt';

/**
 * Der nächste Schritt, wenn an der Versammlung nichts mehr entschieden wurde
 * (H6, Laienprüfung 14.10.2026: «zu ihr kam es nicht mehr» klang, als sei die
 * Sache noch hängig). Derselbe Wortlaut wie nach einem Rückkommen ohne
 * Durchgang (Laienprüfung Reste, L3, L12, L20; Fachprüfung Runde 2, Frage 3).
 */
const NEU_TRAKTANDIEREN =
	'Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung traktandiert ' +
	'werden, auch an einer eigens einberufenen; Anträge dazu gehen möglichst bald an die ' +
	'Stelle, die die Versammlung einberuft.';

/**
 * `NEU_TRAKTANDIEREN` mit führendem Leerzeichen, ausser der Vermerk zur
 * Universalversammlung über dem Ergebnis nennt das Traktandieren schon
 * (`TRAKTANDIEREN_VERLANGEN`): Zwei Sätze zum selben Schritt mit
 * verschiedenem Wortlaut liessen fragen, welcher gilt.
 */
function naechsterSchritt(t: { ausnahmeVermerk?: string | null }): string {
	return t.ausnahmeVermerk?.includes(TRAKTANDIEREN_VERLANGEN) ? '' : ` ${NEU_TRAKTANDIEREN}`;
}

/**
 * Der Satz am Beschluss, wenn die Versammlung nicht beschlussfähig war.
 *
 * **Produktentscheid 01.10.2026:** «fehlende Beschlussfähigkeit nennen.» Der
 * Protokollentwurf stellt die Beschlussfähigkeit bisher nur am Anfang fest
 * (`feststellungszeilen`); am Beschluss selbst stand nichts, und wer abwesend
 * war, liest nur das Protokoll (Fachprüfung, Rz. 230 ad Art. 712m).
 *
 * **Die Tatsache, nicht der Weg** (Produktentscheid 30.09.2026, in Block 5
 * bestätigt): Der Satz nennt, dass die Versammlung bei diesem Beschluss nicht
 * beschlussfähig war, und die Rechtsfolge. Dass der Notweg an einer Sperre
 * vorbeiging, bleibt im Verlauf.
 *
 * **Mit Frist, Berechtigten und Gericht** (Laien- und Fachprüfung 01.10.2026,
 * `quellen/pruefung/berichte/2026-10-01-votum-beschluss-von-hand-block-5.md`).
 * Die erste Fassung sagte nur «der Beschluss kann angefochten werden». Für den
 * Abwesenden läuft die Monatsfrist in der Regel ab der Zustellung genau dieses
 * Protokolls (Rz. 230 ad Art. 712m), und sie ist eine Verwirkungsfrist; eine
 * Rechtsfolge ohne Frist liest sich als Dauerzustand. Der Wortlaut folgt Art.
 * 75 («nachdem es von ihnen Kenntnis erhalten hat») und nicht «ab Erhalt
 * dieses Protokolls»: Für Anwesende und Vertretene läuft die Frist ab der
 * Versammlung.
 *
 * **Die mögliche Ungültigkeit von Anfang an steht bewusst nicht da**
 * (Fachprüfung): Wer das liest, ficht nicht an, und die Anfechtung innert
 * Frist ist der Weg, der in jedem Fall sicher ist (Rz. 213 ad Art. 712m). Die
 * Warnung an die Sitzungsleitung (`VON_HAND_NICHTIGKEITSRISIKO`) nennt sie,
 * weil sie dort vom Festhalten abhalten soll.
 *
 * **Jede Norm an dem Satz, den sie trägt:** die Grundlage der
 * Beschlussfähigkeit am ersten, Art. 75 am zweiten. Ist eine Regel des
 * Reglements hinterlegt, steht deren Fundstelle (Rz. 30 ad Art. 712p; Art. 75
 * erfasst auch die Verletzung der Statuten). Sie läuft über `mitQuelle` wie im
 * Kopf des Protokolls: «(Art. 18)» neben «(ZGB Art. 75)» liesse den Leser im
 * ZGB suchen (Codeprüfung 01.10.2026).
 *
 * **Der Fristbeginn steht da, für beide Gruppen** (Fachprüfung, Runde 2). Die
 * Fassung davor sagte «nachdem er davon erfahren hat»; ein Anwesender bezog
 * «davon» auf die fehlende Beschlussfähigkeit, die er erst im Protokoll las,
 * und rechnete den Monat ab Protokoll. Für ihn läuft er ab der Versammlung
 * (Rz. 230 ad Art. 712m). **Und «auch wer nicht dabei war»** (Laienprüfung,
 * Runde 2): Neben «3 Ja, 1 Nein» las die Abwesende «nicht zugestimmt» als die
 * eine Nein-Stimme und hielt sich nicht für gemeint (Rz. 223 ad Art. 712m).
 * **«Beginnt … mit», nicht «läuft … ab»** (Laienprüfung, Runde 3): «Die Frist
 * läuft … spätestens mit dem Erhalt» las sich, als ende sie dann.
 *
 * **Bei «Abgelehnt» beide Hinweise, in dieser Reihenfolge** (Produktentscheid
 * 02.10.2026: «Beides»): zuerst, dass der Antrag einer beschlussfähigen
 * Versammlung erneut vorgelegt werden kann, dann die Anfechtung. «Wer ihm
 * nicht zugestimmt hat» kehrte dort die Berechtigten um: Die Nein-Stimmenden
 * hielten sich für berechtigt, die unterlegenen Ja-Stimmenden nicht
 * (Fachprüfung Block 5, Runde 2; Rz. 235a ad Art. 712m zur Anfechtung eines
 * Negativbeschlusses). Deshalb steht dort «mit der Ablehnung nicht
 * einverstanden». Bis zum 02.10.2026 stand bei «Abgelehnt» nur die Tatsache.
 *
 * **Was die Klage bei einer Ablehnung leistet, steht dabei** (Laien- und
 * Fachprüfung 02.10.2026): Das Urteil ist kassatorisch (Rz. 234, 235 ad Art.
 * 712m), bei einem Negativbeschluss ohne Zusatzklage ein «zahnloser Tiger»
 * (Rz. 235a). Ohne den Satz las die Eigentümerin «anfechten» als Weg zur
 * Sanierung. «In der Regel», weil das Urteil in den gesetzlich geregelten
 * Fällen den Beschluss ersetzt (Rz. 235a).
 *
 * **Der Fristsatz ist bei beiden Ausgängen derselbe Wortlaut** (`FRISTBEGINN`),
 * damit er nicht an einer Stelle berichtigt wird und an der anderen stehen
 * bleibt.
 *
 * **Am gemeinsamen Abend nennt der Satz die Gemeinschaft** (`gemeinschaft`;
 * Laien- und Fachprüfung 02.10.2026). Das Abenddokument geht an die
 * Eigentümer aller beteiligten Gemeinschaften. «Die Versammlung» las sich
 * dort als der ganze Abend, und «auch wer nicht dabei war» traf wörtlich auf
 * jede Eigentümerin eines anderen Hauses zu; anfechten kann nur, wer der
 * Gemeinschaft angehört (Rz. 223c, 226 ad Art. 712m). «Stimmberechtigt», nicht
 * «Eigentümer» (Fachprüfung, Runde 2): Auch der stimmberechtigte Nutzniesser
 * kann anfechten (Rz. 223a) und hielte sich sonst für nicht gemeint. Die
 * Fundstelle heisst dort «… dieser Gemeinschaft», weil im Dokument mehrere
 * Reglemente gelten.
 * Im Hausprotokoll bleibt der Wortlaut, wie er geprüft ist.
 */
export interface BeschlussfaehigkeitFehlte {
	grundlage: 'gesetz' | 'reglement';
	fundstelle: string | null;
	/** Der Ausgang des festgehaltenen Beschlusses. */
	angenommen: boolean;
}

/** Was nach «Die Frist» kommt; `einwandSatz` setzt «Die Monatsfrist» davor. */
const FRISTBEGINN_REST =
	'beginnt für Anwesende und Vertretene mit der Versammlung, für alle anderen, ' +
	'sobald sie vom Beschluss erfahren, spätestens mit dem Erhalt dieses Protokolls.';
/** Auch im Satz zum Übernehmen ins Votenfeld (`VON_HAND_EINWAND_NICHT_FEST`). */
export const FRISTBEGINN = `Die Frist ${FRISTBEGINN_REST}`;

/** Ohne Schlusspunkt im Zitat: Der Satz setzt seinen eigenen (Laienprüfung E2). */
function ohneSchlusspunkt(t: string): string {
	return t.trim().replace(/[.;,]+$/, '');
}

/** Der erste Satz zum Einwand, in Protokoll und Auswertung gleich. */
function einwandBestimmungSatz(bestimmung: string): string {
	return `Eingewendet wurde diese Bestimmung: «${ohneSchlusspunkt(bestimmung)}».`;
}

/** Der Satz zur Wirkung der Bestimmung, in Protokoll und Auswertung gleich (geprüft E2). */
export const EINWAND_GESETZ_UND_BESTIMMUNG =
	'Nach dem Gesetz hätte der Antrag das nötige Mehr erreicht, nach dieser Bestimmung nicht.';

/**
 * Der Schluss in der Auswertung (Entscheid 0047, 3; Auftrag «Texte nach 0047»,
 * Punkt 6): Die Auswertung wiederholt Grund und Anfechtung nicht, sie verweist
 * auf das Protokoll.
 */
export const EINWAND_AUSWERTUNG_VERWEIS =
	'Weshalb die Sitzungsleitung sie angewandt hat und wie die Ablehnung angefochten werden kann, steht im ' +
	'Protokoll.';

/**
 * Die Frist mit ihrem Beginn (Rz. 230 ad Art. 712m; Fachprüfung Runde 1, F-3;
 * Laienprüfung L-5), in zwei Sätzen (Längenschranke von `check:texte`).
 */
export const EINWAND_AUSWERTUNG_FRIST =
	'Die Frist dafür beträgt einen Monat, seit man davon weiss. Für Anwesende und Vertretene beginnt sie mit der ' +
	'Versammlung, für alle anderen in der Regel mit dem Erhalt des Protokolls.';

/**
 * Die Zeile zum Einwand in der Auswertung (Seite und PDF), unter dem Ergebnis
 * eines Beschlusses von Hand mit dem Grund «Eingewendete Bestimmung». Die
 * ersten zwei Sätze sind die des Protokolls (`einwandSatz`).
 */
export function einwandInDerAuswertung(bestimmung: string): string {
	return (
		`${einwandBestimmungSatz(bestimmung)} ${EINWAND_GESETZ_UND_BESTIMMUNG} ${EINWAND_AUSWERTUNG_VERWEIS} ` +
		EINWAND_AUSWERTUNG_FRIST
	);
}

/**
 * Der Satz zum Einwand einer strengeren Bestimmung (Entscheid 0046, A7).
 *
 * **Was er festhält:** die Bestimmung im Wortlaut der Leitung, dass der Antrag
 * das gesetzliche Mehr erreicht hätte und sie nicht, und warum die Leitung sie
 * angewandt hat. Das Ergebnis nach dem Gesetz steht sonst nirgends: Den
 * überholten Durchgang zeigt das Protokoll nicht (`ueberholungsart`). Dazu
 * der Rückweg, wie bei jeder Ablehnung, die angreifbar sein kann: Gilt die
 * Bestimmung nicht, war das Mehr ungültig (Rz. 100 ad Art. 712n).
 *
 * **Ohne den Weg:** kein «von Hand», kein «Notweg» (Produktentscheid
 * 30.09.2026, `vonHand` oben). Am Abend mit dem Namen der Gemeinschaft.
 */
export function einwandSatz(e: {
	bestimmung: string;
	/** Wie die Bestimmung eingeführt wurde, nach Angabe der Leitung (Laienprüfung E2, R2-L-8). */
	einfuehrung?: string | null;
	/** Nur am gemeinsamen Abend: der Name der Gemeinschaft. */
	gemeinschaft?: string | null;
	/** An der notwendigen baulichen Massnahme: der Weg zur Anordnung durch das Gericht. */
	notwendig?: boolean;
}): string {
	const haus = e.gemeinschaft?.trim();
	const einfuehrung = e.einfuehrung?.trim();
	return (
		`${haus ? `${haus}: ` : ''}${einwandBestimmungSatz(e.bestimmung)} ` +
		(einfuehrung ? `Eingeführt nach Angabe der Sitzungsleitung: ${ohneSchlusspunkt(einfuehrung)}. ` : '') +
		`${EINWAND_GESETZ_UND_BESTIMMUNG} Die ` +
		'Sitzungsleitung hat sie angewandt, weil sie klar gilt und in jeder Hinsicht strenger ist als das ' +
		'Gesetz. Der Antrag ist deshalb abgelehnt; er kann an einer nächsten Versammlung erneut gestellt ' +
		'werden. ' +
		// Fachprüfung E2, F-8, F-10, R2-F-6; Laienprüfung L-11 bis L-13. Befugt ist, wer
		// Eigentümer ist und nicht zugestimmt hat, auch wer nicht dabei war (Rz. 223
		// ad Art. 712m); am Abend nicht die Nachbargemeinschaft (Rz. 223c). Schlichtung
		// Rz. 233a, Ort Rz. 228 (für die Schlichtungsbehörde eine Folgerung).
		`Wer ${haus ? 'Eigentümer in dieser Gemeinschaft ist, ' : ''}der Ablehnung nicht zugestimmt hat und ` +
		'meint, die Bestimmung gelte nicht, kann die Ablehnung innert eines Monats anfechten, auch wer nicht ' +
		'an der Versammlung war. Angefochten wird in der Regel mit einem Schlichtungsgesuch bei der ' +
		'Schlichtungsbehörde am Ort der Liegenschaft (ZGB Art. 712m Abs. 2 und Art. 75). Ein Schreiben an ' +
		'die Verwaltung genügt nicht. Das Gericht hebt die Ablehnung in der Regel nur auf; angenommen ist ' +
		// Der Fristbeginn gleich hinter der Anfechtung, nicht hinter dem Weg nach
		// Art. 647 (Laienprüfung E2, R3-L-2: «Die Frist» zeigte sonst auf jenen).
		`der Antrag damit nicht. Die Monatsfrist ${FRISTBEGINN_REST} ` +
		// F-9: Rz. 235a ad Art. 712m, Rz. 101, 103 ad Art. 712a. Ob die Monatsfrist dort
		// gilt, ist offen (Fachprüfung E2, R3-F-1: Rz. 103 subsidiär, Rz. 235a ordnet den
		// Negativbeschluss der Anfechtung zu); Laienprüfung E2, R2-L-7.
		(e.notwendig
			? 'Geht es um eine notwendige Massnahme, kann jeder Eigentümer zudem beim Gericht verlangen, ' +
				'dass es sie anordnet (ZGB Art. 647 Abs. 2 Ziff. 1). Ob dafür die Monatsfrist der ' +
				'Anfechtung gilt, ist nicht geklärt; handeln Sie sicherheitshalber innert dieser Frist.'
			: '')
	).trimEnd();
}

export function beschlussfaehigkeitFehlteSatz(
	f: BeschlussfaehigkeitFehlte,
	/** Nur am gemeinsamen Abend: der Name der Gemeinschaft, um deren Versammlung es geht. */
	gemeinschaft?: string | null
): string {
	const fundstelle = f.fundstelle?.trim();
	const haus = gemeinschaft?.trim();
	/*
	 * **Am Abend das Reglement vorn, die Fundstelle dahinter** (Codeprüfung
	 * 02.10.2026). `mitQuelle` ergänzt «des Reglements» nur bei einer reinen
	 * Gliederungsangabe; an freiem Text («Art. 18.2», «Reglement Art. 18»)
	 * hinge «dieser Gemeinschaft» sonst ohne Bezug.
	 */
	const reglement = haus
		? `Reglement dieser Gemeinschaft${fundstelle ? `, ${fundstelle}` : ''}`
		: fundstelle
			? mitQuelle(fundstelle)
			: 'Reglement';
	const grundlage = f.grundlage === 'reglement' ? reglement : 'ZGB Art. 712p';
	// «von», nicht «der Gemeinschaft»: Viele Namen tragen die Gattung schon
	// («STWEG …»), und sie stünde doppelt.
	const tatsache =
		`Die Versammlung${haus ? ` von ${haus}` : ''} war bei diesem Beschluss ` +
		`nicht beschlussfähig (${grundlage}).`;
	return `${tatsache} ${anfechtungOhneBeschlussfaehigkeit(f.angenommen, haus)}`;
}

/**
 * Wer anfechten kann und wann die Frist beginnt, an einem Beschluss ohne
 * Beschlussfähigkeit. Eine Stelle für `beschlussfaehigkeitFehlteSatz` und
 * `ausstandNichtBeschlussfaehigSatz` (L7): derselbe Mangel, derselbe Weg.
 */
function anfechtungOhneBeschlussfaehigkeit(angenommen: boolean, haus?: string | null): string {
	const wer = haus ? 'in dieser Gemeinschaft stimmberechtigt ist und ' : '';
	if (!angenommen) {
		return (
			'Der Antrag kann einer beschlussfähigen Versammlung erneut vorgelegt werden. ' +
			`Wer ${wer}mit der Ablehnung nicht einverstanden war, auch wer nicht dabei war, kann sie ` +
			'innert eines Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die ' +
			`Ablehnung in der Regel nur auf; angenommen ist der Antrag damit nicht. ${FRISTBEGINN}`
		);
	}
	return (
		`Wer ${wer}ihm nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert ` +
		`eines Monats beim Gericht anfechten (ZGB Art. 75). ${FRISTBEGINN}`
	);
}

/**
 * L7 unter «Zählt nicht mit», am Beschluss, der von Hand an der Sperre vorbei
 * festgehalten wurde (Produktentscheid 06.11.2026): Nach der Einstellung der
 * Gemeinschaft war die Versammlung bei diesem Beschluss nicht beschlussfähig.
 * Die Tatsache wie bei der fehlenden Beschlussfähigkeit, dazu die Anfechtung
 * an derselben Stelle. Am Abend mit dem Namen der Gemeinschaft.
 */
export function ausstandNichtBeschlussfaehigSatz(angenommen: boolean, gemeinschaft?: string | null): string {
	const haus = gemeinschaft?.trim();
	return (
		`Ohne die Personen im Ausstand war die Versammlung${haus ? ` von ${haus}` : ''} bei diesem ` +
		'Beschluss nicht beschlussfähig; nach der Einstellung der Gemeinschaft zählten sie dafür nicht mit. ' +
		// Laienprüfung L7, L-1: was ohne Anfechtung gilt; Fachprüfung, Frage 1
		// (anfechtbar, nicht nichtig; Rz. 31 ad Art. 712p, Rz. 207 ad Art. 712m).
		// Bei der Ablehnung «die Ablehnung» (Codeprüfung Runde 2, B4; Laien N-3).
		(angenommen ? 'Der Beschluss gilt, bis ein Gericht ihn aufhebt. ' : 'Die Ablehnung gilt, bis ein Gericht sie aufhebt. ') +
		anfechtungOhneBeschlussfaehigkeit(angenommen, haus)
	);
}

/**
 * Der Satz zu L7 am Beschluss, je eingefrorener Wahl. Am Abend mit «die
 * Versammlung von …» wie `beschlussfaehigkeitFehlteSatz` daneben, nicht mit
 * dem Namen davor (Codeprüfung Block 4, N5).
 */
export function ausstandFehlteSatz(f: AusstandFehlte, gemeinschaft?: string | null): string {
	if (f.wahl === 'zaehlt_nicht') return ausstandNichtBeschlussfaehigSatz(f.angenommen, gemeinschaft);
	const haus = gemeinschaft?.trim();
	return haus
		? AUSSTAND_ZAEHLT_PROTOKOLL.replace('wäre die Versammlung bei', `wäre die Versammlung von ${haus} bei`)
		: AUSSTAND_ZAEHLT_PROTOKOLL;
}

/**
 * Der Satz zu den beiden Durchgängen nach Eintritt der Beschlussfähigkeit
 * (Migration 139, `domain/neuabstimmung.ts`).
 *
 * **Beide Durchgänge stehen mit Uhrzeit und Präsenz im Protokoll** (Auftrag;
 * `quellen` Frage 59, Praxis; Rz. 129 ad Art. 712n). Die Uhrzeiten kommen
 * vorformatiert aus der Schale; die Zahlen sind die je Durchgang eingefrorenen
 * Bezugsgrössen und stehen **mit ihrem Bezug** («beim Festhalten», «beim
 * Schluss des Durchgangs»), weil der massgebende Zeitpunkt der der Abstimmung
 * ist und der festgeschriebene Stand davon abweichen kann (Fachprüfung
 * 03.10.2026).
 * Bei einer Handzählung ist der eingefrorene Stand der beim Zählen
 * (Migration 156); der Satz sagt dann «beim Zählen der Hände».
 *
 * **Die Tatsache, nicht der Weg** (Produktentscheid 30.09.2026): «ohne
 * Beschlussfähigkeit festgehalten» und «die Sitzungsleitung hat den Beschluss
 * festgehalten» sind Tatsachen; «Notweg» oder «übergangen» steht nur im
 * Verlauf. **Nur die Annahme ersetzt** (Rz. 202a ad Art. 712g); Ablehnung und
 * «kein Beschluss» lassen den früheren in Kraft (Rz. 207 ad Art. 712m).
 */
export function nachQuorumSatz(n: NonNullable<Protokollzeile['nachQuorum']>): string {
	const quelle =
		n.grundlage === 'reglement' && n.fundstelle ? mitQuelle(n.fundstelle) : 'ZGB Art. 712p';
	const anwesend = (b: Beteiligung | null, wann: string): string =>
		b
			? `Beim ${wann} waren anwesend oder vertreten: ${zahl(b.eigentuemerAnwesend)} von ` +
				`${zahl(b.eigentuemerGesamt)} Stockwerkeigentümern, dazu ` +
				`${zahl(b.kopfstimmenAnwesend)} von ${zahl(b.kopfstimmenGesamt)} Kopfstimmen und ` +
				`${zahl(b.quotenAnwesend)} von ${zahl(b.gesamtquote)} Wertquoten.`
			: '';
	const teile = [
		`Der ${n.ohneQuorum.nummer}. Durchgang wurde um ${n.ohneQuorum.zeitpunkt} Uhr ohne ` +
			`Beschlussfähigkeit festgehalten (${quelle}).`,
		'Die Sitzungsleitung hat den Beschluss festgehalten.',
		anwesend(n.ohneQuorum.anwesend, 'Festhalten'),
		`Nachdem die Versammlung beschlussfähig geworden war, wurde im ${n.danach.nummer}. Durchgang ` +
			`um ${n.danach.zeitpunkt} Uhr erneut abgestimmt.`,
		anwesend(
			n.danach.anwesend,
			n.danach.vonHandGezaehlt ? 'Zählen der Hände' : 'Schluss des Durchgangs'
		),
		n.ausgang === 'angenommen'
			? `Dieser Beschluss ersetzt ${n.ohneQuorum.angenommen ? 'den Beschluss' : 'die Ablehnung'} ` +
				`aus dem ${n.ohneQuorum.nummer}. Durchgang.`
			: n.ausgang === 'abgelehnt'
				? `Im ${n.danach.nummer}. Durchgang wurde der Antrag abgelehnt; ` +
					(n.ohneQuorum.angenommen
						? `der Beschluss aus dem ${n.ohneQuorum.nummer}. Durchgang bleibt in Kraft.`
						: `es bleibt bei der Ablehnung aus dem ${n.ohneQuorum.nummer}. Durchgang.`)
				: `Ein Beschluss kam im ${n.danach.nummer}. Durchgang nicht zustande; ` +
					(n.ohneQuorum.angenommen
						? `der Beschluss aus dem ${n.ohneQuorum.nummer}. Durchgang bleibt in Kraft.`
						: `es bleibt bei der Ablehnung aus dem ${n.ohneQuorum.nummer}. Durchgang.`)
	];
	return teile.filter((t) => t !== '').join(' ');
}

/**
 * Ob die Versammlung bei einem von Hand festgehaltenen Beschluss nicht
 * beschlussfähig war, und nach welcher Grundlage.
 *
 * **Eine Rechnung für beide Protokolle** (Block 6, 02.10.2026). Sie stand als
 * Ausdruck in der Schale des Hausprotokolls; seit das gemeinsame Protokoll
 * des Abends den Satz ebenfalls trägt, rufen beide diese Funktion. Eine Kopie
 * im Abend wäre die Stelle, an der die zwei später auseinanderlaufen.
 *
 * **Je Haus mit den eigenen Grössen:** Momentaufnahme, Stufe und Regel
 * gehören zu einer Versammlung. Am gemeinsamen Abend kann ein Haus an der
 * ersten und ein anderes an der zweiten Versammlung stehen, und nur eines hat
 * eine Regel im Reglement.
 *
 * `null` heisst: kein Satz. Das ist der Fall bei gegebener
 * Beschlussfähigkeit, bei einem gezählten Durchgang (dort hat die Anwendung
 * die Beschlussfähigkeit vor dem Eröffnen verlangt) und wo Stimmkraft oder
 * eingefrorener Stand fehlen.
 */
export function beschlussfaehigkeitFehlteAmBeschluss(e: {
	stimmkraft: Stimmkraftliste | null;
	/** `attendance_json.anwesende` des massgebenden Durchgangs. */
	anwesende: readonly Id[] | null | undefined;
	stufe: Versammlungsstufe;
	regel: Beschlussfaehigkeitsregel | null;
	auszaehlung: Pick<Auszaehlung, 'vonHand' | 'angenommen'> | null | undefined;
}): BeschlussfaehigkeitFehlte | null {
	if (!e.stimmkraft || !e.anwesende || e.auszaehlung?.vonHand === undefined) return null;
	const b = stelleBeschlussfaehigkeitFest(
		e.stufe,
		beteiligungDerAnwesenden(e.stimmkraft, e.anwesende),
		e.regel
	);
	return b.beschlussfaehig
		? null
		: {
				grundlage: b.grundlage,
				fundstelle: b.fundstelle ?? null,
				angenommen: e.auszaehlung.angenommen
			};
}

/**
 * L5 (Migration 174): Fehlte bei diesem Beschluss die Beschlussfähigkeit einer
 * ersten Versammlung? Gerechnet mit derselben Kernfunktion wie
 * `beschlussfaehigkeitFehlteAmBeschluss`, an
 * den Anwesenden des Durchgangs, mit der Regel der ersten Stufe. `null`, wo
 * die Angaben fehlen; dann nennt das Protokoll nur die Einstellung.
 */
export type ErsteFehlte = false | { angenommen: boolean; vonHand: boolean } | null;

export function ersteFehlteAmBeschluss(e: {
	stimmkraft: Stimmkraftliste | null;
	anwesende: readonly Id[] | null | undefined;
	regelErste: Beschlussfaehigkeitsregel | null;
	auszaehlung: Pick<Auszaehlung, 'angenommen' | 'vonHand'> | null | undefined;
}): ErsteFehlte {
	// Anders als dort an jedem Durchgang, nicht nur von Hand: Auch ein
	// abgestimmter Beschluss soll sagen, dass die Bedingung erfüllt war (L7-4).
	if (!e.stimmkraft || !e.anwesende || !e.auszaehlung) return null;
	// Konsultativ ist kein Beschluss; «das war sie bei diesem Beschluss nicht»
	// stünde dort schief (Codeprüfung Block 7, R2-N3). Der Grund steht in der Wertung.
	if ((e.auszaehlung as { keinBeschluss?: { grund?: string } }).keinBeschluss?.grund === 'konsultativ') {
		return null;
	}
	const erreicht = stelleBeschlussfaehigkeitFest(
		'erste',
		beteiligungDerAnwesenden(e.stimmkraft, e.anwesende),
		e.regelErste
	).beschlussfaehig;
	return erreicht
		? false
		: { angenommen: e.auszaehlung.angenommen, vonHand: e.auszaehlung.vonHand !== undefined };
}

/** L7 am Beschluss: die eingefrorene Wahl und der Ausgang. */
export interface AusstandFehlte {
	wahl: Ausstandsbeschlussfaehigkeit;
	angenommen: boolean;
}

/**
 * L7 (Migration 183): Hing die Beschlussfähigkeit bei diesem Beschluss an den
 * Personen im Ausstand? Gerechnet mit derselben Kernfunktion wie
 * `beschlussfaehigkeitFehlteAmBeschluss`, aus dem eingefrorenen
 * `attendance_json` des Durchgangs: ohne die Parteien im Ausstand und ohne
 * die Parteien, die nur über einen Vertreter im Ausstand vertreten sind
 * (`beteiligungOhneAusstand`). Gesetzt nur, wo sie mit ihnen gegeben war
 * (`ausstandsbefund`) und ein Beschluss steht: Eine konsultative Abstimmung
 * ist keiner (`keinBeschluss`); an der Sperre von L7 gibt es sie nicht
 * (Entscheid 0043), wohl aber unter «Zählt mit». `null`, wo die Angaben fehlen: Dann bleibt der Satz weg, wie bei
 * der fehlenden Beschlussfähigkeit.
 */
export function ausstandFehlteAmBeschluss(e: {
	wahl: Ausstandsbeschlussfaehigkeit | null | undefined;
	stimmkraft: Stimmkraftliste | null;
	anwesende: readonly Id[] | null | undefined;
	vertretungen: readonly Vertretung[];
	ausstand: readonly Id[] | null | undefined;
	stufe: Versammlungsstufe;
	regel: Beschlussfaehigkeitsregel | null;
	auszaehlung: Pick<Auszaehlung, 'angenommen' | 'keinBeschluss'> | null | undefined;
}): AusstandFehlte | null {
	if (!e.wahl || !e.stimmkraft || !e.anwesende || !e.auszaehlung || e.auszaehlung.keinBeschluss) return null;
	const { haengtAmAusstand } = ausstandsbefund(
		e.stufe,
		e.stimmkraft,
		e.anwesende,
		e.ausstand ?? [],
		e.vertretungen,
		e.regel
	);
	return haengtAmAusstand ? { wahl: e.wahl, angenommen: e.auszaehlung.angenommen } : null;
}

/**
 * Angenommen, obwohl die Beschlussfähigkeit einer ersten fehlte (L5): wer
 * anfechten kann und wann die Frist beginnt, wie `beschlussfaehigkeitFehlteSatz`
 * (Laienprüfung Block 7, L7-12; Fachprüfung F7-8). Meist nach einem Beschluss
 * von Hand trotz Sperre; sonst, weil während der Abstimmung jemand ging (die
 * Zählung rechnet mit dem Stand beim Schliessen); nur dann steht der Grund
 * davor. Eine Ablehnung bleibt ohne den Satz: Sie
 * lässt sich mit einem neuen Traktandum heilen.
 */
export function neuAnZweiterAnfechtungssatz(vonHand: boolean, gemeinschaft?: string | null): string {
	// Nicht «von Hand festgehalten»: Das Protokoll sagt es nicht (Produktentscheid
	// 30.09.2026, an `vonHand` oben; Review DeepSeek zu Block 7, Befund 3). Den
	// Grund trägt die Zeile davor («das war sie bei diesem Beschluss nicht»).
	const wer = gemeinschaft?.trim() ? 'in dieser Gemeinschaft stimmberechtigt ist und ' : '';
	return (
		// Laienprüfung L7-26: ohne «von Hand» der Grund, warum es fehlte. Die Sperre
		// liess nur mit der Beschlussfähigkeit einer ersten eröffnen; fehlt sie beim
		// Schliessen, sind Stimmen gegangen.
		(vonHand
			? ''
			: // Fachprüfung F7-18: nicht «verlassen»; die Zahl sinkt auch durch eine
				// berichtigte Anwesenheit oder eine weggefallene Vollmacht.
				'Während der Abstimmung ist die Zahl der Anwesenden und Vertretenen gesunken; beim ' +
				'Schliessen war die Versammlung nicht mehr beschlussfähig wie eine erste. ') +
		// Laienprüfung Runde 9: «dem Beschluss», weil davor die Versammlung steht.
		`Wer ${wer}dem Beschluss nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert eines ` +
		`Monats beim Gericht anfechten (ZGB Art. 75). ${FRISTBEGINN}`
	);
}

/**
 * Ein angenommener Rückkommensantrag, der keinen Durchgang getragen hat
 * (Fachprüfung 30.09.2026, F-8): Es bleibt beim geltenden Ergebnis. Liegt
 * es am Folgeantrag, der den Grundantrag nach einem früheren Rückkommen
 * ersetzt hat, nennt der Satz ihn (B2b, zweiter Randfall, Produktentscheid
 * 15.10.2026); sonst lief der Verweis «siehe Traktandum 9» ins Leere.
 */
function rueckkommenOhneDurchgangSatz(
	r: NonNullable<Protokollzeile['rueckkommenOhneDurchgang']>
): string {
	const bleibt = r.folgeantrag
		? r.geltendAbgelehnt
			? // Nicht nur «bei der Ablehnung»: Ohne den Zusatz las man, der frühere
			// Beschluss gelte wieder (Laienprüfung 15.10.2026, P1-a).
			`Es bleibt bei der Ablehnung des Folgeantrags ${r.folgeantrag}; angenommen ist zu dieser Sache nichts, wie oben festgehalten. `
			: `Es bleibt beim Beschluss zum Folgeantrag ${r.folgeantrag}, wie oben festgehalten. `
		: r.geltendAbgelehnt
			? `Es bleibt bei der Ablehnung aus dem ${r.geltenderDurchgang}. Durchgang, wie oben festgehalten. `
			: `Es bleibt beim Beschluss aus dem ${r.geltenderDurchgang}. Durchgang, wie oben festgehalten. `;
	return (
		// Kein früherer Durchgang ist damit erklärt; der Satz sagt nur, dass
		// die Bedingung im Rückkommensantrag griff (Fachprüfung 30.09.2026,
		// F-8; Rz. 133b ad Art. 712n).
		`- Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen ` +
		`(Traktandum ${r.antrag}); erneut abgestimmt wurde nicht. ` +
		bleibt +
		// Der nächste Schritt, und wer ihn geht: traktandieren (Laienprüfung
		// Reste, L3, L12, L20; Fachprüfung Runde 2, Frage 3).
		'Soll neu entschieden werden, muss die Sache an einer nächsten Versammlung traktandiert ' +
		'werden, auch an einer eigens einberufenen; Anträge dazu gehen möglichst bald an die ' +
		'Stelle, die die Versammlung einberuft.'
	);
}

/**
 * Der Satz zum Rückzug, für Protokoll und Auswertung (Schritt F2; `freigabe.md`,
 * «Offen aus H7, Teil D», (h)): Die Auswertung sagte nach einem Rückzug nicht,
 * dass zurückgezogen wurde, und trug nach einer konsultativen Abstimmung den
 * Weg eines offenen Geschäfts. Ein Wortlaut für beide, damit sie nicht
 * auseinanderlaufen.
 */
export function rueckzugssatz(grund: string, nachKonsultativ: boolean): string {
	return nachKonsultativ
		? `Der Antrag wurde nach der konsultativen Abstimmung zurückgezogen: ${grund}`
		: `Der Antrag wurde vor der Abstimmung zurückgezogen: ${grund}`;
}

/**
 * Der Ergebnissatz einer Zeile der Auswertung, für Seite, PDF und Stimmnachweis
 * (Schritt F2; Codeprüfung F2, Befund 3: der Stimmnachweis im Siegelpaket
 * druckte nach einem Rückzug weiter den Weg eines offenen Geschäfts). Der
 * Rückzugssatz nur, wo der massgebende Durchgang konsultativ war; sonst der
 * Satz der Auszählung.
 */
export function ergebnissatzDerAuswertung(z: {
	satz: string | null;
	rueckzug?: string | null;
	auszaehlung?: { keinBeschluss?: { grund: string } | null } | null;
}): string | null {
	return z.rueckzug && z.auszaehlung?.keinBeschluss?.grund === 'konsultativ'
		? rueckzugInDerAuswertung(z.rueckzug, true)
		: z.satz;
}

/**
 * Derselbe Satz für die Auswertung, in einem Absatz mit dem Schluss, den das
 * Protokoll in eigenen Zeilen führt. Der Grund ist freier Text; endet er ohne
 * Satzzeichen, kommt ein Punkt dazu, sonst liefe er in den Schluss hinein.
 */
export function rueckzugInDerAuswertung(grund: string, nachKonsultativ: boolean): string {
	const satz = rueckzugssatz(grund.trim(), nachKonsultativ);
	const mitPunkt = /[.!?…»"]$/.test(satz) ? satz : `${satz}.`;
	// Nach konsultativ mit dem, was die Zahlen zeigen (Laienprüfung F2, S3,
	// mittel): Ohne den Satz las eine Abwesende eine Mehrheit, die dann
	// zurückgezogen wurde.
	return nachKonsultativ
		? `${mitPunkt} Die Zahlen der konsultativen Abstimmung zeigen nur, wie die Anwesenden zum ` +
				'Antrag standen; ein Beschluss ist nicht gefasst worden.'
		: `${mitPunkt} Es wurde nicht abgestimmt.`;
}

/**
 * Der Satz zu einem früheren konsultativen Durchgang (Migration 158).
 *
 * **Mit den Zahlen**, anders als bei überholten Durchgängen sonst («auf
 * Anfrage»): Dort sind die Zahlen eines fehlerhaften oder ersetzten
 * Durchgangs Nebensache, hier sind sie das einzige, was die konsultative
 * Abstimmung festhält. Ohne Schwelle: Gegen sie wurde nichts entschieden, und
 * «nötig 9» neben einer Mehrheit läse sich, als hätte sie gereicht.
 *
 * Exportiert für das Auswertungs-PDF (seit 30.10.2026), damit dort derselbe
 * Satz steht und kein zweiter Wortlaut entsteht.
 */
export function konsultativFruehererSatz(
	k: NonNullable<Protokollzeile['konsultativFrueher']>[number],
	mitNummer = true
): string {
	const satz =
		(mitNummer
			? `- Im ${k.nummer}. Durchgang wurde konsultativ abgestimmt`
			: '- Es wurde konsultativ abgestimmt') +
		// L5 (Codeprüfung Block 7, H1): Die Versammlung war beschlussfähig, nur
		// nicht wie eine erste.
		(k.neuAnZweiter
			? ', weil das Traktandum in der Einladung zur ersten Versammlung nicht zur Abstimmung stand und die ' +
				'Versammlung nicht beschlussfähig war wie eine erste; ein Beschluss entstand dabei nicht.'
			: ', weil die Versammlung nicht beschlussfähig war; ein Beschluss entstand dabei nicht.');
	if (!k.zahlen) return satz;
	const koepfe = spiegelInWorten({ ...k.zahlen.koepfe, schwelle: null }, 'koepfe');
	const quoten = k.zahlen.quoten
		? ` Wertquoten: ${spiegelInWorten({ ...k.zahlen.quoten, schwelle: null }, 'quoten')}.`
		: '';
	return `${satz} Kopfstimmen: ${koepfe}.${quoten}`;
}

/**
 * Ein Stimmenspiegel als Zeile, mit der Schwelle am Schluss.
 *
 * «11 Ja, 4 Nein, 1 Enthaltung, 0 ohne Abgabe (von 16), nötig 9» — die Schwelle
 * dort, wo die Zahl steht, an der sie sich misst, und nicht im Satz darüber.
 */
function spiegelInWorten(sp: Protokollspiegel, art: 'koepfe' | 'quoten'): string {
	/*
	 * **Ob die Abwesenden in der Bezugsgrösse stehen, entscheidet das
	 * Erfordernis** (28.08.2026, zweiter Code-Review). Bei «Mehrheit der
	 * Anwesenden» zählen sie nicht mit; sie dann in dieselbe Aufzählung zu
	 * hängen ergäbe «8 Ja, 1 Nein, 0 Enthaltung, 0 ohne Abgabe, 6 nicht anwesend
	 * (von 9)» — eine Eimersumme von 15 gegen eine Bezugsgrösse von 9. Seit die
	 * Wertung keine Zahlen mehr trägt, löste das nichts mehr auf.
	 *
	 * Die Unterscheidung ist keine Vermutung: `basis` ist die Summe der Eimer,
	 * die nach dem Erfordernis mitzählen. Geht sie mit den Abwesenden auf,
	 * gehören sie hinein.
	 */
	/*
	 * **Die Wohnung des Beklagten, die nicht abstimmt** (Codeprüfung
	 * 30.09.2026, N1). Sie steht in der Bezugsgrösse, aber in keinem der
	 * übrigen Eimer; ohne eigenen Posten stünde sie als «nicht anwesend» da,
	 * auch wenn jemand von ihr im Saal sitzt. Bei den Köpfen steht sie in der
	 * Basis (es gibt sie nur, wo Abwesende dort zählen); bei den Wertquoten nur,
	 * wo die Quotenbasis alle umfasst. Wie die Abwesenden geht sie deshalb in
	 * die Klammer oder dahinter, je nachdem, ob die Eimer mit ihr aufgehen
	 * (Codeprüfung 30.09.2026, M-a).
	 */
	const stumm = sp.stimmtNicht ?? 0;
	// Im Ausstand, aber in der Zahl (1e): wie die Wohnung des Beklagten.
	const ausstand = sp.imAusstand ?? 0;
	const eimer = sp.ja + sp.nein + sp.enthaltung + sp.ohneAbgabe;
	const abwesendeZaehlenMit = eimer + sp.nichtAnwesend + stumm + ausstand === sp.basis;
	const stummInWorten =
		art === 'koepfe'
			? stimmtNichtInWorten(stumm)
			: `${zahl(stumm)} bei der Wohnung des Beklagten, die nicht abstimmt`;
	const ausstandInWorten = imAusstandInWorten(ausstand, art);
	const grundzeile =
		`${zahl(sp.ja)} Ja, ${zahl(sp.nein)} Nein, ${zahl(sp.enthaltung)} Enthaltung, ` +
		`${zahl(sp.ohneAbgabe)} ohne Abgabe` +
		(sp.nichtAnwesend > 0 && abwesendeZaehlenMit
			? `, ${zahl(sp.nichtAnwesend)} nicht anwesend`
			: '') +
		(stumm > 0 && abwesendeZaehlenMit ? `, ${stummInWorten}` : '') +
		(ausstand > 0 && abwesendeZaehlenMit ? `, ${ausstandInWorten}` : '') +
		` (von ${zahl(sp.basis)})` +
		(sp.schwelle !== null ? `, nötig ${zahl(sp.schwelle)}` : '');
	const ausserhalb = [
		...(sp.nichtAnwesend > 0 ? [`${zahl(sp.nichtAnwesend)} nicht anwesend`] : []),
		...(stumm > 0 ? [stummInWorten] : []),
		...(ausstand > 0 ? [ausstandInWorten] : [])
	];
	return ausserhalb.length > 0 && !abwesendeZaehlenMit
		? `${grundzeile}; ${ausserhalb.join(', ')}, ausserhalb der Bezugsgrösse`
		: grundzeile;
}

/**
 * Woran ein Traktandum erkennbar ist, das die Feststellung der
 * Beschlussfähigkeit trägt.
 *
 * Absichtlich eng: «Beschlussfähigkeit» oder «beschlussfähig» im Titel. Die
 * Vorlage nennt es «Begrüssung und Feststellung der Beschlussfähigkeit»,
 * abgewandelte Fassungen behalten das Wort erfahrungsgemäss. Trifft es nicht
 * zu, bleibt der eigene Abschnitt — ein falscher Treffer wäre teurer als ein
 * verpasster.
 */
const TRAEGT_FESTSTELLUNG = /beschlussf(ä|ae)hig/i;

/**
 * Die Feststellung der Beschlussfähigkeit als Zeilen, ohne Überschrift.
 *
 * Ausgelagert, weil sie an zwei Orten stehen kann: unter dem Traktandum, das
 * sie ankündigt, oder in einem eigenen Abschnitt, wenn es kein solches gibt.
 * Zwei Fassungen desselben Textes wären zwei Stellen, an denen er altert.
 */
function feststellungszeilen(e: Protokolleingabe): string[] {
	const z: string[] = [];
	if (e.beschlussfaehigkeit) {
		const b = e.beschlussfaehigkeit;
		/*
		 * **Die tragende Zahl zuerst** (26.08.2026, aus dem Code-Review). Art. 712p
		 * zählt Stockwerkeigentümer; stünde im Protokoll nur die Kopfstimmenzahl,
		 * belegte es das Ergebnis nicht — bei «je Einheit» sind das die Einheiten,
		 * und im ungünstigen Fall läse sich «2 von 3 Kopfstimmen» neben «nicht
		 * beschlussfähig», ohne dass die 1 irgendwo stünde, die es entschied.
		 */
		const stimmenUndQuoten =
			`${zahl(b.kopfstimmenAnwesend)} von ${zahl(b.kopfstimmenGesamt)} Kopfstimmen und ` +
			`${zahl(b.quotenAnwesend)} von ${zahl(b.gesamtquote)} Wertquoten`;
		z.push(
			b.eigentuemerGesamt === null
				? `Anwesend und vertreten sind ${stimmenUndQuoten}.`
				: `Anwesend und vertreten sind ${zahl(b.eigentuemerAnwesend ?? 0)} von ` +
					`${zahl(b.eigentuemerGesamt)} Stockwerkeigentümern, dazu ${stimmenUndQuoten}.`
		);
		z.push('');
		z.push(b.satz);
		/*
		 * **Ob das eine Feststellung war oder eine Rechnung** (Migration 080).
		 *
		 * Ohne festgehaltene Feststellung stehen hier die Zahlen aus dem Moment
		 * der Protokollerstellung. Sie sehen aus wie eine Feststellung zu Beginn,
		 * sind aber der Stand am Schluss — wer um neun ging, fehlt darin. Das
		 * auszusprechen ist keine Zurückhaltung, sondern Pflicht: Ein Protokoll,
		 * das eine Rechnung als Feststellung ausgibt, belegt etwas, das so nie
		 * festgestellt wurde.
		 */
		if (b.festgehalten) {
			z.push('');
			z.push(
				`Festgestellt um ${b.festgehalten.zeitpunkt} Uhr durch ${b.festgehalten.durch}.`
			);
		} else {
			z.push('');
			z.push(
				'Diese Zahlen sind der Stand bei Erstellung des Protokolls; eine Feststellung ' +
					'während der Versammlung ist nicht festgehalten — nachzutragen.'
			);
		}
	} else {
		z.push(
			'Die Beschlussfähigkeit ist nicht festgehalten. Ohne sie steht nicht fest, ob die ' +
				'Versammlung Beschlüsse fassen konnte — nachzutragen.'
		);
	}

	for (const f of e.weitereFeststellungen ?? []) {
		z.push('');
		z.push(
			`Erneut festgestellt um ${f.zeitpunkt} Uhr durch ${f.durch}: ` +
				`${zahl(f.kopfstimmenAnwesend)} von ${zahl(f.kopfstimmenGesamt)} Kopfstimmen und ` +
				`${zahl(f.quotenAnwesend)} von ${zahl(f.gesamtquote)} Wertquoten. ${f.satz}`
		);
	}
	z.push('');
	return z;
}

// ── Die Fusszeile der Ausgaben ──────────────────────────────────────────────

/**
 * Der Vermerk, der auf **jedem Blatt** einer Protokollausgabe steht.
 *
 * **Warum er hier steht und nicht in den Routen** (05.09.2026). Er wurde bis
 * dahin in jeder PDF-Route von Hand zusammengesetzt, und als das Word-Dokument
 * am 05.09.2026 seine Fusszeile bekam, wären daraus vier Fassungen desselben
 * Satzes geworden. Dass jede Ausgabe dasselbe Blatt gleich kennzeichnet, ist
 * keine Absichtserklärung, sondern soll an einer Stelle stehen.
 *
 * **Wozu er dient:** Ein einzelnes Blatt aus einem ausgedruckten Protokoll
 * lässt sich sonst keiner Fassung mehr zuordnen. Die Seitenzahl kommt dazu, sie
 * setzt aber jedes Format selbst — das PDF rechnet sie aus, das Word-Dokument
 * überlässt sie als Feld der Textverarbeitung.
 */
export function protokollfusszeile(e: {
	gemeinschaft: string;
	datum: string;
	stand: string;
}): string {
	return teile([
		e.gemeinschaft,
		`Versammlung vom ${datumLang(e.datum)}`,
		e.stand ? `Stand ${e.stand}` : ''
	]);
}

/**
 * Fügt die Teile mit dem Mittelpunkt zusammen und **lässt leere weg**.
 *
 * Aus dem Code-Review (05.09.2026): Der Name der Gemeinschaft kommt aus einer
 * Abfrage, die nichts finden kann (`gemeinschaft?.name ?? ''`). Ohne diese
 * Prüfung begänne die Fusszeile auf jedem Blatt mit einem Mittelpunkt, und der
 * sähe nach einem verlorenen Wort aus statt nach einer fehlenden Angabe. Die
 * Leerprüfung in den Setzern greift dafür nicht: Sie sieht die ganze Zeile,
 * die ja nicht leer ist.
 */
function teile(stuecke: readonly string[]): string {
	return stuecke.map((t) => t.trim()).filter((t) => t !== '').join(' · ');
}

/**
 * Derselbe Vermerk für das Protokoll eines gemeinsamen Abends.
 *
 * **Der Entwurfsvermerk verdrängt den Stand**, statt neben ihm zu stehen: Wer
 * nur die dritte Seite in der Hand hält, muss sehen, dass das Dokument noch
 * nicht vollständig ist, und ein «Stand» daneben liesse es fertig aussehen.
 */
export function abendfusszeile(e: {
	bezeichnung: string;
	datum: string;
	stand: string;
	luecke: string | null;
}): string {
	return teile([
		e.bezeichnung,
		`Abend vom ${datumLang(e.datum)}`,
		e.luecke ? `ENTWURF — ${e.luecke}` : e.stand ? `Stand ${e.stand}` : ''
	]);
}
