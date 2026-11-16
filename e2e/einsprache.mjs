/**
 * Der Einsprachebeschluss nach ZGB Art. 712c Abs. 2 im Browser.
 *
 * **Der Fall:** Vier Eigentümer zu je einem Viertel, alle anwesend. Aebi
 * verkauft ihre Wohnung. Über die Einsprache der übrigen entscheidet die
 * Versammlung ohne sie: Bucher und Christen sagen Ja, Duss Nein. Ohne Aebi
 * steht es 2 Ja von 3 Kopfstimmen, nötig sind 2, also angenommen. Zählte Aebi mit,
 * wäre die Basis 4, nötig wären 3, und der Beschluss wäre abgelehnt.
 *
 * **Was das Drehbuch prüft.** Die Kette in der Oberfläche: Das Traktandum
 * entsteht über den Entscheidbaum (Ast «Sonderfälle», Frage `f8-1`, Antwort
 * «Einsprache …»), die Karte nennt Rechtsgrundlage und 14-Tage-Frist. Ohne
 * eingetragene Betroffene sperrt die Freigabe; mit Aebi als Betroffener ist sie
 * frei. In der Leitung fehlt Aebi in der Stimmerfassung, die Bezugsgrösse ist
 * 3, das Ergebnis angenommen. Das Protokoll nennt Aebi und den Grund.
 *
 * Wortlaut und Rechnung am Kern prüft `tests/domain/einsprache-712c.test.ts`,
 * die Datenhaltung samt Sperre `tests/db/einsprache-712c.test.ts`. Hier läuft
 * dieselbe Kette durch die Seiten.
 *
 * Aufruf: `node e2e/einsprache.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-einsprache';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

// Der Wortlaut der Antwort steht in `src/lib/rules/quorum-2026-10-20.ts`;
// geprüft wird hier nur dieser Teil, wie bei den übrigen Drehbüchern.
const ANTWORT = 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht';
const TITEL = 'Einsprache gegen den Verkauf von Whg 1';
/*
 * **Der Zeitstempel gehört an den Namen** (Pendenzen 20.10.2026): Ohne ihn
 * bleiben «Aebi», «Bucher», «Christen» und «Duss» nach
 * `scripts/testdaten-entfernen.sql` stehen, weil kein Namensmuster auf sie
 * passt. Die Prüfungen unten suchen «Aebi» weiter als Teilzeichenkette.
 */
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss'].map((n) => `${n} ${LAUF}`);
const BETROFFENE = LEUTE[0];

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
}

let browser;
let seite;

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (f) {
		fehler.push({ nr, titel, text: f.message });
		console.log(`  ✗ ${nr} ${titel}\n     ${f.message}`);
		try {
			await seite.screenshot({ path: `${AUFNAHMEN}/fehler-${nr}.png`, fullPage: true });
			console.log(`     Bild: ${AUFNAHMEN}/fehler-${nr}.png`);
		} catch {
			/* ohne Bild weiter */
		}
		throw f;
	}
}

/** Ein Formular abschicken und auf die Wirkung warten (wie in den übrigen Drehbüchern). */
async function abschicken(knopf) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click()
	]);
	await nachAbsendung(seite, antwort, nachladen, 300);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

/**
 * Was auf der Seite steht, samt der Quittung unten rechts.
 *
 * Bestätigende Meldungen ziehen in den `Einblender` um, und der steht neben
 * `main`; wer nur `main` liest, sieht die Freigabe-Quittung nicht. Dieselbe
 * Stelle liest `e2e/ausstand.mjs`.
 */
async function seitentext() {
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
}

/**
 * Die Erfassungstabelle aufklappen, wie in `e2e/ausstand.mjs`.
 *
 * Seit «Dass der Sitzungsleiter für die Eigentümer abstimmen darf, ist per
 * Default auszublenden» liegt sie hinter einem `<details>`; ein eingeklapptes
 * Feld ist für Playwright unsichtbar. Per `evaluate`, weil die Seite bei jeder
 * Änderung nachlädt und ein Klick auf das `summary` ins Leere treffen kann.
 */
async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nEinsprachebeschluss nach Art. 712c Abs. 2 — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	let traktandum;
	const NAME = `Prüflauf Einsprache ${LAUF}`;

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

	await schritt('Gemeinschaft mit vier Eigentümern zu je einem Viertel', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

		for (const [i, wer] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill('250');
			await abschicken(ef.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const pf = seite.locator('form[action$="anlegen"]').first();
			await pf.locator('input[name="displayName"]').fill(wer);
			await abschicken(pf.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const zf = seite.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
			await abschicken(zf.locator('button[type="submit"]'));
		}
		return `${LEUTE.length} Eigentümer, Zählweise je Eigentümer`;
	});

	await schritt('Versammlung anlegen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-20');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);
		return versammlung.slice(0, 8);
	});

	await schritt('Traktandum anlegen, Erfordernis über den Entscheidbaum', async () => {
		/*
		 * **Der Weg ist der Prüfstein.** Das Erfordernis wird nicht im
		 * Anlegeformular gesetzt, sondern am Traktandum über den Baum: Ast
		 * «Sonderfälle», Frage `f8-1`, Antwort «Einsprache …». Nur so belegt der
		 * Lauf, dass die Antwort im Baum steht und bis ans Traktandum kommt.
		 */
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill(TITEL);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Gemeinschaft erhebt Einsprache gegen den Verkauf von Whg 1.');
		await abschicken(tf.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const zeile = seite
			.locator('li[data-traktandum]', { hasText: TITEL })
			.first();
		traktandum = await zeile.getAttribute('data-traktandum');
		behaupte(traktandum, `Traktandum nicht angelegt: ${(await seitentext()).slice(0, 300)}`);

		await gehe(`/versammlungen/${versammlung}/traktanden/${traktandum}/erfordernis`);
		const text = await seitentext();
		behaupte(
			/Worum geht es\?/.test(text) && /Sonderfälle/.test(text),
			`Der Einstieg in den Baum fehlt: ${text.slice(0, 400)}`
		);

		const ast = seite.locator('a[href*="ast=a-sonderfaelle"]').first();
		behaupte(await ast.count(), 'Kein Weg in den Ast «Sonderfälle»');
		await ast.click();
		await seite.waitForURL(/ast=a-sonderfaelle/, { timeout: 30000 });
		await seite.waitForLoadState('domcontentloaded');

		const frage = seite.locator('main h2', { hasText: 'Welcher Sonderfall?' });
		behaupte(await frage.count(), 'Die Frage `f8-1` fehlt im Ast «Sonderfälle»');

		const antwort = seite.locator('a[href*="p=f8-1-einsprache"]').first();
		behaupte(await antwort.count(), `Die Antwort «${ANTWORT}» fehlt`);
		const antworttext = (await antwort.innerText()).replace(/\s+/g, ' ');
		behaupte(
			antworttext.includes(ANTWORT),
			`Die Antwort trägt nicht den Wortlaut «${ANTWORT}»: ${antworttext.slice(0, 300)}`
		);
		await antwort.click();
		await seite.waitForURL(/p=f8-1-einsprache/, { timeout: 30000 });
		await seite.waitForLoadState('domcontentloaded');

		const karte = seite.locator('article.karte').first();
		behaupte(await karte.count(), `Keine Ergebniskarte: ${(await seitentext()).slice(0, 400)}`);
		const kartentext = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/ZGB Art\. 712c Abs\. 2 und 3/.test(kartentext),
			`Die Rechtsgrundlage fehlt: ${kartentext.slice(0, 500)}`
		);
		behaupte(
			/innert 14 Tagen beim Eigentümer eingehen, der verkauft, vermietet oder belastet/.test(
				kartentext
			),
			`Der Hinweis auf die 14-Tage-Frist fehlt: ${kartentext.slice(0, 800)}`
		);

		const uebernehmen = seite.locator('form[action="?/uebernehmen"] button[type="submit"]');
		behaupte(await uebernehmen.count(), 'Kein Knopf «Für dieses Traktandum übernehmen»');
		await abschicken(uebernehmen.first());

		behaupte(
			seite.url().includes(`/versammlungen/${versammlung}/traktanden`),
			`Nach dem Übernehmen steht eine andere Seite: ${seite.url()}`
		);
		const liste = await seitentext();
		behaupte(
			new RegExp(ANTWORT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(liste),
			`Das Erfordernis steht nicht am Traktandum: ${liste.slice(0, 500)}`
		);
		return 'Ast Sonderfälle, Frage f8-1, Antwort Einsprache';
	});

	await schritt('Ohne Betroffene ist die Freigabe gesperrt', async () => {
		/*
		 * Kriterium 3, erste Richtung. Der Satz nennt den Grund; der fehlende
		 * Freigabeknopf wird erst danach behauptet, damit die Prüfung an der
		 * geladenen Seite und ihrem Hindernis hängt und nicht an einem
		 * Nicht-Ereignis.
		 */
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const text = await seitentext();
		behaupte(
			new RegExp(
				`Traktandum [^,]+, «${TITEL}», betrifft eine Einsprache, aber niemand ist als betroffen eingetragen`
			).test(text),
			`Das Hindernis fehlt: ${text.slice(0, 700)}`
		);
		behaupte(
			/wer verkauft, vermietet oder belastet/.test(text),
			`Der Grund nennt die betroffene Person nicht: ${text.slice(0, 700)}`
		);
		behaupte(
			/Die Freigabe ist gesperrt, solange die Punkte oben offen sind/.test(text),
			`Die Freigabe ist nicht als gesperrt ausgewiesen: ${text.slice(0, 700)}`
		);
		behaupte(
			(await seite.locator('form[action$="freigeben"] button[type="submit"]').count()) === 0,
			'Die Freigabe ist trotz fehlender Betroffener möglich'
		);
		return 'gesperrt, mit Grund';
	});

	await schritt('Aebi als Betroffene eintragen, danach ist die Freigabe frei', async () => {
		/*
		 * Kriterium 3, zweite Richtung, und der Aufbau für die Abstimmung. Der
		 * Eintrag steht am Traktandum im Entwurf, wie bei der Ausschlussklage;
		 * das Feld heisst hier «Betroffene Partei, sie stimmt nicht mit».
		 */
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const zeile = seite.locator('li[data-traktandum]', { hasText: TITEL }).first();
		await zeile.locator('button.titel').click();
		const form = seite.locator('form[action="?/speichern"]').first();
		await form.waitFor({ timeout: 10000 });
		const feld = (await form.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Betroffene Partei, sie stimmt nicht mit/.test(feld),
			`Das Feld heisst nicht «Betroffene Partei»: ${feld.slice(0, 400)}`
		);
		const kaestchen = form
			.locator('label', { hasText: BETROFFENE })
			.locator('input[name="betroffene"]');
		behaupte(await kaestchen.count(), `Kein Kästchen für ${BETROFFENE}`);
		await kaestchen.first().check();
		await abschicken(form.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(
			await frei.count(),
			`Die Freigabe bleibt gesperrt: ${(await seitentext()).slice(0, 500)}`
		);
		await abschicken(frei.first());
		behaupte(
			/Freigegeben\./.test(await seitentext()),
			`Die Freigabe ist nicht bestätigt: ${(await seitentext()).slice(0, 400)}`
		);
		return 'frei und freigegeben';
	});

	await schritt('Eröffnen, alle vier anwesend', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(auf.first());

		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator(
				'form[action="?/bestaetigen"] button[type="submit"]:not([hidden])'
			);
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		const text = await seitentext();
		behaupte(
			/4 von 4 Parteien anwesend/.test(text),
			`Nicht alle vier anwesend: ${text.slice(0, 400)}`
		);
		return '4 von 4';
	});

	await schritt('Leitung: Einsprache aufgerufen, Aebi als betroffen genannt', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		behaupte(await zeile.count(), `Die Einsprache fehlt im Baum: ${(await seitentext()).slice(0, 500)}`);
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		const jetzt = (await seite.locator('li.jetzt, .jetzt').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Einsprache gegen den Verkauf/.test(jetzt),
			`Aufgerufen ist etwas anderes: ${jetzt.slice(0, 200)}`
		);
		// Nur der Saalhinweis, nicht die ganze Seite: Aebi steht auch anderswo.
		const hinweis = seite.locator('p.saalhinweis', { hasText: 'Unmittelbar betroffen:' });
		behaupte(
			(await hinweis.count()) === 1,
			`Die Betroffene steht nicht in der Leitung: ${(await seitentext()).slice(0, 700)}`
		);
		const betroffen = (await hinweis.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/^Unmittelbar betroffen: Aebi\b/.test(betroffen),
			`Als betroffen steht jemand anderes: ${betroffen}`
		);
		return 'aufgerufen, Aebi betroffen';
	});

	await schritt('Abstimmung öffnen, Aebi steht nicht in der Erfassung', async () => {
		/*
		 * Kriterium 4. Der Nachweis ist die Erfassung: Die drei übrigen sind da,
		 * Aebi nicht. Die Abwesenheit wird erst behauptet, nachdem die drei
		 * anderen positiv belegt sind; damit hängt sie an der geladenen Tabelle
		 * und nicht an einem leeren Nicht-Ereignis.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 400)}`);
		await abschicken(oeffnen.first());

		await oeffneErfassung();
		const erfassung = seite.locator('form[action="?/erfassen"]');
		behaupte(await erfassung.count(), 'Keine Erfassungstabelle');
		const wen = (await erfassung.locator('tr').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
		for (const wer of ['Bucher', 'Christen', 'Duss']) {
			behaupte(new RegExp(wer).test(wen), `${wer} fehlt in der Erfassung: ${wen.slice(0, 300)}`);
		}
		behaupte(
			!/Aebi/.test(wen),
			`Die Betroffene steht in der Erfassung: ${wen.slice(0, 300)}`
		);
		return 'Bucher, Christen und Duss erfassbar';
	});

	await schritt('Zwei Ja und ein Nein: 2 Ja von 3 Kopfstimmen, angenommen', async () => {
		/*
		 * **Der Prüfstein.** Mit Aebi wäre die Basis 4 und nötig 3; 2 Ja wären
		 * abgelehnt. Ohne sie ist die Basis 3, nötig 2, und der Beschluss steht.
		 * Derselbe Sachverhalt, ein anderes Ergebnis.
		 */
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Bucher', 'yes'],
			['Christen', 'yes'],
			['Duss', 'no']
		]) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator(`input[type="radio"][value="${wahl}"]`).first();
			behaupte(await knopf.count(), `Kein Stimmknopf für ${wer}`);
			await knopf.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		const karte = seite.locator('article.ergebnis', { hasText: 'Einsprache gegen den Verkauf' });
		behaupte((await karte.count()) === 1, `Das Ergebnis steht ${await karte.count()}× da`);
		const kasten = (await karte.first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/2 Ja von 3 Kopfstimmen/.test(kasten),
			`Die Kopfstimmen stimmen nicht: ${kasten.slice(0, 500)}`
		);
		behaupte(
			/Bezugsgrösse 3, nötig 2/.test(kasten),
			`Die Bezugsgrösse ist nicht 3: ${kasten.slice(0, 500)}`
		);
		// Am Ergebnissatz, nicht an der ganzen Karte: Er beginnt mit
		// «Angenommen …» oder «Abgelehnt …».
		const satz = (await karte.first().locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Angenommen'), `Nicht angenommen: ${satz.slice(0, 500)}`);
		return '2 Ja von 3 Kopfstimmen, angenommen';
	});

	await schritt('Das Protokoll nennt Aebi und den Grund', async () => {
		/*
		 * Kriterium 5. Wortlaut aus `src/lib/domain/auszaehlung.ts`; geprüft wird
		 * der Anfang, damit eine spätere Ergänzung am Satz den Schritt nicht
		 * bricht, ohne dass die Aussage verloren geht.
		 */
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		const erzeugen = seite.locator('form[action="?/entwurf"] button[type="submit"]');
		behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen des Entwurfs');
		await abschicken(erzeugen.first());
		const feld = seite.locator('textarea[name="body"]').first();
		behaupte(await feld.count(), 'Kein Textfeld mit dem Protokollentwurf');
		const entwurf = (await feld.inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes(
				`«${BETROFFENE}» zählte nicht mit: Wer verkauft, vermietet oder belastet`
			),
			`Der Satz zur Betroffenen fehlt: ${entwurf.slice(0, 1200)}`
		);
		behaupte(
			/Art\. 712c Abs\. 2 ZGB/.test(entwurf),
			`Die Fundstelle fehlt im Protokoll: ${entwurf.slice(0, 1200)}`
		);
		return 'Aebi genannt, mit Grundlage';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
