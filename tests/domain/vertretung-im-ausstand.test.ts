/**
 * B3 (F4c): Beim Mehr der Anwesenden und Vertretenen rechnet Votum ohne die
 * Partei, deren einziger Vertreter im Ausstand ist, und nennt daneben das
 * Ergebnis, wenn sie ohne Stimme in der Zahl bleibt (Rz. 181 ad Art. 712m).
 * Protokoll nur bei Abweichung, wie 1a (Entscheid 0023).
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartenVon,
	andereLesartInWorten,
	mitKeinemBeschluss,
	vertretungImAusstandWirkt,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const FUENF: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-05T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [1, 2, 3, 4, 5].map((i) => ({
		partyId: `p${i}`,
		displayName: `Partei ${i}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `p${i}-u`, label: `Whg ${i}`, kind: 'unit' as const, countsAsHead: true, quota: 200 }]
	}))
};

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-05T19:10:00.000Z',
		recordedByChair: false
	}));
}

const EINFACH: Erfordernis = {
	fassung: '2026-11-05',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

/** p4 ist im Ausstand und vertritt p5; p1 und p2 Ja, p3 Nein. */
function lage(e: Erfordernis = EINFACH, wahlen = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no'])): Auszaehlungslage {
	return {
		momentaufnahme: FUENF,
		erfordernis: e,
		stimmen: wahlen,
		anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
		imAusstand: ['p4'],
		vertretungen: [{ vertreteneId: 'p5', bevollmaechtigtId: 'p4' }]
	};
}

describe('B3: das Ergebnis mit der Partei des Vertreters im Ausstand in der Zahl', () => {
	it('rechnet und verkündet wie bisher ohne sie: 2 Ja von 3', () => {
		const a = zaehleAus(lage());
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 3, schwelle: 2 });
		expect(a.angenommen).toBe(true);
	});

	it('nennt daneben das Ergebnis mit ihr ohne Stimme: 2 Ja von 4, abgelehnt', () => {
		const r = zaehleAus(lage()).vertretungImAusstand!;
		expect(r).toMatchObject({ kennung: 'B3', feststellbar: true, angenommen: false, abweichend: true });
		expect(r.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3 });
		expect(andereLesartenVon(zaehleAus(lage()))).toContainEqual(r);
	});

	it('hält die Abweichung im Protokoll fest, mit Fundstellen', () => {
		const a = zaehleAus(lage());
		const satz = a.protokollhinweise?.find((h) => h.ort === 'ausgang' && h.satz.includes('Rz. 181'))?.satz;
		expect(satz).toContain('Verkündet ist die Annahme');
		expect(satz).toContain('und der Antrag wäre abgelehnt gewesen. So gezählt: 2 Ja von 4 Kopfstimmen, nötig 3.');
		expect(satz).toContain('BGE 134 III 481 E. 3.8 und 3.9');
		expect(satz).toContain('Der Beschluss gilt, bis ein Gericht ihn aufhebt');
		expect(satz).toContain('innert eines Monats');
		expect(satz).toContain('Wer an der Versammlung war oder sich vertreten liess, rechnet ab dem Versammlungstag');
	});

	it('sagt der Leitung, dass der Beschluss angreifbar ist', () => {
		const a = zaehleAus(lage());
		const { leitung } = andereLesartInWorten(a.vertretungImAusstand!, false);
		expect(leitung).toContain('deren einziger Vertreter im Ausstand ist, und verkündet die Annahme');
		expect(leitung).toContain('wirken sie wie ein Nein, und der Antrag wäre abgelehnt');
		expect(leitung).toContain('Im Saal ist dazu nichts zu entscheiden');
		// Rz. 181 trägt nur «wie ungültige Stimmen» (Fachprüfung, M-1).
		expect(leitung).toContain('wie ungültige Stimmen (SVIT-Kommentar Rz. 181 ad Art. 712m)');
	});

	/*
	 * **Nur «dasselbe» und «abgelehnt»** (Review DeepSeek zu F4c Block 3, N-2):
	 * Ja und Nein bleiben, die Basis wächst. Rot wird der Test, wenn B3 dort
	 * fehlt, wo es wirkt und kein Stichentscheid offen ist: Dann hätte
	 * `mitVertretungImAusstand` einen unmöglichen Ausgang weggelassen
	 * (Codeprüfung des Nachtrags, M1). Sechs Parteien, damit die erste Basis
	 * gerade ist und Gleichstände vorkommen; mit und ohne eingetragenen
	 * Stichentscheid; Einzel- und Handzählung.
	 */
	it('liefert immer einen Ausgang und kippt nie zu «angenommen»', () => {
		const SECHS: Snapshot = {
			...FUENF,
			parties: [...FUENF.parties, { ...FUENF.parties[0], partyId: 'p6', displayName: 'Partei 6', units: [{ ...FUENF.parties[0].units[0], unitId: 'p6-u', label: 'Whg 6' }] }]
		};
		const wahlen: (VoteChoice | null)[] = ['yes', 'no', 'abstain', null];
		const stimmende = ['p1', 'p2', 'p3', 'p6'];
		const erwartet = (f: unknown) => f instanceof FachlicherFehler && f.kennung.startsWith('summe_');
		const pruefe = (l: Omit<Auszaehlungslage, 'stimmen'>, a: ReturnType<typeof zaehleAus>) => {
			const r = a.vertretungImAusstand;
			if (!vertretungImAusstandWirkt(l) || a.stichentscheidOffen) return 0;
			expect(r).toBeTruthy();
			expect(r!.feststellbar).toBe(true);
			if (!a.angenommen) expect(r!.angenommen).toBe(false);
			return 1;
		};
		let gesehen = 0;
		let gleichstand = 0;
		for (const tieBreak of ['keiner', 'vorsitz', 'wertquote'] as const)
			for (const stichentscheid of [undefined, { wahl: 'yes' as const, wer: 'Vorsitz' }]) {
				const basis = { ...lage(), momentaufnahme: { ...SECHS, tieBreak }, anwesende: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], stichentscheid };
				for (const w of wahlen.flatMap((a) => wahlen.flatMap((b) => wahlen.flatMap((c) => wahlen.map((d) => [a, b, c, d]))))) {
					const je: [string, VoteChoice][] = [];
					w.forEach((x, i) => {
						if (x) je.push([stimmende[i], x]);
					});
					const l = { ...basis, stimmen: stimmen(...je) };
					let a;
					try {
						a = zaehleAus(l);
					} catch (f) {
						if (erwartet(f)) continue;
						throw f;
					}
					if (a.koepfe.ja === a.koepfe.nein && a.koepfe.ja * 2 === a.koepfe.basis && a.koepfe.ja > 0) gleichstand++;
					gesehen += pruefe(l, a);
				}
				const { stimmen: _s, ...ohne } = basis;
				for (let ja = 0; ja <= 4; ja++)
					for (let nein = 0; ja + nein <= 4; nein++)
						for (let enthaltung = 0; ja + nein + enthaltung <= 4; enthaltung++) {
							let a;
							try {
								a = zaehleSummenAus(ohne, { ja, nein, enthaltung });
							} catch (f) {
								if (erwartet(f)) continue;
								throw f;
							}
							gesehen += pruefe(ohne, a);
						}
			}
		expect(gleichstand).toBeGreaterThan(0);
		expect(gesehen).toBeGreaterThan(500);
	});

	it('schweigt im Protokoll, wenn das Ergebnis dasselbe ist', () => {
		const a = zaehleAus(lage(EINFACH, stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'])));
		expect(a.vertretungImAusstand).toMatchObject({ abweichend: false, angenommen: true });
		expect(a.protokollhinweise?.some((h) => h.satz.includes('Rz. 181'))).toBe(false);
		const worte = andereLesartInWorten(a.vertretungImAusstand!, false);
		expect(worte.protokoll).toBeNull();
		expect(worte.leitung).toContain('deren einziger Vertreter im Ausstand ist, ohne Stimme mit, wie ungültige Stimmen');
		expect(worte.leitung).toContain('wirken sie wie ein Nein. Das Ergebnis wäre dasselbe.');
	});

	it('nennt bei geheimer Abstimmung keine Zahlen', () => {
		const r = zaehleAus(lage()).vertretungImAusstand!;
		const { leitung, protokoll } = andereLesartInWorten(r, true);
		expect(leitung).not.toContain('Kopfstimmen');
		expect(protokoll).not.toContain('Kopfstimmen');
	});

	it('zählt eine vom Vertreter erfasste Stimme auch in der zweiten Rechnung nicht (Fachprüfung, N-1)', () => {
		const mitVertreterstimme = lage(EINFACH, stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no'], ['p5', 'yes']));
		const a = zaehleAus(mitVertreterstimme);
		expect(a.koepfe).toMatchObject({ ja: 2, basis: 3 });
		expect(a.vertretungImAusstand).toMatchObject({ angenommen: false, abweichend: true });
		expect(a.vertretungImAusstand?.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3 });
	});

	it('rechnet aus der Handzählung dasselbe', () => {
		const { stimmen: _s, ...ohne } = lage();
		const a = zaehleSummenAus(ohne, { ja: 2, nein: 1, enthaltung: 0 });
		expect(a.angenommen).toBe(true);
		expect(a.vertretungImAusstand).toMatchObject({ angenommen: false, abweichend: true });
		expect(a.vertretungImAusstand?.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3 });
	});

	it('fällt weg, wenn kein Beschluss gefasst wird', () => {
		const a = mitKeinemBeschluss(zaehleAus(lage()), { grund: 'zurueckgezogen' } as never);
		expect(a.vertretungImAusstand).toBeNull();
		expect(a.protokollhinweise?.some((h) => h.satz.includes('Rz. 181'))).toBe(false);
	});
});

describe('B3 wirkt nur, wo die Partei aus der Zahl fällt', () => {
	it('nicht unter einer älteren Fassung, damit frühere Protokolle bleiben', () => {
		const alt = lage({ ...EINFACH, fassung: '2026-11-04' });
		expect(vertretungImAusstandWirkt(alt)).toBe(false);
		expect(zaehleAus(alt).vertretungImAusstand ?? null).toBeNull();
	});

	it('nicht unter einer Fassung ohne Datum, wie am Rückkommen (Codeprüfung Block 3, M2)', () => {
		for (const fassung of ['von-hand', 'weisungsregel', 'ordnungsantrag-2026-08-05']) {
			expect(vertretungImAusstandWirkt(lage({ ...EINFACH, fassung }))).toBe(false);
		}
	});

	it('nicht ohne ruhende Vollmacht aus einem Ausstand', () => {
		const ohne = { ...lage(), vertretungen: [] };
		expect(zaehleAus(ohne).vertretungImAusstand ?? null).toBeNull();
	});

	it('nicht an einem Mehr aller, wo die Partei schon in der Zahl steht', () => {
		const alle = lage({ ...EINFACH, kopfbasis: 'alle_eigentuemer' });
		expect(vertretungImAusstandWirkt(alle)).toBe(false);
	});

	it('am Mehr der anwesenden Wertquoten auch für die Quoten', () => {
		const qualifiziert: Erfordernis = {
			...EINFACH,
			typ: 'qualifiziertes_mehr',
			quotenbasis: 'anwesend_vertreten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		const r = zaehleAus(lage(qualifiziert)).vertretungImAusstand!;
		expect(r.quoten).toMatchObject({ ja: 400, basis: 800 });
		expect(r.angenommen).toBe(false);
		expect(r.nurBei).toBeUndefined();
	});

	it('spricht bei Köpfen über alle nur von den Wertquoten (Review DeepSeek, N-3)', () => {
		const gemischt: Erfordernis = {
			...EINFACH,
			typ: 'qualifiziertes_mehr',
			kopfbasis: 'alle_eigentuemer',
			quotenbasis: 'anwesend_vertreten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		// p1 bis p3 Ja: 3 von 4 Köpfen (p4 im Ausstand fällt aus der Zahl), 600
		// von 600 Wertquoten; mit p5 600 von 800.
		const a = zaehleAus(lage(gemischt, stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'])));
		const r = a.vertretungImAusstand!;
		expect(r.nurBei).toBe('wertquoten');
		expect(r.koepfe).toMatchObject({ ja: a.koepfe.ja, basis: a.koepfe.basis });
		const { leitung, protokoll } = andereLesartInWorten(r, false);
		expect(leitung).toBe(
			'Votum zählt die Wertquoten ohne die Parteien, deren einziger Vertreter im Ausstand ist. Bei den Köpfen ' +
				'zählen diese Parteien schon mit, weil beim Mehr nach Köpfen auch die Abwesenden mitzählen. Zählen diese ' +
				'Parteien auch bei den Wertquoten ohne Stimme mit, wie ungültige Stimmen (SVIT-Kommentar Rz. 181 ad ' +
				'Art. 712m), wirken sie wie ein Nein. Das Ergebnis wäre dasselbe.'
		);
		expect(protokoll).toBeNull();
	});

	/*
	 * **Der Spiegelfall ist der gesetzliche** (Fachprüfung Runde 4, M-4): Beim
	 * qualifizierten Mehr zählen die Köpfe über die Anwesenden, die Wertquoten
	 * über alle (Rz. 191 ad Art. 712m). Dort steht die Partei bei den Wertquoten
	 * schon in der Zahl, und nur die Köpfe ändern sich.
	 */
	it('spricht bei Wertquoten über alle nur von den Köpfen (Fachprüfung, M-4)', () => {
		const gesetzlich: Erfordernis = {
			...EINFACH,
			typ: 'qualifiziertes_mehr',
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		};
		const m: Snapshot = {
			...FUENF,
			parties: FUENF.parties.map((p, i) => ({ ...p, units: [{ ...p.units[0], quota: [300, 300, 50, 50, 300][i] }] }))
		};
		const a = zaehleAus({ ...lage(gesetzlich), momentaufnahme: m });
		expect(a.angenommen).toBe(true);
		const r = a.vertretungImAusstand!;
		expect(r).toMatchObject({ nurBei: 'koepfe', angenommen: false, abweichend: true });
		expect(r.quoten).toMatchObject({ ja: a.quoten.ja, basis: a.quoten.basis });
		const { leitung, protokoll } = andereLesartInWorten(r, false);
		expect(leitung).toContain(
			'Votum zählt die Köpfe ohne die Parteien, deren einziger Vertreter im Ausstand ist, und verkündet die ' +
				'Annahme. Bei den Wertquoten zählen diese Parteien schon mit, weil beim Mehr nach Wertquoten auch ' +
				'die Abwesenden mitzählen. Im Saal ist dazu nichts zu entscheiden;'
		);
		expect(leitung).toContain('Zählen diese Parteien auch bei den Köpfen ohne Stimme mit');
		expect(protokoll).toContain(
			'Verkündet ist die Annahme. Die Köpfe sind dabei ohne die Parteien gezählt, deren einziger Vertreter im ' +
				'Ausstand ist. Bei den Wertquoten zählen diese Parteien schon mit'
		);
		expect(protokoll).toContain('wirken sie wie ein Nein. Der Antrag wäre dann abgelehnt gewesen.');
	});
});

describe('B3: die Sätze', () => {
	it('bleiben in jedem Zweig unter 180 Zeichen (Codeprüfung Block 3, N1)', () => {
		const ab = zaehleAus(lage()).vertretungImAusstand!;
		const gleich = zaehleAus(lage(EINFACH, stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes']))).vertretungImAusstand!;
		const seiten = [undefined, 'koepfe', 'wertquoten'] as const;
		for (const r of seiten.flatMap((nurBei) => [{ ...ab, nurBei }, { ...gleich, nurBei }])) {
			const { leitung, protokoll } = andereLesartInWorten(r, false);
			for (const satz of `${leitung} ${protokoll ?? ''}`.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ«])/)) {
				expect(satz.length).toBeLessThanOrEqual(180);
			}
		}
	});
});
