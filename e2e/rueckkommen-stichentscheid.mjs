/**
 * Rückkommen mit offenem Stichentscheid (`docs/freigabe.md`, «Offen:
 * Rückkommen, Reste vom 30.09.2026», Punkte 1 und 3; Codeprüfung H1).
 *
 * **Der Fall:** Vier Eigentümer, das Reglement lässt bei Gleichstand die
 * Wertquoten entscheiden. Der Antrag wird angenommen, die Versammlung kommt
 * darauf zurück, und im neuen Durchgang zählt die Leitung von Hand 2 zu 2. Die
 * Wertquoten sind dabei nicht erhoben, der Stichentscheid bleibt offen.
 *
 * **Was das Drehbuch misst.** Der frühere Beschluss bleibt in Kraft; Wand und
 * Leitung sagen, dass der Stichentscheid nicht festgestellt ist; und der Knopf
 * «Neuabstimmung» hängt am offenen Durchgang, nicht am geltenden. Vor der
 * Behebung überholte er den geltenden Beschluss (Codeprüfung H1). Danach trägt
 * das Rückkommen den nächsten Durchgang.
 *
 * Aufruf: `node e2e/rueckkommen-stichentscheid.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-rueckkommen-stichentscheid';

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

/**
 * Ein Formular abschicken und auf die Wirkung warten.
 *
 * **Genau wie in den übrigen Drehbüchern** (`e2e/ausstand.mjs`). Der erste
 * Anlauf hier rief `nachAbsendung(seite)` mit einem statt vier Argumenten und
 * startete den Wächter **vor** dem Klick: Er wartete auf nichts, sah keine
 * Antwort, und eine Absage über `fail(400)` — die unter `use:enhance` als
 * HTTP 200 zurückkommt — wäre unbemerkt geblieben. Sichtbar wurde es daran,
 * dass jeder Schritt danach neu laden musste, um etwas zu sehen.
 */
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

/**
 * Eine Seite laden.
 *
 * `nachladeWarter` gehört **nicht** hierher: Er wartet auf ein
 * `__data.json`-GET, das eine Vollnavigation gar nicht auslöst — das kostete
 * je Aufruf zwanzig Sekunden Leerlauf und den Lauf rund zehn Minuten.
 */
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
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nRückkommen mit offenem Stichentscheid — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	const NAME = `Prüflauf Rückkommen Stichentscheid ${LAUF}`;
	const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss'];

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

	await schritt('Gemeinschaft mit Stichentscheid nach Wertquoten', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();

		/*
		 * **Die Klausel bleibt wählbar und lesbar** (Produktentscheid
		 * 27.09.2026): Die Anwendung wendet sie nicht mehr an, aber eine
		 * Gemeinschaft, deren Reglement sie führt, trägt sie weiter ein. Der
		 * Weg unten prüft, dass sie nichts mehr bewirkt.
		 */
		const wahl = seite.locator('input[name="tieBreak"][value="wertquote"]');
		behaupte(await wahl.count(), 'Das Formular bietet den Stichentscheid nach Wertquoten nicht an');
		await wahl.check();
		await seite.waitForTimeout(150);

		// Die Fundstelle erscheint erst, wenn eine Regel gewählt ist — und sie ist
		// der Beleg, der im Saal genannt wird.
		const fundstelle = seite.locator('input[name="tieBreakRuleSource"]');
		behaupte(
			await fundstelle.count(),
			'Nach der Wahl fehlt das Feld für die Fundstelle im Reglement'
		);
		await fundstelle.fill('Art. 7 Ziff. 5 Reglement');

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
		return 'vier zu je einem Viertel';
	});

	await schritt('Versammlung, Traktandum, freigeben, eröffnen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-06-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill('Neue Veloständer');
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Vor dem Haus werden zwei Veloständer aufgestellt.');
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

	await schritt('Alle vier anwesend, das richtige Traktandum aufgerufen', async () => {
		// «Von Hand erfassen» in der Liste, mit Rückfrage — die Zahl ändert sich
		// mit jeder Bestätigung, deshalb jedes Mal neu laden.
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		behaupte(
			/4 von 4|4 Parteien/.test(await seitentext()),
			`Nicht alle anwesend: ${(await seitentext()).slice(0, 250)}`
		);

		/*
		 * **Das richtige Traktandum**, nicht das erste: Die Pflichttraktanden
		 * stehen davor, und die Begrüssung ist eine Kenntnisnahme — über sie wird
		 * gar nicht abgestimmt. Der erste Anlauf dieses Drehbuchs griff den
		 * ersten Aufrufen-Knopf der Seite und stand danach vor einem Traktandum
		 * ohne Abstimmung; die Meldung «Kein Öffnen» zeigte damit meinen eigenen
		 * Fehlgriff an, nicht die Anwendung.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Veloständer');
		await abschicken(aufrufen);

		/*
		 * **Neu laden, bevor gemessen wird.** Die Seite aktualisiert über
		 * `use:enhance`, also ohne Navigation; der erste Anlauf las den Zustand
		 * von vorher und meldete «kein Traktandum aufgerufen», während der Aufruf
		 * längst durch war.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const jetzt = await seite.locator('li.jetzt, .jetzt').first().innerText();
		behaupte(
			/Neue Veloständer/.test(jetzt.replace(/\s+/g, ' ')),
			`Aufgerufen ist etwas anderes: ${jetzt.replace(/\s+/g, ' ').slice(0, 150)}`
		);
		return 'vier anwesend, Veloständer aufgerufen';
	});


	await schritt('Angenommen, 3 zu 1', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await oeffneErfassung();
		for (const [wer, wahl] of [['Aebi', 'yes'], ['Bucher', 'yes'], ['Christen', 'yes'], ['Duss', 'no']]) {
			await seite.locator('tr', { hasText: wer }).first().locator(`input[type="radio"][value="${wahl}"]`).first().check();
		}
		await oeffneErfassung();
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const marke = (await seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first().locator('.marke').first().innerText()).trim();
		behaupte(marke === 'angenommen', `Die Marke ist «${marke}»`);
		return 'angenommen';
	});

	await schritt('Rückkommen beantragen und annehmen', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first();
		const oben = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		const bereich = (await oben.count()) ? seite.locator('.eingriffe') : zeile;
		await ((await oben.count()) ? oben.first() : zeile.locator('details.rueckkommen summary')).click();
		await seite.waitForTimeout(150);
		await abschicken(bereich.locator('form[action="?/rueckkommen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const antrag = seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last();
		await abschicken(antrag.locator('form[action="?/aufrufen"] button').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await oeffneErfassung();
		for (const wer of LEUTE) {
			await seite.locator('tr', { hasText: wer }).first().locator('input[type="radio"][value="yes"]').first().check();
		}
		await oeffneErfassung();
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		return 'Rückkommen angenommen';
	});

	await schritt('Neuer Durchgang, von Hand 2 zu 2 — der Stichentscheid bleibt offen', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]');
		if (await aufrufen.count()) await abschicken(aufrufen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const auf = seite.locator('summary', { hasText: 'nur die Summen' }).first();
		behaupte(await auf.count(), 'Kein Weg zur Summenerfassung');
		await auf.click();
		const summen = seite.locator('form[action="?/summen"]');
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('2');
		await summen.locator('input[name="enthaltung"]').fill('0');
		const vermerk = summen.locator('input[name="vermerk"]');
		if (await vermerk.count()) await vermerk.fill('Handzeichen, Durchstich');
		await abschicken(summen.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		return '2 zu 2 von Hand';
	});

	await schritt('Der frühere Beschluss gilt, die Leitung sagt es, der Knopf hängt am offenen Durchgang', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const marke = (await seite.locator('.baum li', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first().locator('.marke').first().innerText()).trim();
		behaupte(marke === 'angenommen', `Nach dem offenen Stichentscheid ist die Marke «${marke}» statt «angenommen»`);
		const ergebnis = seite.locator('article.ergebnis', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first();
		const text = (await ergebnis.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Im 2\. Durchgang nach dem Rückkommen ist der Stichentscheid nicht festgestellt\. Es bleibt beim Beschluss aus dem 1\. Durchgang, bis eine Neuabstimmung entscheidet\./.test(text),
			`Der Satz zum offenen Stichentscheid fehlt: ${text.slice(0, 400)}`
		);
		// Genau ein Neuabstimmungs-Formular, und es zielt nicht auf den geltenden.
		const formulare = ergebnis.locator('form[action="?/neuabstimmung"]');
		behaupte((await formulare.count()) === 1, `Es gibt ${await formulare.count()} Neuabstimmungs-Formulare`);
		const ziel = await formulare.first().locator('input[name="durchgang"]').getAttribute('value');
		const geltend = await ergebnis.locator('form[action="?/beschlusstext"] input[name="durchgang"]').first().getAttribute('value');
		behaupte(ziel && geltend && ziel !== geltend, `Der Knopf zielt auf den geltenden Durchgang (${ziel})`);
		return 'angenommen, Knopf am offenen Durchgang';
	});

	await schritt('Die Wand sagt dasselbe', async () => {
		await gehe(`/versammlungen/${versammlung}/praesentation`);
		const text = await seite.locator('body').innerText();
		behaupte(
			/Stichentscheid nicht festgestellt/.test(text.replace(/\s+/g, ' ')),
			`Die Wand nennt den offenen Stichentscheid nicht: ${text.replace(/\s+/g, ' ').slice(0, 300)}`
		);
		return 'Satz an der Wand';
	});

	await schritt('Neuabstimmung: der frühere bleibt, das Rückkommen trägt den nächsten Durchgang', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const ergebnis = seite.locator('article.ergebnis', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first();
		await ergebnis.locator('details.neu summary').first().click();
		await ergebnis.locator('form[action="?/neuabstimmung"] textarea[name="begruendung"]').fill('Durchstich: einzeln erfassen');
		await abschicken(ergebnis.locator('form[action="?/neuabstimmung"] button[type="submit"]'));
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const marke = (await seite.locator('.baum li', { hasText: 'Neue Veloständer' }).filter({ hasNotText: 'Rückkommen auf' }).first().locator('.marke').first().innerText()).trim();
		behaupte(marke === 'angenommen', `Nach der Neuabstimmung ist die Marke «${marke}»`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Der nächste Durchgang lässt sich nicht öffnen: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(oeffnen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		behaupte(/3\. Durchgang|Durchgang 3/.test(await seitentext()), 'Kein dritter Durchgang offen');
		return 'dritter Durchgang offen';
	});
} catch {
	/* der Schritt hat den Fehler schon gemeldet */
} finally {
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.`);
process.exit(fehler.length ? 1 : 0);
