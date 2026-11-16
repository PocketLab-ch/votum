/**
 * Der Wächter über die Wächter: Greift jede Reissleine wirklich?
 *
 * **Warum es diesen Test gibt.** Eine Reissleine ist selbst ein Wächter und
 * braucht dieselbe Probe wie jeder andere: Ein leerer Baum muss den Lauf
 * **nachweislich** rot machen, nicht bloss laut Code. Ohne diese Probe hätte
 * der Umbau vom 04.09.2026 nur stille Wächter durch stille Wächter ersetzt.
 *
 * **Und warum er über alle auf einmal läuft.** Aus dem Austausch mit einer
 * Nachbarsitzung, die denselben Umbau gemacht hat: Sie hatte die Falle mit der
 * leeren Angabe (`??` greift bei der leeren Zeichenkette nicht) tags zuvor
 * selbst gefunden, beschrieben — und in der Datei daneben nicht behoben. Eine
 * Fehlerklasse bleibt nur dort geschlossen, wo man beim Schliessen hingesehen
 * hat; sie wandert nicht von selbst zum Nachbarn. Deshalb sammelt dieser Test
 * die Wächter aus dem Verzeichnis, statt sie aufzuzählen: Ein neuer Wächter
 * kommt automatisch unter dieselbe Probe.
 *
 * **Was er nicht prüft.** Ob die Untergrenze eines Wächters gut *gewählt* ist.
 * Ein Wächter, der 422 Dateien liest und eine Grenze von 1 hätte, wäre hier
 * grün und bemerkte den Verlust von 421 Dateien trotzdem nicht. Die Grenzen
 * sind beim Bau gemessen und liegen bei rund 70 Prozent des Bestands; das ist
 * eine Entscheidung, keine Zusicherung.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPTE = join(process.cwd(), 'scripts');

/**
 * Woran ein Absturz zu erkennen ist, im Unterschied zu einer Meldung.
 *
 * Beides endet mit Rückgabewert 1, also trennt sie nur der Text: eine
 * Stapelspur von Node, ein fehlendes Modul, ein nackter Dateisystemfehler.
 * Ein Wächter, der so endet, ist rot aus Versehen und sagt gerade nicht, dass
 * er nichts mehr zu prüfen hat.
 */
const STAPELSPUR = /ENOENT|Cannot find module|^\s+at .+:\d+:\d+$|node:internal/m;

function fahre(skript: string, wurzel: string, env: Record<string, string> = {}, cwd?: string) {
	/*
	 * Der Schalter wird **gelöscht**, nicht leer gesetzt (04.09.2026, aus dem
	 * Code-Review). Die leere Zeichenkette ist selbst ein ungültiger Wert und
	 * beendet den Lauf mit Rückgabewert 2 im Ausschalter — **bevor** die
	 * Untergrenze überhaupt zählt. Sechs von vierzehn Prüfungen waren so
	 * erfüllt, ohne dass die Reissleine gelaufen wäre: Der Test, der zahnlose
	 * Wächter finden soll, war an dieser Stelle selbst zahnlos.
	 */
	const umgebung = { ...process.env, ...env };
	if (!('VERSAMMLUNG_REISSLEINE' in env)) delete umgebung.VERSAMMLUNG_REISSLEINE;
	try {
		const text = execFileSync('node', [join(SKRIPTE, skript), wurzel], {
			encoding: 'utf8',
			env: umgebung,
			...(cwd ? { cwd } : {})
		});
		return { code: 0, text };
	} catch (fehler) {
		const f = fehler as { status?: number; stdout?: string; stderr?: string };
		/*
		 * `?? -1`, nicht `?? 1` (04.09.2026, aus dem Code-Review): Ein per Signal
		 * beendeter Kindprozess hat gar keinen Status, und die 1 ist hier der
		 * Nachweis. Bei fünfundvierzig Node-Starts je Lauf wäre ein SIGKILL sonst
		 * ein bestandener Test.
		 */
		return { code: f.status ?? -1, text: `${f.stdout ?? ''}${f.stderr ?? ''}` };
	}
}

/**
 * Ein leerer Baum mit allen Verzeichnissen, die ein Wächter erwarten könnte.
 *
 * Die Verzeichnisse existieren mit Absicht: Ein Wächter, der an einem
 * **fehlenden** Ordner abstürzt, ist zufällig rot. Geprüft werden soll, ob er
 * bei einem vorhandenen, aber leeren Ordner rot wird — das ist der Fall, der
 * im Betrieb vorkommt, wenn etwas verschoben oder umbenannt wurde.
 */
const ORDNER = [
	'src',
	'src/lib',
	'src/lib/components',
	'src/lib/server',
	'src/routes',
	'scripts',
	'e2e',
	'docs',
	'tests',
	'migrations',
	'static'
];

function leererBaum(ohneOrdner = false): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'reissleine-'));
	if (!ohneOrdner) for (const ordner of ORDNER) mkdirSync(join(wurzel, ordner), { recursive: true });
	writeFileSync(join(wurzel, 'README.md'), '# leer\n');
	return wurzel;
}

const ALLE = readdirSync(SKRIPTE)
	.filter((n) => n.startsWith('check-') && n.endsWith('.mjs'))
	.sort();

const liest = (n: string) => readFileSync(join(SKRIPTE, n), 'utf8');

/** Wächter, die eine Wurzel als Argument annehmen. */
const MIT_WURZEL = ALLE.filter((n) => liest(n).includes('process.argv[2]'));

/**
 * Wächter **ohne** Wurzelargument: Sie prüfen immer `process.cwd()`.
 *
 * Der erste Entwurf dieses Tests hat sie übersprungen, und genau die vier, die
 * in diesem Block eine Reissleine bekamen, fielen dadurch heraus (04.09.2026,
 * aus dem Code-Review). Prüfbar sind sie trotzdem: nicht über ein Argument,
 * das sie ignorieren, sondern indem der Lauf in einem leeren Verzeichnis
 * **startet**.
 */
const OHNE_WURZEL = ALLE.filter((n) => !liest(n).includes('process.argv[2]'));

describe('Jede Reissleine greift', () => {
	/*
	 * Wäre diese Liste leer, liefe die Schleife darunter durch und der Test
	 * meldete grün, ohne einen einzigen Wächter geprüft zu haben — genau die
	 * Klasse, gegen die er steht.
	 */
	it('findet überhaupt Wächter mit Wurzelargument', () => {
		expect(MIT_WURZEL.length).toBeGreaterThanOrEqual(10);
	});

	for (const skript of MIT_WURZEL) {
		it(`${skript} wird über einem leeren Baum rot`, () => {
			const wurzel = leererBaum();
			try {
				const { code, text } = fahre(skript, wurzel);
				/*
				 * Rückgabewert 1, nicht bloss «ungleich 0»: Die 2 steht für einen
				 * falsch gesetzten Ausschalter, und die zählt hier nicht als Erfolg.
				 * Sonst belegt der Test einen anderen Abbruch als den gemeinten.
				 */
				expect(code, `${skript} meldete «${text.trim().slice(0, 90)}»`).toBe(1);
				/*
				 * **Die 1 allein genügt nicht** (04.09.2026, aus dem vierten
				 * Code-Review). Jeder Absturz endet ebenfalls mit 1: ein nackter
				 * `ENOENT`, aber auch ein falsch geschriebener Skriptpfad
				 * («Cannot find module»). Ohne eine Probe am **Text** wäre jede
				 * ENOENT-Korrektur dieses Blocks ungedeckt, und ein Tippfehler im
				 * Pfad liesse den ganzen Test grün durchlaufen.
				 */
				expect(text, `${skript} stürzte ab, statt zu melden`).not.toMatch(STAPELSPUR);
			} finally {
				rmSync(wurzel, { recursive: true, force: true });
			}
		});
	}
});

describe('Auch die Wächter ohne Wurzelargument greifen', () => {
	it('findet überhaupt welche', () => {
		expect(OHNE_WURZEL.length).toBeGreaterThanOrEqual(5);
	});

	for (const skript of OHNE_WURZEL) {
		it(`${skript} wird aus einem leeren Arbeitsverzeichnis rot`, () => {
			const wurzel = leererBaum();
			try {
				const { code, text } = fahre(skript, wurzel, {}, wurzel);
				// Wie oben die 1, nicht bloss «ungleich 0»: Gemessen geben alle elf
				// genau 1, und `not.toBe(0)` nähme jeden Ausgang ausser Erfolg als
				// Erfolg der Probe.
				expect(code, `${skript} meldete «${text.trim().slice(0, 90)}»`).toBe(1);
				expect(text, `${skript} stürzte ab, statt zu melden`).not.toMatch(STAPELSPUR);
				/*
				 * Ein nackter ENOENT wäre auch «nicht 0», aber rot aus Versehen: Er
				 * sagt nicht, dass der Wächter nichts mehr zu prüfen hat. Vier
				 * Wächter waren am 04.09.2026 genau so «abgesichert».
				 */
				expect(text).not.toContain('ENOENT');
			} finally {
				rmSync(wurzel, { recursive: true, force: true });
			}
		});
	}
});

describe('Auch ein fehlendes Verzeichnis gibt eine Meldung', () => {
	/*
	 * Der leere Baum oben legt die Ordner an. Damit bleibt der zweite Fall
	 * ungeprüft: das Verzeichnis ist gar nicht da (04.09.2026, aus dem dritten
	 * Code-Review). Genau daran stürzten Wächter mit einem nackten `ENOENT` ab,
	 * und das ist rot aus Versehen, nicht aus Einsicht.
	 */
	for (const skript of MIT_WURZEL) {
		it(`${skript} meldet statt abzustürzen, wenn nichts da ist`, () => {
			const wurzel = leererBaum(true);
			try {
				const { code, text } = fahre(skript, wurzel);
				// Auch hier der genaue Wert: gemessen geben alle vierzehn 1.
				expect(code, `${skript} meldete «${text.trim().slice(0, 90)}»`).toBe(1);
				expect(text, `${skript} stürzte ab, statt zu melden`).not.toContain('ENOENT');
			} finally {
				rmSync(wurzel, { recursive: true, force: true });
			}
		});
	}
});

describe('Der Ausschalter der Reissleine', () => {
	const skript = 'check-zeitzone.mjs';

	it('lässt den Lauf durch, wenn er ausdrücklich auf «aus» steht', () => {
		const wurzel = leererBaum();
		try {
			expect(fahre(skript, wurzel, { VERSAMMLUNG_REISSLEINE: 'aus' }).code).toBe(0);
		} finally {
			rmSync(wurzel, { recursive: true, force: true });
		}
	});

	for (const wert of ['', 'ein', 'AUS', '1', 'off']) {
		it(`weist «${wert}» ab, statt sich davon abschalten zu lassen`, () => {
			/*
			 * Der leere Wert ist der wichtigste Fall: `??` greift bei der leeren
			 * Zeichenkette nicht, und so verschwindet eine Schranke lautlos. Ein
			 * Tippfehler im Ausschalter darf nicht wie ein Ausschalter wirken.
			 */
			const wurzel = leererBaum();
			try {
				const { code, text } = fahre(skript, wurzel, { VERSAMMLUNG_REISSLEINE: wert });
				/*
				 * Geprüft wird die **Absage des Ausschalters**, nicht die 2 an sich
				 * (04.09.2026, aus dem vierten Code-Review). Der Rückgabewert hängt
				 * daran, dass `check-zeitzone` keinen Vorlauf vor `mindestens()` hat;
				 * bekäme er einen nach dem Hausmuster, wie ihn vier andere Wächter
				 * haben, käme 1 statt 2 und alle fünf Fälle würden rot, obwohl der
				 * Ausschalter tut, was er soll. Der Text sagt es unabhängig davon.
				 */
				expect(code, `«${wert}» ergab ${code}: ${text.trim().slice(0, 80)}`).not.toBe(0);
				expect(text, `«${wert}» wurde nicht als ungültig abgewiesen`).toContain(
					'Erlaubt ist allein'
				);
			} finally {
				rmSync(wurzel, { recursive: true, force: true });
			}
		});
	}

	it('meldet einen ungültigen Wert eigens, statt ihn als Befund auszugeben', () => {
		// Rückgabewert 2 trennt «der Ausschalter ist falsch gesetzt» von
		// «der Wächter hat etwas gefunden» (1). Sonst sucht jemand einen Befund,
		// der keiner ist.
		const wurzel = leererBaum();
		try {
			const { code, text } = fahre(skript, wurzel, { VERSAMMLUNG_REISSLEINE: 'ein' });
			expect(code).toBe(2);
			expect(text).toContain('Erlaubt ist allein');
		} finally {
			rmSync(wurzel, { recursive: true, force: true });
		}
	});
});
