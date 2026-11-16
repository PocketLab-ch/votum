/**
 * Ende-zu-Ende-Durchlauf einer ganzen Versammlung, in einem echten Browser.
 *
 * **Warum es diesen Test gibt.** Kern- und Datenbanktests prüfen Rechenwege und
 * Schutzregeln. Was sie nicht sehen: ob ein Formular seine Eingabe überhaupt
 * abschickt. Genau daran scheiterte die Anmeldung — Svelte setzte bei der
 * Hydration `value={…}` zurück und leerte das getippte Feld, während dieselbe
 * Anmeldung per HTTP-Aufruf tadellos funktionierte. Ein Fehler dieser Art ist
 * für die übrigen Tests unsichtbar und für den Benutzer tödlich.
 *
 * **Was durchgespielt wird:** eine vollständige Versammlung von der leeren
 * Gemeinschaft bis zur Auswertung — mit vier Beteiligten in getrennten
 * Browser-Kontexten, weil sie im Saal auch getrennte Geräte sind:
 *
 *   Leitung   das Notebook der Sitzungsleitung
 *   Telefon   ein Eigentümer, der sich per Code anmeldet und abstimmt
 *   Beamer    die Präsentationssicht, die nie zu früh etwas verraten darf
 *
 * Getrennte Kontexte sind kein Zierat: Ein gemeinsamer Kontext teilte die
 * Kekse, und der Test bewiese dann nichts über den Zugang der Telefone.
 *
 * **Was dieser Durchlauf nicht sieht:** den Vollmachtsblock in der Sicht «Karte
 * gescannt». Sie erscheint nur, wenn die Sitzungsleitung eine **Zugangskarte**
 * scannt, und deren Code steht ausschliesslich im erzeugten PDF — aus dem
 * Browser heraus nicht lesbar. Der Block ist dieselbe Komponente und dieselbe
 * Aktion wie unter «Ohne Karte einlassen», die hier geprüft wird; ungeprüft
 * bleibt allein seine Platzierung dort.
 *
 * Knöpfe werden innerhalb von `main` gesucht: Der Abmelden-Knopf sitzt in der
 * Kopfzeile und ist im Dokument der erste `button[type="submit"]` — ein
 * unqualifizierter Selektor meldet den Prüfer ab, statt das Formular zu senden.
 *
 * **Aufruf** (vom Dev-Host aus, gegen den laufenden Dev-Stapel):
 *
 *   node e2e/durchspielen.mjs
 *
 * Playwright liegt nicht in diesem Projekt — der Browser braucht Systempakete,
 * die im schlanken Node-Abbild fehlen. Der Pfad lässt sich über
 * `PLAYWRIGHT_PFAD` setzen; ohne die Variable muss Node das Paket `playwright`
 * selbst finden, sonst bricht der Lauf mit einer Ansage ab. Ziel und Zugangsdaten über `ZIEL`, `BENUTZER`, `KENNWORT`.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { absageGrund, nachAbsendung, nachladeWarter } from './absendung.mjs';
import { bereit, netzWiederholungen, warteNachNavigation } from './bereit.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { umgebungsbefund } from './umgebung.mjs';
import { messeKontrast } from './kontrast.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';


/**
 * Ein gültiges 1×1-PNG — der «fotografierte» Nachweis.
 *
 * Klein genug, dass es den Lauf nicht bremst, und echt genug, dass die
 * Dateiprüfung es annimmt: Sie liest die Kopfbytes, nicht die Endung.
 */
const EIN_PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);
/**
 * Wo eine Erfolgsmeldung steht — an ihrem Platz **oder** in der Quittungsecke.
 *
 * **Beide Orte, nicht einer** (02.09.2026). `Meldung.svelte` gibt eine Meldung
 * mit `ton="gut"` an den Einblender unten rechts weiter (Vorgabe des Auftraggebers,
 * 21.08.2026) und nimmt den Absatz dann aus dem Baum. Ein Schritt, der nur
 * `.meldung.gut` sucht, wird in dem Augenblick rot, in dem eine handgebaute
 * Meldung auf die Komponente umgestellt wird — genau das ist an drei Stellen
 * passiert, als die 21 blanken Absätze verschwanden.
 *
 * Der Einblender trägt `role="status"`; ohne JavaScript bleibt die Meldung an
 * ihrem Platz. Beide Fälle deckt dieser Selektor ab.
 */
const ERFOLGSMELDUNG = '.meldung.gut, [role="status"]';

const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-versammlung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);

// Ein Namenszusatz je Lauf: Der Test legt echte Daten an und räumt sie nicht
// weg. Zwei Läufe hintereinander dürfen sich nicht in die Quere kommen, und
// hinterher soll erkennbar sein, was aus welchem Lauf stammt.
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

/**
 * Ein Kalendertag in der Zeitzone, in der die Anwendung rechnet.
 *
 * **`toISOString()` rechnet UTC, der Server rechnet Europe/Zurich**
 * (02.09.2026, aus dem Code-Review). Zwischen 22:00 und 24:00 UTC ist es hier
 * schon der Folgetag: Ein «morgen», das aus dem UTC-Datum kommt, ist
 * serverseitig heute. Solange jede Probe Tage an Spielraum hatte, fiel das
 * nicht auf — der erste Schritt ohne Puffer wird davon falsch-rot.
 *
 * @param {number} versatzTage @returns {string} `JJJJ-MM-TT`
 */
function hiesigerTag(versatzTage = 0) {
	return new Date(Date.now() + versatzTage * 86400000).toLocaleDateString('sv-SE', {
		timeZone: 'Europe/Zurich'
	});
}

/**
 * Das Wort in der Bemerkung je Eigentümer (23.08.2026, Prüflauf I, A-12).
 *
 * Es kommt sonst nirgends vor. Am Ende des Durchgangs wird jede Unterlage
 * darauf abgesucht: Eine Arbeitsnotiz über eine Person darf die
 * Bewirtschaftungssicht nicht verlassen — nicht auf die Anwesenheitsliste,
 * nicht ins Protokoll, nicht in die Einladung, nicht ins Abschlusspaket.
 */
const BEMERKUNGSWORT = `BEMERKUNGSPROBE${LAUF}`;
/** Der Wortlaut der Rüge (Ä-06); er wird im Abschlusspaket wiedergesucht. */
const RUEGEWORT = `Einladung zu spät erhalten ${LAUF}`;

let schrittzahl = 0;
const befunde = [];
let aktuelleSeite = null;

/**
 * Ein Schritt des Drehbuchs.
 *
 * Schlägt einer fehl, endet der Lauf — eine Versammlung ist eine Kette, und
 * weiterzumachen prüfte nur noch Folgefehler. Vorher wird ein Bild gesichert:
 * Bei einem Oberflächenfehler sagt es mehr als jede Meldung.
 */
async function schritt(name, arbeit) {
	schrittzahl++;
	const nummer = String(schrittzahl).padStart(2, '0');
	try {
		const ergebnis = await arbeit();
		console.log(`  ✓ ${nummer} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
		return ergebnis;
	} catch (fehler) {
		console.error(`  ✗ ${nummer} ${name}\n     ${fehler.message}`);
		befunde.push({ nummer, name, meldung: fehler.message });
		if (aktuelleSeite) {
			const bild = `${AUFNAHMEN}/fehler-${nummer}.png`;
			await aktuelleSeite.screenshot({ path: bild, fullPage: true }).catch(() => {});
			await writeFile(`${AUFNAHMEN}/fehler-${nummer}.html`, await aktuelleSeite.content()).catch(
				() => {}
			);
			console.error(`     Bild: ${bild}`);
		}
		throw fehler;
	}
}

/**
 * Steht diese Gemeinschaft in der Liste — ja oder nein?
 *
 * **Warum nicht der Volltext von `main`** (26.08.2026, aus dem Code-Review).
 * Zwei Fallen liegen dort übereinander:
 *
 *   - Die Liste zeigt höchstens 25 Zeilen und darunter «41 weitere — suchen Sie
 *     oben» (`LISTENGRENZE` in `domain/listensuche.ts`). Mit jedem Lauf wächst
 *     der Bestand. Fällt die gesuchte Zeile hinter Platz 25, wird «steht wieder
 *     da» rot, obwohl alles stimmt — und «ist weg» **grün, ohne etwas zu
 *     prüfen**. Die zweite Richtung ist die gefährlichere.
 *   - `main` trägt auch Text ausserhalb der Liste: Erfolgsmeldung, Zähler,
 *     Leerstelle und die Archivmarke einer Kindzeile, die den **Elternnamen**
 *     nennt. Ein Namensvergleich über `main` misst also nicht die Liste.
 *
 * Deshalb: den Deckel über «alle N anzeigen» heben und an der **Zeile** messen,
 * über ihre Kennung. Das ist eindeutig, es wartet auf den Zustand statt auf eine
 * Frist, und es kann nicht am Echo der eigenen Eingabe hängenbleiben.
 *
 * Dazu die Sichtprobe aus derselben Datei («‹Ist weg› allein bewiese auch eine
 * Liste, die gar nichts mehr zeigt»): Die Liste muss überhaupt Zeilen führen.
 */
async function stehtInListe(seite, id, erwartet, satz) {
	await gehe(seite, '/gemeinschaften');
	// Fehlt der Knopf, ist nichts verborgen — das ist ein Beweis, kein Rückfall.
	const alle = seite.locator('p.mehr button');
	if (await alle.count()) {
		await alle.first().click();
		await seite.locator('p.mehr').waitFor({ state: 'detached', timeout: 5000 });
	}
	behaupte(
		(await seite.locator('ul.liste > li').count()) > 0,
		'Die Gemeinschaftsliste zeigt gar keine Zeile — dann beweist keine Behauptung darüber etwas'
	);
	const zeile = seite.locator(`ul.liste li a[href="/gemeinschaften/${id}"]`);
	try {
		await zeile.waitFor({ state: erwartet ? 'visible' : 'detached', timeout: 5000 });
	} catch {
		behaupte(false, satz);
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

/**
 * Schickt ein Formular ab und wartet, bis die Antwort steht.
 *
 * Auf die Navigation zu warten genügt nicht: SvelteKit beantwortet eine Aktion
 * mit einer Umleitung, und der Inhalt der Zielseite steht erst danach. Ohne das
 * Warten auf Ruhe prüft der Test die vorige Seite und meldet Fehler, die keine
 * sind — die unangenehmste Sorte, weil sie beim Nachsehen von Hand verschwinden.
 *
 * **`begruendung` für das Verlassen-Fenster** (Befund 03.10.2026, Punkt 8).
 * Der Knopf öffnet die Rückfrage; die Begründung ist Pflicht, und ihr Feld
 * trägt bewusst kein `required` (der Weg ohne JavaScript braucht das Feld
 * ohne Browserschranke). Der Beobachter in `rueckfrage.mjs` kann es deshalb
 * antippen, aber `pruefe` hält das Fenster offen. Diese Option wartet auf das
 * offene Fenster, tippt den Satz hinein und bestätigt.
 */
async function abschicken(seite, knopf, { absageErlaubt = false, begruendung = null } = {}) {
	// Auf die Antwort des Servers warten, nicht auf eine Frist. Eine feste
	// Wartezeit ist bei jedem langsameren Aufruf zu kurz, und der Test prüfte
	// dann die Seite von vorher — grün, obwohl nichts geschah.
	//
	// **Nicht** auf `networkidle` warten: Telefon, Beamer und Sitzungsleitung
	// halten einen Ereignisstrom offen, damit sie mitbekommen, was im Saal
	// geschieht. Das Netzwerk wird dort nie ruhig.
	//
	// **Auf die Antwort GENAU DIESES Formulars warten, und laut scheitern.**
	// Vorher genügte irgendein POST (auch der Sicherungs-Post eines
	// selbstsichernden Feldes), und nach 20 s stillem Aufgeben lief der Test
	// im undefinierten Zustand weiter. So entstand die Schritt-39-Flake vom
	// 14./15.08.2026: Eine Freigabe brauchte einmal 20.8 s (closed_at
	// 09:06:15.9, result_published_at 09:06:36.7), abschicken gab bei 20.0 s
	// still auf, und drei Schritte später fehlte dem Beamer das Ergebnis —
	// der Befund zeigte auf die falsche Stelle.
	await bereit(seite);
	const ziel = await knopf.evaluate(
		(el) => el.getAttribute('formaction') ?? el.closest('form')?.getAttribute('action') ?? null
	);
	const passt = (r) =>
		r.request().method() === 'POST' && (ziel === null || r.url().split('#')[0].endsWith(ziel));
	// Zeugenliste für den Fehlerfall: Welche POSTs liefen wirklich, und kam der
	// Klick überhaupt zurück? Ohne das lässt sich ein Timeout nicht deuten.
	const gesehen = [];
	const zeuge = (r) => {
		if (r.request().method() === 'POST') gesehen.push(`antwort ${r.status()} ${r.url()}`);
	};
	const zeugeAnfrage = (r) => {
		if (r.method() === 'POST') gesehen.push(`anfrage ${r.url()}`);
	};
	const zeugeFehler = (r) => {
		if (r.method() === 'POST') gesehen.push(`gescheitert ${r.failure()?.errorText} ${r.url()}`);
	};
	seite.on('response', zeuge);
	seite.on('request', zeugeAnfrage);
	seite.on('requestfailed', zeugeFehler);
	// Vor dem Klick scharfstellen, sonst ist der Nachladelauf vorbei, bevor
	// jemand auf ihn wartet.
	const nachladen = nachladeWarter(seite);
	let antwort;
	try {
		let klickFertig = false;
		[antwort] = await Promise.all([
			seite.waitForResponse(passt, { timeout: 30000 }),
			knopf.click().then(async () => {
				klickFertig = true;
				if (begruendung === null) return;
				const formular = knopf.locator('xpath=ancestor::form[1]');
				const fenster = formular.locator('dialog.rueckfrage[open]');
				await fenster.waitFor({ state: 'visible', timeout: 10000 });
				await fenster.locator('input[name="begruendung"]').fill(begruendung);
				await fenster.locator('button.ja').click({ timeout: 5000 });
			})
		]).catch((fehler) => {
			throw new Error(
				`Keine Antwort auf das Formular ${ziel ?? '(ohne action)'} innert 30 s ` +
					`(Klick zurückgekehrt: ${klickFertig}; POSTs gesehen: ${gesehen.join(' | ') || 'keine'}): ` +
					fehler.message
			);
		});
	} finally {
		seite.off('response', zeuge);
		seite.off('request', zeugeAnfrage);
		seite.off('requestfailed', zeugeFehler);
	}
	/*
	 * Absage und Warten stehen in `e2e/absendung.mjs`: Ein `fail()` kommt über
	 * `use:enhance` als HTTP 200 zurück, und ohne Navigation wartet
	 * `domcontentloaded` auf nichts mehr.
	 *
	 * **`absageErlaubt` an den Stellen, wo die Absage die Prüfung ist.** Vorher
	 * war jede Absage einer abgefangenen Absendung stumm, weil nur der
	 * Statuscode gelesen wurde; die beabsichtigten Absagen kamen deshalb ohne
	 * Zutun durch, die unbeabsichtigten aber auch.
	 */
	if (!absageErlaubt) {
		const grund = await absageGrund(antwort);
		if (grund) throw new Error(grund);
	}
	await nachAbsendung(seite, antwort, nachladen, 120);
}

/**
 * Wartet, bis die Auswahl auf die gesuchte Zahl geschrumpft ist.
 *
 * Die Suche filtert im Browser, und Svelte rechnet die Liste erst im nächsten
 * Durchlauf neu. Sofort zu zählen misst den Stand von vorher — ein Test, der
 * mal grün und mal rot ist.
 */
async function warteAufTreffer(auswahl, anzahl, frist = 5000) {
	const bis = Date.now() + frist;
	let gesehen = -1;
	while (Date.now() < bis) {
		gesehen = await auswahl.count();
		if (gesehen === anzahl) return;
		await new Promise((f) => setTimeout(f, 100));
	}
	throw new Error(`Die Suche liefert ${gesehen} Treffer statt ${anzahl}`);
}

/**
 * Wartet, bis ein selbstsicherndes Feld «gesichert HH:MM» meldet.
 *
 * Über den Text und nicht über einen Filter: Vor der ersten Eingabe steht dort
 * das Verfahren («Wird beim Verlassen des Feldes gesichert.», seit Befund 14),
 * nach dem Sichern eine Uhrzeit — und die Uhrzeit ist der Beweis, dass wirklich
 * geschrieben wurde und nicht bloss ein Feld dasteht.
 */
async function warteAufSicherung(bereich, frist = 10000) {
	const anzeige = bereich.locator('.sicherungsstand').first();
	const bis = Date.now() + frist;
	let gesehen = '';
	while (Date.now() < bis) {
		gesehen = (await anzeige.innerText().catch(() => '')).trim();
		if (/gesichert\s+\d/.test(gesehen)) return gesehen;
		await new Promise((f) => setTimeout(f, 150));
	}
	throw new Error(`Das Feld meldet «${gesehen}» statt eines gesicherten Standes`);
}

/**
 * Tippt in ein selbstsicherndes Feld und wartet, bis es gesichert meldet.
 *
 * **Mit Wiederholung**, aus demselben Grund wie bei `klickeBis`: Das Feld
 * sichert sich erst, wenn die Seite hydriert ist. Wer unmittelbar nach dem
 * Laden tippt, füllt ein Feld, an dem noch nichts hängt — ein Mensch merkt es
 * an der ausbleibenden Rückmeldung und tippt weiter, der Test muss es ebenso
 * halten.
 */
async function tippeUndSichere(seite, bereich, feld, text) {
	await seite.waitForLoadState('load').catch(() => {});
	for (let versuch = 0; versuch < 4; versuch++) {
		await feld.fill(text);
		await seite.locator('h1').first().click();
		try {
			return await warteAufSicherung(bereich, 4000);
		} catch {
			await seite.waitForTimeout(300);
		}
	}
	throw new Error('Das Feld sicherte auch nach vier Versuchen nicht.');
}

/**
 * Füllt ein Feld — und prüft nach, dass der Wert wirklich drinsteht.
 *
 * **Warum das nötig ist.** Playwright füllt, indem es den Inhalt auswählt und
 * neuen einfügt. Trifft das genau die Hydration, misslingt das Auswählen, und
 * der neue Wert landet **hinter** dem alten: Aus «1000» und getippten «1200»
 * wurde «10001200», und die Wertquoten gingen nicht mehr auf. Der Lauf brach
 * dann drei Schritte später mit einer Meldung ab, die nach einem Fehler in der
 * Anwendung aussah.
 *
 * Deshalb: auf `load` warten, füllen, nachsehen, nötigenfalls wiederholen. Ein
 * Mensch macht es genauso — wer sieht, dass im Feld etwas anderes steht als
 * getippt, tippt es nochmals.
 */
async function fuelle(seite, selektor, wert) {
	await bereit(seite);
	for (let versuch = 0; versuch < 3; versuch++) {
		await seite.fill(selektor, wert);
		if ((await seite.inputValue(selektor)) === wert) return;
		await seite.waitForTimeout(150);
	}
	throw new Error(
		`Das Feld ${selektor} enthält «${await seite.inputValue(selektor)}» statt «${wert}»`
	);
}

/**
 * Hingehen — auch wenn die Seite sich gerade selbst neu lädt.
 *
 * Die Saalsichten laden neu, sobald der Ereignisstrom eine Änderung meldet, die
 * er selbst nicht trägt (`components/neuladen.ts`). Trifft das mit einem
 * `goto` zusammen, bricht Playwright mit «interrupted by another navigation»
 * ab — kein Anwendungsfehler, sondern ein Rennen zwischen zwei Navigationen zum
 * **selben** Ziel. Ein Mensch klickt nicht in der Millisekunde des Neuladens;
 * ein Skript schon. Am 11.08.2026 auf `/z` beobachtet, unmittelbar nach dem
 * Eröffnen einer Abstimmung.
 */
async function gehe(seite, pfad) {
	for (let versuch = 0; ; versuch++) {
		try {
			await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'domcontentloaded' });
			return;
		} catch (fehler) {
			if (versuch >= 2 || !/interrupted by another navigation/.test(String(fehler))) throw fehler;
			await seite.waitForTimeout(400);
		}
	}
}

/** Der sichtbare Text der Seite, für Behauptungen über Inhalte. */
async function text(seite) {
	return (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
}

/**
 * Klickt einen Knopf, der erst nach dem Hydrieren wirkt — und prüft nach.
 *
 * Die Seiten kommen fertig vom Server; Knöpfe, die nur im Browser etwas tun,
 * hängen bis zum Hydrieren an nichts. Ein Klick auf `domcontentloaded` fällt
 * dann ins Leere. Statt fest zu warten (was je nach Last mal reicht und mal
 * nicht) wird geklickt, nachgesehen und nötigenfalls noch einmal geklickt.
 *
 * Das ist kein Umgehen eines Fehlers: Ein Mensch, dem nach dem ersten Klick
 * nichts geschieht, klickt auch noch einmal.
 */
async function klickeBis(seite, knopf, ziel, versuche = 4) {
	await bereit(seite);
	for (let i = 0; i < versuche; i++) {
		if (await ziel.isVisible().catch(() => false)) return;
		await knopf.click({ timeout: 5000 }).catch(() => {});
		await ziel.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
	}
	await ziel.waitFor({ state: 'visible', timeout: 2500 });
}

/**
 * Vergleich ohne Rücksicht auf Gross- und Kleinschreibung.
 *
 * Nötig, weil `innerText` die CSS-Umformung mitliefert: Eine Überschrift mit
 * `text-transform: uppercase` liest sich als «BETRIEBSZUSTAND». Ein Test, der
 * daran scheitert, prüft die Formatvorlage statt den Inhalt.
 */
function enthalten(text, muster) {
	return typeof muster === 'string'
		? text.toLowerCase().includes(muster.toLowerCase())
		: muster.test(text);
}

/**
 * Wartet, bis der Text erscheint — und wirft erst dann.
 *
 * Eine starre Momentaufnahme wäre bei einer Oberfläche, die nach dem Laden noch
 * nachrückt, ein Zufallsgenerator.
 */
async function behaupteText(seite, muster, satz, frist = 8000) {
	const bis = Date.now() + frist;
	let zuletzt = '';
	while (Date.now() < bis) {
		zuletzt = await text(seite);
		if (enthalten(zuletzt, muster)) return zuletzt;
		await seite.waitForTimeout(200);
	}
	throw new Error(`${satz} — gesehen: ${zuletzt.slice(0, 260)}`);
}

/** Wartet, bis der Text **nicht** erscheint; prüft sofort und bleibt dabei. */
async function behaupteOhne(seite, muster, satz) {
	const gesehen = await text(seite);
	if (enthalten(gesehen, muster)) throw new Error(`${satz} — gesehen: ${gesehen.slice(0, 260)}`);
	return gesehen;
}

/**
 * Wartet, bis der Server antwortet.
 *
 * `npm run pruefen` ruft `svelte-kit sync` auf, und der Entwicklungsserver baut
 * danach neu. Ein Durchlauf, der unmittelbar folgt, scheiterte bisher an der
 * Anmeldung — mit einer Meldung, die nach einem Fehler in der Anwendung aussah.
 */
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

async function warteAufDenServer(frist = 60000) {
	const bis = Date.now() + frist;
	while (Date.now() < bis) {
		try {
			const antwort = await fetch(`${ZIEL}/anmelden`);
			if (antwort.ok) return;
		} catch {
			/* noch nicht da */
		}
		await new Promise((f) => setTimeout(f, 500));
	}
	throw new Error(`${ZIEL} antwortet nicht.`);
}

async function main() {
	await mkdir(AUFNAHMEN, { recursive: true });
	await warteAufDenServer();
	console.log(`Ziel: ${ZIEL} · Lauf ${LAUF}\n`);

	const browser = await chromium.launch();
	// AUFZEICHNUNG=1 schreibt den Netzverkehr der Leitung als HAR — zum
	// Eingrenzen von Fällen, in denen ein Formular-POST scheinbar versandet.
	const leitungCtx = await browser.newContext({
		viewport: { width: 1400, height: 1000 },
		...(process.env.AUFZEICHNUNG
			? { recordHar: { path: `${AUFNAHMEN}/leitung.har`, content: 'omit' } }
			: {})
	});
	const telefonCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const telefonBCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const beamerCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

	for (const ctx of [leitungCtx, telefonCtx, telefonBCtx, beamerCtx]) {
		await rueckfragenBestaetigen(ctx);
	}
	const leitung = await leitungCtx.newPage();
	const telefon = await telefonCtx.newPage();
	const telefonB = await telefonBCtx.newPage();
	const beamer = await beamerCtx.newPage();
	for (const seite of [leitung, telefon, telefonB, beamer]) warteNachNavigation(seite);
	aktuelleSeite = leitung;

	/**
	 * Den Verlaufs-Aufklapper öffnen — mit Warten.
	 *
	 * **Sporadisch rot war ehrlich** (06.09.2026): Der Klick folgte unmittelbar
	 * auf ein `goto` mit `domcontentloaded`, und der Aufklapper entsteht erst
	 * beim Hydrieren. Ein Wettlauf, den das Drehbuch meistens gewinnt und in
	 * einem von zwei Läufen verlor — mit einer Meldung («Timeout, waiting for
	 * locator»), die nach einem Anwendungsfehler aussieht.
	 */
	async function klappeVerlaufAuf() {
		const auf = leitung.locator('details.verlauf summary').first();
		await auf.waitFor({ state: 'visible', timeout: 20000 });
		await auf.click();
	}

	// Ein Fehler in der Browserkonsole ist ein Befund, auch wenn die Seite
	// dasteht: Er bedeutet, dass ein Teil der Oberfläche nicht läuft.
	const konsolenfehler = [];
	const rueckfragen = [];
	const fehlantworten = [];
	/**
	 * Während ein Schritt einen Schreibkonflikt **absichtlich** auslöst.
	 *
	 * Ein 409 in der Konsole ist sonst ein Befund, und das soll er bleiben. Der
	 * Schritt «Ein Konflikt bleibt stehen» erzeugt einen aber als Zweck: Er
	 * prüft, was die Anzeige danach behauptet. Eng gefasst wie die anderen
	 * Ausnahmen — nur dieser Status, nur dieser Endpunkt, nur solange die Marke
	 * steht.
	 */
	let gewollterKonflikt = false;
	/**
	 * Der Schritt «Abgelaufene Anmeldung löscht keinen Protokolltext» löscht die
	 * Kekse und tippt weiter. Der 401 ist dort das **Prüfziel** — schrittgenau
	 * freigestellt, nicht laufweit (Code-Review 08.09.2026).
	 */
	let gewollteAbmeldung = false;
	/**
	 * Die Schritte zum Mehr der Einladung (06.10.2026) setzen absichtlich ein
	 * milderes Mehr, und die Absage 400 auf `erfordernis?/setzen` ist ihr
	 * Prüfziel. Schrittgenau wie die beiden Marken darüber.
	 */
	let gewollteAbsage = false;
	for (const [wer, seite] of [
		['Leitung', leitung],
		['Telefon', telefon],
		['Telefon B', telefonB],
		['Beamer', beamer]
	]) {
		// Rückfragen bestätigen — und festhalten, welche kamen.
		//
		// Ohne diesen Handler weist Playwright jede `confirm()`-Abfrage ab, das
		// Formular sendet nicht, und der Test meldet «Knopf gefunden, geklickt,
		// nichts passiert». Das kostete beim Bauen dieses Drehbuchs eine halbe
		// Stunde Suche an der falschen Stelle. Die Liste am Ende zeigt zugleich,
		// an welchen Stellen die Anwendung nachfragt — das gehört mit geprüft.
		seite.on('dialog', (d) => {
			rueckfragen.push(`${wer}: ${d.message().split('\n')[0]}`);
			d.accept();
		});
		/*
		 * **Ein abgerissener Nachzug ist kein Befund** (21.08.2026).
		 *
		 * Die Seiten laden nach, sobald der Ereignisstrom etwas meldet. Sendet im
		 * selben Augenblick ein Formular, bricht der Browser den laufenden Abruf
		 * ab und meldet «TypeError: Failed to fetch … at _invalidate».
		 *
		 * Folgenlos: Kommt die Seite ohnehin neu, gibt es nichts nachzuladen —
		 * `nachziehen()` fängt die Ablehnung deshalb ab. Was bleibt, ist die Spur
		 * des Browsers in der Konsole. Sie hier als Befund zu werten hiesse, Läufe
		 * scheitern zu lassen, in denen alle 69 Schritte grün waren; und die
		 * Sperren in `$lib/nachziehen` machen den Fall seltener, aber ein Rennen
		 * lässt sich von der Seite aus nicht ausschliessen.
		 *
		 * **Eng gefasst**: nur dieser Wortlaut, nur aus `_invalidate`. Jeder
		 * andere «Failed to fetch» bleibt ein Befund.
		 */
		/*
		 * **Im gebauten Stand heissen die Funktionen anders** (15.10.2026, F2).
		 * Gegen den Betrieb sind `_invalidate` und `load_data` zu Kürzeln
		 * verdichtet; erhalten bleibt nur der Eigenschaftsname, über den der
		 * Nachzug angestossen wird: `at async Object.jetzt` aus `$lib/nachziehen`.
		 * Drei Läufe am Betrieb meldeten genau diesen Abriss nach den Schritten
		 * 106 bis 108, alle Schritte grün.
		 */
		const abgerissenerNachzug = (text) =>
			/TypeError: Failed to fetch/.test(text) &&
			/_invalidate|load_data|at async Object\.jetzt \(/.test(text);
		/*
		 * **Derselbe Abriss, nach den Kopfzeilen** (07.10.2026). Ersetzt ein
		 * `goto` die Seite, während ein `__data.json` schon geantwortet hat und
		 * SvelteKit den Körper noch liest (`process_stream`), meldet Chromium
		 * «TypeError: network error», und der Standard-`handleError` gibt es
		 * ohne Stapel aus. Am Stapel lässt es sich deshalb nicht erkennen, nur
		 * an der Begleitung: Unmittelbar davor bricht auf derselben Seite ein
		 * `__data.json` mit `net::ERR_ABORTED` ab, nachdem seine Kopfzeilen da
		 * waren. Gemessen im Nachbau (300 Durchgänge, 4 Fälle): Abbruch und
		 * Meldung liegen unter einer Millisekunde auseinander, danach kommt die
		 * neue Seite. Folgenlos aus demselben Grund wie oben.
		 *
		 * **Eng gefasst**: genau dieser Wortlaut, nur mit einem solchen Abbruch
		 * in der letzten Sekunde. Ein Netzwechsel bricht mit
		 * `net::ERR_NETWORK_CHANGED` ab und bleibt ein Befund.
		 */
		const mitKopfzeilen = new WeakSet();
		let datenabbruchUm = -Infinity;
		seite.on('response', (r) => {
			if (r.url().includes('/__data.json')) mitKopfzeilen.add(r.request());
		});
		seite.on('requestfailed', (r) => {
			if (
				r.url().includes('/__data.json') &&
				r.failure()?.errorText === 'net::ERR_ABORTED' &&
				mitKopfzeilen.has(r)
			)
				datenabbruchUm = Date.now();
		});
		const abgerissenerDatenkoerper = (text) =>
			text === 'TypeError: network error' && Date.now() - datenabbruchUm < 1000;

		seite.on('pageerror', (e) => {
			if (abgerissenerNachzug(`${e.message}\n${e.stack ?? ''}`)) return;
			konsolenfehler.push(`${wer} (nach Schritt ${schrittzahl}): ${e.message}`);
		});
		seite.on('console', (m) => {
			// Siehe oben: der 401 des Ereignisstroms gehört zum Schliessen dazu.
			const erwartet =
				m.text().includes('401') ||
				abgerissenerNachzug(m.text()) ||
				abgerissenerDatenkoerper(m.text()) ||
				// Die Konsolenmeldung des Browsers nennt den Status, nicht die
				// Adresse («Failed to load resource … status of 409»). Die Marke
				// steht nur während des einen Schritts, das genügt als Eingrenzung.
				(gewollterKonflikt && m.text().includes('409')) ||
				(gewollteAbsage && m.text().includes('400'));
			if (m.type() === 'error' && !m.text().includes('favicon') && !erwartet) {
				konsolenfehler.push(`${wer} (nach Schritt ${schrittzahl}): ${m.text()}`);
			}
			if (m.type() === 'error') console.log(`   [Konsole ${wer}] ${m.text().slice(0, 200)}`);
		});
		seite.on('response', (r) => {
			/*
			 * **Drei Antworten gehören zum Ablauf und sind keine Befunde** — jede
			 * einem Schritt zugeordnet, nachdem sie seit dem 07.09.2026 als «der
			 * 400 auf protokoll/sichern, nicht reproduzierbar» in der
			 * Befundliste standen:
			 *
			 * 1. **401 auf `/z/strom`.** Der Ereignisstrom endet, sobald die
			 *    Zugangssitzung beim Schliessen der Versammlung entwertet wird.
			 * 2. **409 auf `protokoll/sichern`** im Schritt «Ein Konflikt bleibt
			 *    stehen, auch wenn man die Änderung zurücknimmt». Der Konflikt
			 *    ist dort das Prüfziel: Die Schranke `bisher` arbeitet.
			 * 3. **401 auf `protokoll/sichern`** im Schritt «Abgelaufene
			 *    Anmeldung löscht keinen Protokolltext», nach `clearCookies()`.
			 *
			 * **Schrittgenau, nicht laufweit** (Code-Review 08.09.2026). Die
			 * erste Fassung stellte 401 und 409 auf dieser Route für den ganzen
			 * Lauf frei; damit wäre ein `bisher`-Vergleich, der im Normalbetrieb
			 * 409 erzeugt, unbemerkt geblieben. Die Konsolenwache arbeitet seit
			 * je mit `gewollterKonflikt` — die Antwortwache tut es jetzt auch,
			 * sonst widersprächen sich die beiden.
			 *
			 * Beide laufen über `fetch` in `SicherndesFeld.sichere()` und werden
			 * dort behandelt; in der Konsole stehen sie trotzdem, weil der
			 * Browser jede Antwort ab 400 meldet.
			 */
			const stromEnde = r.status() === 401 && r.url().endsWith('/z/strom');
			const sicherung = r.url().endsWith('/protokoll/sichern');
			const gewollt =
				stromEnde ||
				(sicherung && r.status() === 409 && gewollterKonflikt) ||
				(sicherung && r.status() === 401 && gewollteAbmeldung) ||
				(gewollteAbsage &&
					r.status() === 400 &&
					(r.url().includes('/erfordernis?/setzen') || r.url().endsWith('/gemeinschaften/neu')));
			if (r.status() >= 400 && !gewollt) {
				fehlantworten.push(`${wer}: ${r.status()} ${r.url()}`);
			}
		});
	}

	let gemeinschaftId;

	/**
	 * Die Seite einer Eigentümerzeile öffnen.
	 *
	 * **Seit dem 27.08.2026** (Produktentscheid: ein Einstieg je Zeile) steht alles,
	 * was an einer Zeile handelt, auf ihrer eigenen Seite. Die Tabelle führt mit
	 * «Angaben ändern» dorthin (bis 06.10.2026 «Zeile öffnen»); gegangen wird über den Verweis und nicht über eine
	 * zusammengebaute Adresse, weil damit **auch** geprüft ist, dass der eine
	 * Einstieg wirklich dasteht.
	 */
	async function zeileOeffnen(name) {
		await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
			waitUntil: 'domcontentloaded'
		});
		const zeile = leitung.locator('tbody tr').filter({ hasText: name }).first();
		const weg = zeile.locator('a.bearbeiten');
		behaupte(await weg.count(), `Kein Weg zur Zeile «${name}»`);
		await Promise.all([
			leitung.waitForURL((u) => /\/eigentuemer\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 15000 }),
			weg.first().click()
		]);
		await leitung.waitForLoadState('domcontentloaded');
		await leitung.waitForTimeout(200);
	}

	let versammlungId;
	let traktandumId;
	/** Der zweite angekündigte Antrag — Grundantrag des Folgeantrags, später zurückgezogen. */
	let spielplatzId;
	// Zwei Anträge nach ZGB Art. 712g Abs. 4, für die Betroffenen im Saal (Block A2).
	let gartenId;
	let veloraumId;
	let ausgabecodes = [];
	let anzeigecode;
	/** Das Abschlusspaket, wie der Browser es herunterlädt — für die Prüfschritte. */
	let paket;

	try {
		// ── Vorbereitung ────────────────────────────────────────────────────
		console.log('Vorbereitung');

		await schritt('Wer eine Zugangskarte hat, findet den Weg von der ersten Seite', async () => {
			/*
			 * **Bedienbarkeitsprüfung 05.09.2026, schwerster Befund der
			 * Eigentümersicht.** Die Anmeldeseite war für die Bewirtschaftung
			 * gebaut: Benutzername, Kennwort, Authentik. Ein Eigentümer mit Karte
			 * fand kein Wort zu seinem Code. Der Prüfer probierte ihn als
			 * Benutzernamen, dann als Benutzernamen und Kennwort, dann riet er
			 * neun Adressen — der elfte Versuch führte ihn zum Ziel.
			 *
			 * An einer Versammlung kommen vierzehn Eigentümer auf eine
			 * Sitzungsleitung, und nur die Eigentümer stehen unter Zeitdruck in
			 * einem fremden Saal.
			 */
			await gehe(leitung, '/anmelden');
			const weg = leitung.locator('a[href="/z"]');
			behaupte(
				await weg.count(),
				'Von der Anmeldeseite führt kein Weg zur Zugangskarte'
			);
			const wortlaut = (await weg.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Zugangskarte/i.test(wortlaut),
				`Der Weg nennt die Karte nicht: ${wortlaut}`
			);

			/*
			 * Und er führt wirklich zum Codefeld, nicht nur irgendwohin.
			 *
			 * **Auf die Adresse warten, nicht auf den Ladezustand:** Der
			 * Client-Router wechselt die Seite ohne Vollnavigation, und
			 * `waitForLoadState` kommt sofort zurück, weil die alte Seite längst
			 * geladen ist. Der erste Anlauf mass damit die Anmeldeseite und meldete
			 * einen Befund, den es nicht gab.
			 */
			await weg.first().click();
			await leitung.waitForURL((u) => new URL(u).pathname === '/z', { timeout: 15000 });
			/*
			 * `count()` wartet nicht nach: Nach einer Navigation des Client-Routers
			 * steht die Adresse schon auf `/z`, während das DOM noch die
			 * Anmeldeseite trägt. Ein `waitFor` macht aus dem Wettlauf eine Frist.
			 */
			await leitung
				.locator('input[name="code"]')
				.first()
				.waitFor({ state: 'visible', timeout: 15000 });
			return wortlaut.slice(0, 40);
		});

		await schritt('Anmelden', async () => {
			/*
			 * **Bis zu drei Versuche**, und das ist keine Nachsicht mit der
			 * Anwendung.
			 *
			 * `npm run pruefen` ruft `svelte-kit sync`; der Entwicklungsserver baut
			 * danach beim ersten Aufruf neu. Trifft die Anmeldung genau in dieses
			 * Fenster, kommt die Seite unfertig zurück und das Formular sendet ins
			 * Leere — mit einer Meldung, die nach einem Fehler in der Anwendung
			 * aussieht. Im Betrieb gibt es diesen Zustand nicht: Dort läuft ein
			 * gebautes Abbild ohne Neuübersetzung.
			 */
			for (let versuch = 1; versuch <= 3; versuch++) {
				await leitung.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
				await fuelle(leitung, 'input[name="username"]', BENUTZER);
				await fuelle(leitung, 'input[name="kennwort"]', KENNWORT);
				await abschicken(leitung, leitung.locator('main button[type="submit"]'));
				if (!leitung.url().includes('/anmelden')) return `als ${BENUTZER}`;
				const meldung = await leitung
					.locator('.fehler')
					.first()
					.textContent()
					.catch(() => null);
				// Eine echte Absage (falsches Kennwort, Sperre) wiederholt sich nicht.
				behaupte(!meldung, `Anmeldung abgewiesen: ${meldung}`);
				await leitung.waitForTimeout(1500);
			}
			throw new Error('Anmeldung blieb auch nach drei Versuchen auf der Anmeldeseite.');
		});

		await schritt('Sicherheitskopfzeilen stehen an jeder Antwort', async () => {
			/*
			 * **Der Punkt, der bei der Abnahme am 08.08.2026 fehlte** (Audit B-12):
			 * Es gab keinen einzigen Prüfstand, der eine Kopfzeile geprüft hätte.
			 * Eine Regel, die niemand nachmisst, verschwindet beim nächsten Umbau —
			 * und das fiele erst auf, wenn sie gebraucht würde.
			 *
			 * Geprüft werden die drei Gattungen, die bei der Abnahme
			 * auseinanderfielen: die gewöhnliche Seite, die **Umleitung** des
			 * Wächters und eine **Datei** ohne HTML. Umleitung und Absage kamen
			 * vorher blank heraus, weil `redirect()` und `error()` werfen und
			 * SvelteKit die Antwort oberhalb aller Haken zusammenbaut.
			 */
			const pflicht = ['x-frame-options', 'x-content-type-options', 'referrer-policy'];

			const seite = await leitung.request.get(`${ZIEL}/anmelden`);
			for (const k of pflicht) {
				behaupte(seite.headers()[k], `Der Anmeldeseite fehlt «${k}»`);
			}
			const regel = seite.headers()['content-security-policy'] ?? '';
			behaupte(
				regel.includes("frame-ancestors 'none'"),
				'Die Inhaltssicherheitsregel lässt fremde Rahmen zu'
			);
			behaupte(regel.includes('nonce-'), 'Die Regel vergibt keine Einmalkennung');

			// Die Umleitung des Wächters — ohne Anmeldekeks.
			const umleitung = await leitung.request.get(`${ZIEL}/gemeinschaften`, {
				maxRedirects: 0,
				headers: { cookie: '' }
			});
			behaupte(
				umleitung.status() === 303 || umleitung.status() === 200,
				`Unerwartete Antwort auf /gemeinschaften: ${umleitung.status()}`
			);
			if (umleitung.status() === 303) {
				for (const k of pflicht) {
					behaupte(umleitung.headers()[k], `Der Umleitung des Wächters fehlt «${k}»`);
				}
			}

			const datei = await leitung.request.get(`${ZIEL}/gesundheit`);
			behaupte(
				datei.headers()['x-content-type-options'] === 'nosniff',
				'Der Gesundheitsauskunft fehlt «nosniff»'
			);

			return `CSP mit Einmalkennung, ${pflicht.length} weitere Kopfzeilen`;
		});

		await schritt('Übersicht zeigt den Betriebszustand', async () => {
			await behaupteText(leitung, 'Betriebszustand', 'Kein Betriebszustand auf der Übersicht');
			/*
			 * **Der technische Stand steht seit dem 23.08.2026 im Ausklapper**
			 * (Prüflauf I, A-26). «Datenbank erreichbar (18.4)», «Migrationen 74
			 * ausgeführt» auf der Startseite eines Verwalters war für den Prüfer
			 * «Rauschen» — und es stand direkt über dem Satz, der ihn anging.
			 *
			 * Weggenommen ist es nicht: Der Schritt öffnet den Ausklapper und
			 * prüft dort. Verschwände die Angabe ganz, fiele es hier auf.
			 */
			await leitung.locator('summary', { hasText: 'Technischer Stand' }).first().click();
			await leitung.waitForTimeout(200);
			await behaupteText(leitung, 'Migrationen ausgeführt', 'Keine Migrationsangabe im Ausklapper');
		});

		await schritt('Die Startseite führt in die Arbeit zurück', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «Dashboard besser strukturieren. Bspw.
			 * Schnellstart für Versammlung anlegen, Eigentümer anlegen /
			 * bearbeiten, etc., ein Bereich zuletzt Bearbeitet (wo man direkt rein
			 * und weiterbearbeiten kann). Dann einen Bereich für anstehende und
			 * laufende Versammlungen. Ein Bereich für offene Punkte.»
			 *
			 * Geprüft wird, was ohne Prüfung still verrostet: dass der Schnellstart
			 * überhaupt irgendwohin führt, und dass jeder Weg unter «Zuletzt
			 * bearbeitet» **beide Enden** hat — Eintrag hier, Seite dort. Ein Weg,
			 * der ins Leere führt, ist auf einer Startseite schlimmer als kein Weg:
			 * Er sieht aus wie eine Zusage.
			 */
			await leitung.goto(`${ZIEL}/`, { waitUntil: 'domcontentloaded' });

			const schnellstart = leitung.locator('.schnellstart a');
			const anzahl = await schnellstart.count();
			behaupte(anzahl >= 2, `Der Schnellstart bietet ${anzahl} Handlungen`);
			for (let i = 0; i < anzahl; i++) {
				const weg = await schnellstart.nth(i).getAttribute('href');
				const beschriftung = (await schnellstart.nth(i).innerText()).trim();
				const antwort = await leitung.request.get(`${ZIEL}${weg}`);
				behaupte(
					antwort.ok(),
					`«${beschriftung}» führt auf ${weg} und antwortet ${antwort.status()}`
				);
			}

			return `${anzahl} Schnellstart-Wege, alle erreichbar`;
		});

		await schritt('Archivieren nimmt aus der Liste, nicht aus dem Bestand', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «Kann man eigentlich archivieren? Also dass die
			 * Daten noch da sind, aber nicht in der Suche und Anzeige erscheinen?»
			 *
			 * Geprüft wird beides — was verschwindet UND was bleibt. «Ist weg»
			 * allein bewiese auch eine Liste, die gar nichts mehr zeigt.
			 */
			/*
			 * **Erst anlegen, dann zählen** (28.08.2026). Die Zählung stand vorher
			 * hier oben und setzte damit Vorbestand voraus — auf einer frisch
			 * aufgesetzten Datenbank war der Schritt sofort rot, mit «Keine
			 * Gemeinschaft in der Liste». Ein Drehbuch, das nur auf gewachsenen
			 * Daten läuft, prüft irgendwann die Daten und nicht die Anwendung.
			 *
			 * Die Zusicherung bleibt eine echte Sichtprobe: Sie hält fest, dass
			 * die eben angelegte Gemeinschaft auch wirklich in der Liste steht.
			 */
			// Eine eigene Wegwerf-Gemeinschaft, damit der Lauf nichts Fremdes anfasst.
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Archiv ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const archivId = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/)?.[1];
			behaupte(archivId, `Nach dem Anlegen keine Gemeinschaft erreicht: ${leitung.url()}`);

			/*
			 * **Und eine zweite, die stehen bleibt.** Die Sichtprobe in
			 * `stehtInListe` verlangt, dass die Liste überhaupt Zeilen führt —
			 * sonst bewiese «ist weg» auch eine Liste, die gar nichts mehr zeigt.
			 * Auf einer gewachsenen Datenbank sorgte fremder Bestand dafür; auf
			 * einer frisch aufgesetzten wäre die Liste nach dem Archivieren leer,
			 * und der Schritt scheiterte an seiner eigenen Sichtprobe.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Bleibt ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());

			await leitung.goto(`${ZIEL}/gemeinschaften`, { waitUntil: 'domcontentloaded' });
			const vorher = await leitung.locator('ul.liste > li').count();
			behaupte(vorher > 1, `Die Liste führt ${vorher} Zeilen, erwartet mindestens zwei`);

			await leitung.goto(`${ZIEL}/gemeinschaften/${archivId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			const block = leitung.locator('section.archiv');
			await block.waitFor({ state: 'visible', timeout: 10000 });
			await fuelle(leitung, 'section.archiv input[name="notiz"]', 'Mandat beendet');
			/*
			 * **Erst die Rückfrage, dann der Klick.** Archivieren ohne Rückfrage
			 * wäre die eigentliche Panne — auf einer Liste gleichnamiger Häuser
			 * erwischt man sonst das falsche. Geprüft wird am Markup, weil die
			 * Seite ohne `use:enhance` arbeitet: Das Abschicken lädt neu, und
			 * damit ist die Merkliste von `rueckfragenBestaetigen` wieder leer —
			 * eine Abfrage danach meldete «keine Rückfrage», auch wenn eine kam
			 * (25.08.2026). `textContent` statt `innerText`: Das geschlossene
			 * Fenster steht auf `display: none`.
			 */
			const frage = await block
				.locator('dialog.rueckfrage h2')
				.evaluate((el) => el.textContent ?? '');
			behaupte(
				frage.includes(`E2E Archiv ${LAUF}`),
				`Die Rückfrage nennt die Gemeinschaft nicht: «${frage}»`
			);

			await abschicken(
				leitung,
				block.locator('button').filter({ hasText: 'archivieren' }).first()
			);
			// Bestätigt hat der Beobachter am Kontext (`rueckfragenBestaetigen`).
			const stand = await leitung.locator('section.archiv').innerText();
			behaupte(
				/Im Archiv seit/.test(stand),
				`Die Seite zeigt nach dem Archivieren keinen Archivstand: «${stand.slice(0, 120)}»`
			);

			// **Weg aus der Liste.** Über die Zeile, nicht über den Volltext — die
			// Begründung steht bei `stehtInListe`.
			await stehtInListe(
				leitung,
				archivId,
				false,
				'Die archivierte Gemeinschaft steht noch in der Liste'
			);

			// **Und die Suche sagt, wo sie liegt** — der Fall, wegen dem man sonst
			// eine eigene Archivseite baut.
			await fuelle(leitung, 'input[type="search"]', `E2E Archiv ${LAUF}`);
			await leitung.waitForTimeout(400);
			const hinweis = await leitung
				.locator('.archivhinweis')
				.first()
				.innerText()
				.catch(() => '');
			behaupte(
				/Archiv/.test(hinweis),
				`Die Leerstelle sagt nicht, dass im Archiv etwas liegt: «${hinweis}»`
			);

			// **Und der Schalter holt sie zurück in die Anzeige.**
			await leitung.locator('.archivhinweis button').first().click();
			await leitung.waitForTimeout(400);
			behaupte(
				(await leitung.locator('main').innerText()).includes(`E2E Archiv ${LAUF}`),
				'Der Schalter zeigt die archivierte Gemeinschaft nicht'
			);

			// **Nichts ist gelöscht**: Ihre eigene Seite steht unverändert.
			const antwort = await leitung.request.get(`${ZIEL}/gemeinschaften/${archivId}`);
			behaupte(antwort.ok(), `Die archivierte Gemeinschaft ist nicht mehr erreichbar: ${antwort.status()}`);
			return 'aus der Liste, nicht aus dem Bestand';
		});

		await schritt('Eine Person löschen — der Knopf steht oben, die Schranke unten', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «Personen sollen eine Löschung bekommen, wenn
			 * sie keiner Einheit zugeordnet sind.» Und, mit Bild: «Eigentümer
			 * anlegen ist interessanterweise zuunterst. Mach es gleich wie bei
			 * Gemeinschaften.»
			 *
			 * Beides in einem Schritt, weil es derselbe Weg ist: oben erfassen,
			 * unten wieder löschen.
			 */
			await leitung.goto(`${ZIEL}/personen`, { waitUntil: 'domcontentloaded' });

			// **Der Knopf steht oben rechts**, nicht sechs Bildschirme tiefer.
			// Der Knopf heisst seit dem 27.08.2026 «Person erfassen»: Die Seite
			// führt Personen, nicht Eigentümerzeilen (Produktentscheid).
			const oben = leitung.locator('.kopf button').filter({ hasText: 'Person erfassen' });
			behaupte(
				(await oben.count()) === 1,
				'Auf der Personenliste steht oben kein Knopf zum Erfassen'
			);
			await oben.click();
			await leitung.waitForTimeout(300);
			const formular = leitung.locator('section.anlegen form');
			behaupte(
				await formular.isVisible(),
				'Der Knopf oben klappt das Erfassungsformular nicht auf'
			);

			/*
			 * **Eine zweite Person, die stehen bleibt.** Ohne sie ist die Liste
			 * nach dem Löschen leer, und mit ihr verschwindet auch das Suchfeld.
			 * Die Prüfung unten braucht beides.
			 */
			const bleibt = `E2E Bleibt ${LAUF}`;
			await fuelle(leitung, 'section.anlegen input[name="name"]', bleibt);
			await abschicken(leitung, formular.locator('button[type="submit"]').first());
			/*
			 * **Zustand pruefen statt auf Sichtbarkeit warten.** Der Kasten steht
			 * nur offen, solange die Liste leer ist (`personen/+page.svelte`:
			 * `anlegenOffen = … .length === 0`). Nach der ersten Person ist er zu,
			 * also lief ein `waitFor({ state: 'visible' })` hier in jedem Lauf die
			 * volle Frist ab, bevor der Auffangzweig den Knopf drueckte.
			 */
			await gehe(leitung, '/personen');
			if ((await leitung.locator('section.anlegen form').count()) === 0) {
				await oben.click();
				await leitung.waitForTimeout(300);
			}

			const name = `E2E Loeschbar ${LAUF}`;
			await fuelle(leitung, 'section.anlegen input[name="name"]', name);
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			const personId = leitung.url().match(/personen\/([0-9a-f-]{36})/)?.[1];
			behaupte(personId, `Nach dem Erfassen keine Person erreicht: ${leitung.url()}`);

			// **Und der Weg zurück steht leise unten**, mit Rückfrage.
			const weg = leitung.locator('section.entfernen');
			await weg.waitFor({ state: 'visible', timeout: 10000 });
			const frage = await weg.locator('dialog.rueckfrage h2').evaluate((el) => el.textContent ?? '');
			behaupte(
				frage.includes(name),
				`Die Rückfrage vor dem Löschen nennt die Person nicht: «${frage}»`
			);

			await abschicken(leitung, weg.locator('button').filter({ hasText: 'löschen' }).first());

			// Weg aus der Liste — und die Seite sagt es.
			behaupte(
				leitung.url().includes('/personen'),
				`Nach dem Löschen nicht auf der Liste gelandet: ${leitung.url()}`
			);
			/*
			 * **In der Tabelle suchen, nicht im ganzen Hauptbereich.** Die
			 * Erfolgsmeldung nennt den Namen der gelöschten Person — «steht nicht
			 * mehr in main» wäre deshalb nie erfüllt, obwohl alles stimmt
			 * (25.08.2026 genau so gemessen).
			 */
			behaupte(
				(await leitung.locator('main').innerText()).includes('wurde gelöscht'),
				'Die Liste sagt nicht, dass gelöscht wurde — die Meldung geht still verloren'
			);
			/*
			 * **Die Liste muss stehen, sonst beweist die Behauptung nichts.**
			 *
			 * Steht nach dem Löschen niemand mehr da, fehlt die Tabelle
			 * (`personen/+page.svelte`: `{#if bestand.length > 0 ||
			 * archiviert.length > 0}`), und jede Behauptung über sie wird leer
			 * wahr. Am 27.08.2026 lief dieser Schritt zuerst dreissig Sekunden in
			 * eine Zeitüberschreitung, weil das Aufräumen den Bestand wirklich auf
			 * null gebracht hatte. Statt die Leere zu behandeln, wird sie
			 * ausgeschlossen: Eine zweite Person bleibt stehen.
			 *
			 * **Gesucht wird dabei nicht mehr** (27.08.2026, zweite Runde). Seit
			 * das Suchfeld erst ab neun Einträgen erscheint (`brauchtSuchfeld`),
			 * gibt es bei zwei Personen keines, und ein Drehbuch, das es ausfüllt,
			 * läuft in die Zeitüberschreitung. Die Zeile wird deshalb direkt in der
			 * Tabelle gesucht. Ist der Bestand so gross, dass die Liste gekürzt
			 * ist, schlägt `warteAufTreffer` fehl — laut und an der richtigen
			 * Stelle, nicht still.
			 */
			/*
			 * **Bei grossem Bestand erst filtern** (27.08.2026). Eine ungesuchte
			 * Liste ist auf `LISTENGRENZE` (25) gekürzt; nach ein paar Läufen
			 * stehen mehrere hundert Personen im Dev-Bestand, und dann sind beide
			 * Prüflaufzeilen gar nicht gezeichnet. Gemessen: 376 Personen, der
			 * Schritt meldete «0 Treffer statt 1» und zeigte damit auf die falsche
			 * Stelle. Gefiltert wird nach der Person, die **bleibt**: Dann steht
			 * die Tabelle da (sonst bewiese «ist weg» nichts), und die gelöschte
			 * fehlt in derselben Ansicht.
			 */
			const suchfeld = leitung.locator('.suchleiste input[type="search"]');
			if (await suchfeld.count()) {
				await suchfeld.first().fill(bleibt);
				await leitung.waitForTimeout(200);
			}

			const zeile = leitung.locator('table.liste.karten tr', { hasText: name });
			/*
			 * `warteAufTreffer` wirft selbst, wenn die Zahl nicht erreicht wird.
			 * Eine Behauptung danach koennte nie anschlagen; die Meldung steht
			 * deshalb hier und nicht in einem `behaupte`, das nie laeuft.
			 */
			await warteAufTreffer(zeile, 0, 5000);
			// **Und die Liste steht wirklich da.** Sonst wäre die Zeile darüber
			// auch dann erfüllt, wenn gar nichts gezeichnet wurde.
			behaupte(
				(await leitung.locator('table.liste.karten').count()) === 1,
				'Die Personenliste steht nicht da, dann beweist «ist weg» nichts'
			);

			/*
			 * **Und die zweite Person geht wieder.** Sonst bliebe je Lauf eine
			 * Zeile stehen, und der Schritt erzeugte genau den Bestand, gegen den
			 * `scripts/testdaten-entfernen.sql` von Hand aufgerufen werden muss.
			 */
			const bleibtZeile = leitung.locator('table.liste.karten tr', { hasText: bleibt });
			await warteAufTreffer(bleibtZeile, 1, 5000);
			await bleibtZeile.locator('a').first().click();
			await leitung.waitForLoadState('domcontentloaded');
			await leitung.waitForTimeout(250);
			const wegDamit = leitung.locator('section.entfernen');
			await wegDamit.waitFor({ state: 'visible', timeout: 10000 });
			await abschicken(leitung, wegDamit.locator('button').filter({ hasText: 'löschen' }).first());
			return 'oben erfassen, unten löschen, Rückfrage nennt den Namen';
		});

		await schritt('Die Gruppe geht gemeinsam ins Archiv und kommt gemeinsam zurück', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «Gruppen müssen als gesamte Gruppe archiviert
			 * und wiederhergestellt werden, weil diese zusammenhängen.»
			 *
			 * Die erste Fassung archivierte genau die Zeile, auf der man stand —
			 * die Häuser blieben in der Liste stehen, eingerückt unter nichts.
			 * Geprüft wird deshalb der **Weg über die Oberfläche**, beide
			 * Richtungen: Der Datenbanktest sieht die Ableitung, nicht den Knopf.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Klammer ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const klammerId = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/)?.[1];
			behaupte(klammerId, `Klammer nicht angelegt: ${leitung.url()}`);

			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Haus ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await leitung.selectOption('select[name="parentStwegId"]', klammerId);
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const hausId = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/)?.[1];
			behaupte(hausId && hausId !== klammerId, `Haus nicht angelegt: ${leitung.url()}`);

			// Die Rückfrage muss vorher sagen, was mitgeht — sonst nimmt jemand
			// mehr mit, als er wollte.
			await leitung.goto(`${ZIEL}/gemeinschaften/${klammerId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			const ansage = await leitung.locator('section.archiv').innerText();
			behaupte(
				ansage.includes(`E2E Haus ${LAUF}`) && /gehen? mit ins Archiv/.test(ansage),
				`Die Seite sagt nicht an, dass das Haus mitgeht: «${ansage.slice(0, 200)}»`
			);

			await abschicken(
				leitung,
				leitung
					.locator('section.archiv button')
					.filter({ hasText: 'archivieren' })
					.first()
			);

			// **Beide sind weg** — die Klammer und das Haus.
			await stehtInListe(leitung, klammerId, false, 'Die archivierte Klammer steht noch in der Liste');
			await stehtInListe(
				leitung,
				hausId,
				false,
				'Das Haus steht noch in der Liste, obwohl seine Klammer im Archiv liegt'
			);

			// **Das Haus hat keinen eigenen Weg heraus** — er stünde sonst gegen
			// die Regel, und ein Haus fiele aus seiner Gruppe.
			await leitung.goto(`${ZIEL}/gemeinschaften/${hausId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			const hausstand = await leitung.locator('section.archiv').innerText();
			behaupte(
				hausstand.includes(`E2E Klammer ${LAUF}`),
				`Die Hausseite nennt die Klammer nicht: «${hausstand.slice(0, 200)}»`
			);
			behaupte(
				(await leitung.locator('section.archiv button').filter({ hasText: 'Archiv' }).count()) === 0,
				'Das Haus bietet einen eigenen Knopf, obwohl es zur Gruppe gehört'
			);

			// **Und die Klammer bringt beide zurück.**
			await leitung.goto(`${ZIEL}/gemeinschaften/${klammerId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('section.archiv button').filter({ hasText: 'Aus dem Archiv' }).first()
			);
			await stehtInListe(leitung, klammerId, true, 'Die hervorgeholte Klammer fehlt in der Liste');
			await stehtInListe(
				leitung,
				hausId,
				true,
				'Das Hervorholen der Klammer bringt das Haus nicht zurück'
			);
			return 'Klammer und Haus gemeinsam, in beide Richtungen';
		});

		await schritt('Eine Mehrhausanlage verlangt die Trägerschaft gemäss Grundbuch', async () => {
			/*
			 * **Ä-43, Produktentscheid 17.09.2026** (Auftrag M4, Migration 163).
			 * Wer eine Miteigentümergemeinschaft mit Häusern als Mitgliedern
			 * anlegt, gibt an, wer laut Grundbuch den Anteil trägt. Gemessen wird
			 * der Server, nicht nur das `required` im Browser: Das Formular wird
			 * einmal ohne Wahl abgeschickt, und dann darf nichts angelegt sein.
			 */
			const haeuser = [`E2E Trägerhaus 1 ${LAUF}`, `E2E Trägerhaus 2 ${LAUF}`];
			for (const name of haeuser) {
				await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
				await fuelle(leitung, 'input[name="name"]', name);
				await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
				await leitung.check('input[name="headCountMode"][value="per_owner"]');
				await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
				behaupte(
					/gemeinschaften\/[0-9a-f-]{36}/.test(leitung.url()),
					`Haus «${name}» nicht angelegt: ${leitung.url()}`
				);
			}

			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const bauart = leitung.locator('input[name="art"][value="meg"]');
			for (let i = 0; i < 10 && !(await bauart.isChecked()); i++) {
				await bauart.check();
				await leitung.waitForTimeout(200);
			}
			behaupte(await bauart.isChecked(), 'Die Bauart «Miteigentümergemeinschaft» liess sich nicht wählen');
			const name = `E2E Mehrhausanlage ${LAUF}`;
			await fuelle(leitung, 'input[name="name"]', name);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '2');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			const block = leitung.locator('fieldset.mitglieder');
			for (const haus of haeuser) {
				const k = block.locator('.wahlliste label').filter({ hasText: haus }).locator('input').first();
				for (let i = 0; i < 10 && !(await k.isChecked()); i++) {
					await k.check();
					await leitung.waitForTimeout(200);
				}
				behaupte(await k.isChecked(), `«${haus}» liess sich nicht wählen`);
			}
			for (const feld of await block.locator('input[name^="vertretung:"]').all()) {
				await feld.fill('Vertretung des Hauses');
			}
			const traeger = leitung.locator('fieldset.traegerschaft');
			behaupte(await traeger.count(), 'Das Feld «Trägerschaft gemäss Grundbuch» fehlt');
			const hinweis = await traeger.innerText();
			behaupte(
				/Rechtlich ist noch offen/.test(hinweis) && /Grundbuchauszug/.test(hinweis),
				`Der Hinweis auf die offene Rechtsfrage fehlt: «${hinweis.slice(0, 300)}»`
			);

			// Ohne Wahl am Browser vorbei: Der Server muss abweisen.
			await leitung.evaluate(() =>
				document
					.querySelectorAll('input[name="traegerschaft"]')
					.forEach((e) => e.removeAttribute('required'))
			);
			gewollteAbsage = true;
			try {
				await abschicken(leitung, leitung.locator('main button[type="submit"]').first(), {
					absageErlaubt: true
				});
			} finally {
				gewollteAbsage = false;
			}
			behaupte(
				leitung.url().includes('/gemeinschaften/neu'),
				`Ohne Trägerschaft doch angelegt: ${leitung.url()}`
			);
			await behaupteText(
				leitung,
				'Wählen Sie die Trägerschaft gemäss Grundbuch',
				'Die Absage nennt die fehlende Trägerschaft nicht'
			);

			await leitung.check('input[name="traegerschaft"][value="stammgrundstueck"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const megId = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/)?.[1];
			behaupte(megId, `Mit Trägerschaft nicht angelegt: ${leitung.url()}`);

			// Auf der Angabenseite steht der gespeicherte Wert.
			await leitung.goto(`${ZIEL}/gemeinschaften/${megId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				await leitung.locator('input[name="traegerschaft"][value="stammgrundstueck"]').isChecked(),
				'Die Angabenseite zeigt die gespeicherte Trägerschaft nicht'
			);
			return 'Absage ohne Wahl, angelegt mit «Stammgrundstück», Angabenseite zeigt sie';
		});

		await schritt('Gemeinschaft anlegen, Zählung je Einheit', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			/*
			 * **Befund 28 der Bedienbarkeitsprüfung, im Browser geklärt**
			 * (07.09.2026). Er lautete: «Die Anwendung mahnt eine Fundstelle für
			 * die Zählweise an, die das Anlegeformular gar nicht entgegennimmt.»
			 * Nachgemessen stimmt das nicht — das Feld steht da, aber **erst nach
			 * der Wahl «je Einheit»**, und die Auffangregel ist «je Eigentümer».
			 * Wer die Zählweise nicht umstellt, sieht kein Feld und liest die
			 * Mahnung in der Liste als Widerspruch. Beide Zustände werden deshalb
			 * gemessen, nicht nur der eine.
			 */
			/*
			 * **Das sichtbare Feld, nicht jedes mit dem Namen** (Code-Review
			 * 07.09.2026). Beim Anlegen einer Klammer trägt das Formular
			 * denselben Namen als verstecktes Feld
			 * (`GemeinschaftFormular.svelte`), damit die Spalte einen Wert
			 * bekommt. Ein unqualifiziertes `count()` zählte es mit und meldete
			 * das Gegenteil des Zustands.
			 */
			const fundstelle = leitung.locator('label.fundstelle input[name="headCountRuleSource"]');
			behaupte(
				(await fundstelle.count()) === 0,
				'Die Fundstelle steht schon da, bevor «je Einheit» gewählt ist'
			);
			// Die Abweichung vom Gesetz: Sie verlangt die Fundstelle, und die muss
			// später in der Auswertung stehen.
			await leitung.check('input[name="headCountMode"][value="per_unit"]');
			await fundstelle.waitFor({ state: 'visible', timeout: 5000 });
			await fuelle(leitung, 'input[name="headCountRuleSource"]', 'Art. 28 Abs. 1 Reglement');
			// Der Weg über den persönlichen Zugang ist vorgabemässig zu und wird
			// hier bewusst geöffnet — mit Fundstelle, sonst weist das Formular ab.
			await leitung.check('input[name="proxyByAccess"]');
			await fuelle(leitung, 'input[name="proxyByAccessSource"]', 'Art. 26 Reglement');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const treffer = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(treffer, `Nach dem Anlegen keine Gemeinschaft erreicht: ${leitung.url()}`);
			gemeinschaftId = treffer[1];
			return gemeinschaftId.slice(0, 8);
		});

		await schritt('«Zuletzt bearbeitet» führt in die Arbeit zurück', async () => {
			/*
			 * **Eigener Schritt, nach der ersten Änderung** (25.08.2026). Er stand
			 * bis dahin in Schritt 4, gleich nach dem Anmelden — und war dort nur
			 * grün, weil Prüflaufreste herumlagen: Lesen schreibt keinen Verlauf,
			 * geändert hatte der Lauf zu diesem Zeitpunkt nichts. Nach dem
			 * Aufräumen des Bestands fiel er sofort. Ein Test, der von Resten lebt,
			 * prüft nicht die Anwendung, sondern die Unordnung.
			 *
			 * Geprüft wird, dass jeder Weg **beide Enden** hat — Eintrag hier,
			 * Seite dort. Ein Weg, der ins Leere führt, ist auf einer Startseite
			 * schlimmer als kein Weg: Er sieht aus wie eine Zusage.
			 */
			await leitung.goto(`${ZIEL}/`, { waitUntil: 'domcontentloaded' });

			const zeilen = leitung.locator('.zuletzt li a');
			const zahl = await zeilen.count();
			behaupte(zahl > 0, 'Unter «Zuletzt bearbeitet» steht nichts, obwohl gerade angelegt wurde');
			for (let i = 0; i < zahl; i++) {
				const weg = await zeilen.nth(i).getAttribute('href');
				const antwort = await leitung.request.get(`${ZIEL}${weg}`);
				behaupte(antwort.ok(), `«Zuletzt bearbeitet» führt auf ${weg} — ${antwort.status()}`);
			}

			// Und der Abstand statt eines Zeitstempels: «vor 3 Minuten».
			const ersteZeile = (await zeilen.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/vor \d+ (Minute|Stunde)|gerade eben|heute|gestern/.test(ersteZeile),
				`Die Zeile nennt keinen Abstand: «${ersteZeile}»`
			);
			return `${zahl} Wege, alle erreichbar`;
		});

		await schritt('Der Weg zum Dateiimport steht bei den Eigentümern', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «und wie kann ich den CSV oder Excel Import
			 * machen?» Es ging nur mit CSV, und der einzige Weg dorthin stand auf
			 * der Einheitenseite unter «Mehrere auf einmal?» — wer Eigentümer
			 * erfasst, sucht ihn dort nicht.
			 *
			 * Geprüft wird, was ein Benutzer sieht: der Weg von der Eigentümerliste
			 * und dass das Feld Excel-Dateien annimmt. Dass eine Mappe wirklich
			 * gelesen wird, prüfen `tests/domain/xlsxlesen.test.ts` und
			 * `tests/db/uebernahme.test.ts` — dort lässt sich eine echte Datei
			 * bauen.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
				waitUntil: 'domcontentloaded'
			});
			const weg = leitung.locator('a[href*="/uebernahme?quelle=datei"]').first();
			behaupte(
				await weg.count(),
				'Auf der Eigentümerliste steht kein Weg zum Dateiimport'
			);

			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/uebernahme?quelle=datei`, {
				waitUntil: 'domcontentloaded'
			});
			const feld = leitung.locator('input[type="file"][name="datei"]');
			await feld.waitFor({ state: 'visible', timeout: 10000 });
			const nimmt = (await feld.getAttribute('accept')) ?? '';
			behaupte(
				nimmt.includes('.xlsx') && nimmt.includes('.csv'),
				`Das Feld nimmt «${nimmt}» — Excel fehlt`
			);

			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Excel/.test(text),
				'Die Seite sagt nicht, dass Excel-Dateien gehen'
			);
			return 'Weg von der Eigentümerliste, Feld nimmt .xlsx';
		});

		/*
		 * **Ein Eigentuemerwechsel ueber die Datei** (01.09.2026).
		 *
		 * Der Weg, an dem der Fehler sass: Nannte eine Datei nur einen anderen
		 * Eigentuemer, meldete die Vorschau «unveraendert» und die Handaenderung
		 * geschah gar nicht. Geprueft wird in einer **eigenen** Gemeinschaft,
		 * zweimal hintereinander — der erste Lauf legt Einheit und Eigentuemer
		 * mit Fremdkennung an, der zweite wechselt. So bleibt der Bestand des
		 * Hauptlaufs unberuehrt.
		 */
		await schritt('Eine Datei wechselt den Eigentuemer', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Dateiweg ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const treffer = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(treffer, `Gemeinschaft fuer den Dateiweg nicht angelegt: ${leitung.url()}`);
			const dateiweg = treffer[1];

			const eigentuemerdatei = [
				'voter_ref;display_name;ownership_type',
				'D-ALT;Aebi Datei;alleineigentum',
				'D-NEU;Bucher Datei;alleineigentum'
			].join('\n');
			const mitAlt = [
				'holding_ref;holding_type;label;owner_voter_ref;quota_units',
				'D-H1;unit;Dateiwohnung;D-ALT;1000'
			].join('\n');
			const mitNeu = mitAlt.replace('D-ALT', 'D-NEU');

			/**
			 * Eine Datei hochladen, pruefen lassen und uebernehmen.
			 *
			 * `ab` setzt den Stichtag auf der Vorschauseite. Er entscheidet, wie ein
			 * Wechsel geschrieben wird: Auf **denselben** Tag wie die laufende
			 * Zuordnung ersetzt er sie (ein Zeitraum von null Tagen waere keiner),
			 * auf einen spaeteren beendet er sie und beginnt eine neue.
			 */
			async function uebernimm(inhalt, name, ab) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${dateiweg}/uebernahme?quelle=datei`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung.locator('input[type="file"][name="datei"]').setInputFiles({
					name,
					mimeType: 'text/csv',
					buffer: Buffer.from(inhalt, 'utf8')
				});
				await abschicken(leitung, leitung.locator('form[action="?/pruefen"] button[type="submit"]'));
				const gezeigt = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
				if (ab) await fuelle(leitung, 'form[action="?/uebernehmen"] input[name="stichtag"]', ab);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/uebernehmen"] button[type="submit"]')
				);
				return gezeigt;
			}

			await uebernimm(eigentuemerdatei, 'eigentuemer.csv');
			await uebernimm(mitAlt, 'einheiten.csv');

			/*
			 * **Zweimal derselbe Stichtag ergibt eine Zeile, keinen Abbruch.**
			 * Genau hier schlug vor dem 01.09.2026 die Schranke `ownership_zeitraum`
			 * durch: Der alte Schreibweg kappte die eben angelegte Zuordnung auf
			 * ihren eigenen Beginn, und die ganze Uebernahme rollte zurueck.
			 */
			await uebernimm(mitNeu, 'einheiten-gleicher-tag.csv');
			await leitung.goto(`${ZIEL}/gemeinschaften/${dateiweg}/eigentuemer`, {
				waitUntil: 'domcontentloaded'
			});
			await klappeVerlaufAuf();
			const nachGleichemTag = await leitung.locator('details.verlauf tbody tr').allInnerTexts();
			behaupte(
				nachGleichemTag.length === 1,
				`Nach dem Wechsel am selben Tag stehen ${nachGleichemTag.length} Zeilen: ${nachGleichemTag.join(' | ')}`
			);

			// Und jetzt ein echter Wechsel: derselbe Bestand, spaeterer Stichtag.
			const spaeter = hiesigerTag(90);
			const vorschautext = await uebernimm(mitAlt, 'einheiten-zurueck.csv', spaeter);
			behaupte(
				/Eigent(ü|ue)mer: D-NEU/.test(vorschautext),
				`Die Vorschau nennt den Eigentuemerwechsel nicht: ${vorschautext.slice(0, 400)}`
			);
			behaupte(
				!/1 unver(ä|ae)ndert/.test(vorschautext),
				`Die Vorschau haelt den Wechsel fuer unveraendert: ${vorschautext.slice(0, 400)}`
			);

			// Nachgemessen am Verlauf: zwei Zeilen, die erste beendet.
			await leitung.goto(`${ZIEL}/gemeinschaften/${dateiweg}/eigentuemer`, {
				waitUntil: 'domcontentloaded'
			});
			await klappeVerlaufAuf();
			const zeilen = await leitung.locator('details.verlauf tbody tr').allInnerTexts();
			behaupte(
				zeilen.length === 2,
				`Der Verlauf hat ${zeilen.length} Zeilen statt zwei: ${zeilen.join(' | ')}`
			);
			behaupte(
				/Bucher Datei/.test(zeilen[0]) && !/auf Weiteres/.test(zeilen[0]),
				`Die erste Zeile ist nicht der beendete Voreigentuemer: ${zeilen[0]}`
			);
			behaupte(
				/Aebi Datei/.test(zeilen[1]) && /auf Weiteres/.test(zeilen[1]),
				`Die zweite Zeile ist nicht der laufende Neueigentuemer: ${zeilen[1]}`
			);
			return 'gleicher Tag ersetzt, spaeterer Tag beendet und beginnt neu';
		});

		await schritt('Drei Einheiten mit zusammen 1000 Anteilen', async () => {
			for (const [label, quote] of [
				['Whg 1', '400'],
				['Whg 2', '400'],
				['Whg 3', '200']
			]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/einheiten`, {
					waitUntil: 'domcontentloaded'
				});
				await fuelle(leitung, 'input[name="label"]', label);
				await fuelle(leitung, 'input[name="quote.stamm"]', quote);
				/*
				 * **Zimmer, Fläche und Lage in eigenen Feldern**
				 * (Bedienbarkeitsprüfung 05.09.2026, Befund 26: «Zimmerzahl, Fläche
				 * und Lage landen in einem Klumpen, der überall erscheint, auch auf
				 * der Zugangskarte»). Nur bei der ersten Einheit — geprüft wird das
				 * Feld, nicht die Wiederholung.
				 */
				if (label === 'Whg 1') {
					await fuelle(leitung, 'form[action="?/anlegen"] input[name="zimmer"]', '3.5');
					await fuelle(leitung, 'form[action="?/anlegen"] input[name="flaeche"]', '87');
					await fuelle(leitung, 'form[action="?/anlegen"] input[name="lage"]', 'EG links');
				}
				await abschicken(
					leitung,
					leitung.locator('form[action="?/anlegen"] button[type="submit"]')
				);
			}
			// Über die Eingabefelder gezählt, nicht über den Text: Die Bezeichnungen
			// stehen in bearbeitbaren Feldern, und `innerText` sieht deren Werte nicht.
			const zeilen = await leitung.locator('input[name^="label."]').count();
			behaupte(zeilen === 3, `${zeilen} statt 3 Einheiten in der Liste`);
			await behaupteOhne(leitung, 'geht nicht auf', 'Wertquotensaldo geht nicht auf');
			await behaupteText(leitung, 'geht auf', 'Keine Saldoprüfung sichtbar');

			/*
			 * **Und die drei Merkmale stehen in ihren eigenen Spalten** — nicht in
			 * der Bezeichnung. Genau das war Befund 26: Ohne eigene Felder schreibt
			 * man «3.5 Zi., 87 m², EG links» in den Namen, und der steht danach auf
			 * jeder Zugangskarte.
			 */
			const merkmale = leitung.locator('tbody tr').filter({ has: leitung.locator('input[value="Whg 1"]') });
			behaupte(
				(await merkmale.locator('input[name^="zimmer."]').inputValue()) === '3.5',
				'Die Zimmerzahl steht nicht in ihrer Spalte'
			);
			behaupte(
				(await merkmale.locator('input[name^="lage."]').inputValue()) === 'EG links',
				'Die Lage steht nicht in ihrer Spalte'
			);
			behaupte(
				(await merkmale.locator('input[name^="label."]').inputValue()) === 'Whg 1',
				'Die Bezeichnung trägt den Klumpen weiter'
			);
			return '400 + 400 + 200, Merkmale in eigenen Spalten';
		});

		await schritt('Zwanzig Einheiten in einem Zug — ohne Eigentümer', async () => {
			/*
			 * **Bedienbarkeitsprüfung 05.09.2026, Befund 29**: «Fünf Einheiten sind
			 * fünfmal dasselbe Formular; ‹Aus Datei übernehmen› verlangt je einen
			 * Eigentümer und hilft hier nicht.»
			 *
			 * In einer **eigenen** Gemeinschaft: Die Sammeleingabe legt Einheiten
			 * an, und in der Gemeinschaft des Durchstichs verschöbe das die
			 * Wertquoten, an denen jede spätere Auszählung hängt.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Sammelweg ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			// Die Auffangregel ausdrücklich: Sie verlangt keine Fundstelle, und der
			// Schritt hier misst die Sammeleingabe, nicht die Zählweise.
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const treffer = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(treffer, `Die Sammelgemeinschaft entstand nicht: ${leitung.url()}`);

			await leitung.goto(`${ZIEL}/gemeinschaften/${treffer[1]}/einheiten`, {
				waitUntil: 'domcontentloaded'
			});

			/*
			 * **Zwanzig Zeilen, drei davon falsch.** Die drei Zusagen des Weges
			 * tragen erst bei Menge: alle Fehler in einem Durchgang, jede Absage
			 * mit ihrer Zeile, und nichts angelegt, wenn eine Zeile klemmt. Mit
			 * drei Zeilen liesse sich keine davon von einem Zufall unterscheiden.
			 *
			 * Zeile 5 ohne Quote, Zeile 9 mit einer Zimmerzahl, die keine ist,
			 * Zeile 14 mit einer unglaubhaften Fläche — die letzte weist erst der
			 * Kern beim Schreiben ab, nicht der Zeilenleser. Genau daran hing der
			 * Befund «alles oder nichts».
			 */
			const zwanzig = Array.from({ length: 20 }, (_, i) => {
				const n = i + 1;
				if (n === 5) return `Whg ${n}`;
				if (n === 9) return `Whg ${n}; 50; drei`;
				if (n === 14) return `Whg ${n}; 50; 3.5; 99999`;
				return `Whg ${n}; 50`;
			});
			await fuelle(
				leitung,
				'form[action="?/sammelAnlegen"] textarea[name="zeilen"]',
				['# Bezeichnung; Quote', ...zwanzig].join('\n')
			);
			// Die Absage ist hier der Zweck, nicht ein Zwischenfall.
			await abschicken(
				leitung,
				leitung.locator('form[action="?/sammelAnlegen"] button[type="submit"]'),
				{ absageErlaubt: true }
			);
			const absage = (await leitung.locator('ul.zeilenfehler').innerText()).replace(/\s+/g, ' ');
			// **Beide Formfehler in EINEM Durchgang** — mit ihrer Zeilennummer. Die
			// Überschriftszeile zählt mit, also 6 und 10.
			behaupte(
				/Zeile 6/.test(absage) && /Zeile 10/.test(absage),
				`Die Absage nennt nicht beide Zeilen: ${absage.slice(0, 200)}`
			);
			behaupte(
				/Stammquote fehlt/.test(absage) && /keine Zahl/.test(absage),
				`Die Absage nennt die Gründe nicht: ${absage.slice(0, 200)}`
			);
			// **Alles oder nichts**: Auch die guten Zeilen dürfen nicht entstanden
			// sein, sonst legt der zweite Anlauf sie doppelt an.
			behaupte(
				(await leitung.locator('input[name^="label."]').count()) === 0,
				'Trotz Absage sind Einheiten entstanden'
			);

			/*
			 * **Der zweite Anlauf: Form in Ordnung, Sache nicht.** Zeile 14 trägt
			 * eine Fläche, die erst der Kern beim Schreiben abweist. Ohne die
			 * gemeinsame Transaktion stünden danach dreizehn Einheiten da, während
			 * die Seite «keine einzige» meldet.
			 */
			const nurSache = zwanzig.map((z, i) =>
				i + 1 === 5 ? 'Whg 5; 50' : i + 1 === 9 ? 'Whg 9; 50' : z
			);
			await fuelle(
				leitung,
				'form[action="?/sammelAnlegen"] textarea[name="zeilen"]',
				nurSache.join('\n')
			);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/sammelAnlegen"] button[type="submit"]'),
				{ absageErlaubt: true }
			);
			behaupte(
				(await leitung.locator('input[name^="label."]').count()) === 0,
				'Nach der Absage im Schreibweg stehen trotzdem Einheiten da'
			);

			await fuelle(
				leitung,
				'form[action="?/sammelAnlegen"] textarea[name="zeilen"]',
				'Whg 1; 500; 3.5; 87; EG links\nWhg 2; 500; 4,5; 102,5; 1. OG'
			);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/sammelAnlegen"] button[type="submit"]')
			);
			const angelegt = await leitung.locator('input[name^="label."]').count();
			behaupte(angelegt === 2, `${angelegt} statt 2 Einheiten aus der Sammeleingabe`);
			// Das Komma als Dezimaltrennzeichen: Auf einer Schweizer Tastatur tippt
			// man «102,5», und eine Absage dafür wäre eine Falle.
			const zweite = leitung
				.locator('tbody tr')
				.filter({ has: leitung.locator('input[value="Whg 2"]') });
			behaupte(
				(await zweite.locator('input[name^="flaeche."]').inputValue()) === '102.5',
				'Das Komma wurde nicht als Dezimaltrennzeichen gelesen'
			);
			await behaupteText(leitung, 'geht auf', 'Der Saldo der Sammelgemeinschaft geht nicht auf');
			return '20 Zeilen, zwei Absagen mit Zeilennummer, nichts halb angelegt';
		});

		await schritt('Drei Eigentümer anlegen und zuordnen', async () => {
			for (const name of [`Aebi ${LAUF}`, `Bucher ${LAUF}`, `Christen ${LAUF}`]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await fuelle(leitung, 'form[action="?/anlegen"] input[name="displayName"]', name);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/anlegen"] button[type="submit"]')
				);
			}

			// Namentlich zuordnen, nicht über Positionen: Das Auswahlfeld bietet
			// **alle** Einheiten an, auch die schon zugeordneten. Über den Index
			// träfe der zweite Durchgang wieder Whg 1 — und löste die Rückfrage aus,
			// ob die bestehende Zuordnung verdrängt werden soll.
			const paare = [
				['Whg 1', `Aebi ${LAUF}`],
				['Whg 2', `Bucher ${LAUF}`],
				['Whg 3', `Christen ${LAUF}`]
			];
			for (const [einheit, partei] of paare) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="unitId"]'),
					einheit
				);
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="partyId"]'),
					partei
				);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/zuordnen"] button[type="submit"]')
				);
				await behaupteOhne(
					leitung,
					'wirkt in die Vergangenheit',
					`Rückfrage bei der Zuordnung von ${einheit} — die Einheit war schon vergeben`
				);
			}

			/*
			 * **Nach dem Zuordnen ist die Auswahl leer** (03.09.2026, aus dem
			 * Code-Review zur `enhance`-Umstellung).
			 *
			 * Der Anlass: Beim Umstellen auf `absenden()` blieb die Einheit nach dem
			 * Zuordnen in der Auswahl stehen. Die Ursache lag eine Ebene tiefer —
			 * `form.reset()` löst kein `change` aus, also meldete `gefuehrteWahl`
			 * nichts, und beim nächsten Zeichnen schrieb Svelte die alte Wahl über
			 * `selected={…}` zurück. Der nächste Klick ordnete dieselbe Einheit ein
			 * zweites Mal zu.
			 *
			 * **Diese Zeile ist der Wächter dazu.** Seit `gefuehrteWahl` auf das
			 * Zurücksetzen hört (03.09.2026), trägt das Formular `absenden()` und
			 * die Auswahl ist danach leer. Nimmt jemand den Zuhörer heraus, wird
			 * dieser Schritt rot — dreimal so gemessen.
			 *
			 * **Ohne `goto` dazwischen**: Die Schleife darüber lädt vor jeder
			 * Zuordnung neu und sähe den Fall nie. Hier steht die Seite noch im
			 * Zustand nach der letzten Absendung.
			 */
			for (const feld of ['unitId', 'partyId']) {
				const wert = await leitung
					.locator(`form[action="?/zuordnen"] select[name="${feld}"]`)
					.inputValue();
				behaupte(
					wert === '',
					`«${feld}» steht nach dem Zuordnen noch auf «${wert}» — der nächste Klick ordnet dasselbe noch einmal zu`
				);
			}

			const t = await text(leitung);
			behaupte(
				!t.includes('ohne Eigentümer') || t.includes('0 Einheiten ohne'),
				'Es bleiben Einheiten ohne Eigentümer'
			);
			return 'je eine Einheit, Auswahl danach leer';
		});

		/**
		 * **Auch nach der Rückfrage ist die Maske leer** (03.09.2026, aus dem
		 * Code-Review).
		 *
		 * Eine **rückwirkende** Zuordnung beantwortet der Server mit `fail(409)`
		 * und einer Rückfrage. Bei einer Absage setzt SvelteKit nichts zurück —
		 * richtig, sonst verlöre man das Getippte. Bestätigt wird dann aber im
		 * **eigenen** Formular des Fensters, und das Hauptformular dahinter sieht
		 * nie ein `reset`: Einheit und Eigentümer blieben stehen, und der nächste
		 * Klick täte dasselbe noch einmal.
		 *
		 * Vor der Umstellung auf `absenden()` fiel das nicht auf, weil die erste
		 * Absendung die Seite neu lud. Der Weg hat bis hierher gar keinen
		 * Durchstich gehabt.
		 */
		await schritt('Auch nach der Rückfrage steht die Maske leer', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
				waitUntil: 'domcontentloaded'
			});
			const formular = leitung.locator('form.felder[action="?/zuordnen"]');
			await formular.waitFor({ state: 'visible', timeout: 15000 });

			// Dieselbe Einheit noch einmal, aber rückwirkend — das löst die Frage aus.
			const einheit = await formular
				.locator('select[name="unitId"] option')
				.nth(1)
				.getAttribute('value');
			const partei = await formular
				.locator('select[name="partyId"] option')
				.nth(1)
				.getAttribute('value');
			await formular.locator('select[name="unitId"]').selectOption(einheit);
			await formular.locator('select[name="partyId"]').selectOption(partei);
			await formular.locator('input[name="ab"]').fill('2020-01-01');
			// Die Rückfrage IST eine Absage (409) — hier ist sie der Zweck.
			await abschicken(leitung, formular.locator('button[type="submit"]').first(), {
				absageErlaubt: true
			});

			const fenster = leitung.locator('dialog.serverfrage');
			/*
			 * **Die Rückfrage MUSS kommen** (aus der zweiten Reviewrunde). Der erste
			 * Anlauf kehrte mit einem Satz zurück, wenn das Fenster ausblieb — und
			 * war damit grün, ohne etwas gemessen zu haben. Genau die Klasse, die
			 * dieser Lauf sonst überall schliesst: Ein Schritt, der nicht rot werden
			 * kann, ist eine Zeile im Bericht und sonst nichts.
			 */
			const kam = await fenster
				.waitFor({ state: 'visible', timeout: 8000 })
				.then(() => true)
				.catch(() => false);
			behaupte(
				kam,
				'Die rückwirkende Zuordnung löste keine Rückfrage aus — der Schritt misst dann nichts'
			);

			await abschicken(leitung, fenster.locator('button[type="submit"]').first());

			for (const feld of ['unitId', 'partyId']) {
				const wert = await formular.locator(`select[name="${feld}"]`).inputValue();
				behaupte(
					wert === '',
					`«${feld}» steht nach der bestätigten Rückfrage noch auf «${wert}»`
				);
			}
			return 'rückwirkend zugeordnet, Maske danach leer';
		});

		/*
		 * **Die Eigentumshistorie** (Auftraggeber, 01.09.2026: «eine Historie wer von wann
		 * bis wann Eigentümer war»). Die Tabelle dafür gab es seit Migration 006,
		 * die Sicht darauf nicht — `valid_from` stand in keiner Ansicht.
		 *
		 * Geprüft wird an einem echten Wechsel: Eine Einheit bekommt einen zweiten
		 * Eigentümer ab einem späteren Tag; danach muss die Kette beide tragen,
		 * die erste mit Ende, die zweite mit «auf Weiteres».
		 */
		await schritt('Eigentum im Zeitverlauf zeigt die Kette', async () => {
			const url = `${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`;
			await leitung.goto(url, { waitUntil: 'domcontentloaded' });

			const verlauf = leitung.locator('details.verlauf');
			await verlauf.waitFor({ state: 'visible', timeout: 30000 });
			await verlauf.locator('summary').click();
			const vorher = await verlauf.locator('tbody tr').count();
			behaupte(vorher === 3, `${vorher} Zeilen im Verlauf, erwartet 3 (je Einheit eine)`);

			// Ein Wechsel an «Whg 1»: Christen übernimmt ab einem festen Tag.
			await waehleNachAnfang(
				leitung.locator('form[action="?/zuordnen"] select[name="unitId"]'),
				'Whg 1'
			);
			await waehleNachAnfang(
				leitung.locator('form[action="?/zuordnen"] select[name="partyId"]'),
				`Christen ${LAUF}`
			);
			await fuelle(leitung, 'form[action="?/zuordnen"] input[name="ab"]', '2026-12-01');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/zuordnen"] button[type="submit"]')
			);

			await leitung.goto(url, { waitUntil: 'domcontentloaded' });
			await klappeVerlaufAuf();
			const zeilen = leitung.locator('details.verlauf tbody tr');
			const nachher = await zeilen.count();
			behaupte(nachher === 4, `${nachher} Zeilen im Verlauf, erwartet 4 nach dem Wechsel`);

			/*
			 * Die beiden Zeilen von «Whg 1» stehen beieinander, älteste zuerst:
			 * Die erste trägt jetzt ein Ende, die zweite «auf Weiteres».
			 */
			/*
			 * **Auf die Einheit filtern, nicht auf die Namen** (01.09.2026, aus dem
			 * Code-Review). «Christen» hält auch Whg 3; über die Namen gefiltert
			 * endete die Kette an jener Zeile, die unabhängig von dieser Änderung
			 * offen ist — ein falsches Ende an Whg 1 wäre grün geblieben.
			 *
			 * Die Zeilen von Whg 1 sind die beiden ersten der Tabelle (sortiert
			 * nach Einheit), und die Einheit steht nur an der ersten von ihnen.
			 */
			const alle = await zeilen.allInnerTexts();
			const beginn = alle.findIndex((z) => /Whg 1/.test(z));
			behaupte(beginn >= 0, `Whg 1 steht nicht im Verlauf: ${alle.join(' | ').slice(0, 200)}`);
			const kette = alle.slice(beginn, beginn + 2);
			behaupte(
				kette.length >= 2,
				`Die Kette von Whg 1 hat ${kette.length} Zeilen: ${alle.join(' | ').slice(0, 200)}`
			);
			behaupte(
				/auf Weiteres/.test(kette[kette.length - 1]),
				`Die letzte Zeile der Kette endet nicht offen: ${kette[kette.length - 1]}`
			);
			behaupte(
				!/auf Weiteres/.test(kette[0]),
				`Die erste Zeile der Kette trägt kein Ende: ${kette[0]}`
			);
			return `${nachher} Einträge, Kette mit Ende und «auf Weiteres»`;
		});

		await schritt('Berichtigen behält, was nicht im Formular steht', async () => {
			/*
			 * **Gefunden am 23.08.2026 beim Bau des Bemerkungsfeldes.**
			 *
			 * Telefon und Adresse liessen sich beim Anlegen erfassen und danach
			 * nie mehr ändern — es gab kein Feld dafür. Schlimmer: Weil die
			 * Aktion alle Felder schreibt und das Formular sie nicht schickte,
			 * LÖSCHTE jedes «Berichtigen» beide. Wer eine falsch geschriebene
			 * Adresse richtigstellen wollte, hatte danach gar keine mehr, und
			 * niemand sah es der Zeile an.
			 *
			 * Der Weg war bis heute in keinem Durchgang.
			 */
			/*
			 * **Seit dem 27.08.2026 steht der Weg auf der Seite der Zeile**
			 * (Produktentscheid: ein Einstieg je Zeile statt sechs in einer
			 * Tabellenzelle). Die Tabelle führt mit «Angaben ändern» dorthin.
			 */
			await zeileOeffnen(`Aebi ${LAUF}`);
			const aufklappen = leitung.locator('details.angaben summary').first();
			behaupte(await aufklappen.count(), 'Kein Weg zum Berichtigen einer Eigentümerzeile');
			await aufklappen.click();

			const formular = leitung.locator('form[action="?/angabenBerichtigen"]').first();
			for (const feld of ['phone', 'address']) {
				behaupte(
					await formular.locator(`input[name="${feld}"]`).count(),
					`Das Formular hat kein Feld «${feld}» — die Aktion schreibt es trotzdem und löscht es damit`
				);
			}
			await formular.locator('input[name="phone"]').waitFor({ state: 'visible', timeout: 5000 });
			await formular.locator('input[name="phone"]').fill('031 000 00 01');
			await formular.locator('input[name="address"]').fill('Prüfweg 7, 3000 Bern');
			/*
			 * **Die Bemerkung hängt an der Person** (A-12). Sie steht hier, weil
			 * hierher kommt, wer Eigentümer erfasst — geschrieben wird sie an der
			 * Person, und am Ende des Durchgangs wird geprüft, dass sie in keiner
			 * Unterlage auftaucht.
			 */
			const bemerkung = formular.locator('input[name="bemerkung"]');
			behaupte(
				await bemerkung.count(),
				'Kein Bemerkungsfeld an der Eigentümerzeile — der Weg dorthin führt nur über die Personenseite'
			);
			await bemerkung.fill(BEMERKUNGSWORT);
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			// Zweites Berichtigen, diesmal nur der Name: Genau hier gingen die
			// beiden Angaben verloren.
			await zeileOeffnen(`Aebi ${LAUF}`);
			await leitung.locator('details.angaben summary').first().click();
			const zweites = leitung.locator('form[action="?/angabenBerichtigen"]').first();
			await zweites.locator('input[name="displayName"]').waitFor({ state: 'visible', timeout: 5000 });
			await zweites.locator('input[name="displayName"]').fill(`Aebi ${LAUF}`);
			await abschicken(leitung, zweites.locator('button[type="submit"]').first());

			await zeileOeffnen(`Aebi ${LAUF}`);
			await leitung.locator('details.angaben summary').first().click();
			const geblieben = leitung.locator('form[action="?/angabenBerichtigen"]').first();
			await geblieben.locator('input[name="phone"]').waitFor({ state: 'visible', timeout: 5000 });
			const telefon = await geblieben.locator('input[name="phone"]').inputValue();
			const anschrift = await geblieben.locator('input[name="address"]').inputValue();
			behaupte(
				telefon.includes('031 000 00 01'),
				`Das Telefon ging beim Berichtigen verloren: «${telefon}»`
			);
			behaupte(
				anschrift.includes('Prüfweg 7'),
				`Die Adresse ging beim Berichtigen verloren: «${anschrift}»`
			);
			const notiz = await geblieben.locator('input[name="bemerkung"]').inputValue();
			behaupte(
				notiz.includes(BEMERKUNGSWORT),
				`Die Personenbemerkung ging beim Berichtigen verloren: «${notiz}»`
			);
			return 'Telefon, Adresse und Bemerkung überstehen ein zweites Berichtigen';
		});

		await schritt('Eine leere Eigentümerzeile lässt sich tilgen', async () => {
			/*
			 * Befund A-15 aus Prüflauf II: Nach der Übernahme aus einer Tabelle
			 * standen in Haus B sechzehn Zeilen für vierzehn Einheiten, zwei davon
			 * Karteileichen ohne jeden Weg, sie loszuwerden. Seit 23.08.2026 hat
			 * eine Zeile, die nichts hält, einen Tilgen-Knopf — und nur die.
			 */
			const url = `${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`;
			await leitung.goto(url, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'form[action="?/anlegen"] input[name="displayName"]', `Karteileiche ${LAUF}`);
			await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));

			/*
			 * Neu laden und auf Ruhe warten, bevor geklickt wird: Die Rückfrage
			 * hängt an `bind:this` auf dem <dialog>. Wer klickt, bevor Svelte
			 * hydriert hat, löst ein gewöhnliches HTML-Absenden aus — der Knopf
			 * tilgt dann ohne Fenster. Im ersten Anlauf genau so passiert.
			 */
			await leitung.goto(url, { waitUntil: 'networkidle' });

			const leer = leitung.locator('tbody tr').filter({ hasText: `Karteileiche ${LAUF}` });
			behaupte(await leer.count() === 1, 'Die neue, leere Zeile steht in der Tabelle');

			/*
			 * **Der Knopf steht seit dem 27.08.2026 auf der Seite der Zeile.** Die
			 * Tabelle zeigt nur noch den Bestand; geprüft wird deshalb dort, dass
			 * eine leere Zeile ihn trägt und eine zugeordnete nicht.
			 */
			await zeileOeffnen(`Karteileiche ${LAUF}`);
			behaupte(
				(await leitung.locator('form[action="?/eigentuemerTilgen"]').count()) === 1,
				'Die leere Zeile bietet «Zeile tilgen» an'
			);

			// Und nur sie: Eine Zeile mit Einheit darf den Knopf nicht tragen —
			// der Server wiese ihn ab, und ein Knopf, der in die Absage führt, ist
			// selbst ein Fehler.
			await zeileOeffnen(`Aebi ${LAUF}`);
			behaupte(
				(await leitung.locator('form[action="?/eigentuemerTilgen"]').count()) === 0,
				'Eine zugeordnete Zeile bietet das Tilgen NICHT an'
			);

			await zeileOeffnen(`Karteileiche ${LAUF}`);

			/*
			 * **Hier wird die Wirkung geprüft, nicht das Fenster** — und das ist ein
			 * Befund am Drehbuch, kein Zugeständnis.
			 *
			 * Gemessen am 23.08.2026: In diesem Durchstich öffnet **kein**
			 * `Rueckfrage`-Dialog, auch nicht der seit Wochen bestehende Knopf
			 * «‹Whg 1› tilgen» derselben Seite (bis zum 06.09.2026 «lösen»). Der Klick löst stattdessen das
			 * gewöhnliche Absenden aus. Im Browser geht dasselbe Fenster auf —
			 * gegengelesen an einer Gemeinschaft mit sechzehn Zeilen, Fenster kam,
			 * nach der Bestätigung waren es fünfzehn. Was den Unterschied macht,
			 * ist noch offen; belegt ist nur, dass er nicht an dieser Änderung
			 * hängt. Der Vergleich steht in `docs/pruefung/lauf2/durchgang-A.md`.
			 *
			 * Was hier trotzdem hält: dass der Knopf nur an leeren Zeilen steht
			 * und dass die Zeile danach wirklich weg ist.
			 */
			const antwort = leitung
				.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
				.catch(() => null);
			await leitung.locator('button', { hasText: 'Zeile tilgen' }).first().click();
			const ja = leitung.locator('dialog[open] button.ja');
			if (await ja.count()) await ja.first().click();
			await antwort;
			await leitung.goto(url, { waitUntil: 'domcontentloaded' });
			behaupte(
				(await leitung.locator('tbody tr').filter({ hasText: `Karteileiche ${LAUF}` }).count()) === 0,
				'Die getilgte Zeile ist verschwunden'
			);
			return 'Knopf nur bei leeren Zeilen';
		});

		/*
		 * **Die Reihenfolge der Standardtraktanden** (Block C2, 31.08.2026).
		 *
		 * Auf der Reglementseite zwei Vertauschungen speichern und danach
		 * nachmessen, dass die neue Versammlung ihre Pflichttraktanden in
		 * genau dieser Reihenfolge bekommt. Zurücksetzen am Schluss, damit der
		 * Lauf keinen Bestand hinterlässt, der spätere Läufe verwirrt.
		 */
		await schritt('Traktandenordnung auf der Reglementseite speichern und anwenden', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			// Der Entwicklungsserver übersetzt die geänderte Seite beim ersten
			// Besuch neu — der Kasten braucht einen Moment. Lieber warten als
			// still überspringen.
			await leitung
				.locator('form.ordnung ol.ordnung-liste li')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 });
			const liste = leitung.locator('form.ordnung ol.ordnung-liste li');
			behaupte((await liste.count()) === 8, `${await liste.count()} statt 8 Vorlagen`);
			const ersterVorher = await liste.first().locator('.titel .name').innerText();
			const dritterVorher = await liste.nth(2).locator('.titel .name').innerText();

			// Den dritten Punkt zweimal nach oben: an Position 1.
			await liste.nth(2).locator('button[aria-label$="höher"]').click();
			await liste.nth(1).locator('button[aria-label$="höher"]').click();
			await abschicken(leitung, leitung.locator('form.ordnung button[type="submit"]'));
			const bestätigt = await leitung
				.locator(ERFOLGSMELDUNG)
				.filter({ hasText: /Reihenfolge der Standardtraktanden gespeichert/i })
				.first()
				.waitFor({ state: 'visible', timeout: 10000 })
				.then(() => true)
				.catch(() => false);
			behaupte(bestätigt, 'Keine Bestätigung «Reihenfolge gespeichert»');

			/*
			 * **Und sie steht in der Quittungsecke, nicht im Inhalt** (02.09.2026).
			 *
			 * Der Selektor darüber deckt beide Orte ab, weil er auch ohne
			 * JavaScript stimmen muss — damit prüft er allein aber weniger als
			 * vorher. Diese Zeile holt das Fehlende nach: Die neun Meldungen dieser
			 * Seite waren blanke Absätze und blieben stehen, wo sie entstanden.
			 * Seit sie die Komponente sind, wandern sie nach unten rechts (Vorgabe
			 * Auftraggeber, 21.08.2026) — und dass sie das tun, ist der eigentliche
			 * Nachweis der Umstellung.
			 *
			 * `main` statt `body`: Die Quittung selbst trägt dieselbe Klasse nicht,
			 * aber ihr Text soll nicht zusätzlich im Inhalt stehen.
			 */
			await leitung
				.locator('.einblender .quittung')
				.filter({ hasText: /Reihenfolge der Standardtraktanden gespeichert/i })
				.first()
				.waitFor({ state: 'visible', timeout: 10000 });
			behaupte(
				(await leitung.locator('main .meldung.gut').count()) === 0,
				'Die Erfolgsmeldung steht doppelt — im Inhalt und in der Quittungsecke'
			);

			// Nachmessen nach dem Neuladen: die gespeicherte Ordnung steht da.
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			const ersterNachher = await leitung
				.locator('form.ordnung ol.ordnung-liste li')
				.first()
				.locator('.titel .name')
				.innerText();
			behaupte(
				ersterNachher.trim().startsWith(dritterVorher.trim()),
				`Nach dem Speichern steht zuerst «${ersterNachher}» statt «${dritterVorher}»`
			);

			// Eine neue Versammlung bekommt die Ordnung.
			const morgen2 = hiesigerTag(2);
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/versammlungen/neu`, {
				waitUntil: 'domcontentloaded'
			});
			await fuelle(leitung, 'input[name="datum"]', morgen2);
			await fuelle(leitung, 'input[name="uhrzeit"]', '19:00');
			await fuelle(leitung, 'input[name="ort"]', 'Ordnungssaal');
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const neu = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(neu, `Zweite Versammlung nicht angelegt: ${leitung.url()}`);

			await leitung.goto(`${ZIEL}/versammlungen/${neu[1]}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			// Die Traktandenseite lädt nach (Ereignisstrom); der erste Eintrag
			// braucht einen Moment. Der Ladeindikator (⠿) ist kein Eintrag.
			await leitung
				.locator('ol.baum > li .nummer, ol.baum > li')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 });
			const nummer1 = await leitung.locator('ol.baum > li').first().innerText();
			const alleTitel = (await leitung.locator('ol.baum > li').allInnerTexts())
				.slice(0, 3)
				.join(' · ')
				.slice(0, 240);
			behaupte(
				nummer1.includes(dritterVorher.trim()),
				`Die neue Versammlung beginnt mit «${alleTitel}» statt «${dritterVorher.trim()}»`
			);

			/*
			 * **Zurücksetzen, damit der Lauf keinen Bestand hinterlässt.** Die
			 * Hauptversammlung dieses Laufs wird erst danach angelegt und bekäme
			 * sonst die vertauschte Ordnung; positionsbasierte Folgeschritte
			 * würden daran still scheitern. Die Messung oben ist abgeschlossen.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung
				.locator('form.ordnung-zurueck')
				.waitFor({ state: 'visible', timeout: 30000 });
			await leitung.waitForTimeout(300);
			await leitung.locator('form.ordnung-zurueck button[type="submit"]').first().click();
			// Das aufgehende Rückfragefenster bestätigt der Beobachter
			// (`rueckfragenBestaetigen`); hier zählt die Meldung danach.
			await leitung
				.locator(ERFOLGSMELDUNG)
				.filter({ hasText: /Standardreihenfolge/i })
				.first()
				.waitFor({ state: 'visible', timeout: 10000 });

			return `«${dritterVorher.trim()}» zuerst statt «${ersterVorher.trim()}», danach zurückgesetzt`;
		});

		await schritt('Versammlung anlegen, Betriebsart geführt', async () => {
			// Ein Anlegeformular für beide Fälle (Umbau vom 11.08.2026). Der alte
			// Weg unter der Gemeinschaft leitet hierher und wählt sie vor.
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/versammlungen/neu`, {
				waitUntil: 'domcontentloaded'
			});
			const morgen = hiesigerTag(1);
			await fuelle(leitung, 'input[name="datum"]', morgen);
			await fuelle(leitung, 'input[name="uhrzeit"]', '19:00');
			await fuelle(leitung, 'input[name="ort"]', 'Prüfsaal');
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const angelegt = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(angelegt, `Versammlung nicht angelegt: ${leitung.url()}`);

			// Die Betriebsart steht seit dem 11.08.2026 auf der Versammlungsseite,
			// nicht mehr im Anlegeformular: Anlegen fragt nur, wer wann wo tagt.
			// Geführt, damit die Telefone selbst abstimmen — in der einfachen
			// Betriebsart erfasst die Leitung, und der Test prüfte etwas anderes.
			await leitung.goto(`${ZIEL}/versammlungen/${angelegt[1]}`, { waitUntil: 'domcontentloaded' });
			const gefuehrt = leitung.locator('input[name="betriebsart"][value="gefuehrt"]');
			await gefuehrt.check();
			// **Nachsehen, nicht annehmen.** Vorher stand hier
			// `if (await gefuehrt.count()) await gefuehrt.check()`: Kam die Seite
			// einmal langsamer (der Entwicklungsserver übersetzte gerade neu), war
			// die Zahl null, der Schritt übersprang still — und der Lauf brach
			// dreissig Schritte später mit «Kein Ja-Knopf auf dem Telefon» ab, weil
			// die Versammlung in der einfachen Betriebsart lief. Der Abbruch stand
			// an der falschen Stelle und zeigte auf die falsche Ursache.
			behaupte(await gefuehrt.isChecked(), 'Die Betriebsart «geführt» liess sich nicht wählen');
			await abschicken(leitung, leitung.locator('button[form="angaben"]'));
			const treffer = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(treffer, `Keine Versammlung erreicht: ${leitung.url()}`);
			versammlungId = treffer[1];
			return versammlungId.slice(0, 8);
		});

		/*
		 * **Das Erfordernis unmittelbar wählen** (02.08.2026).
		 *
		 * Der Entscheidbaum bleibt der Weg für den Zweifel; diese Etappe prüft den
		 * kurzen: Fall benennen, fertig. Und zwei Dinge, die dabei schiefgehen
		 * können — dass ein Grenzfall wählbar wäre (er besagt gerade, dass kein
		 * Erfordernis feststeht) und dass ein späteres Speichern das Erfordernis
		 * still überschreibt, obwohl niemand es angefasst hat.
		 */
		await schritt('Erfordernis beim Traktandieren selbst wählen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			await klickeBis(leitung, aufklappen, anlegen);

			const auswahl = anlegen.locator('select[name="erfordernis"]');
			behaupte(await auswahl.count(), 'Keine Auswahlliste für das Mehrheitserfordernis');
			const eintraege = await auswahl.locator('option').count();
			behaupte(eintraege > 10, `Die Auswahlliste führt nur ${eintraege} Einträge`);
			behaupte(await auswahl.locator('optgroup').count(), 'Die Auswahl ist nicht nach Ästen geordnet');
			behaupte(
				!(await auswahl.innerText()).includes('Grenzfall'),
				'Ein Grenzfall steht zur Wahl — er besagt gerade, dass kein Erfordernis feststeht'
			);

			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Hausordnung anpassen');
			await auswahl.selectOption('k-hausordnung');

			/*
			 * **Der Musterwortlaut** (Prüflauf I, B-18): «Für elf Traktanden habe
			 * ich elf Anträge frei formuliert.» Er erscheint erst, wenn die Art
			 * gewählt und das Feld leer ist — deshalb steht die Fallwahl hier vor
			 * dem Ausfüllen, anders als vorher.
			 */
			const vorschlag = anlegen.locator('button', { hasText: 'Diesen Wortlaut übernehmen' });
			await vorschlag.waitFor({ state: 'visible', timeout: 5000 });
			await vorschlag.click();
			const gefuellt = await anlegen.locator('[name="antragswortlaut"]').inputValue();
			behaupte(
				gefuellt.includes('Die Versammlung beschliesst') && gefuellt.includes('Hausordnung'),
				`Der Musterwortlaut kam nicht ins Feld: «${gefuellt}»`
			);
			behaupte(
				!(await vorschlag.isVisible()),
				'Der Vorschlag steht noch da, obwohl im Feld ein Wortlaut steht — er könnte ihn überschreiben'
			);
			await fuelle(leitung,
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				'Die Hausordnung wird um eine Ruhezeit ergänzt.'
			);
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());

			await behaupteText(
				leitung,
				'Hausordnung erlassen oder ändern',
				'Das gewählte Erfordernis hängt nicht am Traktandum'
			);
			return 'Hausordnung erlassen oder ändern, ohne Entscheidbaum';
		});

		await schritt('Antrag traktandieren', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			// Das Formular ist zugeklappt und erst im DOM, wenn es geöffnet wurde —
			// die Traktandenliste ist die häufigere Sicht, nicht das Anlegen.
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			behaupte(await aufklappen.count(), 'Kein Weg zum Anlegen eines Traktandums');
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			await klickeBis(leitung, aufklappen, anlegen);

			/*
			 * B3, 31.08.2026: Die drei Eigentümerfelder zeigen die Eigentumsstufe
			 * am Versammlungstag. Die Einheit steht im sichtbaren Text, die Kennung
			 * bleibt der gesendete Wert. Geprüft werden alle drei Bauformen: Auswahl,
			 * gemeinsame Kästchen und Betroffene im Bearbeitungsformular.
			 */
			const antragstellerart = anlegen.locator('select[name="antragstellerart"]');
			await antragstellerart.selectOption('eigentuemer');
			const einzelwahl = anlegen.locator('select[name="antragstellerPartei"]');
			await einzelwahl.waitFor({ state: 'visible', timeout: 5000 });
			const einzeltext = await einzelwahl.innerText();
			behaupte(
				einzeltext.includes(`Aebi ${LAUF} · Whg 1`) &&
					einzeltext.includes(`Bucher ${LAUF} · Whg 2`) &&
					einzeltext.includes(`Christen ${LAUF} · Whg 3`),
				`Die Einzelauswahl nennt Namen und Einheiten nicht gemeinsam: «${einzeltext.slice(0, 240)}»`
			);

			await antragstellerart.selectOption('mehrere_eigentuemer');
			const gemeinsame = anlegen.locator('input[name="antragstellerParteien"]');
			await gemeinsame.first().waitFor({ state: 'visible', timeout: 5000 });
			const gemeinsamtext = await anlegen.locator('fieldset.eingerueckt').innerText();
			behaupte(
				gemeinsamtext.includes(`Aebi ${LAUF} · Whg 1`) &&
					gemeinsamtext.includes(`Bucher ${LAUF} · Whg 2`) &&
					gemeinsamtext.includes(`Christen ${LAUF} · Whg 3`),
				`Die gemeinsame Auswahl nennt die Einheiten nicht: «${gemeinsamtext.slice(0, 240)}»`
			);
			await antragstellerart.selectOption('bewirtschaftung');

			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Fassadensanierung');
			const art = leitung.locator('form[action="?/anlegen"] select[name="art"]');
			if (await art.count()) await art.selectOption('abstimmung');
			const wortlaut = leitung.locator('form[action="?/anlegen"] [name="antragswortlaut"]');
			if (await wortlaut.count()) await wortlaut.fill('Die Fassade wird saniert.');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			await behaupteText(leitung, 'Fassadensanierung', 'Das Traktandum erscheint nicht in der Liste');

			const zeile = leitung.locator('button.titel', { hasText: 'Fassadensanierung' }).first();
			const aendern = leitung.locator('form[action="?/speichern"]');
			await klickeBis(leitung, zeile, aendern);
			const betroffenentext = await aendern
				.locator('fieldset', { hasText: 'Unmittelbar Betroffene' })
				.innerText();
			behaupte(
				betroffenentext.includes(`Aebi ${LAUF} · Whg 1`) &&
					betroffenentext.includes(`Bucher ${LAUF} · Whg 2`) &&
					betroffenentext.includes(`Christen ${LAUF} · Whg 3`),
				`Die Auswahl der Betroffenen nennt die Einheiten nicht: «${betroffenentext.slice(0, 240)}»`
			);
			return 'Einzelne, gemeinsame und Betroffene mit Einheit beschriftet';
		});

		/**
		 * **Befund des Auftraggebers vom 28.08.2026:** «Jedes mal beim Speichern springt die
		 * Seite Top.»
		 *
		 * Der Schritt misst genau das und nichts sonst: Rollstand vor dem
		 * Speichern, Rollstand danach. Er ist die Defektprobe zu
		 * `use:enhance={absenden(…)}` am Traktandenformular — nimmt man die
		 * Zeile weg, lädt die Seite neu und steht wieder bei 0.
		 *
		 * **Warum nicht am Anlegen gemessen wird**, obwohl das der bequemere Weg
		 * wäre: Dort klappt der Kasten nach Erfolg zu, die Seite wird also
		 * ohnehin kürzer, und ein Rollstand, der sich dabei ändert, sagt nichts
		 * über den Sprung. Das Ändern lässt alles stehen — dort ist jede
		 * Bewegung ein Befund.
		 */
		/**
		 * **Dasselbe auf der längsten Seite** (03.09.2026).
		 *
		 * Der Schritt darunter misst die Traktandenseite. Gemessen am laufenden
		 * System ist die Reglementseite die schlimmere: 6660 px bei 900 px
		 * Fensterhöhe, also **7.4 Bildschirmhöhen**, und ihr Vermerkfeld steht
		 * 5.6 Bilder tief. Wer dort speicherte, landete wieder ganz oben und
		 * musste den Weg zurückrollen — Befund des Auftraggebers vom 28.08.2026 («Die Seite
		 * springt bei jedem Speichern nach oben»), nur an einer Stelle, die
		 * damals niemand angesehen hat.
		 *
		 * **Ohne `reset: false`, und das ist gemessen** (03.09.2026). Der erste
		 * Anlauf setzte es an fünf dieser Formulare, weil ihre Felder den Bestand
		 * zeigen. Nachgemessen im Browser, je Formular einmal mit und einmal
		 * ohne: **kein Unterschied.** Bei `?/einberufungsfrist` stand nach dem
		 * Speichern beide Male der neue Wert im Feld, beim Ordnungsformular
		 * beide Male alle acht verborgenen Kennungen gefüllt.
		 *
		 * Der Grund: `update()` läuft nach `invalidateAll()`. Svelte hat die
		 * Felder da schon neu gezeichnet, `defaultValue` trägt den neuen Wert,
		 * und `reset()` setzt genau darauf zurück. Eine Einstellung, die nichts
		 * tut, aber nach Sorgfalt aussieht, ist schlechter als keine.
		 *
		 * (Die bestehenden `reset: false` im Bestand — `einheiten`, `traktanden`,
		 * `anwesenheit` — sind davon **nicht** berührt: Sie sind hier nicht
		 * gemessen worden und bleiben, wie sie sind.)
		 */
		await schritt('Auch die längste Seite bleibt beim Speichern stehen', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			const vermerk = leitung.locator('form[action="?/vermerken"]');
			await vermerk.waitFor({ state: 'visible', timeout: 15000 });

			// Erst hinrollen, dann messen — sonst stünde die Seite schon bei 0 und
			// die Probe könnte im schlechten Zustand gar nicht rot werden.
			const text = `Prüflauf ${LAUF}: Ziff. 4.2 ist unklar formuliert.`;
			await leitung.fill('form[action="?/vermerken"] textarea[name="vermerk"]', text);

			/*
			 * **Erst füllen, dann messen** (aus dem Code-Review). `fill()` rollt
			 * selbst zum Feld; wer davor misst, vergleicht zwei verschiedene
			 * Zustände und hielte ein Rollen durch `fill()` für den Sprung, den er
			 * sucht.
			 */
			await vermerk.locator('button[type="submit"]').first().scrollIntoViewIfNeeded();
			const vorher = await leitung.evaluate(() => window.scrollY);
			behaupte(vorher > 0, `Die Seite steht schon bei 0 — so misst der Schritt nichts`);

			await abschicken(leitung, vermerk.locator('button[type="submit"]').first());

			const nachher = await leitung.evaluate(() => window.scrollY);

			/*
			 * **Und jetzt DERSELBE Text ein zweites Mal** — das ist der Fall, der
			 * den Fehler zeigt.
			 *
			 * Ein Lauf mit zwei **verschiedenen** Texten wäre auch ohne
			 * `reset: false` grün: Dort ändert sich der Wert, und das Neuzeichnen
			 * schreibt ihn ins Feld. Genau daran ist meine erste Messung
			 * vorbeigelaufen. Bleibt der Text gleich, schreibt Svelte nichts — und
			 * das Feld steht leer da, obwohl gespeichert wurde.
			 */
			await abschicken(leitung, vermerk.locator('button[type="submit"]').first());
			const imFeld = await leitung
				.locator('form[action="?/vermerken"] textarea[name="vermerk"]')
				.inputValue();

			/*
			 * **Aufräumen vor der Zusicherung, nicht danach** (aus dem Code-Review).
			 * Der erste Anlauf räumte am Schluss — wurde eine Zusicherung vorher
			 * rot, blieb der Prüfvermerk in der Gemeinschaft stehen und erschien
			 * dort bei jeder Herleitung.
			 */
			await leitung.fill('form[action="?/vermerken"] textarea[name="vermerk"]', '');
			await abschicken(leitung, vermerk.locator('button[type="submit"]').first());

			behaupte(
				imFeld === text,
				`Das Feld wurde geleert statt den gespeicherten Vermerk zu zeigen: «${imFeld}»`
			);
			behaupte(
				Math.abs(nachher - vorher) < 40,
				`Die Reglementseite ist beim Speichern von ${vorher} px auf ${nachher} px gesprungen`
			);
			return `Rollstand ${vorher} px, nach dem Speichern ${nachher} px, Feld gefüllt`;
		});

		await schritt('Speichern lässt die Seite stehen, wo sie steht', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('button.titel', { hasText: 'Fassadensanierung' }).first();
			await zeile.waitFor({ state: 'visible', timeout: 8000 });
			const aendern = leitung.locator('form[action="?/speichern"]');
			await klickeBis(leitung, zeile, aendern);

			/*
			 * Erst ans Formular rollen, dann messen. Ohne das steht die Seite je
			 * nach Fensterhöhe schon bei 0, und der Vergleich «vorher gleich
			 * nachher» wäre auch beim springenden Stand erfüllt — die Probe
			 * könnte im schlechten Zustand gar nicht rot werden.
			 */
			await aendern.locator('button[type="submit"]').first().scrollIntoViewIfNeeded();
			const vorher = await leitung.evaluate(() => window.scrollY);
			behaupte(
				vorher > 0,
				`Die Seite steht schon bei 0 — so misst der Schritt den Sprung nicht (${vorher} px)`
			);

			await abschicken(leitung, aendern.locator('button[type="submit"]').first());

			const nachher = await leitung.evaluate(() => window.scrollY);
			behaupte(
				Math.abs(nachher - vorher) < 40,
				`Die Seite ist beim Speichern von ${vorher} px auf ${nachher} px gesprungen`
			);
			return `Rollstand ${vorher} px, nach dem Speichern ${nachher} px`;
		});

		/**
		 * **Die Kopfleiste klebt — also muss jeder Sprung an ihr vorbei**
		 * (29.08.2026).
		 *
		 * `header` ist `position: sticky; top: 0` und bricht je nach Fensterbreite
		 * um: 1400 px → 118 px hoch, 1000 px → 167 px, 900 px → **206 px**,
		 * 375 px → 146 px. Ohne Abstand am Wurzelelement landet jedes Sprungziel
		 * darunter: ein Ankerlink, der Tastaturfokus, `element.focus()` nach einem
		 * Absenden. Gemessen auf genau dieser Seite: **27 von 40** Bedienelementen
		 * waren nach `scrollIntoView()` vollständig verdeckt, «44px von 44px».
		 *
		 * Aufgefallen ist es an einem Klick, den Playwright nicht ausführen konnte
		 * («header intercepts pointer events»). Drei Seiten trugen dafür ein
		 * eigenes `scroll-margin-top`, der Rest nicht.
		 *
		 * **Gemessen wird die Wirkung, nicht die Schreibweise**: Ob die Regel als
		 * `scroll-padding-top`, als Abstand am Element oder gar nicht mehr über CSS
		 * gelöst ist, soll dieser Schritt nicht vorschreiben. Er prüft, dass kein
		 * Bedienelement unter der Leiste liegt, wenn man dorthin springt.
		 */
		await schritt('Kein Sprungziel landet unter der Kopfleiste', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.locator('main button').first().waitFor({ state: 'visible', timeout: 8000 });

			const messe = async () =>
				await leitung.evaluate(() => {
				const kopf = document.querySelector('header');
				if (!kopf) return { fehlt: true };
				const raus = { geprueft: 0, verdeckt: [] };
				for (const el of document.querySelectorAll('main button, main a[href], main summary')) {
					const r0 = el.getBoundingClientRect();
					if (r0.width === 0 && r0.height === 0) continue;
					raus.geprueft++;
					el.scrollIntoView();
					const r = el.getBoundingClientRect();
					if (r.top < kopf.getBoundingClientRect().bottom) {
						raus.verdeckt.push((el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40));
					}
				}
					return raus;
				});

			/*
			 * **Über die Breiten messen, nicht nur an der eigenen** (29.08.2026,
			 * aus dem Code-Review). Die erste Fassung dieses Schrittes lief allein
			 * im Fenster des Drehbuchs (1400 px) — und das ist die einzige Breite,
			 * bei der ein festes `scroll-padding-top: 8rem` gereicht hätte. Er wäre
			 * grün geblieben, während dieselbe Messung bei 900 px 13 von 18 Zielen
			 * als vollständig verdeckt meldet.
			 *
			 * Die Höhen, gemessen: 1400 px → 118, 1000 px → 167, 900 px → 206,
			 * 375 px → 146. Die Leiste bricht um, und zwar nicht monoton.
			 */
			const urspruenglich = leitung.viewportSize() ?? { width: 1400, height: 1000 };
			const zusammen = [];
			/*
			 * **Kein `finally`** (29.08.2026, aus dem Code-Review). Es stellte die
			 * ursprüngliche Breite wieder her, **bevor** `schritt()` sein Bild
			 * sichert: Die Meldung sagte «Bei 900 px …» und das Beweisbild zeigte
			 * die eine Breite, bei der nichts verdeckt ist. Scheitert eine
			 * Zusicherung, endet der Durchlauf ohnehin; die Breite bleibt dann
			 * stehen, und das Bild zeigt, worüber die Meldung spricht.
			 */
			{
				for (const breite of [1400, 1000, 900, 375]) {
					await leitung.setViewportSize({ width: breite, height: urspruenglich.height });
					await leitung.waitForTimeout(250);
					const befund = await messe();
					behaupte(
						!befund.fehlt,
						`Bei ${breite} px hat die Seite keine Kopfleiste — der Schritt misst dann nichts`
					);
					/*
					 * **Die Sichtprobe je Breite.** Ohne sie wäre der Schritt grün,
					 * sobald die Seite ihre Bedienelemente verliert oder der Selektor
					 * danebengreift.
					 *
					 * **An dieser Stelle gemessen**, nicht an einer fremden Seite: 42
					 * Ziele bei 1400 und 1000 px, 30 bei 900 und 375 px — unterhalb
					 * von 60rem blendet die Seitenleiste ihre Verweise aus. Die
					 * Schranke bei 15 lässt Luft für ein Drehbuch, das hier weniger
					 * Traktanden angelegt hat, und schlägt trotzdem an, wenn der
					 * Selektor ins Leere greift.
					 */
					behaupte(
						befund.geprueft >= 15,
						`Bei ${breite} px nur ${befund.geprueft} Sprungziele gefunden; erwartet mindestens 15`
					);
					behaupte(
						befund.verdeckt.length === 0,
						`Bei ${breite} px liegen ${befund.verdeckt.length} von ${befund.geprueft} ` +
							`Sprungzielen unter der Kopfleiste: ${befund.verdeckt.slice(0, 3).join(' · ')}`
					);
					zusammen.push(`${breite}px/${befund.geprueft}`);
				}
			}
			await leitung.setViewportSize(urspruenglich);
			return `keines verdeckt bei ${zusammen.join(', ')}`;
		});

		await schritt('Zweiter Antrag — er wird später im Saal zurückgezogen', async () => {
			// Ein Antrag, über den nicht abgestimmt wird: Genau daran zeigt sich
			// später, dass «zurückgezogen» etwas anderes ist als «abgelehnt».
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			await klickeBis(leitung, aufklappen, anlegen);
			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Spielplatz');
			const art = leitung.locator('form[action="?/anlegen"] select[name="art"]');
			if (await art.count()) await art.selectOption('abstimmung');
			const wortlaut = leitung.locator('form[action="?/anlegen"] [name="antragswortlaut"]');
			if (await wortlaut.count()) await wortlaut.fill('Der Spielplatz wird erneuert.');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			await behaupteText(leitung, 'Spielplatz', 'Der zweite Antrag erscheint nicht in der Liste');

			/*
			 * **Er trägt sein Erfordernis, weil der Folgeantrag später an ihm hängt**
			 * (07.09.2026). Bis dahin hing der Folgeantrag am Grundantrag
			 * «Fassadensanierung» — und zwar, nachdem darüber abgestimmt war. Genau
			 * das lässt die Anwendung seither nicht mehr zu: Über den Folgeantrag
			 * wird **vor** dem Grundantrag abgestimmt, und dieses «vorher» gibt es
			 * nach dem Beschluss nicht mehr. Der Weg zurück heisst Rückkommen, und
			 * der Schritt «ohne Beschluss der Versammlung kein zweiter Durchgang»
			 * weiter unten belegt ihn.
			 *
			 * Der zweite Antrag ist der richtige Grundantrag: angekündigt, mit
			 * Erfordernis, und bis zu seinem Rückzug am Ende offen.
			 */
			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: 'Spielplatz' });
			behaupte(await eintrag.count(), 'Der zweite Antrag steht nicht in der Liste');
			spielplatzId = await eintrag.first().getAttribute('data-traktandum');
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${spielplatzId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await direktweg.count()) await direktweg.click();
			const typ = leitung.locator('select[name="typ"]').first();
			await typ.waitFor({ state: 'visible', timeout: 5000 });
			await typ.selectOption('qualifiziertes_mehr');
			const grund = leitung.locator('[name="begruendung"]').first();
			if (await grund.count()) await grund.fill('Prüflauf: Grundantrag für den Folgeantrag.');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
			/*
			 * **Nachgemessen, nicht behauptet** (07.09.2026, aus dem Code-Review).
			 * Ohne diese Zeilen griff `.last()` möglicherweise einen anderen
			 * Absendeknopf der Erfordernisseite, der Schritt bliebe grün und meldete
			 * ein Erfordernis, das er nie gesetzt hat.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const gesetzt = leitung.locator(`li[data-traktandum="${spielplatzId}"]`);
			const zeilentext = (await gesetzt.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				!/kein Mehrheitserfordernis/i.test(zeilentext),
				`Der zweite Antrag trägt kein Erfordernis: ${zeilentext.slice(0, 200)}`
			);
			return `Erfordernis gesetzt: ${zeilentext.slice(0, 60)}`;
		});

		/*
		 * **Die Traktandenprüfung (FR-58).**
		 *
		 * Zwei Zusagen werden hier durchgespielt, und beide sind wichtiger als
		 * die Befunde selbst: **Ohne Zulassung geschieht nichts**, und **ein
		 * Ausfall bricht nichts ab**. Deshalb ist der Schritt gegenüber dem
		 * Anbieter nachsichtig — er verlangt ein Ergebnis oder einen Hinweis,
		 * nie beides zugleich und nie einen Absturz. Ein Browserdurchgang, der
		 * an einem fremden Haus scheitert, wird nach dem zweiten Mal
		 * übersprungen.
		 */
		await schritt('Ohne Zulassung ist die Prüfung sichtbar zu', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.locator('button.titel', { hasText: 'Fassadensanierung' }).first().click();
			await behaupteText(leitung, 'nicht zugelassen', 'Der Grund der Sperre steht nicht da');
			behaupte(
				(await leitung.locator('form[action="?/kipruefen"] button').count()) === 0,
				'Der Prüfknopf steht da, obwohl die KI nicht zugelassen ist'
			);
		});

		await schritt('KI für die Gemeinschaft zulassen', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/angaben`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.check('input[name="aiEnabled"]');
			// Der Protokollentwurf bleibt ausgenommen: Eine Gemeinschaft kann das
			// eine wollen und das andere nicht.
			await leitung.check('input[name="aiDisabledFunctions"][value="protokollentwurf"]');
			// **Nicht `form button` schlechthin:** Das erste Formular der Seite ist
			// das Abmelden in der Kopfzeile — der Durchgang landete damit auf der
			// Anmeldeseite statt bei der gespeicherten Angabe.
			await abschicken(
				leitung,
				leitung.locator('form[action="?/speichern"] button[type="submit"]').first()
			);
			behaupte(
				await leitung.locator('input[name="aiEnabled"]:checked').count(),
				'Die Zulassung wurde nicht gespeichert'
			);
		});

		await schritt('Die Prüfung steht an der Liste, nicht nur im Formular', async () => {
			/*
			 * **Befund des Auftraggebers vom 01.09.2026**: «KI-Knopf fehlt bei Traktanden.
			 * Eigentlich müssten alle Traktanden eine Überprüfung möglich sein.»
			 *
			 * Der Knopf gab es, aber nur im aufgeklappten Bearbeitungsformular
			 * EINES Traktandums — wer die Liste bloss ansah, fand ihn nie. Geprüft
			 * wird deshalb der Zustand, in dem der Auftraggeber war: Seite geladen, nichts
			 * aufgeklappt.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.waitForTimeout(300);
			const band = leitung.locator('.kiband');
			behaupte(
				await band.count(),
				`Kein Band «Traktanden prüfen lassen» an der Liste: ${(await text(leitung)).slice(0, 300)}`
			);
			const alle = band.locator('form[action="?/kipruefenAlle"] button');
			behaupte(await alle.count(), 'Kein Knopf, der alle Traktanden prüfen lässt');
			const beschriftung = (await alle.innerText()).trim();
			behaupte(
				/\d+ Traktanden prüfen|Das Traktandum prüfen/.test(beschriftung),
				`Der Knopf sagt nicht, wie viele geprüft werden: «${beschriftung}»`
			);

			/*
			 * **Und er tut es auch.** Ein Knopf, der dasteht und in eine Absage
			 * läuft, ist schlimmer als keiner. Geprüft wird bis zur Meldung; ob
			 * das Modell antwortet, ist seine Sache (FR-62).
			 */
			/*
			 * **Mehr Zeit als bei einer Einzelprüfung** (Code-Review 01.09.2026):
			 * Der Lauf fragt je Traktandum ein Modell, bei elf Punkten also elfmal
			 * nacheinander. `abschicken` wartet sonst 30 s auf die Antwort; der
			 * Einzelschritt gesteht demselben Anbieter allein 40 s zu.
			 */
			const antwort = leitung
				.waitForResponse((r) => r.request().method() === 'POST', { timeout: 180_000 })
				.catch(() => null);
			await alle.click();
			await antwort;
			await leitung.waitForLoadState('domcontentloaded');
			/*
			 * **Auf die Meldung warten, nicht auf die Uhr.** Ein fester Zuschlag von
			 * einer halben Sekunde reichte einmal von zwei Läufen nicht: `use:enhance`
			 * trägt das Ergebnis erst nach der Antwort in den Baum, und wie lange das
			 * dauert, hängt an der Länge der Liste. Ein Schritt, der mal grün und mal
			 * rot ist, wird abgeschaltet statt gelesen.
			 */
			let meldung = '';
			for (let i = 0; i < 40; i++) {
				meldung = await text(leitung);
				if (/Traktanden geprüft|Traktandum geprüft/.test(meldung)) break;
				await leitung.waitForTimeout(250);
			}
			behaupte(
				/Traktanden geprüft|Traktandum geprüft/.test(meldung),
				`Nach dem Sammellauf keine Meldung über das Ergebnis: ${meldung.slice(-900)}`
			);
			behaupte(
				/Geändert wurde nichts/.test(meldung),
				'Die Meldung sagt nicht, dass nichts verändert wurde'
			);

			/*
			 * **Und die Ergebnisse stehen am Traktandum** (Code-Review 01.09.2026).
			 * Der Schritt prüfte zuerst nur die Zusammenfassungszeile — genau die
			 * Zusicherung, um die es geht («zwei Quellen, eine Anzeige»), blieb
			 * ungedeckt. Sie war es auch: Der Ergebniskasten stand im
			 * aufgeklappten Bearbeitungsformular, und nach dem Sammellauf ist
			 * nichts aufgeklappt.
			 *
			 * Gezählt wird ohne Aufklappen. Ob das Modell antwortet, ist seine
			 * Sache; ein Fehlschlag steht als `.fehlschlag` da und zählt mit.
			 */
			const kaesten = await leitung
				.locator('.kipruefung .ergebnis, .kipruefung .fehlschlag')
				.count();
			behaupte(
				kaesten > 0,
				'Nach dem Sammellauf steht an keinem Traktandum ein Ergebnis — die Befunde sind unsichtbar'
			);
			return `${beschriftung}, ${kaesten} Ergebnisse an den Traktanden`;
		});

		await schritt('Traktandum prüfen lassen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			/*
			 * **Klicken, bis es aufgeht.** Der Aufklapper hängt an Svelte-Zustand
			 * und reagiert erst nach der Hydration; `domcontentloaded` ist davor.
			 * Am 11.08.2026 scheiterte der Schritt an «Kein Knopf zum Prüfen»,
			 * während auf dem Bild das Traktandum schlicht zugeklappt war — die
			 * Fehlersuche begann damit an der KI statt am Zeitpunkt des Klicks.
			 */
			const titel = leitung.locator('button.titel', { hasText: 'Fassadensanierung' }).first();
			const knopf = leitung.locator('form[action="?/kipruefen"] button').first();
			for (let versuch = 0; versuch < 5 && !(await knopf.count()); versuch += 1) {
				await titel.click();
				await leitung.waitForTimeout(400);
			}
			behaupte(await knopf.count(), 'Kein Knopf zum Prüfen');
			await knopf.click();

			// Entweder ein Ergebnis oder ein Hinweis — beides ist richtig, ein
			// Abbruch nicht.
			await leitung
				.locator('.kipruefung .ergebnis, .kipruefung .fehlschlag')
				.first()
				.waitFor({ timeout: 40_000 });

			if (await leitung.locator('.kipruefung .fehlschlag').count()) {
				return 'Anbieter antwortete nicht — Hinweis statt Abbruch';
			}
			// Wenn geantwortet wurde, muss nachsehbar sein, was hinausging.
			behaupte(
				await leitung.locator('.kipruefung details.hinausgegangen pre').count(),
				'Es lässt sich nicht ansehen, was übermittelt wurde'
			);
			const uebermittelt = await leitung.locator('.kipruefung details.hinausgegangen pre').first().innerText();
			behaupte(
				!/Aebi|Bucher|Christen/.test(uebermittelt),
				`Ein Eigentümername stand im übermittelten Text: ${uebermittelt.slice(0, 120)}`
			);
			const stand = await leitung.locator('.kipruefung .ergebnis').first().innerText();

			// Und der Entscheid geht in den Nachweis.
			const entscheid = leitung.locator('form[action="?/kientscheid"] button').first();
			if (await entscheid.count()) await abschicken(leitung, entscheid);
			return stand.replace(/\s+/g, ' ').slice(0, 70);
		});

		await schritt('Der Empfehlung folgen setzt das Erfordernis', async () => {
			/*
			 * **Befund des Auftraggebers vom 03.09.2026**, an einer laufenden Versammlung:
			 * «Das Quorum durch die KI bestimmen lassen funktionierte soweit. Nur
			 * die Übernahme für die laufende Sitzung wurde nicht übernommen.»
			 *
			 * Der Nachweis zeigte drei Entscheide am selben Traktandum und danach
			 * kein Erfordernis: «Ich folge der Empfehlung» schrieb nur, *dass*
			 * gefolgt wurde. Kein Drehbuch deckte diesen Weg ab — deshalb fiel es
			 * erst im Praxisdurchlauf auf.
			 *
			 * **Geprüft wird die Verdrahtung, nicht das Modell.** Ob eine
			 * Empfehlung herauskommt, ist Sache des Anbieters; die Aktion selbst
			 * hängt an `tests/db/kipruefung.test.ts` und läuft ohne ihn.
			 */
			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: 'Spielplatz' });
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(await eintrag.count(), 'Kein Traktandum «Spielplatz» für die Empfehlung');
			const ziel = await eintrag.first().getAttribute('data-traktandum');
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${ziel}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);

			const holen = leitung.locator('form[action="?/kivorschlag"] button').first();
			behaupte(await holen.count(), 'Kein Knopf, der einen Fall vorschlagen lässt');
			const antwort = leitung
				.waitForResponse((r) => r.request().method() === 'POST', { timeout: 90_000 })
				.catch(() => null);
			await holen.click();
			await antwort;
			await leitung.waitForLoadState('domcontentloaded');
			await leitung.waitForTimeout(500);

			/*
			 * **Auf das Ergebnis warten, gleich welcher Art** (06.09.2026). Nach
			 * dem KI-Aufruf zeichnet die Seite über `use:enhance` neu;
			 * `waitForLoadState('domcontentloaded')` wartet dabei auf nichts, und
			 * die festen 500 ms darüber waren der einzige Schutz. In zwei Läufen
			 * hintereinander war der Knopf zum Zeitpunkt der Zählung noch nicht da
			 * — auf dem Fehlerbild stand er dann sichtbar an seinem Platz.
			 *
			 * Gewartet wird auf **beide** Ausgänge zugleich, wie im Schritt
			 * «Traktandum prüfen lassen» weiter oben: Sonst verwandelt eine späte
			 * Absage des Anbieters sich in die Meldung «Kein Knopf», und der
			 * Befund zeigt auf die falsche Stelle.
			 */
			await leitung
				.locator('.kivorschlag .fehlschlag, form[action="?/kifolgen"] button')
				.first()
				.waitFor({ state: 'attached', timeout: 15000 })
				.catch((f) => {
					// Nur die Frist verschlucken: Ein Selektorfehler oder eine
					// geschlossene Seite gehören gemeldet, nicht in die Behauptung
					// darunter umgeleitet.
					if (!/Timeout .* exceeded/.test(String(f))) throw f;
				});

			if (await leitung.locator('.kivorschlag .fehlschlag').count()) {
				return 'Anbieter lieferte keine Einschätzung — Hinweis statt Abbruch';
			}

			/*
			 * **Der Vorschlag überlebt ein Neuladen** (Befund Praxisdurchlauf
			 * 03.10.2026, Punkt 2). Bis zum 04.10.2026 lebte er allein im
			 * Formularergebnis; ein Druck auf F5 warf eine Einschätzung weg, die
			 * ein Modellaufruf gekostet hatte.
			 *
			 * **Erst prüfen, dass der Reload ein GET ist.** Lief die Absendung
			 * nativ statt über `use:enhance`, trägt die Adresse die
			 * Aktionskennung, und ein Neuladen wiederholt den POST samt
			 * Modellaufruf. Dann wäre die Probe auch ohne Merker grün — sie
			 * prüfte die Wiederholung statt das Behalten.
			 */
			behaupte(
				new URL(leitung.url()).search === '',
				`Die Absendung lief nativ statt über use:enhance: ${leitung.url()}`
			);
			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await leitung
				.locator('form[action="?/kifolgen"] button')
				.first()
				.waitFor({ state: 'attached', timeout: 15000 });
			behaupte(
				await leitung.locator('.kivorschlag .vorschlagskarte').count(),
				'Nach dem Neuladen ist der Vorschlag verschwunden'
			);

			/*
			 * **Der Knopf muss tun, was er sagt.** Genau hier lag der Befund: Er
			 * stand da, war anklickbar, und danach war nichts gesetzt.
			 */
			const folgen = leitung.locator('form[action="?/kifolgen"] button').first();
			behaupte(
				await folgen.count(),
				'Kein Knopf «Ich folge der Empfehlung» — der Vorschlag lässt sich nicht übernehmen'
			);
			/*
			 * **Die Frage wird im DOM gelesen, nicht am offenen Fenster**: Der
			 * Beobachter aus `rueckfrage.mjs` bestätigt jedes aufgehende Fenster,
			 * und zwar schneller, als ein `waitFor` es sehen kann (03.09.2026,
			 * erster Lauf rot mit «waiting for dialog[open]»). Das `dialog` steht
			 * ohnehin die ganze Zeit im Baum.
			 */
			const fenster = leitung.locator('dialog.rueckfrage', { hasText: 'Erfordernis auf' });
			behaupte(
				await fenster.count(),
				'Der Knopf fragt nicht nach, oder die Frage nennt den Fall nicht'
			);
			/*
			 * **Auf die Wirkung warten, nicht auf eine feste Zeit** (06.09.2026).
			 * `?/kifolgen` schreibt das Erfordernis; 600 ms sind dafür keine
			 * Zusicherung, und die Navigation gleich darunter bräche eine noch
			 * laufende Anfrage ab.
			 *
			 * **Und nicht über `abschicken`**, obwohl das die übliche Wahl wäre:
			 * Diese Aktion leitet nach Erfolg auf die Traktandenliste um, und
			 * `absageGrund` wertet alles ausser `success` als Absage — auch eine
			 * Umleitung. Der Schritt meldete dann «Der Server wies das Formular
			 * ab (redirect)» über einen geglückten Schreibvorgang. Gewartet wird
			 * deshalb auf die Umleitung selbst, die es nur bei Erfolg gibt.
			 */
			await Promise.all([
				leitung.waitForURL((u) => new URL(u).pathname.endsWith('/traktanden'), {
					timeout: 15000
				}),
				folgen.click()
			]);

			/*
			 * **Gemessen wird am Traktandum, nicht an einer Meldung.** Eine
			 * Erfolgsmeldung hätte auch der alte Zustand geliefert.
			 */
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${ziel}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			/*
			 * **Gemessen wird der Wortlaut, den die Seite wirklich führt** (aus
			 * dem Code-Review): «Bisher gesetzt: …» steht auf der
			 * Erfordernisseite, «kein Mehrheitserfordernis fest» dagegen nur in
			 * der Leitungssicht und in der Auszählung. Die erste Fassung dieser
			 * Zeile prüfte den zweiten Satz und wäre nie rot geworden.
			 */
			const seite = await text(leitung);
			behaupte(
				/Bisher gesetzt:/.test(seite),
				`Nach «Ich folge der Empfehlung» steht am Traktandum kein Erfordernis: ${seite.replace(/\s+/g, ' ').slice(0, 200)}`
			);
			const gesetzt = (seite.match(/Bisher gesetzt:\s*(.+)/) ?? [])[1] ?? '';
			return `Empfehlung übernommen: ${gesetzt.trim().slice(0, 50)}`;
		});

		/*
		 * **Das Mehr des Spielplatzes hängt nicht am Modell** (06.10.2026).
		 * Der Schritt davor übernimmt, was das Modell empfiehlt, und das ist von
		 * Lauf zu Lauf ein anderer Fall. Gemessen am 06.10.2026: Lauf 1 bekam
		 * «Grenzfall zwischen notwendiger und nützlicher Massnahme». Ein
		 * Grenzfall druckt kein Mehr und erhält bei der Freigabe keine
		 * Untergrenze (`untergrenzeBeiFreigabe` in `domain/einladungsmehr.ts`),
		 * und der Schritt «Ein Folgeantrag mit milderem Mehr als die Einladung
		 * steht ohne Mehr da» brach ab. Lauf 2 bekam «Notwendige bauliche
		 * Massnahme» und war grün.
		 *
		 * **Immer zurück auf das qualifizierte Mehr, nicht nur beim Grenzfall.**
		 * Das ist der Stand, den der Spielplatz vor der Empfehlung trug (Schritt
		 * «Zweiter Antrag», gleicher Direktweg) und den er behält, wenn der
		 * Anbieter ausfällt. Auf ihn sind alle späteren Spielplatz-Schritte
		 * gebaut: Der erste Folgeantrag wählt `k-baulich-nuetzlich` (bei einer
		 * empfohlenen Einstimmigkeit wäre das milder und abgewiesen), «Über den
		 * Folgeantrag darf abgestimmt werden» setzt das qualifizierte Mehr, und
		 * der Schritt mit dem milderen Folgeantrag braucht ein Mehr, unter dem
		 * das einfache liegt (beim einfachen meldete er nur «NICHT GEMESSEN»).
		 * Nur den Grenzfall zu korrigieren liesse diese beiden Abhängigkeiten
		 * weiter am Modell hängen, und die Zählbarkeit aus dem Seitentext zu
		 * lesen, hiesse die Domänenregel im Durchstich nachzubauen. Der Schritt
		 * davor prüft weiterhin die Verdrahtung von «Ich folge der Empfehlung»;
		 * was das Modell empfiehlt, hat er nie zugesichert.
		 *
		 * Der Direktweg ohne `ast` nimmt die Grundbasen des Typs
		 * (`setzeErfordernis`), unabhängig vom übernommenen Vorschlag; es bleibt
		 * keine Bezugsgrösse aus der Empfehlung zurück.
		 */
		await schritt('Der Spielplatz trägt vor der Freigabe ein festes, zählbares Mehr', async () => {
			behaupte(spielplatzId, 'Die Kennung des Spielplatzes fehlt, der Schritt «Zweiter Antrag» lief nicht');
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${spielplatzId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			// Nur die Zeile «Bisher gesetzt», nicht die ganze Seite: `text()` fasst die
			// Seite zu einer Zeile, und darunter kann die Vorschlagskarte des Modells
			// mit «Grenzfall …» stehen (Codeprüfung Restpunkte Runde 3, 06.10.2026).
			const bisher = async () =>
				(await leitung.locator('p.bisher').count())
					? (await leitung.locator('p.bisher').first().innerText()).replace(/\s+/g, ' ').trim()
					: '';
			const vorher = (await bisher()).replace(/^Bisher gesetzt:\s*/, '') || '(keines)';
			const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await direktweg.count()) await direktweg.click();
			const typ = leitung.locator('select[name="typ"]').first();
			await typ.waitFor({ state: 'visible', timeout: 5000 });
			await typ.selectOption('qualifiziertes_mehr');
			const grund = leitung.locator('[name="begruendung"]').first();
			if (await grund.count()) {
				await grund.fill('Prüflauf: fester Stand für den Folgeantrag, unabhängig von der Empfehlung.');
			}
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());

			/*
			 * **Nachgemessen am Traktandum, nicht an der Absendung.** Fehlt das
			 * Mehr danach, scheitert der Schritt hier laut, statt dass der
			 * Folgeantrag-Schritt fünfzig Schritte später ohne Untergrenze
			 * dasteht.
			 */
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${spielplatzId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const seite = await text(leitung);
			const zeile = await bisher();
			const nachher = zeile.replace(/^Bisher gesetzt:\s*/, '');
			behaupte(
				nachher,
				`Der Spielplatz trägt nach dem Direktweg kein Erfordernis: ${seite.replace(/\s+/g, ' ').slice(0, 200)}`
			);
			behaupte(
				/von der Sitzungsleitung gesetzt/.test(zeile) && !/Grenzfall/i.test(nachher),
				`Der Spielplatz trägt nicht das von Hand gesetzte Mehr: «${nachher.slice(0, 120)}»`
			);
			// Und es ist das gewählte, nicht irgendein festes Mehr (Codeprüfung
			// Restpunkte Runde 1, G4, 06.10.2026): Der Titel beginnt mit der
			// Bezeichnung des Typs (`mehrheitMitBasis`).
			// Mit den Grundbasen, also ohne Zusatz (Codeprüfung Restpunkte Runde 2,
			// Punkt 3, 06.10.2026): `mehrheitMitBasis` hängt eine abweichende Basis
			// an die Bezeichnung, und die Zeile lautet «Bisher gesetzt: <Titel> nach
			// Fassung …» (Erfordernisseite). Bliebe aus der Empfehlung etwa
			// «Qualifiziertes Mehr aller Eigentümer, auch der abwesenden» stehen,
			// passte das blosse `^Qualifiziertes Mehr\b`.
			behaupte(
				/^Qualifiziertes Mehr nach Fassung /.test(nachher),
				`Der Spielplatz trägt nicht das qualifizierte Mehr: «${nachher.slice(0, 120)}»`
			);
			return `vorher «${vorher.slice(0, 40)}», jetzt «${nachher.slice(0, 40)}»`;
		});

		await schritt('Vorbereitungsablauf nennt das fehlende Erfordernis', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(leitung, 'Mehrheitserfordernisse', 'Schritt «Mehrheitserfordernisse» fehlt');
			await behaupteText(leitung, 'gesperrt', 'Kein gesperrter Schritt vor der Freigabe');
			await behaupteText(
				leitung,
				'Erst nach der Freigabe',
				'Ein gesperrter Schritt nennt seinen Grund nicht'
			);
		});

		await schritt('Mehrheitserfordernis festhalten', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			// Die Kennung steht am Listeneintrag; von dort führt der Weg unmittelbar
			// zur Erfordernis-Seite. Über den Titel zu klicken öffnete die
			// Bearbeitung und prüfte einen anderen Ablauf.
			const eintrag = leitung.locator('li[data-traktandum]').filter({
				hasText: 'Fassadensanierung'
			});
			behaupte(await eintrag.count(), 'Das Traktandum steht nicht in der Liste');
			traktandumId = await eintrag.first().getAttribute('data-traktandum');
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);

			// Der kürzeste belastbare Weg: das Erfordernis unmittelbar setzen. Der
			// Entscheidbaum selbst ist mit Wertetabellen geprüft; hier geht es
			// darum, dass ein gesetztes Erfordernis die Abstimmung freischaltet.
			// Der Direktweg ist zugeklappt — er soll die Ausnahme bleiben.
			const aufklappen = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await aufklappen.count()) await aufklappen.click();
			const auswahl = leitung.locator('select[name="typ"]').first();
			await auswahl.waitFor({ state: 'visible', timeout: 5000 });
			await auswahl.selectOption('qualifiziertes_mehr');
			const begruendung = leitung.locator('[name="begruendung"]').first();
			if (await begruendung.count()) {
				await begruendung.fill('Prüflauf: bauliche Massnahme, qualifiziertes Mehr.');
			}
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
			await behaupteOhne(
				leitung,
				'kein Mehrheitserfordernis fest',
				'Das Erfordernis wurde nicht übernommen'
			);
			return 'qualifiziertes Mehr';
		});

		await schritt('Über den Baum abweichen — mit eigener Bezugsgrösse', async () => {
			/*
			 * **Der Anlassfall** (Prüflauf I, B-16/B-19): «Übersteuern bietet nur
			 * vier Grobstufen ohne Bezugsgrösse — zwei Drittel *der Anwesenden*
			 * statt *aller*, der häufigste Streitpunkt überhaupt.»
			 *
			 * Geprüft wird der Weg **über den Baum**, nicht der Direktweg: Dort
			 * stand die Wahl nie, und `uebersteuere()` nahm sie bis zum 23.08.2026
			 * gar nicht entgegen. Am Ende wird der Stand wieder auf das gesetzt,
			 * was die folgenden Schritte erwarten.
			 */
			const nuetzlich = 'f1-0-nein,f1-1-nein,f1-2-ja';
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis` +
					`?ast=a-bauen&p=${nuetzlich}`,
				{ waitUntil: 'domcontentloaded' }
			);

			const aufklappen = leitung.getByText('Anderes Erfordernis setzen').first();
			behaupte(await aufklappen.count(), 'Am Ende des Baums lässt sich nicht abweichen');
			await aufklappen.click();

			const formular = leitung.locator('form[action="?/setzen"]').last();
			const kopfbasis = formular.locator('select[name="kopfbasis"]');
			await kopfbasis.waitFor({ state: 'visible', timeout: 5000 });
			behaupte(
				await formular.locator('select[name="quotenbasis"]').count(),
				'Die Wertquotenbasis fehlt — «zwei Drittel der Anwesenden statt aller» wäre nicht setzbar'
			);

			await formular.locator('select[name="typ"]').selectOption('qualifiziertes_mehr');
			await kopfbasis.selectOption('alle_eigentuemer');
			await formular
				.locator('[name="begruendung"]')
				.fill('Prüflauf: Bezugsgrösse ausdrücklich auf alle Eigentümer.');
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			/*
			 * Geprüft wird auf der Traktandenliste, nicht auf der Seite nach dem
			 * Absenden: Das Setzen leitet auf die Vorbereitung zurück, und dort
			 * steht das Erfordernis gar nicht.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const text = await leitung.locator('main').innerText();
			behaupte(
				/auch der abwesenden/.test(text),
				`Die gewählte Bezugsgrösse steht nicht am Traktandum: ${text.slice(0, 500)}`
			);

			// Zurück auf den Stand, den die späteren Schritte erwarten.
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await direktweg.count()) await direktweg.click();
			const auswahl = leitung.locator('select[name="typ"]').first();
			await auswahl.waitFor({ state: 'visible', timeout: 5000 });
			await auswahl.selectOption('qualifiziertes_mehr');
			await leitung
				.locator('[name="begruendung"]')
				.first()
				.fill('Prüflauf: zurück auf qualifiziertes Mehr.');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
			return 'Mehrheit aller Eigentümer, auch der abwesenden';
		});

		await schritt('Eine Übersteuerung auf einen anderen Typ steht im Verlauf', async () => {
			/*
			 * **Der Anlass** (Durchstich 30.09.2026). Seit 96eb4b5 trägt allein
			 * `requirement.overridden`, wovon die Leitung abgewichen ist. Die
			 * Route gab das Ereignis nicht weiter, und der Schritt davor sah es
			 * nicht, weil er nie im Verlauf nachsah. Übersteuert wird hier der
			 * Typ selbst, der Fall, in dem nach aussen die Herkunft wegfällt.
			 */
			const nuetzlich = 'f1-0-nein,f1-1-nein,f1-2-ja';
			const merkmal = `Prüflauf: bewusst tiefer ${Date.now()}`;
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis` +
					`?ast=a-bauen&p=${nuetzlich}`,
				{ waitUntil: 'domcontentloaded' }
			);
			await leitung.getByText('Anderes Erfordernis setzen').first().click();
			const formular = leitung.locator('form[action="?/setzen"]').last();
			const typ = formular.locator('select[name="typ"]');
			await typ.waitFor({ state: 'visible', timeout: 5000 });
			await typ.selectOption('einfaches_mehr');
			await formular.locator('[name="begruendung"]').fill(merkmal);
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			await leitung.goto(`${ZIEL}/verlauf?gegenstand=${traktandumId}`, {
				waitUntil: 'domcontentloaded'
			});
			const verlauf = await leitung.locator('main').innerText();
			const zeile = verlauf.split('\n').find((z) => z.includes('Mehrheitserfordernis übersteuert'));
			behaupte(zeile, 'Die Übersteuerung steht nicht im Verlauf des Traktandums');
			behaupte(zeile.includes(merkmal), `Der Verlaufseintrag trägt die Begründung nicht: ${zeile}`);
			behaupte(
				zeile.includes('Rechtsgrundlage des Vorschlags: ZGB'),
				`Der Verlaufseintrag nennt die übergangene Grundlage nicht: ${zeile}`
			);

			// Zurück auf den Stand, den die späteren Schritte erwarten.
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await direktweg.count()) await direktweg.click();
			const auswahl = leitung.locator('select[name="typ"]').first();
			await auswahl.waitFor({ state: 'visible', timeout: 5000 });
			await auswahl.selectOption('qualifiziertes_mehr');
			await leitung
				.locator('[name="begruendung"]')
				.first()
				.fill('Prüflauf: zurück auf qualifiziertes Mehr.');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
			return 'übersteuert, mit Begründung und übergangener Grundlage';
		});

		/*
		 * **Was ein gesperrter Schritt trotzdem sagt** (02.09.2026, aus dem
		 * Code-Review).
		 *
		 * Der spaetere Schritt «Einberufungsfrist hinterlegen» misst den
		 * `verpasst`-Fall an der freigegebenen Versammlung, und der stand nie in
		 * Frage. Hier geht es um den Zustand **Entwurf**, in dem der Schritt
		 * «Einladung erzeugen» gesperrt ist. Drei Leser verschluckten dort, was
		 * der Kern setzt:
		 *
		 * - Die Vorbereitungsseite fuehrte Sperrgrund und Stand in einem
		 *   `{:else if}` — die Fristansage war unsichtbar, genau solange sie noch
		 *   zu halten war.
		 * - Die Seitenleiste zeigte im gesperrten Zweig keine Warnung, obwohl ihr
		 *   eigener Kommentar seit dem 12.08.2026 «Die Warnung steht immer da»
		 *   sagt.
		 *
		 * **Eine eigene Versammlung, weit genug weg** (aus der zweiten Runde des
		 * Code-Reviews). Die Versammlung des Laufs ist morgen, und die kleinste
		 * hinterlegbare Frist ist ein Tag: Damit steht der knappe Fall auf null
		 * Kalendertagen Spielraum, und ein Lauf ueber Mitternacht macht die Probe
		 * ohne Defekt rot. Sechzig Tage geben beiden Faellen Luft — Frist 1 ergibt
		 * `offen`, Frist 90 ergibt `verpasst`, und keine Tagesgrenze aendert
		 * daran etwas.
		 */
		await schritt('Der gesperrte Einladungsschritt nennt Grund, Frist und Warnung', async () => {
			const fristSetzen = async (tage) => {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung
					.locator('input[name="einberufungsfristTage"]')
					.waitFor({ state: 'visible', timeout: 30000 });
				await fuelle(leitung, 'input[name="einberufungsfristTage"]', String(tage));
				await fuelle(
					leitung,
					'input[name="einberufungsfristFundstelle"]',
					tage === '' ? '' : 'Reglement Ziff. 12.3'
				);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/einberufungsfrist"] button[type="submit"]')
				);
				await leitung
					.locator(ERFOLGSMELDUNG)
					.filter({ hasText: /Einberufungsfrist gespeichert/i })
					.first()
					.waitFor({ state: 'visible', timeout: 10000 });
			};

			// Eine eigene Versammlung, die im Entwurf bleibt.
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/versammlungen/neu`, {
				waitUntil: 'domcontentloaded'
			});
			await fuelle(leitung, 'input[name="datum"]', hiesigerTag(60));
			await fuelle(leitung, 'input[name="uhrzeit"]', '19:00');
			await fuelle(leitung, 'input[name="ort"]', `Fristsaal ${LAUF}`);
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const treffer = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(treffer, `Fristversammlung nicht angelegt: ${leitung.url()}`);
			const fristV = treffer[1];

			const einladungsschritt = () =>
				leitung.locator('li.schritt').filter({ hasText: 'Einladung erzeugen' }).first();

			/*
			 * **Der Rat «mindestens zehn Tage» am Haken** (Produktentscheid
			 * 06.10.2026, «Hinweis, zehn Tage zu erfassen»). Er steht nur, wo für
			 * die Gemeinschaft keine Einberufungsfrist erfasst ist
			 * (`einberufungsfristErfasst` in `server/uebersicht.ts`). Dieser
			 * Schritt durchläuft beide Lagen an derselben Versammlung: erst mit
			 * Frist, am Ende ohne. Gelesen wird nur das Wortstück im Label des
			 * Hakens, nicht der ganze Satz, weil die Beschriftung sich ändern darf.
			 *
			 * **Erst der Anker, dann das Fehlen.** «steht nicht da» wäre auch
			 * grün, wenn das Label gar nicht geladen ist; deshalb muss zuerst
			 * «Fristwarnung» im selben Label stehen.
			 */
			const ratZurFrist = async () => {
				const label = leitung.locator('form[action="?/versandVermerken"] label').first();
				await label.waitFor({ state: 'attached', timeout: 15000 });
				const gelesen = (await label.innerText()).replace(/\s+/g, ' ');
				behaupte(
					gelesen.includes('Fristwarnung'),
					`Der Hilfetext am Haken ist nicht geladen, die Probe misst dann nichts: «${gelesen.slice(0, 160)}»`
				);
				return { steht: gelesen.includes('mindestens zehn Tage'), gelesen };
			};

			// ── 1. Die Frist laeuft noch: Grund und Stand stehen nebeneinander ──
			await fristSetzen(1);
			await leitung.goto(`${ZIEL}/versammlungen/${fristV}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			await einladungsschritt().waitFor({ state: 'visible', timeout: 15000 });
			behaupte(
				(await einladungsschritt().getAttribute('class')).includes('gesperrt'),
				'Der Einladungsschritt ist nicht gesperrt — die Probe misst dann nichts'
			);
			behaupte(
				(await einladungsschritt().locator('.sperrgrund').count()) === 1,
				'Der gesperrte Schritt nennt seinen Grund nicht'
			);
			const stand = (
				await einladungsschritt()
					.locator('.schrittstand')
					.innerText()
					.catch(() => '')
			).replace(/\s+/g, ' ');
			behaupte(
				/Einladung soll bis zum .* bei allen sein/.test(stand),
				`Die Fristansage fehlt am gesperrten Schritt: «${stand.slice(0, 120)}»`
			);
			const mitFrist = await ratZurFrist();
			behaupte(
				!mitFrist.steht,
				`Der Rat «mindestens zehn Tage» steht am Haken, obwohl eine Frist erfasst ist: «${mitFrist.gelesen.slice(0, 300)}»`
			);

			// ── 2. Die Frist ist abgelaufen: die Leiste sagt es am blassen Punkt ──
			await fristSetzen(90);
			await leitung.goto(`${ZIEL}/versammlungen/${fristV}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			const warnung = (
				await einladungsschritt()
					.locator('.schrittwarnung')
					.innerText()
					.catch(() => '')
			).replace(/\s+/g, ' ');
			behaupte(
				/bei allen sein sollte, war der/.test(warnung),
				`Die Verpasst-Warnung fehlt am gesperrten Schritt: «${warnung.slice(0, 120)}»`
			);
			// Die volle Fassung, der Satz für Selbstversender gleich nach dem ersten
			// (Produktentscheid 06.10.2026, «Kurz in der Leiste, ganz auf der Seite»).
			behaupte(
				/sieht keine erzeugte Einladung\. Haben Sie die Einladung ausserhalb der Anwendung verschickt, setzen Sie unten auf dieser Seite den Haken/.test(
					warnung
				) && /nichtig/.test(warnung),
				`Die Seite zeigt nicht die volle Verpasst-Warnung: «${warnung.slice(0, 240)}»`
			);

			const leistenpunkt = leitung
				.locator('nav li.gesperrt')
				.filter({ hasText: 'Einladung erzeugen' })
				.first();
			behaupte(await leistenpunkt.count(), 'Die Leiste fuehrt den gesperrten Punkt nicht');
			const leistentext = (await leistenpunkt.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/bei allen sein sollte, war der/.test(leistentext),
				`Die Leiste verschweigt die abgelaufene Frist: «${leistentext.slice(0, 120)}»`
			);
			// Die Kurzfassung, nicht die volle (Produktentscheid 06.10.2026).
			behaupte(
				/Was jetzt zu tun ist, steht auf der Seite Vorbereitung/.test(leistentext) &&
					!/nichtig|ausserhalb der Anwendung/.test(leistentext),
				`Die Leiste zeigt nicht die Kurzfassung der Verpasst-Warnung: «${leistentext.slice(0, 240)}»`
			);
			behaupte(
				(await leistenpunkt.getAttribute('class')).includes('unvollstaendig'),
				'Der gesperrte Punkt traegt die Warnmarke nicht'
			);

			/*
			 * **Und wieder heraus.** Liesse dieser Schritt die Frist stehen, maesse
			 * der spaetere «Einberufungsfrist hinterlegen» keine Zustandsaenderung
			 * mehr: Seine Zusicherungen — gespeicherte 30 im Feld, Verpasst-Warnung
			 * am Schritt — gaelten schon beim Eintritt. Ein leeres Zahlenfeld
			 * heisst «nicht hinterlegt», und die Fundstelle raeumt der Kern mit weg.
			 */
			await fristSetzen('');
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				(await leitung.locator('input[name="einberufungsfristTage"]').inputValue()) === '',
				'Die Frist steht noch im Feld — der spaetere Fristschritt misst dann nichts mehr'
			);

			// ── 3. Ohne erfasste Frist: Jetzt steht der Rat am Haken ──
			await leitung.goto(`${ZIEL}/versammlungen/${fristV}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			const ohneFrist = await ratZurFrist();
			behaupte(
				ohneFrist.steht,
				`Ohne erfasste Frist fehlt der Rat «mindestens zehn Tage» am Haken: «${ohneFrist.gelesen.slice(0, 300)}»`
			);
			return 'Stand bei laufender Frist, Warnung in Seite und Leiste bei abgelaufener, Rat zur Frist nur ohne';
		});

		/*
		 * **Zwei Anträge, deren Erfordernis die Zustimmung Betroffener verlangt**
		 * (Block A2, 25.09.2026). Bewusst **ohne** Betroffene angelegt: Genau das
		 * ist die Lage, für die der Schreibweg im Saal gebaut ist. Am Ende der
		 * Vorbereitung, damit die Nummern der Traktanden davor stehen bleiben.
		 */
		await schritt('Anträge nach Art. 712g Abs. 4 und 712e Abs. 2, noch ohne Betroffene', async () => {
			for (const [titel, wortlaut] of [
				['Gartensitzplatz', 'Der Gartensitzplatz wird Whg 2 zur ausschliesslichen Nutzung zugewiesen.'],
				['Veloraum', 'Der Veloraum wird Whg 2 zur ausschliesslichen Nutzung zugewiesen.'],
				/*
				 * Zwei weitere für das Veto im Ausstand (Auftrag vom
				 * 26.09.2026): der eine trägt über das Veto, der andere wird
				 * durch ein Veto abgelehnt. Sie gehören hierher, weil ein
				 * Traktandum nur vor der Freigabe entsteht.
				 */
				['Veloabstellplatz', 'Der Veloabstellplatz wird Whg 3 zur ausschliesslichen Nutzung zugewiesen.'],
				['Werkraum', 'Der Werkraum wird Whg 3 zur ausschliesslichen Nutzung zugewiesen.'],
				/*
				 * Die Handzählung bei den Wertquoten (Block A3c, 26.09.2026):
				 * einfaches Mehr, die Zustimmung der Betroffenen kommt nachher
				 * (ZGB Art. 712e Abs. 2).
				 */
				['Wertquoten Whg 2', 'Die Wertquote von Whg 2 wird um 10/1000 erhöht.']
			]) {
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
					waitUntil: 'domcontentloaded'
				});
				const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
				const anlegen = leitung.locator('form[action="?/anlegen"]');
				await klickeBis(leitung, aufklappen, anlegen);
				await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', titel);
				await anlegen
					.locator('select[name="erfordernis"]')
					.selectOption(titel === 'Wertquoten Whg 2' ? 'k-wertquoten-aendern' : 'k-nutzungsrecht-zuteilung');
				await fuelle(leitung, 'form[action="?/anlegen"] [name="antragswortlaut"]', wortlaut);
				await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
				const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: titel });
				await eintrag.first().waitFor({ state: 'visible', timeout: 8000 });
				const id = await eintrag.first().getAttribute('data-traktandum');
				behaupte(id, `${titel} steht nicht in der Liste`);
				if (titel === 'Gartensitzplatz') gartenId = id;
				else if (titel !== 'Wertquoten Whg 2') veloraumId = id;
			}
			return 'vier Nutzungsrechte, eine Änderung der Wertquoten';
		});

		await schritt('Freigeben friert den Stimmberechtigtenstand ein', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/freigabe`, {
				waitUntil: 'domcontentloaded'
			});
			const knopf = leitung.locator('main button[type="submit"]').first();
			behaupte(await knopf.count(), 'Kein Freigabeknopf');
			/*
			 * **Der Satz zur Zuständigkeit steht vor dem Knopf** (Produktentscheid
			 * 24.09.2026). Geprüft wird der Anlassfall, nicht die Regel: Er ist der
			 * Teil, für den der Satz da ist, und er fiele bei einer Kürzung zuerst.
			 */
			await behaupteText(
				leitung,
				'vor Beginn oder nach Ende ihres Mandats',
				'Der Satz zur Einberufungszuständigkeit fehlt auf der Freigabeseite'
			);
			await abschicken(leitung, knopf);
			await behaupteOhne(leitung, 'Hindernis', 'Freigabe blockiert');
		});

		/*
		 * **Die Schranke ueber die eigene Aenderung** (Auftraggeber, 28.08.2026:
		 * «Option Merkmal einstimmig vereinbart einbauen»; Migration 101).
		 *
		 * Den Fall kennt das Regelwerk seit je — die Frage stand aber bei jedem
		 * Traktandum neu, unter fuenf anderen Antworten. Geprueft wird, dass die
		 * einmal hinterlegte Angabe dort als Hinweis ankommt.
		 */
		await schritt('Schranke fuer Reglementsaenderungen wirkt am Entscheidbaum', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			/*
			 * **Die Absage ohne Fundstelle steht im Datenbanktest**
			 * (`tests/db/reglementsschranke.test.ts`), nicht hier. Der Server weist
			 * sie mit 400 ab — richtig so —, und der Beobachter zaehlt jede 400 in
			 * der Browserkonsole als Befund. Diese Tolerierung fuer einen
			 * absichtlichen Fehlversuch zu lockern hiesse, sie fuer alle anderen
			 * Seiten mit zu lockern. Derselbe Fall wie bei der Erinnerungsadresse.
			 */
			const haken = leitung.locator('input[name="einstimmig"]');
			await haken.waitFor({ state: 'visible', timeout: 30000 });
			await haken.check();
			await fuelle(
				leitung,
				'input[name="aenderungsschrankeFundstelle"]',
				'Art. 34 Abs. 2 Reglement'
			);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/aenderungsschranke"] button[type="submit"]')
			);
			/*
			 * **Auf die Fundstelle pruefen, nicht auf «Einstimmigkeit»** (01.09.2026,
			 * aus dem Code-Review): Das Wort steht auf dieser Seite ohnehin, in der
			 * Beschriftung des Kaestchens. Die Behauptung war damit unabhaengig vom
			 * Speichererfolg wahr. Die Fundstelle erscheint nur, wenn wirklich
			 * gespeichert wurde.
			 */
			behaupte(
				(await leitung.locator('input[name="einstimmig"]').isChecked()),
				'Der Haken steht nach dem Neuladen nicht'
			);
			await behaupteText(
				leitung,
				'Art. 34 Abs. 2 Reglement',
				'Die gespeicherte Fundstelle steht nicht auf der Reglementseite'
			);

			// Und sie erscheint dort, wo die Frage gestellt wird.
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			/*
			 * **Gezielt in den Reglementsast**, nicht den ersten anklicken: Die
			 * Frage mit der Antwort «Das Reglement verlangt fuer seine eigene
			 * Aenderung Einstimmigkeit» ist der Einstieg von `a-reglement`. Der
			 * erste Anlauf dieses Schrittes nahm `aeste.first()` und kam nie
			 * dorthin — ein Fehler im Aufbau, nicht im Code.
			 */
			const reglementsast = leitung.locator('a[href*="ast=a-reglement"]').first();
			behaupte(await reglementsast.count(), 'Kein Weg in den Ast «Reglement oder Hausordnung»');
			/*
			 * **Auf die Adresse warten, nicht auf 800 ms** (07.09.2026). Nach einem
			 * Neustart des Entwicklungsservers übersetzt Vite die Route beim ersten
			 * Aufruf neu; die feste Wartezeit lief dann ab, während die Seite noch
			 * die Einstiegsfrage zeigte. Der Schritt meldete «Der hinterlegte
			 * Hinweis fehlt an der Frage» und mass in Wahrheit die Übersetzung.
			 * Im Betrieb gibt es diesen Zustand nicht.
			 */
			await reglementsast.click();
			await leitung.waitForURL(/ast=a-reglement/, { timeout: 30000 });
			await leitung.waitForLoadState('domcontentloaded');

			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Diese Gemeinschaft hat hinterlegt/.test(text),
				`Der hinterlegte Hinweis fehlt an der Frage: ${text.slice(0, 300)}`
			);
			behaupte(
				/Art\. 34 Abs\. 2 Reglement/.test(text),
				'Der Hinweis nennt die Fundstelle nicht'
			);
			return 'hinterlegt, und am Baum als Hinweis sichtbar';
		});

		/*
		 * **Die Bestimmung zur Einlage in den Erneuerungsfonds** (Migration 193,
		 * Fassung 2026-11-18). Dieselbe Kette wie bei der Schranke: auf der
		 * Reglementseite hinterlegt, an der Frage zur Höhe der Einlage gezeigt,
		 * mit den passenden Antworten hervorgehoben. Danach wieder herausgenommen,
		 * damit die übrigen Schritte die Gemeinschaft ohne Eintrag sehen.
		 */
		await schritt('Bestimmung zum Erneuerungsfonds wirkt am Entscheidbaum', async () => {
			const reglementseite = async () => {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung
					.locator('input[name="fondsgrenzeWortlaut"]')
					.waitFor({ state: 'visible', timeout: 30000 });
			};
			await reglementseite();
			await leitung.locator('input[name="fondsgrenzeArt"][value="fest"]').check();
			await fuelle(
				leitung,
				'input[name="fondsgrenzeWortlaut"]',
				'Die Einlage darf 0.25 Prozent des Versicherungswerts nicht übersteigen.'
			);
			await fuelle(leitung, 'input[name="fondsgrenzeFundstelle"]', 'Reglement Ziff. 9.2 (Prüflauf)');
			await abschicken(leitung, leitung.locator('form[action="?/fondsgrenze"] button[type="submit"]'));
			await behaupteText(
				leitung,
				'Reglement Ziff. 9.2 (Prüflauf)',
				'Die gespeicherte Bestimmung steht nicht auf der Reglementseite'
			);

			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const geldast = leitung.locator('a[href*="ast=a-geld"]').first();
			behaupte(await geldast.count(), 'Kein Weg in den Ast «Geld und Jahresgeschäfte»');
			await geldast.click();
			await leitung.waitForURL(/ast=a-geld/, { timeout: 30000 });
			const einlage = leitung.locator('a', { hasText: 'Einlage in den Erneuerungsfonds festsetzen oder ändern' }).first();
			await einlage.waitFor({ state: 'visible', timeout: 30000 });
			await einlage.click();
			await leitung
				.getByText('Was sagt Ihr Reglement zur Höhe der Einlage?')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 });

			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Ihre Gemeinschaft hat aus dem Reglement hinterlegt/.test(text) && /Reglement Ziff\. 9\.2 \(Prüflauf\)/.test(text),
				`Die hinterlegte Bestimmung fehlt an der Frage: ${text.slice(0, 300)}`
			);
			const passend = await leitung.getByText('Passt zur Art der Bestimmung, die Ihre Gemeinschaft hinterlegt hat.').count();
			behaupte(passend === 2, `Bei fester Grenze passen zwei Antworten, markiert sind ${passend}`);

			// Wieder herausnehmen.
			await reglementseite();
			await leitung.locator('input[name="fondsgrenzeArt"][value=""]').check();
			await abschicken(leitung, leitung.locator('form[action="?/fondsgrenze"] button[type="submit"]'));
			await behaupteText(leitung, 'Nicht hinterlegt. Nennt Ihr Reglement', 'Die Bestimmung liess sich nicht herausnehmen');
			return 'hinterlegt, an der Frage sichtbar, zwei Antworten markiert, wieder herausgenommen';
		});

		/*
		 * **Die Einberufungsfrist** (Praxisdurchlauf 28.08.2026, Migration 098).
		 *
		 * Zwei Enden derselben Kette an einem Schritt: Die Frist wird auf der
		 * Reglementseite hinterlegt, und der Vorbereitungsschritt «Einladung
		 * erzeugen» muss danach den Termin nennen. Die Versammlung dieses Laufs
		 * ist morgen — bei dreissig Tagen Frist ist der Versandtag also lange
		 * vorbei, und die Warnung ist der deterministische Fall.
		 */
		await schritt('Einberufungsfrist hinterlegen, Vorbereitung warnt', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			const feld = leitung.locator('input[name="einberufungsfristTage"]');
			await feld.waitFor({ state: 'visible', timeout: 30000 });
			await fuelle(leitung, 'input[name="einberufungsfristTage"]', '30');
			await fuelle(leitung, 'input[name="einberufungsfristFundstelle"]', 'Reglement Ziff. 12.3');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/einberufungsfrist"] button[type="submit"]')
			);
			await leitung
				.locator(ERFOLGSMELDUNG)
				.filter({ hasText: /Einberufungsfrist gespeichert/i })
				.first()
				.waitFor({ state: 'visible', timeout: 10000 });

			// Sie steht nach dem Neuladen da — samt gerechnetem Beispieltag.
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				(await leitung.locator('input[name="einberufungsfristTage"]').inputValue()) === '30',
				'Die gespeicherte Frist steht nicht im Feld'
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			const einladung = leitung.locator('li.schritt').filter({ hasText: 'Einladung erzeugen' });
			behaupte(await einladung.count(), 'Der Schritt «Einladung erzeugen» fehlt');
			const text = await einladung.first().innerText();
			behaupte(
				/bei allen sein sollte, war der/i.test(text),
				`Der Schritt nennt die abgelaufene Frist nicht: ${text.replace(/\s+/g, ' ').slice(0, 160)}`
			);
			return 'Frist 30 Tage hinterlegt, Schritt warnt';
		});

		/**
		 * Setzt am Fassaden-Traktandum über den Direktweg ein einfaches Mehr und
		 * gibt die Seite zurück; die Schritte zum Mehr der Einladung prüfen die
		 * Absage darauf (Migration 144, `einladungsmehr.ts`).
		 */
		async function versucheEinfachesMehr() {
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const aufklappen = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await aufklappen.count()) await aufklappen.click();
			const auswahl = leitung.locator('select[name="typ"]').first();
			await auswahl.waitFor({ state: 'visible', timeout: 5000 });
			await auswahl.selectOption('einfaches_mehr');
			const begruendung = leitung.locator('[name="begruendung"]').first();
			if (await begruendung.count()) {
				await begruendung.fill('Prüflauf: milder als die Einladung.');
			}
			// Die Absage ist hier das Erwartete.
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last(), {
				absageErlaubt: true
			});
		}

		/**
		 * Die Zeile des Fassaden-Traktandums in der Liste, samt dem Mehr.
		 * Verglichen wird vorher gegen nachher: Eine Suche nach dem Wort des
		 * milderen Mehrs griffe leer, wenn die Liste es anders schreibt.
		 */
		async function fassadenzeile() {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = (
				await leitung
					.locator('li[data-traktandum]')
					.filter({ hasText: 'Fassadensanierung' })
					.first()
					.innerText()
			).replace(/\s+/g, ' ');
			// Je nach Zustand steht «Nötig: …» oder nur der Titel des Mehrs da;
			// gemessen am 06.10.2026 im Zustand «freigegeben»: «Qualifiziertes Mehr».
			behaupte(/Mehr/.test(zeile), `Die Zeile nennt kein Mehr: ${zeile.slice(0, 200)}`);
			return zeile;
		}

		await schritt('Vor Beginn: milderes Mehr nach abgelaufener Versandfrist abgewiesen', async () => {
			/*
			 * **Produktentscheid 06.10.2026** («Erlauben, Neuversand verlangen»).
			 * Vor Beginn darf das Mehr milder werden, wenn die berichtigte
			 * Einladung noch rechtzeitig hinaus kann. Die Frist ist im Schritt
			 * davor hinterlegt und schon abgelaufen, also sagt Votum ab.
			 *
			 * **Seit dem Produktentscheid 07.10.2026 an der Einstellung der
			 * Gemeinschaft**, Vorgabe «nicht zulassen» (Migration 148). Die Absage
			 * verlangt keinen Empfang mehr; bis 07.10.2026 prüfte der Schritt
			 * «spätestens am letzten Tag der erfassten Einberufungsfrist bei allen
			 * ist». Gemessen werden beide Aussagen der neuen Fassung
			 * (`versandfristVorbei` in `einladungsmehr.ts`).
			 */
			const vorher = await fassadenzeile();
			gewollteAbsage = true;
			try {
				await versucheEinfachesMehr();
				const gesehen = await behaupteText(
					leitung,
					'Der letzte Tag der erfassten Einberufungsfrist war der',
					'Vor Beginn wurde ein milderes Mehr nach abgelaufener Frist nicht abgewiesen'
				);
				behaupte(
					enthalten(gesehen, 'nicht mehr rechtzeitig ankommen') &&
						// Nur in der Absage, nicht im übrigen Seitentext (Codeprüfung Block B, M1).
						enthalten(gesehen, 'Dort lässt sich das ändern'),
					`Die Absage nennt Folge oder Einstellung nicht: ${gesehen.slice(0, 300)}`
				);
			} finally {
				gewollteAbsage = false;
			}
			const nachher = await fassadenzeile();
			behaupte(nachher === vorher, `Das Mehr am Traktandum hat sich trotz Absage geändert: ${nachher.slice(0, 200)}`);
			return 'Absage versandfrist_vorbei';
		});

		/**
		 * Stellt die Einstellung «Mehr nach Ablauf der Einberufungsfrist milder
		 * stellen» der Gemeinschaft (Migration 148) und wartet auf die Bestätigung.
		 */
		async function milderungNachFrist(wert) {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/reglement`, {
				waitUntil: 'domcontentloaded'
			});
			const wahl = leitung.locator(`input[name="milderungNachFrist"][value="${wert}"]`);
			await wahl.waitFor({ state: 'visible', timeout: 15000 });
			await wahl.check();
			await abschicken(
				leitung,
				leitung.locator('form[action="?/milderungNachFrist"] button[type="submit"]')
			);
			await leitung
				.locator(ERFOLGSMELDUNG)
				.filter({ hasText: /Einstellung zum milderen Mehr/ })
				.first()
				.waitFor({ state: 'visible', timeout: 10000 });
		}

		await schritt('Vor Beginn: mit «zulassen» geht das mildere Mehr, die Vorbereitung macht aufmerksam', async () => {
			/*
			 * **Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»**: Lässt
			 * die Gemeinschaft ein milderes Mehr nach Fristablauf zu, nimmt Votum
			 * es an und weist auf der Seite Vorbereitung darauf hin, dass die
			 * berichtigte Einladung nicht mehr rechtzeitig ankommen kann. Danach
			 * der Rückweg auf das Mehr der Einladung und die Vorgabe zurück:
			 * Die späteren Schritte (Absage im Saal, Auszählung der Fassade)
			 * rechnen mit der Untergrenze der Freigabe.
			 *
			 * Nicht hier gemessen, dass das mildere Mehr beim Eröffnen bleibt: Die
			 * Fassade und der Spielplatz tragen die späteren Schritte mit ihrer
			 * Untergrenze. Das misst `tests/db/einladungsmehr.test.ts` (Block A).
			 */
			const vorher = await fassadenzeile();
			await milderungNachFrist('zulassen');
			try {
				await versucheEinfachesMehr();
				await behaupteOhne(
					leitung,
					'Der letzte Tag der erfassten Einberufungsfrist war der',
					'Mit «zulassen» wurde das mildere Mehr trotzdem abgewiesen'
				);
				const gemildert = await fassadenzeile();
				behaupte(gemildert !== vorher, `Das mildere Mehr wurde nicht gesetzt: ${gemildert.slice(0, 200)}`);

				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
					waitUntil: 'domcontentloaded'
				});
				const hinweis = leitung.locator('p.neuversand');
				await hinweis.waitFor({ state: 'visible', timeout: 15000 });
				const gelesen = (await hinweis.innerText()).replace(/\s+/g, ' ');
				behaupte(
					/Fassadensanierung/.test(gelesen) &&
						// Bedingt und mit dem sicheren Weg (Laien- und Fachprüfung Runde 1, 07.10.2026).
						/Ist die berichtigte Einladung noch nicht verschickt, kommt sie nach dieser Frist nicht mehr rechtzeitig an/.test(gelesen) &&
						/Der sichere Weg: Verschieben Sie das Traktandum/.test(gelesen) &&
						/sorgt, wer einlädt/.test(gelesen) &&
						/auch ohne Haken/.test(gelesen),
					`Der Hinweis nach der Milderung sagt nicht, was gilt: «${gelesen.slice(0, 400)}»`
				);
				behaupte(
					!/angekommen ist|beim Eröffnen/.test(gelesen),
					`Der Hinweis verlangt den Empfang oder nennt einen Rückfall: «${gelesen.slice(0, 400)}»`
				);
				const haken = (
					await leitung.locator('form[action="?/versandVermerken"] label strong').first().innerText()
				).trim();
				behaupte(haken === 'Die Einladung ist verschickt', `Der Haken heisst «${haken}»`);

				// Rückweg: wieder das Mehr der Einladung. Der Hinweis entfällt.
				await leitung.goto(
					`${ZIEL}/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`,
					{ waitUntil: 'domcontentloaded' }
				);
				const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
				if (await direktweg.count()) await direktweg.click();
				const auswahl = leitung.locator('select[name="typ"]').first();
				await auswahl.waitFor({ state: 'visible', timeout: 5000 });
				await auswahl.selectOption('qualifiziertes_mehr');
				const begruendung = leitung.locator('[name="begruendung"]').first();
				if (await begruendung.count()) {
					await begruendung.fill('Prüflauf: zurück auf das Mehr der Einladung.');
				}
				await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
				const zurueck = await fassadenzeile();
				behaupte(zurueck === vorher, `Der Rückweg traf nicht das Mehr der Einladung: ${zurueck.slice(0, 200)}`);
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung
					.locator('form[action="?/versandVermerken"]')
					.waitFor({ state: 'attached', timeout: 15000 });
				behaupte(
					(await leitung.locator('p.neuversand').count()) === 0,
					'Nach dem Rückweg steht der Hinweis zur berichtigten Einladung noch'
				);
			} finally {
				await milderungNachFrist('nicht');
			}
			return 'zugelassen, Hinweis gelesen, zurückgestellt, Vorgabe wieder «nicht zulassen»';
		});


		await schritt('Die Einladung ist ein Brief, nicht die Traktandenliste', async () => {
			/*
			 * **Prüflauf I, B-14**: «Die Einladung ist heute identisch mit der
			 * Traktandenliste — kein Absender, keine Anrede, kein
			 * Einberufungssatz, kein Vollmachtshinweis.»
			 *
			 * Geprüft wird zweierlei: dass es das Dokument gibt, und dass der
			 * Vorbereitungsschritt danach als erledigt gilt. Das zweite ist der
			 * eigentliche Punkt — der Schritt hing an einem Ereignis, das keine
			 * Stelle schrieb, und konnte deshalb nie erledigt werden.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			const vorher = leitung.locator('li.schritt').filter({ hasText: 'Einladung erzeugen' });
			behaupte(await vorher.count(), 'Der Schritt «Einladung erzeugen» fehlt');
			behaupte(
				!(await vorher.first().getAttribute('class')).includes('erledigt'),
				'Der Schritt gilt schon vor dem Abruf als erledigt'
			);

			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/einladung.pdf`
			);
			behaupte(antwort.ok(), `Die Einladung antwortete mit ${antwort.status()}`);
			const bytes = (await antwort.body()).length;
			behaupte(bytes > 1000, `Die Einladung ist mit ${bytes} Byte zu klein`);
			const name = antwort.headers()['content-disposition'] ?? '';
			behaupte(
				/Einladung-/.test(name),
				`Sie heisst im Postfach nicht «Einladung»: ${name}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vorbereitung`, {
				waitUntil: 'domcontentloaded'
			});
			const nachher = leitung.locator('li.schritt').filter({ hasText: 'Einladung erzeugen' });
			behaupte(
				(await nachher.first().getAttribute('class')).includes('erledigt'),
				'Der Schritt bleibt offen, obwohl die Einladung geholt wurde'
			);
			return `${Math.round(bytes / 1024)} kB, Schritt erledigt`;
		});

		await schritt('Der Papierstimmzettel hat je Traktandum einen Zettel, das Zählblatt vorne', async () => {
			/*
			 * **Produktentscheid 14.11.2026, Entscheid 0049.** Der Stimmzettel für
			 * den Ausfall trug je Partei ein Blatt mit mehreren Traktanden. Jetzt
			 * je Traktandum ein Viertel A4, das Zählblatt vorne. Geprüft wird am
			 * lebenden System: Die Route liefert ein PDF aus mehr als einer Seite,
			 * und die Ausfallseite beschreibt es so, wie es ist (Codeprüfung, H1:
			 * Sie sagte noch «je Partei ein Blatt … als letzte Seite das
			 * Zählblatt»).
			 */
			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/stimmzettel.pdf`
			);
			behaupte(antwort.ok(), `Der Stimmzettel antwortete mit ${antwort.status()}`);
			behaupte(
				(antwort.headers()['content-type'] ?? '').includes('application/pdf'),
				`Kein PDF: ${antwort.headers()['content-type']}`
			);
			const { PDFDocument } = require('pdf-lib');
			const seiten = (await PDFDocument.load(await antwort.body())).getPageCount();
			behaupte(seiten >= 2, `Nur ${seiten} Seite(n): Zählblatt und Zettel fehlen`);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/ausfall`, {
				waitUntil: 'domcontentloaded'
			});
			const text = await leitung.locator('main').innerText();
			behaupte(text.includes('Je Traktandum ein Zettel'), 'Die Ausfallseite beschreibt den Stimmzettel nicht');
			behaupte(!text.includes('Je Partei ein Blatt'), 'Die Ausfallseite beschreibt noch das alte Blatt');
			return `${seiten} Seiten, Ausfallseite nachgezogen`;
		});

		await schritt('Das Vollmachtsformular geht auch ohne neue Zugangscodes', async () => {
			/*
			 * **Bedienbarkeitsprüfung 05.09.2026, Befund 25**: «Es fehlen ein
			 * Vollmachtsformular und eine Absenderangabe.» Die Einladung sagt seit
			 * dem 23.08.2026, dass man sich vertreten lassen kann; womit, lag
			 * nicht bei.
			 *
			 * Geprüft wird **dieser eine Weg**, und nur er. Dass Name, Einheiten
			 * und Vollmachtsgrenze auf dem Blatt stehen, misst
			 * `tests/db/pdf.test.ts` am zurückgelesenen Text; dass es im
			 * Versandpaket und in der Versandliste steht,
			 * `tests/db/versandpaket.test.ts`. Der Versandsatz und das Paket
			 * **erzeugen neue Zugangscodes** und entwerten die alten — sie hier
			 * abzurufen risse dem Drehbuch die Telefone aus der Hand, die es zwei
			 * Schritte später braucht. Genau deshalb gibt es diesen Weg.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/zugaenge`, {
				waitUntil: 'domcontentloaded'
			});
			const verweis = leitung.locator('a[href$="/vollmachtsformular.pdf"]');
			behaupte(
				await verweis.count(),
				'Kein Weg zum Vollmachtsformular ohne neue Zugangscodes'
			);

			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/vollmachtsformular.pdf`
			);
			behaupte(antwort.ok(), `Das Vollmachtsformular antwortete mit ${antwort.status()}`);
			const bytes = (await antwort.body()).length;
			behaupte(bytes > 1000, `Das Formular ist mit ${bytes} Byte zu klein`);
			const name = antwort.headers()['content-disposition'] ?? '';
			behaupte(
				/Vollmachtsformular-/.test(name),
				`Es heisst im Postfach nicht «Vollmachtsformular»: ${name}`
			);
			return `${Math.round(bytes / 1024)} kB`;
		});

		await schritt('Zugänge für alle drei Parteien erzeugen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/zugaenge`, {
				waitUntil: 'domcontentloaded'
			});
			const erzeugen = leitung.locator('form.erzeugen button[type="submit"]');
			behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen der Karten');
			// Das Ergebnis ist ein PDF-Abruf; die Seite selbst zeigt die Codes nie.
			const [download] = await Promise.all([
				leitung.waitForEvent('download', { timeout: 20000 }).catch(() => null),
				erzeugen.click()
			]);
			await leitung.waitForTimeout(250);
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/zugaenge`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				'Alle Parteien haben einen gültigen Zugang',
				'Nicht alle Parteien haben einen Zugang'
			);
			return download ? `Karten als ${download.suggestedFilename()}` : 'Karten erzeugt';
		});

		// ── Der Abend auf einem anderen Gerät ───────────────────────────────
		console.log('\nAbgabe an ein Saalgerät');

		/*
		 * **Der Gerätecode entsteht hier von Hand, nicht über `saalgeraet.ts`.**
		 * Ein Drehbuch, das die Anwendung mit ihrem eigenen Werkzeug misst,
		 * bestätigt nur sich selbst: Wäre das Format falsch, wären beide Seiten
		 * gleich falsch. Gebaut wird deshalb nach der Beschreibung — zwei
		 * öffentliche Teile als base64url, ein Punkt dazwischen —, und der
		 * Fingerabdruck ist SHA-256 über genau diese Zeichenkette.
		 */
		const saalgeraetName = `Prüflauf Notebook ${LAUF}`;
		const saalgeraetCode = [
			generateKeyPairSync('x25519').publicKey.export({ type: 'spki', format: 'der' }),
			generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' })
		]
			.map((teil) => teil.toString('base64url'))
			.join('.');
		const saalgeraetZeichen = createHash('sha256')
			.update(saalgeraetCode, 'utf8')
			.digest('hex')
			.slice(0, 32)
			.match(/.{4}/g)
			.join(' ');

		await schritt('Ein Saalgerät eintragen — der Fingerabdruck ist der Vergleich von Auge', async () => {
			await gehe(leitung, '/betreiber/saalgeraete');
			const formular = leitung.locator('form[action="?/eintragen"]');
			behaupte(await formular.count(), 'Kein Formular zum Eintragen eines Geräts');
			await fuelle(leitung, 'form[action="?/eintragen"] input[name="name"]', saalgeraetName);
			await fuelle(leitung, 'form[action="?/eintragen"] textarea[name="code"]', saalgeraetCode);
			await abschicken(leitung, formular.locator('button[type="submit"]'));

			/*
			 * **Am Fingerabdruck messen, nicht am Namen.** Der Name ist das, was
			 * getippt wurde; er stünde auch dann da, wenn der Schlüssel unterwegs
			 * verlorengegangen wäre. Der Fingerabdruck ist der Beweis, dass genau
			 * dieser Schlüssel angekommen ist — und er ist zugleich das, was ein
			 * Mensch im Saal mit dem Bildschirm des Notebooks vergleicht.
			 */
			const stand = await text(leitung);
			behaupte(
				stand.includes(saalgeraetZeichen),
				`Die Liste zeigt den Fingerabdruck «${saalgeraetZeichen}» nicht`
			);
			return saalgeraetZeichen;
		});

		await schritt('Abgeben: das Paket ist verschlüsselt, die Versammlung gesperrt', async () => {
			await gehe(leitung, `/versammlungen/${versammlungId}/abgeben`);
			await bereit(leitung);
			await leitung.selectOption('select[name="geraet"]', { label: saalgeraetName });
			await abschicken(leitung, leitung.locator('form[action="?/abgeben"] button[type="submit"]'));
			await behaupteText(
				leitung,
				`Abgegeben an «${saalgeraetName}»`,
				'Die Seite bestätigt die Abgabe nicht'
			);

			/*
			 * **Das Paket wird abgeholt, nicht bloss verlinkt.** Ein Link, der 404
			 * liefert, sähe auf der Seite genauso aus. Geprüft wird die Marke im
			 * Kopf (VOTUMG1) und die Gegenprobe darauf, dass der Inhalt wirklich
			 * verschlüsselt ist: Ein Tabellenname aus dem Paket darf in den rohen
			 * Bytes nicht vorkommen. Ohne diese zweite Zeile wäre auch ein Paket
			 * grün, das die Marke trägt und den Rest im Klartext anhängt.
			 */
			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/abgeben/paket.votum`
			);
			behaupte(antwort.status() === 200, `Das Paket kam mit ${antwort.status()} zurück`);
			const bytes = Buffer.from(await antwort.body());
			behaupte(
				bytes.subarray(0, 7).toString('ascii') === 'VOTUMG1',
				`Das Paket beginnt mit «${bytes.subarray(0, 7).toString('ascii')}» statt «VOTUMG1»`
			);
			behaupte(bytes.length > 2000, `Das Paket ist nur ${bytes.length} Bytes gross`);
			behaupte(
				!bytes.toString('latin1').includes('snapshot_party'),
				'Das Paket trägt seinen Inhalt im Klartext'
			);

			/*
			 * **Die Sperre sitzt in der Datenbank, nicht in der Seite** (Migration
			 * 117). Die Seite nimmt den Eröffnen-Knopf weg, das ist die Höflichkeit;
			 * geprüft wird hier die Zusage darunter, mit einem Post an derselben
			 * Handlung.
			 *
			 * **Nicht am Statuscode messen** (18.09.2026, hier zuerst falsch
			 * gebaut). Eine Formularaktion antwortet in SvelteKit mit HTTP 200 und
			 * JSON; die Absage steht als `"type":"failure"` im Körper. Eine Probe
			 * auf `status() >= 400` wäre also rot, obwohl die Sperre hält — genau
			 * das ist passiert. Gemessen wird deshalb der Wortlaut der Absage, und
			 * gleich darauf die Wirkung: kein Anzeigecode, denn den gibt es nur
			 * nach dem Eröffnen.
			 */
			const gewaltsam = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}?/eroeffnen`,
				{ form: {}, headers: { origin: ZIEL } }
			);
			const absage = await gewaltsam.text();
			behaupte(
				/"type":"failure"/.test(absage),
				`Das Eröffnen einer abgegebenen Versammlung wurde nicht abgewiesen: ${gewaltsam.status()} ${absage.slice(0, 300)}`
			);
			/*
			 * Und die Absage muss lesbar sein. Ohne diese Zeile wäre auch ein roher
			 * Datenbankfehler grün, und der käme beim Benutzer als leere Seite an.
			 */
			behaupte(
				/ander(es|en) Gerät/i.test(absage),
				`Die Absage nennt den Grund nicht: ${absage.slice(0, 300)}`
			);

			await gehe(leitung, `/versammlungen/${versammlungId}`);
			await behaupteText(
				leitung,
				'Diese Versammlung ist unterwegs',
				'Die Versammlungsseite sagt nicht, dass sie abgegeben ist'
			);
			behaupte(
				(await leitung.locator('form[action="?/eroeffnen"]').count()) === 0,
				'Der Eröffnen-Knopf steht trotz Abgabe noch da'
			);
			behaupte(
				(await leitung.locator('.anzeigecode .code').count()) === 0,
				'Die Versammlung wurde trotz Abgabe eröffnet'
			);
			return `${(bytes.length / 1024).toFixed(1)} kB, verschlüsselt`;
		});

		await schritt('Die Rücknahme gibt die Versammlung wieder frei', async () => {
			await gehe(leitung, `/versammlungen/${versammlungId}/abgeben`);
			await fuelle(
				leitung,
				'form[action="?/zuruecknehmen"] input[name="grund"]',
				'Prüflauf: der Abend wird hier geführt'
			);
			// Bestätigt wird im Rückfragefenster, das der Beobachter am Kontext
			// drückt (`rueckfragenBestaetigen`).
			await abschicken(
				leitung,
				leitung.locator('form[action="?/zuruecknehmen"] button[type="submit"]').first()
			);
			await behaupteText(
				leitung,
				'Die Abgabe ist zurückgenommen',
				'Die Rücknahme wird nicht bestätigt'
			);
			await behaupteText(
				leitung,
				'zurückgenommen am',
				'Die frühere Abgabe steht nicht im Verlauf der Seite'
			);

			/*
			 * **Und der Weg ist wieder offen.** Das ist keine Zugabe: Der nächste
			 * Schritt des Drehbuchs eröffnet die Versammlung. Bliebe die Sperre
			 * stehen, fiele der Befund dort und zeigte auf die falsche Stelle.
			 */
			await gehe(leitung, `/versammlungen/${versammlungId}`);
			await behaupteOhne(
				leitung,
				'Diese Versammlung ist unterwegs',
				'Die Versammlung gilt nach der Rücknahme weiter als abgegeben'
			);
			behaupte(
				await leitung.locator('form[action="?/eroeffnen"]').count(),
				'Nach der Rücknahme fehlt der Knopf zum Eröffnen'
			);
			return 'Sperre gefallen';
		});

		// ── Durchführung ────────────────────────────────────────────────────
		console.log('\nDurchführung');

		await schritt('Versammlung eröffnen und Anzeigecode erhalten', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}`, { waitUntil: 'domcontentloaded' });
			const knopf = leitung.locator('form[action="?/eroeffnen"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Eröffnen');
			await abschicken(leitung, knopf);
			const code = leitung.locator('.anzeigecode .code');
			/*
			 * Auf den Zustand warten, nicht sofort zählen — siehe «Auf den Knopf
			 * warten» beim Folgeantrag weiter unten. Hier schützt es wirklich: Den
			 * Anzeigecode gibt es vor dem Eröffnen nicht, er entsteht erst durch
			 * diesen Post.
			 */
			await code
				.first()
				.waitFor({ timeout: 10_000 })
				.catch(() => {});
			behaupte(await code.count(), 'Kein Anzeigecode nach dem Eröffnen');
			anzeigecode = (await code.textContent()).trim();
			behaupte(anzeigecode.length >= 12, `Anzeigecode zu kurz: ${anzeigecode}`);
			return anzeigecode;
		});

		await schritt('Im Saal: milderes Mehr als in der Einladung abgewiesen', async () => {
			/*
			 * **Produktentscheid 27.09.2026**: Das gedruckte Mehr ist im Saal die
			 * Untergrenze, strenger geht, milder nicht. Die Einladung nennt für
			 * die Fassadensanierung das qualifizierte Mehr.
			 */
			const vorher = await fassadenzeile();
			gewollteAbsage = true;
			try {
				await versucheEinfachesMehr();
				await behaupteText(
					leitung,
					'Im Saal darf das Mehr nur strenger werden',
					'Im Saal wurde ein milderes Mehr als in der Einladung nicht abgewiesen'
				);
			} finally {
				gewollteAbsage = false;
			}
			const nachher = await fassadenzeile();
			behaupte(nachher === vorher, `Das Mehr am Traktandum hat sich trotz Absage geändert: ${nachher.slice(0, 200)}`);
			return 'Absage milder_als_einladung';
		});

		await schritt('Vor dem Einlass lässt sich keine Abstimmung freigeben', async () => {
			/*
			 * **Ä-18, 17.09.2026.** Bis dahin fragte `oeffneAbstimmung` nicht nach
			 * der Beschlussfähigkeit: Eine eben eröffnete Versammlung ohne einen
			 * einzigen Anwesenden konnte abstimmen. Jetzt ist niemand eingelassen,
			 * also muss der Server absagen, und es darf kein Durchgang entstehen,
			 * sonst liefe der Rest des Drehbuchs gegen eine offene Abstimmung.
			 */
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/oeffnen`,
				{ form: { traktandum: traktandumId }, headers: { origin: ZIEL } }
			);
			const roh = await antwort.text();
			behaupte(
				/nicht beschlussf[^"]{0,3}hig/.test(roh),
				`Die Abstimmung liess sich ohne Beschlussfähigkeit freigeben: ${antwort.status()} ${roh.slice(0, 300)}`
			);
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, { waitUntil: 'domcontentloaded' });
			behaupte(
				(await leitung.locator('form[action="?/schliessen"]').count()) === 0,
				'Nach der Absage steht trotzdem eine offene Abstimmung da'
			);
			return 'Absage vom Server, keine offene Abstimmung';
		});

		await schritt('Beamer meldet sich mit dem Anzeigecode an', async () => {
			aktuelleSeite = beamer;
			await gehe(beamer, '/p');
			await fuelle(beamer, 'input[name="code"]', anzeigecode);
			await abschicken(beamer, beamer.locator('main button[type="submit"]').first());
			// Die Adresse bleibt `/p` — der Code steht im Keks, nicht im Pfad. Geprüft
			// wird deshalb der Inhalt: Die Präsentationssicht zeigt die Traktanden.
			await behaupteText(beamer, 'Fassadensanierung', 'Der Beamer kam nicht hinein');
			aktuelleSeite = leitung;
		});

		await schritt('Ausgabecodes für zwei Telefone erzeugen', async () => {
			// Zwei Geräte, nicht eines: Stimmt nur einer von zweien ab, ist die
			// Abstimmung unvollständig — und erst dann lässt sich prüfen, ob der
			// Beamer das Ergebnis wirklich zurückhält. Bei einem einzigen
			// Stimmberechtigten erschiene es zu Recht sofort (Story 5.9).
			for (let i = 0; i < 2; i++) {
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
					waitUntil: 'domcontentloaded'
				});
				const formulare = leitung.locator('form[action="?/codeAusgeben"]');
				behaupte(
					(await formulare.count()) > i,
					`Kein Ausgabeformular für die ${i + 1}. Partei`
				);
				await abschicken(leitung, formulare.nth(i).locator('button[type="submit"]'));
				/*
				 * **Warten, nicht zählen** (berichtigt am 21.08.2026).
				 *
				 * Dieses Formular sendet über `use:enhance`. Dann gibt es keine
				 * Navigation: `abschicken` sieht die Antwort, `domcontentloaded` ist
				 * für die alte Seite längst erfüllt, und die 120 ms danach sollen für
				 * `update()` reichen — das aber selbst noch einmal an den Server geht
				 * (`invalidateAll`). Auf einem gewachsenen Prüfbestand reicht das
				 * nicht mehr, und der Schritt scheiterte mit «Kein Ausgabecode
				 * erschienen», obwohl die Antwort den Code enthielt (nachgemessen).
				 */
				const code = leitung.locator('.ausgabe .code');
				await code
					.first()
					.waitFor({ state: 'attached', timeout: 15000 })
					.catch(() => {});
				behaupte(
					await code.count(),
					`Kein Ausgabecode erschienen — URL ${leitung.url()}`
				);
				ausgabecodes.push((await code.textContent()).trim());
			}
			return ausgabecodes.join(' / ');
		});

		await schritt('Die Doppelklicksperre trifft die Zeile, nicht die Nachbarin', async () => {
			/*
			 * **Was hier auf dem Spiel steht** (28.08.2026).
			 *
			 * `absenden()` weist eine zweite Absendung ab, solange die erste noch
			 * läuft — sonst malt die spätere Antwort den Stand der früheren
			 * (`applyAction` hat dagegen keinen Schutz). Der Schlüssel dafür muss
			 * die Zeile benennen können. Auf dieser Seite trägt jede Zeile ein
			 * eigenes `<form>` mit **derselben** Aktion, die Kennung steht in einem
			 * verborgenen Feld, und der Knopf hat gar keinen Namen: Über Ziel und
			 * Knopf allein wäre jede Zeile dieser Tabelle dieselbe Handlung, und
			 * wer zwei Parteien schnell nacheinander bedient, bekäme bei der zweiten
			 * nichts — ohne Meldung, ohne Ladezustand.
			 *
			 * **Beide Richtungen, sonst ist die Probe wertlos.** Eine Sperre, die
			 * gar nichts tut, bestünde die erste Hälfte; eine, die alles sperrt, die
			 * zweite.
			 *
			 * **Die Anfragen werden abgefangen und selbst beantwortet.** Gezählt
			 * wird, was der Browser abschickt — das ist die Frage. Der Server soll
			 * dabei nichts tun: Zwei echte Codes würden den nächsten Schritt
			 * anlügen, der die vorhin ausgegebenen einlöst.
			 *
			 * **Und die erste Antwort wird gehalten.** Ohne das ist die erste
			 * Absendung längst fertig, wenn der zweite Klick kommt, die Sperre steht
			 * gar nicht mehr, und der Schritt wäre auch dann grün, wenn es sie nicht
			 * gäbe.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			const formulare = leitung.locator('form[action="?/codeAusgeben"]');
			const zeilen = await formulare.count();
			/*
			 * **Drei Zeilen, nicht zwei.** Die zweite Hälfte braucht eine Zeile,
			 * die die erste nicht angefasst hat — Begründung dort.
			 */
			behaupte(zeilen >= 3, `Weniger als drei Zeilen mit Codeausgabe (${zeilen})`);

			/*
			 * **Gehalten wird nur so lange, wie die zwei Klicks brauchen.** Sie
			 * folgen im selben Zug aufeinander; 400 ms sind reichlich, und jede
			 * Millisekunde darüber steht am Ende in der Laufzeit des Drehbuchs.
			 */
			let anfragen = [];
			await leitung.route(/\?\/codeAusgeben/, async (route) => {
				anfragen.push(route.request().url());
				if (anfragen.length === 1) await new Promise((r) => setTimeout(r, 400));
				await route.fulfill({
					status: 200,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ type: 'success', status: 200 })
				});
			});

			/*
			 * `el.click()` im Browser statt `locator.click()`: Playwright wartet vor
			 * einem Klick darauf, dass das Element ruhig steht, und genau das soll
			 * hier nicht geschehen. Die zwei Klicks müssen dicht aufeinander folgen.
			 */
			const druecke = (n) =>
				formulare.nth(n).locator('button[type="submit"]').evaluate((el) => el.click());
			/*
			 * **Auf die Zahl warten, nicht auf eine Frist** — dieselbe Regel wie bei
			 * `abschicken()` weiter oben. Die zweite Hälfte kann nicht darauf warten,
			 * dass etwas ausbleibt; dort steht eine Frist, aber sie muss nur das
			 * Halten überdauern, denn `cancel()` entscheidet synchron beim Klick.
			 */
			const warteAufAnfragen = async (wieviele, frist = 15000) => {
				const bis = Date.now() + frist;
				while (Date.now() < bis && anfragen.length < wieviele) {
					await new Promise((f) => setTimeout(f, 50));
				}
				return anfragen.length;
			};

			// Zwei verschiedene Zeilen: beide müssen durchkommen.
			await druecke(0);
			await druecke(1);
			const nachbarn = await warteAufAnfragen(2);

			/*
			 * **Erst zur Ruhe kommen lassen.** Die erste Hälfte endet mit einem
			 * `update()`, das `invalidateAll()` gegen den echten Server fährt; erst
			 * danach gibt `absenden()` den Schlüssel frei. Wer sofort weiterdrückt,
			 * misst noch die alte Sperre und bekäme «die Sperre greift nicht» zu
			 * lesen, obwohl sie zu gut greift.
			 */
			await nachladeWarter(leitung, 15000);
			anfragen = [];

			/*
			 * **Und deshalb eine unberührte Zeile.** Warten allein genügte nicht:
			 * Der Schritt war am 28.08.2026 in drei von sechs Läufen rot, mit
			 * «0 statt 1 Absendung» — beide Klicks abgewiesen, weil der Schlüssel
			 * aus der ersten Hälfte noch stand. Der Warter oben wird **nach** den
			 * Klicks scharfgestellt und müsste zwei Nachladeläufe abdecken; ob er
			 * den richtigen erwischt, ist eine Frage des Zeitpunkts.
			 *
			 * Zeile 2 hat die erste Hälfte nicht angefasst. Damit hängt die
			 * Messung an keiner Frist mehr, und sie sagt weiterhin dasselbe:
			 * zweimal derselbe Knopf, eine Absendung.
			 */
			await druecke(2);
			await druecke(2);
			await warteAufAnfragen(1);
			await leitung.waitForTimeout(600);
			const doppelt = anfragen.length;

			await leitung.unroute(/\?\/codeAusgeben/);

			behaupte(
				nachbarn === 2,
				`Zwei verschiedene Zeilen ergaben ${nachbarn} statt 2 Absendungen — die Sperre trifft die Nachbarzeile`
			);
			behaupte(
				doppelt === 1,
				`Zweimal dieselbe Zeile ergab ${doppelt} statt 1 Absendung — die Sperre greift nicht`
			);
			return `Nachbarzeilen ${nachbarn}, Doppelklick ${doppelt}`;
		});

		await schritt('Beide Telefone lösen ihren Code ein', async () => {
			for (const [seite, code] of [
				[telefon, ausgabecodes[0]],
				[telefonB, ausgabecodes[1]]
			]) {
				aktuelleSeite = seite;
				await seite.goto(`${ZIEL}/z`, { waitUntil: 'domcontentloaded' });
				await seite.fill('input[name="code"]', code);
				await abschicken(seite, seite.locator('main button[type="submit"]').first());
				await behaupteOhne(seite, /nicht gültig|unbekannt/, `Code ${code} abgewiesen`);
			}
			aktuelleSeite = leitung;
		});

		/*
		 * **Das erste Telefon meldet sich selbst an.**
		 *
		 * Die Anmeldung ist noch keine Anwesenheit — sie legt sich der
		 * Sitzungsleitung in die Warteliste. Genau dieser Weg trug bis zum
		 * 24.08.2026 den falschen Vermerk: Beim Freigeben schrieb die Anwendung
		 * «Karte gescannt» in den Verlauf einer Person, die nie eine Karte in der
		 * Hand hatte (Auftraggeber: «beheben»).
		 */
		await schritt('Das Einlösen führt von selbst in die Warteschlange', async () => {
			/*
			 * **Ohne zweiten Tipp** (Auftraggeber, 24.08.2026: «Wenn der QR genutzt wird,
			 * lande ich auf der Anmeldeseite. Sollte der dann nicht in die
			 * Warteschlange kommen?»).
			 *
			 * Wer seinen Code einlöst, während die Versammlung läuft, sagt damit
			 * «ich bin da». Bis hierher stand danach ein Knopf «Jetzt anmelden» —
			 * ein Tipp im Gedränge für eine Aussage, die schon gemacht war.
			 *
			 * **Die Sicherung bleibt:** Eine Anmeldung ist keine Anwesenheit. Der
			 * Schritt prüft beides — dass die Person wartet und dass der Knopf weg
			 * ist, weil er nichts mehr zu tun hat.
			 */
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			await behaupteText(
				telefon,
				'Angemeldet',
				'Das Einlösen führt nicht in die Warteliste'
			);
			behaupte(
				(await telefon.locator('form[action="?/anmelden"] button').count()) === 0,
				'Der Knopf «Jetzt anmelden» steht noch da, obwohl die Anmeldung schon liegt'
			);
			aktuelleSeite = leitung;
			return 'wartet auf Freigabe, ohne Tipp';
		});

		/*
		 * **Vollmacht vom eigenen Telefon aus** (Zusatzblock). Der Fall: Jemand
		 * hat die Einladung, merkt aber, dass er nicht kommen kann.
		 *
		 * Erteilt wird hier vom zweiten Telefon, **bevor** die Sitzungsleitung
		 * seine Anwesenheit bestätigt. Der nächste Schritt bestätigt sie — und
		 * damit endet die Vertretung von selbst. Genau dieses Zusammenspiel ist
		 * die Zusage: Wer selbst kommt, übt selbst aus.
		 */
		await schritt('Eine Vollmacht vom Telefon aus erklären — mit Weisung', async () => {
			aktuelleSeite = telefonB;
			await gehe(telefonB, '/z');
			await behaupteText(
				telefonB,
				'Ich kann nicht kommen',
				'Das Telefon bietet die Vollmacht nicht an'
			);

			const auswahl = telefonB.locator('form.erteilen select[name="bevollmaechtigt"]');
			behaupte(await auswahl.count(), 'Keine Auswahl der bevollmächtigten Person');
			const werte = await auswahl.locator('option').evaluateAll((o) =>
				o.map((x) => ({ wert: x.value, text: x.textContent.trim() }))
			);
			const ziel = werte.find((w) => w.wert);
			behaupte(ziel, `Keine wählbare Partei: ${JSON.stringify(werte)}`);
			await auswahl.selectOption(ziel.wert);

			// Eine Weisung zum Antrag — eine Empfehlung, keine Stimme.
			const weisung = telefonB.locator('form.erteilen input[type="radio"][value="ja"]').first();
			behaupte(await weisung.count(), 'Keine Weisung zum Antrag anzukreuzen');
			await weisung.check();

			await abschicken(telefonB, telefonB.locator('form.erteilen button[type="submit"]'));
			await behaupteText(
				telefonB,
				'Die Vollmacht ist erklärt',
				'Die Erklärung wurde nicht angenommen'
			);
			// **Sie überträgt noch nichts** — das muss dastehen, sonst verlässt sich
			// jemand darauf.
			await behaupteText(
				telefonB,
				'Sitzungsleitung prüft',
				'Das Telefon behauptet, die Vollmacht sei bereits wirksam'
			);
			// Und zurücknehmen geht jetzt nicht mehr: Die Versammlung läuft.
			await behaupteText(
				telefonB,
				'Kommen Sie selbst',
				'Das Telefon nennt den Weg nicht, der während der Sitzung gilt'
			);

			// Die Sitzungsleitung sieht Herkunft und Weisung.
			aktuelleSeite = leitung;
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				'elektronisch über den persönlichen Zugang erklärt',
				'Die Herkunft der Erklärung steht nicht in der Prüfliste'
			);
			await behaupteText(leitung, 'Weisung', 'Die Weisung erscheint nicht bei der Sitzungsleitung');
			return `bevollmächtigt: ${ziel.text}`;
		});

		await schritt('Leitung bestätigt die Anwesenheit', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			// Solange Anmeldungen offen sind, bestätigen — die Zahl ändert sich mit
			// jeder Bestätigung, deshalb die Schleife statt einer festen Anzahl.
			for (let i = 0; i < 6; i++) {
				/*
				 * **`:not([hidden])`, seit die Frage am Eingang steht** (09.09.2026).
				 * Steht der Schalter «digital oder von Hand», beginnt das Formular
				 * mit einem versteckten, gesperrten Vorgabeknopf — er hält Enter
				 * auf, damit niemand die Antwort ungefragt gibt. `.first()` traf
				 * ihn, und der Durchstich klickte einen gesperrten Knopf.
				 *
				 * Der erste sichtbare ist «Freigeben, stimmt digital», sonst
				 * «Freigeben». Beide sind der digitale Weg, den dieser Durchlauf
				 * geht; den anderen misst der Schritt «Einlass auf Papier».
				 */
				const bestaetigen = leitung.locator(
					'form[action="?/bestaetigen"] button[type="submit"]:not([hidden])'
				);
				if (!(await bestaetigen.count())) break;
				await abschicken(leitung, bestaetigen.first());
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
					waitUntil: 'domcontentloaded'
				});
			}
			await behaupteText(leitung, /anwesend/i, 'Keine Anwesenheit erkennbar');

			/*
			 * **Der Weg, den niemand behauptet hat** (Auftraggeber, 24.08.2026: «beheben»).
			 *
			 * Diese Parteien haben sich vom eigenen Telefon aus angemeldet; der
			 * Knopf «Freigeben» bestätigt das bloss. Bis zum 24.08.2026 stand in
			 * der Liste danach «Karte gescannt» — ein falscher Satz im Nachweis,
			 * und niemand hätte ihn je bemerkt, weil er plausibel aussieht.
			 */
			const liste = (await leitung.locator('body').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/selbst angemeldet/.test(liste),
				`Nach dem Freigeben steht der Weg der Selbstanmeldung nicht in der Liste: ${liste.slice(0, 400)}`
			);
			// In diesem Lauf wurde keine Karte gescannt — «Nachschlagen erfasst
			// noch nichts». Steht es trotzdem da, behauptet die Anwendung etwas,
			// das nicht geschehen ist.
			behaupte(
				!/Karte gescannt/.test(liste),
				'Nach dem Freigeben steht «Karte gescannt» da — es wurde keine Karte gescannt'
			);
		});

		/*
		 * **Der Schalter geht in beide Richtungen** (09.09.2026, im
		 * Security-Review gefunden).
		 *
		 * Er schickte `ja`, gelesen wurde mit `jaNein()`, und das kennt nur
		 * `true` und `on`: Abschalten wirkte zufällig richtig, Einschalten war
		 * ein stiller Leerlauf. Die Handlung meldete «gespeichert», und der
		 * Eingang fragte nie wieder. Ein Datenbanktest fand es nicht — er ruft
		 * die Funktion am Formular vorbei. Deshalb steht die Probe hier, und
		 * deshalb prüft sie beide Richtungen samt Wirkung am Eingang.
		 *
		 * Der Schritt endet mit «eingeschaltet», weil der folgende darauf baut.
		 */
		await schritt('Die Frage am Einlass lässt sich aus- und wieder einschalten', async () => {
			const seite = `${ZIEL}/versammlungen/${versammlungId}`;
			const knopf = () => leitung.locator('form[action="?/papierfrage"] button[type="submit"]');

			const knopftext = async () => {
				await leitung.goto(seite, { waitUntil: 'domcontentloaded' });
				await bereit(leitung);
				behaupte(await knopf().count(), 'Kein Schalter für die Frage am Einlass');
				return (await knopf().innerText()).replace(/\s+/g, ' ');
			};

			behaupte(
				/nicht mehr fragen/.test(await knopftext()),
				'Die Frage steht nicht ab Werk auf «fragen»'
			);

			await abschicken(leitung, knopf());
			behaupte(
				/nach der Stimmabgabe fragen/.test(await knopftext()),
				'Das Abschalten wirkte nicht — der Knopf bietet weiter das Abschalten an'
			);

			// Und der Eingang fragt wirklich nicht mehr.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.locator('details.vonhand summary').click();
			behaupte(
				(await leitung.locator('details.vonhand form input[name="papier"]').count()) === 0,
				'Der Eingang fragt weiter, obwohl der Schalter aus ist'
			);

			await knopftext();
			await abschicken(leitung, knopf());
			behaupte(
				/nicht mehr fragen/.test(await knopftext()),
				'Das Einschalten wirkte nicht — der Schalter ist einbahnig'
			);
			return 'aus und wieder ein, mit Wirkung am Eingang';
		});

		/*
		 * **Die Mischform: eine Partei stimmt auf Papier ab** (Auftraggeber, 09.09.2026).
		 *
		 * Der Weg am Eingang, ganz herum: beim Einlassen «stimmt von Hand»
		 * ankreuzen, den Rückweg mit seiner Restzeit sehen, ihn drücken, und im
		 * Verlauf beide Schritte wiederfinden. Die Rücknahme steht mit im selben
		 * Schritt und nicht als eigener, weil der Vermerk sonst stehenbliebe und
		 * das Telefon dieser Partei in den folgenden Schritten gesperrt wäre.
		 *
		 * **Warum über «Ohne Karte einlassen» und nicht über die gescannte
		 * Karte.** Die Karte trägt einen dauerhaften Code, der in diesem Lauf
		 * nirgends im Bildschirm steht — er ist nur im PDF. Die Ausgabecodes
		 * sind Einmalcodes und beim Einlösen der Telefone verbraucht; mit einem
		 * davon nachzuschlagen endete in einer Absage (gemessen, 400 auf
		 * `?/pruefen`). Die Frage steht an beiden Eingängen, gemessen wird sie
		 * hier an dem, der ohne Karte auskommt.
		 *
		 * Was der Vermerk an der Abstimmung bewirkt (die Begründung entfällt),
		 * misst `tests/db/papierabgabe.test.ts`. Hier geht es um den Eingang.
		 */
		/**
		 * Lässt Aebi mit gesetztem Häkchen «stimmt von Hand» ein.
		 *
		 * **Aus dem Schritt herausgehoben** (10.09.2026), weil ihn zwei Schritte
		 * brauchen: der hier unten, der beide Rückwege misst und den Vermerk
		 * wieder wegnimmt, und einer vor dem Schluss der Versammlung, der ihn
		 * stehen lässt, damit das Protokoll ihn nennen kann. Zweimal abgeschrieben
		 * liefen die beiden auseinander, und dann prüfte der zweite einen anderen
		 * Weg als der erste.
		 */
		const lasseAufPapierEin = async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			const auf = leitung.locator('details.vonhand summary');
			behaupte(await auf.count(), 'Kein Weg, ohne Karte einzulassen');
			await auf.click();

			const formular = leitung.locator('details.vonhand form');
			const haken = formular.locator('input[type="checkbox"][name="papier"]');
			behaupte(
				(await haken.count()) === 1,
				`Im Einlassformular stehen ${await haken.count()} statt einem Häkchen ` +
					'«stimmt von Hand ab» — die Frage wird nicht gestellt'
			);
			/*
			 * **Und daneben das versteckte «nein»** (10.09.2026). Ein leeres Kästchen
			 * schickt gar nichts; ohne dieses Feld sähe «gefragt und verneint» für
			 * den Server aus wie «gar nicht gefragt», und er meldete diesen Eingang
			 * als Lücke in der Maske. Genau daran hat sich der Selektor hier
			 * gestossen: Er traf plötzlich zwei Felder — das ist der Beleg, dass
			 * beide dastehen.
			 */
			behaupte(
				(await formular.locator('input[type="hidden"][name="papier"][value="nein"]').count()) ===
					1,
				'Das Formular sagt nicht, dass es gefragt hat — ein leeres Kästchen schickt nichts'
			);
			const werListe = formular.locator('label.wer');
			await werListe.locator('input[type="search"]').fill(`Aebi ${LAUF}`);
			const werTreffer = werListe.locator('input[name="partei"]:not([disabled])');
			await warteAufTreffer(werTreffer, 1);
			await werTreffer.first().check();
			await haken.check();
			await abschicken(leitung, formular.locator('button[type="submit"]'));
			/*
			 * **Auf die Antwort warten, nicht auf den Wortlaut** (Nachzug Block
			 * 1d; «Offen aus Block 8», Punkt 6). Hier stand
			 * `behaupteText(/von Hand ab/)`, und das Muster traf die
			 * Beschriftung des Häkchens im Formular — sie steht schon vor der
			 * Antwort auf der Seite. Der Schritt konnte damit grün werden, bevor
			 * der Server überhaupt geantwortet hatte, und wäre auch bei einer
			 * fachlichen Absage grün geblieben (viermal rot gemeldet, auch auf
			 * dem Stand vor Block 8).
			 *
			 * Das Merkmal der Antwort ist der Rücknahme-Knopf an der Zeile: Er
			 * entsteht erst aus den geladenen Daten und nur, wenn die
			 * Papierabgabe wirklich vermerkt ist. Dieselbe Stelle misst weiter
			 * unten `zeileTraegtVermerk`; hier wird auf sie gewartet.
			 *
			 * **Und das Warten belegt den ganzen Zustand** (Nachzug-Abnahme,
			 * B4f): Der Gegenweg «Stimmt doch von Hand» und der Rückweg stehen in
			 * der Anwesenheitsseite in `{#if}…{:else if}`; steht der eine da, ist
			 * der andere von selbst weg. Eine eigene Behauptung dafür könnte
			 * nicht fehlschlagen und wäre nur eine Zeile, die grün aussieht.
			 */
			const aebiZeile = leitung.locator('tr', { hasText: `Aebi ${LAUF}` }).first();
			await warteAufTreffer(aebiZeile.locator('form[action="?/papierZuruecknehmen"]'), 1);
		};

		await schritt('Einlass auf Papier: ankreuzen, beide Rückwege, im Verlauf finden', async () => {
			const anwesenheit = `${ZIEL}/versammlungen/${versammlungId}/anwesenheit`;

			/**
			 * Steht der Vermerk an der Zeile dieser Partei in der Liste?
			 *
			 * **Am Formular gemessen, nicht am Wortlaut** (11.09.2026). Hier stand
			 * `innerText().includes('Stimmt von Hand')`, und das war doppelt
			 * zerbrechlich: Die Rücknahme heisst seit dem 11.09.2026 «Stimmt doch
			 * digital», und die Zeile OHNE Vermerk trägt seither den Gegenknopf
			 * «Stimmt doch von Hand» — dieselbe Zeichenfolge, umgekehrte Bedeutung.
			 * Der Lauf wurde rot und meldete das Gegenteil dessen, was der Fall war.
			 *
			 * Der Rückweg gibt es genau dann, wenn der Vermerk steht; die Handlung
			 * ist der Prüfstein, nicht ihre Beschriftung.
			 */
			const zeileTraegtVermerk = async () => {
				await leitung.goto(anwesenheit, { waitUntil: 'domcontentloaded' });
				await bereit(leitung);
				const zeile = leitung.locator('tr', { hasText: `Aebi ${LAUF}` }).first();
				behaupte(await zeile.count(), 'Aebi steht nicht in der Anwesenheitsliste');
				const zurueck = await zeile.locator('form[action="?/papierZuruecknehmen"]').count();
				/*
				 * **Und der Gegenweg muss da sein, wenn der Rückweg fehlt** (zweiter
				 * Reviewdurchgang, 11.09.2026). Beide Formulare stehen nur, solange
				 * die Versammlung läuft. Ohne diese Klammer meldete die Probe an einer
				 * geschlossenen Versammlung «kein Vermerk» — und die beiden
				 * Verneinungen unten wären still grün, ohne etwas gemessen zu haben.
				 */
				const hin = await zeile.locator('form[action="?/papierBeantworten"]').count();
				behaupte(
					zurueck + hin > 0,
					'An Aebis Zeile steht weder Hin- noch Rückweg — die Versammlung läuft nicht mehr, und diese Probe misst nichts'
				);
				return zurueck > 0;
			};

			// ── Erster Rückweg: das Fenster von fünf Sekunden ──────────────────
			await lasseAufPapierEin();

			/*
			 * **Kein Codefenster über dem Rückweg** (09.09.2026, hier gefunden).
			 * Der Einlass ohne Karte legte bis dahin immer einen Zugangscode samt
			 * Bild als Fenster über die Seite. Bei einer Papierpartei deckte es
			 * genau den Knopf «Zurück (5)» zu: sichtbar, anklickbar nicht, und
			 * nach fünf Sekunden vorbei.
			 */
			behaupte(
				(await leitung.locator('dialog.ausgabe[open]').count()) === 0,
				'Für eine Papierpartei steht ein Zugangscode-Fenster über dem Rückweg'
			);
			await behaupteText(
				leitung,
				'Kein Zugangscode ausgegeben',
				'Die Meldung sagt nicht, warum kein Code erschien'
			);

			/*
			 * **`section.entscheid`, seit dem 10.09.2026.** Der Kasten hiess
			 * `Papierruecknahme` und konnte nur wegnehmen; seit der gemeinsame Abend
			 * ihn auch in der Gegenrichtung braucht (dort erfasst der Scanner sofort,
			 * und die Frage kommt danach), trägt er beide und heisst danach.
			 * `data-richtung` sagt, welche gerade dasteht.
			 */
			const zurueck = leitung.locator(
				'section.entscheid[data-richtung="gesetzt"] button[type="submit"]'
			);
			behaupte(
				await zurueck.count(),
				'Nach dem Vermerk steht kein Rückweg da — der Fehlgriff am Eingang bliebe stehen'
			);
			const beschriftung = await zurueck.innerText();
			behaupte(
				/Zur[^ ]*ck \(\d\)/.test(beschriftung),
				`Der Rückweg nennt keine Restzeit: ${beschriftung}`
			);
			await behaupteText(
				leitung,
				'nicht den Einlass',
				'Der Rückweg verspricht mehr, als er hält — der Einlass bleibt bestehen'
			);
			await abschicken(leitung, zurueck);
			behaupte(
				!(await zeileTraegtVermerk()),
				'Das Fenster nahm den Vermerk nicht zurück — die Zeile trägt ihn weiter'
			);

			/*
			 * ── Zweiter Rückweg: die Zeile in der Liste ────────────────────────
			 *
			 * **Der Weg, der zweimal im Review fehlte.** Nach den fünf Sekunden
			 * blieb für eine ohne Karte eingelassene Partei gar kein Rückweg: Die
			 * Kontrollkarte gibt es nur, wenn jemand eine Karte zu scannen hat, und
			 * genau die hatte diese Person nicht dabei.
			 */
			await lasseAufPapierEin();
			behaupte(
				await zeileTraegtVermerk(),
				'Die Anwesenheitsliste zeigt den Vermerk nicht — ohne Karte gäbe es keinen Rückweg mehr'
			);

			/*
			 * **Und das Telefon sagt es, BEVOR die erste Abstimmung läuft**
			 * (11.09.2026, vom Auftraggeber im Eingangstest gefunden).
			 *
			 * Hier stand «Sobald eine Abstimmung eröffnet wird, erscheint die Frage
			 * hier auf dieser Seite» — ein Satz, der für eine Papierpartei nicht
			 * zutrifft und den sie erst dadurch widerlegt findet, dass nichts
			 * kommt. Genau die Lage, aus der mitten in der Versammlung ein Anruf
			 * bei der Verwaltung wird.
			 *
			 * **Die Stelle ist mit Absicht hier und nicht im Abstimmungsteil:** Bei
			 * offenem Durchgang steht ohnehin der Sperrtext am Traktandum, und der
			 * gab es schon vorher. Gemessen würde dort also das Alte.
			 */
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			await behaupteText(
				telefon,
				/Sie stimmen an dieser Versammlung von Hand ab/,
				'Das Telefon der Papierpartei verspricht weiter eine Frage, die nie kommt'
			);
			aktuelleSeite = leitung;

			const zeile = leitung.locator('tr', { hasText: `Aebi ${LAUF}` }).first();
			await abschicken(
				leitung,
				zeile.locator('form[action="?/papierZuruecknehmen"] button[type="submit"]').first()
			);
			// Das Rückfragefenster bestätigt der Beobachter am Kontext, der ganz
			// oben einmal gesetzt wurde.
			behaupte(
				!(await zeileTraegtVermerk()),
				'Der Rückweg an der Zeile nahm den Vermerk nicht zurück'
			);

			/*
			 * **Beide Schritte im Verlauf.** Der Vermerk sagt, WIE abgestimmt wird;
			 * dass er gesetzt und wieder aufgehoben wurde, gehört in den Nachweis.
			 * Weil das Aufheben die Zeile löscht, hängen beide Einträge an der
			 * Momentaufnahme der Partei und nicht am Vermerk — sonst wäre
			 * ausgerechnet der über das Aufheben verschwunden.
			 */
			await leitung.goto(`${ZIEL}/verlauf`, { waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const verlauf = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Stimmabgabe auf Papier vermerkt/.test(verlauf),
				`Der Verlauf kennt das Vermerken nicht: ${verlauf.slice(0, 400)}`
			);
			behaupte(
				/Stimmabgabe auf Papier aufgehoben/.test(verlauf),
				`Der Verlauf kennt das Aufheben nicht: ${verlauf.slice(0, 400)}`
			);
			return 'vermerkt, über beide Rückwege zurückgenommen, im Verlauf';
		});

		/*
		 * **Eine Partei muss früher weg und lässt sich vertreten** (Welle 2,
		 * FR-23 bis FR-25).
		 *
		 * Geprüft wird die tragende Reihenfolge: Eine erfasste Vollmacht überträgt
		 * nichts, erst die Bestätigung macht sie wirksam — und die verlangt einen
		 * Nachweis. Und die Wirkung: Weil die vertretende Person im Saal steht,
		 * gilt die vertretene mit der Bestätigung wieder als anwesend.
		 */
		await schritt('Wer selbst kommt, hebt seine eigene Vollmacht auf', async () => {
			// Die eben vom Telefon erklärte Vollmacht endet mit dem Eintreffen der
			// vertretenen Person — ohne Rückfrage, und im Verlauf nachlesbar.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/beendet|widerrufen|zur[^ ]*ckgenommen/i.test(text),
				`Die selbst erklärte Vollmacht steht nach dem Eintreffen noch offen: ${text.slice(0, 300)}`
			);
			return 'Vertretung beendet';
		});

		await schritt('Vollmacht: erfassen, ohne Nachweis abgewiesen, bestätigen', async () => {
			// Christen geht — und übergibt die Stimme an Aebi.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('tr', { hasText: `Christen ${LAUF}` });
			behaupte(await zeile.count(), 'Christen steht nicht in der Anwesenheitsliste');
			const christen = await zeile
				.first()
				.locator('form[action="?/verlassen"] input[name="partei"]')
				.getAttribute('value');
			/*
			 * **Der Takt sagt, wo der Fokus wann stand** (21.09.2026). Die
			 * Fehlermeldung allein nennt nur den Endzustand; ob der Fokus beim
			 * Griff auf dem verschwindenden Knopf stand oder schon herrenlos
			 * war, entscheidet über die Ursache.
			 */
			await leitung.evaluate(() => {
				window.__fokusTakt = [];
				window.__taktT0 = performance.now();
				window.__takt = setInterval(() => {
					const a = document.activeElement;
					const ort =
						a === null
							? 'null'
							: a === document.body
								? 'BODY'
								: (a.getAttribute?.('data-fokus') ?? a.tagName);
					const sp = window.__fokusTakt;
					if (sp.length === 0 || sp[sp.length - 1][1] !== ort)
						sp.push([Math.round(performance.now() - window.__taktT0), ort]);
				}, 25);
			});
			await abschicken(
				leitung,
				zeile.first().locator('form[action="?/verlassen"] button[type="submit"]'),
				// Seit dem 04.10.2026 verlangt das Fenster eine Begründung
				// (Befund 03.10.2026, Punkt 8); sie kommt gleich mit.
				{ begruendung: 'Prüflauf: geht zum Vollmachtstisch.' }
			);

			/*
			 * **Der Fokus bleibt an der Zeile** (28.08.2026).
			 *
			 * Abgeschickt wurde über eine `Rueckfrage`, und die trug ihre Marke bis
			 * zum 28.08.2026 als `data-marke` aus, während `absenden()` nach
			 * `data-fokus` sucht. Beides sieht im Markup gleich richtig aus, und der
			 * Ausfall ist lautlos: Der Fokus bleibt auf `<body>`, wer mit der
			 * Tastatur arbeitet, tabbt sich durch die ganze Seite zurück, und die
			 * Sprachausgabe sagt nach dem Erfassen nichts. Nichts an der Fachwirkung
			 * ändert sich dabei — kein anderer Schritt hier würde es merken.
			 *
			 * **Auf die Partei geprüft, nicht auf «irgendwo».** «Verlassen» gibt es
			 * nach dem Gehen nicht mehr; der Griff geht dann an eine andere Handlung
			 * derselben Zeile (`hand:` oder `code:`). Nur zu prüfen, dass der Fokus
			 * nicht auf `BODY` steht, wäre auch dann grün, wenn er an der ersten
			 * Zeile der Tabelle landete.
			 */
			/*
			 * **Gewartet, nicht gemessen.** Der Fokusgriff läuft am Ende von
			 * `absenden()`, also nach `update()` (mit einem echten
			 * `invalidateAll()`), nach `tick()` und nach `danach`. `abschicken`
			 * kennt davon nur die Nachladeantwort und legt 120 ms drauf; einmal
			 * langsamer, und die Probe wäre rot ohne Defekt.
			 */
			/*
			 * **Die Spur sagt, wer zu früh war** (21.09.2026). Gemessen wird
			 * nicht nur, wo der Fokus steht, sondern wann die Zielmarke
			 * erscheint und ob ein `focusin` auf sie folgt. Ohne diese
			 * Reihenfolge liesse sich «Griff zu früh» nicht von «Marke fehlt»
			 * unterscheiden.
			 */
			await leitung.evaluate((id) => {
				window.__fokusSpur = [];
				/*
				 * **Eine Uhr für alle drei Spuren** (22.09.2026). Vorher setzte
				 * dieser Block einen eigenen Nullpunkt, der Takt weiter oben
				 * seinen. Zwischen beiden lag die ganze Dauer von `abschicken()`,
				 * also genau die Sekunden, um die es geht. Die Fehlermeldung
				 * stellte die Spuren danach nebeneinander, als lägen sie auf
				 * derselben Uhr, und lud damit zur falschen Reihenfolge ein.
				 */
				const t0 = window.__taktT0 ?? performance.now();
				window.__markeAb = null;
				document.addEventListener(
					'focusin',
					() => {
						const a = document.activeElement;
						window.__fokusSpur.push([
							Math.round(performance.now() - t0),
							a?.getAttribute?.('data-fokus') ?? a?.tagName ?? '?'
						]);
					},
					true
				);
				const suche = () => {
					if (window.__markeAb !== null) return true;
					const el = Array.from(document.querySelectorAll('[data-fokus]')).find((e) =>
						(e.getAttribute('data-fokus') ?? '').endsWith(`:${id}`)
					);
					if (el) window.__markeAb = Math.round(performance.now() - t0);
					return window.__markeAb !== null;
				};
				/*
				 * **Erst nachsehen, dann beobachten.** Ein `MutationObserver`
				 * feuert nur bei der nächsten Änderung. Stand die Marke schon
				 * im Baum oder blieb die Seite danach ruhig, meldete die
				 * Diagnose «Marke erstmals im DOM nach nie ms», während
				 * dieselbe Meldung zwei Felder weiter die gefundene Marke
				 * auswies. Eine Diagnose, die sich selbst widerspricht, ist
				 * schlimmer als keine.
				 */
				suche();
				window.__markeBeobachter = new MutationObserver(suche);
				window.__markeBeobachter.observe(document.body, { childList: true, subtree: true });
			}, christen);
			const start = Date.now();
			let fokus = 'BODY';
			let lage = null;
			/*
			 * **Geduldiger als die Kette** (22.09.2026). Sie fasst rund zehn
			 * Sekunden nach; wartete die Probe nur acht, würde sie im
			 * Lastfall rot, obwohl die Kette den Fokus kurz darauf richtig
			 * gesetzt hätte. Ein Test, der ohne Defekt rot wird, entwertet
			 * jeden Lauf danach, und zwar genau in dem Fall, für den dieser
			 * Schritt gebaut ist.
			 */
			for (const bis = start + 12000; Date.now() < bis; ) {
				lage = await leitung.evaluate((id) => {
					const a = document.activeElement;
					const f = !a || a === document.body ? 'BODY' : (a.getAttribute('data-fokus') ?? a.tagName);
					const alle = Array.from(document.querySelectorAll('[data-fokus]'));
					const treffer = alle.find((e) =>
						(e.getAttribute('data-fokus') ?? '').endsWith(`:${id}`)
					);
					let imBild = null;
					if (treffer) {
						const r = treffer.getBoundingClientRect();
						imBild = r.top >= 0 && r.bottom <= window.innerHeight;
					}
					return { f, treffer: treffer?.getAttribute('data-fokus') ?? null, imBild, anzahl: alle.length };
				}, christen);
				fokus = lage.f;
				if (fokus.endsWith(`:${christen}`)) break;
				await new Promise((f) => setTimeout(f, 100));
			}
			const spur = await leitung.evaluate(() => {
				clearInterval(window.__takt);
				window.__markeBeobachter?.disconnect();
				return {
					markeAb: window.__markeAb,
					spur: window.__fokusSpur,
					takt: window.__fokusTakt
				};
			});
			behaupte(
				fokus.endsWith(`:${christen}`),
				`Nach «Verlassen» steht der Fokus nicht an Christens Zeile, sondern auf «${fokus}». ` +
					`Nach ${Date.now() - start} ms Suche (die Zeiten unten zählen ab ` +
					`Beobachtungsbeginn, also vor dem Absenden): ` +
					`Zielmarke ${lage?.treffer ?? 'fehlt'}, ` +
					`im Bild: ${lage?.imBild}, ${lage?.anzahl} data-fokus-Elemente; ` +
					`Marke spätestens im DOM nach ${spur.markeAb ?? 'nie'} ms; ` +
					`focusin-Spur: ${JSON.stringify(spur.spur)}; ` +
					`Fokusverlauf: ${JSON.stringify(spur.takt)}`
			);

			/*
			 * **Die Begründung steht an der Zeile** (Befund 03.10.2026, Punkt 8).
			 * Gemessen wird der Text der Zeile und nicht die Datenbank: Was die
			 * Leitung eingetragen hat, muss sie am selben Ort wiederfinden.
			 */
			const nachVerlassen = (await zeile.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Grund:\s*Prüflauf: geht zum Vollmachtstisch\./.test(nachVerlassen),
				`Der Verlassensgrund fehlt an der Zeile: ${nachVerlassen.slice(0, 200)}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});

			// Erst wer ausübt, dann für wen — und «für wen» ist eine Mehrfachauswahl
			// mit Suche, weil auf einem Blatt oft mehrere Namen stehen.
			const wer = leitung.locator('select[name="bevollmaechtigt"]');
			behaupte(await wer.count(), 'Keine Auswahl der bevollmächtigten Person');
			// Über den Wert der Auswahl, nicht über die Beschriftung: Sie trägt neben
			// dem Namen noch die Einheiten, und Playwright vergleicht die Beschriftung
			// vollständig.
			const wert = async (feld, name) =>
				feld.locator('option', { hasText: name }).first().getAttribute('value');
			await wer.selectOption(await wert(wer, `Aebi ${LAUF}`));

			/*
			 * **Niemand bevollmächtigt sich selbst** (Auftraggeber, 24.08.2026:
			 * «sicherstellen, dass man sich nicht selbst bevollmächtigen kann, weil
			 * das ja nicht geht»).
			 *
			 * Der Kern weist es seit je ab — die Maske bot es trotzdem an:
			 * Dieselbe Partei stand oben als Bevollmächtigte und unten zum
			 * Ankreuzen. Ein Knopf, der in eine Absage führt. Jetzt ist sie unten
			 * gesperrt, mit Grund; ein gesperrtes Kästchen wird auch nicht
			 * mitgeschickt.
			 */
			const selbst = leitung
				.locator('form.erfassen ul.liste li', { hasText: `Aebi ${LAUF}` })
				.first();
			behaupte(await selbst.count(), 'Die bevollmächtigte Partei fehlt in der Liste');
			behaupte(
				await selbst.locator('input[type="checkbox"]').isDisabled(),
				'Die bevollmächtigte Partei lässt sich selbst ankreuzen'
			);
			// **Genau dieser Grund**, nicht irgendeiner mit dem Wort «selbst» darin:
			// «bereits anwesend — übt selbst aus» enthält es auch, und dann prüfte
			// dieser Schritt eine Sperre, die es vorher schon gab.
			behaupte(
				/niemand bevollmächtigt sich selbst/i.test(
					(await selbst.innerText()).replace(/\s+/g, ' ')
				),
				`Der Grund nennt nicht die Selbstbevollmächtigung: «${(await selbst.innerText()).replace(/\s+/g, ' ')}»`
			);

			const suche = leitung.locator('form.erfassen input[type="search"]');
			behaupte(await suche.count(), 'Keine Suche in der Mehrfachauswahl');
			await suche.fill(`Christen ${LAUF}`);
			const treffer = leitung.locator('form.erfassen input[name="vertritt"]');
			await warteAufTreffer(treffer, 1);
			await treffer.first().check();
			await abschicken(leitung, leitung.locator('form.erfassen button[type="submit"]'));
			await behaupteText(leitung, 'überträgt noch nichts', 'Die Vollmacht wurde nicht erfasst');

			/*
			 * **Ohne Nachweis steht dort kein Knopf mehr** (Bedienbarkeitsprüfung
			 * 05.09.2026, Befund 32): «Ohne vermerkten Nachweis führt ‹Bestätigen›
			 * zwangsläufig zur Absage. Der Knopf steht in seinem einzigen
			 * möglichen Zustand da, um zu scheitern.»
			 *
			 * Bis zum 06.09.2026 war genau diese Absage die Prüfung — der Schritt
			 * drückte den Knopf und las den Absagesatz. Jetzt sagt die Seite es
			 * vorher, und die Schranke im Kern (`verlangeBestaetigbar`) bleibt
			 * dahinter bestehen.
			 */
			/*
			 * **Am Eintrag messen, nicht auf der Seite** (Code-Review 08.09.2026).
			 * Die Zusicherung zählte die «Bestätigen»-Knöpfe seitenweit. Auf einer
			 * Seite mit einer zweiten, bestätigbaren Vollmacht wäre sie grundlos
			 * rot; auf einer leeren Liste grundlos grün. Derselbe Commit hatte auf
			 * `/z` gerade auf den Block der handelnden Partei umgestellt.
			 */
			const eintrag = leitung
				.locator('article.vollmacht', { hasText: `Christen ${LAUF}` })
				.first();
			behaupte(await eintrag.count(), 'Die eben erfasste Vollmacht steht nicht in der Liste');
			behaupte(
				(await eintrag.locator('form[action="?/bestaetigen"] button').count()) === 0,
				'Ohne Nachweis steht weiter ein «Bestätigen»-Knopf da, der nur scheitern kann'
			);
			// Auch dieser Satz gehört an den Eintrag, nicht auf die Seite: Bei einer
			// zweiten Vollmacht ohne Nachweis stünde er sonst dort und hier nicht.
			// Wartend, weil die Liste nach dem Erfassen neu gezeichnet wird.
			const grund = eintrag.locator('p.ohneNachweis');
			await grund.first().waitFor({ timeout: 8000 }).catch(() => {});
			behaupte(
				await grund.count(),
				'Die Vollmacht sagt nicht, warum sie sich nicht bestätigen lässt'
			);

			await abschicken(
				leitung,
				eintrag.locator('form[action="?/vorlegen"] button[type="submit"]').first()
			);
			await abschicken(
				leitung,
				eintrag.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])').first()
			);
			// Die vertretende Person ist schon eingelassen, also zieht die vertretene
			// unmittelbar nach.
			await behaupteText(
				leitung,
				'gilt damit als anwesend',
				'Die vertretene Partei wurde nicht als anwesend geführt'
			);
			return 'Aebi vertritt Christen';
		});

		/*
		 * **Den Nachweis mit dem Telefon fotografieren** (Auftraggeber, 24.08.2026):
		 * «Kann man, wenn man Dokumente hochladen möchte, einen QR-Code
		 * bereitstellen, auf dem der Leiter dann — natürlich angemeldet — das
		 * Dokument fotografieren und zur Person, die sich vertreten lässt,
		 * hochladen kann?»
		 *
		 * Geprüft wird der ganze Weg: der Code auf der breiten Seite, die schmale
		 * Seite dahinter, und dass die Aufnahme wirklich an der Vollmacht hängt.
		 * Der QR trägt nur die Adresse — deshalb wird hier dieselbe angemeldete
		 * Sitzung benutzt, wie es die Sitzungsleitung mit ihrem Telefon täte.
		 */
		await schritt('Der Nachweis lässt sich mit dem Telefon fotografieren', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const weg = leitung.locator('details.telefonweg');
			behaupte(await weg.count(), 'Kein Weg, Nachweise mit dem Telefon zu fotografieren');
			await weg.locator('summary').click();
			const adresse = await weg.locator('.adresse a').getAttribute('href');
			behaupte(
				adresse?.endsWith('/vollmachten/nachweise'),
				`Der Code führt nicht auf die Nachweisseite: ${adresse}`
			);
			behaupte(
				(await weg.locator('svg').count()) > 0,
				'Neben der Adresse steht kein QR-Code'
			);

			// Die schmale Seite — so, wie sie auf dem Telefon aufgeht.
			/*
			 * **Die Adresse im Code ist die öffentliche** (`ORIGIN`), damit der QR
			 * auch von einem Telefon im WLAN führt. Dieser Lauf spricht die
			 * Anwendung aber unter `ZIEL` an, und Kekse gelten je Host: Über die
			 * öffentliche Adresse stünde hier die Anmeldeseite. Geprüft wird
			 * deshalb der **Pfad** des Codes; gegangen wird ihn unter `ZIEL`.
			 */
			const hand = await leitungCtx.newPage();
			await hand.setViewportSize({ width: 390, height: 844 });
			/*
			 * **Die Hydrationswache statt `load` und 800 ms** (08.09.2026). Der
			 * Seitenzähler «2 Seiten gewählt» hängt an einem Ereignis, und das ist
			 * erst nach der Hydration verdrahtet; hier stand dafür eine feste
			 * Frist. Eine Frist ist eine Schätzung: zu kurz wird sie unter Last,
			 * zu lang kostet sie in jedem Lauf. `warteNachNavigation` wartet auf
			 * die Marke, die die Hydration selbst setzt, und sagt bei Ausbleiben,
			 * welche Seite stattdessen dastand.
			 */
			warteNachNavigation(hand);
			await hand.goto(`${ZIEL}${new URL(adresse).pathname}`, {
				waitUntil: 'domcontentloaded'
			});
			// Über den Seitentext, nicht über `h1`: Die Kopfleiste trägt ihre eigene
			// Überschrift, und ein `locator('h1')` mit zwei Treffern liefert nicht
			// die gesuchte.
			const offen = (await hand.locator('body').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Nachweise/.test(offen) && /fotografieren|wählen/.test(offen),
				`Die Nachweisseite öffnet nicht (${adresse}, jetzt ${hand.url()}): ${offen.slice(0, 200)}`
			);
			const eintrag = hand.locator('.liste li').first();
			behaupte(await eintrag.count(), 'Keine Vollmacht auf der Nachweisseite');

			/*
			 * Auf die Antwort warten, nicht auf ein Ladeereignis: Das Formular
			 * schickt beim `change` selbst ab, und `waitForLoadState` kehrt sofort
			 * zurück — die Seite ist ja noch die alte.
			 */
			/*
			 * **Zwei Seiten, nicht eine** (Auftraggeber, 24.08.2026: «Bitte berücksichtigen,
			 * eine Vollmacht kann auch mehrere Seiten enthalten»). Der Regelfall im
			 * Saal sind Vollmacht und Weisung auf getrennten Blättern.
			 */
			await eintrag.locator('input[type="file"]').setInputFiles([
				{ name: 'vollmacht.png', mimeType: 'image/png', buffer: EIN_PIXEL },
				{ name: 'weisung.png', mimeType: 'image/png', buffer: EIN_PIXEL }
			]);
			// Auf die Anzeige warten, nicht sofort messen: Svelte zeichnet nach dem
			// Ereignis neu, und `setInputFiles` kehrt vorher zurück.
			await eintrag
				.locator('.gewaehlt')
				.filter({ hasText: '2 Seiten' })
				.waitFor({ timeout: 5000 })
				.catch(() => {});
			behaupte(
				/2 Seiten gewählt/.test((await eintrag.innerText()).replace(/\s+/g, ' ')),
				`Die Zahl der gewählten Seiten steht nicht da: ${(await eintrag.innerText()).replace(/\s+/g, ' ')}`
			);
			await Promise.all([
				hand.waitForResponse((r) => r.request().method() === 'POST', { timeout: 20000 }),
				eintrag.locator('button[type="submit"]').click()
			]);
			await hand.waitForLoadState('domcontentloaded');
			await hand.waitForTimeout(300);
			const danach = (await hand.locator('body').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/2 Seiten hinterlegt/.test(danach),
				`Die beiden Seiten wurden nicht hinterlegt: ${danach.slice(0, 250)}`
			);
			await hand.close();

			// Und sie hängt an der Vollmacht, nicht irgendwo: Die breite Seite
			// führt sie als Nachweis.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const breit = await text(leitung);
			behaupte(
				/vollmacht\.png/.test(breit) && /weisung\.png/.test(breit),
				'Nicht beide Seiten erscheinen bei der Vollmacht'
			);
			return '2 Seiten fotografiert, hinterlegt, sichtbar';
		});

		/*
		 * **Der Einlass am Eingang, in einem Zug** (Vorschlag des Auftraggebers vom 04.08.2026).
		 *
		 * Christen ist eben gegangen und wieder als vertretbar zu haben; hier
		 * kommt Bucher an den Tisch, ohne Karte, mit dem Blatt in der Hand. Ein
		 * Formular, ein Tipp: eingelassen, Vollmacht erfasst, belegt, bestätigt.
		 */
		await schritt('Einlass mit Vollmacht in einem Zug', async () => {
			// Zuerst die bestehende Vertretung beenden — sonst ist Christen bereits
			// vertreten und steht zu Recht nicht mehr zur Wahl. Damit ist auch das
			// Beenden geprüft.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const beenden = leitung.locator('button', { hasText: 'Vertretung beenden' }).first();
			behaupte(await beenden.count(), 'Kein Weg, eine wirksame Vertretung zu beenden');
			const grund = leitung.locator('form[action="?/widerrufen"] input[name="grund"]');
			// Der Knopf klappt das Formular per Client-Code auf und wirkt erst nach
			// dem Hydrieren. Ein einzelner Klick geht sonst ins Leere — und der
			// Lauf scheitert je nach Tagesform des Dev-Servers.
			await klickeBis(leitung, beenden, grund);
			await grund.fill('Prüflauf: Vollmacht wird am Eingang neu erfasst.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/widerrufen"] button[type="submit"]').first()
			);
			await behaupteText(leitung, 'Vertretung ist beendet', 'Die Vertretung wurde nicht beendet');

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			// Bucher geht kurz hinaus, damit er neu eingelassen werden kann.
			const zeileB = leitung.locator('tr', { hasText: `Bucher ${LAUF}` });
			await abschicken(
				leitung,
				zeileB.first().locator('form[action="?/verlassen"] button[type="submit"]'),
				{ begruendung: 'Prüflauf: geht kurz hinaus.' }
			);

			/*
			 * Kein Warten nötig, und ein Warten wäre hier irreführend (aus dem
			 * Code-Review): Der Aufklapper hängt nicht am `?/verlassen`-Post,
			 * sondern nur an `{#if laufend}` — er steht schon vorher da. Was
			 * wirklich nachläuft, ist Buchers Wählbarkeit in «Wer trifft ein»,
			 * und darauf wartet `warteAufTreffer` weiter unten.
			 */
			const auf = leitung.locator('details.vonhand summary');
			behaupte(await auf.count(), 'Kein Weg, ohne Karte einzulassen');
			await auf.click();

			const formular = leitung.locator('details.vonhand form');
			/*
			 * **«Wer trifft ein» ist seit dem 25.08.2026 eine Wahlliste mit Suche**
			 * (Auftraggeber: «Beim Einlass ‹Ohne Karte einlassen› braucht es noch eine
			 * Suchfunktion … Sonst wird es schwierig bei 50 Einheiten mit 90
			 * Personen»). Vorher stand hier ein `<select>`.
			 *
			 * Dieser Schritt suchte es weiter und lief in einen Zeitablauf — nach
			 * einer Konventionsänderung gehören ALLE Durchstiche mitgezogen, sonst
			 * prüft der Lauf eine Seite, die es nicht mehr gibt.
			 */
			const werListe = formular.locator('label.wer');
			const werSuche = werListe.locator('input[type="search"]');
			behaupte(await werSuche.count(), 'Keine Suche in «Wer trifft ein»');
			await werSuche.fill(`Bucher ${LAUF}`);
			const werTreffer = werListe.locator('input[name="partei"]:not([disabled])');
			await warteAufTreffer(werTreffer, 1);
			await werTreffer.first().check();

			// Die Vollmachtswahl ist zugeklappt — der Regelfall bleibt ein Tipp.
			const vollmachtsblock = formular.locator('.wahl');
			const umschalter = vollmachtsblock.locator('input[type="checkbox"]').first();
			await umschalter.check();
			// Auf den Vollmachtsblock eingegrenzt: Seit «Wer trifft ein» eine
			// Wahlliste ist, trägt das Formular zwei Suchfelder.
			const suchfeld = vollmachtsblock.locator('input[type="search"]');
			behaupte(await suchfeld.count(), 'Keine Suche in der Vertretungswahl');
			/*
			 * **Wer nicht gewählt werden kann, steht trotzdem da — mit Grund.**
			 * Aebi ist im Saal; die Zeile muss erscheinen, gesperrt sein und sagen,
			 * warum. Sie wegzulassen liesse die Sitzungsleitung im Saal rätseln, ob
			 * sie sich vertippt hat.
			 */
			await suchfeld.fill(`Aebi ${LAUF}`);
			const gesperrt = vollmachtsblock.locator('li.gesperrt', { hasText: `Aebi ${LAUF}` });
			await gesperrt.first().waitFor({ state: 'visible', timeout: 5000 });
			await behaupteText(leitung, 'bereits anwesend', 'Der Sperrgrund fehlt in der Auswahl');
			behaupte(
				await gesperrt.first().locator('input[name="vertritt"]').isDisabled(),
				'Eine bereits anwesende Partei lässt sich als bevollmächtigend wählen'
			);

			await suchfeld.fill(`Christen ${LAUF}`);
			const treffer = vollmachtsblock.locator('input[name="vertritt"]:not([disabled])');
			await warteAufTreffer(treffer, 1);
			await treffer.first().check();

			await abschicken(leitung, formular.locator('button[type="submit"]'));
			await behaupteText(
				leitung,
				'Mit Vollmacht für',
				'Der Einlass erfasste die Vollmacht nicht mit'
			);
			return 'Bucher eingelassen, Vollmacht für Christen bestätigt';
		});

		/*
		 * **Eine dritte Person am Eingang** (Frage des Auftraggebers vom 04.08.2026).
		 *
		 * Sie ist keine Eigentümerin: keine Karte, kein Code, kein Eintrag in der
		 * Momentaufnahme. Geprüft wird beides — dass das Beenden der bisherigen
		 * Vertretung die Anwesenheit mitnimmt, und dass die dritte Person die
		 * vertretene Partei wieder hereinbringt, ohne selbst Partei zu sein.
		 */
		await schritt('Dritte Person übt eine Vollmacht aus', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const beenden = leitung.locator('button', { hasText: 'Vertretung beenden' }).first();
			behaupte(await beenden.count(), 'Keine wirksame Vertretung zum Beenden');
			const grund = leitung.locator('form[action="?/widerrufen"] input[name="grund"]');
			// Der Knopf klappt das Formular per Client-Code auf und wirkt erst nach
			// dem Hydrieren. Ein einzelner Klick geht sonst ins Leere — und der
			// Lauf scheitert je nach Tagesform des Dev-Servers.
			await klickeBis(leitung, beenden, grund);
			await grund.fill('Prüflauf: eine dritte Person übernimmt.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/widerrufen"] button[type="submit"]').first()
			);

			// Die Anwesenheit muss mitgegangen sein — sie beruhte allein auf der
			// Vertretung. Blieb sie stehen, rechnete die Beschlussfähigkeit eine
			// Partei mit, deren Stimme niemand ausübt.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			const zeileC = leitung.locator('tr', { hasText: `Christen ${LAUF}` });
			const standC = (await zeileC.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/gegangen|nicht erschienen/i.test(standC),
				`Die beendete Vertretung liess die Anwesenheit stehen: ${standC.slice(0, 120)}`
			);

			const auf = leitung.locator('details.dritte summary');
			behaupte(await auf.count(), 'Kein Weg für eine dritte Person');
			await auf.click();
			const formular = leitung.locator('details.dritte form');
			await formular.locator('input[name="bevollmaechtigtName"]').fill(`Ruth Kunz ${LAUF}`);
			await formular.locator('input[type="search"]').fill(`Christen ${LAUF}`);
			const treffer = formular.locator('input[name="vertritt"]');
			await warteAufTreffer(treffer, 1);
			await treffer.first().check();
			await abschicken(leitung, formular.locator('button[type="submit"]'));

			await behaupteText(
				leitung,
				`Ruth Kunz ${LAUF} vertritt Christen`,
				'Die dritte Person wurde nicht als Vertreterin geführt'
			);
			return 'Ruth Kunz vertritt Christen';
		});

		/*
		 * **Die Vollmacht geht an ein Telefon** (Fall des Auftraggebers vom 04.08.2026): «Wenn
		 * ein Bevollmächtigter auch Eigentümer ist, kann dieser bei dem
		 * aufgeschalteten Traktandum beide oder alle abstimmen.» Dafür muss die
		 * Vollmacht auf eine Partei lauten, die selbst ein Gerät hat.
		 */
		await schritt('Die Vollmacht wechselt auf ein Telefon', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/vollmachten`, {
				waitUntil: 'domcontentloaded'
			});
			const beenden = leitung.locator('button', { hasText: 'Vertretung beenden' }).first();
			behaupte(await beenden.count(), 'Keine wirksame Vertretung zum Beenden');
			const grund = leitung.locator('form[action="?/widerrufen"] input[name="grund"]');
			// Der Knopf klappt das Formular per Client-Code auf und wirkt erst nach
			// dem Hydrieren. Ein einzelner Klick geht sonst ins Leere — und der
			// Lauf scheitert je nach Tagesform des Dev-Servers.
			await klickeBis(leitung, beenden, grund);
			await grund.fill('Prüflauf: die Vollmacht geht an einen Eigentümer mit Gerät.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/widerrufen"] button[type="submit"]').first()
			);

			const wer = leitung.locator('select[name="bevollmaechtigt"]');
			await wer.selectOption(
				await wer.locator('option', { hasText: `Bucher ${LAUF}` }).first().getAttribute('value')
			);
			const suche = leitung.locator('form.erfassen input[type="search"]');
			await suche.fill(`Christen ${LAUF}`);
			const treffer = leitung.locator('form.erfassen input[name="vertritt"]:not([disabled])');
			await warteAufTreffer(treffer, 1);
			await treffer.first().check();
			await abschicken(leitung, leitung.locator('form.erfassen button[type="submit"]'));

			await abschicken(
				leitung,
				leitung.locator('form[action="?/vorlegen"] button[type="submit"]').first()
			);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])').first()
			);
			await behaupteText(leitung, 'gilt damit als anwesend', 'Christen zog nicht nach');
			return `Bucher ${LAUF} bevollmächtigt für Christen`;
		});

		await schritt('Die Anwesenheitsliste nennt die Vertretung', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				'vertreten durch',
				'Die Anwesenheitsliste verschweigt, dass eine Partei vertreten wird'
			);
			await behaupteText(leitung, 'durch Vertretung', 'Der Erfassungsweg fehlt in der Liste');
		});

		await schritt('Traktandum aufrufen', async () => {
			// Erst der Aufruf, dann die Abstimmung: Ohne aufgerufenes Traktandum
			// wüsste niemand im Saal, worüber gerade abgestimmt wird.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			// Je Traktandum ein eigenes Formular mit versteckter Kennung — getroffen
			// wird deshalb über die Kennung, nicht über eine Position.
			const knopf = leitung.locator(
				`form[action="?/aufrufen"]:has(input[value="${traktandumId}"]) button[type="submit"]`
			);
			behaupte(await knopf.count(), 'Kein Knopf zum Aufrufen des Traktandums');
			await abschicken(leitung, knopf.first());
			await behaupteText(leitung, 'Fassadensanierung', 'Das Traktandum wurde nicht aufgerufen');

			/*
			 * **Das aktuelle Geschaeft bleibt beim Rollen im Blick** (Auftraggeber,
			 * 01.09.2026: «Bitte pruefen bei Versammlung leiten bei einer
			 * Einzelversammlung»).
			 *
			 * Gemessen war der Ablauf links 2920 px hoch, das Geschaeft rechts 388
			 * — daneben standen zweieinhalb Bildschirmhoehen Leere, und wer durch
			 * elf Traktanden rollte, verlor den Kasten nach oben aus dem Bild.
			 * Seither klebt er. Ohne `position: sticky` steht er nach 1500 px
			 * Rollen bei -1126 px, also ganz ausserhalb — so gemessen.
			 *
			 * Nur in der breiten Ansicht: Darunter stehen die beiden untereinander,
			 * und dann gibt es weder Luecke noch etwas zu halten.
			 */
			const vorher = leitung.viewportSize();
			await leitung.setViewportSize({ width: 1440, height: 900 });
			await leitung.evaluate(() => window.scrollTo(0, 1500));
			await leitung.waitForTimeout(400);
			const gemessen = await leitung.evaluate(() => {
				const g = document.querySelector('.geschaeft');
				if (!g) return null;
				const b = g.getBoundingClientRect();
				// Unter der klebenden Kopfleiste ist nichts zu sehen: Was dort steht,
				// zaehlt nicht als sichtbar.
				const kopf = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
				return {
					gerollt: Math.round(window.scrollY),
					hoehe: Math.round(b.height),
					oben: Math.round(b.top),
					sichtbar: Math.round(
						Math.max(0, Math.min(b.bottom, window.innerHeight) - Math.max(b.top, kopf))
					)
				};
			});

			/*
			 * **Erst behaupten, dann zuruecksetzen** (01.09.2026, aus dem
			 * Code-Review). Umgekehrt zeigte das Beweisbild aus `schritt()` die
			 * Seite in ihrer Ausgangsgroesse bei Rollstand 0 — also genau nicht
			 * den Zustand, an dem die Behauptung scheiterte.
			 */
			behaupte(gemessen, 'Auf der Sitzungsleitung steht kein aktuelles Geschaeft');
			/*
			 * **Der Rollstand gehoert mitgeprueft.** `scrollTo` deckelt still: Ist
			 * die Seite kuerzer als Fenster plus 1500 px, bleibt der Kasten ohnehin
			 * im Bild, und der Schritt waere gruen, auch wenn das Kleben ganz
			 * fehlte. Genau die Sichtprobe, die diese Datei an zwei anderen Stellen
			 * ausdruecklich verlangt.
			 */
			behaupte(
				gemessen.gerollt > 1000,
				`Die Seite liess sich nur ${gemessen.gerollt} px rollen — zu kurz, um das Kleben zu pruefen`
			);
			// Fast vollstaendig sichtbar, nicht bloss angeschnitten: Ein falscher
			// `top`-Wert liesse sonst ein Viertel des Kastens genuegen.
			behaupte(
				gemessen.sichtbar >= gemessen.hoehe - 8,
				`Nach ${gemessen.gerollt} px Rollen sind vom aktuellen Geschaeft ${gemessen.sichtbar} ` +
					`von ${gemessen.hoehe} px zu sehen (Oberkante ${gemessen.oben})`
			);

			await leitung.evaluate(() => window.scrollTo(0, 0));
			if (vorher) await leitung.setViewportSize(vorher);
			return `Geschaeft bleibt beim Rollen ganz sichtbar (${gemessen.sichtbar} von ${gemessen.hoehe} px)`;
		});
		/**
		 * **Die Handlungen stehen bei ihrem Geschäft, nicht in der Ablaufspalte**
		 * (Bedienbarkeitsprüfung 05.09.2026, Befund 10 der Bewirtschaftersicht;
		 * Produktentscheid 07.09.2026: «Rechts ist gut»).
		 *
		 * Bis dahin stand «Jetzt möglich» links in der Ablaufkarte, während der
		 * Name des Geschäfts rechts stand. Der Prüfer suchte rechts, und die
		 * Abendsicht (`tage/[id=kennung]/leitung`) ordnet es dort schon an.
		 *
		 * **Warum die Lage gemessen wird und nicht der Aufbau.** Ein Wächter über
		 * die Datei sähe nur, unter welchem Abschnitt `<Eingriffe>` steht. Wo der
		 * Abschnitt dann landet, entscheidet das Raster im Stilteil. Die
		 * Kastenmasse beantworten beides in einem Zug.
		 */
		await schritt('«Jetzt möglich» steht in der Spalte des aktuellen Geschäfts', async () => {
			const lage = await leitung.evaluate(() => {
				const masse = (wahl) => {
					const knoten = document.querySelector(wahl);
					if (!knoten) return null;
					const kasten = knoten.getBoundingClientRect();
					return { links: Math.round(kasten.left), rechts: Math.round(kasten.right) };
				};
				return {
					anzahl: document.querySelectorAll('.eingriffe').length,
					eingriffe: masse('.eingriffe'),
					geschaeft: masse('section.geschaeft'),
					ablauf: masse('section.ablauf')
				};
			});
			behaupte(lage.eingriffe, 'Beim aufgerufenen Traktandum steht kein «Jetzt möglich»');
			/*
			 * **Genau einer, sonst misst `querySelector` den falschen.** Gäbe es
			 * den Kasten zweimal, griffe die Messung den ersten im Dokument und
			 * schwiege über den zweiten (Code-Review 07.09.2026).
			 */
			behaupte(
				lage.anzahl === 1,
				`«Jetzt möglich» steht ${lage.anzahl}× auf der Seite — gemessen wird nur der erste`
			);
			behaupte(lage.geschaeft && lage.ablauf, 'Der Leitungssicht fehlt eine der beiden Spalten');
			/*
			 * **Erst prüfen, ob überhaupt nebeneinander steht.** Zwei Spalten gibt
			 * es erst ab 60rem; darunter stehen sie untereinander, und dann läge
			 * jeder Kasten in der Waagrechten über jedem anderen. Der Schritt wäre
			 * grün, ohne etwas gemessen zu haben.
			 *
			 * **Und die Breite gehört mitgeprüft** (Code-Review 07.09.2026): Bei
			 * offener Abstimmung trägt `.raster` die Klasse `eingeengt` und
			 * `.ablauf` ein `display: none`. Der Knoten ist dann da,
			 * `getBoundingClientRect()` liefert lauter Nullen, und ein Vergleich
			 * gegen `rechts` wäre gegen 0 immer wahr.
			 */
			behaupte(
				lage.ablauf.rechts > lage.ablauf.links,
				'Die Ablaufspalte ist ausgeblendet — in dieser Lage misst der Schritt nichts'
			);
			behaupte(
				lage.geschaeft.links >= lage.ablauf.rechts,
				`Die Sicht steht einspaltig (Ablauf bis ${lage.ablauf.rechts} px, ` +
					`Geschäft ab ${lage.geschaeft.links} px) — so misst dieser Schritt nichts`
			);
			behaupte(
				lage.eingriffe.links >= lage.geschaeft.links &&
					lage.eingriffe.rechts <= lage.geschaeft.rechts,
				`«Jetzt möglich» liegt bei ${lage.eingriffe.links}..${lage.eingriffe.rechts} px, ` +
					`das aktuelle Geschäft bei ${lage.geschaeft.links}..${lage.geschaeft.rechts} px`
			);
			/*
			 * **Und schmal: vor dem Ablauf, nicht dahinter** (Code-Review
			 * 07.09.2026). Unter 60rem steht alles untereinander, und im Baum
			 * kommt `section.ablauf` zuerst — mit der ganzen Traktandenliste
			 * darin. Ohne `order` läge der Arbeitsblock dahinter, und wer im
			 * Saal am Telefon ein Votum schreibt, rollte erst durch elf
			 * Traktanden. Gemessen bei 390 px: Geschäft bei 1156 px,
			 * «Jetzt möglich» bei 1582, Ablauf erst bei 1890.
			 */
			const breit = leitung.viewportSize();
			await leitung.setViewportSize({ width: 390, height: 844 });
			await leitung.waitForTimeout(300);
			const schmal = await leitung.evaluate(() => {
				const oben = (wahl) => {
					const knoten = document.querySelector(wahl);
					return knoten
						? Math.round(knoten.getBoundingClientRect().top + window.scrollY)
						: null;
				};
				return {
					breite: window.innerWidth,
					ablauf: oben('section.ablauf'),
					geschaeft: oben('section.geschaeft'),
					eingriffe: oben('.eingriffe')
				};
			});
			if (breit) await leitung.setViewportSize(breit);
			behaupte(
				schmal.ablauf !== null && schmal.geschaeft !== null && schmal.eingriffe !== null,
				'Auf 390 px fehlt einer der beiden Abschnitte'
			);
			behaupte(
				schmal.geschaeft < schmal.ablauf,
				`Auf ${schmal.breite} px steht der Ablauf bei ${schmal.ablauf} px vor dem Geschäft ` +
					`bei ${schmal.geschaeft} px — der Arbeitsblock läge hinter der ganzen Liste`
			);

			return (
				`«Jetzt möglich» ab ${lage.eingriffe.links} px, Geschäft ab ${lage.geschaeft.links} px; ` +
				`schmal vor dem Ablauf (${schmal.geschaeft} vor ${schmal.ablauf} px)`
			);
		});

		/**
		 * **Zwei Ausstände nacheinander am selben Traktandum.**
		 *
		 * Der Ausstand war bis zum 28.08.2026 gar nicht im Drehbuch, und genau
		 * dort schlug der Umzug auf `absenden()` zu: `Wahlliste` führt die
		 * Auswahl in eigenem `$state`, den `form.reset()` nicht erreicht. Ohne
		 * den Griff in `beiErfolg` bliebe die erste Partei angekreuzt, fiele
		 * aber aus der Liste heraus und ginge als verborgenes Feld weiter mit —
		 * der **zweite** Ausstand scheiterte dann dauerhaft am Server.
		 *
		 * Der Schritt nimmt beide wieder zurück: Die Beschlussfähigkeit hängt
		 * an ihnen, und die folgenden Etappen rechnen mit dem Stand von vorher.
		 */
		await schritt('Zwei Ausstände nacheinander, dann beide zurück', async () => {
			const oeffneAusstand = async () => {
				const wort = leitung.locator('.eingriffe button.wort', { hasText: 'Ausstand' });
				behaupte(await wort.count(), 'Kein Weg zum Ausstand am aufgerufenen Traktandum');
				const formular = leitung.locator('form[action="?/ausstand"]');
				await klickeBis(leitung, wort.first(), formular);

				/*
				 * **Der Absendeknopf muss erreichbar sein** (Code-Review
				 * 07.09.2026). Seit der Arbeitsblock in der rechten Spalte steht,
				 * klappen hier Formulare in einen Kasten auf, der klebt. Gemessen
				 * bei 1440×900 ohne Deckel: Der Kasten war 1158 px hoch, der Knopf
				 * lag bei 1100 px, und beim Rollen auf 300, 800 und 1500 px blieb
				 * er unverändert dort — sichtbar wurde er erst am Seitenende.
				 *
				 * `max-height` und `overflow-y` am klebenden Kasten fangen das ab.
				 * Diese Behauptung ist ihr Nachweis: Ohne sie bringt
				 * `scrollIntoViewIfNeeded` den Knopf nicht ins Bild.
				 */
				const absendeknopf = formular.locator('button[type="submit"]').first();
				await absendeknopf.scrollIntoViewIfNeeded();
				const erreichbar = await leitung.evaluate(() => {
					const k = document.querySelector('form[action="?/ausstand"] button[type="submit"]');
					if (!k) return null;
					const b = k.getBoundingClientRect();
					const kopf = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
					return {
						oben: Math.round(b.top),
						unten: Math.round(b.bottom),
						fenster: window.innerHeight,
						kopf: Math.round(kopf),
						sichtbar: b.top >= kopf && b.bottom <= window.innerHeight
					};
				});
				behaupte(erreichbar, 'Das Ausstandsformular hat keinen Absendeknopf');
				behaupte(
					erreichbar.sichtbar,
					`Der Knopf «Ausstand erklären» liegt bei ${erreichbar.oben}..${erreichbar.unten} px, ` +
						`sichtbar ist ${erreichbar.kopf}..${erreichbar.fenster} px`
				);
				return formular;
			};

			const erklaere = async (welche) => {
				const formular = await oeffneAusstand();
				const treffer = formular.locator('label', { hasText: welche });
				await treffer.first().click();
				await fuelle(leitung, 'form[action="?/ausstand"] input[name="grund"]', 'Eigene Firma');
				await abschicken(leitung, formular.locator('button[type="submit"]').first());
			};

			await erklaere('Aebi');
			await behaupteText(leitung, 'Aebi', 'Der erste Ausstand steht nicht in der Liste');

			/*
			 * **Der eigentliche Befund.** Scheitert er, meldet der Server «für
			 * diese Partei ist bereits ein Ausstand erklärt» — dann ging die
			 * erste Partei als verborgenes Feld nochmals mit.
			 */
			await erklaere('Bucher');

			const zurueck = leitung.locator('form[action="?/ausstandZurueck"]');
			const wieviele = await zurueck.count();
			behaupte(
				wieviele === 2,
				`Nach zwei Ausständen stehen ${wieviele} in der Liste — der zweite kam nicht an`
			);

			// Den Stand hinterlassen, wie er vorgefunden wurde.
			for (let i = 0; i < 2; i += 1) {
				await abschicken(
					leitung,
					leitung.locator('form[action="?/ausstandZurueck"] button[type="submit"]').first()
				);
			}
			const rest = await leitung.locator('form[action="?/ausstandZurueck"]').count();
			behaupte(rest === 0, `Nach dem Zurücknehmen stehen noch ${rest} Ausstände`);

			/*
			 * **Und der Kasten hängt am Geschäft, nicht an der Seite**
			 * (28.08.2026). Seit «Aufrufen» über `absenden()` schickt, lädt die
			 * Seite dabei nicht mehr neu — `Eingriffe` überlebte den Wechsel mit
			 * aufgeklapptem Ausstandskasten und der Auswahl vom vorigen
			 * Traktandum, während das verborgene `traktandum`-Feld darin schon
			 * auf das neue zeigte. Ein Klick hätte den Ausstand am falschen
			 * Geschäft erklärt, und im Saal sieht das niemand.
			 *
			 * Geprüft wird das Sichtbare: Der Kasten muss nach dem Wechsel zu
			 * sein. Ohne den `{#key}` steht er offen.
			 */
			await oeffneAusstand();
			// Irgendein anderes Traktandum: Die Kennung wird aus der Liste gelesen,
			// nicht angenommen — welche Punkte die Vorlage setzt, ist ihre Sache.
			const andereKennung = await leitung.evaluate((jetzt) => {
				for (const f of document.querySelectorAll('form[action="?/aufrufen"]')) {
					const feld = f.querySelector('input[name="traktandum"]');
					const wert = feld instanceof HTMLInputElement ? feld.value : '';
					if (wert && wert !== jetzt) return wert;
				}
				return '';
			}, traktandumId);
			const anderes = leitung.locator(
				`form[action="?/aufrufen"]:has(input[value="${andereKennung}"]) button[type="submit"]`
			);
			if (andereKennung && (await anderes.count())) {
				await abschicken(leitung, anderes.first());
				const nochOffen = await leitung.locator('form[action="?/ausstand"]').count();
				behaupte(
					nochOffen === 0,
					'Der Ausstandskasten steht nach dem Geschäftswechsel noch offen — mit der Auswahl des vorigen Traktandums'
				);
				// Den Stand hinterlassen, wie er vorgefunden wurde.
				const zurueckZum = leitung.locator(
					`form[action="?/aufrufen"]:has(input[value="${traktandumId}"]) button[type="submit"]`
				);
				if (await zurueckZum.count()) await abschicken(leitung, zurueckZum.first());
			}
			return 'zwei erklärt, beide zurückgenommen, Kasten hängt am Geschäft';
		});

		await schritt('Die Leitung sieht, ob beschlossen werden darf', async () => {
			/*
			 * **Auftraggeber, 23.08.2026**: «Beim Standardtraktandum Begrüssung und
			 * Feststellung der Beschlussfähigkeit fehlt in der Sicht ‹Aktuelles
			 * Geschäft› die Sicht, ob wir wirklich beschlussfähig sind.»
			 *
			 * Oben stand eine Zahl («5 von 5 anwesend»), aus der jeder selbst
			 * schliessen musste. Geprüft wird die Feststellung, nicht die Zahl.
			 */
			const geschaeft = leitung.locator('section.geschaeft');
			const text = await geschaeft.innerText();
			behaupte(
				/beschlussfähig/i.test(text),
				`Im aktuellen Geschäft steht nichts zur Beschlussfähigkeit: ${text.slice(0, 300)}`
			);
			return text.split('\n').find((z) => /beschlussfähig/i.test(z))?.slice(0, 60) ?? 'steht';
		});

		await schritt('Abstimmung eröffnen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const knopf = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Eröffnen der Abstimmung');

			/*
			 * **Der Klick bestätigt die Zuordnung** (Ä-05, nur der Kern; Auftrag
			 * M4). Über dem Knopf stehen Geschäftsart, Mehrheit, Ausstand und Anwesende,
			 * und das Formular trägt die Marke, die der Server beim Freigeben
			 * vergleicht. Der Eintrag im Verlauf wird im nächsten Schritt gemessen.
			 */
			const hauptformular = leitung.locator('form[action="?/oeffnen"]:has(button.haupt)');
			const satz = await hauptformular.locator('p[data-zuordnung]').innerText();
			behaupte(
				/Mit «Abstimmung freigeben» bestätigen Sie: (Geschäftsart «.+», )?nötige Mehrheit «.+»; im Ausstand .+; anwesend oder vertreten \d+ von \d+ Parteien\./.test(
					satz
				),
				`Über dem Knopf steht nicht die Zuordnung: «${satz}»`
			);
			behaupte(
				(await hauptformular.locator('input[name="zuordnung"]').count()) === 1,
				'Das Formular trägt keine Marke der Zuordnung'
			);

			/*
			 * **Der Sprungnachweis für die Sitzungsleitungssicht** (28.08.2026).
			 * Sie ist die längste Seite der Anwendung, und «Abstimmung freigeben»
			 * steht weit unten — im Saal, während alle zusehen. Ohne die
			 * `use:enhance`-Zeile am `?/oeffnen`-Formular lädt sie neu und steht
			 * wieder bei 0.
			 *
			 * Erst hinrollen: Stünde die Seite schon bei 0, wäre «vorher gleich
			 * nachher» auch im springenden Zustand erfüllt.
			 *
			 * **Ein Vorbehalt, gemessen am 28.08.2026:** Mit der Freigabe engt die
			 * Seite ihr Raster ein und blendet den Ablauf aus, wird also kürzer.
			 * Der Browser klemmt den Rollstand dann an das neue Ende.
			 *
			 * **Und genau das ist am 09.09.2026 eingetreten** — vorhergesagt vom
			 * Absatz, der hier stand: «Wird die Sicht einmal kürzer, misst dieser
			 * Schritt das Einengen und nicht mehr den Sprung.» Mit den Pendenzen
			 * unter dem Votum verschwindet beim Eröffnen mehr als zuvor; gemessen
			 * 691 px vorher, 563 px nachher, und der Schritt meldete einen Sprung,
			 * wo der Browser bloss geklemmt hatte.
			 *
			 * **Klemmen ist kein Sprung, und beide sind unterscheidbar.** Geklemmt
			 * heisst: Der Rollstand steht am neuen Ende der Seite. Gesprungen
			 * heisst: Er steht irgendwo anders, im Regelfall bei 0. Die Probe
			 * fragt deshalb nach dem Ende statt nach einer festen Toleranz — und
			 * sie sagt es, wenn die Seite so kurz geworden ist, dass sich beides
			 * nicht mehr trennen lässt (Ende bei 0). Dann ist der Schritt nicht
			 * grün, sondern blind, und das gehört gemeldet.
			 */
			await knopf.first().scrollIntoViewIfNeeded();
			const vorOeffnen = await leitung.evaluate(() => window.scrollY);
			behaupte(
				vorOeffnen > 0,
				`Die Seite steht schon bei 0 — so misst der Schritt den Sprung nicht (${vorOeffnen} px)`
			);
			await abschicken(leitung, knopf.first());
			const { stand: nachOeffnen, ende } = await leitung.evaluate(() => ({
				stand: window.scrollY,
				ende: Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
			}));
			/*
			 * **Die Schwelle ist die Toleranz, nicht null** (Code-Review
			 * 09.09.2026). Mit `ende > 0` wäre bei einem Seitenende von 1 px jeder
			 * Rollstand «geklemmt» — auch ein Sprung auf 0, denn der liegt dann
			 * innerhalb der zwei Pixel Spielraum. Unterscheidbar sind die beiden
			 * Fälle erst, wenn das Ende weiter von 0 entfernt ist als die
			 * Toleranz, mit der «geblieben» gemessen wird.
			 */
			behaupte(
				ende > 40,
				`Die Seite ist nach dem Freigeben fast nicht mehr rollbar (Ende bei ${ende} px) — ` +
					'so lässt sich Klemmen nicht mehr von einem Sprung unterscheiden'
			);
			const geblieben = Math.abs(nachOeffnen - vorOeffnen) < 40;
			const geklemmt = nachOeffnen >= ende - 2;
			behaupte(
				geblieben || geklemmt,
				`Das Freigeben liess die Seite von ${vorOeffnen} px auf ${nachOeffnen} px springen ` +
					`(Ende der Seite bei ${ende} px — geklemmt wäre sie dort)`
			);

			await behaupteText(leitung, 'Abstimmung', 'Nach dem Eröffnen keine Abstimmung sichtbar');
		});

		await schritt('Die Freigabe steht als bestätigte Zuordnung im Verlauf', async () => {
			await leitung.goto(`${ZIEL}/verlauf?gegenstand=${versammlungId}`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('tr:has-text("Abstimmung eröffnet")').first();
			const text = await zeile.innerText();
			behaupte(
				/Zuordnung von der Leitung bestätigt/.test(text) && /Anwesend: \d+ von \d+ Parteien/.test(text),
				`Der Eröffnungseintrag nennt die bestätigte Zuordnung nicht: «${text.slice(0, 400)}»`
			);
			// Zurück auf die Leitung: Der nächste Schritt erwartet sie.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			return text.match(/Zuordnung von der Leitung bestätigt[^\n]*/)?.[0]?.slice(0, 120) ?? '';
		});

		await schritt('Beamer zeigt die Frage, aber kein Ergebnis', async () => {
			aktuelleSeite = beamer;
			await beamer.reload({ waitUntil: 'domcontentloaded' });
			await behaupteText(beamer, 'Fassadensanierung', 'Der Beamer zeigt das Traktandum nicht');
			// Das ist der Kern von FR-37: Solange offen ist, darf nirgends eine
			// Verteilung stehen.
			await behaupteOhne(
				beamer,
				/\bangenommen\b|\babgelehnt\b/i,
				'Der Beamer verrät ein Ergebnis, obwohl die Abstimmung offen ist'
			);
			aktuelleSeite = leitung;
		});

		await schritt('Die Wahlknöpfe im Saal sind lesbar', async () => {
			/*
			 * **Der Befund vom 01.09.2026** (Code-Review). `.wahl .nein` trug
			 * `background: var(--fehler)` ohne Gegenfarbe und erbte damit `--text`:
			 * Kontrast 2.14 im hellen und 2.16 im dunklen Thema. Das Wort «Nein»
			 * war auf dem Knopf praktisch nicht zu lesen — auf dem Gerät, mit dem
			 * im Saal abgestimmt wird.
			 *
			 * **Warum hier und nicht im Quellwächter.** Beide Farben sind saubere
			 * Token; `scripts/check-themenfarben.mjs` kann das nicht sehen. Und
			 * `e2e/themenkontrast.mjs` kommt nicht her: Die Knöpfe stehen erst da,
			 * wenn eine Abstimmung offen ist. Also wird an der Stelle gemessen, an
			 * der sie stehen, mit demselben Baustein.
			 */
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			const { gemessen, treffer } = await messeKontrast(telefon, 3.0, '.wahl button');
			behaupte(
				gemessen >= 3,
				`Nur ${gemessen} Wahlknöpfe gemessen — der Schritt prüft nichts`
			);
			behaupte(
				treffer.length === 0,
				`Wahlknopf zu kontrastarm: ${treffer
					.map((t) => `${t.wie} ${t.wert} («${t.text}»)`)
					.join(' · ')}`
			);
			/*
			 * **Die Werte gehören in die Meldung**, nicht nur das Urteil: Wer
			 * später etwas an den Knopffarben ändert, sieht am Zahlenwert, wie
			 * viel Luft noch da war. Heute sind es 8.15 am «Nein».
			 */
			const alle = await messeKontrast(telefon, 21, '.wahl button');
			return `${gemessen} Knöpfe: ${alle.treffer
				.map((t) => `${t.text} ${t.wert}`)
				.join(' · ')}`;
		});

		/*
		 * **Die Einordnung überlebt die Pause** (06.09.2026, an einem selbst
		 * gebauten Fehler gemessen).
		 *
		 * Seit die Einordnung «wo stehen wir» bei laufender Abstimmung unter die
		 * Frage wandert, hängt sie an zwei Bedingungen, die zusammenpassen
		 * müssen: oben steht sie, solange **nicht** abgestimmt wird, unten im
		 * Abstimmungsteil. Die Pause steht in der Verzweigung davor und gewinnt
		 * — bei einer Unterbrechung während offener Abstimmung wurde der
		 * Abstimmungsteil also gar nicht gerendert, während die obere Bedingung
		 * ihn für gerendert hielt. Die Einordnung fiel zwischen beide.
		 *
		 * Der Zustand ist kein Sonderfall: «Pause würde auch eine Abstimmung
		 * unterbrechen, wenn diese bspw. ungeplant ist» (Auftraggeber, 21.08.2026,
		 * Migration 073). Der Durchgang bleibt offen, gesperrt ist nur das
		 * Weiterstimmen.
		 */
		await schritt('In der Pause bleibt die Einordnung stehen', async () => {
			aktuelleSeite = leitung;
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			/*
			 * Der Knopf heisst bei offener Abstimmung **«Abstimmung unterbrechen»**
			 * (`Pausenschalter.svelte`), nicht «Pause»: Was hier unterbrochen wird,
			 * ist keine Kaffeepause. Der Notweg auf derselben Seite trägt eine
			 * andere Beschriftung, steht aber nur, wenn ein Abend läuft.
			 */
			const einlegen = leitung.locator('form[action="?/pause"] button', {
				hasText: /Abstimmung unterbrechen|^Pause$/
			});
			behaupte(await einlegen.count(), 'Kein Weg, die Abstimmung zu unterbrechen');
			await einlegen.first().scrollIntoViewIfNeeded();
			await abschicken(leitung, einlegen.first());

			/*
			 * **Erst belegen, dass die Pause wirkt.** Ohne diese Zeile wäre der
			 * Schritt zahnlos: Käme die Unterbrechung gar nicht zustande, stünde
			 * die Einordnung ebenfalls einmal da, und der Schritt meldete grün,
			 * ohne den Zustand je hergestellt zu haben.
			 */
			const fortfahren = leitung.locator('form[action="?/pause"] button', {
				hasText: 'Fortfahren'
			});
			await fortfahren.first().waitFor({ state: 'visible', timeout: 15000 });

			/*
			 * **Das Zurückstellen gehört in ein `finally`** (Code-Review
			 * 06.09.2026). Der Kommentar sagte «erst zurückstellen, dann urteilen»,
			 * die Prüfung auf die Unterbrechung stand aber davor und wirft. Bräche
			 * sie, bliebe die Versammlung für alle folgenden Etappen unterbrochen —
			 * ein einzelner Befund risse dann zwanzig weitere mit.
			 */
			let inPause = -1;
			try {
				aktuelleSeite = telefon;
				await gehe(telefon, '/z');
				await behaupteText(
					telefon,
					/unterbrochen|Pause/i,
					'Die Eigentümerseite zeigt die Unterbrechung nicht — der Zustand ist nicht hergestellt'
				);
				inPause = await telefon.locator('.dreischritt').count();
			} finally {
				aktuelleSeite = leitung;
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
					waitUntil: 'domcontentloaded'
				});
				const beenden = leitung.locator('form[action="?/pause"] button', {
					hasText: 'Fortfahren'
				});
				behaupte(await beenden.count(), 'Kein Weg, die Unterbrechung zu beenden');
				await beenden.first().scrollIntoViewIfNeeded();
				await abschicken(leitung, beenden.first());
			}

			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			const danach = await telefon.locator('.dreischritt').count();

			behaupte(
				inPause === 1,
				`In der Pause stand die Einordnung ${inPause}-mal auf der Eigentümerseite`
			);
			behaupte(
				danach === 1,
				`Nach der Pause stand die Einordnung ${danach}-mal auf der Eigentümerseite`
			);
			aktuelleSeite = leitung;
			return 'in der Pause einmal, danach einmal';
		});

		/*
		 * **Die Papiersperre am lebenden Telefon** (11.09.2026, Frage des Auftraggebers:
		 * «Hast du getestet, ob die Abstimmung richtigerweise blockiert wird?»).
		 *
		 * Getestet war sie, aber nur in der Datenbank
		 * (`tests/db/papierabgabe.test.ts`). Genau dort greift die eigene Regel des Auftraggebers
		 * vom 05.08.2026: Vierzehn grüne Datenbanktests, während das Formular
		 * `value="ja"` schickte und `jaNein` nur `true` kannte. Hier wird deshalb
		 * die Verdrahtung gemessen, und zwar auf drei Ebenen:
		 *
		 *   1. Die Maske bietet keine Wahlknöpfe mehr an.
		 *   2. Sie sagt, warum — sonst sieht es aus wie ein Defekt, und im Saal
		 *      ruft jemand die Verwaltung an.
		 *   3. Eine trotzdem abgeschickte Stimme wird abgewiesen. Das ist die
		 *      eigentliche Schranke: Was eine Seite anzeigt, darf nicht
		 *      entscheiden, was der Server annimmt.
		 *
		 * Nebenbei fährt der Schritt den neuen Weg «Stimmt doch von Hand» an der
		 * Zeile (11.09.2026) in beide Richtungen und stellt den Ausgangszustand
		 * wieder her — die folgenden Schritte rechnen mit dieser Stimme.
		 */
		await schritt('Wer von Hand stimmt, hat am Telefon keine Knöpfe — und der Server nimmt nichts an', async () => {
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			/*
			 * **Aus der Überschrift, nicht aus dem Seitentext** (11.09.2026, im
			 * eigenen Lauf gefunden). `text()` faltet alle Leerzeichen zusammen,
			 * Zeilenumbrüche inbegriffen — `[^\n]+` griff damit bis ans Ende der
			 * Seite, und der Fehlschlag drei Zeilen später nannte als «Name» den
			 * halben Bildschirm.
			 */
			const wer = (await telefon.locator('h1').first().innerText())
				.replace(/^Guten Tag,\s*/, '')
				.trim();
			behaupte(
				wer && wer.length < 60,
				`Auf dem Telefon steht kein brauchbarer Name: «${wer?.slice(0, 80)}»`
			);

			// Die Kennung des offenen Durchgangs, solange die Knöpfe noch da sind.
			const durchgang = await telefon
				.locator('input[name="durchgang"]')
				.first()
				.inputValue()
				.catch(() => '');
			behaupte(durchgang, 'Kein offener Durchgang auf dem Telefon');

			// ── Vermerk an der Zeile setzen ────────────────────────────────────
			aktuelleSeite = leitung;
			await gehe(leitung, `/versammlungen/${versammlungId}/anwesenheit`);
			const zeile = leitung.locator('tr', { hasText: wer }).first();
			const setzen = zeile.locator('form[action="?/papierBeantworten"] button[type="submit"]');
			behaupte(
				await setzen.count(),
				`An der Zeile von ${wer} steht kein Weg «Stimmt doch von Hand» — der Fehlgriff wäre unumkehrbar`
			);
			await abschicken(leitung, setzen.first());

			// ── 1 und 2: die Maske ─────────────────────────────────────────────
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			/*
			 * **`name^="wahl"`, nicht `name="wahl"`.** Wer Vollmachten hält, bekommt
			 * je Partei einen Knopf `wahl:<parteiId>`; ein Vergleich auf
			 * Gleichheit fände den nie und die Zusicherung wäre grün, weil sie
			 * nichts sucht.
			 */
			behaupte(
				(await telefon.locator('button[name^="wahl"], button[value="yes"]').count()) === 0,
				'Das Telefon einer Papierpartei bietet weiter Wahlknöpfe an'
			);
			await behaupteText(
				telefon,
				/stimmt an dieser Versammlung auf Papier ab/,
				'Am aufgerufenen Traktandum steht nicht, warum hier nichts zu tun ist'
			);

			// ── 3: der Server ──────────────────────────────────────────────────
			/*
			 * **Von Hand abgeschickt, nicht geklickt.** Es gibt nichts mehr zu
			 * klicken, und darum geht es: Eine Stimme, die an der Maske vorbei
			 * eintrifft, muss dieselbe Absage bekommen. Die Kopfzeile `origin`
			 * gehört dazu, sonst weist SvelteKits Schutz gegen fremde Formulare
			 * schon vorher ab, und der Schritt prüfte die falsche Schranke.
			 */
			const antwort = await telefon.request.post(`${ZIEL}/z?/stimmen`, {
				form: { wahl: 'yes', durchgang },
				headers: { origin: ZIEL }
			});
			const koerper = await antwort.text();
			behaupte(
				/auf Papier|von Hand/.test(koerper),
				`Die Stimme wurde nicht mit dem Papiervermerk abgewiesen: ${antwort.status()} ${koerper.slice(0, 300)}`
			);

			// ── Zurück, damit die folgenden Schritte ihre Stimme haben ─────────
			aktuelleSeite = leitung;
			await gehe(leitung, `/versammlungen/${versammlungId}/anwesenheit`);
			const zurueck = leitung
				.locator('tr', { hasText: wer })
				.first()
				.locator('form[action="?/papierZuruecknehmen"] button[type="submit"]');
			behaupte(await zurueck.count(), `Kein Rückweg an der Zeile von ${wer}`);
			await abschicken(leitung, zurueck.first());

			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			behaupte(
				(await telefon.locator('button[name^="wahl"][value="yes"]').count()) > 0,
				'Nach der Rücknahme fehlen die Wahlknöpfe weiterhin'
			);
			aktuelleSeite = leitung;
			return `${wer}: keine Knöpfe, Stimme abgewiesen, danach wieder frei`;
		});

		await schritt('Ein Telefon stimmt ab, das andere nicht', async () => {
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			const ja = telefon
				.locator('button[value="yes"], button[name="wahl"][value="yes"]')
				.first();
			behaupte(await ja.count(), `Kein Ja-Knopf auf dem Telefon: ${(await text(telefon)).slice(0, 300)}`);
			/*
			 * **Vor der Abgabe steht, dass sie sich ändern lässt**
			 * (Bedienbarkeitsprüfung 05.09.2026, Befund 7 der Telefonsicht):
			 * «Dass man die Stimme ändern kann, steht erst nach der Abgabe da.
			 * Vorher weiss niemand, ob der Druck endgültig ist.»
			 */
			await behaupteText(
				telefon,
				/lässt sich bis zum Schliessen ändern/,
				'Vor der Abgabe steht nicht, dass die Stimme änderbar ist'
			);

			/*
			 * **Wie weit bis zur Frage, und springt die Seite?**
			 * (Bedienbarkeitsprüfung 05.09.2026, Befund 8 der Telefonsicht): «Bis
			 * zur Frage sind rund 1200 Pixel zu scrollen, und nach jedem
			 * Knopfdruck springt die Seite an den Anfang zurück.»
			 *
			 * Gemessen wird beides an der Sache: der Abstand der Frage vom
			 * Seitenanfang, und der Rollstand vor und nach der Abgabe. Eine
			 * Behauptung über das Aussehen hilft hier nicht — die Zahl schon.
			 */
			const bisZurFrage = await telefon
				.locator('section.abstimmung h2')
				.first()
				.evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY))
				.catch(() => -1);
			behaupte(
				bisZurFrage >= 0 && bisZurFrage < 700,
				`Bis zur Frage sind ${bisZurFrage} px zu rollen (Befund 8: waren rund 1200)`
			);

			// Ein Stück nach unten rollen, damit ein Sprung an den Anfang auffiele.
			await telefon.evaluate(() => window.scrollTo(0, 300));
			await telefon.waitForTimeout(150);
			const rollstandVorher = await telefon.evaluate(() => Math.round(window.scrollY));

			await abschicken(telefon, ja);

			/*
			 * **Der Rollstand bleibt** — `absenden()` schafft die Navigation ab,
			 * und ohne Navigation gibt es keinen Sprung an den Anfang. Die Grenze
			 * ist grosszügig: Die Meldung schiebt den Inhalt um ihre eigene Höhe,
			 * und der Browser verankert dabei nach (`scroll anchoring`). Was der
			 * Befund beschreibt, ist ein Sprung auf 0.
			 */
			const rollstandNachher = await telefon.evaluate(() => Math.round(window.scrollY));
			/*
			 * **Gegen den gemessenen Stand, nicht gegen eine feste Zahl**
			 * (Code-Review 06.09.2026). Ein erster Anlauf verlangte `> 100`. Das
			 * misst nicht den Sprung, sondern die Seitenhöhe: `scrollTo(0, 300)`
			 * erreicht 300 nur, wenn das Dokument hoch genug ist — und genau dieser
			 * Block kürzt den Kopf um mehrere hundert Pixel. Eine kürzere Seite
			 * hätte die Probe rot gemacht, ohne dass etwas gesprungen wäre.
			 *
			 * Deshalb zwei getrennte Aussagen: Erst, dass überhaupt gerollt werden
			 * konnte (sonst misst der Rest nichts), dann der Vergleich. Die Toleranz
			 * deckt das Nachrücken durch die eingefügte Bestätigung ab; was der
			 * Befund beschreibt, ist ein Sprung auf 0.
			 */
			behaupte(
				rollstandVorher >= 250,
				`Die Seite war zu kurz zum Rollen (${rollstandVorher} px) — die Sprungprobe misst nichts`
			);
			behaupte(
				rollstandNachher >= rollstandVorher - 150,
				`Die Seite sprang nach der Abgabe nach oben: ${rollstandVorher} px → ${rollstandNachher} px`
			);

			/*
			 * **Und der Fokus bleibt am gedrückten Knopf** (Code-Review 06.09.2026).
			 *
			 * Ohne `data-fokus` fällt er nach dem Absenden auf `<body>`; wer mit
			 * Tastatur oder Sprachausgabe stimmt, tabbt sich danach von der
			 * Seitenspitze zurück. Der Knopf ist während der Abgabe gesperrt, und
			 * ein `focus()` auf ein gesperrtes Element tut nichts — deshalb wird
			 * hier gemessen und nicht behauptet.
			 */
			const fokus = await telefon.evaluate(() => {
				const a = document.activeElement;
				return a ? `${a.tagName.toLowerCase()}:${a.getAttribute('data-fokus') ?? ''}` : 'nichts';
			});
			behaupte(
				/^button:stimme:.+:yes$/.test(fokus),
				`Nach der Abgabe liegt der Fokus nicht am gedrückten Knopf, sondern auf «${fokus}»`
			);

			/*
			 * **Auf die Marke warten, nicht auf einen Satz, den es immer gibt**
			 * (Code-Review 06.09.2026). Die frühere Wartesperre suchte
			 * `/erfasst|abgegeben|Ihre Stimme/` und traf damit die Überschrift
			 * «Sie sind als anwesend erfasst», die während der ganzen Abstimmung
			 * dasteht — sie kehrte sofort zurück und wartete auf nichts.
			 *
			 * **Und im Block dieser Partei, nicht seitenweit**: Sobald das Gerät
			 * eine Vollmacht hält, gibt es mehrere Wahlblöcke, und eine Zählung
			 * über alle wäre von der zweiten Stimme abhängig.
			 */
			const block = telefon.locator('.fuer').first();
			const gewaehlt = block.locator('.wahl button[aria-current="true"]');
			await gewaehlt.waitFor({ state: 'visible', timeout: 15000 }).catch((f) => {
				if (!/Timeout .* exceeded/.test(String(f))) throw f;
			});

			/*
			 * **Danach sieht man am Knopf, was gewählt ist** (Befund 6): «Nach der
			 * Abgabe sehen ‹Ja›, ‹Nein›, ‹Enthaltung› genau gleich aus wie vorher;
			 * kein Knopf ist markiert.»
			 *
			 * Gemessen wird die Marke, nicht die Farbe: Sie sagt beides zugleich —
			 * was dasteht und was ein Bildschirmleser hört.
			 */
			const wieViele = await gewaehlt.count();
			const beschriftung = wieViele > 0 ? (await gewaehlt.first().innerText()).trim() : '';
			behaupte(wieViele === 1, `Im Block der Partei sind ${wieViele} Knöpfe als gewählt markiert`);
			behaupte(beschriftung === 'Ja', `Markiert ist «${beschriftung}», gewählt war «Ja»`);
			aktuelleSeite = leitung;
		});

		/*
		 * **Das zweite Telefon stimmt für die vertretene Partei** — und nur für
		 * sie. Damit ist die Abstimmung noch unvollständig (Bucher selbst fehlt),
		 * und die folgenden Etappen prüfen weiterhin, dass der Beamer das Ergebnis
		 * bis zur Verkündung zurückhält.
		 */
		await schritt('Das zweite Telefon stimmt für die Vertretene mit', async () => {
			aktuelleSeite = telefonB;
			await gehe(telefonB, '/z');

			const bloecke = telefonB.locator('.fuer');
			behaupte(
				(await bloecke.count()) === 2,
				`Das Telefon zeigt ${await bloecke.count()} Stimmen statt zwei`
			);
			const text = (await telefonB.locator('.abstimmung').innerText()).replace(/\s+/g, ' ');
			behaupte(/Ihre eigene Stimme/.test(text), `Die eigene Stimme ist nicht benannt: ${text}`);
			behaupte(/durch Vollmacht/.test(text), `Die Vollmacht ist nicht benannt: ${text}`);

			// Nur die vertretene Partei — die eigene bleibt offen.
			const vertreten = telefonB.locator('.fuer.vertreten');
			await abschicken(telefonB, vertreten.locator('button[value="yes"]'));

			const nachher = (await telefonB.locator('.abstimmung').innerText()).replace(/\s+/g, ' ');
			behaupte(/erfasst: Ja/.test(nachher), `Die Stimme der Vertretenen fehlt: ${nachher}`);
			behaupte(
				/noch nicht gestimmt/.test(nachher),
				`Die eigene Stimme wurde mit abgegeben: ${nachher}`
			);

			/*
			 * **Die offene Stimme steht dort, wo sonst die Bestätigung steht**
			 * (Bedienbarkeitsprüfung 05.09.2026, schwerster Befund der
			 * Eigentümersicht). Wer eine Vollmacht hält und für eine der beiden
			 * Parteien gestimmt hat, legte das Telefon weg — der andere Block
			 * stand 531 Pixel unterhalb des Bildschirmrands, und die Stimme
			 * verfiel still. Geprüft wird deshalb der **Kasten**, nicht bloss die
			 * Zeile am Block: Nur er steht im Sichtfeld.
			 */
			const fehlt = telefonB.locator('.abstimmung .fehlt');
			behaupte(
				await fehlt.count(),
				`Kein Hinweis auf die offene Stimme: ${nachher.slice(0, 300)}`
			);
			const fehlttext = (await fehlt.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/1 von 2 Stimmen/.test(fehlttext),
				`Der Hinweis nennt die Zahl nicht: ${fehlttext}`
			);
			behaupte(
				/Noch offen/.test(fehlttext),
				`Der Hinweis sagt nicht, dass etwas fehlt: ${fehlttext}`
			);
			/*
			 * **Die eigene Stimme heisst «Ihre eigene Stimme», nicht beim Namen**
			 * (Code-Review 06.09.2026). Der Kasten listete die offenen Parteien
			 * über `p.name` — und die eigene ist eine davon. Auf dem Telefon stand
			 * dann «Für Anna Bucher haben Sie noch nicht gestimmt», wo Anna Bucher
			 * die lesende Person selbst ist. Genau diesen Ablauf fährt der Schritt
			 * hier, deshalb wird die Sache hier auch geprüft und nicht der
			 * Wortlaut.
			 */
			behaupte(
				/Ihre eigene Stimme/.test(fehlttext),
				`Der Hinweis benennt die eigene offene Stimme nicht als eigene: ${fehlttext}`
			);

			/*
			 * **Und die Frage steht über der Einordnung**, solange abgestimmt wird
			 * (Produktentscheid 20.08.2026, am 05.09.2026 wieder hergestellt). Der
			 * Dreischritt war davor geraten und schob die Frage aus dem Bild.
			 */
			const yFrage = await telefonB.locator('.abstimmung h2').first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
			const yEinordnung = await telefonB.locator('.dreischritt').first().evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
			behaupte(
				yFrage < yEinordnung,
				`Die Frage steht unter der Einordnung: Frage bei ${Math.round(yFrage)}, Einordnung bei ${Math.round(yEinordnung)}`
			);

			aktuelleSeite = leitung;
			return 'für Christen, nicht für sich; offene Stimme benannt';
		});

		await schritt('Leitung sieht den Fortschritt ohne Verteilung', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				/\d+ von \d+ haben abgestimmt|Alle \d+ haben abgestimmt/,
				'Kein Fortschritt sichtbar'
			);
		});

		await schritt('Abstimmung schliessen', async () => {
			const knopf = leitung.locator('form[action="?/schliessen"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Schliessen der Abstimmung');
			await abschicken(leitung, knopf.first());
		});

		await schritt('Der Text zum Beschluss steht unter dem Ergebnis, nicht statt seiner', async () => {
			/*
			 * **Auftraggeber, 09.09.2026**: «Der Text zum Beschluss führt Details,
			 * Präzisierungen oder Änderungen aus. Annahme und Ablehnung erfolgt
			 * hart über die Abstimmung.»
			 *
			 * Der Schritt misst deshalb beides — dass der Satz ankommt, und dass
			 * das Ergebnis daneben unverändert dasteht. Ein Lauf, der nur das
			 * Erste prüft, wäre auch dann grün, wenn das Feld das Ergebnis
			 * überschriebe.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await bereit(leitung);
			/*
			 * **Gemessen wird die Ergebniskarte, nicht die Seite** (Code-Review
			 * 09.09.2026). Der erste Anlauf suchte «angenommen» im ganzen Text —
			 * und traf damit den Hilfesatz des neuen Formulars selbst. Die
			 * Zusicherung konnte nie rot werden.
			 */
			const karte = leitung.locator('article.ergebnis').first();
			await karte.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
			behaupte(await karte.count(), 'Keine Ergebniskarte in der Leitung');
			const ergebnisVorher = await karte.getAttribute('class');

			const form = leitung.locator('form[action="?/beschlusstext"]').first();
			await form.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
			behaupte(await form.count(), 'Kein Formular für den Text zum Beschluss');
			await form.locator('textarea[name="text"]').fill('zum Kostendach von CHF 5000');
			await abschicken(leitung, form.locator('button[type="submit"]'));

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const gespeichert = await leitung
				.locator('form[action="?/beschlusstext"] textarea[name="text"]')
				.first()
				.inputValue();
			behaupte(
				gespeichert === 'zum Kostendach von CHF 5000',
				`Der Text steht nach dem Neuladen nicht im Feld: «${gespeichert}»`
			);

			const ergebnisNachher = await leitung
				.locator('article.ergebnis')
				.first()
				.getAttribute('class');
			behaupte(
				ergebnisNachher === ergebnisVorher,
				`Das Ergebnis hat sich mit dem Text geändert: ${ergebnisVorher} → ${ergebnisNachher}`
			);
			return `«zum Kostendach von CHF 5000», Ergebnis unverändert ${ergebnisNachher}`;
		});

		await schritt('Die Pendenz übernimmt den Beschluss und lässt sich abhaken', async () => {
			/*
			 * **Die Lücke, die dieser Schritt schliesst** (08.09.2026): Eine Zusage
			 * wie «Die Verwaltung klärt den Punkt noch» steht im einen Jahr im
			 * Protokoll und im nächsten wieder, wenn niemand festhält, wer bis wann
			 * was tut.
			 *
			 * Gemessen wird der ganze Weg, nicht nur das Speichern: übernehmen aus
			 * dem Beschluss, erfassen, wiederfinden nach dem Neuladen, abhaken.
			 * Der letzte Schritt ist der, für den die Pendenz an der Gemeinschaft
			 * hängt statt am versiegelten Nachweis.
			 */
			const erfassen = leitung.locator('form[action="?/pendenzErfassen"]').first();
			await erfassen.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
			behaupte(await erfassen.count(), 'Kein Formular für eine Pendenz am aufgerufenen Traktandum');

			// Der Knopf steht nur da, wenn ein Beschlusstext vorliegt — den hat der
			// Schritt davor gesetzt. Fehlt er, ist die Verdrahtung offen.
			const uebernehmen = erfassen.locator('button.uebernehmen');
			behaupte(await uebernehmen.count(), 'Kein Knopf «Aus dem Beschluss übernehmen»');
			await uebernehmen.click();
			const uebernommen = await erfassen.locator('input[name="text"]').inputValue();
			behaupte(
				uebernommen === 'zum Kostendach von CHF 5000',
				`Der Beschluss kam nicht ins Feld: «${uebernommen}»`
			);

			await erfassen.locator('input[name="text"]').fill('Offerten für die Rampe einholen');
			await erfassen.locator('input[name="verantwortlich"]').fill('die Bewirtschaftung');
			await abschicken(leitung, erfassen.locator('button[type="submit"]'));

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const zeile = leitung.locator('section.pendenzen li').first();
			behaupte(await zeile.count(), 'Die Pendenz steht nach dem Neuladen nicht in der Liste');
			const satz = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				satz.includes('die Bewirtschaftung') && satz.includes('Offerten für die Rampe einholen'),
				`Die Pendenz zeigt nicht, wer was tut: «${satz}»`
			);
			behaupte(
				satz.includes('bis zur nächsten Versammlung'),
				`Die Frist fehlt in der Zeile: «${satz}»`
			);

			// Abhaken — der Weg, den es Monate später gibt.
			const abschluss = leitung.locator('form[action="?/pendenzZustand"]').first();
			await leitung.locator('section.pendenzen details').first().evaluate((d) => (d.open = true));
			await abschluss.locator('select[name="zustand"]').selectOption('erledigt');
			await abschluss.locator('input[name="notiz"]').fill('Offerten liegen vor');
			await abschicken(leitung, abschluss.locator('button[type="submit"]'));

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const nachher = (await leitung.locator('section.pendenzen li').first().innerText()).replace(
				/\s+/g,
				' '
			);
			// Klein oder gross: Der Zustand steht in Versalien, weil ihn das
			// Stilblatt so setzt — `innerText` liefert den gezeichneten Text.
			behaupte(
				/erledigt seit/i.test(nachher) && nachher.includes('Offerten liegen vor'),
				`Die abgehakte Pendenz zeigt ihren Zustand nicht: «${nachher}»`
			);
			return 'erfasst, wiedergefunden, abgehakt';
		});

		await schritt('Eine Rüge im Saal festhalten', async () => {
			/*
			 * **Ä-06, Migration 160.** Die Rüge vor der Abstimmung erhält das
			 * Anfechtungsrecht (Wermelinger Rz. 69a ad Art. 712n). Gemessen wird
			 * der Weg im Saal: aufklappen, die Uhrzeit steht vorbelegt da, erfassen,
			 * nach dem Neuladen wiederfinden. Dass sie ins Abschlusspaket geht,
			 * prüft der Schritt nach dem Versiegeln.
			 */
			const kasten = leitung.locator('section.ruegen details').first();
			behaupte(await kasten.count(), 'Kein Abschnitt «Rüge festhalten» am aufgerufenen Traktandum');
			await kasten.locator('summary').click();
			const form = leitung.locator('form[action="?/ruegeErfassen"]').first();
			await form.locator('input[name="wer"]').fill('Vertreterin von Whg 2');
			const zeit = await form.locator('input[name="uhrzeit"]').inputValue();
			behaupte(/^\d\d:\d\d$/.test(zeit), `Die Uhrzeit ist nicht vorbelegt: «${zeit}»`);
			await form.locator('textarea[name="wortlaut"]').fill(RUEGEWORT);
			await form
				.locator('textarea[name="entscheid"]')
				.fill('Die Abstimmung findet statt, die Rüge ist festgehalten.');
			await abschicken(leitung, form.locator('button[type="submit"]'));

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const zeile = leitung.locator('section.ruegen li').first();
			behaupte(await zeile.count(), 'Die Rüge steht nach dem Neuladen nicht in der Liste');
			const satz = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				satz.includes(`${zeit} Uhr, Vertreterin von Whg 2`) &&
					satz.includes(RUEGEWORT) &&
					satz.includes('Vorgehen des Vorsitzes: Die Abstimmung findet statt'),
				`Die Rüge zeigt nicht, wer wann was gerügt hat: «${satz}»`
			);
			return `festgehalten um ${zeit}`;
		});

		await schritt('Der Beamer zeigt das Ergebnis, sobald geschlossen ist', async () => {
			/*
			 * **Umgedreht am 21.08.2026.** Vorher hielt der Beamer das Ergebnis
			 * zurück, bis die Sitzungsleitung «Ergebnis verkünden» drückte — es sei
			 * denn, alle hatten abgestimmt, dann erschien es sofort. Genau diese
			 * Ausnahme machte den Knopf unglaubwürdig: Er behauptete «Erst danach
			 * erscheint es auf Leinwand und Telefonen» und tat sichtbar nichts.
			 *
			 * Produktentscheid: «Mit dem Schliessen der Abstimmung, auch wenn nicht
			 * alle abgestimmt haben, soll automatisch verkündet werden. Ich sehe
			 * dort den Mehrwert nicht.» Hier stimmt nur eine von zwei Stimmen ab —
			 * der Fall, in dem es früher wartete.
			 */
			aktuelleSeite = beamer;
			await beamer.reload({ waitUntil: 'domcontentloaded' });
			await behaupteText(
				beamer,
				/\bangenommen\b|\babgelehnt\b/i,
				'Der Beamer zeigt das Ergebnis nach dem Schliessen nicht'
			);
			aktuelleSeite = leitung;
		});

		await schritt('Und keinen eigenen Verkünden-Knopf mehr', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				(await leitung.locator('form[action="?/freigeben"] button').count()) === 0,
				'Es gibt wieder einen eigenen Knopf zum Verkünden'
			);
			// Die Marke sagt, dass verkündet ist — das Schliessen hat es getan.
			await behaupteText(
				leitung,
				/verkündet/i,
				'Der Durchgang ist nicht als verkündet gekennzeichnet'
			);
		});

		/*
		 * **Beide Beamersichten, nicht nur eine.**
		 *
		 * Es gibt zwei: `/p` mit dem Anzeigecode für ein fremdes Gerät, und
		 * `/versammlungen/<id>/praesentation` für das Fenster, das die
		 * Sitzungsleitung selbst öffnet. Der Durchlauf prüfte nur die erste — und
		 * übersah dadurch, dass die zweite Abstimmungen gar nicht kannte: Wer auf
		 * «Ergebnis verkünden» klickte, sah an der Wand nichts. Gemeldet am
		 * 02.08.2026.
		 *
		 * Seither teilen sich beide dasselbe Saalbild. Diese Etappe hält fest,
		 * dass es so bleibt.
		 */
		await schritt('Das eigene Beamerfenster zeigt dasselbe', async () => {
			const eigenes = await browser.newContext();
			await rueckfragenBestaetigen(eigenes);
			const seite = await eigenes.newPage();
			// Auch dieses Fenster bekommt die Wache: Es meldet sich an und wechselt
			// danach auf die Präsentation, also zweimal navigieren vor der ersten
			// Behauptung.
			warteNachNavigation(seite);
			try {
				await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
				await seite.fill('input[name="username"]', BENUTZER);
				await seite.fill('input[name="kennwort"]', KENNWORT);
				await abschicken(seite, seite.locator('main button[type="submit"]'));
				await seite.goto(`${ZIEL}/versammlungen/${versammlungId}/praesentation`, {
					waitUntil: 'domcontentloaded'
				});
				const t = await behaupteText(
					seite,
					/angenommen|abgelehnt/i,
					'Das eigene Beamerfenster zeigt das verkündete Ergebnis nicht'
				);
				behaupte(/\d/.test(t), 'Das eigene Beamerfenster nennt keine Zahlen');
			} catch (fehler) {
				// Der Rahmen sichert `aktuelleSeite` — hier die Leitung, nicht die
				// fehlgeschlagene Sicht. Ohne eigene Aufnahme war bei den Flakes vom
				// 14./15.08.2026 genau das Bild verloren, das den Befund getragen
				// hätte; der Kontext ist im finally bereits geschlossen.
				await seite
					.screenshot({ path: `${AUFNAHMEN}/fehler-eigenes-fenster.png`, fullPage: true })
					.catch(() => {});
				await writeFile(`${AUFNAHMEN}/fehler-eigenes-fenster.html`, await seite.content()).catch(
					() => {}
				);
				throw fehler;
			} finally {
				await eigenes.close();
			}
		});

		await schritt('Beamer zeigt jetzt das Ergebnis mit Zahlen', async () => {
			aktuelleSeite = beamer;
			await beamer.reload({ waitUntil: 'domcontentloaded' });
			const t = await behaupteText(beamer, /angenommen|abgelehnt/i, 'Kein Ergebnis auf dem Beamer');
			behaupte(/\d/.test(t), 'Das Ergebnis nennt keine Zahlen');
			aktuelleSeite = leitung;
			return t.match(/(Angenommen|Abgelehnt)[^.]{0,90}/i)?.[0] ?? 'Ergebnis sichtbar';
		});

		/*
		 * **Was an der Wand steht, wenn nichts läuft** (Migration 035).
		 *
		 * Drei Dinge in einer Etappe, weil sie eine Kette bilden: Der Aufruf lässt
		 * sich zurücknehmen, ohne Aufruf steht die Traktandenliste an der Wand, und
		 * ein eigener Text tritt an ihre Stelle. Fiele der erste Teil weg, käme man
		 * an die anderen zwei gar nicht heran — genau das war der Zustand, als das
		 * Feld dafür auf der Anwesenheitsseite verschwand.
		 */
		await schritt('Die Wand ohne aufgerufenes Traktandum', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const zurueck = leitung.locator('form[action="?/aufrufen"] button', {
				hasText: 'Aufruf zurücknehmen'
			});
			behaupte(await zurueck.count(), 'Kein Weg, den Aufruf zurückzunehmen');
			await abschicken(leitung, zurueck.first());

			aktuelleSeite = beamer;
			await beamer.waitForTimeout(1200);
			await behaupteText(beamer, 'Traktanden', 'Der Beamer zeigt die Traktandenliste nicht');
			await behaupteOhne(beamer, /angenommen|abgelehnt/i, 'Das Ergebnis blieb an der Wand kleben');

			aktuelleSeite = leitung;
			const frei = leitung.locator('input[name="art"][value="frei"]');
			behaupte(await frei.count(), 'Keine Auswahl für einen eigenen Text an der Wand');
			await frei.click();
			await fuelle(leitung, 'textarea[name="text"]', 'Pause bis 20:15');

			/*
			 * **Der Sprungnachweis für `Wandbild.svelte`** (28.08.2026). Der
			 * Baustein steht auf beiden Sitzungsleitungssichten, und die Seiten
			 * selbst sind noch nicht umgestellt — was hier gemessen wird, ist
			 * also allein sein Verdienst. Ohne die `use:enhance`-Zeile lädt die
			 * Seite neu und steht wieder bei 0.
			 *
			 * Erst ans Formular rollen: Stünde die Seite schon bei 0, wäre
			 * «vorher gleich nachher» auch im springenden Zustand erfüllt.
			 */
			const anDieWand = leitung.locator('form[action="?/wandbild"] button[type="submit"]');
			await anDieWand.scrollIntoViewIfNeeded();
			const vorWand = await leitung.evaluate(() => window.scrollY);
			behaupte(
				vorWand > 0,
				`Die Seite steht schon bei 0 — so misst der Schritt den Sprung nicht (${vorWand} px)`
			);
			await abschicken(leitung, anDieWand);
			const nachWand = await leitung.evaluate(() => window.scrollY);
			behaupte(
				Math.abs(nachWand - vorWand) < 40,
				`Die Wandwahl liess die Seite von ${vorWand} px auf ${nachWand} px springen`
			);

			aktuelleSeite = beamer;
			await beamer.waitForTimeout(1500);
			await behaupteText(beamer, 'Pause bis 20:15', 'Der eigene Text kam nicht an die Wand');

			// Wieder aufrufen: Die folgenden Etappen arbeiten am aufgerufenen
			// Traktandum weiter. Eine Prüfung, die den Stand hinter sich lässt, wie
			// sie ihn vorfand, lässt sich an jeder Stelle einschieben.
			aktuelleSeite = leitung;
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung
					.locator(`form[action="?/aufrufen"]:has(input[value="${traktandumId}"]) button[type="submit"]`)
					.first()
			);
			return 'Aufruf zurückgenommen, Liste und eigener Text an der Wand';
		});

		// ── Was im Saal noch dazukommt ──────────────────────────────────────
		//
		// Die Schranke aus Migration 032 ist die einzige der Anwendung, die einen
		// ganzen Weg zumacht statt ihn zu bedingen. Sie gehört deshalb in den
		// Durchlauf: Wertetabellen und Datenbanktests prüfen die Regel, aber nicht,
		// ob das Formular sie im Saal auch anbietet — und genau dort wird sie
		// gebraucht, unter Zeitdruck, von jemandem, der sie nicht nachschlagen kann.
		console.log('\nWas im Saal noch dazukommt');

		let folgeantragId = null;

		await schritt('Eine nicht angekündigte Sache lässt sich nur zur Kenntnis nehmen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('summary', { hasText: 'Eine weitere Sache aufnehmen' }).first();
			behaupte(await aufklappen.count(), 'Kein Weg, während der Sitzung ein Traktandum aufzunehmen');

			// Aufklappen, nicht umschalten — Begründung beim Folgeantrag weiter unten.
			const formular = leitung.locator('form[action="?/aufnehmen"]');
			if (!(await formular.locator('[name="spontanart"]').isVisible())) await aufklappen.click();
			await formular.locator('[name="spontanart"]').waitFor({ state: 'visible', timeout: 5000 });
			behaupte(
				(await formular.locator('[name="spontanart"]').inputValue()) === 'neu',
				'Voreingestellt ist nicht der strenge Fall — Sachfremdes rutschte durch, wenn niemand wählt'
			);
			// Der Kern: Es wird gar keine Abstimmung angeboten. Ein Auswahlfeld mit
			// einer einzigen Möglichkeit sähe aus wie eine Entscheidung, die man auch
			// anders treffen könnte.
			behaupte(
				(await formular.locator('[name="art"]').count()) === 0,
				'Für eine nicht angekündigte Sache wird eine Art zur Auswahl gestellt'
			);
			behaupte(
				(await formular.locator('[name="genehmigung"]').count()) === 0,
				'Es wird noch ein Genehmigungsbeschluss angeboten — den Weg gibt es nicht'
			);
			await behaupteText(
				leitung,
				'nicht angekündigt',
				'Der Grund für die Sperre steht nirgends auf der Seite'
			);

			await formular.locator('[name="titel"]').fill('Verkauf des Bastelraums');
			await formular
				.locator('[name="antragswortlaut"]')
				.fill('Der Bastelraum im Untergeschoss wird verkauft.');
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			const zeile = leitung.locator('ul.baum > li', { hasText: 'Verkauf des Bastelraums' }).last();
			await zeile.waitFor({ state: 'visible', timeout: 8000 });
			const gelesen = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Kenntnisnahme/i.test(gelesen),
				`Die Sache wurde nicht als Kenntnisnahme geführt — gesehen: ${gelesen.slice(0, 160)}`
			);
			// Kein Erfordernis, kein Weg zur Abstimmung: Stünde hier «Erfordernis
			// setzen», läge der Beschluss einen Klick entfernt.
			behaupte(
				!/Erfordernis setzen/i.test(gelesen),
				'Die Zeile bietet an, ein Mehrheitserfordernis zu setzen'
			);
			return 'Kenntnisnahme, kein Beschluss';
		});

		await schritt('Ein Folgeantrag hängt unter dem angekündigten Antrag', async () => {
			/*
			 * **Frisch geladen, sonst misst die Vorbelegung nichts** (07.09.2026,
			 * aus dem Code-Review). `vorgewaehlterGrundantrag` entsteht beim
			 * Seitenaufbau und steht danach fest. Der vorige Schritt schickt über
			 * `use:enhance`, also ohne Neuladen — die Behauptung «die Vorbelegung
			 * bleibt leer» prüfte dann einen Wert von vorhin statt die Lage nach
			 * dem Beschluss.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			// Die Nummer des Grundantrags wird **gelesen**, nicht angenommen: Die
			// Traktandenvorlage setzt Standardpunkte davor, und welche Nummer der
			// Antrag dadurch trägt, ist eine Frage der Vorlage und nicht der Sache.
			// Ein fest verdrahtetes «1.1» prüfte die Vorlage statt die Unterordnung.
			// **`ul.baum`, nicht `li`.** Über der Liste steht der Dreischritt
			// vorher/jetzt/nachher, und dessen mittlerer Eintrag trägt denselben
			// Titel — er kommt im Dokument zuerst und hat keine Nummernspalte. Ein
			// unqualifiziertes `li` greift ihn und wartet dann auf ein `.nr`, das es
			// dort nie geben wird.
			const grundnummer = (
				await leitung
					.locator('ul.baum > li', { hasText: 'Spielplatz' })
					.first()
					.locator('.nr')
					.first()
					.innerText()
			).trim();
			behaupte(grundnummer, 'Der Grundantrag trägt keine Nummer');
			/*
			 * **Erst zählen, dann lesen** (07.09.2026, aus dem Code-Review). Fehlt
			 * der Verweis, lief `innerText()` in einen Playwright-Zeitablauf mit
			 * einer Meldung über einen Selektor — der erklärende Satz weiter unten
			 * wäre nie erschienen.
			 */
			const erfordernisverweis = leitung.locator(
				`li[data-traktandum="${spielplatzId}"] a[title="Mehrheitserfordernis ändern"]`
			);
			behaupte(
				await erfordernisverweis.count(),
				'Der Grundantrag führt kein Mehrheitserfordernis — dann ist nichts zu erben'
			);
			const grunderfordernis = (await erfordernisverweis.first().innerText()).trim();

			/*
			 * **Aufklappen, nicht umschalten** (28.08.2026). Ein `summary` ist ein
			 * Schalter: Steht der Kasten schon offen, schliesst ihn der Klick. Bis
			 * der Baustein über `absenden()` schickte, lud die Seite nach jeder
			 * Aufnahme neu und der Kasten war dabei immer zu — seither bleibt er
			 * offen, und derselbe Klick nahm dem Schritt das Formular weg.
			 */
			const formular = leitung.locator('form[action="?/aufnehmen"]');
			const spontanart = formular.locator('[name="spontanart"]');
			if (!(await spontanart.isVisible())) {
				await leitung
					.locator('summary', { hasText: 'Eine weitere Sache aufnehmen' })
					.first()
					.click();
				await spontanart.waitFor({ state: 'visible', timeout: 5000 });
			}
			await spontanart.selectOption('folgeantrag');

			// Erst jetzt darf die Art gewählt werden — der Gegenstand war angekündigt.
			const art = formular.locator('[name="art"]');
			await art.waitFor({ state: 'visible', timeout: 5000 });
			await art.selectOption('abstimmung');
			const grundantrag = formular.locator('[name="grundantrag"]');
			behaupte(await grundantrag.count(), 'Kein Feld für den Grundantrag');

			/*
			 * **Der abgestimmte Antrag steht nicht mehr zur Wahl** (07.09.2026).
			 * Aufgerufen ist gerade die Fassadensanierung, über die eben
			 * entschieden wurde. «Jetzt möglich» nennt an ihr längst keinen
			 * Gegenantrag mehr; bis heute bot dieses Formular sie trotzdem an, und
			 * der Server nahm sie entgegen. Damit liess sich dieselbe angekündigte
			 * Sache ein zweites Mal beschliessen, ohne den Rückkommensantrag, den
			 * der Schritt «ohne Beschluss der Versammlung kein zweiter Durchgang»
			 * weiter unten erzwingt.
			 *
			 * Deshalb hier drei Nachweise: die Vorbelegung bleibt leer, der
			 * entschiedene Antrag fehlt in der Auswahl, und der Server weist ihn
			 * auch dann ab, wenn ihn jemand von Hand schickt.
			 */
			behaupte(
				(await grundantrag.inputValue()) === '',
				'Der eben entschiedene Antrag ist als Grundantrag vorbelegt'
			);
			const waehlbare = await formular.locator('[name="grundantrag"] option').allInnerTexts();
			behaupte(
				!waehlbare.some((w) => /Fassadensanierung/.test(w)),
				`Der entschiedene Antrag steht weiter zur Auswahl: ${waehlbare.join(' | ').slice(0, 200)}`
			);
			const abgewiesen = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/aufnehmen`,
				{
					headers: { origin: ZIEL },
					form: {
						spontanart: 'folgeantrag',
						grundantrag: traktandumId,
						titel: 'Am entschiedenen Antrag vorbei',
						art: 'abstimmung',
						antragswortlaut: 'Sollte nicht durchgehen.',
						antragstellerart: 'gemeinschaft'
					}
				}
			);
			const rohtext = await abgewiesen.text();
			behaupte(
				/bereits abgestimmt/.test(rohtext) && /R[^"]{0,3}ckkommensantrag/.test(rohtext),
				`Der Server nahm den Folgeantrag zum entschiedenen Grundantrag an: ${rohtext.slice(0, 300)}`
			);

			await grundantrag.selectOption(spielplatzId);
			behaupte(
				(await grundantrag.inputValue()) === spielplatzId,
				'Der zweite, noch offene Antrag liess sich nicht als Grundantrag wählen'
			);

			await formular.locator('[name="titel"]').fill('Sanierung nur der Wetterseite');
			await formular
				.locator('[name="antragswortlaut"]')
				.fill('Saniert wird vorerst nur die Wetterseite.');

			// Das Erfordernis gleich hier: Im Saal ist der Weg über den
			// Entscheidbaum ein Seitenwechsel vor wartenden Menschen (02.08.2026).
			const erfordernis = formular.locator('select[name="erfordernis"]');
			behaupte(
				await erfordernis.count(),
				'Kein Feld für das Mehrheitserfordernis am Folgeantrag'
			);

			/*
			 * **Ohne Vorbelegung** (Produktentscheid 08.10.2026). Bis dahin erbe
			 * der Folgeantrag das Erfordernis des Grundantrags; damit stand im
			 * Verlauf «von Hand gewählt», wo niemand gewählt hatte. Jetzt steht
			 * das Feld leer da, bis die Leitung wählt oder den Entscheidbaum
			 * nimmt.
			 */
			const formulartext = (await formular.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/—\s*später bestimmen\s*—/.test(formulartext),
				`Das Erfordernisfeld ist nicht leer vorbelegt: ${formulartext.slice(0, 300)}`
			);
			behaupte(
				!/Vom Grundantrag übernommen/i.test(formulartext),
				`Der Erbe-Hinweis steht noch da: ${formulartext.slice(0, 300)}`
			);

			await erfordernis.selectOption('k-baulich-nuetzlich');
			await abschicken(leitung, formular.locator('button[type="submit"]').first());

			/*
			 * **Der Kasten steht danach wieder leer da** (28.08.2026).
			 *
			 * Er schliesst sich nicht — anders als beim Anlegen auf der
			 * Traktandenseite gibt es hier kein `{#if}`, das ihn zerstörte. Seine
			 * sechs Werte sind `$state`, drei davon in Kindbausteinen, und
			 * `form.reset()` erreicht keinen davon; vorher räumte das Neuladen
			 * auf. Ohne den Griff in `beiErfolg` fände die Sitzungsleitung den
			 * eben aufgenommenen Antrag noch vollständig ausgefüllt vor, mit
			 * einem Knopf, der ihn ein zweites Mal aufnähme.
			 *
			 * **Gemessen wird `spontanart`, nicht der Titel.** Der Titel wäre die
			 * naheliegende Wahl und taugt nicht: Ihn leert `form.reset()` schon
			 * von selbst, die Probe bliebe also auch dann grün, wenn `beiErfolg`
			 * fehlte — sie könnte im schlechten Zustand gar nicht rot werden
			 * (28.08.2026 im Review gefunden, bevor sie das erste Mal lief).
			 * `spontanart` ist ein `$state` des Bausteins; nur der Griff stellt
			 * es zurück.
			 */
			const nachher = await formular.locator('[name="spontanart"]').inputValue();
			behaupte(
				nachher === 'neu',
				`Der Aufnahmekasten steht noch auf «${nachher}» — ein zweiter Klick nähme den Antrag nochmals auf`
			);

			const zeile = leitung
				.locator('ul.baum > li', { hasText: 'Sanierung nur der Wetterseite' })
				.last();
			await zeile.waitFor({ state: 'visible', timeout: 8000 });
			const gelesen = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Folgeantrag/i.test(gelesen),
				`Die Zeile weist ihn nicht als Folgeantrag aus — gesehen: ${gelesen.slice(0, 160)}`
			);
			// Die Zeile der Sitzungsleitung nennt seit dem 02.08.2026 den Titel des
			// Erfordernisses statt nur das Wort «Erfordernis» — wer gleich zur
			// Abstimmung aufruft, will wissen, welche Mehrheit gilt.
			behaupte(
				/Nützliche bauliche Massnahme/i.test(gelesen),
				`Das gewählte Erfordernis hängt nicht am Folgeantrag — gesehen: ${gelesen.slice(0, 200)}`
			);
			// Die Nummer belegt die Unterordnung: Unter dem Antrag 9 wird er zu 9.1.
			// Sie ist die einzige Angabe, an der ein Mensch im Saal sieht, worauf
			// sich der Folgeantrag stützt.
			const folgenummer = (await zeile.locator('.nr').first().innerText()).trim();
			behaupte(
				folgenummer.startsWith(`${grundnummer}.`),
				`Der Folgeantrag steht nicht unter seinem Grundantrag ${grundnummer} — ` +
					`er trägt die Nummer ${folgenummer}`
			);
			folgeantragId = await zeile
				.locator('form[action="?/aufrufen"] input[name="traktandum"]')
				.first()
				.getAttribute('value');
			behaupte(folgeantragId, 'Der Folgeantrag lässt sich nicht aufrufen');
			return `${folgenummer} unter ${grundnummer}`;
		});

		/*
		 * **Ein Folgeantrag hält das Mehr der Einladung** (06.10.2026,
		 * Produktentscheid «Ja, dieselbe Untergrenze»; `43c96bd`). Ein zweiter
		 * Folgeantrag zum Spielplatz mit einem milderen Mehr als dem der
		 * Einladung (wenn möglich das einfache, `k-verwaltung-gewoehnlich`) wird
		 * trotzdem aufgenommen, aber **ohne Mehr**: `nimmImSaalAuf` fängt die
		 * Absage `milder_als_einladung` ab (`absageUnterDerEinladung`) und
		 * antwortet mit dem Satz aus `hinweisOhneMehr` als stehender Warnung
		 * (`warnung`, nicht `hinweis`), nicht mit einem Fehler. Ginge die Absage nach oben, legte ein zweiter Klick denselben
		 * Antrag doppelt an.
		 *
		 * Gemessen wird deshalb die Wirkung, nicht nur der Satz: Vorher und
		 * nachher die Zahl der Folgeanträge unter dem Spielplatz, an der neuen
		 * Zeile «Erfordernis setzen» statt eines Mehrs, und das Mehr des
		 * Grundantrags bleibt, wie es war. Ein stilles Nichts (kein Antrag, oder
		 * einer mit dem milderen Mehr) fiele an einer dieser Stellen auf.
		 *
		 * **Danach zurückgezogen, im selben Schritt.** Ein offener Folgeantrag
		 * ohne Mehr bliebe sonst am Spielplatz hängen: Der nächste Schritt
		 * erwartet genau einen offenen Folgeantrag («hängt noch ein
		 * Folgeantrag»), und der Rückzug des Spielplatzes am Ende wäre gesperrt.
		 * Zurückgezogen wird über «Antrag zurückziehen» in seiner Zeile, also
		 * über den Weg, den die Warnung selbst nennt. Der Grund nennt den
		 * Spielplatz nicht, weil spätere Schritte dessen Zeile über
		 * `hasText: 'Spielplatz'` und `.last()` suchen.
		 */
		await schritt('Ein Folgeantrag mit milderem Mehr als die Einladung steht ohne Mehr da', async () => {
			const titel = 'Nur den Sandkasten erneuern';
			// Nur die Frist verschlucken, wie bei «Der Empfehlung folgen»: Ein
			// Selektorfehler oder eine geschlossene Seite gehören gemeldet.
			const nurZeitablauf = (f) => {
				if (!/Timeout .* exceeded/.test(String(f))) throw f;
				return false;
			};
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const grundzeile = leitung.locator(`ul.baum > li[data-traktandum="${spielplatzId}"]`);
			behaupte(await grundzeile.count(), 'Der Spielplatz steht nicht in der Liste');
			const grundnummer = (await grundzeile.first().locator('.nr').first().innerText()).trim();
			const mehrDesGrundantrags = async () => {
				const verweis = grundzeile.first().locator('a[title="Mehrheitserfordernis ändern"]');
				behaupte(await verweis.count(), 'Der Spielplatz führt kein Mehrheitserfordernis');
				return (await verweis.first().innerText()).trim();
			};
			const grundmehrVorher = await mehrDesGrundantrags();
			// Die Folgeanträge unter dem Spielplatz, an ihrer Nummer gezählt.
			const unterDemGrundantrag = async () =>
				(await leitung.locator('ul.baum > li > .zeile > .nr').allInnerTexts()).filter((n) =>
					n.trim().startsWith(`${grundnummer}.`)
				).length;
			const vorher = await unterDemGrundantrag();
			behaupte(vorher >= 1, `Unter ${grundnummer} steht kein Folgeantrag, obwohl der Schritt davor einen anlegte`);

			// Aufklappen, nicht umschalten (siehe den Schritt davor).
			const formular = leitung.locator('form[action="?/aufnehmen"]');
			const spontanart = formular.locator('[name="spontanart"]');
			if (!(await spontanart.isVisible())) {
				await leitung
					.locator('summary', { hasText: 'Eine weitere Sache aufnehmen' })
					.first()
					.click();
				await spontanart.waitFor({ state: 'visible', timeout: 5000 });
			}
			await spontanart.selectOption('folgeantrag');
			const art = formular.locator('[name="art"]');
			await art.waitFor({ state: 'visible', timeout: 5000 });
			await art.selectOption('abstimmung');
			await formular.locator('[name="grundantrag"]').selectOption(spielplatzId);
			await formular.locator('[name="titel"]').fill(titel);
			await formular
				.locator('[name="antragswortlaut"]')
				.fill('Erneuert wird vorerst nur der Sandkasten.');

			/*
			 * **Erst die Untergrenze, dann die Wahl.** Ohne festgehaltenes Mehr
			 * der Einladung gäbe es nichts zu unterschreiten, und der Schritt
			 * prüfte einen gewöhnlichen Folgeantrag. Der Satz steht nur, wo der
			 * Server für den gewählten Grundantrag eine Untergrenze meldet.
			 */
			await formular
				.locator('.hilfe', { hasText: 'Die Einladung nennt für' })
				.first()
				.waitFor({ state: 'visible', timeout: 5000 })
				.catch(nurZeitablauf);
			behaupte(
				await formular.locator('.hilfe', { hasText: 'Die Einladung nennt für' }).count(),
				'Für den Spielplatz meldet das Formular kein Mehr der Einladung, es gibt nichts zu unterschreiten. ' +
					'Er trug bei der Freigabe kein zählbares Mehr, obwohl der Schritt «Der Spielplatz trägt vor der ' +
					'Freigabe ein festes, zählbares Mehr» das qualifizierte gesetzt haben sollte'
			);
			/*
			 * **Welches Mehr milder ist, sagt der Server, nicht der Schritt.** Das
			 * Mehr des Spielplatzes ist seit dem 06.10.2026 das qualifizierte, fest
			 * gesetzt im Schritt «Der Spielplatz trägt vor der Freigabe ein festes,
			 * zählbares Mehr», nicht mehr der Vorschlag des Modells. Die Warnung
			 * vor dem Absenden kommt aus derselben Rechnung
			 * wie die Absage (`grenzeFuerFolgeantrag`, samt Reglement). Gewählt
			 * wird deshalb der erste Fall, bei dem sie erscheint, zuerst die
			 * gewöhnliche Verwaltungshandlung (einfaches Mehr).
			 */
			const erfordernis = formular.locator('select[name="erfordernis"]');
			const warnung = formular.locator('.hilfe.warnung', { hasText: 'milder als das der Einladung' });
			const faelle = await erfordernis
				.locator('option')
				.evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
			const reihe = [
				...faelle.filter((f) => f === 'k-verwaltung-gewoehnlich'),
				...faelle.filter((f) => f !== 'k-verwaltung-gewoehnlich')
			];
			let milder = null;
			for (const fall of reihe) {
				await erfordernis.selectOption(fall);
				const gesehen = await warnung
					.first()
					.waitFor({ state: 'visible', timeout: fall === reihe[0] ? 3000 : 400 })
					.then(() => true)
					.catch(nurZeitablauf);
				if (gesehen) {
					milder = fall;
					break;
				}
			}
			if (milder === null) {
				/*
				 * **Kein Fall milder: ein Befund, kein «nicht gemessen»** (06.10.2026).
				 * Bis dahin galt das als ungemessen, wenn die Einladung schon das
				 * einfache Mehr der Anwesenden und Vertretenen nannte, das mildeste
				 * wählbare (Codeprüfung M1); das hing am Vorschlag des Modells. Seit
				 * der Spielplatz vor der Freigabe fest das qualifizierte Mehr trägt,
				 * gibt es diese Lage im Durchstich nicht mehr. Gelesen wird das Mehr
				 * aus dem Satz der Einladung, nicht aus der Zeile: Die Zeile trägt das
				 * Mehr von jetzt, die Untergrenze ist das gedruckte.
				 */
				const einladung = (
					await formular.locator('.hilfe', { hasText: 'Die Einladung nennt für' }).first().innerText()
				).replace(/\s+/g, ' ');
				const worte = (einladung.match(/Die Einladung nennt für «[^»]*» (.*?)\. Ein milderes Mehr/) ?? [])[1];
				throw new Error(
					`Kein wählbares Mehr gilt als milder; die Einladung nennt «${worte ?? einladung.slice(0, 160)}». ` +
						'Erwartet war das qualifizierte Mehr aus dem Schritt «Der Spielplatz trägt vor der Freigabe ein festes, zählbares Mehr»'
				);
			}

			// Keine Absage erwartet: Der Server nimmt auf und sagt, was fehlt.
			await abschicken(leitung, formular.locator('button[type="submit"]').first());
			/*
			 * **An der Meldung selbst gelesen, nicht an der ganzen Seite.**
			 * «Antrag zurückziehen» steht als Ausklapper in fast jeder Zeile der
			 * Liste; über den Seitentext wäre die Probe immer grün.
			 */
			/*
			 * **Eine stehende Warnung, keine Quittung** (Produktentscheid
			 * 06.10.2026, «Eigenes Feld für Warnungen, das stehen bleibt»). Bis
			 * dahin lief der Satz als `ton="gut"` in die Quittungsecke und
			 * verschwand dort nach sechs Sekunden (`DAUER` in
			 * `$lib/einblender.svelte.ts`; Codeprüfung M2). Jetzt kommt er als
			 * `warnung` und steht als Absatz `p.meldung.warnung` über dem Inhalt.
			 *
			 * Gelesen wird deshalb nur dieser Absatz, nicht `ERFOLGSMELDUNG`: Dessen
			 * `[role="status"]` träfe die Warnung zwar auch, aber ebenso die
			 * Quittungsecke, und die Probe sähe den alten Weg dann als grün.
			 */
			const meldungsabsatz = leitung.locator('p.meldung.warnung', {
				hasText: `«${titel}» ist als Folgeantrag zu «`
			});
			await meldungsabsatz
				.first()
				.waitFor({ state: 'visible', timeout: 8000 })
				.catch(nurZeitablauf);
			behaupte(
				await meldungsabsatz.count(),
				`Die Warnung zum Folgeantrag ohne Mehr fehlt als stehender Absatz: ${(await text(leitung)).slice(0, 300)}`
			);
			const meldung = (await meldungsabsatz.first().innerText()).replace(/\s+/g, ' ');
			/*
			 * **Gegenprobe gegen die alte Wirkung: Sie steht nach mehr als sechs
			 * Sekunden noch da.** Die Quittungsecke räumt nach `DAUER` (6000 ms);
			 * gewartet wird ein gutes Stück darüber, damit ein Zeitgeber, der knapp
			 * nach der Frist feuert, nicht als Stehenbleiben durchgeht.
			 */
			await leitung.waitForTimeout(7500);
			behaupte(
				await meldungsabsatz.first().isVisible(),
				'Die Warnung zum Folgeantrag ohne Mehr ist nach 7,5 Sekunden verschwunden; sie soll stehen bleiben, bis die Leitung sie schliesst'
			);
			behaupte(
				meldung.includes('Das Mehr ist noch nicht gesetzt'),
				`Die Warnung sagt nicht, dass das Mehr nicht gesetzt ist: ${meldung.slice(0, 300)}`
			);
			behaupte(
				meldung.includes('Antrag zurückziehen'),
				`Die Warnung nennt den Weg «Antrag zurückziehen» nicht: ${meldung.slice(0, 300)}`
			);

			const zeile = leitung.locator('ul.baum > li', { hasText: titel }).last();
			await zeile.waitFor({ state: 'visible', timeout: 8000 });
			const gelesen = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Folgeantrag/.test(gelesen),
				`Die Zeile weist ihn nicht als Folgeantrag aus: ${gelesen.slice(0, 200)}`
			);
			const nummer = (await zeile.locator('.nr').first().innerText()).trim();
			behaupte(
				nummer.startsWith(`${grundnummer}.`),
				`Der Folgeantrag steht nicht unter ${grundnummer}, sondern unter ${nummer}`
			);
			behaupte(
				(await zeile.locator('a[title="Mehrheitserfordernis ändern"]').count()) === 0,
				`Am Folgeantrag steht ein Mehr, obwohl es milder ist als das der Einladung: ${gelesen.slice(0, 200)}`
			);
			behaupte(
				await zeile.locator('a', { hasText: 'Erfordernis setzen' }).count(),
				`Die Zeile bietet «Erfordernis setzen» nicht an: ${gelesen.slice(0, 200)}`
			);
			const nachher = await unterDemGrundantrag();
			behaupte(
				nachher === vorher + 1,
				`Unter ${grundnummer} stehen ${nachher} Folgeanträge, erwartet ${vorher + 1}`
			);
			const grundmehrNachher = await mehrDesGrundantrags();
			behaupte(
				grundmehrNachher === grundmehrVorher,
				`Das Mehr des Grundantrags hat sich verändert: «${grundmehrVorher}» zu «${grundmehrNachher}»`
			);

			/*
			 * **Der Reihenfolgehinweis am Grundantrag nennt ihn als ohne Mehr**
			 * (Codeprüfung N1, 06.10.2026; `reihenfolgehinweis` in
			 * `domain/folgeantrag.ts`). Je nach Lage steht «… Folgeantrag ohne
			 * Mehrheitserfordernis offen: …» oder «Noch ohne
			 * Mehrheitserfordernis ist: …»; in beiden Fassungen folgt die
			 * Nummer mit Titel auf die Worte «ohne Mehrheitserfordernis».
			 */
			const benannt = `${nummer} ${titel}`;
			const reihenfolgeVorher = (
				await grundzeile.first().locator('p.reihenfolge').allInnerTexts()
			)
				.join(' ')
				.replace(/\s+/g, ' ');
			const ohneAb = reihenfolgeVorher.indexOf('ohne Mehrheitserfordernis');
			behaupte(
				ohneAb >= 0 && reihenfolgeVorher.lastIndexOf(benannt) > ohneAb,
				`Der Reihenfolgehinweis am Spielplatz nennt «${benannt}» nicht als ohne Mehrheitserfordernis: ${reihenfolgeVorher.slice(0, 300) || '(kein Hinweis)'}`
			);

			// Aufräumen über den Weg, den der Hinweis nennt.
			const ausklapper = zeile.locator('details.rueckzug');
			behaupte(await ausklapper.count(), 'Die Zeile bietet «Antrag zurückziehen» nicht an');
			await ausklapper.locator('summary').first().click();
			const grund = ausklapper.locator('input[name="grund"]');
			await grund.waitFor({ state: 'visible', timeout: 5000 });
			const rueckzugsgrund = 'Von der Versammlung verschoben an eine weitere Versammlung';
			await grund.fill(rueckzugsgrund);
			await abschicken(
				leitung,
				ausklapper.locator('form[action="?/zurueckziehen"] button[type="submit"]').first()
			);
			await behaupteText(
				leitung,
				`«${titel}» ist zurückgezogen`,
				'Der Folgeantrag ohne Mehr ist nicht zurückgezogen'
			);
			// Dauerhaft, nicht nur an der Quittung (Codeprüfung N2): der Vermerk
			// mit dem Grund in seiner Zeile.
			const vermerk = zeile.locator('p.rueckzugsvermerk', { hasText: rueckzugsgrund });
			await vermerk.first().waitFor({ state: 'visible', timeout: 8000 }).catch(nurZeitablauf);
			behaupte(
				await vermerk.count(),
				`Die Zeile führt keinen Rückzugsvermerk mit dem Grund: ${(await zeile.innerText()).replace(/\s+/g, ' ').slice(0, 200)}`
			);
			// Die Reihenfolge am Spielplatz nennt ihn danach nicht mehr als offen.
			const reihenfolge = await grundzeile
				.first()
				.locator('p.reihenfolge')
				.allInnerTexts();
			behaupte(
				!reihenfolge.some((r) => r.includes(titel)),
				`Der zurückgezogene Folgeantrag steht weiter als offen am Spielplatz: ${reihenfolge.join(' | ').slice(0, 300)}`
			);
			return `${nummer} ohne Mehr aufgenommen, zurückgezogen`;
		});

		/*
		 * **Der Grundantrag lässt sich jetzt nicht zurückziehen** (offener Punkt
		 * der Bedienbarkeitsprüfung vom 05.09.2026, behoben am 08.09.2026).
		 * Solange der Folgeantrag offen an ihm hängt, stünde sonst im Saal ein
		 * Änderungsantrag zu einem Antrag, den es nicht mehr gibt.
		 *
		 * Geprüft wird die Oberfläche **und** dass sie den Grund nennt: Ein
		 * verschwundener Knopf ohne Erklärung ist im Saal schlimmer als ein
		 * Knopf, der absagt. Die Zusicherung selbst hängt nicht hieran — der
		 * Kern prüft es unabhängig (`tests/db/rueckzug.test.ts`).
		 */
		await schritt('Der Grundantrag lässt sich nicht zurückziehen, solange der Folgeantrag offen ist', async () => {
			const zeile = leitung.locator('ul.baum > li', { hasText: 'Spielplatz' }).last();
			const ausklapper = zeile.locator('details.rueckzug').first();
			behaupte(await ausklapper.count(), 'Kein Ausklapper «Antrag zurückziehen» am Grundantrag');
			await ausklapper.locator('summary').click();
			await leitung.waitForTimeout(150);

			behaupte(
				(await ausklapper.locator('form[action="?/zurueckziehen"]').count()) === 0,
				'Das Rückzugsformular steht da, obwohl ein Folgeantrag offen hängt'
			);
			const satz = (await ausklapper.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/hängt noch ein Folgeantrag/.test(satz),
				`Der Ausklapper nennt den Grund nicht: «${satz.slice(0, 120)}»`
			);
			behaupte(
				/Abstimmung/.test(satz) && /Rückzug/.test(satz),
				'Der Satz nennt nicht beide Wege heraus'
			);
			return satz.slice(0, 60);
		});

		await schritt('Den Folgeantrag auf Zulässigkeit prüfen lassen', async () => {
			/*
			 * **FR-60 im Saal.** Zwei Dinge werden hier durchgespielt und beide
			 * sind wichtiger als die Einschätzung selbst: Der Knopf steht **am
			 * Antrag**, nicht in einem Menü — die Prüfung hat genau einen
			 * Augenblick, den zwischen «jemand stellt einen Antrag» und «wir
			 * stimmen ab». Und ein Ausfall bricht die Sitzung nicht ab.
			 *
			 * **Seit dem 08.09.2026 am aufgerufenen Geschäft**, nicht mehr an der
			 * Zeile in der Liste; in der Liste stand sie je Traktandum zweimal.
			 * Deshalb ruft der Schritt den Folgeantrag zuerst auf. Gesucht wird
			 * ausdrücklich **innerhalb** von `.geschaeft`: Stünde der Knopf wieder
			 * irgendwo in der Liste, wäre dieser Schritt rot statt stillschweigend
			 * grün.
			 */
			const zeile = leitung
				.locator('ul.baum > li', { hasText: 'Sanierung nur der Wetterseite' })
				.last();
			const aufrufen = zeile.locator('form[action="?/aufrufen"] button').first();
			behaupte(await aufrufen.count(), 'Der Folgeantrag lässt sich nicht aufrufen');
			await abschicken(leitung, aufrufen);

			/*
			 * **Auf den Knopf warten, nicht sofort zählen.** Dieselbe Klasse, die
			 * zwei Schritte weiter unten ausgeschrieben steht: Die Leitungssicht
			 * sendet über `use:enhance`, `abschicken` kehrt mit der Antwort des
			 * Servers zurück, und das Neuzeichnen läuft danach. Wer unmittelbar
			 * zählt, misst den Geschäftskasten des vorherigen Traktandums.
			 */
			const geschaeft = leitung.locator('.geschaeft');
			const knopf = geschaeft.locator('form[action="?/kiantrag"] button').first();
			await knopf.waitFor({ timeout: 10_000 }).catch(() => {});
			behaupte(
				await knopf.count(),
				'Kein Knopf zur Zulässigkeitsprüfung beim aufgerufenen Folgeantrag'
			);
			await knopf.click();

			const ergebnis = geschaeft.locator('.antragspruefung');
			await ergebnis.first().waitFor({ timeout: 40_000 });
			if (await geschaeft.locator('.antragspruefung .fehlschlag').count()) {
				return 'Anbieter antwortete nicht — Hinweis statt Abbruch';
			}

			const gelesen = (await ergebnis.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Sie entscheiden/i.test(gelesen),
				`Die Einschätzung tritt als Verbot auf statt als Einschätzung: ${gelesen.slice(0, 160)}`
			);
			// Auch hier: nachsehbar, was hinausging.
			behaupte(
				await geschaeft.locator('.antragspruefung details.hinausgegangen pre').count(),
				'Es lässt sich nicht ansehen, was übermittelt wurde'
			);
			/*
			 * **«Ich entscheide anders» zeigt den Satz zur Abweichung**
			 * (`docs/freigabe.md`, «Offen: Reste zur Universalversammlung», Punkt
			 * 13). Bis zum 30.09.2026 stand er nirgends. Die Einschätzung des
			 * Modells ist nicht festgelegt: Bei «sachfremd» und «im Rahmen» muss ein
			 * Satz erscheinen, bei «grenzwertig» keiner.
			 */
			// Aus der Einordnung, nicht aus dem ganzen Kasten: Die freie Begründung
			// des Modells kann dieselben Wörter enthalten.
			const einordnung = await geschaeft.locator('.antragspruefung .einordnung').first().innerText();
			const einschaetzung = /Verlässt das angekündigte Geschäft/.test(einordnung)
				? 'sachfremd'
				: /Hält sich im angekündigten Geschäft/.test(einordnung)
					? 'im_rahmen'
					: 'grenzwertig';
			const anders = geschaeft.locator('form[action="?/kiantragentscheid"] button[value="abgelehnt"]');
			// Ohne festgehaltene Nutzung gibt es keinen Knopf (`nutzungId` null).
			if (!(await anders.count())) return `${einschaetzung}, ohne Entscheidknopf`;
			await abschicken(leitung, anders.first());
			// Anker: Erst wenn der Kasten weg ist, ist neu gezeichnet. Sonst zählte
			// «keinen Satz» bei «grenzwertig» den Stand vor dem Neuzeichnen.
			await geschaeft.locator('.antragspruefung').waitFor({ state: 'detached', timeout: 10_000 });
			const satz = geschaeft.locator('.abweichung .meldung');
			if (einschaetzung === 'grenzwertig') {
				behaupte(!(await satz.count()), 'Bei «grenzwertig» erscheint ein Satz zur Abweichung');
			} else {
				await satz.first().waitFor({ timeout: 10_000 }).catch(() => {});
				const text = (await satz.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
				behaupte(
					einschaetzung === 'sachfremd'
						? /Halten Sie im Protokoll fest, worauf sich die Zulassung stützt/.test(text)
						: /Der Grund gehört ins Protokoll/.test(text),
					`Nach «Ich entscheide anders» (${einschaetzung}) fehlt der Satz: «${text.slice(0, 200)}»`
				);
			}
			return `${einschaetzung}, anders entschieden`;
		});


		await schritt('Über den Folgeantrag darf abgestimmt werden', async () => {
			await leitung.goto(
				`${ZIEL}/versammlungen/${versammlungId}/traktanden/${folgeantragId}/erfordernis`,
				{ waitUntil: 'domcontentloaded' }
			);
			const aufklappen = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await aufklappen.count()) await aufklappen.click();
			const auswahl = leitung.locator('select[name="typ"]').first();
			await auswahl.waitFor({ state: 'visible', timeout: 5000 });
			/*
			 * **Qualifiziert, nicht mehr einfach** (06.10.2026, seit `43c96bd`).
			 * Ein Folgeantrag hält das Mehr, das die Einladung für sein
			 * angekündigtes Traktandum nennt. Für den Spielplatz ist das das
			 * qualifizierte Mehr, gesetzt auf demselben Direktweg und seit dem
			 * 06.10.2026 vor der Freigabe fest wiederhergestellt, unabhängig von
			 * der Empfehlung des Modells. Über einem qualifizierten Mehr wiese der
			 * Server das einfache mit `milder_als_einladung` ab; das qualifizierte
			 * hält die Untergrenze genau. Nennt die Einladung ein strengeres, etwa eine
			 * Reglementsregel, `alle_eigentuemer` oder Einstimmigkeit, weist der
			 * Server ab, und der Schritt wird laut rot. Von Hand gesetzt trägt es
			 * wie bisher keine Zustimmung der Betroffenen, die das Öffnen
			 * sperrte.
			 */
			await auswahl.selectOption('qualifiziertes_mehr');
			const begruendung = leitung.locator('[name="begruendung"]').first();
			if (await begruendung.count()) {
				await begruendung.fill('Prüflauf: Folgeantrag zum angekündigten Antrag.');
			}
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			/*
			 * **Nur aufrufen, wenn er es nicht schon ist** (08.09.2026). Seit die
			 * Zulässigkeitsprüfung am aufgerufenen Geschäft steht statt an der
			 * Zeile, ruft der Schritt davor den Folgeantrag bereits auf — und ein
			 * aufgerufenes Traktandum hat keinen «Aufrufen»-Knopf mehr. Das
			 * Aufrufen ist hier Vorbereitung, nicht der Nachweis; der steht
			 * darunter. Dass er danach wirklich das aufgerufene Geschäft ist, misst
			 * der Sucher unten mit: Die `?/oeffnen`-Formulare tragen die Kennung von
			 * `data.aktuelles`, und gesucht wird die des Folgeantrags.
			 */
			const aufrufen = leitung.locator(
				`form[action="?/aufrufen"]:has(input[value="${folgeantragId}"]) button[type="submit"]`
			);
			if (await aufrufen.count()) await abschicken(leitung, aufrufen.first());

			// Der eigentliche Nachweis: Die Freigabe geht durch, ohne dass die
			// Versammlung irgendetwas genehmigt hätte.
			/*
			 * **Auf den Knopf warten, nicht sofort zählen** (03.09.2026). Dieser
			 * Schritt war einmal in vier Läufen rot, ohne dass etwas fehlte. Die
			 * Leitungssicht sendet über `use:enhance`, also ohne Navigation:
			 * `abschicken` kehrt mit der Antwort des Servers zurück, das
			 * Neuzeichnen läuft danach, und die feste Nachlauffrist von 120 ms
			 * reicht nicht immer. Wer unmittelbar zählt, misst den Stand von
			 * vorher — dieselbe Klasse wie bei `warteAufTreffer` weiter oben.
			 *
			 * Bewiesen ist die Ursache nicht (ein Fehlschlag in vier Läufen lässt
			 * sich nicht günstig nachstellen); die Stelle ist damit aber gegen
			 * genau diese Klasse abgesichert, und ein echter Befund kommt nach
			 * zehn Sekunden immer noch durch.
			 */
			/*
			 * **Auf das Formular DIESES Traktandums warten** (aus dem Code-Review
			 * derselben Aenderung). Beide `?/oeffnen`-Formulare der Leitungssicht
			 * hängen an `data.aktuelles` und tragen dessen Kennung. Ein Warten auf
			 * `form[action="?/oeffnen"]` kehrt deshalb sofort zurück — mit dem
			 * Formular des VORHERIGEN Traktandums, das noch dasteht, solange das
			 * Neuzeichnen läuft. Die Zusicherung wäre grün, und der Klick danach
			 * gäbe das falsche Traktandum frei. Genau die Verzögerung, gegen die
			 * dieses Warten gebaut ist, macht den Fehler möglich.
			 */
			const oeffnen = leitung.locator(
				`form[action="?/oeffnen"]:has(input[value="${folgeantragId}"]) button[type="submit"]`
			);
			await oeffnen
				.first()
				.waitFor({ timeout: 10_000 })
				.catch(() => {});
			behaupte(
				await oeffnen.count(),
				'Der Folgeantrag lässt sich nicht zur Abstimmung freigeben, obwohl der Gegenstand angekündigt war'
			);
			await abschicken(leitung, oeffnen.first());
			await behaupteOhne(
				leitung,
				'nicht angekündigt',
				'Die Freigabe wurde als nicht angekündigt abgewiesen'
			);

			// Wieder schliessen, sonst hinge die Versammlung mit offener Abstimmung
			// im nächsten Schritt fest — und der Befund wäre einer über den Test.
			// Die Rückfrage «noch nicht alle haben gestimmt» beantwortet der
			// Sammelhandler oben und schreibt sie in die Liste der Rückfragen.
			const schliessen = leitung
				.locator('form[action="?/schliessen"] button[type="submit"]')
				.first();
			/*
			 * **Auf den Knopf warten, bevor gezählt wird** (Beobachtung einer anderen
			 * Sitzung, `docs/proben.md`, Durchstich zu Schritt 47): Die Leitungssicht
			 * sendet über `use:enhance`, das Neuzeichnen läuft nach der Antwort. Ein
			 * `count()` unmittelbar nach dem Absenden las den Stand von vorher und
			 * meldete einmal «Kein Knopf», während das Bildschirmbild ihn zeigte
			 * (Gitea-CI baute gleichzeitig Docker-Netze um). Echte Befunde kommen nach
			 * zehn Sekunden weiter durch.
			 */
			await schliessen.waitFor({ timeout: 10_000 }).catch(() => {});
			behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen der Abstimmung');
			await abschicken(leitung, schliessen);
			return 'freigegeben ohne Genehmigungsbeschluss';
		});

		// ── Abschluss ───────────────────────────────────────────────────────
		console.log('\nAbschluss');

		/*
		 * **Rückkommen** (Welle 3, FR-44). Über Traktandum 4 ist abgestimmt — und
		 * die Versammlung will noch einmal entscheiden. Das steht **ihr** zu, nicht
		 * der Sitzungsleitung: Deshalb entsteht ein eigener Antrag, über den
		 * zuerst abgestimmt wird.
		 */
		await schritt('Rückkommen: ohne Beschluss der Versammlung kein zweiter Durchgang', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			// Das behandelte Traktandum lässt sich nicht einfach nochmals aufrufen
			// und öffnen — der Knopf «Abstimmung eröffnen» führt in die Absage.
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/oeffnen`,
				{ form: { traktandum: traktandumId }, headers: { origin: ZIEL } }
			);
			const roh = await antwort.text();
			behaupte(
				/angenommenen R[^"]{0,3}ckkommensantrag/.test(roh),
				`Ein zweiter Durchgang war ohne Rückkommen möglich: ${roh.slice(0, 300)}`
			);
			return 'abgewiesen, mit dem Weg dahin';
		});

		await schritt('Rückkommensantrag stellen und annehmen lassen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			// **Nicht `hasText` allein**: «Rückkommen auf 4 Fassadensanierung» enthält
			// denselben Text. Gemeint ist die Zeile des Grundantrags.
			const zeile = leitung
				.locator('li', { hasText: 'Fassadensanierung' })
				.filter({ hasNotText: 'Rückkommen auf' })
				.last();
			/*
			 * **Zwei Wege, derselbe Antrag.** Ist das Traktandum gerade aufgerufen,
			 * steht das Rückkommen oben unter «Jetzt möglich» — sonst an seiner
			 * Zeile in der Liste. Doppelt stünde es nirgends: Wer es oben findet,
			 * soll es unten nicht nochmals suchen müssen.
			 */
			const jetzt = (await leitung.locator('li.jetzt').innerText().catch(() => '')).replace(
				/\s+/g,
				' '
			);
			// **Nur wenn oben wirklich dieses Traktandum steht.** Sonst zeigte die
			// Zeile das Rückkommen auf ein ganz anderes Geschäft, und der Lauf
			// prüfte den falschen Text — genau das ist am 13.08.2026 passiert.
			const obenDa =
				/Fassadensanierung/.test(jetzt) &&
				!/Rückkommen auf/.test(jetzt) &&
				(await leitung.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' }).count()) > 0;
			const bereich = obenDa ? leitung.locator('.eingriffe') : zeile;
			const aufklappen = obenDa
				? leitung.locator('.eingriffe .wort', { hasText: 'Nochmals abstimmen' }).first()
				: zeile.locator('details.rueckkommen summary');
			behaupte(await aufklappen.count(), 'Kein Weg, das Rückkommen zu beantragen');
			await aufklappen.click();
			await leitung.waitForTimeout(150);

			// Der Grundsatz zum Erfordernis muss dastehen, nicht bloss im Code
			// stecken: dasselbe Mehr wie der Beschluss, auf den zurückgekommen wird.
			const text = (await bereich.innerText()).replace(/\s+/g, ' ');
			// Der Zielantrag wurde angenommen — also zielt das Rückkommen auf seine
			// Aufhebung, und dafür gilt dasselbe Mehr (Regel der Anwendung, Ä-34).
			behaupte(
				/dasselbe Mehr wie f[^ ]*r den Beschluss selbst/i.test(text),
				`Der Grundsatz zum Erfordernis fehlt: ${text.slice(0, 400)}`
			);
			behaupte(
				// «Nein heisst Nein» (Produktentscheid 30.09.2026): nur ohne Beschluss.
				// Seit B2b auch beim geänderten Antrag (Folgeantrag nach Rückkommen).
				/auch eine Ablehnung, hebt den bisherigen auf, auch bei einem geänderten Antrag; nur wenn gar kein Beschluss zustande kommt, bleibt er in Kraft/i.test(text),
				`Der Hinweis auf den fortbestehenden Beschluss fehlt: ${text.slice(0, 400)}`
			);

			await abschicken(
				leitung,
				bereich.locator('form[action="?/rueckkommen"] button[type="submit"]')
			);
			await behaupteText(leitung, 'Rückkommen auf', 'Der Rückkommensantrag steht nicht auf der Liste');

			// Darüber abstimmen — mit beiden Telefonen, damit es ein echter
			// Beschluss der Versammlung ist.
			const antrag = leitung.locator('li', { hasText: 'Rückkommen auf' }).last();
			await abschicken(leitung, antrag.locator('form[action="?/aufrufen"] button'));
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);

			for (const seite of [telefon, telefonB]) {
				aktuelleSeite = seite;
				await seite.goto(`${ZIEL}/z`, { waitUntil: 'domcontentloaded' });
				const ja = seite.locator('form.wahl button.ja').first();
				behaupte(await ja.count(), 'Das Telefon zeigt die Frage zum Rückkommen nicht');
				await abschicken(seite, ja);
			}
			aktuelleSeite = leitung;

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			await behaupteText(leitung, 'Angenommen', 'Das Rückkommen wurde nicht angenommen');
			return 'angenommen';
		});

		/*
		 * Hier stand bis H6 der Schritt «Neuabstimmung nach dem Rückkommen — der
		 * frühere Beschluss gilt wieder» (Migration 131). Die Leitung überholt
		 * seither kein verkündetes Ergebnis mehr, und der Fall entsteht nicht
		 * mehr; was an seine Stelle tritt, prüft der Schritt nach «Nein heisst
		 * Nein».
		 */
		await schritt('Nach dem Rückkommen wird neu abgestimmt — Nein heisst Nein', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung
				.locator('li', { hasText: 'Fassadensanierung' })
				.filter({ hasNotText: 'Rückkommen auf' })
				.last();

			/*
			 * **Die Telefone bleiben stehen, wo sie sind** (05.09.2026).
			 *
			 * Bis hierher lud dieses Drehbuch sie nach jedem Schritt mit `goto`
			 * neu — und umging damit genau die Frage, die der Plan als offen
			 * führte: Merkt ein Telefon von selbst, dass ein **zweiter Durchgang**
			 * zum selben Traktandum aufgerufen wurde? Im Saal drückt niemand
			 * «neu laden»; wer es nicht merkt, stimmt nicht mit.
			 *
			 * Der Fall ist heikler als der erste Aufruf, weil die Bremse
			 * `ladeNeuFuer` (siehe `routes/z/+page.svelte`) sich merkt, wofür schon
			 * geladen wurde. Ein zweiter Durchgang am selben Traktandum ist genau
			 * die Lage, in der eine zu grob gewählte Marke nicht mehr auslöst.
			 */
			for (const s of [telefon, telefonB]) {
				await s.goto(`${ZIEL}/z`, { waitUntil: 'domcontentloaded' });
			}

			// Nach dem Schritt davor ist das Geschäft schon aufgerufen; dann steht
			// an seiner Zeile kein «Aufrufen».
			const aufrufen = zeile.locator('form[action="?/aufrufen"] button');
			if (await aufrufen.count()) await abschicken(leitung, aufrufen);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);

			for (const [i, s] of [telefon, telefonB].entries()) {
				aktuelleSeite = s;
				// Ohne Zutun: Der Ereignisstrom muss das Telefon nachziehen.
				await s
					.locator('form.wahl button.nein')
					.first()
					.waitFor({ state: 'visible', timeout: 20000 })
					.catch(() => {});
				behaupte(
					await s.locator('form.wahl button.nein').first().count(),
					`Telefon ${i + 1} zeigt den zweiten Durchgang nicht, ohne dass jemand neu lädt`
				);
			}
			aktuelleSeite = leitung;

			// Diesmal dagegen — das Ergebnis kippt.
			for (const seite of [telefon, telefonB]) {
				aktuelleSeite = seite;
				await abschicken(seite, seite.locator('form.wahl button.nein').first());
			}
			aktuelleSeite = leitung;

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);

			/*
			 * **Nein heisst Nein** (Produktentscheid 30.09.2026, `docs/freigabe.md`,
			 * Punkt (a)). Die Ablehnung ersetzt den früheren Beschluss, und die
			 * Leitung sieht, was der Saal eben entschieden hat. Bis dahin blieb der
			 * frühere massgebend, und hier stand nach dem Nein «Angenommen».
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const geltend = leitung
				.locator('article.ergebnis', { hasText: 'Fassadensanierung' })
				.filter({ hasNotText: 'Rückkommen auf' })
				.first();
			const ergebnistext = (await geltend.innerText().catch(() => '')).replace(/\s+/g, ' ');
			behaupte(
				/Abgelehnt/.test(ergebnistext) && !/Angenommen/.test(ergebnistext),
				`Nach dem Nein steht nicht die Ablehnung als geltend: «${ergebnistext.slice(0, 300)}»`
			);

			// Ein zweiter Durchgang mit demselben Rückkommensbeschluss geht nicht.
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/oeffnen`,
				{ form: { traktandum: traktandumId }, headers: { origin: ZIEL } }
			);
			const roh = await antwort.text();
			behaupte(
				/bereits zur[^"]{0,3}ckgekommen|neuen R[^"]{0,3}ckkommensantrag/.test(roh),
				`Der Rückkommensbeschluss trug einen zweiten Durchgang: ${roh.slice(0, 300)}`
			);
			return 'abgelehnt und massgebend, Erlaubnis verbraucht';
		});

		/*
		 * **Ein verkündetes Ergebnis überholt die Leitung nicht** (H6;
		 * Fachprüfung 08.10.2026, `quellen` Frage 65). Ein verkündeter Beschluss
		 * wirkt, bis er nach Art. 75 aufgehoben ist, und ändern kann ihn nur die
		 * Versammlung. Das Schliessen verkündet; am Ergebnis steht deshalb kein
		 * «Neuabstimmung ansetzen» mehr, und ein von Hand gesendeter Aufruf wird
		 * mit dem Weg über das Rückkommen abgewiesen, ohne etwas zu ändern.
		 */
		await schritt('Neuabstimmung auf ein verkündetes Ergebnis — nur über das Rückkommen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const geltend = leitung
				.locator('article.ergebnis', { hasText: 'Fassadensanierung' })
				.filter({ hasNotText: 'Rückkommen auf' })
				.first();
			behaupte(await geltend.count(), 'Das Ergebnis der Fassadensanierung fehlt');
			behaupte(
				(await geltend.locator('details.neu').count()) === 0,
				'Am verkündeten Ergebnis steht noch «Neuabstimmung ansetzen»'
			);
			const durchgang = await geltend
				.locator('input[name="durchgang"]')
				.first()
				.getAttribute('value')
				.catch(() => null);
			behaupte(durchgang, 'Am Ergebnis fehlt die Kennung des Durchgangs');

			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/neuabstimmung`,
				{ form: { durchgang, begruendung: 'Durchstich: Stimmen doppelt erfasst' }, headers: { origin: ZIEL } }
			);
			const roh = await antwort.text();
			behaupte(
				// Im selben Satz: «Nochmals abstimmen» trägt die Seite auch sonst.
				/verk[^"]{0,3}ndet und gilt[^"]{0,200}Nochmals abstimmen/.test(roh),
				`Die Neuabstimmung auf das verkündete Ergebnis wurde nicht abgewiesen: ${roh.slice(0, 300)}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const nachher = (
				await leitung
					.locator('article.ergebnis', { hasText: 'Fassadensanierung' })
					.filter({ hasNotText: 'Rückkommen auf' })
					.first()
					.innerText()
					.catch(() => '')
			).replace(/\s+/g, ' ');
			behaupte(
				/Abgelehnt/.test(nachher),
				`Nach der Absage steht nicht mehr die Ablehnung als geltend: «${nachher.slice(0, 300)}»`
			);
			return 'abgewiesen, Weg über das Rückkommen genannt, nichts geändert';
		});

		/*
		 * **Betroffene im Saal, Vorab-Zustimmung und Widerruf** (Block A2,
		 * 25.09.2026). Bis dahin liessen sich Betroffene nur im Entwurf
		 * zuordnen, und die Sperre beim Eröffnen hatte im Saal keinen Weg.
		 *
		 * **Bucher ist betroffen, nicht Aebi.** Betroffene stehen in der
		 * Auswertung namentlich (die Ausnahme von NFR-17, deren Zustimmung das
		 * Gesetz verlangt), und der Schritt «Auswertung belegt …» misst, dass
		 * «Aebi» dort nicht steht. Die Stimmen erfasst die Sitzungsleitung
		 * stellvertretend und namentlich: Welche Partei an welchem Telefon hängt,
		 * steht in diesem Drehbuch nicht fest.
		 */
		const betroffen = `Bucher ${LAUF}`;
		/** Die Kennungen der drei Parteien, aus der Wahlliste des Eintragens. */
		const parteikennungen = {};
		async function stimmeFuer(name, wahl) {
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/stellvertretend`,
				{
					headers: { origin: ZIEL },
					form: {
						partei: parteikennungen[name],
						wahl,
						begruendung: 'Prüflauf: von der Sitzungsleitung erfasst'
					}
				}
			);
			const roh = await antwort.text();
			behaupte(
				antwort.ok() && !/"fehler"/.test(roh),
				`Die Stimme für ${name} wurde nicht erfasst: ${roh.slice(0, 300)}`
			);
		}
		async function traktandumAufrufen(titel) {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('li', { hasText: titel }).last();
			await abschicken(leitung, zeile.locator('form[action="?/aufrufen"] button'));
		}
		async function eintragenUndVermerken() {
			const wort = leitung.locator('.eingriffe .wort', { hasText: 'Betroffene' });
			behaupte(await wort.count(), '«Betroffene» steht nicht unter «Jetzt möglich»');
			await wort.first().click();
			const ein = leitung.locator('.eingriffe form[action="?/betroffeneEin"]');
			await ein.waitFor({ state: 'visible', timeout: 5000 });
			for (const name of [`Aebi ${LAUF}`, `Bucher ${LAUF}`, `Christen ${LAUF}`]) {
				const wert = await ein
					.locator('label', { hasText: name })
					.locator('input')
					.first()
					.getAttribute('value');
				behaupte(wert, `${name} steht nicht zur Wahl`);
				parteikennungen[name] = wert;
			}
			await ein.locator('label', { hasText: betroffen }).locator('input').first().check();
			await abschicken(leitung, ein.locator('button[type="submit"]'));
			await behaupteText(leitung, 'als betroffen eingetragen', 'Keine Bestätigung des Eintrags');

			if (!(await leitung.locator('.eingriffe form[action="?/vorabVermerken"]').count())) {
				await leitung.locator('.eingriffe .wort', { hasText: 'Betroffene' }).first().click();
			}
			const vermerk = leitung.locator('.eingriffe form[action="?/vorabVermerken"]');
			await vermerk.waitFor({ state: 'visible', timeout: 5000 });
			await vermerk.locator('input[name="vermerk"]').fill('Schreiben vom 12.09.2026');
			await abschicken(leitung, vermerk.locator('button[type="submit"]'));
			await behaupteText(leitung, 'Vorab-Zustimmung ist vermerkt', 'Keine Bestätigung des Vermerks');
		}

		/*
		 * **Das Veto im Ausstand** (Auftrag vom 26.09.2026, ZGB Art. 712g
		 * Abs. 4). Die Betroffene stimmt bei der Mehrheit nicht mit; über die
		 * Zustimmung entscheidet sie trotzdem, am Telefon oder mündlich. Die
		 * beiden folgenden Schritte gehen beide Ausgänge durch: einmal trägt
		 * das Veto den Antrag, einmal fehlt die Zustimmung trotz Mehrheit.
		 */

		/** Wer am Telefon `telefon` angemeldet ist, aus der Seite gelesen. */
		async function telefonpartei() {
			await gehe(telefon, '/z');
			const name = telefon.locator('.ich .name');
			behaupte(await name.count(), 'Das Telefon zeigt keinen erkannten Namen');
			return (await name.innerText()).trim();
		}

		/** Parteien beim aufgerufenen Traktandum als betroffen eintragen. */
		async function betroffeneEintragen(namen) {
			const wort = leitung.locator('.eingriffe button.wort', { hasText: 'Betroffene' });
			/*
			 * **Warten, nicht sofort zählen** (04.10.2026). Die Wörter entstehen
			 * erst mit dem Aufruf des Traktandums; auf der gewachsenen
			 * Prüfdatenbank brauchte die Seite dafür wiederholt einen Moment,
			 * und die sofortige Zählung meldete «steht nicht» — dieselbe Klasse,
			 * gegen die `warteAufTreffer` gebaut ist. Der Befund stand dreimal
			 * an derselben Stelle, zweimal davon vor den Fixes dieses Laufs.
			 */
			await wort.first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
			behaupte(await wort.count(), '«Betroffene» steht nicht unter «Jetzt möglich»');
			const ein = leitung.locator('.eingriffe form[action="?/betroffeneEin"]');
			await klickeBis(leitung, wort.first(), ein);
			for (const name of namen) {
				const kaestchen = ein.locator('label', { hasText: name }).first();
				behaupte(await kaestchen.count(), `${name} steht nicht zur Wahl`);
				await kaestchen.click();
			}
			await abschicken(leitung, ein.locator('button[type="submit"]').first());
			await behaupteText(leitung, 'als betroffen eingetragen', 'Keine Bestätigung des Eintrags');
		}

		/** Einen Ausstand über «Was jetzt geht» erklären. */
		async function ausstandErklaeren(name, grund) {
			const wort = leitung.locator('.eingriffe button.wort', { hasText: 'Ausstand' });
			behaupte(await wort.count(), '«Ausstand» steht nicht unter «Jetzt möglich»');
			const form = leitung.locator('.eingriffe form[action="?/ausstand"]');
			await klickeBis(leitung, wort.first(), form);
			const suche = form.locator('input[type="search"]');
			if (await suche.count()) await suche.fill(name);
			const treffer = form.locator('label', { hasText: name });
			behaupte(await treffer.count(), `${name} steht nicht zur Wahl`);
			await treffer.first().click();
			await form.locator('input[name="grund"]').fill(grund);
			await abschicken(leitung, form.locator('button[type="submit"]').first());
			await behaupteText(leitung, 'in den Ausstand', 'Der Ausstand wurde nicht erklärt');
		}

		/** Den mündlichen Veto-Entscheid erfassen — über «Was jetzt geht». */
		async function vetoMuendlich(name, entscheid) {
			const wort = leitung.locator('.eingriffe button.wort', { hasText: 'Veto' });
			behaupte(await wort.count(), '«Veto» steht nicht unter «Jetzt möglich»');
			/*
			 * **Das Ziel muss eindeutig sein**: Je Betroffene steht ein eigenes
			 * Formular, und ein Locator über mehrere Elemente lässt `klickeBis`
			 * das Panel abwechselnd öffnen und schliessen.
			 */
			const form = leitung.locator('.eingriffe form[action="?/veto"]').first();
			await klickeBis(leitung, wort.first(), form);
			const zeile = leitung.locator('.eingriffe .betroffenenliste li', { hasText: name });
			await zeile.waitFor({ state: 'visible', timeout: 5000 });
			await abschicken(leitung, zeile.locator(`form[action="?/veto"] button[value="${entscheid}"]`));
			await behaupteText(leitung, /Der Entscheid von .* ist erfasst/, 'Keine Bestätigung des Entscheids');
		}

		await schritt('Ohne Betroffene ist die Abstimmung gesperrt — mit dem Weg dorthin', async () => {
			await traktandumAufrufen('Gartensitzplatz');
			await behaupteText(
				leitung,
				'bei «Betroffene» ein',
				'Die Sperre nennt den Weg über das Eintragen nicht'
			);
			behaupte(
				(await leitung.locator('form[action="?/oeffnen"] button[type="submit"]').count()) === 0,
				'Der Knopf zum Eröffnen steht da, obwohl der Server abweist'
			);
			return 'gesperrt, Weg genannt';
		});

		await schritt('Betroffene im Saal eintragen und die Vorab-Zustimmung vermerken', async () => {
			await eintragenUndVermerken();
			await behaupteText(
				leitung,
				'vorab zugestimmt: Schreiben vom 12.09.2026',
				'Der Vermerk steht nicht bei der Partei'
			);
			behaupte(
				await leitung.locator('form[action="?/oeffnen"] button[type="submit"]').count(),
				'Nach dem Eintragen lässt sich die Abstimmung nicht eröffnen'
			);
			return `${betroffen}, Schreiben vom 12.09.2026`;
		});

		/*
		 * **Ohne Ergebnis abbrechen** (H6; Laien- und Fachprüfung 14.10.2026,
		 * F-1). Stimmt die Grundlage während der Abstimmung nicht, verkündet das
		 * Schliessen ein falsch gezähltes Ergebnis. Der Abbruch verkündet nichts,
		 * und danach lässt sich ohne Rückkommen neu freigeben; der Schritt danach
		 * tut genau das.
		 */
		await schritt('Ohne Ergebnis abbrechen — danach neu freigeben', async () => {
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);
			await stimmeFuer(`Aebi ${LAUF}`, 'yes');
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const abbruch = leitung.locator('details.abbruch');
			behaupte(await abbruch.count(), 'Unter der laufenden Abstimmung fehlt «Ohne Ergebnis abbrechen»');
			await abbruch.first().locator('summary').click();
			await abbruch
				.first()
				.locator('textarea[name="begruendung"]')
				.fill('Durchstich: Betroffene waren unvollständig');
			await abschicken(leitung, abbruch.first().locator('button[type="submit"]'));
			await behaupteText(leitung, 'ohne Ergebnis abgebrochen', 'Keine Bestätigung des Abbruchs');

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				(await leitung.locator('article.ergebnis', { hasText: 'Gartensitzplatz' }).count()) === 0,
				'Nach dem Abbruch steht ein Ergebnis zum Gartensitzplatz da'
			);
			behaupte(
				await leitung.locator('form[action="?/oeffnen"] button[type="submit"]').count(),
				'Nach dem Abbruch lässt sich die Abstimmung nicht neu freigeben'
			);
			return 'abgebrochen, nichts verkündet, neu freigebbar';
		});

		await schritt('Die Vorab-Zustimmung trägt, wenn die Betroffene sich enthält', async () => {
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);
			await stimmeFuer(`Aebi ${LAUF}`, 'yes');
			await stimmeFuer(`Christen ${LAUF}`, 'yes');
			await stimmeFuer(betroffen, 'abstain');
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			const ergebnis = leitung.locator('article.ergebnis', { hasText: 'Gartensitzplatz' }).last();
			await ergebnis.waitFor({ state: 'visible', timeout: 8000 });
			const satz = (await ergebnis.innerText()).replace(/\s+/g, ' ');
			behaupte(/Angenommen/i.test(satz), `Gartensitzplatz nicht angenommen: ${satz.slice(0, 300)}`);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				`Vorab schriftlich zugestimmt: ${betroffen} (laut Sitzungsleitung: Schreiben vom 12.09.2026)`,
				'Die Auswertung nennt die Vorab-Zustimmung nicht'
			);
			return 'angenommen, Vorab-Zustimmung in der Auswertung';
		});

		await schritt('Ein Nein im Saal widerruft die Vorab-Zustimmung', async () => {
			await traktandumAufrufen('Veloraum');
			await eintragenUndVermerken();
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);
			await stimmeFuer(`Aebi ${LAUF}`, 'yes');
			await stimmeFuer(`Christen ${LAUF}`, 'yes');
			await stimmeFuer(betroffen, 'no');
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			const ergebnis = leitung.locator('article.ergebnis', { hasText: 'Veloraum' }).last();
			await ergebnis.waitFor({ state: 'visible', timeout: 8000 });
			const satz = (await ergebnis.innerText()).replace(/\s+/g, ' ');
			behaupte(/Abgelehnt/i.test(satz), `Veloraum nicht abgelehnt: ${satz.slice(0, 300)}`);
			behaupte(
				/Auswertung zählt die vorab erteilte schriftliche Zustimmung damit nicht mehr/.test(satz),
				`Der Grund des Widerrufs steht nicht im Ergebnis: ${satz.slice(0, 300)}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				/Es fehlt die Zustimmung von Bucher[^.]*: Sie hatte vorab schriftlich zugestimmt/,
				'Die Auswertung nennt den Widerruf nicht'
			);
			return 'abgelehnt, Widerruf in Ergebnis und Auswertung';
		});

		await schritt('Veto im Ausstand: am Telefon zustimmen', async () => {
			const leute = [`Aebi ${LAUF}`, `Bucher ${LAUF}`, `Christen ${LAUF}`];
			const amTelefon = await telefonpartei();
			/*
			 * **Die Fallen dieses Bestands.** Bucher hält die Vollmacht für
			 * Christen; steht Bucher im Ausstand, ruht Christens Stimme. Und die
			 * Wertquotenschwelle bemisst sich an allen Quoten: Mit nur einer
			 * stimmenden Partei bleibt «Angenommen» unerreichbar. Für den Fall
			 * «das Veto trägt» braucht es darum die Betroffene am Telefon und
			 * **zwei** übrige Stimmen.
			 */
			behaupte(
				amTelefon !== `Bucher ${LAUF}`,
				`Dieser Schritt braucht ein Telefon, das nicht Bucher gehört: ${amTelefon}`
			);
			const waehler = leute.filter((n) => n !== amTelefon);

			await traktandumAufrufen('Veloabstellplatz');
			await betroffeneEintragen([amTelefon]);
			await ausstandErklaeren(amTelefon, 'Ihr Anteil wird entschädigt.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);

			// Am eigenen Telefon: die Betroffene entscheidet selbst.
			await gehe(telefon, '/z');
			const vetoForm = telefon.locator('form[action="?/veto"]');
			await vetoForm.first().waitFor({ state: 'visible', timeout: 8000 });
			await abschicken(telefon, vetoForm.first().locator('button[value="ja"]'));
			await behaupteText(telefon, 'Entscheid: Zustimmung', 'Das Telefon bestätigt das Veto nicht');
			aktuelleSeite = leitung;

			// Die beiden übrigen stimmen zu; die Mehrheit misst ohne die Betroffene.
			for (const name of waehler) await stimmeFuer(name, 'yes');
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			const ergebnis = leitung.locator('article.ergebnis', { hasText: 'Veloabstellplatz' }).last();
			await ergebnis.waitFor({ state: 'visible', timeout: 8000 });
			const satz = (await ergebnis.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Angenommen/i.test(satz),
				`Veloabstellplatz nicht angenommen: ${satz.slice(0, 300)}`
			);
			behaupte(
				/2 Ja von 2 Kopfstimmen/.test(satz),
				`Die Bezugsgrösse ohne die Betroffene steht nicht im Ergebnis: ${satz.slice(0, 300)}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				'Zustimmung im Ausstand:',
				'Die Auswertung nennt das Veto nicht'
			);
			await behaupteText(leitung, '(am eigenen Gerät)', 'Der Weg «am eigenen Gerät» fehlt');
			return `angenommen, Veto von ${amTelefon} am eigenen Gerät`;
		});

		await schritt('Veto im Ausstand: ein Nein lehnt ab, mündlich erfasst', async () => {
			const leute = [`Aebi ${LAUF}`, `Bucher ${LAUF}`, `Christen ${LAUF}`];
			const amTelefon = await telefonpartei();
			/*
			 * Zwei Betroffene im Ausstand: Die eine lehnt am Telefon ab, für die
			 * andere erfasst die Sitzungsleitung den mündlichen Entscheid. Die
			 * Quote reicht damit für keine Mehrheit — abgelehnt wird der Antrag
			 * ohnehin, und beides steht mit seinem Weg in der Auswertung.
			 */
			const zweite = leute.find((n) => n !== amTelefon && n !== `Bucher ${LAUF}`);
			const waehler = leute.filter((n) => n !== amTelefon && n !== zweite);
			behaupte(zweite && waehler.length === 1, `Ungeeignete Rollenverteilung: ${amTelefon}`);

			await traktandumAufrufen('Werkraum');
			await betroffeneEintragen([amTelefon, zweite]);
			await ausstandErklaeren(amTelefon, 'Ihr Anteil wird entschädigt.');
			await ausstandErklaeren(zweite, 'Ihr Anteil wird entschädigt.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);

			await gehe(telefon, '/z');
			const vetoForm = telefon.locator('form[action="?/veto"]');
			await vetoForm.first().waitFor({ state: 'visible', timeout: 8000 });
			await abschicken(telefon, vetoForm.first().locator('button[value="nein"]'));
			await behaupteText(
				telefon,
				'Entscheid: keine Zustimmung',
				'Das Telefon bestätigt das Veto-Nein nicht'
			);
			aktuelleSeite = leitung;

			// Mündlich: die Sitzungsleitung erfasst den Entscheid der zweiten.
			await vetoMuendlich(zweite, 'ja');

			await stimmeFuer(waehler[0], 'yes');
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			const ergebnis = leitung.locator('article.ergebnis', { hasText: 'Werkraum' }).last();
			await ergebnis.waitFor({ state: 'visible', timeout: 8000 });
			const satz = (await ergebnis.innerText()).replace(/\s+/g, ' ');
			behaupte(/Abgelehnt/i.test(satz), `Werkraum nicht abgelehnt: ${satz.slice(0, 300)}`);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				/hat ausdrücklich nicht zugestimmt/,
				'Die Auswertung nennt das Veto-Nein nicht'
			);
			await behaupteText(
				leitung,
				'(mündlich, von der Sitzungsleitung erfasst)',
				'Der mündlich erfasste Entscheid fehlt in der Auswertung'
			);
			return `abgelehnt; ${amTelefon} am eigenen Gerät, ${zweite} mündlich`;
		});

		/*
		 * **Der Folgeantrag übernimmt die Betroffenen** (Block A3b, 26.09.2026).
		 * Wer betroffen ist, folgt aus dem Inhalt des Antrags; die des
		 * Grundantrags stehen im Formular nur als Vorschlag. Gemessen wird die
		 * Wirkung: vorausgewählt, geändert, am Folgeantrag eingetragen, und vor
		 * dem Eröffnen nennt die Leitungsseite die Abweichung. Danach wird der
		 * Folgeantrag zurückgezogen; über den Grundantrag stimmt Schritt 100 ab.
		 */
		await schritt('Folgeantrag: Betroffene übernommen, geändert, Hinweis vor dem Eröffnen', async () => {
			await traktandumAufrufen('Wertquoten Whg 2');
			await betroffeneEintragen([betroffen]);

			const wort = leitung.locator('.eingriffe button.wort', { hasText: 'Gegenantrag' });
			behaupte(await wort.count(), '«Gegenantrag» steht nicht unter «Jetzt möglich»');
			const form = leitung.locator('.eingriffe form[action="?/aufnehmen"]');
			await klickeBis(leitung, wort.first(), form);
			const feld = form.locator('fieldset', { hasText: 'Unmittelbar betroffen' });
			behaupte(await feld.count(), 'Das Formular des Folgeantrags führt keine Betroffenen');
			const stand = (await feld.locator('.stand').innerText()).trim();
			behaupte(
				stand === `Gewählt: ${betroffen}`,
				`Die Betroffenen des Grundantrags sind nicht vorausgewählt: ${stand}`
			);
			await feld.locator('input[type="search"]').fill(LAUF);
			await feld.locator('label', { hasText: betroffen }).first().click();
			await feld.locator('label', { hasText: `Aebi ${LAUF}` }).first().click();
			await fuelle(leitung, '.eingriffe form[action="?/aufnehmen"] input[name="titel"]', 'Dachausbau gestaffelt');
			await fuelle(
				leitung,
				'.eingriffe form[action="?/aufnehmen"] [name="antragswortlaut"]',
				'Die Wertquote von Whg 1 wird statt jener von Whg 2 erhöht.'
			);
			// Gewählt statt geerbt (Produktentscheid 08.10.2026): Ohne eigenes
			// Erfordernis trüge der Weg die Betroffenen nicht ein.
			await leitung
				.locator('.eingriffe form[action="?/aufnehmen"] select[name="erfordernis"]')
				.selectOption('k-wertquoten-aendern');
			await abschicken(leitung, form.locator('button[type="submit"]').first());
			await behaupteText(
				leitung,
				`Als unmittelbar betroffen eingetragen: Aebi ${LAUF}.`,
				'Die geänderte Auswahl ist nicht am Folgeantrag eingetragen'
			);

			await traktandumAufrufen('Dachausbau gestaffelt');
			await behaupteText(
				leitung,
				`Neu betroffen: «Aebi ${LAUF}»`,
				'Vor dem Eröffnen fehlt der Hinweis auf neu Betroffene'
			);
			await behaupteText(
				leitung,
				`Nicht mehr betroffen: «${betroffen}»`,
				'Vor dem Eröffnen fehlt der Hinweis auf weggefallene Betroffene'
			);

			const zurueck = leitung.locator('.eingriffe button.wort', { hasText: 'Zurückziehen' });
			const rueckzug = leitung.locator('.eingriffe form[action="?/zurueckziehen"]');
			await klickeBis(leitung, zurueck.first(), rueckzug);
			await rueckzug.locator('input[name="grund"]').fill('Prüflauf: nur für den Hinweis');
			await abschicken(leitung, rueckzug.locator('button[type="submit"]').first());
			// Mit dem Titel (06.10.2026): Seit dem Schritt zum milderen Mehr steht
			// ein zurückgezogener Folgeantrag in der Liste, und das blosse Wort
			// «zurückgezogen» wäre hier schon vor dem Rückzug zu lesen.
			await behaupteText(
				leitung,
				'«Dachausbau gestaffelt» ist zurückgezogen',
				'Der Folgeantrag ist nicht zurückgezogen'
			);
			// Dauerhaft, nicht nur an der Quittung (Codeprüfung N2, 06.10.2026).
			const dachvermerk = leitung
				.locator('ul.baum > li', { hasText: 'Dachausbau gestaffelt' })
				.locator('p.rueckzugsvermerk', { hasText: 'Prüflauf: nur für den Hinweis' });
			await dachvermerk
				.first()
				.waitFor({ state: 'visible', timeout: 8000 })
				.catch((f) => {
					if (!/Timeout .* exceeded/.test(String(f))) throw f;
				});
			behaupte(
				await dachvermerk.count(),
				'Die Zeile von «Dachausbau gestaffelt» führt keinen Rückzugsvermerk mit dem Grund'
			);
			return `vorausgewählt ${betroffen}, eingetragen Aebi, Hinweis vor dem Eröffnen`;
		});

		/*
		 * **Handzählung bei den Wertquoten** (Block A3c, Produktentscheid
		 * 26.09.2026: «es sollte eigentlich möglich sein, mit Kommentar»). Bis
		 * dahin sperrte die Leitungsseite sie. Gemessen wird die Wirkung: der
		 * Vermerk als Pflichtfeld, die Absage des Servers ohne ihn, und nach dem
		 * Schliessen die ausstehende Unterschrift in Ergebnis und Auswertung,
		 * obwohl niemand einzeln gestimmt hat.
		 */
		await schritt('Handzählung bei den Wertquoten: mit Vermerk, und die Unterschrift steht aus', async () => {
			await traktandumAufrufen('Wertquoten Whg 2');
			// Der Schritt davor trägt die Betroffene ein; fällt er vorher aus,
			// trägt dieser sie selbst ein und misst trotzdem für sich.
			const stand = await leitung
				.locator('p.saalhinweis', { hasText: 'Unmittelbar betroffen' })
				.innerText()
				.catch(() => '');
			if (!stand.includes(betroffen)) await betroffeneEintragen([betroffen]);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/oeffnen"] button[type="submit"]').first()
			);
			await behaupteOhne(leitung, 'Von Hand zählen geht hier nicht', 'Die Handzählung ist noch gesperrt');

			const summen = leitung.locator('form[action="?/summen"]');
			const auf = leitung.locator('summary', { hasText: 'nur die Summen' }).first();
			behaupte(await auf.count(), 'Kein Weg zur Summenerfassung');
			await klickeBis(leitung, auf, summen.locator('input[name="ja"]'));
			const feld = summen.locator('input[name="vermerk"]');
			behaupte(
				(await feld.getAttribute('required')) !== null,
				'Der Vermerk ist bei den Wertquoten kein Pflichtfeld'
			);
			await behaupteText(leitung, 'ist der Vermerk Pflicht', 'Der Grund der Pflicht steht nicht beim Feld');

			// Der Server weist ohne Vermerk ab, auch wenn das Formular umgangen wird.
			const ohne = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/summen`,
				{ form: { ja: '2', nein: '0', enthaltung: '0', vermerk: '' }, headers: { origin: ZIEL } }
			);
			const roh = await ohne.text();
			behaupte(/Vermerk Pflicht/.test(roh), `Der Server nimmt die Summen ohne Vermerk: ${roh.slice(0, 300)}`);

			await summen.locator('input[name="ja"]').fill('2');
			await summen.locator('input[name="nein"]').fill('0');
			await summen.locator('input[name="enthaltung"]').fill('0');
			await feld.fill('Handzeichen, gezählt von der Sitzungsleitung');
			await abschicken(leitung, summen.locator('button[type="submit"]').first());
			await behaupteText(leitung, 'Von Hand gezählt: 2 Ja', 'Die Summen sind nicht erfasst');

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung.locator('form[action="?/schliessen"] button[type="submit"]').first()
			);
			const ergebnis = leitung.locator('article.ergebnis', { hasText: 'Wertquoten Whg 2' }).last();
			await ergebnis.waitFor({ state: 'visible', timeout: 8000 });
			const satz = (await ergebnis.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Angenommen \(Genehmigung\)/.test(satz),
				`Wertquoten nicht als Genehmigung angenommen: ${satz.slice(0, 300)}`
			);
			behaupte(
				satz.includes(`Abänderungsurkunde unterzeichnet haben (${betroffen})`),
				`Der Ergebnissatz nennt die ausstehende Unterschrift nicht: ${satz.slice(0, 400)}`
			);

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				`unterzeichnet haben (${betroffen})`,
				'Die Auswertung nennt die ausstehende Unterschrift nach der Handzählung nicht'
			);
			return `angenommen (Genehmigung), Unterschrift von ${betroffen} steht aus`;
		});

		/*
		 * **Einen Antrag zurückziehen** (Welle 3, FR-45). Der Satz, um den es
		 * geht: zurückgezogen ist **nicht** abgelehnt. Es gab keine Abstimmung und
		 * damit keine Mehrheit dagegen.
		 */
		await schritt('Ein Antrag wird zurückgezogen — nicht abgelehnt', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('li', { hasText: 'Spielplatz' }).last();
			// Wie beim Rückkommen: oben, wo das Traktandum aufgerufen ist, sonst an
			// seiner Zeile.
			const oben = leitung.locator('.eingriffe .wort', { hasText: 'Zurückziehen' });
			const obenDa =
				(await oben.count()) > 0 &&
				/Spielplatz/.test(
					await leitung
						.locator('li.jetzt')
						.innerText()
						.catch(() => '')
				);
			const bereich = obenDa ? leitung.locator('.eingriffe') : zeile;
			const aufklappen = obenDa ? oben.first() : zeile.locator('details.rueckzug summary');
			behaupte(await aufklappen.count(), 'Kein Weg, den Antrag zurückzuziehen');
			await aufklappen.click();
			await leitung.waitForTimeout(150);
			await bereich.locator('input[name="grund"]').fill('Die Offerte liegt noch nicht vor');
			await abschicken(
				leitung,
				bereich.locator('form[action="?/zurueckziehen"] button[type="submit"]')
			);

			await behaupteText(leitung, 'zurückgezogen', 'Der Rückzug wird nicht ausgewiesen');
			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Die Offerte liegt noch nicht vor/.test(text),
				'Der Grund des Rückzugs steht nicht da'
			);

			// Aufrufen und Abstimmen bietet die Seite nicht mehr an.
			const nochmal = leitung.locator('li', { hasText: 'Spielplatz' }).last();
			behaupte(
				(await nochmal.locator('form[action="?/aufrufen"]').count()) === 0,
				'Ein zurückgezogener Antrag lässt sich noch aufrufen'
			);
			return 'mit Grund, nicht mehr aufrufbar';
		});

		await schritt('Ein Vermerk bleibt stehen, damit das Protokoll ihn nennen kann', async () => {
			/*
			 * **Warum hier und nicht bei Schritt 52.** Dort wird der Vermerk
			 * gesetzt und über beide Rückwege wieder weggenommen; das ist der
			 * Prüfstein für die Rückwege. Danach steht keiner mehr, und das
			 * Protokoll hätte nichts zu berichten.
			 *
			 * **Und erst jetzt, nach der letzten Abstimmung.** Ein Vermerk sperrt
			 * das Telefon der Partei; früher gesetzt nähme er Aebi die Stimme, die
			 * die Schritte davor von ihr erwarten. Setzen geht nur, solange die
			 * Versammlung läuft, also muss es vor dem Schluss geschehen. Zwischen
			 * dem letzten Durchgang und dem Schluss ist das einzige Fenster.
			 */
			await lasseAufPapierEin();
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
				waitUntil: 'domcontentloaded'
			});
			await bereit(leitung);
			/*
			 * **Am Rückweg gemessen, nicht am Wortlaut** (11.09.2026, wie in Schritt
			 * 52). Der Text «Stimmt von Hand» steht seit dem 11.09.2026 an beiden
			 * Zeilen: an der mit Vermerk als Bestätigungswort der Rücknahme, an der
			 * ohne als Knopf «Stimmt doch von Hand». Nur die Handlung
			 * `papierZuruecknehmen` gibt es allein dort, wo der Vermerk steht.
			 */
			const zeile = leitung.locator('tr', { hasText: `Aebi ${LAUF}` }).first();
			behaupte(
				(await zeile.locator('form[action="?/papierZuruecknehmen"]').count()) > 0,
				'Der Vermerk steht nicht an Aebis Zeile — das Protokoll fände ihn nicht'
			);
			return `Aebi ${LAUF} stimmt von Hand`;
		});

		await schritt('Versammlung schliessen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}`, { waitUntil: 'domcontentloaded' });
			const knopf = leitung.locator('form[action="?/schliessen"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Schliessen der Versammlung');
			await abschicken(leitung, knopf.first());
			await behaupteText(leitung, 'geschlossen', 'Die Versammlung gilt nicht als geschlossen');
		});

		await schritt('Beide Telefone erfahren vom Schluss', async () => {
			// **Nicht** neu aufrufen, sondern zusehen.
			//
			// Das Telefon lädt sich alle fünf Sekunden selbst neu und ausserdem,
			// sobald der Ereignisstrom etwas meldet. Die Abschlussmeldung erscheint
			// deshalb von allein.
			//
			// Sie **bleibt** auch stehen: Früher löschte die Seite dabei den Keks,
			// und beim nächsten Nachladen stand wieder die Codeeingabe da. Dieser
			// Schritt schlug deshalb sprunghaft fehl — er hatte recht und die Seite
			// unrecht. Wer nach dem Schluss auf sein Telefon sieht, soll lesen, dass
			// die Versammlung zu Ende ist, und nicht aufgefordert werden, einen Code
			// einzutippen, der nichts mehr öffnet.
			for (const seite of [telefon, telefonB]) {
				aktuelleSeite = seite;
				await behaupteText(
					seite,
					/Versammlung ist geschlossen/i,
					'Ein Telefon erfährt nicht, dass die Versammlung geschlossen ist',
					// Das Telefon lädt alle fünf Sekunden; im Entwicklungsbetrieb kommt
					// die Neuübersetzung durch Vite dazu. Grosszügig, damit der Test
					// nicht die Bauzeit misst.
					25000
				);
			}
			aktuelleSeite = leitung;
		});

		await schritt('Auswertung belegt Ergebnis und Zählweise', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(leitung, 'Fassadensanierung', 'Das Traktandum fehlt in der Auswertung');
			await behaupteText(leitung, /angenommen|abgelehnt/i, 'Kein Ergebnis in der Auswertung');
			// Der Nachtrag zur Zählweise: Ohne ihn taugt das Blatt nicht als Beleg.
			await behaupteText(leitung, 'je Einheit', 'Die Auswertung nennt die Zählweise nicht');
			await behaupteText(
				leitung,
				'Art. 28 Abs. 1 Reglement',
				'Die Auswertung nennt die Fundstelle im Reglement nicht'
			);
			/*
			 * **Namen neben dem Stimmverhalten: nur beim Block des Traktandums.**
			 * Seit dem Veto im Ausstand (26.09.2026) nennt die Auswertung die
			 * Betroffenen namentlich — das ist die Ausnahme von NFR-17, der
			 * Name ist dort der Nachweis. Geprüft wird darum der Block der
			 * Fassadensanierung und nicht mehr die ganze Seite.
			 */
			const fassade = leitung.locator('article', { hasText: 'Fassadensanierung' }).first();
			const fassadentext = (await fassade.innerText()).replace(/\s+/g, ' ');
			behaupte(
				!/Aebi|Bucher|Christen/.test(fassadentext),
				`Ein Name steht neben dem Stimmverhalten (NFR-17): ${fassadentext.slice(0, 260)}`
			);
		});

		/*
		 * **Der Beschlussvermerk** (Block 7, Produktentscheide 02.10.2026).
		 *
		 * «Hausordnung anpassen» ist eine Abstimmung, über die in diesem Lauf
		 * nie abgestimmt wurde. Genau der Fall, für den es den Weg gibt: Die
		 * Sitzungsleitung trägt nach dem Schluss den Beschluss ins Votenfeld
		 * nach und setzt den Haken. Der Entwurf entsteht erst im nächsten
		 * Schritt; dort wird gemessen, dass er die Zeile «Über diesen Antrag
		 * wurde nicht abgestimmt.» nicht mehr trägt.
		 */
		const hausordnungEintrag = 'Beschluss: Die Hausordnung wird wie besprochen angepasst.';

		/*
		 * **Die Auswertung folgt dem Vermerk** (Block 7b, Produktentscheid
		 * 02.10.2026). Gelesen wird die Zeile von «Hausordnung anpassen» auf der
		 * Auswertungsseite, einmal vor dem Haken und einmal danach: Vorher steht
		 * «Es wurde nicht abgestimmt.», danach der eigene Satz. Die Lesung davor
		 * ist die Gegenprobe; ohne sie bewiese der Satz danach nicht, dass der
		 * Haken ihn gebracht hat.
		 */
		const auswertungZurHausordnung = async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			const zeile = leitung.locator('article.zeile', { hasText: 'Hausordnung anpassen' });
			behaupte(
				(await zeile.count()) === 1,
				`Die Auswertung führt «Hausordnung anpassen» nicht genau einmal: ${await zeile.count()}`
			);
			const glatt = (t) => t.replace(/\s+/g, ' ').trim();
			const lage = {
				zeile: glatt(await zeile.innerText()),
				bilanz: glatt(await leitung.locator('p.bilanz').innerText())
			};
			/*
			 * **Die Wand zählt wie die Auswertung** (Block 7c). Nach dem Schluss
			 * zeigt die Präsentationssicht das Abschlussbild; gelesen wird die
			 * Zeile unter «Versammlung geschlossen».
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/praesentation`, {
				waitUntil: 'domcontentloaded'
			});
			const wand = leitung.locator('.bild.abschluss p.satz');
			await wand.waitFor({ timeout: 15000 });
			return { ...lage, wand: glatt(await wand.innerText()) };
		};
		const ohneBeschlussAnDerWand = (satz) => Number(/(\d+) ohne Beschluss/.exec(satz)?.[1] ?? 0);
		let ohneBeschlussVorher = null;
		const NEUER_SATZ =
			'Über diesen Antrag wurde von Hand abgestimmt. Diese Auswertung enthält dazu weder Zahlen noch ' +
			'Ergebnis. Ob der Antrag angenommen oder abgelehnt wurde, steht im Protokoll der Versammlung.';
		await schritt('Auswertung vor dem Beschlussvermerk: «Es wurde nicht abgestimmt.»', async () => {
			const { zeile, bilanz, wand } = await auswertungZurHausordnung();
			behaupte(!/von Hand abgestimmt/.test(wand), `Die Wand zählt schon ohne Vermerk von Hand: ${wand}`);
			ohneBeschlussVorher = ohneBeschlussAnDerWand(wand);
			behaupte(ohneBeschlussVorher > 0, `Die Wand zählt nichts «ohne Beschluss»; die Probe danach mässe nichts: ${wand}`);
			behaupte(
				zeile.includes('Es wurde nicht abgestimmt.'),
				`Ohne Vermerk fehlt der bisherige Satz: ${zeile}`
			);
			behaupte(!zeile.includes(NEUER_SATZ), `Der neue Satz steht schon ohne Vermerk: ${zeile}`);
			behaupte(
				!/von Hand abgestimmt/.test(bilanz),
				`Die Bilanz zählt schon ohne Vermerk eine Abstimmung von Hand: ${bilanz}`
			);
			return bilanz;
		});

		await schritt('Beschlussvermerk: Der Text im Votenfeld ist der Beschluss', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const notizform = leitung
				.locator('form[action="?/notiz"]', { hasText: 'Hausordnung anpassen' })
				.first();
			behaupte(await notizform.count(), 'Kein Votenfeld zu «Hausordnung anpassen»');
			const traktandumId = await notizform.locator('input[name="traktandum"]').inputValue();
			const vermerkform = leitung.locator(
				`form[action="?/beschlussvermerk"]:has(input[name="traktandum"][value="${traktandumId}"])`
			);

			/*
			 * **Am leeren Feld weist der Server ab, und der Haken springt zurück**
			 * (Abnahme 02.10.2026). Er blieb angekreuzt stehen, obwohl nichts
			 * gesetzt war; wer danach den Text eintrug, hielt ihn für gesetzt.
			 */
			behaupte(
				(await notizform.locator('textarea').inputValue()) === '',
				'Das Votenfeld zu «Hausordnung anpassen» ist nicht leer; die Probe am leeren Feld misst nichts'
			);
			await vermerkform.locator('input[name="vermerk"]').check({ noWaitAfter: true }).catch(() => {});
			await vermerkform.locator('.fehler', { hasText: 'ist leer' }).waitFor({ timeout: 10000 });
			await leitung.waitForFunction(
				(id) =>
					!document.querySelector(`form[data-vermerk="${id}"] input[name="vermerk"]`)?.checked,
				traktandumId,
				{ timeout: 5000 }
			);

			await tippeUndSichere(leitung, notizform, notizform.locator('textarea'), hausordnungEintrag);
			behaupte(
				await vermerkform.count(),
				'Der Haken für den Beschlussvermerk fehlt am Traktandum ohne Ergebnis'
			);
			const haken = vermerkform.locator('input[name="vermerk"]');
			behaupte(!(await haken.isChecked()), 'Der Beschlussvermerk steht schon vor dem Setzen');
			await haken.check();
			await behaupteText(
				leitung,
				/Der Haken zu «Hausordnung anpassen» ist gesetzt/,
				'Der Server hat den Beschlussvermerk nicht bestätigt',
				10000
			);
			behaupte(await haken.isChecked(), 'Der Haken steht nach dem Setzen nicht');

			/*
			 * **Das Leeren des Felds nimmt den Haken sichtbar mit** (Codeprüfung
			 * zur Abnahme): Der Server nimmt den Vermerk weg, und das Feld sichert
			 * ohne Neuladen. Ohne die Rückmeldung an die Seite blieb er stehen.
			 */
			/*
			 * Auf die Antworten des Servers warten, nicht auf die Anzeige: Die
			 * Marke «gesichert» steht vom vorigen Sichern noch da, und das
			 * Kästchen ist nach dem Klick sofort angekreuzt, auch wenn der Server
			 * gleich danach absagt (im ersten Anlauf so grün gewartet).
			 */
			const sichern = () =>
				leitung.waitForResponse(
					(r) => r.url().includes('/protokoll/sichern') && r.request().method() === 'POST' && r.ok(),
					{ timeout: 15000 }
				);
			let gesichert = sichern();
			await notizform.locator('textarea').fill('');
			await leitung.locator('h1').first().click();
			await gesichert;
			await leitung.waitForFunction(
				(id) =>
					!document.querySelector(`form[data-vermerk="${id}"] input[name="vermerk"]`)?.checked,
				traktandumId,
				{ timeout: 10000 }
			);
			gesichert = sichern();
			await notizform.locator('textarea').fill(hausordnungEintrag);
			await leitung.locator('h1').first().click();
			await gesichert;
			const gesetzt = leitung.waitForResponse(
				(r) => r.url().includes('?/beschlussvermerk') && r.request().method() === 'POST',
				{ timeout: 15000 }
			);
			await haken.check();
			await gesetzt;
			await leitung.reload({ waitUntil: 'domcontentloaded' });
			behaupte(await haken.isChecked(), 'Der Haken steht nach dem Neuladen nicht: am Server nicht gesetzt');
			return 'Absage am leeren Feld, gesetzt, mit dem Leeren gefallen, wieder gesetzt';
		});

		await schritt('Auswertung nach dem Beschlussvermerk: der eigene Satz, ohne Zahlen und ohne Ausgang', async () => {
			const { zeile, bilanz, wand } = await auswertungZurHausordnung();
			behaupte(
				/· 1 von Hand abgestimmt/.test(wand),
				`Die Wand führt das vermerkte Traktandum nicht eigens: ${wand}`
			);
			behaupte(
				ohneBeschlussAnDerWand(wand) === ohneBeschlussVorher - 1,
				`Die Wand zählt das vermerkte Traktandum weiter als «ohne Beschluss»: vorher ${ohneBeschlussVorher}, jetzt «${wand}»`
			);
			behaupte(zeile.includes(NEUER_SATZ), `Mit Vermerk fehlt der neue Satz: ${zeile}`);
			behaupte(
				!zeile.includes('Es wurde nicht abgestimmt.'),
				`Mit Vermerk steht weiter «Es wurde nicht abgestimmt.»: ${zeile}`
			);
			// Der Satz selbst sagt «angenommen oder abgelehnt»; ausserhalb von ihm
			// steht in der Zeile weder eine Zahl noch ein Ausgang.
			behaupte(
				!/Kopfstimmen|Wertquoten|angenommen|abgelehnt|Erfordernis/i.test(zeile.replace(NEUER_SATZ, '')),
				`Die Zeile nennt Zahlen oder einen Ausgang, die Votum nicht kennt: ${zeile}`
			);
			behaupte(
				/· 1 von Hand abgestimmt/.test(bilanz),
				`Die Bilanz führt das vermerkte Traktandum nicht eigens: ${bilanz}`
			);
			return bilanz;
		});

		/*
		 * **Das Protokoll** (Welle 2, Block 2, FR-46 und FR-48 bis FR-50).
		 *
		 * Geprüft wird die Kette: Notiz während der Sitzung → Entwurf aus den
		 * Daten → Überarbeitung → festgehaltene Fassung → beide Ausgaben. Und der
		 * Punkt, auf den es ankommt: Die festgehaltene Fassung bleibt stehen,
		 * während die Arbeitsfassung weiterzieht.
		 */
		await schritt('Protokoll: Entwurf aus den Daten', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});

			// Eine Notiz nachtragen — nach dem Schluss, wie es FR-46 vorsieht. Ohne
			// Knopf: Das Feld sichert sich selbst, sobald es verlassen wird.
			const notizform = leitung.locator('form[action="?/notiz"]').first();
			const notizfeld = notizform.locator('textarea');
			behaupte(await notizfeld.count(), 'Kein Feld für die Protokollnotiz');
			await tippeUndSichere(
				leitung,
				notizform,
				notizfeld,
				'Die Eigentümerschaft diskutierte die Kosten.'
			);

			await abschicken(
				leitung,
				leitung.locator('form[action="?/entwurf"] button[type="submit"]')
			);
			const text = await leitung.locator('textarea[name="body"]').inputValue();
			behaupte(text.includes('Fassadensanierung'), 'Der Entwurf kennt das Traktandum nicht');
			behaupte(
				text.includes('Die Eigentümerschaft diskutierte die Kosten.'),
				'Die Notiz steht nicht im Entwurf'
			);
			behaupte(text.includes('Kopfstimmen:'), 'Der Entwurf trägt keine Zahlen');
			// Die Rüge aus dem Saal steht im Entwurf (H8, Fachprüfung R4-a): Das
			// Protokoll geht an alle Eigentümer, das Paket nicht.
			behaupte(
				/Rüge im Saal:\n- \d\d:\d\d Uhr, Vertreterin von Whg 2: /.test(text) &&
					text.includes(RUEGEWORT),
				'Die im Saal festgehaltene Rüge steht nicht im Protokollentwurf'
			);

			/*
			 * **Der Beschlussvermerk** (Block 7): Im Abschnitt von «Hausordnung
			 * anpassen» steht der nachgetragene Beschluss, und die Zeile «Über
			 * diesen Antrag wurde nicht abgestimmt.» fehlt. Über den ganzen
			 * Text zu prüfen ginge nicht: Die Zeile gehört zu jedem anderen
			 * Traktandum ohne Ergebnis.
			 */
			const hausordnungAbschnitt = new RegExp(
				`(?:^|\\n)#{3,6} \\d+(?:\\.\\d+)* Hausordnung anpassen([\\s\\S]*?)(?=\\n#{2,6} )`
			).exec(text);
			behaupte(
				hausordnungAbschnitt,
				`Der Abschnitt von «Hausordnung anpassen» fehlt im Entwurf: ${text.slice(0, 300)}`
			);
			behaupte(
				hausordnungAbschnitt[1].includes(hausordnungEintrag),
				'Der nachgetragene Beschluss steht nicht im Entwurf'
			);
			behaupte(
				!/Über diesen Antrag wurde nicht abgestimmt/.test(hausordnungAbschnitt[1]),
				'Der Entwurf sagt unter dem vermerkten Traktandum «nicht abgestimmt»'
			);

			/*
			 * **Die Mischform steht im Kopf** (Migration 108, 10.09.2026).
			 *
			 * In der Mischform überträgt die Sitzungsleitung die Stimmen der
			 * Papierparteien ohne Grund je Traktandum. Eine Stimme ohne Grund
			 * erscheint im Protokoll gar nicht — ohne diesen Abschnitt stünde
			 * nirgends, dass ein Teil der Stimmen übertragen wurde.
			 *
			 * Gemessen wird die Verdrahtung, nicht der Wortlaut: Ob der Server die
			 * Papierparteien holt und dem Textbauer übergibt, sieht kein
			 * Domänentest.
			 */
			behaupte(
				text.includes('## Stimmabgabe'),
				'Der Entwurf kennt den Abschnitt «Stimmabgabe» nicht, obwohl eine Partei auf Papier stimmte'
			);
			behaupte(
				text.includes(`Aebi ${LAUF}`),
				'Der Abschnitt nennt die Papierpartei nicht — der Vermerk wäre nicht nachvollziehbar'
			);
			behaupte(
				text.indexOf('## Stimmabgabe') < text.indexOf('## Zählweise'),
				'Die Stimmabgabe steht hinter der Zählweise — erst wird abgestimmt, dann gezählt'
			);

			/*
			 * **Die Pendenz steht im Protokoll — ohne ihren Zustand.**
			 *
			 * Schritt 71 hat sie erfasst und danach als «erledigt» mit der
			 * Bemerkung «Offerten liegen vor» vermerkt. Genau deshalb misst dieser
			 * Schritt beide Richtungen: Der vereinbarte Satz gehört hinein, der
			 * heutige Zustand nicht. Ein Protokoll hält fest, was an der
			 * Versammlung vereinbart wurde; `minutes_version` friert den
			 * gerenderten Text ein, und zwei festgehaltene Fassungen desselben
			 * Protokolls dürfen nicht Verschiedenes sagen, bloss weil jemand
			 * inzwischen abgehakt hat.
			 */
			behaupte(
				text.includes(
					'- die Bewirtschaftung: Offerten für die Rampe einholen (bis zur nächsten Versammlung)'
				),
				`Die Pendenz steht nicht im Entwurf: ${text.slice(0, 200)}`
			);
			behaupte(
				!text.includes('Offerten liegen vor'),
				'Der Entwurf trägt die Abschlussbemerkung der Pendenz — er soll den vereinbarten ' +
					'Stand halten, nicht den heutigen'
			);
			behaupte(
				/beschlussfähig/i.test(text),
				'Der Entwurf stellt die Beschlussfähigkeit nicht fest'
			);

			/*
			 * **Erst der Kopf, dann die Traktanden, dann die Inhalte** (Auftraggeber,
			 * 03.09.2026: «Das Protokoll soll wie ein Protokoll aufgebaut sein …
			 * Erste Seite im Kopf alles relevante dann Traktanden und dann die
			 * Inhalte»).
			 *
			 * Bis dahin sprang das Dokument vom Kopf unmittelbar in die
			 * Verhandlungen — wer wissen wollte, worüber der Abend ging, musste
			 * alle Ergebnisse durchlesen.
			 */
			/*
			 * **Der Kopf steht als Tabelle** (Auftraggeber, 03.09.2026, mit einer
			 * Word-Vorlage: «Struktur im Sinne von hier»). Vorher war es eine
			 * Aufzählung, und Datum und Beginn standen auf zwei Zeilen.
			 */
			behaupte(
				/\n\| Gemeinschaft \| .+ \|\n/.test(text),
				'Der Kopf führt die Gemeinschaft nicht als Tabellenzeile'
			);
			behaupte(
				/\n\| Datum, Beginn \| .+, \d{2}:\d{2} Uhr \|\n/.test(text),
				'Datum und Beginn stehen nicht in einer Zeile'
			);
			behaupte(!text.includes('- Datum:'), 'Die alte Aufzählung steht noch daneben');

			const uebersicht = text.indexOf('## Traktanden');
			behaupte(uebersicht > 0, 'Der Entwurf führt die Traktanden nicht im Überblick');
			behaupte(
				uebersicht > text.indexOf('## Anwesenheit') &&
					uebersicht < text.indexOf('## Verhandlungen'),
				'Die Traktandenübersicht steht nicht zwischen Kopf und Verhandlungen'
			);
			behaupte(
				text.slice(uebersicht, text.indexOf('## Verhandlungen')).includes('Fassadensanierung'),
				'Die Übersicht führt das Traktandum nicht auf'
			);

			/*
			 * **Und die Fallgruppe ist als Herleitung gekennzeichnet** (Auftraggeber,
			 * 03.09.2026, mit Bild): Unter der Protokollgenehmigung stand
			 * «(Décharge und Protokollgenehmigung, …)», und das Wort «Décharge»
			 * las sich wie ein Fehler. Der Knotentitel ist die Fallgruppe des
			 * Entscheidbaums, nicht die Bezeichnung des Geschäfts.
			 */
			const mehrheiten = text
				.split('\n')
				.filter((zeile) => zeile.startsWith('Erforderliche Mehrheit:') && zeile.includes('('));
			behaupte(mehrheiten.length > 0, 'Keine Zeile nennt die erforderliche Mehrheit mit Herkunft');
			const ungekennzeichnet = mehrheiten.find((z) => !z.includes('hergeleitet als'));
			behaupte(
				!ungekennzeichnet,
				`Die Fallgruppe steht ohne «hergeleitet als» und liest sich wie der Gegenstand: ${ungekennzeichnet}`
			);

			/*
			 * **Die Zahlen stehen einmal** (Auftraggeber, 28.08.2026: «Beim qualifizierten
			 * Mehr steht das Ergebnis zweimal für die Köpfe und einmal für die
			 * Wertquoten»). Ursache war der übernommene Leinwandsatz: Der muss
			 * dort seine Zahlen tragen, weil er allein steht, und er nennt nur die
			 * gescheiterte Seite — daher die einseitige Wiederholung.
			 *
			 * Geprüft wird die Eigenschaft, nicht ein Wortlaut: In einer
			 * Wertungszeile steht keine Ziffer.
			 */
			const wertungen = text
				.split('\n')
				.filter((zeile) => /^(Angenommen|Abgelehnt|Stimmengleichheit)/.test(zeile));
			behaupte(wertungen.length > 0, 'Der Entwurf trägt keine Wertung zu den Anträgen');
			const mitZahl = wertungen.find((zeile) => /\d/.test(zeile));
			behaupte(!mitZahl, `Die Wertung wiederholt die Zahlen des Spiegels: ${mitZahl}`);
			// Und die Schwelle ist mitgewandert, statt mit dem Satz zu verschwinden.
			behaupte(/nötig \d/.test(text), 'Der Spiegel nennt die nötige Schwelle nicht');
			return `${text.length} Zeichen`;
		});

		/*
		 * **Der Punkt, auf den es dem Auftraggeber ankam** (04.08.2026): «Wichtig ist, bei
		 * Wechseln, Neuladen die Stände gesichert sind und nicht verloren gehen
		 * können.» Genau das steht auch in FR-46 — laufend gesichert, weil ein
		 * verlorener Text in der Sitzung nicht rekonstruierbar ist.
		 *
		 * Geprüft wird ohne Knopfdruck: tippen, wegklicken, **neu laden** — und
		 * der Text muss dastehen.
		 */
		await schritt('Der Text übersteht ein Neuladen ohne Speichern', async () => {
			const feld = leitung.locator('textarea[name="body"]');
			const vorher = await feld.inputValue();
			// Wegklicken löst das Sichern aus; gewartet wird auf die Rückmeldung des
			// Feldes selbst — «gesichert» steht sonst auch anderswo auf der Seite.
			await tippeUndSichere(
				leitung,
				leitung.locator('.bearbeiten'),
				feld,
				`${vorher}\n\nOhne Knopfdruck getippt.`
			);

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			const nachher = await leitung.locator('textarea[name="body"]').inputValue();
			behaupte(
				nachher.includes('Ohne Knopfdruck getippt.'),
				'Nach dem Neuladen fehlt der ungespeicherte Text'
			);
			return 'überlebt';
		});

		await schritt('Zwei Fenster überschreiben einander nicht stillschweigend', async () => {
			// Dasselbe Feld steht auch in der Sitzungsleitung. Ein zweites Fenster
			// mit altem Stand darf die frische Fassung nicht verdrängen.
			const feld = leitung.locator('textarea[name="body"]');
			const stand = await feld.inputValue();

			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/protokoll/sichern`,
				{ data: { feld: 'body', text: 'Aus einem alten Fenster.', bisher: 'ein ganz anderer Stand' } }
			);
			behaupte(
				antwort.status() === 409,
				`Der Server nahm den alten Stand an (${antwort.status()})`
			);

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			const nachher = await leitung.locator('textarea[name="body"]').inputValue();
			behaupte(nachher === stand, 'Der Text wurde trotz Konflikt überschrieben');
			return '409, Text unverändert';
		});

		await schritt('Ein Konflikt bleibt stehen, auch wenn man die Änderung zurücknimmt', async () => {
			/*
			 * **Der Befund** (Sicherheitsdurchgang 06.09.2026): Nach einer 409 hält
			 * das Feld seinen eigenen letzten Erfolg als Vergleichsstand fest,
			 * während der Server längst den Text eines anderen führt. Wer danach
			 * ein Zeichen tippt und wieder löscht, stimmt wieder mit dem eigenen
			 * alten Stand überein — und die Anzeige meldete «gesichert 14:19».
			 *
			 * Vor der Änderung, die diesen Rückfall einführte, stand dort nichts.
			 * Aus einem Schweigen eine falsche Zusage zu machen, ist die
			 * schlechtere Hälfte: Wer sie liest, klappt das Notebook zu, und im
			 * Protokoll steht der fremde Text.
			 */
			/*
			 * **Die Anzeige DIESES Feldes, nicht die erste der Seite.** Die
			 * Protokollseite führt ein selbstsicherndes Feld je Traktandum plus
			 * das für den Protokolltext; `.sicherungsstand` gibt es also ein
			 * Dutzend Mal. Ein erster Anlauf nahm `.first()` und wartete auf die
			 * Anzeige eines Traktandums, in das niemand getippt hatte — er meldete
			 * einen Fehler, den es nicht gab.
			 */
			gewollterKonflikt = true;
			const feld = leitung.locator('textarea[name="body"]');
			// Der Stand vor der Probe — am Ende wird er zurückgegeben.
			const vorher = await feld.inputValue();
			/*
			 * **Über die Kennung, nicht über einen Klassenvergleich.** Ein erster
			 * Anlauf nahm `following-sibling::p[@class="sicherungsstand"]` — und
			 * traf nie: Svelte hängt an jede Klasse seine Bereichsklasse an, das
			 * Attribut lautet also «sicherungsstand svelte-1abc2de», und XPath
			 * vergleicht `@class` als ganze Zeichenkette.
			 */
			const anzeige = leitung.locator('#body ~ .sicherungsstand').first();

			// Erst einen eigenen Stand sichern.
			await feld.fill(`Konfliktprobe ${LAUF}`);
			await feld.blur();
			await (async () => {
				const bis = Date.now() + 15000;
				let gesehen = '';
				while (Date.now() < bis) {
					gesehen = (await anzeige.innerText().catch(() => '')).trim();
					if (/gesichert\s+\d/.test(gesehen)) return;
					await new Promise((f) => setTimeout(f, 150));
				}
				throw new Error(`Das Protokollfeld meldet «${gesehen}» statt eines gesicherten Standes`);
			})();

			// Ein anderes Fenster schreibt etwas anderes.
			const fremd = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/protokoll/sichern`,
				{ data: { feld: 'body', text: `Aus dem anderen Fenster ${LAUF}` } }
			);
			behaupte(fremd.ok(), `Das andere Fenster kam nicht durch (${fremd.status()})`);

			// Jetzt ein Zeichen tippen: Das läuft in den Konflikt.
			await feld.focus();
			await feld.press('End');
			await feld.press('!');
			await leitung.waitForFunction(
				() =>
					document.querySelector('#body ~ .sicherungsstand')?.getAttribute('data-stand') ===
					'konflikt',
				null,
				{ timeout: 20000 }
			);

			/*
			 * **Beobachten statt einmal hinsehen** (10.09.2026).
			 *
			 * Hier stand `waitForTimeout(1800)` und danach ein einziges Ablesen. Das
			 * ist der Beweis eines Nicht-Ereignisses über eine feste Frist, und er
			 * hat zwei Löcher: Auf einer langsamen Maschine wird der Schritt rot,
			 * ohne dass etwas defekt wäre, und ein kurzes Umspringen auf
			 * «gesichert» und zurück sähe niemand — ausgerechnet der Rückschritt,
			 * gegen den die Probe steht.
			 *
			 * **Die Aufzeichnung geht über die Datensätze, nicht über den Ist-Wert**
			 * (aus dem Code-Review). Schreibt Svelte zwei Zustände in dasselbe
			 * Bündel, ruft der Beobachter einmal auf, und ein Blick auf das Attribut
			 * sähe nur den letzten. Genau das Aufblitzen von «gesichert» wäre dann
			 * unsichtbar. `attributeOldValue` gibt die Zwischenwerte her.
			 */
			await anzeige.evaluate((el) => {
				window.__staende = [el.getAttribute('data-stand')];
				const merke = (wert) => {
					if (window.__staende[window.__staende.length - 1] !== wert) {
						window.__staende.push(wert);
					}
				};
				new MutationObserver((saetze) => {
					// Der Datensatz trägt den ALTEN Wert; der neue steht am Attribut.
					// Beides zusammen ergibt die Folge, auch wenn gebündelt wurde.
					for (const satz of saetze) merke(satz.oldValue);
					merke(el.getAttribute('data-stand'));
				}).observe(el, {
					attributes: true,
					attributeFilter: ['data-stand'],
					attributeOldValue: true
				});
			});

			// Und wieder löschen — der Text stimmt jetzt mit dem eigenen alten
			// Stand überein, mit dem Server aber nicht.
			await feld.press('Backspace');

			/*
			 * **Auf die Uhr warten, nicht auf eine Frist** (aus dem Code-Review).
			 *
			 * Der erste Anlauf blurte hier sofort und wartete danach 1800 ms ab.
			 * Das mass die falsche Sache: `onblur` ruft `sichere()` **synchron**,
			 * der Stand steht also nach Millisekunden wieder auf «konflikt», und die
			 * Frist lief nur noch nebenher. Wächst die Entprellung in
			 * `SicherndesFeld.svelte` über das Fenster hinaus, bliebe ein
			 * Rückschritt im entprellten Lauf unbemerkt — und der Kommentar
			 * versprach dann eine laute Absage, die nie käme.
			 *
			 * Ohne blur kann der Rückweg von «offen» nach «konflikt» **nur** von der
			 * geplanten Uhr kommen (`getippt` setzt sie auf 1200 ms). Damit wartet
			 * der Schritt auf ein Ereignis statt auf eine Zahl, und eine längere
			 * Entprellung verschiebt nur die Wartezeit, statt ein Loch zu reissen.
			 */
			await leitung
				.waitForFunction(
					() =>
						window.__staende.includes('offen') &&
						window.__staende[window.__staende.length - 1] === 'konflikt',
					null,
					{ timeout: 20000 }
				)
				.catch(() => {
					// Der Befund kommt unten aus der beobachteten Folge; hier nur nicht
					// mit einem nackten Zeitüberschritt abbrechen.
				});

			// Jetzt erst verlassen, wie es ein Mensch täte. Der blur ruft `sichere()`
			// ein zweites Mal; auch das darf den Konflikt nicht auflösen.
			await feld.blur();
			await leitung.waitForTimeout(300);

			/*
			 * **Der Endzustand kommt vom Attribut, die Folge vom Beobachter** (aus
			 * dem Code-Review). Verpasst der Beobachter etwas, ginge die
			 * Kernbehauptung sonst durch, obwohl auf der Seite «gesichert» steht.
			 * Die beiden Quellen decken einander.
			 */
			const staende = await leitung.evaluate(() => window.__staende);
			const danach = await anzeige.getAttribute('data-stand');

			/*
			 * **Den Protokolltext zurückgeben, bevor der Schritt endet.**
			 *
			 * Ein erster Anlauf liess «Aus dem anderen Fenster …» stehen — und
			 * zerbrach damit den Schritt «Das Protokoll hält ‹zurückgezogen› von
			 * ‹abgelehnt› auseinander» drei Schritte weiter, der im Entwurf nach
			 * dem Rückzug sucht. Eine Probe, die den Zustand für die folgenden
			 * beschädigt, misst danach nicht mehr die Anwendung, sondern sich
			 * selbst.
			 */
			const zurueck = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/protokoll/sichern`,
				{ data: { feld: 'body', text: vorher } }
			);
			behaupte(zurueck.ok(), `Der Protokolltext liess sich nicht zurückgeben (${zurueck.status()})`);
			await leitung.reload({ waitUntil: 'domcontentloaded' });
			gewollterKonflikt = false;

			/*
			 * **Alle Zusicherungen NACH dem Aufräumen** (aus dem Code-Review).
			 * Schlägt eine an, muss der Protokolltext trotzdem zurückgegeben sein:
			 * Sonst bliebe «Aus dem anderen Fenster …» stehen und zerbräche den
			 * Schritt drei weiter, der im Entwurf nach dem Rückzug sucht. Ein roter
			 * Schritt darf einen Befund liefern und nicht drei.
			 */
			behaupte(
				staende.includes('offen'),
				`Das Feld hat die Eingabe nicht bemerkt: ${staende.join(' → ')}`
			);
			/*
			 * **Der eigentliche Rückschritt wäre ein Zwischenstand.** Ein Feld, das
			 * nach dem Löschen kurz «gesichert» meldet, behauptet für diesen Moment,
			 * der eigene Text liege im Protokoll, und wer in diesem Moment hinsieht,
			 * glaubt es. Ein Ablesen am Ende allein fände das nicht.
			 */
			behaupte(
				!staende.includes('gesichert'),
				`Das Feld meldete zwischendurch «gesichert»: ${staende.join(' → ')}`
			);
			behaupte(
				danach === 'konflikt',
				`Nach dem Zurücknehmen meldet das Feld «${danach}» statt eines Konflikts. ` +
					'Es behauptete damit, der eigene Text liege im Protokoll. ' +
					`Beobachtet: ${staende.join(' → ')}`
			);
			return `bleibt Konflikt (${staende.join(' → ')})`;
		});

		await schritt('Auch der Vorsitz wird nicht stillschweigend überschrieben', async () => {
			/*
			 * **Warum durch das Formular und nicht über den Endpunkt.** Der Schritt
			 * darüber prüft die Regel; hier geht es um die Verdrahtung: Schickt das
			 * Formular den Stand überhaupt mit, kommt der Satz an, bleibt das
			 * Getippte stehen, und trägt das versteckte Feld danach den neuen Stand?
			 * Genau diese Kette sieht kein Test an der Datenbank.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const verstecktes = leitung.locator('input[name="stand-sitzungsleitung"]');
			behaupte(await verstecktes.count(), 'Das Formular schickt den bekannten Stand nicht mit');

			const eins = `Rita Berger ${LAUF}`;
			const zwei = `Peter Muster ${LAUF}`;
			const knopf = (seite) => seite.locator('form[action="?/leitung"] button[type="submit"]');

			// Ein zweites Fenster derselben Sitzung, das den Stand von jetzt kennt.
			// `warteNachNavigation` ist Pflicht: Ohne sie tippt der Lauf vor der
			// Hydration ins Feld, Svelte setzt es beim Hydrieren zurück, und der
			// Schritt scheitert an einer Behauptung, die auf die falsche Stelle zeigt.
			const zweitesFenster = await leitung.context().newPage();
			await rueckfragenBestaetigen(zweitesFenster);
			warteNachNavigation(zweitesFenster);
			try {
				await zweitesFenster.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
					waitUntil: 'domcontentloaded'
				});

				await leitung.fill('input[name="sitzungsleitung"]', eins);
				await abschicken(leitung, knopf(leitung));

				await zweitesFenster.fill('input[name="sitzungsleitung"]', zwei);
				// Der Konflikt ist die Prüfung: Diese Absendung **muss** mit 409
				// abgewiesen werden.
				await abschicken(zweitesFenster, knopf(zweitesFenster), { absageErlaubt: true });
				const satz = (await zweitesFenster.locator('.meldung.fehler').first().innerText())
					.replace(/\s+/g, ' ')
					.trim();
				behaupte(satz.includes(eins), `Der Konflikt nennt den fremden Wert nicht: ${satz}`);
				behaupte(
					(await zweitesFenster.locator('input[name="sitzungsleitung"]').inputValue()) === zwei,
					'Das Getippte ist nach der Absage weg'
				);
				behaupte(
					(await zweitesFenster.locator('input[name="stand-sitzungsleitung"]').inputValue()) ===
						eins,
					'Das versteckte Feld trägt nach dem Konflikt nicht den neuen Stand — der zweite Versuch liefe wieder hinein'
				);

				// Nichts überschrieben — und der zweite Versuch geht durch.
				await leitung.reload({ waitUntil: 'domcontentloaded' });
				behaupte(
					(await leitung.locator('input[name="sitzungsleitung"]').inputValue()) === eins,
					'Der Eintrag des ersten Fensters wurde überschrieben'
				);
				await abschicken(zweitesFenster, knopf(zweitesFenster));
				await leitung.reload({ waitUntil: 'domcontentloaded' });
				behaupte(
					(await leitung.locator('input[name="sitzungsleitung"]').inputValue()) === zwei,
					'Der zweite Versuch kam nicht durch'
				);
			} finally {
				// Auch beim Scheitern schliessen: Ein offenes Fenster hält seinen
				// Ereignisstrom für den ganzen restlichen Lauf.
				await zweitesFenster.close();
			}

			// Das Feld bleibt gefüllt: Der Name gehört ins Protokoll, und der
			// nächste Schritt erzeugt den Entwurf.
			return `Konflikt gemeldet, dann ${zwei}`;
		});

		await schritt('Die ausgenommene KI-Funktion bleibt zu', async () => {
			/*
			 * **Die Ausnahme je Funktion** (FR-62). Diese Gemeinschaft hat die KI
			 * zugelassen und den Protokollentwurf ausgenommen — Schritt 11. Genau
			 * das muss hier sichtbar sein: kein Knopf, dafür der Grund. Eine
			 * Ausnahme, die man nur in der Datenbank sieht, ist keine.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const abschnitt = leitung.locator('.kientwurf');
			behaupte(await abschnitt.count(), 'Der Abschnitt zum Ausformulieren fehlt ganz');
			behaupte(
				(await leitung.locator('form[action="?/kientwurf"] button').count()) === 0,
				'Der Knopf steht da, obwohl der Protokollentwurf ausgenommen ist'
			);
			const gelesen = (await abschnitt.first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/ausgenommen/i.test(gelesen),
				`Der Grund der Ausnahme steht nicht da: ${gelesen.slice(0, 160)}`
			);
			return gelesen.slice(0, 60);
		});

		await schritt('Das Protokoll hält «zurückgezogen» von «abgelehnt» auseinander', async () => {
			// Der Entwurf steht im Textfeld, nicht im Fliesstext der Seite.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const text = await leitung.locator('textarea[name="body"]').inputValue();

			behaupte(
				/zur[^ ]*ckgezogen: Die Offerte liegt noch nicht vor/i.test(text),
				`Der Rückzug steht nicht im Protokollentwurf: ${text.slice(0, 400)}`
			);
			behaupte(
				/Beschluss ist nicht gefasst worden/i.test(text),
				'Der Entwurf sagt nicht, dass kein Beschluss gefasst wurde'
			);
			// Und im Abschnitt des zurückgezogenen Antrags steht kein Ergebnis.
			const abschnitt = text.slice(text.indexOf('Spielplatz'));
			const bisZumNaechsten = abschnitt.slice(0, abschnitt.indexOf('\n#') + 1 || undefined);
			behaupte(
				!/Angenommen|Abgelehnt/.test(bisZumNaechsten),
				`Der zurückgezogene Antrag trägt ein Ergebnis: ${bisZumNaechsten.slice(0, 300)}`
			);
			return 'im Entwurf unterschieden';
		});

		await schritt('Protokoll: Fassung festhalten, dann weiterarbeiten', async () => {
			/*
			 * **Ohne Siegel kein «versandt»** (Block 8, Produktentscheid
			 * 30.09.2026). Die Seite bietet die Art erst nach dem Versiegeln an;
			 * hier wird genau das gemessen, und die Fassung wird als
			 * «festgehalten» abgelegt. Die versandte Fassung nach dem Siegel hält
			 * `e2e/sitzungsfuehrung.mjs` fest.
			 */
			const artFeld = leitung.locator('form[action="?/festhalten"] select[name="art"]');
			behaupte(await artFeld.count(), 'Kein Feld für die Art der Fassung');
			behaupte(
				(await artFeld.locator('option[value="versandt"]').count()) === 0,
				'Ohne Siegel steht «versandt» zur Wahl'
			);
			// Die Vorgabe ohne Siegel ist «festgehalten»: Wer nur den Knopf drückt,
			// darf keine Fassung «genehmigt» anlegen. Deshalb hier keine Wahl.
			behaupte(
				(await artFeld.inputValue()) === 'festgehalten',
				`Ohne Siegel ist die Vorgabe nicht «festgehalten»: ${await artFeld.inputValue()}`
			);
			await abschicken(
				leitung,
				leitung.locator('form[action="?/festhalten"] button[type="submit"]')
			);
			await behaupteText(leitung, 'Fassung 1 ist festgehalten', 'Die Fassung wurde nicht festgehalten');

			// Weiterarbeiten — die festgehaltene Fassung darf sich nicht mitbewegen.
			await leitung.locator('textarea[name="body"]').fill('# Ganz neu\n\nNach dem Versand geändert.');
			await abschicken(
				leitung,
				leitung.locator('form[action="?/speichern"] button[type="submit"]')
			);
			await behaupteText(leitung, 'Protokoll gespeichert', 'Das Protokoll wurde nicht gespeichert');

			const zeile = leitung.locator('table.fassungen tbody tr').first();
			behaupte(await zeile.count(), 'Die festgehaltene Fassung fehlt in der Liste');
			const inhalt = (await zeile.innerText()).replace(/\s+/g, ' ');
			behaupte(/festgehalten/i.test(inhalt), `Die Fassung nennt ihre Art nicht: ${inhalt}`);
			return inhalt.slice(0, 60);
		});

		/*
		 * **Der leere Protokolltext** (08.09.2026). Bis heute schickte das
		 * sichernde Feld auch die leere Zeichenkette; der Server wies sie zu Recht
		 * ab, und in der Konsole stand ein 400, den der Durchstich meldete, ohne
		 * dass ein Schritt rot wurde. Ausgelöst hat ihn dieser Lauf selbst: Der
		 * Schritt davor ersetzt den Text mit `fill`, und das leert das Feld einen
		 * Augenblick lang.
		 *
		 * Geprüft wird beides: dass die Maske den Zustand ruhig benennt, und dass
		 * nichts hinausgeht. Die zweite Hälfte misst die Liste «Antworten ab 400»
		 * am Ende des Laufs — ohne den Wächter in `SicherndesFeld` steht sie
		 * wieder darin.
		 */
		await schritt('Ein geleertes Protokoll wird nicht gesichert, und sagt es ruhig', async () => {
			const feld = leitung.locator('textarea[name="body"]');
			const vorher = await feld.inputValue();
			behaupte(vorher.trim().length > 0, 'Kein Protokolltext zum Leeren da');

			/*
			 * **Die Anzeige über `#body ~`**, nicht über die erste auf der Seite:
			 * Die Sicherungsanzeigen der Notizen stehen im DOM vor dem Protokoll.
			 * Dieselbe Falle steht weiter oben schon ausgeschrieben.
			 */
			const anzeige = leitung.locator('#body ~ .sicherungsstand').first();
			try {
				await feld.fill('');
				// Die Entprellung im Baustein steht auf 1200 ms; danach hätte er
				// gesendet, wenn er es täte.
				const leer = leitung.locator('#body ~ .sicherungsstand[data-stand="leer"]').first();
				await leer.waitFor({ timeout: 8000 }).catch(() => {});
				behaupte(
					await leer.count(),
					`Das geleerte Feld nennt seinen Zustand nicht: «${(await anzeige.innerText()).replace(/\s+/g, ' ')}»`
				);
				const satz = (await leer.innerText()).replace(/\s+/g, ' ');
				behaupte(
					/bleibt stehen/.test(satz),
					`Der Satz sagt nicht, dass der gesicherte Text bleibt: «${satz}»`
				);
				return satz.slice(0, 60);
			} finally {
				/*
				 * **Aufräumen im `finally`**: Scheitert eine Zusicherung oben, liefen
				 * die Ausgabeschritte danach sonst auf einem leeren Protokoll und
				 * meldeten einen Folgefehler statt der Ursache.
				 *
				 * Das Zurückschreiben ist **kein Nachweis**: Der Text ist danach
				 * wieder der gesicherte, und der Baustein schickt in diesem Fall
				 * nichts, sondern setzt seinen Stand örtlich. Gewartet wird deshalb
				 * nur darauf, dass «leer» weg ist.
				 */
				await feld.fill(vorher);
				await leitung
					.locator('#body ~ .sicherungsstand[data-stand="leer"]')
					.first()
					.waitFor({ state: 'detached', timeout: 8000 })
					.catch(() => {});
			}
		});

		await schritt('Protokoll als Word, als OpenDocument und als PDF', async () => {
			const [word] = await Promise.all([
				leitung.waitForEvent('download', { timeout: 20000 }),
				leitung.click('a[href$="/protokoll.docx"]')
			]);
			const wortpfad = await word.path();
			behaupte(wortpfad, 'Das Word-Dokument kam nicht an');

			/*
			 * **Das OpenDocument seit dem 05.09.2026** (Auftraggeber: «Mach noch eine Odt
			 * Variante»). Geprüft wird nicht nur, dass etwas ankommt, sondern die
			 * ersten Bytes: Ein ZIP beginnt mit «PK», und ODF verlangt den
			 * `mimetype` als ersten Eintrag. Wer das vertauscht, liefert eine
			 * Datei, die manches Werkzeug nicht mehr als OpenDocument erkennt —
			 * und das sieht man einer erfolgreichen Antwort nicht an.
			 */
			const [offen] = await Promise.all([
				leitung.waitForEvent('download', { timeout: 20000 }),
				leitung.click('a[href$="/protokoll.odt"]')
			]);
			const offenerPfad = await offen.path();
			behaupte(offenerPfad, 'Das OpenDocument kam nicht an');
			const kopf = (await readFile(offenerPfad)).subarray(0, 120).toString('latin1');
			behaupte(kopf.startsWith('PK'), 'Das OpenDocument ist kein ZIP');
			/*
			 * Der lokale ZIP-Kopf ist dreissig Byte lang, dann folgt der Name
			 * «mimetype» und unmittelbar sein Inhalt. Steht die Kennung nicht
			 * spätestens ab Byte 30, liegt ein anderer Eintrag davor oder der
			 * Inhalt ist verdichtet.
			 */
			const stelle = kopf.indexOf('mimetypeapplication/vnd.oasis.opendocument.text');
			behaupte(
				stelle > 0 && stelle < 40,
				`Der mimetype steht nicht am Anfang (Stelle ${stelle}): ${JSON.stringify(kopf.slice(0, 60))}`
			);

			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/protokoll.pdf`
			);
			behaupte(antwort.ok(), `Das PDF antwortete mit ${antwort.status()}`);
			const bytes = (await antwort.body()).length;
			behaupte(bytes > 1000, `Das PDF ist mit ${bytes} Byte zu klein`);
			return `${word.suggestedFilename()}, ${offen.suggestedFilename()}, PDF ${Math.round(bytes / 1024)} kB`;
		});

		/*
		 * **Am Ende ist Schluss** (gemeldet am 04.08.2026). Vom Protokoll — dem
		 * letzten Schritt — führte die Weiter-Leiste zurück zu «Einladung
		 * erzeugen». Für eine geschlossene Versammlung ist das keine Führung,
		 * sondern eine Irreführung.
		 */
		await schritt('Die Weiter-Leiste führt am Ende nicht zurück', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const leiste = leitung.locator('nav[aria-label="Weiter im Ablauf"]');
			behaupte(await leiste.count(), 'Am Fuss steht keine Weiter-Leiste');
			const inhalt = (await leiste.innerText()).replace(/\s+/g, ' ');
			behaupte(
				!/Einladung erzeugen/i.test(inhalt),
				`Die Leiste führt zurück zur Einladung: ${inhalt}`
			);
			behaupte(
				/geschlossen und der Ablauf durch/i.test(inhalt),
				`Kein Abschluss am Ende des Ablaufs: ${inhalt}`
			);
			return inhalt.slice(0, 70);
		});

		await schritt('Auswertung als PDF abrufbar', async () => {
			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/auswertung.pdf`
			);
			behaupte(antwort.ok(), `PDF-Abruf schlug fehl: ${antwort.status()}`);
			const koerper = await antwort.body();
			behaupte(
				koerper.subarray(0, 5).toString() === '%PDF-',
				'Die Antwort ist kein PDF'
			);
			return `${Math.round(koerper.length / 1024)} kB`;
		});

		/*
		 * **Das Siegel** (Welle 2, Block 3, FR-51 bis FR-55). Geprüft wird beides:
		 * dass das Paket entsteht — und dass danach nichts mehr geht, was den
		 * Nachweis berührt.
		 */
		await schritt('Versiegeln erzeugt das Abschlusspaket', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/siegel`, {
				waitUntil: 'domcontentloaded'
			});
			const knopf = leitung.locator('form[action="?/versiegeln"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Versiegeln');

			/*
			 * **Der Hinweis vor dem Versiegeln** (Block 7c). Abstimmungen ohne
			 * Ergebnis und ohne Haken nennt die Seite vor dem Knopf, weil die
			 * Auswertung im Paket dem Haken nur bis hier folgt. «Hausordnung
			 * anpassen» trägt den Haken aus dem Schritt oben und steht deshalb
			 * nicht darin: Das ist die Gegenprobe im selben Bild.
			 */
			const hinweis = leitung.locator('[data-hakenhinweis]');
			behaupte((await hinweis.count()) === 1, 'Der Hinweis vor dem Versiegeln fehlt');
			const hinweistext = (await hinweis.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/kein Ergebnis festgehalten/.test(hinweistext) && /vor dem Versiegeln/.test(hinweistext),
				`Der Hinweis sagt nicht, was zu tun ist: ${hinweistext}`
			);
			behaupte(
				!hinweistext.includes('Hausordnung anpassen'),
				`Der Hinweis nennt ein Traktandum, das den Haken schon trägt: ${hinweistext}`
			);
			behaupte(
				(await hinweis.locator('a[href$="/protokoll"]').count()) === 1,
				'Der Hinweis führt nicht zum Protokoll'
			);

			await abschicken(leitung, knopf);
			await behaupteText(leitung, 'Versiegelt', 'Die Versammlung wurde nicht versiegelt');

			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/[0-9a-f]{64}/.test(text),
				`Kein Siegel auf der Seite: ${text.slice(0, 200)}`
			);

			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/abschlusspaket.zip`
			);
			behaupte(antwort.ok(), `Das Paket antwortete mit ${antwort.status()}`);
			paket = await antwort.body();
			behaupte(paket.length > 2000, `Das Paket ist mit ${paket.length} Byte zu klein`);
			return `Paket ${Math.round(paket.length / 1024)} kB`;
		});

		/*
		 * **Ein einzelnes Blatt herausgeben** (S-4, Vorgabe des Auftraggebers 22.09.2026).
		 *
		 * Der Weg wird hier gefahren und nicht nur die Serverfunktion geprüft,
		 * weil an ihm zweimal etwas grün aussah und nichts tat: Die Verlinkung
		 * lag zuerst im Zweig «noch nicht versiegelt» und rendert dort nie, und
		 * die Probe zur Schranke mass den Zeichenfilter statt der Schranke.
		 * Beides fand erst ein Code-Review; ein Durchstich hätte das Erste sofort
		 * gesehen.
		 */
		await schritt('Ein einzelner Stimmnachweis geht heraus und trägt seine Prüfsumme', async () => {
			/*
			 * Selbst navigieren statt die Seite vorauszusetzen. In diesem
			 * Abschnitt gilt «jeder Schritt hinterlässt die Seite, wie er sie
			 * fand»; wer sie nur voraussetzt, meldet beim Einschieben eines
			 * Nachbarn «kein Verweis auf ein Blatt», und das liest sich wie ein
			 * Fehler der Anwendung.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/siegel`, {
				waitUntil: 'domcontentloaded'
			});
			const verweis = leitung.locator('a[href*="/stimmnachweis/"]').first();
			behaupte(
				await verweis.count(),
				'Auf der Siegelseite steht kein Verweis auf ein einzelnes Blatt'
			);

			const adresse = await verweis.getAttribute('href');
			const antwort = await leitung.request.get(`${ZIEL}${adresse}`);
			behaupte(antwort.ok(), `Das Blatt antwortete mit ${antwort.status()}`);

			const art = antwort.headers()['content-type'] ?? '';
			behaupte(art.includes('pdf'), `Das Blatt kam als «${art}» statt als PDF`);
			const ablage = antwort.headers()['content-disposition'] ?? '';
			behaupte(
				/attachment; filename="Stimmnachweis-/.test(ablage),
				`Der Dateiname taugt nicht: ${ablage}`
			);

			const blatt = await antwort.body();
			behaupte(
				blatt.subarray(0, 5).toString('latin1') === '%PDF-',
				'Die Antwort hat keinen PDF-Kopf'
			);

			/*
			 * **Die Prüfsumme gegen das Inhaltsverzeichnis**, und zwar gegen das
			 * auf der Seite. Genau dafür liegt je Traktandum eine eigene Datei im
			 * Paket: Ein Blatt soll sich einzeln halten lassen, ohne dass die
			 * übrigen herausgehen.
			 */
			const { createHash } = await import('node:crypto');
			const gerechnet = createHash('sha256').update(blatt).digest('hex');
			/*
			 * **`textContent`, nicht `innerText`.** Das Inhaltsverzeichnis steht
			 * in einem zugeklappten `<details>`; `innerText` gibt nur
			 * **gerenderten** Text zurück und liefert dort die leere
			 * Zeichenkette. Die erste Fassung dieses Schritts war deshalb rot,
			 * und zwar mit einer Meldung, die nach einem Fehler am Blatt aussah
			 * statt nach einem an der Probe.
			 */
			const verzeichnis = await leitung.locator('details pre').first().textContent();
			const datei = decodeURIComponent(adresse.split('/').pop());
			let verzeichniseintraege;
			try {
				verzeichniseintraege = JSON.parse(verzeichnis ?? '').eintraege ?? [];
			} catch (fehler) {
				/*
				 * Die nackte Meldung von `JSON.parse` nennt weder die Seite noch
				 * die Probe; sie liest sich wie ein Fehler am Blatt. Genau daran
				 * ist die erste Fassung dieses Schritts hängengeblieben.
				 */
				throw new Error(
					`Das Inhaltsverzeichnis auf der Siegelseite ist kein JSON: ${fehler.message}. ` +
						`Gelesen wurden ${String(verzeichnis).length} Zeichen, Anfang: ` +
						`«${String(verzeichnis).slice(0, 60)}»`,
					// Die Ursache anhängen, sonst geht der ursprüngliche Fehler
					// verloren und die Spur endet an dieser Zeile.
					{ cause: fehler }
				);
			}
			const eintrag = verzeichniseintraege.find((e) => e.pfad === `stimmnachweis/${datei}`);
			behaupte(eintrag, `Das Inhaltsverzeichnis kennt «stimmnachweis/${datei}» nicht`);
			/*
			 * **Gegen den Eintrag dieses Blattes, nicht gegen den ganzen Text.**
			 * Die erste Fassung suchte die Prüfsumme irgendwo im Verzeichnis.
			 * Lieferte die Route das **falsche** Blatt aus demselben Paket, stand
			 * dessen Prüfsumme dort ebenfalls, und der Schritt war grün: Gedeckt
			 * war «irgendein Blatt», nicht «dieses Blatt».
			 */
			behaupte(
				eintrag.pruefsumme === gerechnet,
				`Prüfsumme weicht ab: gerechnet ${gerechnet.slice(0, 12)}, im Verzeichnis ` +
					`${eintrag.pruefsumme.slice(0, 12)}`
			);
			behaupte(
				blatt.length === eintrag.groesse,
				`Länge weicht ab: ausgeliefert ${blatt.length}, im Verzeichnis ${eintrag.groesse}`
			);

			/*
			 * **Die Schranke.** `Auswertung.pdf` besteht den Zeichenfilter und
			 * liegt im Paket, nur eine Ebene höher. Nur dieser Fall prüft, dass
			 * das feste Präfix trägt; Namen mit `/` scheitern schon vorher.
			 */
			const daneben = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/stimmnachweis/Auswertung.pdf`
			);
			behaupte(
				daneben.status() === 404,
				`Ein Bestandteil ausserhalb von stimmnachweis/ kam mit ${daneben.status()} heraus`
			);

			return `Blatt ${Math.round(blatt.length / 1024)} kB, Prüfsumme im Verzeichnis`;
		});

		await schritt('Die Herausgabe steht im Verlauf, ohne Namen', async () => {
			/*
			 * Der Eintrag ist die fachliche Begründung für den Umweg über eine
			 * Route: Wer ein Blatt mit Namen weitergibt, tut eine bedeutsame
			 * Handlung. Ohne diesen Schritt wäre er von nichts gedeckt.
			 */
			await leitung.goto(`${ZIEL}/verlauf?gegenstand=${versammlungId}`, {
				waitUntil: 'domcontentloaded'
			});
			await behaupteText(
				leitung,
				'Stimmnachweis herausgegeben',
				'Die Herausgabe steht nicht im Verlauf'
			);

			/*
			 * **«Ohne Namen» wird gemessen, nicht behauptet.** Die Angaben
			 * werden als «Bezeichnung: Wert» gerendert (B2, 03.10.2026; die
			 * Bezeichnungen kommen aus `ANGABEN_WOERTER`), und die Route setzt
			 * genau zwei Felder. Das Muster deckt deshalb beides zugleich: Der
			 * Pfad gehört zu diesem Eintrag, **und** es gibt kein drittes Feld,
			 * in dem ein Name stehen könnte. Wer eines hinzufügt, macht diesen
			 * Schritt rot, und genau das ist der Zweck.
			 *
			 * Die handelnde Person steht daneben in einer eigenen Spalte und
			 * soll dort stehen; gemeint sind die Namen vom Blatt.
			 */
			const zeile = leitung.locator('tr:has-text("Stimmnachweis herausgegeben")').first();
			behaupte(await zeile.count(), 'Keine Zeile zur Herausgabe im Verlauf');
		const angaben = (await zeile.innerText()).replace(/\s+/g, ' ');
		/*
		 * Der Anker am Ende prüft, dass nach der Prüfsumme kein drittes
		 * Feld steht: Die Angaben sind die letzte Zelle der Zeile.
		 * Getrennt wird mit « · » statt Komma (Verlaufsblatt 08.10.2026:
		 * mehrere Wörter der Liste tragen selbst ein Komma).
		 */
		behaupte(
			/Pfad: stimmnachweis\/[^,\s]+\.pdf · Prüfsumme: [0-9a-f]{64}\s*$/.test(angaben),
			`Die Angaben tragen nicht genau Pfad und Prüfsumme: ${angaben.slice(0, 200)}`
		);

			/*
			 * **Zurück auf die Siegelseite.** Dieser Schritt hat den Browser
			 * weggeführt, und der nächste misst wieder dort. Ohne diese Zeile
			 * war er rot, obwohl an ihm nichts fehlte: Ein Schritt, der den
			 * Zustand für seinen Nachbarn ändert, erzeugt einen Befund, der
			 * nach einem Fehler in der Anwendung aussieht.
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/siegel`, {
				waitUntil: 'domcontentloaded'
			});
			return 'Eintrag mit Pfad vorhanden';
		});

		/*
		 * **Der Zeitstempel** (FR-53). Beide Ausgänge sind richtig, und beide
		 * müssen etwas taugen: Ist ein Dienst hinterlegt und erreichbar, liegt der
		 * Stempel vor und lässt sich herunterladen. Sonst steht die Lücke da —
		 * mitsamt dem Weg, sie zu schliessen. Was **nicht** vorkommen darf, ist
		 * eine Seite, die dazu schweigt.
		 */
		await schritt('Der Zeitstempel steht da — vorhanden oder nachholbar', async () => {
			const text = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			const vorhanden = /Zeitstempel vorhanden/i.test(text);
			const offen = /Zeitstempel ausstehend|nicht eingeholt werden/i.test(text);
			behaupte(vorhanden || offen, `Die Seite sagt nichts über den Zeitstempel: ${text.slice(0, 300)}`);

			if (vorhanden) {
				const stempel = await leitung.request.get(
					`${ZIEL}/versammlungen/${versammlungId}/zeitstempel.tsr`
				);
				behaupte(stempel.ok(), `Der Zeitstempel antwortete mit ${stempel.status()}`);
				const bytes = (await stempel.body()).length;
				behaupte(bytes > 500, `Die Antwort ist mit ${bytes} Byte zu klein für einen Stempel`);
				return `bezeugt, ${bytes} Byte`;
			}

			// Offen heisst: Es muss einen Knopf geben. Eine Lücke ohne Weg wäre
			// bloss eine Meldung.
			const nachholen = leitung.locator('form[action="?/zeitstempelNachholen"] button');
			behaupte(await nachholen.count(), 'Kein Knopf, um den Zeitstempel nachzuholen');
			return 'ausstehend, Nachholen angeboten';
		});

		/*
		 * **Das Prüfwerkzeug** (FR-54) mit dem Paket, das eben entstanden ist —
		 * über das Formular, nicht über die Funktion. Genau dazwischen liegen die
		 * Fehler, die kein Datenbanktest sieht: ein Feldname, der nicht passt, ein
		 * Ergebnis, das nicht gerendert wird.
		 */
		await schritt('Das Prüfwerkzeug bestätigt das eigene Paket', async () => {
			await leitung.goto(`${ZIEL}/pruefen`, { waitUntil: 'domcontentloaded' });
			await behaupteText(leitung, 'Abschlusspaket prüfen', 'Das Prüfwerkzeug fehlt');

			const antwort = await leitung.request.post(`${ZIEL}/pruefen`, {
				headers: { origin: ZIEL },
				multipart: {
					paket: { name: 'paket.zip', mimeType: 'application/zip', buffer: paket },
					siegel: ''
				}
			});
			behaupte(antwort.ok(), `Das Prüfwerkzeug antwortete mit ${antwort.status()}`);
			const roh = await antwort.text();
			behaupte(
				/Das Siegel h[^"]{0,3}lt/.test(roh),
				`Das eigene Paket bestand die Prüfung nicht: ${roh.slice(0, 400)}`
			);
			// Die Herkunft ist der stärkere Teil der Aussage: Der Vergleichswert
			// kam aus der Datenbank und nicht aus dem Paket selbst.
			behaupte(
				/hier festgehalten/.test(roh),
				'Die Prüfung nennt die Herkunft nicht — der Vergleich lief gegen nichts'
			);

			// Liegt ein Stempel im Paket, muss er **beurteilt** werden. Ihn bloss
			// mitzuführen und nicht nachzurechnen wäre das Gegenteil der Zusage.
			if (paket.includes('zeitstempel.tsr')) {
				behaupte(
					/Zeitstempel bezeugt es|Ausgestellt von/.test(roh),
					`Der beiliegende Zeitstempel wurde nicht beurteilt: ${roh.slice(0, 400)}`
				);
				return 'Siegel hält, Stempel bezeugt es, Vergleich aus der Datenbank';
			}
			return 'Siegel hält, Vergleich aus der Datenbank';
		});

		await schritt('Die Rüge steht im Abschlusspaket', async () => {
			/*
			 * Das Paket ist unverdichtet. Gesucht wird ein Merkmal, das nur in
			 * `daten/ruegen.json` steht: der Schlüssel `wer` mit dem Namen. Der
			 * Wortlaut allein stünde auch im Verlauf (`objection.recorded`), und
			 * die Probe bliebe bei leerer Liste grün (Codeprüfung H8, N-B).
			 */
			behaupte(paket.includes('daten/ruegen.json'), 'Das Paket führt keine daten/ruegen.json');
			behaupte(
				paket.includes(Buffer.from('"wer": "Vertreterin von Whg 2"', 'utf8')),
				'Die im Saal festgehaltene Rüge fehlt in daten/ruegen.json'
			);
			return 'daten/ruegen.json mit Wortlaut';
		});

		await schritt('Ein verändertes Paket fällt durch', async () => {
			// Der eigentliche Beweis. Ein Byte im ZIP genügt: Die Prüfsumme des
			// Bestandteils ändert sich, und die Prüfung muss ihn **beim Namen**
			// nennen statt bloss zu meckern.
			const verdreht = Buffer.from(paket);
			// Hinter dem lokalen Kopf der ersten Datei liegt ihr Inhalt.
			const stelle = 30 + verdreht.readUInt16LE(26) + verdreht.readUInt16LE(28);
			verdreht[stelle] = verdreht[stelle] ^ 0xff;

			const antwort = await leitung.request.post(`${ZIEL}/pruefen`, {
				headers: { origin: ZIEL },
				multipart: {
					paket: { name: 'paket.zip', mimeType: 'application/zip', buffer: verdreht },
					siegel: ''
				}
			});
			const roh = await antwort.text();
			behaupte(
				/ver[^"]{0,3}ndert worden|weichen ab|weicht ab/.test(roh),
				`Das verfälschte Paket ging durch: ${roh.slice(0, 400)}`
			);
			return 'namentlich beanstandet';
		});

		await schritt('Nach dem Siegel bleibt das Protokoll offen, der Rest nicht', async () => {
			// Das Protokoll ist nicht Teil des Siegels und muss weiter gehen.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const notizform = leitung.locator('form[action="?/notiz"]').first();
			await tippeUndSichere(
				leitung,
				notizform,
				notizform.locator('textarea'),
				'Nachtrag nach dem Versiegeln.'
			);

			// Die Anwesenheit dagegen steht fest: Die Seite bietet nichts mehr an,
			// und der Server wiese es ohnehin ab.
			const anwesenheit = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/anwesenheit?/bestaetigen`,
				{ form: { partei: 'egal', weg: 'von_hand' }, headers: { origin: ZIEL } }
			);
			const inhalt = await anwesenheit.text();
			behaupte(
				!/bestaetigt/i.test(inhalt) || /nicht|versiegelt|fest/i.test(inhalt),
				'Die Anwesenheit liess sich nach dem Versiegeln noch ändern'
			);
			return 'Protokoll ja, Anwesenheit nein';
		});

		await schritt('Eine Fassung nach dem Siegel trägt ein Nachtragssiegel, das Prüfwerkzeug bestätigt die Kette', async () => {
			/*
			 * **Ä-39, H8 Teil B (Migration 161).** Das Abschlusspaket hat das
			 * Prüfwerkzeug schon bestätigt. Jetzt eine Fassung nach dem Siegel:
			 * Sie trägt ein eigenes Siegel, das auf das des Pakets verweist; das
			 * Prüfwerkzeug bestätigt Wortlaut und Kette und meldet einen von Hand
			 * veränderten Wortlaut (Gegenprobe aus der Abnahme).
			 */
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			await bereit(leitung);
			const artFeld = leitung.locator('form[action="?/festhalten"] select[name="art"]');
			await artFeld.selectOption('versandt');
			await abschicken(leitung, leitung.locator('form[action="?/festhalten"] button[type="submit"]'));
			const meldung = (await leitung.locator('body').innerText()).match(/Fassung (\d+) ist festgehalten/);
			behaupte(meldung, 'Die Fassung nach dem Siegel wurde nicht festgehalten');
			const nummer = Number(meldung[1]);

			await leitung.reload({ waitUntil: 'domcontentloaded' });
			await bereit(leitung);
			const kette = (await leitung.locator('p.kette').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Die Kette hält: das Siegel des Abschlusspakets und das Nachtragssiegel einer Fassung/.test(kette),
				`Die Protokollseite nennt die Kette nicht als haltend: «${kette}»`
			);
			const link = leitung.locator(
				`a[href="/versammlungen/${versammlungId}/protokoll/fassung/${nummer}/nachtragssiegel.zip"]`
			);
			behaupte(await link.count(), `Fassung ${nummer} bietet kein Paket mit Siegel an`);

			const antwort = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/protokoll/fassung/${nummer}/nachtragssiegel.zip`
			);
			behaupte(antwort.ok(), `Das Paket der Fassung antwortete mit ${antwort.status()}`);
			const nachtragspaket = await antwort.body();

			const pruefung = await leitung.request.post(`${ZIEL}/pruefen`, {
				headers: { origin: ZIEL },
				multipart: {
					paket: { name: 'fassung.zip', mimeType: 'application/zip', buffer: nachtragspaket },
					siegel: ''
				}
			});
			const roh = await pruefung.text();
			behaupte(
				/Das Nachtragssiegel h[^"]{0,3}lt/.test(roh) &&
					/Die Kette h[^"]{0,3}lt bis zu dieser Fassung/.test(roh),
				`Das Prüfwerkzeug bestätigt Nachtragssiegel und Kette nicht: ${roh.slice(0, 400)}`
			);

			// Gegenprobe: ein Byte im Wortlaut. Er ist der erste Eintrag im Archiv.
			const verdreht = Buffer.from(nachtragspaket);
			const stelle = 30 + verdreht.readUInt16LE(26) + verdreht.readUInt16LE(28);
			verdreht[stelle] = verdreht[stelle] ^ 0x01;
			const falsch = await (
				await leitung.request.post(`${ZIEL}/pruefen`, {
					headers: { origin: ZIEL },
					multipart: {
						paket: { name: 'fassung.zip', mimeType: 'application/zip', buffer: verdreht },
						siegel: ''
					}
				})
			).text();
			behaupte(
				/ver[^"]{0,3}ndert worden/.test(falsch) && falsch.includes(`protokoll-fassung-${nummer}.txt`),
				`Die veränderte Fassung ging durch: ${falsch.slice(0, 400)}`
			);
			return `Fassung ${nummer}: Siegel und Kette bestätigt, Veränderung gemeldet`;
		});

		await schritt('Übersicht führt die geschlossene Versammlung', async () => {
			await leitung.goto(`${ZIEL}/`, { waitUntil: 'domcontentloaded' });
			await behaupteText(leitung, 'Abgeschlossen', 'Kein Abschnitt für abgeschlossene Versammlungen');

			/*
			 * **Gesucht wird über die Schnellsuche** (21.08.2026). Die Übersicht
			 * zeigt nur die letzten fünf abgeschlossenen; sobald mehr Versammlungen
			 * bestehen, steht die eigene nicht mehr darunter — der Schritt scheiterte
			 * genau daran. Die Schnellsuche führt zur vollständigen Liste, und dort
			 * gehört sie hin.
			 */
			const suchfeld = leitung.locator('.schnellsuche input[name="suche"]');
			behaupte(await suchfeld.count(), 'Keine Schnellsuche auf der Übersicht');
			await suchfeld.fill(`E2E ${LAUF}`);
			// Ein GET-Formular: kein POST, auf den `abschicken` warten könnte.
			await Promise.all([
				leitung.waitForURL((u) => u.pathname.startsWith('/versammlungen'), { timeout: 15000 }),
				leitung.locator('.schnellsuche button[type="submit"]').click()
			]);
			await leitung.waitForTimeout(300);
			behaupte(
				leitung.url().includes('/versammlungen'),
				`Die Suche führt nicht zur Liste: ${leitung.url()}`
			);
			await behaupteText(leitung, `E2E ${LAUF}`, 'Die geführte Versammlung fehlt in der Liste');
		});

		await schritt('Der Zugang ist danach wertlos', async () => {
			// Die Karte öffnet nichts mehr. Wer sie nach der Versammlung erneut
			// aufruft, liest **warum** — und nicht eine Aufforderung, einen Code
			// einzutippen, der nichts mehr bewirkt. Das Eingabefeld kommt erst auf
			// ausdrücklichen Wunsch zurück.
			aktuelleSeite = telefon;
			await gehe(telefon, '/z');
			await behaupteText(
				telefon,
				/Versammlung ist geschlossen/i,
				'Das Telefon nennt den Grund nicht mehr'
			);
			await behaupteOhne(
				telefon,
				'Tippen Sie den Code',
				'Das Telefon fordert nach dem Schluss zum Eintippen auf'
			);

			const zurueck = telefon.locator('form[action="?/vergessen"] button');
			behaupte(await zurueck.count(), 'Kein Weg zurück zum Eingabefeld');
			await abschicken(telefon, zurueck.first());
			await behaupteText(telefon, 'Zugangscode', 'Nach «Anderen Zugang» fehlt das Eingabefeld');
			aktuelleSeite = leitung;
		});

		/*
		 * **Aufbewahrung und Löschung** (FR-57). Zwei gegenläufige Zusagen, und
		 * beide müssen im Browser sichtbar halten: Der Zugangscode verschwindet
		 * auf Zuruf, das Paket bleibt.
		 */
		await schritt('Die Bemerkung verlässt die Bewirtschaftungssicht nicht', async () => {
			/*
			 * **Prüflauf I, A-12.** Das Bemerkungsfeld ist eine Arbeitsnotiz über
			 * eine Person: «spricht nur Französisch», «Post an die Tochter». Wer
			 * so etwas führt, muss wissen, wer es zu sehen bekommt — sonst
			 * schreibt niemand hinein, was gemeint war, oder jemand schreibt
			 * hinein, was er nicht sollte.
			 *
			 * Geprüft wird nicht die Absicht, sondern jede Unterlage, die dieser
			 * Durchgang erzeugt hat. Die Bemerkung wurde beim Anlegen der drei
			 * Eigentümer gesetzt und trägt ein Wort, das sonst nirgends vorkommt.
			 */
			const wege = [
				['Einladung', `/versammlungen/${versammlungId}/einladung.pdf`],
				['Traktandenliste', `/versammlungen/${versammlungId}/traktandenliste.pdf`],
				['Unterschriftenliste', `/versammlungen/${versammlungId}/unterschriftenliste.pdf`],
				['Protokoll', `/versammlungen/${versammlungId}/protokoll.pdf`],
				['Auswertung', `/versammlungen/${versammlungId}/auswertung.pdf`],
				['Abschlusspaket', `/versammlungen/${versammlungId}/abschlusspaket.zip`]
			];
			const gefunden = [];
			for (const [name, weg] of wege) {
				const antwort = await leitung.request.get(`${ZIEL}${weg}`);
				if (!antwort.ok()) continue;
				const roh = (await antwort.body()).toString('latin1');
				if (roh.includes(BEMERKUNGSWORT)) gefunden.push(name);
			}

			// Und die Seiten, die im Saal offen sind.
			for (const [name, weg] of [
				['Anwesenheitsliste', `/versammlungen/${versammlungId}/anwesenheit`],
				['Auswertung (Seite)', `/versammlungen/${versammlungId}/auswertung`],
				['Protokoll (Seite)', `/versammlungen/${versammlungId}/protokoll`]
			]) {
				const antwort = await leitung.request.get(`${ZIEL}${weg}`);
				if (!antwort.ok()) continue;
				if ((await antwort.text()).includes(BEMERKUNGSWORT)) gefunden.push(name);
			}

			behaupte(
				gefunden.length === 0,
				`Die Bemerkung steht in: ${gefunden.join(', ')}`
			);

			// Sichtprobe: Sie steht dort, wo sie hingehört — sonst prüfte der
			// Schritt oben nur, dass ein Wort nirgends vorkommt, das es gar nicht
			// gibt.
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
				waitUntil: 'domcontentloaded'
			});
			const inhalt = await leitung.content();
			behaupte(
				inhalt.includes(BEMERKUNGSWORT),
				'Die Bemerkung steht nicht einmal in der Bewirtschaftungssicht — der Vergleich oben war wertlos'
			);
			return `${wege.length + 3} Unterlagen geprüft, keine trägt sie`;
		});

		await schritt('Die Bewirtschaftung lässt sich umbenennen', async () => {
			/*
			 * **Auftraggeber, 25.08.2026**: «Wie kann ich bspw. den Namen der Firma ändern?
			 * Jetzt steht da Probère Immobilien.» Es ging gar nicht — der Name stand
			 * seit dem Einrichten fest.
			 */
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			const alterName = (await leitung.locator('h1').innerText()).trim();
			const neuerName = `Prüflauf Bewirtschaftung ${LAUF}`;

			const feld = leitung.locator('form[action="?/bezeichnung"] input[name="name"]');
			await feld.waitFor({ state: 'visible', timeout: 10000 });

			/*
			 * **`finally`, sonst bleibt der Prüfname stehen.** Der Name ist der
			 * Absender jeder Einladung, und das Aufräumskript fasst `operator`
			 * nicht an — scheiterte die Behauptung dazwischen, hiesse die
			 * Bewirtschaftung dauerhaft «Prüflauf Bewirtschaftung 2026…».
			 */
			try {
				await fuelle(leitung, 'form[action="?/bezeichnung"] input[name="name"]', neuerName);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/bezeichnung"] button[type="submit"]')
				);
				behaupte(
					(await leitung.locator('h1').innerText()).trim() === neuerName,
					'Die Überschrift trägt den neuen Namen nicht'
				);
			} finally {
				await fuelle(leitung, 'form[action="?/bezeichnung"] input[name="name"]', alterName);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/bezeichnung"] button[type="submit"]')
				);
			}
			behaupte(
				(await leitung.locator('h1').innerText()).trim() === alterName,
				'Der alte Name liess sich nicht wiederherstellen'
			);
			return `«${alterName}» → «${neuerName}» → zurück`;
		});

		/*
		 * **Die Adresse, an die erinnert wird** (Migration 099). Der Zeitgeber
		 * selbst lässt sich im Browser nicht auslösen — er läuft ohne Anfrage, und
		 * geprüft ist er in `tests/db/einladungserinnerung.test.ts`. Was hier
		 * zählt, ist die Stelle, an der jemand ihn scharf stellt: Ohne diese
		 * Adresse geschieht nichts, und das muss auffindbar sein.
		 */
		await schritt('Die Adresse für Erinnerungen lässt sich hinterlegen', async () => {
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			const feld = leitung.locator('input[name="erinnerungsadresse"]');
			await feld.waitFor({ state: 'visible', timeout: 30000 });
			const vorher = await feld.inputValue();

			/*
			 * **Die falsche Adresse wird hier NICHT versucht** (01.09.2026). Der
			 * Server weist sie mit 400 ab — richtig so —, und der Beobachter zählt
			 * jede 400 in der Browserkonsole als Befund. Diese Tolerierung zu
			 * lockern hiesse, sie für alle anderen Seiten mit zu lockern. Die
			 * Absage steht deshalb im Datenbanktest
			 * (`tests/db/einladungserinnerung.test.ts`), wo sie hingehört.
			 */
			try {
				await fuelle(leitung, 'input[name="erinnerungsadresse"]', 'erinnerung@example.ch');
				await abschicken(
					leitung,
					leitung.locator('form[action="?/erinnerungsadresse"] button[type="submit"]')
				);
				await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
				behaupte(
					(await leitung.locator('input[name="erinnerungsadresse"]').inputValue()) ===
						'erinnerung@example.ch',
					'Die Adresse steht nach dem Neuladen nicht im Feld'
				);
			} finally {
				// Wie beim Namen: Der Betreiber überlebt das Aufräumskript, und eine
				// stehengebliebene Prüfadresse bekäme später echte Erinnerungen.
				await fuelle(leitung, 'input[name="erinnerungsadresse"]', vorher);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/erinnerungsadresse"] button[type="submit"]')
				);
			}
			return 'gespeichert, nach dem Neuladen im Feld, danach zurückgesetzt';
		});

		await schritt('Die gekürzten Archive suchen im ganzen Bestand', async () => {
			/*
			 * **Die Zusicherung, die brechen kann** (03.09.2026). Beide Archive der
			 * Betreiberseite kürzen über `begrenzt()` auf `LISTENGRENZE` Zeilen; die
			 * Seite war mit 180 Zeilen 10841 px hoch, davon 8504 px Archiv. Gekürzt
			 * wird **nach** dem Filtern — täte man es davor, fände die Suche nur,
			 * was zufällig unter den ersten Zeilen steht, und meldete für alles
			 * andere «kein Treffer». Das wäre schlimmer als keine Suche, weil es wie
			 * eine Antwort aussieht.
			 *
			 * **Der Prüfling muss ausserhalb der gezeigten Zeilen liegen.** Deshalb
			 * wird zuerst aufgeschlagen und die LETZTE Zeile gelesen, dann die Seite
			 * neu geladen (der Knopf von `begrenzt()` ist ein Einwegschalter) und
			 * erst dann gesucht. Nähme man die eben geführte Versammlung, stünde sie
			 * oben, und die Probe wäre auch dann grün, wenn die Suche nur die
			 * gezeigten Zeilen durchsähe.
			 *
			 * **Scharf ist der Schritt erst oberhalb der Grenze** — darunter kürzt
			 * nichts, und er sagt das dann auch, statt grün zu melden.
			 */
			const kastenSelektor =
				'section:has(h3:text-is("Betriebsdaten geschlossener Versammlungen"))';
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			let kasten = leitung.locator(kastenSelektor);

			const zaehler = (await kasten.locator('.zaehler').innerText()).trim();
			const [gezeigt, gesamt] = zaehler.split(' von ').map(Number);
			const sichtbar = await kasten.locator('tbody tr').count();
			behaupte(
				gezeigt === sichtbar,
				`Der Zähler sagt ${gezeigt} gezeigte Zeilen, die Tabelle hat ${sichtbar}`
			);

			const hinweis = kasten.locator('p.mehr');
			if ((await hinweis.count()) === 0) {
				behaupte(
					sichtbar === gesamt,
					`Ohne Hinweis «weitere» erwartet ${gesamt} Zeilen, gezeigt ${sichtbar}`
				);
				return `nur ${gesamt} Einträge — die Kürzung ist hier nicht messbar`;
			}

			behaupte(sichtbar < gesamt, `Der Hinweis «weitere» steht da, obwohl alle ${gesamt} Zeilen sichtbar sind`);
			const verborgen = Number((await hinweis.innerText()).match(/(\d+) weitere/)?.[1]);
			behaupte(
				verborgen === gesamt - sichtbar,
				`Der Hinweis nennt ${verborgen} verborgene, gerechnet sind es ${gesamt - sichtbar}`
			);

			await hinweis.locator('button.flach').click();
			await kasten.locator('tbody tr').nth(sichtbar).waitFor({ timeout: 10_000 });
			const alle = await kasten.locator('tbody tr').count();
			behaupte(alle === gesamt, `Nach dem Aufschlagen ${alle} statt ${gesamt} Zeilen`);
			/*
			 * **Wiedererkannt wird über die Kennung, gesucht über den Namen.** Der
			 * Verweistext ist der Gemeinschaftsname; hält dieselbe Gemeinschaft eine
			 * zweite Versammlung, wäre er mehrdeutig, und «nicht mehr sichtbar»
			 * träfe die falsche Zeile (aus dem Code-Review). Der `href` trägt die
			 * Kennung und ist eindeutig.
			 */
			const letzte = kasten.locator('tbody tr').last();
			const gesucht = (await letzte.locator('a').first().innerText()).trim();
			const kennung = (await letzte.locator('a').first().getAttribute('href')) ?? '';
			behaupte(/\/versammlungen\/[0-9a-f-]{36}$/.test(kennung), `Unerwarteter Verweis: ${kennung}`);

			// Neu laden: Der Knopf von `begrenzt()` schaltet nur auf, nicht zu.
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			kasten = leitung.locator(kastenSelektor);
			behaupte(
				(await kasten.locator('tbody tr').count()) === sichtbar,
				'Nach dem Neuladen steht die Liste nicht wieder gekürzt da'
			);
			behaupte(
				(await kasten.locator(`tbody tr:has(a[href="${kennung}"])`).count()) === 0,
				`«${gesucht}» ist auch gekürzt noch sichtbar — die Probe misst nichts`
			);

			const suchfeld = kasten.locator('input[type="search"]');
			await suchfeld.fill(gesucht);
			await leitung.waitForTimeout(250);
			const treffer = await kasten.locator(`tbody tr:has(a[href="${kennung}"])`).count();
			await suchfeld.fill('');
			behaupte(
				treffer === 1,
				`Die Suche findet «${gesucht}» nicht — sie filtert offenbar nur die gezeigten Zeilen`
			);
			return `${gesamt} Einträge, ${sichtbar} gezeigt, «${gesucht}» ausserhalb und trotzdem gefunden`;
		});

		await schritt('Betriebsdaten lassen sich löschen, das Paket nicht', async () => {
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			await behaupteText(leitung, 'Aufbewahrung', 'Der Abschnitt zur Aufbewahrung fehlt');

			// **Die Suche fehlte hier** (Auftraggeber, 25.08.2026). Beide Tabellen tragen
			// sie jetzt; geprüft wird die, in der gleich gelöscht wird.
			// `h3`: Die Karten stehen seit dem 25.08.2026 unter einer
			// Gruppenüberschrift und sind deren Unterpunkte.
			const betriebsdaten = leitung.locator(
				'section:has(h3:text-is("Betriebsdaten geschlossener Versammlungen"))'
			);
			behaupte(
				await betriebsdaten.locator('input[type="search"]').count(),
				'Bei den Betriebsdaten fehlt das Suchfeld'
			);

			/*
			 * **Erst aufschlagen** (03.09.2026, mit der Kuerzung der Archive). Die
			 * Tabelle zeigt seither `LISTENGRENZE` Zeilen, sortiert nach
			 * `meeting_date DESC`.
			 * Die eben gefuehrte Versammlung steht nur dann darunter, wenn ihr
			 * **Datum** zu den zehn juengsten gehoert — auf einem gewachsenen
			 * Bestand mit ueber sechzig offenen Versammlungen ist das nicht gesagt,
			 * und der Schritt war hier rot, obwohl nichts fehlte.
			 *
			 * Dass die Suche auch ausserhalb der zehn findet, prueft der Schritt
			 * davor. Hier geht es um den Loeschweg, also wird schlicht die ganze
			 * Liste aufgeschlagen.
			 */
			const mehr = betriebsdaten.locator('p.mehr button.flach');
			if (await mehr.count()) {
				const vorherZeilen = await betriebsdaten.locator('tbody tr').count();
				await mehr.click();
				await betriebsdaten.locator('tbody tr').nth(vorherZeilen).waitFor({ timeout: 10_000 });
			}
			const zeile = leitung.locator(`tr:has(a[href="/versammlungen/${versammlungId}"])`);
			behaupte(
				await zeile.count(),
				'Die eben geführte Versammlung steht nicht unter den löschbaren Betriebsdaten'
			);

			/*
			 * **Kein Sprung nach oben** (Auftraggeber, 25.08.2026: «springt der Browser
			 * immer Top»). Das Formular lief ohne `use:enhance` und lud die Seite
			 * neu; wer die vierte von zwölf Zeilen löschte, stand danach wieder am
			 * Seitenanfang. Gemessen wird die Rollhöhe vor und nach dem Klick.
			 */
			await zeile.scrollIntoViewIfNeeded();
			/*
			 * Ist die Seite kürzer als das Fenster, gibt es nichts zu messen —
			 * dann ans Ende rollen. Ein Test, der an einer kurzen Seite **rot**
			 * wird, meldet einen Befund, wo keiner ist.
			 */
			if ((await leitung.evaluate(() => window.scrollY)) === 0) {
				await leitung.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			}
			const vorher = await leitung.evaluate(() => window.scrollY);

			await abschicken(leitung, zeile.locator('form[action="?/betriebsdaten"] button').first());

			// Auf den **Zustand** warten, nicht auf eine Frist: Die Zeile
			// verschwindet, sobald `use:enhance` die Daten neu geholt hat.
			await zeile.waitFor({ state: 'detached', timeout: 15000 });
			const rollhoehe = await leitung.evaluate(() => window.scrollY);
			behaupte(
				vorher === 0 || rollhoehe > 0,
				`Die Seite sprang nach oben: ${vorher} → ${rollhoehe}`
			);
			await behaupteText(leitung, 'Gelöscht:', 'Die Löschung meldete nichts');
			/*
			 * `body`, nicht `main`: Erfolgsmeldungen stehen seit dem 21.08.2026
			 * unten rechts in der Quittungsecke (`Einblender.svelte`) — ausserhalb
			 * des Inhaltsbereichs.
			 */
			const gemeldet = (await leitung.locator('body').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Anwesenheit, Stimmen und Verlauf bleiben/.test(gemeldet),
				'Die Meldung sagt nicht, was bleibt'
			);

			// Das Paket ist danach unverändert abrufbar — die Aufbewahrungsfrist
			// läuft, und die Löschung hat sie nicht angetastet.
			const nachher = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/abschlusspaket.zip`
			);
			behaupte(nachher.ok(), `Das Paket antwortete nach der Löschung mit ${nachher.status()}`);
			behaupte(
				(await nachher.body()).length === paket.length,
				'Das Paket hat sich durch die Löschung verändert'
			);
			return 'Codes weg, Paket unverändert';
		});

		await schritt('Eine versiegelte Versammlung lässt sich erst nach der Genehmigung ihres Protokolls löschen', async () => {
			/*
			 * **Produktentscheid 17.09.2026** (Punkt E-2 der Gegenlesung, nach der
			 * Zweitprüfung Ä-40, Migration 115). Den Löschweg selbst belegen die
			 * Datenbanktests; hier geht es um die Verdrahtung: der Weg aus der
			 * Pakettabelle, die Sperre auf der Seite und die Absage vom Server,
			 * auch an der Seite vorbei.
			 *
			 * **Gelöscht wird nichts.** Das Protokoll dieser Versammlung ist eben
			 * erst entstanden, keine spätere Versammlung hat es genehmigt. Genau
			 * dieser Fall muss im Browser sichtbar bleiben; und die Schritte danach
			 * brauchen die Versammlung noch. Die Rechnung beim Eintippen des
			 * Zustelldatums zeigt die Seite erst nach der Genehmigung, sie ist im
			 * Kern geprüft (`tests/domain/loeschfrist.test.ts`).
			 */
			await leitung.goto(`${ZIEL}/betreiber`, { waitUntil: 'domcontentloaded' });
			await behaupteText(leitung, 'Löschbar ab', 'Die Pakettabelle nennt nicht, ab wann gelöscht werden darf');

			const pakete = leitung.locator('section:has(h3:text-is("Versiegelte Pakete"))');
			const mehr = pakete.locator('p.mehr button.flach');
			if (await mehr.count()) {
				const vorherZeilen = await pakete.locator('tbody tr').count();
				await mehr.click();
				await pakete.locator('tbody tr').nth(vorherZeilen).waitFor({ timeout: 10_000 });
			}
			const weg = pakete.locator(`a[href="/betreiber/loeschen/${versammlungId}"]`);
			behaupte(await weg.count(), 'In der Pakettabelle fehlt der Weg zum Löschen dieser Versammlung');
			const zelle = weg.first().locator('xpath=ancestor::td[1]');
			behaupte(
				/nach Genehmigung/.test(await zelle.innerText()),
				`Die Pakettabelle nennt ein Löschdatum, obwohl das Protokoll nicht genehmigt ist: ${await zelle.innerText()}`
			);
			await Promise.all([
				leitung.waitForURL(`**/betreiber/loeschen/${versammlungId}`),
				weg.first().click()
			]);

			await behaupteText(
				leitung,
				'Gelöscht wird erst, wenn die nächste Versammlung das Protokoll genehmigt hat',
				'Die Löschseite sagt nicht, dass die Genehmigung fehlt'
			);
			// Der Siegelwert steht zum Abschreiben da: Nach dem Löschen gibt es die
			// Siegelzeile nicht mehr, und das Prüfwerkzeug braucht einen Vergleich.
			const siegelzeile = leitung.locator('.siegelwert');
			behaupte(await siegelzeile.count(), 'Die Löschseite nennt den Siegelwert nicht');
			behaupte(
				/Siegel: [0-9a-f]{64}/.test(await siegelzeile.first().innerText()),
				`Der Siegelwert steht nicht als Prüfsumme da: ${await siegelzeile.first().innerText()}`
			);
			behaupte(
				await leitung.locator(`a[href="/versammlungen/${versammlungId}/protokoll"]`).count(),
				'Die Sperre verweist nicht auf die Protokollseite, auf der sich die Genehmigung festhalten lässt'
			);
			behaupte(
				(await leitung.locator('input[name="zugestelltAm"]').count()) === 0,
				'Die Löschseite bietet das Formular an, obwohl das Protokoll nicht genehmigt ist'
			);

			// An der Seite vorbei: Der Server sagt ab, bevor er überhaupt fragt.
			const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
			const antwort = await leitung.request.post(`${ZIEL}/betreiber/loeschen/${versammlungId}?/loeschen`, {
				form: {
					zugestelltAm: heute,
					paketArchiviert: 'on',
					protokollArchiviert: 'on',
					keineAnfechtung: 'on',
					bestaetigt: 'true'
				},
				headers: { origin: ZIEL }
			});
			const roh = await antwort.text();
			behaupte(
				/noch nicht genehmigt/.test(roh),
				`Der Server sagte nicht wegen der fehlenden Genehmigung ab: ${antwort.status()} ${roh.slice(0, 300)}`
			);

			const nachher = await leitung.request.get(
				`${ZIEL}/versammlungen/${versammlungId}/abschlusspaket.zip`
			);
			behaupte(nachher.ok(), `Das Paket antwortete nach der Absage mit ${nachher.status()}`);
			return 'Tabelle «nach Genehmigung», Sperre mit Weg zum Protokoll, Absage vom Server, nichts gelöscht';
		});

		/*
		 * **Beschluss von Hand bei fehlender Beschlussfähigkeit** (Plan
		 * 30.09.2026, Block 2).
		 *
		 * Auf **eigenem Bestand**: Der Hauptbestand hat an dieser Stelle längst
		 * beschlossen, und ein Notweg-Eintrag dort verschöbe jede weitere
		 * Auszählung. Die neue Gemeinschaft und ihre Versammlung bleiben stehen
		 * (Aufräumen über `E2E %`), der Hauptbestand wird nicht angefasst.
		 *
		 * Geprüft wird die Kette der Oberfläche: die Gegenprobe am gewöhnlichen
		 * Weg, die Maske mit der Empfehlung, das Festhalten und die drei Leser,
		 * die der Auftrag nennt (Wand, Protokollentwurf, Verlauf).
		 */
		await schritt('Beschluss von Hand: festhalten ohne Beschlussfähigkeit, an Wand, Protokoll und Verlauf', async () => {
			// ── Eigener Bestand ────────────────────────────────────────────
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Beschluss von Hand ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const g = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(g, `Die Gemeinschaft für den Beschluss von Hand entstand nicht: ${leitung.url()}`);

			for (const [label, quote] of [
				['Whg 1', '500'],
				['Whg 2', '500']
			]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/einheiten`, {
					waitUntil: 'domcontentloaded'
				});
				await fuelle(leitung, 'input[name="label"]', label);
				await fuelle(leitung, 'input[name="quote.stamm"]', quote);
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			for (const name of [`Solo Alpha ${LAUF}`, `Solo Beta ${LAUF}`]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await fuelle(leitung, 'form[action="?/anlegen"] input[name="displayName"]', name);
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			for (const [einheit, partei] of [
				['Whg 1', `Solo Alpha ${LAUF}`],
				['Whg 2', `Solo Beta ${LAUF}`]
			]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="unitId"]'),
					einheit
				);
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="partyId"]'),
					partei
				);
				await abschicken(
					leitung,
					leitung.locator('form[action="?/zuordnen"] button[type="submit"]')
				);
			}

			await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/versammlungen/neu`, {
				waitUntil: 'domcontentloaded'
			});
			await fuelle(leitung, 'input[name="datum"]', hiesigerTag(3));
			await fuelle(leitung, 'input[name="uhrzeit"]', '19:00');
			await fuelle(leitung, 'input[name="ort"]', 'Prüfsaal');
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const v = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(v, `Die Versammlung für den Beschluss von Hand entstand nicht: ${leitung.url()}`);
			const eigeneVersammlung = v[1];
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}`, {
				waitUntil: 'domcontentloaded'
			});
			await leitung.locator('input[name="betriebsart"][value="gefuehrt"]').check();
			await abschicken(leitung, leitung.locator('button[form="angaben"]'));

			// Ein eigenes Traktandum mit Erfordernis; ohne eines gäbe es keinen
			// «Abstimmung freigeben»-Weg, an dem die Gegenprobe hängt.
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			await klickeBis(leitung, aufklappen, anlegen);
			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Hausordnung anpassen');
			// Der Antragswortlaut ist Pflicht; ohne ihn hält die Browser-Validierung
			// den POST auf, und der Schritt wartet auf eine Antwort, die nie kommt.
			await fuelle(
				leitung,
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				'Die Hausordnung wird wie besprochen geändert.'
			);
			await anlegen.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: 'Hausordnung anpassen' });
			await eintrag.first().waitFor({ state: 'visible', timeout: 8000 });
			const eigeneTraktandum = await eintrag.first().getAttribute('data-traktandum');
			behaupte(eigeneTraktandum, 'Das Traktandum für den Notweg steht nicht in der Liste');

			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/freigabe`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			await behaupteOhne(leitung, 'Hindernis', 'Die Freigabe für den Beschluss von Hand blockiert');
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(leitung, leitung.locator('form[action="?/eroeffnen"] button[type="submit"]'));
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(
				leitung,
				leitung
					.locator(
						`form[action="?/aufrufen"]:has(input[value="${eigeneTraktandum}"]) button[type="submit"]`
					)
					.first()
			);

			// ── Gegenprobe: Der gewöhnliche Weg ist gesperrt ───────────────
			// Niemand ist eingelassen, also ist die Versammlung nicht
			// beschlussfähig. Derselbe Nachweis wie im Hauptbestand: der Server
			// sagt ab, und es entsteht kein Durchgang.
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung?/oeffnen`,
				{ form: { traktandum: eigeneTraktandum }, headers: { origin: ZIEL } }
			);
			const roh = await antwort.text();
			behaupte(
				/nicht beschlussf[^"]{0,3}hig/.test(roh),
				`Die Abstimmung liess sich ohne Beschlussfähigkeit freigeben: ${antwort.status()} ${roh.slice(0, 300)}`
			);
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			behaupte(
				(await leitung.locator('form[action="?/schliessen"]').count()) === 0,
				'Nach der Absage steht trotzdem eine offene Abstimmung da'
			);

			// ── Die Maske: Empfehlung, Ausweg, Erfassung ───────────────────
			// Erst hydriert bedienen: Die Parteiliste entsteht, wenn die geführte
			// Auswahl ihren Wert meldet, und `count()` wartet nicht.
			await bereit(leitung);
			const kasten = leitung.locator('details.vonhand');
			behaupte(await kasten.count(), 'Die Maske «Beschluss von Hand» fehlt am aufgerufenen Traktandum');
			// B3-Bilder «unter Jetzt möglich»: zugeklappt und aufgeklappt, bei
			// 1440×900 und 390×844. Der Kasten steht hier ohne Abend an seinem
			// angestammten Platz; der Notweg-Kasten wird in
			// `beschluss-von-hand-am-abend.mjs` fotografiert. Nur mit `BILDER`
			// (Verzeichnis); sonst schriebe jeder Lauf Bilder in ein festes
			// Verzeichnis (Codeprüfung Lauf B).
			const b3bild = process.env.BILDER ? `${process.env.BILDER}/b3-jetztmoeglich` : null;
			const b3breit = leitung.viewportSize() ?? { width: 1400, height: 1000 };
			const b3fotos = async (namen) => {
				if (!b3bild) return;
				for (const [name, breite, hoehe] of namen) {
					await leitung.setViewportSize({ width: breite, height: hoehe });
					await leitung.waitForTimeout(150);
					await kasten.screenshot({ path: `${b3bild}-${name}.png` });
				}
				await leitung.setViewportSize(b3breit);
			};
			await b3fotos([
				['zu-1440', 1440, 900],
				['zu-390', 390, 844]
			]);
			await kasten.locator('summary').click();
			const formular = kasten.locator('form[action="?/beschlussVonHand"]');
			await formular.waitFor({ state: 'visible', timeout: 8000 });
			await b3fotos([
				['auf-1440', 1440, 900],
				['auf-390', 390, 844]
			]);

			const vorDemKnopf = (await kasten.innerText()).replace(/\s+/g, ' ');
			// B3: Marke und Warnkasten, gelesen im aufgeklappten Zustand; die
			// Behauptungen stehen am Ende des Schritts, damit der rote Lauf die
			// übrigen Nachweise dieses Schritts nicht mitreisst.
			const b3marke = (await kasten.locator('summary').innerText()).replace(/\s+/g, ' ').trim();
			const b3warnung = (await kasten.locator('p.meldung.warnung').count())
				? (
						(await kasten.locator('p.meldung.warnung').first().evaluate((el) => el.textContent ?? '')) ??
						''
					).replace(/\s+/g, ' ')
				: '';
			const b3erstes = (await kasten.locator('p.meldung.warnung, p.hilfe').count())
				? await kasten
						.locator('p.meldung.warnung, p.hilfe')
						.first()
						.evaluate((el) => el.className)
				: '';
			behaupte(
				/Votum hätte die Abstimmung so nicht zugelassen/.test(vorDemKnopf),
				`Die Empfehlung fehlt: ${vorDemKnopf.slice(0, 300)}`
			);
			// In der Liste der Absagen gelesen, nicht im ganzen Kasten: Der
			// Warnsatz darunter beginnt mit denselben Worten und hielte die Probe
			// auch bei leerer Liste grün. «Ohne Beschlussfähigkeit wird nicht
			// verbindlich abgestimmt» steht nur in der Absage.
			const absagen = (await kasten.locator('ul.absagen').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/wird nicht verbindlich abgestimmt/.test(absagen),
				`Die übergangene Absage steht nicht im Wortlaut vor dem Knopf: ${absagen.slice(0, 200)}`
			);
			behaupte(
				/kann ihn jeder Eigentümer, der nicht zugestimmt hat/.test(vorDemKnopf),
				'Die Rechtsfolge der fehlenden Beschlussfähigkeit fehlt in der Maske'
			);
			behaupte(
				/halten Sie hier nichts fest/.test(vorDemKnopf),
				'Der Ausweg für «nicht abgestimmt» fehlt in der Maske'
			);

			/*
			 * **Der Stand, den der Eintrag einfriert, steht in Zahlen vor dem
			 * Knopf** (Block 6, Produktentscheid 02.10.2026). Niemand ist
			 * eingelassen: null von zwei Eigentümern, null Wertquoten. Aus
			 * demselben Stand rechnet das Protokoll unten den Satz zur
			 * fehlenden Beschlussfähigkeit.
			 */
			const stand = (await formular.locator('p.stand').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Festgehalten wird der Anwesenheitsstand von jetzt: 0 von 2 Eigentümern anwesend oder vertreten, mit 0 von \d+ Wertquoten\./.test(
					stand
				) &&
					/stellen Sie zuerst die Anwesenheit auf jenen Stand und erfassen Sie nach dem Festhalten wieder/.test(
						stand
					),
				`Die Maske nennt den festgehaltenen Anwesenheitsstand nicht oder falsch: «${stand}»`
			);

			await formular.locator('select[name="erfassung"]').selectOption('parteien');
			const wahlen = formular.locator('select[name^="wahl_"]');
			behaupte(
				(await wahlen.count()) === 2,
				`Die Maske führt ${await wahlen.count()} statt 2 Parteien`
			);
			await wahlen.nth(0).selectOption('yes');
			await wahlen.nth(1).selectOption('no');
			await formular.locator('select[name="ergebnis"]').selectOption('angenommen');
			await formular
				.locator('textarea[name="begruendung"]')
				.fill('Prüflauf: der Saal hat entschieden.');
			// Der Knopf fragt nach. Am Markup geprüft (`textContent`, das
			// geschlossene Fenster steht auf `display: none`); bestätigt wird es
			// vom Beobachter am Kontext (`rueckfragenBestaetigen`).
			const frage = await formular
				.locator('dialog.rueckfrage')
				.evaluate((el) => el.textContent ?? '');
			behaupte(
				/Beschluss von Hand festhalten\?/.test(frage) && /weder ändern noch zurücknehmen/.test(frage),
				`Der Knopf fragt nicht nach, oder die Frage nennt die Folge nicht: «${frage.replace(/\s+/g, ' ').slice(0, 200)}»`
			);
			await abschicken(leitung, formular.locator('button[type="submit"]'));
			await behaupteText(
				leitung,
				'Der Beschluss ist festgehalten',
				'Die Quittung des Festhaltens fehlt'
			);
			await behaupteText(
				leitung,
				'der Beschluss kann angefochten werden',
				'Die Quittung nennt die Anfechtbarkeit nicht, obwohl die Beschlussfähigkeit fehlte'
			);

			// ── Die Leitungsseite: derselbe Kopfspiegel in der Ergebnisliste ─
			// Ohne den Block stünde hier «0 ohne Abgabe» und «Bezugsgrösse 2».
			const ergebnisliste = (await leitung.locator('dl.zahlen').first().innerText()).replace(
				/\s+/g,
				' '
			);
			behaupte(
				/1 ja · 1 nein · 0 Enthaltung/.test(ergebnisliste),
				`Die Leitungsseite zeigt die Zahlen nicht: ${ergebnisliste.slice(0, 200)}`
			);
			behaupte(
				!/Bezugsgrösse|ohne Abgabe/.test(ergebnisliste),
				`Die Leitungsseite zeigt eine Bezugsgrösse: ${ergebnisliste.slice(0, 200)}`
			);

			// ── Die Wand: Ergebnis und Zahlen, kein Weg, keine Bezugsgrösse ─
			// Nur das Saalbild, nicht die Seitenleiste der Präsentationssicht:
			// Dort stehen Anwesenheit und Beschlussfähigkeit (etwa «0 von 2»),
			// und die gehören nicht zum Ergebnis.
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/praesentation`, {
				waitUntil: 'domcontentloaded'
			});
			const wandtext = (await leitung.locator('.bild.ergebnis').innerText()).replace(/\s+/g, ' ');
			behaupte(/Angenommen/i.test(wandtext), `Die Wand zeigt das Ergebnis nicht: ${wandtext.slice(0, 300)}`);
			behaupte(
				/Kopfstimmen: 1 Ja, 1 Nein, 0 Enthaltung/.test(wandtext),
				`Die Wand zeigt die Zahlen nicht: ${wandtext.slice(0, 300)}`
			);
			behaupte(!/von \d/.test(wandtext), `Die Wand zeigt eine Bezugsgrösse: ${wandtext.slice(0, 300)}`);
			behaupte(!/nötig/i.test(wandtext), 'Die Wand zeigt das Erfordernis');
			behaupte(!/ohne Abgabe/i.test(wandtext), 'Die Wand zeigt «ohne Abgabe»');
			behaupte(
				!/von Hand|übergangen|Notweg/i.test(wandtext),
				'Die Wand verrät den Weg'
			);

			// ── Der Protokollentwurf: Ergebnis und Zahlen, weder Erfordernis
			//    noch der Weg, und nicht die übergangene Absage ──────────────
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(leitung, leitung.locator('form[action="?/entwurf"] button[type="submit"]'));
			const protokolltext = (await leitung.locator('textarea[name="body"]').inputValue()).replace(
				/\s+/g,
				' '
			);
			// Nur der Abschnitt des eigenen Traktandums: Die übrigen Traktanden
			// der Vorlage tragen ihr Erfordernis zu Recht.
			const abschnitt =
				/#### \d+(?:\.\d+)* Hausordnung anpassen (.*?)(?= ####| ## )/.exec(protokolltext)?.[1] ?? '';
			behaupte(abschnitt.length > 0, 'Der Protokollentwurf kennt das Traktandum nicht');
			behaupte(/Angenommen\./.test(abschnitt), 'Der Protokollentwurf zeigt das Ergebnis nicht');
			behaupte(
				/Kopfstimmen: 1 Ja, 1 Nein, 0 Enthaltung/.test(abschnitt),
				'Der Protokollentwurf zeigt die Zahlen nicht'
			);
			behaupte(
				!/Erforderliche Mehrheit|nötig/i.test(abschnitt),
				`Der Protokollentwurf nennt ein Erfordernis: ${abschnitt.slice(0, 300)}`
			);
			behaupte(
				!/von Hand|übergangen|Notweg/i.test(abschnitt),
				`Der Protokollentwurf verrät den Weg: ${abschnitt.slice(0, 300)}`
			);
			/*
			 * **Die fehlende Beschlussfähigkeit steht am Beschluss** (Block 5,
			 * Produktentscheid 01.10.2026); die übergangene Absage des Eröffnens
			 * steht weiterhin nur im Verlauf.
			 */
			behaupte(
				/Die Versammlung war bei diesem Beschluss nicht beschlussfähig \(ZGB Art\. 712p\)/.test(
					abschnitt
				),
				`Der Protokollentwurf nennt die fehlende Beschlussfähigkeit nicht: ${abschnitt.slice(0, 300)}`
			);
			behaupte(
				/innert eines Monats beim Gericht anfechten \(ZGB Art\. 75\)\. Die Frist beginnt für Anwesende/.test(
					abschnitt
				),
				`Der Protokollentwurf nennt Frist und Gericht der Anfechtung nicht: ${abschnitt.slice(0, 300)}`
			);
			// Drei Bruchstücke der Absage, vorn und hinten: Der Protokollsatz sagt
			// «war», die Absage «ist», und ihr hinterer Teil käme im Protokoll nie vor.
			behaupte(
				!/Die Versammlung ist nicht beschlussfähig|wird nicht verbindlich abgestimmt|Nachzügler/.test(
					abschnitt
				),
				'Der Protokollentwurf trägt die übergangene Absage'
			);
			/*
			 * **Die Fassung festhalten, bevor später neu erzeugt wird.** Der
			 * Entwurf ersetzt sich nur, wenn der jetzige Wortlaut als Fassung
			 * abgelegt ist; sonst ginge eine Überarbeitung verloren
			 * (`erzeugeProtokollentwurf`).
			 */
			await abschicken(
				leitung,
				leitung.locator('form[action="?/festhalten"] button[type="submit"]')
			);

			// ── Der Verlauf: der Eintrag mit der übergangenen Absage ───────
			// Nach `versammlung` gefiltert, nicht nach `gegenstand`: Der Eintrag
			// hängt am Durchgang, und `gegenstand` vergliche die Durchgangs-Kennung.
			await leitung.goto(`${ZIEL}/verlauf?versammlung=${eigeneVersammlung}`, {
				waitUntil: 'domcontentloaded'
			});
			const verlaufzeile = leitung
				.locator('tr:has-text("Beschluss von Hand festgehalten")')
				.first();
			behaupte(await verlaufzeile.count(), 'Der Verlauf kennt den Beschluss von Hand nicht');
			const angaben = (await verlaufzeile.innerText()).replace(/\s+/g, ' ');
			behaupte(
				/nicht_beschlussfaehig/.test(angaben),
				`Die übergangene Absage steht nicht im Verlaufseintrag: ${angaben.slice(0, 300)}`
			);

			// ── B3: die Maske ist als Notweg kenntlich ────────────────────
			behaupte(
				/\bNotweg\b/.test(b3marke),
				`B3: Die Marke «Notweg» fehlt in der Zusammenfassung: «${b3marke}»`
			);
			behaupte(
				/Das ist der Notweg/.test(b3warnung) && /der Versammlung/.test(b3warnung),
				`B3: Der Warnkasten fehlt oder nennt den Weg nicht: «${b3warnung.slice(0, 200)}»`
			);
			behaupte(
				/warnung/.test(b3erstes),
				`B3: Der Warnkasten steht nicht vor der Einleitung (erstes Element: «${b3erstes}»)`
			);

			/*
			 * **Die Neuabstimmung nach Eintritt der Beschlussfähigkeit**
			 * (Produktentscheid 03.10.2026, Migration 139). Derselbe Fall, einen
			 * Schritt weiter: Die beiden Eigentümer werden eingelassen, die
			 * Versammlung wird beschlussfähig, und die Leitung stimmt direkt
			 * neu ab — ohne Rückkommen. Beide Durchgänge stehen mit Uhrzeit und
			 * Präsenz im Protokoll.
			 */
			const lasseEin = async (name) => {
				await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/anwesenheit`, {
					waitUntil: 'domcontentloaded'
				});
				const auf = leitung.locator('details.vonhand summary');
				behaupte(await auf.count(), 'Kein Weg, ohne Karte einzulassen');
				await auf.click();
				const einlass = leitung.locator('details.vonhand form');
				const wer = einlass.locator('label.wer');
				await wer.locator('input[type="search"]').fill(name);
				const treffer = wer.locator('input[name="partei"]:not([disabled])');
				await warteAufTreffer(treffer, 1);
				await treffer.first().check();
				await abschicken(leitung, einlass.locator('button[type="submit"]'));
			};
			await lasseEin(`Solo Alpha ${LAUF}`);
			await lasseEin(`Solo Beta ${LAUF}`);

			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await bereit(leitung);
			const vorDemZweiten = (await leitung.locator('main').innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Die Versammlung ist jetzt beschlussfähig; Sie können die Abstimmung freigeben\./.test(
					vorDemZweiten
				),
				`Der Hinweis auf die direkte Neuabstimmung fehlt: ${vorDemZweiten.slice(0, 400)}`
			);
			behaupte(
				!/Ein zweiter Durchgang braucht einen Beschluss der Versammlung/.test(vorDemZweiten),
				'Die Seite verlangt weiter ein Rückkommen, obwohl die Gemeinschaft auf «direkt» steht'
			);
			await abschicken(leitung, leitung.locator('form[action="?/oeffnen"] button[type="submit"]'));
			await behaupteText(
				leitung,
				'Die Abstimmung ist offen',
				'Die direkte Neuabstimmung liess sich nicht eröffnen'
			);
			/*
			 * **Der zweite Durchgang wird angenommen.** Die beiden Anwesenden
			 * stimmen Ja; die Zahlen trägt die Leitung als Handzählung ein
			 * (`?/summen`). Nur die Annahme ersetzt den früheren Beschluss
			 * (Rz. 202a ad Art. 712g); die Ablehnung misst die DB-Probe
			 * «Nachquorum 5».
			 */
			const summen = await leitung.request.post(
				`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung?/summen`,
				{
					form: { ja: '2', nein: '0', enthaltung: '0', vermerk: 'Prüflauf: Handmehr' },
					headers: { origin: ZIEL }
				}
			);
			behaupte(
				summen.ok(),
				`Die Handzählung liess sich nicht erfassen: ${summen.status()} ${(await summen.text()).slice(0, 200)}`
			);
			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));

			await leitung.goto(`${ZIEL}/versammlungen/${eigeneVersammlung}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			/*
			 * **Über den zweiten Weg des Entwurfs.** Der Knopf der Seite heisst
			 * nach dem ersten Erzeugen «Entwurf neu erzeugen» und hängt an einer
			 * Rückfrage; der direkte Aufruf derselben Aktion erzeugt den Entwurf
			 * trotzdem frisch aus den Daten.
			 */
			const neu = await leitung.request.post(
				`${ZIEL}/versammlungen/${eigeneVersammlung}/protokoll?/entwurf`,
				{ form: {}, headers: { origin: ZIEL } }
			);
			behaupte(
				neu.ok(),
				`Der Entwurf liess sich nicht neu erzeugen: ${neu.status()} ${(await neu.text()).slice(0, 200)}`
			);
			await leitung.reload({ waitUntil: 'domcontentloaded' });
			const nachherText = (await leitung.locator('textarea[name="body"]').inputValue()).replace(
				/\s+/g,
				' '
			);
			const nachher =
				/#### \d+(?:\.\d+)* Hausordnung anpassen (.*?)(?= ####| ## )/.exec(nachherText)?.[1] ?? '';
			behaupte(nachher.length > 0, 'Der Protokollentwurf kennt das Traktandum nach der Neuabstimmung nicht');
			behaupte(
				/Der 1\. Durchgang wurde um \d{2}:\d{2} Uhr ohne Beschlussfähigkeit festgehalten \(ZGB Art\. 712p\)\./.test(
					nachher
				),
				`Der Protokollsatz nennt den ersten Durchgang nicht: ${nachher.slice(0, 400)}`
			);
			behaupte(
				/Beim Festhalten waren anwesend oder vertreten: 0 von 2 Stockwerkeigentümern, dazu 0 von 2 Kopfstimmen und 0 von [\d']+ Wertquoten\./.test(
					nachher
				),
				`Der Protokollsatz nennt die Präsenz des ersten Durchgangs nicht: ${nachher.slice(0, 400)}`
			);
			behaupte(
				/Nachdem die Versammlung beschlussfähig geworden war, wurde im 2\. Durchgang um \d{2}:\d{2} Uhr erneut abgestimmt\./.test(
					nachher
				),
				`Der Protokollsatz nennt den zweiten Durchgang nicht: ${nachher.slice(0, 400)}`
			);
			// Der zweite Durchgang ist eine Handzählung (`?/summen` oben); seit
			// Migration 156 steht seine Präsenz mit dem Bezug «beim Zählen der
			// Hände», nicht «beim Schluss des Durchgangs» (`nachQuorumSatz`).
			behaupte(
				/Beim Zählen der Hände waren anwesend oder vertreten: 2 von 2 Stockwerkeigentümern, dazu 2 von 2 Kopfstimmen und [\d']+ von [\d']+ Wertquoten\./.test(
					nachher
				),
				`Der Protokollsatz nennt die Präsenz des zweiten Durchgangs nicht: ${nachher.slice(0, 400)}`
			);
			behaupte(
				/Dieser Beschluss ersetzt den Beschluss aus dem 1\. Durchgang\./.test(nachher),
				`Der Protokollsatz nennt die Ersetzung nicht: ${nachher.slice(0, 400)}`
			);
			behaupte(
				!/Rückkommen|Ein zweiter Durchgang braucht einen Beschluss der Versammlung/.test(nachher),
				`Das Protokoll nennt ein Rückkommen, das es nicht gab: ${nachher.slice(0, 400)}`
			);
			/*
			 * Die alte Zeile «Die Versammlung war bei diesem Beschluss nicht
			 * beschlussfähig» steht jetzt nicht mehr am Ergebnis: Der frühere
			 * Durchgang ist ersetzt, und der Satz zu beiden Durchgängen trägt
			 * die Tatsache.
			 */
			behaupte(
				!/Die Versammlung war bei diesem Beschluss nicht beschlussfähig/.test(nachher),
				`Der ersetzte Durchgang trägt weiter den alten Satz: ${nachher.slice(0, 400)}`
			);

			return 'gesperrter Weg, festgehalten, Wand ohne Weg, Protokoll mit fehlender Beschlussfähigkeit und ohne Weg, Verlauf mit Absage, direkt neu abgestimmt mit beiden Durchgängen im Protokoll';
		});

		/*
		 * **Konsultativ abstimmen ohne Beschlussfähigkeit** (Migration 158;
		 * Auftrag H7, Teil B; Ä-18).
		 *
		 * Auf eigenem Bestand wie der Beschluss von Hand: zwei Eigentümer, nur
		 * einer eingelassen, also nicht beschlussfähig. Geprüft wird die Kette
		 * der Oberfläche: das Häkchen beim Freigeben, die Ansage an Leitung und
		 * Wand, «kein Beschluss» nach dem Schliessen, das Protokoll ohne
		 * Beschluss, und danach der verbindliche Durchgang ohne Rückkommen, mit
		 * den Zahlen des konsultativen im Protokoll.
		 *
		 * **Seit Teil D** (Produktentscheid 14.10.2026, «Ja, offen») dazwischen:
		 * Nach der konsultativen Abstimmung bietet die Leitung Ausstand,
		 * Betroffene, Gegenantrag, Rückzug und Mehrheit an, das Erfordernis lässt
		 * sich auf der Erfordernisseite ändern, und ein zweites Geschäft wird nach
		 * seiner konsultativen Abstimmung zurückgezogen; das Protokoll nennt den
		 * Rückzug mit den Zahlen. Der verbindliche Durchgang läuft unter dem neuen
		 * Erfordernis, danach ist wieder alles gesperrt.
		 */
		await schritt('Konsultativ abstimmen ohne Beschlussfähigkeit, ohne Beschluss im Protokoll', async () => {
			// ── Eigener Bestand ────────────────────────────────────────────
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="name"]', `E2E Konsultativ ${LAUF}`);
			await fuelle(leitung, 'input[name="quotaDenominator"]', '1000');
			await leitung.check('input[name="headCountMode"][value="per_owner"]');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const g = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(g, `Die Gemeinschaft für die konsultative Abstimmung entstand nicht: ${leitung.url()}`);
			for (const [label, quote] of [
				['Whg 1', '500'],
				['Whg 2', '500']
			]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/einheiten`, { waitUntil: 'domcontentloaded' });
				await fuelle(leitung, 'input[name="label"]', label);
				await fuelle(leitung, 'input[name="quote.stamm"]', quote);
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			const alpha = `Rat Alpha ${LAUF}`;
			const beta = `Rat Beta ${LAUF}`;
			for (const name of [alpha, beta]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/eigentuemer`, { waitUntil: 'domcontentloaded' });
				await fuelle(leitung, 'form[action="?/anlegen"] input[name="displayName"]', name);
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			for (const [einheit, partei] of [
				['Whg 1', alpha],
				['Whg 2', beta]
			]) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/eigentuemer`, { waitUntil: 'domcontentloaded' });
				await waehleNachAnfang(leitung.locator('form[action="?/zuordnen"] select[name="unitId"]'), einheit);
				await waehleNachAnfang(leitung.locator('form[action="?/zuordnen"] select[name="partyId"]'), partei);
				await abschicken(leitung, leitung.locator('form[action="?/zuordnen"] button[type="submit"]'));
			}
			await leitung.goto(`${ZIEL}/gemeinschaften/${g[1]}/versammlungen/neu`, { waitUntil: 'domcontentloaded' });
			await fuelle(leitung, 'input[name="datum"]', hiesigerTag(4));
			await fuelle(leitung, 'input[name="uhrzeit"]', '19:00');
			await fuelle(leitung, 'input[name="ort"]', 'Prüfsaal');
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const v = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(v, `Die Versammlung für die konsultative Abstimmung entstand nicht: ${leitung.url()}`);
			const vid = v[1];
			await leitung.goto(`${ZIEL}/versammlungen/${vid}`, { waitUntil: 'domcontentloaded' });
			await leitung.locator('input[name="betriebsart"][value="gefuehrt"]').check();
			await abschicken(leitung, leitung.locator('button[form="angaben"]'));
			await leitung.goto(`${ZIEL}/versammlungen/${vid}/traktanden`, { waitUntil: 'domcontentloaded' });
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			await klickeBis(leitung, leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first(), anlegen);
			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Velokeller umgestalten');
			await fuelle(
				leitung,
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				'Der Velokeller wird wie besprochen umgestaltet.'
			);
			await anlegen.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: 'Velokeller umgestalten' });
			await eintrag.first().waitFor({ state: 'visible', timeout: 8000 });
			const tid = await eintrag.first().getAttribute('data-traktandum');
			behaupte(tid, 'Das Traktandum für die konsultative Abstimmung steht nicht in der Liste');
			// Ein zweites für den Rückzug nach der konsultativen Abstimmung (H7, Teil D).
			await klickeBis(leitung, leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first(), anlegen);
			await fuelle(leitung, 'form[action="?/anlegen"] input[name="titel"]', 'Gartenbank ersetzen');
			await fuelle(
				leitung,
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				'Die Gartenbank wird durch eine neue ersetzt.'
			);
			await anlegen.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			const bank = leitung.locator('li[data-traktandum]').filter({ hasText: 'Gartenbank ersetzen' });
			await bank.first().waitFor({ state: 'visible', timeout: 8000 });
			const tidBank = await bank.first().getAttribute('data-traktandum');
			behaupte(tidBank, 'Das Traktandum für den Rückzug steht nicht in der Liste');
			await leitung.goto(`${ZIEL}/versammlungen/${vid}/freigabe`, { waitUntil: 'domcontentloaded' });
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			await behaupteOhne(leitung, 'Hindernis', 'Die Freigabe für die konsultative Abstimmung blockiert');
			await leitung.goto(`${ZIEL}/versammlungen/${vid}`, { waitUntil: 'domcontentloaded' });
			await abschicken(leitung, leitung.locator('form[action="?/eroeffnen"] button[type="submit"]'));

			const lasseEin = async (name) => {
				await leitung.goto(`${ZIEL}/versammlungen/${vid}/anwesenheit`, { waitUntil: 'domcontentloaded' });
				const auf = leitung.locator('details.vonhand summary');
				behaupte(await auf.count(), 'Kein Weg, ohne Karte einzulassen');
				await auf.click();
				const einlass = leitung.locator('details.vonhand form');
				const wer = einlass.locator('label.wer');
				await wer.locator('input[type="search"]').fill(name);
				const treffer = wer.locator('input[name="partei"]:not([disabled])');
				await warteAufTreffer(treffer, 1);
				await treffer.first().check();
				await abschicken(leitung, einlass.locator('button[type="submit"]'));
			};
			await lasseEin(alpha);

			const zurLeitung = async () => {
				await leitung.goto(`${ZIEL}/versammlungen/${vid}/leitung`, { waitUntil: 'domcontentloaded' });
				await bereit(leitung);
			};
			await zurLeitung();
			await abschicken(
				leitung,
				leitung.locator(`form[action="?/aufrufen"]:has(input[value="${tid}"]) button[type="submit"]`).first()
			);
			await zurLeitung();

			// ── Das Häkchen steht nur ohne Beschlussfähigkeit ──────────────
			const haken = leitung.locator('form[action="?/oeffnen"] input[name="konsultativ"]');
			behaupte(await haken.count(), 'Ohne Beschlussfähigkeit fehlt das Häkchen «Konsultativ abstimmen»');
			await behaupteText(leitung, 'Konsultativ, ohne Beschluss, lässt sich auch jetzt abstimmen', 'Der Hinweis über dem Knopf nennt den Weg nicht');
			await haken.check();
			await abschicken(leitung, leitung.locator('form[action="?/oeffnen"] button[type="submit"]'));
			await behaupteText(leitung, 'Die Abstimmung ist offen', 'Die konsultative Abstimmung liess sich nicht eröffnen');
			await behaupteText(
				leitung,
				'Konsultative Abstimmung: Die Versammlung ist nicht beschlussfähig.',
				'Die Leitung sieht während der Abstimmung nicht, dass sie konsultativ ist'
			);
			await leitung.goto(`${ZIEL}/versammlungen/${vid}/praesentation`, { waitUntil: 'domcontentloaded' });
			await behaupteText(leitung, 'ein Beschluss entsteht nicht', 'Die Wand sagt nicht an, dass kein Beschluss entsteht');

			// Die Eingeladene stimmt Ja; nach dem Mehr der Anwesenden wäre das angenommen.
			const summen = await leitung.request.post(`${ZIEL}/versammlungen/${vid}/leitung?/summen`, {
				form: { ja: '1', nein: '0', enthaltung: '0', vermerk: 'Prüflauf: konsultativ' },
				headers: { origin: ZIEL }
			});
			behaupte(summen.ok(), `Die Handzählung liess sich nicht erfassen: ${summen.status()} ${(await summen.text()).slice(0, 200)}`);
			await zurLeitung();
			await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));
			await zurLeitung();
			await behaupteText(
				leitung,
				'Kein Beschluss: Die Versammlung war nicht beschlussfähig, abgestimmt wurde nur konsultativ.',
				'Die Leitung zeigt nach dem Schliessen nicht «kein Beschluss»'
			);
			behaupte(
				(await leitung.locator('input[name="konsultativ"]').count()) > 0,
				'Nach der konsultativen Abstimmung lässt sich nicht erneut freigeben'
			);

			const protokollabschnitt = async (titel = 'Velokeller umgestalten') => {
				await leitung.goto(`${ZIEL}/versammlungen/${vid}/protokoll`, { waitUntil: 'domcontentloaded' });
				const neu = await leitung.request.post(`${ZIEL}/versammlungen/${vid}/protokoll?/entwurf`, {
					form: {},
					headers: { origin: ZIEL }
				});
				behaupte(neu.ok(), `Der Entwurf liess sich nicht erzeugen: ${neu.status()}`);
				await leitung.reload({ waitUntil: 'domcontentloaded' });
				const text = (await leitung.locator('textarea[name="body"]').inputValue()).replace(/\s+/g, ' ');
				return new RegExp(`#### \\d+(?:\\.\\d+)* ${titel} (.*?)(?= ####| ## |$)`).exec(text)?.[1] ?? '';
			};
			const vorher = await protokollabschnitt();
			behaupte(vorher.length > 0, 'Der Protokollentwurf kennt das Traktandum nicht');
			behaupte(
				/Kein Beschluss: Die Abstimmung wurde konsultativ eröffnet, weil die Versammlung nicht beschlussfähig war\./.test(vorher),
				`Das Protokoll nennt die konsultative Abstimmung nicht: ${vorher.slice(0, 300)}`
			);
			behaupte(!/Angenommen\.|Abgelehnt\./.test(vorher), `Im Protokoll steht ein Beschluss: ${vorher.slice(0, 300)}`);
			behaupte(
				!/nötig|Erforderliche Mehrheit/.test(vorher),
				`Das Protokoll nennt beim konsultativen Durchgang eine Schwelle: ${vorher.slice(0, 300)}`
			);
			// Die Fassung festhalten, sonst ersetzt der zweite Entwurf den ersten
			// nicht (`erzeugeProtokollentwurf`; wie im Schritt «Beschluss von Hand»).
			await abschicken(leitung, leitung.locator('form[action="?/festhalten"] button[type="submit"]'));

			// ── H7, Teil D: Nach der konsultativen Abstimmung ist das Geschäft offen ──
			await zurLeitung();
			const jetztMoeglich = async () =>
				(await leitung.locator('.eingriffe').first().locator('ul button').allInnerTexts()).map((w) => w.trim());
			const offenNachKonsultativ = await jetztMoeglich();
			for (const wort of ['Ausstand', 'Betroffene', 'Gegenantrag', 'Zurückziehen', 'Nötige Mehrheit']) {
				behaupte(
					offenNachKonsultativ.includes(wort),
					`Nach der konsultativen Abstimmung bietet die Leitung «${wort}» nicht an: ${offenNachKonsultativ.join(', ')}`
				);
			}
			behaupte(
				!offenNachKonsultativ.includes('Nochmals abstimmen'),
				`Nach der konsultativen Abstimmung steht ein Rückkommen: ${offenNachKonsultativ.join(', ')}`
			);
			// Der Gegenantrag lässt sich aufnehmen: das Formular mit diesem Grundantrag.
			await leitung.locator('.eingriffe').first().locator('ul button', { hasText: 'Gegenantrag' }).click();
			behaupte(
				(await leitung
					.locator(`.eingriffe form[action="?/aufnehmen"] input[name="grundantrag"][value="${tid}"]`)
					.count()) > 0,
				'Nach der konsultativen Abstimmung fehlt das Formular für den Gegenantrag'
			);

			// Das Erfordernis lässt sich ändern, strenger als das der Einladung.
			const erfordernisseite = `${ZIEL}/versammlungen/${vid}/traktanden/${tid}/erfordernis`;
			await leitung.goto(erfordernisseite, { waitUntil: 'domcontentloaded' });
			await behaupteOhne(
				leitung,
				'Über dieses Traktandum ist bereits abgestimmt',
				'Nach der konsultativen Abstimmung sperrt die Erfordernisseite'
			);
			const direktweg = leitung.getByText('Erfordernis ohne Herleitung setzen').first();
			if (await direktweg.count()) await direktweg.click();
			const typ = leitung.locator('select[name="typ"]').first();
			await typ.waitFor({ state: 'visible', timeout: 5000 });
			await typ.selectOption('qualifiziertes_mehr');
			const begruendung = leitung.locator('[name="begruendung"]').first();
			if (await begruendung.count()) await begruendung.fill('Prüflauf: nach dem Meinungsbild strenger.');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').last());
			await leitung.goto(erfordernisseite, { waitUntil: 'domcontentloaded' });
			const bisherGesetzt = (await leitung.locator('p.bisher').first().innerText()).replace(/\s+/g, ' ');
			behaupte(
				/Qualifiziert/i.test(bisherGesetzt),
				`Das Erfordernis liess sich nach der konsultativen Abstimmung nicht ändern: ${bisherGesetzt}`
			);

			// ── Zweites Geschäft: konsultativ, dann zurückgezogen ─────────
			await zurLeitung();
			await abschicken(
				leitung,
				leitung.locator(`form[action="?/aufrufen"]:has(input[value="${tidBank}"]) button[type="submit"]`).first()
			);
			await zurLeitung();
			// Anker für Befund 8 (Featureprüfung, Befund 3): Vor dem Eröffnen steht
			// die nötige Mehrheit da; sonst bewiese «nicht da» danach nichts.
			behaupte(
				(await leitung.locator('p.noetig').count()) > 0,
				'Vor dem Eröffnen nennt die Leitung die nötige Mehrheit nicht; die Prüfung danach hätte keinen Anker'
			);
			await leitung.locator('form[action="?/oeffnen"] input[name="konsultativ"]').check();
			await abschicken(leitung, leitung.locator('form[action="?/oeffnen"] button[type="submit"]'));
			await behaupteText(leitung, 'Die Abstimmung ist offen', 'Die zweite konsultative Abstimmung liess sich nicht eröffnen');
			// Befund 8: kein «nötig» neben der offenen konsultativen Abstimmung.
			behaupte(
				(await leitung.locator('p.noetig').count()) === 0,
				'Während der konsultativen Abstimmung nennt die Leitung oben weiter die nötige Mehrheit'
			);
			const nein = await leitung.request.post(`${ZIEL}/versammlungen/${vid}/leitung?/summen`, {
				form: { ja: '0', nein: '1', enthaltung: '0', vermerk: 'Prüflauf: konsultativ, dann Rückzug' },
				headers: { origin: ZIEL }
			});
			behaupte(nein.ok(), `Die Handzählung zur Gartenbank liess sich nicht erfassen: ${nein.status()}`);
			await zurLeitung();
			await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));
			await zurLeitung();
			await leitung.locator('.eingriffe').first().locator('ul button', { hasText: 'Zurückziehen' }).click();
			const rueckzug = leitung.locator('.eingriffe form[action="?/zurueckziehen"]').first();
			await rueckzug.locator('input[name="grund"]').fill('Die Offerte wird überarbeitet.');
			await abschicken(leitung, rueckzug.locator('button[type="submit"]'));
			await zurLeitung();
			await behaupteText(leitung, 'Der Antrag ist zurückgezogen', 'Der Rückzug nach der konsultativen Abstimmung ging nicht durch');
			const bankabschnitt = await protokollabschnitt('Gartenbank ersetzen');
			behaupte(
				/Der Antrag wurde nach der konsultativen Abstimmung zurückgezogen: Die Offerte wird überarbeitet\./.test(bankabschnitt),
				`Das Protokoll nennt den Rückzug nach der konsultativen Abstimmung nicht: ${bankabschnitt.slice(0, 400)}`
			);
			behaupte(
				/- Es wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig war; ein Beschluss entstand dabei nicht\. Kopfstimmen: 0 Ja, 1 Nein/.test(bankabschnitt),
				`Die Zahlen des konsultativen Durchgangs fehlen beim Rückzug: ${bankabschnitt.slice(0, 400)}`
			);
			behaupte(
				!/vor der Abstimmung zurückgezogen|Angenommen\.|Abgelehnt\./.test(bankabschnitt),
				`Das Protokoll zum Rückzug sagt «vor der Abstimmung» oder nennt einen Beschluss: ${bankabschnitt.slice(0, 400)}`
			);
			await abschicken(leitung, leitung.locator('form[action="?/festhalten"] button[type="submit"]'));

			// ── Danach beschlussfähig: verbindlich, ohne Rückkommen ───────
			await lasseEin(beta);
			await zurLeitung();
			await abschicken(
				leitung,
				leitung.locator(`form[action="?/aufrufen"]:has(input[value="${tid}"]) button[type="submit"]`).first()
			);
			await zurLeitung();
			behaupte(
				(await leitung.locator('form[action="?/oeffnen"] input[name="konsultativ"]').count()) === 0,
				'Das Häkchen «konsultativ» steht auch bei gegebener Beschlussfähigkeit'
			);
			await abschicken(leitung, leitung.locator('form[action="?/oeffnen"] button[type="submit"]'));
			await behaupteText(leitung, 'Die Abstimmung ist offen', 'Nach der konsultativen liess sich nicht verbindlich eröffnen');
			// Einzeln erfasst: Das qualifizierte Mehr braucht die Wertquoten, die
			// eine Handzählung nicht liefert (`summenhindernis`).
			const auf = leitung.locator('summary', { hasText: 'Alle Stimmen von Hand erfassen' });
			if (await auf.count()) await auf.first().click();
			const erfassung = leitung.locator('form[action="?/erfassen"]');
			await erfassung.first().waitFor({ state: 'attached', timeout: 8000 });
			await leitung.evaluate(() => {
				document.querySelectorAll('details:has(form[action="?/erfassen"])').forEach((d) => (d.open = true));
			});
			const begruendungErfassen = erfassung.locator('input[name="begruendung"]');
			if (await begruendungErfassen.count()) await begruendungErfassen.fill('Prüflauf: im Saal von Hand abgestimmt.');
			const ja = erfassung.locator('tbody tr input[type="radio"][value="yes"]');
			const anzahlJa = await ja.count();
			behaupte(anzahlJa === 2, `In der Stimmerfassung stehen ${anzahlJa} statt 2 Parteien`);
			for (let i = 0; i < anzahlJa; i++) await ja.nth(i).check();
			await abschicken(leitung, erfassung.locator('button[type="submit"]').first());
			await zurLeitung();
			await abschicken(leitung, leitung.locator('form[action="?/schliessen"] button[type="submit"]'));
			const nachher = await protokollabschnitt();
			behaupte(/Angenommen\./.test(nachher), `Der verbindliche Durchgang fehlt im Protokoll: ${nachher.slice(0, 400)}`);
			behaupte(
				// In Worten, nicht mit dem Titel: Die Hälfte der Wertquoten kennt nur das
				// neue Erfordernis, das alte (Hausordnung) zählt Köpfe.
				/Erforderliche Mehrheit: [^.]*mehr als die Hälfte aller Wertquoten/.test(nachher),
				`Der verbindliche Durchgang trägt nicht das nach der konsultativen Abstimmung gesetzte Erfordernis: ${nachher.slice(0, 400)}`
			);
			behaupte(
				/Im 1\. Durchgang wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig war; ein Beschluss entstand dabei nicht\. Kopfstimmen: 1 Ja/.test(nachher),
				`Die Zahlen des konsultativen Durchgangs fehlen im Protokoll: ${nachher.slice(0, 500)}`
			);
			// Gegenprobe (Kriterium 6): nach dem verbindlichen Beschluss wieder gesperrt.
			await zurLeitung();
			const nachBeschluss = await jetztMoeglich();
			// Anker: Die Zeile ist da und bietet das Rückkommen an (Featureprüfung,
			// Befund 3); sonst wäre «nicht angeboten» auch bei leerer Zeile grün.
			behaupte(
				nachBeschluss.includes('Nochmals abstimmen'),
				`Nach dem verbindlichen Beschluss fehlt «Nochmals abstimmen»: ${nachBeschluss.join(', ')}`
			);
			for (const wort of ['Ausstand', 'Betroffene', 'Gegenantrag', 'Zurückziehen', 'Nötige Mehrheit']) {
				behaupte(
					!nachBeschluss.includes(wort),
					`Nach dem verbindlichen Beschluss bietet die Leitung «${wort}» weiter an: ${nachBeschluss.join(', ')}`
				);
			}
			await leitung.goto(erfordernisseite, { waitUntil: 'domcontentloaded' });
			await behaupteText(
				leitung,
				'Über dieses Traktandum ist bereits abgestimmt',
				'Nach dem verbindlichen Beschluss lässt die Erfordernisseite das Ändern zu'
			);
			return 'Häkchen nur ohne Beschlussfähigkeit, Ansage an Leitung und Wand, kein Beschluss im Protokoll; danach offen (Eingriffe, Erfordernis geändert, Rückzug mit Zahlen im Protokoll); verbindlich unter dem neuen Erfordernis, danach wieder gesperrt';
		});

		/*
		 * **Ganz zuletzt**, weil dieser Schritt die Anmeldung wegnimmt.
		 *
		 * `SicherndesFeld` schickt seinen Text als JSON und prüfte nur
		 * `antwort.ok`. Bis zum 27.08.2026 beantwortete der Wächter eine
		 * abgelaufene Anmeldung mit `303` auf `/anmelden`; `fetch` folgt der
		 * Umleitung von sich aus, bekommt die Anmeldeseite mit HTTP 200, und das
		 * Feld meldete «gesichert» und **löschte den Merker auf dem Gerät**.
		 * Gemessen am 27.08.2026: `data-stand="gesichert"`, `localStorage` leer,
		 * nichts geschrieben. Der Protokolltext einer Versammlung ist genau das,
		 * was sich nicht rekonstruieren lässt (FR-46).
		 *
		 * Seither antwortet der Wächter einem JSON-Schreiber mit `401`
		 * (`src/lib/server/absageantwort.ts`), und der Zweig `!antwort.ok` behält
		 * den Text.
		 */
		await schritt('Abgelaufene Anmeldung löscht keinen Protokolltext', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/protokoll`, {
				waitUntil: 'domcontentloaded'
			});
			const feld = leitung.locator('textarea').first();
			behaupte(await feld.count(), 'Kein sicherndes Feld auf der Protokollseite');
			const stand = leitung.locator('.sicherungsstand').first();

			gewollteAbmeldung = true;
			await leitung.context().clearCookies();
			await feld.fill(`E2E nach Ablauf ${LAUF}`);
			/*
			 * Auf den **abgeschlossenen** Zustand warten, nicht auf irgendeine
			 * Änderung: Das Feld steht nach dem Tippen erst auf «offen» und sichert
			 * 1,2 s nach dem letzten Anschlag. Ein erster Anlauf las «offen» und
			 * meldete einen Fehler, den es nicht gab.
			 */
			await leitung.waitForFunction(
				() =>
					['gesichert', 'fehler', 'konflikt'].includes(
						document.querySelector('.sicherungsstand')?.getAttribute('data-stand') ?? ''
					),
				null,
				{ timeout: 20000 }
			);
			const gemeldet = await stand.getAttribute('data-stand');
			behaupte(
				gemeldet === 'fehler',
				`Das Feld meldete «${gemeldet}» statt eines Fehlers — bei «gesichert» ist der Text weg`
			);
			const behalten = await leitung.evaluate(() => localStorage.length > 0);
			behaupte(behalten, 'Der Merker auf dem Gerät wurde gelöscht, obwohl nichts gespeichert war');
			// Die Freistellung endet mit dem Schritt. Sie stehen zu lassen wäre
			// dieselbe Bauart wie eine laufweite Ausnahme, nur unauffälliger.
			gewollteAbmeldung = false;
			return `${gemeldet}, Text liegt weiter auf dem Gerät`;
		});
	} finally {
		if (rueckfragen.length > 0) {
			console.log('\nRückfragen, die bestätigt wurden:');
			for (const r of rueckfragen) console.log(`  · ${r}`);
		}
		if (fehlantworten.length > 0) {
			console.log('\nAntworten ab 400:');
			for (const f of [...new Set(fehlantworten)]) console.log(`  · ${f}`);
		}
		if (konsolenfehler.length > 0) {
			console.log('\nFehler in der Browserkonsole:');
			for (const f of [...new Set(konsolenfehler)]) console.log(`  · ${f}`);
		}
		/*
		 * **Im `finally`, und das ist der Punkt** (aus dem Review). Ein grüner
		 * Lauf mit Wiederholungen ist etwas anderes als einer ohne, aber gebraucht
		 * wird die Zeile vor allem im ROTEN Ausgang: Dort verlässt ein
		 * abgebrochener Schritt `main()` über eine Ausnahme, und alles hinter dem
		 * `try` läuft nie. Genau dort stand sie zuerst.
		 *
		 * Die Wache nimmt einen zweiten Anlauf, wenn eine Seite ausschliesslich an
		 * `net::ERR_NETWORK_CHANGED` gescheitert ist (CI-Jobs auf demselben Host,
		 * siehe `e2e/bereit.mjs`). Bliebe das stumm, hielte man die Umgebung für
		 * gesund, während sie es nicht ist.
		 */
		if (netzWiederholungen() > 0) {
			console.log(
				`\n${netzWiederholungen()} Ladeversuch(e) mussten wegen eines Netzwechsels wiederholt werden.`
			);
		}
		await browser.close();
	}

	console.log(`\n${schrittzahl} Schritte, ${befunde.length} Befunde.`);
	if (konsolenfehler.length > 0) {
		throw new Error(`${new Set(konsolenfehler).size} Fehler in der Browserkonsole`);
	}
}

try {
	await main();
	console.log('Durchlauf grün.');
} catch (fehler) {
	console.error(`\nDurchlauf abgebrochen: ${fehler.message}`);
	console.error(umgebungsbefund(fehler.message));
	process.exitCode = 1;
}
