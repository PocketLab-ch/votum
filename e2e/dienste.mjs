/**
 * Äussere Dienste einrichten — der Weg durch die Oberfläche (14.08.2026).
 *
 * **Warum dieser Lauf sein muss.** Die Datenbanktests prüfen die Regeln; sie
 * sehen die Seite nicht. Genau dort lagen beim letzten Block die Fehler: ein
 * doppeltes `<main>`, eine Liste, die die falsche Rolle lesen durfte, ein
 * Formular, dessen Absenden an einer Voraussetzung scheiterte.
 *
 * Geprüft wird der Weg, den eine Bewirtschaftung tatsächlich geht:
 * hereinkommen, Stufe anlegen, Verbindung prüfen (sie scheitert — das Haus gibt
 * es nicht, und die Absage muss lesbar sein), ändern, entfernen. Dazu die
 * Rollengrenze und die Frage, ob der Schlüssel je im HTML auftaucht.
 *
 * **Aufruf:** node e2e/dienste.mjs
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';

/**
 * Wo eine Erfolgsmeldung steht — an ihrem Platz **oder** in der Quittungsecke.
 *
 * **Beide Orte, nicht einer** (03.09.2026). `Meldung.svelte` gibt eine Meldung
 * mit `ton="gut"` an den Einblender unten rechts weiter (Vorgabe des Auftraggebers,
 * 21.08.2026) und nimmt den Absatz dann aus dem Baum. Dieses Drehbuch suchte
 * weiter `.meldung.gut` und war deshalb still rot — aufgefallen ist es erst, als
 * es am 03.09.2026 zum ersten Mal seit Langem gefahren wurde.
 *
 * `durchspielen.mjs` trägt dieselbe Konstante aus demselben Grund. Wer den
 * Baustein anfasst, fährt **alle** Drehbücher, nicht die bekannten.
 */
const ERFOLGSMELDUNG = '.meldung.gut, [role="status"]';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const LEITUNG = process.env.BENUTZER_LEITUNG ?? 'pruefer-leitung';
const LEITUNGSKENNWORT = zugang('KENNWORT_LEITUNG');

const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT_PFAD);

let nummer = 0;
const befunde = [];

async function schritt(name, fn) {
	nummer++;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${String(nummer).padStart(2)} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (fehler) {
		console.log(`  ✗ ${String(nummer).padStart(2)} ${name} — ${fehler.message}`);
		befunde.push(`${nummer} ${name}: ${fehler.message}`);
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

/**
 * Warten, bis die Seite den erwarteten Zustand zeigt.
 *
 * **Nicht `networkidle`**: Seit dem 17.08.2026 senden alle Formulare dieser
 * Seite über `use:enhance`, und dabei gibt es keine Navigation mehr. Das
 * Leerlauf-Ereignis war da, bevor der Klick etwas bewirkt hatte — der Lauf las
 * dann den alten Stand und meldete «steht noch da». Gewartet wird auf das, was
 * herauskommen soll.
 */
async function bis(seite, bedingung, satz, arg = null) {
	try {
		await seite.waitForFunction(bedingung, arg, { timeout: 20000 });
	} catch (fehler) {
		// Die Ursache mitnehmen: Ein Tippfehler in der Bedingung sähe sonst aus
		// wie der fachliche Befund, den der Satz beschreibt.
		throw new Error(`${satz} (${fehler.message.split('\n')[0]})`, { cause: fehler });
	}
}

async function anmelden(seite, benutzer, kennwort) {
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(120);
	await seite.fill('input[name="username"]', benutzer);
	await seite.fill('input[name="kennwort"]', kennwort);
	await Promise.all([
		seite.waitForLoadState('networkidle'),
		seite.locator('main button[type="submit"]').first().click()
	]);
	/*
	 * **Ohne diese Prüfung lügt der Lauf.** Beim ersten Anlauf am 14.08.2026
	 * scheiterte die Anmeldung der Sitzungsleitung still; der Aufruf der
	 * geschützten Seite landete daraufhin auf der Anmeldeseite — mit Status 200.
	 * Der Schritt meldete «erwartet 403, bekommen 200» und sah aus wie ein Loch
	 * im Rollenschutz, das es nicht gab.
	 */
	behaupte(!seite.url().includes('/anmelden'), `Anmeldung als ${benutzer} misslungen`);
}

async function abmelden(seite) {
	await seite.evaluate(async () => {
		await fetch('/abmelden', { method: 'POST' });
	});
}

const MARKE = `Prüfhaus ${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`;
/** Ob dieser Lauf die Umgebung in die Anwendung geholt hat — dann räumt er sie wieder weg. */
let uebernommen = false;
const SCHLUESSEL = 'sk-pruef-0123456789-geheim';

const browser = await chromium.launch();
const seite = await browser.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

console.log(`Ziel: ${ZIEL} · Äussere Dienste\n`);

await schritt('Anmelden als Verwaltung', async () => {
	await anmelden(seite, BENUTZER, KENNWORT);
	behaupte(!seite.url().includes('/anmelden'), 'Anmeldung misslungen');
	return `als ${BENUTZER}`;
});

await schritt('Die Seite ist von der Betreiberseite aus erreichbar', async () => {
	await seite.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
	const verweis = seite.locator('a[href="/betreiber/dienste"]');
	behaupte(await verweis.count(), 'Kein Weg zu den äusseren Diensten auf der Betreiberseite');
	await Promise.all([seite.waitForLoadState('networkidle'), verweis.first().click()]);
	behaupte(seite.url().includes('/betreiber/dienste'), 'Nicht auf der Diensteseite gelandet');
	return 'über «Dienste einrichten»';
});

/*
 * Der Fund vom 13.08.2026, hier vorweggenommen: Eine Seite unter /betreiber ist
 * gegen **Änderungen** durch den Wächter geschützt, gegen **Lesen** nicht. Hier
 * steht, wohin Inhalte hinausgehen — das geht nur die Verwaltung an.
 */
await schritt('Die Sitzungsleitung kommt nicht an die Dienste', async () => {
	const zweite = await browser.newPage();
	warteNachNavigation(zweite);
	await anmelden(zweite, LEITUNG, LEITUNGSKENNWORT);
	const antwort = await zweite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	behaupte(antwort.status() === 403, `Erwartet 403, bekommen ${antwort.status()}`);
	await zweite.close();
	return 'abgewiesen';
});

/*
 * Auf einer Anlage mit gesetzten Umgebungsvariablen — dem Regelfall bis heute —
 * lässt sich in der Anwendung nichts anlegen, solange die Umgebung gilt: Eine
 * neu angelegte Stufe würde die geltende Kette schlagartig ersetzen. Der Weg
 * führt über die Übernahme, und genau den geht dieser Lauf.
 */
await schritt('Steht die Kette in der Umgebung, führt der Weg über die Übernahme', async () => {
	const uebernehmen = seite.locator('form[action="?/uebernehmen"] button');
	if (!(await uebernehmen.count())) return 'nichts in der Umgebung — nichts zu übernehmen';

	behaupte(
		!(await seite.locator('button:has-text("Stufe hinzufügen")').count()),
		'Es lässt sich anlegen, obwohl die Umgebung gilt — die neue Stufe verdrängte die Kette'
	);
	await uebernehmen.click();
	await bis(
		seite,
		() => /Übernommen/.test(document.querySelector('.meldung.gut, [role="status"]')?.textContent ?? ''),
		'Die Übernahme hat nichts gemeldet'
	);
	const text = await seite.locator(ERFOLGSMELDUNG).first().textContent();
	behaupte(/Übernommen/.test(text ?? ''), `Nicht übernommen: ${text}`);

	/*
	 * **Die Handlung verschwindet nach dem Erfolg** — «In die Anwendung
	 * übernehmen» gibt es danach nicht mehr. Dann muss die Meldung den Fokus
	 * tragen; sonst steht er auf `BODY`, und die Sprachausgabe sagt nichts
	 * darüber, dass etwas geschehen ist (Review 17.08.2026).
	 */
	const wo = await seite.evaluate(() => {
		const a = document.activeElement;
		return a === document.body ? 'BODY' : (a.className || a.tagName);
	});
	behaupte(wo !== 'BODY', 'Nach dem Übernehmen steht der Fokus im Nichts');

	uebernommen = true;
	return `${text.trim().slice(0, 45)} · Fokus auf ${wo}`;
});

await schritt('Eine Stufe ohne Adresse wird abgewiesen — mit einem Satz zum Feld', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(120);
	await seite.click('button:has-text("Stufe hinzufügen")');
	await seite.fill('input[name="name"]', MARKE);
	await seite.fill('input[name="url"]', 'kein-schema.example.com/v1');
	await seite.fill('input[name="modell"]', 'pruefmodell');
	// Die Formularprüfung des Browsers würde vorher greifen — hier soll die
	// Prüfung des Servers antworten.
	await seite.evaluate(() => {
		document.querySelector('form[action="?/stufeAnlegen"]')?.setAttribute('novalidate', '');
	});
	await seite.click('button:has-text("Stufe anlegen")');
	/*
	 * **`.meldung.fehler`, nicht `.meldung.schlecht`** (03.09.2026). Die Absage
	 * ist seit dem Umbau auf `Meldung.svelte` ein `<Meldung ton="fehler">` und
	 * trägt damit `class="meldung fehler"`. Der alte Selektor traf nichts mehr —
	 * dieser Schritt und der darauffolgende waren seither still rot, und niemand
	 * hat es gemerkt, weil das Drehbuch nicht im Prüflauf steht.
	 */
	await seite.waitForSelector('.meldung.fehler', { timeout: 20000 });
	const text = await seite.locator('.meldung.fehler').first().textContent();
	behaupte(/http/.test(text ?? ''), `Keine brauchbare Absage: ${text}`);

	/*
	 * **Eine Absage darf nicht die Eingabe kosten** (Audit 17.08.2026). Bis dahin
	 * lud die Seite neu, der Client-Zustand war weg, das Formular klappte zu und
	 * nahm das Getippte mit — man tippte fünf Felder neu und riet, welches
	 * gemeint war. Nachgemessen an genau dieser Stelle.
	 */
	const formular = seite.locator('form[action="?/stufeAnlegen"]');
	behaupte(await formular.count(), 'Das abgewiesene Formular ist zugeklappt');
	behaupte(
		(await formular.locator('input[name="name"]').inputValue()) === MARKE,
		'Das Getippte ist beim Abweisen verlorengegangen'
	);

	// Und es muss sich danach auch wieder schliessen lassen: Die Marke des
	// Servers darf die Wahl des Benutzers nicht überstimmen.
	await seite.click('form[action="?/stufeAnlegen"] button:has-text("Abbrechen")');
	behaupte(
		!(await seite.locator('form[action="?/stufeAnlegen"]').count()),
		'«Abbrechen» schliesst das abgewiesene Formular nicht'
	);
	return 'Absage nennt das Schema, Eingabe bleibt, Abbrechen greift';
});

await schritt('Stufe anlegen — mit Zugangsschlüssel', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(120);
	await seite.click('button:has-text("Stufe hinzufügen")');
	await seite.fill('input[name="name"]', MARKE);
	await seite.fill('input[name="url"]', 'https://kein-haus.example.com/v1/chat/completions');
	await seite.fill('input[name="modell"]', 'pruefmodell');

	const schluesselfeld = seite.locator('form[action="?/stufeAnlegen"] input[name="schluessel"]');
	behaupte(await schluesselfeld.isEnabled(), 'Das Schlüsselfeld ist gesperrt — kein Geheimnis hinterlegt?');
	await schluesselfeld.fill(SCHLUESSEL);

	await seite.click('button:has-text("Stufe anlegen")');
	await bis(
		seite,
		() => /eingerichtet/.test(document.querySelector('.meldung.gut, [role="status"]')?.textContent ?? ''),
		'Die Stufe wurde nicht angelegt'
	);
	const text = await seite.locator(ERFOLGSMELDUNG).first().textContent();
	behaupte(/eingerichtet/.test(text ?? ''), `Nicht angelegt: ${text}`);
	return MARKE;
});

/*
 * Die Probe aufs Ganze: Der Schlüssel darf nirgends im ausgelieferten HTML
 * stehen — auch nicht in einem Feld, das als Punktereihe angezeigt wird.
 */
await schritt('Der Zugangsschlüssel steht nirgends im HTML — und in keinem Feld', async () => {
	const html = await seite.content();
	behaupte(!html.includes(SCHLUESSEL), 'Der Schlüssel steht im ausgelieferten HTML');
	behaupte(html.includes('sk-…'), 'Die Andeutung des Schlüssels fehlt — steht er überhaupt da?');

	/*
	 * **Auch nicht als Wert im DOM** (Sicherheits-Review 17.08.2026). Das
	 * ausgelieferte HTML zeigt einen Wert nicht, den der Benutzer selbst
	 * eingetippt hat — der steht in `input.value` und in keiner Zeichenkette der
	 * Seite. Ein `update({ reset: false })` liess ihn nach dem erfolgreichen
	 * Speichern im Feld stehen, und diese Seite zeigt einen Schlüssel nie.
	 */
	const stehtNoch = await seite.evaluate(
		(geheim) => [...document.querySelectorAll('input')].some((i) => i.value.includes(geheim)),
		SCHLUESSEL
	);
	behaupte(!stehtNoch, 'Der Schlüssel steht nach dem Speichern noch im Eingabefeld');
	return 'nur die Andeutung';
});

/*
 * **Der Befund gehört an die Stufe, nicht an den Seitenkopf** (17.08.2026).
 * Gemeldet als «es geschieht nicht viel, wenn ich auf Testen klicke»: Die
 * Antwort stand als unformatierter Absatz 380 px über dem Knopf — `.meldung`
 * war auf dieser Seite nirgends definiert.
 */
await schritt('Verbindung prüfen — die Absage steht an der Stufe, auf deren Knopf gedrückt wurde', async () => {
	const zeile = seite.locator('.stufen li', { hasText: MARKE });
	await zeile.locator('button:has-text("Verbindung prüfen")').click();
	const befund = zeile.locator('.befund');
	await befund.waitFor({ state: 'visible', timeout: 30000 });
	const text = await befund.textContent();
	behaupte((text ?? '').includes(MARKE), `Die Absage nennt die Stufe nicht: ${text}`);
	behaupte(
		!(await seite.locator('.meldung').filter({ hasText: MARKE }).count()),
		'Der Befund steht zusätzlich am Seitenkopf — dieselbe Auskunft an zwei Stellen'
	);
	return 'Absage an der Stufe';
});

await schritt('Ändern lässt den Schlüssel stehen, wenn das Feld leer bleibt', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(120);
	const zeile = seite.locator('.stufen li', { hasText: MARKE });
	await zeile.locator('button:has-text("Ändern")').click();

	await zeile.locator('input[name="name"]').fill(`${MARKE} (umbenannt)`);
	await zeile.locator('button:has-text("Stufe speichern")').click();
	await bis(
		seite,
		(marke) => document.body.textContent.includes(marke),
		'Der neue Name ist nicht erschienen',
		`${MARKE} (umbenannt)`
	);

	const html = await seite.content();
	behaupte(html.includes(`${MARKE} (umbenannt)`), 'Der neue Name steht nicht da');
	behaupte(html.includes('sk-…'), 'Der Schlüssel ist beim Umbenennen verlorengegangen');
	return 'umbenannt, Schlüssel bleibt';
});

/*
 * **Die Reihenfolge ist die Aussage** (17.08.2026): Stufe 1 ist das Modell, das
 * im Saal antwortet. Bis dahin liess sie sich nur beim Anlegen bestimmen — wer
 * tauschen wollte, musste beide Stufen entfernen und neu anlegen und verlor
 * dabei die Zugangsschlüssel, die nie wieder angezeigt werden.
 */
await schritt('Die Kette lässt sich umstellen, ohne etwas neu einzutragen', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(150);

	const namen = async () =>
		(await seite.locator('.stufen li .wer strong').allTextContents()).map((t) =>
			t.replace(/^\s*\d+\.\s*/, '').trim()
		);

	const vorher = await namen();
	if (vorher.length < 2) return 'nur eine Stufe — nichts zu tauschen';

	const letzte = seite.locator('.stufen li').last();
	const schluesselVorher = await letzte.locator('.marke').textContent();

	/*
	 * **Die Vergleichsgrundlage vor den Klick.** Sie danach zu lesen ist ein
	 * Rennen: Ist der Tausch schon durch, steht in `alt` bereits der neue Stand,
	 * und die Bedingung wird nie wahr. Der Lauf gewann es bisher nur, weil der
	 * Tausch rund 70 ms braucht.
	 */
	const stand = (await seite.locator('.stufen li .wer strong').allTextContents()).join('|');
	await letzte.locator('button[aria-label*="nach vorn"]').click();

	await seite.waitForFunction(
		(alt) =>
			[...document.querySelectorAll('.stufen li .wer strong')]
				.map((s) => s.textContent)
				.join('|') !== alt,
		stand,
		{ timeout: 20000 }
	);

	const nachher = await namen();
	const erwartet = [...vorher];
	[erwartet[erwartet.length - 2], erwartet[erwartet.length - 1]] = [
		vorher[vorher.length - 1],
		vorher[vorher.length - 2]
	];
	behaupte(
		nachher.join(' | ') === erwartet.join(' | '),
		`Falsch getauscht: ${nachher.join(' | ')} statt ${erwartet.join(' | ')}`
	);

	// Die Nummern werden lückenlos neu vergeben — sonst stünde die Kette später
	// auf 1, 3, 4 und niemand wüsste, ob eine Stufe fehlt.
	const nummern = await seite.locator('.stufen li .wer strong').allTextContents();
	behaupte(
		nummern.every((t, i) => t.trim().startsWith(`${i + 1}.`)),
		`Die Nummerierung hat eine Lücke: ${nummern.join(' | ')}`
	);

	// Und der Zugangsschlüssel wandert mit — genau das ging beim Weg über
	// Entfernen und Neuanlegen verloren.
	const versetzt = seite.locator('.stufen li', { hasText: vorher[vorher.length - 1] });
	behaupte(
		(await versetzt.locator('.marke').textContent()) === schluesselVorher,
		'Der Zugangsschlüssel ist beim Umstellen verlorengegangen'
	);
	return `${vorher[vorher.length - 1]} eine Stufe nach vorn`;
});

/*
 * **Der Fokus bleibt an der Handlung** (Audit 17.08.2026). Gemessen stand er
 * nach jedem Absenden auf `BODY`: Wer die Kette mit der Tastatur um zwei Plätze
 * schiebt, tabbt sich dazwischen einmal durch die ganze Seite zurück, und die
 * Sprachausgabe sagt nach dem Verschieben nichts. Verschwindet der gedrückte
 * Pfeil dabei — die Stufe steht jetzt zuoberst —, übernimmt der andere Pfeil
 * derselben Stufe.
 */
await schritt('Der Fokus bleibt nach dem Absenden an der Stufe, nicht auf BODY', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForFunction(() => document.documentElement.dataset.bereit === '1');

	const pruefknopf = seite.locator('form[action="?/stufePruefen"] button').first();
	await pruefknopf.focus();
	await pruefknopf.press('Enter');
	await seite.waitForSelector('.stufen li .befund', { timeout: 30000 });
	let wo = await seite.evaluate(() => {
		const a = document.activeElement;
		return a === document.body ? 'BODY' : (a.getAttribute('data-fokus') ?? a.tagName);
	});
	behaupte(wo !== 'BODY', 'Nach dem Prüfen steht der Fokus im Nichts');

	const zeilen = seite.locator('.stufen li');
	if ((await zeilen.count()) > 1) {
		const hoch = zeilen.last().locator('button[aria-label*="nach vorn"]');
		const stand = (await seite.locator('.stufen li .wer strong').allTextContents()).join('|');
		await hoch.focus();
		await hoch.press('Enter');
		await seite.waitForFunction(
			(alt) =>
				[...document.querySelectorAll('.stufen li .wer strong')]
					.map((s) => s.textContent)
					.join('|') !== alt,
			stand,
			{ timeout: 20000 }
		);
		wo = await seite.evaluate(() => {
			const a = document.activeElement;
			return a === document.body ? 'BODY' : (a.getAttribute('data-fokus') ?? a.tagName);
		});
		behaupte(wo !== 'BODY', 'Nach dem Verschieben steht der Fokus im Nichts');
	}
	return `zuletzt auf ${wo}`;
});

await schritt('Der Verlauf hält die Eingriffe fest', async () => {
	await seite.goto(`${ZIEL}/verlauf`, { waitUntil: 'domcontentloaded' });
	const text = await seite.locator('body').textContent();
	behaupte(/KI-Stufe eingerichtet/.test(text ?? ''), 'Das Einrichten steht nicht im Verlauf');
	behaupte(!(text ?? '').includes(SCHLUESSEL), 'Der Schlüssel steht im Verlauf');
	return 'im Verlauf, ohne Schlüssel';
});

await schritt('Der Betriebszustand kennt die KI jetzt', async () => {
	await seite.goto(`${ZIEL}/`, { waitUntil: 'domcontentloaded' });
	const text = await seite.locator('body').textContent();
	// Das Prüfhaus gibt es nicht, also muss die Anlage als gestört gelten und
	// sagen, was ohne sie geht.
	behaupte(/KI/.test(text ?? ''), 'Der Betriebszustand erwähnt die KI nicht');
	return 'steht auf der Übersicht';
});

/*
 * **Der Lauf stellt her, was er vorgefunden hat.** Hat er die Umgebung
 * übernommen, räumt er alle Stufen wieder weg — sonst liefe der
 * Entwicklungsrechner danach auf einer Kette in der Datenbank, und der nächste
 * Lauf fände eine Anlage vor, die niemand eingerichtet hat.
 */
await schritt('Aufräumen: die angelegten Stufen wieder entfernen', async () => {
	let entfernt = 0;
	for (let runde = 0; runde < 12; runde++) {
		await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
		await seite.waitForTimeout(120);
		const zeilen = seite.locator('.stufen li');
		if (!(await zeilen.count())) break;
		// Nur die eigene Prüfstufe, wenn nichts übernommen wurde.
		const ziel = uebernommen ? zeilen.first() : seite.locator('.stufen li', { hasText: MARKE });
		if (!(await ziel.count())) break;
		const aendern = ziel.locator('button:has-text("Ändern")');
		if (!(await aendern.count())) break;
		await aendern.click();
		/*
		 * Gezählt werden die Stufen **aus der Anwendung**, erkennbar am
		 * Ändern-Knopf — nicht die Zeilen. Beim Entfernen der letzten Stufe kommt
		 * die Umgebungskette zurück, und die Zeilenzahl steigt dabei von 1 auf 2.
		 * Ein Zähler über alle Zeilen meldete dort «nicht verschwunden», obwohl
		 * genau das Richtige passiert war.
		 */
		const vorher = await seite.locator('.stufen li [data-fokus^="aendern:"]').count();
		await ziel.locator('button:has-text("Aus der Kette nehmen")').click();
		await bis(
			seite,
			(zahl) => document.querySelectorAll('.stufen li [data-fokus^="aendern:"]').length < zahl,
			'Die Stufe ist nicht verschwunden',
			vorher
		);
		entfernt++;
	}
	const html = await seite.content();
	behaupte(!html.includes(MARKE), 'Die Prüfstufe steht noch da');
	return `${entfernt} entfernt`;
});

await schritt('Der Zeitstempeldienst lässt sich eintragen und wieder entfernen', async () => {
	await seite.goto(`${ZIEL}/betreiber/dienste`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(120);
	// Das Formular wartet seit dem 17.08.2026 zugeklappt — es stand offen und
	// war mit 430 px der längste Block der Seite, obwohl es selten gebraucht wird.
	// `getByRole` mit Ankern statt `has-text`: Seit dem 13.11.2026 steht
	// darunter der Ersatzdienst mit «Ersatzdienst ändern»; `has-text` träfe
	// beide, und Playwright bricht bei zwei Treffern ab.
	await seite
		.getByRole('button', { name: /^(Dienst ändern|Dienst eintragen)$/ })
		.click();
	const formular = seite.locator('form[action="?/zeitstempel"]');
	await formular.locator('input[name="url"]').fill('https://pruefstelle.example.org/tsr');
	await formular.locator('input[name="name"]').fill('Prüfstelle (Lauf)');
	// Ohne Doppelpunkte eingegeben — abgelegt gehört die Form, gegen die später
	// verglichen wird. Sonst passte der Abdruck nie, ohne dass jemand den Grund
	// fände.
	await formular.locator('textarea[name="fingerabdruecke"]').fill('ab'.repeat(32));
	await formular.locator('button:has-text("Dienst speichern")').click();
	await bis(
		seite,
		() => document.body.textContent.includes('AB:AB:'),
		'Der Abdruck wurde nicht auf die Vergleichsform gebracht'
	);

	await seite.locator('form[action="?/zeitstempelEntfernen"] button').click();
	await bis(
		seite,
		() => !document.body.textContent.includes('Prüfstelle (Lauf)'),
		'Der Prüfdienst steht noch da'
	);
	return 'eingetragen, normalisiert, entfernt';
});

await abmelden(seite);
await browser.close();

console.log('');
if (befunde.length) {
	console.log(`${nummer} Schritte, ${befunde.length} Befund(e):`);
	for (const b of befunde) console.log(`  · ${b}`);
	process.exit(1);
}
console.log(`Alle ${nummer} Schritte grün.`);
