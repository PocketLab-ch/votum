import { describe, expect, it } from 'vitest';
import { konfliktsatz, veralteteFelder } from '$lib/domain/schreibstand';
import { standAus } from '$lib/server/formular';

/**
 * Die Regel hinter «zwei Fenster, ein Feld».
 *
 * Sie ist reine Rechnung und wird deshalb hier geprüft und nicht an der
 * Datenbank — dort steht nur noch, dass der Schreibweg sie auch anruft
 * (`tests/db/versammlung.test.ts`).
 */
describe('veralteteFelder', () => {
	const gespeichert = { vorsitz: 'Rita Berger' };

	it('meldet nichts, wenn kein Stand mitgeschickt wurde', () => {
		// Der Weg ohne JavaScript und der Knopf «meinen Text durchsetzen».
		expect(veralteteFelder(gespeichert, undefined, { vorsitz: 'Peter Muster' })).toEqual([]);
		expect(veralteteFelder(gespeichert, {}, { vorsitz: 'Peter Muster' })).toEqual([]);
	});

	it('meldet nichts, wenn der Absender den geltenden Stand kannte', () => {
		expect(
			veralteteFelder(gespeichert, { vorsitz: 'Rita Berger' }, { vorsitz: 'Peter Muster' })
		).toEqual([]);
	});

	it('meldet das Feld, wenn dort inzwischen etwas anderes steht', () => {
		expect(
			veralteteFelder(gespeichert, { vorsitz: 'Alter Stand' }, { vorsitz: 'Peter Muster' })
		).toEqual(['vorsitz']);
	});

	it('meldet nichts, wenn dort schon das Neue steht', () => {
		/*
		 * Der Fall, ohne den ein doppelter Klick einen Konflikt mit sich selbst
		 * meldete: Beim zweiten Abschicken ist der eigene Wert längst gespeichert,
		 * und der mitgeschickte Stand ist der von davor.
		 */
		expect(
			veralteteFelder(gespeichert, { vorsitz: 'Alter Stand' }, { vorsitz: 'Rita Berger' })
		).toEqual([]);
	});

	it('hält leeres Feld und fehlendes Feld auseinander', () => {
		// Leer mitgeschickt heisst «dort stand nichts» — und das ist prüfbar.
		expect(veralteteFelder(gespeichert, { vorsitz: '' }, { vorsitz: 'Neu' })).toEqual(['vorsitz']);
		// Gar nicht mitgeschickt heisst «nicht prüfen».
		expect(veralteteFelder(gespeichert, { andere: 'x' }, { vorsitz: 'Neu' })).toEqual([]);
	});

	it('behandelt NULL und Leerzeichen als dasselbe', () => {
		expect(veralteteFelder({ vorsitz: null }, { vorsitz: '  ' }, { vorsitz: 'Neu' })).toEqual([]);
	});

	it('prüft jedes Feld für sich', () => {
		const zwei = { vorsitz: 'Rita Berger', schrift: 'Notariat Muster' };
		expect(
			veralteteFelder(zwei, { vorsitz: 'Rita Berger', schrift: 'Alt' }, { vorsitz: 'A', schrift: 'B' })
		).toEqual(['schrift']);
	});
});

describe('konfliktsatz', () => {
	const benennung = { vorsitz: 'der Vorsitz', schrift: 'die Protokollführung' };

	it('nennt, was jetzt dort steht', () => {
		const satz = konfliktsatz(['vorsitz'], { vorsitz: 'Peter Muster' }, benennung);
		expect(satz).toContain('der Vorsitz: «Peter Muster»');
		expect(satz).toContain('nochmals');
	});

	it('sagt es auch, wenn dort nichts mehr steht', () => {
		expect(konfliktsatz(['vorsitz'], { vorsitz: null }, benennung)).toContain(
			'der Vorsitz: nichts mehr'
		);
	});

	it('nennt beide Felder, wenn beide betroffen sind', () => {
		const satz = konfliktsatz(
			['vorsitz', 'schrift'],
			{ vorsitz: 'A', schrift: 'B' },
			benennung
		);
		expect(satz).toContain('Dort stehen jetzt');
		expect(satz).toContain('die Protokollführung: «B»');
	});
});

/*
 * **Der Weg, den es wirklich gibt** (26.08.2026, aus dem Review). Zwischen dem
 * Formular und der Regel steht `standAus()`. Verfehlt es einen Feldnamen, trägt
 * es den Schlüssel gar nicht ein, `veralteteFelder` prüft ihn still nicht mehr
 * — und der Schutz ist aus, ohne dass etwas rot wird. `formular.ts` bindet nur
 * Typen aus dem Kern ein, ist hier also gefahrlos prüfbar.
 */
describe('standAus', () => {
	const felder = ['sitzungsleitung', 'protokollfuehrung'];

	function formular(eintraege: Record<string, string>): FormData {
		const daten = new FormData();
		for (const [k, v] of Object.entries(eintraege)) daten.set(k, v);
		return daten;
	}

	it('liest die versteckten Felder und beschneidet Leerzeichen', () => {
		const stand = standAus(
			formular({ 'stand-sitzungsleitung': '  Rita Berger  ', 'stand-protokollfuehrung': 'N' }),
			felder
		);
		expect(stand).toEqual({ sitzungsleitung: 'Rita Berger', protokollfuehrung: 'N' });
	});

	it('hält ein leeres Feld von einem fehlenden auseinander', () => {
		const stand = standAus(formular({ 'stand-sitzungsleitung': '' }), felder);
		expect(stand.sitzungsleitung).toBe('');
		expect('protokollfuehrung' in stand).toBe(false);
	});

	it('führt zusammen mit der Regel zum Konflikt — und ohne Feld eben nicht', () => {
		const gespeichert = { sitzungsleitung: 'Rita Berger', protokollfuehrung: null };
		const neu = { sitzungsleitung: 'Peter Muster', protokollfuehrung: null };

		const mitFeld = standAus(formular({ 'stand-sitzungsleitung': '' }), felder);
		expect(veralteteFelder(gespeichert, mitFeld, neu)).toEqual(['sitzungsleitung']);

		const ohneFeld = standAus(formular({}), felder);
		expect(veralteteFelder(gespeichert, ohneFeld, neu)).toEqual([]);
	});
});
