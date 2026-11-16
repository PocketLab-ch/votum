/**
 * Migration 191: L4 nach dem Gesetz (Entscheid 0048, Block B, Kriterium 5).
 *
 * **Wie gemessen wird.** Die Prüfdatenbank ist frisch migriert; Gemeinschaften
 * aus der Zeit vor 191 gibt es dort nicht. Die Probe legt deshalb Gemeinschaften
 * an, wie sie vor 191 dastanden: auf «einfach» ohne Eintrag (nur die alte
 * Vorgabe), auf «einfach» mit eigenem Eintrag zu L4, auf «einfach» mit einem
 * Eintrag nur zu einer anderen Lesart, und eine mit einer freigegebenen
 * Versammlung auf «einfach». Dann fährt sie die Migrationsdatei ein zweites Mal,
 * in einer Transaktion, die sie danach verwirft: Die Änderung an der Spalte ist
 * wiederholbar, und was die Datei an den Daten tut, ist genau das, was sie
 * beim Ausrollen auf einer gewachsenen Datenbank tut. Verworfen wird, damit die
 * übrigen Prüfdateien desselben Laufs nichts davon sehen.
 *
 * Die neue Gemeinschaft misst die Vorgabe, die der erste Lauf der Datei gesetzt
 * hat. Gemeinschaften und Namen sind erfunden.
 */
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { erstelleTraktandum, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import { holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { lesartVon } from '$lib/domain/lesarten';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L4 nach Gesetz');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	return g.id;
}

/** Wie eine Gemeinschaft vor 191 dastand, die L4 nie angefasst hat: «einfach» ohne Eintrag. */
async function aufAlterVorgabe(stwegId: string): Promise<void> {
	await admin`UPDATE stweg SET reading_l4 = 'einfach' WHERE id = ${stwegId}`;
}

/** Eine freigegebene Versammlung mit einem Traktandum ohne Lesart; friert L4 in der Momentaufnahme ein. */
async function freigegeben(stwegId: string): Promise<string> {
	for (const [nummer, quote] of [400, 600].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe'][nummer],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId,
		datum: '2027-12-12',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Bewirtschaftung abberufen',
		art: 'abstimmung',
		antragswortlaut: 'Die Bewirtschaftung Muster Verwaltungen wird abberufen.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(handelnder(betreiber), { meetingId: v.id, stwegId }, t.id, 'k-bewirtschaftung-abberufen', null);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	return v.id;
}

/** Fährt die Migrationsdatei in einer Transaktion, prüft darin und verwirft sie. */
class Verwerfen extends Error {}
async function migrationProbe(pruefe: (tx: typeof admin) => Promise<void>): Promise<void> {
	const inhalt = await readFile(new URL('../../migrations/191_l4_nach_gesetz.sql', import.meta.url), 'utf8');
	await expect(
		admin.begin(async (tx) => {
			await tx.unsafe(inhalt);
			await pruefe(tx as unknown as typeof admin);
			throw new Verwerfen();
		})
	).rejects.toBeInstanceOf(Verwerfen);
}

type L4Zeile = { reading_l4: string };
type Eintrag = { actor_label: string; actor_user_id: string | null; operator_id: string; detail: Record<string, unknown> };

async function l4(tx: typeof admin, id: string): Promise<string> {
	const [z] = await tx<L4Zeile[]>`SELECT reading_l4 FROM stweg WHERE id = ${id}`;
	return z.reading_l4;
}
async function eintraegeL4(tx: typeof admin, id: string): Promise<Eintrag[]> {
	return tx<Eintrag[]>`
		SELECT actor_label, actor_user_id, operator_id, detail
		  FROM audit_entry
		 WHERE subject_type = 'stweg' AND subject_id = ${id}
		   AND event_type = ${EREIGNISARTEN.lesartGesetzt} AND detail->>'lesart' = 'L4'
		 ORDER BY id
	`;
}

describe('Migration 191 (Kriterium 5)', () => {
	it('eine neue Gemeinschaft bekommt «qualifiziert»; die Spalte trägt die neue Vorgabe', async () => {
		const g = await gemeinschaft('L4 neu');
		expect((await holeLesarteneinstellung(betreiber, g)).wahl.L4).toBe('qualifiziert');
		const [s] = await admin<{ column_default: string }[]>`
			SELECT column_default FROM information_schema.columns
			 WHERE table_name = 'stweg' AND column_name = 'reading_l4'
		`;
		expect(s.column_default).toMatch(/^'qualifiziert'/);
		const [k] = await admin<{ kommentar: string }[]>`
			SELECT col_description('stweg'::regclass, attnum) AS kommentar
			  FROM pg_attribute WHERE attrelid = 'stweg'::regclass AND attname = 'reading_l4'
		`;
		expect(k.kommentar).toMatch(/qualifiziert \(Vorgabe nach Gesetz, ZGB Art\. 647b Abs\. 1; Entscheid 0048, Migration 191\)/);
	});

	it('zieht nach, wer nie gewählt hat, mit Eintrag; wer L4 selbst gesetzt hat, bleibt; Momentaufnahmen bleiben', async () => {
		// Nie gewählt: «einfach» nur, weil das die Vorgabe war.
		const nie = await gemeinschaft('L4 nie gewählt');
		await aufAlterVorgabe(nie);
		// Selbst auf «einfach» gestellt: ein eigener Eintrag zu L4.
		const selbst = await gemeinschaft('L4 selbst einfach');
		await speichereLesarten(handelnder(betreiber), 'admin', selbst, { L4: 'einfach' });
		// Auf der alten Vorgabe, aber ein Eintrag zu einer anderen Lesart.
		const andere = await gemeinschaft('L4 nie, L2 umgestellt');
		await aufAlterVorgabe(andere);
		await speichereLesarten(handelnder(betreiber), 'admin', andere, { L2: 'qualifiziert' });
		// Auf der alten Vorgabe mit einer freigegebenen Versammlung.
		const mitFreigabe = await gemeinschaft('L4 nie, mit Freigabe');
		await aufAlterVorgabe(mitFreigabe);
		const versammlung = await freigegeben(mitFreigabe);
		expect((await holeMomentaufnahme(betreiber, versammlung))?.lesarten?.L4).toBe('einfach');
		// Auf «qualifiziert»: bleibt ohne Eintrag.
		const schonQualifiziert = await gemeinschaft('L4 qualifiziert');

		const vorher = {
			selbst: (await eintraegeL4(admin, selbst)).length,
			andere: (await eintraegeL4(admin, andere)).length,
			nie: (await eintraegeL4(admin, nie)).length
		};
		expect(vorher).toEqual({ selbst: 1, andere: 0, nie: 0 });

		await migrationProbe(async (tx) => {
			for (const id of [nie, andere, mitFreigabe]) {
				expect(await l4(tx, id), id).toBe('qualifiziert');
				const e = await eintraegeL4(tx, id);
				expect(e, id).toHaveLength(1);
				expect(e[0]).toMatchObject({
					actor_label: 'Votum, neue Vorgabe',
					actor_user_id: null,
					operator_id: betreiber,
					detail: {
						lesart: 'L4',
						frage: lesartVon('L4')!.frage,
						vorher: 'Einfaches Mehr',
						nachher: 'Qualifiziertes Mehr (Vorgabe)'
					}
				});
				expect(String(e[0].detail.grund)).toMatch(/Art\. 647b Abs\. 1 ZGB nach seinem Wortlaut verlangt\. Ob das im Stockwerkeigentum nötig ist, ist umstritten\./);
			}
			expect(await l4(tx, selbst)).toBe('einfach');
			expect(await eintraegeL4(tx, selbst)).toHaveLength(1);
			expect(await l4(tx, schonQualifiziert)).toBe('qualifiziert');
			expect(await eintraegeL4(tx, schonQualifiziert)).toHaveLength(0);
			// Freigegebenes rechnet nach seiner Momentaufnahme.
			const [m] = await tx<L4Zeile[]>`SELECT reading_l4 FROM snapshot WHERE meeting_id = ${versammlung}`;
			expect(m.reading_l4).toBe('einfach');
		});

		// Verworfen: Die übrigen Prüfdateien sehen nichts davon.
		expect(await l4(admin, nie)).toBe('einfach');
		expect(await eintraegeL4(admin, nie)).toHaveLength(0);
	});
});
