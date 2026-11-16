/**
 * Die Unterschriftenliste (Story 4.5, FR-32).
 *
 * **Warum sie auf Papier steht.** In der einfachen Betriebsart gibt es keine
 * Zugangskarten und keine Zeitpunkte; den Nachweis der Anwesenheit trägt die
 * unterschriebene Liste, nicht das System. Ein Häkchen in einer Software beweist
 * im Streitfall nichts — eine Unterschrift schon.
 *
 * Sie zeigt Wertquoten und Kopfstimmen mit, weil der Unterzeichnende damit
 * prüfen kann, dass er mit der richtigen Stimmkraft geführt ist. Fällt es dort
 * nicht auf, fällt es gar nicht auf.
 */
import { rgb } from 'pdf-lib';
import { A4, mm } from '$lib/domain/textsatz';
import { GRAU, LINIE, hoeheVon, neuesBlatt, zeichneText } from './basis';
import { datumLang } from './traktandenliste';

export interface Listenzeile {
	name: string;
	ausgeuebtDurch: string;
	einheiten: string[];
	kopfstimmen: number;
	wertquote: number;
	/** Bereits erfasst — dann steht statt der Linie ein Vermerk. */
	bereitsErfasst: boolean;
}

export interface Listenangaben {
	gemeinschaftName: string;
	gemeinschaftAdresse?: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	stufe: 'erste' | 'zweite';
	gesamtquote: number;
	kopfstimmenGesamt: number;
	zeilen: Listenzeile[];
}

export async function erzeugeUnterschriftenliste(a: Listenangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(16);
	const breite = A4.breite - 2 * rand;

	// Spalten: Name | Einheiten | Kopf | Quote | Unterschrift
	const xName = rand;
	const xEinheiten = rand + mm(52);
	const xKopf = rand + mm(112);
	const xQuote = rand + mm(128);
	const xUnterschrift = rand + mm(150);

	let seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
	const seiten = [seite];
	let y = A4.hoehe - rand;

	function kopfzeile(): void {
		y = zeichneText(seite, a.gemeinschaftName, rand, y, breite, {
			schrift: blatt.schriften.normal,
			groesse: 9,
			farbe: GRAU
		});

		y = zeichneText(seite, 'Anwesenheits- und Unterschriftenliste', rand, y - 15, breite, {
			schrift: blatt.schriften.fett,
			groesse: 15
		});

		const zeile = [
			`${datumLang(a.datum)}, ${a.uhrzeit} Uhr`,
			a.ort,
			a.stufe === 'zweite' ? 'Zweitversammlung' : null,
			a.gemeinschaftAdresse || null
		]
			.filter(Boolean)
			.join(' · ');

		y = zeichneText(seite, zeile, rand, y - mm(1), breite, {
			schrift: blatt.schriften.normal,
			groesse: 9.5,
			farbe: GRAU
		});

		y -= mm(5);

		// Tabellenkopf
		const kopf = { schrift: blatt.schriften.fett, groesse: 8.5, farbe: GRAU };
		zeichneText(seite, 'Eigentümer', xName, y, mm(50), kopf);
		zeichneText(seite, 'Einheiten', xEinheiten, y, mm(58), kopf);
		zeichneText(seite, 'Kopf', xKopf, y, mm(14), kopf);
		zeichneText(seite, 'Quote', xQuote, y, mm(20), kopf);
		zeichneText(seite, 'Unterschrift', xUnterschrift, y, breite - (xUnterschrift - rand), kopf);

		y -= mm(3);
		seite.drawLine({
			start: { x: rand, y },
			end: { x: A4.breite - rand, y },
			thickness: 0.8,
			color: rgb(0.4, 0.4, 0.44)
		});
		y -= mm(6);
	}

	kopfzeile();

	const MINDESTHOEHE = mm(11);
	const normal = { schrift: blatt.schriften.normal, groesse: 9.5 };
	const klein = { schrift: blatt.schriften.normal, groesse: 7.5, farbe: GRAU };

	/** Der Vertretervermerk, oder nichts, wenn die Partei selbst stimmt. */
	function vermerkVon(z: Listenzeile): string | null {
		return z.ausgeuebtDurch !== z.name ? `Stimme: ${z.ausgeuebtDurch}` : null;
	}

	/**
	 * Wie hoch die Zeile wirklich wird.
	 *
	 * **Der Anlass** (Praxisdurchlauf des Auftraggebers, «Zeilen mit zwei Eigentümern sehen
	 * anders aus»). Gemessen am erzeugten Dokument war es kein Aussehen, sondern
	 * Text auf Text: Bei einer Zeile mit fester Höhe von 11 mm stand die zweite
	 * Namenszeile 2.9 Punkte unter dem Vertretervermerk, und dessen dritte Zeile
	 * lief unter der Trennlinie hindurch in die nächste Partei.
	 *
	 * Beides trifft **nur** die Zeilen mit gemeinschaftlichem Eigentum: Dort ist
	 * der Name lang genug zum Umbrechen («Erbengemeinschaft Kunz-Nowak-Łukasik»),
	 * und nur dort steht überhaupt ein Vermerk («Ruth Kunz für …»). Genau das
	 * hat der Auftraggeber gesehen.
	 *
	 * Die Höhe folgt deshalb dem Inhalt. `MINDESTHOEHE` bleibt als Untergrenze,
	 * damit die einfachen Zeilen aussehen wie bisher und die Unterschriftslinien
	 * genug Platz behalten.
	 */
	function hoeheDerZeile(z: Listenzeile): number {
		const vermerk = vermerkVon(z);
		const name = hoeheVon(z.name, mm(50), normal);
		// Der Vermerk beginnt eine Zeile unter dem Namen, um `mm(1)` angehoben.
		const links = vermerk ? name - mm(1) + hoeheVon(vermerk, mm(50), klein) : name;
		const einheiten = hoeheVon(z.einheiten.join(', ') || '—', mm(58), klein);
		// `mm(3.5)`: Der Abstand bis zur Trennlinie, die bei `y + mm(3)` liegt.
		return Math.max(MINDESTHOEHE, Math.max(links, einheiten) + mm(3.5));
	}

	for (const z of a.zeilen) {
		const zeilenhoehe = hoeheDerZeile(z);

		// Genug Platz für Zeile plus Fusszeile?
		if (y - zeilenhoehe < rand + mm(22)) {
			seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
			seiten.push(seite);
			y = A4.hoehe - rand;
			kopfzeile();
		}

		/*
		 * Der Vermerk sitzt **unter der letzten** Namenszeile, nicht an einer
		 * festen Stelle unter der ersten: `zeichneText` gibt die nächste
		 * Grundlinie zurück, und die kennt den Umbruch.
		 */
		const nachName = zeichneText(seite, z.name, xName, y, mm(50), normal);
		const vermerk = vermerkVon(z);
		if (vermerk) {
			zeichneText(seite, vermerk, xName, nachName + mm(1), mm(50), klein);
		}

		zeichneText(seite, z.einheiten.join(', ') || '—', xEinheiten, y, mm(58), klein);
		zeichneText(seite, String(z.kopfstimmen), xKopf, y, mm(14), normal);
		zeichneText(seite, `${z.wertquote}`, xQuote, y, mm(20), normal);

		if (z.bereitsErfasst) {
			// Wer schon im System erfasst ist, unterschreibt trotzdem — der
			// Vermerk sagt nur, dass die Zeile nicht vergessen wurde.
			zeichneText(seite, 'bereits erfasst', xUnterschrift, y, mm(40), klein);
		}

		// Die Unterschriftenlinie
		seite.drawLine({
			start: { x: xUnterschrift, y: y - mm(2) },
			end: { x: A4.breite - rand, y: y - mm(2) },
			thickness: 0.5,
			color: LINIE
		});

		y -= zeilenhoehe;
		seite.drawLine({
			start: { x: rand, y: y + mm(3) },
			end: { x: A4.breite - rand, y: y + mm(3) },
			thickness: 0.3,
			color: LINIE
		});
	}

	// ── Summenzeile und Fuss ────────────────────────────────────────────────
	y -= mm(2);
	zeichneText(
		seite,
		`Insgesamt ${a.zeilen.length} ${a.zeilen.length === 1 ? 'Partei' : 'Parteien'} · ` +
			`${a.kopfstimmenGesamt} Kopfstimmen · ${a.gesamtquote} Wertquoten`,
		rand,
		y,
		breite,
		{ schrift: blatt.schriften.fett, groesse: 9.5 }
	);

	seiten.forEach((s, i) => {
		const text = `Seite ${i + 1} von ${seiten.length}`;
		const w = blatt.schriften.normal.widthOfTextAtSize(text, 8);
		s.drawText(text, {
			x: A4.breite - rand - w,
			y: mm(8),
			size: 8,
			font: blatt.schriften.normal,
			color: GRAU
		});
		s.drawText(
			'Die Unterschrift auf dieser Liste ist der Nachweis der Anwesenheit.',
			{ x: rand, y: mm(8), size: 8, font: blatt.schriften.normal, color: GRAU }
		);
	});

	return blatt.dokument.save();
}
