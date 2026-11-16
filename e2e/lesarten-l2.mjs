/**
 * Durchstich: Lesart L2, Zuständigkeitsordnung ausserhalb des Reglements
 * (Migration 171, Fassung 2026-10-26, Entscheid 0018).
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern: zwei kleine Wohnungen zu
 * 200, eine grosse zu 600. Die Verwaltung stellt L2 auf «Qualifiziertes Mehr»;
 * die Seite kennzeichnet die Vorgabe. Ein Traktandum zur Zuständigkeitsordnung
 * bekommt sein Mehr nach der Umstellung, die Versammlung wird freigegeben, und
 * danach stellt die Verwaltung zurück: Die Versammlung rechnet trotzdem nach
 * der eingefrorenen Wahl. Im Saal stimmen die zwei kleinen Ja, die grosse Nein:
 * Köpfe 2 von 3 erreicht, Wertquoten 400 von 1000, nötig 501, abgelehnt; nach
 * dem einfachen Mehr angenommen. Leitung und Protokoll nennen das Ergebnis nach
 * der anderen Lesart.
 *
 * Kriterien aus dem Konzept, Abschnitt 5: 1, 2 (nur «zuletzt geändert»), 3
 * (eingefroren), 4 (Satz vor der Abstimmung), 5 (Leitung mit Zahlen), 6
 * (Protokoll), 8 (L2).
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l2.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l2';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Kleine Reparaturen über die Bewirtschaftung';
const LEUTE = ['Aebi', 'Bucher', 'Christen'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['200', '200', '600'];

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

/** Der Text eines Traktandums, aufgeklappt (wie in e2e/lesarten.mjs). */
async function traktandumtext() {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('[data-traktandum]', { hasText: TITEL }).first();
	await zeile.locator('button.titel').click();
	await seite.waitForTimeout(400);
	return ((await zeile.textContent()) ?? '').replace(/\s+/g, ' ');
}

/** Auf der Seite der Lesarten L2 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L2"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L2, Zuständigkeitsordnung: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Lesart L2 ${LAUF}`;

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

	await schritt('Gemeinschaft mit zwei kleinen und einer grossen Wohnung', async () => {
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
		return '200 + 200 + 600 von 1000';
	});

	await schritt('Die Seite nennt L2 mit Vorgabe; Umstellen mit Verlauf (Kriterien 1, 2)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(
			/Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regelt/.test(text),
			`Die Frage zu L2 fehlt: ${text.slice(0, 600)}`
		);
		behaupte(
			await seite.locator('input[name="L2"][value="einfach"]').isChecked(),
			'Die Vorgabe ist nicht angekreuzt'
		);
		behaupte(/Rz\. 109 ad Art\. 712a/.test(text), 'Die Fundstelle der Wahl fehlt (Kriterium 8)');
		await stelleUm(gemeinschaft, 'qualifiziert');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');
		return 'auf «Qualifiziertes Mehr» umgestellt';
	});

	await schritt('Versammlung mit Zuständigkeitsordnung, freigeben, zurückstellen (Kriterium 3)', async () => {
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
			.fill('Gewöhnliche Reparaturen an gemeinschaftlichen Teilen gibt nur noch die Bewirtschaftung in Auftrag.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-zustaendigkeit-gewoehnlich');
		await abschicken(tf.locator('button[type="submit"]').first());

		const liste = await traktandumtext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr», die für Ihre Gemeinschaft eingestellt ist/.test(liste),
			`Der Satz zur Lesart fehlt auf der Traktandenseite (Kriterium 4): ${liste.slice(0, 900)}`
		);

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		await stelleUm(gemeinschaft, 'einfach');
		return 'eingefroren «Qualifiziertes Mehr», Gemeinschaft wieder auf der Vorgabe';
	});

	await schritt('Im Saal: zwei kleine Ja, die grosse Nein (Kriterien 4, 5, 8)', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		const vorher = await seitentext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr»/.test(vorher),
			`Die eingefrorene Lesart steht nicht vor der Abstimmung (Kriterium 4): ${vorher.slice(0, 900)}`
		);

		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'yes'],
			['Christen', 'no']
		]) {
			await seite
				.locator('tr', { hasText: wer })
				.first()
				.locator(`input[type="radio"][value="${wahl}"]`)
				.first()
				.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Abgelehnt'), `Nach dem qualifizierten Mehr nicht abgelehnt: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Qualifiziertes Mehr»\), ist der Antrag abgelehnt\. Nach der anderen Lesart \(«Einfaches Mehr»: .*\) wäre er angenommen: 2 Ja von 3 Kopfstimmen, nötig 2\./.test(kasten),
			`Das Ergebnis nach der anderen Lesart fehlt: ${kasten.slice(0, 1200)}`
		);
		return 'abgelehnt; nach dem einfachen Mehr angenommen';
	});

	await schritt('Das Protokoll nennt Lesart und abweichendes Ergebnis (Kriterium 6)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes('Gezählt nach dem qualifizierten Mehr. Ob ein Beschluss, der die Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regelt, das qualifizierte Mehr braucht, ist umstritten.'),
			`Die Lesart fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Einfaches Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen: 2 Ja von 3 Kopfstimmen, nötig 2\./.test(entwurf),
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
