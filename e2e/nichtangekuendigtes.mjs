/**
 * Ausnahmen bei nicht angekündigten Geschäften (Migrationen 126 bis 128).
 *
 * **Der Fall.** Über ein Geschäft, das nicht auf der versandten
 * Traktandenliste stand, wird nur beschlossen, wenn das Reglement es
 * ausdrücklich gestattet (ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2) oder die
 * Versammlung als Universalversammlung tagt. Bis zum
 * 29.09.2026 liess Votum das nie zu, «auch nicht, wenn die Versammlung
 * einverstanden ist»; das Gesetz enthält dieses Verbot nicht.
 *
 * Geprüft wird die ganze Kette, und jede Richtung einmal:
 *
 *   1. **Ohne Angabe** bietet der Aufnahmedialog bei einer neuen Sache keine
 *      Abstimmung an. Das ist die Gegenprobe: Schritt 5 ist nur grün, weil
 *      die Angabe gesetzt ist.
 *   2. **Eine im Saal gesetzte Angabe öffnet nichts.** Es gilt, was bei der
 *      Freigabe stand.
 *   3. **Mit Angabe vor der Freigabe** lässt sich das neue Geschäft zur
 *      Abstimmung aufnehmen, eröffnen, auszählen, und das Protokoll nennt die
 *      Fundstelle.
 *
 *   4. **Die Universalversammlung** (Migration 128), ohne Angabe des
 *      Reglements: Ist eine Partei nur mit Vollmacht da, gibt es unter der
 *      Vorgabe «persönlich» keine Abstimmung, und der Dialog nennt sie. Sind
 *      alle selbst da, öffnet die Abstimmung erst mit der Bestätigung der
 *      Leitung und wird angenommen. Geht jemand ohne Stimme oder widerspricht
 *      jemand, steht «kein Beschluss» mit Grund auf der Leitungsseite und im
 *      Protokoll.
 *
 * Aufruf: `node e2e/nichtangekuendigtes.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-nichtangekuendigtes';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

// Eine blosse Artikelangabe, wie der Platzhalter sie vorschlägt: Das Protokoll
// ergänzt «des Reglements», und zwar genau einmal.
const FUNDSTELLE = 'Art. 21 Abs. 3';

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
 * Ein Formular abschicken und auf die Wirkung warten, wie in `e2e/stichentscheid.mjs`.
 *
 * **`begruendung` für das Verlassen-Fenster** (Befund Praxisdurchlauf
 * 03.10.2026, Punkt 8). Der Verlassen-Knopf öffnet seit dem 04.10.2026 eine
 * Rückfrage mit Pflicht-Begründung; ihr Feld trägt bewusst kein `required`
 * (der Weg ohne JavaScript braucht das). `pruefe` hält das Fenster offen,
 * also füllt und bestätigt dieser Helfer selbst.
 */
async function abschicken(knopf, { begruendung = null } = {}) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click().then(async () => {
			if (begruendung === null) return;
			const fenster = knopf.locator('xpath=ancestor::form[1]').locator('dialog.rueckfrage[open]');
			await fenster.waitFor({ state: 'visible', timeout: 10000 });
			await fenster.locator('input[name="begruendung"]').fill(begruendung);
			await fenster.locator('button.ja').click({ timeout: 5000 });
		})
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

/** Versammlung anlegen, freigeben, eröffnen. Gibt die Kennung zurück. */
async function versammlungBereit(gemeinschaft, datum) {
	await gehe('/versammlungen/neu');
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', datum);
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
	behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

	await gehe(`/versammlungen/${versammlung}/freigabe`);
	const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
	behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
	await abschicken(frei.first());

	await gehe(`/versammlungen/${versammlung}`);
	const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
	behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
	await abschicken(auf.first());
	return versammlung;
}

/** Den Aufnahmedialog auf der Leitungsseite öffnen; gibt das Formular zurück. */
async function aufnahmedialog(versammlung) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const aufklappen = seite.locator('summary', { hasText: 'Eine weitere Sache aufnehmen' }).first();
	behaupte(await aufklappen.count(), 'Kein Weg, während der Sitzung ein Traktandum aufzunehmen');
	const formular = seite.locator('form[action="?/aufnehmen"]');
	if (!(await formular.locator('[name="spontanart"]').isVisible())) await aufklappen.click();
	await formular.locator('[name="spontanart"]').waitFor({ state: 'visible', timeout: 5000 });
	behaupte(
		(await formular.locator('[name="spontanart"]').inputValue()) === 'neu',
		'Voreingestellt ist nicht die neue Sache'
	);
	return formular;
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nNicht angekündigte Geschäfte — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let ohneAngabe;
	let mitAngabe;
	const NAME = `Prüflauf Nichtangekündigtes ${LAUF}`;
	const LEUTE = ['Aebi', 'Bucher'];

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

	await schritt('Gemeinschaft mit zwei Eigentümern, ohne Angabe', async () => {
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
			await ef.locator('input[name="quote.stamm"]').fill('500');
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

		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		behaupte(
			/Nichts hinterlegt: Votum lässt über ein Geschäft, das nicht auf der Traktandenliste/.test(
				await seitentext()
			),
			'Die Reglementsseite nennt die Vorgabe bei nicht angekündigten Geschäften nicht'
		);
		return 'zwei je zur Hälfte';
	});

	await schritt('Ohne Angabe: eine neue Sache nur zur Kenntnis', async () => {
		ohneAngabe = await versammlungBereit(gemeinschaft, '2027-06-10');
		const formular = await aufnahmedialog(ohneAngabe);
		behaupte(
			(await formular.locator('[name="art"]').count()) === 0,
			'Ohne Angabe wird für eine neue Sache eine Art zur Auswahl gestellt'
		);
		behaupte(
			/Eine solche Bestimmung des Reglements ist für diese Versammlung nicht hinterlegt/.test(
				await seitentext()
			),
			'Der Dialog sagt nicht, dass keine Bestimmung hinterlegt ist'
		);
		return 'keine Abstimmung angeboten';
	});

	await schritt('Die Angabe im Saal öffnet die laufende Versammlung nicht', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const f = seite.locator('form[action="?/nichtangekuendigtes"]');
		behaupte(await f.count(), 'Kein Formular für nicht angekündigte Geschäfte');
		await f.locator('input[name="reglementGestattet"]').check();
		await f.locator('input[name="reglementFundstelle"]').fill(FUNDSTELLE);
		await abschicken(f.locator('button[type="submit"]'));
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		behaupte(
			(await seitentext()).includes(`(${FUNDSTELLE})`),
			'Die gespeicherte Angabe steht nicht mit Fundstelle da'
		);

		/*
		 * **Eingefroren bei der Freigabe** (Migration 127). Die Eigentümer, die
		 * der Einladung vertraut haben, entschieden unter der alten Regel, ob sie
		 * kommen.
		 */
		const formular = await aufnahmedialog(ohneAngabe);
		behaupte(
			(await formular.locator('[name="art"]').count()) === 0,
			'Die im Saal gesetzte Angabe öffnet die laufende Versammlung'
		);
		return 'bleibt zu';
	});

	await schritt('Mit Angabe: Abstimmung angeboten, Kenntnisnahme vorgewählt', async () => {
		mitAngabe = await versammlungBereit(gemeinschaft, '2027-06-11');
		const formular = await aufnahmedialog(mitAngabe);
		const art = formular.locator('select[name="art"]');
		behaupte(await art.count(), 'Mit Angabe wird keine Abstimmung angeboten');
		behaupte(
			(await art.inputValue()) === 'kenntnisnahme',
			'Vorgewählt ist nicht die Kenntnisnahme'
		);
		await art.selectOption('abstimmung');
		await seite.waitForTimeout(200);
		behaupte(
			/Fachliteratur rät, davon nur zurückhaltend Gebrauch zu machen/.test(await seitentext()),
			'Die Empfehlung zur Zurückhaltung fehlt'
		);
		behaupte(
			(await seitentext()).includes(FUNDSTELLE),
			'Die Empfehlung nennt die Fundstelle nicht'
		);

		await formular.locator('[name="titel"]').fill('Anschaffung eines Defibrillators');
		await formular
			.locator('[name="antragswortlaut"]')
			.fill('Die Gemeinschaft schafft einen Defibrillator an.');
		await formular.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(formular.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		const zeile = seite.locator('ul.baum > li', { hasText: 'Anschaffung eines Defibrillators' }).last();
		await zeile.waitFor({ state: 'visible', timeout: 8000 });
		const gelesen = (await zeile.innerText()).replace(/\s+/g, ' ');
		behaupte(
			!/Kenntnisnahme/i.test(gelesen),
			`Die Sache steht als Kenntnisnahme da: ${gelesen.slice(0, 160)}`
		);
		return 'zur Abstimmung aufgenommen';
	});

	await schritt('Eröffnen, auszählen: angenommen', async () => {
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${mitAngabe}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}

		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Anschaffung eines Defibrillators' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen des Defibrillators');
		await abschicken(aufrufen);

		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(oeffnen.first());
		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		behaupte(
			!/war nicht angekündigt/.test(await seitentext()),
			'Das Eröffnen wurde als nicht angekündigt abgewiesen'
		);

		await seite.evaluate(() => {
			document
				.querySelectorAll('details:has(form[action="?/erfassen"])')
				.forEach((d) => (d.open = true));
		});
		for (const wer of LEUTE) {
			const z = seite.locator('tr', { hasText: wer }).first();
			const knopf = z.locator('input[type="radio"][value="yes"]').first();
			behaupte(await knopf.count(), `Keine Stimmwahl für ${wer}`);
			await knopf.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		const marke = (
			await seite
				.locator('.baum li', { hasText: 'Anschaffung eines Defibrillators' })
				.first()
				// Die Ergebnismarke, nicht «neu aufgenommen»: Die trägt `leise`.
				.locator('.marke:not(.leise)')
				.first()
				.innerText()
		).trim();
		behaupte(marke === 'angenommen', `Die Marke ist «${marke}» statt «angenommen»`);
		return marke;
	});

	await schritt('Das Protokoll nennt die Fundstelle des Reglements', async () => {
		await gehe(`/versammlungen/${mitAngabe}/leitung`);
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);

		await gehe(`/versammlungen/${mitAngabe}/protokoll`);
		const erzeugen = seite.locator('button', { hasText: 'Entwurf erzeugen' }).first();
		behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen des Entwurfs');
		await abschicken(erzeugen);
		await gehe(`/versammlungen/${mitAngabe}/protokoll`);
		const entwurf = await seite.locator('textarea[name="body"]').first().inputValue();
		behaupte(
			entwurf.includes(`Zur Abstimmung aufgenommen gestützt auf ${FUNDSTELLE} des Reglements, das`),
			`Der Vermerk fehlt im Protokollentwurf: ${entwurf.slice(0, 600)}`
		);
		return 'Vermerk steht';
	});

	// ── Die Universalversammlung (Migration 128) ─────────────────────────────

	let universal;
	const GESCHAEFTE = [
		'Neue Veloständer',
		'Neuer Anstrich im Treppenhaus',
		'Neue Briefkästen',
		'Neue Fussmatten',
		'Neue Kellertüren'
	];

	/** Wer im Moment nicht da ist, von Hand einlassen. */
	async function alleEinlassen(versammlung) {
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
	}

	/** Ein neues Geschäft als Universalversammlung aufnehmen und aufrufen. */
	async function universalAufrufen(versammlung, titel) {
		const formular = await aufnahmedialog(versammlung);
		const art = formular.locator('select[name="art"]');
		behaupte(await art.count(), `Keine Abstimmung angeboten: ${(await seitentext()).slice(0, 400)}`);
		behaupte(
			(await art.locator('option[value="abstimmung"]').innerText()).includes('Universalversammlung'),
			'Die Abstimmung heisst nicht «als Universalversammlung»'
		);
		await art.selectOption('abstimmung');
		await seite.waitForTimeout(200);
		behaupte(
			/Wer vorher geht, ohne abzustimmen, hebt die Universalversammlung auf/.test(await seitentext()),
			'Der Hinweis zum Weggehen fehlt im Aufnahmedialog'
		);
		await formular.locator('[name="titel"]').fill(titel);
		await formular.locator('[name="antragswortlaut"]').fill(`${titel} werden beschafft.`);
		await formular.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(formular.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: titel }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
	}

	/** Ein neues Geschäft als Universalversammlung aufnehmen, aufrufen und eröffnen. */
	async function universalEroeffnen(versammlung, titel, ersteOhneBestaetigung = false) {
		await universalAufrufen(versammlung, titel);
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"]:has(input[name="universalBestaetigt"])');
		behaupte(await oeffnen.count(), `Keine Bestätigung beim Öffnen: ${(await seitentext()).slice(0, 400)}`);
		if (ersteOhneBestaetigung) {
			await abschicken(oeffnen.locator('button[type="submit"]').first());
			behaupte(
				/Bestätigen Sie zuerst/.test(await seitentext()),
				`Ohne Bestätigung nicht abgewiesen: ${(await seitentext()).slice(0, 400)}`
			);
			behaupte(
				!/Lässt sich das nicht erreichen/.test(await seitentext()),
				'Bei blosser fehlender Bestätigung rät die Absage zum Aufgeben'
			);
			await gehe(`/versammlungen/${versammlung}/leitung`);
		}
		await oeffnen.locator('input[name="universalBestaetigt"]').check();
		await abschicken(oeffnen.locator('button[type="submit"]').first());
	}

	/** Stimmen erfassen, dann schliessen; gibt die Ergebnismarke zurück. */
	async function abstimmenUndSchliessen(versammlung, titel, wer) {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await seite.evaluate(() => {
			document
				.querySelectorAll('details:has(form[action="?/erfassen"])')
				.forEach((d) => (d.open = true));
		});
		for (const name of wer) {
			await seite.locator('tr', { hasText: name }).first().locator('input[type="radio"][value="yes"]').first().check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		return (
			await seite.locator('.baum li', { hasText: titel }).first().locator('.marke:not(.leise)').first().innerText()
		).trim();
	}

	await schritt('Ohne Angabe des Reglements, Vorgabe «persönlich»', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const f = seite.locator('form[action="?/nichtangekuendigtes"]');
		await f.locator('input[name="reglementGestattet"]').uncheck();
		await abschicken(f.locator('button[type="submit"]'));
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const u = seite.locator('form[action="?/universalversammlung"]');
		behaupte(await u.count(), 'Kein Formular für die Universalversammlung');
		behaupte(
			await u.locator('input[name="universalvariante"][value="persoenlich"]').isChecked(),
			'Vorgewählt ist nicht «persönlich»'
		);
		return 'Vorgabe steht';
	});

	await schritt('Nur mit Vollmacht da: keine Abstimmung, mit Grund', async () => {
		universal = await versammlungBereit(gemeinschaft, '2027-06-12');
		await gehe(`/versammlungen/${universal}/vollmachten`);
		const form = seite.locator('form[action="?/erfassen"]');
		await form.locator('input[name="art"][value="eigentuemer"]').check();
		await seite.waitForTimeout(150);
		await form.locator('select[name="bevollmaechtigt"]').selectOption({ label: 'Aebi' });
		await form.locator('ul.liste li', { hasText: 'Bucher' }).first().locator('input[name="vertritt"]').check();
		await abschicken(form.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${universal}/vollmachten`);
		const vorlegen = seite.locator('form[action="?/vorlegen"] button[type="submit"]');
		if (await vorlegen.count()) await abschicken(vorlegen.first());
		await gehe(`/versammlungen/${universal}/vollmachten`);
		await abschicken(
			seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])').first()
		);
		await alleEinlassen(universal);

		const formular = await aufnahmedialog(universal);
		behaupte(
			(await formular.locator('[name="art"]').count()) === 0,
			'Mit einer blossen Vollmacht wird eine Abstimmung angeboten'
		);
		behaupte(
			/Nur mit Vollmacht vertreten sind: Bucher/.test(await seitentext()),
			`Der Grund fehlt: ${(await seitentext()).slice(0, 500)}`
		);
		return 'Bucher nur mit Vollmacht';
	});

	await schritt('Alle selbst da: erst mit Bestätigung, dann angenommen', async () => {
		universal = await versammlungBereit(gemeinschaft, '2027-06-13');
		await alleEinlassen(universal);
		await universalEroeffnen(universal, GESCHAEFTE[0], true);
		await gehe(`/versammlungen/${universal}/leitung`);
		behaupte(
			/Widerspruch heisst: .*Wer nur gegen den Antrag ist, stimmt Nein/.test(await seitentext()),
			'Der Widerspruch ist nicht von der Nein-Stimme getrennt erklärt'
		);
		const marke = await abstimmenUndSchliessen(universal, GESCHAEFTE[0], LEUTE);
		behaupte(marke === 'angenommen', `Die Marke ist «${marke}» statt «angenommen»`);
		return marke;
	});

	await schritt('Ohne Stimme gegangen: kein Beschluss mit Grund', async () => {
		await universalEroeffnen(universal, GESCHAEFTE[1]);
		await gehe(`/versammlungen/${universal}/anwesenheit`);
		await abschicken(
			seite.locator('tr', { hasText: 'Bucher' }).first().locator('form[action="?/verlassen"] button[type="submit"]'),
			{ begruendung: 'Prüflauf: geht ohne Stimme.' }
		);
		const marke = await abstimmenUndSchliessen(universal, GESCHAEFTE[1], ['Aebi']);
		behaupte(marke === 'kein Beschluss', `Die Marke ist «${marke}» statt «kein Beschluss»`);
		behaupte(
			/Ohne Stimme gegangen: Bucher/.test(await seitentext()),
			'Die Leitungsseite nennt nicht, wer ohne Stimme gegangen ist'
		);
		await alleEinlassen(universal);
		return marke;
	});

	await schritt('Widerspruch nach dem Eröffnen: kein Beschluss', async () => {
		await universalEroeffnen(universal, GESCHAEFTE[2]);
		await gehe(`/versammlungen/${universal}/leitung`);
		const w = seite.locator('form[action="?/widerspruch"]');
		behaupte(await w.count(), 'Kein Formular für den Widerspruch');
		await waehleNachAnfang(w.locator('select[name="partei"]'), 'Bucher');
		await abschicken(w.locator('button[type="submit"]').first());
		const marke = await abstimmenUndSchliessen(universal, GESCHAEFTE[2], LEUTE);
		behaupte(marke === 'kein Beschluss', `Die Marke ist «${marke}» statt «kein Beschluss»`);
		behaupte(/Widersprochen hat: Bucher/.test(await seitentext()), 'Der Widerspruch steht nicht da');
		return marke;
	});

	await schritt('Nach einem Weggang neu eröffnet: angenommen', async () => {
		await universalEroeffnen(universal, GESCHAEFTE[3]);
		await gehe(`/versammlungen/${universal}/anwesenheit`);
		await abschicken(
			seite.locator('tr', { hasText: 'Bucher' }).first().locator('form[action="?/verlassen"] button[type="submit"]'),
			{ begruendung: 'Prüflauf: geht vor der Neueröffnung.' }
		);
		await gehe(`/versammlungen/${universal}/leitung`);
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${universal}/leitung`);
		behaupte(
			/Sind wieder alle da, können Sie neu eröffnen/.test(await seitentext()),
			'Die Leitungsseite nennt den Weg nach dem Weggang nicht'
		);
		await alleEinlassen(universal);
		await gehe(`/versammlungen/${universal}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"]:has(input[name="universalBestaetigt"])');
		behaupte(await oeffnen.count(), `Nach dem Weggang kein Neueröffnen: ${(await seitentext()).slice(0, 400)}`);
		await oeffnen.locator('input[name="universalBestaetigt"]').check();
		await abschicken(oeffnen.locator('button[type="submit"]').first());
		const marke = await abstimmenUndSchliessen(universal, GESCHAEFTE[3], LEUTE);
		behaupte(marke === 'angenommen', `Die Marke ist «${marke}» statt «angenommen»`);
		return marke;
	});

	/*
	 * **Rückkommen, Widerspruch, veraltete Seite** (`docs/freigabe.md`, «Offen:
	 * Reste zur Universalversammlung», Punkt 10). Nach einem beschlossenen
	 * Rückkommen gilt der frühere Beschluss, wenn jemand widerspricht. Die
	 * Absage beim Eröffnen erscheint nur auf einer Seite, die vor dem
	 * Widerspruch geladen wurde; sie sagt dasselbe wie die Leitungsseite. Die
	 * bei «Neuabstimmung ansetzen» gibt es seit H6 nicht mehr: Am verkündeten
	 * Ergebnis steht der Knopf nicht. Ohne den Bau rot: Dort stand «traktandieren Sie den
	 * Beschluss».
	 */
	await schritt('Rückkommen, dann Widerspruch: auch die veraltete Seite nennt den früheren Beschluss', async () => {
		const FRUEHER = 'Es gilt, was die Versammlung vorher darüber beschlossen hat.';
		await gehe(`/versammlungen/${universal}/leitung`);
		const zeile = seite
			.locator('.baum li', { hasText: GESCHAEFTE[0] })
			.filter({ hasNotText: 'Rückkommen auf' })
			.first();
		const aufklappen = zeile.locator('details.rueckkommen summary');
		behaupte(await aufklappen.count(), `Kein Weg zum Rückkommen: ${(await seitentext()).slice(0, 400)}`);
		await aufklappen.click();
		await abschicken(zeile.locator('form[action="?/rueckkommen"] button[type="submit"]'));

		await gehe(`/versammlungen/${universal}/leitung`);
		const antrag = seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last();
		await abschicken(antrag.locator('form[action="?/aufrufen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${universal}/leitung`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		const marke = await abstimmenUndSchliessen(universal, 'Rückkommen auf', LEUTE);
		behaupte(marke === 'angenommen', `Das Rückkommen ist «${marke}» statt «angenommen»`);

		const zurueck = seite
			.locator('.baum li', { hasText: GESCHAEFTE[0] })
			.filter({ hasNotText: 'Rückkommen auf' })
			.first();
		await abschicken(zurueck.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		// Die zweite Seite der Leitung, geladen vor dem Widerspruch.
		const alt = await seite.context().newPage();
		warteNachNavigation(alt);
		await rueckfragenBestaetigen(alt);
		await alt.goto(`${ZIEL}/versammlungen/${universal}/leitung`, { waitUntil: 'load' });
		await alt.waitForTimeout(250);
		const altOeffnen = alt.locator('form[action="?/oeffnen"]:has(input[name="universalBestaetigt"])');
		behaupte(await altOeffnen.count(), 'Die zweite Seite bietet das Freigeben nicht an');
		// Seit H6 bietet auch die alte Seite keine Neuabstimmung an: Das Ergebnis
		// ist verkündet, und überholen lässt die Leitung nur, was es nicht ist.
		// Bis dahin schickte dieser Schritt sie ab und las die Absage.
		const neuDa =
			(await alt.locator('section.geschaeft form[action="?/neuabstimmung"]').count()) > 0;

		await gehe(`/versammlungen/${universal}/leitung`);
		const w = seite.locator('form[action="?/widerspruch"]:has(input[name="traktandum"])');
		behaupte(await w.count(), `Kein Widerspruch vor dem Eröffnen: ${(await seitentext()).slice(0, 400)}`);
		await waehleNachAnfang(w.locator('select[name="partei"]'), 'Bucher');
		await abschicken(w.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${universal}/leitung`);
		behaupte((await seitentext()).includes(FRUEHER), 'Die Leitungsseite nennt den früheren Beschluss nicht');

		async function altAbschicken(knopf) {
			const nachladen = nachladeWarter(alt);
			const [antwort] = await Promise.all([
				alt.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 }).catch(() => null),
				knopf.click()
			]);
			// Ohne Antwort stünde noch die vorige Absage da, mit demselben Wortlaut.
			behaupte(antwort, 'Der Knopf auf der alten Seite hat nichts abgeschickt');
			await nachAbsendung(alt, antwort, nachladen, 300);
			// Nur die Absage selbst: Die Seite trägt bei anderen Geschäften eigene
			// Wege danach, auch «traktandieren Sie den Beschluss».
			const text = (await alt.locator('main').innerText()).replace(/\s+/g, ' ');
			const ab = text.indexOf('Zu diesem Geschäft hat jemand widersprochen');
			return ab < 0 ? text : text.slice(ab, ab + 400);
		}

		try {
		behaupte(!neuDa, 'Die alte Seite bietet am verkündeten Ergebnis eine Neuabstimmung an');

		await altOeffnen.locator('input[name="universalBestaetigt"]').check();
		const nachOeffnen = await altAbschicken(altOeffnen.locator('button[type="submit"]').first());
		behaupte(
			/Zu diesem Geschäft hat jemand widersprochen/.test(nachOeffnen),
			`Das Eröffnen wurde nicht abgewiesen: ${nachOeffnen.slice(0, 500)}`
		);
		behaupte(nachOeffnen.includes(FRUEHER), `Die Absage beim Eröffnen nennt den früheren Beschluss nicht: ${nachOeffnen.slice(0, 600)}`);
		behaupte(!/traktandieren Sie den Beschluss/.test(nachOeffnen), `«traktandieren Sie den Beschluss» steht da: …${nachOeffnen.slice(Math.max(0, nachOeffnen.indexOf('traktandieren Sie den Beschluss') - 400), nachOeffnen.indexOf('traktandieren Sie den Beschluss') + 60)}`);

		} catch (f) {
			await alt.screenshot({ path: `${AUFNAHMEN}/fehler-alte-seite.png`, fullPage: true }).catch(() => {});
			throw f;
		} finally {
			await alt.close();
		}
		return 'beide Absagen nennen den früheren Beschluss';
	});

	/*
	 * **Widerspruch vor dem Eröffnen** (Produktentscheid 29.09.2026, Migration
	 * 129). Ohne den Bau rot: Vor dem Eröffnen gab es kein Formular dafür, und
	 * «Abstimmung freigeben» blieb stehen.
	 */
	await schritt('Widerspruch vor dem Eröffnen: festgehalten, kein Freigeben mehr', async () => {
		await universalAufrufen(universal, GESCHAEFTE[4]);
		await gehe(`/versammlungen/${universal}/leitung`);
		const w = seite.locator('form[action="?/widerspruch"]:has(input[name="traktandum"])');
		behaupte(await w.count(), `Kein Formular für den Widerspruch vor dem Eröffnen: ${(await seitentext()).slice(0, 400)}`);
		await waehleNachAnfang(w.locator('select[name="partei"]'), 'Bucher');
		await abschicken(w.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${universal}/leitung`);
		behaupte(
			(await seite.locator('form[action="?/oeffnen"]').count()) === 0,
			'Nach dem Widerspruch steht «Abstimmung freigeben» noch da'
		);
		behaupte(
			/Bucher hat um \d\d:\d\d vor dem Eröffnen widersprochen/.test(await seitentext()),
			`Die Leitungsseite nennt den Widerspruch nicht: ${(await seitentext()).slice(0, 600)}`
		);
		return 'festgehalten';
	});

	await schritt('Das Protokoll hält die Universalversammlung fest', async () => {
		await gehe(`/versammlungen/${universal}/leitung`);
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);
		await gehe(`/versammlungen/${universal}/protokoll`);
		await abschicken(seite.locator('button', { hasText: 'Entwurf erzeugen' }).first());
		await gehe(`/versammlungen/${universal}/protokoll`);
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		for (const [muster, was] of [
			[/Alle 2 stimmberechtigten Parteien waren bei der Abstimmung persönlich anwesend/, '5b'],
			[/Kein Beschluss: Bucher hat die Versammlung vor dem Schluss der Abstimmung verlassen/, '5c Weggang'],
			[/hat Bucher der Beschlussfassung widersprochen/, '5c Widerspruch'],
			[/Der 1\. Durchgang ergab keinen Beschluss: Bucher hatte die Versammlung/, 'nach Neueröffnung'],
			[
				/Nicht als Universalversammlung zur Abstimmung gebracht: Um \d\d:\d\d hat Bucher widersprochen, dass heute darüber beschlossen wird/,
				'Widerspruch vor dem Eröffnen'
			],
			[
				// Mit der Nummer des Durchgangs (`docs/freigabe.md`, Punkt (c); H6).
				/Neu abgestimmt wurde nicht: Um \d\d:\d\d hat Bucher widersprochen, dass heute neu darüber beschlossen wird\. Es bleibt beim Beschluss aus dem \d+\. Durchgang\./,
				'Rückkommen, dann Widerspruch'
			]
		]) {
			behaupte(muster.test(entwurf), `Vermerk ${was} fehlt: ${entwurf.slice(0, 900)}`);
		}
		return 'sechs Vermerke';
	});

	/*
	 * **Nur über die Leitung vertreten heisst nicht «verlassen»** (Codeprüfung
	 * Block 4a, N-4). Unter «vertreten» ist Bucher von Anfang an nur über Aebi
	 * da; nach dem Eröffnen kreuzt die Leitung Aebi als ihren Vertreter an.
	 * Kein Beschluss, aber mit diesem Grund, auf der Leitungsseite und im
	 * Protokoll. Ohne den Bau rot: Dort stand «Ohne Stimme gegangen: Bucher» und
	 * «Bucher hat die Versammlung … verlassen». Zuletzt, weil er die Einstellung
	 * der Gemeinschaft umstellt.
	 */
	await schritt('Nur über die Leitung vertreten: kein Beschluss, nicht «verlassen»', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const u = seite.locator('form[action="?/universalversammlung"]');
		await u.locator('input[name="universalvariante"][value="vertreten"]').check();
		const zaehlen = u.locator('input[name="leitungsvollmachtenZaehlen"]');
		if (await zaehlen.isChecked()) await zaehlen.uncheck();
		await abschicken(u.locator('button[type="submit"]').first());
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		behaupte(
			await seite
				.locator('form[action="?/universalversammlung"] input[name="universalvariante"][value="vertreten"]')
				.isChecked(),
			'Die Einstellung «vertreten» ist nicht gespeichert'
		);

		const v = await versammlungBereit(gemeinschaft, '2027-06-14');
		await gehe(`/versammlungen/${v}/vollmachten`);
		const form = seite.locator('form[action="?/erfassen"]');
		await form.locator('input[name="art"][value="eigentuemer"]').check();
		await seite.waitForTimeout(150);
		await form.locator('select[name="bevollmaechtigt"]').selectOption({ label: 'Aebi' });
		await form.locator('ul.liste li', { hasText: 'Bucher' }).first().locator('input[name="vertritt"]').check();
		await abschicken(form.locator('button[type="submit"]').first());
		await gehe(`/versammlungen/${v}/vollmachten`);
		const vorlegen = seite.locator('form[action="?/vorlegen"] button[type="submit"]');
		if (await vorlegen.count()) await abschicken(vorlegen.first());
		await gehe(`/versammlungen/${v}/vollmachten`);
		await abschicken(
			seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])').first()
		);
		await alleEinlassen(v);
		await universalEroeffnen(v, GESCHAEFTE[0]);

		/*
		 * Während der Abstimmung blendet die Seite den Ablauf aus, die Liste
		 * mit. Angekreuzt wird deshalb über das Formular, wie aus einer Seite,
		 * die noch von vor dem Eröffnen offen ist: der Weg, auf dem das
		 * nachträgliche Kreuz entsteht.
		 */
		await gehe(`/versammlungen/${v}/leitung`);
		const kreuz = seite.locator('details.vertreter label', { hasText: 'Aebi' }).first().locator('input');
		behaupte(await kreuz.count(), `Aebi steht nicht unter den Vertretern: ${(await seitentext()).slice(0, 400)}`);
		await kreuz.evaluate((el) => {
			el.checked = true;
		});
		const nachladen = nachladeWarter(seite);
		const [antwort] = await Promise.all([
			seite
				.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
				.catch(() => null),
			seite.locator('form[action="?/leitungsvertreter"]').first().evaluate((f) => f.requestSubmit())
		]);
		await nachAbsendung(seite, antwort, nachladen, 300);

		const marke = await abstimmenUndSchliessen(v, GESCHAEFTE[0], LEUTE);
		behaupte(marke === 'kein Beschluss', `Die Marke ist «${marke}» statt «kein Beschluss»`);
		const text = await seitentext();
		behaupte(
			/Nur über eine Vollmacht der Leitung vertreten: Bucher \(durch Aebi/.test(text),
			`Die Leitungsseite nennt den Grund nicht: ${text.slice(0, 600)}`
		);
		behaupte(!/Ohne Stimme gegangen: Bucher/.test(text), 'Die Leitungsseite sagt «Ohne Stimme gegangen»');
		behaupte(
			/Neu eröffnen können Sie, sobald die Partei selbst da ist oder durch jemanden vertreten wird/.test(text),
			'Der Weg danach spricht von einem Weggang'
		);

		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);
		await gehe(`/versammlungen/${v}/protokoll`);
		await abschicken(seite.locator('button', { hasText: 'Entwurf erzeugen' }).first());
		await gehe(`/versammlungen/${v}/protokoll`);
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			/Kein Beschluss: Bucher war bei der Abstimmung durch Aebi[^.]* vertreten\. Die Sitzungsleitung hat Aebi[^.]* um \d\d:\d\d als Person erfasst/.test(
				entwurf
			),
			`Der Vermerk nennt den Grund nicht: ${entwurf.slice(0, 900)}`
		);
		behaupte(!/Bucher hat die Versammlung/.test(entwurf), 'Das Protokoll sagt «verlassen»');
		return 'Grund statt Weggang';
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
