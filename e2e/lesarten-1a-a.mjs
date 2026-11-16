/**
 * Durchstich: 1a und das Mehr aus Gesetz und Reglement (Lesarten Block 6,
 * Migration 173, Entscheid 0023).
 *
 * **Der Weg.** Fünf Eigentümer: Aebi, Bucher, Christen und Egger mit je 100,
 * Duss mit 600. Egger fehlt. Zwei Traktanden:
 *
 * - **Ermächtigung zur Ausschlussklage gegen Duss** (1a): Aebi und Bucher Ja,
 *   Christen Nein. An allen ausser dem Beklagten 2 Ja von 4, nötig 3,
 *   abgelehnt; an den Anwesenden 2 von 3, nötig 2, angenommen. Leitung und
 *   Protokoll nennen es.
 * - **Revisionsstelle wählen** (Anhang A): Der Baum schlägt das einfache Mehr
 *   vor, die Leitung wählt mit Begründung das qualifizierte. Aebi, Bucher und
 *   Christen Ja, Duss Nein: Wertquoten 300 von 1000, abgelehnt; nach dem Mehr
 *   aus Gesetz und Reglement angenommen. Die Leitung nennt es, das Protokoll
 *   nicht.
 *
 * Kriterien aus dem Entwurf Block 6: 1, 3, 4, 5.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-1a-a.mjs
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit.
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-1a-a';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const KLAGE = 'Ermächtigung zur Ausschlussklage gegen Duss';
const WAHL = 'Revisionsstelle wählen';
const NAMEN = ['Aebi', 'Bucher', 'Christen', 'Duss', 'Egger'];
const LEUTE = NAMEN.map((n) => `${n} ${LAUF}`);
const QUOTEN = ['100', '100', '100', '600', '100'];

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
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? `: ${ergebnis}` : ''}`);
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
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
}

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

/** Die Kennung eines Traktandums aus der Liste. */
async function traktandumId(titel) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const id = await seite.locator('li[data-traktandum]', { hasText: titel }).first().getAttribute('data-traktandum');
	behaupte(id, `«${titel}» steht nicht in der Liste`);
	return id;
}

async function neuesTraktandum(titel, wortlaut, knoten) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill(titel);
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]').first().fill(wortlaut);
	await tf.locator('select[name="erfordernis"]').selectOption(knoten);
	await abschicken(tf.locator('button[type="submit"]').first());
}

/** Aufrufen, öffnen, Stimmen erfassen, schliessen; gibt den Text der Ergebniskarte. */
async function stimmeAb(titel, stimmen) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = seite.locator('.baum li', { hasText: titel }).first();
	await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
	const vorher = await seitentext();
	await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
	await oeffneErfassung();
	for (const [wer, wahl] of stimmen) {
		await seite.locator('tr', { hasText: `${wer} ${LAUF}` }).first().locator(`input[type="radio"][value="${wahl}"]`).first().check();
	}
	await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
	await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const karte = seite.locator('article.ergebnis', { hasText: titel }).first();
	return { vorher, satz: (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' '), kasten: (await karte.innerText()).replace(/\s+/g, ' ') };
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\n1a und Mehr aus Gesetz und Reglement: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Block 6 ${LAUF}`;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 }).catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Gemeinschaft mit fünf Eigentümern', async () => {
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
			await ef.locator('input[name="quote.stamm"]').fill(QUOTEN[i]);
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
		return '100 + 100 + 100 + 600 + 100 von 1000';
	});

	await schritt('Versammlung mit zwei Traktanden; Duss beklagt', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-16');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await neuesTraktandum(KLAGE, 'Die Verwaltung wird ermächtigt, gegen Duss auf Ausschluss zu klagen.', 'k-ausschlussklage');
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const kz = seite.locator('li[data-traktandum]', { hasText: KLAGE }).first();
		await kz.locator('button.titel').click();
		await seite.waitForTimeout(400);
		const liste = ((await kz.textContent()) ?? '').replace(/\s+/g, ' ');
		behaupte(
			liste.includes('Nach der Auszählung nennt Votum auch das Ergebnis, gezählt an den Anwesenden und Vertretenen ausser dem Beklagten.'),
			`Die Ankündigung zu 1a fehlt (Kriterium 4): ${liste.slice(0, 900)}`
		);
		const kform = seite.locator('form[action="?/speichern"]').first();
		await kform.locator('label', { hasText: LEUTE[3] }).locator('input[name="betroffene"]').first().check();
		await abschicken(kform.locator('button[type="submit"]').first());

		await neuesTraktandum(WAHL, 'Die Versammlung wählt die Revisionsstelle.', 'k-organ-waehlen');
		return 'Ausschlussklage und Wahl';
	});

	await schritt('Die Leitung weicht bei der Wahl mit Begründung ab (Anhang A)', async () => {
		const id = await traktandumId(WAHL);
		await gehe(`/versammlungen/${versammlung}/traktanden/${id}/erfordernis?ast=a-organe&p=f2-1-organ`);
		await seite.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
		const form = seite.locator('form[action="?/setzen"]:has(input[name="ast"])').first();
		behaupte(await form.count(), `Kein Formular zum Abweichen: ${(await seitentext()).slice(0, 400)}`);
		await form.locator('select[name="typ"]').selectOption('qualifiziertes_mehr');
		await form.locator('[name="begruendung"]').fill('Prüflauf: so stand es in der Einladung.');
		await abschicken(form.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		return 'qualifiziert statt einfach, freigegeben';
	});

	await schritt('Eröffnen; alle da ausser Egger', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const marke = await seite.evaluate((ohne) => {
				for (const f of document.querySelectorAll('form[action="?/bestaetigen"]')) {
					const knopf = f.querySelector('button[type="submit"]:not([hidden])');
					const zeile = f.closest('tr, li');
					if (knopf && zeile && !(zeile.textContent ?? '').includes(ohne)) {
						knopf.setAttribute('data-ziel', '1');
						return true;
					}
				}
				return false;
			}, LEUTE[4]);
			if (!marke) break;
			await abschicken(seite.locator('button[data-ziel="1"]').first());
		}
		return 'vier anwesend';
	});

	await schritt('Ausschlussklage: abgelehnt, an den Anwesenden angenommen (Kriterien 1, 5)', async () => {
		const r = await stimmeAb(KLAGE, [['Aebi', 'yes'], ['Bucher', 'yes'], ['Christen', 'no']]);
		behaupte(r.satz.startsWith('Abgelehnt'), `Nicht abgelehnt: ${r.satz.slice(0, 300)}`);
		behaupte(
			/Gezählt nur an den Anwesenden und Vertretenen ausser dem Beklagten, wie es ein Teil der Fachliteratur genügen lässt, wäre er angenommen: 2 Ja von 3 Kopfstimmen, nötig 2\./.test(r.kasten),
			`Das zweite Ergebnis fehlt: ${r.kasten.slice(0, 1200)}`
		);
		return 'abgelehnt; an den Anwesenden 2 von 3';
	});

	await schritt('Wahl: abgelehnt, nach Gesetz und Reglement angenommen (Kriterien 3, 4)', async () => {
		const r = await stimmeAb(WAHL, [['Aebi', 'yes'], ['Bucher', 'yes'], ['Christen', 'yes'], ['Duss', 'no']]);
		behaupte(/Nach Gesetz und Reglement gälte/.test(r.vorher), `Die Ankündigung fehlt vor der Abstimmung: ${r.vorher.slice(0, 900)}`);
		behaupte(r.satz.startsWith('Abgelehnt'), `Nicht abgelehnt: ${r.satz.slice(0, 300)}`);
		behaupte(
			/Nach dem Mehr aus Gesetz und Reglement \(.*\) wäre er angenommen: 3 Ja von 4 Kopfstimmen, nötig 3\./.test(r.kasten),
			`Das Ergebnis nach Gesetz und Reglement fehlt: ${r.kasten.slice(0, 1200)}`
		);
		return 'abgelehnt; nach Gesetz und Reglement angenommen';
	});

	await schritt('Protokoll: 1a ja, Anhang A nein (Entscheid 0023)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes('Gezählt nur an den Anwesenden und Vertretenen ausser dem Beklagten, wäre der Antrag angenommen gewesen: 2 Ja von 3 Kopfstimmen, nötig 2.'),
			`Die Zeile zu 1a fehlt: ${entwurf.slice(0, 1500)}`
		);
		behaupte(!entwurf.includes('Gesetz und Reglement'), `Das Mehr aus Gesetz und Reglement steht im Protokoll: ${entwurf.slice(0, 1500)}`);
		return 'eine Zeile zu 1a, keine zu Anhang A';
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
