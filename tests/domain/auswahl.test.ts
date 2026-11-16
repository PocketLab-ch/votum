import { describe, expect, it } from 'vitest';
import { passtZurAuswahlsuche, type Auswahleintrag } from '$lib/auswahl';

const eintrag: Auswahleintrag = {
	wert: '1',
	gruppe: 'STWEG Sonnenhof',
	text: 'Whg 2 · zugeordnet an Anna Muster'
};

describe('Suche in gruppierten Auswahlfeldern', () => {
	it('findet die Beschriftung eines Eintrags ohne Beachtung der Grossschreibung', () => {
		expect(passtZurAuswahlsuche(eintrag, 'WHG 2')).toBe(true);
	});

	it('findet den sichtbaren Gruppentitel', () => {
		expect(passtZurAuswahlsuche(eintrag, 'sonnenhof')).toBe(true);
	});

	it('verlangt alle Suchwörter, auch wenn sie in Gruppe und Eintrag verteilt sind', () => {
		expect(passtZurAuswahlsuche(eintrag, 'Sonnenhof Anna')).toBe(true);
		expect(passtZurAuswahlsuche(eintrag, 'Sonnenhof Beat')).toBe(false);
	});

	it('gibt bei leerer Suche jeden Eintrag zurück', () => {
		expect(passtZurAuswahlsuche(eintrag, '   ')).toBe(true);
	});
});

describe('Was ausserdem gefunden wird', () => {
	/*
	 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, dritter der schweren
	 * Befunde der Bewirtschaftersicht): Beim Hinterlegen einer Abweichung stehen
	 * Geschäftsarten zur Wahl, gesucht wird aber nach dem Fall. «Erneuerungsfonds»,
	 * «Beitrag», «Budget», «Fonds» antworteten alle mit «Kein Eintrag passt zur
	 * Suche», obwohl es den Fall gibt.
	 */
	const jahresgeschaefte: Auswahleintrag = {
		wert: 'jahresgeschaefte',
		text: 'Jahresgeschäfte',
		// Die Titel wörtlich aus `quorum-2026-07-30.ts`: Der Befund nennt vier
		// Suchbegriffe, und «Budget» steckt nur im vollständigen Titel.
		auchSuchen:
			'Erneuerungsfonds schaffen oder Beiträge festsetzen ' +
			'Jahresrechnung, Budget oder Kostenverteilung genehmigen'
	};

	it('findet die Geschäftsart über den Fall, der in ihr steckt', () => {
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'Erneuerungsfonds')).toBe(true);
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'beiträge')).toBe(true);
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'Budget')).toBe(true);
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'Fonds')).toBe(true);
	});

	it('findet sie weiterhin über ihren eigenen Namen', () => {
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'Jahresgeschäfte')).toBe(true);
	});

	it('findet nichts, was weder im Namen noch in den Fällen steht', () => {
		expect(passtZurAuswahlsuche(jahresgeschaefte, 'Dachsanierung')).toBe(false);
	});

	it('kommt ohne den Zusatz aus', () => {
		// Jeder andere Aufrufer im Haus setzt ihn nicht; die Suche muss dort
		// bleiben, wie sie war.
		expect(passtZurAuswahlsuche({ wert: 'a', text: 'Anna' }, 'anna')).toBe(true);
		expect(passtZurAuswahlsuche({ wert: 'a', text: 'Anna' }, 'beat')).toBe(false);
	});
});
