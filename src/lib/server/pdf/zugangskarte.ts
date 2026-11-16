/**
 * Die persönliche Zugangskarte (Story 3.7, FR-29).
 *
 * **Eine Karte je Eigentümer, getrennt von der Traktandenliste.** Der Grund
 * steht in der Story und ist es wert, hier zu stehen: Die Traktandenliste ist
 * für alle identisch, der Zugang ist es nicht. Zusammengefasst entstünden
 * vierzehn vollständige Traktandenlisten, jede Änderung an der Liste würde alle
 * Zugänge neu erfordern, und beim Kuvertieren führte ein vertauschtes Blatt
 * dazu, dass jemand mit fremder Identität abstimmt.
 *
 * Der QR-Code wird als Rechtecke gezeichnet, nicht als Bild eingebettet. Damit
 * ist er auflösungsunabhängig scharf — auf einem Bürodrucker ebenso wie am
 * Bildschirm —, und es braucht keinen Bildumweg über PNG.
 */
import QRCode from 'qrcode';
import { rgb } from 'pdf-lib';
import { A4, mm } from '$lib/domain/textsatz';
import { gruppiere } from '$lib/domain/zugang';
import { GRAU, LINIE, neuesBlatt, zeichneText } from './basis';
import { datumLang } from './traktandenliste';

export interface Karteneinheit {
	label: string;
	/** Stammquote dieser Einheit, im Nenner der Gemeinschaft. */
	quote: number;
	/** Ob sie eine eigene Kopfstimme trägt — nur bei der Zählung je Einheit von Belang. */
	traegtKopfstimme: boolean;
}

export interface Karteninhalt {
	name: string;
	/**
	 * Wer die Stimme ausübt, falls jemand bezeichnet ist.
	 *
	 * **Steht seit dem 27.08.2026 nicht mehr auf der Karte** (Produktentscheid).
	 * Gebraucht wird die Angabe weiter für die Versandliste im Paket, die ein
	 * inneres Blatt ist und keine Urkunde für den Eigentümer. Warum sie vom
	 * Zettel verschwunden ist, steht unten bei der gezeichneten Zeile.
	 */
	ausgeuebtDurch: string;
	/**
	 * Ob die Einheit mehreren Personen gemeinsam gehört (ZGB Art. 712o Abs. 1).
	 *
	 * **Eine eigene Angabe und nicht der Vergleich `ausgeuebtDurch !== name`.**
	 * Genau dieser Vergleich stand hier bis zum 27.08.2026 und trug die Zeile
	 * «Die Stimme übt aus: …». Seit die Bezeichnung der Vertretung freiwillig
	 * ist, sagt er das Falsche: Eine Hülle ohne bezeichnete Vertretung sieht
	 * darin aus wie eine gewöhnliche Zeile — also gerade der Fall, für den der
	 * Satz unten gedacht ist.
	 */
	istGemeinschaftlich: boolean;
	einheiten: Karteneinheit[];
	/** Die Stimmkraft dieser Partei, gerechnet auf der Momentaufnahme. */
	kopfstimmen: number;
	wertquote: number;
	code: string;
	link: string;
	/**
	 * Andere Gemeinschaften desselben Abends, in denen dieselbe Person ebenfalls
	 * stimmberechtigt ist (Prüflauf II, B-06). Leer im Normalfall.
	 */
	auchIn?: string[];
}

export interface Kartenrahmen {
	gemeinschaftName: string;
	/** Wo die Gemeinschaft liegt — Strasse und Ort, für die Zuordnung des Gebäudes. */
	gemeinschaftAdresse?: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	/** Nenner der Wertquoten, damit die Zahl auf der Karte eine Bezugsgrösse hat. */
	gesamtquote: number;
	/** Die Zählweise, weil sie die Kopfstimmen erklärt. */
	zaehlweise: 'per_owner' | 'per_unit';
	/** Bei der einfachen Betriebsart erklärt die Karte, was zu tun ist. */
	betriebsart: 'gefuehrt' | 'einfach';
}

/**
 * Zeichnet den QR-Code als Rechtecke.
 *
 * Fehlerkorrektur auf mittlerer Stufe: Eine Karte wird gefaltet, geknickt und
 * im Saal aus der Tasche gezogen. Die höchste Stufe machte den Code dichter und
 * damit für ältere Telefonkameras schwerer lesbar — genau die, die im Saal
 * stehen.
 */
async function zeichneQr(
	seite: ReturnType<Awaited<ReturnType<typeof neuesBlatt>>['dokument']['addPage']>,
	inhalt: string,
	x: number,
	y: number,
	kantenlaenge: number
): Promise<void> {
	const qr = QRCode.create(inhalt, { errorCorrectionLevel: 'M' });
	const groesse = qr.modules.size;
	const daten = qr.modules.data;
	const modul = kantenlaenge / groesse;

	seite.drawRectangle({
		x,
		y,
		width: kantenlaenge,
		height: kantenlaenge,
		color: rgb(1, 1, 1)
	});

	for (let zeile = 0; zeile < groesse; zeile++) {
		for (let spalte = 0; spalte < groesse; spalte++) {
			if (!daten[zeile * groesse + spalte]) continue;
			seite.drawRectangle({
				x: x + spalte * modul,
				// Der QR-Code zählt von oben, das PDF von unten.
				y: y + kantenlaenge - (zeile + 1) * modul,
				// Ein Hauch Überlappung: Ohne ihn zeigen manche Betrachter feine
				// weisse Linien zwischen den Modulen, und die stören das Lesen.
				width: modul * 1.02,
				height: modul * 1.02,
				color: rgb(0, 0, 0)
			});
		}
	}
}

/** Eine einzelne Karte als eigenständiges PDF. */
export async function erzeugeZugangskarte(
	rahmen: Kartenrahmen,
	inhalt: Karteninhalt
): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
	await zeichneKarte(blatt, seite, rahmen, inhalt);
	return blatt.dokument.save();
}

/**
 * Alle Karten in einer Datei, eine Seite je Person.
 *
 * Für den Serienbrief: Wer vierzehn Karten einzeln herunterlädt, druckt
 * vierzehnmal — und beim vierzehnten Mal ist die Reihenfolge im Stapel
 * ungewiss.
 */
export async function erzeugeZugangskarten(
	rahmen: Kartenrahmen,
	inhalte: Karteninhalt[]
): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	for (const inhalt of inhalte) {
		const seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		await zeichneKarte(blatt, seite, rahmen, inhalt);
	}
	// Ohne Inhalt trotzdem eine Seite: Ein PDF ohne Seiten lässt sich nicht
	// öffnen, und ein Hinweis darauf ist besser als eine unlesbare Datei.
	if (inhalte.length === 0) {
		const seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		zeichneText(
			seite,
			'Für diese Versammlung ist kein Zugang erzeugt.',
			mm(20),
			A4.hoehe - mm(40),
			A4.breite - mm(40),
			{ schrift: blatt.schriften.normal, groesse: 12 }
		);
	}
	return blatt.dokument.save();
}

async function zeichneKarte(
	blatt: Awaited<ReturnType<typeof neuesBlatt>>,
	seite: ReturnType<Awaited<ReturnType<typeof neuesBlatt>>['dokument']['addPage']>,
	rahmen: Kartenrahmen,
	inhalt: Karteninhalt
): Promise<void> {
	const rand = mm(22);
	const breite = A4.breite - 2 * rand;
	let y = A4.hoehe - rand;

	y = zeichneText(seite, rahmen.gemeinschaftName, rand, y, breite, {
		schrift: blatt.schriften.normal,
		groesse: 10,
		farbe: GRAU
	});

	y = zeichneText(seite, 'Persönliche Zugangskarte', rand, y - 20, breite, {
		schrift: blatt.schriften.fett,
		groesse: 20
	});

	// Der Zweck gleich unter dem Titel, in Lesegrösse.
	//
	// Wer die Karte aus dem Kuvert nimmt, soll in einem Satz wissen, wozu sie da
	// ist. Stünde das erst unten im Kleingedruckten, landete sie im Stapel «später
	// ansehen» — und am Versammlungsabend liegt sie zu Hause. Der Satz richtet
	// sich nach der Betriebsart: Bei der geführten stimmt man damit ab, bei der
	// einfachen wird im Saal von Hand abgestimmt, und ein Versprechen aufs
	// Abstimmen wäre dort schlicht falsch.
	y = zeichneText(
		seite,
		rahmen.betriebsart === 'gefuehrt'
			? 'Damit stimmen Sie an der Versammlung ab.'
			: 'Damit weisen Sie sich an der Versammlung aus und sehen die Unterlagen ein.',
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.fett, groesse: 13 }
	);

	y = zeichneText(
		seite,
		`${datumLang(rahmen.datum)}, ${rahmen.uhrzeit} Uhr · ${rahmen.ort}`,
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 11, farbe: GRAU }
	);

	if (rahmen.gemeinschaftAdresse) {
		y = zeichneText(seite, `Liegenschaft: ${rahmen.gemeinschaftAdresse}`, rand, y, breite, {
			schrift: blatt.schriften.normal,
			groesse: 10,
			farbe: GRAU
		});
	}

	y -= mm(7);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= mm(9);

	// ── Wem sie gehört ──────────────────────────────────────────────────────
	y = zeichneText(seite, inhalt.name, rand, y - 16, breite, {
		schrift: blatt.schriften.fett,
		groesse: 16
	});

	/*
	 * **Kein Name unter dem Namen** (Produktentscheid 27.08.2026).
	 *
	 * Bis hierher stand hier «Die Stimme übt aus: Anna Muster». Drei Einwände,
	 * alle nachgeprüft und alle zutreffend:
	 *
	 * 1. **Der Einlass prüft die Karte, nicht die Person.** `bestaetigeAnwesenheit`
	 *    arbeitet auf der Eigentümerzeile; wer den Code hat, kommt herein. Der
	 *    gedruckte Name war eine Aussage, keine Schranke.
	 * 2. **Kommt Beat statt Anna, ist das zulässig.** Ist nur einer der
	 *    Mitberechtigten anwesend, darf die Sitzungsleitung annehmen, dass er
	 *    gültig vertritt, und zwar ohne Vollmacht (Wermelinger, Rz. 19 ad
	 *    Art. 712o). Nur der Zettel sagte das Gegenteil, und eine Sitzungsleitung,
	 *    die sich daran hielt, wies Beat ab. Dann fiel eine Stimme aus, die
	 *    gezählt hätte.
	 * 3. **Die Stimme hängt am Anteil, nicht an einer Person.** Ein Name in
	 *    Fettschrift und der andere im Kleingedruckten behauptete eine Rangordnung,
	 *    die Art. 712o nicht kennt.
	 *
	 * Was bleibt, sagt die Sache bereits: der Name der Zeile (bei
	 * gemeinschaftlichem Eigentum beide Namen), die Einheiten und die Rechnung
	 * «1 Kopfstimme · 250 von 1000 Wertquoten». Zwei Namen und eine Kopfstimme.
	 *
	 * Der Satz darunter beantwortet die Frage, die beim Lesen entsteht: Wieso
	 * steht da eine Stimme, wenn wir zwei sind? **Was nicht auf den Zettel
	 * gehört**, ist die Folge der Uneinigkeit (ungültig, wirkt wie ein Nein). Die
	 * steht in der Einladung — `vertretungssatz` und `gemeinschaftssatz` in
	 * `$lib/domain/einladung`.
	 */
	if (inhalt.istGemeinschaftlich) {
		y = zeichneText(
			seite,
			'Eine Stimme für diese Einheit. Eine Person gibt sie ab.',
			rand,
			y - mm(1),
			breite,
			{ schrift: blatt.schriften.normal, groesse: 11 }
		);
	}

	// ── Kontrollangaben ─────────────────────────────────────────────────────
	//
	// Wozu sie da sind: Der Eigentümer soll auf einen Blick prüfen können, dass
	// die Karte ihm gehört und mit der richtigen Stimmkraft — bevor er damit im
	// Saal steht. Eine falsch kuvertierte Karte fällt hier auf; im Saal fiele
	// sie erst auf, wenn schon abgestimmt ist.
	y -= mm(5);
	y = zeichneText(seite, 'Zur Kontrolle', rand, y, breite, {
		schrift: blatt.schriften.fett,
		groesse: 10.5
	});

	const spalteQuote = rand + mm(88);
	for (const e of inhalt.einheiten) {
		const zeile = y - mm(0.5);
		zeichneText(seite, e.label, rand, zeile, mm(84), {
			schrift: blatt.schriften.normal,
			groesse: 10.5
		});
		const quote = `${e.quote} / ${rahmen.gesamtquote}${
			// Der Hinweis nur dort, wo er etwas erklärt: Bei der Zählung je
			// Eigentümer ändert die Kennzeichnung nichts an der Kopfzahl.
			rahmen.zaehlweise === 'per_unit' && !e.traegtKopfstimme ? '  (ohne Kopfstimme)' : ''
		}`;
		y = zeichneText(seite, quote, spalteQuote, zeile, breite - (spalteQuote - rand), {
			schrift: blatt.schriften.normal,
			groesse: 10.5,
			farbe: GRAU
		});
	}

	if (inhalt.einheiten.length === 0) {
		y = zeichneText(seite, 'Keine Einheit zugeordnet.', rand, y - mm(0.5), breite, {
			schrift: blatt.schriften.normal,
			groesse: 10.5,
			farbe: GRAU
		});
	}

	seite.drawLine({
		start: { x: rand, y: y + mm(2) },
		end: { x: A4.breite - rand, y: y + mm(2) },
		thickness: 0.5,
		color: LINIE
	});

	y = zeichneText(
		seite,
		`${inhalt.kopfstimmen} ${inhalt.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'}` +
			`  ·  ${inhalt.wertquote} von ${rahmen.gesamtquote} Wertquoten`,
		rand,
		y - mm(2.5),
		breite,
		{ schrift: blatt.schriften.fett, groesse: 11 }
	);

	y = zeichneText(
		seite,
		rahmen.zaehlweise === 'per_owner'
			? 'Eine Kopfstimme je Eigentümer, unabhängig von der Zahl der Einheiten.'
			: 'Eine Kopfstimme je Einheit, wie im Reglement dieser Gemeinschaft vorgesehen.',
		rand,
		y,
		breite,
		{ schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU }
	);

	y = zeichneText(
		seite,
		'Stimmt etwas davon nicht, melden Sie sich vor der Versammlung bei der Bewirtschaftung.',
		rand,
		y,
		breite,
		{ schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU }
	);

	// ── QR-Code und Code ────────────────────────────────────────────────────
	const qrKante = mm(50);
	const qrY = y - mm(9) - qrKante;
	await zeichneQr(seite, inhalt.link, rand, qrY, qrKante);

	const textX = rand + qrKante + mm(10);
	const textBreite = A4.breite - rand - textX;
	let ty = y - mm(11);

	ty = zeichneText(
		seite,
		rahmen.betriebsart === 'gefuehrt'
			? 'Zum Abstimmen: mit dem Telefon abscannen'
			: 'Zu den Unterlagen: mit dem Telefon abscannen',
		textX,
		ty,
		textBreite,
		{ schrift: blatt.schriften.fett, groesse: 12 }
	);

	ty = zeichneText(
		seite,
		'Oder diese Adresse eingeben und den Code abtippen:',
		textX,
		ty - mm(2),
		textBreite,
		{ schrift: blatt.schriften.normal, groesse: 10, farbe: GRAU }
	);

	ty = zeichneText(seite, inhalt.link, textX, ty - mm(1), textBreite, {
		schrift: blatt.schriften.normal,
		groesse: 10
	});

	// Der Code in Vierergruppen und gross: Er wird im Saal abgetippt, unter
	// Zeitdruck und oft ohne Brille.
	ty = zeichneText(seite, gruppiere(inhalt.code), textX, ty - mm(4), textBreite, {
		schrift: blatt.schriften.fett,
		groesse: 15
	});

	// ── Was zu tun ist ──────────────────────────────────────────────────────
	let fy = qrY - mm(14);
	seite.drawLine({
		start: { x: rand, y: fy + mm(6) },
		end: { x: A4.breite - rand, y: fy + mm(6) },
		thickness: 0.7,
		color: LINIE
	});

	const anleitung =
		rahmen.betriebsart === 'gefuehrt'
			? 'Bringen Sie diese Karte an die Versammlung mit — ohne sie können Sie nicht abstimmen. ' +
				'Beim Eintreffen scannen Sie den Code: Damit sind Sie als anwesend erfasst, und bei jeder ' +
				'Abstimmung erscheint die Frage auf Ihrem Gerät.'
			: 'Bringen Sie diese Karte an die Versammlung mit. Die Anwesenheit wird auf der ' +
				'Unterschriftenliste erfasst, und abgestimmt wird im Saal durch Handerheben. Der Code gibt ' +
				'Ihnen vorher und nachher Einblick in die Unterlagen.';

	fy = zeichneText(seite, anleitung, rand, fy, breite, {
		schrift: blatt.schriften.normal,
		groesse: 11
	});

	fy = zeichneText(
		seite,
		'Diese Karte ist persönlich und gilt nur für diese Versammlung. Geben Sie sie nicht weiter — ' +
			'wer den Code hat, stimmt in Ihrem Namen ab. Ist sie verloren gegangen, melden Sie sich bei ' +
			'der Bewirtschaftung: Sie erhalten eine neue, und die alte wird damit ungültig.',
		rand,
		fy - mm(4),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 9.5, farbe: GRAU }
	);

	/*
	 * **Die zweite Karte ist kein Versehen** (Prüflauf II, B-06). Wer in zwei
	 * Gemeinschaften desselben Abends Eigentum hält, bekommt zwei Karten mit
	 * zwei Codes — richtig, denn er ist in jeder eine eigene Partei mit eigener
	 * Stimmkraft. Ohne diesen Satz stand darüber nur «gilt nur für diese
	 * Versammlung», und das legt nahe, eine der beiden sei falsch.
	 *
	 * Der Satz erscheint nur, wo er zutrifft — bei siebenundzwanzig von
	 * achtundzwanzig Karten wäre er Lärm.
	 */
	if (inhalt.auchIn && inhalt.auchIn.length > 0) {
		const wo = inhalt.auchIn.join(', ');
		zeichneText(
			seite,
			`Sie halten auch in ${inhalt.auchIn.length === 1 ? 'einer weiteren Gemeinschaft' : `${inhalt.auchIn.length} weiteren Gemeinschaften`} ` +
				`Eigentum, die an diesem Abend tagt (${wo}). Dafür erhalten Sie je eine eigene Karte — ` +
				'jede gilt nur für ihre Gemeinschaft, und Sie brauchen alle. Bringen Sie sie zusammen mit.',
			rand,
			fy - mm(3),
			breite,
			{ schrift: blatt.schriften.fett, groesse: 9.5 }
		);
	}
}
