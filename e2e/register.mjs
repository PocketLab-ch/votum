/**
 * Die Reiterleiste über die Häuser eines Abends (`$lib/domain/register`).
 *
 * **Was hier eigentlich geprüft wird, ist die Herkunft.** Am gemeinsamen Abend
 * hat jedes Haus seine **eigene** Versammlung. Ein Reiter, der ins richtige Haus
 * führt, aber die Herkunft des vorigen mitschleppt, sieht völlig richtig aus:
 * Die Seite stimmt, die Angaben stimmen — und die Leiste daneben führt den
 * Ablauf der falschen Versammlung, der «Weiter»-Weg am Fuss springt ins falsche
 * Haus zurück. Der Kerntest `tests/domain/register.test.ts` prüft die Rechnung,
 * dieses Skript prüft, dass sie auch an der Seite ankommt.
 *
 * Der Lauf legt über den Anlege-Wizard einen Abend mit allen Gemeinschaften an —
 * Bezeichnung und Ort tragen «Prüflauf», damit `scripts/testdaten-entfernen.sql`
 * ihn fasst. Das Datum wechselt je Lauf: Zwei Abende am selben Tag weist die
 * Vorabprüfung zu Recht ab.
 *
 * Aufruf: `node e2e/register.mjs` (Umgebung wie e2e/durchspielen.mjs).
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { absageGrund, nachAbsendung, nachladeWarter } from './absendung.mjs';
import { bereit, warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-register';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
// Je Lauf ein anderer Tag: Die Vorabprüfung weist einen zweiten Abend am selben
// Datum zu Recht ab — im ersten Durchgang genau daran gescheitert.
const DATUM = new Date(Date.UTC(2030, 0, 1) + (Date.now() % 900) * 86400000)
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
// Jedes `goto` wartet fortan auf die Hydration. Ohne das war Schritt 10 in
// 5 von 6 Läufen rot, weil der Klick in das Fenster davor fiel.
warteNachNavigation(seite);

async function abschicken(knopf) {
	// Wie in `durchspielen.mjs`: Ein Submit vor der Hydration läuft nativ statt
	// über `use:enhance`. Dann ist `abgefangen(antwort)` falsch, `absageGrund`
	// liest den Status statt des Rumpfs, und ein `fail(400)` — das als HTTP 200
	// kommt — gilt als Erfolg (Code-Review 07.09.2026).
	await bereit(seite);
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
		knopf.click()
	]);
	const grund = await absageGrund(antwort);
	if (grund) throw new Error(grund);
	await nachAbsendung(seite, antwort, nachladen, 150);
}

/**
 * Einen Verweis anklicken und **nachweisen**, dass er getragen hat.
 *
 * **Kein `bereit()` davor.** Es sähe nach Schutz aus und wäre keiner: Die Marke
 * wird einmal je Dokument gesetzt und nie entfernt, ein Aufruf zwischen zwei
 * Klicks derselben Seite kehrt also sofort zurück (Code-Review 07.09.2026).
 * Gegen das Hydrationsfenster wirkt hier ausschliesslich das bewachte `goto`.
 *
 * **Dafür wird die Absage laut.** Vorher verschluckte `.catch(() => null)`
 * genau die Aussage «es hat gar keine Navigation gegeben»: Der Klick fiel ins
 * Leere, die Frist lief still ab, und der Schritt meldete danach etwas über den
 * **Inhalt** der Seite («Nicht im zweiten Haus gelandet»), obwohl gemessen
 * worden war, dass sich nichts bewegt hat. Die Suche danach hat einen Abend
 * gekostet; diese drei Zeilen hätten sie am ersten Tag beendet.
 */
async function klicke(verweis) {
	// **Die Adresse ist der Zeuge, nicht der Rückgabewert.** `waitForNavigation`
	// liefert bei einer Navigation im Browser (History API) `null` zurück und
	// nicht nur dann, wenn nichts geschah — auf `null` zu prüfen hiesse, jeden
	// gelungenen Wechsel für gescheitert zu halten.
	const vorher = seite.url();
	await Promise.all([
		seite.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
		verweis.click()
	]);
	if (seite.url() === vorher) {
		throw new Error(`Der Klick löste in 15 s keine Navigation aus, Adresse blieb ${vorher}`);
	}
	// Führte der Klick zu einem echten Dokumentwechsel, ist die neue Seite noch
	// nicht aufgestartet — das bewachte `goto` greift hier nicht.
	await bereit(seite);
	await seite.waitForTimeout(150);
}

async function gehe(pfad) {
	for (let versuch = 0; versuch < 2; versuch += 1) {
		try {
			await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
			return;
		} catch (e) {
			if (versuch === 1 || !String(e.message).includes('interrupted')) throw e;
		}
	}
}

try {
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

	let versammlungId = null;
	let tagId = null;
	let stwegIds = [];
	const eigeneHaeuser = [];

	/*
	 * **Eigene Häuser statt geliehener.**
	 *
	 * Bis zum 27.08.2026 nahm dieses Drehbuch, was gerade im Bestand stand, und
	 * hakte jedes Kästchen an. Das ging zweimal schief, und zwar aus
	 * entgegengesetzten Gründen: Bei 415 Gemeinschaften war Kästchen 139
	 * gesperrt — `check()` lief in die Zeitüberschreitung. Nach dem Aufräumen
	 * stand keine mehr da, und die Zusicherung «mindestens zwei» schlug an.
	 *
	 * Gesperrt wird eine übergeordnete Gemeinschaft
	 * (`versammlungen/neu/+page.svelte`, `disabled={g.klammer}`): Sie hat keine
	 * Einheiten und damit niemanden, der dort tagen könnte.
	 *
	 * Beides sind keine Programmfehler, sondern dieselbe Ursache: Ein Drehbuch,
	 * dessen Voraussetzung jemand anderes herstellen muss, ist nicht prüfbar.
	 * Es legt seine drei Häuser jetzt selbst an und wählt später genau diese.
	 */
	await schritt('Drei eigene Häuser anlegen', async () => {
		for (const nr of [1, 2, 3]) {
			await gehe('/gemeinschaften/neu');
			await seite.fill('input[name="name"]', `Registerhaus ${nr} Prüflauf ${LAUF}`);
			await seite.fill('input[name="quotaDenominator"]', '1000');
			await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
			await abschicken(seite.locator('main button[type="submit"]').first());
			const id = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
			// **`id !== 'neu'` ist der eigentliche Prüfstein.** Bleibt das Formular
			// stehen, ist die Adresse weiter `/gemeinschaften/neu` und die Kennung
			// die Zeichenkette «neu» — wahr, und die Zusicherung schliefe durch.
			behaupte(
				id && id !== 'neu',
				`Haus ${nr} nicht angelegt, Adresse steht auf ${seite.url()}`
			);
			eigeneHaeuser.push(id);
		}
		return `${eigeneHaeuser.length} Häuser`;
	});

	await schritt('Abend mit den eigenen Gemeinschaften anlegen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Registerprobe Prüflauf ${LAUF}`);
		await seite.fill('input[name="datum"]', DATUM);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Probesaal Prüflauf ${LAUF}`);
		for (const id of eigeneHaeuser) {
			const kaestchen = seite.locator(`input[name="gemeinschaft"][value="${id}"]`);
			behaupte(await kaestchen.count(), `Eigenes Haus ${id} steht nicht zur Wahl`);
			// **Gesperrt wäre ein Befund, keine Zeitüberschreitung.** `check()`
			// wartet sonst dreissig Sekunden und meldet einen Selektor statt der
			// Ursache.
			behaupte(await kaestchen.isEnabled(), `Eigenes Haus ${id} ist gesperrt — gilt es als übergeordnete Gemeinschaft?`);
			await kaestchen.check();
		}
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Nach dem Anlegen auf ${seite.url()}`);
		tagId = seite.url().split('/tage/')[1].split(/[/?]/)[0];
		return `${eigeneHaeuser.length} Gemeinschaften`;
	});

	await schritt('Von der Tagesseite in ein Haus', async () => {
		/*
		 * **Nur Verweise auf die Versammlung selbst, nicht auf eine Unterseite.**
		 *
		 * Am 27.08.2026 stand hier `verweise[0]`, und das ging schief, sobald
		 * irgendwo eine Versammlung lief: Der Kopf trägt dann ein Band «Zur
		 * Sitzungsleitung» mit `/versammlungen/<id>/leitung`, und zwar zu einer
		 * FREMDEN Versammlung. Das Drehbuch folgte ihm, landete in einem anderen
		 * Haus und meldete danach fünf Befunde über eine fehlende Reiterleiste,
		 * die dort zu Recht fehlte.
		 *
		 * Der Filter unterscheidet beides an der Form: `/versammlungen/<id>` und
		 * nichts dahinter.
		 */
		const alle = await seite
			.locator('a[href*="/versammlungen/"]')
			.evaluateAll((a) => a.map((e) => e.getAttribute('href')));
		const eigene = alle.filter((h) => /^\/versammlungen\/[0-9a-f-]+$/.test(h));
		behaupte(
			eigene.length > 0,
			`Kein Verweis auf eine Versammlung selbst: ${JSON.stringify(alle.slice(0, 6))}`
		);
		const href = eigene[0];
		versammlungId = href.split('/versammlungen/')[1].split(/[/?]/)[0];
		await gehe(`/versammlungen/${versammlungId}`);
		return versammlungId;
	});

	const THEMEN = ['einheiten', 'eigentuemer', 'reglement', 'beschlussfaehigkeit'];

	await schritt('Aus dem Ablauf auf die Einheiten — Leiste steht da', async () => {
		await gehe(`/versammlungen/${versammlungId}`);
		const verweis = seite.locator('nav a[href*="/einheiten"]').first();
		behaupte(await verweis.count(), 'Kein Verweis auf Einheiten in der Leiste');
		await klicke(verweis);
		const leiste = seite.locator('nav.register');
		behaupte(await leiste.count(), 'Keine Reiterleiste auf der Einheitenseite');
		const reiter = leiste.locator('a');
		stwegIds = await Promise.all(
			(await reiter.all()).map(async (a) =>
				(await a.getAttribute('href')).split('/gemeinschaften/')[1].split('/')[0]
			)
		);
		const frage = (await leiste.locator('.frage').innerText()).replace(/\s+/g, ' ');
		return `${stwegIds.length} Reiter · «${frage}»`;
	});

	for (const thema of THEMEN) {
		await schritt(`Thema «${thema}»: jeder Reiter trägt die Versammlung SEINES Hauses`, async () => {
			const leiste = seite.locator('nav.register');
			const hrefs = await Promise.all(
				(await leiste.locator('a').all()).map((a) => a.getAttribute('href'))
			);
			behaupte(hrefs.length >= 2, `Nur ${hrefs.length} Reiter`);
			const zur = hrefs.map((h) => new URL(h, ZIEL).searchParams.get('zur'));
			behaupte(zur.every(Boolean), 'Ein Reiter ohne Herkunft');
			behaupte(new Set(zur).size === zur.length, 'Zwei Reiter mit derselben Herkunft');
			behaupte(
				hrefs.every((h) => h.includes(`/${thema}?`)),
				`Ein Reiter zeigt nicht auf ${thema}: ${hrefs.join(' ')}`
			);
			// Zum nächsten Thema über die Ablaufleiste weiterziehen.
			const naechstes = THEMEN[THEMEN.indexOf(thema) + 1];
			if (naechstes) {
				const weiter = seite.locator(`nav a[href*="/${naechstes}"]`).first();
				await klicke(weiter);
			}
			return `${hrefs.length} Reiter, ${new Set(zur).size} verschiedene Herkünfte`;
		});
	}

	await schritt('Haus wechseln: Thema bleibt, Ablaufleiste folgt dem neuen Haus', async () => {
		await gehe(`/gemeinschaften/${stwegIds[0]}/einheiten?zur=${versammlungId}`);
		const zweiter = seite.locator('nav.register a').nth(1);
		const ziel = await zweiter.getAttribute('href');
		await klicke(zweiter);
		behaupte(seite.url().includes('/einheiten'), `Nach dem Wechsel auf ${seite.url()}`);
		behaupte(seite.url().includes(stwegIds[1]), 'Nicht im zweiten Haus gelandet');
		const zur = new URL(ziel, ZIEL).searchParams.get('zur');
		behaupte(seite.url().includes(zur), 'Herkunft nicht mitgewechselt');
		// Die Seitenleiste muss jetzt die Versammlung des zweiten Hauses führen.
		const ablauf = seite.locator(`nav[aria-label="Ablauf der Versammlung"] a[href*="/versammlungen/${zur}"]`);
		behaupte(await ablauf.count(), 'Die Ablaufleiste führt noch die alte Versammlung');
		const hier = seite.locator('nav.register a[aria-current="page"]');
		behaupte((await hier.count()) === 1, `${await hier.count()} Reiter als «hier» markiert`);
		return `«${(await hier.innerText()).trim()}» ist markiert`;
	});

	await schritt('Der Zähler stimmt mit den Haken überein', async () => {
		const leiste = seite.locator('nav.register');
		const text = await leiste.locator('.zaehler').innerText();
		const [erledigt, gesamt] = text.match(/\d+/g).map(Number);
		const haken = await leiste.locator('a .haken').count();
		const reiter = await leiste.locator('a').count();
		behaupte(erledigt === haken, `Zähler sagt ${erledigt}, gezählt ${haken} Haken`);
		behaupte(gesamt === reiter, `Zähler sagt ${gesamt} Häuser, gezählt ${reiter}`);
		return text;
	});

	/*
	 * **Jeder Reiter trägt genau ein Zeichen.** Bis zum 12.08.2026 trug nur das
	 * Erledigte eines; die offenen Häuser waren die ohne Haken, und eine
	 * Abwesenheit sieht man schlechter als ein Zeichen (Auftraggeber: «Fehlende Einträge
	 * können da leicht übersehen werden»). Der stille Fehler wäre ein Reiter ganz
	 * ohne Zeichen — er sähe aus wie erledigt und wäre es nicht.
	 */
	await schritt('Auch das Offene ist gezeichnet — kein Reiter bleibt stumm', async () => {
		const leiste = seite.locator('nav.register');
		const reiter = await leiste.locator('a').count();
		const haken = await leiste.locator('a .haken').count();
		const mangel = await leiste.locator('a .mangel').count();
		behaupte(
			haken + mangel === reiter,
			`${reiter} Reiter, aber nur ${haken} Haken und ${mangel} Ausrufezeichen`
		);
		// Und für die Sprachausgabe steht es im Text, nicht nur in der Farbe.
		const versteckt = await leiste.locator('a .sr').allInnerTexts();
		behaupte(
			versteckt.length === reiter && versteckt.every((t) => /Erledigt|Noch offen/.test(t)),
			`Nur ${versteckt.length} von ${reiter} Reitern sagen ihren Zustand im Text`
		);
		return `✓${haken} !${mangel} von ${reiter}`;
	});

	/*
	 * Die Sammelansicht: Der Punkt, den der Auftraggeber am 12.08.2026 gemeldet hat. Sechs
	 * Kacheln sahen gleich aus, und die zwei leeren standen irgendwo dazwischen.
	 * Geprüft wird nicht die Farbe, sondern die Ordnung — dass die offenen **oben**
	 * stehen und dass so viele markiert sind, wie die Überschrift zählt.
	 */
	await schritt('Sammelansicht: offene Gemeinschaften stehen oben und sind gezählt', async () => {
		await gehe(`/tage/${tagId}/stammdaten?thema=einheiten`);
		const karten = seite.locator('section.karte');
		const anzahl = await karten.count();
		behaupte(anzahl === stwegIds.length, `${anzahl} Kacheln bei ${stwegIds.length} Häusern`);

		const markiert = await seite.locator('section.karte.offen').count();
		const ueberschriften = await seite.locator('h2.abschnitt').allInnerTexts();
		if (markiert > 0 && markiert < anzahl) {
			behaupte(ueberschriften.length === 2, `Zwei Gruppen erwartet, ${ueberschriften.length} gefunden`);
			const [zahl] = ueberschriften[0].match(/\d+/g).map(Number);
			behaupte(zahl === markiert, `Überschrift sagt ${zahl}, markiert sind ${markiert}`);
			// Die offenen zuerst: die ersten `markiert` Kacheln tragen die Marke.
			const marken = await karten.evaluateAll((els) => els.map((e) => e.classList.contains('offen')));
			behaupte(
				marken.slice(0, markiert).every(Boolean) && !marken.slice(markiert).some(Boolean),
				`Marken stehen verstreut: ${marken.map((m) => (m ? '!' : '·')).join('')}`
			);
		}
		return `${markiert} von ${anzahl} markiert · ${ueberschriften.join(' | ') || 'eine Gruppe'}`;
	});

	await schritt('Ohne Herkunft keine Leiste — die Gemeinschaft steht für sich', async () => {
		await gehe(`/gemeinschaften/${stwegIds[0]}/einheiten`);
		const leiste = seite.locator('nav.register');
		behaupte((await leiste.count()) === 0, 'Leiste erscheint ohne Herkunft');
	});

	await schritt('Messen: Wege für vier Themen mal alle Häuser', async () => {
		const haeuser = stwegIds.length;
		const themen = THEMEN.length;
		// Vorher: je Thema und Haus über die Übersicht — Gemeinschaft suchen,
		// anklicken, Thema anklicken. Nachher: einmal hin, dann ein Klick je Feld.
		const vorher = haeuser * themen * 3;
		const nachher = themen + haeuser * themen - themen;
		console.log(`     ${haeuser} Häuser × ${themen} Themen: ${vorher} Klicks → ${nachher} Klicks`);
		return `${vorher} → ${nachher}`;
	});

	await seite.screenshot({ path: `${AUFNAHMEN}/register.png` });
} finally {
	await browser.close();
	console.log(fehler.length ? `\n${fehler.length} Befunde:\n- ${fehler.join('\n- ')}` : '\nAlles grün.');
	process.exit(fehler.length ? 1 : 0);
}
