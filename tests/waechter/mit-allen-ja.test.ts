/**
 * `mitAllenJa`: ob ein Durchgang die Ja-Stimmen aller Eigentümer hatte (F4c
 * B2b, B2-F-4).
 *
 * **Warum hier und nicht unter `tests/domain/`:** Dort schreibt in F4c eine
 * andere Sitzung; der Helfer kam mit der Verdrahtung im Server.
 *
 * Gemessen wird zuerst am Stimmenspiegel, ob die Summe aller Eimer die Zahl
 * aller Köpfe trifft (sie trifft sie, solange niemand aus allen Eimern fällt),
 * dann die beiden Fälle, in denen jemand fehlt: der Ausstand und unter der
 * Zählung je Einheit die Partei ohne Kopfstimme.
 */
import { describe, expect, it } from 'vitest';
import {
	mitAllenJa,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlung,
	type Auszaehlungslage
} from '../../src/lib/domain/auszaehlung';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';
import type { HeadCountMode, Snapshot, Vote, VoteChoice } from '../../src/lib/domain/types';

const MEHR_DER_ANWESENDEN: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

/** Drei erfundene Parteien; `nurNebenobjekt` gibt der dritten nur einen Parkplatz ohne Kopfstimme. */
function momentaufnahme(zaehlweise: HeadCountMode = 'per_owner', nurNebenobjekt = false): Snapshot {
	const namen = ['Anna Beispiel', 'Beat Muster', 'Carla Probe'];
	return {
		meetingId: 'v-1',
		takenAt: '2026-11-06T17:00:00.000Z',
		headCountMode: zaehlweise,
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: namen.map((name, i) => ({
			partyId: `p${i + 1}`,
			displayName: name,
			representativeName: null,
			isCommunity: false,
			units: [
				{
					unitId: `p${i + 1}-u1`,
					label: `${name} 1`,
					kind: nurNebenobjekt && i === 2 ? ('parking' as const) : ('unit' as const),
					countsAsHead: !(nurNebenobjekt && i === 2),
					quota: i === 2 ? 334 : 333
				}
			]
		}))
	};
}

function stimmen(m: Snapshot, wahlen: Record<string, VoteChoice>): Vote[] {
	return m.parties.flatMap((p) =>
		wahlen[p.partyId]
			? p.units.map((u) => ({
					partyId: p.partyId,
					unitId: u.unitId,
					choice: wahlen[p.partyId],
					castAt: '2026-11-06T19:10:00.000Z',
					recordedByChair: true
				}))
			: []
	);
}

function lage(m: Snapshot, anwesende: string[], wahlen: Record<string, VoteChoice>, mehr = {}): Auszaehlungslage {
	return { momentaufnahme: m, erfordernis: MEHR_DER_ANWESENDEN, anwesende, stimmen: stimmen(m, wahlen), ...mehr };
}

const eimer = (a: Auszaehlung) =>
	a.koepfe.ja +
	a.koepfe.nein +
	a.koepfe.enthaltung +
	a.koepfe.ohneAbgabe +
	a.koepfe.nichtAnwesend +
	(a.koepfe.stimmtNicht ?? 0) +
	(a.koepfe.imAusstand ?? 0);

describe('Die Eimer des Stimmenspiegels', () => {
	it('ergeben zusammen alle Köpfe, auch wo die Basis nur die Anwesenden zählt', () => {
		const m = momentaufnahme();
		const a = zaehleAus(lage(m, ['p1', 'p2'], { p1: 'yes', p2: 'yes' }));
		expect(a.koepfe.basis).toBe(2);
		expect(eimer(a)).toBe(m.parties.length);
	});

	it('verlieren die Partei im Ausstand, deshalb die eigene Prüfung', () => {
		const m = momentaufnahme();
		const a = zaehleAus(lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes' }, { imAusstand: ['p3'] }));
		expect(eimer(a)).toBe(2);
		expect(a.koepfe.ja).toBe(2);
	});
});

describe('mitAllenJa', () => {
	it('ist wahr, wenn alle Eigentümer Ja gestimmt haben', () => {
		const m = momentaufnahme();
		expect(mitAllenJa(zaehleAus(lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes', p3: 'yes' })))).toBe(true);
	});

	it('ist falsch bei einem Nein, einer Enthaltung oder ohne Abgabe', () => {
		const m = momentaufnahme();
		const alle = ['p1', 'p2', 'p3'];
		expect(mitAllenJa(zaehleAus(lage(m, alle, { p1: 'yes', p2: 'yes', p3: 'no' })))).toBe(false);
		expect(mitAllenJa(zaehleAus(lage(m, alle, { p1: 'yes', p2: 'yes', p3: 'abstain' })))).toBe(false);
		expect(mitAllenJa(zaehleAus(lage(m, alle, { p1: 'yes', p2: 'yes' })))).toBe(false);
	});

	it('ist falsch, wenn eine Partei fehlt, auch wenn das Mehr der Anwesenden erreicht ist', () => {
		const m = momentaufnahme();
		const a = zaehleAus(lage(m, ['p1', 'p2'], { p1: 'yes', p2: 'yes' }));
		expect(a.angenommen).toBe(true);
		expect(mitAllenJa(a)).toBe(false);
	});

	it('ist falsch, wenn eine Partei im Ausstand ist, obwohl alle Eimer Ja zeigen', () => {
		const m = momentaufnahme();
		const a = zaehleAus(lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes' }, { imAusstand: ['p3'] }));
		expect(mitAllenJa(a)).toBe(false);
	});

	it('ist unter der Zählung je Einheit falsch, wenn die Partei ohne Kopfstimme Nein stimmt', () => {
		const m = momentaufnahme('per_unit', true);
		const a = zaehleAus(lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes', p3: 'no' }));
		// Bei den Köpfen fehlt sie, bei den Wertquoten nicht.
		expect(a.koepfe.ja).toBe(eimer(a));
		expect(mitAllenJa(a)).toBe(false);
	});

	it('ist falsch ohne einen einzigen Kopf, auch wenn alle Wertquoten Ja zeigen', () => {
		// Leere Eimer ergeben 0 === 0; die Bedingung `koepfe.ja > 0` fängt das
		// (Featureprüfung F4c, 06.11.2026: bis dahin war sie ungeprüft).
		const m = momentaufnahme();
		const a = zaehleAus(lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes', p3: 'yes' }));
		expect(mitAllenJa(a)).toBe(true);
		const ohneKoepfe = { ...a.koepfe, ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, stimmtNicht: 0, imAusstand: 0 };
		expect(mitAllenJa({ ...a, koepfe: ohneKoepfe })).toBe(false);
	});

	it('lässt offen, was sich nicht sagen lässt', () => {
		const m = momentaufnahme();
		const alle = lage(m, ['p1', 'p2', 'p3'], { p1: 'yes', p2: 'yes', p3: 'yes' });
		const a = zaehleAus(alle);
		expect(mitAllenJa({ ...a, vonHand: { erfassung: 'summen' } })).toBeUndefined();
		expect(mitAllenJa({ ...a, keinBeschluss: { grund: 'weggang', namen: [] } })).toBeUndefined();
		expect(mitAllenJa({ ...a, stichentscheidOffen: true })).toBeUndefined();
		const summen = zaehleSummenAus(alle, { ja: 3, nein: 0, enthaltung: 0 });
		expect(mitAllenJa(summen)).toBeUndefined();
	});
});
