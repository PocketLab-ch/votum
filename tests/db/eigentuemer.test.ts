/**
 * Story 1.6 — Eigentümer, Eigentum und Stimmkraft am echten Datenbestand.
 *
 * Der Kern rechnet die Stimmkraft aus einer Wertetabelle; hier wird geprüft, ob
 * die Abfrage ihm die richtigen Werte liefert — samt Gültigkeitszeitraum, denn
 * eine Auswertung zur Februar-Versammlung muss im April dieselben Zahlen zeigen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	bearbeiteEigentuemer,
	erstelleEigentuemer,
	holeEigentuemer,
	ordneEigentumZu,
	planeEigentumszuordnung,
	stimmkraftAnsicht,
	entferneZuordnung
} from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { admin, imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
/** Zählweise je Eigentümer — die gesetzliche Auffangregel. */
let stwegOwner: string;
/** Zählweise je Einheit — was in den meisten Reglementen steht. */
let stwegUnit: string;

const einheitenOwner: Record<string, string> = {};
const einheitenUnit: Record<string, string> = {};

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function baueGemeinschaft(
	name: string,
	modus: 'per_owner' | 'per_unit',
	nebenobjekteZaehlen: boolean,
	ziel: Record<string, string>
): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: modus,
		parkingCountsAsHead: nebenobjekteZaehlen,
		parentStwegId: null,
		headCountRuleSource: modus === 'per_unit' ? 'Reglement Ziff. 14.2' : undefined
	});

	const bauplan = [
		{ label: '1.1 Wohnung', kind: 'unit' as const, stamm: 300, kopf: true },
		{ label: '1.2 Wohnung', kind: 'unit' as const, stamm: 300, kopf: true },
		{ label: '2.1 Wohnung', kind: 'unit' as const, stamm: 350, kopf: true },
		{ label: 'P1 Einstellplatz', kind: 'parking' as const, stamm: 50, kopf: true }
	];

	for (const b of bauplan) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: b.kind,
			label: b.label,
			quotas: { stamm: b.stamm },
			countsAsHead: b.kopf
		});
		ziel[b.label] = e.id;
	}

	return g.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Eigentuemer');
	stwegOwner = await baueGemeinschaft('Auffangregel-Weg 1', 'per_owner', false, einheitenOwner);
	stwegUnit = await baueGemeinschaft('Reglements-Weg 2', 'per_unit', false, einheitenUnit);
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Eigentümer erfassen', () => {
	it('legt eine natürliche Person an', async () => {
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegOwner,
			kind: 'natural',
			displayName: 'Renate Berger',
			representativeName: null,
			isCommunity: false,
			email: 'renate.berger@example.ch'
		});
		expect(p.id).toBeTruthy();
		expect(p.email).toBe('renate.berger@example.ch');
	});

	/*
	 * **Die Schranke ist mit Migration 096 gefallen** (Produktentscheid
	 * 27.08.2026). Der Test steht in der Gegenrichtung weiter da: Ein Wächter,
	 * der nur die alte Fassung kannte, wäre nach dem Löschen einfach weg — und
	 * niemand sähe, dass die Zusage bewusst aufgegeben wurde.
	 */
	it('lässt gemeinschaftliches Eigentum ohne Vertreter jetzt auch in der Datenbank zu', async () => {
		await imKontext(
			betreiber,
			(tx) => tx`
				INSERT INTO party (stweg_id, operator_id, display_name, is_community)
				VALUES (${stwegOwner}, ${betreiber}, 'Erbengemeinschaft ohne Vertreter', true)
			`
		);
		const [zeile] = await admin<{ representative_name: string | null }[]>`
			SELECT representative_name FROM party
			 WHERE stweg_id = ${stwegOwner} AND display_name = 'Erbengemeinschaft ohne Vertreter'
		`;
		expect(zeile.representative_name).toBeNull();
	});

	it('weist eine juristische Person ohne Vertretung auch in der Datenbank ab', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO party (stweg_id, operator_id, kind, display_name)
					VALUES (${stwegOwner}, ${betreiber}, 'legal', 'AG ohne Vertretung')
				`
			)
		).rejects.toThrow();
	});

	it('hält eine Änderung im Verlauf fest', async () => {
		const [p] = await holeEigentuemer(betreiber, stwegOwner, 'aktiv');
		await bearbeiteEigentuemer(handelnder(betreiber), p.id, {
			...p,
			phone: '+41 79 000 00 00'
		});

		const [eintrag] = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE subject_id = ${p.id} AND event_type = 'party.updated'
				ORDER BY id DESC LIMIT 1
			`
		);
		expect(eintrag.detail.felder.phone).toEqual({ vorher: null, nachher: '+41 79 000 00 00' });
	});
});

describe('Eigentum mit Gültigkeitszeitraum', () => {
	it('verhindert zwei Eigentümer derselben Einheit zur selben Zeit', async () => {
		// Gemeinsames Eigentum wird über **eine** Partei mit `is_community`
		// abgebildet. Zwei Zeilen gäben der Einheit zwei Stimmen statt einer
		// (ZGB Art. 712o Abs. 1).
		const a = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegOwner,
			kind: 'natural',
			displayName: 'Doppel A',
			representativeName: null,
			isCommunity: false
		});
		const b = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegOwner,
			kind: 'natural',
			displayName: 'Doppel B',
			representativeName: null,
			isCommunity: false
		});

		const einheit = einheitenOwner['1.1 Wohnung'];
		await ordneEigentumZu(handelnder(betreiber), einheit, a.id, '2020-01-01');

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from)
					VALUES (${einheit}, ${b.id}, ${stwegOwner}, ${betreiber}, '2021-01-01')
				`
			)
		).rejects.toThrow();
	});

	it('beendet die laufende Zuordnung beim Wechsel, statt sie zu überschreiben', async () => {
		const einheit = einheitenOwner['1.2 Wohnung'];
		const alt = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegOwner,
			kind: 'natural',
			displayName: 'Verkäufer Meier',
			representativeName: null,
			isCommunity: false
		});
		const neu = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegOwner,
			kind: 'natural',
			displayName: 'Käufer Schmid',
			representativeName: null,
			isCommunity: false
		});

		await ordneEigentumZu(handelnder(betreiber), einheit, alt.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), einheit, neu.id, '2026-03-01');

		const zeilen = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT party_id, valid_from, valid_to FROM unit_ownership
				WHERE unit_id = ${einheit} ORDER BY valid_from
			`
		);
		expect(zeilen).toHaveLength(2);
		expect(zeilen[0].party_id).toBe(alt.id);
		expect(zeilen[0].valid_to).not.toBeNull();
		expect(zeilen[1].party_id).toBe(neu.id);
		expect(zeilen[1].valid_to).toBeNull();
	});

	it('zeigt zum früheren Stichtag den früheren Eigentümer', async () => {
		// Der Kern der Historisierung: Eine Auswertung zur Februar-Versammlung muss
		// im April dieselben Zahlen zeigen wie im Februar.
		const imFebruar = await stimmkraftAnsicht(betreiber, stwegOwner, '2026-02-01');
		const imApril = await stimmkraftAnsicht(betreiber, stwegOwner, '2026-04-01');

		const februarNamen = imFebruar.zeilen
			.filter((z) => z.einheiten.some((e) => e.label === '1.2 Wohnung'))
			.map((z) => z.displayName);
		const aprilNamen = imApril.zeilen
			.filter((z) => z.einheiten.some((e) => e.label === '1.2 Wohnung'))
			.map((z) => z.displayName);

		expect(februarNamen).toEqual(['Verkäufer Meier']);
		expect(aprilNamen).toEqual(['Käufer Schmid']);
	});

	it('weist einen Zeitraum ab, der rückwärts läuft', async () => {
		const einheit = einheitenOwner['2.1 Wohnung'];
		const [p] = await holeEigentuemer(betreiber, stwegOwner, 'aktiv');
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from, valid_to)
					VALUES (${einheit}, ${p.id}, ${stwegOwner}, ${betreiber}, '2026-05-01', '2026-01-01')
				`
			)
		).rejects.toThrow();
	});
});

describe('Stimmkraft bei der Zählweise je Eigentümer', () => {
	it('gibt einem Eigentümer mit drei Einheiten eine Kopfstimme und die Summe der Quoten', async () => {
		const stweg = await baueGemeinschaft('Dreifach-Weg', 'per_owner', false, {});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Dreifach Eigentümer',
			representativeName: null,
			isCommunity: false
		});

		const einheiten = await imKontext(
			betreiber,
			(tx) => tx<{ id: string; label: string }[]>`
				SELECT id, label FROM unit WHERE stweg_id = ${stweg} AND kind = 'unit' ORDER BY label
			`
		);
		for (const e of einheiten) {
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		}

		const ansicht = await stimmkraftAnsicht(betreiber, stweg, '2026-07-30');
		const zeile = ansicht.zeilen.find((z) => z.partyId === p.id)!;

		expect(zeile.kopfstimmen).toBe(1);
		expect(zeile.wertquote).toBe(950);
		expect(zeile.einheiten).toHaveLength(3);
	});
});

describe('Stimmkraft bei der Zählweise je Einheit', () => {
	it('gibt demselben Eigentümer drei Kopfstimmen und dieselbe Quotensumme', async () => {
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegUnit,
			kind: 'natural',
			displayName: 'Dreifach im Reglement',
			representativeName: null,
			isCommunity: false
		});

		for (const label of ['1.1 Wohnung', '1.2 Wohnung', '2.1 Wohnung']) {
			await ordneEigentumZu(handelnder(betreiber), einheitenUnit[label], p.id, '2020-01-01');
		}

		const ansicht = await stimmkraftAnsicht(betreiber, stwegUnit, '2026-07-30');
		const zeile = ansicht.zeilen.find((z) => z.partyId === p.id)!;

		expect(zeile.kopfstimmen).toBe(3);
		expect(zeile.wertquote).toBe(950);
	});

	it('lässt das Nebenobjekt aus, wenn die Gemeinschaft es nicht mitzählt', async () => {
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stwegUnit,
			kind: 'natural',
			displayName: 'Platzbesitzer',
			representativeName: null,
			isCommunity: false
		});
		await ordneEigentumZu(
			handelnder(betreiber),
			einheitenUnit['P1 Einstellplatz'],
			p.id,
			'2020-01-01'
		);

		const ansicht = await stimmkraftAnsicht(betreiber, stwegUnit, '2026-07-30');
		const zeile = ansicht.zeilen.find((z) => z.partyId === p.id)!;

		expect(zeile.kopfstimmen).toBe(0);
		expect(zeile.wertquote).toBe(50);
	});
});

describe('Gemeinschaftliches Eigentum', () => {
	it('zählt als eine Kopfstimme, mit benanntem Vertreter', async () => {
		// ZGB Art. 712o Abs. 1 — auch bei der Zählweise je Einheit.
		const stweg = await baueGemeinschaft('Erben-Weg', 'per_unit', false, {});
		const erben = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Berger',
			representativeName: 'Renate Berger',
			isCommunity: true
		});

		const [einheit] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM unit WHERE stweg_id = ${stweg} AND label = '1.1 Wohnung'
			`
		);
		await ordneEigentumZu(handelnder(betreiber), einheit.id, erben.id, '2020-01-01');

		const ansicht = await stimmkraftAnsicht(betreiber, stweg, '2026-07-30');
		const zeile = ansicht.zeilen.find((z) => z.partyId === erben.id)!;

		expect(zeile.kopfstimmen).toBe(1);
		expect(zeile.isCommunity).toBe(true);
		expect(zeile.representativeName).toBe('Renate Berger');
	});
});

describe('Einheiten ohne Eigentümer', () => {
	it('werden ausdrücklich benannt statt still übergangen', async () => {
		// Sie fehlen in jeder Zählung. Ohne diesen Hinweis ginge die Wertquotensumme
		// scheinbar auf, während ein Teil der Gemeinschaft nicht vertreten ist.
		const stweg = await baueGemeinschaft('Lueckenweg', 'per_owner', false, {});
		const ansicht = await stimmkraftAnsicht(betreiber, stweg, '2026-07-30');

		expect(ansicht.einheitenOhneEigentuemer).toHaveLength(4);
		expect(ansicht.summeWertquote).toBe(0);
	});
});

describe('Zeilenschutz je Betreiber (AD-6)', () => {
	it('zeigt Eigentümer eines fremden Betreibers nicht', async () => {
		const fremder = await pruefbetreiber('Fremder Betreiber');
		const fremdeSicht = await holeEigentuemer(fremder, stwegOwner, 'aktiv');
		expect(fremdeSicht).toHaveLength(0);
	});
});

describe('Story 1.8 — rückwirkende Korrektur und die Lücke', () => {
	it('übernimmt eine Korrektur mitten im Zeitraum und behält den früheren Stand', async () => {
		const stweg = await baueGemeinschaft('Korrektur-Weg', 'per_owner', false, {});
		const [einheit] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM unit WHERE stweg_id = ${stweg} AND label = '1.1 Wohnung'
			`
		);

		const alt = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Ursprünglich Meier',
			representativeName: null,
			isCommunity: false
		});
		const berichtigt = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Berichtigt Schmid',
			representativeName: null,
			isCommunity: false
		});

		await ordneEigentumZu(handelnder(betreiber), einheit.id, alt.id, '2020-01-01');
		// Nachträglich stellt sich heraus: Der Verkauf war schon 2023.
		await ordneEigentumZu(handelnder(betreiber), einheit.id, berichtigt.id, '2023-06-01');

		const vorher = await stimmkraftAnsicht(betreiber, stweg, '2023-01-01');
		const nachher = await stimmkraftAnsicht(betreiber, stweg, '2024-01-01');

		expect(
			vorher.zeilen.find((z) => z.einheiten.some((e) => e.label === '1.1 Wohnung'))!.displayName
		).toBe('Ursprünglich Meier');
		expect(
			nachher.zeilen.find((z) => z.einheiten.some((e) => e.label === '1.1 Wohnung'))!.displayName
		).toBe('Berichtigt Schmid');
	});

	it('weist eine Zuordnung ab, die eine Zeitspanne ohne Eigentümer erzeugte', async () => {
		// Eine Einheit ohne Eigentümer gibt es im Grundbuch nicht. Ohne diese
		// Prüfung fehlte sie in jeder Abstimmung des Zeitraums, und die
		// Wertquotensumme ginge dort nicht auf, ohne dass ersichtlich wäre, warum.
		const stweg = await baueGemeinschaft('Luecken-Weg', 'per_owner', false, {});
		const [einheit] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM unit WHERE stweg_id = ${stweg} AND label = '1.1 Wohnung'
			`
		);
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Mit Lücke davor',
			representativeName: null,
			isCommunity: false
		});

		// Erste Zuordnung endet am 01.01.2026 …
		await imKontext(
			betreiber,
			(tx) => tx`
				INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from, valid_to)
				VALUES (${einheit.id}, ${p.id}, ${stweg}, ${betreiber}, '2020-01-01', '2026-01-01')
			`
		);

		// … die neue beginnt erst am 01.03.2026: zwei Monate ohne Eigentümer.
		await expect(
			ordneEigentumZu(handelnder(betreiber), einheit.id, p.id, '2026-03-01')
		).rejects.toThrow(/nie ohne Eigentümer/);
	});

	it('kennzeichnet eine rückwirkende Korrektur im Verlauf als solche', async () => {
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE event_type = 'ownership.assigned' AND detail->>'rueckwirkend' = 'true'
				LIMIT 1
			`
		);
		expect(eintraege.length).toBeGreaterThan(0);
	});

	it('zeigt vor der Ausführung, was eine Korrektur verdrängen würde', async () => {
		// Der Fall, der ohne Vorschau am ehesten überrascht: Eine ganze Zuordnung
		// verschwindet, und nachher lässt sich nicht mehr sehen, welche.
		const stweg = await baueGemeinschaft('Vorschau-Weg', 'per_owner', false, {});
		const [einheit] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM unit WHERE stweg_id = ${stweg} AND label = '1.1 Wohnung'
			`
		);
		const a = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Vorschau A',
			representativeName: null,
			isCommunity: false
		});
		const b = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'natural',
			displayName: 'Vorschau B',
			representativeName: null,
			isCommunity: false
		});

		await ordneEigentumZu(handelnder(betreiber), einheit.id, a.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), einheit.id, b.id, '2024-01-01');

		// Korrektur zurück auf 2022 verdrängt die Zuordnung von B vollständig.
		const plan = await planeEigentumszuordnung(betreiber, einheit.id, a.id, '2022-01-01');
		expect(plan.zuEntfernen.map((e) => e.partyId)).toContain(b.id);
		expect(plan.zuBeenden.map((e) => e.partyId)).toContain(a.id);
	});
});

// ── Eine versehentliche Zuordnung tilgen ────────────────────────────────────
//
// **Der Anlass** (Prüflauf 22.08.2026, Befund A-13): Eine falsch zugeordnete
// Einheit liess sich nur durch eine zweite Zuordnung überschreiben — und dann
// steht im Protokoll ein Eigentümerwechsel, den es nie gab. Was fehlte, war der
// Unterschied zwischen «hat aufgehört» und «war nie».

describe('Eine versehentliche Zuordnung entfernen', () => {
	let eigen: string;
	let einheit: string;

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Versehenweg 5',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigen = g.id;
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: eigen,
			kind: 'unit',
			label: 'Whg mit Versehen',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		einheit = e.id;
	});

	async function partei(name: string) {
		return erstelleEigentuemer(handelnder(betreiber), {
			stwegId: eigen,
			kind: 'natural',
			displayName: name,
			representativeName: null,
			isCommunity: false
		});
	}

	async function zuordnungen() {
		return imKontext(
			betreiber,
			(tx) => tx`
				SELECT id, party_id, valid_from, valid_to FROM unit_ownership
				 WHERE unit_id = ${einheit} ORDER BY valid_from
			`
		);
	}

	it('tilgt die jüngste Zuordnung und macht den Vorgänger wieder offen', async () => {
		const richtig = await partei('Richtig Zugeordnet');
		const falsch = await partei('Aus Versehen');
		await ordneEigentumZu(handelnder(betreiber), einheit, richtig.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), einheit, falsch.id, '2026-06-01');

		const vorher = await zuordnungen();
		expect(vorher).toHaveLength(2);
		// Der Vorgänger hat beim Zuordnen ein Ende bekommen.
		expect(vorher[0].valid_to).not.toBeNull();

		const juengste = vorher[1];
		const ergebnis = await entferneZuordnung(handelnder(betreiber), juengste.id);
		expect(ergebnis.einheit).toBe('Whg mit Versehen');

		const nachher = await zuordnungen();
		expect(nachher).toHaveLength(1);
		expect(nachher[0].party_id).toBe(richtig.id);
		// **Der Kern:** Ohne diesen Schritt endete der Vorgänger weiterhin an einem
		// Tag, an dem nichts mehr geschieht — und die Einheit stünde ab da ohne
		// Eigentümer da.
		expect(nachher[0].valid_to).toBeNull();
	});

	it('lässt eine frühere Zuordnung nicht tilgen — das risse ein Loch', async () => {
		const zeilen = await zuordnungen();
		expect(zeilen.length).toBeGreaterThan(0);
		const nachfolger = await partei('Kam danach');
		await ordneEigentumZu(handelnder(betreiber), einheit, nachfolger.id, '2026-07-01');

		const alle = await zuordnungen();
		await expect(entferneZuordnung(handelnder(betreiber), alle[0].id)).rejects.toThrow(
			/zuletzt erfasste/
		);
	});

	/*
	 * **Die Schranke, die Protokolle schützt** — dieselbe wie beim Entfernen einer
	 * Einheit (22.08.2026). Steht die Einheit in einer Momentaufnahme, hat ihre
	 * Wertquote an einer Abstimmung teilgenommen; wer die Zuordnung dann tilgt,
	 * macht das Protokoll unerklärlich.
	 *
	 * `snapshot_unit` hat KEINEN Fremdschlüssel auf `unit` — die Momentaufnahme
	 * ist bewusst eine Kopie. Die Datenbank hält hier also nichts auf.
	 */
	it('tilgt nichts, worauf schon abgestimmt wurde', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Beschlossenweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg mit Geschichte',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Aebi',
			representativeName: null,
			isCommunity: false
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-06-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);

		const [zuordnung] = await imKontext(
			betreiber,
			(tx) => tx`SELECT id FROM unit_ownership WHERE unit_id = ${e.id}`
		);
		await expect(entferneZuordnung(handelnder(betreiber), zuordnung.id)).rejects.toThrow(
			/teilgenommen/
		);

		// Und sie steht danach noch da — die Absage ist keine halbe Löschung.
		const danach = await imKontext(
			betreiber,
			(tx) => tx`SELECT id FROM unit_ownership WHERE unit_id = ${e.id}`
		);
		expect(danach).toHaveLength(1);
	});

	it('nennt eine Zuordnung, die es nicht gibt, beim Namen', async () => {
		await expect(
			entferneZuordnung(handelnder(betreiber), crypto.randomUUID())
		).rejects.toThrow(/gibt es nicht/);
	});
});
