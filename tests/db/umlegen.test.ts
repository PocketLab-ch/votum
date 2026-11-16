/**
 * Angaben der gemeinsamen Versammlung auf ihre Teilnehmerinnen umlegen.
 *
 * Der Kern rechnet den Plan (`domain/umlegen.ts`), hier wird geschrieben. Was
 * nur hier prüfbar ist: dass der Weg über `bearbeiteVersammlung` läuft — also
 * mit Zustandsprüfung und Verlaufseintrag — und dass eine freigegebene
 * Versammlung wirklich stehenbleibt und nicht bloss in der Meldung fehlt.
 *
 * Anlass, 11.08.2026: «Auch sollte man dies global ändern können, damit ich
 * nicht X mal Angaben korrigieren muss, wenn der Ort oder Zeit und Datum
 * änderten.»
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung, holeVersammlung } from '$lib/server/versammlungen';
import {
	aendereVersammlungstag,
	erstelleVersammlungstag,
	holeMittagende,
	legeAngabenUm,
	nimmInTagAuf
} from '$lib/server/versammlungstag';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let hausA: string;
let hausB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function versammlung(stwegId: string, datum: string) {
	return erstelleVersammlung(handelnder(betreiber), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Halle der Proben',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
}

async function gemeinsame(datum: string) {
	return erstelleVersammlungstag(handelnder(betreiber), {
		bezeichnung: 'Prüflauf Umlegen',
		datum,
		uhrzeit: '19:00',
		ort: 'Halle der Proben'
	});
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Umlegen Prüflauf');
	for (const name of ['Umlegeweg 1', 'Umlegeweg 2']) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		if (name.endsWith('1')) hausA = g.id;
		else hausB = g.id;
	}
});

afterAll(verbindungenSchliessen);

describe('legeAngabenUm', () => {
	it('zieht Tag, Beginn, Ort und Art auf alle mittagenden nach', async () => {
		const tag = await gemeinsame('2026-09-04');
		const a = await versammlung(hausA, '2026-09-04');
		const b = await versammlung(hausB, '2026-09-04');
		await nimmInTagAuf(handelnder(betreiber), tag.id, a.id, 0);
		await nimmInTagAuf(handelnder(betreiber), tag.id, b.id, 1);

		await aendereVersammlungstag(handelnder(betreiber), tag.id, {
			bezeichnung: 'Prüflauf Umlegen',
			datum: '2026-09-18',
			uhrzeit: '18:30',
			ort: 'Gemeindesaal',
			art: 'ausserordentlich',
			anlass: 'Sanierung Steigleitungen'
		});

		const plan = await legeAngabenUm(handelnder(betreiber), tag.id);
		expect(plan.aendern).toHaveLength(2);
		expect(plan.gesperrt).toEqual([]);

		for (const id of [a.id, b.id]) {
			const v = await holeVersammlung(betreiber, id);
			expect(v?.datum).toBe('2026-09-18');
			expect(v?.uhrzeit).toBe('18:30');
			expect(v?.ort).toBe('Gemeindesaal');
			expect(v?.art).toBe('ausserordentlich');
			expect(v?.anlass).toBe('Sanierung Steigleitungen');
		}
	});

	it('schreibt je Versammlung einen Verlaufseintrag', async () => {
		// Über `bearbeiteVersammlung`, nicht mit einem eigenen UPDATE: Sonst
		// stünde im Verlauf nichts, und niemand wüsste, warum sich der Tag einer
		// Versammlung geändert hat.
		const tag = await gemeinsame('2026-10-02');
		const a = await versammlung(hausA, '2026-10-02');
		await nimmInTagAuf(handelnder(betreiber), tag.id, a.id, 0);
		await aendereVersammlungstag(handelnder(betreiber), tag.id, {
			bezeichnung: 'Prüflauf Umlegen',
			datum: '2026-10-09',
			uhrzeit: '19:00',
			ort: 'Halle der Proben'
		});
		await legeAngabenUm(handelnder(betreiber), tag.id);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry
			 WHERE subject_id = ${a.id} AND event_type = 'meeting.updated'
		`);
		expect(zeilen[0].n).toBeGreaterThan(0);
	});

	it('lässt eine Versammlung stehen, die nicht mehr im Entwurf ist', async () => {
		const tag = await gemeinsame('2026-11-06');
		const a = await versammlung(hausA, '2026-11-06');
		await nimmInTagAuf(handelnder(betreiber), tag.id, a.id, 0);

		// Ohne echte Freigabe (die verlangt Einheiten und Eigentümer): den
		// Zustand direkt setzen. **Mit Zeitstempel** — die Datenbank hält Zustand
		// und Zeitstempel zusammen (`meeting_zeitstempel`), und ohne ihn wies sie
		// dieses UPDATE zu Recht ab.
		await imKontext(
			betreiber,
			(tx) =>
				tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${a.id}`
		);

		await aendereVersammlungstag(handelnder(betreiber), tag.id, {
			bezeichnung: 'Prüflauf Umlegen',
			datum: '2026-11-20',
			uhrzeit: '19:00',
			ort: 'Halle der Proben'
		});
		const plan = await legeAngabenUm(handelnder(betreiber), tag.id);

		expect(plan.aendern).toEqual([]);
		expect(plan.gesperrt).toHaveLength(1);
		expect((await holeVersammlung(betreiber, a.id))?.datum).toBe('2026-11-06');
	});

	it('tut nichts, wenn schon alles übereinstimmt', async () => {
		const tag = await gemeinsame('2026-12-04');
		const a = await versammlung(hausA, '2026-12-04');
		await nimmInTagAuf(handelnder(betreiber), tag.id, a.id, 0);

		const plan = await legeAngabenUm(handelnder(betreiber), tag.id);
		expect(plan.aendern).toEqual([]);
		expect(plan.unveraendert).toHaveLength(1);
	});

	it('hält die Art der gemeinsamen Versammlung fest', async () => {
		const tag = await gemeinsame('2027-01-15');
		await aendereVersammlungstag(handelnder(betreiber), tag.id, {
			bezeichnung: 'Prüflauf Umlegen',
			datum: '2027-01-15',
			uhrzeit: '19:00',
			ort: 'Halle der Proben',
			art: 'ausserordentlich',
			anlass: 'Dachsanierung'
		});
		const mittagende = await holeMittagende(betreiber, tag.id);
		expect(mittagende).toEqual([]);
	});

	it('weist eine ausserordentliche ohne Anlass ab', async () => {
		const tag = await gemeinsame('2027-02-19');
		await expect(
			aendereVersammlungstag(handelnder(betreiber), tag.id, {
				bezeichnung: 'Prüflauf Umlegen',
				datum: '2027-02-19',
				uhrzeit: '19:00',
				ort: 'Halle der Proben',
				art: 'ausserordentlich',
				anlass: ''
			})
		).rejects.toThrow(/Anlass/);
	});
});
