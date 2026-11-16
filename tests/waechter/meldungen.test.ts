/**
 * Der Gegentest zum Meldungswächter (`scripts/check-meldungen.mjs`).
 *
 * **Warum er sein muss.** Der Wächter liest einen Syntaxbaum und läuft über
 * Bedingungen. Greift eine Abfrage daneben, findet er nichts und ist damit
 * **immer grün**, und zwar lautlos. Dazu kommt hier eine zweite Falle: Was er
 * bewacht — wegdrückbar, rollt sich ins Bild, wandert in den Einblender — sieht
 * man einer Seite beim Ausprobieren nicht an, solange nichts schiefgeht.
 *
 * Geprüft wird deshalb beides: dass er den Fall findet, für den er gebaut ist,
 * **und** dass er die drei Fälle in Ruhe lässt, die keine sind. Ein Wächter, der
 * zu viel meldet, wird abgeschaltet — und dann fehlt auch der Teil, der stimmt.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { fahreWaechter } from './waechterlauf';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKRIPT = join(process.cwd(), 'scripts', 'check-meldungen.mjs');

/**
 * **Ein Absturz ist kein Befund.** Rückgabewert 1 kommt auch von einer
 * geworfenen Ausnahme; ein Fall, der nur `rot === true` prüft, hielte einen
 * abgestürzten Wächter für einen findenden (Erfahrung 28.08.2026 beim
 * Fokusmarken-Test).
 *
 * **Die Erkenntnis stand hier, die Umsetzung widersprach ihr** (05.09.2026):
 * Getrennt wurde über `f.status !== 1` — und genau die geworfene Ausnahme, um
 * die es geht, endet in Node mit `1`. Nachgemessen mit einem absichtlich
 * abstürzenden Wächter. Die Trennung liegt jetzt in `waechterlauf.ts` und geht
 * über die Stapelspur im Text; sie **wirft**, statt einen Wert zu liefern, den
 * eine Prüfung übersehen könnte.
 */
function fahre(wurzel: string) {
	return fahreWaechter(SKRIPT, wurzel);
}

const verzeichnisse: string[] = [];

/**
 * Ein Wegwerfbaum mit genug Dateien, damit die Sichtproben halten: mindestens
 * 50 gelesene Dateien, mindestens eine `class="meldung"`, mindestens eine
 * Verwendung der Komponente.
 */
function baumMit(dateien: Record<string, string>): string {
	const wurzel = mkdtempSync(join(tmpdir(), 'meldungen-'));
	verzeichnisse.push(wurzel);

	const alle: Record<string, string> = {
		'src/lib/components/Meldung.svelte':
			'<p class="meldung {ton}" tabindex="-1"><slot /></p>\n',
		'src/routes/gut/+page.svelte':
			'<script>let { form } = $props();\n' +
			"import Meldung from '$lib/components/Meldung.svelte';</script>\n" +
			'{#if form?.gespeichert}<Meldung ton="gut" marke={form}>Gespeichert.</Meldung>{/if}\n',
		/*
		 * **Ein Dauerhinweis mit FESTER Klasse gehört in jeden Baum.** Die
		 * Sichtprobe «benutzt überhaupt noch jemand die Klasse?» zählt nur feste
		 * Werte — `class="meldung {ton}"` in der Komponente selbst ist ein
		 * Ausdruck und zählt nicht mit. Ohne diese Datei brach der Grundfall an
		 * der Sichtprobe ab, und der Test hätte den Wächter für kaputt gehalten,
		 * obwohl er richtig arbeitete.
		 */
		'src/routes/hinweis/+page.svelte':
			'<script>let { data } = $props();</script>\n' +
			'{#if data.abend}<p class="meldung warnung">Gehört zu einem Abend.</p>{/if}\n',
		...dateien
	};
	// Füllmaterial, damit «greift der Lauf?» zufrieden ist.
	for (let i = 0; i < 60; i++) alle[`src/routes/f${i}/+page.svelte`] = '<p>nichts</p>\n';

	for (const [weg, inhalt] of Object.entries(alle)) {
		const ziel = join(wurzel, weg);
		mkdirSync(join(ziel, '..'), { recursive: true });
		writeFileSync(ziel, inhalt);
	}
	return wurzel;
}

afterEach(() => {
	for (const v of verzeichnisse.splice(0)) rmSync(v, { recursive: true, force: true });
});

describe('Der Meldungswächter', () => {
	it('ist grün, wo jede Handlungsmeldung die Komponente ist', () => {
		const e = fahre(baumMit({}));
		expect(e.rot, e.ausgabe).toBe(false);
		expect(e.ausgabe).toContain('in Ordnung');
	});

	/* **Der Fall, um den es geht** — neunmal auf der Reglementseite gefunden. */
	it('findet einen blanken Absatz an einer Serverantwort', () => {
		const e = fahre(
			baumMit({
				'src/routes/schlecht/+page.svelte':
					'<script>let { form } = $props();</script>\n' +
					'{#if form?.gespeichert}<p class="meldung gut" role="status">Gespeichert.</p>{/if}\n'
			})
		);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('schlecht/+page.svelte');
		expect(e.ausgabe).toContain('form?.gespeichert');
	});

	/* **Auch tief verschachtelt**: Die Bedingung steht oft weit über der Zeile. */
	it('findet ihn auch drei Blöcke tief', () => {
		const e = fahre(
			baumMit({
				'src/routes/tief/+page.svelte':
					'<script>let { form, data } = $props();</script>\n' +
					'{#if form?.hinweis}\n<section>\n{#if data.a}\n<div>\n' +
					'<p class="meldung gut">Gespeichert.</p>\n</div>\n{/if}\n</section>\n{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(true);
		expect(e.ausgabe).toContain('tief/+page.svelte');
	});

	/*
	 * **Ein Dauerhinweis ist kein Befund.** Er steht beim Laden schon da, hat
	 * nichts wegzudrücken und gehört nicht in den Einblender. Ohne diese
	 * Abgrenzung meldete der Wächter 53 statt 26 Stellen und wäre abgeschaltet
	 * worden.
	 */
	it('lässt einen Hinweis aus `data` in Ruhe', () => {
		const e = fahre(
			baumMit({
				'src/routes/dauer/+page.svelte':
					'<script>let { data } = $props();</script>\n' +
					'{#if data.gemeinsam}<p class="meldung warnung">Gehört zu einem Abend.</p>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(false);
	});

	it('lässt eine Meldung ganz ohne Bedingung in Ruhe', () => {
		const e = fahre(
			baumMit({ 'src/routes/immer/+page.svelte': '<p class="meldung warnung">Steht immer.</p>\n' })
		);
		expect(e.rot, e.ausgabe).toBe(false);
	});

	/*
	 * **Blockinhalt gehört nicht in ein `<p>`.** Die Komponente rendert einen
	 * Absatz; ein `<form>` oder `<ul>` darin ist ungültiges HTML, und der Browser
	 * zerlegt die Meldung sichtbar. Fünf Stellen im Bestand sind so gebaut.
	 */
	it('lässt eine Meldung mit einem Formular darin in Ruhe', () => {
		const e = fahre(
			baumMit({
				'src/routes/rueckfrage/+page.svelte':
					'<script>let { form } = $props();</script>\n' +
					'{#if form?.frage}<div class="meldung frage"><p>{form.frage}</p>\n' +
					'<form method="POST"><button type="submit">Ja</button></form></div>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(false);
	});

	/*
	 * **Aber die Schreibweise allein rettet nicht.** Sonst genügte ein `<div>`
	 * statt `<p>`, um die Regel loszuwerden — und die Meldung verlöre still
	 * alles, was die Komponente kann.
	 */
	it('findet ein `div` mit blossem Text trotzdem', () => {
		const e = fahre(
			baumMit({
				'src/routes/getarnt/+page.svelte':
					'<script>let { form } = $props();</script>\n' +
					'{#if form?.gespeichert}<div class="meldung gut">Gespeichert.</div>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(true);
		expect(e.ausgabe).toContain('getarnt/+page.svelte');
	});

	/*
	 * **Der `{:else}`-Zweig erbt die Bedingung NICHT** (aus dem Code-Review).
	 *
	 * Der erste Anlauf hängte den `if`-Test auch an `alternate`. Damit galt
	 * `{#if form?.bericht} … {:else if data.absage}` als Handlungsmeldung, obwohl
	 * die Absage über die **Adresse** zurückkommt. Zwei Stellen im Bestand sind
	 * daraufhin falsch umgebaut worden, bevor es auffiel.
	 */
	it('hält den else-Zweig einer form-Bedingung für keinen Befund', () => {
		const e = fahre(
			baumMit({
				'src/routes/kette/+page.svelte':
					'<script>let { form, data } = $props();</script>\n' +
					'{#if form?.bericht}<p>Bericht</p>\n' +
					'{:else if data.absage}<p class="meldung warnung">{data.absage}</p>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(false);
	});

	/*
	 * **Eine Klasse aus einem Ausdruck ist keine Tarnkappe** (aus dem
	 * Code-Review). `festerWert` liefert dort `null`; der erste Anlauf liess
	 * beide Formen durch die Regel und durch die Sichtprobe fallen.
	 */
	it('findet eine Klasse, die als Ausdruck geschrieben ist', () => {
		const e = fahre(
			baumMit({
				'src/routes/ausdruck/+page.svelte':
					'<script>let { form } = $props();</script>\n' +
					'{#if form?.gespeichert}<p class={"meldung gut"}>Gespeichert.</p>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(true);
		expect(e.ausgabe).toContain('ausdruck/+page.svelte');
	});

	/*
	 * **Eine Kindkomponente befreit nicht** (aus dem Code-Review). Der erste
	 * Anlauf liess jede durch — ein Zeichen im Text sagt aber nichts darüber, ob
	 * der Baustein hingehört.
	 */
	it('findet eine Meldung mit einem Zeichen darin trotzdem', () => {
		const e = fahre(
			baumMit({
				'src/routes/zeichen/+page.svelte':
					'<script>let { form } = $props();\n' +
					"import Symbol from '$lib/components/Symbol.svelte';</script>\n" +
					'{#if form?.gespeichert}<p class="meldung gut"><Symbol />Gespeichert.</p>{/if}\n'
			})
		);
		expect(e.rot, e.ausgabe).toBe(true);
		expect(e.ausgabe).toContain('zeichen/+page.svelte');
	});

	/* **Die drei Sichtproben** — ohne sie wäre ein blinder Wächter grün. */
	it('bricht ab, wenn er kaum Dateien liest', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'meldungen-'));
		verzeichnisse.push(wurzel);
		mkdirSync(join(wurzel, 'src'), { recursive: true });
		writeFileSync(join(wurzel, 'src', 'eine.svelte'), '<p>nichts</p>\n');
		const e = fahre(wurzel);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('greift nicht');
	});

	it('bricht ab, wenn niemand mehr die Klasse benutzt', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'meldungen-'));
		verzeichnisse.push(wurzel);
		for (let i = 0; i < 60; i++) {
			const ziel = join(wurzel, `src/routes/f${i}/+page.svelte`);
			mkdirSync(join(ziel, '..'), { recursive: true });
			writeFileSync(ziel, '<p>nichts</p>\n');
		}
		const e = fahre(wurzel);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('keine einzige');
	});

	it('bricht ab, wenn die Komponente nirgends mehr benutzt wird', () => {
		const wurzel = mkdtempSync(join(tmpdir(), 'meldungen-'));
		verzeichnisse.push(wurzel);
		for (let i = 0; i < 60; i++) {
			const ziel = join(wurzel, `src/routes/f${i}/+page.svelte`);
			mkdirSync(join(ziel, '..'), { recursive: true });
			writeFileSync(ziel, '<p>nichts</p>\n');
		}
		const m = join(wurzel, 'src/lib/components/Meldung.svelte');
		mkdirSync(join(m, '..'), { recursive: true });
		writeFileSync(m, '<p class="meldung">nur die Klasse, keine Verwendung</p>\n');
		const e = fahre(wurzel);
		expect(e.rot).toBe(true);
		expect(e.ausgabe).toContain('keinen Sollzustand');
	});
});
