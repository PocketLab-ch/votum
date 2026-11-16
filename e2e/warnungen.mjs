/**
 * Warnungen vor der Abstimmung und Fristvermerk im Protokoll (Block 3 der
 * Freigabeliste, 17.10.2026: Ä-11, Ä-17, Ä-20).
 *
 * **Der Fall:** Vier Eigentümer (200, 200, 300, 300). Die erste Versammlung
 * bleibt leer und wird vertagt; die zweite setzt die Leitung auf fünf Tage
 * danach, zu früh. Darauf eine wichtigere Verwaltungshandlung (Wertquoten aller)
 * und ein Zirkulationsbeschluss. Am Abend sind nur die beiden mit 200 da:
 * beschlussfähig nach Art. 712p Abs. 3, aber 400 von nötigen 501 Wertquoten.
 *
 * **Was das Drehbuch prüft.** Die Traktandenliste zeigt in der Vorbereitung
 * den Satz zur zweiten Versammlung und den zum Zirkulationsbeschluss; die
 * Leitung zeigt vor dem Eröffnen, dass die Mehrheit nicht erreichbar ist, und
 * beim Zirkulationsbeschluss dessen Satz; das Protokoll nennt im Fristvermerk
 * die Ausnahme der Universalversammlung statt des unbedingten Satzes.
 *
 * Wortlaut und Rechnung prüfen `tests/domain/mehrhinweise.test.ts`,
 * `tests/domain/auszaehlung.test.ts` und `tests/domain/protokoll.test.ts`;
 * hier läuft die Kette in der Oberfläche. Ä-15 (Einstimmigkeit aus dem
 * Reglement) nimmt denselben Weg wie Ä-20 (`mehrhinweise` auf beiden
 * Leitungsseiten) und ist dort am Kern belegt.
 *
 * Aufruf: `node e2e/warnungen.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-warnungen';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

let nr = 0;
// Ä-17 (Produktentscheide 0011, 0012); Wortlaut in `domain/beschlussfaehigkeit.ts`
// und `domain/mehrhinweise.ts`, hier nur der Anfang.
const EINZIG = /Alle Stockwerkanteile gehören einer Person/;
const NEU_AN_ZWEITER = /Dieses Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung/;
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

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nWarnungen vor der Abstimmung — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let erste;
	let zweite;
	const NAME = `Prüflauf Warnungen ${LAUF}`;
	const LEUTE = [
		['Aebi', '200'],
		['Bucher', '200'],
		['Custer', '300'],
		['Dubach', '300']
	];

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

	await schritt('Gemeinschaft mit vier Eigentümern', async () => {
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
			await ef.locator('input[name="quote.stamm"]').fill(quote);
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
		return '200, 200, 300, 300';
	});

	await schritt('Erste Versammlung: eröffnet, niemand da, vertagt', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-10-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		erste = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(erste && erste !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${erste}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());
		await gehe(`/versammlungen/${erste}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());

		// Das Vertagen steht beim Traktandum zur Beschlussfähigkeit, zugeklappt.
		await gehe(`/versammlungen/${erste}/leitung`);
		const fest = seite.locator('.baum li', { hasText: 'Feststellung der Beschlussfähigkeit' }).first();
		await abschicken(fest.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${erste}/leitung`);
		await seite.evaluate(() => {
			document.querySelectorAll('details:has(form[action="?/vertagen"])').forEach((d) => (d.open = true));
		});
		const form = seite.locator('form[action="?/vertagen"]').first();
		behaupte(await form.count(), 'Kein Formular zum Vertagen');
		await form.locator('select[name="grund"]').selectOption({ index: 1 });
		await abschicken(form.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${erste}`);
		behaupte(/geschlossen/.test(await seitentext()), 'Die erste Versammlung ist nicht vertagt');

		// Die anstehende Versammlung der eigenen Gemeinschaft ist die eben angelegte
		// zweite; die Liste aller Versammlungen wächst mit jedem Lauf.
		await gehe(`/gemeinschaften/${gemeinschaft}`);
		const ziel = await seite
			.locator('a', { hasText: 'Zur Vorbereitung' })
			.first()
			.getAttribute('href')
			.catch(() => null);
		zweite = ziel?.split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(zweite, 'Die zweite Versammlung steht nicht in der Liste');
		return zweite.slice(0, 8);
	});

	await schritt('Zweite Versammlung zu früh: fünf Tage nach der ersten', async () => {
		await gehe(`/versammlungen/${zweite}`);
		const form = seite.locator('form#angaben');
		await form.locator('input[name="datum"]').fill('2027-10-15');
		await abschicken(seite.locator('button[form="angaben"]').first());
		await gehe(`/versammlungen/${zweite}`);
		const text = await seitentext();
		behaupte(/zu früh angesetzt/.test(text), `Kein Fristvermerk: ${text.slice(0, 300)}`);
		return 'Vermerk steht';
	});

	await schritt('Traktandenliste: Sätze zur zweiten Versammlung und zum Zirkulationsbeschluss', async () => {
		for (const [titel, knoten, wortlaut] of [
			['Neue Veloständer', 'k-verwaltung-wichtig', 'Die Veloständer werden ersetzt.'],
			['Zirkular', 'k-zirkularbeschluss', 'Der Hauswart wird gewählt.']
		]) {
			await gehe(`/versammlungen/${zweite}/traktanden`);
			await seite.locator('.neu button.haupt').click();
			await seite.waitForTimeout(250);
			const tf = seite.locator('form[action="?/anlegen"]').first();
			await tf.locator('input[name="titel"]').fill(titel);
			await tf.locator('input[name="art"][value="abstimmung"]').check();
			await seite.waitForTimeout(200);
			await tf
				.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
				.first()
				.fill(wortlaut);
			await tf.locator('select[name="erfordernis"]').selectOption(knoten);
			await abschicken(tf.locator('button[type="submit"]').first());
		}
		// Die Sätze stehen in der Karte des Traktandums, die erst geöffnet rendert.
		const karte = async (titel) => {
			await gehe(`/versammlungen/${zweite}/traktanden`);
			await seite.locator('main button', { hasText: titel }).first().click();
			await seite.waitForTimeout(300);
			return seitentext();
		};
		const velo = await karte('Neue Veloständer');
		behaupte(
			/An einer zweiten Versammlung genügt für die Beschlussfähigkeit ein Drittel/.test(velo),
			`Der Satz zur zweiten Versammlung fehlt: ${velo.slice(0, 400)}`
		);
		behaupte(/Rz\. 191 ad Art\. 712m/.test(velo), 'Die Fundstelle Rz. 191 fehlt');
		const zirk = await karte('Zirkular');
		behaupte(
			/Ein Zirkulationsbeschluss entsteht nicht durch eine Abstimmung/.test(zirk),
			'Der Satz zum Zirkulationsbeschluss fehlt'
		);
		// Ä-17 B: Beide sind an der zweiten neu angelegt; die Jahresrechnung kam
		// als Pflichttraktandum auch an der ersten vor (Gegenprobe).
		behaupte(NEU_AN_ZWEITER.test(velo), `Der Satz zum neuen Traktandum fehlt: ${velo.slice(0, 400)}`);
		behaupte(/wenn es in der Einladung zur zweiten steht/.test(velo), 'Die Handlung fehlt im Satz');
		const jahr = await karte('Jahresrechnung');
		behaupte(!NEU_AN_ZWEITER.test(jahr), 'Der Satz steht auch am Pflichttraktandum');
		return 'beide Sätze, neues Traktandum gekennzeichnet';
	});

	await schritt('Freigeben, Vollmacht an eine Verwaltung ohne Eigentum, Ausstand vorab (Ä-26)', async () => {
		await gehe(`/versammlungen/${zweite}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(frei.first());

		// Dubach bevollmächtigt die Verwaltung, die nicht Eigentümerin ist.
		await gehe(`/versammlungen/${zweite}/vollmachten`);
		const vf = seite.locator('form[action="?/erfassen"]').first();
		await vf.locator('input[name="art"][value="dritte"]').check();
		await seite.waitForTimeout(150);
		await vf.locator('input[name="bevollmaechtigtName"]').fill('Prüfverwaltung AG');
		await vf.locator('label', { hasText: 'Dubach' }).locator('input[name="vertritt"]').first().check();
		await abschicken(vf.locator('button[type="submit"]').first());

		// Vorab: Die Verwaltung tritt bei «Neue Veloständer» in den Ausstand.
		await gehe(`/versammlungen/${zweite}/traktanden`);
		await seite.locator('main button', { hasText: 'Neue Veloständer' }).first().click();
		await seite.waitForTimeout(300);
		const af = seite.locator('form[action="?/ausstand"]').first();
		behaupte(await af.count(), 'Kein Formular für den Ausstand vorab');
		const wahl = af.locator('label', { hasText: 'Prüfverwaltung AG' }).locator('input[name="partei"]');
		behaupte(await wahl.count(), 'Die Verwaltung steht nicht zur Wahl');
		await wahl.first().check();
		await af.locator('input[name="grund"]').fill('Es geht um ihre eigene Entschädigung');
		await abschicken(af.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${zweite}/traktanden`);
		await seite.locator('main button', { hasText: 'Neue Veloständer' }).first().click();
		await seite.waitForTimeout(300);
		const text = await seitentext();
		behaupte(
			/«Prüfverwaltung AG» hält Vollmachten von «Dubach»/.test(text),
			`Die Warnung zur ruhenden Vollmacht fehlt: ${text.slice(0, 600)}`
		);
		return 'Ausstand vorab, Vollmacht ruht';
	});

	await schritt('Eröffnen, nur Aebi und Bucher anwesend', async () => {
		await gehe(`/versammlungen/${zweite}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());

		for (const wer of ['Aebi', 'Bucher']) {
			await gehe(`/versammlungen/${zweite}/anwesenheit`);
			const knopf = seite
				.locator('tr, li', { hasText: wer })
				.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])')
				.first();
			behaupte(await knopf.count(), `Kein Knopf für ${wer}`);
			await abschicken(knopf);
		}
		await gehe(`/versammlungen/${zweite}/anwesenheit`);
		const text = await seitentext();
		behaupte(/2 von 4|2 Parteien/.test(text), `Anwesenheit stimmt nicht: ${text.slice(0, 300)}`);
		return '2 von 4, 400 Wertquoten';
	});

	await schritt('Leitung: Mehrheit nicht erreichbar, mit Zahlen', async () => {
		await gehe(`/versammlungen/${zweite}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${zweite}/leitung`);
		const text = await seitentext();
		behaupte(
			/nötig sind 501 von 1000 Wertquoten, im Saal stimmberechtigt sind 400/.test(text),
			`Die Erreichbarkeit fehlt: ${text.slice(0, 600)}`
		);
		// Keine Sperre: Der Knopf zum Eröffnen bleibt.
		behaupte(
			await seite.locator('form[action="?/oeffnen"] button[type="submit"]').count(),
			'Der Knopf zum Eröffnen fehlt'
		);
		// Ä-17 B: vor dem Eröffnen, ohne Sperre.
		behaupte(NEU_AN_ZWEITER.test(text), 'Der Satz zum neuen Traktandum fehlt in der Leitung');
		// Ä-17 A, Gegenprobe: vier Eigentümer, kein Satz zur Einpersonengemeinschaft.
		behaupte(!EINZIG.test(text), 'Der Satz zur Einpersonengemeinschaft steht bei vier Eigentümern');
		return '400 von 501, neues Traktandum gekennzeichnet';
	});

	await schritt('Leitung: Satz zum Zirkulationsbeschluss', async () => {
		await gehe(`/versammlungen/${zweite}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Zirkular' }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${zweite}/leitung`);
		const text = await seitentext();
		behaupte(
			/Ein Zirkulationsbeschluss entsteht nicht durch eine Abstimmung/.test(text),
			`Der Satz fehlt: ${text.slice(0, 400)}`
		);
		// Im Saal ohne den Weg über ein milderes Mehr, und ohne zweite Warnung
		// daneben (Codeprüfung 17.10.2026, M1 und M2).
		behaupte(/In Votum lässt sich ein milderes Mehr/.test(text), 'Die Fassung für den Saal fehlt');
		behaupte(!/Mit den Anwesenden und Vertretenen ist diese Mehrheit/.test(text), 'Zweite Warnung daneben');
		return 'Satz für den Saal';
	});

	await schritt('Protokoll: Fristvermerk mit der Ausnahme der Universalversammlung', async () => {
		await gehe(`/versammlungen/${zweite}/leitung`);
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);

		await gehe(`/versammlungen/${zweite}/protokoll`);
		const erzeugen = seite.locator('button', { hasText: 'Entwurf erzeugen' }).first();
		behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen des Entwurfs');
		await abschicken(erzeugen);
		await gehe(`/versammlungen/${zweite}/protokoll`);
		const feld = seite.locator('textarea[name="body"]').first();
		behaupte(await feld.count(), 'Kein Textfeld mit dem Protokollentwurf');
		const entwurf = (await feld.inputValue()).replace(/\s+/g, ' ');
		behaupte(/Frist nicht eingehalten/.test(entwurf), 'Die Zeile zur Frist fehlt');
		behaupte(
			/ausser es handelt sich um eine Universalversammlung/.test(entwurf),
			`Die Ausnahme fehlt: ${entwurf.slice(0, 900)}`
		);
		behaupte(
			/diese Gemeinschaft zählt nur persönlich Anwesende/.test(entwurf),
			'Die Einstellung der Gemeinschaft fehlt'
		);
		behaupte(
			!/darf keine Beschlüsse fassen\. Werden trotzdem/.test(entwurf),
			'Der unbedingte Satz steht noch im Protokoll'
		);
		// Ä-26: der Ausstand der Verwaltung, die nicht Eigentümerin ist.
		behaupte(
			/Prüfverwaltung AG, nicht Eigentümer, ist bei diesem Traktandum als Vertreter in den Ausstand getreten; Vollmachten dieses Vertreters ruhten hier, soweit es welche gab/.test(entwurf),
			'Der Ausstand der Verwaltung fehlt im Protokoll'
		);
		return 'im Entwurf';
	});
	await schritt('Ä-17 A: Alle Anteile bei einer Person, Leitung und Protokoll nennen die Lehrmeinung', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', `${NAME} allein`);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		const allein = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(allein, `Nicht angelegt: ${seite.url()}`);
		await gehe(`/gemeinschaften/${allein}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill('Erfunden Allein');
		await abschicken(pf.locator('button[type="submit"]'));
		for (const [i, quote] of ['600', '400'].entries()) {
			await gehe(`/gemeinschaften/${allein}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill(quote);
			await abschicken(ef.locator('button[type="submit"]'));
			await gehe(`/gemeinschaften/${allein}/eigentuemer`);
			const zf = seite.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), 'Erfunden Allein');
			await abschicken(zf.locator('button[type="submit"]'));
		}

		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${allein}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		const v = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(v && v !== 'neu', `Nicht angelegt: ${seite.url()}`);
		await gehe(`/versammlungen/${v}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		await gehe(`/versammlungen/${v}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${v}/anwesenheit`);
		await abschicken(
			seite
				.locator('tr, li', { hasText: 'Erfunden Allein' })
				.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])')
				.first()
		);

		// Vor dem Festhalten: unter der Anzeige der Beschlussfähigkeit.
		await gehe(`/versammlungen/${v}/leitung`);
		const fest = seite.locator('.baum li', { hasText: 'Feststellung der Beschlussfähigkeit' }).first();
		await abschicken(fest.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${v}/leitung`);
		const vorher = await seitentext();
		behaupte(EINZIG.test(vorher), `Der Satz fehlt vor dem Festhalten: ${vorher.slice(0, 500)}`);
		// Vor dem Festhalten ohne Randziffer; die steht im Protokoll (Fachprüfung, Runde 2).
		behaupte(/Nach einer Lehrmeinung/.test(vorher), 'Die Lehrmeinung fehlt vor dem Festhalten');

		// Festhalten, dann im Protokoll bei der Feststellung.
		const halten = seite.locator('form[action="?/festhalten"] button[type="submit"]').first();
		behaupte(await halten.count(), 'Kein Knopf zum Festhalten');
		await abschicken(halten);
		await gehe(`/versammlungen/${v}/leitung`);
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);
		await gehe(`/versammlungen/${v}/protokoll`);
		await abschicken(seite.locator('button', { hasText: 'Entwurf erzeugen' }).first());
		await gehe(`/versammlungen/${v}/protokoll`);
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			/Die Versammlung ist beschlussfähig\. Alle Stockwerkanteile gehören einer Person/.test(entwurf),
			`Der Satz fehlt im Protokoll: ${entwurf.slice(0, 900)}`
		);
		behaupte(/SVIT-Kommentar, Rz\. 12 ad Art\. 712p/.test(entwurf), 'Die Fundstelle mit Werk fehlt im Protokoll');
		return 'Leitung und Protokoll';
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
