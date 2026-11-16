/**
 * Der gepinnte Suchpfad der SECURITY-DEFINER-Funktionen (Befunde D1, D2 und D8
 * aus dem Sicherheitsdurchgang vom 09.10.2026, Migration 154), und seit
 * Migration 164 der jeder anderen eigenen Funktion (C1, 16.10.2026).
 *
 * **Der Angriff, den diese Datei abweist.** Eine Funktion mit den Rechten
 * ihres Eigentümers, aber ohne `SET search_path`, löst ihre Tabellen über den
 * Suchpfad des Aufrufers auf, und dort steht `pg_temp` vor `public`. Die
 * Anwendungsrolle legte eine temporäre `meeting` an, gab ihr eine Zeile, die
 * der Betreiberprüfung genau das sagte, was sie hören wollte, und die
 * Löschungen danach trafen die echten Tabellen eines fremden Betreibers.
 * Gemessen am 09.10.2026 mit einer Probe, die bis Migration 154 grün war.
 *
 * **Warum eine eigene Verbindung.** plpgsql hält den Plan einer Funktion je
 * Verbindung im Cache. Wer sie einmal ohne Schatten ruft, bindet `meeting` für
 * diese Verbindung an `public`, und ein späterer Schatten wirkt dort nicht
 * mehr, auch ohne Pin. Ein Angreifer kommt mit einer frischen Verbindung; deren
 * Erstaufruf bildet diese Verbindung nach (`max: 1`, damit der Pool sie nicht
 * wechselt). Ohne das wäre die Prüfung grün, weil die Probe sich selbst
 * entschärft hätte.
 *
 * Die Klasse prüft daneben der Katalog: jede eigene Funktion trägt einen
 * Suchpfad, mit oder ohne SECURITY DEFINER. Den Text der Migrationen prüft `check-suchpfad.mjs`.
 */
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung, loescheVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { gibAb } from '$lib/server/abgabe';
import { registriereGeraet } from '$lib/server/geraete';
import { alsGeraetecode, erzeugeGeraeteschluessel } from '$lib/server/saalgeraet';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { appUrl } from './urls';

let opferBetreiber: string;
let angreiferBetreiber: string;
let benutzer: string;

/** Je Fall eine frische Verbindung: Ihr Erstaufruf plant mit dem Schatten. */
const offen: postgres.Sql[] = [];
function frischeVerbindung() {
	const v = postgres(appUrl(), { max: 1, onnotice: () => {} });
	offen.push(v);
	return v;
}

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf Suchpfad' };
}

/**
 * Eine Versammlung mit einer Einheit und einer Eigentümerin. Ohne Eigentum
 * gäbe es keine Momentaufnahme und damit keine Zugänge, und für D2 wäre
 * nichts zu löschen.
 */
async function eineVersammlung(operatorId: string, name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Prüfperson Suchpfad',
		representativeName: null,
		isCommunity: false
	});
	await ordneEigentumZu(handelnder(operatorId), e.id, p.id, '2020-01-01');
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return v.id;
}

async function zaehle(tabelle: 'agenda_item' | 'meeting_access', versammlung: string) {
	const [z] = await admin<{ n: number }[]>`
		SELECT count(*)::int AS n FROM ${admin(tabelle)} WHERE meeting_id = ${versammlung}
	`;
	return z.n;
}

beforeAll(async () => {
	opferBetreiber = await pruefbetreiber('Suchpfad Opfer');
	angreiferBetreiber = await pruefbetreiber('Suchpfad Angreifer');
	benutzer = await pruefbenutzer(opferBetreiber, 'leitung');
});

afterAll(async () => {
	await Promise.all(offen.map((v) => v.end()));
	await verbindungenSchliessen();
});

describe('D1: versammlung_loeschen lässt sich keine Versammlung unterschieben', () => {
	it('weist den Angreifer trotz temporärer meeting-Tabelle ab, und die Traktanden bleiben', async () => {
		const versammlung = await eineVersammlung(opferBetreiber, 'Suchpfad D1', '2027-05-06');
		const vorher = await zaehle('agenda_item', versammlung);
		// Ohne Traktanden bewiese das Gleichbleiben unten nichts.
		expect(vorher).toBeGreaterThan(0);

		const angreifer = frischeVerbindung();
		await expect(
			angreifer.begin(async (tx) => {
				await tx`CREATE TEMP TABLE meeting (
					id uuid, operator_id uuid, state text, meeting_date date, previous_meeting_id uuid
				) ON COMMIT DROP`;
				await tx`INSERT INTO meeting VALUES (${versammlung}, ${angreiferBetreiber}, 'entwurf', '2027-05-06', null)`;
				await tx`SELECT * FROM versammlung_loeschen(${angreiferBetreiber}, ${versammlung})`;
			})
		).rejects.toThrow(/gibt es nicht/);

		expect(await zaehle('agenda_item', versammlung)).toBe(vorher);
	});
});

describe('D2: betriebsdaten_loeschen lässt sich keine Versammlung unterschieben', () => {
	it('weist den Angreifer trotz temporärer meeting-Tabelle ab, und die Zugänge bleiben', async () => {
		const versammlung = await eineVersammlung(opferBetreiber, 'Suchpfad D2', '2027-05-07');
		await gibVersammlungFrei(handelnder(opferBetreiber), versammlung);
		await erzeugeZugaenge(handelnder(opferBetreiber), versammlung);
		// Die Funktion verlangt einen geschlossenen Zustand; `meeting_zeitstempel`
		// (Migration 011) verlangt dazu die Stempel. Hier zählt allein, ob der
		// Schatten die Prüfung füttert, nicht der Weg zum Schliessen.
		await admin`UPDATE meeting SET state = 'geschlossen',
			opened_at = '2027-05-07 19:00', closed_at = '2027-05-07 21:00'
			WHERE id = ${versammlung}`;
		const vorher = await zaehle('meeting_access', versammlung);
		expect(vorher).toBeGreaterThan(0);

		const angreifer = frischeVerbindung();
		await expect(
			angreifer.begin(async (tx) => {
				await tx`CREATE TEMP TABLE meeting (id uuid, operator_id uuid, state text) ON COMMIT DROP`;
				await tx`INSERT INTO meeting VALUES (${versammlung}, ${angreiferBetreiber}, 'geschlossen')`;
				await tx`SELECT * FROM betriebsdaten_loeschen(${angreiferBetreiber}, ${versammlung})`;
			})
		).rejects.toThrow(/gibt es nicht/);

		expect(await zaehle('meeting_access', versammlung)).toBe(vorher);
	});
});

describe('D8: eine versiegelte Nachfolgerin hält das Löschen nicht auf', () => {
	/*
	 * Ein Traktandum der späteren Versammlung zeigt mit seiner Herkunft auf die
	 * frühere. Ist die spätere versiegelt, wies ihr Auslöser das Lösen dieser
	 * Angabe ab, und die frühere liess sich nie mehr löschen, mit einer rohen
	 * Ausnahme statt eines Satzes. Die Herkunft steht nicht im Siegel.
	 *
	 * Verweis und Siegel setzt die privilegierte Verbindung, in dieser
	 * Reihenfolge: Nach dem Siegel liesse auch sie den Verweis nicht mehr zu.
	 *
	 * **Die frühere trägt eine Momentaufnahme**, und das mit Absicht
	 * (Code-Review 13.10.2026). Unter `replica` fallen auch die
	 * Fremdschlüssel weg, also die Kaskade von `snapshot_party` zu
	 * `snapshot_unit`. Setzte die Funktion nach dem Lösen nicht auf `origin`
	 * zurück, blieben die Einheiten der Momentaufnahme als Waisen stehen.
	 *
	 * Zurück in den Entwurf geht sie über die privilegierte Verbindung, nicht
	 * über `nimmVersammlungsfreigabeZurueck`: Die Rücknahme verwirft die
	 * Momentaufnahme heute selbst, und ohne sie sähe dieser Test nichts. Eine
	 * Momentaufnahme im Entwurf ist der Fall, den 058 noch abräumt.
	 */
	it('löscht die frühere Versammlung und löst nur die Herkunftsangabe', async () => {
		const frueher = await eineVersammlung(opferBetreiber, 'Suchpfad D8 früher', '2027-06-01');
		await gibVersammlungFrei(handelnder(opferBetreiber), frueher);
		await admin`UPDATE meeting SET state = 'entwurf', released_at = NULL WHERE id = ${frueher}`;
		const [{ einheiten }] = await admin<{ einheiten: number }[]>`
			SELECT count(*)::int AS einheiten FROM snapshot_unit WHERE meeting_id = ${frueher}
		`;
		// Ohne Einheiten bewiese die Null unten nichts.
		expect(einheiten).toBeGreaterThan(0);
		const spaeter = await eineVersammlung(opferBetreiber, 'Suchpfad D8 später', '2028-06-01');
		const [traktandum] = await admin<{ id: string; title: string }[]>`
			UPDATE agenda_item SET copied_from_meeting_id = ${frueher}
			 WHERE id = (SELECT id FROM agenda_item WHERE meeting_id = ${spaeter} ORDER BY id LIMIT 1)
			RETURNING id, title
		`;
		await admin`UPDATE meeting SET state = 'versiegelt', released_at = '2028-05-01 12:00',
			opened_at = '2028-06-01 19:00', closed_at = '2028-06-01 21:00'
			WHERE id = ${spaeter}`;

		const weg = await loescheVersammlung(handelnder(opferBetreiber), frueher, true);
		expect(weg.traktanden).toBeGreaterThan(0);
		const [{ waisen }] = await admin<{ waisen: number }[]>`
			SELECT count(*)::int AS waisen FROM snapshot_unit WHERE meeting_id = ${frueher}
		`;
		expect(waisen, 'Momentaufnahme nicht mitgelöscht: lief der Rest unter replica?').toBe(0);

		const [danach] = await admin<{ copied_from_meeting_id: string | null; title: string }[]>`
			SELECT copied_from_meeting_id, title FROM agenda_item WHERE id = ${traktandum.id}
		`;
		expect(danach.copied_from_meeting_id).toBeNull();
		// Sonst nichts an der versiegelten Zeile.
		expect(danach.title).toBe(traktandum.title);

		// Das Siegel der späteren Versammlung weist eine Änderung weiterhin ab:
		// Gelöst wurde nur die eine Spalte, der Schutz der Zeile bleibt.
		await expect(
			admin`UPDATE agenda_item SET title = 'geändert' WHERE id = ${traktandum.id}`
		).rejects.toThrow(/versiegelt/);
	});
});

/*
 * **Die Sperren der Auslöser** (Auftrag Abschluss, C1, 16.10.2026). Dieselbe
 * Klasse ohne SECURITY DEFINER: Die Auslöserfunktionen laufen unter der
 * Anwendungsrolle, und die darf temporäre Tabellen anlegen (TEMP für PUBLIC,
 * an Dev und Betrieb gemessen). Ohne Pin verdeckt eine temporäre Tabelle die
 * echte in jeder Prüfung der Funktion. Ein Rechtegewinn über den eigenen
 * Betreiber hinaus ist das nicht, aber die Sperren schützen den Nachweis
 * gerade gegen die eigene Anwendung (AD-5).
 */
describe('C1: die Sperren der Auslöser lassen sich nicht verdecken', () => {
	it('hält die Abgabesperre trotz leerer temporärer meeting_handover', async () => {
		const versammlung = await eineVersammlung(opferBetreiber, 'Suchpfad C1 Abgabe', '2027-07-01');
		await gibVersammlungFrei(handelnder(opferBetreiber), versammlung);
		await erzeugeZugaenge(handelnder(opferBetreiber), versammlung);
		const paar = erzeugeGeraeteschluessel();
		const geraet = await registriereGeraet(handelnder(opferBetreiber), 'Notebook C1', alsGeraetecode(paar));
		await gibAb(handelnder(opferBetreiber), versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2027-06-20 10:00:00'
		});

		// Bis Migration 164 ging diese Änderung durch: `versammlung_abgegeben`
		// las die leere temporäre Tabelle und meldete «nicht abgegeben».
		const schatten = frischeVerbindung();
		await expect(
			schatten.begin(async (tx) => {
				await tx`SELECT set_config('versammlung.operator_id', ${opferBetreiber}, true)`;
				await tx`CREATE TEMP TABLE meeting_handover (
					meeting_id uuid, returned_at timestamptz, revoked_at timestamptz
				) ON COMMIT DROP`;
				await tx`UPDATE meeting SET location = 'Anderswo' WHERE id = ${versammlung}`;
			})
		).rejects.toThrow(/abgegeben/i);

		const [m] = await admin<{ location: string }[]>`SELECT location FROM meeting WHERE id = ${versammlung}`;
		expect(m.location).toBe('Prüfsaal');

		/*
		 * **Und die Funktion selbst, direkt gerufen** (Codeprüfung C1). Über den
		 * Auslöser erbt sie seit 164 dessen Pin; verlöre sie ihren eigenen bei
		 * einem späteren Umbau, bliebe der Weg oben grün. Direkt gerufen zählt
		 * nur ihr eigener.
		 */
		const direkt = frischeVerbindung();
		const [antwort] = await direkt.begin(async (tx) => {
			await tx`SELECT set_config('versammlung.operator_id', ${opferBetreiber}, true)`;
			await tx`CREATE TEMP TABLE meeting_handover (
				meeting_id uuid, returned_at timestamptz, revoked_at timestamptz
			) ON COMMIT DROP`;
			return tx<{ abgegeben: boolean }[]>`SELECT versammlung_abgegeben(${versammlung}) AS abgegeben`;
		});
		expect(antwort.abgegeben).toBe(true);
	});

	/*
	 * **Die Gegenprobe: Die Siegelsperre hielt schon vorher**, weil
	 * `versammlung_versiegelt` seit Migration 157 gepinnt ist. Über den
	 * Auslöser erbt sie seit 164 auch dessen Pin; ob sie ihren eigenen behält,
	 * misst erst der direkte Aufruf am Ende (Codeprüfung C1).
	 */
	it('hält die Siegelsperre trotz temporärer meeting mit anderem Zustand', async () => {
		const versammlung = await eineVersammlung(opferBetreiber, 'Suchpfad C1 Siegel', '2027-07-02');
		await admin`UPDATE meeting SET state = 'versiegelt', released_at = '2027-06-01 12:00',
			opened_at = '2027-07-02 19:00', closed_at = '2027-07-02 21:00'
			WHERE id = ${versammlung}`;
		// Ohne Traktandum träfe das UPDATE keine Zeile, und kein Auslöser liefe.
		expect(await zaehle('agenda_item', versammlung)).toBeGreaterThan(0);

		const schatten = frischeVerbindung();
		await expect(
			schatten.begin(async (tx) => {
				await tx`SELECT set_config('versammlung.operator_id', ${opferBetreiber}, true)`;
				await tx`CREATE TEMP TABLE meeting (id uuid, state text) ON COMMIT DROP`;
				await tx`INSERT INTO meeting VALUES (${versammlung}, 'laufend')`;
				await tx`UPDATE agenda_item SET title = 'nachträglich' WHERE meeting_id = ${versammlung}`;
			})
		).rejects.toThrow(/versiegelt/);

		const direkt = frischeVerbindung();
		const [antwort] = await direkt.begin(async (tx) => {
			await tx`SELECT set_config('versammlung.operator_id', ${opferBetreiber}, true)`;
			await tx`CREATE TEMP TABLE meeting (id uuid, state text) ON COMMIT DROP`;
			await tx`INSERT INTO meeting VALUES (${versammlung}, 'laufend')`;
			return tx<{ versiegelt: boolean }[]>`SELECT versammlung_versiegelt(${versammlung}) AS versiegelt`;
		});
		expect(antwort.versiegelt).toBe(true);
	});
});

describe('Die Klasse am Katalog', () => {
	/*
	 * **Mit `pg_temp` am Ende, nicht bloss irgendein Pfad** (Code-Review
	 * 13.10.2026). Fehlt `pg_temp` im Pfad, durchsucht PostgreSQL es für
	 * Tabellen zuerst; `SET search_path = public` wehrte D1 also nicht ab.
	 *
	 * Geprüft wird die Prüfdatenbank, die aus den Migrationen gebaut wird,
	 * nicht Dev oder Prod. Eine dort von Hand geänderte Funktion sieht dieser
	 * Test nicht. Was er über `check-suchpfad.mjs` hinaus sieht: Formen, die
	 * der Wächter am Text nicht unterscheidet, etwa Überladungen.
	 */
	it('kennt keine Funktion mit SECURITY DEFINER ohne Suchpfad, der auf pg_temp endet', async () => {
		const zeilen = await admin<{ name: string; gepinnt: boolean }[]>`
			SELECT p.proname AS name,
			       EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
			                WHERE c LIKE 'search_path=%' AND c ~ ',[[:space:]]*pg_temp$') AS gepinnt
			  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
			 WHERE n.nspname = 'public' AND p.prosecdef
		`;
		// Leer wäre grün und blind: Das Haus hat über zwanzig solche Funktionen.
		expect(zeilen.length).toBeGreaterThan(15);
		expect(zeilen.filter((z) => !z.gepinnt).map((z) => z.name)).toEqual([]);
	});

	/*
	 * **Und jede andere eigene Funktion auch** (C1, 16.10.2026). Eine
	 * Auslöserfunktion ohne Pin lässt sich mit einer temporären Tabelle
	 * blenden (oben gemessen). Ausgenommen sind nur Funktionen von
	 * Erweiterungen, die nicht aus den Migrationen kommen.
	 */
	it('kennt auch sonst keine eigene Funktion ohne Suchpfad, der auf pg_temp endet', async () => {
		const zeilen = await admin<{ name: string; gepinnt: boolean }[]>`
			SELECT p.proname AS name,
			       EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
			                WHERE c LIKE 'search_path=%' AND c ~ ',[[:space:]]*pg_temp$') AS gepinnt
			  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
			 WHERE n.nspname = 'public'
			   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
		`;
		// Das Haus hat rund siebzig eigene Funktionen; leer wäre blind.
		expect(zeilen.length).toBeGreaterThan(50);
		expect(zeilen.filter((z) => !z.gepinnt).map((z) => z.name).sort()).toEqual([]);
	});
});
