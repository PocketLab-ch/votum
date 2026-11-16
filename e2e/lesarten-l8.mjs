/**
 * Durchstich: Lesart L8, Vollmachten der Verwaltung (Migration 184,
 * Entscheid 0045, Punkte 1 bis 7; Einteilung F3b, B4).
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern zu 400, 300 und 300 von
 * 1000 (Amsler, Brügger, Caflisch). Brügger kommt nicht selbst; er hat die
 * Verwaltung bevollmächtigt, und die Vollmacht trägt das Häkchen
 * «Bevollmächtigt ist die Verwaltung». Erfasst und bestätigt wird sie am
 * Einlass, wenn die Verwaltung als dritte Person mit der Papiervollmacht
 * eintritt.
 *
 * Versammlung 1 wird unter der Vorgabe «Vollmachten ruhen» freigegeben. Sie
 * trägt die Entlastung der Verwaltung mit dem Häkchen «Geschäft der
 * Verwaltung» und die Genehmigung des Protokolls ohne Häkchen, beide
 * `k-decharge` (einfaches Mehr der Anwesenden und Vertretenen, nur Köpfe).
 * Das Häkchen an einer Wiederwahl der Verwaltung weist Votum im Entwurf ab;
 * nach der Freigabe ist es gesperrt. Danach stellt die Verwaltung die
 * Gemeinschaft auf «Die Sitzungsleitung entscheidet» und gibt Versammlung 2
 * frei, mit zwei Entlastungen mit Häkchen. Versammlung 1 läuft, während die
 * Gemeinschaft auf «leitung» steht; dann stellt die Verwaltung zurück, und
 * Versammlung 2 läuft, während sie auf «ruhen» steht: Jede rechnet nach der
 * Wahl, die bei ihrer Freigabe galt, die Einladung ebenso (Kriterium 3).
 *
 * **Die Rechnung** (einfaches Mehr: mehr als die Hälfte der Köpfe, die
 * zählen; Amsler Ja, Caflisch Nein, die Verwaltung für Brügger Ja, wo Votum
 * die Stimme annimmt):
 *
 * - V1, Entlastung, ruhen: Brügger steht ohne Erklärung im Ausstand. Basis 2
 *   (Amsler, Caflisch), 1 Ja, nötig 2: abgelehnt. Grenzen nach «leitung»
 *   (Entscheid 0045, Punkt 2): die ruhende Vollmacht Ja ergibt 2 Ja von 3,
 *   nötig 2, angenommen; Nein ergibt 1 Ja von 3, abgelehnt. Die Grenzen
 *   unterscheiden sich: «nicht bestimmbar», eine ruhende Vollmacht, Rat zur
 *   Ablehnung. Kein zweites Ergebnis im Protokoll, nur die Tatsache (Punkt 3).
 * - V1, Protokoll, ruhen, ohne Häkchen: Die Stimme der Verwaltung zählt.
 *   2 Ja von 3, nötig 2: angenommen (ruhte sie, wäre es 1 von 2, abgelehnt).
 *   Kein zweites Ergebnis zu L8.
 * - V2, Entlastung, leitung: Die Stimme zählt. 2 Ja von 3, nötig 2:
 *   angenommen. Nach der Vorgabe («ruhen») 1 Ja von 2 Kopfstimmen, nötig 2:
 *   abgelehnt; Leitung und Protokoll nennen das (Punkt 1, Kriterium 7).
 * - V2, Entlastung des Vorjahres, leitung, nur Summen 2 Ja, 1 Nein, 0
 *   Enthaltungen: 2 von 3, angenommen. Nach «ruhen» fällt eine Hand heraus,
 *   ohne dass die Dreizahl sagt, welche: war es ein Ja, 1 von 2, abgelehnt;
 *   ein Nein, 2 von 2, angenommen. Nicht bestimmbar, mit dem Satz
 *   `verwaltung_summen` und dem Rat zur Annahme (H1, Lauf 5).
 *
 * Kriterien (Auftrag 2026-11-06, Akzeptanzkriterien; Entscheid 0045): 3
 * (Einfrieren), 6 (ruhen, mit Gegenfall ohne Häkchen am Traktandum), 7
 * (leitung), 8 (Häkchen an der Wahl abgewiesen, ab der Freigabe gesperrt), 9
 * (Einladung, Leitung, Protokoll); Entscheid 0045, Punkte 1, 2, 3 und 7.
 * Punkt 9 (Folgeanträge) prüft ein eigenes Drehbuch.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l8.mjs
 *
 * Die Einladung prüft das Drehbuch über `pdftotext` (poppler-utils); fehlt
 * das Werkzeug, bricht der Schritt mit dieser Angabe ab.
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l8';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const [AMSLER, BRUEGGER, CAFLISCH] = ['Amsler', 'Brügger', 'Caflisch'].map((n) => `${n} ${LAUF}`);
const LEUTE = [AMSLER, BRUEGGER, CAFLISCH];
const QUOTEN = ['400', '300', '300'];
const VERWALTUNG = `Musterverwaltung Seeblick AG ${LAUF}`;

const ENTLASTUNG = 'Entlastung der Verwaltung für das Jahr 2026';
const PROTOKOLL = 'Genehmigung des Protokolls der letzten Versammlung';
const WIEDERWAHL = 'Wiederwahl der Verwaltung';
const ENTLASTUNG_VORJAHR = 'Entlastung der Verwaltung für das Jahr 2025';

/*
 * Erwartete Wortlaute, aus den Grundlagen statt aus der Seite:
 * Katalog `src/lib/domain/lesarten.ts` (L8), Auftrag Lauf 3 «Wortlaute»
 * (Einladung, Absage Wahl), Auftrag Lauf 4 (Rat unter «ruhen»), Auftrag Lauf 5
 * (Rat bei Summen) und `tests/db/lesart-verwaltungsvollmacht.test.ts`.
 */
const FRAGE_L8 =
	'Ruhen die Vollmachten der Verwaltung, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ' +
	'ihre Entlastung abgestimmt wird?';
// Wortlaute seit G7 und der Laien- und Fachprüfung Runden 10 bis 12
// (08.11.2026, Entscheid 0045, Punkt 10); gegen einen Stand vor G7 rot.
const EINLADUNG_RUHEN =
	'Bei diesem Traktandum zählen keine Stimmen, die die Verwaltung mit einer Vollmacht abgibt, auch ' +
	'nicht solche mit Weisung. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen hier ' +
	'mitstimmen, kommen Sie selbst oder bevollmächtigen eine andere Person, die nicht für die ' +
	'Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der Verwaltung, dass ' +
	'ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen ' +
	'Traktanden dieser Versammlung für Sie.';
const EINLADUNG_LEITUNG =
	'Bei diesem Traktandum entscheidet die Sitzungsleitung, ob Stimmen zählen, die die Verwaltung ' +
	'mit einer Vollmacht abgibt. Das gilt auch für Stimmen, zu denen Sie der Verwaltung eine Weisung ' +
	'gegeben haben. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen sicher sein, dass ' +
	'Ihre Stimme hier zählt? Dann kommen Sie selbst oder bevollmächtigen eine andere Person, die ' +
	'nicht für die Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der ' +
	'Verwaltung, dass ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann ' +
	'bei allen Traktanden dieser Versammlung für Sie.';
const ABSAGE_WAHL =
	'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.5). ' +
	'Geht es auch um ihre Entschädigung, stimmen Sie diese in einem eigenen Traktandum ab und setzen ' +
	'Sie das Häkchen nur dort.';
// Der Anfang der Sätze an die Leitung vor dem Eröffnen; der Schluss zur Rüge
// änderte sich mit Lauf 4 und 5 und ist nicht Gegenstand dieses Durchstichs.
const LEITUNG_RUHEN =
	'Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. ' +
	'Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, ' +
	'wenn sie selbst da sind oder eine andere Person bevollmächtigt haben.';
const LEITUNG_LEITUNG =
	'Bei diesem Traktandum geht es um ein Geschäft der Verwaltung. Nach der Einstellung Ihrer ' +
	'Gemeinschaft entscheiden Sie, ob ihre Vollmachten ruhen; wollen Sie das, erklären Sie den Ausstand ' +
	'der Verwaltung.';
const ZWEITES_RUHEN_OFFEN =
	'Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der ' +
	'Verwaltung gezählt. Je nachdem, wie die Verwaltung damit gestimmt hätte, hätte das Ergebnis anders ' +
	'ausfallen können; erfasst ist das nicht, weil Votum diese Stimmen nicht annimmt. Die Ablehnung gilt ' +
	'wie gezählt. Wer nicht Nein gestimmt hat, auch eine Partei, die nur über die ruhende Vollmacht ' +
	'vertreten war, und meint, diese Stimmen hätten zählen müssen, kann die Ablehnung beim Gericht ' +
	'anfechten,';
const PROTOKOLL_RUHEN =
	'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
	`Für eine vertretene Partei (${BRUEGGER}) zählte deshalb keine Stimme.`;
const SUMMEN_GRUND =
	'lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht ' +
	'getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat.';
const SUMMEN_RAT =
	'Der Beschluss gilt wie gezählt. Wer ihm nicht zugestimmt hat und meint, diese Stimmen hätten ruhen ' +
	'müssen, kann ihn beim Gericht anfechten,';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

function eng(t) {
	return (t ?? '').replace(/\s+/g, ' ').trim();
}

function zaehle(text, teil) {
	return text.split(teil).length - 1;
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
}

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

let browser;
let seite;

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? `: ${ergebnis}` : ''}`);
	} catch (f) {
		fehler.push({ nr, titel, text: f.message });
		console.log(`  ✗ ${nr} ${titel}\n     ${f.message}`);
		try {
			await seite.screenshot({ path: `${AUFNAHMEN}/fehler-${nr}.png`, fullPage: true });
			console.log(`     Bild: ${AUFNAHMEN}/fehler-${nr}.png`);
		} catch {
			/* ohne Bild weiter */
		}
		throw f;
	}
}

async function abschicken(knopf) {
	const nachladen = nachladeWarter(seite);
	const [antwort] = await Promise.all([
		seite
			.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 })
			.catch(() => null),
		knopf.click()
	]);
	await nachAbsendung(seite, antwort, nachladen, 300);
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

async function seitentext() {
	const haupt = await seite.locator('main').innerText();
	const quittungen = await seite
		.locator('.einblender')
		.innerText()
		.catch(() => '');
	return eng(`${haupt} ${quittungen}`);
}

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"]), details:has(form[action="?/summen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

/** Auf der Seite der Lesarten L8 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L8"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	behaupte(
		await seite.locator(`input[name="L8"][value="${wahl}"]`).isChecked(),
		`Nach dem Speichern steht L8 nicht auf «${wahl}»`
	);
}

/** Ein Traktandum im Entwurf anlegen; gibt den Text der Seite nach dem Absenden zurück. */
async function legeAn(versammlung, { titel, wortlaut, erfordernis, haekchen }) {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	await seite.locator('.neu button.haupt').click();
	await seite.waitForTimeout(250);
	const tf = seite.locator('form[action="?/anlegen"]').first();
	await tf.locator('input[name="titel"]').fill(titel);
	await tf.locator('input[name="art"][value="abstimmung"]').check();
	await seite.waitForTimeout(200);
	await tf
		.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
		.first()
		.fill(wortlaut);
	await tf.locator('select[name="erfordernis"]').selectOption(erfordernis);
	const kaestchen = tf.locator('input[name="verwaltungsGeschaeft"]');
	behaupte(await kaestchen.count(), 'Kein Häkchen «Geschäft der Verwaltung» im Formular');
	if (haekchen) await kaestchen.check();
	await abschicken(tf.locator('button[type="submit"]').first());
	return seitentext();
}

/** Die Zeile eines Traktandums auf der Traktandenseite. */
function traktandumzeile(titel) {
	return seite.locator('li[data-traktandum]', { hasText: titel }).first();
}

/** Die Einladung als Text, über `pdftotext`. */
async function einladungstext(versammlung, name) {
	const antwort = await seite.request.get(`${ZIEL}/versammlungen/${versammlung}/einladung.pdf`);
	behaupte(antwort.ok(), `Die Einladung kam nicht: HTTP ${antwort.status()}`);
	const pfad = `${AUFNAHMEN}/${name}.pdf`;
	await writeFile(pfad, await antwort.body());
	let text;
	try {
		text = execFileSync('pdftotext', ['-enc', 'UTF-8', pfad, '-'], { encoding: 'utf8' });
	} catch (f) {
		throw new Error(`pdftotext fehlt oder scheitert (poppler-utils): ${f.message}`, { cause: f });
	}
	await writeFile(`${AUFNAHMEN}/${name}.txt`, text);
	// Zeilenumbrüche im PDF zu Leerzeichen; ein Trennstrich am Zeilenende wird
	// nicht gesetzt (`zeichneText` trennt nach Wörtern).
	return eng(text);
}

/** Die Versammlung eröffnen, die Verwaltung am Einlass, die übrigen von Hand. */
async function saalAufbauen(versammlung) {
	await gehe(`/versammlungen/${versammlung}`);
	await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());

	// Am Einlass: die Verwaltung als dritte Person mit Papiervollmacht, das
	// Häkchen in derselben Maske (Handbuch, «Ohne Erklären: zwei Häkchen»;
	// M3). Vorab unter Vollmachten erfasst ginge es nicht: Die Maske am
	// Einlass sperrt die Partei dann mit «bereits bevollmächtigt an …», auch
	// bei gleichem Namen (Lauf 1, 08.11.2026; Bericht).
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	await seite.locator('details.dritte summary').click();
	const dritte = seite.locator('details.dritte form');
	await dritte.locator('input[name="bevollmaechtigtName"]').fill(VERWALTUNG);
	await dritte.locator('input[type="search"]').fill(BRUEGGER);
	const treffer = dritte.locator('input[name="vertritt"]');
	await warteAufTreffer(treffer, 1);
	await treffer.first().check();
	const haken = dritte.locator('input[name="istVerwaltung"]');
	behaupte(await haken.count(), 'Kein Häkchen «Bevollmächtigt ist die Verwaltung» am Einlass');
	await haken.check();
	await abschicken(dritte.locator('button[type="submit"]'));

	// Die übrigen zwei selbst; Brügger ist schon anwesend und hat keinen Knopf.
	for (let i = 0; i < 4; i++) {
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
		if (!(await knopf.count())) break;
		await abschicken(knopf.first());
	}
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const stand = await seitentext();
	behaupte(/3 von 3|3 Parteien/.test(stand), `Nicht alle drei anwesend: ${stand.slice(0, 300)}`);

	await gehe(`/versammlungen/${versammlung}/vollmachten`);
	const wirksam = seite.locator('article.vollmacht.wirksam', { hasText: VERWALTUNG });
	behaupte(await wirksam.count(), `Die Vollmacht der Verwaltung ist nicht wirksam: ${(await seitentext()).slice(0, 400)}`);
	const zeile = eng(await wirksam.first().innerText());
	behaupte(/Bestätigt/.test(zeile) && /· Verwaltung/.test(zeile), `Bestätigt mit Merkmal «Verwaltung» fehlt: ${zeile.slice(0, 300)}`);
	behaupte(zeile.includes(BRUEGGER), `Die Vollmacht gilt nicht für Brügger: ${zeile.slice(0, 300)}`);
}

/** Ein Traktandum aufrufen und den Text vor dem Eröffnen zurückgeben. */
async function rufeAuf(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const zeile = seite.locator('.baum li', { hasText: titel }).first();
	await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());
	return seitentext();
}

/**
 * Durchgang öffnen, Stimmen je Partei erfassen, Ankunft prüfen, schliessen.
 * `stimmen`: Name zu Wahl; die Sperrsätze und die Zahl der Zeilen kommen zurück.
 */
async function stimmeAb(stimmen, erwarteteZeilen) {
	await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
	await oeffneErfassung();
	const erfassen = seite.locator('form[action="?/erfassen"]').first();
	// Pflicht nur in der geführten Betriebsart; gefüllt schadet es nicht, und
	// leer hielte der Browser das Absenden dort still an (docs/proben.md,
	// 08.11.2026, lesarten-l6.mjs).
	await erfassen.locator('input[name="begruendung"]').fill('Prüflauf: im Saal von Hand abgestimmt.');
	const zeilen = await erfassen.locator('tbody tr').allInnerTexts();
	const sperren = eng((await erfassen.locator('p.ausgenommen').allInnerTexts()).join(' '));
	for (const [wer, wahl] of Object.entries(stimmen)) {
		await erfassen
			.locator('tr', { hasText: wer })
			.first()
			.locator(`input[type="radio"][value="${wahl}"]`)
			.first()
			.check();
	}
	await abschicken(erfassen.locator('button[type="submit"]').first());
	const n = Object.keys(stimmen).length;
	const erfasst = await seitentext();
	behaupte(
		new RegExp(`${n} von ${erwarteteZeilen} haben abgestimmt|Alle ${n} haben abgestimmt`).test(erfasst) &&
			n === erwarteteZeilen,
		`Die Erfassung kam nicht an: ${erfasst.match(/\d+ von \d+ haben abgestimmt|Alle \d+ haben abgestimmt/)?.[0] ?? erfasst.slice(0, 600)}`
	);
	await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
	return { zeilen: zeilen.map(eng), sperren };
}

/** Die Ergebniskarte eines Traktandums auf der Leitung. */
async function ergebnis(versammlung, titel) {
	await gehe(`/versammlungen/${versammlung}/leitung`);
	const karte = seite.locator('article.ergebnis', { hasText: titel }).first();
	behaupte(await karte.count(), `Keine Ergebniskarte zu «${titel}»`);
	return {
		satz: eng(await karte.locator('p.satz').innerText()),
		kasten: eng(await karte.innerText())
	};
}

/** Den Protokollentwurf erzeugen und als Text holen. */
async function protokollentwurf(versammlung) {
	await gehe(`/versammlungen/${versammlung}/protokoll`);
	await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
	return eng(await seite.locator('textarea[name="body"]').first().inputValue());
}

/**
 * Der Abschnitt des Protokolls zu einem Traktandum: vom Titel bis zum
 * nächsten, erst unter «Verhandlungen»; davor steht die Traktandenliste.
 */
function abschnitt(text, titel, folgende) {
	const anfang = text.indexOf(titel, Math.max(0, text.indexOf('## Verhandlungen')));
	if (anfang < 0) return '';
	const enden = folgende.map((f) => text.indexOf(f, anfang + titel.length)).filter((i) => i > 0);
	return text.slice(anfang, enden.length ? Math.min(...enden) : undefined);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L8, Vollmachten der Verwaltung: ${ZIEL}\n`);

try {
	let gemeinschaft;
	let v1;
	let v2;
	const NAME = `Prüflauf Lesart L8 ${LAUF}`;

	await schritt('Anmelden', async () => {
		await gehe('/anmelden');
		await seite.fill('input[name="username"]', BENUTZER);
		await seite.fill('input[name="kennwort"]', KENNWORT);
		await abschicken(seite.locator('main button[type="submit"]'));
		await seite
			.waitForURL((u) => !new URL(u).pathname.startsWith('/anmelden'), { timeout: 15000 })
			.catch(() => {});
		behaupte(!seite.url().includes('/anmelden'), 'Anmeldung fehlgeschlagen');
	});

	await schritt('Gemeinschaft mit drei Eigentümern', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft && gemeinschaft !== 'neu', `Nicht angelegt: ${seite.url()}`);

		for (const [i, wer] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill(QUOTEN[i]);
			await abschicken(ef.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const pf = seite.locator('form[action$="anlegen"]').first();
			await pf.locator('input[name="displayName"]').fill(wer);
			await abschicken(pf.locator('button[type="submit"]'));

			await gehe(`/gemeinschaften/${gemeinschaft}/eigentuemer`);
			const zf = seite.locator('form[action$="zuordnen"]').last();
			await waehleNachAnfang(zf.locator('select[name="unitId"]'), `Whg ${i + 1}`);
			await waehleNachAnfang(zf.locator('select[name="partyId"]'), wer);
			await abschicken(zf.locator('button[type="submit"]'));
		}
		return '400 + 300 + 300 von 1000';
	});

	await schritt('Die Seite nennt L8 mit Vorgabe «Vollmachten ruhen» und Fundstelle', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(text.includes(FRAGE_L8), `Die Frage zu L8 fehlt: ${text.slice(0, 600)}`);
		behaupte(text.includes('Vollmachten ruhen (Vorgabe)'), 'Die Vorgabe «Vollmachten ruhen» ist nicht gekennzeichnet');
		behaupte(text.includes('Die Sitzungsleitung entscheidet'), 'Die andere Wahl «Die Sitzungsleitung entscheidet» fehlt');
		behaupte(
			await seite.locator('input[name="L8"][value="ruhen"]').isChecked(),
			'Die Vorgabe «ruhen» ist nicht angekreuzt'
		);
		behaupte(
			text.includes('Wer selbst nicht stimmen darf, stimmt auch als Vertreter nicht (BGE 134 III 481 E. 3.6 und 3.8)') &&
				text.includes('(Art. 695 Abs. 1 OR; BGE 128 III 142 E. 3b)'),
			'Die Fundstelle der Vorgabe fehlt'
		);
		return 'Frage, Vorgabe, Fundstelle';
	});

	await schritt('Versammlung 1: das Häkchen an der Wiederwahl wird im Entwurf abgewiesen', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		v1 = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(v1 && v1 !== 'neu', `Nicht angelegt: ${seite.url()}`);

		const absage = await legeAn(v1, {
			titel: WIEDERWAHL,
			wortlaut: 'Die bisherige Verwaltung wird für zwei weitere Jahre gewählt.',
			erfordernis: 'k-bewirtschaftung-waehlen',
			haekchen: true
		});
		behaupte(absage.includes(ABSAGE_WAHL), `Die Absage an der Wahl fehlt: ${absage.slice(0, 900)}`);
		await gehe(`/versammlungen/${v1}/traktanden`);
		behaupte(
			(await seite.locator('li[data-traktandum]', { hasText: WIEDERWAHL }).count()) === 0,
			'Trotz Absage ist ein Traktandum «Wiederwahl» entstanden'
		);
		return 'Absage mit Satz, kein Traktandum';
	});

	await schritt('Versammlung 1: Entlastung mit Häkchen, Protokoll ohne, Freigabe sperrt das Häkchen (Punkt 7)', async () => {
		await legeAn(v1, {
			titel: ENTLASTUNG,
			wortlaut: 'Der Verwaltung wird für das Jahr 2026 Entlastung erteilt.',
			erfordernis: 'k-decharge',
			haekchen: true
		});
		await legeAn(v1, {
			titel: PROTOKOLL,
			wortlaut: 'Das Protokoll der letzten Versammlung wird genehmigt.',
			erfordernis: 'k-decharge',
			haekchen: false
		});
		await gehe(`/versammlungen/${v1}/traktanden`);
		const mitHaken = eng(await traktandumzeile(ENTLASTUNG).locator('button.titel').innerText());
		const ohneHaken = eng(await traktandumzeile(PROTOKOLL).locator('button.titel').innerText());
		behaupte(/Geschäft der Verwaltung/.test(mitHaken), `Die Entlastung trägt das Merkmal nicht: ${mitHaken}`);
		behaupte(!/Geschäft der Verwaltung/.test(ohneHaken), `Das Protokoll trägt das Merkmal: ${ohneHaken}`);

		await gehe(`/versammlungen/${v1}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);

		// Nach der Freigabe: kein Formular mehr, das das Häkchen trüge …
		await gehe(`/versammlungen/${v1}/traktanden`);
		behaupte(
			/Die Versammlung ist freigegeben — die Traktanden sind gesperrt\./.test(await seitentext()),
			'Der Satz zur Sperre fehlt auf der Traktandenseite'
		);
		const zeile = traktandumzeile(PROTOKOLL);
		const id = await zeile.getAttribute('data-traktandum');
		await zeile.locator('button.titel').click();
		await seite.waitForTimeout(400);
		behaupte(
			(await seite.locator('form[action="?/speichern"] input[name="verwaltungsGeschaeft"]').count()) === 0,
			'Nach der Freigabe steht das Häkchen noch in einem Formular'
		);
		// … und der Server nimmt es auch über das Formular von aussen nicht an.
		const antwort = await seite.request.post(`${ZIEL}/versammlungen/${v1}/traktanden?/speichern`, {
			headers: { origin: ZIEL, 'x-sveltekit-action': 'true' },
			form: {
				id,
				titel: PROTOKOLL,
				art: 'abstimmung',
				antragswortlaut: 'Das Protokoll der letzten Versammlung wird genehmigt.',
				antragstellerart: 'bewirtschaftung',
				verwaltungsGeschaeft: 'ja'
			}
		});
		const rueck = await antwort.text();
		behaupte(
			/in den Traktanden ändern/.test(rueck),
			`Der Server nahm das Häkchen nach der Freigabe an oder sagte anderes: ${rueck.slice(0, 400)}`
		);
		await gehe(`/versammlungen/${v1}/traktanden`);
		const danach = eng(await traktandumzeile(PROTOKOLL).locator('button.titel').innerText());
		behaupte(!/Geschäft der Verwaltung/.test(danach), `Das Protokoll trägt das Merkmal jetzt doch: ${danach}`);
		return 'Merkmal an der Entlastung, gesperrt ab Freigabe';
	});

	await schritt('Umstellen auf «Die Sitzungsleitung entscheidet»; Versammlung 1 bleibt auf «ruhen» (Kriterium 3)', async () => {
		await stelleUm(gemeinschaft, 'leitung');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');
		// Die Einladung von Versammlung 1, nach der Umstellung geholt: Sie trägt
		// den Satz unter «ruhen», genau einmal, an der Entlastung.
		const einladung = await einladungstext(v1, 'einladung-v1');
		const n = zaehle(einladung, EINLADUNG_RUHEN);
		behaupte(n === 1, `Der Satz zu den Vollmachten der Verwaltung steht ${n}-mal in der Einladung statt einmal`);
		// Zwischen dem Titel der Entlastung und dem nächsten Traktandum, dem
		// Protokoll; der Titel des Protokolls steht weiter oben ein zweites Mal.
		const vor = einladung.indexOf(EINLADUNG_RUHEN);
		const entlastung = einladung.lastIndexOf(ENTLASTUNG, vor);
		const protokoll = entlastung < 0 ? -1 : einladung.indexOf(PROTOKOLL, entlastung);
		behaupte(
			entlastung >= 0 && protokoll > vor,
			`Der Satz steht nicht unter der Entlastung (Entlastung ${entlastung}, Satz ${vor}, Protokoll ${protokoll})`
		);
		return 'Gemeinschaft auf «leitung»; Einladung 1 mit dem Satz unter «ruhen»';
	});

	await schritt('Versammlung 2 unter «leitung» freigeben', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-11-24');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		v2 = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(v2 && v2 !== 'neu' && v2 !== v1, `Nicht angelegt: ${seite.url()}`);
		await legeAn(v2, {
			titel: ENTLASTUNG,
			wortlaut: 'Der Verwaltung wird für das Jahr 2026 Entlastung erteilt.',
			erfordernis: 'k-decharge',
			haekchen: true
		});
		await legeAn(v2, {
			titel: ENTLASTUNG_VORJAHR,
			wortlaut: 'Der Verwaltung wird für das Jahr 2025 Entlastung erteilt.',
			erfordernis: 'k-decharge',
			haekchen: true
		});
		await gehe(`/versammlungen/${v2}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		return 'eingefroren «leitung»';
	});

	// Versammlung 1 läuft, während die Gemeinschaft auf «leitung» steht: Sie
	// rechnet trotzdem nach «ruhen», der Wahl bei ihrer Freigabe.
	await schritt('Versammlung 1 im Saal: Vollmacht der Verwaltung, bestätigt am Einlass', async () => {
		await saalAufbauen(v1);
		return 'Amsler, Caflisch selbst; Brügger über die Verwaltung';
	});

	await schritt('V1, Entlastung unter «ruhen»: die Stimme der Verwaltung zählt nicht (Kriterium 6)', async () => {
		const vorher = await rufeAuf(v1, ENTLASTUNG);
		behaupte(vorher.includes(LEITUNG_RUHEN), `Der Satz an die Leitung unter «ruhen» fehlt: ${vorher.slice(0, 1200)}`);
		// G7 (Auftrag Lauf 3): in der Ausstandsliste, hinter dem Namen der Zusatz.
		const liste = eng((await seite.locator('ul.ausstandsliste').allInnerTexts()).join(' '));
		behaupte(
			liste.includes(`${VERWALTUNG} (nach der Einstellung Ihrer Gemeinschaft)`),
			`Die Verwaltung steht nicht mit dem Zusatz in der Ausstandsliste: «${liste.slice(0, 600)}»`
		);
		const { zeilen, sperren } = await stimmeAb({ [AMSLER]: 'yes', [CAFLISCH]: 'no' }, 2);
		behaupte(
			!zeilen.some((z) => z.includes(BRUEGGER)),
			`Brügger steht in der Erfassung, obwohl seine Vollmacht ruht: ${zeilen.join(' | ')}`
		);
		behaupte(
			sperren.includes(`«${BRUEGGER}» ist über «${VERWALTUNG}» vertreten`) &&
				/ist bei diesem Traktandum im Ausstand/.test(sperren),
			`Der Satz zur ruhenden Vollmacht fehlt bei der Erfassung: ${sperren.slice(0, 600)}`
		);
		const { satz, kasten } = await ergebnis(v1, ENTLASTUNG);
		behaupte(satz.startsWith('Abgelehnt'), `Unter «ruhen» nicht abgelehnt: ${satz.slice(0, 400)}`);
		behaupte(/1 Ja von 2/.test(kasten), `Nicht 1 Ja von 2 Köpfen: ${kasten.slice(0, 900)}`);
		behaupte(kasten.includes(ZWEITES_RUHEN_OFFEN), `Die Grenzen («nicht bestimmbar») fehlen: ${kasten.slice(0, 2000)}`);
		behaupte(
			!kasten.includes('Das Ergebnis wäre dasselbe, gleich wie die Verwaltung damit gestimmt hätte'),
			'Die Karte sagt «dasselbe Ergebnis», obwohl die Grenzen auseinandergehen'
		);
		return 'abgelehnt 1 von 2; nach «leitung» nicht bestimmbar';
	});

	await schritt('V1, Protokoll ohne Häkchen: die Stimme der Verwaltung zählt', async () => {
		const vorher = await rufeAuf(v1, PROTOKOLL);
		behaupte(!vorher.includes(LEITUNG_RUHEN), 'Der Satz unter «ruhen» steht auch am Traktandum ohne Häkchen');
		const { zeilen } = await stimmeAb({ [AMSLER]: 'yes', [BRUEGGER]: 'yes', [CAFLISCH]: 'no' }, 3);
		behaupte(zeilen.some((z) => z.includes(BRUEGGER)), 'Brügger fehlt in der Erfassung ohne Häkchen');
		const { satz, kasten } = await ergebnis(v1, PROTOKOLL);
		behaupte(satz.startsWith('Angenommen'), `Ohne Häkchen nicht angenommen: ${satz.slice(0, 400)}`);
		behaupte(/2 Ja von 3/.test(kasten), `Nicht 2 Ja von 3 Köpfen: ${kasten.slice(0, 900)}`);
		behaupte(
			!/ruhende Vollmacht der Verwaltung|Nach der anderen Lesart \(«Die Sitzungsleitung entscheidet»/.test(kasten),
			`Ohne Häkchen steht ein zweites Ergebnis zu L8: ${kasten.slice(0, 900)}`
		);
		return 'angenommen 2 von 3, kein zweites Ergebnis';
	});

	await schritt('V1, Protokoll der Versammlung: nur die Tatsache (Punkt 3)', async () => {
		const entwurf = await protokollentwurf(v1);
		await writeFile(`${AUFNAHMEN}/protokoll-v1.txt`, entwurf);
		const n = zaehle(entwurf, PROTOKOLL_RUHEN);
		behaupte(n === 1, `Die Tatsachenzeile steht ${n}-mal im Protokoll statt einmal: ${entwurf.slice(0, 2500)}`);
		const teil = abschnitt(entwurf, ENTLASTUNG, [PROTOKOLL]);
		behaupte(teil.includes(PROTOKOLL_RUHEN), `Die Tatsachenzeile steht nicht bei der Entlastung: ${teil.slice(0, 1500)}`);
		behaupte(
			!entwurf.includes('Nach der anderen Lesart («Die Sitzungsleitung entscheidet»)'),
			'Das Protokoll trägt ein zweites Ergebnis unter «ruhen»'
		);
		behaupte(!/anfechten/.test(teil), `Das Protokoll trägt bei der Entlastung einen Rechtsrat: ${teil.slice(0, 1500)}`);
		return 'Tatsachenzeile, kein zweites Ergebnis, kein Rat';
	});

	await schritt('Zurück auf die Vorgabe; Versammlung 2 bleibt auf «leitung» (Kriterium 3)', async () => {
		await stelleUm(gemeinschaft, 'ruhen');
		// Eingefroren auf «leitung»: Die Einladung nennt den Satz unter «ruhen»
		// nicht, obwohl die Gemeinschaft jetzt darauf steht, und trägt je
		// Entlastung mit Häkchen den Satz unter «leitung» (G7).
		const einladung = await einladungstext(v2, 'einladung-v2');
		behaupte(
			einladung.includes(ENTLASTUNG) && !einladung.includes(EINLADUNG_RUHEN),
			'Die Einladung von Versammlung 2 trägt den Satz unter «ruhen», obwohl sie unter «leitung» freigegeben ist'
		);
		const n = zaehle(einladung, EINLADUNG_LEITUNG);
		behaupte(n === 2, `Der Satz unter «leitung» steht ${n}-mal in der Einladung statt zweimal (zwei Entlastungen mit Häkchen)`);
		return 'Gemeinschaft auf «ruhen», Einladung 2 mit dem Satz unter «leitung», zweimal';
	});

	await schritt('Versammlung 2 im Saal, eingefroren «leitung» bei Gemeinschaft auf «ruhen»', async () => {
		await saalAufbauen(v2);
		return 'derselbe Aufbau';
	});

	await schritt('V2, Entlastung unter «leitung»: die Stimme zählt, Ergebnis nach der Vorgabe dazu (Kriterien 3, 7)', async () => {
		const vorher = await rufeAuf(v2, ENTLASTUNG);
		behaupte(vorher.includes(LEITUNG_LEITUNG), `Der Satz an die Leitung unter «leitung» fehlt: ${vorher.slice(0, 1200)}`);
		behaupte(!vorher.includes(LEITUNG_RUHEN), 'Der Satz unter «ruhen» steht, obwohl «leitung» eingefroren ist');
		const liste = eng((await seite.locator('ul.ausstandsliste').allInnerTexts()).join(' '));
		behaupte(!liste.includes(VERWALTUNG), `Unter «leitung» steht die Verwaltung ohne Erklärung im Ausstand: «${liste}»`);
		const { zeilen } = await stimmeAb({ [AMSLER]: 'yes', [BRUEGGER]: 'yes', [CAFLISCH]: 'no' }, 3);
		behaupte(zeilen.some((z) => z.includes(BRUEGGER)), 'Brügger fehlt in der Erfassung unter «leitung»');
		const { satz, kasten } = await ergebnis(v2, ENTLASTUNG);
		behaupte(satz.startsWith('Angenommen'), `Unter «leitung» nicht angenommen: ${satz.slice(0, 400)}`);
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Die Sitzungsleitung entscheidet»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Vollmachten ruhen»: .*?\) wäre er abgelehnt: 1 Ja von 2 Kopfstimmen, nötig 2\./.test(kasten),
			`Das Ergebnis nach der Vorgabe fehlt: ${kasten.slice(0, 2000)}`
		);
		return 'angenommen 2 von 3; nach «ruhen» abgelehnt 1 von 2';
	});

	await schritt('V2, Entlastung des Vorjahres mit Summen: Grenzen nicht bestimmbar (Punkt 2, H1)', async () => {
		await rufeAuf(v2, ENTLASTUNG_VORJAHR);
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		const summen = seite.locator('form[action="?/summen"]').first();
		behaupte(await summen.count(), `Kein Formular für Summen: ${(await seitentext()).slice(0, 600)}`);
		await summen.locator('input[name="ja"]').fill('2');
		await summen.locator('input[name="nein"]').fill('1');
		await summen.locator('input[name="enthaltung"]').fill('0');
		const vermerk = summen.locator('input[name="vermerk"]');
		if (await vermerk.count()) await vermerk.fill('Prüflauf: Handzeichen, gezählt von der Sitzungsleitung');
		await abschicken(summen.locator('button[type="submit"][data-vorgabe="Summen erfassen"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		const { satz, kasten } = await ergebnis(v2, ENTLASTUNG_VORJAHR);
		behaupte(satz.startsWith('Angenommen'), `Mit Summen nicht angenommen: ${satz.slice(0, 400)}`);
		behaupte(
			kasten.includes(`Nach der anderen Lesart («Vollmachten ruhen»:`) &&
				kasten.includes(SUMMEN_GRUND) &&
				kasten.includes(SUMMEN_RAT),
			`Das zweite Ergebnis mit Summen fehlt oder lautet anders: ${kasten.slice(0, 2000)}`
		);
		return 'angenommen 2 von 3; nach «ruhen» nicht bestimmbar';
	});

	await schritt('V2, Protokoll nennt das Ergebnis nach der Vorgabe (Kriterium 7, Punkt 1)', async () => {
		const entwurf = await protokollentwurf(v2);
		await writeFile(`${AUFNAHMEN}/protokoll-v2.txt`, entwurf);
		behaupte(
			entwurf.includes('Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 1 Ja von 2 Kopfstimmen, nötig 2.'),
			`Das Ergebnis nach der Vorgabe fehlt im Protokoll: ${entwurf.slice(0, 2500)}`
		);
		behaupte(
			entwurf.includes(`Nach der anderen Lesart («Vollmachten ruhen») ${SUMMEN_GRUND}`),
			`Der Satz zu den Summen fehlt im Protokoll: ${entwurf.slice(0, 2500)}`
		);
		behaupte(
			!entwurf.includes('Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft'),
			'Unter «leitung» steht die Tatsachenzeile zum Ruhen im Protokoll'
		);
		return 'abweichendes Ergebnis und Summensatz';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await seite.screenshot({ path: `${AUFNAHMEN}/zuletzt.png`, fullPage: true }).catch(() => {});
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün. Aufnahmen in ${AUFNAHMEN}`);
