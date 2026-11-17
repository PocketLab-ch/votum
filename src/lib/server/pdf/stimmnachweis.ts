/**
 * Der Stimmnachweis je Traktandum als PDF (Vorgabe des Auftraggebers, 22.09.2026).
 *
 * **Wofür er da ist.** Im Klagefall oder bei einer Nachfrage soll **ein** Blatt
 * herausgehen: welches Traktandum, welches Erfordernis, welche Quoren, und wer
 * wie gestimmt hat. Nicht der ganze Abend, nicht das ganze Paket.
 *
 * **Das andere Dokument bleibt, wie es ist.** `auswertung.ts` geht an alle
 * Eigentümer und führt **keine** Namen zum Stimmverhalten (NFR-17). Dieses
 * Blatt führt sie und richtet sich an einen anderen Empfänger: die Gegenseite
 * im Streit, das Gericht, oder die Person, die nachfragt. Die Unterscheidung
 * steht deshalb auf dem Blatt selbst und nicht nur in dieser Datei, sonst
 * landet es eines Tages im Sammelversand und der Unterschied war nur eine
 * Absicht.
 *
 * **Je Traktandum, nicht je Durchgang.** Ein Traktandum kann mehrere Durchgänge
 * haben (Wiederholung, Überholung, Rückkommen, FR-44). Angefochten wird der
 * Beschluss, nicht ein Durchgang. Gäbe es ein Blatt je Durchgang, könnte jemand
 * das eines überholten herausgeben; es sähe aus wie das Ergebnis und wäre es
 * nicht. Ein Blatt, das einzeln weitergeht, muss allein richtig sein.
 *
 * **Die Zahlen kommen aus derselben Zeile wie die Auswertung.** `zeile` ist
 * eine `Auswertungszeile`, dieselbe Struktur, die `auswertung.ts` zeichnet.
 * Rechneten die beiden getrennt, stünde eines Tages auf dem einen Blatt eine
 * andere Zahl als auf dem anderen, und niemand wüsste, welche gilt.
 *
 * **Mehrseitige Blätter tragen den Kopf mit.** Vierzig Stimmen ergeben zwei
 * Seiten, achtzig drei. Die erste Fassung zeichnete Kopf und Empfängerhinweis
 * genau einmal; Seite 2 war damit ein loses Blatt mit Klarnamen und
 * Stimmverhalten, ohne Gemeinschaft, ohne Versammlung, ohne Traktandum und
 * ohne den Satz, dass es nicht verteilt werden darf. Das widersprach dem
 * eigenen tragenden Satz oben. Gefunden im Code-Review am 22.09.2026, gemessen
 * an einem Blatt mit achtzig Stimmen.
 *
 * **Und jeder Abschnitt fragt vorher nach Platz.** Ebenfalls die erste Fassung
 * zeichnete den Kopfblock ohne `raumFuer`: Ein Beschlusstext von 2800 Zeichen
 * schob vier Zeilen und die ganze Tabellenüberschrift vom Blatt, und pdf-lib
 * schneidet stillschweigend ab. `auswertung.ts` kennt diese Falle seit dem
 * 09.09.2026 und rechnet dort den Zusatz aus der Textlänge; dieses Modul hatte
 * sie wieder.
 *
 * **Was hier nicht steht, obwohl der Entwurf es zuerst vorsah: die eigene Prüfsumme.**
 * Eine Datei kann ihre eigene Prüfsumme nicht enthalten, die Rechnung wäre
 * zirkulär. Der Fuss nennt deshalb den Pfad im Paket und sagt, dass die
 * Prüfsumme im Manifest steht. Gemerkt beim Bauen am 22.09.2026, der Entwurf
 * ist entsprechend zu lesen.
 */
import { A4, mm } from '$lib/domain/textsatz';
import { GRAU, LINIE, SCHWARZ, hoeheVon, neuesBlatt, zeichneText } from './basis';
import { datumLang } from './traktandenliste';
import type { Auswertungszeile } from './auswertung';
import {
	andereLesartenVon,
	andereLesartInWorten,
	ausstandswahlDesErgebnisses,
	zweitesErgebnisImProtokoll
} from '$lib/domain/auszaehlung';
import { ausstandslesartSatz } from '$lib/domain/lesarten';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import { ergebnissatzDerAuswertung } from '$lib/domain/protokoll';
import type { PDFPage } from 'pdf-lib';
import type { Versammlung } from '$lib/domain/versammlung';

/** Eine abgegebene Stimme, wie sie auf dem Blatt erscheint. */
export interface Stimmzeile {
	/** Die Stimmpartei aus der Momentaufnahme, nicht aus den lebenden Stammdaten (AD-3). */
	name: string;
	/** Die Bezeichnung der Einheit, für die gestimmt wurde. */
	einheit: string;
	/**
	 * Die Wertquote dieser Einheit zum Stichtag, oder `null`, wenn die
	 * Momentaufnahme die Einheit nicht führt.
	 *
	 * **Nicht `0` als Rückfall.** Null Wertquoten ist eine Aussage, und eine
	 * falsche: Sie hiesse, die Einheit trage nichts zum Mehr bei. «unbekannt»
	 * ist die einzige richtige Ausgabe, wenn der Treffer fehlt.
	 */
	quote: number | null;
	wahl: 'yes' | 'no' | 'abstain';
	/**
	 * Ob diese Zeile gezählt hat.
	 *
	 * Eine Berichtigung fügt eine Zeile hinzu, die alte bleibt stehen (AD-5);
	 * gezählt hat die letzte je Einheit. Ohne diese Marke summiert, wer das
	 * Blatt liest, eine berichtigte Einheit doppelt. Deshalb steht sie in der
	 * Tabelle und nicht nur in einer Fussnote.
	 */
	gezaehlt: boolean;
	/**
	 * Ob die Sitzungsleitung erfasst hat statt der Person selbst.
	 *
	 * «Hat gestimmt» und «wurde so erfasst» sind nicht dasselbe, und in der
	 * Betriebsart «einfach» trägt jede Stimme diesen Vermerk.
	 */
	durchSitzungsleitung: boolean;
	/**
	 * Wann die Stimme erfasst wurde, **fertig geschrieben**.
	 *
	 * Die Schale formatiert, nicht dieses Modul: Eine Zeitangabe ohne Zone
	 * hinge am Gerät, und der Kern liest keine Uhr (AD-1). Derselbe Weg wie bei
	 * `erzeugtAm`.
	 */
	zeitpunkt: string;
	/** Nur zum Sortieren, in ISO. Steht nicht auf dem Blatt. */
	erfasstIso: string;
}

export interface Stimmnachweisangaben {
	gemeinschaftName: string;
	versammlung: Versammlung;
	/** Wie die Köpfe gezählt wurden; dieselben Stimmen ergeben sonst ein anderes Ergebnis. */
	zaehlweise: string | null;
	/** Das Traktandum mit Erfordernis, Quoren und Ergebnis. */
	zeile: Auswertungszeile;
	/**
	 * Die Einzelstimmen des massgebenden Durchgangs.
	 *
	 * **Leer heisst nicht «niemand hat gestimmt».** Bei einem von Hand gezählten
	 * Durchgang gibt es keine Einzelstimmen, nur Summen; das sagt `zeile.handzaehlung`,
	 * und das Blatt schreibt es aus. Eine leere Liste ohne diesen Vermerk läse
	 * sich wie eine Versammlung, in der niemand abgestimmt hat.
	 */
	stimmen: Stimmzeile[];
	/**
	 * Die Wahl je Partei eines von Hand festgehaltenen Durchgangs, mit Namen —
	 * oder `null`, wo es keine gibt (Block 3, Punkt 4).
	 *
	 * Sie steht in der Festschreibung (`vonHand.stimmen`), nicht in `vote`: Die
	 * Tabelle verlangt einen offenen Durchgang, und der Beschluss von Hand
	 * entsteht geschlossen. Ohne dieses Feld stünde auf dem Blatt «keine Stimme
	 * erfasst», obwohl die Zahlen darüber aus ebendiesen Wahlen folgen.
	 */
	parteiwahlen: { name: string; wahl: Stimmzeile['wahl'] }[] | null;
	/** Wo das Blatt im Abschlusspaket liegt, für den Fuss. */
	pfadImPaket: string;
	/** Wann die Datei erzeugt wurde. Der Kern liest keine Uhr (AD-1). */
	erzeugtAm: string;
}

const WAHL_IN_WORTEN: Record<Stimmzeile['wahl'], string> = {
	yes: 'Ja',
	no: 'Nein',
	abstain: 'Enthaltung'
};

/**
 * Der Satz, der auf jedem Blatt steht.
 *
 * Er ist der Grund, aus dem dieses Dokument überhaupt getrennt vom
 * Auswertungsblatt existiert, und er gehört deshalb aufs Papier und nicht in
 * eine Übergabenotiz, die verlorengeht.
 */
const EMPFAENGERHINWEIS =
	'Dieses Blatt weist das Stimmverhalten namentlich aus. Es ist für die Beantwortung ' +
	'einer Nachfrage und für den Streitfall bestimmt, nicht zur Verteilung an die ' +
	'Gemeinschaft. Die Auswertung, die an alle Eigentümer geht, führt keine Namen.';

/**
 * Der Vertraulichkeitsvermerk für ein Blatt aus einer geheimen Abstimmung
 * (Produktentscheid 28.09.2026, Migration 141).
 *
 * Das Blatt trägt die Namen auch bei geheimer Abstimmung, sonst wäre der
 * Beschluss nicht nachprüfbar. Lesen können es Verwaltung und Sitzungsleitung;
 * herausgegeben wird es nur einem Gericht, und einer Partei nur ihre eigene
 * Stimme (DSG Art. 25).
 * Seit dem 16.10.2026 nennt der Vermerk, wer das Blatt lesen kann
 * (Verwaltung und Sitzungsleitung, Produktentscheid 16.10.2026) und den
 * Zweck der Herausgabe: Wer anficht, muss belegen können, wie er stimmte
 * (Rz. 223 ad Art. 712m). DSG Art. 25 bleibt genannt, weil die Auskunft an
 * keinen Zweck gebunden ist (Fachprüfung 16.10.2026, Ä-38).
 */
const GEHEIMHINWEIS =
	'Geheime Abstimmung: Dieses Blatt ist vertraulich und gehört nicht zum Protokoll; lesen ' +
	'können es Verwaltung und Sitzungsleitung. Einer Partei wird auf Verlangen nur ihre eigene ' +
	'Stimme herausgegeben (DSG Art. 25), nicht anderen Eigentümern. Herausgegeben wird sie ' +
	'umgehend: Braucht die Partei sie für eine Anfechtung, läuft die Frist von einem Monat ' +
	'(ZGB Art. 75). Einem Gericht wird das Blatt auf dessen Anordnung vorgelegt.';

/**
 * «Stimmpartei» einmal erklärt (Laienprüfung 01.10.2026, B-6).
 *
 * Das Wort steht als Spaltenüberschrift in beiden Tabellen; ohne den Satz
 * bleibt es für einen Laien ein Hauswort. Er steht bei jeder Tabelle, die den
 * Begriff führt, und damit einmal je Blatt.
 *
 * **Ohne «Gemeinschaft» und ohne «festgehaltenen Stand»** (Laienprüfung Block
 * 5, 01.10.2026): Auf einem Blatt über Stockwerkeigentum ist «die
 * Gemeinschaft» die Stockwerkeigentümergemeinschaft, und beim «festgehaltenen
 * Stand» hörte die Leserin auf zu lesen. Sie muss wissen, ob sie mit ihrem
 * Mann als eine Zeile oder als zwei dasteht.
 */
const STIMMPARTEI_ERKLAERUNG =
	'Eine Stimmpartei ist eine einzelne Person oder mehrere Personen, denen eine Einheit ' +
	'gemeinsam gehört (etwa ein Ehepaar oder eine Erbengemeinschaft) und die deshalb gemeinsam ' +
	'abstimmen. Massgebend ist die Liste der Stimmberechtigten dieser Versammlung.';

/*
 * **Die Quote steht als Zahl, wie sie erhoben wurde.** Die erste Fassung gab
 * sie über `toLocaleString('de-CH', { minimumFractionDigits: 2 })` mit zwei
 * Nachkommastellen aus. Das war gleich zweimal falsch: Die Quote ist ein
 * Zähler gegen den Nenner der Gemeinschaft (1000 im Prüfbestand), also eine
 * ganze Zahl, und `auswertung.ts` setzt sie daneben unverändert. Zwei Blätter
 * desselben Pakets hätten dieselbe Quote verschieden geschrieben.
 *
 * Aufgefallen ist es an `check:zeitzone`, der den Aufruf für eine Zeitangabe
 * hielt. Sein Kopf nimmt Zahlen ausdrücklich aus, kann den Empfänger `wert`
 * aber nicht als Zahl erkennen. Der Wächter lag also formal daneben und hat
 * trotzdem einen echten Fehler aufgedeckt; deshalb ist er nicht gelockert
 * worden, sondern dieser Code geändert.
 */

export async function erzeugeStimmnachweis(a: Stimmnachweisangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(20);
	const breite = A4.breite - 2 * rand;

	const leise = { schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU };
	const normal = { schrift: blatt.schriften.normal, groesse: 11 };
	const klein = { schrift: blatt.schriften.normal, groesse: 8.5, farbe: GRAU };

	const seiten: PDFPage[] = [];
	let seite = neueSeite();
	let y = 0;

	/** Die Kurzzeile, die jede Folgeseite allein lesbar macht. */
	const kurzkopf =
		`Stimmnachweis · ${a.gemeinschaftName} · ${datumLang(a.versammlung.datum)} · ` +
		`Traktandum ${a.zeile.nummer} · namentlich, nicht zur Verteilung`;

	function neueSeite(): PDFPage {
		const s = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		seiten.push(s);
		return s;
	}

	function umbrich(): void {
		seite = neueSeite();
		y = A4.hoehe - rand;
		y = zeichneText(seite, kurzkopf, rand, y, breite, klein);
		y -= mm(2);
		seite.drawLine({
			start: { x: rand, y },
			end: { x: A4.breite - rand, y },
			thickness: 0.5,
			color: LINIE
		});
		y -= mm(6);
	}

	/** Neue Seite, wenn unten kein Platz mehr ist. */
	function raumFuer(hoehe: number): boolean {
		if (y - hoehe > rand + mm(14)) return false;
		umbrich();
		return true;
	}

	/** Ein Absatz, der vorher nach Platz fragt. */
	function absatz(text: string, stil: typeof normal, abstandDavor = 0): void {
		raumFuer(hoeheVon(text, breite, stil) + abstandDavor);
		y = zeichneText(seite, text, rand, y - abstandDavor, breite, stil);
	}

	y = A4.hoehe - rand;

	// ── Kopf ──────────────────────────────────────────────────────────────────

	y = zeichneText(seite, a.gemeinschaftName, rand, y, breite, {
		schrift: blatt.schriften.normal,
		groesse: 10,
		farbe: GRAU
	});

	y = zeichneText(seite, 'Stimmnachweis', rand, y - 18, breite, {
		schrift: blatt.schriften.fett,
		groesse: 20
	});

	absatz(
		`${datumLang(a.versammlung.datum)}, ${a.versammlung.uhrzeit} Uhr · ${a.versammlung.ort}`,
		leise,
		mm(2)
	);

	absatz(EMPFAENGERHINWEIS, leise, mm(3));

	if (a.zeile.auszaehlung?.geheim) {
		absatz(GEHEIMHINWEIS, { schrift: blatt.schriften.fett, groesse: 10 }, mm(3));
	}

	y -= mm(5);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= mm(8);

	// ── Das Traktandum ────────────────────────────────────────────────────────

	/*
	 * **«Traktandum 4», nicht nur «4».** Auf einem Blatt, das allein wandert,
	 * sagt eine führende Zahl nicht, wofür sie steht. Gefunden von der Probe
	 * über mehrseitige Blätter: Die Folgeseiten trugen «Traktandum 4», die
	 * erste nur die Ziffer.
	 */
	absatz(`Traktandum ${a.zeile.nummer}: ${a.zeile.titel}`, {
		schrift: blatt.schriften.fett,
		groesse: 14
	});

	if (a.zeile.erfordernis) {
		const grundlage = a.zeile.rechtsgrundlage ? ` (${a.zeile.rechtsgrundlage})` : '';
		absatz(`Erfordernis: ${a.zeile.erfordernis}${grundlage}`, normal, mm(3));
	}

	/*
	 * **Nach welcher Lesart gezählt wurde, und das Ergebnis nach der anderen**
	 * (Review DeepSeek zu Lesarten Block 5, Befund 1). Das Blatt ist der
	 * Nachweis je Traktandum für den Streitfall. Es nannte nur die Zählweise der
	 * Gemeinschaft, und an einer Einsprache nach L3 «je Eigentümer» widersprach
	 * es damit dem eigenen Ergebnis; Lesartzeile und zweites Ergebnis fehlten
	 * seit Block 1. Jetzt dieselben Sätze wie Protokoll und Auswertung, ohne den
	 * Rat an die Leitung; Frist und Berechtigte, wo der Protokollsatz sie nennt
	 * (1a, B3). Ein zweites Ergebnis steht, wo das Protokoll es nennt
	 * (`zweitesErgebnisImProtokoll`; Auftrag «Texte nach 0047», Punkt 2): zu L8
	 * und L10 nur bei Abweichung oder wenn es sich nicht bestimmen liess.
	 *
	 * **Wo L3 wirkt, ohne die Zählweise der Gemeinschaft** (Codeprüfung der
	 * Korrektur, M1): Auf diesem Blatt steht sie über genau diesem Traktandum,
	 * und daneben nannte die Lesartzeile die andere. Ob L3 wirkt, zeigt die
	 * Auszählung: `andereZaehlweise` rechnet sie nur dort.
	 */
	const l3Wirkt = a.zeile.auszaehlung?.andereZaehlweise != null;
	if (a.zaehlweise && !l3Wirkt) absatz(a.zaehlweise, leise, mm(1));
	if (a.zeile.lesart) absatz(a.zeile.lesart, leise, mm(1));
	/*
	 * A5, Punkt 5: die Lesart L1 nennt keine Zeile im Erfordernis, `zeile.lesart`
	 * trägt die Zeilen zu L2, L4, L6, L9, L11, L12, L17 und L13 sowie zu L3
	 * (`holeAuswertung` in `server/auswertung.ts`). Das zweite Ergebnis nach der anderen Wahl zu L1
	 * steht unten (`andereLesartInWorten`), aber weder die Lesart noch der
	 * Ausstand, an dem sie hängt, standen über ihm. Nachgeholt mit den Worten
	 * des Katalogs (`ausstandslesartSatz`, mit Fundstellen, weil dieses Blatt
	 * für Nachfrage und Streitfall bestimmt ist), nur wo der Ausstand den
	 * Nenner berührt (`andereAusstandslesart`).
	 */
	const l1 = a.zeile.auszaehlung?.andereAusstandslesart;
	if (l1) {
		absatz(ausstandslesartSatz(ausstandswahlDesErgebnisses(l1), true), leise, mm(1));
	}

	// Nach einem Rückzug auf eine konsultative Abstimmung der Rückzug, wie in der
	// Auswertung (Schritt F2; Codeprüfung F2, Befund 3).
	const ergebnissatz = ergebnissatzDerAuswertung(a.zeile);
	if (ergebnissatz) {
		absatz(ergebnissatz, { schrift: blatt.schriften.fett, groesse: 11 }, mm(3));
		if (a.zeile.auszaehlung) {
			const geheim = a.zeile.auszaehlung.geheim;
			const nachAndererLesart = andereLesartenVon(a.zeile.auszaehlung)
				.filter(zweitesErgebnisImProtokoll)
				.map((r) => andereLesartInWorten(r, geheim).protokoll)
				.filter((t): t is string => t !== null)
				.join(' ');
			if (nachAndererLesart) absatz(nachAndererLesart, leise, mm(1));
		}
	} else {
		/*
		 * **Kein Ergebnissatz ist kein leeres Feld, sondern eine Aussage.**
		 * `satz` fehlt, wo kein Erfordernis festgehalten oder nicht ausgezählt
		 * wurde; `durchgangId` hängt nicht an dieser Bedingung, also entsteht
		 * das Blatt trotzdem. Ohne diesen Zweig trüge es alle Namen und keine
		 * Ergebnisaussage. `auswertung.ts` behandelt denselben Fall ausdrücklich.
		 */
		absatz(
			'Zu diesem Traktandum liegt kein ausgewertetes Ergebnis vor. Die Stimmen unten sind erfasst, ' +
				'das Mehr wurde aber nicht festgehalten.',
			{ schrift: blatt.schriften.fett, groesse: 11 },
			mm(3)
		);
	}

	/*
	 * **Die Beschlussfähigkeit steht nicht auf dem Blatt, und das ist eine
	 * Lücke.** Der Entwurf verlangt sie unter «Was auf das Blatt gehört». Der
	 * Code-Review meldete, `zeile.auszaehlung` liefere sie mit; nachgemessen am
	 * 22.09.2026 trifft das nicht zu, `Auszaehlung` führt Köpfe, Quoten,
	 * Betroffene und das Ergebnis, aber keine Beschlussfähigkeit. Sie liegt in
	 * `$lib/domain/beschlussfaehigkeit` und müsste durch die Auswertung
	 * durchgereicht werden. Das ist ein eigener Eingriff in eine geteilte
	 * Strecke und gehört nicht nebenbei in diesen Block; im Entwurf steht es
	 * als offener Punkt.
	 */

	if (a.zeile.beschlusstext) absatz(a.zeile.beschlusstext, normal, mm(2));

	// Nach einem Rückkommen über einen Folgeantrag: wie der Durchgang mit dem
	// anderen Traktandum zusammenhängt (Plan Folgeantrag nach Rückkommen, Soll 6).
	if (a.zeile.ersetzung) absatz(ersetzungInKuerze(a.zeile.ersetzung), leise, mm(2));

	// «Weitere», nicht «frühere»: Der überholte kann nach dem massgebenden
	// liegen (erfolgloses Rückkommen, Migration 131). Wie Auswertung und PDF.
	// «Massgebend» bleibt seit H6, aus dem Grund in `pdf/auswertung.ts`.
	if (a.zeile.frueherenDurchgaenge > 0) {
		const wieOft =
			a.zeile.frueherenDurchgaenge === 1
				? 'einen weiteren Durchgang'
				: `${a.zeile.frueherenDurchgaenge} weitere Durchgänge`;
		const durchRueckkommen = a.zeile.frueherenDurchRueckkommen
			? `, davon ${a.zeile.frueherenDurchRueckkommen} durch ein Rückkommen ersetzt`
			: '';
		const erfolglos = a.zeile.rueckkommenErfolglos
			? // Seit dem 30.09.2026 nur noch ohne Beschluss; eine Ablehnung ersetzt
				// («Nein heisst Nein», `docs/freigabe.md`, Punkt (a)).
				' Ein Rückkommen wurde beschlossen, ein Beschluss kam dabei aber nicht zustande.'
			: '';
		absatz(
			`Zu diesem Traktandum gab es ${wieOft}${durchRueckkommen}. Massgebend ist der hier ausgewiesene Durchgang.${erfolglos}`,
			leise,
			mm(2)
		);
	}

	if (a.zeile.stichentscheid) {
		const s = a.zeile.stichentscheid;
		absatz(
			`Stichentscheid durch ${s.wer}` +
				// Dieses Blatt führt die Einzelstimmen mit Namen; ohne den Vermerk
				// stünde die Eigentümerin im Vorsitz scheinbar zweimal in der Zählung
				// (Codeprüfung 07.10.2026, M1).
				(s.eigentuemer
					? ' im Vorsitz, selbst Stockwerkeigentümer (in der Zählung nicht enthalten)'
					: '') +
				`: ${WAHL_IN_WORTEN[s.wahl]}.` +
				(s.begruendung ? ` ${s.begruendung}` : ''),
			normal,
			mm(2)
		);
	}

	y -= mm(6);

	// ── Die Stimmen ───────────────────────────────────────────────────────────

	if (a.parteiwahlen) {
		/*
		 * **Die Wahl je Partei** (Block 3, Punkt 4). Der Beschluss von Hand
		 * trägt sie in der Festschreibung; das Blatt weist die Erfassung durch
		 * die Sitzungsleitung aus, nicht den Weg dorthin: Dass keine Abstimmung
		 * stattfand, gehört nicht nach aussen (Produktentscheid 01.10.2026,
		 * «fehlende Beschlussfähigkeit nennen» und die Linie «Tatsache, nicht
		 * Weg»).
		 */
		absatz('Die Wahl je Partei', { schrift: blatt.schriften.fett, groesse: 12 });
		/*
		 * **B-1 der Laienprüfung vom 01.10.2026:** Ohne diesen Satz wirkt die
		 * Tabelle wie einzeln abgegebene Stimmen. Die Stimmpartei wird einmal auf
		 * dem Blatt erklärt (B-6), weil das Wort nur im Haus geläufig ist.
		 *
		 * **Nicht «nicht einzeln abgegeben»** (Laienprüfung Block 5): Über einer
		 * Tabelle, die je Partei eine Stimme zeigt, widersprach das dem Bild.
		 * Gemeint ist, wer eingetragen hat.
		 */
		absatz(
			'Von der Sitzungsleitung je Stimmpartei erfasst',
			{ schrift: blatt.schriften.fett, groesse: 11 },
			mm(2)
		);
		absatz(
			'Die Stimmparteien haben ihre Stimme nicht selbst in der Anwendung abgegeben. Die ' +
				'Sitzungsleitung hat für jede eingetragen, wie sie gestimmt hat. ' +
				STIMMPARTEI_ERKLAERUNG,
			leise,
			mm(2)
		);
		y -= mm(3);

		const spalte = { name: rand, wahl: rand + mm(112) };
		const namensbreite = mm(106);

		function kopfzeile(): void {
			for (const [text, x] of [
				['Stimmpartei', spalte.name],
				['Stimme', spalte.wahl]
			] as const) {
				seite.drawText(text, { x, y, size: 9, font: blatt.schriften.fett, color: GRAU });
			}
			y -= mm(2);
			seite.drawLine({
				start: { x: rand, y },
				end: { x: A4.breite - rand, y },
				thickness: 0.5,
				color: LINIE
			});
			y -= mm(4);
		}

		kopfzeile();

		const sortiert = [...a.parteiwahlen].sort((x, z) =>
			x.name.localeCompare(z.name, 'de-CH', { numeric: true })
		);
		for (const p of sortiert) {
			const namenshoehe = hoeheVon(p.name, namensbreite, { ...normal, groesse: 10 });
			if (raumFuer(Math.max(namenshoehe, mm(5)) + mm(5))) kopfzeile();

			// Auf der Oberkante zeichnen, wie in der Stimmtabelle: Ein
			// umbrochener Name darf die Stimme nicht in die nächste Zeile
			// schieben.
			const oben = y;
			y = zeichneText(seite, p.name, spalte.name, oben, namensbreite, {
				schrift: blatt.schriften.normal,
				groesse: 10
			});
			seite.drawText(WAHL_IN_WORTEN[p.wahl], {
				x: spalte.wahl,
				y: oben,
				size: 10,
				font: blatt.schriften.normal,
				color: SCHWARZ
			});
			y -= mm(1);
		}
	} else if (a.zeile.auszaehlung?.vonHand) {
		/*
		 * **Als Summen festgehalten.** Auch hier gibt es keine Einzelstimmen;
		 * «von Hand gezählt» wäre eine Behauptung über den Weg, die auf dieses
		 * Blatt nicht gehört. **Die Erfassung durch die Sitzungsleitung dagegen
		 * steht da** (B-1): Sie ist die Angabe, die der Leser braucht, um die
		 * Zahlen einzuordnen. Die Zahlen selbst stehen im Ergebnissatz oben.
		 * «Erfasst und eingetragen» klang nach gezählt (Laienprüfung Block 5);
		 * der Satz sagt deshalb, was die Anwendung nicht getan hat, wie auf dem
		 * Verlaufsblatt.
		 */
		absatz('Als Summen erfasst, keine Einzelstimmen', {
			schrift: blatt.schriften.fett,
			groesse: 11
		});
		absatz(
			'Die Sitzungsleitung hat die Zahlen eingetragen; die Anwendung hat nicht ausgezählt.',
			leise,
			mm(2)
		);
		absatz(
			'Die Zahlen stehen im Ergebnissatz oben. Wer eine Auszählung bestreitet, findet hier keine ' +
				'Einzelstimmen, weil keine erfasst wurden.',
			leise,
			mm(2)
		);
	} else if (a.zeile.handzaehlung) {
		absatz('Von Hand gezählt, keine Einzelstimmen', {
			schrift: blatt.schriften.fett,
			groesse: 11
		});
		const vermerk = a.zeile.handzaehlung.vermerk;
		absatz(
			vermerk
				? `Vermerk der Sitzungsleitung: ${vermerk}`
				: 'Die Sitzungsleitung hat keinen Vermerk zur Zählweise hinterlegt.',
			leise,
			mm(2)
		);
		absatz(
			'Die Summen stehen im Ergebnissatz oben. Wer eine Auszählung bestreitet, findet hier keine Einzelstimmen, weil keine erfasst wurden.',
			leise,
			mm(1)
		);
	} else if (a.stimmen.length === 0) {
		absatz('Zu diesem Traktandum wurde keine Stimme erfasst.', {
			schrift: blatt.schriften.fett,
			groesse: 11
		});
	} else {
		absatz('Die einzelnen Stimmen', { schrift: blatt.schriften.fett, groesse: 12 });
		absatz(STIMMPARTEI_ERKLAERUNG, leise, mm(2));
		y -= mm(3);

		const spalte = {
			name: rand,
			einheit: rand + mm(52),
			quote: rand + mm(104),
			wahl: rand + mm(126),
			zeit: rand + mm(148)
		};
		const einheitsbreite = mm(50);

		function kopfzeile(): void {
			for (const [text, x] of [
				['Stimmpartei', spalte.name],
				['Einheit', spalte.einheit],
				['Wertquote', spalte.quote],
				['Stimme', spalte.wahl],
				['Erfasst', spalte.zeit]
			] as const) {
				seite.drawText(text, { x, y, size: 9, font: blatt.schriften.fett, color: GRAU });
			}
			y -= mm(2);
			seite.drawLine({
				start: { x: rand, y },
				end: { x: A4.breite - rand, y },
				thickness: 0.5,
				color: LINIE
			});
			y -= mm(4);
		}

		kopfzeile();

		/*
		 * **Nach Einheit, dann nach Zeit.** Die Abfrage liefert in
		 * Abgabereihenfolge; eine berichtigte und die zählende Zeile derselben
		 * Einheit lägen dann weit auseinander, auf mehrseitigen Blättern auf
		 * verschiedenen Seiten. Der Satz «gezählt hat je Einheit die letzte»
		 * wäre am Blatt nur mit Blättern nachzuvollziehen.
		 */
		const sortiert = [...a.stimmen].sort(
			(x, z) =>
				// `numeric`, sonst stünde «Wohnung 10» vor «Wohnung 2».
				x.einheit.localeCompare(z.einheit, 'de-CH', { numeric: true }) ||
				x.erfasstIso.localeCompare(z.erfasstIso)
		);

		for (const s of sortiert) {
			const namenshoehe = hoeheVon(s.name, mm(48), { ...normal, groesse: 10 });
			const einheitshoehe = hoeheVon(s.einheit, einheitsbreite, { ...normal, groesse: 10 });
			if (raumFuer(Math.max(namenshoehe, einheitshoehe, mm(5)) + mm(5))) kopfzeile();

			const farbe = s.gezaehlt ? SCHWARZ : GRAU;
			const zellenstil = { schrift: blatt.schriften.normal, groesse: 10, farbe };

			// Beide Freitextspalten brechen um, statt in die Nachbarspalte zu
			// laufen: Eine Einheitsbezeichnung wie «Attikawohnung mit Terrasse
			// Nr. 12 West» ist doppelt so breit wie ihre Spalte.
			const nachName = zeichneText(seite, s.name, spalte.name, y, mm(48), zellenstil);
			const nachEinheit = zeichneText(seite, s.einheit, spalte.einheit, y, einheitsbreite, zellenstil);

			for (const [text, x] of [
				[s.quote === null ? 'unbekannt' : String(s.quote), spalte.quote],
				[WAHL_IN_WORTEN[s.wahl], spalte.wahl],
				[s.zeitpunkt, spalte.zeit]
			] as const) {
				seite.drawText(text, { x, y, size: 10, font: blatt.schriften.normal, color: farbe });
			}

			y = Math.min(nachName, nachEinheit);

			const vermerke: string[] = [];
			if (!s.gezaehlt) vermerke.push('berichtigt, hat nicht gezählt');
			if (s.durchSitzungsleitung) vermerke.push('durch die Sitzungsleitung erfasst');
			if (vermerke.length > 0) {
				y = zeichneText(
					seite,
					vermerke.join(' · '),
					spalte.name + mm(3),
					y + mm(1),
					breite - mm(3),
					klein
				);
			}

			y -= mm(1);
		}

		const berichtigt = a.stimmen.filter((s) => !s.gezaehlt).length;
		if (berichtigt > 0) {
			absatz(
				`${berichtigt === 1 ? 'Eine Zeile ist grau' : `${berichtigt} Zeilen sind grau`} und hat nicht gezählt: Eine Berichtigung fügt eine neue Zeile hinzu, die frühere bleibt stehen. Gezählt hat je Einheit die letzte.`,
				leise,
				mm(3)
			);
		}
	}

	// ── Fuss ──────────────────────────────────────────────────────────────────

	const fuss =
		`Erzeugt am ${a.erzeugtAm}. Im Abschlusspaket liegt dieses Blatt unter ${a.pfadImPaket}; ` +
		'seine Prüfsumme steht im Manifest des Pakets, und das Manifest trägt das Siegel. ' +
		'Ein einzelnes Blatt lässt sich damit prüfen, ohne dass die übrigen herausgehen.';
	raumFuer(hoeheVon(fuss, breite, leise) + mm(8));
	y -= mm(4);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.5,
		color: LINIE
	});
	zeichneText(seite, fuss, rand, y - mm(4), breite, leise);

	/*
	 * Die Seitenzahl kommt zum Schluss, weil die Gesamtzahl vorher nicht
	 * feststeht. Ohne sie merkt niemand, dass ein Blatt unvollständig
	 * weitergegeben wurde.
	 */
	seiten.forEach((s, i) => {
		s.drawText(`Seite ${i + 1} von ${seiten.length}`, {
			x: A4.breite - rand - mm(30),
			y: rand - mm(4),
			size: 8.5,
			font: blatt.schriften.normal,
			color: GRAU
		});
	});

	return blatt.dokument.save();
}
