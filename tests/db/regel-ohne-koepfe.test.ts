/**
 * Regel «Köpfe zählen nicht» in der Datenbank (Migration 195, Produktentscheid
 * 16.11.2026): Schreibweg, beide Lesewege und die Schranke, die eine Regel ohne
 * Köpfe und ohne Wertquoten abweist, auch am Domänenweg vorbei.
 *
 * Gemeinschaften und Fundstellen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { aendereReglementsregelAn, erstelleReglementsregel, holeReglementsregeln, mehrheitInWorten } from '$lib/server/reglement';
import { holeReglementsregelnIn } from '$lib/server/erfordernisse';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erstelleTraktandum, setzeGewaehltesErfordernis, ziehAntragZurueck } from '$lib/server/traktanden';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { gibStimmenAb, haltStichentscheidFest, holeErgebnis, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import type { ReglementsregelEingabe } from '$lib/domain/reglement';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { gleichstandInZahlen } from '$lib/domain/auszaehlung';

let betreiber: string;
let benutzer: string | null = null;
let stweg: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });

function regel(u: Partial<ReglementsregelEingabe> = {}): ReglementsregelEingabe {
	return {
		stwegId: stweg,
		geschaeftsart: 'verwaltung_gewoehnlich',
		kopfSchwelle: null,
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'anwesend_vertreten',
		fundstelle: 'Art. 99 Reglement (erfunden)',
		enthaltungZaehltMit: true,
		...u
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Wertquotenmehr');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-wertquotenmehr');
	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Erfundene Gemeinschaft Wertquoten',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Regel ohne Köpfe', () => {
	it('wird ohne Kopfschwelle geschrieben und von beiden Lesern so gelesen', async () => {
		const r = await erstelleReglementsregel(handelnder(), regel());
		expect(r.kopfSchwelle).toBeNull();
		const zeile = await imKontext(
			betreiber,
			(tx) => tx`SELECT head_numerator, head_denominator, head_mode FROM bylaw_quorum_rule WHERE id = ${r.id}`
		);
		expect(zeile[0]).toEqual({ head_numerator: null, head_denominator: null, head_mode: null });

		const ueberSeite = (await holeReglementsregeln(betreiber, stweg)).find((x) => x.id === r.id);
		expect(ueberSeite?.kopfSchwelle).toBeNull();
		const ueberVorlage = (await imKontext(betreiber, (tx) => holeReglementsregelnIn(tx, stweg))).find(
			(x) => x.id === r.id
		);
		expect(ueberVorlage?.kopfSchwelle).toBeNull();
		expect(ueberVorlage?.quotenSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
	});

	it('lässt sich auf Köpfe zurück und wieder ohne Köpfe ändern', async () => {
		const r = (await holeReglementsregeln(betreiber, stweg)).find((x) => x.geschaeftsart === 'verwaltung_gewoehnlich')!;
		const { stwegId: _s, ...ohne } = regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } });
		const mit = await aendereReglementsregelAn(handelnder(), stweg, r.id, ohne);
		expect(mit.regel.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		const { stwegId: _t, ...wieder } = regel();
		const zurueck = await aendereReglementsregelAn(handelnder(), stweg, r.id, wieder);
		expect(zurueck.geaendert).toBe(true);
		expect(zurueck.regel.kopfSchwelle).toBeNull();
	});

	it('die Datenbank weist ohne Köpfe und ohne Wertquoten ab, auch am Domänenweg vorbei', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule (
						id, operator_id, stweg_id, business_kind, head_numerator, head_denominator, head_mode,
						head_base, quota_base, source_reference
					) VALUES (
						gen_random_uuid(), ${betreiber}, ${stweg}, 'hausordnung', NULL, NULL, NULL,
						'anwesend_vertreten', 'keine', 'Art. 98 Reglement (erfunden)'
					)
				`
			)
		).rejects.toThrow(/bylaw_rule_kopf_vollstaendig/);
	});

	it('und eine halbe Kopfschwelle ebenso', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO bylaw_quorum_rule (
						id, operator_id, stweg_id, business_kind, head_numerator, head_denominator, head_mode,
						head_base, quota_numerator, quota_denominator, quota_mode, quota_base, source_reference
					) VALUES (
						gen_random_uuid(), ${betreiber}, ${stweg}, 'organe', 1, NULL, NULL,
						'anwesend_vertreten', 1, 2, 'mehr_als', 'anwesend_vertreten', 'Art. 97 Reglement (erfunden)'
					)
				`
			)
		).rejects.toThrow(/bylaw_rule_kopf_vollstaendig/);
	});

	it('der Kasten «von … auf …» nennt die Regel ohne Köpfe richtig (Codeprüfung M1)', () => {
		const quoten = { zaehler: 1, nenner: 2, art: 'mehr_als', basis: 'anwesend_vertreten' };
		expect(
			mehrheitInWorten(null, null, null, 'anwesend_vertreten', 'reglement', 'Art. 99', true, null, quoten, null, null)
		).toBe('mehr als 1/2 der anwesenden oder vertretenen Wertquoten, unabhängig von der Zahl der Eigentümer · Reglement, Art. 99');
		// Mit Köpfen unverändert, nur die Bezugsgrösse der Wertquoten stimmt jetzt.
		expect(
			mehrheitInWorten(1, 2, 'mehr_als', 'anwesend_vertreten', null, null, true, null, { ...quoten, basis: 'alle_quoten' }, null, null)
		).toBe('mehr als 1/2 der Anwesenden oder Vertretenen und mehr als 1/2 aller Wertquoten');
	});
});

/*
 * **Der ganze Weg aus der Datenbank** (Featureprüfung, Prüfer A, Kriterien 1 und 2):
 * Regel hinterlegt, Traktandum mit dem Fall des einfachen Mehrs, Abstimmung,
 * Ergebnis; beim Gleichstand der Wertquoten der Stichentscheid der Verwaltung.
 */
describe('Regel ohne Köpfe an einer Versammlung', () => {
	async function lauf(name: string, datum: string, quoten: number[], zweites = false) {
		const g = await erstelleGemeinschaft(handelnder(), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			tieBreak: 'verwalter',
			tieBreakRuleSource: 'Art. 98 Reglement (erfunden)'
		});
		await erstelleReglementsregel(handelnder(), regel({ stwegId: g.id }));
		const parteien: string[] = [];
		for (const [i, q] of quoten.entries()) {
			const e = await erstelleEinheit(handelnder(), { stwegId: g.id, kind: 'unit', label: `Whg ${i + 1}`, quotas: { stamm: q }, countsAsHead: true });
			const p = await erstelleEigentuemer(handelnder(), { stwegId: g.id, kind: 'natural', displayName: `Partei ${i + 1}`, isCommunity: false, representativeName: null });
			await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
			parteien.push(p.id);
		}
		const v = await erstelleVersammlung(handelnder(), { stwegId: g.id, datum, uhrzeit: '19:00', ort: 'Prüfsaal', art: 'ordentlich', stufe: 'erste', betriebsart: 'gefuehrt' });
		const t = await erstelleTraktandum(handelnder(), { meetingId: v.id, titel: 'Ersatz der Hecke', art: 'abstimmung', antragswortlaut: 'Die Hecke wird ersetzt.', antragstellerart: 'bewirtschaftung' });
		await setzeGewaehltesErfordernis(handelnder(), { meetingId: v.id, stwegId: g.id }, t.id, 'k-verwaltung-gewoehnlich', null);
		// Ein zweites Geschäft für den Rückzug (B4); anlegen lässt es sich nur im Entwurf.
		const zweitesTraktandum = zweites
			? await erstelleTraktandum(handelnder(), { meetingId: v.id, titel: 'Laubbläser', art: 'abstimmung', antragswortlaut: 'Es wird ein Laubbläser angeschafft.', antragstellerart: 'bewirtschaftung' })
			: null;
		if (zweitesTraktandum) await setzeGewaehltesErfordernis(handelnder(), { meetingId: v.id, stwegId: g.id }, zweitesTraktandum.id, 'k-verwaltung-gewoehnlich', null);
		await gibVersammlungFrei(handelnder(), v.id);
		await eroeffneVersammlung(handelnder(), v.id);
		for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
		await stelleAufTraktandum(handelnder(), v.id, t.id);
		await oeffneAbstimmung(handelnder(), v.id, t.id);
		await gibStimmenAb(
			handelnder(),
			v.id,
			parteien.map((parteiId, i) => ({ parteiId, wahl: i === 0 ? ('yes' as const) : ('no' as const) })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const d = await schliesseAbstimmung(handelnder(), v.id);
		const [z] = await imKontext(betreiber, (tx) => tx<{ result_json: { auszaehlung?: { angenommen: boolean; stichentscheidOffen: boolean; koepfe: { ja: number } } } | null }[]>`
			SELECT result_json FROM voting_round WHERE id = ${d.id}
		`);
		return { versammlung: v.id, durchgang: d.id, ergebnis: z.result_json, zweites: zweitesTraktandum?.id ?? null };
	}

	it('nimmt mit der Mehrheit der Anteile an, auch mit einem von drei Köpfen (Kriterium 1)', async () => {
		const r = await lauf('Erfundene Wertquoten 1', '2029-04-02', [600, 200, 200]);
		expect(r.ergebnis?.auszaehlung?.koepfe.ja).toBe(1);
		expect(r.ergebnis?.auszaehlung?.angenommen).toBe(true);
	});

	it('Gleichstand der Wertquoten: hält an, die Verwaltung entscheidet (Kriterium 2)', async () => {
		const r = await lauf('Erfundene Wertquoten 2', '2029-04-03', [500, 300, 200]);
		// Offen: Das Schliessen verkündet nichts, solange der Entscheid fehlt.
		expect(r.ergebnis).toBeNull();
		await haltStichentscheidFest(handelnder(), r.versammlung, r.durchgang, { wahl: 'yes', wer: 'Verwaltung Muster (erfunden)' });
		const [z] = await imKontext(betreiber, (tx) => tx<{ result_json: { auszaehlung: { angenommen: boolean; durchStichentscheid: boolean } } }[]>`
			SELECT result_json FROM voting_round WHERE id = ${r.durchgang}
		`);
		expect(z.result_json.auszaehlung).toMatchObject({ angenommen: true, durchStichentscheid: true });
	});

	/*
	 * **Was Wand und Leitung beim offenen Gleichstand sagen** (Probe
	 * Wertquotenmehr, 17.11.2026, B4 und B5). Die Wand sagte «Das Ergebnis wird
	 * verkündet», als läge eines vor; die Leitung des Abends nannte weder Zahlen
	 * noch Zählweise. Beides kommt aus der Auszählung dieses Durchgangs.
	 */
	it('offener Gleichstand: der Strom trägt den Satz dazu, die Zahlen nennen die Wertquoten (B4, B5)', async () => {
		const r = await lauf('Erfundene Wertquoten 3', '2029-04-04', [500, 300, 200]);
		const stand = await ermittleStand(betreiber, r.versammlung);
		expect(stand?.abstimmung?.ergebnis).toBeNull();
		expect(stand?.abstimmung?.wartesatz).toBe(
			'Stimmengleichheit bei 500 zu 500 Wertquoten. Nach dem Reglement entscheidet der Verwalter; ' +
				'der Entscheid steht noch aus. Bis er eingetragen ist, steht kein Ergebnis fest.'
		);
		const offen = await holeErgebnis(betreiber, r.versammlung, r.durchgang);
		expect(gleichstandInZahlen(offen.auszaehlung!)).toBe('500 zu 500 Wertquoten, nach denen hier allein gezählt wird');

		// Entschieden: kein Wartesatz mehr, die Zahlen bleiben für das Protokoll (B1).
		await haltStichentscheidFest(handelnder(), r.versammlung, r.durchgang, { wahl: 'no', wer: 'Verwaltung Muster (erfunden)' });
		const danach = await ermittleStand(betreiber, r.versammlung);
		expect(danach?.abstimmung?.wartesatz).toBeNull();
		expect(danach?.abstimmung?.ergebnis?.angenommen).toBe(false);
		const entschieden = await holeErgebnis(betreiber, r.versammlung, r.durchgang);
		expect(gleichstandInZahlen(entschieden.auszaehlung!)).toBe('500 zu 500 Wertquoten, nach denen hier allein gezählt wird');
	});

	it('ein Rückzug am aufgerufenen Traktandum steht als Zeitpunkt im Strom (B4)', async () => {
		const r = await lauf('Erfundene Wertquoten 4', '2029-04-05', [600, 200, 200], true);
		await stelleAufTraktandum(handelnder(), r.versammlung, r.zweites!);
		expect((await ermittleStand(betreiber, r.versammlung))?.zurueckgezogenAm).toBeNull();
		await ziehAntragZurueck(handelnder(), r.versammlung, r.zweites!, 'Prüflauf: Der Hauswart hat schon einen.');
		expect((await ermittleStand(betreiber, r.versammlung))?.zurueckgezogenAm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});
