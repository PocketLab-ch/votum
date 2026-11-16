/**
 * Überlebt ein aufgeklappter Kasten die Hydration?
 *
 * **Der Anlass, am 26.08.2026.** Beim Bau der Eigentümerliste fiel ein
 * Durchstich zweimal über einen `<details>`-Kasten, der sich vor den Augen des
 * Benutzers wieder schloss. Erst mit `networkidle` davor lief er durch — und
 * genau das ist die falsche Behebung: Im Saal wartet niemand auf `networkidle`.
 *
 * **Was dahintersteckt.** `open={…}` an einem `<details>` ist ein gewöhnliches
 * Attribut, und Svelte setzt es bei der Hydration erneut. Es merkt sich dabei
 * den vorgefundenen Wert (`set_attribute` in `svelte/internal/client`:
 * `attributes[attribute] = element.getAttribute(attribute)`), vergleicht ihn
 * aber mit dem Ausdruck — und `''` (der Browser hat den Kasten aufgeklappt) ist
 * nicht `false` (der Server sagte «zu»). Also schreibt Svelte `element.open =
 * false`, und der Kasten klappt zu. Dasselbe gilt für `bind:open`; dort setzt
 * `bind_property` den Wert sogar ohne jede Prüfung.
 *
 * Es ist dieselbe Fehlerklasse wie `value={…}` am Textfeld und `bind:value` am
 * `<select>` — nur am Ausklapper. Das Fenster ist im Entwicklungsbetrieb
 * hunderte Millisekunden lang; im Saal, auf einem fremden Telefon über fremdes
 * Netz, ist es der Normalfall.
 *
 * **Gemessen wird zuerst an einer Seite** (`/personen/<id>`, Kasten «Angaben
 * berichtigen»):
 *
 *   1. **Vor dem Loslassen ist nichts hydriert.** Ohne diese Marke misst der
 *      Lauf womöglich ein Fenster, in dem Svelte längst übernommen hatte — und
 *      wäre grün, ohne etwas geprüft zu haben. Die Marke ist
 *      `document.documentElement.dataset.bereit`; sie wird im `onMount` des
 *      Layouts gesetzt und steht genau dafür dort.
 *   2. **Der Klick vor der Hydration klappt auf** — das tut der Browser allein,
 *      ohne jedes JavaScript. Wäre es anders, misst der Lauf danach nichts.
 *   3. **Nach der Hydration steht der Kasten noch offen.** Das ist die
 *      eigentliche Messung.
 *   4. **Der Server klappt weiterhin auf, wenn er muss.** Eine Absage des
 *      Servers (Name zu kurz) muss den Kasten öffnen — sonst steht die Meldung
 *      über einem geschlossenen Kasten, und der Weg heraus ist unsichtbar. Die
 *      Behebung darf diese Wirkung nicht mitnehmen.
 *
 * Dazu die Marke `data-ausgeliefert` selbst: vor der Hydration da und mit der
 * Antwort des Servers darin, danach verbraucht. Ohne sie bliebe offen, ob die
 * Handlung im Browser überhaupt gelaufen ist — und die Messung darüber wäre aus
 * dem falschen Grund grün.
 *
 * **Dazu zwei Messungen an anderen Stellen:**
 *
 *   * **Im Browser gebaut.** Wandert man über Verweise aus der Seite heraus und
 *     wieder hinein, baut SvelteKit den Kasten neu — im Browser, nicht auf dem
 *     Server. Er muss dann zu sein, denn es liegt keine Absage mehr vor. Diese
 *     Messung fängt die Übertreibung der Behebung ab: eine Fassung, die im
 *     Browser einfach immer aufklappt, wird hier rot.
 *   * **Das Sprungziel `#anzeigecode`** an einer laufenden Versammlung — die
 *     Gegenrichtung, aus dem Code-Review nachgetragen. Ein URL-Fragment erreicht
 *     den Server nie, seine Antwort ist dort zwangsläufig «zu»; hier **muss**
 *     der Browser aufklappen. Eine Fassung, die jeden ausgelieferten Kasten in
 *     Ruhe lässt, wird an dieser Zeile rot — nachgemessen, indem sie einmal
 *     eingesetzt wurde.
 *
 * **Aufgeräumt wird von Hand.** Alles, was der Lauf anlegt, trägt «Prüflauf» im
 * Namen — die Person «Prüflauf Ausklapper …», die Gemeinschaft gleichen Namens
 * samt Einheit und Eigentümer «Prüflauf Eigentümer», und die Versammlung am Ort
 * «Prüflauf Saal». `scripts/testdaten-entfernen.sql` räumt genau diese Muster
 * ab; ein eigener Name bliebe liegen (am 26.08.2026 sind so 27 Bestände durch
 * das Raster gefallen).
 *
 * Aufruf: `node e2e/ausklapper-vor-hydration.mjs`
 *
 * **Dieses Drehbuch bekommt `warteNachNavigation` ausdrücklich nicht**
 * (08.09.2026). Am selben Tag hat sie jedes andere Drehbuch bekommen, das
 * eine Seite bedient. Hier wäre sie genau der Fehler: Sie wartete auf die
 * Marke, die dieser Lauf erst danach sehen will, und der Durchstich wäre
 * grün, ohne etwas geprüft zu haben. Wer sie hier nachträgt, hebt die
 * Messung auf, statt sie zu vervollständigen.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { bereit } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const befunde = [];

function pruefe(name, erwartet, tatsaechlich) {
	if (erwartet === tatsaechlich) {
		console.log(`  ✓ ${name}`);
	} else {
		befunde.push(`${name}: erwartet «${erwartet}», gemessen «${tatsaechlich}»`);
		console.log(`  ✗ ${name} — erwartet «${erwartet}», gemessen «${tatsaechlich}»`);
	}
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const seite = await ctx.newPage();
seite.on('dialog', (d) => d.accept());

/*
 * **Die Bremse** — wörtlich dieselbe wie in `e2e/wahl-vor-hydration.mjs`, und
 * aus denselben Gründen: Angehalten wird nur, was der Browser als Skript holt;
 * HTML und Stilblatt kommen durch. Die Seite steht also fertig da und ist
 * bedienbar, führt aber noch kein JavaScript aus.
 *
 * Sie wird erst kurz vor der Messung eingehängt und gibt mit `fallback` ab
 * statt mit `continue` — sonst hinge sie über der Anmeldung und schickte jede
 * Anfrage neu los.
 */
const gehalten = [];
let halten = false;
const bremse = async (route) => {
	if (halten && route.request().resourceType() === 'script') {
		await new Promise((weiter) => gehalten.push(weiter));
	}
	await route.fallback().catch(() => {});
};

function loslassen() {
	halten = false;
	while (gehalten.length > 0) gehalten.pop()();
}

/**
 * Wartet, bis das Layout seine Hydrations-Marke gesetzt hat.
 *
 * Der Selektor und die Frist standen hier als dritte Kopie derselben Wache,
 * mit einer anderen Schreibweise als in `durchspielen.mjs` (Code-Review
 * 07.09.2026). Beide kommen jetzt aus `bereit.mjs`; die 600 ms danach bleiben
 * hier, denn sie sind die Eigenart dieses Laufs und nicht der Wache.
 *
 * Die **negative** Probe weiter unten («keine Marke am <html>») bleibt
 * absichtlich von Hand: Sie misst den Zustand vor der Hydration und ist das
 * Gegenteil dessen, was `bereit` tut.
 */
async function hydriert() {
	await bereit(seite);
	await seite.waitForTimeout(600);
}

const KASTEN = 'details.berichtigen';

/** Ein Formular abschicken und eine etwaige Rückfrage bestätigen. */
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
	await seite.waitForTimeout(200);
}

/**
 * Eine laufende Versammlung — Haus, Einheit, Eigentümer, Traktandum, Freigabe,
 * Eröffnung. Der Ablauf steht so in `e2e/telefonbreite.mjs`; er ist hier
 * abgeschrieben und nicht ausgelagert, weil ein gemeinsamer Aufbau die beiden
 * Läufe aneinanderbinden würde.
 */
async function laufendeVersammlung() {
	const name = `Prüflauf Ausklapper ${LAUF}`;
	await seite.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="name"]', name);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const gemeinschaft = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	if (!gemeinschaft) throw new Error('Die Gemeinschaft wurde nicht angelegt.');

	await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/einheiten`, {
		waitUntil: 'domcontentloaded'
	});
	const ef = seite.locator('form[action$="anlegen"]').first();
	await ef.locator('input[name="label"]').fill('Whg 1');
	await ef.locator('input[name="quote.stamm"]').fill('1000');
	await abschicken(ef.locator('button[type="submit"]'));

	await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/eigentuemer`, {
		waitUntil: 'domcontentloaded'
	});
	const pf = seite.locator('form[action$="anlegen"]').first();
	await pf.locator('input[name="displayName"]').fill('Prüflauf Eigentümer');
	await abschicken(pf.locator('button[type="submit"]'));

	await seite.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/eigentuemer`, {
		waitUntil: 'domcontentloaded'
	});
	await hydriert();
	const zf = seite.locator('form[action$="zuordnen"]').last();
	await waehleNachAnfang(zf.locator('select[name="unitId"]'), 'Whg 1');
	await waehleNachAnfang(zf.locator('select[name="partyId"]'), 'Prüflauf Eigentümer');
	await abschicken(zf.locator('button[type="submit"]'));

	await seite.goto(`${ZIEL}/versammlungen/neu`, { waitUntil: 'domcontentloaded' });
	await hydriert();
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', '2027-09-14');
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüflauf Saal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
	if (!versammlung) throw new Error('Die Versammlung wurde nicht angelegt.');

	await seite.goto(`${ZIEL}/versammlungen/${versammlung}/traktanden`, {
		waitUntil: 'domcontentloaded'
	});
	await hydriert();
	// Der Knopf klappt das Formular auf — geprüft statt gewartet, wie in
	// `telefonbreite.mjs`: Ein zweiter Klick auf einen offenen Block schlösse ihn.
	const titelfeld = seite.locator('form.formular input[name="titel"]').first();
	for (let versuch = 0; versuch < 4; versuch++) {
		if (await titelfeld.isVisible().catch(() => false)) break;
		await seite
			.locator('.neu button.haupt')
			.click()
			.catch(() => {});
		await seite.waitForTimeout(700);
	}
	await titelfeld.waitFor({ state: 'visible', timeout: 15000 });
	const tf = seite.locator('form.formular').first();
	await titelfeld.fill('Ersatz der Fensterläden an der Westfassade');
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf
		.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
		.first()
		.fill('Die Fensterläden an der Westfassade werden ersetzt.');
	await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
	await abschicken(tf.locator('button[type="submit"]').first());

	await seite.goto(`${ZIEL}/versammlungen/${versammlung}/freigabe`, {
		waitUntil: 'domcontentloaded'
	});
	await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]'));
	await seite.goto(`${ZIEL}/versammlungen/${versammlung}`, { waitUntil: 'domcontentloaded' });
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]'));
	console.log(`  · Laufende Versammlung steht: ${versammlung}`);
	return versammlung;
}

/**
 * Wählt in einer Liste den Eintrag, der mit dem Text **beginnt**.
 *
 * **Seit dem 27.08.2026 nötig** (Auftraggeber: «Bei 2 Einheiten zuordnen braucht es
 * noch den Filter … und wenn Personen einer Einheit zugeordnet sind, sollte
 * diese das auch anzeigen»). Die Einträge tragen jetzt mehr als die
 * Bezeichnung: «Whg 1 · Anna Muster». Ein `selectOption({ label })` sucht
 * wörtlich und fände nichts mehr.
 */
async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

try {
	console.log(`Ziel: ${ZIEL} · Lauf ${LAUF}\n`);

	// ── Anmelden ────────────────────────────────────────────────────────────
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	/*
	 * **Erst die Marke abwarten, dann tippen.** Ohne sie trifft das Ausfüllen
	 * das Fenster vor der Hydration — und beim ersten Anlauf landete das
	 * Anmeldeformular deshalb zweimal auf `/anmelden` statt durchzukommen.
	 */
	await hydriert();
	await seite.fill('input[name="username"]', BENUTZER);
	await seite.fill('input[name="kennwort"]', KENNWORT);
	await Promise.all([
		seite.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
		seite.locator('main button[type="submit"]').click()
	]);

	// ── Eine Person, an der gemessen wird ───────────────────────────────────
	const NAME = `Prüflauf Ausklapper ${LAUF}`;
	await seite.goto(`${ZIEL}/personen`, { waitUntil: 'domcontentloaded' });
	await hydriert();
	// Das Erfassungsformular steht hinter einem Knopf, den erst Svelte öffnet.
	await seite.locator('section.anlegen button.klappe').click();
	await seite.fill('section.anlegen input[name="name"]', NAME);
	await Promise.all([
		seite.waitForURL(/\/personen\/[^/]+$/, { timeout: 30000 }),
		seite.locator('section.anlegen button[type="submit"]').click()
	]);
	const pfad = new URL(seite.url()).pathname;
	console.log(`  · Prüfbestand steht: «${NAME}» unter ${pfad}\n`);

	// ── Die Messung: klicken, bevor das Skript da ist ────────────────────────
	/*
	 * `waitUntil: 'commit'` und nicht `'domcontentloaded'`: Ein
	 * `<script type="module">` ist aufgeschoben, und aufgeschobene Skripte halten
	 * `DOMContentLoaded` auf. Mit angehaltenem Skript käme das Ereignis nie.
	 */
	await ctx.route('**/*', bremse);
	halten = true;
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'commit' });
	await seite.waitForSelector(`${KASTEN} > summary`, { timeout: 30000 });

	pruefe(
		'Vor dem Loslassen ist nichts hydriert (keine Marke am <html>)',
		0,
		await seite.locator('html[data-bereit="1"]').count()
	);

	const kasten = seite.locator(KASTEN).first();
	pruefe('Vor der Hydration steht der Kasten zu', false, await kasten.evaluate((k) => k.open));
	/*
	 * **Die Marke des Servers.** `aufgeklappt()` hängt sie an jeden Kasten, den
	 * der Server ausliefert; im Browser sagt sie der Handlung «hier steht im DOM
	 * schon, was gilt — nicht anfassen». Sie wird beim ersten Lauf verbraucht.
	 * Steht sie nachher noch da, ist die Handlung gar nicht gelaufen, und die
	 * Messung darunter wäre aus dem falschen Grund grün.
	 */
	pruefe(
		'Der Server liefert die Marke data-ausgeliefert mit — und seine Antwort darin',
		'zu',
		await kasten.evaluate((k) => k.getAttribute('data-ausgeliefert'))
	);

	await kasten.locator('> summary').click();
	pruefe(
		'Der Klick vor der Hydration klappt ihn auf (das tut der Browser allein)',
		true,
		await kasten.evaluate((k) => k.open)
	);

	loslassen();
	await hydriert();

	console.log('');
	pruefe(
		'Nach der Hydration steht der Kasten noch offen',
		true,
		await kasten.evaluate((k) => k.open)
	);
	pruefe(
		'Und die Marke ist verbraucht — die Handlung ist gelaufen',
		false,
		await kasten.evaluate((k) => k.hasAttribute('data-ausgeliefert'))
	);
	await ctx.unroute('**/*', bremse);

	// ── Der Server muss ihn weiterhin aufklappen können ──────────────────────
	console.log('');
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await hydriert();
	pruefe('Ohne Absage steht der Kasten zu', false, await kasten.evaluate((k) => k.open));

	/*
	 * Ein Name aus einem Zeichen: Das Feld trägt kein `minlength`, der Browser
	 * lässt ihn also durch — und der Kern weist ihn ab («Der Name fehlt oder ist
	 * zu kurz», Feld `name`). Genau dafür steht das `open` an diesem Kasten.
	 */
	await kasten.locator('> summary').click();
	await seite.fill(`${KASTEN} input[name="name"]`, 'X');
	await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
		seite.locator(`${KASTEN} button[type="submit"]`).first().click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await hydriert();

	pruefe(
		'Nach der Absage des Servers steht der Kasten offen',
		true,
		await kasten.evaluate((k) => k.open)
	);
	pruefe(
		'Und die Absage steht daneben',
		1,
		await seite.locator('.meldung, [class*="meldung"]').filter({ hasText: 'Name' }).count()
	);

	// ── Im Browser gebaut: ohne Grund bleibt er zu ───────────────────────────
	console.log('');
	await seite.locator('p.pfad a[href="/personen"]').click();
	await seite.waitForURL(/\/personen$/, { timeout: 30000 });
	await hydriert();
	/*
	 * **Die Liste zeigt nicht alles auf einmal** (`LISTENGRENZE = 25`). Bis zum
	 * 27.08.2026 wurde hier gesucht; seit `brauchtSuchfeld` steht das Suchfeld
	 * erst ab neun Personen, und bei zweien lief das `fill` in die
	 * Zeitüberschreitung. Statt zu suchen wird die Kürzung aufgehoben, falls es
	 * eine gibt. Der Klick danach muss in jedem Fall treffen: Findet er den
	 * Verweis nicht, wird der Schritt laut, statt still das Falsche zu messen.
	 */
	const alleZeigen = seite.locator('p.mehr button', { hasText: 'anzeigen' });
	if (await alleZeigen.count()) {
		await alleZeigen.first().click();
		await seite.waitForTimeout(200);
	}
	await seite.locator(`a[href="${pfad}"]`).first().click();
	await seite.waitForURL(new RegExp(`${pfad.replace(/[/]/g, '\\/')}$`), { timeout: 30000 });
	await seite.waitForTimeout(500);
	pruefe(
		'Im Browser neu gebaut und ohne Absage: der Kasten bleibt zu',
		false,
		await kasten.evaluate((k) => k.open)
	);
	/*
	 * **Und er trägt keine Marke.** Das ist die andere Hälfte der Regel: Ein
	 * Kasten ohne Marke ist einer, den der Browser selbst gebaut hat — an ihm
	 * setzt die Handlung `open`, denn im DOM steht sonst nichts. Ohne diese
	 * Messung bliebe offen, ob der Weg für eine Wanderung über Verweise
	 * überhaupt noch trägt.
	 */
	pruefe(
		'Und er trägt keine Marke des Servers',
		false,
		await kasten.evaluate((k) => k.hasAttribute('data-ausgeliefert'))
	);

	// ── Das Sprungziel: der Browser weiss mehr als der Server ────────────────
	/*
	 * **Die dritte Zeile der Tabelle in `$lib/felder`** — und der Befund, der
	 * dieses Stück hier ausgelöst hat (26.08.2026, aus dem Code-Review).
	 *
	 * Der Kasten «Code für die Leinwand» klappt auf, wenn man von der
	 * Sitzungsleitung aus dorthin springt: `angesprungen = page.url.hash ===
	 * '#anzeigecode'`. Ein URL-Fragment erreicht den Server aber **nie** — beim
	 * Rendern dort ist `page.url.hash` immer leer. Der Server liefert den Kasten
	 * also zwangsläufig zu, und erst im Browser stellt sich heraus, dass er offen
	 * gehört.
	 *
	 * Eine Fassung, die jeden ausgelieferten Kasten unangetastet lässt, hätte das
	 * still verloren: Wer den Verweis in einem neuen Tab öffnet, neu lädt oder
	 * ein Lesezeichen aufruft, landete auf einem geschlossenen Kasten. Deshalb
	 * wird es hier gemessen und nicht behauptet.
	 *
	 * Dafür braucht es eine **laufende** Versammlung — den Kasten gibt es nur
	 * dort. Der Aufbau folgt dem von `e2e/telefonbreite.mjs`.
	 */
	console.log('');
	const versammlung = await laufendeVersammlung();

	await seite.goto(`${ZIEL}/versammlungen/${versammlung}`, { waitUntil: 'domcontentloaded' });
	await hydriert();
	const anzeige = seite.locator('details.anzeige').first();
	pruefe(
		'Ohne Sprungziel steht der Kasten «Code für die Leinwand» zu',
		false,
		await anzeige.evaluate((k) => k.open)
	);

	/*
	 * **Wieder mit angehaltenem Skript**, und zwar nicht aus Vorsicht: Ein
	 * `goto` mit `domcontentloaded` wartet auf die aufgeschobenen Module, die
	 * Hydration ist dann längst durch. Beim ersten Anlauf stand der Kasten
	 * deshalb schon offen, und die Messung hätte den ausgelieferten Zustand nie
	 * gesehen.
	 *
	 * **Und erst weg von dieser Seite.** Hängt man an die *aktuelle* Adresse nur
	 * ein Fragment an, ist das für den Browser eine Bewegung **im selben
	 * Dokument**: Er lädt nichts nach, der Server wird nie gefragt, und gemessen
	 * würde die längst hydrierte Seite. Beim zweiten Anlauf genau so passiert —
	 * Marke `null`, Kasten offen. (Dass der Kasten dabei aufging, zeigt
	 * nebenbei, dass auch dieser Weg trägt.)
	 */
	await seite.goto(`${ZIEL}/versammlungen`, { waitUntil: 'domcontentloaded' });
	await ctx.route('**/*', bremse);
	halten = true;
	await seite.goto(`${ZIEL}/versammlungen/${versammlung}#anzeigecode`, { waitUntil: 'commit' });
	await seite.waitForSelector('details.anzeige > summary', { timeout: 30000 });
	pruefe(
		'Der Server liefert ihn mit Sprungziel zu — das Fragment erreicht ihn nie',
		'zu',
		await anzeige.evaluate((k) => k.getAttribute('data-ausgeliefert'))
	);
	pruefe('Und er steht vor der Hydration wirklich zu', false, await anzeige.evaluate((k) => k.open));

	loslassen();
	await hydriert();
	pruefe(
		'Nach der Hydration steht er offen — der Browser wusste mehr als der Server',
		true,
		await anzeige.evaluate((k) => k.open)
	);
	await ctx.unroute('**/*', bremse);
} catch (fehler) {
	befunde.push(`Der Lauf brach ab: ${fehler.message}`);
	console.error(fehler);
} finally {
	await browser.close();
}

console.log('');
if (befunde.length > 0) {
	console.log(`${befunde.length} Befund(e):`);
	for (const b of befunde) console.log(`  · ${b}`);
	process.exit(1);
}
console.log('Keine Befunde — der Ausklapper übersteht die Hydration.');
