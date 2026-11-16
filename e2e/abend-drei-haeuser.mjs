/**
 * Durchstich: Drei Häuser am Abend, «jetzt» folgt dem jüngsten Aufruf, und ein
 * Folgeantrag läuft als eigener Schritt.
 *
 * **Zwei Lücken, die vorher nur aus dem Code gelesen waren** (Auftrag
 * `.auftraege/erledigt/2026-09-25-abend-jetzt-und-folgeantrag.md`):
 *
 *   1a. Drei Häuser auf der gemeinsamen Begrüssung, dann «nachher» in den
 *       ersten Einzelschritt des nächsten Punktes (Wahl in A). Aufgerufen wird
 *       nur A. Vor dem Umbau blieb «jetzt» auf der Begrüssung stehen (zwei
 *       Häuser gegen eines), während die Wand den neuen Punkt zeigte. **Mit
 *       `b71b0df` rot.**
 *   1b. Sammelaufruf eines Punktes, den nur A und B führen (Budget), C bleibt
 *       auf der Begrüssung. Danach ist «jetzt» das Budget in A und «nachher»
 *       das Budget in B. Mit `b71b0df` grün; die Probe hält den Weg fest.
 *   2.  Ein im Saal aufgenommener Gegenantrag (Folgeantrag) am Budget in A.
 *       Am Abend steht er als eigener Schritt direkt vor dem Budget in A,
 *       lässt sich aufrufen, eröffnen und mit Stimmen schliessen; danach führt
 *       «nachher» zum Budget in A. Vor dem Umbau erschien er am Abend
 *       nirgends, und `?/aufrufen` antwortete mit der Absage. **Mit `b71b0df`
 *       rot.** Das Mehr wählt 2a bei der Aufnahme selbst: Seit `fca4644`
 *       erbt der Folgeantrag es nicht mehr.
 *
 * **Dazu der Mischfall** (Auftrag
 * `.auftraege/erledigt/2026-09-25-abend-mischfall-rueckkommen-gegenantrag.md`), in der
 * Laufreihenfolge zwischen 2 und 1a:
 *
 *   3.  Nach dem Gegenantrag wird das Budget in A abgestimmt, im Haus das
 *       Rückkommen gestellt, am Abend angenommen und der zweite Durchgang
 *       geführt. Die Folge im Dreischritt ist Gegenantrag, Rückkommensantrag,
 *       Budget. **3e ist ein Messschritt ohne Behauptung:** Er hält fest, ob
 *       vor dem zweiten Durchgang ein Gegenantrag angeboten und vom Server
 *       angenommen wird. Den Server fragt er nur über die Aktion des Abends.
 *       Danach ist keine Abstimmung offen, und 1a setzt zurück.
 *
 * Aufruf wie `e2e/abendschritte.mjs`: `node e2e/abend-drei-haeuser.mjs`.
 * Die Namen tragen «Prüflauf», damit `scripts/testdaten-entfernen.sql` sie
 * wiederfindet.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Je Lauf ein anderes Datum: Zwei Erstversammlungen derselben Gemeinschaft am
 * selben Tag weist der Kern ab (Migration 028).
 */
const DATUM = new Date(Date.UTC(2035, 0, 1) + (Date.now() % 800) * 86400000)
	.toISOString()
	.slice(0, 10);
const WAHL = `Feststellung der Beschlussfähigkeit und Wahl des Protokollführers Prüflauf ${LAUF}`;
const BUDGET = `Budget Prüflauf ${LAUF}`;
const FOLGEANTRAG = `Gegenantrag Budget Prüflauf ${LAUF}`;

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
	}
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const seite = await kontext.newPage();
warteNachNavigation(seite);

async function gehe(pfad, auf = seite) {
	await auf.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await auf.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

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

/** Wie `abschicken`, gibt aber den Rumpf der Antwort zurück (für `aufgenommen`). */
async function abschickenAntwort(knopf) {
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(150);
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) await ja.first().click();
	const r = await antwort;
	const rohtext = r ? await r.text().catch(() => '') : '';
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(350);
	return { status: r?.status() ?? null, rohtext };
}

function aktionsdaten(rohtext) {
	try {
		return JSON.parse(rohtext);
	} catch {
		return null;
	}
}

/*
 * `devalue` packt Aktionsantworten als `[ {…}, … ]`: Zahlen sind Indizes in
 * dieselbe Liste. Genau `aufgenommen` wird hier gebraucht; ohne das Auspacken
 * bleibt «Kennung null».
 */
function aktionsfelder(rohtext) {
	const d = aktionsdaten(rohtext);
	if (!d) return null;
	let roh = d.data;
	if (typeof roh === 'string') {
		try {
			roh = JSON.parse(roh);
		} catch {
			return null;
		}
	}
	if (!Array.isArray(roh) || typeof roh[0] !== 'object' || roh[0] === null) {
		return typeof roh === 'object' && roh !== null ? roh : null;
	}
	const aufloesen = (v) => {
		if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < roh.length) {
			return v === 0 ? undefined : aufloesen(roh[v]);
		}
		if (Array.isArray(v)) return v.map(aufloesen);
		if (v && typeof v === 'object') {
			const o = {};
			for (const [k, x] of Object.entries(v)) o[k] = aufloesen(x);
			return o;
		}
		return v;
	};
	return aufloesen(roh[0]) ?? null;
}

async function warteAuf(ort, was, frist = 20000) {
	await ort
		.first()
		.waitFor({ state: 'visible', timeout: frist })
		.catch(() => {
			throw new Error(`${was} erschien nicht`);
		});
}

const sauber = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

async function meldungstext() {
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

/** Ein Haus mit drei Einheiten und drei Eigentümern (wörtlich aus `abendschritte.mjs`). */
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

/** Einen Abend mit den übergebenen Häusern anlegen (wie `abendschritte.mjs`). */
async function legeAbendAn(bezeichnung, haeuser) {
	await gehe('/versammlungen/neu');
	await seite.locator('input[name="art"][value="gemeinsam"]').check();
	await seite.fill('input[name="bezeichnung"]', bezeichnung);
	await seite.fill('input[name="datum"]', DATUM);
	await seite.fill('input[name="uhrzeit"]', '18:30');
	await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
	await abschicken(seite.locator('button[form="anlegen"]'));
	behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
	const tagId = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

	const versammlung = {};
	for (const h of haeuser) {
		await gehe(`/gemeinschaften/${h.id}/versammlungen/neu`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
		behaupte(id, `${h.id}: keine Versammlung angelegt, Adresse ${seite.url()}`);
		// Der Schlüssel ist der Kurzbuchstabe («Schritthaus A» → «A»).
		versammlung[h.bezeichnung.slice(-1)] = id;
		await gehe(`/versammlungen/${id}`);
		await seite.locator('select[name="tag"]').first().selectOption(tagId);
		await abschicken(seite.locator('button[form="angaben"]'));
		behaupte(
			(await seite.locator('select[name="tag"]').first().inputValue()) === tagId,
			`Haus ${h.bezeichnung} wurde dem Abend nicht zugeordnet`
		);
	}
	return { tag: tagId, versammlung };
}

/** Ein Traktandum in den angekreuzten Häusern anlegen (`ohne` wird abgewählt). */
async function geschaeftAnlegen(tagId, titel, antragswortlaut, ohne = []) {
	await gehe(`/tage/${tagId}/geschaefte`);
	if ((await seite.locator('form#neu').count()) === 0) {
		await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
		await seite.waitForTimeout(250);
	}
	await seite.fill('input[name="titel"]', titel);
	await seite.fill('input[name="antragswortlaut"]', antragswortlaut);
	for (const id of ohne) {
		const kaestchen = seite.locator(`form#neu input[name="meetings"][value="${id}"]`);
		behaupte(await kaestchen.count(), `Haus ${id} steht nicht in der Auswahl`);
		if (await kaestchen.isChecked()) await kaestchen.uncheck();
	}
	await abschicken(seite.locator('button[form="neu"]'));
	const text = sauber(await seite.locator('ol.liste').innerText());
	behaupte(text.includes(titel), `«${titel}» steht nicht in der Liste: «${text.slice(0, 300)}»`);
}

/** Das Erfordernis eines Traktandums im Haus unmittelbar setzen. */
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
	const zeile = sauber(await seite.locator(`li[data-traktandum="${id}"]`).first().innerText());
	behaupte(!/kein Mehrheitserfordernis/i.test(zeile), `Erfordernis ${typ} nicht übernommen: «${zeile}»`);
	return id;
}

function punktzeile(titelanfang) {
	return seite.locator('ul.alle > li').filter({ hasText: titelanfang }).first();
}

/** Die Zeilen des Dreischritts einzeln, ohne Laufkennung. */
async function dreischrittZeilen() {
	return (await seite.locator('ol.dreischritt > li').allInnerTexts()).map((t) =>
		sauber(t).replace(/ ?Prüflauf \d+/g, '')
	);
}

async function jetztText() {
	return sauber(await seite.locator('ol.dreischritt > li.jetzt').innerText()).replace(
		/ ?Prüflauf \d+/g,
		''
	);
}

/** Die Nummernzeile der Wand. */
async function wandLesen(suche = null) {
	const wand = await kontext.newPage();
	warteNachNavigation(wand);
	try {
		await gehe(`/tage/${tag}/praesentation`, wand);
		await wand.waitForTimeout(800);
		const nummerWand = sauber(
			await wand
				.locator('section.punkt p.nummer')
				.first()
				.innerText()
				.catch(() => '—')
		);
		const titel = sauber(
			await wand
				.locator('section.punkt h1')
				.first()
				.innerText()
				.catch(() => '—')
		);
		const text = sauber(await wand.locator('body').innerText());
		return { nummer: nummerWand, titel, text, enthaelt: suche ? text.includes(suche) : null };
	} finally {
		await wand.close();
	}
}

/** Alle Parteien des Abends am Eingang von Hand als anwesend erfassen. */
async function erfasseAnwesende(wer) {
	await gehe(`/tage/${tag}/einlass`);
	const zeile = seite
		.locator('tbody tr', { hasText: wer })
		.filter({ has: seite.locator('form[action="?/vonHand"]') })
		.first();
	behaupte(await zeile.count(), `${wer} lässt sich nicht von Hand erfassen`);
	await abschicken(zeile.locator('form[action="?/vonHand"] button'));
}

/**
 * Alle Parteien mit Ja erfassen, am Schritt, der am Abend gerade «jetzt» ist.
 * Wörtlich aus `abendschritte.mjs`.
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

const hausA = { bezeichnung: 'Schritthaus A' };
const hausB = { bezeichnung: 'Schritthaus B' };
const hausC = { bezeichnung: 'Schritthaus C' };

let tag = null;
let versammlung = {};
let folgeId = null;
let aufnahmefelder = null;

try {
	console.log(`\nDrei Häuser am Abend und ein Folgeantrag: ${ZIEL}\n`);

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

	await schritt('Drei Häuser mit je drei Parteien', async () => {
		Object.assign(hausA, await legeHausAn(hausA.bezeichnung));
		Object.assign(hausB, await legeHausAn(hausB.bezeichnung));
		Object.assign(hausC, await legeHausAn(hausC.bezeichnung));
		return 'A, B, C';
	});

	await schritt('Ein gemeinsamer Abend, je Haus eine Versammlung', async () => {
		const a = await legeAbendAn(`Dreihäuserabend Prüflauf ${LAUF}`, [hausA, hausB, hausC]);
		tag = a.tag;
		versammlung = a.versammlung;
		return tag;
	});

	await schritt('Die Wahl als Abstimmung für alle drei Häuser aufnehmen', async () => {
		await geschaeftAnlegen(tag, WAHL, 'Zum Protokollführer wird die Verwaltung gewählt.');
		return 'drei Häuser';
	});

	await schritt('Das Budget für A und B aufnehmen (C nicht beteiligt)', async () => {
		await geschaeftAnlegen(tag, BUDGET, 'Das Budget wird genehmigt.', [versammlung.C]);
		return 'A und B';
	});

	await schritt('Das Budget trägt in A und B ein qualifiziertes Mehr', async () => {
		await setzeErfordernis(versammlung.A, BUDGET, 'qualifiziertes_mehr');
		await setzeErfordernis(versammlung.B, BUDGET, 'qualifiziertes_mehr');
		return 'A und B: qualifiziertes_mehr';
	});

	await schritt('Alle drei freigeben und vom Eingang aus eröffnen', async () => {
		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		await warteAuf(alle, 'Die Sammelfreigabe des Abends');
		await abschicken(alle);
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		await warteAuf(eroeffnen, 'Der Knopf «eröffnen» am Eingang');
		await abschicken(eroeffnen);
		await gehe(`/tage/${tag}/leitung`);
		behaupte((await punktzeile('Begrüssung').count()) > 0, 'Die Begrüssung fehlt in der Leitung');
	});

	await schritt('Alle neun Parteien anwesend', async () => {
		const alle = [...hausA.namen, ...hausB.namen, ...hausC.namen];
		for (const wer of alle) await erfasseAnwesende(wer);
		await gehe(`/tage/${tag}/einlass`);
		const offen = await seite.locator('tbody tr form[action="?/vonHand"]').count();
		behaupte(offen === 0, `Nach dem Erfassen stehen noch ${offen} Zeilen mit «Von Hand erfassen»`);
		return `${alle.length} erfasst`;
	});

	await schritt('Die Begrüssung ruft alle drei Häuser auf einen gemeinsamen Schritt', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile('Begrüssung').locator('form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		behaupte(/in 3 Gemeinschaften/.test(m), `Sammelaufruf der Begrüssung: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(/Begrüssung/.test(await jetztText()), 'Die Begrüssung ist nicht «jetzt»');
		return m;
	});

	// ── 1b: Sammelaufruf eines Punktes, den nur A und B führen ──────────────
	await schritt('1b: Sammelaufruf Budget, «jetzt» ist das Budget in A, «nachher» in B', async () => {
		await gehe(`/tage/${tag}/leitung`);
		behaupte(/Begrüssung/.test(await jetztText()), 'Vor dem Aufruf ist «jetzt» nicht die Begrüssung');
		await abschicken(punktzeile(BUDGET).locator('form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		behaupte(/in 2 Gemeinschaften/.test(m), `Sammelaufruf Budget: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `«Jetzt» ist nicht das Budget in A: «${j}»`);
		const n = sauber(await seite.locator('ol.dreischritt > li.nachher').innerText());
		behaupte(
			/Budget/.test(n) && /Schritthaus B/.test(n),
			`«Nachher» ist nicht das Budget in B: «${n}»`
		);
		return `${j} → ${n.replace(/ ?Prüflauf \d+/g, '')}`;
	});

	// ── 2: Folgeantrag am Abend ─────────────────────────────────────────────
	await schritt('2a: Folgeantrag im Saal aufnehmen (Grundantrag Budget in A)', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `«Jetzt» ist nicht das Budget in A: «${j}»`);
		const wort = seite.locator('.eingriffe button.wort', { hasText: 'Gegenantrag' });
		await warteAuf(wort, 'Der Eingriff «Gegenantrag»');
		await wort.first().click();
		await seite.waitForTimeout(200);
		const form = seite.locator('.eingriffe form[action="?/aufnehmen"]');
		await warteAuf(form, 'Das Formular für den Folgeantrag');
		await form.locator('input[name="titel"]').fill(FOLGEANTRAG);
		await form
			.locator('textarea[name="antragswortlaut"]')
			.fill('Der Betrag wird auf 120 000 Franken erhöht.');
		// Seit dem Produktentscheid vom 08.10.2026 (`fca4644`) erbt ein
		// Folgeantrag das Mehr des Grundantrags nicht mehr; ohne Wahl steht er
		// am Abend ohne Erfordernis da, und 2c fände «Abstimmung eröffnen» nicht.
		// Wie das Budget in A: qualifiziertes Mehr.
		await form.locator('select[name="erfordernis"]').selectOption('k-verwaltung-wichtig');
		// Für Schritt 3e: dieselben Felder, damit der Server auch dann gefragt
		// werden kann, wenn die Seite den Eingriff nicht mehr anbietet.
		aufnahmefelder = await form.evaluate((f) => [...new FormData(f).entries()]);
		const { rohtext } = await abschickenAntwort(form.locator('button[type="submit"]'));
		folgeId = aktionsfelder(rohtext)?.aufgenommen ?? null;
		behaupte(
			typeof folgeId === 'string' && /^[0-9a-f-]{36}$/.test(folgeId),
			`Keine Kennung des aufgenommenen Antrags: ${folgeId}`
		);
		return folgeId;
	});

	await schritt('2b: Er steht im Dreischritt vor dem Budget in A und lässt sich aufrufen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const zeilen = await dreischrittZeilen();
		// Die Laufkennung ist oben entfernt; gesucht wird über die festen Wörter.
		const iAntrag = zeilen.findIndex((z) => z.includes('Gegenantrag Budget'));
		const iBudget = zeilen.findIndex(
			(z) => z.includes('Budget') && z.includes('Schritthaus A') && !z.includes('Gegenantrag')
		);
		behaupte(iAntrag >= 0, `Der Folgeantrag steht nicht im Dreischritt: ${zeilen.join(' | ')}`);
		behaupte(iBudget >= 0, `Das Budget in A steht nicht im Dreischritt: ${zeilen.join(' | ')}`);
		behaupte(
			iAntrag + 1 === iBudget,
			`Der Folgeantrag steht nicht direkt vor dem Budget: ${zeilen.join(' | ')}`
		);
		const antragZeile = seite.locator('ol.dreischritt > li').nth(iAntrag);
		const knopf = antragZeile.locator('form[action="?/aufrufen"] button');
		behaupte(await knopf.count(), `Am Folgeantrag steht kein Aufrufen-Knopf: «${zeilen[iAntrag]}»`);
		await abschicken(knopf);
		const m = await meldungstext();
		behaupte(/Aufgerufen in einer Gemeinschaft/.test(m), `Aufruf des Folgeantrags: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(
			j.includes('Gegenantrag Budget') && j.includes('Schritthaus A'),
			`«Jetzt» ist nicht der Folgeantrag in A: «${j}»`
		);
		// Die Wand bekommt den Antrag nicht als Schritt, sondern über den
		// Rückfall `einzelpunkt` (praesentation/+page.server.ts).
		const w = await wandLesen(FOLGEANTRAG);
		behaupte(w.enthaelt, `Die Wand zeigt den Folgeantrag nicht: «${w.text.slice(0, 200)}»`);
		/*
		 * **FR-60/FR-62.** Mit dem eigenen Schritt wird `eingriffe.istFolgeantrag`
		 * am Abend erreichbar und damit die Zulässigkeitsprüfung. Ist keine KI
		 * verfügbar, muss dort sichtbar der Grund stehen, nicht nichts.
		 */
		const pruefen = seite.getByRole('button', { name: 'Zulässigkeit prüfen' });
		const kiGrund = seite.locator('p.klein').filter({
			hasText:
				/kein Modell eingerichtet|KI-Unterstützung nicht zugelassen|läuft ohne Netz|für diese Gemeinschaft ausgenommen/
		});
		const kiKnopf = await pruefen.count();
		behaupte(
			kiKnopf > 0 || (await kiGrund.count()) > 0,
			'Am Folgeantrag fehlt die Zulässigkeitsprüfung ganz: weder Knopf noch Begründung'
		);
		const kiText = kiKnopf > 0 ? 'KI verfügbar: «Zulässigkeit prüfen» steht' : sauber(await kiGrund.first().innerText());
		return `${j} ‖ ${kiText}`;
	});

	await schritt('2c: Er lässt sich eröffnen, mit Stimmen schliessen, «nachher» ist das Budget', async () => {
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Am aufgerufenen Folgeantrag steht kein «Abstimmung eröffnen»');
		await abschicken(oeffnen);
		const m1 = await meldungstext();
		behaupte(/eröffnet in einer Gemeinschaft/.test(m1), `Eröffnen des Folgeantrags: «${m1}»`);
		await gehe(`/tage/${tag}/leitung`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m2 = await meldungstext();
		behaupte(/geschlossen/i.test(m2), `Schliessen des Folgeantrags: «${m2}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(
			(await seite.locator('.ergebnisse article.angenommen').count()) > 0,
			'Nach dem Schliessen steht kein angenommenes Ergebnis zum Folgeantrag'
		);
		const n2 = sauber(await seite.locator('ol.dreischritt > li.nachher').innerText());
		behaupte(
			/Budget/.test(n2) && /Schritthaus A/.test(n2),
			`«Nachher» ist nicht das Budget in A: «${n2}»`
		);
		return `${n} Ja, ${m2}`;
	});

	// ── 3: Gegen- und Rückkommensantrag am selben Grundantrag ──────────────
	await schritt('3a: Das Budget in A aufrufen, abstimmen und schliessen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('ol.dreischritt > li.nachher form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j) && !/Gegenantrag/.test(j), `«Jetzt» ist nicht das Budget in A: «${j}»`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Am Budget in A steht kein «Abstimmung eröffnen»');
		await abschicken(oeffnen);
		await gehe(`/tage/${tag}/leitung`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m = await meldungstext();
		behaupte(/geschlossen/i.test(m), `Schliessen des Budgets in A: «${m}»`);
		return `${n} Ja, ${m}`;
	});

	await schritt('3b: Im Haus A das Rückkommen stellen', async () => {
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

	await schritt('3c: Der Rückkommensantrag steht zwischen Gegenantrag und Budget, aufrufen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const zeilen = await dreischrittZeilen();
		const iGegen = zeilen.findIndex((z) => z.includes('Gegenantrag Budget'));
		const iRueck = zeilen.findIndex((z) => z.includes('Rückkommen auf'));
		const iBudget = zeilen.findIndex(
			(z) =>
				z.includes('Budget') &&
				z.includes('Schritthaus A') &&
				!z.includes('Gegenantrag') &&
				!z.includes('Rückkommen')
		);
		const liste = zeilen.join(' | ');
		behaupte(iRueck >= 0, `Der Rückkommensantrag steht nicht im Dreischritt: ${liste}`);
		behaupte(iBudget >= 0, `Das Budget in A steht nicht im Dreischritt: ${liste}`);
		behaupte(iRueck < iBudget, `Der Rückkommensantrag steht nicht vor dem Budget: ${liste}`);
		// Der Gegenantrag kann aus dem Fenster gerückt sein; steht er da, dann davor.
		behaupte(iGegen < 0 || iGegen < iRueck, `Der Gegenantrag steht nicht vor dem Rückkommen: ${liste}`);
		const vorher = liste;
		const hin = seite.locator('.rueckkommensweg form[action="?/aufrufen"] button');
		await warteAuf(hin, 'Der Weg zum Rückkommensantrag am Abend');
		await abschicken(hin);
		const m = await meldungstext();
		behaupte(/Aufgerufen in einer Gemeinschaft/.test(m), `Aufruf des Rückkommensantrags: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Rückkommen auf/.test(j), `«Jetzt» ist nicht der Rückkommensantrag: «${j}»`);
		/*
		 * Erst jetzt stehen alle drei im Fenster: Vor dem Aufruf ist das Budget
		 * «jetzt», und der Gegenantrag liegt zwei Schritte davor.
		 */
		const danach = await dreischrittZeilen();
		const g = danach.findIndex((z) => z.includes('Gegenantrag Budget'));
		const r = danach.findIndex((z) => z.includes('Rückkommen auf'));
		const b = danach.findIndex(
			(z) =>
				z.includes('Budget') &&
				z.includes('Schritthaus A') &&
				!z.includes('Gegenantrag') &&
				!z.includes('Rückkommen')
		);
		behaupte(
			g >= 0 && r > g && b > r,
			`Nicht in der Folge Gegenantrag, Rückkommen, Budget: ${danach.join(' | ')}`
		);
		return `vor dem Aufruf: ${vorher} ‖ danach: ${danach.join(' | ')}`;
	});

	await schritt('3d: Den Rückkommensantrag eröffnen, mit Ja annehmen, schliessen', async () => {
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Am Rückkommensantrag steht kein «Abstimmung eröffnen»');
		await abschicken(oeffnen);
		const m1 = await meldungstext();
		behaupte(/eröffnet in einer Gemeinschaft/.test(m1), `Eröffnen des Rückkommensantrags: «${m1}»`);
		await gehe(`/tage/${tag}/leitung`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m2 = await meldungstext();
		behaupte(/geschlossen/i.test(m2), `Schliessen des Rückkommensantrags: «${m2}»`);
		await gehe(`/tage/${tag}/leitung`);
		const nachher = sauber(await seite.locator('ol.dreischritt > li.nachher').innerText());
		behaupte(
			/Budget/.test(nachher) && /Schritthaus A/.test(nachher) && !/Rückkommen|Gegenantrag/.test(nachher),
			`«Nachher» ist nicht das Budget in A: «${nachher}»`
		);
		await abschicken(seite.locator('ol.dreischritt > li.nachher form[action="?/aufrufen"] button'));
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `Nach «Aufrufen» ist «jetzt»: «${j}»`);
		return `${n} Ja, ${m2} ‖ ${(await dreischrittZeilen()).join(' | ')}`;
	});

	/*
	 * **Messschritt, keine Behauptung** (Teil 2 des Auftrags
	 * `2026-09-25-abend-mischfall-rueckkommen-gegenantrag.md`). Nach dem
	 * angenommenen Rückkommen, vor dem Eröffnen des zweiten Durchgangs: Bietet
	 * die Leitung einen Gegenantrag an, und nimmt der Server ihn an? Der Schritt
	 * hält fest, was geschieht, und wird nur rot, wenn sich nichts messen lässt.
	 */
	await schritt('3e: Messung: Gegenantrag im zweiten Durchgang', async () => {
		behaupte(aufnahmefelder, 'Die Felder aus 2a fehlen');
		await gehe(`/versammlungen/${versammlung.A}/leitung`);
		const imHaus = (await seite.locator('.eingriffe .wort').allInnerTexts()).map(sauber);
		await gehe(`/tage/${tag}/leitung`);
		const amAbend = (await seite.locator('.eingriffe .wort').allInnerTexts()).map(sauber);
		const felder = aufnahmefelder.map(([k, v]) =>
			k === 'titel' ? [k, `Gegenantrag zweiter Durchgang Prüflauf ${LAUF}`] : [k, v]
		);
		const antwort = await seite.evaluate(
			async ({ ziel, felder }) => {
				const fd = new FormData();
				for (const [k, v] of felder) fd.append(k, v);
				const r = await fetch(ziel, {
					method: 'POST',
					body: fd,
					headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
				});
				return { status: r.status, rohtext: await r.text() };
			},
			{ ziel: `${ZIEL}/tage/${tag}/leitung?/aufnehmen`, felder }
		);
		const d = aktionsdaten(antwort.rohtext);
		const f = aktionsfelder(antwort.rohtext);
		const server =
			d?.type === 'failure'
				? `abgewiesen (${d.status ?? antwort.status}): «${sauber(f?.fehler)}»`
				: d?.type === 'success'
					? `angenommen, Kennung ${f?.aufgenommen ?? '?'}`
					: `unklar (${antwort.status}): ${antwort.rohtext.slice(0, 200)}`;
		behaupte(!server.startsWith('unklar'), `Antwort nicht lesbar: ${server}`);
		const angeboten = (l) => (l.some((w) => /Gegenantrag/.test(w)) ? 'angeboten' : 'nicht angeboten');
		return (
			`Haus A: Gegenantrag ${angeboten(imHaus)} [${imHaus.join(', ')}] ‖ ` +
			`Abend: ${angeboten(amAbend)} [${amAbend.join(', ')}] ‖ Server: ${server}`
		);
	});

	await schritt('3f: Der zweite Durchgang lässt sich eröffnen und schliessen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(/Budget/.test(j) && /Schritthaus A/.test(j), `«Jetzt» ist nicht das Budget in A: «${j}»`);
		const text = sauber(await seite.locator('main').innerText());
		behaupte(/Die Versammlung ist zurückgekommen/.test(text), 'Der Satz zum zweiten Durchgang fehlt');
		const oeffnen = seite.locator('form[action="?/oeffnen"] button.haupt');
		behaupte(await oeffnen.count(), 'Kein «Abstimmung eröffnen» für den zweiten Durchgang');
		await abschicken(oeffnen);
		const m1 = await meldungstext();
		behaupte(!/Nirgends|nicht möglich|braucht/i.test(m1), `Eröffnen des zweiten Durchgangs: «${m1}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(
			(await seite.locator('.offen h4', { hasText: 'Abstimmung läuft' }).count()) > 0,
			'Nach dem Eröffnen steht am Abend nicht «Abstimmung läuft»'
		);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m2 = await meldungstext();
		behaupte(/geschlossen/i.test(m2), `Schliessen des zweiten Durchgangs: «${m2}»`);
		await gehe(`/tage/${tag}/leitung`);
		const offen = await seite.locator('.offen h4', { hasText: 'Abstimmung läuft' }).count();
		// `.offen` zeigt nur den Schritt «jetzt»; jede Abstimmung dieser Datei
		// wird dort eröffnet und geschlossen.
		behaupte(offen === 0, 'Nach dem Schliessen läuft am Budget in A noch eine Abstimmung');
		return `${n} Ja, ${m2}`;
	});

	// ── 1a: «nachher» in den ersten Einzelschritt, drei Häuser ──────────────
	await schritt('1a: Zurücksetzen, die Begrüssung ruft wieder alle drei', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile('Begrüssung').locator('form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		behaupte(/in 3 Gemeinschaften/.test(m), `Sammelaufruf der Begrüssung: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		behaupte(/Begrüssung/.test(await jetztText()), 'Nach dem Zurücksetzen ist «jetzt» nicht die Begrüssung');
		return m;
	});

	await schritt('1a: «nachher» in den ersten Einzelschritt, «jetzt» und Wand folgen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		behaupte(/Begrüssung/.test(await jetztText()), 'Vor dem Klick ist «jetzt» nicht die Begrüssung');
		const nachherVor = sauber(await seite.locator('ol.dreischritt > li.nachher').innerText());
		behaupte(/Wahl/.test(nachherVor), `«Nachher» ist nicht die Wahl: «${nachherVor}»`);
		await abschicken(seite.locator('ol.dreischritt > li.nachher form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		behaupte(/Aufgerufen in einer Gemeinschaft/.test(m), `Aufruf über «nachher»: «${m}»`);
		await gehe(`/tage/${tag}/leitung`);
		const j = await jetztText();
		behaupte(
			/Wahl der Stimmenzähler/.test(j) && /Schritthaus A/.test(j),
			`«Jetzt» ist nicht die Wahl in A: «${j}»`
		);
		const nummerJetzt = j.match(/JETZT\s+(\S+)/)?.[1] ?? '';
		const w = await wandLesen();
		behaupte(
			/Wahl der Stimmenzähler/.test(w.titel),
			`Die Wand zeigt nicht die Wahl: «${w.nummer} ${w.titel}»`
		);
		behaupte(
			w.nummer.match(/^(\S+)/)?.[1] === nummerJetzt,
			`Die Wand zeigt eine andere Nummer als «jetzt»: «${w.nummer}» statt «${nummerJetzt}»`
		);
		behaupte(w.text.includes('Schritthaus A'), `Die Wand nennt Haus A nicht: «${w.text.slice(0, 200)}»`);
		return `${j} ‖ Wand «${w.nummer} ${w.titel}»`;
	});
} finally {
	await browser.close();
}

if (fehler.length > 0) {
	console.log(`\n${fehler.length} Befunde:`);
	for (const f of fehler) console.log(`- ${f}`);
	process.exit(1);
}
console.log('\nAlles grün.');
