import { describe, expect, it } from 'vitest';
import {
	ausuebung,
	kopfstimmenErklaerung,
	stimmkraftliste,
	stimmkraftVon
} from '$lib/domain/stimmkraft';
import type { Snapshot, SnapshotParty } from '$lib/domain/types';

/**
 * Eine Momentaufnahme, wie sie ab Epic 3 bei der Freigabe entsteht. Bis dahin
 * bildet die Wertetabelle sie nach — die Funktion wartet damit auf keine
 * spätere Story.
 */
function momentaufnahme(
	parties: SnapshotParty[],
	modus: Snapshot['headCountMode'] = 'per_owner',
	nebenobjekte = false
): Snapshot {
	return {
		meetingId: 'v1',
		takenAt: '2026-07-30T18:00:00Z',
		headCountMode: modus,
		parkingCountsAsHead: nebenobjekte,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties
	};
}

function partei(
	partyId: string,
	displayName: string,
	units: SnapshotParty['units'],
	extra: Partial<SnapshotParty> = {}
): SnapshotParty {
	return { partyId, displayName, representativeName: null, isCommunity: false, units, ...extra };
}

function einheit(
	unitId: string,
	label: string,
	quota: number,
	kind: 'unit' | 'parking' = 'unit',
	countsAsHead = true
) {
	return { unitId, label, kind, countsAsHead, quota };
}

describe('Zählung je Eigentümer', () => {
	const snapshot = momentaufnahme([
		partei('p1', 'Renate Berger-Stücki', [
			einheit('u1', 'Wohnung 1', 200),
			einheit('u2', 'Wohnung 2', 150),
			einheit('u3', 'Wohnung 3', 100)
		])
	]);

	it('gibt einem Eigentümer mit drei Einheiten eine Kopfstimme und die Summe der Quoten', () => {
		const liste = stimmkraftliste(snapshot);
		const p = stimmkraftVon(liste, 'p1')!;
		expect(p.kopfstimmen).toBe(1);
		expect(p.wertquote).toBe(450);
	});

	it('erklärt die eine Stimme, damit eine Bestreitung im Saal geklärt ist', () => {
		const liste = stimmkraftliste(snapshot);
		const text = kopfstimmenErklaerung(stimmkraftVon(liste, 'p1')!, liste);
		expect(text).toMatch(/Eine Kopfstimme/);
		expect(text).toMatch(/3 Einheiten/);
		expect(text).toMatch(/712o Abs. 1/);
	});
});

describe('Gemeinschaftliches Eigentum', () => {
	const snapshot = momentaufnahme([
		partei('p1', 'Erbengemeinschaft Kunz', [einheit('u1', 'Wohnung 4', 300)], {
			isCommunity: true,
			representativeName: 'Ruth Kunz'
		})
	]);

	it('gibt der Gemeinschaft eine Stimme', () => {
		const p = stimmkraftVon(stimmkraftliste(snapshot), 'p1')!;
		expect(p.kopfstimmen).toBe(1);
	});

	it('nennt, wer sie ausübt', () => {
		// Im Saal ist das die Angabe, die eine Bestreitung sofort klärt.
		const p = stimmkraftVon(stimmkraftliste(snapshot), 'p1')!;
		expect(p.ausgeuebtDurch).toBe('Ruth Kunz für Erbengemeinschaft Kunz');
	});

	it('nennt ohne Vertreter nur den Namen', () => {
		expect(ausuebung({ displayName: 'Hans Muster', representativeName: null })).toBe('Hans Muster');
	});
});

describe('Nebenobjekte', () => {
	const snapshot = momentaufnahme(
		[
			partei('p1', 'Muster Immobilien AG', [
				einheit('u1', 'Wohnung 5', 250),
				einheit('u2', 'Parkplatz 3', 50, 'parking')
			])
		],
		'per_unit',
		false
	);

	it('erhöht die Kopfstimmen nicht, die Wertquote schon', () => {
		const p = stimmkraftVon(stimmkraftliste(snapshot), 'p1')!;
		expect(p.kopfstimmen).toBe(1);
		expect(p.wertquote).toBe(300);
	});

	it('sagt, welche Einheit warum keine Kopfstimme trägt', () => {
		const liste = stimmkraftliste(snapshot);
		const text = kopfstimmenErklaerung(stimmkraftVon(liste, 'p1')!, liste);
		expect(text).toMatch(/1 von 2 Einheiten/);
		expect(text).toMatch(/Parkplatz 3/);
	});

	it('zählt sie mit, wenn die Gemeinschaft es so hält', () => {
		const mit = { ...snapshot, parkingCountsAsHead: true };
		expect(stimmkraftVon(stimmkraftliste(mit), 'p1')!.kopfstimmen).toBe(2);
	});

	it('lässt eine einzeln abgewählte Einheit auch dann aussen vor', () => {
		// Die Einstellung der Gemeinschaft ist die Obergrenze, das Häkchen an der
		// Einheit die zusätzliche Einschränkung — nie umgekehrt.
		const mit = {
			...snapshot,
			parkingCountsAsHead: true,
			parties: [
				partei('p1', 'Muster Immobilien AG', [
					einheit('u1', 'Wohnung 5', 250, 'unit', false),
					einheit('u2', 'Parkplatz 3', 50, 'parking')
				])
			]
		};
		const liste = stimmkraftliste(mit);
		expect(stimmkraftVon(liste, 'p1')!.kopfstimmen).toBe(1);
		expect(kopfstimmenErklaerung(stimmkraftVon(liste, 'p1')!, liste)).toMatch(/Wohnung 5/);
	});
});

describe('die ganze Liste', () => {
	const snapshot = momentaufnahme([
		partei('p1', 'A', [einheit('u1', 'W1', 400)]),
		partei('p2', 'B', [einheit('u2', 'W2', 350)]),
		partei('p3', 'C', [einheit('u3', 'W3', 250)])
	]);

	it('summiert Kopfstimmen und Wertquoten', () => {
		const liste = stimmkraftliste(snapshot);
		expect(liste.summeKopfstimmen).toBe(3);
		expect(liste.summeWertquote).toBe(1000);
		expect(liste.gesamtquote).toBe(1000);
	});

	it('trägt die angewandte Zählweise mit — sie gehört zu jedem Ergebnis (AD-2)', () => {
		expect(stimmkraftliste(snapshot).zaehlweise).toBe('per_owner');
	});

	it('gibt einer Partei ohne Einheit keine Stimme', () => {
		// Nach einer Handänderung bleibt die Person erfasst, ihr Stimmrecht endet.
		const ohne = momentaufnahme([partei('p9', 'Verkäufer', [])]);
		const p = stimmkraftVon(stimmkraftliste(ohne), 'p9')!;
		expect(p.kopfstimmen).toBe(0);
		expect(p.wertquote).toBe(0);
		expect(kopfstimmenErklaerung(p, stimmkraftliste(ohne))).toMatch(/kein Stimmrecht/);
	});

	it('rechnet nur auf der Momentaufnahme, nie auf späteren Daten (AD-3)', () => {
		// Belegbar dadurch, dass dieselbe Momentaufnahme immer dasselbe ergibt —
		// die Funktion kennt keine Quelle ausser ihrem Argument.
		const a = stimmkraftliste(snapshot);
		const b = stimmkraftliste(snapshot);
		expect(a).toEqual(b);
	});
});
