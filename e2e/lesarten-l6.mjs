/**
 * Durchstich: Lesart L6, Reglementsschranke (Migration 180, Fassung
 * 2026-11-05, Entscheid 0018, Einteilung F3b D1).
 *
 * **Der Weg.** Eine Gemeinschaft mit sechs Eigentümern zu 200, 180, 170, 160,
 * 150 und 140 von 1000. Die Verwaltung stellt L6 auf «Nach dem Gesetz»; die
 * Seite kennzeichnet die Vorgabe. Ein Traktandum zur Änderung des Reglements,
 * für die das Reglement selbst die Zustimmung aller verlangt, bekommt sein
 * Mehr nach der Umstellung, die Versammlung wird freigegeben, und danach
 * stellt die Verwaltung zurück: Die Versammlung rechnet trotzdem nach der
 * eingefrorenen Wahl. Im Saal fehlt der Eigentümer zu 140; die fünf
 * Anwesenden stimmen zu: Nach dem Gesetz angenommen (Köpfe 5 von 5,
 * Wertquoten 860 von 1000), nach der Klausel abgelehnt, denn der Abwesende
 * zählt wie ein Nein. Leitung und Protokoll nennen das Ergebnis nach der
 * anderen Lesart.
 *
 * Kriterien aus dem Konzept Lesarten, Abschnitt 5: 1, 2 (nur «zuletzt
 * geändert»), 3 (eingefroren), 4 (Satz vor der Abstimmung), 5 (Leitung mit
 * Zahlen), 6 (Protokoll), 8 (L6).
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l6.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l6';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Kostenschlüssel im Reglement neu nach Flächen';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss', 'Egli', 'Furrer'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['200', '180', '170', '160', '150', '140'];

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

/** Der Text eines Traktandums, aufgeklappt (wie in e2e/lesarten-l2.mjs). */
async function traktandumtext() {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('[data-traktandum]', { hasText: TITEL }).first();
	await zeile.locator('button.titel').click();
	await seite.waitForTimeout(400);
	return ((await zeile.textContent()) ?? '').replace(/\s+/g, ' ');
}

/** Auf der Seite der Lesarten L6 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L6"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L6, Reglementsschranke: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Lesart L6 ${LAUF}`;

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

	await schritt('Gemeinschaft mit sechs Eigentümern, ungleiche Wertquoten', async () => {
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
		return '200 + 180 + 170 + 160 + 150 + 140 von 1000';
	});

	await schritt('Die Seite nennt L6 mit Vorgabe; Umstellen mit Verlauf (Kriterien 1, 2)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(
			/Verlangt Ihr Reglement für seine eigene Änderung die Zustimmung aller/.test(text),
			`Die Frage zu L6 fehlt: ${text.slice(0, 600)}`
		);
		behaupte(
			await seite.locator('input[name="L6"][value="klausel"]').isChecked(),
			'Die Vorgabe ist nicht angekreuzt'
		);
		behaupte(/Rz\. 40, 40a, 125 und 145 ad Art\. 712g/.test(text), 'Die Fundstelle der Wahl fehlt (Kriterium 8)');
		await stelleUm(gemeinschaft, 'gesetz');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');
		return 'auf «Nach dem Gesetz» umgestellt';
	});

	await schritt('Versammlung mit Reglementsänderung, freigeben, zurückstellen (Kriterium 3)', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-15');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

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
			.fill('Der Kostenschlüssel wird neu nach Wohnfläche statt nach Wertquoten verteilt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-reglement-eigene-schranke');
		await abschicken(tf.locator('button[type="submit"]').first());

		const liste = await traktandumtext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Nach dem Gesetz», die für Ihre Gemeinschaft eingestellt ist/.test(liste),
			`Der Satz zur Lesart fehlt auf der Traktandenseite (Kriterium 4): ${liste.slice(0, 900)}`
		);

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		await stelleUm(gemeinschaft, 'klausel');
		return 'eingefroren «Nach dem Gesetz», Gemeinschaft wieder auf der Vorgabe';
	});

	await schritt('Im Saal: fünf Ja, der Sechste fehlt (Kriterien 4, 5, 8)', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		// Nur die ersten fünf bestätigen; der Eigentümer zu 140 bleibt abwesend
		// und zählt nach der Klausel wie ein Nein.
		for (const wer of LEUTE.slice(0, 5)) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			behaupte((await knopf.count()) > 0, `Keine Anwesenheit zu bestätigen für ${wer}`);
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		const vorher = await seitentext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Nach dem Gesetz»/.test(vorher),
			`Die eingefrorene Lesart steht nicht vor der Abstimmung (Kriterium 4): ${vorher.slice(0, 900)}`
		);

		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		// Sechs Parteien liegen über `SCHWELLE_GEFUEHRT`: Die Versammlung läuft
		// geführt, und dort ist der Grund beim Erfassen Pflicht. Ohne ihn hielt
		// der Browser das Absenden an, und der Durchgang schloss ohne Stimme
		// (docs/proben.md, 08.11.2026).
		await seite
			.locator('form[action="?/erfassen"] input[name="begruendung"]')
			.first()
			.fill('Prüflauf: im Saal von Hand abgestimmt.');
		for (const wer of LEUTE.slice(0, 5)) {
			await seite
				.locator('tr', { hasText: wer })
				.first()
				.locator('input[type="radio"][value="yes"]')
				.first()
				.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		const erfasst = await seitentext();
		behaupte(
			/5 von 5 haben abgestimmt/.test(erfasst),
			`Die Erfassung kam nicht an: ${erfasst.match(/\d+ von \d+ haben abgestimmt/)?.[0] ?? erfasst.slice(0, 600)}`
		);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Angenommen'), `Nach dem Gesetz nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Nach dem Gesetz»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Klausel anwenden»: .*\) wäre er abgelehnt: 5 Ja von 6 Kopfstimmen, nötig 6\./.test(kasten),
			`Das Ergebnis nach der anderen Lesart fehlt: ${kasten.slice(0, 1200)}`
		);
		return 'angenommen; nach der Klausel abgelehnt';
	});

	await schritt('Das Protokoll nennt Lesart und abweichendes Ergebnis (Kriterium 6)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes('Gezählt nach dem qualifizierten Mehr nach dem Gesetz. Ob eine Klausel gilt, nach der das Reglement nur mit der Zustimmung aller geändert werden kann, ist umstritten.'),
			`Die Lesart fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Klausel anwenden»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 5 Ja von 6 Kopfstimmen, nötig 6\./.test(entwurf),
			`Die Feststellung am Ausgang fehlt: ${entwurf.slice(0, 1500)}`
		);
		return 'Lesart und Feststellung';
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
