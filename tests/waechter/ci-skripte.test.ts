import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum CI-Skript-Wächter (`scripts/check-ci-skripte.mjs`).
 *
 * **Der Anlass** (14.10.2026): Die CI rief `check:layers` und `check:felder`,
 * die es seit Wochen nicht mehr gab, und war von Lauf #7 bis #465 auf `main`
 * rot. Der Hook war grün, weil er `npm run pruefen` fährt und nicht die Liste
 * der CI.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-ci-skripte.mjs');

const verzeichnisse: string[] = [];

function baum(workflow: string, skripte: Record<string, string> = { pruefen: 'true' }) {
	const wurzel = mkdtempSync(join(tmpdir(), 'ci-skripte-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, '.gitea', 'workflows'), { recursive: true });
	writeFileSync(join(wurzel, '.gitea', 'workflows', 'ci.yml'), workflow);
	writeFileSync(join(wurzel, 'package.json'), JSON.stringify({ scripts: skripte }));
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('Der CI-Skript-Wächter', () => {
	it('bleibt grün, wenn jedes aufgerufene Skript existiert', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT, baum('      - run: npm ci\n      - run: npm run pruefen\n'));
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/alle 1 Aufrufe/);
	});

	/*
	 * **Der Fall, um den es geht**, in der Form vom 14.10.2026: ein bestehendes
	 * Skript neben einem verschwundenen, in einer Zeile mit `&&`.
	 */
	it('wird rot und nennt das Skript, das es nicht gibt', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baum('        run: npm run check:layers && npm run pruefen\n')
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/1 von 2 Aufrufen/);
		expect(ausgabe).toContain('ci.yml:1  npm run check:layers');
	});

	it('liest auch «npm test»', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT, baum('      - run: npm test\n'));
		expect(rot).toBe(true);
		expect(ausgabe).toContain('npm run test');
	});

	/*
	 * Ein Kommentar darf vom alten Namen erzählen, ohne den Lauf rot zu machen;
	 * sonst müsste die Geschichte aus der Datei verschwinden.
	 */
	it('übergeht Kommentarzeilen', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baum('      # früher: npm run check:layers\n      - run: npm run pruefen\n')
		);
		expect(rot).toBe(false);
	});

	it('übergeht Kommentare am Zeilenende und Schrittnamen', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baum(
				'      - name: Prüflauf (npm run gibtsnicht)\n' +
					'        run: npm run pruefen  # früher npm run check:layers\n'
			)
		);
		expect(rot).toBe(false);
		expect(ausgabe).toMatch(/alle 1 Aufrufe/);
	});

	/*
	 * Eine Option vor dem Namen ist kein Skriptname: Sonst wäre
	 * `npm run --silent pruefen` rot und ein fehlendes Skript dahinter unsichtbar.
	 */
	it('liest den Namen hinter Optionen wie --silent', () => {
		const gut = fahreWaechter(SKRIPT, baum('        run: npm run --silent pruefen\n'));
		expect(gut.rot).toBe(false);
		const schlecht = fahreWaechter(SKRIPT, baum('        run: npm run --silent gibtsnicht\n'));
		expect(schlecht.rot).toBe(true);
		expect(schlecht.ausgabe).toContain('npm run gibtsnicht');
	});

	/*
	 * **Die Probe am echten Workflow.** Der Wächter misst nur, ob die Namen
	 * existieren. Dass die CI den ganzen Prüflauf fährt und nicht wieder eine
	 * eigene Auswahl, hält diese Zeile.
	 */
	it('der Workflow des Repos ruft den ganzen Prüflauf', () => {
		const ci = readFileSync(join(process.cwd(), '.gitea', 'workflows', 'ci.yml'), 'utf8');
		expect(ci).toMatch(/^\s+run: npm run pruefen\s*$/m);
	});
});
