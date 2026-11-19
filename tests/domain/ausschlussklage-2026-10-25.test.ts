/**
 * Fassung 2026-10-25 gegenüber 2026-10-24: An der Ausschlussklage bleiben
 * Angehörige im Ausstand in der Zahl (1e, Entscheid 0018, «Fest»). Die
 * Rechnung misst `lesart-ausstand.test.ts`; hier die Fassung als Daten.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { ausstandBleibtInDerZahl, waehleErfordernis } from '$lib/domain/entscheidbaum';
import { angehoerigenhinweis } from '$lib/domain/auszaehlung';
import { ANGEHOERIGE_ERSATZ, ANGEHOERIGE_HINWEIS, AUSSCHLUSS_ID } from '$lib/rules/quorum-2026-10-25';

const NEU = holeRegelwerk('2026-10-25');
const VOR = holeRegelwerk('2026-10-24');

describe('Fassung 2026-10-25 gegenüber 2026-10-24', () => {
	it('ist in sich stimmig und seit Lesarten Block 3 nicht mehr die aktuelle', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toEqual([]);
	});

	it('ändert nur die Ausschlussklage, und dort nur den Satz zu den Angehörigen', () => {
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.fragen).toEqual(VOR.fragen);
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			if (k.id !== AUSSCHLUSS_ID) {
				expect(k, k.id).toEqual(v);
				continue;
			}
			const { hinweise: hn, hinweiseUnterRegel: un, ...restNeu } = k;
			const { hinweise: hv, hinweiseUnterRegel: uv, ...restVor } = v;
			expect(restNeu).toEqual(restVor);
			const geaendert = hn!.filter((h, i) => h !== hv![i]);
			expect(geaendert).toEqual([ANGEHOERIGE_HINWEIS]);
			expect(un!.filter((u, i) => JSON.stringify(u) !== JSON.stringify(uv![i]))).toEqual([
				expect.objectContaining({ hinweis: ANGEHOERIGE_HINWEIS, ersatz: ANGEHOERIGE_ERSATZ })
			]);
		}
	});

	it('der Satz sagt, dass die Angehörigen in der Zahl bleiben, und rechnet das Beispiel vor', () => {
		expect(ANGEHOERIGE_HINWEIS).toContain('In der Zahl, an der die Mehrheit gemessen wird, lässt Votum sie trotzdem');
		expect(ANGEHOERIGE_HINWEIS).toContain('sechs Ja von zehn');
		expect(ANGEHOERIGE_HINWEIS).not.toContain('misst die Mehrheit dann ohne die Angehörigen');
	});

	it('die Regel 1e hängt an der Fassung und an der Zahl über alle', () => {
		const e = waehleErfordernis(NEU, AUSSCHLUSS_ID).ergebnis!;
		expect(ausstandBleibtInDerZahl(e)).toBe(true);
		expect(ausstandBleibtInDerZahl(waehleErfordernis(VOR, AUSSCHLUSS_ID).ergebnis!)).toBe(false);
		expect(ausstandBleibtInDerZahl({ ...e, kopfbasis: 'anwesend_vertreten' })).toBe(false);
		expect(ausstandBleibtInDerZahl({ ...e, knotenId: 'k-verwaltung-wichtig' })).toBe(false);
		expect(ausstandBleibtInDerZahl({ ...e, fassung: 'weisungsregel' })).toBe(false);
	});

	it('der Hinweis an die Leitung rät nicht mehr, die Angehörigen von Hand hinzuzuzählen', () => {
		const e = waehleErfordernis(NEU, AUSSCHLUSS_ID).ergebnis!;
		const neu = angehoerigenhinweis(e)!;
		expect(neu).toContain('Die Anwendung lässt diese Angehörigen in der Zahl aller Eigentümer');
		expect(neu).not.toContain('zur Zahl der Eigentümer hinzu');
		// Unter der Vorfassung bleibt der alte Rat.
		expect(angehoerigenhinweis(waehleErfordernis(VOR, AUSSCHLUSS_ID).ergebnis!)).toContain(
			'zur Zahl der Eigentümer hinzu'
		);
		// Unter einer Klausel der Anwesenden nennt Votum die Zahl aller seit Block 6
		// selbst (`ausschlussklage-zaehlbasis.test.ts`); der Rat, von Hand zu zählen, entfällt.
		expect(angehoerigenhinweis({ ...e, kopfbasis: 'anwesend_vertreten' })).not.toContain(
			'Zählen Sie nach der Abstimmung alle'
		);
	});
});
