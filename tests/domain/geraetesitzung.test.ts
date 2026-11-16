import { describe, expect, it } from 'vitest';
import {
	BELEGT_MELDUNG,
	BEZEICHNUNG_HOECHSTLAENGE,
	endegrund,
	geraetebezeichnung,
	SITZUNGSENDEN
} from '../../src/lib/domain/geraetesitzung';

describe('Warum eine Sitzung endete', () => {
	it('nennt für jedes Ende einen Satz', () => {
		for (const ende of SITZUNGSENDEN) {
			expect(endegrund(ende).length).toBeGreaterThan(10);
		}
	});

	it('sagt bei jedem behebbaren Ende, was zu tun ist', () => {
		// Ein blosses «nicht mehr gültig» liesse jemanden im Saal stehen, der nicht
		// weiss, ob er das Problem selbst lösen kann.
		expect(endegrund('abgelaufen')).toMatch(/erneut ein/);
		expect(endegrund('freigegeben')).toMatch(/neu anmelden/);
		expect(endegrund('abgemeldet')).toMatch(/wieder frei/);
	});

	it('fordert beim Ablösen zum Melden auf', () => {
		// Wurde das Gerät abgelöst, ohne dass die Person es veranlasst hat, ist das
		// der einzige Augenblick, in dem es noch auffallen kann.
		expect(endegrund('ersetzt')).toMatch(/Sitzungsleitung/);
	});
});

describe('Die Meldung bei belegtem Zugang', () => {
	it('bestätigt ausdrücklich, dass der Code stimmt', () => {
		// Absicht: Der Eigentümer, dessen Telefon leer war, hielte sonst seine Karte
		// für kaputt. Ein Fremder erfährt nichts, was er nicht schon wüsste.
		expect(BELEGT_MELDUNG).toMatch(/Code stimmt/);
	});

	it('nennt beide Wege heraus', () => {
		expect(BELEGT_MELDUNG).toMatch(/Melden Sie sich dort ab/);
		expect(BELEGT_MELDUNG).toMatch(/Sitzungsleitung freigeben/);
	});
});

describe('Gerätebezeichnung', () => {
	const KENNUNGEN: [string, string][] = [
		[
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
			'iPhone · Safari'
		],
		[
			'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
			'Android-Gerät · Chrome'
		],
		[
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
			'Windows-Rechner · Firefox'
		],
		[
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
			'Mac · Edge'
		],
		[
			'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
			'iPad · Chrome'
		]
	];

	it.each(KENNUNGEN)('ordnet %s zu', (kennung, erwartet) => {
		expect(geraetebezeichnung(kennung)).toBe(erwartet);
	});

	it('lässt sich von Chrome nicht als Safari ausgeben', () => {
		// Die Reihenfolge ist der ganze Trick: Edge nennt sich Chrome, Chrome nennt
		// sich Safari. Wer von hinten prüft, findet immer Safari.
		const chrome =
			'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
		expect(geraetebezeichnung(chrome)).toBe('Windows-Rechner · Chrome');
	});

	it('sagt lieber «unbekannt» als etwas Falsches', () => {
		expect(geraetebezeichnung('')).toBe('Unbekanntes Gerät');
		expect(geraetebezeichnung('curl/8.5.0')).toBe('Unbekanntes Gerät');
	});

	it('bleibt kurz genug für eine Tabellenzelle', () => {
		const lang = 'Mozilla/5.0 (Macintosh; Intel Mac OS X) SamsungBrowser/27.0 Chrome/125 Safari/537';
		expect(geraetebezeichnung(lang).length).toBeLessThanOrEqual(BEZEICHNUNG_HOECHSTLAENGE);
	});

	it('nennt die Plattform auch ohne erkannten Browser', () => {
		expect(geraetebezeichnung('Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)')).toBe(
			'iPhone'
		);
	});
});
