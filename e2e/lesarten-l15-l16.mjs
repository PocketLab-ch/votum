/**
 * Durchstich: Lesarten L15 (Stimmführung in der Höchstzahl) und L16 (Vertagen
 * nach erreichter Beschlussfähigkeit), Migration 194, Entscheid 0054 Punkte 2,
 * 3, 6 und 7. Auftrag `.auftraege/2026-11-16-votum-durchstiche-l15-l16.md`.
 *
 * **Fünf Fälle, je mit eigener Gemeinschaft.** Ein roter Fall hält die übrigen
 * nicht auf; am Schluss steht je Fall grün oder rot.
 *
 *   1. **L16, Vorgabe «Neue erste Versammlung».** Vier Eigentümer zu 250 von
 *      1000, drei kommen, die Beschlussfähigkeit wird festgehalten, zwei gehen,
 *      vertagt. Erwartet: Folgeversammlung als neue erste, ohne Vorgängerin.
 *   2. **L16, Wahl «Zweite Versammlung»**, vor der Freigabe gesetzt, gleiche
 *      Lage. Erwartet: zweite Versammlung mit der vertagten als Vorgängerin,
 *      Termin frühestens am elften Tag; der Ausklapper «Vertagen» zeigt vorher
 *      den Satz mit der Folge und dem Satz an die Versammlung; die Einladung
 *      der zweiten trägt den Zusatz zur Einstellung (`L16_EINLADUNG`).
 *   3. **L16, Wahl «Zweite Versammlung», noch beschlussfähig beim Vertagen**
 *      (Entscheid 0054 Punkt 7, Fachprüfung F-1). Erwartet: neue erste.
 *   4. **L15, Vorgabe «Zählt nicht mit».** Höchstzahl 1. Erfunden Anna hat
 *      eine eigene Wohnung und steht mit Erfunden Beat in einer
 *      gemeinschaftlichen Partei; sie hält schon eine gewöhnliche Vollmacht für
 *      Erfunden Cla und wird am Einlass für die gemeinsame Partei erfasst.
 *      Erwartet: angenommen.
 *   5. **L15, Wahl «Zählt mit»**, gleiche Lage. Erwartet: abgewiesen, die
 *      Absage enthält «zählt dabei die Stimme mit, die die Person als
 *      Mitberechtigte».
 *
 * Lage für 4 und 5 wie `tests/db/lesart-stimmfuehrung.test.ts`, hier über die
 * Oberfläche: Die gemeinsame Partei nimmt Anna als bestehende Person auf, den
 * Grund `mitberechtigt` leitet `erfasseInTx` selbst her.
 *
 * **Rotprobe.** `ROTPROBE=L16` setzt in Fall 2 die Wahl nicht, `ROTPROBE=L15`
 * in Fall 5 nicht; dann muss genau dieser Fall rot werden. So zeigt das
 * Drehbuch, dass es die Wirkung der Wahl misst und nicht die Vorgabe.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»); für die Einladung `pdftotext` auf dem
 * Wirt:
 *
 *     node e2e/lesarten-l15-l16.mjs
 *
 * Die Gemeinschaften beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql`
 * nimmt sie mit. Die Personen heissen «Erfunden …» mit Fall und Lauf im Namen.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l15-l16';
const ROTPROBE = process.env.ROTPROBE ?? '';
if (!['', 'L15', 'L16'].includes(ROTPROBE)) {
	console.error(`ROTPROBE=«${ROTPROBE}» gibt es nicht; erlaubt sind L15 und L16, oder die Variable weglassen.`);
	process.exit(2);
}

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const FESTSTELLUNG = 'Feststellung der Beschlussfähigkeit';
const GRUND_NICHT_BESCHLUSSFAEHIG = 'Nicht beschlussfähig (ZGB Art. 712p Abs. 2).';
const GRUND_BESCHLOSSEN = 'Die Versammlung hat die Vertagung beschlossen.';

/*
 * ── Sätze aus dem Code, wörtlich (Stand fdc14214) ──
 * `src/lib/domain/versammlung.ts`: `vertagenUeberschrift`,
 * `vertagenNeueErsteSatz`, `vertagenZweiteNachLesartSatz`, `vertagtMeldung`;
 * `src/lib/domain/lesarten.ts`: `L16_FOLGE`, `L16_EINLADUNG`;
 * `src/lib/domain/vollmacht.ts`, `vollmachtsgrenzeSatz`: der Satz der Absage
 * nach L15 (auch in `tests/db/lesart-stimmfuehrung.test.ts`).
 */
const UEBERSCHRIFT_NEUE = 'Vertagen und neue Versammlung ansetzen';
const UEBERSCHRIFT_ZWEITE = 'Vertagen und zweite Versammlung ansetzen';
const AUSKLAPPER_ZWEITE = 'Nach der Einstellung Ihrer Gemeinschaft legt Votum eine zweite Versammlung an (ZGB Art. 712p Abs. 3).';
const AUSKLAPPER_FOLGE = 'Sieht ein Gericht die Folgeversammlung als neue erste an, kann ein Beschluss angefochten werden';
const AUSKLAPPER_AN_DIE_VERSAMMLUNG = 'Sagen Sie der Versammlung vor dem Vertagen: «An der nächsten Versammlung genügt ein Drittel; so hat die Verwaltung es für die Gemeinschaft eingestellt.';
/** Nur in `vertagenNeueErsteSatz`; der Satzanfang davor steht auch im Satz zur zweiten nach L16. */
const AUSKLAPPER_NEUE_ERSTE = 'Votum legt deshalb keine zweite Versammlung an, sondern eine neue erste';
const MELDUNG_NEUE_ERSTE = 'die Folgeversammlung steht deshalb als neue erste Versammlung im Entwurf bereit';
const MELDUNG_ZWEITE = 'Vertagt. Die zweite Versammlung steht als Entwurf bereit';
const MELDUNG_NACH_LESART = 'dass die Folgeversammlung eine zweite ist, folgt der Einstellung Ihrer Gemeinschaft';
const EINLADUNG_ZUSATZ = 'beruht auf einer Einstellung, die die Verwaltung für die Gemeinschaft gewählt hat';
const ABSAGE_L15 = 'zählt dabei die Stimme mit, die die Person als Mitberechtigte';

let nr = 0;
/** Je Fall: Titel, grün oder der Befund. */
const faelle = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

function sauber(text) {
	return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function ablegen(name, text) {
	await writeFile(`${AUFNAHMEN}/${name}.txt`, `${text}\n`).catch(() => {});
}

/** Tage zwischen zwei Daten `JJJJ-MM-TT`. */
function tageZwischen(von, bis) {
	return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»: ${werte.map((o) => o.text).join(' | ').slice(0, 400)}`);
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

/** Ein Fall läuft bis zum ersten roten Schritt; der nächste Fall beginnt trotzdem. */
async function fall(titel, fn) {
	console.log(`\n${titel}`);
	try {
		await fn();
		faelle.push({ titel, gruen: true });
	} catch (f) {
		faelle.push({ titel, gruen: false, text: f.message });
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

/**
 * Was auf der Seite steht, samt der Quittung unten rechts (wie `e2e/lesarten-l3.mjs`).
 * `.einblender` steht nur da, solange es eine Einblendung gibt
 * (`Einblender.svelte`); ohne `count()` wartete `innerText` jedes Mal die 30 s
 * der Vorgabefrist ab (Codeprüfung 16.11.2026: ein Lauf dauerte so 22 Minuten).
 */
async function seitentext() {
	const haupt = await seite.locator('main').innerText();
	const kasten = seite.locator('.einblender');
	const quittungen = (await kasten.count()) ? await kasten.first().innerText().catch(() => '') : '';
	return sauber(`${haupt} ${quittungen}`);
}

// ── Bausteine ──────────────────────────────────────────────────────────────

/**
 * Eine Gemeinschaft mit Wohnungen zu je einer Partei. Der Name steht als
 * Vorlage hier, nicht als Parameter: `tests/waechter/testdatennamen.test.ts`
 * muss ihn lesen können, damit `scripts/testdaten-entfernen.sql` ihn sicher trifft.
 */
async function legeGemeinschaftAn(zusatz, leute) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `Prüflauf Lesart L15 L16 ${zusatz} ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `Nicht angelegt: ${seite.url()}`);
	for (const [i, [wer, quote]] of leute.entries()) {
		await legeEinheitAn(id, `Whg ${i + 1}`, quote);
		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(wer);
		await abschicken(pf.locator('button[type="submit"]'));
		await ordneZu(id, `Whg ${i + 1}`, wer);
	}
	return id;
}

async function legeEinheitAn(gemeinschaft, label, quote) {
	await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
	const ef = seite.locator('form[action$="anlegen"]').first();
	await ef.locator('input[name="label"]').fill(label);
	await ef.locator('input[name="quote.stamm"]').fill(quote);
	await abschicken(ef.locator('button[type="submit"]'));
}

async function ordneZu(gemeinschaft, einheit, partei) {
	await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
	const zf = seite.locator('form[action$="zuordnen"]').last();
	await waehleNachAnfang(zf.locator('select[name="unitId"]'), einheit);
	await waehleNachAnfang(zf.locator('select[name="partyId"]'), partei);
	await abschicken(zf.locator('button[type="submit"]'));
}

/** Auf der Seite «Lesarten» eine Wahl setzen, mit Quittung. */
async function stelleUm(gemeinschaft, kennung, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="${kennung}"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	behaupte(
		await seite.locator(`input[name="${kennung}"][value="${wahl}"]`).isChecked(),
		`${kennung} steht nach dem Speichern nicht auf «${wahl}»`
	);
}

/** Wie die Seite «Lesarten» eine Lesart gerade zeigt. */
async function gewaehlt(gemeinschaft, kennung) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	return seite.locator(`input[name="${kennung}"]:checked`).getAttribute('value');
}

/** Versammlung mit einem Traktandum, freigegeben und eröffnet. */
async function legeVersammlungAn(gemeinschaft, datum) {
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

	await gehe(`/versammlungen/${id}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill('Fassadenanstrich');
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf
		.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
		.first()
		.fill('Der Fassadenanstrich wird beschlossen.');
	await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
	await abschicken(tf.locator('button[type="submit"]').first());

	await gehe(`/versammlungen/${id}/freigabe`);
	const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
	behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 400)}`);
	await abschicken(frei.first());
	behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
	await gehe(`/versammlungen/${id}`);
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
	return id;
}

async function erfasseAnwesend(versammlung, wer) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const zeile = seite.locator('tr', { hasText: wer }).first();
	behaupte(await zeile.count(), `Die Zeile von «${wer}» fehlt in der Anwesenheitsliste`);
	const knopf = zeile.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
	behaupte(await knopf.count(), `Kein Knopf zum Bestätigen bei «${wer}»`);
	await abschicken(knopf.first());
}

/**
 * Eine Partei austragen. Die Rückfrage verlangt eine Begründung; ihr Feld
 * trägt kein `required`, deshalb wartet dieser Baustein auf das offene
 * Fenster, tippt sie und bestätigt (wie `abschicken` in `durchspielen.mjs`).
 */
async function verlasse(versammlung, wer) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const zeile = seite.locator('tr', { hasText: wer }).first();
	const knopf = zeile.locator('form[action="?/verlassen"] button[type="submit"]').first();
	behaupte(await knopf.count(), `Kein Knopf zum Austragen bei «${wer}»`);
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite.waitForResponse(
			(r) => r.request().method() === 'POST' && r.url().split('#')[0].endsWith('?/verlassen'),
			{ timeout: 30000 }
		),
		knopf.click().then(async () => {
			const fenster = zeile.locator('form[action="?/verlassen"] dialog.rueckfrage[open]');
			await fenster.waitFor({ state: 'visible', timeout: 10000 });
			await fenster.locator('input[name="begruendung"]').fill('Prüflauf: geht nach Hause.');
			await fenster.locator('button.ja').click({ timeout: 5000 });
		})
	]);
	await nachAbsendung(seite, antwort, nachladen, 300);
	behaupte(/hat die Versammlung verlassen/.test(await seitentext()), `«${wer}» ist nicht ausgetragen: ${(await seitentext()).slice(0, 400)}`);
}

/** Das erste Traktandum in der Leitung aufrufen (oder, schon aufgerufen, neu laden). */
async function rufeFeststellungAuf(versammlung) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = seite.locator('.baum li', { hasText: FESTSTELLUNG }).first();
	behaupte(await zeile.count(), `«${FESTSTELLUNG}» fehlt im Baum: ${(await seitentext()).slice(0, 400)}`);
	const knopf = zeile.locator('form[action="?/aufrufen"] button[type="submit"]');
	if (await knopf.count()) await abschicken(knopf.first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
}

async function halteFest(versammlung) {
	await rufeFeststellungAuf(versammlung);
	const knopf = seite.locator('form[action="?/festhalten"] button[type="submit"]');
	behaupte(await knopf.count(), `Kein Knopf «Beschlussfähigkeit festhalten»: ${(await seitentext()).slice(0, 600)}`);
	await abschicken(knopf.first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const text = await seitentext();
	behaupte(/Festgehalten \S+ — beschlussfähig/.test(text), `Nicht beschlussfähig festgehalten: ${text.slice(0, 800)}`);
	return text.match(/Festgehalten [^,]+, \d+ von \d+/)?.[0] ?? 'festgehalten';
}

/** Der Ausklapper «Vertagen» in der Leitung, gelesen bevor vertagt wird. */
async function ausklapper(versammlung) {
	await rufeFeststellungAuf(versammlung);
	const kasten = seite.locator('details.vertagen').first();
	behaupte(await kasten.count(), `Kein Ausklapper «Vertagen»: ${(await seitentext()).slice(0, 600)}`);
	return {
		ueberschrift: sauber(await kasten.locator('summary').first().textContent()),
		text: sauber(await kasten.textContent()),
		dringend: await kasten.evaluate((d) => d.classList.contains('dringend'))
	};
}

/** Vertagen mit dem Grund; zurück kommt die Meldung. */
async function vertage(versammlung, grund) {
	await rufeFeststellungAuf(versammlung);
	await seite.evaluate(() => {
		document.querySelectorAll('details:has(form[action="?/vertagen"])').forEach((d) => (d.open = true));
	});
	const form = seite.locator('form[action="?/vertagen"]').first();
	behaupte(await form.count(), 'Kein Formular zum Vertagen');
	await form.locator('select[name="grund"]').selectOption(grund);
	await abschicken(form.locator('button[type="submit"]').first());
	return seitentext();
}

/** Die Folgeversammlung über die Übersicht der Gemeinschaft (eine je Gemeinschaft). */
async function folgeVon(gemeinschaft, vertagte) {
	await gehe(`/gemeinschaften/${gemeinschaft}`);
	const ziele = await seite
		.locator('a', { hasText: 'Zur Vorbereitung' })
		.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
	const ids = ziele
		.map((z) => z.split('/versammlungen/')[1]?.split(/[/?#]/)[0])
		.filter((id) => id && id !== vertagte);
	behaupte(ids.length === 1, `Nicht genau eine Folgeversammlung in der Übersicht: ${ids.join(', ') || 'keine'}`);
	return ids[0];
}

/** Stufe, Vorgängerin und Datum aus den Angaben der Folgeversammlung (Entwurf). */
async function angabenVon(versammlung) {
	await gehe(`/versammlungen/${versammlung}`);
	const form = seite.locator('form#angaben');
	behaupte(await form.count(), `Keine änderbaren Angaben an der Folgeversammlung: ${(await seitentext()).slice(0, 400)}`);
	const stufe = await form.locator('input[name="stufe"]:checked').getAttribute('value');
	const vorgaenger = (await form.locator('[name="vorgaengerId"]').count())
		? await form.locator('[name="vorgaengerId"]').first().inputValue()
		: '';
	const datum = await form.locator('input[name="datum"]').inputValue();
	const kopf = sauber(await seite.locator('main').innerText()).slice(0, 300);
	return { stufe, vorgaenger, datum, kopf };
}

/** Der Text der Einladung als PDF, über `pdftotext`, Trennungen am Zeilenende aufgehoben. */
async function einladungstext(versammlung, name) {
	const antwort = await seite.request.get(`${ZIEL}/versammlungen/${versammlung}/einladung.pdf`);
	behaupte(antwort.ok(), `Einladung nicht erzeugt: ${antwort.status()}`);
	const datei = `${AUFNAHMEN}/${name}.pdf`;
	await writeFile(datei, await antwort.body());
	const roh = execFileSync('pdftotext', [datei, '-'], { encoding: 'utf8' });
	const text = sauber(roh.replace(/­/g, '').replace(/-\n/g, ''));
	await ablegen(name, text);
	return text;
}

/** L16: Gemeinschaft, Wahl, Versammlung, drei da, festgehalten; `gehen` Eigentümer gehen wieder. */
async function lageL16(kuerzel, datum, wahl, gehen) {
	const leute = ['Anna', 'Beat', 'Cla', 'Dora'].map((v) => `Erfunden ${v} ${kuerzel} ${LAUF}`);
	let g;
	let v;
	await schritt('Gemeinschaft mit vier Eigentümern zu je 250', async () => {
		g = await legeGemeinschaftAn(kuerzel, leute.map((w) => [w, '250']));
		return g.slice(0, 8);
	});
	await schritt(wahl ? `L16 vor der Freigabe auf «${wahl}»` : 'L16 bleibt auf der Vorgabe', async () => {
		if (wahl) await stelleUm(g, 'L16', wahl);
		const steht = await gewaehlt(g, 'L16');
		behaupte(steht === (wahl ?? 'neue_erste'), `L16 steht auf «${steht}»`);
		return steht;
	});
	await schritt(`Erste Versammlung am ${datum}, freigegeben, eröffnet, drei da`, async () => {
		v = await legeVersammlungAn(g, datum);
		for (const wer of leute.slice(0, 3)) await erfasseAnwesend(v, wer);
		await gehe(`/versammlungen/${v}/anwesenheit`);
		const text = await seitentext();
		behaupte(/3 von 4 Parteien anwesend/.test(text), `Nicht drei von vier: ${text.slice(0, 400)}`);
		return v.slice(0, 8);
	});
	await schritt('Beschlussfähigkeit festgehalten', async () => halteFest(v));
	if (gehen > 0) {
		await schritt(`${gehen} Eigentümer gehen, nicht mehr beschlussfähig`, async () => {
			for (const wer of leute.slice(3 - gehen, 3)) await verlasse(v, wer);
			const k = await ausklapper(v);
			behaupte(k.dringend, 'Der Ausklapper «Vertagen» ist nicht hervorgehoben: Die Versammlung gilt noch als beschlussfähig');
			return `${3 - gehen} von 4 da`;
		});
	}
	return { g, v };
}

// ── Lauf ───────────────────────────────────────────────────────────────────

await mkdir(AUFNAHMEN, { recursive: true });
// Nur die eigenen Fehlerbilder eines früheren Laufs, sonst zeigt ein grüner Lauf ein fremdes (Codeprüfung N6).
for (const name of await readdir(AUFNAHMEN)) {
	if (/^fehler-\d+\.png$/.test(name)) await rm(`${AUFNAHMEN}/${name}`);
}
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesarten L15 und L16: ${ZIEL}${ROTPROBE ? ` (Rotprobe ${ROTPROBE})` : ''}`);

let angemeldet = false;
try {
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
	angemeldet = true;
} catch {
	/* steht schon in der Ausgabe; ohne Anmeldung gibt es keinen Fall */
}

if (angemeldet) {
	await fall('Fall 1: L16 Vorgabe, Beschlussfähigkeit verloren: neue erste', async () => {
		const { g, v } = await lageL16('F1', '2027-11-02', null, 2);
		await schritt('Ausklapper vor dem Vertagen: neue Versammlung', async () => {
			const k = await ausklapper(v);
			await ablegen('fall1-ausklapper', k.text);
			behaupte(k.ueberschrift === UEBERSCHRIFT_NEUE, `Überschrift «${k.ueberschrift}»`);
			behaupte(k.text.includes(AUSKLAPPER_NEUE_ERSTE), `Der Satz zur neuen ersten fehlt: ${k.text.slice(0, 600)}`);
			behaupte(!k.text.includes(AUSKLAPPER_ZWEITE), 'Der Satz zur zweiten nach L16 steht unter der Vorgabe');
			return k.ueberschrift;
		});
		await schritt('Vertagt: Meldung nennt die neue erste', async () => {
			const meldung = await vertage(v, GRUND_NICHT_BESCHLUSSFAEHIG);
			await ablegen('fall1-meldung', meldung);
			behaupte(meldung.includes(MELDUNG_NEUE_ERSTE), `Keine Meldung zur neuen ersten: ${meldung.slice(0, 600)}`);
			return 'neue erste gemeldet';
		});
		await schritt('Folgeversammlung: erste, ohne Vorgängerin', async () => {
			const a = await angabenVon(await folgeVon(g, v));
			behaupte(a.stufe === 'erste', `Stufe «${a.stufe}»: ${a.kopf}`);
			behaupte(!a.vorgaenger, `Vorgängerin gesetzt: ${a.vorgaenger}`);
			return `Stufe ${a.stufe}, ohne Vorgängerin, ${a.datum}`;
		});
	});

	await fall('Fall 2: L16 «Zweite Versammlung», Beschlussfähigkeit verloren: zweite', async () => {
		const wahl = ROTPROBE === 'L16' ? null : 'zweite';
		const datum = '2027-11-03';
		const { g, v } = await lageL16('F2', datum, wahl, 2);
		await schritt('Ausklapper vor dem Vertagen: zweite, mit der Folge und dem Satz an die Versammlung', async () => {
			const k = await ausklapper(v);
			await ablegen('fall2-ausklapper', k.text);
			behaupte(k.ueberschrift === UEBERSCHRIFT_ZWEITE, `Überschrift «${k.ueberschrift}»`);
			behaupte(k.text.includes(AUSKLAPPER_ZWEITE), `Der Satz zur zweiten nach L16 fehlt: ${k.text.slice(0, 600)}`);
			behaupte(!k.text.includes(AUSKLAPPER_NEUE_ERSTE), 'Der Satz zur neuen ersten steht neben dem zur zweiten');
			behaupte(k.text.includes(AUSKLAPPER_FOLGE), 'Die Folge (L16_FOLGE) fehlt im Ausklapper');
			behaupte(k.text.includes(AUSKLAPPER_AN_DIE_VERSAMMLUNG), 'Der Satz an die Versammlung fehlt im Ausklapper');
			return k.ueberschrift;
		});
		let folge;
		await schritt('Vertagt: Meldung nennt die zweite und die Einstellung', async () => {
			const meldung = await vertage(v, GRUND_NICHT_BESCHLUSSFAEHIG);
			await ablegen('fall2-meldung', meldung);
			behaupte(meldung.includes(MELDUNG_ZWEITE), `Keine Meldung zur zweiten: ${meldung.slice(0, 600)}`);
			behaupte(meldung.includes(MELDUNG_NACH_LESART), `Die Meldung nennt die Einstellung nicht: ${meldung.slice(0, 900)}`);
			folge = await folgeVon(g, v);
			return folge.slice(0, 8);
		});
		await schritt('Folgeversammlung: zweite, Vorgängerin die vertagte, frühestens am elften Tag', async () => {
			const a = await angabenVon(folge);
			behaupte(a.stufe === 'zweite', `Stufe «${a.stufe}»: ${a.kopf}`);
			behaupte(a.vorgaenger === v, `Vorgängerin «${a.vorgaenger}» statt ${v}`);
			const tage = tageZwischen(datum, a.datum);
			behaupte(tage >= 11, `Termin ${a.datum}, ${tage} Tage nach der vertagten`);
			return `Stufe ${a.stufe}, Vorgängerin ${a.vorgaenger.slice(0, 8)}, ${a.datum} (+${tage} Tage)`;
		});
		await schritt('Einladung der zweiten trägt den Zusatz zur Einstellung', async () => {
			const text = await einladungstext(folge, 'fall2-einladung');
			behaupte(text.includes(EINLADUNG_ZUSATZ), `Der Zusatz fehlt in der Einladung: ${text.slice(0, 1500)}`);
			return 'Zusatz steht';
		});
	});

	await fall('Fall 3: L16 «Zweite Versammlung», noch beschlussfähig: neue erste', async () => {
		const { g, v } = await lageL16('F3', '2027-11-04', 'zweite', 0);
		await schritt('Ausklapper vor dem Vertagen: neue Versammlung, ohne den Satz nach L16', async () => {
			const k = await ausklapper(v);
			await ablegen('fall3-ausklapper', k.text);
			behaupte(!k.dringend, 'Der Ausklapper ist hervorgehoben, obwohl die Versammlung beschlussfähig ist');
			behaupte(k.ueberschrift === UEBERSCHRIFT_NEUE, `Überschrift «${k.ueberschrift}»`);
			behaupte(k.text.includes(AUSKLAPPER_NEUE_ERSTE), `Der Satz zur neuen ersten fehlt: ${k.text.slice(0, 600)}`);
			behaupte(!k.text.includes(AUSKLAPPER_ZWEITE), 'Der Satz zur zweiten nach L16 steht, obwohl die Versammlung beschlussfähig ist');
			return k.ueberschrift;
		});
		await schritt('Vertagt auf Beschluss: Meldung nennt die neue erste', async () => {
			const meldung = await vertage(v, GRUND_BESCHLOSSEN);
			await ablegen('fall3-meldung', meldung);
			behaupte(meldung.includes(MELDUNG_NEUE_ERSTE), `Keine Meldung zur neuen ersten: ${meldung.slice(0, 600)}`);
			return 'neue erste gemeldet';
		});
		await schritt('Folgeversammlung: erste, ohne Vorgängerin', async () => {
			const a = await angabenVon(await folgeVon(g, v));
			behaupte(a.stufe === 'erste', `Stufe «${a.stufe}»: ${a.kopf}`);
			behaupte(!a.vorgaenger, `Vorgängerin gesetzt: ${a.vorgaenger}`);
			return `Stufe ${a.stufe}, ohne Vorgängerin, ${a.datum}`;
		});
	});

	/**
	 * L15: Höchstzahl 1, Anna mit eigener Wohnung und in der gemeinsamen Partei
	 * mit Beat, Vollmacht für Cla erfasst; am Einlass für die gemeinsame Partei.
	 * Zurück kommen der Text nach dem Einlass und die Zeile der gemeinsamen Partei.
	 */
	async function lageL15(kuerzel, datum, wahl) {
		const [ANNA, BEAT, CLA, DORA] = ['Anna', 'Beat', 'Cla', 'Dora'].map((n) => `Erfunden ${n} ${kuerzel} ${LAUF}`);
		const GEMEINSAM = `${ANNA} und ${BEAT}`;
		let g;
		let v;
		await schritt('Gemeinschaft: Anna, Cla, Dora mit je einer Wohnung', async () => {
			g = await legeGemeinschaftAn(kuerzel, [
				[ANNA, '250'],
				[CLA, '250'],
				[DORA, '250']
			]);
			return g.slice(0, 8);
		});
		await schritt('Whg 4 an der gemeinsamen Partei «Anna und Beat», Anna als bestehende Person', async () => {
			await legeEinheitAn(g, 'Whg 4', '250');
			await gehe(`/gemeinschaften/${g}/eigentuemer`);
			const f = seite.locator('form[action="?/anlegen"]').first();
			await f.locator('input[name="displayName"]').fill(GEMEINSAM);
			await f.locator('input[name="eigentumsform"][value="gemeinschaftlich"]').check();
			await seite.waitForTimeout(200);
			await f.locator('select[name="mitberechtigterWahl"]').first().selectOption('bestehend');
			await seite.waitForTimeout(200);
			await waehleNachAnfang(f.locator('select[name="mitberechtigterPersonId"]').first(), ANNA);
			await f.locator('input[name="mitberechtigterName"]:not([type="hidden"])').first().fill(BEAT);
			await f.locator('input[name="vertreter"]').first().check();
			await abschicken(f.locator('button[type="submit"]').first());
			await ordneZu(g, 'Whg 4', GEMEINSAM);
			await gehe(`/gemeinschaften/${g}/eigentuemer`);
			const text = await seitentext();
			behaupte(text.includes(GEMEINSAM), `Die gemeinsame Partei fehlt: ${text.slice(0, 800)}`);
			return GEMEINSAM.replaceAll(` ${kuerzel} ${LAUF}`, '');
		});
		await schritt('Höchstzahl der Vollmachten 1, mit Fundstelle', async () => {
			await gehe(`/gemeinschaften/${g}/angaben`);
			await seite.locator('input[name="proxyLimit"]').fill('1');
			await seite.locator('input[name="proxyLimitRuleSource"]').fill('Art. 8 Abs. 2 Reglement (erfunden)');
			await abschicken(seite.locator('form[action="?/speichern"] button[type="submit"]').first());
			await gehe(`/gemeinschaften/${g}/angaben`);
			const steht = await seite.locator('input[name="proxyLimit"]').inputValue();
			behaupte(steht === '1', `Höchstzahl «${steht}» statt 1`);
			return '1';
		});
		await schritt(wahl ? `L15 vor der Freigabe auf «${wahl}»` : 'L15 bleibt auf der Vorgabe', async () => {
			if (wahl) await stelleUm(g, 'L15', wahl);
			const steht = await gewaehlt(g, 'L15');
			behaupte(steht === (wahl ?? 'ausserhalb'), `L15 steht auf «${steht}»`);
			return steht;
		});
		await schritt(`Versammlung am ${datum}, freigegeben, eröffnet`, async () => {
			v = await legeVersammlungAn(g, datum);
			return v.slice(0, 8);
		});
		await schritt('Gewöhnliche Vollmacht: Anna vertritt Cla', async () => {
			await gehe(`/versammlungen/${v}/vollmachten`);
			const form = seite.locator('form[action="?/erfassen"]').first();
			behaupte(await form.count(), `Kein Formular «Vollmacht erfassen»: ${(await seitentext()).slice(0, 400)}`);
			await form.locator('input[name="art"][value="eigentuemer"]').check();
			await seite.waitForTimeout(200);
			// Genau Anna, nicht die gemeinsame Partei, deren Name mit ihrem beginnt (Codeprüfung N3).
			const auswahl = form.locator('select[name="bevollmaechtigt"]');
			const annaWert = await auswahl.locator('option').evaluateAll(
				(os, name) => os.find((o) => (o.textContent ?? '').trim() === name)?.value ?? null,
				ANNA
			);
			behaupte(annaWert, `Anna steht unter «Wer» nicht für sich allein zur Wahl`);
			await auswahl.selectOption(annaWert);
			const eintrag = form.locator('ul.liste li', { hasText: CLA }).first();
			behaupte(await eintrag.count(), `${CLA} steht unter «Vollmacht für» nicht zur Wahl`);
			await eintrag.locator('input[name="vertritt"]').check();
			await abschicken(form.locator('button[type="submit"].haupt').first());
			await gehe(`/versammlungen/${v}/vollmachten`);
			const karte = seite.locator('article.vollmacht', { hasText: CLA }).first();
			behaupte(await karte.count(), `Die Vollmacht für Cla steht nicht in der Liste: ${(await seitentext()).slice(0, 600)}`);
			const text = sauber(await karte.innerText());
			behaupte(
				text.includes(ANNA) && !text.includes(GEMEINSAM),
				`Die Vollmacht für Cla trägt nicht Anna allein: ${text.slice(0, 300)}`
			);
			return 'erfasst';
		});
		let nachher;
		await schritt('Einlass: Anna kommt und führt die Stimme der gemeinsamen Partei', async () => {
			await gehe(`/versammlungen/${v}/anwesenheit`);
			await seite.locator('details.vonhand summary').click();
			const formular = seite.locator('details.vonhand form');
			const wer = formular.locator('label.wer');
			await wer.locator('input[type="search"]').fill(ANNA);
			await seite.waitForTimeout(300);
			const anna = wer.locator('li', { hasText: 'Whg 1' }).locator('input[name="partei"]');
			behaupte(await anna.count(), `Anna steht nicht unter «Wer trifft ein»: ${sauber(await wer.innerText()).slice(0, 400)}`);
			await anna.first().check();
			const block = formular.locator('.wahl');
			await block.locator('input[type="checkbox"]').first().check();
			await block.locator('input[type="search"]').fill(GEMEINSAM);
			await seite.waitForTimeout(300);
			const huelle = block.locator('li', { hasText: GEMEINSAM }).locator('input[name="vertritt"]:not([disabled])');
			behaupte(await huelle.count(), `Die gemeinsame Partei ist nicht wählbar: ${sauber(await block.innerText()).slice(0, 400)}`);
			await huelle.first().check();
			await abschicken(formular.locator('button[type="submit"]').first());
			nachher = await seitentext();
			await ablegen(`${kuerzel.toLowerCase()}-einlass`, nachher);
			return 'abgeschickt';
		});
		let zeile;
		let liste;
		await schritt('Anwesenheitsliste nach dem Einlass gelesen', async () => {
			await gehe(`/versammlungen/${v}/anwesenheit`);
			liste = await seitentext();
			// Die Zeile der gemeinsamen Partei an ihrer Wohnung: Annas eigene Zeile trägt den
			// Namen der gemeinsamen Partei mit («bevollmächtigt für …», erster Lauf 16.11.2026).
			const z = seite.locator('tr', { hasText: GEMEINSAM }).filter({ hasText: 'Whg 4' });
			behaupte(await z.count(), `Die Zeile der gemeinsamen Partei (Whg 4) fehlt: ${liste.slice(0, 600)}`);
			zeile = sauber(await z.first().innerText());
			return liste.match(/\d+ von \d+ Parteien anwesend/)?.[0] ?? '';
		});
		return { nachher, zeile, liste };
	}

	await fall('Fall 4: L15 Vorgabe «Zählt nicht mit»: Einlass angenommen', async () => {
		const l = await lageL15('F4', '2027-11-05', null);
		await schritt('Angenommen: Anna anwesend, die gemeinsame Partei vertreten', async () => {
			behaupte(!l.nachher.includes(ABSAGE_L15), `Abgewiesen nach L15: ${l.nachher.slice(0, 600)}`);
			behaupte(/ist als anwesend erfasst/.test(l.nachher), `Keine Quittung des Einlasses: ${l.nachher.slice(0, 600)}`);
			behaupte(
				/anwesend durch Vertretung/.test(l.zeile) && /vertreten durch/.test(l.zeile),
				`Die gemeinsame Partei steht nicht als vertreten da: ${l.zeile.slice(0, 300)}`
			);
			return l.zeile.slice(0, 160);
		});
	});

	await fall('Fall 5: L15 «Zählt mit»: Einlass abgewiesen', async () => {
		const l = await lageL15('F5', '2027-11-06', ROTPROBE === 'L15' ? null : 'mitzaehlen');
		await schritt('Abgewiesen mit dem Satz zur Stimmführung, niemand eingelassen', async () => {
			behaupte(l.nachher.includes(ABSAGE_L15), `Keine Absage nach L15: ${l.nachher.slice(0, 900)}`);
			behaupte(!/ist als anwesend erfasst/.test(l.nachher), 'Quittung des Einlasses trotz Absage');
			behaupte(/0 von 4 Parteien anwesend/.test(l.liste), `Nach der Absage ist jemand anwesend: ${l.liste.slice(0, 400)}`);
			behaupte(
				/Whg 4/.test(l.zeile) && /nicht erschienen/.test(l.zeile),
				`Die gemeinsame Partei steht nicht als nicht erschienen da: ${l.zeile.slice(0, 300)}`
			);
			const satz = l.nachher.match(/[^.]*zählt dabei die Stimme mit[^.]*\./)?.[0] ?? '';
			return satz.slice(0, 200);
		});
	});
}

await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
await browser.close();

const rot = faelle.filter((f) => !f.gruen);
console.log(`\n${nr} Schritte, ${faelle.length} Fälle, ${rot.length} rot.\n`);
for (const f of faelle) console.log(`  ${f.gruen ? '✓' : '✗'} ${f.titel}${f.gruen ? '' : `: ${f.text}`}`);
if (!angemeldet) {
	console.log('  ✗ Nicht angemeldet, kein Fall gefahren.');
	process.exit(1);
}
if (rot.length) process.exit(1);
console.log(`\nAlle Fälle grün. Aufnahmen in ${AUFNAHMEN}`);
