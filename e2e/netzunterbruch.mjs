/**
 * Übersteht eine Saalsicht einen Netzunterbruch?
 *
 * **Warum dieser Durchstich getrennt läuft und gegen den GEBAUTEN Stand**
 * (09.09.2026). Die Frage lautet: Bleibt die Wand am Leben, wenn ihr das Netz
 * unter den Füssen weggezogen wird, und holt sie danach nach, was sie verpasst
 * hat? Am Entwicklungsserver lässt sich das nicht messen. Vites HMR-Client lädt
 * die Seite bei Verbindungsverlust von sich aus neu («The next HMR update will
 * cause the page to reload»), und genau diese Navigation landet auf Chromiums
 * Fehlerseite. Eine Probe dagegen ist wertlos, und zwar in beide Richtungen:
 * Sie bleibt auch dann rot, wenn die Anwendung richtig ist. Genau das ist am
 * 09.09.2026 passiert und hat eine ganze Diagnose entwertet.
 *
 * Im gebauten Stand gibt es diesen Client nicht, und im Saal läuft der gebaute
 * Stand.
 *
 * **Was gemessen wird, und woran** (Vorschlag von website-ab). Nicht
 * «navigiert die Seite», denn ein Neuladen und ein Weiterblättern sehen von
 * aussen ähnlich aus. Gemessen wird eine **Marke im Fenster**, die ein
 * Neuladen nicht überlebt: `window.__lebt`. Ist sie danach noch da, hat die
 * Seite den Unterbruch überstanden und die Daten nachgeholt. Ist sie weg,
 * wurde neu geladen — gleichgültig, wer es ausgelöst hat.
 *
 * **Die Gegenprobe gehört dazu, und sie ist gefahren** (10.09.2026). Isoliert
 * wurde eine einzige Änderung, der Vorflug in `$lib/nachziehen`:
 *
 * | Stand | Ausgang |
 * |---|---|
 * | mit Vorflug | Pause nach 4 s nachgeholt, `window.__lebt` überlebt |
 * | ohne Vorflug (nur `nachziehen.ts` auf `9ca42c8`) | `chrome-error://chromewebdata/`, Marke WEG |
 *
 * Der zweite Lauf ist der Beleg dafür, dass diese Probe etwas misst — und
 * zugleich der Beleg für den Befund, der sie überhaupt nötig machte:
 * `invalidateAll()` allein genügt nicht, weil SvelteKit bei einem
 * gescheiterten Abruf selbst hart navigiert.
 *
 * **Vorbehalt zur Umgebung.** Dieser Lauf kappt das Netz mit Absicht. Läuft
 * gleichzeitig ein CI-Auftrag auf demselben Host, legt Gitea Actions Docker-Netze
 * an und ab, und für einen laufenden Chromium sieht das ebenfalls wie ein
 * Netzwechsel aus — die beiden lassen sich nicht auseinanderhalten. Wandert das
 * Ergebnis zwischen zwei Läufen, ist es die Umgebung; bleibt es stabil, ist es
 * die Messung.
 *
 * ## Ein Server, und zwar `node build`
 *
 * **Alles läuft gegen den gebauten Stand, auch die Sitzungsleitung.** Der
 * naheliegende Aufbau wäre gewesen, die Leitung über den Entwicklungsserver zu
 * führen, damit sie vom Unterbruch nicht betroffen ist. Er misst nichts: Der
 * Ereignisstrom lebt **im Prozess** (`verkuendeStand` verteilt an die
 * Zuhörer desselben Servers), und eine Änderung am einen Server erreicht die
 * Wand am anderen nie. Gemessen am 10.09.2026 — die Wand blieb stumm, und der
 * Grund war nicht der Unterbruch, sondern die Verteilung.
 *
 * Der Unterbruch braucht die Trennung ohnehin nicht: `setOffline` wirkt auf den
 * **Browserkontext**. Die Leitung schickt hier gewöhnliche `fetch`-Aufrufe aus
 * Node und ist davon gar nicht berührt.
 *
 * **Und `node build`, nicht `vite preview`.** Auch das gemessen: Unter
 * `vite preview` öffnet der Strom, liefert aber keine einzige Nachricht — die
 * Antwort wird gepuffert. Im Betrieb läuft der Adapter-Node-Bau, und nur der
 * gibt SSE weiter.
 *
 * ## Aufruf
 *
 * ```
 * IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
 *      $(docker compose ps -q app))
 * docker compose exec -T app npm run build
 * docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"
 *
 * ZIEL=http://$IP:3101 node e2e/netzunterbruch.mjs
 * ```
 *
 * **Ein `docker compose restart app` nimmt den gebauten Stand mit** (10.09.2026
 * an sich selbst erlebt). Er läuft im selben Container wie der
 * Entwicklungsserver; wer diesen neu startet — etwa damit er geänderte Dateien
 * lädt —, muss `node build` danach ebenfalls neu starten. Schritt 01 sagt es,
 * wenn es fehlt, statt in einen Verbindungsfehler zu laufen.
 */
import { playwrightPfad } from './playwright-pfad.mjs';
import { createRequire } from 'node:module';

import { umgebungsbefund } from './umgebung.mjs';
import { zugang } from './zugang.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPfad());

/**
 * Der gebaute Stand. Kein Rückfall auf den Entwicklungsserver: Gegen ihn misst
 * dieser Durchstich das Falsche (siehe oben), und ein stiller Rückfall wäre
 * genau der Fehler, den er aufdecken soll.
 *
 * **Ohne `ZIEL` keine Vorgabe.** Der gebaute Stand hört im Container, und
 * dessen Adresse wandert nach einem `compose down/up`; eine eingetragene
 * Adresse wäre eine Vermutung über den Wirt. Ohne `ZIEL` bricht der Lauf ab.
 */
const ZIEL = process.env.ZIEL;
if (!ZIEL) {
	console.error(
		'ZIEL fehlt: die Adresse des gebauten Stands, etwa ZIEL=http://<adresse>:3101. ' +
			'Die Adresse des Containers nennt docker inspect; eine feste Vorgabe gibt es nicht.'
	);
	process.exit(2);
}

const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
/** Wie lange die Wand nach dem Unterbruch Zeit bekommt, den Stand nachzuholen. */
const FRIST_MS = Number(process.env.FRIST_MS ?? 90_000);

let nummer = 0;
async function schritt(name, arbeit) {
	nummer += 1;
	const kopf = `  ${String(nummer).padStart(2, '0')} ${name}`;
	try {
		const zusatz = await arbeit();
		console.log(`  ✓ ${String(nummer).padStart(2, '0')} ${name}${zusatz ? ` — ${zusatz}` : ''}`);
	} catch (fehler) {
		console.log(`  ✗ ${kopf}\n     ${fehler.message}`);
		throw fehler;
	}
}

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

function keksAus(antwort, name) {
	return (antwort.headers.getSetCookie?.() ?? [])
		.find((c) => c.startsWith(`${name}=`))
		?.split(';')[0];
}

async function senden(pfad, felder, keks) {
	return fetch(`${ZIEL}${pfad}`, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: ZIEL,
			...(keks ? { cookie: keks } : {})
		},
		body: new URLSearchParams(felder).toString()
	});
}

console.log('\nNetzunterbruch an der Wand — gegen den gebauten Stand\n');

let leitung;
let versammlung;
let browser;
let kontext;
let wand;
let unterbrochen = false;
const navigationen = [];
const konsole = [];

try {
	await schritt('Der gebaute Stand antwortet', async () => {
		const r = await fetch(`${ZIEL}/`, { redirect: 'manual' });
		behaupte(
			r.status < 500,
			`${ZIEL} antwortet mit ${r.status}. Läuft der gebaute Stand?\n` +
				'  IP=$(docker inspect -f \'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}\' ' +
				'$(docker compose ps -q app))\n' +
				'  docker compose exec -T app npm run build\n' +
				'  docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"\n' +
				'  ZIEL=http://$IP:3101 node e2e/netzunterbruch.mjs'
		);
		return `${ZIEL} · HTTP ${r.status}`;
	});

	await schritt('Als Sitzungsleitung anmelden', async () => {
		const a = await senden('/anmelden', { username: BENUTZER, kennwort: KENNWORT });
		leitung = keksAus(a, 'versammlung_sitzung');
		behaupte(leitung, `keine Sitzung (HTTP ${a.status})`);
		return BENUTZER;
	});

	await schritt('Eine laufende Versammlung ohne Unterbrechung finden', async () => {
		const html = await (
			await fetch(`${ZIEL}/versammlungen`, { headers: { cookie: leitung } })
		).text();
		const ids = [...new Set([...html.matchAll(/\/versammlungen\/([0-9a-f-]{36})/g)].map((m) => m[1]))];
		behaupte(ids.length > 0, 'keine Versammlung gefunden');

		for (const id of ids) {
			const seite = await (
				await fetch(`${ZIEL}/versammlungen/${id}/leitung`, { headers: { cookie: leitung } })
			).text();

			/*
			 * **Drei Bedingungen, alle drei gemessen** (Code-Review 10.09.2026).
			 * Die erste Fassung prüfte nur, ob irgendwo `?/pause` vorkommt, und
			 * dazu ein `value="nein"` irgendwo auf der Seite. Beides trug nicht:
			 *
			 *   · Der Pausenkasten steht auch an einer Versammlung, die am
			 *     gemeinsamen Abend tagt — er ist dort der Notweg. Das POST ohne
			 *     `notweg=ja` bekommt von `nurWennNichtAmAbend` ein `fail(400)`,
			 *     und Schritt 08 stirbt. Gemessen: die Kandidaten 2 bis 30 des
			 *     Prüfbestands sind allesamt abendgebunden.
			 *   · `value="nein"` trifft auch den Freigabeknopf im Einlasskasten
			 *     (`Einlass.svelte`). Gemessen: eine von vierzig brauchbaren
			 *     Versammlungen fiel dadurch grundlos weg.
			 */
			if (!/action="\?\/pause"/.test(seite)) continue;
			// Am gemeinsamen Abend führt die Steuerung des Abends; diese Wand ist
			// dann nicht die, um die es geht.
			if (/href="\/tage\/[0-9a-f-]{36}\/leitung"/.test(seite)) continue;
			// Der Zustand steht IM Pausenformular, nicht irgendwo auf der Seite.
			if (!/action="\?\/pause"[\s\S]{0,400}?name="an" value="ja"/.test(seite)) continue;
			versammlung = id;
			break;
		}
		behaupte(versammlung, 'keine laufende Versammlung mit freiem Pausenschalter');
		return versammlung.slice(0, 8);
	});

	await schritt('Die Wand im gebauten Stand öffnen', async () => {
		browser = await chromium.launch();
		kontext = await browser.newContext();
		const [name, wert] = leitung.split('=');
		// Der Keks gilt je Host, nicht je Port — dieselbe Sitzung trägt auf
		// beiden Ständen.
		await kontext.addCookies([
			{ name, value: wert, url: ZIEL, httpOnly: true, sameSite: 'Lax' }
		]);
		wand = await kontext.newPage();
		wand.on('framenavigated', (r) => {
			if (r === wand.mainFrame())
				navigationen.push(`${new Date().toISOString().slice(11, 19)} ${r.url()}`);
		});
		wand.on('console', (m) => konsole.push(`${new Date().toISOString().slice(11, 19)} [${m.type()}] ${m.text()}`.slice(0, 160)));
		wand.on('requestfailed', (r) => {
			if (r.isNavigationRequest())
				konsole.push(`${new Date().toISOString().slice(11, 19)} NAVIGATION GESCHEITERT ${r.failure()?.errorText}`);
			else if (/__data|strom/.test(r.url()))
				konsole.push(`${new Date().toISOString().slice(11, 19)} ABRUF GESCHEITERT ${r.failure()?.errorText} ${r.url().replace(ZIEL, '')}`);
		});
		wand.on('request', (r) => {
			if (/__data|strom/.test(r.url()))
				konsole.push(`${new Date().toISOString().slice(11, 19)} ${r.method()} ${r.url().replace(ZIEL, '')}`);
		});
		await wand.goto(`${ZIEL}/versammlungen/${versammlung}/praesentation`, {
			waitUntil: 'domcontentloaded'
		});
		await wand.locator('.bild, .wand, main').first().waitFor({ timeout: 20_000 });
		behaupte(
			!/anmelden/.test(wand.url()),
			`Die Wand verlangt eine Anmeldung: ${wand.url()} — der Keks trägt nicht`
		);
		return wand.url().replace(ZIEL, '');
	});

	await schritt('Eine Marke setzen, die ein Neuladen nicht überlebt', async () => {
		await wand.evaluate(() => {
			window.__lebt = Date.now();
		});
		const marke = await wand.evaluate(() => window.__lebt ?? null);
		behaupte(marke, 'Die Marke liess sich nicht setzen');
		return String(marke);
	});

	/**
	 * **Beobachtet wird die Pause, weil sie sich über alles legt.**
	 *
	 * Das Wandbild wäre der ältere Auslöser und deshalb für die Gegenprobe
	 * verlockend. Es taugt hier aber nicht als Beobachtung: `Saalbild` zeigt es
	 * erst **nach** einer laufenden oder eben geschlossenen Abstimmung, und an
	 * einer Wand mit einem Ergebnis darauf erscheint es gar nicht. Die Pause
	 * steht ganz oben in derselben Kette und ist damit die einzige Anzeige, die
	 * unabhängig vom Stand der Versammlung sichtbar wird.
	 */
	const zeigtPause = () => wand.locator('.bild.pause').count().then((n) => n > 0);
	/**
	 * Steht der Hinweis «Verbindung unterbrochen» an der Wand?
	 *
	 * Er hat zwei Eingänge: den Ereignisstrom und, seit dem 10.09.2026, den
	 * Nachzieher. Hier wird der zweite gemessen — der Strom lebt in dieser Phase
	 * ausdrücklich weiter.
	 */
	const zeigtHinweis = () => wand.locator('p.getrennt').count().then((n) => n > 0);
	/**
	 * Welcher Eingang den Hinweis ausgelöst hat: `strom` oder `rueckstand`.
	 *
	 * **Ohne diese Unterscheidung wäre die Zusicherung unten aus dem falschen
	 * Grund grün** (10.09.2026, im Code-Review gefunden). Der Satz hängt an
	 * beiden Ursachen; stirbt der Strom in der ersten Phase und kommt nicht
	 * zurück, stünde er auch dann da, wenn der Rückstand nichts beigetragen hat.
	 */
	const grundDesHinweises = () =>
		wand
			.locator('p.getrennt')
			.first()
			.getAttribute('data-grund')
			.catch(() => null);

	await schritt('Die Wand zeigt noch keine Pause', async () => {
		behaupte(
			!(await zeigtPause()),
			'Die Wand steht schon in der Pause — der Anfangsstand stimmt nicht'
		);
		return 'Anfangsstand steht';
	});

	await schritt('Die Wand zur Ruhe kommen lassen', async () => {
		/*
		 * **Sonst misst die Probe den Start und nicht den Unterbruch**
		 * (10.09.2026, hier gefunden). Beim Laden holt die Wand einmal nach, weil
		 * der erste Beitrag des Stroms und der Stand aus `data` nicht Zeichen für
		 * Zeichen dieselbe Marke ergeben. Fällt das Kappen in genau diesen Abruf,
		 * bricht er ab — und was danach geschieht, sagt nichts darüber, wie die
		 * Wand mit einem Unterbruch im Betrieb umgeht.
		 */
		await wand.waitForTimeout(8000);
		const anfangs = navigationen.length;
		await wand.waitForTimeout(3000);
		behaupte(
			navigationen.length === anfangs,
			`Die Wand navigiert noch, wenn sie ruhig sein sollte:\n       ${navigationen.join('\n       ')}`
		);

		/*
		 * **Hier der Anker, und nicht früher** (10.09.2026, beim ersten Lauf
		 * gefunden). Die Abwesenheit des Hinweises gehört gemessen, wenn die Wand
		 * steht: Unmittelbar nach dem Öffnen ist der Ereignisstrom noch nicht
		 * offen, `verbunden` also falsch, und der Satz steht zu Recht da. Ein
		 * Anker an dieser Stelle mass den Aufbau statt den Betrieb und war in
		 * einem von zwei Läufen rot.
		 *
		 * Ohne ihn wäre «der Hinweis erscheint» weiter unten auch dann erfüllt,
		 * wenn er die ganze Zeit dastünde, und «er verschwindet wieder» hätte
		 * nichts, wovon es verschwinden könnte.
		 *
		 * **Gewartet, bis er weg ist, statt in einem Augenblick nachgesehen**
		 * (Hinweis website-ab, 10.09.2026). Auf diesem Host bauen andere Sitzungen
		 * Container; jedes Anhängen sieht für einen headless Chromium wie ein
		 * Netzwechsel aus und erzeugt genau die Bedingung, die diese Anzeige
		 * auslösen SOLL. Ein Blick zu einem festen Zeitpunkt wäre dann falsch rot.
		 * Die Wand erholt sich davon in Sekunden; verlangt wird deshalb, dass der
		 * Hinweis innerhalb der Frist verschwindet, nicht dass er nie da war. Das
		 * ist zugleich der positive Anker: Er ist weggegangen, also hat ihn etwas
		 * weggenommen.
		 */
		const ruhigBis = Date.now() + 20_000;
		while (await zeigtHinweis()) {
			if (Date.now() > ruhigBis) {
				throw new Error(
					'Die ruhige Wand meldet weiter eine unterbrochene Verbindung, obwohl nichts ' +
						`gesperrt ist (Grund: ${await grundDesHinweises()})`
				);
			}
			await wand.waitForTimeout(500);
		}
		return `ruhig nach ${navigationen.length} Navigation(en), kein Hinweis`;
	});

	await schritt('Der Wand das Netz kappen', async () => {
		await kontext.setOffline(true);
		return 'offline';
	});

	await schritt('Die Sitzungsleitung unterbricht — ausserhalb des Browsers', async () => {
		const a = await senden(
			`/versammlungen/${versammlung}/leitung?/pause`,
			// Wortgleich zum Formular: Der Kasten ist der Notweg und trägt das Feld.
			{ notweg: 'ja', an: 'ja', pausentext: 'Prüflauf Netzunterbruch' },
			leitung
		);
		behaupte(a.status < 400, `Die Unterbrechung scheiterte: HTTP ${a.status}`);
		unterbrochen = true;
		return `HTTP ${a.status}`;
	});

	await schritt('Der Unterbruch wirkt wirklich', async () => {
		/*
		 * **Ohne diese Messung misst die Probe nichts.** Bekäme die Wand die
		 * Pause trotz gekapptem Netz mit, wäre der grüne Ausgang unten bloss der
		 * Normalfall ein zweites Mal.
		 */
		await wand.waitForTimeout(4000);
		behaupte(
			!(await zeigtPause()),
			'Die Wand hat die Pause trotz gekapptem Netz mitbekommen — der Unterbruch wirkt nicht'
		);
		return 'die Wand ist blind';
	});

	await schritt('Das Netz kommt zurück, die Wand holt nach', async () => {
		await kontext.setOffline(false);
		const bis = Date.now() + FRIST_MS;
		while (Date.now() < bis) {
			if (await zeigtPause().catch(() => false)) {
				return `nachgeholt nach ${Math.round((FRIST_MS - (bis - Date.now())) / 1000)} s`;
			}
			await wand.waitForTimeout(500);
		}
		const auskunft = await wand
			.evaluate(() => ({
				adresse: location.href,
				lebt: window.__lebt ?? null,
				tot: Boolean(document.querySelector('.tot')),
				anfang: document.body?.innerText?.slice(0, 120).replace(/\s+/g, ' ') ?? ''
			}))
			.catch(() => null);
		throw new Error(
			`Die Wand zeigt die Pause nach ${FRIST_MS / 1000} s nicht.\n` +
				`     Adresse: ${auskunft?.adresse ?? '(nicht ablesbar)'}\n` +
				`     Marke window.__lebt: ${auskunft?.lebt ?? 'WEG — die Seite wurde neu geladen'}\n` +
				`     Meldet «Verbindung unterbrochen»: ${auskunft?.tot ? 'ja' : 'nein'}\n` +
				`     Anfang: ${auskunft?.anfang ?? ''}\n` +
				`     Navigationen:\n       ${navigationen.join('\n       ')}\n` +
				`     Konsole:\n       ${konsole.slice(-24).join('\n       ')}`
		);
	});

	await schritt('Und sie hat dabei gelebt — kein Neuladen', async () => {
		const lebt = await wand.evaluate(() => window.__lebt ?? null);
		behaupte(
			lebt,
			'Die Marke ist weg: Die Seite wurde neu geladen. Genau das soll nicht mehr geschehen — ' +
				'ein Neuladen im Netzunterbruch endet auf Chromiums Fehlerseite und kommt nicht zurück.'
		);
		behaupte(
			wand.url().includes('/praesentation'),
			`Die Wand steht nicht mehr auf ihrer Adresse: ${wand.url()}`
		);
		return `Marke ${lebt} überlebt`;
	});

	/*
	 * ── Zweiter Teil: der Vorflug scheitert, der Strom lebt ────────────────────
	 *
	 * **Warum es diesen Teil braucht** (Hinweis von website-ab, 10.09.2026). Der
	 * Vorflug verhindert den harten Neuladevorgang — gut. Aber er tauscht einen
	 * lauten Fehler gegen einen leisen, wenn danach niemand es erneut versucht:
	 * Die Wand lebt, zeigt aber für den Rest des Abends einen alten Stand. Genau
	 * dagegen steht der Wiederanlauf in `$lib/components/neuladen`, und der war
	 * bisher nur gelesen, nicht gemessen.
	 *
	 * **Deterministisch gemacht, statt auf ein Rennen zu hoffen.** Der erste Teil
	 * kappt alles, und dann kommt gar keine Nachricht mehr an — ein Nachzug
	 * beginnt also nie und kann auch nicht am Vorflug scheitern. Hier wird
	 * deshalb **nur** der Vorflugweg gesperrt: Der Strom liefert weiter, der
	 * Nachzug beginnt, und genau der Vorflug fällt durch.
	 */
	const robotsSperre = (weg) => weg.abort('failed');

	await schritt('Nur den Vorflug sperren, den Strom laufen lassen', async () => {
		await kontext.route('**/robots.txt', robotsSperre);
		return '/robots.txt gesperrt';
	});

	await schritt('Die Sitzungsleitung fährt fort — die Wand darf es nicht sehen', async () => {
		const a = await senden(
			`/versammlungen/${versammlung}/leitung?/pause`,
			{ notweg: 'ja', an: 'nein' },
			leitung
		);
		behaupte(a.status < 400, `Das Fortfahren scheiterte: HTTP ${a.status}`);
		unterbrochen = false;

		await wand.waitForTimeout(6000);
		/*
		 * **Erst der Rückschritt, dann die Selbstprüfung** (Code-Review
		 * 10.09.2026). Umgekehrt meldete ein hart neu geladenes Fenster «dann
		 * misst dieser Teil nichts» — also «Probe kaputt» statt «Anwendung
		 * kaputt», und der Befund wäre als Testproblem abgelegt worden.
		 */
		const lebt = await wand.evaluate(() => window.__lebt ?? null).catch(() => null);
		behaupte(
			lebt,
			'Die Marke ist weg: Der gescheiterte Vorflug hat die Seite trotzdem neu geladen. ' +
				'Genau das soll er verhindern.'
		);
		behaupte(
			await zeigtPause(),
			'Die Wand hat den neuen Stand geholt, obwohl der Vorflug gesperrt ist — ' +
				'dann misst dieser Teil nichts'
		);

		/*
		 * **Und sie sagt es** (Produktentscheid 10.09.2026).
		 *
		 * Das war der eigentliche Befund an dieser Phase: Die Wand stand still,
		 * lebte, und meldete sich trotzdem als verbunden, weil der Hinweis allein
		 * am Ereignisstrom hing.
		 *
		 * Die sechs Sekunden oben reichen: Der gesperrte Vorflug scheitert sofort,
		 * der Wiederanlauf kommt nach drei Sekunden, und ab dem zweiten Fehlschlag
		 * in Folge meldet der Nachzieher den Rückstand. `data-grund` belegt, dass
		 * der Satz von ihm kommt und nicht vom Strom.
		 *
		 * **Was dieser Schritt NICHT belegt** (Gegenlesen website-ab, 10.09.2026):
		 * dass der Ereignisstrom hier noch lebt. Nur `/robots.txt` ist gesperrt,
		 * also SOLLTE er es — gemessen wird es nicht. Stürbe er unbemerkt, bliebe
		 * der Schritt grün und prüfte weiter das Richtige, nur wäre die Lage nicht
		 * mehr die beschriebene. Der billigste Anker dafür wäre eine Änderung, die
		 * der Strom nachweislich noch transportiert; für die Frage, um die es hier
		 * geht, ist er es nicht wert.
		 */
		behaupte(
			await zeigtHinweis(),
			'Die Wand steht still und meldet sich trotzdem als verbunden. ' +
				'Im Saal schaut dann jemand auf veraltete Zahlen und hält sie für die aktuellen.'
		);
		const grund = await grundDesHinweises();
		behaupte(
			grund === 'rueckstand',
			`Der Hinweis steht da, aber wegen «${grund}» statt wegen des Rückstands. ` +
				'Dann misst dieser Teil den Ereignisstrom und nicht den neuen Eingang.'
		);
		return 'Wand steht still, lebt und sagt es';
	});

	await schritt('Vorflug wieder frei — der Wiederanlauf holt nach', async () => {
		/*
		 * Ohne weiteren Beitrag des Stroms: Der Wiederanlauf in `nachzieher` ist
		 * das Einzige, was hier noch etwas anstossen kann. Holt die Wand jetzt
		 * nach, ist er belegt.
		 */
		await kontext.unroute('**/robots.txt', robotsSperre);
		const bis = Date.now() + 30_000;
		while (Date.now() < bis) {
			if (!(await zeigtPause().catch(() => true))) {
				const dauer = Math.round((30_000 - (bis - Date.now())) / 1000);
				/*
				 * **Und der Hinweis geht mit** (10.09.2026). Eine Wand, die schneller
				 * warnt als sie entwarnt, wird nach dem zweiten Mal ignoriert. Der
				 * Nachzieher setzt beim ersten geglückten Zug zurück, also muss der
				 * Satz mit demselben Zug verschwinden, der den Stand nachholt.
				 */
				const wegBis = Date.now() + 15_000;
				while (await zeigtHinweis()) {
					if (Date.now() > wegBis) {
						throw new Error(
							'Die Wand hat nachgeholt, meldet aber weiter eine unterbrochene ' +
								'Verbindung. Ein Hinweis, der stehen bleibt, wird beim nächsten Mal ' +
								`überlesen (Grund: ${await grundDesHinweises()})`
						);
					}
					await wand.waitForTimeout(300);
				}
				return `nachgeholt nach ${dauer} s, Hinweis weg`;
			}
			await wand.waitForTimeout(500);
		}
		throw new Error(
			'Die Wand steht weiter in der Pause, obwohl der Vorflug wieder frei ist.\n' +
				'     Der Wiederanlauf greift nicht: Der laute Fehler wurde gegen einen leisen ' +
				'getauscht, und im Saal hängt ein Bild, das nicht mehr stimmt.'
		);
	});

	console.log('\nDie Wand hat den Unterbruch überstanden, nachgeholt, und der Wiederanlauf trägt.\n');
} catch (fehler) {
	/*
	 * **Der Abbruch bekommt hier einen Rahmen** (10.09.2026). Bis dahin fiel der
	 * Fehler als unbehandelte Ablehnung durch, mit Stapelspur und ohne Einordnung.
	 * Ausgerechnet dieser Durchstich kappt das Netz selbst und kann eine fremde
	 * Störung nicht von seiner eigenen unterscheiden — die Frage nach der Umgebung
	 * gehört deshalb hier am dringendsten hin.
	 *
	 * Die Spur bleibt stehen: Bei einem echten Fehler im Drehbuch ist sie das
	 * Einzige, was hilft.
	 */
	console.error(`\nDurchlauf abgebrochen: ${fehler.message}`);
	console.error(umgebungsbefund(fehler.message));
	if (fehler.stack) console.error(`\n${fehler.stack}`);
	process.exitCode = 1;
} finally {
	if (unterbrochen && leitung && versammlung) {
		/*
		 * **Und den Ausgang ansehen** (Code-Review 10.09.2026). Ein `.catch()`
		 * fängt nur Netzfehler; eine Absage der Aktion käme als HTTP 400 zurück
		 * und liefe still durch. Die Versammlung bliebe dann in der Pause, und der
		 * Lauf meldete daneben «überstanden» — ein Prüfbestand, den der nächste
		 * Lauf nicht mehr benutzen kann.
		 */
		const zurueck = await senden(
			`/versammlungen/${versammlung}/leitung?/pause`,
			{ notweg: 'ja', an: 'nein' },
			leitung
		).catch(() => null);
		if (!zurueck || zurueck.status >= 400) {
			console.error(
				`\n  ⚠ Die Unterbrechung liess sich nicht zurücknehmen (${zurueck?.status ?? 'kein Netz'}).\n` +
					`    Versammlung ${versammlung} steht noch in der Pause.`
			);
		}
	}
	await browser?.close().catch(() => {});
}

/*
 * ── GEGENPROBE ─────────────────────────────────────────────────────────────
 *
 * Diese Probe ist nur etwas wert, wenn sie ohne die Behebung rot wird. So wird
 * genau eine Änderung herausgenommen — der Vorflug —, ohne den Rest anzutasten:
 *
 *   git checkout 9ca42c8 -- src/lib/nachziehen.ts
 *   docker compose exec -T app npm run build
 *   docker compose exec -T app sh -c "kill \$(ps -o pid,args | grep '[n]ode build' | awk '{print \$1}')"
 *   docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"
 *   node e2e/netzunterbruch.mjs        # muss ROT werden, Marke WEG
 *   git checkout HEAD -- src/lib/nachziehen.ts && (bauen und neu starten)
 *
 * **Nicht den ganzen Stand von `9ca42c8~1` nehmen.** Dort fehlt der
 * Pausenauslöser an dieser Wand ganz, und die Probe wird rot, weil die Wand die
 * Pause **ignoriert** — nicht, weil sie neu lädt. Ein roter Lauf aus dem
 * falschen Grund belegt nichts; gemessen und verworfen am 10.09.2026.
 */
