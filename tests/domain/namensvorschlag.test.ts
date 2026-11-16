import { describe, expect, it } from 'vitest';
import { abstand, schlageVor, vereinheitliche } from '$lib/domain/namensvorschlag';

const PARTEIEN = [
	{ parteiId: 'p1', name: 'Hans Meier' },
	{ parteiId: 'p2', name: 'Renate Berger-Stucki' },
	{ parteiId: 'p3', name: 'Erbengemeinschaft Kunz' },
	{ parteiId: 'p4', name: 'Markus Probère' },
	{ parteiId: 'p5', name: 'Anna Ott' }
];

describe('vereinheitliche', () => {
	it('macht aus Umlauten und Accents dieselbe Form', () => {
		expect(vereinheitliche('Probère')).toBe('probere');
		expect(vereinheitliche('Müller')).toBe('mueller');
		expect(vereinheitliche('Berger-Stucki')).toBe('berger stucki');
	});
});

describe('abstand', () => {
	it('zählt die Abweichungen', () => {
		expect(abstand('meier', 'meier')).toBe(0);
		expect(abstand('meier', 'maier')).toBe(1);
		expect(abstand('meier', 'mayer')).toBe(2);
	});

	it('hört über dem Deckel auf zu rechnen', () => {
		// Nicht die echte Zahl, sondern «mehr als der Deckel» — mehr braucht
		// niemand zu wissen, und die Rechnung darf früh abbrechen.
		expect(abstand('meier', 'donnerstag')).toBeGreaterThan(3);
	});
});

describe('schlageVor', () => {
	it('findet den gleichen Namen', () => {
		const v = schlageVor('Hans Meier', PARTEIEN);
		expect(v[0]).toMatchObject({ parteiId: 'p1', art: 'gleich', grund: 'Name stimmt' });
	});

	it('findet ihn auch umgestellt', () => {
		// Am Telefon tippt man «Meier Hans», in den Stammdaten steht «Hans Meier».
		const v = schlageVor('Meier Hans', PARTEIEN);
		expect(v[0]).toMatchObject({ parteiId: 'p1', art: 'umgestellt' });
	});

	it('findet ihn über einen Teil', () => {
		const v = schlageVor('Meier', PARTEIEN);
		expect(v[0]).toMatchObject({ parteiId: 'p1', art: 'teil' });
	});

	it('verzeiht einen Tippfehler und sagt es', () => {
		const v = schlageVor('Hans Maier', PARTEIEN);
		expect(v[0].parteiId).toBe('p1');
		expect(v[0].grund).toContain('einem Zeichen');
	});

	it('verzeiht die Umlautschreibung', () => {
		expect(schlageVor('Markus Probere', PARTEIEN)[0]?.parteiId).toBe('p4');
	});

	it('erfindet nichts, wo nichts passt', () => {
		expect(schlageVor('Zorro von Zürich', PARTEIEN)).toEqual([]);
	});

	it('ist bei kurzen Namen streng', () => {
		/*
		 * «Ott» und «Ort» unterscheiden sich in einem Zeichen — aber bei drei
		 * Buchstaben ist das kein Tippfehler, sondern ein anderer Name. Wer hier
		 * grosszügig ist, schlägt am Eingang den falschen Nachbarn vor, und im
		 * Gedränge wird der bestätigt.
		 */
		expect(schlageVor('Anna Orr', PARTEIEN).map((v) => v.parteiId)).not.toContain('p5');
	});

	it('nennt höchstens drei — wer vier liest, sucht wieder selbst', () => {
		const viele = Array.from({ length: 6 }, (_, i) => ({
			parteiId: `x${i}`,
			name: `Meier Beispiel ${i}`
		}));
		expect(schlageVor('Meier Beispiel', viele).length).toBeLessThanOrEqual(3);
	});

	it('gibt nichts zurück, solange kaum etwas dasteht', () => {
		// Ein einzelner Buchstabe passt auf zu vieles; ein Vorschlag daraus wäre
		// geraten, nicht gefunden.
		expect(schlageVor('M', PARTEIEN)).toEqual([]);
	});
});
