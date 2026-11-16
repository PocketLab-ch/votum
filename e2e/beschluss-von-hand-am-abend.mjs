/**
 * Der Beschluss von Hand am gemeinsamen Abend (Block 2b, 01.10.2026).
 *
 * **Was gemessen wird.**
 *
 *   1. Ohne Notweg ist der Weg gesperrt: Ein POST an `?/beschlussVonHand`
 *      ohne `notweg=ja` bekommt die Absage, die den gemeinsamen Abend nennt,
 *      und es entsteht kein Durchgang. 1b: Mit dem Grund «Eingewendete
 *      Bestimmung» greift die Abendsperre nicht und kein Notweg-Vermerk
 *      entsteht (E2); die Absage kommt dann aus dem Kern.
 *   2. Die Maske steht im Notweg-Kasten der Einzelleitung und nur dort:
 *      «Jetzt möglich» ist gezeichnet, aber ohne sie.
 *   3. Festhalten über die Maske, mit Summen: Kopfstimmen eingetragen,
 *      Wertquoten leer gelassen, «Angenommen». Die Quittung erscheint.
 *   4. Der Verlauf der Versammlung trägt beide Einträge: die Wahl des Notwegs
 *      (`meeting.day.bypassed`, mit der Aktion `beschlussVonHand`) und
 *      «Beschluss von Hand festgehalten».
 *   5. Die Abendwand zeigt an der Kachel dieses Hauses das Ergebnis mit Ja,
 *      Nein und Enthaltung, ohne «von N» und ohne «nötig» — die erste Messung
 *      des Kopfspiegels in `Hausabstimmung.svelte`.
 *   6. Die Einzelwand der Versammlung zeigt keinen Hinweis auf den Weg
 *      («von Hand», «übergangen», «Notweg»).
 *   7. Die Maske nennt vor dem Knopf den Anwesenheitsstand, den der Eintrag
 *      festhält, und die Zahlen folgen der Anwesenheit: erst 3 von 3
 *      Eigentümern (Schritt 3), nach zwei Weggängen 1 von 3 (Block 6).
 *   8. Wird danach «Abgelehnt» festgehalten, trägt das gemeinsame Protokoll
 *      des Abends bei diesem Haus den Satz zur fehlenden Beschlussfähigkeit
 *      mit beiden Hinweisen in ihrer Reihenfolge, und nennt den Weg nicht
 *      (Block 6).
 *   9. Die Sitzungsleitung des Abends findet den Weg: Bei «Es tagen mit»
 *      steht der Satz zum Beschluss von Hand, und der Hausverweis führt auf
 *      die Leitungsseite, die die Maske trägt (03.10.2026).
 *
 * Aufbau wie `e2e/abendschritte.mjs`: ein Haus, ein gemeinsamer Abend, die
 * Erfassung von Hand. Die Kennungen tragen «E2E», damit
 * `scripts/testdaten-entfernen.sql` den Bestand wiederfindet.
 *
 * Aufruf: `node e2e/beschluss-von-hand-am-abend.mjs`.
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
 * Je Lauf ein anderes Datum: Zwei Erstversammlungen derselben Gemeinschaft am
 * selben Tag weist der Kern ab (Migration 028).
 */
const DATUM = new Date(Date.UTC(2036, 0, 1) + (Date.now() % 700) * 86400000)
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
// Am Kontext, vor der ersten Seite: Das Festhalten fragt nach, und der
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
 * Wohin die Nachweis-Bilder gehen (B1, B3). Ohne `BILDER` entstehen keine:
 * Sonst schriebe jeder Lauf in ein festes Verzeichnis (Codeprüfung Lauf B).
 */
const BILDER = process.env.BILDER ?? null;

/** Ein Element bei der gewünschten Grösse fotografieren; danach die Laufgrösse. */
async function foto(von, name, breite, hoehe) {
	if (!BILDER) return;
	await seite.setViewportSize({ width: breite, height: hoehe });
	await seite.waitForTimeout(150);
	await von.screenshot({ path: `${BILDER}/${name}.png` });
	await seite.setViewportSize({ width: 1400, height: 1000 });
}

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

/** Ein Haus mit drei Einheiten und drei Eigentümern (wie `abendschritte.mjs`). */
async function legeHausAn(bezeichnung) {
	await gehe('/gemeinschaften/neu');
	// Das «E2E » steht wörtlich in der Vorlage, nicht nur im übergebenen
	// Bezeichner: Der Wächter `testdatennamen` löst `${…}` zu «X» auf und muss
	// das Muster trotzdem erkennen.
	await seite.fill('input[name="name"]', `E2E ${bezeichnung} ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `${bezeichnung} nicht angelegt, Adresse ${seite.url()}`);

	const namen = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
		const name = `${wer} Prüflauf ${LAUF.slice(-4)}`;
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

/** Das Erfordernis eines Traktandums im Haus unmittelbar setzen und seine Kennung zurückgeben. */
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

const haus = { bezeichnung: 'Haus' };
let tag = null;
let versammlungId = null;
let traktandumId = null;

try {
	console.log(`\nBeschluss von Hand am gemeinsamen Abend — ${ZIEL}\n`);

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

	await schritt('Ein Haus mit drei Parteien', async () => {
		Object.assign(haus, await legeHausAn(haus.bezeichnung));
		return haus.id.slice(0, 8);
	});

	await schritt('Ein gemeinsamer Abend, eine Versammlung des Hauses', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `E2E Abend ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

		await gehe(`/gemeinschaften/${haus.id}/versammlungen/neu`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `E2E Saal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
		behaupte(id, `Keine Versammlung angelegt, Adresse ${seite.url()}`);
		versammlungId = id;
		await gehe(`/versammlungen/${id}`);
		await seite.locator('select[name="tag"]').first().selectOption(tag);
		await abschicken(seite.locator('button[form="angaben"]'));
		behaupte(
			(await seite.locator('select[name="tag"]').first().inputValue()) === tag,
			'Das Haus wurde dem Abend nicht zugeordnet'
		);
		return tag.slice(0, 8);
	});

	await schritt('Das Geschäft aufnehmen und im Haus ein Erfordernis setzen', async () => {
		await geschaeftAnlegen(tag, SACHE, 'Das Budget wird genehmigt.');
		traktandumId = await setzeErfordernis(versammlungId, SACHE, 'qualifiziertes_mehr');
		return traktandumId.slice(0, 8);
	});

	await schritt('Freigeben, eröffnen, drei Parteien anwesend', async () => {
		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		await warteAuf(alle, 'Die Sammelfreigabe des Abends');
		await abschicken(alle);
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		await warteAuf(eroeffnen, 'Der Knopf «eröffnen» am Eingang');
		await abschicken(eroeffnen);
		for (const wer of haus.namen) await erfasseAnwesende(wer);
		return `${haus.namen.length} erfasst`;
	});

	await schritt('Das Geschäft am Abend aufrufen', async () => {
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(punktzeile(SACHE).locator('form[action="?/aufrufen"] button'));
		const m = await meldungstext();
		behaupte(/Aufgerufen in einer Gemeinschaft/.test(m), `Aufruf: «${m}»`);
		return m;
	});

	await schritt('1. Ohne Notweg gesperrt, und es entsteht kein Durchgang', async () => {
		const antwort = await seite.evaluate(
			async ({ ziel, felder }) => {
				const fd = new FormData();
				for (const [k, v] of felder) fd.append(k, v);
				const r = await fetch(ziel, {
					method: 'POST',
					body: fd,
					headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
				});
				const rohtext = await r.text();
				let rumpf = null;
				try {
					rumpf = JSON.parse(rohtext);
				} catch {
					// Unlesbarer Rumpf bleibt `null`; die Behauptungen darunter
					// nennen dann den rohen Text.
				}
				/*
				 * **Der äussere Status ist 200.** Im JSON-Protokoll der
				 * Aktionen trägt der Rumpf die Absage: `type: failure` und
				 * `status: 400`. Über das Formular ohne das Kopfzeilenpaar
				 * antwortete dieselbe Absage mit HTTP 400.
				 */
				return {
					status: r.status,
					typ: rumpf?.type ?? null,
					statusImRumpf: typeof rumpf?.status === 'number' ? rumpf.status : null,
					rohtext
				};
			},
			{
				ziel: `${ZIEL}/versammlungen/${versammlungId}/leitung?/beschlussVonHand`,
				felder: [
					['traktandum', traktandumId],
					['erfassung', 'summen'],
					['koepfe_ja', '2'],
					['koepfe_nein', '1'],
					['koepfe_enthaltung', '0'],
					['ergebnis', 'angenommen'],
					['begruendung', 'E2E: ohne Notweg versucht.']
				]
			}
		);
		behaupte(
			antwort.typ === 'failure' && antwort.statusImRumpf === 400,
			`Ohne Notweg kam keine Absage: ${antwort.rohtext.slice(0, 200)}`
		);
		behaupte(
			/tagt am gemeinsamen Abend/.test(antwort.rohtext),
			`Die Absage nennt den gemeinsamen Abend nicht: ${antwort.rohtext.slice(0, 300)}`
		);

		await gehe(`/verlauf?versammlung=${versammlungId}`);
		behaupte(
			(await seite.locator('tr:has-text("Beschluss von Hand festgehalten")').count()) === 0,
			'Trotz der Absage steht ein Beschluss von Hand im Verlauf'
		);
		behaupte(
			(await seite
				.locator('tr:has-text("Einzelleitung gewählt; der gemeinsame Abend gilt für dieses Haus nicht")')
				.count()) === 0,
			'Trotz der Absage steht eine Notweg-Wahl im Verlauf'
		);
		return `Absage ${antwort.statusImRumpf}, kein Eintrag`;
	});

	/*
	 * **1b. Der Grund «Eingewendete Bestimmung» geht am Abend ohne Notweg** (E2,
	 * Kriterium 6; Entscheid 0046). Gemessen an der Absage: Sie kommt aus dem Kern
	 * (an diesem Geschäft mit gewähltem Mehr gilt der Grund nicht), nicht von der
	 * Abendsperre, und es entsteht weder ein Durchgang noch ein Notweg-Vermerk.
	 * Dass der Grund selbst trägt, misst `e2e/eingewendete-bestimmung.mjs`.
	 */
	await schritt('1b. Mit dem Grund «Eingewendete Bestimmung» keine Abendsperre, kein Notweg-Vermerk', async () => {
		const antwort = await seite.evaluate(
			async ({ ziel, felder }) => {
				const fd = new FormData();
				for (const [k, v] of felder) fd.append(k, v);
				const r = await fetch(ziel, {
					method: 'POST',
					body: fd,
					headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
				});
				return { rohtext: await r.text() };
			},
			{
				ziel: `${ZIEL}/versammlungen/${versammlungId}/leitung?/beschlussVonHand`,
				felder: [
					['traktandum', traktandumId],
					['grund', 'eingewendete_bestimmung'],
					['erfassung', 'summen'],
					['koepfe_ja', '2'],
					['koepfe_nein', '1'],
					['koepfe_enthaltung', '0'],
					['ergebnis', 'abgelehnt'],
					['einwand', 'E2E: Reglement Art. 14, vier Fünftel'],
					['einfuehrung', 'E2E: Beilage zum Begründungsakt']
				]
			}
		);
		behaupte(
			!/tagt am gemeinsamen Abend/.test(antwort.rohtext),
			`Mit dem Grund griff die Abendsperre: ${antwort.rohtext.slice(0, 300)}`
		);
		behaupte(
			/gibt es bei diesem Geschäft nicht/.test(antwort.rohtext),
			`Die Absage kommt nicht aus dem Kern: ${antwort.rohtext.slice(0, 300)}`
		);
		await gehe(`/verlauf?versammlung=${versammlungId}`);
		behaupte(
			(await seite.locator('tr:has-text("Beschluss von Hand festgehalten")').count()) === 0,
			'Trotz der Absage steht ein Beschluss von Hand im Verlauf'
		);
		behaupte(
			(await seite
				.locator('tr:has-text("Einzelleitung gewählt; der gemeinsame Abend gilt für dieses Haus nicht")')
				.count()) === 0,
			'Mit dem Grund steht eine Notweg-Wahl im Verlauf'
		);
		return 'Absage aus dem Kern, kein Vermerk';
	});

	await schritt('2. Die Maske steht im Notweg-Kasten und nur dort', async () => {
		await gehe(`/versammlungen/${versammlungId}/leitung`);
		const eingriffe = seite.locator('.eingriffe').first();
		behaupte(await eingriffe.count(), '«Jetzt möglich» ist am Abend gar nicht gezeichnet');
		const imKasten = seite.locator('details.notweg details.vonhand');
		behaupte(
			(await imKasten.count()) === 1,
			`Im Notweg-Kasten stehen ${await imKasten.count()} Masken statt einer`
		);
		behaupte(
			(await seite.locator('details.vonhand').count()) === 1,
			'Die Maske steht auch ausserhalb des Notweg-Kastens'
		);
		return `Kasten 1, Seite 1, «Jetzt möglich»: «${sauber(await eingriffe.innerText()).slice(0, 60)}»`;
	});

	/*
	 * **B1:** Der Notweg-Kasten bleibt bei offener Abstimmung erreichbar
	 * (03.10.2026). `.raster.eingeengt .ablauf` blendet die linke Spalte aus,
	 * sobald ein Durchgang offen ist, und nahm den Kasten mit: Genau dann fehlte
	 * «Abstimmung schliessen» (den es nur bei offener Abstimmung gibt), und die
	 * Maske «Beschluss von Hand» war nicht erreichbar. Der Kasten wartet jetzt
	 * am Ende des Geschäftskastens.
	 */
	await schritt('2b. Bei offener Abstimmung steht der Notweg-Kasten im Geschäftskasten', async () => {
		// Ohne offene Abstimmung: der Kasten steht wie bisher im Ablauf.
		await gehe(`/versammlungen/${versammlungId}/leitung`);
		const notweg = seite.locator('details.notweg').first();
		await notweg.locator('summary').first().click();
		await foto(notweg, 'b1-ohne-1440', 1440, 900);
		await foto(notweg, 'b1-ohne-390', 390, 844);

		// Die Abstimmung am Abend eröffnen, wo der Saal geführt wird.
		await gehe(`/tage/${tag}/leitung`);
		await abschicken(
			seite.locator('form[action="?/oeffnen"] button[data-fokus="abstimmung:eroeffnen"]')
		);
		await gehe(`/versammlungen/${versammlungId}/leitung`);

		// Bei offener Abstimmung ist der Ablauf ausgeblendet; der Kasten muss
		// trotzdem sichtbar sein, mit dem Knopf, der den Durchgang beendet.
		behaupte(
			(await seite.locator('.raster.eingeengt').count()) === 1,
			'Der Saal-Modus ist bei offener Abstimmung nicht gesetzt'
		);
		await warteAuf(notweg, 'Der Notweg-Kasten bei offener Abstimmung');
		await notweg.locator('summary').first().click();
		const schliessen = notweg.locator('form[action="?/schliessen"] button');
		await warteAuf(schliessen, '«Abstimmung schliessen» im Notweg-Kasten');
		behaupte(
			/Abstimmung schliessen/.test(sauber(await schliessen.first().innerText())),
			'Der Knopf im Kasten heisst nicht «Abstimmung schliessen»'
		);
		behaupte(
			(await notweg.locator('details.vonhand').count()) === 1,
			'Die Maske «Beschluss von Hand» fehlt bei offener Abstimmung'
		);
		// Bei offener Abstimmung nur Schliessen und Maske (Codeprüfung Lauf B):
		// «Aufrufen» liesse die Stimmerfassung verschwinden, «Pause» stünde ohne
		// den Satz des Pausenschalters. Der Anker ist «Abstimmung schliessen»,
		// oben schon sichtbar; erst danach wird gezählt.
		behaupte(
			(await notweg.locator('form[action="?/aufrufen"]').count()) === 0,
			'«Aufrufen» steht bei offener Abstimmung im Notweg-Kasten'
		);
		behaupte(
			(await notweg.locator('form[action="?/pause"]').count()) === 0,
			'«Pause» steht bei offener Abstimmung im Notweg-Kasten'
		);

		// Die Maske sagt, was der offene Durchgang bedeutet.
		const maske = notweg.locator('details.vonhand').first();
		await maske.locator('summary').first().click();
		const formular = maske.locator('form[action="?/beschlussVonHand"]');
		await formular.waitFor({ state: 'visible', timeout: 8000 });
		const text = sauber(await maske.innerText());
		behaupte(
			/Der offene 1\. Durchgang wird ohne Auszählung beendet und überholt/.test(text),
			`Die Maske nennt den offenen Durchgang nicht: «${text.slice(0, 300)}»`
		);
		// Das Mehr steht in der Maske, weil die Seite es bei offener Abstimmung
		// sonst nirgends zeigt (Laien- und Fachprüfung, Lauf B, Runde 3).
		const mehr = sauber(await maske.locator('p.mehr').first().innerText().catch(() => ''));
		// Bei offener Abstimmung gibt es immer ein Erfordernis; die Ersatzzeile
		// wäre hier ein Fehler, kein Erfolg.
		behaupte(/Nötig: \d+ von \d+ Kopfstimme/.test(mehr), `Die Maske nennt das Mehr nicht: «${mehr}»`);
		await foto(notweg, 'b1-mit-1440', 1440, 900);
		await foto(notweg, 'b1-mit-390', 390, 844);

		// Einmal der Beschluss von Hand über den Kasten, bei offener Abstimmung.
		await formular.locator('select[name="erfassung"]').selectOption('summen');
		await formular.locator('input[name="koepfe_ja"]').fill('2');
		await formular.locator('input[name="koepfe_nein"]').fill('1');
		await formular.locator('input[name="koepfe_enthaltung"]').fill('0');
		await formular.locator('select[name="ergebnis"]').selectOption('angenommen');
		await formular
			.locator('textarea[name="begruendung"]')
			.fill('E2E: bei offener Abstimmung von Hand festgehalten.');
		await abschicken(formular.locator('button[type="submit"]'));
		const m = await meldungstext();
		behaupte(/Der Beschluss ist festgehalten/.test(m), `Die Quittung fehlt: «${m}»`);
		return `Quittung wörtlich: «${m}»`;
	});

	await schritt('3. Festhalten über die Maske, mit Summen', async () => {
		const notweg = seite.locator('details.notweg').first();
		await notweg.locator('summary').first().click();
		const maske = notweg.locator('details.vonhand').first();
		await foto(maske, 'b3-kasten-zu-1440', 1440, 900);
		await foto(maske, 'b3-kasten-zu-390', 390, 844);
		await maske.locator('summary').first().click();
		const formular = maske.locator('form[action="?/beschlussVonHand"]');
		await formular.waitFor({ state: 'visible', timeout: 8000 });
		await foto(maske, 'b3-kasten-auf-1440', 1440, 900);
		await foto(maske, 'b3-kasten-auf-390', 390, 844);
		// Die Frage am Markup gelesen, nicht am Fenster gewartet: Der Beobachter
		// bestätigt es, bevor das Drehbuch hinsehen kann.
		const frage = await formular.locator('dialog.rueckfrage').evaluate((el) => el.textContent ?? '');
		behaupte(
			/Beschluss von Hand festhalten\?/.test(frage) && /weder ändern noch zurücknehmen/.test(frage),
			`Die Rückfrage fehlt oder nennt die Folge nicht: «${sauber(frage).slice(0, 200)}»`
		);

		// Der Stand, den der Eintrag einfriert, in Zahlen vor dem Knopf (Block 6):
		// alle drei Parteien sind erfasst, 500 + 300 + 200 Wertquoten.
		const stand = sauber(await formular.locator('p.stand').innerText());
		behaupte(
			/Festgehalten wird der Anwesenheitsstand von jetzt: 3 von 3 Eigentümern anwesend oder vertreten, mit 1000 von 1000 Wertquoten\./.test(
				stand
			) && /stellen Sie zuerst die Anwesenheit auf jenen Stand/.test(stand),
			`Die Maske nennt den festgehaltenen Stand nicht oder falsch: «${stand}»`
		);

		// B3: Marke und Warnkasten, gelesen im aufgeklappten Zustand. Geprüft
		// wird erst nach der Quittung, damit der rote Lauf die späteren Schritte
		// nicht mitreisst.
		const marke = sauber(await maske.locator('summary').first().innerText());
		const warnung = (await maske.locator('p.meldung.warnung').count())
			? await maske
					.locator('p.meldung.warnung')
					.first()
					.evaluate((el) => el.textContent ?? '')
			: '';
		const erstesElement = (await maske.locator('p.meldung.warnung, p.hilfe').count())
			? await maske
					.locator('p.meldung.warnung, p.hilfe')
					.first()
					.evaluate((el) => el.className)
			: '';

		await formular.locator('select[name="erfassung"]').selectOption('summen');
		await formular.locator('input[name="koepfe_ja"]').fill('2');
		await formular.locator('input[name="koepfe_nein"]').fill('1');
		await formular.locator('input[name="koepfe_enthaltung"]').fill('0');
		// Die Wertquoten bleiben leer: «nicht erhoben» ist nicht «null Quoten».
		await formular.locator('select[name="ergebnis"]').selectOption('angenommen');
		await formular
			.locator('textarea[name="begruendung"]')
			.fill('E2E: der Saal hat von Hand entschieden.');
		await abschicken(formular.locator('button[type="submit"]'));
		const m = await meldungstext();
		behaupte(/Der Beschluss ist festgehalten/.test(m), `Die Quittung fehlt: «${m}»`);
		behaupte(
			/\bNotweg\b/.test(marke),
			`B3: Die Marke «Notweg» fehlt in der Zusammenfassung: «${marke}»`
		);
		behaupte(
			/Das ist der Notweg/.test(sauber(warnung)) && /der Versammlung/.test(warnung),
			`B3: Der Warnkasten fehlt oder nennt den Weg nicht: «${sauber(warnung).slice(0, 200)}»`
		);
		behaupte(
			/warnung/.test(erstesElement),
			`B3: Der Warnkasten steht nicht vor der Einleitung (erstes Element: «${erstesElement}»)`
		);
		return m.slice(0, 90);
	});

	await schritt('4. Der Verlauf trägt beide Einträge', async () => {
		await gehe(`/verlauf?versammlung=${versammlungId}`);
		const wahl = seite
			.locator('tr:has-text("Einzelleitung gewählt; der gemeinsame Abend gilt für dieses Haus nicht")')
			.first();
		behaupte(await wahl.count(), 'Der Verlauf kennt die Notweg-Wahl nicht');
		const wahltext = sauber(await wahl.innerText());
		behaupte(
			/Beschluss von Hand festhalten/.test(wahltext),
			`Die Notweg-Zeile nennt die Aktion nicht: «${wahltext.slice(0, 200)}»`
		);
		const fest = seite.locator('tr:has-text("Beschluss von Hand festgehalten")').first();
		behaupte(await fest.count(), 'Der Verlauf kennt den Beschluss von Hand nicht');
		return `${wahltext.slice(0, 50)} ‖ ${sauber(await fest.innerText()).slice(0, 50)}`;
	});

	await schritt('5. Die Abendwand zeigt die Kachel mit den Zahlen, ohne Schwelle', async () => {
		const wand = await kontext.newPage();
		warteNachNavigation(wand);
		try {
			await gehe(`/tage/${tag}/praesentation`, wand);
			const kachel = wand.locator('section.abstimmungen article.kachel').first();
			await kachel.waitFor({ state: 'visible', timeout: 15000 });
			const text = sauber(await kachel.innerText());
			behaupte(/Angenommen/.test(text), `Die Kachel zeigt kein Ergebnis: «${text.slice(0, 200)}»`);
			behaupte(
				/2 ja/.test(text) && /1 nein/.test(text) && /0 Enth/.test(text),
				`Die Kachel zeigt die Zahlen nicht: «${text.slice(0, 200)}»`
			);
			behaupte(!/von \d/.test(text), `Die Kachel zeigt eine Bezugsgrösse: «${text.slice(0, 200)}»`);
			behaupte(!/nötig/i.test(text), `Die Kachel zeigt eine Schwelle: «${text.slice(0, 200)}»`);
			return text;
		} finally {
			await wand.close();
		}
	});

	await schritt('6. Die Einzelwand verrät den Weg nicht', async () => {
		await gehe(`/versammlungen/${versammlungId}/praesentation`);
		const bild = seite.locator('.bild.ergebnis').first();
		await bild.waitFor({ state: 'visible', timeout: 15000 });
		const text = sauber(await bild.innerText());
		behaupte(/Angenommen/i.test(text), `Die Einzelwand zeigt kein Ergebnis: «${text.slice(0, 200)}»`);
		behaupte(
			/Kopfstimmen/.test(text),
			`Die Einzelwand zeigt die Zahlen nicht: «${text.slice(0, 200)}»`
		);
		behaupte(
			!/von Hand|übergangen|Notweg/i.test(text),
			`Die Einzelwand verrät den Weg: «${text.slice(0, 200)}»`
		);
		return text;
	});

	await schritt('7. Nach zwei Weggängen nennt die Maske den neuen Stand', async () => {
		await gehe(`/tage/${tag}/einlass`);
		for (const wer of haus.namen.slice(1)) {
			const zeile = seite
				.locator('tbody tr', { hasText: wer })
				.filter({ has: seite.locator('form[action="?/verlassen"]') })
				.first();
			behaupte(await zeile.count(), `${wer} lässt sich nicht als gegangen austragen`);
			await abschicken(zeile.locator('form[action="?/verlassen"] button'));
			await gehe(`/tage/${tag}/einlass`);
		}
		await gehe(`/versammlungen/${versammlungId}/leitung`);
		const notweg = seite.locator('details.notweg').first();
		await notweg.locator('summary').first().click();
		const maske = notweg.locator('details.vonhand').first();
		await maske.locator('summary').first().click();
		const formular = maske.locator('form[action="?/beschlussVonHand"]');
		await formular.waitFor({ state: 'visible', timeout: 8000 });
		const stand = sauber(await formular.locator('p.stand').innerText());
		// Geblieben ist die Partei mit 500 von 1000 Wertquoten.
		behaupte(
			/von jetzt: 1 von 3 Eigentümern anwesend oder vertreten, mit 500 von 1000 Wertquoten\./.test(stand),
			`Die Maske folgt der Anwesenheit nicht: «${stand}»`
		);
		const text = sauber(await maske.innerText());
		behaupte(
			/wird nicht verbindlich abgestimmt/.test(text),
			`Die Maske nennt die fehlende Beschlussfähigkeit nicht: «${text.slice(0, 300)}»`
		);

		await formular.locator('select[name="erfassung"]').selectOption('summen');
		await formular.locator('input[name="koepfe_ja"]').fill('0');
		await formular.locator('input[name="koepfe_nein"]').fill('1');
		await formular.locator('input[name="koepfe_enthaltung"]').fill('0');
		await formular.locator('select[name="ergebnis"]').selectOption('abgelehnt');
		await abschicken(formular.locator('button[type="submit"]'));
		const m = await meldungstext();
		behaupte(/Der Beschluss ist festgehalten/.test(m), `Die Quittung fehlt: «${m}»`);
		return stand.slice(0, 110);
	});

	await schritt('8. Das Protokoll des Abends trägt den Satz bei diesem Haus', async () => {
		await gehe(`/tage/${tag}/protokoll`);
		const text = sauber(await seite.locator('pre.text').first().innerText());
		const ab = text.indexOf(SACHE);
		behaupte(ab >= 0, 'Das Protokoll des Abends kennt das Geschäft nicht');
		const abschnitt = text.slice(ab, text.indexOf('## Schluss', ab));
		behaupte(/Abgelehnt/.test(abschnitt), `Das Ergebnis fehlt: «${abschnitt.slice(0, 300)}»`);
		// Mit dem Namen der Gemeinschaft: Das Dokument lesen auch andere Häuser.
		const tatsache = abschnitt.search(
			/Die Versammlung von E2E Haus \d+ war bei diesem Beschluss nicht beschlussfähig \(ZGB Art\. 712p\)\./
		);
		const vorlegen = abschnitt.indexOf(
			'Der Antrag kann einer beschlussfähigen Versammlung erneut vorgelegt werden.'
		);
		const anfechten = abschnitt.indexOf(
			'Wer in dieser Gemeinschaft stimmberechtigt ist und mit der Ablehnung nicht einverstanden war, auch wer nicht dabei war, kann sie innert eines Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die Ablehnung in der Regel nur auf; angenommen ist der Antrag damit nicht.'
		);
		behaupte(
			tatsache >= 0 && vorlegen > tatsache && anfechten > vorlegen,
			`Der Satz fehlt oder steht in falscher Reihenfolge (${tatsache}, ${vorlegen}, ${anfechten}): «${abschnitt.slice(0, 500)}»`
		);
		behaupte(
			/Die Frist beginnt für Anwesende und Vertretene mit der Versammlung/.test(abschnitt),
			'Der Fristbeginn fehlt im Protokoll des Abends'
		);
		behaupte(
			!/von Hand festgehalten|übergangen|Notweg|Sperre/i.test(abschnitt),
			`Das Protokoll des Abends verrät den Weg: «${abschnitt.slice(0, 300)}»`
		);
		return abschnitt.slice(0, 160);
	});

	/*
	 * **Der Weg zum Beschluss von Hand am Abend** (Produktentscheid 03.10.2026:
	 * «Ja, kurzer Verweis»). Die Hausverweise «Es tagen mit» führen auf die
	 * Leitungsseiten der Häuser, sagten aber nicht, dass der Beschluss von Hand
	 * dort liegt. Der Satz steht bei ihnen; gefolgt wird dem Hausverweis, und
	 * die Zielseite trägt die Maske.
	 */
	await schritt('9. Der Verweis am Abend führt zum Beschluss von Hand im Haus', async () => {
		await gehe(`/tage/${tag}/leitung`);
		const satz = seite
			.locator('p.klein')
			.filter({ hasText: 'Der Beschluss von Hand liegt bei jeder Gemeinschaft' });
		await warteAuf(satz, 'Der Satz zum Beschluss von Hand bei den Hausverweisen');
		const satztext = sauber(await satz.innerText());
		const verweis = seite.locator('ul.haeuser a').first();
		behaupte(await verweis.count(), 'Der Hausverweis bei «Es tagen mit» fehlt');
		const ziel = await verweis.getAttribute('href');
		await verweis.click();
		await seite.waitForURL((u) => u.pathname === ziel, { timeout: 15000 });
		await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		behaupte(
			seite.url().includes(ziel),
			`Der Verweis landete woanders: ${seite.url()} statt ${ziel}`
		);
		const maske = seite.locator('details.notweg details.vonhand');
		behaupte(
			(await maske.count()) === 1,
			`Die Zielseite trägt die Maske «Beschluss von Hand» nicht (${await maske.count()})`
		);
		/*
		 * `textContent`, nicht `innerText`: Der Notweg-Kasten ist zugeklappt,
		 * und `innerText` gibt für Verborgenes nichts aus. Am Markup gelesen ist
		 * die Maske trotzdem belegt.
		 */
		const maskentext = sauber(
			await maske.first().evaluate((el) => el.textContent ?? '')
		);
		behaupte(
			/Beschluss von Hand/.test(maskentext),
			`Die Maske heisst nicht «Beschluss von Hand»: «${maskentext.slice(0, 120)}»`
		);
		return `«${satztext}» → ${ziel}`;
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
