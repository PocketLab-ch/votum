/**
 * Die Schranke des Reglements über seine eigene Änderung (Migration 101).
 *
 * **Der Fall war da, die Dauerhaftigkeit fehlte.** `k-reglement-eigene-schranke`
 * steht seit je im Regelwerk; nur musste die Frage bei jedem Traktandum neu
 * beantwortet werden. Gemessen wird hier, dass die Angabe hält — auch gegen den
 * zweiten Schreiber, der dieselbe Zeile ohne sie speichert.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bearbeiteGemeinschaft,
	erstelleGemeinschaft,
	holeGemeinschaft
} from '$lib/server/gemeinschaften';
import { speichereAenderungsschranke } from '$lib/server/reglement';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Reglementsschranke');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

describe('Die Schranke über die eigene Änderung', () => {
	it('gilt bei einer neuen Gemeinschaft nicht', async () => {
		const g = await gemeinschaft('Schranke offen');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.aenderungsschranke).toBe(false);
		expect(gelesen?.aenderungsschrankeFundstelle).toBeNull();
	});

	it('wird mit Fundstelle gespeichert und wieder gelesen', async () => {
		const g = await gemeinschaft('Schranke gesetzt');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, true, 'Art. 34 Abs. 2 Reglement');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.aenderungsschranke).toBe(true);
		expect(gelesen?.aenderungsschrankeFundstelle).toBe('Art. 34 Abs. 2 Reglement');
	});

	it('weist die Schranke ohne Fundstelle ab', async () => {
		const g = await gemeinschaft('Schranke ohne Beleg');
		await expect(
			speichereAenderungsschranke(handelnder(betreiber), g.id, true, '  ')
		).rejects.toThrow(FachlicherFehler);
		expect((await holeGemeinschaft(betreiber, g.id))?.aenderungsschranke).toBe(false);
	});

	it('räumt die Fundstelle weg, wenn die Schranke wegfällt', async () => {
		const g = await gemeinschaft('Schranke zurück');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, true, 'Art. 34 Reglement');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, false, 'Art. 34 Reglement');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.aenderungsschranke).toBe(false);
		expect(gelesen?.aenderungsschrankeFundstelle).toBeNull();
	});

	/*
	 * **Der Wächter gegen den zweiten Schreiber**, wie bei der Einberufungsfrist.
	 * Ginge sie beim Berichtigen der Anschrift verloren, fiele es erst auf, wenn
	 * ein Beschluss mit dem falschen Quorum gefasst wäre.
	 */
	it('überlebt ein Speichern der Angaben, das sie gar nicht kennt', async () => {
		const g = await gemeinschaft('Schranke neben Angaben');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, true, 'Art. 34 Reglement');

		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'Schranke neben Angaben',
			strasse: 'Neue Gasse 7',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.strasse).toBe('Neue Gasse 7');
		expect(gelesen?.aenderungsschranke).toBe(true);
		expect(gelesen?.aenderungsschrankeFundstelle).toBe('Art. 34 Reglement');
	});

	it('steht mit dem vorherigen Stand im Verlauf', async () => {
		const g = await gemeinschaft('Schranke im Verlauf');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, true, 'Art. 34 Reglement');
		await speichereAenderungsschranke(handelnder(betreiber), g.id, false, null);

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<{ detail: { vorher: boolean; einstimmig: boolean } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.aenderungsschrankeGesetzt}
				 ORDER BY id
			`;
		});
		expect(zeilen.map((z) => [z.detail.vorher, z.detail.einstimmig])).toEqual([
			[false, true],
			[true, false]
		]);
	});
});
