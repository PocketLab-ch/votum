/**
 * Durchstich: Lesart L8, der Ausweg über Folgeanträge (Entscheid 0045,
 * Punkt 9, samt «Beim Bau geklärt» und «Nach der Prüfung Runde 5 geklärt»;
 * Featureprüfung 2 zu F4c, Zeilen E45-9a bis E45-9g). Die Grundfälle von L8
 * (ruhen und leitung, die zwei Häkchen) misst `e2e/lesarten-l8.mjs`; hier nur
 * Punkt 9, an einer einzelnen Versammlung, nicht am gemeinsamen Abend (dort
 * ist das Abenddokument die offene Pendenz M1 der Featureprüfung 2).
 *
 * **Der Weg.** Eine Gemeinschaft mit fünf Eigentümern zu 250, 200, 200, 175
 * und 175 von 1000, Köpfe je Eigentümer, L8 auf der Vorgabe «Vollmachten
 * ruhen». Die Verwaltung (erfunden: «Prüfverwaltung Muster AG») hält die
 * Vollmachten von Dällenbach und Egger, mit dem Häkchen «Bevollmächtigt ist
 * die Verwaltung», bestätigt beim Einlass; Amsler, Brunner und Caflisch sind
 * selbst da. Alle Mehr sind einfache Mehr der Anwesenden und Vertretenen nach
 * Köpfen (`k-decharge`, `k-bewirtschaftung-waehlen`,
 * `k-bewirtschaftung-abberufen`, `k-verwaltung-gewoehnlich`, Regelwerk
 * 2026-07-30): angenommen mit mehr als der Hälfte der Bezugsgrösse. Niemand
 * enthält sich, deshalb zählt jede Fassung der Enthaltungen gleich.
 *
 * Versammlung 1: Ein Traktandum «Entlastung und Wiederwahl der Verwaltung»
 * mit Häkchen «Geschäft der Verwaltung» und dem Mehr der Entlastung; die
 * Verwaltung hat die Wiederwahl hineingeschrieben, statt aufzuteilen
 * (Punkt 9: «dann hat die Verwaltung schlecht gearbeitet»). Nach der
 * Freigabe teilt die Leitung am Abend mit «Gegenantrag» auf:
 *
 *   - **Folgeantrag zur Wiederwahl** (9a, E45-9a). Das geerbte Häkchen wirkt
 *     nicht, die Vollmachten zählen. Amsler Ja, Brunner und Caflisch Nein, die
 *     Verwaltung für Dällenbach und Egger Ja: 3 Ja, 2 Nein, Bezugsgrösse 5,
 *     nötig 3, **angenommen**. Ohne die zwei Stimmen der Verwaltung stünde
 *     es 1 zu 2 bei 3 und wäre abgelehnt: Hier entscheiden ihre Vollmachten.
 *   - Danach **sperrt Votum den Grundantrag** (9d, `teil_entschieden`): an
 *     der Leitung nur noch der Satz zur Sperre, das Freigeben abgewiesen.
 *   - **Folgeantrag zur Entlastung** (9b, E45-9b). Das geerbte Häkchen wirkt,
 *     die zwei Vollmachten ruhen: Dällenbach und Egger stehen nicht in der
 *     Erfassung, der Satz zur Sperre nennt sie. Alle drei Anwesenden Ja:
 *     3 Ja, Bezugsgrösse 3, nötig 2, **angenommen**. Die Grenzen nach
 *     Entscheid 0045, Punkt 2: mit beiden ruhenden Ja 5 von 5, mit beiden
 *     Nein 3 Ja zu 2 Nein von 5, nötig 3, beide angenommen, also «dasselbe
 *     Ergebnis». Dieselben zwei Vollmachten, die eben die Wahl entschieden
 *     haben, zählen hier nicht.
 *   - **Protokoll** (9e, E45-9e): beim Grundantrag beide Folgeanträge in
 *     der Folge ihrer Nummern, «Folgeantrag» und nirgends «Gegenantrag»,
 *     «gegenstandslos»; bei der Wahl die Zeile, dass die Vollmachten anders
 *     als angekündigt nicht ruhten; bei der Entlastung die Tatsache, dass sie
 *     für zwei Parteien ruhten.
 *
 * Versammlung 2, dieselbe Gemeinschaft (eine Abberufung gleich nach der
 * Wiederwahl am selben Abend wäre in der Sache widersinnig): Ein Traktandum
 * «Kündigung des Verwaltungsvertrags und Abberufung der Verwaltung» mit
 * Häkchen («ein Vertrag mit ihr») und dem Mehr der gewöhnlichen Verwaltung.
 *
 *   - **Am Grundantrag** weist Votum das Mehr «Bewirtschaftung abberufen»
 *     nach der Freigabe ab, mit dem Satz, der den Folgeantrag als Weg nennt
 *     (9g, E45-9g).
 *   - **Als Folgeantrag** nimmt es die Abberufung an (9c, E45-9c). Das
 *     Häkchen wirkt nicht von selbst, die Vollmachten zählen; der Satz an die
 *     Leitung empfiehlt keine Richtung und nennt die Abgabe des Vorsitzes.
 *     Die drei Anwesenden Ja, die Verwaltung für Dällenbach und Egger Nein:
 *     3 Ja, 2 Nein, Bezugsgrösse 5, nötig 3, **angenommen**; die zwei Nein
 *     sind gezählt.
 *   - Danach sperrt Votum den Grundantrag (9d, Art «Abberufung»), und das
 *     Protokoll nennt den Folgeantrag mit «gegenstandslos» und die Zeile zur
 *     Abberufung trotz Häkchen.
 *
 * **Woher die Erwartungen stammen.** Die Wortlaute stehen unten je mit
 * Fundstelle im Code von `main` `c05a4181`, auf dem der Dev-Stapel läuft, und
 * mit dem Fall im DB-Test `tests/db/lesart-verwaltungsvollmacht.test.ts`, der
 * sie belegt. Die Zahlen sind oben gerechnet, nicht von der Seite abgelesen.
 *
 * **Nur gegen den Dev-Stapel**, mit eigenen Gemeinschaften je Lauf:
 *
 *     node e2e/lesarten-l8-folgeantrag.mjs
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit.
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l8-folgeantrag';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const NAME = `Prüflauf Lesart L8 Folgeantrag ${LAUF}`;
const LEUTE = ['Amsler', 'Brunner', 'Caflisch', 'Dällenbach', 'Egger'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['250', '200', '200', '175', '175'];
const [AMSLER, BRUNNER, CAFLISCH, DAELLENBACH, EGGER] = LEUTE;
const SELBST_DA = [AMSLER, BRUNNER, CAFLISCH];
/** Erfunden; dieselbe Schreibweise in beiden Versammlungen. */
const VERWALTUNG = 'Prüfverwaltung Muster AG';

const GRUND1 = 'Entlastung und Wiederwahl der Verwaltung';
const WAHL = 'Wiederwahl für zwei Jahre';
const ENTLASTUNG = 'Entlastung Rechnungsjahr 2026';
const GRUND2 = 'Kündigung des Verwaltungsvertrags und Abberufung der Verwaltung';
const ABBERUFUNG = 'Abberufung per 31.12.2027';

// ── Erwartete Wortlaute, je mit Fundstelle (Code von `c05a4181`) ───────────

/** `VERWALTUNG_RUGE` (domain/mehrhinweise.ts), Teil der Sätze an die Leitung. */
const RUEGE_ANFANG = 'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet';

/** `VERWALTUNG_RUHEN_LEITUNG` (domain/mehrhinweise.ts), erster Satz; unter «ruhen» an einem Traktandum mit Häkchen. */
const RUHEN_LEITUNG =
	'Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. ' +
	'Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, ' +
	'wenn sie selbst da sind oder eine andere Person bevollmächtigt haben.';

/**
 * `verwaltungWahlTrotzHakenRuhen(true)` (domain/mehrhinweise.ts, Codeprüfung
 * P9, G-3): am Folgeantrag zur Wahl ohne die Anleitung zum Aufteilen. Belegt
 * im DB-Test durch `wahlTrotzHaekchen: true, amFolgeantrag: true` («zählt die
 * Vollmachten am Folgeantrag zur Wahl …»).
 */
const WAHL_LEITUNG_ANFANG =
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
	'Votum zählt sie hier, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen; ' +
	'sagen Sie das der Versammlung vor der Abstimmung. ' +
	'Votum prüft nicht, ob die Einladung die Wahl bei diesem Traktandum ankündigt; das prüfen Sie. ' +
	'Eine Erneuerung des Verwaltungsvertrags mit der bisherigen Verwaltung gilt in der Regel als ' +
	'Ankündigung der Wiederwahl. ' +
	'Kündigt sie sie nicht an, stimmen Sie diesen Folgeantrag nicht ab; die Wahl kommt auf eine ' +
	'spätere Versammlung.';
const WAHL_LEITUNG_SCHLUSS =
	'Beanstandet jemand, dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie trotzdem.';
/** Die Anleitung zum Aufteilen gehört nur an den Grundantrag (`verwaltungNurDieWahl`, Zweig ohne Folgeantrag). */
const ANLEITUNG_AUFTEILEN = 'Nehmen Sie dafür mit «Gegenantrag» einen Folgeantrag mit der Wahl auf';

/**
 * `teilentschiedenSatz` (domain/abstimmung.ts), Ergebnis angenommen; die
 * Absage `teil_entschieden` in `pruefeDurchgangsfreigabe` trägt denselben
 * Satz. DB-Test: «… sperrt den Grundantrag …», `toMatch(/im Folgeantrag
 * «Wiederwahl» angenommen/)`.
 */
function sperrsatz(art, titel) {
	const wahl = art === 'wahl';
	return (
		`Die Versammlung hat ${wahl ? 'die Wahl' : 'die Abberufung'} der Verwaltung im Folgeantrag ` +
		`«${titel}» angenommen. Über diesen Antrag stimmen Sie deshalb nicht mehr ab: Er enthält ` +
		`${wahl ? 'dieselbe Wahl' : 'dieselbe Abberufung'}. Ob danach noch ein Teil abzustimmen ist und ` +
		'welcher, hängt am Ergebnis; das steht im Handbuch im Absatz «Was nach dem Folgeantrag noch ansteht».'
	);
}

/** `sperreInWorten` (server/abstimmung.ts), Art «vertreten», wegen Ausstand; L8 liest die Verwaltung als Ausstand. */
const ruhtSatz = (wer) =>
	`«${wer}» ist über «${VERWALTUNG}» vertreten, und die ist bei diesem Traktandum im Ausstand.`;

/**
 * `andereLesartInWorten` (domain/auszaehlung.ts), Zweig `ruhendeVollmachten`,
 * feststellbar, n = 2; die andere Wahl heisst «Die Sitzungsleitung
 * entscheidet» (`lesarten.ts`, L8). Entscheid 0045, Punkt 2.
 */
const GRENZEN_DASSELBE =
	'Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätten die 2 ruhenden Vollmachten der ' +
	'Verwaltung gezählt. Das Ergebnis wäre dasselbe, gleich wie die Verwaltung damit gestimmt hätte.';

/** `VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN` (domain/mehrhinweise.ts), über `verwaltungsabsageAmWahlknoten` (server/erfordernisse.ts). */
const ABSAGE_ABBERUFUNG_AM_GRUNDANTRAG =
	'Dieses Traktandum trägt das Häkchen zur Entschädigung, zu einem Vertrag oder zur Entlastung der ' +
	'Verwaltung, und nach der Freigabe lässt es sich nicht mehr abnehmen. Als Abberufung nimmt Votum ' +
	'es deshalb nicht an. Kündigt die Einladung die Abberufung bei diesem Traktandum klar an, nehmen ' +
	'Sie sie mit «Gegenantrag» als eigenen Folgeantrag auf. Dort stellen Sie das nötige Mehr auf ' +
	'«Bewirtschaftung abberufen» und nehmen eine Kündigung des Vertrags in denselben Wortlaut auf.';

/**
 * `VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN` (domain/mehrhinweise.ts) mit
 * `VERWALTUNG_ABBERUFUNG_ENTSCHEID` bis vor die Rüge; «Nach der Prüfung
 * Runde 5 geklärt»: keine Richtung, dazu der Vorsitz. DB-Test: «nimmt die
 * Abberufung als Folgeantrag an …», `abberufungTrotzHaekchen: true`.
 */
const ABBERUFUNG_LEITUNG =
	'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen. Das Häkchen wirkt ' +
	'hier nicht von selbst: Votum zählt die Vollmachten, bis Sie den Ausstand der Verwaltung erklären. ' +
	'Das gilt, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen. ' +
	'Entscheiden Sie, ob sie ruhen, und sagen Sie der Versammlung vor der Abstimmung, dass die Frage ' +
	'nicht geklärt ist und was Sie entschieden haben. Leitet die Verwaltung die Versammlung, gibt sie ' +
	'den Vorsitz für die Behandlung dieses Folgeantrags ab, damit sie nicht selbst über ihre ' +
	'Vollmachten entscheidet.';

/** `folgeantraegeAngenommenSatz` (domain/protokoll.ts); DB-Test «… nennt beide im Protokoll». */
function gegenstandslos(liste) {
	const je = liste.map(([nr, titel]) => `${nr} «${titel}»`);
	const was = je.length === 1 ? `den Folgeantrag ${je[0]}` : `die Folgeanträge ${je.slice(0, -1).join(', ')} und ${je[je.length - 1]}`;
	return `Über diesen Antrag wurde nicht abgestimmt: Die Versammlung hat ${was} angenommen. Der ursprüngliche Antrag ist damit gegenstandslos.`;
}

/** `VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL` (domain/mehrhinweise.ts). */
const WAHL_PROTOKOLL =
	'Bei diesem Traktandum ging es um die Wahl der Verwaltung; anders als die Einladung angekündigt ' +
	'hatte, ruhten ihre Vollmachten hier nicht.';

/** `VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL` (domain/mehrhinweise.ts); DB-Test «nimmt die Abberufung als Folgeantrag an …». */
const ABBERUFUNG_PROTOKOLL =
	'Bei diesem Traktandum ging es um die Abberufung der Verwaltung. Anders als die Einladung ' +
	'angekündigt hatte, zählten ihre Vollmachten hier; die Sitzungsleitung hat ihren Ausstand nicht ' +
	'erklärt.';

/** `verwaltungsruhenProtokollInWorten` (domain/auszaehlung.ts), zwei Parteien, ohne Anführungszeichen (G-4). */
const RUHEN_PROTOKOLL_ANFANG =
	'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
	'Für 2 vertretene Parteien (';
const RUHEN_PROTOKOLL_ENDE = ') zählte deshalb keine Stimme.';

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
	return seite.locator('.baum li').filter({ has: seite.locator('.titel', { hasText: muster }) }).first();
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

// ── Lauf ───────────────────────────────────────────────────────────────────

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L8, Ausweg über Folgeanträge (Entscheid 0045, Punkt 9): ${ZIEL}\n`);

try {
	let gemeinschaft;
	let v1;
	let v2;
	let nrWahl;
	let nrEntlastung;
	let nrAbberufung;

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

		// Die Vorgabe von L8 ist «ruhen» (`VORGABEN.L8`, domain/lesarten.ts); nichts umstellen.
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L8"][value="ruhen"]').isChecked(),
			'L8 steht nicht auf der Vorgabe «Vollmachten ruhen»'
		);
		return '250 + 200 + 200 + 175 + 175 von 1000, L8 «Vollmachten ruhen»';
	});

	// ── Versammlung 1: Entlastung und Wiederwahl in einem Traktandum ─────────

	await schritt('Versammlung 1: ein Traktandum mit Häkchen, Entlastung und Wiederwahl zusammen, freigegeben', async () => {
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

	await schritt('Grundantrag aufgerufen: Satz zum Ruhen, Folgeantrag zur Wiederwahl aufgenommen', async () => {
		await rufeAuf(v1, GRUND1);
		const vorher = await seitentext();
		behaupte(vorher.includes(RUHEN_LEITUNG), `Am Grundantrag fehlt der Satz zum Ruhen: ${vorher.slice(0, 900)}`);
		nrWahl = await nimmFolgeantragAuf(
			v1,
			GRUND1,
			WAHL,
			'Die Verwaltung wird für zwei weitere Jahre wiedergewählt.',
			'k-bewirtschaftung-waehlen'
		);
		return `Folgeantrag ${nrWahl}`;
	});

	await schritt('9a: Am Folgeantrag zur Wahl wirkt das geerbte Häkchen nicht; die Vollmachten zählen', async () => {
		await rufeAuf(v1, WAHL);
		const vorher = await seitentext();
		behaupte(vorher.includes(WAHL_LEITUNG_ANFANG), `Der Satz zur Wahl am Folgeantrag fehlt: ${vorher.slice(0, 1500)}`);
		behaupte(vorher.includes(RUEGE_ANFANG) && vorher.includes(WAHL_LEITUNG_SCHLUSS), 'Rüge und Schluss des Satzes zur Wahl fehlen');
		behaupte(!vorher.includes(ANLEITUNG_AUFTEILEN), 'Am Folgeantrag steht die Anleitung zum Aufteilen (G-3)');
		behaupte(!vorher.includes(RUHEN_LEITUNG), 'Am Folgeantrag zur Wahl steht der Satz zum Ruhen');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(await form.locator('tr', { hasText: wer }).count(), `${wer} fehlt in der Erfassung; die Vollmacht ruht an der Wahl`);
		}
		const offen = await seitentext();
		behaupte(!offen.includes(ruhtSatz(DAELLENBACH)), 'An der Wahl steht der Satz zur ruhenden Vertretung');

		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'no'],
			[CAFLISCH, 'no'],
			[DAELLENBACH, 'yes'],
			[EGGER, 'yes']
		]);
		await schliesse(v1);
		const karte = await ergebniskarte(WAHL);
		behaupte(karte.satz.startsWith('Angenommen'), `Die Wiederwahl ist nicht angenommen: ${karte.satz.slice(0, 300)}`);
		behaupte(/3 ja · 2 nein · 0 Enthaltung · 0 ohne Abgabe/.test(karte.text), `Die Köpfe stimmen nicht (erwartet 3 ja, 2 nein): ${karte.text.slice(0, 600)}`);
		behaupte(/Bezugsgrösse 5, nötig 3/.test(karte.text), `Bezugsgrösse oder Schwelle stimmen nicht (erwartet 5, nötig 3): ${karte.text.slice(0, 600)}`);
		behaupte(!/ruhenden? Vollmacht/.test(karte.text), `An der Wahl steht ein Satz zu ruhenden Vollmachten: ${karte.text.slice(0, 900)}`);
		return 'angenommen, 3 zu 2 bei 5; ohne die Verwaltung wäre es 1 zu 2 bei 3';
	});

	await schritt('9d: Der Grundantrag ist gesperrt, mit dem Satz an der Leitung; Freigeben abgewiesen', async () => {
		await rufeAuf(v1, GRUND1);
		const text = await seitentext();
		const satz = sperrsatz('wahl', WAHL);
		behaupte(text.includes(satz), `Der Satz zur Sperre fehlt: ${text.slice(0, 1500)}`);
		// Codeprüfung P9, G-4: am gesperrten Grundantrag nur der Satz zur Sperre.
		behaupte(!text.includes(RUHEN_LEITUNG), 'Am gesperrten Grundantrag steht noch der Satz zum Ruhen');
		const knopf = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await knopf.count(), 'Kein Knopf «Abstimmung freigeben», auch nicht im Notweg');
		const absage = await abschicken(knopf.first(), { streng: false });
		behaupte(absage, 'Der Server hat die Abstimmung über den gesperrten Grundantrag freigegeben');
		behaupte(absage.text.includes(satz), `Die Absage trägt nicht den Satz zur Sperre: ${absage.text.slice(0, 600)}`);
		await gehe(`/versammlungen/${v1}/leitung`);
		behaupte(
			!(await seite.locator('form[action="?/schliessen"] button[type="submit"]').count()),
			'Nach der Absage läuft trotzdem eine Abstimmung'
		);
		return 'teil_entschieden';
	});

	await schritt('9b: Folgeantrag zur Entlastung; das geerbte Häkchen wirkt, die Vollmachten ruhen', async () => {
		nrEntlastung = await nimmFolgeantragAuf(
			v1,
			GRUND1,
			ENTLASTUNG,
			'Die Verwaltung wird für das Rechnungsjahr 2026 entlastet.',
			'k-decharge'
		);
		// Entscheid 0045, Punkt 5: Folgeanträge erben das Häkchen.
		await gehe(`/versammlungen/${v1}/traktanden`);
		for (const t of [WAHL, ENTLASTUNG]) {
			const z = sauber(await seite.locator('[data-traktandum]', { hasText: t }).first().innerText());
			behaupte(/Geschäft der Verwaltung/.test(z), `«${t}» trägt das geerbte Häkchen nicht: ${z.slice(0, 300)}`);
		}

		await rufeAuf(v1, ENTLASTUNG);
		const vorher = await seitentext();
		behaupte(vorher.includes(RUHEN_LEITUNG), `Am Folgeantrag zur Entlastung fehlt der Satz zum Ruhen: ${vorher.slice(0, 1200)}`);
		behaupte(!vorher.includes(WAHL_LEITUNG_ANFANG.slice(0, 80)), 'An der Entlastung steht der Satz zur Wahl');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(!(await form.locator('tr', { hasText: wer }).count()), `${wer} steht in der Erfassung, obwohl die Vollmacht ruht`);
		}
		const offen = await seitentext();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(offen.includes(ruhtSatz(wer)), `Der Satz zur ruhenden Vertretung von ${wer} fehlt: ${offen.slice(0, 1500)}`);
		}

		await erfasse(SELBST_DA.map((wer) => [wer, 'yes']));
		await schliesse(v1);
		const karte = await ergebniskarte(ENTLASTUNG);
		behaupte(karte.satz.startsWith('Angenommen'), `Die Entlastung ist nicht angenommen: ${karte.satz.slice(0, 300)}`);
		behaupte(/3 ja · 0 nein · 0 Enthaltung · 0 ohne Abgabe/.test(karte.text), `Die Köpfe stimmen nicht (erwartet 3 ja, 0 nein): ${karte.text.slice(0, 600)}`);
		behaupte(/Bezugsgrösse 3, nötig 2/.test(karte.text), `Bezugsgrösse oder Schwelle stimmen nicht (erwartet 3, nötig 2): ${karte.text.slice(0, 600)}`);
		behaupte(karte.text.includes(GRENZEN_DASSELBE), `Der Satz zu den Grenzen fehlt (Entscheid 0045, Punkt 2): ${karte.text.slice(0, 1200)}`);
		return `Folgeantrag ${nrEntlastung}, angenommen 3 zu 0 bei 3; Grenzen dasselbe`;
	});

	await schritt('9e: Das Protokoll nennt beide Folgeanträge und den Grundantrag gegenstandslos', async () => {
		const entwurf = await protokollentwurf(v1);
		const satz = gegenstandslos([
			[nrWahl, WAHL],
			[nrEntlastung, ENTLASTUNG]
		]);
		behaupte(entwurf.includes(satz), `Der Satz beim Grundantrag fehlt: erwartet «${satz}» in ${entwurf.slice(0, 2500)}`);
		behaupte(!/Gegenantrag/.test(entwurf), `Das Protokoll sagt «Gegenantrag»: ${entwurf.match(/.{0,200}Gegenantrag.{0,200}/)?.[0]}`);
		behaupte(entwurf.includes(WAHL_PROTOKOLL), `Die Zeile zur Wahl trotz Häkchen fehlt: ${entwurf.slice(0, 2500)}`);
		const ruhen = new RegExp(
			`${esc(RUHEN_PROTOKOLL_ANFANG)}(${esc(DAELLENBACH)}, ${esc(EGGER)}|${esc(EGGER)}, ${esc(DAELLENBACH)})${esc(RUHEN_PROTOKOLL_ENDE)}`
		);
		behaupte(ruhen.test(entwurf), `Die Tatsache zum Ruhen fehlt: ${entwurf.slice(0, 2500)}`);
		// Je am richtigen Beschluss: die Zeile zur Wahl vor der Entlastung, das Ruhen danach.
		const wahlZeile = entwurf.indexOf(WAHL_PROTOKOLL);
		const ruhenZeile = entwurf.search(ruhen);
		const kopfEntlastung = entwurf.lastIndexOf(`${nrEntlastung} ${ENTLASTUNG}`);
		behaupte(kopfEntlastung > 0, `Der Beschluss ${nrEntlastung} ${ENTLASTUNG} hat keinen eigenen Abschnitt`);
		behaupte(wahlZeile < kopfEntlastung && ruhenZeile > kopfEntlastung, 'Die Zeilen zu Wahl und Ruhen stehen beim falschen Beschluss');
		return 'gegenstandslos, Folgeanträge, Wahl- und Ruhenzeile';
	});

	// ── Versammlung 2: Kündigung und Abberufung in einem Traktandum ──────────

	await schritt('Versammlung 2: ein Traktandum mit Häkchen, Kündigung und Abberufung zusammen, freigegeben', async () => {
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

	await schritt('9g: Am Grundantrag weist Votum die Abberufung ab, der Satz nennt den Folgeantrag', async () => {
		await rufeAuf(v2, GRUND2);
		await gehe(`/versammlungen/${v2}/traktanden`);
		const pfad = await seite.locator('[data-traktandum]', { hasText: GRUND2 }).first().getAttribute('data-traktandum');
		behaupte(pfad, 'Die Kennung des Grundantrags ist nicht zu finden');
		await gehe(`/versammlungen/${v2}/traktanden/${pfad}/erfordernis?ast=a-organe&p=f2-1-abberufen`);
		behaupte(!(await seitentext()).includes(ABSAGE_ABBERUFUNG_AM_GRUNDANTRAG), 'Der Satz steht schon vor dem Übernehmen da');
		const knopf = seite.locator('form[action="?/uebernehmen"] button[type="submit"]');
		behaupte(await knopf.count(), `Kein «Für dieses Traktandum übernehmen»: ${(await seitentext()).slice(0, 600)}`);
		await abschicken(knopf.first(), { streng: false });
		const text = await seitentext();
		behaupte(text.includes(ABSAGE_ABBERUFUNG_AM_GRUNDANTRAG), `Die Absage nennt den Folgeantrag nicht: ${text.slice(0, 1200)}`);
		await gehe(`/versammlungen/${v2}/traktanden`);
		const zeile = sauber(await seite.locator('[data-traktandum]', { hasText: GRUND2 }).first().innerText());
		behaupte(/Gewöhnliche Verwaltungshandlung/.test(zeile), `Das Mehr am Grundantrag hat sich geändert: ${zeile.slice(0, 300)}`);
		return 'abgewiesen, Mehr unverändert';
	});

	await schritt('9c: Die Abberufung als Folgeantrag; kein Ruhen von selbst, Satz ohne Richtung, Vorsitz', async () => {
		nrAbberufung = await nimmFolgeantragAuf(
			v2,
			GRUND2,
			ABBERUFUNG,
			'Die Verwaltung wird per 31.12.2027 abberufen, und der Verwaltungsvertrag wird auf diesen Tag gekündigt.',
			'k-bewirtschaftung-abberufen'
		);
		await rufeAuf(v2, ABBERUFUNG);
		const vorher = await seitentext();
		behaupte(vorher.includes(ABBERUFUNG_LEITUNG), `Der Satz zur Abberufung als Folgeantrag fehlt: ${vorher.slice(0, 1500)}`);
		behaupte(!vorher.includes(RUHEN_LEITUNG), 'An der Abberufung steht der Satz, dass die Vollmachten ruhen');
		behaupte(!vorher.includes(WAHL_LEITUNG_ANFANG.slice(0, 80)), 'An der Abberufung steht der Satz zur Wahl');

		await oeffne();
		const form = await erfassungszeilen();
		for (const wer of [DAELLENBACH, EGGER]) {
			behaupte(await form.locator('tr', { hasText: wer }).count(), `${wer} fehlt in der Erfassung; ohne erklärten Ausstand ruht nichts`);
		}
		await erfasse([
			[AMSLER, 'yes'],
			[BRUNNER, 'yes'],
			[CAFLISCH, 'yes'],
			[DAELLENBACH, 'no'],
			[EGGER, 'no']
		]);
		await schliesse(v2);
		const karte = await ergebniskarte(ABBERUFUNG);
		behaupte(karte.satz.startsWith('Angenommen'), `Die Abberufung ist nicht angenommen: ${karte.satz.slice(0, 300)}`);
		behaupte(/3 ja · 2 nein · 0 Enthaltung · 0 ohne Abgabe/.test(karte.text), `Die Köpfe stimmen nicht (erwartet 3 ja, 2 nein): ${karte.text.slice(0, 600)}`);
		behaupte(/Bezugsgrösse 5, nötig 3/.test(karte.text), `Bezugsgrösse oder Schwelle stimmen nicht (erwartet 5, nötig 3): ${karte.text.slice(0, 600)}`);
		behaupte(!/ruhenden? Vollmacht/.test(karte.text), `An der Abberufung steht ein Satz zu ruhenden Vollmachten: ${karte.text.slice(0, 900)}`);
		return `Folgeantrag ${nrAbberufung}, angenommen 3 zu 2 bei 5, die Nein der Verwaltung gezählt`;
	});

	await schritt('9d: Der Grundantrag ist gesperrt (Abberufung); Freigeben abgewiesen', async () => {
		await rufeAuf(v2, GRUND2);
		const text = await seitentext();
		const satz = sperrsatz('abberufung', ABBERUFUNG);
		behaupte(text.includes(satz), `Der Satz zur Sperre fehlt: ${text.slice(0, 1500)}`);
		const absage = await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first(), { streng: false });
		behaupte(absage && absage.text.includes(satz), `Freigeben nicht mit dem Satz zur Sperre abgewiesen: ${absage?.text.slice(0, 600)}`);
		return 'teil_entschieden';
	});

	await schritt('9c und 9e im Protokoll: Abberufung trotz Häkchen, Grundantrag gegenstandslos', async () => {
		const entwurf = await protokollentwurf(v2);
		behaupte(entwurf.includes(ABBERUFUNG_PROTOKOLL), `Die Zeile zur Abberufung fehlt: ${entwurf.slice(0, 2500)}`);
		const satz = gegenstandslos([[nrAbberufung, ABBERUFUNG]]);
		behaupte(entwurf.includes(satz), `Der Satz beim Grundantrag fehlt: erwartet «${satz}» in ${entwurf.slice(0, 2500)}`);
		behaupte(!/Gegenantrag/.test(entwurf), `Das Protokoll sagt «Gegenantrag»: ${entwurf.match(/.{0,200}Gegenantrag.{0,200}/)?.[0]}`);
		behaupte(!entwurf.includes(RUHEN_PROTOKOLL_ANFANG.slice(0, 60)), 'An der Abberufung steht, die Vollmachten hätten geruht');
		return 'Abberufungszeile, gegenstandslos';
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
