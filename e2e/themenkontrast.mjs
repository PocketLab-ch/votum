/**
 * Ist die Anwendung im dunklen Thema lesbar?
 *
 * **Der Anlass, am 01.09.2026** (Auftraggeber): «Bei der KI-Korrektur ist beim
 * Vorher-Text helle Schrift auf hellem Hintergrund. So kann man den Text nicht
 * lesen.»
 *
 * Die Anwendung hat zwei Themen. Welches gilt, entscheidet `src/app.html` vor
 * dem ersten Anstrich: eine gespeicherte Wahl, sonst die Systemeinstellung.
 * Kein Prüflauf und kein Drehbuch hat das dunkle je angesehen — alle liefen im
 * hellen. An 26 Stellen stand deshalb eine feste Farbe im Stilblock, unter
 * anderem `background: #fff` unter der Modellantwort. Im dunklen Thema ist
 * `--text` fast weiss; das ergab weisse Schrift auf weissem Grund.
 *
 * **Warum zusätzlich zum Quellwächter.** `scripts/check-themenfarben.mjs`
 * verbietet feste Farben im Stilblock. Das schliesst die Ursache, die es
 * gegeben hat — aber nicht die andere Richtung: Zwei Token, die beide sauber
 * gesetzt sind und trotzdem zu wenig Kontrast zueinander haben, sind für den
 * Quellwächter in Ordnung. Gemessen wird hier deshalb das, worauf es ankommt:
 * was am Bildschirm herauskommt.
 *
 * **Was dieser Lauf NICHT sieht, und warum er trotzdem nötig ist.** Die
 * Kästen mit der Modellantwort erscheinen erst, wenn ein Modell geantwortet
 * hat; ohne eingerichtete KI sind sie nicht zu erreichen, und ein Drehbuch, das
 * ein Sprachmodell befragt, wäre weder wiederholbar noch bezahlbar. Für genau
 * diese Stellen ist `scripts/check-themenfarben.mjs` der Träger: Er liest die
 * Quelle und braucht die Seite nicht. Dieser Lauf deckt die andere Hälfte ab,
 * die der Quellwächter nicht sehen kann — zwei Token, die beide sauber gesetzt
 * sind und trotzdem zu wenig Kontrast zueinander haben. Genau so wurde der
 * «Nein»-Knopf am Telefon gefunden.
 *
 * **Gemessen wird der Kontrast nach WCAG**, gegen den effektiven Hintergrund —
 * also den ersten Vorfahren, der nicht durchsichtig ist. Die Schranke ist
 * bewusst der harte Boden 3.0 und nicht die Stufe AA (4.5). Der Grund steht bei
 * `SCHRANKE`.
 *
 * Aufruf: `node e2e/themenkontrast.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { messeKontrast } from './kontrast.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-themenkontrast';

/**
 * **3.0, nicht 4.5.**
 *
 * WCAG AA verlangt 4.5 für gewöhnlichen Text. Diese Schranke ist ein Wächter
 * gegen den Fehler, den es gab — Text, den man **gar nicht** lesen kann —, und
 * kein Barrierefreiheitsaudit. Unter 3.0 ist Schrift auf ihrem Grund praktisch
 * unsichtbar; zwischen 3.0 und 4.5 ist sie schlecht, aber lesbar.
 *
 * Ein Wächter, der beim Einbau schon rot ist, wird abgeschaltet statt gelesen.
 * Wer die Stufe AA angehen will: `SCHRANKE=4.5 node e2e/themenkontrast.mjs`
 * zeigt die Liste, ohne dass der Prüflauf daran hängt.
 */
const SCHRANKE = Number(process.env.SCHRANKE ?? 3.0);

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const befunde = [];
let seitenGeprueft = 0;
let elementeGemessen = 0;

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
/*
 * **`colorScheme: 'dark'` statt `localStorage`**: Das Skript in `app.html`
 * fragt zuerst die gespeicherte Wahl und fällt sonst auf `prefers-color-scheme`
 * zurück. Über die Systemeinstellung geht der Lauf denselben Weg wie das
 * Gerät des Auftraggebers — und prüft nebenbei mit, dass dieser Weg überhaupt greift.
 */
const ctx = await browser.newContext({
	viewport: { width: 1280, height: 900 },
	colorScheme: 'dark'
});
const seite = await ctx.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
seite.on('dialog', (d) => d.accept());

async function abschicken(knopf) {
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(150);
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) await ja.first().click();
	await antwort;
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
}

async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

async function miss(name, pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(400);
	seitenGeprueft++;

	const ergebnis = await messeKontrast(seite, SCHRANKE);

	elementeGemessen += ergebnis.gemessen;

	/*
	 * **Je Seite eine Untergrenze, nicht nur in der Summe** (Code-Review
	 * 01.09.2026). Eine Route, die 404 oder 500 liefert, hat eine Fehlerseite mit
	 * einer Handvoll Textstellen — in der Gesamtsumme über neunzehn Seiten geht
	 * das unter, und der Lauf meldet «lesbar», ohne die Seite gesehen zu haben.
	 *
	 * **12 und nicht 25** (zweite Reviewrunde): Die Saalsicht ist mit Absicht
	 * textarm und misst je nach Versammlungsstand um die 30 Stellen. Eine
	 * Schranke fünf Stellen darunter wäre ein Wächter, der beim nächsten
	 * Zustandswechsel rot wird, ohne dass etwas kaputt ist — und der wird
	 * abgeschaltet statt gelesen. Eine Fehlerseite trägt eine Handvoll; 12
	 * trennt beides sicher.
	 */
	if (ergebnis.gemessen < 12) {
		befunde.push(
			`${name} (${pfad}): nur ${ergebnis.gemessen} Textstellen — die Seite kam nicht zustande.`
		);
		console.log(`  ✗ ${name} — nur ${ergebnis.gemessen} Textstellen, die Seite kam nicht zustande`);
		return;
	}

	if (ergebnis.treffer.length > 0) {
		// Nur der schlimmste je Bauart: Eine Liste mit vierzig gleichen Zeilen
		// wird überflogen, nicht gelesen.
		const jeBauart = new Map();
		for (const t of ergebnis.treffer) {
			const bisher = jeBauart.get(t.wie);
			if (!bisher || t.wert < bisher.wert) jeBauart.set(t.wie, t);
		}
		for (const t of jeBauart.values()) {
			befunde.push(
				`${name} (${pfad}): ${t.wie} hat Kontrast ${t.wert} — ${t.schrift} auf ${t.grund}: «${t.text}»`
			);
		}
		console.log(`  ✗ ${name} — ${jeBauart.size} Stelle(n) unter ${SCHRANKE}`);
		for (const t of jeBauart.values()) console.log(`      ${t.wie} ${t.wert}  «${t.text}»`);
		await seite
			.screenshot({ path: `${AUFNAHMEN}/dunkel-${name.replace(/\W+/g, '-')}.png`, fullPage: true })
			.catch(() => {});
	} else {
		console.log(`  ✓ ${name} (${ergebnis.gemessen} Textstellen)`);
	}
}

try {
	console.log(`Ziel: ${ZIEL} · dunkles Thema · Schranke ${SCHRANKE} · Lauf ${LAUF}\n`);

	// **Drei Versuche wie in `durchspielen`** (zweite Reviewrunde): Der erste
	// Lauf starb hier am Zeitablauf, der zweite lief grün. Ein Drehbuch, das an
	// der Anmeldung scheitert, meldet nichts über das, was es prüfen soll.
	let angemeldet = false;
	for (let versuch = 0; versuch < 3 && !angemeldet; versuch++) {
		try {
			await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
			await seite.fill('input[name="username"]', BENUTZER);
			await seite.fill('input[name="kennwort"]', KENNWORT);
			await Promise.all([
				seite.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
				seite.locator('main button[type="submit"]').click()
			]);
			angemeldet = true;
		} catch (fehler) {
			if (versuch === 2) throw fehler;
			await seite.waitForTimeout(1000);
		}
	}

	/*
	 * **Die Sichtprobe auf das Thema selbst.** Ohne sie wäre der ganze Lauf im
	 * hellen Thema grün — und hätte nichts geprüft. Genau diese Art von stillem
	 * Fehlgriff hat in diesem Repo schon mehrere Wächter dauerhaft grün gehalten.
	 */
	const thema = await seite.evaluate(() => document.documentElement.dataset.theme);
	if (thema !== 'dark') {
		throw new Error(
			`Die Seite steht auf «${thema}» statt «dark» — der Lauf würde das helle Thema messen.`
		);
	}
	console.log('  Thema: dark (über die Systemeinstellung gesetzt)\n');

	const NAME = `Prüflauf Themenkontrast ${LAUF}`;
	await seite.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="name"]', NAME);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const gemeinschaft = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];

	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/einheiten`, {
			waitUntil: 'domcontentloaded'
		});
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill('500');
		await abschicken(ef.locator('button[type="submit"]'));

		await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/eigentuemer`, {
			waitUntil: 'domcontentloaded'
		});
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(wer);
		await abschicken(pf.locator('button[type="submit"]'));

		await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/eigentuemer`, {
			waitUntil: 'domcontentloaded'
		});
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
		await abschicken(zf.locator('button[type="submit"]'));
	}

	await seite.goto(`${ZIEL}/versammlungen/neu`, { waitUntil: 'domcontentloaded' });
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', '2027-09-14');
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];

	console.log('');
	await miss('Übersicht', '/');
	await miss('Versammlungen', '/versammlungen');
	await miss('Gemeinschaften', '/gemeinschaften');
	await miss('Einheiten und Wertquoten', `/gemeinschaften/${gemeinschaft}/einheiten`);
	await miss('Eigentümer', `/gemeinschaften/${gemeinschaft}/eigentuemer`);
	await miss('Angaben der Gemeinschaft', `/gemeinschaften/${gemeinschaft}/angaben`);
	await miss('Reglement und Quoren', `/gemeinschaften/${gemeinschaft}/reglement`);
	await miss('Personen', '/personen');
	await miss('Betreiber', '/betreiber');
	await miss('Versammlung', `/versammlungen/${versammlung}`);
	await miss('Traktanden', `/versammlungen/${versammlung}/traktanden`);
	await miss('Sitzungsleitung', `/versammlungen/${versammlung}/leitung`);
	await miss('Anwesenheit', `/versammlungen/${versammlung}/anwesenheit`);
	await miss('Einlass', `/versammlungen/${versammlung}/einlass`);
	await miss('Auswertung', `/versammlungen/${versammlung}/auswertung`);
	await miss('Protokoll', `/versammlungen/${versammlung}/protokoll`);
	await miss('Verlauf', '/verlauf');

	/*
	 * **Die Erfordernisseite trug neun der behobenen Regeln** und stand in der
	 * ersten Fassung dieser Liste nicht (Code-Review 01.09.2026). Ein Durchstich,
	 * der die geänderten Stellen nicht besucht, misst etwas anderes als das, was
	 * er belegen soll.
	 */
	/*
	 * **Die Kennung kommt aus `data-traktandum`**, nicht aus einem Verweis: Der
	 * Verweis «Jetzt bestimmen» steht nur bei einem Traktandum OHNE Erfordernis,
	 * und die Vorlage setzt bei allen eines. Der zweite Anlauf las sie aus der
	 * Sitzungsleitung — die zeigt ihre Aufrufknöpfe aber erst, wenn die
	 * Versammlung läuft. Beide Male meldete der Lauf die Seite als unerreichbar,
	 * und beide Male war die Meldung richtig: Er kam wirklich nicht hin.
	 */
	await seite.goto(`${ZIEL}/versammlungen/${versammlung}/traktanden`, {
		waitUntil: 'domcontentloaded'
	});
	const kennung = await seite
		.locator('[data-traktandum]')
		.first()
		.getAttribute('data-traktandum')
		.catch(() => null);
	if (kennung) {
		await miss('Mehrheitserfordernis', `/versammlungen/${versammlung}/traktanden/${kennung}/erfordernis`);
	} else {
		befunde.push('Keine Traktandumkennung gefunden — die Erfordernisseite blieb ungeprüft.');
		console.log('  ✗ Erfordernisseite nicht erreichbar');
	}

	// Die Saalsicht: Sie hängt an der Wand, und dort ist das dunkle Thema der
	// Normalfall, nicht die Ausnahme.
	await miss('Saalsicht der Versammlung', `/versammlungen/${versammlung}/praesentation`);
	/*
	 * Die Saalsicht des gemeinsamen Abends braucht einen Abend — den legt dieser
	 * Lauf nicht an. Sie wird vom internen Verbund-Drehbuch gefahren; hier stünde
	 * sonst ein Aufruf, der auf eine Fehlerseite läuft und trotzdem grün ist.
	 */

	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}, Versammlung ${versammlung}`);
} finally {
	await browser.close();
}

console.log('');
/*
 * **Die zweite Sichtprobe: hat der Lauf überhaupt etwas gemessen?** Ein
 * Filter, der versehentlich null Elemente trifft, ist dauerhaft grün und sieht
 * von aussen genauso aus wie ein sauberes Ergebnis.
 */
if (seitenGeprueft < 15 || elementeGemessen < 300) {
	console.log(
		`Der Lauf hat nur ${seitenGeprueft} Seiten und ${elementeGemessen} Textstellen gesehen — das misst nichts.`
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.log(`${befunde.length} Stelle(n) unter Kontrast ${SCHRANKE} im dunklen Thema:`);
	for (const b of befunde) console.log(`  · ${b}`);
	console.log(`\nAufnahmen in ${AUFNAHMEN}`);
	process.exit(1);
}
console.log(
	`Im dunklen Thema lesbar: ${elementeGemessen} Textstellen auf ${seitenGeprueft} Seiten, alle über Kontrast ${SCHRANKE}.`
);
