import { zugang } from './zugang.mjs';
/**
 * Schliesst der Ereignisstrom, wenn die Sitzungsleitung das Gerät abmeldet?
 *
 * **Warum als eigener Lauf und nicht als Test in der Datenbank.** Der Fehler
 * lag nicht in der Datenbank — dort stand `revoked_at` korrekt. Er lag in einer
 * **offenen Verbindung**, die den Widerruf nie erfuhr: Die Gerätesitzung wurde
 * einmal beim Verbinden geprüft, danach flossen nur noch Stände. Ein DB-Test
 * hätte das nie gesehen; er hätte die Zeile geprüft und für gut befunden.
 *
 * Gemessen wird deshalb am laufenden Server, mit offenem Strom: verbinden,
 * abmelden lassen, und beobachten, ob die Verbindung von selbst endet.
 *
 * **Was der Lauf braucht:** eine laufende Versammlung mit mindestens einer
 * Partei, die noch kein Gerät angemeldet hat. Er richtet sich den Rest selbst
 * ein (Ausgabecode holen, einlösen) und räumt hinterher auf, indem er das
 * Gerät wieder abmeldet.
 *
 * Aufruf: `node e2e/strom-widerruf.mjs`
 */
const ZIEL = process.env.ZIEL ?? 'http://127.0.0.1:3100';
const BENUTZER = process.env.BENUTZER ?? 'pruefer';
const KENNWORT = zugang('KENNWORT');
/** Wie lange höchstens gewartet wird, bis die Verbindung endet. */
const GEDULD_MS = 25_000;

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

console.log('\nStrom und Widerruf\n');

let leitung;
let versammlung;
let partei;
let zugangskeks;

await schritt('Als Sitzungsleitung anmelden', async () => {
	const a = await senden('/anmelden', { username: BENUTZER, kennwort: KENNWORT });
	leitung = keksAus(a, 'versammlung_sitzung');
	behaupte(leitung, `keine Sitzung (HTTP ${a.status})`);
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
		// Eine Zeile ohne angemeldetes Gerät: Dort lässt sich ein Code ausgeben,
		// ohne jemandem seine Sitzung wegzunehmen.
		const treffer = [
			...seite.matchAll(/name="partei" value="([0-9a-f-]{36})"[\s\S]{0,400}?codeAusgeben/g)
		];
		const alle = [...seite.matchAll(/action="\?\/codeAusgeben"[\s\S]{0,200}?value="([0-9a-f-]{36})"/g)];
		const kandidat = (alle[0] ?? treffer[0])?.[1];
		if (kandidat) {
			versammlung = id;
			partei = kandidat;
			break;
		}
	}
	behaupte(versammlung && partei, 'keine laufende Versammlung mit freier Partei');
	return `${versammlung.slice(0, 8)} · Partei ${partei.slice(0, 8)}`;
});

await schritt('Ein Gerät anmelden (Ausgabecode einlösen)', async () => {
	const a = await senden(
		`/versammlungen/${versammlung}/anwesenheit?/codeAusgeben`,
		{ partei },
		leitung
	);
	const roh = await a.text();
	const code = (roh.match(/(?<![\w-])[A-Z0-9]{4}-[A-Z0-9]{4}(?![\w-])/) ?? [])[0];
	behaupte(code, `kein Ausgabecode in der Antwort (HTTP ${a.status})`);

	const e = await senden('/z?/einloesen', { code });
	zugangskeks = keksAus(e, 'versammlung_zugang');
	behaupte(zugangskeks, `Code ${code} nicht eingelöst (HTTP ${e.status})`);
	return code;
});

await schritt('Der Strom endet, wenn die Leitung das Gerät abmeldet', async () => {
	const abbruch = new AbortController();
	const strom = await fetch(`${ZIEL}/z/strom`, {
		headers: { cookie: zugangskeks, accept: 'text/event-stream' },
		signal: abbruch.signal
	});
	behaupte(strom.ok, `Strom antwortet ${strom.status}`);

	let beendet = false;
	const leser = strom.body.getReader();
	const gelesen = (async () => {
		try {
			for (;;) {
				const { done } = await leser.read();
				if (done) break;
			}
		} catch {
			/* abgebrochen */
		}
		beendet = true;
	})();

	// Erst mitlaufen lassen, damit die Verbindung wirklich steht.
	await new Promise((r) => setTimeout(r, 1000));
	behaupte(!beendet, 'Der Strom war schon vor dem Widerruf zu');

	const w = await senden(
		`/versammlungen/${versammlung}/anwesenheit?/geraeteWiderrufen`,
		{ partei },
		leitung
	);
	behaupte(w.status < 400, `Abmelden scheiterte (HTTP ${w.status})`);

	const beginn = Date.now();
	while (!beendet && Date.now() - beginn < GEDULD_MS) {
		await new Promise((r) => setTimeout(r, 500));
	}

	/*
	 * **Der Befund wird VOR dem Abbruch festgehalten.**
	 *
	 * Beim ersten Anlauf stand die Prüfung nach `abbruch.abort()` — und der
	 * Abbruch beendet den Leser selbst, setzt also dasselbe Kennzeichen. Der
	 * Lauf war damit auch dann grün, wenn der Strom munter weiterlief; in der
	 * Gegenprobe mit abgeschalteter Prüfung fiel es auf («zu nach 25 s», genau
	 * die Wartezeit). Ein Wächter, der nicht scheitern kann, ist keiner.
	 */
	const rechtzeitig = beendet;
	const dauer = Math.round((Date.now() - beginn) / 1000);
	abbruch.abort();
	await gelesen;

	behaupte(
		rechtzeitig,
		`Der Strom lief nach ${Math.round(GEDULD_MS / 1000)} s noch — das Gerät bekäme weiter ` +
			'Live-Daten, obwohl sein Zugang widerrufen ist.'
	);
	return `zu nach ${dauer} s`;
});

await schritt('Und ein neuer Verbindungsversuch wird abgewiesen', async () => {
	const r = await fetch(`${ZIEL}/z/strom`, {
		headers: { cookie: zugangskeks, accept: 'text/event-stream' }
	});
	behaupte(r.status === 401, `erwartet 401, bekam ${r.status}`);
	// Der Browser verbindet nach dem Schliessen von selbst neu; genau diese
	// Absage bringt das Gerät auf die Anmeldeseite.
	return '401';
});

console.log();
if (befunde.length > 0) {
	console.error(`${befunde.length} von ${schrittzahl} Schritten rot: ${befunde.join(', ')}`);
	process.exit(1);
}
console.log(`Alle ${schrittzahl} Schritte grün.\n`);
