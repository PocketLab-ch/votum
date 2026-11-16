/**
 * Eine Sitzung führen — vorwärts, rückwärts, und zurück auf ein Geschäft.
 *
 * **Der Anlass, am 20.08.2026.** Gemeldet nach einem Durchgang im eigenen
 * Browser: «Zu diesem Traktandum steht bereits ein Rückkommensantrag. — Wenn
 * ein Rückkommensantrag steht, müssten doch die Teilnehmer darüber abstimmen
 * können. Wie du siehst, funktioniert das nicht.»
 *
 * Es funktionierte auch nicht, und zwar nicht wegen eines Rechenfehlers: Der
 * Rückkommensantrag stand als Traktandum ganz unten in der Liste, und keine
 * Zeile der Oberfläche sagte, dass er dort steht und aufgerufen werden will.
 * Am behandelten Geschäft stand stattdessen der Knopf «Abstimmung freigeben»,
 * der jedes Mal in dieselbe rote Absage führte.
 *
 * **Was hier geprüft wird — aus der Sicht dreier Menschen, die das Programm
 * nicht kennen:**
 *
 *   Leitung        das Notebook: ruft auf, gibt frei, schliesst, verkündet
 *   Telefon A/B    zwei Eigentümer, die abstimmen wollen
 *   Beamer         die Wand, die nie zu früh etwas verrät
 *
 * und zwar über die drei Bewegungen einer Sitzung:
 *
 *   vorwärts       aufrufen → abstimmen → schliessen (verkündet) → weiter
 *   rückwärts      ein früheres Geschäft nochmals aufrufen, Aufruf zurücknehmen
 *   Rückkommen     beantragen → darüber abstimmen → abgelehnt / angenommen
 *
 * **Die Messlatte ist nicht «es geht», sondern «man findet es».** Ein Knopf,
 * der in eine Absage führt, gilt hier als Fehler: Im Saal steht die Leitung vor
 * vierzehn Leuten und hat keine Zeit, eine Fehlermeldung zu deuten.
 *
 * Aufruf: `node e2e/sitzungsfuehrung.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-sitzungsfuehrung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

let nr = 0;
const fehler = [];
const rueckfragen = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
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

async function schritt(titel, fn) {
	nr += 1;
	const nummer = String(nr).padStart(2, '0');
	try {
		const ergebnis = await fn();
		console.log(`  ${nummer} ✓ ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${nummer} ✗ ${titel}\n        ${e.message}`);
		await leitung
			.screenshot({ path: `${AUFNAHMEN}/fehler-${nummer}.png`, fullPage: true })
			.catch(() => {});
	}
}

await mkdir(AUFNAHMEN, { recursive: true });

const browser = await chromium.launch();
const leitungCtx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
const telefonACtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const telefonBCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const beamerCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

const leitung = await leitungCtx.newPage();
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(leitung);
const telefonA = await telefonACtx.newPage();
warteNachNavigation(telefonA);
const telefonB = await telefonBCtx.newPage();
warteNachNavigation(telefonB);
const beamer = await beamerCtx.newPage();
warteNachNavigation(beamer);

for (const [wer, seite] of [
	['Leitung', leitung],
	['Telefon A', telefonA],
	['Telefon B', telefonB],
	['Beamer', beamer]
]) {
	seite.on('dialog', (d) => {
		rueckfragen.push(`${wer}: ${d.message().split('\n')[0]}`);
		d.accept();
	});
	seite.on('pageerror', (e) => fehler.push(`Skriptfehler ${wer}: ${e.message}`));
}

/**
 * Ein Formular abschicken und die Antwort abwarten — **samt Rückfrage**.
 *
 * Seit dem 20.08.2026 fragt die Anwendung nicht mehr über `confirm()`, sondern
 * in einem eigenen Fenster (`Rueckfrage.svelte`). Der Auslöser öffnet es nur;
 * abgeschickt wird erst im Fenster. Ein Drehbuch, das bloss den Auslöser
 * drückt, wartet danach ewig auf eine Antwort, die nie kommt — und meldet
 * «Knopf geklickt, nichts passiert».
 */
async function abschicken(seite, knopf) {
	/*
	 * **Auf den Knopf warten, nicht nach ihm zählen** (28.08.2026).
	 *
	 * `count()` wartet nicht — anders als ein Klick, der von selbst auf sein
	 * Ziel wartet. Solange die Sitzungsleitung bei jeder Absendung neu lud,
	 * stand die Seite danach fertig da. Seit sie über `$lib/absenden.ts`
	 * schickt und die Bausteine des aufgerufenen Geschäfts in einem `{#key}`
	 * hängen, wird beim Wechsel zerstört und neu gebaut: Für wenige
	 * Millisekunden ist der Knopf weg. Ein Mensch trifft dieses Fenster nicht,
	 * `count()` schon — dreimal in Folge, mit «Knopf nicht gefunden».
	 *
	 * `waitFor` schliesst die Lücke, ohne die Aussage zu verwässern: Bleibt der
	 * Knopf weg, läuft die Frist ab und die Zusicherung darunter greift wie
	 * bisher.
	 */
	await knopf
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.catch(() => {});
	behaupte(await knopf.count(), 'Knopf nicht gefunden');
	/*
	 * **Und auf das Nachladen warten, nicht auf `domcontentloaded`**
	 * (28.08.2026). Hier stand `waitForLoadState('domcontentloaded')` plus
	 * 350 ms. Solange die Sitzungsleitung bei jeder Absendung neu lud, war das
	 * richtig. Seit sie über `$lib/absenden.ts` schickt, kehrt der Zustand
	 * sofort zurück — er ist ja längst erreicht —, während `update()` sein
	 * `invalidateAll()` noch gegen den Server fährt. Auf dieser Seite dauert
	 * das länger als 350 ms, und der Durchlauf las den Stand von vorher.
	 *
	 * Das Merkmal: Der Lauf kippt an **wechselnden** Stellen, mal beim
	 * Rückkommen, mal beim Aufrufen, mal bei der Pause — je nachdem, wo die
	 * Antwort gerade langsamer war als die Frist. Dieselbe Klasse wie in
	 * `e2e/ausstand.mjs`, dort am selben Tag gefunden.
	 *
	 * `nachladeWarter` wird **vor** dem Klick scharfgestellt, sonst ist der
	 * Nachladelauf vorbei, bevor jemand auf ihn wartet.
	 */
	const nachladen = nachladeWarter(seite);
	const antwort = seite
		.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
		.catch(() => null);
	await knopf.first().click();
	await seite.waitForTimeout(150);
	const ja = seite.locator('dialog[open] button.ja');
	if (await ja.count()) {
		const frage = await seite
			.locator('dialog[open] h2')
			.innerText()
			.catch(() => '(ohne Frage)');
		rueckfragen.push(frage.replace(/\s+/g, ' '));
		await ja.first().click();
	}
	await nachAbsendung(seite, await antwort, nachladen, 350);
}

/**
 * Eine Seite aufrufen — auch dann, wenn sie sich gerade selbst neu lädt.
 *
 * **Warum das nötig wurde** (28.08.2026): Telefon und Beamer hängen am
 * Ereignisstrom und ziehen von selbst nach, sobald die Sitzungsleitung etwas
 * verkündet. Trifft ein solches Nachziehen mit einem `goto` des Drehbuchs
 * zusammen, bricht Playwright ab: «Navigation to /z is interrupted by another
 * navigation to /z». Das ist kein Befund an der Anwendung — beide Navigationen
 * führen zum selben Ziel.
 *
 * Seit die Sitzungsleitung über `$lib/absenden.ts` schickt, verschiebt sich das
 * Zusammentreffen: Die Verkündung kommt früher, weil kein Seitenaufbau mehr
 * dazwischenliegt. Deshalb ein zweiter Versuch statt einer längeren Frist —
 * eine Frist wäre auf einem langsameren Rechner wieder zu kurz.
 */
async function gehe(seite, pfad) {
	try {
		await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	} catch (fehler) {
		if (!/interrupted by another navigation|ERR_ABORTED/.test(fehler.message)) throw fehler;
		await seite.waitForTimeout(300);
		await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
	}
	await seite.waitForTimeout(300);
}

/**
 * Der Text des Inhaltsbereichs — **samt Quittungsecke**.
 *
 * Seit dem 21.08.2026 wandern Erfolgsmeldungen nach unten rechts
 * (`Einblender.svelte`), und die liegt ausserhalb von `main`. Ohne sie fänden
 * Prüfungen, die auf eine Bestätigung warten, nichts mehr — der Ausstandsschritt
 * scheiterte genau daran, obwohl beide Ausstände erfasst waren.
 */
const text = async (seite, bereich = 'main') => {
	const inhalt = (await seite.locator(bereich).first().innerText()).replace(/\s+/g, ' ');
	const ecke = seite.locator('.einblender');
	const quittungen = (await ecke.count())
		? (await ecke.innerText()).replace(/\s+/g, ' ')
		: '';
	return quittungen ? `${inhalt} ${quittungen}` : inhalt;
};

/** Der Text der ganzen Seite — für die Wand, die kein `main` hat. */
const ganz = async (seite) => (await seite.locator('body').innerText()).replace(/\s+/g, ' ');

let gemeinschaft;
let versammlung;
let anzeigecode;
const codes = [];
const NAME = `Prüflauf Sitzungsführung ${LAUF}`;
/*
 * **Mit Zeitstempel, damit das Aufräumen sie findet** (25.08.2026). Ohne ihn
 * hiessen die Eigentümer schlicht «Ackermann», «Brunner», «Caduff». Die
 * Gemeinschaft darüber trägt den Stempel und verschwindet beim Aufräumen — die
 * **Personen** blieben, weil kein Namensmuster auf sie passt. So waren 115
 * verwaiste Personen aufgelaufen, und die Eigentümerliste zeigte 233 Zeilen mit
 * zwei Dutzend gleichnamigen «Ackermann».
 */
const LEUTE = ['Ackermann', 'Brunner', 'Caduff'].map((n) => `${n} ${LAUF}`);
const GESCHAEFTE = [
	['Ersatz der Waschmaschine', 'Die Waschmaschine wird ersetzt.'],
	['Anstrich des Treppenhauses', 'Das Treppenhaus wird neu gestrichen.'],
	['Neue Veloständer', 'Vor dem Haus werden zwei Veloständer aufgestellt.'],
	// Das vierte bleibt bis zuletzt unbehandelt: Ausstand und Gegenantrag gibt
	// es nur, solange nicht abgestimmt ist — an einem erledigten Geschäft wären
	// die letzten Schritte nicht prüfbar.
	['Reinigung der Tiefgarage', 'Die Tiefgarage wird jährlich gereinigt.'],
	/*
	 * Das fünfte bleibt ganz unberührt — es wird nie aufgerufen und nie
	 * abgestimmt. Gebraucht wird es seit dem 21.08.2026: Die Reihenfolge lässt
	 * sich nur noch im **noch nicht behandelten** Teil ändern, und dafür braucht
	 * es dort mindestens zwei Punkte, die man tauschen kann.
	 */
	['Ersatz der Türsprechanlage', 'Die Türsprechanlage wird ersetzt.']
];

/** Die Zeile eines Traktandums in der Liste der Leitung. */
function zeile(titel) {
	return leitung
		.locator('.baum li', { hasText: titel })
		.filter({ hasNotText: 'Rückkommen auf' })
		.first();
}

async function rufeAuf(titel) {
	await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
	const jetztSchon = (await leitung.locator('li.jetzt').innerText().catch(() => '')).replace(
		/\s+/g,
		' '
	);
	/*
	 * Am aufgerufenen Geschäft steht kein «Aufrufen» — es ist ja schon da.
	 *
	 * **Und «Rückkommen auf 9 Ersatz der Waschmaschine» enthält den Titel des
	 * Ziels.** Ohne diesen Ausschluss hielte das Drehbuch den Rückkommensantrag
	 * für das Geschäft selbst und prüfte danach die falsche Seite.
	 */
	const schonDa = jetztSchon.includes(titel) && !jetztSchon.includes('Rückkommen auf');
	if (!schonDa) {
		/*
		 * **Erst aufklappen** (01.09.2026). Behandelte Geschäfte liegen in einem
		 * zugeklappten `<details>`; ihr «Aufrufen» ist dann im Baum vorhanden,
		 * aber nicht sichtbar, und der Klick läuft in einen Zeitablauf statt in
		 * eine Meldung. Aufgefallen beim Zugriff auf das Pflichttraktandum
		 * «Feststellung der Beschlussfähigkeit», das zu diesem Zeitpunkt längst
		 * behandelt ist.
		 */
		await leitung.evaluate(() => {
			document.querySelectorAll('details').forEach((d) => (d.open = true));
		});
		const knopf = zeile(titel).locator('form[action="?/aufrufen"] button[type="submit"]');
		behaupte(await knopf.count(), `Kein Knopf zum Aufrufen von «${titel}»`);
		await abschicken(leitung, knopf);
	}
	const jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
	behaupte(jetzt.includes(titel), `Aufgerufen ist etwas anderes: ${jetzt.slice(0, 120)}`);
}

/**
 * Freigeben, beide Telefone stimmen, schliessen — das Schliessen verkündet.
 *
 * `aufnahme` hält den Augenblick fest, in dem die Frage auf allen drei Geräten
 * steht — die Stelle, an der sich Laienverständlichkeit beurteilen lässt.
 *
 * `beiOffener` läuft, **solange die Abstimmung offen ist** und bevor gestimmt
 * wird. Vorher gibt es die Karte noch nicht, nachher ist sie eine andere: Wer
 * prüfen will, was der Eigentümer vor dem Drücken sieht, kann das nur hier.
 */
async function stimmeAb(wahl, aufnahme = null, beiOffener = null) {
	const knopf = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
	behaupte(await knopf.count(), 'Kein Knopf «Abstimmung freigeben»');
	await abschicken(leitung, knopf);

	/*
	 * **Der Augenblick, in dem die Frage steht.** Er ist kurz: Sobald die
	 * Telefone abgestimmt haben, zeigt ihre Seite die Bestätigung statt des
	 * Antrags. Wer den Wortlaut oder die nötige Mehrheit erst danach prüft, prüft
	 * die falsche Seite. Das gilt für den Vergleich oben wie für die Aufnahme
	 * unten.
	 */
	/*
	 * **Was nötig ist, steht auf beiden Geräten — und zwar dasselbe**
	 * (04.09.2026, aus dem Prüfdurchgang der Eigentümersicht). Über den
	 * Wahlknöpfen stand allein der Fallname, etwa «Gewöhnliche
	 * Verwaltungshandlung»; der erklärende Satz kam erst im Ergebnis, also
	 * nachdem entschieden war.
	 *
	 * Zwei Sätze über dieselbe Mehrheit liefen auseinander, und dann stünde an
	 * der Wand etwas anderes als in der Hand. Deshalb wird hier verglichen, nicht
	 * nur auf Vorhandensein geprüft.
	 */
	await gehe(telefonA, '/z');
	const noetigAmTelefon = telefonA.locator('.abstimmung .noetig');
	behaupte(
		await noetigAmTelefon.count(),
		`Auf dem Telefon steht nicht, was nötig ist: ${(await text(telefonA)).slice(0, 220)}`
	);
	const satzTelefon = (await noetigAmTelefon.first().innerText()).replace(/\s+/g, ' ').trim();

	/*
	 * **Und er steht kräftiger da als der Fallname darüber** (04.09.2026, aus
	 * dem Code-Review). Die erste Fassung schrieb `.noetig`, aber `.klein` setzt
	 * dieselbe Eigenschaft mit gleicher Spezifität und steht später in der
	 * Datei — die Regel war wirkungslos, und der Satz blieb so leise wie das,
	 * was er übertönen soll. Das sieht man keinem Selektor an, nur der
	 * gerechneten Farbe.
	 */
	if (beiOffener) await beiOffener();

	const [farbeNoetig, farbeFall] = await Promise.all([
		noetigAmTelefon.first().evaluate((e) => getComputedStyle(e).color),
		telefonA
			.locator('.abstimmung p.klein:not(.noetig)')
			.first()
			.evaluate((e) => getComputedStyle(e).color)
	]);
	behaupte(
		farbeNoetig !== farbeFall,
		`Die nötige Mehrheit steht so leise wie der Fallname: beide ${farbeNoetig}`
	);
	// Der Vorbehalt «Die Zahl verschiebt sich …» steht nur auf dem Telefon: Die
	// Wand zeigt ihn nicht, weil dort niemand danach handelt.
	const kern = satzTelefon.split('Die Zahl verschiebt sich')[0].trim();
	behaupte(kern.length > 10, `Der Satz ist zu kurz zum Vergleichen: «${satzTelefon}»`);

	await gehe(beamer, '/p');
	const wandJetzt = (await ganz(beamer)).replace(/\s+/g, ' ');
	behaupte(
		wandJetzt.includes(kern),
		`Wand und Telefon nennen Verschiedenes.\n  Telefon: ${kern}\n  Wand: ${wandJetzt.slice(0, 300)}`
	);

	const gesehen = { wand: '', telefon: '' };
	if (aufnahme) {
		await gehe(beamer, '/p');
		await gehe(telefonA, '/z');
		gesehen.wand = await ganz(beamer);
		gesehen.telefon = await text(telefonA);
		await beamer.screenshot({ path: `${AUFNAHMEN}/${aufnahme}-wand.png` }).catch(() => {});
		await telefonA
			.screenshot({ path: `${AUFNAHMEN}/${aufnahme}-telefon.png`, fullPage: true })
			.catch(() => {});
		await leitung
			.screenshot({ path: `${AUFNAHMEN}/${aufnahme}-leitung.png`, fullPage: true })
			.catch(() => {});
	}

	for (const seite of [telefonA, telefonB]) {
		await gehe(seite, '/z');
		const stimme = seite.locator(`form.wahl button.${wahl}`).first();
		behaupte(await stimme.count(), `Das Telefon zeigt keine Wahl: ${(await text(seite)).slice(0, 160)}`);
		await abschicken(seite, stimme);
	}

	await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
	/*
	 * **Schliessen verkündet** (Produktentscheid 21.08.2026). Bis dahin stand hier
	 * ein zweiter Klick auf «Ergebnis verkünden» (`?/freigeben`) — der Knopf ist
	 * weg, und mit ihm der Satz, der behauptete, ohne ihn erscheine nichts.
	 */
	await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));
	behaupte(
		(await leitung.locator('form[action="?/freigeben"] button').count()) === 0,
		'Es gibt wieder einen eigenen Verkünden-Knopf'
	);
	/*
	 * **Und der Durchgang ist wirklich zu.** Ohne diese Prüfung lief das Drehbuch
	 * weiter, wenn das Schliessen hängenblieb — und scheiterte drei Schritte
	 * später an einer Stelle, die nichts damit zu tun hatte (21.08.2026).
	 */
	behaupte(
		(await leitung.locator('form[action="?/schliessen"] button').count()) === 0,
		`Die Abstimmung ist noch offen: ${(await text(leitung)).slice(0, 200)}`
	);
	return gesehen;
}

try {
	console.log(`Ziel: ${ZIEL} · Lauf ${LAUF}\n`);
	console.log('Vorbereitung');

	await schritt('Anmelden', async () => {
		await gehe(leitung, '/anmelden');
		await leitung.fill('input[name="username"]', BENUTZER);
		await leitung.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(leitung, leitung.locator('main button[type="submit"]'));
		behaupte(!leitung.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Drei Eigentümer zu je einem Drittel', async () => {
		await gehe(leitung, '/gemeinschaften/neu');
		await leitung.fill('input[name="name"]', NAME);
		await leitung.fill('input[name="quotaDenominator"]', '999');
		await leitung.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
		gemeinschaft = leitung.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${leitung.url()}`);

		for (const [i, wer] of LEUTE.entries()) {
			await gehe(leitung, `/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = leitung.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill('333');
			await abschicken(leitung, ef.locator('button[type="submit"]'));

			await gehe(leitung, `/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const pf = leitung.locator('form[action$="anlegen"]').first();
			await pf.locator('input[name="displayName"]').fill(wer);
			await abschicken(leitung, pf.locator('button[type="submit"]'));

			await gehe(leitung, `/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const zf = leitung.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
			await abschicken(leitung, zf.locator('button[type="submit"]'));
		}
		return `${LEUTE.length} Eigentümer`;
	});

	await schritt('Versammlung mit drei Geschäften, freigegeben und eröffnet', async () => {
		await gehe(leitung, '/versammlungen/neu');
		await leitung.locator('input[name="art"][value="einzeln"]').check();
		await leitung.waitForTimeout(150);
		await leitung.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await leitung.fill('input[name="datum"]', '2027-05-12');
		await leitung.fill('input[name="uhrzeit"]', '19:30');
		await leitung.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(leitung, leitung.locator('button[form="anlegen"]').first());
		versammlung = leitung.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${leitung.url()}`);

		for (const [titel, wortlaut] of GESCHAEFTE) {
			await gehe(leitung, `/versammlungen/${versammlung}/traktanden`);
			await leitung.locator('.neu button.haupt').click();
			await leitung.waitForTimeout(250);
			const tf = leitung.locator('form[action="?/anlegen"]').first();
			await tf.locator('input[name="titel"]').fill(titel);
			await tf.locator('input[name="art"][value="abstimmung"]').check();
			await leitung.waitForTimeout(200);
			await tf
				.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
				.first()
				.fill(wortlaut);
			await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
			await abschicken(leitung, tf.locator('button[type="submit"]').first());
		}

		await gehe(leitung, `/versammlungen/${versammlung}/freigabe`);
		await abschicken(leitung, leitung.locator('form[action$="freigeben"] button[type="submit"]'));

		/*
		 * **Auf «Handy» umstellen.** Bei wenigen Parteien wählt die Anwendung von
		 * sich aus die Papierform — dann stimmt der Saal durch Handerheben und die
		 * Telefone zeigen gar keine Knöpfe. Geprüft werden soll hier aber der Weg,
		 * den der Auftraggeber gegangen ist: vierzehn Parteien, jede mit dem eigenen Gerät.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}`);
		const wechsel = leitung.locator('form[action="?/betriebsart"] button[type="submit"]');
		if ((await wechsel.count()) && /Handy/.test(await wechsel.first().innerText())) {
			await abschicken(leitung, wechsel);
		}
		behaupte(
			/über das eigene Gerät|Handy|geführt/i.test(await text(leitung)),
			`Die Versammlung steht nicht auf Handy-Abstimmung: ${(await text(leitung)).slice(0, 300)}`
		);

		await gehe(leitung, `/versammlungen/${versammlung}`);
		await abschicken(leitung, leitung.locator('form[action="?/eroeffnen"] button[type="submit"]'));
		const code = leitung.locator('.anzeigecode .code');
		behaupte(await code.count(), 'Kein Anzeigecode nach dem Eröffnen');
		anzeigecode = (await code.textContent()).trim();
		return versammlung.slice(0, 8);
	});

	await schritt('Beamer und zwei Telefone sind da', async () => {
		await gehe(beamer, '/p');
		await beamer.fill('input[name="code"]', anzeigecode);
		await abschicken(beamer, beamer.locator('main button[type="submit"]').first());
		behaupte(
			(await ganz(beamer)).includes(NAME) || (await ganz(beamer)).includes('Waschmaschine'),
			`Der Beamer kam nicht hinein: ${(await ganz(beamer)).slice(0, 200)}`
		);

		for (let i = 0; i < 2; i++) {
			await gehe(leitung, `/versammlungen/${versammlung}/anwesenheit`);
			const formulare = leitung.locator('form[action="?/codeAusgeben"]');
			behaupte((await formulare.count()) > i, `Kein Ausgabeformular für Partei ${i + 1}`);
			await abschicken(leitung, formulare.nth(i).locator('button[type="submit"]'));
			const code = leitung.locator('.ausgabe .code');
			behaupte(await code.count(), 'Kein Ausgabecode erschienen');
			codes.push((await code.textContent()).trim());
		}

		for (const [seite, code] of [
			[telefonA, codes[0]],
			[telefonB, codes[1]]
		]) {
			await gehe(seite, '/z');
			await seite.fill('input[name="code"]', code);
			await abschicken(seite, seite.locator('main button[type="submit"]').first());
			behaupte(
				!/nicht g[uü]ltig|unbekannt/i.test(await text(seite)),
				`Code abgewiesen: ${(await text(seite)).slice(0, 160)}`
			);
		}

		// Anwesenheit für alle drei bestätigen, damit die Bezugsgrösse steht.
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(leitung, `/versammlungen/${versammlung}/anwesenheit`);
			const knopf = leitung.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(leitung, knopf);
		}
		return `Anzeigecode ${anzeigecode.slice(0, 6)}…, 2 Telefone`;
	});

	await schritt('Das Telefon erklärt Kopfstimme und Wertquote', async () => {
		/*
		 * **Der Prüfdurchgang der Eigentümersicht** (04.09.2026). Die Seite zeigt
		 * «1 Kopfstimme · 250 von 1000 Wertquoten» und fordert direkt darunter
		 * auf, das zu prüfen: «Stimmt etwas davon nicht, melden Sie sich bei der
		 * Sitzungsleitung, bevor abgestimmt wird.» Erklärt wurden die beiden
		 * Wörter nirgends. Eine Abfrage über `main` nach `[title]`,
		 * `details summary` und `abbr` lieferte in allen Zuständen nichts.
		 *
		 * Wer soll prüfen, was er nicht versteht?
		 */
		await gehe(telefonA, '/z');
		const t = await text(telefonA);
		behaupte(
			/Kopfstimme/.test(t) && /Wertquote/.test(t),
			`Das Telefon nennt die beiden Begriffe gar nicht: ${t.slice(0, 200)}`
		);

		const auskunft = telefonA.locator('details.erklaerung');
		behaupte(await auskunft.count(), 'Kein Hintergrund «Was heisst das?» auf der Telefonseite');

		// Zugeklappt, wie Regel 4 aus `docs/gestaltung.md` es verlangt.
		behaupte(
			!(await auskunft.first().evaluate((e) => e.open)),
			'Der Hintergrund steht offen — er soll warten, bis jemand fragt'
		);

		await auskunft.first().locator('summary').click();
		await telefonA.waitForTimeout(150);
		const offen = await auskunft.first().innerText();
		/*
		 * **Der Satz muss zur Zählweise passen** (04.09.2026, aus dem Code-Review).
		 * Diese Gemeinschaft zählt je Eigentümer; bei «je Einheit» stünde «eine
		 * Stimme je Eigentümer» unter einer Zeile, die zwei Kopfstimmen nennt.
		 */
		behaupte(
			/je Eigentümer/.test(offen) && !/je Einheit/.test(offen),
			`Der Hintergrund passt nicht zur Zählweise: ${offen.slice(0, 220)}`
		);
		// Der Nenner kommt aus den Daten, nicht aus dem Text: «Tausendstel» wäre
		// bei einer Gemeinschaft mit Hundertsteln falsch.
		behaupte(
			/Anteil am ganzen Haus, gezählt von \d+/.test(offen.replace(/\s+/g, ' ')),
			`Der Nenner steht nicht in der Erklärung: ${offen.slice(0, 220)}`
		);
		return 'Kopfstimme und Wertquote erklärt, passend zur Zählweise';
	});

	// ── Vorwärts ────────────────────────────────────────────────────────────
	console.log('\nVorwärts durch die Traktanden');

	await schritt('Traktandum aufrufen — die Wand zieht mit', async () => {
		await rufeAuf(GESCHAEFTE[0][0]);
		await gehe(beamer, '/p');
		behaupte(
			(await ganz(beamer)).includes(GESCHAEFTE[0][0]),
			`Die Wand zeigt das Geschäft nicht: ${(await ganz(beamer)).slice(0, 220)}`
		);
		for (const seite of [telefonA, telefonB]) {
			await gehe(seite, '/z');
			const t = await text(seite);
			behaupte(
				/anwesend|Abstimmung/i.test(t),
				`Das Telefon lässt den Eigentümer im Ungewissen: ${t.slice(0, 200)}`
			);
		}
		return 'Leitung, Wand und Telefone gleichauf';
	});

	await schritt('Das Telefon zeigt, wo die Versammlung steht', async () => {
		/*
		 * **Der Dreischritt** (04.09.2026, Produktentscheid). Ist ein Traktandum
		 * aufgerufen, aber noch keine Abstimmung offen, stand hier bisher nur «Sie
		 * sind als anwesend erfasst»: Während der Diskussion war der Bildschirm
		 * leer, und bei Traktanden ohne Abstimmung erfuhr man über das Gerät nie,
		 * wo die Versammlung steht.
		 *
		 * Nummer und Titel, nicht der Antragstext — der Wortlaut bleibt an der
		 * Leinwand.
		 */
		await gehe(telefonA, '/z');
		const schritte = telefonA.locator('ol.dreischritt > li');
		behaupte(
			(await schritte.count()) === 3,
			`Kein Dreischritt auf dem Telefon: ${(await text(telefonA)).slice(0, 200)}`
		);

		const jetzt = telefonA.locator('ol.dreischritt > li.jetzt');
		behaupte(await jetzt.count(), 'Kein hervorgehobenes «jetzt»');

		// Prominenter als seine Nachbarn: Das ist der ganze Zweck der Anzeige.
		const [gross, klein] = await Promise.all([
			jetzt.first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
			telefonA
				.locator('ol.dreischritt > li.vorher')
				.first()
				.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
		]);
		behaupte(gross > klein, `«jetzt» ist nicht grösser: ${gross} gegen ${klein}`);

		const wortlaut = await jetzt.first().innerText();
		behaupte(
			!/\?$/.test(wortlaut.trim()),
			`Im Dreischritt steht offenbar der Antragstext: ${wortlaut.slice(0, 120)}`
		);
		return `drei Schritte, «jetzt» bei ${gross}px gegen ${klein}px`;
	});


	await schritt('Freigeben, abstimmen, schliessen — das verkündet zugleich', async () => {
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		await stimmeAb('ja');
		const t = await text(leitung);
		behaupte(/[Aa]ngenommen/.test(t), `Kein Ergebnis auf der Leitung: ${t.slice(0, 250)}`);
		return 'angenommen';
	});

	await schritt('Wand und Telefon zeigen dasselbe Ergebnis', async () => {
		await gehe(beamer, '/p');
		behaupte(
			/Angenommen/i.test(await ganz(beamer)),
			`Die Wand zeigt das Ergebnis nicht: ${(await ganz(beamer)).slice(0, 220)}`
		);
		await gehe(telefonA, '/z');
		behaupte(
			/Angenommen/i.test(await text(telefonA)),
			`Das Telefon zeigt das Ergebnis nicht: ${(await text(telefonA)).slice(0, 220)}`
		);
	});

	await schritt('Der Verlauf sammelt die Beschlüsse, ohne die eigene Stimme', async () => {
		/*
		 * **Der Verlauf** (04.09.2026, Produktentscheid). Bisher zeigte die Seite nur
		 * das zuletzt verkündete Ergebnis; beim nächsten Geschäft war es weg. Wer
		 * am Ende wissen wollte, was insgesamt beschlossen wurde, fand nichts.
		 *
		 * **Ohne die eigene Stimme** (Produktentscheid): Der Nachweis ist das
		 * Protokoll und nicht dieses Gerät. Ein Telefon, das nach dem Abend noch
		 * verrät, wie sein Besitzer gestimmt hat, wäre ein Risiko, das die
		 * Anwendung sonst überall vermeidet.
		 */
		await gehe(telefonA, '/z');
		const zeilen = telefonA.locator('.verlauf ol li');
		behaupte(
			(await zeilen.count()) >= 1,
			`Kein Verlauf nach der ersten Abstimmung: ${(await text(telefonA)).slice(0, 220)}`
		);

		const erste = await zeilen.first().innerText();
		behaupte(
			/angenommen|abgelehnt|ohne Beschluss/.test(erste),
			`Die Verlaufszeile nennt kein Ergebnis: ${erste.slice(0, 120)}`
		);

		/*
		 * **Die Probe, die im schlechten Zustand rot wird.** Stünde dort «Sie haben
		 * Ja gestimmt», wäre der Entscheid gebrochen — und zwar still, denn die
		 * Zeile sähe hilfreich aus.
		 */
		const ganzerVerlauf = await telefonA.locator('.verlauf').first().innerText();
		behaupte(
			!/Sie haben|Ihre Stimme war|Sie stimmten/.test(ganzerVerlauf),
			`Der Verlauf verrät die eigene Stimme: ${ganzerVerlauf.slice(0, 200)}`
		);
		return `${await zeilen.count()} Zeile(n), ohne eigene Stimme`;
	});

	await schritt('«Nachher» führt zum nächsten Geschäft', async () => {
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const nachher = leitung.locator('li.nachher');
		const t = (await nachher.innerText()).replace(/\s+/g, ' ');
		behaupte(t.includes(GESCHAEFTE[1][0]), `«Nachher» zeigt nicht das nächste Geschäft: ${t}`);
		await abschicken(leitung, nachher.locator('form[action="?/aufrufen"] button'));
		const jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
		behaupte(jetzt.includes(GESCHAEFTE[1][0]), `Nicht weitergerückt: ${jetzt.slice(0, 120)}`);
	});

	await schritt('«Vorher» führt zurück — hin und her ohne Umweg', async () => {
		/*
		 * Gemeldet am 21.08.2026: «beim Vorher wäre auch einen Aufruf-Button
		 * nützlich. so kann man dann switchen.» Vorwärts ging es, rückwärts führte
		 * der Weg über die Liste unten — im Saal ein Suchen, während alle zusehen.
		 */
		const vorher = leitung.locator('li.vorher');
		const t = (await vorher.innerText()).replace(/\s+/g, ' ');
		behaupte(t.includes(GESCHAEFTE[0][0]), `«Vorher» zeigt nicht das frühere Geschäft: ${t}`);
		await abschicken(leitung, vorher.locator('form[action="?/aufrufen"] button'));
		let jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
		behaupte(jetzt.includes(GESCHAEFTE[0][0]), `Nicht zurückgerückt: ${jetzt.slice(0, 120)}`);

		// Und wieder vorwärts: Das ist das Wechseln, um das es geht.
		await abschicken(
			leitung,
			leitung.locator('li.nachher form[action="?/aufrufen"] button')
		);
		jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
		behaupte(jetzt.includes(GESCHAEFTE[1][0]), `Nicht wieder vorwärts: ${jetzt.slice(0, 120)}`);
		return 'zurück und wieder vor';
	});

	// ── Rückwärts ───────────────────────────────────────────────────────────
	console.log('\nRückwärts');

	await schritt('Ein behandeltes Geschäft nochmals aufrufen', async () => {
		await rufeAuf(GESCHAEFTE[0][0]);
		await gehe(beamer, '/p');
		const wand = await ganz(beamer);
		behaupte(wand.includes(GESCHAEFTE[0][0]), `Die Wand folgte nicht zurück: ${wand.slice(0, 200)}`);
		return 'Wand folgt zurück';
	});

	await schritt('KEIN Knopf, der in eine Absage führt', async () => {
		/*
		 * **Der Anlassfall.** Über das Geschäft ist abgestimmt; ein zweiter
		 * Durchgang braucht einen Beschluss der Versammlung. Trotzdem stand hier
		 * «Abstimmung freigeben» — und jeder Klick endete in derselben roten
		 * Meldung. Im Saal ist das kein Hinweis, sondern eine Sackgasse.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const freigeben = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(
			(await freigeben.count()) === 0,
			'Am behandelten Geschäft steht «Abstimmung freigeben» — der Klick führt in die Absage'
		);
		const t = await text(leitung);
		await leitung
			.screenshot({ path: `${AUFNAHMEN}/behandelt-leitung.png`, fullPage: true })
			.catch(() => {});
		behaupte(
			/ist abgestimmt|bereits abgestimmt/i.test(t),
			`Die Seite sagt nicht, warum hier nicht abgestimmt wird: ${t.slice(0, 300)}`
		);
		behaupte(
			/Nochmals abstimmen|Rückkommen/i.test(t),
			`Die Seite nennt den Weg zum zweiten Durchgang nicht: ${t.slice(0, 300)}`
		);
		return 'stattdessen eine Erklärung';
	});

	await schritt('Aufruf zurücknehmen — die Wand fällt zurück', async () => {
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const zurueck = leitung.locator('li.jetzt form[action="?/aufrufen"] button');
		behaupte(await zurueck.count(), 'Kein Knopf «Aufruf zurücknehmen»');
		await abschicken(leitung, zurueck);
		/*
		 * **Auf den Zustand warten, nicht sofort lesen** (06.09.2026). Der Schritt
		 * las den Text unmittelbar nach dem Absenden und war damit ein Wettlauf
		 * gegen das Neuzeichnen: In einem von zwei Läufen stand dort noch das
		 * aufgerufene Traktandum, und die Meldung «Der Aufruf blieb stehen» sah
		 * aus wie ein Anwendungsfehler.
		 *
		 * Dieselbe Klasse wie beim Verlaufs-Aufklapper in `durchspielen.mjs`: Ein
		 * `innerText` wartet auf nichts, ein `waitFor` macht aus dem Wettlauf eine
		 * Frist.
		 */
		await leitung
			.locator('li.jetzt')
			.filter({ hasText: /kein Traktandum/i })
			.waitFor({ state: 'visible', timeout: 10000 })
			.catch(() => {});
		const jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
		behaupte(/kein Traktandum/i.test(jetzt), `Der Aufruf blieb stehen: ${jetzt.slice(0, 120)}`);
		await gehe(beamer, '/p');
		const wand = await ganz(beamer);
		behaupte(
			!/Angenommen/i.test(wand),
			`Die Wand hängt am alten Ergebnis fest: ${wand.slice(0, 220)}`
		);
		return 'Wand zeigt wieder die Übersicht';
	});

	// ── Rückkommen ──────────────────────────────────────────────────────────
	console.log('\nRückkommen — der Weg, an dem es scheiterte');

	await schritt('Der Weg zum Rückkommen steht am aufgerufenen Geschäft', async () => {
		await rufeAuf(GESCHAEFTE[0][0]);
		const wort = leitung.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		behaupte(await wort.count(), `«Nochmals abstimmen» fehlt: ${(await text(leitung)).slice(0, 300)}`);
		await wort.first().click();
		await leitung.waitForTimeout(200);
		const t = (await leitung.locator('.eingriffe').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/entscheidet die Versammlung/i.test(t),
			`Der Vorbehalt fehlt: ${t.slice(0, 300)}`
		);
		await abschicken(
			leitung,
			leitung.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]')
		);
		return 'Antrag gestellt';
	});

	await schritt('Nach dem Stellen sagt die Seite, was jetzt zu tun ist', async () => {
		/*
		 * **Der zweite Teil des Anlassfalls.** Der Antrag entsteht als eigenes
		 * Traktandum ganz unten in der Liste. Wer ihn nicht dort sucht, findet
		 * ihn nie — und die Meldung hiess bloss «Zu diesem Traktandum steht
		 * bereits ein Rückkommensantrag.»
		 */
		const t = await text(leitung);
		behaupte(
			/Rückkommen auf/.test(t),
			`Der Antrag steht nicht in der Liste: ${t.slice(0, 300)}`
		);
		behaupte(
			/darüber abstimmen|aufrufen und/i.test(t),
			`Die Seite sagt nicht, wie es weitergeht: ${t.slice(0, 400)}`
		);
		const hin = leitung.locator('.rueckkommensweg form[action="?/aufrufen"] button');
		behaupte(
			await hin.count(),
			'Kein Weg vom Geschäft zum Rückkommensantrag — man muss ihn unten suchen'
		);
		return 'mit Knopf zum Antrag';
	});

	await schritt('Die Teilnehmer stimmen über das Rückkommen ab', async () => {
		// Der Satz des Auftraggebers: «müssten doch die Teilnehmer darüber abstimmen können».
		await abschicken(leitung, leitung.locator('.rueckkommensweg form[action="?/aufrufen"] button'));
		const jetzt = (await leitung.locator('li.jetzt').innerText()).replace(/\s+/g, ' ');
		behaupte(/Rückkommen auf/.test(jetzt), `Der Antrag wurde nicht aufgerufen: ${jetzt.slice(0, 150)}`);
		const gesehen = await stimmeAb('nein', 'rueckkommen');

		/*
		 * **Worüber wird hier abgestimmt?** «Rückkommen auf 9 Ersatz der
		 * Waschmaschine» ist ein Titel, kein Antrag. Wand und Telefon müssen den
		 * Wortlaut zeigen — sonst stimmt der Saal über eine Überschrift ab.
		 */
		behaupte(
			/Rückkommen auf/.test(gesehen.wand) && /aufgehoben/i.test(gesehen.wand),
			`Die Wand sagt nicht, worum es beim Rückkommen geht: ${gesehen.wand.slice(0, 300)}`
		);
		behaupte(
			/aufgehoben/i.test(gesehen.telefon),
			`Das Telefon zeigt den Antragswortlaut nicht: ${gesehen.telefon.slice(0, 300)}`
		);
		// **Kein Widerspruch auf derselben Seite:** Solange die Frage dasteht, darf
		// darunter nicht stehen, sie erscheine erst noch.
		behaupte(
			!/Sobald eine Abstimmung eröffnet wird/.test(gesehen.telefon),
			'Das Telefon kündigt die Frage an, die es gerade zeigt'
		);

		const t = await text(leitung);
		behaupte(/[Aa]bgelehnt/.test(t), `Kein Ergebnis zum Rückkommen: ${t.slice(0, 250)}`);
		return 'abgelehnt, wie beantragt';
	});

	await schritt('Abgelehnt: das Geschäft sagt, dass der frühere Beschluss gilt', async () => {
		await rufeAuf(GESCHAEFTE[0][0]);
		const freigeben = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte((await freigeben.count()) === 0, 'Trotz abgelehntem Rückkommen wird Freigeben angeboten');
		const t = await text(leitung);
		behaupte(
			/frühere Beschluss gilt|bleibt in Kraft/i.test(t),
			`Die Folge des abgelehnten Rückkommens steht nicht da: ${t.slice(0, 350)}`
		);
	});

	await schritt('Zweites Geschäft: abstimmen, Rückkommen annehmen, neu abstimmen', async () => {
		await rufeAuf(GESCHAEFTE[1][0]);
		await stimmeAb('nein');

		await rufeAuf(GESCHAEFTE[1][0]);
		const wort = leitung.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' });
		behaupte(await wort.count(), 'Kein Rückkommen am zweiten Geschäft');
		await wort.first().click();
		await leitung.waitForTimeout(200);
		await abschicken(
			leitung,
			leitung.locator('.eingriffe form[action="?/rueckkommen"] button[type="submit"]')
		);
		await abschicken(leitung, leitung.locator('.rueckkommensweg form[action="?/aufrufen"] button'));
		await stimmeAb('ja');

		await rufeAuf(GESCHAEFTE[1][0]);
		const freigeben = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(
			await freigeben.count(),
			`Nach angenommenem Rückkommen fehlt die Freigabe: ${(await text(leitung)).slice(0, 350)}`
		);
		const t = await text(leitung);
		behaupte(
			/zurückgekommen|Rückkommen.{0,40}angenommen/i.test(t),
			`Die Seite sagt nicht, worauf der zweite Durchgang beruht: ${t.slice(0, 350)}`
		);
		/*
		 * **Auch das Telefon muss sagen, dass es der zweite ist**
		 * (Bedienbarkeitsprüfung 05.09.2026, Befund 4 der Telefonsicht). Die
		 * Karte war im zweiten Durchgang wortwörtlich dieselbe wie im ersten,
		 * während fünfzehn Zentimeter tiefer noch das alte Ergebnis stand — und
		 * der erklärende Satz stand allein auf dem Leitungsschirm, also dort, wo
		 * niemand abstimmt.
		 *
		 * Geprüft wird vor der Stimmabgabe: Danach ist die Karte eine andere.
		 */
		await stimmeAb('ja', null, async () => {
			await gehe(telefonA, '/z');
			const karte = (await telefonA.locator('.abstimmung').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/zweites Mal über dieselbe Sache/.test(karte),
				`Das Telefon sagt nicht, dass zum zweiten Mal abgestimmt wird: ${karte.slice(0, 300)}`
			);
			behaupte(
				/entscheidet neu/.test(karte),
				`Das Telefon sagt nicht, was der zweite Durchgang bewirkt: ${karte.slice(0, 300)}`
			);
		});
		behaupte(/[Aa]ngenommen/.test(await text(leitung)), 'Der zweite Durchgang kam nicht durch');
		return 'zweiter Durchgang angenommen, Telefon nennt ihn als zweiten';
	});

	await schritt('Verbraucht: kein dritter Durchgang ohne neuen Antrag', async () => {
		await rufeAuf(GESCHAEFTE[1][0]);
		const freigeben = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(
			(await freigeben.count()) === 0,
			'Nach dem verbrauchten Rückkommen wird erneut Freigeben angeboten'
		);
		const t = await text(leitung);
		behaupte(
			/bereits.{0,30}(neu|nochmals) abgestimmt|neuen Rückkommensantrag/i.test(t),
			`Die Seite erklärt den verbrauchten Antrag nicht: ${t.slice(0, 350)}`
		);
	});

	await schritt('Die Pause erreicht Wand und Telefon von selbst', async () => {
		/*
		 * **Der Anlassfall vom 22.08.2026**, gefunden im Usability-Durchgang: «Die
		 * Pause erreicht die Leinwand nie.» Der Strom trug die Marke, der Server
		 * verkündete sie, und im Strom stand geschrieben, die Saalsicht erkenne
		 * daran, dass sie nachladen müsse — nur las sie niemand. Die Wand hing am
		 * Traktandum, während die Leitung meldete, dort stehe die Pause.
		 *
		 * **Der Test darf deshalb nirgends selbst neu laden.** Genau das war die
		 * Lücke: Von Hand nachgeladen sah alles richtig aus. Gemessen wird, was
		 * ohne Zutun ankommt.
		 */
		const wartAufWand = async (seite, treffer, was) => {
			for (let i = 0; i < 40; i++) {
				const inhalt = await ganz(seite).catch(() => '');
				if (treffer.test(inhalt)) return i * 250;
				await seite.waitForTimeout(250);
			}
			throw new Error(`${was} — nach 10 s nicht angekommen: ${(await ganz(seite)).slice(0, 200)}`);
		};

		await gehe(beamer, '/p');
		await gehe(telefonA, '/z');
		const vorher = await ganz(beamer);
		behaupte(!/^\s*Pause\s*$/m.test(vorher), 'Die Wand steht schon vor dem Schalten auf Pause');

		await abschicken(
			leitung,
			leitung.locator('form[action="?/pause"].anschalten button[type="submit"]')
		);
		const anMs = await wartAufWand(beamer, /Pause/, 'Wand: Pause an');
		await wartAufWand(telefonA, /Pause/, 'Telefon: Pause an');

		await abschicken(leitung, leitung.locator('form[action="?/pause"] button.haupt'));
		const ausMs = await wartAufWand(beamer, /^(?!.*Pause).*$/s, 'Wand: zurück aus der Pause');

		return `Wand nach ${anMs} ms unterbrochen, nach ${ausMs} ms zurück`;
	});

	await schritt('Die Pause verdeckt auch die Beschlussfähigkeit an der Wand', async () => {
		/*
		 * **Der Durchstich für den Beamer-Fix vom 01.09.2026.**
		 *
		 * Beim Pflichttraktandum «Begrüssung und Feststellung der
		 * Beschlussfähigkeit» füllt die Beschlussfähigkeit die Wand (Auftraggeber,
		 * 24.08.2026: «Das Pflichttraktandum […] braucht die Sicht, um zu sehen,
		 * ob man beschlussfähig ist»). Sie stand aber VOR dem Saalbild statt in
		 * ihm — und verdrängte damit auch das, was Vorrang hat: Wer in diesem
		 * Punkt eine Pause einlegte, bekam an der Wand weiter die Balken zu
		 * sehen, während im Saal niemand mehr da war.
		 *
		 * Geprüft wird die Rangfolge selbst, in beide Richtungen: Die Balken
		 * stehen, die Pause deckt sie zu, und nach «Fortfahren» stehen sie
		 * wieder da. Der mittlere Schritt ist der, der im Defekt rot wird.
		 *
		 * **Ohne eigenes Neuladen**, wie im Schritt darüber: Von Hand nachgeladen
		 * sähe auch die alte Fassung richtig aus — die Wand holt sich den Punkt
		 * dann ohnehin frisch. Gemessen wird, was über den Strom ankommt.
		 */
		/*
		 * **Jeder Zugriff mit `catch`.** Die Wand lädt bei einer Strom-Nachricht
		 * von selbst neu; trifft ein Zugriff genau dahinein, wirft Playwright
		 * «Execution context was destroyed» und ein intakter Durchstich wäre rot.
		 * Der ältere Pausenschritt darüber macht es aus demselben Grund so.
		 */
		const warteAufWand = async (treffer, was) => {
			for (let i = 0; i < 40; i++) {
				if (await treffer().catch(() => false)) return i * 250;
				await beamer.waitForTimeout(250);
			}
			const zuletzt = await ganz(beamer).catch(() => '(Seite lud gerade neu)');
			throw new Error(`${was} — nach 10 s nicht eingetreten: ${zuletzt.slice(0, 250)}`);
		};
		/*
		 * **Die Anzeige im Fuss zählt nicht mit.** `/p` zeigt die
		 * Beschlussfähigkeit immer — klein, unten, als Voraussetzung jedes
		 * Beschlusses. Dieselbe Komponente steht im Vordergrund, wenn der Punkt
		 * sie zum Gegenstand hat. Ein blosses `.anzeige.saal` fände deshalb
		 * immer etwas; gefragt ist die im Bild, also alle minus die im Fuss.
		 */
		const balken = async () =>
			(await beamer.locator('.anzeige.saal').count()) -
			(await beamer.locator('footer .anzeige.saal').count());
		/*
		 * **`null` heisst «nicht ablesbar», nicht «leer»** (Code-Review
		 * 01.09.2026). Die erste Fassung fiel auf `''` zurück, und
		 * `!/Pause/.test('')` ist wahr: Der Schritt «zurück aus der Pause» wäre
		 * grün geworden, ohne die Wand je gesehen zu haben.
		 */
		const wandtext = async () => await ganz(beamer).catch(() => null);

		await rufeAuf('Begrüssung und Feststellung der Beschlussfähigkeit');
		await gehe(beamer, '/p');
		await warteAufWand(
			async () => (await balken()) > 0,
			'Wand: die Beschlussfähigkeit füllt den Punkt nicht'
		);

		await abschicken(
			leitung,
			leitung.locator('form[action="?/pause"].anschalten button[type="submit"]')
		);
		const zuMs = await warteAufWand(
			async () => {
				const t = await wandtext();
				return t !== null && (await balken()) === 0 && /Pause/.test(t);
			},
			'Wand: die Pause verdeckt die Beschlussfähigkeit nicht'
		);

		await abschicken(leitung, leitung.locator('form[action="?/pause"] button.haupt'));
		const zurueckMs = await warteAufWand(
			async () => {
				const t = await wandtext();
				return t !== null && (await balken()) > 0 && !/Pause/.test(t);
			},
			'Wand: nach dem Fortfahren fehlt die Beschlussfähigkeit'
		);

		return `zugedeckt nach ${zuMs} ms, zurück nach ${zurueckMs} ms`;
	});

	/*
	 * **Der Ausweg steht beim Traktandum, das ihn braucht** (Vorgabe des Auftraggebers,
	 * 11.09.2026: «Traktandum 1 Beschlussfähigkeit braucht noch den Exit der
	 * Vertagung, wenn die Beschlussfähigkeit nicht gegeben ist»).
	 *
	 * Bis dahin stand das Vertagen allein auf der Anwesenheitsseite — ein
	 * Seitenwechsel vor Publikum, und zwar für die Entscheidung, die den Abend
	 * beendet. Gemessen wird hier, DASS er dasteht und zugeklappt ist; dass er
	 * bei fehlender Beschlussfähigkeit hervorgehoben wird, hängt an einer Klasse
	 * und wurde am 11.09.2026 im Browser nachgemessen (neun Parteien gehen
	 * lassen, Klasse `dringend` erscheint, wieder hereinlassen, sie verschwindet).
	 *
	 * Der Schritt läuft direkt nach dem vorigen, in dem das Traktandum aufgerufen
	 * wurde. Ein eigener Aufruf wäre eine zweite Wahrheit über denselben Zustand.
	 */
	await schritt('Am Traktandum der Beschlussfähigkeit steht der Ausweg', async () => {
		const kasten = leitung.locator('.festhalten');
		behaupte(await kasten.count(), 'Kein Feststellungsblock am aufgerufenen Traktandum');
		behaupte(
			await kasten.locator('form[action="?/festhalten"] button').count(),
			'Der Knopf zum Festhalten fehlt — dann wird nichts protokolliert'
		);
		const ausweg = kasten.locator('details.vertagen');
		behaupte(
			await ausweg.count(),
			'Kein Weg zum Vertagen am Traktandum — der Ausweg läge wieder nur auf der Anwesenheitsseite'
		);
		behaupte(
			!(await ausweg.evaluate((d) => d.open)),
			'Der Ausweg steht offen — «vertagen» soll kein Knopf sein, den man aus Versehen trifft'
		);
		// Der Grund ist Pflicht und steht im Protokoll; ohne die Auswahl wäre der
		// Weg da und führte in eine Absage aus der Tiefe.
		await ausweg.locator('summary').click();
		const gruende = await ausweg.locator('select[name="grund"] option').count();
		behaupte(gruende >= 3, `Die Auswahl nennt ${gruende} statt drei Einträge (leer + zwei Gründe)`);
		return `zugeklappt, ${gruende - 1} Gründe`;
	});

	await schritt('Die nötige Mehrheit steht VOR der Abstimmung da', async () => {
		/*
		 * **Der Anlassfall vom 22.08.2026**, Usability-Durchgang C: «Die nötige
		 * Mehrheit steht nirgends vor der Abstimmung.» Überall stand der Fallname
		 * des Erfordernisses — «Notwendige bauliche Massnahme» —, die Zahl kam
		 * erst mit dem Ergebnis. Traktandum 6 brauchte vier von fünf Ja; dass es
		 * aufging, lag an einer Vollmacht, und gemerkt hat es niemand, bis die
		 * Abstimmung vorbei war.
		 *
		 * Geprüft wird deshalb der Zustand **vor** dem Öffnen: aufgerufen, noch
		 * keine Abstimmung. Genau dann kann der Saal noch etwas tun.
		 */
		await rufeAuf(GESCHAEFTE[2][0]);

		const leitungstext = await ganz(leitung);
		const stelle = leitungstext.indexOf('Aktuelles Geschäft');
		behaupte(
			/Nötig:.*\d+ von \d+/.test(leitungstext),
			`Die Leitung nennt die nötige Zahl nicht. Bereich «Aktuelles Geschäft» ab ${stelle}: ` +
				leitungstext.slice(stelle, stelle + 500)
		);
		behaupte(
			/Kopfstimmen \(/.test(leitungstext),
			'Die Zahl steht ohne ihre Bezugsgrösse da — «nötig 4» allein sagt nicht, wovon.'
		);

		await gehe(beamer, '/p');
		const wand = await ganz(beamer);
		behaupte(
			/Nötig:.*\d+ von \d+/.test(wand),
			`Die Wand nennt die nötige Zahl nicht: ${wand.slice(0, 400)}`
		);

		const zahl = leitungstext.match(/Nötig: (\d+) von (\d+)/);
		return `Leitung und Wand nennen ${zahl?.[1]} von ${zahl?.[2]}`;
	});

	await schritt('Die Wand verrät zwischendurch nie ein offenes Ergebnis', async () => {
		await rufeAuf(GESCHAEFTE[2][0]);
		await abschicken(leitung, leitung.locator('form[action="?/oeffnen"] button[type="submit"]'));
		await gehe(beamer, '/p');
		const wand = await ganz(beamer);
		behaupte(
			!/Angenommen|Abgelehnt/i.test(wand.split(GESCHAEFTE[2][0])[1] ?? ''),
			`Die Wand zeigt ein Ergebnis, bevor geschlossen wurde: ${wand.slice(0, 300)}`
		);
		await gehe(telefonA, '/z');
		behaupte(
			(await telefonA.locator('form.wahl button').count()) > 0,
			`Das Telefon kann nicht abstimmen: ${(await text(telefonA)).slice(0, 250)}`
		);

		return 'Frage ja, Ergebnis nein';
	});

	await schritt('Die Leitung zieht nach, wenn ein Telefon stimmt', async () => {
		/*
		 * **Der Anlassfall vom 21.08.2026.** «Das automatische Laden bei der
		 * Leitungsansicht bei den Bullets geschieht noch nicht, wenn ein
		 * Eigentümer abgestimmt hat, bzw. die Stimme geändert hat.»
		 *
		 * Geprüft wird ohne jedes Zutun des Drehbuchs: Die Leitungsseite bleibt
		 * offen, das Telefon stimmt, und die Seite muss sich **von selbst**
		 * nachziehen. Ein `goto` dazwischen würde genau das verdecken, was hier
		 * gemessen werden soll.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const auf = leitung.locator('details.stellvertretend summary, details.erfassung summary');
		if (await auf.count()) {
			await auf.first().click();
			await leitung.waitForTimeout(200);
		}

		// Datenabrufe zählen: Sie sind der Beleg, dass die Seite nachlädt.
		let abrufe = 0;
		const zaehler = (r) => {
			if (r.url().includes('/leitung') && r.url().includes('__data.json')) abrufe++;
		};
		leitung.on('response', zaehler);

		try {
			// ── Erste Stimme ────────────────────────────────────────────────
			await gehe(telefonA, '/z');
			const ja = telefonA.locator('form.wahl button.ja').first();
			behaupte(await ja.count(), 'Das Telefon zeigt keine Wahl');
			await abschicken(telefonA, ja);

			const marke = leitung.locator('tr.selbst .marke', { hasText: 'hat selbst gestimmt' });
			await marke.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
			behaupte(
				await marke.count(),
				'Die Leitung zieht nach einer Stimme nicht nach — die Tabelle bleibt auf dem ' +
					'Stand des Seitenaufrufs stehen'
			);

			// Und die Wahl selbst steht **nicht** da: Wer sie sähe, könnte den
			// Zeitpunkt des Schliessens nach dem Zwischenstand wählen.
			const angekreuzt = await leitung
				.locator('tr.selbst input[type="radio"]:checked')
				.count();
			behaupte(angekreuzt === 0, 'Die Stimme des Telefons steht offen in der Erfassung');
			behaupte(
				await leitung.locator('tr.selbst button', { hasText: 'Stimme ändern' }).count(),
				'Kein Weg, eine abgegebene Stimme zu berichtigen'
			);

			// ── Berichtigung: dieselbe Partei ändert ihre Stimme ────────────
			const vorher = abrufe;
			await gehe(telefonA, '/z');
			const nein = telefonA.locator('form.wahl button.nein').first();
			behaupte(await nein.count(), 'Das Telefon lässt keine Berichtigung zu');
			await abschicken(telefonA, nein);

			for (let i = 0; i < 30 && abrufe === vorher; i++) await leitung.waitForTimeout(500);
			behaupte(
				abrufe > vorher,
				'Eine geänderte Stimme löst kein Nachladen aus — die Zahl der Parteien ' +
					'bleibt gleich, und nur darauf hat die Seite geschaut'
			);

			/*
			 * **Wenn alle gestimmt haben, führt der Schliessen-Knopf** (21.08.2026).
			 * Vorher war es umgekehrt: hervorgehoben, solange Stimmen fehlten,
			 * unscheinbar, sobald der Durchgang fertig war.
			 *
			 * **Der Fall muss dafür wirklich eintreten.** Zwei der drei Parteien
			 * haben ein Telefon; die dritte trägt die Sitzungsleitung ein. Ohne
			 * diesen Schritt wäre die Bedingung nie erfüllt, und die Prüfung liefe
			 * ins Leere — grün, ohne etwas gesehen zu haben.
			 */
			await gehe(telefonB, '/z');
			const jaB = telefonB.locator('form.wahl button.ja').first();
			behaupte(await jaB.count(), 'Das zweite Telefon zeigt keine Wahl');
			await abschicken(telefonB, jaB);

			await gehe(leitung, `/versammlungen/${versammlung}/leitung`);

			/*
			 * **Enter darf keine Stimme erfassen** (28.08.2026). Im Formular «Für
			 * eine Partei stimmen» stand das Feld «Warum Sie erfassen» vor den
			 * Knöpfen «Ja erfassen», «Nein erfassen» und «Enthaltung». Der
			 * Vorgabeknopf eines Formulars ist sein erster Absendeknopf in
			 * Baumreihenfolge, und Enter in irgendeinem Feld löst genau den aus: mit
			 * demselben Aufbau in Chromium gemessen `wahl = yes`. Dasselbe gilt für
			 * das Suchfeld der Parteiwahl, das aus `Wahlliste` kommt.
			 *
			 * **Warum hier und nicht als eigener Schritt.** Das Formular gibt es nur,
			 * solange eine Abstimmung offen ist, und dies ist die einzige Stelle mit
			 * offener Abstimmung und geladener Leitungsseite. Ein eigener Schritt
			 * müsste eine Abstimmung öffnen und wieder schliessen und nähme dem
			 * nächsten seine weg. Der Preis: Bricht oben in diesem Schritt etwas
			 * anderes, läuft diese Probe nicht.
			 */
			const fuerEine = leitung.locator('details.stellvertretend', {
				hasText: 'Für eine Partei stimmen'
			});
			behaupte(await fuerEine.count(), 'Kein Weg, für eine einzelne Partei zu stimmen');
			await fuerEine.locator('summary').first().click();
			await leitung.waitForTimeout(200);
			/*
			 * **Erst eine Partei wählen.** Ohne sie ist das Auswahlfeld `required`
			 * (`Wahlliste`, `pflicht`), und die Feldprüfung des Browsers hält schon
			 * die Absendung auf: Die Probe wäre dann mit und ohne Riegel grün. Genau
			 * das ist beim ersten Anlauf am 28.08.2026 passiert.
			 */
			const partei = fuerEine.locator('fieldset.parteiwahl input[type="radio"]').first();
			behaupte(await partei.count(), 'Keine Partei zur Wahl im Formular für eine einzelne');
			await partei.check();
			const grundfeld = fuerEine.locator('input[name="begruendung"]');
			await grundfeld.fill('Enter darf hier nichts erfassen');

			/*
			 * **Die Anfrage zählen, nicht auf eine Antwort warten.** Ein erster
			 * Anlauf horchte auf irgendeine POST-**Antwort** binnen 2500 ms. Zwei
			 * Löcher: Auf dieser Seite sichert `SicherndesFeld` im Hintergrund per
			 * POST, das hätte einen Befund erfunden; und bleibt eine echte Absendung
			 * unbeantwortet oder wird sie abgebrochen, kommt nie eine Antwort, und
			 * das Schweigen hätte als Beweis gegolten. Die Anfrage ist der
			 * Augenblick, auf den es ankommt.
			 */
			const gesehen = [];
			const horcher = (r) => {
				if (r.method() === 'POST') gesehen.push(r.url());
			};
			leitung.on('request', horcher);
			try {
				await grundfeld.press('Enter');
				await leitung.waitForTimeout(500);
			} finally {
				leitung.off('request', horcher);
			}
			const anDieAktion = gesehen.filter((u) => u.includes('?/stellvertretend'));
			behaupte(
				anDieAktion.length === 0,
				`Enter hat abgesendet, an «${anDieAktion[0]}»: das erfasst eine Stimme`
			);
			await fuerEine.locator('summary').first().click();

			const block = leitung.locator('details.stellvertretend', { hasText: 'von Hand erfassen' });
			behaupte(await block.count(), 'Kein Weg, eine Stimme von Hand zu erfassen');
			await block.locator('summary').first().click();
			await leitung.waitForTimeout(200);
			await block.locator('input[name="begruendung"]').fill('Caduff ohne Gerät, im Saal abgestimmt');
			const zeileC = leitung.locator('tr', { hasText: LEUTE[2] });
			behaupte(await zeileC.count(), `Keine Zeile für ${LEUTE[2]}`);
			await zeileC.locator('input[type="radio"][value="yes"]').first().check();
			await abschicken(
				leitung,
				block.locator('form[action="?/erfassen"] button[type="submit"]')
			);

			const seitentext = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Alle \d+ haben abgestimmt/.test(seitentext),
				`Nicht alle gezählt — die Prüfung liefe ins Leere: ${seitentext.slice(0, 200)}`
			);
			const schliessen = leitung.locator('form[action="?/schliessen"] button[type="submit"]');
			behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen');
			const klasse = (await schliessen.first().getAttribute('class')) ?? '';
			behaupte(
				klasse.includes('haupt'),
				`Alle haben gestimmt, der Knopf ist trotzdem leise: «${klasse}»`
			);
		} finally {
			leitung.off('response', zaehler);
		}

		// Aufräumen: Solange eine Abstimmung offen ist, blendet die Leitung den
		// Ablauf aus — die folgenden Schritte kämen an keinen Knopf mehr.
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));
		return 'Stimme und Berichtigung kamen an';
	});

	// ── Was sonst noch vorkommt ─────────────────────────────────────────────
	console.log('\nWeitere Fälle');

	await schritt('Eine Kenntnisnahme bietet keine Abstimmung an', async () => {
		await rufeAuf('Bericht der Revisionsstelle');
		const freigeben = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(
			(await freigeben.count()) === 0,
			'Über eine Kenntnisnahme liesse sich abstimmen — sie kennt gar kein Erfordernis'
		);
		const t = await text(leitung);
		behaupte(
			/zur Kenntnis/i.test(t),
			`Die Seite sagt nicht, dass hier nichts zu beschliessen ist: ${t.slice(0, 300)}`
		);
		await gehe(beamer, '/p');
		behaupte(
			(await ganz(beamer)).includes('Bericht der Revisionsstelle'),
			'Die Wand folgt der Kenntnisnahme nicht'
		);
		return 'Wand folgt, kein Knopf';
	});

	await schritt('Zurückgezogen ist nicht abgelehnt', async () => {
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const zeile = leitung.locator('.baum li', { hasText: 'Erneuerungsfonds' }).first();
		const auf = zeile.locator('details.rueckzug summary');
		behaupte(await auf.count(), 'Kein Weg, einen Antrag zurückzuziehen');
		await auf.click();
		await leitung.waitForTimeout(150);
		await zeile.locator('input[name="grund"]').fill('Offerte liegt noch nicht vor');
		await abschicken(leitung, zeile.locator('form[action="?/zurueckziehen"] button[type="submit"]'));

		const nachher = leitung.locator('.baum li', { hasText: 'Erneuerungsfonds' }).first();
		const t = (await nachher.innerText()).replace(/\s+/g, ' ');
		behaupte(/zurückgezogen/i.test(t), `Die Marke fehlt: ${t.slice(0, 200)}`);
		behaupte(!/abgelehnt/i.test(t), `Zurückgezogen erscheint als abgelehnt: ${t.slice(0, 200)}`);
		behaupte(
			(await nachher.locator('form[action="?/aufrufen"] button').count()) === 0,
			'Ein zurückgezogener Antrag lässt sich noch aufrufen'
		);
		return 'Marke statt Ergebnis';
	});

	await schritt('Zurückgezogen: kein Knopf in den Serverfehler — und ein Weg zurück', async () => {
		/*
		 * **Der Befund vom 21.08.2026**: «Wenn der Antrag zurückgezogen ist, bitte
		 * dann die Abstimmungsmöglichkeit entfernen. WEnn man darauf klickt kommt
		 * bei Rückzug ein 500er fehler.»
		 *
		 * Der Fall entsteht in dieser Reihenfolge: **aufrufen, DANN zurückziehen.**
		 * Dann steht das Traktandum als aufgerufenes da, und dort stand «Abstimmung
		 * freigeben» — die Regel gab es nur als Datenbanktrigger, und der wirft
		 * eine weisse Seite statt einer Auskunft. Nachgestellt und gemessen.
		 */
		await rufeAuf(GESCHAEFTE[3][0]);
		const zurueckziehen = leitung.locator('.eingriffe .wort', { hasText: 'Zurückziehen' });
		behaupte(await zurueckziehen.count(), 'Kein «Zurückziehen» am aufgerufenen Geschäft');
		await zurueckziehen.first().click();
		await leitung.waitForTimeout(200);
		await leitung.locator('.eingriffe form[action="?/zurueckziehen"] input[name="grund"]').fill(
			'Offerte liegt noch nicht vor'
		);
		await abschicken(
			leitung,
			leitung.locator('.eingriffe form[action="?/zurueckziehen"] button[type="submit"]')
		);

		behaupte(
			(await leitung.locator('form[action="?/oeffnen"] button').count()) === 0,
			'«Abstimmung freigeben» steht am zurückgezogenen Antrag'
		);
		/*
		 * **Der Knopf am aufgerufenen Geschäft, nicht der erste auf der Seite**
		 * (06.09.2026). Seit die Rücknahme auch an den Zeilen der Liste steht
		 * (Bedienbarkeitsprüfung 05.09.2026, zweiter der schweren Befunde), gibt
		 * es mehrere davon — und der Ablauf links steht im Baum vor dem Kasten
		 * «Aktuelles Geschäft». Ein `.first()` nahm damit den Rückzug eines
		 * anderen Traktandums zurück, und der Schritt meldete danach «Nach der
		 * Rücknahme fehlt die Freigabe»: richtig gemessen, falsch gedrückt.
		 */
		const zurueck = leitung.locator(
			'section.geschaeft form[action="?/rueckzugZurueck"] button'
		);
		behaupte(
			await zurueck.count(),
			`Kein Weg, den Rückzug zurückzunehmen: ${(await text(leitung)).slice(0, 300)}`
		);

		/*
		 * **Und der Server hält auch ohne Knopf.** Ein zweites Fenster oder der
		 * Zurück-Knopf kommen an derselben Stelle vorbei; dort muss eine Auskunft
		 * stehen, keine weisse Seite. Die Kennung steckt im Formular daneben.
		 */
		const id = await leitung
			.locator('section.geschaeft form[action="?/rueckzugZurueck"] input[name="traktandum"]')
			.first()
			.inputValue();
		const antwort = await leitung.evaluate(
			async ([v, t]) => {
				const r = await fetch(`/versammlungen/${v}/leitung?/oeffnen`, {
					method: 'POST',
					headers: {
						'x-sveltekit-action': 'true',
						'content-type': 'application/x-www-form-urlencoded'
					},
					body: new URLSearchParams({ traktandum: t }).toString()
				});
				return { status: r.status, text: await r.text() };
			},
			[versammlung, id]
		);
		behaupte(antwort.status === 200, `Serverfehler statt Auskunft: ${antwort.status}`);
		behaupte(
			/zurückgezogen/.test(antwort.text) && /failure/.test(antwort.text),
			`Keine fachliche Absage: ${antwort.text.slice(0, 200)}`
		);

		// Zurücknehmen — danach ist der Antrag wieder abstimmbar.
		await abschicken(leitung, zurueck.first());
		behaupte(
			await leitung.locator('form[action="?/oeffnen"] button').count(),
			'Nach der Rücknahme fehlt die Freigabe'
		);
		return 'kein Knopf, Absage statt 500, Rücknahme wirkt';
	});

	await schritt('Ausstand: suchen, mehrere ankreuzen, ein Grund', async () => {
		/*
		 * **Zwei Meldungen vom 21.08.2026 in einem Schritt.** «Bei Ausstand
		 * müsste noch eine Schnellsuche rein. Sonst wird es mühsam, wenn man bei
		 * 80 Köpfen den richtigen Namen suchen muss» — und «Es müssten auch
		 * mehrere als Auswahl möglich sein.» Der Fall dahinter: Eine Firma gehört
		 * mehreren Eigentümern; sie treten gemeinsam in den Ausstand, mit
		 * demselben Grund.
		 */
		await rufeAuf(GESCHAEFTE[3][0]);
		const wort = leitung.locator('.eingriffe .wort', { hasText: 'Ausstand' });
		behaupte(await wort.count(), 'Kein Ausstand am aufgerufenen Geschäft');
		await wort.first().click();
		await leitung.waitForTimeout(200);

		const form = leitung.locator('form[action="?/ausstand"]');
		const suche = form.locator('input[type="search"]');
		behaupte(await suche.count(), 'Keine Schnellsuche im Ausstand');

		const alle = await form.locator('.wahlliste li').count();
		behaupte(alle >= 3, `Zu wenige Parteien zur Wahl: ${alle}`);
		await suche.fill(LEUTE[0]);
		await leitung.waitForTimeout(250);
		const gefiltert = await form.locator('.wahlliste li').count();
		behaupte(
			gefiltert < alle && gefiltert > 0,
			`Die Suche filtert nicht: ${alle} Zeilen vorher, ${gefiltert} nachher`
		);

		// Ein Name, der niemandem gehört: Die Liste sagt es, statt leer dazustehen.
		await suche.fill('Zzzz');
		await leitung.waitForTimeout(250);
		behaupte(
			await form.locator('.wahlliste .leer').count(),
			'Ohne Treffer steht die Liste wortlos leer'
		);

		// Zwei ankreuzen, ein Grund für beide.
		await suche.fill('');
		await leitung.waitForTimeout(250);
		const kaestchen = form.locator('.wahlliste input[type="checkbox"]');
		await kaestchen.nth(0).check();
		await kaestchen.nth(1).check();
		await form.locator('input[name="grund"]').fill('Beide gehören der beauftragten Firma.');
		await abschicken(leitung, form.locator('button[type="submit"]'));

		const t = await text(leitung);
		behaupte(
			// Wortlaut von `ausstandsmeldung` seit 05b58bf (24.09.2026).
			/sind bei diesem Traktandum in den Ausstand getreten/.test(t),
			`Zwei Ausstände auf einmal wurden nicht erfasst: ${t.slice(0, 300)}`
		);
		return 'gefiltert, zwei erfasst';
	});

	await schritt('Gegenantrag: zurückziehen macht den Grundantrag wieder frei', async () => {
		/*
		 * **Die Zusage vom 21.08.2026** — «Ein Rückzug des Gegenantrags muss
		 * möglich sein bis zur Abstimmungsfreigabe, und der ursprüngliche Antrag
		 * sollte dann wieder abstimmbar sein.»
		 *
		 * Beides prüft dieser Schritt am lebenden System: Der Gegenantrag
		 * entsteht als eigenes Traktandum unter dem Grundantrag, der
		 * Reihenfolgehinweis nennt ihn, nach dem Rückzug verschwindet der Hinweis
		 * — und über den Grundantrag lässt sich abstimmen.
		 */
		await rufeAuf(GESCHAEFTE[3][0]);
		const wort = leitung.locator('.eingriffe .wort', { hasText: 'Gegenantrag' });
		behaupte(await wort.count(), 'Kein Weg zum Gegenantrag');
		await wort.first().click();
		await leitung.waitForTimeout(250);

		const feld = leitung.locator('.eingriffe .feld');

		/*
		 * **Wer den Antrag stellt, steht in einem eigenen Feld** (21.08.2026) —
		 * mit Schnellsuche und Mehrfachauswahl, und getrennt vom Antragstext,
		 * damit dieser ohne Personendaten an ein Sprachmodell gehen kann.
		 */
		/*
		 * **Nach dem Namen greifen, nicht nach der Art des Feldes** (26.08.2026).
		 * Seit die Fallauswahl im selben Kasten ihr eigenes Suchfeld einblendet
		 * (`Suchauswahl`, ab neun Einträgen), gibt es hier **zwei**
		 * `input[type="search"]`, und der Lauf brach mit «strict mode violation»
		 * ab. Das `aria-label` benennt genau das gemeinte.
		 */
		const suchfeld = feld.locator('input[type="search"][aria-label="Antragsteller suchen"]');
		behaupte(await suchfeld.count(), 'Keine Schnellsuche beim Antragsteller');
		const alle = await feld.locator('.wahlliste li').count();
		await suchfeld.fill(LEUTE[1]);
		await leitung.waitForTimeout(250);
		behaupte(
			(await feld.locator('.wahlliste li').count()) < alle,
			'Die Antragstellersuche filtert nicht'
		);

		/*
		 * **Ankreuzen, dann weitersuchen** — genau die Bewegung, bei der die
		 * Auswahl verschwand. Steht sie im DOM, entfernt der nächste Filter das
		 * Ankreuzfeld, und beim Abschicken fehlt der Name: ohne Meldung, ohne
		 * Spur. Gemessen am 21.08.2026, von zwei Angekreuzten kam einer an.
		 */
		await feld.locator('.wahlliste input[type="checkbox"]').first().check();
		await suchfeld.fill(LEUTE[2]);
		await leitung.waitForTimeout(250);
		await feld
			.locator('.wahlliste li')
			.filter({ hasText: LEUTE[2] })
			.locator('input[type="checkbox"]')
			.first()
			.check();
		await suchfeld.fill('Zzzz');
		await leitung.waitForTimeout(250);

		/*
		 * **Der Kern der Sache: Beide Werte sind noch im Formular** — obwohl der
		 * Filter gerade keinen von ihnen zeigt. Stünde die Auswahl nur im DOM der
		 * Liste, wäre sie jetzt weg, und beim Abschicken fehlte sie ohne Meldung.
		 */
		const gewaehlt = await feld
			.locator('input[name="antragsteller"]:checked, input[type="hidden"][name="antragsteller"]')
			.count();
		behaupte(
			gewaehlt === 2,
			`Nach dem Weitersuchen sind ${gewaehlt} von 2 Antragstellern übrig — die Auswahl ` +
				'hängt am Filter'
		);

		await feld.locator('input[name="titel"]').fill('Reinigung nur alle zwei Jahre');
		await feld
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Tiefgarage wird alle zwei Jahre gereinigt.');
		/*
		 * **Das Mehrheitserfordernis gleich hier wählen** (F5, 15.10.2026).
		 *
		 * Bis `fca4644` (09.10.2026) erbte dieser Gegenantrag das Erfordernis
		 * des Grundantrags, und der Server antwortete mit der Quittung. Seit
		 * Folgeanträge nicht mehr erben, reist der Satz «Vor der Abstimmung
		 * fehlt noch das Mehrheitserfordernis» als stehende Warnung
		 * (`Saalaufnahme.warnung`, Produktentscheid 06.10.2026), und die
		 * Seite bleibt bei der Warnung stehen, statt zur neuen Zeile zu rollen.
		 *
		 * Dieser Schritt misst den anderen Weg: Mit gewähltem Mehr antwortet
		 * der Server mit der Quittung, und die Seite holt die neue Zeile ins
		 * Bild (Bedienbarkeitsprüfung 05.09.2026, Befund 5). Die Zusicherung
		 * unten prüft damit weiterhin den Seitensprung.
		 *
		 * Den Transport als stehende Warnung misst `durchspielen` («Ein
		 * Folgeantrag mit milderem Mehr als die Einladung steht ohne Mehr
		 * da»: die Warnung ist nach 7,5 Sekunden noch sichtbar), dort aber
		 * für das mildere Mehr, nicht für das fehlende. Ungemessen sind der
		 * Satz «fehlt noch das Mehrheitserfordernis» im Saal und dass die
		 * Seite bei einer Warnung nicht zur Zeile rollt.
		 */
		await feld.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(leitung, feld.locator('button[type="submit"]'));

		const nachher = await text(leitung);
		behaupte(
			/Reinigung nur alle zwei Jahre/.test(nachher),
			`Der Gegenantrag steht nicht auf der Liste: ${nachher.slice(0, 300)}`
		);

		/*
		 * **Was nach dem Aufnehmen auf dem Bildschirm steht** (Bedienbarkeits-
		 * prüfung 05.09.2026, Befund 5 der Bewirtschaftersicht): «Das Formular
		 * bleibt ausgefüllt stehen, die neue Zeile entsteht ausserhalb des
		 * Blicks. Ein zweiter Klick erzeugte einen identischen Folgeantrag.»
		 *
		 * Beides zusammen ergibt den Fehlgriff: Wer die Wirkung nicht sieht und
		 * seinen Text noch dastehen sieht, drückt noch einmal.
		 */
		const titelfeld = feld.locator('input[name="titel"]');
		const stehengeblieben = await titelfeld.inputValue();
		behaupte(
			stehengeblieben === '',
			`Das Formular steht nach dem Aufnehmen noch ausgefüllt da: «${stehengeblieben}»`
		);
		/*
		 * **Gemeint ist die Zeile im Traktandenbaum**, nicht irgendeine Fundstelle
		 * des Titels. Zwei Anläufe davor massen etwas anderes und sahen dabei aus
		 * wie ein Ergebnis: `.last()` traf die unterste von mehreren Fundstellen,
		 * also eine, zu der niemand rollen will (rot, obwohl der Fix wirkte); ein
		 * `some()` über alle traf den Eingriffe-Kasten weiter oben, der ohnehin
		 * immer im Bild steht (grün, auch mit ausgebautem Fix).
		 *
		 * Der Baum ist der Ort, an dem das Aufgenommene als Traktandum erscheint,
		 * und `[data-traktandum]` ist genau die Marke, die der Seiteneffekt
		 * anspringt.
		 */
		const hoehe = leitung.viewportSize()?.height ?? 0;
		const imBaum = leitung
			.locator('.baum [data-traktandum]')
			.filter({ hasText: 'Reinigung nur alle zwei Jahre' });
		/*
		 * Gemessen wird, ob **eine** Fundstelle im Bild steht: Der ganze Baum
		 * liegt ohne Zutun am Seitenende.
		 */
		/*
		 * **Läuft der Seiteneffekt überhaupt?** Die Marke `.eben` setzt genau er.
		 * Ohne diese Prüfung sagt ein rotes Ergebnis nicht, ob der Effekt nicht
		 * lief oder ob er lief und das Rollen nichts bewirkte — zwei ganz
		 * verschiedene Ursachen, und die Lagen allein unterscheiden sie nicht.
		 */
		const markiert = await leitung.locator('.baum li.eben').count();
		behaupte(markiert === 1, `Die eben aufgenommene Zeile ist ${markiert}-mal markiert`);

		const lagen = [];
		for (const t of await imBaum.all()) {
			const k = await t.boundingBox();
			if (k) lagen.push(Math.round(k.y));
		}
		behaupte(
			lagen.length > 0,
			'Die neue Zeile ist im Traktandenbaum nicht messbar — der Schritt prüft sonst nichts'
		);
		behaupte(
			lagen.some((y) => y >= 0 && y <= hoehe),
			`Der Traktandenbaum zeigt die neue Zeile bei y = ${lagen.join(', ')} px, das Fenster ` +
				`ist ${hoehe} px hoch — die Wirkung des Knopfdrucks liegt ausserhalb des Blicks`
		);

		/*
		 * **Der Ausstand am Grundantrag gilt für den Folgeantrag nicht von selbst**
		 * (22.08.2026, Befund C-02). Im Prüflauf trat eine Partei bei Traktandum 7
		 * in den Ausstand; beim Folgeantrag 7.1 zur selben Sache stand sie wieder
		 * mit voller Stimmkraft da. Fachlich richtig — ein Ausstand wird Fall für
		 * Fall erklärt —, aber niemand denkt im Saal daran.
		 *
		 * Geprüft wird die Erinnerung, nicht eine Automatik: Über Befangenheit
		 * entscheidet die Versammlung.
		 */
		/*
		 * **Kein stilles Überspringen.** Stünde der folgende Block in einem
		 * ungeprüften `if`, wäre der Schritt auch dann grün, wenn er gar nichts
		 * gemessen hat — die häufigste Art, sich einen Test vorzumachen.
		 */
		const ausstandsweg = leitung.locator('.eingriffe .wort', { hasText: 'Ausstand' });
		behaupte(
			await ausstandsweg.count(),
			'Kein Weg zum Ausstand am Grundantrag — die Erinnerung liesse sich nicht prüfen'
		);
		{
			await ausstandsweg.first().click();
			await leitung.waitForTimeout(200);
			const af = leitung.locator('form[action="?/ausstand"]');
			await af.locator('.wahlliste input[type="checkbox"]').first().check();
			await af.locator('input[name="grund"]').fill('Mit dem Reinigungsunternehmen verbunden.');
			await abschicken(leitung, af.locator('button[type="submit"]'));

			// Jetzt den Folgeantrag aufrufen — dort muss die Erinnerung stehen.
			const folge = leitung
				.locator('.baum li', { hasText: 'Reinigung nur alle zwei Jahre' })
				.last()
				.locator('form[action="?/aufrufen"] button[type="submit"]');
			behaupte(await folge.count(), 'Der Folgeantrag lässt sich nicht aufrufen');
			await abschicken(leitung, folge.first());
			const erinnert = await text(leitung);
			behaupte(
				/nicht von selbst/.test(erinnert),
				`Beim Folgeantrag fehlt die Erinnerung an den Ausstand des Grundantrags:\n${erinnert.slice(0, 500)}`
			);
			// Zurück zum Grundantrag und den Ausstand wieder aufheben — der Schritt
			// prüft danach den Rückzug, und ein stehengebliebener Ausstand verschöbe
			// dort die Bezugsgrösse.
			await rufeAuf(GESCHAEFTE[3][0]);
			const zurueck = leitung.locator('form[action="?/ausstandZurueck"] button[type="submit"]');
			if (await zurueck.count()) await abschicken(leitung, zurueck.first());
		}

		/*
		 * **Beide Namen kamen an** — auch der, den der Filter zuletzt ausblendete.
		 * Der Antragstext selbst trägt keine Namen; sie stehen getrennt davon und
		 * erscheinen im Protokoll vor dem Antrag.
		 */

		behaupte(
			/Folgeantrag offen|Über ihn wird zuerst abgestimmt/.test(nachher),
			`Die Reihenfolge wird nicht genannt: ${nachher.slice(0, 400)}`
		);

		/*
		 * **Die innerste Zeile, nicht die erste.** In einer verschachtelten Liste
		 * enthält der Text des Eltern-`li` auch den des Kindes: `hasText` trifft
		 * damit den Grundantrag mit, und `.first()` nimmt genau ihn. Weil der
		 * gerade aufgerufen ist, trägt er kein «Antrag zurückziehen» — und der
		 * Prüfschritt meldete einen Fehler, den es nicht gab.
		 */
		const zeile = leitung.locator('.baum li', { hasText: 'Reinigung nur alle zwei Jahre' }).last();
		const auf = zeile.locator('details.rueckzug summary');
		behaupte(await auf.count(), 'Der Gegenantrag lässt sich nicht zurückziehen');
		await auf.click();
		await leitung.waitForTimeout(200);
		await zeile.locator('input[name="grund"]').fill('Der Antragsteller zieht zurück.');
		await abschicken(leitung, zeile.locator('form[action="?/zurueckziehen"] button[type="submit"]'));

		const danach = await text(leitung);
		behaupte(
			/zurückgezogen/i.test(danach),
			`Der Rückzug ist nicht vermerkt: ${danach.slice(0, 300)}`
		);
		behaupte(
			!/Über ihn wird zuerst abgestimmt/.test(danach),
			'Der zurückgezogene Gegenantrag steht weiterhin in der Reihenfolge'
		);

		// Und der Grundantrag ist abstimmbar.
		await rufeAuf(GESCHAEFTE[3][0]);
		behaupte(
			await leitung.locator('form[action="?/oeffnen"] button[type="submit"]').count(),
			'Nach dem Rückzug lässt sich über den Grundantrag nicht abstimmen'
		);
		return 'zurückgezogen, Grundantrag frei, Ausstand erinnert';
	});

	await schritt('Von jeder Seite zurück in den Saal', async () => {
		/*
		 * **Zwei Meldungen vom 21.08.2026 in einem Schritt.** «Es sollte bei einer
		 * laufenden Versammlung, wenn man im Browser herumklickt, noch einen
		 * Knopf geben, zurück zur Versammlung. … Das müsste bei jeder Seite
		 * sein» — und: «Wenn ich die Mehrheit festgelegt habe, lande ich in der
		 * Traktandenliste und nicht in der Versammlung.»
		 */
		for (const wohin of ['/gemeinschaften', '/quorum', '/personen', '/verlauf']) {
			await gehe(leitung, wohin);
			const knopf = leitung.locator('a', { hasText: 'Zur Sitzungsleitung' });
			behaupte(
				await knopf.count(),
				`Auf ${wohin} fehlt der Weg zurück in die laufende Versammlung`
			);
		}

		// Auf der Sitzungsleitung selbst wäre er ein Verweis auf die eigene Seite.
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		behaupte(
			(await leitung.locator('a', { hasText: 'Zur Sitzungsleitung' }).count()) === 0,
			'Der Knopf steht auch dort, wo man schon ist'
		);

		/*
		 * **Und der Weg über das Erfordernis führt zurück, wo er herkam.** Der
		 * Verweis aus der Sitzungsleitung trägt seinen Rückweg mit; ohne ihn
		 * landet man in der Traktandenliste.
		 */
		const aendern = leitung.locator('a[href*="/erfordernis?zurueck="]').first();
		behaupte(await aendern.count(), 'Der Erfordernis-Verweis trägt keinen Rückweg');
		// Auf die Adresse warten statt auf eine Frist: Der Verweis steht in einer
		// Liste, die sich beim Nachziehen neu aufbaut — ein Klick kann dabei ins
		// Leere gehen, und die feste Wartezeit misst dann die Seite von vorher.
		await aendern.click();
		await leitung
			.waitForURL((u) => u.pathname.includes('/erfordernis'), { timeout: 10000 })
			.catch(() => {});
		behaupte(
			leitung.url().includes('/erfordernis'),
			`Nicht beim Erfordernis gelandet: ${leitung.url()}`
		);
		/*
		 * Dass der Rückweg auch angewandt wird, prüft `tests/domain/rueckweg.test.ts`
		 * — samt der Frage, was mit einem Weg geschieht, der aus dieser Versammlung
		 * hinausführt. Hier zählt, dass er überhaupt mitkommt: Ohne den Parameter
		 * im Verweis nützt die beste Prüfung nichts.
		 */
		behaupte(
			leitung.url().includes('zurueck=%2Fversammlungen') ||
				leitung.url().includes('zurueck=/versammlungen'),
			`Der Rückweg fehlt in der Adresse: ${leitung.url()}`
		);
		return 'Rückweg auf 4 Seiten, und aus dem Erfordernis';
	});

	await schritt('Kein Querlauf auf dem Telefon der Leitung', async () => {
		const eng = await telefonACtx.newPage();
		warteNachNavigation(eng);
		await eng.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
		await eng.fill('input[name="username"]', BENUTZER);
		await eng.fill('input[name="kennwort"]', KENNWORT);
		await Promise.all([
			eng.waitForURL((u) => !u.pathname.includes('/anmelden'), { timeout: 30000 }),
			eng.locator('main button[type="submit"]').click()
		]);
		await eng.goto(`${ZIEL}/versammlungen/${versammlung}/leitung`, {
			waitUntil: 'domcontentloaded'
		});
		await eng.waitForTimeout(600);
		const ueber = await eng.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		await eng.close();
		behaupte(ueber === 0, `Die Seite läuft ${ueber} px quer`);
		return '0 px';
	});

	await schritt('Der Rückkommensantrag steht unter seinem Traktandum', async () => {
		/*
		 * **Der Befund vom 21.08.2026.** Der Antrag entstand auf oberster Ebene und
		 * bekam eine eigene Traktandennummer — eine, die auf keiner Einladung
		 * stand. Produktentscheid: «Ergo sind Folgeanträge, Wiedereintretungsanträge
		 * etc. Subtraktanden X.1 X.1.1 oder so.»
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/traktanden`);
		const zeilen = await leitung.locator('[data-traktandum]').evaluateAll((els) =>
			els.map((el) => ({
				nummer: el.querySelector('.nummer')?.textContent?.trim() ?? '',
				titel: el.querySelector('.titel')?.textContent?.trim().split('\n')[0] ?? ''
			}))
		);
		const antrag = zeilen.find((z) => /Rückkommen auf/.test(z.titel));
		behaupte(antrag, `Kein Rückkommensantrag in der Liste: ${zeilen.map((z) => z.nummer).join(' ')}`);
		behaupte(
			antrag.nummer.includes('.'),
			`Der Antrag trägt eine eigene Hauptnummer statt einer Unternummer: «${antrag.nummer}»`
		);
		// Und er hängt unter dem Geschäft, auf das er zurückkommt.
		const [kopf] = antrag.nummer.split('.');
		const ziel = zeilen.find((z) => z.nummer === kopf);
		behaupte(ziel, `Zu «${antrag.nummer}» fehlt das Traktandum ${kopf}`);
		return `${antrag.nummer} unter ${kopf} «${ziel.titel.slice(0, 30)}»`;
	});

	await schritt('Vorziehen ändert die Reihenfolge, nicht die Nummern', async () => {
		/*
		 * **Der Handgriff des Auftraggebers**, am 21.08.2026: «ich habe jetzt den Rückkommensantrag
		 * vorgezogen von 9 auf 8. Jetzt steht dort Traktandum 8. ist das ein
		 * Problem, da die Traktandenliste ja freigegeben wurde?»
		 *
		 * Es war eines — nicht das Verschieben, sondern die Folge: Die Nummern
		 * wanderten mit, und die «Décharge an die Bewirtschaftung» hiess plötzlich
		 * 9 statt 8. Seit der Freigabe stehen sie fest (Migration 072).
		 *
		 * Gezogen wird über den «↑» der Sitzungsleitung — die Traktandenliste
		 * selbst ist ab der Freigabe gesperrt, und genau deshalb steht der Knopf
		 * hier.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);

		const lesen = async () =>
			leitung.locator('.zeile').evaluateAll((els) =>
				els
					.filter((el) => el.querySelector('.nr'))
					.map((el) => ({
						nummer: el.querySelector('.nr').textContent.trim(),
						titel: el.querySelector('.titel').textContent.trim().split('\n')[0].trim()
					}))
			);

		const vorher = await lesen();
		behaupte(vorher.length >= 3, `Zu wenige Zeilen: ${vorher.length}`);

		/*
		 * **Gezogen wird über das Stellenfeld** (21.08.2026): «Wäre nicht smart,
		 * wenn man anstelle dem Pfeil, ein Feld hat, in dem man die
		 * Positionsnummer eingeben kann?» Bei vierzehn Traktanden waren es vorher
		 * bis zu dreizehn Klicks, jeder mit einem Seitenwechsel.
		 */
		/*
		 * **Erst den Aufruf zurücknehmen.** Das aufgerufene Traktandum sperrt seine
		 * Stelle wie ein behandeltes — die Versammlung steht gerade dort. Wer
		 * umordnet, tut das zwischen zwei Geschäften.
		 */
		const zurueckAufruf = leitung.locator('li.jetzt form[action="?/aufrufen"] button');
		if (await zurueckAufruf.count()) await abschicken(leitung, zurueckAufruf.first());

		const felder = leitung.locator('.stellenform input[name="stelle"]');
		const anzahl = await felder.count();
		behaupte(anzahl > 0, 'Kein Stellenfeld in der Sitzungsleitung');
		const letztesFeld = felder.last();
		const warStelle = Number(await letztesFeld.inputValue());
		behaupte(
			warStelle === anzahl,
			`Das letzte Feld zeigt ${warStelle}, erwartet ${anzahl} — die Stelle stimmt nicht mit der Liste überein`
		);
		/*
		 * **Erst der verbotene Weg** (21.08.2026): «Bitte prüfe dass keine
		 * Traktanden hinter vor Traktanden die durch kommen können.» An Stelle 1
		 * liegt ein längst behandelter Punkt; dorthin darf nichts mehr.
		 */
		await letztesFeld.fill('1');
		await abschicken(leitung, leitung.locator('.stellenform button[type="submit"]').last());
		await leitung.waitForTimeout(300);
		const absage = (await text(leitung)).replace(/\s+/g, ' ');
		behaupte(
			/schon vorbei|behandelt|aufgerufen/i.test(absage),
			`Keine Absage beim Schieben in die Vergangenheit: ${absage.slice(0, 250)}`
		);
		behaupte(
			(await lesen())[0].titel === vorher[0].titel,
			'Der Punkt ist trotz Absage gewandert'
		);

		/*
		 * **Und jetzt der erlaubte:** eine Stelle vor, im noch offenen Teil. Die
		 * beiden letzten Geschäfte sind unbehandelt (GESCHAEFTE[3] und [4]) —
		 * dort darf getauscht werden.
		 */
		const feldJetzt = leitung.locator('.stellenform input[name="stelle"]').last();
		await feldJetzt.fill(String(anzahl - 1));
		await abschicken(leitung, leitung.locator('.stellenform button[type="submit"]').last());
		await leitung.waitForTimeout(400);

		const nachher = await lesen();
		const zuletzt = vorher.filter((z) => !z.nummer.includes('.')).at(-1);
		const oberste = nachher.filter((z) => !z.nummer.includes('.'));
		behaupte(
			oberste.at(-2)?.titel === zuletzt.titel,
			`Nicht um eine Stelle vorgerückt: ${oberste.slice(-3).map((z) => z.titel).join(' | ')}`
		);
		// Die eigentliche Prüfung: Die Zuordnung Nummer↔Titel ist dieselbe geblieben.
		const paare = (l) => l.map((z) => `${z.nummer} ${z.titel}`).sort().join(' | ');
		behaupte(
			paare(vorher) === paare(nachher),
			`Die Nummern sind gewandert:\n    vorher : ${paare(vorher)}\n    nachher: ${paare(nachher)}`
		);
		/*
		 * waechtername-historisch: Der frühere Name steht unten als Herkunftsangabe.
		 *
		 * **Und das Feld selbst zeigt die neue Stelle.** `anfangswert` setzt im
		 * Browser `defaultValue`; ein Feld, das nach dem Verschieben noch die alte
		 * Zahl trüge, führte beim nächsten Griff genau daneben. Die ESLint-Regel
		 * `felder` (`scripts/eslint/felder.mjs`, der frühere `check-felder`) kann das
		 * nicht sehen: Sie prüft die Schreibweise, nicht das Ergebnis.
		 */
		const erstesFeld = leitung.locator('.stellenform input[name="stelle"]').first();
		const zeigt = await erstesFeld.inputValue();
		behaupte(zeigt === '1', `Das Feld des vordersten Punktes zeigt «${zeigt}» statt «1»`);
		return `${zuletzt.nummer} «${zuletzt.titel.slice(0, 20)}» eine Stelle vor — Vergangenheit gesperrt, Nummern unverändert`;
	});

	await schritt('Das Protokoll nennt die Umstellung', async () => {
		/*
		 * «Im Protokoll ist der Zeitpunkt ja eigentlich egal. Man kann ja
		 * schreiben, dass das Traktandum XY aus Gründen Bla vorgezogen wurde»
		 * (Auftraggeber, 21.08.2026). Ohne Vermerk stünde dort eine Folge wie «12, 10, 11»
		 * — das sähe nach einem Fehler aus statt nach einem Ordnungsentscheid.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/protokoll`);
		// Der Entwurf entsteht auf Knopfdruck — während der Sitzung mit dem
		// Vorbehalt, dass die Zahlen vorläufig sind.
		const erzeugen = leitung.locator('form[action="?/entwurf"] button');
		if (await erzeugen.count()) {
			await erzeugen.first().click();
			await leitung.waitForTimeout(1200);
		}
		/*
		 * Der Entwurf steht in einem Textfeld — die Sitzungsleitung soll ihn
		 * bearbeiten können. `innerText` sieht dessen Inhalt nicht; gelesen wird
		 * deshalb der Wert.
		 */
		const feld = leitung.locator('form[action="?/speichern"] textarea');
		behaupte(await feld.count(), `Kein Protokolltext: ${(await ganz(leitung)).slice(0, 300)}`);
		const t = await feld.first().inputValue();
		behaupte(
			/Vorgezogen behandelt; die Versammlung hat die Reihenfolge geändert\./.test(t),
			`Der Vermerk fehlt im Protokoll:\n${t.slice(0, 900)}`
		);

		/*
		 * **Und was sonst am Abend geschah** (22.08.2026, Befund D-02 des
		 * Usability-Prüflaufs). Vier Vorgänge fehlten vollständig im Protokoll,
		 * obwohl die Anwendung alle vier kennt: Ausstand, Rückzug, dessen
		 * Rücknahme und die Unterbrechung. Bei einem Ausstand stand «(von 4)»
		 * statt «(von 5)» — ohne ein Wort dazu, warum.
		 *
		 * Dieser Durchstich fährt alle vier ab, deshalb müssen alle vier im Text
		 * stehen. Was hier fehlt, fehlt auch im Protokoll, das an die Eigentümer
		 * geht.
		 */
		const fehlend = [
			['Ausstand', /in den Ausstand getreten/],
			['Ausstandsgrund', /Grund: /],
			['zurückgezogen', /zurückgezogen/],
			['Unterbrechung', /## Unterbrechungen/],
			['Unterbrechungszeit', /\d{2}:\d{2} Uhr — die Versammlung wird unterbrochen/]
		].filter(([, muster]) => !muster.test(t));
		behaupte(
			fehlend.length === 0,
			`Im Protokoll fehlt, was am Abend geschah: ${fehlend.map(([n]) => n).join(', ')}\n` +
				t.slice(0, 1200)
		);

		return 'Vermerk, Ausstand, Rückzug und Pause stehen';
	});

	await schritt('Pause überlagert alles — auch eine laufende Abstimmung', async () => {
		/*
		 * **Der Anlass** (Auftraggeber, 21.08.2026): «Für die Pause braucht es einen
		 * eigenen Knopf bei der Steuerung. […] Der Pausenschalter könnte so sein,
		 * dass wenn aktiv den Inhalt übernimmt und auf der Präsi-Ansicht
		 * überlagert bis der Schalter aus ist. Pause würde auch eine Abstimmung
		 * unterbrechen, wenn diese bspw. ungeplant ist (notfall, störung oder so).»
		 *
		 * Geprüft wird der schwierige Fall: offene Abstimmung, und mitten hinein
		 * die Pause.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		await rufeAuf(GESCHAEFTE[4][0]);
		const freigeben = leitung.locator('form[action="?/oeffnen"] button');
		behaupte(await freigeben.count(), 'Das letzte Geschäft lässt sich nicht freigeben');
		await abschicken(leitung, freigeben.first());

		// Pause an, mit Wortlaut.
		//
		// **Erst aufklappen** (11.09.2026): Das Feld steht seit heute in einem
		// zugeklappten `<details>` — der Knopf «Pause» bleibt aussen, weil im
		// Notfall die Sekunden zählen, der freiwillige Wortlaut nicht. Ohne den
		// Klick liefe `fill` in einen Zeitüberschritt, denn ein zugeklapptes
		// `<details>` hat für seinen Inhalt keine Layoutfläche.
		const ausklapper = leitung.locator('.pausenschalter details.wandtext summary');
		behaupte(await ausklapper.count(), 'Kein Ausklapper für den Pausentext');
		/*
		 * **Klicken, nachsehen, nötigenfalls nochmals** (11.09.2026, im ersten Lauf
		 * gemessen). Ein einzelner Klick reichte nicht: Das Freigeben davor schickt
		 * ab und lädt nach, und der Nachzug ersetzt das `<details>` durch ein neues
		 * — zugeklappt. Wer dazwischen klickt, öffnet einen Knoten, den es gleich
		 * nicht mehr gibt. Dieselbe Bauform wie `klickeBis` in `durchspielen.mjs`.
		 */
		const kasten = leitung.locator('.pausenschalter details.wandtext');
		for (let i = 0; i < 8 && !(await kasten.evaluate((d) => d.open).catch(() => false)); i += 1) {
			await ausklapper.click().catch(() => {});
			await leitung.waitForTimeout(300);
		}
		behaupte(
			await kasten.evaluate((d) => d.open),
			'Der Ausklapper für den Pausentext liess sich nicht öffnen'
		);
		const feld = leitung.locator('.pausenschalter input[name="pausentext"]');
		behaupte(await feld.count(), 'Kein Pausenschalter in der Sitzungsleitung');
		await feld.fill('Weiter um 20:15');
		await abschicken(leitung, leitung.locator('.pausenschalter button[type="submit"]'));

		// Die Wand zeigt die Pause — obwohl eine Abstimmung offen ist.
		await beamer.reload({ waitUntil: 'domcontentloaded' });
		await beamer.waitForTimeout(400);
		const wand = await ganz(beamer);
		behaupte(/Pause/.test(wand), `Die Wand zeigt keine Pause: ${wand.slice(0, 200)}`);
		behaupte(/Weiter um 20:15/.test(wand), `Der Wortlaut fehlt an der Wand: ${wand.slice(0, 200)}`);

		// Das Telefon auch — und ohne Wahlknöpfe.
		await telefonA.reload({ waitUntil: 'domcontentloaded' });
		await telefonA.waitForTimeout(400);
		const t = await ganz(telefonA);
		behaupte(/Pause/.test(t), `Das Telefon zeigt keine Pause: ${t.slice(0, 200)}`);
		behaupte(
			(await telefonA.locator('form.wahl button').count()) === 0,
			'Auf dem Telefon lässt sich in der Pause weiter abstimmen'
		);

		// Fortfahren — die Abstimmung ist noch offen, nicht geschlossen.
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const weiter = leitung.locator('.pausenschalter button[type="submit"]');
		behaupte(await weiter.count(), 'Kein Weg, die Pause zu beenden');
		await abschicken(leitung, weiter.first());
		behaupte(
			await leitung.locator('form[action="?/schliessen"] button').count(),
			'Nach der Pause ist die Abstimmung nicht mehr offen'
		);

		await telefonA.reload({ waitUntil: 'domcontentloaded' });
		await telefonA.waitForTimeout(400);
		behaupte(
			await telefonA.locator('form.wahl button').count(),
			'Nach der Pause fehlen die Wahlknöpfe auf dem Telefon'
		);
		return 'Wand und Telefon pausiert, Abstimmung blieb offen';
	});

	/**
	 * **Eine abgewiesene Summenerfassung behält die gezählten Zahlen.**
	 *
	 * Regel 1 in `$lib/absenden.ts`: «eine Absage behält das Getippte».
	 * `?/summen` läuft mit `reset: false` und leert die drei Felder selbst,
	 * wenn eine Handzählung **zurückgenommen** wurde. Die erste Fassung dieses
	 * Griffs fragte nur `if (!handzaehlung)` — und das ist auch wahr, solange
	 * gar keine Handzählung steht, also genau dann, wenn die Sitzungsleitung
	 * ihre eben ausgezählten Zahlen abschickt. Eine Absage hätte sie gelöscht.
	 * Im Saal ist der Zettel manchmal die einzige Kopie.
	 *
	 * Die Absage wird **abgefangen** statt vom Server erzeugt: Geprüft wird das
	 * Verhalten der Seite auf eine Absage, nicht die Regel, die sie auslöst.
	 */
	await schritt('Eine abgewiesene Summenerfassung behält die Zahlen', async () => {
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		const summen = leitung.locator('form[action="?/summen"]');
		if (!(await summen.locator('input[name="ja"]').isVisible())) {
			const auf = leitung.locator('summary', { hasText: 'nur die Summen' }).first();
			behaupte(await auf.count(), 'Kein Weg zur Summenerfassung');
			await auf.click();
			await summen.locator('input[name="ja"]').waitFor({ state: 'visible', timeout: 5000 });
		}

		await summen.locator('input[name="ja"]').fill('12');
		await summen.locator('input[name="nein"]').fill('3');
		await summen.locator('input[name="enthaltung"]').fill('1');

		await leitung.route(/\?\/summen/, async (route) => {
			await route.fulfill({
				status: 400,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					type: 'failure',
					status: 400,
					data: '[{"fehler":1},{"nachricht":2,"feld":3},"Für diesen Durchgang sind bereits einzelne Stimmen erfasst.","durchgang"]'
				})
			});
		});
		await summen.locator('button[type="submit"]').first().click();
		await leitung.waitForTimeout(800);
		await leitung.unroute(/\?\/summen/);

		const gelesen = [
			await summen.locator('input[name="ja"]').inputValue(),
			await summen.locator('input[name="nein"]').inputValue(),
			await summen.locator('input[name="enthaltung"]').inputValue()
		];
		behaupte(
			gelesen.join('/') === '12/3/1',
			`Die Absage hat die gezählten Zahlen gelöscht: ${gelesen.join('/') || '(leer)'} statt 12/3/1`
		);
		return 'Absage abgefangen, 12/3/1 stehen noch';
	});

	await schritt('Der Knopf folgt dem Besuch, nicht der Handlung', async () => {
		/*
		 * **Der Befund** (Auftraggeber, 21.08.2026): «Bei dem Zurück zur Laufenden Sitzung
		 * Button — der Button muss sich merken, welche die letzte Sitzung war.»
		 *
		 * Hier wird geprüft, dass der blosse **Besuch** genügt: Ein Blick auf eine
		 * Versammlungsseite, ohne dort etwas zu tun, und der Knopf zeigt danach
		 * dorthin. Dass er beim Wechsel zwischen zwei laufenden Sitzungen mitgeht,
		 * hält der Datenbanktest fest (`versammlung.test.ts`) — zwei Versammlungen
		 * im Browser aufzubauen kostete mehr, als der Schritt einbrächte.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/vorbereitung`);
		await gehe(leitung, '/quorum');
		const knopf = leitung.locator('a.zurueckZurSitzung');
		behaupte(await knopf.count(), 'Kein Knopf zurück in den Saal');
		const ziel = await knopf.first().getAttribute('href');
		behaupte(
			ziel?.includes(versammlung),
			`Der Knopf führt woandershin: ${ziel} (erwartet ${versammlung})`
		);
		return 'zeigt auf die zuletzt besuchte';
	});

	await schritt('Quittungen erscheinen unten rechts und gehen von selbst', async () => {
		/*
		 * **Der Wunsch** (Auftraggeber, 21.08.2026): «kann man die Infofenster, also wenn
		 * eine Aktion erfolgreich war […] in ein Fenster das unten rechts aufpoppt,
		 * mit der Info das man wegklicken kann oder selbst verschwindet.»
		 *
		 * **Und die Gegenprobe:** Eine Absage darf NICHT wandern. Sie hält auf,
		 * nennt einen Weg und muss stehen bleiben, bis jemand ihn geht.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);
		/*
		 * Eine Handlung mit Quittung: kurz unterbrechen und gleich fortfahren.
		 * Beide Schritte antworten mit einem Erfolgssatz, und der Schalter steht
		 * auf dieser Seite immer — anders als das Wandbild, das während einer
		 * offenen Abstimmung hinter der eingeengten Spalte liegt.
		 */
		await abschicken(leitung, leitung.locator('.pausenschalter button[type="submit"]'));
		await abschicken(leitung, leitung.locator('.pausenschalter button[type="submit"]'));

		/*
		 * **Auf die Quittung warten, nicht auf eine Frist.** Eine Einblendung
		 * steht `DAUER` = 6 s; eine feste Wartezeit davor ist auf einem
		 * langsameren Rechner entweder zu kurz (noch keine da) oder zu lang
		 * (schon wieder weg). Am 28.08.2026 war der Schritt so in einem von zwei
		 * Läufen rot, ohne dass sich etwas geändert hatte.
		 */
		const quittung = leitung.locator('.einblender .quittung');
		await quittung.first().waitFor({ state: 'visible', timeout: 5000 });
		const text = (await leitung.locator('.einblender').innerText()).replace(/\s+/g, ' ');
		behaupte(!/×\s*×/.test(text), `Der Schliessknopf steht im Text: «${text}»`);
		behaupte(
			(await leitung.locator('main p.meldung.gut').count()) === 0,
			'Die Erfolgsmeldung steht doppelt — oben und unten rechts'
		);

		/*
		 * **Wegklicken wirkt sofort — und nimmt genau eine mit.**
		 *
		 * Bis zum 28.08.2026 stand hier `=== 0`: Der Pausenschalter lud die Seite
		 * bei jedem der beiden Schritte neu, und die erste Quittung ging dabei
		 * verloren. Seit er über `absenden()` schickt, bleiben beide stehen und
		 * reihen sich auf — genau das, was am 21.08.2026 gewünscht war («Wenn
		 * mehrere Infos sind reiht es sich auf»). Der Schritt prüft deshalb, dass
		 * ein Klick **eine** Quittung nimmt, nicht alle; das ist die schärfere
		 * Aussage.
		 */
		const vorher = await quittung.count();
		behaupte(vorher >= 2, `Zwei Handlungen ergaben ${vorher} Quittungen — sie reihen sich nicht auf`);
		await quittung.first().locator('button').click();
		await leitung.waitForTimeout(200);
		const uebrig = await leitung.locator('.einblender .quittung').count();
		behaupte(
			uebrig === vorher - 1,
			`Nach dem Wegklicken stehen ${uebrig} statt ${vorher - 1} Quittungen`
		);

		/*
		 * **Dass eine Absage NICHT wandert**, hält Schritt 23 fest: Dort erwartet
		 * der Durchlauf die Absage «Der Antrag ist zurückgezogen» im Inhalt, nicht
		 * in der Ecke. Wanderten Absagen mit, wäre er sofort rot.
		 */
		return 'Quittung unten rechts, wegklickbar';
	});

	await schritt('Am Ende führt der Abschluss — und die Wand zeigt ihn', async () => {
		/*
		 * **Der Wunsch** (Auftraggeber, 21.08.2026): «Wenn das letzte Traktandum durch ist,
		 * kann dort der Abschluss knopf kommen, damit die Sitzung beendet wird. Auf
		 * der Präsentationssicht braucht es dann eine Abschlussseite. Eventuell mit
		 * den Auswertungen der Traktandenabstimmungen?»
		 *
		 * Der Knopf steht dort, wo den ganzen Abend das nächste Geschäft stand —
		 * ist keines mehr da, ist der nächste Schritt der Schluss.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/leitung`);

		/*
		 * Erst die offene Abstimmung aus dem Pausenschritt schliessen: Der
		 * Abschluss erscheint nur, wenn nichts mehr läuft — sonst stünde er über
		 * einer Frage, die der Saal noch beantwortet.
		 */
		const nochOffen = leitung.locator('form[action="?/schliessen"] button[type="submit"]');
		if (await nochOffen.count()) await abschicken(leitung, nochOffen.last());

		// Bis ans Ende der Liste durchklicken, dann steht der Abschluss.
		for (let i = 0; i < 20; i++) {
			const nachher = leitung.locator('li.nachher form[action="?/aufrufen"] button');
			if ((await nachher.count()) === 0) break;
			await abschicken(leitung, nachher.first());
		}

		const kachel = (await leitung.locator('li.nachher').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Alle Traktanden behandelt/.test(kachel),
			`Der Abschluss steht nicht am Ende: ${kachel.slice(0, 200)}`
		);
		const schluss = leitung.locator('li.nachher form[action="?/abschliessen"] button');
		behaupte(await schluss.count(), 'Kein Knopf, die Versammlung zu schliessen');
		await abschicken(leitung, schluss.first());

		// Danach führt die Sitzungsleitung nichts mehr: Die Seite sagt, dass die
		// Versammlung nicht mehr läuft, und verweist auf die Versammlung selbst.
		const danach = await text(leitung);
		behaupte(
			/geschlossen|läuft nicht/i.test(danach),
			`Die Versammlung ist nicht geschlossen: ${danach.slice(0, 200)}`
		);

		// **Und die Wand zeigt den Abschluss samt Beschlüssen.**
		await beamer.reload({ waitUntil: 'domcontentloaded' });
		await beamer.waitForTimeout(500);
		const wand = await ganz(beamer);
		behaupte(
			/Versammlung geschlossen/.test(wand),
			`Die Wand zeigt keinen Abschluss: ${wand.slice(0, 250)}`
		);
		behaupte(
			/angenommen|abgelehnt/.test(wand),
			`Die Wand nennt keine Beschlüsse: ${wand.slice(0, 250)}`
		);
		// Keine Namen an der Wand — auch nicht am Ende (AD-11).
		behaupte(
			!/Ackermann|Brunner|Caduff/.test(wand),
			'Die Abschlussseite nennt Namen'
		);
		return 'Knopf am Ende, Wand mit Beschlüssen, keine Namen';
	});

	await schritt('Das Telefon zeigt nach dem Schluss noch, was beschlossen wurde', async () => {
		/*
		 * **Die Nachschau** (04.09.2026, Produktentscheid: «dieselbe Stunde auf dem
		 * Mobiltelefon»). Bis dahin endete der Abend auf dem Telefon mit einer rot
		 * hinterlegten Absage: nach zwei Stunden Abstimmen ein Hinauswurf in
		 * Fehlerfarbe, ohne ein Wort darüber, was insgesamt beschlossen wurde.
		 *
		 * Dieselbe Frist wie beim Anzeigecode der Leinwand, seit dem 21.08.2026.
		 */
		await gehe(telefonA, '/z');
		const t = await text(telefonA);
		behaupte(
			/Was an diesem Abend beschlossen wurde/.test(t),
			`Keine Nachschau auf dem Telefon: ${t.slice(0, 250)}`
		);
		behaupte(
			/angenommen|abgelehnt|ohne Beschluss/.test(t),
			`Die Nachschau nennt keine Ergebnisse: ${t.slice(0, 250)}`
		);
		/*
		 * **Wozu die Beschlüsse gehören** (Bedienbarkeitsprüfung 05.09.2026,
		 * Befund 11 der Telefonsicht). Der Schlussbildschirm trug die Überschrift
		 * «Zugang zur Versammlung» und nannte weder Gemeinschaft noch Datum: Wer
		 * das Telefon Tage später wieder ansieht, findet eine Liste ohne
		 * Zugehörigkeit.
		 */
		const kopf = (await telefonA.locator('h1').innerText()).trim();
		behaupte(
			/^Versammlung vom \d{1,2}\. \w+ \d{4}$/.test(kopf),
			`Der Schlussbildschirm nennt seinen Tag nicht: «${kopf}»`
		);
		// Und der Name der Gemeinschaft steht ausdrücklich **nicht** dort
		// (Produktentscheid 06.09.2026): Ein gefundenes Telefon soll nicht das
		// Haus verraten.
		behaupte(
			!t.includes(NAME),
			`Der Schlussbildschirm nennt die Gemeinschaft «${NAME}»`
		);

		/*
		 * **Nur zeigen, nicht handeln.** Der Zugang gilt serverseitig als ungültig;
		 * die Seite darf deshalb keine Wahlknöpfe und kein Vollmachtsformular mehr
		 * anbieten. Erschienen sie doch, liefen sie in eine Absage — und ein Knopf,
		 * der in eine Absage führt, ist schlimmer als keiner.
		 */
		behaupte(
			(await telefonA.locator('form.wahl button').count()) === 0,
			'Nach dem Schluss stehen noch Wahlknöpfe da'
		);
		behaupte(
			(await telefonA.locator('form[action="?/bevollmaechtigen"]').count()) === 0,
			'Nach dem Schluss lässt sich noch bevollmächtigen'
		);

		// Und keine Personendaten: Wer das Telefon findet, soll nicht lesen
		// können, wem es gehört und wie viele Stimmen die Person hält.
		behaupte(
			!/Sie sind erkannt als|Kopfstimme/.test(t),
			`Die Nachschau zeigt Personendaten: ${t.slice(0, 250)}`
		);
		await telefonA
			.screenshot({ path: `${AUFNAHMEN}/nachschau-telefon.png`, fullPage: true })
			.catch(() => {});
		return 'Verlauf sichtbar, keine Knöpfe, keine Personendaten';
	});

	await schritt('Das Protokoll trägt Siegel und Zeitstempel', async () => {
		/*
		 * **Der Aufdruck** (22.08.2026, nach der Rechtsprüfung): Das Protokoll geht
		 * an alle Eigentümer. Steht die Prüfsumme darin, halten danach so viele
		 * Menschen eine Kopie davon, wie die Gemeinschaft Mitglieder hat — jeder
		 * mit einem Empfangszeitpunkt, den die Bewirtschaftung nicht in der Hand
		 * hat. Das trägt beweisrechtlich weiter als der Zeitstempel selbst.
		 *
		 * Voraussetzung ist die Reihenfolge: erst versiegeln, dann den Entwurf
		 * erzeugen. Genau die prüft dieser Schritt mit.
		 */
		/*
		 * Aus Schritt 30 besteht bereits ein Entwurf — der entstand vor dem
		 * Versiegeln und trägt deshalb keinen Siegelabschnitt. Genau das ist der
		 * Fall, den der Hinweis auf der Seite verhindern soll. Für diesen Schritt
		 * wird die alte Fassung festgehalten und neu erzeugt; das ist auch im Saal
		 * der Weg, wenn jemand zu früh war.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/protokoll`);
		const alteFassung = leitung.locator('form[action="?/festhalten"]');
		if (await alteFassung.count()) {
			/*
			 * Ohne Siegel gibt es «versandt» nicht mehr (Block 8): Die Seite bietet
			 * die Art nicht an, der Server wiese sie ab. Hier soll nur der alte
			 * Text gesichert werden, bevor der Entwurf neu entsteht.
			 */
			await alteFassung.locator('select[name="art"]').selectOption('festgehalten');
			await abschicken(leitung, alteFassung.locator('button[type="submit"]'));
		}

		// Versiegeln, dann den Entwurf erzeugen.
		await gehe(leitung, `/versammlungen/${versammlung}/siegel`);
		const siegeln = leitung.locator('form[action="?/versiegeln"] button[type="submit"]');
		behaupte(await siegeln.count(), `Kein Weg zu versiegeln: ${(await text(leitung)).slice(0, 250)}`);
		await abschicken(leitung, siegeln.first());

		await gehe(leitung, `/versammlungen/${versammlung}/protokoll`);
		/*
		 * **Über `abschicken`, nicht per Klick** (22.08.2026): Seit Befund D-01
		 * fragt «Entwurf neu erzeugen» zurück, bevor es den Text ersetzt. Ein
		 * Drehbuch, das bloss den Auslöser drückt, wartet danach auf eine Antwort,
		 * die nie kommt.
		 */
		const neuErzeugen = leitung.locator('form[action="?/entwurf"] button');
		if (await neuErzeugen.count()) {
			await abschicken(leitung, neuErzeugen.first());
		} else {
			// Es steht noch der alte Entwurf: festhalten, dann neu erzeugen.
			await abschicken(
				leitung,
				leitung.locator('form[action="?/festhalten"] button[type="submit"]')
			);
			const nochmal = leitung.locator('form[action="?/entwurf"] button');
			behaupte(await nochmal.count(), 'Kein Knopf, den Entwurf zu erzeugen');
			await abschicken(leitung, nochmal.first());
		}

		const feld = leitung.locator('form[action="?/speichern"] textarea');
		behaupte(await feld.count(), 'Kein Protokolltext entstanden');
		const protokoll = await feld.first().inputValue();

		behaupte(
			/Abschlusspaket dieser Versammlung/.test(protokoll),
			`Der Siegelabschnitt fehlt:\n${protokoll.slice(-600)}`
		);
		behaupte(
			/Siegel \(SHA-256 über das Inhaltsverzeichnis «manifest\.json»\): [0-9a-f]{64}/.test(protokoll),
			`Kein vollständiger Abdruck im Protokoll:\n${protokoll.slice(-600)}`
		);
		behaupte(
			/manifest\.json/.test(protokoll),
			'Der Prüfweg fehlt — eine Zeichenkette ohne Anleitung ist Dekoration'
		);
		behaupte(
			/nicht Teil des Siegels/.test(protokoll),
			'Die Reichweite ist nicht benannt — der Aufdruck verspräche mehr, als er deckt'
		);
		// Und nichts, was es nicht gibt: keine Beweisregel, nur freie Würdigung.
		behaupte(
			!/gerichtsfest|rechtssicher|beweiskräftig/i.test(protokoll),
			'Das Protokoll verspricht eine Beweiskraft, die es nicht gibt'
		);
		return 'Abdruck, Prüfweg und Reichweite stehen im Text';
	});

	await schritt('Die nächste Versammlung genehmigt eine benannte Fassung', async () => {
		/*
		 * **Die Kette** (Gedanke des Auftraggebers vom 22.08.2026): Nach der Anfechtungsfrist
		 * zählt nur noch, dass das Protokoll von damals stammt — und das bezeugt
		 * am besten die Folgeversammlung selbst, indem ihr Genehmigungstraktandum
		 * die Prüfsumme nennt. Ein Beschluss der Versammlung wiegt schwerer als
		 * eine Bezeugung durch die Bewirtschaftung.
		 */
		await gehe(leitung, `/versammlungen/${versammlung}/protokoll`);
		const festhalten = leitung.locator('form[action="?/festhalten"]');
		// Mit dem Siegel ist «versandt» wieder wählbar (Block 8).
		behaupte(
			(await festhalten.locator('select[name="art"] option[value="versandt"]').count()) === 1,
			'Nach dem Siegel fehlt die Art «versandt»'
		);
		await festhalten.locator('select[name="art"]').selectOption('versandt');
		await abschicken(leitung, festhalten.locator('button[type="submit"]'));

		const abdruck = (await leitung.locator('.abdruck .wert').innerText()).trim();
		behaupte(/^[0-9a-f]{64}$/.test(abdruck), `Kein Abdruck auf der Seite: «${abdruck}»`);

		// Eine Folgeversammlung derselben Gemeinschaft, ein Jahr später.
		await gehe(leitung, '/versammlungen/neu');
		await leitung.locator('input[name="art"][value="einzeln"]').check();
		await leitung.waitForTimeout(150);
		await leitung.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await leitung.fill('input[name="datum"]', '2028-05-12');
		await leitung.fill('input[name="uhrzeit"]', '19:30');
		await leitung.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(leitung, leitung.locator('button[form="anlegen"]').first());
		const folge = leitung.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(folge && folge !== 'neu', `Folgeversammlung nicht angelegt: ${leitung.url()}`);

		await gehe(leitung, `/versammlungen/${folge}/traktanden`);
		// Der Antragswortlaut steht eingeklappt — die Zeile muss geöffnet werden.
		const zeile = leitung
			.locator('[data-traktandum]')
			.filter({ hasText: 'Genehmigung des Protokolls' })
			.first();
		behaupte(await zeile.count(), 'Kein Genehmigungstraktandum in der Folgeversammlung');
		await zeile.locator('button.titel').click();
		await leitung.waitForTimeout(400);
		/*
		 * Der Antragswortlaut steht in einem Textfeld — `innerText` sieht dessen
		 * Inhalt nicht; gelesen wird der Wert. Dieselbe Falle wie beim
		 * Protokolltext.
		 */
		const wortlautfeld = zeile.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]');
		behaupte(await wortlautfeld.count(), 'Kein Antragswortlaut am Genehmigungstraktandum');
		const wortlaut = await wortlautfeld.first().inputValue();
		behaupte(
			wortlaut.includes(abdruck),
			`Die Prüfsumme steht nicht im Antrag — gesucht ${abdruck.slice(0, 16)}…, gesehen: ${wortlaut.slice(0, 300)}`
		);
		return `Antrag nennt ${abdruck.slice(0, 12)}…`;
	});

	console.log(`\n  Prüfbestand: Gemeinschaft ${gemeinschaft}, Versammlung ${versammlung}`);
	if (rueckfragen.length > 0) console.log(`  Rückfragen: ${rueckfragen.join(' · ')}`);
} finally {
	await leitung.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await beamer.screenshot({ path: `${AUFNAHMEN}/wand.png`, fullPage: true }).catch(() => {});
	await telefonA.screenshot({ path: `${AUFNAHMEN}/telefon.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log('');
if (fehler.length > 0) {
	console.log(`${fehler.length} Befund${fehler.length === 1 ? '' : 'e'}:`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
