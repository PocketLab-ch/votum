/**
 * Ein Traktandum am Abend, nach einer Absage.
 *
 * **Was hier festgenagelt wird** (offener Punkt aus der Codeprüfung vom
 * 07.10.2026): Lehnt der Server das Anlegen oder Ändern eines Traktandums auf
 * `/tage/[id]/geschaefte` ab, steht das Formular wieder offen da, und zwar mit
 * allem, was abgeschickt wurde: Titel, Art, Wortlaut, Fall und die
 * angekreuzten Gemeinschaften. Vorher klappte es zu, und beim Aufklappen
 * standen Art, Fall und Gemeinschaften auf der Vorgabe; wer nur den gerügten
 * Punkt nachbesserte, legte das Traktandum anders an als gewollt.
 *
 * Die Absagen sind keine künstlichen: ein Wortlaut bei einer Kenntnisnahme
 * und ein zu kurzer Wortlaut bei einer Abstimmung, beides prüft erst der
 * Server.
 *
 * Aufruf: `node e2e/abend-traktandum-absage.mjs`
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { warteNachNavigation } from './bereit.mjs';
import { nachAbsendung, nachladeWarter } from './absendung.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const AUFNAHMEN = process.env.AUFNAHMEN ?? '/tmp/e2e-abend-traktandum-absage';

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);
const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
const TAG = new Date(Date.UTC(2034, 0, 1) + (Date.now() % 700) * 86400000)
	.toISOString()
	.slice(0, 10);

let nr = 0;
const fehler = [];

function behaupte(bedingung, text) {
	if (!bedingung) throw new Error(text);
}

async function schritt(titel, fn) {
	nr += 1;
	try {
		const ergebnis = await fn();
		console.log(`  ${String(nr).padStart(2)} ✓ ${titel}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (e) {
		fehler.push(`${titel}: ${e.message}`);
		console.log(`  ${String(nr).padStart(2)} ✗ ${titel} — ${e.message}`);
		await seite
			.screenshot({ path: `${AUFNAHMEN}/fehler-${String(nr).padStart(2, '0')}.png` })
			.catch(() => {});
	}
}

await mkdir(AUFNAHMEN, { recursive: true });
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1440, height: 1900 } });
warteNachNavigation(seite);

/**
 * Abschicken und auf die Wirkung warten, auch auf die Hydration nach dem
 * Neuladen (Codeprüfung 07.10.2026): `warteNachNavigation` deckt nur `goto`.
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
	return antwort;
}

async function gehe(pfad) {
	await seite.goto(`${ZIEL}${pfad}`, { waitUntil: 'load' });
	await seite.waitForTimeout(250);
}

const meldung = async () =>
	(await seite.locator('.meldung').first().innerText().catch(() => ''))
		.replace(/\s+/g, ' ')
		.trim();

/** Welche Gemeinschaften im Anlegeformular angekreuzt sind, als Kennungen. */
const angekreuzteNeu = () =>
	seite
		.locator('form#neu input[name="meetings"]')
		.evaluateAll((k) => k.filter((x) => x.checked).map((x) => x.value));

try {
	let tag;
	let meetings = [];

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

	await schritt('Ein Abend mit drei eigenen Gemeinschaften', async () => {
		const ids = [];
		for (let n = 1; n <= 3; n += 1) {
			await gehe('/gemeinschaften/neu');
			await seite.fill('input[name="name"]', `Absagehaus ${n} Prüflauf ${LAUF}`);
			await seite.fill('input[name="quotaDenominator"]', '1000');
			await seite.locator('input[name="headCountMode"][value="per_owner"]').check();
			await abschicken(seite.locator('main button[type="submit"]').first());
			const id = seite.url().split('/gemeinschaften/')[1]?.split(/[/?#]/)[0];
			behaupte(id && id !== 'neu', `Haus ${n} nicht angelegt: ${seite.url()}`);
			ids.push(id);
		}
		await gehe('/versammlungen/neu');
		await seite.locator('input[name="art"][value="gemeinsam"]').check();
		await seite.fill('input[name="bezeichnung"]', `Absage Prüflauf ${LAUF}`);
		await seite.fill('input[name="datum"]', TAG);
		await seite.fill('input[name="uhrzeit"]', '18:30');
		await seite.fill('input[name="ort"]', `Saal Prüflauf ${LAUF}`);
		for (const id of ids) {
			await seite.locator(`input[name="gemeinschaft"][value="${id}"]`).check();
		}
		await abschicken(seite.locator('button[form="anlegen"]'));
		behaupte(seite.url().includes('/tage/'), `Abend nicht angelegt: ${seite.url()}`);
		tag = seite.url().split('/tage/')[1].split(/[/?#]/)[0];
		await gehe(`/tage/${tag}/geschaefte`);
		await seite.locator('button', { hasText: 'Traktandum hinzufügen' }).first().click();
		await seite.waitForTimeout(250);
		meetings = await seite
			.locator('form#neu input[name="meetings"]')
			.evaluateAll((k) => k.map((x) => x.value));
		behaupte(meetings.length === 3, `${meetings.length} Gemeinschaften zur Wahl statt 3`);
		return `Abend ${tag}`;
	});

	await schritt('Kenntnisnahme mit Wortlaut, nur das zweite Haus: alles kommt zurück', async () => {
		await seite.fill('form#neu input[name="titel"]', `Bericht Prüflauf ${LAUF}`);
		await seite.locator('form#neu select[name="art"]').selectOption('kenntnisnahme');
		await seite.fill('form#neu input[name="antragswortlaut"]', 'Der Bericht sei zu genehmigen.');
		await seite.locator(`form#neu input[name="meetings"][value="${meetings[0]}"]`).uncheck();
		await seite.locator(`form#neu input[name="meetings"][value="${meetings[2]}"]`).uncheck();
		await abschicken(seite.locator('button[form="neu"]'));

		behaupte(/Kenntnisnahme/.test(await meldung()), `Keine Absage zur Kenntnisnahme: «${await meldung()}»`);
		behaupte(
			(await seite.locator('form#neu').count()) === 1,
			'Das Anlegeformular ist nach der Absage zugeklappt'
		);
		const titel = await seite.locator('form#neu input[name="titel"]').inputValue();
		behaupte(titel === `Bericht Prüflauf ${LAUF}`, `Titel «${titel}»`);
		const art = await seite.locator('form#neu select[name="art"]').inputValue();
		behaupte(art === 'kenntnisnahme', `Art steht auf «${art}»`);
		const wortlaut = await seite.locator('form#neu input[name="antragswortlaut"]').inputValue();
		behaupte(wortlaut === 'Der Bericht sei zu genehmigen.', `Wortlaut «${wortlaut}»`);
		const an = await angekreuzteNeu();
		behaupte(
			an.length === 1 && an[0] === meetings[1],
			`Angekreuzt ${an.length} statt nur das zweite Haus`
		);
		return 'Art, Wortlaut, ein Haus';
	});

	let fall = '';
	let fallTitel = '';
	await schritt('Abstimmung mit Fall und zu kurzem Wortlaut, erstes und drittes Haus', async () => {
		await seite.locator('form#neu select[name="art"]').selectOption('abstimmung');
		await seite.waitForTimeout(150);
		[fall, fallTitel] = await seite
			.locator('form#neu select[name="erfordernis"] option')
			.evaluateAll((o) => {
				const x = o.find((y) => y.value !== '' && y.value !== 'k-kenntnisnahme');
				return x ? [x.value, x.textContent.split('·')[0].trim()] : ['', ''];
			});
		behaupte(fall, 'Kein Fall zur Wahl');
		await seite.locator('form#neu select[name="erfordernis"]').selectOption(fall);
		await seite.fill('form#neu input[name="antragswortlaut"]', 'ja');
		await seite.locator(`form#neu input[name="meetings"][value="${meetings[0]}"]`).check();
		await seite.locator(`form#neu input[name="meetings"][value="${meetings[1]}"]`).uncheck();
		await seite.locator(`form#neu input[name="meetings"][value="${meetings[2]}"]`).check();
		await abschicken(seite.locator('button[form="neu"]'));

		behaupte(/Antragswortlaut/.test(await meldung()), `Keine Absage zum Wortlaut: «${await meldung()}»`);
		behaupte((await seite.locator('form#neu').count()) === 1, 'Formular zugeklappt');
		const art = await seite.locator('form#neu select[name="art"]').inputValue();
		behaupte(art === 'abstimmung', `Art steht auf «${art}»`);
		const gewaehlt = await seite.locator('form#neu select[name="erfordernis"]').inputValue();
		behaupte(gewaehlt === fall, `Fall «${gewaehlt}» statt «${fall}»`);
		const an = await angekreuzteNeu();
		behaupte(
			an.length === 2 && an.includes(meetings[0]) && an.includes(meetings[2]),
			`Angekreuzt ${an.length} statt das erste und dritte Haus`
		);
		return `Fall ${fall}, zwei Häuser`;
	});

	/*
	 * **Ein Ziehen dazwischen ersetzt `form`** (Codeprüfung 07.10.2026). Das
	 * versteckte Formular «verschieben» schickt über `use:enhance` ab, wie beim
	 * Ziehen einer Zeile. Vorher sprangen die Häkchen danach auf «alle».
	 */
	await schritt('Nach einem Verschieben dazwischen bleiben die Häuser der Absage', async () => {
		const kennung = async (n) => {
			const zeile = seite.locator('ol.liste > li').nth(n);
			await zeile.locator('button', { hasText: 'Ändern' }).click();
			await seite.waitForTimeout(200);
			const id = await seite.locator('form[action="?/aendern"] input[name="geschaeft"]').inputValue();
			await seite.locator('button', { hasText: 'Schliessen' }).first().click();
			await seite.waitForTimeout(200);
			return id;
		};
		const erste = await kennung(0);
		const zweite = await kennung(1);
		const [antwort] = await Promise.all([
			seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 30000 }),
			seite.evaluate(
				([g, v]) => {
					const f = document.querySelector('form[action="?/verschieben"]');
					f.querySelector('input[name="geschaeft"]').value = g;
					f.querySelector('input[name="vor"]').value = v;
					f.requestSubmit();
				},
				[zweite, erste]
			)
		]);
		behaupte(antwort.ok(), `Verschieben antwortete ${antwort.status()}`);
		await seite.waitForTimeout(600);
		const an = await angekreuzteNeu();
		behaupte(
			an.length === 2 && an.includes(meetings[0]) && an.includes(meetings[2]),
			`Nach dem Verschieben angekreuzt: ${an.length}`
		);
		const art = await seite.locator('form#neu select[name="art"]').inputValue();
		behaupte(art === 'abstimmung', `Art nach dem Verschieben «${art}»`);
		return 'zwei Häuser, Art steht';
	});

	await schritt('Nach der Korrektur wird genau so angelegt', async () => {
		await seite.fill('form#neu input[name="antragswortlaut"]', 'Der Antrag sei anzunehmen.');
		await abschicken(seite.locator('button[form="neu"]'));
		// Die Zeile, nicht die Meldung: Die verblasst und ist beim Lesen schon weg.
		const zeile = seite.locator('ol.liste > li', { hasText: `Bericht Prüflauf ${LAUF}` }).first();
		await zeile.waitFor({ timeout: 10_000 });
		const kopf = (await zeile.innerText()).replace(/\s+/g, ' ');
		behaupte(/2 Gemeinschaften/.test(kopf), `Nicht in zwei Gemeinschaften: «${kopf}»`);
		behaupte(kopf.includes(fallTitel), `Fall «${fallTitel}» fehlt: «${kopf}»`);
		// Die Ziffern aufklappen: Dort stehen die Häuser und der Wortlaut.
		await zeile.locator('button', { hasText: 'Ziffern zeigen' }).click();
		await seite.waitForTimeout(250);
		// Die Ziffern tragen die Nummer des Punkts mit Unterzählung («9.1»).
		const nummer = kopf.match(/(\d+) Bericht Prüflauf/)?.[1];
		const ziffern = (
			await seite
				.locator('ol.liste > li')
				.filter({ hasText: new RegExp(`^\\s*\\S*\\s*${nummer}\\.\\d`) })
				.allInnerTexts()
		)
			.join(' | ')
			.replace(/\s+/g, ' ');
		behaupte(
			/Absagehaus 1 /.test(ziffern) && /Absagehaus 3 /.test(ziffern),
			`Nicht im ersten und dritten Haus: «${ziffern}»`
		);
		behaupte(!/Absagehaus 2 /.test(ziffern), `Auch im zweiten Haus: «${ziffern}»`);
		behaupte(/Der Antrag sei anzunehmen\./.test(ziffern), `Wortlaut fehlt: «${ziffern}»`);
		return 'erstes und drittes Haus, Fall und Wortlaut';
	});

	await schritt('Ändern: Kenntnisnahme mit Wortlaut kommt mit allen Feldern zurück', async () => {
		const zeile = seite.locator('ol.liste > li', { hasText: `Bericht Prüflauf ${LAUF}` }).first();
		await zeile.locator('button', { hasText: 'Ändern' }).click();
		await seite.waitForTimeout(250);
		const form = seite.locator('form[action="?/aendern"]');
		behaupte((await form.count()) === 1, 'Kein Änderungsformular');
		await form.locator('input[name="titel"]').fill(`Geänderter Bericht ${LAUF}`);
		await form.locator('select[name="art"]').selectOption('kenntnisnahme');
		await abschicken(seite.locator('button', { hasText: 'Text speichern' }).first());

		behaupte(/Kenntnisnahme/.test(await meldung()), `Keine Absage: «${await meldung()}»`);
		const nachher = seite.locator('form[action="?/aendern"]');
		behaupte((await nachher.count()) === 1, 'Das Änderungsformular ist nach der Absage zu');
		const titel = await nachher.locator('input[name="titel"]').inputValue();
		behaupte(titel === `Geänderter Bericht ${LAUF}`, `Titel «${titel}»`);
		const art = await nachher.locator('select[name="art"]').inputValue();
		behaupte(art === 'kenntnisnahme', `Art steht auf «${art}»`);
		// Der Titel der abgelehnten Änderung gehört nicht ins Anlegeformular.
		behaupte(
			(await seite.locator('form#neu').count()) === 0,
			'Das Anlegeformular ist mit aufgegangen'
		);
		return 'Titel und Art';
	});
} finally {
	await browser.close();
}

if (fehler.length > 0) {
	console.log(`\n${fehler.length} Befund(e):`);
	for (const f of fehler) console.log(`  · ${f}`);
	process.exit(1);
}
console.log(`\n${nr} Schritte, 0 Befunde.`);
