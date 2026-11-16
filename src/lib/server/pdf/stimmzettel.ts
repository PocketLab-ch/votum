/**
 * Der Stimmzettel auf Papier — der Ausweichplan, wenn nichts mehr geht.
 *
 * **Wofür er da ist.** Fällt der Server aus oder das Netz im Saal, muss die
 * Versammlung nicht abgebrochen werden: Sie läuft weiter, nur langsamer. Die
 * Zettel werden beim Eintreffen ausgegeben, von Hand angekreuzt, eingesammelt
 * und später übertragen. Produktentscheid 20.08.2026 — ausdrücklich statt eines
 * Saal-Bündels mit eigenem Proxy: «Wenn kein Internet, kann das Tool nur manuell
 * genutzt werden.»
 *
 * **Deshalb gehört er VOR die Versammlung gedruckt.** Ein Ausweichplan, den man
 * erst im Ausfall erzeugen kann, ist keiner — dann steht der Server ja nicht
 * mehr. Er hängt bei den Unterlagen, die ohnehin vorbereitet werden.
 *
 * ## Ein Zettel je Traktandum (Produktentscheid 14.11.2026)
 *
 * Bis dahin trug je Partei ein Blatt mehrere Traktanden, mit einer Unterschrift
 * je Blatt. Das liess zu, über spätere Traktanden schon vor ihrer Beratung
 * anzukreuzen, und ein Blatt liess sich erst einsammeln, wenn alle seine
 * Traktanden behandelt waren. Jetzt ist ein Zettel eine Stimme zu einem
 * Beschluss: ein Viertel A4 mit Gemeinschaft, Datum, Traktandum, Antrag,
 * nötigem Mehr, Partei mit Stimmgewicht, Feldern und Unterschrift. Er steht für
 * sich, auch abgeschnitten, und wird nach jedem Traktandum eingesammelt.
 *
 * **Zwei Teile nach der Zählweise.** Wo Handerheben genügt, stehen die Zettel
 * in einem eigenen, hinteren Teil, den die Sitzungsleitung nur druckt, wenn sie
 * auch dort schriftlich abstimmen lassen will. Vorne stehen die Zettel, die es
 * braucht: wo die Wertquote zählt, Einstimmigkeit verlangt ist oder sonst nach
 * der Regel der Auszählmappe Handzählen nicht genügt (die Route entscheidet
 * über `zaehlweisen`). Das Zählblatt steht ganz vorne und nennt die Seiten
 * jedes Teils.
 *
 * **Je Teil nach Person geordnet, jede Person auf eigenen Seiten.** So ergibt
 * das Schneiden je Person ein Bündel, das beim Eintreffen ausgegeben wird; wer
 * vertritt, nimmt das Bündel der Vertretenen mit. Freie Plätze in diesem Bündel
 * werden Ersatzzettel mit ihrem Namen: für einen in der Sitzung geänderten oder
 * neuen Antrag, dessen Wortlaut sonst auf keinem vorgedruckten Zettel stünde.
 * Meist stehen sie am Ende; einer kann auch vor einem halben Zettel stehen, wenn
 * dieser eine neue Zeile braucht. Gehen die Plätze genau auf, gibt es keinen.
 *
 * **Passt der Antrag nicht auf ein Viertel**, bekommt der Zettel die halbe
 * Seite. Erst wenn auch das nicht reicht, wird der Wortlaut gekürzt, und der
 * Zettel sagt das und verweist auf die Traktandenliste.
 *
 * **Und was er NICHT ist: eine geheime Abstimmung.** Der Zettel trägt den Namen
 * der Partei — anders liesse sich die Wertquote nicht zuordnen. Der Satz steht
 * auf jedem Zettel, weil im Ausfall niemand ein Handbuch aufschlägt.
 */
import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { A4, mm, umbrich } from '$lib/domain/textsatz';
import { GRAU, LINIE, SCHWARZ, hoeheVon, messer, neuesBlatt, zeichneText } from './basis';
import { datumLang } from './traktandenliste';

/**
 * In welchen Teil ein Zettel gehört. `hand`: Handerheben genügt, der Teil wird
 * nur bei Bedarf gedruckt. `zettel`: Es braucht die Zettel.
 */
export type Zettelgruppe = 'zettel' | 'hand';

export interface Zettelposten {
	/** Wie das Traktandum in der Liste heisst: «3», «3.1». */
	nummer: string;
	titel: string;
	/** Der Antragswortlaut, sofern erfasst. */
	antrag: string | null;
	/** Das nötige Mehr in Worten. */
	erfordernis: string | null;
	gruppe: Zettelgruppe;
	/**
	 * Ob die Summe der Wertquoten gebraucht wird (Schranke oder Stichentscheid
	 * nach Wertquoten). Nur dann führt das Zählblatt ihre Spalte.
	 */
	quoteZaehlt: boolean;
}

/**
 * In welchen Teil ein Traktandum kommt und ob das Zählblatt seine Quote führt.
 *
 * `weise` ist das Ergebnis von `zaehlweise` (Auszählmappe), `undefined`, wo
 * Handzählen genügt. Vorne steht, was Zettel braucht, und jedes Mehr, das kein
 * einfaches ist, auch ein noch offenes (`typ` fehlt oder `grenzfall`). Beim
 * offenen Mehr steht die Quotenlinie im Zweifel da: Es kann sich in der Sitzung
 * als qualifiziert erweisen, und dann fehlte sie auf dem gedruckten Blatt.
 */
export function zettelzuteilung(
	typ: string | undefined,
	weise: { quote: boolean } | undefined
): { gruppe: Zettelgruppe; quoteZaehlt: boolean } {
	const offen = typ === undefined || typ === 'grenzfall';
	return {
		gruppe: weise || typ !== 'einfaches_mehr' ? 'zettel' : 'hand',
		quoteZaehlt: weise?.quote ?? offen
	};
}

export interface Zettelpartei {
	name: string;
	/** Wer die Stimme ausübt, falls es nicht die Partei selbst ist. */
	ausgeuebtDurch: string;
	einheiten: string[];
	kopfstimmen: number;
	wertquote: number;
}

export interface Zettelangaben {
	gemeinschaftName: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	gesamtquote: number;
	kopfstimmenGesamt: number;
	posten: Zettelposten[];
	parteien: Zettelpartei[];
}

const RAND = mm(16);
const BREITE = A4.breite - 2 * RAND;

/** Innenrand eines Zettels: genug, dass ein ungenauer Schnitt nichts abschneidet. */
const INNEN = mm(8);
const VIERTEL = { breite: A4.breite / 2, hoehe: A4.hoehe / 2 };
const HALB = { breite: A4.breite, hoehe: A4.hoehe / 2 };
const SCHNITT = rgb(0.45, 0.47, 0.5);

const TEILE: { gruppe: Zettelgruppe; titel: string }[] = [
	{ gruppe: 'zettel', titel: 'Teil 1: Zettel nötig (Wertquote, Einstimmigkeit oder besondere Zählweise)' },
	{ gruppe: 'hand', titel: 'Teil 2: Handerheben genügt (einfaches Mehr der Anwesenden)' }
];

type Schriften = { normal: PDFFont; fett: PDFFont };

/** Wie ein Traktandum auf seinen Zettel kommt: Grösse, Schrift des Antrags, gekürzt oder nicht. */
interface Satz {
	groesse: 'viertel' | 'halb';
	antragGroesse: number;
	antragZeilen: string[];
	gekuerzt: boolean;
}

/** Ein belegter Platz auf einer Seite. `posten: null` ist ein Ersatzzettel. */
interface Platz {
	zeile: 0 | 1;
	spalte: 0 | 1 | 'ganz';
	posten: Zettelposten | null;
	satz: Satz | null;
	partei: Zettelpartei;
}

interface Teilplan {
	titel: string;
	gruppe: Zettelgruppe;
	seiten: Platz[][];
}

/**
 * Der Seitenplan in lesbarer Form, für die Tests: je Teil die Seiten, je Seite
 * die Plätze mit Traktandennummer (`null` für einen Ersatzzettel), Partei und
 * ob der Antrag gekürzt wurde. Am PDF selbst lässt sich das kaum ablesen, weil
 * die Schrift als Teilmenge eingebettet ist.
 */
export async function stimmzettelplan(a: Zettelangaben) {
	const blatt = await neuesBlatt();
	return TEILE.map((t) => planeTeil(a, t.gruppe, t.titel, blatt.schriften)).map((plan) => ({
		gruppe: plan.gruppe,
		seiten: plan.seiten.map((plaetze) =>
			plaetze.map((p) => ({
				zeile: p.zeile,
				spalte: p.spalte,
				nummer: p.posten?.nummer ?? null,
				partei: p.partei.name,
				gekuerzt: p.satz?.gekuerzt ?? false
			}))
		)
	}));
}

export async function erzeugeStimmzettel(a: Zettelangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const schriften = blatt.schriften;

	const plaene = TEILE.map((t) => planeTeil(a, t.gruppe, t.titel, schriften));

	// Erst zählen, wie viele Seiten das Zählblatt braucht, dann die Seitenangaben
	// darauf setzen: Es steht vorne, die Zettelseiten folgen.
	const zaehlseiten = zaehlblatt(null, a, plaene, 0, schriften);
	zaehlblatt(blatt.dokument, a, plaene, zaehlseiten, schriften);

	for (const plan of plaene) {
		for (const plaetze of plan.seiten) {
			const seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
			for (const p of plaetze) zeichneZettel(seite, a, p, schriften);
			zeichneSchnittlinien(seite, plaetze);
		}
	}

	return blatt.dokument.save();
}

// ── Planen ────────────────────────────────────────────────────────────────

/**
 * Verteilt die Zettel eines Teils auf Seiten: je Partei frische Seiten, vier
 * Viertel je Seite, ein halber Zettel belegt eine ganze Zeile. Was am Ende einer
 * Partei frei bleibt, wird Ersatzzettel.
 */
function planeTeil(
	a: Zettelangaben,
	gruppe: Zettelgruppe,
	titel: string,
	s: Schriften
): Teilplan {
	const posten = a.posten.filter((p) => p.gruppe === gruppe);
	const seiten: Platz[][] = [];
	if (posten.length === 0) return { titel, gruppe, seiten };

	// Der Satz je Traktandum richtet sich nach der Partei mit dem höchsten
	// Fussblock (Name, Einheiten, Stimmgewicht), damit dasselbe Traktandum bei
	// allen gleich aussieht.
	const saetze = new Map(posten.map((p) => [p, setze(p, a, s)]));

	for (const partei of a.parteien) {
		let plaetze: Platz[] = [];
		let zelle = 0;
		const neueSeite = () => {
			plaetze = [];
			seiten.push(plaetze);
			zelle = 0;
		};
		const ersatz = (z: number) =>
			plaetze.push({ ...ort(z), posten: null, satz: null, partei });
		neueSeite();

		for (const p of posten) {
			const satz = saetze.get(p)!;
			if (satz.groesse === 'viertel') {
				if (zelle === 4) neueSeite();
				plaetze.push({ ...ort(zelle), posten: p, satz, partei });
				zelle++;
			} else {
				if (zelle % 2 === 1) ersatz(zelle++);
				if (zelle === 4) neueSeite();
				plaetze.push({ zeile: zelle === 0 ? 0 : 1, spalte: 'ganz', posten: p, satz, partei });
				zelle += 2;
			}
		}
		while (zelle < 4) ersatz(zelle++);
	}
	return { titel, gruppe, seiten };
}

function ort(zelle: number): { zeile: 0 | 1; spalte: 0 | 1 } {
	return { zeile: zelle < 2 ? 0 : 1, spalte: zelle % 2 === 0 ? 0 : 1 };
}

const ANTRAGSGROESSEN = [8.5, 8, 7.5, 7];
const KUERZUNG = '… Wortlaut gekürzt, vollständig in der Traktandenliste.';

/** Wählt die Zettelgrösse: Viertel, wenn der Antrag hineinpasst, sonst halbe Seite. */
function setze(p: Zettelposten, a: Zettelangaben, s: Schriften): Satz {
	for (const groesse of ['viertel', 'halb'] as const) {
		const masse = groesse === 'viertel' ? VIERTEL : HALB;
		const breite = masse.breite - 2 * INNEN;
		const platz = antragsplatz(p, a, s, masse);
		for (const g of ANTRAGSGROESSEN) {
			// Vorprüfung an der Gesamtbreite: Braucht der Text schon ohne Umbruch
			// mehr Zeilen, als Platz ist, lohnt der (teure) Umbruch nicht.
			const mindestens = p.antrag ? s.normal.widthOfTextAtSize(p.antrag, g) / breite : 0;
			if (mindestens * g * 1.35 > platz) continue;
			const zeilen = p.antrag ? umbrich(p.antrag, breite, messer(s.normal, g)) : [];
			if (zeilen.length * g * 1.35 <= platz) {
				return { groesse, antragGroesse: g, antragZeilen: zeilen, gekuerzt: false };
			}
		}
	}
	// Ohne Antrag gibt es nichts zu kürzen; dann ist nur der Kopf zu lang, und
	// der Zettel nimmt die halbe Seite.
	if (!p.antrag) return { groesse: 'halb', antragGroesse: 8, antragZeilen: [], gekuerzt: false };
	// Auch die halbe Seite reicht nicht: kürzen, und das sagen.
	const breite = HALB.breite - 2 * INNEN;
	const g = ANTRAGSGROESSEN[ANTRAGSGROESSEN.length - 1];
	const platz = antragsplatz(p, a, s, HALB);
	const passend = Math.max(1, Math.floor(platz / (g * 1.35)) - 1);
	// Nur den Anfang umbrechen, der gebraucht wird; bei einem sehr langen
	// Wortlaut kostet der Umbruch des Ganzen Sekunden.
	const antrag = p.antrag;
	const gesamt = s.normal.widthOfTextAtSize(antrag, g);
	const anfang = antrag.slice(0, Math.ceil((antrag.length * (passend + 2) * breite) / gesamt) + 20);
	const zeilen = umbrich(anfang, breite, messer(s.normal, g)).slice(0, passend);
	return {
		groesse: 'halb',
		antragGroesse: g,
		antragZeilen: [...zeilen, ...umbrich(KUERZUNG, breite, messer(s.normal, g))],
		gekuerzt: true
	};
}

/** Wie viel Höhe auf einem Zettel dieser Masse für den Antragswortlaut bleibt. */
function antragsplatz(
	p: Zettelposten,
	a: Zettelangaben,
	s: Schriften,
	masse: { breite: number; hoehe: number }
): number {
	const breite = masse.breite - 2 * INNEN;
	const oben = kopfhoehe(p, a, breite, s);
	const unten = Math.max(0, ...a.parteien.map((partei) => fusshoehe(partei, a, breite, s)));
	return masse.hoehe - 2 * INNEN - oben - unten - mm(3);
}

// ── Ein Zettel ────────────────────────────────────────────────────────────

function kopfzeile(a: Zettelangaben): string {
	return `${a.gemeinschaftName} · Versammlung vom ${datumLang(a.datum)}`;
}

function mehrzeile(p: Zettelposten): string | null {
	return p.erfordernis ? `Nötiges Mehr: ${p.erfordernis}` : null;
}

/** Höhe über dem Antrag: Gemeinschaft, Traktandum, Titel; darunter das Mehr. */
function kopfhoehe(p: Zettelposten, a: Zettelangaben, breite: number, s: Schriften): number {
	let h = hoeheVon(kopfzeile(a), breite, { schrift: s.normal, groesse: 7 }) + mm(1.5);
	h += hoeheVon(`Traktandum ${p.nummer}`, breite, { schrift: s.fett, groesse: 10 });
	h += hoeheVon(p.titel, breite, { schrift: s.fett, groesse: 9 }) + mm(1);
	const mehr = mehrzeile(p);
	if (mehr) h += mm(1) + hoeheVon(mehr, breite, { schrift: s.normal, groesse: 7 });
	return h;
}

function parteizeilen(partei: Zettelpartei, a: Zettelangaben): { text: string; fett: boolean; groesse: number }[] {
	const zeilen = [{ text: partei.name, fett: true, groesse: 9 }];
	if (partei.ausgeuebtDurch && partei.ausgeuebtDurch !== partei.name) {
		zeilen.push({ text: `Stimme ausgeübt durch ${partei.ausgeuebtDurch}`, fett: false, groesse: 7 });
	}
	if (partei.einheiten.length > 0) {
		zeilen.push({ text: partei.einheiten.join(', '), fett: false, groesse: 7 });
	}
	zeilen.push({
		text:
			`${partei.kopfstimmen} ${partei.kopfstimmen === 1 ? 'Kopfstimme' : 'Kopfstimmen'} ` +
			`von ${a.kopfstimmenGesamt} · Wertquote ${partei.wertquote} von ${a.gesamtquote}`,
		fett: true,
		groesse: 8.5
	});
	return zeilen;
}

function parteihoehe(partei: Zettelpartei, a: Zettelangaben, breite: number, s: Schriften): number {
	return parteizeilen(partei, a).reduce(
		(h, z) => h + hoeheVon(z.text, breite, { schrift: z.fett ? s.fett : s.normal, groesse: z.groesse }),
		0
	);
}

/** Unterschrift, Felder und Partei, von unten gezählt. */
const UNTERSCHRIFT_HOEHE = mm(8);
const FELDER_HOEHE = mm(5);
function fusshoehe(partei: Zettelpartei, a: Zettelangaben, breite: number, s: Schriften): number {
	return UNTERSCHRIFT_HOEHE + mm(4) + FELDER_HOEHE + mm(3) + parteihoehe(partei, a, breite, s);
}

function zeichneZettel(seite: PDFPage, a: Zettelangaben, p: Platz, s: Schriften): void {
	const masse = p.spalte === 'ganz' ? HALB : VIERTEL;
	const x0 = (p.spalte === 1 ? VIERTEL.breite : 0) + INNEN;
	const oben = A4.hoehe - p.zeile * VIERTEL.hoehe - INNEN;
	const unten = A4.hoehe - (p.zeile + 1) * VIERTEL.hoehe + INNEN;
	const breite = masse.breite - 2 * INNEN;

	// ── Oben: worum es geht ──
	let y = oben - 7;
	y = zeichneText(seite, kopfzeile(a), x0, y, breite, { schrift: s.normal, groesse: 7, farbe: GRAU });
	y -= mm(1.5);

	if (p.posten && p.satz) {
		y = zeichneText(seite, `Traktandum ${p.posten.nummer}`, x0, y, breite, { schrift: s.fett, groesse: 10 });
		y = zeichneText(seite, p.posten.titel, x0, y, breite, { schrift: s.fett, groesse: 9 });
		y -= mm(1);
		for (const zeile of p.satz.antragZeilen) {
			if (zeile !== '') {
				seite.drawText(zeile, { x: x0, y, size: p.satz.antragGroesse, font: s.normal, color: SCHWARZ });
			}
			y -= p.satz.antragGroesse * 1.35;
		}
		const mehr = mehrzeile(p.posten);
		if (mehr) {
			y -= mm(1);
			zeichneText(seite, mehr, x0, y, breite, { schrift: s.normal, groesse: 7, farbe: GRAU });
		}
	} else {
		y = zeichneText(seite, 'Ersatzzettel für einen geänderten oder neuen Antrag', x0, y, breite, {
			schrift: s.fett,
			groesse: 9
		});
		y -= mm(2);
		y = zeichneText(seite, 'Traktandum', x0, y, breite, { schrift: s.normal, groesse: 8 });
		seite.drawLine({
			start: { x: x0 + mm(18), y: y + 8 * 1.35 - mm(0.5) },
			end: { x: x0 + breite, y: y + 8 * 1.35 - mm(0.5) },
			thickness: 0.5,
			color: GRAU
		});
		y -= mm(1);
		y = zeichneText(seite, 'Antrag, wie ihn die Sitzungsleitung zur Abstimmung bringt:', x0, y, breite, {
			schrift: s.normal,
			groesse: 7,
			farbe: GRAU
		});
		// Linien zum Schreiben, bis zum Fuss.
		const grenze = unten + fusshoehe(p.partei, a, breite, s) + mm(9);
		for (let ly = y - mm(4); ly > grenze; ly -= mm(6.5)) {
			seite.drawLine({ start: { x: x0, y: ly }, end: { x: x0 + breite, y: ly }, thickness: 0.5, color: LINIE });
		}
		zeichneText(seite, 'Nötiges Mehr:', x0, grenze - mm(2), breite, { schrift: s.normal, groesse: 7, farbe: GRAU });
		seite.drawLine({
			start: { x: x0 + mm(18), y: grenze - mm(2.3) },
			end: { x: x0 + breite, y: grenze - mm(2.3) },
			thickness: 0.5,
			color: LINIE
		});
	}

	// ── Unten: wer stimmt, wie, und die Unterschrift ──
	const yUnterschrift = unten + mm(4);
	// Fest 50 mm, auf jedem Zettel gleich: Der Test erkennt sie an dieser Länge.
	const linienbreite = mm(50);
	seite.drawLine({
		start: { x: x0, y: yUnterschrift },
		end: { x: x0 + linienbreite, y: yUnterschrift },
		thickness: 0.8,
		color: SCHWARZ
	});
	zeichneText(seite, 'Unterschrift', x0, yUnterschrift - mm(3), linienbreite, {
		schrift: s.normal,
		groesse: 6.5,
		farbe: GRAU
	});
	zeichneText(
		seite,
		'Ankreuzen, unterschreiben, abgeben. Nicht für geheime Abstimmung.',
		x0 + linienbreite + mm(3),
		yUnterschrift + mm(2),
		breite - linienbreite - mm(3),
		{ schrift: s.normal, groesse: 6, farbe: GRAU }
	);

	const yFelder = unten + UNTERSCHRIFT_HOEHE + mm(4);
	kaestchen(seite, x0, yFelder + FELDER_HOEHE, breite, s.normal);

	let yp = yFelder + FELDER_HOEHE + mm(3) + parteihoehe(p.partei, a, breite, s);
	for (const z of parteizeilen(p.partei, a)) {
		yp = zeichneText(seite, z.text, x0, yp - z.groesse, breite, {
			schrift: z.fett ? s.fett : s.normal,
			groesse: z.groesse,
			farbe: z.fett ? SCHWARZ : GRAU
		}) + z.groesse;
	}
}

/** Die drei Felder. Gross genug, dass ein Kreuz hineinpasst. */
function kaestchen(seite: PDFPage, x0: number, y: number, breite: number, schrift: PDFFont): void {
	const kante = FELDER_HOEHE;
	const abstand = Math.min(mm(34), breite / 3.4);
	['Ja', 'Nein', 'Enthaltung'].forEach((wort, i) => {
		const x = x0 + i * abstand;
		seite.drawRectangle({ x, y: y - kante, width: kante, height: kante, borderColor: SCHWARZ, borderWidth: 1 });
		seite.drawText(wort, { x: x + kante + mm(1.5), y: y - kante + mm(1.2), size: 9, font: schrift, color: SCHWARZ });
	});
}

/** Gestrichelt, über die ganze Seite: wo geschnitten wird. Keine senkrechte Linie durch einen halben Zettel. */
function zeichneSchnittlinien(seite: PDFPage, plaetze: Platz[]): void {
	const strich = { thickness: 0.4, color: SCHNITT, dashArray: [3, 3] };
	seite.drawLine({ start: { x: 0, y: VIERTEL.hoehe }, end: { x: A4.breite, y: VIERTEL.hoehe }, ...strich });
	for (const zeile of [0, 1] as const) {
		const belegt = plaetze.filter((p) => p.zeile === zeile);
		if (belegt.length === 0 || belegt.some((p) => p.spalte === 'ganz')) continue;
		const y0 = zeile === 0 ? VIERTEL.hoehe : 0;
		seite.drawLine({ start: { x: VIERTEL.breite, y: y0 }, end: { x: VIERTEL.breite, y: y0 + VIERTEL.hoehe }, ...strich });
	}
}

// ── Das Zählblatt ─────────────────────────────────────────────────────────

/**
 * Das Zählblatt: wohin die Sitzungsleitung die Summen schreibt.
 *
 * **Warum es dazugehört.** Die Zettel werden eingesammelt, aber das Ergebnis
 * muss im Saal verkündet werden — vor dem Übertragen in die Anwendung, die ja
 * gerade nicht läuft. Ohne vorbereitetes Blatt entsteht die Zählung auf einem
 * Notizzettel, und der ist später der einzige Beleg.
 *
 * **Vorne, mit den Seiten jedes Teils**, damit beim Drucken klar ist, welche
 * Seiten es braucht. Die Quotenspalte steht nur, wo die Wertquote zählt.
 *
 * Ohne Dokument misst die Funktion nur und gibt die Zahl ihrer Seiten zurück;
 * die Zettelseiten beginnen danach.
 */
function zaehlblatt(
	dokument: Awaited<ReturnType<typeof neuesBlatt>>['dokument'] | null,
	a: Zettelangaben,
	plaene: Teilplan[],
	zaehlseiten: number,
	s: Schriften
): number {
	let seiten = 0;
	let seite = null as PDFPage | null;
	let y = 0;
	const neueSeite = () => {
		seiten++;
		seite = dokument ? dokument.addPage([A4.breite, A4.hoehe]) : null;
		y = A4.hoehe - RAND;
	};
	const text = (t: string, x: number, breite: number, stil: Parameters<typeof zeichneText>[5]) =>
		seite ? zeichneText(seite, t, x, y, breite, stil) : y - hoeheVon(t, breite, stil);

	neueSeite();
	y = text(a.gemeinschaftName, RAND, BREITE, { schrift: s.normal, groesse: 9, farbe: GRAU });
	y -= mm(1);
	y = text('Zählblatt der Sitzungsleitung', RAND, BREITE, { schrift: s.fett, groesse: 16 });
	y -= mm(1);
	y = text(
		`Versammlung vom ${datumLang(a.datum)}, ${a.uhrzeit} Uhr · ${a.ort} · ${a.kopfstimmenGesamt} ` +
			`Kopfstimmen, Wertquoten gesamt ${a.gesamtquote}`,
		RAND,
		BREITE,
		{ schrift: s.normal, groesse: 9.5, farbe: GRAU }
	);
	y -= mm(2);
	for (const absatz of [
		'Je Traktandum ein Zettel, nach jedem Traktandum einsammeln. Die Zettel sind in zwei Teile ' +
			'geordnet, je Teil nach Person; jede Person beginnt auf einer neuen Seite. Freie Plätze in ' +
			'ihrem Bündel sind Ersatzzettel für einen geänderten oder neuen Antrag.',
		'Wo Handerheben genügt, stehen die Zettel in Teil 2. Drucken Sie ihn nur, wenn Sie auch dort ' +
			'mit Zetteln abstimmen lassen.',
		'Die Zettel sind namentlich und taugen nicht für eine geheime Abstimmung. Dort zählen Sie Köpfe ' +
			'auf neutralen Zetteln.'
	]) {
		y = text(absatz, RAND, BREITE, { schrift: s.normal, groesse: 9 });
		y -= mm(1.5);
	}

	const spalten = [
		{ x: RAND, breite: mm(64), titel: 'Traktandum' },
		{ x: RAND + mm(66), breite: mm(20), titel: 'Ja (Kopf)' },
		{ x: RAND + mm(88), breite: mm(20), titel: 'Nein (Kopf)' },
		{ x: RAND + mm(110), breite: mm(16), titel: 'Enth.' },
		{ x: RAND + mm(128), breite: mm(22), titel: 'Ja (Quote)' },
		{ x: RAND + mm(152), breite: mm(26), titel: 'Ergebnis' }
	];

	let erste = zaehlseiten + 1;
	for (const plan of plaene) {
		const posten = a.posten.filter((p) => p.gruppe === plan.gruppe);
		const n = plan.seiten.length;
		const bereich =
			posten.length === 0
				? 'keine Traktanden'
				: n === 0
					? 'keine Zettel'
					: n === 1
						? `Zettel auf Seite ${erste}`
						: `Zettel auf den Seiten ${erste} bis ${erste + n - 1}`;
		erste += n;
		// Die Quotenspalte nur, wo in diesem Teil eine Quote zu zählen ist.
		const mitQuote = posten.some((p) => p.quoteZaehlt);
		const kopf = spalten.filter((sp) => mitQuote || sp.titel !== 'Ja (Quote)');
		const spaltenkopf = () => {
			for (const sp of kopf) text(sp.titel, sp.x, sp.breite, { schrift: s.fett, groesse: 8.5 });
			y -= mm(3);
			if (seite) {
				seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREITE, y }, thickness: 0.8, color: LINIE });
			}
			y -= mm(6);
		};

		if (y < RAND + mm(40)) neueSeite();
		y -= mm(4);
		y = text(`${plan.titel} · ${bereich}`, RAND, BREITE, { schrift: s.fett, groesse: 10.5 });
		if (posten.length === 0) continue;
		y -= mm(1);
		spaltenkopf();

		for (const p of posten) {
			const titel = `${p.nummer}  ${p.titel}`;
			const zeile = Math.max(mm(10), hoeheVon(titel, mm(64), { schrift: s.normal, groesse: 9.5 }) + mm(4));
			if (y - zeile < RAND) {
				// Auf der neuen Seite den Spaltenkopf wiederholen, sonst weiss
				// niemand, welche Linie welche Zahl trägt.
				neueSeite();
				spaltenkopf();
			}
			text(titel, RAND, mm(64), { schrift: s.normal, groesse: 9.5 });
			if (seite) {
				for (const sp of kopf.slice(1)) {
					if (sp.titel === 'Ja (Quote)' && !p.quoteZaehlt) continue;
					seite.drawLine({
						start: { x: sp.x, y: y - mm(1) },
						end: { x: sp.x + sp.breite, y: y - mm(1) },
						thickness: 0.5,
						color: GRAU
					});
				}
			}
			y -= zeile;
		}
	}
	return seiten;
}
