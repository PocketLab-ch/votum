/**
 * Das Veto im Ausstand (Auftrag `.auftraege/2026-09-26-veto-im-ausstand.md`;
 * ZGB Art. 712g Abs. 4).
 *
 * **Die Kette, auf die es ankommt:** betroffen und im Ausstand → während des
 * offenen Durchgangs entscheiden, am Telefon oder mündlich → beim Schliessen
 * einfrieren → in der Auszählung als Zustimmung zählen, ohne die Mehrheit zu
 * berühren. Reisst sie, steht ein Beschluss angenommen oder abgelehnt da, ohne
 * dass es jemand an einer Zahl merkt.
 *
 * **Und die Schranken des neuen Schreibwegs**, je Handlung: nur Betroffene im
 * Ausstand, nur bei der Form `im_saal_oder_vorab`, nur solange der Durchgang
 * offen ist, nur im Stimmberechtigtenstand, und für eine Vertretung nur mit
 * bestätigter Vollmacht. Eine neue Schreibstelle erbt die Schranken nicht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { trageBetroffeneEin, vermerkeVorabZustimmung } from '$lib/server/betroffene';
import { erklaereAusstand } from '$lib/server/ausstand';
import { erfasseVeto, holeVeto } from '$lib/server/veto';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Das Erfordernis eines Knotens aus der geltenden Fassung, wie im Betrieb. */
function erfordernisVon(knotenId: string): Erfordernis {
	const e = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
	if (!e) throw new Error(`Knoten ${knotenId} liefert in der geltenden Fassung kein Erfordernis`);
	return e;
}

/** Nutzungsrechte zuteilen (ZGB Art. 712g Abs. 4): im Saal oder vorab. */
const NUTZUNGSRECHT = 'k-nutzungsrecht-zuteilung';
/** Wertquoten ändern (Art. 712e Abs. 2): die Zustimmung kommt nachher. */
const WERTQUOTEN = 'k-wertquoten-aendern';

async function ohneFestschreibung(durchgang: string) {
	await admin.begin(async (tx) => {
		await tx`SET LOCAL session_replication_role = replica`;
		await tx`UPDATE voting_round SET result_json = NULL WHERE id = ${durchgang}`;
	});
}

/**
 * Vier Eigentümer zu je 250 (Aebi, Bucher, Christen, Duss), alle anwesend,
 * die Versammlung läuft, das Traktandum `knoten` ist aufgerufen.
 */
async function laufend(name: string, datum: string, knoten = NUTZUNGSRECHT) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Duss'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
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
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Sondernutzungsrecht am Gartensitzplatz',
		art: 'abstimmung',
		antragswortlaut: 'Der Gartensitzplatz wird Whg 4 zur ausschliesslichen Nutzung zugewiesen.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, erfordernisVon(knoten));

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/**
 * Die Lage, für die das Veto gebaut ist: Duss ist betroffen **und** im
 * Ausstand, der Durchgang ist offen. Eintragen, Vermerk und Ausstand erklären
 * müssen vor dem Öffnen geschehen; danach ist alles drei gesperrt.
 */
async function mitVeto(name: string, datum: string, knoten = NUTZUNGSRECHT, vorab?: string) {
	const s = await laufend(name, datum, knoten);
	await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
	if (vorab) {
		await vermerkeVorabZustimmung(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			vorab
		);
	}
	await erklaereAusstand(
		handelnder(betreiber),
		s.versammlung,
		s.traktandum,
		s.parteien[3],
		'Die Verkleinerung wird ihr entschädigt.'
	);
	await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
	return s;
}

/** Drei Ja; Duss stimmt nicht mit, weil der Ausstand ihre Stimme sperrt. */
async function dreiJa(s: Awaited<ReturnType<typeof mitVeto>>) {
	await gibStimmenAb(
		handelnder(betreiber),
		s.versammlung,
		[
			{ parteiId: s.parteien[0], wahl: 'yes' as const },
			{ parteiId: s.parteien[1], wahl: 'yes' as const },
			{ parteiId: s.parteien[2], wahl: 'yes' as const }
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
}

/** Den offenen Durchgang schliessen und das Ergebnis lesen. */
async function schliessenUndLesen(s: Awaited<ReturnType<typeof mitVeto>>) {
	const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
	const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, d.id);
	return { durchgang: d.id, a: auszaehlung! };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Veto');
	benutzer = await pruefbenutzer(betreiber, 'vetoleitung');
});

afterAll(verbindungenSchliessen);

describe('Das Veto im Ausstand', () => {
	it('zählt ein Veto-Ja als Zustimmung und lässt die Mehrheit unberührt', async () => {
		/*
		 * Produktentscheide 26.09.2026. Gegenprobe ist die Probe darunter:
		 * dieselbe Lage ohne Entscheid ist abgelehnt.
		 */
		const s = await mitVeto('Veto Ja', '2027-08-01');
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'telefon',
			erfasstDurch: 'Duss'
		});
		await dreiJa(s);
		const { durchgang, a } = await schliessenUndLesen(s);

		expect(a.angenommen).toBe(true);
		expect(a.betroffene.zugestimmt).toEqual([s.parteien[3]]);
		expect(a.betroffene.veto).toEqual([
			{
				parteiId: s.parteien[3],
				name: 'Duss',
				entscheid: 'ja',
				weg: 'telefon',
				durchVertretung: false
			}
		]);
		// Die Mehrheit ohne sie: drei von drei, nicht drei von vier.
		expect(a.koepfe.basis).toBe(3);

		const [eingefroren] = await admin<{ affected_json: unknown }[]>`
			SELECT affected_json FROM voting_round WHERE id = ${durchgang}
		`;
		expect(eingefroren.affected_json).toEqual([
			{
				parteiId: s.parteien[3],
				vorab: null,
				veto: { entscheid: 'ja', weg: 'telefon', durchVertretung: false }
			}
		]);
	});

	it('lässt ohne Entscheid die Zustimmung fehlen', async () => {
		// Die Gegenprobe zur Probe darüber: gleiche Lage, kein Veto.
		const s = await mitVeto('Veto ohne Entscheid', '2027-08-02');
		await dreiJa(s);
		const { a } = await schliessenUndLesen(s);

		expect(a.angenommen).toBe(false);
		expect(a.betroffene.fehlend.map((f) => f.grund)).toEqual(['im_ausstand']);
	});

	it('fehlt bei einem Veto-Nein mit eigenem Grund, mit Vermerk als Widerruf', async () => {
		const ohne = await mitVeto('Veto Nein', '2027-08-03');
		await erfasseVeto(handelnder(betreiber), ohne.versammlung, ohne.traktandum, ohne.parteien[3], {
			entscheid: 'nein',
			weg: 'leitung',
			erfasstDurch: 'Prüflauf'
		});
		await dreiJa(ohne);
		const nein = await schliessenUndLesen(ohne);
		expect(nein.a.angenommen).toBe(false);
		expect(nein.a.betroffene.fehlend.map((f) => f.grund)).toEqual(['veto_nein']);

		const mit = await mitVeto('Veto widerruft Vermerk', '2027-08-04', NUTZUNGSRECHT, 'Schreiben vom 12.09.2026');
		await erfasseVeto(handelnder(betreiber), mit.versammlung, mit.traktandum, mit.parteien[3], {
			entscheid: 'nein',
			weg: 'telefon',
			erfasstDurch: 'Duss'
		});
		await dreiJa(mit);
		const widerrufen = await schliessenUndLesen(mit);
		expect(widerrufen.a.angenommen).toBe(false);
		expect(widerrufen.a.betroffene.fehlend.map((f) => f.grund)).toEqual(['widerrufen']);
		expect(widerrufen.a.betroffene.vorab).toEqual([]);
	});

	it('erfasst den mündlichen Entscheid über die Sitzungsleitung', async () => {
		const s = await mitVeto('Veto mündlich', '2027-08-05');
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'leitung',
			erfasstDurch: 'Prüflauf'
		});

		const stand = await holeVeto(betreiber, s.versammlung, s.traktandum);
		expect(stand).toEqual([
			{
				parteiId: s.parteien[3],
				name: 'Duss',
				entscheid: 'ja',
				weg: 'leitung',
				erfasstAm: expect.any(String),
				erfasstDurch: 'Prüflauf',
				durchVertretung: false,
				vorab: null
			}
		]);
	});

	it('verlangt für eine Vertretung eine bestätigte Vollmacht', async () => {
		const s = await mitVeto('Veto Vertretung', '2027-08-06');
		const [aebi] = await admin<{ id: string }[]>`
			SELECT id FROM snapshot_party
			 WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[0]}
		`;
		const [duss] = await admin<{ id: string }[]>`
			SELECT id FROM snapshot_party
			 WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[3]}
		`;

		// Gegenprobe: ohne Vollmacht abgewiesen.
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Aebi',
				ausgeuebtVonId: aebi.id
			})
		).rejects.toThrow(/keine bestätigte Vollmacht/);

		await admin`
			INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_id, state,
			                   confirmed_at, confirmed_by_label)
			VALUES (${betreiber}, ${s.versammlung}, ${duss.id}, ${aebi.id}, 'bestaetigt',
			        now(), 'Prüflauf')
		`;
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'telefon',
			erfasstDurch: 'Aebi',
			ausgeuebtVonId: aebi.id
		});
		await dreiJa(s);
		const { a } = await schliessenUndLesen(s);
		expect(a.angenommen).toBe(true);
		expect(a.betroffene.veto[0]).toMatchObject({ entscheid: 'ja', durchVertretung: true });
	});

	it('nimmt den Entscheid einer abwesenden Betroffenen an', async () => {
		/*
		 * Produktentscheid 26.09.2026 auf die Frage, ob ein Anruf einer
		 * abwesenden Betroffenen bei der Sitzungsleitung zählt: «ja». Die
		 * Anwesenheit ist deshalb keine Schranke des Vetos.
		 */
		const s = await mitVeto('Veto abwesend', '2027-08-15');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[3]);
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'leitung',
			erfasstDurch: 'Sitzungsleitung'
		});
		await dreiJa(s);
		const { a } = await schliessenUndLesen(s);
		expect(a.angenommen).toBe(true);
		expect(a.betroffene.veto[0]).toMatchObject({ entscheid: 'ja', weg: 'leitung' });
	});

	it('verlangt am eigenen Gerät, dass als anwesend erfasst ist, wer tippt', async () => {
		/*
		 * Der Anruf über die Leitung zählt auch für Abwesende; am eigenen Gerät
		 * nicht, sonst nähme der Server eine wartende oder abgelehnte Anmeldung
		 * an (Codeprüfung 26.09.2026, dritter Durchgang, M1).
		 */
		const s = await mitVeto('Veto Gerät abwesend', '2027-08-17');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), s.versammlung, s.parteien[3]);
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/nicht als anwesend erfasst/);
	});

	it('lässt eine Vertretung das Veto ausüben, die selbst im Ausstand ist', async () => {
		/*
		 * Produktentscheid 26.09.2026: Die Betroffene soll ihr Veto nutzen
		 * können. BGE 134 III 481 E. 3.8 schliesst den Befangenen nur vom
		 * Stimmen aus; das Veto ist keine Stimme (Rz. 207 ad 712g). Aebi hält
		 * die Vollmacht für Duss und ist selbst im Ausstand.
		 */
		const s = await laufend('Veto Vertretung im Ausstand', '2027-08-16');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		for (const p of [s.parteien[3], s.parteien[0]]) {
			await erklaereAusstand(
				handelnder(betreiber),
				s.versammlung,
				s.traktandum,
				p,
				'Die Verkleinerung wird entschädigt.'
			);
		}
		const [aebi] = await admin<{ id: string }[]>`
			SELECT id FROM snapshot_party
			 WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[0]}
		`;
		const [duss] = await admin<{ id: string }[]>`
			SELECT id FROM snapshot_party
			 WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[3]}
		`;
		await admin`
			INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_id, state,
			                   confirmed_at, confirmed_by_label)
			VALUES (${betreiber}, ${s.versammlung}, ${duss.id}, ${aebi.id}, 'bestaetigt',
			        now(), 'Prüflauf')
		`;
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		const stand = await erfasseVeto(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			{ entscheid: 'nein', weg: 'telefon', erfasstDurch: 'Aebi', ausgeuebtVonId: aebi.id }
		);
		expect(stand).toMatchObject({ entscheid: 'nein', durchVertretung: true });
	});

	it('steht im Verlauf, mit Partei, Entscheid und Weg', async () => {
		const s = await mitVeto('Veto Verlauf', '2027-08-07');
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'telefon',
			erfasstDurch: 'Duss'
		});

		const eintraege = await admin<{ event_type: string; detail: Record<string, unknown> }[]>`
			SELECT event_type, detail FROM audit_entry
			WHERE subject_id = ${s.traktandum} AND event_type = 'agenda.item.veto.recorded'
		`;
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			partei: 'Duss',
			entscheid: 'zugestimmt',
			weg: 'am eigenen Gerät',
			erfasstDurch: 'Duss'
		});
	});

	it('friert den Entscheid beim Schliessen ein', async () => {
		const s = await mitVeto('Veto Einfrieren', '2027-08-08');
		await erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'telefon',
			erfasstDurch: 'Duss'
		});
		await dreiJa(s);
		const { durchgang, a } = await schliessenUndLesen(s);
		expect(a.angenommen).toBe(true);

		/*
		 * Eine spätere Zeile in der Tabelle wirkt nicht auf den geschlossenen
		 * Durchgang: Er trägt seinen Stand in `affected_json`. Gerechnet wird
		 * hier, weil `result_json` fehlt — der Lesezweig des Einfrierens.
		 */
		await ohneFestschreibung(durchgang);
		await admin`
			INSERT INTO veto (operator_id, round_id, snapshot_party_id, entscheid, weg,
			                  erfasst_durch)
			SELECT ${betreiber}, ${durchgang}, sp.id, 'nein', 'leitung', 'Prüflauf'
			  FROM snapshot_party sp
			 WHERE sp.meeting_id = ${s.versammlung} AND sp.party_id = ${s.parteien[3]}
		`;
		const danach = await holeErgebnis(betreiber, s.versammlung, durchgang);
		expect(danach.auszaehlung?.angenommen).toBe(true);

		// Gegenprobe: Ohne den festgeschriebenen Stand wirkt die neue Zeile.
		await admin`UPDATE voting_round SET affected_json = NULL WHERE id = ${durchgang}`;
		const live = await holeErgebnis(betreiber, s.versammlung, durchgang);
		expect(live.auszaehlung?.angenommen).toBe(false);
	});
});

describe('Der Entscheid im Rennen mit dem Schliessen', () => {
	it('wartet das Schliessen ab und steht danach im eingefrorenen Stand', async () => {
		/*
		 * Codeprüfung H3 (13.10.2026), Befund M2: dieselbe Bauart wie S1, gesteuert wie
		 * in `stimmweg-rennen.test.ts`: Der Entscheid hält an seinem
		 * Fremdschlüssel auf die Partei der Momentaufnahme an, nachdem er den
		 * Durchgang gelesen hat. Vor H3 schloss die Leitung jetzt ungehindert,
		 * und der Entscheid kam danach in den geschlossenen Durchgang.
		 *
		 * **Was diese Prüfung trägt, und was nicht.** An dieser Stelle hält das
		 * INSERT über seinen Fremdschlüssel auf den Durchgang schon eine Sperre,
		 * auf die das `FOR UPDATE` des Schliessens wartet. Rot ist sie deshalb
		 * nur ohne die Sperre beim Schliessen. Das Fenster davor, zwischen dem
		 * Lesen des Durchgangs und dem INSERT, schliesst `FOR SHARE` in
		 * `offenerDurchgang`; dort liegen nur Abfragen ohne Sperre, an denen
		 * sich ein Lauf nicht anhalten lässt. Diese Hälfte ist am Code begründet,
		 * nicht gemessen.
		 */
		const s = await mitVeto('Veto im Rennen', '2027-08-20');
		await dreiJa(s);
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`
				SELECT id FROM snapshot_party
				 WHERE meeting_id = ${s.versammlung} AND party_id = ${s.parteien[3]}
				   FOR UPDATE
			`;
			expect(zeilen).toHaveLength(1);
		});
		const entscheid = erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
			entscheid: 'ja',
			weg: 'telefon',
			erfasstDurch: 'Prüflauf'
		});
		await warteAufWartende(1);
		const schliessen = schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		let fertig = false;
		void schliessen.finally(() => (fertig = true)).catch(() => undefined);
		await warteAufWartende(2, () => fertig);
		await sperre.loesen();

		/*
		 * Der Entscheid hat den Durchgang zuerst gelesen, also wartet das
		 * Schliessen auf ihn und friert ihn mit ein. Abgewiesen würde er nur,
		 * wenn er erst nach dem Schliessen an die Zeile käme; das ist hier
		 * ausgeschlossen, und eine Absage hätte einen anderen Grund.
		 */
		const [e, z] = await Promise.allSettled([entscheid, schliessen]);
		expect(e.status).toBe('fulfilled');
		expect(z.status).toBe('fulfilled');
		const durchgang = (z as PromiseFulfilledResult<{ id: string }>).value.id;
		const [eingefroren] = await admin<{ affected_json: { veto: unknown }[] }[]>`
			SELECT affected_json FROM voting_round WHERE id = ${durchgang}
		`;
		expect(eingefroren.affected_json[0].veto).toMatchObject({ entscheid: 'ja' });
	});
});

describe('Abgewiesen wird', () => {
	it('ohne offenen Durchgang', async () => {
		const s = await laufend('Veto Schranke offen', '2027-08-09');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await erklaereAusstand(
			handelnder(betreiber),
			s.versammlung,
			s.traktandum,
			s.parteien[3],
			'Die Verkleinerung wird ihr entschädigt.'
		);
		// Vor dem Öffnen: kein offener Durchgang.
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/gerade nicht abgestimmt/);

		// Und nach dem Schliessen ebenso.
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/gerade nicht abgestimmt/);
	});

	it('eine Partei, die nicht betroffen oder nicht im Ausstand ist', async () => {
		const ohneBetroffen = await mitVeto('Veto Schranke betroffen', '2027-08-10');
		// Christen ist im Ausstand, aber nicht als betroffen eingetragen.
		await expect(
			erfasseVeto(handelnder(betreiber), ohneBetroffen.versammlung, ohneBetroffen.traktandum, ohneBetroffen.parteien[2], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Christen'
			})
		).rejects.toThrow(/als unmittelbar betroffen eingetragen und im Ausstand/);

		const s = await laufend('Veto Schranke Ausstand', '2027-08-11');
		await trageBetroffeneEin(handelnder(betreiber), s.versammlung, s.traktandum, [s.parteien[3]]);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		// Betroffen, aber nicht im Ausstand.
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/als unmittelbar betroffen eingetragen und im Ausstand/);
	});

	it('bei der Form «nachher», den Wertquoten', async () => {
		const s = await mitVeto('Veto Schranke nachher', '2027-08-12', WERTQUOTEN);
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/Abänderungsurkunde/);
	});

	it('eine Partei ausserhalb des Stimmberechtigtenstands', async () => {
		/*
		 * Eine als betroffen eingetragene und im Ausstand stehende Partei, die
		 * nicht in der Momentaufnahme **dieser** Versammlung steht, etwa ein
		 * früherer Eigentümer. Ihr Veto lässt sich nicht erfassen; die
		 * Zuordnung gehört vorher berichtigt. Die Zeilen entstehen direkt in
		 * der Datenbank, damit keine Momentaufnahme angefasst wird — ein
		 * gelöschter Eintrag liesse Waisen zurück, die die Aufbewahrungsprobe
		 * einer anderen Datei findet.
		 */
		const s = await mitVeto('Veto Schranke Stand', '2027-08-13');
		const andere = await laufend('Veto Schranke Stand 2', '2027-08-12');
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id)
				VALUES (${s.traktandum}, ${andere.parteien[0]}, ${betreiber}, ${s.gemeinschaft})
			`;
			await tx`
				INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id, grund,
				                     erklaert_durch)
				VALUES (gen_random_uuid(), ${betreiber}, ${s.versammlung}, ${s.traktandum},
				        ${andere.parteien[0]}, 'Die Partei gehört nicht zum Stand.', 'Prüflauf')
			`;
		});
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, andere.parteien[0], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/nicht zu denen, die in dieser Versammlung stimmberechtigt/);
	});

	it('in einer geschlossenen Versammlung', async () => {
		const s = await mitVeto('Veto Schranke Zustand', '2027-08-14');
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${s.versammlung}
			`;
		});
		await expect(
			erfasseVeto(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[3], {
				entscheid: 'ja',
				weg: 'telefon',
				erfasstDurch: 'Duss'
			})
		).rejects.toThrow(/Zustand/);
	});

	it('nach dem Siegel auch an der Tabelle selbst', async () => {
		/*
		 * Der Schreibweg läuft im Saal, also vor dem Siegel. Das Siegel sperrt
		 * die Tabelle in der Datenhaltung, wie bei Stimme und Ausstand (FR-55);
		 * die Abgabe folgt demselben Muster.
		 */
		const s = await mitVeto('Veto Schranke Siegel', '2027-08-15');
		const [runde] = await admin<{ id: string }[]>`
			SELECT id FROM voting_round WHERE agenda_item_id = ${s.traktandum} AND state = 'offen'
		`;
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${s.versammlung}
			`;
		});
		await expect(
			admin`
				INSERT INTO veto (operator_id, round_id, snapshot_party_id, entscheid, weg, erfasst_durch)
				SELECT ${betreiber}, ${runde.id}, sp.id, 'ja', 'telefon', 'Duss'
				  FROM snapshot_party sp
				 WHERE sp.meeting_id = ${s.versammlung} AND sp.party_id = ${s.parteien[3]}
			`
		).rejects.toThrow(/versiegelt/);
	});
});
