/**
 * Läuft eine Seite auf dem Telefon quer?
 *
 * **Der Anlass, am 20.08.2026.** Der Auftraggeber schickte ein Bild vom eigenen Gerät: Im
 * Kasten mit dem Anzeigecode stand die Adresse der Präsentationssicht als ein
 * einziges langes Wort ohne Umbruchstelle. Gemessen: **273 px** über den Kasten
 * hinaus, die ganze Seite **257 px** über den Rand.
 *
 * **Warum ein eigener Wächter.** Das ist keine Eigenheit dieser einen Adresse,
 * sondern eine Fehlerklasse: Was keine Leerstelle hat — Adressen, Codes,
 * Dateinamen, lange Fachbegriffe —, bricht nicht um und schiebt die Seite
 * seitlich weg. Auf dem Notebook fällt das nie auf. Es zeigt sich erst dort, wo
 * die Sitzungsleitung tatsächlich steht: am Eingang, mit dem Telefon in der
 * Hand.
 *
 * **Er misst nicht nur, DASS etwas quer läuft, sondern WAS.** Ein Wächter, der
 * «257 px zu breit» meldet, schickt den Nächsten auf die Suche; einer, der das
 * Element und seinen Text nennt, zeigt auf die Zeile.
 *
 * Geprüft wird bei 390 px, drei Formularseiten zusätzlich bei 320 px — die Breite eines iPhone in Hochkant.
 *
 * Aufruf: `node e2e/telefonbreite.mjs`
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
const BREITE = Number(process.env.BREITE ?? 390);
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-telefonbreite';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const befunde = [];
let geprueft = 0;

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: BREITE, height: 844 } });
const seite = await ctx.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
seite.on('dialog', (d) => d.accept());

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

/**
 * Eine Seite messen.
 *
 * Zwei Zahlen, und beide gehören dazu: Der Querlauf des Dokuments sagt, ob der
 * Benutzer seitlich schieben muss; das breiteste Element sagt, woran es liegt.
 * Ein Element in einem Kasten mit `overflow-x: auto` darf breiter sein — dann
 * scrollt der Kasten, nicht die Seite.
 */
/**
 * **Je Seite die Breite, in der ihr Befund entstand** (26.08.2026, aus dem
 * Code-Review).
 *
 * Der Lauf misst bei 390 px. Die drei Seiten, die im selben Zug aufgenommen
 * wurden, liefen aber erst bei **320 px** quer — 29 px am Wort
 * «Miteigentümergemeinschaft,», 50 px am Dateifeld des Briefkopfs. Bei 390 px
 * wäre der Wächter für genau diese Fälle grün gewesen, ohne etwas zu prüfen.
 * Sie werden deshalb zusätzlich bei 320 px gemessen.
 *
 * **Warum nicht alle Seiten bei beiden Breiten.** Ausprobiert und gemessen: Bei
 * 320 px laufen vier weitere Seiten quer (Übersicht 57 px, Versammlungen 58 px,
 * Anwesenheit 46 px am Zugangscode). Das ist Altbestand und gehört behoben —
 * aber nicht in demselben Zug, und ein Wächter, der aus einem fremden Grund rot
 * steht, wird abgeschaltet statt gelesen. Wer es angehen will: `BREITE=320`.
 */
const SCHMAL = 320;

async function miss(name, pfad, vorbereiten = null, breiten = [BREITE]) {
	geprueft++;
	for (const breite of breiten) {
		if (breiten.length > 1) await seite.setViewportSize({ width: breite, height: 900 });
		await messeEinmal(breiten.length > 1 ? `${name} (${breite} px)` : name, pfad, vorbereiten);
	}
	if (breiten.length > 1) await seite.setViewportSize({ width: BREITE, height: 900 });
}

async function messeEinmal(name, pfad, vorbereiten) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForTimeout(400);
	if (vorbereiten) await vorbereiten();

	const befund = await seite.evaluate((breite) => {
		const quer = document.documentElement.scrollWidth - document.documentElement.clientWidth;

		/*
		 * **Gesucht ist der Verursacher, nicht das am weitesten rechts stehende
		 * Ding.** Läuft eine Seite quer, ragen alle Elemente rechts hinaus — beim
		 * ersten Anlauf meldete dieser Wächter deshalb den Link «Handbuch» in der
		 * Kopfzeile, während die Ursache eine Adresse weiter unten war.
		 *
		 * Verursacher ist, was **selbst** breiter ist als der Schirm und kein
		 * ebenso breites Kind hat: das innerste zu breite Element. Ein Kasten mit
		 * eigener seitlicher Rollleiste zählt nicht — dort rollt der Kasten und
		 * nicht die Seite.
		 */
		const breiteVon = (k) => {
			const r = k.getBoundingClientRect();
			/*
			 * **Zwei Arten, zu breit zu sein.** Ein Kasten kann selbst über den
			 * Schirm hinausragen (feste Breite, Abstand) — dann zählt seine
			 * Rechteckbreite. Oder sein Inhalt läuft über ihn hinaus, ohne ihn zu
			 * verbreitern: Genau das tut eine Adresse ohne Umbruchstelle, und
			 * dann steht in der Rechteckbreite nichts davon. Dafür ist
			 * `scrollWidth` da.
			 */
			return Math.max(r.width, k.scrollWidth);
		};
		const zuBreit = [...document.querySelectorAll('body *')].filter((k) => {
			if (breiteVon(k) <= breite + 2) return false;
			const stil = getComputedStyle(k);
			// Ein Kasten mit eigener seitlicher Rollleiste darf breiten Inhalt
			// tragen — dort rollt der Kasten, nicht die Seite.
			if (stil.overflowX === 'auto' || stil.overflowX === 'scroll') return false;
			/*
			 * **Was nur der Bildschirmleser hört, schiebt nichts.** `.nurLeser`
			 * misst 1 × 1 px und ist per `clip-path` weggeschnitten; sein
			 * `scrollWidth` ist trotzdem so breit wie der Satz darin. Ohne diese
			 * Zeile meldete der Wächter «Handbuch: An der Versammlung …» als
			 * Verursacher — ein Text, den niemand sieht.
			 */
			if (stil.clipPath !== 'none' || stil.overflow === 'hidden') {
				const r = k.getBoundingClientRect();
				if (r.width <= 2 || r.height <= 2) return false;
			}
			return true;
		});
		const innerste = zuBreit.filter((k) => !zuBreit.some((a) => a !== k && k.contains(a)));
		const treffer = innerste.sort((a, b) => breiteVon(b) - breiteVon(a))[0];

		return {
			quer,
			schlimmster: treffer
				? {
						ueber: Math.round(breiteVon(treffer) - breite),
						wie:
							treffer.tagName.toLowerCase() +
							(treffer.className ? `.${String(treffer.className).split(' ')[0]}` : ''),
						text: (treffer.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
					}
				: null
		};
	}, BREITE);

	if (befund.quer > 0) {
		const wo = befund.schlimmster
			? `${befund.schlimmster.wie} ist ${befund.schlimmster.ueber} px breiter als der Schirm: «${befund.schlimmster.text}»`
			: 'kein einzelnes Element auffällig — vermutlich ein Abstand oder eine feste Breite';
		befunde.push(`${name} (${pfad}): Seite läuft ${befund.quer} px quer — ${wo}`);
		console.log(`  ✗ ${name} — ${befund.quer} px quer`);
		console.log(`      ${wo}`);
		await seite
			.screenshot({ path: `${AUFNAHMEN}/quer-${name.replace(/\W+/g, '-')}.png`, fullPage: true })
			.catch(() => {});
	} else {
		console.log(`  ✓ ${name}`);
	}
}

try {
	console.log(`Ziel: ${ZIEL} · ${BREITE} px · Lauf ${LAUF}\n`);

	// ── Ein kleiner Prüfbestand, damit die Zustände echt sind ───────────────
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="username"]', BENUTZER);
	await seite.fill('input[name="kennwort"]', KENNWORT);
	await Promise.all([
		seite.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
		seite.locator('main button[type="submit"]').click()
	]);

	const NAME = `Prüflauf Telefonbreite ${LAUF}`;
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

	await seite.goto(`${ZIEL}/versammlungen/${versammlung}/traktanden`, {
		waitUntil: 'domcontentloaded'
	});
	/*
	 * **Der Knopf klappt das Formular auf — sobald Svelte übernommen hat.**
	 * Ein Klick davor geht ins Leere, ohne Fehler und ohne Wirkung. Deshalb wird
	 * geprüft statt gewartet: Ist das Feld nach dem Klick nicht da, wird nochmals
	 * geklickt (ein zweiter Klick auf einen bereits geöffneten Block würde ihn
	 * schliessen — die Prüfung davor verhindert genau das).
	 */
	const titelfeld = seite.locator('form.formular input[name="titel"]').first();
	for (let versuch = 0; versuch < 4; versuch++) {
		if (await titelfeld.isVisible().catch(() => false)) break;
		await seite.locator('.neu button.haupt').click().catch(() => {});
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

	console.log('Seiten auf Telefonbreite');

	// ── Die Seiten, die im Saal oder unterwegs gebraucht werden ─────────────
	await miss('Übersicht', '/');
	await miss('Versammlungen', '/versammlungen');
	await miss('Gemeinschaften', '/gemeinschaften');
	await miss('Eigentümer', `/gemeinschaften/${gemeinschaft}/eigentuemer`);
	await miss('Einheiten', `/gemeinschaften/${gemeinschaft}/einheiten`);
	/*
	 * **Die Nutzniessung kam mit dem Stapelumbau dazu** (01.09.2026). Kein
	 * Drehbuch hat sie je gemessen; aufgenommen wurde sie nur als Bild. Genau
	 * dort, wo ein Layout von zwei Spalten auf einen Stapel wechselt, ist der
	 * Querlauf am Telefon die Frage, die zuerst schiefgeht.
	 */
	await miss('Nutzniessung', `/gemeinschaften/${gemeinschaft}/nutzniessung`);

	/*
	 * **Die drei Formularseiten, die bis zum 26.08.2026 fehlten.** Alle drei
	 * liefen bei 320 px quer, ohne dass es jemand sah: «Gemeinschaft anlegen»
	 * 29 px am Wort «Miteigentümergemeinschaft,», die Betreiberseite 50 px am
	 * Dateifeld des Briefkopfs, das seine eigene Breite mitbringt. Gefunden hat
	 * es ein Code-Review, nicht dieser Wächter — weil er die Seiten nicht kannte.
	 */
	await miss('Gemeinschaft anlegen', '/gemeinschaften/neu', null, [BREITE, SCHMAL]);
	await miss('Angaben der Gemeinschaft', `/gemeinschaften/${gemeinschaft}/angaben`, null, [BREITE, SCHMAL]);
	await miss('Betreiber', '/betreiber', null, [BREITE, SCHMAL]);
	await miss('Versammlung', `/versammlungen/${versammlung}`);

	/*
	 * **Der Anlassfall: der Kasten mit dem Anzeigecode.** Er erscheint nur
	 * unmittelbar nach dem Erzeugen — eine Prüfung, die bloss die Seite aufruft,
	 * sähe ihn nie. Genau deshalb ist er durchgerutscht.
	 */
	await miss('Versammlung mit Anzeigecode', `/versammlungen/${versammlung}`, async () => {
		await seite.locator('details.anzeige summary').click();
		await seite.waitForTimeout(200);
		await abschicken(seite.locator('form[action="?/anzeigecode"] button'));
	});

	await miss('Traktanden', `/versammlungen/${versammlung}/traktanden`);
	await miss('Sitzungsleitung', `/versammlungen/${versammlung}/leitung`);
	await miss('Anwesenheit', `/versammlungen/${versammlung}/anwesenheit`);
	await miss('Einlass', `/versammlungen/${versammlung}/einlass`);
	await miss('Auswertung', `/versammlungen/${versammlung}/auswertung`);
	await miss('Protokoll', `/versammlungen/${versammlung}/protokoll`);
	await miss('Vollmachten', `/versammlungen/${versammlung}/vollmachten`);

	/*
	 * ── Die Seiten, die dieser Waechter bis zum 02.09.2026 nie besucht hat ──
	 *
	 * **Der Waechter gab es seit dem 20.08.2026, und er prueft 19 von 62 Seiten.**
	 * Eine Messreihe ueber den ganzen Bestand fand vier Seiten, die am Telefon
	 * quer laufen — und alle vier lagen ausserhalb seiner Liste: `/verlauf` mit
	 * 365 px, die Reglementsseite mit 14, dazu zwei Seiten des gemeinsamen
	 * Abends. Nicht der Wächter war falsch gebaut, er sah nur die halbe
	 * Anwendung.
	 *
	 * Deshalb stehen hier ab jetzt **alle** Seiten, die sich ohne besonderen
	 * Bestand aufrufen lassen. Was fehlt, sind die Seiten eines gemeinsamen
	 * Abends: Dafuer muesste der Lauf einen Tag anlegen, und das ist ein eigener
	 * Block.
	 */
	await miss('Verlauf', '/verlauf');
	await miss('Personen', '/personen');
	await miss('Mein Konto', '/konto');
	await miss('Benutzer', '/betreiber/benutzer');
	await miss('Dienste', '/betreiber/dienste');
	await miss('Betriebszustand', '/pruefen');
	await miss('Mehrheiten', '/quorum');
	await miss('Reglement', `/gemeinschaften/${gemeinschaft}/reglement`);
	await miss('Lesarten', `/gemeinschaften/${gemeinschaft}/lesarten`);
	await miss('Beschlussfaehigkeit', `/gemeinschaften/${gemeinschaft}/beschlussfaehigkeit`);
	await miss('Historie', `/gemeinschaften/${gemeinschaft}/historie`);
	await miss('Uebernahme', `/gemeinschaften/${gemeinschaft}/uebernahme`);
	await miss('Einspielen', `/gemeinschaften/${gemeinschaft}/einspielen`);
	await miss('Gemeinschaft', `/gemeinschaften/${gemeinschaft}`);
	await miss('Versammlung anlegen', '/versammlungen/neu');
	await miss('Vorbereitung', `/versammlungen/${versammlung}/vorbereitung`);
	await miss('Freigabe', `/versammlungen/${versammlung}/freigabe`);
	await miss('Zugaenge', `/versammlungen/${versammlung}/zugaenge`);
	await miss('Siegel', `/versammlungen/${versammlung}/siegel`);
	await miss('Ausfallsicherung', `/versammlungen/${versammlung}/ausfall`);
	await miss('Weisungen', `/versammlungen/${versammlung}/weisungen`);
	await miss('Uebernehmen', `/versammlungen/${versammlung}/uebernehmen`);

	/*
	 * ── Der gemeinsame Abend ────────────────────────────────────────────────
	 *
	 * **Warum er hier aufgebaut wird** (02.09.2026): Zwei seiner Seiten liefen
	 * am Telefon quer (`geschaefte` 44 px, `siegel` 42 px), und keine davon
	 * konnte dieser Wächter je sehen — er kannte nur einzelne Versammlungen. Ein
	 * behobener Fehler ohne Wächter ist ein Fehler, der wiederkommt.
	 *
	 * Ein Abend braucht **zwei** Gemeinschaften; die zweite entsteht deshalb
	 * eigens dafür, mit einer Einheit und einer Partei, damit die Seiten etwas
	 * anzuzeigen haben.
	 */
	await seite.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
	await seite.fill('input[name="name"]', `${NAME} zweites Haus`);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
	await abschicken(seite.locator('main button[type="submit"]').first());
	const zweite = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];

	await seite.goto(`${ZIEL}/gemeinschaften/${zweite}/einheiten`, {
		waitUntil: 'domcontentloaded'
	});
	const ef2 = seite.locator('form[action$="anlegen"]').first();
	await ef2.locator('input[name="label"]').fill('Whg 1');
	await ef2.locator('input[name="quote.stamm"]').fill('1000');
	await abschicken(ef2.locator('button[type="submit"]'));

	await seite.goto(`${ZIEL}/versammlungen/neu`, { waitUntil: 'domcontentloaded' });
	await seite.locator('input[name="art"][value="gemeinsam"]').check();
	await seite.waitForTimeout(150);
	await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
	await seite.locator(`input[name="gemeinschaft"][value="${zweite}"]`).check();
	// Der Abend hat eine eigene Bezeichnung — ohne sie bleibt das Formular stehen,
	// stumm: Die native Prüfung des Browsers schreibt nichts in `.meldung`.
	await seite.fill('input[name="bezeichnung"]', `Abend ${LAUF}`);
	await seite.fill('input[name="datum"]', '2027-09-21');
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', 'Prüfsaal gemeinsam');
	await abschicken(seite.locator('button[form="anlegen"]').first());
	const tag = seite.url().split('/tage/')[1]?.split(/[/?#]/)[0];

	if (tag) {
		await miss('Abend', `/tage/${tag}`);
		await miss('Abend: Stammdaten', `/tage/${tag}/stammdaten`);
		await miss('Abend: Haeuser', `/tage/${tag}/haeuser`);
		await miss('Abend: Geschaefte', `/tage/${tag}/geschaefte`);
		await miss('Abend: Einlass', `/tage/${tag}/einlass`);
		await miss('Abend: Vollmachten', `/tage/${tag}/vollmachten`);
		await miss('Abend: Siegel', `/tage/${tag}/siegel`);
		await miss('Abend: Sitzungsleitung', `/tage/${tag}/leitung`);
		await miss('Abend: Protokoll', `/tage/${tag}/protokoll`);
	} else {
		/*
		 * **Kein stilles Ueberspringen.** Ein Waechter, der neun Seiten weglaesst
		 * und trotzdem «alle in Ordnung» meldet, ist schlimmer als keiner.
		 */
		befunde.push('Der gemeinsame Abend liess sich nicht anlegen — neun Seiten ungeprueft');
		console.log('  ✗ Gemeinsamer Abend liess sich nicht anlegen');
	}

	// Der Zugangscode ist die zweite lange Zeichenkette ohne Leerstelle.
	await miss('Anwesenheit mit Ausgabecode', `/versammlungen/${versammlung}/anwesenheit`, async () => {
		const f = seite.locator('form[action="?/codeAusgeben"]');
		if (await f.count()) await abschicken(f.first().locator('button[type="submit"]'));
	});

	// Und die Seite des Eigentümers — ohne Anmeldung, eigener Kontext.
	const gast = await browser.newContext({ viewport: { width: BREITE, height: 844 } });
	const gastseite = await gast.newPage();
	warteNachNavigation(gastseite);
	geprueft++;
	await gastseite.goto(`${ZIEL}/z`, { waitUntil: 'domcontentloaded' });
	await gastseite.waitForTimeout(300);
	const querGast = await gastseite.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	if (querGast > 0) {
		befunde.push(`Eigentümerzugang (/z): Seite läuft ${querGast} px quer`);
		console.log(`  ✗ Eigentümerzugang — ${querGast} px quer`);
	} else {
		console.log('  ✓ Eigentümerzugang');
	}
	await gast.close();

	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}`);
} finally {
	await browser.close();
}

console.log('');
if (befunde.length > 0) {
	console.log(`${befunde.length} von ${geprueft} Seiten laufen quer:`);
	for (const b of befunde) console.log(`  · ${b}`);
	process.exit(1);
}
console.log(`Alle ${geprueft} Seiten passen auf ${BREITE} px (drei davon auch auf ${SCHMAL}).`);
