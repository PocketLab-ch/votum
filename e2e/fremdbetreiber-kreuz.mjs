/**
 * Fremdbetreiber über Kreuz: eigener Pfad, fremde Kennung im Feld. Der
 * Kreuzteil von `e2e/fremdbetreiber.mjs`, der ihn mit `--kreuz` fährt, mit
 * demselben Betreiber B, demselben Aufbau und demselben Aufräumen.
 *
 * **Die Frage.** Der Pfadteil schickt eine Kennung von B in der Adresse, der
 * Feldteil eine im Feld an Wegen ohne Kennung in der Adresse. Offen war die
 * Mischung (Pendenz «Eigener Pfad, fremde Kennung im Feld»): ein Weg unter
 * einem Pfad von A (`/versammlungen/<A>/leitung`, `/tage/<A>/…`,
 * `/gemeinschaften/<A>/…`), dessen Formularfeld eine Kennung von B trägt. Der
 * Pfad bindet die Aktion an A; ob das Feld an denselben Mandanten gebunden
 * wird, entscheidet jede Aktion für sich.
 *
 * **Messen, nicht abnehmen.** Dieser Teil kennt kein «richtig» je Weg wie der
 * Feldteil. Er schickt je Kennungsfeld eine Kennung von B, die übrigen Felder
 * mit Werten von A, und hält je Versuch fest: Status, Satz, Inhalt von B in
 * der Antwort, 5xx und die Änderung in der Datenbank, gemessen vor und nach
 * genau diesem Versuch. Rot ist, was nach jeder Lesart ein Befund ist: 5xx,
 * keine Antwort, Inhalt von B, eine Weiterleitung auf B, eine Änderung an B,
 * eine Kennung von B in einer Zeile von A, ein Verlaufseintrag, der B nennt.
 * Was sonst in der Datenbank geschah, steht je Versuch im Protokoll und im
 * Bericht, eingeordnet von Hand.
 *
 * **Mit Gegenhälfte** (seit 28.10.2026, Auftrag 2c): Nach dem Durchgang mit
 * B schickt der Lauf jedes Feld noch einmal mit der Kennung von A. Erst der
 * Vergleich sagt, ob eine Absage an der Kennung hängt (`kreuzgegenhaelfte`:
 * «B abgelehnt, A durch» oder «A weiter», «beide abgelehnt», «B durch»).
 * Wege, die vor der Kennung an einem Zustand von A enden, fahren in einem
 * eigenen Zustand (`zustand` im Urteil, vorbereitet und zurückgesetzt in
 * `kreuzZustaende` in `fremdbetreiber.mjs`).
 *
 * **Abgeleitet und eingeordnet, nicht aufgezählt**, wie im Feldteil: Die Wege
 * kommen aus `src/routes`, die Felder aus ihrer Quelle eine Stufe tief
 * (`felderAus`), dazu drei Formen, die der Feldteil nicht braucht: gespreizte
 * Aktionen aus `$lib` (`...einlassaktionen`), Aktionen aus einer Fabrik
 * (`vorlegen: handlung(…)`) und Felder mit der Kennung im Namen als Template
 * (`label.${id}`). Template-Felder liest die Ableitung nur im Aktionsrumpf,
 * nicht in den Helfern: `quote:${id}` in `mitgliederAusFormular` sieht sie
 * nicht (Codeprüfung 27.10.2026). Von Hand steht nur das Urteil je Feld: welche Kennungsart
 * es trägt (`ARTEN`) oder warum keine. Ein Kennungsfeld ohne Urteil macht den
 * Lauf rot, ebenso ein Urteil ohne Weg.
 *
 * ## Aufruf, gegen den gebauten Stand wie `fremdbetreiber.mjs`
 *
 * ```
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber-kreuz.mjs
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber-kreuz.mjs --liste   # nur Wege und Urteile
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber-kreuz.mjs --liste --alle   # auch die Wege ohne Kennungsfeld
 * ```
 *
 * Umgebung: `KREUZ_PROTOKOLL=<datei>` schreibt das Protokoll je Versuch als
 * JSON, `KREUZ_NUR=<muster>` fährt nur die Versuche, deren «Weg [Feld]» passt,
 * `KREUZ_RUHE_MS` (300) wartet vor dem zweiten Abdruck. Die Zahl der
 * Wiederholungen nach einem Verbindungsfehler steht am Ende der Gegenhälfte;
 * seit `sql()` asynchron läuft, ist sie 0.
 *
 * Nicht im Vor-Auslieferungslauf: Der Lauf darf rot enden, solange die
 * Befunde offen sind (Berichte
 * `.auftraege/2026-10-27-votum-eigener-pfad-fremde-kennung-bericht.md` und
 * `.auftraege/2026-10-28-votum-messluecke-block-d-bericht.md`).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { felderAus, felderVon, kernsatz, rumpf } from './fremdbetreiber-felder.mjs';

// ── Wege aus dem Baum ───────────────────────────────────────────────────────

/** Die Bäume unter einem Mandantenpfad, mit der Art ihrer Kennung. */
const MANDANTENBAEUME = [
	['versammlungen/[id=kennung]', 'versammlung'],
	['tage/[id=kennung]', 'abend'],
	['gemeinschaften/[id=kennung]', 'gemeinschaft'],
	['personen/[id=kennung]', 'person'],
	['betreiber/loeschen/[id=kennung]', 'betreiber']
];

function dateien(verzeichnis) {
	const treffer = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		if (eintrag.startsWith('_') || eintrag.startsWith('.')) continue;
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateien(pfad));
		else treffer.push(pfad);
	}
	return treffer;
}

/** Der Inhalt des Objekts nach `kopf`, bis zur passenden Klammer. */
function objektblock(quelle, kopf) {
	const anfang = quelle.indexOf(kopf);
	if (anfang < 0) return null;
	const auf = quelle.indexOf('{', anfang);
	let tiefe = 0;
	for (let i = auf; i < quelle.length; i++) {
		if (quelle[i] === '{') tiefe++;
		else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(auf, i + 1);
	}
	return quelle.slice(auf);
}

/** Der Rumpf einer Aktion `name` in einem Aktionsblock, bis zur nächsten. */
function aktionsrumpf(block, name) {
	const kopf = new RegExp(`^\\t${name}\\s*[:(]`, 'm').exec(block);
	if (!kopf) return null;
	const rest = block.slice(kopf.index + kopf[0].length);
	const naechste = /^\t[A-Za-z_]\w*\s*[:(]/m.exec(rest);
	return rest.slice(0, naechste ? naechste.index : undefined);
}

/**
 * Felder mit der Kennung im Namen als Template: `daten.get(\`label.${id}\`)`.
 * Sie heissen hier nach ihrem festen Teil (`label.`), wie `wahl:` im Feldteil.
 */
const TEMPLATE = /\.(?:get|getAll|has)\(\s*`([A-Za-z_][\w.:-]*?)\$\{/g;

function templatefelder(text) {
	return new Set([...text.matchAll(TEMPLATE)].map((m) => m[1]).filter((n) => /[.:-]$/.test(n)));
}

/**
 * Die Aktionen einer Seite samt dem Abschnitt, aus dem ihre Felder kommen.
 *
 * Drei Formen: die Aktion steht im Block (`name: async …`), sie kommt aus
 * einer Fabrik derselben Datei (`name: handlung(…)`, Felder aus der Fabrik),
 * oder sie ist gespreizt (`...einlassaktionen`) bzw. zeigt auf ein solches
 * Objekt (`name: einlassaktionen.name`). Was sich nicht auflösen lässt, bricht
 * ab, statt eine kürzere Liste als vollständig auszugeben.
 */
function aktionen(wurzel, datei, quelle) {
	const block = objektblock(quelle, 'export const actions');
	if (block === null) return [];
	const liste = [];
	const fremdModul = (objekt) => {
		const modul = quelle.match(
			new RegExp(`import\\s*\\{[^}]*\\b${objekt}\\b[^}]*\\}\\s*from\\s*'\\$lib/([^']+)'`)
		)?.[1];
		if (!modul) throw new Error(`${datei}: «${objekt}» nicht auflösbar (Import nicht gefunden)`);
		const ziel = join(wurzel, 'src/lib', `${modul}.ts`);
		const fremdQuelle = readFileSync(ziel, 'utf8');
		const fremdBlock = objektblock(fremdQuelle, `export const ${objekt}`);
		if (fremdBlock === null) throw new Error(`${datei}: «${objekt}» steht nicht in ${relative(wurzel, ziel)}`);
		return { quelle: fremdQuelle, block: fremdBlock };
	};
	for (const [, name, wert] of block.matchAll(/^\t([A-Za-z_]\w*)\s*:\s*([^\n]*)/gm)) {
		const verweis = wert.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*),?\s*$/);
		const fabrik = wert.match(/^([A-Za-z_]\w*)\(/);
		if (verweis) {
			const f = fremdModul(verweis[1]);
			liste.push({ aktion: name, quelle: f.quelle, teil: aktionsrumpf(f.block, verweis[2]) ?? '', form: 'Verweis' });
		} else if (fabrik && !/^async\b/.test(wert)) {
			liste.push({ aktion: name, quelle, teil: rumpf(quelle, `function ${fabrik[1]}(`) ?? '', form: 'Fabrik' });
		} else {
			liste.push({ aktion: name, quelle, teil: null, form: 'Block' });
		}
	}
	for (const [, objekt] of block.matchAll(/(?:^\t|^\{\s*)\.\.\.([A-Za-z_]\w*)/gm)) {
		const f = fremdModul(objekt);
		for (const [, name] of f.block.matchAll(/^\t([A-Za-z_]\w*)\s*[:(]/gm)) {
			// Eine eigene Aktion gleichen Namens überschreibt die gespreizte.
			if (liste.some((a) => a.aktion === name)) continue;
			liste.push({ aktion: name, quelle: f.quelle, teil: aktionsrumpf(f.block, name) ?? '', form: 'gespreizt' });
		}
	}
	return liste;
}

/**
 * Was eine Ladefunktion aus der Adresse liest: `url.searchParams.get('x')` und
 * Helfer über der Adresse (`wert(url, 'x')`).
 *
 * **Nicht `felderVon` für GET.** Dort reicht der Abschnitt von `load` bis
 * `actions` und nimmt Helfer der Aktionen mit, die dazwischen stehen: `GET
 * /tage/<id>/vollmachten` las so scheinbar `meeting` und `id` aus der Fabrik
 * `handlung` (gemessen 27.10.2026).
 */
function adressfelder(quelle) {
	const anfang = quelle.indexOf('export const load');
	if (anfang < 0) return new Set();
	const ende = quelle.indexOf('export const actions', anfang);
	const teil = quelle.slice(anfang, ende < 0 ? undefined : ende);
	return new Set(
		[
			...teil.matchAll(/searchParams\.(?:get|getAll|has)\(\s*'([^']+)'\s*\)/g),
			...teil.matchAll(/\b[A-Za-z_]\w*\(\s*url\s*,\s*'([^']+)'\s*\)/g)
		].map((m) => m[1])
	);
}

function methoden(quelle) {
	return [
		...new Set(
			[...quelle.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1])
		)
	];
}

/**
 * Alle Wege unter einem Mandantenpfad mit den Feldern, die sie lesen.
 *
 * Ein Weg ist eine Seitenaktion (POST), eine Ladefunktion (GET mit
 * Abfrageparametern) oder ein Endpunkt (`+server.ts`, Felder aus der ganzen
 * Datei). Die Felder stehen ungefiltert da; welche davon eine Kennung tragen,
 * entscheidet `einordnen`.
 */
export function kreuzwegeErheben(wurzel) {
	const wege = [];
	for (const datei of dateien(join(wurzel, 'src/routes'))) {
		const relativ = relative(join(wurzel, 'src/routes'), datei);
		const name = relativ.split('/').pop();
		if (!['+page.server.ts', '+layout.server.ts', '+server.ts'].includes(name)) continue;
		const baum = MANDANTENBAEUME.find(([p]) => relativ.startsWith(`${p}/`));
		if (!baum) continue;
		const bau = `/${relativ.slice(0, -name.length - 1)}`;
		const quelle = readFileSync(datei, 'utf8');
		const dateiRel = relative(wurzel, datei);
		const neu = (methode, aktion, felder, form) =>
			wege.push({
				methode,
				aktion,
				bau,
				baum: baum[1],
				datei: dateiRel,
				endpunkt: name === '+server.ts',
				form,
				felder: [...felder].sort(),
				schluessel: `${methode} ${bau}${aktion ? `?/${aktion}` : ''}${form === 'Layout' ? ' (Layout)' : ''}`
			});
		if (name === '+server.ts') {
			const felder = new Set([...felderVon(wurzel, dateiRel, { endpunkt: true }), ...templatefelder(quelle)]);
			for (const m of methoden(quelle)) neu(m, undefined, felder, 'Endpunkt');
			continue;
		}
		/*
		 * **Die Ladefunktion des Layouts gilt für jede Seite darunter** und liest
		 * eigene Abfrageparameter (`/gemeinschaften/<id>?zur=<versammlung>`).
		 * Geprüft wird sie an der Wurzel ihres Baums.
		 */
		if (name === '+layout.server.ts') {
			neu('GET', undefined, adressfelder(quelle), 'Layout');
			continue;
		}
		neu('GET', undefined, adressfelder(quelle), 'Ladefunktion');
		for (const a of aktionen(wurzel, dateiRel, quelle)) {
			const felder =
				a.teil === null
					? new Set([
							...felderVon(wurzel, dateiRel, { methode: 'POST', aktion: a.aktion }),
							...templatefelder(aktionsrumpf(objektblock(quelle, 'export const actions'), a.aktion) ?? '')
						])
					: new Set([...felderAus(wurzel, a.quelle, a.teil), ...templatefelder(a.teil)]);
			neu('POST', a.aktion, felder, a.form);
		}
	}
	return wege.sort((x, y) => x.schluessel.localeCompare(y.schluessel));
}

// ── Kennungsarten und Urteile ───────────────────────────────────────────────

/**
 * Die Kennungsarten, die ein Feld unter einem Mandantenpfad tragen kann, mit
 * ihrer Tabelle; `satz` beschreibt die Art für den Leser, wo der Name nicht
 * reicht. `fremdbetreiber.mjs` legt Zeilen bei B und bei A an
 * (`kreuzKennungen`); fehlt der Wert für B, steht der Versuch als «nicht
 * gefüllt» mit dem Grund «B hat keine Zeile der Art …» im Protokoll.
 * `entwurf`, `huelle` und `mitglied` trägt am 27.10.2026 kein Feld.
 */
export const ARTEN = {
	versammlung: { tabelle: 'meeting' },
	entwurf: { tabelle: 'meeting', satz: 'Versammlung im Entwurf' },
	abend: { tabelle: 'meeting_day' },
	gemeinschaft: { tabelle: 'stweg' },
	person: { tabelle: 'person' },
	partei: { tabelle: 'party' },
	huelle: { tabelle: 'party', satz: 'gemeinschaftliche Partei (Hülle)' },
	standPartei: { tabelle: 'snapshot_party' },
	einheit: { tabelle: 'unit' },
	traktandum: { tabelle: 'agenda_item' },
	durchgang: { tabelle: 'voting_round' },
	vollmacht: { tabelle: 'proxy' },
	ausstand: { tabelle: 'recusal' },
	geschaeft: { tabelle: 'business' },
	pendenz: { tabelle: 'pendenz' },
	ruege: { tabelle: 'objection' },
	meldung: { tabelle: 'room_entry_request' },
	mitglied: { tabelle: 'party_member' },
	vertretung: { tabelle: 'representation' },
	nutzniessung: { tabelle: 'usufruct' },
	regel: { tabelle: 'bylaw_quorum_rule' },
	kinutzung: { tabelle: 'ai_usage' },
	verteiler: { tabelle: 'quota_kind' },
	anhang: { tabelle: 'attachment' },
	geraet: { tabelle: 'handover_device' },
	zugangscode: { tabelle: 'meeting_access', satz: 'Klartextcode, gesucht über seinen Prüfwert' }
};

/**
 * Ob ein Feldname nach einer Kennung aussieht. **Absichtlich weit**, wie im
 * Feldteil: Ein Name zu viel kostet ein Urteil «keine» mit Grund, einer zu
 * wenig eine Lücke, die niemand sieht.
 */
const KANDIDATEN = new Set([
	'id', 'ids', 'partei', 'meeting', 'meetings', 'versammlung', 'traktandum', 'geschaeft', 'meldung',
	'durchgang', 'mitglied', 'person', 'vertritt', 'bevollmaechtigt', 'vertreter', 'eigentuemer',
	'ausstand', 'pendenz', 'ruege', 'entfernen', 'tag', 'stufe', 'geraet', 'elternteil',
	'neuerElternteil', 'vor', 'zuordnung', 'code', 'herkunft', 'liegenschaft', 'zeile', 'zeilen',
	'erfordernis', 'schluessel', 'haus', 'zur', 'quelle', 'betroffene', 'antragstellerGemeinschaft',
	'antragstellerPartei', 'antragstellerParteien', 'nummer', 'gemeinschaft', 'abend', 'konto',
	'einheit', 'fuer', 'gegenstand', 'paket', 'wer', 'verantwortlich', 'ast', 'p'
]);
export const istKandidat = (feld) => KANDIDATEN.has(feld) || /Id$/.test(feld) || /[.:]$/.test(feld);

/**
 * Das Urteil nach dem Namen, wo er in jedem Weg dasselbe meint. Belegt je Name
 * an den Lesestellen (Bericht, Abschnitt «Kennungsarten»); wo derselbe Name je
 * Weg anderes meint (`id`, `partei`), steht hier nichts, und jeder Weg braucht
 * sein eigenes Urteil in `KREUZWEGE`.
 */
const NACH_NAMEN = {
	traktandum: 'traktandum',
	traktandumId: 'traktandum',
	parentId: 'traktandum',
	neuerElternteil: 'traktandum',
	elternteil: 'traktandum',
	versammlung: 'versammlung',
	meeting: 'versammlung',
	meetings: 'versammlung',
	vorgaengerId: 'versammlung',
	zur: 'versammlung',
	geschaeft: 'geschaeft',
	meldung: 'meldung',
	nutzungId: 'kinutzung',
	durchgang: 'durchgang',
	unitId: 'einheit',
	einheitId: 'einheit',
	entfernen: 'einheit',
	'label.': 'einheit',
	'kind.': 'einheit',
	'kopf.': 'einheit',
	'zimmer.': 'einheit',
	'flaeche.': 'einheit',
	'lage.': 'einheit',
	vertritt: 'standPartei',
	bevollmaechtigt: 'standPartei',
	// `findeZiel` nimmt Stand- oder Stammpartei (`anwesenheit.ts`); geprüft mit der Stammpartei.
	partei: 'partei',
	parteiId: 'partei',
	partyId: 'partei',
	mitgliedId: 'partei',
	antragstellerPartei: 'partei',
	antragstellerParteien: 'partei',
	betroffene: 'partei',
	haus: 'partei',
	'wahl:': 'partei',
	antragstellerGemeinschaft: 'gemeinschaft',
	parentStwegId: 'gemeinschaft',
	memberStwegId: 'gemeinschaft',
	mitglied: 'gemeinschaft',
	personId: 'person',
	mitberechtigterPersonId: 'person',
	person: 'person',
	pendenz: 'pendenz',
	ruege: 'ruege',
	ausstand: 'ausstand',
	regelId: 'regel',
	artId: 'verteiler',
	geraet: 'geraet',
	code: 'zugangscode',
	// Zusammengesetzt: «Versammlung|Partei» (`/tage/<id>/einlass?/liste`) und
	// «Versammlung|Durchgang» einer Mitgliedsgemeinschaft (`weisungen?/erfassen`).
	zeile: 'versammlung|partei',
	quelle: 'versammlung|durchgang',
	ast: { keine: 'Ast des Entscheidbaums im Regelwerk, Code statt Zeile' },
	p: { keine: 'Antwortfolge im Entscheidbaum, keine Zeile' },
	erfordernis: { keine: 'Knoten des Regelwerks im Code' },
	knotenId: { keine: 'Knoten des Regelwerks im Code (`node_id` ist Text)' },
	schluessel: { keine: 'Vorlagenschlüssel aus dem Code' },
	herkunft: { keine: 'Freitext zur Herkunft eines Pakets (`origin_note`)' },
	liegenschaft: { keine: 'Kennung im Fremdsystem Immotool, keine Zeile von Votum' },
	zeilen: { keine: 'CSV-Text der Sammelerfassung' },
	paket: { keine: 'hochgeladene Datei; ihre Versammlungskennung prüft der Feldteil an /pruefen' },
	wer: { keine: 'Freitext (Rüge, Stichentscheid)' },
	verantwortlich: { keine: 'Freitext der Pendenz (`responsible`)' },
	nummer: { keine: 'Traktandennummer als Text' },
	stufe: { keine: 'Aufzählungswert der Versammlung' },
	eigentuemer: { keine: 'Schalter «ja»' },
	zuordnung: { keine: 'Prüfmarke, verglichen mit `zuordnungsmarke`' },
	mitberechtigterKennung: { keine: 'Zeilenschlüssel des Formulars (`p<i>`)' },
	vertreter: { keine: 'Zeilenschlüssel des Formulars oder `holder_key` aus der Liste dieser Versammlung, keine Zeile' }
};

/**
 * Je Weg: die Felder, deren Bedeutung vom Weg abhängt (Art oder `{ keine }`
 * mit Grund), der Pfad (`entwurf` für Wege, die nur im Entwurf arbeiten) und
 * `zuletzt` für Wege, die den Zustand von A verbrauchen könnten.
 */
export const KREUZWEGE = {
	'GET /versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis': { pfad: 'entwurf' },
	...Object.fromEntries(
		[
			'anlegen', 'speichern', 'entfernen', 'ausstand', 'ausstandZurueck', 'nummer', 'anhaengen', 'abloesen',
			'verschieben', 'bestaetigen', 'kipruefen', 'kipruefenAlle', 'kientscheid', 'wiedereroeffnen'
		].map((aktion) => [`POST /versammlungen/[id=kennung]/traktanden?/${aktion}`, { pfad: 'entwurf' }])
	),
	...Object.fromEntries(
		['kivorschlag', 'kientscheid', 'kifolgen', 'uebernehmen', 'setzen'].map((aktion) => [
			`POST /versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis?/${aktion}`,
			{ pfad: 'entwurf' }
		])
	),
	'POST /versammlungen/[id=kennung]/traktanden?/anlegen': {
		pfad: 'entwurf',
		// Ein gemeinsamer Antrag braucht zwei verschiedene Eigentümer, sonst
		// sagt die Aktion vor der Bindung ab: der zweite von A.
		zusatzJe: {
			antragstellerParteien: (a) => [['antragstellerParteien', a.partei2]]
		},
		fuellen: {
			art: 'abstimmung',
			titel: 'E2E Kreuz',
			antragstellerart: 'gemeinschaft'
		},
		// Jedes Antragstellerfeld wirkt nur zu seiner Art.
		fuellenJe: {
			antragstellerPartei: { antragstellerart: 'eigentuemer' },
			antragstellerParteien: { antragstellerart: 'mehrere_eigentuemer' },
			antragstellerGemeinschaft: { antragstellerart: 'untergemeinschaft' }
		}
	},
	'POST /versammlungen/[id=kennung]/traktanden?/speichern': {
		pfad: 'entwurf',
		// Ein gemeinsamer Antrag braucht zwei verschiedene Eigentümer, sonst
		// sagt die Aktion vor der Bindung ab: der zweite von A.
		zusatzJe: {
			antragstellerParteien: (a) => [['antragstellerParteien', a.partei2]]
		},
		felder: { id: 'traktandum' },
		fuellen: { art: 'abstimmung', titel: 'E2E Kreuz', antragstellerart: 'gemeinschaft' },
		fuellenJe: {
			antragstellerPartei: { antragstellerart: 'eigentuemer' },
			antragstellerParteien: { antragstellerart: 'mehrere_eigentuemer' },
			antragstellerGemeinschaft: { antragstellerart: 'untergemeinschaft' }
		}
	},
	'POST /versammlungen/[id=kennung]/traktanden?/entfernen': { pfad: 'entwurf', felder: { id: 'traktandum' } },
	'POST /versammlungen/[id=kennung]/traktanden?/nummer': { pfad: 'entwurf', felder: { id: 'traktandum' } },
	'POST /versammlungen/[id=kennung]/traktanden?/verschieben': {
		pfad: 'entwurf',
		felder: { id: 'traktandum' },
		fuellen: { stelle: '1' }
	},
	'POST /versammlungen/[id=kennung]/traktanden?/abloesen': { pfad: 'entwurf', felder: { id: 'anhang' } },
	'POST /versammlungen/[id=kennung]?/abloesen': { felder: { id: 'anhang' } },
	'POST /versammlungen/[id=kennung]?/speichern': {
		pfad: 'entwurf',
		felder: { tag: 'abend' },
		// Die Angaben des Entwurfs, wie sie sind: Das Speichern schreibt sie,
		// bevor es den Abend prüft. `tag` liest es nur mit `tagVorher`.
		fuellen: {
			datum: (a) => a.entwurfDatum,
			uhrzeit: '19:00',
			ort: (a) => a.entwurfOrt,
			art: 'ordentlich',
			betriebsart: 'gefuehrt',
			stufe: 'erste',
			tagVorher: ''
		},
		fuellenJe: { vorgaengerId: { stufe: 'zweite', tagVorher: null }, tag: { vorgaengerId: null } }
	},
	'POST /versammlungen/[id=kennung]?/tag': {
		pfad: 'entwurf',
		felder: { tag: 'abend' }
	},
	'POST /versammlungen/[id=kennung]/uebernehmen?/default': { pfad: 'entwurf' },
	...Object.fromEntries(
		['ableiten', 'ohneBeschluss', 'bindung'].map((aktion) => [
			`POST /versammlungen/[id=kennung]/weisungen?/${aktion}`,
			{ pfad: 'entwurf' }
		])
	),
	/*
	 * **Auftrag 2c: die Wege, die in Auftrag 2 vor der Kennung endeten.** Je
	 * Weg der Füllwert oder Zustand, der an der Absage vorbeiführt, belegt am
	 * Code im Bericht `.auftraege/2026-10-28-votum-messluecke-block-d-bericht.md`.
	 * `weisungen?/stimmen` sucht einen offenen Durchgang an der Versammlung der
	 * Adresse; den hat nur die laufende, nicht der Entwurf.
	 */
	'POST /versammlungen/[id=kennung]/weisungen?/stimmen': {},
	// «Haus» heisst Mitgliedsgemeinschaft: Die Partei vertritt eine
	// Gemeinschaft, aus deren Versammlung der Beschluss stammt (`weisung.ts`).
	'POST /versammlungen/[id=kennung]/weisungen?/erfassen': {
		pfad: 'entwurf',
		zustand: 'haus'
	},
	'POST /versammlungen/[id=kennung]/leitung?/verschieben': {
		fuellen: { stelle: '1' },
		zustand: 'ohneAbstimmung'
	},
	'POST /versammlungen/[id=kennung]/zugaenge?/versenden': {
		felder: { partei: 'standPartei' }
	},
	...Object.fromEntries(
		['vorlegen', 'bestaetigen', 'zurueckweisen', 'widerrufen', 'nachreichen'].map((aktion) => [
			`POST /versammlungen/[id=kennung]/vollmachten?/${aktion}`,
			{
				felder: { id: 'vollmacht' },
				...(aktion === 'nachreichen' ? { datei: 'datei' } : {})
			}
		])
	),
	'POST /versammlungen/[id=kennung]/vollmachten/nachweise?/default': {
		felder: { id: 'vollmacht' },
		datei: 'datei'
	},
	...Object.fromEntries(
		['vorlegen', 'bestaetigen', 'zurueckweisen', 'widerrufen'].map((aktion) => [
			`POST /tage/[id=kennung]/vollmachten?/${aktion}`,
			{ felder: { id: 'vollmacht' } }
		])
	),
	'POST /tage/[id=kennung]/geschaefte?/umordnen': { felder: { vor: 'traktandum' } },
	'POST /tage/[id=kennung]/geschaefte?/verschieben': { felder: { vor: 'geschaeft' } },
	'POST /tage/[id=kennung]/leitung?/verschieben': { fuellen: { stelle: '1' } },
	'POST /tage/[id=kennung]/leitung?/umordnen': { fuellen: { stelle: '1' } },
	// Was trotz fremder Kennung durchginge, schlösse den Abend oder ein Geschäft.
	'POST /tage/[id=kennung]/leitung?/abschliessen': { zuletzt: true },
	// Ohne Grund: Mit Kennungen von A schlösse `vertagen` sonst die Versammlung
	// und legte eine Folgeversammlung an; ohne Grund sagt das Haus ab, nachdem
	// die Auswahl der Häuser gelesen ist (`versammlungen.ts`).
	'POST /tage/[id=kennung]/leitung?/vertagen': {
		zuletzt: true,
		fuellen: { datum: '2026-12-01', grund: '' }
	},
	'POST /tage/[id=kennung]/leitung?/schliessen': { zuletzt: true },
	'POST /tage/[id=kennung]/leitung?/abbrechen': { zuletzt: true },
	'POST /gemeinschaften/[id=kennung]/eigentuemer?/vertretungBeenden': { felder: { id: 'vertretung' }, fuellen: { bis: '2026-12-31' } },
	'POST /gemeinschaften/[id=kennung]/nutzniessung?/berichtigen': { felder: { id: 'nutzniessung' }, fuellen: { holderName: 'E2E Kreuz' } },
	'POST /gemeinschaften/[id=kennung]/nutzniessung?/beenden': { felder: { id: 'nutzniessung' }, fuellen: { per: '2026-12-31' } },
	'POST /gemeinschaften/[id=kennung]/reglement?/bestaetigen': { felder: { tag: { keine: 'ein Datum, kein Abend' } } },
	...Object.fromEntries(
		['ausstand', 'beklagtenumfang', 'betroffeneAus', 'betroffeneEin', 'vorabVermerken', 'vorabZurueck'].flatMap(
			(aktion) => [
				// Während abgestimmt wird, sagen diese Wege ab, bevor sie die Partei
				// lesen: an einem zweiten Traktandum ohne Durchgang.
				[`POST /versammlungen/[id=kennung]/leitung?/${aktion}`, { zustand: 'ohneAbstimmung' }],
				[`POST /tage/[id=kennung]/leitung?/${aktion}`, { zustand: 'ohneAbstimmung' }]
			]
		)
	),
	...Object.fromEntries(
		['/versammlungen/[id=kennung]/leitung', '/tage/[id=kennung]/leitung'].flatMap((pfad) => [
			[`POST ${pfad}?/kiantrag`, { zustand: 'ki' }],
			[`POST ${pfad}?/stichentscheid`, { fuellen: { wahl: 'yes', wer: 'Prüflauf' } }],
			[`POST ${pfad}?/veto`, { zustand: 'veto' }]
		])
	),
	...Object.fromEntries(
		// Die Leitung einer Versammlung am Abend arbeitet nur über den Notweg;
		// `notweg` liest `abendSperrt` in `versammlungstag.ts`.
		['aufrufen', 'oeffnen', 'beschlussVonHand'].map((aktion) => [
			`POST /versammlungen/[id=kennung]/leitung?/${aktion}`,
			{ fuellen: { notweg: 'ja' } }
		])
	),
	'POST /versammlungen/[id=kennung]/leitung?/widerspruch': {
		fuellen: { notweg: 'ja' },
		// Mit `traktandum` widerspricht man einem Traktandum, ohne einer Partei.
		fuellenJe: { partei: { traktandum: null } },
		zustandJe: { partei: 'universal', traktandum: 'ohneDurchgang' }
	},
	'POST /versammlungen/[id=kennung]/leitung?/pendenzErfassen': {
		fuellen: { fristArt: 'keine' }
	},
	'POST /versammlungen/[id=kennung]/leitung?/pendenzAendern': {
		fuellen: { fristArt: 'keine' }
	},
	'POST /versammlungen/[id=kennung]/leitung?/pendenzZustand': {
		fuellen: { zustand: 'offen' }
	},
	'POST /versammlungen/[id=kennung]/leitung?/ruegeErfassen': {
		fuellen: { wer: 'Prüflauf' }
	},
	...Object.fromEntries(
		[
			'/tage/[id=kennung]/einlass',
			'/versammlungen/[id=kennung]/anwesenheit',
			'/versammlungen/[id=kennung]/einlass'
		].map((pfad) => [`POST ${pfad}?/papierBeantworten`, { fuellen: { papier: 'ja' } }])
	),
	'POST /versammlungen/[id=kennung]/anwesenheit?/einlassen': {
		fuellen: { nachweisVorgelegt: 'true' }
	},
	'POST /versammlungen/[id=kennung]/einlass?/einlassen': {
		fuellen: { nachweisVorgelegt: 'true' }
	},
	'POST /versammlungen/[id=kennung]/anwesenheit?/dritte': {
		fuellen: { bevollmaechtigtName: 'E2E Dritte', nachweisVorgelegt: 'true' }
	},
	'POST /tage/[id=kennung]/geschaefte?/erfordernis': {
		fuellen: { erfordernis: 'k-baulich-nuetzlich' }
	},
	// Abgeben geht nur aus «freigegeben», an ein Gerät mit echtem Schlüssel.
	'POST /versammlungen/[id=kennung]/abgeben?/abgeben': {
		zustand: 'freigegeben'
	},
	'POST /versammlungen/[id=kennung]/traktanden?/anhaengen': {
		pfad: 'entwurf',
		datei: 'datei'
	},
	'POST /versammlungen/[id=kennung]/traktanden?/kipruefen': {
		pfad: 'entwurf',
		zustand: 'ki',
		ohneGegen:
			'Mit einer Kennung von A fragte die Prüfung die KI-Stufen von A, auf Dev zwei externe Dienste ' +
			'(Infomaniak, Mistral); der Prüflauf schickt keinen Text hinaus.'
	},
	// Eine KI-Nutzung gehört zur Versammlung der Adresse, hier zum Entwurf.
	'POST /versammlungen/[id=kennung]/traktanden?/kientscheid': { pfad: 'entwurf', zustand: 'kiEntwurf' },
	'POST /versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis?/kientscheid': {
		pfad: 'entwurf',
		zustand: 'kiEntwurf'
	},
	'POST /gemeinschaften/[id=kennung]/eigentuemer/[partei=kennung]?/miteigentumEintragen': {
		// Die sieben Reihen der Mitberechtigten müssen gleich lang sein, und
		// `ab` muss ein Tag sein, an dem die Partei die Einheit hält (seit
		// gestern); mit dem Füllwert 2026-01-01 sagten B und A gleich ab.
		fuellen: {
			ab: (a) => a.heute,
			mitberechtigterKennung: 'p0',
			mitberechtigterName: '',
			mitberechtigterEmail: '',
			mitberechtigterTelefon: '',
			mitberechtigterAdresse: '',
			mitberechtigterWahl: 'bestehend'
		}
	},
	'POST /versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis?/kifolgen': {
		pfad: 'entwurf',
		zustand: 'kiEntwurf',
		fuellen: { p: 'f8-1-ausschluss' }
	},
	'POST /gemeinschaften/[id=kennung]/angaben?/speichern': {
		// Die Angaben von A, wie sie sind: Das Speichern setzt jede nicht
		// geschickte Einstellung auf ihre Vorgabe.
		fuellen: {
			name: (a) => a.gemeinschaftName,
			quotaDenominator: '1000',
			headCountMode: 'per_owner',
			proxyByAccess: 'on',
			proxyByAccessSource: 'Prüflauf Fremdbetreiber'
		}
	},
	'POST /gemeinschaften/[id=kennung]/eigentuemer?/anlegen': {
		// Jedes Feld gehört zu einem eigenen Zweig der Aktion.
		fuellenJe: {
			personId: { personwahl: 'bestehend', kind: 'natural' },
			mitberechtigterPersonId: {
				eigentumsform: 'gemeinschaftlich',
				kind: 'natural',
				mitberechtigterKennung: 'p0',
				mitberechtigterName: '',
				mitberechtigterEmail: '',
				mitberechtigterTelefon: '',
				mitberechtigterAdresse: '',
				mitberechtigterWahl: 'bestehend'
			},
			memberStwegId: {
				kind: 'gemeinschaft',
				displayName: 'E2E Kreuz',
				representativeName: 'E2E Kreuz'
			}
		}
	},
	'POST /gemeinschaften/[id=kennung]/einheiten?/speichern': {
		namenAuchVonA: true,
		namen: {
			'label.': (a) => a.einheitName,
			'kind.': 'unit',
			'kopf.': 'on',
			'zimmer.': '',
			'flaeche.': '',
			'lage.': ''
		},
		zusatz: (a) => [[`q.${a.einheit}.stamm`, '200']]
	}
};

/**
 * Ordnet jeden Weg ein. Rot wird es wie im Feldteil: ein Kandidat ohne
 * Urteil, ein Urteil für ein Feld, das der Weg nicht (mehr) liest, und ein
 * Urteil ohne Weg.
 */
export function kreuzEinordnen(wege) {
	const fehlend = [];
	const unbekannt = [];
	const eingeordnet = [];
	const gesehen = new Set();
	for (const weg of wege) {
		gesehen.add(weg.schluessel);
		const urteil = KREUZWEGE[weg.schluessel] ?? {};
		const versuche = [];
		for (const feld of weg.felder.filter(istKandidat)) {
			const art = urteil.felder?.[feld] ?? NACH_NAMEN[feld];
			if (art === undefined) {
				unbekannt.push(`${weg.schluessel}: Feld «${feld}»`);
				continue;
			}
			if (typeof art === 'string') {
				for (const teil of art.split('|')) {
					if (!ARTEN[teil]) unbekannt.push(`${weg.schluessel}: Feld «${feld}» mit unbekannter Art «${teil}»`);
				}
				versuche.push({ feld, art });
			}
		}
		for (const feld of Object.keys(urteil.felder ?? {})) {
			if (!weg.felder.includes(feld)) unbekannt.push(`${weg.schluessel}: Urteil für «${feld}», das der Weg nicht liest`);
		}
		eingeordnet.push({ ...weg, urteil, versuche, zuletzt: Boolean(urteil.zuletzt) });
	}
	for (const schluessel of Object.keys(KREUZWEGE)) {
		if (!gesehen.has(schluessel)) fehlend.push(`${schluessel}: Urteil ohne Weg im Baum`);
	}
	return { eingeordnet, fehlend, unbekannt };
}

/**
 * Werte für Felder ohne Kennung, damit ein Versuch nicht schon an «Grund
 * fehlt» endet, bevor die Aktion die Kennung ansieht.
 */
const FUELLWERTE = {
	grund: 'Prüflauf Kreuz',
	begruendung: 'Prüflauf Kreuz',
	notiz: 'Prüflauf Kreuz',
	bemerkung: 'Prüflauf Kreuz',
	vermerk: 'Prüflauf Kreuz',
	text: 'Prüflauf Kreuz',
	pausentext: 'Prüflauf Kreuz',
	wortlaut: 'Prüflauf Kreuz',
	bestaetigt: 'ja',
	wahl: 'abstain',
	entscheid: 'ja',
	ab: '2026-01-01',
	titel: 'E2E Kreuz',
	uhrzeit: '19:30',
	// Der erste Lauf endete hier vor der Kennung: «Antragswortlaut zu
	// erfassen», «Datum fehlt», «Einstieg unbekannt», und die Leitung einer
	// Versammlung am Abend sagt ohne Notweg ab, bevor sie ein Feld liest.
	antragswortlaut: 'Prüflauf Kreuz',
	datum: '2026-12-01',
	notweg: 'ja',
	ast: 'a-sonderfaelle'
};

/** Werte, die von der Aktion abhängen: Ein KI-Entscheid kennt nur `ENTSCHEIDE` aus `$lib/domain/ki`. */
const FUELLWERTE_JE_AKTION = [{ feld: 'entscheid', aktion: /^ki/, wert: 'angenommen' }];

/**
 * Der Füllwert eines Felds ohne Kennung für diesen Weg, sonst `undefined`.
 * Ein Wert im Urteil darf eine Funktion der Grundlage sein (Name oder Datum
 * einer Zeile von A, die das Speichern nicht verstellen soll).
 */
function fuellwert(weg, f, fuellen, basis) {
	const roh =
		f in fuellen
			? fuellen[f]
			: (FUELLWERTE_JE_AKTION.find((r) => r.feld === f && r.aktion.test(weg.aktion ?? ''))?.wert ?? FUELLWERTE[f]);
	return typeof roh === 'function' ? roh(basis) : roh;
}

/** Der Wert eines Felds mit Kennung im Namen (`wahl:<partei>`, `label.<einheit>`). */
const NAMENSWERT = {
	'wahl:': 'abstain',
	'weisung:': 'ja',
	'quote:': '100',
	'vertretung:': 'Probe'
};

/**
 * Wie spät ein Versuch der Gegenhälfte läuft: 0 gewöhnlich, 1 entfernt oder
 * beendet etwas Einzelnes, 2 verlässt oder vertagt, 3 verbraucht den Zustand
 * (`zuletzt`), 4 löst das Haus vom Abend, nach dem auch `abschliessen` und
 * `schliessen` unter `/tage` nichts mehr fänden. **Nur die Gegenhälfte:** Mit
 * Kennungen von A gehen diese Aktionen durch, und im ersten Lauf vom
 * 28.10.2026 löste `haeuser?/loesen` die laufende Versammlung vom Abend;
 * danach sagten 40 Wege unter `/tage` «gehört nicht zu diesem Abend», und
 * gemessen war nur noch der Zustand. Ebenso nahm `geschaefte?/entfernen` das
 * Geschäft von A von der Liste.
 */
export function spaetrang(weg) {
	if (weg.aktion === 'loesen') return 4;
	if (weg.zuletzt) return 3;
	if (/^(verlassen|vertagen)$/.test(weg.aktion ?? '')) return 2;
	// `miteigentumEintragen` stellt das Eigentum ab heute um; danach kommen die
	// Eigentümer von A als Antragsteller nicht mehr in Frage (Endlauf 28.10.2026).
	if (
		/(entfernen|Entfernen|tilgen|Tilgen|archivieren|loeschen|aufheben|beenden|Beenden|widerrufen|zurueckziehen|abgeben|miteigentumEintragen)$/.test(
			weg.aktion ?? ''
		)
	)
		return 1;
	return 0;
}

/**
 * Eine Datei, die `erkenneArt` als PDF nimmt: Es prüft nur den Anfang `%PDF-`
 * (`src/lib/domain/dateiart.ts`). Gebraucht für die Wege, die vor der
 * Kennung «Es wurde keine Datei gewählt» sagen. Immer dieselben Bytes, also
 * unter ihrer Prüfsumme höchstens eine Datei in der Ablage.
 */
const PROBEDATEI = '%PDF-1.4\n% Prüflauf Kreuz\n%%EOF\n';

/**
 * Der Name des Zustands von A, in dem ein Feld gemessen wird: je Feld
 * (`zustandJe`), sonst je Weg (`zustand`), sonst keiner.
 */
export const zustandVon = (weg, feld) => weg.urteil.zustandJe?.[feld] ?? weg.urteil.zustand ?? null;

/**
 * Baut einen Versuch: Adresse von A, das geprüfte Feld mit der Kennung von B,
 * die übrigen Kennungsfelder mit Kennungen von A, die übrigen Felder mit
 * `FUELLWERTE`. `ohne` statt `versuch`, wenn sich das Feld nicht füllen lässt.
 *
 * **Die Gegenhälfte** (`seite: 'A'`) ist derselbe Versuch mit der Kennung von
 * A im geprüften Feld. Erst sie sagt, ob eine Absage an der Kennung hängt:
 * Sagt dasselbe Formular mit lauter Kennungen von A gleich ab, hängt die
 * Absage an etwas anderem (Bericht 2, Abschnitt 2, «Grenzen»).
 *
 * **Der Zustand** (`zustand`, `zustandJe` im Urteil) wählt einen anderen Satz
 * von Kennungen bei A (`A.zustaende`), etwa ein Traktandum ohne offenen
 * Durchgang. Er ersetzt die Werte der Grundlage, Pfad und übrige Felder
 * eingeschlossen; was er an der Datenbank vorbereitet, steht in
 * `fremdbetreiber.mjs` (`kreuzZustaende`).
 *
 * Was das Urteil sonst tragen kann, aus Auftrag 2c (die 66 nicht erreichten
 * Versuche): `fuellen`/`fuellenJe` gehen hinaus, auch wenn die Ableitung das
 * Feld nicht sieht (`notweg` liest ein Helfer zwei Stufen tief), `null` lässt
 * ein Feld weg; `zusatz`/`zusatzJe` hängen weitere Paare an (ein zweiter
 * Antragsteller); `datei` schickt mehrteilig mit `PROBEDATEI`; `namen` setzt
 * die Werte der Felder mit Kennung im Namen, und `namenAuchVonA` schickt sie
 * für die Kennung von A (nur das geprüfte Feld zusätzlich mit der von B),
 * weil die Aktion den Namen aus einem
 * anderen Feld bildet (`einheiten?/speichern` liest `label.<id>` nur zu den
 * Kennungen aus `einheitId`).
 */
export function kreuzversuch(weg, v, B, A, { seite = 'B' } = {}) {
	const imEntwurf = weg.urteil.pfad === 'entwurf';
	const name = zustandVon(weg, v.feld);
	const zustand = name ? A.zustaende?.[name] : {};
	if (!zustand) return { pfad: weg.bau, ohne: `A hat keinen Zustand «${name}»` };
	const grund = { ...A, ...zustand };
	const basis = imEntwurf ? { ...grund, versammlung: A.entwurf, traktandum: A.entwurfTraktandum } : grund;
	const geprueft = seite === 'A' ? basis : B;
	const wurzel = {
		versammlung: basis.versammlung,
		abend: basis.abend,
		gemeinschaft: basis.gemeinschaft,
		person: basis.person
	};
	let ohne = null;
	const pfad = weg.bau
		.split('/')
		.map((segment) => {
			if (segment === '[id=kennung]') return wurzel[weg.baum] ?? ((ohne = `kein Pfad von A für ${weg.baum}`), segment);
			if (segment === '[partei=kennung]') return basis.partei;
			if (segment === '[traktandumId]') return basis.traktandum;
			if (segment === '[nummer]') return '1';
			if (segment === '[datei]') return 'probe.pdf';
			if (segment.startsWith('[')) ohne = `kein Wert von A für ${segment}`;
			return segment;
		})
		.join('/');
	if (ohne) return { pfad, ohne };
	/**
	 * Der Wert einer Art; eine zusammengesetzte (`versammlung|partei`) mit `|`.
	 * Ein Zustand darf die zusammengesetzte Art auch als Ganzes setzen, wo ihre
	 * Teile nicht zur Grundlage passen (Beschluss eines Hauses im Entwurf).
	 */
	const wertVon = (seite, art) => {
		if (seite[art] !== undefined) return seite[art];
		const teile = art.split('|').map((t) => seite[t]);
		return teile.includes(undefined) ? undefined : teile.join('|');
	};
	if (wertVon(geprueft, v.art) === undefined) {
		return {
			pfad,
			ohne: `${seite === 'A' ? 'A' : 'B'} hat keine Zeile der Art ${v.art}`
		};
	}
	const namen = weg.urteil.namen ?? {};
	const namenswert = (feld) => {
		const w = namen[feld] ?? NAMENSWERT[feld] ?? 'Probe';
		return typeof w === 'function' ? w(basis) : w;
	};
	const paare = [];
	for (const g of weg.versuche) {
		const vorlage = /[.:]$/.test(g.feld);
		const geprueftesFeld = g.feld === v.feld || (vorlage && g.art === v.art);
		if (vorlage && geprueftesFeld && weg.urteil.namenAuchVonA) {
			paare.push([`${g.feld}${wertVon(basis, g.art)}`, namenswert(g.feld)]);
			if (g.feld !== v.feld || seite === 'A') continue;
		}
		const wert = wertVon(geprueftesFeld ? geprueft : basis, g.art);
		if (wert === undefined) continue;
		if (vorlage) paare.push([`${g.feld}${wert}`, namenswert(g.feld)]);
		else paare.push([g.feld, wert]);
	}
	const fuellen = { ...weg.urteil.fuellen, ...weg.urteil.fuellenJe?.[v.feld] };
	const gesetzt = new Set(paare.map(([f]) => f));
	for (const f of new Set([...weg.felder, ...Object.keys(fuellen)])) {
		if (gesetzt.has(f)) continue;
		if (fuellen[f] === null) continue;
		// Ein Kandidat ohne Kennung (`{ keine }`, etwa `ast`) bekommt einen
		// Füllwert, wenn es einen gibt; sonst bleibt er leer wie bisher.
		const wert = fuellwert(weg, f, fuellen, basis);
		if (istKandidat(f) && !(f in fuellen) && !(f in FUELLWERTE)) continue;
		if (wert !== undefined) paare.push([f, wert]);
	}
	// Ein Feld, das der Zustand weglässt (`null`), auch unter den Kennungsfeldern.
	const ohneFeld = new Set(Object.keys(fuellen).filter((f) => fuellen[f] === null));
	const alle = paare.filter(([f]) => !ohneFeld.has(f));
	for (const zusatz of [weg.urteil.zusatz, weg.urteil.zusatzJe?.[v.feld]]) {
		if (zusatz) alle.push(...zusatz(basis));
	}
	let versuch;
	if (weg.methode === 'GET') versuch = { feld: v.feld, abfrage: () => alle };
	else if (weg.urteil.datei) {
		versuch = {
			feld: v.feld,
			daten: () => [...alle, [weg.urteil.datei, 'probe.pdf']],
			mehrteilig: () => {
				const f = new FormData();
				for (const [k, w] of alle) f.append(k, w);
				f.append(weg.urteil.datei, new Blob([PROBEDATEI], { type: 'application/pdf' }), 'probe.pdf');
				return f;
			}
		};
	} else versuch = { feld: v.feld, formular: () => alle };
	return { pfad, versuch };
}

/**
 * Der Satz einer Antwort. Die Leitungs- und Weisungsseiten zeigen eine Absage
 * ohne `role="alert"`; `kernsatz` fand dort nur den Seitentitel, und der erste
 * Lauf verlor 25 Sätze. Die Absage steht dann noch in den Formulardaten der
 * Seite.
 */
export function kreuzsatz(antwort) {
	const satz = kernsatz(antwort);
	const titel = antwort.koerper.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
	if (satz !== titel) return satz;
	// `fehler: { nachricht }` auf den Versammlungsseiten, `fehler: '…'` unter `/tage/[id]/leitung`.
	// Die KI-Prüfungen (`kiantrag`, `kipruefen`) melden über `grund` oder
	// `fehlschlaege` in ihrem Ergebnis, auch mit 200. Erst ab dem Ergebnis
	// gesucht: Die Abendseite trägt in den Ladedaten je Haus einen `grund` zur
	// KI-Zulassung, und der stünde sonst für die Antwort.
	const ab = antwort.koerper.search(/\b(?:antragspruefung|pruefung):\{/);
	const ergebnis = ab < 0 ? '' : antwort.koerper.slice(ab);
	const nachricht =
		antwort.koerper.match(/(?:nachricht|fehler):\s*"((?:[^"\\]|\\.)*)"/)?.[1] ??
		ergebnis.match(/\bgrund:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ??
		ergebnis.match(/fehlschlaege:\s*\["((?:[^"\\]|\\.)*)"/)?.[1];
	if (!nachricht) return satz;
	try {
		return JSON.parse(`"${nachricht}"`).slice(0, 140);
	} catch {
		return nachricht.slice(0, 140);
	}
}

/**
 * Woran eine Antwort als Absage erkennbar ist: ein 4xx, eine Weiterleitung
 * mit `absage=`, oder eine 200-Seite mit `role="alert"` oder `fehler` in den
 * Formulardaten (die Leitungs- und Einlassseiten sagen mit 200 ab). Ein
 * Erfolg und ein ehrlicher Leerlauf («nichts geändert») tragen `hinweis`.
 * **Am Merkmal, nicht am Satz:** Bis zur Codeprüfung vom 28.10.2026 entschied
 * bei 200 ein Satzmuster, und «bereits», «nicht gefragt», «nichts geändert»
 * trafen auch Erfolgsmeldungen. Nur das Ergebnis der KI-Prüfungen
 * (`kiantrag`, `kipruefen`) trägt keines der Merkmale; dort sagt der Satz ab,
 * wenn es das Traktandum nicht gibt.
 */
export function kreuzmerkmal(antwort) {
	const k = antwort.koerper ?? '';
	return {
		absage: /role="alert"/.test(k) || /\bfehler:\s*["{]/.test(k),
		ergebnis: /\b(?:antragspruefung|pruefung):\{/.test(k)
	};
}
const ERGEBNISABSAGE = /gibt es nicht/;
const istAbsage = (r) =>
	(r.status >= 400 && r.status < 500) ||
	Boolean(r.ort?.includes('absage=')) ||
	Boolean(r.merkmal?.absage) ||
	Boolean(r.merkmal?.ergebnis && ERGEBNISABSAGE.test(r.satz ?? ''));

/**
 * Der Ausgang eines Felds aus beiden Hälften (Auftrag 2c): «B abgelehnt, A
 * durch» belegt, dass die Absage an der Kennung hängt; «B abgelehnt, A
 * weiter» ebenso, nur scheitert A danach an einer späteren Stelle (anderer
 * Satz); «beide abgelehnt» heisst, die Absage hängt nicht an der Kennung;
 * «B durch» ist eine Abweichung wie in Auftrag 2 (Erfolg, Leerlauf ohne
 * Satz, ehrlicher Leerlauf, 500).
 */
export function kreuzgegenhaelfte(b, a) {
	if (!b.gefuellt) return 'nicht gefüllt';
	if (!a?.gefuellt) return 'Gegenhälfte nicht gefüllt';
	if (b.status === 0 || b.fuenfhundert || !istAbsage(b)) return 'B durch';
	if (a.status === 0 || a.fuenfhundert) return 'B abgelehnt, A ohne Antwort oder 500';
	if (!istAbsage(a)) return 'B abgelehnt, A durch';
	const gleich = a.satz === b.satz && a.status === b.status && (a.ort ?? '') === (b.ort ?? '');
	return gleich ? 'beide abgelehnt' : 'B abgelehnt, A weiter';
}

// Allein aufgerufen: den Lauf über `fremdbetreiber.mjs --kreuz` fahren.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const ergebnis = spawnSync(
		process.execPath,
		[fileURLToPath(new URL('./fremdbetreiber.mjs', import.meta.url)), '--kreuz', ...process.argv.slice(2)],
		{ stdio: 'inherit' }
	);
	process.exit(ergebnis.status ?? 1);
}

