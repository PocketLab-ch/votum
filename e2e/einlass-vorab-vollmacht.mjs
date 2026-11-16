/**
 * Durchstich: Die Einlassmaske «Bevollmächtigte dritte Person» mit vorab
 * erfassten Vollmachten (E3, 11.11.2026). Eine Vollmacht, die unter
 * «Vollmachten» vorab an eine dritte Person erfasst wurde, sperrt die Partei
 * am Einlass für jede andere Person («bereits bevollmächtigt an …»), gibt sie
 * aber für dieselbe Person frei, mit dem Häkchen «Bevollmächtigt ist die
 * Verwaltung» vorbelegt. Der Name gilt unter dem Schlüssel von
 * `vollmachtsschluessel` (Rand, Leerzeichen, Gross-/Kleinschreibung).
 *
 * **Die Umsetzung liegt im Arbeitsbaum `versammlung-einlass-vollmacht`** (E3)
 * und ist auf dem Dev-Stapel erst nach der Übernahme da. Vorher läuft dieses
 * Drehbuch rot, und das ist richtig: Es misst die Umsetzung, nicht den Stand
 * von `main`.
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern (Amsler, Brunner,
 * Caflisch), L8 auf der Vorgabe «Vollmachten ruhen», eine Versammlung mit
 * einem Traktandum, freigegeben. Unter «Vollmachten» vorab erfasst, nicht
 * bestätigt: Brunner an «Prüfverwaltung Muster AG» und Caflisch an «Zweite
 * Verwaltung AG», je mit dem Häkchen «Bevollmächtigt ist die Verwaltung».
 * Dann wird die Versammlung eröffnet.
 *
 *   - Fall 2: Einlass aufgeklappt, Namensfeld leer: Brunner ausgegraut mit
 *     «bereits bevollmächtigt an Prüfverwaltung Muster AG».
 *   - Fall 3 (Gegenprobe): «Erika Beispiel»: Brunner bleibt gesperrt, das
 *     Kästchen ist leer.
 *   - Fall 4: «prüfverwaltung  muster ag» (klein, doppeltes Leerzeichen):
 *     Brunner wählbar mit «Vollmacht auf diesen Namen erfasst», das Kästchen
 *     angekreuzt. Kästchen abgewählt, Brunner gewählt, abgesendet: Brunner
 *     anwesend durch Vertretung; unter Vollmachten bestätigt, mit dem Knopf
 *     «Als Verwaltung kennzeichnen» (die Kennzeichnung ist weg).
 *   - Fall 5: «Zweite Verwaltung AG», Kästchen unberührt (angekreuzt),
 *     Caflisch gewählt, abgesendet: Caflisch anwesend; unter Vollmachten
 *     bestätigt, mit dem Knopf «Kennzeichnung entfernen» (sie bleibt).
 *
 * Fall 1 ist das Vorerfassen selbst (Schritte «Vollmacht vorab …»).
 *
 * Weicht die Oberfläche ab, bleibt der Schritt rot; die Erwartung wird nicht
 * angepasst. Das Drehbuch legt alles selbst an. Die Namen beginnen mit
 * «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt sie mit. Mit gesetztem
 * `ZIEL` läuft es unverändert gegen den Betrieb:
 *
 *     node e2e/einlass-vorab-vollmacht.mjs
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { appendFile, mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter, abgefangen, ergebnisart } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-einlass-vorab-vollmacht';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const NAME = `Prüflauf Einlass vorab ${LAUF}`;
const LEUTE = ['Amsler', 'Brunner', 'Caflisch'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['400', '300', '300'];
const [AMSLER, BRUNNER, CAFLISCH] = LEUTE;
/** Erfunden. */
const VERWALTUNG = 'Prüfverwaltung Muster AG';
const ZWEITE = 'Zweite Verwaltung AG';
const FREMD = 'Erika Beispiel';
/** Klein und mit doppeltem Leerzeichen: derselbe Schlüssel wie `VERWALTUNG` (`vollmachtsschluessel`, src/lib/domain/vollmacht.ts:821). */
const VERWALTUNG_GETIPPT = 'prüfverwaltung  muster ag';

// ── Erwartete Zeichenketten, je mit Fundstelle (Arbeitsbaum versammlung-einlass-vollmacht) ──

/** `bereits bevollmächtigt an ${schon}` (src/routes/versammlungen/[id=kennung]/anwesenheit/+page.server.ts:328). */
const gesperrtAn = (wer) => `bereits bevollmächtigt an ${wer}`;
/** Hinweis in der Auswahl, wenn der Name zur vorab erfassten Vollmacht passt (src/lib/components/VollmachtFuer.svelte, Zweig `name !== undefined && p.vorabFuer`). */
const HINWEIS_FREI = 'Vollmacht auf diesen Namen erfasst';
/** Beschriftung des Kästchens (anwesenheit/+page.svelte:985). */
const HAKEN_TEXT = 'Bevollmächtigt ist die Verwaltung';
/** Knöpfe unter «Vollmachten» (vollmachten/+page.svelte:303 und :307, :404 und :408). */
const KNOPF_KENNZEICHNEN = 'Als Verwaltung kennzeichnen';
const KNOPF_ENTFERNEN = 'Kennzeichnung entfernen';
/** Quittung des Einlasses (anwesenheit/+page.server.ts:529): «<Name> vertritt <Parteien> …, als anwesend erfasst», wobei der Name der der Vollmacht sein kann */
const quittungsanfang = (_name, wen) => `vertritt ${wen}`;
const QUITTUNG_ENDE = 'als anwesend erfasst';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

const sauber = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/*
 * `devalue` packt Aktionsantworten als `[ {…}, … ]`: Zahlen sind Indizes in
 * dieselbe Liste. Wie `aktionsfelder` in `folgeantrag-nach-rueckkommen.mjs`.
 */
function aktionsfelder(rohtext) {
	let d;
	try {
		d = JSON.parse(rohtext);
	} catch {
		return null;
	}
	let roh = d?.data;
	if (typeof roh === 'string') {
		try {
			roh = JSON.parse(roh);
		} catch {
			return null;
		}
	}
	if (!Array.isArray(roh) || typeof roh[0] !== 'object' || roh[0] === null) {
		return typeof roh === 'object' && roh !== null ? roh : null;
	}
	const aufloesen = (v) => {
		if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < roh.length) {
			return v === 0 ? undefined : aufloesen(roh[v]);
		}
		if (Array.isArray(v)) return v.map(aufloesen);
		if (v && typeof v === 'object') {
			const o = {};
			for (const [k, x] of Object.entries(v)) o[k] = aufloesen(x);
			return o;
		}
		return v;
	};
	return aufloesen(roh[0]) ?? null;
}

/**
 * Ein Formular abschicken und warten. Gibt die Absage des Servers zurück
 * (`{ art, text }`) oder `null`; `streng` bricht bei einer Absage ab. Eine
 * Absage über `fail()` kommt unter `use:enhance` als HTTP 200 mit
 * `type: 'failure'` (`absendung.mjs`).
 */
async function abschicken(knopf, { streng = true } = {}) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 }).catch(() => null),
		knopf.click()
	]);
	let absage = null;
	if (antwort && abgefangen(antwort)) {
		const art = await ergebnisart(antwort);
		if (art === 'failure' || art === 'error') {
			const rumpf = await antwort.text().catch(() => '');
			const felder = aktionsfelder(rumpf);
			absage = { art, text: sauber(felder?.fehler?.nachricht ?? felder?.nachricht ?? rumpf) };
		}
	} else if (antwort && antwort.status() >= 400) {
		absage = { art: String(antwort.status()), text: '' };
	}
	await nachAbsendung(seite, antwort, nachladen, 300);
	if (absage && streng) throw new Error(`Der Server wies das Formular ab (${absage.art}): ${absage.text.slice(0, 500)}`);
	return absage;
}

/** Was die Seite zeigte, für den Bericht; die Behauptungen stehen im Schritt. */
async function beleg(titel, text) {
	await appendFile(`${AUFNAHMEN}/belege.txt`, `\n=== ${titel} ===\n${text}\n`).catch(() => {});
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

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
}


// ── Bausteine dieses Drehbuchs ─────────────────────────────────────────────

/** Bis die Bedingung gilt oder die Frist um ist: Die Maske rechnet nach dem Tippen im Browser nach. */
async function warteBis(fn, text, frist = 5000) {
	const bis = Date.now() + frist;
	while (Date.now() < bis) {
		if (await fn()) return;
		await new Promise((f) => setTimeout(f, 100));
	}
	throw new Error(text);
}

async function legeVersammlungAn(gemeinschaft, datum, titel, wortlaut) {
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

	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill(titel);
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]').first().fill(wortlaut);
	await tf.locator('select[name="erfordernis"]').selectOption('k-decharge');
	await abschicken(tf.locator('button[type="submit"]').first());

	await gehe(`/versammlungen/${versammlung}/freigabe`);
	await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
	behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
	return versammlung;
}

/**
 * Fall 1: Eine Vollmacht vorab unter «Vollmachten» erfassen
 * (vollmachten/+page.svelte, Formular `?/erfassen`): dritte Person, Name,
 * Häkchen «Bevollmächtigt ist die Verwaltung», die Partei unter «Vollmacht
 * für». Die Vollmacht bleibt unbestätigt (kein Nachweis, kein Bestätigen).
 */
async function erfasseVorab(versammlung, wer, bevollmaechtigter) {
	await gehe(`/versammlungen/${versammlung}/vollmachten`);
	const form = seite.locator('form[action="?/erfassen"]').first();
	behaupte(await form.count(), `Kein Formular «Vollmacht erfassen»: ${(await seitentext()).slice(0, 400)}`);
	await form.locator('input[name="art"][value="dritte"]').check();
	await seite.waitForTimeout(200);
	await form.locator('input[name="bevollmaechtigtName"]').fill(bevollmaechtigter);
	const haken = form.locator('input[name="istVerwaltung"]');
	behaupte(await haken.count(), 'Kein Häkchen «Bevollmächtigt ist die Verwaltung» im Formular «Vollmacht erfassen»');
	await haken.check();
	const eintrag = form.locator('ul.liste li', { hasText: wer }).first();
	behaupte(await eintrag.count(), `${wer} steht unter «Vollmacht für» nicht zur Wahl`);
	await eintrag.locator('input[name="vertritt"]').check();
	await abschicken(form.locator('button[type="submit"].haupt').first());

	await gehe(`/versammlungen/${versammlung}/vollmachten`);
	const karte = seite.locator('article.vollmacht', { hasText: wer }).first();
	behaupte(await karte.count(), `Die Vollmacht für ${wer} steht nicht in der Liste: ${(await seitentext()).slice(0, 500)}`);
	const text = sauber(await karte.innerText());
	behaupte(text.includes(bevollmaechtigter), `Die Vollmacht für ${wer} trägt ${bevollmaechtigter} nicht: ${text.slice(0, 300)}`);
	behaupte(
		!(await seite.locator('article.vollmacht.wirksam', { hasText: wer }).count()),
		`Die Vollmacht für ${wer} ist schon wirksam, sie sollte vorab unbestätigt sein`
	);
	behaupte(/· Verwaltung/.test(text), `Die Vollmacht für ${wer} trägt die Kennzeichnung «Verwaltung» nicht: ${text.slice(0, 300)}`);
}

/** Die Einlassmaske «Bevollmächtigte dritte Person» aufklappen. */
async function einlassMaske(versammlung) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	await seite.locator('details.dritte summary').click();
	const form = seite.locator('details.dritte form');
	behaupte(await form.count(), 'Das Formular «Bevollmächtigte dritte Person» fehlt');
	return form;
}

/** Der Eintrag einer Partei in «Vollmacht für …». */
const eintragVon = (form, wer) => form.locator('ul.liste li', { hasText: wer }).first();

/** Die Vollmacht einer Partei unter «Vollmachten», wirksam, mit Text und Knöpfen. */
async function wirksameVollmacht(versammlung, wer) {
	await gehe(`/versammlungen/${versammlung}/vollmachten`);
	const karte = seite.locator('article.vollmacht.wirksam', { hasText: wer }).first();
	behaupte(await karte.count(), `Die Vollmacht für ${wer} ist nicht bestätigt: ${(await seitentext()).slice(0, 500)}`);
	return {
		karte,
		text: sauber(await karte.innerText()),
		kennzeichnen: await karte.locator('button', { hasText: KNOPF_KENNZEICHNEN }).count(),
		entfernen: await karte.locator('button', { hasText: KNOPF_ENTFERNEN }).count()
	};
}

// ── Lauf ───────────────────────────────────────────────────────────────────

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nEinlass einer dritten Person mit vorab erfassten Vollmachten (E3): ${ZIEL}\n`);

try {
	let gemeinschaft;
	let v;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 }).catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Gemeinschaft mit drei Eigentümern, L8 auf der Vorgabe «Vollmachten ruhen»', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
		behaupte(gemeinschaft && gemeinschaft !== 'neu', `Nicht angelegt: ${seite.url()}`);

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

		// Die Vorgabe von L8 ist «ruhen» (`VORGABEN.L8`, src/lib/domain/lesarten.ts); nichts umstellen.
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L8"][value="ruhen"]').isChecked(),
			'L8 steht nicht auf der Vorgabe «Vollmachten ruhen»'
		);
		return '400 + 300 + 300 von 1000, L8 «Vollmachten ruhen»';
	});

	await schritt('Versammlung mit einem Traktandum, freigegeben', async () => {
		v = await legeVersammlungAn(gemeinschaft, '2027-05-20', 'Jahresrechnung 2026', 'Die Jahresrechnung 2026 wird genehmigt.');
		return 'k-decharge, freigegeben';
	});

	await schritt('Fall 1: Vollmacht für Brunner vorab an «Prüfverwaltung Muster AG», mit Häkchen, nicht bestätigt', async () => {
		await erfasseVorab(v, BRUNNER, VERWALTUNG);
		return 'erfasst, unbestätigt, Kennzeichnung «Verwaltung»';
	});

	await schritt('Fall 1: Vollmacht für Caflisch vorab an «Zweite Verwaltung AG», mit Häkchen, nicht bestätigt', async () => {
		await erfasseVorab(v, CAFLISCH, ZWEITE);
		return 'erfasst, unbestätigt, Kennzeichnung «Verwaltung»';
	});

	await schritt('Versammlung eröffnet', async () => {
		await gehe(`/versammlungen/${v}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${v}/anwesenheit`);
		behaupte(await seite.locator('details.dritte summary').count(), `Der Einlass für dritte Personen fehlt: ${(await seitentext()).slice(0, 400)}`);
	});

	await schritt('Fall 2: Namensfeld leer: Brunner ausgegraut mit «bereits bevollmächtigt an Prüfverwaltung Muster AG»', async () => {
		const form = await einlassMaske(v);
		behaupte(
			(await form.locator('input[name="bevollmaechtigtName"]').inputValue()) === '',
			'Das Namensfeld ist nicht leer'
		);
		const b = eintragVon(form, BRUNNER);
		behaupte(await b.count(), `Brunner steht in «Vollmacht für» nicht: ${sauber(await form.innerText()).slice(0, 500)}`);
		behaupte(await b.locator('input[name="vertritt"]').isDisabled(), 'Brunner ist wählbar, obwohl vorab bevollmächtigt');
		const t = sauber(await b.innerText());
		behaupte(t.includes(gesperrtAn(VERWALTUNG)), `Brunner trägt nicht «${gesperrtAn(VERWALTUNG)}»: ${t}`);
		behaupte(!t.includes(HINWEIS_FREI), `Brunner trägt den Hinweis «${HINWEIS_FREI}» ohne Namen: ${t}`);
		const c = eintragVon(form, CAFLISCH);
		behaupte(await c.locator('input[name="vertritt"]').isDisabled(), 'Caflisch ist wählbar, obwohl vorab bevollmächtigt');
		behaupte(sauber(await c.innerText()).includes(gesperrtAn(ZWEITE)), `Caflisch trägt nicht «${gesperrtAn(ZWEITE)}»`);
		behaupte(!(await eintragVon(form, AMSLER).locator('input[name="vertritt"]').isDisabled()), 'Amsler ist gesperrt, obwohl frei');
		return t;
	});

	await schritt('Fall 3 (Gegenprobe): «Erika Beispiel»: Brunner bleibt gesperrt, das Kästchen ist leer', async () => {
		const form = await einlassMaske(v);
		await form.locator('input[name="bevollmaechtigtName"]').fill(FREMD);
		await seite.waitForTimeout(500);
		const b = eintragVon(form, BRUNNER);
		behaupte(await b.locator('input[name="vertritt"]').isDisabled(), 'Brunner ist für eine fremde Person wählbar');
		const t = sauber(await b.innerText());
		behaupte(t.includes(gesperrtAn(VERWALTUNG)), `Brunner trägt nicht «${gesperrtAn(VERWALTUNG)}»: ${t}`);
		behaupte(!t.includes(HINWEIS_FREI), `Brunner trägt den Hinweis «${HINWEIS_FREI}» für eine fremde Person: ${t}`);
		const haken = form.locator('input[name="istVerwaltung"]');
		behaupte(sauber(await form.locator('label.verwaltungshaken').innerText()).includes(HAKEN_TEXT), `Das Kästchen «${HAKEN_TEXT}» fehlt`);
		behaupte(!(await haken.isChecked()), 'Das Kästchen ist für eine fremde Person angekreuzt');
		return 'gesperrt, Kästchen leer';
	});

	await schritt('Fall 4: «prüfverwaltung  muster ag»: Brunner wählbar, Hinweis, Kästchen angekreuzt', async () => {
		const form = await einlassMaske(v);
		await form.locator('input[name="bevollmaechtigtName"]').fill(VERWALTUNG_GETIPPT);
		const b = eintragVon(form, BRUNNER);
		await warteBis(
			async () => !(await b.locator('input[name="vertritt"]').isDisabled()),
			`Brunner bleibt für den Namen «${VERWALTUNG_GETIPPT}» gesperrt: ${sauber(await b.innerText())}`
		);
		const t = sauber(await b.innerText());
		behaupte(t.includes(HINWEIS_FREI), `Brunner trägt nicht «${HINWEIS_FREI}»: ${t}`);
		behaupte(!t.includes('bereits bevollmächtigt'), `Brunner trägt noch eine Sperre: ${t}`);
		const haken = form.locator('input[name="istVerwaltung"]');
		await warteBis(() => haken.isChecked(), 'Das Kästchen «Bevollmächtigt ist die Verwaltung» ist nicht angekreuzt');
		const vorher = await form.locator('input[name="istVerwaltungVorher"]').inputValue();
		behaupte(vorher === 'ja', `Das versteckte Feld istVerwaltungVorher steht auf «${vorher}», erwartet «ja»`);
		// Caflisch hängt an einem anderen Namen und bleibt gesperrt.
		behaupte(await eintragVon(form, CAFLISCH).locator('input[name="vertritt"]').isDisabled(), 'Caflisch ist für diesen Namen wählbar');
		return t;
	});

	await schritt('Fall 4: Kästchen abgewählt, Brunner gewählt, abgesendet: Brunner anwesend durch Vertretung', async () => {
		const form = await einlassMaske(v);
		await form.locator('input[name="bevollmaechtigtName"]').fill(VERWALTUNG_GETIPPT);
		const haken = form.locator('input[name="istVerwaltung"]');
		await warteBis(() => haken.isChecked(), 'Das Kästchen ist nicht vorbelegt');
		await haken.uncheck();
		const box = eintragVon(form, BRUNNER).locator('input[name="vertritt"]');
		await warteBis(async () => !(await box.isDisabled()), 'Brunner bleibt gesperrt');
		await box.check();
		await abschicken(form.locator('button[type="submit"]').first());
		const text = await seitentext();
		behaupte(
			text.includes(quittungsanfang(VERWALTUNG_GETIPPT, BRUNNER)) && text.includes(QUITTUNG_ENDE),
			`Keine Quittung des Einlasses für Brunner: ${text.slice(0, 600)}`
		);
		await gehe(`/versammlungen/${v}/anwesenheit`);
		const zeile = sauber(await seite.locator('tr', { hasText: BRUNNER }).first().innerText());
		behaupte(/vertreten durch/.test(zeile), `Brunner steht nicht als vertreten da: ${zeile.slice(0, 300)}`);
		behaupte(/anwesend/i.test(zeile), `Brunner steht nicht als anwesend da: ${zeile.slice(0, 300)}`);
		return zeile;
	});

	await schritt('Fall 4: Unter Vollmachten ist Brunners Vollmacht bestätigt, mit dem Knopf «Als Verwaltung kennzeichnen»', async () => {
		const k = await wirksameVollmacht(v, BRUNNER);
		behaupte(/Bestätigt/.test(k.text), `Die Vollmacht für Brunner ist nicht bestätigt: ${k.text.slice(0, 300)}`);
		behaupte(!/· Verwaltung/.test(k.text), `Die Vollmacht für Brunner trägt noch die Kennzeichnung «Verwaltung»: ${k.text.slice(0, 300)}`);
		behaupte(k.kennzeichnen === 1, `Der Knopf «${KNOPF_KENNZEICHNEN}» fehlt an Brunners Vollmacht`);
		behaupte(k.entfernen === 0, `Der Knopf «${KNOPF_ENTFERNEN}» steht an Brunners Vollmacht`);
		return 'bestätigt, ohne Kennzeichnung';
	});

	await schritt('Fall 5: «Zweite Verwaltung AG», Kästchen unberührt (angekreuzt), Caflisch gewählt, abgesendet', async () => {
		const form = await einlassMaske(v);
		await form.locator('input[name="bevollmaechtigtName"]').fill(ZWEITE);
		const c = eintragVon(form, CAFLISCH);
		await warteBis(
			async () => !(await c.locator('input[name="vertritt"]').isDisabled()),
			`Caflisch bleibt für den Namen «${ZWEITE}» gesperrt: ${sauber(await c.innerText())}`
		);
		behaupte(sauber(await c.innerText()).includes(HINWEIS_FREI), `Caflisch trägt nicht «${HINWEIS_FREI}»`);
		const haken = form.locator('input[name="istVerwaltung"]');
		await warteBis(() => haken.isChecked(), 'Das Kästchen «Bevollmächtigt ist die Verwaltung» ist nicht angekreuzt');
		await c.locator('input[name="vertritt"]').check();
		await abschicken(form.locator('button[type="submit"]').first());
		const text = await seitentext();
		behaupte(
			text.includes(quittungsanfang(ZWEITE, CAFLISCH)) && text.includes(QUITTUNG_ENDE),
			`Keine Quittung des Einlasses für Caflisch: ${text.slice(0, 600)}`
		);
		await gehe(`/versammlungen/${v}/anwesenheit`);
		const zeile = sauber(await seite.locator('tr', { hasText: CAFLISCH }).first().innerText());
		behaupte(/vertreten durch/.test(zeile) && /anwesend/i.test(zeile), `Caflisch steht nicht als anwesend durch Vertretung da: ${zeile.slice(0, 300)}`);
		return zeile;
	});

	await schritt('Fall 5: Unter Vollmachten ist Caflischs Vollmacht bestätigt, mit dem Knopf «Kennzeichnung entfernen»', async () => {
		const k = await wirksameVollmacht(v, CAFLISCH);
		behaupte(/Bestätigt/.test(k.text), `Die Vollmacht für Caflisch ist nicht bestätigt: ${k.text.slice(0, 300)}`);
		behaupte(/· Verwaltung/.test(k.text), `Die Vollmacht für Caflisch trägt die Kennzeichnung «Verwaltung» nicht mehr: ${k.text.slice(0, 300)}`);
		behaupte(k.entfernen === 1, `Der Knopf «${KNOPF_ENTFERNEN}» fehlt an Caflischs Vollmacht`);
		behaupte(k.kennzeichnen === 0, `Der Knopf «${KNOPF_KENNZEICHNEN}» steht an Caflischs Vollmacht`);
		return 'bestätigt, Kennzeichnung bleibt';
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
