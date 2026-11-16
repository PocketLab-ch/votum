/**
 * Der Verlauf einer Versammlung als PDF (Plan Beschluss von Hand, Block 3,
 * 01.10.2026).
 *
 * **Wofür er da ist.** Der Verlauf liegt im Siegelpaket als
 * `daten/verlauf.json` — vollständig und unveränderlich, aber für niemanden
 * lesbar, der keine Datenbank vor sich hat. Im Streitfall geht ein Dokument
 * heraus, das ein Gericht lesen kann; genau dafür ist dieses Blatt da.
 *
 * **Dieselben Angaben wie die Verlaufsseite**, je Eintrag: Datum, Zeit,
 * Eintrag, Gegenstand, Person, Angaben. Seit dem 08.10.2026 zeigt das Blatt
 * gespeicherte Codewörter ebenso in Worten wie die Seite (über `wertwoerter()`,
 * Kommentar in `siegel.ts`, `trageZusammen`). Die Auflösung des Gegenstands (aus
 * einer Kennung wird «Traktandum 3 ‹Fassadensanierung›») macht die Schale, die
 * die Namen kennt (`siegel.ts`); hier wird nur gezeichnet.
 *
 * **In der Reihenfolge des Ablaufs.** Die Abfrage liefert den Verlauf
 * absteigend, wie die Anzeige: Das Neueste zuerst ist am Bildschirm richtig,
 * auf einem Beweisdokument nicht. Die Zeilen kommen deshalb aufsteigend
 * an — die Schale dreht die Seitenliste um.
 *
 * **Und mit der Uhrwarnung.** Der Verlaufseintrag nennt die Quelle seiner Uhr
 * (`clock_source`); wo sie nicht die Systemuhr war, steht es auf dem Blatt.
 * Ein Zeitpunkt, dem niemand trauen kann, gehört markiert, nicht verschwiegen.
 */
import { A4, mm, umbrich as umbrecheText } from '$lib/domain/textsatz';
import { GRAU, LINIE, hoeheVon, messer, neuesBlatt, zeichneText, type Textstil } from './basis';
import { datumKurz, datumLang, uhrzeitGenau } from '$lib/domain/datum';
import type { PDFPage } from 'pdf-lib';
import type { Versammlung } from '$lib/domain/versammlung';

/** Ein Verlaufseintrag, wie er auf das Blatt kommt. */
export interface VerlaufszeileImBlatt {
	/** Der Zeitpunkt in ISO. Formatiert wird hier, in hiesiger Zeit (AD-12). */
	zeitpunkt: string;
	/** Die Quelle der Uhr; alles ausser `system` wird auf dem Blatt vermerkt. */
	zeitquelle: string;
	/** Was geschah, in Worten (`beschriftung`). */
	eintrag: string;
	/** Der aufgelöste Gegenstand, etwa «Traktandum 3 ‹Fassadensanierung›». */
	gegenstand: string;
	/** Wer handelte. */
	person: string;
	/** Die Angaben in einer Zeile (`angabenInWorten`), oder leer. */
	angaben: string;
}

export interface Verlaufsangaben {
	gemeinschaftName: string;
	versammlung: Versammlung;
	/** Aufsteigend nach Zeitpunkt. */
	zeilen: VerlaufszeileImBlatt[];
	/** Wo das Blatt im Abschlusspaket liegt, für den Fuss. */
	pfadImPaket: string;
	/** Wann die Datei erzeugt wurde. Der Kern liest keine Uhr (AD-1). */
	erzeugtAm: string;
}

export async function erzeugeVerlauf(a: Verlaufsangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(20);
	const breite = A4.breite - 2 * rand;

	const leise = { schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU };
	const klein = { schrift: blatt.schriften.normal, groesse: 8.5, farbe: GRAU };
	const eintragstil = { schrift: blatt.schriften.fett, groesse: 11 };

	const seiten: PDFPage[] = [];
	let seite = neueSeite();
	let y = 0;

	const kurzkopf =
		`Verlauf · ${a.gemeinschaftName} · ${datumLang(a.versammlung.datum)} · ` +
		`${a.zeilen.length} ${a.zeilen.length === 1 ? 'Eintrag' : 'Einträge'}`;

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

	/**
	 * Wie viel Platz eine frische Seite unter dem Seitenkopf bietet: dieselbe
	 * Rechnung wie `umbrich` und `raumFuer`, nur ohne zu zeichnen.
	 */
	const platzAufFrischerSeite =
		A4.hoehe - rand - hoeheVon(kurzkopf, breite, klein) - mm(8) - (rand + mm(14));

	/** Ein Absatz, der vorher nach Platz fragt. */
	function absatz(text: string, stil: Textstil, abstandDavor = 0): void {
		raumFuer(hoeheVon(text, breite, stil) + abstandDavor);
		y = zeichneText(seite, text, rand, y - abstandDavor, breite, stil);
	}

	/**
	 * Ein Absatz, der **innerhalb** umbricht, wenn er höher ist als eine Seite.
	 *
	 * **Warum es das braucht** (Nachzug Block 2c; «Offen aus Block 3», Punkt 7).
	 * `absatz` fragt vorher nach Platz und schiebt den ganzen Absatz auf die
	 * nächste Seite — reicht auch dort der Platz nicht, zeichnete `zeichneText`
	 * weiter und die unteren Zeilen liefen aus dem Blatt. Ein Eintrag mit sehr
	 * vielen Angaben ist genau dieser Fall. Hier wird Zeile für Zeile
	 * gezeichnet und **vor** jeder Zeile geprüft; was nicht mehr passt, geht mit
	 * dem Seitenkopf auf das nächste Blatt.
	 */
	function fliesst(text: string, stil: Textstil, abstandDavor = 0): void {
		const abstand = stil.groesse * (stil.durchschuss ?? 1.35);
		if (abstandDavor > 0 && y - abstandDavor > rand + mm(14)) y -= abstandDavor;
		for (const zeile of umbrecheText(text, breite, messer(stil.schrift, stil.groesse))) {
			if (y - abstand < rand + mm(14)) umbrich();
			y = zeichneText(seite, zeile, rand, y, breite, stil);
		}
	}

	y = A4.hoehe - rand;

	// ── Kopf ──────────────────────────────────────────────────────────────────

	y = zeichneText(seite, a.gemeinschaftName, rand, y, breite, {
		schrift: blatt.schriften.normal,
		groesse: 10,
		farbe: GRAU
	});

	y = zeichneText(seite, 'Verlauf', rand, y - 18, breite, {
		schrift: blatt.schriften.fett,
		groesse: 20
	});

	absatz(
		`${datumLang(a.versammlung.datum)}, ${a.versammlung.uhrzeit} Uhr · ${a.versammlung.ort}`,
		leise,
		mm(2)
	);

	/*
	 * **Die zwei Begriffe des Blatts, einmal erklärt** (Laienprüfung
	 * 01.10.2026, B-2 und B-6). «Beschluss von Hand festgehalten» heisst in der
	 * ganzen Anwendung so und bleibt; ohne einen Satz dazu liest es sich wie
	 * «per Handmehr abgestimmt». «Durchgang» steht in den Gegenständen und in
	 * den Ergebnissen und ist für einen Laien kein Alltagswort.
	 */
	absatz(
		'Jede fachlich bedeutsame Handlung mit Zeitpunkt und handelnder Person, in der Reihenfolge ' +
			'des Ablaufs. Ein Eintrag «Beschluss von Hand festgehalten» heisst: Die Sitzungsleitung ' +
			'hat den Beschluss eingetragen; die Anwendung hat ihn nicht ausgezählt. Ein Durchgang ist ' +
			'eine Abstimmung zu einem Traktandum; zu einem Traktandum kann es mehrere Durchgänge geben.',
		leise,
		mm(3)
	);

	absatz(
		'Die Einträge lassen sich weder ändern noch löschen, auch nicht durch die Anwendung selbst.',
		leise,
		mm(2)
	);

	y -= mm(5);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= mm(8);

	// ── Die Einträge ──────────────────────────────────────────────────────────

	if (a.zeilen.length === 0) {
		absatz('Zu dieser Versammlung gibt es keinen Verlaufseintrag.', {
			schrift: blatt.schriften.fett,
			groesse: 11
		});
	}

	for (const z of a.zeilen) {
		const eineZeile = `${datumKurz(z.zeitpunkt)}, ${uhrzeitGenau(z.zeitpunkt)} · ${z.eintrag}`;
		/*
		 * **Was die Warnung für die Zeit heisst** (Laienprüfung 01.10.2026,
		 * B-3; Wortlaut aus der Wortliste 08.10.2026): Sie nennt, dass die Uhr
		 * die des Geräts war, dass ein Abgleich nicht festgehalten ist, und dass
		 * die Zeit abweichen kann. Das ist die Aussage, die ein Leser braucht.
		 */
		const uhrwarnung =
			z.zeitquelle === 'system'
				? ''
				: 'Diese Uhrzeit stammt von der Uhr des Geräts, auf dem die Anwendung lief; ' +
					'ob diese Uhr abgeglichen war, ist nicht festgehalten. ' +
					'Sie kann von der tatsächlichen Zeit abweichen.';

		/*
		 * **Der Eintrag bleibt beisammen.** Sonst stünde die Zeitangabe am Fuss
		 * der einen Seite und «Person» am Kopf der nächsten, oder die Uhrwarnung
		 * allein oben auf dem Folgeblatt, getrennt von der Zeit, der sie gilt;
		 * bei einem Beweisdokument ist das ein zerrissener Eintrag.
		 *
		 * **Nur ein Eintrag, der höher ist als eine Seite, bricht um** (Nachzug
		 * Block 2c). Die frühere Rechnung schob ihn einmal auf die nächste Seite;
		 * reichte auch die nicht, liefen die unteren Zeilen aus dem Blatt. Dann
		 * bleibt wenigstens der Kopf (Zeit, Person, Gegenstand) zusammen, und der
		 * Rest fliesst über die Seitengrenze.
		 */
		const kopfhoehe =
			hoeheVon(eineZeile, breite, eintragstil) +
			hoeheVon(`Person: ${z.person}`, breite, leise) +
			hoeheVon(`Gegenstand: ${z.gegenstand}`, breite, leise) +
			mm(0.5);
		const ganzhoehe =
			kopfhoehe +
			(z.angaben ? hoeheVon(`Angaben: ${z.angaben}`, breite, leise) : 0) +
			(uhrwarnung ? hoeheVon(uhrwarnung, breite, leise) : 0) +
			mm(6);
		if (ganzhoehe <= platzAufFrischerSeite) raumFuer(ganzhoehe);
		else if (y - kopfhoehe < rand + mm(14)) umbrich();

		fliesst(eineZeile, eintragstil);
		fliesst(`Person: ${z.person}`, leise, mm(0.5));
		fliesst(`Gegenstand: ${z.gegenstand}`, leise);
		if (z.angaben) fliesst(`Angaben: ${z.angaben}`, leise);
		// Die Uhrwarnung steht am Eintrag, nicht in einer Fussnote: Sie gilt
		// genau diesem Zeitpunkt.
		if (uhrwarnung) fliesst(uhrwarnung, leise);

		// Sichtbarer Abstand zwischen den Einträgen, ohne Linienrasen: eine
		// kurze Trennung durch Leerraum genügt bei hundert Einträgen.
		y -= mm(4);
	}

	// ── Fuss ──────────────────────────────────────────────────────────────────

	/*
	 * **«Inhaltsverzeichnis» statt «Manifest»** (Laienprüfung 01.10.2026, B-5),
	 * dieselbe Wendung wie im Handbuch: Klartext für den Leser, der Dateiname
	 * in Klammern für den, der das Paket öffnet. Und das Siegel wird erklärt,
	 * statt nur genannt: Es ist die Prüfsumme über dieses Inhaltsverzeichnis.
	 * **Und «Prüfsumme» sagt, wozu sie taugt** (Laienprüfung Block 5): Wer nur
	 * das Blatt in der Hand hat, soll wissen, dass sich mit dem Paket prüfen
	 * lässt, ob es unverändert ist.
	 */
	const fuss =
		`Erzeugt am ${a.erzeugtAm}. Im Abschlusspaket liegt dieses Blatt unter ${a.pfadImPaket}; ` +
		'seine Prüfsumme steht im Inhaltsverzeichnis (manifest.json) des Pakets, und das Siegel ' +
		'ist die Prüfsumme über dieses Inhaltsverzeichnis. Eine Prüfsumme ist eine Kennzahl, die ' +
		'sich ändert, sobald an einer Datei etwas verändert wird; mit dem Paket lässt sich so ' +
		'prüfen, ob dieses Blatt unverändert ist.';
	raumFuer(hoeheVon(fuss, breite, leise) + mm(8));
	y -= mm(4);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.5,
		color: LINIE
	});
	zeichneText(seite, fuss, rand, y - mm(4), breite, leise);

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
