/**
 * Die Weisung verweist nur auf Zeilen ihres eigenen Betreibers (Migration 178).
 *
 * **Der Anlass:** Block D aus Auftrag 2d. Migration 027 band `meeting_id`,
 * `agenda_item_id` und `source_voting_round_id` nur an die `id` der
 * Zieltabelle; eine Weisung von A konnte so auf eine Versammlung, ein
 * Traktandum oder eine Abstimmungsrunde von B zeigen, sobald die Anwendung
 * einmal nicht prüft. Die Schlüssel mit Betreiber sind die zweite Linie.
 *
 * Gegen das Schema, an der Anwendung vorbei (`admin`), wie der Schemafall in
 * `eigener-pfad-fremde-kennung.test.ts`. Je Schlüssel die Absage mit seinem
 * Namen, dazu die Gegenhälfte: Dieselbe Weisung mit Zeilen von A geht durch.
 * Ohne Migration 178 schlagen die drei Absagen fehl, weil die einfachen
 * Schlüssel eine Zeile von B annehmen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

type Seite = { betreiber: string; versammlung: string; traktandum: string; runde: string };

let a: Seite;
let b: Seite;
let parteiA: string;

const ANLASS = { datum: '2026-12-01', uhrzeit: '19:00', ort: 'Prüfsaal' };

async function seite(name: string): Promise<Seite> {
	const betreiber = await pruefbetreiber(`Prüflauf Weisung ${name}`);
	const benutzer = await pruefbenutzer(betreiber, `pruefer-weisung-${name.toLowerCase()}`);
	const handelnder = { operatorId: betreiber, userId: benutzer, label: `Prüferin ${name}` };
	const g = await erstelleGemeinschaft(handelnder, {
		name: `Weisungsweg ${name}`,
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
	const [{ id: runde }] = await admin<{ id: string }[]>`
		INSERT INTO voting_round (operator_id, meeting_id, agenda_item_id, ordinal)
		VALUES (${betreiber}, ${versammlung}, ${traktandum}, 1)
		RETURNING id
	`;
	if (name === 'A') {
		[{ id: parteiA }] = await admin<{ id: string }[]>`
			INSERT INTO party (stweg_id, operator_id, kind, display_name, representative_name, is_community)
			VALUES (${g.id}, ${betreiber}, 'legal', 'Haus Weisungsweg A', 'Haus Weisungsweg A', false)
			RETURNING id
		`;
	}
	return { betreiber, versammlung, traktandum, runde };
}

beforeAll(async () => {
	a = await seite('A');
	b = await seite('B');
});

afterAll(verbindungenSchliessen);

const ZURUECK = 'zurückgerollt';

/**
 * Versucht eine Weisung von A aus einem Beschluss, einzelne Verweise ersetzt,
 * und rollt sie in jedem Fall zurück: Weisungen lassen sich nicht löschen
 * (AD-5), und eine stehengebliebene geltende Weisung zu Traktandum und Partei
 * stiesse den nächsten Versuch an `instruction_eine_geltende`. Geht das
 * Einfügen durch, endet der Versuch mit `ZURUECK`, sonst mit dem Fehler der
 * Datenbank.
 */
function versuch(ersatz: Partial<Pick<Seite, 'versammlung' | 'traktandum' | 'runde'>> = {}) {
	const z = { ...a, ...ersatz };
	return admin.begin(async (tx) => {
		await tx`
			INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id,
			                         stance, source_kind, source_voting_round_id)
			VALUES (${a.betreiber}, ${z.versammlung}, ${z.traktandum}, ${parteiA},
			        'ja', 'beschluss', ${z.runde})
		`;
		throw new Error(ZURUECK);
	});
}

describe('Migration 178: Weisung mit Verweis auf eine Zeile eines anderen Betreibers', () => {
	it('weist eine Versammlung von B ab', async () => {
		await expect(versuch({ versammlung: b.versammlung })).rejects.toMatchObject({
			code: '23503',
			constraint_name: 'instruction_meeting_gleicher_betreiber'
		});
	});

	it('weist ein Traktandum von B ab', async () => {
		await expect(versuch({ traktandum: b.traktandum })).rejects.toMatchObject({
			code: '23503',
			constraint_name: 'instruction_traktandum_gleicher_betreiber'
		});
	});

	it('weist eine Abstimmungsrunde von B ab', async () => {
		await expect(versuch({ runde: b.runde })).rejects.toMatchObject({
			code: '23503',
			constraint_name: 'instruction_runde_gleicher_betreiber'
		});
	});

	it('nimmt dieselbe Weisung mit Zeilen von A an (Gegenhälfte)', async () => {
		await expect(versuch()).rejects.toThrow(ZURUECK);
	});

	it('die drei Schlüssel tragen den Betreiber, die einfachen sind weg', async () => {
		const zeilen = await admin<{ name: string; def: string }[]>`
			SELECT conname AS name, pg_get_constraintdef(oid) AS def
			  FROM pg_constraint
			 WHERE conrelid = 'instruction'::regclass AND contype = 'f'
			 ORDER BY conname
		`;
		const namen = zeilen.map((z) => z.name);
		// Mit dem Betreiber, und `ON DELETE` wie in Migration 027.
		for (const [name, beimLoeschen] of [
			['instruction_meeting_gleicher_betreiber', 'ON DELETE CASCADE'],
			['instruction_traktandum_gleicher_betreiber', 'ON DELETE CASCADE'],
			['instruction_runde_gleicher_betreiber', 'ON DELETE RESTRICT']
		]) {
			const def = zeilen.find((z) => z.name === name)?.def;
			expect(def).toMatch(/, operator_id\) REFERENCES/);
			expect(def).toContain(beimLoeschen);
		}
		expect(namen).not.toContain('instruction_meeting_id_fkey');
		expect(namen).not.toContain('instruction_agenda_item_id_fkey');
		expect(namen).not.toContain('instruction_source_voting_round_id_fkey');
	});
});
