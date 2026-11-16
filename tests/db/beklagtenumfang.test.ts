/**
 * Ausschlussklage: nur eine Person oder alle Eigentümer der Wohnung beklagt
 * (Migration 132, Produktentscheid 30.09.2026, Fachprüfung F3-1).
 *
 * **Die Kette, auf die es ankommt:** im Saal eingetragen → Angabe gesetzt →
 * beim Schliessen eingefroren → in der Auszählung wirksam. Zehn Wohnungen, W1
 * gehört dem Beklagten mit einer zweiten Person. «Nur eine Person beklagt»
 * (Vorgabe) verlangt sechs Ja von zehn, «alle beklagt» fünf von neun
 * (Rz. 216 ad Art. 712a). Unter Fassung 2026-10-10 bleibt es bei fünf von
 * neun, mit oder ohne Angabe.
 *
 * **Und die Schranken des Schreibwegs**: dieselben wie beim Vorab-Vermerk,
 * dazu «wirkt hier überhaupt» (Erfordernis und gemeinsames Eigentum).
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
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holeBetroffene, setzeBeklagtenumfang } from '$lib/server/betroffene';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { FASSUNGEN } from '$lib/rules';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

function ausschlussklage(fassung: string): Erfordernis {
	const e = waehleErfordernis(FASSUNGEN[fassung], 'k-ausschlussklage').ergebnis;
	if (!e) throw new Error(`Fassung ${fassung} liefert für die Ausschlussklage kein Erfordernis`);
	return e;
}

/**
 * Zehn Wohnungen, alle anwesend, die Versammlung läuft, das Traktandum
 * «Ermächtigung zur Ausschlussklage» ist aufgerufen und W1 als beklagt
 * zugeordnet (im Entwurf). W1 gehört auf Wunsch mehreren.
 */
async function laufend(name: string, datum: string, fassung = '2026-10-11', w1Gemeinsam = true) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 0; i < 10; i++) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `W${i + 1}`,
			quotas: { stamm: 100 },
			countsAsHead: true
		});
		const gemeinsam = i === 0 && w1Gemeinsam;
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: i === 0 ? 'Prüfbeklagter und Mitbesitz' : `Prüf W${i + 1}`,
			isCommunity: gemeinsam,
			representativeName: gemeinsam ? 'Prüfbeklagter' : null
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
		titel: 'Ermächtigung zur Ausschlussklage',
		art: 'abstimmung',
		antragswortlaut: 'Die Verwaltung wird ermächtigt, die Ausschlussklage zu erheben.',
		antragstellerart: 'bewirtschaftung',
		// Wie im Betrieb: Die Freigabe verlangt den Beklagten schon im Entwurf.
		betroffeneParteiIds: [parteien[0]]
		},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	'k-ausschlussklage');
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ausschlussklage(fassung));

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/** W2 bis W10 stimmen, die ersten `ja` mit Ja, die übrigen mit Nein. */
async function abstimmen(s: Awaited<ReturnType<typeof laufend>>, ja: number) {
	await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
	await gibStimmenAb(
		handelnder(betreiber),
		s.versammlung,
		s.parteien.slice(1).map((parteiId, i) => ({
			parteiId,
			wahl: i < ja ? ('yes' as const) : ('no' as const)
		})),
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
	const { auszaehlung } = await holeErgebnis(betreiber, s.versammlung, d.id);
	return { durchgang: d.id, a: auszaehlung! };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Beklagtenumfang');
	benutzer = await pruefbenutzer(betreiber, 'beklagtenleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Angabe wirkt auf die Zahl', () => {
	it('ohne Angabe, «nur eine Person beklagt»: sechs Ja von zehn', async () => {
		const s = await laufend('Beklagt 1', '2027-08-02');
		const [b] = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(b.gemeinsam).toBe(true);
		expect(b.alleEigentuemerBeklagt).toBe(false);

		const { a } = await abstimmen(s, 5);
		expect(a.koepfe.basis).toBe(10);
		expect(a.koepfe.schwelle).toBe(6);
		expect(a.angenommen).toBe(false);
	});

	it('«alle Eigentümer der Wohnung beklagt»: fünf Ja von neun', async () => {
		const s = await laufend('Beklagt 2', '2027-08-03');
		await setzeBeklagtenumfang(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[0], true);
		const [b] = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(b.alleEigentuemerBeklagt).toBe(true);

		const { durchgang, a } = await abstimmen(s, 5);
		expect(a.koepfe.basis).toBe(9);
		expect(a.koepfe.schwelle).toBe(5);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).toMatch(/richtet sich der Antrag gegen alle ihre Eigentümer/);

		// Eingefroren, mit dem Schlüssel nur, wo die Angabe gesetzt ist.
		const [z] = await admin<{ affected_json: unknown }[]>`
			SELECT affected_json FROM voting_round WHERE id = ${durchgang}
		`;
		expect(z.affected_json).toEqual([
			{ parteiId: s.parteien[0], vorab: null, veto: null, alleBeklagt: true }
		]);
	});

	it('Gegenprobe: unter 2026-10-10 fünf von neun, die Angabe lässt sich dort nicht setzen', async () => {
		const s = await laufend('Beklagt 3', '2027-08-04', '2026-10-10');
		await expect(
			setzeBeklagtenumfang(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[0], true)
		).rejects.toThrow(/rechnet die Anwendung nicht damit/);
		const { a } = await abstimmen(s, 5);
		expect(a.koepfe.basis).toBe(9);
		expect(a.koepfe.schwelle).toBe(5);
		expect(a.angenommen).toBe(true);
	});
});

describe('Beim Schliessen eingefroren', () => {
	it('ändert eine spätere Angabe das Ergebnis des geschlossenen Durchgangs nicht', async () => {
		const s = await laufend('Beklagt 4', '2027-08-05');
		const { durchgang, a } = await abstimmen(s, 5);
		expect(a.angenommen).toBe(false);

		// Das Ergebnis nicht aus `result_json` lesen, sondern neu rechnen lassen,
		// sonst liefe die Probe nur durch den Lesezweig (siehe `betroffene.test.ts`).
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`UPDATE voting_round SET result_json = NULL WHERE id = ${durchgang}`;
		});
		await setzeBeklagtenumfang(handelnder(betreiber), s.versammlung, s.traktandum, s.parteien[0], true);
		const danach = await holeErgebnis(betreiber, s.versammlung, durchgang);
		expect(danach.auszaehlung?.koepfe.basis).toBe(10);
		expect(danach.auszaehlung?.angenommen).toBe(false);
	});
});

describe('Der Schreibweg', () => {
	it('steht im Verlauf mit vorher und nachher, und nur bei einer Änderung', async () => {
		const s = await laufend('Beklagt 5', '2027-08-06');
		const h = handelnder(betreiber);
		await setzeBeklagtenumfang(h, s.versammlung, s.traktandum, s.parteien[0], true);
		await setzeBeklagtenumfang(h, s.versammlung, s.traktandum, s.parteien[0], true);
		await setzeBeklagtenumfang(h, s.versammlung, s.traktandum, s.parteien[0], false);
		const eintraege = await admin<{ detail: Record<string, unknown>; actor_label: string | null }[]>`
			SELECT detail, actor_label FROM audit_entry
			WHERE subject_id = ${s.traktandum}
			  AND event_type = 'agenda.item.affected.defendant.scope.set'
			ORDER BY id
		`;
		expect(eintraege.map((e) => [e.detail.vorher, e.detail.nachher])).toEqual([
			['nur eine Person beklagt', 'alle Eigentümer der Wohnung beklagt'],
			['alle Eigentümer der Wohnung beklagt', 'nur eine Person beklagt']
		]);
		expect(eintraege[0].detail.partei).toBe('Prüfbeklagter und Mitbesitz');
		expect(eintraege[0].actor_label).toBe('Prüflauf');
	});

	it('weist ab: bei offenem Durchgang, bei Alleineigentum, für Nichteingetragene', async () => {
		const h = handelnder(betreiber);
		const offen = await laufend('Beklagt 6', '2027-08-09');
		await oeffneAbstimmung(h, offen.versammlung, offen.traktandum);
		await expect(
			setzeBeklagtenumfang(h, offen.versammlung, offen.traktandum, offen.parteien[0], true)
		).rejects.toThrow(/gerade abgestimmt/);

		const allein = await laufend('Beklagt 7', '2027-08-10', '2026-10-11', false);
		await expect(
			setzeBeklagtenumfang(h, allein.versammlung, allein.traktandum, allein.parteien[0], true)
		).rejects.toThrow(/einer Person allein/);

		const s = await laufend('Beklagt 8', '2027-08-11');
		await expect(
			setzeBeklagtenumfang(h, s.versammlung, s.traktandum, s.parteien[1], false)
		).rejects.toThrow(/nicht als beklagt eingetragen/);
		// Und nichts davon hat geschrieben.
		const [b] = await holeBetroffene(betreiber, s.versammlung, s.traktandum);
		expect(b.alleEigentuemerBeklagt).toBe(false);
	});
});
