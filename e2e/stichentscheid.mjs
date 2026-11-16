/**
 * Der Gleichstand bei hinterlegtem Verwalter-Stichentscheid im Saal (PRD 7.9).
 *
 * **Der Fall:** Vier Eigentümer, zwei dafür, zwei dagegen. Das Reglement sieht
 * den Verwalter als entscheidende Person vor. **Seit dem 28.09.2026 gilt die
 * Klausel wieder** (Produktentscheid: «Wendet es an. Empfohlen wird ablehnen,
 * weil das dem Gesetz entspricht und man nicht Partei ergreifen würde.»): Das
 * Schliessen hält an, die Leitung trägt den Entscheid ein, und der steht mit
 * Namen in Auswertung und Protokoll.
 *
 * **Was das Drehbuch prüft.** Der ganze Ablauf in der Oberfläche: Schliessen
 * verkündet nichts, die Marke sagt «Gleichstand offen», das Formular nimmt
 * ohne Namen keinen Entscheid entgegen, mit Namen und Annahme wird er
 * verkündet, und Auswertung und Protokoll nennen die Person.
 *
 * Der Zählkern steht in `tests/domain/auszaehlung.test.ts` und
 * `tests/domain/summenzaehlung.test.ts`, der Schreibweg in
 * `tests/db/abstimmung.test.ts`. Hier läuft die Kette in der Oberfläche.
 *
 * Aufruf: `node e2e/stichentscheid.mjs`
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
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-stichentscheid';
/*
 * **Zwei Regeln, ein Weg** (07.10.2026, Auftrag «votum-stichentscheid-kaskade»).
 * `REGEL=vorsitz` fährt denselben Ablauf mit der Person im Vorsitz, die selbst
 * Eigentümerin ist und den Stichentscheid mit einer zweiten Stimme gibt.
 */
const REGEL = process.env.REGEL === 'vorsitz' ? 'vorsitz' : 'verwalter';
const ENTSCHEIDER = REGEL === 'vorsitz' ? 'Vorsitz Prüfhaus' : 'Verwaltung Prüfhaus';

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
// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
warteNachNavigation(seite);
await rueckfragenBestaetigen(seite);

console.log(`\nStichentscheid bei Stimmengleichheit — ${ZIEL}\n`);

try {
	let gemeinschaft;
	let versammlung;
	const NAME = `Prüflauf Stichentscheid ${LAUF}`;
	const LEUTE = ['Aebi', 'Bucher', 'Christen', 'Duss'];

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

	await schritt(`Gemeinschaft, deren Reglement ${REGEL === 'vorsitz' ? 'den Vorsitz' : 'den Verwalter'} entscheiden lässt`, async () => {
		await gehe('/gemeinschaften/neu');
		await seite.fill('input[name="name"]', NAME);
		await seite.fill('input[name="quotaDenominator"]', '1000');
		await seite.locator('input[name="headCountMode"][value="per_owner"]').check();

		/*
		 * **Die Klausel bleibt wählbar und lesbar** (Produktentscheid
		 * 27.09.2026): Die Anwendung wendet sie nicht mehr an, aber eine
		 * Gemeinschaft, deren Reglement sie führt, trägt sie weiter ein. Der
		 * Weg unten prüft, dass sie nichts mehr bewirkt.
		 */
		const wahl = seite.locator(`input[name="tieBreak"][value="${REGEL}"]`);
		behaupte(await wahl.count(), `Das Formular bietet die Regel «${REGEL}» nicht an`);
		await wahl.check();
		await seite.waitForTimeout(150);

		// Die Fundstelle erscheint erst, wenn eine Regel gewählt ist — und sie ist
		// der Beleg, der im Saal genannt wird.
		const fundstelle = seite.locator('input[name="tieBreakRuleSource"]');
		behaupte(
			await fundstelle.count(),
			'Nach der Wahl fehlt das Feld für die Fundstelle im Reglement'
		);
		await fundstelle.fill('Art. 7 Ziff. 5 Reglement');

		await abschicken(seite.locator('main button[type="submit"]').first());
		gemeinschaft = seite.url().split('/gemeinschaften/')[1].split(/[/?#]/)[0];
		behaupte(gemeinschaft, `Nicht angelegt: ${seite.url()}`);

		for (const [i, wer] of LEUTE.entries()) {
			await gehe(`/gemeinschaften/${gemeinschaft}/einheiten`);
			const ef = seite.locator('form[action$="anlegen"]').first();
			await ef.locator('input[name="label"]').fill(`Whg ${i + 1}`);
			await ef.locator('input[name="quote.stamm"]').fill('250');
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
		return 'vier zu je einem Viertel';
	});

	await schritt('Versammlung, Traktandum, freigeben, eröffnen', async () => {
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

		await gehe(`/versammlungen/${versammlung}/freigabe`);
		const frei = seite.locator('form[action$="freigeben"] button[type="submit"]');
		behaupte(await frei.count(), `Keine Freigabe: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(frei.first());

		await gehe(`/versammlungen/${versammlung}`);
		const auf = seite.locator('form[action="?/eroeffnen"] button[type="submit"]');
		behaupte(await auf.count(), `Kein Eröffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(auf.first());
		return versammlung.slice(0, 8);
	});

	await schritt('Alle vier anwesend, das richtige Traktandum aufgerufen', async () => {
		// «Von Hand erfassen» in der Liste, mit Rückfrage — die Zahl ändert sich
		// mit jeder Bestätigung, deshalb jedes Mal neu laden.
		for (let i = 0; i < LEUTE.length + 2; i++) {
			await gehe(`/versammlungen/${versammlung}/anwesenheit`);
			const knopf = seite.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
			if (!(await knopf.count())) break;
			await abschicken(knopf.first());
		}
		await gehe(`/versammlungen/${versammlung}/anwesenheit`);
		behaupte(
			/4 von 4|4 Parteien/.test(await seitentext()),
			`Nicht alle anwesend: ${(await seitentext()).slice(0, 250)}`
		);

		/*
		 * **Das richtige Traktandum**, nicht das erste: Die Pflichttraktanden
		 * stehen davor, und die Begrüssung ist eine Kenntnisnahme — über sie wird
		 * gar nicht abgestimmt. Der erste Anlauf dieses Drehbuchs griff den
		 * ersten Aufrufen-Knopf der Seite und stand danach vor einem Traktandum
		 * ohne Abstimmung; die Meldung «Kein Öffnen» zeigte damit meinen eigenen
		 * Fehlgriff an, nicht die Anwendung.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		const aufrufen = zeile.locator('form[action="?/aufrufen"] button[type="submit"]').first();
		behaupte(await aufrufen.count(), 'Kein Knopf zum Aufrufen der Veloständer');
		await abschicken(aufrufen);

		/*
		 * **Neu laden, bevor gemessen wird.** Die Seite aktualisiert über
		 * `use:enhance`, also ohne Navigation; der erste Anlauf las den Zustand
		 * von vorher und meldete «kein Traktandum aufgerufen», während der Aufruf
		 * längst durch war.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const jetzt = await seite.locator('li.jetzt, .jetzt').first().innerText();
		behaupte(
			/Neue Veloständer/.test(jetzt.replace(/\s+/g, ' ')),
			`Aufgerufen ist etwas anderes: ${jetzt.replace(/\s+/g, ' ').slice(0, 150)}`
		);
		return 'vier anwesend, Veloständer aufgerufen';
	});

	await schritt('Zwei dafür, zwei dagegen — der echte Gleichstand', async () => {
		// Das Aufrufen leitet auf die Übersicht zurück; das Öffnen steht auf der
		// Leitungsseite.
		await gehe(`/versammlungen/${versammlung}/leitung`);
		const oeffnen = seite.locator('form[action="?/oeffnen"] button[type="submit"]');
		behaupte(await oeffnen.count(), `Kein Öffnen: ${(await seitentext()).slice(0, 220)}`);
		await abschicken(oeffnen.first());
		// Auch hier: erst neu laden, dann messen — `use:enhance` navigiert nicht.
		await gehe(`/versammlungen/${versammlung}/leitung`);
		await oeffneErfassung();

		for (const [wer, wahl] of [
			['Aebi', 'yes'],
			['Bucher', 'yes'],
			['Christen', 'no'],
			['Duss', 'no']
		]) {
			const zeile = seite.locator('tr', { hasText: wer }).first();
			const knopf = zeile.locator(`input[type="radio"][value="${wahl}"]`).first();
			behaupte(await knopf.count(), `Keine Stimmwahl für ${wer}`);
			await knopf.check();
		}
		await oeffneErfassung();
		const erfassen = seite.locator('form[action="?/erfassen"] button[type="submit"]');
		behaupte(await erfassen.count(), 'Kein Knopf zum Erfassen der Stimmen');
		await abschicken(erfassen.first());
		return '2 zu 2';
	});

	await schritt('Das Schliessen verkündet NICHT — es hält an', async () => {
		/*
		 * **Der Prüfstein.** Seit dem 21.08.2026 verkündet das Schliessen
		 * automatisch. Beim offenen Stichentscheid darf es das nicht: Es gibt
		 * kein Ergebnis, das man verkünden könnte, und ein erratenes wäre die
		 * schlimmste denkbare Antwort — die Anwendung verkündete etwas, das
		 * niemand gefällt hat.
		 */
		const schliessen = seite.locator('form[action="?/schliessen"] button[type="submit"]');
		behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen');
		await abschicken(schliessen.first());
		await gehe(`/versammlungen/${versammlung}/leitung`);

		/*
		 * **Gemessen wird die Marke am Traktandum, nicht der Seitentext.** Der
		 * erste Anlauf suchte «angenommen» auf der ganzen Seite und traf damit
		 * das Auswahlfeld des Entscheids («Der Antrag ist angenommen») — eine
		 * Textprobe, die anschlägt, wo nichts ist.
		 */
		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		const marke = (await zeile.locator('.marke').first().innerText()).trim();
		behaupte(
			marke === 'Gleichstand offen',
			`Die Traktandenliste nennt den Antrag «${marke}» statt «Gleichstand offen»`
		);

		const text = await seitentext();
		behaupte(
			/Stimmengleichheit|Gleichstand/i.test(text),
			`Der Gleichstand wird nicht benannt: ${text.slice(0, 400)}`
		);
		behaupte(
			(REGEL === 'vorsitz' ? /Person im Vorsitz/ : /Verwalter/i).test(text),
			`Die Regel wird nicht genannt: ${text.slice(0, 400)}`
		);
		behaupte(
			/Der Entscheid steht noch aus/.test(text),
			`Es steht nicht, dass der Entscheid aussteht: ${text.slice(0, 400)}`
		);
		return `angehalten, Marke «${marke}»`;
	});

	await schritt('Der Eintragsweg ist wieder da', async () => {
		/*
		 * **Produktentscheid 28.09.2026.** Vom 27.09. bis dahin gab es das
		 * Formular nicht; jetzt trägt die Person ihren Entscheid wieder ein.
		 * Votum empfiehlt die Ablehnung und nennt Rz. 187 ad Art. 712m.
		 */
		const form = seite.locator('form[action="?/stichentscheid"]').first();
		behaupte(await form.count(), 'Kein Formular für den Stichentscheid');
		const text = await form.innerText();
		behaupte(
			(REGEL === 'vorsitz' ? /keine Richtung vor/ : /empfiehlt die Ablehnung/).test(text),
			`Die Empfehlung fehlt im Formular: ${text.slice(0, 300)}`
		);
		if (REGEL === 'vorsitz') {
			behaupte(
				await form.locator('input[name="eigentuemer"]').count(),
				'Beim Vorsitz fehlt der Haken für die zweite Stimme'
			);
		}
		behaupte(
			/Rz\. 187/.test(text),
			`Die Fundstelle zur umstrittenen Befugnis fehlt: ${text.slice(0, 300)}`
		);
		return 'Formular mit Empfehlung';
	});

	await schritt('Ohne Namen nimmt sie den Entscheid nicht entgegen', async () => {
		/*
		 * Der Name ist Pflicht: Ein Stichentscheid ohne die Person, die ihn
		 * gefällt hat, ist im Anfechtungsfall wertlos. Geprüft wird der
		 * **Server**, nicht das `required` des Browsers: Das Attribut wird
		 * vorher entfernt, sonst käme die Absendung nie an.
		 */
		const form = seite.locator('form[action="?/stichentscheid"]').first();
		behaupte(await form.count(), 'Kein Formular für den Stichentscheid');
		const wer = form.locator('input[name="wer"]');
		behaupte(await wer.count(), 'Kein Feld für die entscheidende Person');
		await wer.evaluate((el) => el.removeAttribute('required'));
		await form.locator('select[name="wahl"]').selectOption('yes');
		await abschicken(form.locator('button[type="submit"]').first());

		const text = await seitentext();
		behaupte(
			/Wer entschieden hat, gehört ins Protokoll/.test(text),
			`Die Absage ohne Namen fehlt: ${text.slice(0, 400)}`
		);
		return 'ohne Namen kein Entscheid';
	});

	await schritt(`${REGEL === 'vorsitz' ? 'Die Eigentümerin im Vorsitz' : 'Der Verwalter'} entscheidet für die Annahme`, async () => {
		const form = seite.locator('form[action="?/stichentscheid"]').first();
		await form.locator('select[name="wahl"]').selectOption('yes');
		await form.locator('input[name="wer"]').fill(ENTSCHEIDER);
		if (REGEL === 'vorsitz') await form.locator('input[name="eigentuemer"]').check();
		const grund = form.locator('textarea[name="begruendung"]');
		if (await grund.count()) await grund.fill('Die Veloständer stehen im Interesse aller.');
		await abschicken(form.locator('button[type="submit"]').first());
		// Wie überall auf dieser Seite: erst neu laden, dann messen.
		await gehe(`/versammlungen/${versammlung}/leitung`);

		const zeile = seite.locator('.baum li', { hasText: 'Neue Veloständer' }).first();
		const marke = (await zeile.locator('.marke').first().innerText()).trim();
		behaupte(
			marke === 'angenommen',
			`Nach dem Entscheid steht am Traktandum «${marke}» statt «angenommen»`
		);

		const text = await seitentext();
		behaupte(
			new RegExp(ENTSCHEIDER).test(text),
			`Die entscheidende Person fehlt auf der Leitungsseite: ${text.slice(0, 400)}`
		);
		return 'angenommen durch Stichentscheid';
	});

	await schritt('Die Auswertung nennt den Stichentscheid mit Person', async () => {
		await gehe(`/versammlungen/${versammlung}/auswertung`);
		const text = await seitentext();
		behaupte(
			/Stichentscheid|Gleichstand/i.test(text),
			`Der Stichentscheid fehlt in der Auswertung: ${text.slice(0, 400)}`
		);
		behaupte(
			new RegExp(ENTSCHEIDER).test(text),
			`Die entscheidende Person fehlt: ${text.slice(0, 400)}`
		);
		if (REGEL === 'vorsitz') {
			behaupte(
				/in der Zählung nicht enthalten|darin nicht enthalten/.test(text),
				`Die zweite Stimme fehlt in der Auswertung: ${text.slice(0, 600)}`
			);
		}
		return 'genannt';
	});

	await schritt('Und das Protokoll hält ihn fest', async () => {
		/*
		 * **Erst die Versammlung schliessen.** Das Protokoll entsteht danach —
		 * die Seitenleiste sagt es ausdrücklich.
		 */
		await gehe(`/versammlungen/${versammlung}/leitung`);
		// Über die Beschriftung, nicht über die Aktion: `?/schliessen` heisst auch
		// das Schliessen der Abstimmung.
		const zu = seite.locator('button', { hasText: 'Versammlung schliessen' }).first();
		if (await zu.count()) await abschicken(zu);

		await gehe(`/versammlungen/${versammlung}/protokoll`);
		const erzeugen = seite.locator('button', { hasText: 'Entwurf erzeugen' }).first();
		behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen des Entwurfs');
		await abschicken(erzeugen);
		await gehe(`/versammlungen/${versammlung}/protokoll`);

		/*
		 * **Der Entwurf steht in einem Textfeld, nicht im Seitentext.**
		 * `innerText()` liest den Inhalt eines `<textarea>` nicht — er ist
		 * dessen Wert.
		 */
		const feld = seite.locator('textarea[name="body"]').first();
		behaupte(await feld.count(), 'Kein Textfeld mit dem Protokollentwurf');
		const entwurf = await feld.inputValue();
		behaupte(
			entwurf.length > 200,
			`Der Entwurf ist zu kurz, um einer zu sein: ${entwurf.slice(0, 200)}`
		);
		behaupte(
			new RegExp(ENTSCHEIDER).test(entwurf),
			`Der Stichentscheid steht nicht im Protokollentwurf: ${entwurf.slice(0, 600)}`
		);
		if (REGEL === 'vorsitz') {
			behaupte(
				/selbst Stockwerkeigentümer \(der Stichentscheid ist in der Zählung nicht enthalten\)/.test(entwurf),
				`Die zweite Stimme steht nicht im Protokollentwurf: ${entwurf.slice(0, 900)}`
			);
		}
		return 'im Entwurf';
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
