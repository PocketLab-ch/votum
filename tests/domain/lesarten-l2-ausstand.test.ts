/**
 * L2 «qualifiziert» zusammen mit einem Ausstand (Lesarten Block 3, offener
 * Punkt): Das Ergebnis nach der anderen Lesart (L2 «einfach») und das nach der
 * anderen Wahl zu L1 stehen nebeneinander, jedes mit seinen eigenen Zahlen.
 *
 * **Der Anlass** (Pendenzen, «Aus dem Review DeepSeek zu Block 3»): Der Test
 * prüfte dort nur den Kartensatz, nicht die Auszählung. Beide zweiten
 * Ergebnisse hängen an derselben Zählung, und nur der Fall mit Ausstand zeigt,
 * dass das eine das andere nicht verdrängt.
 */
import { describe, expect, it } from 'vitest';
import { erfordernisAus, laufe } from '$lib/domain/entscheidbaum';
import { zaehleAus } from '$lib/domain/auszaehlung';
import { LESARTEN_VORGABE, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk('2026-10-26');

const QUALIFIZIERT: Lesartenwahl = { ...LESARTEN_VORGABE, L2: 'qualifiziert', L1: 'faellt_heraus' };

function herleiten(wahlen: Lesartenwahl = QUALIFIZIERT) {
	const e = wendeLesartAn(
		erfordernisAus(RW, laufe(RW, 'a-sonderfaelle', ['f8-1-zustaendigkeit'])),
		wahlen
	);
	// L1 hängt nicht am Knoten, sondern wird wie im Server getrennt gesetzt.
	return { ...e, ausstandslesart: wahlen.L1 };
}

/** Vier Parteien zu 250; p4 ist anwesend, aber im Ausstand. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-21T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [1, 2, 3, 4].map((i) => ({
		partyId: `p${i}`,
		displayName: `Erfunden ${i}`,
		representativeName: null,
		isCommunity: false,
		units: [
			{
				unitId: `p${i}-u`,
				label: `Whg ${i}`,
				kind: 'unit' as const,
				countsAsHead: true,
				quota: 250
			}
		]
	}))
};

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-21T19:10:00.000Z',
		recordedByChair: false
	}));
}

describe('L2 «qualifiziert» mit Ausstand: beide zweiten Ergebnisse', () => {
	it('nennt das Ergebnis nach L2 «einfach» und das nach L1 «bleibt» nebeneinander', () => {
		const e = herleiten();
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'qualifiziert' });
		expect(e.ausstandslesart).toBe('faellt_heraus');

		const a = zaehleAus({
			momentaufnahme: M,
			erfordernis: e,
			stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']),
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p4'],
			geheim: false
		});

		// Die gewählte Rechnung: Köpfe 2 von 3, Wertquoten 500 von 750, nötig 376.
		expect(a.angenommen).toBe(true);
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 3, erreicht: true });
		expect(a.quoten).toMatchObject({ ja: 500, basis: 750, schwelle: 376, erreicht: true });

		// Das Ergebnis nach der anderen L2-Wahl («einfach»): dieselben Köpfe,
		// keine Wertquoten; deshalb dasselbe Ergebnis wie die gewählte Rechnung.
		expect(a.andereLesart).toMatchObject({
			kennung: 'L2',
			wahl: 'Einfaches Mehr',
			feststellbar: true,
			angenommen: true,
			abweichend: false,
			koepfe: { ja: 2, basis: 3 },
			quoten: null
		});

		// Das Ergebnis nach der anderen L1-Wahl («bleibt»): die Quote im Ausstand
		// bleibt in der Zahl, 500 von 1000, nötig 501, abgelehnt. Die Köpfe
		// ändern sich durch L1 nicht und stehen deshalb nicht noch einmal da.
		expect(a.andereAusstandslesart).toMatchObject({
			kennung: 'L1',
			wahl: 'Wertquote zählt mit',
			feststellbar: true,
			angenommen: false,
			abweichend: true,
			koepfe: null,
			quoten: { ja: 500, basis: 1000, schwelle: 501, erreicht: false }
		});
	});
});
