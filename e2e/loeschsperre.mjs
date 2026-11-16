/**
 * Die Sperre am Knopf «Gemeinschaft entfernen» — in beide Richtungen.
 *
 * **Der Auftrag** (Auftraggeber, 15.09.2026): «Bei "Gemeinschaft entfernen" anzeigen,
 * ob bei der ausgewählten Gemeinschaft bereits etwas anhängt, wenn ja, den
 * Button für das Entfernen eingrauen und nicht anklickbar machen.»
 *
 * **Warum beide Richtungen und nicht nur die Sperre.** Ein Durchstich, der nur
 * prüft, dass der Knopf bei einer Versammlung grau ist, bliebe auch dann grün,
 * wenn der Knopf **immer** grau wäre — und das wäre der schlimmere Fehler: Die
 * Gemeinschaft liesse sich nie mehr entfernen, und niemand wüsste warum. Hier
 * wird deshalb dasselbe Objekt dreimal angesehen:
 *
 *   1. frisch angelegt, nichts dran  → Knopf offen
 *   2. eine Versammlung dazu         → Knopf gesperrt, mit Grund
 *   3. Versammlung wieder weg        → Knopf wieder offen, Entfernen gelingt
 *
 * Schritt 3 räumt zugleich auf: Was dieser Lauf anlegt, nimmt er wieder mit.
 *
 * **Gemessen wird die Wirkung, nicht die Beschriftung.** Ob der Knopf gesperrt
 * ist, steht in `disabled`; ob der Grund ankommt, steht im Text daneben. Beides
 * zusammen, denn ein gesperrter Knopf ohne Grund ist eine Sackgasse, und ein
 * Grund an einem offenen Knopf ist eine Falschaussage.
 *
 * Aufruf: `node e2e/loeschsperre.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);

/** Heute in der Zeitzone, in der die Anwendung rechnet. */
const HEUTE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
/*
 * **Der Name trägt ein Muster, das das Aufräumskript kennt.**
 * `scripts/testdaten-entfernen.sql` erkennt Wegwerfbestand an acht Präfixen,
 * und «Prüflauf» ist eines davon. Die erste Fassung hiess «Prüfhaus …» — sie
 * fiel durch jedes Raster und wäre bei jedem Lauf einmal liegengeblieben.
 * Derselbe Grund gilt für den Ort der Versammlung weiter unten.
 */
const NAME = `Prüflauf Löschsperre ${Date.now()}`;

let nr = 0;
const fehler = [];
let seite;

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ${String(nr).padStart(2)} ✓ ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${String(nr).padStart(2)} ✗ ${titel} — ${e.message}`);
	}
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

async function abschicken(knopf) {
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(120);
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) await ja.first().click();
	await antwort;
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
}

/**
 * Der Knopf im Abschnitt «Gemeinschaft entfernen».
 *
 * Über den Abschnitt gegriffen und nicht über die Beschriftung: Der Name der
 * Gemeinschaft steht im Knopftext, und ein Lauf, der ihn aus einer Variablen
 * zusammensetzt, bricht beim ersten Sonderzeichen.
 */
function entfernenKnopf() {
	return seite.locator('section.entfernen button').first();
}

const browser = await chromium.launch();
try {
	seite = await browser.newPage();
	console.log(`\nLöschsperre — ${ZIEL}\n`);

	let stwegId = null;
	let versammlungId = null;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung nicht durchgekommen');
		return `als ${BENUTZER}`;
	});

	await schritt('Eine leere Gemeinschaft anlegen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		const fundstelle = seite.locator('input[name="headCountRuleSource"]');
		if (await fundstelle.count()) await fundstelle.fill('Musterreglement Ziff. 14');
		await abschicken(seite.locator('main button[type="submit"]').first());
		stwegId = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
		behaupte(stwegId && stwegId !== 'neu', `Nicht angelegt, Adresse ${seite.url()}`);
		return stwegId;
	});

	await schritt('Ohne Anhang steht der Knopf offen', async () => {
		await gehe(`/gemeinschaften/${stwegId}/angaben`);
		const knopf = entfernenKnopf();
		behaupte(await knopf.count(), 'Kein Knopf im Abschnitt «Gemeinschaft entfernen»');
		behaupte(!(await knopf.isDisabled()), 'Der Knopf ist gesperrt, obwohl nichts dranhängt');
		// Und der Grund darf nicht dastehen, wenn es keinen gibt.
		behaupte(
			(await seite.locator('section.entfernen p.haengt').count()) === 0,
			'Es steht ein Hinderungsgrund da, obwohl nichts dranhängt'
		);
		return 'offen, ohne Grund';
	});

	await schritt('Eine Versammlung anlegen', async () => {
		await gehe(`/gemeinschaften/${stwegId}/versammlungen/neu`);
		await seite.fill('input[name="datum"]', HEUTE);
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüflauf Löschsperre');
		await abschicken(seite.locator('button[form="anlegen"]'));
		versammlungId = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
		behaupte(versammlungId, `Keine Versammlung angelegt, Adresse ${seite.url()}`);
		return versammlungId.slice(0, 8);
	});

	await schritt('Jetzt ist der Knopf gesperrt — und sagt warum', async () => {
		await gehe(`/gemeinschaften/${stwegId}/angaben`);
		const knopf = entfernenKnopf();
		behaupte(await knopf.isDisabled(), 'Der Knopf ist offen, obwohl eine Versammlung dranhängt');

		const lang = await seite.locator('section.entfernen p.haengt').innerText();
		behaupte(
			lang.includes('eine Versammlung'),
			`Der lange Satz nennt die Versammlung nicht: «${lang.slice(0, 120)}»`
		);
		behaupte(
			lang.includes(NAME),
			'Der lange Satz nennt die Gemeinschaft nicht beim Namen — auf einer Liste ' +
				'gleichnamiger Häuser ist das der Unterschied'
		);

		/*
		 * **Der Grund steht VOR dem Knopf, nicht dahinter.** Hier stand einmal
		 * eine zweite, kurze Begründung unter dem Knopf; sie ist nach dem
		 * Code-Review entfallen, weil sie Vorlesehilfen nicht erreichte und den
		 * Numerus brach. Was bleibt, muss in der Lesereihenfolge vor dem
		 * Widerstand kommen — sonst liest man erst «gesperrt» und dann warum.
		 */
		const reihenfolge = await seite.locator('section.entfernen').evaluate((s) => {
			const p = s.querySelector('p.haengt');
			const k = s.querySelector('button');
			if (!p || !k) return 'fehlt';
			return p.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING
				? 'grund zuerst'
				: 'knopf zuerst';
		});
		behaupte(
			reihenfolge === 'grund zuerst',
			`Der Grund steht nicht vor dem Knopf: ${reihenfolge}`
		);
		return 'gesperrt, Grund davor';
	});

	await schritt('Am Knopf vorbei weist der Server ab', async () => {
		/*
		 * **Der Schritt, auf den es ankommt.**
		 *
		 * Hier stand zuerst ein Klick mit `force` auf den gesperrten Knopf. Der
		 * Code-Review hat ihn zu Recht verworfen: Der Schritt davor stellt schon
		 * fest, dass `disabled` gesetzt ist, und ein `disabled`-Knopf sendet
		 * nie — der Klick konnte nichts finden, was nicht schon entschieden war.
		 * Grün gebaut statt gemessen.
		 *
		 * Gemessen wird stattdessen die Schranke, die wirklich hält: Das Formular
		 * geht ohne Knopf und ohne Browser direkt an die Aktion. So sendet auch
		 * jemand, der das `disabled` im Entwicklerwerkzeug entfernt, und so
		 * sendet der Fall, der sich nicht verhindern lässt — zwischen dem Laden
		 * der Seite und dem Absenden legt jemand anders eine Versammlung an.
		 *
		 * Erwartet wird eine Absage und **kein** Vollzug. Käme hier eine 303,
		 * wäre die Gemeinschaft weg, und der graue Knopf wäre die einzige
		 * Sicherung gewesen, die es gab.
		 */
		const antwort = await seite.request.post(
			`${ZIEL}/gemeinschaften/${stwegId}/angaben?/entfernen`,
			{ form: {}, failOnStatusCode: false }
		);
		behaupte(
			antwort.status() !== 303 && antwort.status() < 500,
			`Unerwarteter Status ${antwort.status()} — 303 hiesse vollzogen, 5xx ein roher Fehler`
		);

		const steht = await seite.request.get(`${ZIEL}/gemeinschaften/${stwegId}/angaben`);
		behaupte(
			steht.status() === 200,
			`Die Gemeinschaft ist weg (Status ${steht.status()}) — der Riegel im Vollzug fehlt`
		);
		return `Status ${antwort.status()}, Gemeinschaft steht`;
	});

	await schritt('Versammlung entfernen', async () => {
		/*
		 * **Zwei Stufen, und die zweite ist die, die wirkt** (gefunden beim ersten
		 * Lauf dieses Durchstichs). Der erste Klick holt nur die Rückfrage vom
		 * Server — sie nennt Traktanden und Dateien, die mitgehen. Erst der Knopf
		 * darin trägt `bestaetigt=ja` und löscht.
		 *
		 * Die erste Fassung dieses Schrittes klickte einmal und meldete «gelöscht».
		 * Sie war grün, die Versammlung stand noch, und der Schritt danach machte
		 * daraus den Befund «die Sperre klebt» — an der Anwendung, die recht hatte.
		 * Deshalb steht am Ende eine Messung und keine Erfolgsmeldung.
		 */
		await gehe(`/versammlungen/${versammlungId}`);
		const form = seite.locator('form[action="?/loeschen"]');
		behaupte(await form.count(), 'Kein Weg, die Versammlung zu löschen');
		await abschicken(form.locator('button').first());

		const bestaetigen = seite.locator('form[action="?/loeschen"] button.gefahr');
		behaupte(
			await bestaetigen.count(),
			'Die Rückfrage vor dem Löschen kam nicht — ohne sie löscht der erste Klick nichts'
		);
		await abschicken(bestaetigen);

		const antwort = await seite.request.get(`${ZIEL}/versammlungen/${versammlungId}`);
		behaupte(
			antwort.status() === 404,
			`Die Versammlung steht noch (Status ${antwort.status()})`
		);
		return 'gelöscht und nachgemessen';
	});

	await schritt('Ohne Versammlung ist der Knopf wieder offen', async () => {
		await gehe(`/gemeinschaften/${stwegId}/angaben`);
		const knopf = entfernenKnopf();
		behaupte(
			!(await knopf.isDisabled()),
			'Der Knopf bleibt gesperrt, obwohl die Versammlung weg ist — die Sperre klebt'
		);
		return 'wieder offen';
	});

	await schritt('Und das Entfernen gelingt', async () => {
		await abschicken(entfernenKnopf());
		await seite.waitForTimeout(400);
		// Die Gemeinschaft ist weg, wenn ihre Angabenseite nicht mehr trägt.
		const antwort = await seite.request.get(`${ZIEL}/gemeinschaften/${stwegId}/angaben`);
		behaupte(
			antwort.status() === 404,
			`Die Gemeinschaft steht noch (Status ${antwort.status()})`
		);
		return 'entfernt, Bestand sauber';
	});

	if (versammlungId || stwegId) {
		// Wenn oben etwas schieflief, bleibt hier ein Rest stehen. Das ist keine
		// Panne, sondern die Ansage: Der Lauf sagt, was er liegen lässt.
		const rest = await seite.request.get(`${ZIEL}/gemeinschaften/${stwegId}/angaben`);
		if (rest.status() !== 404) {
			console.log(`\n  Hinweis: «${NAME}» steht noch im Bestand (/gemeinschaften/${stwegId}).`);
		}
	}
} finally {
	await browser.close();
}

console.log('');
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün.`);
