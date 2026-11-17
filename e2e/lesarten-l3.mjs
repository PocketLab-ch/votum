/**
 * Durchstich: Lesart L3, Einsprache je Eigentümer in einer Gemeinschaft je
 * Einheit (Migration 172, Fassung 2026-10-28, Entscheide 0018 und 0022).
 *
 * **Der Fall.** Die Gemeinschaft zählt nach dem Reglement je Einheit. Aebi
 * verkauft Whg 1 und stimmt nicht mit; Bucher und Christen haben je eine
 * Wohnung, Duss drei. Bucher und Christen sagen Ja, Duss Nein. Nach der Vorgabe
 * je Eigentümer steht es 2 zu 1, angenommen; je Einheit 2 zu 3, abgelehnt.
 *
 * **Was das Drehbuch prüft.** Traktandenliste und Leitung nennen die
 * Zählweise vor der Abstimmung (Kriterium 7); die Erfassung zeigt Duss mit
 * einer Stimme (Codeprüfung M-b). Gezählt wird von Hand: ohne zweite Zählung
 * sagt die Leitung ab und nennt Duss mit drei Stimmen (Kriterium 5), mit beiden
 * Dreizahlen ist der Antrag angenommen, und die Leitung nennt nach dem
 * Schliessen das Ergebnis je Einheit mit Zahlen (Kriterium 4). Das Protokoll
 * nennt die Zählweise und das abweichende Ergebnis (Kriterium 7).
 *
 * Rechnung und Wortlaut am Kern: `tests/domain/einsprache-zaehlweise-2026-10-28.test.ts`,
 * Datenhaltung: `tests/db/lesart-einsprache.test.ts`.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l3.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l3';

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

console.log(`\nLesart L3, Einsprache je Eigentümer — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	let traktandum;
	const NAME = `Prüflauf Lesart L3 ${LAUF}`;

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

	await schritt('Gemeinschaft je Einheit, Duss mit drei Wohnungen', async () => {
		await gehe('/gemeinschaften/neu');
		// A5, Punkt 12a: die Grenze am Versprechen zum Stichentscheid.
		behaupte(
			// 16.11.2026: dazu das einfache Mehr nach Wertquoten allein (Regel «Köpfe zählen nicht»).
			(await seite.content()).replace(/\s+/g, ' ').includes('Votum wendet die Klausel nur beim einfachen Mehr an, nach Köpfen ohne Wertquoten'),
			'Die Grenze des Stichentscheids fehlt im Formular'
		);
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.check('input[name="headCountMode"][value="per_unit"]');
		await seite.fill('input[name="headCountRuleSource"]', 'Art. 28 Abs. 1 Reglement');
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

		// Whg 1 bis 3 je 200 für Aebi, Bucher, Christen; Whg 4 bis 6 für Duss.
		const einheiten = [
			[0, '200'],
			[1, '200'],
			[2, '200'],
			[3, '100'],
			[3, '150'],
			[3, '150']
		];
		for (const wer of LEUTE) {
			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const pf = seite.locator('form[action$="anlegen"]').first();
			await pf.locator('input[name="displayName"]').fill(wer);
			await abschicken(pf.locator('button[type="submit"]'));
		}
		for (const [i, [person, quote]] of einheiten.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill(quote);
			await abschicken(ef.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const zf = seite.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), LEUTE[person]);
			await abschicken(zf.locator('button[type="submit"]'));
		}
		return '4 Eigentümer, 6 Einheiten, Zählweise je Einheit';
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
		behaupte(
			/Bei der Einsprache hat nach der Einstellung Ihrer Gemeinschaft jeder Eigentümer eine Stimme, auch wer mehrere Einheiten hat \(Standardeinstellung: So kommt die Einsprache nicht leichter zustande als nach Gesetz\)/.test(
				await seitentext()
			),
			`Die Zählweise steht nicht vor der Abstimmung (Kriterium 7): ${(await seitentext()).slice(0, 900)}`
		);
		const betroffen = (await hinweis.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/^Unmittelbar betroffen: Aebi\b/.test(betroffen),
			`Als betroffen steht jemand anderes: ${betroffen}`
		);
		return 'aufgerufen, Aebi betroffen';
	});

	await schritt('Abstimmung öffnen, Duss mit einer Stimme in der Erfassung', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 400)}`);
		await abschicken(oeffnen.first());

		await oeffneErfassung();
		const erfassung = seite.locator('form[action="?/erfassen"]');
		behaupte(await erfassung.count(), 'Keine Erfassungstabelle');
		const duss = (await erfassung.locator('tr', { hasText: 'Duss' }).first().innerText()).replace(/\s+/g, ' ');
		behaupte(/\b1 K\b/.test(duss), `Duss steht nicht mit einer Stimme in der Erfassung: ${duss}`);
		// A5, Punkt 9: je Zählung; Duss zählt nur je Einheit anders.
		const hinweise = (await seite.content()).replace(/\s+/g, ' ');
		behaupte(
			/Bei der Zählung je Einheit zählen diese Anwesenden nicht einfach einmal: [^<]*Duss[^<]*mit 3 Stimmen/.test(hinweise),
			'Die Zählhilfe je Einheit nennt Duss nicht'
		);
		behaupte(
			!/Bei der Zählung je Eigentümer zählen diese Anwesenden[^<]*Duss/.test(hinweise),
			'Die Zählhilfe je Eigentümer nennt Duss, obwohl er dort einmal zählt'
		);
		return 'Duss: 1 K';
	});

	await schritt('Von Hand gezählt: ohne zweite Zählung sagt die Leitung ab (Kriterium 5)', async () => {
		const summen = seite.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			const auf = seite.locator('summary', { hasText: 'nur die Summen' }).first();
			behaupte(await auf.count(), 'Kein Weg zur Summenerfassung');
			await auf.click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}
		const text = (await summen.innerText()).replace(/\s+/g, ' ');
		behaupte(/Bei der Einsprache zweimal zählen/.test(text), `Die Anleitung zum zweimal Zählen fehlt: ${text.slice(0, 600)}`);
		behaupte(/Duss \S+ mit 3 Stimmen/.test(text), `Die Zählhilfe nennt Duss nicht mit 3 Stimmen: ${text.slice(0, 600)}`);

		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('1');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await abschicken(summen.locator('button[type="submit"]').first());
		const absage = await seitentext();
		behaupte(
			/Tragen Sie auch die Zählung je Einheit ein\./.test(absage),
			`Keine Absage ohne zweite Zählung: ${absage.slice(0, 900)}`
		);
		return 'abgesagt, Duss mit 3 Stimmen genannt';
	});

	await schritt('Mit beiden Dreizahlen: angenommen, je Einheit abgelehnt (Kriterium 4)', async () => {
		const summen = seite.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			await seite.locator('summary', { hasText: 'nur die Summen' }).first().click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('1');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await summen.locator('input[name="andere_ja"]').fill('2');
		await summen.locator('input[name="andere_nein"]').fill('3');
		await summen.locator('input[name="andere_enthaltung"]').fill('0');
		await abschicken(summen.locator('button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: 'Einsprache gegen den Verkauf' }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Angenommen'), `Nach der Vorgabe nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Eine Stimme je Eigentümer»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Eine Stimme je Einheit»: .*\) wäre er abgelehnt: 2 Ja von 5 Kopfstimmen, nötig 3\./.test(kasten),
			`Das Ergebnis je Einheit fehlt: ${kasten.slice(0, 1400)}`
		);
		behaupte(/innert 14 Tagen seit der ersten Mitteilung des Vertrags/.test(kasten), 'Der Satz zur Frist fehlt');
		return 'angenommen 2 zu 1; je Einheit abgelehnt 2 zu 3';
	});

	await schritt('Das Protokoll nennt Zählweise und abweichendes Ergebnis (Kriterium 7)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes('Gezählt nach dem Gesetz: eine Stimme je Eigentümer, auch wer mehrere Einheiten hat.'),
			`Die Zählweise fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Eine Stimme je Einheit»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 2 Ja von 5 Kopfstimmen, nötig 3\./.test(entwurf),
			`Die Feststellung am Ausgang fehlt: ${entwurf.slice(0, 1500)}`
		);
		// A5, Punkt 2: Anfechtung einmal, mit dem eigenen Weg der Einsprache.
		behaupte(
			(entwurf.match(/## Anfechtung/g) ?? []).length === 1 && entwurf.includes('Für die Einsprache selbst läuft eine eigene, kürzere Frist.'),
			`Der Abschnitt zur Anfechtung fehlt: ${entwurf.slice(0, 1500)}`
		);
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		behaupte(
			(await seite.content()).replace(/\s+/g, ' ').includes('Eine Einstellhalle im Begründungsakt'),
			'Die Hilfe zur Einstellhalle fehlt in der Einheitenmaske'
		);
		return 'Zählweise, Feststellung, Anfechtung, Einstellhalle';
	});

	// ── Die andere Wahl: L3 «je Einheit», das zweite Ergebnis umgekehrt (A6) ────

	/*
	 * **Das zweite Ergebnis auch nach der anderen Wahl** (A6). Der Lauf prüfte es
	 * nur nach der Vorgabe «je Eigentümer». Hier stellt die Gemeinschaft L3 auf
	 * «je Einheit» um, stimmt ein zweites Traktandum ab, und das zweite Ergebnis
	 * lautet umgekehrt: abgelehnt nach «je Einheit», angenommen nach «je Eigentümer».
	 */
	const ZWEITER_TITEL = 'Einsprache gegen den Verkauf von Whg 1';
	let zweiteVersammlung;
	let zweitesTraktandum;

	await schritt('L3 auf «je Einheit» umstellen', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		await seite.locator('input[name="L3"][value="je_einheit"]').check();
		await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
		behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
		return 'je Einheit';
	});

	await schritt('Zweite Versammlung und zweite Einsprache anlegen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-21');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		zweiteVersammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(zweiteVersammlung && zweiteVersammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${zweiteVersammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill(ZWEITER_TITEL);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Gemeinschaft erhebt Einsprache gegen den Verkauf von Whg 1.');
		await abschicken(tf.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${zweiteVersammlung}/traktanden`);
		zweitesTraktandum = await seite
			.locator('li[data-traktandum]', { hasText: ZWEITER_TITEL })
			.first()
			.getAttribute('data-traktandum');
		behaupte(zweitesTraktandum, 'Traktandum nicht angelegt');

		// Erfordernis über denselben Weg wie beim ersten: Ast «Sonderfälle», f8-1.
		await gehe(`/versammlungen/${zweiteVersammlung}/traktanden/${zweitesTraktandum}/erfordernis`);
		await seite.locator('a[href*="ast=a-sonderfaelle"]').first().click();
		await seite.waitForURL(/ast=a-sonderfaelle/, { timeout: 30000 });
		await seite.waitForLoadState('domcontentloaded');
		await seite.locator('a[href*="p=f8-1-einsprache"]').first().click();
		await seite.waitForURL(/p=f8-1-einsprache/, { timeout: 30000 });
		await seite.waitForLoadState('domcontentloaded');
		await abschicken(seite.locator('form[action="?/uebernehmen"] button[type="submit"]').first());
		return zweiteVersammlung.slice(0, 8);
	});

	await schritt('Aebi als Betroffene, freigeben, eröffnen, alle anwesend', async () => {
		await gehe(`/versammlungen/${zweiteVersammlung}/traktanden`);
		const zeile = seite.locator('li[data-traktandum]', { hasText: ZWEITER_TITEL }).first();
		await zeile.locator('button.titel').click();
		const form = seite.locator('form[action="?/speichern"]').first();
		await form.waitFor({ timeout: 10000 });
		const kaestchen = form
			.locator('label', { hasText: BETROFFENE })
			.locator('input[name="betroffene"]');
		behaupte(await kaestchen.count(), `Kein Kästchen für ${BETROFFENE}`);
		await kaestchen.first().check();
		await abschicken(form.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${zweiteVersammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Die Freigabe bleibt gesperrt: ${(await seitentext()).slice(0, 500)}`);
		await abschicken(frei.first());

		await gehe(`/versammlungen/${zweiteVersammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${zweiteVersammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		return 'freigegeben, eröffnet, 4 von 4';
	});

	await schritt('Abstimmung öffnen und von Hand zählen', async () => {
		await gehe(`/versammlungen/${zweiteVersammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: ZWEITER_TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		// Wie im ersten Durchgang: nach dem Aufrufen neu laden, dann öffnen.
		await gehe(`/versammlungen/${zweiteVersammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();

		const summen = seite.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			await seite.locator('summary', { hasText: 'nur die Summen' }).first().click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}
		// Je Einheit (angewandt): 2 Ja, 3 Nein; je Eigentümer (andere): 2 Ja, 1 Nein.
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('3');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await summen.locator('input[name="andere_ja"]').fill('2');
		await summen.locator('input[name="andere_nein"]').fill('1');
		await summen.locator('input[name="andere_enthaltung"]').fill('0');
		await abschicken(summen.locator('button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${zweiteVersammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: ZWEITER_TITEL }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Abgelehnt'), `Nach «je Einheit» nicht abgelehnt: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Eine Stimme je Einheit»\), ist der Antrag abgelehnt\. Nach der anderen Lesart \(«Eine Stimme je Eigentümer»: .*\) wäre er angenommen: 2 Ja von 3 Kopfstimmen, nötig 2\./.test(
				kasten
			),
			`Das zweite Ergebnis nach der anderen Wahl fehlt: ${kasten.slice(0, 1400)}`
		);
		return 'abgelehnt je Einheit; je Eigentümer angenommen';
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
