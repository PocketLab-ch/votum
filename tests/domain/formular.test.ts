/**
 * Die Umwandlung von Formulardaten liegt zwar in der Schale, ist aber reine
 * Rechnerei ohne I/O und deshalb hier prüfbar. Sie verdient eigene Tests, weil
 * ihre Fehler still sind: Aus einem leeren Feld wird eine 0, aus «1000abc» eine
 * 1000, und niemand merkt es, bis eine Auszählung nicht aufgeht.
 */
import { describe, expect, it } from 'vitest';
import { ausFormular, ganzzahl, jaNein, text } from '$lib/server/formular';

function formular(paare: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(paare)) f.append(k, v);
	return f;
}

describe('ganzzahl', () => {
	it('liest eine Zahl', () => {
		expect(ganzzahl('1000')).toBe(1000);
	});

	it('gibt NaN für ein leeres Feld — nicht 0', () => {
		// `Number('')` ergibt 0. Beim Wertquoten-Nenner wäre das die stille
		// Umdeutung eines vergessenen Feldes in «blosse Klammer».
		expect(ganzzahl('')).toBeNaN();
		expect(ganzzahl('   ')).toBeNaN();
		expect(ganzzahl(null)).toBeNaN();
	});

	it('gibt NaN für Text mit Zahlenanfang — nicht die Zahl', () => {
		// `parseInt('1000abc')` ergäbe 1000. Hier soll der Kern die Eingabe
		// abweisen, statt einen halb gelesenen Wert zu übernehmen.
		expect(ganzzahl('1000abc')).toBeNaN();
	});

	it('behält Nachkommastellen, damit der Kern sie abweisen kann', () => {
		expect(ganzzahl('1000.5')).toBe(1000.5);
	});
});

describe('text', () => {
	it('beschneidet Leerzeichen', () => {
		expect(text('  Musterweg  ')).toBe('Musterweg');
	});

	it('macht aus fehlend eine leere Zeichenkette', () => {
		expect(text(null)).toBe('');
	});
});

describe('jaNein', () => {
	it('erkennt beide Schreibweisen eines gesetzten Kästchens', () => {
		expect(jaNein('true')).toBe(true);
		expect(jaNein('on')).toBe(true);
	});

	it('wertet ein fehlendes Kästchen als nein', () => {
		// Ein nicht gesetztes Kontrollkästchen erscheint gar nicht in den Daten.
		expect(jaNein(null)).toBe(false);
	});
});

describe('ausFormular', () => {
	it('setzt eine leere Auswahl der Übergeordneten auf null, nicht auf ""', () => {
		// Eine leere Zeichenkette als Fremdschlüssel führte zu einem Datenbankfehler
		// statt zu «eigenständige Gemeinschaft».
		const e = ausFormular(
			formular({ name: 'Musterweg', quotaDenominator: '1000', parentStwegId: '' })
		);
		expect(e.parentStwegId).toBeNull();
	});

	it('lässt leere Adressfelder weg statt sie als Leerzeichenkette zu führen', () => {
		const e = ausFormular(formular({ name: 'Musterweg', quotaDenominator: '1000', ort: '  ' }));
		expect(e.ort).toBeUndefined();
	});

	it('setzt keine Zählweise, wenn keine gewählt wurde', () => {
		// Eine Voreinstellung wäre hier in beide Richtungen falsch: Rechtlich gilt
		// eine Stimme je Eigentümer, in den meisten Reglementen steht die Zählung je
		// Einheit. Wer nicht wählt, hat nicht ins Reglement gesehen — und das fiele
		// sonst erst auf, wenn ein Beschluss angefochten wird.
		const e = ausFormular(formular({ name: 'Musterweg', quotaDenominator: '1000' }));
		expect(e.headCountMode).toBe('');
	});

	it('führt die Fundstelle im Reglement mit', () => {
		const e = ausFormular(
			formular({
				name: 'Musterweg',
				quotaDenominator: '1000',
				headCountMode: 'per_unit',
				headCountRuleSource: 'Reglement Ziff. 14.2'
			})
		);
		expect(e.headCountRuleSource).toBe('Reglement Ziff. 14.2');
	});
});
