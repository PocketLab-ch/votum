import { zugang } from './zugang.mjs';
/**
 * Die Herkunftssperre am GEBAUTEN Stand (V4).
 *
 * **Warum dieser Durchstich nur dort etwas misst.** SvelteKits Schutz gegen
 * fremde Formulare steht in `runtime/server/respond.js` hinter
 * `if (!__SVELTEKIT_DEV__)`. Auf dem Entwicklungsserver ist er abgeschaltet:
 * Am 12.10.2026 bestätigt, ein POST mit fremdem `Origin` auf die Dev-Adresse
 * wird normal verarbeitet (401 «stimmt nicht»), statt mit 403 abgewiesen zu
 * werden. Wer die Sperre dort prüft, misst ihre Abwesenheit und hält sie für
 * vorhanden.
 *
 * **Und warum das kein Test sein kann.** Ob eine Absage beim Aufrufer ankommt,
 * hängt an SvelteKits Auflösung, am Hakenwerk und an der Reihenfolge der
 * Wächter. Das entscheidet sich erst am laufenden, gebauten Stand.
 *
 * ## Die drei Versuche, und warum der dritte der wichtigste ist
 *
 * | Versuch | Erwartung |
 * |---|---|
 * | POST ohne `Origin` | 403, «Cross-site POST form submissions are forbidden» |
 * | POST mit fremdem `Origin` | 403, derselbe Satz |
 * | POST mit eigenem `Origin` | die **fachliche** Antwort |
 *
 * **Die Gegenhälfte ist Pflicht.** Ohne den dritten Versuch wäre ein Stand
 * grün, der schlicht jede Formularanfrage abweist, etwa ein Proxy, der alle
 * POSTs blockt, oder eine Fassung, die die Herkunft mit dem falschen Wert
 * vergleicht. Gemessen am 11.09.2026 war genau das ein echter Fall: Mit
 * `referrer-policy: no-referrer` schickt Chromium `Origin: null` auch bei
 * einem Formular auf die eigene Adresse, und der gebaute Stand wies dann
 * jedes Formular ohne Skript ab. Der dritte Versuch fängt das.
 *
 * Die fachliche Antwort ist hier absichtlich eine **Absage**: falsche
 * Zugangsdaten müssen «Benutzername oder Kennwort stimmt nicht» ergeben und
 * nicht die Herkunftssperre. Zusätzlich die gelingende Anmeldung, damit eine
 * spätere Änderung an den Zugangsdaten den Durchstich nicht stillschweigend
 * in die Gegenhälfte hineinlaufen lässt.
 *
 * ## Aufruf
 *
 * Gegen den gebauten Stand, im Container des Dev-Stapels:
 *
 * ```
 * IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
 *      $(docker compose ps -q app))
 * docker compose exec -T app npm run build
 * docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"
 *
 * ZIEL=http://$IP:3101 node e2e/herkunft.mjs
 * ```
 *
 * **Gegen den Entwicklungsserver läuft dieser Durchstich absichtlich rot**
 * (die beiden 403 bleiben aus), Schritt 01 sagt dann, woran es liegt.
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
/** Der Wortlaut der eingebauten Sperre, wörtlich aus `respond.js`. */
const CSRF_SATZ = 'Cross-site POST form submissions are forbidden';

let nummer = 0;
const fehler = [];

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

async function schritt(name, arbeit) {
	nummer += 1;
	try {
		const zusatz = await arbeit();
		console.log(`  ✓ ${String(nummer).padStart(2, '0')} ${name}${zusatz ? ` — ${zusatz}` : ''}`);
	} catch (unfall) {
		fehler.push(`${name}: ${unfall.message}`);
		console.log(`  ✗ ${String(nummer).padStart(2, '0')} ${name}\n     ${unfall.message}`);
	}
}

/**
 * Ein Formular-POST, wörtlich wie ihn ein Browser abschickt.
 *
 * `accept: text/html` gehört dazu: Ohne die Kopfzeile antwortet die Aktion
 * maschinenlesbar (JSON) statt als Seite. Für die Prüfung der Herkunft ist
 * das gleichgültig, für den Wortlaut der fachlichen Absage nicht.
 */
async function posten(pfad, felder, kopfzeilen = {}) {
	const antwort = await fetch(`${ZIEL}${pfad}`, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'text/html',
			...kopfzeilen
		},
		body: new URLSearchParams(felder).toString()
	});
	return { status: antwort.status, koerper: await antwort.text() };
}

/** Die Herkunft, die ein Browser auf derselben Adresse mitschickt. */
const EIGENE_HERKUNFT = ZIEL;

console.log('\nDie Herkunftssperre am gebauten Stand — V4\n');

await schritt('Der gebaute Stand antwortet UND die Herkunftssperre ist aktiv', async () => {
	const r = await fetch(`${ZIEL}/`, { redirect: 'manual' });
	behaupte(
		r.status < 500,
		`${ZIEL} antwortet mit ${r.status}. Läuft der gebaute Stand?\n` +
			'  IP=$(docker inspect -f \'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}\' ' +
			'$(docker compose ps -q app))\n' +
			'  docker compose exec -T app npm run build\n' +
			'  docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build"\n' +
			'  ZIEL=http://$IP:3101 node e2e/herkunft.mjs'
	);

	/*
	 * **Der Anker, der diesen Lauf an den gebauten Stand bindet.** Läuft er
	 * gegen den Entwicklungsserver, sehen Schritt 02 und 03 ihre 403 nie und
	 * werden rot, mit «HTTP 200 statt 403». Das ist richtig so, nennt aber
	 * nicht die Ursache. Deshalb steht sie hier: einmal denselben POST
	 * absetzen und die Abwesenheit der Sperre ausdrücklich melden.
	 */
	const ohne = await posten('/anmelden', { username: 'gibtesnicht', kennwort: 'egal' });
	behaupte(
		ohne.status === 403,
		`Ohne \`Origin\` kommt HTTP ${ohne.status} statt 403. Auf dem ` +
			'Entwicklungsserver ist der Schutz abgeschaltet; dieser Durchstich misst nur am ' +
			'gebauten Stand etwas.'
	);
	return `${ZIEL} · POST ohne Origin: 403`;
});

await schritt('Ohne `Origin` wird der POST abgewiesen, mit dem Satz der Sperre', async () => {
	const r = await posten('/anmelden', { username: 'gibtesnicht', kennwort: 'egal' });
	behaupte(r.status === 403, `HTTP ${r.status} statt 403`);
	behaupte(
		r.koerper.includes(CSRF_SATZ),
		`403, aber ohne den erwarteten Satz. Körper: ${r.koerper.slice(0, 200)}`
	);
	return `403 · «${CSRF_SATZ}»`;
});

await schritt('Mit fremdem `Origin` ebenso', async () => {
	const r = await posten(
		'/anmelden',
		{ username: 'gibtesnicht', kennwort: 'egal' },
		{ origin: 'https://fremde.example' }
	);
	behaupte(r.status === 403, `HTTP ${r.status} statt 403`);
	behaupte(
		r.koerper.includes(CSRF_SATZ),
		`403, aber ohne den erwarteten Satz. Körper: ${r.koerper.slice(0, 200)}`
	);
	return '403 · abgewiesen';
});

await schritt('Mit eigenem `Origin`: falsche Zugangsdaten werden fachlich abgewiesen', async () => {
	const r = await posten(
		'/anmelden',
		{ username: 'gibtesnicht', kennwort: 'egal' },
		{ origin: EIGENE_HERKUNFT }
	);
	behaupte(
		!r.koerper.includes(CSRF_SATZ),
		'Auch mit eigenem `Origin` kommt die Herkunftssperre, dann weist dieser Stand ' +
			'JEDES Formular ab, und die Herkunft wird gar nicht geprüft.'
	);
	behaupte(
		/Benutzername oder Kennwort stimmt nicht/i.test(r.koerper),
		`Keine fachliche Antwort, sondern HTTP ${r.status}: ${r.koerper.slice(0, 300)}`
	);
	return `fachlich abgewiesen (HTTP ${r.status})`;
});

await schritt('Mit eigenem `Origin`: die gelingende Anmeldung kommt durch', async () => {
	const r = await posten('/anmelden', { username: BENUTZER, kennwort: KENNWORT }, { origin: EIGENE_HERKUNFT });
	behaupte(
		!r.koerper.includes(CSRF_SATZ),
		'Auch die gültige Anmeldung wird als fremdes Formular abgewiesen, im Saal käme ' +
			'ohne Skript niemand mehr hinein (11.09.2026, `referrer-policy: no-referrer`).'
	);
	/*
	 * Die Aktion leitet bei Erfolg mit 303 auf `/` um; als rohe Anfrage ohne
	 * `fetch`-Semantik wird daraus eine Seite. Beides gilt.
	 */
	const gelungen = r.status === 303 || /Abmelden|Übersicht/i.test(r.koerper);
	behaupte(gelungen, `Anmeldung kam nicht durch: HTTP ${r.status} ${r.koerper.slice(0, 200)}`);
	return `als ${BENUTZER} (HTTP ${r.status})`;
});

console.log('');
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	process.exit(1);
}
console.log(`Alle ${nummer} Schritte grün.`);
