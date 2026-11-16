/**
 * Story 1.7 — Nutzniessung und Nachweis.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleNutzniessung, holeNutzniessungen } from '$lib/server/nutzniessung';
import { holeAnhangsangaben } from '$lib/server/anhaenge';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let stweg: string;
let einheit: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Nutzniessung');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Nutzniessungsweg 7',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: stweg,
		kind: 'unit',
		label: '1.1 Wohnung',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	einheit = e.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Nutzniessung erfassen', () => {
	it('nimmt Berechtigten und Beginn auf, Ende bleibt offen', async () => {
		const n = await erstelleNutzniessung(handelnder(betreiber), {
			unitId: einheit,
			holderName: 'Hedwig Berger-Stucki',
			validFrom: '2020-05-01',
			hasAgreement: false
		});
		expect(n.id).toBeTruthy();

		const gelesen = await holeNutzniessungen(betreiber, stweg);
		expect(gelesen).toHaveLength(1);
		expect(gelesen[0].holderName).toBe('Hedwig Berger-Stucki');
		expect(gelesen[0].validFrom).toBe('2020-05-01');
		expect(gelesen[0].validTo).toBeUndefined();
		expect(gelesen[0].unitLabel).toBe('1.1 Wohnung');
	});

	it('weist eine zweite Nutzniessung im selben Zeitraum ab', async () => {
		await expect(
			erstelleNutzniessung(handelnder(betreiber), {
				unitId: einheit,
				holderName: 'Zweiter Nutzniesser',
				validFrom: '2022-01-01',
				hasAgreement: false
			})
		).rejects.toThrow();
	});

	it('weist eine Vereinbarung ohne Inhalt auch in der Datenbank ab', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO usufruct (unit_id, stweg_id, operator_id, holder_name, valid_from, has_agreement)
					VALUES (${einheit}, ${stweg}, ${betreiber}, 'Ohne Inhalt', '2050-01-01', true)
				`
			)
		).rejects.toThrow();
	});
});

describe('Nachweis als Datei', () => {
	it('legt den Vertrag ab und verknüpft ihn über die Prüfsumme', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Vertragsweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: '2.1 Wohnung',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});

		// Kleinste gültige PDF-Struktur; der Inhalt ist für den Test gleichgültig,
		// die Prüfsumme nicht.
		const inhalt = new TextEncoder().encode('%PDF-1.4\nNutzniessungsvertrag\n%%EOF\n');
		const datei = new File([inhalt], 'nutzniessungsvertrag.pdf', { type: 'application/pdf' });

		await erstelleNutzniessung(
			handelnder(betreiber),
			{
				unitId: e.id,
				holderName: 'Mit Vertrag',
				validFrom: '2021-01-01',
				hasAgreement: true,
				agreementSummary: 'Das Stimmrecht verbleibt vollumfänglich bei der Eigentümerin.'
			},
			datei
		);

		const [gelesen] = await holeNutzniessungen(betreiber, g.id);
		expect(gelesen.nachweis).not.toBeNull();
		expect(gelesen.nachweis!.name).toBe('nutzniessungsvertrag.pdf');
		expect(gelesen.nachweis!.pruefsumme).toMatch(/^[0-9a-f]{64}$/);

		const anhang = await holeAnhangsangaben(betreiber, gelesen.nachweis!.pruefsumme);
		expect(anhang).toEqual({ name: 'nutzniessungsvertrag.pdf', art: 'application/pdf' });
	});

	it('weist eine Dateiart ab, die nicht vorgesehen ist', async () => {
		// Seit Story 3.4 entscheidet der Inhalt, nicht die Angabe im Formular. Die
		// Meldung nennt deshalb beides — was zugelassen ist und was behauptet wurde.
		const datei = new File([new TextEncoder().encode('#!/bin/sh\n')], 'skript.sh', {
			type: 'application/x-sh'
		});
		await expect(
			erstelleNutzniessung(
				handelnder(betreiber),
				{
					unitId: einheit,
					holderName: 'Mit Skript',
					validFrom: '2060-01-01',
					hasAgreement: false
				},
				datei
			)
		).rejects.toThrow(/Inhalt, nicht die Angabe/);
	});

	it('weist eine als PDF ausgegebene ausführbare Datei ab', async () => {
		// Die Endung .pdf und der Typ application/pdf sind beide vom Absender
		// gesetzt. Ohne Prüfung des Inhalts käme diese Datei durch.
		const datei = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x41])], 'vertrag.pdf', {
			type: 'application/pdf'
		});
		await expect(
			erstelleNutzniessung(
				handelnder(betreiber),
				{
					unitId: einheit,
					holderName: 'Mit Programm',
					validFrom: '2061-01-01',
					hasAgreement: false
				},
				datei
			)
		).rejects.toThrow(/ausführbares Programm/);
	});
});

describe('Anhänge sind Nachweise (AD-5)', () => {
	it('lassen sich nicht nachträglich austauschen', async () => {
		// Wer sie ändern könnte, könnte auch einen Beschluss anders begründen, als
		// er gefasst wurde.
		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`SELECT id FROM attachment LIMIT 1`
		);
		expect(zeile).toBeDefined();

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE attachment SET checksum = ${'b'.repeat(64)} WHERE id = ${zeile.id}`
			)
		).rejects.toThrow();
	});
});
