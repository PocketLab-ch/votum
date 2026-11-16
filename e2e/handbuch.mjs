/**
 * Handbuch und Seitenhilfe — der Weg durch die Oberfläche (17.08.2026).
 *
 * **Warum dieser Lauf sein muss.** Der Erzeuger prüft beim Bauen, dass jedes
 * Sprungziel existiert (`scripts/handbuch-bauen.mjs`). Er sieht aber nicht, was
 * der Browser daraus macht: ob das Handbuch die Anwendung verdrängt, ob nach
 * fünf Fragen fünf Fenster offenstehen, und ob der Sprung wirklich an der
 * Stelle landet statt am Kapitelanfang.
 *
 * Gemeldet am 17.08.2026: «Wenn man auf Handbuch klickt, soll ein neues Tab
 * aufgehen.» Bis dahin ersetzte das Handbuch die Anwendung — wer im Saal etwas
 * nachschlug, hatte die Sitzungsleitung nicht mehr vor sich.
 *
 * **Aufruf:** node e2e/handbuch.mjs
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT_PFAD);

let nummer = 0;
const befunde = [];

async function schritt(name, fn) {
	nummer++;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${String(nummer).padStart(2)} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (fehler) {
		console.log(`  ✗ ${String(nummer).padStart(2)} ${name} — ${fehler.message}`);
		befunde.push(`${nummer} ${name}: ${fehler.message}`);
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const seite = await kontext.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

/** Alle Fenster ausser der Anwendung — das Handbuch soll genau eines davon sein. */
const handbuchfenster = () => kontext.pages().filter((p) => p !== seite);

/**
 * Warten, bis die Seite bedienbar ist. Vor der Hydration hängt am Verweis noch
 * kein `target`, und ein Klick landete im selben Fenster — der Lauf meldete
 * dann einen Fehler, den ein Mensch nie erreicht (docs/gestaltung.md).
 */
async function oeffne(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForFunction(() => document.documentElement.dataset.bereit === '1', null, {
		timeout: 20000
	});
}

/**
 * Klickt die Hilfe und gibt das Handbuchfenster samt Lage des Sprungziels zurück.
 *
 * **Gewartet wird auf Ereignisse, nicht auf die Uhr.** Beim ersten Mal geht ein
 * Fenster auf — darauf lässt sich horchen; danach wechselt dasselbe Fenster nur
 * seine Adresse, und darauf lässt sich prüfen. Ein fester Schlaf wäre auf einem
 * belasteten Rechner zu kurz und im Normalfall zu lang.
 */
async function frageHilfe(pfad) {
	await oeffne(pfad);
	const verweis = seite.locator('a.hilfe');
	const erwartet = await verweis.getAttribute('href');
	const vorher = handbuchfenster().length;

	const gehtAuf = vorher === 0 ? kontext.waitForEvent('page', { timeout: 20000 }) : null;
	await verweis.click();
	if (gehtAuf) await gehtAuf;

	const fenster = handbuchfenster();
	behaupte(fenster.length > 0, 'Es ging kein Handbuchfenster auf');
	const hb = fenster[fenster.length - 1];
	await hb.waitForLoadState('domcontentloaded');
	await hb.waitForFunction((ziel) => location.pathname + location.hash === ziel, erwartet, {
		timeout: 20000
	});
	// Kurz setzen lassen: Das ist der Sprung selbst, kein Warten auf das Netz.
	await hb.waitForTimeout(150);
	const lage = await hb.evaluate(() => {
		const anker = location.hash ? document.querySelector(decodeURIComponent(location.hash)) : null;
		const doc = document.documentElement;
		return {
			adresse: location.pathname + location.hash,
			gefunden: !!anker,
			y: anker ? Math.round(anker.getBoundingClientRect().top) : null,
			// Sitzt das Ziel im letzten Abschnitt, kann der Browser es nicht an den
			// oberen Rand holen — dann ist «so weit es geht» richtig.
			amEnde: Math.round(window.scrollY) >= doc.scrollHeight - window.innerHeight - 2
		};
	});
	return { hb, neu: fenster.length > vorher, anzahl: fenster.length, lage };
}

console.log(`Ziel: ${ZIEL} · Handbuch und Seitenhilfe\n`);

await schritt('Anmelden', async () => {
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(200);
	await seite.fill('input[name="username"]', BENUTZER);
	await seite.fill('input[name="kennwort"]', KENNWORT);
	await Promise.all([
		seite.waitForLoadState('networkidle'),
		seite.locator('main button[type="submit"]').first().click()
	]);
	behaupte(!seite.url().includes('/anmelden'), 'Anmeldung misslungen');
	return `als ${BENUTZER}`;
});

await schritt('«?» öffnet ein eigenes Fenster und lässt die Anwendung stehen', async () => {
	const { neu, lage } = await frageHilfe('/betreiber/dienste');
	behaupte(neu, 'Es ging kein eigenes Fenster auf');
	behaupte(
		seite.url().endsWith('/betreiber/dienste'),
		`Die Anwendung ist weggesprungen: ${seite.url()}`
	);
	return lage.adresse;
});

await schritt('Der Sprung landet an der Stelle, nicht am Kapitelanfang', async () => {
	const { lage } = await frageHilfe('/verlauf');
	behaupte(lage.gefunden, `Den Anker gibt es nicht: ${lage.adresse}`);
	behaupte(lage.y < 120 || lage.amEnde, `Das Ziel steht ${lage.y} px unter der Bildkante`);
	return `${lage.adresse} bei y=${lage.y}`;
});

/*
 * Der Grund für den **benannten** Zielrahmen statt `_blank`: Sonst läge nach
 * fünf Fragen ein Stapel Handbuchfenster da, und im Saal sucht niemand das
 * richtige heraus.
 */
await schritt('Ein zweiter Klick nimmt dasselbe Fenster und wechselt die Stelle', async () => {
	const vorher = handbuchfenster().length;
	const { anzahl, lage } = await frageHilfe('/gemeinschaften');
	behaupte(anzahl === vorher, `Es sind ${anzahl} Handbuchfenster offen statt ${vorher}`);
	behaupte(
		lage.adresse.endsWith('#abschnitt-1-vorbereiten'),
		`Die Stelle hat nicht gewechselt: ${lage.adresse}`
	);
	behaupte(lage.y < 120 || lage.amEnde, `Das Ziel steht ${lage.y} px unter der Bildkante`);
	return `1 Fenster, jetzt ${lage.adresse}`;
});

await schritt('Der Menüpunkt «Handbuch» nutzt dasselbe Fenster', async () => {
	await oeffne('/versammlungen');
	const vorher = handbuchfenster().length;
	const gehtAuf = vorher === 0 ? kontext.waitForEvent('page', { timeout: 20000 }) : null;
	await seite.locator('nav a:has-text("Handbuch")').click();
	if (gehtAuf) await gehtAuf;

	const hb = handbuchfenster().pop();
	behaupte(!!hb, 'Es gibt kein Handbuchfenster');
	await hb.waitForLoadState('domcontentloaded');
	await hb.waitForFunction(() => location.pathname === '/handbuch/index.html', null, {
		timeout: 20000
	});
	behaupte(
		handbuchfenster().length === vorher,
		`Es ging ein weiteres Fenster auf (${handbuchfenster().length})`
	);
	behaupte(seite.url().endsWith('/versammlungen'), `Die Anwendung ist weggesprungen: ${seite.url()}`);
	return 'Startseite im Handbuchfenster';
});

/*
 * Jede zugeordnete Seite einmal. Der Erzeuger prüft, dass es den Anker **gibt**;
 * hier zählt, wo er im Bild **landet** — ein Ziel im letzten Abschnitt eines
 * Kapitels kann der Browser gar nicht nach oben holen, und dann steht die
 * Antwort in der unteren Bildhälfte. Genau das war bis zum 17.08.2026 der Fall,
 * wenn man auf «Mehrheiten» nach Hilfe fragte.
 */
await schritt('Jede Seite mit eigener Hilfe springt sichtbar an ihr Ziel', async () => {
	const seiten = [
		'/',
		'/versammlungen',
		'/gemeinschaften',
		'/personen',
		'/quorum',
		'/verlauf',
		'/betreiber',
		'/konto'
	];
	const daneben = [];
	for (const pfad of seiten) {
		const { lage } = await frageHilfe(pfad);
		if (!lage.gefunden) daneben.push(`${pfad}: Anker fehlt (${lage.adresse})`);
		else if (lage.y >= 120 && !lage.amEnde) daneben.push(`${pfad}: Ziel ${lage.y} px zu tief`);
	}
	behaupte(daneben.length === 0, daneben.join('; '));
	return `${seiten.length} Seiten geprüft`;
});

await browser.close();

console.log('');
if (befunde.length) {
	console.log(`${nummer} Schritte, ${befunde.length} Befund(e):`);
	for (const b of befunde) console.log(`  · ${b}`);
	process.exit(1);
}
console.log(`Alle ${nummer} Schritte grün.`);
