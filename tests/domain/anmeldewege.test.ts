import { describe, expect, it } from 'vitest';
import {
	anmeldewege,
	ERREICHBARKEIT_ZEITLIMIT_MS,
	merkmalStimmt,
	sicheresZiel
} from '../../src/lib/domain/anmeldewege';

describe('Welche Wege offenstehen', () => {
	it('bietet ohne eingerichtetes Authentik nur die lokale Anmeldung', () => {
		const w = anmeldewege({ eingerichtet: false, erreichbarkeit: 'nicht_eingerichtet' });
		expect(w).toEqual({ authentik: false, lokal: true, rueckfall: false, hinweis: null });
	});

	it('bietet bei erreichbarem Authentik beide Wege', () => {
		const w = anmeldewege({ eingerichtet: true, erreichbarkeit: 'erreichbar' });
		expect(w.authentik).toBe(true);
		expect(w.lokal).toBe(true);
	});

	it('lässt die lokale Anmeldung auch dann offen, wenn Authentik läuft', () => {
		// Sie abzuschalten hiesse: Fällt der Dienst mitten in der Versammlung aus,
		// kommt niemand mehr herein — genau das verhindert AD-9.
		expect(anmeldewege({ eingerichtet: true, erreichbarkeit: 'erreichbar' }).lokal).toBe(true);
	});

	it('weicht bei nicht erreichbarem Authentik aus und sagt es', () => {
		const w = anmeldewege({ eingerichtet: true, erreichbarkeit: 'nicht_erreichbar' });
		expect(w.authentik).toBe(false);
		expect(w.lokal).toBe(true);
		expect(w.rueckfall).toBe(true);
		expect(w.hinweis).toMatch(/nicht erreichbar/);
		expect(w.hinweis).toMatch(/Verlauf/);
	});

	it('unterscheidet «nicht eingerichtet» von «nicht erreichbar»', () => {
		// Wo Authentik gar nicht eingerichtet ist, ist die lokale Anmeldung der
		// vorgesehene Weg und kein Ausweichen — nur das Ausweichen gehört in den
		// Verlauf.
		expect(anmeldewege({ eingerichtet: false, erreichbarkeit: 'nicht_eingerichtet' }).rueckfall).toBe(
			false
		);
		expect(anmeldewege({ eingerichtet: true, erreichbarkeit: 'nicht_erreichbar' }).rueckfall).toBe(
			true
		);
	});

	it('hält das Zeitlimit kurz genug für den Saal', () => {
		// Wer vor einem Saal voller Leute steht, wartet nicht.
		expect(ERREICHBARKEIT_ZEITLIMIT_MS).toBeLessThanOrEqual(3000);
	});
});

describe('Zustandsmerkmal', () => {
	it('stimmt nur bei Gleichheit', () => {
		expect(merkmalStimmt('abc123', 'abc123')).toBe(true);
		expect(merkmalStimmt('abc123', 'abc124')).toBe(false);
	});

	it('weist fehlende Merkmale ab', () => {
		// Ohne diese Prüfung wäre der Rückweg von Authentik eine offene Tür.
		expect(merkmalStimmt(undefined, 'abc')).toBe(false);
		expect(merkmalStimmt('abc', null)).toBe(false);
		expect(merkmalStimmt(undefined, null)).toBe(false);
	});

	it('weist eine andere Länge ab', () => {
		expect(merkmalStimmt('abc', 'abcd')).toBe(false);
	});
});

describe('Ziel nach der Anmeldung', () => {
	it('lässt Pfade innerhalb der Anwendung zu', () => {
		expect(sicheresZiel('/versammlungen')).toBe('/versammlungen');
		expect(sicheresZiel('/gemeinschaften/abc/einheiten')).toBe('/gemeinschaften/abc/einheiten');
	});

	it('weist vollständige Verweise nach aussen ab', () => {
		// Sonst wäre die Anmeldeseite eine Weiterleitung auf beliebige Ziele — der
		// klassische Weg, jemanden nach dem Anmelden auf eine nachgemachte Seite
		// zu schicken.
		expect(sicheresZiel('https://beispiel.invalid/')).toBe('/');
		expect(sicheresZiel('//beispiel.invalid/')).toBe('/');
		expect(sicheresZiel('javascript:alert(1)')).toBe('/');
	});

	it('weist Gestalten ab, die der Browser zu einer fremden Autorität auflöst (A1)', () => {
		// Was der Browser aus der Location-Antwort machte, ist die Messlatte: Der
		// Backslash zählt bei http(s) als Schrägstrich, Tabulator und
		// Zeilenvorschub werden gestrichen, Punktsegmente fallen weg.
		const herkunft = 'http://saal.local:3100/anmelden';
		for (const boese of [
			'/\\boese.example',
			'/\\/boese.example',
			'/\t/boese.example',
			'/\n/boese.example'
		]) {
			expect(new URL(boese, herkunft).host, boese).toBe('boese.example');
			expect(sicheresZiel(boese), boese).toBe('/');
		}
	});

	it('gibt keine aufgelöste Form zurück, die protokollrelativ geworden ist', () => {
		// `/.//boese.example` bleibt beim ersten Auflösen bei der eigenen
		// Herkunft, der Pfad lautet danach aber `//boese.example`. Ginge diese
		// Form in die Location-Antwort, löste der Browser sie ein zweites Mal auf.
		const herkunft = 'http://saal.local:3100/anmelden';
		const einmal = new URL('/.//boese.example', herkunft).pathname;
		expect(new URL(einmal, herkunft).host).toBe('boese.example');
		expect(sicheresZiel('/.//boese.example')).toBe('/');
	});

	it('behält Abfrage und Anker eines gültigen Ziels', () => {
		// Gegenprobe zu A1: Die Auflösung darf ein gültiges Ziel nicht verkürzen.
		expect(sicheresZiel('/versammlungen/abc?reiter=traktanden#t3')).toBe(
			'/versammlungen/abc?reiter=traktanden#t3'
		);
	});

	it('macht aus Leerem die Startseite', () => {
		expect(sicheresZiel(null)).toBe('/');
		expect(sicheresZiel(undefined)).toBe('/');
		expect(sicheresZiel('')).toBe('/');
	});
});
