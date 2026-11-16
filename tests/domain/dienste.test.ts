/**
 * Was beim Einrichten eines äusseren Dienstes geprüft wird (14.08.2026).
 *
 * Der Schwerpunkt liegt auf der Trennung **Fehler gegen Hinweis**: Was sicher
 * nicht gehen kann, wird abgewiesen; was ungewöhnlich aussieht, aber stimmen
 * kann, bekommt einen Satz und keine Sperre. Wer beides vermischt, sperrt
 * irgendwann das Modell im eigenen Keller aus.
 */
import { describe, expect, it } from 'vitest';
import {
	normalisiereFingerabdruck,
	pruefeStufe,
	pruefeZeitstempeleingabe
} from '$lib/domain/dienste';

const gute = {
	name: 'Infomaniak (CH)',
	url: 'https://api.infomaniak.com/2/ai/1/openai/v1/chat/completions',
	modell: 'mistral-small',
	geduldMs: 12000
};

describe('Eine KI-Stufe prüfen', () => {
	it('lässt eine vollständige Angabe ohne Fehler und ohne Hinweis durch', () => {
		const { fehler, hinweise } = pruefeStufe(gute);
		expect(fehler).toEqual([]);
		expect(hinweise).toEqual([]);
	});

	it('verlangt eine Bezeichnung, weil sie später im Nachweis steht', () => {
		const { fehler } = pruefeStufe({ ...gute, name: 'x' });
		expect(fehler[0].feld).toBe('name');
		expect(fehler[0].nachricht).toMatch(/Nachweis/);
	});

	it('weist eine Adresse ohne Schema ab', () => {
		expect(pruefeStufe({ ...gute, url: 'api.example.com/v1' }).fehler[0].feld).toBe('url');
	});

	it('weist eine Stufe ohne Modellnamen ab', () => {
		expect(pruefeStufe({ ...gute, modell: '  ' }).fehler[0].feld).toBe('modell');
	});

	/*
	 * Der häufigste Einrichtungsfehler: die Grundadresse ohne Endpunkt. Das ist
	 * aber **kein** Fehler — manche Häuser hängen den Pfad anders —, und ein
	 * Abweisen sperrte sie aus.
	 */
	it('weist eine Adresse ohne /chat/completions nicht ab, sondern warnt', () => {
		const { fehler, hinweise } = pruefeStufe({ ...gute, url: 'https://api.example.com/v1' });
		expect(fehler).toEqual([]);
		expect(hinweise.some((h) => h.includes('/chat/completions'))).toBe(true);
	});

	it('warnt bei unverschlüsselter Adresse ausserhalb des eigenen Hauses', () => {
		const { fehler, hinweise } = pruefeStufe({
			...gute,
			url: 'http://modell.example.com/v1/chat/completions'
		});
		expect(fehler).toEqual([]);
		expect(hinweise.some((h) => h.includes('Klartext'))).toBe(true);
	});

	/*
	 * Das Modell auf dem eigenen Rechner ist der ausdrücklich vorgesehene Fall
	 * («dann verlässt kein Wort das Haus»). Es über http zu erreichen ist dort
	 * kein Mangel — eine Warnung wäre die Sorte Meldung, die man wegzuklicken
	 * lernt.
	 */
	it('warnt nicht bei http auf den eigenen Rechner', () => {
		for (const host of ['127.0.0.1:11434', 'localhost:8080', '192.168.4.1:11434']) {
			const { hinweise } = pruefeStufe({ ...gute, url: `http://${host}/v1/chat/completions` });
			expect(hinweise, host).toEqual([]);
		}
	});

	it('weist unmögliche Geduldwerte ab und warnt bei sehr langen', () => {
		expect(pruefeStufe({ ...gute, geduldMs: 10 }).fehler[0].feld).toBe('geduldMs');
		expect(pruefeStufe({ ...gute, geduldMs: 500_000 }).fehler[0].feld).toBe('geduldMs');

		const lang = pruefeStufe({ ...gute, geduldMs: 45_000 });
		expect(lang.fehler).toEqual([]);
		expect(lang.hinweise.some((h) => h.includes('20 Sekunden'))).toBe(true);
	});
});

describe('Fingerabdrücke', () => {
	/*
	 * Der Kern der Sache: Verglichen wird gegen `X509Certificate.fingerprint256`,
	 * und das ist die Doppelpunktform in Grossbuchstaben. Ein Abdruck ohne
	 * Doppelpunkte sähe richtig aus und passte nie — der Zeitstempel gälte als
	 * «nicht angeheftet», ohne dass jemand den Grund fände.
	 */
	it('bringt beide Schreibweisen auf dieselbe Form', () => {
		const ohne = 'ab'.repeat(32);
		const mit = normalisiereFingerabdruck(ohne)!;
		expect(mit).toMatch(/^AB:AB:/);
		expect(normalisiereFingerabdruck(mit)).toBe(mit);
		expect(normalisiereFingerabdruck(mit.toLowerCase())).toBe(mit);
	});

	it('weist zurück, was kein SHA-256 ist', () => {
		expect(normalisiereFingerabdruck('AB:CD')).toBeNull();
		expect(normalisiereFingerabdruck('z'.repeat(64))).toBeNull();
		// SHA-1 hat 40 Hexzeichen — ein häufiger Verwechslungsfall.
		expect(normalisiereFingerabdruck('ab'.repeat(20))).toBeNull();
	});
});

describe('Den Zeitstempeldienst prüfen', () => {
	it('nimmt mehrere Abdrücke, entdoppelt sie und legt sie einheitlich ab', () => {
		const eins = 'ab'.repeat(32);
		const zwei = 'cd'.repeat(32);
		const { fehler, fingerabdruecke } = pruefeZeitstempeleingabe({
			url: 'https://freetsa.org/tsr',
			name: 'freetsa.org',
			// Dieselbe zweimal, in beiden Schreibweisen — und eine zweite dazu.
			fingerabdruecke: `${eins}\n${normalisiereFingerabdruck(eins)}\n${zwei}`
		});
		expect(fehler).toEqual([]);
		expect(fingerabdruecke).toHaveLength(2);
		expect(fingerabdruecke[0]).toMatch(/^AB:AB:/);
	});

	it('nennt den unbrauchbaren Abdruck beim Namen', () => {
		const { fehler } = pruefeZeitstempeleingabe({
			url: 'https://freetsa.org/tsr',
			name: '',
			fingerabdruecke: 'nicht-wirklich-ein-abdruck'
		});
		expect(fehler[0].feld).toBe('fingerabdruecke');
		expect(fehler[0].nachricht).toMatch(/nicht-wirklich/);
	});

	/*
	 * Ohne Anheftung lässt sich arbeiten — beim ersten Einrichten kennt man den
	 * Abdruck gar nicht. Es muss aber dastehen, weil genau das die Sicherung ist,
	 * die sonst still fehlt.
	 */
	it('lässt eine leere Anheftung zu, sagt aber, was damit fehlt', () => {
		const { fehler, hinweise } = pruefeZeitstempeleingabe({
			url: 'https://freetsa.org/tsr',
			name: 'freetsa.org',
			fingerabdruecke: ''
		});
		expect(fehler).toEqual([]);
		expect(hinweise[0]).toMatch(/jede Antwort/);
	});

	it('weist eine Adresse ohne Schema ab', () => {
		const { fehler } = pruefeZeitstempeleingabe({
			url: 'freetsa.org/tsr',
			name: '',
			fingerabdruecke: ''
		});
		expect(fehler[0].feld).toBe('url');
	});
});
