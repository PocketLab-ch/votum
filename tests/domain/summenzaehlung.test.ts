/**
 * Die Summen-Erfassung: von Hand gezählt, ohne Zuordnung zu Personen.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «ich vermute dass die Sitzung mit
 * Handzählen ist […] So setzt es voraus, dass ich jeden Eigentümer kenne und
 * die Stimmen richtig setze. Also beim einfachen Mehr. Wenn müsste man dort die
 * totale Anzahl an Ja, Nein und Enthaltung eintragen können.»
 *
 * **Und ausdrücklich zusätzlich, nicht statt:** «Ich finde es eigentlich gut,
 * dass ich einzelne Stimme mit den Bulletpoints erfassen kann. Ohne Zuordnung
 * wäre einfach noch zusätzlich. So bleibt man flexibel, je situation.»
 *
 * Was hier geprüft wird, ist zur Hälfte, was die Rechnung **kann**, und zur
 * anderen, was sie **verweigert**. Der zweite Teil ist der wichtigere: Eine
 * Handzählung, die ein qualifiziertes Mehr auszählte, gäbe eine Wertquotenzahl
 * an, die es nicht gibt.
 */
import { describe, expect, it } from 'vitest';
import {
	ergebnisInWorten,
	ergebniswertung,
	NICHT_IM_STAND,
	summenhindernis,
	summenvermerkNoetig,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '../../src/lib/domain/auszaehlung';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';
import type { HeadCountMode, Snapshot } from '../../src/lib/domain/types';

function momentaufnahme(
	anzahl: number,
	zaehlweise: HeadCountMode = 'per_owner',
	tieBreak: 'keiner' | 'wertquote' | 'verwalter' = 'keiner',
	einheitenJePartei = 1
): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-09-15T17:00:00.000Z',
		headCountMode: zaehlweise,
		parkingCountsAsHead: true,
		headCountRuleSource: null,
		tieBreak,
		totalQuota: anzahl * einheitenJePartei * 100,
		parties: Array.from({ length: anzahl }, (_, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${i + 1}`,
			representativeName: null,
			isCommunity: false,
			units: Array.from({ length: einheitenJePartei }, (_, j) => ({
				unitId: `p${i + 1}-u${j + 1}`,
				label: `Whg ${i + 1}.${j + 1}`,
				kind: 'unit' as const,
				countsAsHead: true,
				quota: 100
			}))
		}))
	};
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
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

const QUALIFIZIERTES_MEHR: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-baulich-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};

const EINSTIMMIGKEIT: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-zweckaenderung',
	typ: 'einstimmigkeit',
	titel: 'Einstimmigkeit',
	rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
	kopfbasis: 'alle_eigentuemer',
	kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }
};

/** Die Änderung der Wertquoten: einfaches Mehr, Zustimmung nachher (ZGB Art. 712e Abs. 2). */
const WERTQUOTEN: Erfordernis = {
	...EINFACHES_MEHR,
	knotenId: 'k-wertquoten-aendern',
	titel: 'Änderung der Wertquoten',
	rechtsgrundlage: 'ZGB Art. 712e Abs. 2',
	zustimmungBetroffenerNoetig: true
};

function lage(
	m: Snapshot,
	u: Partial<Omit<Auszaehlungslage, 'stimmen' | 'momentaufnahme'>> = {}
): Omit<Auszaehlungslage, 'stimmen'> {
	return {
		momentaufnahme: m,
		erfordernis: EINFACHES_MEHR,
		anwesende: m.parties.map((p) => p.partyId),
		...u
	};
}

describe('Wo eine Handzählung nicht genügt', () => {
	it('weist das qualifizierte Mehr ab — Wertquoten hängen an der Einheit', () => {
		const grund = summenhindernis(QUALIFIZIERTES_MEHR);
		expect(grund).toContain('Wertquoten');
		expect(grund).toContain('einzelnen Stimmen');
	});

	it('weist die Einstimmigkeit ab — dort zählt, WER nicht zugestimmt hat', () => {
		expect(summenhindernis(EINSTIMMIGKEIT)).toContain('wer nicht');
	});

	it('weist ein Erfordernis ab, das die Zustimmung Betroffener verlangt', () => {
		const e = { ...EINFACHES_MEHR, zustimmungBetroffenerNoetig: true };
		expect(summenhindernis(e)).toContain('712g');
	});

	/*
	 * Bis A3c stand hier die Probe, dass die Absage bei den Wertquoten
	 * Art. 712e Abs. 2 nennt. Seit dem Produktentscheid 26.09.2026 («es sollte
	 * eigentlich möglich sein, mit Kommentar») gibt es die Absage nicht mehr;
	 * was an ihre Stelle tritt, prüft der Block «Handzählung bei den Wertquoten».
	 */
	it('lässt die Handzählung bei den Wertquoten zu (Block A3c)', () => {
		expect(summenhindernis(WERTQUOTEN)).toBeNull();
	});

	it('weist die Kenntnisnahme und den Grenzfall ab', () => {
		expect(summenhindernis({ ...EINFACHES_MEHR, typ: 'keine_abstimmung' })).toContain(
			'Kenntnis'
		);
		expect(summenhindernis({ ...EINFACHES_MEHR, typ: 'grenzfall' })).toContain(
			'Mehrheitserfordernis'
		);
	});

	it('lässt das einfache Mehr durch', () => {
		expect(summenhindernis(EINFACHES_MEHR)).toBeNull();
	});

	/*
	 * Die Sichtprobe zum Wächter: Die Rechnung selbst muss die Grenze halten,
	 * nicht nur die Oberfläche. Ein Aufruf mit qualifiziertem Mehr darf nicht
	 * eine Zahl liefern, die es nicht gibt.
	 */
	it('rechnet ein qualifiziertes Mehr gar nicht erst aus', () => {
		expect(() =>
			zaehleSummenAus(lage(momentaufnahme(5), { erfordernis: QUALIFIZIERTES_MEHR }), {
				ja: 4,
				nein: 1,
				enthaltung: 0
			})
		).toThrow(FachlicherFehler);
	});
});

describe('Die Rechnung selbst', () => {
	it('nimmt an, was die Mehrheit der Anwesenden hat', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 3, nein: 2, enthaltung: 0 });
		expect(a.koepfe.basis).toBe(5);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.angenommen).toBe(true);
	});

	it('lehnt ab, wo die Mehrheit fehlt', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 2, nein: 3, enthaltung: 0 });
		expect(a.angenommen).toBe(false);
	});

	/*
	 * **Eine Enthaltung wirkt beim einfachen Mehr wie ein Nein** — sie bleibt in
	 * der Bezugsgrösse. AD-15: Die Eimer werden nie ineinander überführt.
	 */
	it('lässt Enthaltungen in der Bezugsgrösse stehen', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 2, nein: 1, enthaltung: 2 });
		expect(a.koepfe.enthaltung).toBe(2);
		expect(a.koepfe.basis).toBe(5);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.angenommen).toBe(false);
	});

	/*
	 * Wer da ist und die Hand nicht hebt, ist ein eigener Eimer — nicht eine
	 * Enthaltung. Das ist derselbe Punkt wie in `zaehleAus`.
	 */
	it('füllt den Eimer «ohne Abgabe» aus der Differenz zu den Anwesenden', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 2, nein: 1, enthaltung: 0 });
		expect(a.koepfe.ohneAbgabe).toBe(2);
		expect(a.koepfe.enthaltung).toBe(0);
		expect(a.koepfe.basis).toBe(5);
	});

	it('zählt Abwesende getrennt und lässt sie beim einfachen Mehr aus der Basis', () => {
		const m = momentaufnahme(5);
		const a = zaehleSummenAus(lage(m, { anwesende: ['p1', 'p2', 'p3'] }), {
			ja: 2,
			nein: 1,
			enthaltung: 0
		});
		expect(a.koepfe.nichtAnwesend).toBe(2);
		expect(a.koepfe.basis).toBe(3);
		expect(a.angenommen).toBe(true);
	});

	it('weist mehr Stimmen ab, als Kopfstimmen im Saal sind', () => {
		expect(() =>
			zaehleSummenAus(lage(momentaufnahme(3)), { ja: 3, nein: 1, enthaltung: 0 })
		).toThrow(/Mehr Stimmen als Stimmberechtigte/);
	});

	it('weist gebrochene und negative Zahlen ab', () => {
		expect(() => zaehleSummenAus(lage(momentaufnahme(5)), { ja: 1.5, nein: 0, enthaltung: 0 })).toThrow(
			FachlicherFehler
		);
		expect(() => zaehleSummenAus(lage(momentaufnahme(5)), { ja: 1, nein: -1, enthaltung: 0 })).toThrow(
			FachlicherFehler
		);
	});

	it('rechnet bei der Zählung je Einheit mit den Kopfstimmen, nicht mit den Parteien', () => {
		// Drei Parteien mit je zwei Einheiten: sechs Kopfstimmen.
		const m = momentaufnahme(3, 'per_unit', 'keiner', 2);
		const a = zaehleSummenAus(lage(m), { ja: 4, nein: 2, enthaltung: 0 });
		expect(a.koepfe.basis).toBe(6);
		expect(a.koepfe.schwelle).toBe(4);
		expect(a.angenommen).toBe(true);
	});
});

describe('Was die Rechnung nicht weiss, sagt sie', () => {
	it('nennt die fehlende Zuordnung und den Vermerk', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), {
			ja: 3,
			nein: 2,
			enthaltung: 0,
			vermerk: 'Handzeichen, gezählt von der Sitzungsleitung'
		});
		const satz = a.hinweise.join(' ');
		expect(satz).toContain('ohne Zuordnung');
		expect(satz).toContain('Handzeichen, gezählt von der Sitzungsleitung');
		expect(satz).toContain('Wertquoten sind nicht erhoben');
	});

	it('lässt die Liste der fehlenden Zustimmungen leer — mit Hinweis', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 3, nein: 2, enthaltung: 0 });
		expect(a.ohneZustimmung).toEqual([]);
		expect(a.hinweise.join(' ')).toContain('wer wie gestimmt hat');
	});

	/*
	 * **«Nicht erhoben» ist nicht «null».** Ohne dieses Merkmal stünde in der
	 * Ergebniskarte und im Auswertungsblatt «0 ja · 0 nein» — eine Zahl, die
	 * niemand gezählt hat, in einem Dokument, das später als Beleg gelesen wird.
	 */
	it('meldet den Quotenspiegel als NICHT ERHOBEN, nicht als null Zustimmung', () => {
		const a = zaehleSummenAus(lage(momentaufnahme(5)), { ja: 3, nein: 2, enthaltung: 0 });
		expect(a.quotenErhoben).toBe(false);
		expect(a.quoten.ja).toBe(0);
		expect(a.quoten.schwelle).toBeNull();
		// `erreicht` heisst hier «keine Schranke im Weg», nicht «Quoten erfüllt».
		expect(a.quoten.erreicht).toBe(true);
	});
});

/*
 * **Die Betroffenen fallen aus der Basis, wie bei der Einzelzählung** (seit
 * 25.09.2026). Bei der Ermächtigung zur Ausschlussklage nennt das Gesetz die
 * Basis selbst: alle Miteigentümer «mit Ausnahme des Beklagten» (ZGB
 * Art. 649b Abs. 2). Die Handzählung übersprang bis dahin nur den Ausstand und
 * rechnete den Beklagten mit.
 */
describe('Betroffene unter alle_ausser_betroffene', () => {
	const AUSSCHLUSSKLAGE: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-ausschlussklage',
		titel: 'Ermächtigung zur Ausschlussklage',
		rechtsgrundlage: 'ZGB Art. 649b Abs. 2',
		kopfbasis: 'alle_ausser_betroffene'
	};

	it('rechnet bei zehn Eigentümern mit einem Beklagten auf 5 von 9, nicht 6 von 10', () => {
		// Derselbe Fall wie im Hinweis der Regelwerkskarte `k-ausschlussklage`.
		const m = momentaufnahme(10);
		const a = zaehleSummenAus(
			lage(m, { erfordernis: AUSSCHLUSSKLAGE, betroffeneParteiIds: ['p10'] }),
			{ ja: 5, nein: 4, enthaltung: 0 }
		);
		expect(a.koepfe.basis).toBe(9);
		expect(a.koepfe.schwelle).toBe(5);
		expect(a.angenommen).toBe(true);
	});

	it('ergibt dieselbe Basis wie die Einzelzählung', () => {
		// Zwei Fassungen derselben Regel waren auseinandergelaufen; diese Probe
		// hält sie zusammen, auch mit einem Abwesenden und einem Ausstand.
		const m = momentaufnahme(10);
		const gemeinsam = {
			erfordernis: AUSSCHLUSSKLAGE,
			betroffeneParteiIds: ['p10'],
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p10'],
			imAusstand: ['p8']
		};
		const vonHand = zaehleSummenAus(lage(m, gemeinsam), { ja: 4, nein: 2, enthaltung: 0 });
		const einzeln = zaehleAus({ ...lage(m, gemeinsam), stimmen: [] });
		expect(vonHand.koepfe.basis).toBe(einzeln.koepfe.basis);
		expect(vonHand.koepfe.basis).toBe(8);
	});

	it('sagt, dass sie nicht prüfen kann, ob der Beklagte die Hand hob', () => {
		// Wie beim Ausstand: Die Vorabprüfung fängt eine Hand zu viel nur, wenn
		// alle Anwesenden gezählt wurden.
		const m = momentaufnahme(10);
		const a = zaehleSummenAus(
			lage(m, { erfordernis: AUSSCHLUSSKLAGE, betroffeneParteiIds: ['p10'] }),
			{ ja: 5, nein: 3, enthaltung: 0 }
		);
		expect(a.hinweise.join(' ')).toContain('1 anwesende Partei ist unmittelbar betroffen');
		expect(a.hinweise.join(' ')).toContain('kann die Anwendung nicht prüfen');
	});

	it('lässt keine Hand des Beklagten zu', () => {
		// Alle zehn im Saal, zehn Hände gezählt: Eine davon kann nicht mitzählen.
		const m = momentaufnahme(10);
		expect(() =>
			zaehleSummenAus(
				lage(m, { erfordernis: AUSSCHLUSSKLAGE, betroffeneParteiIds: ['p10'] }),
				{ ja: 6, nein: 4, enthaltung: 0 }
			)
		).toThrow(/Mehr Stimmen als Stimmberechtigte/);
	});

	it('lässt die Vollmacht des Beklagten ruhen, ohne dass er im Ausstand ist', () => {
		/*
		 * Fachprüfung 25.09.2026 (BGE 134 III 481 E. 3.8, übertragen auf
		 * Art. 649b Abs. 2): Der Beklagte kann niemanden vertreten. p10 ist
		 * beklagt und hält die Vollmacht von p9; im Saal sitzen nur diese zwei
		 * und p1 bis p3. p9 kann keine Stimme abgeben, es gibt also drei
		 * Kopfstimmen im Saal, nicht vier.
		 */
		const m = momentaufnahme(10);
		const gemeinsam = {
			erfordernis: AUSSCHLUSSKLAGE,
			betroffeneParteiIds: ['p10'],
			anwesende: ['p1', 'p2', 'p3', 'p9', 'p10'],
			vertretungen: [{ vertreteneId: 'p9', bevollmaechtigtId: 'p10' }]
		};
		expect(() =>
			zaehleSummenAus(lage(m, gemeinsam), { ja: 4, nein: 0, enthaltung: 0 })
		).toThrow(/Mehr Stimmen als Stimmberechtigte/);
		const a = zaehleSummenAus(lage(m, gemeinsam), { ja: 3, nein: 0, enthaltung: 0 });
		expect(a.koepfe.nichtAnwesend).toBe(6);
		expect(a.hinweise.join(' ')).toMatch(/«Partei 9» war nur über Partei 10 vertreten/);
		expect(a.hinweise.join(' ')).toMatch(/als unmittelbar betroffen/);
	});
});

describe('Ausstand und Stichentscheid', () => {
	it('nimmt die im Ausstand aus der Bezugsgrösse und sagt, was es nicht prüfen kann', () => {
		const m = momentaufnahme(5);
		const a = zaehleSummenAus(lage(m, { imAusstand: ['p5'] }), {
			ja: 3,
			nein: 1,
			enthaltung: 0
		});
		expect(a.koepfe.basis).toBe(4);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.angenommen).toBe(true);
		expect(a.hinweise.join(' ')).toContain('kann die Anwendung nicht prüfen');
	});

	/*
	 * Der Punkt, an dem eine Handzählung an ihre Grenze kommt: Der Gleichstand
	 * ist nach dem Reglement von der Anteilsberechtigung zu entscheiden — und
	 * die gibt es hier nicht. Ihn zu übergehen hiesse, eine Ablehnung zu
	 * verkünden, die das Reglement nicht vorsieht.
	 */
	it('lässt den Quoten-Stichentscheid offen statt ihn zu übergehen', () => {
		const m = momentaufnahme(4, 'per_owner', 'wertquote');
		const a = zaehleSummenAus(lage(m), { ja: 2, nein: 2, enthaltung: 0 });
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toContain('einzeln');
	});

	it('nennt den offenen Quoten-Stichentscheid im Protokollsatz ohne Ergebnis', () => {
		// Der dritte Zustand der `ergebnislage` lebt seit dem 27.09.2026 nur noch
		// hier: in der Handzählung, wo sich die Wertquoten nicht ablesen lassen.
		const m = momentaufnahme(4, 'per_owner', 'wertquote');
		const a = zaehleSummenAus(lage(m), { ja: 2, nein: 2, enthaltung: 0 });
		expect(ergebniswertung(a, EINFACHES_MEHR)).toBe(
			'Stimmengleichheit; ein Ergebnis steht noch nicht fest.'
		);
	});

	/*
	 * **Der Code-Fehler in der Handzählung, behoben am 27.09.2026.** Auch hier
	 * galt «Ja gleich Nein» allein; zählten Enthaltungen mit, war das verfehlte
	 * Mehr ein scheinbares Patt. Vor dem Fix stand hier ein offener
	 * Stichentscheid.
	 */
	it('erkennt ein verfehltes Mehr mit Enthaltungen nicht als Gleichstand', () => {
		const m = momentaufnahme(8, 'per_owner', 'wertquote');
		const a = zaehleSummenAus(lage(m), { ja: 3, nein: 3, enthaltung: 2 });
		expect(a.koepfe.basis).toBe(8);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(false);
		expect(a.angenommen).toBe(false);
	});

	it('hält am echten Patt aus drei gegen drei fest', () => {
		// Ohne Enthaltungen ist die halbe Basis genau die Zahl der Ja-Stimmen.
		const m = momentaufnahme(6, 'per_owner', 'wertquote');
		const a = zaehleSummenAus(lage(m), { ja: 3, nein: 3, enthaltung: 0 });
		expect(a.koepfe.basis).toBe(6);
		expect(a.stichentscheidOffen).toBe(true);
	});

	it('hält bei der Verwalter-Klausel an, solange der Entscheid fehlt', () => {
		const m = momentaufnahme(4, 'per_owner', 'verwalter');
		const a = zaehleSummenAus(lage(m), { ja: 2, nein: 2, enthaltung: 0 });
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.durchStichentscheid).toBe(false);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toContain('entscheidet der Verwalter');
		expect(a.hinweise.join(' ')).toContain('empfiehlt die Ablehnung');
	});

	it('wendet einen eingetragenen Verwalter-Entscheid an', () => {
		const m = momentaufnahme(4, 'per_owner', 'verwalter');
		const a = zaehleSummenAus(
			lage(m, { stichentscheid: { wahl: 'yes', wer: 'A. Verwalter' } }),
			{ ja: 2, nein: 2, enthaltung: 0 }
		);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.angenommen).toBe(true);
	});
});

/*
 * **Handzählung bei den Wertquoten** (Block A3c, Produktentscheid 26.09.2026).
 * Die Versammlung genehmigt mit einfachem Mehr, die Zustimmung der Betroffenen
 * kommt nachher mit der Unterschrift auf der Abänderungsurkunde. Die
 * Handzählung weiss nicht, wer wie gestimmt hat, muss aber trotzdem sagen,
 * wessen Unterschrift aussteht. Sonst verschwiegen Leinwand und Protokoll es.
 */
describe('Handzählung bei den Wertquoten', () => {
	const ZEIT = '2026-09-15T19:10:00.000Z';

	it('führt die eingetragenen Betroffenen als ausstehend, samt der Partei ausserhalb des Stands', () => {
		const m = momentaufnahme(5);
		const a = zaehleSummenAus(
			lage(m, { erfordernis: WERTQUOTEN, betroffeneParteiIds: ['p4', 'p2', 'p-weg'] }),
			{ ja: 3, nein: 2, enthaltung: 0, vermerk: 'Handzeichen' }
		);
		expect(a.angenommen).toBe(true);
		expect(a.betroffene.noetig).toBe(true);
		expect(a.betroffene.form).toBe('nachher');
		expect(a.betroffene.erfuellt).toBe(true);
		// Reihenfolge der Momentaufnahme, dann wer nicht im Stand steht.
		expect(a.betroffene.ausstehend).toEqual([
			{ parteiId: 'p2', name: 'Partei 2' },
			{ parteiId: 'p4', name: 'Partei 4' },
			{ parteiId: 'p-weg', name: NICHT_IM_STAND }
		]);
		// Wer im Saal Ja sagte, weiss die Handzählung nicht.
		expect(a.betroffene.zugestimmt).toEqual([]);
		expect(a.betroffene.fehlend).toEqual([]);
		expect(a.hinweise.join(' ')).toContain('nicht im Stimmberechtigtenstand steht (p-weg)');
	});

	it('bildet dieselbe Liste wie die Einzelzählung, auch mit Ausstand und Ja im Saal', () => {
		// Eine Stelle für beide Wege: `ausstehendeZustimmungen`. Läuft einer
		// davon, verschweigt der andere eine Unterschrift.
		const m = momentaufnahme(6);
		const gemeinsam = {
			erfordernis: WERTQUOTEN,
			betroffeneParteiIds: ['p5', 'p1', 'p3', 'p-weg'],
			anwesende: ['p1', 'p2', 'p3', 'p4', 'p5'],
			imAusstand: ['p3']
		};
		const vonHand = zaehleSummenAus(lage(m, gemeinsam), { ja: 2, nein: 1, enthaltung: 0 });
		const einzeln = zaehleAus({
			...lage(m, gemeinsam),
			stimmen: [
				{ unitId: 'p1-u1', partyId: 'p1', choice: 'yes', castAt: ZEIT, recordedByChair: false },
				{ unitId: 'p5-u1', partyId: 'p5', choice: 'no', castAt: ZEIT, recordedByChair: false }
			]
		});
		expect(vonHand.betroffene.ausstehend).toEqual(einzeln.betroffene.ausstehend);
		expect(vonHand.betroffene.ausstehend.map((x) => x.parteiId)).toEqual([
			'p1',
			'p3',
			'p5',
			'p-weg'
		]);
	});

	it('nennt die ausstehende Unterschrift im Ergebnissatz, mit Namen im Haus und ohne am Abend', () => {
		const m = momentaufnahme(5);
		const a = zaehleSummenAus(
			lage(m, { erfordernis: WERTQUOTEN, betroffeneParteiIds: ['p2'] }),
			{ ja: 3, nein: 1, enthaltung: 0, vermerk: 'Handzeichen' }
		);
		const haus = ergebnisInWorten(a, WERTQUOTEN, { namentlich: true });
		expect(haus).toMatch(/^Angenommen \(Genehmigung\)/);
		expect(haus).toContain('Abänderungsurkunde unterzeichnet haben (Partei 2)');
		const abend = ergebnisInWorten(a, WERTQUOTEN, { namentlich: false });
		expect(abend).toContain('Abänderungsurkunde');
		expect(abend).not.toMatch(/\bPartei 2\b/);
	});

	it('weist die Handzählung ab, wenn niemand als betroffen eingetragen ist', () => {
		// Sonst hiesse es «angenommen», und niemandes Unterschrift stünde aus.
		expect(() =>
			zaehleSummenAus(lage(momentaufnahme(5), { erfordernis: WERTQUOTEN }), {
				ja: 3,
				nein: 2,
				enthaltung: 0,
				vermerk: 'Handzeichen'
			})
		).toThrow(/niemand als betroffen bezeichnet/);
	});

	it('verlangt den Vermerk nur bei den Wertquoten', () => {
		expect(summenvermerkNoetig(WERTQUOTEN)).toMatch(/Vermerk Pflicht/);
		expect(summenvermerkNoetig(EINFACHES_MEHR)).toBeNull();
		// Die Nutzungsrechte bleiben gesperrt; einen Vermerk braucht es dort nicht,
		// weil es keine Handzählung gibt.
		const nutzungsrecht = {
			...EINFACHES_MEHR,
			knotenId: 'k-nutzungsrecht-zuteilung',
			zustimmungBetroffenerNoetig: true
		};
		expect(summenhindernis(nutzungsrecht)).toContain('712g');
		expect(summenvermerkNoetig(nutzungsrecht)).toBeNull();
	});

	it('fragt im Vermerk nicht nach den Betroffenen: er steht auch im Abenddokument', () => {
		// Wer nach dem Verhalten der Betroffenen fragt, bekommt Namen in ein
		// Dokument, das keine trägt (10.09.2026).
		expect(summenvermerkNoetig(WERTQUOTEN)).not.toMatch(/wie die Betroffenen|Betroffenen gestimmt/);
	});
});

describe('Der Hinweis zur Handzählung', () => {
	it('setzt nach dem Vermerk einen Punkt, auch wenn der Vermerk selbst einen trägt', () => {
		const ohnePunkt = zaehleSummenAus(lage(momentaufnahme(5)), {
			ja: 3,
			nein: 2,
			enthaltung: 0,
			vermerk: 'Handzeichen'
		});
		expect(ohnePunkt.hinweise[0]).toContain('Personen: Handzeichen. Es ist deshalb');
		const mitPunkt = zaehleSummenAus(lage(momentaufnahme(5)), {
			ja: 3,
			nein: 2,
			enthaltung: 0,
			vermerk: 'Handzeichen.'
		});
		expect(mitPunkt.hinweise[0]).toContain('Personen: Handzeichen. Es ist deshalb');
	});
});
