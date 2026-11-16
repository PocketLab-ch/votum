/**
 * Die Einberufungsfrist am lebenden Bestand (Migration 098).
 *
 * Zwei Fragen, die der Kern nicht beantworten kann:
 *
 * **Bleibt sie stehen?** Sie hängt an `stweg`, und dieselbe Zeile schreibt das
 * Angabenformular der Gemeinschaft — ohne diese beiden Felder. Genau daran ist
 * in dieser Anwendung schon einmal eine Einstellung stillschweigend verlorenn
 * gegangen, weshalb jenes Formular seine versteckten Felder trägt. Hier wird
 * gemessen statt vertraut.
 *
 * **Steht sie im Verlauf?** Im Anfechtungsfall zählt, welche Frist zur Zeit der
 * Einberufung galt. Ohne Eintrag liesse sich das später nicht mehr sagen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearbeiteGemeinschaft, erstelleGemeinschaft, holeGemeinschaft } from '$lib/server/gemeinschaften';
import { speichereEinberufungsfrist } from '$lib/server/reglement';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Frist-Prüflauf');
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

describe('Die Einberufungsfrist', () => {
	it('ist bei einer neuen Gemeinschaft nicht hinterlegt', async () => {
		const g = await gemeinschaft('Frist offen');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.einberufungsfristTage).toBeNull();
		expect(gelesen?.einberufungsfristFundstelle).toBeNull();
	});

	it('wird mit Fundstelle gespeichert und wieder gelesen', async () => {
		const g = await gemeinschaft('Frist 30');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, 30, 'Reglement Ziff. 12.3');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.einberufungsfristTage).toBe(30);
		expect(gelesen?.einberufungsfristFundstelle).toBe('Reglement Ziff. 12.3');
	});

	it('lässt sich wieder herausnehmen — samt Fundstelle', async () => {
		const g = await gemeinschaft('Frist zurück');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, 20, 'Reglement Ziff. 8');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, null, null);
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.einberufungsfristTage).toBeNull();
		expect(gelesen?.einberufungsfristFundstelle).toBeNull();
	});

	it('weist die Zahl ohne Fundstelle ab', async () => {
		const g = await gemeinschaft('Frist ohne Beleg');
		await expect(
			speichereEinberufungsfrist(handelnder(betreiber), g.id, 30, '')
		).rejects.toThrow(FachlicherFehler);
		expect((await holeGemeinschaft(betreiber, g.id))?.einberufungsfristTage).toBeNull();
	});

	/*
	 * **Der Wächter gegen den zweiten Schreiber.** Ohne ihn fiele erst im Betrieb
	 * auf, dass eine Berichtigung der Anschrift die Frist mitnimmt — und zwar
	 * dann, wenn die Erinnerung ausbleibt.
	 */
	it('überlebt ein Speichern der Angaben, das sie gar nicht kennt', async () => {
		const g = await gemeinschaft('Frist neben Angaben');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, 30, 'Reglement Ziff. 12.3');

		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'Frist neben Angaben',
			strasse: 'Neue Gasse 4',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.strasse).toBe('Neue Gasse 4');
		expect(gelesen?.einberufungsfristTage).toBe(30);
		expect(gelesen?.einberufungsfristFundstelle).toBe('Reglement Ziff. 12.3');
	});

	it('steht mit der vorherigen Frist im Verlauf', async () => {
		const g = await gemeinschaft('Frist im Verlauf');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, 20, 'Reglement Ziff. 8');
		await speichereEinberufungsfrist(handelnder(betreiber), g.id, 30, 'Reglement Ziff. 12.3');

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<{ detail: { vorher: number | null; tage: number } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.einberufungsfristGesetzt}
				 ORDER BY id
			`;
		});

		expect(zeilen.map((z) => [z.detail.vorher, z.detail.tage])).toEqual([
			[null, 20],
			[20, 30]
		]);
	});
});
