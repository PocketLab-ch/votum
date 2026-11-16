/**
 * Die letzten einfachen Verweise zwischen Betreibertabellen binden an den
 * Betreiber (Migration 179).
 *
 * **Der Anlass:** Pendenz «Einfache Fremdschlüssel zwischen Mandantentabellen»
 * (`docs/pendenzen-sicherheit.md`). `instruction.party_id`,
 * `instruction.superseded_by`, `meeting_handover.device_id` und
 * `agenda_item.proposer_party_id` zeigten nur auf die `id` der Zieltabelle; eine
 * Zeile von A konnte so auf eine Partei, eine Weisung oder ein Saalgerät von B
 * zeigen, sobald die Anwendung einmal nicht prüft.
 *
 * Je Spalte drei Fälle: die Absage am Schema mit dem Namen des Schlüssels
 * (`admin`, an der Anwendung vorbei), dieselbe Absage unter `alsBetreiber` als
 * fachlicher Fehler statt als 500 (`db.ts · fehlenderVerweis`), und die
 * Gegenhälfte: Mit der Zeile von A geht es durch. Ohne Migration 179 schlagen
 * die Absagen fehl, weil die einfachen Schlüssel eine Zeile von B annehmen.
 *
 * Jeder Versuch rollt zurück. Weisungen lassen sich nicht löschen (AD-5), und
 * eine stehengebliebene Abgabe sperrte die Versammlung von A für die nächsten
 * Versuche (Migration 117).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { alsBetreiber } from '$lib/server/db';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

type Seite = {
	betreiber: string;
	versammlung: string;
	traktandum: string;
	partei: string;
	geraet: string;
	weisung: string;
	weisungPartei: string;
};

let a: Seite;
let b: Seite;

const ANLASS = { datum: '2026-12-01', uhrzeit: '19:00', ort: 'Prüfsaal' };

async function seite(name: 'A' | 'B'): Promise<Seite> {
	const betreiber = await pruefbetreiber(`Prüflauf Verweise ${name}`);
	const benutzer = await pruefbenutzer(betreiber, `pruefer-verweise-${name.toLowerCase()}`);
	const handelnder = { operatorId: betreiber, userId: benutzer, label: `Prüferin ${name}` };
	const g = await erstelleGemeinschaft(handelnder, {
		name: `Verweisweg ${name}`,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const versammlung = (
		await erstelleVersammlung(handelnder, {
			stwegId: g.id,
			...ANLASS,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		})
	).id;
	const traktandum = (
		await erstelleTraktandum(handelnder, {
			meetingId: versammlung,
			titel: 'Fassade',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		})
	).id;
	const [{ id: partei }] = await admin<{ id: string }[]>`
		INSERT INTO party (stweg_id, operator_id, kind, display_name, representative_name, is_community)
		VALUES (${g.id}, ${betreiber}, 'legal', ${`Haus Verweisweg ${name}`}, ${`Haus Verweisweg ${name}`}, false)
		RETURNING id
	`;
	const [{ id: geraet }] = await admin<{ id: string }[]>`
		INSERT INTO handover_device (operator_id, name, enc_public_key, sig_public_key, fingerprint)
		VALUES (${betreiber}, ${`Notebook Verweisweg ${name}`}, ${'A'.repeat(44)}, ${'B'.repeat(44)},
		        ${(name === 'A' ? 'a' : 'b').repeat(64)})
		RETURNING id
	`;
	// Eine bestehende Weisung, auf die eine Berichtigung zeigen kann. Sie hat
	// ein eigenes Haus: Mit `partei` stiesse jede neue Weisung an
	// `instruction_eine_geltende`.
	const [{ id: weisungPartei }] = await admin<{ id: string }[]>`
		INSERT INTO party (stweg_id, operator_id, kind, display_name, representative_name, is_community)
		VALUES (${g.id}, ${betreiber}, 'legal', ${`Nachbarhaus ${name}`}, ${`Nachbarhaus ${name}`}, false)
		RETURNING id
	`;
	const [{ id: weisung }] = await admin<{ id: string }[]>`
		INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id, stance, source_kind)
		VALUES (${betreiber}, ${versammlung}, ${traktandum}, ${weisungPartei}, 'frei', 'frei')
		RETURNING id
	`;
	return { betreiber, versammlung, traktandum, partei, geraet, weisung, weisungPartei };
}

beforeAll(async () => {
	a = await seite('A');
	b = await seite('B');
});

afterAll(verbindungenSchliessen);

const ZURUECK = 'zurückgerollt';

type Ersatz = Partial<Pick<Seite, 'partei' | 'geraet' | 'weisung'>>;
type Schreiben = (tx: postgres.TransactionSql, z: Seite) => Promise<unknown>;

/** Neue Weisung von A zu Traktandum und Partei. */
const weisungErteilen: Schreiben = (tx, z) => tx`
	INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id, stance, source_kind)
	VALUES (${a.betreiber}, ${a.versammlung}, ${a.traktandum}, ${z.partei}, 'frei', 'frei')
`;

/** Die bestehende Weisung von A als überholt kennzeichnen, wie `weisung.ts` es tut. */
const weisungUeberholen: Schreiben = (tx, z) => tx`
	UPDATE instruction SET superseded_by = ${z.weisung} WHERE id = ${a.weisung}
`;

/** Die Versammlung von A an ein Saalgerät abgeben. */
const abgeben: Schreiben = (tx, z) => tx`
	INSERT INTO meeting_handover (operator_id, meeting_id, device_id, package_checksum, package_size)
	VALUES (${a.betreiber}, ${a.versammlung}, ${z.geraet}, ${'c'.repeat(64)}, 1)
`;

/** Eine Partei als Antragstellerin des Traktandums von A. */
const antragStellen: Schreiben = (tx, z) => tx`
	UPDATE agenda_item SET proposer_kind = 'eigentuemer', proposer_party_id = ${z.partei}
	 WHERE id = ${a.traktandum}
`;

/** Am Schema, an der Anwendung vorbei; rollt in jedem Fall zurück. */
function amSchema(schreiben: Schreiben, ersatz: Ersatz = {}) {
	return admin.begin(async (tx) => {
		await schreiben(tx, { ...a, ...ersatz });
		throw new Error(ZURUECK);
	});
}

/** Unter dem Betreiber A wie die Anwendung; rollt in jedem Fall zurück. */
function alsA(schreiben: Schreiben, ersatz: Ersatz = {}) {
	return alsBetreiber(a.betreiber, async (tx) => {
		await schreiben(tx, { ...a, ...ersatz });
		throw new Error(ZURUECK);
	});
}

const FAELLE: [string, Schreiben, keyof Ersatz, string][] = [
	['instruction.party_id', weisungErteilen, 'partei', 'instruction_partei_gleicher_betreiber'],
	['instruction.superseded_by', weisungUeberholen, 'weisung', 'instruction_nachfolger_gleicher_betreiber'],
	['meeting_handover.device_id', abgeben, 'geraet', 'meeting_handover_geraet_gleicher_betreiber'],
	['agenda_item.proposer_party_id', antragStellen, 'partei', 'agenda_item_proposer_party_gleicher_betreiber']
];

describe.each(FAELLE)('Migration 179: %s', (_spalte, schreiben, feld, schluessel) => {
	it('weist die Zeile von B am Schlüssel mit Betreiber ab', async () => {
		await expect(amSchema(schreiben, { [feld]: b[feld] })).rejects.toMatchObject({
			code: '23503',
			constraint_name: schluessel
		});
	});

	it('unter alsBetreiber kommt die Absage als fachlicher Fehler an, nicht als 500', async () => {
		const versuch = alsA(schreiben, { [feld]: b[feld] });
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toMatchObject({ kennung: 'unbekannter_verweis' });
	});

	it('nimmt die Zeile von A an (Gegenhälfte)', async () => {
		await expect(amSchema(schreiben)).rejects.toThrow(ZURUECK);
		await expect(alsA(schreiben)).rejects.toThrow(ZURUECK);
	});
});

describe('Migration 179: Berichtigungsweg', () => {
	it('trägt den kurzen Selbstverweis aus weisung.ts', async () => {
		/*
		 * `weisung.ts` setzt `superseded_by` erst auf die eigene Kennung, damit
		 * der Eindeutigkeitsindex die neue Zeile zulässt, und dann auf die neue.
		 * Der zusammengesetzte Schlüssel muss beide Schritte tragen.
		 */
		const versuch = alsBetreiber(a.betreiber, async (tx) => {
			await tx`UPDATE instruction SET superseded_by = ${a.weisung} WHERE id = ${a.weisung}`;
			const [{ id: neu }] = await tx<{ id: string }[]>`
				INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id, stance, source_kind)
				VALUES (${a.betreiber}, ${a.versammlung}, ${a.traktandum}, ${a.weisungPartei}, 'frei', 'frei')
				RETURNING id
			`;
			await tx`UPDATE instruction SET superseded_by = ${neu} WHERE id = ${a.weisung}`;
			throw new Error(ZURUECK);
		});
		await expect(versuch).rejects.toThrow(ZURUECK);
	});
});

describe('Migration 179: Schema', () => {
	it('die vier Schlüssel tragen den Betreiber, die einfachen sind weg', async () => {
		const zeilen = await admin<{ name: string; def: string }[]>`
			SELECT conname AS name, pg_get_constraintdef(oid) AS def
			  FROM pg_constraint
			 WHERE conrelid IN ('instruction'::regclass, 'meeting_handover'::regclass, 'agenda_item'::regclass)
			   AND contype = 'f'
		`;
		const namen = zeilen.map((z) => z.name);
		for (const [, , , schluessel] of FAELLE) {
			expect(zeilen.find((z) => z.name === schluessel)?.def).toMatch(/, operator_id\) REFERENCES \w+\(id, operator_id\)/);
		}
		// `ON DELETE` wie zuvor: nur die Partei der Weisung hatte RESTRICT, die
		// übrigen drei die Vorgabe (NO ACTION, im Katalogtext ohne Angabe).
		for (const [, , , schluessel] of FAELLE) {
			const def = zeilen.find((z) => z.name === schluessel)?.def;
			if (schluessel === 'instruction_partei_gleicher_betreiber') expect(def).toContain('ON DELETE RESTRICT');
			else expect(def).not.toContain('ON DELETE');
		}
		for (const alt of [
			'instruction_party_id_fkey',
			'instruction_superseded_by_fkey',
			'meeting_handover_device_id_fkey',
			'agenda_item_proposer_party_id_fkey'
		]) {
			expect(namen).not.toContain(alt);
		}
	});

	it('als Klasse: jeder Verweis zwischen Betreibertabellen hängt am Betreiber', async () => {
		/*
		 * Damit der nächste einfache Schlüssel nicht wieder erst in einer
		 * Abfrage von Hand auffällt. Ein Schlüssel **trägt**, wenn an einer
		 * Stelle Quellspalte und Gegenstück gebunden sind: Dann gehört die
		 * Zielzeile dem Betreiber der Quellzeile. Gebunden sind `operator_id`
		 * und `id` jeder Tabelle mit Betreiber (die eigene Kennung meint die
		 * eigene Zeile; das setzt voraus, dass eine Kennung nur eine Zeile
		 * meint, wie bei `uuidv7()`), dazu jede Quellspalte eines tragenden
		 * Schlüssels, deren Gegenstück gebunden ist. So bindet
		 * `(meeting_id, operator_id) → meeting (id, operator_id)` die Spalte
		 * `meeting_id`, und darüber trägt `(agenda_item_id, meeting_id) →
		 * agenda_item (id, meeting_id)`, weil `agenda_item.meeting_id` selbst
		 * gebunden ist. Gemeldet wird jeder Verweis von einer Tabelle mit
		 * `operator_id` auf eine Tabelle mit `operator_id`, auch auf sich selbst
		 * (`superseded_by`), der nicht trägt; auch dann, wenn seine Spalten
		 * anderswo gebunden sind.
		 *
		 * **Ausgenommen sind Verweise auf `app_user`**: Die Bearbeiterfelder
		 * (`recorded_by`, `closed_by` und so fort) setzt die Anwendung aus der
		 * Sitzung (`handelnder.userId`), nicht aus einer Eingabe; sie waren nicht
		 * Teil der Pendenz.
		 */
		const schluessel = await admin<
			{ tabelle: string; name: string; ziel: string; spalten: string[]; zielspalten: string[] }[]
		>`
			SELECT c.conrelid::regclass::text AS tabelle, c.conname AS name,
			       c.confrelid::regclass::text AS ziel,
			       array(SELECT a.attname::text
			               FROM unnest(c.conkey) WITH ORDINALITY AS k (nr, pos)
			               JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.nr
			              ORDER BY k.pos) AS spalten,
			       array(SELECT a.attname::text
			               FROM unnest(c.confkey) WITH ORDINALITY AS k (nr, pos)
			               JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.nr
			              ORDER BY k.pos) AS zielspalten
			  FROM pg_constraint c
			 WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
		`;
		const mitBetreiber = new Set(
			(
				await admin<{ tabelle: string }[]>`
					SELECT attrelid::regclass::text AS tabelle FROM pg_attribute
					 WHERE attname = 'operator_id' AND NOT attisdropped
				`
			).map((z) => z.tabelle)
		);

		const gebunden = new Set([...mitBetreiber].flatMap((t) => [`${t}.operator_id`, `${t}.id`]));
		const traegt = (s: (typeof schluessel)[number]) =>
			s.spalten.some(
				(sp, i) => gebunden.has(`${s.tabelle}.${sp}`) && gebunden.has(`${s.ziel}.${s.zielspalten[i]}`)
			);
		for (let weiter = true; weiter; ) {
			weiter = false;
			for (const s of schluessel) {
				if (!traegt(s)) continue;
				s.spalten.forEach((sp, i) => {
					const quelle = `${s.tabelle}.${sp}`;
					if (!gebunden.has(quelle) && gebunden.has(`${s.ziel}.${s.zielspalten[i]}`)) {
						gebunden.add(quelle);
						weiter = true;
					}
				});
			}
		}
		const lose = schluessel
			.filter((s) => mitBetreiber.has(s.tabelle) && mitBetreiber.has(s.ziel) && s.ziel !== 'app_user')
			.filter((s) => !traegt(s))
			.map((s) => `${s.tabelle}.${s.name}`)
			.sort();
		expect(lose).toEqual([]);
	});
});
