/**
 * Durchstich: Lesart L17, Bezahlung einer Arbeit aus dem Erneuerungsfonds
 * (Migration 196, Fassung 2026-11-20; Produktentscheid 17.11.2026).
 *
 * **Der Weg.** Eine Gemeinschaft mit drei Eigentümern: zwei kleine Wohnungen zu
 * 200, eine grosse zu 600. Die Verwaltung stellt L17 auf «Nach dem
 * SVIT-Kommentar»; die Seite kennzeichnet die Vorgabe «Strengere Auffassung»
 * und zeigt unter der anderen Wahl die Folge (`L17_FOLGE`). Ein Traktandum zur
 * Bezahlung aus dem Fonds bekommt sein Erfordernis nach der Umstellung, die
 * Versammlung wird freigegeben, und im Saal sind alle da; die zwei kleinen
 * Wohnungen stimmen Ja, die grosse Nein. Nach der Einstellung genügt das
 * einfache Mehr nach Köpfen, der Antrag ist angenommen. Nach der strengeren
 * Auffassung fehlte die Hälfte aller Wertquoten (400 von 1000); Leitung und
 * Protokoll nennen das. Am Ende stellt die Verwaltung zurück.
 *
 * **Nur im Hauptverzeichnis gegen den Dev-Stapel**, nach der Übernahme
 * (AGENTS.md, «Arbeiten im Worktree»), und erst nach den Migrationen 196 bis 198
 * auf Dev (198 für den Schritt zum eingefrorenen Häkchen):
 *
 *     node e2e/lesarten-l17.mjs
 *
 * Geschrieben, aber im Arbeitsbaum nicht ausgeführt: Die Texte, die es
 * erwartet, sind aus dem Kern abgeleitet, nicht an der Seite gesehen.
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-lesarten-l17';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

const TITEL = 'Dachsanierung aus dem Erneuerungsfonds bezahlen';
const LEUTE = ['Erfunden Aebi', 'Erfunden Bucher', 'Erfunden Christen'].map((n) => `${n} ${LAUF}`);
// Zwei kleine Wohnungen haben die Mehrheit der Köpfe, aber nicht die Hälfte
// aller Wertquoten: Nur so trennt die Zählung die beiden Wahlen.
const QUOTEN = ['200', '200', '600'];

/** Die Frage zu L17 (`L17_FRAGE`). */
const FRAGE =
	'Mit welchem Mehr wird über die Bezahlung einer Arbeit aus dem Erneuerungsfonds entschieden, wenn Reglement ' +
	'und Errichtungsbeschluss es nicht sagen?';
/** Der Anfang der Folge der Wahl «Nach dem SVIT-Kommentar» (`L17_FOLGE`). */
const FOLGE = 'Nach der strengeren Auffassung braucht die Bezahlung das qualifizierte Mehr. Ein Beschluss, der nur das einfache Mehr erreicht, kann dann innert eines Monats angefochten werden, seit man davon weiss.';

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

/** Auf der Seite der Lesarten L17 umstellen. */
async function stelleUm(gemeinschaft, wahl) {
	await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
	await seite.locator(`input[name="L17"][value="${wahl}"]`).check();
	await abschicken(seite.locator('form[action="?/lesarten"] button[type="submit"]').first());
	behaupte(/Lesarten gespeichert\./.test(await seitentext()), 'Keine Quittung «Lesarten gespeichert»');
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nLesart L17, Bezahlung aus dem Erneuerungsfonds: ${ZIEL}\n`);

let versammlung;

try {
	let gemeinschaft;
	const NAME = `Prüflauf Lesart L17 ${LAUF}`;

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

	await schritt('Gemeinschaft mit zwei kleinen und einer grossen Wohnung', async () => {
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
		return '200 + 200 + 600 von 1000';
	});

	await schritt('Die Seite nennt L17 mit Vorgabe und Folge; Umstellen mit Verlauf', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		const text = await seitentext();
		behaupte(text.includes(FRAGE), `Die Frage zu L17 fehlt: ${text.slice(0, 600)}`);
		behaupte(
			await seite.locator('input[name="L17"][value="streng"]').isChecked(),
			'Die Vorgabe «Strengere Auffassung» ist nicht angekreuzt'
		);
		behaupte(/Art\. 712l Rz\. 137 bis 139/.test(text), 'Die Fundstelle der Wahl fehlt');
		behaupte(text.includes(FOLGE), `Die Folge der Wahl fehlt auf der Seite «Lesarten»: ${text.slice(0, 1200)}`);
		await stelleUm(gemeinschaft, 'svit');
		behaupte(/Zuletzt geändert von .* am /.test(await seitentext()), 'Der Stand «zuletzt geändert» fehlt');
		return 'auf «Nach dem SVIT-Kommentar» umgestellt';
	});

	await schritt('Versammlung mit der Bezahlung aus dem Fonds, Karte mit Folge, freigeben', async () => {
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
			.fill('Die Dachsanierung wird aus dem Erneuerungsfonds bezahlt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-erneuerungsfonds-entnahme');
		await abschicken(tf.locator('button[type="submit"]').first());

		const liste = await traktandumtext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Nach dem SVIT-Kommentar», die für Ihre Gemeinschaft eingestellt ist/.test(
				liste
			),
			`Der Satz zur Lesart fehlt auf der Traktandenseite: ${liste.slice(0, 900)}`
		);
		behaupte(liste.includes(FOLGE), `Die Folge fehlt im Kartensatz: ${liste.slice(0, 1200)}`);

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		return 'eingefroren «Nach dem SVIT-Kommentar»';
	});

	await schritt('Im Saal: alle da, die zwei kleinen Ja, die grosse Nein', async () => {
		await gehe(`/versammlungen/${versammlung}`);
		await abschicken(seite.locator('form[action="?/eroeffnen"] button[type="submit"]').first());
		for (let i = 0; i < LEUTE.length; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: TITEL }).first();
		await abschicken(zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first());

		const vorher = await seitentext();
		behaupte(
			/Dieses Traktandum rechnet nach der Lesart «Nach dem SVIT-Kommentar»/.test(vorher),
			`Die eingefrorene Lesart steht nicht vor der Abstimmung: ${vorher.slice(0, 900)}`
		);

		await abschicken(seite.locator('form[action="?/oeffnen"] button[type="submit"]').first());
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Erfunden Aebi', 'yes'],
			['Erfunden Bucher', 'yes'],
			['Erfunden Christen', 'no']
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
		behaupte(satz.startsWith('Angenommen'), `Nach der Einstellung nicht angenommen: ${satz.slice(0, 400)}`);
		const kasten = (await karte.innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Nach dem SVIT-Kommentar»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Strengere Auffassung»: .*\) wäre er abgelehnt/.test(
				kasten
			),
			`Das Ergebnis nach der anderen Lesart fehlt: ${kasten.slice(0, 1200)}`
		);
		return 'angenommen; nach der strengeren Auffassung abgelehnt';
	});

	await schritt('Das Protokoll nennt Lesart und abweichendes Ergebnis', async () => {
		await gehe(`/versammlungen/${versammlung}/protokoll`);
		await abschicken(seite.locator('form[action="?/entwurf"] button[type="submit"]').first());
		const entwurf = (await seite.locator('textarea[name="body"]').first().inputValue()).replace(/\s+/g, ' ');
		behaupte(
			entwurf.includes(
				'Gezählt nach der Auffassung des SVIT-Kommentars. Ob die Bezahlung einer Arbeit aus dem Erneuerungsfonds das qualifizierte Mehr braucht oder das einfache Mehr nach Köpfen genügt, und ob eine bei der Schaffung vereinbarte weitere Verwendung die Zustimmung aller braucht, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.'
			),
			`Die Lesart fehlt im Protokoll: ${entwurf.slice(0, 1500)}`
		);
		behaupte(
			/Nach der anderen Lesart \(«Strengere Auffassung»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/.test(
				entwurf
			),
			`Die Feststellung am Ausgang fehlt: ${entwurf.slice(0, 1500)}`
		);
		return 'Lesart und Feststellung';
	});

	await schritt('Zurückstellen auf die Vorgabe', async () => {
		await stelleUm(gemeinschaft, 'streng');
		await gehe(`/gemeinschaften/${gemeinschaft}/lesarten`);
		behaupte(
			await seite.locator('input[name="L17"][value="streng"]').isChecked(),
			'Die Vorgabe ist nicht wieder angekreuzt'
		);
		return '«Strengere Auffassung»';
	});

	/*
	 * **Das Häkchen «Begründungsakt oder Zustimmung aller»** (Migration 197,
	 * Fassung 2026-11-21; Produktentscheid 17.11.2026, «Häkchen, sonst Hinweis»).
	 * Unter «streng» gilt eine mildere Regel für genau diesen Fall erst mit dem
	 * Häkchen; ohne nennt die Karte den Weg dorthin.
	 */
	const FUNDSTELLE_FONDS = `Reglement Art. 31 (erfunden) ${LAUF}`;
	const abweichungsformular = () => seite.locator('form#abweichungsformular');

	/** Der zweite Finder mit dieser Gemeinschaft bis zur Karte der Bezahlung im Zweck. */
	async function karteDerBezahlung() {
		await gehe(`/quorum?g=${gemeinschaft}`);
		await seite.locator('a[href*="ast=a-geld"]').first().click();
		await seite.waitForURL(/ast=a-geld/, { timeout: 30000 });
		for (const antwort of [
			'Mittel des Erneuerungsfonds für ein konkretes Bauvorhaben verwenden',
			'Über die Bezahlung aus dem Fonds',
			'Ja, eine notwendige oder nützliche Arbeit'
		]) {
			const a = seite.locator('a', { hasText: antwort }).first();
			await a.waitFor({ state: 'visible', timeout: 30000 });
			// Nach jedem Schritt auf die neue Adresse warten, sonst liest das Drehbuch die alte Seite.
			const vor = seite.url();
			await a.click();
			await seite.waitForURL((u) => u.toString() !== vor, { timeout: 30000 });
		}
		// Auf die Überschrift der Karte warten, nicht auf den Text: Den nennt die Seite
		// schon vorher in «Bisher gesetzt: …», und das Lesen kam dann vor der Karte
		// (Lauf vom 18.11.2026, Schritt 11).
		await seite
			.getByRole('heading', { name: 'Arbeit aus dem Erneuerungsfonds bezahlen', exact: true })
			.first()
			.waitFor({ state: 'visible', timeout: 30000 });
		return seitentext();
	}

	await schritt('Mildere Regel für die Bezahlung aus dem Fonds ohne Häkchen: nicht angewandt, mit dem Weg', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const rahmen = abweichungsformular();
		await rahmen.locator('select[name="geschaeftsart"]').selectOption('verwaltung_wichtig');
		await rahmen.locator('input[name="knotenId"][value="k-erneuerungsfonds-entnahme"]').check();
		// Das Feld erscheint nur hier (`haekchenMoeglich`); vor dem Speichern bleibt es leer.
		const haekchen = rahmen.locator('input[name="gesichert"]');
		behaupte(await haekchen.count(), 'Das Häkchen fehlt bei der Bezahlung aus dem Fonds');
		behaupte(!(await haekchen.isChecked()), 'Das Häkchen ist vorbelegt');
		await rahmen.locator('input[name="kopfZaehler"]').fill('1');
		await rahmen.locator('input[name="kopfNenner"]').fill('2');
		await rahmen.locator('input[name="fundstelle"]').fill(FUNDSTELLE_FONDS);
		await abschicken(rahmen.locator('button[type="submit"]'));
		await seite.locator('main', { hasText: FUNDSTELLE_FONDS }).first().waitFor({ timeout: 10_000 });

		const text = await karteDerBezahlung();
		behaupte(/Sie wird hier nicht angewandt/.test(text), `Die mildere Regel gilt ohne Häkchen: ${text.slice(0, 900)}`);
		behaupte(/das Häkchen dafür, vor der Freigabe der Einladung/.test(text), 'Der Weg über das Häkchen fehlt (H5)');
		behaupte(/«Notweg»/.test(text), 'Der Notweg für den Fall nach der Freigabe fehlt');
		return 'qualifiziertes Mehr, Weg über das Häkchen';
	});

	await schritt('Mit Häkchen gilt die mildere Regel, und die Karte sagt, worauf sie beruht', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const zeile = seite.locator('#abweichungstabelle tr', { hasText: FUNDSTELLE_FONDS }).first();
		await zeile.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(300);
		await abweichungsformular().locator('input[name="gesichert"]').check();
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.waitForTimeout(400);
		const reglement = await seitentext();
		behaupte(
			/Steht in der ursprünglichen Fassung des Begründungsakts oder hat die Zustimmung aller Eigentümer/.test(reglement),
			'Die Tabelle nennt das Häkchen an der Regel nicht'
		);

		const text = await karteDerBezahlung();
		behaupte(/Angewandt wird die hinterlegte Regel/.test(text), `Die Regel mit Häkchen gilt nicht: ${text.slice(0, 900)}`);
		behaupte(/Sie haben angegeben, dass Ihre Regel/.test(text), 'Der Satz zum Häkchen (H4) fehlt');
		return 'Reglementsmehr mit H4';
	});

	await schritt('Ein Traktandum ohne die Regel erscheint nach dem Häkchen als veraltet und lässt sich neu herleiten', async () => {
		/*
		 * Die Fachprüfung hat das Erkennen nur aus dem Code übernommen (Auftrag
		 * 2026-11-17, Runde 4). Ein Traktandum, das vor dem Häkchen nach der Karte
		 * rechnet, trägt danach ein älteres Erfordernis; die Freigabe sagt ab, bis
		 * es neu hergeleitet ist.
		 */
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const zeile = seite.locator('#abweichungstabelle tr', { hasText: FUNDSTELLE_FONDS }).first();
		await zeile.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(300);
		await abweichungsformular().locator('input[name="gesichert"]').uncheck();
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.waitForTimeout(400);

		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-23');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		const zweite = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(zweite && zweite !== 'neu', `Nicht angelegt: ${seite.url()}`);
		await gehe(`/versammlungen/${zweite}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill(`${TITEL} mit Häkchen`);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Dachsanierung wird aus dem Erneuerungsfonds bezahlt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-erneuerungsfonds-entnahme');
		await abschicken(tf.locator('button[type="submit"]').first());

		// Jetzt das Häkchen setzen: Die mildere Regel gilt neu, das Traktandum ist veraltet.
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('#abweichungstabelle tr', { hasText: FUNDSTELLE_FONDS }).first().locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(300);
		await abweichungsformular().locator('input[name="gesichert"]').check();
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.waitForTimeout(400);
		const kasten = await seitentext();
		behaupte(/Traktand\S* tr(ägt|agen) noch ein älteres Erfordernis/.test(kasten), `Der Kasten zum älteren Erfordernis fehlt: ${kasten.slice(0, 900)}`);
		behaupte(kasten.includes(`${TITEL} mit Häkchen`), 'Das Traktandum steht nicht im Kasten');

		// Die Seite nennt den Grund schon beim Laden und bietet keinen Knopf an (Lauf vom
		// 17.11.2026: hier stand ein Klick, der ins Leere wartete). Dass der Server die
		// Freigabe selbst absagt, hält `tests/db/fondsregel-haekchen.test.ts` fest.
		await gehe(`/versammlungen/${zweite}/freigabe`);
		behaupte(
			/Bezahlung aus dem Erneuerungsfonds stimmt nicht mehr mit den Regeln/.test(await seitentext()),
			`Die Freigabe nennt den veralteten Fall nicht: ${(await seitentext()).slice(0, 600)}`
		);
		behaupte(
			(await seite.locator('form[action$="freigeben"] button[type="submit"]').count()) === 0,
			'Die Freigabe bietet trotz veraltetem Traktandum einen Knopf an'
		);

		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('form[action="?/nachziehen"] button').first().click();
		await seite.waitForTimeout(300);
		const bestaetigen = seite.locator('button', { hasText: 'Neu herleiten' }).last();
		if (await bestaetigen.count()) await abschicken(bestaetigen);
		await gehe(`/versammlungen/${zweite}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nach dem Neuherleiten nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		return 'veraltet, Absage, neu hergeleitet, freigegeben';
	});

	/*
	 * **Das Häkchen wird bei der Freigabe eingefroren** (Migration 198; Entscheid des
	 * Auftraggebers vom 18.11.2026, «Auch Häkchen einfrieren»: «Das Häkchen kommt beim
	 * Freigeben in die Momentaufnahme, und die Karte zeigt danach den damaligen Satz.»).
	 * An einer strengeren Regel ändert das Häkchen nur den Satz (H3 ohne, H4 mit). Vor
	 * der Freigabe ist das Traktandum dann veraltet; danach zeigt die Karte am
	 * Traktandum den Satz von damals, der zweite Finder `/quorum` den von heute, weil er
	 * keine Versammlung kennt.
	 */
	const H3 = /Nach der strengeren Auffassung gilt auch eine strengere Regel nur sicher/;
	const H4 = /Sie haben angegeben, dass Ihre Regel/;

	/** Die Erfordernisseite eines Traktandums bis zur Karte der Bezahlung im Zweck. */
	async function karteAmTraktandum(versammlungId, traktandumId) {
		await gehe(`/versammlungen/${versammlungId}/traktanden/${traktandumId}/erfordernis`);
		await seite.locator('a[href*="ast=a-geld"]').first().click();
		await seite.waitForURL(/ast=a-geld/, { timeout: 30000 });
		for (const antwort of [
			'Mittel des Erneuerungsfonds für ein konkretes Bauvorhaben verwenden',
			'Über die Bezahlung aus dem Fonds',
			'Ja, eine notwendige oder nützliche Arbeit'
		]) {
			const a = seite.locator('a', { hasText: antwort }).first();
			await a.waitFor({ state: 'visible', timeout: 30000 });
			// Nach jedem Schritt auf die neue Adresse warten, sonst liest das Drehbuch die alte Seite.
			const vor = seite.url();
			await a.click();
			await seite.waitForURL((u) => u.toString() !== vor, { timeout: 30000 });
		}
		// Auf die Überschrift der Karte warten, nicht auf den Text: Den nennt die Seite
		// schon vorher in «Bisher gesetzt: …», und das Lesen kam dann vor der Karte
		// (Lauf vom 18.11.2026, Schritt 11).
		await seite
			.getByRole('heading', { name: 'Arbeit aus dem Erneuerungsfonds bezahlen', exact: true })
			.first()
			.waitFor({ state: 'visible', timeout: 30000 });
		return seitentext();
	}

	/** Das Häkchen an der Regel mit `FUNDSTELLE_FONDS` setzen oder entfernen. */
	async function haekchenAnDerRegel(gesetzt) {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('#abweichungstabelle tr', { hasText: FUNDSTELLE_FONDS }).first().locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(300);
		const feld = abweichungsformular().locator('input[name="gesichert"]');
		if (gesetzt) await feld.check();
		else await feld.uncheck();
		await abschicken(abweichungsformular().locator('button[type="submit"]'));
		await seite.waitForTimeout(400);
		return seitentext();
	}

	await schritt('Strengere Regel: Häkchen vor der Freigabe macht das Traktandum veraltet, danach zeigt die Karte den Satz von damals', async () => {
		// Die Regel strenger als das qualifizierte Mehr stellen, ohne Häkchen (erfundene Werte).
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('#abweichungstabelle tr', { hasText: FUNDSTELLE_FONDS }).first().locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(300);
		const rahmen = abweichungsformular();
		await rahmen.locator('select[name="kopfArt"]').selectOption('mindestens');
		await rahmen.locator('input[name="kopfZaehler"]').fill('2');
		await rahmen.locator('input[name="kopfNenner"]').fill('3');
		await rahmen.locator('input[name="mitQuoten"]').check();
		await seite.waitForTimeout(150);
		await rahmen.locator('select[name="quotenArt"]').selectOption('mehr_als');
		await rahmen.locator('input[name="quotenZaehler"]').fill('1');
		await rahmen.locator('input[name="quotenNenner"]').fill('2');
		await rahmen.locator('select[name="quotenbasis"]').selectOption('alle_quoten');
		await rahmen.locator('input[name="gesichert"]').uncheck();
		await abschicken(rahmen.locator('button[type="submit"]'));
		await seite.waitForTimeout(400);

		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-12-30');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		const dritte = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(dritte && dritte !== 'neu', `Nicht angelegt: ${seite.url()}`);
		await gehe(`/versammlungen/${dritte}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		const titel = `${TITEL} eingefroren`;
		await tf.locator('input[name="titel"]').fill(titel);
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Die Fassadensanierung wird aus dem Erneuerungsfonds bezahlt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-erneuerungsfonds-entnahme');
		await abschicken(tf.locator('button[type="submit"]').first());
		const traktandum = await seite
			.locator('[data-traktandum]', { hasText: titel })
			.first()
			.getAttribute('data-traktandum');
		behaupte(traktandum, 'Das Traktandum fehlt in der Liste');
		const ohne = await karteAmTraktandum(dritte, traktandum);
		behaupte(/Angewandt wird die hinterlegte Regel/.test(ohne), `Die strengere Regel gilt nicht: ${ohne.slice(0, 900)}`);
		behaupte(H3.test(ohne) && !H4.test(ohne), 'Vor dem Häkchen steht nicht H3');

		// Vor der Freigabe gesetzt: Das Mehr bleibt, das Traktandum ist trotzdem veraltet.
		const kasten = await haekchenAnDerRegel(true);
		behaupte(kasten.includes(titel), `Das Traktandum steht nicht im Kasten: ${kasten.slice(0, 900)}`);
		behaupte(
			/Häkchen «Begründungsakt oder Zustimmung aller» gesetzt/.test(kasten),
			'Der Kasten nennt das gewechselte Häkchen nicht'
		);
		await gehe(`/versammlungen/${dritte}/freigabe`);
		behaupte(
			/passt nicht mehr zum Häkchen «Begründungsakt oder Zustimmung aller» an seiner Regel/.test(await seitentext()),
			`Die Freigabe nennt das gewechselte Häkchen nicht: ${(await seitentext()).slice(0, 600)}`
		);
		behaupte(
			(await seite.locator('form[action$="freigeben"] button[type="submit"]').count()) === 0,
			'Die Freigabe bietet trotz gewechseltem Häkchen einen Knopf an'
		);
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		await seite.locator('form[action="?/nachziehen"] button').first().click();
		await seite.waitForTimeout(300);
		const bestaetigen = seite.locator('button', { hasText: 'Neu herleiten' }).last();
		if (await bestaetigen.count()) await abschicken(bestaetigen);
		await gehe(`/versammlungen/${dritte}/freigabe`);
		await abschicken(seite.locator('form[action$="freigeben"] button[type="submit"]').first());
		behaupte(/Freigegeben\./.test(await seitentext()), `Nach dem Neuherleiten nicht freigegeben: ${(await seitentext()).slice(0, 400)}`);
		behaupte(H4.test(await karteAmTraktandum(dritte, traktandum)), 'Nach der Freigabe mit Häkchen steht nicht H4');

		// Nach der Freigabe entfernt: Die Karte am Traktandum bleibt bei H4, der Kasten zeigt nichts.
		const danach = await haekchenAnDerRegel(false);
		behaupte(!danach.includes(titel), 'Der Kasten bietet nach der Freigabe an, den Satz zu ändern');
		const amTraktandum = await karteAmTraktandum(dritte, traktandum);
		behaupte(H4.test(amTraktandum) && !H3.test(amTraktandum), `Die Karte zeigt nicht den Satz von damals: ${amTraktandum.slice(0, 900)}`);
		// Der zweite Finder kennt keine Versammlung und zeigt den Satz von heute.
		const finder = await karteDerBezahlung();
		behaupte(H3.test(finder) && !H4.test(finder), 'Der zweite Finder zeigt nicht den Satz von heute');
		return 'veraltet vor der Freigabe, danach H4 von damals, /quorum H3 von heute';
	});

	await schritt('Unter dem SVIT-Kommentar sagt die Karte nichts zum Häkchen', async () => {
		await stelleUm(gemeinschaft, 'svit');
		const text = await karteDerBezahlung();
		behaupte(/Angewandt wird die hinterlegte Regel/.test(text), 'Die fallgenaue Regel gilt unter «svit» nicht');
		behaupte(!/Sie haben angegeben, dass Ihre Regel/.test(text), 'Der Satz zum Häkchen steht auch unter «svit»');
		await stelleUm(gemeinschaft, 'streng');
		return 'ohne H4';
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
