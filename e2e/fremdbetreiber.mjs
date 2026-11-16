/**
 * Fremdbetreiber über die Routen (Verifikationslücke aus dem Testplan).
 *
 * **Die Frage.** Ein angemeldetes Konto von Betreiber A versucht, Daten von
 * Betreiber B zu lesen und zu ändern, Versammlung, Vollmachten, Verlauf,
 * PDFs, Einzelpersonen. An jeder Route muss 403 oder 404 kommen, und in der
 * Datenbank darf keine Zeile dazugekommen oder verändert worden sein.
 *
 * **Warum über die Routen und nicht nur gegen die Datenbank.** Der
 * Zeilenschutz (RLS) ist in `tests/db/` gemessen; er sagt, dass Abfragen unter
 * dem eigenen Betreiber nichts Fremdes sehen. Was er nicht sagt: ob die Schale
 * darüber die Absage auch ausliefert, statt in eine 500-Seite zu laufen, eine
 * halbe Antwort zu geben oder eine fremde Kennung zu verraten. Das entscheidet
 * sich erst am laufenden Stand.
 *
 * **Warum die Routenliste aus `src/routes` erzeugt wird.** Eine von Hand
 * gepflegte Liste deckt, was der Autor im Kopf hatte, und keine der Routen,
 * die seither dazugekommen sind. Der Durchstich läuft deshalb über jede Route
 * unter einem Mandantenpfad, die er aus dem Baum ableiten kann; was er nicht
 * füllen kann, zählt er auf und schweigt nicht.
 *
 * **Wie Betreiber B entsteht.** Auf Dev gibt es nur einen Betreiber; B wird
 * für diesen Lauf in der Datenbank angelegt (Gemeinschaft, Einheiten, zwei
 * Parteien, Versammlung, Abend, Traktandum, Vollmacht) und am Ende wieder
 * entfernt. Die Kennungen leben nur in diesem Lauf. Die Sitzung gehört A.
 *
 * **Die Gegenhälfte gehört dazu.** Derselbe Durchstich öffnet als A auch
 * eigene Seiten. Ohne das wäre ein Stand grün, der alles mit Absage
 * beantwortet, etwa eine kaputte Anmeldung oder ein Proxy, der Anfragen
 * verwirft. Erst «eigene Daten gehen, fremde nicht» sagt etwas.
 *
 * **Drei Teile, ein Lauf.** Der Pfadteil steht hier. Die Wege ohne Kennung in
 * der Adresse, die eine über Abfrage, Formularfeld oder hochgeladenes Paket
 * annehmen, prüft der Feldteil in `e2e/fremdbetreiber-felder.mjs`: dort das
 * Urteil je Feld und die Abnahme, hier Aufbau, Sitzung und der Vergleich in
 * der Datenbank, der alle Teile einschliesst. Für die Gegenhälfte des
 * Feldteils legt der Lauf eigene Prüfgegenstände von A an (Gemeinschaften,
 * Versammlungen, Konto, Gerät, KI-Stufe), für den offenen Teil eine laufende
 * Versammlung mit eigener Gemeinschaft und eigenem Abend, und entfernt alles am
 * Ende wie B.
 *
 * Der offene Teil (seit 27.10.2026) prüft die offenen Pfade (`/z`, `/p`,
 * `/b`, `/e`), die der Pfadteil auslässt: Dort gilt ein Code statt einer
 * Sitzung, und eine fremde Kennung kann nur im Feld stehen. Gemessen wird mit
 * **gültigen Codes von A**, über die Anwendung ausgegeben und eingelöst, an
 * einer laufenden Versammlung von A mit offenem Durchgang; das Urteil je Feld
 * steht in `OFFENE_WEGE`. Dazu die Ströme `/z/strom` und `/p/strom`: Ein
 * Ereignis von B darf dort nicht ankommen, eines von A muss.
 *
 * **Der Kreuzteil läuft getrennt** (`--kreuz`, Ableitung und Urteile in
 * `e2e/fremdbetreiber-kreuz.mjs`): ein Weg unter einem Pfad von A, dessen Feld
 * eine Kennung von B trägt. Er misst und endet rot, solange die Befunde aus
 * `.auftraege/2026-10-27-votum-eigener-pfad-fremde-kennung-bericht.md` offen
 * sind (Ablage ausserhalb des Repos); ohne den Schalter läuft er nicht mit.
 *
 * ## Aufruf, gegen den gebauten Stand
 *
 * Gemessen wird `node build` auf Port 3101 im Dev-Container, nicht der
 * Entwicklungsserver auf 3000: Dort schaltet SvelteKit den Schutz gegen fremde
 * Formulare ab, und `adapter-node` ist nicht der Server. Schritt 01 bricht ab,
 * wenn das Ziel `vite dev` ist (bis 27.10.2026 nannte dieser Kopf 3101, die
 * Messung vom 16.10.2026 lief aber gegen 3000).
 *
 * ```
 * IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
 *      $(docker compose ps -q app))
 * docker compose exec -T app npm run build
 * docker compose exec -T -d app sh -c "PORT=3101 ORIGIN=http://$IP:3101 node build > /tmp/build.log 2>&1"
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber.mjs
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber.mjs --liste   # nur Routenliste und Feldurteile
 * ZIEL=http://$IP:3101 node e2e/fremdbetreiber-kreuz.mjs      # Kreuzteil, Umgebung im Kopf dort
 * ```
 *
 * Danach den gebauten Stand beenden, per Prozessnummer im Container
 * (`docker compose exec app ps`, dann `kill <nummer>`), nicht mit `pkill node`:
 * Das träfe den Entwicklungsserver mit.
 *
 * Der Zugang zur Datenbank läuft über `docker exec … psql` im
 * Postgres-Container des Dev-Stapels (Superuser-Rolle; kein Kennwort in der
 * Kommandozeile, die Rolle `versammlung` verbindet im Container ohne
 * Anmeldung). Gebraucht wird sie zum Anlegen von B und für die
 * Kontrollabfrage, der Zeilenschutz wird hier nicht geprüft, sondern die
 * Wirkung an den Routen.
 */
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { OFFENE_WEGE, beurteilen, kernsatz, versuchen, wegeEinordnen } from './fremdbetreiber-felder.mjs';
import { zugang } from './zugang.mjs';
import {
	ARTEN,
	kreuzEinordnen,
	kreuzgegenhaelfte,
	kreuzmerkmal,
	kreuzsatz,
	kreuzversuch,
	kreuzwegeErheben,
	spaetrang,
	zustandVon
} from './fremdbetreiber-kreuz.mjs';

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
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'versammlung-postgres-1';
const DB_NAME = process.env.DB_NAME ?? 'versammlung';
const DB_BENUTZER = process.env.DB_BENUTZER ?? 'versammlung';
const WURZEL = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const NUR_LISTE = process.argv.includes('--liste');
/**
 * Nur der Kreuzteil (`e2e/fremdbetreiber-kreuz.mjs`): eigener Pfad, fremde
 * Kennung im Feld. Er misst und darf rot enden, solange die Befunde offen
 * sind; deshalb läuft er nicht mit, wenn dieses Skript ohne Schalter läuft.
 */
const KREUZ = process.argv.includes('--kreuz');
// Nur die Versuche, deren «Weg [Feld]» passt (Nachlauf einzelner Wege), und
// die Ruhe vor dem zweiten Abdruck je Versuch.
const KREUZ_NUR = process.env.KREUZ_NUR ? new RegExp(process.env.KREUZ_NUR) : null;
const KREUZ_RUHE_MS = Number(process.env.KREUZ_RUHE_MS ?? 300);

/** Die Marke dieses Laufs: Namen und Kennungen kollidieren nicht mit anderen. */
const MARKE = Date.now().toString().slice(-6);

/**
 * Das Zeichen in jedem Namen von B, und das in den Prüfgegenständen von A.
 *
 * Steht `FZ-…` in einer Antwort an A, hat die Anwendung Inhalt von B
 * ausgeliefert; dafür sucht der Feldteil in jedem Körper danach. Die Marke
 * allein genügte nicht, A trägt sie ebenfalls.
 */
const B_ZEICHEN = `FZ-${MARKE}`;
const A_ZEICHEN = `EZ-${MARKE}`;

/** Wie lange ein einzelner Aufruf höchstens dauern darf. */
const FRIST_MS = 15_000;

/**
 * Die Tabellen, deren Gesamtzahl die Kontrollabfrage mitzählt.
 *
 * **Zwei Blicke, nicht einer.** Der Zeilenvergleich über B fängt jede fremde
 * Zeile, die an B hängt. Er fängt NICHT die falsch adressierte Schreibstelle,
 * die beim Zugriff auf B eine neue Zeile unter A anlegt. Für diese Klasse
 * stehen hier die Kernbestände; sie gehören in diesem kurzen Fenster keiner
 * anderen Sitzung, und wer sie hier vorfindet, hat etwas gefunden.
 */
const GLOBAL = [
	'meeting',
	'agenda_item',
	'voting_round',
	'vote',
	'proxy',
	'representation',
	'attendance_event',
	'unit',
	'party',
	'person',
	/*
	 * Gemeinschaft und Abend für den Feldteil: Ein Formular mit fremder
	 * Gemeinschaft könnte vor der Absage schon eine eigene Zeile angelegt
	 * haben (`gemeinsam` legt den Abend vor den Versammlungen an).
	 */
	'stweg',
	'meeting_day'
];

let nummer = 0;
const fehler = [];

function behaupte(bedingung, satz) {
	if (!bedingung) throw new Error(satz);
}

async function schritt(name, arbeit, { weiter = false } = {}) {
	nummer += 1;
	try {
		const zusatz = await arbeit();
		console.log(`  ✓ ${String(nummer).padStart(2, '0')} ${name}${zusatz ? ` — ${zusatz}` : ''}`);
		return zusatz;
	} catch (unfall) {
		fehler.push(`${name}: ${unfall.message}`);
		console.log(`  ✗ ${String(nummer).padStart(2, '0')} ${name}\n     ${unfall.message}`);
		if (unfall && typeof unfall === 'object') unfall.gemeldet = true;
		if (!weiter) throw unfall;
	}
}

// ── Datenbank ───────────────────────────────────────────────────────────────

/**
 * Führt SQL im Postgres-Container aus; die Ausgabe sind die Zeilen ohne Kopf.
 *
 * **Asynchron, mit Absicht.** Bis 28.10.2026 lief das über `execFileSync` und
 * hielt die Ereignisschleife je Abdruck 20 bis 40 s an; der Server schliesst
 * eine ruhende Verbindung nach 5 s, und undici schickte die nächste Anfrage
 * noch über den geschlossenen Socket («UND_ERR_SOCKET other side closed»,
 * Runbook versammlung, «fetch failed»). Mit `execFile` läuft die Schleife
 * weiter und sieht das Schliessen rechtzeitig.
 */
function sql(text) {
	return new Promise((fertig, scheitern) => {
		const kind = execFile(
			'docker',
			['exec', '-i', DB_CONTAINER, 'psql', '-U', DB_BENUTZER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-tA', '-f', '-'],
			{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
			(unfall, ausgabe, fehlerausgabe) => {
				if (!unfall) {
					fertig(
						ausgabe
							.split('\n')
							.map((z) => z.trimEnd())
							.filter((z) => z !== '')
					);
					return;
				}
				const meldung = String(fehlerausgabe || unfall.message).trim();
				// Die fehlende Zeile mitnennen: «psql:<stdin>:39» allein hilft niemandem.
				const zeile = Number(meldung.match(/<stdin>:(\d+):/)?.[1] ?? 0);
				const ausschnitt = zeile ? `\n     Zeile ${zeile}: ${text.split('\n')[zeile - 1]?.trim().slice(0, 160)}` : '';
				scheitern(
					new Error(`SQL scheiterte: ${meldung}${ausschnitt}`, {
						cause: unfall
					})
				);
			}
		);
		kind.stdin.end(text);
	});
}

/** Ein Skalar aus einer Abfrage. */
async function skalar(abfrage) {
	const zeilen = await sql(abfrage);
	behaupte(zeilen.length === 1, `Erwartet eine Zeile, gekommen ${zeilen.length}: ${abfrage}`);
	return zeilen[0];
}

/**
 * Welche Tabellen hängen über welche Spalte an einem der Mandantenbegriffe?
 *
 * **Erhoben statt aufgezählt.** Die Liste der Kindtabellen von Hand zu pflegen
 * hiesse, die nächste Tabelle zu vergessen, und die Kontrollabfrage wäre
 * blind genau dort, wo es zählt. Die Abfrage liefert, was da ist; nur die
 * Zuordnung der Werte unten ist von Hand.
 */
async function mandantenspalten() {
	const zuordnung = new Map();
	for (const zeile of await sql(`
		SELECT c.table_name || '|' || c.column_name
		  FROM information_schema.columns c
		  JOIN pg_tables t
		    ON t.schemaname = c.table_schema AND t.tablename = c.table_name
		 WHERE c.table_schema = 'public'
		   AND c.column_name IN ('operator_id','meeting_id','stweg_id','unit_id','party_id',
		                         'person_id','meeting_day_id','represented_id','holder_id',
		                         'agenda_item_id')
		 ORDER BY c.table_name, c.column_name
	`)) {
		const [tabelle, spalte] = zeile.split('|');
		if (!zuordnung.has(tabelle)) zuordnung.set(tabelle, []);
		zuordnung.get(tabelle).push(spalte);
	}
	return zuordnung;
}

/**
 * Die Bedingung «diese Zeile gehört zu B»: **ein** Treffer genügt.
 *
 * Ein UND wäre falsch und still: Eine Partei ohne Person hat `person_id NULL`,
 * `NULL IN (…)` ist nie wahr, und die Zeile fiele aus Zählung und Löschung
 * heraus. Gemessen an genau diesem Fall beim ersten Lauf dieses Durchstichs.
 */
function zuBBedingungen(spalten, werte, praefix) {
	const bedingungen = [];
	for (const spalte of spalten) {
		const werteSpalte = werte[spalte];
		if (!werteSpalte || werteSpalte.length === 0) continue;
		bedingungen.push(`${praefix}${spalte} IN (${werteSpalte.map((w) => `'${w}'`).join(', ')})`);
	}
	return bedingungen;
}

/**
 * Die Prüfsummen aller Zeilen, die zu B gehören, je Tabelle eine Zeile,
 * dazu die Gesamtzahlen der Kerntabellen.
 *
 * Geordnet wird über den Zeilentext, damit die Summe nicht an der
 * Einfügereihenfolge hängt. Eine leere Tabelle zählt als «0:leer».
 */
async function fingerabdruecke(werte, { seit = null } = {}) {
	const teile = [];
	for (const [tabelle, spalten] of await mandantenspalten()) {
		const bedingungen = zuBBedingungen(spalten, werte, 't.');
		if (bedingungen.length === 0) continue;
		teile.push(
			`SELECT '${tabelle}' AS tabelle, count(*)::text AS anzahl, ` +
				`coalesce(md5(string_agg(z.zeile, E'\\n' ORDER BY z.zeile)), 'leer') AS summe ` +
				`FROM (SELECT t::text AS zeile FROM ${tabelle} t WHERE ${bedingungen.join(' OR ')}) z`
		);
	}
	for (const tabelle of GLOBAL) {
		teile.push(`SELECT 'GLOBAL ${tabelle}' AS tabelle, count(*)::text, 'ohne' FROM ${tabelle}`);
	}
	/*
	 * **Der Verlauf eines anderen, der B nennt.** Ein Verlaufseintrag gehört dem
	 * Handelnden, nicht dem Gegenstand; sein Gegenstand ist freier Text ohne
	 * Fremdschlüssel. Nimmt eine Aktion von A eine Kennung von B ungeprüft in
	 * den Verlauf (K2, Sicherheitsdurchgang 09.10.2026: `/quorum`, `g`), steht
	 * die Zeile unter A und fiele aus dem Vergleich über B heraus.
	 */
	const kennungen = Object.values(werte).flat().filter((w) => /^[0-9a-f-]{36}$/.test(w));
	teile.push(
		`SELECT 'ERWÄHNT audit_entry' AS tabelle, count(*)::text, 'ohne' FROM audit_entry ` +
			`WHERE operator_id IS DISTINCT FROM '${werte.operator_id[0]}' ` +
			(seit ? `AND occurred_at >= '${seit}' ` : '') +
			`AND (subject_id IN (${kennungen.map((w) => `'${w}'`).join(', ')}) ` +
			`OR detail::text ~ '${kennungen.join('|')}')`
	);
	/*
	 * **Sortiert vergleichen.** `UNION ALL` verspricht keine Reihenfolge; zwei
	 * Läufe derselben Abfrage lieferten hier dieselben Zeilen in anderer
	 * Ordnung, und der Vergleich meldete «8 Tabellen verändert», ohne dass
	 * sich ein Wert unterschied. Gemessen am ersten Lauf dieses Durchstichs.
	 */
	return (await sql(`${teile.join('\n UNION ALL \n')};`)).map((z) => z.replaceAll('|', ':')).sort();
}

/** Löscht alles, was zu B gehört, über dieselben Spalten, unter `replica`. */
async function bEntfernen(werte) {
	const loeschungen = [];
	for (const [tabelle, spalten] of await mandantenspalten()) {
		const bedingungen = zuBBedingungen(spalten, werte, 't.');
		if (bedingungen.length === 0) continue;
		loeschungen.push(`DELETE FROM ${tabelle} t WHERE ${bedingungen.join(' OR ')};`);
	}
	/*
	 * **Unter `replica`, mit Absicht.** Der Verlauf ist nur anfügbar und die
	 * Aufbewahrungssperre greift auf versiegelte Versammlungen; beides würde
	 * das Aufräumen dieses Prüfstands blockieren. Es sind ausschliesslich
	 * Zeilen dieses Laufs, und `versammlung` ist die Rolle, die die Datenbank
	 * angelegt hat.
	 */
	await sql(`
		BEGIN;
		SET LOCAL session_replication_role = replica;
		${loeschungen.join('\n')}
		DELETE FROM operator WHERE id = '${werte.operator_id[0]}';
		COMMIT;
	`);
}

/**
 * Entfernt die Prüfgegenstände von A und was die Gegenhälfte daraus gemacht
 * hat, **ohne die Betreiberspalte**.
 *
 * Über `operator_id` gelöscht wäre ganz A weg. Gesammelt wird deshalb über
 * die Kennungen dieses Laufs und das Zeichen in den Namen, die die Formulare
 * eingetragen haben (neue Gemeinschaften, Versammlungen, Abende); vom Verlauf
 * nur Zeilen seit Beginn des Laufs, die einen dieser Gegenstände nennen.
 * Unter `replica` aus demselben Grund wie bei B.
 */
async function aEntfernen(a, beginn) {
	const liste = (werte) => werte.map((w) => `'${w}'`).join(', ');
	const z = a.zugang;
	const stwege = await sql(`
		SELECT id FROM stweg
		 WHERE id IN (${liste([...a.stweg, ...(z ? [z.stweg] : [])])})
		    OR (operator_id = '${a.operator}' AND name LIKE '%${A_ZEICHEN}%')
	`);
	const werte = {
		stweg_id: stwege,
		meeting_id: [
			...new Set([...a.meeting, ...(await sql(`SELECT id FROM meeting WHERE stweg_id IN (${liste(stwege)})`))])
		],
		meeting_day_id: await sql(`
			SELECT id FROM meeting_day
			 WHERE id = '${a.tag}' OR (operator_id = '${a.operator}' AND label LIKE '%${A_ZEICHEN}%')
		`),
		person_id: [a.person]
	};
	// Weisungen hängen nur über das Traktandum an der Versammlung, und der
	// Verlauf nennt ein Traktandum als Gegenstand: Ohne seine Kennung blieb
	// nach dem Kreuzteil «agenda.item.updated» am Entwurfstraktandum stehen.
	werte.agenda_item_id = [
		...new Set([
			...(z ? [z.traktandum] : []),
			...(await sql(`SELECT id FROM agenda_item WHERE meeting_id IN (${liste(werte.meeting_id)})`))
		])
	];
	// Das Gerät des Kreuzteils hängt an keiner Gemeinschaft (`kreuzBestandA`),
	// und die übrigen Kennungen des Kreuzteils nennt der Verlauf auch dann
	// noch, wenn die Gegenhälfte die Zeile entfernt hat (`traktanden?/entfernen`
	// mit dem Entwurfstraktandum, Endlauf 28.10.2026: sieben Einträge).
	const einzeln = [
		a.konto,
		a.geraet,
		a.stufe,
		...(a.kreuzGeraet ? [a.kreuzGeraet] : []),
		...(a.kreuzKennungen ?? [])
	];
	const alle = [...Object.values(werte).flat(), ...einzeln];
	const loeschungen = [];
	for (const [tabelle, spalten] of await mandantenspalten()) {
		const bedingungen = zuBBedingungen(spalten, werte, 't.');
		if (bedingungen.length) loeschungen.push(`DELETE FROM ${tabelle} t WHERE ${bedingungen.join(' OR ')};`);
	}
	/*
	 * **Im Kreuzteil auch der Verlauf der Kinder.** Die Gegenhälfte schreibt
	 * Verlauf zu Vollmachten, Standparteien, Einheiten und Durchgängen, deren
	 * Kennung nicht in `alle` steht; nach drei vollen Kreuzläufen und sechs
	 * Probeläufen vom 28.10.2026 lagen 56 solche Einträge unter A. Gelöscht
	 * vor den Zeilen, solange sie sich noch finden lassen. Nur mit `--kreuz`: Der Vor-Auslieferungslauf räumt wie
	 * bisher (Bericht 2, 3.7).
	 */
	let kinderverlauf = '';
	if (KREUZ) {
		const mitId = new Set(
			await sql(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id'`)
		);
		const kinder = [];
		for (const [tabelle, spalten] of await mandantenspalten()) {
			const bedingungen = zuBBedingungen(spalten, werte, 't.');
			if (bedingungen.length && mitId.has(tabelle)) {
				kinder.push(`SELECT t.id::text FROM ${tabelle} t WHERE ${bedingungen.join(' OR ')}`);
			}
		}
		if (kinder.length) kinderverlauf =
			`DELETE FROM audit_entry WHERE operator_id = '${a.operator}' AND occurred_at >= '${beginn}' ` +
			`AND subject_id IN (${kinder.join(' UNION ')});`;
	}
	await sql(`
		BEGIN;
		SET LOCAL session_replication_role = replica;
		${kinderverlauf}
		-- Was nur über Durchgang oder Zugang an der Versammlung hängt, vor dem
		-- Zugang selbst: Stimmen, Veto, Gerätesitzungen der offenen Pfade.
		DELETE FROM vote WHERE round_id IN (SELECT id FROM voting_round WHERE meeting_id IN (${liste(werte.meeting_id)}));
		DELETE FROM veto WHERE round_id IN (SELECT id FROM voting_round WHERE meeting_id IN (${liste(werte.meeting_id)}));
		DELETE FROM access_session
		 WHERE meeting_access_id IN (SELECT id FROM meeting_access WHERE meeting_id IN (${liste(werte.meeting_id)}));
		${loeschungen.join('\n')}
		-- Die Zeilen selbst: Ihre Kennung steht in «id», nicht in einer der
		-- Spalten oben.
		DELETE FROM meeting WHERE id IN (${liste(werte.meeting_id)});
		DELETE FROM meeting_day WHERE id IN (${liste(werte.meeting_day_id)});
		DELETE FROM person WHERE id IN (${liste(werte.person_id)});
		DELETE FROM stweg WHERE id IN (${liste(werte.stweg_id)});
		DELETE FROM audit_entry
		 WHERE operator_id = '${a.operator}' AND occurred_at >= '${beginn}'
		   AND (subject_id IN (${liste(alle)}) OR actor_label LIKE '%${A_ZEICHEN}%');
		DELETE FROM user_session WHERE user_id = '${a.konto}';
		DELETE FROM app_user WHERE id = '${a.konto}';
		DELETE FROM handover_device WHERE id IN (${liste([a.geraet, ...(a.kreuzGeraet ? [a.kreuzGeraet] : [])])});
		DELETE FROM ai_stage WHERE id = '${a.stufe}';
		COMMIT;
	`);
}

// ── Routenliste aus dem Baum ────────────────────────────────────────────────

/** Die offenen Pfade, aus der Domäne gelesen statt abgeschrieben. */
function offenePfade() {
	const quelle = readFileSync(join(WURZEL, 'src/lib/domain/oeffentlich.ts'), 'utf8');
	const vermerk = quelle.match(/VERMERKPFAD\s*=\s*'([^']+)'/)?.[1];
	const liste = quelle.match(/OFFENE_PFADE\s*=\s*\[([^\]]*)\]/)?.[1];
	behaupte(
		liste,
		'OFFENE_PFADE steht nicht mehr so da wie erwartet: src/lib/domain/oeffentlich.ts'
	);
	return [...liste.matchAll(/'([^']+)'|(\b[A-Z_]+\b)/g)].map((m) => {
		const wert = m[1] ?? m[2];
		if (wert === 'VERMERKPFAD') {
			behaupte(vermerk, 'VERMERKPFAD nicht gefunden, obwohl OFFENE_PFADE ihn nennt');
			return vermerk;
		}
		return wert;
	});
}

/** Alle Dateien unter einem Verzeichnis, rekursiv. */
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

/**
 * Die Aktionsnamen aus einer `+page.server.ts`, nur aus dem `actions`-Block.
 *
 * Sonst läse der Durchstich `load`-Funktionen und lokale Helfer als Aktionen
 * und prüfte Adressen, die es nicht gibt, und eine Absage auf eine erfundene
 * Aktion sähe wie eine bestandene Probe aus (`No action with name …` ist
 * ebenfalls 404).
 */
function aktionsnamen(quelle, datei) {
	const block = objektblock(quelle, 'export const actions');
	if (block === null) return [];
	const namen = [...block.matchAll(/^\t([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1]);
	/*
	 * **Gespreizte Aktionen auflösen** (`actions = { ...einlassaktionen }`).
	 * Die Zeilensuche oben sieht sie nicht; ohne diesen Schritt fehlten die
	 * Einlasswege still in der Liste, gemessen in der Codeprüfung vom
	 * 15.10.2026 (rund 17 Schreibwege). Was sich nicht auflösen lässt, bricht
	 * den Lauf ab, statt eine kürzere Liste als vollständig auszugeben.
	 */
	for (const [, objekt] of block.matchAll(/(?:^\t|^\{\s*)\.\.\.([A-Za-z_][A-Za-z0-9_]*)/gm)) {
		const modul = quelle.match(
			new RegExp(`import\\s*\\{[^}]*\\b${objekt}\\b[^}]*\\}\\s*from\\s*'\\$lib/([^']+)'`)
		)?.[1];
		behaupte(modul, `${datei}: gespreizte Aktionen «...${objekt}» nicht auflösbar (Import nicht gefunden)`);
		const ziel = join(WURZEL, 'src/lib', `${modul}.ts`);
		const fremd = objektblock(readFileSync(ziel, 'utf8'), `export const ${objekt}`);
		behaupte(fremd !== null, `${datei}: «${objekt}» steht nicht als Objekt in ${relative(WURZEL, ziel)}`);
		namen.push(...[...fremd.matchAll(/^\t([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((m) => m[1]));
	}
	return [...new Set(namen)];
}

/** Der Inhalt des Objekts nach `kopf`, bis zur passenden schliessenden Klammer. */
function objektblock(quelle, kopf) {
	const anfang = quelle.indexOf(kopf);
	if (anfang < 0) return null;
	const auf = quelle.indexOf('{', anfang);
	if (auf < 0) return null;
	let tiefe = 0;
	for (let i = auf; i < quelle.length; i++) {
		if (quelle[i] === '{') tiefe++;
		else if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(auf, i);
	}
	return quelle.slice(auf);
}

/** Die HTTP-Methoden aus einer `+server.ts`. */
function methoden(quelle) {
	return [
		...new Set(
			[...quelle.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(
				(m) => m[1]
			)
		)
	];
}

/** Die Bäume, unter denen ein `[id=…]` eine bekannte Bedeutung hat. */
function idFuerBaum(bau, werte) {
	if (bau.startsWith('/versammlungen/')) return werte.meeting_id[0];
	if (bau.startsWith('/gemeinschaften/')) return werte.stweg_id[0];
	if (bau.startsWith('/tage/')) return werte.meeting_day_id[0];
	if (bau.startsWith('/personen/')) return werte.person_id[0];
	if (bau.startsWith('/betreiber/loeschen/')) return werte.operator_id[0];
	return null;
}

/** Ein füllbares Segment ohne `[id=…]`, sonst `null`. */
function segmentwert(segment, werte) {
	const name = segment.replace(/^\[\[?/, '').replace(/\]\]?$/, '').split('=')[0];
	switch (name) {
		case 'partei':
			return werte.party_id[0];
		case 'traktandumId':
			return werte.agenda_item_id[0];
		case 'nummer':
			return '1';
		case 'pruefsumme':
			// Die Prüfsumme des angelegten Anhangs von B, der eine Weg, auf dem
			// eine fremde Datei ohne Mandantenkennung in der Adresse erreichbar
			// wäre.
			return werte.pruefsumme[0];
		case 'datei':
			return 'probe.pdf';
		case 'eintrag':
			return randomUUID();
		default:
			return null;
	}
}

/**
 * Abfrageparameter, die der Durchstich füllen kann, wenn die Quelle sie liest.
 *
 * **Aus der Quelle abgeleitet, nicht aufgezählt.** Welche Endpunkte einen
 * Parameter verlangen, steht in ihrem Code (`searchParams.get('haus')`); hier
 * stehen nur die Werte, die der Durchstich dafür hat. Fehlt ein Parameter,
 * bekommt der Aufruf ein 400 «Geben Sie an …», eine korrekte Antwort auf eine
 * unvollständige Anfrage, aber keine Aussage über den Mandanten. Genau diese
 * Verwechslung soll die Variante unten vermeiden.
 */
function abfragewerte(werte) {
	return { haus: werte.party_id[0], partei: werte.party_id[0], traktandum: werte.agenda_item_id[0] };
}

/**
 * Die Routenliste: je Eintrag eine Adresse mit Methode, aus dem Baum erzeugt.
 *
 * Ausgelassen wird nur mit Grund, und jeder Grund wird gezählt: offene Pfade
 * (kein Mandant), Routen ohne Mandantenkennung in der Adresse und Segmente,
 * für die der Durchstich keinen Wert hat. Ein geratener Wert machte aus einer
 * 500 eine scheinbar saubere Absage, deshalb wird nicht geraten.
 */
function routenliste(werte) {
	const offen = offenePfade();
	const eintraege = [];
	const ohneKennung = [];
	const offeneWege = [];
	const ausgelassen = new Map();
	const auslassen = (grund) => ausgelassen.set(grund, (ausgelassen.get(grund) ?? 0) + 1);

	for (const datei of dateien(join(WURZEL, 'src/routes'))) {
		const relativ = relative(join(WURZEL, 'src/routes'), datei);
		const name = relativ.split('/').pop();
		if (!['+page.server.ts', '+page.svelte', '+server.ts'].includes(name)) continue;

		const verzeichnis = relativ.slice(0, -name.length).replace(/\/$/, '');
		const bau =
			'/' +
			verzeichnis
				.split('/')
				.filter((s) => s && !s.startsWith('('))
				.join('/');
		const offenerPfad = offen.some((p) => bau === p || bau.startsWith(`${p}/`));

		const quelle = readFileSync(datei, 'utf8');
		const arten = [];
		if (name === '+server.ts') {
			for (const m of methoden(quelle)) {
				if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
					/*
					 * **Zwei Formen, weil beide vorkommen.** Die Anwendung schickt
					 * Formulare; ein fremder Aufrufer schickt JSON. `versandpaket`
					 * fängt die JSON-Form ab (`formData().catch(…)`), `karten.pdf`
					 * tat es bis F7 (16.10.2026) nicht, und genau dieser
					 * Unterschied war am gebauten Stand eine 500-Seite. Ohne die
					 * zweite Form wäre er unsichtbar geblieben.
					 */
					arten.push({ methode: m, art: 'form' });
					arten.push({ methode: m, art: 'json' });
				} else {
					arten.push({ methode: m });
				}
			}
			if (arten.some((a) => a.methode === 'GET')) {
				const werteFuerAbfrage = abfragewerte(werte);
				const gelesen = [
					...new Set(
						[...quelle.matchAll(/searchParams\.get\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])
					)
				].filter((p) => p in werteFuerAbfrage);
				if (gelesen.length) {
					arten.push({
						methode: 'GET',
						query: gelesen.map((p) => `${p}=${werteFuerAbfrage[p]}`).join('&')
					});
				}
			}
		} else if (name === '+page.server.ts') {
			arten.push({ methode: 'GET' });
			for (const aktion of aktionsnamen(quelle, relative(WURZEL, datei))) arten.push({ methode: 'POST', aktion });
		} else {
			arten.push({ methode: 'GET' });
		}

		/*
		 * **Offene Pfade an den offenen Teil**, der für jeden Weg ein Urteil
		 * verlangt. Der Zugang dort ist ein Code, keine Sitzung; die Kennung des
		 * Mandanten kommt aus dem Code, und eine fremde kann nur im Feld stehen.
		 * Bis 27.10.2026 wurden diese Wege hier nur gezählt.
		 */
		if (offenerPfad) {
			auslassen(`offener Pfad (Zugang über Code, nicht über Sitzung): ${bau}`);
			for (const art of arten) {
				// Die JSON-Form eines Endpunkts ist dieselbe Funktion; das Feld zählt einmal.
				if (art.art === 'json' || art.query) continue;
				offeneWege.push({
					methode: art.methode,
					aktion: art.aktion,
					pfad: bau,
					datei: relative(WURZEL, datei.replace(/\+page\.svelte$/, '+page.server.ts')),
					endpunkt: name === '+server.ts',
					schluessel: `${art.methode} ${bau}${art.aktion ? `?/${art.aktion}` : ''}`
				});
			}
			continue;
		}

		let unvollstaendig = false;
		const adresse = bau
			.split('/')
			.map((segment) => {
				if (!segment.startsWith('[')) return segment;
				let wert = segmentwert(segment, werte);
				if (wert === null && /^\[\[?id/.test(segment)) wert = idFuerBaum(bau, werte);
				if (wert === null) {
					unvollstaendig = true;
					return segment;
				}
				return wert;
			})
			.join('/');
		if (unvollstaendig) {
			auslassen(`kein Wert für ein Segment: ${bau}`);
			continue;
		}
		if (!Object.values(werte).some((liste) => liste.some((w) => adresse.includes(w)))) {
			auslassen(`ohne Mandantenkennung in der Adresse: ${bau}`);
			// An den Feldteil, der für jeden dieser Wege ein Urteil verlangt.
			for (const art of arten) {
				ohneKennung.push({
					...art,
					pfad: bau,
					datei: relative(WURZEL, datei.replace(/\+page\.svelte$/, '+page.server.ts')),
					endpunkt: name === '+server.ts',
					schluessel: `${art.methode} ${bau}${art.aktion ? `?/${art.aktion}` : ''}`
				});
			}
			continue;
		}

		for (const art of arten) eintraege.push({ pfad: adresse, ...art });
	}
	/*
	 * **Entdoppelt.** Ein Verzeichnis mit `+page.server.ts` und `+page.svelte`
	 * liefert denselben Leseweg zweimal; zweimal dieselbe Adresse abzufragen
	 * prüft nichts ein zweites Mal, es zählt nur doppelt.
	 */
	const gesehen = new Set();
	const eindeutig = eintraege.filter((e) => {
		const schluessel =
			`${e.methode} ${e.pfad}${e.query ? `?${e.query}` : ''}${e.aktion ? `?/${e.aktion}` : ''}` +
			`${e.art ? ` [${e.art}]` : ''}`;
		if (gesehen.has(schluessel)) return false;
		gesehen.add(schluessel);
		return true;
	});
	// Ebenso: `+page.svelte` und `+page.server.ts` sind derselbe Leseweg.
	const ohneDoppel = [...new Map(ohneKennung.map((w) => [w.schluessel, w])).values()];
	const offenOhneDoppel = [...new Map(offeneWege.map((w) => [w.schluessel, w])).values()];
	return { eintraege: eindeutig, ausgelassen, ohneKennung: ohneDoppel, offeneWege: offenOhneDoppel };
}

// ── Betreiber B ─────────────────────────────────────────────────────────────

/**
 * Die Kennungen von Betreiber B und seinem Bestand, **ohne Datenbank**.
 *
 * Getrennt vom Einfügen, damit der Trockenlauf (`--liste`) die Routenliste
 * bilden kann, ohne etwas anzulegen: Er braucht nur Werte, die ein
 * Parametersegment füllen.
 */
function betreiberBWerte() {
	const werte = {
		operator_id: [randomUUID()],
		stweg_id: [randomUUID()],
		/*
		 * Die zweite trägt ein Siegel, für `/pruefen` im Feldteil; der Pfadteil
		 * nimmt nur die erste. Im Entwurf, nicht versiegelt: `holeSiegelwert`
		 * liest nur die Siegelzeile, und der Zustand «versiegelt» verlangt
		 * Zeitstempel und Schluss, die hier nichts prüften
		 * (`meeting_zeitstempel`). Die dritte läuft, für die Ströme der offenen
		 * Pfade: Nur eine laufende nimmt eine Saalmeldung an, und die löst das
		 * Ereignis von B aus.
		 */
		meeting_id: [randomUUID(), randomUUID(), randomUUID()],
		meeting_day_id: [randomUUID()],
		agenda_item_id: [randomUUID()],
		unit_id: [randomUUID(), randomUUID()],
		party_id: [randomUUID(), randomUUID()],
		person_id: [randomUUID()],
		/*
		 * **Die Vollmacht hängt am Stand, nicht an der Partei.** `proxy` kennt
		 * keine Parteikennungen, sondern die der Momentaufnahme
		 * (`snapshot_party`); eine Vollmacht entsteht erst mit der Freigabe.
		 * Deshalb bekommt B einen Stand mit zwei Stand-Parteien, anders liesse
		 * sich der Vollmachtsweg gar nicht anlegen.
		 */
		stand_partei: [randomUUID(), randomUUID()],
		holder_id: [],
		represented_id: []
	};
	werte.holder_id = [werte.stand_partei[0]];
	werte.represented_id = [werte.stand_partei[1]];
	/*
	 * Die Prüfsumme des Anhangs, absichtlich eine Reihe von `a`: Sie steht so
	 * nur bei B, und der Wert ist als erfunden erkennbar.
	 */
	werte.pruefsumme = ['a'.repeat(64)];
	/*
	 * Für den Feldteil: Zeilen, die nur über die Betreiberspalte an B hängen.
	 * Gezählt und entfernt werden sie über `operator_id` wie der Rest. Der
	 * Siegelwert ist erkennbar erfunden und steht nur bei B; erscheint er in
	 * einer Antwort an A, hat `/pruefen` ihn verraten.
	 */
	werte.konto = [randomUUID()];
	werte.geraet = [randomUUID()];
	werte.stufe = [randomUUID()];
	werte.siegelwert = ['b'.repeat(64)];
	/*
	 * Für die offenen Pfade: ein Durchgang von B (an der ersten Versammlung),
	 * dazu Saalmerkmal und Anzeigecode der laufenden. Mit ihnen löst der Lauf
	 * ein Ereignis von B aus und hört es auf dem Strom von B, damit «bei A kam
	 * nichts an» nicht bloss heisst, dass nichts gesendet wurde.
	 */
	werte.durchgang = [randomUUID()];
	werte.saalmerkmal = [randomBytes(32).toString('base64url')];
	werte.anzeigecode = [anzeigecode()];
	return werte;
}

/** Ein Anzeigecode in der Form der Anwendung (`src/lib/domain/zugang.ts`): zwölf Zeichen. */
function anzeigecode() {
	const alphabet = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
	return [...randomBytes(12)].map((b) => alphabet[b % alphabet.length]).join('');
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Der Kennungssatz von B für den Feldteil. */
function kennungenB(b) {
	return {
		stweg: b.stweg_id[0],
		archivStweg: b.stweg_id[0],
		meeting: b.meeting_id[0],
		archivMeeting: b.meeting_id[0],
		siegelMeeting: b.meeting_id[1],
		tag: b.meeting_day_id[0],
		person: b.person_id[0],
		konto: b.konto[0],
		geraet: b.geraet[0],
		stufe: b.stufe[0],
		// Für die offenen Pfade.
		durchgang: b.durchgang[0],
		einheit: b.unit_id[0],
		partei: b.party_id[0],
		standPartei: b.stand_partei[0],
		traktandum: b.agenda_item_id[0],
		haus: b.meeting_id[0]
	};
}

/**
 * Die Prüfgegenstände von A für die Gegenhälfte des Feldteils.
 *
 * **Eigene, nicht die vorhandenen.** Die Gegenhälfte archiviert, widerruft,
 * stellt ausser Dienst und entfernt; an den Testbeständen von A täte sie das
 * an Daten, auf die andere Durchstiche bauen. Zwei Gemeinschaften (eine zum
 * Arbeiten, eine zum Archivieren), drei Versammlungen (Entwurf, Archiv,
 * mit Siegel), dazu Abend, Person, Konto, Gerät und eine KI-Stufe zuunterst.
 */
async function pruefgegenstaendeA(operator) {
	const a = {
		operator,
		stweg: [randomUUID(), randomUUID()],
		meeting: [randomUUID(), randomUUID(), randomUUID()],
		tag: randomUUID(),
		person: randomUUID(),
		konto: randomUUID(),
		geraet: randomUUID(),
		stufe: randomUUID()
	};
	const [s0, s1] = a.stweg;
	const [m0, m1, m2] = a.meeting;
	await sql(`
		BEGIN;
		INSERT INTO stweg (id, operator_id, name)
		VALUES ('${s0}', '${operator}', 'E2E Eigenprobe ${A_ZEICHEN}'),
		       ('${s1}', '${operator}', 'E2E Eigenarchiv ${A_ZEICHEN}');
		INSERT INTO person (id, operator_id, display_name)
		VALUES ('${a.person}', '${operator}', 'E2E Eigenperson ${A_ZEICHEN}');
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode)
		VALUES ('${m0}', '${operator}', '${s0}', 'entwurf', current_date - 30, '19:00', 'Eigenprobe ${A_ZEICHEN}', 'ordentlich', 'gefuehrt'),
		       ('${m1}', '${operator}', '${s0}', 'entwurf', current_date - 31, '19:00', 'Eigenarchiv ${A_ZEICHEN}', 'ordentlich', 'gefuehrt'),
		       ('${m2}', '${operator}', '${s0}', 'entwurf', current_date - 32, '19:00', 'Eigensiegel ${A_ZEICHEN}', 'ordentlich', 'gefuehrt');
		INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash, package_hash, package_bytes)
		VALUES ('${operator}', '${m2}', '{}', '${'d'.repeat(64)}', '${'e'.repeat(64)}', 1);
		INSERT INTO meeting_day (id, operator_id, label, day_date, start_time, location)
		VALUES ('${a.tag}', '${operator}', 'E2E Eigenabend ${A_ZEICHEN}', current_date - 30, '19:00', 'Eigenprobe');
		INSERT INTO app_user (id, operator_id, username, display_name, role, email)
		VALUES ('${a.konto}', '${operator}', 'prueflauf-eigen-${MARKE}', 'E2E Eigenkonto ${A_ZEICHEN}', 'chair',
		        'eigen-${MARKE}@example.ch');
		INSERT INTO handover_device (id, operator_id, name, enc_public_key, sig_public_key, fingerprint)
		VALUES ('${a.geraet}', '${operator}', 'E2E Eigengerät ${A_ZEICHEN}', '${'P'.repeat(43)}', '${'P'.repeat(43)}', '${'0'.repeat(64)}');
		INSERT INTO ai_stage (id, operator_id, position, name, url, model)
		SELECT '${a.stufe}', '${operator}', coalesce(max(position), 0) + 1, 'E2E Eigenstufe ${A_ZEICHEN}',
		       'http://127.0.0.1:9', 'probe'
		  FROM ai_stage WHERE operator_id = '${operator}';
		INSERT INTO audit_entry (operator_id, actor_label, event_type, subject_type, subject_id)
		VALUES ('${operator}', 'E2E Eigenprobe ${A_ZEICHEN}', 'meeting.created', 'meeting', '${m0}'),
		       ('${operator}', 'E2E Eigenprobe ${A_ZEICHEN}', 'stweg.created', 'stweg', '${s0}'),
		       ('${operator}', 'E2E Eigenprobe ${A_ZEICHEN}', 'meeting_day.created', 'meeting_day', '${a.tag}');
		COMMIT;
	`);
	return a;
}

/**
 * Eine laufende Versammlung von A für die offenen Pfade, mit offenem
 * Durchgang und fünf Parteien.
 *
 * **Eine eigene Gemeinschaft und ein eigener Abend**, nicht die des Feldteils:
 * Dessen Gegenhälfte legt Versammlungen an `stweg[0]` an und filtert den
 * Verlauf nach `tag`; Parteien und eine laufende Versammlung daran änderten,
 * was sie dort sieht.
 *
 * Die Rollen der Parteien (Zugänge holt der Lauf über `codeAusgeben`):
 * `stimme` ist anwesend und stimmt, `vertreter` nimmt Vollmachten an,
 * `erklaeren` und `erklaeren2` sind abwesend und erklären eine, `weisen` hat
 * schon eine und erteilt Weisungen. Die Namen tragen das Zeichen von A, damit
 * `aEntfernen` den Verlauf der Eigentümer findet.
 */
async function zugangslageA(operator) {
	const rollen = ['stimme', 'vertreter', 'erklaeren', 'erklaeren2', 'weisen'];
	const z = {
		stweg: randomUUID(),
		meeting: randomUUID(),
		tag: randomUUID(),
		traktandum: randomUUID(),
		durchgang: randomUUID(),
		saalmerkmal: randomBytes(32).toString('base64url'),
		abendmerkmal: randomBytes(32).toString('base64url'),
		partei: {},
		einheit: {},
		stand: {}
	};
	for (const r of rollen) {
		z.partei[r] = randomUUID();
		z.einheit[r] = randomUUID();
		z.stand[r] = randomUUID();
	}
	const zeilen = (bau) => rollen.map(bau).join(',\n');
	await sql(`
		BEGIN;
		INSERT INTO stweg (id, operator_id, name, proxy_by_access, proxy_by_access_source)
		VALUES ('${z.stweg}', '${operator}', 'E2E Eigenzugang ${A_ZEICHEN}', true, 'Prüflauf Fremdbetreiber');
		INSERT INTO party (id, stweg_id, operator_id, display_name) VALUES
		${zeilen((r) => `('${z.partei[r]}', '${z.stweg}', '${operator}', 'E2E Eigenpartei ${r} ${A_ZEICHEN}')`)};
		INSERT INTO unit (id, stweg_id, operator_id, label) VALUES
		${zeilen((r) => `('${z.einheit[r]}', '${z.stweg}', '${operator}', 'Eigen ${r} ${A_ZEICHEN}')`)};
		INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from) VALUES
		${zeilen((r) => `('${z.einheit[r]}', '${z.partei[r]}', '${z.stweg}', '${operator}', current_date - 1)`)};
		INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
		SELECT u.id, qk.id, u.stweg_id, u.operator_id, 200
		  FROM unit u JOIN quota_kind qk ON qk.stweg_id = u.stweg_id AND qk.is_primary
		 WHERE u.stweg_id = '${z.stweg}';
		INSERT INTO meeting_day (id, operator_id, label, day_date, start_time, location, room_entry_token)
		VALUES ('${z.tag}', '${operator}', 'E2E Eigenzugangsabend ${A_ZEICHEN}', current_date, '19:00', 'Eigenprobe',
		        '${z.abendmerkmal}');
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode,
		                     released_at, opened_at, meeting_day_id, room_entry_token)
		VALUES ('${z.meeting}', '${operator}', '${z.stweg}', 'laufend', current_date, '19:00', 'Eigenzugang ${A_ZEICHEN}',
		        'ordentlich', 'gefuehrt', now(), now(), '${z.tag}', '${z.saalmerkmal}');
		INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind, motion_text, body)
		VALUES ('${z.traktandum}', '${operator}', '${z.meeting}', 1, 'E2E Eigentraktandum ${A_ZEICHEN}', 'abstimmung',
		        'gemeinschaft', 'Eigener Antragstext.', 'Eigener Antragstext.');
		INSERT INTO snapshot (meeting_id, operator_id, as_of_date, head_count_mode, parking_counts_as_head, total_quota)
		VALUES ('${z.meeting}', '${operator}', current_date, 'per_owner', false, 1000);
		INSERT INTO snapshot_party (id, operator_id, meeting_id, party_id, display_name) VALUES
		${zeilen((r) => `('${z.stand[r]}', '${operator}', '${z.meeting}', '${z.partei[r]}', 'E2E Eigenpartei ${r} ${A_ZEICHEN}')`)};
		INSERT INTO snapshot_unit (operator_id, meeting_id, snapshot_party_id, unit_id, label, kind, quota) VALUES
		${zeilen((r) => `('${operator}', '${z.meeting}', '${z.stand[r]}', '${z.einheit[r]}', 'Eigen ${r}', 'unit', 200)`)};
		INSERT INTO attendance_event (operator_id, meeting_id, snapshot_party_id, kind, channel, recorded_by_label)
		VALUES ('${operator}', '${z.meeting}', '${z.stand.stimme}', 'eingetroffen', 'von_hand', 'Prüflauf ${A_ZEICHEN}');
		INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_id, state, declared_via)
		VALUES ('${operator}', '${z.meeting}', '${z.stand.weisen}', '${z.stand.vertreter}', 'erfasst', 'zugang');
		INSERT INTO voting_round (id, operator_id, meeting_id, agenda_item_id, ordinal)
		VALUES ('${z.durchgang}', '${operator}', '${z.meeting}', '${z.traktandum}', 1);
		COMMIT;
	`);
	return z;
}

function kennungenA(a) {
	return {
		stweg: a.stweg[0],
		archivStweg: a.stweg[1],
		meeting: a.meeting[0],
		archivMeeting: a.meeting[1],
		siegelMeeting: a.meeting[2],
		tag: a.tag,
		person: a.person,
		konto: a.konto,
		geraet: a.geraet,
		stufe: a.stufe,
		// Für die offenen Pfade: die Partei, die stimmt, und die, die vertritt.
		durchgang: a.zugang.durchgang,
		einheit: a.zugang.einheit.stimme,
		partei: a.zugang.partei.stimme,
		standPartei: a.zugang.stand.vertreter,
		traktandum: a.zugang.traktandum,
		haus: a.zugang.meeting,
		abendmerkmal: a.zugang.abendmerkmal,
		saalmerkmal: a.zugang.saalmerkmal
	};
}

/** Legt B samt seinem kleinen Bestand an. */
async function betreiberBEinfuegen(werte) {
	await sql(`
		BEGIN;
		INSERT INTO operator (id, name)
		VALUES ('${werte.operator_id[0]}', 'Fremdbetreiber-Prüfstand ${B_ZEICHEN}');
		INSERT INTO stweg (id, operator_id, name)
		VALUES ('${werte.stweg_id[0]}', '${werte.operator_id[0]}', 'E2E Fremdbetreiber Prüflauf ${B_ZEICHEN}');
		INSERT INTO person (id, operator_id, display_name)
		VALUES ('${werte.person_id[0]}', '${werte.operator_id[0]}', 'E2E Fremd Eigentümerin ${B_ZEICHEN}');
		INSERT INTO party (id, stweg_id, operator_id, display_name, person_id)
		VALUES
			('${werte.party_id[0]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', 'E2E Fremd Erste ${B_ZEICHEN}', '${werte.person_id[0]}'),
			('${werte.party_id[1]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', 'E2E Fremd Zweite ${B_ZEICHEN}', NULL);
		INSERT INTO unit (id, stweg_id, operator_id, label)
		VALUES
			('${werte.unit_id[0]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', 'Fremd Whg 1 ${B_ZEICHEN}'),
			('${werte.unit_id[1]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', 'Fremd Whg 2 ${B_ZEICHEN}');
		INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from)
		VALUES
			('${werte.unit_id[0]}', '${werte.party_id[0]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', current_date - 1),
			('${werte.unit_id[1]}', '${werte.party_id[1]}', '${werte.stweg_id[0]}', '${werte.operator_id[0]}', current_date - 1);
		/*
		 * **Die Stammquote ist Pflicht, und zwar beim Commit.** Ein Auslöser legt
		 * beim Anlegen der Gemeinschaft die primäre Quote an; ein zweiter,
		 * aufgeschobener prüft beim Festschreiben, dass jede Einheit einen Wert
		 * dazu trägt. Ohne diese Zeilen scheitert erst das COMMIT, mit einer
		 * Meldung, die auf die Einheit zeigt.
		 */
		INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
		SELECT u.id, qk.id, u.stweg_id, u.operator_id, 100
		  FROM unit u
		  JOIN quota_kind qk ON qk.stweg_id = u.stweg_id AND qk.is_primary
		 WHERE u.stweg_id = '${werte.stweg_id[0]}';
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode)
		VALUES ('${werte.meeting_id[0]}', '${werte.operator_id[0]}', '${werte.stweg_id[0]}', 'entwurf',
		        current_date, '19:00', 'Fremdbetreiber-Prüfstand ${B_ZEICHEN}', 'ordentlich', 'gefuehrt'),
		       ('${werte.meeting_id[1]}', '${werte.operator_id[0]}', '${werte.stweg_id[0]}', 'entwurf',
		        current_date - 40, '19:00', 'Fremdbetreiber-Prüfstand ${B_ZEICHEN}', 'ordentlich', 'gefuehrt');
		INSERT INTO meeting_day (id, operator_id, label, day_date, start_time, location)
		VALUES ('${werte.meeting_day_id[0]}', '${werte.operator_id[0]}', 'E2E Fremd-Abend ${B_ZEICHEN}',
		        current_date, '19:00', 'Fremdbetreiber-Prüfstand');
		INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind, motion_text, body)
		VALUES ('${werte.agenda_item_id[0]}', '${werte.operator_id[0]}', '${werte.meeting_id[0]}', 1,
		        'E2E Fremdes Traktandum ${B_ZEICHEN}', 'abstimmung', 'gemeinschaft', 'Fremder Antragstext.', 'Fremder Antragstext.');
		INSERT INTO snapshot (meeting_id, operator_id, as_of_date, head_count_mode, parking_counts_as_head, total_quota)
		VALUES ('${werte.meeting_id[0]}', '${werte.operator_id[0]}', current_date, 'per_owner', false, 0);
		INSERT INTO snapshot_party (id, operator_id, meeting_id, party_id, display_name)
		VALUES
			('${werte.stand_partei[0]}', '${werte.operator_id[0]}', '${werte.meeting_id[0]}', '${werte.party_id[0]}', 'E2E Fremd Erste ${B_ZEICHEN}'),
			('${werte.stand_partei[1]}', '${werte.operator_id[0]}', '${werte.meeting_id[0]}', '${werte.party_id[1]}', 'E2E Fremd Zweite ${B_ZEICHEN}');
		INSERT INTO proxy (id, operator_id, meeting_id, represented_id, holder_id, state, declared_via)
		VALUES ('${randomUUID()}', '${werte.operator_id[0]}', '${werte.meeting_id[0]}',
		        '${werte.represented_id[0]}', '${werte.holder_id[0]}', 'erfasst', 'leitung');
		INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id, checksum, original_name, content_type, size_bytes)
		VALUES ('${werte.operator_id[0]}', '${werte.stweg_id[0]}', 'meeting', '${werte.meeting_id[0]}',
		        '${werte.pruefsumme[0]}', 'Fremde Unterlage.pdf', 'application/pdf', 10);
		INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash, package_hash, package_bytes)
		VALUES ('${werte.operator_id[0]}', '${werte.meeting_id[1]}', '{}', '${werte.siegelwert[0]}', '${'c'.repeat(64)}', 1);
		INSERT INTO app_user (id, operator_id, username, display_name, role, email)
		VALUES ('${werte.konto[0]}', '${werte.operator_id[0]}', 'prueflauf-fremd-${MARKE}', 'E2E Fremdkonto ${B_ZEICHEN}',
		        'chair', 'fremd-${MARKE}@example.ch');
		INSERT INTO handover_device (id, operator_id, name, enc_public_key, sig_public_key, fingerprint)
		VALUES ('${werte.geraet[0]}', '${werte.operator_id[0]}', 'Fremdgerät ${B_ZEICHEN}', '${'P'.repeat(43)}', '${'P'.repeat(43)}', '${'f'.repeat(64)}');
		INSERT INTO ai_stage (id, operator_id, position, name, url, model)
		VALUES ('${werte.stufe[0]}', '${werte.operator_id[0]}', 1, 'Fremdstufe ${B_ZEICHEN}', 'http://127.0.0.1:9', 'probe');
		INSERT INTO voting_round (id, operator_id, meeting_id, agenda_item_id, ordinal)
		VALUES ('${werte.durchgang[0]}', '${werte.operator_id[0]}', '${werte.meeting_id[0]}', '${werte.agenda_item_id[0]}', 1);
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode,
		                     released_at, opened_at, room_entry_token, display_code_hash)
		VALUES ('${werte.meeting_id[2]}', '${werte.operator_id[0]}', '${werte.stweg_id[0]}', 'laufend', current_date, '19:00',
		        'Fremdbetreiber-Prüfstand ${B_ZEICHEN}', 'ordentlich', 'gefuehrt', now(), now(),
		        '${werte.saalmerkmal[0]}', '${sha256(werte.anzeigecode[0])}');
		INSERT INTO snapshot (meeting_id, operator_id, as_of_date, head_count_mode, parking_counts_as_head, total_quota)
		VALUES ('${werte.meeting_id[2]}', '${werte.operator_id[0]}', current_date, 'per_owner', false, 0);
		-- Verlauf von B, den der Verlauf von A nie zeigen darf, auch nicht gefiltert
		-- nach einer Kennung von B.
		INSERT INTO audit_entry (operator_id, actor_label, event_type, subject_type, subject_id)
		VALUES ('${werte.operator_id[0]}', 'E2E Fremdprobe ${B_ZEICHEN}', 'meeting.created', 'meeting', '${werte.meeting_id[0]}'),
		       ('${werte.operator_id[0]}', 'E2E Fremdprobe ${B_ZEICHEN}', 'stweg.created', 'stweg', '${werte.stweg_id[0]}'),
		       ('${werte.operator_id[0]}', 'E2E Fremdprobe ${B_ZEICHEN}', 'meeting_day.created', 'meeting_day', '${werte.meeting_day_id[0]}');
		COMMIT;
	`);
}

// ── Die Versuche ────────────────────────────────────────────────────────────

/**
 * Ein Aufruf mit Frist.
 *
 * **Die Frist ist kein Komfort.** `/versammlungen/[id]/strom` ist ein
 * Ereignisstrom: Antwortet er einem fremden Betreiber nicht mit der Absage,
 * sondern mit 200 und offenem Strom, läse `.text()` bis in alle Ewigkeit. Die
 * abgelaufene Frist wird als eigener Ausgang gemeldet, «ein Strom öffnete
 * sich» ist ein Fund, kein Hänger.
 */
async function aufruf(methode, pfad, keks, art) {
	const kopf = { origin: ZIEL, cookie: keks };
	if (methode === 'GET' || methode === 'HEAD' || methode === 'OPTIONS') {
		kopf.accept = 'text/html';
	} else if (art === 'form') {
		kopf['content-type'] = 'application/x-www-form-urlencoded';
		kopf.accept = 'text/html';
	} else {
		// JSON: SvelteKits CSRF-Schutz gilt den Formular-Inhaltsarten. Hier ist
		// die Herkunft nicht die Frage (das ist V4), sondern der Mandant.
		kopf['content-type'] = 'application/json';
	}
	const mitKoerper = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(methode);
	try {
		const antwort = await fetch(`${ZIEL}${pfad}`, {
			method: methode,
			redirect: 'manual',
			headers: kopf,
			body: mitKoerper ? (art === 'form' ? '' : '{}') : undefined,
			signal: AbortSignal.timeout(FRIST_MS)
		});
		return { status: antwort.status, koerper: (await antwort.text()).slice(0, 300) };
	} catch (unfall) {
		if (unfall.name === 'TimeoutError' || unfall.name === 'AbortError') {
			return {
				status: 0,
				koerper: `keine Antwort innerhalb ${FRIST_MS / 1000} s, offener Strom?`
			};
		}
		throw unfall;
	}
}

function keksAus(antwort, name) {
	return (antwort.headers.getSetCookie?.() ?? []).find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

/** Löst einen Anzeigecode über `/p/<code>` ein und gibt den Keks der Leinwand. */
async function leinwandKeks(code) {
	const r = await fetch(`${ZIEL}/p/${code}`, { redirect: 'manual', signal: AbortSignal.timeout(FRIST_MS) });
	const keks = keksAus(r, 'versammlung_anzeige');
	behaupte(keks, `Anzeigecode ${code} nicht eingelöst (HTTP ${r.status})`);
	return keks;
}

/**
 * Hört einem Ereignisstrom zu und sammelt seine Nachrichten.
 *
 * Herzschläge zählen nicht; sie tragen nichts. `ende()` bricht ab und wartet,
 * bis der Leser zu ist.
 */
async function lauschen(pfad, keks) {
	const abbruch = new AbortController();
	// Eine Frist auf den Antwortkopf; danach hält der Strom so lange, wie er soll.
	const frist = setTimeout(() => abbruch.abort(), FRIST_MS);
	const antwort = await fetch(`${ZIEL}${pfad}`, {
		headers: { cookie: keks, accept: 'text/event-stream' },
		signal: abbruch.signal
	}).finally(() => clearTimeout(frist));
	behaupte(antwort.ok, `${pfad} antwortet ${antwort.status}`);
	const nachrichten = [];
	const zustand = { zu: false };
	const dekodierer = new TextDecoder();
	let rest = '';
	const leser = antwort.body.getReader();
	const gelesen = (async () => {
		try {
			for (;;) {
				const { done, value } = await leser.read();
				if (done) break;
				rest += dekodierer.decode(value, { stream: true });
				const teile = rest.split('\n\n');
				rest = teile.pop();
				for (const t of teile) if (!t.startsWith('event: herzschlag')) nachrichten.push(t);
			}
		} catch {
			/* abgebrochen */
		}
		zustand.zu = true;
	})();
	return {
		nachrichten,
		/** Ob der Server den Strom beendet hat (oder `ende()` ihn abbrach). */
		get zu() {
			return zustand.zu;
		},
		async ende() {
			abbruch.abort();
			await gelesen;
		}
	};
}

/** Wartet, bis `bedingung` gilt, höchstens `ms`. */
async function bis(bedingung, ms) {
	const beginn = Date.now();
	while (!bedingung() && Date.now() - beginn < ms) await new Promise((r) => setTimeout(r, 200));
	return bedingung();
}

/**
 * Die Versuche eines Teils gegen B, gezählt und eingeordnet.
 *
 * Gemeinsam für Feldteil und offenen Teil: dieselbe Abnahme, dieselbe Zeile im
 * Protokoll. `keksFuer` gibt den Keks eines Versuchs (unter `/z` je Zugang).
 */
async function versucheGegenB(wege, { keksFuer, kB, kA, bZeichen, bKennungen }) {
	const zaehlung = { versuche: 0, abgewiesen: 0, eingeordnet: 0, hart: 0, abweichend: 0 };
	const rot = [];
	for (const weg of wege) {
		for (const versuch of weg.urteil.versuche) {
			const antwort = await versuchen({
				ziel: ZIEL,
				keks: keksFuer(versuch),
				weg,
				versuch,
				k: kB,
				basis: kA,
				zeichen: MARKE,
				frist: FRIST_MS
			});
			const urteil = beurteilen(antwort, versuch.fremd, bZeichen, bKennungen, kB);
			zaehlung.versuche += 1;
			const zeile = `${weg.schluessel} [${versuch.feld}] → HTTP ${antwort.status}: ${kernsatz(antwort)}`;
			if (urteil.hart) {
				zaehlung.hart += 1;
				rot.push(`${zeile} (${urteil.grund})`);
			} else if (!urteil.ok) {
				zaehlung.abweichend += 1;
				rot.push(`${zeile} (${urteil.grund})`);
			} else if (antwort.status === 403 || antwort.status === 404) {
				zaehlung.abgewiesen += 1;
				console.log(`       · ${zeile}`);
			} else {
				// Fachliche Absage, einzeln eingeordnet im Urteil des Wegs.
				zaehlung.eingeordnet += 1;
				console.log(`       · ${zeile}`);
			}
		}
	}
	behaupte(rot.length === 0, `${rot.length} Versuche nicht wie eingeordnet:\n       ${rot.join('\n       ')}`);
	return (
		`${zaehlung.versuche} Versuche an ${wege.length} Wegen: ${zaehlung.abgewiesen}× 403/404, ` +
		`${zaehlung.eingeordnet}× einzeln eingeordnet, ${zaehlung.hart}× hart`
	);
}

/** Die Gegenhälfte eines Teils: dieselben Felder mit Kennungen von A. */
async function versucheMitA(wege, { keksFuer, kA, bZeichen, bKennungen }) {
	/*
	 * Was verbraucht, kommt zuletzt (`zuletzt`), sonst fände der nächste
	 * Versuch nichts mehr. Die Sortierung ist stabil: Sonst gilt die Reihenfolge
	 * der Tabelle.
	 */
	const reihe = wege
		.flatMap((weg) => weg.urteil.versuche.map((versuch) => ({ weg, versuch })))
		.sort((x, y) => Number(Boolean(x.versuch.zuletzt)) - Number(Boolean(y.versuch.zuletzt)));
	const rot = [];
	for (const { weg, versuch } of reihe) {
		const antwort = await versuchen({
			ziel: ZIEL,
			keks: keksFuer(versuch),
			weg,
			versuch,
			k: kA,
			basis: kA,
			zeichen: MARKE,
			frist: FRIST_MS
		});
		const urteil = beurteilen(antwort, versuch.eigen, bZeichen, bKennungen, kA);
		const zeile = `${weg.schluessel} [${versuch.feld}] → HTTP ${antwort.status}: ${kernsatz(antwort)}`;
		if (urteil.hart || !urteil.ok) rot.push(`${zeile} (${urteil.grund})`);
		else console.log(`       · ${zeile}`);
	}
	behaupte(rot.length === 0, `${rot.length} eigene Felder gehen nicht durch:\n       ${rot.join('\n       ')}`);
	return `${reihe.length} Felder mit eigener Kennung angenommen`;
}

/** Meldet A an und gibt den Sitzungskeks. */
async function anmelden() {
	const antwort = await fetch(`${ZIEL}/anmelden`, {
		method: 'POST',
		redirect: 'manual',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'text/html',
			origin: ZIEL
		},
		body: new URLSearchParams({ username: BENUTZER, kennwort: KENNWORT }).toString()
	});
	const keks = (antwort.headers.getSetCookie?.() ?? [])
		.find((c) => c.startsWith('versammlung_sitzung='))
		?.split(';')[0];
	behaupte(keks, `Kein Sitzungskeks (HTTP ${antwort.status})`);
	return keks;
}

// ── Kreuzteil: eigener Pfad, fremde Kennung im Feld ─────────────────────────

/** Ein Zugangscode in der Form der Anwendung, fünf Gruppen zu vier Zeichen. */
function zugangscode() {
	const alphabet = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
	const zeichen = [...randomBytes(20)].map((z) => alphabet[z % alphabet.length]).join('');
	return zeichen.match(/.{4}/g).join('-');
}
const pruefwertCode = (code) => sha256(code.toUpperCase().replace(/[^A-Z0-9]/g, ''));

/**
 * Was B für den Kreuzteil zusätzlich braucht: je Kennungsart, die ein Feld
 * unter einem Mandantenpfad trägt, eine Zeile. Ohne sie fände eine Aktion die
 * Kennung gar nicht, und «Absage» hiesse nur, dass es die Zeile nirgends gibt.
 *
 * Alles hängt über `operator_id` an B und geht mit `bEntfernen`.
 */
async function kreuzBestandB(b) {
	const o = b.operator_id[0];
	const s = b.stweg_id[0];
	const [m0, , m2] = b.meeting_id;
	const t = b.agenda_item_id[0];
	const k = {
		huelle: randomUUID(),
		mitglied: randomUUID(),
		ausstand: randomUUID(),
		geschaeft: randomUUID(),
		pendenz: randomUUID(),
		ruege: randomUUID(),
		meldung: randomUUID(),
		vertretung: randomUUID(),
		nutzniessung: randomUUID(),
		regel: randomUUID(),
		kinutzung: randomUUID(),
		zugangscode: zugangscode()
	};
	await sql(`
		BEGIN;
		INSERT INTO party (id, stweg_id, operator_id, display_name, is_community)
		VALUES ('${k.huelle}', '${s}', '${o}', 'E2E Fremdhülle ${B_ZEICHEN}', true);
		INSERT INTO party_member (id, operator_id, stweg_id, huelle_party_id, mitglied_party_id,
		                          huelle_ist_gemeinschaftlich, mitglied_ist_gemeinschaftlich)
		VALUES ('${k.mitglied}', '${o}', '${s}', '${k.huelle}', '${b.party_id[0]}', true, false);
		INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id, grund, erklaert_durch)
		VALUES ('${k.ausstand}', '${o}', '${m0}', '${t}', '${b.party_id[0]}', 'Fremdausstand ${B_ZEICHEN}', 'Prüflauf');
		INSERT INTO business (id, operator_id, meeting_day_id, title, item_kind)
		VALUES ('${k.geschaeft}', '${o}', '${b.meeting_day_id[0]}', 'E2E Fremdgeschäft ${B_ZEICHEN}', 'abstimmung');
		INSERT INTO pendenz (id, operator_id, stweg_id, meeting_id, agenda_item_id, wording, due_kind)
		VALUES ('${k.pendenz}', '${o}', '${s}', '${m0}', '${t}', 'Fremdpendenz ${B_ZEICHEN}', 'keine');
		INSERT INTO objection (id, operator_id, meeting_id, agenda_item_id, wording, raised_by, raised_time)
		VALUES ('${k.ruege}', '${o}', '${m0}', '${t}', 'Fremdrüge ${B_ZEICHEN}', 'Prüflauf', '19:30');
		INSERT INTO room_entry_request (id, operator_id, meeting_id, claimed_name)
		VALUES ('${k.meldung}', '${o}', '${m2}', 'Fremdmeldung ${B_ZEICHEN}');
		INSERT INTO representation (id, operator_id, party_id, stweg_id, person_name, valid_from)
		VALUES ('${k.vertretung}', '${o}', '${b.party_id[0]}', '${s}', 'Fremdvertretung ${B_ZEICHEN}', current_date - 1);
		INSERT INTO usufruct (id, unit_id, stweg_id, operator_id, holder_name, valid_from)
		VALUES ('${k.nutzniessung}', '${b.unit_id[0]}', '${s}', '${o}', 'Fremdnutzniessung ${B_ZEICHEN}', current_date - 1);
		INSERT INTO bylaw_quorum_rule (id, operator_id, stweg_id, business_kind, head_numerator, head_denominator,
		                               head_mode, head_base, quota_base, source_reference)
		VALUES ('${k.regel}', '${o}', '${s}', 'hausordnung', 1, 2, 'mehr_als', 'anwesend_vertreten', 'keine',
		        'Art. 99 Fremdreglement ${B_ZEICHEN}');
		INSERT INTO ai_usage (id, operator_id, meeting_id, stweg_id, feature, subject_type, subject_id)
		VALUES ('${k.kinutzung}', '${o}', '${m0}', '${s}', 'traktandenpruefung', 'agenda_item', '${t}');
		INSERT INTO meeting_access (operator_id, meeting_id, snapshot_party_id, code_hash)
		VALUES ('${o}', '${m0}', '${b.stand_partei[0]}', '${pruefwertCode(k.zugangscode)}');
		COMMIT;
	`);
	k.verteiler = await skalar(`SELECT id FROM quota_kind WHERE stweg_id = '${s}' AND is_primary`);
	k.anhang = await skalar(`SELECT id FROM attachment WHERE operator_id = '${o}'`);
	k.vollmacht = await skalar(`SELECT id FROM proxy WHERE operator_id = '${o}'`);
	return k;
}

/**
 * Das Gegenstück bei A, an der laufenden Versammlung der Zugangslage: die
 * Werte, mit denen die übrigen Felder eines Versuchs gefüllt werden. Dazu eine
 * Versammlung im Entwurf an derselben Gemeinschaft, für die Wege, die nur im
 * Entwurf arbeiten (Traktanden). Alles hängt an Gemeinschaft, Versammlung oder
 * Abend der Zugangslage und geht mit `aEntfernen`.
 */
async function kreuzBestandA(a) {
	const o = a.operator;
	const z = a.zugang;
	const k = {
		entwurf: randomUUID(),
		entwurfTraktandum: randomUUID(),
		huelle: randomUUID(),
		mitglied: randomUUID(),
		ausstand: randomUUID(),
		geschaeft: randomUUID(),
		pendenz: randomUUID(),
		ruege: randomUUID(),
		meldung: randomUUID(),
		vertretung: randomUUID(),
		nutzniessung: randomUUID(),
		regel: randomUUID(),
		kinutzung: randomUUID(),
		anhang: randomUUID(),
		zugangscode: zugangscode()
	};
	await sql(`
		BEGIN;
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode)
		VALUES ('${k.entwurf}', '${o}', '${z.stweg}', 'entwurf', current_date + 20, '19:00', 'Kreuzentwurf ${A_ZEICHEN}',
		        'ordentlich', 'gefuehrt');
		INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind, motion_text, body)
		VALUES ('${k.entwurfTraktandum}', '${o}', '${k.entwurf}', 1, 'E2E Kreuztraktandum ${A_ZEICHEN}', 'abstimmung',
		        'gemeinschaft', 'Eigener Antragstext.', 'Eigener Antragstext.');
		INSERT INTO party (id, stweg_id, operator_id, display_name, is_community)
		VALUES ('${k.huelle}', '${z.stweg}', '${o}', 'E2E Eigenhülle ${A_ZEICHEN}', true);
		INSERT INTO party_member (id, operator_id, stweg_id, huelle_party_id, mitglied_party_id,
		                          huelle_ist_gemeinschaftlich, mitglied_ist_gemeinschaftlich)
		VALUES ('${k.mitglied}', '${o}', '${z.stweg}', '${k.huelle}', '${z.partei.erklaeren2}', true, false);
		INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id, grund, erklaert_durch)
		VALUES ('${k.ausstand}', '${o}', '${z.meeting}', '${z.traktandum}', '${z.partei.erklaeren}',
		        'Eigenausstand ${A_ZEICHEN}', 'Prüflauf');
		INSERT INTO business (id, operator_id, meeting_day_id, title, item_kind)
		VALUES ('${k.geschaeft}', '${o}', '${z.tag}', 'E2E Eigengeschäft ${A_ZEICHEN}', 'abstimmung');
		INSERT INTO pendenz (id, operator_id, stweg_id, meeting_id, agenda_item_id, wording, due_kind)
		VALUES ('${k.pendenz}', '${o}', '${z.stweg}', '${z.meeting}', '${z.traktandum}', 'Eigenpendenz ${A_ZEICHEN}', 'keine');
		INSERT INTO objection (id, operator_id, meeting_id, agenda_item_id, wording, raised_by, raised_time)
		VALUES ('${k.ruege}', '${o}', '${z.meeting}', '${z.traktandum}', 'Eigenrüge ${A_ZEICHEN}', 'Prüflauf', '19:30');
		INSERT INTO room_entry_request (id, operator_id, meeting_id, claimed_name)
		VALUES ('${k.meldung}', '${o}', '${z.meeting}', 'Eigenmeldung ${A_ZEICHEN}');
		INSERT INTO representation (id, operator_id, party_id, stweg_id, person_name, valid_from)
		VALUES ('${k.vertretung}', '${o}', '${z.partei.erklaeren2}', '${z.stweg}', 'Eigenvertretung ${A_ZEICHEN}',
		        current_date - 1);
		INSERT INTO usufruct (id, unit_id, stweg_id, operator_id, holder_name, valid_from)
		VALUES ('${k.nutzniessung}', '${z.einheit.erklaeren2}', '${z.stweg}', '${o}', 'Eigennutzniessung ${A_ZEICHEN}',
		        current_date - 1);
		INSERT INTO bylaw_quorum_rule (id, operator_id, stweg_id, business_kind, head_numerator, head_denominator,
		                               head_mode, head_base, quota_base, source_reference)
		VALUES ('${k.regel}', '${o}', '${z.stweg}', 'hausordnung', 1, 2, 'mehr_als', 'anwesend_vertreten', 'keine',
		        'Art. 99 Eigenreglement ${A_ZEICHEN}');
		INSERT INTO ai_usage (id, operator_id, meeting_id, stweg_id, feature, subject_type, subject_id)
		VALUES ('${k.kinutzung}', '${o}', '${z.meeting}', '${z.stweg}', 'traktandenpruefung', 'agenda_item',
		        '${z.traktandum}');
		INSERT INTO attachment (id, operator_id, stweg_id, subject_type, subject_id, checksum, original_name,
		                        content_type, size_bytes)
		VALUES ('${k.anhang}', '${o}', '${z.stweg}', 'meeting', '${z.meeting}', '${'9'.repeat(64)}',
		        'Eigene Unterlage.pdf', 'application/pdf', 10);
		INSERT INTO meeting_access (operator_id, meeting_id, snapshot_party_id, code_hash)
		VALUES ('${o}', '${z.meeting}', '${z.stand.vertreter}', '${pruefwertCode(k.zugangscode)}');
		COMMIT;
	`);
	k.verteiler = await skalar(`SELECT id FROM quota_kind WHERE stweg_id = '${z.stweg}' AND is_primary`);
	k.vollmacht = await skalar(`SELECT id FROM proxy WHERE meeting_id = '${z.meeting}'`);
	k.entwurfDatum = await skalar(`SELECT meeting_date::text FROM meeting WHERE id = '${k.entwurf}'`);
	k.heute = await skalar('SELECT current_date::text');
	/*
	 * **Für Auftrag 2c, was nichts anderes stört:** eine freigegebene
	 * Versammlung mit einem Gerät mit echtem Schlüssel (`abgeben` geht nur aus
	 * «freigegeben» und verschlüsselt für das Gerät; der Schlüssel `P…` des
	 * Feldteils ist keiner), und eine KI-Nutzung am Entwurf (`kifolgen` bindet
	 * die Nutzung an die Versammlung der Adresse). Was andere Wege verstellte
	 * (ein zweites Traktandum, eine Mitgliedsgemeinschaft), legt erst der
	 * Zustand an (`kreuzZustaende`).
	 */
	k.freigegeben = randomUUID();
	k.geraet = randomUUID();
	k.kinutzungEntwurf = randomUUID();
	a.kreuzGeraet = k.geraet;
	const enc = generateKeyPairSync('x25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
	const sig = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
	await sql(`
		BEGIN;
		INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode,
		                     released_at)
		VALUES ('${k.freigegeben}', '${o}', '${z.stweg}', 'freigegeben', current_date + 10, '19:00',
		        'Kreuzfreigabe ${A_ZEICHEN}', 'ordentlich', 'gefuehrt', now());
		INSERT INTO handover_device (id, operator_id, name, enc_public_key, sig_public_key, fingerprint)
		VALUES ('${k.geraet}', '${o}', 'E2E Kreuzgerät ${A_ZEICHEN}', '${enc}', '${sig}', '${sha256(`${enc}.${sig}`)}');
		-- Das Geschäft von A trägt das Traktandum der laufenden Versammlung, wie
		-- am Abend; ohne sagten die Geschäftswege «Zu diesem Punkt gibt es in
		-- keiner Gemeinschaft ein Traktandum» (Lauf vom 28.10.2026).
		UPDATE agenda_item SET business_id = '${k.geschaeft}', business_position = 1 WHERE id = '${z.traktandum}';
		INSERT INTO ai_usage (id, operator_id, meeting_id, stweg_id, feature, subject_type, subject_id)
		VALUES ('${k.kinutzungEntwurf}', '${o}', '${k.entwurf}', '${z.stweg}', 'traktandenpruefung', 'agenda_item',
		        '${k.entwurfTraktandum}');
		COMMIT;
	`);
	return k;
}

/**
 * Die Zustände von A für Auftrag 2c: je Name die Werte, die die Grundlage
 * eines Versuchs ersetzen (`zustand` im Urteil, `kreuzversuch`), und was der
 * Lauf an der Datenbank dafür vorbereitet und danach zurücksetzt.
 *
 * **Über `sql()`, nicht über die Anwendung**, wo die Anwendung den Zustand
 * nicht oder nur mit Nebenwirkung herstellt: einen Durchgang mit Erfordernis
 * öffnet nur die Leitung, und die Leitung sagt bei offenem Durchgang ab; ein
 * geschlossener Beschluss in einem Haus verlangte eine ganze Versammlung samt
 * Abstimmung. Vorbereitet wird je Gruppe unmittelbar vor ihren Versuchen,
 * zurückgesetzt unmittelbar danach; was liegen bleibt (ein Traktandum, ein
 * Haus), hängt an der Gemeinschaft oder Versammlung der Zugangslage und geht
 * mit `aEntfernen`.
 */
function kreuzZustaende(a, ka) {
	const o = a.operator;
	const z = a.zugang;
	const t2 = randomUUID();
	const haus = {
		stweg: randomUUID(),
		partei: randomUUID(),
		meeting: randomUUID(),
		traktandum: randomUUID(),
		durchgang: randomUUID()
	};
	let gespeichert = null;
	let durchgangZeile = null;
	const werte = {
		ohneAbstimmung: { traktandum: t2 },
		ki: {},
		kiEntwurf: { kinutzung: ka.kinutzungEntwurf },
		veto: {},
		universal: {},
		ohneDurchgang: {},
		freigegeben: { versammlung: ka.freigegeben, geraet: ka.geraet },
		haus: {
			partei: haus.partei,
			durchgang: haus.durchgang,
			'versammlung|durchgang': `${haus.meeting}|${haus.durchgang}`
		}
	};
	/*
	 * **Widerspruch geht nur an einem Geschäft, das als Universalversammlung
	 * aufgenommen ist** (Auslöser `widerspruch_zulaessig`, Migration 129), und
	 * das ist ein spontanes, neues Traktandum. Für die beiden Gruppen trägt T1
	 * diese Spalten; danach kommen sie aus der gesicherten Zeile zurück.
	 */
	let t1Zeile = null;
	const t1Universal = async () => {
		t1Zeile = await skalar(
			`SELECT json_build_object('s', is_spontaneous, 'k', spontaneous_kind, 'u', unannounced_basis, ` +
				`'z', added_during_meeting_at)::text ` +
				`FROM agenda_item WHERE id = '${z.traktandum}'`
		);
		return `UPDATE agenda_item SET is_spontaneous = true, spontaneous_kind = 'neu', unannounced_basis = 'universal',
		                added_during_meeting_at = coalesce(added_during_meeting_at, now())
		         WHERE id = '${z.traktandum}';`;
	};
	const t1Zurueck = () => `UPDATE agenda_item t SET is_spontaneous = (j->>'s')::boolean, spontaneous_kind = j->>'k',
	                                unannounced_basis = j->>'u', added_during_meeting_at = (j->>'z')::timestamptz
	                           FROM (SELECT '${t1Zeile.replaceAll("'", "''")}'::json AS j) x
	                          WHERE t.id = '${z.traktandum}';`;
	const schritte = {
		// Ein zweites Traktandum ohne Durchgang, mit Betroffenen (Form
		// `im_saal_oder_vorab`), und die Partei `stimme` als betroffen.
		ohneAbstimmung: {
			vorbereiten: () =>
				sql(`
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind,
					                         motion_text, body, requirement_needs_affected_consent, requirement_node)
					VALUES ('${t2}', '${o}', '${z.meeting}', 2, 'E2E Kreuz ohne Abstimmung ${A_ZEICHEN}', 'abstimmung',
					        'gemeinschaft', 'Eigener Antragstext.', 'Eigener Antragstext.', true, 'k-nutzungsrecht-zuteilung')
					ON CONFLICT (id) DO NOTHING;
					INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id, eingetragen_durch)
					VALUES ('${t2}', '${z.partei.stimme}', '${o}', '${z.stweg}', 'Prüflauf')
					ON CONFLICT DO NOTHING;
				`),
			zuruecksetzen: async () => {}
		},
		// KI zugelassen nur für diese Gruppe: Die Stufen von A sind auf Dev
		// externe Dienste. `kiantrag` fragt erst bei einem Traktandum mit
		// Elternteil (`antragspruefung.ts`); das sichert die Abfrage hier.
		ki: {
			vorbereiten: async () => {
				const mitEltern = await skalar(
					`SELECT count(*) FROM agenda_item WHERE meeting_id = '${z.meeting}' AND parent_id IS NOT NULL`
				);
				behaupte(mitEltern === '0', `KI nicht zugelassen: ${mitEltern} Traktanden mit Elternteil riefen das Modell`);
				await sql(`UPDATE stweg SET ai_enabled = true WHERE id = '${z.stweg}';`);
			},
			zuruecksetzen: () => sql(`UPDATE stweg SET ai_enabled = false WHERE id = '${z.stweg}';`)
		},
		kiEntwurf: { vorbereiten: async () => {}, zuruecksetzen: async () => {} },
		freigegeben: { vorbereiten: async () => {}, zuruecksetzen: async () => {} },
		// Ein Erfordernis mit Zustimmung Betroffener am offenen Durchgang,
		// abgeschrieben von einem echten Durchgang; `stimme` betroffen und im
		// Ausstand, wie es das Veto verlangt (`veto.ts`).
		veto: {
			vorbereiten: async () => {
				const vorlagen = await skalar(
					`SELECT count(*) FROM voting_round WHERE operator_id = '${o}' ` +
						`AND requirement_json->>'betroffenenzustimmung' = 'im_saal_oder_vorab'`
				);
				behaupte(vorlagen !== '0', 'Kein Durchgang von A mit Zustimmung im Saal zum Abschreiben');
				gespeichert = await skalar(
					`SELECT coalesce(requirement_json::text, 'NULL') FROM voting_round WHERE id = '${z.durchgang}'`
				);
				await sql(`
					BEGIN;
					UPDATE voting_round SET requirement_json = (
					  SELECT requirement_json FROM voting_round
					   WHERE operator_id = '${o}' AND requirement_json->>'betroffenenzustimmung' = 'im_saal_oder_vorab'
					   ORDER BY opened_at DESC LIMIT 1)
					 WHERE id = '${z.durchgang}';
					INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id, eingetragen_durch)
					VALUES ('${z.traktandum}', '${z.partei.stimme}', '${o}', '${z.stweg}', 'Prüflauf');
					INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id, grund, erklaert_durch)
					VALUES ('${randomUUID()}', '${o}', '${z.meeting}', '${z.traktandum}', '${z.partei.stimme}',
					        'Kreuzveto ${A_ZEICHEN}', 'Prüflauf');
					COMMIT;
				`);
			},
			zuruecksetzen: () =>
				sql(`
					BEGIN;
					SET LOCAL session_replication_role = replica;
					UPDATE voting_round SET requirement_json = ${gespeichert === 'NULL' ? 'NULL' : `'${gespeichert.replaceAll("'", "''")}'::jsonb`}
					 WHERE id = '${z.durchgang}';
					DELETE FROM veto WHERE round_id = '${z.durchgang}';
					DELETE FROM agenda_item_affected WHERE agenda_item_id = '${z.traktandum}' AND party_id = '${z.partei.stimme}';
					DELETE FROM recusal WHERE agenda_item_id = '${z.traktandum}' AND party_id = '${z.partei.stimme}';
					COMMIT;
				`)
		},
		// Widersprechen geht an einem bestätigten Universalmodus.
		universal: {
			vorbereiten: async () =>
				sql(`
					BEGIN;
					${await t1Universal()}
					UPDATE voting_round SET universal_mode = 'persoenlich', universal_confirmed_at = now(),
					       universal_confirmed_by = 'Prüflauf' WHERE id = '${z.durchgang}';
					COMMIT;
				`),
			zuruecksetzen: () =>
				sql(`
					BEGIN;
					SET LOCAL session_replication_role = replica;
					DELETE FROM universal_objection WHERE meeting_id = '${z.meeting}';
					UPDATE voting_round SET universal_mode = NULL, universal_confirmed_at = NULL,
					       universal_confirmed_by = NULL WHERE id = '${z.durchgang}';
					${t1Zurueck()}
					COMMIT;
				`)
		},
		// Einem Traktandum widersprechen geht nur ohne offenen Durchgang an der
		// ganzen Versammlung: Der Durchgang geht für diese Gruppe hinaus und
		// kommt danach unverändert zurück (Zeile als JSON gehalten).
		ohneDurchgang: {
			vorbereiten: async () => {
				durchgangZeile = await skalar(`SELECT row_to_json(v)::text FROM voting_round v WHERE id = '${z.durchgang}'`);
				await sql(`
					BEGIN;
					SET LOCAL session_replication_role = replica;
					DELETE FROM voting_round WHERE id = '${z.durchgang}';
					${await t1Universal()}
					COMMIT;
				`);
			},
			zuruecksetzen: () =>
				sql(`
					BEGIN;
					SET LOCAL session_replication_role = replica;
					INSERT INTO voting_round
					SELECT * FROM json_populate_record(NULL::voting_round, '${durchgangZeile.replaceAll("'", "''")}'::json);
					DELETE FROM universal_objection WHERE meeting_id = '${z.meeting}';
					${t1Zurueck()}
					COMMIT;
				`)
		},
		// Ein Haus: eine Mitgliedsgemeinschaft von A mit einer Versammlung und
		// einem geschlossenen, veröffentlichten Beschluss. Wieder weg nach der
		// Gruppe: Eine Gemeinschaft mit Haus verlangt beim Speichern der Angaben
		// eine Trägerschaft. Gemeinschaft und Versammlung des Hauses bleiben bis
		// `aEntfernen`, das sie am Zeichen erkennt; die Gegenhälfte legt das Haus
		// deshalb ein zweites Mal an, ohne Doppel.
		haus: {
			vorbereiten: () =>
				sql(`
					BEGIN;
					INSERT INTO stweg (id, operator_id, name) VALUES ('${haus.stweg}', '${o}', 'E2E Kreuzhaus ${A_ZEICHEN}')
					ON CONFLICT (id) DO NOTHING;
					INSERT INTO party (id, stweg_id, operator_id, display_name, kind, member_stweg_id, representative_name)
					VALUES ('${haus.partei}', '${z.stweg}', '${o}', 'E2E Kreuzhaus ${A_ZEICHEN}', 'gemeinschaft', '${haus.stweg}',
					        'E2E Vertretung');
					INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location, kind, operation_mode)
					VALUES ('${haus.meeting}', '${o}', '${haus.stweg}', 'entwurf', current_date, '19:00', 'Kreuzhaus ${A_ZEICHEN}',
					        'ordentlich', 'gefuehrt')
					ON CONFLICT (id) DO NOTHING;
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind, motion_text, body)
					VALUES ('${haus.traktandum}', '${o}', '${haus.meeting}', 1, 'E2E Kreuzhausbeschluss ${A_ZEICHEN}', 'abstimmung',
					        'gemeinschaft', 'Eigener Antragstext.', 'Eigener Antragstext.')
					ON CONFLICT (id) DO NOTHING;
					INSERT INTO voting_round (id, operator_id, meeting_id, agenda_item_id, ordinal, state, closed_at,
					                          requirement_json, attendance_json, result_published_at, result_json)
					VALUES ('${haus.durchgang}', '${o}', '${haus.meeting}', '${haus.traktandum}', 1, 'geschlossen', now(),
					        '{}', '{}', now(),
					        '{"format":1,"auszaehlung":{"angenommen":true,"koepfe":{},"quoten":{},"betroffene":{}}}')
					ON CONFLICT (id) DO NOTHING;
					COMMIT;
				`),
			zuruecksetzen: () =>
				sql(`
					BEGIN;
					SET LOCAL session_replication_role = replica;
					DELETE FROM instruction WHERE party_id = '${haus.partei}' OR source_voting_round_id = '${haus.durchgang}';
					DELETE FROM party WHERE id = '${haus.partei}';
					COMMIT;
				`)
		}
	};
	return { werte, schritte, haus, t2 };
}

/**
 * Die Kennungen je Art (`ARTEN` in `fremdbetreiber-kreuz.mjs`), für B und für
 * A. Unter B steht für jede Art eine Zeile, die es wirklich gibt; fehlt eine,
 * nennt `kreuzversuch` im Protokoll den Grund («B hat keine Zeile der Art …»).
 */
function kreuzKennungen(b, kb, a, ka) {
	const z = a.zugang;
	const B = {
		versammlung: b.meeting_id[2],
		entwurf: b.meeting_id[0],
		abend: b.meeting_day_id[0],
		gemeinschaft: b.stweg_id[0],
		person: b.person_id[0],
		partei: b.party_id[0],
		standPartei: b.stand_partei[0],
		einheit: b.unit_id[0],
		traktandum: b.agenda_item_id[0],
		durchgang: b.durchgang[0],
		vollmacht: kb.vollmacht,
		ausstand: kb.ausstand,
		geschaeft: kb.geschaeft,
		pendenz: kb.pendenz,
		ruege: kb.ruege,
		meldung: kb.meldung,
		mitglied: kb.mitglied,
		huelle: kb.huelle,
		vertretung: kb.vertretung,
		nutzniessung: kb.nutzniessung,
		regel: kb.regel,
		kinutzung: kb.kinutzung,
		verteiler: kb.verteiler,
		anhang: kb.anhang,
		geraet: b.geraet[0],
		zugangscode: kb.zugangscode
	};
	const A = {
		versammlung: z.meeting,
		entwurf: ka.entwurf,
		abend: z.tag,
		gemeinschaft: z.stweg,
		person: a.person,
		partei: z.partei.stimme,
		standPartei: z.stand.stimme,
		einheit: z.einheit.stimme,
		traktandum: z.traktandum,
		durchgang: z.durchgang,
		vollmacht: ka.vollmacht,
		ausstand: ka.ausstand,
		geschaeft: ka.geschaeft,
		pendenz: ka.pendenz,
		ruege: ka.ruege,
		meldung: ka.meldung,
		mitglied: ka.mitglied,
		huelle: ka.huelle,
		vertretung: ka.vertretung,
		nutzniessung: ka.nutzniessung,
		regel: ka.regel,
		kinutzung: ka.kinutzung,
		verteiler: ka.verteiler,
		anhang: ka.anhang,
		geraet: a.geraet,
		zugangscode: ka.zugangscode,
		// Für die Wege, die im Entwurf arbeiten: dieselben Arten an der
		// Versammlung im Entwurf.
		entwurfTraktandum: ka.entwurfTraktandum,
		// Für Auftrag 2c: Werte, die ein Speichern unverändert lassen soll, und
		// ein zweiter Eigentümer für einen gemeinsamen Antrag.
		entwurfDatum: ka.entwurfDatum,
		entwurfOrt: `Kreuzentwurf ${A_ZEICHEN}`,
		gemeinschaftName: `E2E Eigenzugang ${A_ZEICHEN}`,
		einheitName: `Eigen stimme ${A_ZEICHEN}`,
		partei2: z.partei.vertreter,
		heute: ka.heute
	};
	return { B, A };
}

/**
 * Der Abdruck vor und nach jedem Versuch, weiter als der der anderen Teile.
 *
 * Drei Blicke: die Prüfsummen über B samt Verlauf, der B nennt (wie
 * `fingerabdruecke`); die Gesamtzahl **jeder** Tabelle mit Betreiberspalte,
 * damit eine Zeile, die ein abgewiesener Versuch unter A anlegt, auffällt,
 * auch im Verlauf; und je Tabelle die Zeilen von A, die eine Kennung von B
 * tragen. Der dritte ist der Fall `agenda_item.proposer_stweg_id`: Ein
 * einfacher Fremdschlüssel auf `stweg(id)` nimmt eine fremde Gemeinschaft an,
 * und die Zeile gehört A.
 */
async function kreuzAbdruck(b, aOperator, bKennungen, tabellen) {
	const muster = bKennungen.join('|');
	/*
	 * **Den Verlauf nur seit Beginn des Laufs.** Über alle 193 000 Einträge
	 * kostete der Regex je Abdruck 15 s (gemessen 28.10.2026), über die des
	 * Laufs 0,03 s. Gleichwertig, weil der Verlauf nur anfügbar ist und die
	 * Kennungen von B erst in diesem Lauf entstehen: Ein älterer Eintrag kann
	 * keine tragen. Für die übrigen Tabellen gilt das nicht, eine alte Zeile
	 * von A kann eine Kennung von B bekommen.
	 */
	const nurLauf = (t) => (t === 'audit_entry' ? ` AND x.occurred_at >= '${beginn}'` : '');
	const teile = tabellen.flatMap((t) => [
		`SELECT 'ALLE ${t}', count(*)::text, 'ohne' FROM ${t}`,
		`SELECT 'B_IN_A ${t}', count(*)::text, 'ohne' FROM ${t} x ` +
			`WHERE x.operator_id = '${aOperator}'${nurLauf(t)} AND x::text ~ '${muster}'`
	]);
	const weit = (await sql(`${teile.join('\n UNION ALL \n')};`)).map((z) => z.replaceAll('|', ':'));
	return [...(await fingerabdruecke(b, { seit: beginn })), ...weit].sort();
}

/** Was sich zwischen zwei Abdrücken geändert hat, je Zeile «Name a → b». */
function abdruckUnterschied(vorher, nachher) {
	const alt = new Map(vorher.map((z) => [z.split(':')[0], z.slice(z.indexOf(':') + 1)]));
	const neu = new Map(nachher.map((z) => [z.split(':')[0], z.slice(z.indexOf(':') + 1)]));
	const unterschiede = [];
	for (const name of new Set([...alt.keys(), ...neu.keys()])) {
		const x = alt.get(name);
		const y = neu.get(name);
		if (x === y) continue;
		const zahl = (w) => (w ?? '').split(':')[0];
		unterschiede.push(
			name.startsWith('ALLE ') || name.startsWith('B_IN_A ') || name.startsWith('GLOBAL ') || name.startsWith('ERWÄHNT ')
				? `${name} ${zahl(x)}→${zahl(y)}`
				: `${name} (B) ${zahl(x)}→${zahl(y)}${zahl(x) === zahl(y) ? ' Inhalt' : ''}`
		);
	}
	return unterschiede;
}

/**
 * Der Kreuzteil: je Weg unter einem Mandantenpfad und je Kennungsfeld ein
 * Versuch mit einer Kennung von B, die übrigen Felder mit Werten von A.
 */
async function kreuzlauf() {
	const wege = kreuzwegeErheben(WURZEL);
	const einordnung = kreuzEinordnen(wege);
	const mitFeld = einordnung.eingeordnet.filter((w) => w.versuche.length);
	await schritt('Wege unter Mandantenpfaden: jeder eingeordnet, jedes Kennungsfeld mit einer Art', async () => {
		for (const w of einordnung.eingeordnet) {
			if (!w.versuche.length && !process.argv.includes('--alle')) continue;
			console.log(
				`       ${w.schluessel.padEnd(70)} ` +
					(w.versuche.length
						? w.versuche.map((v) => `${v.feld}→${v.art}`).join(', ')
						: `ohne Kennungsfeld`)
			);
		}
		behaupte(
			einordnung.fehlend.length === 0 && einordnung.unbekannt.length === 0,
			[
				...einordnung.fehlend.map((f) => `ohne Urteil: ${f}`),
				...einordnung.unbekannt.map((f) => `nicht eingeordnet: ${f}`)
			].join('\n       ')
		);
		const versuche = mitFeld.reduce((n, w) => n + w.versuche.length, 0);
		return (
			`${einordnung.eingeordnet.length} Wege, davon ${mitFeld.length} mit Kennungsfeld ` +
			`(${versuche} Felder), ${einordnung.eingeordnet.length - mitFeld.length} ohne`
		);
	});
	if (NUR_LISTE) return;

	console.log('\nKreuzteil: Pfad von A, Kennung von B im Feld');
	let kb;
	let ka;
	await schritt('Zusätzlicher Bestand von B und A je Kennungsart', async () => {
		kb = await kreuzBestandB(b);
		ka = await kreuzBestandA(a);
		return `${Object.keys(kb).length} Gegenstände bei B, ${Object.keys(ka).length} bei A`;
	});
	const { B, A } = kreuzKennungen(b, kb, a, ka);
	const zustaende = kreuzZustaende(a, ka);
	A.zustaende = zustaende.werte;
	a.kreuzKennungen = [
		...Object.values(ka).filter((w) => /^[0-9a-f-]{36}$/.test(w)),
		zustaende.t2,
		...Object.values(zustaende.haus)
	];
	const keks = await anmelden();
	const tabellen = await sql(`
		SELECT c.table_name FROM information_schema.columns c
		  JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
		 WHERE c.table_schema = 'public' AND c.column_name = 'operator_id' ORDER BY 1
	`);
	const bKennungen = [...new Set([
		...Object.values(b).flat().filter((w) => /^[0-9a-f-]{36}$/.test(w)),
		...Object.values(kb).filter((w) => /^[0-9a-f-]{36}$/.test(w))
	])];
	const bZeichen = [B_ZEICHEN, ...b.siegelwert, ...b.saalmerkmal, ...b.anzeigecode];
	const protokoll = [];
	/*
	 * **Was den Zustand von A verbraucht, kommt zuletzt** (`zuletzt` im
	 * Urteil): Ein Versuch, der trotz fremder Kennung durchgeht, schlösse
	 * sonst etwa die Versammlung, und die folgenden mässen nur noch den
	 * Zustand.
	 */
	const reihe = mitFeld
		.flatMap((weg) => weg.versuche.map((v) => ({ weg, v })))
		.filter(({ weg, v }) => !KREUZ_NUR || KREUZ_NUR.test(`${weg.schluessel} [${v.feld}]`))
		.sort(
			(x, y) =>
				Number(Boolean(x.weg.zuletzt)) - Number(Boolean(y.weg.zuletzt)) ||
				(zustandVon(x.weg, x.v.feld) ?? '').localeCompare(zustandVon(y.weg, y.v.feld) ?? '')
		);
	let vorher = await kreuzAbdruck(b, a.operator, bKennungen, tabellen);

	/*
	 * **Je Zustand eine Gruppe** (sortiert oben): vorbereiten vor dem ersten
	 * Versuch, zurücksetzen nach dem letzten, und danach ein neuer Abdruck,
	 * damit die Vorbereitung nicht als Änderung des ersten Versuchs erscheint.
	 */
	let aktuell = null;
	async function wechsle(name) {
		if (name === aktuell) return;
		if (aktuell) await zustaende.schritte[aktuell].zuruecksetzen();
		aktuell = null;
		if (name) {
			await zustaende.schritte[name].vorbereiten();
			aktuell = name;
		}
		vorher = await kreuzAbdruck(b, a.operator, bKennungen, tabellen);
	}
	let letzteAntwort = null;
	let wiederholungen = 0;

	/** Schickt eine Anfrage und misst die Datenbank davor und danach. */
	async function fahren(weg, anfrage) {
		const senden = async () => {
			try {
				return await versuchen({
					ziel: ZIEL,
					keks,
					weg: { ...weg, aktion: weg.aktion ?? 'default', pfad: anfrage.pfad },
					versuch: anfrage.versuch,
					// `stweg` braucht `KOERPER_ABLAGE` für den Dateinamen.
					k: { ...B, stweg: B.gemeinschaft },
					basis: A,
					zeichen: MARKE,
					frist: FRIST_MS
				});
			} catch (unfall) {
				// Nur ein Fehler der Verbindung ist ein Ausgang; ein Fehler im
				// Skript bricht ab, statt als «keine Antwort» wiederholt zu werden.
				if (!unfall.cause?.code) throw unfall;
				return {
					status: 0,
					ort: null,
					netz: true,
					koerper: `Verbindung scheiterte: ${unfall.cause.code} ${unfall.cause.message}`
				};
			}
		};
		/*
		 * **Einmal wiederholen, wenn keine Antwort kam**, als Netz. Bis 28.10.2026
		 * hielt der Abdruck über `execFileSync` die Ereignisschleife 20 bis 40 s
		 * an; der Server schliesst die ruhende Verbindung nach 5 s
		 * (`Keep-Alive: timeout=5`), und undici schickte die nächste Anfrage noch
		 * darüber: «UND_ERR_SOCKET other side closed», im Nachlauf 49 von 98
		 * Versuchen. Seit `sql()` asynchron läuft, soll die Wiederholung nie
		 * nötig sein; ihre Zahl steht am Ende des Laufs und je Versuch im
		 * Protokoll (`erster`). **Nur nach einem Fehler der Verbindung**: Nach
		 * einer Zeitüberschreitung kann der Server geschrieben haben, und eine
		 * Antwort beim zweiten Mal verdeckte, dass er beim ersten hing
		 * (Codeprüfung 27.10.2026).
		 */
		const pause = letzteAntwort ? Date.now() - letzteAntwort : null;
		const beginn = Date.now();
		let antwort = await senden();
		const erster = antwort.netz ? antwort.koerper : null;
		if (erster) {
			wiederholungen += 1;
			antwort = await senden();
		}
		const dauer = Date.now() - beginn;
		letzteAntwort = Date.now();
		// Was nach der Antwort noch schreibt (Nummern, Ströme), gehört zu
		// diesem Versuch, nicht zum nächsten.
		await new Promise((fertig) => setTimeout(fertig, KREUZ_RUHE_MS));
		const nachher = await kreuzAbdruck(b, a.operator, bKennungen, tabellen);
		const aenderung = abdruckUnterschied(vorher, nachher);
		vorher = nachher;
		const inhaltB = bZeichen.find((z) => antwort.koerper.includes(z));
		const ortB = antwort.ort && bKennungen.some((id) => antwort.ort.includes(id));
		const befund = [];
		if (antwort.status === 0) befund.push('keine Antwort');
		if (antwort.status >= 500) befund.push(`HTTP ${antwort.status}`);
		if (inhaltB) befund.push(`Inhalt von B («${inhaltB.slice(0, 16)}»)`);
		if (ortB) befund.push(`Weiterleitung auf B: ${antwort.ort}`);
		// Gesamtzahlen stehen im Protokoll und werden von Hand eingeordnet;
		// rot ist, was B berührt oder B in eine Zeile von A trägt.
		for (const u of aenderung) {
			if (/^(B_IN_A|ERWÄHNT) /.test(u) || u.includes('(B)')) befund.push(u);
		}
		return {
			status: antwort.status,
			ort: antwort.ort,
			satz: kreuzsatz(antwort),
			merkmal: kreuzmerkmal(antwort),
			pause,
			dauer,
			erster,
			inhaltB: Boolean(inhaltB),
			fuenfhundert: antwort.status >= 500,
			aenderung,
			befund
		};
	}

	const zeileVon = (weg, v, seite, r) =>
		`${weg.schluessel} [${v.feld}→${v.art}${seite === 'A' ? ', Kennung von A' : ''}] → HTTP ${r.status}` +
		`${r.ort ? ` ${r.ort}` : ''}: ${r.satz}` +
		(r.erster ? ` (zuerst: ${r.erster})` : '') +
		(r.aenderung.length ? `\n         Datenbank: ${r.aenderung.join(', ')}` : '');

	await schritt(
		'Jedes Kennungsfeld unter einem Pfad von A mit einer Kennung von B',
		async () => {
			const rot = [];
			try {
				for (const { weg, v } of reihe) {
					await wechsle(zustandVon(weg, v.feld));
					const anfrage = kreuzversuch(weg, v, B, A);
					const eintrag = {
						weg: weg.schluessel,
						feld: v.feld,
						art: v.art,
						tabelle: ARTEN[v.art]?.tabelle ?? '',
						zustand: zustandVon(weg, v.feld),
						pfad: anfrage.pfad
					};
					if (anfrage.ohne) {
						protokoll.push({
							...eintrag,
							gefuellt: false,
							grund: anfrage.ohne
						});
						console.log(`       – ${weg.schluessel} [${v.feld}] nicht gefüllt: ${anfrage.ohne}`);
						continue;
					}
					const r = await fahren(weg, anfrage);
					protokoll.push({ ...eintrag, gefuellt: true, ...r });
					const zeile = zeileVon(weg, v, 'B', r);
					if (r.befund.length) rot.push(`${zeile}\n         Befund: ${r.befund.join('; ')}`);
					else console.log(`       · ${zeile}`);
				}
			} finally {
				await wechsle(null);
			}
			// Schon hier, nicht erst nach der Gegenhälfte: Bricht sie ab, bliebe
			// sonst vom Durchgang mit B nichts (Codeprüfung 28.10.2026).
			if (process.env.KREUZ_PROTOKOLL) {
				writeFileSync(process.env.KREUZ_PROTOKOLL, JSON.stringify(protokoll, null, '\t'));
			}
			const gefuellt = protokoll.filter((p) => p.gefuellt);
			const zahl = (f) => gefuellt.filter(f).length;
			console.log(
				`\n       ${protokoll.length} Felder, ${gefuellt.length} gefüllt; ` +
					`403/404 ${zahl((p) => p.status === 403 || p.status === 404)}, ` +
					`400 ${zahl((p) => p.status === 400)}, 2xx ${zahl((p) => p.status >= 200 && p.status < 300)}, ` +
					`3xx ${zahl((p) => p.status >= 300 && p.status < 400)}, 5xx ${zahl((p) => p.fuenfhundert)}, ` +
					`mit Datenbankänderung ${zahl((p) => p.aenderung.length)}`
			);
			behaupte(rot.length === 0, `${rot.length} Versuche mit Befund:\n       ${rot.join('\n       ')}`);
			return `${gefuellt.length} Versuche ohne Befund`;
		},
		{ weiter: true }
	);

	await schritt(
		'Die Gegenhälfte: dasselbe Feld mit einer Kennung von A',
		async () => {
			/*
			 * **Nach dem ganzen Durchgang mit B, nicht je Versuch.** Mit Kennungen
			 * von A gehen Aktionen durch, die den Zustand von A verbrauchen
			 * (archivieren, entfernen, schliessen); je Versuch dazwischen gefahren,
			 * mässe der nächste Versuch mit B einen anderen Zustand als in
			 * Auftrag 2. **Gleiche Anfragen nur einmal:** Mehrere Kennungsfelder
			 * desselben Wegs ergeben mit lauter Kennungen von A dasselbe Formular;
			 * zweimal geschickt, legte etwa `anlegen` zwei Zeilen an, und das
			 * zweite Ergebnis mässe den ersten Versuch. Das eine Ergebnis gilt
			 * dann für jedes dieser Felder (`gleichWie` im Protokoll).
			 */
			const rot = [];
			const gefahren = new Map();
			// Was entfernt oder löst, nach allem anderen (`spaetrang`); stabil
			// sortiert, die Gruppen der Zustände bleiben beisammen.
			const reiheA = reihe
				.map((r, i) => ({ ...r, i }))
				.sort((x, y) => spaetrang(x.weg) - spaetrang(y.weg) || x.i - y.i);
			try {
				for (const { weg, v } of reiheA) {
					const eintrag = protokoll.find((p) => p.weg === weg.schluessel && p.feld === v.feld);
					if (!eintrag?.gefuellt) continue;
					// Was die Gegenhälfte nicht schickt, mit Grund im Urteil (`ohneGegen`).
					if (weg.urteil.ohneGegen) {
						eintrag.gegen = { gefuellt: false, grund: weg.urteil.ohneGegen };
						continue;
					}
					await wechsle(zustandVon(weg, v.feld));
					const anfrage = kreuzversuch(weg, v, B, A, { seite: 'A' });
					if (anfrage.ohne) {
						eintrag.gegen = { gefuellt: false, grund: anfrage.ohne };
						continue;
					}
					const v2 = anfrage.versuch;
					const daten = v2.formular?.() ?? v2.abfrage?.() ?? v2.daten?.() ?? [];
					const schluessel = `${weg.methode} ${anfrage.pfad}?/${weg.aktion} ${JSON.stringify(daten)}`;
					const frueher = gefahren.get(schluessel);
					if (frueher) {
						eintrag.gegen = {
							gefuellt: true,
							...frueher.r,
							gleichWie: frueher.feld
						};
						continue;
					}
					const r = await fahren(weg, anfrage);
					gefahren.set(schluessel, { r, feld: v.feld });
					eintrag.gegen = { gefuellt: true, ...r };
					const zeile = zeileVon(weg, v, 'A', r);
					if (r.befund.length) rot.push(`${zeile}\n         Befund: ${r.befund.join('; ')}`);
					else console.log(`       · ${zeile}`);
				}
			} finally {
				await wechsle(null);
			}
			for (const p of protokoll) p.ausgang = kreuzgegenhaelfte(p, p.gegen);
			if (process.env.KREUZ_PROTOKOLL) {
				writeFileSync(process.env.KREUZ_PROTOKOLL, JSON.stringify(protokoll, null, '\t'));
			}
			const je = new Map();
			for (const p of protokoll) je.set(p.ausgang, (je.get(p.ausgang) ?? 0) + 1);
			console.log(
				`\n       Gegenhälfte: ${gefahren.size} Anfragen für ${protokoll.filter((p) => p.gegen?.gefuellt).length} Felder; ` +
					[...je].map(([name, n]) => `${name} ${n}`).join(', ') +
					`\n       Wiederholungen nach Verbindungsfehler im ganzen Kreuzlauf: ${wiederholungen}`
			);
			behaupte(rot.length === 0, `${rot.length} Versuche mit Befund:\n       ${rot.join('\n       ')}`);
			return `${gefahren.size} Anfragen ohne Befund, Wiederholungen ${wiederholungen}`;
		},
		{ weiter: true }
	);
}

// ── Der Lauf ────────────────────────────────────────────────────────────────

let b = null;
let a = null;
let beginn = null;

async function main() {
	console.log(`\nFremdbetreiber über die Routen — ${ZIEL}\n`);
	console.log('Aufbau');

	/*
	 * **Der Trockenlauf legt nichts an.** `--liste` braucht nur die Kennungen,
	 * um Parametersegmente zu füllen; die Routenliste entsteht auch so. Der
	 * erste Trockenlauf dieses Durchstichs legte B sehr wohl an und liess es
	 * liegen, ein Prüfskript, das Spuren hinterlässt, wenn man nur nachsehen
	 * will, ist eine Falle.
	 */
	b = betreiberBWerte();
	if (!NUR_LISTE) {
		await schritt('Das Ziel ist der gebaute Stand, nicht der Entwicklungsserver', async () => {
			/*
			 * Am Entwicklungsserver wäre der Lauf aus zwei Gründen wertlos: Der
			 * Schutz gegen fremde Formulare ist dort aus, und eine Absage hiesse
			 * nichts über `node build`. Das Merkmal ist Vites Client, den nur der
			 * Entwicklungsserver ausliefert.
			 */
			// Ohne `manual` folgte der Abruf am gebauten Stand der 303 zur
			// Anmeldung und läse dort 200.
			const r = await fetch(`${ZIEL}/@vite/client`, {
				redirect: 'manual',
				signal: AbortSignal.timeout(FRIST_MS)
			});
			behaupte(
				r.status !== 200,
				`${ZIEL} ist vite dev. Den gebauten Stand auf 3101 starten, siehe Kopf dieses Skripts.`
			);
			return `/@vite/client ${r.status}`;
		});
		beginn = await skalar('SELECT now()');
		await schritt('Betreiber B mit kleinem Bestand anlegen', async () => {
			await betreiberBEinfuegen(b);
			const anzahl = await skalar(`SELECT count(*) FROM meeting WHERE operator_id = '${b.operator_id[0]}'`);
			behaupte(anzahl === '3', `Versammlungen von B nicht angelegt (${anzahl})`);
			return `Versammlung ${b.meeting_id[0].slice(0, 8)}, Gemeinschaft ${b.stweg_id[0].slice(0, 8)}`;
		});
		await schritt('Prüfgegenstände von A für die Gegenhälfte des Feldteils anlegen', async () => {
			a = await pruefgegenstaendeA(await skalar(`SELECT operator_id FROM app_user WHERE username = '${BENUTZER}'`));
			return `Gemeinschaft ${a.stweg[0].slice(0, 8)}, Konto ${a.konto.slice(0, 8)}`;
		});
		await schritt('Laufende Versammlung von A für die offenen Pfade anlegen', async () => {
			a.zugang = await zugangslageA(a.operator);
			return `Versammlung ${a.zugang.meeting.slice(0, 8)}, Durchgang ${a.zugang.durchgang.slice(0, 8)}`;
		});
	}

	if (KREUZ) {
		await kreuzlauf();
		return;
	}

	const { eintraege: liste, ausgelassen, ohneKennung, offeneWege } = routenliste(b);
	await schritt('Routenliste aus src/routes erzeugen', async () => {
		const lesewege = liste.filter((e) => e.methode === 'GET').length;
		const schreibwege = liste.length - lesewege;
		behaupte(liste.length > 40, `Nur ${liste.length} Einträge, der Baum ist grösser`);
		for (const [grund, anzahl] of ausgelassen) console.log(`       ausgelassen ${anzahl}×: ${grund}`);
		return `${liste.length} Einträge (${lesewege} Lese-, ${schreibwege} Schreibwege)`;
	});

	const felder = wegeEinordnen(WURZEL, ohneKennung);
	const feldwege = felder.eingeordnet.filter((w) => w.urteil.versuche?.length);
	await schritt('Wege ohne Kennung in der Adresse: jeder eingeordnet, jedes Kennungsfeld geprüft', async () => {
		/*
		 * **Zählt auf, schweigt nicht**, wie beim Pfad: je Weg das Urteil, und
		 * bei «ohne» der Grund. Wer hier eine Zeile vermisst, hat einen Weg,
		 * den niemand eingeordnet hat, und der Schritt ist rot.
		 */
		for (const w of felder.eingeordnet) {
			const kennungsfelder = (w.urteil.versuche ?? []).map((v) => v.feld);
			console.log(
				`       ${w.schluessel.padEnd(44)} ` +
					(kennungsfelder.length
						? `prüft ${[...new Set(kennungsfelder)].join(', ')}`
						: `ohne Kennungsfeld: ${w.urteil.ohne}`)
			);
		}
		behaupte(
			felder.fehlend.length === 0 && felder.unbekannt.length === 0,
			[
				...felder.fehlend.map((f) => `ohne Urteil: ${f}`),
				...felder.unbekannt.map((f) => `nicht eingeordnet: ${f}`)
			].join('\n       ')
		);
		const versuche = feldwege.reduce((n, w) => n + w.urteil.versuche.length, 0);
		return (
			`${felder.eingeordnet.length} Wege, davon ${feldwege.length} mit Kennungsfeld ` +
			`(${versuche} Felder), ${felder.eingeordnet.length - feldwege.length} ohne`
		);
	});

	const offene = wegeEinordnen(WURZEL, offeneWege, OFFENE_WEGE, { endpunkte: true });
	const offeneFeldwege = offene.eingeordnet.filter((w) => w.urteil.versuche?.length);
	await schritt('Offene Pfade: jeder Weg eingeordnet, jedes Kennungsfeld geprüft', async () => {
		/*
		 * Wie beim Feldteil, mit einem Unterschied: Hier liegen auch Endpunkte
		 * (`/z/strom`, `/p/strom`, die Rückkehr von Authentik). Ihre Felder liest
		 * die ganze Datei, und ihre Ströme prüft ein eigener Schritt unten.
		 */
		for (const w of offene.eingeordnet) {
			const kennungsfelder = (w.urteil.versuche ?? []).map((v) => v.feld);
			console.log(
				`       ${w.schluessel.padEnd(44)} ` +
					(kennungsfelder.length
						? `prüft ${[...new Set(kennungsfelder)].join(', ')}`
						: `ohne Kennungsfeld: ${w.urteil.ohne}`)
			);
		}
		behaupte(
			offene.fehlend.length === 0 && offene.unbekannt.length === 0,
			[
				...offene.fehlend.map((f) => `ohne Urteil: ${f}`),
				...offene.unbekannt.map((f) => `nicht eingeordnet: ${f}`)
			].join('\n       ')
		);
		const versuche = offeneFeldwege.reduce((n, w) => n + w.urteil.versuche.length, 0);
		return (
			`${offene.eingeordnet.length} Wege, davon ${offeneFeldwege.length} mit Kennungsfeld ` +
			`(${versuche} Versuche), ${offene.eingeordnet.length - offeneFeldwege.length} ohne`
		);
	});

	if (NUR_LISTE) {
		for (const e of liste) {
			console.log(`    ${e.methode.padEnd(4)} ${e.pfad}${e.aktion ? `?/${e.aktion}` : ''}`);
		}
		return;
	}

	console.log('\nBetreiber A');

	let keks;
	await schritt('Als A anmelden', async () => {
		keks = await anmelden();
		return `als ${BENUTZER}`;
	});

	const aVersammlung = await schritt('Eine eigene Versammlung von A wählen', async () => {
		const id = await skalar(`
			SELECT id FROM meeting
			 WHERE operator_id = (SELECT operator_id FROM app_user WHERE username = '${BENUTZER}')
			 ORDER BY created_at ASC, id ASC LIMIT 1
		`);
		behaupte(id, 'Keine eigene Versammlung gefunden');
		return id;
	});

	await schritt('Die Gegenhälfte: eigene Daten gehen durch', async () => {
		/*
		 * Ohne diesen Schritt wäre der Durchstich auch dann grün, wenn die
		 * Sitzung nicht trägt und alles mit Absage beantwortet wird.
		 */
		const proben = [
			`/versammlungen/${aVersammlung}`,
			`/versammlungen/${aVersammlung}/vollmachten`,
			'/verlauf'
		];
		const ergebnisse = [];
		for (const pfad of proben) {
			const r = await aufruf('GET', pfad, keks);
			ergebnisse.push(`${pfad}: ${r.status}`);
			behaupte(
				r.status === 200,
				`Eigene Seite ${pfad} antwortet ${r.status}, die Sitzung trägt nicht, dann ` +
					'sagt der Durchstich nichts über fremde Daten.'
			);
		}
		return ergebnisse.join(' · ');
	});

	const zugaenge = {};
	await schritt('Gültige Codes von A holen und einlösen, wie im Saal', async () => {
		/*
		 * **Über die Anwendung, nicht in der Datenbank.** Die Leitung gibt je
		 * Partei einen Ausgabecode aus (`codeAusgeben`, wie `strom-widerruf.mjs`),
		 * das Telefon löst ihn über `/z?/einloesen` ein. Ein Keks aus der
		 * Datenbank bewiese nur, dass die Datenbank ihn kennt.
		 */
		const z = a.zugang;
		for (const rolle of ['stimme', 'erklaeren', 'erklaeren2', 'weisen']) {
			const ausgabe = await fetch(`${ZIEL}/versammlungen/${z.meeting}/anwesenheit?/codeAusgeben`, {
				method: 'POST',
				redirect: 'manual',
				headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, cookie: keks },
				body: new URLSearchParams({ partei: z.stand[rolle] }).toString(),
				signal: AbortSignal.timeout(FRIST_MS)
			});
			/*
			 * **Nicht an Wortzeichen oder Bindestrich angrenzend.** Die Seite trägt
			 * vor dem Code die Kennung der Versammlung im Pfad, und eine UUID hat in
			 * rund jedem elften Fall ein Fenster aus Ziffern in genau dieser Form
			 * (Codeprüfung 27.10.2026, an 200 000 Kennungen gezählt).
			 */
			const code = (await ausgabe.text()).match(/(?<![\w-])[A-Z0-9]{4}-[A-Z0-9]{4}(?![\w-])/)?.[0];
			behaupte(code, `Kein Ausgabecode für «${rolle}» (HTTP ${ausgabe.status})`);
			const einloesung = await fetch(`${ZIEL}/z?/einloesen`, {
				method: 'POST',
				redirect: 'manual',
				headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL },
				body: new URLSearchParams({ code }).toString(),
				signal: AbortSignal.timeout(FRIST_MS)
			});
			zugaenge[rolle] = keksAus(einloesung, 'versammlung_zugang');
			behaupte(zugaenge[rolle], `Code für «${rolle}» nicht eingelöst (HTTP ${einloesung.status})`);
		}
		const anzeige = await fetch(`${ZIEL}/versammlungen/${z.meeting}?/anzeigecode`, {
			method: 'POST',
			redirect: 'manual',
			headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, cookie: keks },
			body: '',
			signal: AbortSignal.timeout(FRIST_MS)
		});
		const code = (await anzeige.text()).match(/(?<![\w-])[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}(?![\w-])/)?.[0];
		behaupte(code, `Kein Anzeigecode (HTTP ${anzeige.status})`);
		zugaenge.leinwand = await leinwandKeks(code);
		// Die Leinwand von B, mit ihrem Code aus dem Aufbau: der Gegenstrom.
		zugaenge.leinwandB = await leinwandKeks(b.anzeigecode[0]);
		return `${Object.keys(zugaenge).length} Zugänge (vier Telefone, zwei Leinwände)`;
	});

	// ── Feldteil: fremde Kennung in Abfrage oder Formularfeld ─────────────
	/*
	 * **Vor dem Pfadteil, mit Absicht.** Schreibt eine Aktion des Pfadteils
	 * unter A einen Verlaufseintrag über B, zeigte der Verlauf mit Filter auf B
	 * danach diesen Eintrag, und der Feldteil würde an einem Befund des
	 * Pfadteils rot. Der Abdruck zwischen den Teilen ordnet jede Änderung
	 * ihrem Teil zu.
	 */
	console.log('\nFeldteil: Kennungen von B in Abfrage und Formular');

	const vorher = await fingerabdruecke(b);

	// Was in keiner Antwort an A stehen darf: das Zeichen in den Namen von B,
	// sein Siegelwert und die Geheimnisse seiner offenen Zugänge.
	const bZeichen = [B_ZEICHEN, ...b.siegelwert, ...b.saalmerkmal, ...b.anzeigecode];
	const bKennungen = Object.values(b).flat().filter((w) => /^[0-9a-f-]{36}$/.test(w));
	const kB = kennungenB(b);
	const kA = kennungenA(a);
	const vergleich = { bZeichen, bKennungen, kB, kA };

	await schritt(
		'Jedes Kennungsfeld mit einer Kennung von B: Absage ohne Daten von B, nie 5xx',
		() => versucheGegenB(feldwege, { ...vergleich, keksFuer: () => keks }),
		{ weiter: true }
	);

	// ── Offener Teil: Code von A, Kennung von B im Feld ───────────────────
	/*
	 * **Nach dem Feldteil, vor dem Pfadteil**, aus demselben Grund wie dort: Der
	 * Abdruck davor und danach ordnet eine Änderung an B diesem Teil zu.
	 */
	console.log('\nOffener Teil: Code von A, Kennungen von B im Feld');

	const nachFeld = await fingerabdruecke(b);
	/** Der Keks eines Versuchs: das Telefon der Rolle, die der Weg braucht. */
	const zugangFuer = (versuch) => (versuch.zugang ? zugaenge[versuch.zugang] : undefined);

	await schritt(
		'Jedes Kennungsfeld unter den offenen Pfaden mit einer Kennung von B: Absage ohne Daten von B, nie 5xx',
		() => versucheGegenB(offeneFeldwege, { ...vergleich, keksFuer: zugangFuer }),
		{ weiter: true }
	);

	// ── Die Versuche ───────────────────────────────────────────────────────
	console.log('\nPfadteil: Kennungen von B in der Adresse');

	const mitte = await fingerabdruecke(b);
	let abgewiesen = 0;
	let geprueft = 0;
	const abweichungen = [];

	await schritt(
		`${liste.length} Wege auf fremde Daten, keine offene Antwort, keine 500-Seite`,
		async () => {
			const funde = [];
			for (const eintrag of liste) {
				/*
				 * Die Standardaktion ohne Namen: Auf `?/default` antwortet SvelteKit
				 * vor der Aktion, und bis 27.10.2026 prüften die zwei
				 * Standardaktionen unter einem Mandantenpfad (`vollmachten/nachweise`,
				 * `uebernehmen`) deshalb nur das Werkzeug.
				 */
				const pfad =
					`${eintrag.pfad}${eintrag.query ? `?${eintrag.query}` : ''}` +
					`${eintrag.aktion && eintrag.aktion !== 'default' ? `?/${eintrag.aktion}` : ''}`;
				let ergebnis;
				try {
					ergebnis = await aufruf(
						eintrag.methode,
						pfad,
						keks,
						eintrag.art ?? (eintrag.aktion ? 'form' : 'json')
					);
				} catch (unfall) {
					funde.push(`${eintrag.methode} ${pfad} → Verbindung scheiterte: ${unfall.message}`);
					continue;
				}
				geprueft += 1;
				const kurz = `${eintrag.methode} ${pfad}${eintrag.art ? ` [${eintrag.art}]` : ''}`;
				const satz = ergebnis.koerper.replace(/\s+/g, ' ').slice(0, 120);
				/*
				 * **Zwei Stufen, und die Abnahme ist die schärfere.**
				 *
				 * Hart ist, was die Sicherheit ausmacht: keine 2xx (eine fremde
				 * Sache wäre lesbar geworden), keine 5xx (eine Abweisung als
				 * Fehlerseite) und keine Antwort gar nicht. Das lässt der
				 * Durchstich nie durch.
				 *
				 * Weich ist die Abweichung von «403 oder 404»: Eine Absage als
				 * 400 mit Satz oder als 303 zurück auf die eigene Seite schützt
				 * genauso und ist an drei Stellen ausdrücklich so gebaut
				 * («Eine Schranke ist keine Fehlerseite»). Sie wird nicht
				 * verschwiegen, sondern gezählt und benannt, die Entscheidung
				 * darüber gehört nicht in diesen Durchstich.
				 */
				const hart =
					ergebnis.status === 0 ||
					(ergebnis.status >= 200 && ergebnis.status < 300) ||
					ergebnis.status >= 500;
				if (hart) {
					funde.push(`${kurz} → HTTP ${ergebnis.status}: ${satz}`);
				} else if (ergebnis.status !== 403 && ergebnis.status !== 404) {
					abweichungen.push(`${kurz} → HTTP ${ergebnis.status}: ${satz}`);
				} else {
					abgewiesen += 1;
				}
			}
			if (funde.length) {
				const gekappt = funde.slice(0, 20);
				behaupte(
					false,
					`${funde.length} Wege öffnen sich oder laufen in eine 500-Seite:\n       ` +
						`${gekappt.join('\n       ')}` +
						(funde.length > gekappt.length ? `\n       … und ${funde.length - gekappt.length} weitere` : '')
				);
			}
			return (
				`${geprueft} Antworten, ${abgewiesen}× 403/404, ` +
				`${abweichungen.length} Abweichungen von der Abnahme`
			);
		},
		{ weiter: true }
	);

	if (abweichungen.length) {
		console.log(
			`\n  Abweichungen von «403 oder 404» (kein Öffnen, kein 5xx; je einzeln eingeordnet):`
		);
		for (const a of abweichungen) console.log(`    · ${a}`);
	}

	const nachher = await fingerabdruecke(b);
	/** Welcher Teil eine Zeile verändert hat; zwischen den Teilen liegt je ein Abdruck. */
	const teilVon = (i) =>
		[
			['Feldteil', vorher, nachFeld],
			['offener Teil', nachFeld, mitte],
			['Pfadteil', mitte, nachher]
		]
			.filter(([, von, bis]) => von[i] !== bis[i])
			.map(([name]) => name)
			.join(' und ') || 'kein Teil';

	await schritt(
		'In der Datenbank hat sich an B nichts geändert',
		async () => {
			behaupte(
				nachher.length === vorher.length,
				`Die Zahl der gezählten Tabellen änderte sich: ${vorher.length} → ${nachher.length}`
			);
			/*
			 * **Ein angekündigter Zuwachs ist eingeordnet, kein stiller.** Ein
			 * Versuch des Feld- oder des offenen Teils darf ihn nur tragen, wenn die Anwendung die
			 * Zeile mit Absicht vor der Absage anlegt (`zuwachs` mit Grund); dann
			 * muss er genau so eintreten, sonst ist auch das ein Befund.
			 */
			const erlaubt = new Map();
			for (const w of [...feldwege, ...offeneFeldwege]) {
				for (const v of w.urteil.versuche) {
					for (const [tabelle, n] of Object.entries(v.fremd.zuwachs ?? {})) {
						erlaubt.set(`GLOBAL ${tabelle}`, (erlaubt.get(`GLOBAL ${tabelle}`) ?? 0) + n);
					}
				}
			}
			const zahl = (zeile) => Number(zeile.split(':')[1]);
			const rot = [];
			const eingeordnet = [];
			for (let i = 0; i < vorher.length; i++) {
				const name = vorher[i].split(':')[0];
				// Der Verlauf hat seinen eigenen Schritt, unten.
				if (name.startsWith('ERWÄHNT ')) continue;
				const soll = erlaubt.get(name) ?? 0;
				const ist = zahl(nachher[i]) - zahl(vorher[i]);
				if (vorher[i] === nachher[i] && soll === 0) continue;
				if (soll !== 0 && ist === soll && name.startsWith('GLOBAL ')) {
					eingeordnet.push(`${name} +${ist}`);
					continue;
				}
				rot.push(`${teilVon(i)}: ${vorher[i]} → ${nachher[i]}` + (soll ? ` (angekündigt +${soll})` : ''));
			}
			// Auch im roten Fall: Was eingeordnet ist, steht im Protokoll.
			for (const e of eingeordnet) console.log(`       eingeordnet: ${e}`);
			behaupte(rot.length === 0, `${rot.length} Tabelle(n) verändert:\n       ${rot.join('\n       ')}`);
			return (
				`${vorher.length - 1} Prüfsummen gleich, davon ${GLOBAL.length} Gesamtzahlen` +
				(eingeordnet.length ? `; eingeordnet: ${eingeordnet.join(', ')}` : '')
			);
		},
		{ weiter: true }
	);

	await schritt(
		'Kein Verlaufseintrag eines anderen Betreibers nennt B',
		async () => {
			/*
			 * **Ein eigener Schritt, damit ein bekannter Befund keinen neuen
			 * verdeckt.** Anlass: Solange vier Aktionen unter A einen Verlauf über
			 * B schrieben (`docs/pendenzen-sicherheit.md`, «Verlaufseintrag unter
			 * A»), blieb der Vergleich oben rot, und eine neue Änderung an B wäre
			 * darin nicht aufgefallen (Featureprüfung 27.10.2026). Rot hier ist
			 * seither ein neuer Befund.
			 */
			const i = vorher.findIndex((z) => z.startsWith('ERWÄHNT '));
			behaupte(
				vorher[i] === nachher[i],
				`${teilVon(i)}: ${vorher[i]} → ${nachher[i]}. Welche Aktion es war, zeigt ` +
					'audit_entry unter A mit dem Gegenstand einer Kennung von B.'
			);
			return 'keiner';
		},
		{ weiter: true }
	);

	await schritt(
		'Ströme der offenen Pfade: ein Ereignis von B kommt bei A nicht an, eines von A schon',
		async () => {
			/*
			 * **Nach dem Vergleich, mit Absicht.** Das Ereignis von B entsteht aus
			 * einer Saalmeldung an der laufenden Versammlung von B, also mit einer
			 * neuen Zeile unter B. Das ist B, der über seinen eigenen offenen Weg
			 * handelt, kein Zugriff von A; im Vergleich oben stünde es als Befund.
			 *
			 * **Der Gegenstrom macht die Absage aussagekräftig.** Die Leinwand von B
			 * hört mit; erst wenn das Ereignis dort ankommt, heisst «bei A kam
			 * nichts an», dass es gesendet und nicht zugestellt wurde. Und erst wenn
			 * ein Ereignis von A bei A ankommt, heisst es, dass die Ströme von A
			 * überhaupt zustellen.
			 */
			// Jeder geöffnete Strom kommt in die Liste, damit `finally` ihn schliesst,
			// auch wenn der nächste nicht aufgeht.
			const offen = [];
			const oeffne = async (pfad, keks) => {
				const s = await lauschen(pfad, keks);
				offen.push(s);
				return s;
			};
			try {
				const stroeme = {
					'/z/strom (Telefon von A)': await oeffne('/z/strom', zugaenge.stimme),
					'/p/strom (Leinwand von A)': await oeffne('/p/strom', zugaenge.leinwand)
				};
				const gegenstrom = await oeffne('/p/strom', zugaenge.leinwandB);
				// Den ersten Stand abwarten, den jeder Strom beim Verbinden schickt.
				for (const [name, s] of Object.entries(stroeme)) {
					behaupte(await bis(() => s.nachrichten.length > 0, 5000), `${name}: kein erster Stand`);
				}
				behaupte(await bis(() => gegenstrom.nachrichten.length > 0, 5000), 'Gegenstrom von B: kein erster Stand');
				const vorB = Object.fromEntries(Object.entries(stroeme).map(([n, s]) => [n, s.nachrichten.length]));
				const gegenVor = gegenstrom.nachrichten.length;

				const meldungB = await fetch(`${ZIEL}/e/${b.saalmerkmal[0]}`, {
					method: 'POST',
					redirect: 'manual',
					headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, accept: 'text/html' },
					body: new URLSearchParams({ name: `E2E Fremdmeldung ${B_ZEICHEN}` }).toString(),
					signal: AbortSignal.timeout(FRIST_MS)
				});
				behaupte(meldungB.status === 200, `Saalmeldung bei B antwortet ${meldungB.status}`);
				behaupte(
					await bis(() => gegenstrom.nachrichten.length > gegenVor, 5000),
					'Das Ereignis von B kam auch auf dem Strom von B nicht an; die Absage bei A sagte nichts'
				);
				// Eine Sekunde Nachlauf: Was bei A ankäme, käme im selben Zug.
				await new Promise((r) => setTimeout(r, 1000));
				const funde = [];
				for (const [name, s] of Object.entries(stroeme)) {
					// Ein geschlossener Strom empfängt nichts, und «nichts kam an» hiesse nichts.
					if (s.zu) funde.push(`${name}: vom Server beendet, die Absage sagt nichts`);
					const neu = s.nachrichten.length - vorB[name];
					if (neu > 0) funde.push(`${name}: ${neu} Nachricht(en) nach dem Ereignis von B`);
					for (const n of s.nachrichten) {
						const fremd = [...bZeichen, ...bKennungen].find((z) => n.includes(z));
						if (fremd) funde.push(`${name}: Inhalt von B («${fremd.slice(0, 16)}»)`);
					}
				}
				behaupte(funde.length === 0, funde.join('\n       '));

				// Vor dem Absenden zählen: Die Aktion wartet auf die Verkündung, bevor
				// sie antwortet, und danach gezählt wäre das Ereignis schon drin.
				const vorA = Object.fromEntries(Object.entries(stroeme).map(([n, s]) => [n, s.nachrichten.length]));
				const meldungA = await fetch(`${ZIEL}/e/${kA.saalmerkmal}`, {
					method: 'POST',
					redirect: 'manual',
					headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ZIEL, accept: 'text/html' },
					body: new URLSearchParams({ name: `E2E Eigenmeldung ${A_ZEICHEN}` }).toString(),
					signal: AbortSignal.timeout(FRIST_MS)
				});
				behaupte(meldungA.status === 200, `Saalmeldung bei A antwortet ${meldungA.status}`);
				await bis(() => Object.entries(stroeme).every(([n, s]) => s.nachrichten.length > vorA[n]), 5000);
				const fehlt = Object.entries(stroeme)
					.filter(([n, s]) => s.nachrichten.length <= vorA[n])
					.map(([n, s]) => `${n}: das Ereignis von A kam nicht an${s.zu ? ' (Strom vom Server beendet)' : ''}`);
				behaupte(fehlt.length === 0, fehlt.join('\n       '));
				return 'B: auf dem Strom von B angekommen, bei A keines; A: auf beiden Strömen von A angekommen';
			} finally {
				for (const s of offen) await s.ende();
			}
		},
		{ weiter: true }
	);

	await schritt(
		'Die Gegenhälfte des Feldteils: dieselben Felder mit Kennungen von A gehen durch',
		/*
		 * **Nach dem Vergleich, nicht davor:** Die Gegenhälfte schreibt an A
		 * (archiviert, widerruft, legt Versammlungen an), und die Gesamtzahlen
		 * oben sollen nur die Versuche auf B sehen.
		 */
		() => versucheMitA(feldwege, { ...vergleich, keksFuer: () => keks }),
		{ weiter: true }
	);

	await schritt(
		'Die Gegenhälfte des offenen Teils: dieselben Felder mit Kennungen von A gehen durch',
		() => versucheMitA(offeneFeldwege, { ...vergleich, keksFuer: zugangFuer }),
		{ weiter: true }
	);
}

try {
	await main();
} catch (unfall) {
	/*
	 * Was ein Schritt geworfen hat, steht schon in `fehler`. Alles andere
	 * (etwa die Routenliste, die ausserhalb eines Schritts entsteht) gehört
	 * ausdrücklich dazu, sonst endete der Lauf mit «Alle 0 Schritte grün».
	 */
	if (!unfall?.gemeldet) {
		fehler.push(`Abbruch: ${unfall?.message ?? unfall}`);
		console.log(`  ✗ Abbruch\n     ${unfall?.message ?? unfall}`);
	}
} finally {
	if (a) {
		try {
			await aEntfernen(a, beginn);
			console.log(`\n  Prüfgegenstände von A wieder entfernt (${a.stweg[0].slice(0, 8)}).`);
		} catch (unfall) {
			fehler.push(`Aufräumen A: ${unfall.message}`);
			console.log(`\n  ✗ Prüfgegenstände von A liessen sich nicht entfernen: ${unfall.message}`);
		}
	}
	if (b && !NUR_LISTE) {
		try {
			await bEntfernen(b);
			console.log(`\n  Betreiber B wieder entfernt (${b.operator_id[0].slice(0, 8)}).`);
		} catch (unfall) {
			fehler.push(`Aufräumen: ${unfall.message}`);
			console.log(
				`\n  ✗ Betreiber B liess sich nicht entfernen (${b.operator_id[0]}): ${unfall.message}`
			);
		}
	}
}

console.log('');
if (fehler.length) {
	console.log(`${fehler.length} Schritt(e) rot:`);
	for (const f of fehler) console.log(`  - ${f}`);
	process.exit(1);
}
console.log(`Alle ${nummer} Schritte grün.`);
