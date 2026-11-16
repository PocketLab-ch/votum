/**
 * Die Empfehlung an die bevollmächtigte Person (Welle 2, Zusatzblock).
 *
 * Der Prüfstand kreist um **eine** Frage: Wann gilt eine Weisung nicht mehr?
 * Alles andere daran ist Anzeige.
 */
import { describe, expect, it } from 'vitest';
import {
	empfehlungInWorten,
	empfehlungsstand,
	istEmpfehlungswahl,
	offeneWeisungen,
	weisungsstand,
	type Weisungsposten
} from '$lib/domain/empfehlung';

const WORTLAUT = 'Die Fassade wird für 240 000 Franken saniert.';

describe('Eine Empfehlung zum unveränderten Antrag', () => {
	it('gilt und nennt die vertretene Person', () => {
		const s = empfehlungsstand('ja', WORTLAUT, WORTLAUT, 'Aebi');
		expect(s.gilt).toBe(true);
		expect(s.satz).toBe('Aebi empfiehlt: Ja');
	});

	it('übersteht anderen Leerraum — eine Formatierung ist keine Änderung', () => {
		// Sonst nähme ein verrutschter Zeilenumbruch den Leuten ihre Weisung, und
		// sie verstünden es zu Recht nicht.
		const s = empfehlungsstand('nein', WORTLAUT, `  Die Fassade wird für\n240 000 Franken saniert. `, 'Bucher');
		expect(s.gilt).toBe(true);
		expect(s.satz).toBe('Bucher empfiehlt: Nein');
	});
});

describe('Eine Empfehlung zu einem geänderten Antrag', () => {
	it('fällt weg und sagt warum', () => {
		// Der Fall, um den es geht: Folgeantrag, Rückkommen, eine Präzisierung
		// während der Sitzung. Wer nach einer überholten Weisung abstimmt, stimmt
		// gegen den Willen, den er zu vertreten meint.
		const s = empfehlungsstand('ja', WORTLAUT, 'Die Fassade wird für 320 000 Franken saniert.', 'Aebi');
		expect(s.gilt).toBe(false);
		expect(s.satz).toMatch(/anderen Wortlaut/);
		expect(s.satz).toMatch(/entscheiden Sie selbst/);
		// Die ursprüngliche Weisung steht trotzdem im Satz — verschwiegen wird
		// nichts, sie wirkt bloss nicht mehr.
		expect(s.satz).toMatch(/Ja/);
	});

	it('fällt auch bei einem eingefügten Halbsatz weg', () => {
		const s = empfehlungsstand(
			'nein',
			WORTLAUT,
			'Die Fassade wird für 240 000 Franken saniert, sofern die Offerte bis Juni vorliegt.',
			'Christen'
		);
		expect(s.gilt).toBe(false);
	});
});

describe('Die Liste beim Erteilen', () => {
	const posten: Weisungsposten[] = [
		{ traktandumId: 't1', nummer: '4', titel: 'Fassade', wortlaut: WORTLAUT, wahl: 'ja' },
		{ traktandumId: 't2', nummer: '5', titel: 'Budget', wortlaut: 'Das Budget wird genehmigt.', wahl: null },
		{ traktandumId: 't3', nummer: '6', titel: 'Reglement', wortlaut: 'Art. 12 wird geändert.', wahl: null }
	];

	it('zählt, was offen ist', () => {
		expect(offeneWeisungen(posten)).toBe(2);
	});

	it('verlangt keine Vollständigkeit', () => {
		// Wer zu einem von drei Anträgen etwas zu sagen hat, sagt es zu einem.
		// Ein Zwang zur Vollständigkeit wäre der sichere Weg zu Weisungen, die
		// niemand gemeint hat.
		expect(weisungsstand(posten)).toMatch(/1 von 3/);
		expect(weisungsstand(posten)).toMatch(/entscheidet Ihre bevollmächtigte Person frei/);
	});

	it('sagt es, wenn gar keine erteilt ist', () => {
		const ohne = posten.map((p) => ({ ...p, wahl: null }));
		expect(weisungsstand(ohne)).toMatch(/Noch keine Weisung/);
	});

	it('sagt es, wenn es nichts zu weisen gibt', () => {
		expect(weisungsstand([])).toMatch(/kein Antrag zur Abstimmung/);
	});
});

describe('Die Wahl', () => {
	it('kennt genau drei Werte', () => {
		expect(istEmpfehlungswahl('ja')).toBe(true);
		expect(istEmpfehlungswahl('nein')).toBe(true);
		expect(istEmpfehlungswahl('enthaltung')).toBe(true);
		// Kein «frei»: Keine Weisung ist die Abwesenheit einer Zeile, nicht ein
		// vierter Wert. Sonst gäbe es zwei Arten, dasselbe zu sagen.
		expect(istEmpfehlungswahl('frei')).toBe(false);
		expect(istEmpfehlungswahl(null)).toBe(false);
	});

	it('schreibt sich aus', () => {
		expect(empfehlungInWorten('enthaltung')).toBe('Enthaltung');
	});
});
