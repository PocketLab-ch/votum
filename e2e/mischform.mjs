/**
 * Die Mischform am gemeinsamen Abend: fragt der Eingang je Haus richtig?
 *
 * **Warum ein eigener Durchstich** (10.09.2026). Die Frage «digital oder von
 * Hand» steht seit dem 09.09.2026 im einzelnen Haus (`durchspielen.mjs`,
 * Schritte 54a/54b). Am gemeinsamen Abend fehlte sie: Die Handlungen riefen den
 * Vermerkhelfer, aber keine Maske schickte eine Antwort. Beim Anschluss zeigte
 * sich ausserdem, dass der Abend den Vermerk gar nicht zurücknehmen konnte —
 * ein Fehlgriff am Eingang wäre dort unwiderruflich gewesen.
 *
 * Kein bestehendes Drehbuch kann das messen:
 *
 * | Drehbuch | warum nicht |
 * |---|---|
 * | `durchspielen.mjs` | ein einzelnes Haus, kein Abend |
 * | das interne Drehbuch über den Verbund | der Abend läuft dort mit Absicht in `einfach`, und in `einfach` stellt sich die Frage gar nicht |
 * | `zuordnung.mjs` | baut Abende, eröffnet aber keinen und hat keinen Eingang |
 *
 * Also der kleinste Abend, an dem sich der Unterschied zeigt: zwei Häuser,
 * beide `gefuehrt` (die Betriebsart kommt hart vom Abend), und in Haus B ist
 * die Frage **abgeschaltet**. Damit liegt der Unterschied dort, wo er im
 * Betrieb liegt: am Schalter je Versammlung, nicht am Abend.
 *
 * ## Was gemessen wird
 *
 *   1. Haus A fragt am Eingang, Haus B nicht — in derselben Liste, im selben
 *      Kasten, nebeneinander.
 *   2. «Stimmt von Hand» setzt den Vermerk, und der Rückweg steht sofort da.
 *   3. «Zurück» nimmt ihn weg — am Abend, wo es diese Handlung bis heute
 *      nicht gab.
 *   4. Der Kartenscanner erfasst sofort und bietet den Vermerk **danach** an.
 *      Vorher ginge es nicht: Die Kamera schickt selbst ab, und welches Haus
 *      die Karte betrifft, steht erst nach dem Auflösen des Codes fest.
 *   5. Der Rückweg steht danach auch an der Zeile der Liste, nicht nur im
 *      Kasten — der Kasten verspricht das, und am Abend fehlte es.
 *   6. Ein zweiter Scan derselben Karte bietet nichts mehr an.
 *   7. Auch «Ohne Karte einlassen» fragt — ein Haken für alle Häuser dieser
 *      Person, weil erst nach ihrer Wahl feststeht, welche das sind.
 *   8. Auch «Von Hand erfassen» an der Zeile fragt — nach dem Eintritt, im
 *      selben Kasten wie beim Scanner.
 *   9. Das Protokoll des Abends nennt die Mischform je Haus, als ZAHL und ohne
 *      Namen: Es ist ein Dokument für alle beteiligten Gemeinschaften.
 *  10. Bei abgeschalteter Frage bietet der Eingang gar nichts an.
 *  11. Im Haus fragt auch die Zeile «Von Hand erfassen» — dort vor dem
 *      Eintritt, weil das Haus feststeht, und mit zwei Knöpfen statt einem
 *      Kasten danach. Sie war der letzte Eingang, der die Frage nicht stellte.
 *  12. Wer eintrat, während die Frage AUS war, steht danach in der
 *      Nachtragsliste — und verschwindet daraus, sobald er beantwortet ist.
 *      Am gemeinsamen Abend ist das der einzige Weg (Migration 109).
 *
 * Die Schranke am Schreibweg (`vermerkePapierabgabe` prüft `fragtNachPapier`)
 * steht in `tests/db/papierabgabe.test.ts`; hier geht es um die Verdrahtung,
 * die kein Datenbanktest sieht.
 *
 * Aufruf: `node e2e/mischform.mjs` (Umgebung wie `e2e/durchspielen.mjs`).
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';
import { umgebungsbefund } from './umgebung.mjs';


import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const ABLAGE = process.env.ABLAGE ?? '/tmp/e2e-mischform';

const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
/*
 * Je Lauf ein anderes Datum: Zwei Erstversammlungen derselben Gemeinschaft am
 * selben Tag weist der Kern zu Recht ab (Migration 028), und dieser Durchstich
 * läuft öfter als einmal.
 */
const DATUM = new Date(Date.UTC(2033, 0, 1) + (Date.now() % 900) * 86400000)
	.toISOString()
	.slice(0, 10);

let nummer = 0;
const fehler = [];

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

async function schritt(titel, arbeit) {
	nummer += 1;
	const marke = String(nummer).padStart(2, '0');
	try {
		const zusatz = await arbeit();
		console.log(`  ${marke} ✓ ${titel}${zusatz ? ` — ${zusatz}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${marke} ✗ ${titel} — ${e.message}`);
	}
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const seite = await kontext.newPage();
warteNachNavigation(seite);

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

/**
 * Abschicken und auf die Antwort warten, nicht auf eine Frist.
 *
 * Eine feste Wartezeit prüft bei jedem langsameren Aufruf die Seite von vorher
 * — grün, obwohl nichts geschah. Auf `networkidle` lässt sich nicht warten: Die
 * Saalsichten halten einen Ereignisstrom offen, das Netz wird nie ruhig.
 */
async function abschicken(knopf) {
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(150);
	// Rückfragen bestätigen, wo eine steht — sonst bleibt der Klick im Dialog.
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) await ja.first().click();
	await antwort;
	await seite.waitForLoadState('domcontentloaded');
	await seite.waitForTimeout(350);
}

async function warteAuf(ort, was, frist = 20000) {
	await ort
		.first()
		.waitFor({ state: 'visible', timeout: frist })
		.catch(() => {
			throw new Error(`${was} erschien nicht`);
		});
}

const sauber = (t) => t.replace(/\s+/g, ' ').trim();

/**
 * Der Text des Meldungsstreifens.
 *
 * **Nicht `main` lesen** (10.09.2026, am eigenen Drehbuch gefunden). Unter
 * `/tage/<id>` steht die Ablaufleiste im selben `main`, und sie ist lang: Ein
 * Ausschnitt der ersten zweihundert Zeichen enthält «Vorbereiten ✓ Angaben ✓ …»
 * und nie die Meldung. Der erste Anlauf meldete deshalb «die Rücknahme meldet
 * nichts», während sie gemeldet hatte.
 */
async function meldungstext() {
	const streifen = seite.locator('p.meldung');
	if (!(await streifen.count())) return '';
	return sauber((await streifen.allInnerTexts()).join(' · '));
}

/**
 * Eine Auswahl nach dem Anfang ihres Textes treffen.
 *
 * **Nicht `selectOption({ label })`**: Die Einträge tragen Zusätze («Whg 1 —
 * frei», «Aebi A1234 — Whg 1»), und ein Vergleich auf Gleichheit findet sie
 * nie. Der Fehler sieht dann aus wie ein Zeitüberschritt und nicht wie das, was
 * er ist.
 */
async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

/** Legt ein Haus mit zwei Einheiten und zwei Eigentümern an. */
async function legeHausAn(bezeichnung) {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', `${bezeichnung} Prüflauf ${LAUF}`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	/*
	 * **`id !== 'neu'` ist der eigentliche Prüfstein** (aus `zuordnung.mjs`
	 * übernommen). Bleibt das Formular stehen, ist die Adresse weiter
	 * `/gemeinschaften/neu` und die Kennung die Zeichenkette «neu» — wahr, und
	 * die Zusicherung schliefe durch.
	 */
	behaupte(id && id !== 'neu', `${bezeichnung} nicht angelegt, Adresse ${seite.url()}`);

	const namen = [];
	/*
	 * **Fünf und nicht zwei.** Zwei reichten für die Frage am Eingang, aber nicht
	 * für die Wege danach: Jeder von ihnen braucht eine Partei, die noch nicht
	 * anwesend ist, und jeder verbraucht sie. Es sind fünf: der Vermerk am
	 * Wartenden, der Kartenscanner, «Ohne Karte einlassen», «Von Hand erfassen»
	 * am Abend und «Von Hand erfassen» in der Liste des Hauses.
	 *
	 * Die fünfte kam am 10.09.2026 dazu, mit dem Schritt über die Zeile im Haus.
	 * Wer hier eine Partei streicht, nimmt dem letzten Schritt seinen Gegenstand
	 * — und der wird dann nicht rot, sondern findet nichts zu klicken.
	 */
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Dubs', 'Egli'].entries()) {
		const name = `${wer} ${bezeichnung.slice(-1)}${LAUF.slice(-4)}`;
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
		await ef.locator('input[name="quote.stamm"]').fill(['400', '300', '200', '60', '40'][i]);
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		await pf.locator('input[name="displayName"]').fill(name);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), name);
		await abschicken(zf.locator('button[type="submit"]'));
		namen.push(name);
	}
	return { id, namen };
}

try {
	console.log(`\nMischform am gemeinsamen Abend — ${ZIEL}\n`);

	let hausA;
	let hausB;
	let tag;
	const versammlung = {};

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		// Erst warten, dann behaupten: Die Anmeldung springt im Browser weiter,
		// nicht über eine Antwort des Servers.
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Zwei Häuser mit je fünf Parteien', async () => {
		hausA = await legeHausAn('Mischform A');
		hausB = await legeHausAn('Mischform B');
		return `${hausA.namen.join(', ')} · ${hausB.namen.join(', ')}`;
	});

	await schritt('Ein gemeinsamer Abend, Betriebsart «geführt» — vor den Häusern', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Mischform-Abend ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

		/*
		 * **Die Betriebsart gehört an den Abend, und zwar VOR die Zuordnung**
		 * (Migration 082; hier am 10.09.2026 nachgemessen). Sie je Versammlung zu
		 * wählen ist wirkungslos, weil die Zuordnung sie hart überschreibt. Und
		 * sie danach am Abend umzustellen erreicht die schon zugeordneten Häuser
		 * nicht: Der erste Anlauf dieses Drehbuchs hakte genau dort, und der
		 * Befund kam drei Schritte später («Haus A zeigt 0 statt zwei
		 * Antwortknöpfe») — der Fehler weiter weg als seine Ursache.
		 *
		 * Ausdrücklich «geführt»: In «einfach» erfasst die Sitzungsleitung ohnehin
		 * alle Stimmen, und die Frage hätte dort nur eine Antwort.
		 */
		await gehe(`/tage/${tag}`);
		const gefuehrt = seite.locator('input[name="betriebsart"][value="gefuehrt"]');
		await warteAuf(gefuehrt, 'Die Abstimmungsweise am Abend');
		await gefuehrt.check();
		await abschicken(seite.locator('button[form="angaben"]').first());
		await gehe(`/tage/${tag}`);
		behaupte(
			await seite.locator('input[name="betriebsart"][value="gefuehrt"]').isChecked(),
			'Die geführte Betriebsart hielt am Abend nicht'
		);
		return DATUM;
	});

	await schritt('Je Haus eine Versammlung, dem Abend zugeordnet', async () => {
		for (const [name, h] of [
			['A', hausA],
			['B', hausB]
		]) {
			await gehe(`/gemeinschaften/${h.id}/versammlungen/neu`);
			await seite.fill('input[name="datum"]', DATUM);
			await seite.fill('input[name="uhrzeit"]', '18:30');
			await seite.fill('input[name="ort"]', `Probesaal ${LAUF}`);
			await abschicken(seite.locator('button[form="anlegen"]'));
			const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
			behaupte(id, `Haus ${name}: keine Versammlung angelegt, Adresse ${seite.url()}`);
			versammlung[name] = id;

			await gehe(`/versammlungen/${id}`);
			// Nach der Kennung wählen, nicht nach dem Namen: Im Bestand stehen
			// ähnlich benannte Abende, und ein Treffer daneben fiele erst im Saal auf.
			await seite.locator('select[name="tag"]').first().selectOption(tag);
			await abschicken(seite.locator('button[form="angaben"]'));
			behaupte(
				(await seite.locator('select[name="tag"]').first().inputValue()) === tag,
				`Haus ${name} wurde dem Abend nicht zugeordnet`
			);
		}
		behaupte(
			versammlung.A !== versammlung.B,
			'Beide Häuser führen auf dieselbe Versammlung — alles Folgende misst dann dasselbe Haus zweimal'
		);
		return `A ${versammlung.A.slice(0, 13)} · B ${versammlung.B.slice(0, 13)}`;
	});

	await schritt('Beide freigeben und vom Eingang aus eröffnen', async () => {
		// Der Abend hat eine Sammelfreigabe; sie einzeln zu fahren wäre der Weg,
		// den im Saal niemand nimmt.
		await gehe(`/tage/${tag}/freigeben`);
		const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
		await warteAuf(alle, 'Die Sammelfreigabe des Abends');
		/*
		 * **Der Satz zur Einberufungszuständigkeit, in beiden Richtungen**
		 * (Produktentscheid 24.09.2026). Er steht über dem Sammelknopf, solange
		 * etwas freizugeben ist, und verschwindet danach: Nach der Freigabe ist
		 * die Einberufung geschehen, und ein Satz, der dann noch dasteht, wird
		 * zur Tapete. Dieser Durchstich ist der einzige, der einen Abend vor der
		 * Freigabe sieht.
		 */
		const zustaendigkeit = 'Die Zuständigkeit kann je Gemeinschaft verschieden sein';
		behaupte(
			(await seite.locator('main').innerText()).includes(zustaendigkeit),
			'Der Satz zur Einberufungszuständigkeit fehlt vor der Sammelfreigabe'
		);
		await abschicken(alle);
		await gehe(`/tage/${tag}/freigeben`);
		behaupte(
			!(await seite.locator('main').innerText()).includes(zustaendigkeit),
			'Der Satz zur Einberufungszuständigkeit steht nach der Freigabe noch da'
		);
		await gehe(`/tage/${tag}/einlass`);
		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
		await warteAuf(eroeffnen, 'Der Knopf «eröffnen» am Eingang');
		await abschicken(eroeffnen);
		await gehe(`/tage/${tag}/einlass`);
		const zeilen = await seite.locator('tbody tr').count();
		behaupte(zeilen >= 4, `Die Anwesenheitsliste des Abends führt ${zeilen} statt 4 Zeilen`);
		return `${zeilen} Zeilen`;
	});

	await schritt('In Haus B wird die Frage abgeschaltet', async () => {
		/*
		 * **Der Schalter steht je Versammlung, nicht je Abend.** Im Verbund kann
		 * ein Haus die Frage stellen wollen und das nächste nicht — etwa, weil
		 * dort ohnehin alle mit dem Telefon abstimmen. Genau dieser Unterschied
		 * wird unten am Eingang gemessen.
		 */
		await gehe(`/versammlungen/${versammlung.B}`);
		const form = seite.locator('form[action="?/papierfrage"]');
		await warteAuf(form, 'Der Schalter für die Papierfrage');
		const feld = form.locator('input[name="fragen"]');
		behaupte(
			(await feld.inputValue()) === 'nein',
			'Der Schalter steht nicht auf «fragen» — dann schaltet der Klick sie EIN statt aus'
		);
		await abschicken(form.locator('button[type="submit"]'));
		await gehe(`/versammlungen/${versammlung.B}`);
		behaupte(
			(await seite.locator('form[action="?/papierfrage"] input[name="fragen"]').inputValue()) ===
				'ja',
			'Die Frage liess sich in Haus B nicht abschalten'
		);
		return 'Haus A fragt, Haus B nicht';
	});

	// ── Der Eingang ─────────────────────────────────────────────────────────

	/**
	 * Meldet eine Person über den Saal-Einstieg des Abends an.
	 *
	 * Derselbe Weg wie im Saal: Der QR auf der Leinwand führt auf die
	 * Hausauswahl, dort wählt die Person ihr Haus und trägt ihren Namen ein.
	 * Die Meldung landet im Einlasskasten des Abends.
	 */
	async function meldeUeberDenSaal(hausbezeichnung, name) {
		await gehe(`/tage/${tag}/einlass`);
		const einstieg = await seite.locator('.adresse a').first().getAttribute('href');
		behaupte(einstieg, 'Am Eingang des Abends steht kein Saaleinstieg');

		const telefon = await kontext.newPage();
		warteNachNavigation(telefon);
		await telefon.goto(einstieg, { waitUntil: 'domcontentloaded' });
		const haus = telefon.locator('a.knopf', { hasText: hausbezeichnung });
		behaupte(await haus.count(), `Die Hausauswahl bietet «${hausbezeichnung}» nicht an`);
		await haus.first().click();
		await telefon.waitForLoadState('domcontentloaded');
		await telefon.locator('input[name="name"]').fill(name);
		await Promise.all([
			telefon.waitForResponse((r) => r.request().method() === 'POST').catch(() => null),
			telefon.locator('form button[type="submit"]').first().click()
		]);
		await telefon.waitForLoadState('domcontentloaded');
		await telefon.close();
	}

	/** Die Zeile im Einlasskasten, die diesen Namen trägt. */
	const meldung = (name) => seite.locator('section.einlass li', { hasText: name });

	await schritt('Haus A fragt am Eingang, Haus B nicht — in derselben Liste', async () => {
		await meldeUeberDenSaal(`Mischform A Prüflauf ${LAUF}`, `Papierfrau ${LAUF.slice(-4)}`);
		await meldeUeberDenSaal(`Mischform B Prüflauf ${LAUF}`, `Digitalmann ${LAUF.slice(-4)}`);

		await gehe(`/tage/${tag}/einlass`);
		const kasten = seite.locator('section.einlass');
		await warteAuf(kasten, 'Der Einlasskasten des Abends');

		const ausA = meldung(`Papierfrau ${LAUF.slice(-4)}`);
		const ausB = meldung(`Digitalmann ${LAUF.slice(-4)}`);
		behaupte(await ausA.count(), 'Die Meldung aus Haus A steht nicht am Eingang');
		behaupte(await ausB.count(), 'Die Meldung aus Haus B steht nicht am Eingang');

		/*
		 * **Am Feld gemessen, nicht am Text.** Ein Hinweis daneben liesse sich
		 * auch dann finden, wenn die Antwort nirgends abgeschickt würde. Der
		 * Prüfstein ist `name="papier"`: Nur was das Formular trägt, kommt beim
		 * Server an.
		 *
		 * **Hier ein Haken und nicht zwei Knöpfe**, und das ist Absicht (so schon
		 * im Haus). An der gescannten Karte fällt die Entscheidung in einem Griff,
		 * dort stehen zwei gleichwertige Knöpfe. Eine Saalmeldung wird
		 * ausgefüllt — Partei suchen, dann zuordnen —, und ein zweiter
		 * Zuordnungsknopf daneben wäre ein zweiter Weg durch dasselbe Formular.
		 * Der erste Anlauf dieses Drehbuchs suchte Knöpfe und meldete die richtige
		 * Maske als falsch.
		 */
		const hakenA = ausA.locator('input[type="checkbox"][name="papier"]');
		behaupte(
			(await hakenA.count()) === 1,
			`Haus A zeigt ${await hakenA.count()} statt einem Papierhaken — die Frage wird nicht gestellt`
		);
		behaupte(
			(await hakenA.inputValue()) === 'ja',
			`Haus A schickt «${await hakenA.inputValue()}» statt «ja»`
		);
		behaupte(
			!(await hakenA.isChecked()),
			'Der Haken ist vorbelegt — dann wäre die Antwort unterstellt und nicht gegeben'
		);

		behaupte(
			(await ausB.locator('[name="papier"]').count()) === 0,
			'Haus B fragt trotz abgeschaltetem Schalter — der Schalter wirkt für den ganzen Abend statt je Haus'
		);
		return 'Haken bei A, keiner bei B';
	});

	await schritt('«Stimmt von Hand» setzt den Vermerk, «Zurück» nimmt ihn weg', async () => {
		/*
		 * **Beides in EINEM Schritt** (10.09.2026, im Code-Review gefunden). Der
		 * Rückwegkasten lebt fünf Sekunden. Über eine Schrittgrenze getragen wird
		 * daraus ein Rennen: Auf einer langsamen Maschine ist der Kasten weg,
		 * bevor der nächste Schritt ihn greift, und der Zeitüberschritt sieht aus
		 * wie ein Fehler der Anwendung.
		 */
		await gehe(`/tage/${tag}/einlass`);
		const zeile = meldung(`Papierfrau ${LAUF.slice(-4)}`);
		await warteAuf(zeile, 'Die Meldung aus Haus A');

		/*
		 * Die Meldung muss einer Partei zugeordnet werden — das ist der Einlass.
		 * Genommen wird die erste wählbare Partei ihres Hauses; welche, ist für
		 * diese Messung gleichgültig.
		 */
		const auswahl = zeile.locator('select[name="partei"]').first();
		behaupte(await auswahl.count(), 'Die Meldung lässt sich keiner Partei zuordnen');
		await auswahl.selectOption({ index: 1 });

		// Der Haken ist die Antwort; abgeschickt wird über die Rückfrage, wie im
		// Saal auch. `abschicken` bestätigt sie.
		await zeile.locator('input[type="checkbox"][name="papier"]').check();
		await abschicken(zeile.locator('form[action="?/saalZuordnen"] button[type="submit"]'));

		const kasten = seite.locator('section.entscheid[data-richtung="gesetzt"]');
		await warteAuf(kasten, 'Der Rückweg nach «stimmt von Hand»');
		const gelesen = sauber(await kasten.innerText());
		behaupte(
			gelesen.includes('von Hand'),
			`Der Kasten sagt nicht, was vermerkt wurde: ${gelesen.slice(0, 160)}`
		);
		behaupte(
			(await kasten.locator('form[action="?/papierZuruecknehmen"] input[name="meeting"]').count()) >
				0,
			'Der Rückweg trägt sein Haus nicht mit — am Abend liefe er in eine Absage'
		);

		await abschicken(kasten.locator('button[type="submit"]'));

		/*
		 * **An der Wirkung gemessen, nicht am Meldungsstreifen** (10.09.2026, am
		 * eigenen Drehbuch gefunden). Eine gelungene Handlung meldet sich hier
		 * nicht zwingend als Streifen: `Meldung` blendet sich aus, wenn dasselbe
		 * Signal am Knopf steht. Eine Zusicherung darauf prüfte die Anzeigelogik
		 * statt die Rücknahme.
		 *
		 * **Der Anker für das Vorher** ist der Kasten oben: «Vermerkt: stimmt von
		 * Hand ab» erscheint nur, wenn der Server den Vermerk wirklich gesetzt hat
		 * — er kommt aus der Antwort der Handlung, nicht aus dem Formular.
		 */
		await gehe(`/versammlungen/${versammlung.A}/anwesenheit`);
		const rueckwege = await seite.locator('tbody form[action="?/papierZuruecknehmen"]').count();
		behaupte(
			rueckwege === 0,
			`Nach der Rücknahme führt die Anwesenheitsliste noch ${rueckwege} Papierpartei(en)`
		);
		return 'gesetzt und zurückgenommen';
	});

	/**
	 * Die Kartencodes einer Versammlung, gelesen aus ihrem Karten-PDF.
	 *
	 * **Warum aus dem PDF und nicht aus «Code ausgeben»** (10.09.2026, am eigenen
	 * Drehbuch gefunden). Es gibt zwei Arten Code, und sie sind nicht
	 * austauschbar:
	 *
	 * | | Länge | wofür | wo eingelöst |
	 * |---|---|---|---|
	 * | Kartencode | 20 Zeichen | steht auf der Zugangskarte | Scanner am Eingang |
	 * | Ausgabecode | 8 Zeichen | vorgelesen, 15 Minuten gültig | `/z` auf dem eigenen Telefon |
	 *
	 * Der erste Anlauf gab über «Code ausgeben» einen Ausgabecode aus und tippte
	 * ihn in den Eingangsscanner. Die Anwendung antwortete zu Recht «Dieser Zugang
	 * ist nicht gültig» — `loeseZugangAuf` kennt nur Kartencodes. Der Befund las
	 * sich wie ein Fehler am Scanner und war einer am Drehbuch.
	 *
	 * Angezeigt wird ein Kartencode nirgends in der Oberfläche; er steht nur auf
	 * der Karte. Deshalb der Umweg über `karten.pdf` und `pdftotext`. Die Anfrage
	 * läuft über `seite.request` und trägt damit die Sitzung des angemeldeten
	 * Benutzers.
	 */
	async function kartencodes(vId) {
		/*
		 * **Ein POST, kein Verweis.** Der Kartencode existiert nur im Augenblick
		 * seiner Entstehung; danach steht in der Datenbank nur sein Prüfwert
		 * (NFR-5). Die Karten zu holen heisst deshalb, die Zugänge zu erzeugen —
		 * und ein zweiter Aufruf ersetzt sie. Für einen frischen Prüfabend ist das
		 * unbedenklich; an einer echten Versammlung wäre es der Grund, warum es
		 * diesen Weg nur als Handlung gibt.
		 */
		const antwort = await seite.request.post(
			`${ZIEL}/versammlungen/${vId}/zugaenge/karten.pdf`,
			{ form: { form: 'sammel' } }
		);
		behaupte(antwort.ok(), `Das Karten-PDF kam mit ${antwort.status()} zurück`);
		await mkdir(ABLAGE, { recursive: true });
		const datei = `${ABLAGE}/karten-${vId}.pdf`;
		await writeFile(datei, await antwort.body());
		const gelesen = execFileSync('pdftotext', ['-layout', datei, '-'], {
			encoding: 'utf8'
		});
		const codes = [
			...new Set([...gelesen.matchAll(/[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}/g)].map((m) => m[0]))
		];
		behaupte(codes.length > 0, 'Im Karten-PDF steht kein Kartencode');
		return codes;
	}

	/**
	 * Wie viele Parteien dieses Hauses am Eingang als anwesend geführt werden.
	 *
	 * **An der Wirkung gemessen, nicht am Meldungsstreifen** — dieselbe Lehre wie
	 * bei der Rücknahme: Eine gelungene Handlung meldet sich nicht zwingend als
	 * Streifen, weil `Meldung` sich ausblendet, wenn dasselbe Signal am Knopf
	 * steht. Gezählt wird über die Namen des Hauses; sie tragen Hausbuchstaben und
	 * Laufkennung und sind eindeutig, während die gekürzten Gemeinschaftsnamen
	 * beider Häuser gleich anfangen.
	 */
	async function anwesendeIn(namen) {
		await gehe(`/tage/${tag}/einlass`);
		let gezaehlt = 0;
		for (const name of namen) {
			gezaehlt += await seite
				.locator('tbody tr', { hasText: name })
				.filter({ hasText: 'anwesend' })
				.count();
		}
		return gezaehlt;
	}

	let letzterCode = '';

	/** Einen Code eintippen und abschicken — der zweite Weg neben der Kamera. */
	async function scanne(code) {
		letzterCode = code;
		await gehe(`/tage/${tag}/einlass`);
		const scan = seite.locator('form[action="?/scannen"].zeile');
		await warteAuf(scan, 'Das Feld zum Eintippen des Codes');
		await scan.locator('input[name="code"]').fill(code);
		await abschicken(scan.locator('button[type="submit"]'));
	}

	await schritt('Der Kartenscanner erfasst sofort und bietet den Vermerk danach an', async () => {
		/*
		 * **Warum danach und nicht vorher.** Die Kamera schickt selbst ab, sobald
		 * sie einen Code liest — es gibt keinen Knopf, an den die Frage passte.
		 * Und welches Haus die Karte betrifft, steht erst nach dem Auflösen des
		 * Codes fest, während die Frage am Haus hängt.
		 */
		/*
		 * **Alle Karten des Hauses durchprobieren, bis eine erfasst.** Welche
		 * Partei die Saalmeldung oben bekommen hat, entscheidet die Auswahlliste;
		 * eine feste Karte zu nehmen hiesse, mit halber Wahrscheinlichkeit eine
		 * bereits anwesende zu scannen. Das Drehbuch fragt nicht, es probiert —
		 * und meldet, wenn keine einzige erfasst.
		 */
		let angeboten = false;
		for (const code of await kartencodes(versammlung.A)) {
			await scanne(code);
			if (await seite.locator('section.entscheid[data-richtung="offen"]').count()) {
				angeboten = true;
				break;
			}
		}
		const angebot = seite.locator('section.entscheid[data-richtung="offen"]');
		if (!angeboten) {
			throw new Error(
				`Nach dem Scan kein Angebot zum Nachtragen. Zuletzt Code «${letzterCode}», gemeldet wurde: «${await meldungstext()}»`
			);
		}
		await warteAuf(angebot, 'Das Angebot, den Vermerk nachzutragen');
		await abschicken(angebot.locator('form[action="?/papierNachtragen"] button'));

		const gesetzt = seite.locator('section.entscheid[data-richtung="gesetzt"]');
		await warteAuf(gesetzt, 'Der Vermerk nach dem Nachtragen');
		return 'erfasst, dann vermerkt';
	});

	await schritt('Der Nachtrag steht nicht in der laufenden Liste, nur im Kasten', async () => {
		/*
		 * **Vorgabe des Auftraggebers, 09.09.2026**: «Der Entscheid fällt am Eingang, nicht
		 * während der laufenden Sitzung.» Der Nachtragsknopf gehört deshalb in den
		 * Kasten unmittelbar nach dem Scan und verschwindet mit ihm. Stünde er an
		 * jeder Zeile der Anwesenheitsliste, wäre aus dem Entscheid am Eingang
		 * eine Einstellung geworden, die den Abend über offen steht.
		 */
		await gehe(`/tage/${tag}/einlass`);
		behaupte(
			(await seite.locator('tbody form[action="?/papierNachtragen"]').count()) === 0,
			'Die Anwesenheitsliste trägt den Nachtrag an jeder Zeile — der Entscheid wäre nicht mehr der am Eingang'
		);
		behaupte(
			(await seite.locator('section.entscheid').count()) === 0,
			'Der Kasten steht nach dem Neuladen noch da — beim nächsten Menschen träfe er die vorige Partei'
		);
		/*
		 * **Aber der Rückweg steht dort sehr wohl** (10.09.2026, im Code-Review
		 * gefunden). Der Kasten verspricht, er stehe danach «in der
		 * Anwesenheitsliste, an der Zeile dieser Partei» — am Abend stand nichts,
		 * und wer die fünf Sekunden verpasste, musste in die einzelne Versammlung
		 * wechseln. Wegnehmen ist die harmlose Richtung; nur das Setzen gehört an
		 * den Eingang.
		 */
		const rueckwege = await seite.locator('tbody form[action="?/papierZuruecknehmen"]').count();
		behaupte(
			rueckwege === 1,
			`Der Abend zeigt ${rueckwege} Rückwege statt einem — der Kasten verspricht einen, der nicht da ist`
		);

		/*
		 * **Und der Vermerk steht wirklich in den Daten.** Ohne diese Zeile misst
		 * der Schritt nur Abwesenheiten, und eine Abwesenheit ist auch dann
		 * erfüllt, wenn der Nachtrag gar nichts geschrieben hat.
		 */
		await gehe(`/versammlungen/${versammlung.A}/anwesenheit`);
		const imHaus = await seite.locator('tbody form[action="?/papierZuruecknehmen"]').count();
		behaupte(
			imHaus === 1,
			`Der nachgetragene Vermerk steht ${imHaus}-mal in der Anwesenheitsliste statt einmal`
		);
		return 'nur im Kasten, Rückweg an der Zeile, Vermerk hält';
	});

	await schritt('Ein zweiter Scan derselben Karte bietet den Vermerk nicht nochmals an', async () => {
		/*
		 * **Sonst behauptet der Kasten das Gegenteil dessen, was gilt**
		 * (10.09.2026, im Code-Review gefunden). Er hing allein daran, ob DIESE
		 * Anfrage einen Vermerk gesetzt hat — ein bestehender zählte nicht. Beim
		 * erneuten Scannen einer Papierpartei stand deshalb «die Partei stimmt
		 * digital ab» über einem Knopf, der nichts mehr ändern konnte.
		 */
		await scanne(letzterCode);
		behaupte(
			(await seite.locator('section.entscheid[data-richtung="offen"]').count()) === 0,
			'Der Kasten bietet den Vermerk erneut an, obwohl die Partei ihn schon hat'
		);
		return 'kein zweites Angebot';
	});

	await schritt('Auch «Ohne Karte einlassen» fragt am Abend', async () => {
		/*
		 * **Der Weg ohne Karte war der letzte, der still blieb** (10.09.2026, im
		 * Code-Review gefunden). Dieselbe Person wäre mit Karte gefragt worden;
		 * ohne Karte galt sie am Abend als digital, und nachtragen liess es sich in
		 * der Oberfläche nicht mehr.
		 *
		 * **Ein Haken für alle Häuser dieser Person, nicht einer je Haus.** Welche
		 * Häuser es sind, steht erst nach der Wahl der Person fest — ein Haken je
		 * Haus liesse sich gar nicht hinstellen. Am Eingang steht ohnehin EIN
		 * Mensch, der sagt, wie er abstimmt.
		 */
		await gehe(`/tage/${tag}/einlass`);
		const ausklapper = seite.locator('details.vonhand');
		await warteAuf(ausklapper, 'Der Ausklapper «Ohne Karte einlassen»');
		await ausklapper.locator('summary').click();

		const haken = ausklapper.locator('input[type="checkbox"][name="papier"]');
		behaupte(
			(await haken.count()) === 1,
			`«Ohne Karte einlassen» zeigt ${await haken.count()} statt einem Papierhaken`
		);

		const wer = hausA.namen[2];
		await ausklapper.locator('input[type="search"]').first().fill(wer);
		await seite.waitForTimeout(400);
		const treffer = ausklapper.locator('.wahlliste label', { hasText: wer }).first();
		behaupte(await treffer.count(), `${wer} steht nicht in der Personenliste`);
		await treffer.locator('input[name="person"]').check();

		await haken.check();
		await abschicken(ausklapper.locator('form[action="?/einlass"] button[type="submit"]'));

		/*
		 * **An der Wirkung gemessen.** Der Rückweg an der Zeile steht nur da, wenn
		 * der Vermerk wirklich geschrieben wurde.
		 */
		await gehe(`/tage/${tag}/einlass`);
		const zeile = seite
			.locator('tbody tr', { hasText: wer })
			.filter({ has: seite.locator('form[action="?/papierZuruecknehmen"]') });
		behaupte(
			await zeile.count(),
			`${wer} wurde ohne Karte eingelassen, aber ohne Vermerk «stimmt von Hand ab»`
		);
		return `${wer} ohne Karte, von Hand`;
	});

	await schritt('«Von Hand erfassen» an der Zeile bietet den Vermerk danach an', async () => {
		/*
		 * **Der letzte Eingang, der still blieb** (10.09.2026, im zweiten
		 * Code-Review gefunden). Die Zeile erfasst eine einzelne Partei — jemand
		 * sitzt im Saal, den niemand am Tisch gesehen hat. Danach galt sie als
		 * digital, ohne dass jemand gefragt worden wäre.
		 *
		 * **Die Frage kommt danach**, aus demselben Grund wie beim Scanner: Ein
		 * zweiter Knopf je Zeile machte aus achtzig Zeilen hundertsechzig
		 * Bedienelemente. Der Kasten fragt einmal und trifft nur den eben
		 * entstandenen Eintritt.
		 */
		const wer = hausA.namen[3];
		await gehe(`/tage/${tag}/einlass`);
		const zeile = seite
			.locator('tbody tr', { hasText: wer })
			.filter({ has: seite.locator('form[action="?/vonHand"]') })
			.first();
		behaupte(await zeile.count(), `${wer} lässt sich nicht von Hand erfassen`);
		await abschicken(zeile.locator('form[action="?/vonHand"] button'));

		/*
		 * **Warten, nicht zählen** (10.09.2026, an dieser Stelle selbst gemessen).
		 * Dieses Formular geht über `use:enhance`; der Kasten entsteht erst, wenn
		 * die Antwort verarbeitet und die Seite neu gezeichnet ist. Gemessen
		 * erschien er nach rund 800 ms, während `abschicken` nach etwa 500 ms
		 * zurückkommt. Ein `count()` an dieser Stelle ist ein Rennen: Der erste Lauf
		 * gewann es und meldete grün, die folgenden verloren es und meldeten einen
		 * Fehler der Anwendung, den es nicht gab.
		 *
		 * Beim Kartenscanner darüber stellt sich die Frage nicht: Das Formular dort
		 * trägt kein `enhance`, die Seite kommt fertig vom Server.
		 */
		const angebot = seite.locator('section.entscheid[data-richtung="offen"]');
		await angebot
			.first()
			.waitFor({ state: 'visible', timeout: 20000 })
			.catch(async () => {
				const richtungen = await seite
					.locator('section.entscheid')
					.evaluateAll((k) => k.map((x) => x.dataset.richtung));
				throw new Error(
					`Nach «Von Hand erfassen» kein Angebot zum Vermerk. ` +
						`Kästen: ${JSON.stringify(richtungen)}, gemeldet: «${await meldungstext()}»`
				);
			});
		await abschicken(angebot.locator('form[action="?/papierNachtragen"] button'));

		await gehe(`/tage/${tag}/einlass`);
		const mitVermerk = seite
			.locator('tbody tr', { hasText: wer })
			.filter({ has: seite.locator('form[action="?/papierZuruecknehmen"]') });
		behaupte(await mitVermerk.count(), `${wer} trägt den Vermerk nicht`);
		return `${wer} von Hand erfasst und vermerkt`;
	});

	await schritt('Das Protokoll des Abends nennt die Mischform je Haus', async () => {
		/*
		 * **Warum das hier gemessen wird und nicht nur im Kern.** Die Domänentests
		 * prüfen den Wortlaut gegen eine Wertetabelle; sie sehen die Verdrahtung
		 * nicht. Ob der Server die Papierparteien überhaupt holt und dem Textbauer
		 * unter dem richtigen Haus übergibt, zeigt nur der Lauf am lebenden System.
		 *
		 * **Am gemeinsamen Abend ist diese Zusammenstellung das Dokument**: Das
		 * Haus führt kein eigenes Protokoll mehr. Stünde der Abschnitt nur dort,
		 * sagte hier niemand, dass ein Teil der Stimmen übertragen wurde.
		 */
		await gehe(`/tage/${tag}/protokoll`);
		const feld = seite.locator('pre.text');
		await warteAuf(feld, 'Der Text des Abendprotokolls');
		const text = sauber(await feld.innerText());

		behaupte(
			text.includes('Stimmabgabe auf Papier'),
			`Das Abendprotokoll kennt den Abschnitt nicht: ${text.slice(0, 300)}`
		);
		behaupte(
			text.includes('Sitzungsleitung übertragen'),
			'Der Abschnitt sagt nicht, dass die Stimmen übertragen wurden'
		);

		/*
		 * **Haus A steht drin, Haus B nicht** — der eigentliche Prüfstein. Haus B
		 * hat die Frage abgeschaltet und deshalb keine Papierpartei; ein Eintrag
		 * dort behauptete eine Mischform, die es nicht gab.
		 */
		const zeileA = text.match(/- Mischform A[^:]*: (\d+) von (\d+) anwesenden Parteien/);
		behaupte(zeileA, `Haus A fehlt im Abschnitt: ${text.slice(0, 400)}`);
		behaupte(
			Number(zeileA[1]) >= 2,
			`Haus A nennt ${zeileA[1]} Papierparteien, erwartet sind mindestens zwei`
		);
		behaupte(
			!/- Mischform B[^:]*: \d+ von/.test(text),
			'Haus B steht im Abschnitt, obwohl dort niemand auf Papier abstimmte'
		);

		/*
		 * **Und kein Eigentümername im ganzen Dokument** (10.09.2026, im
		 * Sicherheitsdurchgang gefunden). Diese Zusammenstellung ist EIN Dokument
		 * für alle beteiligten Gemeinschaften und geht an alle ihre Eigentümer.
		 * Bis zum 10.09.2026 trug sie keinen einzigen Namen; eine Namensliste je
		 * Haus hiesse, dass die Eigentümer von Haus B erfahren, wer in Haus A
		 * wohnt und wie diese Person abstimmte. Dieselbe Grenze zieht
		 * `docs/verbund.md` beim Abschlusspaket.
		 *
		 * Gemessen am lebenden Dokument und nicht nur am Kern: Der Kern bekommt
		 * die Namen seit diesem Block gar nicht mehr, und genau das soll hier
		 * stehen bleiben.
		 */
		for (const name of [...hausA.namen, ...hausB.namen]) {
			behaupte(
				!text.includes(name),
				`Der Name «${name}» steht im gemeinsamen Protokoll aller Häuser`
			);
		}
		return `Haus A ${zeileA[1]} von ${zeileA[2]}, Haus B nicht genannt, keine Namen`;
	});

	await schritt('Bei abgeschalteter Frage bietet der Scanner nichts an', async () => {
		const vorher = await anwesendeIn(hausB.namen);
		const karten = await kartencodes(versammlung.B);
		await scanne(karten[0]);

		behaupte(
			(await seite.locator('section.entscheid').count()) === 0,
			'Haus B bietet den Vermerk an, obwohl die Frage dort abgeschaltet ist'
		);
		/*
		 * **Der Anker für das Nichts.** Ohne ihn ist dieser Schritt auch dann grün,
		 * wenn der Scan überhaupt nichts getan hat — und «kein Angebot» wäre dann
		 * die richtige Antwort auf die falsche Frage.
		 */
		const nachher = await anwesendeIn(hausB.namen);
		behaupte(
			nachher > vorher,
			`Die Karte «${letzterCode}» hat niemanden erfasst: ${vorher} → ${nachher} anwesend`
		);
		return `erfasst (${vorher} → ${nachher}), kein Angebot`;
	});
	await schritt('Im Haus fragt auch die Zeile «Von Hand erfassen»', async () => {
		/*
		 * **Der letzte Eingang, der die Frage nicht stellte** (10.09.2026). Alle
		 * anderen Wege stellten sie; die Zeile in der Anwesenheitsliste des Hauses
		 * nicht.
		 * Sie teilt sich die Handlung `bestaetigen` mit den Wartenden, die fragen —
		 * für den Server sah ihr Formular deshalb aus wie eines, in dem jemand
		 * «digital» geantwortet hat. Wer hier erfasst wurde, stimmte still am
		 * eigenen Gerät ab.
		 *
		 * **Gemessen wird im Haus und nicht am Abend.** Am Abend fragt dieselbe
		 * Zeile danach, im Kasten; das steht drei Schritte weiter oben. Hier steht
		 * die Frage vor dem Eintritt, weil das Haus feststeht.
		 */
		const wer = hausA.namen[4];
		await gehe(`/versammlungen/${versammlung.A}/anwesenheit`);
		const zeile = () => seite.locator('tbody tr', { hasText: wer }).first();
		await warteAuf(zeile(), `Die Zeile von ${wer} in der Anwesenheitsliste von Haus A`);

		const knoepfe = zeile().locator('form[action="?/bestaetigen"] button[name="papier"]');
		behaupte(
			(await knoepfe.count()) === 2,
			`Die Zeile bietet ${await knoepfe.count()} statt zwei Antworten — ` +
				'die Frage «digital oder von Hand» fehlt am Eingang'
		);

		/*
		 * **Und keiner der beiden ist vorbelegt.** Der erste Absendeknopf des
		 * Formulars ist der Vorgabeknopf des Browsers: Ein Druck auf Enter gäbe
		 * sonst die Antwort «digital», die niemand gegeben hat. Er steht deshalb
		 * gesperrt und versteckt davor.
		 */
		const vorgabe = zeile().locator(
			'form[action="?/bestaetigen"] button[data-vorgabe="keiner"][disabled]'
		);
		behaupte(
			await vorgabe.count(),
			'Kein gesperrter Vorgabeknopf — Enter beantwortete die Frage von selbst'
		);

		await abschicken(
			zeile().locator('form[action="?/bestaetigen"] button[name="papier"][value="ja"]')
		);

		/*
		 * **An der Wirkung gemessen, nicht an der Meldung.** Die Zeile bietet den
		 * Rückweg nur an, wenn der Vermerk geschrieben wurde. Die Meldung darüber
		 * blendet sich aus, sobald dasselbe Signal am Knopf steht.
		 *
		 * **Der Wortlaut taugt dafür seit dem 11.09.2026 nicht mehr** (hier
		 * gefunden, nachdem derselbe Griff in `durchspielen.mjs` rot wurde): «Stimmt
		 * von Hand» steht jetzt an BEIDEN Zeilen — an der mit Vermerk als
		 * Bestätigungswort der Rücknahme, an der ohne als Knopf «Stimmt doch von
		 * Hand». Eine Probe darauf wäre immer grün. Geblieben ist die Handlung, und
		 * die gibt es nur dort, wo der Vermerk steht.
		 */
		await gehe(`/versammlungen/${versammlung.A}/anwesenheit`);
		behaupte(
			await zeile().locator('form[action="?/papierZuruecknehmen"]').count(),
			`${wer} wurde erfasst, aber ohne Vermerk «stimmt von Hand ab»: ${sauber(await zeile().innerText()).slice(0, 200)}`
		);
		return `${wer} über die Zeile, von Hand`;
	});
	await schritt('Wer eintrat, während die Frage aus war, steht in der Nachtragsliste', async () => {
		/*
		 * **Das Loch, das der Auftraggeber am 10.09.2026 gemeldet hat.** Wer die Frage mitten
		 * im Einlass EINschaltet, hat alle vorher Eingelassenen nie gefragt. Sie
		 * stimmen still digital ab, und am gemeinsamen Abend gab es danach keinen
		 * Weg mehr: Ein zweiter Scan derselben Karte bietet nichts an (Schritt 11),
		 * und die Zeile fragt hier nachher statt vorher.
		 *
		 * **Haus B ist der gebaute Fall**, ohne dass etwas dafür aufgesetzt werden
		 * müsste: Dort ist die Frage seit Schritt 6 aus, und im Schritt davor wurde
		 * eine Partei eingelassen. Jetzt wird eingeschaltet, und genau diese Partei
		 * muss dastehen.
		 */
		await gehe(`/versammlungen/${versammlung.B}`);
		const form = seite.locator('form[action="?/papierfrage"]');
		await warteAuf(form, 'Der Schalter für die Papierfrage');
		behaupte(
			(await form.locator('input[name="fragen"]').inputValue()) === 'ja',
			'Der Schalter steht nicht auf «aus» — dann schaltet der Klick die Frage AUS statt ein'
		);
		await abschicken(form.locator('button[type="submit"]'));

		await gehe(`/tage/${tag}/einlass`);
		const liste = seite.locator('section.nachtragsliste');
		await warteAuf(liste, 'Die Nachtragsliste am Eingang des Abends');
		const eintraege = liste.locator('li');
		behaupte(
			(await eintraege.count()) === 1,
			`Die Nachtragsliste führt ${await eintraege.count()} statt einem Eintrag`
		);
		const wer = sauber(await eintraege.first().innerText());
		const genannt = hausB.namen.find((n) => wer.includes(n));
		behaupte(genannt, `Der Eintrag nennt niemanden aus Haus B: ${wer.slice(0, 120)}`);
		/*
		 * **Nur Haus B, nicht Haus A.** In Haus A hat jeder Eingang gefragt; stünde
		 * dort jemand, hielte die Liste jede beantwortete Frage für eine offene und
		 * wäre nach zehn Minuten so lang wie die Anwesenheitsliste.
		 */
		for (const name of hausA.namen) {
			behaupte(
				!sauber(await liste.innerText()).includes(name),
				`${name} aus Haus A steht in der Nachtragsliste, obwohl dort gefragt wurde`
			);
		}

		// Nachtragen, und zwar an der Wirkung gemessen: Der Vermerk steht danach an
		// der Zeile, und der Eintrag ist aus der Liste verschwunden.
		await abschicken(eintraege.first().locator('button[name="papier"][value="ja"]'));
		await gehe(`/tage/${tag}/einlass`);
		behaupte(
			(await seite.locator('section.nachtragsliste li').count()) === 0,
			'Die Nachtragsliste führt den Eintrag weiter, obwohl er beantwortet wurde'
		);
		/*
		 * **Die Zeile dieser Partei, nicht die Zahl über den ganzen Abend** (im
		 * ersten Lauf gefunden, 10.09.2026). Haus A trägt aus den Schritten davor
		 * vier Vermerke; «genau einer» war meine Zusicherung und nicht die Sache.
		 */
		const zeile = seite
			.locator('tbody tr', { hasText: genannt })
			.filter({ has: seite.locator('form[action="?/papierZuruecknehmen"]') });
		behaupte(
			(await zeile.count()) === 1,
			`Die Zeile von ${genannt} trägt den nachgetragenen Vermerk nicht`
		);
		return `${genannt} nachgetragen, Liste leer`;
	});
} catch (e) {
	fehler.push(`Abbruch: ${e.message}`);
	console.log(`\n  ✗ Abbruch — ${e.message}`);
	console.log(umgebungsbefund(e.message));
} finally {
	await browser.close();
}

console.log(`\n${nummer - fehler.length} von ${nummer} Schritten grün`);
if (fehler.length) {
	console.log('\nBefunde:');
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
