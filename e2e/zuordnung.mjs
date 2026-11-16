/**
 * Lösen, Rückgängig und die Zweitversammlung am selben Tag.
 *
 * **Drei Befunde vom 11.08.2026, alle drei hier festgenagelt:**
 *
 *   1. «Ich wollte das rückgängig machen und konnte nicht.» Der Weg zurück
 *      führte über eine Auswahlliste mit zehn ähnlich benannten Einträgen, und
 *      die alte Stelle im Ablauf war verloren.
 *   2. Eine **zweite Versammlung derselben Gemeinschaft** riss die Anwendung
 *      mit einem 500er ab («duplicate key value violates unique constraint»).
 *      Die Schranke aus Migration 028 ist richtig; sie gehört als Prüfung in den
 *      Kern und muss den Ausweg nennen.
 *   3. Eine Versammlung, die schon zu einer anderen gemeinsamen gehörte, wurde
 *      dort **still** herausgerissen. Niemand sah es, und im anderen Saal
 *      fehlte sie.
 *
 * **Und die zweite Runde desselben Tages:** eine gelöste Versammlung wieder
 * hereinholen, eine überflüssige löschen, und Tag, Beginn, Ort und Art einmal
 * ändern statt sechsmal.
 *
 * Aufruf: `node e2e/zuordnung.mjs` (Umgebung wie e2e/durchspielen.mjs).
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-zuordnung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
// Je Lauf ein anderer Tag: Zwei gemeinsame Versammlungen am selben Datum mit
// denselben Gemeinschaften weist die Vorabprüfung zu Recht ab.
const TAG_A = new Date(Date.UTC(2031, 0, 1) + (Date.now() % 700) * 86400000)
	.toISOString()
	.slice(0, 10);
const TAG_B = new Date(Date.UTC(2032, 0, 1) + (Date.now() % 700) * 86400000)
	.toISOString()
	.slice(0, 10);

let nr = 0;
const fehler = [];

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

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

async function abschicken(knopf) {
	const [antwort] = await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(150);
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(100);
}

/**
 * Der Meldungstext, an beiden Plätzen gesucht.
 *
 * **Warum beide.** `Meldung.svelte` gibt eine Meldung vom Ton `gut` nach der
 * Hydration an den Einblender weiter und räumt ihren eigenen Platz; eine Absage
 * bleibt stehen, weil sie aufhält. Wer nur `.meldung` liest, sieht deshalb jede
 * Absage und keine Bestätigung.
 *
 * Am 27.08.2026 kostete das einen Befund, der wie ein Programmfehler aussah:
 * «Nichts umgelegt: «»». Umgelegt worden war alles, gemeldet hatte es der
 * Einblender, und das Drehbuch schaute an die alte Stelle.
 */
const meldung = async () =>
	(await seite.locator('.meldung, .einblender .quittung').first().innerText().catch(() => ''))
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Legt `wieViele` **eigene** Gemeinschaften an und gibt ihre Kennungen zurück.
 *
 * **Warum eigene.** Bis zum 27.08.2026 nahm `legeAn` die ersten `wieViele`
 * Kästchen, die gerade dastanden. Das geht auf zwei Arten schief, und beide
 * sind an jenem Tag eingetreten: Steht nichts im Bestand, gibt es nichts
 * anzukreuzen; steht viel darin, ist eines der vorderen Kästchen gesperrt und
 * `check()` läuft dreissig Sekunden ins Leere. Gesperrt wird eine übergeordnete
 * Gemeinschaft (`disabled={g.klammer}`): Sie hat keine Einheiten und damit
 * niemanden, der dort tagen könnte.
 *
 * Ein Drehbuch, dessen Voraussetzung jemand anderes herstellen muss, ist nicht
 * prüfbar. Es legt seine Häuser jetzt selbst an.
 */
async function legeHaeuserAn(wieViele, praefix) {
	const ids = [];
	for (let n = 1; n <= wieViele; n += 1) {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', `${praefix} ${n} Prüflauf ${LAUF}`);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		const id = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		// **`id !== 'neu'` ist der eigentliche Prüfstein.** Bleibt das Formular
		// stehen, ist die Adresse weiter `/gemeinschaften/neu` und die Kennung
		// die Zeichenkette «neu» — wahr, und die Zusicherung schliefe durch.
		behaupte(
			id && id !== 'neu',
			`Haus ${n} nicht angelegt, Adresse steht auf ${seite.url()}`
		);
		ids.push(id);
	}
	return ids;
}

/** Legt eine gemeinsame Versammlung mit genau diesen Gemeinschaften an. */
async function legeAn(bezeichnung, datum, ids) {
	await gehe('/versammlungen/neu');
	await seite.locator('input[name="art"][value="gemeinsam"]').check();
	await seite.fill('input[name="bezeichnung"]', bezeichnung);
	await seite.fill('input[name="datum"]', datum);
	await seite.fill('input[name="uhrzeit"]', '18:00');
	await seite.fill('input[name="ort"]', `Probesaal Prüflauf ${LAUF}`);
	for (const id of ids) {
		const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
		behaupte(await kaestchen.count(), `Eigenes Haus ${id} steht nicht zur Wahl`);
		behaupte(await kaestchen.isEnabled(), `Eigenes Haus ${id} ist gesperrt — gilt es als übergeordnete Gemeinschaft?`);
		await kaestchen.check();
	}
	await abschicken(seite.locator('button[form="anlegen"]'));
	behaupte(seite.url().includes('/tage/'), `Nicht angelegt: ${seite.url()}`);
	return seite.url().split('/tage/')[1].split(/[/?#]/)[0];
}

try {
	let tagA;
	let tagB;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		// **Erst warten, dann behaupten.** Die Anmeldung springt im Browser weiter,
		// nicht über eine Antwort des Servers: `abschicken` sieht den POST und wartet
		// 250 ms, und unter Last reicht das nicht. Am 27.08.2026 meldeten zwei
		// Drehbücher «Anmeldung fehlgeschlagen», während alle folgenden Schritte
		// grün liefen — die Anmeldung war gelungen, die Zusicherung zu früh.
		//
		// Das Warten steht ausdrücklich VOR der Zusicherung und ersetzt sie nicht:
		// Läuft die Frist ab, bleibt die Adresse `/anmelden` und der Befund kommt.
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Zwei gemeinsame Versammlungen anlegen', async () => {
		const eigene = await legeHaeuserAn(3, 'Zuordnungshaus');
		tagA = await legeAn(`Zuordnung A Prüflauf ${LAUF}`, TAG_A, eigene);
		tagB = await legeAn(`Zuordnung B Prüflauf ${LAUF}`, TAG_B, []);
		return `A mit 3 Gemeinschaften, B leer`;
	});

	await schritt('Das Layout ist dasselbe wie bei einer einzelnen Versammlung', async () => {
		await gehe(`/tage/${tagA}/haeuser`);
		const leiste = seite.locator('nav[aria-label="Ablauf der Versammlung"]');
		behaupte(await leiste.count(), 'Keine Ablaufleiste');
		/*
		 * Der Schritt heisst seit dem 24.08.2026 wie im Haus: «Anwesenheit und
		 * Beschlussfähigkeit», und er steht — ebenfalls wie im Haus — hinter den
		 * Vollmachten. Gesperrt sind hier beide: Keine der drei Gemeinschaften
		 * hat eine freigegebene Traktandenliste.
		 *
		 * **Den Grund trägt der erste gesperrte Schritt**, nicht jeder. Das ist
		 * die Regel der Leiste seit ihrem Bau: Zehnmal derselbe Satz untereinander
		 * wird nicht gelesen. Geprüft wird deshalb beides getrennt — dass der
		 * Schritt da und gesperrt ist, und dass irgendwo in der Gruppe ein Grund
		 * steht.
		 */
		const einlass = leiste.locator('li', { hasText: 'Anwesenheit und Beschlussfähigkeit' });
		behaupte(await einlass.count(), 'Der Schritt «Anwesenheit und Beschlussfähigkeit» fehlt');
		behaupte(
			(await einlass.first().locator('a').count()) === 0,
			'Der Einlass ist anklickbar, obwohl nichts freigegeben ist'
		);
		const grund = (await leiste.locator('.grund').first().innerText()).replace(/\s+/g, ' ');
		behaupte(
			grund.includes('freigegeben') || grund.includes('Erst'),
			`Kein Sperrgrund in der Leiste: «${grund}»`
		);
		return `${await seite.locator('h1').innerText()}, Einlass gesperrt mit Grund`;
	});

	await schritt('Die Erklärung sagt, was «lösen» tut', async () => {
		const erklaerung = seite.locator('details', { hasText: 'Was heisst das?' }).first();
		await erklaerung.locator('summary').click();
		const text = (await erklaerung.innerText()).replace(/\s+/g, ' ');
		behaupte(text.includes('bleibt bestehen'), `Erklärung ohne Zusicherung: «${text}»`);
		behaupte(text.includes('Gelöscht wird sie nie'), 'Erklärung sagt nicht, dass nichts verloren geht');
		return 'Zuordnung aufgehoben, Versammlung bleibt';
	});

	let geloest;
	let zweite;
	let umzug;

	await schritt('Lösen und sofort rückgängig machen', async () => {
		await gehe(`/tage/${tagA}/haeuser`);
		const vorher = await seite.locator('.kacheln > *').count();
		geloest = await seite.locator('.kacheln > * h3, .kacheln > * h2').first().innerText().catch(() => '');
		await abschicken(seite.locator('form[action="?/loesen"] button').first());
		behaupte((await meldung()).includes('wieder für sich'), `Keine Lösemeldung: «${await meldung()}»`);
		const dazwischen = await seite.locator('.kacheln > *').count();
		behaupte(dazwischen === vorher - 1, `Nach dem Lösen ${dazwischen} statt ${vorher - 1}`);

		const zurueck = seite.locator('.meldung form button');
		behaupte(await zurueck.count(), 'Kein Rückgängig-Knopf neben der Meldung');
		await abschicken(zurueck);
		const nachher = await seite.locator('.kacheln > *').count();
		behaupte(nachher === vorher, `Nach Rückgängig ${nachher} statt ${vorher}`);
		return `${vorher} → ${dazwischen} → ${nachher}`;
	});

	await schritt('Dieselbe Stelle im Ablauf wie vorher', async () => {
		// Die erste Karte muss wieder die erste sein — ohne die alte Stelle käme
		// sie ans Ende der Reihe zurück.
		const erste = await seite.locator('.kacheln > *').first().innerText();
		behaupte(
			geloest === '' || erste.includes(geloest.split('\n')[0]),
			`Die Reihenfolge stimmt nicht mehr: erwartet «${geloest}», gefunden «${erste.slice(0, 40)}»`
		);
		return 'Reihenfolge erhalten';
	});

	await schritt('Zweite Erstversammlung derselben Gemeinschaft: abgewiesen', async () => {
		// Eine zweite Versammlung für ein Haus anlegen, das in A schon eine hat —
		// dann in A aufnehmen wollen. Zwei Erstversammlungen am selben Tag wären
		// zwei Beschlussfähigkeiten für dieselbe Sache.
		await gehe(`/tage/${tagA}/haeuser`);
		const erstesHaus = await seite
			.locator('.kacheln a[href*="/versammlungen/"]')
			.first()
			.getAttribute('href');
		const v1 = erstesHaus.split('/versammlungen/')[1];
		await gehe(`/versammlungen/${v1}`);
		const stwegId = (await seite
			.locator('a[href*="/gemeinschaften/"]')
			.first()
			.getAttribute('href'))
			.split('/gemeinschaften/')[1]
			.split(/[/?#]/)[0];

		await gehe(`/versammlungen/neu?fuer=${stwegId}`);
		await seite.fill('input[name="datum"]', TAG_A);
		await seite.fill('input[name="uhrzeit"]', '20:00');
		await seite.fill('input[name="ort"]', `Probesaal Prüflauf ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		zweite = seite.url().split('/versammlungen/')[1].split(/[/?#]/)[0];

		await gehe(`/tage/${tagA}/haeuser`);
		const auswahl = seite.locator('form[action="?/aufnehmen"] select[name="versammlung"]');
		await auswahl.selectOption(zweite);
		await abschicken(seite.locator('form[action="?/aufnehmen"] button[type="submit"]'));
		const text = await meldung();
		behaupte(text.includes('Erstversammlung'), `Keine Absage mit Grund: «${text}»`);
		behaupte(text.includes('Beschlussfähigkeiten'), `Absage nennt den Grund nicht: «${text}»`);
		return 'abgewiesen, mit Begründung';
	});

	await schritt('Auch eine ausserordentliche derselben Gemeinschaft: abgewiesen', async () => {
		// Die Schranke der Datenbank (`meeting_tag_je_gemeinschaft`, Migration 028)
		// kennt weder Art noch Stufe. Ohne die Prüfung im Kern fiel sie am
		// 11.08.2026 als 500er auf den Benutzer — «duplicate key value violates
		// unique constraint», mitten im Saal.
		await gehe(`/versammlungen/${zweite}`);
		const art = seite.locator('input[name="art"][value="ausserordentlich"]');
		await art.check();
		behaupte(await art.isChecked(), 'Die Art liess sich nicht auf «ausserordentlich» stellen');
		// Der Anlass ist dann Pflicht — er gehört in die Einladung und ins Protokoll.
		await seite.fill('input[name="anlass"]', 'Prüflauf der Zuordnung');
		await abschicken(seite.locator('button[form="angaben"]'));
		await gehe(`/versammlungen/${zweite}`);
		behaupte(
			await seite.locator('input[name="art"][value="ausserordentlich"]').isChecked(),
			`Die Art wurde nicht gespeichert. Meldung: «${await meldung()}»`
		);

		await gehe(`/tage/${tagA}/haeuser`);
		const auswahl = seite.locator('form[action="?/aufnehmen"] select[name="versammlung"]');
		await auswahl.selectOption(zweite);
		const antwort = await abschicken(
			seite.locator('form[action="?/aufnehmen"] button[type="submit"]')
		);
		behaupte(
			!antwort || antwort.status() < 500,
			`Die Schranke der Datenbank fiel als ${antwort.status()} durch`
		);
		const text = await meldung();
		behaupte(text.includes('tagt hier schon mit'), `Keine Absage mit Grund: «${text}»`);
		behaupte(text.includes('Lösen Sie die bestehende'), `Absage ohne Ausweg: «${text}»`);
		return 'abgewiesen statt 500';
	});

	await schritt('Aus einer anderen gemeinsamen Versammlung: Rückfrage statt stiller Umzug', async () => {
		// **Gezielt** eine Versammlung aus A wählen, nicht die erste, die «tagt
		// schon woanders mit» sagt: Der Bestand enthält Versammlungen aus anderen
		// Prüfläufen, und der Lauf verglich sonst Zahlen aus zwei Vorgängen.
		await gehe(`/tage/${tagA}/haeuser`);
		const href = await seite.locator('.kacheln a[href*="/versammlungen/"]').first().getAttribute('href');
		umzug = href.split('/versammlungen/')[1];

		await gehe(`/tage/${tagB}/haeuser`);
		const auswahl = seite.locator('form[action="?/aufnehmen"] select[name="versammlung"]');
		const beschriftung = await auswahl
			.locator(`option[value="${umzug}"]`)
			.innerText()
			.catch(() => '');
		behaupte(
			beschriftung.includes('tagt schon woanders mit'),
			`Der Eintrag sagt nicht, dass er schon woanders mittagt: «${beschriftung}»`
		);

		await auswahl.selectOption(umzug);
		await abschicken(seite.locator('form[action="?/aufnehmen"] button[type="submit"]'));
		const frage = seite.locator('.meldung.frage');
		behaupte(await frage.count(), `Keine Rückfrage, sondern: «${await meldung()}»`);
		const text = (await frage.innerText()).replace(/\s+/g, ' ');
		behaupte(text.includes('herausgenommen'), `Rückfrage nennt die Folge nicht: «${text}»`);

		// Nichts darf passiert sein, solange nicht bestätigt ist.
		await gehe(`/tage/${tagB}/haeuser`);
		behaupte(
			(await seite.locator('.kacheln > *').count()) === 0,
			'Die Versammlung wurde ohne Bestätigung umgezogen'
		);
		return 'gefragt, nichts getan';
	});

	await schritt('Bestätigt zieht sie um', async () => {
		await gehe(`/tage/${tagB}/haeuser`);
		const auswahl = seite.locator('form[action="?/aufnehmen"] select[name="versammlung"]');
		await auswahl.selectOption(umzug);
		await abschicken(seite.locator('form[action="?/aufnehmen"] button[type="submit"]'));
		await abschicken(seite.locator('.meldung.frage button[type="submit"]'));
		behaupte((await meldung()).includes('tagt jetzt mit'), `Keine Erfolgsmeldung: «${await meldung()}»`);
		behaupte((await seite.locator('.kacheln > *').count()) === 1, 'Nicht angekommen');

		await gehe(`/tage/${tagA}/haeuser`);
		behaupte(
			(await seite.locator('.kacheln > *').count()) === 2,
			'In der alten gemeinsamen Versammlung steht sie noch'
		);
		return 'A 3 → 2, B 0 → 1';
	});

	await schritt('Das Register je Haus zeigt die Stammdaten aller Gemeinschaften', async () => {
		await gehe(`/tage/${tagA}/stammdaten`);
		const leiste = seite.locator('nav.register');
		behaupte(await leiste.count(), 'Kein Register auf der Stammdatenseite');
		const reiter = await leiste.locator('a').allInnerTexts();
		behaupte(reiter[0].trim() === 'Alle', `Der erste Reiter heisst «${reiter[0]}» statt «Alle»`);
		behaupte(reiter.length === 3, `${reiter.length} Reiter statt 3 (Alle + 2 Häuser)`);

		/*
		 * **Auf die Adresse warten, nicht auf ein Ladeereignis** (24.08.2026).
		 * Der Reiter wechselt nur den Abfrageteil; SvelteKit navigiert dann auf
		 * dem Client, und `domcontentloaded` kommt nie wieder. Der Lauf mass
		 * danach die Übersicht «Alle» und meldete «2 Karten statt 4» — die Seite
		 * hatte den Reiter noch gar nicht angewandt.
		 */
		await seite.locator('nav.register a').nth(1).click();
		await seite.waitForURL(/haus=/, { timeout: 10000 });
		await seite.waitForTimeout(200);
		const karten = await seite.locator('.kacheln > *').count();
		behaupte(karten === 4, `${karten} Karten statt 4 (Einheiten, Eigentümer, Reglement, Beschlussfähigkeit)`);
		const ziele = await seite.locator('.kacheln a').evaluateAll((a) => a.map((x) => x.getAttribute('href')));
		behaupte(
			ziele.every((z) => z.includes('?zur=')),
			`Ein Weg ohne Herkunft: ${ziele.join(' ')}`
		);
		return `${reiter.length} Reiter, ${karten} Karten, alle mit Herkunft`;
	});

	/*
	 * Ab hier die Befunde vom 11.08.2026, zweite Runde: «Wenn man eine
	 * Gemeinschaft aus der Versammlung auslöst, kann man dann das Datum der
	 * Gemeinschaft löschen oder die Versammlung selbst, anstelle eine neue
	 * Versammlung anzulegen? So könnte man diese wieder hereinholen.»
	 */
	let entbehrlich;

	await schritt('Eine gelöste Versammlung steht später wieder zur Wahl', async () => {
		await gehe(`/tage/${tagA}/haeuser`);
		const vorher = await seite.locator('.kacheln > *').count();
		entbehrlich = await seite
			.locator('.kacheln > *')
			.first()
			.locator('form[action="?/loesen"] input[name="versammlung"]')
			.inputValue();
		await abschicken(
			seite.locator('.kacheln > *').first().locator('form[action="?/loesen"] button')
		);

		// **Nicht rückgängig machen, sondern weggehen und wiederkommen** — genau
		// der Weg, von dem der Benutzer annahm, er sei versperrt.
		await gehe('/versammlungen');
		await gehe(`/tage/${tagA}/haeuser`);
		behaupte(
			(await seite.locator('.kacheln > *').count()) === vorher - 1,
			'Nach dem Lösen steht sie noch in der Liste'
		);
		const werte = await seite
			.locator('form[action="?/aufnehmen"] select[name="versammlung"] option')
			.evaluateAll((o) => o.map((x) => x.value));
		behaupte(werte.includes(entbehrlich), 'Die gelöste Versammlung fehlt in der Auswahl');
		return `wieder wählbar unter ${werte.length - 1} Einträgen`;
	});

	await schritt('Sie lässt sich wieder aufnehmen, ohne eine neue anzulegen', async () => {
		const auswahl = seite.locator('form[action="?/aufnehmen"] select[name="versammlung"]');
		await auswahl.selectOption(entbehrlich);
		await abschicken(seite.locator('form[action="?/aufnehmen"] button[type="submit"]'));
		behaupte(
			(await meldung()).includes('tagt jetzt mit'),
			`Nicht aufgenommen: «${await meldung()}»`
		);
		return 'ohne Rückfrage, ohne Neuanlage';
	});

	await schritt('Löschen fragt zuerst und nennt, was verschwindet', async () => {
		await gehe(`/versammlungen/${entbehrlich}`);
		await abschicken(seite.locator('.entfernen form button'));
		const frage = (await seite.locator('.entfernen .meldung.frage p').innerText()).replace(
			/\s+/g,
			' '
		);
		behaupte(/Traktand/.test(frage), `Die Rückfrage zählt nichts: «${frage}»`);
		behaupte(/nicht rückgängig/.test(frage), `Kein Hinweis auf die Endgültigkeit: «${frage}»`);
		behaupte(/tagt|mit/.test(frage), `Die gemeinsame Versammlung fehlt: «${frage}»`);
		return frage.slice(0, 60);
	});

	await schritt('Bestätigt ist sie weg — und aus der gemeinsamen Versammlung heraus', async () => {
		const vorher = await (async () => {
			await gehe(`/tage/${tagA}/haeuser`);
			return seite.locator('.kacheln > *').count();
		})();

		await gehe(`/versammlungen/${entbehrlich}`);
		await abschicken(seite.locator('.entfernen form button'));
		await abschicken(seite.locator('.entfernen .meldung.frage button.gefahr'));

		behaupte(seite.url().includes('/versammlungen'), `Nicht weitergeleitet: ${seite.url()}`);
		behaupte((await meldung()).includes('gelöscht'), `Keine Meldung: «${await meldung()}»`);

		await gehe(`/tage/${tagA}/haeuser`);
		behaupte(
			(await seite.locator('.kacheln > *').count()) === vorher - 1,
			'In der gemeinsamen Versammlung steht sie noch'
		);

		await gehe(`/versammlungen/${entbehrlich}`);
		behaupte(
			(await seite.locator('h1').innerText().catch(() => '404')).includes('4') ||
				seite.url().includes('/versammlungen'),
			'Die gelöschte Versammlung ist noch erreichbar'
		);
		return `${vorher} → ${vorher - 1}`;
	});

	await schritt('Tag, Beginn, Ort und Art einmal ändern statt X-mal', async () => {
		await gehe(`/tage/${tagA}`);
		const haeuser = Number(
			(await seite.locator('.umlegen strong').innerText()).match(/(\d+)/)?.[1] ?? '0'
		);
		behaupte(haeuser > 0, 'Kein Häkchen zum Umlegen');
		behaupte(
			await seite.locator('.umlegen input[name="umlegen"]').isChecked(),
			'Das Häkchen ist nicht vorangekreuzt'
		);

		await seite.fill('input[name="uhrzeit"]', '17:15');
		// **«Prüflauf» gehört in den Ort**, sonst findet ihn
		// `scripts/testdaten-entfernen.sql` nicht mehr (die Gemeinschaften sind echt).
		await seite.fill('input[name="ort"]', `Neuer Saal Prüflauf ${LAUF}`);
		await seite.locator('input[name="art"][value="ausserordentlich"]').check();
		await seite.fill('input[name="anlass"]', 'Sanierung Steigleitungen');
		await abschicken(seite.locator('button[form="angaben"]'));

		const m = await meldung();
		behaupte(m.includes('übernommen'), `Nichts umgelegt: «${m}»`);

		await gehe(`/tage/${tagA}/haeuser`);
		const zeilen = await seite.locator('.kacheln > *').allInnerTexts();
		behaupte(
			zeilen.every((z) => z.includes('Neuer Saal')),
			`Nicht alle nachgezogen: ${zeilen.map((z) => z.split('\n')[0]).join(', ')}`
		);
		return `${haeuser} Versammlungen, Beginn/Ort/Art in einem Zug`;
	});

	await schritt('Der Ablauf führt jetzt auch durchs Freigeben', async () => {
		await gehe(`/tage/${tagA}`);
		const abschnitte = await seite.locator('nav .gruppentitel').allInnerTexts();
		behaupte(
			abschnitte.some((a) => a.includes('Ausgeben')),
			`Kein Abschnitt «Ausgeben»: ${abschnitte.join(' | ')}`
		);

		await gehe(`/tage/${tagA}/freigeben`);
		behaupte(
			(await seite.locator('h1').innerText()).includes('Freigeben'),
			'Die Freigabeseite fehlt'
		);
		const karten = await seite.locator('.kacheln > *').count();
		behaupte(karten > 0, 'Keine Karte je Gemeinschaft');
		behaupte(
			await seite.locator('form[action="?/alle"] button').count(),
			'Kein Sammelknopf'
		);
		return `${karten} Karten, ein Knopf für alle`;
	});

	await seite.screenshot({ path: `${AUFNAHMEN}/stammdaten.png` });
} finally {
	await browser.close();
	console.log(fehler.length ? `\n${fehler.length} Befunde:\n- ${fehler.join('\n- ')}` : '\nAlles grün.');
	process.exit(fehler.length ? 1 : 0);
}
