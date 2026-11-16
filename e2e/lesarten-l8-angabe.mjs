/**
 * Durchstich: Lesart L8, die Angabe der Sitzungsleitung am Folgeantrag
 * (Entscheid 0045, Punkt 11, Migration 185). Die Knöpfe «Angeben: andere
 * Verwaltung», «Angeben: Kündigung des Vertrags» und «Angabe zurücknehmen» an
 * der Leitung, gefahren über die Oberfläche: die Zählung, die Sperren und die
 * Protokollzeile. Die Grundfälle von L8 misst `e2e/lesarten-l8.mjs`, den Ausweg
 * über Folgeanträge (Punkt 9) `e2e/lesarten-l8-folgeantrag.mjs`.
 *
 * **Der Weg.** Eine Gemeinschaft mit fünf Eigentümern zu 250, 200, 200, 175
 * und 175 von 1000, Köpfe je Eigentümer, L8 auf der Vorgabe «Vollmachten
 * ruhen». Die Verwaltung (erfunden: «Prüfverwaltung Muster AG») hält die
 * Vollmachten von Dällenbach und Egger, mit dem Häkchen «Bevollmächtigt ist
 * die Verwaltung», bestätigt beim Einlass; Amsler, Brunner und Caflisch sind
 * selbst da. Alle Mehr sind einfache Mehr der Anwesenden und Vertretenen nach
 * Köpfen (`k-bewirtschaftung-waehlen`, `k-bewirtschaftung-abberufen`,
 * `k-verwaltung-gewoehnlich`): angenommen mit mehr als der Hälfte der
 * Bezugsgrösse. Niemand enthält sich.
 *
 * Versammlung 1: Traktandum «Entlastung und Wiederwahl der Verwaltung» mit dem
 * Häkchen. Nach der Freigabe am Abend:
 *
 *   - Folgeantrag zur Wiederwahl, 3 Ja (Amsler, Verwaltung für Dällenbach und
 *     Egger) zu 2 Nein: angenommen. Am Verwaltungsknoten gibt es keinen Knopf.
 *   - Folgeantrag «Entschädigung der gewählten Verwaltung»
 *     (`k-verwaltung-gewoehnlich`), Angabe «andere Verwaltung» gedrückt: die
 *     Vollmachten zählen. Amsler Ja, Brunner und Caflisch Nein, die Verwaltung
 *     Ja: 3 Ja, 2 Nein, Bezugsgrösse 5, nötig 3, angenommen. Nach dem Durchgang
 *     ist kein Knopf mehr da.
 *   - Folgeantrag «Spesen der gewählten Verwaltung», Angabe gemacht und vor
 *     dem ersten Durchgang zurückgenommen: die Vollmachten ruhen. Amsler Ja,
 *     Brunner und Caflisch Nein: 1 Ja, 2 Nein, Bezugsgrösse 3, nötig 2,
 *     abgelehnt. Ohne die Angabe stünde es mit der Verwaltung Ja 3 zu 2.
 *
 * Versammlung 2, dieselbe Gemeinschaft: Traktandum «Kündigung des
 * Verwaltungsvertrags und Abberufung der Verwaltung» mit dem Häkchen und dem
 * Mehr `k-verwaltung-gewoehnlich`. Folgeantrag zur Abberufung: 1 Ja, 4 Nein,
 * nicht angenommen. Folgeantrag «Kündigung des Verwaltungsvertrags», Angabe
 * «Kündigung» gedrückt: Amsler, Brunner, Caflisch Ja, die Verwaltung Nein,
 * 3 Ja, 2 Nein von 5, nötig 3, angenommen, die zwei Nein gezählt.
 *
 * Das Protokoll trägt die Zeile zur Angabe an den Folgeanträgen «Entschädigung»
 * und «Kündigung», an «Spesen» keine.
 *
 * **Woher die Erwartungen stammen.** Die Wortlaute stehen unten je mit
 * Fundstelle im Code von `main` `6dc034a2`, gegen den es gebaut wurde. Die Zahlen sind
 * oben gerechnet, nicht von der Seite abgelesen. Weicht die Oberfläche ab,
 * bleibt der Schritt rot; die Erwartung wird nicht angepasst.
 *
 * Das Drehbuch legt alles selbst an und läuft auf leerem Bestand. Die Namen
 * beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt sie mit.
 * Mit gesetztem `ZIEL` läuft es unverändert gegen den Betrieb:
 *
 *     node e2e/lesarten-l8-angabe.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l8-angabe';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const NAME = `Prüflauf Lesart L8 Angabe ${LAUF}`;
const LEUTE = ['Amsler', 'Brunner', 'Caflisch', 'Dällenbach', 'Egger'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['250', '200', '200', '175', '175'];
const [AMSLER, BRUNNER, CAFLISCH, DAELLENBACH, EGGER] = LEUTE;
const SELBST_DA = [AMSLER, BRUNNER, CAFLISCH];
/** Erfunden; dieselbe Schreibweise in beiden Versammlungen. */
const VERWALTUNG = 'Prüfverwaltung Muster AG';

const GRUND1 = 'Entlastung und Wiederwahl der Verwaltung';
const WAHL = 'Wiederwahl für zwei Jahre';
const ENTSCHAEDIGUNG = 'Entschädigung der gewählten Verwaltung';
const SPESEN = 'Spesen der gewählten Verwaltung';
const GRUND2 = 'Kündigung des Verwaltungsvertrags und Abberufung der Verwaltung';
const ABBERUFUNG = 'Abberufung per 31.12.2027';
const KUENDIGUNG = 'Kündigung des Verwaltungsvertrags';
const FOLGETITEL = new Set([WAHL, ENTSCHAEDIGUNG, SPESEN, ABBERUFUNG, KUENDIGUNG]);

// ── Erwartete Wortlaute, je mit Fundstelle ─────────────────────────────────

/** `VERWALTUNG_RUEGE` (src/lib/domain/mehrhinweise.ts:863), Teil der Sätze an die Leitung. */
const RUEGE_ANFANG = 'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet';

/** `VERWALTUNG_RUHEN_LEITUNG` (mehrhinweise.ts:876), erster Satz; unter «ruhen» an einem Traktandum mit Häkchen. */
const RUHEN_LEITUNG =
	'Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. ' +
	'Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, ' +
	'wenn sie selbst da sind oder eine andere Person bevollmächtigt haben.';

/** Anfang von `verwaltungWahlTrotzHakenRuhen(true)` (mehrhinweise.ts), der Satz am Folgeantrag zur Wahl. */
const WAHL_LEITUNG_ANFANG =
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
	'Votum zählt sie hier, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen';

/**
 * `teilentschiedenSatz` (src/lib/domain/abstimmung.ts), Anfang: Die Versammlung
 * hat die Wahl im Folgeantrag angenommen (Satz an der Leitung des Grundantrags).
 */
const SPERRSATZ_ANFANG = 'Die Versammlung hat die Wahl der Verwaltung im Folgeantrag';

/** `sperreInWorten` (src/lib/server/abstimmung.ts), Art «vertreten», wegen Ausstand; L8 liest die Verwaltung als Ausstand. */
const ruhtSatz = (wer) =>
	`«${wer}» ist über «${VERWALTUNG}» vertreten, und die ist bei diesem Traktandum im Ausstand.`;

/** `VERWALTUNGSANGABE_KNOPF.andere_verwaltung.beschriftung` (mehrhinweise.ts:1219). */
const KNOPF_ANDERE = 'Angeben: andere Verwaltung';
/** `VERWALTUNGSANGABE_KNOPF.kuendigung.beschriftung` (mehrhinweise.ts:1226). */
const KNOPF_KUENDIGUNG = 'Angeben: Kündigung des Vertrags';
/** Knopf zum Zurücknehmen: `leitung/+page.svelte:2526` (`data-fokus="verwaltungsangabe:zurueck"`, Text «Angabe zurücknehmen»). */
const KNOPF_ZURUECK_TEXT = 'Angabe zurücknehmen';
/** Auslöser der Rückfrage: `marke="verwaltungsangabe:{grund}"` (`leitung/+page.svelte:2517`), als `data-fokus` am Knopf (`Rueckfrage.svelte:238`). */
const markeAngabe = (grund) => `button[data-fokus="verwaltungsangabe:${grund}"]`;
const MARKE_ZURUECK = 'button[data-fokus="verwaltungsangabe:zurueck"]';

/** Anfang von `verwaltungsangabeAngebot('andere_verwaltung', titel)` (mehrhinweise.ts:1190ff). */
const angebotAndere = (titel) => `Die Versammlung hat die Wahl im Folgeantrag «${titel}» angenommen.`;
/** Anfang von `verwaltungsangabeAngebot('kuendigung', titel)` (mehrhinweise.ts:1190ff). */
const angebotKuendigung = (titel) => `Die Versammlung hat die Abberufung im Folgeantrag «${titel}» nicht angenommen.`;

/** `VERWALTUNG_ANGABE_ANDERE_LEITUNG` (mehrhinweise.ts:1160), erster Satz. */
const ANDERE_LEITUNG_ANFANG =
	'Sie haben angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung betrifft. Votum ' +
	'lässt die Vollmachten der bisherigen Verwaltung hier deshalb nicht ruhen';
/** `VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG` (mehrhinweise.ts:1179), erster Satz. */
const KUENDIGUNG_LEITUNG_ANFANG =
	'Sie haben angegeben, dass es hier um die Kündigung des Vertrags nach der nicht angenommenen ' +
	'Abberufung geht.';

/** `VERWALTUNGSANGABE_GEMACHT` (mehrhinweise.ts:1258). */
const MELDUNG_GEMACHT = 'Die Angabe ist gemacht; die Vollmachten der Verwaltung ruhen bei diesem Antrag nicht von selbst.';
/** `VERWALTUNGSANGABE_ZURUECK` (mehrhinweise.ts:1260). */
const MELDUNG_ZURUECK = 'Die Angabe ist zurückgenommen; die Vollmachten der Verwaltung ruhen bei diesem Antrag wieder nach';

/** `VERWALTUNG_ANGABE_ANDERE_PROTOKOLL` (mehrhinweise.ts:1377). */
const ANDERE_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung ' +
	'betrifft. Anders als die Einladung angekündigt hatte, zählten die Vollmachten der bisherigen ' +
	'Verwaltung hier.';
/** `VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL` (mehrhinweise.ts:1387). */
const KUENDIGUNG_PROTOKOLL =
	'Die Sitzungsleitung hat angegeben, dass es bei diesem Antrag um die Kündigung des Vertrags der ' +
	'Verwaltung nach der nicht angenommenen Abberufung ging. Ob ihre Vollmachten dabei ruhen, ist wie bei ' +
	'der Abberufung nicht geklärt. Anders als die Einladung angekündigt hatte, zählten sie hier; die ' +
	'Sitzungsleitung hat ihren Ausstand nicht erklärt.';
/** Gemeinsamer Anfang aller Protokollzeilen zur Angabe (mehrhinweise.ts:1377 bis 1392). */
const ANGABE_PROTOKOLL_ANFANG = 'Die Sitzungsleitung hat angegeben, dass';

/** Rest der Ruhen-Zeile im Protokoll (`verwaltungsruhenProtokollInWorten`, src/lib/domain/auszaehlung.ts). */
const RUHEN_PROTOKOLL_ANFANG = 'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung.';

// ── Werkzeug ───────────────────────────────────────────────────────────────

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

/** Die Zeile im Baum der Leitung, am Titel verankert (wie `folgeantrag-nach-rueckkommen.mjs`). */
function baumzeile(titel) {
	const muster = new RegExp(`^\\s*${esc(titel)}(\\s|$)`);
	let treffer = seite.locator('.baum li').filter({ has: seite.locator('.titel', { hasText: muster }) });
	// «Kündigung des Verwaltungsvertrags» ist zugleich der Anfang des Titels des Grundantrags
	// in Versammlung 2: Für die Titel der Folgeanträge gilt nur die Zeile mit der Marke «Folgeantrag».
	if (FOLGETITEL.has(titel)) {
		treffer = treffer.filter({ has: seite.locator('.titel', { hasText: /Folgeantrag/ }) });
	}
	return treffer.first();
}

async function rufeAuf(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = baumzeile(titel);
	behaupte(await zeile.count(), `«${titel}» steht nicht im Baum der Leitung`);
	const knopf = zeile.locator('form[action="?/aufrufen"] button[type="submit"]');
	// Fehlt der Knopf, ist das Traktandum schon aufgerufen.
	if (await knopf.count()) await abschicken(knopf.first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const jetzt = sauber(await seite.locator('li.jetzt, .jetzt').first().innerText());
	behaupte(jetzt.includes(titel), `Aufgerufen ist etwas anderes: ${jetzt.slice(0, 160)}`);
}

/** Die Nummer einer Zeile im Baum, etwa «1.1». */
async function nummer(titel) {
	return sauber(await baumzeile(titel).locator('.nr').innerText());
}

/** Am aufgerufenen Grundantrag mit «Gegenantrag» einen Folgeantrag aufnehmen. */
async function nimmFolgeantragAuf(versammlung, grund, titel, wortlaut, knoten) {
	await rufeAuf(versammlung, grund);
	const eingriffe = seite.locator('.eingriffe').first();
	const wort = eingriffe.locator('button.wort', { hasText: 'Gegenantrag' });
	behaupte(await wort.count(), `Am Grundantrag «${grund}» fehlt unter «Jetzt möglich» der «Gegenantrag»`);
	await wort.first().click();
	await seite.waitForTimeout(200);
	const form = eingriffe.locator('form[action="?/aufnehmen"]');
	behaupte(await form.count(), 'Im Feld «Gegenantrag» steht kein Aufnahmeformular');
	await form.locator('input[name="titel"]').fill(titel);
	await form.locator('textarea[name="antragswortlaut"]').fill(wortlaut);
	await form.locator('select[name="erfordernis"]').selectOption(knoten);
	await abschicken(form.locator('button[type="submit"]').first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = baumzeile(titel);
	behaupte(await zeile.count(), `Der Folgeantrag «${titel}» steht nicht im Baum`);
	const titelText = sauber(await zeile.locator('.titel').innerText());
	behaupte(/Folgeantrag/.test(titelText), `Am Eintrag fehlt die Marke «Folgeantrag»: «${titelText}»`);
	const grundNr = await nummer(grund);
	const folgeNr = await nummer(titel);
	behaupte(
		new RegExp(`^${esc(grundNr)}\\.\\d+$`).test(folgeNr),
		`Der Folgeantrag ist kein Unterpunkt des Grundantrags: ${folgeNr} unter ${grundNr}`
	);
	return folgeNr;
}

/** Die Erfassungstabelle aufklappen und die Zeilen lesen. */
async function erfassungszeilen() {
	await seite.evaluate(() => {
		document.querySelectorAll('details:has(form[action="?/erfassen"])').forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
	const form = seite.locator('form[action="?/erfassen"]').first();
	behaupte(await form.count(), `Keine Stimmerfassung: ${(await seitentext()).slice(0, 300)}`);
	return form;
}

/**
 * Stimmen erfassen und nachmessen, dass sie ankamen. Mit Begründung, falls das
 * Feld da ist: In der geführten Betriebsart ist es Pflicht, und ohne es hält
 * der Browser das Absenden still an (`lesarten-l6.mjs`, 08.11.2026). Fünf
 * Parteien liegen nicht über `SCHWELLE_GEFUEHRT`; der Satz schadet nicht.
 */
async function erfasse(stimmen) {
	const form = await erfassungszeilen();
	const grund = form.locator('input[name="begruendung"]');
	if (await grund.count()) await grund.first().fill('Prüflauf: im Saal von Hand abgestimmt.');
	for (const [wer, wahl] of stimmen) {
		const radio = form.locator('tr', { hasText: wer }).first().locator(`input[type="radio"][value="${wahl}"]`).first();
		behaupte(await radio.count(), `In der Stimmerfassung fehlt die Zeile von ${wer}`);
		await radio.check();
	}
	await abschicken(form.locator('button[data-fokus="erfassen:alle"]').first());
	const text = await seitentext();
	const n = stimmen.length;
	behaupte(
		new RegExp(`${n} von ${n} haben abgestimmt`).test(text),
		`Die Erfassung kam nicht an: ${text.match(/\d+ von \d+ haben abgestimmt/)?.[0] ?? text.slice(0, 600)}`
	);
}

/** Die Ergebniskarte am Titel. */
async function ergebniskarte(titel) {
	const karte = seite
		.locator('article.ergebnis')
		.filter({ has: seite.locator('h4', { hasText: new RegExp(`^\\s*[\\d.]+\\s+${esc(titel)}(\\s|$)`) }) })
		.first();
	behaupte(await karte.count(), `Keine Ergebniskarte zu «${titel}»`);
	const ergebnis = {
		satz: sauber(await karte.locator('p.satz').innerText()),
		text: sauber(await karte.innerText())
	};
	await beleg(`Ergebniskarte ${titel}`, ergebnis.text);
	return ergebnis;
}

async function oeffne() {
	await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
}

async function schliesse(versammlung) {
	await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
	await gehe(`/versammlungen/${versammlung}/leitung`);
}

async function legeVersammlungAn(gemeinschaft, datum, titel, wortlaut, knoten) {
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
	await tf.locator('select[name="erfordernis"]').selectOption(knoten);
	const haken = tf.locator('input[name="verwaltungsGeschaeft"]');
	behaupte(await haken.count(), 'Das Häkchen «Geschäft der Verwaltung» fehlt im Formular');
	await haken.check();
	await abschicken(tf.locator('button[type="submit"]').first());

	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('[data-traktandum]', { hasText: titel }).first();
	behaupte(await zeile.count(), `Das Traktandum «${titel}» fehlt in der Liste`);
	behaupte(
		/Geschäft der Verwaltung/.test(sauber(await zeile.innerText())),
		`Das Häkchen am Traktandum ist nicht gesetzt: ${sauber(await zeile.innerText()).slice(0, 300)}`
	);

	await gehe(`/versammlungen/${versammlung}/freigabe`);
	await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
	behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
	return versammlung;
}

/** Eröffnen, die drei Selbstvertretenen bestätigen, die Verwaltung mit zwei Vollmachten einlassen. */
async function abendBeginnt(versammlung) {
	await gehe(`/versammlungen/${versammlung}`);
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
	for (const wer of SELBST_DA) {
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		const knopf = seite
			.locator('tr, li', { hasText: wer })
			.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])')
			.first();
		behaupte(await knopf.count(), `Kein Knopf «bestätigen» für ${wer}`);
		await abschicken(knopf);
	}

	// Der Einlass durch Dritte mit dem Häkchen der Verwaltung: Er erfasst die
	// Vollmachten, vermerkt das Original und bestätigt sie (`lasseDurchDritteEin`).
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	await seite.locator('details.dritte summary').click();
	const form = seite.locator('details.dritte form');
	await form.locator('input[name="bevollmaechtigtName"]').fill(VERWALTUNG);
	for (const wer of [DAELLENBACH, EGGER]) {
		const box = form.locator('label', { hasText: wer }).locator('input[name="vertritt"]').first();
		behaupte(await box.count(), `${wer} steht im Einlass nicht zur Wahl`);
		await box.check();
	}
	await form.locator('input[name="istVerwaltung"]').check();
	await abschicken(form.locator('button[type="submit"]').first());
	const quittung = await seitentext();
	behaupte(
		new RegExp(`${esc(VERWALTUNG)} vertritt [^—]*${esc(DAELLENBACH)}`).test(quittung) &&
			new RegExp(`${esc(VERWALTUNG)} vertritt [^—]*${esc(EGGER)}`).test(quittung),
		`Keine Quittung des Einlasses: ${quittung.slice(0, 500)}`
	);

	// Die Vollmachten stehen unter «Wirksam» (Zustand `bestaetigt`) und tragen
	// die Kennzeichnung «· Verwaltung» (vollmachten/+page.svelte).
	await gehe(`/versammlungen/${versammlung}/vollmachten`);
	for (const wer of [DAELLENBACH, EGGER]) {
		const karte = seite.locator('article.vollmacht.wirksam', { hasText: wer }).first();
		behaupte(await karte.count(), `Die Vollmacht für ${wer} ist nicht wirksam (bestätigt)`);
		const k = sauber(await karte.innerText());
		behaupte(
			k.includes(`${VERWALTUNG} bevollmächtigt für ${wer}`) && /Bestätigt .*· Verwaltung/.test(k),
			`Die Vollmacht für ${wer} trägt Inhaber oder Kennzeichnung nicht: ${k.slice(0, 300)}`
		);
	}

	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const atext = await seitentext();
	behaupte(/5 von 5|5 Parteien/.test(atext), `Nicht alle fünf anwesend: ${atext.slice(0, 400)}`);
}

async function protokollentwurf(versammlung) {
	await gehe(`/versammlungen/${versammlung}/protokoll`);
	const knopf = seite.locator('form[action="?/entwurf"] button[type="submit"]').first();
	behaupte(await knopf.count(), `Kein Knopf für den Entwurf: ${(await seitentext()).slice(0, 400)}`);
	await abschicken(knopf);
	const entwurf = await seite.locator('textarea[name="body"]').first().inputValue();
	await beleg(`Protokollentwurf ${versammlung}`, entwurf);
	return sauber(entwurf);
}

/** Ob ein Knopf mit diesem Text an der Leitung steht. */
async function knopfMitText(text) {
	return seite.locator('main button', { hasText: text }).count();
}

/** Aufgerufen ist (noch) dieses Traktandum: Schutz davor, dass eine fehlende Fläche als «kein Knopf» durchgeht. */
async function istAufgerufen(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const jetzt = sauber(await seite.locator('li.jetzt, .jetzt').first().innerText());
	behaupte(jetzt.includes(titel), `Aufgerufen ist etwas anderes als «${titel}»: ${jetzt.slice(0, 160)}`);
}

/** Die Angabe machen: Knopf, Rückfrage (vom Beobachter bestätigt), Rückmeldung. */
async function machAngabe(grund, meldung) {
	const knopf = seite.locator(markeAngabe(grund));
	behaupte(await knopf.count(), `Kein Knopf für die Angabe «${grund}»: ${(await seitentext()).slice(0, 600)}`);
	await abschicken(knopf.first());
	const text = await seitentext();
	behaupte(text.includes(meldung), `Die Rückmeldung zur Angabe fehlt: ${text.slice(0, 900)}`);
}

/** Der Abschnitt eines Beschlusses im Protokoll: von der Überschrift bis zur nächsten oder zum Ende. */
function abschnitt(entwurf, nr, titel, naechster) {
	const von = entwurf.lastIndexOf(`${nr} ${titel}`);
	behaupte(von >= 0, `Im Protokoll fehlt der Abschnitt ${nr} ${titel}`);
	const bis = naechster ? entwurf.indexOf(naechster, von + 1) : -1;
	return entwurf.slice(von, bis > von ? bis : undefined);
}

/** Die Ergebniskarte prüfen: Satzanfang, Köpfe, Bezugsgrösse. */
function pruefeKarte(karte, art, ja, nein, bezug, noetig) {
	behaupte(karte.satz.startsWith(art), `Erwartet «${art}», die Karte sagt: ${karte.satz.slice(0, 300)}`);
	behaupte(
		new RegExp(`${ja} ja · ${nein} nein · 0 Enthaltung · 0 ohne Abgabe`).test(karte.text),
		`Die Köpfe stimmen nicht (erwartet ${ja} ja, ${nein} nein): ${karte.text.slice(0, 600)}`
	);
	behaupte(
		new RegExp(`Bezugsgrösse ${bezug}, nötig ${noetig}`).test(karte.text),
		`Bezugsgrösse oder Schwelle stimmen nicht (erwartet ${bezug}, nötig ${noetig}): ${karte.text.slice(0, 600)}`
	);
}

// ── Lauf ───────────────────────────────────────────────────────────────────

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L8, Angabe der Leitung am Folgeantrag (Entscheid 0045, Punkt 11): ${ZIEL}\n`);

try {
	let gemeinschaft;
	let v1;
	let v2;
	let nrWahl;
	let nrEntschaedigung;
	let nrSpesen;
	let nrAbberufung;
	let nrKuendigung;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 }).catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Gemeinschaft mit fünf Eigentümern, L8 auf der Vorgabe «Vollmachten ruhen»', async () => {
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
		return '250 + 200 + 200 + 175 + 175 von 1000, L8 «Vollmachten ruhen»';
	});

	// ── Versammlung 1: andere Verwaltung ─────────────────────────────────────

	await schritt('Versammlung 1: ein Traktandum mit Häkchen (Entlastung und Wiederwahl), freigegeben', async () => {
		v1 = await legeVersammlungAn(
			gemeinschaft,
			'2027-05-20',
			GRUND1,
			'Die Verwaltung wird für das Rechnungsjahr 2026 entlastet und für zwei weitere Jahre wiedergewählt.',
			'k-decharge'
		);
		return 'Mehr der Entlastung (k-decharge), Häkchen gesetzt';
	});

	await schritt('Am Abend: drei selbst da, die Verwaltung mit zwei bestätigten Vollmachten', async () => {
		await abendBeginnt(v1);
		return `${VERWALTUNG} für Dällenbach und Egger, 5 von 5`;
	});

	await schritt('Folgeantrag zur Wiederwahl aufgenommen', async () => {
		nrWahl = await nimmFolgeantragAuf(
			v1,
			GRUND1,
			WAHL,
			'Die Verwaltung wird für zwei weitere Jahre wiedergewählt.',
			'k-bewirtschaftung-waehlen'
		);
		return `Folgeantrag ${nrWahl}`;
	});

	await schritt('K3: Am Folgeantrag zur Wiederwahl (Verwaltungsknoten) steht kein Knopf zur Angabe', async () => {
		await rufeAuf(v1, WAHL);
		const vorher = await seitentext();
		// Gegen eine leere Fläche: Der Satz zur Wahl steht da, also ist es die richtige Seite.
		behaupte(vorher.includes(WAHL_LEITUNG_ANFANG), `Der Satz zur Wahl am Folgeantrag fehlt: ${vorher.slice(0, 1200)}`);
		behaupte(!(await seite.locator(markeAngabe('andere_verwaltung')).count()), 'Am Verwaltungsknoten steht der Knopf «andere Verwaltung»');
		behaupte(!(await seite.locator(markeAngabe('kuendigung')).count()), 'Am Verwaltungsknoten steht der Knopf «Kündigung»');
		behaupte(!(await knopfMitText(KNOPF_ANDERE)), `Am Verwaltungsknoten steht ein Knopf «${KNOPF_ANDERE}»`);
		behaupte(!(await knopfMitText(KNOPF_ZURUECK_TEXT)), 'Am Verwaltungsknoten steht ein Knopf zum Zurücknehmen');
		return 'kein Knopf, Satz zur Wahl steht da';
	});

	await schritt('Wiederwahl: Amsler Ja, Brunner und Caflisch Nein, die Verwaltung für Dällenbach und Egger Ja, angenommen', async () => {
		await oeffne();
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'no'],
			[CAFLISCH, 'no'],
			[DAELLENBACH, 'yes'],
			[EGGER, 'yes']
		]);
		await schliesse(v1);
		pruefeKarte(await ergebniskarte(WAHL), 'Angenommen', 3, 2, 5, 3);
		return '3 Ja, 2 Nein, Bezugsgrösse 5, nötig 3';
	});

	await schritt('Folgeantrag «Entschädigung» (k-verwaltung-gewoehnlich) aufgenommen', async () => {
		nrEntschaedigung = await nimmFolgeantragAuf(
			v1,
			GRUND1,
			ENTSCHAEDIGUNG,
			'Die gewählte Verwaltung erhält eine Entschädigung von 12 000 Franken im Jahr.',
			'k-verwaltung-gewoehnlich'
		);
		return `Folgeantrag ${nrEntschaedigung}`;
	});

	await schritt('K1: Angabe «andere Verwaltung» gedrückt; die Vollmachten zählen, 3 Ja zu 2 Nein, angenommen', async () => {
		await rufeAuf(v1, ENTSCHAEDIGUNG);
		const vorher = await seitentext();
		behaupte(vorher.includes(RUHEN_LEITUNG), `Vor der Angabe fehlt der Satz zum Ruhen: ${vorher.slice(0, 1200)}`);
		behaupte(vorher.includes(angebotAndere(WAHL)), `Das Angebot «andere Verwaltung» fehlt: ${vorher.slice(0, 1500)}`);
		const knopf = seite.locator(markeAngabe('andere_verwaltung'));
		behaupte(await knopf.count(), `Kein Knopf «${KNOPF_ANDERE}»: ${vorher.slice(0, 800)}`);
		behaupte(sauber(await knopf.first().innerText()) === KNOPF_ANDERE, `Der Knopf trägt eine andere Beschriftung: ${sauber(await knopf.first().innerText())}`);
		behaupte(!(await seite.locator(markeAngabe('kuendigung')).count()), 'Es steht auch der Knopf «Kündigung» da, obwohl keine Abberufung abgelehnt ist');
		behaupte(!(await knopfMitText(KNOPF_ZURUECK_TEXT)), 'Vor der Angabe steht schon «Angabe zurücknehmen»');

		await machAngabe('andere_verwaltung', MELDUNG_GEMACHT);
		await gehe(`/versammlungen/${v1}/leitung`);
		const nachher = await seitentext();
		behaupte(nachher.includes(ANDERE_LEITUNG_ANFANG), `Nach der Angabe fehlt der Satz zur Angabe: ${nachher.slice(0, 1500)}`);
		behaupte(!nachher.includes(RUHEN_LEITUNG), 'Nach der Angabe steht noch der Satz, dass die Vollmachten ruhen');
		behaupte(await seite.locator(MARKE_ZURUECK).count(), 'Nach der Angabe fehlt «Angabe zurücknehmen»');
		behaupte(!(await seite.locator(markeAngabe('andere_verwaltung')).count()), 'Nach der Angabe steht der Knopf zur Angabe noch da');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(await form.locator('tr', { hasText: wer }).count(), `${wer} fehlt in der Erfassung; nach der Angabe zählt die Vollmacht`);
		}
		const offen = await seitentext();
		behaupte(!offen.includes(ruhtSatz(DAELLENBACH)), 'Der Satz zur ruhenden Vertretung steht trotz Angabe da');
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'no'],
			[CAFLISCH, 'no'],
			[DAELLENBACH, 'yes'],
			[EGGER, 'yes']
		]);
		await schliesse(v1);
		pruefeKarte(await ergebniskarte(ENTSCHAEDIGUNG), 'Angenommen', 3, 2, 5, 3);
		return `Folgeantrag ${nrEntschaedigung}, angenommen 3 zu 2 bei 5`;
	});

	await schritt('K3: Nach dem Durchgang ist am Folgeantrag «Entschädigung» kein Knopf zur Angabe und keiner zum Zurücknehmen', async () => {
		await istAufgerufen(v1, ENTSCHAEDIGUNG);
		await seite.locator('article.ergebnis', { hasText: ENTSCHAEDIGUNG }).first().waitFor({ timeout: 5000 });
		behaupte(!(await seite.locator(markeAngabe('andere_verwaltung')).count()), 'Nach dem Durchgang steht der Knopf zur Angabe da');
		behaupte(!(await seite.locator(markeAngabe('kuendigung')).count()), 'Nach dem Durchgang steht der Knopf «Kündigung» da');
		behaupte(!(await seite.locator(MARKE_ZURUECK).count()), 'Nach dem Durchgang steht «Angabe zurücknehmen» da');
		behaupte(!(await knopfMitText(KNOPF_ZURUECK_TEXT)), 'Nach dem Durchgang trägt ein Knopf den Text «Angabe zurücknehmen»');
		return 'kein Knopf zur Angabe, keiner zum Zurücknehmen';
	});

	await schritt('Folgeantrag «Spesen» (k-verwaltung-gewoehnlich) aufgenommen', async () => {
		nrSpesen = await nimmFolgeantragAuf(
			v1,
			GRUND1,
			SPESEN,
			'Die gewählte Verwaltung erhält Spesen bis zu 2 000 Franken im Jahr ersetzt.',
			'k-verwaltung-gewoehnlich'
		);
		return `Folgeantrag ${nrSpesen}`;
	});

	await schritt('K2: Angabe gemacht und vor dem ersten Durchgang zurückgenommen; die Vollmachten ruhen, 1 Ja zu 2 Nein, abgelehnt', async () => {
		await rufeAuf(v1, SPESEN);
		await machAngabe('andere_verwaltung', MELDUNG_GEMACHT);
		await gehe(`/versammlungen/${v1}/leitung`);
		const zurueck = seite.locator(MARKE_ZURUECK);
		behaupte(await zurueck.count(), 'Nach der Angabe fehlt «Angabe zurücknehmen»');
		behaupte(sauber(await zurueck.first().innerText()) === KNOPF_ZURUECK_TEXT, 'Der Knopf trägt eine andere Beschriftung');
		await abschicken(zurueck.first());
		const text = await seitentext();
		behaupte(text.includes(MELDUNG_ZURUECK), `Die Rückmeldung zum Zurücknehmen fehlt: ${text.slice(0, 900)}`);
		await gehe(`/versammlungen/${v1}/leitung`);
		const nachher = await seitentext();
		behaupte(nachher.includes(RUHEN_LEITUNG), `Nach dem Zurücknehmen fehlt der Satz zum Ruhen: ${nachher.slice(0, 1200)}`);
		behaupte(!nachher.includes(ANDERE_LEITUNG_ANFANG), 'Nach dem Zurücknehmen steht noch der Satz zur Angabe');
		behaupte(!(await seite.locator(MARKE_ZURUECK).count()), 'Nach dem Zurücknehmen steht noch «Angabe zurücknehmen»');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(!(await form.locator('tr', { hasText: wer }).count()), `${wer} steht in der Erfassung, obwohl die Vollmacht ruht`);
		}
		const offen = await seitentext();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(offen.includes(ruhtSatz(wer)), `Der Satz zur ruhenden Vertretung von ${wer} fehlt: ${offen.slice(0, 1500)}`);
		}
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'no'],
			[CAFLISCH, 'no']
		]);
		await schliesse(v1);
		pruefeKarte(await ergebniskarte(SPESEN), 'Abgelehnt', 1, 2, 3, 2);
		return `Folgeantrag ${nrSpesen}, abgelehnt 1 zu 2 bei 3; ohne Rücknahme wäre es 3 zu 2 bei 5`;
	});

	await schritt('K5: Das Protokoll trägt die Zeile zur Angabe an der Entschädigung, an den Spesen keine', async () => {
		const entwurf = await protokollentwurf(v1);
		const e = abschnitt(entwurf, nrEntschaedigung, ENTSCHAEDIGUNG, `${nrSpesen} ${SPESEN}`);
		behaupte(e.includes(ANDERE_PROTOKOLL), `Beim Folgeantrag «${ENTSCHAEDIGUNG}» fehlt die Zeile zur Angabe: ${e.slice(0, 1500)}`);
		const s = abschnitt(entwurf, nrSpesen, SPESEN, null);
		behaupte(!s.includes(ANGABE_PROTOKOLL_ANFANG), `Beim Folgeantrag «${SPESEN}» steht eine Zeile zur Angabe: ${s.slice(0, 1500)}`);
		behaupte(s.includes(RUHEN_PROTOKOLL_ANFANG), `Bei den Spesen fehlt die Tatsache, dass die Vollmachten ruhten: ${s.slice(0, 1500)}`);
		const w = abschnitt(entwurf, nrWahl, WAHL, `${nrEntschaedigung} ${ENTSCHAEDIGUNG}`);
		behaupte(!w.includes(ANGABE_PROTOKOLL_ANFANG), 'Bei der Wiederwahl steht eine Zeile zur Angabe');
		return 'Zeile bei Entschädigung, keine bei Spesen und Wiederwahl';
	});

	// ── Versammlung 2: Kündigung ─────────────────────────────────────────────

	await schritt('Versammlung 2: Kündigung und Abberufung in einem Traktandum, k-verwaltung-gewoehnlich, Häkchen, Abend', async () => {
		v2 = await legeVersammlungAn(
			gemeinschaft,
			'2027-09-15',
			GRUND2,
			'Der Verwaltungsvertrag wird auf den 31.12.2027 gekündigt, und die Verwaltung wird auf diesen Tag abberufen.',
			'k-verwaltung-gewoehnlich'
		);
		await abendBeginnt(v2);
		return 'Mehr der gewöhnlichen Verwaltung, Häkchen gesetzt; 5 von 5';
	});

	await schritt('Folgeantrag zur Abberufung aufgenommen', async () => {
		nrAbberufung = await nimmFolgeantragAuf(
			v2,
			GRUND2,
			ABBERUFUNG,
			'Die Verwaltung wird per 31.12.2027 abberufen.',
			'k-bewirtschaftung-abberufen'
		);
		return `Folgeantrag ${nrAbberufung}`;
	});

	await schritt('K3: Auch am Folgeantrag zur Abberufung (Verwaltungsknoten) steht kein Knopf zur Angabe', async () => {
		await rufeAuf(v2, ABBERUFUNG);
		const vorher = await seitentext();
		behaupte(vorher.includes(RUEGE_ANFANG), `Die Seite der Abberufung zeigt ihre Sätze nicht: ${vorher.slice(0, 1200)}`);
		behaupte(!(await seite.locator(markeAngabe('andere_verwaltung')).count()), 'An der Abberufung steht der Knopf «andere Verwaltung»');
		behaupte(!(await seite.locator(markeAngabe('kuendigung')).count()), 'An der Abberufung steht der Knopf «Kündigung»');
		return 'kein Knopf';
	});

	await schritt('K4: Abberufung: Amsler Ja, alle anderen Nein; 1 Ja, 4 Nein von 5, nicht angenommen', async () => {
		await oeffne();
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'no'],
			[CAFLISCH, 'no'],
			[DAELLENBACH, 'no'],
			[EGGER, 'no']
		]);
		await schliesse(v2);
		pruefeKarte(await ergebniskarte(ABBERUFUNG), 'Abgelehnt', 1, 4, 5, 3);
		return '1 Ja, 4 Nein, Bezugsgrösse 5, nötig 3';
	});

	await schritt('Folgeantrag «Kündigung des Verwaltungsvertrags» (k-verwaltung-gewoehnlich) aufgenommen', async () => {
		nrKuendigung = await nimmFolgeantragAuf(
			v2,
			GRUND2,
			KUENDIGUNG,
			'Der Verwaltungsvertrag wird auf den 31.12.2027 gekündigt.',
			'k-verwaltung-gewoehnlich'
		);
		return `Folgeantrag ${nrKuendigung}`;
	});

	await schritt('K4: Angabe «Kündigung» gedrückt; die Nein der Verwaltung zählen, 3 Ja zu 2 Nein, angenommen', async () => {
		await rufeAuf(v2, KUENDIGUNG);
		const vorher = await seitentext();
		behaupte(vorher.includes(RUHEN_LEITUNG), `Vor der Angabe fehlt der Satz zum Ruhen: ${vorher.slice(0, 1200)}`);
		behaupte(vorher.includes(angebotKuendigung(ABBERUFUNG)), `Das Angebot «Kündigung» fehlt: ${vorher.slice(0, 1500)}`);
		const knopf = seite.locator(markeAngabe('kuendigung'));
		behaupte(await knopf.count(), `Kein Knopf «${KNOPF_KUENDIGUNG}»: ${vorher.slice(0, 800)}`);
		behaupte(sauber(await knopf.first().innerText()) === KNOPF_KUENDIGUNG, `Der Knopf trägt eine andere Beschriftung: ${sauber(await knopf.first().innerText())}`);
		behaupte(!(await seite.locator(markeAngabe('andere_verwaltung')).count()), 'Es steht auch der Knopf «andere Verwaltung» da, obwohl keine Wahl angenommen ist');

		await machAngabe('kuendigung', MELDUNG_GEMACHT);
		await gehe(`/versammlungen/${v2}/leitung`);
		const nachher = await seitentext();
		behaupte(nachher.includes(KUENDIGUNG_LEITUNG_ANFANG), `Nach der Angabe fehlt der Satz zur Kündigung: ${nachher.slice(0, 1500)}`);
		behaupte(!nachher.includes(RUHEN_LEITUNG), 'Nach der Angabe steht noch der Satz, dass die Vollmachten ruhen');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(await form.locator('tr', { hasText: wer }).count(), `${wer} fehlt in der Erfassung; nach der Angabe zählt die Vollmacht`);
		}
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'yes'],
			[CAFLISCH, 'yes'],
			[DAELLENBACH, 'no'],
			[EGGER, 'no']
		]);
		await schliesse(v2);
		pruefeKarte(await ergebniskarte(KUENDIGUNG), 'Angenommen', 3, 2, 5, 3);
		return `Folgeantrag ${nrKuendigung}, angenommen 3 zu 2 bei 5, die zwei Nein der Verwaltung gezählt`;
	});

	await schritt('K3: Nach dem Durchgang ist am Folgeantrag «Kündigung» kein Knopf zur Angabe und keiner zum Zurücknehmen', async () => {
		await istAufgerufen(v2, KUENDIGUNG);
		await seite.locator('article.ergebnis', { hasText: KUENDIGUNG }).first().waitFor({ timeout: 5000 });
		behaupte(!(await seite.locator(markeAngabe('kuendigung')).count()), 'Nach dem Durchgang steht der Knopf zur Angabe da');
		behaupte(!(await seite.locator(MARKE_ZURUECK).count()), 'Nach dem Durchgang steht «Angabe zurücknehmen» da');
		behaupte(!(await knopfMitText(KNOPF_ZURUECK_TEXT)), 'Nach dem Durchgang trägt ein Knopf den Text «Angabe zurücknehmen»');
		return 'kein Knopf zur Angabe, keiner zum Zurücknehmen';
	});

	await schritt('K5: Das Protokoll trägt an der Kündigung die Zeile zur Angabe, an der Abberufung keine', async () => {
		const entwurf = await protokollentwurf(v2);
		const k = abschnitt(entwurf, nrKuendigung, KUENDIGUNG, null);
		behaupte(k.includes(KUENDIGUNG_PROTOKOLL), `Beim Folgeantrag «${KUENDIGUNG}» fehlt die Zeile zur Angabe: ${k.slice(0, 1500)}`);
		const a = abschnitt(entwurf, nrAbberufung, ABBERUFUNG, `${nrKuendigung} ${KUENDIGUNG}`);
		behaupte(!a.includes(ANGABE_PROTOKOLL_ANFANG), `Bei der Abberufung steht eine Zeile zur Angabe: ${a.slice(0, 1500)}`);
		return 'Zeile bei Kündigung, keine bei Abberufung';
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
