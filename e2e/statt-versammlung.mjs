/**
 * Durchstich: Entscheiden statt der Versammlung (C1, C2a bis C2c, Fassung
 * 2026-10-27, Entscheide 0018 und 0021).
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern. Drei Traktanden bekommen
 * ihr Mehr über den Entscheidbaum, wie es eine Sitzungsleitung tut:
 *
 *   1. Der Ausschuss legt das Pflichtenheft der Bewirtschaftung fest (C2a):
 *      «Bewirtschaftung und Organe» › «Einem Ausschuss oder Delegierten
 *      Aufgaben übertragen» › letztes Wort → Einstimmigkeit.
 *   2. Die Bewirtschaftung legt die Fondseinlage selbst fest (C1):
 *      «Bewirtschaftung mit Kompetenzen … ausstatten» › Ja → Einstimmigkeit.
 *      Die Antwort Nein führt zur bisherigen Karte mit qualifiziertem Mehr.
 *   3. Ein Delegierter beruft die Versammlung ein (C2b): andere Aufgaben ›
 *      nicht im Reglement → einfaches Mehr. Der Ausgabenrahmen führt zur Karte
 *      mit der Lesart L2 (Entscheid 0021).
 *
 * Im Saal stimmen bei 1 alle Ja, bei 2 und 3 zwei Ja und einer Nein: 1
 * angenommen, 2 abgelehnt (Einstimmigkeit), 3 angenommen (einfaches Mehr).
 *
 * Kriterien aus dem Auftrag Block 4: 1 (C1), 2 (C2), 4 (Einstimmigkeit rechnet
 * wie bisher).
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/statt-versammlung.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-statt-versammlung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const LEUTE = ['Aebi', 'Bucher', 'Christen'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['300', '300', '400'];

const TRAKTANDEN = [
	{
		titel: 'Ausschuss legt das Pflichtenheft fest',
		antrag: 'Der Ausschuss legt das Pflichtenheft der Bewirtschaftung abschliessend fest.',
		weg: ['f2-1-uebertragen', 'f2-1-uebertragung-statt'],
		karte: /Einstimmigkeit/,
		satz: /Auch mit Zustimmung aller bleibt bei der Versammlung/,
		stimmen: ['yes', 'yes', 'yes'],
		ergebnis: 'Angenommen'
	},
	{
		titel: 'Bewirtschaftung legt die Fondseinlage fest',
		antrag: 'Die Bewirtschaftung legt die jährliche Einlage in den Erneuerungsfonds selbst fest.',
		weg: ['f2-1-erweitert', 'f2-1-statt-ja'],
		karte: /Einstimmigkeit/,
		// Seit der Fassung 2026-11-04 (F4a, S6) «Verringert die Übertragung».
		satz: /Verringert die Übertragung die Mitwirkungsrechte der Eigentümer/,
		stimmen: ['yes', 'yes', 'no'],
		ergebnis: 'Abgelehnt'
	},
	{
		titel: 'Delegierter beruft die Versammlung ein',
		antrag: 'Ein Delegierter beruft künftig die Versammlung ein.',
		weg: ['f2-1-uebertragen', 'f2-1-uebertragung-anderes', 'f2-1-uebertragung-reglement-nein'],
		karte: /Einfaches Mehr/,
		satz: /Ausschuss oder Delegierter übernimmt andere Aufgaben/,
		stimmen: ['yes', 'yes', 'no'],
		ergebnis: 'Angenommen'
	}
];

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

/** Auf der Erfordernisseite den Ast «Organe» und dann die Antworten anklicken. */
async function geheWeg(versammlung, traktandum, weg) {
	await gehe(`/versammlungen/${versammlung}/traktanden/${traktandum}/erfordernis`);
	await seite.locator('a[href*="ast=a-organe"]').first().click();
	await seite.waitForURL(/ast=a-organe/, { timeout: 30000 });
	for (const antwort of weg) {
		await seite.locator(`a[href*="${antwort}"]`).first().click();
		await seite.waitForURL(new RegExp(antwort), { timeout: 30000 });
	}
	return (await seite.locator('article.karte').first().innerText()).replace(/\s+/g, ' ');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nEntscheiden statt der Versammlung (C1, C2): ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	const NAME = `Prüflauf Statt Versammlung ${LAUF}`;

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

	await schritt('Gemeinschaft mit drei Eigentümern', async () => {
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
		return '300 + 300 + 400 von 1000';
	});

	await schritt('Versammlung mit drei Traktanden, Mehr über den Baum (Kriterien 1 und 2)', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-20');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		for (const t of TRAKTANDEN) {
			await gehe(`/versammlungen/${versammlung}/traktanden`);
			await seite.locator('.neu button.haupt').click();
			await seite.waitForTimeout(250);
			const tf = seite.locator('form[action="?/anlegen"]').first();
			await tf.locator('input[name="titel"]').fill(t.titel);
			await tf.locator('input[name="art"][value="abstimmung"]').check();
			await seite.waitForTimeout(200);
			await tf
				.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
				.first()
				.fill(t.antrag);
			await abschicken(tf.locator('button[type="submit"]').first());
			await gehe(`/versammlungen/${versammlung}/traktanden`);
			const id = await seite
				.locator('li[data-traktandum]', { hasText: t.titel })
				.first()
				.getAttribute('data-traktandum');
			behaupte(id, `Traktandum «${t.titel}» nicht angelegt`);

			const karte = await geheWeg(versammlung, id, t.weg);
			behaupte(t.karte.test(karte), `«${t.titel}»: falsches Mehr auf der Karte: ${karte.slice(0, 600)}`);
			behaupte(t.satz.test(karte), `«${t.titel}»: erwarteter Satz fehlt: ${karte.slice(0, 900)}`);
			await abschicken(seite.locator('form[action="?/uebernehmen"] button[type="submit"]').first());
		}
		return 'Einstimmigkeit, Einstimmigkeit, einfaches Mehr';
	});

	await schritt('Gegenproben im Baum: Nein bei C1 und der Ausgabenrahmen', async () => {
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const id = await seite.locator('li[data-traktandum]').last().getAttribute('data-traktandum');
		const nein = await geheWeg(versammlung, id, ['f2-1-erweitert', 'f2-1-statt-nein']);
		behaupte(/Qualifiziertes Mehr/.test(nein), `Nein führt nicht zum qualifizierten Mehr: ${nein.slice(0, 500)}`);
		const rahmen = await geheWeg(versammlung, id, ['f2-1-uebertragen', 'f2-1-uebertragung-gewoehnlich']);
		behaupte(
			/Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regeln/.test(rahmen) &&
				/Seite «Lesarten» der Gemeinschaft/.test(rahmen),
			`Der Ausgabenrahmen führt nicht zur Karte mit L2: ${rahmen.slice(0, 600)}`
		);
		return 'qualifiziertes Mehr; Karte mit L2';
	});

	await schritt('Freigeben, eröffnen, alle anwesend', async () => {
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
	});

	for (const t of TRAKTANDEN) {
		await schritt(`Im Saal: ${t.titel} (Kriterium 4)`, async () => {
			await gehe(`/versammlungen/${versammlung}/leitung`);
			const zeile = seite.locator('.baum li', { hasText: t.titel }).first();
			await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
			await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
			await oeffneErfassung();
			for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
				await seite
					.locator('tr', { hasText: wer })
					.first()
					.locator(`input[type="radio"][value="${t.stimmen[i]}"]`)
					.first()
					.check();
			}
			await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
			await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
			await gehe(`/versammlungen/${versammlung}/leitung`);
			const karte = seite.locator('article.ergebnis', { hasText: t.titel }).first();
			const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
			behaupte(satz.startsWith(t.ergebnis), `Erwartet «${t.ergebnis}»: ${satz.slice(0, 400)}`);
			return satz.slice(0, 80);
		});
	}
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

if (fehler.length) {
	console.log(`\n${fehler.length} Schritt(e) rot.`);
	process.exit(1);
}
console.log('\nAlle Schritte grün.');
