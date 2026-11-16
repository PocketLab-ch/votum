/**
 * Die Bestimmung zur Einlage in den Erneuerungsfonds an den Seiten (Migration
 * 193, Fassung 2026-11-18; Featureprüfung Erneuerungsfonds, Kriterium 4 und 7).
 *
 * **Warum ein Wächter über den Quelltext.** Der Kern ist geprüft
 * (`tests/domain/fondsgrenze.test.ts`), die Verdrahtung in den Seiten nicht:
 * Strich jemand den Satz aus einer Leitungsseite oder den Parameter an
 * `mehrhinweise`, blieb jeder Test grün, und der Durchstich
 * (`e2e/durchspielen.mjs`) läuft nur gegen den Dev-Stapel. Die Probe hier ist
 * schwächer als ein Lauf durch die Seite, aber sie wird rot, wenn eine
 * Anzeigestelle fehlt.
 *
 * **Und der Filter nach Kennung an der Traktandenseite** (Fachprüfung Runde 4,
 * N4-1): `gesetzlichesErfordernis` filterte selbst nach `k-reglement-normal`,
 * und der Vermerk zur strengeren Klausel kam an den neuen Karten nie an. Kommt
 * ein solcher Filter zurück, wird die Probe rot.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8');

const ERFORDERNIS = 'src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis';
const TRAKTANDEN = 'src/routes/versammlungen/[id=kennung]/traktanden/+page.server.ts';
const LEITUNG = 'src/routes/versammlungen/[id=kennung]/leitung/+page.server.ts';
const ABEND = 'src/routes/tage/[id=kennung]/leitung/+page.server.ts';
const REGLEMENT = 'src/routes/gemeinschaften/[id=kennung]/reglement';

describe('Die Bestimmung zum Erneuerungsfonds an den Seiten', () => {
	it('steht an der Frage im Entscheidbaum, mit Marke und Änderungsschranke', () => {
		const server = lies(`${ERFORDERNIS}/+page.server.ts`);
		expect(server).toMatch(/fondsgrenze: gemeinschaft\?\.fondsgrenze/);
		expect(server).toMatch(/fondsgrenzeSatz\(gemeinschaft\.fondsgrenze\)/);
		expect(server).toMatch(/FONDSGRENZE_ANTWORTEN\[gemeinschaft\.fondsgrenze\.art\]/);
		expect(server).toMatch(/fondsgrenzeSchrankeSatz\(/);
		// Ohne die Frage zeigt die Seite nichts (Codeprüfung des Fix-Blocks, N1).
		expect(server.match(/frage: FONDSGRENZE_FRAGE/g)?.length).toBe(2);
		const seite = lies(`${ERFORDERNIS}/+page.svelte`);
		expect(seite).toContain('data.stand.frage.id === data.fondsgrenze.frage');
		expect(seite).toContain('data.stand.frage.id === data.fondsgrenzeSchranke.frage');
		expect(seite).toContain('{data.fondsgrenze.satz}');
		expect(seite).toContain('data.fondsgrenze.antworten.includes(antwort.id)');
		expect(seite).toContain('{data.fondsgrenzeSchranke.satz}');
	});

	it('steht an der Karte am Traktandum und vor der Abstimmung, in beiden Leitungen', () => {
		expect(lies(TRAKTANDEN)).toMatch(/gemeinschaft\?\.fondsgrenze\s*\)/);
		expect(lies(LEITUNG)).toMatch(/fondsgrenzeKartensatz\(\s*e,\s*gemeinschaft\?\.fondsgrenze\s*\)/);
		expect(lies(ABEND)).toMatch(/fondsgrenzeKartensatz\(\s*e,\s*hausgemeinschaft\?\.fondsgrenze\s*\)/);
	});

	it('lässt sich auf der Reglementsseite hinterlegen', () => {
		expect(lies(`${REGLEMENT}/+page.server.ts`)).toMatch(/fondsgrenze: async \(/);
		expect(lies(`${REGLEMENT}/+page.server.ts`)).toMatch(/speichereFondsgrenze\(/);
		const seite = lies(`${REGLEMENT}/+page.svelte`);
		expect(seite).toContain('action="?/fondsgrenze"');
		for (const feld of ['fondsgrenzeArt', 'fondsgrenzeWortlaut', 'fondsgrenzeFundstelle']) {
			expect(seite, feld).toContain(`name="${feld}"`);
		}
	});

	it('filtert an der Traktandenseite nicht selbst nach Kennung, bevor die Klausel verglichen wird', () => {
		const text = lies(TRAKTANDEN);
		const anfang = text.indexOf('function gesetzlichesErfordernis(');
		expect(anfang).toBeGreaterThan(-1);
		// Nur Code, ohne Kommentare: Der Kommentar im Rumpf nennt den alten Filter mit Absicht.
		const rumpf = text
			.slice(anfang, text.indexOf('\n}\n', anfang))
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');
		expect(rumpf).toMatch(/erfordernisAusKnoten\(/);
		expect(rumpf).not.toMatch(/knotenId\s*!==/);
		expect(rumpf).not.toMatch(/REGLEMENT_NORMAL_KNOTEN|mitMehrDerReglementsaenderung/);
	});

	it('gibt dem Errichten auf der Website das Signet «mild»', () => {
		// Featureprüfung, Kriterium 1: ohne Eintrag in `STREITFRAGEN_MILD` stünde das Errichten ohne Signet da.
		expect(lies('scripts/quorumsbaum-export.mjs')).toMatch(
			/const STREITFRAGEN_MILD = new Set\(\[[^\]]*FONDS_ERRICHTEN_ID[^\]]*\]\)/
		);
	});
});
