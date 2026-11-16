/**
 * Durchstich: Lesart L10, Angehörige des Beklagten im Ausstand an der
 * Ermächtigung zur Ausschlussklage (Migration 189, Fassung 2026-11-10,
 * Entscheid 0044 zweiter Nachtrag R1 (b)).
 *
 * **Der Weg.** Eine Gemeinschaft mit fünf Eigentümern zu je 200 von 1000. Der
 * letzte ist der Beklagte und bleibt der Versammlung fern; der vierte ist seine
 * Ehefrau mit eigener Wohnung, ist da und tritt im Saal in den Ausstand. Die
 * Verwaltung stellt L10 auf «Fallen aus der Zahl»; die Seite kennzeichnet die
 * Vorgabe «Bleiben in der Zahl» und zeigt unter der milden Wahl die Folge. Ein
 * Traktandum zur Ausschlussklage bekommt sein Mehr nach der Umstellung, der
 * Beklagte wird im Formular angekreuzt, die Versammlung wird freigegeben. Im
 * Saal stimmen zwei der drei übrigen Ja und einer Nein: Mit der Angehörigen in
 * der Zahl wären drei Ja von vier nötig, ohne sie genügen zwei von drei. Nach
 * der eingestellten Wahl ist der Antrag angenommen; Leitung und Protokoll
 * nennen das Ergebnis mit ihr in der Zahl. Vor der Abstimmung stehen der Satz
 * zu L10 und der Hinweis an die Leitung, der unter «Fallen aus der Zahl» nicht
 * mehr rät, von Hand zu zählen. Am Ende stellt die Verwaltung zurück.
 *
 * Kriterien aus dem Auftrag E1, Block D: 1, 3, 4, 5 und 6.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l10.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l10';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Ermächtigung zur Ausschlussklage';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Dorn', 'Eger'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['200', '200', '200', '200', '200'];

/** Die Folge der milden Wahl (Katalog, L10): nur unter «Fallen aus der Zahl». */
const FOLGE =
	'Wird eine Ermächtigung, die die Mehrheit nur ohne die Angehörigen erreicht, nicht innert der Frist ' +
	'angefochten, gilt sie in der Regel';

/** W12, der Hinweis 9 der Karte: die Gemeinschaft stellt die Zahl ein. */
const W12 =
	'Ob sie in der Zahl bleiben, an der die Mehrheit gemessen wird, stellt Ihre Gemeinschaft auf der Seite ' +
	'«Lesarten» ein.';

/** W11, der Satz vor der Abstimmung: die Seite «Lesarten» und das zweite Ergebnis. */
const W11 =
	'Ob die Angehörigen im Ausstand in der Zahl aller Eigentümer bleiben, stellt Ihre Gemeinschaft auf der ' +
	'Seite «Lesarten» ein. Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Wahl.';

/** W13, der Schluss des Hinweises an die Leitung unter «Fallen aus der Zahl». */
const W13 =
	'Sind solche Angehörige im Ausstand, nennt die Anwendung nach der Auszählung auch das Ergebnis mit ' +
	'ihnen in der Zahl.';

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

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

/**
 * Der Text der Karte auf der Erfordernisseite des Traktandums: Begründung und
 * Hinweise zeigt die Traktandenseite nicht, nur den Kartensatz (Durchstich
 * gegen Dev, 10.11.2026).
 */
async function kartentext() {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const id = await seite.locator('li[data-traktandum]', { hasText: TITEL }).first().getAttribute('data-traktandum');
	behaupte(id, `Das Traktandum «${TITEL}» steht nicht in der Liste`);
	// Über den Weg im Baum: Ast `a-sonderfaelle`, Antwort `f8-1-ausschluss`
	// (src/lib/rules/quorum-2026-07-30.ts; Muster e2e/lesarten-1a-a.mjs).
	await gehe(`/versammlungen/${versammlung}/traktanden/${id}/erfordernis?ast=a-sonderfaelle&p=f8-1-ausschluss`);
	return ((await seite.locator('main').innerText()) ?? '').replace(/\s+/g, ' ');
}

/** Auf der Seite der Lesarten L10 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L10"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

/** Eine Partei als anwesend erfassen, über ihre Zeile in der Liste. */
async function erfasseAnwesend(wer) {
	await gehe(`/versammlungen/${versammlung}/anwesenheit`);
	const zeile = seite.locator('tr', { hasText: wer }).first();
	behaupte(await zeile.count(), `Die Zeile von «${wer}» fehlt in der Anwesenheitsliste`);
	await abschicken(
		zeile.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])').first()
	);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L10, Angehörige im Ausstand an der Ausschlussklage: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Lesart L10 ${LAUF}`;

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

	await schritt('Gemeinschaft mit fünf Wohnungen zu je 200', async () => {
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
		return 'fünfmal 200 von 1000';
	});

	await schritt('Die Seite nennt L10 mit Vorgabe und Folge; Umstellen mit Verlauf (Kriterien 1, 2)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(
			/Bleiben Angehörige des Beklagten mit eigener Wohnung, die im Ausstand sind, in der Zahl/.test(text),
			`Die Frage zu L10 fehlt: ${text.slice(0, 600)}`
		);
		behaupte(
			await seite.locator('input[name="L10"][value="bleiben"]').isChecked(),
			'Die Vorgabe «Bleiben in der Zahl» ist nicht angekreuzt'
		);
		behaupte(/Bleiben in der Zahl \(Vorgabe\)/.test(text), 'Die Vorgabe ist nicht gekennzeichnet');
		behaupte(/Fallen aus der Zahl/.test(text), 'Die andere Wahl fehlt');
		behaupte(
			/Wortlaut von ZGB Art\. 649b Abs\. 2/.test(text),
			'Die Fundstelle der Vorgabe fehlt (Kriterium 8)'
		);
		// Die Folge steht unter der milden Wahl, nicht unter der Vorgabe.
		behaupte(
			text.includes(FOLGE),
			`Die Folge der milden Wahl fehlt auf der Seite «Lesarten»: ${text.slice(0, 1200)}`
		);
		await stelleUm(gemeinschaft, 'fallen_heraus');
		behaupte(
			/Zuletzt geändert von .* am /.test(await seitentext()),
			'Der Stand «zuletzt geändert» fehlt'
		);
		return 'auf «Fallen aus der Zahl» umgestellt';
	});

	await schritt('Versammlung mit Ausschlussklage, Beklagter eingetragen, freigeben (Kriterien 3, 4)', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-16');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

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
			.fill(
				'Die Gemeinschaft wird ermächtigt, gegen den beklagten Eigentümer die Ausschlussklage zu erheben.'
			);
		await tf.locator('select[name="erfordernis"]').selectOption('k-ausschlussklage');
		await seite.waitForTimeout(300);
		await abschicken(tf.locator('button[type="submit"]').first());
		// Der Beklagte gehört in den Entwurf; ohne ihn lässt sich die Einladung nicht
		// freigeben. Eingetragen wird er am angelegten Traktandum, im Formular
		// «speichern», wie in `lesarten-1a-a.mjs` (Durchstich gegen Dev, 10.11.2026:
		// Das Formular «anlegen» trägt kein Kästchen für Betroffene).
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const kz = seite.locator('li[data-traktandum]', { hasText: TITEL }).first();
		await kz.locator('button.titel').click();
		await seite.waitForTimeout(400);
		const kform = seite.locator('form[action="?/speichern"]').first();
		const kaestchen = kform.locator('label', { hasText: LEUTE[4] }).locator('input[name="betroffene"]').first();
		behaupte(await kaestchen.count(), `Das Kästchen für den Beklagten «${LEUTE[4]}» fehlt`);
		await kaestchen.check();
		await abschicken(kform.locator('button[type="submit"]').first());

		// W12 steht in der Karte (Erfordernisseite): Die Gemeinschaft stellt die Zahl ein.
		const karte = await kartentext();
		behaupte(karte.includes(W12), `W12 fehlt auf der Karte: ${karte.slice(0, 1600)}`);
		// Der alte Satz stand in Hinweis 9, also auf der Karte, nicht in der Liste.
		behaupte(
			!/lässt Votum sie trotzdem, wie es der Wortlaut von/.test(karte),
			`Der alte Satz zu 1e steht noch: ${karte.slice(0, 1600)}`
		);

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(
			/Freigegeben\./.test(await seitentext()),
			`Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`
		);
		return 'eingefroren «Fallen aus der Zahl»';
	});

	await schritt('Im Saal: Ausstand der Angehörigen, W11 und W13 vor der Abstimmung (Kriterien 4, 5)', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		// Der Beklagte fehlt; die drei übrigen und seine Ehefrau sind da.
		for (const wer of LEUTE.slice(0, 4)) {
			await erfasseAnwesend(wer);
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		// Ohne Ausstand schweigt W11: Es gäbe kein zweites Ergebnis.
		const ohne = await seitentext();
		behaupte(!ohne.includes(W11), `W11 steht schon ohne Ausstand: ${ohne.slice(0, 1200)}`);

		await seite.locator('.eingriffe .wort', { hasText: 'Ausstand' }).first().click();
		await seite.waitForTimeout(200);
		const form = seite.locator('form[action="?/ausstand"]');
		await form.locator('input[type="search"]').fill('Dorn');
		await seite.waitForTimeout(200);
		// Über den Namen, nicht das erste Kästchen (Codeprüfung Teil 4).
		await form.locator('.wahlliste label', { hasText: 'Dorn' }).first().click();
		await form
			.locator('input[name="grund"]')
			.fill('Ehefrau des Beklagten in gerader Linie (ZGB Art. 68 sinngemäss).');
		await abschicken(form.locator('button[type="submit"]'));

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const vorher = await seitentext();
		behaupte(vorher.includes(W11), `W11 fehlt vor der Abstimmung: ${vorher.slice(0, 1400)}`);
		behaupte(
			vorher.includes(FOLGE),
			`Die Folge der milden Wahl fehlt vor der Abstimmung: ${vorher.slice(0, 1400)}`
		);
		behaupte(vorher.includes(W13), `W13 fehlt vor der Abstimmung: ${vorher.slice(0, 1400)}`);
		return 'W11 und W13 stehen, W13 statt des Rats, von Hand zu zählen';
	});

	await schritt('Zwei von drei übrigen stimmen Ja: angenommen, mit ihr in der Zahl abgelehnt (Kriterium 5)', async () => {
		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'yes'],
			['Christen', 'no']
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
		const satz = (await karte.locator('p.satz').innerText()).replace(/\s+/g, ' ');
		behaupte(
			satz.startsWith('Angenommen'),
			`Ohne die Angehörige in der Zahl nicht angenommen: ${satz.slice(0, 400)}`
		);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Fallen aus der Zahl»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Bleiben in der Zahl»: die Rechnung mit den Angehörigen in der Zahl\) wäre er abgelehnt: 2 Ja von 4 Kopfstimmen, nötig 3\./.test(
				kasten
			),
			`Das Ergebnis mit ihr in der Zahl fehlt: ${kasten.slice(0, 1400)}`
		);
		behaupte(
			/Geklagt wird frühestens einige Wochen nach Ablauf der Frist/.test(kasten),
			`Der Rat nach der Annahme fehlt: ${kasten.slice(0, 1800)}`
		);
		return 'angenommen; mit ihr in der Zahl abgelehnt';
	});

	await schritt('Das Protokoll nennt das abweichende Ergebnis (Kriterium 6)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(
			/\s+/g,
			' '
		);
		behaupte(
			/Nach der anderen Lesart \(«Bleiben in der Zahl»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 2 Ja von 4 Kopfstimmen, nötig 3\./.test(
				entwurf
			),
			`Die Feststellung am Ausgang fehlt: ${entwurf.slice(0, 1500)}`
		);
		return 'Feststellung am Ausgang';
	});

	await schritt('Zurückstellen auf die Vorgabe', async () => {
		await stelleUm(gemeinschaft, 'bleiben');
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L10"][value="bleiben"]').isChecked(),
			'Die Vorgabe ist nicht wieder angekreuzt'
		);
		return '«Bleiben in der Zahl»';
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
