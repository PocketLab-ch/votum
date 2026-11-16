/**
 * Die Erstverknüpfung mit Authentik, wie die Verwaltung sie bedient.
 *
 * **Was dieser Durchstich NICHT prüft, und warum.** Den Anmeldefluss selbst.
 * Dafür bräuchte es ein echtes Konto im Authentik-Verzeichnis und einen Browser,
 * der dorthin umgeleitet wird; auf dem Entwicklungsstand ist kein Testkonto
 * hinterlegt, und die Verknüpfungslogik liegt ohnehin in
 * `tests/db/kontoverknuepfung.test.ts` am echten Riegel. Hier geht es um die
 * andere Hälfte: das, was ein Mensch anfasst.
 *
 * **Gemessen wird die Wirkung, nie die Meldung.** Eine Erfolgsmeldung kommt auch
 * dann, wenn dahinter nichts passiert ist — der teuerste Irrtum dieses Hauses.
 * Jeder Schritt unten liest deshalb die Kontozeile nach und vergleicht, was
 * dort steht.
 *
 * Aufruf: `node e2e/kontoverknuepfung.mjs`
 */
import { fileURLToPath } from 'node:url';
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';

import { zugang } from './zugang.mjs';
/** Das Repo dieses Drehbuchs; dort liegt die Compose-Datei des Dev-Stapels. */
const REPO = fileURLToPath(new URL('..', import.meta.url));

const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);

const MARKE = Date.now().toString().slice(-8);
const MIT = `prueflauf-mit${MARKE}`;
const OHNE = `prueflauf-ohne${MARKE}`;
const ZWEIT = `prueflauf-zweit${MARKE}`;
const ADRESSE = `prueflauf.${MARKE}@example.ch`;
const KENNSATZ = `Pruef-Satz-${MARKE}-xZq`;

let nr = 0;
const fehler = [];
const angelegt = [];

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

async function zurListe(seite) {
	await seite.goto(`${ZIEL}/betreiber/benutzer`, { waitUntil: 'domcontentloaded' });
	await seite.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
}

/** Die Kontozeile zu einem Benutzernamen — genau eine, sonst ist etwas faul. */
async function zeile(seite, username) {
	const treffer = seite.locator('.konten li', { hasText: username });
	const anzahl = await treffer.count();
	behaupte(anzahl === 1, `${anzahl} Zeilen für «${username}», erwartet genau eine`);
	return treffer.first();
}

/** Die Kennung eines Kontos, wie sie in den Formularen der Zeile steht. */
async function kontoKennung(seite, username) {
	const z = await aufklappen(seite, username);
	return z.locator('input[name="konto"]').first().inputValue();
}

/** Der Text einer Kontozeile, zusammengezogen. */
async function zeilentext(seite, username) {
	return ((await (await zeile(seite, username)).innerText()) ?? '').replace(/\s+/g, ' ');
}

/**
 * Was im Meldungsband steht — Absage wie Quittung.
 *
 * **Warum das hier trotz allem gemessen wird.** Sonst lässt sich nicht
 * unterscheiden, WER abgewiesen hat. Eine Schranke der Anwendung antwortet mit
 * einem Satz, ein eindeutiger Index der Datenbank mit einer rohen 500 — beide
 * verhindern dasselbe, aber nur eines davon ist eine Fehlermeldung. Gemessen am
 * 15.09.2026: Ein Durchstich, der bloss «es entstand nichts» prüft, bleibt grün,
 * während der Nutzer einen Absturz sieht.
 */
async function meldung(seite) {
	const band = seite.locator('.einblender .quittung .text, .meldung .text, [role="alert"]');
	if (!(await band.count())) return '';
	return ((await band.first().innerText()) ?? '').replace(/\s+/g, ' ');
}

/** Klappt die Zeile auf, falls sie zu ist. */
async function aufklappen(seite, username) {
	const z = await zeile(seite, username);
	const knopf = z.locator('button[aria-expanded]');
	if ((await knopf.getAttribute('aria-expanded')) !== 'true') {
		await knopf.click();
		await seite.waitForTimeout(400);
	}
	return zeile(seite, username);
}

async function kontoAnlegen(seite, u) {
	await zurListe(seite);
	const formular = seite.locator('form[action="?/anlegen"]');
	behaupte(await formular.count(), 'Kein Formular «Konto anlegen» — fehlt das Recht?');
	await formular.locator('input[name="displayName"]').fill(u.name);
	await formular.locator('input[name="username"]').fill(u.username);
	await formular.locator('input[name="email"]').fill(u.email ?? '');
	await formular.locator('select[name="rolle"]').selectOption('chair');
	await formular.locator('input[name="kennwort"]').fill(KENNSATZ);
	await formular.locator('input[name="wiederholung"]').fill(KENNSATZ);
	await formular.locator('button[type="submit"]').click();
	await seite.waitForTimeout(1800);
}

/**
 * Setzt eine Kennung unmittelbar in der Datenbank.
 *
 * **Warum nicht über den Anmeldefluss.** Der bräuchte ein echtes Konto im
 * Authentik-Verzeichnis; auf dem Entwicklungsstand ist keines hinterlegt. Der
 * Fluss selbst ist in `tests/db/kontoverknuepfung.test.ts` geprüft. Hier geht es
 * um das, was ein Mensch danach anfasst: den Weg zurück.
 */
async function kennungSetzen(username, kennung) {
	const { execFile } = await import('node:child_process');
	const { promisify } = await import('node:util');
	await promisify(execFile)(
		'docker',
		[
			'compose',
			'exec',
			'-T',
			'postgres',
			'psql',
			'-U',
			'versammlung',
			'-d',
			'versammlung',
			'-c',
			// **Das Fenster geht mit zu, genau wie im echten Fluss.** Ohne diese
			// Hälfte erzeugt der Aufbau einen Zustand, den es im Betrieb nicht gibt
			// (`setzeVerknuepfungsfenster` lehnt das Öffnen bei verknüpften Konten
			// ab, und die Erstverknüpfung schliesst es selbst). Der Schritt darunter
			// mass dann den eigenen Aufbau statt das Produkt — gemessen am
			// 16.09.2026, als er genau daran rot wurde.
			`UPDATE app_user SET oidc_subject = '${kennung}', oidc_link_until = NULL ` +
				`WHERE username = '${username}'`
		],
		{ cwd: REPO }
	);
}

const browser = await chromium.launch();
try {
	const kontext = await browser.newContext();
	const admin = await kontext.newPage();
	console.log(`\nErstverknüpfung mit Authentik — ${ZIEL}\n`);

	await schritt('Als Verwaltung anmelden', async () => {
		behaupte(await anmelden(admin, BENUTZER, KENNWORT), 'Anmeldung nicht durchgekommen');
		return `als ${BENUTZER}`;
	});

	await schritt('Die Seite bietet überhaupt ein Adressfeld', async () => {
		await zurListe(admin);
		const feld = admin.locator('form[action="?/anlegen"] input[name="email"]');
		behaupte(await feld.count(), 'Kein Feld «E-Mail-Adresse» im Anlegeformular');
		return 'vorhanden';
	});

	await schritt('Konto mit Adresse anlegen öffnet das Fenster', async () => {
		await kontoAnlegen(admin, { name: 'Prüflauf Mit Adresse', username: MIT, email: ADRESSE });
		angelegt.push(MIT);
		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(/offen bis/i.test(text), `Kein offenes Fenster in der Zeile: «${text}»`);
		return text.match(/offen bis [^|]*/i)?.[0]?.trim() ?? 'offen';
	});

	await schritt('Konto ohne Adresse bekommt kein Fenster', async () => {
		await kontoAnlegen(admin, { name: 'Prüflauf Ohne Adresse', username: OHNE, email: '' });
		angelegt.push(OHNE);
		await zurListe(admin);
		const text = await zeilentext(admin, OHNE);
		behaupte(!/offen bis/i.test(text), `Fenster offen, obwohl keine Adresse: «${text}»`);
		behaupte(/ohne Adresse/i.test(text), `Die Zeile sagt nicht, dass die Adresse fehlt: «${text}»`);
		return 'kein Fenster, und die Zeile sagt warum';
	});

	await schritt('Ohne Adresse lässt sich das Fenster nicht öffnen', async () => {
		await zurListe(admin);
		const z = await aufklappen(admin, OHNE);
		const form = z.locator('form[action="?/verknuepfung"]');
		behaupte(await form.count(), 'Kein Formular für das Fenster');
		await form.locator('button[type="submit"]').click();
		await admin.waitForTimeout(1500);

		/*
		 * **Die Zeile allein genügt hier NICHT** (gemessen am 15.09.2026). Ohne
		 * Adresse zeigt die Liste grundsätzlich kein Fenster an — auch dann nicht,
		 * wenn eines gesetzt wurde. Ein Test auf «kein offen bis» wäre also grün,
		 * während im Hintergrund ein Fenster offensteht.
		 *
		 * Deshalb zwei Messungen: die Absage, die der Mensch liest, und danach der
		 * Beweis, dass auch nichts gesetzt wurde — sichtbar, sobald die Adresse
		 * nachgetragen ist.
		 */
		const gesagt = await meldung(admin);
		behaupte(
			/Adresse/i.test(gesagt),
			`Keine Absage mit Begründung, gelesen wurde: «${gesagt || '(nichts)'}»`
		);

		await zurListe(admin);
		const nach = await aufklappen(admin, OHNE);
		const angaben = nach.locator('form[action="?/angaben"]');
		await angaben.locator('input[name="email"]').fill(`nachgetragen.${MARKE}@example.ch`);
		await angaben.locator('button[type="submit"]').click();
		await admin.waitForTimeout(1500);

		await zurListe(admin);
		const text = await zeilentext(admin, OHNE);
		behaupte(
			!/offen bis/i.test(text),
			`Es war doch ein Fenster gesetzt — sichtbar, sobald die Adresse da ist: «${text}»`
		);
		return 'abgewiesen mit Begründung, und nichts gesetzt';
	});

	await schritt('Das Fenster schliessen wirkt auf die Zeile', async () => {
		await zurListe(admin);
		const z = await aufklappen(admin, MIT);
		const form = z.locator('form[action="?/verknuepfung"]');
		behaupte(await form.count(), 'Kein Formular für das Fenster');
		behaupte(
			(await form.locator('input[name="offen"]').inputValue()) === 'nein',
			'Das Formular will öffnen, obwohl das Fenster offensteht'
		);
		await form.locator('button[type="submit"]').click();
		await admin.waitForTimeout(1500);

		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(!/offen bis/i.test(text), `Fenster steht weiterhin offen: «${text}»`);
		return 'zu';
	});

	await schritt('Und wieder öffnen ebenso', async () => {
		await zurListe(admin);
		const z = await aufklappen(admin, MIT);
		const form = z.locator('form[action="?/verknuepfung"]');
		behaupte(
			(await form.locator('input[name="offen"]').inputValue()) === 'ja',
			'Das Formular will schliessen, obwohl das Fenster zu ist'
		);
		await form.locator('button[type="submit"]').click();
		await admin.waitForTimeout(1500);

		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(/offen bis/i.test(text), `Fenster nicht wieder offen: «${text}»`);
		return 'offen';
	});

	await schritt('Den Namen ändern, wie nach einer Heirat', async () => {
		await zurListe(admin);
		const z = await aufklappen(admin, MIT);
		const form = z.locator('form[action="?/angaben"]');
		behaupte(await form.count(), 'Kein Formular für Name und Adresse');
		await form.locator('input[name="displayName"]').fill('Prüflauf Ehename');
		await form.locator('button[type="submit"]').click();
		await admin.waitForTimeout(1500);

		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(/Prüflauf Ehename/.test(text), `Der neue Name steht nicht in der Zeile: «${text}»`);
		behaupte(!/Mit Adresse/.test(text), `Der alte Name steht noch da: «${text}»`);
		return 'neuer Name in der Liste';
	});

	await schritt('Dieselbe Adresse ein zweites Mal wird abgewiesen', async () => {
		const vorher = await admin.locator('.konten li').count();
		await kontoAnlegen(admin, { name: 'Prüflauf Zweit', username: ZWEIT, email: ADRESSE });
		const gesagt = await meldung(admin);
		await zurListe(admin);

		// Gemessen wird, dass **kein zweites Konto entstanden ist** — eine Absage
		// im Meldungsband sagt nichts darüber, was die Datenbank getan hat.
		const nachher = await admin.locator('.konten li').count();
		behaupte(
			nachher === vorher,
			`Die Liste wuchs von ${vorher} auf ${nachher} — das zweite Konto entstand doch`
		);
		// **Und dass es die Anwendung war, die abgewiesen hat, nicht der Index.**
		// Beide verhindern das zweite Konto; nur eines davon nennt den Grund.
		behaupte(
			/Adresse/i.test(gesagt) && /bereits|gehört/i.test(gesagt),
			`Keine benannte Absage, gelesen wurde: «${gesagt || '(nichts)'}»`
		);
		behaupte(
			(await admin.locator('.konten li', { hasText: ZWEIT }).count()) === 0,
			`«${ZWEIT}» steht in der Liste`
		);
		return 'kein zweites Konto, Liste unverändert';
	});

	await schritt('Eine verknüpfte Kennung zeigt sich in der Zeile', async () => {
		await kennungSetzen(MIT, `kennung-durchstich-${MARKE}`);
		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(/verknüpft/i.test(text), `Die Zeile sagt nichts von einer Verknüpfung: «${text}»`);
		return 'als verknüpft ausgewiesen';
	});

	await schritt('Die Verwaltung kann die Verknüpfung lösen', async () => {
		await zurListe(admin);
		const z = await aufklappen(admin, MIT);
		const form = z.locator('form[action="?/loesen"]');
		behaupte(await form.count(), 'Kein Formular zum Lösen');
		const knopf = form.locator('button[type="submit"]');
		behaupte(!(await knopf.isDisabled()), 'Der Knopf ist gesperrt, obwohl ein Kennwort besteht');
		await knopf.click();
		await admin.waitForTimeout(1500);

		// Gemessen wird die Zeile, nicht die Meldung.
		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(!/verknüpft/i.test(text), `Die Zeile weist weiter eine Verknüpfung aus: «${text}»`);
		return 'gelöst, Zeile nachgezogen';
	});

	await schritt('Das Lösen öffnet kein Anmeldefenster', async () => {
		await zurListe(admin);
		const text = await zeilentext(admin, MIT);
		behaupte(
			!/offen bis/i.test(text),
			`Nach dem Lösen steht ein Fenster offen, das niemand geöffnet hat: «${text}»`
		);
		return 'Fenster bleibt zu';
	});

	await schritt('Ohne Kennwort ist der Knopf gesperrt', async () => {
		// Ein Konto, das ausschliesslich über Authentik hereinkäme.
		await kennungSetzen(OHNE, `kennung-ohnekennwort-${MARKE}`);
		const { execFile } = await import('node:child_process');
		const { promisify } = await import('node:util');
		await promisify(execFile)(
			'docker',
			[
				'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'versammlung', '-d', 'versammlung',
				'-c', `UPDATE app_user SET password_hash = NULL WHERE username = '${OHNE}'`
			],
			{ cwd: REPO }
		);

		await zurListe(admin);
		const z = await aufklappen(admin, OHNE);
		const knopf = z.locator('form[action="?/loesen"] button[type="submit"]');
		behaupte(await knopf.count(), 'Kein Knopf zum Lösen');
		behaupte(
			await knopf.isDisabled(),
			'Der Knopf ist offen, obwohl das Konto ohne Verknüpfung unerreichbar würde'
		);
		return 'gesperrt, wie es sein muss';
	});

	await schritt('Und der Server weist es auch ohne Oberfläche ab', async () => {
		// **Die Sperre am Knopf ist Oberfläche.** Ein Aufruf ohne Browser umgeht
		// sie; erst die Absage des Servers ist die Schranke.
		const antwort = await admin.request.post(`${ZIEL}/betreiber/benutzer?/loesen`, {
			form: { konto: await kontoKennung(admin, OHNE) },
			headers: { origin: ZIEL },
			failOnStatusCode: false
		});
		const text = await antwort.text();
		behaupte(
			/kein Kennwort|ausser Dienst/i.test(text),
			`Der Server nahm es an oder schwieg: HTTP ${antwort.status()}`
		);

		await zurListe(admin);
		const zeilentext2 = await zeilentext(admin, OHNE);
		behaupte(
			/verknüpft/i.test(zeilentext2),
			`Die Verknüpfung ist trotzdem weg: «${zeilentext2}»`
		);
		return 'abgewiesen, Verknüpfung steht';
	});

	await schritt('Auf «Mein Konto» steht der eigene Stand', async () => {
		await admin.goto(`${ZIEL}/konto`, { waitUntil: 'domcontentloaded' });
		await admin.waitForSelector('html[data-bereit="1"]', { timeout: 45000 }).catch(() => {});
		const text = (await admin.locator('main').innerText()).replace(/\s+/g, ' ');
		behaupte(
			/Anmeldung über Authentik/i.test(text),
			'Der Abschnitt zur Verknüpfung fehlt auf der eigenen Kontoseite'
		);
		behaupte(
			/Nicht verknüpft|Verknüpft/i.test(text),
			`Kein Stand genannt: «${text.slice(0, 200)}»`
		);
		return 'Stand sichtbar';
	});

	for (const username of angelegt) {
		await schritt(`Aufräumen: «${username}» ausser Dienst stellen`, async () => {
			await zurListe(admin);
			const z = await aufklappen(admin, username);
			const form = z.locator('form[action="?/dienst"]');
			behaupte(await form.count(), 'Kein Weg, das Konto ausser Dienst zu stellen');
			await form.locator('button[type="submit"]').click();
			await admin.waitForTimeout(1500);

			const zweiter = await browser.newContext();
			const probe = await zweiter.newPage();
			const kommtRein = await anmelden(probe, username, KENNSATZ);
			await zweiter.close();
			behaupte(!kommtRein, `«${username}» kann sich weiterhin anmelden`);
			return 'ausser Dienst, Anmeldung gesperrt';
		});
	}
} finally {
	await browser.close();
}

console.log('');
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	process.exit(1);
}
console.log(`Alle ${nr} Schritte grün.`);
