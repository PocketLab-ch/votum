/**
 * Der Erreichbarkeitssatz bleibt in der Leitung.
 *
 * **Warum eine Quellprobe für das Haus.** Am gemeinsamen Abend rechnet der
 * Loader `erreichbarkeitZeigen`; die Datenbankprobe `tests/db/erreichbarkeit.test.ts`
 * misst ihn. In der Leitung des Hauses steht die Bedingung dagegen nur im
 * Svelte (`data.beschlussfaehigkeit?.beschlussfaehig`). Ohne Änderung in
 * `src/` lässt sie sich nicht rendern; die Pendenzen 18.10.2026 sagen für
 * diesen Fall «melden, nicht umbauen». Diese Probe hält deshalb den Wortlaut
 * der Bedingung fest: Wird sie entfernt, erscheint der Satz auch bei fehlender
 * Beschlussfähigkeit, und der Test wird rot.
 *
 * **Der Abend braucht dieselbe Probe am Svelte** (Codeprüfung bei der
 * Übernahme, 20.10.2026): Die Datenbankprobe misst nur, was der Loader in
 * `erreichbarkeitZeigen` rechnet. Fiele die Bedingung im Svelte des Abends
 * weg, stünde der Satz ohne Beschlussfähigkeit da, und kein Test würde rot.
 * Beide Proben zählen zudem, dass der Satz je Seite nur einmal gerendert wird;
 * ein zweites, unbedingtes Rendern bliebe sonst grün.
 *
 * **Und er darf nicht an die Wand oder aufs Telefon wandern.** Beide Sichten
 * lesen `holeMehrheitsvorschau`, übernehmen aber nur `satz` und
 * `ausstandsgrund`. Die Probe hält fest, dass `erreichbarkeitshinweis` dort
 * nicht auftaucht.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');

/**
 * Der Satz steht im Zweig der Bedingung, also vor dem nächsten `{/if}`, und
 * wird auf der Seite nur einmal gerendert, mit oder ohne `?.`.
 */
function pruefeEinmalImZweig(quelle: string, beginn: number) {
	const ende = quelle.indexOf('{/if}', beginn);
	expect(ende, 'Der Zweig der Bedingung endet nicht.').toBeGreaterThan(beginn);
	const ausgabe = /\{data\.vorschau\??\.erreichbarkeitshinweis\}/g;
	expect(quelle.slice(beginn, ende).match(ausgabe)?.length ?? 0).toBe(1);
	expect(quelle.match(ausgabe)?.length ?? 0).toBe(1);
}

describe('Der Erreichbarkeitssatz in der Leitung des Hauses', () => {
	it('steht unter der Bedingung der Beschlussfähigkeit', () => {
		const quelle = lies('src/routes/versammlungen/[id=kennung]/leitung/+page.svelte');
		const bedingung =
			/\{#if\s+data\.vorschau\?\.erreichbarkeitshinweis\s*&&\s*data\.beschlussfaehigkeit\?\.beschlussfaehig\s*\}/;
		const treffer = bedingung.exec(quelle);
		expect(treffer, 'Die Bedingung der Beschlussfähigkeit fehlt im Svelte.').not.toBeNull();
		pruefeEinmalImZweig(quelle, treffer!.index);
	});

	it('steht am gemeinsamen Abend unter der Bedingung aus dem Loader', () => {
		const quelle = lies('src/routes/tage/[id=kennung]/leitung/+page.svelte');
		const bedingung =
			/\{#if\s+data\.vorschau\?\.erreichbarkeitshinweis\s*&&\s*data\.erreichbarkeitZeigen\s*\}/;
		const treffer = bedingung.exec(quelle);
		expect(treffer, 'Die Bedingung erreichbarkeitZeigen fehlt im Svelte des Abends.').not.toBeNull();
		pruefeEinmalImZweig(quelle, treffer!.index);
	});

	it('erscheint nicht an der Wand und nicht auf dem Telefon', () => {
		expect(lies('src/routes/z/+page.server.ts')).not.toContain('erreichbarkeitshinweis');
		expect(lies('src/routes/p/+page.server.ts')).not.toContain('erreichbarkeitshinweis');
	});
});
