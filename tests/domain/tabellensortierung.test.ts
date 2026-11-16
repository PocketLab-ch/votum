/**
 * Sortieren einer Tabelle (Auftraggeber, 12.08.2026: «Tabellen jeweils mit Sortier und
 * Filtermöglichkeit»).
 */
import { describe, expect, it } from 'vitest';
import {
	ariaSortierung,
	naechsteSortierung,
	sortiere,
	sortierzeichen,
	vergleiche,
	type Sortierung
} from '$lib/domain/tabellensortierung';

describe('vergleiche', () => {
	it('vergleicht Zahlen numerisch', () => {
		// Als Text stünde 1000 vor 900 — und die Wertquotenspalte wäre unbrauchbar.
		expect(vergleiche(900, 1000)).toBeLessThan(0);
		expect(vergleiche(1000, 900)).toBeGreaterThan(0);
	});

	it('reiht Text mit natürlicher Zahlenfolge', () => {
		// «Wohnung 2» vor «Wohnung 10»: Eine Einheitenliste steht sonst falsch.
		expect(vergleiche('Wohnung 2', 'Wohnung 10')).toBeLessThan(0);
		expect(vergleiche('1.9 Estrich', '1.10 Estrich')).toBeLessThan(0);
	});

	it('ordnet Umlaute wie ihren Grundbuchstaben ein', () => {
		// «Ärgerlich» gehört zwischen «Anfang» und «Auto», nicht ans Ende.
		expect(vergleiche('Ärgerlich', 'Auto')).toBeLessThan(0);
		expect(vergleiche('Ärgerlich', 'Anfang')).toBeGreaterThan(0);
	});

	it('ignoriert Gross- und Kleinschreibung', () => {
		expect(vergleiche('berger', 'Berger')).toBe(0);
		expect(vergleiche('acker', 'Berger')).toBeLessThan(0);
	});

	it('stellt Leeres hinten an — in beiden Richtungen', () => {
		// Wer nach «E-Mail» sortiert, sucht die Zeilen **mit** Adresse.
		expect(vergleiche(null, 'a@example.org')).toBeGreaterThan(0);
		expect(vergleiche('a@example.org', null)).toBeLessThan(0);
		expect(vergleiche('', undefined)).toBe(0);
		expect(vergleiche('   ', 'x')).toBeGreaterThan(0);
	});

	it('vergleicht Wahrheitswerte', () => {
		expect(vergleiche(false, true)).toBeLessThan(0);
	});
});

describe('sortiere', () => {
	const zeilen = [
		{ name: 'Berger', quote: 900, mail: null },
		{ name: 'Ärgerlich', quote: 1000, mail: 'ae@example.org' },
		{ name: 'acker', quote: 50, mail: 'a@example.org' }
	];
	const wert = (z: (typeof zeilen)[number], s: string) => (z as Record<string, unknown>)[s];

	it('gibt ohne Sortierung die Reihenfolge unverändert zurück', () => {
		// Der Normalfall: Die Abfrage bestimmt die Reihenfolge, bis jemand klickt.
		expect(sortiere(zeilen, null, wert).map((z) => z.name)).toEqual([
			'Berger',
			'Ärgerlich',
			'acker'
		]);
	});

	it('sortiert aufsteigend nach Text', () => {
		const s: Sortierung = { spalte: 'name', richtung: 'auf' };
		expect(sortiere(zeilen, s, wert).map((z) => z.name)).toEqual(['acker', 'Ärgerlich', 'Berger']);
	});

	it('sortiert absteigend nach Zahl', () => {
		const s: Sortierung = { spalte: 'quote', richtung: 'ab' };
		expect(sortiere(zeilen, s, wert).map((z) => z.quote)).toEqual([1000, 900, 50]);
	});

	it('hält Leeres auch beim Umdrehen hinten', () => {
		// Sonst stünden beim zweiten Klick alle Zeilen ohne Adresse oben — und die
		// Spalte wäre in einer Richtung nutzlos.
		const auf = sortiere(zeilen, { spalte: 'mail', richtung: 'auf' }, wert);
		const ab = sortiere(zeilen, { spalte: 'mail', richtung: 'ab' }, wert);
		expect(auf.at(-1)!.mail).toBeNull();
		expect(ab.at(-1)!.mail).toBeNull();
	});

	it('lässt die Vorlage unberührt', () => {
		// `sort` an Ort und Stelle änderte die Reihenfolge auch dort, wo niemand
		// sortiert hat — bei Traktanden trägt sie eine eigene Bedeutung.
		const vorher = zeilen.map((z) => z.name);
		sortiere(zeilen, { spalte: 'name', richtung: 'auf' }, wert);
		expect(zeilen.map((z) => z.name)).toEqual(vorher);
	});
});

describe('naechsteSortierung', () => {
	it('sortiert beim ersten Klick aufsteigend', () => {
		expect(naechsteSortierung(null, 'name')).toEqual({ spalte: 'name', richtung: 'auf' });
	});

	it('dreht beim zweiten Klick um', () => {
		expect(naechsteSortierung({ spalte: 'name', richtung: 'auf' }, 'name')).toEqual({
			spalte: 'name',
			richtung: 'ab'
		});
	});

	it('hebt beim dritten Klick auf', () => {
		// Ohne den dritten Zustand gäbe es keinen Weg zurück zur ursprünglichen
		// Reihenfolge — und die trägt bei Traktanden eine eigene Bedeutung.
		expect(naechsteSortierung({ spalte: 'name', richtung: 'ab' }, 'name')).toBeNull();
	});

	it('beginnt bei einer anderen Spalte wieder aufsteigend', () => {
		expect(naechsteSortierung({ spalte: 'name', richtung: 'ab' }, 'quote')).toEqual({
			spalte: 'quote',
			richtung: 'auf'
		});
	});
});

describe('Was der Spaltenkopf ansagt', () => {
	it('nennt die Richtung für die Sprachausgabe', () => {
		// Ohne `aria-sort` ist eine sortierte Tabelle für eine Vorlesehilfe nicht
		// von einer unsortierten zu unterscheiden.
		expect(ariaSortierung({ spalte: 'name', richtung: 'auf' }, 'name')).toBe('ascending');
		expect(ariaSortierung({ spalte: 'name', richtung: 'ab' }, 'name')).toBe('descending');
		expect(ariaSortierung({ spalte: 'name', richtung: 'ab' }, 'quote')).toBe('none');
		expect(ariaSortierung(null, 'name')).toBe('none');
	});

	it('zeigt an der sortierten Spalte den Pfeil, sonst das Angebot', () => {
		expect(sortierzeichen({ spalte: 'name', richtung: 'auf' }, 'name')).toBe('▲');
		expect(sortierzeichen({ spalte: 'name', richtung: 'ab' }, 'name')).toBe('▼');
		expect(sortierzeichen(null, 'name')).toBe('⇅');
	});
});


/*
 * **Zeitpunkte** (25.08.2026). Der Treiber liefert `timestamptz` als `Date`, und
 * ohne eigenen Zweig fielen sie in den Textvergleich: `String(new Date(…))`
 * beginnt mit dem Wochentag. Auf der Betreiberseite kamen vier versiegelte
 * Pakete «aufsteigend» als 04.12., 05.01., 14.03., 25.08. heraus — Fri, Mon,
 * Sat, Tue in alphabetischer Folge.
 */
describe('Zeitpunkte', () => {
	it('vergleicht nach der Zeit, nicht nach dem Wochentagsnamen', () => {
		const frueh = new Date('2026-01-05T00:00:00Z');
		const spaet = new Date('2026-12-04T00:00:00Z');
		expect(vergleiche(frueh, spaet)).toBeLessThan(0);
		expect(vergleiche(spaet, frueh)).toBeGreaterThan(0);
		expect(vergleiche(frueh, new Date(frueh))).toBe(0);
	});

	it('sortiert eine Liste von Zeitpunkten richtig', () => {
		const tage = ['2026-08-25', '2026-12-04', '2026-01-05', '2026-03-14'].map(
			(t) => new Date(`${t}T00:00:00Z`)
		);
		const geordnet = sortiere(tage, { spalte: 'wann', richtung: 'auf' }, (d) => d);
		expect(geordnet.map((d) => d.toISOString().slice(0, 10))).toEqual([
			'2026-01-05',
			'2026-03-14',
			'2026-08-25',
			'2026-12-04'
		]);
	});
});
