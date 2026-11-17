/**
 * Regel «Köpfe zählen nicht»: das einfache Mehr nur nach Wertquoten
 * (Produktentscheid 16.11.2026, Auftrag
 * `2026-11-16-votum-erste-versammlung-wertquoten-abend-h1.md`, Block A).
 *
 * Kriterien 1 bis 3 und 8: Eine Regel ohne Kopfschwelle lässt sich hinterlegen
 * und nimmt einen Antrag mit der Mehrheit der Anteile ohne die der Köpfe an;
 * bei Gleichstand nach Anteilen bietet Votum den Stichentscheid der
 * hinterlegten Art an; eine Probe rechnet alle beschlussfähigen Lagen einer
 * erfundenen Gemeinschaft mit sechs ungleichen Quoten gegen eine eigene
 * Nachrechnung, die nichts aus dem Kern benutzt.
 *
 * Alle Gemeinschaften, Quoten und Namen sind erfunden.
 */
import { describe, expect, it } from 'vitest';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { holeRegelwerk } from '$lib/rules';
import { knotenVon } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, EINSPRACHE_KNOTEN, gesetzesmassVon, type Erfordernis } from '$lib/domain/entscheidbaum';
import {
	regelOhneKoepfeGiltFuer,
	legeReglementsregelAn,
	pruefeReglementsregel,
	regelInWorten,
	vergleicheMasse,
	wendeReglementAn,
	type Reglementsregel,
	type ReglementsregelEingabe
} from '$lib/domain/reglement';
import {
	erfordernisInWorten,
	ergebnisInWorten,
	mehrheitsvorschau,
	stichentscheidGrenzeKartensatz,
	stichentscheidMoeglich,
	summenhindernis,
	zaehleAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { erfordernisluecke } from '$lib/domain/abstimmung';
import { mindestensSoStreng } from '$lib/domain/rueckkommen';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Snapshot, Stichentscheid, Vote, VoteChoice } from '$lib/domain/types';
import { baueAuszaehlmappe, mappenrechnungAus } from '$lib/domain/auszaehlmappe';
import type { Zelle } from '$lib/domain/xlsx';

const RW = holeRegelwerk();

/** Erfundene Quoten, ungleich, Summe 1000. */
const QUOTEN = [287, 211, 173, 142, 109, 78];

const NUR_QUOTEN: ReglementsregelEingabe = {
	stwegId: 'stweg-erfunden',
	geschaeftsart: 'verwaltung_gewoehnlich',
	kopfSchwelle: null,
	kopfbasis: 'anwesend_vertreten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenbasis: 'anwesend_vertreten',
	fundstelle: 'Art. 99 Reglement (erfunden)',
	enthaltungZaehltMit: true
};

function regel(u: Partial<ReglementsregelEingabe> = {}): Reglementsregel {
	return { ...pruefeReglementsregel({ ...NUR_QUOTEN, ...u }, RW), id: 'r-1' };
}

function vorschlag(knotenId: string): Erfordernis {
	return erfordernisAusKnoten(RW, knotenVon(RW, knotenId)!);
}

/** Das Erfordernis am gewöhnlichen Verwaltungsgeschäft unter der Regel ohne Köpfe. */
function angewandt(u: Partial<ReglementsregelEingabe> = {}): Erfordernis {
	const a = wendeReglementAn(vorschlag('k-verwaltung-gewoehnlich'), [regel(u)], null, LESARTEN_VORGABE);
	expect(a.vorbehalt).toBeNull();
	return a.erfordernis;
}

function momentaufnahme(tieBreak: Stichentscheid = 'keiner'): Snapshot {
	return {
		meetingId: 'v-erfunden',
		takenAt: '2026-11-20T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: true,
		headCountRuleSource: null,
		tieBreak,
		totalQuota: QUOTEN.reduce((s, q) => s + q, 0),
		parties: QUOTEN.map((q, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${String.fromCharCode(65 + i)}`,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `p${i + 1}-u1`, label: `Einheit ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: q }]
		}))
	};
}

function stimmen(wahl: (VoteChoice | null)[]): Vote[] {
	return wahl.flatMap((w, i) =>
		w === null
			? []
			: [{ partyId: `p${i + 1}`, unitId: `p${i + 1}-u1`, choice: w, castAt: '2026-11-20T19:10:00.000Z', recordedByChair: false }]
	);
}

function lage(
	e: Erfordernis,
	wahl: (VoteChoice | null)[],
	anwesend: number[],
	tieBreak: Stichentscheid = 'keiner',
	u: Partial<Auszaehlungslage> = {}
): Auszaehlungslage {
	return {
		momentaufnahme: momentaufnahme(tieBreak),
		erfordernis: e,
		stimmen: stimmen(wahl),
		anwesende: anwesend.map((i) => `p${i + 1}`),
		...u
	};
}

describe('Kriterium 1: Regel ohne Köpfe hinterlegen und anwenden', () => {
	it('lässt sich ohne Kopfschwelle hinterlegen, wenn eine Wertquotenschwelle besteht', () => {
		const u = legeReglementsregelAn('r-1', NUR_QUOTEN, RW);
		expect(u.ergebnis.kopfSchwelle).toBeNull();
		expect(u.ereignisse[0].angaben).toMatchObject({ kopf: 'Köpfe zählen nicht', kopfart: null, quoten: '1/2' });
		expect(regelInWorten(u.ergebnis)).toBe(
			'mehr als die Hälfte der anwesenden oder vertretenen Wertquoten, unabhängig von der Zahl der Eigentümer.'
		);
	});

	it('weist eine Regel ohne Köpfe und ohne Wertquoten ab', () => {
		expect(() => pruefeReglementsregel({ ...NUR_QUOTEN, quotenSchwelle: null, quotenbasis: 'keine' }, RW)).toThrow(
			FachlicherFehler
		);
	});

	it('setzt die Kopfbasis ohne Köpfe fest, statt einen gewählten Wert mitzuschleppen', () => {
		expect(pruefeReglementsregel({ ...NUR_QUOTEN, kopfbasis: 'alle_eigentuemer' }, RW).kopfbasis).toBe(
			'anwesend_vertreten'
		);
	});

	it('nimmt mit der Mehrheit der Anteile an, auch ohne die Mehrheit der Köpfe', () => {
		// A, B und F (576) dafür, C, D, E (424) dagegen: 3 von 6 Köpfen, also keine
		// Kopfmehrheit, aber die Mehrheit der Anteile.
		const e = angewandt();
		const a = zaehleAus(lage(e, ['yes', 'yes', 'no', 'no', 'no', 'yes'], [0, 1, 2, 3, 4, 5]));
		expect(a.koepfe).toMatchObject({ ja: 3, basis: 6, schwelle: null, erreicht: true });
		expect(a.quoten).toMatchObject({ ja: 576, basis: 1000, schwelle: 501, erreicht: true });
		expect(a.angenommen).toBe(true);
		expect(ergebnisInWorten(a, e)).toMatch(
			/^Angenommen: 576 Ja von 1000 Wertquoten, nötig 501; 3 Ja von 6 Kopfstimmen, zur Auskunft\. Nötig war mehr als die Hälfte der anwesenden oder vertretenen Wertquoten, unabhängig von der Zahl der Eigentümer/
		);
	});

	it('lehnt ab, wenn die Anteile fehlen', () => {
		const e = angewandt();
		// A und B (498) dafür, C bis F (502) dagegen: knapp abgelehnt.
		const b = zaehleAus(lage(e, ['yes', 'yes', 'no', 'no', 'no', 'no'], [0, 1, 2, 3, 4, 5]));
		expect(b.koepfe.ja).toBe(2);
		expect(b.quoten.ja).toBe(498);
		expect(b.angenommen).toBe(false);
		expect(ergebnisInWorten(b, e)).toContain('die Mehrheit der Wertquoten fehlt');
		expect(ergebnisInWorten(b, e)).not.toContain('die Mehrheit der Köpfe fehlt');
	});

	it('gibt die Abstimmung frei und sagt der Leitung vorher, was nötig ist', () => {
		const e = angewandt();
		expect(erfordernisluecke(e, 0)).toBeNull();
		const v = mehrheitsvorschau({ momentaufnahme: momentaufnahme(), erfordernis: e, anwesende: ['p1', 'p2', 'p3', 'p4'] });
		expect(v.kopf).toBeNull();
		expect(v.satz).toBe(
			'Nötig: 407 von 813 Wertquoten (der anwesenden oder vertretenen Wertquoten), unabhängig von der Zahl der Eigentümer.'
		);
		expect(erfordernisInWorten(e)).toBe(
			'mehr als die Hälfte der anwesenden oder vertretenen Wertquoten, unabhängig von der Zahl der Eigentümer'
		);
	});

	it('lässt keine Handzählung zu und nennt dafür die Wertquoten als Grund', () => {
		const satz = summenhindernis(angewandt());
		expect(satz).toContain('verlangt eine Mehrheit der Wertquoten');
		expect(satz).not.toContain('neben den Köpfen');
	});
});

describe('Nur beim einfachen Mehr (Produktentscheid 16.11.2026)', () => {
	it('wendet die Regel am qualifizierten Mehr nicht an und sagt warum', () => {
		const q = vorschlag('k-baulich-nuetzlich');
		const a = wendeReglementAn(q, [regel({ geschaeftsart: 'baulich_nuetzlich' })], null, LESARTEN_VORGABE);
		expect(a.vorbehalt).toBe('ohne_koepfe');
		expect(a.erfordernis.kopfSchwelle).not.toBeNull();
	});

	it('nennt an der Reglementsänderung den eigenen Grund, nicht «gemischt» (Codeprüfung N1)', () => {
		const k = knotenVon(RW, 'k-reglement-normal')!;
		const a = wendeReglementAn(
			erfordernisAusKnoten(RW, k),
			[regel({ geschaeftsart: k.geschaeftsart })],
			null,
			LESARTEN_VORGABE
		);
		expect(a.vorbehalt).toBe('ohne_koepfe');
	});

	it('wendet sie an der Einsprache nicht an, die sich nur verschärfen lässt', () => {
		const k = knotenVon(RW, EINSPRACHE_KNOTEN)!;
		const a = wendeReglementAn(
			erfordernisAusKnoten(RW, k),
			[regel({ geschaeftsart: k.geschaeftsart, knotenId: k.id })],
			null,
			LESARTEN_VORGABE
		);
		expect(a.vorbehalt).not.toBeNull();
		expect(a.erfordernis.kopfSchwelle).not.toBeNull();
	});

	it('nennt die Fälle, an denen eine Regel ohne Köpfe greift (Codeprüfung N2)', () => {
		const organe = regelOhneKoepfeGiltFuer(RW, 'organe');
		expect(organe.length).toBeGreaterThan(0);
		const erweitert = knotenVon(RW, 'k-bewirtschaftung-erweitert');
		if (erweitert) expect(organe).not.toContain(erweitert.titel);
		expect(regelOhneKoepfeGiltFuer(RW, 'baulich_nuetzlich')).toEqual([]);
		// Das Rückkommen hat keinen Knoten, eine Regel greift dort trotzdem (Laienprüfung R2-L4).
		expect(regelOhneKoepfeGiltFuer(RW, 'rueckkommen').length).toBe(2);
		expect(regelOhneKoepfeGiltFuer(RW, 'organe', 'k-bewirtschaftung-erweitert')).toEqual([]);
		expect(regelOhneKoepfeGiltFuer(RW, 'verwaltung_gewoehnlich', 'k-verwaltung-gewoehnlich')).toEqual([
			knotenVon(RW, 'k-verwaltung-gewoehnlich')!.titel
		]);
	});

	it('ordnet ohne Köpfe gegen Köpfe als gemischt ein, ohne Köpfe gegen ohne Köpfe als gleich', () => {
		const ohne = { kopfbasis: 'anwesend_vertreten' as const, kopfSchwelle: null, quotenbasis: 'anwesend_vertreten' as const, quotenSchwelle: NUR_QUOTEN.quotenSchwelle, enthaltungZaehltMit: true };
		const mit = { ...ohne, kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const }, quotenbasis: 'keine' as const, quotenSchwelle: null };
		expect(vergleicheMasse(ohne, mit, false)).toBe('gemischt');
		expect(vergleicheMasse(ohne, ohne, false)).toBe('gleich');
	});

	it('Rückkommen: ohne Köpfe ist nicht so streng wie ein Mehr mit Köpfen, gleich streng wie sich selbst', () => {
		const e = angewandt();
		expect(mindestensSoStreng(e, vorschlag('k-verwaltung-gewoehnlich'))).toBe(false);
		expect(mindestensSoStreng(e, e)).toBe(true);
	});
});

describe('Kriterium 2: Stichentscheid bei Gleichstand nach Anteilen', () => {
	/** Die erste Lage der Probe unten mit gleichen Wertquoten für Ja und Nein. */
	function gleichstand(): { wahl: VoteChoice[]; anwesend: number[] } {
		for (const anwesend of beschlussfaehigeMengen()) {
			for (const wahl of verteilungen<VoteChoice>(anwesend.length, ['yes', 'no'])) {
				const ja = anwesend.filter((_, i) => wahl[i] === 'yes').reduce((s, i) => s + QUOTEN[i], 0);
				const basis = anwesend.reduce((s, i) => s + QUOTEN[i], 0);
				if (ja * 2 === basis) return { wahl, anwesend };
			}
		}
		throw new Error('Kein Gleichstand in den erfundenen Quoten.');
	}

	function zaehle(tieBreak: Stichentscheid, u: Partial<Auszaehlungslage> = {}) {
		const { wahl, anwesend } = gleichstand();
		const voll: (VoteChoice | null)[] = QUOTEN.map(() => null);
		anwesend.forEach((i, k) => (voll[i] = wahl[k]));
		const e = angewandt();
		return { e, a: zaehleAus(lage(e, voll, anwesend, tieBreak, u)) };
	}

	it('der Kern kennt den Stichentscheid hier', () => {
		expect(stichentscheidMoeglich(angewandt())).toBe(true);
		expect(stichentscheidMoeglich(angewandt({ quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } }))).toBe(false);
		// «mindestens die Hälfte»: Der Gleichstand ist angenommen, es gibt nichts aufzulösen.
		const mindestens = angewandt({ quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mindestens' } });
		expect(stichentscheidMoeglich(mindestens)).toBe(false);
		expect(stichentscheidGrenzeKartensatz(mindestens, 'wertquote')).toBeNull();
		// Und der Kern zählt den Gleichstand dort als angenommen (Codeprüfung, Behebungsblock).
		const { wahl, anwesend } = gleichstand();
		const voll: (VoteChoice | null)[] = QUOTEN.map(() => null);
		anwesend.forEach((i, k) => (voll[i] = wahl[k]));
		const a = zaehleAus(lage(mindestens, voll, anwesend, 'verwalter'));
		expect(a.angenommen).toBe(true);
		expect(a.stichentscheidOffen).toBe(false);
	});

	it('Verwaltung: hält an, bis der Entscheid eingetragen ist', () => {
		const { e, a } = zaehle('verwalter');
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('verwalter');
		expect(a.angenommen).toBe(false);
		expect(ergebnisInWorten(a, e)).toMatch(/^Stimmengleichheit bei (\d+) zu \1 Wertquoten\. Nach dem Reglement entscheidet der Verwalter/);
		expect(a.hinweise.join(' ')).toContain('Gleichstand bei den Wertquoten');
	});

	it('Verwaltung entscheidet für den Antrag: angenommen durch Stichentscheid', () => {
		const { a } = zaehle('verwalter', {
			stichentscheid: { wer: 'Verwaltung Muster (erfunden)', wahl: 'yes' }
		});
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.durchStichentscheid).toBe(true);
		expect(a.angenommen).toBe(true);
	});

	it('Verwaltung entscheidet dagegen: abgelehnt durch Stichentscheid', () => {
		const { a } = zaehle('verwalter', {
			stichentscheid: { wer: 'Verwaltung Muster (erfunden)', wahl: 'no' }
		});
		expect(a.durchStichentscheid).toBe(true);
		expect(a.angenommen).toBe(false);
	});

	it('Vorsitz, allein und als zweite Stufe: entscheidet die Person im Vorsitz', () => {
		for (const art of ['vorsitz', 'wertquote_vorsitz'] as const) {
			const { e, a } = zaehle(art);
			expect(a.stichentscheidOffen).toBe(true);
			expect(a.stichentscheidArt).toBe('vorsitz');
			expect(ergebnisInWorten(a, e)).toContain('entscheidet die Person im Vorsitz');
		}
	});

	it('erst Wertquoten, dann Verwaltung: entscheidet die Verwaltung', () => {
		const { a } = zaehle('wertquote_verwalter');
		expect(a.stichentscheidOffen).toBe(true);
		expect(a.stichentscheidArt).toBe('verwalter');
	});

	it('nur Wertquoten: löst nichts auf, abgelehnt, und die Leitung hört es vorher', () => {
		const { e, a } = zaehle('wertquote');
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.angenommen).toBe(false);
		expect(a.hinweise.join(' ')).toContain('keine Person für den Stichentscheid hinterlegt');
		expect(stichentscheidGrenzeKartensatz(e, 'wertquote')).toContain('zählen nur die Wertquoten');
		expect(stichentscheidGrenzeKartensatz(e, 'verwalter')).toBeNull();
	});

	it('kein Stichentscheid hinterlegt: abgelehnt ohne Satz dazu', () => {
		const { a } = zaehle('keiner');
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidArt).toBeNull();
	});

	it('geheim: kein Kopfmehr in der Wertung und kein Gleichstand im Protokoll (Codeprüfung M2, N4)', () => {
		const { e, a } = zaehle('wertquote', { geheim: true });
		expect(ergebnisInWorten(a, e)).toBe('Geheim abgestimmt. Wertquoten: nicht erreicht.');
		expect((a.protokollhinweise ?? []).map((p) => p.satz).join(' ')).not.toContain('Gleichstand');
		const angenommen = zaehleAus(lage(e, ['yes', 'yes', 'no', 'no', 'no', 'yes'], [0, 1, 2, 3, 4, 5], 'keiner', { geheim: true }));
		expect(ergebnisInWorten(angenommen, e)).not.toContain('Kopfstimmen');
	});

	it('zweites Ergebnis nach Gesetz und Reglement ohne Köpfe: offen bei Gleichstand, ohne Kopfzeile (Codeprüfung M4)', () => {
		// Die Leitung zählt nach Köpfen; das Mehr aus Gesetz und Reglement ist die Regel ohne Köpfe.
		const ohne = angewandt();
		const nachKoepfen: Erfordernis = { ...vorschlag('k-verwaltung-gewoehnlich'), gesetzlich: gesetzesmassVon(ohne) };
		// Fünf erfundene Einheiten: A, B, C (500) dafür, D, E (500) dagegen; Köpfe 3 zu 2.
		const q = [300, 100, 100, 250, 250];
		const m: Snapshot = {
			...momentaufnahme('verwalter'),
			totalQuota: 1000,
			parties: q.map((quota, i) => ({
				partyId: `q${i + 1}`,
				displayName: `Partei ${i + 1}`,
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: `q${i + 1}-u1`, label: `Einheit ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota }]
			}))
		};
		const wahl: VoteChoice[] = ['yes', 'yes', 'yes', 'no', 'no'];
		const a = zaehleAus({
			momentaufnahme: m,
			erfordernis: nachKoepfen,
			anwesende: m.parties.map((p) => p.partyId),
			stimmen: wahl.map((w, i) => ({ partyId: `q${i + 1}`, unitId: `q${i + 1}-u1`, choice: w, castAt: '2026-11-20T19:10:00.000Z', recordedByChair: false }))
		});
		expect(a.angenommen).toBe(true);
		const r = a.nachGesetzUndReglement!;
		expect(r).toBeDefined();
		expect(r.feststellbar).toBe(false);
		expect(r.nichtFeststellbarWeil).toBe('stichentscheid');
		expect(r.koepfe).toBeNull();
	});

	it('mit Enthaltungen in der Basis ist es kein Gleichstand, auch bei gleichen Wertquoten', () => {
		// C und F (251) dafür, D und E (251) dagegen, A und B enthalten sich: Ja und Nein
		// gleich, aber nicht die halbe Bezugsgrösse (Featureprüfung, Prüfer B: die zweite
		// Hälfte der Doppelbedingung).
		const e = angewandt();
		const a = zaehleAus(lage(e, ['abstain', 'abstain', 'yes', 'no', 'no', 'yes'], [0, 1, 2, 3, 4, 5], 'verwalter'));
		expect(a.quoten.ja).toBe(251);
		expect(a.quoten.nein).toBe(251);
		expect(a.stichentscheidOffen).toBe(false);
		expect(a.stichentscheidArt).toBeNull();
		expect(a.angenommen).toBe(false);
	});
});

// ── Kriterium 3: alle beschlussfähigen Lagen, unabhängig nachgerechnet ────────

/**
 * Art. 712p Abs. 1 ZGB, eigene Rechnung: mindestens die Hälfte der Eigentümer,
 * die zugleich mindestens zur Hälfte anteilsberechtigt sind, anwesend oder
 * vertreten. Nichts aus dem Kern.
 */
function beschlussfaehigeMengen(): number[][] {
	const gesamt = QUOTEN.reduce((s, q) => s + q, 0);
	const mengen: number[][] = [];
	for (let maske = 1; maske < 1 << QUOTEN.length; maske++) {
		const m = QUOTEN.map((_, i) => i).filter((i) => maske & (1 << i));
		const quote = m.reduce((s, i) => s + QUOTEN[i], 0);
		if (m.length * 2 >= QUOTEN.length && quote * 2 >= gesamt) mengen.push(m);
	}
	return mengen;
}

function* verteilungen<T>(n: number, werte: T[]): Generator<T[]> {
	const zahl = werte.length ** n;
	for (let k = 0; k < zahl; k++) {
		const v: T[] = [];
		let r = k;
		for (let i = 0; i < n; i++) {
			v.push(werte[r % werte.length]);
			r = Math.floor(r / werte.length);
		}
		yield v;
	}
}

/** Die eigene Nachrechnung: «mehr als die Hälfte der vertretenen Wertquoten», Enthaltung in der Basis. */
function nachgerechnet(anwesend: number[], wahl: VoteChoice[], tieBreak: Stichentscheid): 'angenommen' | 'abgelehnt' | 'offen' {
	const basis = anwesend.reduce((s, i) => s + QUOTEN[i], 0);
	const ja = anwesend.filter((_, k) => wahl[k] === 'yes').reduce((s, i) => s + QUOTEN[i], 0);
	const nein = anwesend.filter((_, k) => wahl[k] === 'no').reduce((s, i) => s + QUOTEN[i], 0);
	if (ja * 2 > basis) return 'angenommen';
	const patt = ja > 0 && ja === nein && ja * 2 === basis;
	if (patt && (tieBreak === 'verwalter' || tieBreak === 'wertquote_verwalter' || tieBreak === 'vorsitz' || tieBreak === 'wertquote_vorsitz')) {
		return 'offen';
	}
	return 'abgelehnt';
}

function rechneAlle(werte: VoteChoice[], tieBreak: Stichentscheid) {
	const e = angewandt();
	let lagen = 0;
	let abweichend = 0;
	let gleichstaende = 0;
	let nurAnteile = 0;
	const fehler: string[] = [];
	for (const anwesend of beschlussfaehigeMengen()) {
		for (const wahl of verteilungen(anwesend.length, werte)) {
			lagen++;
			const voll: (VoteChoice | null)[] = QUOTEN.map(() => null);
			anwesend.forEach((i, k) => (voll[i] = wahl[k]));
			const a = zaehleAus(lage(e, voll, anwesend, tieBreak));
			const kern = a.stichentscheidOffen ? 'offen' : a.angenommen ? 'angenommen' : 'abgelehnt';
			const soll = nachgerechnet(anwesend, wahl, tieBreak);
			if (soll === 'offen') gleichstaende++;
			const kopfJa = wahl.filter((w) => w === 'yes').length;
			if (soll === 'angenommen' && kopfJa * 2 <= anwesend.length) nurAnteile++;
			if (kern !== soll) {
				abweichend++;
				if (fehler.length < 5) fehler.push(`${anwesend.join(',')} / ${wahl.join(',')}: Kern ${kern}, nachgerechnet ${soll}`);
			}
		}
	}
	return { lagen, abweichend, gleichstaende, nurAnteile, fehler };
}

describe('Kriterium 3: alle beschlussfähigen Lagen gegen eine eigene Nachrechnung', () => {
	it('Ja oder Nein, Stichentscheid der Verwaltung', () => {
		const r = rechneAlle(['yes', 'no'], 'verwalter');
		// Festgehalten am 16.11.2026: 576 Lagen, davon 69 nur mit der Mehrheit der Anteile
		// angenommen (Köpfe höchstens die Hälfte), 2 Gleichstände nach Anteilen.
		expect({ lagen: r.lagen, gleichstaende: r.gleichstaende, nurAnteile: r.nurAnteile }).toEqual({
			lagen: 576,
			gleichstaende: 2,
			nurAnteile: 69
		});
		expect(r.lagen).toBeGreaterThan(300);
		expect(r.gleichstaende).toBeGreaterThan(0);
		expect(r.nurAnteile).toBeGreaterThan(0);
		expect(r.fehler).toEqual([]);
		expect(r.abweichend).toBe(0);
	});

	it('Ja oder Nein, ohne Stichentscheid', () => {
		const r = rechneAlle(['yes', 'no'], 'keiner');
		expect(r.fehler).toEqual([]);
	});

	it('mit Enthaltungen, Stichentscheid der Verwaltung', () => {
		const r = rechneAlle(['yes', 'no', 'abstain'], 'verwalter');
		expect(r.lagen).toBeGreaterThan(3000);
		expect(r.fehler).toEqual([]);
	});
});

// ── Auszählmappe: ohne Köpfe rechnet die Zeile «Ergebnis» nach Wertquoten ────

describe('Auszählmappe ohne Köpfe', () => {
	function blatt(stichentscheid: Stichentscheid) {
		const e = angewandt();
		const r = mappenrechnungAus(e, { headCountMode: 'per_owner' });
		expect(r).not.toBeNull();
		return baueAuszaehlmappe({
			gemeinschaftName: 'Erfunden',
			datum: '20. November 2026',
			uhrzeit: '19:00',
			ort: 'Saal',
			gesamtquote: 1000,
			jeEinheit: false,
			parteien: QUOTEN.map((q, i) => ({ name: `Partei ${String.fromCharCode(65 + i)}`, kopfstimmen: 1, wertquote: q })),
			posten: [{ ...r!, nummer: '1', titel: 'Erfundenes Geschäft' }],
			stichentscheid
		});
	}

	function zeile(b: { zeilen: Zelle[][] }, beschriftung: string): Zelle {
		const z = b.zeilen.find((x) => x[0]?.art === 'text' && (x[0] as { wert: string }).wert === beschriftung);
		if (!z) throw new Error(`Zeile «${beschriftung}» fehlt`);
		return z.find((c, i) => i > 0 && (c.art === 'formel' || (c.art === 'text' && (c as { wert: string }).wert !== '')))!;
	}

	it('zeigt das Kopfmehr als entfallen und nimmt nach dem Quotenmehr allein an', () => {
		const b = blatt('verwalter');
		expect(zeile(b, 'Nötig (Kopfstimmen)')).toMatchObject({ art: 'text', wert: 'entfällt' });
		expect(zeile(b, 'Kopfmehr erreicht')).toMatchObject({ art: 'text', wert: 'entfällt, gezählt wird nur nach Wertquoten' });
		const ergebnis = zeile(b, 'Ergebnis') as { formel: string };
		expect(ergebnis.formel).toMatch(/^IF\(\w+\d+="ja","ANGENOMMEN",/);
		expect(ergebnis.formel).toContain('GLEICHSTAND: Verwalter entscheidet');
	});

	it('der Stichentscheid nach Wertquoten allein lässt es abgelehnt', () => {
		const ergebnis = zeile(blatt('wertquote'), 'Ergebnis') as { formel: string };
		expect(ergebnis.formel).toMatch(/,"abgelehnt"\)$/);
		expect(ergebnis.formel).not.toContain('GLEICHSTAND');
		expect(ergebnis.formel).not.toContain('Stichentscheid');
	});
});
