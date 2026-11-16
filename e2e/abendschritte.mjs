/**
 * Die Einzelschritte am laufenden Abend.
 *
 * **Warum ein eigener Durchstich** (25.09.2026). Seit `ed8206c` läuft ein Punkt
 * mit «beschlussfähig» im Titel am Abend je Haus, sobald irgendwo darüber
 * abgestimmt wird (`laeuftGemeinsam`). `gemeinsamer-schritt.mjs` misst das an
 * Versammlungen im Entwurf; was an einem aufgerufenen Einzelschritt geschieht,
 * sieht er nicht. Dafür braucht es einen eröffneten Abend.
 *
 * ## Was gemessen wird
 *
 *   1. Am aufgerufenen Einzelschritt der «Feststellung der Beschlussfähigkeit
 *      und Wahl …» steht in der Leitung des Abends weiter «Beschlussfähigkeit
 *      festhalten», und die Saalansicht zeigt die grossen Kacheln. Beide hängen
 *      am Titel (`stelltBeschlussfaehigkeitFest`), und der Einzelschritt trägt
 *      den Titel des Punktes.
 *   2. Unter «Einzeln führen» steht «Abstimmen» nicht, wo das Erfordernis des
 *      Hauses keine Abstimmung trägt; dort stehen der Satz der Sperre und der
 *      Weg «Nötige Mehrheit ändern». Gegenprobe: im anderen Haus steht der
 *      Knopf, und er eröffnet, mit der Zuordnung darüber und ihrer
 *      Bestätigung im Verlauf (Ä-05, seit 16.10.2026).
 *   3. Rückkommen am Abend: Das Budget in Haus A wird abgestimmt und
 *      geschlossen, im Haus das Rückkommen gestellt, der Antrag am Abend
 *      aufgerufen, eröffnet, mit Ja angenommen und geschlossen. Danach führt
 *      «nachher» zum Budget in A, und der Abend bietet den zweiten Durchgang
 *      an, der sich eröffnen lässt. Bis `1aea421` endete der Aufruf
 *      in «Zu diesem Punkt gibt es in keiner Gemeinschaft ein Traktandum.»
 *   4. Sammelaufruf: Direkt danach ist das erste Haus «jetzt» und das zweite
 *      «nachher», in der Leitung wie an der Wand; nach dem letzten Schliessen
 *      führt «nachher» zum nächsten Haus desselben Punktes. Bis `aa4ad4e`
 *      stand «jetzt» auf dem letzten Haus (Produktentscheid 25.09.2026:
 *      Bedienung wie bei jeder anderen Abstimmung).
 *   5. Hinweise zu Betroffenen am Abend (26.09.2026): Am Nutzungsrecht in
 *      Haus A steht nach dem Ausstand einer Betroffenen der Hinweis «betroffen
 *      und im Ausstand» vor der Abstimmung. Ein Folgeantrag übernimmt die
 *      Betroffenen, die Leitung ändert sie und wählt das Mehr (seit dem
 *      08.10.2026 erbt er es nicht mehr), und vor dem Eröffnen stehen der
 *      Hinweis auf die Abweichung und die Erinnerung an den Ausstand am
 *      Grundantrag. «Betroffen und im Ausstand» und die Erinnerung standen bis
 *      dahin nur im Haus.
 *
 * Aufruf: `node e2e/abendschritte.mjs` (Umgebung wie `e2e/durchspielen.mjs`).
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const ABLAGE = process.env.ABLAGE ?? '/tmp/e2e-abendschritte';

const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Je Lauf ein anderes Datum: Zwei Erstversammlungen derselben Gemeinschaft am
 * selben Tag weist der Kern ab (Migration 028).
 */
const DATUM = new Date(Date.UTC(2034, 0, 1) + (Date.now() % 900) * 86400000)
	.toISOString()
	.slice(0, 10);
const WAHL = `Feststellung der Beschlussfähigkeit und Wahl des Protokollführers ${LAUF}`;
const BUDGET = `Budget Prüflauf ${LAUF}`;
const GARTEN = `Gartensitzplatz Prüflauf ${LAUF}`;
const FOLGE = `Gartensitzplatz geteilt ${LAUF}`;

let nummer = 0;
const fehler = [];

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

async function schritt(titel, arbeit) {
	nummer += 1;
	const marke = String(nummer).padStart(2, '0');
	try {
		const zusatz = await arbeit();
		console.log(`  ${marke} ✓ ${titel}${zusatz ? ` — ${zusatz}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${marke} ✗ ${titel} — ${e.message}`);
		await seite.screenshot({ path: `${ABLAGE}/fehler-${marke}.png`, fullPage: true }).catch(() => {});
	}
}

await mkdir(ABLAGE, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const seite = await kontext.newPage();
warteNachNavigation(seite);

async function gehe(pfad, auf = seite) {
	await auf.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await auf.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

/** Abschicken und auf die Antwort warten, nicht auf eine Frist (siehe `mischform.mjs`). */
async function abschicken(knopf) {
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(150);
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) await ja.first().click();
	const r = await antwort;
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(350);
	return r;
}

async function warteAuf(ort, was, frist = 20000) {
	await ort
		.first()
		.waitFor({ state: 'visible', timeout: frist })
		.catch(() => {
			throw new Error(`${was} erschien nicht`);
		});
}

const sauber = (t) => t.replace(/\s+/g, ' ').trim();

/**
 * Was die Seite nach einer Handlung meldet: Absage im Streifen, Erfolg in der Ecke.
 *
 * **Eine gute Meldung steht nicht in `p.meldung`.** `Meldung` gibt sie an die
 * Quittungsecke weiter (`einblenden`) und lässt die Stelle leer; siehe
 * `konten.mjs`. Die Ecke geht nach sechs Sekunden von selbst, also wird auf
 * sie gewartet und nicht auf eine Frist.
 */
async function meldungstext() {
	// Nur die Meldung selbst (sie trägt `role`), nicht die stehenden Warnungen
	// der Seite, die dieselbe Klasse führen.
	const streifen = seite.locator('p.meldung[role]');
	if (await streifen.count()) return sauber((await streifen.allInnerTexts()).join(' · '));
	const ecke = seite.locator('.quittung .text');
	await ecke.first().waitFor({ timeout: 8000 }).catch(() => {});
	if (!(await ecke.count())) return '';
	return sauber((await ecke.allInnerTexts()).join(' · '));
}

async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

/** Ein Haus mit drei Einheiten und drei Eigentümern. */
async function legeHausAn(bezeichnung) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `${bezeichnung} Prüflauf ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `${bezeichnung} nicht angelegt, Adresse ${seite.url()}`);

	const namen = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
		const name = `${wer} ${bezeichnung.slice(-1)}${LAUF.slice(-4)}`;
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill(['500', '300', '200'][i]);
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(name);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), name);
		await abschicken(zf.locator('button[type="submit"]'));
		namen.push(name);
	}
	return { id, namen };
}

/**
 * Das Erfordernis eines Traktandums im Haus unmittelbar setzen (Direktweg).
 *
 * Der Entscheidbaum ist anderswo geprüft; hier braucht es nur einen Stand.
 */
async function setzeErfordernis(versammlungId, titelanfang, typ) {
	await gehe(`/versammlungen/${versammlungId}/traktanden`);
	const eintrag = seite.locator('li[data-traktandum]').filter({ hasText: titelanfang });
	behaupte(await eintrag.count(), `«${titelanfang}» steht nicht in den Traktanden des Hauses`);
	const id = await eintrag.first().getAttribute('data-traktandum');
	await gehe(`/versammlungen/${versammlungId}/traktanden/${id}/erfordernis`);
	const aufklappen = seite.getByText('Erfordernis ohne Herleitung setzen').first();
	if (await aufklappen.count()) await aufklappen.click();
	const auswahl = seite.locator('select[name="typ"]').first();
	await auswahl.waitFor({ state: 'visible', timeout: 5000 });
	await auswahl.selectOption(typ);
	const begruendung = seite.locator('[name="begruendung"]').first();
	if (await begruendung.count()) await begruendung.fill(`Prüflauf: ${typ}.`);
	await abschicken(seite.locator('main button[type="submit"]').last());
	await gehe(`/versammlungen/${versammlungId}/traktanden`);
	const zeile = sauber(
		await seite.locator(`li[data-traktandum="${id}"]`).first().innerText()
	);
	behaupte(!/kein Mehrheitserfordernis/i.test(zeile), `Erfordernis ${typ} nicht übernommen: «${zeile}»`);
	return id;
}

/** Die Zeile eines Punktes in der Liste der Leitung. */
function punktzeile(titelanfang) {
	return seite.locator('ul.alle > li').filter({ hasText: titelanfang }).first();
}

/** Die Zeilen unter «Einzeln führen» direkt nach dem Punkt. */
async function einzelzeilen(titelanfang) {
	const danach = punktzeile(titelanfang).locator('xpath=following-sibling::li[1]');
	behaupte(
		(await danach.count()) && (await danach.getAttribute('class'))?.includes('einzeln'),
		`Unter «${titelanfang}» steht kein «Einzeln führen»`
	);
	const details = danach.locator('details');
	// Die Eigenschaft, nicht das Attribut: offen ist es `""`, und das ist falsch.
	if (!(await details.evaluate((d) => d.open))) await danach.locator('summary').click();
	return danach.locator('details > ul > li');
}

try {
	console.log(`\nEinzelschritte am laufenden Abend — ${ZIEL}\n`);

	let hausA;
	let hausB;
	let tag;
	const versammlung = {};

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

	await schritt('Zwei Häuser mit je drei Parteien', async () => {
		hausA = await legeHausAn('Schritthaus A');
		hausB = await legeHausAn('Schritthaus B');
	});

	await schritt('Ein gemeinsamer Abend, je Haus eine Versammlung', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Abendschritte ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

		for (const [name, h] of [
			['A', hausA],
			['B', hausB]
		]) {
			await gehe(`/gemeinschaften/${h.id}/versammlungen/neu`);
			await seite.fill('input[name="datum"]', DATUM);
			await seite.fill('input[name="uhrzeit"]', '18:30');
			await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
			await abschicken(seite.locator('button[form="anlegen"]'));
			const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
			behaupte(id, `Haus ${name}: keine Versammlung angelegt, Adresse ${seite.url()}`);
			versammlung[name] = id;
			await gehe(`/versammlungen/${id}`);
			await seite.locator('select[name="tag"]').first().selectOption(tag);
			await abschicken(seite.locator('button[form="angaben"]'));
			behaupte(
				(await seite.locator('select[name="tag"]').first().inputValue()) === tag,
				`Haus ${name} wurde dem Abend nicht zugeordnet`
			);
		}
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
		const text = sauber(await seite.locator('ol.liste').innerText());
		behaupte(text.includes(WAHL), `Die Wahl steht nicht in der Traktandenliste: «${text.slice(0, 300)}»`);
	});

	const budget = {};
	await schritt('Das Budget für beide Häuser, B mit einer Kenntnisnahme als Erfordernis', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		if ((await seite.locator('form#neu').count()) === 0) {
			await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
			await seite.waitForTimeout(250);
		}
		await seite.fill('input[name="titel"]', BUDGET);
		await seite.fill('input[name="antragswortlaut"]', 'Das Budget wird genehmigt.');
		await abschicken(seite.locator('button[form="neu"]'));
		budget.A = await setzeErfordernis(versammlung.A, BUDGET, 'qualifiziertes_mehr');
		budget.B = await setzeErfordernis(versammlung.B, BUDGET, 'keine_abstimmung');
		return 'A qualifiziertes Mehr, B Kenntnisnahme';
	});

	/*
	 * **Ein Nutzungsrecht nur in Haus A** (26.09.2026), für die Hinweise zu den
	 * Betroffenen am Abend. Das Erfordernis kommt aus dem Knoten, nicht aus dem
	 * Direktweg: Nur der Knoten trägt die Zustimmung Betroffener und ihre Form.
	 */
	await schritt('Ein Nutzungsrecht nur in Haus A, mit einer Betroffenen', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		if ((await seite.locator('form#neu').count()) === 0) {
			await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
			await seite.waitForTimeout(250);
		}
		await seite.fill('input[name="titel"]', GARTEN);
		await seite.fill(
			'input[name="antragswortlaut"]',
			'Der Gartensitzplatz wird Whg 1 zur ausschliesslichen Nutzung zugewiesen.'
		);
		const ohneB = seite.locator(`form#neu input[name="meetings"][value="${versammlung.B}"]`);
		behaupte(await ohneB.count(), 'Haus B steht nicht in der Auswahl des Geschäfts');
		if (await ohneB.isChecked()) await ohneB.uncheck();
		await abschicken(seite.locator('button[form="neu"]'));

		await gehe(`/versammlungen/${versammlung.A}/traktanden`);
		const zeile = seite.locator('li[data-traktandum]').filter({ hasText: GARTEN }).first();
		behaupte(await zeile.count(), 'Das Nutzungsrecht steht nicht in den Traktanden von Haus A');
		await zeile.locator('button.titel').click();
		await seite.waitForTimeout(400);
		const formular = seite.locator('form[action="?/speichern"]').first();
		await warteAuf(formular, 'Das Änderungsformular des Nutzungsrechts');
		await formular.locator('select[name="erfordernis"]').selectOption('k-nutzungsrecht-zuteilung');
		await seite.waitForTimeout(300);
		const aebi = formular.locator('label', { hasText: hausA.namen[0] }).locator('input[name="betroffene"]');
		await warteAuf(aebi, `Das Kästchen für ${hausA.namen[0]} unter «Unmittelbar betroffen»`);
		await aebi.first().check();
		await abschicken(formular.locator('button[type="submit"]').first());
		const m = await meldungstext();
		behaupte(!/nicht|fehlt|braucht/i.test(m), `Speichern des Nutzungsrechts: «${m}»`);
		return `betroffen ${hausA.namen[0]}`;
	});

	await schritt('Beide freigeben und vom Eingang aus eröffnen', async () => {
		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		await warteAuf(alle, 'Die Sammelfreigabe des Abends');
		await abschicken(alle);
		const m = await meldungstext();
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		await warteAuf(eroeffnen, `Der Knopf «eröffnen» am Eingang (Freigabe meldete: «${m}»)`);
		await abschicken(eroeffnen);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(
			(await punktzeile(WAHL).count()) > 0,
			'Die Wahl steht nicht in der Liste der Leitung des Abends'
		);
	});

	await schritt('Alle Parteien beider Häuser anwesend', async () => {
		/*
		 * Ohne Anwesende ist kein Haus beschlussfähig, und die Gegenprobe in
		 * Punkt 2 endete in der Absage «nicht beschlussfähig» statt im Eröffnen.
		 * Am Abend über den Eingang des Abends, Zeile für Zeile («Von Hand
		 * erfassen», wie in `mischform.mjs`); die Häkchenliste des Hauses gibt es
		 * dort nicht.
		 */
		const alle = [...hausA.namen, ...hausB.namen];
		for (const wer of alle) {
			await gehe(`/tage/${tag}/einlass`);
			const zeile = seite
				.locator('tbody tr', { hasText: wer })
				.filter({ has: seite.locator('form[action="?/vonHand"]') })
				.first();
			behaupte(await zeile.count(), `${wer} lässt sich nicht von Hand erfassen`);
			await abschicken(zeile.locator('form[action="?/vonHand"] button'));
		}
		await gehe(`/tage/${tag}/einlass`);
		const offen = await seite.locator('tbody tr form[action="?/vonHand"]').count();
		behaupte(offen === 0, `Nach dem Erfassen stehen noch ${offen} Zeilen mit «Von Hand erfassen»`);
		return `${alle.length} erfasst`;
	});

	// ── 1. Knopf und Kacheln am Einzelschritt ────────────────────────────────
	await schritt('Den Einzelschritt der Wahl in Haus A aufrufen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const zeilen = await einzelzeilen(WAHL);
		behaupte((await zeilen.count()) === 2, `Unter der Wahl stehen ${await zeilen.count()} statt 2 Häuser`);
		const a = zeilen.filter({ hasText: 'Schritthaus A' });
		await abschicken(a.locator('form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		const jetzt = sauber(await seite.locator('main').innerText());
		behaupte(jetzt.includes(WAHL), `Nach dem Aufruf steht die Wahl nicht auf der Seite (Meldung «${m}»)`);
		return m || 'aufgerufen';
	});

	await schritt('Am Einzelschritt steht «Beschlussfähigkeit festhalten»', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const knopf = seite.locator('form[action="?/festhalten"] button');
		behaupte(
			(await knopf.count()) > 0,
			'Der Knopf «Beschlussfähigkeit festhalten» fehlt am Einzelschritt der Wahl'
		);
		return sauber(await knopf.first().innerText());
	});

	await schritt('Festhalten wirkt am Einzelschritt', async () => {
		const r = await abschicken(seite.locator('form[action="?/festhalten"] button'));
		const m = await meldungstext();
		behaupte(r && r.status() === 200, `Die Aktion antwortete mit ${r?.status()}`);
		behaupte(/Festgehalten/.test(m), `Kein Befund im Hinweis: «${m}»`);
		return m.slice(0, 120);
	});

	await schritt('Die Saalansicht zeigt am Einzelschritt die grossen Kacheln', async () => {
		const wand = await kontext.newPage();
		warteNachNavigation(wand);
		try {
			await gehe(`/tage/${tag}/praesentation`, wand);
			await wand.waitForTimeout(800);
			const text = sauber(await wand.locator('body').innerText());
			behaupte(text.includes(WAHL.slice(0, 40)), `Die Wand zeigt die Wahl nicht: «${text.slice(0, 200)}»`);
			const kacheln = await wand.locator('section.haeuser').count();
			await wand.screenshot({ path: `${ABLAGE}/wand-einzelschritt.png` });
			behaupte(kacheln > 0, 'Die grossen Kacheln fehlen an der Wand beim Einzelschritt der Wahl');
			return 'section.haeuser steht';
		} finally {
			await wand.close();
		}
	});

	// ── 2. «Abstimmen» unter «Einzeln führen» ────────────────────────────────
	await schritt('Das Budget über die Liste aufrufen (Sammelaufruf)', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile(BUDGET).locator('form[action="?/aufrufen"] button'));
		return (await meldungstext()) || 'aufgerufen';
	});

	await schritt('Nach dem Sammelaufruf ist das erste Haus «jetzt», das zweite «nachher»', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const zeile = async (rolle) =>
			sauber(await seite.locator(`ol.dreischritt > li.${rolle}`).innerText()).replace(
				/ ?Prüflauf \d+/g,
				''
			);
		const j = await zeile('jetzt');
		const n = await zeile('nachher');
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `«Jetzt» nach dem Sammelaufruf: «${j}»`);
		behaupte(/Budget/.test(n) && /Schritthaus B/.test(n), `«Nachher» nach dem Sammelaufruf: «${n}»`);
		await seite.locator('div.raster').screenshot({ path: `${ABLAGE}/nach-sammelaufruf.png` });
		const wand = await kontext.newPage();
		warteNachNavigation(wand);
		try {
			await gehe(`/tage/${tag}/praesentation`, wand);
			await wand.waitForTimeout(800);
			// Die Nummernzeile des Punktes, nicht der ganze Text: Die Fusszeile
			// und der Feststellungssatz nennen Haus A ohnehin.
			const w = sauber(await wand.locator('section.punkt p.nummer').first().innerText());
			behaupte(
				/10\.1/.test(w) && /Schritthaus A/.test(w),
				`Die Wand zeigt nicht 10.1 in Haus A: «${w}»`
			);
		} finally {
			await wand.close();
		}
		return `${j} ‖ ${n}`;
	});

	await schritt('Haus B: statt «Abstimmen» der Satz der Sperre und der Weg', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const b = (await einzelzeilen(BUDGET)).filter({ hasText: 'Schritthaus B' });
		const text = sauber(await b.innerText());
		behaupte(
			(await b.locator('form[action="?/oeffnen"]').count()) === 0,
			`In Haus B steht «Abstimmen», obwohl das Erfordernis keine Abstimmung trägt: «${text}»`
		);
		behaupte(/Kenntnisnahme/.test(text), `Der Satz der Sperre fehlt in Haus B: «${text}»`);
		const weg = b.locator('a', { hasText: 'Nötige Mehrheit ändern' });
		behaupte(await weg.count(), `Der Weg «Nötige Mehrheit ändern» fehlt in Haus B: «${text}»`);
		const ziel = await weg.first().getAttribute('href');
		behaupte(
			ziel.includes(`/versammlungen/${versammlung.B}/traktanden/${budget.B}/erfordernis`),
			`Der Weg führt woanders hin: ${ziel}`
		);
		return text.slice(0, 90);
	});

	await schritt('Haus A: «Abstimmen» steht und eröffnet (Gegenprobe)', async () => {
		const a = (await einzelzeilen(BUDGET)).filter({ hasText: 'Schritthaus A' });
		const knopf = a.locator('form[action="?/oeffnen"] button');
		behaupte(await knopf.count(), `In Haus A fehlt «Abstimmen»: «${sauber(await a.innerText())}»`);
		/*
		 * **Der Klick bestätigt die Zuordnung wie der Hauptknopf** (Ä-05;
		 * Erhebung zur Freigabe vom 16.10.2026). Bis dahin eröffnete dieser
		 * Knopf ohne Marke und ohne Bestätigung im Verlauf.
		 */
		const satz = sauber(await a.locator('form[action="?/oeffnen"] p[data-zuordnung]').innerText());
		behaupte(
			/Mit «Abstimmen» bestätigen Sie: (Geschäftsart «.+», )?nötige Mehrheit «.+»; im Ausstand .+; anwesend oder vertreten \d+ von \d+ Parteien\./.test(
				satz
			),
			`Über «Abstimmen» steht nicht die Zuordnung: «${satz}»`
		);
		behaupte(
			(await a.locator('form[action="?/oeffnen"] input[name="zuordnung"]').count()) === 1,
			'Das Formular unter «Einzeln führen» trägt keine Marke der Zuordnung'
		);
		await a.screenshot({ path: `${ABLAGE}/einzeln-zuordnung.png` });
		await abschicken(knopf);
		const m = await meldungstext();
		behaupte(/eröffnet/i.test(m) && !/Nirgends/.test(m), `Eröffnen in Haus A: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const nachher = (await einzelzeilen(BUDGET)).filter({ hasText: 'Schritthaus A' });
		behaupte(
			await nachher.locator('form[action="?/schliessen"]').count(),
			'Nach dem Eröffnen steht in Haus A kein «Schliessen»'
		);
		return `${m} ‖ ${satz.slice(0, 80)}`;
	});

	await schritt('Das Eröffnen unter «Einzeln führen» steht als bestätigte Zuordnung im Verlauf', async () => {
		await gehe(`/verlauf?gegenstand=${versammlung.A}`);
		const zeile = seite.locator('tr:has-text("Abstimmung eröffnet")').first();
		const text = sauber(await zeile.innerText());
		behaupte(
			/Zuordnung von der Leitung bestätigt/.test(text) && /Anwesend: \d+ von \d+ Parteien/.test(text),
			`Der Eröffnungseintrag nennt die bestätigte Zuordnung nicht: «${text.slice(0, 400)}»`
		);
		return text.match(/Zuordnung von der Leitung bestätigt.{0,80}/)?.[0] ?? '';
	});

	// ── 3. Rückkommen am Abend ───────────────────────────────────────────────
	/**
	 * Alle Parteien mit Ja erfassen, am Schritt, der am Abend gerade «jetzt» ist.
	 *
	 * In der geführten Betriebsart steht die Erfassung hinter dem Ausklapper
	 * «Alle Stimmen von Hand erfassen», und die Begründung ist dort Pflicht,
	 * sonst sperrt der Browser das Absenden.
	 */
	async function erfasseAlleJa() {
		const auf = seite.locator('summary', { hasText: 'Alle Stimmen von Hand erfassen' });
		if (await auf.count()) await auf.first().click();
		const erfassung = seite.locator('form[action="?/erfassen"]');
		await warteAuf(erfassung, 'Die Stimmerfassung');
		await erfassung.locator('input[name="begruendung"]').fill('Prüflauf: im Saal von Hand abgestimmt.');
		await seite.evaluate(() => {
			document
				.querySelectorAll('details:has(form[action="?/erfassen"])')
				.forEach((d) => (d.open = true));
		});
		const ja = erfassung.locator('tbody tr input[type="radio"][value="yes"]');
		const n = await ja.count();
		behaupte(n > 0, 'In der Stimmerfassung steht keine Partei');
		for (let i = 0; i < n; i++) await ja.nth(i).check();
		await abschicken(erfassung.locator('button[type="submit"]').first());
		return n;
	}

	/** Die Zeile «jetzt» des Dreischritts, ohne Laufkennung. */
	async function jetzt() {
		return sauber(await seite.locator('ol.dreischritt > li.jetzt').innerText()).replace(
			/ ?Prüflauf \d+/g,
			''
		);
	}

	await schritt('Das Budget in A mit Ja abstimmen und schliessen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `«Jetzt» ist nicht das Budget in A: «${j}»`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m = await meldungstext();
		behaupte(/geschlossen/i.test(m), `Schliessen: «${m}»`);
		return `${n} Ja, ${m}`;
	});

	await schritt('Im Haus A das Rückkommen stellen', async () => {
		await gehe(`/versammlungen/${versammlung.A}/leitung`);
		const wort = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		await warteAuf(wort, '«Nochmals abstimmen» in der Leitung des Hauses');
		await wort.first().click();
		await seite.waitForTimeout(200);
		await abschicken(seite.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]'));
		const m = await meldungstext();
		behaupte(/steht als Antrag auf der Liste/.test(m), `Rückkommen stellen: «${m}»`);
		return m.slice(0, 80);
	});

	await schritt('Am Abend den Rückkommensantrag aufrufen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const hin = seite.locator('.rueckkommensweg form[action="?/aufrufen"] button');
		await warteAuf(hin, 'Der Weg zum Rückkommensantrag am Abend');
		await abschicken(hin);
		const m = await meldungstext();
		behaupte(/Aufgerufen in einer Gemeinschaft/.test(m), `Aufruf des Antrags: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/Rückkommen auf/.test(j), `«Jetzt» ist nicht der Rückkommensantrag: «${j}»`);
		// Die Wand bekommt die Anträge nicht als Schritt, sondern über den
		// Rückfall `einzelpunkt` (praesentation/+page.server.ts).
		const wand = await kontext.newPage();
		warteNachNavigation(wand);
		try {
			await gehe(`/tage/${tag}/praesentation`, wand);
			await wand.waitForTimeout(800);
			const w = sauber(await wand.locator('body').innerText());
			behaupte(/Rückkommen auf/.test(w), `Die Wand zeigt den Antrag nicht: «${w.slice(0, 200)}»`);
		} finally {
			await wand.close();
		}
		return j;
	});

	await schritt('Den Rückkommensantrag eröffnen, mit Ja annehmen, schliessen', async () => {
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Am aufgerufenen Antrag steht kein «Abstimmung eröffnen»');
		await abschicken(oeffnen);
		const m1 = await meldungstext();
		behaupte(/eröffnet in einer Gemeinschaft/.test(m1), `Eröffnen des Antrags: «${m1}»`);
		await gehe(`/tage/${tag}/leitung`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m2 = await meldungstext();
		behaupte(/geschlossen/i.test(m2), `Schliessen des Antrags: «${m2}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(
			(await seite.locator('.ergebnisse article.angenommen').count()) > 0,
			'Nach dem Schliessen steht kein angenommenes Ergebnis zum Antrag'
		);
		return `${n} Ja, ${m2}`;
	});

	await schritt('«Nachher» führt zum Budget in A', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const nachher = seite.locator('ol.dreischritt > li.nachher');
		const n = sauber(await nachher.innerText()).replace(/ ?Prüflauf \d+/g, '');
		behaupte(/Budget/.test(n) && /Schritthaus A/.test(n), `«Nachher» ist nicht das Budget in A: «${n}»`);
		await abschicken(nachher.locator('form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `Nach «Aufrufen» ist «jetzt»: «${j}»`);
		return j;
	});

	await schritt('Der Abend bietet den zweiten Durchgang an, und er lässt sich eröffnen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		// Satz und Knopf stehen in der Spalte «Aktuelles Geschäft», nicht im Ablauf.
		const text = sauber(await seite.locator('main').innerText());
		behaupte(
			/Die Versammlung ist zurückgekommen/.test(text),
			'Der Satz zum zweiten Durchgang fehlt'
		);
		const n = sauber(await seite.locator('ol.dreischritt > li.nachher').innerText());
		behaupte(
			/Schritthaus B/.test(n) && !/Rückkommen/.test(n),
			`«Nachher» ist nicht das Budget in B: «${n}»`
		);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Kein «Abstimmung eröffnen» für den zweiten Durchgang');
		await seite.screenshot({ path: `${ABLAGE}/zweiter-durchgang.png`, fullPage: true });
		await abschicken(oeffnen);
		/*
		 * Gemessen wird die Wirkung, nicht die Meldung: Die gute Meldung steht in
		 * der Quittungsecke und geht nach sechs Sekunden; ein Lauf am 25.09.2026
		 * fand sie leer, während die Abstimmung lief. Eine Absage steht dagegen
		 * im Streifen und bleibt.
		 */
		const m = await meldungstext();
		behaupte(!/Nirgends|nicht möglich|braucht/i.test(m), `Eröffnen des zweiten Durchgangs: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(
			(await seite.locator('.offen h4', { hasText: 'Abstimmung läuft' }).count()) > 0,
			'Nach dem Eröffnen steht am Abend nicht «Abstimmung läuft»'
		);
		return m;
	});

	await schritt('Nach dem zweiten Durchgang führt «nachher» zum Budget in B', async () => {
		await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m = await meldungstext();
		behaupte(/geschlossen/i.test(m), `Schliessen des zweiten Durchgangs: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const nachher = seite.locator('ol.dreischritt > li.nachher');
		await abschicken(nachher.locator('form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/Budget/.test(j) && /Schritthaus B/.test(j), `Nach «Aufrufen» ist «jetzt»: «${j}»`);
		return j;
	});

	/** Der Text der Eingriffe am aufgerufenen Schritt des Abends. */
	async function eingriffstext() {
		const e = seite.locator('.eingriffe');
		await warteAuf(e, '«Jetzt möglich» am Abend');
		return sauber(await e.first().innerText());
	}

	await schritt('Am Abend: betroffen und im Ausstand, Hinweis vor der Abstimmung', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile(GARTEN).locator('form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/Gartensitzplatz/.test(j), `«Jetzt» ist nicht das Nutzungsrecht: «${j}»`);

		const wort = seite.locator('.eingriffe button.wort', { hasText: 'Ausstand' });
		await warteAuf(wort, '«Ausstand» unter «Jetzt möglich»');
		await wort.first().click();
		const form = seite.locator('.eingriffe form[action="?/ausstand"]');
		await warteAuf(form, 'Das Ausstandsformular');
		const suche = form.locator('input[type="search"]');
		if (await suche.count()) await suche.fill(hausA.namen[0]);
		await form.locator('label', { hasText: hausA.namen[0] }).first().click();
		await form.locator('input[name="grund"]').fill('Prüflauf: verbunden mit dem Geschäft.');
		await abschicken(form.locator('button[type="submit"]'));
		await gehe(`/tage/${tag}/leitung`);
		const t = await eingriffstext();
		behaupte(
			t.includes(`«${hausA.namen[0]}» ist im Ausstand und als unmittelbar betroffen bezeichnet`),
			`Am Abend fehlt der Hinweis «betroffen und im Ausstand»: «${t.slice(0, 400)}»`
		);
		return 'Hinweis steht';
	});

	await schritt('Am Abend: Folgeantrag mit anderen Betroffenen, zwei Hinweise vor dem Eröffnen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const wort = seite.locator('.eingriffe button.wort', { hasText: 'Gegenantrag' });
		await warteAuf(wort, '«Gegenantrag» unter «Jetzt möglich»');
		await wort.first().click();
		const form = seite.locator('.eingriffe form[action="?/aufnehmen"]');
		await warteAuf(form, 'Das Formular des Folgeantrags');
		const feld = form.locator('fieldset', { hasText: 'Unmittelbar betroffen' });
		behaupte(await feld.count(), 'Das Formular des Folgeantrags führt am Abend keine Betroffenen');
		const stand = sauber(await feld.locator('.stand').innerText());
		behaupte(
			stand === `Gewählt: ${hausA.namen[0]}`,
			`Die Betroffenen des Grundantrags sind am Abend nicht vorausgewählt: ${stand}`
		);
		const suche = feld.locator('input[type="search"]');
		if (await suche.count()) await suche.fill(LAUF.slice(-4));
		await feld.locator('label', { hasText: hausA.namen[0] }).first().click();
		await feld.locator('label', { hasText: hausA.namen[1] }).first().click();
		await form.locator('input[name="titel"]').fill(FOLGE);
		await form
			.locator('[name="antragswortlaut"]')
			.fill('Der Gartensitzplatz wird zwischen Whg 1 und Whg 2 geteilt.');
		/*
		 * **Das Mehr wählt die Leitung selbst** (Produktentscheid 08.10.2026,
		 * `fca4644`): Der Folgeantrag erbt es nicht mehr vom Grundantrag. Ohne
		 * gewähltes Mehr trägt die Aufnahme die Betroffenen nicht ein und sagt,
		 * dass sie danach einzutragen sind (`server/saalaufnahme.ts`). Gewählt
		 * wird dasselbe wie beim Grundantrag, das die Zustimmung der Betroffenen
		 * verlangt; ohne ein solches fragt der Abend gar nicht nach der
		 * Abweichung (`fragtNachBetroffenenabweichung`, `domain/folgeantrag.ts`).
		 */
		await form.locator('select[name="erfordernis"]').selectOption('k-nutzungsrecht-zuteilung');
		await abschicken(form.locator('button[type="submit"]').first());
		const m = await meldungstext();
		behaupte(
			m.includes(`Als unmittelbar betroffen eingetragen: ${hausA.namen[1]}.`),
			`Die geänderte Auswahl ist nicht eingetragen: «${m}»`
		);

		await gehe(`/tage/${tag}/leitung`);
		/*
		 * Ein im Saal aufgenommener Antrag steht nicht in «Alle Traktanden»,
		 * sondern im Ablauf, gleich nach dem Aufnehmen unter «vorher».
		 */
		const zeile = seite.locator('ol.dreischritt > li').filter({ hasText: FOLGE });
		behaupte(await zeile.count(), 'Der Folgeantrag steht nicht im Ablauf des Abends');
		await abschicken(zeile.first().locator('form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetzt();
		behaupte(/geteilt/.test(j), `«Jetzt» ist nicht der Folgeantrag: «${j}»`);
		const t = await eingriffstext();
		behaupte(
			t.includes(`Neu betroffen: «${hausA.namen[1]}»`),
			`Am Abend fehlt der Hinweis auf neu Betroffene: «${t.slice(0, 400)}»`
		);
		behaupte(
			t.includes(`Nicht mehr betroffen: «${hausA.namen[0]}»`),
			`Am Abend fehlt der Hinweis auf weggefallene Betroffene: «${t.slice(0, 400)}»`
		);
		behaupte(
			/Beim Grundantrag ist .* in den Ausstand getreten/.test(t) && /nicht von selbst/.test(t),
			`Am Abend fehlt die Erinnerung an den Ausstand am Grundantrag: «${t.slice(0, 400)}»`
		);
		await seite.screenshot({ path: `${ABLAGE}/folgeantrag-hinweise.png`, fullPage: true });
		return 'Abweichung und Erinnerung stehen';
	});

	await seite.screenshot({ path: `${ABLAGE}/leitung.png`, fullPage: true });
} finally {
	await browser.close();
}

if (fehler.length > 0) {
	console.log(`\n${fehler.length} Befunde:`);
	for (const f of fehler) console.log(`- ${f}`);
	process.exit(1);
}
console.log('\nAlles grün.');
