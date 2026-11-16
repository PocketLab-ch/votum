/**
 * Mehrere Gemeinschaften auf einmal ins Archiv — und was dabei kein Fehler ist.
 *
 * **Der Auftrag** (Auftraggeber, 15.09.2026): «ein Bulk zum Massenarchivieren. Das bei
 * Versammlungen, Gemeinschaften und Personen.»
 *
 * **Was hier festgenagelt wird**, und warum jeder Punkt einzeln zählt:
 *
 *   1. **Ohne Auswahl keine Leiste.** Ein Knopf, der nichts auszuführen hat,
 *      ist eine Einladung zu einem Klick, der nichts tut.
 *   2. **Die Leiste nennt die Zahl.** Bei einer Sammelhandlung ist sie das
 *      Einzige, was richtig von versehentlich trennt.
 *   3. **Ein Teilerfolg ist ein Erfolg.** Was ging, geht; was nicht ging, steht
 *      im Wortlaut daneben und ist die Arbeitsliste für den zweiten Anlauf.
 *   4. **Die Klammer nimmt ihr Kind mit, und das ist kein Fehlschlag.** Wer
 *      eine MEG samt ihrer Häuser auswählt, will alles wegräumen. Die
 *      Einzelabsage für jedes Haus lautete «liegt bereits im Archiv, weil …» —
 *      fünf rote Zeilen für einen gelungenen Vorgang.
 *   5. **Die Reihenfolge rettet das Hervorholen.** Ginge das Haus vor seiner
 *      Klammer ins Archiv, trüge es ein eigenes Datum und käme beim
 *      Hervorholen der Klammer nicht mit zurück. Der Bestand sähe danach
 *      richtig aus und verhielte sich falsch.
 *
 * Aufruf: `node e2e/sammelarchiv.mjs`
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

/* «Prüflauf» ist ein Muster, das `scripts/testdaten-entfernen.sql` kennt. */
const MARKE = `Prüflauf Sammel ${Date.now()}`;
const KLAMMER = `${MARKE} MEG`;
const KIND = `${MARKE} Haus`;
const EIGEN = `${MARKE} Einzeln`;

let nr = 0;
const fehler = [];
let seite;
const angelegt = [];
let personName = null;
let personId = null;

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
	await seite.waitForTimeout(300);
}

/** Legt eine Gemeinschaft an und gibt ihre Kennung zurück. */
async function legeAn(name, elternId = null) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', name);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	const fundstelle = seite.locator('input[name="headCountRuleSource"]');
	if (await fundstelle.count()) await fundstelle.fill('Musterreglement Ziff. 14');
	if (elternId) {
		const wahl = seite.locator('select[name="parentStwegId"]');
		behaupte(await wahl.count(), 'Kein Feld für die übergeordnete Gemeinschaft');
		await wahl.selectOption(elternId);
	}
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	behaupte(id && id !== 'neu', `«${name}» nicht angelegt, Adresse ${seite.url()}`);
	angelegt.push(id);
	return id;
}

/** Kreuzt die Zeile dieser Gemeinschaft in der Liste an. */
async function kreuzeAn(name) {
	const kaestchen = seite.locator(`input.ankreuz[aria-label="«${name}» auswählen"]`);
	behaupte(await kaestchen.count(), `Kein Kästchen an der Zeile «${name}»`);
	await kaestchen.check();
}

const browser = await chromium.launch();
try {
	seite = await browser.newPage();
	console.log(`\nSammelarchivierung — ${ZIEL}\n`);

	let klammerId = null;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung nicht durchgekommen');
		return `als ${BENUTZER}`;
	});

	await schritt('Eine Klammer, ein Kind darunter, eine eigenständige anlegen', async () => {
		klammerId = await legeAn(KLAMMER);
		await legeAn(KIND, klammerId);
		await legeAn(EIGEN);
		return `${angelegt.length} angelegt`;
	});

	await schritt('Ohne Auswahl steht keine Leiste da', async () => {
		await gehe('/gemeinschaften');
		await seite.fill('input[type="search"]', MARKE).catch(() => {});
		await seite.waitForTimeout(400);
		behaupte(
			(await seite.locator('form[action="?/sammelArchivieren"]').count()) === 0,
			'Die Sammelleiste steht da, obwohl nichts ausgewählt ist'
		);
		return 'keine Leiste';
	});

	await schritt('Angekreuzt erscheint die Leiste und nennt die Zahl', async () => {
		await kreuzeAn(KLAMMER);
		await kreuzeAn(KIND);
		await kreuzeAn(EIGEN);
		await seite.waitForTimeout(300);
		const leiste = seite.locator('form[action="?/sammelArchivieren"]');
		behaupte(await leiste.count(), 'Die Sammelleiste erscheint nicht');
		const text = await leiste.locator('p.zahl').innerText();
		behaupte(text.includes('3'), `Die Leiste nennt nicht die Zahl 3: «${text}»`);
		// Die Kennungen reisen als wiederholtes Feld, nicht als eine Zeile.
		const versteckt = await leiste.locator('input[name="id"]').count();
		behaupte(versteckt === 3, `${versteckt} versteckte Kennungen statt 3`);
		return `3 ausgewählt, ${versteckt} Kennungen im Formular`;
	});

	await schritt('Archivieren: die Klammer nimmt ihr Kind mit', async () => {
		await abschicken(seite.locator('form[action="?/sammelArchivieren"] button[type="submit"]'));

		/*
		 * **Die Erfolgsmeldung steht nicht dort, wo sie im Markup steht.**
		 * `Meldung` mit `ton="gut"` gibt ihren Text im Browser an den zentralen
		 * Einblender weiter und lässt die eigene Stelle leer — sonst stünde
		 * dieselbe Meldung zweimal da. Die erste Fassung dieses Schrittes suchte
		 * am Ursprungsort, fand nichts und meldete «keine Erfolgsmeldung»,
		 * obwohl alles archiviert war. Gemessen wird am Zielort.
		 */
		const gut = seite.locator('.einblender .quittung .text, .meldung.gut .text');
		await gut.first().waitFor({ state: 'visible', timeout: 15000 });
		const text = await gut.first().innerText();

		/*
		 * **Zwei archiviert, eine mitgegangen** — und nicht «eine blieb stehen».
		 * Genau diese Unterscheidung ist der Punkt: Die Klammer und die
		 * eigenständige gingen selbst, das Kind ging mit der Klammer.
		 */
		behaupte(
			text.includes('2'),
			`Die Meldung nennt nicht zwei selbst archivierte: «${text}»`
		);
		behaupte(
			/mit ihrer Klammer/.test(text),
			`Die Meldung sagt nicht, dass eine mit ihrer Klammer ging: «${text}»`
		);
		behaupte(
			(await seite.locator('.abgelehnt').count()) === 0,
			'Es steht eine Absage da — das Kind der gewählten Klammer darf keine sein'
		);
		return text.replace(/\s+/g, ' ').slice(0, 90);
	});

	await schritt('Alle drei liegen im Archiv', async () => {
		await gehe('/gemeinschaften');
		await seite.fill('input[type="search"]', MARKE).catch(() => {});
		await seite.waitForTimeout(400);
		// Ohne den Schalter zeigt die Liste keine archivierten Zeilen.
		behaupte(
			(await seite.locator(`input.ankreuz`).count()) === 0,
			'Es stehen noch Kästchen da — also ist etwas nicht im Archiv'
		);
		return 'Liste leer ohne Archivschalter';
	});

	await schritt('Das Hervorholen der Klammer bringt das Kind mit', async () => {
		/*
		 * **Der Punkt, an dem sich die Reihenfolge auszahlt.** Wäre das Kind vor
		 * der Klammer einzeln archiviert worden, trüge es ein eigenes Datum und
		 * bliebe jetzt im Archiv zurück.
		 */
		await gehe(`/gemeinschaften/${klammerId}/angaben`);
		const holen = seite.locator('form[action="?/hervorholen"] button');
		behaupte(await holen.count(), 'Kein Knopf zum Hervorholen an der Klammer');
		await abschicken(holen);

		await gehe('/gemeinschaften');
		await seite.fill('input[type="search"]', MARKE).catch(() => {});
		await seite.waitForTimeout(400);
		const sichtbar = await seite.locator('ul.liste li span.name').allInnerTexts();
		behaupte(
			sichtbar.some((t) => t.includes('MEG')),
			`Die Klammer ist nicht zurück: ${JSON.stringify(sichtbar)}`
		);
		behaupte(
			sichtbar.some((t) => t.includes('Haus')),
			`Das Kind kam NICHT mit zurück — es trug ein eigenes Archivdatum: ${JSON.stringify(sichtbar)}`
		);
		return `zurück: ${sichtbar.length} Zeilen`;
	});

	await schritt('Personen: ankreuzen und archivieren', async () => {
		/*
		 * Dieselbe Leiste, andere Liste — und eine Tabelle statt einer
		 * Aufzählung. Geprüft wird deshalb, dass das Kästchen auch dort steht und
		 * die Auswahl ankommt.
		 */
		personName = `${MARKE} Person`;
		const name = personName;
		await gehe('/personen');
		/*
		 * **Erst aufklappen, dann suchen.** Das Erfassungsformular steht hinter
		 * «+ Person erfassen» — zu, sobald die Liste etwas enthält. Der erste
		 * Anlauf suchte es vorher und meldete «Kein Formular».
		 */
		const klappe = seite.getByRole('button', { name: /Person erfassen/ });
		if (await klappe.count()) {
			await klappe.first().click();
			await seite.waitForTimeout(400);
		}
		const anlegen = seite.locator('form[action="?/anlegen"]');
		behaupte(await anlegen.count(), 'Kein Formular «Person erfassen»');
		await anlegen.locator('input[name="name"]').fill(name);
		await abschicken(anlegen.locator('button[type="submit"]').first());
		personId = seite.url().split('/personen/')[1]?.split(/[/?#]/)[0];
		behaupte(personId && personId !== 'neu', `«${name}» nicht angelegt: ${seite.url()}`);

		await gehe('/personen');
		await seite.fill('input[type="search"]', MARKE).catch(() => {});
		await seite.waitForTimeout(400);
		const kaestchen = seite.locator(`input.ankreuz[aria-label="«${name}» auswählen"]`);
		behaupte(await kaestchen.count(), `Kein Kästchen an der Zeile «${name}»`);
		await kaestchen.check();
		await seite.waitForTimeout(300);

		const leiste = seite.locator('form[action="?/sammelArchivieren"]');
		behaupte(await leiste.count(), 'Keine Sammelleiste in der Personenliste');
		await abschicken(leiste.locator('button[type="submit"]'));

		const gut = seite.locator('.einblender .quittung .text, .meldung.gut .text');
		await gut.first().waitFor({ state: 'visible', timeout: 15000 });
		const text = await gut.first().innerText();
		behaupte(/Person/i.test(text), `Die Meldung spricht nicht von einer Person: «${text}»`);
		return text.replace(/\s+/g, ' ').slice(0, 60);
	});

	await schritt('Versammlungen: nur versiegelte tragen ein Kästchen', async () => {
		/*
		 * **Die Regel, nicht nur die Leiste.** Archiviert wird erst, was versiegelt
		 * ist; ein Entwurf ist ein Plan und keine Aufbewahrung. Ein Kästchen an
		 * einer nicht versiegelten Versammlung führte in eine Absage — und die
		 * gehört nicht hingestellt.
		 *
		 * Gemessen wird gegen den Bestand: Zu jeder Zeile mit einem Kästchen muss
		 * der Zustand «Versiegelt» stehen.
		 */
		await gehe('/versammlungen');
		await seite.waitForTimeout(600);

		/*
		 * **Erst alle Fächer aufklappen.** Das Fach «Abgeschlossen», in dem die
		 * versiegelten liegen, ist ohne Suche zugeklappt und rendert seine Zeilen
		 * gar nicht. Die beiden ersten Fassungen dieses Schrittes zählten deshalb
		 * immer null Kästchen und wären auch dann grün geblieben, wenn es
		 * überhaupt keine gäbe — zweimal hintereinander derselbe blinde Fleck.
		 */
		for (let runde = 0; runde < 8; runde += 1) {
			const zu = seite.locator('button.fachkopf[aria-expanded="false"]');
			if ((await zu.count()) === 0) break;
			await zu.first().click();
			await seite.waitForTimeout(250);
		}
		behaupte(
			(await seite.locator('button.fachkopf[aria-expanded="false"]').count()) === 0,
			'Es blieb ein Fach zugeklappt — der Schritt sähe dessen Zeilen nicht'
		);

		/*
		 * **Die Sichtprobe vor der Messung.** Ein Lauf, der nur prüft «jede Zeile
		 * mit Kästchen ist versiegelt», ist grün, wenn es gar keine Zeilen gibt.
		 * Also zuerst: Stehen überhaupt Versammlungen da, und sind beide Sorten
		 * vertreten?
		 */
		const zustaende = await seite.locator('ul.liste li a.zeile .zustand').allInnerTexts();
		behaupte(zustaende.length > 0, 'Keine einzige Versammlung in der Liste');
		const versiegelte = zustaende.filter((z) => /versiegelt/i.test(z));
		const offene = zustaende.filter((z) => !/versiegelt|gemeinsam/i.test(z));
		behaupte(
			offene.length > 0,
			'Keine unversiegelte Versammlung — dann misst die Gegenrichtung nichts. ' +
				'Legen Sie den Musterbestand an (node e2e/mustergemeinschaft.mjs).'
		);

		const mitKaestchen = seite.locator('li:has(> input.ankreuz)');
		const n = await mitKaestchen.count();
		for (let i = 0; i < n; i += 1) {
			const zustand = await mitKaestchen.nth(i).locator('.zustand').first().innerText();
			behaupte(
				/versiegelt/i.test(zustand),
				`Eine Zeile im Zustand «${zustand}» trägt ein Kästchen, obwohl nur Versiegelte archivierbar sind`
			);
		}

		/*
		 * **Und die positive Hälfte**, sobald es eine versiegelte gibt: Dann MUSS
		 * dort ein Kästchen stehen. Ohne diese Zusicherung bliebe der Schritt
		 * grün, wenn die Kästchen ganz verschwänden.
		 */
		behaupte(
			n >= versiegelte.length,
			`${versiegelte.length} versiegelte Versammlungen, aber nur ${n} Kästchen — ` +
				'an einer archivierbaren Zeile fehlt die Auswahl'
		);
		return `${offene.length} unversiegelte ohne Kästchen, ${versiegelte.length} versiegelte mit ${n}`;
	});

	await schritt('Aufräumen: alles wieder entfernen', async () => {
		/*
		 * **Auch die Person** — sie liegt nach Schritt 8 im Archiv. Der erste
		 * Anlauf räumte nur die Gemeinschaften und liess sie stehen; ein
		 * Durchstich, der bei jedem Lauf eine Zeile hinterlässt, verstopft den
		 * Bestand, in dem später jemand etwas suchen will.
		 */
		if (personName) {
			/*
			 * **Über die Kennung, nicht über die Liste.** Der erste Anlauf suchte
			 * die Person in der Liste — die zeigt Archiviertes aber nur mit
			 * eingeschaltetem Schalter, mein Selektor dafür traf nicht, und der
			 * Schritt meldete trotzdem «Bestand sauber». Zwei Personen blieben
			 * liegen. Die Kennung steht seit dem Anlegen fest; sie führt direkt
			 * zur Seite, ganz gleich was die Liste gerade zeigt.
			 */
			await gehe(`/personen/${personId}`);
			const weg = seite.locator('form[action="?/entfernen"] button').first();
			behaupte(await weg.count(), `Kein Weg, «${personName}» zu entfernen`);
			await abschicken(weg);
			const nach = await seite.request.get(`${ZIEL}/personen/${personId}`);
			behaupte(
				nach.status() === 404,
				`Die Prüfperson steht noch (Status ${nach.status()})`
			);
		}

		// Die eigenständige liegt noch im Archiv und muss erst hervorgeholt werden.
		for (const id of angelegt) {
			await gehe(`/gemeinschaften/${id}/angaben`);
			const holen = seite.locator('form[action="?/hervorholen"] button');
			if (await holen.count()) await abschicken(holen);
		}
		/*
		 * Von unten nach oben: Eine Klammer mit Kindern lässt sich nicht
		 * entfernen, und das ist richtig so — die Löschsperre sagt es auch.
		 */
		for (const id of [...angelegt].reverse()) {
			await gehe(`/gemeinschaften/${id}/angaben`);
			const knopf = seite.locator('section.entfernen button').first();
			if ((await knopf.count()) && !(await knopf.isDisabled())) await abschicken(knopf);
		}
		const reste = [];
		for (const id of angelegt) {
			const a = await seite.request.get(`${ZIEL}/gemeinschaften/${id}/angaben`);
			if (a.status() !== 404) reste.push(id);
		}
		behaupte(reste.length === 0, `Es blieben ${reste.length} stehen: ${reste.join(', ')}`);
		return 'Bestand sauber';
	});
} finally {
	await browser.close();
}

console.log('');
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	console.log(`\n  Hinweis: Reste tragen «${MARKE}» im Namen.`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün.`);
