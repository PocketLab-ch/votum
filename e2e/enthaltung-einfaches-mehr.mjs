/**
 * Enthaltungen beim einfachen Mehr, eine Einstellung der Gemeinschaft
 * (Auftrag 07.10.2026, «votum-enthaltung-einfaches-mehr»).
 *
 * **Der Fall:** Drei Einheiten zu 340, 330 und 330. Das Reglement nimmt beim
 * einfachen Mehr Enthaltungen aus der Bezugsgrösse und lässt bei
 * Stimmengleichheit die Wertquote entscheiden. Ein Ja (340), ein Nein, eine
 * Enthaltung: Ohne die Einstellung ist das ein verfehltes Mehr auf der Basis 3,
 * mit ihr ein Gleichstand auf der Basis 2, den die Wertquote für das Ja
 * entscheidet. Das Ergebnis an der Wand unterscheidet also die beiden Lagen.
 *
 * **Und der Altbestand, gemessen statt angenommen.** Das Traktandum entsteht,
 * bevor die Einstellung gesetzt wird. Danach muss die Angabenseite sagen, dass
 * es noch das bisherige Erfordernis trägt, und die Reglementsseite muss es im
 * Nachzieh-Kasten zeigen. Erst nach dem Nachziehen gilt die Einstellung.
 *
 * Der Zählkern steht in `tests/domain/auszaehlung.test.ts` («Enthaltungen beim
 * einfachen Mehr als Einstellung der Gemeinschaft»).
 *
 * Aufruf: `node e2e/enthaltung-einfaches-mehr.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-enthaltung';
const FUNDSTELLE = 'Art. 33 Abs. 1 Reglement';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

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
		console.log(`  ✓ ${nr} ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
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

/**
 * Ein Formular abschicken und auf die Wirkung warten.
 *
 * **Genau wie in den übrigen Drehbüchern** (`e2e/ausstand.mjs`). Der erste
 * Anlauf hier rief `nachAbsendung(seite)` mit einem statt vier Argumenten und
 * startete den Wächter **vor** dem Klick: Er wartete auf nichts, sah keine
 * Antwort, und eine Absage über `fail(400)` — die unter `use:enhance` als
 * HTTP 200 zurückkommt — wäre unbemerkt geblieben. Sichtbar wurde es daran,
 * dass jeder Schritt danach neu laden musste, um etwas zu sehen.
 */
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

/**
 * Eine Seite laden.
 *
 * `nachladeWarter` gehört **nicht** hierher: Er wartet auf ein
 * `__data.json`-GET, das eine Vollnavigation gar nicht auslöst — das kostete
 * je Aufruf zwanzig Sekunden Leerlauf und den Lauf rund zehn Minuten.
 */
async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

async function seitentext() {
	return (await seite.locator('main').innerText()).replace(/\s+/g, ' ');
}

async function oeffneErfassung() {
	await seite.evaluate(() => {
		document
			.querySelectorAll('details:has(form[action="?/erfassen"])')
			.forEach((d) => (d.open = true));
	});
	await seite.waitForTimeout(100);
}

await mkdir(AUFNAHMEN, { recursive: true });
browser = await chromium.launch({ args: ['--no-sandbox'] });
const kontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
seite = await kontext.newPage();
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);
const wandKontext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const wand = await wandKontext.newPage();
warteNachNavigation(wand);

console.log(`\nEnthaltungen beim einfachen Mehr — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	let traktandum;
	let anzeigecode;
	const NAME = `Prüflauf Enthaltung ${LAUF}`;
	const LEUTE = [
		['Aebi', '340'],
		['Bucher', '330'],
		['Christen', '330']
	];

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

	await schritt('Gemeinschaft ohne Einstellung, Gleichstand nach Wertquote', async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		await seite.locator('input[name="tieBreak"][value="wertquote"]').check();
		await seite.waitForTimeout(150);
		await seite.locator('input[name="tieBreakRuleSource"]').fill('Art. 33 Abs. 2 Reglement');
		behaupte(
			!(await seite.locator('input[name="abstentionExcluded"]').isChecked()),
			'Die Einstellung zu den Enthaltungen ist beim Anlegen schon gesetzt'
		);
		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft && gemeinschaft !== 'neu', `Nicht angelegt: ${seite.url()}`);

		for (const [i, [wer, quote]] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill(quote);
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
		return '340, 330, 330';
	});

	await schritt('Nach einer Absage bleiben Bauart und Mitglieder einer MEG stehen', async () => {
		/*
		 * Codeprüfung 07.10.2026 (Bestand, dieselbe Klasse wie die Haken): Aus
		 * «Miteigentümergemeinschaft» mit Häusern wurde nach einer Absage
		 * «eigene Einheiten» ohne Häuser. Ausgelöst wird die Absage über die
		 * Zugangs-Vollmacht ohne Fundstelle; angelegt wird nichts.
		 */
		await gehe('/gemeinschaften/neu');
		const bauart = seite.locator('input[name="art"][value="meg"]');
		for (let i = 0; i < 10 && !(await bauart.isChecked()); i++) {
			await bauart.check();
			await seite.waitForTimeout(200);
		}
		await seite.fill('input[name="name"]', `${NAME} MEG`);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
		const block = seite.locator('fieldset.mitglieder');
		const kaesten = block.locator('.wahlliste label input');
		behaupte((await kaesten.count()) >= 2, 'Weniger als zwei Gemeinschaften zur Wahl');
		for (const n of [0, 1]) {
			for (let i = 0; i < 10 && !(await kaesten.nth(n).isChecked()); i++) {
				await kaesten.nth(n).check();
				await seite.waitForTimeout(200);
			}
		}
		const quoten = block.locator('input[name^="quote:"]');
		await quoten.nth(0).fill('600');
		await quoten.nth(1).fill('400');
		for (const feld of await block.locator('input[name^="vertretung:"]').all()) {
			await feld.fill('Vertretung des Hauses');
		}
		await block.locator('input[name="ab"]').fill('2020-02-19');
		// Ä-43: Pflicht, sobald Häuser Mitglied werden (Migration 163).
		await seite.locator('input[name="traegerschaft"][value="stockwerkanteile"]').check();
		await seite.locator('input[name="proxyByAccess"]').check();
		await seite.locator('input[name="proxyByAccessSource"]').fill('');
		await abschicken(seite.locator('main button[type="submit"]').first());

		behaupte(seite.url().includes('/gemeinschaften/neu'), `Doch angelegt: ${seite.url()}`);
		behaupte(await bauart.isChecked(), 'Nach der Absage ist die Bauart nicht mehr «MEG»');
		const nachher = seite.locator('fieldset.mitglieder input[name^="quote:"]');
		behaupte((await nachher.count()) === 2, `Nach der Absage ${await nachher.count()} statt 2 Mitglieder`);
		behaupte(
			(await nachher.nth(0).inputValue()) === '600' && (await nachher.nth(1).inputValue()) === '400',
			'Nach der Absage stehen die Anteile nicht mehr auf 600 und 400'
		);
		for (const feld of await seite.locator('fieldset.mitglieder input[name^="vertretung:"]').all()) {
			behaupte(
				(await feld.inputValue()) === 'Vertretung des Hauses',
				'Nach der Absage ist eine Vertretung leer'
			);
		}
		behaupte(
			(await seite.locator('fieldset.mitglieder input[name="ab"]').inputValue()) === '2020-02-19',
			'Nach der Absage steht «Ab wann» nicht mehr auf dem eingegebenen Tag'
		);
		behaupte(
			await seite.locator('input[name="traegerschaft"][value="stockwerkanteile"]').isChecked(),
			'Nach der Absage ist die Trägerschaft nicht mehr gewählt'
		);
		/*
		 * **Und der Teilerfolg** (Codeprüfung 07.10.2026): Mit Nenner 0 steht die
		 * Gemeinschaft, die Mitglieder aber nicht (`ohne_verteiler`). Bis dahin
		 * kam das als Absage mit vollem Formular zurück, und das nächste
		 * Absenden legte eine zweite Gemeinschaft an.
		 */
		await seite.locator('input[name="proxyByAccessSource"]').fill('Art. 27 Abs. 3 Reglement');
		await seite.fill('input[name="quotaDenominator"]', '0');
		await abschicken(seite.locator('main button[type="submit"]').first());
		const meldung = await seitentext();
		behaupte(
			/Die Gemeinschaft ist angelegt, die Mitglieder noch nicht/.test(meldung),
			`Der Teilerfolg wird nicht als solcher gemeldet: ${meldung.slice(0, 300)}`
		);
		return 'Bauart, Mitglieder, Anteile, Vertretung und Datum stehen noch; Teilerfolg gemeldet';
	});

	await schritt('Versammlung und Traktandum, bevor die Einstellung gesetzt ist', async () => {
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="einzeln"]').check();
		await seite.waitForTimeout(150);
		await seite.locator(`input[name="gemeinschaft"][value="${gemeinschaft}"]`).check();
		await seite.fill('input[name="datum"]', '2027-06-10');
		await seite.fill('input[name="uhrzeit"]', '19:00');
		await seite.fill('input[name="ort"]', 'Prüfsaal');
		await abschicken(seite.locator('button[form="anlegen"]').first());
		versammlung = seite.url().split('/versammlungen/')[1]?.split(/[/?#]/)[0];
		behaupte(versammlung && versammlung !== 'neu', `Nicht angelegt: ${seite.url()}`);

		await gehe(`/versammlungen/${versammlung}/traktanden`);
		await seite.locator('.neu button.haupt').click();
		await seite.waitForTimeout(250);
		const tf = seite.locator('form[action="?/anlegen"]').first();
		await tf.locator('input[name="titel"]').fill('Neue Veloständer');
		await tf.locator('input[name="art"][value="abstimmung"]').check();
		await seite.waitForTimeout(200);
		await tf
			.locator('textarea[name="antragswortlaut"], input[name="antragswortlaut"]')
			.first()
			.fill('Vor dem Haus werden zwei Veloständer aufgestellt.');
		await tf.locator('select[name="erfordernis"]').selectOption('k-verwaltung-gewoehnlich');
		await abschicken(tf.locator('button[type="submit"]').first());
		const zeile = seite.locator('[data-traktandum]', { hasText: 'Neue Veloständer' }).first();
		behaupte(await zeile.count(), 'Das Traktandum steht nicht in der Liste');
		traktandum = await zeile.getAttribute('data-traktandum');
		return versammlung.slice(0, 8);
	});

	await schritt('Ohne Fundstelle nimmt die Angabenseite die Einstellung nicht an', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/angaben`);
		/*
		 * **Dieselbe Absage trifft die übrigen Haken** (07.10.2026). Vor der
		 * Korrektur kamen «Vollmacht über den persönlichen Zugang» und «KI
		 * zulassen» leer zurück, und von mehreren ausgenommenen KI-Funktionen
		 * blieb nur die letzte. Gesetzt wird hier alles, was danach stehen muss.
		 */
		await seite.locator('input[name="proxyByAccess"]').check();
		await seite.locator('input[name="proxyByAccessSource"]').fill('Art. 27 Abs. 3 Reglement');
		await seite.locator('input[name="aiEnabled"]').check();
		const ausgenommen = seite.locator('input[name="aiDisabledFunctions"]');
		behaupte((await ausgenommen.count()) >= 2, 'Weniger als zwei KI-Funktionen zum Ausnehmen');
		await ausgenommen.nth(0).check();
		await ausgenommen.nth(1).check();
		await seite.locator('input[name="abstentionExcluded"]').check();
		await seite.waitForTimeout(150);
		const feld = seite.locator('input[name="abstentionExcludedSource"]');
		behaupte(await feld.count(), 'Nach dem Haken fehlt das Feld für die Fundstelle');
		await feld.fill('');
		await abschicken(seite.locator('form[action="?/speichern"] button[type="submit"]').first());
		const text = await seitentext();
		behaupte(
			/gehört die Fundstelle im Reglement dazu/.test(text),
			`Die Absage ohne Fundstelle fehlt: ${text.slice(0, 300)}`
		);
		// Codeprüfung 07.10.2026, Befund 1: Nach der Absage kam der Haken leer
		// zurück, und das Feld, auf das die Meldung zeigt, war verschwunden.
		behaupte(
			await seite.locator('input[name="abstentionExcluded"]').isChecked(),
			'Nach der Absage ist der Haken weg'
		);
		behaupte(
			await seite.locator('input[name="abstentionExcludedSource"]').count(),
			'Nach der Absage fehlt das Feld für die Fundstelle'
		);
		for (const name of ['proxyByAccess', 'aiEnabled']) {
			behaupte(
				await seite.locator(`input[name="${name}"]`).isChecked(),
				`Nach der Absage ist der Haken «${name}» weg`
			);
		}
		const nachher = seite.locator('input[name="aiDisabledFunctions"]');
		behaupte(
			(await nachher.nth(0).isChecked()) && (await nachher.nth(1).isChecked()),
			'Nach der Absage sind nicht mehr beide KI-Funktionen ausgenommen'
		);
		return 'abgewiesen, alle Haken und Felder stehen noch';
	});

	await schritt('Mit Fundstelle gespeichert, und die Seite nennt den Altbestand', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/angaben`);
		await seite.locator('input[name="abstentionExcluded"]').check();
		await seite.waitForTimeout(150);
		await seite.locator('input[name="abstentionExcludedSource"]').fill(FUNDSTELLE);
		await abschicken(seite.locator('form[action="?/speichern"] button[type="submit"]').first());
		const status = (await seite.locator('.gespeichert').innerText()).replace(/\s+/g, ' ');
		// Nicht nur die Veloständer: Die Pflichttraktanden der Vorlage (Jahresrechnung,
		// Décharge und so fort) tragen ebenfalls ein einfaches Mehr. Der erste Lauf
		// erwartete «ein Traktandum» und sah sieben.
		behaupte(
			/(Ein Traktandum wird|\d+ Traktanden werden) weiter nach dem bisherigen Erfordernis gezählt/.test(status),
			`Der Hinweis auf den Altbestand fehlt: ${status}`
		);
		await gehe(`/gemeinschaften/${gemeinschaft}`);
		behaupte(
			(await seitentext()).includes(`Enthaltungen zählen beim einfachen Mehr nicht mit (${FUNDSTELLE})`),
			'Die Übersicht der Gemeinschaft nennt die Einstellung nicht'
		);
		return status.slice(0, 80);
	});

	await schritt('Die Reglementsseite zeigt das Traktandum und zieht es nach', async () => {
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		const kasten = seite.locator('section.nachziehen');
		behaupte(await kasten.count(), 'Kein Nachzieh-Kasten auf der Reglementsseite');
		const text = (await kasten.innerText()).replace(/\s+/g, ' ');
		behaupte(/Neue Veloständer/.test(text), `Das Traktandum fehlt im Kasten: ${text.slice(0, 300)}`);
		behaupte(
			/Enthaltungen nicht mitgezählt/.test(text),
			`Der Kasten sagt nicht, was sich ändert: ${text.slice(0, 300)}`
		);
		await abschicken(kasten.locator('form[action="?/nachziehen"] button[type="submit"]').first());
		await gehe(`/gemeinschaften/${gemeinschaft}/reglement`);
		behaupte(
			!(await seite.locator('section.nachziehen').count()),
			'Nach dem Nachziehen steht der Kasten noch da'
		);
		return 'nachgezogen';
	});

	await schritt('Die Karte sagt, wo die Einstellung gilt und wo nicht', async () => {
		/*
		 * Die Karte steht im Quorenrechner und beim Durchlaufen des Baums am
		 * Traktandum, nicht beim schon gesetzten Erfordernis. Gemessen an einer
		 * Wahl (gilt) und an der Abberufung (gilt nicht, wie keine
		 * Reglementsbestimmung dort).
		 */
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-organe&p=f2-1-waehlen,f2-1-kompetenzen-nein`); // seit Fassung 2026-10-24 mit Frage nach den Kompetenzen
		const wahl = await seitentext();
		behaupte(
			wahl.includes('zählt Votum Enthaltungen hier nicht mit') && wahl.includes(FUNDSTELLE),
			`Die Karte der Wahl nennt die Einstellung nicht: ${wahl.slice(0, 500)}`
		);
		await gehe(`/quorum?g=${gemeinschaft}&ast=a-organe&p=f2-1-abberufen`);
		const abberufung = await seitentext();
		behaupte(
			/Votum zählt Enthaltungen hier mit/.test(abberufung),
			`Die Karte der Abberufung sagt nicht, dass die Einstellung dort nicht gilt: ${abberufung.slice(0, 500)}`
		);
		// Die Rechtsgrundlage entsteht erst in der aufgeklappten Zeile.
		await gehe(`/versammlungen/${versammlung}/traktanden`);
		const zeile = seite.locator('[data-traktandum]', { hasText: 'Neue Veloständer' }).first();
		await zeile.locator('button.titel').click();
		await seite.waitForTimeout(400);
		behaupte(
			((await zeile.textContent()) ?? '').includes(FUNDSTELLE),
			'Die Traktandenliste nennt die Fundstelle in der Rechtsgrundlage nicht'
		);
		return 'Wahl: gilt, Abberufung: gilt nicht, Liste nennt die Fundstelle';
	});

	await schritt('Freigeben, eröffnen, alle anwesend, Wand angemeldet', async () => {
		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());

		await gehe(`/versammlungen/${versammlung}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());
		const code = seite.locator('.anzeigecode .code');
		behaupte(await code.count(), 'Kein Anzeigecode nach dem Eröffnen');
		anzeigecode = (await code.textContent()).trim();

		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		behaupte(
			/3 von 3|3 Parteien/.test(await seitentext()),
			`Nicht alle anwesend: ${(await seitentext()).slice(0, 250)}`
		);

		await wand.goto(`${ZIEL}/p`, { waitUntil: 'load' });
		await wand.fill('input[name="code"]', anzeigecode);
		await Promise.all([
			wand.waitForResponse((r) => r.request().method() === 'POST', { timeout: 45000 }).catch(() => null),
			wand.locator('main button[type="submit"]').first().click()
		]);
		await wand.waitForTimeout(800);
		return `Code ${anzeigecode}`;
	});

	await schritt('Ein Ja, ein Nein, eine Enthaltung', async () => {
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Veloständer');
		await abschicken(aufrufen);

		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(oeffnen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await oeffneErfassung();
		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'no'],
			['Christen', 'abstain']
		]) {
			const z = seite.locator('tr', { hasText: wer }).first();
			const knopf = z.locator(`input[type="radio"][value="${wahl}"]`).first();
			behaupte(await knopf.count(), `Keine Stimmwahl für ${wer}`);
			await knopf.check();
		}
		await oeffneErfassung();
		await abschicken(seite.locator('form[action="?/erfassen"] button[type="submit"]').first());
		await abschicken(seite.locator('form[action="?/schliessen"] button[type="submit"]').first());
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const marke = (
			await seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first().locator('.marke').first().innerText()
		).trim();
		behaupte(
			marke === 'angenommen',
			`Am Traktandum steht «${marke}» statt «angenommen» (Gleichstand, Wertquote 340 für Ja)`
		);
		return `Marke «${marke}»`;
	});

	await schritt('Die Wand zeigt das Ergebnis', async () => {
		await wand.goto(`${ZIEL}/p`, { waitUntil: 'load' });
		await wand.waitForTimeout(800);
		const text = (await wand.locator('body').innerText()).replace(/\s+/g, ' ');
		await wand.screenshot({ path: `${AUFNAHMEN}/wand.png`, fullPage: true }).catch(() => {});
		behaupte(/angenommen/i.test(text), `Die Wand zeigt kein «angenommen»: ${text.slice(0, 400)}`);
		return text.slice(0, 160);
	});

	await schritt('Die Auswertung nennt die Fundstelle', async () => {
		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const text = await seitentext();
		behaupte(text.includes(FUNDSTELLE), `Die Fundstelle fehlt in der Auswertung: ${text.slice(0, 600)}`);
		return 'genannt';
	});
} catch {
	/* der Fehler steht schon in der Liste */
} finally {
	await browser.close();
}

console.log(`\n${nr} Schritte, ${fehler.length} Befunde.\n`);
if (fehler.length) {
	for (const f of fehler) console.log(`  ✗ ${f.nr} ${f.titel}: ${f.text}`);
	process.exit(1);
}
