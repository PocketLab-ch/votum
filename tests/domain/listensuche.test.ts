/**
 * Die gemeinsame Listensuche.
 *
 * Sie liegt allen Suchfeldern der Oberfläche zugrunde. Geprüft wird deshalb
 * nicht nur, dass sie findet, sondern auch **wie sie verbindet** — eine Suche,
 * die zwei Wörter als «oder» versteht, liefert bei jedem weiteren Buchstaben
 * mehr Treffer statt weniger.
 */
import { describe, expect, it } from 'vitest';
import {
	begrenzt,
	brauchtSuchfeld,
	filtereMitVorfahren,
	filtereNach,
	punktdatum,
	SUCHSCHWELLE,
	suchwoerter,
	trifft
} from '$lib/domain/listensuche';

describe('Suchwörter', () => {
	it('zerlegt an Leerraum und wirft Leeres weg', () => {
		expect(suchwoerter('  Renate   Berger ')).toEqual(['renate', 'berger']);
		expect(suchwoerter('   ')).toEqual([]);
	});

	it('vereinheitlicht Grossschreibung und Akzente', () => {
		// Wer «Petrovic» tippt, weil das Häkchen nicht auf der Tastatur liegt,
		// soll «Petrović» finden — sonst versagt die Suche gerade bei den Namen,
		// bei denen sie am nötigsten ist.
		expect(trifft('Petrović', suchwoerter('petrovic'))).toBe(true);
		expect(trifft('Nirgendweg', suchwoerter('NIRGEND'))).toBe(true);
	});
});

describe('Treffen', () => {
	it('verlangt alle Wörter', () => {
		expect(trifft('Renate Berger, Nirgendweg 5', suchwoerter('berger nirgendweg'))).toBe(true);
		expect(trifft('Renate Berger, Nirgendweg 5', suchwoerter('berger rosenweg'))).toBe(false);
	});

	it('trifft ohne Suchwörter alles', () => {
		expect(trifft('irgendwas', [])).toBe(true);
	});
});

describe('Filtern', () => {
	const bestand = [
		{ id: 1, name: 'Renate Berger' },
		{ id: 2, name: 'Peter Bucher' },
		{ id: 3, name: 'Anna Berger' }
	];

	it('gibt ohne Suche die Liste unverändert zurück — dieselbe Reihenfolge', () => {
		const aus = filtereNach(bestand, '', (p) => p.name);
		expect(aus.map((p) => p.id)).toEqual([1, 2, 3]);
	});

	it('behält die Reihenfolge auch beim Filtern', () => {
		// Die Ordnung ist anderswo begründet — nach Name, Datum, Rang. Eine Suche
		// ist kein Anlass, sie umzustellen.
		expect(filtereNach(bestand, 'berger', (p) => p.name).map((p) => p.id)).toEqual([1, 3]);
	});
});

describe('Filtern im Baum', () => {
	const baum = [
		{ id: 'meg', eltern: null, name: 'MEG Nirgendweg 3-13a' },
		{ id: 'h4', eltern: 'meg', name: 'Haus 4' },
		{ id: 'h6', eltern: 'meg', name: 'Haus 5/5a' },
		{ id: 'solo', eltern: null, name: 'Rosenweg 4' }
	];
	const filtere = (suche: string) =>
		filtereMitVorfahren(
			baum,
			suche,
			(g) => g.name,
			(g) => g.id,
			(g) => g.eltern
		).map((g) => g.id);

	it('behält den Vorfahren eines Treffers, auch wenn er selbst nicht passt', () => {
		// «Haus 5/5a» eingerückt unter nichts behauptete eine Zugehörigkeit,
		// deren Bezugspunkt die Suche gerade entfernt hat.
		expect(filtere('haus 5')).toEqual(['meg', 'h6']);
	});

	it('behält die Reihenfolge des Bestands', () => {
		expect(filtere('haus')).toEqual(['meg', 'h4', 'h6']);
	});

	it('zieht bei einem Treffer auf der Wurzel die Kinder nicht mit', () => {
		// Andersherum gilt es nicht: Kinder sind kein Kontext des Elternteils,
		// sondern eigene Einträge.
		expect(filtere('rosenweg')).toEqual(['solo']);
	});

	it('gibt ohne Suche alles zurück', () => {
		expect(filtere('')).toEqual(['meg', 'h4', 'h6', 'solo']);
	});
});

describe('Datum in der Schreibweise, nach der getippt wird', () => {
	it('macht aus der ISO-Form die Punktform', () => {
		expect(punktdatum('2026-09-11')).toBe('11.09.2026');
	});

	it('lässt Unlesbares stehen, statt eine Ausnahme zu werfen', () => {
		expect(punktdatum('unbekannt')).toBe('unbekannt');
	});
});

/**
 * Lange Listen kürzen, bis jemand sucht (23.08.2026, Prüflauf II, A-47 bis
 * A-49).
 *
 * Die Eigentümerliste war 7,8 Bildschirmhöhen lang, «Ackermann» stand
 * sechsundzwanzigmal untereinander. Suchfelder gab es überall — nur muss man
 * erst merken, dass man sie braucht.
 */
describe('begrenzt', () => {
	const zeilen = Array.from({ length: 40 }, (_, i) => `Zeile ${i + 1}`);

	it('lässt kurze Listen unangetastet', () => {
		const kurz = zeilen.slice(0, 25);
		expect(begrenzt(kurz, '', false)).toEqual({ zeigen: kurz, verborgen: 0 });
	});

	it('kürzt auf die Grenze und nennt die Zahl der Verborgenen', () => {
		const { zeigen, verborgen } = begrenzt(zeilen, '', false);
		expect(zeigen.length).toBe(25);
		expect(verborgen).toBe(15);
		expect(zeigen[0], 'von vorne, nicht von hinten').toBe('Zeile 1');
	});

	it('kürzt nicht, sobald gesucht wird', () => {
		// Wer sucht, hat schon eingegrenzt; ihm die Treffer zu beschneiden wäre
		// die zweite Hürde nach der ersten.
		expect(begrenzt(zeilen, 'Zeile', false).verborgen).toBe(0);
		expect(begrenzt(zeilen, '  ', false).verborgen, 'Leerzeichen sind kein Suchbegriff').toBe(15);
	});

	it('zeigt alles, wenn jemand es verlangt', () => {
		const { zeigen, verborgen } = begrenzt(zeilen, '', true);
		expect(zeigen.length).toBe(40);
		expect(verborgen).toBe(0);
	});

	it('nimmt eine eigene Grenze entgegen', () => {
		expect(begrenzt(zeilen, '', false, 5)).toEqual({
			zeigen: zeilen.slice(0, 5),
			verborgen: 35
		});
	});

	it('gibt eine Kopie zurück, keine Ansicht auf das Original', () => {
		// Sonst schriebe ein `sort()` in der Anzeige in die Quelle zurück.
		const kurz = ['a', 'b'];
		const { zeigen } = begrenzt(kurz, '', false);
		zeigen.push('c');
		expect(kurz.length).toBe(2);
	});
});

describe('brauchtSuchfeld', () => {
	it('schweigt bis acht und meldet sich ab neun', () => {
		expect(brauchtSuchfeld({ durchsuchbar: SUCHSCHWELLE, archiviert: 0 })).toBe(false);
		expect(brauchtSuchfeld({ durchsuchbar: SUCHSCHWELLE + 1, archiviert: 0 })).toBe(true);
	});

	/*
	 * Liegt alles im Archiv, ist der Bestand leer — und mit dem Suchfeld
	 * verschwände der Archivschalter daneben, also der einzige Weg zurück
	 * (25.08.2026, vierte Reviewrunde der Personenliste).
	 */
	it('zeigt das Feld, wenn alles im Archiv liegt', () => {
		expect(brauchtSuchfeld({ durchsuchbar: 0, archiviert: 3 })).toBe(true);
	});

	/*
	 * Die eigene Schwelle braucht `Suchauswahl.svelte`, dessen Aufrufer sie je
	 * Feld setzen können. Ohne den dritten Parameter stünde der Vergleich dort
	 * ein zweites Mal von Hand.
	 */
	it('nimmt eine eigene Schwelle entgegen', () => {
		expect(brauchtSuchfeld({ durchsuchbar: 4, archiviert: 0, schwelle: 3 })).toBe(true);
		expect(brauchtSuchfeld({ durchsuchbar: 3, archiviert: 0, schwelle: 3 })).toBe(false);
	});
});
