/**
 * Die Reglementsfrist zur zweiten Versammlung am lebenden Bestand
 * (Migration 122, Produktentscheid 24.09.2026).
 *
 * Drei Fragen, die der Kern nicht beantworten kann:
 *
 * **Hält die Richtung auch unter der Datenbank?** Der Kern weist eine kürzere
 * Frist ab. Eine Sperre, die nur am Eingang steht, deckt den Bestand nicht
 * (AD-6) — deshalb trägt `stweg` denselben CHECK, und hier wird er gemessen
 * statt angenommen.
 *
 * **Bleibt sie stehen?** Sie hängt an `stweg`, und dieselbe Zeile schreibt das
 * Angabenformular der Gemeinschaft, ohne diese beiden Felder. Genau daran ist
 * hier schon eine Einstellung stillschweigend verlorengegangen.
 *
 * **Wirkt sie auf den Vermerk?** Das ist der Zweck der Übung: Ohne Wirkung auf
 * `interval_note` wäre die Frist eine Angabe, die niemand liest.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bearbeiteGemeinschaft,
	erstelleGemeinschaft,
	holeGemeinschaft
} from '$lib/server/gemeinschaften';
import { laengsteZweitfrist, speichereZweitversammlungsfrist } from '$lib/server/reglement';
import { erstelleVersammlung, holeVersammlung } from '$lib/server/versammlungen';
import { FachlicherFehler } from '$lib/domain/fehler';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zweitfrist-Prüflauf');
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

describe('Die Frist zur zweiten Versammlung', () => {
	it('ist bei einer neuen Gemeinschaft nicht hinterlegt', async () => {
		const g = await gemeinschaft('Zweitfrist offen');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.zweitversammlungsfristTage).toBeNull();
		expect(gelesen?.zweitversammlungsfristFundstelle).toBeNull();
	});

	it('wird mit Fundstelle gespeichert und wieder gelesen', async () => {
		const g = await gemeinschaft('Zweitfrist 20');
		await speichereZweitversammlungsfrist(handelnder(betreiber), g.id, 20, 'Reglement Ziff. 14.2');
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.zweitversammlungsfristTage).toBe(20);
		expect(gelesen?.zweitversammlungsfristFundstelle).toBe('Reglement Ziff. 14.2');
	});

	it('weist eine kürzere Frist als die gesetzliche ab', async () => {
		const g = await gemeinschaft('Zweitfrist zu kurz');
		await expect(
			speichereZweitversammlungsfrist(handelnder(betreiber), g.id, 5, 'Ziff. 14.2')
		).rejects.toBeInstanceOf(FachlicherFehler);
	});

	/*
	 * **Der Kern ist nicht der einzige Weg in die Spalte.** Diese Probe geht an
	 * ihm vorbei und schreibt unmittelbar. Fiele der CHECK weg, stünde hier eine
	 * Frist von fünf Tagen im Bestand, und `geltendeZweitfrist` müsste sie allein
	 * abfangen.
	 */
	it('lässt die Datenbank keine kürzere Frist zu, auch am Kern vorbei', async () => {
		const g = await gemeinschaft('Zweitfrist am Kern vorbei');
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE stweg SET second_meeting_interval_days = 5,
				                 second_meeting_interval_source = 'Ziff. 14.2'
				WHERE id = ${g.id}
			`)
		).rejects.toThrow(/stweg_zweitversammlungsfrist/);
	});

	it('überlebt das Angabenformular der Gemeinschaft', async () => {
		const g = await gemeinschaft('Zweitfrist bleibt');
		await speichereZweitversammlungsfrist(handelnder(betreiber), g.id, 20, 'Ziff. 14.2');
		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'Zweitfrist bleibt, neue Anschrift',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.zweitversammlungsfristTage).toBe(20);
	});

	it('schreibt den Fristvermerk nach der Frist des Reglements', async () => {
		const g = await gemeinschaft('Zweitfrist wirkt');
		await speichereZweitversammlungsfrist(handelnder(betreiber), g.id, 20, 'Ziff. 14.2');

		const erste = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-10-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});

		// Der zwölfte Oktober wäre nach Gesetz zulässig, nach diesem Reglement nicht.
		const zweite = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-10-12',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'zweite',
			betriebsart: 'einfach',
			vorgaengerId: erste.id
		});

		const gelesen = await holeVersammlung(betreiber, zweite.id);
		expect(gelesen?.fristvermerk).toMatch(/Nach dem Reglement Ihrer Gemeinschaft \(Ziff\. 14\.2\)/);
		expect(gelesen?.fristvermerk).toMatch(/22\. Oktober 2026/);
	});

	it('nimmt über mehrere Häuser die längste Frist', async () => {
		const a = await gemeinschaft('Haus A ohne Frist');
		const b = await gemeinschaft('Haus B mit 20');
		await speichereZweitversammlungsfrist(handelnder(betreiber), b.id, 20, 'Ziff. 14.2');
		expect(await laengsteZweitfrist(betreiber, [a.id, b.id])).toBe(20);
		expect(await laengsteZweitfrist(betreiber, [a.id])).toBeNull();
		expect(await laengsteZweitfrist(betreiber, [])).toBeNull();
	});
});
