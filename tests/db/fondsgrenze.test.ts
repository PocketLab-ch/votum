/**
 * Die Bestimmung zur Einlage in den Erneuerungsfonds am lebenden Bestand
 * (Migration 193; Auftrag «Erneuerungsfonds im Regelwerk», Kriterium 4).
 *
 * Dieselben Fragen wie bei der Einberufungsfrist: Bleibt sie neben dem
 * Angabenformular stehen, steht sie im Verlauf, und hält die Datenbank die
 * Fundstelle auch dann, wenn jemand am Kern vorbei schreibt?
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearbeiteGemeinschaft, erstelleGemeinschaft, holeGemeinschaft } from '$lib/server/gemeinschaften';
import { speichereFondsgrenze } from '$lib/server/reglement';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Fondsgrenze-Prüflauf');
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

/** Ein erfundener Wortlaut, kein Reglement aus dem Bestand. */
const WORTLAUT = 'Die Einlage darf 0.25 Prozent des Versicherungswerts nicht übersteigen.';

describe('Die Bestimmung zum Erneuerungsfonds', () => {
	it('ist bei einer neuen Gemeinschaft nicht hinterlegt', async () => {
		const g = await gemeinschaft('Fonds offen');
		expect((await holeGemeinschaft(betreiber, g.id))?.fondsgrenze).toBeNull();
	});

	it('wird mit Art, Wortlaut und Fundstelle gespeichert und wieder gelesen', async () => {
		const g = await gemeinschaft('Fonds fest');
		await speichereFondsgrenze(handelnder(betreiber), g.id, 'fest', WORTLAUT, 'Reglement Ziff. 9.2');
		expect((await holeGemeinschaft(betreiber, g.id))?.fondsgrenze).toEqual({
			art: 'fest',
			wortlaut: WORTLAUT,
			fundstelle: 'Reglement Ziff. 9.2'
		});
	});

	it('lässt sich wieder herausnehmen, samt Wortlaut und Fundstelle', async () => {
		const g = await gemeinschaft('Fonds zurück');
		await speichereFondsgrenze(handelnder(betreiber), g.id, 'in_der_regel', WORTLAUT, 'Reglement Ziff. 9.2');
		await speichereFondsgrenze(handelnder(betreiber), g.id, null, WORTLAUT, 'Reglement Ziff. 9.2');
		expect((await holeGemeinschaft(betreiber, g.id))?.fondsgrenze).toBeNull();
		const [zeile] = await imKontext(betreiber, (tx) => tx<{ t: string | null; q: string | null }[]>`
			SELECT renewal_fund_limit_text AS t, renewal_fund_limit_source AS q FROM stweg WHERE id = ${g.id}
		`);
		expect(zeile).toEqual({ t: null, q: null });
	});

	it('weist die Bestimmung ohne Fundstelle oder ohne Wortlaut ab', async () => {
		const g = await gemeinschaft('Fonds ohne Beleg');
		await expect(speichereFondsgrenze(handelnder(betreiber), g.id, 'fest', WORTLAUT, '')).rejects.toThrow(
			FachlicherFehler
		);
		await expect(speichereFondsgrenze(handelnder(betreiber), g.id, 'fest', '', 'Ziff. 9')).rejects.toThrow(
			FachlicherFehler
		);
		expect((await holeGemeinschaft(betreiber, g.id))?.fondsgrenze).toBeNull();
	});

	it('hält die Datenbank ganz oder gar nicht, auch am Kern vorbei', async () => {
		const g = await gemeinschaft('Fonds an der Datenbank');
		for (const [art, text, quelle] of [
			['fest', WORTLAUT, null],
			['fest', null, 'Ziff. 9'],
			[null, WORTLAUT, 'Ziff. 9'],
			['gross', WORTLAUT, 'Ziff. 9']
		]) {
			await expect(
				imKontext(betreiber, (tx) => tx`
					UPDATE stweg SET renewal_fund_limit_kind = ${art}, renewal_fund_limit_text = ${text},
					       renewal_fund_limit_source = ${quelle}
					 WHERE id = ${g.id}
				`),
				`${art} ${text} ${quelle}`
			).rejects.toThrow(/stweg_fondsgrenze/);
		}
	});

	it('lässt einen fremden Betreiber nicht schreiben (Featureprüfung B6)', async () => {
		const g = await gemeinschaft('Fonds fremd');
		const fremder = await pruefbetreiber('Fondsgrenze-Fremd');
		// Ein eigener Benutzer des fremden Betreibers, damit nur die Zeilensperre absagt (Codeprüfung N3).
		const fremderBenutzer = await pruefbenutzer(fremder, 'Prüflauf fremd');
		await expect(
			speichereFondsgrenze(
				{ operatorId: fremder, userId: fremderBenutzer, label: 'Prüflauf' },
				g.id,
				'fest',
				WORTLAUT,
				'Reglement Ziff. 9.2'
			)
		).rejects.toThrow(FachlicherFehler);
		expect((await holeGemeinschaft(betreiber, g.id))?.fondsgrenze).toBeNull();
	});

	it('überlebt ein Speichern der Angaben, das sie gar nicht kennt', async () => {
		const g = await gemeinschaft('Fonds neben Angaben');
		await speichereFondsgrenze(handelnder(betreiber), g.id, 'hoehe_fest', 'Die Einlage beträgt 0.5 Prozent.', 'Ziff. 9');
		await bearbeiteGemeinschaft(handelnder(betreiber), g.id, {
			name: 'Fonds neben Angaben',
			strasse: 'Neue Gasse 4',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const gelesen = await holeGemeinschaft(betreiber, g.id);
		expect(gelesen?.strasse).toBe('Neue Gasse 4');
		expect(gelesen?.fondsgrenze?.art).toBe('hoehe_fest');
	});

	it('steht mit der vorherigen Art im Verlauf', async () => {
		const g = await gemeinschaft('Fonds im Verlauf');
		await speichereFondsgrenze(handelnder(betreiber), g.id, 'fest', WORTLAUT, 'Ziff. 9');
		await speichereFondsgrenze(handelnder(betreiber), g.id, 'in_der_regel', WORTLAUT, 'Ziff. 9');
		await speichereFondsgrenze(handelnder(betreiber), g.id, null, null, null);
		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ detail: { fondsgrenzenartVorher: string | null; fondsgrenzenart: string | null } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id}
				   AND event_type = ${EREIGNISARTEN.fondsgrenzeGesetzt}
				 ORDER BY id
			`
		);
		expect(zeilen.map((z) => [z.detail.fondsgrenzenartVorher, z.detail.fondsgrenzenart])).toEqual([
			[null, 'fest'],
			['fest', 'in_der_regel'],
			['in_der_regel', null]
		]);
	});
});
