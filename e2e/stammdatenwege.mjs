/**
 * Die Wege in den Stammdaten — Verteiler, Eigentümer, Personen.
 *
 * **Was hier festgenagelt wird** (Auftraggeber, 11.08.2026):
 *
 *   1. **Ein Verteiler lässt sich wieder entfernen.** «Ich habe vorhin einen
 *      angeklickt und den kann ich nicht wieder entfernen.» Ohne Werte ohne
 *      Rückfrage, mit Werten erst nach einer Rückfrage, die die Zahl nennt.
 *   2. **Die Stammquote bleibt.** Sie trägt das Stimmrecht; für sie gibt es
 *      keinen Entfernen-Knopf.
 *   3. **Entweder neu oder bestehend, nie beides.** «So ist beides irgendwie
 *      vermischt.» Der Schalter entscheidet, welche Felder gelten — bei einer
 *      bestehenden Person gibt es kein Namensfeld mehr.
 *   4. **Zwei Handlungen, zwei Rahmen.** «Einheit zuordnen» und «Eigentümer
 *      erfassen» sind sichtbar getrennt.
 *   5. **Der Kreis schliesst sich.** Von der Eigentümerzeile führt ein Weg zur
 *      Person, und dort stehen ihre Einheiten über alle Gemeinschaften.
 *   6. **Die Knöpfe der gemeinsamen Traktandenliste erklären sich.** «Was
 *      bedeutet Erfordernis setzen?»
 *   7. **Tabellen lassen sich sortieren und filtern** — auf, ab, wieder aus.
 *      Und die Einheitentabelle speichert danach die **richtige** Zeile: Ihre
 *      Feldnamen hängen an der Kennung, nicht an der Stelle.
 *
 * Aufruf: `node e2e/stammdatenwege.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { ergebnisart, nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-stammdatenwege';

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
/** Die Fenstergrösse des Laufs. Einzelne Schritte verkleinern sie und stellen sie zurück. */
const FENSTER = { width: 1440, height: 1200 };
const seite = await browser.newPage({ viewport: FENSTER });
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);

/**
 * Ein Formular abschicken und warten, bis die Antwort auf der Seite steht.
 *
 * Die beiden Wege (mit und ohne `use:enhance`) stehen in `e2e/absendung.mjs`,
 * gemeinsam für alle Drehbücher.
 */
async function abschicken(knopf) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 })
			.catch(() => null),
		knopf.click()
	]);
	await nachAbsendung(seite, antwort, nachladen, 150);
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

/**
 * Was die Seite gerade meldet — **an beiden Orten**.
 *
 * Seit dem 27.08.2026 wandert eine Erfolgsmeldung im Browser in die Ecke unten
 * rechts (`Meldung.svelte` gibt sie an den `Einblender` weiter) und steht dann
 * als `.quittung` da, nicht mehr als `.meldung` an ihrem Platz. Wer nur `.meldung`
 * liest, bekommt nach einem gelungenen Speichern eine leere Zeichenkette und
 * meldet einen Fehler, den es nicht gibt.
 */
const meldung = async () =>
	(await seite.locator('.meldung, .quittung').allInnerTexts())
		.join(' · ')
		.replace(/\s+/g, ' ')
		.trim();

/** Der Aufklapper mit den Verteilern steht zu. */
async function oeffneVerteiler() {
	if ((await seite.locator('.verteiler form[action$="verteilerAnlegen"]').count()) === 0) {
		await seite.locator('.verteiler button.flach').click();
		await seite.waitForTimeout(200);
	}
}

try {
	let gemeinschaft;
	const NAME = `Prüflauf Stammdaten ${LAUF}`;

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
		// Die Zählweise ist Pflicht und hat keine Vorgabe — ohne sie bleibt das
		// Formular mit «Please select one of these options» stehen.
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		behaupte(
			seite.url().includes('/gemeinschaften/') && !seite.url().endsWith('/neu'),
			`Nicht angelegt: ${seite.url()}`
		);
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		return gemeinschaft.slice(0, 8);
	});

	/*
	 * **Die Einordnung steht zuerst und die Reihenfolge ist zwingend.** Gemeldet am
	 * 12.08.2026: «Jetzt erfasse ich zwei neue Gemeinschaften und möchte eine
	 * übergeordnete Gemeinschaft erfassen. Wie mache ich das? Die Frage müsste
	 * weiter oben kommen, als erstes.» Sie stand ganz unten, hinter Zählweise,
	 * Stichentscheid, Vollmachten und KI.
	 *
	 * Der stille Fehler wäre hier eine Wahl, die im Formular steht und beim
	 * Speichern verlorengeht — die Seite sähe richtig aus, und die Häuser stünden
	 * in der Liste nebeneinander statt darunter.
	 */
	await schritt('Die Einordnung ist das erste Feld des Formulars', async () => {
		await gehe('/gemeinschaften/neu');
		const feld = seite.locator('select[name="parentStwegId"]');
		behaupte(await feld.count(), 'Keine Frage nach der übergeordneten Gemeinschaft');
		/*
		 * Geprüft wird die Reihenfolge im Dokument und nicht die Lage in Pixeln:
		 * Seit die Kopffelder in zwei Spalten stehen, beginnt die Bezeichnung
		 * rechts weiter oben als das Auswahlfeld links. Was zählt, ist die Folge, in
		 * der man das Formular durchläuft — und die ist die des Dokuments.
		 */
		const folge = await seite.evaluate(() =>
			[...document.querySelectorAll('form.formular [name]')]
				.filter((e) => e.type !== 'hidden')
				.map((e) => e.name)
		);
		behaupte(
			folge.indexOf('art') === 0,
			`Das erste Feld heisst «${folge[0]}», nicht «art»`
		);
		behaupte(
			folge.indexOf('parentStwegId') < folge.indexOf('name'),
			`Die Einordnung steht an Stelle ${folge.indexOf('parentStwegId') + 1}, die Bezeichnung schon an ${folge.indexOf('name') + 1}`
		);
		// Der Normalfall ist vorgewählt: Wer nichts anfasst, legt eine
		// eigenständige Gemeinschaft an, die für sich steht.
		behaupte((await feld.inputValue()) === '', 'Etwas anderes als «steht für sich» ist vorgewählt');
		behaupte(
			await seite.locator('input[name="art"][value="eigene"]').isChecked(),
			'«Eine Gemeinschaft mit eigenen Einheiten» ist nicht vorgewählt'
		);
		return folge.slice(0, 4).join(' → ');
	});

	let klammer = null;
	let untergeordnet = null;

	/*
	 * **Der Nenner des Hauses ist sein Anteil an der Klammer.** Diese Prüfung ist
	 * im ersten Anlauf daran gescheitert: Ein Haus mit Nenner 1000 unter eine
	 * Gemeinschaft gehängt, die aus eigenen Einheiten schon 1000 trägt, ergibt
	 * «1000 zu viel (erfasst 2000 von 1000)» — und das ist richtig gerechnet
	 * (`pruefeSalden`, Test «rechnet die Untergemeinschaften auf einer Dachebene
	 * mit eigener Quote an»). Deshalb steht die Klammer hier für sich, ohne eigene
	 * Einheiten, und trägt denselben Nenner wie ihr einziges Haus.
	 */
	/*
	 * **Eine Klammer verlangt weniger.** Gefragt am 12.08.2026: «Braucht es weniger
	 * Angaben, wenn es eine übergeordnete Sammelbehälter ist? … Da bräuchte es nur
	 * Adresse und Bezeichnung und keine Angaben über WQ etc.»
	 *
	 * Der stille Fehler wäre hier ein ausgeblendetes Feld, das trotzdem `required`
	 * ist: Das Formular liesse sich nicht absenden, und der Browser meldete «not
	 * focusable» an einer Stelle, die niemand sieht.
	 */
	await schritt('Als Klammer verlangt das Formular nur Bezeichnung und Anschrift', async () => {
		await gehe('/gemeinschaften/neu');
		const sichtbare = async () =>
			seite.evaluate(
				() =>
					[...document.querySelectorAll('form.formular input:not([type=hidden]), form.formular select')]
						.filter((e) => e.offsetParent !== null).length
			);
		const voll = await sichtbare();
		await seite.locator('input[name="art"][value="klammer"]').check();
		const knapp = await sichtbare();
		behaupte(knapp < voll, `Als Klammer stehen ${knapp} Felder da, als Gemeinschaft ${voll}`);
		const bloecke = await seite.locator('form.formular legend').allInnerTexts();
		behaupte(
			!bloecke.some((b) => /Zählweise|Stimmengleichheit|Vollmachten|KI/.test(b)),
			`Blöcke stehen noch da: ${bloecke.join(', ')}`
		);
		// Der Nenner geht als verstecktes Feld mit — fehlte er, machte `ganzzahl`
		// daraus NaN und der Kern wiese es zu Recht ab.
		const versteckt = await seite.locator('input[type=hidden][name="quotaDenominator"]').inputValue();
		behaupte(versteckt === '0', `Der versteckte Nenner ist «${versteckt}»`);

		/*
		 * **Und die Frage nach der übergeordneten ist weg.** Gemeldet am 12.08.2026:
		 * «Wenn übergeordnet ist, sollte diese nicht ‹Gehört diese Gemeinschaft zu
		 * einer übergeordneten?› möglich sein.» Nachgerechnet wäre eine
		 * Zwischenebene ohne eigene Quote nicht rechenbar — sie trägt nach oben
		 * nichts bei, und der Saldo der obersten Ebene ginge nie auf.
		 *
		 * Anders als die Abstimmungsangaben geht sie **nicht** versteckt mit: Jene
		 * warten gültig, diese widerspricht der getroffenen Wahl.
		 */
		behaupte(
			(await seite.locator('select[name="parentStwegId"]').count()) === 0,
			'Die Frage nach der übergeordneten steht noch da'
		);
		behaupte(
			(await seite.locator('input[type=hidden][name="parentStwegId"]').count()) === 0,
			'Die Zuordnung geht versteckt mit, statt zu entfallen'
		);
		return `${voll} → ${knapp} Felder`;
	});

	await schritt('Eine Klammer und ein Haus darunter anlegen', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.locator('input[name="art"][value="klammer"]').check();
		await seite.fill('input[name="name"]', `${NAME} Klammer`);
		await abschicken(seite.locator('main button[type="submit"]').first());
		klammer = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(
			seite.url().includes('/gemeinschaften/') && !seite.url().endsWith('/neu'),
			`Klammer nicht angelegt: ${seite.url()}`
		);

		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', `${NAME} Haus A`);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await seite.locator('select[name="parentStwegId"]').selectOption(klammer);
		await abschicken(seite.locator('main button[type="submit"]').first());
		untergeordnet = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(untergeordnet && untergeordnet !== klammer, `Nicht angelegt: ${seite.url()}`);

		// Die Gemeinschaftsseite sagt es, und das Formular hält die Wahl fest.
		const text = await seite.locator('main').innerText();
		behaupte(text.includes('Untergemeinschaft'), 'Die Seite nennt die Einordnung nicht');
		await gehe(`/gemeinschaften/${untergeordnet}/angaben`);
		const gewaehlt = await seite.locator('select[name="parentStwegId"]').inputValue();
		behaupte(gewaehlt === klammer, `Beim Ändern steht «${gewaehlt}» statt der Klammer`);
		return `${untergeordnet.slice(0, 8)} unter ${klammer.slice(0, 8)}`;
	});

	await schritt('In der Liste steht das Haus eingerückt unter seiner Klammer', async () => {
		await gehe('/gemeinschaften');
		/*
		 * **Erst suchen, dann messen.**
		 *
		 * Die Liste zeigt ab `LISTENGRENZE` (25) nicht mehr alles, solange
		 * niemand sucht oder «alle zeigen» drückt (`domain/listensuche.ts`). Am
		 * 27.08.2026 standen 96 Gemeinschaften da, die eben angelegte fiel hinten
		 * heraus, und das Drehbuch wartete dreissig Sekunden auf einen Verweis,
		 * der zu Recht fehlte.
		 *
		 * Die Begrenzung ist kein Mangel: Bei 96 Zeilen sucht auch ein Mensch,
		 * statt zu rollen. Das Drehbuch tut jetzt dasselbe — und misst damit den
		 * Weg, den es im Betrieb wirklich gibt.
		 */
		/*
		 * **Und nur, wenn es ein Feld gibt** (27.08.2026, nachgemessen). Es steht
		 * erst ab neun Gemeinschaften (`brauchtSuchfeld`), ein aufgeräumter
		 * Prüfbestand liegt darunter, und der Schritt fiel deshalb über eine
		 * Behauptung, die nur auf einer vollen Datenbank hielt. Der andere Zweig
		 * verdeckt nichts: Ohne Feld ist der Bestand kleiner als die Schwelle und
		 * damit auch kleiner als `LISTENGRENZE`, die Liste steht also vollständig
		 * da. Nachgemessen wird das trotzdem.
		 */
		const suchfeld = seite.locator('input[type="search"]').first();
		if (await suchfeld.count()) {
			await suchfeld.fill(NAME);
			await seite.waitForTimeout(250);
		} else {
			const zeilen = await seite.locator('ul.liste > li').count();
			behaupte(
				zeilen > 0 && zeilen <= 8,
				`Kein Suchfeld, aber ${zeilen} Zeilen — die Liste könnte gekürzt sein`
			);
		}

		const oben = await seite.locator(`a[href="/gemeinschaften/${klammer}"]`).first().boundingBox();
		behaupte(oben, 'Die Klammer fehlt in der Liste');
		// Eingerückt heisst hier: weiter rechts als die Klammer darüber.
		const unten = await seite.locator(`a[href="/gemeinschaften/${untergeordnet}"]`).first().boundingBox();
		behaupte(unten.y > oben.y, 'Das Haus steht nicht unter seiner Klammer');
		behaupte(
			unten.x > oben.x,
			`Keine Einrückung: Klammer bei x=${Math.round(oben.x)}, Haus bei x=${Math.round(unten.x)}`
		);
		return `Klammer x=${Math.round(oben.x)}, Haus x=${Math.round(unten.x)}`;
	});

	/*
	 * Eine Klammer mit Nenner null hat gar keine Stammquotenart — der Auslöser
	 * `stweg_stammquote_mitfuehren` legt keine an. Also darf dort auch keine
	 * Saldozeile stehen: Eine Ebene mit Soll 0 und einem Haus darunter läse sich
	 * sonst als «1000 zu viel».
	 */
	await schritt('Die Klammer selbst fordert keine Wertquoten ein', async () => {
		await gehe(`/gemeinschaften/${klammer}/einheiten`);
		const zeilen = await seite.locator('.salden li').allInnerTexts();
		behaupte(
			!zeilen.some((z) => /zu viel|fehlen/.test(z)),
			`Die Klammer meldet eine Abweichung: ${zeilen.join(' | ')}`
		);
		return zeilen.length === 0 ? 'keine Saldozeile' : zeilen[0].replace(/\s+/g, ' ').slice(0, 60);
	});

	// ── 1. Verteiler anlegen und wieder entfernen ────────────────────────────

	await schritt('Einen Verteiler anlegen', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		await oeffneVerteiler();
		await seite.fill('.verteiler input[name="key"]', 'vertippt');
		await seite.fill('.verteiler input[name="name"]', 'Vertippt');
		await seite.fill('.verteiler input[name="denominator"]', '100');
		await abschicken(seite.locator('.verteiler button[type="submit"]').last());
		behaupte((await meldung()).includes('Verteiler angelegt'), `Meldung: ${await meldung()}`);
	});

	await schritt('Ein ungenutzter Verteiler geht ohne Rückfrage weg', async () => {
		// Genau der gemeldete Fall: eben angelegt, vertippt, wieder weg.
		await oeffneVerteiler();
		const zeile = seite.locator('.bestand li', { hasText: 'Vertippt' });
		behaupte((await zeile.count()) === 1, 'Der angelegte Verteiler steht nicht im Bestand');
		await abschicken(zeile.locator('button[type="submit"]'));
		const m = await meldung();
		behaupte(m.includes('Verteiler entfernt'), `Meldung: ${m}`);
		await oeffneVerteiler();
		behaupte(
			(await seite.locator('.bestand li', { hasText: 'Vertippt' }).count()) === 0,
			'Der Verteiler steht immer noch da'
		);
	});

	await schritt('Für die Stammquote gibt es keinen Entfernen-Knopf', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		await oeffneVerteiler();
		behaupte(
			(await seite.locator('.bestand li', { hasText: 'Stammquote' }).count()) === 0,
			'Die Stammquote steht mit Entfernen-Knopf im Bestand'
		);
	});

	await schritt('Ein Verteiler mit erfassten Werten fragt mit der Zahl zurück', async () => {
		await oeffneVerteiler();
		await seite.fill('.verteiler input[name="key"]', 'lift');
		await seite.fill('.verteiler input[name="name"]', 'Aufzug');
		await seite.fill('.verteiler input[name="denominator"]', '100');
		await abschicken(seite.locator('.verteiler button[type="submit"]').last());

		// Zwei Einheiten mit Aufzugsanteil.
		for (const [bez, stamm, lift] of [
			['Wohnung oben', '600', '60'],
			['Wohnung unten', '400', '40']
		]) {
			await seite.fill('form.neu input[name="label"]', bez);
			await seite.fill('form.neu input[name="quote.stamm"]', stamm);
			await seite.fill('form.neu input[name="quote.lift"]', lift);
			await abschicken(seite.locator('form.neu button[type="submit"]'));
		}

		await oeffneVerteiler();
		await abschicken(
			seite.locator('.bestand li', { hasText: 'Aufzug' }).locator('button[type="submit"]')
		);
		/*
		 * **Die Rückfrage steht in einem Fenster** (26.08.2026). Bis dahin war sie
		 * eine Kachel am Kopf der Seite — wer unten in der Tabelle klickte, musste
		 * erst nach oben rollen, um sie zu lesen. Gemessen wird jetzt am
		 * `dialog.rueckfrage`, und ausdrücklich auch, **dass** es offen ist: Eine
		 * Frage, die keiner sieht, ist keine.
		 */
		const fenster = seite.locator('dialog.serverfrage');
		// **Auf den Zustand warten, nicht auf eine Frist.** `open` steht schon im
		// ausgelieferten HTML; zum Fenster wird es erst nach der Hydration. Eine
		// feste Wartezeit wäre auf einem belasteten Rechner zu kurz und meldete
		// dann einen Fehler im Bauteil, wo nur der Test zu schnell war.
		await seite
			.waitForFunction(
				() => document.querySelector('dialog.serverfrage')?.matches(':modal') === true,
				null,
				{ timeout: 10000 }
			)
			.catch(() => behaupte(false, 'Die Rückfrage steht nicht als Fenster über der Seite'));
		const m = (await fenster.innerText()).replace(/\s+/g, ' ').trim();
		behaupte(m.includes('2 Einheiten'), `Die Rückfrage nennt die Zahl nicht: ${m}`);
		behaupte(m.includes('Aufzug'), `Die Rückfrage nennt den Verteiler nicht: ${m}`);
		await seite.screenshot({ path: `${AUFNAHMEN}/rueckfrage.png` });
		return m.slice(0, 80);
	});

	await schritt('Abbrechen schliesst das Fenster, ohne etwas zu entfernen', async () => {
		await seite.locator('dialog.serverfrage a.ab').click();
		await seite.waitForTimeout(250);
		behaupte(
			!(await seite.locator('dialog.serverfrage').evaluate((d) => d.open)),
			'Das Fenster steht nach «Abbrechen» noch offen'
		);
		/*
		 * **Neu laden, sonst prüft die Behauptung sich selbst.** «Abbrechen»
		 * schliesst nur das Fenster, es geht keine Anfrage hinaus — die Spalte im
		 * DOM steht danach zwangsläufig noch da, auch wenn der Server sie längst
		 * entfernt hätte. Erst der frische Aufruf sagt etwas über die Datenbank.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		behaupte(
			(await seite.locator('table th', { hasText: 'Aufzug' }).count()) > 0,
			'Der Verteiler ist nach blossem Abbrechen verschwunden'
		);
		return 'zu, nichts entfernt';
	});

	await schritt('Nach der Bestätigung ist er weg, die Stammquote geht weiter auf', async () => {
		// Nach dem Abbrechen ist der Aufklapper wieder zu — er merkt sich seinen
		// Zustand nicht über das Formularergebnis hinweg.
		await oeffneVerteiler();
		await abschicken(
			seite.locator('.bestand li', { hasText: 'Aufzug' }).locator('button[type="submit"]')
		);
		await abschicken(seite.locator('dialog.serverfrage button.ja'));
		behaupte((await meldung()).includes('Verteiler entfernt'), `Meldung: ${await meldung()}`);
		const salden = await seite.locator('.salden li').first().innerText();
		behaupte(salden.includes('✓'), `Die Stammquote geht nicht auf: ${salden}`);
		behaupte(
			(await seite.locator('table th', { hasText: 'Aufzug' }).count()) === 0,
			'Die Spalte des Verteilers steht noch in der Tabelle'
		);
		return salden.replace(/\s+/g, ' ').trim();
	});

	// ── 2. Eigentümer: entweder neu oder bestehend ───────────────────────────

	await schritt('Zwei Handlungen stehen in zwei Rahmen', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const rahmen = await seite.locator('section.kachel').count();
		behaupte(rahmen === 2, `Abgesetzte Abschnitte: ${rahmen} statt 2`);
		const zu = await seite.locator('section.zuordnen h2').innerText();
		const er = await seite.locator('section.neu.kachel h2').innerText();
		return `«${zu}» und «${er}»`;
	});

	await schritt('Beim neuen Weg steht ein Namensfeld, keine Personenliste', async () => {
		// Seit dem 27.08.2026 ist «Wen tragen Sie ein?» in beiden Zweigen dasselbe
		// Bedienelement: ein Auswahlfeld (docs/gestaltung.md, Regel 1). Vorher
		// standen hier zwei Auswahlknöpfe.
		const wahl = seite.locator('select[name="personwahl"]');
		behaupte((await wahl.count()) === 1, `Auswahlfeld ${await wahl.count()}-mal statt einmal`);
		behaupte(
			(await wahl.inputValue()) === 'neu',
			`Der neue Weg ist nicht vorgewählt: ${await wahl.inputValue()}`
		);
		behaupte(
			(await seite.locator('section.neu.kachel input[name="displayName"]').count()) === 1,
			'Kein Namensfeld'
		);
		behaupte(
			(await seite.locator('section.neu.kachel select[name="personId"]').count()) === 0,
			'Die Personenliste steht daneben — genau die gemeldete Vermischung'
		);
	});

	await schritt('Eine neue Person erfassen', async () => {
		await seite.fill('section.neu.kachel input[name="displayName"]', `Renate Prüflauf ${LAUF}`);
		await seite.fill('section.neu.kachel input[name="email"]', 'renate@example.org');
		await abschicken(seite.locator('section.neu.kachel button[type="submit"]'));
		behaupte((await meldung()).includes('Eigentümer angelegt'), `Meldung: ${await meldung()}`);
	});

	await schritt('Beim bestehenden Weg verschwindet das Namensfeld', async () => {
		await seite.locator('select[name="personwahl"]').selectOption('bestehend');
		await seite.waitForTimeout(200);
		behaupte(
			(await seite.locator('section.neu.kachel input[name="displayName"]').count()) === 0,
			'Das Namensfeld steht noch da — beides zugleich'
		);
		behaupte(
			(await seite.locator('section.neu.kachel select[name="personId"]').count()) === 1,
			'Keine Personenliste'
		);
		behaupte(
			(await seite.locator('section.neu.kachel input[name="email"]').count()) === 0,
			'Die Anschrift wird doppelt erfasst'
		);
		await seite.screenshot({ path: `${AUFNAHMEN}/entweder-oder.png` });
	});

	await schritt('Dieselbe Person zweimal erzeugt keine zweite Zeile', async () => {
		const liste = seite.locator('section.neu.kachel select[name="personId"]');
		const wert = await liste
			.locator('option', { hasText: `Renate Prüflauf ${LAUF}` })
			.first()
			.getAttribute('value');
		await liste.selectOption(wert);
		await abschicken(seite.locator('section.neu.kachel button[type="submit"]'));
		const m = await meldung();
		behaupte(m.includes('bereits geführt'), `Meldung: ${m}`);
		const zeilen = await seite
			.locator('table.karten tbody tr', { hasText: `Renate Prüflauf ${LAUF}` })
			.count();
		behaupte(zeilen === 1, `${zeilen} Zeilen für einen Menschen`);
		return m.slice(0, 70);
	});

	await schritt('Von der Zeile führt ein Weg zur Person', async () => {
		const weg = seite.locator('table.karten a[href^="/personen/"]').first();
		behaupte((await weg.count()) === 1, 'Kein Weg zur Person');
		await weg.click();
		try {
			await seite.waitForURL('**/personen/**', { timeout: 8000 });
		} catch {
			// Diagnose statt Vermutung: Was steht nach dem Klick da?
			const noch = await weg.count();
			const sichtbar = noch ? await weg.isVisible() : false;
			behaupte(
				false,
				`Gelandet auf ${seite.url()} — Weg noch da: ${noch}, sichtbar: ${sichtbar}`
			);
		}
		await seite.waitForLoadState('load');
		behaupte(seite.url().includes('/personen/'), `Gelandet auf ${seite.url()}`);
		const ueberschrift = await seite.locator('h1').innerText();
		behaupte(
			ueberschrift.includes('Renate Prüflauf'),
			`Falsche Person: ${ueberschrift}`
		);
		// Dort steht der Weg, nach dem gefragt wurde: Einheiten der Person zuordnen.
		behaupte(
			(await seite.locator('h2', { hasText: 'Einheit zuordnen' }).count()) === 1,
			'Auf der Personenseite fehlt das Zuordnen von Einheiten'
		);
		return ueberschrift;
	});

	// ── 3. Sortieren und Filtern ─────────────────────────────────────────────

	await schritt('Der Spaltenkopf sortiert auf, ab und wieder aus', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const namen = () =>
			seite
				.locator('table.karten tbody tr td.kopfzelle')
				.evaluateAll((tds) => tds.map((t) => t.textContent.replace(/\s+/g, ' ').trim()));
		const kopf = seite.locator('table.karten thead th button').first();
		const richtung = () => seite.locator('table.karten thead th').first().getAttribute('aria-sort');

		behaupte((await richtung()) === 'none', 'Die Tabelle kommt schon sortiert');
		await kopf.click();
		await seite.waitForTimeout(150);
		const auf = await namen();
		behaupte((await richtung()) === 'ascending', 'Der erste Klick sortiert nicht aufsteigend');

		await kopf.click();
		await seite.waitForTimeout(150);
		const ab = await namen();
		behaupte((await richtung()) === 'descending', 'Der zweite Klick dreht nicht um');
		behaupte(
			JSON.stringify(ab) === JSON.stringify([...auf].reverse()),
			`Nicht die umgekehrte Reihenfolge: ${ab.join(' · ')}`
		);

		// Der dritte Klick hebt auf — sonst gäbe es keinen Weg zur ursprünglichen
		// Reihenfolge zurück.
		await kopf.click();
		await seite.waitForTimeout(150);
		behaupte((await richtung()) === 'none', 'Der dritte Klick hebt die Sortierung nicht auf');
		return `${auf.length} Zeilen, auf → ab → aus`;
	});

	await schritt('Unter neun Zeilen steht kein Suchfeld', async () => {
		/*
		 * **Die Grenze selbst** (27.08.2026). Seit `brauchtSuchfeld` erscheint die
		 * Suche erst ab neun durchsuchbaren Namen. Die Prüfgemeinschaft führt bis
		 * hierher eine Zeile, also darf kein Feld dastehen. Ohne diesen Schritt
		 * bewiese der nächste nur, dass ein vorhandenes Feld filtert, nie dass die
		 * Schwelle überhaupt wirkt.
		 */
		const zeilen = await seite.locator('table.karten tbody tr').count();
		behaupte(zeilen < 9, `Der Prüfbestand ist mit ${zeilen} Zeilen zu gross für diesen Nachweis`);
		behaupte(
			(await seite.locator('.suchleiste input[type="search"]').count()) === 0,
			'Bei wenigen Zeilen steht trotzdem ein Suchfeld'
		);
		return `${zeilen} Zeile(n), kein Feld`;
	});

	await schritt('Ab neun Zeilen erscheint die Suche und filtert', async () => {
		/*
		 * **Warum das Drehbuch hier Zeilen anlegt.** Die Suche ist an eine Schwelle
		 * gebunden, ein Nachweis über sie braucht also den Bestand, ab dem sie
		 * erscheint. Vorher stand hier ein `fill` auf ein Feld, das es bei einer
		 * Zeile gab; seit dem 27.08.2026 gibt es das nicht mehr, und der Schritt
		 * lief in die Zeitüberschreitung. Angelegt wird über denselben Weg wie in
		 * «Eine neue Person erfassen», die Namen tragen `Prüflauf` und fallen damit
		 * unter `scripts/testdaten-entfernen.sql`.
		 */
		while ((await seite.locator('table.karten tbody tr').count()) < 9) {
			const nummer = await seite.locator('table.karten tbody tr').count();
			await seite.locator('select[name="personwahl"]').selectOption('neu');
			await seite.waitForTimeout(150);
			await seite.fill('section.neu.kachel input[name="displayName"]', `Fuellzeile ${nummer} Prüflauf ${LAUF}`);
			await abschicken(seite.locator('section.neu.kachel button[type="submit"]'));
		}

		const alle = await seite.locator('table.karten tbody tr').count();
		behaupte(
			(await seite.locator('.suchleiste input[type="search"]').count()) === 1,
			`Bei ${alle} Zeilen fehlt das Suchfeld`
		);

		// Ein Wort, das sicher nicht vorkommt: «alle ausser einer» liesse sich
		// sonst nicht unterscheiden von «nichts gefiltert».
		await seite.fill('.suchleiste input[type="search"]', 'Zzz-gibt-es-nicht');
		await seite.waitForTimeout(250);
		behaupte(
			(await seite.locator('table.karten tbody tr').count()) === 0,
			'Der Filter lässt Zeilen stehen, die nicht passen'
		);
		behaupte(
			(await seite.locator('main').innerText()).includes('Niemand passt zu'),
			'Kein Hinweis, dass nichts passt'
		);

		await seite.fill('.suchleiste input[type="search"]', 'Renate');
		await seite.waitForTimeout(250);
		const treffer = await seite.locator('table.karten tbody tr').count();
		behaupte(treffer > 0, 'Der Filter findet die erfasste Person nicht');
		const zaehler = (await seite.locator('.suchleiste .zaehler').innerText())
			.replace(/\s+/g, ' ')
			.trim();
		behaupte(zaehler.includes(`von ${alle}`), `Zähler stimmt nicht: ${zaehler}`);

		await seite.fill('.suchleiste input[type="search"]', '');
		await seite.waitForTimeout(200);
		behaupte(
			(await seite.locator('table.karten tbody tr').count()) === alle,
			'Nach dem Leeren fehlen Zeilen'
		);
		return `${alle} → 0 → ${treffer} → ${alle}`;
	});

	await schritt('Nach dem Sortieren speichert die Tabelle die richtige Zeile', async () => {
		// **Der gefährliche Fall.** Die Zeilen der Einheitentabelle tragen
		// Formularfelder, deren Namen an der Kennung hängen (`label.<id>`). Hinge
		// der Name an der **Stelle**, schriebe ein Speichern nach dem Sortieren die
		// Werte in die falschen Einheiten — und niemand merkte es, bis eine
		// Wertquote nicht mehr aufginge.
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const felder = () =>
			seite.locator('table tbody tr input[name^="label."]').evaluateAll((e) => e.map((x) => x.value));
		const vorher = await felder();

		const kopf = seite.locator('table thead th button').first();
		await kopf.click();
		await seite.waitForTimeout(150);
		await kopf.click();
		await seite.waitForTimeout(150);
		const sortiert = await felder();
		behaupte(
			JSON.stringify(sortiert) === JSON.stringify([...vorher].sort().reverse()),
			`Nicht absteigend sortiert: ${sortiert.join(' · ')}`
		);

		const ziel = seite.locator('table tbody tr input[name^="label."]').first();
		const neu = `${sortiert[0]} [Probe]`;
		await ziel.fill(neu);
		const antwort = await abschicken(
			seite.locator('button[type="submit"]', { hasText: 'Tabelle speichern' })
		);

		/*
		 * **Erst die Antwort, dann das Feld.** Seit die Seite nicht mehr neu lädt,
		 * steht das Getippte auch dann noch im Feld, wenn der Server abgewiesen
		 * hat — `reset()` und `invalidateAll()` laufen nur bei Erfolg. Ohne diese
		 * Zusicherung wäre der Schritt bei einer abgewiesenen Speicherung grün und
		 * läse bloss sein eigenes Getipptes zurück.
		 */
		const art = await ergebnisart(antwort);
		behaupte(art === 'success', `Die Absendung endete als «${art}»`);

		const nachher = await felder();
		const getroffen = nachher.filter((n) => n.includes('[Probe]'));
		behaupte(getroffen.length === 1, `${getroffen.length} Zeilen geändert statt einer`);
		behaupte(getroffen[0] === neu, `Die falsche Einheit trägt den Namen: ${getroffen[0]}`);
		return `${vorher.length} Zeilen, geändert wurde «${neu}»`;
	});

	// ── 3a. Einheiten von der Person aus sicher wechseln ─────────────────────

	let personenpfad;
	let wohnungObenId;
	let wohnungUntenId;
	await schritt('Die Personenseite zeigt freie und belegte Einheiten samt Gemeinschaft', async () => {
		/*
		 * Neun Einheiten erzwingen das Suchfeld. Die sieben zusätzlichen tragen
		 * Quote null; der bestehende Saldo bleibt deshalb unverändert.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		for (let i = 1; i <= 7; i += 1) {
			await seite.fill('form.neu input[name="label"]', `Probeeinheit ${i} ${LAUF}`);
			await seite.fill('form.neu input[name="quote.stamm"]', '0');
			await abschicken(seite.locator('form.neu button[type="submit"]'));
		}

		// Eine andere Eigentümerzeile hält «Wohnung oben» seit 2020. Damit ist der
		// folgende Weg ein echter Wechsel und nicht bloss eine Erstzuordnung.
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const zuordnen = seite.locator('section.zuordnen form');
		wohnungObenId = await zuordnen
			.locator('select[name="unitId"] option', { hasText: 'Wohnung oben' })
			.getAttribute('value');
		wohnungUntenId = await zuordnen
			.locator('select[name="unitId"] option', { hasText: 'Wohnung unten' })
			.getAttribute('value');
		const bisherigePartei = await zuordnen
			.locator('select[name="partyId"] option', { hasText: 'Fuellzeile' })
			.first()
			.getAttribute('value');
		behaupte(
			wohnungObenId && wohnungUntenId && bisherigePartei,
			'Einheit oder bisheriger Eigentümer fehlt'
		);
		await zuordnen.locator('select[name="unitId"]').selectOption(wohnungObenId);
		await zuordnen.locator('select[name="partyId"]').selectOption(bisherigePartei);
		await zuordnen.locator('input[name="ab"]').fill('2020-01-01');
		await abschicken(zuordnen.locator('button[type="submit"]'));

		const personenweg = seite
			.locator('table.karten a[href^="/personen/"]', { hasText: `Renate Prüflauf ${LAUF}` })
			.first();
		personenpfad = await personenweg.getAttribute('href');
		behaupte(personenpfad, 'Der Weg zur Zielperson fehlt');
		await gehe(personenpfad);

		const formular = seite.locator('form[action$="/zuordnen"]:has(select[name="unitId"])');
		const auswahl = formular.locator('select[name="unitId"]');
		const freieOption = await auswahl.locator(`option[value="${wohnungUntenId}"]`).innerText();
		const belegteOption = await auswahl.locator(`option[value="${wohnungObenId}"]`).innerText();
		behaupte(freieOption.includes('noch ohne Eigentümer'), `Freie Einheit: ${freieOption}`);
		behaupte(belegteOption.includes('zugeordnet an Fuellzeile'), `Belegte Einheit: ${belegteOption}`);

		const suche = formular.locator('input[type="search"]');
		behaupte((await suche.count()) === 1, 'Bei neun Einheiten fehlt das Suchfeld');
		const insgesamt = await auswahl.locator('option:not([value=""])').count();
		await suche.fill(NAME);
		await seite.waitForTimeout(200);
		const sichtbar = await auswahl.locator('option:not([value=""])').count();
		const zaehler = (await formular.locator('.zaehler').innerText()).trim();
		behaupte(sichtbar === 9, `Die Gemeinschaftssuche zeigt ${sichtbar} statt 9 Einheiten`);
		behaupte(zaehler === `9 von ${insgesamt}`, `Der Zähler lautet «${zaehler}»`);
		return `${freieOption} · ${belegteOption} · ${zaehler}`;
	});

	await schritt('Ein Eigentumswechsel fragt vor dem Schreiben zurück und lässt sich abbrechen', async () => {
		await gehe(personenpfad);
		const formular = seite.locator('form[action$="/zuordnen"]:has(select[name="unitId"])');
		const einheit = formular.locator('select[name="unitId"]');
		await einheit.selectOption(wohnungObenId);
		const ab = await formular.locator('input[name="ab"]').inputValue();
		await abschicken(formular.locator('button[type="submit"]'));

		const fenster = seite.locator('dialog.serverfrage');
		await fenster.waitFor({ state: 'visible', timeout: 10000 });
		const frage = (await fenster.innerText()).replace(/\s+/g, ' ').trim();
		behaupte(frage.includes('Wohnung oben'), `Die Frage nennt die Einheit nicht: ${frage}`);
		behaupte(frage.includes('Fuellzeile'), `Die Frage nennt den bisherigen Eigentümer nicht: ${frage}`);
		behaupte(frage.includes(`Renate Prüflauf ${LAUF}`), `Die Frage nennt die Zielperson nicht: ${frage}`);
		const datum = new Date(`${ab}T12:00:00`).toLocaleDateString('de-CH', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'Europe/Zurich'
		});
		behaupte(frage.includes(datum), `Die Frage nennt ${datum} nicht: ${frage}`);
		await fenster.locator('a.ab').click();

		// Frisch laden: Nur so wird geprüft, dass Abbrechen auch den Serverbestand
		// unverändert liess und nicht bloss das Fenster geschlossen hat.
		await gehe(personenpfad);
		const nachher = await seite
			.locator(`select[name="unitId"] option[value="${wohnungObenId}"]`)
			.innerText();
		behaupte(nachher.includes('zugeordnet an Fuellzeile'), `Nach Abbruch geändert: ${nachher}`);
		return 'Rückfrage gesehen, abgebrochen, bisheriger Eigentümer bleibt';
	});

	await schritt('Bestätigen führt den Wechsel aus und nimmt die eigene Einheit aus der Wahl', async () => {
		const formular = seite.locator('form[action$="/zuordnen"]:has(select[name="unitId"])');
		const einheit = formular.locator('select[name="unitId"]');
		await einheit.selectOption(wohnungObenId);
		await abschicken(formular.locator('button[type="submit"]'));
		await abschicken(seite.locator('dialog.serverfrage button.ja'));
		const m = await meldung();
		behaupte(m.includes('Wohnung oben') && m.includes(`Renate Prüflauf ${LAUF}`), `Meldung: ${m}`);

		await gehe(personenpfad);
		behaupte(
			(await seite
				.locator(`select[name="unitId"] option[value="${wohnungObenId}"]`)
				.count()) === 0,
			'Die bereits selbst gehaltene Einheit steht weiter in der Auswahl'
		);
		behaupte(
			(await seite
				.locator(`table.liste tbody tr:has(a[href="/gemeinschaften/${gemeinschaft}"])`, {
					hasText: 'Wohnung oben'
				})
				.count()) === 1,
			'Die bestätigte Einheit steht nicht im Bestand der Person'
		);
		return m;
	});

	// ── 3b. Speichern lässt die Seite stehen (Auftraggeber, 27.08.2026) ──────────────
	//
	// «Wichtig wäre, wenn man speichert die Seite nicht Top springt.» Gemessen
	// am 27.08.2026 vor dem Umbau: Neuaufbau der Seite, Rollposition 615 px vor
	// dem Speichern, 0 px danach.
	//
	// **Ein kleineres Fenster, damit es überhaupt etwas zu rollen gibt.** Bei
	// 1440×1200 passt die Seite dieses Prüflaufs fast ganz ins Bild, und ein
	// Sprung von 40 px auf 0 beweist wenig. `try/finally`, weil `schritt()`
	// jeden Fehler auffängt und weiterläuft: Ohne das liefen alle folgenden
	// Schritte in einem 480 px hohen Fenster und meldeten Folgefehler.

	await schritt('Speichern lässt die Seite stehen, wo sie steht', async () => {
		await seite.setViewportSize({ width: 1280, height: 480 });
		try {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const knopf = seite.locator('button[data-fokus="speichern"]');
			await knopf.scrollIntoViewIfNeeded();
			await seite.waitForTimeout(150);
			const vorher = await seite.evaluate(() => {
				window.__dasselbeDokument = true;
				return Math.round(window.scrollY);
			});
			behaupte(vorher > 100, `Nur ${vorher} px gerollt — der Fall ist so nicht geprüft`);

			/*
			 * **`requestSubmit()` statt `click()`.** Ein Klick rollt das Ziel von
			 * sich aus ins Bild und verfälscht damit genau die Messung, um die es
			 * geht (am 27.08.2026 einmal passiert, der erste Messwert war
			 * unbrauchbar). Dafür führt `requestSubmit()` die Feldprüfung des
			 * Browsers durch und schickt bei einem leeren Pflichtfeld gar nichts —
			 * der Browser rollte dann zum Feld, und der Befund läse sich wie ein
			 * Ausfall von `use:enhance`. Deshalb steht die Zusicherung auf der
			 * Antwort davor: Ohne POST gibt es keinen Messwert, sondern einen
			 * Befund mit der richtigen Ursache.
			 */
			const [antwort] = await Promise.all([
				seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
				knopf.evaluate((b) => b.form.requestSubmit(b))
			]);
			const art = await ergebnisart(antwort);
			behaupte(art === 'success', `Die Absendung endete als «${art}»`);

			// Auf den Zustand warten, nicht auf eine Frist: Die Quittung erscheint,
			// sobald `Meldung` sie an den Einblender weitergegeben hat.
			await seite.waitForFunction(() => document.querySelector('.quittung') !== null, null, {
				timeout: 20000
			});
			const nachher = await seite.evaluate(() => ({
				y: Math.round(window.scrollY),
				dasselbe: window.__dasselbeDokument === true
			}));
			behaupte(nachher.dasselbe, 'Die Seite wurde neu geladen');
			behaupte(
				Math.abs(nachher.y - vorher) <= 4,
				`Die Seite sprang von ${vorher} px auf ${nachher.y} px`
			);
			return `${vorher} px, danach ${nachher.y} px, Quittung unten rechts`;
		} finally {
			await seite.setViewportSize(FENSTER);
		}
	});

	await schritt('Eine Absage holt sich selbst ins Bild', async () => {
		await seite.setViewportSize({ width: 1280, height: 480 });
		try {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			/*
			 * Eine fremde Kennung in ein verborgenes Feld: `pruefeEinheitenGehoeren`
			 * weist die **ganze** Tabelle ab und schreibt nichts — die Absage ist
			 * damit folgenlos und der Bestand hinterher unverändert.
			 */
			const knopf = seite.locator('button[data-fokus="speichern"]');
			await knopf.scrollIntoViewIfNeeded();
			await seite.waitForTimeout(150);
			/*
			 * **Gesetzt und abgeschickt im selben Zug.** Beim ersten Anlauf stand
			 * das Setzen davor, und die Antwort war 200: Die Kennung steht als
			 * rohes `value={e.id}` im Feld, und Svelte schreibt sie beim Aufbau im
			 * Browser zurück. Wer davor eingreift, greift ins Leere.
			 */
			const [antwort] = await Promise.all([
				seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
				knopf.evaluate((b) => {
					b.form.querySelector('input[name="einheitId"]').value =
						'11111111-1111-4111-8111-111111111111';
					b.form.requestSubmit(b);
				})
			]);
			const art = await ergebnisart(antwort);
			behaupte(art === 'failure', `Die Absendung endete als «${art}» statt als Absage`);

			const absage = seite.locator('.meldung.fehler');
			await absage.waitFor({ state: 'visible', timeout: 20000 });
			/*
			 * **Ganz im Bild, und unter der Kopfleiste.** Zwei Anläufe waren hier
			 * schon grün, obwohl die Meldung nicht zu lesen war: einmal bei −39 px
			 * (halb über dem Rand, weil «zum Teil sichtbar» genügte), und die
			 * Formel `r.top >= 0` liesse eine Meldung durchgehen, die vollständig
			 * hinter der klebenden Kopfleiste steht. Gemessen wird deshalb gegen
			 * deren Unterkante, nicht gegen null.
			 */
			await seite.waitForTimeout(200);
			const lage = await absage.evaluate((e) => {
				const leiste = document.querySelector('header');
				const kante = leiste ? leiste.getBoundingClientRect().bottom : 0;
				const r = e.getBoundingClientRect();
				return {
					oben: Math.round(r.top),
					unten: Math.round(r.bottom),
					kante: Math.round(kante),
					hoehe: window.innerHeight,
					ganz: r.top >= kante && r.bottom <= window.innerHeight
				};
			});
			behaupte(
				lage.ganz,
				`Die Absage steht bei ${lage.oben}..${lage.unten} px, Kopfleiste bis ${lage.kante} px, Bild ${lage.hoehe} px`
			);
			// `.text` und nicht der ganze Absatz: Der trägt den Schliessknopf «×» mit.
			const satz = (await absage.locator('.text').innerText()).replace(/\s+/g, ' ').trim();
			return `«${satz.slice(0, 48)}» bei ${lage.oben} px, Leiste bis ${lage.kante} px`;
		} finally {
			await seite.setViewportSize(FENSTER);
		}
	});

	await schritt('Enter in einem Tabellenfeld speichert, statt zu entfernen', async () => {
		/*
		 * **Der Vorgabeknopf eines Formulars ist sein erster `type="submit"` in
		 * Baumreihenfolge.** Das war bis zum 27.08.2026 der Entfernen-Knopf der
		 * ersten Zeile: Enter in irgendeinem Bezeichnungsfeld löste das Entfernen
		 * aus, unter Umgehung der Pflichtfeldprüfung. Seit die Zeilenknöpfe über
		 * `form=` einem eigenen, leeren Formular gehören, ist «Tabelle speichern»
		 * wieder der Vorgabeknopf.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		const feld = seite.locator('table tbody tr input[name^="label."]').first();
		await feld.click();
		const [antwort] = await Promise.all([
			seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
			feld.press('Enter')
		]);
		const wohin = new URL(antwort.url()).search;
		behaupte(wohin.includes('speichern'), `Enter ging an «${wohin}»`);

		/*
		 * **Der Ausgang steht in der Antwort, nicht im Baum.** Ein erster Anlauf
		 * riet ihn über drei CSS-Klassen aus drei Bausteinen und wartete dabei bis
		 * zu zwanzig Sekunden. `ergebnisart()` weiss es sofort — und ohne diese
		 * Zeile liefe der Schritt bei einer Absage in eine Zeitüberschreitung, die
		 * wie ein hängender Selektor aussieht statt wie das, was sie ist.
		 */
		const art = await ergebnisart(antwort);
		behaupte(
			art === 'success',
			`Enter ging an «${wohin}», die Absendung endete aber als «${art}»`
		);

		/*
		 * **Und geprüft wird der Nutzinhalt, nicht die Hülle.** Die Adresse sagt
		 * nur, wohin der Klick ging; ein abgewiesenes Speichern trüge dieselbe.
		 * Die Quittung nennt die Zahl der geprüften Einheiten, und die muss zur
		 * Tabelle passen.
		 *
		 * `.quittung .text` und nicht `.quittung`: Der Absatz trägt den
		 * Schliessknopf «×» mit, wovor `Meldung.svelte` an der Übergabestelle
		 * ausdrücklich warnt.
		 */
		await seite.waitForFunction(() => document.querySelector('.quittung .text') !== null, null, {
			timeout: 20000
		});
		const quittung = (await seite.locator('.quittung .text').first().innerText())
			.replace(/\s+/g, ' ')
			.trim();
		const treffer = /^(\d+) Einheit(en)? geprüft und gespeichert\.$/.exec(quittung);
		behaupte(treffer !== null, `Die Quittung lautet «${quittung}»`);
		const zeilen = await seite.locator('table tbody tr input[name^="label."]').count();
		behaupte(
			Number(treffer[1]) === zeilen,
			`Die Quittung nennt ${treffer[1]} Einheiten, die Tabelle hat ${zeilen} Zeilen`
		);
		behaupte(
			(await seite.locator('dialog.rueckfrage').count()) === 0,
			'Enter öffnete das Entfernen-Fenster'
		);
		return `Enter → ${wohin}, «${quittung}»`;
	});

	// ── 4. Die Anleitung an der gemeinsamen Traktandenliste ──────────────────

	await schritt('Ein Abend mit zwei Gemeinschaften', async () => {
		const eigeneHaeuser = [];
		for (const n of [1, 2]) {
			await gehe('/gemeinschaften/neu');
			await seite.fill('input[name="name"]', `Knopfhaus ${n} Prüflauf ${LAUF}`);
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
			eigeneHaeuser.push(id);
		}
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Prüflauf Knöpfe ${LAUF}`);
		await seite.fill(
			'input[name="datum"]',
			new Date(Date.UTC(2033, 5, 1) + (Date.now() % 500) * 86400000).toISOString().slice(0, 10)
		);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Saal Prüflauf ${LAUF}`);
		/*
		 * **Eigene Häuser statt geliehener.** `k.nth(i)` nahm, was gerade
		 * dastand; ist eines davon eine übergeordnete Gemeinschaft, steht sein
		 * Kästchen gesperrt da (`disabled={g.klammer}`, sie hat keine Einheiten)
		 * und `check()` läuft ins Leere. Steht gar nichts da, gibt es nichts
		 * anzukreuzen. Beides geschah am 27.08.2026.
		 */
		for (const id of eigeneHaeuser) {
			const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
			behaupte(await kaestchen.count(), `Eigenes Haus ${id} steht nicht zur Wahl`);
			behaupte(await kaestchen.isEnabled(), `Eigenes Haus ${id} ist gesperrt — gilt es als übergeordnete Gemeinschaft?`);
			await kaestchen.check();
		}
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Nicht angelegt: ${seite.url()}`);
		return seite.url().split('/tage/')[1].split(/[/?#]/)[0].slice(0, 8);
	});

	await schritt('Die Knöpfe nennen ihren Gegenstand und erklären sich', async () => {
		const tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];
		await gehe(`/tage/${tag}/geschaefte`);
		await seite.locator('ol.liste button.aendern').first().click();
		await seite.waitForTimeout(300);

		const knoepfe = await seite
			.locator('li.bearbeiten .knoepfe button')
			.evaluateAll((b) => b.map((x) => x.textContent.trim()));
		behaupte(
			!knoepfe.includes('Erfordernis setzen'),
			'Der Knopf heisst weiterhin «Erfordernis setzen»'
		);
		behaupte(knoepfe.includes('Mehrheit speichern'), `Knöpfe: ${knoepfe.join(' · ')}`);
		behaupte(knoepfe.includes('Text speichern'), `Knöpfe: ${knoepfe.join(' · ')}`);

		const anleitung = seite.locator('li.bearbeiten details.anleitung');
		behaupte((await anleitung.count()) === 1, 'Keine Anleitung');
		await anleitung.locator('summary').click();
		await seite.waitForTimeout(200);
		const text = (await anleitung.innerText()).replace(/\s+/g, ' ');
		behaupte(
			text.includes('Mehrheitserfordernis'),
			'Die Anleitung nennt den Fachbegriff nicht'
		);
		behaupte(text.includes('welche Mehrheit'), 'Die Anleitung erklärt die Sache nicht');
		await seite.screenshot({ path: `${AUFNAHMEN}/anleitung.png` });
		return knoepfe.join(' · ');
	});

	// ── 5. Nichts läuft am Telefon quer ──────────────────────────────────────

	/*
	 * **Der 500er.** Eine Gemeinschaft mit Einheiten auf «nur eine Klammer»
	 * gestellt: Die Datenbank löscht die Stammquotenart, der Fremdschlüssel hält
	 * dagegen, und bis zum 12.08.2026 kam «500 Internal Error» an. Eine Schranke
	 * der Datenbank ist keine Fehlermeldung (docs/gestaltung.md).
	 */
	await schritt('Wer eine Gemeinschaft mit Einheiten umstellt, bekommt einen Grund', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/angaben`);
		await seite.locator('input[name="art"][value="klammer"]').check();
		const [antwort] = await Promise.all([
			seite.waitForResponse((r) => r.request().method() === 'POST'),
			seite.locator('main button[type="submit"]').first().click()
		]);
		behaupte(antwort.status() === 400, `HTTP ${antwort.status()} statt einer fachlichen Abweisung`);
		await seite.waitForTimeout(200);
		const meldungen = await seite.locator('.fehler').allInnerTexts();
		behaupte(meldungen.length === 1, `${meldungen.length} Fehlermeldungen statt einer`);
		const m = meldungen[0].replace(/\s+/g, ' ');
		behaupte(/Einheit/.test(m), `Die Meldung nennt die Einheiten nicht: ${m}`);
		behaupte(/Verschieben|entfernen/.test(m), `Die Meldung nennt keinen Ausweg: ${m}`);
		return m.slice(0, 90);
	});

	/*
	 * Die Gegenprobe: Ein Haus, das unter einer übergeordneten steht, auf
	 * «übergeordnet» gestellt. Die Zuordnung wird gelöst — aber angesagt, nicht
	 * stillschweigend. Ein Formular, das eine bestehende Verbindung ohne Wort
	 * kappt, ist schlimmer als eines, das die Wahl verweigert.
	 */
	await schritt('Wer ein zugeordnetes Haus umstellt, wird auf die Folge hingewiesen', async () => {
		await gehe(`/gemeinschaften/${untergeordnet}/angaben`);
		behaupte(
			(await seite.locator('select[name="parentStwegId"]').count()) === 1,
			'Das Haus zeigt seine Zuordnung nicht'
		);
		await seite.locator('input[name="art"][value="klammer"]').check();
		const hinweise = await seite.locator('.hinweis').allInnerTexts();
		const passend = hinweise.find((h) => /Zuordnung/.test(h));
		behaupte(passend, `Kein Hinweis auf die gelöste Zuordnung: ${hinweise.join(' | ')}`);
		behaupte(
			(await seite.locator('select[name="parentStwegId"]').count()) === 0,
			'Die Frage steht trotz «übergeordnet» noch da'
		);
		return passend.replace(/\s+/g, ' ').slice(0, 80);
	});

	await schritt('Beide Listen der Personenseite sind gekürzt und suchen ganz', async () => {
		/*
		 * **Die zweite Liste stand ungekürzt da** (03.09.2026). Die obere Tabelle
		 * kürzt seit dem Prüfdurchgang II auf `LISTENGRENZE`, die untere
		 * («Noch nicht mit einer Person verknuepft») nicht: gemessen 210 Zeilen
		 * und eine Seite von 9687 px. Beide laufen jetzt durch `begrenzt()`.
		 *
		 * Geprüft wird die Zusicherung, an der es hängt: Gekürzt wird NACH dem
		 * Filtern. Der Prüfling ist deshalb der letzte Eintrag der
		 * aufgeschlagenen Liste — er liegt sicher ausserhalb der gezeigten Zeilen.
		 */
		await gehe('/personen');
		/*
		 * **Kein stummer Ausweg** (aus dem Code-Review). Fällt der Abschnitt ganz
		 * weg — Rückbau, falscher Filter, leere Abfrage —, wäre ein «gibt es
		 * nicht, also grün» genau der Fall, den dieser Schritt eigentlich fangen
		 * soll. Der Bestand hat unverknuepfte Zeilen, das Drehbuch legt selbst
		 * welche an; fehlt der Abschnitt, ist das ein Befund.
		 */
		const unten = seite.locator('section.unverknuepft');
		behaupte(
			await unten.count(),
			'Der Abschnitt «Noch nicht mit einer Person verknüpft» fehlt ganz'
		);

		const zeilen = () => unten.locator('tbody tr').count();

		/*
		 * **Der Zähler sagt, ob der Schritt scharf sein MUSS** (03.09.2026, aus
		 * der Defektprobe). Ohne ihn kehrte der Schritt bei fehlendem Knopf mit
		 * «nicht messbar» zurück — und genau das tat er auch, als der Rückbau
		 * («erst kürzen, dann filtern») die Liste auf fünfundzwanzig Einträge
		 * zusammenschnitt und den Knopf verschwinden liess. Ein Defekt, der die
		 * Probe stumm schaltet, ist der schlimmste Fall.
		 */
		const [gezeigt, gesamt] = (await unten.locator('.zaehler').innerText())
			.split(' von ')
			.map((t) => Number(t.replace(/\D+/g, '')));
		const knopf = unten.locator('p.mehr button.flach');
		behaupte(
			gezeigt === (await zeilen()),
			`Der Zähler sagt ${gezeigt} Zeilen, die Tabelle hat ${await zeilen()}`
		);
		if (gesamt <= gezeigt) {
			behaupte(
				(await knopf.count()) === 0,
				`Der Knopf «alle anzeigen» steht da, obwohl alle ${gesamt} Zeilen sichtbar sind`
			);
			return `nur ${gesamt} Zeilen — die Kürzung ist hier nicht messbar`;
		}
		behaupte(
			(await knopf.count()) === 1,
			`Bei ${gesamt} Zeilen und ${gezeigt} gezeigten fehlt der Knopf «alle anzeigen»`
		);

		const gekuerzt = await zeilen();
		await knopf.click();
		await unten.locator('tbody tr').nth(gekuerzt).waitFor({ timeout: 10_000 });
		const alle = await zeilen();
		behaupte(alle > gekuerzt, `Der Knopf zeigte nicht mehr Zeilen: ${gekuerzt} → ${alle}`);

		const letzter = (
			await unten.locator('tbody tr').last().locator('td').first().innerText()
		).trim();

		await gehe('/personen');
		behaupte(
			(await zeilen()) === gekuerzt,
			'Nach dem Neuladen steht die zweite Liste nicht wieder gekürzt da'
		);
		/*
		 * **Auf die Namensspalte eingegrenzt, nicht über die ganze Zeile** (aus
		 * dem Code-Review): `hasText` trifft Teilzeichenketten in jeder Zelle,
		 * also auch eine Gemeinschaft oder eine E-Mail, in der der Name vorkommt.
		 * Der Schritt wäre dann rot, ohne dass etwas fehlt.
		 */
		const mitNamen = () =>
			unten
				.locator('tbody tr')
				.filter({ has: seite.locator(`td:first-child:text-is("${letzter}")`) })
				.count();
		behaupte(
			(await mitNamen()) === 0,
			`«${letzter}» ist auch gekürzt noch sichtbar — die Probe misst nichts`
		);

		await seite.locator('input[type="search"]').first().fill(letzter);
		await seite.waitForTimeout(400);
		behaupte(
			(await mitNamen()) > 0,
			`Die Suche findet «${letzter}» nicht — sie filtert offenbar nur die gezeigten Zeilen`
		);
		return `${alle} Einträge, ${gekuerzt} gezeigt, «${letzter}» ausserhalb und trotzdem gefunden`;
	});

	/*
	 * **Die Personenliste des gemeinschaftlichen Eigentums** (04.09.2026, Task 8
	 * des Hüllen-Plans). Sie steht seit dem Umbau als ein Baustein da
	 * (`Personenzeile.svelte`), den zwei Seiten verwenden. Bis dahin gab es sie
	 * zweimal, und geprüft hat sie kein Drehbuch.
	 *
	 * Die beiden Schritte messen die zwei Zusicherungen, an denen die Zuordnung
	 * hängt und die beim Umbau am leichtesten still brechen.
	 */
	await schritt('Die Personenliste schickt gleich lange Reihen, auch gemischt', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		await seite.locator('input[name="eigentumsform"][value="gemeinschaftlich"]').check();
		await seite.waitForTimeout(300);

		/*
		 * Der Server verbindet Name, E-Mail, Telefon, Anschrift, Wahl, Person und
		 * Kennung über die **Stellung** in der Reihe. Was eine Zeile gerade nicht
		 * zeigt, muss sie als leeres verborgenes Feld schicken. Sonst verschiebt
		 * sich alles um eins, sobald eine Zeile den Zweig wechselt, und die zweite
		 * Person bekommt die Anschrift der ersten.
		 *
		 * Gemischt geprüft, weil genau das der Fall ist, den ein gleichmässiges
		 * Formular nicht aufdeckt: erste Zeile «bestehend», zweite «neu».
		 */
		await seite.locator('select[name="mitberechtigterWahl"]').first().selectOption('bestehend');
		await seite.waitForTimeout(300);

		const REIHEN = [
			'mitberechtigterKennung',
			'mitberechtigterName',
			'mitberechtigterEmail',
			'mitberechtigterTelefon',
			'mitberechtigterAdresse',
			'mitberechtigterWahl',
			'mitberechtigterPersonId'
		];
		/*
		 * **Erst nachweisen, dass gemischt auch gemischt ist.** Bliebe die
		 * Umstellung wirkungslos, stünden beide Zeilen auf «neu», alle Reihen wären
		 * gleich lang, und der Schritt meldete den gemischten Zustand, obwohl er
		 * den gleichförmigen gemessen hat. Kennzeichen des Zweigs «bestehend» ist
		 * das Namensfeld als verborgenes Füllloch statt als Eingabefeld.
		 */
		const kasten = seite.locator('.person');
		const zustand = await kasten.evaluateAll((ps) =>
			ps.map((p) => {
				const n = p.querySelector('[name="mitberechtigterName"]');
				return n && n.type === 'hidden' ? 'bestehend' : 'neu';
			})
		);
		behaupte(
			zustand.length === 2 && zustand[0] === 'bestehend' && zustand[1] === 'neu',
			`Die Zeilen stehen auf ${JSON.stringify(zustand)} statt auf ["bestehend","neu"]`
		);

		const laengen = {};
		for (const feld of REIHEN) laengen[feld] = await seite.locator(`[name="${feld}"]`).count();
		const zeilen = laengen.mitberechtigterKennung;
		behaupte(zeilen === 2, `${zeilen} Zeilen statt der zwei, mit denen die Maske aufmacht`);
		const abweichend = REIHEN.filter((f) => laengen[f] !== zeilen);
		behaupte(
			abweichend.length === 0,
			`Ungleich lange Reihen: ${abweichend.map((f) => `${f}=${laengen[f]}`).join(', ')}`
		);
		return `${REIHEN.length} Reihen, je ${zeilen} lang, im gemischten Zustand`;
	});

	await schritt('Nach einer Absage steht der Vertreter noch bei derselben Person', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		await seite.locator('input[name="eigentumsform"][value="gemeinschaftlich"]').check();
		await seite.waitForTimeout(300);

		/*
		 * **Warum drei Personen und warum die mittlere weg.** Der Server gibt den
		 * gewählten Vertreter als **Stellung** zurück (`vertreterIndex`), die Maske
		 * setzt daraus wieder ihre Kennungen. Beide müssen dieselbe Regel benutzen.
		 * Bei drei Zeilen, aus denen die mittlere entfernt wurde, laufen Kennung
		 * und Stellung auseinander, und ein Fehler dort zeigt sich: Der
		 * Auswahlknopf stünde nach der Absage bei der falschen Person oder bei
		 * niemandem.
		 */
		await seite.locator('button', { hasText: 'Weitere Person' }).first().click();
		await seite.waitForTimeout(200);
		const namen = seite.locator('input[name="mitberechtigterName"]');
		behaupte((await namen.count()) === 3, `${await namen.count()} Namensfelder statt drei`);
		await namen.nth(0).fill(`Erste ${LAUF}`);
		await namen.nth(1).fill(`Zweite ${LAUF}`);
		await namen.nth(2).fill(`Dritte ${LAUF}`);

		await seite.locator('.person').nth(2).locator('input[name="vertreter"]').check();
		await seite.locator('.person').nth(1).locator('button', { hasText: 'Wegnehmen' }).click();
		await seite.waitForTimeout(300);

		const uebrig = await namen.evaluateAll((e) => e.map((x) => x.value));
		behaupte(
			uebrig.length === 2 && uebrig[1].startsWith('Dritte'),
			`Nach dem Wegnehmen stehen dort ${JSON.stringify(uebrig)}`
		);

		// Die Absage über einen zu kurzen Namen, nicht über ein leeres Feld: Ein
		// leeres Pflichtfeld hielte der Browser auf, und die Aktion liefe nie.
		await namen.nth(0).fill('x');
		const formular = seite.locator('form:has(input[name="mitberechtigterName"])').first();
		const antwort = await abschicken(formular.locator('button[type="submit"]').last());

		/*
		 * **Belegen, dass die Absage stattgefunden hat.** Ohne diese Prüfung ginge
		 * der Schritt auch dann durch, wenn gar nichts abgeschickt wurde: Bei einem
		 * neuen Pflichtfeld oder einem anderen letzten Knopf läuft `abschicken` in
		 * den Zeitablauf, die Seite bleibt unverändert stehen, und die getippten
		 * Angaben stehen noch da, weil sie nie weg waren. Gemessen wäre dann der
		 * Rückweg über `vertreterIndex` überhaupt nicht.
		 */
		behaupte(antwort !== null, 'Es wurde nichts abgeschickt — die Absage blieb aus');
		const gemeldet = await meldung();
		behaupte(
			gemeldet.includes('Name fehlt oder ist zu kurz'),
			`Statt der erwarteten Absage meldet die Seite: ${gemeldet.slice(0, 90) || '(nichts)'}`
		);

		const zurueck = await seite
			.locator('input[name="mitberechtigterName"]')
			.evaluateAll((e) => e.map((x) => x.value));
		behaupte(
			zurueck.length === 2 && zurueck[1].startsWith('Dritte'),
			`Die getippten Angaben kamen nicht zurück: ${JSON.stringify(zurueck)}`
		);

		const beiWem = await seite.locator('.person').evaluateAll((ps) =>
			ps
				.map((p, i) => {
					const r = p.querySelector('input[name="vertreter"]');
					return r && r.checked ? i : null;
				})
				.filter((x) => x !== null)
		);
		behaupte(
			beiWem.length === 1,
			beiWem.length === 0
				? 'Nach der Absage ist niemand mehr als Vertretung angekreuzt'
				: `${beiWem.length} Vertretungen zugleich angekreuzt`
		);
		behaupte(
			beiWem[0] === 1,
			`Die Vertretung steht im ${beiWem[0] + 1}. Kasten statt beim zweiten, also nicht mehr bei «Dritte»`
		);
		return `zwei Zeilen zurück, Vertretung noch bei «Dritte ${LAUF}»`;
	});

	/*
	 * **Wer zu einer Gemeinschaft gehört, wird nicht versehentlich einzeln
	 * zugeordnet** (Bedienbarkeitsprüfung 05.09.2026, Befund 16 der
	 * Bewirtschaftersicht; Produktentscheid 06.09.2026: kennzeichnen und
	 * rückfragen, nicht sperren).
	 *
	 * Bei einem Ehepaar bietet die Zuordnungsauswahl drei Einträge an: die
	 * Gemeinschaft und die beiden einzeln. Alle drei sind zulässig — jemand
	 * kann daneben eine eigene Einheit besitzen —, aber sie sahen gleich aus.
	 * Wer die einzelne Person wählte, zerlegte die gemeinsame Stimme, ohne dass
	 * ein Wort dazu fiel.
	 *
	 * Geprüft wird beides: der Zusatz in der Liste und die Rückfrage vor dem
	 * Schreiben. Der Zusatz allein genügt nicht — wer die Liste überfliegt,
	 * liest ihn nicht.
	 */
	await schritt('Ein Mitglied einer Gemeinschaft wird nicht stumm einzeln zugeordnet', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		/*
		 * **Der Name der Gemeinschaft entsteht aus ihren Mitgliedern** — gemessen
		 * am 06.09.2026: Das Feld «Name» verschwindet beim Umschalten auf
		 * gemeinschaftlich, und in der Datenbank steht danach «Eine … und
		 * Andere …». Ein eigener Name lässt sich hier also nicht setzen, und der
		 * Schritt darf keinen erwarten.
		 */
		const anlegen = seite.locator('form[action="?/anlegen"]');
		await anlegen.locator('input[name="eigentumsform"][value="gemeinschaftlich"]').check();
		await seite.waitForTimeout(200);
		const namen = anlegen.locator('input[name="mitberechtigterName"]');
		await namen.nth(0).fill(`Eine Prüflauf ${LAUF}`);
		await namen.nth(1).fill(`Andere Prüflauf ${LAUF}`);
		await anlegen.locator('input[name="vertreter"]').first().check();
		await abschicken(anlegen.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const huellenname = `Eine Prüflauf ${LAUF} und Andere Prüflauf ${LAUF}`;
		const auswahl = seite.locator('form[action="?/zuordnen"] select[name="partyId"]');
		const eintraege = await auswahl.locator('option').allInnerTexts();
		// Nach dem Anfang suchen, nicht irgendwo im Text: Der Zusatz «gehört zu
		// …» nennt die Gemeinschaft, und die trägt die Namen beider Mitglieder.
		// Ein `includes` fände damit die Zeile der jeweils anderen Person.
		// Nicht `startsWith`: Der Sammelname der Gemeinschaft beginnt selbst mit
		// dem ersten Mitgliedsnamen. Gemeint ist die Zeile, die den Zusatz trägt
		// und **nicht** die Gemeinschaft ist.
		const mitglied = eintraege.find(
			(e) => e.startsWith(`Eine Prüflauf ${LAUF} (`) && e.includes('gehört zu')
		);
		behaupte(
			mitglied !== undefined,
			`Das Mitglied steht nicht in der Auswahl: ${eintraege.join(' | ')}`
		);
		behaupte(
			mitglied.includes(`(gehört zu ${huellenname})`),
			`Der Eintrag nennt die Gemeinschaft nicht: «${mitglied}»`
		);
		// Gegenprobe: Die Gemeinschaft selbst trägt den Zusatz nicht, sonst
		// stünde er überall und sagte nichts mehr.
		const huelle = eintraege.find((e) => e.startsWith(huellenname));
		behaupte(
			huelle !== undefined && !huelle.includes('gehört zu'),
			`Die Gemeinschaft selbst trägt den Zusatz: «${huelle}»`
		);

		const einheit = seite.locator('form[action="?/zuordnen"] select[name="unitId"]');
		const ersteEinheit = await einheit.locator('option').nth(1).getAttribute('value');
		const einheitLabel = (await einheit.locator('option').nth(1).innerText()).split(' ·')[0].trim();
		await einheit.selectOption(ersteEinheit);
		await auswahl.selectOption({ label: mitglied });
		await abschicken(seite.locator('form[action="?/zuordnen"] button[type="submit"]'));

		const fenster = seite.locator('dialog.serverfrage');
		await fenster.waitFor({ state: 'visible', timeout: 10000 });
		const frage = (await fenster.innerText()).replace(/\s+/g, ' ').trim();
		behaupte(
			frage.includes(huellenname),
			`Die Rückfrage nennt die Gemeinschaft nicht: ${frage}`
		);
		behaupte(
			/einzelnen Person/.test(frage),
			`Die Rückfrage sagt nicht, was sie bewirkt: ${frage}`
		);
		// Derselbe Weg zurück wie in Schritt «Ein Eigentumswechsel fragt vor dem
		// Schreiben zurück»: Das Fenster trägt den Ausweg als Verweis, nicht als Knopf.
		await fenster.locator('a.ab').click();

		/*
		 * **Der Abbruch muss auch nichts geschrieben haben** (Code-Review
		 * 06.09.2026). Ein Fenster, das erscheint und dessen «Abbrechen» trotzdem
		 * schreibt, wäre schlimmer als gar keine Rückfrage: Man hätte sie gesehen
		 * und sich auf sie verlassen.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		const danach = await seite.locator('main').innerText();
		behaupte(
			!danach.includes(`Eine Prüflauf ${LAUF}`) ||
				!new RegExp(`Eine Prüflauf ${LAUF}[^\n]*${einheitLabel}`).test(danach),
			`Nach dem Abbruch hält das Mitglied die Einheit «${einheitLabel}»`
		);
		/*
		 * **Beide Fragen nacheinander, bis die Zuordnung steht**
		 * (Sicherheitsdurchgang 06.09.2026, funktionaler Befund).
		 *
		 * Die Aktion fragt aus zwei Gründen zurück: ob die Zuordnung an ein
		 * Mitglied gemeint war, und was sie verdrängt. Weil das Fenster zuerst
		 * nur die Antwort auf die gerade gestellte Frage schickte, löschte die
		 * zweite Zusage die erste — die Zuordnung liess sich über die
		 * Oberfläche **nie** abschliessen. Der Abbruchtest oben fand das nicht:
		 * Er hört nach der ersten Frage auf.
		 *
		 * Der Aufbau erzwingt beide Fragen: Erst hält die Gemeinschaft die
		 * Einheit, dann soll sie an eines ihrer Mitglieder gehen.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		await einheit.selectOption(ersteEinheit);
		await auswahl.selectOption({ label: huelle });
		await abschicken(seite.locator('form[action="?/zuordnen"] button[type="submit"]'));
		// Die Gemeinschaft selbst löst keine Gemeinschaftsfrage aus; steht eine
		// Verdrängungsfrage an, wird sie hier bestätigt.
		const evtl = seite.locator('dialog.serverfrage');
		if (await evtl.isVisible()) await evtl.locator('button.ja').click();

		await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
		await einheit.selectOption(ersteEinheit);
		await auswahl.selectOption({ label: mitglied });
		await abschicken(seite.locator('form[action="?/zuordnen"] button[type="submit"]'));

		let runden = 0;
		while (await seite.locator('dialog.serverfrage').isVisible()) {
			runden += 1;
			behaupte(
				runden <= 3,
				'Die Rückfragen wiederholen sich — die Zuordnung lässt sich nicht abschliessen'
			);
			await seite.locator('dialog.serverfrage button.ja').click();
			await seite.waitForTimeout(600);
		}
		const fertig = await seite.locator('main').innerText();
		behaupte(
			new RegExp(`Eine Prüflauf ${LAUF}[^\n]*${einheitLabel}`).test(fertig) ||
				fertig.includes(einheitLabel),
			`Nach beiden Bestätigungen steht die Zuordnung nicht: ${fertig.slice(0, 300)}`
		);
		return `Rückfragen: ${runden} Runden bis zur Zuordnung`;
	});

	await schritt('Kein Querlauf am Telefon', async () => {
		const eng = await browser.newPage({ viewport: { width: 390, height: 844 } });
		warteNachNavigation(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'load' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		// Die Weiterleitung nach der Anmeldung abwarten: Ein `goto` mitten hinein
		// bricht mit ERR_ABORTED ab, weil zwei Navigationen einander überholen.
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.waitForTimeout(400);

		const gemessen = [];
		for (const pfad of [
			`/gemeinschaften/${gemeinschaft}/einheiten`,
			`/gemeinschaften/${gemeinschaft}/eigentuemer`
		]) {
			await eng.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
			await eng.waitForTimeout(400);
			// Die Aufklapper mit — zugeklappt sieht man einen Querlauf nicht.
			await eng
				.locator('.verteiler button.flach')
				.click()
				.catch(() => {});
			await eng.waitForTimeout(200);
			const ueber = await eng.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			gemessen.push(`${pfad.split('/').pop()}: ${ueber} px`);
			behaupte(ueber === 0, `${pfad} läuft ${ueber} px quer`);
		}
		await eng.close();
		return gemessen.join(' · ');
	});

	/*
	 * **Ganz am Schluss**, weil dieser Schritt die Anmeldung wegnimmt.
	 *
	 * Ohne `use:enhance` schickte der Wächter eine 303 auf `/anmelden`, und der
	 * Browser folgte ihr. Mit `use:enhance` folgt `fetch` ihr selbst, bekommt die
	 * Anmeldeseite als HTML zurück und scheitert am `JSON.parse` — die Seite
	 * meldete dann «Der Server hat nicht wie erwartet geantwortet», und wer das
	 * las, schickte beliebig oft nach, ohne je zur Anmeldung zu kommen. Seit dem
	 * 27.08.2026 antwortet der Wächter einer abgefangenen Absendung mit der
	 * Umleitung im Rumpf (`src/lib/server/absageantwort.ts`).
	 */
	await schritt('Abgelaufene Anmeldung führt zur Anmeldung, nicht in eine Schleife', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
		await seite.context().clearCookies();
		const knopf = seite.locator('button[data-fokus="speichern"]');
		const [antwort] = await Promise.all([
			seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
			knopf.evaluate((b) => b.form.requestSubmit(b))
		]);
		const art = await ergebnisart(antwort);
		behaupte(art === 'redirect', `Die Absendung endete als «${art}» statt als Umleitung`);
		await seite.waitForURL((u) => new URL(u).pathname === '/anmelden', { timeout: 15000 });
		const weiter = new URL(seite.url()).searchParams.get('weiter');
		behaupte(
			weiter !== null && weiter.endsWith('/einheiten'),
			`Der Zielmerker führt nicht zurück: ${seite.url()}`
		);
		return `→ /anmelden?weiter=${weiter}`;
	});
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
