import { describe, expect, it } from 'vitest';
import {
	ALPHABET,
	AUSGABECODELAENGE,
	AUSGABECODE_GUELTIG_MINUTEN,
	ausgabecodeAus,
	CODELAENGE,
	erkenneCodeart,
	gruppiere,
	istAusgabecode,
	istKartencode,
	pruefeIrgendeinenCode
} from '../../src/lib/domain/zugang';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';

function bytes(n: number): Uint8Array {
	const b = new Uint8Array(n);
	for (let i = 0; i < n; i++) b[i] = (i * 13) % 256;
	return b;
}

describe('Gestalt des Ausgabecodes', () => {
	it('ist kurz genug zum Vorlesen', () => {
		// Er wird vor einem Saal voller Leute vorgelesen oder auf einen Zettel
		// geschrieben. Zwanzig Zeichen sind dafür unbrauchbar.
		expect(AUSGABECODELAENGE).toBeLessThanOrEqual(8);
		expect(gruppiere(ausgabecodeAus(bytes(64)))).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
	});

	it('nutzt dasselbe Alphabet ohne verwechselbare Zeichen', () => {
		const code = ausgabecodeAus(bytes(64));
		expect([...code].every((z) => ALPHABET.includes(z))).toBe(true);
	});

	it('ist lang genug für die kurze Gültigkeit', () => {
		// Acht Zeichen aus 29 ergeben rund 39 Bit. Bei fünfzehn Minuten
		// Gültigkeit und einmaliger Verwendung ist Raten aussichtslos.
		const bits = AUSGABECODELAENGE * Math.log2(ALPHABET.length);
		expect(bits).toBeGreaterThan(35);
		expect(AUSGABECODE_GUELTIG_MINUTEN).toBeLessThanOrEqual(30);
	});

	it('verwirft Bytes über der Grenze, statt sie zu verbiegen', () => {
		const grenze = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
		expect(() => ausgabecodeAus(new Uint8Array(100).fill(grenze))).toThrow(/Zufallsbytes/);
	});
});

describe('Beide Arten unterscheiden', () => {
	it('erkennt den Kartencode an seiner Länge', () => {
		expect(istKartencode('ABCDEFGHJKMNPQRSTWXY')).toBe(true);
		expect(istAusgabecode('ABCDEFGHJKMNPQRSTWXY')).toBe(false);
		expect(erkenneCodeart('ABCDEFGHJKMNPQRSTWXY')).toBe('karte');
	});

	it('erkennt den Ausgabecode an seiner Länge', () => {
		expect(istAusgabecode('ABCDEFGH')).toBe(true);
		expect(istKartencode('ABCDEFGH')).toBe(false);
		expect(erkenneCodeart('ABCDEFGH')).toBe('ausgabe');
	});

	it('erkennt beide unabhängig von Schreibweise und Bindestrichen', () => {
		expect(erkenneCodeart('abcd-efgh')).toBe('ausgabe');
		expect(erkenneCodeart('abcd efgh jkmn pqrs twxy')).toBe('karte');
	});

	it('nimmt beide entgegen, ohne dass jemand die Art wählen muss', () => {
		// Die Person weiss nicht, welche Art Code sie in der Hand hält — ein
		// Formular, das danach fragt, verlangt Wissen, das niemand hat.
		expect(pruefeIrgendeinenCode('abcd-efgh').art).toBe('ausgabe');
		expect(pruefeIrgendeinenCode('abcd-efgh-jkmn-pqrs-twxy').art).toBe('karte');
	});

	it('nennt bei falscher Länge beide Längen', () => {
		try {
			pruefeIrgendeinenCode('ABCDEF');
			expect.unreachable();
		} catch (f) {
			const m = (f as FachlicherFehler).message;
			expect(m).toMatch(new RegExp(String(CODELAENGE)));
			expect(m).toMatch(new RegExp(String(AUSGABECODELAENGE)));
			expect(m).toMatch(/6 Zeichen/);
		}
	});

	it('nennt ein unbekanntes Zeichen beim Namen', () => {
		expect(() => pruefeIrgendeinenCode('ABCD0FGH')).toThrow(/«0»/);
	});

	it('weist eine Länge dazwischen ab', () => {
		expect(erkenneCodeart('ABCDEFGHJK')).toBeNull();
		expect(() => pruefeIrgendeinenCode('ABCDEFGHJK')).toThrow(FachlicherFehler);
	});
});
