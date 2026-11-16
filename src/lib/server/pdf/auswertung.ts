/**
 * Die Gesamtauswertung als PDF (Story 5.13, FR-42, NFR-17).
 *
 * **Was darin steht:** je Traktandum das angewandte Mehrheitserfordernis, die
 * Zahlen beider Grundlagen mit ihrer Bezugsgrösse, und ob der Antrag angenommen
 * oder abgelehnt ist. Kenntnisnahmen erscheinen als solche, ohne Ergebnis — sie
 * wegzulassen hiesse, aus der Auswertung eine Beschlussliste zu machen, und
 * dann fehlte im Protokoll der halbe Abend.
 *
 * **Was nicht darin steht: ein Name im Zusammenhang mit Stimmverhalten**
 * (NFR-17). Die Auswertung geht an alle Eigentümer; wer wie gestimmt hat, geht
 * niemanden ausser dem Betroffenen etwas an. Die einzige Ausnahme sind die
 * unmittelbar Betroffenen, deren Zustimmung das Gesetz verlangt (ZGB
 * Art. 712g Abs. 4) — dort **ist** der Name der Nachweis, und ohne ihn liesse
 * sich der Beschluss nicht belegen.
 */
import type { Anfechtungssonderfall } from '$lib/domain/protokoll';
import {
	andereLesartenVon,
	andereLesartInWorten,
	zustimmungBetroffenerGefragt,
	zweitesErgebnisImProtokoll
} from '$lib/domain/auszaehlung';
import { A4, mm } from '$lib/domain/textsatz';
import { GRAU, LINIE, neuesBlatt, zeichneText } from './basis';
import { datumLang } from './traktandenliste';
import {
	ausstehendeNamen,
	imAusstandInWorten,
	stimmtNichtInWorten,
	zustimmungImSaalOderVorabInWorten,
	type Auszaehlung,
	type Stimmenspiegel,
	type VorabAngabe
} from '$lib/domain/auszaehlung';
import type { Versammlung } from '$lib/domain/versammlung';
import type { Leitungsvertretung } from '$lib/domain/ausnahmen';
import { ersetzungInKuerze, type Ersetzungslage } from '$lib/domain/folgeantragsersetzung';
import {
	AUSWERTUNG_VON_HAND_ABGESTIMMT,
	einwandInDerAuswertung,
	ergebnissatzDerAuswertung,
	konsultativFruehererSatz,
	rueckzugInDerAuswertung
} from '$lib/domain/protokoll';

export interface Auswertungszeile {
	nummer: string;
	tiefe: number;
	titel: string;
	art: 'abstimmung' | 'kenntnisnahme';
	/**
	 * Der Grund eines geltenden Rückzugs, sonst null (Schritt F2). Dann steht
	 * der Rückzugssatz des Protokolls (`rueckzugInDerAuswertung`) statt «Es wurde nicht
	 * abgestimmt» oder, nach einer konsultativen Abstimmung, statt ihres
	 * Ergebnissatzes, der den Weg eines offenen Geschäfts nennt.
	 */
	rueckzug?: string | null;
	spontan: boolean;
	spontanart?: 'folgeantrag' | 'neu' | 'rueckkommen' | null;
	/**
	 * Bei einem nicht angekündigten Geschäft, das zur Abstimmung durfte: der
	 * Vermerk, worauf es sich stützt (Migration 127). Sonst null. Steht im
	 * Protokoll und im Auswertungs-PDF.
	 */
	ausnahmeVermerk?: string | null;
	/** Der massgebende Durchgang; null, wenn nie abgestimmt wurde. */
	durchgang: number | null;
	frueherenDurchgaenge: number;
	/** Davon durch ein Rückkommen ersetzt (FR-44) — im Unterschied zur Überholung. */
	frueherenDurchRueckkommen?: number;
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
		/** Liegt der geltende Beschluss am ersetzenden Folgeantrag: dessen Nummer. */
		folgeantrag?: string | null;
	} | null;
	/**
	 * Durchgänge, die ein **Rückkommen** ersetzt hat, mit ihrem Ergebnis
	 * (Produktentscheid 30.09.2026, «Nein heisst Nein»). Seit auch eine
	 * Ablehnung ersetzt, ist der geltende Durchgang nach einem Rückkommen oft
	 * nicht mehr der erste, und die Zeile «… Durchgang; weitere Durchgänge siehe
	 * Verlauf» verschwieg das Rückkommen (Fachprüfung 30.09.2026, F-11).
	 */
	ersetztNachRueckkommen?: { nummer: number; ergebnis: 'angenommen' | 'abgelehnt' | null }[];
	/** Es wurde zurückgekommen, ein Beschluss kam dabei aber nicht zustande (seit 30.09.2026 nicht nach einer Ablehnung). */
	rueckkommenErfolglos?: boolean;
	/**
	 * Das Rückkommen, das über einen Folgeantrag lief, von diesem Traktandum aus
	 * gesehen (`domain/folgeantragsersetzung.ts`); sonst null.
	 */
	ersetzung?: Ersetzungslage | null;
	/**
	 * Durchgänge, die nach einem Weggang ohne Beschluss blieben und beim
	 * Neueröffnen überholt wurden (Migration 128). Das Protokoll sagt je einen
	 * Satz dazu (Fachprüfung Block 3, Runde 3, Befund 2).
	 */
	nachWeggang?: {
		nummer: number;
		namen: string[];
		handzaehlung: boolean;
		/** Wer davon nur über die Leitung vertreten war (Codeprüfung Block 4a, N-4). */
		nurDurchLeitung?: Leitungsvertretung[];
	}[];
	/**
	 * Konsultative Durchgänge, die ein späterer überholt hat (Migration 158),
	 * mit ihren Zahlen: Anders als bei einem fehlerhaften Durchgang sind die
	 * Zahlen hier der ganze Inhalt, und das Protokoll nennt sie. `zahlen` ist
	 * null bei geheimer Abstimmung. Ohne Ergebnis (abgebrochen) steht der
	 * Durchgang nicht hier, sondern bei den Neuabstimmungen. Nach einem
	 * Rückzug auch der letzte, nicht überholte (H7, Teil D): Der Rückzugssatz
	 * im Protokoll verdrängt sonst seine Zahlen.
	 */
	konsultativFrueher?: {
		nummer: number;
		zahlen: { koepfe: Stimmenspiegel; quoten: Stimmenspiegel | null } | null;
		/** Konsultativ nach der Sperre von L5 (Migration 174). */
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
	/**
	 * Abgestimmt, dann eine Neuabstimmung angesetzt und nicht mehr eröffnet
	 * (Fachprüfung Block 4a, Runde 3, F-1). Sonst null.
	 */
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
	 * Nach einem Rückkommen neu abgestimmt, darauf eine Neuabstimmung angesetzt
	 * und noch nicht neu entschieden: Der frühere Beschluss gilt weiter. Seit
	 * H6 nur nach einem Durchgang mit offenem Stichentscheid. Sonst null.
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
	/** Die nötige Mehrheit in Worten (22.08.2026, vorher stand hier der Fallname). */
	erfordernis: string | null;
	/** Der Fallname dazu — Einordnung neben der Regel, nicht an ihrer Stelle. */
	fall?: string | null;
	/** Die Leitung hat die Mehrheit gesetzt; dann keine Herleitung im Protokoll. */
	mehrheitGesetzt?: boolean;
	/** Was an diesem Geschäft ausser dem Abstimmen geschah (22.08.2026). */
	vorgaenge?: { art: string; wer: string; angaben: Record<string, unknown>; zeitpunkt: string }[];
	rechtsgrundlage: string | null;
	/** Die Fassung der Berechnungsregeln zum Erfordernis, für das Protokoll (Ä-09). */
	regelfassung?: string | null;
	/** Die Lesart der Gemeinschaft, nach der gerechnet wurde (Migration 169), als Satz. */
	lesart?: string | null;
	/** Wo Weg oder Frist der Anfechtung anders laufen (`anfechtungsabschnitt`). */
	anfechtungssonderfall?: Anfechtungssonderfall | null;
	/** Geheim auf offenen Beschluss der Versammlung (Migration 165, Ä-38). */
	geheimBeschlossen?: boolean;
	/** Geheim nach Reglement (Migration 166, Ä-38). */
	geheimNachReglement?: boolean;
	/** Der Ergebnissatz mit den Zahlen — für Leinwand, Bildschirm und dieses PDF. */
	satz: string | null;
	/**
	 * Dieselbe Wertung ohne die Zahlen, für das Protokoll.
	 *
	 * **Warum hier und nicht dort gerechnet** (28.08.2026): Das Erfordernis liegt
	 * als Objekt nur in dieser Datei vor; im Protokoll steht es bereits in Worten.
	 * Beide Sätze an derselben Stelle zu bilden ist ausserdem der Grund, aus dem
	 * es diese Datei gibt — rechneten sie getrennt, stünde eines Tages auf dem
	 * Papier eine andere Wertung als auf dem Bildschirm.
	 *
	 * **Pflichtfeld, kein Rückfall auf `satz`.** Ein stiller Rückfall hiesse:
	 * vergisst eine neue Aufrufstelle das Feld, sieht das Protokoll wieder aus
	 * wie vorher, und niemand merkt es.
	 */
	protokollsatz: string | null;
	/**
	 * Der Leinwandsatz ohne Eigentümernamen, für das Protokoll des gemeinsamen
	 * Abends (Block A3a): Zahlen und Herleitung wie `satz`, statt der Namen
	 * Anzahlen. Pflichtfeld aus demselben Grund wie `protokollsatz`: Ein
	 * Rückfall auf `satz` brächte die Namen still zurück ins Abenddokument.
	 */
	satzOhneNamen: string | null;
	auszaehlung: Auszaehlung | null;
	/**
	 * Die Vorab-Vermerke der Betroffenen (Block A2), aus dem beim Schliessen
	 * festgeschriebenen Stand, auch von wem ein Nein sie widerrufen hat. Leer,
	 * wo es keine gibt; fehlt bei Aufrufern, die keine Betroffenen kennen.
	 */
	vorab?: VorabAngabe[];
	/**
	 * Die von Hand gezählten Summen dieses Durchgangs, sofern so gezählt wurde.
	 *
	 * **Warum die Auswertung sie führt** (28.08.2026, Befund aus dem
	 * Praxisdurchlauf des Auftraggebers: «Handabstimmung fehlt im Protokoll»). Dass von Hand
	 * gezählt wurde, steht sonst nirgends im fertigen Dokument: Die Auszählung
	 * sagt es über `quotenErhoben === false`, aber der Vermerk der Sitzungsleitung,
	 * also WIE gezählt wurde, hängt am Durchgang und war bis hierher nicht
	 * durchgereicht.
	 */
	handzaehlung?: { vermerk: string | null; erfasstAm: string | null } | null;
	/**
	 * Wer bei Stimmengleichheit entschieden hat, wo das Reglement es einer Person
	 * zuweist. Der Name ist hier kein Stimmverhalten, sondern der Nachweis der
	 * Befugnis — ohne ihn liesse sich der Beschluss nicht belegen.
	 */
	stichentscheid: {
		wahl: 'yes' | 'no';
		wer: string;
		begruendung?: string;
		/** Die Person im Vorsitz ist selbst Stockwerkeigentümer (Migration 150). */
		eigentuemer?: boolean;
	} | null;
	/**
	 * Die Kennung des massgebenden Durchgangs.
	 *
	 * Gebraucht, um die stellvertretend erfassten Stimmen zu diesem Traktandum
	 * zu finden — sie hängen an der Stimme, nicht am Traktandum, weil ein
	 * Traktandum mehrere Durchgänge haben kann und nur der massgebende zählt.
	 */
	durchgangId?: string | null;
	/**
	 * Details, Präzisierungen oder Änderungen zum Beschluss des massgebenden
	 * Durchgangs (Auftraggeber, 09.09.2026). Null, wenn nichts zu präzisieren war.
	 *
	 * **Er setzt nie Annahme oder Ablehnung.** Die stehen im Satz darüber und
	 * kommen aus der Auszählung.
	 */
	beschlusstext?: string | null;
	/**
	 * Die Leitung hat erklärt, dass von Hand abgestimmt wurde, und Votum führt zu
	 * dem Traktandum sonst nichts (Beschlussvermerk, Migration 135; Block 7b).
	 * Dann steht `AUSWERTUNG_VON_HAND_ABGESTIMMT` statt «Es wurde nicht
	 * abgestimmt.». Nicht die rohe Spalte: `holeAuswertung` setzt das Feld nur,
	 * wo weder Ergebnis noch Ersetzung noch angesetzte Neuabstimmung vorliegt.
	 */
	beschlussvermerk?: boolean;
}

export interface Auswertungsangaben {
	versammlung: Versammlung;
	gemeinschaftName: string;
	/**
	 * Wie die Köpfe gezählt wurden und worauf sich das stützt. Steht gleich unter
	 * dem Kopf, weil dieselben Stimmen je nach Zählweise Annahme oder Ablehnung
	 * ergeben — ohne diesen Satz taugt das Blatt nicht als Beleg.
	 */
	zaehlweise: string | null;
	/** Der reglementarische Stichentscheid, falls die Gemeinschaft einen kennt. */
	stichentscheid: string | null;
	zeilen: Auswertungszeile[];
	/** Wann die Datei erzeugt wurde — kommt von aussen, der Kern liest keine Uhr. */
	erzeugtAm: string;
}

export async function erzeugeAuswertung(a: Auswertungsangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(20);
	const breite = A4.breite - 2 * rand;

	let seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
	let y = A4.hoehe - rand;

	/** Neue Seite, wenn unten kein Platz mehr ist. */
	function raumFuer(hoehe: number): void {
		if (y - hoehe > rand + mm(12)) return;
		seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		y = A4.hoehe - rand;
	}

	y = zeichneText(seite, a.gemeinschaftName, rand, y, breite, {
		schrift: blatt.schriften.normal,
		groesse: 10,
		farbe: GRAU
	});

	y = zeichneText(seite, 'Auswertung der Versammlung', rand, y - 18, breite, {
		schrift: blatt.schriften.fett,
		groesse: 20
	});

	y = zeichneText(
		seite,
		`${datumLang(a.versammlung.datum)}, ${a.versammlung.uhrzeit} Uhr · ${a.versammlung.ort}`,
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 11, farbe: GRAU }
	);

	if (a.zaehlweise) {
		y = zeichneText(seite, a.zaehlweise, rand, y - mm(3), breite, {
			schrift: blatt.schriften.normal,
			groesse: 9.5,
			farbe: GRAU
		});
	}

	if (a.stichentscheid) {
		y = zeichneText(seite, a.stichentscheid, rand, y, breite, {
			schrift: blatt.schriften.normal,
			groesse: 9.5,
			farbe: GRAU
		});
	}

	y -= mm(6);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= mm(8);

	for (const z of a.zeilen) {
		/*
		 * **Der Platzbedarf wächst mit dem Text zum Beschluss** (Code-Review
		 * 09.09.2026, zweiter Durchgang). `mm(38)` war für Satz und Spiegel
		 * gerechnet; ein Beschlusstext von einigen hundert Zeichen schob den
		 * Spiegel unter den Seitenrand — im Blatt, das ins Siegelpaket geht.
		 * Gerechnet mit rund 90 Zeichen je Zeile und 5 mm Zeilenhöhe.
		 */
		const zusatz = z.beschlusstext ? mm(5) * Math.ceil(z.beschlusstext.length / 90) : 0;
		raumFuer(mm(38) + zusatz);
		const einzug = rand + (z.tiefe - 1) * mm(6);
		const zeilenbreite = A4.breite - rand - einzug;

		y = zeichneText(seite, `${z.nummer}  ${z.titel}`, einzug, y, zeilenbreite, {
			schrift: blatt.schriften.fett,
			groesse: 12
		});

		if (z.spontan) {
			// Der Unterschied ist genau der, an dem eine Anfechtung ansetzt: Ein
			// Folgeantrag stützt sich auf den angekündigten Gegenstand, ein neues
			// Geschäft zur Abstimmung auf die Bestimmung des Reglements, die es
			// gestattet (Migration 127). «Aufgenommen» allein sagte beides und
			// belegte keines.
			y = zeichneText(
				seite,
				z.spontanart === 'folgeantrag'
					? 'Während der Versammlung als Folgeantrag zum angekündigten Antrag aufgenommen.'
					: z.spontanart === 'rueckkommen'
						? 'Ordnungsantrag während der Versammlung: Rückkommen auf ein behandeltes Traktandum.'
						: (z.ausnahmeVermerk ?? 'Während der Versammlung als neues Geschäft aufgenommen.'),
				einzug,
				y,
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU }
			);
		}

		if (z.art === 'kenntnisnahme') {
			y = zeichneText(seite, 'Kenntnisnahme — kein Beschluss.', einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 10.5,
				farbe: GRAU
			});
			y -= mm(4);
			continue;
		}

		if (!z.auszaehlung || !z.satz) {
			/*
			 * **Nach einem Rückkommen über einen Folgeantrag wurde abgestimmt**, nur
			 * nicht mit einem Ergebnis an diesem Traktandum (Plan Folgeantrag nach
			 * Rückkommen, Soll 6). «Es wurde nicht abgestimmt.» war dort falsch.
			 */
			const text = z.ersetzung
				? ersetzungInKuerze(z.ersetzung)
				: z.beschlussvermerk
					? AUSWERTUNG_VON_HAND_ABGESTIMMT
					: z.rueckzug
						? rueckzugInDerAuswertung(z.rueckzug, false)
						: 'Es wurde nicht abgestimmt.';
			y = zeichneText(seite, text, einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 10.5,
				farbe: GRAU
			});
			y -= mm(4);
			continue;
		}

		/*
		 * **Von Hand festgehalten** (`Auszaehlung.vonHand`): kein Erfordernis und
		 * kein Stimmenspiegel mit Bezugsgrösse, weil gegen keine Schwelle
		 * gerechnet wurde. Die eingetragenen Zahlen trägt der Satz darunter.
		 */
		const vonHand = z.auszaehlung.vonHand !== undefined;
		// Nach einer konsultativen Abstimmung ohne Erfordernis (Migration 158;
		// Codeprüfung 14.10.2026, H2): sonst stünde «Erfordernis: null» da.
		if (!vonHand && z.erfordernis) {
			y = zeichneText(
				seite,
				`Erfordernis: ${z.erfordernis}${z.rechtsgrundlage ? ` (${z.rechtsgrundlage})` : ''}` +
					(z.lesart ? `. ${z.lesart}` : ''),
				einzug,
				y,
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 10, farbe: GRAU }
			);
		}

		// Nach einer konsultativen Abstimmung zurückgezogen: der Rückzug statt des
		// Ergebnissatzes, der das Geschäft offen nennt (Schritt F2).
		y = zeichneText(seite, ergebnissatzDerAuswertung(z) ?? z.satz, einzug, y - mm(1), zeilenbreite, {
			schrift: blatt.schriften.fett,
			groesse: 11
		});

		// Die eingewendete Bestimmung unter dem Ergebnis eines Beschlusses von Hand
		// (Entscheid 0047, 3; Auftrag «Texte nach 0047», Punkt 6), wie auf der Seite.
		const einwand = z.auszaehlung.vonHand?.einwand?.bestimmung;
		if (einwand) {
			y = zeichneText(seite, einwandInDerAuswertung(einwand), einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 10
			});
		}

		/*
		 * **Unter dem Ergebnis, in normaler Schrift** (Code-Review 09.09.2026).
		 * Er fehlte im ersten Anlauf ganz: Das Feld stand im Vertrag dieser Datei
		 * und wurde nie gezeichnet. Im Siegel lag der Text damit nur maschinell
		 * lesbar in `daten/abstimmungen.json` — im Blatt, das ein Mensch aufmacht,
		 * stand er nicht.
		 */
		if (z.beschlusstext) {
			y = zeichneText(seite, z.beschlusstext, einzug, y - mm(1), zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 10
			});
		}

		const k = z.auszaehlung.koepfe;
		// Bei geheimer Abstimmung kein Zahlenspiegel (Produktentscheid 28.09.2026).
		if (!vonHand && !z.auszaehlung.geheim) {
			y = zeichneText(
				seite,
				`Kopfstimmen: ${k.ja} ja, ${k.nein} nein, ${k.enthaltung} Enthaltung, ` +
					`${k.ohneAbgabe} ohne Abgabe` +
					(k.nichtAnwesend > 0 ? `, ${k.nichtAnwesend} nicht anwesend` : '') +
					((k.stimmtNicht ?? 0) > 0 ? `, ${stimmtNichtInWorten(k.stimmtNicht ?? 0)}` : '') +
					((k.imAusstand ?? 0) > 0 ? `, ${imAusstandInWorten(k.imAusstand ?? 0)}` : '') +
					` — Bezugsgrösse ${k.basis}${k.schwelle !== null ? `, nötig ${k.schwelle}` : ''}`,
				einzug,
				y - mm(1),
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 10 }
			);
		}

		const q = z.auszaehlung.quoten;
		/*
		 * **«Nicht erhoben» ist nicht «null»** (25.08.2026). Bei einer
		 * Handzählung steht im Quotenspiegel überall null, und «0 ja, 0 nein» im
		 * Auswertungsblatt liest sich wie ein Ergebnis. Es steht dann im
		 * Dokument, das später jemand als Beleg liest.
		 */
		if (!vonHand && !z.auszaehlung.geheim) {
			y = zeichneText(
				seite,
				z.auszaehlung.quotenErhoben === false
					? // Wie im Protokoll (Block A3c): nach den Stimmen benannt, nicht nach den Quoten.
						// Konsultativ ohne den Teil zum Erfordernis, das dort fehlt (Befund 7).
						z.auszaehlung.keinBeschluss?.grund === 'konsultativ'
						? 'Stimmen nach Wertquoten: nicht erhoben (von Hand gezählt).'
						: 'Stimmen nach Wertquoten: nicht erhoben (von Hand gezählt); das Erfordernis ' +
							'verlangt hier keine Mehrheit der Wertquoten.'
					: `Wertquoten: ${q.ja} ja, ${q.nein} nein, ${q.enthaltung} Enthaltung, ` +
						`${q.ohneAbgabe} ohne Abgabe` +
						(q.nichtAnwesend > 0 ? `, ${q.nichtAnwesend} nicht anwesend` : '') +
						((q.stimmtNicht ?? 0) > 0
							? `, ${q.stimmtNicht} bei der Wohnung des Beklagten, die nicht abstimmt`
							: '') +
						((q.imAusstand ?? 0) > 0 ? `, ${imAusstandInWorten(q.imAusstand ?? 0, 'quoten')}` : '') +
						` — Bezugsgrösse ${q.basis}` +
						(q.schwelle !== null
							? `, nötig ${q.schwelle}`
							: z.auszaehlung.keinBeschluss?.grund === 'konsultativ'
								? ''
								: ' (kein Quotenerfordernis)'),
				einzug,
				y,
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 10 }
			);
		}

		// Die Namen der unmittelbar Betroffenen sind hier der Nachweis und keine
		// Preisgabe: Ohne sie liesse sich der Beschluss nicht belegen.
		if (z.stichentscheid) {
			y = zeichneText(
				seite,
				`Stichentscheid bei Stimmengleichheit durch ${z.stichentscheid.wer}` +
					(z.stichentscheid.eigentuemer
						? ' im Vorsitz, selbst Stockwerkeigentümer (der Stichentscheid ist in der Zählung ' +
							'nicht enthalten)'
						: '') +
					': ' +
					`${z.stichentscheid.wahl === 'yes' ? 'angenommen' : 'abgelehnt'}` +
					`${z.stichentscheid.begruendung ? ` — ${z.stichentscheid.begruendung}` : '.'}`,
				einzug,
				y,
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 10 }
			);
		}

		/*
		 * **Dieselben Sätze wie auf der Seite** (Auftrag A1, Anhang S7). Bei
		 * `nachher` steht der Satz nur nach angenommener Genehmigung; sonst
		 * gäbe es zur Zustimmung nichts zu sagen, weil sie die Annahme nicht
		 * bedingt. Bei `im_saal_oder_vorab` seit Block A2 der Satz aus
		 * `zustimmungImSaalOderVorabInWorten`, derselbe wie auf der Seite.
		 */
		if (zustimmungBetroffenerGefragt(z.auszaehlung)) {
			const b = z.auszaehlung.betroffene;
			if (b.form === 'nachher') {
				if (z.auszaehlung.angenommen) {
					const namen = ausstehendeNamen(b);
					y = zeichneText(
						seite,
						'Die Wertquoten können sich erst ändern, wenn die Betroffenen die Abänderungsurkunde ' +
							`unterzeichnet haben${namen ? ` (${namen})` : ''}; ein Ja im Saal ersetzt diese ` +
							'Unterschrift nicht.',
						einzug,
						y,
						zeilenbreite,
						{ schrift: blatt.schriften.normal, groesse: 10 }
					);
				}
			} else {
				y = zeichneText(
					seite,
					zustimmungImSaalOderVorabInWorten(b, z.vorab ?? []),
					einzug,
					y,
					zeilenbreite,
					{ schrift: blatt.schriften.normal, groesse: 10 }
				);
			}
		}

		// «Weitere», nicht «frühere»: Nach einem erfolglosen Rückkommen oder einer
		// Neuabstimmung auf den Durchgang danach liegt der überholte nach dem
		// massgebenden (Migration 131). Derselbe Satz auf der Auswertungsseite.
		// **«Massgebend» bleibt seit H6** (`docs/freigabe.md`, Punkt (b)): Die
		// Leitung überholt nur noch, was nicht verkündet ist. Hinter jedem
		// überholten Durchgang steht damit ein Beschluss der Versammlung oder
		// gar keiner, nie eine Anordnung gegen einen verkündeten Beschluss.
		if (z.frueherenDurchgaenge > 0) {
			y = zeichneText(
				seite,
				`Massgebend ist der ${z.durchgang}. Durchgang; ` +
					(z.frueherenDurchgaenge === 1
						? '1 weiterer wurde als überholt vermerkt und bleibt einsehbar.'
						: `${z.frueherenDurchgaenge} weitere wurden als überholt vermerkt und bleiben einsehbar.`),
				einzug,
				y,
				zeilenbreite,
				{ schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU }
			);
		}

		/*
		 * **Frühere konsultative Durchgänge mit Grund und Zahlen** (Pendenz aus
		 * Block 7, 30.10.2026): Das Feld trug seit Block 7 den Grund nach L5, das
		 * PDF zeichnete es nicht. Der Satz ist der des Protokolls, ohne den
		 * Aufzählungsstrich, und wie dort ohne Ordnungszahl, wo es nur diesen
		 * einen Durchgang gab (Laienprüfung 14.10.2026, D3).
		 */
		const konsultative = z.konsultativFrueher ?? [];
		const einziger = konsultative.length === 1 && z.frueherenDurchgaenge === 0;
		for (const k of konsultative) {
			raumFuer(mm(12));
			y = zeichneText(seite, konsultativFruehererSatz(k, !einziger).replace(/^- /, ''), einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 9.5,
				farbe: GRAU
			});
		}

		// Am Folgeantrag, am Rückkommensantrag und am Grundantrag, dessen Beschluss
		// ohne neuen blieb: wie sie zusammenhängen (Soll 6).
		if (z.ersetzung) {
			y = zeichneText(seite, ersetzungInKuerze(z.ersetzung), einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 9.5,
				farbe: GRAU
			});
		}

		for (const h of z.auszaehlung.hinweise) {
			y = zeichneText(seite, h, einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 9.5,
				farbe: GRAU
			});
		}
		// Das Ergebnis nach der anderen Lesart als Feststellung, wie im Protokoll;
		// der Rat an die Leitung gehört ihr, nicht diesem Blatt (Migration 169). Wo
		// der Protokollsatz Frist und Berechtigte nennt (1a nach A5 Punkt 14, B3),
		// stehen sie auch hier. Nur, was auch das Protokoll nennt
		// (`zweitesErgebnisImProtokoll`, wie das Abenddokument; Auftrag «Texte nach
		// 0047», Punkt 2): zu L8 und L10 ohne Abweichung kein «dasselbe».
		const geheim = z.auszaehlung.geheim;
		const nachAndererLesart =
			andereLesartenVon(z.auszaehlung)
				.filter(zweitesErgebnisImProtokoll)
				.map((r) => andereLesartInWorten(r, geheim).protokoll)
				.filter((t): t is string => t !== null)
				.join(' ') || null;
		if (nachAndererLesart) {
			y = zeichneText(seite, nachAndererLesart, einzug, y, zeilenbreite, {
				schrift: blatt.schriften.normal,
				groesse: 9.5,
				farbe: GRAU
			});
		}

		y -= mm(5);
	}

	raumFuer(mm(20));
	seite.drawLine({
		start: { x: rand, y: y + mm(3) },
		end: { x: A4.breite - rand, y: y + mm(3) },
		thickness: 0.5,
		color: LINIE
	});
	zeichneText(
		seite,
		`Erzeugt am ${a.erzeugtAm}. Diese Auswertung nennt keine Namen im Zusammenhang mit dem ` +
			'Stimmverhalten; ausgenommen sind unmittelbar Betroffene, deren Zustimmung das Gesetz ' +
			'verlangt. Massgebend ist das unterzeichnete Protokoll.',
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 9, farbe: GRAU }
	);

	return blatt.dokument.save();
}
