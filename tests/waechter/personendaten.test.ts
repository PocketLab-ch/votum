/**
 * Gegentest für `scripts/check-personendaten.mjs`, die vier Prüfungen des
 * vollen Wächters (27.10.2026).
 *
 * Je Prüfung zwei Seiten: Ein Wegwerfbaum mit einer eingesetzten Probe muss rot
 * werden, derselbe Baum ohne sie grün. Und dazu die Gegenprobe, die zeigt, dass
 * gerade die neue Prüfung den Befund trägt: Beim Teilwort der Freieintrag, bei
 * der Ziffernfolge die Zeile, bei Adresse und E-Mail die Ausnahme.
 *
 * Die Sperrwörter sind erfunden («zettelkamm», «4711»), damit der Test keinen
 * Namen trägt, den der Wächter schützt.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fahreWaechter } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-personendaten.mjs');
const BAEUME: string[] = [];

afterAll(() => {
	for (const b of BAEUME) rmSync(b, { recursive: true, force: true });
});

function summe(wort: string): string {
	return createHash('sha256').update(wort.normalize('NFC').toLowerCase()).digest('hex').slice(0, 24);
}

/** Ein Wegwerfbaum mit Sperrliste und den genannten Dateien. */
function baum(sperrzeilen: string[], dateien: Record<string, string>): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'personendaten-'));
	BAEUME.push(wurzel);
	mkdirSync(join(wurzel, 'scripts'), { recursive: true });
	writeFileSync(
		join(wurzel, 'scripts', 'personendaten-sperre.tsv'),
		`# Sperrliste für den Gegentest\n${sperrzeilen.join('\n')}\n`,
		'utf8'
	);
	for (const [pfad, inhalt] of Object.entries(dateien)) {
		mkdirSync(dirname(join(wurzel, pfad)), { recursive: true });
		writeFileSync(join(wurzel, pfad), inhalt, 'utf8');
	}
	return wurzel;
}

/*
 * Die Proben für Adresse und E-Mail entstehen erst zur Laufzeit: Stünden sie
 * hier als Wortlaut, wäre diese Datei selbst ein Befund des Wächters.
 */
const ADRESSE = ['jemand', 'firma.ch'].join('@');
const ip = (...teile: number[]) => teile.join('.');

/** Eine Zeile, die nie trifft, damit die Sperrliste nicht leer ist. */
const LEER = `${summe('nirgendsvorkommend')}\t0`;

describe('Teilwort', () => {
	// Seit A6 ohne Längenspalte: Jede Zeile gilt als Teilwort ab fünf Buchstaben.
	const zeile = `${summe('zettelkamm')}\t0`;

	it('findet das Wort in einem längeren Lauf', () => {
		const lauf = fahreWaechter(SKRIPT, baum([zeile], { 'src/a.ts': '// Zettelkammstrasse 4\n' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('src/a.ts');
	});

	it('findet es auch im Dateinamen', () => {
		const lauf = fahreWaechter(SKRIPT, baum([zeile], { 'docs/zettelkammweg.md': '// leer\n' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('docs/zettelkammweg.md');
	});

	it('zählt ein ganzes Wort nur einmal, nicht auch als Teilwort', () => {
		const lauf = fahreWaechter(SKRIPT, baum([zeile], { 'src/a.ts': '// Zettelkamms\n' }));
		expect(lauf.ausgabe).toContain('1 Nennungen');
	});

	it('nimmt ein Stück unter fünf Buchstaben nicht als Teilwort', () => {
		const kurz = `${summe('kamm')}\t0`;
		expect(fahreWaechter(SKRIPT, baum([kurz], { 'src/a.ts': '// Zettelkammer\n' })).rot).toBe(false);
	});

	it('lässt einen Baum ohne das Wort in Ruhe', () => {
		expect(fahreWaechter(SKRIPT, baum([zeile], { 'src/a.ts': '// Nirgendweg 4\n' })).rot).toBe(false);
	});

	it('weist eine Zeile mit Längenspalte ab', () => {
		const lauf = fahreWaechter(SKRIPT, baum([`${summe('zettelkamm')}\t0\t10`], { 'src/a.ts': '' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('Längenspalte');
	});
});

describe('Freieintrag', () => {
	const zeile = `${summe('zettelkamm')}\t0`;
	const frei = `${summe('zettelkammstrasse')}\tfrei`;

	it('Gegenprobe: gibt ein ganzes Wort mit gesperrtem Stück frei', () => {
		expect(
			fahreWaechter(SKRIPT, baum([zeile, frei], { 'src/a.ts': '// Zettelkammstrasse 4\n' })).rot
		).toBe(false);
	});

	it('gibt nur das genannte Wort frei, nicht ein anderes mit demselben Stück', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum([zeile, frei], { 'src/a.ts': '// Zettelkammstrasse 4\n// Zettelkammweg 2\n' })
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('src/a.ts');
	});

	it('ist rot, wenn er nichts mehr deckt', () => {
		const lauf = fahreWaechter(SKRIPT, baum([zeile, frei], { 'src/a.ts': '// Nirgendweg 4\n' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('Freieintrag');
	});
});

describe('Ziffernfolge', () => {
	it('findet eine gesperrte vierstellige Zahl', () => {
		const lauf = fahreWaechter(
			SKRIPT,
			baum([`${summe('4711')}\t0`], { 'docs/a.md': 'Grundbuchblatt 4711-3\n' })
		);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('docs/a.md');
	});

	it('nimmt eine längere Zahl, die sie enthält, nicht dafür', () => {
		expect(
			fahreWaechter(SKRIPT, baum([`${summe('4711')}\t0`], { 'docs/a.md': 'Betrag 47110\n' })).rot
		).toBe(false);
	});

	it('Gegenprobe: ohne die Zeile in der Sperrliste bleibt sie frei', () => {
		expect(fahreWaechter(SKRIPT, baum([LEER], { 'docs/a.md': 'Grundbuchblatt 4711-3\n' })).rot).toBe(
			false
		);
	});

	it('findet eine gesperrte vierstellige Zahl im Dateinamen (Pfad)', () => {
		// Ziffernfolgen galten nur im Inhalt; eine Postleitzahl oder ein
		// Grundbuchblatt kann aber auch im Pfad stehen (Pendenzen 27.10.2026).
		const lauf = fahreWaechter(SKRIPT, baum([`${summe('4711')}\t0`], { 'docs/4711-notiz.md': '// leer\n' }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('docs/4711-notiz.md');
	});

	it('Gegenprobe: eine nicht gesperrte Zahl im Pfad bleibt frei', () => {
		expect(
			fahreWaechter(SKRIPT, baum([LEER], { 'docs/1234-notiz.md': '// leer\n' })).rot
		).toBe(false);
	});
});

describe('E-Mail-Adresse', () => {
	it('findet eine Adresse auf einer echten Domäne', () => {
		const lauf = fahreWaechter(SKRIPT, baum([LEER], { 'tests/a.ts': `const an = '${ADRESSE}';\n` }));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('tests/a.ts:1 (E-Mail-Adresse)');
		expect(lauf.ausgabe).not.toContain(ADRESSE);
	});

	it('lässt erkennbar erfundene Domänen in Ruhe', () => {
		const inhalt = [
			'anna@example.ch',
			'a.b-c+d@sub.example.co.uk',
			'x@kasse.invalid',
			'x@drucker.local',
			'x@probe.test'
		].join('\n');
		expect(fahreWaechter(SKRIPT, baum([LEER], { 'tests/a.ts': `${inhalt}\n` })).rot).toBe(false);
	});

	it('lässt die Testadresse «<name>.e2e@pocketlab.ch» durch, und nur diese Form', () => {
		const haus = ['pocketlab', 'ch'].join('.');
		const vorlage = ['$', '{name}'].join('');
		const gut = [`anna.e2e@${haus}`, `a.b-c+d.e2e@${haus}`, `${vorlage}.e2e@${haus}`];
		const lauf = fahreWaechter(SKRIPT, baum([LEER], { 'tests/a.ts': `${gut.join('\n')}\n` }));
		expect(lauf.rot).toBe(false);
	});

	it('Gegenprobe: ohne «.e2e» auf der Hausdomäne und auf einer anderen Hausdomäne bleibt es ein Fund', () => {
		const haus = ['pocketlab', 'ch'].join('.');
		const andere = ['pocketmail', 'ch'].join('.');
		for (const adresse of [`x@${haus}`, `anna.e2e@${andere}`, `anna.e2e@${haus}.org`]) {
			const lauf = fahreWaechter(SKRIPT, baum([LEER], { 'tests/a.ts': `const an = '${adresse}';\n` }));
			expect(lauf.rot, adresse).toBe(true);
			expect(lauf.ausgabe, adresse).toContain('tests/a.ts:1 (E-Mail-Adresse)');
		}
	});

	it('Gegenprobe: dieselbe Adresse in einer Lizenzdatei ist eine Pflichtangabe', () => {
		expect(fahreWaechter(SKRIPT, baum([LEER], { LICENSE: `${ADRESSE}\n` })).rot).toBe(false);
	});
});

describe('private IPv4-Adresse', () => {
	it('findet eine Adresse aus einem privaten Netz', () => {
		for (const adresse of [ip(10, 1, 2, 3), ip(172, 20, 0, 2), ip(192, 168, 7, 9), ip(192, 168, 4, 10)]) {
			const lauf = fahreWaechter(SKRIPT, baum([LEER], { 'e2e/a.mjs': `const ZIEL = 'http://${adresse}:3101';\n` }));
			expect(lauf.rot, adresse).toBe(true);
			expect(lauf.ausgabe, adresse).toContain('(private IPv4-Adresse)');
		}
	});

	it('lässt die erlaubten Adressen und öffentliche in Ruhe', () => {
		const inhalt = ['127.0.0.1', '0.0.0.0', '192.168.4.1', '203.0.113.7', '198.51.100.1', '192.0.2.5', '8.8.8.8', 'Version 10.2.3'].join('\n');
		expect(fahreWaechter(SKRIPT, baum([LEER], { 'src/a.ts': `${inhalt}\n` })).rot).toBe(false);
	});

	it('Gegenprobe: 192.168.4.1 ist frei, die Nachbaradresse nicht', () => {
		expect(fahreWaechter(SKRIPT, baum([LEER], { 'src/a.ts': '192.168.4.1\n' })).rot).toBe(false);
		expect(fahreWaechter(SKRIPT, baum([LEER], { 'src/a.ts': `${ip(192, 168, 4, 2)}\n` })).rot).toBe(true);
	});
});
