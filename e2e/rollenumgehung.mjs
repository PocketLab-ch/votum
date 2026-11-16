/**
 * Die Rollentrennung hält auch einem kodierten Pfad stand.
 *
 * **Der Anlass** (Sicherheitsdurchgang 15.09.2026). Der Wächter in
 * `hooks.server.ts` verglich den **rohen** `event.url.pathname`; SvelteKit löst
 * die Route über den **dekodierten** Pfad auf. Die beiden sahen verschiedene
 * Dinge, und ein einziges kodiertes Zeichen hob die ganze Rollentrennung auf.
 * Gemessen mit einem Konto der Rolle «Sitzungsleitung»:
 *
 *   POST /gemeinschaften       → 403, gesperrt
 *   POST /%67emeinschaften     → Aktion lief          («%67» ist ein «g»)
 *
 * Betroffen war jeder Schreibweg unter `/gemeinschaften`, `/betreiber` und
 * `/personen`: Wertquoten ändern, Konten anlegen, Gemeinschaften entfernen.
 * Genau die Trennung, die am 04.08.2026 eingezogen wurde, weil vorher «wer ein
 * Konto hatte, Wertquoten ändern konnte».
 *
 * **Warum das ein Durchstich sein muss und kein Test.** Der Wächter in
 * `tests/waechter/rollenanker.test.ts` hält die Bauart — dass die Rollenprüfung
 * die aufgelöste Route heranzieht. Ob die Absage beim Betreiber tatsächlich
 * ankommt, hängt an SvelteKits Auflösung, am Hakenwerk und an der Reihenfolge
 * der Wächter. Das entscheidet sich erst am laufenden Stand.
 *
 * **Warum das Konto hier angelegt und wieder abgeräumt wird.** Ein Durchstich,
 * der ein vorhandenes Konto voraussetzt und sonst still überspringt, ist grün,
 * weil er nichts tut. Die gefährliche Hälfte wäre dann ungeprüft.
 *
 * **Am gebauten Stand seit dem 15.10.2026 (V5).** Dort ist SvelteKits Schutz
 * gegen fremde Formulare aktiv (`!__SVELTEKIT_DEV__`); die POSTs dieses
 * Durchstichs tragen deshalb die Herkunftskopfzeile mit, sonst käme die
 * CSRF-Absage vor jeder Rollenprüfung:
 *
 *   IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
 *        $(docker compose ps -q app))
 *   ZIEL=http://$IP:3101 node e2e/rollenumgehung.mjs
 *
 * Aufruf: `node e2e/rollenumgehung.mjs` (Entwicklungsserver).
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);

/* Eigenes Konto je Lauf: Zwei Läufe nebeneinander sollen sich nicht stören. */
const MARKE = Date.now().toString().slice(-8);
const CHAIR = `pruefleitung${MARKE}`;
const CHAIRKENNWORT = `Pruef-Leitung-${MARKE}-xZq`;

/**
 * Die Wege, die ein Aufruf nehmen kann — roh und mit einem kodierten Zeichen.
 *
 * Mehr als einer, weil eine Behebung, die nur `%67` abfängt, keine Behebung
 * wäre: Kodieren lässt sich jedes Zeichen, und auch mehrfach.
 */
const WEGE = [
	['roh            ', '/gemeinschaften'],
	['g kodiert      ', '/%67emeinschaften'],
	['n kodiert      ', '/gemeinschafte%6e'],
	['zweimal kodiert', '/%67emeinschafte%6e']
];

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
	}
}

async function anmelden(seite, benutzer, kennwort) {
	await seite.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
	await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
	await seite.fill('input[name="username"]', benutzer);
	await seite.fill('input[name="kennwort"]', kennwort);
	await seite.click('main button[type="submit"]');
	await seite.waitForTimeout(2000);
	return !seite.url().includes('/anmelden');
}

/** Was ein POST auf diesen Pfad bewirkt: gesperrt, durchgekommen, oder sonst. */
async function versuch(seite, pfad) {
	const a = await seite.request.post(`${ZIEL}${pfad.replace(/\?.*$/, '')}?/sammelArchivieren`, {
		form: {},
		/*
		 * **Die Herkunft gehört mit, seit dieser Durchstich auch am gebauten
		 * Stand läuft** (V5, 15.10.2026). SvelteKits Schutz gegen fremde
		 * Formulare steht hinter `!__SVELTEKIT_DEV__`; ohne `origin` bekäme
		 * hier JEDER POST die CSRF-Absage, und die Rollenschranke wäre gar
		 * nicht mehr die Ursache des 403. Die Gegenhälfte («die Verwaltung
		 * kommt durch») fiele dann aus dem falschen Grund: Gemessen wäre die
		 * Herkunftssperre, nicht die Rollentrennung.
		 */
		headers: { origin: ZIEL },
		failOnStatusCode: false
	});
	const text = (await a.text()).slice(0, 400);
	if (a.status() === 403 || /vorbehalten/i.test(text)) return 'gesperrt';
	if (/sammel|Nichts ausgewählt/i.test(text)) return 'DURCHGEKOMMEN';
	if (a.status() === 404) return 'keine Route';
	return `unklar (HTTP ${a.status()})`;
}

const browser = await chromium.launch();
let kontoAngelegt = false;
try {
	const verwaltung = await browser.newContext();
	const admin = await verwaltung.newPage();
	console.log(`\nRollentrennung gegen kodierte Pfade — ${ZIEL}\n`);

	await schritt('Als Verwaltung anmelden', async () => {
		behaupte(await anmelden(admin, BENUTZER, KENNWORT), 'Anmeldung nicht durchgekommen');
		return `als ${BENUTZER}`;
	});

	await schritt('Ein Konto der Rolle Sitzungsleitung anlegen', async () => {
		await admin.goto(`${ZIEL}/betreiber/benutzer`, { waitUntil: 'domcontentloaded' });
		await admin.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		const formular = admin.locator('form[action="?/anlegen"]');
		behaupte(await formular.count(), 'Kein Formular «Konto anlegen» — fehlt das Recht?');
		await formular.locator('input[name="displayName"]').fill('Prüflauf Sitzungsleitung');
		await formular.locator('input[name="username"]').fill(CHAIR);
		await formular.locator('select[name="rolle"]').selectOption('chair');
		await formular.locator('input[name="kennwort"]').fill(CHAIRKENNWORT);
		const wdh = formular.locator('input[name="wiederholung"]');
		if (await wdh.count()) await wdh.fill(CHAIRKENNWORT);
		await formular.locator('button[type="submit"]').first().click();
		await admin.waitForTimeout(1500);
		kontoAngelegt = true;
		return CHAIR;
	});

	const leitung = await browser.newContext();
	const chair = await leitung.newPage();

	await schritt('Als Sitzungsleitung anmelden', async () => {
		behaupte(
			await anmelden(chair, CHAIR, CHAIRKENNWORT),
			'Anmeldung der Sitzungsleitung nicht durchgekommen — wurde das Konto angelegt?'
		);
		return `als ${CHAIR}`;
	});

	await schritt('Die Sitzungsleitung kommt auf KEINEM Weg durch', async () => {
		const ergebnisse = [];
		for (const [name, pfad] of WEGE) {
			const ausgang = await versuch(chair, pfad);
			ergebnisse.push(`${name}: ${ausgang}`);
			behaupte(
				ausgang !== 'DURCHGEKOMMEN',
				`Über «${pfad}» kommt die Sitzungsleitung an eine Verwaltungsaktion — ` +
					'die Rollentrennung ist offen'
			);
		}
		return ergebnisse.join(' | ');
	});

	await schritt('Auch /versammlungen ist der Verwaltung vorbehalten', async () => {
		/*
		 * **Diese Schranke sitzt nicht im zentralen Wächter, sondern in der
		 * Aktion** (Vorgabe des Auftraggebers, 15.09.2026: «Nur die Verwaltung»).
		 * `/versammlungen` steht bewusst nicht in `VERWALTUNGSBEREICHE`: Unter
		 * dem Pfad liegen 99 schreibende Handlungen, davon 32 allein in der
		 * Sitzungsleitung. Wer den Bereich pauschal einträgt, nimmt ihr das
		 * Leiten.
		 *
		 * Eine Schranke an einer einzelnen Aktion ist leichter zu vergessen als
		 * eine am Pfad — deshalb steht sie hier im Durchstich und nicht nur im
		 * Kommentar.
		 */
		const ausgang = await versuch(chair, '/versammlungen');
		behaupte(
			ausgang !== 'DURCHGEKOMMEN',
			'Die Sitzungsleitung kommt an die Sammelarchivierung der Versammlungen'
		);
		return ausgang;
	});

	await schritt('Auch der EINZELWEG einer Versammlung ist gesperrt', async () => {
		/*
		 * **Die Lücke, die der Sammelweg allein offenliess** (Sicherheits-
		 * durchgang 15.09.2026). Eine Schranke nur an der bequemen Handlung ist
		 * eine Aussage über die Oberfläche: Wer am Sammelweg sein 403 bekommt,
		 * holt sich die Kennungen aus der Liste — Lesen steht der Sitzungsleitung
		 * offen — und setzt N einzelne Aufrufe ab. Dieselbe Wirkung, ein Umweg.
		 *
		 * Geprüft wird an einer beliebigen Kennung aus der Liste. Ob die
		 * Versammlung archivierbar wäre, spielt keine Rolle: Die Rollenschranke
		 * greift vor jeder fachlichen Prüfung, sonst verriete schon die Absage,
		 * dass der Aufruf angekommen ist.
		 */
		await chair.goto(`${ZIEL}/versammlungen`, { waitUntil: 'domcontentloaded' });
		await chair.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		const verweise = await chair
			.locator('a[href^="/versammlungen/"]')
			.evaluateAll((as) =>
				[
					...new Set(
						as
							.map((a) => a.getAttribute('href'))
							.filter((h) => /^\/versammlungen\/[0-9a-f-]{36}$/.test(h ?? ''))
					)
				]
			);
		behaupte(
			verweise.length > 0,
			'Keine Versammlung in der Liste — dieser Schritt misst dann nichts'
		);

		const ergebnisse = [];
		for (const aktion of ['archivieren', 'hervorholen']) {
			const a = await chair.request.post(`${ZIEL}${verweise[0]}?/${aktion}`, {
				form: {},
				// Die Herkunft gehört mit, siehe `versuch` oben.
				headers: { origin: ZIEL },
				failOnStatusCode: false
			});
			const text = (await a.text()).slice(0, 300);
			const gesperrt = a.status() === 403 || /vorbehalten/i.test(text);
			ergebnisse.push(`${aktion}: ${gesperrt ? 'gesperrt' : `OFFEN (HTTP ${a.status()})`}`);
			behaupte(
				gesperrt,
				`Die Sitzungsleitung kommt über den Einzelweg an «${aktion}» — ` +
					'die Schranke am Sammelweg ist dann wirkungslos'
			);
		}
		return ergebnisse.join(' | ');
	});

	await schritt('Und /personen ebenso', async () => {
		const ausgang = await versuch(chair, '/personen');
		behaupte(
			ausgang !== 'DURCHGEKOMMEN',
			'Die Sitzungsleitung kommt an die Sammelarchivierung der Personen'
		);
		return ausgang;
	});

	await schritt('Die Seite der Lesarten öffnet der Sitzungsleitung nichts weiter', async () => {
		/*
		 * **Die einzige Ausnahme im Wächter unter `/gemeinschaften` ausser den
		 * Versammlungen** (Migration 169, `rollen.ts`). Der Pfad `…/lesarten`
		 * lässt die Sitzungsleitung durch, damit sie umstellen kann, wenn die
		 * Gemeinschaft es erlaubt; die Aktion prüft das selbst. Gemessen wird an
		 * der Vorgabe «nur die Verwaltung»: Dann muss die Aktion absagen. Und die
		 * Einstellung, wer umstellen darf, liegt auf der Reglementsseite und
		 * bleibt gesperrt, auch kodiert. Nur Absagen: Der Schritt prüft vorher,
		 * dass die Gemeinschaft auf der Vorgabe steht, und ändert dann nichts,
		 * solange die Schranke im Code hält.
		 *
		 * **Die Antwort als Seite anfordern** (Codeprüfung Teil 2): Ohne `accept`
		 * schickt Playwright `*\/*`, SvelteKit behandelt das als Aufruf aus
		 * `use:enhance` und meldet ein `fail(403)` als HTTP 200 mit JSON. Die
		 * Absage käme an, der Schritt sähe sie nicht.
		 */
		await chair.goto(`${ZIEL}/gemeinschaften`, { waitUntil: 'domcontentloaded' });
		await chair.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		const kennung = await chair
			.locator('a[href^="/gemeinschaften/"]')
			.evaluateAll((as) =>
				as
					.map((a) => /^\/gemeinschaften\/([0-9a-f-]{36})$/.exec(a.getAttribute('href') ?? '')?.[1])
					.find(Boolean)
			);
		behaupte(kennung, 'Keine Gemeinschaft in der Liste, dieser Schritt misst dann nichts');
		await chair.goto(`${ZIEL}/gemeinschaften/${kennung}/lesarten`, { waitUntil: 'domcontentloaded' });
		behaupte(
			/Wer umstellen darf:\s*Nur die Verwaltung/.test(await chair.locator('main').innerText()),
			'Die Gemeinschaft erlaubt der Sitzungsleitung das Umstellen schon; dieser Schritt misst ' +
				'dann nicht die Absage und würde Dev-Daten ändern'
		);

		const ergebnisse = [];
		const lesart = await chair.request.post(`${ZIEL}/gemeinschaften/${kennung}/lesarten?/lesarten`, {
			form: { L4: 'qualifiziert' },
			headers: { origin: ZIEL, accept: 'text/html' },
			failOnStatusCode: false
		});
		const lesartText = await lesart.text();
		// Der Wortlaut der Absage, nicht der Satz «Nur die Verwaltung», der immer auf der Seite steht.
		const abgesagt = lesart.status() === 403 && /stellt nur die Verwaltung um/.test(lesartText);
		ergebnisse.push(`lesarten: ${abgesagt ? 'abgesagt' : `OFFEN (HTTP ${lesart.status()})`}`);
		behaupte(
			abgesagt,
			'Die Sitzungsleitung stellt eine Lesart um, obwohl nur die Verwaltung darf'
		);

		for (const pfad of [
			`/gemeinschaften/${kennung}/reglement`,
			`/%67emeinschaften/${kennung}/reglement`,
			`/gemeinschaften/${kennung}/%72eglement`
		]) {
			const a = await chair.request.post(`${ZIEL}${pfad}?/lesartenrecht`, {
				form: { recht: 'verwaltung_und_leitung' },
				headers: { origin: ZIEL, accept: 'text/html' },
				failOnStatusCode: false
			});
			const text = (await a.text()).slice(0, 400);
			const gesperrt = a.status() === 403 || /vorbehalten/i.test(text);
			ergebnisse.push(`${pfad.split('/').slice(3).join('/')}: ${gesperrt ? 'gesperrt' : `OFFEN (HTTP ${a.status()})`}`);
			behaupte(gesperrt, `Über «${pfad}» legt die Sitzungsleitung fest, wer umstellen darf`);
		}
		return ergebnisse.join(' | ');
	});

	await schritt('Die Verwaltung kommt weiterhin durch', async () => {
		/*
		 * **Die Gegenrichtung, und sie ist die wichtigere Hälfte.** Ein Riegel,
		 * der alle aussperrt, bestünde den Schritt darüber ebenfalls. Erst
		 * zusammen sagen die beiden etwas: gesperrt für die einen, offen für die
		 * anderen.
		 */
		const ergebnisse = [];
		for (const pfad of ['/gemeinschaften', '/personen', '/versammlungen']) {
			const ausgang = await versuch(admin, pfad);
			ergebnisse.push(`${pfad}: ${ausgang}`);
			behaupte(
				ausgang === 'DURCHGEKOMMEN',
				`Die Verwaltung kommt nicht mehr an ${pfad}: ${ausgang}`
			);
		}
		return ergebnisse.join(' | ');
	});

	await schritt('Aufräumen: das Prüfkonto ausser Dienst stellen', async () => {
		/*
		 * Konten werden nicht gelöscht, sondern ausser Dienst gestellt — der
		 * Verlauf verweist auf sie. Ein Konto, das nach dem Lauf noch anmelden
		 * könnte, wäre ein Zugang, den niemand bestellt hat.
		 */
		await admin.goto(`${ZIEL}/betreiber/benutzer`, { waitUntil: 'domcontentloaded' });
		await admin.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		/*
		 * **Die Zeile ist zugeklappt.** Die Handlungen an einem Konto stehen hinter
		 * «Ändern» — richtig so, sie sind selten und stünden sonst dreissigmal
		 * untereinander. Der erste Anlauf dieses Schrittes suchte das Formular
		 * ohne den Klick, fand nichts und liess das Prüfkonto im Dienst stehen.
		 */
		const zeile = admin.locator('li', { hasText: CHAIR }).first();
		behaupte(await zeile.count(), `Die Zeile «${CHAIR}» steht nicht in der Liste`);
		const aufklappen = zeile.getByRole('button', { name: 'Ändern' });
		if (await aufklappen.count()) {
			await aufklappen.first().click();
			await admin.waitForTimeout(400);
		}

		const form = zeile.locator('form[action="?/dienst"]:has(input[value="ja"])');
		behaupte(await form.count(), `Kein Weg, «${CHAIR}» ausser Dienst zu stellen`);
		await form.locator('button[type="submit"]').first().click();
		await admin.waitForTimeout(1500);

		const zweiter = await browser.newContext();
		const probe = await zweiter.newPage();
		const kommtRein = await anmelden(probe, CHAIR, CHAIRKENNWORT);
		await zweiter.close();
		behaupte(!kommtRein, `«${CHAIR}» kann sich weiterhin anmelden`);
		kontoAngelegt = false;
		return 'ausser Dienst, Anmeldung gesperrt';
	});
} finally {
	await browser.close();
}

console.log('');
if (kontoAngelegt) {
	console.log(`  Achtung: Das Prüfkonto «${CHAIR}» steht noch im Dienst.`);
}
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün.`);
