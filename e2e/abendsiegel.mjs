/**
 * Durchstich: Die Siegelseite des Abends nennt das Hindernis je Haus.
 *
 * **Was gemessen wird** (Produktentscheid 03.10.2026, «Ja, vorher anzeigen»).
 *
 *   1. Die Siegelseite des Abends zeigt vor dem Klick, welches Haus sich
 *      nicht versiegeln lässt und warum: Die Zeile nennt das Hindernis
 *      («Durchgang 1 zu Traktandum …: Format»), nicht «bereit».
 *   2. Der Knopf zählt nur die Häuser, die wirklich gehen; ein Haus mit
 *      Hindernis steht nicht in der Zahl.
 *   3. Der Klick versiegelt die übrigen Häuser und nennt die Absage in der
 *      Meldung, mit dem Namen des einen Hauses.
 *   4. Danach steht das versiegelte Haus mit Siegel da, das gehinderte
 *      weiterhin mit seinem Grund.
 *
 * **Wie das Hindernis entsteht.** Ein geschlossenes Haus trägt in
 * `voting_round.result_json` eine Festschreibung in einem Format, das diese
 * Fassung nicht liest (Format 2, wie nach einer Rücknahme). Der Weg dorthin
 * geht am Produkt vorbei: Das Drehbuch schreibt die Zeile unmittelbar in die
 * Datenbank, in einer Transaktion mit abgeschalteten Auslösern (Migration 123
 * sperrt Änderungen an `result_json`). Dass `erhebeSiegellage` daraus ein
 * Hindernis macht, ist in `tests/db/siegel.test.ts` geprüft; hier geht es um
 * die Anzeige am Abend.
 *
 * Aufbau wie `e2e/abendschritte.mjs`: zwei Häuser, ein gemeinsamer Abend, die
 * Erfassung von Hand. Die Namen tragen «E2E» und «Prüflauf», damit
 * `scripts/testdaten-entfernen.sql` sie wiederfindet.
 *
 * Aufruf: `node e2e/abendsiegel.mjs`.
 */
import { fileURLToPath } from 'node:url';
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { warteNachNavigation } from './bereit.mjs';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';

import { zugang } from './zugang.mjs';
/** Das Repo dieses Drehbuchs; dort liegt die Compose-Datei des Dev-Stapels. */
const REPO = fileURLToPath(new URL('..', import.meta.url));

const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Je Lauf ein anderes Datum: Zwei Erstversammlungen derselben Gemeinschaft am
 * selben Tag weist der Kern ab (Migration 028). Eigener Bereich, damit der
 * Lauf einem anderen Drehbuch nicht das Datum wegnimmt.
 */
const DATUM = new Date(Date.UTC(2037, 0, 1) + (Date.now() % 600) * 86400000)
	.toISOString()
	.slice(0, 10);
const SACHE = `E2E Budget Prüflauf ${LAUF}`;

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

/**
 * Ein Haus mit drei Einheiten und drei Eigentümern.
 *
 * Die Personen tragen den Hausbuchstaben, weil beide Häuser dieselben
 * Nachnamen bekommen: Ohne ihn träfe `hasText` am Eingang zwei Zeilen.
 */
async function legeHausAn(bezeichnung) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `E2E ${bezeichnung} ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `${bezeichnung} nicht angelegt, Adresse ${seite.url()}`);

	const namen = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
		const name = `${wer} Prüflauf ${bezeichnung.slice(-1)} ${LAUF.slice(-4)}`;
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

/** Ein Traktandum in den angekreuzten Häusern anlegen. */
async function geschaeftAnlegen(tagId, titel, antragswortlaut) {
	await gehe(`/tage/${tagId}/geschaefte`);
	if ((await seite.locator('form#neu').count()) === 0) {
		await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
		await seite.waitForTimeout(250);
	}
	await seite.fill('input[name="titel"]', titel);
	await seite.fill('input[name="antragswortlaut"]', antragswortlaut);
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
	if (!(await details.evaluate((d) => d.open))) await danach.locator('summary').click();
	return danach.locator('details > ul > li');
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
 * Alle Parteien mit Ja erfassen, am Schritt, der am Abend gerade «jetzt» ist
 * (`abendschritte.mjs`).
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

/**
 * Die Festschreibung eines Durchgangs unlesbar machen.
 *
 * **Warum über die Datenbank und nicht über die Oberfläche.** Ein Format 2
 * entsteht durch eine neuere Fassung der Anwendung; hier wird genau dieser
 * Zustand hergestellt. `session_replication_role = replica` ist nötig, weil
 * der Auslöser aus Migration 123 Änderungen an `result_json` sperrt — dasselbe
 * Verfahren wie in `tests/db/siegel.test.ts`.
 */
async function verfaelscheergebnis(meetingId) {
	const { execFile } = await import('node:child_process');
	const { promisify } = await import('node:util');
	const sql =
		'BEGIN; SET LOCAL session_replication_role = replica; ' +
		`UPDATE voting_round SET result_json = '{"format": 2, "auszaehlung": {}}'::jsonb ` +
		`WHERE meeting_id = '${meetingId}'; ` +
		'COMMIT;';
	const { stdout } = await promisify(execFile)(
		'docker',
		['compose', 'exec', '-T', 'postgres', 'psql', '-U', 'versammlung', '-d', 'versammlung', '-c', sql],
		{ cwd: REPO }
	);
	behaupte(
		/UPDATE 1/.test(stdout),
		`Die Verfälschung traf keine Zeile: «${stdout.trim().split('\n').join(' | ')}»`
	);
	return stdout.trim().split('\n').filter(Boolean).join(' | ');
}

const hausA = { bezeichnung: 'Siegelschritt A' };
const hausB = { bezeichnung: 'Siegelschritt B' };

let tag = null;
const versammlung = {};

try {
	console.log(`\nDer Abend versiegelt, was geht, und nennt das Hindernis je Haus — ${ZIEL}\n`);

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
		Object.assign(hausA, await legeHausAn(hausA.bezeichnung));
		Object.assign(hausB, await legeHausAn(hausB.bezeichnung));
		return 'A und B';
	});

	await schritt('Ein gemeinsamer Abend, je Haus eine Versammlung', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `E2E Siegelabend ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
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
			await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
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

	await schritt('Das Budget aufnehmen und in beiden Häusern ein Erfordernis setzen', async () => {
		await geschaeftAnlegen(tag, SACHE, 'Das Budget wird genehmigt.');
		await setzeErfordernis(versammlung.A, SACHE, 'qualifiziertes_mehr');
		await setzeErfordernis(versammlung.B, SACHE, 'qualifiziertes_mehr');
		return SACHE;
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

	await schritt('Alle sechs Parteien anwesend', async () => {
		const alle = [...hausA.namen, ...hausB.namen];
		for (const wer of alle) await erfasseAnwesende(wer);
		await gehe(`/tage/${tag}/einlass`);
		const offen = await seite.locator('tbody tr form[action="?/vonHand"]').count();
		behaupte(offen === 0, `Nach dem Erfassen stehen noch ${offen} Zeilen mit «Von Hand erfassen»`);
		return `${alle.length} erfasst`;
	});

	await schritt('Das Budget aufrufen, in A abstimmen und schliessen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile(SACHE).locator('form[action="?/aufrufen"] button'));
		const m1 = await meldungstext();
		behaupte(/in 2 Gemeinschaften/.test(m1), `Sammelaufruf: «${m1}»`);
		const a = (await einzelzeilen(SACHE)).filter({ hasText: hausA.bezeichnung });
		const oeffnen = a.locator('form[action="?/oeffnen"] button');
		behaupte(await oeffnen.count(), `In Haus A fehlt «Abstimmen»: «${sauber(await a.innerText())}»`);
		await abschicken(oeffnen);
		const m2 = await meldungstext();
		behaupte(/eröffnet in einer Gemeinschaft/.test(m2), `Eröffnen in A: «${m2}»`);
		await gehe(`/tage/${tag}/leitung`);
		const n = await erfasseAlleJa();
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button.haupt'));
		const m3 = await meldungstext();
		behaupte(/geschlossen/i.test(m3), `Schliessen in A: «${m3}»`);
		return `${n} Ja, ${m3.slice(0, 80)}`;
	});

	await schritt('Beide Versammlungen schliessen', async () => {
		for (const [name, id] of [
			['A', versammlung.A],
			['B', versammlung.B]
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

	await schritt('Das Ergebnis in A unlesbar machen (Format 2)', async () => {
		const ausgabe = await verfaelscheergebnis(versammlung.A);
		return ausgabe;
	});

	await schritt('1. Die Zeile nennt das Hindernis statt «bereit»', async () => {
		await gehe(`/tage/${tag}/siegel`);
		const zeilen = seite.locator('table.haeuser tbody tr');
		const zeileA = zeilen.filter({ hasText: hausA.bezeichnung }).first();
		const zeileB = zeilen.filter({ hasText: hausB.bezeichnung }).first();
		behaupte(await zeileA.count(), 'Haus A steht nicht in der Siegelseite des Abends');
		const textA = sauber(await zeileA.innerText());
		behaupte(
			/Durchgang 1 zu Traktandum/.test(textA),
			`Die Zeile nennt den Durchgang nicht: «${textA}»`
		);
		behaupte(/Format/.test(textA), `Die Zeile nennt das Format nicht: «${textA}»`);
		behaupte(!/bereit/.test(textA), `Haus A steht weiter als «bereit» da: «${textA}»`);
		const textB = sauber(await zeileB.innerText());
		behaupte(/bereit/.test(textB), `Haus B steht nicht als «bereit» da: «${textB}»`);
		return `A: «${textA.slice(0, 110)}» ‖ B: «${textB.slice(0, 40)}»`;
	});

	await schritt('2. Der Knopf zählt nur die Häuser, die gehen', async () => {
		const knopf = seite.locator('form[action="?/versiegeln"] button');
		behaupte(await knopf.count(), 'Kein Knopf zum Versiegeln');
		const beschriftung = sauber(await knopf.innerText());
		behaupte(
			/^1 Gemeinschaft versiegeln$/.test(beschriftung),
			`Der Knopf zählt die gehinderten Häuser mit: «${beschriftung}»`
		);
		// Der Hilfetext nennt das gehinderte Haus, nicht nur die Zahl.
		const hilfe = sauber(await seite.locator('form[action="?/versiegeln"] p.hilfe').innerText());
		behaupte(
			/Nicht dabei, weil nicht möglich/.test(hilfe) && hilfe.includes(hausA.bezeichnung),
			`Der Hilfetext am Knopf nennt das gehinderte Haus nicht: «${hilfe}»`
		);
		return `${beschriftung} ‖ ${hilfe.slice(0, 90)}`;
	});

	await schritt('3. Der Klick versiegelt die übrigen und nennt die Absage', async () => {
		await abschicken(seite.locator('form[action="?/versiegeln"] button'));
		const m = await meldungstext();
		behaupte(/ist versiegelt/.test(m), `Keine Erfolgsmeldung: «${m}»`);
		behaupte(
			/Nicht versiegelt/.test(m) && m.includes(hausA.bezeichnung),
			`Die Meldung nennt das gehinderte Haus nicht: «${m}»`
		);
		return m.slice(0, 200);
	});

	await schritt('4. Danach steht B versiegelt da, A weiter mit dem Grund', async () => {
		await gehe(`/tage/${tag}/siegel`);
		const zeilen = seite.locator('table.haeuser tbody tr');
		const zeileB = zeilen.filter({ hasText: hausB.bezeichnung }).first();
		const textB = sauber(await zeileB.innerText());
		behaupte(/versiegelt/.test(textB), `Haus B steht nicht als versiegelt da: «${textB}»`);
		const zeileA = zeilen.filter({ hasText: hausA.bezeichnung }).first();
		const textA = sauber(await zeileA.innerText());
		behaupte(/Format/.test(textA), `Haus A nennt den Grund nicht mehr: «${textA}»`);
		// «versiegelt» kommt im Grund selbst vor («Das Paket wird nicht
		// versiegelt»); die Pille des Siegels ist das unterscheidende Merkmal.
		behaupte(
			(await zeileA.locator('span.pille[data-art="geschlossen"]').count()) === 0,
			`Haus A trägt die Siegelpille: «${textA}»`
		);
		// Kein Knopf mehr: was ging, ist versiegelt; das gehinderte Haus geht
		// nicht, und ein Knopf ohne Ziel wäre eine Einladung ins Leere. Der
		// Hilfetext nennt es weiter, mit dem Verweis auf die Zeile.
		behaupte(
			(await seite.locator('form[action="?/versiegeln"]').count()) === 0,
			'Der Versiegeln-Knopf steht weiter da, obwohl nichts mehr zu versiegeln ist'
		);
		const hilfe = sauber(await seite.locator('p.hilfe').first().innerText());
		behaupte(
			/Nicht möglich/.test(hilfe) && hilfe.includes(hausA.bezeichnung),
			`Der Hilfetext nennt das gehinderte Haus nicht: «${hilfe}»`
		);
		return `B: «${textB.slice(0, 60)}» ‖ A: «${textA.slice(0, 80)}»`;
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
