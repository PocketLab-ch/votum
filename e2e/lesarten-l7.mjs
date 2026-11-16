/**
 * Durchstich: Lesart L7, Ausstand an der Beschlussfähigkeit (Migration 183,
 * Entscheid 0043, Einteilung F3b B2).
 *
 * **Der Weg.** Eine Gemeinschaft mit vier Eigentümern zu 300, 300, 200 und 200
 * von 1000, gezählt je Eigentümer, und zwei erste Versammlungen mit je zwei
 * Traktanden (Jahresrechnung 2026 und Budget 2027, beide «Jahresrechnung,
 * Budget oder Kostenverteilung genehmigen», einfaches Mehr der Anwesenden und
 * Vertretenen). Versammlung A wird unter der Vorgabe «Zählt mit» freigegeben,
 * dann stellt die Verwaltung auf «Zählt nicht mit» und gibt Versammlung B
 * frei; vor dem Saal von B stellt sie zurück. So läuft jede Versammlung unter
 * der Gegenwahl der Gemeinschaft und muss nach ihrer eingefrorenen rechnen.
 * In beiden Sälen sind nur Aebi (300) und Bucher (300) da; bei der
 * Jahresrechnung tritt Bucher in den Ausstand, beim Budget niemand.
 *
 * **Die Rechnung** (ZGB Art. 712p Abs. 1; «die Hälfte» heisst mindestens die
 * Hälfte, `domain/beschlussfaehigkeit.ts`): Nötig sind 2 von 4 Eigentümern,
 * zugleich 500 von 1000 Wertquoten, mindestens zwei Eigentümer.
 * - Mit Bucher: 2 Eigentümer, 600 Wertquoten: beschlussfähig.
 * - Ohne Bucher: 1 Eigentümer, 300 Wertquoten: nicht beschlussfähig (beide
 *   Bedingungen und die Mindestzahl verfehlt). Die Beschlussfähigkeit hängt
 *   also an der Person im Ausstand (`ausstandsbefund`, Entscheid 0043).
 * - Mehr der Jahresrechnung unter der Vorgabe: Bezugsgrösse die Anwesenden
 *   und Vertretenen ohne Ausstand, 1 Kopfstimme (Aebi); nötig 1. Aebi Ja:
 *   angenommen, «1 von 1 haben abgestimmt».
 * - Budget ohne Ausstand: Bezugsgrösse 2, nötig 2. Beide Ja: angenommen,
 *   «2 von 2 haben abgestimmt».
 *
 * **Was gezeigt wird**, je mit der Fundstelle der Erwartung:
 * 1. Die Seite der Gemeinschaft nennt L7 mit Frage, Vorgabe und beiden
 *    Fundstellen (Katalog `domain/lesarten.ts`; DB-Test Kriterien 1 und 2).
 * 2. Eingefroren bei der Freigabe in beide Richtungen (Entscheid 0018; DB-Test
 *    «Bei der Freigabe»; Auftrag F4c, Kriterium 3).
 * 3. Vorgabe, Versammlung A: Vor dem Ausstand kein Satz; nach ihm der Satz an
 *    die Leitung (`AUSSTAND_ZAEHLT_LEITUNG`, Wortlaut im Auftrag F4c), die
 *    Abstimmung geht, angenommen; beim Budget ohne Ausstand kein Satz; das
 *    Protokoll trägt die Zeile genau einmal (DB-Test «Die Vorgabe im Saal»;
 *    Auftrag F4c, Kriterium 5).
 * 4. «Zählt nicht mit», Versammlung B: Der Satz zur Sperre steht vor dem
 *    Klick, das Eröffnen wird mit der Absage zu L7 abgewiesen, ohne Hinweis
 *    auf eine unverbindliche Abstimmung; das Häkchen «konsultativ» fehlt, und
 *    ein Formular mit `konsultativ=ja` wird ebenso abgewiesen (Entscheid 0043;
 *    README, «Konsultativ abstimmen geht»; DB-Test «Die Sperre»). Das Budget
 *    ohne Ausstand öffnet und wird angenommen: Die übrigen Traktanden gehen
 *    weiter.
 *
 * Vier Parteien liegen unter `SCHWELLE_GEFUEHRT`; die Versammlungen laufen
 * einfach. Füllt die Seite trotzdem ein Feld «begruendung» an, wird es gefüllt,
 * und nach jedem Erfassen wird gezählt, ob die Stimmen ankamen.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l7.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l7';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const RECHNUNG = 'Jahresrechnung 2026 genehmigen';
const BUDGET = 'Budget 2027 genehmigen';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['300', '300', '200', '200'];
const [AEBI, BUCHER] = LEUTE;

// Die Wortlaute aus dem Katalog und den Konstanten, deren Wortlaut der
// Auftrag F4c und Entscheid 0043 vorgeben (`domain/mehrhinweise.ts`).
const FRAGE = 'Zählt für die Beschlussfähigkeit mit, wer bei einem Traktandum im Ausstand ist?';
const FUNDSTELLE_VORGABE = 'SVIT-Kommentar Rz. 17 ad Art. 712p';
// S. 63 statt der 62 im Auftrag: Fachprüfung L7, F-1 (06.11.2026), am PDF.
const FUNDSTELLE_ANDERE = 'Handschin/Wyttenbach 2011, S. 63';
const SATZ_LEITUNG =
	'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Traktandum nicht beschlussfähig. ' +
	'Votum zählt sie nach der Einstellung Ihrer Gemeinschaft mit (SVIT-Kommentar Rz. 17 ad Art. 712p). ' +
	'Nach einer anderen Lehrmeinung zählen sie nicht, und der Beschluss wäre angreifbar. Sicher ist er, ' +
	'wenn so viele weitere Eigentümer da oder vertreten sind, dass die Versammlung auch ohne die Personen ' +
	'im Ausstand beschlussfähig ist.';
const ZEILE_PROTOKOLL =
	'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.';
const ABSAGE = 'Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig.';
const ABSAGE_WEG = 'auf die Liste einer späteren Versammlung';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

function vorkommen(text, teil) {
	return text.split(teil).length - 1;
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
	const quittungen = await quittung();
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
}

/**
 * Die Absage des Servers: eine Fehlermeldung, die stehen bleibt
 * (`Meldung` mit `ton="fehler"`), nicht der Hinweis vor dem Klick
 * (`p.meldung.warnung`), der denselben Satz trägt.
 */
async function absage() {
	const m = seite.locator('.meldung.fehler');
	if (!(await m.count())) return '';
	return (await m.allInnerTexts()).join(' ').replace(/\s+/g, ' ');
}

/** Nur die eingeblendeten Meldungen, ohne die Hinweise im Hauptteil. */
async function quittung() {
	return (
		await seite
			.locator('.einblender')
			.innerText()
			.catch(() => '')
	).replace(/\s+/g, ' ');
}

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

/** Auf der Seite der Lesarten L7 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L7"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

/** Der Abschnitt zu L7 auf der Seite der Lesarten. */
function feldL7() {
	return seite.locator('fieldset', { hasText: FRAGE }).first();
}

/** Eine Versammlung im Entwurf mit Jahresrechnung und Budget, freigegeben. */
async function versammlungFreigeben(gemeinschaft, datum) {
	await gehe('/versammlungen/neu');
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', datum);
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const id = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `Nicht angelegt: ${seite.url()}`);

	for (const [titel, wortlaut] of [
		[RECHNUNG, 'Die Jahresrechnung 2026 wird genehmigt.'],
		[BUDGET, 'Das Budget 2027 wird genehmigt.']
	]) {
		await gehe(`/versammlungen/${id}/traktanden`);
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
		await tf.locator('select[name="erfordernis"]').selectOption('k-jahresrechnung');
		await abschicken(tf.locator('button[type="submit"]').first());
	}
	await gehe(`/versammlungen/${id}/traktanden`);
	for (const titel of [RECHNUNG, BUDGET]) {
		behaupte(
			(await seite.locator('[data-traktandum]', { hasText: titel }).count()) > 0,
			`Das Traktandum «${titel}» fehlt`
		);
	}

	await gehe(`/versammlungen/${id}/freigabe`);
	await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
	behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
	return id;
}

/** Eröffnen und nur Aebi und Bucher als anwesend erfassen, je an ihrer Zeile. */
async function saalMitZweien(id) {
	await gehe(`/versammlungen/${id}`);
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
	for (const wer of [AEBI, BUCHER]) {
		await gehe(`/versammlungen/${id}/anwesenheit`);
		const knopf = seite
			.locator('tr', { hasText: wer })
			.first()
			.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
		behaupte((await knopf.count()) > 0, `Keine Anwesenheit zu bestätigen für ${wer}`);
		await abschicken(knopf.first());
	}
	await gehe(`/versammlungen/${id}/leitung`);
	const text = await seitentext();
	// Mit beiden: 2 von 4 Eigentümern, 600 von 1000 Wertquoten.
	behaupte(!/Nicht beschlussfähig:/.test(text), `Mit Aebi und Bucher nicht beschlussfähig: ${text.slice(0, 600)}`);
}

async function rufeAuf(id, titel) {
	await gehe(`/versammlungen/${id}/leitung`);
	const zeile = seite.locator('.baum li', { hasText: titel }).first();
	await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
}

/** Bucher tritt beim aufgerufenen Traktandum in den Ausstand (wie e2e/ausstand.mjs). */
async function buchersAusstand() {
	await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
	await seite.waitForTimeout(150);
	const form = seite.locator('form[action="?/ausstand"]');
	await form.locator('input[type="search"]').fill(BUCHER);
	await seite.waitForTimeout(200);
	await form.locator('.wahlliste input[type="checkbox"]').first().check();
	await form.locator('input[name="grund"]').fill('Prüflauf: Er hat die Jahresrechnung als Kassier selbst geführt.');
	await abschicken(form.locator('button[type="submit"]'));
	const text = await seitentext();
	behaupte(/gibt dazu keine Stimme ab/.test(text), `Der Ausstand steht nicht da: ${text.slice(0, 600)}`);
}

/** Stimmen erfassen und zählen, ob sie ankamen. */
async function erfasse(waehler, erwartet) {
	await oeffneErfassung();
	const form = seite.locator('form[action="?/erfassen"]').first();
	const grund = form.locator('input[name="begruendung"]');
	if (await grund.count()) await grund.first().fill('Prüflauf: im Saal von Hand abgestimmt.');
	for (const wer of waehler) {
		await seite
			.locator('tr', { hasText: wer })
			.first()
			.locator('input[type="radio"][value="yes"]')
			.first()
			.check();
	}
	await abschicken(form.locator('button[type="submit"]').first());
	const text = await seitentext();
	behaupte(
		text.includes(erwartet),
		`Die Erfassung kam nicht an (erwartet «${erwartet}»): ${text.match(/\d+ von \d+ haben abgestimmt/)?.[0] ?? text.slice(0, 600)}`
	);
}

async function schliesseUndLies(id, titel) {
	await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
	await gehe(`/versammlungen/${id}/leitung`);
	const karte = seite.locator('article.ergebnis', { hasText: titel }).first();
	return (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L7, Ausstand an der Beschlussfähigkeit: ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlungA;
	let versammlungB;
	const NAME = `Prüflauf Lesart L7 ${LAUF}`;

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

	await schritt('Gemeinschaft mit vier Eigentümern zu 300, 300, 200 und 200', async () => {
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
		return '300 + 300 + 200 + 200 von 1000';
	});

	await schritt('Die Seite nennt L7 mit Frage, Vorgabe und Fundstellen', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const feld = feldL7();
		behaupte(await feld.count(), `Die Frage zu L7 fehlt: ${(await seitentext()).slice(0, 600)}`);
		const text = ((await feld.innerText()) ?? '').replace(/\s+/g, ' ');
		behaupte(
			await seite.locator('input[name="L7"][value="zaehlt"]').isChecked(),
			'«Zählt mit» ist nicht angekreuzt'
		);
		behaupte(text.includes('Zählt mit (Vorgabe)'), `Die Vorgabe ist nicht gekennzeichnet: ${text.slice(0, 600)}`);
		behaupte(text.includes('Zählt nicht mit'), `Die andere Wahl fehlt: ${text.slice(0, 600)}`);
		behaupte(text.includes(FUNDSTELLE_VORGABE), `Die Fundstelle der Vorgabe fehlt: ${text.slice(0, 900)}`);
		behaupte(text.includes(FUNDSTELLE_ANDERE), `Die Fundstelle der anderen Wahl fehlt: ${text.slice(0, 900)}`);
		behaupte(text.includes('Vorgabe, nie geändert.'), `Der Stand «nie geändert» fehlt: ${text.slice(0, 900)}`);
		return 'Vorgabe «Zählt mit», beide Fundstellen';
	});

	await schritt('Versammlung A unter der Vorgabe freigeben, dann auf «Zählt nicht mit»', async () => {
		versammlungA = await versammlungFreigeben(gemeinschaft, '2027-12-15');
		await stelleUm(gemeinschaft, 'zaehlt_nicht');
		const text = ((await feldL7().innerText()) ?? '').replace(/\s+/g, ' ');
		behaupte(/Zuletzt geändert von .* am /.test(text), `Der Stand «zuletzt geändert» fehlt: ${text.slice(0, 900)}`);
		return 'A eingefroren «Zählt mit», Gemeinschaft «Zählt nicht mit»';
	});

	await schritt('Versammlung B unter «Zählt nicht mit» freigeben', async () => {
		versammlungB = await versammlungFreigeben(gemeinschaft, '2027-12-16');
		return 'B eingefroren «Zählt nicht mit»';
	});

	// ── Versammlung A: die Vorgabe, gefahren unter «Zählt nicht mit» ────────

	await schritt('A: Mit Aebi und Bucher beschlussfähig, vor dem Ausstand kein Satz', async () => {
		await saalMitZweien(versammlungA);
		await rufeAuf(versammlungA, RECHNUNG);
		const text = await seitentext();
		behaupte(!text.includes(SATZ_LEITUNG), 'Der Satz steht schon ohne Ausstand');
		behaupte(!text.includes(ABSAGE), 'Der Satz zur Sperre steht ohne Ausstand');
		return '2 von 4, 600 von 1000';
	});

	await schritt('A: Bucher im Ausstand, die Leitung nennt den Satz zur Vorgabe', async () => {
		await buchersAusstand();
		const text = await seitentext();
		behaupte(
			text.includes(SATZ_LEITUNG),
			`Der Satz an die Leitung fehlt (eingefroren «Zählt mit», die Gemeinschaft steht auf «Zählt nicht mit»): ${text.slice(0, 1200)}`
		);
		behaupte(!text.includes(ABSAGE), 'A rechnet nach der Gemeinschaft statt nach der eingefrorenen Wahl');
		return 'ohne Bucher 1 von 4, 300 von 1000';
	});

	await schritt('A: Die Abstimmung geht, Aebi Ja, angenommen', async () => {
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		const offen = await seitentext();
		behaupte(
			/Die Abstimmung ist offen\./.test(offen),
			`Die Abstimmung öffnet unter der Vorgabe nicht: ${(await quittung()).slice(0, 600)}`
		);
		await erfasse([AEBI], '1 von 1 haben abgestimmt');
		const satz = await schliesseUndLies(versammlungA, RECHNUNG);
		behaupte(
			satz.startsWith('Angenommen: 1 Ja von 1 Kopfstimme, nötig 1.'),
			`Nicht wie gerechnet (1 Ja von 1, nötig 1): ${satz.slice(0, 400)}`
		);
		return satz.slice(0, 80);
	});

	await schritt('A: Beim Budget ohne Ausstand kein Satz', async () => {
		await rufeAuf(versammlungA, BUDGET);
		const text = await seitentext();
		behaupte(!text.includes(SATZ_LEITUNG), `Der Satz steht beim Budget, wo niemand im Ausstand ist: ${text.slice(0, 900)}`);
		return 'Ausstand gilt je Traktandum';
	});

	await schritt('A: Das Protokoll trägt die Zeile genau einmal', async () => {
		await gehe(`/versammlungen/${versammlungA}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		const n = vorkommen(entwurf, ZEILE_PROTOKOLL);
		behaupte(n === 1, `Die Zeile steht ${n}-mal im Protokoll, erwartet einmal: ${entwurf.slice(0, 1500)}`);
		return 'eine Zeile, an der Jahresrechnung';
	});

	// ── Versammlung B: «Zählt nicht mit», gefahren unter der Vorgabe ────────

	await schritt('Gemeinschaft zurück auf die Vorgabe, B bleibt eingefroren', async () => {
		await stelleUm(gemeinschaft, 'zaehlt');
		behaupte(await seite.locator('input[name="L7"][value="zaehlt"]').isChecked(), 'Nicht zurückgestellt');
		return 'Gemeinschaft «Zählt mit»';
	});

	await schritt('B: Bucher im Ausstand, der Satz zur Sperre steht vor dem Klick, ohne «konsultativ»', async () => {
		await saalMitZweien(versammlungB);
		await rufeAuf(versammlungB, RECHNUNG);
		behaupte(!(await seitentext()).includes(ABSAGE), 'Der Satz zur Sperre steht ohne Ausstand');
		await buchersAusstand();
		const text = await seitentext();
		behaupte(
			text.includes(ABSAGE) && text.includes(ABSAGE_WEG),
			`Der Satz zur Sperre fehlt vor dem Klick (eingefroren «Zählt nicht mit», die Gemeinschaft steht auf der Vorgabe): ${text.slice(0, 1200)}`
		);
		behaupte(!text.includes(SATZ_LEITUNG), 'B rechnet nach der Gemeinschaft statt nach der eingefrorenen Wahl');
		behaupte(
			(await seite.locator('form[action="?/oeffnen"] input[name="konsultativ"]').count()) === 0,
			'An der Sperre steht das Häkchen «konsultativ» (Entscheid 0043)'
		);
		return 'Sperre angekündigt';
	});

	await schritt('B: Das Eröffnen wird abgewiesen, mit der Absage zu L7', async () => {
		behaupte(!(await absage()), 'Vor dem Klick steht schon eine Fehlermeldung');
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		const text = await absage();
		behaupte(text.includes(ABSAGE), `Keine Absage zu L7: ${text.slice(0, 600) || (await seitentext()).slice(0, 600)}`);
		behaupte(text.includes(ABSAGE_WEG), `Die Absage nennt den Weg nicht: ${text}`);
		behaupte(!/unverbindlich abstimmen/.test(text), `Die Absage bietet den unverbindlichen Weg an: ${text}`);
		await gehe(`/versammlungen/${versammlungB}/leitung`);
		behaupte(
			(await seite.locator('form[action="?/schliessen"]').count()) === 0,
			'Trotz Absage läuft eine Abstimmung'
		);
		return text.slice(0, 90);
	});

	await schritt('B: Auch «konsultativ» wird abgewiesen, mit derselben Absage', async () => {
		// Das Häkchen bietet die Seite nicht an (oben). Der Server entscheidet
		// trotzdem selbst: Ein Formular mit `konsultativ=ja`, wie es eine
		// zurückliegende Seite schicken könnte, wird mit der Absage zu L7
		// abgewiesen, nicht mit dem Satz «beschlussfähig, deshalb verbindlich».
		const form = seite.locator('form[action="?/oeffnen"]').first();
		await form.evaluate((f) => {
			const feld = document.createElement('input');
			feld.type = 'hidden';
			feld.name = 'konsultativ';
			feld.value = 'ja';
			f.appendChild(feld);
		});
		// Beide Wege enden in derselben Absage; dass «konsultativ» wirklich
		// mitging, zeigt erst die Anfrage selbst.
		const anfrage = seite.waitForRequest(
			(r) => r.method() === 'POST' && r.url().includes('/oeffnen'),
			{ timeout: 45000 }
		);
		await abschicken(form.locator('button[type="submit"]').first());
		const inhalt = (await anfrage).postData() ?? '';
		behaupte(/konsultativ=ja|name="konsultativ"\r?\n\r?\nja/.test(inhalt), `«konsultativ» ging nicht mit: ${inhalt.slice(0, 400)}`);
		const text = await absage();
		behaupte(text.includes(ABSAGE), `Keine Absage zu L7 an «konsultativ»: ${text.slice(0, 600) || (await seitentext()).slice(0, 600)}`);
		behaupte(!/deshalb wird verbindlich abgestimmt/.test(text), `Die Absage sagt «verbindlich»: ${text}`);
		await gehe(`/versammlungen/${versammlungB}/leitung`);
		behaupte(
			(await seite.locator('form[action="?/schliessen"]').count()) === 0,
			'Konsultativ läuft trotz Absage eine Abstimmung'
		);
		return 'kein Durchgang';
	});

	await schritt('B: Das Budget ohne Ausstand öffnet und wird angenommen', async () => {
		await rufeAuf(versammlungB, BUDGET);
		const vorher = await seitentext();
		behaupte(!vorher.includes(ABSAGE), `Die Sperre steht beim Budget ohne Ausstand: ${vorher.slice(0, 900)}`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		behaupte(
			/Die Abstimmung ist offen\./.test(await seitentext()),
			`Das Budget öffnet nicht: ${(await quittung()).slice(0, 600)}`
		);
		await erfasse([AEBI, BUCHER], '2 von 2 haben abgestimmt');
		const satz = await schliesseUndLies(versammlungB, BUDGET);
		behaupte(
			satz.startsWith('Angenommen: 2 Ja von 2 Kopfstimmen, nötig 2.'),
			`Nicht wie gerechnet (2 Ja von 2, nötig 2): ${satz.slice(0, 400)}`
		);
		return 'die übrigen Traktanden gehen weiter';
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
