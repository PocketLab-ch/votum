/**
 * Durchstich: Lesarten der Gemeinschaft mit L4 (Migration 169, Entscheid 0018).
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern, zwei kleinen und einer
 * grossen Wohnung. Die Wahl der Bewirtschaftung mit erweiterten Kompetenzen
 * geht über die Frage nach den Kompetenzen im Entscheidbaum der aktuellen
 * Fassung ans Traktandum, zuerst nach der Vorgabe, seit Entscheid 0048
 * (Block B) dem qualifizierten Mehr. Dann
 * stellt die Verwaltung auf das einfache Mehr um; die Freigabeseite nennt das
 * Hindernis und bietet keinen Knopf, bis das Traktandum nachgezogen ist. Nach
 * der Freigabe stellt sie zurück, und die Versammlung rechnet trotzdem nach der
 * eingefrorenen Wahl. Im Saal stimmen die zwei kleinen Ja, die grosse Nein:
 * nach dem einfachen Mehr angenommen, nach dem qualifizierten abgelehnt.
 * Leitung und Protokoll nennen das.
 *
 * Kriterien aus dem Konzept, Abschnitt 5: 1 (Vorgabe gekennzeichnet), 2
 * (zuletzt geändert), 3 (eingefroren), 4 (Satz auf der Karte), 5 (Leitung mit
 * Zahlen), 6 (Protokoll), 10 (L4).
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»). Aufruf wie die übrigen Drehbücher:
 *
 *     node e2e/lesarten.mjs
 *
 * Der Bestand bleibt stehen; die Namen beginnen mit «Prüflauf», das
 * gewöhnliche Aufräumen (`scripts/testdaten-entfernen.sql`) nimmt sie mit.
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Wahl der Bewirtschaftung';
const LEUTE = [
	['Aebi', 200],
	['Bucher', 200],
	['Christen', 600]
].map(([n, q]) => [`${n} ${LAUF}`, q]);

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

/** Was auf der Seite steht, samt der Quittung unten rechts (wie `einsprache.mjs`). */
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

/**
 * Was am Traktandum steht, mit aufgeklappter Zeile: Die Hinweise zum Mehr, auch
 * der Satz zur Lesart, stehen erst darin (wie `enthaltung-einfaches-mehr.mjs`).
 */
async function traktandumtext() {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('[data-traktandum]', { hasText: TITEL }).first();
	await zeile.locator('button.titel').click();
	await seite.waitForTimeout(400);
	return ((await zeile.textContent()) ?? '').replace(/\s+/g, ' ');
}

/** Auf der Seite der Lesarten L4 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L4"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesarten der Gemeinschaft, L4: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	let traktandum;
	const NAME = `Prüflauf Lesarten ${LAUF}`;

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

		for (const [i, [wer, quote]] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill(String(quote));
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
		return '200, 200 und 600 von 1000';
	});

	await schritt('Die Seite der Lesarten kennzeichnet die Vorgabe (Kriterium 1)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(/Lesarten, die das Gesetz offenlässt/.test(text), `Abschnitt fehlt: ${text.slice(0, 400)}`);
		// **An jeder Lesart, nicht nur an L4** (A6). Jede Lesart steht in ihrem
		// `fieldset`; gezählt wird die Kennzeichnung je fieldset, nicht als
		// Gesamtzahl der Seite, sonst deckte eine doppelte Kennzeichnung in
		// einem fieldset ein fehlendes in einem anderen.
		const fieldsets = seite.locator('form[action="?/lesarten"] fieldset');
		// Dreizehn seit L13 (Migration 192).
		behaupte((await fieldsets.count()) === 13, `Nicht dreizehn Lesarten-Felder: ${await fieldsets.count()}`);
		for (let i = 0; i < 13; i++) {
			const feld = (await fieldsets.nth(i).innerText()).replace(/\s+/g, ' ');
			behaupte(/\(Vorgabe\)/.test(feld), `Lesart ${i + 1} ohne Vorgabe: ${feld.slice(0, 200)}`);
		}
		behaupte(/Vorgabe, nie geändert\./.test(text), 'Der Stand «nie geändert» fehlt');
		behaupte(
			await seite.locator('input[name="L4"][value="qualifiziert"]').isChecked(),
			'Die Vorgabe ist nicht angekreuzt'
		);
		return 'qualifiziertes Mehr, Vorgabe, nie geändert';
	});

	await schritt('Versammlung und Traktandum, Erfordernis über die Frage nach den Kompetenzen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-24');
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
			.fill('Die Probe AG wird als Bewirtschaftung gewählt.');
		await abschicken(tf.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		traktandum = await seite
			.locator('li[data-traktandum]', { hasText: TITEL })
			.first()
			.getAttribute('data-traktandum');
		behaupte(traktandum, 'Traktandum nicht angelegt');

		await gehe(`/versammlungen/${versammlung}/traktanden/${traktandum}/erfordernis`);
		await seite.locator('a[href*="ast=a-organe"]').first().click();
		await seite.waitForURL(/ast=a-organe/, { timeout: 30000 });
		await seite.locator('a[href*="p=f2-1-waehlen"]').first().click();
		await seite.waitForURL(/p=f2-1-waehlen/, { timeout: 30000 });
		const frage = await seitentext();
		behaupte(
			/Kompetenzen über die gewöhnliche Verwaltung hinaus\?/.test(frage),
			`Die Frage nach den Kompetenzen fehlt: ${frage.slice(0, 500)}`
		);
		await seite.locator('a[href*="f2-1-kompetenzen-ja"]').first().click();
		await seite.waitForURL(/f2-1-kompetenzen-ja/, { timeout: 30000 });
		// Unter der Vorgabe trägt die Karte seit Fassung 2026-11-13 keinen Satz zur Seite «Lesarten»
		// (`REST` in `quorum-2026-11-13.ts`, seit 2026-11-17 `WAHL_HINWEIS` in `quorum-2026-11-17.ts`);
		// der steht erst unter der Wahl «einfach» (`REST_EINFACH`).
		// Der Satz zur Lesart folgt auf der Traktandenseite, unten.
		const karte = (await seite.locator('article.karte').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Der SVIT-Kommentar lässt auch bei erweiterten Befugnissen das einfache Mehr genügen und nennt die Frage selbst umstritten/.test(karte) &&
				/Diese Karte folgt dem Wortlaut von Art\. 647b Abs\. 1 ZGB, der die Wahl einer solchen Bewirtschaftung ausdrücklich nennt, und verlangt das qualifizierte Mehr/.test(karte) &&
				!/so rechnet dieses Werkzeug/.test(karte) &&
				!/In den Einstellungen Ihrer Gemeinschaft \(Seite «Lesarten»\) ist gewählt/.test(karte),
			`Die Karte nennt die Vorgabe «qualifiziert» nicht oder trägt den Satz zur Wahl «einfach»: ${karte.slice(0, 600)}`
		);
		await abschicken(seite.locator('form[action="?/uebernehmen"] button[type="submit"]').first());

		const liste = await traktandumtext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr» \(Standardeinstellung: Nach dem Wortlaut von Art\. 647b Abs\. 1 ZGB braucht/.test(liste),
			`Der Satz zur Lesart fehlt auf der Traktandenseite (Kriterium 4): ${liste.slice(0, 800)}`
		);
		return 'Ja, mit erweiterten Kompetenzen; qualifiziertes Mehr nach der Vorgabe';
	});

	await schritt('Umstellen: Verlauf, Hindernis vor der Freigabe, Nachziehen (Kriterien 2 und 3)', async () => {
		await stelleUm(gemeinschaft, 'einfach');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');

		// Seit Lesarten Block 2 (Rest aus Block 1) nennt die Freigabeseite das
		// Hindernis vor dem Klick und bietet den Knopf nicht an.
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		behaupte(
			/Ziehen Sie das Mehr auf der Seite «Lesarten» der Gemeinschaft nach/.test(await seitentext()),
			`Die Freigabeseite nennt das Hindernis nicht: ${(await seitentext()).slice(0, 500)}`
		);
		behaupte(
			!(await seite.locator('form[action$="freigeben"] button[type="submit"]').count()),
			'Der Freigabeknopf steht trotz veralteter Lesart da'
		);

		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const kasten = await seitentext();
		behaupte(/Lesart: Einfaches Mehr/.test(kasten), `Der Kasten nennt die Lesart nicht: ${kasten.slice(0, 800)}`);
		await abschicken(seite.locator('form[action="?/nachziehen"] button').first());
		behaupte(/neu hergeleitet/.test(await seitentext()), 'Keine Quittung nach dem Nachziehen');
		return 'umgestellt, Hindernis vor dem Klick, nachgezogen';
	});

	await schritt('Freigeben, dann zurückstellen: die Versammlung bleibt beim Eingefrorenen (Kriterium 3)', async () => {
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		await stelleUm(gemeinschaft, 'qualifiziert');
		const liste = await traktandumtext();
		behaupte(
			/rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist/.test(liste),
			`Die Versammlung rechnet nicht mehr nach der eingefrorenen Wahl: ${liste.slice(0, 800)}`
		);
		return 'einfaches Mehr bleibt';
	});

	await schritt('Im Saal: zwei kleine Ja, die grosse Nein (Kriterien 5 und 10)', async () => {
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
		behaupte(
			/rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist/.test(await seitentext()),
			`Die Leitung nennt die Lesart vor der Abstimmung nicht (Kriterium 4): ${(await seitentext()).slice(0, 800)}`
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
		// Neu laden, wie `enthaltung-einfaches-mehr.mjs`: Das Ergebnis steht danach sicher da.
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Angenommen'), `Nach dem einfachen Mehr nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Einfaches Mehr»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Qualifiziertes Mehr»: .*\) wäre er abgelehnt: 2 Ja von 3 Kopfstimmen, nötig 2; 400 Ja von 1000 Wertquoten, nötig 501\./.test(kasten),
			`Das Ergebnis nach der anderen Lesart fehlt: ${kasten.slice(0, 900)}`
		);
		behaupte(/Wer nicht zugestimmt hat, kann den Beschluss beim Gericht anfechten/.test(kasten), 'Der Rat zur Anfechtung fehlt');
		return 'angenommen; nach dem qualifizierten Mehr abgelehnt';
	});

	await schritt('Das Protokoll nennt Lesart und abweichendes Ergebnis (Kriterium 6)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes(
				'Gezählt nach dem einfachen Mehr. Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. Die Standardeinstellung wäre das qualifizierte Mehr: Nach dem Wortlaut von Art. 647b Abs. 1 ZGB braucht die Wahl einer Verwaltung mit mehr als gewöhnlichen Befugnissen das qualifizierte Mehr. Der SVIT-Kommentar und ein Teil der Lehre lassen das einfache genügen, weil im Stockwerkeigentum die Regeln zur Verwaltung vorgingen. Ein Entscheid des Bundesgerichts zu dieser Frage ist uns nicht bekannt.'
			),
			`Die Zeile zur Lesart fehlt: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 2 Ja von 3 Kopfstimmen/.test(entwurf),
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
