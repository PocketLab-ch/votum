/**
 * Die Lastprobe: viele Telefone gleichzeitig an einer Versammlung.
 *
 * **Warum es diesen Lauf gibt.** `durchspielen.mjs` prüft, ob der Ablauf
 * stimmt — mit zwei Telefonen. Was er nicht prüft, ist das, was im Saal
 * tatsächlich geschieht: vierzehn Geräte hängen gleichzeitig am Ereignisstrom,
 * die Sitzungsleitung eröffnet eine Abstimmung, und **alle** müssen die Frage
 * sehen. Story 5.6 nennt dafür zwei Sekunden. Bisher war das eine Behauptung.
 *
 * Gemessen werden drei Dinge, und zwar von der Handlung der Sitzungsleitung an,
 * nicht von der Antwort des Servers — der Mensch am Rednerpult klickt und
 * schaut in den Saal:
 *
 *   1. Wie lange es dauert, bis der Aufruf eines Traktandums bei allen ankommt.
 *   2. Wie lange es dauert, bis die eröffnete Abstimmung bei allen ankommt.
 *   3. Wie lange eine Stimmabgabe braucht, wenn alle gleichzeitig drücken.
 *
 * Dazu die Frage, die keine Zahl hat: Überlebt jede Verbindung den ganzen
 * Ablauf, oder stirbt eine still?
 *
 * **Und seit dem 15.10.2026 die Rennen aus dem Sicherheitsdurchgang (M5).**
 * Nach dem gewöhnlichen Ablauf folgt ein Abschnitt «Rennen (S1 bis S7)»: eine
 * Stimme im Rennen mit dem Schliessen, zwei Schliessvorgänge zugleich, eine
 * Handzählung und eine Stimme in der Pause, eine Stimme mit fremden
 * Einheitskennungen, Handzählung gegen Einzelstimme, das Schliessen auf dem
 * eingefrorenen Stand und zwei Stichentscheide beim offenen Gleichstand. Die
 * Rennen selbst sind in `tests/db/` gesteuert und einzeln gemessen; hier geht
 * es um das, was dort nicht vorkommt: vierzehn Geräte am Strom, eine Leitung
 * dazwischen, und die Frage, ob jede Abweisung ein Satz ist und keine
 * 500-Seite. Vier Traktanden dafür entstehen schon **vor** dem Öffnen der
 * Versammlung: im Saal nimmt die Anwendung neue Geschäfte nur noch als
 * spontane auf, und das wäre für die Prüfung eine Nebenhandlung.
 *
 * **Was dabei fast schiefging und jetzt im Code steht** (`wirksamerStatus`):
 * SvelteKit antwortet einer `fetch`-Anfrage auch bei `fail(400)` mit **HTTP
 * 200** und trägt den Status im Körper. Der erste Lauf dieses Abschnitts hielt
 * jede Abweisung für einen Erfolg. Wer hier eine Prüfung ergänzt: den
 * wirksamen Ausgang lesen, nicht den Transportstatus.
 *
 * **Warum ohne Browser.** Vierzehn Chromium-Kontexte messen vor allem
 * Chromium. Die Telefone laufen deshalb als reine HTTP-Teilnehmer: Code
 * einlösen, Ereignisstrom lesen, Formular abschicken — genau die drei Dinge,
 * die ein Telefon im Saal tut. Nur die Sitzungsleitung braucht einen Browser,
 * weil ihre Seiten mit Formularen bedient werden.
 *
 * **Was der Lauf nicht ersetzt.** Er läuft über die Netzwerkbrücke von Docker
 * gegen den Entwicklungsserver, nicht über WLAN gegen ein gebautes Abbild.
 * Funkloch, Kanalwechsel und schlafende Telefone sieht er nicht. Er sagt, ob
 * die Anwendung mit der Gleichzeitigkeit zurechtkommt — mehr nicht, aber das
 * genau.
 *
 * **Aufruf** (vom Dev-Host aus, gegen den laufenden Dev-Stapel):
 *
 *   node e2e/last.mjs
 *   TELEFONE=40 node e2e/last.mjs
 *
 * Der Lauf legt echte Daten an und räumt sie nicht weg; die Gemeinschaft heisst
 * «Lastprobe (Prüflauf …)» und wird von `scripts/testdaten-entfernen.sql`
 * erfasst.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';
import { absageGrund, nachAbsendung, nachladeWarter } from './absendung.mjs';
import { rueckfragenBestaetigen } from './rueckfrage.mjs';
import { warteNachNavigation } from './bereit.mjs';

import { zugang } from './zugang.mjs';
const PLAYWRIGHT_PFAD = playwrightPfad();
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
/**
 * Wie viele Telefone.
 *
 * Vierzehn ist kein runder Wert, sondern die Grösse einer gewöhnlichen
 * kleinen Gemeinschaft. Wer die Grenze sucht, setzt `TELEFONE`
 * höher — die Zahl bestimmt zugleich die Einheiten, den Nenner und die
 * Eigentümer.
 */
const TELEFONE = Number(process.env.TELEFONE ?? 14);

/** Was Story 5.6 zusagt. Überschreitungen werden benannt, nicht verschwiegen. */
const ZUSAGE_MS = 2000;

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_PFAD);

/**
 * Der **wirksame** Ausgang einer Formularantwort.
 *
 * **Der HTTP-Status lügt hier, und zwar systematisch** (gemessen am
 * 15.10.2026 an dieser Stelle). SvelteKit antwortet einer Anfrage, die als
 * Abruf (`fetch`) daherkommt und kein `accept: text/html` trägt, mit **HTTP
 * 200**, auch wenn die Aktion mit `fail(400, …)` abgewiesen hat; der Status
 * steht dann im Körper (`{"type":"failure","status":400,…}`). Ein Browser, der
 * das Formular abschickt, bekommt dagegen 400 mit Seite.
 *
 * Der erste Lauf der Rennprüfung hielt damit jede Abweisung für einen Erfolg:
 * Das Schliessen sei zweimal durchgekommen, die Stimme im Rennen gespeichert.
 * Beides war falsch, und die Datenbank zeigte es.
 *
 * Was sich nicht als SvelteKit-Antwort lesen lässt (eine HTML-Seite), behält
 * seinen HTTP-Status.
 */
function wirksamerStatus(inhalt, httpStatus) {
	try {
		const koerper = JSON.parse(inhalt);
		if (koerper && typeof koerper === 'object' && 'type' in koerper) {
			return Number(koerper.status ?? httpStatus);
		}
	} catch {
		// HTML oder leer: Der HTTP-Status ist die Wahrheit.
	}
	return httpStatus;
}

const LAUF = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

let schrittzahl = 0;
const befunde = [];

/**
 * Wählt in einer Liste den Eintrag, der mit dem Text **beginnt**.
 *
 * **Seit dem 27.08.2026 nötig** (Auftraggeber: «Bei 2 Einheiten zuordnen braucht es
 * noch den Filter … und wenn Personen einer Einheit zugeordnet sind, sollte
 * diese das auch anzeigen»). Die Einträge tragen jetzt mehr als die
 * Bezeichnung: «Whg 1 · Anna Muster». Ein `selectOption({ label })` sucht
 * wörtlich und fände nichts mehr.
 */
async function waehleNachAnfang(auswahl, anfang) {
	const texte = await auswahl.locator('option').allTextContents();
	const i = texte.findIndex((t) => t.trim().startsWith(anfang));
	if (i < 0) throw new Error(`«${anfang}» fehlt in der Auswahl: ${texte.join(' | ')}`);
	await auswahl.selectOption({ index: i });
}

async function schritt(name, arbeit) {
	schrittzahl++;
	const nummer = String(schrittzahl).padStart(2, '0');
	const begonnen = Date.now();
	try {
		const ergebnis = await arbeit();
		const dauer = Date.now() - begonnen;
		console.log(`  ✓ ${nummer} ${name}${ergebnis ? ` — ${ergebnis}` : ''} (${dauer} ms)`);
		return ergebnis;
	} catch (fehler) {
		console.error(`  ✗ ${nummer} ${name}\n     ${fehler.message}`);
		befunde.push({ nummer, name, meldung: fehler.message });
		throw fehler;
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

// ── Messwerte ───────────────────────────────────────────────────────────────

/**
 * Kennzahlen einer Messreihe.
 *
 * Der Mittelwert wird bewusst nicht ausgewiesen: Im Saal zählt nicht, wie es
 * dem durchschnittlichen Telefon ergeht, sondern dem letzten. Deshalb Median,
 * das langsamste und die Zahl der Überschreitungen.
 */
function kennzahlen(werte) {
	if (werte.length === 0) return null;
	const sortiert = [...werte].sort((a, b) => a - b);
	const bei = (anteil) => sortiert[Math.min(sortiert.length - 1, Math.floor(anteil * sortiert.length))];
	return {
		anzahl: sortiert.length,
		schnellste: sortiert[0],
		median: bei(0.5),
		p95: bei(0.95),
		langsamste: sortiert[sortiert.length - 1]
	};
}

function zeile(name, k, grenze = ZUSAGE_MS) {
	if (!k) return `  ${name.padEnd(34)} keine Messwerte`;
	const ueber = k.langsamste > grenze ? `  ⚠ über ${grenze} ms` : '';
	return (
		`  ${name.padEnd(34)} n=${String(k.anzahl).padStart(3)}  ` +
		`min ${String(k.schnellste).padStart(5)} ms · median ${String(k.median).padStart(5)} ms · ` +
		`p95 ${String(k.p95).padStart(5)} ms · max ${String(k.langsamste).padStart(5)} ms${ueber}`
	);
}

// ── Die Sitzungsleitung im Browser ──────────────────────────────────────────

/**
 * Formular abschicken und den Zeitpunkt des Klicks zurückgeben.
 *
 * Der Klick, nicht die Antwort: Die Anwendung sendet den Ereignisstrom noch im
 * Handler, also bevor die Antwort beim Browser ist. Von der Antwort aus
 * gemessen wären die Laufzeiten teils negativ — und vor allem wäre es nicht
 * das, was jemand im Saal erlebt.
 *
 * **Warum die Antwort ausbleiben darf.** Die Leitungsseite hängt selbst am
 * Ereignisstrom und lädt sich neu, sobald eine Abstimmung öffnet oder schliesst.
 * Dieses Neuladen bricht die eigene, noch laufende Formularübermittlung ab: Der
 * Server hat sie längst verarbeitet — er sendet den Strom erst am Ende des
 * Handlers —, aber der Browser sieht die Antwort nie. Ein langes Warten darauf
 * verschenkte je Schritt eine halbe Minute. Deshalb kurz warten und weitergehen;
 * ob die Handlung wirkte, prüft ohnehin der Schritt selbst.
 */
async function abschicken(seite, knopf) {
	const nachladen = nachladeWarter(seite, 5000);
	const t0 = Date.now();
	const [antwort] = await Promise.all([
		seite.waitForResponse((r) => r.request().method() === 'POST', { timeout: 5000 }).catch(() => null),
		knopf.click()
	]);
	const grund = await absageGrund(antwort);
	if (grund) throw new Error(grund);
	// Kurz nachrücken lassen: Ohne diese Pause prüft der nächste Schritt die
	// Seite von vorher und meldet Fehler, die keine sind. `t0` steht davor, der
	// Messwert bleibt also der Klick, nicht das Nachrücken.
	await nachAbsendung(seite, antwort, nachladen, 120);
	return t0;
}

async function seitentext(seite) {
	return (await seite.locator('body').innerText()).replace(/\s+/g, ' ');
}

// ── Ein Telefon ─────────────────────────────────────────────────────────────

/**
 * Ein Teilnehmergerät als reiner HTTP-Teilnehmer.
 *
 * Trägt seinen eigenen Keks — getrennte Geräte sind getrennte Sitzungen, und
 * ein gemeinsamer Keks bewiese über den Zugang gar nichts.
 */
class Telefon {
	constructor(nummer, code) {
		this.nummer = nummer;
		this.code = code;
		this.keks = null;
		this.nachrichten = [];
		this.gestorben = null;
		this.abbruch = new AbortController();
	}

	get bezeichnung() {
		return `Telefon ${String(this.nummer).padStart(2, '0')}`;
	}

	/**
	 * Den Code einlösen.
	 *
	 * **Zwei Anfragen seit FP-1** (12.11.2026): `GET /z/<code>` löst nichts mehr
	 * ein, es merkt den Code nur in einem kurzlebigen Keks vor. Eingelöst wird
	 * erst der POST der Aktion `?/karte` auf `/z`. `redirect: 'manual'`, weil
	 * die Kopfzeilen mit den Keksen sonst zwischen den Anfragen verlorengingen.
	 *
	 * Der POST braucht die Herkunft: SvelteKit weist ein Formular ohne passende
	 * `origin` ab. Ein Browser setzt sie von selbst, `fetch` nicht.
	 */
	async einloesen() {
		const gescannt = await fetch(`${ZIEL}/z/${this.code}`, { redirect: 'manual' });
		const kartenkeks = (gescannt.headers.getSetCookie?.() ?? [])
			.map((k) => k.match(/versammlung_kartenscan=([^;]+)/))
			.find(Boolean);
		if (!kartenkeks) {
			throw new Error(
				`${this.bezeichnung}: kein Kartenkeks (Status ${gescannt.status}, Ziel ${gescannt.headers.get('location')})`
			);
		}

		const antwort = await fetch(`${ZIEL}/z?/karte`, {
			method: 'POST',
			redirect: 'manual',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: ZIEL,
				cookie: `versammlung_kartenscan=${kartenkeks[1]}`
			},
			body: ''
		});
		const gesetzt = antwort.headers.getSetCookie?.() ?? [];
		const treffer = gesetzt.map((k) => k.match(/versammlung_zugang=([^;]+)/)).find(Boolean);
		if (!treffer) {
			throw new Error(
				`${this.bezeichnung}: kein Zugangskeks (Status ${antwort.status}, Ziel ${antwort.headers.get('location')})`
			);
		}
		this.keks = `versammlung_zugang=${treffer[1]}`;
	}

	/**
	 * Ein Formular der Seite `/z` abschicken.
	 *
	 * Mit `origin`: SvelteKit weist eine Formularanfrage ohne passende Herkunft
	 * ab (Schutz gegen fremde Formulare). Ein Browser setzt die Kopfzeile von
	 * selbst, `fetch` nicht — ohne sie kämen hier lauter 403 zurück und die
	 * Messung sagte nichts über die Anwendung.
	 *
	 * **Mehrfachfelder als Liste** (M5, Rennprüfung S7): `einheit` kommt im
	 * Formular mehrfach vor; ein Objektwert würde `new URLSearchParams` sonst
	 * mit Komma zusammenziehen, und die Anwendung sähe einen einzigen,
	 * unbekannten Wert.
	 */
	async formular(aktion, felder = {}) {
		const eintraege = new URLSearchParams();
		for (const [name, wert] of Object.entries(felder)) {
			if (Array.isArray(wert)) for (const w of wert) eintraege.append(name, w);
			else eintraege.set(name, String(wert));
		}
		const koerper = eintraege.toString();
		const begonnen = Date.now();
		const antwort = await fetch(`${ZIEL}/z?/${aktion}`, {
			method: 'POST',
			redirect: 'manual',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: ZIEL,
				cookie: this.keks
			},
			body: koerper
		});
		const dauer = Date.now() - begonnen;
		// Der Text der Antwort trägt bei einer Abweisung die Begründung; ohne ihn
		// stünde am Ende nur eine Zahl da. `status` ist der **wirksame** Ausgang
		// (`wirksamerStatus`), nicht der blosse HTTP-Status.
		const inhalt = await antwort.text();
		return { status: wirksamerStatus(inhalt, antwort.status), dauer, inhalt };
	}

	/**
	 * Den Ereignisstrom öffnen und mitschreiben.
	 *
	 * Läuft im Hintergrund weiter; jede Nachricht wird mit ihrem Empfangszeitpunkt
	 * abgelegt. Endet der Strom vorzeitig, wird das als Befund vermerkt — eine
	 * tote Verbindung im Saal ist ein Telefon, das nichts mehr sieht.
	 */
	async stromOeffnen() {
		const antwort = await fetch(`${ZIEL}/z/strom`, {
			headers: { cookie: this.keks, accept: 'text/event-stream' },
			signal: this.abbruch.signal
		});
		if (!antwort.ok) throw new Error(`${this.bezeichnung}: Strom antwortete ${antwort.status}`);

		this.lesen = (async () => {
			const leser = antwort.body.getReader();
			const dekodierer = new TextDecoder();
			let rest = '';
			try {
				for (;;) {
					const { done, value } = await leser.read();
					if (done) {
						this.gestorben = 'Der Strom endete';
						return;
					}
					rest += dekodierer.decode(value, { stream: true });
					const bloecke = rest.split('\n\n');
					rest = bloecke.pop();
					for (const block of bloecke) {
						const daten = block
							.split('\n')
							.filter((z) => z.startsWith('data: '))
							.map((z) => z.slice(6))
							.join('');
						if (!daten) continue; // Herzschlag
						this.nachrichten.push({ empfangen: Date.now(), stand: JSON.parse(daten) });
					}
				}
			} catch (fehler) {
				if (fehler.name !== 'AbortError') this.gestorben = fehler.message;
			}
		})();
	}

	/**
	 * Wartet auf die erste Nachricht, auf die die Bedingung zutrifft.
	 *
	 * **`ab` grenzt das Fenster ab** (M5, Rennprüfung). Ohne die Schranke
	 * beginnt die Suche bei jeder Nachricht wieder bei der ersten: Eine
	 * Bedingung wie «es ist eine Abstimmung offen» wäre sofort von der
	 * *vorigen* Runde erfüllt, und der Schritt prüfte die Vergangenheit.
	 */
	async warteAuf(bedingung, frist = 15000, ab = 0) {
		const bis = Date.now() + frist;
		let gesehen = ab;
		while (Date.now() < bis) {
			while (gesehen < this.nachrichten.length) {
				const n = this.nachrichten[gesehen++];
				if (bedingung(n.stand)) return n;
			}
			if (this.gestorben) throw new Error(`${this.bezeichnung}: ${this.gestorben}`);
			await new Promise((f) => setTimeout(f, 10));
		}
		throw new Error(`${this.bezeichnung}: erwartete Nachricht blieb aus (${this.nachrichten.length} empfangen)`);
	}

	schliessen() {
		this.abbruch.abort();
	}
}

/** Wartet bei allen Telefonen auf dieselbe Nachricht und misst ab `t0`. */
async function fanIn(telefone, bedingung, t0, frist = 15000) {
	const treffer = await Promise.all(telefone.map((t) => t.warteAuf(bedingung, frist)));
	return treffer.map((n) => n.empfangen - t0);
}

// ── Der Lauf ────────────────────────────────────────────────────────────────

async function main() {
	console.log(`Ziel: ${ZIEL} · ${TELEFONE} Telefone · Lauf ${LAUF}\n`);

	const browser = await chromium.launch();
	const leitungKontext = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
	await rueckfragenBestaetigen(leitungKontext);
	const leitung = await leitungKontext.newPage();
	// Erst bedienbar, dann bedienen: `warteNachNavigation` lässt jedes
	// `goto` auf die Hydrationsmarke warten. Warum, steht in `bereit.mjs`.
	warteNachNavigation(leitung);
	leitung.on('dialog', (d) => d.accept());

	const messungen = {};
	const telefone = [];
	const rennTraktanden = {};
	let stimmende = [];
	let gemeinschaftId;
	let versammlungId;
	let traktandumId;
	let durchgangId;

	try {
		console.log('Aufbau');

		await schritt('Anmelden', async () => {
			await leitung.goto(`${ZIEL}/anmelden`, { waitUntil: 'domcontentloaded' });
			await leitung.fill('input[name="username"]', BENUTZER);
			await leitung.fill('input[name="kennwort"]', KENNWORT);
			await abschicken(leitung, leitung.locator('main button[type="submit"]'));
			behaupte(!leitung.url().includes('/anmelden'), 'Anmeldung blieb auf der Anmeldeseite');
			return `als ${BENUTZER}`;
		});

		await schritt(`Gemeinschaft mit ${TELEFONE} Einheiten`, async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/neu`, { waitUntil: 'domcontentloaded' });
			await leitung.fill('input[name="name"]', `Lastprobe (Prüflauf ${LAUF})`);
			// Je Einheit 100 Anteile: Der Nenner geht auf, ohne dass irgendwo eine
			// Rundung zu erklären wäre.
			await leitung.fill('input[name="quotaDenominator"]', String(TELEFONE * 100));
			await leitung.check('input[name="headCountMode"][value="per_unit"]');
			await leitung.fill('input[name="headCountRuleSource"]', 'Art. 28 Abs. 1 Reglement');
			/*
			 * **Die Stichentscheid-Klausel gehört in den Aufbau, nicht in die
			 * Rennprüfung** (M5). Einen Stichentscheid nimmt die Anwendung nur
			 * entgegen, wo das Reglement eine Person benennt (Nachtrag
			 * 04.10.2026 zu Befund S6); ohne die Klausel bekäme S6 lauter
			 * «kein Gleichstand, den das Reglement einer Person zuweist» und
			 * prüfte die falsche Sache.
			 */
			await leitung.check('input[name="tieBreak"][value="verwalter"]');
			await leitung.waitForTimeout(150);
			await leitung.fill('input[name="tieBreakRuleSource"]', 'Art. 9 Abs. 2 Reglement');
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());
			const treffer = leitung.url().match(/gemeinschaften\/([0-9a-f-]{36})/);
			behaupte(treffer, `Keine Gemeinschaft erreicht: ${leitung.url()}`);
			gemeinschaftId = treffer[1];
			return gemeinschaftId.slice(0, 8);
		});

		await schritt('Einheiten anlegen', async () => {
			for (let i = 1; i <= TELEFONE; i++) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/einheiten`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung.fill('input[name="label"]', `Whg ${String(i).padStart(2, '0')}`);
				await leitung.fill('input[name="quote.stamm"]', '100');
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			const zeilen = await leitung.locator('input[name^="label."]').count();
			behaupte(zeilen === TELEFONE, `${zeilen} statt ${TELEFONE} Einheiten`);
			return `${TELEFONE} × 100 von ${TELEFONE * 100}`;
		});

		await schritt('Eigentümer anlegen und zuordnen', async () => {
			for (let i = 1; i <= TELEFONE; i++) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await leitung.fill('form[action="?/anlegen"] input[name="displayName"]', `Last ${String(i).padStart(2, '0')} ${LAUF}`);
				await abschicken(leitung, leitung.locator('form[action="?/anlegen"] button[type="submit"]'));
			}
			for (let i = 1; i <= TELEFONE; i++) {
				await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/eigentuemer`, {
					waitUntil: 'domcontentloaded'
				});
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="unitId"]'),
					`Whg ${String(i).padStart(2, '0')}`
				);
				await waehleNachAnfang(
					leitung.locator('form[action="?/zuordnen"] select[name="partyId"]'),
					`Last ${String(i).padStart(2, '0')} ${LAUF}`
				);
				await abschicken(leitung, leitung.locator('form[action="?/zuordnen"] button[type="submit"]'));
			}
			const t = await seitentext(leitung);
			behaupte(
				!t.includes('ohne Eigentümer') || t.includes('0 Einheiten ohne'),
				'Es bleiben Einheiten ohne Eigentümer'
			);
			return `${TELEFONE} Parteien`;
		});

		await schritt('Versammlung anlegen, Betriebsart geführt', async () => {
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/versammlungen/neu`, {
				waitUntil: 'domcontentloaded'
			});
			const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
			await leitung.fill('input[name="datum"]', morgen);
			await leitung.fill('input[name="uhrzeit"]', '19:00');
			await leitung.fill('input[name="ort"]', 'Lastprobe');
			await abschicken(leitung, leitung.locator('button[form="anlegen"]'));
			const treffer = leitung.url().match(/versammlungen\/([0-9a-f-]{36})/);
			behaupte(treffer, `Keine Versammlung erreicht: ${leitung.url()}`);
			versammlungId = treffer[1];

			// Die Betriebsart steht seit dem 11.08.2026 auf der Versammlungsseite:
			// Anlegen fragt nur, wer wann wo tagt.
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}`, { waitUntil: 'domcontentloaded' });
			await leitung.check('input[name="betriebsart"][value="gefuehrt"]');
			await abschicken(leitung, leitung.locator('button[form="angaben"]'));
			return versammlungId.slice(0, 8);
		});

		await schritt('Traktandum mit Erfordernis', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			for (let i = 0; i < 4 && !(await anlegen.isVisible().catch(() => false)); i++) {
				await aufklappen.click().catch(() => {});
				await anlegen.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
			}
			await leitung.fill('form[action="?/anlegen"] input[name="titel"]', 'Hausordnung anpassen');
			await leitung.fill(
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				'Die Hausordnung wird um eine Ruhezeit ergänzt.'
			);
			await anlegen.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());

			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: 'Hausordnung anpassen' });
			behaupte(await eintrag.count(), 'Das Traktandum steht nicht in der Liste');
			traktandumId = await eintrag.first().getAttribute('data-traktandum');
			return traktandumId.slice(0, 8);
		});

		/*
		 * **Die Renn-Traktanden gehören in die Vorbereitung, nicht in den Saal**
		 * (M5, gemessen am 15.10.2026). Während die Versammlung läuft, nimmt die
		 * Anwendung neue Geschäfte nur noch als **spontane** auf, und die
		 * verlangen für eine Abstimmung eine Grundlage im Reglement oder eine
		 * Universalversammlung. Für die Rennprüfung ist das eine Nebenhandlung,
		 * die nichts misst: Die Traktanden stehen deshalb schon vor dem Öffnen
		 * der Versammlung bereit, und der Rennabschnitt ruft sie nur noch auf.
		 */
		await schritt('Vier Traktanden für die Rennen anlegen', async () => {
			rennTraktanden.t2 = await rennTraktandum('Ruhezeit im Treppenhaus (S1)');
			rennTraktanden.t3 = await rennTraktandum('Fahrradkeller (S2)');
			rennTraktanden.t4 = await rennTraktandum('Lärmprotokoll (S3-S5, S7)');
			rennTraktanden.t5 = await rennTraktandum('Gleichstand (S6)');
			return Object.values(rennTraktanden)
				.map((t) => t.slice(0, 8))
				.join(', ');
		});

		await schritt('Freigeben und Zugänge erzeugen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/freigabe`, {
				waitUntil: 'domcontentloaded'
			});
			await abschicken(leitung, leitung.locator('main button[type="submit"]').first());

			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/zugaenge`, {
				waitUntil: 'domcontentloaded'
			});
			const erzeugen = leitung.locator('form.erzeugen button[type="submit"]');
			behaupte(await erzeugen.count(), 'Kein Knopf zum Erzeugen der Karten');
			await Promise.all([
				leitung.waitForEvent('download', { timeout: 30000 }).catch(() => null),
				erzeugen.click()
			]);
			await leitung.waitForTimeout(300);
		});

		await schritt('Versammlung eröffnen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}`, { waitUntil: 'domcontentloaded' });
			await abschicken(leitung, leitung.locator('form[action="?/eroeffnen"] button[type="submit"]'));
		});

		await schritt('Ausgabecodes für alle Parteien', async () => {
			const codes = [];
			for (let i = 0; i < TELEFONE; i++) {
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
					waitUntil: 'domcontentloaded'
				});
				const formulare = leitung.locator('form[action="?/codeAusgeben"]');
				behaupte((await formulare.count()) > i, `Kein Ausgabeformular für Partei ${i + 1}`);
				await abschicken(leitung, formulare.nth(i).locator('button[type="submit"]'));
				const code = leitung.locator('.ausgabe .code');
				behaupte(await code.count(), `Kein Ausgabecode für Partei ${i + 1}`);
				codes.push((await code.textContent()).trim());
			}
			behaupte(new Set(codes).size === TELEFONE, 'Zwei Parteien bekamen denselben Code');
			codes.forEach((code, i) => telefone.push(new Telefon(i + 1, code)));
			// Das letzte Gerät schweigt bei der Abstimmung — die Begründung steht
			// beim Schritt «Alle stimmen im selben Augenblick ab».
			stimmende = telefone.slice(0, TELEFONE - 1);
			return `${codes.length} Codes`;
		});

		// ── Die Last ────────────────────────────────────────────────────────
		console.log('\nLast');

		await schritt('Alle Telefone lösen gleichzeitig ein', async () => {
			const dauern = await Promise.all(
				telefone.map(async (t) => {
					const begonnen = Date.now();
					await t.einloesen();
					return Date.now() - begonnen;
				})
			);
			messungen.einloesen = kennzahlen(dauern);
			return `${telefone.length} Sitzungen`;
		});

		await schritt('Alle melden sich gleichzeitig an', async () => {
			const antworten = await Promise.all(telefone.map((t) => t.formular('anmelden')));
			const abgewiesen = antworten.filter((a) => a.status >= 400);
			behaupte(abgewiesen.length === 0, `${abgewiesen.length} Anmeldungen abgewiesen`);
			messungen.anmelden = kennzahlen(antworten.map((a) => a.dauer));
			return `${antworten.length} Anmeldungen`;
		});

		await schritt('Leitung bestätigt alle Anmeldungen', async () => {
			let bestaetigt = 0;
			for (let i = 0; i < TELEFONE + 2; i++) {
				await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/anwesenheit`, {
					waitUntil: 'domcontentloaded'
				});
				const knopf = leitung.locator('form[action="?/bestaetigen"] button[type="submit"]:not([hidden])');
				if (!(await knopf.count())) break;
				await abschicken(leitung, knopf.first());
				bestaetigt++;
			}
			behaupte(bestaetigt >= TELEFONE, `Nur ${bestaetigt} von ${TELEFONE} bestätigt`);
			return `${bestaetigt} anwesend`;
		});

		await schritt('Alle Telefone hängen am Ereignisstrom', async () => {
			await Promise.all(telefone.map((t) => t.stromOeffnen()));
			// Der erste Stand kommt beim Verbinden — er beweist, dass die Verbindung
			// steht und nicht nur der Aufruf zurückkam.
			await Promise.all(telefone.map((t) => t.warteAuf(() => true)));
			return `${telefone.length} offene Verbindungen`;
		});

		await schritt('Traktandum aufrufen — kommt es bei allen an?', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const knopf = leitung.locator(
				`form[action="?/aufrufen"]:has(input[value="${traktandumId}"]) button[type="submit"]`
			);
			behaupte(await knopf.count(), 'Kein Knopf zum Aufrufen des Traktandums');
			const t0 = await abschicken(leitung, knopf.first());
			const dauern = await fanIn(telefone, (s) => s.aktuellesTraktandumId === traktandumId, t0);
			messungen.aufruf = kennzahlen(dauern);
			return `bei allen ${telefone.length}`;
		});

		await schritt('Abstimmung eröffnen — kommt die Frage bei allen an?', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const knopf = leitung.locator('form[action="?/oeffnen"] button[type="submit"]');
			behaupte(await knopf.count(), 'Kein Knopf zum Eröffnen der Abstimmung');
			const t0 = await abschicken(leitung, knopf.first());
			const treffer = await Promise.all(
				telefone.map((t) => t.warteAuf((s) => s.abstimmung?.zustand === 'offen'))
			);
			messungen.eroeffnen = kennzahlen(treffer.map((n) => n.empfangen - t0));
			durchgangId = treffer[0].stand.abstimmung.durchgangId;

			// Die Frage muss mitkommen, nicht nur die Kennung: Ein Telefon, das
			// «es läuft eine Abstimmung» weiss, aber nicht worüber, ist wertlos.
			for (const n of treffer) {
				behaupte(
					n.stand.abstimmung.frage.includes('Ruhezeit'),
					'Der Strom trägt die Frage nicht mit'
				);
			}
			return durchgangId.slice(0, 8);
		});

		await schritt('Alle stimmen im selben Augenblick ab', async () => {
			// Kein Versatz: Genau das ist der Fall, den der Saal erzeugt, wenn die
			// Frage an der Wand erscheint.
			//
			// **Ein Gerät schweigt.** Nicht aus Bequemlichkeit: Haben alle
			// abgestimmt, gilt die Abstimmung als vollständig und das Ergebnis geht
			// sofort hinaus (Story 5.9). Dann gäbe es nichts mehr freizugeben, und
			// die Laufzeit «Ergebnis bis Gerät» wäre nicht gemessen, sondern
			// wegdefiniert. Mit einem Schweigenden läuft der übliche Weg: schliessen,
			// verkünden — und das ist der Weg, dessen Dauer im Saal jemand erlebt.
			const antworten = await Promise.all(
				stimmende.map((t) => t.formular('stimmen', { durchgang: durchgangId, wahl: 'yes' }))
			);
			const abgewiesen = antworten.filter((a) => a.status >= 400);
			if (abgewiesen.length) {
				const erste = abgewiesen[0].inhalt.replace(/\s+/g, ' ').slice(0, 200);
				throw new Error(`${abgewiesen.length} Stimmen abgewiesen, erste: ${erste}`);
			}
			messungen.stimmen = kennzahlen(antworten.map((a) => a.dauer));
			return `${antworten.length} Stimmen, ein Gerät schweigt`;
		});

		await schritt('Der Fortschritt zählt alle Stimmen', async () => {
			// Über den Ereignisstrom, nicht über die Seite: Wenn die Zahl dort
			// stimmt, hat jede einzelne Stimme den Weg bis in den Zwischenstand
			// gefunden — und genau daran scheitert eine verlorene Stimme.
			const treffer = await Promise.all(
				telefone.map((t) => t.warteAuf((s) => s.abstimmung?.abgegeben === stimmende.length))
			);
			behaupte(
				treffer.every((n) => n.stand.abstimmung.stimmberechtigt === TELEFONE),
				'Der Strom nennt eine andere Zahl Stimmberechtigter'
			);
			return `${stimmende.length} von ${TELEFONE}`;
		});

		await schritt('Schliessen und freigeben — kommt das Ergebnis bei allen an?', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/leitung`, {
				waitUntil: 'domcontentloaded'
			});
			const schliessen = leitung.locator('form[action="?/schliessen"] button[type="submit"]');
			behaupte(await schliessen.count(), 'Kein Knopf zum Schliessen der Abstimmung');
			// Die Rückfrage «Es haben nicht alle abgestimmt» wird bestätigt; der
			// Melder oben nimmt sie an.
			/*
			 * **Das Schliessen verkündet** (Produktentscheid 21.08.2026). Bis dahin
			 * folgte hier ein zweiter Klick auf «Ergebnis freigeben»; gemessen wurde
			 * die Zeit ab diesem zweiten Klick. Jetzt ist es derselbe Augenblick —
			 * und die Messung sagt, was im Saal tatsächlich vergeht: vom Schliessen
			 * bis zum Ergebnis auf dem Telefon.
			 */
			const t0 = await abschicken(leitung, schliessen.first());
			behaupte(
				(await leitung.locator('form[action="?/freigeben"] button').count()) === 0,
				'Es gibt wieder einen eigenen Verkünden-Knopf'
			);

			const treffer = await Promise.all(
				telefone.map((t) => t.warteAuf((s) => s.abstimmung?.ergebnis != null))
			);
			messungen.ergebnis = kennzahlen(treffer.map((n) => Math.max(0, n.empfangen - t0)));
			const ergebnis = treffer[0].stand.abstimmung.ergebnis;
			behaupte(
				ergebnis.koepfe.ja === stimmende.length,
				`Das Ergebnis zählt ${ergebnis.koepfe.ja} statt ${stimmende.length} Ja-Kopfstimmen`
			);
			behaupte(
				ergebnis.koepfe.ohneAbgabe === 1,
				`Das schweigende Gerät steht mit ${ergebnis.koepfe.ohneAbgabe} statt 1 ohne Abgabe`
			);
			behaupte(
				treffer.every((n) => n.stand.abstimmung.ergebnis.satz === ergebnis.satz),
				'Nicht alle Telefone sehen dasselbe Ergebnis'
			);
			return ergebnis.satz;
		});

		await schritt('Keine Verbindung ist unterwegs gestorben', async () => {
			const tote = telefone.filter((t) => t.gestorben);
			behaupte(
				tote.length === 0,
				`${tote.length} Verbindungen endeten vorzeitig: ${tote.map((t) => `${t.bezeichnung} (${t.gestorben})`).join(', ')}`
			);
			const wenigste = Math.min(...telefone.map((t) => t.nachrichten.length));
			return `${telefone.length} offen, mindestens ${wenigste} Nachrichten je Gerät`;
		});

		await schritt('Die Auswertung bestätigt die Zahlen', async () => {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/auswertung`, {
				waitUntil: 'domcontentloaded'
			});
			const t = await seitentext(leitung);
			behaupte(t.includes('Hausordnung anpassen'), 'Das Traktandum fehlt in der Auswertung');
			behaupte(/angenommen/i.test(t), 'Die Auswertung nennt kein Ergebnis');
			return 'angenommen';
		});

		// ── Rennen (S1 bis S7) ──────────────────────────────────────────────
		//
		// **Warum das hierher gehört und nicht in `tests/db/`.** Die Rennen aus
		// dem Sicherheitsdurchgang sind dort einzeln und gesteuert gemessen
		// (`tests/db/rennen.ts`). Was dort nicht vorkommt: vierzehn Geräte am
		// Strom, eine Sitzungsleitung, die gleichzeitig bedient, und die Frage,
		// ob jede Abweisung **ein Satz ist und keine 500-Seite**. Genau das
		// erzeugt der Saal, und genau das prüft dieser Abschnitt: im Rennen,
		// unter Last, über die echten Wege.
		//
		// Gemessen wird je Rennen zweierlei: dass keine Seite mit 5xx antwortet
		// und dass eine Abweisung einen Satz trägt. Dazu die inhaltliche
		// Kohärenz, wo sie sich von aussen feststellen lässt (das Ergebnis am
		// Strom gehört zur gewonnenen oder abgewiesenen Stimme).

		console.log('\nRennen (S1 bis S7)');

		let rennnummer = 0;
		async function rennschritt(name, arbeit) {
			rennnummer += 1;
			const nummer = `R${String(rennnummer).padStart(2, '0')}`;
			try {
				const ergebnis = await arbeit();
				console.log(`  ✓ ${nummer} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
			} catch (fehler) {
				console.error(`  ✗ ${nummer} ${name}\n     ${fehler.message}`);
				befunde.push({ nummer, name, meldung: fehler.message });
			}
		}

		/** Eine Abweisung ist ein Satz: kein 5xx, und im Fehlerfall Text mit Satz. */
		function pruefeAntwort(antwort, was) {
			// Die Leitungsantworten (Playwright) tragen `text`, die der Telefone
			// (fetch) tragen `inhalt`.
			const roh = antwort.text ?? antwort.inhalt ?? '';
			const lesbar = roh.replace(/\s+/g, ' ').slice(0, 200);
			behaupte(antwort.status < 500, `${was}: HTTP ${antwort.status} — ${lesbar}`);
			if (antwort.status >= 400) {
				const sauber = roh.replace(/<[^>]*>/g, ' ').replace(/\\[a-z"]/g, ' ');
				behaupte(
					/[A-ZÄÖÜ][^.!?]{15,}[.!?]/.test(sauber),
					`${was}: Abweisung ohne Satz — ${lesbar}`
				);
			}
		}

		/** Eine Abweisung lesbar machen: den Satz aus der JSON-Hülle holen. */
		function lesbareAbweisung(roh) {
			const texte = [...String(roh ?? '').matchAll(/"((?:[^"\\]|\\.){15,})"/g)]
				.map((m) => m[1].replace(/\\"/g, '"').replace(/\\[a-z]/g, ' '))
				.filter((t) => /[A-ZÄÖÜ]/.test(t) && /\s/.test(t));
			const laengster = texte.sort((a, b) => b.length - a.length)[0];
			return (laengster ?? String(roh)).replace(/\s+/g, ' ').slice(0, 90);
		}

		/**
		 * Eine Leitungsaktion als roher Formular-POST.
		 *
		 * Die Herkunft gehört mit: Am gebauten Stand steht SvelteKits Schutz gegen
		 * fremde Formulare vor jeder Aktion, und ohne `origin` käme hier jede
		 * Antwort als CSRF-403 zurück, richtige Zahlen aus dem falschen Grund.
		 *
		 * **`antwort.status()` ist eine Methode, keine Eigenschaft** (gemessen am
		 * 15.10.2026: Der erste Lauf dieses Abschnitts stufte jede geglückte
		 * Aktion als Fehler ein, weil `status < 500` zwei Unvergleichbares
		 * verglich und immer falsch ergab).
		 */
		async function leitungPost(aktion, felder = {}) {
			const antwort = await leitung.request.post(
				`${ZIEL}/versammlungen/${versammlungId}/leitung?/${aktion}`,
				{
					form: felder,
					headers: { origin: ZIEL, accept: 'application/json' },
					failOnStatusCode: false,
					maxRedirects: 0
				}
			);
			const text = await antwort.text();
			return { status: wirksamerStatus(text, antwort.status()), text };
		}

		/** Ein Traktandum über die Oberfläche anlegen und seine Kennung zurückgeben. */
		async function rennTraktandum(titel) {
			await leitung.goto(`${ZIEL}/versammlungen/${versammlungId}/traktanden`, {
				waitUntil: 'domcontentloaded'
			});
			const aufklappen = leitung.locator('button', { hasText: 'Traktandum hinzufügen' }).first();
			const anlegen = leitung.locator('form[action="?/anlegen"]');
			for (let i = 0; i < 4 && !(await anlegen.isVisible().catch(() => false)); i++) {
				await aufklappen.click().catch(() => {});
				await anlegen.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
			}
			await leitung.fill('form[action="?/anlegen"] input[name="titel"]', titel);
			await leitung.fill(
				'form[action="?/anlegen"] [name="antragswortlaut"]',
				`${titel}: Der Antrag steht zur Abstimmung.`
			);
			await anlegen.locator('select[name="erfordernis"]').selectOption('k-hausordnung');
			await abschicken(leitung, anlegen.locator('button[type="submit"]').first());
			const eintrag = leitung.locator('li[data-traktandum]').filter({ hasText: titel });
			behaupte(await eintrag.count(), `«${titel}» steht nicht in der Liste`);
			return eintrag.first().getAttribute('data-traktandum');
		}

		/** Aufrufen, eröffnen, warten bis alle Geräte die offene Runde sehen. */
		async function rennRunde(traktandumId) {
			const lagen = telefone.map((t) => t.nachrichten.length);
			const auf = await leitungPost('aufrufen', { traktandum: traktandumId });
			pruefeAntwort(auf, 'aufrufen');
			await Promise.all(
				telefone.map((t, i) =>
					t.warteAuf((s) => s.aktuellesTraktandumId === traktandumId, 20000, lagen[i])
				)
			);
			const oeff = await leitungPost('oeffnen', { traktandum: traktandumId });
			pruefeAntwort(oeff, 'oeffnen');
			const treffer = await Promise.all(
				telefone.map((t, i) => t.warteAuf((s) => s.abstimmung?.zustand === 'offen', 20000, lagen[i]))
			);
			return treffer[0].stand.abstimmung.durchgangId;
		}

		/** Das verkündete Ergebnis ab dem Zeitpunkt `ab`, vom ersten Gerät gelesen. */
		async function rennErgebnis(ab) {
			const n = await telefone[0].warteAuf(
				(s) => s.abstimmung?.ergebnis != null,
				20000,
				ab
			);
			return n.stand.abstimmung.ergebnis;
		}

		const { t2, t3, t4, t5 } = rennTraktanden;
		behaupte(t2 && t3 && t4 && t5, 'Die Renn-Traktanden fehlen: der Aufbau hat sie nicht angelegt');

		await rennschritt('S1: Eine Stimme im Rennen mit dem Schliessen', async () => {
			const durchgang = await rennRunde(t2);
			const ab = telefone[0].nachrichten.length;
			const [stimme, zu] = await Promise.all([
				telefone[0].formular('stimmen', { durchgang, wahl: 'yes' }),
				leitungPost('schliessen')
			]);
			pruefeAntwort(zu, 'schliessen');
			pruefeAntwort(stimme, 'Stimme im Rennen');
			behaupte(zu.status < 400, `Das Schliessen scheiterte: HTTP ${zu.status}`);
			const ergebnis = await rennErgebnis(ab);
			/*
			 * **Die Kohärenz, und sie ist die eigentliche Zusicherung.** Die
			 * Stimme ist entweder gespeichert und gezählt oder sauber
			 * abgewiesen. Der alte Befund S1 war der dritte Ausgang: gespeichert
			 * und NICHT gezählt: eine Stimme, die im Saal als abgegeben gilt
			 * und im Ergebnis fehlt.
			 */
			if (stimme.status < 400) {
				behaupte(
					ergebnis.koepfe.ja === 1,
					`Die Stimme kam durch, steht aber mit ${ergebnis.koepfe.ja} Ja im Ergebnis ` +
						'(gespeichert, nicht gezählt: genau der Befund S1)'
				);
				return 'Stimme gewann das Rennen und wurde gezählt';
			}
			behaupte(
				ergebnis.koepfe.ja === 0,
				`Die Stimme wurde abgewiesen, zählt aber mit ${ergebnis.koepfe.ja} Ja zum Ergebnis`
			);
			return `Schliessen gewann, die Stimme hörte «${lesbareAbweisung(stimme.inhalt)}»`;
		});

		await rennschritt('S2: Zwei Schliessvorgänge im Rennen', async () => {
			await rennRunde(t3);
			const ab = telefone[0].nachrichten.length;
			const [a, b] = await Promise.all([leitungPost('schliessen'), leitungPost('schliessen')]);
			pruefeAntwort(a, 'schliessen A');
			pruefeAntwort(b, 'schliessen B');
			const erfolge = [a, b].filter((x) => x.status < 400).length;
			behaupte(erfolge === 1, `${erfolge} Schliessvorgänge kamen durch: genau einer darf es sein`);
			const ergebnis = await rennErgebnis(ab);
			behaupte(
				ergebnis.koepfe.ja === 0 && ergebnis.koepfe.nein === 0,
				'Ein Rennen ohne Stimmen trug trotzdem Stimmen ins Ergebnis'
			);
			return 'eines schloss, eines hörte «keine offene»';
		});

		let durchgangS3;
		await rennschritt('S3: Handzählung und Stimme während der Pause, beide abgewiesen', async () => {
			durchgangS3 = await rennRunde(t4);
			const pause = await leitungPost('pause', {
				notweg: 'ja',
				an: 'ja',
				pausentext: 'Rennprüfung S3'
			});
			pruefeAntwort(pause, 'Pause an');
			behaupte(pause.status < 400, `Die Pause liess sich nicht setzen: HTTP ${pause.status}`);

			const summen = await leitungPost('summen', { ja: '3', nein: '1', enthaltung: '1' });
			pruefeAntwort(summen, 'Handzählung in der Pause');
			behaupte(summen.status >= 400, 'Die Handzählung kam in der Pause durch (Befund S3)');

			const stimme = await telefone[1].formular('stimmen', {
				durchgang: durchgangS3,
				wahl: 'yes'
			});
			pruefeAntwort(stimme, 'Stimme in der Pause');
			behaupte(stimme.status >= 400, 'Eine Stimme kam in der Pause durch');

			const fort = await leitungPost('pause', { notweg: 'ja', an: 'nein' });
			pruefeAntwort(fort, 'Pause aus');
			behaupte(fort.status < 400, 'Die Pause liess sich nicht aufheben');
			return 'beide hörten «Die Versammlung ist unterbrochen»';
		});

		await rennschritt('S7: Eine Stimme mit fremden Einheitskennungen, keine stille Teilabgabe', async () => {
			/*
			 * **Eine eigene und eine fremde Einheit, nicht zwei fremde.** Zwei
			 * fremde ergeben null Treffer, und dann sagt schon die ältere Absage
			 * «Ohne zugeordnete Einheit …» ab, bevor die S7-Abwehr überhaupt
			 * gefragt ist; der Schritt wäre auch ohne sie grün (Codeprüfung
			 * 15.10.2026). Erst die Mischung trifft den alten Fehler: Die
			 * Teilmenge wurde still gespeichert. Gerät 3 gehört zu «Last 03» mit
			 * «Whg 03»; die Einheitenliste ist nach Bezeichnung geordnet.
			 */
			await leitung.goto(`${ZIEL}/gemeinschaften/${gemeinschaftId}/einheiten`, {
				waitUntil: 'domcontentloaded'
			});
			const einheiten = await leitung
				.locator('input[name^="label."]')
				.evaluateAll((felder) => felder.map((f) => f.name.slice('label.'.length)));
			behaupte(einheiten.length >= 3, `Nur ${einheiten.length} Einheiten gefunden`);
			const stimme = await telefone[2].formular('stimmen', {
				durchgang: durchgangS3,
				wahl: 'yes',
				einheit: [einheiten[2], einheiten[0]]
			});
			pruefeAntwort(stimme, 'Stimme mit einer fremden Einheit');
			behaupte(
				stimme.status >= 400,
				'Eine Stimme mit einer eigenen und einer fremden Einheit kam durch: die stille Teilabgabe'
			);
			behaupte(
				/gehört nicht zu dieser Partei/.test(stimme.inhalt),
				`Abgewiesen, aber nicht von der S7-Abwehr: ${lesbareAbweisung(stimme.inhalt)}`
			);
			return `${stimme.status}: «${lesbareAbweisung(stimme.inhalt)}»`;
		});

		let summenGewann = false;
		await rennschritt('S4: Handzählung im Rennen mit der Einzelstimme', async () => {
			const [summen, stimme] = await Promise.all([
				leitungPost('summen', { ja: '3', nein: '1', enthaltung: '1' }),
				telefone[3].formular('stimmen', { durchgang: durchgangS3, wahl: 'yes' })
			]);
			pruefeAntwort(summen, 'Handzählung');
			pruefeAntwort(stimme, 'Einzelstimme');
			const erfolge = [summen, stimme].filter((x) => x.status < 400).length;
			behaupte(
				erfolge === 1,
				`Beide Wege zusammen kamen durch (${erfolge} Erfolge): Summen und Einzelstimmen ` +
					'zugleich ergäben zwei Ergebnisse (Befund S4)'
			);
			summenGewann = summen.status < 400;
			return summenGewann
				? 'die Handzählung gewann, die Stimme wurde abgewiesen'
				: 'die Stimme gewann, die Handzählung wurde abgewiesen';
		});

		await rennschritt('S5: Geschlossen wird mit dem Stand, der beim Zählen galt', async () => {
			const ab = telefone[0].nachrichten.length;
			if (summenGewann) {
				const spaet = await telefone[4].formular('stimmen', {
					durchgang: durchgangS3,
					wahl: 'yes'
				});
				pruefeAntwort(spaet, 'späte Stimme');
				behaupte(spaet.status >= 400, 'Eine Stimme nach der Handzählung kam durch');
			}
			const zu = await leitungPost('schliessen');
			pruefeAntwort(zu, 'schliessen');
			behaupte(zu.status < 400, `Das Schliessen scheiterte: HTTP ${zu.status}`);
			const ergebnis = await rennErgebnis(ab);
			if (summenGewann) {
				behaupte(
					ergebnis.koepfe.ja === 3 && ergebnis.koepfe.nein === 1 && ergebnis.koepfe.enthaltung === 1,
					`Geschlossen wurde nicht mit dem Stand der Handzählung: ${JSON.stringify(ergebnis.koepfe)}`
				);
				return '3 Ja, 1 Nein, 1 Enthaltung, der eingefrorene Stand';
			}
			behaupte(
				ergebnis.koepfe.ja === 1,
				`Die gewonnene Einzelstimme fehlt im Ergebnis: ${JSON.stringify(ergebnis.koepfe)}`
			);
			return 'die Einzelstimme aus S4 steht im Ergebnis';
		});

		await rennschritt('S6: Zwei Stichentscheide beim offenen Gleichstand', async () => {
			/*
			 * Ein Gleichstand braucht eine gerade Zahl Geräte. Bei ungerader
			 * (`TELEFONE=15`) gibt es keinen, und S6 hätte nichts zu prüfen.
			 */
			if (telefone.length % 2) return `übersprungen: ${telefone.length} Geräte, kein Gleichstand möglich`;
			const haelfte = telefone.length / 2;
			const durchgang = await rennRunde(t5);
			const lagen = telefone.map((t) => t.nachrichten.length);
			const ab = lagen[0];
			const stimmen = await Promise.all(
				telefone.map((t, i) => t.formular('stimmen', { durchgang, wahl: i < haelfte ? 'yes' : 'no' }))
			);
			const abgewiesen = stimmen.filter((s) => s.status >= 400);
			behaupte(
				abgewiesen.length === 0,
				`${abgewiesen.length} Stimmen abgewiesen, erste: ${abgewiesen[0]?.inhalt.replace(/\s+/g, ' ').slice(0, 120)}`
			);
			await Promise.all(
				telefone.map((t, i) => t.warteAuf((s) => s.abstimmung?.abgegeben === telefone.length, 20000, lagen[i]))
			);
			const zu = await leitungPost('schliessen');
			pruefeAntwort(zu, 'schliessen beim Gleichstand');
			behaupte(zu.status < 400, `Das Schliessen beim Gleichstand scheiterte: HTTP ${zu.status}`);

			const [a, b] = await Promise.all([
				leitungPost('stichentscheid', { durchgang, wahl: 'yes', wer: 'Sitzungsleitung' }),
				leitungPost('stichentscheid', { durchgang, wahl: 'no', wer: 'Sitzungsleitung' })
			]);
			pruefeAntwort(a, 'Stichentscheid A');
			pruefeAntwort(b, 'Stichentscheid B');
			const erfolge = [a, b].filter((x) => x.status < 400).length;
			behaupte(
				erfolge === 1,
				`${erfolge} Stichentscheide kamen durch: der zweite muss «schon entschieden» hören (Befund S6)`
			);
			const ergebnis = await rennErgebnis(ab);
			behaupte(
				ergebnis.koepfe.ja === haelfte && ergebnis.koepfe.nein === haelfte,
				`Das Ergebnis nach dem Stichentscheid stimmt nicht: ${JSON.stringify(ergebnis.koepfe)}`
			);
			const verlierer = [a, b].find((x) => x.status >= 400);
			return `einer entschied, der andere hörte «${lesbareAbweisung(verlierer.text)}»`;
		});
	} finally {
		for (const t of telefone) t.schliessen();
		await browser.close().catch(() => {});
	}

	// ── Bericht ─────────────────────────────────────────────────────────────
	console.log(`\nLaufzeiten bei ${TELEFONE} gleichzeitigen Telefonen`);
	console.log(zeile('Code einlösen', messungen.einloesen, 5000));
	console.log(zeile('Selbstanmeldung', messungen.anmelden, 5000));
	console.log(zeile('Traktandenaufruf bis Gerät', messungen.aufruf));
	console.log(zeile('Abstimmung eröffnen bis Gerät', messungen.eroeffnen));
	console.log(zeile('Stimmabgabe (Hin und Rück)', messungen.stimmen, 5000));
	console.log(zeile('Ergebnis bis Gerät', messungen.ergebnis));

	const ueberzogen = [
		['Traktandenaufruf', messungen.aufruf],
		['Abstimmung eröffnen', messungen.eroeffnen],
		['Ergebnis', messungen.ergebnis]
	].filter(([, k]) => k && k.langsamste > ZUSAGE_MS);

	console.log('');
	if (ueberzogen.length) {
		console.log(
			`⚠ Die Zusage aus Story 5.6 (${ZUSAGE_MS} ms auf allen Geräten) ist gerissen bei: ` +
				ueberzogen.map(([name, k]) => `${name} (${k.langsamste} ms)`).join(', ')
		);
	} else {
		console.log(`Die Zusage aus Story 5.6 hält: kein Gerät wartete länger als ${ZUSAGE_MS} ms.`);
	}
	console.log(
		'Gemessen gegen den Entwicklungsserver über die Docker-Brücke — kein WLAN, keine echten Geräte.'
	);
}

main()
	.then(() => {
		console.log(`\n${schrittzahl} Schritte, ${befunde.length} Befunde.`);
		console.log(befunde.length ? 'Lastprobe rot.' : 'Lastprobe grün.');
		process.exit(befunde.length ? 1 : 0);
	})
	.catch((fehler) => {
		console.error(`\nAbbruch: ${fehler.message}`);
		console.log(`${schrittzahl} Schritte, ${befunde.length} Befunde.`);
		process.exit(1);
	});
