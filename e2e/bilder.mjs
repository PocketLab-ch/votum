/**
 * Bildschirmbilder der umgebauten Führung.
 *
 * Kein Test — ein Blick. Nimmt die Seiten auf, an denen die sechs Befunde
 * hingen, damit sich vorher und nachher nebeneinanderlegen lassen.
 *
 * Aufruf vom Wirt aus (nicht im Container):
 *   node e2e/bilder.mjs
 */
import { createRequire } from 'node:module';
import { playwrightPfad } from './playwright-pfad.mjs';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const { chromium } = createRequire(import.meta.url)(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const ORDNER = process.env.ORDNER ?? '/tmp/ui-neu';

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const seite = await kontext.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

await mkdir(ORDNER, { recursive: true });

async function bild(name, pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(400);
	await seite.screenshot({ path: `${ORDNER}/${name}.png`, fullPage: true });
	console.log(`  ${name} — ${pfad}`);
}

console.log(`Bilder nach ${ORDNER}`);

await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
await seite.fill('input[name="username"]', BENUTZER);
await seite.fill('input[name="kennwort"]', KENNWORT);
await Promise.all([
	seite.waitForLoadState('domcontentloaded'),
	seite.locator('main button[type="submit"]').click()
]);
if (seite.url().includes('/anmelden')) {
	console.error('Anmeldung fehlgeschlagen');
	process.exit(1);
}

await bild('01-startseite', '/');
await bild('02-gemeinschaften', '/gemeinschaften');

// Die Beispielgemeinschaft und ihre Versammlung suchen.
await seite.goto(`${ZIEL}/gemeinschaften`, { waitUntil: 'domcontentloaded' });
const gemeinschaftPfad = await seite
	.locator('a[href^="/gemeinschaften/"]')
	.filter({ hasText: /Nirgendweg|STWEG|Musterweg/ })
	.first()
	.getAttribute('href')
	.catch(() => null);

if (gemeinschaftPfad) {
	await bild('03-gemeinschaft-uebersicht', gemeinschaftPfad);
	await bild('04-gemeinschaft-angaben', `${gemeinschaftPfad}/angaben`);
	await bild('05-gemeinschaft-einheiten', `${gemeinschaftPfad}/einheiten`);
	await bild('05b-nutzniessung', `${gemeinschaftPfad}/nutzniessung`);
	await bild('05c-eigentuemer', `${gemeinschaftPfad}/eigentuemer`);
} else {
	console.log('  (keine Gemeinschaft gefunden)');
}

await seite.goto(`${ZIEL}/versammlungen`, { waitUntil: 'domcontentloaded' });
const versammlungPfad = await seite
	.locator('a[href^="/versammlungen/"]')
	.first()
	.getAttribute('href')
	.catch(() => null);

if (versammlungPfad) {
	const wurzel = versammlungPfad.split('?')[0];
	await bild('06-versammlung', wurzel);
	await bild('07-traktanden', `${wurzel}/traktanden`);
	await bild('08-vorbereitung', `${wurzel}/vorbereitung`);
	await bild('09-leitung', `${wurzel}/leitung`);
	await bild('10-auswertung', `${wurzel}/auswertung`);
} else {
	console.log('  (keine Versammlung gefunden)');
}

// Schmal, wie auf dem Telefon der Sitzungsleitung.
await seite.setViewportSize({ width: 420, height: 900 });
if (versammlungPfad) await bild('11-schmal-versammlung', versammlungPfad.split('?')[0]);

await browser.close();
console.log('fertig');
