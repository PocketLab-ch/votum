/**
 * Der Zeitgeber-Wrapper: Doppelstart und Ausschalter (V7).
 *
 * **Was hier geprüft wird und warum nicht mehr.** `starteZeitgeber()` hat genau
 * zwei Riegel, und beide sind unsichtbar, wenn man sie nur liest:
 *
 *   1. **Der Doppelstart.** Im Entwicklungsbetrieb wird `hooks.server.ts` beim
 *      Nachladen neu ausgewertet; eine Modulvariable wäre dann jedes Mal
 *      frisch, und nach zehn Änderungen liefen zehn Zeitgeber. Deshalb steht
 *      die Marke am globalen Objekt. Geprüft wird darum das Nachladen selbst:
 *      Modul vergessen, Modul neu laden, nochmals starten, es darf nur ein
 *      Satz Zeitgeber laufen.
 *   2. **Der Ausschalter.** `VERSAMMLUNG_ERINNERUNG=aus` verhindert den Start,
 *      ohne Neubau (docs/dienste.md gibt das zu). Geprüft wird, dass wirklich
 *      nichts geplant wird und auch nach Stunden nichts läuft.
 *
 * Der Zeitgeber ruft `erinnerungslauf()` auf; der ist hier durch eine Zählung
 * ersetzt, damit der Test ohne Datenbank auskommt. Alles andere, die Takte,
 * die Marke, der Env-Ausschalter, ist der echte Code aus
 * `$lib/server/zeitgeber`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Die Ersatz-Umgebung, aus der der Wrapper liest.
 *
 * `vi.hoisted`, weil `vi.mock`-Fabriken an den Dateianfang gehoben werden und
 * sonst auf noch nicht initialisierte Variablen zeigten. Ein Objekt statt
 * eines Literals in der Fabrik: So überlebt der Zustand `vi.resetModules()`
 * und der Test kann ihn von aussen stellen.
 */
const teile = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	erinnerungslauf: vi.fn()
}));

/*
 * SvelteKit stellt diese beiden Namensräume nur zur Laufzeit bereit; ausserhalb
 * davon sind sie nicht auflösbar. Der Ersatz ist die kleinste Fassung, die den
 * Wrapper trägt: `building` konstant falsch (der Test baut nichts), `env` das
 * stellbare Objekt oben.
 */
vi.mock('$app/environment', () => ({ building: false, browser: false, dev: true, version: 'test' }));
vi.mock('$env/dynamic/private', () => ({ env: teile.env }));
vi.mock('../../src/lib/server/einladungserinnerung', () => ({
	erinnerungslauf: teile.erinnerungslauf
}));

const MARKE = Symbol.for('versammlung.zeitgeber');
const STUNDE_MS = 60 * 60 * 1000;
/** Der Vorlauf beim Start, aus `zeitgeber.ts`: eine Minute. */
const VORLAUF_MS = 60 * 1000;

const erinnerungslauf = teile.erinnerungslauf;

/** Ein frisch geladenes Modul, wie nach einem HMR-Nachladen im Dev-Betrieb. */
async function frischesModul() {
	vi.resetModules();
	return await import('$lib/server/zeitgeber');
}

beforeEach(() => {
	vi.useFakeTimers();
	erinnerungslauf.mockReset();
	erinnerungslauf.mockResolvedValue({
		verschickt: 0,
		fehlgeschlagen: [],
		geprueft: 0,
		uebersprungen: []
	});
	delete (globalThis as unknown as Record<symbol, unknown>)[MARKE];
	for (const schluessel of Object.keys(teile.env)) delete teile.env[schluessel];
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	delete (globalThis as unknown as Record<symbol, unknown>)[MARKE];
});

describe('Zeitgeber', () => {
	it('plant genau einen Satz Zeitgeber, auch nach einem zweiten Start', async () => {
		const modul = await frischesModul();
		modul.starteZeitgeber();
		modul.starteZeitgeber(); // derselbe Modulstand, zweimal gerufen
		expect(vi.getTimerCount()).toBe(2); // ein Vorlauf, ein Takt

		await vi.advanceTimersByTimeAsync(VORLAUF_MS + 1000);
		expect(erinnerungslauf).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(STUNDE_MS);
		expect(erinnerungslauf).toHaveBeenCalledTimes(2);
	});

	it('bleibt ein Zeitgeber, wenn das Modul neu geladen wird (der Riegel am globalen Objekt)', async () => {
		/*
		 * **Das ist der eigentliche Doppelstart.** Nicht zwei Aufrufe auf
		 * demselben Modulstand sind im Dev-Betrieb das Problem, sondern das
		 * Nachladen: `hooks.server.ts` wird neu ausgewertet, das Modul ist
		 * frisch, und ohne die Marke am globalen Objekt liefe der Zeitgeber
		 * ein zweites Mal. Zehn Änderungen, zehn Zeitgeber.
		 */
		const erstes = await frischesModul();
		erstes.starteZeitgeber();

		const zweites = await frischesModul();
		zweites.starteZeitgeber();

		expect(vi.getTimerCount()).toBe(2);
		await vi.advanceTimersByTimeAsync(VORLAUF_MS + 1000);
		expect(erinnerungslauf).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(STUNDE_MS);
		expect(erinnerungslauf).toHaveBeenCalledTimes(2);
	});

	it('startet mit VERSAMMLUNG_ERINNERUNG=aus gar nicht', async () => {
		teile.env.VERSAMMLUNG_ERINNERUNG = 'aus';
		const modul = await frischesModul();
		modul.starteZeitgeber();

		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(3 * STUNDE_MS);
		expect(erinnerungslauf).not.toHaveBeenCalled();
	});

	it('verträgt Leerraum um den Schalterwert', async () => {
		// Die Compose-Datei reicht « aus » unverändert durch; `.trim()` im
		// Wrapper gehört dazu, sonst wirkt der dokumentierte Ausschalter nicht.
		teile.env.VERSAMMLUNG_ERINNERUNG = ' aus ';
		const modul = await frischesModul();
		modul.starteZeitgeber();

		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(2 * STUNDE_MS);
		expect(erinnerungslauf).not.toHaveBeenCalled();
	});

	it('nimmt einen gescheiterten Lauf nicht mit', async () => {
		/*
		 * Der Lauf hängt an der Datenbank und am Mailausgang; beides kann
		 * fehlen. Ein Fehler darf den Dienst nicht mitnehmen und den nächsten
		 * Takt nicht verhindern, sonst stünde die Erinnerung dauerhaft still,
		 * ohne dass es jemandem auffiele.
		 */
		/*
		 * Der Takt allein beweist das nicht: `setInterval` feuert auch nach
		 * einem Fehler weiter. Ohne den Fang in `lauf()` fiele der Test nur
		 * über die Erkennung unbehandelter Ablehnungen. Deshalb wird der Fang
		 * selbst zugesichert, und seine Meldung landet nicht im Prüflauf.
		 */
		const meldung = vi.spyOn(console, 'error').mockImplementation(() => {});
		erinnerungslauf.mockRejectedValueOnce(new Error('Datenbank weg'));
		const modul = await frischesModul();
		modul.starteZeitgeber();

		await vi.advanceTimersByTimeAsync(VORLAUF_MS + 1000);
		expect(erinnerungslauf).toHaveBeenCalledTimes(1);
		expect(meldung).toHaveBeenCalledWith('Der Erinnerungslauf ist gescheitert:', expect.any(Error));

		await vi.advanceTimersByTimeAsync(STUNDE_MS);
		expect(erinnerungslauf).toHaveBeenCalledTimes(2);
	});
});
