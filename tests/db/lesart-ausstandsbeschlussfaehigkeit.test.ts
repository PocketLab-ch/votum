/**
 * Lesart L7 in der Datenhaltung (Migration 183, Einteilung F3b, B2).
 *
 * Gemessen wird an L7, was `lesart-reglementsschranke.test.ts` an L6 misst:
 * Vorgabe und Datenbankschranke, Umstellen mit Verlauf, Einfrieren bei der
 * Freigabe, die Sperre beim Eröffnen unter «Zählt nicht mit» mit Gegenfällen
 * und der konsultativen Abstimmung, und die Zeile am Beschluss unter der
 * Vorgabe (Kriterien 1 bis 5). Vier Eigentümer zu 300, 300, 200 und 200 von
 * 1000 an einer ersten Versammlung: Sind p1 und p2 da, genügt das knapp
 * (zwei von vier Eigentümern, 600 von 1000 Wertquoten); steht p2 im
 * Ausstand, wäre die Versammlung ohne ihn nicht beschlussfähig.
 *
 * **Nicht in dieser Sitzung laufen lassen** (Auftrag F4c, Lauf 1): Die
 * abgebende Sitzung fährt ihn mit dem Prüflauf.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { erstelleTraktandum, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erklaereAusstand } from '$lib/server/ausstand';
import {
	gibStimmenAb,
	haltBeschlussVonHandFest,
	holeDurchgaenge,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L7');
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

/**
 * Eine Versammlung im Entwurf mit vier Eigentümern und einer Abstimmung über
 * die Jahresrechnung. Das Erfordernis ist für L7 gleichgültig; die
 * Beschlussfähigkeit hängt an der Anwesenheit.
 */
async function versammlung(name: string, datum: string, quoten = [300, 300, 200, 200]) {
	const g = await gemeinschaft(name);
	const parteien: string[] = [];
	for (const [nummer, quote] of quoten.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe', 'Ida Muster', 'Kurt Beispiel'][nummer] ?? `Partei ${nummer + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
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
		titel: 'Jahresrechnung 2026 genehmigen',
		art: 'abstimmung',
		antragswortlaut: 'Die Jahresrechnung 2026 wird genehmigt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-jahresrechnung',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff nach der Vorgabe; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L7 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L7).toBe('zaehlt');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l7 = 'mitzaehlen' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l7/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L7 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L7: 'zaehlt_nicht' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({
			L1: 'bleibt',
			L2: 'einfach',
			L3: 'je_eigentuemer',
			L4: 'qualifiziert',
			L5: 'erste',
			L6: 'klausel',
			L7: 'zaehlt_nicht',
			L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende',
			L15: 'ausserhalb',
			L16: 'neue_erste'
		});
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L7',
			vorher: 'Zählt mit (Vorgabe)',
			nachher: 'Zählt nicht mit',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/Zählt für die Beschlussfähigkeit mit/);
	});
});

describe('Bei der Freigabe (Kriterium 3)', () => {
	it('friert die Wahl ein; eine Umstellung danach wirkt nicht für diese Versammlung', async () => {
		const a = await versammlung('L7 einfrieren', '2027-12-01');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L7).toBe('zaehlt_nicht');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L7).toBe('zaehlt_nicht');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L7).toBe('zaehlt');
	});
});

describe('Die Sperre unter «Zählt nicht mit» (Kriterium 4)', () => {
	it('weist das Eröffnen ab, wenn die Beschlussfähigkeit an den Personen im Ausstand hängt', async () => {
		const a = await versammlung('L7 Sperre', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[1],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'ausstand_nicht_beschlussfaehig' });
		expect(String(fehler.message)).toMatch(
			/Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig/
		);
		expect(String(fehler.message)).toMatch(/auf die Liste einer späteren Versammlung/);
	});

	it('öffnet ohne Ausstand', async () => {
		const a = await versammlung('L7 Sperre, ohne Ausstand', '2027-12-03');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	});

	it('öffnet trotz Ausstand, wenn genug weitere Eigentümer da sind', async () => {
		// Eigene Versammlung: Ein zweites Eröffnen am selben Traktandum
		// verlangte einen Rückkommensantrag (Gegenprüfung Lauf 1).
		const a = await versammlung('L7 Sperre, genug Anwesende', '2027-12-07');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[3],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	});

	it('nennt die Sperre im Notweg unter «übergangen» und trägt den Mangel ins Protokoll', async () => {
		// Fachprüfung L7, F-2: Ohne die Kennung unter «übergangen» sähe die
		// Leitung vor dem Festhalten keine Warnung und danach keine Quittung.
		const a = await versammlung('L7 von Hand', '2027-12-08');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[1],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		const { uebergangen } = await haltBeschlussVonHandFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: [{ parteiId: a.parteien[0], wahl: 'yes' as const }]
			}
		});
		expect(uebergangen.map((u) => u.kennung)).toContain('ausstand_nicht_beschlussfaehig');
		expect(uebergangen.map((u) => u.kennung)).not.toContain('nicht_beschlussfaehig');

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Ohne die Personen im Ausstand war die Versammlung bei diesem Beschluss nicht beschlussfähig; nach der Einstellung der Gemeinschaft zählten sie dafür nicht mit. Der Beschluss gilt, bis ein Gericht ihn aufhebt.'
		);
		expect(text).not.toContain('Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss');
	});

	it('weist auch die unverbindliche Abstimmung ab, mit der Absage zu L7 (Entscheid 0043)', async () => {
		const a = await versammlung('L7 konsultativ', '2027-12-04');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[1],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			konsultativ: true
		}).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'ausstand_nicht_beschlussfaehig' });
		expect(await holeDurchgaenge(betreiber, a.versammlung)).toHaveLength(0);
	});
});

describe('Die Vorgabe im Saal (Kriterium 5)', () => {
	it('öffnet trotz Ausstand und trägt die Zeile am Beschluss, wenn die Beschlussfähigkeit an ihm hängt', async () => {
		const a = await versammlung('L7 Vorgabe', '2027-12-05');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[1],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss nicht beschlussfähig gewesen; nach der Einstellung der Gemeinschaft zählten sie mit.'
		);
	});

	it('trägt die Zeile nicht, wenn die Beschlussfähigkeit auch ohne die Person im Ausstand genügt', async () => {
		const a = await versammlung('L7 Vorgabe, genug Anwesende', '2027-12-06');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[3],
			'Die Verwaltung ist an dem Vertrag beteiligt.'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			a.parteien.slice(0, 3).map((parteiId) => ({ parteiId, wahl: 'yes' })),
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).not.toContain('Ohne die Personen im Ausstand wäre die Versammlung bei diesem Beschluss');
	});
});
