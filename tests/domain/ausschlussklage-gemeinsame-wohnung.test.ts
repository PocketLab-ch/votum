/**
 * Die gemeinsame Wohnung des Beklagten bei der Ermächtigung zur Ausschlussklage
 * (Fassung 2026-10-11, `beklagtenwohnungZaehltMit`).
 *
 * **Der Anlass** (Fachprüfung FAQ 30.09.2026, Kartenbefund 3): Art. 649b
 * Abs. 2 nimmt aus der Zahl aller Miteigentümer nur den Beklagten. Gemessen am
 * 30.09.2026 unter Fassung 2026-10-10: zehn Wohnungen, eine dem Beklagten und
 * seiner Ehefrau gemeinsam, Basis 9, fünf Ja angenommen. Nach dem Wortlaut
 * sind es zehn Köpfe und sechs Ja.
 *
 * Jede Probe hat ihre Gegenprobe unter 2026-10-10: Dort muss das alte
 * Verhalten stehen bleiben, sonst rechnete ein altes Traktandum anders nach,
 * als es gerechnet hat (AD-4).
 */
import { describe, expect, it } from 'vitest';
import {
	erfordernisInWorten,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '../../src/lib/domain/auszaehlung';
import { baueAuszaehlmappe, type Mappenposten } from '../../src/lib/domain/auszaehlmappe';
import {
	beklagtenwohnungZaehltMit,
	zahlenbeispiel,
	type Erfordernis
} from '../../src/lib/domain/entscheidbaum';
import { FASSUNGEN } from '../../src/lib/rules';
import type { Snapshot, Vote } from '../../src/lib/domain/types';

const AUSSCHLUSSKLAGE: Erfordernis = {
	fassung: '2026-10-11',
	juristischGegengelesen: false,
	astId: 'a-sonderfall',
	knotenId: 'k-ausschlussklage',
	typ: 'einfaches_mehr',
	titel: 'Ermächtigung zur Ausschlussklage',
	rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
	kopfbasis: 'alle_ausser_betroffene',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};
const VORFASSUNG: Erfordernis = { ...AUSSCHLUSSKLAGE, fassung: '2026-10-10' };

/** Zehn Wohnungen; W1 gehört dem Beklagten, auf Wunsch gemeinsam mit anderen. */
function zehn(w1Gemeinsam = true): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-11T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: true,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: Array.from({ length: 10 }, (_, i) => ({
			partyId: `p${i + 1}`,
			displayName: i === 0 ? 'Beklagter und Ehefrau' : `W${i + 1}`,
			representativeName: null,
			isCommunity: i === 0 && w1Gemeinsam,
			units: [
				{
					unitId: `u${i + 1}`,
					label: `W${i + 1}`,
					kind: 'unit' as const,
					countsAsHead: true,
					quota: 100
				}
			]
		}))
	};
}

/** Von W2 bis W10 stimmen die ersten `ja` mit Ja, die übrigen mit Nein. */
function stimmen(m: Snapshot, ja: number): Vote[] {
	return m.parties.slice(1).map((p, i) => ({
		partyId: p.partyId,
		unitId: p.units[0].unitId,
		choice: i < ja ? ('yes' as const) : ('no' as const),
		castAt: '2026-10-11T19:10:00.000Z',
		recordedByChair: false
	}));
}

function lage(m: Snapshot, e: Erfordernis, u: Partial<Auszaehlungslage> = {}): Auszaehlungslage {
	return {
		momentaufnahme: m,
		erfordernis: e,
		stimmen: [],
		anwesende: m.parties.map((p) => p.partyId),
		betroffeneParteiIds: ['p1'],
		...u
	};
}

describe('beklagtenwohnungZaehltMit', () => {
	it('gilt ab der Fassung 2026-10-11 und nur an der Ausschlussklage', () => {
		expect(beklagtenwohnungZaehltMit(AUSSCHLUSSKLAGE)).toBe(true);
		expect(beklagtenwohnungZaehltMit({ ...AUSSCHLUSSKLAGE, fassung: '2026-11-01' })).toBe(true);
		expect(beklagtenwohnungZaehltMit(VORFASSUNG)).toBe(false);
		expect(beklagtenwohnungZaehltMit({ ...AUSSCHLUSSKLAGE, knotenId: 'k-hausordnung' })).toBe(false);
		// Eine Kennung, die kein Datum ist, sortiert hinter jedes Datum und
		// fiele sonst darunter.
		expect(beklagtenwohnungZaehltMit({ ...AUSSCHLUSSKLAGE, fassung: 'weisungsregel' })).toBe(false);
		// Unter einer Mehrheit der Anwesenden stünde die Wohnung ohnehin nicht in
		// der Basis (Codeprüfung 30.09.2026, M1: sonst verlangte die Mappe mehr).
		expect(beklagtenwohnungZaehltMit({ ...AUSSCHLUSSKLAGE, kopfbasis: 'anwesend_vertreten' })).toBe(false);
		expect(beklagtenwohnungZaehltMit({ ...AUSSCHLUSSKLAGE, kopfbasis: 'alle_eigentuemer' })).toBe(true);
	});
});

describe('Die gemeinsame Wohnung des Beklagten bleibt in der Bezugsgrösse', () => {
	it('verlangt bei zehn Wohnungen sechs Ja, einzeln erfasst', () => {
		const m = zehn();
		const fuenf = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5) }));
		expect(fuenf.koepfe.basis).toBe(10);
		expect(fuenf.koepfe.schwelle).toBe(6);
		expect(fuenf.koepfe.nichtAnwesend).toBe(0);
		// Anwesend und trotzdem ohne Stimme: ein eigener Eimer (Codeprüfung, N1).
		expect(fuenf.koepfe.stimmtNicht).toBe(1);
		expect(fuenf.angenommen).toBe(false);
		expect(fuenf.hinweise.join(' ')).toMatch(/Die Wohnung von «Beklagter und Ehefrau» gehört mehreren, und laut Angabe der Sitzungsleitung richtet sich der Antrag nur gegen den Beklagten/);
		// Zustimmen kann die Wohnung nicht; sie steht nicht unter «ohne Zustimmung».
		expect(fuenf.ohneZustimmung.find((f) => f.parteiId === 'p1')).toBeUndefined();

		const sechs = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 6) }));
		expect(sechs.angenommen).toBe(true);
	});

	it('Gegenprobe: unter 2026-10-10 bleibt es bei fünf Ja von neun', () => {
		const m = zehn();
		const a = zaehleAus(lage(m, VORFASSUNG, { stimmen: stimmen(m, 5) }));
		expect(a.koepfe.basis).toBe(9);
		expect(a.koepfe.schwelle).toBe(5);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).not.toMatch(/richtet sich der Antrag nur gegen den Beklagten/);
	});

	it('verlangt bei der Handzählung dieselben sechs Ja', () => {
		const m = zehn();
		const fuenf = zaehleSummenAus(lage(m, AUSSCHLUSSKLAGE), { ja: 5, nein: 4, enthaltung: 0 });
		expect(fuenf.koepfe.basis).toBe(10);
		expect(fuenf.koepfe.nichtAnwesend).toBe(0);
		expect(fuenf.koepfe.stimmtNicht).toBe(1);
		expect(fuenf.angenommen).toBe(false);
		// Neun Hände im Saal, nicht zehn: Die Wohnung stimmt nicht mit.
		expect(() =>
			zaehleSummenAus(lage(m, AUSSCHLUSSKLAGE), { ja: 6, nein: 4, enthaltung: 0 })
		).toThrow(/Mehr Stimmen als Stimmberechtigte/);

		const alt = zaehleSummenAus(lage(m, VORFASSUNG), { ja: 5, nein: 4, enthaltung: 0 });
		expect(alt.koepfe.basis).toBe(9);
		expect(alt.angenommen).toBe(true);
	});

	it('zählt die Wohnung auch, wenn für die Mitbeteiligten der Ausstand erklärt ist', () => {
		// Die Karte rät den Ausstand für Angehörige, auch wenn ihnen nur die
		// Wohnung des Beklagten mitgehört.
		const m = zehn();
		const a = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5), imAusstand: ['p1'] }));
		expect(a.koepfe.basis).toBe(10);
		expect(a.angenommen).toBe(false);

		const alt = zaehleAus(lage(m, VORFASSUNG, { stimmen: stimmen(m, 5), imAusstand: ['p1'] }));
		expect(alt.koepfe.basis).toBe(9);
	});

	it('zählt eine Stimme der Wohnung nicht und sagt es', () => {
		const m = zehn();
		const eigene: Vote = {
			partyId: 'p1',
			unitId: 'u1',
			choice: 'yes',
			castAt: '2026-10-11T19:10:00.000Z',
			recordedByChair: true
		};
		const a = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: [...stimmen(m, 5), eigene] }));
		expect(a.koepfe.ja).toBe(5);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toMatch(/Für «Beklagter und Ehefrau» wurde eine Stimme erfasst\. Sie zählt nicht, weil die Wohnung hier nicht abstimmt/);
	});

	it('ändert nichts, wenn die Wohnung dem Beklagten allein gehört', () => {
		const m = zehn(false);
		const a = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5) }));
		expect(a.koepfe.basis).toBe(9);
		expect(a.angenommen).toBe(true);
	});

	it('zählt die Wohnung unter einer Klausel der Anwesenden nicht', () => {
		// Wie jede Partei, deren Stimme nicht ausgeübt werden kann; «sicher»
		// bleibt dort die Mehrheit über alle, die der Hinweis nennt.
		const m = zehn();
		const e: Erfordernis = { ...AUSSCHLUSSKLAGE, kopfbasis: 'anwesend_vertreten', quelle: 'reglement' };
		const a = zaehleAus(lage(m, e, { stimmen: stimmen(m, 5) }));
		expect(a.koepfe.basis).toBe(9);
		expect(a.angenommen).toBe(true);
		// Die Hinweise sagen dasselbe wie die Rechnung (Codeprüfung, M2).
		const h = a.hinweise.join(' ');
		expect(h).toMatch(/«Beklagter und Ehefrau» ist als Beklagter bezeichnet und zählt hier nicht mit/);
		expect(h).not.toMatch(/In der Zahl aller Eigentümer bleibt sie/);
	});

	it('widerspricht sich unter «alle Eigentümer» nicht in den Hinweisen', () => {
		const m = zehn();
		const e: Erfordernis = { ...AUSSCHLUSSKLAGE, kopfbasis: 'alle_eigentuemer', quelle: 'reglement' };
		const a = zaehleAus(lage(m, e, { stimmen: stimmen(m, 5) }));
		expect(a.koepfe.basis).toBe(10);
		const h = a.hinweise.join(' ');
		expect(h).toMatch(/In der Zahl aller Eigentümer bleibt sie/);
		expect(h).not.toMatch(/«Beklagter und Ehefrau» ist als Beklagter bezeichnet und zählt hier nicht mit/);
	});

	it('meldet bei der Handzählung die Wohnung nicht als betroffen und nicht mitgezählt', () => {
		const m = zehn();
		const a = zaehleSummenAus(lage(m, AUSSCHLUSSKLAGE), { ja: 6, nein: 3, enthaltung: 0 });
		const h = a.hinweise.join(' ');
		expect(h).toMatch(/In der Zahl aller Eigentümer bleibt sie/);
		expect(h).not.toMatch(/unmittelbar betroffen und zählt hier nicht mit/);
		// Gegenprobe: unter der Vorfassung steht der alte Satz.
		const alt = zaehleSummenAus(lage(m, VORFASSUNG), { ja: 6, nein: 3, enthaltung: 0 });
		expect(alt.hinweise.join(' ')).toMatch(/unmittelbar betroffen und zählt hier nicht mit/);
	});
});

/*
 * **Die Angabe am Traktandum** (Produktentscheid 30.09.2026, Fachprüfung F3-1):
 * Sind alle Eigentümer der Wohnung beklagt, etwa eine Erbengemeinschaft, richtet
 * sich die Klage gegen alle (Rz. 216 ad Art. 712a), und die Wohnung fällt aus
 * der Zahl. Vorgabe ist «nur eine Person», die strengere Zahl.
 */
describe('Angabe «alle Eigentümer der Wohnung beklagt»', () => {
	it('verlangt fünf Ja von neun statt sechs von zehn', () => {
		const m = zehn();
		const alle = { alleEigentuemerBeklagt: ['p1'] };
		const fuenf = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5), ...alle }));
		expect(fuenf.koepfe.basis).toBe(9);
		expect(fuenf.koepfe.schwelle).toBe(5);
		expect(fuenf.angenommen).toBe(true);
		const h = fuenf.hinweise.join(' ');
		expect(h).toMatch(/Die Wohnung von «Beklagter und Ehefrau» gehört mehreren, und laut Angabe der Sitzungsleitung richtet sich der Antrag gegen alle ihre Eigentümer/);
		expect(h).not.toMatch(/In der Zahl aller Eigentümer bleibt sie/);

		const vier = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 4), ...alle }));
		expect(vier.angenommen).toBe(false);
	});

	it('ohne Angabe gilt «nur eine Person»: sechs Ja von zehn', () => {
		const m = zehn();
		for (const u of [{}, { alleEigentuemerBeklagt: [] }]) {
			const a = zaehleAus(lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5), ...u }));
			expect(a.koepfe.basis).toBe(10);
			expect(a.koepfe.schwelle).toBe(6);
			expect(a.angenommen).toBe(false);
		}
	});

	it('wirkt in der Handzählung gleich', () => {
		const m = zehn();
		const a = zaehleSummenAus(lage(m, AUSSCHLUSSKLAGE, { alleEigentuemerBeklagt: ['p1'] }), {
			ja: 5,
			nein: 4,
			enthaltung: 0
		});
		expect(a.koepfe.basis).toBe(9);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).toMatch(/richtet sich der Antrag gegen alle ihre Eigentümer/);
	});

	it('Gegenprobe: unter 2026-10-10 ändert die Angabe nichts, fünf von neun', () => {
		const m = zehn();
		for (const u of [{}, { alleEigentuemerBeklagt: ['p1'] }]) {
			const a = zaehleAus(lage(m, VORFASSUNG, { stimmen: stimmen(m, 5), ...u }));
			expect(a.koepfe.basis).toBe(9);
			expect(a.koepfe.schwelle).toBe(5);
			expect(a.angenommen).toBe(true);
			expect(a.hinweise.join(' ')).not.toMatch(/richtet sich der Antrag gegen alle ihre Eigentümer/);
		}
	});

	it('bleibt ohne Wirkung und ohne Satz bei Alleineigentum', () => {
		const m = zehn(false);
		const a = zaehleAus(
			lage(m, AUSSCHLUSSKLAGE, { stimmen: stimmen(m, 5), alleEigentuemerBeklagt: ['p1'] })
		);
		expect(a.koepfe.basis).toBe(9);
		expect(a.hinweise.join(' ')).not.toMatch(/richtet sich der Antrag gegen alle ihre Eigentümer/);
	});
});

// Seit A3 die 7 statt «leer»: Leer zählte die Wohnung in einer Quote der
// Anwesenden mit, der Kern nicht (Codeprüfung der Review-Behebung, M1).
describe('Die Auszählmappe gibt der gemeinsamen Wohnung die 7', () => {
	const posten: Mappenposten = {
		nummer: '4',
		titel: 'Ermächtigung zur Ausschlussklage',
		erfordernis: 'Ermächtigung zur Ausschlussklage',
		kopfbasis: 'alle_ausser_betroffene',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		ohneBetroffene: true
	};
	const text = (p: Mappenposten) =>
		baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '1. Januar 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: false,
			parteien: [{ name: 'A', kopfstimmen: 1, wertquote: 1000 }],
			posten: [p]
		})
			.zeilen.flat()
			.map((z) => (z && 'wert' in z ? String(z.wert) : ''))
			.join(' ');
	it('mit dem Merkmal steht die Zeile da, ohne nicht', () => {
		expect(text({ ...posten, beklagtenwohnungZaehltMit: true })).toMatch(
			/7 bei der Ausschlussklage für eine Wohnung, die dem Beklagten mit anderen gehört, wenn sich der Antrag nur gegen ihn richtet, auch wenn für die übrigen Eigentümer der Wohnung der Ausstand erklärt ist\. Eine 7 je Wohnung\. Sie stimmt nicht ab.*Richtet sich der Antrag gegen alle ihre Eigentümer, tragen Sie 9 ein\./
		);
		expect(text(posten)).not.toMatch(/mit anderen gehört/);
	});
});

/*
 * **Codeprüfung 30.09.2026, M3.** Das Zahlenbeispiel der Erfordernisseite und
 * die Bezugsgrösse in Worten sagten «ohne die Betroffenen», auch wo die
 * gemeinsame Wohnung des Beklagten mitzählt.
 */
describe('Zahlenbeispiel und Bezugsgrösse in Worten', () => {
	const knoten = FASSUNGEN['2026-10-11'].knoten.find((k) => k.id === 'k-ausschlussklage')!;
	const zahlen = { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner' as const, betroffene: 1 };

	it('rechnet mit der gemeinsamen Wohnung zehn Köpfe und sechs Ja', () => {
		const satz = zahlenbeispiel(knoten, { ...zahlen, beklagtenwohnungen: 1 })!;
		expect(satz).toMatch(/beträgt die Basis 10/);
		expect(satz).toMatch(/nötig sind 6 Ja-Stimmen/);
	});

	it('Gegenprobe: ohne gemeinsame Wohnung neun Köpfe und fünf Ja', () => {
		const satz = zahlenbeispiel(knoten, zahlen)!;
		expect(satz).toMatch(/beträgt die Basis 9/);
		expect(satz).toMatch(/nötig sind 5 Ja-Stimmen/);
	});

	it('nennt ab 2026-10-11 den Wortlaut des Gesetzes, davor den alten Satz', () => {
		expect(erfordernisInWorten(AUSSCHLUSSKLAGE)).toBe(
			'mehr als die Hälfte aller Eigentümer ohne den Beklagten, unabhängig davon, wer erscheint'
		);
		expect(erfordernisInWorten(VORFASSUNG)).toBe(
			'mehr als die Hälfte aller Eigentümer ausser den unmittelbar Betroffenen'
		);
	});
});
