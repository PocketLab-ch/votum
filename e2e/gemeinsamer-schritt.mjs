/**
 * Ein gemeinsamer Schritt am Abend ist nur noch eine Kenntnisnahme.
 *
 * **Was hier festgenagelt wird** (Produktentscheid 25.09.2026: kein
 * Abstimmungsschritt über mehrere Häuser): Ein Punkt über mehrere Häuser läuft am Abend nur dann als ein Schritt
 * für alle, wenn «beschlussfähig» im Titel steht **und** überall eine
 * Kenntnisnahme. Wird abgestimmt, gibt es je Haus einen Schritt, mit Vorschau
 * und Sperre am Knopf, wie bei jedem anderen Punkt (`laeuftGemeinsam` in
 * `domain/gemeinsameliste.ts`).
 *
 *   1. Eine Abstimmung mit «Beschlussfähigkeit» im Titel hat in der Leitung des
 *      Abends «Einzeln führen».
 *   2. Die mitgebrachte Begrüssung mit der Feststellung der Beschlussfähigkeit
 *      bleibt ein Schritt für alle (Gegenprobe: sonst wäre die Grenze bloss
 *      verschoben).
 *   3. Ein Eröffnen ohne Traktandum über mehrere Häuser endet im Satz der
 *      Sperre, nicht in einer 500. Ob dabei irgendwo eröffnet würde, ist hier
 *      nicht beobachtbar (die Versammlungen sind im Entwurf); das deckt die
 *      Sperre selbst, die vor jedem Haus greift.
 *
 * Die Versammlungen bleiben im Entwurf: Keine der drei Aussagen braucht eine
 * laufende Sitzung, und die Sperre in Punkt 3 greift vor jedem Haus.
 *
 * Aufruf: `node e2e/gemeinsamer-schritt.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-gemeinsamer-schritt';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const TAG = new Date(Date.UTC(2033, 0, 1) + (Date.now() % 700) * 86400000)
	.toISOString()
	.slice(0, 10);
const WAHL = `Feststellung der Beschlussfähigkeit und Wahl des Protokollführers ${LAUF}`;

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ${String(nr).padStart(2)} ✓ ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${String(nr).padStart(2)} ✗ ${titel} — ${e.message}`);
		await seite
			.screenshot({ path: `${AUFNAHMEN}/fehler-${String(nr).padStart(2, '0')}.png` })
			.catch(() => {});
	}
}

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1440, height: 1900 } });
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

async function abschicken(knopf) {
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 })
			.catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

/** Die Zeile eines Punktes in der Liste der Leitung und die Zeile direkt danach. */
async function punktzeile(titelanfang) {
	const zeile = seite.locator('ul.alle > li').filter({ hasText: titelanfang }).first();
	behaupte(await zeile.count(), `Punkt «${titelanfang}» steht nicht in der Liste der Leitung`);
	// Ohne zwei Häuser gäbe es «Einzeln führen» ohnehin nicht, und die Aussage
	// über den gemeinsamen Schritt wäre leer.
	const text = (await zeile.innerText()).replace(/\s+/g, ' ');
	behaupte(/2 Gemeinschaften/.test(text), `«${titelanfang}» läuft nicht in beiden Häusern: «${text}»`);
	const danach = zeile.locator('xpath=following-sibling::li[1]');
	const einzeln = (await danach.count()) > 0 && (await danach.getAttribute('class'))?.includes('einzeln');
	return { zeile, einzeln: Boolean(einzeln) };
}

try {
	let tag;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Einen Abend mit zwei eigenen Häusern anlegen', async () => {
		const ids = [];
		for (let n = 1; n <= 2; n += 1) {
			await gehe('/gemeinschaften/neu');
			await seite.fill('input[name="name"]', `Schritthaus ${n} Prüflauf ${LAUF}`);
			await seite.fill('input[name="quotaDenominator"]', '1000');
			await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
			await abschicken(seite.locator('main button[type="submit"]').first());
			const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
			behaupte(id && id !== 'neu', `Haus ${n} nicht angelegt, Adresse steht auf ${seite.url()}`);
			ids.push(id);
		}
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Schritte Prüflauf ${LAUF}`);
		await seite.fill('input[name="datum"]', TAG);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Saal Prüflauf ${LAUF}`);
		for (const id of ids) {
			const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
			behaupte(await kaestchen.count(), `Eigenes Haus ${id} steht nicht zur Wahl`);
			await kaestchen.check();
		}
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];
		return tag;
	});

	await schritt('Die Wahl als Abstimmung für beide Häuser aufnehmen', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		if ((await seite.locator('form#neu').count()) === 0) {
			await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
			await seite.waitForTimeout(250);
		}
		await seite.fill('input[name="titel"]', WAHL);
		await seite.fill('input[name="antragswortlaut"]', 'Zum Protokollführer wird die Verwaltung gewählt.');
		await abschicken(seite.locator('button[form="neu"]'));
		const text = (await seite.locator('ol.liste').innerText()).replace(/\s+/g, ' ');
		behaupte(text.includes(WAHL), `Die Wahl steht nicht in der Traktandenliste: «${text.slice(0, 300)}»`);
	});

	await schritt('Die Wahl hat in der Leitung des Abends «Einzeln führen»', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const { einzeln } = await punktzeile(WAHL);
		behaupte(
			einzeln,
			'Unter der Wahl fehlt «Einzeln führen»: Sie läuft weiter als ein Schritt für alle Häuser'
		);
		return 'je Haus';
	});

	await schritt('Die Begrüssung bleibt ein Schritt für alle (Gegenprobe)', async () => {
		const { einzeln } = await punktzeile('Begrüssung');
		behaupte(
			!einzeln,
			'Unter der Begrüssung steht «Einzeln führen»: Die Feststellung der Beschlussfähigkeit ' +
				'ist kein gemeinsamer Schritt mehr'
		);
		return 'gemeinsam';
	});

	await schritt('Eröffnen ohne Traktandum über beide Häuser endet im Satz der Sperre', async () => {
		const { zeile } = await punktzeile(WAHL);
		const geschaeft = await zeile.locator('input[name="geschaeft"]').first().getAttribute('value');
		behaupte(geschaeft, 'Keine Geschäftskennung an der Zeile der Wahl');
		// Direkt an die Aktion, am Knopf vorbei: Genau diesen Weg hält die Sperre zu.
		const antwort = await seite.evaluate(async (g) => {
			const daten = new FormData();
			daten.set('geschaeft', g);
			daten.set('traktandum', '');
			const r = await fetch('?/oeffnen', {
				method: 'POST',
				body: daten,
				headers: { 'x-sveltekit-action': 'true' }
			});
			return { status: r.status, text: await r.text() };
		}, geschaeft);
		behaupte(antwort.status === 200, `Die Aktion antwortete mit ${antwort.status}`);
		behaupte(
			/"type":"failure"/.test(antwort.text) && /"status":400/.test(antwort.text),
			`Keine Absage: ${antwort.text.slice(0, 300)}`
		);
		behaupte(
			/Abgestimmt wird je Gemeinschaft/.test(antwort.text),
			`Die Absage nennt den Grund nicht: ${antwort.text.slice(0, 300)}`
		);
		return 'Absage mit Satz';
	});

	await seite.screenshot({ path: `${AUFNAHMEN}/leitung.png` });
} finally {
	await browser.close();
}

if (fehler.length > 0) {
	console.log(`\n${fehler.length} Befunde:`);
	for (const f of fehler) console.log(`- ${f}`);
	process.exit(1);
}
console.log('\nAlles grün.');
