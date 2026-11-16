/**
 * Die Version der Anwendung ist der Abbild-Tag (Entscheid 0053). Hier, dass
 * nur ein solcher Tag als Version gilt, und wie sie in Worten steht, auch aus
 * einem Manifest von aussen.
 */
import { describe, expect, it } from 'vitest';
import {
	ABBILD_TAG,
	ENTWICKLUNGSSTAND,
	anwendungInWorten,
	versionAusUmgebung,
	versionInWorten
} from '$lib/domain/version';

describe('Die Version aus der Umgebung', () => {
	it('nimmt den Abbild-Tag, wie abbild-bauen.sh ihn bildet', () => {
		expect(versionAusUmgebung('20261116-0854-854363d4')).toBe('20261116-0854-854363d4');
		expect(versionAusUmgebung(' 20261116-0854-854363d4\n')).toBe('20261116-0854-854363d4');
		expect(versionAusUmgebung('20261116-0854-854363d-lokal')).toBe('20261116-0854-854363d-lokal');
		expect(versionAusUmgebung('20261116-0854-ohne-git')).toBe('20261116-0854-ohne-git');
	});

	it('nimmt nichts anderes: leer, package.json, latest, fremde Form', () => {
		for (const wert of [undefined, null, '', '   ', '0.1.0', 'latest', '2026-11-16', '20261116-0854', 'x20261116-0854-854363d4']) {
			expect(versionAusUmgebung(wert), String(wert)).toBeNull();
		}
		expect(ABBILD_TAG.test('20261116-0854-854363d4; rm -rf /')).toBe(false);
	});

	it('steht als «Version <tag>» oder «Entwicklungsstand»', () => {
		expect(versionInWorten('20261116-0854-854363d4')).toBe('Version 20261116-0854-854363d4');
		expect(versionInWorten(null)).toBe(ENTWICKLUNGSSTAND);
	});
});

describe('Die Anwendung im Manifest', () => {
	it('nennt Name und Version, ohne Tag «ohne Versionsangabe», nicht «Entwicklungsstand»', () => {
		expect(anwendungInWorten({ name: 'Votum', version: '20261116-0854-854363d4' })).toBe(
			'Votum, Version 20261116-0854-854363d4'
		);
		expect(anwendungInWorten({ name: 'Votum', version: null })).toBe('Votum, ohne Versionsangabe');
	});

	it('schweigt bei einem Paket von vorher oder in fremder Form, statt «undefined» zu schreiben', () => {
		for (const wert of [undefined, null, 'Votum', 7, {}, { name: '' }, { name: 3, version: 'x' }]) {
			expect(anwendungInWorten(wert), JSON.stringify(wert)).toBeNull();
		}
		expect(anwendungInWorten({ name: 'Votum', version: 5 })).toBe('Votum, ohne Versionsangabe');
	});
});
