/**
 * Story 3.9 — Historie und Suche in der Datenbank.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { holeHistorie, sucheInGeschaeften, sucheNachsichtig } from '$lib/server/historie';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;
let stweg: string;
let fremdeStweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function versammlung(operatorId: string, stwegId: string, datum: string) {
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	return v.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Historie A');
	betreiberB = await pruefbetreiber('Historie B');

	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Historienweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;

	const f = await erstelleGemeinschaft(handelnder(betreiberB), {
		name: 'Fremdweg 4',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	fremdeStweg = f.id;

	const alt = await versammlung(betreiber, stweg, '2024-09-15');
	await erstelleTraktandum(handelnder(betreiber), {
		meetingId: alt,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte der Meier AG saniert.',
		kurzfassung: 'Die Fassade des Hauses wird erneuert.',
		antragstellerart: 'bewirtschaftung'
	});
	await erstelleTraktandum(handelnder(betreiber), {
		meetingId: alt,
		titel: 'Zufahrt Grundstück Petrović',
		art: 'abstimmung',
		antragswortlaut: 'Die Zufahrt wird instand gestellt.',
		antragstellerart: 'bewirtschaftung'
	});

	const neuer = await versammlung(betreiber, stweg, '2025-09-15');
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: neuer,
		titel: 'Ersatz der Heizung',
		art: 'abstimmung',
		antragswortlaut: 'Die Heizung wird durch eine Wärmepumpe ersetzt.',
		inhalt: 'Die bestehende Ölheizung stammt aus dem Jahr 1998 und ist am Ende ihrer Lebensdauer.',
		antragstellerart: 'bewirtschaftung'
	});
	await imKontext(betreiber, (tx) => tx`
		UPDATE agenda_item SET
			requirement_version = '2026-07-30',
			requirement_type = 'qualifiziertes_mehr',
			requirement_title = 'Qualifiziertes Mehr',
			requirement_legal_basis = 'ZGB Art. 647d Abs. 1'
		WHERE id = ${t.id}
	`);

	// Ein gleichnamiges Geschäft bei einem fremden Betreiber.
	const fremdeV = await versammlung(betreiberB, fremdeStweg, '2024-10-01');
	await erstelleTraktandum(handelnder(betreiberB), {
		meetingId: fremdeV,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Auch hier die Fassade.',
		antragstellerart: 'bewirtschaftung'
	});
});

afterAll(verbindungenSchliessen);

describe('Historie', () => {
	it('gibt die Versammlungen chronologisch, neueste zuerst', async () => {
		const h = await holeHistorie(betreiber, stweg);
		expect(h.map((v) => v.datum)).toEqual(['2025-09-15', '2024-09-15']);
	});

	it('zählt Traktanden und Abstimmungen', async () => {
		const h = await holeHistorie(betreiber, stweg);
		const alt = h.find((v) => v.datum === '2024-09-15');
		// Zwei eigene plus die festen Traktanden der ausserordentlichen Versammlung.
		expect(alt?.anzahlTraktanden).toBeGreaterThanOrEqual(2);
		expect(alt?.anzahlAbstimmungen).toBeGreaterThanOrEqual(2);
	});

	it('führt Beschlüsse als «noch nicht geführt», nicht als null Stück', async () => {
		// Eine Null stünde für eine durchgeführte Versammlung wie «es wurde nichts
		// beschlossen» — und das wäre eine Falschaussage.
		const h = await holeHistorie(betreiber, stweg);
		expect(h.every((v) => v.anzahlBeschluesse === null)).toBe(true);
	});

	it('zeigt einem fremden Betreiber nichts', async () => {
		expect(await holeHistorie(betreiberB, stweg)).toHaveLength(0);
	});
});

describe('Suche', () => {
	it('findet über Titel, Wortlaut, Kurzfassung und Inhalt', async () => {
		const t = await sucheInGeschaeften(betreiber, 'Fassade', stweg);
		expect(t).toHaveLength(1);
		expect(t[0].fundstellen.map((f) => f.feld).sort()).toEqual([
			'antragswortlaut',
			'kurzfassung',
			'titel'
		]);
	});

	it('findet auch tief im Inhalt', async () => {
		const t = await sucheInGeschaeften(betreiber, 'Ölheizung', stweg);
		expect(t[0].fundstellen[0].feld).toBe('inhalt');
		expect(t[0].fundstellen[0].auszug).toMatch(/1998/);
	});

	it('gibt das angewandte Mehrheitserfordernis mit', async () => {
		const t = await sucheInGeschaeften(betreiber, 'Wärmepumpe', stweg);
		expect(t[0].erfordernisTitel).toBe('Qualifiziertes Mehr');
		expect(t[0].erfordernisGrundlage).toBe('ZGB Art. 647d Abs. 1');
		expect(t[0].erfordernisFassung).toBe('2026-07-30');
	});

	it('ignoriert Gross- und Kleinschreibung', async () => {
		expect(await sucheInGeschaeften(betreiber, 'FASSADE', stweg)).toHaveLength(1);
		expect(await sucheInGeschaeften(betreiber, 'fassade', stweg)).toHaveLength(1);
	});

	it('findet einen Namen auch ohne Häkchen', async () => {
		// `ILIKE` vergleicht Zeichen für Zeichen und findet «Petrović» nicht, wenn
		// man «Petrovic» tippt. Der nachsichtige Weg springt genau dann ein.
		expect(await sucheInGeschaeften(betreiber, 'Petrovic', stweg)).toHaveLength(0);
		const t = await sucheNachsichtig(betreiber, 'Petrovic', stweg);
		expect(t).toHaveLength(1);
		expect(t[0].titel).toMatch(/Petrović/);
	});

	it('nimmt den nachsichtigen Weg nur, wenn die schnelle Suche leer ausgeht', async () => {
		const t = await sucheNachsichtig(betreiber, 'Fassade', stweg);
		expect(t).toHaveLength(1);
	});

	it('sortiert die neueste Versammlung nach oben', async () => {
		const t = await sucheInGeschaeften(betreiber, 'die', stweg);
		expect(t.length).toBeGreaterThan(1);
		const daten = t.map((x) => x.versammlungDatum);
		expect([...daten].sort().reverse()).toEqual(daten);
	});

	it('weist einen zu kurzen Suchbegriff ab', async () => {
		expect(await sucheInGeschaeften(betreiber, 'ab', stweg)).toEqual([]);
	});

	it('behandelt Prozentzeichen als Text, nicht als Platzhalter', async () => {
		// Sonst fände «%» jedes Traktandum, und «_» jedes mit mindestens einem
		// Zeichen — der Suchende hielte das für einen Fehler des Werkzeugs.
		expect(await sucheInGeschaeften(betreiber, '%%%', stweg)).toEqual([]);
	});

	it('findet nichts über die Gemeinschaftsgrenze hinweg', async () => {
		const t = await sucheInGeschaeften(betreiber, 'Fassade', stweg);
		expect(t.every((x) => x.gemeinschaftName === 'Historienweg 1')).toBe(true);
	});

	it('zeigt einem fremden Betreiber kein gleichnamiges Geschäft', async () => {
		// Beide Betreiber haben ein Traktandum «Sanierung der Fassade».
		const meins = await sucheInGeschaeften(betreiber, 'Fassade');
		const fremdes = await sucheInGeschaeften(betreiberB, 'Fassade');
		expect(meins).toHaveLength(1);
		expect(fremdes).toHaveLength(1);
		expect(meins[0].traktandumId).not.toBe(fremdes[0].traktandumId);
	});
});
