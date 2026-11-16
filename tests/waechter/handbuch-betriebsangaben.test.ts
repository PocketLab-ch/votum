import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	BETRIEBSANGABEN,
	BETRIEBSANGABEN_AUSNAHMEN,
	BETRIEBSANGABEN_HAUS,
	BETRIEBSANGABEN_SPERRDATEI,
	CONFIG,
	betriebsangaben,
	ladeBetriebsangaben
} from '../../scripts/handbuch-bauen.mjs';

/**
 * Betriebsangaben im öffentlichen Handbuch (`scripts/handbuch-bauen.mjs`).
 *
 * **Anlass:** `/handbuch` ist ohne Anmeldung lesbar, und eine Quelle mit
 * Betriebswissen stand dort, ohne dass ein Prüflauf fragte, was öffentlich
 * steht. Die Namen des eigenen Betriebs stehen in einer Sperrdatei ausserhalb
 * jedes öffentlichen Stands; die Beispiele hier sind erfunden.
 */
describe('das öffentliche Handbuch', () => {
	it('baut das Freigabeblatt nicht mit', () => {
		expect(CONFIG.dateien).not.toContain('freigabe.md');
	});

	it('trägt in keiner Quelle eine Betriebsangabe', () => {
		for (const datei of CONFIG.dateien ?? []) {
			const text = readFileSync(join(CONFIG.quellen[0], datei), 'utf8');
			expect(betriebsangaben(text, datei), datei).toEqual([]);
		}
	});

	it('jede Ausnahme trifft in ihrer Datei wirklich etwas', () => {
		for (const { datei, treffer } of BETRIEBSANGABEN_AUSNAHMEN) {
			expect(CONFIG.dateien, datei).toContain(datei);
			expect(readFileSync(join(CONFIG.quellen[0], datei), 'utf8'), `${datei}: ${treffer}`).toContain(treffer);
		}
	});
});

const PRIVAT_10 = ['10', '0', '0', '1'].join('.');
const PRIVAT_172 = ['172', '16', '0', '1'].join('.');

/** Eine erfundene Sperrdatei, wie die echte aufgebaut. */
const ERFUNDEN = {
	regeln: [
		{ was: 'ein Host oder eine Adresse dieses Hauses', muster: '\\b(host-alpha|proxy-beta)\\b|beispielhaus\\.test' },
		{ was: 'die Abwehr vor dem Betrieb', muster: 'filterwand' },
		{ was: 'der Ort eines Geheimnisses', muster: 'tresorprogramm' }
	]
};

function sperrdatei(inhalt: unknown): { pfad: string; weg: () => void } {
	const ort = mkdtempSync(join(tmpdir(), 'betriebssperre-'));
	const pfad = join(ort, 'betriebsangaben-sperre.json');
	writeFileSync(pfad, typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));
	return { pfad, weg: () => rmSync(ort, { recursive: true, force: true }) };
}

describe('die Sperrdatei des Betriebs', () => {
	// Im öffentlichen Stand fehlt sie mit Absicht; dort ist dieser Test rot wie der
	// Personendaten-Wächter (docs/veroeffentlichung-personendaten.md). Im internen Repo
	// verhindert er, dass der Wächter still auf die allgemeinen Muster schrumpft.
	it('liegt im internen Repo, trägt Regeln und ist eingebunden', () => {
		expect(existsSync(BETRIEBSANGABEN_SPERRDATEI)).toBe(true);
		expect(BETRIEBSANGABEN_HAUS?.length ?? 0).toBeGreaterThanOrEqual(4);
		for (const regel of BETRIEBSANGABEN_HAUS ?? []) expect(BETRIEBSANGABEN).toContain(regel);
	});

	it('fällt aus jedem öffentlichen Stand', () => {
		const attribute = readFileSync('.gitattributes', 'utf8');
		expect(attribute).toMatch(/^scripts\/betriebsangaben-sperre\.json export-ignore$/m);
		expect(readFileSync('scripts/spiegel-stand.sh', 'utf8')).toContain('scripts/betriebsangaben-sperre.json');
	});

	it('bricht ab, wenn sie da ist und nicht taugt', () => {
		for (const kaputt of ['{}', '{"regeln":[]}', '{"regeln":[{"was":"x"}]}', 'kein json']) {
			const d = sperrdatei(kaputt);
			try {
				expect(() => ladeBetriebsangaben(d.pfad), kaputt).toThrow();
			} finally {
				d.weg();
			}
		}
		expect(ladeBetriebsangaben(join(tmpdir(), 'gibt-es-nicht.json'))).toBeNull();
	});
});

describe('der Wächter selbst', () => {
	const d = sperrdatei(ERFUNDEN);
	const haus = ladeBetriebsangaben(d.pfad) ?? [];
	d.weg();
	const allgemein = BETRIEBSANGABEN.filter((r) => !(BETRIEBSANGABEN_HAUS ?? []).includes(r));
	const regeln = [...haus, ...allgemein];

	it.each([
		['Der Dienst läuft auf host-alpha hinter proxy-beta.', ['host-alpha', 'proxy-beta']],
		['Post über mail.beispielhaus.test.', ['beispielhaus.test']],
		['Prüfwörter: Filterwand, als trusted, trusted IPs.', ['Filterwand', 'als trusted', 'trusted IPs']],
		['Ein trusted Proxy davor.', ['trusted Proxy']],
		['Das Geheimnis liegt im Tresorprogramm.', ['Tresorprogramm']],
		['Offen in docs/pendenzen-sicherheit.md.', ['pendenzen-sicherheit']],
		// Private Adressen: erkennbar erfunden und zur Laufzeit zusammengesetzt. Der
		// Personendaten-Wächter (`scripts/check-personendaten.mjs`) meldet jede private
		// Adresse im Quelltext ausser `192.168.4.1`; diese hier gehören keinem Host.
		[`Erreichbar unter ${PRIVAT_10}, ${PRIVAT_172} und 192.168.4.1.`, [PRIVAT_10, PRIVAT_172, '192.168.4.1']],
		[`Nicht privat: ${['172', '15', '0', '1'].join('.')} und ${['172', '32', '0', '1'].join('.')}.`, []],
		['Liegt in /root/geheim und .env.betrieb.', ['/root/geheim', '.env.betrieb']]
	])('findet «%s»', (satz, erwartet) => {
		expect(betriebsangaben(satz, 'dienste.md', regeln).map((b) => b.treffer)).toEqual(erwartet);
	});

	it('ohne Sperrdatei bleiben die allgemeinen Muster', () => {
		expect(betriebsangaben('Auf host-alpha, Schlüssel in /root/geheim.', 'dienste.md', allgemein).map((b) => b.treffer)).toEqual([
			'/root/geheim'
		]);
	});

	it('nennt die Zeile', () => {
		expect(betriebsangaben('erste Zeile\nzweite auf host-alpha', 'dienste.md', regeln)).toEqual([
			{ zeile: 2, treffer: 'host-alpha', was: 'ein Host oder eine Adresse dieses Hauses' }
		]);
	});

	it('lässt die Ausnahmen nur in ihrer Datei und nur genau zu', () => {
		const satz = 'Vorgabe 192.168.4.1, Schlüssel /root/.ssh/beispiel, Werte in .env.betrieb.';
		// Seit die Skripte `~/.ssh/…` vorgeben, ist ein Pfad unter /root/ auch in installation.md nicht frei.
		expect(betriebsangaben(satz, 'installation.md').map((b) => b.treffer)).toEqual(['/root/.ssh/beispiel']);
		expect(betriebsangaben(satz, 'dienste.md').map((b) => b.treffer)).toEqual([
			'192.168.4.1',
			'/root/.ssh/beispiel',
			'.env.betrieb'
		]);
		// Codeprüfung, N3: ein anderer Pfad unter /root/ ist auch in installation.md nicht frei.
		expect(betriebsangaben('Schlüssel in /root/sicherung-schluessel.asc.', 'installation.md').map((b) => b.treffer)).toEqual([
			'/root/sicherung-schluessel.asc'
		]);
	});

	it('lässt Dienste der Anwendung durch', () => {
		expect(betriebsangaben('Anmeldung über Authentik, Meldungen über Gotify, Zeitstempel über FreeTSA.', 'dienste.md')).toEqual([]);
		expect(betriebsangaben('Trusted Timestamping nach RFC 3161, ein Passwortmanager nach Wahl.', 'dienste.md')).toEqual([]);
		expect(betriebsangaben('Ein kleiner Rechner im Keller, Namen über einen eigenen DNS-Dienst, davor ein Reverse Proxy.', 'installation.md')).toEqual([]);
	});

	/** Ein Wegwerfbaum mit dem Bauskript, leeren Kapiteln und wahlweise der erfundenen Sperrdatei. */
	function bau(dienste: string, mitSperre: boolean) {
		const wurzel = realpathSync(mkdtempSync(join(tmpdir(), 'handbuchbetrieb-')));
		mkdirSync(join(wurzel, 'scripts'));
		mkdirSync(join(wurzel, 'docs'));
		cpSync(join(process.cwd(), 'scripts', 'handbuch-bauen.mjs'), join(wurzel, 'scripts', 'handbuch-bauen.mjs'));
		if (mitSperre) writeFileSync(join(wurzel, 'scripts', 'betriebsangaben-sperre.json'), JSON.stringify(ERFUNDEN));
		for (const d of CONFIG.dateien ?? []) writeFileSync(join(wurzel, 'docs', d), '# Kapitel\n');
		writeFileSync(join(wurzel, 'docs', 'dienste.md'), `# Kapitel\n\n${dienste}\n`);
		const lauf = spawnSync('node', [join(wurzel, 'scripts', 'handbuch-bauen.mjs')], { encoding: 'utf8' });
		const geschrieben = existsSync(join(wurzel, 'static', 'handbuch'));
		rmSync(wurzel, { recursive: true, force: true });
		return { ...lauf, geschrieben };
	}

	it('bricht den Bau ab, bevor etwas geschrieben wird', () => {
		const lauf = bau('Der Dienst läuft auf host-alpha.', true);
		expect(lauf.status).toBe(1);
		expect(lauf.stderr).toContain('dienste.md:3: «host-alpha»');
		expect(lauf.stderr).not.toContain('fehlt');
		expect(lauf.geschrieben).toBe(false);
	});

	it('baut ohne Sperrdatei mit Hinweis und hält die allgemeinen Muster', () => {
		const sauber = bau('Der Dienst läuft auf host-alpha.', false);
		// Leere Kapitel scheitern später an den Ankern der Seitenhilfe; hier zählt nur der Wächter.
		expect(sauber.stderr).toContain('betriebsangaben-sperre.json fehlt');
		expect(sauber.stderr).not.toContain('Betriebsangaben in einer Quelle');
		const pfad = bau('Schlüssel in /root/geheim.', false);
		expect(pfad.status).toBe(1);
		expect(pfad.stderr).toContain('dienste.md:3: «/root/geheim»');
	});
});
