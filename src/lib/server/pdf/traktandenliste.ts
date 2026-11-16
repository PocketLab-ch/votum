/**
 * Die Traktandenliste als PDF (Story 3.6, FR-17).
 *
 * Zwei Ausprägungen aus denselben Daten:
 *
 *   - **Liste** — A4 hochkant, für die Einladung. Vollständig, mit Inhalt und
 *     Mehrheitserfordernis je Traktandum.
 *   - **Präsentation** — A4 quer, grosse Schrift, ruhiger Aufbau. Für den
 *     Beamer, und dort zählt Lesbarkeit aus zehn Metern mehr als Vollständigkeit:
 *     Sie zeigt Titel und Kurzfassung, nicht den ganzen Inhalt.
 *   - **Einladung** — die Liste mit einem Anschreiben davor (23.08.2026,
 *     Prüflauf I, B-14). Bis dahin war die «Einladung» buchstäblich die
 *     Traktandenliste: kein Absender, keine Anrede, kein Einberufungssatz, kein
 *     Hinweis auf die Vertretung. Ein Blatt, das mit «Traktandenliste» beginnt
 *     und mit Traktandum 11 endet, ist keine Einberufung — und die Einberufung
 *     ist das, was im Anfechtungsfall geprüft wird (ZGB Art. 712n Abs. 1).
 *
 * Drei Ausprägungen und nicht drei Erzeuger: Was auf dem Beamer steht, muss mit
 * dem übereinstimmen, was in der Einladung stand. Getrennte Erzeuger liefen
 * auseinander, und die Abweichung fiele im Saal auf — vor allen Eigentümern.
 */
import { rgb } from 'pdf-lib';
import { erfordernisInWorten, herleitung, klammer, mehrheitGesetzt } from '$lib/domain/auszaehlung';
import { typdefinition } from '$lib/domain/regelwerk';
import { holeRegelwerkFuerAnzeige } from '$lib/rules';
import { EINSPRACHE_KNOTEN } from '$lib/domain/entscheidbaum';
import { datumLang } from '$lib/domain/datum';
import {
	einberufungssatz,
	gemeinschaftssatz,
	vertretungssatz,
	beschlussfaehigkeitssatz,
	NEUTRAKTANDUM_VERWEIS,
	NEUTRAKTANDUM_ZEICHEN
} from '$lib/domain/einladung';
import type { Neutraktandenfussnote } from '../neutraktanden';
import type { Beschlussfaehigkeitsregel } from '$lib/domain/beschlussfaehigkeit';
import { A4, A4_QUER, mm } from '$lib/domain/textsatz';
import { antragstellerInWorten, type Traktandum } from '$lib/domain/traktanden';
import { verwaltungssatzEinladung } from '$lib/domain/mehrhinweise';
import type { Verwaltungsvollmachtwahl } from '$lib/domain/lesarten';
import type { NummerierterKnoten } from '$lib/domain/traktandenbaum';
import type { Versammlung } from '$lib/domain/versammlung';
import {
	briefkopfBrauchbar,
	GRAU,
	LINIE,
	hoeheVon,
	legeBriefkopfUnter,
	neuesBlatt,
	zeichneText,
	type Blatt
} from './basis';

export type Ausprägung = 'liste' | 'praesentation' | 'einladung';

export interface Listenangaben {
	versammlung: Versammlung;
	gemeinschaftName: string;
	traktanden: NummerierterKnoten<Traktandum>[];
	/** Die Briefkopfvorlage des Betreibers, falls hinterlegt. */
	briefkopf?: Uint8Array | null;
	/** Wie viel oben freibleiben muss, damit der Briefkopf nicht überschrieben wird. */
	briefkopfHoeheMm?: number;
	/** Auf allen Seiten oder nur auf der ersten. */
	briefkopfAlleSeiten?: boolean;
	/**
	 * Was das Anschreiben der Einladung braucht. Nur für `art === 'einladung'`;
	 * fehlt es, bleibt die Einladung eine Traktandenliste mit Anrede.
	 */
	einladung?: Einladungsangaben;
	/**
	 * Der Stand einer provisorischen Fassung, als ISO-Datum (Praxisdurchlauf
	 * 28.08.2026). Ist er gesetzt, trägt das Blatt einen deutlichen Vermerk
	 * «nicht freigegeben» unter dem Kopf. Hereingereicht wie `einladung.datum`:
	 * Ein `new Date()` mitten im Satzbau liesse sich nicht prüfen.
	 */
	provisorischerStand?: string;
	/**
	 * Die Namen der Parteien, für den Hinweis bei der Einsprache
	 * (`einladungshinweisZu`). Fehlt er oder ein Name, steht der Satz ohne Namen.
	 */
	parteinamen?: ReadonlyMap<string, string>;
	/**
	 * Neue Traktanden einer zweiten Versammlung nach der Vorgabe von L5
	 * (`holeNeutraktandenfussnote`, Migration 174): Ihr Titel trägt das
	 * Zeichen, der Satz steht einmal unter der Liste. Nicht auf dem Beamer.
	 */
	neutraktanden?: Neutraktandenfussnote | null;
	/**
	 * L8 (Migration 184): Jedes Traktandum mit Häkchen trägt den Satz zu den
	 * Vollmachten der Verwaltung, je nach Wahl der Gemeinschaft (unter
	 * «Die Sitzungsleitung entscheidet» seit G7, 08.11.2026). Die Wahl kommt
	 * vom Aufrufer (`holeLesarten`), eingefroren wie die Fussnote; fehlt sie,
	 * bleibt der Satz weg.
	 */
	verwaltungL8?: Verwaltungsvollmachtwahl;
}

export interface Einladungsangaben {
	/** Wer einlädt — steht über der Unterschrift. Ohne Briefkopf der einzige Absender. */
	absender: string;
	/**
	 * Das Datum des Schreibens, als ISO-Datum.
	 *
	 * **Hereingereicht, nicht hier erzeugt**: Ein `new Date()` mitten im
	 * Satzbau liesse sich nicht prüfen, und zwei Abrufe am selben Tag müssen
	 * dasselbe Blatt ergeben.
	 */
	datum: string;
	/** Ort des Schreibens, etwa «Bern». Fehlt er, bleibt die Zeile beim Datum. */
	ort?: string | null;
	/**
	 * Wie viele Vollmachten eine Person höchstens ausüben darf, wenn die
	 * Gemeinschaft eine Grenze kennt. Sie gehört in die Einladung: Wer sie erst
	 * am Einlass erfährt, hat die Vollmacht schon dabei.
	 */
	vollmachtsgrenze?: number | null;
	/** Woher die Grenze stammt, etwa «Reglement Ziff. 8.2». */
	vollmachtsgrenzeQuelle?: string | null;
	/**
	 * Die eigene Beschlussfähigkeitsregel der Gemeinschaft für diese Stufe,
	 * falls eine hinterlegt ist (Nachprüfung 23.08.2026).
	 *
	 * Ohne sie nannte die Einladung bei einer Zweitversammlung immer das
	 * gesetzliche Drittel — während am Abend nach der Regel gerechnet wird.
	 *
	 * **Vollständig, mit der Quotenbedingung** (Code-Review 07.09.2026). Sie
	 * stand hier als engerer Ausschnitt ohne `quoten`. Für die zweite
	 * Versammlung genügte das, dort gibt es keine; seit die Einladung auch die
	 * **erste** beschreibt, schnitt der Typ genau die Bedingung weg, ohne die
	 * der Satz ein zu niedriges Quorum nennt.
	 */
	beschlussfaehigkeit?: Beschlussfaehigkeitsregel | null;
	/**
	 * Ob diese Gemeinschaft mindestens eine Einheit im gemeinschaftlichen
	 * Eigentum kennt (27.08.2026).
	 *
	 * Nur dann steht der Absatz über die eine Stimme und die Folge der
	 * Uneinigkeit in der Einladung. Fehlt die Angabe, bleibt er weg: Eine
	 * Einladung darf nichts über einen Fall behaupten, den der Erzeuger nicht
	 * geprüft hat.
	 */
	gemeinschaftlichesEigentum?: boolean;
}

interface Masse {
	breite: number;
	hoehe: number;
	rand: number;
	titelgroesse: number;
	nummerngroesse: number;
	textgroesse: number;
	kleingroesse: number;
	/** Einrückung je Ebene. */
	einzug: number;
	/** Abstand zwischen zwei Traktanden. */
	luft: number;
}

function masseFuer(art: Ausprägung): Masse {
	// Die Einladung ist gesetzt wie die Liste — sie ist dasselbe Blatt mit einem
	// Anschreiben davor, nicht ein zweites Format.
	if (art === 'praesentation') {
		return {
			breite: A4_QUER.breite,
			hoehe: A4_QUER.hoehe,
			rand: mm(18),
			titelgroesse: 30,
			nummerngroesse: 20,
			textgroesse: 18,
			kleingroesse: 13,
			einzug: mm(12),
			luft: mm(9)
		};
	}
	return {
		breite: A4.breite,
		hoehe: A4.hoehe,
		rand: mm(20),
		titelgroesse: 17,
		nummerngroesse: 11,
		textgroesse: 10.5,
		kleingroesse: 8.5,
		einzug: mm(6),
		luft: mm(4.5)
	};
}

export interface Erzeugtes {
	bytes: Uint8Array;
	/** Was beim Erzeugen aufgefallen ist — etwa eine unbrauchbare Briefkopfvorlage. */
	hinweise: string[];
}

export async function erzeugeTraktandenliste(
	art: Ausprägung,
	angaben: Listenangaben
): Promise<Erzeugtes> {
	const m = masseFuer(art);
	const blatt = await neuesBlatt();
	const hinweise: string[] = [];

	/*
	 * **Ob der Briefkopf wirklich trägt, nicht ob einer hinterlegt ist**
	 * (Code-Review 07.09.2026). Eine beschädigte, verschlüsselte oder leere
	 * Vorlage lässt `legeBriefkopfUnter` liegen und erzeugt das PDF ohne sie —
	 * das entscheidet sich dort aber erst nach dem Textsatz.
	 *
	 * Die Antwort trägt hier **zwei** Entscheidungen: wie viel oben frei bleibt,
	 * und ob die Einladung den Absender selbst in den Kopf setzt. Hingen beide
	 * an der blossen Existenz, stünde bei einer unbrauchbaren Vorlage ein leeres
	 * Band über einem Brief ohne Absender — also gerade der Zustand, den Befund
	 * 25 beanstandet.
	 *
	 * Gefragt wird nur, wo es zählt: Die Vorlage einmal zu laden kostet, und für
	 * die Präsentation kommt sie ohnehin nicht.
	 */
	const briefkopfTraegt =
		angaben.briefkopf != null &&
		art !== 'praesentation' &&
		(await briefkopfBrauchbar(angaben.briefkopf)).brauchbar;
	const briefkopfHoehe = briefkopfTraegt ? mm(angaben.briefkopfHoeheMm ?? 55) : 0;

	const seiten: ReturnType<Blatt['dokument']['addPage']>[] = [];
	let seite = blatt.dokument.addPage([m.breite, m.hoehe]);
	seiten.push(seite);

	const inhaltsbreite = m.breite - 2 * m.rand;
	let y = m.hoehe - m.rand - briefkopfHoehe;

	/** Beginnt eine neue Seite, wenn der nächste Block nicht mehr passt. */
	function platzSchaffen(noetig: number): void {
		if (y - noetig >= m.rand) return;
		seite = blatt.dokument.addPage([m.breite, m.hoehe]);
		seiten.push(seite);
		// Folgeseiten starten oben: Der Briefkopf steht nur auf der ersten,
		// sofern nichts anderes hinterlegt ist.
		y = m.hoehe - m.rand - (angaben.briefkopfAlleSeiten ? briefkopfHoehe : 0);
	}

	// ── Kopf ────────────────────────────────────────────────────────────────
	const v = angaben.versammlung;

	y = zeichneText(seite, angaben.gemeinschaftName, m.rand, y, inhaltsbreite, {
		schrift: blatt.schriften.normal,
		groesse: m.kleingroesse + 1,
		farbe: GRAU
	});
	y -= mm(1);

	const ueberschrift =
		art === 'einladung'
			? v.art === 'ordentlich'
				? 'Einladung zur ordentlichen Eigentümerversammlung'
				: 'Einladung zur ausserordentlichen Eigentümerversammlung'
			: v.art === 'ordentlich'
				? 'Traktandenliste'
				: 'Traktandenliste — ausserordentliche Versammlung';

	y = zeichneText(seite, ueberschrift, m.rand, y - m.titelgroesse, inhaltsbreite, {
		schrift: blatt.schriften.fett,
		groesse: m.titelgroesse
	});

	const kopfzeile = [
		`${datumLang(v.datum)}, ${v.uhrzeit} Uhr`,
		v.ort,
		v.stufe === 'zweite' ? 'Zweitversammlung nach ZGB Art. 712p Abs. 3' : null
	]
		.filter(Boolean)
		.join(' · ');

	y = zeichneText(seite, kopfzeile, m.rand, y - mm(1), inhaltsbreite, {
		schrift: blatt.schriften.normal,
		groesse: m.textgroesse,
		farbe: GRAU
	});

	if (v.anlass) {
		y = zeichneText(seite, `Anlass: ${v.anlass}`, m.rand, y - mm(1), inhaltsbreite, {
			schrift: blatt.schriften.normal,
			groesse: m.textgroesse
		});
	}

	/*
	 * **Der provisorische Vermerk** (Praxisdurchlauf 28.08.2026). Die
	 * Vorankündigung geht Wochen vor der Freigabe hinaus — wer sie in Händen
	 * hält, soll sehen, dass die Liste sich noch ändern kann. Fett und mit
	 * eigenem Abstand, damit der Satz nicht als Fussnote durchgeht.
	 */
	if (angaben.provisorischerStand) {
		y -= mm(3);
		y = zeichneText(
			seite,
			`Provisorische Fassung, nicht freigegeben — Stand ${datumLang(angaben.provisorischerStand)}.`,
			m.rand,
			y - mm(1),
			inhaltsbreite,
			{ schrift: blatt.schriften.fett, groesse: m.textgroesse }
		);
		y -= mm(2);
	}

	/*
	 * ── Anschreiben (nur die Einladung) ─────────────────────────────────────
	 *
	 * **Prüflauf I, B-14**: «Die Einladung ist heute identisch mit der
	 * Traktandenliste — kein Absender, keine Anrede, kein Einberufungssatz, kein
	 * Vollmachtshinweis.»
	 *
	 * Was hier steht, ist das, was eine Einberufung ausmacht: wer einlädt, wozu,
	 * wann, wo — und dass sich vertreten lassen kann, wer nicht kommt. Die
	 * Traktanden folgen darunter, in derselben Fassung wie auf dem Beamer.
	 */
	const e = art === 'einladung' ? angaben.einladung : undefined;
	if (e) {
		/*
		 * **Der Absender oben — wenn kein Briefkopf ihn trägt**
		 * (Bedienbarkeitsprüfung 05.09.2026, Befund 25: «Es fehlen ein
		 * Vollmachtsformular und eine Absenderangabe»).
		 *
		 * Er stand bisher nur unter dem Gruss, hinter dem Platz für die
		 * Unterschrift. Das genügt für eine unterschriebene Seite; wer die
		 * Einladung aber im Briefkasten hat und wissen will, wer eingeladen hat,
		 * sieht zuerst oben nach. Wer einberuft, gehört zur Einberufung
		 * (ZGB Art. 712n Abs. 1).
		 *
		 * **Nicht bei hinterlegtem Briefkopf**: Der trägt den Absender schon, und
		 * zweimal derselbe Name über zwei Zentimetern wäre ein Fehler, den jeder
		 * Empfänger sieht.
		 */
		if (!briefkopfTraegt) {
			// Ein eigener Abstand davor: Ohne ihn sitzt der Absender eine
			// Zeilenhöhe unter dem Versammlungskopf und verschmilzt mit ihm
			// (Code-Review 07.09.2026).
			y -= mm(2);
			y = zeichneText(seite, e.absender, m.rand, y, inhaltsbreite, {
				schrift: blatt.schriften.fett,
				groesse: m.kleingroesse
			});
			/*
			 * Eine zweite Zeile mit Anschrift gibt es nicht: Der Betreiber führt
			 * keine Postadresse (`server/betreiber.ts`), und `erinnerungsadresse`
			 * ist die Adresse für Erinnerungen der Anwendung, nicht die des
			 * Absenders. Wer eine Anschrift will, hinterlegt einen Briefkopf.
			 */
		}

		y -= m.luft;
		const rechts = m.breite - m.rand;
		const zeile = e.ort ? `${e.ort}, ${datumLang(e.datum)}` : datumLang(e.datum);
		const breite = blatt.schriften.normal.widthOfTextAtSize(zeile, m.kleingroesse);
		seite.drawText(zeile, {
			x: rechts - breite,
			y,
			size: m.kleingroesse,
			font: blatt.schriften.normal,
			color: GRAU
		});
		y -= m.luft;

		y = zeichneText(seite, 'Sehr geehrte Damen und Herren', m.rand, y, inhaltsbreite, {
			schrift: blatt.schriften.normal,
			groesse: m.textgroesse
		});
		y -= mm(4);

		// Die Sätze stehen in `$lib/domain/einladung` — dort sind sie prüfbar,
		// hier stünden sie zwischen Koordinaten.
		const einberufung = einberufungssatz({
			gemeinschaftName: angaben.gemeinschaftName,
			art: v.art,
			datum: v.datum,
			uhrzeit: v.uhrzeit,
			ort: v.ort
		});
		y = zeichneText(seite, einberufung, m.rand, y, inhaltsbreite, {
			schrift: blatt.schriften.normal,
			groesse: m.textgroesse
		});
		y -= mm(3);

		/*
		 * Der Hinweis auf die Vertretung gehört in die Einladung und nicht an
		 * den Einlass: Wer die Grenze erst dort erfährt, steht mit einer
		 * Vollmacht da, die er nicht mehr ausüben darf.
		 */
		y = zeichneText(
			seite,
			vertretungssatz(e.vollmachtsgrenze, e.vollmachtsgrenzeQuelle),
			m.rand,
			y,
			inhaltsbreite,
			{ schrift: blatt.schriften.normal, groesse: m.textgroesse }
		);

		/*
		 * Der Absatz zum gemeinschaftlichen Eigentum steht **neben** dem Hinweis
		 * auf die Vertretung, weil er dieselbe Frage beantwortet: Wer darf am Abend
		 * für wen stimmen? Auf der Zugangskarte hat er nichts zu suchen — sie
		 * gehört einer Einheit und wird von allen Beteiligten gelesen.
		 */
		const gemeinsam = gemeinschaftssatz(e.gemeinschaftlichesEigentum ?? false);
		if (gemeinsam) {
			/*
			 * **Mit `platzSchaffen`, anders als die Sätze darüber** (aus dem
			 * Code-Review, 27.08.2026). Der Absatz ist der längste des
			 * Anschreibens; kommen ein hoher Briefkopf, eine Vollmachtsgrenze und
			 * der Zusatz zur Zweitversammlung zusammen, liefe er sonst unter den
			 * unteren Rand, ohne dass eine neue Seite entstünde.
			 */
			const stil = { schrift: blatt.schriften.normal, groesse: m.textgroesse };
			y -= mm(3);
			platzSchaffen(hoeheVon(gemeinsam, inhaltsbreite, stil));
			y = zeichneText(seite, gemeinsam, m.rand, y, inhaltsbreite, stil);
		}

		// Auch bei der ersten Versammlung (Befund 25): siehe `beschlussfaehigkeitssatz`.
		// L5: der Verweis auf die Fussnote gleich nach dem Drittel (Laienprüfung
		// Block 7, L7-1), nur wenn ein Titel das Zeichen trägt.
		// Dieselbe Auswahl wie die Liste der Einladung unten (ohne im Saal Aufgenommenes).
		const mitNeuen = angaben.traktanden.some(
			(t) => !t.knoten.aufgenommenAm && angaben.neutraktanden?.traktanden.has(t.knoten.id)
		);
		const satz = beschlussfaehigkeitssatz(v.stufe, e.beschlussfaehigkeit);
		const zweite = satz && mitNeuen ? `${satz} ${NEUTRAKTANDUM_VERWEIS}` : satz;
		if (zweite) {
			/*
			 * **Mit `platzSchaffen`** (Code-Review 07.09.2026). Bis dahin stand
			 * dieser Absatz nur auf der zweiten Versammlung und damit selten;
			 * seit er auf jeder Erstversammlung steht, kommt er regelmässig mit
			 * hohem Briefkopf, Vollmachtsgrenze und dem Absatz zum
			 * gemeinschaftlichen Eigentum zusammen — und lief dann unter den
			 * unteren Rand, ohne dass eine neue Seite entstand.
			 */
			const stil = { schrift: blatt.schriften.normal, groesse: m.textgroesse };
			y -= mm(3);
			platzSchaffen(hoeheVon(zweite, inhaltsbreite, stil));
			y = zeichneText(seite, zweite, m.rand, y, inhaltsbreite, stil);
		}

		/*
		 * **Der Fristvermerk, wenn die Zehntagesfrist nicht eingehalten ist**
		 * (Befund R-2b, Produktentscheid vom 23.09.2026).
		 *
		 * **Warum er hierhin gehört und nicht in die Anwendung.** Bis dahin blieb
		 * ein zu knapper Abstand im System: Die Sitzungsleitung tippte eine
		 * Begründung, und die Einladung sah aus wie jede andere. Wer sie bekam,
		 * konnte nicht wissen, dass die Beschlüsse dieses Abends innert eines
		 * Monats anfechtbar sind — dabei ist die Einladung das Dokument, das im
		 * Anfechtungsfall auf dem Tisch liegt.
		 *
		 * **Direkt nach der Beschlussfähigkeit**, weil beide dieselbe Frage
		 * beantworten: was dieser Abend beschliessen kann. Und vor der
		 * Traktandenliste, nicht danach: Wer nur den Kopf liest, soll es trotzdem
		 * gelesen haben.
		 *
		 * Der Wortlaut wird nicht hier gebildet. Er steht an der Versammlung, mit
		 * demselben Text, den das Protokoll führt und den die Erfassung als
		 * Vorschau zeigt.
		 */
		if (v.fristvermerk) {
			const stil = { schrift: blatt.schriften.fett, groesse: m.textgroesse };
			y -= mm(3);
			platzSchaffen(hoeheVon(v.fristvermerk, inhaltsbreite, stil));
			y = zeichneText(seite, v.fristvermerk, m.rand, y, inhaltsbreite, stil);
		}

		y -= mm(3);
		y = zeichneText(
			seite,
			'Es stehen folgende Traktanden an:',
			m.rand,
			y,
			inhaltsbreite,
			{ schrift: blatt.schriften.normal, groesse: m.textgroesse }
		);
	}

	y -= m.luft;
	seite.drawLine({
		start: { x: m.rand, y },
		end: { x: m.breite - m.rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= m.luft;

	// ── Traktanden ──────────────────────────────────────────────────────────
	/*
	 * **Die Einladung ist eingefroren** (Praxisfund 03.10.2026). Sie zeigt die
	 * Liste, wie sie freigegeben wurde, auch wenn sie nach der Versammlung
	 * nochmals erzeugt wird. Traktanden, die erst in der Versammlung
	 * hinzukommen (Rückkommensanträge, Spontantraktanden,
	 * `added_during_meeting_at`), standen nie auf der Einladung und gehören
	 * nicht in eine zweite Ausfertigung; auf Liste und Beamer stehen sie
	 * weiter. Titel, Wortlaut und Nummern sind schon an der Freigabe
	 * festgeschrieben — offen war allein, ob ein Punkt überhaupt erscheint.
	 */
	const traktanden =
		art === 'einladung'
			? angaben.traktanden.filter((t) => !t.knoten.aufgenommenAm)
			: angaben.traktanden;
	let fussnoteNoetig = false;
	for (const t of traktanden) {
		const einzug = m.einzug * (t.tiefe - 1);
		const x = m.rand + einzug;
		const breite = inhaltsbreite - einzug;
		const nummernbreite = blatt.schriften.fett.widthOfTextAtSize(
			`${t.nummer}  `,
			m.nummerngroesse
		);
		const textbreite = breite - nummernbreite;

		const titelStil = { schrift: blatt.schriften.fett, groesse: m.nummerngroesse };
		const textStil = { schrift: blatt.schriften.normal, groesse: m.textgroesse };
		const kleinStil = {
			schrift: blatt.schriften.normal,
			groesse: m.kleingroesse,
			farbe: GRAU
		};

		// Die Überschrift bleibt mit dem ersten Absatz zusammen: Eine
		// Traktandennummer allein am Seitenende ist in der Einladung verwirrend
		// und auf dem Beamer unlesbar.
		const kurz = t.knoten.kurzfassung ?? '';
		platzSchaffen(
			hoeheVon(t.knoten.titel, textbreite, titelStil) +
				(kurz ? hoeheVon(kurz, textbreite, textStil) : 0) +
				m.luft
		);

		seite.drawText(t.nummer, {
			x,
			y: y - m.nummerngroesse,
			size: m.nummerngroesse,
			font: blatt.schriften.fett,
			color: rgb(0.1, 0.1, 0.12)
		});

		// L5: das Zeichen am Titel, der Satz unter der Liste (Entscheid 22.10.2026:
		// als Fussnote, damit die Einladung nicht überladen wird).
		const neu = art !== 'praesentation' && angaben.neutraktanden?.traktanden.has(t.knoten.id) === true;
		if (neu) fussnoteNoetig = true;
		const titel = neu ? `${t.knoten.titel} ${NEUTRAKTANDUM_ZEICHEN}` : t.knoten.titel;
		y = zeichneText(seite, titel, x + nummernbreite, y - m.nummerngroesse, textbreite, titelStil);

		if (kurz) {
			y = zeichneText(seite, kurz, x + nummernbreite, y - mm(0.5), textbreite, textStil);
		}

		// Der ausführliche Inhalt bleibt der Liste vorbehalten. Auf dem Beamer
		// wäre er eine Textwand, die niemand liest — und was niemand liest, lenkt
		// vom Antrag ab.
		if (art === 'liste' && t.knoten.inhalt) {
			platzSchaffen(hoeheVon(t.knoten.inhalt, textbreite, textStil));
			y = zeichneText(seite, t.knoten.inhalt, x + nummernbreite, y - mm(1), textbreite, textStil);
		}

		if (t.knoten.antragswortlaut) {
			const wortlaut = `Antrag: ${t.knoten.antragswortlaut}`;
			const wortlautStil =
				art === 'praesentation' ? { ...textStil, schrift: blatt.schriften.fett } : textStil;
			platzSchaffen(hoeheVon(wortlaut, textbreite, wortlautStil));
			y = zeichneText(seite, wortlaut, x + nummernbreite, y - mm(1.5), textbreite, wortlautStil);
		}

		const fusszeile = fusszeileZu(t.knoten);
		if (fusszeile) {
			platzSchaffen(hoeheVon(fusszeile, textbreite, kleinStil));
			y = zeichneText(seite, fusszeile, x + nummernbreite, y - mm(1), textbreite, kleinStil);
		}

		// Nicht auf dem Beamer: Im Saal kommt der Rat zur Vollmacht zu spät und läse
		// sich mit dem Namen auf der Leinwand wie eine Empfehlung gegen eine
		// anwesende Person (Codeprüfung 20.10.2026). Einladung und Liste gehen an
		// die Eigentümer vorher.
		const hinweis =
			art === 'praesentation' ? null : einladungshinweisZu(t.knoten, angaben.parteinamen);
		if (hinweis) {
			platzSchaffen(hoeheVon(hinweis, textbreite, kleinStil));
			y = zeichneText(seite, hinweis, x + nummernbreite, y - mm(1), textbreite, kleinStil);
		}

		// L8 (Migration 184): der Satz zu den Vollmachten der Verwaltung, an
		// einem Traktandum mit Häkchen, je nach Wahl. Wie der Hinweis bei der
		// Einsprache nicht auf dem Beamer: Im Saal käme er zu spät.
		const verwaltungshinweis =
			art === 'praesentation'
				? null
				: verwaltungssatzEinladung(angaben.verwaltungL8, t.knoten.verwaltungsGeschaeft);
		if (verwaltungshinweis) {
			platzSchaffen(hoeheVon(verwaltungshinweis, textbreite, kleinStil));
			y = zeichneText(seite, verwaltungshinweis, x + nummernbreite, y - mm(1), textbreite, kleinStil);
		}

		y -= m.luft;
	}

	// Die Fussnote zu L5 einmal unter der Liste, klein wie die Hinweise am
	// Traktandum, vor Gruss und Unterschrift; nur, wenn ein Titel das Zeichen trägt.
	if (fussnoteNoetig && angaben.neutraktanden) {
		const stil = { schrift: blatt.schriften.normal, groesse: m.kleingroesse, farbe: GRAU };
		platzSchaffen(hoeheVon(angaben.neutraktanden.satz, inhaltsbreite, stil));
		y = zeichneText(seite, angaben.neutraktanden.satz, m.rand, y, inhaltsbreite, stil);
		y -= m.luft;
	}

	/*
	 * ── Gruss und Unterschrift (nur die Einladung) ──────────────────────────
	 *
	 * Ein Brief ohne Absender am Schluss ist keiner. Der Briefkopf trägt das
	 * Logo, nicht die Verantwortung: Wer einberufen hat, muss auch dann
	 * dastehen, wenn kein Briefkopf hinterlegt ist (ZGB Art. 712n Abs. 1 —
	 * einberufen wird durch die Verwaltung).
	 */
	if (e) {
		platzSchaffen(mm(38));
		y -= m.luft / 2;
		// Dieselbe Linie wie über dem ersten Traktandum: Sie schliesst die Liste,
		// sonst läse sich der Gruss wie ein weiterer Punkt.
		seite.drawLine({
			start: { x: m.rand, y },
			end: { x: m.breite - m.rand, y },
			thickness: 0.7,
			color: LINIE
		});
		y -= m.luft;
		y = zeichneText(seite, 'Freundliche Grüsse', m.rand, y, inhaltsbreite, {
			schrift: blatt.schriften.normal,
			groesse: m.textgroesse
		});
		// Platz für eine Unterschrift von Hand: Wer die Einladung ausdruckt und
		// unterschreibt, braucht ihn, und zehn Millimeter sind zu wenig.
		y -= mm(16);
		y = zeichneText(seite, e.absender, m.rand, y, inhaltsbreite, {
			schrift: blatt.schriften.fett,
			groesse: m.textgroesse
		});
	}

	// ── Briefkopf ───────────────────────────────────────────────────────────
	if (angaben.briefkopf && art !== 'praesentation') {
		const ziel = angaben.briefkopfAlleSeiten ? seiten : [seiten[0]];
		const ergebnis = await legeBriefkopfUnter(blatt, angaben.briefkopf, ziel);
		if (!ergebnis.verwendet && ergebnis.grund) hinweise.push(ergebnis.grund);
	}

	// ── Seitenzahlen ────────────────────────────────────────────────────────
	seiten.forEach((s, i) => {
		const text = `Seite ${i + 1} von ${seiten.length}`;
		const breite = blatt.schriften.normal.widthOfTextAtSize(text, m.kleingroesse);
		s.drawText(text, {
			x: m.breite - m.rand - breite,
			y: m.rand / 2,
			size: m.kleingroesse,
			font: blatt.schriften.normal,
			color: GRAU
		});
	});

	return { bytes: await blatt.dokument.save(), hinweise };
}

/**
 * Die Zeile unter einem Traktandum: Antragsteller und Mehrheitserfordernis.
 *
 * Das Erfordernis erscheint nur, wenn es gesetzt ist. Ein Platzhalter «noch
 * offen» in einer versandten Einladung liest sich wie eine Zusage, dass es
 * später bestimmt wird — und genau das soll vorher geschehen.
 */
function fusszeileZu(t: Traktandum): string | null {
	const teile: string[] = [];

	// Die Formulierung steht im Kern (`antragstellerInWorten`): Sie erscheint auf
	// der Traktandenliste, in der Auswertung und am Bildschirm, und wer sie
	// dreimal schreibt, hat sie dreimal verschieden.
	teile.push(
		`Antrag — ${antragstellerInWorten(t.antragstellerart, t.antragstellerName, t.antragstellerNamen)}`
	);

	if (t.art === 'kenntnisnahme') {
		teile.push('Kenntnisnahme, keine Abstimmung');
	} else if (t.erfordernis && t.erfordernis.typ !== 'grenzfall') {
		/*
		 * **Die Regel zuerst, der Fall dahinter** (22.08.2026, Befund B-03).
		 *
		 * Vorher stand hier allein der Fallname mit seiner Rechtsgrundlage. Das
		 * beantwortet nicht, was ein Eigentümer beim Lesen der Einladung wissen
		 * will — wie viele Ja es braucht. Und nach einer Übersteuerung stimmte die
		 * Rechtsgrundlage nicht einmal mehr (die Ursache liegt in `uebersteuere`
		 * und ist behoben; hier stand das Ergebnis).
		 *
		 * **Ohne Zahl**, wie auf dem Stimmzettel: Die Einladung geht Wochen vorher
		 * raus, und wer bis dahin dazukommt oder wegfällt, verschiebt jede Zahl,
		 * die an der Anwesenheit hängt.
		 */
		/*
		 * **Der Quorumstyp zuerst** (Praxisfund 03.10.2026): Bis dahin nannte
		 * die Zeile die Schwelle in Worten und den Fall («Benutzungsweise
		 * ändern»), aber nicht den Typ («Einfaches Mehr»). Wer die Einladung
		 * liest, soll den Typ sehen, unter dem abgestimmt wird; die Fassung
		 * kommt aus dem Erfordernis, damit die Bezeichnung zur damals
		 * geltenden Regelung gehört.
		 */
		const bezeichnung = typdefinition(
			holeRegelwerkFuerAnzeige(t.erfordernis.fassung),
			t.erfordernis.typ
		).bezeichnung;
		teile.push(
			`${bezeichnung}: ${erfordernisInWorten(t.erfordernis)}${klammer(herleitung(t.erfordernis.titel, t.erfordernis.rechtsgrundlage, mehrheitGesetzt(t.erfordernis)))}`
		);
		if (t.erfordernis.zustimmungBetroffenerNoetig) {
			teile.push('zusätzlich Zustimmung der unmittelbar Betroffenen nötig');
		}
	}

	return teile.length > 0 ? teile.join(' · ') : null;
}

/**
 * T1, F4a (zu S5; Prüfdatei `quellen/pruefung/zu-pruefen-2026-11-04-votum-f4a-saetze-runde3.md`):
 * die Stelle in der Einladung. «sinngemäss», weil BGE 134 III 481 E. 3.8 zu
 * Art. 68 ZGB erging; die Übertragung auf Art. 712c Abs. 2 ist Folgerung.
 */
export const EINLADUNG_EINSPRACHE_STELLE = 'sinngemäss BGE 134 III 481 E. 3.8';

/** T1, F4a: was daraus für die Vollmachtgeber folgt. */
export const EINLADUNG_EINSPRACHE_RAT = 'Geben Sie Ihre Vollmacht für diese Versammlung besser jemand anderem.';

/**
 * Ein Absatz unter dem Traktandum für die Vollmachtgeber (Pendenz vom
 * 19.10.2026, Laienprüfung zur Einsprache, Runde 2, M4).
 *
 * **Nur bei der Einsprache nach Art. 712c Abs. 2.** Wer dort verkauft,
 * vermietet oder belastet, stimmt nicht mit, und Votum zählt seine Vollmachten
 * nicht; wer ihm eine gibt, erfährt das sonst erst im Saal. Und eine
 * Enthaltung wirkt dort wie ein Nein, weil die Einstellung «Enthaltungen
 * zählen nicht» an der Einsprache nicht greift (`docs/entscheide/0013`).
 * Gebaut aus geprüften Sätzen (`EINSPRACHE_BETROFFENE_WEBSITE`, der
 * Enthaltungssatz aus `karteMitEnthaltung`) und im Zusammenhang der Einladung
 * neu geprüft (`quellen` `pruefung/berichte/2026-10-20-votum-einladung-einsprache.md`):
 * mit dem Namen der eingetragenen Partei, die Freigabe verlangt ihn
 * (`einsprache_ohne_betroffene`), und mit der Folge «bei dieser Abstimmung
 * werden sie nicht gezählt» (das Wort «Votum» führt die Einladung nicht ein).
 */
export function einladungEinsprache(namen: readonly string[]): string {
	const wer = namen.length > 0 ? ` (${namen.join(', ')})` : '';
	return (
		`Wer verkauft, vermietet oder belastet${wer}, stimmt nicht mit, auch nicht mit Vollmachten ` +
		`anderer (${EINLADUNG_EINSPRACHE_STELLE}); bei dieser Abstimmung werden sie nicht gezählt. ` +
		`${EINLADUNG_EINSPRACHE_RAT} Enthaltungen zählen bei ` +
		'der Einsprache nach herrschender Lehre mit und wirken damit wie eine Stimme gegen die ' +
		'Einsprache.'
	);
}

function einladungshinweisZu(
	t: Traktandum,
	parteinamen: ReadonlyMap<string, string> | undefined
): string | null {
	if (t.art === 'kenntnisnahme' || t.erfordernis?.knotenId !== EINSPRACHE_KNOTEN) return null;
	const namen = t.betroffeneParteiIds
		.map((id) => parteinamen?.get(id))
		.filter((n): n is string => Boolean(n));
	return einladungEinsprache(namen);
}

// Die Datumsform steht im Kern (`$lib/domain/datum`) und wird hier nur
// weitergereicht, damit die vorhandenen Einbindungen der PDF-Erzeugung
// unverändert bleiben. Papier und Bildschirm schreiben dasselbe Datum gleich.
export { datumLang } from '$lib/domain/datum';
