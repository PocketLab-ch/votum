import { describe, expect, it } from 'vitest';
import {
	ANTRAGSTELLERARTEN,
	antragstellerbedarf,
	antragstellerInWorten,
	pruefeTraktandum
} from '../../src/lib/domain/traktanden';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import type { TraktandumEingabe } from '../../src/lib/domain/traktanden';

function eingabe(u: Partial<TraktandumEingabe> = {}): TraktandumEingabe {
	return {
		meetingId: 'v-1',
		titel: 'Ersatz der Gartenbank',
		art: 'abstimmung',
		antragswortlaut: 'Die morsche Gartenbank wird ersetzt.',
		antragstellerart: 'gemeinschaft',
		...u
	};
}

function kennung(u: Partial<TraktandumEingabe>): string | null {
	try {
		pruefeTraktandum(eingabe(u));
		return null;
	} catch (f) {
		if (f instanceof FachlicherFehler) return f.kennung;
		throw f;
	}
}

describe('Wer den Antrag stellt', () => {
	it('kennt die acht Arten', () => {
		expect(ANTRAGSTELLERARTEN.map((a) => a.art)).toEqual([
			'bewirtschaftung',
			'gemeinschaft',
			'untergemeinschaft',
			'eigentuemer',
			'mehrere_eigentuemer',
			'ausschuss',
			'revision',
			'frei'
		]);
	});

	it('lässt Bewirtschaftung und Gemeinschaft ohne Zusatz durch', () => {
		expect(kennung({ antragstellerart: 'bewirtschaftung' })).toBeNull();
		expect(kennung({ antragstellerart: 'gemeinschaft' })).toBeNull();
	});

	it('verlangt beim einzelnen Eigentümer, welcher', () => {
		expect(kennung({ antragstellerart: 'eigentuemer' })).toBe('antragsteller_unbestimmt');
		expect(kennung({ antragstellerart: 'eigentuemer', antragstellerId: 'p-1' })).toBeNull();
	});
});

/**
 * Der Ausschuss, die Revisionsstelle, mehrere Eigentümer und der Freitext —
 * gemeldet am 01.08.2026 als das, was in der Wirklichkeit einer Versammlung
 * fehlte.
 */
describe('Die vier neuen Arten', () => {
	it('verlangt bei «mehrere Eigentümer» mindestens zwei', () => {
		expect(kennung({ antragstellerart: 'mehrere_eigentuemer' })).toBe('antragsteller_unbestimmt');
		expect(kennung({ antragstellerart: 'mehrere_eigentuemer', antragstellerIds: ['p-1'] })).toBe(
			'antragsteller_unbestimmt'
		);
		expect(
			kennung({ antragstellerart: 'mehrere_eigentuemer', antragstellerIds: ['p-1', 'p-2'] })
		).toBeNull();
	});

	/** Zweimal derselbe ist einer — sonst genügte ein doppelter Klick. */
	it('zählt denselben Eigentümer nicht doppelt', () => {
		expect(
			kennung({ antragstellerart: 'mehrere_eigentuemer', antragstellerIds: ['p-1', 'p-1'] })
		).toBe('antragsteller_unbestimmt');
	});

	it('lässt Ausschuss und Revisionsstelle ohne Namen zu', () => {
		expect(kennung({ antragstellerart: 'ausschuss' })).toBeNull();
		expect(kennung({ antragstellerart: 'revision' })).toBeNull();
	});

	it('verlangt bei «Andere» eine Bezeichnung', () => {
		expect(kennung({ antragstellerart: 'frei' })).toBe('antragsteller_unbestimmt');
		expect(kennung({ antragstellerart: 'frei', antragstellerName: '  ' })).toBe(
			'antragsteller_unbestimmt'
		);
		expect(
			kennung({ antragstellerart: 'frei', antragstellerName: 'Arbeitsgruppe Umgebung' })
		).toBeNull();
	});

	/** Ein Name an einer Art, die keinen kennt, wäre eine Angabe ohne Ort. */
	it('verwirft einen Namen, wo die Art keinen vorsieht', () => {
		const g = pruefeTraktandum(
			eingabe({ antragstellerart: 'gemeinschaft', antragstellerName: 'irgendwas' })
		);
		expect(g.antragstellerName).toBeUndefined();
	});

	it('führt die Kennungen nur bei «mehrere Eigentümer» mit', () => {
		const einer = pruefeTraktandum(
			eingabe({ antragstellerart: 'eigentuemer', antragstellerId: 'p-1', antragstellerIds: ['p-9'] })
		);
		expect(einer.antragstellerIds).toEqual([]);
	});
});

describe('In Worten', () => {
	it('nennt die Art, wo sie genügt', () => {
		expect(antragstellerInWorten('bewirtschaftung')).toBe('Die Bewirtschaftung');
	});

	it('hängt den Namen an, wo einer da ist', () => {
		expect(antragstellerInWorten('revision', 'Meier AG')).toBe('Die Revisionsstelle: Meier AG');
		expect(antragstellerInWorten('ausschuss')).toBe('Der Ausschuss');
	});

	/** Bei «Andere» ist der Freitext die ganze Angabe, nicht ein Zusatz dazu. */
	it('setzt bei «Andere» den Freitext an die Stelle der Art', () => {
		expect(antragstellerInWorten('frei', 'Arbeitsgruppe Umgebung')).toBe('Arbeitsgruppe Umgebung');
	});

	it('zählt die gemeinsam Antragstellenden auf', () => {
		expect(antragstellerInWorten('mehrere_eigentuemer', null, ['Berger', 'Kunz'])).toBe(
			'Mehrere Eigentümer: Berger, Kunz'
		);
	});

	it('fällt ohne Namen auf die Art zurück', () => {
		expect(antragstellerInWorten('mehrere_eigentuemer')).toBe('Mehrere Eigentümer gemeinsam');
	});
});

describe('Der Bedarf je Art', () => {
	it('sagt, was die Art noch braucht', () => {
		expect(antragstellerbedarf('gemeinschaft')).toBe('keine');
		expect(antragstellerbedarf('eigentuemer')).toBe('eine');
		expect(antragstellerbedarf('mehrere_eigentuemer')).toBe('mehrere');
		expect(antragstellerbedarf('ausschuss')).toBe('nameFrei');
		expect(antragstellerbedarf('frei')).toBe('name');
	});
});
