/**
 * Konten und Kennwörter in der Oberfläche (13.08.2026).
 *
 * **Der Fall:** Bis heute liess sich ein Kennwort nur über
 * `scripts/benutzer-anlegen.mjs` setzen — ein Wechsel verlangte einen Zugang
 * zur Kommandozeile des Servers. Geprüft wird deshalb die Kette, die das
 * ersetzt: Konto anlegen → damit anmelden → eigenes Kennwort ändern → mit dem
 * neuen hinein, mit dem alten nicht → ausser Dienst → gar nicht mehr hinein.
 *
 * Dazu die Grenze, die im Ernstfall zählt: **das letzte Verwaltungskonto**
 * lässt sich nicht ausser Dienst stellen.
 *
 * Der Rollenwächter und die Datenhaltung stehen in `tests/db/benutzer.test.ts`;
 * hier geht es um die Wege durch die Seiten.
 *
 * Aufruf: `node e2e/konten.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-konten';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(11, 19).replace(/:/g, '');

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
const seite = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

async function abschicken(knopf) {
	await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(200);
}

const seitentext = async () => (await seite.locator('main').innerText()).replace(/\s+/g, ' ');

/**
 * Meldet sich als der genannte Benutzer an; gibt zurück, ob es ging.
 *
 * **Erst richtig abmelden.** `/abmelden` ist ein POST-Ziel — per GET
 * aufgerufen passiert nichts, die alte Sitzung bleibt, und `/anmelden` leitet
 * bei bestehender Sitzung sofort weiter. Dann steht kein Formular da, und der
 * Lauf wartet dreissig Sekunden auf ein Feld, das es nicht gibt.
 */
async function anmelden(benutzer, kennwort) {
	await gehe('/');
	const ab = seite.locator('header form[action="/abmelden"] button[type="submit"]');
	if (await ab.count()) await abschicken(ab.first());

	await gehe('/anmelden');
	await seite.fill('input[name="username"]', benutzer);
	await seite.fill('input[name="kennwort"]', kennwort);
	await abschicken(seite.locator('main button[type="submit"]').first());
	return !seite.url().includes('/anmelden');
}

const NEU = `pruefkonto${LAUF}`;
const ERST = 'brauner tisch am fenster';
const ZWEIT = 'gelbes regal an der wand';

try {
	await schritt('Anmelden', async () => {
		behaupte(await anmelden(BENUTZER, KENNWORT), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Die Kontenseite ist von der Betreiberseite aus erreichbar', async () => {
		await gehe('/betreiber');
		const weg = seite.locator('a[href="/betreiber/benutzer"]');
		behaupte(await weg.count(), `Kein Weg zu den Konten: ${(await seitentext()).slice(0, 250)}`);
		// **Auf die Adresse warten, nicht auf das Laden.** SvelteKit wechselt die
		// Seite im Browser; `domcontentloaded` ist dabei sofort erfüllt, und die
		// Adresse steht erst danach.
		await weg.first().click();
		await seite.waitForURL(/\/betreiber\/benutzer/, { timeout: 15000 });
		return 'über «Konten führen»';
	});

	await schritt('Ein zu kurzes Kennwort wird abgewiesen — mit einer Anleitung', async () => {
		// Keine Regelaufzählung, sondern der Rat, der wirklich trägt.
		const form = seite.locator('form[action="?/anlegen"]');
		await form.locator('input[name="displayName"]').fill('Prüf Konto');
		await form.locator('input[name="username"]').fill(NEU);
		await form.locator('input[name="kennwort"]').fill('kurz');
		await form.locator('input[name="wiederholung"]').fill('kurz');
		// Die Browserprüfung würde vorher greifen; hier soll der Server antworten.
		await form.locator('input[name="kennwort"]').evaluate((e) => e.removeAttribute('minlength'));
		await form.locator('input[name="wiederholung"]').evaluate((e) => e.removeAttribute('minlength'));
		await abschicken(form.locator('button[type="submit"]'));

		const text = await seitentext();
		behaupte(/Wortfolge/.test(text), `Keine Anleitung, nur eine Regel: ${text.slice(0, 300)}`);
		return 'Anleitung statt Vorschrift';
	});

	await schritt('Zwei verschiedene Eingaben werden abgewiesen', async () => {
		const form = seite.locator('form[action="?/anlegen"]');
		await form.locator('input[name="displayName"]').fill('Prüf Konto');
		await form.locator('input[name="username"]').fill(NEU);
		await form.locator('input[name="kennwort"]').fill(ERST);
		await form.locator('input[name="wiederholung"]').fill(ZWEIT);
		await abschicken(form.locator('button[type="submit"]'));
		behaupte(
			/stimmen nicht überein/.test(await seitentext()),
			'Der Vertipper in der Wiederholung fällt nicht auf'
		);
		return 'erkannt';
	});

	await schritt('Konto anlegen', async () => {
		const form = seite.locator('form[action="?/anlegen"]');
		await form.locator('input[name="displayName"]').fill('Prüf Konto');
		await form.locator('input[name="username"]').fill(NEU);
		await form.locator('select[name="rolle"]').selectOption('chair');
		await form.locator('input[name="kennwort"]').fill(ERST);
		await form.locator('input[name="wiederholung"]').fill(ERST);
		await abschicken(form.locator('button[type="submit"]'));

		const text = await seitentext();
		behaupte(new RegExp(NEU).test(text), `Das Konto steht nicht in der Liste: ${text.slice(0, 300)}`);
		behaupte(/Sitzungsleitung/.test(text), 'Die Rolle steht nicht da');
		return NEU;
	});

	await schritt('Ein vergebener Name wird als Satz abgewiesen', async () => {
		// Namen gelten über alle Betreiber (Migration 155). Auf Dev gibt es nur
		// einen Betreiber; den Fall des fremden prüft `tests/db/benutzer.test.ts`.
		// Hier geht es darum, dass die Absage auf der Seite ankommt. Gross
		// geschrieben liesse das Feld den Namen gar nicht erst abschicken.
		const form = seite.locator('form[action="?/anlegen"]');
		await form.locator('input[name="displayName"]').fill('Prüf Konto doppelt');
		await form.locator('input[name="username"]').fill(NEU);
		await form.locator('input[name="kennwort"]').fill(ERST);
		await form.locator('input[name="wiederholung"]').fill(ERST);
		await abschicken(form.locator('button[type="submit"]'));

		const text = await seitentext();
		behaupte(
			/gibt es bereits/.test(text) && /anderen Betreiber/.test(text),
			`Keine Absage als Satz: ${text.slice(0, 300)}`
		);
		return 'abgewiesen';
	});

	await schritt('Mit dem neuen Konto anmelden', async () => {
		behaupte(await anmelden(NEU, ERST), 'Anmeldung mit dem neuen Konto ging nicht');
		return 'hereingekommen';
	});

	await schritt('Der eigene Name führt zum eigenen Konto', async () => {
		// Für die Sitzungsleitung ist das der einzige Weg: «Betreiber» ist der
		// Verwaltung vorbehalten.
		const weg = seite.locator('header a[href="/konto"]');
		behaupte(await weg.count(), 'Der Name in der Kopfzeile führt nirgendwohin');
		await weg.click();
		await seite.waitForURL(/\/konto/, { timeout: 15000 });
		behaupte(/Sitzungsleitung/.test(await seitentext()), 'Die eigene Rolle steht nicht da');
		return 'über den Namen in der Kopfzeile';
	});

	await schritt('Ein falsches bisheriges Kennwort wird abgewiesen', async () => {
		// Auch bei bestehender Sitzung: Ein unbeaufsichtigtes Gerät im
		// Sitzungszimmer ist der Normalfall.
		const form = seite.locator('form[action="?/kennwort"]');
		await form.locator('input[name="alt"]').fill('falsches kennwort hier');
		await form.locator('input[name="neu"]').fill(ZWEIT);
		await form.locator('input[name="wiederholung"]').fill(ZWEIT);
		await abschicken(form.locator('button[type="submit"]'));
		behaupte(
			/bisherige Kennwort stimmt nicht/.test(await seitentext()),
			'Das falsche alte Kennwort fällt nicht auf'
		);
		return 'abgewiesen';
	});

	await schritt('Das eigene Kennwort ändern', async () => {
		const form = seite.locator('form[action="?/kennwort"]');
		await form.locator('input[name="alt"]').fill(ERST);
		await form.locator('input[name="neu"]').fill(ZWEIT);
		await form.locator('input[name="wiederholung"]').fill(ZWEIT);
		await abschicken(form.locator('button[type="submit"]'));
		/*
		 * **Über die ganze Seite, nicht über `main`** (08.09.2026). Der Schritt
		 * war seit Tagen rot, obwohl der Wechsel gelingt — Schritt 10 belegt das
		 * unmittelbar danach. Die Ursache ist ein Umzug in der Anwendung, kein
		 * Fehler: `Meldung` gibt eine **gute** Meldung im Browser an die
		 * Quittungsecke weiter (`einblenden`) und lässt die Stelle in `main`
		 * leer, damit derselbe Satz nicht zweimal dasteht. `seitentext()` liest
		 * `main` und sah deshalb nichts.
		 *
		 * **Gemessen wird in der Ecke selbst** (`.quittung .text`), nicht im
		 * Seitentext: Ein Blick auf die ganze Seite fände auch die noch nicht
		 * umgezogene Kopie in `main` und wäre grün, wenn die Ecke ausfiele. Und
		 * gewartet wird auf den Zustand, nicht auf eine Frist — dieselbe Bauform
		 * wie in `stammdatenwege.mjs`. Eine Frist wäre hier besonders untauglich,
		 * denn die Quittung geht nach sechs Sekunden von selbst wieder.
		 */
		const quittung = seite.locator('.quittung .text');
		await quittung
			.first()
			.waitFor({ timeout: 20000 })
			.catch(() => {});
		const satz = (await quittung.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
		behaupte(
			/Kennwort ist geändert/.test(satz),
			`Keine Quittung zum Wechsel — in der Ecke steht: «${satz}», auf der Seite: ` +
				`«${(await seitentext()).slice(0, 160)}»`
		);
		return 'geändert';
	});

	await schritt('Das neue gilt, das alte nicht mehr', async () => {
		behaupte(!(await anmelden(NEU, ERST)), 'Das alte Kennwort geht noch');
		behaupte(await anmelden(NEU, ZWEIT), 'Das neue Kennwort geht nicht');
		return 'gewechselt';
	});

	await schritt('Die Sitzungsleitung kommt nicht an die Konten', async () => {
		// Der Rollenwächter: `/betreiber` ist Verwaltungsbereich.
		await gehe('/betreiber/benutzer');
		const text = (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/vorbehalten|Nicht berechtigt/.test(text),
			`Die Sitzungsleitung sieht die Konten: ${text.slice(0, 250)}`
		);
		// Und die Liste selbst steht nicht da — Lesen genügt hier schon.
		behaupte(!/Konto anlegen/.test(text), 'Das Anlegeformular ist sichtbar');
		return 'abgewiesen';
	});

	await schritt('Das letzte Verwaltungskonto lässt sich nicht ausser Dienst stellen', async () => {
		/*
		 * **Sonst sperrt sich die Bewirtschaftung aus ihrer eigenen Anwendung
		 * aus.** Der Prüflauf-Betreiber hat genau ein Verwaltungskonto — das,
		 * mit dem dieser Lauf arbeitet.
		 */
		behaupte(await anmelden(BENUTZER, KENNWORT), 'Rückkehr zur Verwaltung ging nicht');
		await gehe('/betreiber/benutzer');

		/*
		 * **Die eigene Zeile über die Marke «Ihr Konto» finden, nicht über den
		 * Namen.** «pruefer» trifft auch «pruefer-leitung»; der Lauf prüfte damit
		 * die falsche Zeile und meldete einen Fehler, den es nicht gab. Die Marke
		 * hiess bis `9354afc` «Sie»; seither lief dieser Schritt ins Leere.
		 */
		const eigene = seite.locator('.konten li', { hasText: 'Ihr Konto' }).first();
		await eigene.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(150);
		behaupte(
			(await eigene.locator('form[action="?/dienst"]').count()) === 0,
			'Das eigene Konto lässt sich ausser Dienst stellen'
		);
		return 'nicht angeboten';
	});

	await schritt('Konto ausser Dienst stellen — und die Anmeldung ist zu', async () => {
		await gehe('/betreiber/benutzer');
		const zeile = seite.locator('.konten li', { hasText: NEU }).first();
		await zeile.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(150);
		await abschicken(zeile.locator('form[action="?/dienst"] button[type="submit"]'));

		const text = await seitentext();
		behaupte(/Ausser Dienst/.test(text), `Kein Abschnitt «Ausser Dienst»: ${text.slice(0, 300)}`);
		behaupte(!(await anmelden(NEU, ZWEIT)), 'Ein ausser Dienst gestelltes Konto kommt herein');
		return 'gesperrt';
	});

	await schritt('Und wieder in Dienst', async () => {
		behaupte(await anmelden(BENUTZER, KENNWORT), 'Rückkehr zur Verwaltung ging nicht');
		await gehe('/betreiber/benutzer');
		const zeile = seite.locator('.konten li', { hasText: NEU }).first();
		await abschicken(zeile.locator('form[action="?/dienst"] button[type="submit"]'));
		behaupte(await anmelden(NEU, ZWEIT), 'Wieder in Dienst gestellt, kommt aber nicht herein');
		return 'wieder offen';
	});

	await schritt('Der Verlauf hält die Eingriffe fest', async () => {
		behaupte(await anmelden(BENUTZER, KENNWORT), 'Rückkehr zur Verwaltung ging nicht');
		await gehe(`/verlauf?q=${NEU}`);
		const text = await seitentext();
		behaupte(
			new RegExp(NEU).test(text),
			`Kein Verlaufseintrag zum Konto: ${text.slice(0, 300)}`
		);
		return 'im Verlauf';
	});

	await schritt('Aufräumen: das Prüfkonto ausser Dienst stellen', async () => {
		/*
		 * **Löschen geht nicht, und das ist richtig so.** Das Konto steht im
		 * Verlauf; der Fremdschlüssel darauf ist `RESTRICT`, weil ein gelöschtes
		 * Konto aus «freigegeben durch …» eine Zeile ohne Person machte. Der
		 * vorgesehene Weg ist derselbe wie im Betrieb: ausser Dienst stellen.
		 */
		await gehe('/betreiber/benutzer');
		const zeile = seite.locator('.konten li', { hasText: NEU }).first();
		await zeile.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(150);
		await abschicken(zeile.locator('form[action="?/dienst"] button[type="submit"]'));
		behaupte(
			/Ausser Dienst/.test(await seitentext()),
			'Das Prüfkonto steht noch in Dienst'
		);
		return NEU;
	});
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
