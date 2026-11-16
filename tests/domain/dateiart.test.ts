import { describe, expect, it } from 'vitest';
import {
	BEZEICHNUNGEN,
	beschreibeAbgelehntes,
	erkenneArt,
	ZUGELASSENE_ARTEN
} from '../../src/lib/domain/dateiart';

/** Baut ein Byte-Feld aus einer Signatur und Füllmaterial dahinter. */
function datei(...bytes: number[]): Uint8Array {
	return new Uint8Array([...bytes, ...new Array(32).fill(0x41)]);
}

/** Ein HEIC-Kopf: 4 Bytes Länge, «ftyp», dann die Marke. */
function heic(marke: string): Uint8Array {
	return new Uint8Array([
		0x00, 0x00, 0x00, 0x18,
		0x66, 0x74, 0x79, 0x70,
		...[...marke].map((c) => c.charCodeAt(0)),
		...new Array(16).fill(0)
	]);
}

describe('Erkennen aus dem Inhalt', () => {
	it('erkennt ein PDF', () => {
		expect(erkenneArt(datei(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBe(
			'application/pdf'
		);
	});

	it('erkennt ein JPEG, gleich ob JFIF oder Exif', () => {
		expect(erkenneArt(datei(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(erkenneArt(datei(0xff, 0xd8, 0xff, 0xe1))).toBe('image/jpeg');
	});

	it('erkennt ein PNG an der vollen Signatur', () => {
		expect(erkenneArt(datei(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
	});

	it('weist ein PNG ab, dessen Zeilenenden umgewandelt wurden', () => {
		// Die \r\n in der Signatur sind Absicht: Sie entlarven eine Datei, die
		// durch eine Textumwandlung gelaufen ist und damit beschädigt wurde.
		expect(erkenneArt(datei(0x89, 0x50, 0x4e, 0x47, 0x0a, 0x1a, 0x0a))).toBeNull();
	});

	it('erkennt die HEIC-Marken der Telefone', () => {
		for (const marke of ['heic', 'heix', 'mif1', 'msf1']) {
			expect(erkenneArt(heic(marke))).toBe('image/heic');
		}
	});

	it('weist einen anderen ISO-Behälter ab', () => {
		// Ein MP4 hat denselben Aufbau und eine andere Marke. Es ist nicht
		// zugelassen, und «Behälter stimmt» genügt deshalb nicht.
		expect(erkenneArt(heic('isom'))).toBeNull();
	});

	it('erkennt nichts in einer leeren oder zu kurzen Datei', () => {
		expect(erkenneArt(new Uint8Array([]))).toBeNull();
		expect(erkenneArt(new Uint8Array([0x25, 0x50]))).toBeNull();
	});

	it('erkennt jede zugelassene Art auch tatsächlich', () => {
		// Gegenprobe zur Liste: Eine Art, die dort steht und nie erkannt wird,
		// wäre eine Zusage, die nichts einlöst.
		const erkannt = new Set(
			[
				erkenneArt(datei(0x25, 0x50, 0x44, 0x46, 0x2d)),
				erkenneArt(datei(0xff, 0xd8, 0xff)),
				erkenneArt(datei(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
				erkenneArt(heic('heic'))
			].filter(Boolean)
		);
		expect([...erkannt].sort()).toEqual([...ZUGELASSENE_ARTEN].sort());
	});
});

describe('Die Angabe des Browsers zählt nicht', () => {
	it('erkennt eine als PDF ausgegebene ausführbare Datei', () => {
		// Genau der Fall, für den diese Prüfung da ist: Der Dateityp im Formular
		// ist eine Behauptung des Absenders.
		const exe = datei(0x4d, 0x5a, 0x90, 0x00);
		expect(erkenneArt(exe)).toBeNull();
		expect(beschreibeAbgelehntes(exe, 'application/pdf')).toMatch(/ausführbares Programm/);
	});

	it('erkennt ein umbenanntes Word-Dokument', () => {
		const docx = datei(0x50, 0x4b, 0x03, 0x04);
		expect(erkenneArt(docx)).toBeNull();
		expect(beschreibeAbgelehntes(docx, 'application/pdf')).toMatch(/Makros/);
	});

	it('erkennt das alte Office-Format', () => {
		const doc = datei(0xd0, 0xcf, 0x11, 0xe0);
		expect(beschreibeAbgelehntes(doc, 'application/msword')).toMatch(/Word- oder Excel/);
	});

	it('nennt bei Unbekanntem beides: was zugelassen ist und was behauptet wurde', () => {
		const text = beschreibeAbgelehntes(datei(0x48, 0x61, 0x6c, 0x6c), 'text/plain');
		expect(text).toMatch(/PDF/);
		expect(text).toMatch(/text\/plain/);
		expect(text).toMatch(/Inhalt, nicht die Angabe/);
	});

	it('nennt die ELF- und Mach-O-Formate ebenfalls als Programm', () => {
		expect(beschreibeAbgelehntes(datei(0x7f, 0x45, 0x4c, 0x46), '')).toMatch(/Programm/);
		expect(beschreibeAbgelehntes(datei(0xcf, 0xfa, 0xed, 0xfe), '')).toMatch(/Programm/);
	});
});

describe('Bezeichnungen', () => {
	it('hat für jede zugelassene Art eine lesbare Bezeichnung', () => {
		for (const art of ZUGELASSENE_ARTEN) {
			expect(BEZEICHNUNGEN[art]).toBeTruthy();
			expect(BEZEICHNUNGEN[art]).not.toContain('/');
		}
	});
});
