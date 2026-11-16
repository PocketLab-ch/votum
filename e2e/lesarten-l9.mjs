/**
 * Durchstich: Lesart L9, Zählbasis der Ermächtigung zur Ausschlussklage
 * (Migration 188, Fassung 2026-11-10, Entscheid 0044 zweiter Nachtrag R1 (a)).
 *
 * **Der Weg.** Eine Gemeinschaft mit fünf Eigentümern zu je 200 von 1000. Der
 * erste ist der Beklagte und bleibt der Versammlung fern; der letzte fehlt
 * ebenfalls. Die Verwaltung stellt L9 auf «Anwesende und Vertretene ohne den
 * Beklagten»; die Seite kennzeichnet die Vorgabe «Alle Eigentümer ohne den
 * Beklagten» und zeigt unter der milden Wahl die Folge. Ein Traktandum zur
 * Ausschlussklage bekommt sein Mehr nach der Umstellung, der Beklagte wird im
 * Formular angekreuzt, die Versammlung wird freigegeben, und im Saal stimmen
 * zwei der drei Anwesenden Ja: An den vier übrigen Eigentümern wären drei Ja
 * nötig, an den drei Anwesenden genügen zwei. Nach der eingestellten Wahl ist
 * der Antrag angenommen; Leitung und Protokoll nennen das Ergebnis an allen
 * Eigentümern, und der Rat an die Leitung ist der von 1a mit dem Zusatz zur
 * offenen Frage, ob das Gericht die Zahl trotzdem nachprüft, und zum sicheren
 * Weg. Am Ende stellt die
 * Verwaltung zurück.
 *
 * Kriterien aus dem Auftrag E1, Block C: 1, 3, 4, 5 und 6.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»):
 *
 *     node e2e/lesarten-l9.mjs
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l9';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Ermächtigung zur Ausschlussklage';
const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Dorn', 'Eger'].map((n) => `${n} ${LAUF}`);
const QUOTEN = ['200', '200', '200', '200', '200'];

/** Die Folge der milden Wahl (Katalog, L9): nur unter «Anwesende und Vertretene». */
const FOLGE =
	'Wird eine Ermächtigung mit der Mehrheit der Anwesenden nicht innert der Frist angefochten, gilt ' +
	'sie in der Regel';

/** W11, der Hinweis zu den Zahlen: unter «anwesende» nennt er diese Wahl (R2-L-5). */
const W11 =
	'Die Zahlen auf dieser Karte gelten für die Einstellung «Anwesende und Vertretene» auf der Seite ' +
	'«Lesarten».';

/** W10, der Hinweis zur Zählbasis: der Streit und die Einstellung der Gemeinschaft. */
const W10 =
	'Nach welcher Zahl Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein; welche ' +
	'gilt, entscheidet im Streit das Gericht.';

/** W9, der Satz der Begründung: die Gemeinschaft stellt die Zählbasis ein. */
const W9 =
	'An welcher Zahl gemessen wird, stellt Ihre Gemeinschaft ein; ein Beschluss mit der Mehrheit ' +
	'aller ohne den Beklagten genügt beiden.';

/** Der Zusatz von 1a unter L9: die offene Frage und der sichere Weg. */
const FOLGE_ANWESENDE =
	'Ob das Gericht im Ausschlussprozess trotzdem prüft, ob die Mehrheit aller erreicht war';
const WEG_ANWESENDE = 'Den Streit um die Zahl vermeidet nur eine Ermächtigung mit der Mehrheit aller';

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

/** Der Text eines Traktandums, aufgeklappt (wie in e2e/lesarten-l2.mjs). */
async function traktandumtext() {
	await gehe(`/versammlungen/${versammlung}/traktanden`);
	const zeile = seite.locator('[data-traktandum]', { hasText: TITEL }).first();
	await zeile.locator('button.titel').click();
	await seite.waitForTimeout(400);
	return ((await zeile.textContent()) ?? '').replace(/\s+/g, ' ');
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

/** Auf der Seite der Lesarten L9 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L9"][value="${wahl}"]`).check();
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

console.log(`\nLesart L9, Zählbasis der Ausschlussklage: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Lesart L9 ${LAUF}`;

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

	await schritt('Die Seite nennt L9 mit Vorgabe und Folge; Umstellen mit Verlauf (Kriterien 1, 2)', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(
			/An welcher Zahl wird die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen/.test(text),
			`Die Frage zu L9 fehlt: ${text.slice(0, 600)}`
		);
		behaupte(
			await seite.locator('input[name="L9"][value="alle"]').isChecked(),
			'Die Vorgabe «Alle Eigentümer ohne den Beklagten» ist nicht angekreuzt'
		);
		behaupte(/Wortlaut von ZGB Art\. 649b Abs\. 2/.test(text), 'Die Fundstelle der Wahl fehlt (Kriterium 8)');
		// Die Folge steht unter der milden Wahl, nicht unter der Vorgabe.
		behaupte(text.includes(FOLGE), `Die Folge der milden Wahl fehlt auf der Seite «Lesarten»: ${text.slice(0, 1200)}`);
		await stelleUm(gemeinschaft, 'anwesende');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');
		return 'auf «Anwesende und Vertretene ohne den Beklagten» umgestellt';
	});

	await schritt('Versammlung mit Ausschlussklage, Beklagter eingetragen, freigeben (Kriterien 3, 4)', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-15');
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
		const kaestchen = kform.locator('label', { hasText: LEUTE[0] }).locator('input[name="betroffene"]').first();
		behaupte(await kaestchen.count(), `Das Kästchen für den Beklagten «${LEUTE[0]}» fehlt`);
		await kaestchen.check();
		await abschicken(kform.locator('button[type="submit"]').first());

		const liste = await traktandumtext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Anwesende und Vertretene ohne den Beklagten», die für Ihre Gemeinschaft eingestellt ist/.test(
				liste
			),
			`Der Satz zur Lesart fehlt auf der Traktandenseite (Kriterium 4): ${liste.slice(0, 900)}`
		);
		behaupte(liste.includes(FOLGE), `Die Folge der milden Wahl fehlt im Kartensatz: ${liste.slice(0, 1200)}`);
		// W11 steht an erster Stelle, W10 nennt die Einstellung, W9 die Begründung;
		// alle drei auf der Erfordernisseite.
		const karte = await kartentext();
		behaupte(karte.includes(W11), `W11 fehlt auf der Karte: ${karte.slice(0, 1600)}`);
		behaupte(karte.includes(W10), `W10 fehlt auf der Karte: ${karte.slice(0, 1600)}`);
		behaupte(karte.includes(W9), `W9 fehlt in der Begründung: ${karte.slice(0, 1600)}`);
		// Der alte Satz stand in der Begründung, also auf der Karte, nicht in der Liste.
		behaupte(
			!karte.includes('dieses Werkzeug folgt der strengeren Wortlaut-Lesart'),
			`Der alte Satz über das Werkzeug steht noch: ${karte.slice(0, 1600)}`
		);

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		return 'eingefroren «Anwesende und Vertretene ohne den Beklagten»';
	});

	await schritt('Im Saal: zwei von drei Anwesenden stimmen Ja (Kriterien 3, 5)', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		// Der Beklagte und der letzte Eigentümer fehlen: drei Anwesende von vier übrigen.
		for (const wer of LEUTE.slice(1, 4)) {
			await erfasseAnwesend(wer);
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		const vorher = await seitentext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Anwesende und Vertretene ohne den Beklagten»/.test(vorher),
			`Die eingefrorene Lesart steht nicht vor der Abstimmung (Kriterium 4): ${vorher.slice(0, 900)}`
		);
		behaupte(vorher.includes(FOLGE), `Die Folge der milden Wahl fehlt vor der Abstimmung: ${vorher.slice(0, 1200)}`);

		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Bucher', 'yes'],
			['Christen', 'yes'],
			['Dorn', 'no']
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
		behaupte(satz.startsWith('Angenommen'), `Nach den Anwesenden nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		// Das zweite Ergebnis rechnet 1a: an allen Eigentümern ohne den Beklagten.
		behaupte(
			/Gezählt an den Anwesenden und Vertretenen ausser dem Beklagten, ist der Antrag angenommen\. Gezählt an allen Eigentümern ausser dem Beklagten, wie es der Wortlaut von ZGB Art\. 649b Abs\. 2 nahelegt, wäre er abgelehnt: 2 Ja von 4 Kopfstimmen, nötig 3\./.test(
				kasten
			),
			`Das Ergebnis an allen Eigentümern fehlt: ${kasten.slice(0, 1200)}`
		);
		// W13 («Verkündet wird nach der Einstellung …») steht nur nach einer Ablehnung
		// unter der Vorgabe, nicht hier (Codeprüfung E1 Block C, Befund 1).
		// Der Zusatz von 1a unter L9: die offene Frage und der sichere Weg.
		behaupte(kasten.includes(FOLGE_ANWESENDE), `Die offene Frage fehlt: ${kasten.slice(0, 1800)}`);
		behaupte(kasten.includes(WEG_ANWESENDE), `Der sichere Weg fehlt: ${kasten.slice(0, 1800)}`);
		return 'angenommen; an allen Eigentümern abgelehnt';
	});

	await schritt('Das Protokoll nennt Lesart und abweichendes Ergebnis (Kriterium 6)', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes(
				'Gezählt nach der Mehrheit der Anwesenden und Vertretenen ohne den Beklagten. Ob die Ermächtigung zur Ausschlussklage die Mehrheit aller Eigentümer ohne den Beklagten braucht oder die Mehrheit der Anwesenden und Vertretenen genügt, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.'
			),
			`Die Lesart fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Verkündet ist die Annahme, gezählt an den Anwesenden und Vertretenen ausser dem Beklagten\. Gezählt an allen Eigentümern ausser dem Beklagten, wäre der Antrag abgelehnt gewesen: 2 Ja von 4 Kopfstimmen, nötig 3\./.test(
				entwurf
			),
			`Die Feststellung am Ausgang fehlt: ${entwurf.slice(0, 1500)}`
		);
		return 'Lesart und Feststellung';
	});

	await schritt('Zurückstellen auf die Vorgabe', async () => {
		await stelleUm(gemeinschaft, 'alle');
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L9"][value="alle"]').isChecked(),
			'Die Vorgabe ist nicht wieder angekreuzt'
		);
		return '«Alle Eigentümer ohne den Beklagten»';
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
