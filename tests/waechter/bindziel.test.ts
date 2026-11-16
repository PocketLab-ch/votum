import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Der Gegentest zum Bindziel-Wächter (`scripts/check-bindziel.mjs`).
 *
 * **Warum er sein muss, und zwar dieser hier besonders.** Die erste Fassung des
 * Wächters war grün, während die defekte Zeile unverändert im Baum stand: Sie
 * lief über `jedesElement`, und das filtert auf `RegularElement` — Komponenten
 * lässt es ausdrücklich aus. Der Fehler stand an einer Komponente.
 *
 * Aufgefallen ist das nur, weil die Gegenprobe **am echten Fall** gefahren
 * wurde, nicht bloss an einem gebauten Beispiel. Beides steht deshalb hier: der
 * Fall an einer Komponente und der an einem Element.
 */
const SKRIPT = join(process.cwd(), 'scripts', 'check-bindziel.mjs');

function fahre(wurzel: string): { rot: boolean; ausgabe: string } {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

function baumMit(inhalt: string): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'bindziel-'));
	verzeichnisse.push(wurzel);
	mkdirSync(join(wurzel, 'src', 'routes'), { recursive: true });
	writeFileSync(join(wurzel, 'src', 'routes', '+page.svelte'), inhalt, 'utf8');
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('findet den schlechten Fall', () => {
	/**
	 * **Der Fall, um den es geht** — nachgebaut aus `Einlass.svelte` vor dem
	 * 29.08.2026. An einer **Komponente**, denn nur dort gibt es ein Prop mit
	 * Vorgabewert, und nur dort wirft Svelte.
	 */
	it('bind: an einer Komponente auf einen berechneten Zugriff', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<script lang="ts">
	let gewaehlt = $state<Record<string, string>>({});
	let meldungen = [{ id: 'a' }];
</script>
{#each meldungen as m (m.id)}
	<Suchauswahl name="partei" bind:wert={gewaehlt[m.id]} />
{/each}`)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('bind:wert={gewaehlt[m.id]}');
		expect(ausgabe).toContain('<Suchauswahl>');
	});

	it('bind: an einem gewöhnlichen Element auf einen berechneten Zugriff', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<script lang="ts">
	let felder = $state<Record<string, string>>({});
	let zeilen = [{ id: 'a' }];
</script>
{#each zeilen as z (z.id)}
	<input bind:value={felder[z.id]} />
{/each}`)
		);
		expect(rot).toBe(true);
		expect(ausgabe).toContain('bind:value={felder[z.id]}');
	});

	/**
	 * **Auch im `{:else}`-Zweig.** Vier Wächter waren dort schon einmal blind,
	 * weil `fallback` in der Baumsuche fehlte — ausgerechnet der Zweig, der die
	 * Bedienelemente für «keine Treffer» trägt.
	 */
	it('auch im Leerfall eines {#each}', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<script lang="ts">
	let felder = $state<Record<string, string>>({});
	let zeilen: { id: string }[] = [];
</script>
{#each zeilen as z (z.id)}
	<span>{z.id}</span>
{:else}
	<input bind:value={felder['leer']} />
{/each}`)
		);
		expect(rot).toBe(true);
		// **Rot allein genügt nicht**: Ein Absturz des Skripts wäre auch rot und
		// zählte sonst als Fund. Die Meldung muss den Fall benennen.
		expect(ausgabe).toContain("bind:value={felder['leer']}");
	});

	/**
	 * **`bind:this` ist kein Fall** (aus dem Code-Review). Es bindet eine
	 * Elementreferenz, hat keinen Vorgabewert und kann `props_invalid_value`
	 * nicht auslösen. Es in eine Liste zu schreiben ist gängig; der Wächter
	 * dürfte den Prüflauf nicht dagegen stellen.
	 */
	it('nimmt bind:this aus, auch auf einen Index', () => {
		const { rot } = fahre(
			baumMit(`<script lang="ts">
	let felder: HTMLInputElement[] = [];
	let zeilen = [{ id: 'a' }];
</script>
{#each zeilen as z, i (z.id)}
	<input bind:this={felder[i]} />
{/each}`)
		);
		expect(rot).toBe(false);
	});
});

describe('lässt den guten Fall in Ruhe', () => {
	/**
	 * Der wichtigere der beiden Tests: Ein Wächter, der im gewohnten Zustand rot
	 * ist, wird abgeschaltet statt gelesen.
	 */
	it('bind: auf eine gewöhnliche Variable', () => {
		const { rot, ausgabe } = fahre(
			baumMit(`<script lang="ts">
	let gewaehlt = $state('');
	let text = $state('');
</script>
<Suchauswahl name="partei" bind:wert={gewaehlt} />
<input bind:value={text} />`)
		);
		expect(rot).toBe(false);
		expect(ausgabe).toContain('in Ordnung');
	});

	it('bind: auf ein festes Feld eines Objekts', () => {
		const { rot } = fahre(
			baumMit(`<script lang="ts">
	let entwurf = $state({ titel: '' });
</script>
<input bind:value={entwurf.titel} />`)
		);
		expect(rot).toBe(false);
	});

	/**
	 * **Der Ausweg, den die Meldung nennt**: eine Zeilenkomponente, die ihren
	 * Wert selbst hält (`Zeilenauswahl.svelte`) und ihn nach oben meldet. Nennt
	 * die Meldung einen Weg, den der Wächter selbst beanstandet, führt sie im
	 * Kreis.
	 */
	it('der in der Meldung genannte Ausweg', () => {
		const { rot } = fahre(
			baumMit(`<script lang="ts">
	let gewaehlt = $state<Record<string, string>>({});
	let meldungen = [{ id: 'a' }];
</script>
{#each meldungen as m (m.id)}
	<Zeilenauswahl name="partei" beiWahl={(w) => (gewaehlt[m.id] = w)} />
{/each}`)
		);
		expect(rot).toBe(false);
	});

	/** Und die Komponente selbst: `bind:` auf ihre eigene Variable. */
	it('die Zeilenkomponente, die den Wert hält', () => {
		const { rot } = fahre(
			baumMit(`<script lang="ts">
	let wert = $state('');
</script>
<Suchauswahl name="partei" bind:wert />`)
		);
		expect(rot).toBe(false);
	});
});

/**
 * **Die Sichtprobe darf im guten Zustand nicht rot werden**, und im Repo muss
 * sie etwas zu prüfen haben. Der Lauf ohne Argument misst gegen das Repo.
 */
describe('die Sichtprobe', () => {
	/**
	 * **Ohne Argument fahren** (29.08.2026, aus dem Code-Review). Das Skript
	 * schaltet seine Schranke über `IM_REPO = !process.argv[2]` ab — ein Test,
	 * der `process.cwd()` übergibt, prüft die Sichtprobe also genau nicht. Sie
	 * lief nie, und das ist dieselbe Falle, die sie selbst verhindern soll.
	 */
	function imRepo(): { rot: boolean; ausgabe: string } {
		/*
		 * **Ohne Ausschalter** (04.09.2026, aus dem Code-Review): Diese Probe
		 * läuft über das echte Repo, nicht über einen Wegwerfbaum. Sie ist damit
		 * die einzige Stelle, an der eine zu hoch geratene Untergrenze auffiele —
		 * und mit abgeschalteter Reissleine fiele sie nicht auf. `fahreWaechter`
		 * ohne Wurzel lässt sie genau deshalb an.
		 */
		return fahreWaechter(SKRIPT);
	}

	/*
	 * **Eigene Zeitgrenze** (19.10.2026, unter Last gemessen): Die Probe fährt
	 * den Wächter als eigenen Node-Prozess über den ganzen Bestand. Ein Lauf ist
	 * das Minimum; schneller ginge es nur, indem man den Wächter nachbaut und
	 * damit genau nicht mehr prüft, was ausgeliefert wird. Zwei gleichzeitige
	 * Läufe der Nicht-DB-Suite brachten 5,3 beziehungsweise 5,6 s und rissen
	 * die Vorgabe von 5 s. Die 20 Sekunden lassen Luft, ohne einen hängenden
	 * Lauf zu verdecken.
	 */
	it('sieht im Repo genug Bindungen, auch die an Komponenten', { timeout: 20000 }, () => {
		const { rot, ausgabe } = imRepo();
		expect(rot).toBe(false);
		const gezaehlt = Number(/(\d+) bind:-Direktiven/.exec(ausgabe)?.[1] ?? 0);
		// Dieselbe Zahl wie die Schranke im Skript: Liefen sie auseinander, hielte
		// eine von beiden nichts. Mit `jedesElement` statt `jedenKnoten` fielen die
		// 30 Bindungen an Komponenten weg, und beide schlagen an.
		expect(gezaehlt).toBeGreaterThanOrEqual(100);
	});
});
