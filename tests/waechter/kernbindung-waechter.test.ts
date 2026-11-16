import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fahreWaechter } from './waechterlauf';

/**
 * Der Gegentest zum Kernbindungswächter (`scripts/check-kernbindung.mjs`).
 *
 * **Die Regel selbst hat ihren eigenen Gegentest** in `kernbindung.test.ts`:
 * dort wird gemessen, ob sie eine fehlende Bindung erkennt. Hier geht es um
 * das Drumherum, und das ist die Hälfte, die in diesem Repo schon dreimal
 * still grün war: Findet der Wächter die Dateien? Liest er die Ausnahme an der
 * richtigen Stelle? Und lässt er den guten Zustand in Ruhe?
 *
 * **Der Baum wird erzeugt, nicht abgeschrieben.** Der Wächter hat Untergrenzen
 * (60 Dateien, 60 Funktionen mit Rahmen, 50 gebundene Felder), damit ein Lauf
 * über einen leeren oder halb gelesenen Baum nicht grün ist. Ein Gegentest mit
 * drei Dateien liefe deshalb in die Reissleine statt in die Regel — und ein
 * Gegentest, der die Reissleine für die Regel hält, misst nichts.
 */

const SKRIPT = join(process.cwd(), 'scripts', 'check-kernbindung.mjs');
const verzeichnisse: string[] = [];

/** Eine Kernfunktion, die ihre Kennung sauber an den Rahmen bindet. */
function gebunden(nr: number): string {
	return `export async function handle${nr}(handelnder, meetingId, id) {
	await tx\`DELETE FROM t WHERE id = \${id} AND meeting_id = \${meetingId}\`;
}
`;
}

/**
 * Legt einen Baum an, der die Untergrenzen erfüllt, und hängt die Dateien
 * daran, die der jeweilige Fall braucht.
 */
function baumMit(zusatz: Record<string, string> = {}): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'kernbindung-'));
	verzeichnisse.push(wurzel);
	const kerne = join(wurzel, 'src', 'lib', 'server');
	mkdirSync(kerne, { recursive: true });
	// Drei gebundene Funktionen genügen: `fahreWaechter` schaltet für einen
	// Wegwerfbaum `VERSAMMLUNG_REISSLEINE=aus`, und die Untergrenzen achten
	// darauf. Die Probe unten schaltet sie eigens wieder ein.
	for (let i = 0; i < 3; i += 1) {
		writeFileSync(join(kerne, `gut${i}.ts`), gebunden(i), 'utf8');
	}
	for (const [name, inhalt] of Object.entries(zusatz)) {
		writeFileSync(join(kerne, name), inhalt, 'utf8');
	}
	return wurzel;
}

afterEach(() => {
	while (verzeichnisse.length > 0) {
		rmSync(verzeichnisse.pop() as string, { recursive: true, force: true });
	}
});

describe('Der Kernbindungswächter', () => {
	it('lässt einen Baum in Ruhe, in dem alles gebunden ist', () => {
		const { rot, ausgabe } = fahreWaechter(SKRIPT, baumMit());
		expect(rot, ausgabe).toBe(false);
		expect(ausgabe).toMatch(/Kernbindung in Ordnung/);
	});

	it('findet eine Funktion, die den Rahmen entgegennimmt und nicht benutzt', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'schlecht.ts': `export async function loeschen(handelnder, meetingId, traktandumId) {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId}\`;
}
`
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/schlecht\.ts/);
		expect(ausgabe).toMatch(/loeschen/);
		expect(ausgabe).toMatch(/traktandumId/);
	});

	it('nimmt eine begründete Ausnahme an', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'ausnahme.ts': `/**
 * bindung: traktandumId — Die Liste kommt aus einer Abfrage über \`meetingId\`, und
 * \`find\` wählt daraus aus; eine fremde Kennung steht nicht darin.
 */
export async function loeschen(handelnder, meetingId, traktandumId) {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId}\`;
}
`
			})
		);
		expect(rot, ausgabe).toBe(false);
		expect(ausgabe).toMatch(/1 begründet ausgenommen/);
	});

	/**
	 * **Ohne Begründung ist es keine Ausnahme.** Eine Liste unbegründeter
	 * Freistellungen wächst, bis sie den Wächter aufhebt — dieselbe Überlegung
	 * wie beim Kennungswächter.
	 */
	it('nimmt eine Ausnahme ohne Begründung NICHT an', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'knapp.ts': `/**
 * bindung: traktandumId — passt schon
 */
export async function loeschen(handelnder, meetingId, traktandumId) {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId}\`;
}
`
			})
		);
		expect(rot).toBe(true);
	});

	/**
	 * **Auch die Pfeilfunktion ist eine Kernfunktion** (Sicherheitsprüfung
	 * 08.09.2026). Die erste Fassung des Wächters sah nur
	 * `ts.isFunctionDeclaration`; dieselbe ungebundene Löschung als
	 * `export const … = async (…) => {}` geschrieben wurde stillschweigend
	 * übergangen — weder gemeldet noch mitgezählt.
	 */
	it('findet auch eine ungebundene Pfeilfunktion', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'pfeil.ts': `export const loeschen = async (handelnder, meetingId, traktandumId) => {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId}\`;
};
`
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/pfeil\.ts/);
		expect(ausgabe).toMatch(/loeschen/);
	});

	/**
	 * **Die Ausnahme gilt dem Feld, nicht der Datei.** Sonst deckte eine
	 * Begründung jede weitere Kennung mit ab, die später dazukommt — der Fall,
	 * den website-94 am 07.09.2026 an ihrem eigenen Wächter vorgeführt hat.
	 */
	it('deckt mit einer Ausnahme nicht das zweite Feld mit ab', () => {
		const { rot, ausgabe } = fahreWaechter(
			SKRIPT,
			baumMit({
				'zweitfeld.ts': `/**
 * bindung: traktandumId — Die Liste kommt aus einer Abfrage über \`meetingId\`, und
 * \`find\` wählt daraus aus; eine fremde Kennung steht nicht darin.
 */
export async function loeschen(handelnder, meetingId, traktandumId, parteiId) {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId} AND p = \${parteiId}\`;
}
`
			})
		);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/parteiId/);
	});

	/**
	 * **Die Ausnahme steht an der Funktion, nicht irgendwo in der Datei.** Ein
	 * Wächter, der die ganze Datei nach dem Wort durchsucht, liesse sich mit
	 * einem Kommentar am Dateikopf stilllegen.
	 */
	it('nimmt eine Ausnahme nicht an, die an einer anderen Funktion steht', () => {
		const { rot } = fahreWaechter(
			SKRIPT,
			baumMit({
				'woanders.ts': `/**
 * bindung: traktandumId — Die Liste kommt aus einer Abfrage über \`meetingId\`, und
 * \`find\` wählt daraus aus; eine fremde Kennung steht nicht darin.
 */
export async function harmlos(handelnder, meetingId, traktandumId) {
	await tx\`SELECT 1 FROM t WHERE id = \${traktandumId} AND meeting_id = \${meetingId}\`;
}

export async function loeschen(handelnder, meetingId, traktandumId) {
	await tx\`DELETE FROM agenda_item WHERE id = \${traktandumId}\`;
}
`
			})
		);
		expect(rot).toBe(true);
	});

	/**
	 * **Die Untergrenzen, ohne den Testhelfer gemessen.**
	 *
	 * `fahreWaechter` setzt für einen Wegwerfbaum `VERSAMMLUNG_REISSLEINE=aus`,
	 * damit ein Gegentest an der Regel scheitert und nicht an der Dateizahl —
	 * und die Untergrenzen achten darauf. Wer sie prüfen will, muss den Wächter
	 * deshalb ohne diesen Schalter fahren. Ein anderer Wert als `aus` ist kein
	 * Ausweg: `pruefmenge.mjs` weist ihn ab, weil eine Schranke, die sich
	 * versehentlich abschalten lässt, keine ist.
	 */
	function ohneSchalter(wurzel: string): { rot: boolean; ausgabe: string } {
		const umgebung = { ...process.env };
		delete umgebung.VERSAMMLUNG_REISSLEINE;
		const lauf = spawnSync('node', [SKRIPT, wurzel], { encoding: 'utf8', env: umgebung });
		const ausgabe = `${lauf.stdout ?? ''}${lauf.stderr ?? ''}`;
		// Ein Absturz ist rot und belegt nichts — er darf nicht als Befund gelten.
		expect(ausgabe, 'Der Wächter ist abgestürzt').not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
		return { rot: lauf.status !== 0, ausgabe };
	}

	it('wird rot, wenn der Baum gar keine Serverdateien hat', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kernbindung-leer-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src', 'lib', 'server'), { recursive: true });
		const { rot, ausgabe } = ohneSchalter(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/Serverdateien/);
	});

	/**
	 * **Und die Schranke dahinter.** Genug Dateien, aber keine einzige Funktion
	 * mit Rahmen: Der Wächter hätte nichts zu prüfen und wäre grün. Diese Probe
	 * misst die zweite Untergrenze, die die erste nicht abdeckt.
	 */
	it('wird rot, wenn keine Funktion einen Rahmen trägt', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'kernbindung-ohne-rahmen-'));
		verzeichnisse.push(wurzel);
		const kerne = join(wurzel, 'src', 'lib', 'server');
		mkdirSync(kerne, { recursive: true });
		for (let i = 0; i < 70; i += 1) {
			writeFileSync(join(kerne, `leer${i}.ts`), `export function zahl${i}(a) {\n\treturn a;\n}\n`, 'utf8');
		}
		const { rot, ausgabe } = ohneSchalter(wurzel);
		expect(rot).toBe(true);
		expect(ausgabe).toMatch(/Funktionen mit Rahmen/);
	});
});
