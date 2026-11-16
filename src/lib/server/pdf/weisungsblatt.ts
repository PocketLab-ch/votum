/**
 * Das Weisungsblatt (Story 7.8).
 *
 * **Wofür es da ist.** Tagen die Häuser getrennt, erscheint an der
 * Umgebungsversammlung nur der Vertreter. Was er mitbringt, ist die Weisung
 * seines Hauses — und die muss er belegen können. Das Blatt ist die
 * Ermächtigung in der Hand: je Traktandum das Ergebnis der Hausabstimmung mit
 * Datum, dazu die Fundstelle, aus der sich seine Vertretungsmacht ergibt.
 *
 * **Ein Blatt je Haus, nicht eines für alle.** Der Vertreter von Haus 4 hat mit
 * den Weisungen von Haus 8 nichts zu tun; ein gemeinsames Blatt gäbe ihm ohne
 * Not Auskunft darüber, wie die anderen stimmen werden — und im Saal ist das
 * ein Unterschied.
 *
 * Es ersetzt das Protokoll nicht. Massgebend bleibt der Beschluss des Hauses;
 * das Blatt verweist darauf.
 */
import { A4, mm } from '$lib/domain/textsatz';
import { GRAU, LINIE, neuesBlatt, zeichneText } from './basis';
import { datumLang } from '$lib/domain/datum';

export interface Weisungszeile {
	nummer: string;
	titel: string;
	antragswortlaut: string | null;
	/** Die Weisung in Worten, aus dem Kern. */
	satz: string;
	/** Woraus sie sich ergibt — Datum und Zahlen des Hausbeschlusses. */
	beleg: string | null;
}

export interface Weisungsblattangaben {
	/** Die Gemeinschaft, in der abgestimmt wird — die MEG. */
	gemeinschaftName: string;
	/** Das weisungsgebende Haus. */
	hausName: string;
	vertreter: string | null;
	/** Fundstelle der Vertretungsmacht, etwa «Art. 7 Ziff. 3». */
	grundlage: string | null;
	datum: string;
	uhrzeit: string;
	ort: string;
	zeilen: Weisungszeile[];
	erzeugtAm: string;
}

export async function erzeugeWeisungsblatt(a: Weisungsblattangaben): Promise<Uint8Array> {
	const blatt = await neuesBlatt();
	const rand = mm(20);
	const breite = A4.breite - 2 * rand;

	let seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
	let y = A4.hoehe - rand;

	function raumFuer(hoehe: number): void {
		if (y - hoehe > rand + mm(14)) return;
		seite = blatt.dokument.addPage([A4.breite, A4.hoehe]);
		y = A4.hoehe - rand;
	}

	y = zeichneText(seite, a.hausName, rand, y, breite, {
		schrift: blatt.schriften.normal,
		groesse: 10,
		farbe: GRAU
	});

	y = zeichneText(seite, 'Weisung an den Vertreter', rand, y - 18, breite, {
		schrift: blatt.schriften.fett,
		groesse: 20
	});

	y = zeichneText(
		seite,
		`${a.gemeinschaftName} · ${datumLang(a.datum)}, ${a.uhrzeit} Uhr · ${a.ort}`,
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 11, farbe: GRAU }
	);

	// Wer das Blatt vorlegt und woraus sich seine Befugnis ergibt: Genau hier
	// setzt eine Anfechtung an, und ohne die Angaben taugt das Blatt nicht als
	// Nachweis.
	y = zeichneText(
		seite,
		a.vertreter
			? `Vertreter: ${a.vertreter}` + (a.grundlage ? ` (${a.grundlage})` : '')
			: 'Es ist kein Vertreter bezeichnet. Ohne ihn kann die Stimme nicht abgegeben werden.',
		rand,
		y - mm(3),
		breite,
		{ schrift: blatt.schriften.fett, groesse: 11 }
	);

	y -= mm(6);
	seite.drawLine({
		start: { x: rand, y },
		end: { x: A4.breite - rand, y },
		thickness: 0.7,
		color: LINIE
	});
	y -= mm(8);

	if (a.zeilen.length === 0) {
		zeichneText(
			seite,
			'Für diese Versammlung liegt keine Weisung vor.',
			rand,
			y,
			breite,
			{ schrift: blatt.schriften.normal, groesse: 11 }
		);
		return blatt.dokument.save();
	}

	for (const z of a.zeilen) {
		raumFuer(mm(34));

		y = zeichneText(seite, `${z.nummer}  ${z.titel}`, rand, y, breite, {
			schrift: blatt.schriften.fett,
			groesse: 12
		});

		if (z.antragswortlaut) {
			y = zeichneText(seite, z.antragswortlaut, rand, y, breite, {
				schrift: blatt.schriften.normal,
				groesse: 10.5,
				farbe: GRAU
			});
		}

		y = zeichneText(seite, z.satz, rand, y - mm(1), breite, {
			schrift: blatt.schriften.fett,
			groesse: 11.5
		});

		if (z.beleg) {
			y = zeichneText(seite, z.beleg, rand, y, breite, {
				schrift: blatt.schriften.normal,
				groesse: 10,
				farbe: GRAU
			});
		}

		y -= mm(5);
	}

	raumFuer(mm(22));
	seite.drawLine({
		start: { x: rand, y: y + mm(3) },
		end: { x: A4.breite - rand, y: y + mm(3) },
		thickness: 0.5,
		color: LINIE
	});
	zeichneText(
		seite,
		`Erzeugt am ${a.erzeugtAm}. Dieses Blatt gibt die Weisung des Hauses wieder und ersetzt das ` +
			'Protokoll nicht; massgebend ist der Beschluss, auf den es verweist.',
		rand,
		y - mm(2),
		breite,
		{ schrift: blatt.schriften.normal, groesse: 9, farbe: GRAU }
	);

	return blatt.dokument.save();
}
