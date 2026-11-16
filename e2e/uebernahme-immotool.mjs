/**
 * Die Übernahme der Stammdaten aus immotool (FR-7).
 *
 * **Was hier festgenagelt wird:**
 *
 *   1. **Entweder oder.** Die Quelle wird vor den Feldern gewählt; immotool und
 *      Datei stehen nie nebeneinander im selben Formular.
 *   2. **Dieselbe Vorschau wie bei einer Datei.** Geschrieben wird nichts,
 *      bevor gezeigt wurde, was geschieht — und die Vorschau kommt aus
 *      demselben Kern wie beim CSV-Weg.
 *   3. **Was nicht mitkommt, steht da.** Ein Verteiler, den es hier nicht gibt,
 *      wird genannt statt weggelassen. Die Vorschau kann nur zeigen, was in der
 *      Datei steht — das Fehlende muss daneben stehen.
 *   4. **Mehrere Eigentümer an einer Einheit werden eine Partei** (ZGB 712o
 *      Abs. 1), und beim zweiten Durchgang dieselbe.
 *   5. **Ein zweiter Lauf ändert nichts.** Alles «unverändert», keine Kopien.
 *      Das ist der Unterschied zwischen einer Übernahme und einer Verdoppelung.
 *   6. **Die Wertquoten gehen danach auf.**
 *
 * Voraussetzung: In der Umgebung stehen VERSAMMLUNG_IMMOTOOL_URL und
 * VERSAMMLUNG_IMMOTOOL_TOKEN, und `LIEGENSCHAFT` nennt eine Demo-Liegenschaft,
 * die immotool führt, so wie sie in der Auswahl steht. Fehlt beides, endet der Lauf mit einer Ansage statt
 * mit Befunden — ein nicht eingerichteter Dienst ist kein Fehler.
 *
 * Aufruf: `node e2e/uebernahme-immotool.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-uebernahme-immotool';
/** Die Liegenschaft, gegen die geprüft wird. Erkannt am Text der Auswahl. */
/*
 * Ohne Vorgabe: Der Name gehört zum Demobestand von immotool, nicht zu diesem
 * Repo, und eine geratene Vorgabe endete erst bei der Auswahl mit einer
 * irreführenden Absage (Codeprüfung, 27.10.2026).
 */
const LIEGENSCHAFT = process.env.LIEGENSCHAFT;
if (!LIEGENSCHAFT) {
	console.error('LIEGENSCHAFT fehlt: der Name einer Demo-Liegenschaft in immotool, wie ihn die Auswahl zeigt.');
	process.exit(2);
}

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

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
		await seite
			.screenshot({ path: `${AUFNAHMEN}/fehler-${String(nr).padStart(2, '0')}.png` })
			.catch(() => {});
	}
}

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

async function abschicken(knopf) {
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click()
	]);
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(250);
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

/** Der ganze Text der Seite, Leerraum zusammengezogen. */
/**
 * Der sichtbare Text der Seite, **samt Einblender**.
 *
 * `<Einblender />` steht in `+layout.svelte` ausserhalb von `<main>`, und
 * `Meldung.svelte` gibt jede Meldung vom Ton `gut` nach der Hydration dorthin
 * ab. Wer nur `main` liest, sieht deshalb jede Absage und keine Bestätigung.
 *
 * Für den Kasten «Übernommen» weiter unten gilt das ausdrücklich **nicht**: Der
 * steht in `main` und bleibt stehen, absichtlich (23.08.2026, A-45). Der
 * Einblender kommt hier nur dazu, damit das Drehbuch auch die Meldungen sieht,
 * die umziehen.
 */
const seitentext = async () => {
	const haupt = await seite.locator('main').innerText();
	const quittung = (await seite.locator('.einblender .quittung').allInnerTexts()).join(' ');
	return `${haupt} ${quittung}`.replace(/\s+/g, ' ');
};

/** Die Vorschau holen: Quelle wählen, Liegenschaft wählen, prüfen. */
async function holeVorschau(gemeinschaft) {
	await gehe(`/gemeinschaften/${gemeinschaft}/uebernahme`);
	await seite.locator('input[name="quelle"][value="immotool"]').check();
	await seite.waitForTimeout(150);
	const auswahl = seite.locator('select[name="liegenschaft"]');
	const wert = await auswahl
		.locator('option', { hasText: LIEGENSCHAFT })
		.first()
		.getAttribute('value');
	behaupte(wert, `«${LIEGENSCHAFT}» steht nicht in der Auswahl`);
	await auswahl.selectOption(wert);
	await abschicken(seite.locator('form[action$="ausImmotool"] button[type="submit"]'));
}

try {
	let gemeinschaft;
	let zweite;
	const NAME = `Prüflauf Übernahme ${LAUF}`;

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

	await schritt('Eine Gemeinschaft für den Prüflauf anlegen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		behaupte(
			seite.url().includes('/gemeinschaften/') && !seite.url().endsWith('/neu'),
			`Nicht angelegt: ${seite.url()}`
		);
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		return gemeinschaft.slice(0, 8);
	});

	await schritt('Der Dienst ist eingerichtet und die Quelle steht zur Wahl', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/uebernahme`);
		const zahl = await seite.locator('input[name="quelle"]').count();
		behaupte(
			zahl === 2,
			zahl === 0
				? 'Keine Wahl der Quelle — ist VERSAMMLUNG_IMMOTOOL_URL/TOKEN gesetzt und immotool erreichbar?'
				: `${zahl} statt zwei Möglichkeiten`
		);
		behaupte(
			await seite.locator('input[name="quelle"][value="immotool"]').isChecked(),
			'immotool ist nicht vorgewählt'
		);
		return 'immotool vorgewählt';
	});

	await schritt('Datei und immotool stehen nie nebeneinander', async () => {
		// «Entweder oder aber nicht beides» — der Dateiwähler darf nicht
		// gleichzeitig sichtbar sein, sonst füllt jemand beides aus.
		behaupte(
			(await seite.locator('input[type="file"]').count()) === 0,
			'Der Dateiwähler steht neben der immotool-Auswahl'
		);
		await seite.locator('input[name="quelle"][value="datei"]').check();
		await seite.waitForTimeout(150);
		behaupte(
			(await seite.locator('input[type="file"]').count()) === 1 &&
				(await seite.locator('select[name="liegenschaft"]').count()) === 0,
			'Nach dem Umschalten steht die Liegenschaftswahl noch da'
		);
		return 'Felder wechseln mit der Wahl';
	});

	await schritt('Die Vorschau kommt, ohne dass etwas geschrieben wird', async () => {
		await holeVorschau(gemeinschaft);
		const text = await seitentext();
		behaupte(/Vorschau: immotool/.test(text), `Keine Vorschau: ${text.slice(0, 160)}`);
		behaupte(/Eigentümer/.test(text) && /Einheiten/.test(text), 'Nur ein Teil gezeigt');

		// Nichts geschrieben: Die Einheitenseite ist noch leer.
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const einheiten = await seite.locator('table tbody tr').count();
		behaupte(einheiten === 0, `${einheiten} Einheiten schon vor der Bestätigung`);
		return 'zwei Teile, Bestand unberührt';
	});

	await schritt('Ein Verteiler, den es hier nicht gibt, wird genannt', async () => {
		await holeVorschau(gemeinschaft);
		const text = await seitentext();
		behaupte(/Bevor Sie übernehmen/.test(text), 'Kein Hinweisblock');
		behaupte(
			/Verteiler «Lift»/.test(text) && /«lift»/.test(text),
			`Der Lift wird nicht mit seinem Schlüssel genannt: ${text.slice(0, 400)}`
		);
		return 'Lift genannt, mit Schlüssel';
	});

	await schritt('Der Widerspruch aus immotool steht im Hinweis', async () => {
		// In den Demodaten trägt eine Einheit «Miteigentum» mit nur einer Person.
		const text = await seitentext();
		behaupte(
			/nur eine Person/.test(text),
			`Miteigentum mit einer Person wird nicht gemeldet: ${text.slice(0, 400)}`
		);
		return 'gemeldet';
	});

	await schritt('Übernehmen legt Eigentümer und Einheiten an', async () => {
		await abschicken(seite.locator('form[action$="uebernehmen"] button[type="submit"]'));
		const text = await seitentext();
		/*
		 * **Der Wortlaut heisst «6 Zeilen neu angelegt, 0 geändert».**
		 *
		 * Bis zum 27.08.2026 suchte dieses Drehbuch «6 angelegt» und fand nichts.
		 * Der Grund lag ein halbes Jahr zurück: Am 23.08.2026 bekamen die Zahlen
		 * einen Gegenstand, weil «15 angelegt, 0 geändert» nicht sagte, wovon.
		 * Der Text wurde besser, das Drehbuch nicht mitgezogen, und der Befund las
		 * sich seither wie ein Programmfehler.
		 *
		 * `Zeile|Zeilen`, weil der Kasten bei genau einer Zeile die Einzahl setzt.
		 */
		const treffer = text.match(/(\d+) (?:Zeile|Zeilen) neu angelegt, (\d+) geändert/);
		behaupte(treffer, `Kein Ergebnis: ${text.slice(0, 200)}`);
		// Drei Einheiten und drei Parteien: 1.0.1 allein, 1.1.1 zu zweit
		// (eine Partei), 1.2.1 allein.
		behaupte(Number(treffer[1]) === 6, `${treffer[1]} statt 6 angelegt`);
		return treffer[0];
	});

	await schritt('Die Einheiten stehen mit ihren Wertquoten da', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const zeilen = await seite.locator('table tbody tr').count();
		behaupte(zeilen === 3, `${zeilen} statt 3 Einheiten`);

		// Die Tabelle ist bearbeitbar: Bezeichnung und Quote stehen in
		// Eingabefeldern, und deren Wert steht **nicht** im Text der Seite.
		const namen = await seite.locator('tbody input[name^="label."]').evaluateAll((f) =>
			f.map((e) => e.value).sort()
		);
		behaupte(
			JSON.stringify(namen) ===
				JSON.stringify([
					'3.5-Zi-Wohnung EG',
					'4.5-Zi-Wohnung 1. OG',
					'4.5-Zi-Wohnung 2. OG'
				]),
			`Andere Bezeichnungen: ${namen.join(' | ')}`
		);

		// 280 + 360 + 360 = 1000. Geht die Stammquote nicht auf, ist jede Zählung
		// nach Wertquoten unauffällig falsch — sie liefert trotzdem eine Zahl.
		const summe = await seite
			.locator('tbody input[name$=".stamm"]')
			.evaluateAll((f) => f.reduce((s, e) => s + Number(e.value || 0), 0));
		behaupte(summe === 1000, `Stammquote ${summe} statt 1000`);
		return `${zeilen} Einheiten, Stammquote ${summe}`;
	});

	await schritt('Zwei Eigentümer an einer Einheit sind eine Partei', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const text = await seitentext();
		behaupte(
			/Brunner Marc/.test(text) && /Steiner Heinz/.test(text),
			`Die Gemeinschaft fehlt: ${text.slice(0, 300)}`
		);
		/*
		 * **Die Parteitabelle, nicht irgendeine** (01.09.2026). Seit die
		 * Eigentuemerseite unten den Abschnitt «Eigentum im Zeitverlauf» traegt,
		 * stehen dort drei Tabellen; `table tbody tr` zaehlte alle und meldete
		 * sechs statt drei Parteien. Der Zaehler war zu grob — die Anzeige ist
		 * richtig.
		 *
		 * **Der erste Fix war es auch noch.** `table.karten` traf zwei: die
		 * Parteien und die bezeichneten Vertreter der Mitgliedsgemeinschaften.
		 * Dass er heute die richtige Zahl liefert, liegt nur daran, dass die
		 * uebernommene Gemeinschaft keine Mitglieder hat — er waere bei der
		 * ersten Dachgemeinschaft im Pruefbestand falsch geworden.
		 *
		 * Eindeutig ist erst die Verbindung aus beidem: `.karten` (die Klasse, die
		 * auf dem Telefon aus jeder Zeile eine Karte macht) und die Kopfzelle
		 * «Eigentuemer». Die Vertretertabelle traegt `.karten`, aber keine solche
		 * Spalte; die Verlaufstabelle hat die Spalte, aber `.voll`.
		 *
		 * **Und der Schritt prueft das selbst.** Zweimal hintereinander hat hier
		 * ein zu weiter Selektor gemessen, was er nicht messen sollte; die
		 * Zeilenzahl allein sagt nicht, ob er die richtige Tabelle gefunden hat.
		 */
		const parteien = seite.locator('table.karten', {
			has: seite.getByRole('columnheader', { name: 'Eigentümer', exact: true })
		});
		const tabellen = await parteien.count();
		behaupte(tabellen === 1, `Der Selektor trifft ${tabellen} Tabellen statt genau einer`);
		const zeilen = await parteien.locator('tbody tr').count();
		behaupte(zeilen === 3, `${zeilen} statt 3 Parteien`);
		return `${zeilen} Parteien`;
	});

	await schritt('Die Authentik-Kennung kommt mit — aber nur bei einer Person', async () => {
		/*
		 * Der Weg von immotool bis in die Anzeige (20.08.2026). In den Dev-Daten
		 * tragen zwei Eigentümer eine Kennung: einer besitzt allein, der andere
		 * teilt sich eine Einheit.
		 *
		 * Erwartet wird deshalb GENAU EIN Vermerk, und er gehört an die Zeile mit
		 * einem einzigen Berechtigten. Die Stimme einer gemeinsam gehaltenen
		 * Einheit gehört mehreren; wer sich dafür anmelden darf, entscheidet die
		 * Bewirtschaftung und nicht die Übernahme. Stünde der Vermerk an einer
		 * gemeinschaftlichen Zeile, hätte sie es doch getan.
		 *
		 * **Geprüft wird die Regel, nicht der Name.** Bis zum 27.08.2026 stand
		 * hier «Brunner Andrea» als Erwartung. Die Demodaten in immotool haben
		 * sich geändert, die Person gibt es nicht mehr, und das Drehbuch meldete
		 * einen Befund über etwas, das in Ordnung war. Ein Drehbuch, das an
		 * fremden Stammdaten hängt, misst deren Alter mit.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const vermerke = await seite.locator('text=Authentik-Kennung hinterlegt').count();
		behaupte(vermerke === 1, `${vermerke} Vermerke statt 1`);

		const traegt = seite.locator('table tbody tr', { hasText: 'Authentik-Kennung hinterlegt' });
		const zeilentext = (await traegt.innerText()).replace(/\s+/g, ' ');
		behaupte(
			!/gemeinschaftlich/.test(zeilentext),
			`Der Vermerk steht an einer gemeinschaftlichen Zeile: ${zeilentext.slice(0, 120)}`
		);
		// Der Name wird gemeldet, nicht behauptet: Ändert sich der Bestand in
		// immotool, steht es im Bericht statt in einem Befund.
		return `1 Vermerk bei «${zeilentext.split(' ').slice(0, 2).join(' ')}»`;
	});

	await schritt('Was weggelassen wurde, steht in den Hinweisen', async () => {
		// Eine Kennung, die still verschwindet, sucht später jemand in immotool.
		await holeVorschau(gemeinschaft);
		const text = await seitentext();
		behaupte(
			/Authentik-Kennung/.test(text) && /mehrere Personen/.test(text),
			`Kein Hinweis auf die weggelassene Kennung: ${text.slice(0, 600)}`
		);
		return 'genannt';
	});

	await schritt('Ein zweiter Lauf ändert nichts', async () => {
		// Der Unterschied zwischen einer Übernahme und einer Verdoppelung.
		await holeVorschau(gemeinschaft);
		const text = await seitentext();
		/*
		 * **Nichts neu UND nichts geändert.**
		 *
		 * Bis zum 27.08.2026 stand hier nur «nichts neu». Das passte nicht zu der
		 * Zusicherung darunter: Der Knopf sperrt bei `neu + geaendert === 0`
		 * (`uebernahme/+page.svelte`), «0 neu, 3 geändert» liesse ihn also offen,
		 * und der Schritt hätte sich selbst widersprochen — die eine Zeile
		 * zufrieden, die andere rot.
		 *
		 * Beides gehört ohnehin zur Sache: Ein zweiter Lauf, der etwas ändert,
		 * ist so wenig folgenlos wie einer, der etwas anlegt.
		 */
		behaupte(!/\b[1-9]\d* neu\b/.test(text), `Etwas gilt als neu: ${text.slice(0, 300)}`);
		behaupte(
			!/\b[1-9]\d* geändert\b/.test(text),
			`Etwas gilt als geändert: ${text.slice(0, 300)}`
		);

		/*
		 * **Der Knopf steht gesperrt da, und das ist die stärkere Zusicherung.**
		 *
		 * Bis zum 27.08.2026 klickte dieses Drehbuch hier ein zweites Mal und
		 * zählte danach die Einheiten. Inzwischen sperrt die Seite den Knopf,
		 * sobald nichts mehr zu übernehmen ist (`disabled={uebernehmbar === 0}`).
		 * Der Klick lief deshalb dreissig Sekunden ins Leere und meldete einen
		 * Selektor statt der Sache.
		 *
		 * Geprüft wird jetzt die Sperre selbst: Ein zweiter Lauf ist nicht
		 * «folgenlos», sondern gar nicht erst möglich. Die Zählung bleibt
		 * trotzdem stehen, denn eine Sperre allein bewiese noch nicht, dass der
		 * erste Lauf sauber war.
		 */
		const knopf = seite.locator('form[action$="uebernehmen"] button[type="submit"]');
		behaupte(await knopf.count(), 'Der Knopf zum Übernehmen fehlt ganz');
		behaupte(await knopf.isDisabled(), 'Der Knopf lädt zu einem zweiten Lauf ein');

		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const zeilen = await seite.locator('table tbody tr').count();
		behaupte(zeilen === 3, `Nach dem zweiten Lauf ${zeilen} statt 3 Einheiten`);
		return 'gesperrt, 3 Einheiten unverändert';
	});

	await schritt('Mit angelegtem Verteiler kommt die Spalte mit', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		if ((await seite.locator('.verteiler form[action$="verteilerAnlegen"]').count()) === 0) {
			await seite.locator('.verteiler button.flach').click();
			await seite.waitForTimeout(200);
		}
		const form = seite.locator('.verteiler form[action$="verteilerAnlegen"]');
		await form.locator('input[name="key"]').fill('lift');
		await form.locator('input[name="name"]').fill('Lift');
		await form.locator('input[name="denominator"]').fill('720');
		await abschicken(form.locator('button[type="submit"]'));

		await holeVorschau(gemeinschaft);
		const text = await seitentext();
		behaupte(!/Verteiler «Lift» gibt es hier nicht/.test(text), 'Der Lift wird noch vermisst');
		behaupte(/lift: 720 von 720/.test(text), `Der Lift geht nicht auf: ${text.slice(0, 400)}`);
		await abschicken(seite.locator('form[action$="uebernehmen"] button[type="submit"]'));
		return 'lift 720 von 720';
	});

	/*
	 * **Die Rückfrage bei ungleicher Wertquote — und was dabei stehen bleibt.**
	 *
	 * Eine Gemeinschaft mit dem Nenner 900 nimmt 1000 Wertquoten auf; das geht
	 * nicht auf, und es wird nachgefragt. Der stille Fehler wäre hier, dass die
	 * Hinweise dabei verschwinden: Wer entscheiden soll, ob er **trotzdem**
	 * übernimmt, muss weiter sehen, was nicht mitkommt.
	 */
	await schritt('Ungleiche Wertquote wird zurückgefragt, mit Hinweisen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', `${NAME} (Nenner 900)`);
		await seite.fill('input[name="quotaDenominator"]', '900');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		zweite = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];

		await holeVorschau(zweite);
		await abschicken(seite.locator('form[action$="uebernehmen"] button[type="submit"]'));
		const text = await seitentext();
		behaupte(
			/geht nach dieser Übernahme nicht auf/.test(text),
			`Keine Rückfrage: ${text.slice(0, 200)}`
		);
		behaupte(
			/Bevor Sie übernehmen/.test(text) && /nur eine Person/.test(text),
			'Die Hinweise sind bei der Rückfrage verschwunden'
		);

		await seite.locator('input[name="trotzUngleichgewicht"]').check();
		await abschicken(seite.locator('form[action$="uebernehmen"] button[type="submit"]'));
		behaupte(/angelegt/.test(await seitentext()), 'Nach der Bestätigung kein Ergebnis');
		return 'nachgefragt, Hinweise geblieben';
	});

	await schritt('Kein Querlauf am Telefon', async () => {
		const eng = await browser.newPage({ viewport: { width: 390, height: 844 } });
		warteNachNavigation(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'load' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.goto(`${ZIEL}/gemeinschaften/${gemeinschaft}/uebernahme`, {
			waitUntil: 'domcontentloaded'
		});
		await eng.waitForTimeout(400);
		const ueber = await eng.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		await eng.close();
		behaupte(ueber === 0, `Die Seite läuft ${ueber} px quer`);
		return '0 px';
	});

	console.log(`\n  Prüfbestand: ${gemeinschaft} und ${zweite} («${NAME}»)`);
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png` }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
