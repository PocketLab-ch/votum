/**
 * Die Quote des Beklagten in ihrem Eimer (Pendenz «Aus Block 2 offen», A2 des
 * Ablaufplans vom 29.10.2026).
 *
 * **Der Anlass** (Review DeepSeek zu Block 2, Befund 3, zweiter Teil; am
 * 30.10.2026 nachgerechnet): Verlangt an der Ausschlussklage eine
 * Reglementsregel ein Mehr aller Wertquoten, bleibt die Quote des Beklagten im
 * Nenner (`QUOTE_BEKLAGTER`), lag aber in keinem Eimer. Vier Wohnungen mit
 * 100, 200, 300 und 400: 900 in den Eimern, Bezugsgrösse 1000, und die
 * Protokollzeile nannte die 100 nirgends.
 */
import { describe, expect, it } from 'vitest';
import { zaehleAus, type Auszaehlungslage } from '../../src/lib/domain/auszaehlung';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';
import type { Snapshot } from '../../src/lib/domain/types';

const KLAGE: Erfordernis = {
	fassung: '2026-10-29',
	juristischGegengelesen: false,
	astId: 'a-sonderfall',
	knotenId: 'k-ausschlussklage',
	typ: 'einfaches_mehr',
	titel: 'Ermächtigung zur Ausschlussklage',
	rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
	kopfbasis: 'alle_ausser_betroffene',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

const VIER: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-29T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: true,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [100, 200, 300, 400].map((quota, i) => ({
		partyId: `p${i + 1}`,
		displayName: `W${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `u${i + 1}`, label: `W${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};

function lage(e: Erfordernis, u: Partial<Auszaehlungslage> = {}): Auszaehlungslage {
	return {
		momentaufnahme: VIER,
		erfordernis: e,
		stimmen: ['p2', 'p3', 'p4'].map((partyId, i) => ({
			partyId,
			unitId: `u${i + 2}`,
			choice: 'yes' as const,
			castAt: '2026-10-29T19:10:00.000Z',
			recordedByChair: false
		})),
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		betroffeneParteiIds: ['p1'],
		...u
	};
}

const eimer = (q: ReturnType<typeof zaehleAus>['quoten']) =>
	q.ja + q.nein + q.enthaltung + q.ohneAbgabe + q.nichtAnwesend + (q.stimmtNicht ?? 0) + (q.imAusstand ?? 0);

describe('Die Quote des Beklagten unter dem Mehr aller Wertquoten', () => {
	it('liegt im Eimer der Wohnung, die nicht abstimmt, mit und ohne Ausstand', () => {
		for (const imAusstand of [[], ['p1']]) {
			const a = zaehleAus(lage(KLAGE, { imAusstand }));
			expect(a.quoten.basis, String(imAusstand)).toBe(1000);
			expect(a.quoten.stimmtNicht, String(imAusstand)).toBe(100);
			expect(eimer(a.quoten), String(imAusstand)).toBe(a.quoten.basis);
		}
	});

	it('ändert weder Schwelle noch Ergebnis', () => {
		const a = zaehleAus(lage(KLAGE));
		expect(a.quoten.schwelle).toBe(501);
		expect(a.quoten.ja).toBe(900);
		expect(a.angenommen).toBe(true);
	});

	it('bleibt aussen vor, wo die Quote nicht im Nenner steht', () => {
		const anwesend = zaehleAus(lage({ ...KLAGE, quotenbasis: 'anwesend_vertreten' }));
		expect(anwesend.quoten.stimmtNicht).toBeUndefined();
		expect(eimer(anwesend.quoten)).toBe(anwesend.quoten.basis);
		const ohne = zaehleAus(lage({ ...KLAGE, quotenbasis: 'keine', quotenSchwelle: null }));
		expect(ohne.quoten.stimmtNicht).toBeUndefined();
	});
});

/**
 * Der Hinweis «Gerechnet wurde ohne die Ausgetretenen» (Pendenz aus Block 6,
 * Codeprüfung der Review-Behebungen). Er hing nur an der Kopfbasis «alle
 * Eigentümer»; stellt die Leitung die Ausschlussklage darauf, erschien er bei
 * jedem Ausstand, obwohl die Angehörigen nach 1e in der Zahl bleiben und der
 * Beklagte ohnehin nicht mitzählt.
 */
describe('Der Hinweis zu den Ausgetretenen nur, wo jemand aus der Zahl fällt', () => {
	const ALLE: Erfordernis = { ...KLAGE, kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine', quotenSchwelle: null };
	const OHNE = /Gerechnet wurde ohne die Ausgetretenen/;
	const saetze = (a: ReturnType<typeof zaehleAus>) =>
		[...a.hinweise, ...(a.protokollhinweise ?? []).map((p) => p.satz)].join(' ');

	it('fehlt an der Ausschlussklage, wenn Angehörige und Beklagter im Ausstand sind', () => {
		const a = zaehleAus(lage(ALLE, { imAusstand: ['p1', 'p2'] }));
		expect(a.koepfe.imAusstand).toBe(1);
		expect(saetze(a)).not.toMatch(OHNE);
	});

	it('bleibt, wo der Ausstand die Zahl verkleinert', () => {
		// Vor 1e fiel der Angehörige im Ausstand aus der Zahl.
		const vorher = zaehleAus(lage({ ...ALLE, fassung: '2026-10-24' }, { imAusstand: ['p2'] }));
		expect(saetze(vorher)).toMatch(OHNE);
		const einstimmig = zaehleAus(
			lage(
				{ ...ALLE, knotenId: 'k-andere-ordnung', typ: 'einstimmigkeit', kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' } },
				{
					imAusstand: ['p2'],
					betroffeneParteiIds: [],
					// Alle Stimmberechtigten stimmen zu: Seit E3 steht der Satz der
					// Einstimmigkeit nur am angenommenen Antrag, und ohne p1 wäre er
					// abgelehnt.
					stimmen: ['p1', 'p3', 'p4'].map((partyId) => ({
						partyId,
						unitId: `u${partyId.slice(1)}`,
						choice: 'yes' as const,
						castAt: '2026-10-29T19:10:00.000Z',
						recordedByChair: false
					}))
				}
			)
		);
		expect(einstimmig.angenommen).toBe(true);
		expect(saetze(einstimmig)).toMatch(OHNE);
	});
});
