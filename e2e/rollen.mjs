import { zugang } from './zugang.mjs';
/**
 * Die Rollenprobe: Hält der Wächter, was die Tabelle verspricht?
 *
 * **Warum getrennt vom Durchlauf.** `tests/domain/rollen.test.ts` prüft die
 * Entscheidungstabelle — welcher Pfad die Verwaltung verlangt. Was sie nicht
 * prüft, ist die Verdrahtung: ob `hooks.server.ts` die Tabelle überhaupt
 * fragt. Genau dort lag der Mangel bis zum 04.08.2026 — die Rollen standen in
 * der Datenbank und wurden nirgends gelesen. Ein Test, der nur die Tabelle
 * prüft, hätte auch damals grün geleuchtet.
 *
 * Deshalb echte Aufrufe gegen den laufenden Server, und ohne Browser: Es geht um
 * Kennzahlen der Antwort, nicht um Formulare.
 *
 * **Was die Probe braucht:** zwei Konten — eines mit `admin`, eines mit `chair`.
 * Fehlt das zweite, sagt der Lauf, wie es entsteht:
 *
 *   docker compose exec -e VERSAMMLUNG_PASSWORT=… app \
 *     node scripts/benutzer-anlegen.mjs pruefer-leitung "Prüfer Sitzungsleitung" chair
 *
 * **Aufruf:**
 *
 *   node e2e/rollen.mjs
 *
 * **Die Fähnchen des Sitzungskekses** (V2, Auftrag M2) prüft der Lauf gleich
 * mit: `HttpOnly`, `SameSite=Lax`, `Max-Age` der Sitzungsdauer, und `Secure`
 * genau dann, wenn das Ziel über https läuft. Über http verwürfe der Browser
 * einen Secure-Keks still, und die Anmeldung liefe im Kreis (`server/keks.ts`).
 * Das ist eine Näherung an `keksSicher()` (`server/keks.ts`), die vom Ziel aus
 * nicht zu sehen ist: Der Entwicklungsserver setzt nie `Secure`, sonst
 * entscheidet `ORIGIN`. Wo Ziel und Entscheid auseinanderfallen, gibt
 * `KEKS_SECURE=ja` oder `KEKS_SECURE=nein` die Erwartung vor, etwa
 * `KEKS_SECURE=nein` gegen den Entwicklungsstapel über seine https-Adresse.
 */
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const VERWALTUNG = process.env.BENUTZER ?? 'pruefer';
const VERWALTUNG_KENNWORT = zugang('KENNWORT');
const LEITUNG = process.env.BENUTZER_LEITUNG ?? 'pruefer-leitung';
const LEITUNG_KENNWORT = zugang('KENNWORT_LEITUNG');
/** Ob der Sitzungskeks `Secure` tragen muss; ohne Angabe folgt es dem Ziel. */
const KEKS_SECURE = (() => {
	const vorgabe = process.env.KEKS_SECURE;
	if (!vorgabe) return ZIEL.startsWith('https://');
	if (vorgabe !== 'ja' && vorgabe !== 'nein') {
		throw new Error(`KEKS_SECURE kennt nur «ja» und «nein», nicht «${vorgabe}».`);
	}
	return vorgabe === 'ja';
})();
/** `SITZUNGSDAUER_SEKUNDEN` aus `domain/anmeldeschutz.ts`. */
const SITZUNGSDAUER_SEKUNDEN = 12 * 3600;

/** Die Set-Cookie-Zeile des Sitzungskekses aus der letzten Anmeldung. */
let sitzungszeile;

let schrittzahl = 0;
const befunde = [];

async function schritt(name, arbeit) {
	schrittzahl++;
	const nummer = String(schrittzahl).padStart(2, '0');
	try {
		const ergebnis = await arbeit();
		console.log(`  ✓ ${nummer} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
	} catch (fehler) {
		console.error(`  ✗ ${nummer} ${name}\n     ${fehler.message}`);
		befunde.push(name);
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

/**
 * Anmelden und den Sitzungskeks zurückgeben.
 *
 * Mit `origin`: SvelteKit weist eine Formularanfrage ohne passende Herkunft ab.
 */
async function anmelden(benutzer, kennwort) {
	const antwort = await fetch(`${ZIEL}/anmelden`, {
		method: 'POST',
		redirect: 'manual',
		headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL },
		body: new URLSearchParams({ username: benutzer, kennwort }).toString()
	});
	const gesetzt = antwort.headers.getSetCookie?.() ?? [];
	sitzungszeile = gesetzt.find((k) => k.startsWith('versammlung_sitzung='));
	const treffer = sitzungszeile?.match(/versammlung_sitzung=([^;]+)/);
	if (!treffer || !treffer[1] || treffer[1] === 'deleted') {
		throw new Error(
			`Anmeldung als ${benutzer} misslang (Status ${antwort.status}). ` +
				'Gibt es das Konto, und stimmt das Kennwort?'
		);
	}
	return `versammlung_sitzung=${treffer[1]}`;
}

/** Die Fähnchen einer Set-Cookie-Zeile, klein geschrieben, mit ihren Werten. */
function faehnchen(zeile) {
	return new Map(
		zeile
			.split(';')
			.slice(1)
			.map((teil) => {
				const [name, ...wert] = teil.trim().split('=');
				return [name.toLowerCase(), wert.join('=')];
			})
	);
}

/** Prüft `Secure` gegen die Erwartung und gibt eine kurze Auskunft zurück. */
function pruefeSecure(f, zeile) {
	behaupte(
		f.has('secure') === KEKS_SECURE,
		KEKS_SECURE
			? `Der Keks trägt kein Secure, obwohl das Ziel über https läuft: ${zeile}`
			: `Der Keks trägt Secure über http; der Browser verwürfe ihn still: ${zeile}`
	);
	return KEKS_SECURE ? 'Secure' : 'ohne Secure (http)';
}

async function hole(pfad, keks) {
	const antwort = await fetch(`${ZIEL}${pfad}`, { headers: { cookie: keks }, redirect: 'manual' });
	return { status: antwort.status, inhalt: await antwort.text() };
}

async function sende(pfad, keks, felder) {
	const antwort = await fetch(`${ZIEL}${pfad}`, {
		method: 'POST',
		redirect: 'manual',
		headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, cookie: keks },
		body: new URLSearchParams(felder).toString()
	});
	return { status: antwort.status, inhalt: await antwort.text() };
}

async function main() {
	console.log(`Ziel: ${ZIEL}\n`);

	let leitung;
	let verwaltung;

	await schritt('Beide Konten melden sich an', async () => {
		verwaltung = await anmelden(VERWALTUNG, VERWALTUNG_KENNWORT);
		leitung = await anmelden(LEITUNG, LEITUNG_KENNWORT);
		return `${VERWALTUNG} (Verwaltung), ${LEITUNG} (Sitzungsleitung)`;
	});
	if (befunde.length) return;

	await schritt('Der Sitzungskeks trägt die richtigen Fähnchen', async () => {
		const f = faehnchen(sitzungszeile);
		behaupte(f.has('httponly'), `Der Keks ist für Skripte lesbar (kein HttpOnly): ${sitzungszeile}`);
		behaupte(
			f.get('samesite')?.toLowerCase() === 'lax',
			`SameSite ist nicht Lax: ${sitzungszeile}`
		);
		behaupte(
			f.get('max-age') === String(SITZUNGSDAUER_SEKUNDEN),
			`Max-Age ist nicht ${SITZUNGSDAUER_SEKUNDEN}: ${sitzungszeile}`
		);
		behaupte(f.get('path') === '/', `Path ist nicht /: ${sitzungszeile}`);
		return `HttpOnly, SameSite=Lax, Max-Age=${SITZUNGSDAUER_SEKUNDEN}, ${pruefeSecure(f, sitzungszeile)}`;
	});

	await schritt('Die Sitzungsleitung darf die Stammdaten sehen', async () => {
		const { status } = await hole('/gemeinschaften', leitung);
		behaupte(status === 200, `Die Liste antwortete mit ${status} statt 200`);
		// Ohne diesen Blick liesse sich keine Beschlussfähigkeit feststellen —
		// eine zu enge Schranke wäre im Saal schlimmer als eine zu weite.
	});

	await schritt('Die Sitzungsleitung sieht die Betreiberseite nicht', async () => {
		// **Auch das Lesen** (26.08.2026). Der Riegel fehlte hier als einzigem
		// unter /betreiber, und die Seite fuehrt betreiberweit jede versiegelte
		// Versammlung mit Ort und versiegelndem Konto. `verlangtVerwaltung`
		// steigt bei GET sofort aus — der Hook allein deckt das nicht ab, es
		// braucht die Pruefung im `load`.
		const { status, inhalt } = await hole('/betreiber', leitung);
		behaupte(status === 403, `Die Seite antwortete mit ${status} statt 403`);
		behaupte(
			inhalt.includes('Verwaltung vorbehalten'),
			`Die Absage nennt den Grund nicht: ${inhalt.slice(0, 160)}`
		);

		// Und der Menuepunkt steht ihr gar nicht erst da — ein Weg, der in eine
		// Absage fuehrt, ist schlechter als keiner.
		const liste = await hole('/gemeinschaften', leitung);
		behaupte(
			!liste.inhalt.includes('href="/betreiber"'),
			'Der Menuepunkt «Betreiber» steht der Sitzungsleitung noch im Kopfmenue'
		);

		// Gegenprobe: Die Verwaltung kommt hinein und sieht ihn.
		const v = await hole('/betreiber', verwaltung);
		behaupte(v.status === 200, `Die Verwaltung bekam ${v.status} statt 200`);
		return 'abgewiesen, Menuepunkt weg, Verwaltung unberuehrt';
	});

	await schritt('Die Sitzungsleitung darf keine Gemeinschaft anlegen', async () => {
		const { status, inhalt } = await sende('/gemeinschaften/neu', leitung, {
			name: 'Rollenprobe — darf nicht entstehen',
			quotaDenominator: '1000',
			headCountMode: 'per_unit',
			headCountRuleSource: 'Rollenprobe'
		});
		behaupte(status === 403, `Der Server antwortete mit ${status} statt 403`);
		behaupte(
			inhalt.includes('Verwaltung vorbehalten'),
			`Die Absage nennt den Grund nicht: ${inhalt.slice(0, 160)}`
		);
		return 'mit Begründung abgewiesen';
	});

	await schritt('Die Verwaltung darf es', async () => {
		// Nicht wirklich anlegen: Der Lauf soll keine Daten hinterlassen. Geprüft
		// wird, dass der Wächter nicht dazwischentritt — käme er, stünde hier ein
		// 403 statt der fachlichen Antwort auf ein unvollständiges Formular.
		const { status, inhalt } = await sende('/gemeinschaften/neu', verwaltung, {});
		behaupte(status !== 403, 'Der Wächter weist auch die Verwaltung ab');
		behaupte(
			!inhalt.includes('Verwaltung vorbehalten'),
			'Die Verwaltung bekommt die Absage der Sitzungsleitung'
		);
		return `fachliche Antwort ${status}, keine Absage des Wächters`;
	});

	await schritt('Die Sitzungsleitung darf eine Versammlung ansetzen', async () => {
		// Der Pfad liegt unter der Gemeinschaft und ist trotzdem ihre Arbeit. Auch
		// hier ohne vollständiges Formular: Es geht um den Wächter, nicht um die
		// Versammlung.
		const { status: listenStatus, inhalt } = await hole('/gemeinschaften', leitung);
		behaupte(listenStatus === 200, 'Die Gemeinschaftsliste ist nicht erreichbar');
		const treffer = inhalt.match(/\/gemeinschaften\/([0-9a-f-]{36})/);
		behaupte(treffer, 'Keine Gemeinschaft vorhanden, an der sich das prüfen liesse');

		// Seit dem 11.08.2026 gibt es **ein** Anlegeformular; der Weg unter der
		// Gemeinschaft leitet dorthin. Geprüft wird deshalb die Aktion selbst.
		const { status, inhalt: antwort } = await sende('/versammlungen/neu?/einzeln', leitung, {
			gemeinschaft: treffer[1]
		});
		behaupte(status !== 403, `Der Wächter weist die Sitzungsleitung ab (${status})`);
		behaupte(
			!antwort.includes('Verwaltung vorbehalten'),
			'Die Sitzungsleitung kann keine Versammlung ansetzen — die Ausnahme greift nicht'
		);
		return 'durchgelassen';
	});

	await schritt('Die Sitzungsleitung führt ihre Versammlungen weiter', async () => {
		const { status } = await hole('/versammlungen', leitung);
		behaupte(status === 200, `Die Versammlungsliste antwortete mit ${status}`);
	});

	await schritt('Das Abmelden löscht den Sitzungskeks mit denselben Fähnchen', async () => {
		// Das Löschen ist ein Set-Cookie wie das Setzen: Trägt es Secure über
		// http, verwirft der Browser es still, und der Keks bleibt liegen.
		const antwort = await fetch(`${ZIEL}/abmelden`, {
			method: 'POST',
			redirect: 'manual',
			headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, cookie: leitung },
			body: ''
		});
		const zeile = (antwort.headers.getSetCookie?.() ?? []).find((k) =>
			k.startsWith('versammlung_sitzung=')
		);
		behaupte(zeile, `Das Abmelden setzt den Sitzungskeks nicht zurück (Status ${antwort.status})`);
		const f = faehnchen(zeile);
		behaupte(f.get('max-age') === '0', `Das Abmelden löscht nicht (Max-Age): ${zeile}`);
		const secure = pruefeSecure(f, zeile);
		const danach = await hole('/versammlungen', leitung);
		behaupte(danach.status === 303, `Die alte Sitzung gilt noch (Status ${danach.status})`);
		return `Max-Age=0, ${secure}`;
	});
}

main()
	.then(() => {
		console.log(`\n${schrittzahl} Schritte, ${befunde.length} Befunde.`);
		console.log(befunde.length ? 'Rollenprobe rot.' : 'Rollenprobe grün.');
		process.exit(befunde.length ? 1 : 0);
	})
	.catch((fehler) => {
		console.error(`\nAbbruch: ${fehler.message}`);
		process.exit(1);
	});
