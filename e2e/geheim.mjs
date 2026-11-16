/**
 * Die geheime Abstimmung im Saal (Produktentscheide 28.09.2026, Migration 141).
 *
 * **Der Fall:** Zwei Eigentümer, beide dafür. Die Versammlung verlangt eine
 * geheime Abstimmung; die Leitung kreuzt das beim Eröffnen an. Danach zeigen
 * Leinwand, Telefon, Auswertung und Protokoll nur «erreicht» oder «nicht
 * erreicht» — keine Zahlen, aus denen sich eine Einheit zurückrechnen lässt.
 *
 * **Was das Drehbuch prüft.** Der ganze Weg in der Oberfläche: Das Häkchen
 * steht am Eröffnen, die Leitung zeigt danach den geheimen Satz, die Auswertung
 * trägt keinen Zahlenspiegel, und das Protokoll vermerkt die geheime Abstimmung
 * mit dem Hinweis auf das versiegelte Paket.
 *
 * Der Rechenweg steht in `tests/domain/auszaehlung.test.ts`, der Schreibweg und
 * die blinden Spiegel in `tests/db/abstimmung.test.ts`, die Trennung im Paket in
 * `tests/db/siegel.test.ts`. Hier läuft die Kette in der Oberfläche.
 *
 * Aufruf: `node e2e/geheim.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-geheim';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

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

async function seitentext() {
	return (await seite.locator('main').innerText()).replace(/\s+/g, ' ');
}

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

console.log(`\nGeheime Abstimmung — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	const NAME = `Prüflauf Geheim ${LAUF}`;
	const LEUTE = ['Aebi', 'Bucher'];

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

	await schritt('Gemeinschaft mit zwei Eigentümern', async () => {
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
			await ef.locator('input[name="quote.stamm"]').fill('500');
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
		return 'zwei zu je einem Halben';
	});

	await schritt('Versammlung, Traktandum, freigeben, eröffnen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-10-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill('Wahl des Verwalters');
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Verwaltung wird für zwei Jahre gewählt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(tf.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());

		await gehe(`/versammlungen/${versammlung}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());
		return versammlung.slice(0, 8);
	});

	await schritt('Beide anwesend, Traktandum aufgerufen', async () => {
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		behaupte(
			/2 von 2|2 Parteien/.test(await seitentext()),
			`Nicht alle anwesend: ${(await seitentext()).slice(0, 250)}`
		);

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Wahl des Verwalters' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Wahl');
		await abschicken(aufrufen);
		await gehe(`/versammlungen/${versammlung}/leitung`);
		return 'beide anwesend';
	});

	await schritt('Geheim eröffnen: Das Häkchen steht am Freigeben', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const haken = seite.locator('form[action="?/oeffnen"] input[name="geheim"]');
		behaupte(await haken.count(), 'Kein Häkchen für die geheime Abstimmung');
		const beschriftung = await seite
			.locator('label:has(input[name="geheim"])')
			.first()
			.innerText();
		behaupte(
			/erreicht/.test(beschriftung) && /nicht erreicht/.test(beschriftung),
			`Die Wirkung der geheimen Abstimmung steht nicht am Häkchen: ${beschriftung}`
		);
		await haken.check();
		/*
		 * **Geheim nur mit Grundlage** (Ä-38, Migrationen 165 und 166): ohne den
		 * offenen Beschluss oder das Reglement weist das Eröffnen ab. Hier der
		 * Beschluss; Absage und Reglement prüft `tests/db/abstimmung.test.ts`.
		 */
		const beschluss = seite.locator('form[action="?/oeffnen"] input[name="geheimBeschlossen"]');
		behaupte(await beschluss.count(), 'Kein Häkchen für den offenen Beschluss');
		await beschluss.first().check();
		/*
		 * **Der Knopf im Formular mit dem Häkchen**, nicht der erste der Seite:
		 * Daneben steht der Notweg-Knopf (`notweg=ja`) ohne die Wahl, und ein
		 * `first()` eröffnet dann offen, während das Häkchen ungesendet bleibt.
		 */
		const form = seite.locator('form[action="?/oeffnen"]:has(input[name="geheim"])');
		await abschicken(form.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const text = await seitentext();
		behaupte(/Geheime Abstimmung/.test(text), `Die Ansage fehlt: ${text.slice(0, 300)}`);
		return 'eröffnet, angesagt';
	});

	await schritt('Beide stimmen Ja — die Auszählung bleibt vollständig', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		if (await oeffnen.count()) await abschicken(oeffnen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await oeffneErfassung();

		for (const wer of LEUTE) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator('input[type="radio"][value="yes"]').first();
			behaupte(await knopf.count(), `Keine Stimmwahl für ${wer}`);
			await knopf.check();
		}
		await oeffneErfassung();
		const erfassen = seite.locator('form[action="?/erfassen"] button[type="submit"]');
		behaupte(await erfassen.count(), 'Kein Knopf zum Erfassen der Stimmen');
		await abschicken(erfassen.first());
		return '2 zu 0';
	});

	await schritt('Die Leitung zeigt den geheimen Satz, die Auswertung keine Zahlen', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const schliessen = seite.locator('form[action="?/schliessen"] button[type="submit"]');
		behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen');
		await abschicken(schliessen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const zeile = seite.locator('.baum li', { hasText: 'Wahl des Verwalters' }).first();
		const marke = (await zeile.locator('.marke').first().innerText()).trim();
		behaupte(marke === 'angenommen', `Die Marke ist «${marke}» statt «angenommen»`);
		const text = await seitentext();
		behaupte(/Geheim abgestimmt/.test(text), `Der geheime Satz fehlt: ${text.slice(0, 300)}`);
		behaupte(
			/Kopfstimmen: erreicht/.test(text),
			`Der Satz nennt das Ergebnis nicht: ${text.slice(0, 300)}`
		);

		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const wert = await seitentext();
		behaupte(/Geheim abgestimmt/.test(wert), `Der geheime Satz fehlt: ${wert.slice(0, 300)}`);
		behaupte(
			!/\d+ ja/.test(wert),
			`Die Auswertung nennt Zahlen: ${wert.slice(0, 400)}`
		);
		return 'ohne Zahlenspiegel';
	});

	await schritt('Das Protokoll vermerkt die geheime Abstimmung', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);

		await gehe(`/versammlungen/${versammlung}/protokoll`);
		const erzeugen = seite.locator('button', { hasText: 'Entwurf erzeugen' }).first();
		behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen des Entwurfs');
		await abschicken(erzeugen);
		await gehe(`/versammlungen/${versammlung}/protokoll`);

		const feld = seite.locator('textarea[name="body"]').first();
		behaupte(await feld.count(), 'Kein Textfeld mit dem Protokollentwurf');
		const entwurf = (await feld.inputValue()).replace(/\s+/g, ' ');
		behaupte(
			/Geheim abgestimmt/.test(entwurf),
			`Der Vermerk fehlt im Protokoll: ${entwurf.slice(0, 400)}`
		);
		behaupte(
			/Stimmnachweisblatt im Abschlusspaket/.test(entwurf),
			`Der Hinweis auf das Paket fehlt: ${entwurf.slice(0, 400)}`
		);
		behaupte(
			/zuvor offen beschlossen, über diesen Antrag geheim abzustimmen/.test(entwurf),
			`Die Grundlage der geheimen Abstimmung fehlt: ${entwurf.slice(0, 400)}`
		);
		behaupte(
			!/- Kopfstimmen: \d/.test(entwurf),
			`Das Protokoll nennt einen Zahlenspiegel: ${entwurf.slice(0, 600)}`
		);
		return 'im Entwurf';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
