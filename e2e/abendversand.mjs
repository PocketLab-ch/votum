/**
 * Durchstich: Der Versandweg am gemeinsamen Abend (A2, 03.10.2026).
 *
 * **Was gemessen wird** (Produktentscheid 03.10.2026: «Fassung je Haus»).
 *
 *   1. Am Haus eines Abends steht der Abschnitt «Fassungen»: Die Leitung kann
 *      dort festhalten, was dieses Haus verschickt — den Text des
 *      Abendprotokolls. Vor dem Bau fehlte der Abschnitt (Abschnitt steht in
 *      `{#if !data.gemeinsam}`), und «genehmigt» war nicht erfassbar.
 *   2. Je Haus nach dessen Siegel: «als versandt festhalten» liefert die
 *      Quittung, und der Wortlaut der Fassung lässt sich auf der Hausseite
 *      lesen. Er ist das Protokoll des Abends, enthält also dessen Titel.
 *   3. Je Haus die Genehmigung: Nach der nächsten (geschlossenen) Versammlung
 *      desselben Hauses lässt sich «von der Versammlung genehmigt» festhalten.
 *   4. Die Löschseite wird danach löschbar: Die Warnung «Gelöscht wird erst,
 *      wenn die nächste Versammlung das Protokoll genehmigt hat» ist weg, das
 *      Formular steht da, und der Zustellvorschlag nennt den Versandtag aus der
 *      Fassung (statt wie vorher leer zu bleiben: «Das Protokoll wurde in Votum
 *      nie als versandt festgehalten.»)
 *   5. Die Abendseite sagt, wer den Versand festhält und die Genehmigung
 *      erfasst.
 *
 * **Rot vor dem Bau:** Die Schritte 1, 2, 3 und 4 fallen am fehlenden
 * Abschnitt; die Schranke im Server (`halteFassungFest` verlangte eine
 * Arbeitsfassung, die es am Abendhaus nicht gibt) kommt über die Oberfläche
 * gar nicht erst zum Zug.
 *
 * Aufbau wie `e2e/abendsiegel.mjs`: zwei Häuser, ein gemeinsamer Abend, die
 * Erfassung von Hand. Die Namen tragen «E2E» und «Prüflauf», damit
 * `scripts/testdaten-entfernen.sql` sie wiederfindet. Die Daten liegen in der
 * Vergangenheit, weil die Löschseite die Genehmigung durch eine spätere,
 * geschlossene Versammlung verlangt (Migration 115).
 *
 * Aufruf: `node e2e/abendversand.mjs`.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { warteNachNavigation } from './bereit.mjs';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';

import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Feste Tage in der Vergangenheit: Die Genehmigung je Haus zählt nur, wenn eine
 * spätere Versammlung desselben Hauses stattgefunden hat und ihr Tag nicht nach
 * dem Festhalten liegt (Migration 115, `protokoll_genehmigung`). Die
 * Gemeinschaften entstehen je Lauf neu, deshalb sind feste Tage kollisionsfrei.
 */
const ABEND = '2025-01-10';
const FOLGE = '2025-02-10';

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
// Am Kontext, vor der ersten Seite: Das Schliessen fragt nach, und der
// Beobachter bestätigt. Wer danach auf das Fenster wartet, wartet vergeblich.
await rueckfragenBestaetigen(kontext);
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

const sauber = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Was die Seite nach einer Handlung meldet: Absage im Streifen, Erfolg in der
 * Ecke (`abendschritte.mjs`).
 */
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

/** Ein Haus mit zwei Einheiten und zwei Eigentümern. */
async function legeHausAn(bezeichnung) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `E2E ${bezeichnung} ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `${bezeichnung} nicht angelegt, Adresse ${seite.url()}`);

	const namen = [];
	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		const name = `${wer} Prüflauf ${bezeichnung.slice(-1)} ${LAUF.slice(-4)}`;
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill(['500', '500'][i]);
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(name);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), name);
		// «Gültig ab» in die Vergangenheit: Der Abend liegt vor heute, und eine
		// Zuordnung ab heute liesse das Haus zum Versammlungstag ohne Eigentümer.
		await zf.locator('input[name="ab"]').fill('2024-01-01');
		await abschicken(zf.locator('button[type="submit"]'));
		namen.push(name);
	}
	return { id, namen };
}

/** Eine Versammlung des Hauses an den Abend hängen. */
async function hausAmAbend(hausId, tagId) {
	await gehe(`/gemeinschaften/${hausId}/versammlungen/neu`);
	await seite.fill('input[name="datum"]', ABEND);
	await seite.fill('input[name="uhrzeit"]', '18:30');
	await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
	await abschicken(seite.locator('button[form="anlegen"]'));
	const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
	behaupte(id, `Keine Versammlung angelegt, Adresse ${seite.url()}`);
	await gehe(`/versammlungen/${id}`);
	await seite.locator('select[name="tag"]').first().selectOption(tagId);
	await abschicken(seite.locator('button[form="angaben"]'));
	behaupte(
		(await seite.locator('select[name="tag"]').first().inputValue()) === tagId,
		'Das Haus wurde dem Abend nicht zugeordnet'
	);
	return id;
}

/** Eine einzelne, geschlossene Versammlung des Hauses nach dem Abend. */
async function folgeversammlung(hausId) {
	await gehe(`/gemeinschaften/${hausId}/versammlungen/neu`);
	await seite.fill('input[name="datum"]', FOLGE);
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
	await abschicken(seite.locator('button[form="anlegen"]'));
	const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
	behaupte(id, `Keine Folgeversammlung angelegt, Adresse ${seite.url()}`);

	await gehe(`/versammlungen/${id}/freigabe`);
	await abschicken(seite.locator('form[action="?/freigeben"] button.haupt'));
	await gehe(`/versammlungen/${id}`);
	const auf = seite.locator('form[action="?/eroeffnen"] button');
	await warteAuf(auf, 'Der Knopf «Versammlung eröffnen»');
	await abschicken(auf);
	await gehe(`/versammlungen/${id}`);
	const zu = seite.locator('form[action="?/schliessen"] button');
	await warteAuf(zu, 'Der Knopf «Versammlung beenden»');
	await abschicken(zu);
	const m = await meldungstext();
	behaupte(/geschlossen/i.test(m), `Folgeversammlung schliessen: «${m}»`);
	return id;
}

/** Alle Parteien eines Hauses am Eingang des Abends als anwesend erfassen. */
async function erfasseAnwesende(wer, tagId) {
	await gehe(`/tage/${tagId}/einlass`);
	const zeile = seite
		.locator('tbody tr', { hasText: wer })
		.filter({ has: seite.locator('form[action="?/vonHand"]') })
		.first();
	behaupte(await zeile.count(), `${wer} lässt sich nicht von Hand erfassen`);
	await abschicken(zeile.locator('form[action="?/vonHand"] button'));
}

/** Auf der Protokollseite eines Hauses eine Fassung der gewählten Art festhalten. */
async function halteFest(versammlungId, art) {
	await gehe(`/versammlungen/${versammlungId}/protokoll`);
	const formular = seite.locator('form[action="?/festhalten"]');
	await warteAuf(formular, `Das Formular «Fassung festhalten» in ${versammlungId}`);
	await formular.locator('select[name="art"]').selectOption(art);
	await abschicken(formular.locator('button[type="submit"]'));
	return meldungstext();
}

/** Den Wortlaut einer festgehaltenen Fassung über den eigenen Abruf lesen. */
async function leseFassung(versammlungId, nummer) {
	const antwort = await seite.request.get(
		`${ZIEL}/versammlungen/${versammlungId}/protokoll/fassung/${nummer}`
	);
	behaupte(antwort.status() === 200, `Fassung ${nummer} nicht abrufbar (${antwort.status()})`);
	return await antwort.text();
}

const hausA = { bezeichnung: 'Versandhaus A' };
const hausB = { bezeichnung: 'Versandhaus B' };

let tag = null;

try {
	console.log(`\nDer Versandweg am gemeinsamen Abend — ${ZIEL}\n`);

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

	await schritt('Zwei Häuser mit je zwei Parteien', async () => {
		Object.assign(hausA, await legeHausAn(hausA.bezeichnung));
		Object.assign(hausB, await legeHausAn(hausB.bezeichnung));
		return 'A und B, je zwei';
	});

	await schritt('Ein gemeinsamer Abend, je Haus eine Versammlung', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `E2E Abendversand ${LAUF}`);
		await seite.fill('input[name="datum"]', ABEND);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

		hausA.versammlung = await hausAmAbend(hausA.id, tag);
		hausB.versammlung = await hausAmAbend(hausB.id, tag);
		return tag.slice(0, 8);
	});

	await schritt('Beide freigeben und vom Eingang aus eröffnen', async () => {
		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		await warteAuf(alle, 'Die Sammelfreigabe des Abends');
		await abschicken(alle);
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		await warteAuf(eroeffnen, 'Der Knopf «eröffnen» am Eingang');
		await abschicken(eroeffnen);
	});

	await schritt('Alle vier Parteien anwesend', async () => {
		for (const wer of [...hausA.namen, ...hausB.namen]) await erfasseAnwesende(wer, tag);
		await gehe(`/tage/${tag}/einlass`);
		const offen = await seite.locator('tbody tr form[action="?/vonHand"]').count();
		behaupte(offen === 0, `Nach dem Erfassen stehen noch ${offen} Zeilen mit «Von Hand erfassen»`);
		return '4 erfasst';
	});

	await schritt('Beide Versammlungen schliessen', async () => {
		for (const [name, id] of [
			['A', hausA.versammlung],
			['B', hausB.versammlung]
		]) {
			await gehe(`/versammlungen/${id}`);
			const zu = seite.locator('form[action="?/schliessen"] button');
			await warteAuf(zu, `Der Knopf «Versammlung beenden» in Haus ${name}`);
			await abschicken(zu);
			const m = await meldungstext();
			behaupte(/geschlossen/i.test(m), `Haus ${name} schliessen: «${m}»`);
		}
		return 'A und B';
	});

	await schritt('Beide Häuser versiegeln', async () => {
		await gehe(`/tage/${tag}/siegel`);
		const knopf = seite.locator('form[action="?/versiegeln"] button');
		await warteAuf(knopf, 'Der Knopf «Gemeinschaften versiegeln»');
		behaupte(
			/2 Gemeinschaften versiegeln/.test(sauber(await knopf.innerText())),
			`Der Knopf zählt nicht beide Häuser: «${sauber(await knopf.innerText())}»`
		);
		await abschicken(knopf);
		const m = await meldungstext();
		behaupte(/versiegelt/.test(m), `Keine Erfolgsmeldung: «${m}»`);
		return m.slice(0, 120);
	});

	await schritt('Die Abendseite nennt den Versandweg je Haus', async () => {
		await gehe(`/tage/${tag}/protokoll`);
		const kachel = seite.locator('section.kachel', { hasText: 'Genehmigung und Versiegelung' });
		await warteAuf(kachel, 'Die Kachel «Genehmigung und Versiegelung»');
		const text = sauber(await kachel.innerText());
		behaupte(
			/Jedes Haus hält auf seiner Protokollseite die Fassung fest/.test(text),
			`Die Abendseite nennt den Versandweg nicht: «${text.slice(0, 200)}»`
		);
		return text.slice(0, 120);
	});

	await schritt('1. Am Haus A steht der Abschnitt «Fassungen» mit «versandt»', async () => {
		await gehe(`/versammlungen/${hausA.versammlung}/protokoll`);
		const kopf = seite.locator('h2#fassungen');
		await warteAuf(kopf, 'Der Abschnitt «Fassungen» am Abendhaus');
		behaupte(
			(await seite.locator('form[action="?/festhalten"]').count()) === 1,
			'Das Formular «Jetzige Fassung festhalten» fehlt am Abendhaus'
		);
		const optionen = await seite
			.locator('form[action="?/festhalten"] select[name="art"] option')
			.allTextContents();
		behaupte(
			optionen[0]?.trim() === 'versandt',
			`Bei versiegeltem Haus steht «versandt» nicht zuoberst: ${optionen.join(' | ')}`
		);
		const hinweis = sauber(
			await seite
				.locator('p.meldung.gemeinsam', { hasText: 'Der Text, den Sie hier festhalten' })
				.first()
				.innerText()
		);
		behaupte(
			/Protokoll des Abends/.test(hinweis) && /hält den Stand fest/.test(hinweis),
			`Der Hinweis am Abschnitt fehlt: «${hinweis.slice(0, 200)}»`
		);
		return `«${hinweis.slice(0, 90)}»`;
	});

	await schritt('2. Fassung in Haus A als versandt festhalten und lesen', async () => {
		const m = await halteFest(hausA.versammlung, 'versandt');
		behaupte(/Fassung 1 ist festgehalten \(versandt\)/.test(m), `Die Quittung fehlt: «${m}»`);
		const wortlaut = await leseFassung(hausA.versammlung, 1);
		behaupte(
			wortlaut.includes('# Protokoll der gemeinsamen Versammlung'),
			`Die Fassung ist nicht das Abendprotokoll: «${wortlaut.slice(0, 200)}»`
		);
		behaupte(
			wortlaut.includes(`E2E Abendversand ${LAUF}`),
			'Die Fassung nennt den Abend nicht'
		);
		return `${m.slice(0, 60)} · ${wortlaut.length} Zeichen`;
	});

	await schritt('3. Fassung in Haus B als versandt festhalten', async () => {
		const m = await halteFest(hausB.versammlung, 'versandt');
		behaupte(/Fassung 1 ist festgehalten \(versandt\)/.test(m), `Die Quittung fehlt: «${m}»`);
		const wortlaut = await leseFassung(hausB.versammlung, 1);
		behaupte(wortlaut.includes('# Protokoll der gemeinsamen Versammlung'), 'B: falscher Text');
		// Beide Häuser halten denselben Abend fest; die Fassungen entstehen
		// nacheinander und tragen deshalb ihren eigenen Erzeugungszeitpunkt.
		const a = await leseFassung(hausA.versammlung, 1);
		return `A ${a.length} Zeichen, B ${wortlaut.length} Zeichen`;
	});

	await schritt('4. Je Haus eine spätere Versammlung, geschlossen', async () => {
		await folgeversammlung(hausA.id);
		await folgeversammlung(hausB.id);
		return `${FOLGE}, A und B`;
	});

	await schritt('5. «genehmigt» je Haus erfassen', async () => {
		for (const [name, id] of [
			['A', hausA.versammlung],
			['B', hausB.versammlung]
		]) {
			const m = await halteFest(id, 'genehmigt');
			behaupte(
				/Fassung 2 ist festgehalten \(von der Versammlung genehmigt\)/.test(m),
				`Haus ${name}: Die Genehmigung ist nicht erfassbar: «${m}»`
			);
		}
		return 'A und B, Fassung 2';
	});

	await schritt('6. Danach ist der Abend auf der Löschseite löschbar', async () => {
		await gehe(`/betreiber/loeschen/${hausA.versammlung}`);
		const warnung = seite.locator('p.meldung.warnung', {
			hasText: 'Gelöscht wird erst, wenn die nächste Versammlung'
		});
		behaupte(
			(await warnung.count()) === 0,
			'Die Löschseite verlangt weiter eine Genehmigung, obwohl beide Häuser sie erfasst haben'
		);
		const formular = seite.locator('form[action="?/loeschen"]');
		await warteAuf(formular, 'Das Formular «Versammlung löschen»');
		const zugestellt = formular.locator('input[name="zugestelltAm"]');
		behaupte(
			(await zugestellt.inputValue()).length > 0,
			'Der Zustellvorschlag ist leer: Der Versandtag aus der Fassung fehlt'
		);
		const text = sauber(await seite.locator('.seitenstapel').innerText());
		behaupte(
			text.includes(hausA.bezeichnung) && text.includes(hausB.bezeichnung),
			'Die Löschseite führt nicht beide Häuser des Abends'
		);
		return `Vorschlag: ${await zugestellt.inputValue()}`;
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
