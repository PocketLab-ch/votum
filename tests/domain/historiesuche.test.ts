import { describe, expect, it } from 'vitest';
import {
	auszugMit,
	beschluesseInWorten,
	fundstellen,
	KUERZESTER_SUCHBEGRIFF,
	suchbegriffBrauchbar,
	suchhinweis,
	vergleichsform,
	versammlungInWorten,
	versammlungsartInWorten,
	type Versammlungszeile
} from '../../src/lib/domain/historiesuche';

function zeile(u: Partial<Versammlungszeile> = {}): Versammlungszeile {
	return {
		id: 'v-1',
		datum: '2026-09-15',
		art: 'ordentlich',
		stufe: 'erste',
		zustand: 'geschlossen',
		ort: 'Saal',
		anzahlTraktanden: 8,
		anzahlAbstimmungen: 5,
		anzahlBeschluesse: null,
		...u
	};
}

describe('Vergleichsform', () => {
	it('ignoriert Gross- und Kleinschreibung', () => {
		expect(vergleichsform('FASSADE')).toBe(vergleichsform('fassade'));
	});

	it('ignoriert Akzente und Häkchen', () => {
		// Wer «Petrovic» tippt, weil er das Häkchen nicht auf der Tastatur hat,
		// soll «Petrović» finden — sonst führt die Suche gerade bei den Namen ins
		// Leere, bei denen sie am nötigsten wäre.
		expect(vergleichsform('Petrović')).toBe(vergleichsform('Petrovic'));
		expect(vergleichsform('Zürich')).toBe(vergleichsform('Zurich'));
		expect(vergleichsform('Vodňanský')).toBe(vergleichsform('Vodnansky'));
	});
});

describe('Auszug mit Umgebung', () => {
	const text =
		'Die Versammlung beschliesst, die Fassade des Hauses gemäss der Offerte der Meier AG zu sanieren.';

	it('findet die Stelle und zeigt Umgebung', () => {
		const a = auszugMit(text, 'Fassade');
		expect(a).toMatch(/Fassade/);
		expect(a).toMatch(/beschliesst/);
	});

	it('kürzt mit Auslassungszeichen, wo abgeschnitten wird', () => {
		const lang = 'x '.repeat(200) + 'Fassade' + ' y'.repeat(200);
		const a = auszugMit(lang, 'Fassade') as string;
		expect(a.startsWith('…')).toBe(true);
		expect(a.endsWith('…')).toBe(true);
	});

	it('beginnt und endet auf ganzen Wörtern', () => {
		// Ein Auszug, der «…ss der Offerte der Mei…» zeigt, ist schlechter zu
		// lesen als einer, der ein paar Zeichen mehr nimmt.
		const woerter = new Set(text.split(/\s+/).map((w) => w.replace(/[.,;:]$/, '')));
		for (const umgebung of [5, 10, 25, 60]) {
			const a = (auszugMit(text, 'Offerte', umgebung) as string)
				.replace(/^…\s*/, '')
				.replace(/\s*…$/, '')
				.split(/\s+/);
			expect(woerter.has(a[0].replace(/[.,;:]$/, '')), `Anfang bei ${umgebung}: ${a[0]}`).toBe(true);
			expect(
				woerter.has(a[a.length - 1].replace(/[.,;:]$/, '')),
				`Ende bei ${umgebung}: ${a[a.length - 1]}`
			).toBe(true);
		}
	});

	it('findet ohne Rücksicht auf Schreibweise und Akzente', () => {
		expect(auszugMit('Zufahrt Grundstück Petrović', 'petrovic')).toMatch(/Petrović/);
	});

	it('gibt null zurück, wo nichts steht', () => {
		expect(auszugMit(text, 'Aufzug')).toBeNull();
		expect(auszugMit('', 'x')).toBeNull();
		expect(auszugMit(text, '')).toBeNull();
	});
});

describe('Fundstellen', () => {
	const t = {
		titel: 'Sanierung der Fassade',
		kurzfassung: 'Die Fassade wird erneuert.',
		inhalt: 'Ausführliche Beschreibung der Arbeiten an der Fassade.',
		antragswortlaut: 'Die Fassade wird saniert.'
	};

	it('findet alle Felder, in denen der Begriff steht', () => {
		expect(fundstellen(t, 'Fassade').map((f) => f.feld).sort()).toEqual([
			'antragswortlaut',
			'inhalt',
			'kurzfassung',
			'titel'
		]);
	});

	it('setzt Titel und Antragswortlaut nach vorn', () => {
		// Wer nach «Fassade» sucht und ein Traktandum findet, das so heisst, ist am
		// Ziel. Ein Treffer tief im Inhalt kann eine Nebenbemerkung sein.
		const f = fundstellen(t, 'Fassade');
		expect(f[0].feld).toBe('titel');
		expect(f[1].feld).toBe('antragswortlaut');
	});

	it('lässt leere Felder aus', () => {
		expect(
			fundstellen({ titel: 'Fassade', kurzfassung: null, inhalt: null }, 'Fassade')
		).toHaveLength(1);
	});

	it('gibt nichts zurück, wo der Begriff nirgends steht', () => {
		expect(fundstellen(t, 'Aufzug')).toEqual([]);
	});

	it('beschriftet jedes Feld lesbar', () => {
		for (const f of fundstellen(t, 'Fassade')) {
			expect(f.beschriftung).not.toBe(f.feld);
			expect(f.beschriftung.length).toBeGreaterThan(3);
		}
	});
});

describe('Brauchbarkeit des Suchbegriffs', () => {
	it('verlangt eine Mindestlänge', () => {
		// Kürzere fänden fast jedes Traktandum — dasselbe wie nichts zu finden.
		expect(suchbegriffBrauchbar('ab')).toBe(false);
		expect(suchbegriffBrauchbar('abc')).toBe(true);
		expect(KUERZESTER_SUCHBEGRIFF).toBe(3);
	});

	it('erklärt, warum', () => {
		expect(suchhinweis('ab')).toMatch(/mindestens 3 Zeichen/);
	});

	it('schweigt bei leerem Feld', () => {
		expect(suchhinweis('')).toBeNull();
		expect(suchhinweis('   ')).toBeNull();
	});
});

describe('Kennzahlen in Worten', () => {
	it('beschreibt eine ordentliche Versammlung', () => {
		expect(versammlungInWorten(zeile())).toBe(
			'Ordentliche Versammlung, 8 Traktanden, davon 5 Abstimmungen'
		);
	});

	it('nennt Art und Stufe ohne Komma dazwischen', () => {
		expect(versammlungsartInWorten('ordentlich', 'erste')).toBe('Ordentliche Versammlung');
		expect(versammlungsartInWorten('ausserordentlich', 'zweite')).toBe(
			'Ausserordentliche Zweitversammlung'
		);
	});

	it('beschreibt eine Zweitversammlung', () => {
		expect(versammlungInWorten(zeile({ stufe: 'zweite' }))).toMatch(/Zweitversammlung/);
	});

	it('lässt die Abstimmungen weg, wo es keine gibt', () => {
		expect(versammlungInWorten(zeile({ anzahlAbstimmungen: 0 }))).not.toMatch(/Abstimmung/);
	});

	it('setzt den Singular richtig', () => {
		expect(
			versammlungInWorten(zeile({ anzahlTraktanden: 1, anzahlAbstimmungen: 1 }))
		).toMatch(/1 Traktandum, davon 1 Abstimmung$/);
	});

	it('unterscheidet «noch nicht geführt» von «keine»', () => {
		// Derselbe Unterschied wie zwischen «keine Reglementsabweichung» und «noch
		// nie nachgesehen»: In einer Liste sehen beide gleich aus.
		expect(beschluesseInWorten(null)).toMatch(/ab der Auszählung/);
		expect(beschluesseInWorten(0)).toBe('Kein Beschluss gefasst.');
		expect(beschluesseInWorten(1)).toBe('1 Beschluss');
		expect(beschluesseInWorten(3)).toBe('3 Beschlüsse');
	});
});
