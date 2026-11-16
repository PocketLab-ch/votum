import { describe, expect, it } from 'vitest';
import { abendfeststellungssatz, type Hausbefund } from '$lib/domain/beschlussfaehigkeit';

/**
 * Der Satz, den die Sitzungsleitung nach dem Feststellen liest.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «wenn man die Beschlussfähigkeit
 * feststellt, sollte dies dann auf dem Bildschirm auch angezeigt werden. Also
 * welche Gemeinschaft ist beschlussfähig und welche nicht.» Vorher stand dort
 * «festgehalten in 5 Gemeinschaften» — richtig und ohne Auskunft.
 */
function haus(name: string, ja: boolean, fehlt: string | null = null): Hausbefund {
	return {
		gemeinschaft: name,
		beschlussfaehig: ja,
		kopfstimmen: ja ? '12 von 15' : '4 von 15',
		wertquoten: ja ? '620 von 1000' : '210 von 1000',
		fehlt
	};
}

describe('abendfeststellungssatz', () => {
	it('nennt bei einem einzigen Haus dessen Namen', () => {
		expect(abendfeststellungssatz([haus('STWEG Nirgendweg 11', true)])).toBe(
			'STWEG Nirgendweg 11 ist beschlussfähig.'
		);
	});

	it('fasst den Regelfall in EINE Zeile', () => {
		// Fünf Häuser, alle beschlussfähig: Der Normalfall darf nicht so lang
		// aussehen wie der Ausnahmefall, sonst liest ihn im Saal niemand zu Ende.
		const satz = abendfeststellungssatz(
			['A', 'B', 'C', 'D', 'E'].map((n) => haus(n, true))
		);
		expect(satz).toBe('Alle 5 Gemeinschaften sind beschlussfähig.');
	});

	it('stellt die nicht beschlussfähigen VORAN, mit dem Grund', () => {
		const satz = abendfeststellungssatz([
			haus('A', true),
			haus('B', false, 'es fehlen 3 Kopfstimmen'),
			haus('C', true)
		]);
		expect(satz.startsWith('Nicht beschlussfähig: B (es fehlen 3 Kopfstimmen).')).toBe(true);
		expect(satz).toContain('Beschlussfähig: A, C.');
	});

	it('nennt alle nicht beschlussfähigen, nicht nur die erste', () => {
		// Der Fall, der im Saal wehtut: zwei Häuser hängen, und der Satz nennt
		// eines. Wer weiterführt, führt über ein Haus hinweg.
		const satz = abendfeststellungssatz([
			haus('A', false, 'es fehlen 3 Kopfstimmen'),
			haus('B', false, 'es fehlen 120 Wertquoten')
		]);
		expect(satz).toContain('A (es fehlen 3 Kopfstimmen)');
		expect(satz).toContain('B (es fehlen 120 Wertquoten)');
		// Ohne beschlussfähige Häuser steht auch kein leerer zweiter Teil da.
		expect(satz).not.toContain('Beschlussfähig:');
	});

	it('haelt einen fehlenden Grund aus, statt «null» zu schreiben', () => {
		expect(abendfeststellungssatz([haus('A', false, null)])).toContain(
			'A (Grund nicht vermerkt)'
		);
	});

	it('sagt bei leerer Liste nichts Falsches', () => {
		expect(abendfeststellungssatz([])).toBe('Nichts festgestellt.');
	});
});
