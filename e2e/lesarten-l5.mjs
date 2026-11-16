/**
 * Durchstich: Lesart L5, neue Traktanden an der zweiten Versammlung
 * (Migration 174, Konzept Lesarten Block 7, Entscheide 0012 und 0018).
 *
 * **Der Fall.** Sechs Eigentümer. Die erste Versammlung bleibt leer und wird
 * vertagt; die «Fassadensanierung» geht mit. An der zweiten kommt die «Neue
 * Heizung» dazu. Zwei sind da: Das Drittel ist erreicht, die Hälfte einer
 * ersten nicht.
 *
 * **Was das Drehbuch prüft.** Die Einstellungsseite zeigt L5 mit der Vorgabe
 * (Kriterium 6); die Traktandenseite nennt die Einstellung an der neuen
 * Heizung (Kriterium 7). In der Leitung steht vor dem Eröffnen, dass
 * verbindlich nicht abgestimmt wird, und das Eröffnen sagt ab (Kriterium 1).
 * Mit einer dritten Eigentümerin ist die Beschlussfähigkeit einer ersten
 * erreicht: Der Satz verschwindet, die Abstimmung öffnet. Das Protokoll nennt
 * die Einstellung (Kriterium 7). Die Einladung kommt als PDF (Zeichen und
 * Fussnote prüft `tests/db/pdf.test.ts` am gerenderten Text).
 *
 * Sperre, Notweg, konsultativ und Einfrieren am echten Weg:
 * `tests/db/lesart-neue-traktanden.test.ts`.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l5.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l5';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

// Mit Zeitstempel, damit `scripts/testdaten-entfernen.sql` sie findet (Pendenzen 20.10.2026).
const LEUTE = [
	['Aebi', '200'],
	['Bucher', '200'],
	['Christen', '150'],
	['Duss', '150'],
	['Egli', '150'],
	['Frei', '150']
].map(([n, q]) => [`${n} ${LAUF}`, q]);
const ALT = 'Fassadensanierung';
const NEU = 'Neue Heizung';

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

/** Was auf der Seite steht, samt der Quittung unten rechts (wie `e2e/lesarten-l3.mjs`). */
async function seitentext() {
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
}

async function traktandumAnlegen(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill(titel);
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf
		.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
		.first()
		.fill(`${titel} wird beschlossen.`);
	await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
	await abschicken(tf.locator('button[type="submit"]').first());
}

async function freigebenUndEroeffnen(versammlung) {
	await gehe(`/versammlungen/${versammlung}/freigabe`);
	const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
	behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 400)}`);
	await abschicken(frei.first());
	await gehe(`/versammlungen/${versammlung}`);
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
}

/** Die nächste noch nicht bestätigte Partei als anwesend bestätigen. */
async function eineMehrAnwesend(versammlung) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
	behaupte(await knopf.count(), 'Niemand mehr zu bestätigen');
	await abschicken(knopf.first());
}

async function aufrufen(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = seite.locator('.baum li', { hasText: titel }).first();
	behaupte(await zeile.count(), `«${titel}» fehlt im Baum: ${(await seitentext()).slice(0, 400)}`);
	// Schon aufgerufen, gibt es den Knopf nicht mehr; dann nur neu laden.
	const knopf = zeile.locator('form[action="?/aufrufen"] button[type="submit"]');
	if (await knopf.count()) await abschicken(knopf.first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L5, neue Traktanden an der zweiten Versammlung — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let erste;
	let zweite;
	const NAME = `Prüflauf Lesart L5 ${LAUF}`;

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

	await schritt('Gemeinschaft mit sechs Eigentümern', async () => {
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
		return '200, 200, 150, 150, 150, 150';
	});

	await schritt('Einstellungsseite: L5 mit der Vorgabe (Kriterium 6)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(
			/Darf eine zweite Versammlung über ein Geschäft entscheiden, das an der ersten nicht auf der Liste stand/.test(text),
			`Die Frage zu L5 fehlt: ${text.slice(0, 600)}`
		);
		behaupte(
			await seite.locator('input[name="L5"][value="erste"]').isChecked(),
			'Die Vorgabe «erste» ist nicht gewählt'
		);
		return 'Vorgabe gewählt';
	});

	await schritt('Erste Versammlung mit der Fassadensanierung, niemand da, vertagt', async () => {
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
		await traktandumAnlegen(erste, ALT);
		await freigebenUndEroeffnen(erste);

		await aufrufen(erste, 'Feststellung der Beschlussfähigkeit');
		await seite.evaluate(() => {
			document.querySelectorAll('details:has(form[action="?/vertagen"])').forEach((d) => (d.open = true));
		});
		const form = seite.locator('form[action="?/vertagen"]').first();
		behaupte(await form.count(), 'Kein Formular zum Vertagen');
		await form.locator('select[name="grund"]').selectOption({ index: 1 });
		await abschicken(form.locator('button[type="submit"]').first());

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

	await schritt('Zweite Versammlung: neue Heizung, die Traktandenseite nennt die Einstellung (Kriterium 7)', async () => {
		await traktandumAnlegen(zweite, NEU);
		await gehe(`/versammlungen/${zweite}/traktanden`);
		await seite.locator('main button', { hasText: NEU }).first().click();
		await seite.waitForTimeout(300);
		const text = await seitentext();
		behaupte(
			/Ihre Gemeinschaft lässt darüber zudem nur verbindlich abstimmen, wenn so viele anwesend oder vertreten sind wie an einer ersten Versammlung/.test(text),
			`Der Satz zu L5 fehlt an der neuen Heizung: ${text.slice(0, 900)}`
		);
		// Kriterium 4 auch nach der Vorgabe (Featureprüfung Lesarten, 22.10.2026).
		behaupte(
			/Nach der anderen Lesart \(«Ein Drittel genügt»\) würde für dieses Traktandum/.test(text),
			`Die andere Lesart fehlt an der neuen Heizung: ${text.slice(0, 900)}`
		);
		return 'Satz steht, mit der anderen Lesart';
	});

	await schritt('Die Einladung kommt als PDF', async () => {
		const antwort = await seite.request.get(`${ZIEL}/versammlungen/${zweite}/einladung.pdf`);
		behaupte(antwort.ok(), `Einladung nicht erzeugt: ${antwort.status()}`);
		const kopf = new TextDecoder().decode((await antwort.body()).slice(0, 5));
		behaupte(kopf === '%PDF-', `Kein PDF: ${kopf}`);
		return 'PDF';
	});

	await schritt('Freigeben, eröffnen, zwei da', async () => {
		await freigebenUndEroeffnen(zweite);
		await eineMehrAnwesend(zweite);
		await eineMehrAnwesend(zweite);
		await gehe(`/versammlungen/${zweite}/anwesenheit`);
		const text = await seitentext();
		behaupte(/2 von 6 Parteien anwesend/.test(text), `Nicht zwei von sechs: ${text.slice(0, 400)}`);
		return '2 von 6';
	});

	await schritt('Leitung: Vor dem Eröffnen der Satz, das Eröffnen sagt ab (Kriterium 1)', async () => {
		await aufrufen(zweite, NEU);
		const vorher = await seitentext();
		behaupte(
			/und das ist sie jetzt nicht\. Kommen noch Eigentümer dazu/.test(vorher),
			`Der Satz vor dem Eröffnen fehlt: ${vorher.slice(0, 900)}`
		);
		behaupte(
			/eine Umstellung wirkt erst für die nächste Versammlung\. Nach der anderen Lesart/.test(vorher),
			`Die andere Lesart fehlt in der Leitung: ${vorher.slice(0, 900)}`
		);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), 'Kein Knopf zum Öffnen');
		await abschicken(oeffnen.first());
		const nachher = await seitentext();
		behaupte(
			/Nach der Einstellung Ihrer Gemeinschaft wird darüber nur verbindlich abgestimmt, wenn die Versammlung beschlussfähig ist wie eine erste/.test(nachher),
			`Keine Absage nach L5: ${nachher.slice(0, 900)}`
		);
		behaupte(
			!(await seite.locator('form[action="?/schliessen"]').count()),
			'Die Abstimmung ist trotz Sperre offen'
		);
		return 'abgesagt';
	});

	/*
	 * **Die unverbindliche Abstimmung über die Oberfläche** (A6). Die Sperre
	 * verhindert nur die verbindliche Abstimmung; das Häkchen «konsultativ» steht
	 * und lässt eine unverbindliche zu. Bisher prüfte das nur
	 * `tests/db/ae17-verdrahtung.test.ts` am Loader, nicht der Durchstich.
	 */
	await schritt('Die unverbindliche Abstimmung über die Oberfläche (konsultativ)', async () => {
		await aufrufen(zweite, NEU);
		const haekchen = seite.locator('form[action="?/oeffnen"] input[name="konsultativ"][value="ja"]');
		behaupte(await haekchen.count(), 'Das Häkchen «konsultativ» fehlt');
		await haekchen.check();
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		behaupte(
			/Konsultative Abstimmung/.test(await seitentext()),
			`Die konsultative Abstimmung ist nicht offen: ${(await seitentext()).slice(0, 900)}`
		);

		const summen = seite.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			await seite.locator('summary', { hasText: 'nur die Summen' }).first().click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('0');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await abschicken(summen.locator('button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${zweite}/leitung`);
		// An der Karte des Traktandums, nicht seitenweit: «Kein
		// Beschluss» und «konsultativ» stehen am Ausgang der neuen Heizung; ein
		// anderes Traktandum oder eine Überschrift dürfte sie nicht stumm mitliefern.
		const karte = seite.locator('article.ergebnis', { hasText: NEU }).first();
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Kein Beschluss/.test(kasten) && /konsultativ/.test(kasten),
			`Der konsultative Ausgang fehlt an der Karte: ${kasten.slice(0, 900)}`
		);
		return 'konsultativ abgestimmt, kein Beschluss';
	});

	await schritt('Mit der dritten Eigentümerin öffnet die Abstimmung', async () => {
		await eineMehrAnwesend(zweite);
		await aufrufen(zweite, NEU);
		const text = await seitentext();
		behaupte(
			!/und das ist sie jetzt nicht\. Kommen noch Eigentümer dazu/.test(text),
			'Der Satz steht noch, obwohl die Beschlussfähigkeit einer ersten erreicht ist'
		);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		const summen = seite.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			await seite.locator('summary', { hasText: 'nur die Summen' }).first().click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}
		await summen.locator('input[name="ja"]').fill('3');
		await summen.locator('input[name="nein"]').fill('0');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await abschicken(summen.locator('button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${zweite}/leitung`);
		const karte = seite.locator('article.ergebnis', { hasText: NEU }).first();
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(satz.startsWith('Angenommen'), `Nicht angenommen: ${satz.slice(0, 300)}`);
		return 'angenommen, 3 zu 0';
	});

	await schritt('Das Protokoll nennt die Einstellung (Kriterium 7)', async () => {
		await gehe(`/versammlungen/${zweite}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes(
				'Das Traktandum stand in der Einladung zur ersten Versammlung nicht zur Abstimmung. Nach der Einstellung der Gemeinschaft wird darüber nur abgestimmt, wenn die Versammlung beschlussfähig ist wie eine erste; das war sie.'
			),
			`Die Zeile zu L5 fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		return 'Zeile steht';
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
