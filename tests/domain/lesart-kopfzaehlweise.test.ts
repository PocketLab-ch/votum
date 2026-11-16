/**
 * L13, Zählweise der Köpfe (Entscheid 0048, Block C): Akzeptanzkriterien 1
 * bis 3 und 5 bis 7 des Auftrags `.auftraege/2026-11-13-votum-c-zaehlweise-lesart.md`
 * am Kern. Kriterium 4 (Freigabe und Kasten) misst `tests/db/lesart-kopfzaehlweise.test.ts`.
 *
 * Zehn erfundene Eigentümer; p1 bis p5 halten je 120, p6 bis p10 je 80 von
 * 1000; da oder vertreten sind p1 bis p7. Fünf Ja (p1 bis p5) erreichen unter
 * den Anwesenden die Köpfe (5 von 7) und die Wertquoten (600), unter allen
 * nicht die Köpfe (5 von 10).
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { erfordernisAusKnoten, ergebniskarte, RUECKKOMMEN_TITEL, uebersteuere, type Erfordernis } from '$lib/domain/entscheidbaum';
import {
	knotenNachLesart,
	LESARTEN_VORGABE,
	wendeLesartAn,
	lesartVon,
	KOPFZAEHLWEISE_AB,
	zaehlweiseVeraltet,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { karteMitEnthaltung, karteMitReglement, wendeReglementAn, zaehlweiseFuerKarte, type Reglementsregel } from '$lib/domain/reglement';
import {
	andereLesartenVon,
	andereLesartInWorten,
	erreichbarkeitshinweis,
	kopfzaehlweiseSiegelzeile,
	kopfzaehlweiseProtokollsatz,
	lesartKartensatz,
	mitKeinemBeschluss,
	vergleicheZu,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { mappenpostenAus } from '$lib/domain/auszaehlmappe';
import { kopfbasisStreit, mehrhinweise } from '$lib/domain/mehrhinweise';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const RW = holeRegelwerk('2026-11-14');
const VORHER = holeRegelwerk('2026-11-13');
const ALLE: Lesartenwahl = { ...LESARTEN_VORGABE, L13: 'alle' };
const KLAUSEL = { fundstelle: 'Art. 12 Abs. 3 Reglement (erfunden)' };

const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-14T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: Array.from({ length: 10 }, (_, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Partei ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [
			{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: i < 5 ? 120 : 80 }
		]
	}))
};
const DA = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

function stimmen(wahlen: VoteChoice[]): Vote[] {
	return wahlen.map((choice, i) => ({
		partyId: `p${i + 1}`,
		unitId: `p${i + 1}-u`,
		choice,
		castAt: '2026-11-14T19:10:00.000Z',
		recordedByChair: false
	}));
}
const FUENF_JA = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no', 'no']);
const SECHS_JA = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'no']);

function lage(e: Erfordernis, v: Vote[], imAusstand: string[] = []): Auszaehlungslage {
	return {
		momentaufnahme: M,
		erfordernis: e,
		stimmen: v,
		anwesende: DA,
		imAusstand,
		// Wo die Zustimmung Betroffener nötig ist, ist es p1, und p1 stimmt Ja.
		...(e.zustimmungBetroffenerNoetig ? { betroffeneParteiIds: ['p1'] } : {})
	};
}

function hergeleitet(id: string, wahlen: Lesartenwahl, rw = RW, einstellung: { fundstelle: string } | null = null, regeln: Reglementsregel[] = []) {
	const k = rw.knoten.find((x) => x.id === id)!;
	return wendeReglementAn(erfordernisAusKnoten(rw, k), regeln, einstellung, wahlen).erfordernis;
}

describe('L13, Kriterium 1: ab der Fassung 2026-11-14 an den vier Bestimmungen', () => {
	it.each([
		['k-zustaendigkeit-gewoehnlich'],
		['k-verwaltung-wichtig'],
		['k-benutzungsweise'],
		['k-bewirtschaftung-erweitert'],
		['k-bewirtschaftung-waehlen-erweitert'],
		['k-prozessfuehrung'],
		['k-baulich-notwendig'],
		['k-baulich-luxurioes-ausweg']
	])('%s zählt unter «Alle Eigentümer» die Köpfe aller', (id) => {
		const e = hergeleitet(id, ALLE);
		expect(e.kopfbasis).toBe('alle_eigentuemer');
		expect(e.kopfzaehlweise).toBe('alle');
		const a = zaehleAus(lage(e, FUENF_JA));
		expect(a.koepfe.basis).toBe(10);
		expect(a.angenommen).toBe(false);
		// Gegenprobe: dieselbe Karte unter der Vorgabe.
		const v = hergeleitet(id, LESARTEN_VORGABE);
		expect(v.kopfbasis).toBe('anwesend_vertreten');
		expect(zaehleAus(lage(v, FUENF_JA)).angenommen).toBe(true);
	});

	it('nicht an Art. 647d und nicht unter einer angewandten Regel des Reglements', () => {
		const nuetzlich = hergeleitet('k-baulich-nuetzlich', ALLE);
		expect(nuetzlich.kopfbasis).toBe('anwesend_vertreten');
		// Die Wahl steht am Erfordernis (M2), wirkt aber nicht.
		expect(nuetzlich.kopfzaehlweise).toBe('alle');
		expect(zaehleAus(lage(nuetzlich, FUENF_JA)).andereKopfzaehlweise).toBeUndefined();
		const regel: Reglementsregel = {
			id: 'r-1',
			stwegId: 's-1',
			geschaeftsart: 'verwaltung_wichtig',
			knotenId: 'k-verwaltung-wichtig',
			fundstelle: 'Art. 20 Reglement',
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			enthaltungZaehltMit: true
		};
		const unterRegel = hergeleitet('k-verwaltung-wichtig', ALLE, RW, null, [regel]);
		expect(unterRegel.quelle).toBe('reglement');
		expect(unterRegel.kopfbasis).toBe('anwesend_vertreten');
		expect(zaehleAus(lage(unterRegel, FUENF_JA)).andereKopfzaehlweise).toBeUndefined();
	});

	it('wer im Ausstand ist, bleibt unter «Alle Eigentümer» in der Zahl (Antwort 9), unter der Vorgabe nicht', () => {
		const funfMitAusstand = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']);
		const alle = zaehleAus(lage(hergeleitet('k-baulich-notwendig', ALLE), funfMitAusstand, ['p7']));
		expect(alle.koepfe.basis).toBe(10);
		expect(alle.koepfe.imAusstand).toBe(1);
		const vorgabe = zaehleAus(lage(hergeleitet('k-baulich-notwendig', LESARTEN_VORGABE), funfMitAusstand, ['p7']));
		expect(vorgabe.koepfe.basis).toBe(6);
		// Das zweite Ergebnis unter der Vorgabe rechnet ihn mit, das unter «alle» ohne.
		expect(vorgabe.andereKopfzaehlweise?.koepfe?.basis).toBe(10);
		expect(alle.andereKopfzaehlweise?.koepfe?.basis).toBe(6);
	});

	it('wendet die Enthaltungsklausel an, wirkt L13 nicht (Antwort 10), auch nicht als zweites Ergebnis', () => {
		for (const id of ['k-baulich-notwendig', 'k-zustaendigkeit-gewoehnlich']) {
			const e = hergeleitet(id, ALLE, RW, KLAUSEL);
			expect(e.enthaltungZaehltMit, id).toBe(false);
			expect(e.kopfbasis, id).toBe('anwesend_vertreten');
			expect(e.kopfzaehlweise, id).toBe('alle');
			const a = zaehleAus(lage(e, stimmen(['yes', 'yes', 'yes', 'yes', 'no', 'abstain', 'abstain'])));
			expect(a.angenommen, id).toBe(true);
			expect(a.andereKopfzaehlweise, id).toBeUndefined();
		}
		// Gegenprobe: Am qualifizierten Mehr greift die Klausel nicht, L13 wirkt.
		expect(hergeleitet('k-verwaltung-wichtig', ALLE, RW, KLAUSEL).kopfbasis).toBe('alle_eigentuemer');
	});

	it('die Handzählung rechnet dasselbe zweite Ergebnis', () => {
		const e = hergeleitet('k-baulich-notwendig', ALLE);
		const a = zaehleSummenAus(
			{ momentaufnahme: M, erfordernis: e, anwesende: DA, imAusstand: [] },
			{ ja: 5, nein: 2, enthaltung: 0 }
		);
		expect(a.angenommen).toBe(false);
		expect(a.andereKopfzaehlweise).toMatchObject({ kennung: 'L13', angenommen: true, abweichend: true });
	});
});

describe('L13, Kriterium 2: unter der Vorgabe ändert sich kein Ergebnis', () => {
	/*
	 * Gegen die Fassung 2026-11-13 (Stand `c8546b09`): Jede Karte, die es in
	 * beiden gibt, rechnet unter der Vorgabe dasselbe Mehr und zählt dieselbe
	 * Abstimmung gleich aus. Neu ist nur das zweite Ergebnis nach der anderen
	 * Zählweise. Die Gegenprobe (Vorgabe auf «alle» gestellt) macht den Test rot.
	 */
	it('jede Karte beider Fassungen, drei Abstimmungen, mit und ohne Ausstand', () => {
		let verglichen = 0;
		for (const k of RW.knoten) {
			const alt = VORHER.knoten.find((x) => x.id === k.id);
			if (!alt || k.typ === 'grenzfall' || k.typ === 'keine_abstimmung') continue;
			const neu = wendeReglementAn(erfordernisAusKnoten(RW, k), [], null, LESARTEN_VORGABE).erfordernis;
			const vorher = wendeReglementAn(erfordernisAusKnoten(VORHER, alt), [], null, LESARTEN_VORGABE).erfordernis;
			const mehr = (e: Erfordernis) => [e.typ, e.kopfbasis, e.quotenbasis, JSON.stringify(e.kopfSchwelle), JSON.stringify(e.quotenSchwelle)];
			expect(mehr(neu), k.id).toEqual(mehr(vorher));
			for (const [v, ausstand] of [
				[FUENF_JA, []],
				[SECHS_JA, []],
				[stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']), ['p7']]
			] as [Vote[], string[]][]) {
				const l = (e: Erfordernis) => lage(e, v, ausstand);
				// Ohne `catch` (Codeprüfung Block C, M5): Wirft eine Karte, wird der Test rot.
				const a = zaehleAus(l(neu));
				const b = zaehleAus(l(vorher));
				const kern = (x: ReturnType<typeof zaehleAus>) => ({
					angenommen: x.angenommen,
					koepfe: x.koepfe,
					quoten: x.quoten,
					andereLesart: x.andereLesart ?? null,
					andereAusstandslesart: x.andereAusstandslesart ?? null
				});
				expect(kern(a), k.id).toEqual(kern(b));
				verglichen++;
			}
		}
		// 37 Karten mit Mehr in beiden Fassungen, je drei Abstimmungen.
		expect(verglichen).toBe(111);
	});
});

describe('L13, Kriterium 3: die beiden zweiten Ergebnisse behalten je die andere Wahl', () => {
	it('L2 «einfach» und «qualifiziert» unter «Alle Eigentümer», beide Richtungen', () => {
		for (const l2 of ['einfach', 'qualifiziert'] as const) {
			const e = hergeleitet('k-zustaendigkeit-gewoehnlich', { ...ALLE, L2: l2 });
			const a = zaehleAus(lage(e, SECHS_JA));
			// Das zweite Ergebnis nach L2 zählt die Köpfe aller.
			expect(a.andereLesart?.kennung, l2).toBe('L2');
			expect(a.andereLesart?.koepfe?.basis, l2).toBe(10);
			expect(a.andereLesart?.verlangt, l2).toMatch(/aller Eigentümer/);
			// Das zweite Ergebnis nach L13 behält die Wahl von L2.
			expect(a.andereKopfzaehlweise?.koepfe?.basis, l2).toBe(7);
			expect(a.andereKopfzaehlweise?.quoten !== null, l2).toBe(l2 === 'qualifiziert');
		}
	});

	it('L4 und L11: nach der anderen Wahl ohne die vier Bestimmungen wirkt L13 nicht', () => {
		for (const [id, kennung] of [
			['k-bewirtschaftung-waehlen-erweitert', 'L4'],
			['k-prozessfuehrung', 'L11']
		] as const) {
			const e = hergeleitet(id, ALLE);
			const a = zaehleAus(lage(e, SECHS_JA));
			expect(a.andereLesart?.kennung, id).toBe(kennung);
			// «einfach» stützt sich auf Art. 712m oder 647a Abs. 1: Köpfe der Anwesenden.
			expect(a.andereLesart?.koepfe?.basis, id).toBe(7);
			expect(a.andereKopfzaehlweise?.koepfe?.basis, id).toBe(7);
			// Unter der anderen Wahl selbst wirkt L13 nicht ...
			const anders = hergeleitet(id, { ...ALLE, [kennung]: 'einfach' });
			expect(anders.kopfbasis, id).toBe('anwesend_vertreten');
			expect(zaehleAus(lage(anders, SECHS_JA)).andereKopfzaehlweise, id).toBeUndefined();
			// ... aber das zweite Ergebnis nach «qualifiziert» zählt unter allen
			// (Codeprüfung Block C, M2; Fachprüfung Nachtrag, N-F-1).
			expect(anders.kopfzaehlweise, id).toBe('alle');
			const zweites = zaehleAus(lage(anders, FUENF_JA)).andereLesart!;
			expect(zweites.koepfe?.basis, id).toBe(10);
			expect(zweites.angenommen, id).toBe(false);
			expect(lesartKartensatz(anders), id).toContain(
				'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist.'
			);
			// Gegenprobe unter der Vorgabe: die Anwesenden.
			const vorgabe = hergeleitet(id, { ...LESARTEN_VORGABE, [kennung]: 'einfach' });
			expect(zaehleAus(lage(vorgabe, FUENF_JA)).andereLesart?.koepfe?.basis, id).toBe(7);
		}
	});

	it('wendeLesartAn behält die Zählweise an einem Erfordernis, das sie schon trägt', () => {
		const e = hergeleitet('k-zustaendigkeit-gewoehnlich', ALLE);
		expect(e.kopfbasis).toBe('alle_eigentuemer');
		const getauscht = wendeLesartAn(e, { ...ALLE, L2: 'qualifiziert' });
		expect(getauscht.typ).toBe('qualifiziertes_mehr');
		expect(getauscht.kopfbasis).toBe('alle_eigentuemer');
		// Gegenprobe ohne die Wahl am Erfordernis: die Kopfbasis des Knotens.
		expect(wendeLesartAn({ ...e, kopfzaehlweise: undefined }, { ...ALLE, L2: 'qualifiziert' }).kopfbasis).toBe(
			'anwesend_vertreten'
		);
	});
});

describe('L13, Kriterium 5: Protokoll, Karte und Mappe', () => {
	it('das Protokoll nennt das Ergebnis nach der anderen Zählweise immer, auch ohne Abweichung', () => {
		const e = hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE);
		const gleich = zaehleAus(lage(e, SECHS_JA));
		expect(gleich.protokollhinweise?.map((h) => h.satz)).toContain(
			'Nach der anderen Zählweise («Alle Eigentümer») wäre das Ergebnis dasselbe gewesen.'
		);
		const abweichend = zaehleAus(lage(e, FUENF_JA));
		expect(abweichend.andereKopfzaehlweise?.abweichend).toBe(true);
		expect(abweichend.protokollhinweise?.some((h) => h.satz.startsWith('Nach der anderen Zählweise («Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 5 Ja von 10 Kopfstimmen'))).toBe(true);
	});

	it('ohne Beschluss fällt das zweite Ergebnis samt Satz weg, auch zu L10', () => {
		const a = zaehleAus(lage(hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), SECHS_JA));
		const ohne = mitKeinemBeschluss(a, { grund: 'konsultativ', namen: [] });
		expect(ohne.andereKopfzaehlweise).toBeNull();
		expect(ohne.andereAngehoerigenlesart).toBeNull();
		expect(andereLesartenVon(ohne)).toEqual([]);
	});

	it('Karte und Protokollzeile nennen die Wahl; die Mappe rechnet das zweite Ergebnis vor', () => {
		const alle = hergeleitet('k-verwaltung-wichtig', ALLE);
		expect(lesartKartensatz(alle)).toMatch(/Die Köpfe zählt Votum hier unter allen Eigentümern/);
		expect(kopfzaehlweiseProtokollsatz(alle)).toMatch(/^Köpfe gezählt unter allen Eigentümern/);
		expect(vergleicheZu(alle, M).map((v) => v.worte.kennung)).toContain('L13');
		const posten = mappenpostenAus({ nummer: '1', titel: 'Fassadensanierung' }, alle, M, { neuAnZweiter: false, wahl: 'erste' });
		// Der Ausstand bleibt in der Zahl, eingetragen mit 9, nicht 7 (Codeprüfung Lauf 2, M-B).
		expect(posten?.ausstandNachZaehlweise).toBe(true);
		expect(posten?.ausstandBleibtInDerZahl).toBe(false);
		expect(posten?.vergleiche?.find((v) => v.kennung === 'L13')?.rechnung.kopfbasis).toBe('anwesend_vertreten');
		// Gegenprobe: unter der Vorgabe zählt nur die Spalte zum Vergleich nach der Zählweise.
		const vorgabe = mappenpostenAus({ nummer: '1', titel: 'Fassadensanierung' }, hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), M, { neuAnZweiter: false, wahl: 'erste' });
		expect(vorgabe?.ausstandNachZaehlweise).toBe(false);
		expect(vorgabe?.vergleiche?.find((v) => v.kennung === 'L13')?.rechnung.ausstandNachZaehlweise).toBe(true);
	});
});

describe('L13, Kriterium 6: frühere Fassungen und freigegebene Traktanden rechnen unverändert', () => {
	it('ein Erfordernis der Fassung 2026-11-13 bleibt unter «Alle Eigentümer», wie es war', () => {
		const e = hergeleitet('k-verwaltung-wichtig', ALLE, VORHER);
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.kopfzaehlweise).toBeUndefined();
		expect(zaehleAus(lage(e, FUENF_JA)).angenommen).toBe(true);
		expect(zaehleAus(lage(e, FUENF_JA)).andereKopfzaehlweise).toBeUndefined();
		expect(KOPFZAEHLWEISE_AB).toBe('2026-11-14');
	});

	it('gezählt wird nach dem gespeicherten Mehr, nicht nach der heute eingestellten Wahl', () => {
		// Wie ein freigegebenes Traktandum, dessen Gemeinschaft danach umgestellt hat.
		const gespeichert = { ...hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), kopfzaehlweise: 'alle' as const };
		const a = zaehleAus(lage(gespeichert, FUENF_JA));
		expect(a.angenommen).toBe(true);
		expect(a.koepfe.basis).toBe(7);
		expect(a.andereKopfzaehlweise?.wahl).toBe('Alle Eigentümer');
		// Freigabe und Kasten sehen es als veraltet (Kriterium 4).
		const z = {
			fassung: gespeichert.fassung,
			typ: gespeichert.typ,
			rechtsgrundlage: gespeichert.rechtsgrundlage,
			kopfbasis: gespeichert.kopfbasis,
			quelle: gespeichert.quelle,
			enthaltungZaehltMit: null
		};
		expect(zaehlweiseVeraltet(z, 'alle')).toBe(true);
		expect(zaehlweiseVeraltet(z, 'anwesende')).toBe(false);
		// Eine frühere Fassung unter «alle» (Codeprüfung Block C, N1; wie L10), unter der Vorgabe nicht.
		expect(zaehlweiseVeraltet({ ...z, fassung: '2026-11-13' }, 'alle')).toBe(true);
		expect(zaehlweiseVeraltet({ ...z, fassung: '2026-11-13' }, 'anwesende')).toBe(false);
		// Gegenprobe: Art. 647d einer früheren Fassung nie.
		expect(zaehlweiseVeraltet({ ...z, fassung: '2026-11-13', rechtsgrundlage: 'ZGB Art. 647d Abs. 1 bis 3' }, 'alle')).toBe(false);
	});
});

describe('L13, Kriterium 7: Wortlaute nach der Endfassung', () => {
	const ENDE = 'Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Zählweise.';
	it('Kartensatz, Protokollzeile und Satz zur Kopfbasis', () => {
		const notwendig = (w: Lesartenwahl) => hergeleitet('k-baulich-notwendig', w);
		expect(lesartKartensatz(notwendig(LESARTEN_VORGABE))).toBe(
			'Die Köpfe zählt Votum hier unter den Anwesenden und Vertretenen; das ist die Standardeinstellung. Nach ' +
				'der anderen Zählweise («Alle Eigentümer») zählten alle Eigentümer, und wer fehlt, ohne eine Vollmacht zu ' +
				`geben, wirkte wie ein Nein. ${ENDE}`
		);
		expect(lesartKartensatz(notwendig(ALLE))).toBe(
			'Die Köpfe zählt Votum hier unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist; die ' +
				'Standardeinstellung wäre die Zählung unter den Anwesenden und Vertretenen. Wer fehlt, ohne eine Vollmacht ' +
				'zu geben, wirkt wie ein Nein, ebenso wer im Ausstand ist, also nicht mitstimmen darf, weil es um ein ' +
				`Geschäft oder einen Streit zwischen ihm und der Gemeinschaft geht. ${ENDE}`
		);
		expect(kopfzaehlweiseProtokollsatz(notwendig(LESARTEN_VORGABE))).toBe(
			'Köpfe gezählt unter den Anwesenden und Vertretenen, wie die herrschende Lehre, die Auffassung der ' +
				'meisten Fachleute (Vorgabe von Votum). Ob hier alle Eigentümer zählen, ist umstritten.'
		);
		expect(kopfzaehlweiseProtokollsatz(notwendig(ALLE))).toBe(
			'Köpfe gezählt unter allen Eigentümern, wie es für diese Versammlung eingestellt war. Die herrschende ' +
				'Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das wäre auch ' +
				'die Vorgabe von Votum.'
		);
		expect(kopfbasisStreit(notwendig(ALLE))?.satz).toBe(
			'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern. Erreicht ein ' +
				'Antrag die Mehrheit der Anwesenden und Vertretenen, aber nicht die aller Eigentümer, weist Votum ihn als ' +
				'abgelehnt aus; nach der herrschenden Lehre wäre er angenommen. Bei notwendigen Arbeiten kann jeder ' +
				'Eigentümer beim Gericht verlangen, dass sie angeordnet werden (ZGB Art. 647 Abs. 2 Ziff. 1).'
		);
	});

	it('unter der Enthaltungsklausel die Sätze aus Abschnitt 6', () => {
		const e = hergeleitet('k-baulich-notwendig', ALLE, RW, KLAUSEL);
		expect(lesartKartensatz(e)).toBe(
			'Ihre Gemeinschaft hat für die Köpfe «Alle Eigentümer» eingestellt. Hier wirkt das nicht: Ihr Reglement ' +
				'zählt Enthaltungen beim einfachen Mehr nicht mit, und Votum wendet das an. Gezählt werden deshalb die ' +
				'Anwesenden und Vertretenen ohne die Enthaltungen.'
		);
		expect(kopfzaehlweiseProtokollsatz(e)).toBe(
			'Gezählt nach dem Reglement: die Anwesenden und Vertretenen ohne die Enthaltungen. Die für die ' +
				'Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt hier nicht.'
		);
		// Unter der Vorgabe kein Satz zur Zählweise.
		expect(lesartKartensatz(hergeleitet('k-baulich-notwendig', LESARTEN_VORGABE, RW, KLAUSEL))).toBeNull();
		// «Wortlaut und Rechtsprechung» nach 4b ohne den Satz zu den Enthaltungen, nie 4c; in beiden
		// Wortlauten des Satzes, 2026-11-14 und 2026-11-15 (Auftrag «Texte nach 0047», Punkt 12d).
		for (const rw of [RW, holeRegelwerk('2026-11-15')]) {
			const knoten = rw.knoten.find((k) => k.id === 'k-baulich-notwendig')!;
			const angewandt = wendeReglementAn(erfordernisAusKnoten(rw, knoten), [], KLAUSEL, ALLE);
			const karte = karteMitEnthaltung(
				ergebniskarte(rw, knotenNachLesart(rw, knoten, { ...ALLE, L13: zaehlweiseFuerKarte(angewandt, ALLE) })),
				angewandt.enthaltung
			);
			expect(karte.wortlautHinweis, rw.fassung).toMatch(/^Das Gesetz sagt hier «Mehrheit aller Miteigentümer»\. Die herrschende Lehre/);
			expect(karte.wortlautHinweis, rw.fassung).not.toMatch(/Enthaltungen zählen (nach herrschender Lehre )?mit/);
			expect(karte.wortlautHinweis, rw.fassung).not.toMatch(/bindet ein Gericht nicht/);
			expect(karte.wortlautHinweis, rw.fassung).toMatch(/Votum zählt hier deshalb ohne Enthaltungen/);
		}
	});

	it('das zweite Ergebnis sagt «Zählweise» statt «Lesart», an Art. 647c mit dem Weg ans Gericht', () => {
		const a = zaehleAus(lage(hergeleitet('k-baulich-notwendig', ALLE), FUENF_JA));
		const r = a.andereKopfzaehlweise!;
		expect(r.notwendigeArbeiten).toBe(true);
		const w = andereLesartInWorten(r, false);
		expect(w.leitung).toMatch(/^Nach der Zählweise, die für Ihre Gemeinschaft eingestellt ist \(«Alle Eigentümer»\), ist der Antrag abgelehnt\. Nach der anderen Zählweise/);
		expect(w.leitung).toContain(lesartVon('L13')!.ratNachAblehnungBeiNotwendigenArbeiten!);
		expect(w.protokoll).toContain(lesartVon('L13')!.protokollNachAblehnung!);
		expect(w.protokoll).toMatch(/Bei notwendigen Arbeiten kann zudem jeder Eigentümer beim Gericht verlangen, dass sie angeordnet werden \(ZGB Art\. 647 Abs\. 2 Ziff\. 1\)\.$/);
		// Eine Annahme, die unter allen scheiterte, unter der Vorgabe.
		const v = zaehleAus(lage(hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), FUENF_JA)).andereKopfzaehlweise!;
		const wv = andereLesartInWorten(v, false);
		expect(wv.leitung).toContain('Folgt das Gericht der anderen Zählweise, hebt es ihn auf.');
		expect(wv.leitung).toContain(lesartVon('L13')!.nachAnnahme!);
		expect(wv.protokoll).toContain(lesartVon('L13')!.protokollNachAnnahme!);
	});

	it('Katalog: Frage, Vorgabe und Kurzgrund', () => {
		const l = lesartVon('L13')!;
		expect(l.frage).toBe(
			'Zählen bei Beschlüssen, für die das Gesetz die «Mehrheit aller Miteigentümer» verlangt, nur die Köpfe ' +
				'der Anwesenden und Vertretenen oder die aller Eigentümer?'
		);
		expect(l.vorgabe).toBe('anwesende');
		expect(l.vorgabeGrund).toBe('So zählt die herrschende Lehre, die Auffassung der meisten Fachleute.');
		expect(l.folgeUnter).toBe('anwesende');
		expect(l.wahlen.map((w) => w.bezeichnung)).toEqual(['Anwesende und Vertretene', 'Alle Eigentümer']);
	});
});

describe('L13, Behebungsrunde der Prüfungen (Block C)', () => {
	it('am Rückkommen bleibt die Rechnung, Sätze und zweites Ergebnis zu L13 entfallen (M1)', () => {
		const ziel = hergeleitet('k-baulich-notwendig', ALLE);
		const rk: Erfordernis = { ...ziel, titel: `${RUECKKOMMEN_TITEL}${ziel.titel}`, gemeinschaftslesart: undefined };
		const a = zaehleAus(lage(rk, stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']), ['p7']));
		expect(a.koepfe.basis).toBe(10);
		expect(a.andereKopfzaehlweise).toBeUndefined();
		expect(lesartKartensatz(rk)).toBeNull();
		expect(kopfzaehlweiseProtokollsatz(rk)).toBeNull();
		expect(kopfbasisStreit(rk)?.nachZaehlweise).toBeUndefined();
		// Gegenprobe am Beschluss selbst.
		expect(zaehleAus(lage(ziel, FUENF_JA)).andereKopfzaehlweise).toBeDefined();
	});

	it('nach einer Abweichung der Leitung behält das Mehr aus Gesetz und Reglement den Ausstand in der Zahl (M3)', () => {
		const vorschlag = hergeleitet('k-baulich-notwendig', ALLE);
		const gewaehlt = uebersteuere(RW, vorschlag, 'einfaches_mehr', 'So stand es in der Einladung', {
			kopfbasis: 'anwesend_vertreten'
		}).ergebnis!;
		const a = zaehleAus(lage(gewaehlt, stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']), ['p7']));
		expect(a.angenommen).toBe(true);
		expect(a.nachGesetzUndReglement?.koepfe?.basis).toBe(10);
		expect(a.nachGesetzUndReglement?.angenommen).toBe(false);
	});

	it('der zusammengesetzte Kartensatz: Mehr, Zählweise und Wertquote mit einem Schluss (M5, N-L-06)', () => {
		const zustaendig = hergeleitet('k-zustaendigkeit-gewoehnlich', { ...ALLE, L2: 'qualifiziert' });
		const satz = lesartKartensatz(zustaendig)!;
		expect(satz).toMatch(/^Zum Mehr: Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr»/);
		expect(satz).toContain(' Zur Zählweise der Köpfe: Die Köpfe zählt Votum hier unter allen Eigentümern');
		expect(satz).toContain(' Zur Wertquote im Ausstand: Tritt jemand in den Ausstand');
		expect(satz).toMatch(
			/Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «Einfaches Mehr», nach «Anwesende und Vertretene» und, wenn jemand im Ausstand ist, nach «Wertquote fällt heraus»\.$/
		);
		expect(satz.match(/Nach der Auszählung/g)).toHaveLength(1);
		// L2 «einfach»: der Rat zur Erfassung und der Satz zur Wertquote nach dem Schluss, gebunden.
		const einfach = lesartKartensatz(hergeleitet('k-zustaendigkeit-gewoehnlich', ALLE))!;
		expect(einfach.match(/Nach der Auszählung/g)).toHaveLength(1);
		const schluss = einfach.indexOf('Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «Qualifiziertes Mehr» und nach «Anwesende und Vertretene».');
		expect(schluss).toBeGreaterThan(einfach.indexOf('Die Köpfe zählt Votum hier unter allen Eigentümern'));
		expect(einfach.indexOf('Erfassen Sie dafür')).toBeGreaterThan(schluss);
		expect(einfach).toMatch(/Am Ergebnis, das Sie verkünden, ändert die Wertquote im Ausstand nichts\.$/);
		// Ohne Lesart am Mehr: Zählweise und Wertquote.
		expect(lesartKartensatz(hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE))).toMatch(
			/^Zur Zählweise der Köpfe: .* Zur Wertquote im Ausstand: .* Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «Alle Eigentümer» und, wenn jemand im Ausstand ist, nach «Wertquote fällt heraus»\.$/
		);
	});

	it('unter der Klausel neben dem zweiten Ergebnis nach L2: «am einfachen Mehr» (N-F-11), vor der Freigabe die Wahl der Gemeinschaft (N2)', () => {
		const e = hergeleitet('k-zustaendigkeit-gewoehnlich', ALLE, RW, KLAUSEL);
		expect(lesartKartensatz(e)).toContain('Hier wirkt das am einfachen Mehr nicht:');
		expect(kopfzaehlweiseProtokollsatz(e)).toMatch(/wirkt am einfachen Mehr hier nicht; das Ergebnis nach dem qualifizierten Mehr zählt nach ihr\.$/);
		// An der notwendigen Massnahme ohne zweites Ergebnis nach L2 wie in der Endfassung.
		expect(lesartKartensatz(hergeleitet('k-baulich-notwendig', ALLE, RW, KLAUSEL))).toContain('Hier wirkt das nicht:');
		// Stellt die Gemeinschaft im Entwurf um, nennt die Karte die neue Wahl.
		const vorher = hergeleitet('k-baulich-notwendig', LESARTEN_VORGABE, RW, KLAUSEL);
		expect(lesartKartensatz(vorher)).toBeNull();
		expect(lesartKartensatz(vorher, undefined, 'alle')).toContain('Ihre Gemeinschaft hat für die Köpfe «Alle Eigentümer» eingestellt.');
	});

	it('Protokoll zum Ausstand, Hinweis zur zweiten Versammlung, Klammer im Mehr (N-F-6, N-F-12, N-F-8)', () => {
		const e = hergeleitet('k-verwaltung-wichtig', ALLE);
		const a = zaehleAus(lage(e, stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']), ['p7']));
		expect(a.ausstandswirkung).toContain(
			'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer» in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10. Geklärt ist das nicht. Im Ausstand stehen 80 Wertquoten'
		);
		const zweite = mehrhinweise(e, RW.knoten.find((k) => k.id === 'k-verwaltung-wichtig'), 'zweite').join(' ');
		expect(zweite).toContain('bei den Köpfen an allen Eigentümern (Einstellung Ihrer Gemeinschaft) und bei den Wertquoten');
		expect(zweite).not.toContain('Votum zählt die Köpfe hier nach der Einstellung');
		expect(lesartKartensatz(e)).not.toContain('—');
		const anwesend = andereLesartInWorten(zaehleAus(lage(hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), FUENF_JA)).andereKopfzaehlweise!, false);
		expect(anwesend.leitung).toContain('mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten');
	});

	it('Ergebniskarte unter «Alle Eigentümer»: Enthaltungssatz und Formel unter einer Regel (N-F-5, N-F-2)', () => {
		const k = RW.knoten.find((x) => x.id === 'k-verwaltung-wichtig')!;
		const karte = ergebniskarte(RW, knotenNachLesart(RW, k, ALLE));
		expect(karte.nachZaehlweiseAlle).toBe(true);
		expect(karte.stimmwirkung.join(' ')).toContain('Bei den Enthaltungen zählen die Karten wie die herrschende Lehre;');
		expect(ergebniskarte(RW, k).stimmwirkung.join(' ')).toContain('Die Karten zählen wie die herrschende Lehre;');
		const regel: Reglementsregel = {
			id: 'r-1', stwegId: 's-1', geschaeftsart: 'verwaltung_wichtig', knotenId: 'k-verwaltung-wichtig',
			fundstelle: 'Art. 20 Reglement', kopfbasis: 'anwesend_vertreten', kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }, enthaltungZaehltMit: true
		};
		const unterRegel = karteMitReglement(karte, regel, null, null, null);
		expect(unterRegel.reglementsvorbehalt).toContain('Ohne sie hätte Votum nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») verlangt:');
		expect(unterRegel.reglementsvorbehalt).not.toContain('Das gesetzliche Erfordernis wäre gewesen');
		expect(karteMitReglement(ergebniskarte(RW, k), regel, null, null, null).reglementsvorbehalt).toContain('Das gesetzliche Erfordernis wäre gewesen');
	});
});

describe('L13, Behebungsrunde 2 der Prüfungen (Block C)', () => {
	function abgewichen(id: string, typ: Parameters<typeof uebersteuere>[2]) {
		const vorschlag = hergeleitet(id, ALLE);
		return uebersteuere(RW, vorschlag, typ, 'So stand es in der Einladung', { kopfbasis: 'anwesend_vertreten' }).ergebnis!;
	}

	it('Abweichung der Leitung nur in der Zählweise: die Einstellung beim Namen, Rat der Endfassung (N2-F-1)', () => {
		const e = abgewichen('k-baulich-notwendig', 'einfaches_mehr');
		expect(lesartKartensatz(e)).toBe(
			'Gezählt wird nach dem hier gewählten Mehr. Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») gälte mehr als die Hälfte aller Eigentümer, gleich wer erscheint; nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach. So zählt auch der Wortlaut des Gesetzes. Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das Bundesgericht hat für diese Art von Beschluss nicht entschieden. Ein angenommener Beschluss, dem nicht mehr als die Hälfte aller Eigentümer zugestimmt hat, kann angefochten werden.'
		);
		const a = zaehleAus(lage(e, FUENF_JA));
		expect(a.angenommen).toBe(true);
		const leitung = andereLesartInWorten(a.nachGesetzUndReglement!, false).leitung;
		expect(leitung).toBe(
			'Nach dem hier gewählten Mehr (mehr als die Hälfte der Anwesenden oder Vertretenen) ist der Antrag angenommen. ' +
				'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre er abgelehnt: 5 Ja von 10 Kopfstimmen, nötig 6. ' +
				'Verkündet bleibt das Ergebnis nach dem hier gewählten Mehr; zählen Sie nicht neu aus. Der Beschluss gilt, bis ein Gericht ihn aufhebt. ' +
				'Wer nicht zugestimmt hat, kann ihn beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75); hebt das Gericht ihn auf, gilt er als nicht gefasst, auch rückwirkend. ' +
				lesartVon('L13')!.nachAnnahme
		);
		expect(leitung).toContain('Eilt die Arbeit, darf der Beschluss ausgeführt werden, denn er gilt.');
		expect(leitung).not.toContain('Gesetz und Reglement');
		expect(andereLesartInWorten(zaehleAus(lage(e, SECHS_JA)).nachGesetzUndReglement!, false).leitung).toBe(
			'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre das Ergebnis dasselbe.'
		);
		// Die Spalte zum Vergleich der Auszählmappe trägt die Einstellung, nicht «Gesetz und Reglement».
		expect(vergleicheZu(e, M).find((v) => v.worte.kennung === 'A')?.worte.wahl).toBe('Alle Eigentümer');
		// Gegenprobe unter der Vorgabe: der Bestand.
		const vorgabe = uebersteuere(RW, hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE), 'einfaches_mehr', 'Einladung', {
			kopfbasis: 'anwesend_vertreten'
		}).ergebnis!;
		expect(lesartKartensatz(vorgabe)).toContain('Nach Gesetz und Reglement gälte');
	});

	it('Abweichung der Leitung zugleich im Mehr: der Bestand mit der Bezeichnung nach der Zählweise (N2-F-1)', () => {
		const e = abgewichen('k-verwaltung-wichtig', 'einfaches_mehr');
		const satz = lesartKartensatz(e)!;
		expect(satz).toContain(
			'Nach dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, gälte mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten;'
		);
		expect(satz).not.toContain('Gesetz und Reglement');
		const leitung = andereLesartInWorten(zaehleAus(lage(e, FUENF_JA)).nachGesetzUndReglement!, false).leitung;
		expect(leitung).toContain(
			'Nach dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet (mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten), wäre er abgelehnt'
		);
		expect(leitung).toContain('Als gültiges Mehr leitet Votum das aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe her;');
		expect(leitung).toContain('mit dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, in der Einladung.');
		expect(leitung).not.toContain('Gesetz und Reglement');
	});

	it('nach der Auszählung: woher die Zahl aller Eigentümer am anderen Mehr kommt (N2-F-2)', () => {
		const SATZ =
			'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für diese Versammlung eingestellt war; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.';
		for (const [id, kennung] of [
			['k-bewirtschaftung-waehlen-erweitert', 'L4'],
			['k-prozessfuehrung', 'L11']
		] as const) {
			const r = zaehleAus(lage(hergeleitet(id, { ...ALLE, [kennung]: 'einfach' }), FUENF_JA)).andereLesart!;
			expect(r.abweichend, id).toBe(true);
			const w = andereLesartInWorten(r, false);
			expect(w.protokoll, id).toMatch(/5 Ja von 10 Kopfstimmen, nötig 6; 600 Ja von 1000 Wertquoten, nötig 501\. Dieses zweite Ergebnis/);
			expect(w.protokoll, id).toContain(SATZ);
			expect(w.leitung, id).toContain(`nötig 501. ${SATZ} `);
		}
		// Gegenprobe unter der Vorgabe zu L13: kein Satz.
		const v = andereLesartInWorten(
			zaehleAus(lage(hergeleitet('k-bewirtschaftung-waehlen-erweitert', { ...LESARTEN_VORGABE, L4: 'einfach' }), FUENF_JA)).andereLesart!,
			false
		);
		expect(v.protokoll ?? '').not.toContain('Dieses zweite Ergebnis');
		expect(v.leitung).not.toContain('Dieses zweite Ergebnis');
	});

	it('am Rückkommen unter «Alle Eigentümer» der eigene Satz zur Zählung, ohne «umstritten» (M-A, N2-F-3)', () => {
		const SATZ =
			'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, wie am Beschluss selbst; die herrschende Lehre zählt nur die Anwesenden und Vertretenen.';
		for (const id of ['k-baulich-notwendig', 'k-verwaltung-wichtig']) {
			const ziel = hergeleitet(id, ALLE);
			const rk: Erfordernis = { ...ziel, titel: `${RUECKKOMMEN_TITEL}${ziel.titel}`, gemeinschaftslesart: undefined };
			expect(kopfbasisStreit(rk), id).toEqual({ satz: SATZ, streitig: false });
			// Die Vorschau mit vier von zehn: der Satz, die Folge am Rückkommen, keine «strenge Lesart».
			const leer = zaehleAus({ ...lage(rk, []), anwesende: ['p1', 'p2', 'p3', 'p4'] });
			const vorschau = erreichbarkeitshinweis(rk, leer, false)!;
			expect(vorschau, id).toContain(
				`${SATZ} Lassen Sie abstimmen, ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.`
			);
			expect(vorschau, id).not.toContain('umstritten');
			expect(vorschau, id).not.toContain('strengen Lesart');
			// Gegenprobe am Beschluss: der Satz zum Sachbeschluss.
			expect(kopfbasisStreit(ziel)?.satz, id).toMatch(/^Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern\. Erreicht/);
		}
	});

	it('frühere Fassung unter «alle»: auch das andere Mehr zählt (N-B)', () => {
		const e = hergeleitet('k-bewirtschaftung-waehlen-erweitert', { ...LESARTEN_VORGABE, L4: 'einfach' }, VORHER);
		const andere = e.gemeinschaftslesart!.andere;
		const z = {
			fassung: e.fassung!,
			typ: e.typ,
			rechtsgrundlage: e.rechtsgrundlage,
			kopfbasis: e.kopfbasis,
			quelle: e.quelle,
			enthaltungZaehltMit: e.enthaltungZaehltMit ?? null
		};
		expect(zaehlweiseVeraltet(z, 'alle')).toBe(false);
		expect(zaehlweiseVeraltet({ ...z, andere: { typ: andere.typ, rechtsgrundlage: andere.rechtsgrundlage, kopfbasis: andere.kopfbasis } }, 'alle')).toBe(true);
		expect(zaehlweiseVeraltet({ ...z, andere: { typ: andere.typ, rechtsgrundlage: andere.rechtsgrundlage, kopfbasis: andere.kopfbasis } }, 'anwesende')).toBe(false);
	});

	it('Ausstand unter «Alle Eigentümer»: Zahl der Parteien, am Rückkommen der Bezug, ohne Wertquoten kein Satz dazu (N-F, N2-L-04)', () => {
		const ziel = hergeleitet('k-baulich-notwendig', ALLE);
		const sechs = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']);
		expect(zaehleAus(lage(ziel, sechs, ['p7'])).ausstandswirkung).toBe(
			'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer» in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10. Geklärt ist das nicht.'
		);
		const rk: Erfordernis = { ...ziel, titel: `${RUECKKOMMEN_TITEL}${ziel.titel}`, gemeinschaftslesart: undefined };
		expect(zaehleAus(lage(rk, sechs, ['p7'])).ausstandswirkung).toBe(
			'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer», wie beim ursprünglichen Beschluss, in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10. Geklärt ist das nicht.'
		);
		// Gegenprobe unter der Vorgabe: der Bestand mit den Wertquoten.
		expect(zaehleAus(lage(hergeleitet('k-baulich-notwendig', LESARTEN_VORGABE), sechs, ['p7'])).ausstandswirkung).toMatch(
			/^Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 6 statt 7 Kopfstimmen\. Bei den Wertquoten/
		);
	});

	it('vor der Freigabe nennt der Satz zu L4 «einfach» das andere Mehr nach der Wahl der Gemeinschaft (N-A)', () => {
		const e = hergeleitet('k-bewirtschaftung-waehlen-erweitert', { ...LESARTEN_VORGABE, L4: 'einfach' });
		expect(e.kopfzaehlweise).toBe('anwesende');
		const ZWEITES = 'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern';
		expect(lesartKartensatz(e)).not.toContain(ZWEITES);
		const umgestellt = lesartKartensatz(e, undefined, 'alle')!;
		expect(umgestellt).toContain(ZWEITES);
		expect(umgestellt).toContain('Die andere Lesart («Qualifiziertes Mehr») verlangt mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint)');
		// Wo L13 am eigenen Mehr wirkt, bleibt das gespeicherte Mehr (Kasten und Absage zeigen es).
		const wichtig = hergeleitet('k-verwaltung-wichtig', LESARTEN_VORGABE);
		expect(lesartKartensatz(wichtig, undefined, 'alle')).toBe(lesartKartensatz(wichtig));
	});

	it('die Eimer der Wertquoten ergeben die Bezugsgrösse unter «alle» mit L1 beider Wahlen (M-C)', () => {
		const eimer = (q: ReturnType<typeof zaehleAus>['quoten']) =>
			q.ja + q.nein + q.enthaltung + q.ohneAbgabe + q.nichtAnwesend + (q.stimmtNicht ?? 0) + (q.imAusstand ?? 0);
		const sechs = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']);
		for (const wahl of [ALLE, LESARTEN_VORGABE]) {
			for (const ausstandslesart of ['bleibt', 'faellt_heraus'] as const) {
				const e = { ...hergeleitet('k-verwaltung-wichtig', wahl), ausstandslesart };
				const q = zaehleAus(lage(e, sechs, ['p7'])).quoten;
				expect(q.basis, `${wahl.L13} ${ausstandslesart}`).toBe(ausstandslesart === 'bleibt' ? 1000 : 920);
				expect(eimer(q), `${wahl.L13} ${ausstandslesart}`).toBe(q.basis);
			}
		}
	});

	it('Siegelzeile: wo L13 wirkt, nach dem gerechneten Mehr, nicht am Rückkommen (M-C)', () => {
		const alle = hergeleitet('k-baulich-notwendig', ALLE);
		expect(kopfzaehlweiseSiegelzeile(alle)).toBe('Zählweise der Köpfe (Lesart L13): Alle Eigentümer');
		expect(kopfzaehlweiseSiegelzeile(hergeleitet('k-baulich-notwendig', LESARTEN_VORGABE))).toBe(
			'Zählweise der Köpfe (Lesart L13): Anwesende und Vertretene (Vorgabe)'
		);
		const rk: Erfordernis = { ...alle, titel: `${RUECKKOMMEN_TITEL}${alle.titel}`, gemeinschaftslesart: undefined };
		expect(kopfzaehlweiseSiegelzeile(rk)).toBeNull();
		expect(kopfzaehlweiseSiegelzeile(hergeleitet('k-baulich-nuetzlich', ALLE))).toBeNull();
		expect(kopfzaehlweiseSiegelzeile(hergeleitet('k-baulich-notwendig', ALLE, VORHER))).toBeNull();
	});

	it('der sichere Weg zur Zählweise unter einer Regel steht hinter «Sonst» (N4, R5-F-4; M-C)', () => {
		const k = RW.knoten.find((x) => x.id === 'k-verwaltung-wichtig')!;
		const regel: Reglementsregel = {
			id: 'r-1', stwegId: 's-1', geschaeftsart: 'verwaltung_wichtig', knotenId: 'k-verwaltung-wichtig',
			fundstelle: 'Art. 20 Reglement', kopfbasis: 'anwesend_vertreten', kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }, enthaltungZaehltMit: true
		};
		const satz = karteMitReglement(ergebniskarte(RW, k), regel, null, null, null, undefined, erfordernisAusKnoten(RW, k)).reglementsvorbehalt!;
		const SICHER = 'Im Streit um die Zählweise der Köpfe sicher ist er, wenn mehr als die Hälfte aller Eigentümer zugestimmt hat. ';
		expect(satz).toContain(SICHER);
		expect(satz.indexOf('Sonst ist er angreifbarer')).toBeGreaterThan(-1);
		expect(satz.indexOf(SICHER)).toBeGreaterThan(satz.indexOf('Sonst ist er angreifbarer'));
		expect(satz.indexOf(SICHER)).toBeLessThan(satz.indexOf('Scheitert ein Antrag nur an'));
		// Gegenprobe ausserhalb der vier Bestimmungen: ohne den Satz.
		const n = RW.knoten.find((x) => x.id === 'k-baulich-nuetzlich')!;
		const nuetzlich = karteMitReglement(ergebniskarte(RW, n), { ...regel, geschaeftsart: n.geschaeftsart!, knotenId: 'k-baulich-nuetzlich' }, null, null, null, undefined, erfordernisAusKnoten(RW, n));
		expect(nuetzlich.reglementsvorbehalt ?? '').not.toContain('Im Streit um die Zählweise der Köpfe');
	});

	it('unter einer Regel an der Wahl der erweiterten Bewirtschaftung: «sicher» mit der Zählweise, nicht rückwirkend (N2-F-5)', () => {
		const NEU =
			'Wer sicher gehen will, strebt das qualifizierte Mehr an; stimmt dabei mehr als die Hälfte aller Eigentümer zu, auch der abwesenden, kommt es auch auf den Streit um die Zählweise der Köpfe nicht an.';
		const jetzt = JSON.stringify(RW.knoten.find((k) => k.id === 'k-bewirtschaftung-waehlen-erweitert'));
		expect(jetzt).toContain(NEU);
		expect(jetzt.split('strebt das qualifizierte Mehr an.').length).toBe(1);
		expect(JSON.stringify(VORHER.knoten.find((k) => k.id === 'k-bewirtschaftung-waehlen-erweitert'))).not.toContain(NEU);
	});
});

describe('L13, Block D nach der Featureprüfung', () => {
	const NACHHER =
		'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für diese Versammlung eingestellt war; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.';
	const VORHER_SATZ =
		'Das Ergebnis danach zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.';
	const abgewichen = (id: string, wahl: Lesartenwahl) =>
		uebersteuere(RW, hergeleitet(id, wahl), 'einfaches_mehr', 'So stand es in der Einladung', { kopfbasis: 'anwesend_vertreten' })
			.ergebnis!;

	it('Abweichung mit anderem Mehr: Kartensatz und Leitung sagen, woher die Zahl aller Eigentümer kommt (N3-F-2)', () => {
		const e = abgewichen('k-verwaltung-wichtig', ALLE);
		expect(lesartKartensatz(e)).toContain(`nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach. ${VORHER_SATZ} `);
		const leitung = andereLesartInWorten(zaehleAus(lage(e, FUENF_JA)).nachGesetzUndReglement!, false).leitung;
		expect(leitung).toContain(`600 Ja von 1000 Wertquoten, nötig 501. ${NACHHER} Verkündet bleibt`);
		// Gegenproben: nur die Zählweise weicht ab (eigener Wortlaut), und unter der Vorgabe der Bestand.
		expect(lesartKartensatz(abgewichen('k-baulich-notwendig', ALLE))).not.toContain(VORHER_SATZ);
		const vorgabe = abgewichen('k-verwaltung-wichtig', LESARTEN_VORGABE);
		expect(lesartKartensatz(vorgabe)).not.toContain(VORHER_SATZ);
		expect(andereLesartInWorten(zaehleAus(lage(vorgabe, FUENF_JA)).nachGesetzUndReglement!, false).leitung).not.toContain(
			'Dieses zweite Ergebnis'
		);
	});

	it('frühere Fassung mit Enthaltungsklausel: das andere Mehr erbt die Klausel nicht (N3-1)', () => {
		const e = hergeleitet('k-zustaendigkeit-gewoehnlich', LESARTEN_VORGABE, VORHER, KLAUSEL);
		expect(e.enthaltungZaehltMit).toBe(false);
		const a = e.gemeinschaftslesart!.andere;
		const z = {
			fassung: e.fassung!,
			typ: e.typ,
			rechtsgrundlage: e.rechtsgrundlage,
			kopfbasis: e.kopfbasis,
			quelle: e.quelle,
			enthaltungZaehltMit: false,
			andere: { typ: a.typ, rechtsgrundlage: a.rechtsgrundlage, kopfbasis: a.kopfbasis }
		};
		expect(zaehlweiseVeraltet(z, 'alle')).toBe(true);
		expect(zaehlweiseVeraltet({ ...z, andere: null }, 'alle')).toBe(false);
		expect(zaehlweiseVeraltet(z, 'anwesende')).toBe(false);
	});

	it('Spaltenkopf der Mappe und Feld «ausschlussklage» (N3-5)', () => {
		const e = abgewichen('k-verwaltung-wichtig', ALLE);
		const posten = mappenpostenAus({ nummer: '1', titel: 'Neue Heizung' }, e, M, { neuAnZweiter: false, wahl: 'erste' })!;
		expect(posten.vergleiche?.find((v) => v.kennung === 'A')?.wahl).toBe(
			'Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet'
		);
		expect(
			mappenpostenAus({ nummer: '2', titel: 'Dach' }, abgewichen('k-baulich-notwendig', ALLE), M, { neuAnZweiter: false, wahl: 'erste' })!
				.vergleiche?.find((v) => v.kennung === 'A')?.wahl
		).toBe('Alle Eigentümer');
		expect(posten.ausschlussklage).toBe(false);
		const klage = hergeleitet('k-ausschlussklage', LESARTEN_VORGABE);
		expect(mappenpostenAus({ nummer: '3', titel: 'Klage' }, klage, M, { neuAnZweiter: false, wahl: 'erste' })?.ausschlussklage).toBe(true);
	});
});

describe('L13 «Alle Eigentümer»: im Ausstand und zugleich als betroffen eingetragen (Featureprüfung Regel 43, M3)', () => {
	/*
	 * p7 ist da, im Ausstand und als betroffen eingetragen; so schreibt es das
	 * Traktandenformular, das Betroffene ohne Prüfung der Karte speichert. Unter
	 * «Alle Eigentümer» nimmt Antwort 9 niemanden aus: p7 bleibt in der Zahl,
	 * stimmt nicht und wirkt wie ein Nein. Bis zur Behebung fiel p7 heraus,
	 * Bezugsgrösse 9 statt 10, die Auszählmappe zog nichts ab.
	 */
	const SECHS_ABGEGEBEN = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'no']);
	const mitBetroffenem = (e: Erfordernis, ausstand: string[], betroffen: string[]): Auszaehlungslage => ({
		...lage(e, SECHS_ABGEGEBEN, ausstand),
		betroffeneParteiIds: betroffen
	});

	it.each([['k-verwaltung-wichtig'], ['k-baulich-notwendig']])(
		'%s: bleibt in der Kopfzahl, auch von Hand gezählt, und das zweite Ergebnis bleibt',
		(id) => {
			const e = hergeleitet(id, ALLE);
			expect(e.kopfbasis).toBe('alle_eigentuemer');
			const a = zaehleAus(mitBetroffenem(e, ['p7'], ['p7']));
			expect(a.koepfe.basis).toBe(10);
			expect(a.koepfe.imAusstand).toBe(1);
			// Dieselbe Zahl wie ohne den Eintrag als betroffen.
			expect(a.koepfe.basis).toBe(zaehleAus(lage(e, SECHS_ABGEGEBEN, ['p7'])).koepfe.basis);
			// Das zweite Ergebnis an den Anwesenden lässt p7 heraus wie sonst.
			expect(a.andereKopfzaehlweise?.koepfe?.basis).toBe(6);
			// Von Hand zählen lässt sich nur das Mehr ohne Wertquoten (Art. 647c);
			// am Mehr nach Art. 647b Abs. 1 sagt `summenhindernis` ab.
			if (id === 'k-baulich-notwendig') {
				const hand = zaehleSummenAus(
					{ momentaufnahme: M, erfordernis: e, anwesende: DA, imAusstand: ['p7'], betroffeneParteiIds: ['p7'] },
					{ ja: 5, nein: 1, enthaltung: 0 }
				);
				expect(hand.koepfe.basis).toBe(10);
			}
			// Unter der Vorgabe ändert sich die Hauptzählung nicht: p7 fällt aus der Zahl
			// der Anwesenden. Das zweite Ergebnis nach L13 «Alle», das immer im Protokoll
			// steht, behält p7 jetzt auch (bis zur Behebung 9), nach Antwort 9 richtig.
			const v = zaehleAus(mitBetroffenem(hergeleitet(id, LESARTEN_VORGABE), ['p7'], ['p7']));
			expect(v.koepfe.basis).toBe(6);
			expect(v.andereKopfzaehlweise?.koepfe?.basis).toBe(10);
		}
	);

	it('an der Ausschlussklage fällt der Beklagte im Ausstand weiter heraus, seine Angehörigen im Ausstand bleiben', () => {
		for (const wahl of [LESARTEN_VORGABE, ALLE]) {
			const klage = hergeleitet('k-ausschlussklage', wahl);
			expect(klage.kopfbasis).toBe('alle_ausser_betroffene');
			// p7 beklagt und im Ausstand, p6 Angehöriger im Ausstand.
			const a = zaehleAus(mitBetroffenem(klage, ['p6', 'p7'], ['p7']));
			expect(a.koepfe.basis).toBe(9);
			expect(a.koepfe.imAusstand).toBe(1);
			// Von der Leitung auf «alle Eigentümer» gestellt: der Beklagte bleibt draussen.
			const alle = zaehleAus(mitBetroffenem({ ...klage, kopfbasis: 'alle_eigentuemer' }, ['p6', 'p7'], ['p7']));
			expect(alle.koepfe.basis).toBe(9);
		}
	});
});
