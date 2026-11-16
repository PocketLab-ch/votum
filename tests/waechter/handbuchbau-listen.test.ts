import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rendern } from '../../scripts/handbuch-bauen.mjs';

/**
 * Listen im Handbuchbau (`scripts/handbuch-bauen.mjs`).
 *
 * **Warum es diese Probe gibt.** Bis zum 02.10.2026 bekam ein Listenpunkt nur
 * die eine Quellzeile mit dem Listenzeichen. Jede Fortsetzungszeile schloss die
 * Liste und wurde ein Absatz. Gemessen am gebauten Handbuch: 160 von 177 Listen
 * hatten genau einen Punkt, und eine nummerierte Liste begann je Punkt neu
 * bei 1. Aufgefallen ist es an einer gebauten Seite, nicht im Prüflauf: Der
 * Renderer hatte keine Probe.
 *
 * Jede Probe hier war am alten Renderer rot, bis auf die drei, die das
 * Bisherige festhalten (einzeilige Liste, offener Aufgabenhaken, Ende an der
 * Zeile ohne Einzug). Die stehen
 * da, damit der Umbau sie nicht still verändert.
 */
const html = (md: string): string => rendern(md).html;
const zahl = (text: string, muster: RegExp): number => (text.match(muster) ?? []).length;

describe('ein Listenpunkt über mehrere Zeilen', () => {
	it('bleibt ein Punkt', () => {
		const aus = html('- erste Zeile\n  zweite Zeile\n  dritte Zeile');
		expect(aus).toBe('<ul>\n<li>erste Zeile zweite Zeile dritte Zeile</li>\n</ul>');
	});

	it('zählt in einer nummerierten Liste durch', () => {
		const aus = html('1. eins\n   weiter\n2. zwei\n   weiter\n3. drei\n   weiter');
		expect(zahl(aus, /<ol/g)).toBe(1);
		expect(zahl(aus, /<li>/g)).toBe(3);
		expect(aus).not.toContain('<p>');
	});

	it('übersteht eine Leerzeile zwischen zwei Punkten', () => {
		const aus = html('1. eins\n\n2. zwei');
		expect(zahl(aus, /<ol/g)).toBe(1);
		expect(zahl(aus, /<li>/g)).toBe(2);
	});
});

describe('weitere Blöcke im Punkt', () => {
	it('setzt einen eingerückten zweiten Absatz in denselben Punkt', () => {
		const aus = html('- Punkt\n\n  Zweiter Absatz,\n  zwei Zeilen.\n- Nachbar');
		expect(aus).toBe(
			'<ul>\n<li>Punkt\n<p>Zweiter Absatz, zwei Zeilen.</p></li>\n<li>Nachbar</li>\n</ul>'
		);
	});

	it('lässt einen nicht eingerückten Absatz draussen', () => {
		const aus = html('- Punkt\n  weiter\n\nDanach.');
		expect(aus).toBe('<ul>\n<li>Punkt weiter</li>\n</ul>\n<p>Danach.</p>');
	});

	it('beendet den Punkt an einer Zeile ohne Einzug, auch ohne Leerzeile', () => {
		const aus = html('- Punkt\nDanach.');
		expect(aus).toBe('<ul>\n<li>Punkt</li>\n</ul>\n<p>Danach.</p>');
	});

	it('nimmt Zitat und Codeblock mit, ohne die Nummerierung zu zerreissen', () => {
		const aus = html(
			['1. eins', '', '   > Zitat', '   > weiter', '2. zwei', '', '   ```sql', '   SELECT 1;', '', '   ```', '3. drei'].join('\n')
		);
		expect(zahl(aus, /<ol/g)).toBe(1);
		expect(aus).toContain('<li>eins\n<blockquote><p>Zitat weiter</p></blockquote></li>');
		expect(aus).toContain('<li>zwei\n<pre><code>SELECT 1;\n</code></pre></li>');
		expect(aus).not.toContain('&gt;');
	});
});

describe('Grenzfälle im Punktkörper', () => {
	it('erkennt den Codeblock auch, wenn eine Codezeile in Spalte 0 steht', () => {
		const aus = html('- Punkt\n\n  ```sql\nSELECT 1;\n  ```\n- zwei');
		expect(aus).toBe('<ul>\n<li>Punkt\n<pre><code>SELECT 1;</code></pre></li>\n<li>zwei</li>\n</ul>');
	});

	it('wirft eine Fortsetzungszeile nicht weg, die mit einem Tabellenstrich beginnt', () => {
		const aus = html('- a\n  | kein Tabellenkopf\n  weiter');
		expect(aus).toContain('| kein Tabellenkopf');
		expect(aus).toContain('weiter');
	});

	it('hält drei Striche am Anfang eines Punkts nicht für einen Dateikopf', () => {
		expect(html('- ---\n  a\n  ---\n  b')).toBe('<ul>\n<li>--- a\n<hr>\n<p>b</p></li>\n</ul>');
	});

	it('meldet eine umbrochene Zeile, die mit einer Zahl und Punkt beginnt', () => {
		expect(rendern('- Frist endet am\n  3. Dezember').fehler).toHaveLength(1);
	});
});

describe('verschachtelte Listen', () => {
	it('hängt die Unterliste in den Punkt und zählt aussen weiter', () => {
		const aus = html(
			['1. eins', '   - a', '     weiter', '   - b', '', '   Absatz des Elternpunkts.', '2. zwei'].join('\n')
		);
		expect(aus).toBe(
			[
				'<ol>',
				'<li>eins',
				'<ul>',
				'<li>a weiter</li>',
				'<li>b</li>',
				'</ul>',
				'<p>Absatz des Elternpunkts.</p></li>',
				'<li>zwei</li>',
				'</ol>'
			].join('\n')
		);
	});

	/**
	 * Die Form aus `docs/freigabe.md`: Fortsetzungszeilen um 6 eingerückt,
	 * Unterpunkte um 4. Massgebend ist deshalb der Einzug des Listenzeichens,
	 * nicht die Textspalte dahinter.
	 */
	it('verträgt Unterpunkte, die weniger eingerückt sind als die Fortsetzung', () => {
		const aus = html(
			['- [ ] Aussen', '      weiter', '    - [ ] Innen', '          weiter', '', '          Zweiter Absatz.', '- [ ] Nachbar'].join('\n')
		);
		expect(aus).toBe(
			[
				'<ul>',
				'<li class="aufgabe">Aussen weiter',
				'<ul>',
				'<li class="aufgabe">Innen weiter',
				'<p>Zweiter Absatz.</p></li>',
				'</ul></li>',
				'<li class="aufgabe">Nachbar</li>',
				'</ul>'
			].join('\n')
		);
	});

	it('beginnt beim Wechsel zwischen Nummer und Strich eine neue Liste', () => {
		const aus = html('1. eins\n- Strich');
		expect(aus).toBe('<ol>\n<li>eins</li>\n</ol>\n<ul>\n<li>Strich</li>\n</ul>');
	});

	it('macht aus einem Punkt, dessen Text mit einer Nummer beginnt, keine Unterliste', () => {
		expect(html('- 3. Dezember, Fortsetzung\n  folgt')).toBe(
			'<ul>\n<li>3. Dezember, Fortsetzung folgt</li>\n</ul>'
		);
	});
});

describe('was bleibt, wie es war', () => {
	it('rendert eine einzeilige Liste unverändert', () => {
		expect(html('- eins\n- **zwei**\n- drei')).toBe(
			'<ul>\n<li>eins</li>\n<li><strong>zwei</strong></li>\n<li>drei</li>\n</ul>'
		);
	});

	it('rendert einen offenen Aufgabenhaken unverändert', () => {
		expect(html('- [ ] offen')).toBe('<ul>\n<li class="aufgabe">offen</li>\n</ul>');
	});
});

describe('Aufgabenhaken', () => {
	// Bis zum 02.10.2026 sah ein erledigter Haken aus wie ein offener: Das
	// Skript rechnete das Kästchen aus und verwarf es.
	it('kennzeichnet einen erledigten Haken', () => {
		expect(html('- [x] erledigt')).toBe('<ul>\n<li class="aufgabe erledigt">erledigt</li>\n</ul>');
	});
});

describe('Nummerierung', () => {
	// Eine Liste, die nicht bei 1 beginnt, ist die zweite Hälfte einer
	// zerrissenen. Der erste Entwurf setzte dafür `start` und liess genau den
	// Fall durch, für den die Meldung gedacht ist.
	it('meldet eine Liste, die nicht bei 1 beginnt', () => {
		expect(rendern('3. drei\n4. vier').fehler).toHaveLength(1);
		expect(html('3. drei\n4. vier')).not.toContain('start=');
	});

	it('meldet eine Lücke, auch in einer Unterliste und im Zitat', () => {
		expect(rendern('1. eins\n3. drei').fehler).toHaveLength(1);
		expect(rendern('- aussen\n  1. eins\n  3. drei').fehler).toHaveLength(1);
		expect(rendern('> 1. eins\n> 3. drei').fehler).toHaveLength(1);
		expect(rendern('1. eins\n   weiter\n\n2. zwei\n3. drei').fehler).toEqual([]);
	});

	/**
	 * Die Meldung allein hält nichts auf. Geprüft wird deshalb der Bau selbst,
	 * an einer Kopie des Skripts mit eigenem `docs/`: Er muss abbrechen und die
	 * Stelle nennen.
	 */
	it('bricht den Bau an einer zerrissenen Liste ab', () => {
		const wurzel = realpathSync(mkdtempSync(join(tmpdir(), 'handbuchbau-')));
		try {
			mkdirSync(join(wurzel, 'scripts'));
			mkdirSync(join(wurzel, 'docs'));
			cpSync(join(process.cwd(), 'scripts', 'handbuch-bauen.mjs'), join(wurzel, 'scripts', 'handbuch-bauen.mjs'));
			const quelle = readFileSync(join(process.cwd(), 'scripts', 'handbuch-bauen.mjs'), 'utf8');
			const dateien = [...quelle.matchAll(/^\s+"([\w-]+\.md)",$/gm)].map((m) => m[1]);
			expect(dateien.length).toBeGreaterThan(0);
			for (const d of dateien) writeFileSync(join(wurzel, 'docs', d), '# Kapitel\n');
			writeFileSync(
				join(wurzel, 'docs', dateien[0]),
				'# Kapitel\n\n1. eins\n\nZeile ohne Einzug.\n\n2. zwei\n'
			);
			const lauf = spawnSync('node', [join(wurzel, 'scripts', 'handbuch-bauen.mjs')], { encoding: 'utf8' });
			expect(lauf.status).toBe(1);
			expect(lauf.stderr).toContain('beginnt nicht bei 1 oder zählt nicht durch');
			expect(lauf.stderr).toContain('trägt die Nummer 2, erwartet war 1');
		} finally {
			rmSync(wurzel, { recursive: true, force: true });
		}
	});

	/**
	 * Der Schutz am Dateiende baut nur beim direkten Aufruf. Vergleicht er die
	 * Pfade unaufgelöst, baut ein Aufruf über einen Symlink still nichts und
	 * endet mit 0: `check:handbuch` wäre grün, ohne geprüft zu haben.
	 */
	it('baut auch, wenn das Skript über einen Symlink aufgerufen wird', () => {
		const wurzel = realpathSync(mkdtempSync(join(tmpdir(), 'handbuchbau-')));
		try {
			mkdirSync(join(wurzel, 'echt', 'scripts'), { recursive: true });
			mkdirSync(join(wurzel, 'echt', 'docs'));
			const skript = join(process.cwd(), 'scripts', 'handbuch-bauen.mjs');
			cpSync(skript, join(wurzel, 'echt', 'scripts', 'handbuch-bauen.mjs'));
			const dateien = [...readFileSync(skript, 'utf8').matchAll(/^\s+"([\w-]+\.md)",$/gm)].map((m) => m[1]);
			for (const d of dateien) writeFileSync(join(wurzel, 'echt', 'docs', d), '# Kapitel\n');
			symlinkSync(join(wurzel, 'echt'), join(wurzel, 'umweg'));
			const lauf = spawnSync('node', [join(wurzel, 'umweg', 'scripts', 'handbuch-bauen.mjs')], { encoding: 'utf8' });
			// Die Sprungziele fehlen in den leeren Kapiteln, der Bau endet also
			// mit 1. Hier zählt nur, dass er gelaufen ist.
			expect(existsSync(join(wurzel, 'echt', 'static', 'handbuch', 'index.html'))).toBe(true);
			expect(lauf.stderr).toContain('Sprungziele');
		} finally {
			rmSync(wurzel, { recursive: true, force: true });
		}
	});
});
