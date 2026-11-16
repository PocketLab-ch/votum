/**
 * Folgeantrag nach einem angenommenen Rückkommen (Produktentscheid 30.09.2026;
 * Plan `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B3;
 * Commits 33f1c85, 37a6091, dec9735).
 *
 * **Der Fall:** Nach einem angenommenen Rückkommen darf statt des alten Antrags
 * ein Folgeantrag («Gegenantrag») zur Abstimmung kommen. Angenommen ersetzt er
 * den alten Beschluss, abgelehnt entfällt der alte, ohne Beschluss bleibt der
 * alte. Die Kern- und Serverproben (`tests/db/folgeantrag-*.test.ts`) messen
 * an den Loadern; im Browser war der Weg bis hierher ungefahren, und /z, die
 * Wand und die Abendleitung beim offenen Stichentscheid hatten gar keine Probe
 * (Commit dec9735, «Ohne Probe»).
 *
 * **Was das Drehbuch misst**, auf leerem Bestand (eigene Gemeinschaften je Lauf):
 *
 *   1. Einzelversammlung, geführte Betriebsart: Der Grundantrag
 *      «Fassadensanierung» wird mit einfachem Mehr angenommen.
 *   2. Das Rückkommen wird gestellt und angenommen.
 *   3. Am wieder aufgerufenen Grundantrag steht unter «Jetzt möglich» der
 *      «Gegenantrag» mit dem Hilfesatz aus `gegenantragNachRueckkommen`; der
 *      Folgeantrag «Nur die Wetterseite» wird aufgenommen und steht als
 *      Unterpunkt des Grundantrags in der Liste.
 *   4. Am aufgerufenen Folgeantrag steht vor dem Freigeben die Ansage aus
 *      `auskunftZumFolgeantrag` («Sagen Sie vor dem Freigeben an: …»), und
 *      «Abstimmung freigeben» ist da.
 *   5. Nach dem Freigeben zeigt der Stimmzettel am Telefon (/z, 390 px, mit
 *      Zugangscode) fett, dass sich der bisherige Beschluss mit keinem Knopf
 *      behalten lässt. Eine Stimme kommt über /z, die übrigen erfasst die
 *      Leitung; der Folgeantrag ist angenommen.
 *   6. Danach nennen Leitung und Wand die Ersetzung (`ersetzungInKuerze`).
 *   7. Nach dem Schliessen der Versammlung steht derselbe Satz im Entwurf des
 *      Protokolls, und die Wand zählt den ersetzten Grundantrag nicht als «ohne
 *      Beschluss».
 *   8. Am gemeinsamen Abend, beim offenen Stichentscheid über den Folgeantrag
 *      (Summen 2 zu 2, Stichentscheid nach Wertquoten), zielt «Neuabstimmung»
 *      auf den Durchgang des Folgeantrags und nicht auf den geltenden des
 *      Grundantrags. Belegt ist das durch Ausschluss: Die Abendseite trägt die
 *      Kennung des offenen Durchgangs nicht, in Haus A gibt es aber genau drei
 *      Durchgänge (Grundantrag, Rückkommensantrag, Folgeantrag), und der Knopf
 *      zielt auf keinen der beiden ersten. Nach dem Klick gemessen wird nur,
 *      dass der Beschluss des Grundantrags weiter gilt. Ungefahren bleibt, dass
 *      das Rückkommen danach wieder einen Durchgang trägt.
 *
 * Die Nummern 1 bis 8 hier sind die Punkte des Auftrags; die Ausgabe zählt
 * die Schritte durch (20), «6» ist dort Schritt 11.
 *
 * **Was der Code vorgibt und wie das Drehbuch damit umgeht** (gelesen am
 * 30.09.2026, nicht geraten):
 *
 *   - **Die Wand nennt den Satz am Folgeantrag, nicht am Grundantrag.**
 *     `holeAbstimmungsstand` (`server/versammlungsstand.ts`) liefert beim
 *     aufgerufenen, ersetzten Grundantrag keinen Stand: Sein einziger
 *     Durchgang ist überholt, `stattDessen` greift nur beim Folgeantrag ohne
 *     Beschluss. Am aufgerufenen Folgeantrag steht dafür dessen Satz («… statt
 *     über den Antrag zu Traktandum N «Fassadensanierung» abgestimmt. Dieser
 *     Beschluss ersetzt den bisherigen …»), so auch `tests/db/folgeantrag-saetze`.
 *     Schritt 6 behauptet diesen und hält beim aufgerufenen Grundantrag nur
 *     fest, was die Wand zeigt (Messung ohne Behauptung).
 *   - **An der Leitung steht der Satz zum Grundantrag über der Auskunft**
 *     (`rueckkommen.satz`, `ersetzt.has(aktuelles.id)`), nicht in einer
 *     Ergebniskarte: Der ersetzte Grundantrag hat keinen massgebenden Durchgang
 *     mehr und damit keine Karte unter «Ergebnisse».
 *   - **Die Wand nach dem Schluss führt den ersetzten Grundantrag gar nicht**
 *     (`praesentation/+page.server.ts` filtert ihn mit `ergebnisLiegtAnderswo`
 *     aus Zeilen und Zählung). Ein Anker «Grundantrag steht auf der Wand» ist
 *     dort also nicht zu haben. Der Anker ist deshalb zweiteilig: Die
 *     Auswertung zeigt den Grundantrag mit dem Ersetzungssatz, und sie zählt
 *     die Traktanden ohne Abstimmung («Es wurde nicht abgestimmt.», die nicht
 *     abgestimmten Pflichttraktanden). Die Wand muss genau diese Zahl «ohne
 *     Beschluss» nennen; zählte der Grundantrag mit, wäre sie um eins höher.
 *     Beide Seiten lesen dieselbe `holeAuswertung`.
 *   - **Das Protokoll** lässt sich als Entwurf erst nach dem Schliessen
 *     erzeugen (`?/entwurf`, wie `durchspielen.mjs`); Schritt 7 prüft es dort.
 *   - **Am Abend geht der Folgeantrag nach dem Rückkommen.** Beide
 *     Leitungsseiten geben `rueckkommenOffen` an die Eingriffe (Commit 37a6091;
 *     `tage/[id]/leitung/+page.server.ts`, `rueckkommenOffenBei`), der Abend
 *     führt einen Folgeantrag als eigenen Schritt (`e2e/abend-drei-haeuser.mjs`,
 *     2a bis 2c) und rechnet `offenNachRueckkommen` aus der Ersetzungslage.
 *     Aufrufen, Eröffnen und Schliessen weist die Hausleitung am Abend ab
 *     (`nurWennNichtAmAbend`); nur das Rückkommen wird im Haus gestellt, wie in
 *     `abend-drei-haeuser.mjs`, 3b. Die Summenerfassung gibt es nur beim
 *     einfachen Mehr (`summenhindernis`) und in der einfachen Betriebsart
 *     ohne Pflichtvermerk; das Abendhaus hat deshalb vier Parteien, das zweite
 *     Haus eine.
 *   - **Die Karte, an der gemessen wird, ist die des Grundantrags.** Kommt über
 *     den Folgeantrag kein Beschluss zustande, ist sein Durchgang überholt, und
 *     am Schritt des Folgeantrags gibt es keine Ergebniskarte. Am Grundantrag
 *     hängt die geltende Karte mit `ohneNeuabstimmung`, und darunter ein
 *     zweiter `Ergebnisnachgang` für `offenNachRueckkommen`: der Knopf, um den
 *     es geht.
 *
 * **Absagen:** `fail()` antwortet unter `use:enhance` mit HTTP 200. `abschicken`
 * liest deshalb die Art der Antwort (`failure`, `error`) und bricht den Schritt
 * mit dem Rumpf ab, statt ihn grün weiterlaufen zu lassen.
 *
 * Aufruf: `node e2e/folgeantrag-nach-rueckkommen.mjs`
 * Gemeinschaften, Abend und Traktanden tragen «Prüflauf», die Personen den
 * vollen Laufstempel, damit `scripts/testdaten-entfernen.sql` sie
 * wiederfindet. Personen und Häuser sind erfunden.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter, abgefangen, ergebnisart } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-folgeantrag-nach-rueckkommen';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Je Lauf ein anderes Datum für den Abend, wie in `abend-drei-haeuser.mjs`:
 * Zwei Erstversammlungen derselben Gemeinschaft am selben Tag weist der Kern ab
 * (Migration 028). Die Häuser sind zwar neu, aber so bleibt der Abend auch bei
 * einem wiederholten Lauf eindeutig.
 */
const DATUM = new Date(Date.UTC(2036, 0, 1) + (Date.now() % 800) * 86400000)
	.toISOString()
	.slice(0, 10);

// ── Einzelversammlung ────────────────────────────────────────────────────
const NAME = `Prüflauf Folgeantrag nach Rückkommen ${LAUF}`;
/** Erkennbar erfundene Eigentümer; die erste stimmt am Telefon. */
const LEUTE = ['Anna Muster', 'Bruno Beispiel', 'Clara Probe', 'Dario Fiktiv'].map((n) => `${n} ${LAUF}`);
const TELEFONPARTEI = LEUTE[0];
const GRUND = 'Fassadensanierung';
const FOLGE = 'Nur die Wetterseite';
/** Zweites Geschäft für M3, Teil A: Folgeantrag zuerst angenommen, dann der Grundantrag. */
const GRUND2 = 'Veloraum';
const FOLGE2 = 'Nur der Veloraum Nord';

// ── Gemeinsamer Abend ────────────────────────────────────────────────────
const HAUS_A = `${NAME} Stichhaus A`;
const HAUS_B = `${NAME} Stichhaus B`;
const LEUTE_A = ['Elena Erfunden', 'Felix Gedacht', 'Gina Ausgedacht', 'Hugo Annahme'].map(
	(n) => `${n} ${LAUF}`
);
const LEUTE_B = [`Ida Platzhalter ${LAUF}`];
const GRUND_ABEND = `Dachsanierung Prüflauf ${LAUF}`;
const FOLGE_ABEND = `Nur das Vordach Prüflauf ${LAUF}`;

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

const sauber = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * **Die Sätze, gegen die gemessen wird**, je mit ihrer Quelle. Gemessen wird
 * am Text mit zusammengezogenem Leerraum (`sauber`), die Nummern bleiben offen:
 * Wie viele Pflichttraktanden vor dem Grundantrag stehen, entscheidet die
 * Vorlage, nicht dieses Drehbuch.
 */
/** `gegenantragNachRueckkommen` (domain/eingriffe.ts). */
const HILFESATZ = 'Statt des alten Antrags darf jetzt ein Gegenantrag';
/** `auskunftZumFolgeantrag` (domain/rueckkommen.ts), bisheriger Beschluss angenommen. */
const ANSAGE = new RegExp(
	`Sagen Sie vor dem Freigeben an: «Mit Ja gilt «${esc(FOLGE)}» an Stelle des bisherigen ` +
		`Beschlusses zu «${esc(GRUND)}»`
);
/** `z/+page.svelte`, Block `stattAntrag`, Lage «angenommen»; Titel aus `z/+page.server.ts`. */
const STIMMZETTEL = new RegExp(
	`Den bisherigen Beschluss zu Traktandum [\\d.]+ ${esc(GRUND)} können Sie in dieser ` +
		'Abstimmung mit keinem Knopf behalten'
);
/** M3, Teil A: der Hinweis an die Leitung (`folgeantragBleibtHinweis`). */
const HINWEIS_FOLGEANTRAG = new RegExp(
	`Zu dieser Sache gilt auch der Beschluss zum Folgeantrag [\\d.]+ «${esc(FOLGE2)}»\\. Das Rückkommen nennt ihn ` +
		'nicht; mit dem neuen Beschluss zum Grundantrag fällt er deshalb nicht weg\\..*unter «Gegenantrag» ' +
		'einen Antrag auf, der die Sache vollständig neu regelt'
);
/** M3, Teil B: das unbenutzte zweite Rückkommen am ersetzten Grundantrag. */
const SATZ_ZWEITES_RUECKKOMMEN =
	/Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen \(Traktandum [\d.]+\); erneut abgestimmt wurde nicht\. Es bleibt beim Beschluss zum Folgeantrag [\d.]+, wie oben festgehalten\./;
/** `ersetzungInKuerze`, Rolle Grundantrag, Ausgang angenommen (domain/folgeantragsersetzung.ts). */
const SATZ_GRUNDANTRAG = new RegExp(
	`Nach dem Rückkommen \\(Traktandum [\\d.]+\\) kam statt dieses Antrags der Folgeantrag ` +
		`[\\d.]+ «${esc(FOLGE)}» zur Abstimmung\\. Er wurde angenommen; sein Beschluss ersetzt ` +
		'den bisherigen'
);
/** `ersetzungInKuerze`, Rolle Folgeantrag, Ausgang angenommen. */
const SATZ_FOLGEANTRAG = new RegExp(
	`Nach dem Rückkommen \\(Traktandum [\\d.]+\\) wurde statt über den Antrag zu Traktandum [\\d.]+ ` +
		`«${esc(GRUND)}» abgestimmt\\. Dieser Beschluss ersetzt den bisherigen`
);

let browser;
let seite;
let telefon;

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? `: ${ergebnis}` : ''}`);
	} catch (f) {
		fehler.push({ nr, titel, text: f.message });
		console.log(`  ✗ ${nr} ${titel}\n     ${f.message}`);
		for (const [name, s] of [
			['leitung', seite],
			['telefon', telefon]
		]) {
			if (!s) continue;
			try {
				await s.screenshot({ path: `${AUFNAHMEN}/fehler-${nr}-${name}.png`, fullPage: true });
				console.log(`     Bild: ${AUFNAHMEN}/fehler-${nr}-${name}.png`);
			} catch {
				/* ohne Bild weiter */
			}
		}
		throw f;
	}
}

/**
 * Warum der Server abgesagt hat, oder `null`.
 *
 * **Eine Absage über `fail()` kommt unter `use:enhance` als HTTP 200** mit
 * `type: 'failure'`. Wer nur den Status liest, sieht Erfolg. `redirect` ist
 * keine Absage: Anmelden und Anlegen enden so. Ohne Antwort lässt sich nichts
 * sagen; dann entscheidet der nächste Blick auf die Seite.
 */
async function absageAus(antwort) {
	if (!antwort) return null;
	if (abgefangen(antwort)) {
		const art = await ergebnisart(antwort);
		if (art !== 'failure' && art !== 'error') return null;
		const rumpf = await antwort.text().catch(() => '');
		return `Der Server wies das Formular ab (${art}): ${antwort.url()}: ${rumpf.slice(0, 400)}`;
	}
	if (antwort.status() < 400) return null;
	return `Der Server wies das Formular ab: ${antwort.status()} ${antwort.url()}`;
}

/**
 * Ein Formular abschicken, auf die Wirkung warten und eine Absage melden.
 *
 * Aufbau wie in `rueckkommen-stichentscheid.mjs`: Der Wächter auf die Antwort
 * wird zusammen mit dem Klick gestartet, `nachAbsendung` wartet auf das
 * Nachladen. Neu ist nur, dass eine Absage den Schritt abbricht.
 */
async function abschicken(knopf, auf = seite) {
	const nachladen = nachladeWarter(auf);
	const [antwort] = await Promise.all([
		auf
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click()
	]);
	const absage = await absageAus(antwort);
	await nachAbsendung(auf, antwort, nachladen, 300);
	if (absage) throw new Error(absage);
	return antwort;
}

/** Eine Seite laden; die Hydrationsmarke wartet `warteNachNavigation` ab. */
async function gehe(pfad, auf = seite) {
	await auf.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await auf.waitForTimeout(250);
}

async function seitentext(auf = seite, wo = 'main') {
	return sauber(await auf.locator(wo).first().innerText());
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
}

/*
 * `devalue` packt Aktionsantworten als `[ {…}, … ]`: Zahlen sind Indizes in
 * dieselbe Liste. Wörtlich aus `abend-drei-haeuser.mjs`; gebraucht für die
 * Kennung des aufgenommenen Folgeantrags.
 */
function aktionsdaten(rohtext) {
	try {
		return JSON.parse(rohtext);
	} catch {
		return null;
	}
}

function aktionsfelder(rohtext) {
	const d = aktionsdaten(rohtext);
	if (!d) return null;
	let roh = d.data;
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
 * Eine Gemeinschaft mit je einer Einheit und einer Partei je Name.
 *
 * Aufbau wie `rueckkommen-stichentscheid.mjs`. Mit `stichentscheid` trägt das
 * Reglement den Stichentscheid nach Wertquoten samt Fundstelle.
 */
/*
 * Der Name als Zusatz zu `NAME`, nicht als Parameter: Der Wächter
 * `tests/waechter/testdatennamen.test.ts` muss ihn statisch auflösen können,
 * damit `scripts/testdaten-entfernen.sql` die Gemeinschaft wiederfindet.
 */
async function legeGemeinschaftAn(zusatz, leute, quoten, { stichentscheid = false } = {}) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `${NAME}${zusatz}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	if (stichentscheid) {
		const wahl = seite.locator('input[name="tieBreak"][value="wertquote"]');
		behaupte(await wahl.count(), 'Das Formular bietet den Stichentscheid nach Wertquoten nicht an');
		await wahl.check();
		await seite.waitForTimeout(150);
		const fundstelle = seite.locator('input[name="tieBreakRuleSource"]');
		behaupte(await fundstelle.count(), 'Nach der Wahl fehlt das Feld für die Fundstelle im Reglement');
		await fundstelle.fill('Art. 7 Ziff. 5 Reglement');
	}
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `Nicht angelegt: ${seite.url()}`);

	for (const [i, wer] of leute.entries()) {
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill(String(quoten[i]));
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(wer);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
		await abschicken(zf.locator('button[type="submit"]'));
	}
	return id;
}

/**
 * Stimmen in der Tabelle «Alle Stimmen (von Hand) erfassen» eintragen.
 *
 * **Mit Begründung**, weil die Einzelversammlung geführt läuft: Dort ist das
 * Feld Pflicht (`Stimmerfassung.svelte`, `required={betriebsart === 'gefuehrt'}`),
 * und ohne es hielte die native Prüfung des Browsers das Formular stumm an. In
 * der einfachen Betriebsart schadet der Satz nicht. Eine Zeile ohne Wahl rührt
 * die Aktion nicht an; die Stimme vom Telefon bleibt damit stehen.
 */
async function erfasseStimmen(stimmen) {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
	const form = seite.locator('form[action="?/erfassen"]').first();
	behaupte(await form.count(), `Keine Stimmerfassung: ${(await seitentext()).slice(0, 300)}`);
	const grund = form.locator('input[name="begruendung"]');
	if (await grund.count()) await grund.fill('Prüflauf: im Saal von Hand abgestimmt.');
	for (const [wer, wahl] of stimmen) {
		const radio = form
			.locator('tr', { hasText: wer })
			.first()
			.locator(`input[type="radio"][value="${wahl}"]`)
			.first();
		behaupte(await radio.count(), `In der Stimmerfassung fehlt die Zeile von ${wer}`);
		await radio.check();
	}
	await abschicken(form.locator('button[data-fokus="erfassen:alle"]'));
}

// ── Helfer der Einzelleitung ──────────────────────────────────────────────

/**
 * Die Zeile eines Traktandums im Baum, **am Titel, nicht am Text**: Der
 * Rückkommensantrag heisst «Rückkommen auf N Fassadensanierung» und träfe ein
 * `hasText` auf den Grundantrag mit. Beim Folgeantrag steht hinter dem Titel
 * die Marke «Folgeantrag»; deshalb vorne verankert, hinten offen.
 */
function baumzeile(titel, { genau = true } = {}) {
	const muster = genau
		? new RegExp(`^\\s*${esc(titel)}\\s*$`)
		: new RegExp(`^\\s*${esc(titel)}(\\s|$)`);
	return seite.locator('.baum li').filter({ has: seite.locator('.titel', { hasText: muster }) }).first();
}

/** Die Standmarke rechts, nicht die Marke «Folgeantrag» im Titel. */
async function standmarke(zeile) {
	const m = zeile.locator('.stand .marke').first();
	return (await m.count()) ? sauber(await m.innerText()) : '';
}

/** Die Ergebniskarte eines Traktandums, am Titel in der Überschrift. */
function ergebniskarte(titel) {
	return seite
		.locator('article.ergebnis')
		.filter({ has: seite.locator('h4', { hasText: new RegExp(`^\\s*[\\d.]+\\s+${esc(titel)}(\\s|$)`) }) })
		.first();
}

async function rufeAuf(zeile, titel, pfad) {
	const knopf = zeile.locator('form[action="?/aufrufen"] button[type="submit"]');
	// Fehlt der Knopf, ist das Traktandum bereits aufgerufen (Baum, `t.id !== v.aktuellesTraktandumId`).
	if (await knopf.count()) await abschicken(knopf.first());
	await gehe(pfad);
	const jetzt = sauber(await seite.locator('li.jetzt, .jetzt').first().innerText());
	behaupte(jetzt.includes(titel), `Aufgerufen ist etwas anderes: ${jetzt.slice(0, 160)}`);
}

// ── Helfer des Abends (wie `abend-drei-haeuser.mjs`) ──────────────────────

async function jetztText() {
	return sauber(await seite.locator('ol.dreischritt > li.jetzt').innerText());
}

async function meldungstext() {
	const streifen = seite.locator('p.meldung[role]');
	if (await streifen.count()) return sauber((await streifen.allInnerTexts()).join(' · '));
	const ecke = seite.locator('.quittung .text');
	await ecke.first().waitFor({ timeout: 8000 }).catch(() => {});
	if (!(await ecke.count())) return '';
	return sauber((await ecke.allInnerTexts()).join(' · '));
}

/**
 * Einen Schritt am Abend aufrufen, über den Dreischritt.
 *
 * Gesucht wird die Zeile, die `titel` trägt und keines der Wörter aus
 * `ausser`; der Rückkommensantrag trägt den Titel des Grundantrags mit. Steht
 * der Schritt nicht im Fenster, gibt es `null` zurück, und der Aufrufer
 * entscheidet über den Ausweg.
 */
async function rufeImAblaufAuf(titel, ausser = []) {
	const zeilen = seite.locator('ol.dreischritt > li');
	const texte = (await zeilen.allInnerTexts()).map(sauber);
	const i = texte.findIndex((t) => t.includes(titel) && !ausser.some((w) => t.includes(w)));
	if (i < 0) return null;
	const knopf = zeilen.nth(i).locator('form[action="?/aufrufen"] button');
	if (!(await knopf.count())) return (await zeilen.nth(i).getAttribute('class'))?.includes('jetzt') ? 'jetzt' : null;
	await abschicken(knopf.first());
	return texte[i];
}

/** Die Durchgangskennung, an der das Feld «Text zum Beschluss» hängt: der geltende. */
async function geltenderDurchgangDerKarte(karte) {
	const feld = karte.locator('form[action="?/beschlusstext"] input[name="durchgang"]').first();
	return (await feld.count()) ? feld.getAttribute('value') : null;
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

/*
 * **Das Telefon ist ein eigener Kontext**, ohne Anmeldung der Leitung und in
 * Telefonbreite wie `telefonbreite.mjs`: Der Stimmzettel soll so gelesen werden,
 * wie ihn die Eigentümerin sieht, mit ihrem Zugangskeks und sonst nichts.
 */
const telefonKontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
telefon = await telefonKontext.newPage();
warteNachNavigation(telefon);
await rueckfragenBestaetigen(telefon);

console.log(`\nFolgeantrag nach Rückkommen: ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	let zugangscode;
	const leitung = () => `/versammlungen/${versammlung}/leitung`;

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
		gemeinschaft = await legeGemeinschaftAn('', LEUTE, [250, 250, 250, 250]);
		return gemeinschaft.slice(0, 8);
	});

	await schritt('Versammlung, Grundantrag, freigeben, geführt, eröffnen', async () => {
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
		await tf.locator('input[name="titel"]').fill(GRUND);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Fassade wird auf allen vier Seiten saniert.');
		// Gewöhnliche Verwaltungshandlung: einfaches Mehr genügt.
		await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(tf.locator('button[type="submit"]').first());

		// Das zweite Geschäft für M3, Teil A.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf2 = seite.locator('form[action="?/anlegen"]').first();
		await tf2.locator('input[name="titel"]').fill(GRUND2);
		await tf2.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf2
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Der Veloraum wird neu eingerichtet.');
		await tf2.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(tf2.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());

		/*
		 * **Geführt, damit das Telefon selbst abstimmt.** Bei vier Parteien schlägt
		 * `betriebsartVorschlag` die einfache Betriebsart vor, und dort zeigt /z
		 * keine Wahlknöpfe. Umstellen geht nur zwischen Freigabe und Eröffnung.
		 * Das versteckte Feld trägt den Gegenwert (wie `mustergemeinschaft.mjs`):
		 * «gefuehrt» heisst, die Versammlung steht noch auf «einfach».
		 */
		await gehe(`/versammlungen/${versammlung}`);
		const wechsel = seite.locator('form[action="?/betriebsart"]');
		behaupte(await wechsel.count(), `Kein Schalter für die Betriebsart: ${(await seitentext()).slice(0, 220)}`);
		if ((await wechsel.locator('input[name="betriebsart"]').inputValue()) === 'gefuehrt') {
			await abschicken(wechsel.locator('button[type="submit"]'));
			await gehe(`/versammlungen/${versammlung}`);
		}
		behaupte(
			(await seite.locator('form[action="?/betriebsart"] input[name="betriebsart"]').inputValue()) ===
				'einfach',
			'Die Versammlung steht nicht auf «geführt»; am Telefon gäbe es keine Wahlknöpfe'
		);

		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());
		return versammlung.slice(0, 8);
	});

	await schritt('Alle vier anwesend', async () => {
		// Wie `rueckkommen-stichentscheid.mjs`: «Von Hand erfassen» mit Rückfrage,
		// jedes Mal neu laden, weil sich die Liste mit jeder Bestätigung ändert.
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
		return 'vier anwesend';
	});

	// ── 1 ──────────────────────────────────────────────────────────────────
	await schritt('1: Grundantrag angenommen, 3 zu 1', async () => {
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND), GRUND, leitung());
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(leitung());
		await erfasseStimmen([
			[LEUTE[0], 'yes'],
			[LEUTE[1], 'yes'],
			[LEUTE[2], 'yes'],
			[LEUTE[3], 'no']
		]);
		await gehe(leitung());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(leitung());
		const marke = await standmarke(baumzeile(GRUND));
		behaupte(marke === 'angenommen', `Die Marke des Grundantrags ist «${marke}»`);
		return 'angenommen';
	});

	// ── 2 ──────────────────────────────────────────────────────────────────
	await schritt('2: Rückkommen gestellt und angenommen', async () => {
		await gehe(leitung());
		const wort = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		behaupte(await wort.count(), `Kein «Nochmals abstimmen» am Grundantrag: ${(await seitentext()).slice(0, 300)}`);
		await wort.first().click();
		await seite.waitForTimeout(150);
		await abschicken(seite.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]').first());
		await gehe(leitung());
		const antrag = seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last();
		behaupte(await antrag.count(), 'Der Rückkommensantrag steht nicht in der Liste');
		await rufeAuf(antrag, 'Rückkommen auf', leitung());
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(leitung());
		await erfasseStimmen(LEUTE.map((wer) => [wer, 'yes']));
		await gehe(leitung());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(leitung());
		const marke = await standmarke(seite.locator('.baum li', { hasText: 'Rückkommen auf' }).last());
		behaupte(marke === 'angenommen', `Die Marke des Rückkommensantrags ist «${marke}»`);
		return 'Rückkommen angenommen';
	});

	// ── 3 ──────────────────────────────────────────────────────────────────
	await schritt('3: Am Grundantrag «Gegenantrag» mit Hilfesatz, Folgeantrag aufgenommen', async () => {
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND), GRUND, leitung());

		const eingriffe = seite.locator('.eingriffe').first();
		const einleitung = sauber(await eingriffe.locator('p.einleitung').innerText());
		behaupte(einleitung === 'Jetzt möglich:', `Über den Eingriffen steht «${einleitung}»`);
		const wort = eingriffe.locator('button.wort', { hasText: 'Gegenantrag' });
		behaupte(
			await wort.count(),
			`Unter «Jetzt möglich» fehlt «Gegenantrag»: ${(await eingriffe.locator('.woerter').innerText().catch(() => '')).replace(/\s+/g, ' ')}`
		);
		await wort.first().click();
		await seite.waitForTimeout(200);
		const hilfe = sauber(await eingriffe.locator('.feld p.hilfe').first().innerText());
		behaupte(hilfe.includes(HILFESATZ), `Der Hilfesatz nach dem Rückkommen fehlt: «${hilfe.slice(0, 300)}»`);

		const form = eingriffe.locator('form[action="?/aufnehmen"]');
		behaupte(await form.count(), 'Im Feld «Gegenantrag» steht kein Aufnahmeformular');
		await form.locator('input[name="titel"]').fill(FOLGE);
		await form
			.locator('textarea[name="antragswortlaut"]')
			.fill('Saniert wird nur die Fassade auf der Wetterseite.');
		// Das Erfordernis wird gewählt, nicht mehr geerbt (Produktentscheid
		// 08.10.2026): Ohne Wahl stünde der Folgeantrag ohne Mehr da, und die
		// Ansage vor dem Freigeben käme nicht.
		await form.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(form.locator('button[type="submit"]').first());

		/*
		 * **Neu laden, bevor gemessen wird.** `use:enhance` aktualisiert ohne
		 * Navigation; der Baum zeigt danach womöglich noch den Stand davor.
		 */
		await gehe(leitung());
		const grundNr = sauber(await baumzeile(GRUND).locator('.nr').innerText());
		const zeile = baumzeile(FOLGE, { genau: false });
		behaupte(await zeile.count(), 'Der Folgeantrag steht nicht in der Liste');
		const folgeNr = sauber(await zeile.locator('.nr').innerText());
		const titel = sauber(await zeile.locator('.titel').innerText());
		behaupte(/Folgeantrag/.test(titel), `Am Eintrag fehlt die Marke «Folgeantrag»: «${titel}»`);
		behaupte(
			new RegExp(`^${esc(grundNr)}\\.\\d+$`).test(folgeNr),
			`Der Folgeantrag ist kein Unterpunkt des Grundantrags: ${folgeNr} unter ${grundNr}`
		);
		return `${folgeNr} unter ${grundNr}`;
	});

	// ── 4 ──────────────────────────────────────────────────────────────────
	await schritt('4: Am Folgeantrag die Ansage vor dem Freigeben, «Abstimmung freigeben» da', async () => {
		await gehe(leitung());
		await rufeAuf(baumzeile(FOLGE, { genau: false }), FOLGE, leitung());
		const text = await seitentext();
		behaupte(ANSAGE.test(text), `Die Ansage vor dem Freigeben fehlt: ${text.slice(0, 600)}`);
		const frei = seite.locator('form[action="?/oeffnen"] button[type="submit"]', {
			hasText: 'Abstimmung freigeben'
		});
		behaupte(await frei.count(), 'Am Folgeantrag steht kein «Abstimmung freigeben»');
		return 'Ansage und Knopf';
	});

	await schritt(`Zugangscode für ${TELEFONPARTEI}, am Telefon eingelöst`, async () => {
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		const zeile = seite
			.locator('tr', { hasText: TELEFONPARTEI })
			.filter({ has: seite.locator('form[action="?/codeAusgeben"]') })
			.first();
		behaupte(await zeile.count(), `An der Zeile von ${TELEFONPARTEI} lässt sich kein Code ausgeben`);
		await abschicken(zeile.locator('form[action="?/codeAusgeben"] button[type="submit"]'));
		// Warten, nicht zählen: wie `durchspielen.mjs` beim Ausgabecode.
		const code = seite.locator('.ausgabe .code');
		await code
			.first()
			.waitFor({ state: 'attached', timeout: 15000 })
			.catch(() => {});
		behaupte(await code.count(), 'Kein Ausgabecode erschienen');
		zugangscode = sauber(await code.first().textContent());

		await gehe('/z', telefon);
		await telefon.fill('input[name="code"]', zugangscode);
		await abschicken(telefon.locator('main button[type="submit"]').first(), telefon);
		await gehe('/z', telefon);
		const text = await seitentext(telefon, 'body');
		behaupte(!/nicht gültig|unbekannt/i.test(text), `Code ${zugangscode} abgewiesen: ${text.slice(0, 200)}`);
		behaupte(
			(await telefon.locator('input[name="code"]').count()) === 0,
			`Nach dem Einlösen steht wieder die Codeeingabe: ${text.slice(0, 200)}`
		);
		return zugangscode;
	});

	// ── 5 ──────────────────────────────────────────────────────────────────
	await schritt('5: Freigeben, Stimmzettel am Telefon, eine Stimme über /z, angenommen', async () => {
		await gehe(leitung());
		await abschicken(
			seite.locator('form[action="?/oeffnen"] button[type="submit"]', { hasText: 'Abstimmung freigeben' }).first()
		);

		await gehe('/z', telefon);
		const ja = telefon.locator('button[name^="wahl"][value="yes"]').first();
		await ja.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
		behaupte(
			await ja.count(),
			`Kein Ja-Knopf auf dem Telefon: ${(await seitentext(telefon, 'body')).slice(0, 300)}`
		);
		/*
		 * **Am `<strong>`, nicht irgendwo im Text.** Die Folge steht mit Absicht
		 * fett vorn (Laienprüfung 30.09.2026, Stelle 3); ein Treffer im
		 * Fliesstext daneben bewiese das nicht.
		 */
		const fett = telefon.locator('section.abstimmung strong', { hasText: 'mit keinem Knopf behalten' });
		behaupte(
			await fett.count(),
			`Der fette Satz zum bisherigen Beschluss fehlt: ${(await seitentext(telefon, 'body')).slice(0, 500)}`
		);
		const satz = sauber(await fett.first().innerText());
		behaupte(STIMMZETTEL.test(satz), `Der fette Satz lautet anders: «${satz}»`);
		await abschicken(ja, telefon);

		// Die Stimme vom Telefon ist angekommen: An ihrer Zeile steht «hat selbst gestimmt».
		await gehe(leitung());
		await seite.evaluate(() => {
			document
				.querySelectorAll('details:has(form[action="?/erfassen"])')
				.forEach((d) => (d.open = true));
		});
		const eigene = seite.locator('form[action="?/erfassen"] tr', { hasText: TELEFONPARTEI }).first();
		behaupte(
			/hat selbst gestimmt/.test(sauber(await eigene.innerText().catch(() => ''))),
			`An der Zeile von ${TELEFONPARTEI} steht nicht «hat selbst gestimmt»: die Stimme vom Telefon fehlt`
		);
		await erfasseStimmen([
			[LEUTE[1], 'yes'],
			[LEUTE[2], 'yes'],
			[LEUTE[3], 'no']
		]);
		await gehe(leitung());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(leitung());
		const marke = await standmarke(baumzeile(FOLGE, { genau: false }));
		behaupte(marke === 'angenommen', `Die Marke des Folgeantrags ist «${marke}»`);
		return `Stimmzettel: «${satz.slice(0, 70)}…», angenommen`;
	});

	// ── 6 ──────────────────────────────────────────────────────────────────
	await schritt('6: Leitung und Wand nennen die Ersetzung', async () => {
		// Leitung, Karte des Folgeantrags (er ist noch aufgerufen).
		await gehe(leitung());
		const karte = ergebniskarte(FOLGE);
		behaupte(await karte.count(), 'Unter «Ergebnisse» fehlt die Karte des Folgeantrags');
		const kartentext = sauber(await karte.innerText());
		behaupte(
			SATZ_FOLGEANTRAG.test(kartentext),
			`An der Karte des Folgeantrags fehlt der Ersetzungssatz: ${kartentext.slice(0, 500)}`
		);

		// Wand, Folgeantrag aufgerufen: dessen Satz (`holeAbstimmungsstand`).
		await gehe(`/versammlungen/${versammlung}/praesentation`);
		const wandFolge = await seitentext(seite, 'body');
		behaupte(
			SATZ_FOLGEANTRAG.test(wandFolge),
			`Die Wand nennt beim Folgeantrag die Ersetzung nicht: ${wandFolge.slice(0, 500)}`
		);

		// Leitung, Grundantrag aufgerufen: Satz über der Auskunft.
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND), GRUND, leitung());
		const text = await seitentext();
		behaupte(
			SATZ_GRUNDANTRAG.test(text),
			`Am aufgerufenen Grundantrag fehlt der Ersetzungssatz: ${text.slice(0, 600)}`
		);
		behaupte(
			!(await seite.locator('form[action="?/oeffnen"] button[type="submit"]').count()),
			'Am ersetzten Grundantrag steht «Abstimmung freigeben»'
		);

		/*
		 * **Die Wand nennt die Ersetzung auch am Grundantrag**
		 * (Produktentscheid 08.10.2026). Bis dahin zeigte sie dort weder
		 * Ergebnis noch Satz; gemessen am 30.09.2026 und als Produktfrage offen
		 * in `docs/freigabe.md` («Offen: Folgeantrag nach Rückkommen, aus dem
		 * Durchstich», (1)). Jetzt trägt die Traktandumsicht denselben Satz wie
		 * die Leitungsauskunft.
		 */
		await gehe(`/versammlungen/${versammlung}/praesentation`);
		const wandGrund = await seitentext(seite, 'body');
		behaupte(
			SATZ_GRUNDANTRAG.test(wandGrund),
			`Die Wand nennt beim aufgerufenen Grundantrag die Ersetzung nicht: ${wandGrund.slice(0, 500)}`
		);
		// Der ganze Satz bis zum Punkt, damit die Ausgabe ihn wörtlich trägt.
		const ganz = (t, satz) => t.match(new RegExp(`${satz.source}[^.]*(\\.[^ .][^.]*)*\\.`))?.[0] ?? '';
		return `Leitung am Grundantrag: «${ganz(text, SATZ_GRUNDANTRAG)}» ‖ Wand am Folgeantrag: «${ganz(wandFolge, SATZ_FOLGEANTRAG)}» ‖ Wand am Grundantrag: «${ganz(wandGrund, SATZ_GRUNDANTRAG)}»`;
	});

	// ── M3, Teil B ─────────────────────────────────────────────────────────
	await schritt('M3 B: Am ersetzten Grundantrag ein zweites Rückkommen, angenommen, nicht genutzt', async () => {
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND), GRUND, leitung());
		const wort = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		behaupte(await wort.count(), `Kein «Nochmals abstimmen» am ersetzten Grundantrag: ${(await seitentext()).slice(0, 300)}`);
		await wort.first().click();
		await seite.waitForTimeout(150);
		await abschicken(seite.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]').first());
		await gehe(leitung());
		const antrag = seite.locator('.baum li', { hasText: `Rückkommen auf` }).filter({ hasText: GRUND }).last();
		behaupte(await antrag.count(), 'Der zweite Rückkommensantrag steht nicht in der Liste');
		await rufeAuf(antrag, 'Rückkommen auf', leitung());
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(leitung());
		await erfasseStimmen(LEUTE.map((wer) => [wer, 'yes']));
		await gehe(leitung());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(leitung());
		const marke = await standmarke(
			seite.locator('.baum li', { hasText: 'Rückkommen auf' }).filter({ hasText: GRUND }).last()
		);
		behaupte(marke === 'angenommen', `Die Marke des zweiten Rückkommensantrags ist «${marke}»`);
		return 'zweites Rückkommen angenommen, ohne Durchgang';
	});

	// ── M3, Teil A ─────────────────────────────────────────────────────────
	await schritt('M3 A: Folgeantrag zuerst angenommen, dann der Grundantrag', async () => {
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND2), GRUND2, leitung());
		const eingriffe = seite.locator('.eingriffe').first();
		await eingriffe.locator('button.wort', { hasText: 'Gegenantrag' }).first().click();
		await seite.waitForTimeout(200);
		const form = eingriffe.locator('form[action="?/aufnehmen"]');
		behaupte(await form.count(), 'Im Feld «Gegenantrag» steht kein Aufnahmeformular');
		await form.locator('input[name="titel"]').fill(FOLGE2);
		await form.locator('textarea[name="antragswortlaut"]').fill('Eingerichtet wird nur der nördliche Veloraum.');
		await form.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(form.locator('button[type="submit"]').first());

		for (const [titel, genau] of [
			[FOLGE2, false],
			[GRUND2, true]
		]) {
			await gehe(leitung());
			await rufeAuf(baumzeile(titel, { genau }), titel, leitung());
			const frei = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
			behaupte(await frei.count(), `Bei «${titel}» steht kein «Abstimmung freigeben»: ${(await seitentext()).slice(0, 400)}`);
			await abschicken(frei.first());
			await gehe(leitung());
			await erfasseStimmen(LEUTE.map((wer) => [wer, 'yes']));
			await gehe(leitung());
			await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
			await gehe(leitung());
			const marke = await standmarke(baumzeile(titel, { genau }));
			behaupte(marke === 'angenommen', `Die Marke von «${titel}» ist «${marke}»`);
		}
		return 'beide angenommen';
	});

	await schritt('M3 A: Der Hinweis vor dem Rückkommen und nach seiner Annahme', async () => {
		// Der Grundantrag ist noch aufgerufen: Die Auskunft verweist auf das Rückkommen.
		await gehe(leitung());
		const vorher = await seitentext();
		behaupte(HINWEIS_FOLGEANTRAG.test(vorher), `Am Grundantrag fehlt der Hinweis: ${vorher.slice(0, 600)}`);

		// Im Feld «Nochmals abstimmen», neben dem Vorbehalt.
		const wort = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		await wort.first().click();
		await seite.waitForTimeout(150);
		const feld = sauber(await seite.locator('.eingriffe').first().innerText());
		behaupte(HINWEIS_FOLGEANTRAG.test(feld), `Im Feld «Nochmals abstimmen» fehlt der Hinweis: ${feld.slice(0, 600)}`);
		await abschicken(seite.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]').first());

		await gehe(leitung());
		const antrag = seite.locator('.baum li', { hasText: 'Rückkommen auf' }).filter({ hasText: GRUND2 }).last();
		behaupte(await antrag.count(), 'Der Rückkommensantrag zum Veloraum steht nicht in der Liste');
		await rufeAuf(antrag, 'Rückkommen auf', leitung());
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await gehe(leitung());
		await erfasseStimmen(LEUTE.map((wer) => [wer, 'yes']));
		await gehe(leitung());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());

		// Nach der Annahme, am wieder aufgerufenen Grundantrag: dort wählt die Leitung den Antrag.
		await gehe(leitung());
		await rufeAuf(baumzeile(GRUND2), GRUND2, leitung());
		const nachher = await seitentext();
		behaupte(/Die Versammlung ist zurückgekommen/.test(nachher), `Die Auskunft nach dem Rückkommen fehlt: ${nachher.slice(0, 400)}`);
		behaupte(HINWEIS_FOLGEANTRAG.test(nachher), `Nach dem Rückkommen fehlt der Hinweis: ${nachher.slice(0, 600)}`);
		return `«${nachher.match(HINWEIS_FOLGEANTRAG)?.[0] ?? ''} …»`;
	});

	// ── 7 ──────────────────────────────────────────────────────────────────
	await schritt('7: Versammlung schliessen, der Protokollentwurf nennt die Ersetzung', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		const knopf = seite.locator('form[action="?/schliessen"] button[type="submit"]');
		behaupte(await knopf.count(), 'Kein Knopf zum Schliessen der Versammlung');
		await abschicken(knopf.first());
		await gehe(`/versammlungen/${versammlung}`);
		behaupte(/geschlossen/i.test(await seitentext()), 'Die Versammlung gilt nicht als geschlossen');

		await gehe(`/versammlungen/${versammlung}/protokoll`);
		const entwurf = seite.locator('form[action="?/entwurf"] button[type="submit"]');
		behaupte(await entwurf.count(), `Kein Knopf für den Entwurf: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(entwurf.first());
		const feld = seite.locator('textarea[name="body"]');
		await feld.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
		const body = sauber(await feld.first().inputValue().catch(() => ''));
		behaupte(body.includes(GRUND), `Der Entwurf kennt den Grundantrag nicht: ${body.slice(0, 300)}`);
		behaupte(
			SATZ_GRUNDANTRAG.test(body),
			`Im Protokoll fehlt beim Grundantrag der Ersetzungssatz: ${body.slice(0, 200)}`
		);
		// M3, Teil B: Der Grundantrag nennt das unbenutzte zweite Rückkommen.
		behaupte(
			SATZ_ZWEITES_RUECKKOMMEN.test(body),
			`Im Protokoll fehlt beim Grundantrag der Satz zum zweiten Rückkommen: ${body.slice(0, 400)}`
		);
		return `Satz im Entwurf; «${body.match(SATZ_ZWEITES_RUECKKOMMEN)?.[0] ?? ''}»`;
	});

	await schritt('7: Wand nach dem Schluss zählt den ersetzten Grundantrag nicht als «ohne Beschluss»', async () => {
		/*
		 * **Erst der Anker in der Auswertung**: Der Grundantrag steht dort, und
		 * zwar mit dem Ersetzungssatz statt «Es wurde nicht abgestimmt.». Dieselbe
		 * `holeAuswertung` speist die Wand.
		 */
		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const zeilen = seite.locator('article.zeile');
		const grundZeile = zeilen
			.filter({ has: seite.locator('h2', { hasText: new RegExp(`^\\s*[\\d.]+\\s+${esc(GRUND)}\\s*$`) }) })
			.first();
		behaupte(await grundZeile.count(), 'Der Grundantrag fehlt in der Auswertung');
		const grundText = sauber(await grundZeile.innerText());
		behaupte(
			SATZ_GRUNDANTRAG.test(grundText),
			`In der Auswertung steht beim Grundantrag nicht der Ersetzungssatz: ${grundText.slice(0, 300)}`
		);
		const ohneAbstimmung = (await zeilen.allInnerTexts()).filter((t) =>
			sauber(t).includes('Es wurde nicht abgestimmt.')
		).length;

		/*
		 * **Dann die Wand, mit eigenem Anker**: Sie zeigt den Abschluss, und der
		 * angenommene Folgeantrag steht in der Liste der Beschlüsse. Erst danach
		 * sagt die Zahl «ohne Beschluss» etwas.
		 */
		await gehe(`/versammlungen/${versammlung}/praesentation`);
		const abschluss = seite.locator('.bild.abschluss');
		await abschluss.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
		behaupte(
			/Versammlung geschlossen/.test(sauber(await abschluss.first().innerText().catch(() => ''))),
			`Die Wand zeigt keinen Abschluss: ${(await seitentext(seite, 'body')).slice(0, 300)}`
		);
		const folgeZeile = abschluss.locator('.beschluesse li', { hasText: FOLGE });
		behaupte(await folgeZeile.count(), 'Der angenommene Folgeantrag fehlt in den Beschlüssen der Wand');
		behaupte(
			/angenommen/.test(sauber(await folgeZeile.first().innerText())),
			'Der Folgeantrag steht an der Wand nicht als angenommen'
		);
		const bilanz = sauber(await abschluss.locator('p.satz').first().innerText());
		const ohne = Number(bilanz.match(/(\d+) ohne Beschluss/)?.[1] ?? 0);
		behaupte(
			ohne === ohneAbstimmung,
			`Die Wand zählt ${ohne} ohne Beschluss, die Auswertung ${ohneAbstimmung} ohne Abstimmung: ` +
				`«${bilanz}»${ohne === ohneAbstimmung + 1 ? '; der ersetzte Grundantrag zählt mit' : ''}`
		);
		return `«${bilanz}», Auswertung ${ohneAbstimmung} ohne Abstimmung`;
	});

	// ── 8: Abend ───────────────────────────────────────────────────────────
	let tag;
	const abendVersammlung = {};
	let geltendId;
	let rueckId;
	let folgeId;
	let geschaeftId;
	const abendLeitung = () => `/tage/${tag}/leitung`;

	await schritt('8: Zwei Häuser, A mit Stichentscheid nach Wertquoten', async () => {
		const a = await legeGemeinschaftAn(' Stichhaus A', LEUTE_A, [250, 250, 250, 250], { stichentscheid: true });
		const b = await legeGemeinschaftAn(' Stichhaus B', LEUTE_B, [1000]);
		/*
		 * Wie `gemeinsamer-schritt.mjs`: Der Abend entsteht mit beiden Häusern in
		 * einem Zug, je Haus eine Versammlung. Ein Abend braucht zwei; das zweite
		 * Haus hat eine Partei und stimmt nie ab.
		 */
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.waitForTimeout(150);
		await seite.fill('input[name="bezeichnung"]', `Folgeantragsabend Prüflauf ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
		for (const id of [a, b]) {
			const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
			behaupte(await kaestchen.count(), `Haus ${id} steht nicht zur Wahl`);
			await kaestchen.check();
		}
		await abschicken(seite.locator('button[form="anlegen"]').first());
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

		// Die Versammlung je Haus aus der Liste «Es tagen mit».
		await gehe(abendLeitung());
		for (const [schluessel, name] of [
			['A', 'Stichhaus A'],
			['B', 'Stichhaus B']
		]) {
			const verweis = seite.locator('ul.haeuser a', { hasText: name }).first();
			behaupte(await verweis.count(), `${name} steht nicht unter «Es tagen mit»`);
			const ziel = await verweis.getAttribute('href');
			abendVersammlung[schluessel] = ziel?.match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
			behaupte(abendVersammlung[schluessel], `Keine Versammlung für ${name}: ${ziel}`);
		}
		return `Abend ${tag.slice(0, 8)}`;
	});

	await schritt('8: Grundantrag nur in A, einfaches Mehr, freigeben, eröffnen, anwesend', async () => {
		await gehe(`/tage/${tag}/geschaefte`);
		if ((await seite.locator('form#neu').count()) === 0) {
			await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
			await seite.waitForTimeout(250);
		}
		await seite.fill('input[name="titel"]', GRUND_ABEND);
		await seite.fill('input[name="antragswortlaut"]', 'Das Dach wird vollständig saniert.');
		const ohneB = seite.locator(`form#neu input[name="meetings"][value="${abendVersammlung.B}"]`);
		behaupte(await ohneB.count(), 'Haus B steht nicht in der Auswahl des Geschäfts');
		if (await ohneB.isChecked()) await ohneB.uncheck();
		await abschicken(seite.locator('button[form="neu"]'));
		const liste = sauber(await seite.locator('ol.liste').innerText());
		behaupte(liste.includes(GRUND_ABEND), `Der Grundantrag steht nicht in der Liste: ${liste.slice(0, 300)}`);

		// Das Erfordernis im Haus, wie `setzeErfordernis` in `abend-drei-haeuser.mjs`.
		await gehe(`/versammlungen/${abendVersammlung.A}/traktanden`);
		const eintrag = seite.locator('li[data-traktandum]').filter({ hasText: GRUND_ABEND });
		behaupte(await eintrag.count(), 'Der Grundantrag steht nicht in den Traktanden von A');
		const tid = await eintrag.first().getAttribute('data-traktandum');
		await gehe(`/versammlungen/${abendVersammlung.A}/traktanden/${tid}/erfordernis`);
		const aufklappen = seite.getByText('Erfordernis ohne Herleitung setzen').first();
		if (await aufklappen.count()) await aufklappen.click();
		const auswahl = seite.locator('select[name="typ"]').first();
		await auswahl.waitFor({ state: 'visible', timeout: 5000 });
		// Einfaches Mehr: Nur dort gibt es die Summenerfassung (`summenhindernis`).
		await auswahl.selectOption('einfaches_mehr');
		const begruendung = seite.locator('[name="begruendung"]').first();
		if (await begruendung.count()) await begruendung.fill('Prüflauf: einfaches Mehr.');
		await abschicken(seite.locator('main button[type="submit"]').last());

		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		behaupte(await alle.count(), `Keine Sammelfreigabe: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(alle.first());
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		behaupte(await eroeffnen.count(), 'Kein «eröffnen» am Eingang');
		await abschicken(eroeffnen);

		for (const wer of [...LEUTE_A, ...LEUTE_B]) {
			await gehe(`/tage/${tag}/einlass`);
			const zeile = seite
				.locator('tbody tr', { hasText: wer })
				.filter({ has: seite.locator('form[action="?/vonHand"]') })
				.first();
			behaupte(await zeile.count(), `${wer} lässt sich nicht von Hand erfassen`);
			await abschicken(zeile.locator('form[action="?/vonHand"] button').first());
		}
		await gehe(`/tage/${tag}/einlass`);
		const offen = await seite.locator('tbody tr form[action="?/vonHand"]').count();
		behaupte(offen === 0, `Nach dem Erfassen stehen noch ${offen} Zeilen mit «Von Hand erfassen»`);
		return 'fünf anwesend';
	});

	await schritt('8: Am Abend Grundantrag angenommen', async () => {
		await gehe(abendLeitung());
		const punkt = seite
			.locator('ul.alle > li')
			.filter({ hasText: GRUND_ABEND })
			.filter({ hasNotText: 'Rückkommen auf' })
			.first();
		behaupte(await punkt.count(), 'Der Grundantrag steht nicht in der Liste des Abends');
		await abschicken(punkt.locator('form[action="?/aufrufen"] button').first());
		await gehe(abendLeitung());
		const j = await jetztText();
		behaupte(j.includes(GRUND_ABEND) && j.includes('Stichhaus A'), `«Jetzt» ist nicht der Grundantrag in A: «${j}»`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button.haupt').first());
		await gehe(abendLeitung());
		await erfasseStimmen(LEUTE_A.map((wer) => [wer, 'yes']));
		await gehe(abendLeitung());
		await abschicken(seite.locator('div.offen form[action="?/schliessen"] button').first());
		await gehe(abendLeitung());
		const karte = seite.locator('.ergebnisse article').first();
		behaupte(await karte.count(), 'Nach dem Schliessen steht kein Ergebnis am Abend');
		geltendId = await geltenderDurchgangDerKarte(karte);
		behaupte(geltendId, 'Am Ergebnis des Grundantrags fehlt die Durchgangskennung');
		return `geltend ${geltendId.slice(-12)}`;
	});

	await schritt('8: Rückkommen im Haus gestellt, am Abend angenommen', async () => {
		// Gestellt wird im Haus (wie `abend-drei-haeuser.mjs`, 3b); abgestimmt am Abend.
		await gehe(`/versammlungen/${abendVersammlung.A}/leitung`);
		const wort = seite.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		behaupte(await wort.count(), `Kein «Nochmals abstimmen» im Haus A: ${(await seitentext()).slice(0, 300)}`);
		await wort.first().click();
		await seite.waitForTimeout(200);
		await abschicken(seite.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]').first());

		await gehe(abendLeitung());
		const hin = seite.locator('.rueckkommensweg form[action="?/aufrufen"] button');
		behaupte(await hin.count(), `Kein Weg zum Rückkommensantrag am Abend: ${(await seitentext()).slice(0, 300)}`);
		await abschicken(hin.first());
		await gehe(abendLeitung());
		behaupte(/Rückkommen auf/.test(await jetztText()), `«Jetzt» ist nicht der Rückkommensantrag: «${await jetztText()}»`);
		await abschicken(seite.locator('form[action="?/oeffnen"] button.haupt').first());
		await gehe(abendLeitung());
		await erfasseStimmen(LEUTE_A.map((wer) => [wer, 'yes']));
		await gehe(abendLeitung());
		await abschicken(seite.locator('div.offen form[action="?/schliessen"] button').first());
		await gehe(abendLeitung());
		const karte = seite.locator('.ergebnisse article').first();
		behaupte(await karte.count(), 'Nach dem Schliessen steht kein Ergebnis zum Rückkommensantrag');
		rueckId = await geltenderDurchgangDerKarte(karte);
		behaupte(rueckId, 'Am Ergebnis des Rückkommensantrags fehlt die Durchgangskennung');
		behaupte(rueckId !== geltendId, 'Rückkommensantrag und Grundantrag tragen dieselbe Kennung');
		return `Rückkommen ${rueckId.slice(-12)} angenommen`;
	});

	await schritt('8: Am Abend Folgeantrag nach dem Rückkommen, per Summen 2 zu 2', async () => {
		await gehe(abendLeitung());
		const weg = await rufeImAblaufAuf(GRUND_ABEND, ['Rückkommen auf']);
		behaupte(weg, `Der Grundantrag steht nicht im Dreischritt: ${(await seite.locator('ol.dreischritt').innerText()).replace(/\s+/g, ' ')}`);
		await gehe(abendLeitung());
		const j = await jetztText();
		behaupte(
			j.includes(GRUND_ABEND) && !/Rückkommen auf/.test(j),
			`«Jetzt» ist nicht der Grundantrag: «${j}»`
		);
		// Für den Ausweg beim Aufrufen, falls der Folgeantrag nicht im Fenster steht.
		geschaeftId = await seite
			.locator('form[action="?/oeffnen"] input[name="geschaeft"], .jetzt input[name="geschaeft"]')
			.first()
			.getAttribute('value')
			.catch(() => null);

		const wort = seite.locator('.eingriffe button.wort', { hasText: 'Gegenantrag' });
		behaupte(await wort.count(), 'Am Abend fehlt unter «Jetzt möglich» der «Gegenantrag»');
		await wort.first().click();
		await seite.waitForTimeout(200);
		const hilfe = sauber(await seite.locator('.eingriffe .feld p.hilfe').first().innerText());
		behaupte(hilfe.includes(HILFESATZ), `Am Abend fehlt der Hilfesatz nach dem Rückkommen: «${hilfe.slice(0, 200)}»`);
		const form = seite.locator('.eingriffe form[action="?/aufnehmen"]');
		await form.locator('input[name="titel"]').fill(FOLGE_ABEND);
		await form.locator('textarea[name="antragswortlaut"]').fill('Saniert wird nur das Vordach.');
		// Gewählt statt geerbt (Produktentscheid 08.10.2026), wie im Haus.
		await form.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		const antwort = await abschicken(form.locator('button[type="submit"]').first());
		folgeId = aktionsfelder(antwort ? await antwort.text().catch(() => '') : '')?.aufgenommen ?? null;
		behaupte(
			typeof folgeId === 'string' && /^[0-9a-f-]{36}$/.test(folgeId),
			`Keine Kennung des aufgenommenen Folgeantrags: ${folgeId}`
		);

		/*
		 * **Aufrufen über den Dreischritt; der Ausweg ist gemeldet, nicht still.**
		 * Wo der Folgeantrag nach einem Rückkommen im Ablauf steht, ist nicht
		 * gemessen (vor dem Umbau stand der Folgeantrag vor dem Rückkommen,
		 * `abend-drei-haeuser.mjs`, 3c). Steht er nicht im Fenster, geht der Aufruf
		 * an dieselbe Aktion wie der Knopf «Rückkommensantrag aufrufen»: Geschäft
		 * des Grundantrags, Traktandum des Folgeantrags.
		 */
		await gehe(abendLeitung());
		let aufruf = await rufeImAblaufAuf(FOLGE_ABEND);
		if (!aufruf) {
			behaupte(geschaeftId, 'Weder im Dreischritt noch mit Geschäftskennung aufrufbar');
			const r = await seite.evaluate(
				async ({ ziel, felder }) => {
					const fd = new FormData();
					for (const [k, v] of felder) fd.append(k, v);
					const a = await fetch(ziel, {
						method: 'POST',
						body: fd,
						headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
					});
					return { status: a.status, rohtext: await a.text() };
				},
				{
					ziel: `${ZIEL}${abendLeitung()}?/aufrufen`,
					felder: [
						['geschaeft', geschaeftId],
						['traktandum', folgeId]
					]
				}
			);
			const d = aktionsdaten(r.rohtext);
			behaupte(d?.type === 'success', `Aufruf des Folgeantrags abgewiesen: ${r.rohtext.slice(0, 300)}`);
			aufruf = 'über die Aktion, nicht im Dreischritt';
		}
		await gehe(abendLeitung());
		behaupte((await jetztText()).includes(FOLGE_ABEND), `«Jetzt» ist nicht der Folgeantrag: «${await jetztText()}»`);

		await abschicken(seite.locator('form[action="?/oeffnen"] button.haupt').first());
		const m = await meldungstext();
		await gehe(abendLeitung());
		const summenAuf = seite.locator('summary', { hasText: 'nur die Summen' }).first();
		behaupte(
			await summenAuf.count(),
			`Keine Summenerfassung am Folgeantrag (${m}): ${(await seitentext()).slice(0, 300)}`
		);
		await summenAuf.click();
		const summen = seite.locator('form[action="?/summen"]').first();
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('2');
		await summen.locator('input[name="enthaltung"]').fill('0');
		await summen.locator('input[name="vermerk"]').fill('Handzeichen, gezählt von der Sitzungsleitung im Prüflauf');
		await abschicken(summen.locator('button[type="submit"]').first());
		await gehe(abendLeitung());
		await abschicken(seite.locator('div.offen form[action="?/schliessen"] button').first());
		return `Folgeantrag ${folgeId.slice(-12)}, aufgerufen ${aufruf}`;
	});

	await schritt('8: Beim offenen Stichentscheid zielt «Neuabstimmung» auf den Folgeantrag', async () => {
		await gehe(abendLeitung());
		/*
		 * **An der Karte des Grundantrags.** Nach dem Stichentscheid ohne Beschluss
		 * ist der Durchgang des Folgeantrags überholt; die Karte, die ihn trägt,
		 * ist die des geltenden Durchgangs (`offenNachRueckkommen`).
		 */
		if (!(await jetztText()).includes(GRUND_ABEND) || /Rückkommen auf|Vordach/.test(await jetztText())) {
			const weg = await rufeImAblaufAuf(GRUND_ABEND, ['Rückkommen auf', FOLGE_ABEND]);
			if (!weg) {
				const punkt = seite
					.locator('ul.alle > li')
					.filter({ hasText: GRUND_ABEND })
					.filter({ hasNotText: 'Rückkommen auf' })
					.first();
				behaupte(await punkt.count(), 'Der Grundantrag lässt sich nicht wieder aufrufen');
				await abschicken(punkt.locator('form[action="?/aufrufen"] button').first());
			}
			await gehe(abendLeitung());
		}
		const j = await jetztText();
		behaupte(j.includes(GRUND_ABEND) && !/Rückkommen auf/.test(j) && !j.includes(FOLGE_ABEND), `«Jetzt» ist nicht der Grundantrag: «${j}»`);

		const karte = seite.locator('.ergebnisse article').first();
		behaupte(await karte.count(), 'Am Grundantrag steht keine Ergebniskarte');
		const text = sauber(await karte.innerText());
		// Anker: Die Karte ist die richtige, sie spricht von der Ersetzungslage.
		behaupte(
			/kam statt dieses Antrags der Folgeantrag/.test(text),
			`Die Karte nennt die Lage nach dem Folgeantrag nicht: ${text.slice(0, 400)}`
		);
		const geltend = await geltenderDurchgangDerKarte(karte);
		behaupte(geltend === geltendId, `Die Karte trägt nicht den geltenden Durchgang: ${geltend} statt ${geltendId}`);

		const formulare = karte.locator('form[action="?/neuabstimmung"]');
		const anzahl = await formulare.count();
		behaupte(anzahl === 1, `Es gibt ${anzahl} Neuabstimmungs-Formulare an der Karte`);
		const ziel = await formulare.first().locator('input[name="durchgang"]').getAttribute('value');
		behaupte(ziel && ziel !== geltendId, `Der Knopf zielt auf den geltenden Durchgang des Grundantrags (${ziel})`);
		behaupte(ziel !== rueckId, `Der Knopf zielt auf den Durchgang des Rückkommensantrags (${ziel})`);
		// Durch Ausschluss: In Haus A gibt es genau drei Durchgänge, und die
		// Abendseite trägt die Kennung des offenen nicht (siehe Kopf, Punkt 8).
		return `Ziel ${ziel.slice(-12)}, geltend ${geltendId.slice(-12)}`;
	});

	await schritt('8: Nach der Neuabstimmung gilt der Beschluss des Grundantrags weiter', async () => {
		const karte = seite.locator('.ergebnisse article').first();
		await karte.locator('details.neu summary').first().click();
		await karte.locator('form[action="?/neuabstimmung"] textarea[name="begruendung"]').fill(
			'Prüflauf: Stichentscheid nicht festgestellt, einzeln erfassen'
		);
		await abschicken(karte.locator('form[action="?/neuabstimmung"] button[type="submit"]').first());

		// Die Wirkung: Der geltende Durchgang ist derselbe, und im Haus steht «angenommen».
		await gehe(abendLeitung());
		const nachher = await geltenderDurchgangDerKarte(seite.locator('.ergebnisse article').first());
		behaupte(
			nachher === geltendId,
			`Nach der Neuabstimmung trägt die Karte ${nachher} statt des geltenden ${geltendId}`
		);
		await gehe(`/versammlungen/${abendVersammlung.A}/leitung`);
		const zeile = baumzeile(GRUND_ABEND);
		behaupte(await zeile.count(), 'Der Grundantrag steht nicht in der Liste des Hauses');
		const marke = await standmarke(zeile);
		behaupte(marke === 'angenommen', `Nach der Neuabstimmung ist die Marke des Grundantrags «${marke}»`);
		return 'geltender Beschluss unberührt';
	});
} catch {
	/* der Schritt hat den Fehler schon gemeldet */
} finally {
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.`);
process.exit(fehler.length ? 1 : 0);
