/**
 * Überlebt eine Wahl im Auswahlfeld die Hydration?
 *
 * **Der Anlass, am 26.08.2026.** Beim Umbau der Auswahlfelder auf
 * `Suchauswahl.svelte` fiel `e2e/telefonbreite.mjs` über eine Stelle, an der
 * niemand einen Fehler vermutet hatte: Das Drehbuch füllt unmittelbar nach dem
 * Aufbau der Seite aus — und traf damit jedes Mal das Fenster **vor der
 * Hydration**. Gewählt war «Whg 1», nach der Hydration stand das Feld wieder
 * auf «— wählen —».
 *
 * Der Grund ist `bind:value` am `<select>`: Svelte schreibt beim Aufbau den
 * gebundenen Wert in das Feld zurück. Im Saal wird die Anwendung auf fremden
 * Telefonen benutzt, über fremdes Netz; wer dort wählt, bevor das Skript da
 * ist, verliert seine Wahl wortlos — das Formular ist unvollständig, und der
 * Knopf tut beim Drücken nichts.
 *
 * **Warum ein eigener Durchstich und nicht bloss ein Wächter über die
 * Schreibweise.** Der Wächter `versammlung/gefuehrte-auswahl` prüft, dass
 * niemand `bind:value` an ein `<select>` schreibt. Er kann aber nicht prüfen,
 * ob der Weg, den wir stattdessen gehen, wirklich trägt — das sagt nur eine
 * Messung im Browser. Hier wird sie gemacht: Skript anhalten, wählen, Skript
 * loslassen, nachsehen.
 *
 * **Gemessen wird an drei Feldern derselben Seite**, weil sie drei Fälle
 * abdecken:
 *
 *   1. `select[name="kind"]` — ein festes Dreierfeld, dessen Wert die Anzeige
 *      **treibt**: Auf «eine andere Gemeinschaft» verschwindet das Häkchen
 *      «Gemeinschaftliches Eigentum». Bleibt die Wahl stehen **und** folgt die
 *      Anzeige, ist beides in Ordnung — der Wert im Feld und der Wert im
 *      Programm.
 *   2. `select[name="partyId"]` — der Baustein `Suchauswahl` mit neun
 *      Einträgen. Er hat den Weg vorgemacht; hier steht er als Gegenprobe, dass
 *      die Messung einen heilen Fall auch als heil erkennt.
 *   3. Das Suchfeld des Bausteins (`input.auswahlsuche`) ist zugleich die
 *      **Marke, dass die Hydration wirklich gelaufen ist**: Es erscheint erst
 *      in `onMount`. Ohne diese Marke misst der Durchstich womöglich ein Fenster,
 *      in dem noch gar nichts hydriert war — und wäre grün, ohne etwas geprüft
 *      zu haben.
 *
 * **Dazu eine zweite Messung an der Fallauswahl** (`Erfordernisauswahl.svelte`).
 * Sie steht überall hinter einem Knopf, den erst JavaScript öffnet — ein Fenster
 * vor der Hydration gibt es dort also gar nicht. Was sie an eigener Mechanik
 * mitbringt, ist die andere Hälfte derselben Umstellung: Der Gewählte bleibt in
 * der Liste, gleich was im Suchfeld steht. Fiele er heraus, stellte der Browser
 * das Feld auf den ersten Eintrag um, und abgeschickt würde ein Fall, den
 * niemand gewählt hat. Gemessen wird genau das.
 *
 * **Aufgeräumt wird von Hand**: Der Lauf legt eine Gemeinschaft «Prüflauf
 * Hydration …» an; `scripts/testdaten-entfernen.sql` räumt alles ab, was
 * «Prüflauf» im Namen trägt.
 *
 * Aufruf: `node e2e/wahl-vor-hydration.mjs`
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

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
/**
 * So viele Eigentümer, dass der Baustein sein Suchfeld einblendet.
 *
 * Die Schwelle steht in `src/lib/domain/listensuche.ts` bei acht, neun Einträge sind der
 * kleinste Bestand, an dem das Suchfeld erscheint, und genau daran erkennt
 * dieser Lauf, dass die Hydration durch ist.
 */
const EIGENTUEMER = 9;

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const befunde = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const seite = await ctx.newPage();
seite.on('dialog', (d) => d.accept());

/*
 * **Die Bremse.** Angehalten wird, was der Browser als Skript holt — in der
 * Entwicklungsfassung sind das die Module von Vite, in der gebauten das Bündel.
 * Das ausgelieferte HTML kommt durch, das Stilblatt auch: Die Seite steht also
 * fertig da und ist bedienbar, nur führt sie noch kein JavaScript aus. Genau
 * das ist das Fenster, um das es geht.
 *
 * **Sie wird erst kurz vor der Messung eingehängt, und sie gibt mit `fallback`
 * ab statt mit `continue`.** Beim ersten Anlauf hing sie über dem ganzen Lauf
 * und schickte jede Anfrage neu los — die Anmeldung kam damit nie durch, das
 * Formular landete zweimal auf `/anmelden`. `fallback` lässt die Anfrage
 * unangetastet weiterlaufen, statt sie nachzubauen.
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

function pruefe(name, erwartet, tatsaechlich) {
	if (erwartet === tatsaechlich) {
		console.log(`  ✓ ${name}`);
	} else {
		befunde.push(`${name}: erwartet «${erwartet}», gemessen «${tatsaechlich}»`);
		console.log(`  ✗ ${name} — erwartet «${erwartet}», gemessen «${tatsaechlich}»`);
	}
}

try {
	console.log(`Ziel: ${ZIEL} · Lauf ${LAUF}\n`);

	// ── Anmelden ────────────────────────────────────────────────────────────
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="username"]', BENUTZER);
	await seite.fill('input[name="kennwort"]', KENNWORT);
	await Promise.all([
		seite.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
		seite.locator('main button[type="submit"]').click()
	]);

	// ── Ein Prüfbestand, gross genug für das Suchfeld ────────────────────────
	const NAME = `Prüflauf Hydration ${LAUF}`;
	await seite.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="name"]', NAME);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const gemeinschaft = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	if (!gemeinschaft) throw new Error('Die Gemeinschaft wurde nicht angelegt.');

	const pfad = `/gemeinschaften/${gemeinschaft}/eigentuemer`;
	for (let i = 1; i <= EIGENTUEMER; i++) {
		await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(`Prüfer ${i}`);
		await abschicken(pf.locator('button[type="submit"]'));
	}
	console.log(`  · Prüfbestand steht: ${EIGENTUEMER} Eigentümer in «${NAME}»\n`);

	// ── Die Messung ──────────────────────────────────────────────────────────
	/*
	 * `waitUntil: 'commit'` und nicht `'domcontentloaded'`: Ein
	 * `<script type="module">` ist aufgeschoben, und aufgeschobene Skripte halten
	 * `DOMContentLoaded` auf. Mit angehaltenem Skript käme das Ereignis nie, und
	 * der Lauf bliebe im `goto` stehen, statt zu messen.
	 */
	await ctx.route('**/*', bremse);
	halten = true;
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'commit' });
	await seite.waitForSelector('form[action$="anlegen"] select[name="kind"]', { timeout: 30000 });

	const hydriertVorher = await seite.locator('input.auswahlsuche').count();
	pruefe('Vor dem Loslassen ist nichts hydriert (kein Suchfeld)', 0, hydriertVorher);

	const artfeld = seite.locator('form[action$="anlegen"] select[name="kind"]');
	await artfeld.selectOption('gemeinschaft');
	const bausteinfeld = seite.locator('form[action$="zuordnen"] select[name="partyId"]');
	/*
	 * **Nach dem Anfang, nicht wörtlich** (27.08.2026). Die Einträge des
	 * Zuordnungsfeldes tragen seit heute auch, welche Einheiten der Eigentümer
	 * hält: «Prüfer 5 · noch keine Einheit». Ein `{ label }` sucht wörtlich.
	 */
	const texte = await bausteinfeld.locator('option').allTextContents();
	const stelle = texte.findIndex((t) => t.trim().startsWith('Prüfer 5'));
	if (stelle < 0) throw new Error(`«Prüfer 5» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await bausteinfeld.selectOption({ index: stelle });

	pruefe('Vor der Hydration steht die Wahl im festen Feld', 'gemeinschaft', await artfeld.inputValue());
	const vorherBaustein = await bausteinfeld.inputValue();

	loslassen();
	/*
	 * **Die Marke, dass die Hydration durch ist**: Das Suchfeld des Bausteins
	 * entsteht in `onMount`. Ohne diese Zeile misst der Lauf womöglich ein
	 * Fenster, in dem Svelte noch gar nicht übernommen hatte — und wäre grün,
	 * ohne etwas geprüft zu haben.
	 */
	await seite.waitForSelector('input.auswahlsuche', { timeout: 45000 });
	await seite.waitForTimeout(600);

	console.log('');
	pruefe('Die Wahl im festen Feld steht nach der Hydration', 'gemeinschaft', await artfeld.inputValue());

	/*
	 * **Der Wert im Feld genügt nicht.** Treibt er die Anzeige, muss auch das
	 * Programm ihn kennen: Bei «eine andere Gemeinschaft» fällt die Frage
	 * «Wem gehört die Einheit?» weg. Stünde sie noch da, wäre die Wahl zwar im
	 * Feld, aber die Seite zeigte den falschen Zustand — und beim Abschicken
	 * ginge eine Eigentumsform mit, die niemand gewählt hat.
	 *
	 * **Das Feld heisst seit dem 27.08.2026 `eigentumsform`** und ist eine Wahl
	 * mit zwei Auswahlknöpfen statt eines Kästchens `isCommunity` (Produktentscheid).
	 * Die alte Zählung wäre danach **immer** 0 gewesen: eine Sichtprobe,
	 * die nicht mehr rot werden kann. Deshalb zählt sie jetzt in beide
	 * Richtungen, mit dem Gegenstück darunter.
	 */
	const wahlWeg = await seite
		.locator('form[action$="anlegen"] input[name="eigentumsform"]')
		.count();
	pruefe('Die Anzeige folgt der Wahl («Wem gehört die Einheit?» weg)', 0, wahlWeg);

	/*
	 * **Das Gegenstück: bei einer natürlichen Person muss die Frage dastehen.**
	 * Ohne diese Zeile bliebe die Prüfung darüber grün, sobald das Feld anders
	 * heisst — genau der Fall, der am 27.08.2026 eintrat.
	 */
	await artfeld.selectOption('natural');
	await seite.waitForTimeout(150);
	pruefe(
		'Bei einer natürlichen Person steht die Frage da',
		2,
		await seite.locator('form[action$="anlegen"] input[name="eigentumsform"]').count()
	);
	await artfeld.selectOption('gemeinschaft');
	await seite.waitForTimeout(150);

	pruefe(
		'Die Wahl im Baustein steht nach der Hydration',
		vorherBaustein,
		await bausteinfeld.inputValue()
	);
	if (vorherBaustein === '') {
		befunde.push('Der Baustein hatte vor der Hydration gar keine Wahl — die Gegenprobe misst nichts.');
	}

	/*
	 * **Und ein Zurücksetzen führt zur Vorgabe, nicht zur frühen Wahl**
	 * (03.09.2026, aus dem Code-Review zu `gefuehrteWahl`).
	 *
	 * Seit die Aktion auf das `reset`-Ereignis hört, merkt sie sich beim Aufbau,
	 * worauf zurückzusetzen ist. Der erste Anlauf nahm dafür `feld.value` — und
	 * traf damit ausgerechnet diesen Fall: Wer vor der Hydration wählt, hätte
	 * seine frühe Wahl als «Ausgangswert» gemerkt bekommen, und nach dem
	 * Absenden stünde sie wieder da. Genau der Defekt, den die Aktion beheben
	 * soll, auf dem Weg, der im Saal der Normalfall ist.
	 *
	 * Gemerkt wird deshalb `defaultSelected`, also das `selected`-Attribut aus
	 * dem ausgelieferten HTML. Diese Zeile hält das fest: Nach einem
	 * Zurücksetzen steht die Vorgabe da, nicht die frühe Wahl.
	 */
	await seite.evaluate(() => {
		const feld = document.querySelector('form[action$="anlegen"] select[name="kind"]');
		feld?.form?.reset();
	});
	await seite.waitForTimeout(200);
	const nachRuecksetzung = await artfeld.inputValue();
	pruefe(
		'Ein Zurücksetzen führt zur Vorgabe, nicht zur Wahl vor der Hydration',
		'natural',
		nachRuecksetzung
	);

	await ctx.unroute('**/*', bremse);

	// ── Die Fallauswahl: Filtern darf die Wahl nicht wegnehmen ───────────────
	console.log('');
	await seite.goto(`${ZIEL}/versammlungen/neu`, { waitUntil: 'domcontentloaded' });
	await seite.locator('input[name="art"][value="einzeln"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.fill('input[name="datum"]', '2027-09-14');
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
	if (!versammlung) throw new Error('Die Versammlung wurde nicht angelegt.');

	await seite.goto(`${ZIEL}/versammlungen/${versammlung}/traktanden`, {
		waitUntil: 'domcontentloaded'
	});
	/*
	 * Der Knopf klappt das Formular auf — aber erst, wenn Svelte übernommen hat.
	 * Ein Klick davor geht ins Leere, ohne Fehler und ohne Wirkung; deshalb wird
	 * geprüft statt gewartet (dasselbe Vorgehen wie in `e2e/telefonbreite.mjs`).
	 */
	const fallfeld = seite.locator('form.formular select[name="erfordernis"]').first();
	for (let versuch = 0; versuch < 4; versuch++) {
		if (await fallfeld.isVisible().catch(() => false)) break;
		await seite
			.locator('.neu button.haupt')
			.click()
			.catch(() => {});
		await seite.waitForTimeout(700);
	}
	await fallfeld.waitFor({ state: 'visible', timeout: 15000 });

	const gewaehlt = 'k-baulich-nuetzlich';
	await fallfeld.selectOption(gewaehlt);
	pruefe('Die Fallauswahl nimmt eine Wahl an', gewaehlt, await fallfeld.inputValue());

	/*
	 * Ein Suchwort, zu dem **kein** Fall passt — auch der gewählte nicht. Genau
	 * dann fällt er aus der gefilterten Liste, wenn niemand ihn festhält.
	 */
	const suchfeld = seite.locator('form.formular input[placeholder^="Heizung"]').first();
	await suchfeld.fill('zzzz');
	await seite.waitForTimeout(300);
	pruefe('Die Wahl übersteht ein Suchwort ohne Treffer', gewaehlt, await fallfeld.inputValue());
	pruefe(
		'Der gewählte Fall steht noch in der Liste',
		1,
		await fallfeld.locator(`option[value="${gewaehlt}"]`).count()
	);
	/*
	 * Gezählt werden die Treffer, nicht die Liste: Der Gewählte steht zusätzlich
	 * darin. «1 von 30» bei null Treffern wäre eine falsche Auskunft.
	 */
	const kein = await seite
		.locator('form.formular .hilfe.leer')
		.filter({ hasText: 'Kein Fall zu' })
		.count();
	pruefe('Der Hinweis zählt die Treffer, nicht die Liste', 1, kein);

	await suchfeld.fill('');
	await seite.waitForTimeout(300);
	pruefe('Nach dem Leeren der Suche steht die Wahl noch', gewaehlt, await fallfeld.inputValue());
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
console.log('Keine Befunde — jede Wahl vor der Hydration steht danach noch.');
