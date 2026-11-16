/**
 * Lesart L3: die Zählung an der Einsprache in einer Gemeinschaft je Einheit
 * (Fassung 2026-10-28, Migration 172; Konzept Lesarten, Block 5).
 *
 * - **Vorgabe** ist je Eigentümer (Rz. 181 ad Art. 712m); wählbar ist je
 *   Einheit (Rz. 185 ad Art. 712c mit Rz. 186 ad Art. 712m). Das Ergebnis nach
 *   der anderen Zählweise steht daneben.
 * - **Nur in einer Gemeinschaft je Einheit**: Zählt die Gemeinschaft je
 *   Eigentümer, ändert sich nichts.
 * - **Ältere Fassungen** (bis 2026-10-27) zählen weiter je Einheit, mit dem
 *   bisherigen Hinweis.
 *
 * Beispiel aus dem Katalog: zwei Eigentümer mit je einer Wohnung dafür, einer
 * mit drei Wohnungen dagegen — je Eigentümer 2 zu 1 (beschlossen), je Einheit
 * 2 zu 3 (abgelehnt).
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartenVon,
	andereLesartInWorten,
	kopfstimmenAn,
	pruefeAndereDreizahl,
	einsprachelesartProtokollsatz,
	einspracheZaehlhilfe,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage,
	type Handzaehlung
} from '$lib/domain/auszaehlung';
import {
	EINSPRACHE_KNOTEN,
	einspracheZaehlweiseHinweis,
	ergebniskarte,
	kennzahlenNachZaehlweise,
	zaehlweiseBeiEinsprache,
	zaehlweiseFuer,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import {
	darfLesartenUmstellen,
	einsprachelesartKartensatz,
	einsprachelesartVon,
	LESARTEN,
	lesartVon,
	wahlInWorten,
	type Einsprachewahl
} from '$lib/domain/lesarten';
import { REGELWERK_2026_10_27 } from '$lib/rules/quorum-2026-10-27';
import { REGELWERK_2026_10_28 } from '$lib/rules/quorum-2026-10-28';
import { zahlenbeispielNachZaehlweise, type Reglementsregel } from '$lib/domain/reglement';
import { auszaehlungVonHand, type VonHandEingabe } from '$lib/domain/vonhand';
import { kopfgewicht } from '$lib/domain/eigentuemer';
import { baueAuszaehlmappe, type Mappenposten } from '$lib/domain/auszaehlmappe';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

/** Eine Gemeinschaft je Einheit: p1 hat 1, p2 hat 1, p3 hat 3 kopfstimmentragende Einheiten. */
function snapshotJeEinheit(): Snapshot {
	const einheiten = (id: string, n: number, quota: number) =>
		Array.from({ length: n }, (_, i) => ({
			unitId: `${id}-u${i + 1}`,
			label: `Whg ${id} ${i + 1}`,
			kind: 'unit' as const,
			countsAsHead: true,
			quota
		}));
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-28T17:00:00.000Z',
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			{ partyId: 'p1', displayName: 'Partei 1', representativeName: null, isCommunity: false, units: einheiten('p1', 1, 100) },
			{ partyId: 'p2', displayName: 'Partei 2', representativeName: null, isCommunity: false, units: einheiten('p2', 1, 300) },
			{ partyId: 'p3', displayName: 'Partei 3', representativeName: null, isCommunity: false, units: einheiten('p3', 3, 200) }
		]
	};
}

/** Dasselbe je Eigentümer. */
function snapshotJeEigentuemer(): Snapshot {
	return { ...snapshotJeEinheit(), headCountMode: 'per_owner' };
}

function einsprache(fassung: string, lesart?: Einsprachewahl): Erfordernis {
	return {
		fassung,
		juristischGegengelesen: false,
		astId: 'a-sonderfaelle',
		knotenId: EINSPRACHE_KNOTEN,
		typ: 'einfaches_mehr',
		titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
		rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
		kopfbasis: 'anwesend_vertreten',
		quotenbasis: 'keine',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenSchwelle: null,
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'hergeleitet',
		...(lesart ? { einspracheLesart: lesart } : {})
	};
}

/** Eine Stimme je Einheit der Partei; alle Einheiten stimmen gleich. */
function stimme(partei: Snapshot['parties'][number], wahl: VoteChoice): Vote[] {
	return partei.units.map((u) => ({
		partyId: partei.partyId,
		unitId: u.unitId,
		choice: wahl,
		castAt: '2026-10-28T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** p1 und p2 Ja, p3 Nein. */
function lage(erfordernis: Erfordernis, m: Snapshot = snapshotJeEinheit()): Auszaehlungslage {
	return {
		momentaufnahme: m,
		erfordernis,
		stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'yes'), ...stimme(m.parties[2], 'no')],
		anwesende: ['p1', 'p2', 'p3']
	};
}

describe('L3 im Katalog (Kriterium 1)', () => {
	it('führt die Lesart mit Vorgabe je Eigentümer und beiden Wahlen', () => {
		const l3 = lesartVon('L3')!;
		expect(l3.vorgabe).toBe('je_eigentuemer');
		expect(l3.wahlen.map((w) => w.wert)).toEqual(['je_eigentuemer', 'je_einheit']);
		expect(LESARTEN.some((l) => l.kennung === 'L3')).toBe(true);
		expect(wahlInWorten('L3', 'je_eigentuemer')).toContain('Vorgabe');
	});

	it('kennt die Rechte wie L1: nur die Verwaltung, und die Leitung mit Erlaubnis', () => {
		expect(darfLesartenUmstellen('admin', 'verwaltung')).toBe(true);
		expect(darfLesartenUmstellen('chair', 'verwaltung')).toBe(false);
		expect(darfLesartenUmstellen('chair', 'verwaltung_und_leitung')).toBe(true);
	});

	it('eine Partei nur mit einem Nebenobjekt ohne Kopfstimme hat je Eigentümer 1, je Einheit 0', () => {
		const partei = {
			units: [{ kind: 'parking' as const, countsAsHead: false }]
		};
		expect(kopfgewicht(partei, 'per_owner', false)).toBe(1);
		expect(kopfgewicht(partei, 'per_unit', false)).toBe(0);
	});
});

describe('Die Rechnung einzeln erfasst (Kriterium 3)', () => {
	it('nach der Vorgabe zählt die Einsprache je Eigentümer: 2 zu 1, beschlossen', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28')));
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 1, basis: 3 });
		expect(a.angenommen).toBe(true);
	});

	it('nach der Wahl je Einheit zählt sie je Einheit: 2 zu 3, abgelehnt', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28', 'je_einheit')));
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 3, basis: 5 });
		expect(a.angenommen).toBe(false);
	});

	it('das Ergebnis nach der anderen Zählweise steht daneben, mit Zahlen', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28')));
		const andere = a.andereZaehlweise!;
		expect(andere.kennung).toBe('L3');
		expect(andere.angenommen).toBe(false);
		expect(andere.koepfe).toMatchObject({ ja: 2, basis: 5 });
		expect(andere.abweichend).toBe(true);
		expect(andereLesartenVon(a).map((r) => r.kennung)).toContain('L3');
	});

	it('bei geheimer Abstimmung nur erreicht oder nicht, ohne Zahlen', () => {
		const a = zaehleAus({ ...lage(einsprache('2026-10-28')), geheim: true });
		const satz = andereLesartInWorten(a.andereZaehlweise!, true).leitung;
		expect(satz).not.toMatch(/Ja von/);
		expect(satz).toMatch(/wäre er abgelehnt/);
	});

	it('in einer Gemeinschaft je Eigentümer ändert sich nichts, kein zweites Ergebnis', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28'), snapshotJeEigentuemer()));
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 1, basis: 3 });
		expect(a.andereZaehlweise).toBeUndefined();
	});

	it('zaehlweiseFuer wählt nur an der Einsprache ab 2026-10-28 in einer Gemeinschaft je Einheit um', () => {
		const m = snapshotJeEinheit();
		expect(zaehlweiseFuer(einsprache('2026-10-28'), m)).toBe('per_owner');
		expect(zaehlweiseFuer(einsprache('2026-10-28', 'je_einheit'), m)).toBe('per_unit');
		expect(zaehlweiseFuer(einsprache('2026-10-27'), m)).toBe('per_unit');
		expect(zaehlweiseFuer(einsprache('2026-10-28'), snapshotJeEigentuemer())).toBe('per_owner');
	});
});

describe('Ältere Fassungen (Kriterium 9)', () => {
	it('ein Traktandum der Fassung 2026-10-27 zählt weiter je Einheit', () => {
		const a = zaehleAus(lage(einsprache('2026-10-27')));
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 3, basis: 5 });
		expect(a.angenommen).toBe(false);
		expect(a.andereZaehlweise).toBeUndefined();
	});

	it('der Hinweis der älteren Fassung bleibt der bisherige', () => {
		expect(einspracheZaehlweiseHinweis(einsprache('2026-10-27'), 'per_unit')).toBe(
			zaehlweiseBeiEinsprache(EINSPRACHE_KNOTEN, 'per_unit')
		);
	});

	it('ab 2026-10-28 ersetzt der Kartensatz L3 den Hinweis', () => {
		const hinweis = einspracheZaehlweiseHinweis(einsprache('2026-10-28'), 'per_unit')!;
		expect(hinweis).toContain('Bei der Einsprache hat nach der Einstellung Ihrer Gemeinschaft');
		expect(hinweis).toBe(einsprachelesartKartensatz('je_eigentuemer'));
	});
});

describe('Betroffene und Ausstand unter beiden Zählweisen (Kriterium 10)', () => {
	it('der Betroffene, der verkauft, stimmt nach beiden Zählweisen nicht mit', () => {
		const m = snapshotJeEinheit();
		const mitBetroffenem: Auszaehlungslage = {
			...lage(einsprache('2026-10-28'), m),
			betroffeneParteiIds: ['p3'],
			// p3 stimmt zwar Nein, zählt aber nicht: nur p1 und p2 bleiben.
			stimmen: [...stimme(m.parties[0], 'yes'), ...stimme(m.parties[1], 'yes'), ...stimme(m.parties[2], 'no')]
		};
		const nachVorgabe = zaehleAus(mitBetroffenem);
		const jeEinheit = zaehleAus({ ...mitBetroffenem, erfordernis: einsprache('2026-10-28', 'je_einheit') });
		// Nach beiden Zählweisen ist p3 draussen; nur p1 (1) und p2 (1) zählen.
		expect(nachVorgabe.koepfe).toMatchObject({ ja: 2, nein: 0, basis: 2 });
		expect(jeEinheit.koepfe).toMatchObject({ ja: 2, nein: 0, basis: 2 });
	});

	it('wer im Ausstand ist, zählt nach beiden Zählweisen nicht', () => {
		const m = snapshotJeEinheit();
		const mitAusstand: Auszaehlungslage = {
			...lage(einsprache('2026-10-28'), m),
			imAusstand: ['p3']
		};
		const nachVorgabe = zaehleAus(mitAusstand);
		const jeEinheit = zaehleAus({ ...mitAusstand, erfordernis: einsprache('2026-10-28', 'je_einheit') });
		expect(nachVorgabe.koepfe).toMatchObject({ ja: 2, basis: 2 });
		expect(jeEinheit.koepfe).toMatchObject({ ja: 2, basis: 2 });
	});
});

describe('Die Handzählung (Kriterium 5)', () => {
	const m = snapshotJeEinheit();

	it('zählt die erste Dreizahl nach der Einstellung, die zweite nach der anderen', () => {
		const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0, andereJa: 2, andereNein: 3, andereEnthaltung: 0 };
		const a = zaehleSummenAus({ ...lage(einsprache('2026-10-28'), m), stimmen: undefined } as never, summe);
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 1 });
		expect(a.angenommen).toBe(true);
		expect(a.andereZaehlweise).toMatchObject({ angenommen: false, abweichend: true });
	});

	it('die Zählhilfe nennt die Parteien, die je Einheit nicht genau eine Stimme haben', () => {
		expect(einspracheZaehlhilfe(lage(einsprache('2026-10-28'), m))).toEqual(['Partei 3 mit 3 Stimmen']);
	});

	it('jede Dreizahl hat ihre eigene Obergrenze', () => {
		// Erste Dreizahl in Ordnung (2 von 3 je Eigentümer), die zweite zu hoch:
		// 7 Stimmen je Einheit, im Saal stehen 5.
		const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0, andereJa: 7, andereNein: 0, andereEnthaltung: 0 };
		expect(() =>
			zaehleSummenAus({ ...lage(einsprache('2026-10-28'), m), stimmen: undefined } as never, summe)
		).toThrow(/im Saal stehen 5 Stimmen je Einheit zur Verfügung/);
	});

	it('wo die Gewichte gleich sind, gilt ohne zweite Dreizahl nach beiden dasselbe', () => {
		const gleich = {
			...snapshotJeEinheit(),
			parties: snapshotJeEinheit().parties.map((p) => ({ ...p, units: p.units.slice(0, 1) }))
		};
		const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0 };
		const a = zaehleSummenAus({ ...lage(einsprache('2026-10-28'), gleich), stimmen: undefined } as never, summe);
		expect(a.andereZaehlweise).toMatchObject({ angenommen: true, abweichend: false });
	});
});

describe('Beschluss von Hand und Auszählmappe (Kriterium 6)', () => {
	it('der Beschluss von Hand zählt die Wahl je Partei nach der Einstellung', () => {
		const m = snapshotJeEinheit();
		const eingabe: VonHandEingabe = {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: [
					{ parteiId: 'p1', wahl: 'yes' },
					{ parteiId: 'p2', wahl: 'yes' },
					{ parteiId: 'p3', wahl: 'no' }
				]
			}
		};
		const a = auszaehlungVonHand(eingabe, m, einsprache('2026-10-28'));
		// Nach der Vorgabe je Eigentümer: 2 Ja, 1 Nein.
		expect(a.koepfe).toMatchObject({ ja: 2, nein: 1 });
	});

	it('die Auszählmappe trägt für die Einsprache die Zählweise je Eigentümer', () => {
		const posten: Mappenposten = {
			nummer: '1',
			titel: 'Einsprache',
			erfordernis: 'Einfaches Mehr',
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: 'keine',
			quotenSchwelle: null,
			ohneBetroffene: true,
			zaehlweise: 'per_owner'
		};
		const blatt = baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '28. Oktober 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: true,
			parteien: [
				{ name: 'Partei 1', kopfstimmen: 2, kopfstimmenJeEigentuemer: 1, wertquote: 200 },
				{ name: 'Partei 2', kopfstimmen: 1, kopfstimmenJeEigentuemer: 1, wertquote: 300 },
				{ name: 'Partei 3', kopfstimmen: 3, kopfstimmenJeEigentuemer: 1, wertquote: 500 }
			],
			posten: [posten]
		});
		const texte = blatt.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
		expect(texte).toContain('Stimme je Eigentümer');
		// Die Ja-Formel der Einsprache summiert über die Eigentümerspalte.
		const ja = blatt.zeilen
			.find((z) => z[0]?.art === 'text' && (z[0] as { wert: string }).wert === 'Ja (Kopfstimmen)')!
			.find((z) => z.art === 'formel');
		expect((ja as { formel: string }).formel).toContain('$C$');
	});
});

describe('Karte und Protokoll (Kriterium 7)', () => {
	it('der Kartensatz L3 nennt die angewandte und die andere Zählweise', () => {
		const satz = einsprachelesartKartensatz('je_eigentuemer');
		expect(satz).toContain('jeder Eigentümer');
		expect(satz).toContain('Nach der anderen Zählweise hätte jede Einheit eine Stimme');
	});

	it('der Kartensatz der anderen Wahl nennt je Einheit als Einstellung', () => {
		const satz = einsprachelesartKartensatz('je_einheit');
		expect(satz).toContain('jede Einheit');
		expect(satz).toContain('Nach Gesetz hätte jeder Eigentümer eine Stimme');
	});

	it('einsprachelesartVon fällt ohne Angabe auf die Vorgabe zurück', () => {
		expect(einsprachelesartVon({})).toBe('je_eigentuemer');
		expect(einsprachelesartVon({ einspracheLesart: 'je_einheit' })).toBe('je_einheit');
	});

	it('das Protokoll nennt die angewandte Zählweise', () => {
		const satz = einsprachelesartProtokollsatz(einsprache('2026-10-28'), snapshotJeEinheit());
		expect(satz).toContain('Gezählt nach dem Gesetz: eine Stimme je Eigentümer');
		expect(satz).toContain('nicht geklärt');
		expect(
			einsprachelesartProtokollsatz(einsprache('2026-10-28', 'je_einheit'), snapshotJeEinheit())
		).toContain('Gezählt je Einheit nach dem Reglement');
		// In einer Gemeinschaft je Eigentümer oder an einer älteren Fassung: keine Zeile.
		expect(einsprachelesartProtokollsatz(einsprache('2026-10-28'), snapshotJeEigentuemer())).toBeNull();
		expect(einsprachelesartProtokollsatz(einsprache('2026-10-27'), snapshotJeEinheit())).toBeNull();
	});
});

describe('Die Leitung sieht beide Ergebnisse vor dem Verkünden (Kriterium 4)', () => {
	it('nennt das Ergebnis nach der anderen Zählweise mit Zahlen, einzeln erfasst', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28')));
		// Die Leitungsseiten lesen `andereLesartenVon` → `andereLesartInWorten` am
		// Ergebnis, also gleich nach dem Schliessen; einen Zwischenstand zeigt
		// Votum nie (Entscheid des Auftraggebers 21.10.2026).
		const satz = andereLesartInWorten(a.andereZaehlweise!, false).leitung;
		// A5, Punkt 1a: nicht «die Lesart dieser Versammlung».
		expect(satz).toContain('Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist');
		expect(satz).toMatch(/2 Ja von 5 Kopfstimmen/);
		expect(satz).toContain('ist der Antrag angenommen');
		expect(satz).toContain('wäre er abgelehnt');
	});

	it('nennt es auch bei der Handzählung, mit der zweiten Dreizahl', () => {
		const m = snapshotJeEinheit();
		const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0, andereJa: 2, andereNein: 3, andereEnthaltung: 0 };
		const a = zaehleSummenAus({ ...lage(einsprache('2026-10-28'), m), stimmen: undefined } as never, summe);
		const satz = andereLesartInWorten(a.andereZaehlweise!, false).leitung;
		expect(satz).toMatch(/wäre er abgelehnt/);
	});
});

/*
 * **Das Zahlenbeispiel rechnet nach der angewandten Zählweise** (Abnahme
 * Block 5). Es nahm die Stimmen je Einheit der Gemeinschaft und nannte an der
 * Einsprache nach L3 «je Eigentümer» eine falsche Zahl nötiger Ja-Stimmen.
 * Hier: 4 Eigentümer mit 6 Einheiten, einer davon verkauft. Je Einheit bleiben
 * 5, nötig 3; je Eigentümer bleiben 3, nötig 2.
 */
describe('Zahlenbeispiel nach der Zählweise der Einsprache', () => {
	const zahlen = { kopfstimmen: 6, eigentuemer: 4, gesamtquote: 1000, zaehlweise: 'per_unit' as const };
	const knoten = REGELWERK_2026_10_28.knoten.find((k) => k.id === EINSPRACHE_KNOTEN)!;

	it('nach der Vorgabe mit den Eigentümern', () => {
		const karte = ergebniskarte(REGELWERK_2026_10_28, knoten, zahlen, 'je_eigentuemer');
		expect(karte.zahlenbeispiel).toContain('Bei 3 Eigentümern');
		expect(karte.zahlenbeispiel).toContain('nötig sind 2 Ja-Stimmen');
	});

	it('nach der Wahl je Einheit mit den Stimmen je Einheit', () => {
		const karte = ergebniskarte(REGELWERK_2026_10_28, knoten, zahlen, 'je_einheit');
		expect(karte.zahlenbeispiel).toContain('Bei 5 Stimmen');
		expect(karte.zahlenbeispiel).toContain('nötig sind 3 Ja-Stimmen');
	});

	it('an der Fassung 2026-10-27 weiter je Einheit', () => {
		const alt = REGELWERK_2026_10_27.knoten.find((k) => k.id === EINSPRACHE_KNOTEN)!;
		const karte = ergebniskarte(REGELWERK_2026_10_27, alt, zahlen, 'je_eigentuemer');
		expect(karte.zahlenbeispiel).toContain('Bei 5 Stimmen');
	});

	it('ohne Zahl der Eigentümer lieber kein Beispiel als ein falsches', () => {
		const { eigentuemer: _weg, ...ohne } = zahlen;
		expect(
			kennzahlenNachZaehlweise({ knotenId: EINSPRACHE_KNOTEN, fassung: '2026-10-28' }, ohne)
		).toBeNull();
		expect(ergebniskarte(REGELWERK_2026_10_28, knoten, ohne, 'je_eigentuemer').zahlenbeispiel).toBeNull();
	});

	it('unter einer Regel ebenso', () => {
		const regel = {
			typ: 'einfaches_mehr',
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		} as unknown as Reglementsregel;
		const e = { knotenId: EINSPRACHE_KNOTEN, fassung: '2026-10-28' };
		expect(zahlenbeispielNachZaehlweise(regel, zahlen, e, 'je_eigentuemer')).toContain('3 Eigentümern');
		expect(zahlenbeispielNachZaehlweise(regel, zahlen, e, 'je_einheit')).toContain('5 Stimmen');
	});
});

/*
 * **Nach einer Ablehnung kein Rat zur nächsten Versammlung** (Fachprüfung
 * Block 5, F5-2): An der Einsprache kommt sie zu spät; der Katalog ersetzt den
 * Satz. Andere Lesarten behalten ihn.
 */
describe('Leitung nach einer Ablehnung an der Einsprache', () => {
	it('ersetzt «nächste Versammlung» durch die Frist', () => {
		const a = zaehleAus(lage(einsprache('2026-10-28', 'je_einheit')));
		const r = andereLesartenVon(a).find((x) => x.kennung === 'L3')!;
		const satz = andereLesartInWorten(r, false).leitung;
		expect(satz).not.toContain('an einer nächsten Versammlung wieder traktandieren');
		expect(satz).toContain('käme bei der Einsprache in aller Regel zu spät');
	});
});

describe('Eine Absage zur zweiten Zählung nennt die zweite', () => {
	it('zeigt auf das Feld der zweiten Zählung', () => {
		const m = snapshotJeEinheit();
		const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0, andereJa: 1.5, andereNein: 3, andereEnthaltung: 0 };
		let fehler: unknown;
		try {
			zaehleSummenAus({ ...lage(einsprache('2026-10-28'), m), stimmen: undefined } as never, summe);
		} catch (f) {
			fehler = f;
		}
		expect(fehler).toMatchObject({ feld: 'andereJa' });
		expect((fehler as Error).message).toMatch(/^In der Zählung je Einheit: /);
	});
});

/*
 * **Die zweite Dreizahl auch bei offenem Stichentscheid prüfen** (Codeprüfung
 * Block 5, N2 und M-a). Bei Gleichstand mit Stichentscheid der Leitung rechnet
 * `zaehleSummenAus` das zweite Ergebnis nicht; ohne `pruefeAndereDreizahl`
 * stünde eine zu hohe zweite Zählung in der Datenbank.
 */
describe('Die zweite Dreizahl für sich', () => {
	const m: Snapshot = { ...snapshotJeEinheit(), tieBreak: 'vorsitz' } as Snapshot;
	const zwei = { ...lage(einsprache('2026-10-28'), m), stimmen: undefined, anwesende: ['p1', 'p2'] } as never;

	it('rechnet bei offenem Stichentscheid kein zweites Ergebnis', () => {
		const a = zaehleSummenAus(zwei, { ja: 1, nein: 1, enthaltung: 0, andereJa: 9, andereNein: 0, andereEnthaltung: 0 });
		expect(a.stichentscheidOffen).toBe(true);
	});

	it('weist die zu hohe zweite Zählung trotzdem ab, am Feld der zweiten', () => {
		let fehler: unknown;
		try {
			pruefeAndereDreizahl(zwei, { ja: 1, nein: 1, enthaltung: 0, andereJa: 0, andereNein: 9, andereEnthaltung: 0 });
		} catch (f) {
			fehler = f;
		}
		expect(fehler).toMatchObject({ kennung: 'summe_zu_hoch', feld: 'andereJa' });
		expect((fehler as Error).message).toMatch(/^In der Zählung je Einheit: /);
	});

	it('zeigt bei einer gebrochenen Zahl auf ihr Feld', () => {
		expect(() =>
			pruefeAndereDreizahl(zwei, { ja: 1, nein: 1, enthaltung: 0, andereJa: 0, andereNein: 1.5, andereEnthaltung: 0 })
		).toThrow(expect.objectContaining({ feld: 'andereNein' }));
	});

	it('lässt eine passende zweite Zählung durch', () => {
		expect(() =>
			pruefeAndereDreizahl(zwei, { ja: 1, nein: 1, enthaltung: 0, andereJa: 1, andereNein: 1, andereEnthaltung: 0 })
		).not.toThrow();
	});
});

/*
 * **Die Kopfstimmen an der laufenden Abstimmung** (Codeprüfung Block 5, N1 und
 * M-b): Erfassungsliste und `/z` nennen das Gewicht an diesem Erfordernis.
 */
describe('kopfstimmenAn', () => {
	const m = snapshotJeEinheit();
	const drei = m.parties[2];
	it('an der Einsprache nach der Vorgabe eine Stimme', () => {
		expect(kopfstimmenAn(drei, einsprache('2026-10-28'), m)).toBe(1);
	});
	it('nach der Wahl je Einheit und ohne Erfordernis die Einheiten', () => {
		expect(kopfstimmenAn(drei, einsprache('2026-10-28', 'je_einheit'), m)).toBe(3);
		expect(kopfstimmenAn(drei, null, m)).toBe(3);
	});
	it('eine Partei nur mit einem Nebenobjekt ohne Kopfstimme: je Eigentümer 1', () => {
		const platz = {
			units: [{ unitId: 'x', label: 'EP 1', kind: 'parking' as const, countsAsHead: false, quota: 10 }]
		};
		expect(kopfstimmenAn(platz, einsprache('2026-10-28'), m)).toBe(1);
		expect(kopfstimmenAn(platz, null, m)).toBe(0);
	});
});

/*
 * **Legende der 8 und Satz zur Einsprache in der Mappe** (Codeprüfung Block 5,
 * Runde 3, M1, M2, N4): Die 8 nennt Vertretene des Betroffenen nur, wo Votum
 * dessen Vollmachten nicht zählt; der Satz nennt die Schwelle nur beim
 * gesetzlichen Mehr.
 */
describe('Mappe: Legende und Satz zur Einsprache', () => {
	const grund: Mappenposten = {
		nummer: '1',
		titel: 'Einsprache',
		erfordernis: 'Einfaches Mehr',
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		ohneBetroffene: true,
		zaehlweise: 'per_owner'
	};
	function texte(posten: Mappenposten): string {
		const blatt = baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '28. Oktober 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: true,
			parteien: [{ name: 'Partei 1', kopfstimmen: 2, kopfstimmenJeEigentuemer: 1, wertquote: 1000 }],
			posten: [posten]
		});
		return blatt.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');
	}

	it('nennt Vertretene des Betroffenen bei der 8 nur, wo seine Vollmachten nicht zählen', () => {
		expect(texte({ ...grund, vollmachtenBetroffenerZaehlenNicht: true })).toContain('als Betroffene nicht mitstimmt');
		// Eine blosse Klausel «ausser Betroffene»: Seine Vollmachten zählen weiter.
		expect(texte(grund)).not.toContain('als Betroffene nicht mitstimmt');
	});

	/*
	 * **Die Formeln stehen unter ihrem Posten** (Codeprüfung, letzte Fixes, H1):
	 * Mit der Spalte «Stimme je Eigentümer» sassen die Auswertungszeilen eine
	 * Spalte zu weit links, und das Ergebnis hiess immer «abgelehnt». Jede Formel
	 * einer Zeile mit Beschriftung muss in der Spalte des Postens stehen und sich
	 * auf sie beziehen, auch neben einem Posten ohne Einsprache.
	 */
	it('legt jede Formel der Auswertung in die Spalte ihres Postens', () => {
		const anderer: Mappenposten = { ...grund, nummer: '2', titel: 'Anderes', zaehlweise: 'per_unit', ohneBetroffene: false };
		const blatt = baueAuszaehlmappe({
			gemeinschaftName: 'Prüf',
			datum: '28. Oktober 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: true,
			parteien: [{ name: 'Partei 1', kopfstimmen: 2, kopfstimmenJeEigentuemer: 1, wertquote: 1000 }],
			posten: [grund, anderer]
		});
		const ergebnisse = blatt.zeilen.filter(
			(z) => z[0]?.art === 'text' && /^(Nötig|Ja|Bezugsgrösse|Ergebnis|Kopfmehr)/.test((z[0] as { wert: string }).wert)
		);
		expect(ergebnisse.length).toBeGreaterThan(0);
		for (const zeile of ergebnisse) {
			zeile.forEach((zelle, i) => {
				if (zelle.art !== 'formel') return;
				// Spalte F für den ersten Posten, G für den zweiten (fünf Vorspalten).
				expect(['F', 'G']).toContain(String.fromCharCode(65 + i));
			});
		}
	});

	/*
	 * **Die andere Zählweise rechnet die Spalte «zum Vergleich»** (A3): Die
	 * Rechnung von Hand ist weg, nach beiden Wahlen steht die Frist da.
	 */
	it('nennt nach beiden Wahlen die Spalte «zum Vergleich» und die Frist', () => {
		const jeEigentuemer = texte(grund);
		expect(jeEigentuemer).toContain('jeder Eigentümer eine Stimme');
		expect(jeEigentuemer).toContain('zählt dieselben Stimmen je Einheit');
		expect(jeEigentuemer).not.toContain('mehr als die Hälfte davon');
		const jeEinheit = texte({ ...grund, zaehlweise: 'per_unit', vergleiche: [
			{ kennung: 'L3', wahl: 'je Eigentümer', verlangt: 'eine Stimme je Eigentümer', rechnung: grund }
		] });
		expect(jeEinheit).toContain('zählt nach der Einstellung Ihrer Gemeinschaft jede Einheit');
		expect(jeEinheit).toContain('zählt dieselben Stimmen je Eigentümer');
		for (const t of [jeEigentuemer, jeEinheit]) expect(t).toContain('innert 14 Tagen');
	});
});
