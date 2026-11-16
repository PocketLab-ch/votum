/**
 * Durchstich: Rückkommen auf einen Beschluss unter Lesart L6,
 * Reglementsschranke (Migration 181, Fassung 2026-11-05, Entscheid 0018;
 * README «Lesarten der Gemeinschaft», «Das Rückkommen übernimmt das Mehr,
 * nicht die Lesart»).
 *
 * **Der Weg bis zum Beschluss** wie in `e2e/lesarten-l6.mjs`: sechs
 * Eigentümer zu 200, 180, 170, 160, 150 und 140 von 1000. Die Verwaltung
 * stellt L6 auf «Nach dem Gesetz», das Traktandum zur Reglementsänderung unter
 * der eigenen Schranke bekommt sein Mehr danach, die Versammlung wird
 * freigegeben, und die Verwaltung stellt zurück auf «Klausel anwenden». Der
 * Eigentümer zu 140 fehlt, die fünf Anwesenden stimmen zu: nach dem Gesetz
 * angenommen (Köpfe 5 von 5 Anwesenden, Wertquoten 860 von 1000), nach der
 * Klausel abgelehnt (5 Ja von 6 Kopfstimmen, nötig 6).
 *
 * **Dann das Rückkommen**, gestellt, während die Gemeinschaft auf «Klausel
 * anwenden» steht. Es übernimmt das Mehr des Beschlusses
 * (`erfordernisFuerRueckkommen` in `domain/rueckkommen.ts`): das qualifizierte
 * Mehr nach dem Gesetz, also mehr als die Hälfte der Köpfe der Anwesenden und
 * Vertretenen und mehr als die Hälfte aller Wertquoten. Die Lesart trägt es
 * nur als `lesartDesBeschlusses` (L6, «gesetz», `mitAllen: false`, weil der
 * Beschluss nur fünf von sechs Ja hatte), ohne zweites Ergebnis.
 *
 * Abgestimmt wird 4 zu 1: Ja die Eigentümer zu 200, 180, 170 und 160, Nein der
 * zu 150, der zu 140 fehlt weiter.
 *
 *   - Mehr des Beschlusses: Köpfe 4 von 5 Anwesenden (mehr als 2,5), Wertquoten
 *     200 + 180 + 170 + 160 = 710 von 1000 (mehr als 500): **angenommen**.
 *   - Neu nach der Einstellung der Gemeinschaft hergeleitet («Klausel
 *     anwenden», Zustimmung aller): 4 von 6 Kopfstimmen, nötig 6: abgelehnt.
 *     Rechnete das Rückkommen neu nach der Lesart, wäre es abgelehnt; ein
 *     angenommenes Rückkommen zeigt also das Mehr des Beschlusses.
 *   - Ein zweites Ergebnis nach «Klausel anwenden» nennt Votum nicht (Fall a,
 *     `tests/domain/rueckkommen-l6-b2b.test.ts`: `andereLesart` bleibt leer).
 *
 * **Wortlaute** aus den Grundlagen, nicht von der Seite abgeschrieben:
 * Karte vor der Abstimmung aus `rueckkommenKartensatz` (Fall «gesetz»,
 * `mitAllen: false`; `tests/domain/rueckkommen-l6-b2b.test.ts`,
 * `tests/domain/pruefdatei-f4c-l6.test.ts`), Titel nach `RUECKKOMMEN_TITEL`
 * (`domain/entscheidbaum.ts`), Protokollzeile aus `lesartProtokollsatz` am
 * Rückkommen (`rueckkommen-l6-b2b.test.ts`, «mit einer Zeile im Protokoll in
 * beiden Wahlen»).
 *
 * **Gegen den Dev-Stapel**, aus dem Hauptverzeichnis oder einem Worktree auf
 * demselben Stand wie der Stapel:
 *
 *     PLAYWRIGHT_PFAD=<pfad>/node_modules/playwright node e2e/lesarten-l6-rueckkommen.mjs
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit. Unter `AUFNAHMEN` legt der Lauf je Messpunkt den gelesenen Text ab.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l6-rueckkommen';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Kostenschlüssel im Reglement neu nach Flächen';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss', 'Egli', 'Furrer'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['200', '180', '170', '160', '150', '140'];

/** `rueckkommenKartensatz` unter «Nach dem Gesetz», Beschluss ohne die Ja-Stimmen aller. */
const KARTE_RUECKKOMMEN =
	'Zum Mehr: Das Rückkommen braucht dasselbe Mehr wie der Beschluss und rechnet wie dieser nach der ' +
	'Lesart «Nach dem Gesetz», dem qualifizierten Mehr. Die Klausel im Titel steht in Ihrem Reglement; ob ' +
	'sie gilt, ist umstritten (Seite «Lesarten»). Ein Ergebnis nach «Klausel anwenden» nennt Votum hier ' +
	'nicht: Nach ihr wäre schon der Beschluss abgelehnt gewesen.';

/** `lesartProtokollsatz` am Rückkommen unter «Nach dem Gesetz». */
const PROTOKOLL_RUECKKOMMEN =
	'Gezählt wie beim Beschluss nach dem qualifizierten Mehr nach dem Gesetz, weil das Rückkommen ' +
	'dasselbe Mehr braucht. Ob eine Klausel gilt, nach der das Reglement nur mit der Zustimmung aller ' +
	'geändert werden kann, ist umstritten.';

/** `lesartProtokollsatz` am Beschluss, wie in `e2e/lesarten-l6.mjs`. */
const PROTOKOLL_BESCHLUSS =
	'Gezählt nach dem qualifizierten Mehr nach dem Gesetz. Ob eine Klausel gilt, nach der das Reglement ' +
	'nur mit der Zustimmung aller geändert werden kann, ist umstritten.';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

function sauber(text) {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function ablegen(name, text) {
	await writeFile(`${AUFNAHMEN}/${name}.txt`, `${text}\n`).catch(() => {});
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
	return sauber(`${haupt} ${quittungen}`);
}

/**
 * Stimmen in der Tabelle «von Hand erfassen» eintragen, mit dem Grund, der in
 * der geführten Versammlung Pflicht ist (sechs Parteien liegen über
 * `SCHWELLE_GEFUEHRT`; ohne ihn hält der Browser das Absenden still an,
 * `e2e/lesarten-l6.mjs`). Danach muss die Zahl der Abgegebenen stimmen.
 */
async function erfasse(stimmen) {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
	const form = seite.locator('form[action="?/erfassen"]').first();
	behaupte(await form.count(), `Keine Stimmerfassung: ${(await seitentext()).slice(0, 400)}`);
	await form.locator('input[name="begruendung"]').first().fill('Prüflauf: im Saal von Hand abgestimmt.');
	for (const [wer, wahl] of stimmen) {
		const radio = form.locator('tr', { hasText: wer }).first().locator(`input[type="radio"][value="${wahl}"]`).first();
		behaupte(await radio.count(), `In der Stimmerfassung fehlt die Zeile von ${wer}`);
		await radio.check();
	}
	await abschicken(form.locator('button[type="submit"]').first());
	const text = await seitentext();
	const n = stimmen.length;
	behaupte(
		new RegExp(`${n} von ${n} haben abgestimmt`).test(text),
		`Die Erfassung kam nicht an: ${text.match(/\d+ von \d+ haben abgestimmt/)?.[0] ?? text.slice(0, 600)}`
	);
}

/** Die Zeile des Beschlusses im Baum, ohne den Rückkommensantrag, der den Titel mitträgt. */
function beschlusszeile() {
	return seite.locator('.baum li', { hasText: TITEL }).filter({ hasNotText: 'Rückkommen auf' }).first();
}

function rueckkommenszeile() {
	return seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last();
}

async function standmarke(zeile) {
	// Die Standmarke rechts, nicht die Marke «Rückkommen» am Titel.
	const m = zeile.locator('.stand .marke').first();
	return (await m.count()) ? sauber(await m.innerText()) : '';
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

console.log(`\nLesart L6, Rückkommen auf den Beschluss: ${ZIEL}\n`);

let versammlung;
let gemeinschaft;

try {
	const NAME = `Prüflauf Lesart L6 Rückkommen ${LAUF}`;

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
		return `${gemeinschaft.slice(0, 8)}, 200 + 180 + 170 + 160 + 150 + 140 von 1000`;
	});

	await schritt('L6 auf «Nach dem Gesetz», Versammlung freigeben, Gemeinschaft zurück auf die Klausel', async () => {
		await stelleUm(gemeinschaft, 'gesetz');

		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-22');
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

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		await stelleUm(gemeinschaft, 'klausel');
		return `${versammlung.slice(0, 8)}, eingefroren «Nach dem Gesetz», Gemeinschaft auf «Klausel anwenden»`;
	});

	await schritt('Beschluss: fünf Ja, der Sechste fehlt; angenommen, nach der Klausel abgelehnt', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (const wer of LEUTE.slice(0, 5)) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			behaupte((await knopf.count()) > 0, `Keine Anwesenheit zu bestätigen für ${wer}`);
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(beschlusszeile().locator('form[action="?/aufrufen"] button[type="submit"]').first());
		const vorher = await seitentext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Nach dem Gesetz»/.test(vorher),
			`Die eingefrorene Lesart steht nicht vor der Abstimmung: ${vorher.slice(0, 900)}`
		);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await erfasse(LEUTE.slice(0, 5).map((wer) => [wer, 'yes']));
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).filter({ hasNotText: 'Rückkommen auf' }).first();
		const satz = sauber(await karte.locator('p.satz').innerText());
		behaupte(satz.startsWith('Angenommen'), `Nach dem Gesetz nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = sauber(await karte.innerText());
		await ablegen('beschluss-karte', kasten);
		behaupte(
			/Nach der anderen Lesart \(«Klausel anwenden»: .*\) wäre er abgelehnt: 5 Ja von 6 Kopfstimmen, nötig 6\./.test(kasten),
			`Das Ergebnis nach der anderen Lesart fehlt am Beschluss: ${kasten.slice(0, 1200)}`
		);
		return 'angenommen; nach der Klausel abgelehnt, 5 Ja von 6, nötig 6';
	});

	await schritt('Rückkommen gestellt, während die Gemeinschaft auf «Klausel anwenden» steht', async () => {
		// Erst festhalten, dass die Gemeinschaft wirklich auf der anderen Wahl steht
		// als die eingefrorene: Sonst bewiese das Mehr des Rückkommens nichts.
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L6"][value="klausel"]').isChecked(),
			'Die Gemeinschaft steht nicht auf «Klausel anwenden»'
		);

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oben = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		const zeile = beschlusszeile();
		const bereich = (await oben.count()) ? seite.locator('.eingriffe') : zeile;
		await ((await oben.count()) ? oben.first() : zeile.locator('details.rueckkommen summary')).click();
		await seite.waitForTimeout(150);
		const stellen = bereich.locator('form[action="?/rueckkommen"] button[type="submit"]').first();
		behaupte(await stellen.count(), `Kein Formular für das Rückkommen: ${(await seitentext()).slice(0, 600)}`);
		await abschicken(stellen);

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const antrag = rueckkommenszeile();
		behaupte(await antrag.count(), 'Der Rückkommensantrag steht nicht in der Liste');
		const titel = sauber(await antrag.innerText());
		behaupte(titel.includes(TITEL), `Der Rückkommensantrag nennt den Beschluss nicht: ${titel.slice(0, 300)}`);
		return titel.slice(0, 120);
	});

	await schritt('Vor der Abstimmung: Mehr des Beschlusses, Lesart des Beschlusses, kein zweites Ergebnis angekündigt', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const knopf = rueckkommenszeile().locator('form[action="?/aufrufen"] button[type="submit"]');
		if (await knopf.count()) await abschicken(knopf.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const jetzt = sauber(await seite.locator('li.jetzt, .jetzt').first().innerText());
		behaupte(/Rückkommen auf/.test(jetzt), `Aufgerufen ist nicht das Rückkommen: ${jetzt.slice(0, 200)}`);
		const text = await seitentext();
		await ablegen('rueckkommen-vor-abstimmung', text);

		// Das Mehr: übernommen vom Beschluss (`RUECKKOMMEN_TITEL`), nicht neu hergeleitet.
		behaupte(
			text.includes('Wie der Beschluss, der aufgehoben werden soll: '),
			`Das Rückkommen trägt nicht das Mehr des Beschlusses (Titel nach RUECKKOMMEN_TITEL fehlt): ${text.slice(0, 900)}`
		);
		// Der Satz der Leitung mit der Lesart des Beschlusses (`lesartDesBeschlusses`).
		behaupte(
			text.includes(KARTE_RUECKKOMMEN),
			`Der Satz zur Lesart des Beschlusses fehlt am Rückkommen: ${text.slice(0, 1500)}`
		);
		// Keine Lesart der Gemeinschaft am Rückkommen: weder die eingestellte
		// Klausel noch der Satz des Beschlusses mit Ankündigung des zweiten Ergebnisses.
		behaupte(
			!/Dieses Traktandum rechnet nach der Lesart/.test(text),
			`Am Rückkommen steht der Kartensatz einer Lesart der Gemeinschaft: ${text.slice(0, 1500)}`
		);
		behaupte(
			!text.includes('Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Lesart'),
			`Am Rückkommen ist ein zweites Ergebnis angekündigt: ${text.slice(0, 1500)}`
		);
		return 'Mehr und Lesart des Beschlusses, kein zweites Ergebnis angekündigt';
	});

	await schritt('Rückkommen 4 zu 1: nach dem Mehr des Beschlusses angenommen, ohne zweites Ergebnis', async () => {
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await erfasse([
			[LEUTE[0], 'yes'],
			[LEUTE[1], 'yes'],
			[LEUTE[2], 'yes'],
			[LEUTE[3], 'yes'],
			[LEUTE[4], 'no']
		]);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: 'Rückkommen auf' }).first();
		behaupte(await karte.count(), `Keine Ergebniskarte zum Rückkommen: ${(await seitentext()).slice(0, 900)}`);
		const kasten = sauber(await karte.innerText());
		await ablegen('rueckkommen-karte', kasten);
		const satz = sauber(await karte.locator('p.satz').first().innerText());
		// 4 von 5 Köpfen, 710 von 1000 Wertquoten: das qualifizierte Mehr ist
		// erreicht. Nach der Klausel (neu hergeleitet) wäre es abgelehnt.
		behaupte(
			satz.startsWith('Angenommen'),
			`Das Rückkommen ist nicht angenommen; rechnete es neu nach der Klausel? ${satz.slice(0, 400)}`
		);
		behaupte(
			satz.includes('4 Ja von 5 Kopfstimmen, nötig 3; 710 Ja von 1000 Wertquoten, nötig 501.'),
			`Die Zahlen des Rückkommens weichen von der Rechnung ab: ${satz.slice(0, 400)}`
		);
		behaupte(
			!/Nach der anderen Lesart/.test(kasten),
			`Am Rückkommen steht ein zweites Ergebnis: ${kasten.slice(0, 1500)}`
		);
		behaupte(
			!/Klausel anwenden».{0,80}(abgelehnt|angenommen|dasselbe Ergebnis)/.test(kasten),
			`Am Rückkommen steht ein Ergebnis nach «Klausel anwenden»: ${kasten.slice(0, 1500)}`
		);
		const marke = await standmarke(rueckkommenszeile());
		behaupte(marke === 'angenommen', `Die Marke des Rückkommens ist «${marke}»`);
		return `${satz.slice(0, 160)}`;
	});

	await schritt('Das Protokoll: Lesart des Beschlusses am Rückkommen, kein zweites Ergebnis dort', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const roh = await seite.locator('textarea[name="body"]').first().inputValue();
		await ablegen('protokoll-entwurf', roh);
		const entwurf = sauber(roh);

		// Den Abschnitt des Rückkommens vom Beschluss trennen: Er beginnt an der
		// Überschrift mit «Rückkommen auf» und reicht bis zur nächsten Überschrift.
		const zeilen = roh.split('\n');
		const anfang = zeilen.findIndex((z) => /^\s*(>\s*)?#{2,6} .*Rückkommen auf/.test(z));
		behaupte(anfang >= 0, `Kein Abschnitt zum Rückkommen im Protokoll: ${entwurf.slice(0, 1500)}`);
		let ende = zeilen.findIndex((z, i) => i > anfang && /^\s*(>\s*)?#{2,6} /.test(z));
		if (ende < 0) ende = zeilen.length;
		const abschnitt = sauber(zeilen.slice(anfang, ende).join('\n'));
		const vorRueckkommen = sauber(zeilen.slice(0, anfang).join('\n'));
		await ablegen('protokoll-rueckkommen', abschnitt);

		behaupte(
			abschnitt.includes(PROTOKOLL_RUECKKOMMEN),
			`Die Zeile zur Lesart des Beschlusses fehlt am Rückkommen: ${abschnitt.slice(0, 1500)}`
		);
		behaupte(
			!/Nach der anderen Lesart/.test(abschnitt),
			`Am Rückkommen steht im Protokoll ein zweites Ergebnis: ${abschnitt.slice(0, 1500)}`
		);
		behaupte(
			!abschnitt.includes('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet'),
			`Am Rückkommen steht die Herkunft der Lesart, die zum Beschluss gehört: ${abschnitt.slice(0, 1500)}`
		);
		// Der Beschluss selbst behält Lesart und Feststellung.
		behaupte(
			vorRueckkommen.includes(PROTOKOLL_BESCHLUSS),
			`Die Lesart des Beschlusses fehlt im Protokoll: ${vorRueckkommen.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Klausel anwenden»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 5 Ja von 6 Kopfstimmen, nötig 6\./.test(vorRueckkommen),
			`Die Feststellung am Ausgang des Beschlusses fehlt: ${vorRueckkommen.slice(0, 1500)}`
		);
		return 'Zeile am Rückkommen, Beschluss mit Lesart und Feststellung';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log(`\nGemeinschaft ${gemeinschaft ?? '?'}, Versammlung ${versammlung ?? '?'}`);
console.log(`${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
