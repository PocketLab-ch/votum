import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Themenfarbenwächter (`scripts/check-themenfarben.mjs`).
 *
 * **Der Fall, um den es geht** (Auftraggeber, 01.09.2026): «Bei der KI-Korrektur ist
 * beim Vorher-Text helle Schrift auf hellem Hintergrund.» Ursache war
 * `background: #fff` im Stilblock: Im dunklen Thema ist `--text` fast weiss.
 *
 * **Zwei Richtungen, beide hier.** Ein Wächter, der den schlechten Fall findet,
 * ist die eine Hälfte; dass er den guten in Ruhe lässt, die andere. Ein
 * Wächter, der auch die begründete Ausnahme rot macht, wird abgeschaltet statt
 * gelesen — und dann findet er gar nichts mehr.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-themenfarben.mjs');

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

/**
 * Ein Prüfbaum mit so vielen Dateien, dass die Sichtprobe des Wächters
 * («weniger als 50 Dateien gesehen») nicht anschlägt, und mit einer
 * begründeten Ausnahme, damit auch die zweite Sichtprobe erfüllt ist.
 */
function baumMit(inhalt: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'themenfarben-'));
	verzeichnisse.push(wurzel);
	const ordner = join(wurzel, 'src', 'routes');
	mkdirSync(ordner, { recursive: true });
	for (let i = 0; i < 60; i++) {
		writeFileSync(
			join(ordner, `fuellung${i}.svelte`),
			'<style>\n\t.x {\n\t\tcolor: var(--text);\n\t}\n</style>\n',
			'utf8'
		);
	}
	writeFileSync(
		join(ordner, 'ausnahme.svelte'),
		'<style>\n\t.qr {\n\t\t/* themenfest: Der QR-Code braucht Weiss. */\n\t\tbackground: #fff;\n\t}\n</style>\n',
		'utf8'
	);
	writeFileSync(join(ordner, '+page.svelte'), inhalt, 'utf8');
	/*
	 * **Zwei vollständige Themenblöcke** (02.09.2026). Der Wächter prüft seit
	 * heute auch, ob jedes Thema die Bedienelemente des Browsers mitschaltet;
	 * ohne diese Datei bräche jeder Prüfbaum an einer Frage, um die es in seiner
	 * Probe gar nicht geht.
	 */
	writeFileSync(join(wurzel, 'src', 'app.css'), THEMEN, 'utf8');
	return wurzel;
}

const THEMEN =
	":root[data-theme='light'] {\n\tcolor-scheme: light;\n\taccent-color: #2d5016;\n\t--text: #1a1a17;\n}\n" +
	":root[data-theme='dark'] {\n\tcolor-scheme: dark;\n\taccent-color: #a3c585;\n\t--text: #f0f0e8;\n}\n";

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Fall', () => {
	it('eine feste Fläche unter dem Text — genau der Befund des Auftraggebers', () => {
		const { rot, ausgabe } = fahre(
			baumMit('<style>\n\t.vorschlag {\n\t\tbackground: #fff;\n\t}\n</style>\n')
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('background: #fff');
	});

	it('eine Themenfarbe, die aus dem hellen Thema abgeschrieben wurde', () => {
		const { rot } = fahre(baumMit('<style>\n\t.hinweis {\n\t\tcolor: #8a4b00;\n\t}\n</style>\n'));
		expect(rot).toBe(true);
	});

	it('auch in rgb-Schreibweise und an einer eigenen Variablen', () => {
		expect(fahre(baumMit('<style>\n\t.a {\n\t\tcolor: rgb(20 20 20);\n\t}\n</style>\n')).rot).toBe(
			true
		);
		expect(fahre(baumMit('<style>\n\t.b {\n\t\t--eigen: #123456;\n\t}\n</style>\n')).rot).toBe(true);
	});

	/**
	 * **`background-image` gehört dazu.** Die erste Fassung des Ausdrucks kannte
	 * nur `background` und `background-color`; ein Verlauf mit festen Farben wäre
	 * durchgegangen (Code-Review 01.09.2026).
	 */
	it('auch ein Verlauf mit festen Farben', () => {
		const { rot } = fahre(
			baumMit(
				'<style>\n\t.c {\n\t\tbackground-image: linear-gradient(#fff, #eee);\n\t}\n</style>\n'
			)
		);
		expect(rot).toBe(true);
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	it('Farben aus den Token', () => {
		const { rot, ausgabe } = fahre(
			baumMit(
				'<style>\n\t.gut {\n\t\tbackground: var(--flaeche);\n\t\tcolor: var(--text);\n\t\tborder: 1px solid var(--linie);\n\t}\n</style>\n'
			)
		);
		expect(rot).toBe(false);
		expect(ausgabe).toContain('in Ordnung');
	});

	it('`transparent` und `currentColor` tragen keine eigene Farbe', () => {
		const { rot } = fahre(
			baumMit(
				'<style>\n\t.d {\n\t\tbackground: transparent;\n\t\tborder-color: currentColor;\n\t}\n</style>\n'
			)
		);
		expect(rot).toBe(false);
	});

	it('eine begründete Ausnahme', () => {
		const { rot } = fahre(
			baumMit(
				'<style>\n\t.e {\n\t\t/* themenfest: Das Kamerabild braucht Schwarz. */\n\t\tbackground: #000;\n\t}\n</style>\n'
			)
		);
		expect(rot).toBe(false);
	});

	/**
	 * **Wo die Token definiert werden, MÜSSEN Literale stehen.** Ausgenommen ist
	 * aber nur der Block, nicht die Datei: Ein Bausteinstil weiter unten in
	 * `app.css` wirkt auf jeder Seite und gehört geprüft.
	 */
	it('die Tokenblöcke in einer app.css, den Rest der Datei aber nicht', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			THEMEN + '\n.knopf {\n\tcolor: var(--text);\n}\n',
			'utf8'
		);
		expect(fahre(wurzel).rot).toBe(false);

		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			THEMEN + '\n.knopf {\n\tcolor: #1a1a17;\n}\n',
			'utf8'
		);
		const zweiter = fahre(wurzel);
		expect(zweiter.rot).toBe(true);
		expect(zweiter.ausgabe).toContain('app.css');
	});
});

describe('die Sichtproben', () => {
	/**
	 * **Ein Wächter, der über nichts läuft, ist immer grün** — und sieht von
	 * aussen genauso aus wie ein sauberer Baum. Diese Erfahrung hat in diesem
	 * Repo mehrere Wächter dauerhaft grün gehalten.
	 */
	it('meldet einen leeren Baum, statt ihn für sauber zu halten', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'themenfarben-leer-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src'), { recursive: true });
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('greift nicht');
	});

	it('meldet, wenn keine einzige Ausnahme mehr gefunden wird', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'themenfarben-ohne-'));
		verzeichnisse.push(wurzel);
		const ordner = join(wurzel, 'src', 'routes');
		mkdirSync(ordner, { recursive: true });
		for (let i = 0; i < 60; i++) {
			writeFileSync(
				join(ordner, `fuellung${i}.svelte`),
				'<style>\n\t.x {\n\t\tcolor: var(--text);\n\t}\n</style>\n',
				'utf8'
			);
		}
		// Ein vollständiger Baum: Der Wächter prüft seit dem 02.09.2026 auch die
		// Themenblöcke, und diese Probe zielt auf die Ausnahmen — nicht darauf.
		writeFileSync(join(wurzel, 'src', 'app.css'), THEMEN, 'utf8');
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('themenfest');
	});

	/*
	 * **Ein Thema, das die Bedienelemente nicht mitschaltet** (02.09.2026, Auftraggeber:
	 * «Bei der Hell-Mode sind die Checkbox und Auswahl-Bullets extrem dunkel»).
	 *
	 * Kästchen, Auswahlknöpfe, Datumsfelder und Rollbalken malt der Browser
	 * selbst. Ohne `color-scheme` richtet er sich nach dem Gerät statt nach der
	 * Seite: Bei dunklem System und heller Seite wurde das Kästchen ein
	 * schwarzer Block, im Browser nachgemessen.
	 */
	it('meldet ein Thema ohne color-scheme', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			":root[data-theme='light'] {\n\tcolor-scheme: light;\n\taccent-color: #2d5016;\n\t--text: #1a1a17;\n}\n" +
				":root[data-theme='dark'] {\n\taccent-color: #a3c585;\n\t--text: #f0f0e8;\n}\n",
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain("data-theme='dark'");
		expect(ausgabe).toContain('color-scheme fehlt');
	});

	/*
	 * **Der Wert muss zum Thema passen** (aus dem Code-Review). Das blosse
	 * Vorhandensein genügt nicht: Ein `color-scheme: dark` im hellen Thema ist
	 * genau der gemeldete Befund, nur mit umgekehrtem Vorzeichen — helle Seite,
	 * dunkle Bedienelemente.
	 */
	it('meldet ein color-scheme, das zum falschen Thema gehört', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			":root[data-theme='light'] {\n\tcolor-scheme: dark;\n\taccent-color: #2d5016;\n\t--text: #1a1a17;\n}\n" +
				":root[data-theme='dark'] {\n\tcolor-scheme: dark;\n\taccent-color: #a3c585;\n\t--text: #f0f0e8;\n}\n",
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/ist «dark», nennt aber nicht «light»/);
	});

	/*
	 * **Ein zweiter Block desselben Themas ist erlaubt** (aus dem Code-Review):
	 * eine Medienabfrage etwa, die ein paar Werte überschreibt. Verlangt wird,
	 * dass das Thema die Zeilen irgendwo hat — nicht in jedem seiner Blöcke.
	 */
	it('lässt ein Thema durch, das seine Zeilen in einem zweiten Block trägt', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			THEMEN + ":root[data-theme='dark'] {\n\t--text: #ffffff;\n}\n",
			'utf8'
		);
		expect(fahre(wurzel).rot).toBe(false);
	});

	it('meldet ein Thema ohne accent-color', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			":root[data-theme='light'] {\n\tcolor-scheme: light;\n\t--text: #1a1a17;\n}\n" +
				":root[data-theme='dark'] {\n\tcolor-scheme: dark;\n\taccent-color: #a3c585;\n\t--text: #f0f0e8;\n}\n",
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('accent-color fehlt');
	});

	/*
	 * **Eine fehlende `app.css` ist ein Befund, kein Absturz.** Der erste Anlauf
	 * las die Datei ohne Auffangnetz — heraus kam ein `ENOENT` statt eines
	 * Satzes, und die Prüfbäume der übrigen Proben brachen an einer Frage, um
	 * die es dort gar nicht ging.
	 */
	it('meldet eine fehlende app.css, statt abzustürzen', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'themenfarben-ohnecss-'));
		verzeichnisse.push(wurzel);
		const ordner = join(wurzel, 'src', 'routes');
		mkdirSync(ordner, { recursive: true });
		for (let i = 0; i < 60; i++) {
			writeFileSync(
				join(ordner, `f${i}.svelte`),
				'<style>\n\t.x {\n\t\tcolor: var(--text);\n\t}\n</style>\n',
				'utf8'
			);
		}
		writeFileSync(
			join(ordner, 'ausnahme.svelte'),
			'<style>\n\t.qr {\n\t\t/* themenfest: Der QR-Code braucht Weiss. */\n\t\tbackground: #fff;\n\t}\n</style>\n',
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('nicht lesbar');
		expect(ausgabe).not.toContain('ENOENT');
	});
});

describe('die Lücken der ersten Fassung', () => {
	/**
	 * **Eine `{` in einem Kommentar liess den Tokenblock nie schliessen** — und
	 * damit galt der ganze Rest von `app.css` als ausgenommen (Code-Review
	 * 01.09.2026, zweite Runde). Der Lauf war still grün.
	 */
	it('eine geschweifte Klammer in einem Kommentar hebelt die Ausnahme nicht aus', () => {
		const wurzel = baumMit('<style>\n\t.f {\n\t\tcolor: var(--text);\n\t}\n</style>\n');
		writeFileSync(
			join(wurzel, 'src', 'app.css'),
			":root[data-theme='light'] {\n" +
				'\tcolor-scheme: light;\n\taccent-color: #2d5016;\n' +
				'\t/* Ein Kommentar mit einer offenen Klammer { darin. */\n' +
				'\t--text: #1a1a17;\n}\n\n' +
				":root[data-theme='dark'] {\n\tcolor-scheme: dark;\n\taccent-color: #a3c585;\n\t--text: #f0f0e8;\n}\n\n" +
				'.knopf {\n\tcolor: #1a1a17;\n}\n',
			'utf8'
		);
		const { rot, ausgabe } = fahre(wurzel);
		expect(rot).toBe(true);
		/*
		 * **Auf den Befund prüfen, nicht auf «irgendwas mit app.css»** (aus dem
		 * Code-Review zur Themenblock-Regel). `toContain('app.css')` allein erfüllt
		 * auch die neue Meldung über einen Block ohne `color-scheme` — die Probe
		 * bliebe grün, während der bewachte Fehler zurück ist. Nachgestellt: Mit
		 * ausgehebeltem `ohneKommentare` meldete der Lauf «nur 1 Themenblock
		 * gefunden», Rückgabewert 1, und die alte Zusicherung sagte nichts dazu.
		 */
		expect(ausgabe).toContain('color: #1a1a17');
		expect(ausgabe).not.toContain('Themenblock');
	});

	/** **Der Wert auf der Folgezeile** wurde von der zeilenweisen Fassung nie gesehen. */
	it('ein Wert, der auf der nächsten Zeile steht', () => {
		const { rot } = fahre(
			baumMit('<style>\n\t.g {\n\t\tbox-shadow:\n\t\t\t0 2px 4px #123456;\n\t}\n</style>\n')
		);
		expect(rot).toBe(true);
	});

	/** **Die ganze Regel auf einer Zeile** — dasselbe Loch von der anderen Seite. */
	it('eine Regel, die auf einer einzigen Zeile steht', () => {
		const { rot } = fahre(baumMit('<style>\n\t.h { color: #abcdef; }\n</style>\n'));
		expect(rot).toBe(true);
	});

	it('und die Marke gilt auch bei mehrzeiligem Wert', () => {
		const { rot } = fahre(
			baumMit(
				'<style>\n\t.i {\n\t\t/* themenfest: Schatten aus durchscheinendem Schwarz. */\n\t\tbox-shadow:\n\t\t\t0 2px 4px rgb(0 0 0 / 0.2);\n\t}\n</style>\n'
			)
		);
		expect(rot).toBe(false);
	});
});
