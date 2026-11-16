import { zugang } from './zugang.mjs';
/**
 * Wie lange braucht ein Traktandumsaufruf bis aufs Telefon?
 *
 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, Telefon 13): «Der erste
 * Traktandumsaufruf brauchte 15,6 Sekunden bis aufs Telefon. Alle späteren
 * Änderungen kamen in 0,26 bis 1,0 s. Einmal gemessen, nicht wiederholt.» Der
 * Prüfer sagt selbst, dass er es nicht wiederholt hat, und gemessen hat er am
 * Entwicklungsstapel — der übersetzt eine Route beim ersten Aufruf neu. Story
 * 5.6 verlangt zwei Sekunden.
 *
 * **Deshalb ein eigener Lauf und kein Schritt im Drehbuch.** Die Zahl hängt am
 * Stapel, nicht am Ablauf: Derselbe Ablauf ergibt am Entwicklungsstapel etwas
 * anderes als am Betriebsstapel, und genau dieser Unterschied ist die Frage.
 *
 * **Gemessen wird der Weg bis zur Verbindung des Telefons**, nicht bis zum
 * gezeichneten Bild: von der Absendung des Aufrufs bis zu dem Augenblick, in
 * dem der Ereignisstrom des Geräts einen Stand mit **genau diesem** Traktandum
 * ausliefert. Was der Browser danach zeichnet, kommt hinzu; es ist aber nicht
 * das, was einen Stapel vom anderen unterscheidet.
 *
 * **Der erste Aufruf soll kalt sein.** Deshalb werden die Traktandenkennungen
 * aus `/versammlungen/<id>/traktanden` gelesen und nicht aus der Leitungssicht:
 * `?/aufrufen` liegt in deren `+page.server.ts`, und wer die Seite vorher
 * abruft, hat die Route schon übersetzen lassen. Der erste Messwert wäre dann
 * genau um das zu klein, worum es geht.
 *
 * Er ändert Daten: Er löst einen Ausgabecode ein und ruft Traktanden auf. Am
 * Ende meldet er das Gerät wieder ab und stellt das vorher aufgerufene
 * Traktandum zurück.
 *
 * **Was er braucht:** eine **laufende** Versammlung mit mindestens zwei
 * Traktanden und einer Partei ohne angemeldetes Gerät. Der Betriebsstapel hat
 * das nicht von selbst — dort ist zuerst eine Versammlung anzulegen.
 *
 * Aufruf:
 *
 *   node e2e/telefonlatenz.mjs                              # Entwicklungsstapel
 *   ZIEL=http://127.0.0.1:3200 node e2e/telefonlatenz.mjs   # Betriebsstapel
 */
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
/** Was Story 5.6 zusagt. Wird sie gerissen, endet der Lauf rot. */
const ZUSAGE_MS = 2000;
/** Wie lange auf den Stand gewartet wird, bevor der Aufruf als verloren gilt. */
const GEDULD_MS = 30_000;

let schrittzahl = 0;
const befunde = [];

async function schritt(name, arbeit) {
	schrittzahl++;
	const nummer = String(schrittzahl).padStart(2, '0');
	try {
		const ergebnis = await arbeit();
		console.log(`  ✓ ${nummer} ${name}${ergebnis ? ` — ${ergebnis}` : ''}`);
		return true;
	} catch (fehler) {
		console.error(`  ✗ ${nummer} ${name}\n     ${fehler.message}`);
		befunde.push(name);
		return false;
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

/**
 * Eine Formularaktion absenden und ihre **Art** zurückgeben.
 *
 * **`fail()` kommt als HTTP 200** (`fb_fail_kommt_als_http_200`): Wer nur den
 * Status prüft, hält eine fachliche Absage für einen Erfolg. Mit
 * `x-sveltekit-action` und `accept: application/json` antwortet SvelteKit mit
 * `{"type":"success"|"failure"|"error"}`, und danach lässt sich unterscheiden.
 */
async function senden(pfad, felder, keks) {
	const antwort = await fetch(`${ZIEL}${pfad}`, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json',
			'x-sveltekit-action': 'true',
			origin: ZIEL,
			...(keks ? { cookie: keks } : {})
		},
		body: new URLSearchParams(felder).toString()
	});
	const roh = await antwort.text();
	let art = null;
	try {
		art = JSON.parse(roh).type ?? null;
	} catch {
		art = null;
	}
	return { antwort, roh, art, status: antwort.status };
}

/** Eine Absage, so wie sie im Rumpf steht — für eine Meldung, die etwas sagt. */
function absage(e) {
	const satz = (e.roh.match(/"nachricht":"([^"]{1,200})"/) ?? [])[1];
	return `${e.art ?? `HTTP ${e.status}`}${satz ? `: ${satz}` : ''}`;
}

console.log(`\nTelefonlatenz gegen ${ZIEL}\n`);

let leitung;
let versammlung;
let partei;
let zugangskeks;
let traktanden = [];
/** Das Traktandum, das vor dem Lauf aufgerufen war — es wird am Ende zurückgestellt. */
let vorher = null;
/** Auf welches Traktandum der Strom zuletzt gezeigt hat. */
let standTraktandum = null;
/** Auf welches Traktandum gewartet wird, und seit wann es da ist. */
let erwartet = null;
let angekommen = null;
let stromSteht = false;
/** Ob dieser Lauf den Aufruf der Versammlung tatsächlich verstellt hat. */
let hatAufgerufen = false;
let abbruch;

await schritt('Als Sitzungsleitung anmelden', async () => {
	const a = await senden('/anmelden', { username: BENUTZER, kennwort: KENNWORT });
	leitung = keksAus(a.antwort, 'versammlung_sitzung');
	behaupte(leitung, `keine Sitzung (${absage(a)})`);
	return BENUTZER;
});

await schritt('Eine laufende Versammlung mit freier Partei finden', async () => {
	const r = await fetch(`${ZIEL}/versammlungen`, { headers: { cookie: leitung } });
	const html = await r.text();
	const ids = [...html.matchAll(/\/versammlungen\/([0-9a-f-]{36})/g)].map((m) => m[1]);
	behaupte(ids.length > 0, 'keine Versammlung gefunden');

	for (const id of [...new Set(ids)]) {
		const seite = await (
			await fetch(`${ZIEL}/versammlungen/${id}/anwesenheit`, { headers: { cookie: leitung } })
		).text();
		if (!/Anwesenheit/.test(seite) || !/laufend/.test(seite)) continue;
		/*
		 * **Frei heisst: ohne angemeldetes Gerät.** «Code ausgeben» steht an
		 * jeder Zeile einer laufenden Versammlung, «Gerät abmelden» nur an
		 * denen mit Gerät (`anwesenheit/+page.svelte`). Wer nur auf
		 * `codeAusgeben` sieht, greift womöglich eine besetzte Zeile — und
		 * wirft am Ende beim Aufräumen ein fremdes, laufendes Telefon aus dem
		 * Saal. Auf der geteilten Entwicklungsdatenbank ist das kein
		 * Gedankenspiel (`fb_fremde_testdaten_nicht_aufraeumen`).
		 */
		const abschnitte = seite.split('action="?/codeAusgeben"').slice(1);
		const frei = abschnitte
			.map((a) => {
				const bis = a.indexOf('action="?/codeAusgeben"');
				const zeile = bis === -1 ? a : a.slice(0, bis);
				return /geraeteWiderrufen/.test(zeile)
					? null
					: (zeile.match(/name="partei"\s+value="([0-9a-f-]{36})"/) ?? [])[1];
			})
			.find(Boolean);
		if (frei) {
			versammlung = id;
			partei = frei;
			break;
		}
	}
	behaupte(versammlung && partei, 'keine laufende Versammlung mit freier Partei');
	return `${versammlung.slice(0, 8)} · Partei ${partei.slice(0, 8)}`;
});

await schritt('Zwei Traktanden lesen — ohne die Leitungssicht anzufassen', async () => {
	const seite = await (
		await fetch(`${ZIEL}/versammlungen/${versammlung}/traktanden`, {
			headers: { cookie: leitung }
		})
	).text();
	traktanden = [
		...new Set([...seite.matchAll(/data-traktandum="([0-9a-f-]{36})"/g)].map((m) => m[1]))
	].slice(0, 3);
	behaupte(traktanden.length >= 2, `zu wenige Traktanden: ${traktanden.length}`);
	return `${traktanden.length} Stück`;
});

const bereit = await schritt('Ein Gerät anmelden und seinen Strom öffnen', async () => {
	const a = await senden(
		`/versammlungen/${versammlung}/anwesenheit?/codeAusgeben`,
		{ partei },
		leitung
	);
	const code = (a.roh.match(/(?<![\w-])[A-Z0-9]{4}-[A-Z0-9]{4}(?![\w-])/) ?? [])[0];
	behaupte(code, `kein Ausgabecode in der Antwort (${absage(a)})`);

	const e = await senden('/z?/einloesen', { code });
	zugangskeks = keksAus(e.antwort, 'versammlung_zugang');
	behaupte(zugangskeks, `Code ${code} nicht eingelöst (${absage(e)})`);

	abbruch = new AbortController();
	const strom = await fetch(`${ZIEL}/z/strom`, {
		headers: { cookie: zugangskeks, accept: 'text/event-stream' },
		signal: abbruch.signal
	});
	behaupte(strom.ok, `Strom antwortet ${strom.status}`);

	const leser = strom.body.getReader();
	const kodierung = new TextDecoder();
	let rest = '';
	void (async () => {
		try {
			for (;;) {
				const { value, done } = await leser.read();
				if (done) break;
				rest += kodierung.decode(value, { stream: true });
				/*
				 * **Blockweise lesen, nicht zeilenweise.** Der Herzschlag ist
				 * `event: herzschlag\ndata: {}\n\n` — er trägt also eine
				 * `data:`-Zeile. Wer nur auf das Präfix sieht, hält ihn für einen
				 * Stand und misst alle fünf Sekunden einen Treffer. Ein Lauf, der
				 * im schlechten Zustand nie länger als fünf Sekunden misst, kann
				 * die Zahl gar nicht finden, für die es ihn gibt.
				 */
				const bloecke = rest.split('\n\n');
				rest = bloecke.pop() ?? '';
				for (const block of bloecke) {
					const zeilen = block.split('\n');
					const name = zeilen.find((z) => z.startsWith('event: '))?.slice(7);
					if (name) continue;
					const nutzlast = zeilen.find((z) => z.startsWith('data: '))?.slice(6);
					if (!nutzlast) continue;
					let stand;
					try {
						stand = JSON.parse(nutzlast);
					} catch {
						continue;
					}
					standTraktandum = stand.aktuellesTraktandumId ?? null;
					// **Der Stand mit genau diesem Traktandum**, nicht irgendeine
					// Änderung: Auf der geteilten Datenbank meldet der Strom auch,
					// was eine andere Sitzung tut.
					if (erwartet && standTraktandum === erwartet && angekommen === null) {
						angekommen = Date.now();
					}
				}
			}
		} catch {
			/* abgebrochen */
		}
	})();

	const bis = Date.now() + 10_000;
	while (standTraktandum === undefined && Date.now() < bis) {
		await new Promise((r) => setTimeout(r, 50));
	}
	// Der Anfangsstand kommt beim Verbinden; er sagt zugleich, worauf die
	// Versammlung gerade steht — das wird am Ende zurückgestellt.
	await new Promise((r) => setTimeout(r, 500));
	vorher = standTraktandum;
	stromSteht = true;
	return `Code ${code}, Anfangsstand steht (aufgerufen: ${vorher ? vorher.slice(0, 8) : 'keines'})`;
});

/** Ruft ein Traktandum auf und misst, wann der Strom davon erzählt. */
async function messe(traktandumId) {
	erwartet = traktandumId;
	angekommen = null;
	const beginn = Date.now();
	const a = await senden(
		`/versammlungen/${versammlung}/leitung?/aufrufen`,
		{ traktandum: traktandumId },
		leitung
	);
	hatAufgerufen = true;
	behaupte(a.art === 'success', `Aufruf abgewiesen (${absage(a)})`);

	while (angekommen === null && Date.now() - beginn < GEDULD_MS) {
		await new Promise((r) => setTimeout(r, 5));
	}
	behaupte(
		angekommen !== null,
		`Nach ${Math.round(GEDULD_MS / 1000)} s stand ${traktandumId.slice(0, 8)} nicht auf dem Gerät`
	);
	return angekommen - beginn;
}

const messungen = [];

if (bereit) {
	// Nur die Traktanden, auf denen die Versammlung nicht schon steht: Ein
	// Aufruf, der nichts ändert, löst keinen neuen Stand aus.
	for (const [i, t] of traktanden.filter((t) => t !== vorher).entries()) {
		await schritt(`Aufruf ${i + 1}`, async () => {
			const ms = await messe(t);
			messungen.push(ms);
			return `${(ms / 1000).toFixed(3)} s`;
		});
	}
}

await schritt('Gerät abmelden und den Aufruf zurückstellen', async () => {
	abbruch?.abort();
	if (!leitung) return 'nichts einzurichten gewesen';
	/*
	 * **Nur zurückstellen, wenn wirklich aufgerufen wurde** (Sicherheitsdurchgang
	 * 07.09.2026). Sonst nähme ein Lauf, der vor der ersten Messung scheitert,
	 * in einer geteilten laufenden Versammlung den Aufruf zurück — er stellte
	 * also nicht wieder her, sondern änderte.
	 */
	if (versammlung && hatAufgerufen) {
		await senden(
			`/versammlungen/${versammlung}/leitung?/aufrufen`,
			{ traktandum: vorher ?? '' },
			leitung
		);
	}
	if (partei && stromSteht) {
		const w = await senden(
			`/versammlungen/${versammlung}/anwesenheit?/geraeteWiderrufen`,
			{ partei },
			leitung
		);
		behaupte(w.art === 'success', `Abmelden scheiterte (${absage(w)})`);
	}
	if (!hatAufgerufen) return 'nichts verstellt gewesen';
	return vorher ? `zurück auf ${vorher.slice(0, 8)}` : 'Aufruf zurückgenommen';
});

console.log();
let gerissen = 0;
if (messungen.length > 0) {
	const spaetere = messungen.slice(1);
	console.log(`Erster Aufruf: ${(messungen[0] / 1000).toFixed(3)} s`);
	if (spaetere.length > 0) {
		const min = Math.min(...spaetere) / 1000;
		const max = Math.max(...spaetere) / 1000;
		console.log(`Spätere:       ${min.toFixed(3)} bis ${max.toFixed(3)} s`);
	}
	gerissen = messungen.filter((m) => m > ZUSAGE_MS).length;
	console.log(
		gerissen === 0
			? `Alle ${messungen.length} unter der Zusage von ${ZUSAGE_MS / 1000} s (Story 5.6).`
			: `${gerissen} von ${messungen.length} über der Zusage von ${ZUSAGE_MS / 1000} s (Story 5.6).`
	);
}

console.log();
if (befunde.length > 0) {
	console.error(`${befunde.length} von ${schrittzahl} Schritten rot: ${befunde.join(', ')}`);
	process.exit(1);
}
if (gerissen > 0) {
	// **Sonst misst der Lauf nur.** Eine Zusage, die im schlechten Zustand
	// grün bleibt, ist keine (`fb_probe_muss_rot_werden`).
	console.error(
		`${gerissen} Aufruf(e) über der Zusage von ${ZUSAGE_MS / 1000} s — Story 5.6 nicht eingehalten.`
	);
	process.exit(1);
}
if (messungen.length === 0) {
	console.error('Keine Messung zustande gekommen.');
	process.exit(1);
}
console.log(`Alle ${schrittzahl} Schritte grün.\n`);
