import { describe, expect, it } from 'vitest';
import { EINWAND_VOLLZUG } from '$lib/domain/entscheidbaum';
import { VON_HAND_FESTGEHALTEN_AUSSTAND, VON_HAND_FESTGEHALTEN_NEU_GESPERRT } from '$lib/domain/vonhand';

/**
 * Die Wartezeit nach Ablauf der Anfechtungsfrist (15.11.2026). «Einige Tage»
 * war zu kurz: Ein Schlichtungsgesuch vom letzten Tag wahrt die Frist (ZPO
 * Art. 62 Abs. 1, 143 Abs. 1), und die Bewirtschaftung erhält es erst mit der
 * Vorladung (Art. 202 Abs. 3). Fachprüfung der Fassung 2026-11-17, R2-M1;
 * Korrektur in drei Runden Laien- und Fachprüfung (`quellen`
 * `pruefung/berichte/2026-11-15-votum-wartezeit-kern-*`). Ohne diese Probe
 * bliebe ein Rückfall auf «einige Tage» grün (Codeprüfung, N2).
 */
describe('Wartezeit nach der Anfechtungsfrist im Kern', () => {
	it.each([
		['EINWAND_VOLLZUG', EINWAND_VOLLZUG],
		['VON_HAND_FESTGEHALTEN_NEU_GESPERRT', VON_HAND_FESTGEHALTEN_NEU_GESPERRT],
		['VON_HAND_FESTGEHALTEN_AUSSTAND', VON_HAND_FESTGEHALTEN_AUSSTAND]
	])('%s rechnet Wochen, nicht Tage, und fragt bei der Bewirtschaftung', (_, satz) => {
		expect(satz).toContain('einige Wochen');
		expect(satz).not.toMatch(/einige Tage/);
		expect(satz).toMatch(/Fragen Sie die Bewirtschaftung, ob Post der Schlichtungsbehörde/);
	});

	it('nennt beim Einwand den Stillstand und den Fall, dass der Antrag die Bestimmung erreicht, vorn', () => {
		expect(EINWAND_VOLLZUG).toContain('(ZPO Art. 145 Abs. 1)');
		expect(EINWAND_VOLLZUG.indexOf('Erreicht der Antrag die Bestimmung')).toBeLessThan(
			EINWAND_VOLLZUG.indexOf('Die Frist beträgt einen Monat')
		);
	});
});
