/**
 * Die Rückführung aus dem lokalen Betrieb (PRD §13, offene Frage 1).
 *
 * **Der Fall:** Die Versammlung lief auf dem Notebook im Saal, ohne Netz. Sie
 * ist dort geschlossen und versiegelt worden. Danach soll sie auf den Server.
 *
 * Der Lauf spielt beide Rollen auf demselben Stapel: Er führt eine Versammlung
 * bis zum Siegel, lädt ihr Abschlusspaket herunter — und legt es dann derselben
 * Anwendung wieder vor. Dass die Versammlung hier bereits geführt wird, ist
 * dabei kein Mangel des Prüflaufs, sondern **der Fall, den die Anwendung
 * abweisen muss**: Zwei Fassungen derselben Versammlung nebeneinander, und
 * keine hebt die andere auf.
 *
 * Der glückende Weg — ein Paket von einem Gerät, dessen Versammlung dieser
 * Server nicht kennt — steht in `tests/db/einspielen.test.ts`; dort lässt sich
 * das Manifest zum Prüfen umschreiben, was über die Oberfläche zu Recht nicht
 * geht.
 *
 * Aufruf: `node e2e/rueckfuehrung.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { gestellteRueckfragen, rueckfragenBestaetigen } from './rueckfrage.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-rueckfuehrung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

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

/**
 * Rückfragen zusagen und mitschreiben.
 *
 * **Berichtigt am 24.08.2026.** Hier stand ein Zuhörer auf `dialog` — der
 * beantwortete `confirm()`. Seit dem 20.08. fragt die Anwendung über ein
 * eigenes Fenster (`Rueckfrage.svelte`), und ein `dialog`-Ereignis gibt es
 * nicht mehr: Der Klick öffnete das Fenster, niemand bestätigte, das Formular
 * ging nie ab. Genau die Lage, die der Kopf hier beschreibt — «lautlos, weil
 * das Formular einfach nicht abgeschickt wird» —, nur eine Stufe früher.
 * Sichtbar wurde sie als «Kein Versiegeln möglich: Die Versammlung läuft noch».
 *
 * `rueckfragenBestaetigen` deckt beides ab: das eigene Fenster und die
 * Browserabfrage.
 */
await rueckfragenBestaetigen(seite);

async function abschicken(knopf) {
	await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 60000 }).catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

const seitentext = async () => (await seite.locator('main').innerText()).replace(/\s+/g, ' ');

try {
	let gemeinschaft;
	let versammlung;
	let paketpfad;
	const NAME = `Prüflauf Rückführung ${LAUF}`;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		// **Erst warten, dann behaupten.** Die Anmeldung springt im Browser weiter,
		// nicht über eine Antwort des Servers: `abschicken` sieht den POST und wartet
		// 250 ms, und unter Last reicht das nicht. Am 27.08.2026 meldeten zwei
		// Drehbücher «Anmeldung fehlgeschlagen», während alle folgenden Schritte
		// grün liefen — die Anmeldung war gelungen, die Zusicherung zu früh.
		//
		// Das Warten steht ausdrücklich VOR der Zusicherung und ersetzt sie nicht:
		// Läuft die Frist ab, bleibt die Adresse `/anmelden` und der Befund kommt.
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Eine Gemeinschaft mit einer Einheit anlegen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const form = seite.locator('form[action$="anlegen"]').first();
		await form.locator('input[name="label"]').fill('Wohnung 1');
		await form.locator('input[name="quote.stamm"]').fill('1000');
		await abschicken(form.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="displayName"]').fill('Aebi');
		await abschicken(ef.locator('button[type="submit"]'));

		// Ohne Zuordnung bleibt die Einheit ohne Eigentümer — und die Versammlung
		// liesse sich nicht freigeben.
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await zf.locator('select[name="unitId"]').selectOption({ index: 1 });
		await zf.locator('select[name="partyId"]').selectOption({ index: 1 });
		await abschicken(zf.locator('button[type="submit"]'));
		return gemeinschaft.slice(0, 8);
	});

	await schritt('Die Einspielseite ist von der Historie aus erreichbar', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/historie`);
		const verweis = seite.locator(`a[href="/gemeinschaften/${gemeinschaft}/einspielen"]`);
		behaupte(await verweis.count(), 'Kein Weg zur Einspielseite');
		await Promise.all([
			seite.waitForURL((u) => u.pathname.endsWith('/einspielen'), { timeout: 20000 }),
			verweis.first().click()
		]);
		await seite.waitForTimeout(200);
		const text = await seitentext();
		behaupte(/als Ganzes/.test(text), 'Die Seite sagt nicht, was aufgenommen wird');
		return 'Historie → Einspielen';
	});

	await schritt('Ohne Paket wird nichts aufgenommen', async () => {
		// Das Formular verlangt eine Datei; abgeschickt wird es damit gar nicht.
		const datei = seite.locator('input[type="file"][name="paket"]');
		behaupte(await datei.count(), 'Kein Dateifeld');
		behaupte(
			await datei.first().evaluate((e) => e.required),
			'Die Datei ist nicht Pflicht'
		);
		return 'Pflichtfeld';
	});

	await schritt('Ein Archiv ohne Manifest wird abgewiesen', async () => {
		// Irgendein ZIP — hier eine Textdatei mit falscher Endung. Die Anwendung
		// muss sagen, was fehlt, statt bloss «geht nicht».
		paketpfad = `${AUFNAHMEN}/kein-paket.zip`;
		await writeFile(paketpfad, 'PK kein Abschlusspaket');
		await seite.locator('input[name="paket"]').setInputFiles(paketpfad);
		await abschicken(seite.locator('form[action$="pruefen"] button[type="submit"]'));
		const meldung = (await seite.locator('.meldung').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Abschlusspaket|Archiv|Manifest/.test(meldung),
			`Keine brauchbare Meldung: ${meldung.slice(0, 250)}`
		);
		return meldung.slice(0, 70);
	});

	await schritt('Eine Versammlung führen und versiegeln', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-03-11');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(
			versammlung && versammlung !== 'neu',
			`Nicht angelegt: ${seite.url()} — ${(await seitentext()).slice(0, 200)}`
		);
		return versammlung.slice(0, 8);
	});

	await schritt('Das Abschlusspaket entsteht und lässt sich laden', async () => {
		// Freigeben, eröffnen, schliessen, versiegeln — über die Siegelseite, die
		// die Schritte in der richtigen Reihenfolge anbietet.
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		if (await frei.count()) await abschicken(frei.first());

		// Eröffnen und Schliessen stehen auf der Versammlungsseite selbst; die
		// Sitzungsleitung setzt eine laufende Versammlung voraus.
		await gehe(`/versammlungen/${versammlung}`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await eroeffnen.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(eroeffnen.first());

		await gehe(`/versammlungen/${versammlung}`);
		const schliessen = seite.locator('form[action="?/schliessen"] button[type="submit"]');
		behaupte(await schliessen.count(), `Kein Schliessen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(schliessen.first());

		await gehe(`/versammlungen/${versammlung}/siegel`);
		const versiegeln = seite.locator('form[action="?/versiegeln"] button[type="submit"]');
		behaupte(await versiegeln.count(), `Kein Versiegeln möglich: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(versiegeln.first());

		// Über die Anfrage statt über einen Klick: Der Download landet damit
		// unmittelbar als Bytes hier, ohne Umweg über den Ladeordner des Browsers.
		const antwort = await seite.request.get(
			`${ZIEL}/versammlungen/${versammlung}/abschlusspaket.zip`
		);
		behaupte(antwort.ok(), `Das Paket antwortete mit ${antwort.status()}`);
		const bytes = await antwort.body();
		behaupte(bytes.length > 2000, `Das Paket ist mit ${bytes.length} Byte zu klein`);
		paketpfad = `${AUFNAHMEN}/abschlusspaket.zip`;
		await writeFile(paketpfad, bytes);
		return `${Math.round(bytes.length / 1024)} kB`;
	});

	await schritt('Dieselbe Versammlung wird nicht daneben aufgenommen', async () => {
		/*
		 * Der Kern der Sache: Die Versammlung läuft hier bereits. Ein Paket
		 * derselben Versammlung daneben ergäbe zwei Fassungen, von denen keine die
		 * andere aufhebt.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/einspielen`);
		await seite.locator('input[name="paket"]').setInputFiles(paketpfad);
		await abschicken(seite.locator('form[action$="pruefen"] button[type="submit"]'));

		const text = await seitentext();
		behaupte(/Wird nicht aufgenommen/.test(text), `Kein Nein: ${text.slice(0, 250)}`);
		behaupte(
			/bereits geführt/.test(text),
			`Der Grund fehlt: ${text.slice(0, 300)}`
		);
		behaupte(
			(await seite.locator('form[action$="aufnehmen"]').count()) === 0,
			'Der Aufnehmen-Knopf steht trotzdem da'
		);
		return 'abgewiesen, mit Grund';
	});

	await schritt('Die Vorschau zeigt trotzdem, was im Paket steht', async () => {
		// Auch ein abgewiesenes Paket wird gelesen: Wer wissen will, ob er das
		// richtige vor sich hat, soll das sehen, ohne es aufnehmen zu müssen.
		const text = await seitentext();
		behaupte(/2027-03-11/.test(text), 'Das Datum aus dem Manifest fehlt');
		behaupte(/Prüfsaal/.test(text), 'Der Ort aus dem Manifest fehlt');
		behaupte(/Begrüssung/.test(text), `Keine Beschlüsse gezeigt: ${text.slice(0, 300)}`);
		return 'Manifest und Beschlüsse gelesen';
	});

	/*
	 * **Der Mailversand ist eine Option** (PRD §13). Auf diesem Stapel ist kein
	 * Mailausgang eingerichtet — dann darf der Knopf gar nicht dastehen. Ein
	 * Knopf, der nichts tut, ist schlimmer als keiner: Wer ihn drückt, glaubt
	 * verschickt zu haben.
	 */
	await schritt('Ohne Mailausgang steht kein Versandknopf da', async () => {
		await gehe(`/versammlungen/${versammlung}/zugaenge`);
		const text = await seitentext();
		behaupte(/Versandpaket als ZIP/.test(text), `Keine Versandseite: ${text.slice(0, 200)}`);
		behaupte(
			(await seite.locator('form[action="?/versenden"]').count()) === 0,
			'Der Versandknopf steht da, obwohl kein Mailausgang eingerichtet ist'
		);
		behaupte(
			!/per Mail verschicken/.test(text),
			'Der Mailweg wird angeboten, obwohl er nicht eingerichtet ist'
		);
		return 'kein Knopf, drei Dateiwege bleiben';
	});

	await schritt('Kein Querlauf am Telefon', async () => {
		const eng = await browser.newPage({ viewport: { width: 390, height: 844 } });
		warteNachNavigation(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'load' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/einspielen`, {
			waitUntil: 'domcontentloaded'
		});
		await eng.waitForTimeout(400);
		const ueber = await eng.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		await eng.close();
		behaupte(ueber === 0, `Die Seite läuft ${ueber} px quer`);
		return '0 px';
	});

	const rueckfragen = await gestellteRueckfragen(seite);
	if (rueckfragen.length > 0) {
		console.log(`\n  Rückfragen unterwegs: ${rueckfragen.join(' · ')}`);
	}
	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}`);
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png` }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
