import { describe, expect, it } from 'vitest';
import {
	dateinamensform,
	dosZeitstempel,
	eindeutigeNamen,
	NAMENSLAENGE,
	packe,
	pruefsumme
} from '../../src/lib/domain/archiv';

const STEMPEL = dosZeitstempel('2026-09-15T19:30:00');

function text(inhalt: string): Uint8Array {
	return new TextEncoder().encode(inhalt);
}

/** Liest eine vorzeichenlose Zahl kleinstwertiges Byte zuerst. */
function zahl(bytes: Uint8Array, stelle: number, breite: number): number {
	let wert = 0;
	for (let i = breite - 1; i >= 0; i--) wert = wert * 256 + bytes[stelle + i];
	return wert;
}

describe('Dateinamen', () => {
	it('schreibt Umlaute aus, statt sie zu entfernen', () => {
		// «Mller» wäre keinem Eigentümer mehr zuzuordnen.
		expect(dateinamensform('Müller')).toBe('Mueller');
		expect(dateinamensform('Bäckerstrasse Öhler Übertragung')).toBe(
			'Baeckerstrasse-Oehler-Uebertragung'
		);
		expect(dateinamensform('Strauß')).toBe('Strauss');
	});

	it('nimmt anderen Zeichen die Zeichensetzung darüber', () => {
		expect(dateinamensform('Bézier')).toBe('Bezier');
		expect(dateinamensform('Château')).toBe('Chateau');
	});

	it('macht aus allem Übrigen Bindestriche, ohne sie zu häufen', () => {
		expect(dateinamensform('Erbengemeinschaft Kunz & Co. AG')).toBe(
			'Erbengemeinschaft-Kunz-Co-AG'
		);
		expect(dateinamensform('  ...Meier...  ')).toBe('Meier');
	});

	it('lässt nie einen leeren Namen entstehen', () => {
		// Ein Eintrag ohne Namen bräche das Archiv an einer Stelle, an der niemand
		// nachsieht.
		expect(dateinamensform('...')).toBe('ohne-namen');
		expect(dateinamensform('')).toBe('ohne-namen');
	});

	it('kürzt lange Namen und lässt keinen Bindestrich am Ende stehen', () => {
		const lang = dateinamensform('A'.repeat(200));
		expect(lang.length).toBe(NAMENSLAENGE);
		expect(dateinamensform('x'.repeat(NAMENSLAENGE - 1) + ' Meier')).not.toMatch(/-$/);
	});
});

describe('Doppelte Namen', () => {
	it('nummeriert vor der Endung', () => {
		expect(eindeutigeNamen(['a.pdf', 'a.pdf', 'a.pdf'])).toEqual(['a.pdf', 'a-2.pdf', 'a-3.pdf']);
	});

	it('lässt einzelne Namen unangetastet', () => {
		expect(eindeutigeNamen(['a.pdf', 'b.pdf'])).toEqual(['a.pdf', 'b.pdf']);
	});

	it('kommt auch ohne Endung zurecht', () => {
		expect(eindeutigeNamen(['Meier', 'Meier'])).toEqual(['Meier', 'Meier-2']);
	});
});

describe('Prüfsumme', () => {
	it('trifft die bekannten Werte', () => {
		// Der Prüfwert von «123456789» ist der Prüfstein jeder CRC-32-Umsetzung.
		expect(pruefsumme(text('123456789'))).toBe(0xcbf43926);
		expect(pruefsumme(new Uint8Array(0))).toBe(0);
	});
});

describe('Zeitstempel', () => {
	it('rechnet Datum und Zeit ins Format von MS-DOS', () => {
		const s = dosZeitstempel('2026-09-15T19:30:00');
		expect((s.datum >> 9) + 1980).toBe(2026);
		expect((s.datum >> 5) & 0x0f).toBe(9);
		expect(s.datum & 0x1f).toBe(15);
		expect(s.zeit >> 11).toBe(19);
		expect((s.zeit >> 5) & 0x3f).toBe(30);
	});

	it('nimmt auch die Form mit Leerzeichen entgegen', () => {
		expect(dosZeitstempel('2026-09-15 19:30:00')).toEqual(dosZeitstempel('2026-09-15T19:30:00'));
	});

	it('bleibt bei Unsinn ein gültiger Stempel', () => {
		// Ein Archiv soll nicht daran scheitern, dass ein Zeitpunkt fehlt.
		expect(() => dosZeitstempel('irgendwas')).not.toThrow();
		expect(dosZeitstempel('1970-01-01T00:00:00').datum >> 9).toBe(0);
	});
});

describe('Das Archiv', () => {
	it('beginnt mit der Kennung, die jeder Entpacker erwartet', () => {
		const zip = packe([{ name: 'a.txt', inhalt: text('hallo') }], STEMPEL);
		expect(zahl(zip, 0, 4)).toBe(0x04034b50);
	});

	it('trägt jeden Eintrag im Verzeichnis und zählt sie richtig', () => {
		const zip = packe(
			[
				{ name: 'a.txt', inhalt: text('eins') },
				{ name: 'b.txt', inhalt: text('zwei') }
			],
			STEMPEL
		);

		// Der Abschluss steht am Ende und trägt die Anzahl.
		const abschluss = zip.length - 22;
		expect(zahl(zip, abschluss, 4)).toBe(0x06054b50);
		expect(zahl(zip, abschluss + 8, 2)).toBe(2);
		expect(zahl(zip, abschluss + 10, 2)).toBe(2);

		// Verzeichnisgrösse und -beginn müssen zusammenpassen, sonst findet ein
		// Entpacker die Einträge nicht.
		const groesse = zahl(zip, abschluss + 12, 4);
		const beginn = zahl(zip, abschluss + 16, 4);
		expect(beginn + groesse).toBe(abschluss);
		expect(zahl(zip, beginn, 4)).toBe(0x02014b50);
	});

	it('legt die Bytes unverdichtet ab', () => {
		// PDF-Dateien sind bereits verdichtet; ein zweiter Durchgang gewänne nichts.
		const inhalt = text('unverändert durchgereicht');
		const zip = packe([{ name: 'a.txt', inhalt }], STEMPEL);
		expect(zahl(zip, 8, 2)).toBe(0); // Verfahren 0
		expect(zahl(zip, 18, 4)).toBe(inhalt.length); // verdichtete Grösse
		expect(zahl(zip, 22, 4)).toBe(inhalt.length); // ursprüngliche Grösse
	});

	it('kennzeichnet die Namen als UTF-8', () => {
		// Ohne die Flagge liest ein Entpacker sie als Codepage 437 — «Zugang für»
		// wird dann zu «Zugang fA1/4r».
		const zip = packe([{ name: 'für.txt', inhalt: text('x') }], STEMPEL);
		expect(zahl(zip, 6, 2) & 0x0800).toBe(0x0800);
	});

	it('schreibt die Prüfsumme des Inhalts', () => {
		const inhalt = text('123456789');
		const zip = packe([{ name: 'a.txt', inhalt }], STEMPEL);
		expect(zahl(zip, 14, 4)).toBe(0xcbf43926);
	});

	it('wirft bei doppelten Namen', () => {
		// Stiller Verlust: Ein Archiv mit dreizehn statt vierzehn Karten fiele erst
		// auf, wenn jemand nicht hereinkommt.
		expect(() =>
			packe(
				[
					{ name: 'a.pdf', inhalt: text('eins') },
					{ name: 'a.pdf', inhalt: text('zwei') }
				],
				STEMPEL
			)
		).toThrow(/zweimal/);
	});

	it('bleibt bei leerem Inhalt ein gültiges Archiv', () => {
		const zip = packe([], STEMPEL);
		expect(zip.length).toBe(22);
		expect(zahl(zip, 0, 4)).toBe(0x06054b50);
	});
});
