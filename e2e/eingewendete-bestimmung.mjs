/**
 * Durchstich: Beschluss von Hand mit dem Grund «Eingewendete Bestimmung»
 * (Entscheid 0046, A7; Fassung 2026-11-11, Auftrag E2).
 *
 * **Der Weg.** Eine Gemeinschaft mit vier Eigentümern zu je 250 Wertquoten.
 * Das Traktandum «Fassadensanierung» bekommt über den Entscheidbaum das Mehr
 * der Karte «Notwendige bauliche Massnahme» (`k-baulich-notwendig`, einfaches
 * Mehr); ihr Abschnitt «Wird im Saal eine Bestimmung eingewendet» sagt ab dieser Fassung, wie die
 * Leitung eine im Saal eingewendete strengere Bestimmung einhält
 * (`einwandImSaal`). Im Saal stimmen drei Ja und einer Nein: Nach dem Gesetz
 * ist der Antrag angenommen. Dann hält die Leitung über «Beschluss von Hand
 * festhalten» mit dem Grund «Eingewendete Bestimmung» fest, dass er nach der
 * eingewendeten Bestimmung abgelehnt ist. Die Maske zeigt dann nicht die
 * Warnung des Notwegs, sondern den eigenen Hinweis, und kein Auswahlfeld für
 * das Ergebnis. Leitung, Protokollentwurf und Verlauf zeigen das Ergebnis; das
 * Protokoll nennt die Bestimmung und nicht den Weg. Am Ende die Gegenprobe am
 * Server: ohne Bestimmung und mit «Angenommen» je eine Absage, kein Eintrag.
 *
 * Kriterien aus dem Auftrag E2 (`.auftraege/2026-11-11-votum-e2-kriterien.md`):
 * 1, 2, 4, 7 und 12; der Schritt zum Verlauf berührt dazu Kriterium 3, aber
 * nur das Verlaufsereignis, nicht die Festschreibung des Durchgangs.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»): Der Dev-Stapel hat das
 * Hauptverzeichnis eingehängt, nicht den Worktree.
 *
 *     node e2e/eingewendete-bestimmung.mjs
 *
 * Die Namen beginnen mit «Prüflauf»; `scripts/testdaten-entfernen.sql` nimmt
 * sie mit.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-eingewendete-bestimmung';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Fassadensanierung';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Dubach'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['250', '250', '250', '250'];

/**
 * Der Weg im Baum zur Karte «Notwendige bauliche Massnahme»: Ast `a-bauen`,
 * «keine kleine Reparatur», «erhält Wert oder Gebrauchsfähigkeit»
 * (src/lib/rules/quorum-2026-07-30.ts, Fragen f1-0 und f1-1).
 */
const BAUM = 'ast=a-bauen&p=f1-0-nein,f1-1-ja';

/** Was die Leitung als eingewendete Bestimmung einträgt. */
// Vier Fünftel: Drei Ja von vier erreichen das Gesetz, aber nicht sie.
const BESTIMMUNG = 'Reglement Art. 14: vier Fünftel aller Eigentümer (Prüflauf)';
const EINFUEHRUNG = 'Beilage zum Begründungsakt, seither nicht geändert (Prüflauf)';
/** Der Hinweis vor der Maske (`VON_HAND_EINWAND_ZEIGER`), sein Anfang. */
const ZEIGER = 'Wird eine Bestimmung des Reglements eingewendet, die nicht hinterlegt ist';

/** Drei Stellen aus `einwandImSaal` (src/lib/domain/entscheidbaum.ts), ab Fassung 2026-11-11. */
const KASTEN_EINHALTEN = 'Halten Sie sie nur ein, wenn drei Dinge feststehen.';
const KASTEN_KNOPF = 'Beschluss von Hand festhalten';
const KASTEN_GRUND = 'Eingewendete Bestimmung';

/** Der Anfang von `VON_HAND_NOTWEG_WARNUNG` und von `VON_HAND_EINWAND_EINLEITUNG` (src/lib/domain/vonhand.ts). */
const NOTWEG_WARNUNG = 'Das ist der Notweg, nicht der gewöhnliche Ablauf';
const EINWAND_HINWEIS = 'Wählen Sie diesen Grund nur, wenn drei Dinge feststehen.';

/** Die Quittung `VON_HAND_FESTGEHALTEN_EINWAND`, ihr Anfang. */
const QUITTUNG = 'Der Antrag ist als abgelehnt festgehalten';

/** Die zwei Absagen des Kerns (`VON_HAND_EINWAND_FEHLT`, `VON_HAND_EINWAND_NUR_ABLEHNUNG`). */
const ABSAGE_OHNE = 'Tragen Sie die eingewendete Bestimmung';
const ABSAGE_ANGENOMMEN = 'halten Sie nur';

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function waehleNachAnfang(auswahl, anfang) {
	const werte = await auswahl.locator('option').evaluateAll((os) =>
		os.map((o) => ({ wert: o.value, text: (o.textContent ?? '').trim() }))
	);
	const treffer = werte.find((o) => o.text.startsWith(anfang) && o.wert);
	behaupte(treffer, `Kein Eintrag beginnt mit «${anfang}»`);
	await auswahl.selectOption(treffer.wert);
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
	return `${haupt} ${quittungen}`.replace(/\s+/g, ' ');
}

const sauber = (t) => (t ?? '').replace(/\s+/g, ' ');

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

/** Wie viele Einträge «Beschluss von Hand festgehalten» der Verlauf der Versammlung trägt. */
async function vonHandImVerlauf() {
	await gehe(`/verlauf?versammlung=${versammlung}`);
	return seite.locator('tr:has-text("Beschluss von Hand festgehalten")');
}

/**
 * Ein Formular-POST an `?/beschlussVonHand` aus der Seite heraus, an der Maske
 * vorbei (Muster `e2e/beschluss-von-hand-am-abend.mjs`, Schritt 1). Die Maske
 * selbst lässt ein leeres Pflichtfeld über `required` gar nicht abschicken;
 * geprüft wird hier die Schranke des Kerns dahinter.
 */
async function postVonHand(felder) {
	return seite.evaluate(
		async ({ ziel, felder }) => {
			const fd = new FormData();
			for (const [k, v] of felder) fd.append(k, v);
			const r = await fetch(ziel, {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
			});
			const rohtext = await r.text();
			let rumpf = null;
			try {
				rumpf = JSON.parse(rohtext);
			} catch {
				// Unlesbarer Rumpf bleibt `null`; die Behauptung nennt dann den rohen Text.
			}
			// Der äussere Status ist 200; die Absage steht im Rumpf (`type: failure`).
			return {
				typ: rumpf?.type ?? null,
				statusImRumpf: typeof rumpf?.status === 'number' ? rumpf.status : null,
				rohtext
			};
		},
		{ ziel: `${ZIEL}/versammlungen/${versammlung}/leitung?/beschlussVonHand`, felder }
	);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nBeschluss von Hand, eingewendete Bestimmung: ${ZIEL}\n`);

let versammlung;
let traktandum;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Eingewendete Bestimmung ${LAUF}`;

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

	await schritt('Gemeinschaft mit vier Wohnungen zu je 250', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

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
		return '4 × 250 von 1000';
	});

	await schritt('Versammlung mit «Fassadensanierung»', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-17');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		// Ohne Erfordernis aufnehmen («später bestimmen»): Das Mehr kommt im
		// nächsten Schritt über den Baum, wie es die Leitung täte.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill(TITEL);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Fassade wird saniert, mit einem Kostendach von 120 000 Franken zulasten des Erneuerungsfonds.');
		await abschicken(tf.locator('button[type="submit"]').first());

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		traktandum = await seite
			.locator('li[data-traktandum]', { hasText: TITEL })
			.first()
			.getAttribute('data-traktandum');
		behaupte(traktandum, `«${TITEL}» steht nicht in der Traktandenliste`);
		return traktandum.slice(0, 8);
	});

	await schritt('Mehr über den Baum; der Kasten nennt den Weg der eingewendeten Bestimmung (Kriterium 7)', async () => {
		await gehe(`/versammlungen/${versammlung}/traktanden/${traktandum}/erfordernis?${BAUM}`);
		const karte = seite.locator('article.karte').first();
		behaupte(await karte.count(), 'Am Ende des Baums steht keine Karte');
		const titel = sauber(await karte.locator('h2').first().innerText());
		behaupte(
			titel.includes('Notwendige bauliche Massnahme'),
			`Der Baum endet nicht bei «Notwendige bauliche Massnahme», sondern bei «${titel}»`
		);
		// Ab 2026-11-11 ein eigener Abschnitt unter dem «Reglementsvorbehalt» (Laienprüfung E2, L-1).
		const kasten = karte.locator('.block:has(h3:text-is("Reglementsvorbehalt"))').first();
		behaupte(await kasten.count(), 'Der Kasten «Reglementsvorbehalt» fehlt an der Karte');
		const vorbehalt = sauber(await kasten.innerText());
		behaupte(
			vorbehalt.includes('steht im Abschnitt «Wird im Saal eine Bestimmung eingewendet»'),
			`Der Vorbehalt verweist nicht auf den Abschnitt: ${vorbehalt.slice(0, 1500)}`
		);
		// Kriterium 8: die Einführung, die sich nicht feststellen lässt.
		behaupte(
			vorbehalt.includes('deren Einführung sich nicht feststellen lässt'),
			`Der Vorbehalt nennt die unklare Einführung nicht: ${vorbehalt.slice(0, 1500)}`
		);
		const abschnitt = karte.locator('.block:has(h3:text-is("Wird im Saal eine Bestimmung eingewendet"))').first();
		behaupte(await abschnitt.count(), 'Der Abschnitt «Wird im Saal eine Bestimmung eingewendet» fehlt');
		const text = `${vorbehalt} ${sauber(await abschnitt.innerText())}`;
		for (const stelle of [KASTEN_EINHALTEN, KASTEN_KNOPF, KASTEN_GRUND]) {
			behaupte(
				text.includes(stelle),
				`Der Kasten nennt «${stelle}» nicht (Fassung vor 2026-11-11?): ${text.slice(0, 1500)}`
			);
		}
		// Die alte Anweisung gilt ab dieser Fassung nicht mehr.
		behaupte(
			!text.includes('zählen Sie nach dem Gesetz und halten den Einwand im Protokoll fest.'),
			`Der Kasten trägt noch den Satz der Vorfassung: ${text.slice(0, 1500)}`
		);
		// Kein Weg «nicht abstimmen» (Kriterium 7; R7-F-1 am Kommentar zu `einwandImSaal`).
		behaupte(
			!/heute nicht darüber ab/.test(text),
			`Der Kasten rät, nicht abzustimmen: ${text.slice(0, 1500)}`
		);

		await abschicken(seite.locator('form[action="?/uebernehmen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const zeile = sauber(
			await seite.locator(`li[data-traktandum="${traktandum}"]`).first().innerText()
		);
		behaupte(
			zeile.includes('Notwendige bauliche Massnahme') && !/kein Mehrheitserfordernis/i.test(zeile),
			`Das Mehr der Karte steht nicht am Traktandum: ${zeile.slice(0, 400)}`
		);
		return 'übernommen';
	});

	await schritt('Freigeben', async () => {
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
	});

	await schritt('Im Saal: drei Ja, ein Nein; nach dem Gesetz angenommen', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'yes'],
			['Christen', 'yes'],
			['Dubach', 'no']
		]) {
			await seite
				.locator('tr', { hasText: wer })
				.first()
				.locator(`input[type="radio"][value="${wahl}"]`)
				.first()
				.check();
		}
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).first();
		const satz = sauber(await karte.locator('p.satz').innerText());
		behaupte(satz.startsWith('Angenommen'), `Nach dem Gesetz nicht angenommen: ${satz.slice(0, 400)}`);
		return satz.slice(0, 80);
	});

	await schritt('Maske mit dem Grund «Eingewendete Bestimmung» festhalten (Kriterien 1, 2)', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const kasten = seite.locator('details.vonhand').first();
		behaupte(await kasten.count(), 'Die Maske «Beschluss von Hand festhalten» fehlt am aufgerufenen Traktandum');
		// Der Hinweis vor der Maske, sichtbar ohne sie zu öffnen (Laienprüfung E2, R2-L-2).
		behaupte(
			(await seite.locator('p.zeiger', { hasText: ZEIGER }).count()) === 1,
			'Vor der Maske fehlt der Hinweis auf die eingewendete Bestimmung'
		);
		await kasten.locator('summary').click();
		const formular = kasten.locator('form[action="?/beschlussVonHand"]');
		await formular.waitFor({ state: 'visible', timeout: 8000 });

		// Kriterium 1: Der Grund ist da und steht auf dem bisherigen Weg.
		const grund = kasten.locator('select[name="grund"]');
		behaupte(await grund.count(), 'Die Maske fragt nicht nach dem Grund (kein `select[name="grund"]`)');
		behaupte(
			(await grund.inputValue()) === 'notweg',
			`Vorgewählt ist nicht der Notweg, sondern «${await grund.inputValue()}»`
		);
		// Die Gegenprobe zur Probe unten: Vor der Wahl steht die Warnung, sonst
		// prüfte ihr Fehlen nach der Wahl nichts.
		behaupte(
			sauber(await kasten.innerText()).includes(NOTWEG_WARNUNG),
			'Schon vor der Wahl steht die Warnung des Notwegs nicht'
		);

		await grund.selectOption('eingewendete_bestimmung');
		const einwand = formular.locator('textarea[name="einwand"]');
		await einwand.waitFor({ state: 'visible', timeout: 8000 });

		const text = sauber(await kasten.innerText());
		behaupte(!text.includes(NOTWEG_WARNUNG), `Mit diesem Grund steht die Warnung des Notwegs: ${text.slice(0, 600)}`);
		behaupte(text.includes(EINWAND_HINWEIS), `Der Hinweis zur eingewendeten Bestimmung fehlt: ${text.slice(0, 600)}`);
		behaupte(
			(await formular.locator('select[name="ergebnis"]').count()) === 0,
			'Mit diesem Grund steht trotzdem das Auswahlfeld «Ergebnis»'
		);
		behaupte(
			(await formular.locator('input[type="hidden"][name="ergebnis"]').inputValue()) === 'abgelehnt',
			'Das verborgene Ergebnis ist nicht «abgelehnt»'
		);
		// Kriterium 2, in der Maske: Das Feld ist Pflicht; der Kern dahinter wird
		// im letzten Schritt geprüft.
		behaupte(
			(await einwand.getAttribute('required')) !== null,
			'Das Feld für die eingewendete Bestimmung ist kein Pflichtfeld'
		);
		await kasten.screenshot({ path: `${AUFNAHMEN}/maske-einwand.png` }).catch(() => {});

		await einwand.fill(BESTIMMUNG);
		await formular.locator('textarea[name="einfuehrung"]').fill(EINFUEHRUNG);
		await formular.locator('input[name="koepfe_ja"]').fill('3');
		await formular.locator('input[name="koepfe_nein"]').fill('1');
		await formular.locator('input[name="koepfe_enthaltung"]').fill('0');
		// Die Rückfrage bestätigt der Beobachter (`rueckfragenBestaetigen`).
		await abschicken(formular.locator('button[type="submit"]').first());

		// Die eigene Quittung kommt nur, wenn `grund` über das `form`-Attribut
		// mitgeschickt wurde: Das Auswahlfeld steht ausserhalb des Formulars.
		const nachher = await seitentext();
		behaupte(nachher.includes(QUITTUNG), `Die Quittung «${QUITTUNG}» fehlt: ${nachher.slice(0, 800)}`);
		return 'festgehalten';
	});

	await schritt('An der Leitung abgelehnt', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const karte = seite.locator('article.ergebnis', { hasText: TITEL }).first();
		const satz = sauber(await karte.locator('p.satz').innerText());
		behaupte(satz.startsWith('Abgelehnt'), `Die Leitung zeigt nicht «Abgelehnt»: ${satz.slice(0, 400)}`);
		behaupte(
			!/\bangenommen\b/.test((await karte.getAttribute('class')) ?? ''),
			'Die Ergebniskarte trägt noch die Marke «angenommen»'
		);
		return satz.slice(0, 80);
	});

	await schritt('Das Protokoll nennt die Bestimmung und nicht den Weg (Kriterium 4)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		// Den Entwurf gibt es nur einmal zu erzeugen; danach steht er im Feld.
		const erzeugen = seite.locator('form[action="?/entwurf"] button[type="submit"]');
		if (await erzeugen.count()) await abschicken(erzeugen.first());
		const entwurf = sauber(await seite.locator('textarea[name="body"]').first().inputValue());
		// Nur der Abschnitt des Traktandums (Muster `durchspielen.mjs`, Schritt
		// «Beschluss von Hand»): Die Vorlage trägt weitere Traktanden.
		const abschnitt =
			new RegExp(`#{3,6} \\d+(?:\\.\\d+)* ${TITEL} (.*?)(?= #{2,6} |$)`).exec(entwurf)?.[1] ?? '';
		behaupte(abschnitt.length > 0, `Der Protokollentwurf kennt «${TITEL}» nicht: ${entwurf.slice(0, 600)}`);
		behaupte(/Abgelehnt\./.test(abschnitt), `Der Abschnitt zeigt «Abgelehnt.» nicht: ${abschnitt.slice(0, 800)}`);
		behaupte(
			abschnitt.includes(`Eingewendet wurde diese Bestimmung: «${BESTIMMUNG}»`),
			`Die Bestimmung fehlt im Protokoll: ${abschnitt.slice(0, 1200)}`
		);
		behaupte(
			abschnitt.includes(`Eingeführt nach Angabe der Sitzungsleitung: ${EINFUEHRUNG}.`),
			`Die Einführung fehlt im Protokoll: ${abschnitt.slice(0, 1200)}`
		);
		behaupte(
			abschnitt.includes('Nach dem Gesetz hätte der Antrag das nötige Mehr erreicht'),
			`Das Ergebnis nach dem Gesetz fehlt im Protokoll: ${abschnitt.slice(0, 1200)}`
		);
		// Ohne Rücksicht auf Gross- und Kleinschreibung wie in `durchspielen.mjs`:
		// Auch «Von Hand gezählt» verriete den Weg.
		const verraeter = /von Hand|Notweg|übergangen/i.exec(abschnitt);
		behaupte(!verraeter, `Der Abschnitt verrät den Weg («${verraeter?.[0]}»): ${abschnitt.slice(0, 1200)}`);
		return 'Bestimmung und Gesetz, ohne Weg';
	});

	let eintraege = 0;
	await schritt('Der Verlauf nennt Grund und Bestimmung (Kriterium 3, Ereignis)', async () => {
		const zeilen = await vonHandImVerlauf();
		eintraege = await zeilen.count();
		behaupte(eintraege === 1, `Der Verlauf trägt ${eintraege} statt einem Eintrag «Beschluss von Hand festgehalten»`);
		const angaben = sauber(await zeilen.first().innerText());
		behaupte(
			angaben.includes(`Eingewendete Bestimmung: ${BESTIMMUNG}`),
			`Die Bestimmung fehlt im Verlaufseintrag: ${angaben.slice(0, 800)}`
		);
		behaupte(/Ergebnis: abgelehnt/.test(angaben), `Das Ergebnis fehlt im Verlaufseintrag: ${angaben.slice(0, 800)}`);
		return 'ein Eintrag';
	});

	await schritt('Gegenprobe am Kern: ohne Bestimmung und mit «Angenommen» abgewiesen (Kriterium 2)', async () => {
		// Die Leitungsseite als Ausgangspunkt: Der POST geht von ihrem Ursprung aus.
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const gemeinsam = [
			['traktandum', traktandum],
			['grund', 'eingewendete_bestimmung'],
			['erfassung', 'summen'],
			['koepfe_ja', '3'],
			['koepfe_nein', '1'],
			['koepfe_enthaltung', '0'],
			['begruendung', ''],
			['einfuehrung', EINFUEHRUNG]
		];

		const ohne = await postVonHand([...gemeinsam, ['ergebnis', 'abgelehnt']]);
		behaupte(
			ohne.typ === 'failure' && ohne.statusImRumpf === 400,
			`Ohne Bestimmung kam keine Absage: ${ohne.rohtext.slice(0, 300)}`
		);
		behaupte(ohne.rohtext.includes(ABSAGE_OHNE), `Die Absage nennt das fehlende Feld nicht: ${ohne.rohtext.slice(0, 300)}`);

		const angenommen = await postVonHand([
			...gemeinsam,
			['ergebnis', 'angenommen'],
			['einwand', BESTIMMUNG]
		]);
		behaupte(
			angenommen.typ === 'failure' && angenommen.statusImRumpf === 400,
			`Mit «Angenommen» kam keine Absage: ${angenommen.rohtext.slice(0, 300)}`
		);
		behaupte(
			angenommen.rohtext.includes(ABSAGE_ANGENOMMEN),
			`Die Absage nennt «nur Abgelehnt» nicht: ${angenommen.rohtext.slice(0, 300)}`
		);

		const nachher = await (await vonHandImVerlauf()).count();
		behaupte(nachher === eintraege, `Trotz der Absagen stehen ${nachher} statt ${eintraege} Einträge im Verlauf`);
		return 'zwei Absagen, kein neuer Eintrag';
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
