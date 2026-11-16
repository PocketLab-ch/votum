import { describe, expect, it } from 'vitest';
import {
	ALPHABET,
	CODELAENGE,
	codeAus,
	codeAusScan,
	gibtZutritt,
	gruppiere,
	noetigeBytes,
	normalisiere,
	pruefeCode,
	zugangsLink,
	zutrittsgrund
} from '../../src/lib/domain/zugang';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';

describe('Alphabet', () => {
	it('enthält keine auf Papier verwechselbaren Zeichen', () => {
		// Wer den Code abtippt, tut es im Saal — unter Zeitdruck, oft ohne Brille.
		for (const heikel of ['I', 'l', 'O', '0', '1', 'U', 'V']) {
			expect(ALPHABET).not.toContain(heikel);
		}
	});

	it('hat keine Doppelung', () => {
		expect(new Set(ALPHABET).size).toBe(ALPHABET.length);
	});

	it('ergibt zusammen mit der Länge genügend Zufall', () => {
		// Rund 97 Bit. Raten scheidet damit aus, auch ohne Sperre nach zu vielen
		// Versuchen — und eine Sperre wäre gefährlich, weil sie sich zum
		// Aussperren einzelner Eigentümer missbrauchen liesse.
		const bits = CODELAENGE * Math.log2(ALPHABET.length);
		expect(bits).toBeGreaterThan(90);
	});
});

describe('Code aus Zufallsbytes', () => {
	it('hat die vorgesehene Länge und nur erlaubte Zeichen', () => {
		const bytes = new Uint8Array(noetigeBytes());
		for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) % 256;
		const code = codeAus(bytes);
		expect(code).toHaveLength(CODELAENGE);
		expect([...code].every((z) => ALPHABET.includes(z))).toBe(true);
	});

	it('verwirft Bytes über der Grenze, statt sie zu verbiegen', () => {
		// 256 ist kein Vielfaches von 29; ein einfaches `byte % 29` bevorzugte die
		// ersten neun Zeichen. Bei einem Zugangscode ist das keine akademische
		// Feinheit, sondern eine Einschränkung des Suchraums.
		const grenze = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

		// Lauter Bytes knapp über der Grenze: Es darf kein Zeichen entstehen.
		const nurVerworfene = new Uint8Array(100).fill(grenze);
		expect(() => codeAus(nurVerworfene)).toThrow(/Zufallsbytes/);
	});

	it('verteilt gleichmässig über das Alphabet', () => {
		// Alle Bytes unterhalb der Grenze genau einmal: Jedes Zeichen muss dann
		// gleich oft vorkommen.
		const grenze = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
		const alle = new Uint8Array(grenze);
		for (let i = 0; i < grenze; i++) alle[i] = i;

		const zaehler = new Map<string, number>();
		for (const b of alle) {
			const z = ALPHABET[b % ALPHABET.length];
			zaehler.set(z, (zaehler.get(z) ?? 0) + 1);
		}
		expect(new Set(zaehler.values()).size).toBe(1);
	});

	it('bricht ab, wenn zu wenige Bytes kommen', () => {
		expect(() => codeAus(new Uint8Array(3))).toThrow(FachlicherFehler);
	});
});

describe('Gestalt und Eingabe', () => {
	it('gruppiert in Vierergruppen', () => {
		expect(gruppiere('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
	});

	it('nimmt Gruppierung, Leerzeichen und Kleinschreibung entgegen', () => {
		expect(normalisiere('abcd-efgh jkmn')).toBe('ABCDEFGHJKMN');
	});

	it('nimmt einen gültigen Code an, wie immer er getippt wurde', () => {
		const code = 'ABCDEFGHJKMNPQRSTWXY';
		expect(pruefeCode(code)).toBe(code);
		expect(pruefeCode(gruppiere(code).toLowerCase())).toBe(code);
	});

	it('weist eine falsche Länge ab', () => {
		expect(() => pruefeCode('ABCD')).toThrow(/20 Zeichen/);
	});

	it('weist ein Zeichen ab, das es im Alphabet nicht gibt', () => {
		expect(() => pruefeCode('ABCDEFGHJKMNPQRSTWX0')).toThrow(/kommt in einem Zugangscode nicht vor/);
	});
});

describe('Zugangslink', () => {
	it('setzt den Code in den Pfad', () => {
		expect(zugangsLink('https://versammlung.example.ch', 'ABCD-EFGH')).toBe(
			'https://versammlung.example.ch/z/ABCDEFGH'
		);
	});

	it('verträgt einen Schrägstrich am Ende der Basis', () => {
		expect(zugangsLink('https://x.ch/', 'ABCD')).toBe('https://x.ch/z/ABCD');
	});
});

describe('Zutritt', () => {
	it('gilt bei freigegebener und laufender Versammlung', () => {
		expect(gibtZutritt({ zustand: 'gueltig' }, 'freigegeben')).toBe(true);
		expect(gibtZutritt({ zustand: 'gueltig' }, 'laufend')).toBe(true);
	});

	it('gilt vor der Freigabe nicht', () => {
		expect(gibtZutritt({ zustand: 'gueltig' }, 'entwurf')).toBe(false);
	});

	it('ist nach dem Schliessen wertlos, ohne dass er entwertet werden müsste', () => {
		// Sonst hinge die Gültigkeit an einem Aufräumschritt, der auch ausbleiben
		// kann.
		expect(gibtZutritt({ zustand: 'gueltig' }, 'geschlossen')).toBe(false);
		expect(gibtZutritt({ zustand: 'gueltig' }, 'versiegelt')).toBe(false);
	});

	it('gilt nach dem Ersetzen nicht mehr', () => {
		expect(gibtZutritt({ zustand: 'ersetzt' }, 'laufend')).toBe(false);
		expect(gibtZutritt({ zustand: 'entwertet' }, 'laufend')).toBe(false);
	});

	it('nennt den Grund, wenn kein Zutritt besteht', () => {
		expect(zutrittsgrund({ zustand: 'gueltig' }, 'laufend')).toBeNull();
		expect(zutrittsgrund({ zustand: 'ersetzt' }, 'laufend')).toMatch(/zuletzt zugestellte/);
		expect(zutrittsgrund({ zustand: 'gueltig' }, 'entwurf')).toMatch(/noch nicht einberufen/);
		expect(zutrittsgrund({ zustand: 'gueltig' }, 'geschlossen')).toMatch(/geschlossen/);
	});
});

describe('codeAusScan', () => {
	const CODE = 'ABCDEFGHJKMNPQRSTWXY';

	it('holt den Code aus der Adresse, die im QR-Code der Karte steht', () => {
		// Genau das liefert ein Scanner: nicht den Code, sondern den Link.
		expect(codeAusScan(`https://versammlung.example.ch/z/${gruppiere(CODE)}`)).toBe(CODE);
	});

	it('nimmt auch den blossen Code entgegen — abgetippt oder vom Handscanner', () => {
		expect(codeAusScan(gruppiere(CODE))).toBe(CODE);
		expect(codeAusScan(CODE.toLowerCase())).toBe(CODE);
	});

	it('lässt sich von Abfrageteil, Sprungmarke und Schrägstrich am Ende nicht beirren', () => {
		expect(codeAusScan(`https://x.ch/z/${CODE}?quelle=karte`)).toBe(CODE);
		expect(codeAusScan(`https://x.ch/z/${CODE}#oben`)).toBe(CODE);
		expect(codeAusScan(`https://x.ch/z/${CODE}/`)).toBe(CODE);
		expect(codeAusScan(`  https://x.ch/z/${CODE}  `)).toBe(CODE);
	});

	it('würde als blosse Normalisierung die ganze Adresse verschlucken', () => {
		// Der Grund, warum es diese Funktion überhaupt gibt: `normalisiere` wirft
		// nur die Trennzeichen weg und macht aus der Adresse einen Code, den es
		// nicht gibt — samt einer Fehlermeldung, die niemandem weiterhilft.
		const adresse = `https://x.ch/z/${CODE}`;
		expect(normalisiere(adresse)).not.toBe(CODE);
		expect(normalisiere(adresse).length).toBeGreaterThan(CODELAENGE);
	});
});
