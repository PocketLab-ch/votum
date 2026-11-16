/**
 * Fremdbetreiber über Abfrage und Formularfeld: Feldteil und offener Teil von
 * `e2e/fremdbetreiber.mjs`, der beide einbindet und mit demselben Betreiber B
 * und demselben Vergleich in der Datenbank fährt. Hier stehen die Urteile
 * (`FELDWEGE`, `OFFENE_WEGE`), die Ableitung der Felder und die Abnahme.
 *
 * **Die Frage.** Der Pfadteil deckt die fremde Kennung in der Adresse. Rund
 * dreissig Wege tragen keine Kennung in der Adresse und nehmen trotzdem eine
 * entgegen, als Abfrageparameter (`/quorum?g=…`), als Formularfeld
 * (`/versammlungen/neu`, `gemeinschaft`) oder im hochgeladenen Paket
 * (`/pruefen`, die Versammlung im Inhaltsverzeichnis). Jedes solche Feld wird
 * hier einmal mit einer Kennung von B gefüllt und einmal mit einer eigenen von
 * A (Pendenz «Fremde Kennung in Abfrage oder Formularfeld statt im Pfad»).
 *
 * **Abgeleitet und eingeordnet, nicht aufgezählt.** Die Wege kommen aus
 * `src/routes` (der Pfadteil liefert sie als «ohne Mandantenkennung in der
 * Adresse»), die Feldnamen aus ihrer Quelle, eine Stufe tief in die Helfer,
 * die das Formular bekommen (`ausFormular(daten)`). Von Hand steht hier nur
 * das Urteil: welches Feld eine Kennung trägt und welche Antwort richtig ist.
 * Ein Weg ohne Urteil oder ein Kennungsfeld, das die Tabelle nicht kennt,
 * macht den Lauf rot; so kommt ein neues Feld nicht still an der Prüfung
 * vorbei.
 *
 * **Formularkörper, kein JSON.** Alle Wege des Feldteils sind Seitenaktionen,
 * und SvelteKit nimmt dort nur Formulare an. Der JSON-Körper des Pfadteils
 * gilt den `+server.ts`-Endpunkten, von denen dort keiner liegt; kommt einer
 * dazu, bricht `wegeEinordnen` ab. Unter den offenen Pfaden liegen Endpunkte
 * (die Ströme, die Rückkehr von Authentik); dort nimmt `wegeEinordnen` sie mit
 * `endpunkte: true` an und liest ihre Felder aus der ganzen Datei.
 *
 * **Der offene Teil** (`OFFENE_WEGE`, seit 27.10.2026) prüft `/z`, `/p`, `/b`,
 * `/e` mit einem gültigen Code von A statt einer Sitzung; Einzelheiten dort.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Feldnamen, die nach einer Mandantenkennung aussehen.
 *
 * **Absichtlich weit.** Ein Name zu viel kostet einen Eintrag unter
 * `keineKennung` mit Grund, einer zu wenig eine Lücke, die niemand sieht.
 */
export const KENNUNGSNAMEN = new Set([
	'id',
	'g',
	'gemeinschaft',
	'versammlung',
	'abend',
	'tag',
	'gegenstand',
	'konto',
	'stufe',
	'fuer',
	'parentStwegId',
	'mitglied',
	'traktandum',
	'partei',
	'haus',
	'person',
	'geraet',
	'paket',
	// Unter den offenen Pfaden (`/z`): Durchgang, Einheit der Stimme, die
	// bevollmächtigte Partei.
	'durchgang',
	'einheit',
	'bevollmaechtigt'
]);

/**
 * Ein Feld, dessen **Name** die Kennung trägt: `wahl:<parteiId>`,
 * `weisung:<traktandumId>`. Es heisst hier mit dem Doppelpunkt am Ende und
 * zählt immer als Kennungsfeld, denn hinter dem Doppelpunkt steht nie etwas
 * anderes.
 */
export const istKennungsfeld = (feld) => KENNUNGSNAMEN.has(feld) || feld.endsWith(':');

// ── Felder aus der Quelle ───────────────────────────────────────────────────

const LESEN = /\.(?:get|getAll|has)\(\s*'([^']+)'\s*\)/g;
/** `wert(url, 'versammlung')`, `datumsfilter(url, 'von')`: Helfer über der Adresse. */
const UEBER_ADRESSE = /\b[A-Za-z_]\w*\(\s*url\s*,\s*'([^']+)'\s*\)/g;
/**
 * `schluessel.startsWith('wahl:')`: ein Feld mit der Kennung im Namen. Ohne
 * diesen Leser blieben `wahl:<parteiId>` und `weisung:<traktandumId>` unter
 * `/z` unsichtbar (erhoben 27.10.2026).
 */
const PRAEFIX = /\.startsWith\(\s*'([A-Za-z_]\w*:)'\s*\)/g;
/** Ein Helfer, der das ganze Formular bekommt: `ausFormular(daten)`. */
const HELFER = /\b([A-Za-z_]\w*)\(\s*(?:daten|d|formular)\s*[,)]/g;

function namen(text) {
	return new Set(
		[...text.matchAll(LESEN), ...text.matchAll(UEBER_ADRESSE), ...text.matchAll(PRAEFIX)].map((m) => m[1])
	);
}

/**
 * Die öffnende Klammer des Rumpfs nach der Parameterliste.
 *
 * **Ein Rückgabetyp als Objekt steht davor**
 * (`weisungenAus(daten): { traktandumId: string; … }[] {`); die erste `{` gab
 * den Typ statt des Rumpfs, und die Felder des Helfers fehlten (gemessen
 * 27.10.2026 an `/z`, ebenso `artUndAnlass`). Ein Typliteral folgt auf `:`,
 * `|`, `&`, `<` oder `,` und wird übersprungen; die erste Klammer nach etwas
 * anderem ist der Rumpf. Die Zeilenform taugt nicht als Merkmal: Mehrzeilige
 * Rückgabetypen enden ebenfalls auf `{` (Codeprüfung 27.10.2026).
 */
function rumpfklammer(quelle, ab) {
	let vorher = ')';
	for (let i = ab + 1; i < quelle.length; i++) {
		const c = quelle[i];
		if (/\s/.test(c)) continue;
		if (c === '{') {
			if (!':|&<,'.includes(vorher)) return i;
			// Das Typliteral bis zu seiner schliessenden Klammer überspringen.
			let tiefe = 0;
			for (; i < quelle.length; i++) {
				if (quelle[i] === '{') tiefe++;
				else if (quelle[i] === '}' && --tiefe === 0) break;
			}
			vorher = '}';
			continue;
		}
		vorher = c;
	}
	return -1;
}

/** Der Rumpf einer Funktion nach `kopf`, bis zur passenden Klammer. */
export function rumpf(quelle, kopf) {
	const anfang = quelle.indexOf(kopf);
	if (anfang < 0) return null;
	/*
	 * Erst nach der Parameterliste suchen, sonst wäre `{ locals }` der Rumpf.
	 * Ihr Ende ist die **passende** Klammer, nicht die erste: Ein Standardwert
	 * `= g()` oder ein Funktionstyp in den Parametern schlösse sonst zu früh,
	 * und ein `= {}` danach gälte als Rumpf (Zweitprüfung 27.10.2026).
	 */
	let pfeil = quelle.indexOf('(', anfang + kopf.length - 1);
	for (let tiefe = 0; pfeil < quelle.length; pfeil++) {
		if (quelle[pfeil] === '(') tiefe++;
		else if (quelle[pfeil] === ')' && --tiefe === 0) break;
	}
	const auf = rumpfklammer(quelle, pfeil);
	let tiefe = 0;
	for (let i = auf; i < quelle.length; i++) {
		if (quelle[i] === '{') tiefe++;
		else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(auf, i + 1);
	}
	return quelle.slice(auf);
}

/** Der Text bis zur schliessenden Klammer des ersten Objekts darin. */
function objektEnde(text) {
	const auf = text.indexOf('{');
	let tiefe = 0;
	for (let i = auf; i >= 0 && i < text.length; i++) {
		if (text[i] === '{') tiefe++;
		else if (text[i] === '}' && --tiefe === 0) return text.slice(0, i + 1);
	}
	return text;
}

/**
 * Der Abschnitt der Quelle, der einen Weg bedient: der `load` für GET, der
 * Rumpf der Aktion für POST.
 *
 * Ohne den Schnitt nach Weg trügen alle Aktionen einer Seite die Felder aller
 * anderen, und «dieser Weg liest keine Kennung» liesse sich nie sagen.
 */
function abschnitt(quelle, weg) {
	// Ein Endpunkt (`+server.ts`) trägt je Methode eine Funktion; unter den
	// offenen Pfaden hat jeder nur eine, also gilt die ganze Datei.
	if (weg.endpunkt) return quelle;
	if (weg.methode === 'GET') {
		const anfang = quelle.indexOf('export const load');
		if (anfang < 0) return '';
		const ende = quelle.indexOf('export const actions', anfang);
		return quelle.slice(anfang, ende < 0 ? undefined : ende);
	}
	/*
	 * **Nur bis zum Ende des `actions`-Objekts.** Sonst trug die letzte Aktion
	 * jeden Helfer, der danach in der Datei steht: Unter `/z` las `vergessen`
	 * scheinbar `weisung:` (gemessen 27.10.2026).
	 */
	const block = objektEnde(quelle.slice(quelle.indexOf('export const actions')));
	const kopf = new RegExp(`^\\t${weg.aktion}\\s*:`, 'm').exec(block);
	if (!kopf) return '';
	const rest = block.slice(kopf.index + kopf[0].length);
	const naechste = /^\t[A-Za-z_]\w*\s*:\s*async/m.exec(rest);
	return rest.slice(0, naechste ? naechste.index : undefined);
}

/**
 * Die Felder, die ein Weg liest, eine Stufe tief in seine Helfer.
 *
 * **Eine Stufe genügt hier und ist gemessen:** Die Formularhelfer
 * (`ausFormular`, `mitgliederAusFormular`, `artUndAnlass`) lesen ihre Felder
 * selbst und reichen das Formular nicht weiter. Wer das ändert, sieht es hier
 * nicht; deshalb steht es da.
 */
export function felderVon(wurzel, datei, weg) {
	// Eine Seite ohne `+page.server.ts` liest serverseitig nichts.
	if (!existsSync(join(wurzel, datei))) return new Set();
	const quelle = readFileSync(join(wurzel, datei), 'utf8');
	return felderAus(wurzel, quelle, abschnitt(quelle, weg));
}

/**
 * Die Felder eines Abschnitts, eine Stufe tief in die Helfer, die das Formular
 * bekommen; `quelle` ist die Datei, in der Helfer und Importe stehen. Der
 * Kreuzteil (`fremdbetreiber-kreuz.mjs`) schneidet den Abschnitt selbst, etwa
 * bei gespreizten Aktionen aus `$lib`.
 */
export function felderAus(wurzel, quelle, teil) {
	const gefunden = namen(teil);
	for (const [, helfer] of teil.matchAll(HELFER)) {
		let koerper = rumpf(quelle, `function ${helfer}(`);
		if (!koerper) {
			const modul = quelle.match(
				new RegExp(`import\\s*\\{[^}]*\\b${helfer}\\b[^}]*\\}\\s*from\\s*'\\$lib/([^']+)'`)
			)?.[1];
			if (modul) {
				koerper = rumpf(readFileSync(join(wurzel, 'src/lib', `${modul}.ts`), 'utf8'), `export function ${helfer}(`);
			}
		}
		if (koerper) for (const n of namen(koerper)) gefunden.add(n);
	}
	return gefunden;
}

// ── Das Urteil je Weg ───────────────────────────────────────────────────────

/** Ein Datum, das keine der Prüfversammlungen trägt: 60 Tage voraus. */
function spaeter(zusatz = 0) {
	const d = new Date(Date.now() + (60 + zusatz) * 86_400_000);
	return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Ein ZIP mit einem einzigen Eintrag, ungepackt (Verfahren 0).
 *
 * Die Prüfsumme CRC-32 bleibt null: `entpacke` liest sie nicht, und ein
 * Inhaltsverzeichnis mit fremder Kennung zu bauen braucht kein vollständiges
 * ZIP, nur eines, das die Anwendung öffnet.
 */
function zipMitManifest(manifest) {
	const name = Buffer.from('manifest.json');
	const inhalt = Buffer.from(JSON.stringify(manifest));
	const lokal = Buffer.alloc(30);
	lokal.writeUInt32LE(0x04034b50, 0);
	lokal.writeUInt16LE(20, 4);
	lokal.writeUInt32LE(inhalt.length, 18);
	lokal.writeUInt32LE(inhalt.length, 22);
	lokal.writeUInt16LE(name.length, 26);
	const zentral = Buffer.alloc(46);
	zentral.writeUInt32LE(0x02014b50, 0);
	zentral.writeUInt16LE(20, 4);
	zentral.writeUInt16LE(20, 6);
	zentral.writeUInt32LE(inhalt.length, 20);
	zentral.writeUInt32LE(inhalt.length, 24);
	zentral.writeUInt16LE(name.length, 28);
	const vorZentral = lokal.length + name.length + inhalt.length;
	const ende = Buffer.alloc(22);
	ende.writeUInt32LE(0x06054b50, 0);
	ende.writeUInt16LE(1, 8);
	ende.writeUInt16LE(1, 10);
	ende.writeUInt32LE(zentral.length + name.length, 12);
	ende.writeUInt32LE(vorZentral, 16);
	return Buffer.concat([lokal, name, inhalt, zentral, name, ende]);
}

/**
 * Je Weg das Urteil: entweder `ohne` mit Grund, oder die Kennungsfelder samt
 * Versuchen. `keineKennung` nennt Felder, deren Name nach Kennung aussieht und
 * die keine tragen, mit Grund.
 *
 * Ein Versuch bekommt einen Kennungssatz `k` (von B oder von A) und das
 * Laufzeichen `z`; `fremd` und `eigen` sind die Abnahmen je Seite:
 * `status` die zulässigen Antworten, `satz` was im Körper stehen muss, `nicht`
 * was dort nicht stehen darf (beides auch als Funktion der Kennungen), `ort`
 * wohin ein 303 zeigen muss, `zuwachs` eine angekündigte neue Zeile unter A. `zuletzt` hebt die eigene Hälfte ans Ende, weil
 * sie den Prüfgegenstand von A verbraucht (Archiv, Entfernen, ausser Dienst).
 */
export const FELDWEGE = {
	'GET /': { ohne: 'Übersicht des eigenen Betreibers, liest weder Abfrage noch Feld' },
	'GET /abmelden': { ohne: 'eine Seite ohne Load, nur die Aktion darunter' },
	'POST /abmelden?/default': { ohne: 'beendet die eigene Sitzung, liest kein Feld' },

	'GET /betreiber': {
		keineKennung: { geloescht: 'Anzeigetext nach dem Löschen, keine Kennung' },
		ohne: 'Einstellungen des eigenen Betreibers; «geloescht» ist ein Satz, keine Kennung'
	},
	'POST /betreiber?/briefkopf': { ohne: 'Briefkopf des eigenen Betreibers (Datei, Höhe), keine Kennung' },
	'POST /betreiber?/bezeichnung': { ohne: 'Name des eigenen Betreibers' },
	'POST /betreiber?/kihinweise': { ohne: 'zwei Schalter des eigenen Betreibers' },
	'POST /betreiber?/erinnerungsadresse': { ohne: 'eine Mailadresse, keine Kennung' },
	'POST /betreiber?/entfernen': { ohne: 'entfernt den eigenen Briefkopf, liest kein Feld' },
	'POST /betreiber?/betriebsdaten': {
		versuche: [
			{
				feld: 'versammlung',
				formular: (k) => ({ versammlung: k.meeting }),
				fremd: { status: [400], satz: /Diese Versammlung gibt es nicht/ },
				// Die eigene Versammlung steht im Entwurf: Die Absage «noch nicht
				// geschlossen» sagt, dass die Kennung gefunden und geprüft wurde.
				eigen: { status: [400], satz: /noch nicht geschlossen/ }
			}
		]
	},

	'GET /betreiber/benutzer': { ohne: 'Kontenliste des eigenen Betreibers, liest kein Feld' },
	'POST /betreiber/benutzer?/anlegen': { ohne: 'legt ein neues Konto an, nimmt keine bestehende Kennung' },
	...Object.fromEntries(
		[
			// Je Aktion der Erfolgssatz oder die Absage nach dem Fund, nicht ein
			// Wort, das ohnehin im Gerüst der Seite steht.
			['kennwort', (k, z) => ({ konto: k.konto, kennwort: `Probe-${z}-Kennwort!`, wiederholung: `Probe-${z}-Kennwort!` }), [200], /Das Kennwort ist gesetzt/],
			['rolle', (k) => ({ konto: k.konto, rolle: 'chair' }), [200], /Die Rolle ist geändert/],
			['angaben', (k, z) => ({ konto: k.konto, displayName: `E2E Eigenkonto EZ-${z}`, email: `eigen-${z}@example.ch` }), [200], /Name und Adresse sind gespeichert/],
			['verknuepfung', (k) => ({ konto: k.konto, offen: 'ja' }), [200], /Die erste Anmeldung über Authentik steht bis zum/],
			// Das Prüfkonto ist nicht verknüpft: die Absage, die erst nach dem Fund kommt.
			['loesen', (k) => ({ konto: k.konto }), [400], /Dieses Konto ist nicht mit Authentik verknüpft/],
			['dienst', (k) => ({ konto: k.konto, ausserDienst: 'ja' }), [200], /Das Konto steht ausser Dienst/]
		].map(([aktion, formular, eigenStatus, eigenSatz]) => [
			`POST /betreiber/benutzer?/${aktion}`,
			{
				versuche: [
					{
						feld: 'konto',
						formular,
						fremd: { status: [400], satz: /Dieses Konto gibt es nicht/ },
						eigen: { status: eigenStatus, satz: eigenSatz },
						zuletzt: aktion === 'dienst'
					}
				]
			}
		])
	),

	'GET /betreiber/dienste': { ohne: 'Dienste des eigenen Betreibers, liest kein Feld' },
	'POST /betreiber/dienste?/stufeAnlegen': { ohne: 'legt eine neue KI-Stufe an, nimmt keine bestehende Kennung' },
	'POST /betreiber/dienste?/stufeAendern': {
		versuche: [
			{
				feld: 'stufe',
				formular: (k, z) => ({
					stufe: k.stufe,
					name: `E2E Eigenstufe EZ-${z}`,
					url: 'http://127.0.0.1:9',
					modell: 'probe',
					geduldMs: '2000'
				}),
				fremd: { status: [400], satz: /Diese Stufe gibt es nicht mehr/ },
				eigen: { status: [200], satz: /Die Stufe ist geändert/ }
			}
		]
	},
	'POST /betreiber/dienste?/stufeVerschieben': {
		versuche: [
			{
				feld: 'stufe',
				// Nach unten: Die eigene Prüfstufe steht zuunterst, also bewegt
				// sich nichts, und die echten Stufen von A bleiben, wo sie sind.
				formular: (k) => ({ stufe: k.stufe, richtung: 'zurueck' }),
				fremd: { status: [400], satz: /Diese Stufe gibt es nicht mehr/ },
				eigen: { status: [400], satz: /Diese Stufe steht bereits zuunterst/ }
			}
		]
	},
	'POST /betreiber/dienste?/stufeEntfernen': {
		versuche: [
			{
				feld: 'stufe',
				formular: (k) => ({ stufe: k.stufe }),
				fremd: { status: [400], satz: /Diese Stufe gibt es nicht mehr/ },
				eigen: { status: [200], satz: /ist aus der Kette entfernt/ },
				zuletzt: true
			}
		]
	},
	'POST /betreiber/dienste?/stufePruefen': {
		versuche: [
			{
				feld: 'stufe',
				// Die Prüfstufe zeigt auf einen geschlossenen Anschluss: Die Probe
				// scheitert an der Verbindung, nicht an der Kennung.
				formular: (k) => ({ stufe: k.stufe, nummer: '1' }),
				fremd: { status: [400], satz: /Diese Stufe gibt es nicht mehr/ },
				eigen: { status: [200], satz: /fetch failed/ }
			}
		]
	},
	'POST /betreiber/dienste?/zeitstempel': { ohne: 'Adresse und Fingerabdrücke eines Dienstes, keine Kennung' },
	'POST /betreiber/dienste?/zeitstempelEntfernen': { ohne: 'liest kein Feld' },
	'POST /betreiber/dienste?/zeitstempelPruefen': { ohne: 'liest kein Feld' },
	'POST /betreiber/dienste?/anheften': {
		keineKennung: { fingerabdruck: 'Fingerabdruck eines Zertifikats des eigenen Dienstes, keine Zeile' },
		ohne: 'heftet ein Zertifikat des eigenen Zeitstempeldienstes an'
	},
	// Der Ersatzdienst (13.11.2026): eigene Handlungen, eigene Adresse, und
	// keine Kennung, die auf eine fremde Zeile zeigen könnte.
	'POST /betreiber/dienste?/ersatz': {
		ohne: 'Adresse und Fingerabdrücke des Ersatzdienstes, keine Kennung'
	},
	'POST /betreiber/dienste?/ersatzEntfernen': { ohne: 'liest kein Feld' },
	'POST /betreiber/dienste?/ersatzPruefen': { ohne: 'liest kein Feld' },
	'POST /betreiber/dienste?/ersatzAnheften': {
		keineKennung: {
			fingerabdruck: 'Fingerabdruck eines Zertifikats des Ersatzdienstes, keine Zeile'
		},
		ohne: 'heftet ein Zertifikat des Ersatzdienstes an'
	},
	'POST /betreiber/dienste?/uebernehmen': { ohne: 'übernimmt aus der Umgebung, liest kein Feld' },

	'GET /betreiber/saalgeraete': { ohne: 'Geräteliste des eigenen Betreibers, liest kein Feld' },
	'POST /betreiber/saalgeraete?/einrichten': { ohne: 'richtet das eigene Gerät ein, nur ein Name' },
	'POST /betreiber/saalgeraete?/eintragen': {
		keineKennung: { code: 'Gerätecode zum Eintragen, verweist auf keine Zeile' },
		ohne: 'trägt ein neues Gerät aus seinem Code ein'
	},
	'POST /betreiber/saalgeraete?/widerrufen': {
		versuche: [
			{
				feld: 'id',
				formular: (k) => ({ id: k.geraet, grund: 'Prüflauf Fremdbetreiber' }),
				fremd: { status: [400], satz: /Dieses Gerät gibt es nicht/ },
				eigen: { status: [200], satz: /Das Gerät ist widerrufen/ },
				zuletzt: true
			}
		]
	},

	'GET /gemeinschaften': { ohne: 'Liste des eigenen Betreibers, liest kein Feld' },
	'POST /gemeinschaften?/sammelArchivieren': {
		versuche: [
			{
				feld: 'id',
				formular: (k) => ({ id: k.archivStweg, notiz: 'Prüflauf Fremdbetreiber' }),
				// Die Sammelaktion antwortet mit einem Bericht je Kennung, nicht
				// mit einer Absage des Ganzen: «blieb stehen» samt Grund.
				fremd: { status: [200], satz: /blieb stehen: Gemeinschaft nicht gefunden/ },
				eigen: { status: [200], satz: /Eine Gemeinschaft archiviert/ },
				zuletzt: true
			}
		]
	},

	'GET /gemeinschaften/neu': { ohne: 'Auswahl aus den eigenen Gemeinschaften, liest kein Feld' },
	'POST /gemeinschaften/neu?/default': {
		keineKennung: {},
		versuche: [
			{
				feld: 'parentStwegId',
				formular: (k, z) => ({
					name: `E2E Probe Kind EZ-${z}`,
					parentStwegId: k.stweg,
					quotaDenominator: '1000',
					headCountMode: 'per_owner'
				}),
				fremd: { status: [400], satz: /Gemeinschaft nicht gefunden/ },
				eigen: { status: [303], ort: /^\/gemeinschaften\// }
			},
			{
				feld: 'mitglied',
				formular: (k, z) => ({
					name: `E2E Probe Hülle EZ-${z}`,
					quotaDenominator: '1000',
					headCountMode: 'per_owner',
					traegerschaft: 'stammgrundstueck',
					mitglied: k.stweg,
					[`quote:${k.stweg}`]: '500',
					[`vertretung:${k.stweg}`]: 'Probe',
					ab: '2026-01-01'
				}),
				/*
				 * Die Hülle entsteht vor den Mitgliedern, mit Absicht: Eine Absage
				 * dort ist ein Teilerfolg, kein Rückbau (Codeprüfung 07.10.2026,
				 * `gemeinschaften/neu`). Die neue Gemeinschaft gehört A und trägt
				 * den Namen aus dem Formular; das Mitglied von B kommt nicht hinein.
				 */
				fremd: {
					status: [200],
					satz: /Eine gewählte Gemeinschaft gibt es nicht mehr/,
					zuwachs: { stweg: 1 }
				},
				eigen: { status: [303], ort: /^\/gemeinschaften\// }
			}
		]
	},

	'GET /konto': { ohne: 'das eigene Konto, liest kein Feld' },
	'POST /konto?/verknuepfungLoesen': { ohne: 'das eigene Konto, liest kein Feld' },
	'POST /konto?/kennwort': { ohne: 'das eigene Kennwort, keine Kennung' },

	'GET /personen': {
		keineKennung: { geloescht: 'Anzeigetext nach dem Löschen, keine Kennung' },
		ohne: 'Liste des eigenen Betreibers'
	},
	'POST /personen?/anlegen': { ohne: 'legt eine neue Person an, nimmt keine bestehende Kennung' },
	'POST /personen?/sammelArchivieren': {
		versuche: [
			{
				feld: 'id',
				formular: (k) => ({ id: k.person, notiz: 'Prüflauf Fremdbetreiber' }),
				// Die Sammelaktion antwortet mit einem Bericht je Kennung, nicht
				// mit einer Absage des Ganzen: «blieb stehen» samt Grund.
				fremd: { status: [200], satz: /blieb stehen: Person nicht gefunden/ },
				eigen: { status: [200], satz: /Eine Person archiviert/ },
				zuletzt: true
			}
		]
	},

	'GET /pruefen': { ohne: 'leere Prüfmaske, liest kein Feld' },
	'POST /pruefen?/default': {
		keineKennung: {},
		versuche: [
			{
				feld: 'paket',
				// Die Kennung steckt im Inhaltsverzeichnis des hochgeladenen
				// Pakets, und die Seite sucht dazu das Siegel in der Datenbank.
				mehrteilig: (k) => {
					const f = new FormData();
					f.set(
						'paket',
						new Blob([zipMitManifest({ versammlung: { kennung: k.siegelMeeting }, eintraege: [] })]),
						'probe.zip'
					);
					f.set('siegel', '');
					return f;
				},
				// Mit dem Siegel aus der Datenbank verglichen wird nur bei der
				// eigenen Versammlung; bei der fremden gibt es keinen Vergleichswert.
				fremd: { status: [200], satz: /Kein Vergleichswert vorhanden/, nicht: /hier festgehaltenen Siegel/ },
				eigen: { status: [200], satz: /hier festgehaltenen Siegel/ }
			}
		]
	},

	'GET /quorum': {
		keineKennung: {
			ast: 'Ast des Entscheidbaums, im Regelwerk für alle Betreiber gleich',
			p: 'Antwortfolge im Entscheidbaum, keine Zeile'
		},
		versuche: [
			{
				feld: 'g',
				abfrage: (k) => ({ g: k.stweg }),
				// Der Ladeweg übersetzt die Absage in `error(400, …)` (`mitAbsage`).
				fremd: { status: [400], satz: /Gemeinschaft nicht gefunden/ },
				// Den Prüfstand des Reglements zeigt die Seite nur zu einer
				// gewählten Gemeinschaft.
				eigen: { status: [200], satz: /noch nie auf abweichende Quoren durchgesehen/ }
			}
		]
	},
	'POST /quorum?/setzen': {
		keineKennung: {
			ast: 'Ast des Entscheidbaums, im Regelwerk für alle Betreiber gleich',
			p: 'Antwortfolge im Entscheidbaum, keine Zeile'
		},
		versuche: [
			{
				feld: 'g',
				formular: (k) => ({
					g: k.stweg,
					typ: 'einfaches_mehr',
					begruendung: 'Prüflauf Fremdbetreiber, Erfordernis von Hand'
				}),
				fremd: { status: [400], satz: /Gemeinschaft nicht gefunden|Diese Gemeinschaft gibt es hier nicht/ },
				eigen: { status: [200], nicht: /Gemeinschaft nicht gefunden|Diese Gemeinschaft gibt es hier nicht/ }
			}
		]
	},

	'GET /tage': { ohne: 'leitet auf /versammlungen um, liest nichts' },
	'GET /tage/neu': { ohne: 'leitet auf /versammlungen/neu um, liest nichts' },

	'GET /verlauf': {
		keineKennung: {
			suche: 'Freitext', bereich: 'Bereichsname', art: 'Ereignisart',
			von: 'Datum', bis: 'Datum', seite: 'Seitenzahl'
		},
		versuche: [
			['gegenstand', (k) => k.meeting],
			['versammlung', (k) => k.meeting],
			['gemeinschaft', (k) => k.stweg],
			['abend', (k) => k.tag]
		].map(([feld, wert]) => ({
			feld,
			abfrage: (k) => ({ [feld]: wert(k) }),
			// Der Verlauf von B trägt «Fremdprobe»; er darf nie erscheinen,
			// der eigene Eintrag schon.
			fremd: { status: [200], satz: /Kein Eintrag passt zu diesem Filter/, nicht: /Fremdprobe/ },
			eigen: { status: [200], satz: /Eigenprobe/ }
		}))
	},

	'GET /versammlungen': {
		keineKennung: { geloescht: 'Anzeigetext nach dem Löschen, keine Kennung' },
		ohne: 'Liste des eigenen Betreibers'
	},
	'POST /versammlungen?/sammelArchivieren': {
		versuche: [
			{
				feld: 'id',
				formular: (k) => ({ id: k.archivMeeting, notiz: 'Prüflauf Fremdbetreiber' }),
				fremd: { status: [200], satz: /blieb stehen: Versammlung nicht gefunden/ },
				// Die eigene steht im Entwurf und bleibt stehen, mit dem Grund, der
				// erst nach dem Fund kommt: Die Kennung wurde angenommen.
				eigen: { status: [200], satz: /Entwurf und wurde nie gehalten/ },
				zuletzt: true
			}
		]
	},

	'GET /versammlungen/neu': {
		versuche: [
			{
				feld: 'fuer',
				abfrage: (k) => ({ fuer: k.stweg }),
				// Eine fremde wird nicht vorgewählt, weil sie nicht in der Liste
				// steht; die eigene schon.
				fremd: { status: [200], nicht: /<input[^>]*name="gemeinschaft"[^>]*checked/ },
				eigen: {
					status: [200],
					satz: (k) => new RegExp(`<input[^>]*value="${k.stweg}"[^>]*checked|<input[^>]*checked[^>]*value="${k.stweg}"`)
				}
			}
		]
	},
	'POST /versammlungen/neu?/einzeln': {
		versuche: [
			{
				feld: 'gemeinschaft',
				formular: (k, z) => ({
					gemeinschaft: k.stweg,
					datum: spaeter(),
					uhrzeit: '19:00',
					ort: `Probe EZ-${z}`
				}),
				fremd: { status: [400], satz: /Gemeinschaft nicht gefunden/ },
				eigen: { status: [303], ort: /^\/versammlungen\// }
			}
		]
	},
	'POST /versammlungen/neu?/gemeinsam': {
		versuche: [
			{
				feld: 'gemeinschaft',
				formular: (k, z) => ({
					gemeinschaft: k.stweg,
					bezeichnung: `E2E Probeabend EZ-${z}`,
					// Ein Tag nach `einzeln`: Dort steht nach der Gegenhälfte
					// schon eine Erstversammlung, und das wäre die Absage.
					datum: spaeter(1),
					uhrzeit: '19:00',
					ort: `Probe EZ-${z}`
				}),
				fremd: { status: [400], satz: /Gemeinschaft nicht gefunden/ },
				eigen: { status: [303], ort: /^\/tage\// }
			}
		]
	}
};

/**
 * Ordnet jeden Weg ohne Kennung in der Adresse ein, oder sagt, warum nicht.
 *
 * Rot wird es an drei Stellen: ein Weg ohne Urteil, ein Urteil ohne Weg (die
 * Route ist weg oder umbenannt, die Tabelle prüfte sonst ins Leere) und ein
 * Feld mit Kennungsnamen, das weder geprüft noch begründet ausgenommen ist.
 */
export function wegeEinordnen(wurzel, wege, tabelle = FELDWEGE, { endpunkte = false } = {}) {
	const fehlend = [];
	const unbekannt = [];
	const eingeordnet = [];
	const gesehen = new Set();
	const methodenJeDatei = new Map();
	for (const weg of wege) {
		if (weg.endpunkt && !endpunkte) {
			fehlend.push(`${weg.schluessel}: ein +server.ts-Endpunkt ohne Kennung in der Adresse, hier nicht vorgesehen`);
			continue;
		}
		if (weg.endpunkt) {
			// `abschnitt` liest bei einem Endpunkt die ganze Datei; mit zwei
			// Methoden darin trüge jede die Felder der anderen.
			const m = methodenJeDatei.get(weg.datei) ?? new Set();
			m.add(weg.methode);
			methodenJeDatei.set(weg.datei, m);
			if (m.size > 1) unbekannt.push(`${weg.datei}: Endpunkt mit mehreren Methoden, Felder je Methode nicht getrennt`);
		}
		gesehen.add(weg.schluessel);
		const urteil = tabelle[weg.schluessel];
		if (!urteil) {
			fehlend.push(weg.schluessel);
			continue;
		}
		const felder = felderVon(wurzel, weg.datei, weg);
		const geprueft = new Set((urteil.versuche ?? []).map((v) => v.feld));
		const ausgenommen = new Set(Object.keys(urteil.keineKennung ?? {}));
		for (const f of felder) {
			if (istKennungsfeld(f) && !geprueft.has(f) && !ausgenommen.has(f)) {
				unbekannt.push(`${weg.schluessel}: Feld «${f}»`);
			}
		}
		for (const f of geprueft) {
			if (!felder.has(f)) unbekannt.push(`${weg.schluessel}: geprüftes Feld «${f}» liest die Quelle nicht (mehr)`);
		}
		eingeordnet.push({ ...weg, urteil, felder: [...felder].sort() });
	}
	for (const schluessel of Object.keys(tabelle)) {
		if (!gesehen.has(schluessel)) fehlend.push(`${schluessel}: Urteil ohne Weg im Baum`);
	}
	return { eingeordnet, fehlend, unbekannt };
}

// ── Versuche ────────────────────────────────────────────────────────────────

/**
 * Ein Versuch mit einem Kennungssatz.
 *
 * Wie ein Browser ohne JavaScript: Formular als `text/html`, damit die Seite
 * zurückkommt, die eine Person sähe. Darin wird nach Inhalt von B gesucht,
 * nicht bloss der Status gelesen.
 */
export async function versuchen({ ziel, keks, weg, versuch, k, zeichen, frist, basis = k }) {
	const kopf = { origin: ziel, accept: 'text/html' };
	// Ohne Keks gar kein Kopffeld: `cookie: undefined` ginge als Text hinaus.
	if (keks) kopf.cookie = keks;
	/*
	 * **Die Basis bleibt die von A.** Unter `/z` braucht jeder Versuch neben dem
	 * geprüften Feld weitere gültige Angaben (den offenen Durchgang von A, wenn
	 * die Einheit geprüft wird); sonst sagte schon die erste Prüfung ab, und das
	 * Feld käme nie dran. Ebenso die Adresse: `/e/tag/[merkmal]` ist das Merkmal
	 * von A, nur `haus` ist fremd.
	 */
	let adresse = `${ziel}${versuch.pfad ? versuch.pfad(basis) : weg.pfad}`;
	let koerper;
	/*
	 * Die Standardaktion hat keinen Namen in der Adresse: `?/default` sagt
	 * SvelteKit «Cannot use reserved action name» und antwortet mit 500, eine
	 * Antwort über das Werkzeug, nicht über die Anwendung.
	 */
	const aktion = weg.aktion === 'default' ? '' : `?/${weg.aktion}`;
	if (versuch.abfrage) {
		adresse += `?${new URLSearchParams(versuch.abfrage(k, zeichen, basis))}`;
	} else if (versuch.mehrteilig) {
		adresse += aktion;
		koerper = versuch.mehrteilig(k, zeichen, basis);
	} else {
		adresse += aktion;
		kopf['content-type'] = 'application/x-www-form-urlencoded';
		koerper = new URLSearchParams(versuch.formular(k, zeichen, basis)).toString();
	}
	try {
		const antwort = await fetch(adresse, {
			method: weg.methode,
			redirect: 'manual',
			headers: kopf,
			body: koerper,
			signal: AbortSignal.timeout(frist)
		});
		const ergebnis = {
			status: antwort.status,
			ort: antwort.headers.get('location'),
			koerper: await antwort.text()
		};
		/*
		 * **Zum Einordnen eines Wegs**: `KOERPER_ABLAGE=<verzeichnis>` legt jeden
		 * Körper ab. Die Zeile im Protokoll zeigt nur den ersten Satz, und der
		 * Grund einer Teilabsage steht oft in der Liste darunter.
		 */
		if (process.env.KOERPER_ABLAGE) {
			const name = `${k.stweg.slice(0, 8)}_${weg.schluessel}_${versuch.feld}`.replace(/[^A-Za-z0-9_-]+/g, '_');
			writeFileSync(join(process.env.KOERPER_ABLAGE, `${name}.html`), ergebnis.koerper);
		}
		return ergebnis;
	} catch (unfall) {
		if (unfall.name === 'TimeoutError' || unfall.name === 'AbortError') {
			return { status: 0, ort: null, koerper: `keine Antwort innerhalb ${frist / 1000} s` };
		}
		throw unfall;
	}
}

/**
 * Der sichtbare Satz einer Antwort, damit die Zeile im Protokoll etwas sagt.
 *
 * In dieser Reihenfolge: eine Meldung (`role="alert"` oder `"status"`, der
 * Baustein `Meldung`), die Standardfehlerseite (Status als Überschrift, Satz
 * darunter), sonst der Seitentitel.
 */
export function kernsatz(antwort) {
	const k = antwort.koerper;
	const roh =
		k.match(/role="(?:alert|status)"[^>]*>([\s\S]{0,400}?)<\/(?:p|div)>/)?.[1] ??
		k.match(/<h1>\d{3}<\/h1>\s*<p>([\s\S]{0,400}?)<\/p>/)?.[1] ??
		k.match(/<title>([^<]*)<\/title>/)?.[1] ??
		k;
	return roh.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}

/**
 * Die Abnahme eines Versuchs.
 *
 * **Hart ist immer dasselbe:** keine Antwort, eine 5xx oder Inhalt von B in
 * der Antwort. Danach die Abnahme des Urteils: zulässiger Status, verlangter
 * Satz, verbotener Satz. Ein 303 darf nie auf eine Kennung von B zeigen.
 */
export function beurteilen(antwort, abnahme, bZeichen, bKennungen, k) {
	if (antwort.status === 0) return { hart: true, grund: antwort.koerper };
	if (antwort.status >= 500) return { hart: true, grund: `HTTP ${antwort.status}` };
	for (const z of bZeichen) {
		if (antwort.koerper.includes(z)) return { hart: true, grund: `Inhalt von B in der Antwort («${z.slice(0, 16)}»)` };
	}
	if (antwort.ort && bKennungen.some((id) => antwort.ort.includes(id))) {
		return { hart: true, grund: `Weiterleitung auf B: ${antwort.ort}` };
	}
	// Ein Versuch ohne Abnahme prüft nichts und darf nicht still grün sein.
	if (!abnahme) return { hart: false, ok: false, grund: 'ohne Abnahme im Urteil des Wegs' };
	// Auch der Ort kann an der Kennung hängen (`/e/tag`: das Saalmerkmal von A).
	const ort = typeof abnahme.ort === 'function' ? abnahme.ort(k) : abnahme.ort;
	if (ort && !ort.test(antwort.ort ?? '')) {
		return { hart: false, ok: false, grund: `Weiterleitung nach ${antwort.ort}, erwartet ${ort}` };
	}
	if (!abnahme.status.includes(antwort.status)) {
		return { hart: false, ok: false, grund: `HTTP ${antwort.status}, erwartet ${abnahme.status.join('/')}` };
	}
	// Ein Satz kann an der Kennung hängen (`fuer`: welche Gemeinschaft vorgewählt ist).
	const satz = typeof abnahme.satz === 'function' ? abnahme.satz(k) : abnahme.satz;
	const nicht = typeof abnahme.nicht === 'function' ? abnahme.nicht(k) : abnahme.nicht;
	// Gegen den rohen Körper (Attribute, eingebettete Daten) und gegen den Text
	// ohne Tags, in dem ein Satz über mehrere Elemente läuft.
	const text = antwort.koerper.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
	const steht = (muster) => muster.test(antwort.koerper) || muster.test(text);
	if (satz && !steht(satz)) {
		return { hart: false, ok: false, grund: `Satz ${satz} fehlt` };
	}
	if (nicht && steht(nicht)) {
		return { hart: false, ok: false, grund: `Satz ${nicht} steht da` };
	}
	return { hart: false, ok: true };
}

// ── Offene Pfade ────────────────────────────────────────────────────────────

/** Die Zugänge von A, mit denen die Versuche unter `/z` laufen (`zugang`). */
const ZUGANG_STIMME = 'stimme';

/**
 * Das eigene Veto: die Absage, die erst nach Partei und Durchgang kommt.
 *
 * Das Traktandum von A verlangt keine Zustimmung Betroffener; ein Veto ginge
 * dort nie durch. Die Absage stammt aber aus `erfasseVeto`, also nach beiden
 * Prüfungen in der Aktion, und sagt damit, dass die Kennungen angenommen
 * wurden. Die fremde Hälfte endet vorher, mit anderem Satz.
 */
const VETO_NACH_DEM_FUND = { status: [400], satz: /verlangt keine Zustimmung Betroffener/ };

/**
 * Je Weg unter den offenen Pfaden das Urteil, wie `FELDWEGE`.
 *
 * **Der Zugang ist ein gültiger Code von A**, kein Konto: Unter `/z` trägt
 * jeder Versuch den Keks eines eingelösten Codes einer Partei von A
 * (`zugang`), sonst mässe der Lauf nur die Codeprüfung. Wer welchen braucht,
 * hängt am Weg: Abstimmen verlangt eine anwesende Partei, Erklären eine
 * abwesende (`bereits_anwesend`), Weisen eine mit bestehender Vollmacht
 * (`keine_vollmacht`). Ohne passenden Zugang sagte der Weg vor dem Feld ab.
 *
 * Neben dem geprüften Feld stehen die übrigen Angaben von A (`a`, die Basis):
 * Wer die Einheit prüft, schickt den offenen Durchgang von A mit.
 */
export const OFFENE_WEGE = {
	'GET /anmelden': { ohne: 'Anmeldemaske, liest kein Feld' },
	'POST /anmelden?/default': { ohne: 'Benutzername und Kennwort, keine Kennung' },
	'GET /anmelden/authentik': { ohne: 'beginnt die Anmeldung bei Authentik, liest kein Feld' },
	'GET /anmelden/authentik/zurueck': {
		ohne: 'Rückkehr von Authentik; `code` und `state` gehören dem Anmeldeablauf, keine Zeile'
	},

	'GET /b/[marke]': { ohne: 'der Mandant kommt aus der Marke in der Adresse, liest kein Feld' },
	'POST /b/[marke]?/default': {
		/*
		 * Im Auftrag vom 27.10.2026 als Kennungsfeld erhoben. `fassung` ist aber
		 * einer von drei festen Werten (`berichtigt`, `zu_spaet`, `bisher`) und
		 * wird nur mit der Lage verglichen, die die Marke selbst ergibt; eine
		 * Zeile benennt es nicht.
		 */
		ohne: 'der Mandant kommt aus der Marke; «fassung» ist ein fester Wert (berichtigt, zu_spaet, bisher), keine Kennung'
	},

	'GET /e/[merkmal]': { ohne: 'der Mandant kommt aus dem Saalmerkmal, liest kein Feld' },
	'POST /e/[merkmal]?/default': { ohne: 'Name und Bemerkung einer Saalmeldung, keine Kennung' },
	'GET /e/tag/[merkmal]': {
		versuche: [
			{
				feld: 'haus',
				// Das Abendmerkmal von A, das Haus wechselt.
				pfad: (a) => `/e/tag/${a.abendmerkmal}`,
				abfrage: (k) => ({ haus: k.haus }),
				// `abendeinstieg_haus` sucht das Haus nur unter dem Abend des
				// Merkmals; ein fremdes ergibt keine Weiterleitung, die Seite fragt neu.
				fremd: { status: [200], satz: /Diese Wahl war nicht gültig/ },
				eigen: { status: [303], ort: (a) => new RegExp(`^/e/${a.saalmerkmal}$`) }
			}
		]
	},

	'GET /p': { ohne: 'Leinwand; die Versammlung kommt aus dem Anzeigecode im Keks' },
	'POST /p?/oeffnen': { ohne: 'nimmt einen Anzeigecode entgegen, keine Kennung' },
	'POST /p?/schliessen': { ohne: 'vergisst den eigenen Anzeigecode, liest kein Feld' },
	'GET /p/[code]': { ohne: 'löst den Anzeigecode in der Adresse ein, liest kein Feld' },
	'GET /p/strom': { ohne: 'Ereignisstrom; die Versammlung kommt aus dem Code, geprüft im Schritt «Ströme»' },

	'GET /z': { ohne: 'die Partei kommt aus dem Keks; «stand» ist ein Hinweiswort, keine Kennung' },
	'POST /z?/einloesen': { ohne: 'nimmt einen Zugangscode entgegen; wer ihn hat, ist die Partei dazu' },
	'POST /z?/anmelden': { ohne: 'meldet die eigene Partei an, liest kein Feld' },
	'POST /z?/stimmen': {
		versuche: [
			{
				feld: 'durchgang',
				zugang: ZUGANG_STIMME,
				formular: (k) => ({ durchgang: k.durchgang, wahl: 'abstain' }),
				fremd: { status: [400], satz: /Diese Abstimmung ist inzwischen geschlossen/ },
				eigen: { status: [200], satz: /Ihre Stimme ist erfasst/ }
			},
			{
				feld: 'einheit',
				zugang: ZUGANG_STIMME,
				// Nur die fremde: Es bleibt keine Einheit, und die Absage kommt vor S7.
				formular: (k, z, a) => ({ durchgang: a.durchgang, wahl: 'abstain', einheit: k.einheit }),
				fremd: { status: [400], satz: /Ohne zugeordnete Einheit besteht kein Stimmrecht/ },
				eigen: { status: [200], satz: /Ihre Stimme ist erfasst/ }
			},
			{
				feld: 'einheit',
				zugang: ZUGANG_STIMME,
				/*
				 * Die fremde neben der eigenen, der schärfere Fall: Fiele die fremde
				 * still heraus, stünde «gestimmt» da und die eigene zählte allein
				 * (S7, Sicherheitsdurchgang 09.10.2026). Das Feld kommt mehrfach,
				 * deshalb Paare statt eines Objekts.
				 */
				formular: (k, z, a) => [
					['durchgang', a.durchgang],
					['wahl', 'abstain'],
					['einheit', a.einheit],
					['einheit', k.einheit]
				],
				fremd: { status: [400], satz: /Mindestens eine der genannten Einheiten gehört nicht zu dieser Partei/ },
				eigen: { status: [200], satz: /Ihre Stimme ist erfasst/ }
			},
			{
				feld: 'wahl:',
				zugang: ZUGANG_STIMME,
				formular: (k, z, a) => ({ durchgang: a.durchgang, [`wahl:${k.partei}`]: 'abstain' }),
				fremd: { status: [400], satz: /Für diese Partei dürfen Sie nicht abstimmen/ },
				eigen: { status: [200], satz: /Ihre Stimme ist erfasst/ }
			}
		]
	},
	'POST /z?/veto': {
		versuche: [
			{
				feld: 'partei',
				zugang: ZUGANG_STIMME,
				formular: (k, z, a) => ({ durchgang: a.durchgang, partei: k.partei, entscheid: 'ja' }),
				fremd: { status: [400], satz: /Für diese Partei dürfen Sie das Veto nicht ausüben/ },
				eigen: VETO_NACH_DEM_FUND
			},
			{
				feld: 'durchgang',
				zugang: ZUGANG_STIMME,
				formular: (k, z, a) => ({ durchgang: k.durchgang, partei: a.partei, entscheid: 'ja' }),
				fremd: { status: [400], satz: /Diese Abstimmung ist inzwischen geschlossen/ },
				eigen: VETO_NACH_DEM_FUND
			}
		]
	},
	'POST /z?/bevollmaechtigen': {
		versuche: [
			{
				feld: 'bevollmaechtigt',
				zugang: 'erklaeren',
				formular: (k) => ({ bevollmaechtigt: k.standPartei }),
				fremd: { status: [400], satz: /Diese Partei ist an dieser Versammlung nicht stimmberechtigt/ },
				eigen: { status: [200], satz: /Die Vollmacht ist erklärt/ }
			},
			{
				feld: 'weisung:',
				// Ein zweiter Zugang: Nach der eigenen Hälfte oben ist der erste schon
				// vertreten, und die Absage käme vor der Weisung.
				zugang: 'erklaeren2',
				formular: (k, z) => ({ bevollmaechtigtName: `E2E Vertretung EZ-${z}`, [`weisung:${k.traktandum}`]: 'ja' }),
				fremd: { status: [400], satz: /Zu diesem Traktandum lässt sich keine Weisung erteilen/ },
				eigen: { status: [200], satz: /Die Vollmacht ist erklärt/ }
			}
		]
	},
	'POST /z?/weisungen': {
		versuche: [
			{
				feld: 'weisung:',
				zugang: 'weisen',
				formular: (k) => ({ [`weisung:${k.traktandum}`]: 'ja' }),
				fremd: { status: [400], satz: /Zu diesem Traktandum lässt sich keine Weisung erteilen/ },
				eigen: { status: [200], satz: /1 Weisung gespeichert/ }
			}
		]
	},
	'POST /z?/widerrufen': { ohne: 'nimmt die eigene Vollmacht zurück, liest kein Feld' },
	'POST /z?/abmelden': { ohne: 'beendet die eigene Gerätesitzung, liest kein Feld' },
	'POST /z?/vergessen': { ohne: 'löscht den eigenen Keks, liest kein Feld' },
	'POST /z?/karte': {
		ohne:
			'löst den vorgemerkten Code aus dem eigenen Keks ein; `auto` kennzeichnet nur den Anstoss der Seite und trägt keine Kennung'
	},
	'GET /z/[code]': { ohne: 'merkt den Code aus der Adresse in einem Keks vor, löst ihn nicht ein' },
	'GET /z/authentik': { ohne: 'beginnt die Anmeldung bei Authentik; «anderes» ist ein Schalter' },
	'GET /z/authentik/zurueck': {
		ohne: 'Rückkehr von Authentik; `code` und `state` gehören dem Anmeldeablauf, keine Zeile'
	},
	'GET /z/strom': { ohne: 'Ereignisstrom; die Versammlung kommt aus dem Keks, geprüft im Schritt «Ströme»' }
};
