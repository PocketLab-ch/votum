/**
 * Baut einen Musterbestand für den Laientest am Eingang.
 *
 * **Wozu.** `docs/pruefung/usability-drehbuch-eingang.md` verlangt eine Bühne,
 * die von Hand aufzubauen eine Stunde kostet: eine **laufende** Versammlung,
 * Betriebsart `gefuehrt`, die Frage «digital oder von Hand» eingeschaltet,
 * genug Parteien, damit jede Situation ihre eigene verbrauchen kann, und für
 * Teil D einen gemeinsamen Abend mit zwei Häusern, in einem davon die Frage
 * abgeschaltet. Wer das von Hand aufbaut, kennt die Anwendung danach zu gut, um
 * sie noch selbst zu testen.
 *
 * **Kein Prüflauf.** Dieses Skript behauptet nichts über die Anwendung; es
 * benutzt sie. Ein Schritt, der nicht durchgeht, bricht den Lauf ab, statt den
 * Fehler zu sammeln: Ein halb gebauter Bestand sieht fertig aus und fällt erst
 * beim Test auf, und dann als Befund gegen die Anwendung.
 *
 * **Der Bestand bleibt stehen.** Die Namen tragen keines der acht Muster aus
 * `scripts/testdaten-entfernen.sql`, das gewöhnliche Aufräumen nimmt sie also
 * nicht mit. Das ist Absicht und zugleich die Kehrseite: Ein zweiter Lauf legt
 * einen zweiten Bestand an. Deshalb prüft der erste Schritt, ob die
 * Gemeinschaft schon steht, und bricht ab statt zu verdoppeln. Wer bewusst
 * einen zweiten Satz will, hängt ihn mit `ZUSATZ` auseinander:
 *
 *     ZUSATZ=II node e2e/mustergemeinschaft.mjs
 *
 * Weg ist er über `scripts/testdaten-entfernen.sql` im Alles-Modus (der nimmt
 * auch den echten Bestand mit, siehe den Kopf dort) oder je Gemeinschaft von
 * Hand über die Oberfläche.
 *
 * **Aufruf** (Umgebung wie `e2e/durchspielen.mjs`):
 *
 *     node e2e/mustergemeinschaft.mjs
 *     OHNE_ABEND=1 node e2e/mustergemeinschaft.mjs   # nur das Haus, ohne Teil D
 *
 * Am Schluss stehen die Adressen auf dem Bildschirm, die der Test braucht.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';
import { umgebungsbefund } from './umgebung.mjs';

import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const ZUSATZ = process.env.ZUSATZ ? ` ${process.env.ZUSATZ}` : '';
/** Der Zusatz als Wegstück: `ZUSATZ=II` legt nach `…/musterbestand-ii`. */
const ZUSATZWEG = ZUSATZ ? `-${ZUSATZ.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
/**
 * Wohin die Zugangskarten gelegt werden. Von dort werden sie gedruckt.
 *
 * **Je Satz ein eigener Ordner** (11.09.2026, im Code-Review gefunden): Sonst
 * überschriebe ein zweiter Lauf mit `ZUSATZ` die drei PDFs des ersten, und die
 * Codes darin wären weg. Die Datenbank hält nur den Prüfwert, nicht den Code.
 */
const ABLAGE = process.env.ABLAGE ?? `/tmp/musterbestand${ZUSATZWEG}`;
const MIT_ABEND = process.env.OHNE_ABEND !== '1';

/**
 * Heute, in **Ortszeit**. Die Versammlung soll laufen, während jemand davorsitzt.
 *
 * **Nicht `toISOString()`** (11.09.2026, im Code-Review gefunden): Das liefert
 * UTC, und zwischen Mitternacht und zwei Uhr Ortszeit entstünde die Versammlung
 * auf den Vortag. Die Zuordnungen gelten ab heute; die Freigabe rechnet auf den
 * Versammlungstag und meldete dann alle siebzehn Einheiten als «ohne
 * Eigentümer». Der Lauf bräche ab, nachdem Gemeinschaft, Einheiten, Eigentümer
 * und Traktanden schon stehen.
 */
const HEUTE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

const HAUS = `STWEG Musterstrasse 12${ZUSATZ}`;
const ABEND_A = `STWEG Musterweg 3${ZUSATZ}`;
const ABEND_B = `STWEG Musterweg 5${ZUSATZ}`;

/*
 * **Siebzehn Einheiten, Summe genau 1000.** Das Drehbuch verlangt mindestens
 * zehn Parteien; gezählt über Teil B und C sind es siebzehn, die wirklich
 * verbraucht werden (sieben Situationen mit je einer, drei Vertretene, eine
 * dritte Person, zwei für die Häkchenliste, drei für die Nachtragsliste). Wer
 * hier kürzt, merkt es nicht am Aufbau, sondern mitten im Test.
 */
const EINHEITEN = [
	{ label: 'EG links, 3.5 Zimmer', quote: 48, wer: 'Ammann Beatrice' },
	{ label: 'EG rechts, 4.5 Zimmer', quote: 60, wer: 'Berger Thomas' },
	{ label: 'EG Gartenwohnung, 2.5 Zimmer', quote: 44, wer: 'Blaser Rita' },
	{ label: '1. OG links, 3.5 Zimmer', quote: 52, wer: 'Bühlmann Marcel' },
	{ label: '1. OG rechts, 4.5 Zimmer', quote: 64, wer: 'Eggimann Sandra' },
	{ label: '1. OG Mitte, 2.5 Zimmer', quote: 46, wer: 'Fankhauser Peter' },
	{ label: '2. OG links, 3.5 Zimmer', quote: 52, wer: 'Gerber Nicole' },
	{ label: '2. OG rechts, 4.5 Zimmer', quote: 64, wer: 'Hofer Daniel' },
	{ label: '2. OG Mitte, 2.5 Zimmer', quote: 46, wer: 'Imhof Claudia' },
	{ label: '3. OG links, 3.5 Zimmer', quote: 54, wer: 'Kaufmann Stefan' },
	{ label: '3. OG rechts, 4.5 Zimmer', quote: 66, wer: 'Lüthi Monika' },
	{ label: '3. OG Mitte, 2.5 Zimmer', quote: 48, wer: 'Marti Andreas' },
	{ label: '4. OG links, 3.5 Zimmer', quote: 54, wer: 'Neuenschwander Barbara' },
	{ label: '4. OG rechts, 4.5 Zimmer', quote: 66, wer: 'Roth Christian' },
	{ label: '4. OG Mitte, 2.5 Zimmer', quote: 48, wer: 'Schneider Esther' },
	{ label: 'Attika Süd, 4.5 Zimmer', quote: 92, wer: 'Wenger Ueli' },
	{ label: 'Attika Nord, 4.5 Zimmer', quote: 96, wer: 'Zbinden Franziska' }
];

/*
 * **Die Sachtraktanden.** Die acht Pflichttraktanden (Begrüssung, Stimmenzähler,
 * Protokoll, Revisionsbericht, Jahresrechnung, Décharge, Budget,
 * Erneuerungsfonds) entstehen ohne Zutun, siehe `domain/traktandenvorlage.ts`.
 * Was hier dazukommt, ist das, was eine Versammlung von einer Vorlage
 * unterscheidet: fünf Geschäfte mit fünf verschiedenen Erfordernissen, damit
 * die Liste im Test nicht wie ein Formular aussieht.
 */
const TRAKTANDEN = [
	{
		titel: 'Sanierung der Flachdächer über den Attikawohnungen',
		erfordernis: 'k-baulich-notwendig',
		wortlaut:
			'Die Versammlung beschliesst die Sanierung der Flachdächer über den Attikawohnungen zu einem Kostendach von 180 000 Franken, zulasten des Erneuerungsfonds.'
	},
	{
		titel: 'Ladestationen für Elektrofahrzeuge in der Einstellhalle',
		erfordernis: 'k-baulich-nuetzlich',
		wortlaut:
			'Die Versammlung beschliesst den Einbau einer Grundinstallation für Ladestationen in der Einstellhalle zu einem Kostendach von 65 000 Franken.'
	},
	{
		titel: 'Anpassung der Hausordnung: Mittagsruhe',
		erfordernis: 'k-hausordnung',
		wortlaut:
			'Die Versammlung beschliesst, die Hausordnung um eine Mittagsruhe von 12.00 bis 13.00 Uhr zu ergänzen.'
	},
	{
		titel: 'Wahl der Bewirtschaftung für die Jahre 2027 bis 2029',
		erfordernis: 'k-bewirtschaftung-waehlen',
		wortlaut:
			'Die Versammlung wählt die bisherige Bewirtschaftung für die Jahre 2027 bis 2029 wieder.'
	},
	{
		titel: 'Benutzung des Veloraums',
		erfordernis: 'k-benutzungsweise',
		wortlaut:
			'Die Versammlung beschliesst, dass im Veloraum je Einheit höchstens zwei Velos abgestellt werden.'
	},
	{ titel: 'Verschiedenes', art: 'kenntnisnahme' }
];

/** Die beiden kleinen Häuser für Teil D. «Dürig Anita» steht in beiden. */
const ABENDHAUS_A = [
	{ label: 'Whg 1', quote: 200, wer: 'Aeschlimann Urs' },
	{ label: 'Whg 2', quote: 180, wer: 'Brand Silvia' },
	{ label: 'Whg 3', quote: 170, wer: 'Christen Markus' },
	{ label: 'Whg 4', quote: 160, wer: 'Dürig Anita' },
	{ label: 'Whg 5', quote: 150, wer: 'Frei Robert' },
	{ label: 'Whg 6', quote: 140, wer: 'Gasser Heidi' }
];
const ABENDHAUS_B = [
	{ label: 'Whg 1', quote: 200, wer: 'Dürig Anita', verknuepfen: true },
	{ label: 'Whg 2', quote: 180, wer: 'Hostettler Kurt' },
	{ label: 'Whg 3', quote: 170, wer: 'Jaggi Petra' },
	{ label: 'Whg 4', quote: 160, wer: 'Kummer Beat' },
	{ label: 'Whg 5', quote: 150, wer: 'Lanz Ruth' },
	{ label: 'Whg 6', quote: 140, wer: 'Moser Felix' }
];

let nummer = 0;
/**
 * Ob schon Bestand entstanden ist.
 *
 * Nur dann ist der Satz am Schluss wahr, es liege etwas Halbes herum. Bricht
 * der Lauf an der Anmeldung oder am Doppelwächter ab, ist nichts angelegt, und
 * die Aufforderung zum Aufräumen schickte den Leser auf eine falsche Fährte.
 */
let etwasGebaut = false;

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

/** Ein Schritt, der scheitert, beendet den Aufbau. Halb gebaut ist schlimmer als gar nicht. */
async function schritt(titel, arbeit) {
	nummer += 1;
	const marke = String(nummer).padStart(2, '0');
	const zusatz = await arbeit();
	console.log(`  ${marke} ✓ ${titel}${zusatz ? ` — ${zusatz}` : ''}`);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const seite = await kontext.newPage();
warteNachNavigation(seite);

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

/** Abschicken und auf die Antwort warten, nicht auf eine Frist. */
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
	await seite.waitForTimeout(250);
}

async function warteAuf(ort, was, frist = 20000) {
	await ort
		.first()
		.waitFor({ state: 'visible', timeout: frist })
		.catch(() => {
			throw new Error(`${was} erschien nicht`);
		});
}

/**
 * Eine Auswahl nach dem Anfang ihres Textes treffen.
 *
 * Nicht `selectOption({ label })`: Die Einträge tragen Zusätze («Whg 1, frei»),
 * und ein Vergleich auf Gleichheit findet sie nie.
 */
async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

/** Klickt, bis der Ausklapper wirklich offen ist. Vor der Hydration verpufft der erste Klick. */
async function klickeBis(ausloeser, ziel) {
	for (let i = 0; i < 8; i += 1) {
		if (await ziel.first().isVisible().catch(() => false)) return;
		await ausloeser.first().click().catch(() => {});
		await seite.waitForTimeout(300);
	}
	await warteAuf(ziel, 'Das ausgeklappte Formular');
}

/**
 * Legt eine Gemeinschaft mit ihren Einheiten und Eigentümern an.
 *
 * `verknuepfen` hängt eine Partei an eine **bestehende** Person: Die Seite
 * bietet das von selbst an, sobald eine neue Zeile denselben Namen trägt. Genau
 * diese Klammer braucht Teil D3, wo jemand in zwei Häusern stimmberechtigt ist.
 */
async function legeGemeinschaftAn(name, einheiten, zaehlweise = 'per_owner') {
	await gehe('/gemeinschaften/neu');
	await seite.fill('input[name="name"]', name);
	await seite.fill('input[name="quotaDenominator"]', '1000');
	await seite.locator(`input[name="headCountMode"][value="${zaehlweise}"]`).check();
	const fundstelle = seite.locator('input[name="headCountRuleSource"]');
	if (await fundstelle.count()) await fundstelle.fill('Musterreglement Ziff. 14');
	await abschicken(seite.locator('main button[type="submit"]').first());

	etwasGebaut = true;
	const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
	// `id !== 'neu'` ist der eigentliche Prüfstein: Bleibt das Formular stehen,
	// ist die Kennung die Zeichenkette «neu» und alles Weitere liefe ins Leere.
	behaupte(id && id !== 'neu', `${name} nicht angelegt, Adresse ${seite.url()}`);

	for (const e of einheiten) {
		await gehe(`/gemeinschaften/${id}/einheiten`);
		const ef = seite.locator('form[action$="anlegen"]').first();
		await ef.locator('input[name="label"]').fill(e.label);
		await ef.locator('input[name="quote.stamm"]').fill(String(e.quote));
		await abschicken(ef.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const pf = seite.locator('form[action$="anlegen"]').first();
		if (e.verknuepfen) {
			/*
			 * **Die Klammer wird beim Anlegen gesetzt, nicht danach** (11.09.2026,
			 * am eigenen Skript gemessen). Der erste Anlauf legte die Zeile an und
			 * wartete auf den Vorschlag «Als dieselbe Person führen». Der kommt
			 * nie: Jede neue Eigentümerzeile legt von sich aus eine Person an, und
			 * danach gibt es zwei gleichnamige. Der Vorschlag verlangt aber genau
			 * eine, denn bei zweien kann die Anwendung nicht wissen, welche gemeint
			 * ist. Er ist für Zeilen gedacht, die **ohne** Person entstanden sind,
			 * etwa aus einem Dateiimport.
			 */
			const wahl = pf.locator('select[name="personwahl"]');
			behaupte(
				await wahl.count(),
				'Das Formular bietet keine Wahl zwischen neuer und bestehender Person'
			);
			await wahl.selectOption('bestehend');
			const person = pf.locator('select[name="personId"]');
			await warteAuf(person, `Die Auswahl der bestehenden Person «${e.wer}»`);
			await waehleNachAnfang(person, e.wer);
		}
		const nameFeld = pf.locator('input[name="displayName"]');
		if (await nameFeld.isVisible().catch(() => false)) await nameFeld.fill(e.wer);
		await abschicken(pf.locator('button[type="submit"]'));

		await gehe(`/gemeinschaften/${id}/eigentuemer`);
		const zf = seite.locator('form[action$="zuordnen"]').last();
		await waehleNachAnfang(zf.locator('select[name="unitId"]'), e.label);
		await waehleNachAnfang(zf.locator('select[name="partyId"]'), e.wer);
		await abschicken(zf.locator('button[type="submit"]'));
	}
	return id;
}

/**
 * Erzeugt die Zugangskarten und legt das PDF ab.
 *
 * **Ein POST, kein Aufruf einer Adresse.** `karten.pdf` kennt nur POST, und das
 * ist kein Schönheitsfehler: Der Aufruf **erzeugt** Zugänge, er holt sie nicht
 * ab. Eine Adresse, die beim Anklicken Codes vergibt, würde von jedem
 * Vorschaubild und jedem Linkprüfer ausgelöst.
 *
 * Über `seite.request` und nicht über einen Klick: Der Klick lieferte einen
 * Download, den das Drehbuch erst wieder einfangen müsste. Die Kopfzeile
 * `origin` gehört dazu, sonst weist SvelteKits Schutz gegen fremde Formulare
 * den Aufruf ab.
 */
async function erzeugeKarten(vId, dateiname) {
	const antwort = await seite.request.post(`${ZIEL}/versammlungen/${vId}/zugaenge/karten.pdf`, {
		form: { form: 'sammel' },
		headers: { origin: ZIEL }
	});
	behaupte(
		antwort.ok(),
		`Die Karten liessen sich nicht erzeugen: ${antwort.status()} ${(await antwort.text()).slice(0, 200)}`
	);
	const inhalt = await antwort.body();
	behaupte(
		inhalt.subarray(0, 4).toString() === '%PDF',
		`Was zurückkam, ist kein PDF: ${inhalt.subarray(0, 40).toString()}`
	);
	const pfad = `${ABLAGE}/${dateiname}`;
	await writeFile(pfad, inhalt, { mode: 0o600 });
	await chmod(pfad, 0o600);
	return { pfad, groesse: inhalt.length };
}

/** Legt eine einzelne Versammlung dieser Gemeinschaft auf heute. */
async function legeVersammlungAn(stwegId, ort) {
	await gehe(`/gemeinschaften/${stwegId}/versammlungen/neu`);
	await seite.fill('input[name="datum"]', HEUTE);
	await seite.fill('input[name="uhrzeit"]', '19:00');
	await seite.fill('input[name="ort"]', ort);
	await abschicken(seite.locator('button[form="anlegen"]'));
	const id = seite.url().match(/versammlungen\/([0-9a-f-]{36})/)?.[1];
	behaupte(id, `Keine Versammlung angelegt, Adresse ${seite.url()}`);
	return id;
}

try {
	/*
	 * **Nur für den Besitzer lesbar.** In den Karten stehen die Zugangscodes im
	 * Klartext, und `/tmp` ist für alle lesbar. `mkdir` allein reicht nicht: Die
	 * Rechtemaske der Sitzung zieht davon ab, also wird danach ausdrücklich
	 * gesetzt. Dieselbe Überlegung wie bei den Geheimnisordnern im Betrieb, wo
	 * die Sperre das 0700-Verzeichnis ist und nicht die Datei darin.
	 */
	await mkdir(ABLAGE, { recursive: true, mode: 0o700 });
	await chmod(ABLAGE, 0o700);
	console.log(`\nMusterbestand für den Eingangstest — ${ZIEL}\n`);

	let hausId;
	let versammlungId;
	let tag;
	const abend = {};

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
		return `als ${BENUTZER}`;
	});

	await schritt('Nachsehen, ob der Musterbestand schon steht', async () => {
		await gehe('/gemeinschaften');
		/*
		 * **Erst suchen, dann lesen** (11.09.2026, im Code-Review gefunden). Die
		 * Liste zeigt ohne Suchbegriff höchstens fünfundzwanzig Zeilen
		 * (`LISTENGRENZE`), und auf dem Dev-Host stehen mehr. Ein blosser Blick auf den
		 * Seitentext hätte ab der sechsundzwanzigsten Gemeinschaft «noch nicht
		 * vorhanden» gemeldet und einen zweiten vollständigen Musterbestand
		 * angelegt, den das gewöhnliche Aufräumen nicht wegnimmt.
		 *
		 * Das Suchfeld steht erst ab neun Einträgen. Darunter gibt es keine
		 * Kürzung, dann genügt der Seitentext.
		 *
		 * **Was auch das nicht sieht: eine archivierte Gemeinschaft.** Die Liste
		 * blendet das Archiv aus, bis jemand den Schalter umlegt. Wer einen
		 * Musterbestand archiviert und danach neu baut, bekommt zwei; das ist
		 * kein Weg, den dieser Aufbau nimmt, und den Schalter zu bedienen wäre
		 * mehr Maschinerie als der Fall wert ist.
		 */
		const suchfeld = seite.locator('.suchleiste input[type="search"]');
		if (await suchfeld.count()) {
			await suchfeld.fill(HAUS);
			await seite.waitForTimeout(500);
		}
		/*
		 * **Die Zeilen zählen, nicht den Seitentext lesen.** Der erste Anlauf
		 * dieser Korrektur las `main` und schlug auch bei leerem Bestand an: Bei
		 * erfolgloser Suche schreibt die Seite den Suchbegriff in ihre eigene
		 * Meldung («Keine Gemeinschaft passt zu «…»»). Der Wächter fand damit
		 * seinen eigenen Anschlag wieder, und zwar genau dann, wenn nichts da ist.
		 */
		const zeile = seite.locator('ul.liste li span.name', { hasText: HAUS });
		behaupte(
			(await zeile.count()) === 0,
			`«${HAUS}» steht schon im Bestand. Ein zweiter Lauf legte sie ein zweites Mal an. ` +
				'Entweder die bestehende benutzen oder mit ZUSATZ=II einen eigenen Satz bauen.'
		);
		return 'noch nicht vorhanden';
	});

	await schritt(`${HAUS}: 17 Einheiten, 17 Eigentümer`, async () => {
		hausId = await legeGemeinschaftAn(HAUS, EINHEITEN);
		await gehe(`/gemeinschaften/${hausId}/einheiten`);
		/*
		 * **Den Saldo lesen, nicht die Zahl** (11.09.2026, im Code-Review
		 * gefunden). Vorher stand hier «enthält 1000» — und der Nenner steht am
		 * Anlegeformular ohnehin auf jeder Seite. Die Zusicherung konnte gar nicht
		 * rot werden; eine fehlgeschlagene Einheit wäre durchgegangen und hätte
		 * «Summe 1000» gemeldet. Der Satz der Anwendung lautet «… 1000 von 1000,
		 * geht auf», und genau der wird jetzt verlangt.
		 */
		const soll = EINHEITEN.reduce((summe, e) => summe + e.quote, 0);
		const t = await seite.locator('main').innerText();
		behaupte(
			t.includes(`${soll} von ${soll}`) && t.includes('geht auf'),
			`Die Stammquote geht nicht auf ${soll} auf: ${t.slice(0, 300)}`
		);
		return `Summe ${soll}, eine Kopfstimme je Eigentümer`;
	});

	await schritt('Versammlung auf heute, 19.00 Uhr', async () => {
		/*
		 * **Die Betriebsart wird hier NICHT gesetzt, und das ist kein Versäumnis.**
		 * Sie lässt sich erst zwischen Freigabe und Eröffnung umstellen (davor
		 * steht auf der Seite «Ab der Eröffnung nicht mehr umstellbar», davor gar
		 * nichts), und die Vorgabe leitet sich ohnehin aus der Parteizahl ab:
		 * `betriebsartVorschlag` schlägt ab sechs Parteien «geführt» vor. Bei
		 * siebzehn kommt sie also von selbst richtig heraus. Nachgesehen wird
		 * trotzdem, nach der Freigabe.
		 */
		versammlungId = await legeVersammlungAn(hausId, 'Quartiersaal Musterstrasse, 3000 Bern');
		return `${HEUTE}, 19.00 Uhr`;
	});

	await schritt('Sechs Sachtraktanden neben den acht Pflichttraktanden', async () => {
		for (const t of TRAKTANDEN) {
			await gehe(`/versammlungen/${versammlungId}/traktanden`);
			const aufklappen = seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = seite.locator('form[action="?/anlegen"]');
			await klickeBis(aufklappen, anlegen);

			await anlegen.locator('input[name="titel"]').fill(t.titel);
			/*
			 * **Die Art ist ein Knopfpaar, keine Auswahlliste** (11.09.2026, am
			 * eigenen Skript gefunden). Ein `select[name="art"]` gibt es nicht; der
			 * erste Anlauf fragte danach, fand nichts, übersprang die Wahl still
			 * und legte «Verschiedenes» als Abstimmung an. Die wies das Formular ab,
			 * und der Befund kam einen Schritt später als «13 statt 14».
			 *
			 * Wiederholen statt einmal klicken: Vor der Hydration führt Svelte den
			 * Zustand noch nicht, und der Klick verpufft.
			 */
			const art = anlegen.locator(`input[name="art"][value="${t.art ?? 'abstimmung'}"]`);
			for (let i = 0; i < 10 && !(await art.isChecked()); i += 1) {
				await art.check().catch(() => {});
				await seite.waitForTimeout(200);
			}
			behaupte(await art.isChecked(), `Die Art «${t.art ?? 'abstimmung'}» liess sich nicht wählen`);
			if (t.erfordernis) {
				await anlegen.locator('select[name="erfordernis"]').selectOption(t.erfordernis);
			}
			const wortlaut = anlegen.locator('[name="antragswortlaut"]');
			if ((await wortlaut.count()) && t.wortlaut) await wortlaut.fill(t.wortlaut);
			await abschicken(anlegen.locator('button[type="submit"]').first());
		}
		await gehe(`/versammlungen/${versammlungId}/traktanden`);
		const anzahl = await seite.locator('li[data-traktandum]').count();
		behaupte(anzahl >= 14, `Die Liste führt ${anzahl} statt mindestens 14 Traktanden`);
		return `${anzahl} Traktanden`;
	});

	await schritt('Freigeben und eröffnen', async () => {
		await gehe(`/versammlungen/${versammlungId}/freigabe`);
		const frei = seite.locator('main button[type="submit"]').first();
		// Steht etwas entgegen, nennt die Seite es. Das gehört in die Meldung,
		// nicht in einen Zeitüberschritt drei Zeilen weiter unten.
		if (!(await frei.isVisible().catch(() => false))) {
			throw new Error(`Freigabe nicht möglich: ${(await seite.locator('main').innerText()).slice(0, 400)}`);
		}
		await abschicken(frei);

		/*
		 * **Jetzt, und nur jetzt, lässt sich die Betriebsart noch umstellen.**
		 * Das versteckte Feld trägt den **Gegen**wert: Steht dort «einfach», würde
		 * ein Druck dorthin umstellen, die Versammlung läuft also bereits
		 * geführt. Wer den Knopftext liest, liest die Handlung und nicht den
		 * Zustand.
		 */
		await gehe(`/versammlungen/${versammlungId}`);
		const wechsel = seite.locator('form[action="?/betriebsart"]');
		await warteAuf(wechsel, 'Der Schalter für die Betriebsart');
		if ((await wechsel.locator('input[name="betriebsart"]').inputValue()) === 'gefuehrt') {
			await abschicken(wechsel.locator('button[type="submit"]'));
			await gehe(`/versammlungen/${versammlungId}`);
		}
		behaupte(
			(await seite
				.locator('form[action="?/betriebsart"] input[name="betriebsart"]')
				.inputValue()) === 'einfach',
			'Die Versammlung steht nicht auf «geführt». Ohne sie gibt es die Frage am Eingang nicht.'
		);

		const eroeffnen = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		await warteAuf(eroeffnen, 'Der Knopf zum Eröffnen');
		await abschicken(eroeffnen);

		await gehe(`/versammlungen/${versammlungId}`);
		behaupte(/laufend/i.test(await seite.locator('main').innerText()), 'Die Versammlung läuft nicht');
		return 'laufend, geführt';
	});

	await schritt('Die Frage «digital oder von Hand» steht eingeschaltet', async () => {
		await gehe(`/versammlungen/${versammlungId}`);
		const form = seite.locator('form[action="?/papierfrage"]');
		await warteAuf(form, 'Der Schalter für die Papierfrage');
		/*
		 * Das versteckte Feld trägt den **Gegen**wert: «nein» heisst, dass ein
		 * Druck auf den Knopf abschalten würde, die Frage also an ist. Wer den
		 * Knopftext liest, liest die Handlung und nicht den Zustand.
		 */
		const gegenwert = await form.locator('input[name="fragen"]').inputValue();
		if (gegenwert === 'ja') await abschicken(form.locator('button[type="submit"]'));
		await gehe(`/versammlungen/${versammlungId}`);
		behaupte(
			(await seite.locator('form[action="?/papierfrage"] input[name="fragen"]').inputValue()) ===
				'nein',
			'Die Frage liess sich nicht einschalten'
		);
		return 'eingeschaltet';
	});

	await schritt('Zugangskarten erzeugen und ablegen', async () => {
		const k = await erzeugeKarten(versammlungId, `karten-musterstrasse-12${ZUSATZWEG}.pdf`);
		return `${k.pfad}, ${Math.round(k.groesse / 1024)} kB`;
	});

	if (MIT_ABEND) {
		await schritt(`${ABEND_A} und ${ABEND_B}, je 6 Parteien`, async () => {
			abend.a = await legeGemeinschaftAn(ABEND_A, ABENDHAUS_A);
			abend.b = await legeGemeinschaftAn(ABEND_B, ABENDHAUS_B);
			return 'Dürig Anita steht in beiden Häusern';
		});

		await schritt('Ein gemeinsamer Abend, geführt, vor der Zuordnung gesetzt', async () => {
			await gehe('/versammlungen/neu');
			await seite.locator('input[name="art"][value="gemeinsam"]').check();
			await seite.fill('input[name="bezeichnung"]', `Musterabend Musterweg${ZUSATZ}`);
			await seite.fill('input[name="datum"]', HEUTE);
			await seite.fill('input[name="uhrzeit"]', '19:00');
			await seite.fill('input[name="ort"]', 'Foyer Musterweg, 3000 Bern');
			await abschicken(seite.locator('button[form="anlegen"]'));
			behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
			tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];

			/*
			 * **Die Betriebsart gehört an den Abend, und zwar VOR die Zuordnung.**
			 * Sie je Versammlung zu wählen ist wirkungslos (die Zuordnung
			 * überschreibt sie hart), und sie danach umzustellen erreicht die schon
			 * zugeordneten Häuser nicht.
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
			return HEUTE;
		});

		await schritt('Je Haus eine Versammlung, dem Abend zugeordnet', async () => {
			for (const [marke, stwegId] of [
				['a', abend.a],
				['b', abend.b]
			]) {
				const id = await legeVersammlungAn(stwegId, 'Foyer Musterweg, 3000 Bern');
				abend[`v${marke}`] = id;
				await gehe(`/versammlungen/${id}`);
				// Nach der Kennung wählen, nicht nach dem Namen: Im Bestand stehen
				// ähnlich benannte Abende, und ein Treffer daneben fiele erst im Saal auf.
				await seite.locator('select[name="tag"]').first().selectOption(tag);
				await abschicken(seite.locator('button[form="angaben"]'));
				behaupte(
					(await seite.locator('select[name="tag"]').first().inputValue()) === tag,
					`${marke.toUpperCase()} wurde dem Abend nicht zugeordnet`
				);
			}
			behaupte(abend.va !== abend.vb, 'Beide Häuser führen auf dieselbe Versammlung');
			return 'zwei Häuser an einem Abend';
		});

		await schritt('Beide freigeben und vom Eingang aus eröffnen', async () => {
			await gehe(`/tage/${tag}/freigeben`);
			const alle = seite.locator('form[action="?/alle"] button[type="submit"]');
			await warteAuf(alle, 'Die Sammelfreigabe des Abends');
			await abschicken(alle);
			await gehe(`/tage/${tag}/einlass`);
			const eroeffnen = seite.locator('form[action="?/eroeffnen"] button').first();
			await warteAuf(eroeffnen, 'Der Knopf zum Eröffnen am Eingang');
			await abschicken(eroeffnen);
			await gehe(`/tage/${tag}/einlass`);
			const zeilen = await seite.locator('tbody tr').count();
			behaupte(zeilen >= 12, `Die Liste des Abends führt ${zeilen} statt 12 Zeilen`);
			return `${zeilen} Zeilen`;
		});

		await schritt(`In ${ABEND_B} wird die Frage abgeschaltet (Teil D5)`, async () => {
			await gehe(`/versammlungen/${abend.vb}`);
			const form = seite.locator('form[action="?/papierfrage"]');
			await warteAuf(form, 'Der Schalter für die Papierfrage');
			if ((await form.locator('input[name="fragen"]').inputValue()) === 'nein') {
				await abschicken(form.locator('button[type="submit"]'));
			}
			await gehe(`/versammlungen/${abend.vb}`);
			behaupte(
				(await seite.locator('form[action="?/papierfrage"] input[name="fragen"]').inputValue()) ===
					'ja',
				'Die Frage liess sich nicht abschalten'
			);
			return 'Haus A fragt, Haus B nicht';
		});

		await schritt('Zugangskarten für beide Häuser des Abends', async () => {
			const a = await erzeugeKarten(abend.va, `karten-musterweg-3${ZUSATZWEG}.pdf`);
			const b = await erzeugeKarten(abend.vb, `karten-musterweg-5${ZUSATZWEG}.pdf`);
			return `${a.pfad} · ${b.pfad}`;
		});
	}

	// ── Was der Test jetzt braucht ──────────────────────────────────────────
	const zeilen = [
		'',
		'Bereit. Was der Test braucht:',
		'',
		'  Teil A bis C, das einzelne Haus',
		`    Eingang        ${ZIEL}/versammlungen/${versammlungId}/anwesenheit`,
		`    Schalter       ${ZIEL}/versammlungen/${versammlungId}   (Teil C1, absichtlich nicht am Eingang)`,
		`    Leinwand       ${ZIEL}/versammlungen/${versammlungId}/praesentation`,
		`    Sitzungsleitung ${ZIEL}/versammlungen/${versammlungId}/leitung`,
		`    Karten         ${ABLAGE}/karten-musterstrasse-12${ZUSATZWEG}.pdf`
	];
	if (MIT_ABEND) {
		zeilen.push(
			'',
			'  Teil D, der gemeinsame Abend',
			`    Eingang        ${ZIEL}/tage/${tag}/einlass`,
			`    Karten ${ABEND_A}  ${ABLAGE}/karten-musterweg-3${ZUSATZWEG}.pdf`,
			`    Karten ${ABEND_B}  ${ABLAGE}/karten-musterweg-5${ZUSATZWEG}.pdf`,
			'    Dürig Anita ist in beiden Häusern stimmberechtigt (D3).',
			`    In ${ABEND_B} ist die Frage abgeschaltet (D5).`
		);
	}
	zeilen.push(
		'',
		'Die Karten sind erzeugt und liegen als PDF bereit. Sie gehören ausgedruckt',
		'und als Stapel auf den Tisch: Codes vom Bildschirm abzutippen misst etwas',
		'anderes als den Eingang.',
		'',
		'Die Karten NICHT selbst im Browser öffnen. Ein Zugang bindet sich beim',
		'ersten Öffnen an das Gerät, das ihn öffnet, und die Testperson bekommt',
		'danach eine Absage.',
		'',
		'Drehbuch: docs/pruefung/usability-drehbuch-eingang.md',
		''
	);
	console.log(zeilen.join('\n'));
} catch (e) {
	console.log(`\n  ✗ Abbruch — ${e.message}`);
	console.log(umgebungsbefund(e.message));
	if (etwasGebaut) {
		console.log(
			'\nWas bis hierher entstanden ist, steht in der Anwendung und muss von Hand\n' +
				'weggeräumt oder weitergebaut werden. Ein halber Musterbestand taugt nicht\n' +
				'für den Test.'
		);
	}
	await browser.close();
	process.exit(1);
}

await browser.close();
