/**
 * Das zweite Ergebnis nach der anderen Lesart, der Satz auf der Karte und die
 * Zeile im Protokoll (Konzept Lesarten, Kriterien 4, 5, 6 und 10).
 *
 * Gemessen an L4 mit der echten Fassung 2026-10-24: einfaches Mehr der
 * Anwesenden nach der Wahl des Knotens, qualifiziertes Mehr nach der anderen.
 * Bis Block B (Entscheid 0048, Fassung 2026-11-13) war «einfach» die Vorgabe;
 * seither ist es «qualifiziert», und die Wahl des Knotens steht hier als
 * `EINFACH_L4`, nicht als `LESARTEN_VORGABE`.
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartInWorten,
	mitKeinemBeschluss,
	lesartKartensatz,
	lesartProtokollsatz,
	zaehleAus,
	zaehleSummenAus
} from '$lib/domain/auszaehlung';
import { erfordernisAus, erfordernisAusKnoten, laufe } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, lesartVon, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk('2026-10-24');

/** Die Wahl, die der Knoten der Fassung 2026-10-24 rechnet; seit Block B nicht mehr die Vorgabe. */
const EINFACH_L4: Lesartenwahl = { ...LESARTEN_VORGABE, L4: 'einfach' };
const L4 = lesartVon('L4')!;

function wahl(lesarten: Lesartenwahl = EINFACH_L4) {
	return wendeLesartAn(
		erfordernisAus(RW, laufe(RW, 'a-organe', ['f2-1-waehlen', 'f2-1-kompetenzen-ja'])),
		lesarten
	);
}

/** Drei Eigentümer: zwei kleine Wohnungen, eine grosse. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-20T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [
		['p1', 'Erika Beispiel', 200],
		['p2', 'Hans Probe', 200],
		['p3', 'Grosse Wohnung AG', 600]
	].map(([id, name, quote]) => ({
		partyId: id as string,
		displayName: name as string,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${id}-u`, label: `Whg ${id}`, kind: 'unit' as const, countsAsHead: true, quota: quote as number }]
	}))
};

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-20T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Zwei kleine Ja, die grosse Nein: Köpfe erreicht, Wertquoten nicht. */
const ABWEICHEND = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']);
/** Alle Ja: nach beiden Lesarten angenommen. */
const GLEICH = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes']);

function lage(e = wahl(), votes = ABWEICHEND, geheim = false) {
	return { momentaufnahme: M, erfordernis: e, stimmen: votes, anwesende: ['p1', 'p2', 'p3'], geheim };
}

describe('Das Ergebnis nach der anderen Lesart (Kriterien 5 und 10)', () => {
	it('rechnet nach der Vorgabe das einfache Mehr und nennt das abweichende qualifizierte mit Zahlen', () => {
		const a = zaehleAus(lage());
		expect(a.angenommen).toBe(true);
		expect(a.andereLesart).toMatchObject({
			kennung: 'L4',
			wahl: 'Qualifiziertes Mehr',
			feststellbar: true,
			angenommen: false,
			abweichend: true,
			koepfe: { ja: 2, basis: 3 },
			quoten: { ja: 400, basis: 1000, erreicht: false }
		});
		const satz = andereLesartInWorten(a.andereLesart!, false).leitung;
		// A5, Punkt 1a: nicht «die Lesart dieser Versammlung», eingestellt hat
		// die Verwaltung im Werkzeug.
		expect(satz).toMatch(
			/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Einfaches Mehr»\), ist der Antrag angenommen\./
		);
		expect(satz).toMatch(/wäre er abgelehnt: 2 Ja von 3 Kopfstimmen, nötig 2; 400 Ja von 1000 Wertquoten, nötig 501/);
		expect(satz).toMatch(/Wer nicht zugestimmt hat, kann den Beschluss beim Gericht anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls \(ZGB Art\. 712m Abs\. 2 i\.V\.m\. Art\. 75\)/);
		expect(satz).toMatch(
			/Er gilt ab heute; ohne Anfechtung ist er nach Ablauf dieser Fristen nicht mehr angreifbar\.$/
		);
		// Nicht in den Hinweisen: Die gehen auch ins Auswertungs-PDF für alle Eigentümer (M1).
		expect(a.hinweise.some((h) => /anderen Lesart|angefochten/.test(h))).toBe(false);
	});

	it('hält das abweichende Ergebnis im Protokoll am Ausgang fest (Kriterium 6)', () => {
		const a = zaehleAus(lage());
		const ausgang = (a.protokollhinweise ?? []).filter((h) => h.ort === 'ausgang');
		expect(ausgang.map((h) => h.satz)).toContainEqual(
			expect.stringMatching(/^Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 2 Ja/)
		);
	});

	it('sagt «dasselbe Ergebnis», wenn beide Lesarten gleich ausgehen, ohne Protokollhinweis', () => {
		const a = zaehleAus(lage(wahl(), GLEICH));
		expect(a.andereLesart?.abweichend).toBe(false);
		expect(andereLesartInWorten(a.andereLesart!, false).leitung).toBe(
			'Nach der anderen Lesart («Qualifiziertes Mehr») dasselbe Ergebnis.'
		);
		// Auch dann eine Zeile im Protokoll: Schweigen läse sich wie «nicht geprüft» (Laien M4, Fach 11).
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(
			'Nach der anderen Lesart («Qualifiziertes Mehr») wäre das Ergebnis dasselbe gewesen.'
		);
	});

	it('nennt bei geheimer Abstimmung nur erreicht oder nicht', () => {
		const a = zaehleAus(lage(wahl(), ABWEICHEND, true));
		const satz = andereLesartInWorten(a.andereLesart!, true).leitung;
		expect(satz).toMatch(/wäre er abgelehnt\. Wer nicht zugestimmt hat/);
		expect(satz).not.toMatch(/\d+ Ja/);
		const ausgang = (a.protokollhinweise ?? []).find((h) => /anderen Lesart/.test(h.satz))!;
		expect(ausgang.satz).not.toMatch(/\d+ Ja/);
	});

	it('rechnet umgekehrt, wenn die Gemeinschaft das qualifizierte Mehr gewählt hat', () => {
		const a = zaehleAus(lage(wahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })));
		expect(a.angenommen).toBe(false);
		expect(a.andereLesart).toMatchObject({ wahl: 'Einfaches Mehr', angenommen: true, abweichend: true });
		// Angefochten wird dann die Ablehnung; angenommen ist der Antrag damit nicht (N5).
		const satz = andereLesartInWorten(a.andereLesart!, false).leitung;
		expect(satz).toMatch(
			/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Qualifiziertes Mehr»\), ist der Antrag abgelehnt\./
		);
		expect(satz).toMatch(/Wer nicht Nein gestimmt hat, kann auch die Ablehnung beim Gericht anfechten, innert eines Monats/);
		expect(satz).toMatch(/Das Gericht hebt sie dann in der Regel nur auf; angenommen ist der Antrag damit nicht\./);
		// Bei L4 der eigene Weg nach einer gescheiterten Wahl, ohne vorherige Anfechtung (Fachprüfung R2, D).
		expect(satz).toMatch(/Hat die Gemeinschaft danach keine Bewirtschaftung mehr, kann jeder Eigentümer ohne vorherige Anfechtung das Gericht um die Ernennung ersuchen \(ZGB Art\. 712q Abs\. 1\)/);
	});

	it('lässt bei «kein Beschluss» das zweite Ergebnis und seinen Protokollsatz weg (M2)', () => {
		const a = mitKeinemBeschluss(zaehleAus(lage()), { grund: 'konsultativ' } as Parameters<typeof mitKeinemBeschluss>[1]);
		expect(a.andereLesart).toBeNull();
		expect((a.protokollhinweise ?? []).some((h) => /anderen Lesart/.test(h.satz))).toBe(false);
	});

	it('lässt auch bei gleichem Ergebnis und «kein Beschluss» den Protokollsatz weg', () => {
		const a = mitKeinemBeschluss(zaehleAus(lage(wahl(), GLEICH)), { grund: 'konsultativ' } as Parameters<typeof mitKeinemBeschluss>[1]);
		expect(a.andereLesart).toBeNull();
		expect((a.protokollhinweise ?? []).some((h) => /anderen Lesart/.test(h.satz))).toBe(false);
	});

	it('vergleicht nicht, solange der eigene Stichentscheid offen ist (M3)', () => {
		// Gleichstand bei zwei Anwesenden, der Verwalter entscheidet nach Reglement,
		// und sein Entscheid fehlt noch.
		const offen = zaehleAus({
			...lage(wahl(), stimmen(['p1', 'yes'], ['p2', 'no'])),
			momentaufnahme: { ...M, tieBreak: 'verwalter' },
			anwesende: ['p1', 'p2']
		});
		expect(offen.stichentscheidOffen).toBe(true);
		expect(offen.andereLesart).toBeUndefined();
	});

	/*
	 * **Wächter** (Fachprüfung Runde 5): Der Satz «hinge am Stichentscheid»
	 * stimmt nur, wenn ausser dem Stichentscheid nichts fehlt. Bis zum
	 * 30.10.2026 trat der Fall bei L4 nie ein, weil der eigene Stichentscheid
	 * dann ebenfalls offen war. Seit der Stichentscheid nur noch beim einfachen
	 * Mehr greift (A1 Frage 1), tritt er ein, wenn die Gemeinschaft
	 * «qualifiziert» gewählt hat: Dort gibt es keinen, nach der anderen Lesart
	 * schon. Geprüft am Satz und an `offen` in `zweitesErgebnis`: Dann ist es
	 * immer ein Kopfgleichstand am eigenen qualifizierten Mehr, und das einfache
	 * Mehr verlangt nichts weiter.
	 */
	it('lässt bei L4 nach der anderen Lesart den Stichentscheid nur nach «qualifiziert» allein offen', () => {
		const W: Record<string, number> = { p1: 100, p2: 100, p3: 200, p4: 600 };
		const vier: Snapshot = {
			...M,
			parties: Object.entries(W).map(([id, quote]) => ({
				...M.parties[0],
				partyId: id,
				displayName: id,
				units: [{ unitId: `${id}-u`, label: id, kind: 'unit' as const, countsAsHead: true, quota: quote }]
			}))
		};
		const arten: Snapshot['tieBreak'][] = ['wertquote', 'verwalter', 'vorsitz', 'wertquote_verwalter', 'wertquote_vorsitz'];
		const C: VoteChoice[] = ['yes', 'no', 'abstain'];
		const ids = Object.keys(W);
		let gezaehlt = 0;
		let gleichstaende = 0;
		let alleinOffen = 0;
		for (const e of [wahl(), wahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })])
			for (const tieBreak of arten)
				for (let da = 1; da < 16; da++)
					for (let muster = 0; muster < 81; muster++) {
						const anwesende = ids.filter((_, i) => da & (1 << i));
						const votes = stimmen(...anwesende.map((p): [string, VoteChoice] => [p, C[Math.floor(muster / 3 ** ids.indexOf(p)) % 3]]));
						const a = zaehleAus({ momentaufnahme: { ...vier, tieBreak }, erfordernis: e, stimmen: votes, anwesende, geheim: false });
						gezaehlt++;
						if (a.stichentscheidOffen) gleichstaende++;
						if (a.andereLesart?.nichtFeststellbarWeil !== 'stichentscheid') continue;
						alleinOffen++;
						const fall = JSON.stringify({ tieBreak, anwesende, muster });
						expect(e.typ, fall).toBe('qualifiziertes_mehr');
						expect(a.koepfe.ja, fall).toBe(a.koepfe.nein);
						expect(a.koepfe.ja * 2, fall).toBe(a.koepfe.basis);
						expect(a.angenommen, fall).toBe(false);
					}
		// Gegenprobe: Die Schleife trifft offene Stichentscheide, sie misst nicht ins Leere.
		expect(gezaehlt).toBe(2 * 5 * 15 * 81);
		expect(gleichstaende).toBeGreaterThan(0);
		expect(alleinOffen).toBeGreaterThan(0);
	});

	it('trägt ohne Lesart kein zweites Ergebnis und keinen Satz', () => {
		const ohne = { ...wahl(), gemeinschaftslesart: undefined };
		const a = zaehleAus(lage(ohne));
		expect(a.andereLesart).toBeUndefined();
		expect(a.hinweise.some((h) => /Lesart/.test(h))).toBe(false);
	});

	it('sagt bei einer Handzählung, wenn sich das andere Mehr aus den Summen nicht bestimmen lässt', () => {
		const a = zaehleSummenAus(
			{ momentaufnahme: M, erfordernis: wahl(), anwesende: ['p1', 'p2', 'p3'] },
			{ ja: 2, nein: 1, enthaltung: 0 }
		);
		expect(a.angenommen).toBe(true);
		expect(a.andereLesart).toMatchObject({
			feststellbar: false,
			nichtFeststellbarWeil: 'summen',
			angenommen: null,
			abweichend: false
		});
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toMatch(/lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, nicht wer wie gestimmt hat, und deshalb fehlen die Wertquoten/);
		expect(s.protokoll).toMatch(/^Nach der anderen Lesart \(«Qualifiziertes Mehr»\) lässt sich das Ergebnis nicht bestimmen/);
	});

	it('schreibt den Protokollsatz aus dem festgehaltenen Ergebnis gleich wie bei der Zählung', () => {
		const a = zaehleAus(lage());
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(s.protokoll);
	});
});

describe('Die Karte vor der Abstimmung (Kriterium 4)', () => {
	it('nennt die angewandte Lesart und was die andere verlangt', () => {
		const satz = lesartKartensatz(wahl())!;
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software (hier L4). Seit
		// Block B ist «einfach» nicht mehr die Vorgabe; der Satz nennt sie als die
		// andere und hängt die Folge der milden Wahl an (Entscheid 0048).
		expect(satz.startsWith(
			'Dieses Traktandum rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist ' +
				`(die Standardeinstellung wäre die andere: ${L4.vorgabeGrund.replace(/\.$/, '')}): `
		)).toBe(true);
		expect(satz).toContain(L4.folgeMilderWahl!);
		expect(satz).toMatch(/Die andere Lesart \(«Qualifiziertes Mehr»\) verlangt .*Wertquoten/);
		// Die andere braucht Wertquoten, die eine Summenzählung nicht erhebt (M4).
		expect(satz).toMatch(/Erfassen Sie dafür die Stimme jedes Eigentümers; aus Summen von Hand fehlen die Wertquoten\./);
		// A5, Punkt 6: Das zweite Ergebnis nach der anderen Lesart rechnet über alle
		// Wertquoten, und dort wirkt die eingestellte Wahl zu L1 mit.
		expect(satz).toContain(
			'Das Ergebnis nach der anderen Lesart rechnet über alle Wertquoten. Tritt jemand in den Ausstand, ' +
				'bleibt in diesem Ergebnis seine Wertquote nach der Einstellung Ihrer Gemeinschaft in der Zahl und wirkt wie ein Nein. Am Ergebnis, das Sie verkünden, ändert das nichts.'
		);
		// L4 «qualifiziert» rechnet über alle Wertquoten: L1 steht dabei, mit einem
		// gemeinsamen Schlusssatz (Codeprüfung der Review-Behebung, N1).
		const beide = lesartKartensatz(wahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' }))!;
		expect(beide).toMatch(/^Zum Mehr: Dieses Traktandum/);
		expect(beide).toContain('Zur Wertquote im Ausstand: Tritt jemand');
		expect(beide).toMatch(/zusätzlich das Ergebnis nach «Einfaches Mehr» und, wenn jemand im Ausstand ist, nach «Wertquote fällt heraus»\.$/);
		expect(beide.match(/Nach der Auszählung/g)).toHaveLength(1);
		expect(beide).toContain('Tritt jemand in den Ausstand');
	});

	it('nennt die Standardeinstellung und ihren Grund, auch an einem Knoten, der die Nicht-Vorgabe rechnet', () => {
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software (hier L4). Seit
		// Block B ist «qualifiziert» die Vorgabe, ohne die Folge der milden Wahl.
		const satz = lesartKartensatz(wahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' }))!;
		expect(satz).toContain(
			`rechnet nach der Lesart «Qualifiziertes Mehr» (Standardeinstellung: ${L4.vorgabeGrund.replace(/\.$/, '')})`
		);
		expect(satz).not.toContain(L4.folgeMilderWahl!);
	});

	it('schweigt ohne Lesart', () => {
		expect(lesartKartensatz({ ...wahl(), gemeinschaftslesart: undefined })).toBeNull();
		expect(lesartKartensatz(null)).toBeNull();
	});
});

describe('Die Zeile im Protokoll (Kriterium 6)', () => {
	it('nennt die Lesart je Beschluss, mit Vorgabe und der anderen', () => {
		// Seit Block B (Entscheid 0048) ist «qualifiziert» die Vorgabe.
		expect(lesartProtokollsatz(wahl())).toBe(
			'Gezählt nach dem einfachen Mehr. Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. ' +
				`Die Standardeinstellung wäre das qualifizierte Mehr: ${L4.vorgabeGrund}`
		);
		expect(lesartProtokollsatz(wahl({ L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' }))).toBe(
			'Gezählt nach dem qualifizierten Mehr. Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten. ' +
				`Das qualifizierte Mehr ist die Standardeinstellung: ${L4.vorgabeGrund}`
		);
		expect(lesartProtokollsatz({ ...wahl(), gemeinschaftslesart: undefined })).toBeNull();
	});
});

/*
 * **L6 an der eigenen Schranke** (Fassung 2026-11-05, F4c Block 1): Sechs
 * Eigentümer zu 200, 180, 170, 160, 150 und 140 von 1000; der Eigentümer zu
 * 140 ist abwesend, weder da noch vertreten. Drei Fälle: alle Anwesenden
 * stimmen zu; das qualifizierte Mehr ist erreicht, die Zustimmung aller
 * nicht; das qualifizierte Mehr ist nicht erreicht. Je Wahl hält die Probe
 * das zweite Ergebnis und die Sätze von Leitung und Protokoll.
 */
describe('L6 im Saal: Klausel oder Gesetz, mit zweitem Ergebnis', () => {
	const RW = holeRegelwerk('2026-11-05');
	const GESETZ: Lesartenwahl = { ...LESARTEN_VORGABE, L6: 'gesetz' };

	const M: Snapshot = {
		meetingId: 'v-1',
		takenAt: '2026-11-05T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			['p1', 'Erika Beispiel', 200],
			['p2', 'Hans Probe', 180],
			['p3', 'Grosse Wohnung AG', 170],
			['p4', 'Ida Muster', 160],
			['p5', 'Kurt Beispiel', 150],
			['p6', 'Lisa Probe', 140]
		].map(([id, name, quote]) => ({
			partyId: id as string,
			displayName: name as string,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `${id}-u`, label: `Whg ${id}`, kind: 'unit' as const, countsAsHead: true, quota: quote as number }]
		}))
	};
	const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5'];

	function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
		return wahlen.map(([p, choice]) => ({
			partyId: p,
			unitId: `${p}-u`,
			choice,
			castAt: '2026-11-05T19:10:00.000Z',
			recordedByChair: false
		}));
	}

	function erfordernis(wahl: Lesartenwahl) {
		const k = RW.knoten.find((x) => x.id === 'k-reglement-eigene-schranke')!;
		return wendeLesartAn(erfordernisAusKnoten(RW, k), wahl);
	}

	function zaehle(wahl: Lesartenwahl, stimmenAb: Vote[]) {
		return zaehleAus({ momentaufnahme: M, erfordernis: erfordernis(wahl), stimmen: stimmenAb, anwesende: ANWESENDE, geheim: false });
	}

	/** Alle Anwesenden stimmen zu; der Sechste ist abwesend und zählt nach der Klausel wie ein Nein. */
	const ALLE = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']);
	/** Vier Ja, ein Nein, einer abwesend: Köpfe und Wertquoten des Gesetzes erreicht, die Zustimmung aller nicht. */
	const MIT_GEGENSTIMME = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'no']);
	/** Zwei Ja: Das qualifizierte Mehr ist nicht erreicht. */
	const ZU_WENIG = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no'], ['p4', 'no'], ['p5', 'no']);

	it('rechnet nach der Vorgabe die Zustimmung aller; das zweite Ergebnis nennt das qualifizierte Mehr', () => {
		for (const [fall, stimmenAb] of [
			['Alle Anwesenden stimmen zu', ALLE],
			['Das qualifizierte Mehr erreicht, die Zustimmung aller nicht', MIT_GEGENSTIMME]
		] as const) {
			const a = zaehle(LESARTEN_VORGABE, stimmenAb);
			expect(a.angenommen, fall).toBe(false);
			expect(a.andereLesart, fall).toMatchObject({
				kennung: 'L6',
				eigeneWahl: 'Klausel anwenden',
				wahl: 'Nach dem Gesetz',
				feststellbar: true,
				angenommen: true,
				abweichend: true
			});
			const s = andereLesartInWorten(a.andereLesart!, false);
			expect(s.leitung, fall).toMatch(
				/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Klausel anwenden»\), ist der Antrag abgelehnt\. Nach der anderen Lesart \(«Nach dem Gesetz»: mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten\) wäre er angenommen/
			);
			// Der Rat nach einer Ablehnung ersetzt unter L6 den allgemeinen (F1): Frist einmal, Wirkung offen.
			expect(s.leitung, fall).toContain(
				'Wer nicht Nein gestimmt hat und die Klausel für ungültig hält, kann die Ablehnung beim Gericht anfechten'
			);
			expect(s.leitung, fall).toContain('ist nicht sicher; dass sie gelten soll, muss die Klage ausdrücklich verlangen');
			expect(s.leitung, fall).not.toContain('Das Gericht hebt sie dann in der Regel nur auf');
			expect(s.leitung, fall).not.toContain('an einer nächsten Versammlung wieder traktandieren');
			expect(s.leitung!.split('innert eines Monats').length, fall).toBe(2);
			expect(s.protokoll, fall).toMatch(/^Nach der anderen Lesart \(«Nach dem Gesetz»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen/);
		}
		// Die Zeile im Protokoll nennt die Klausel und den Streit.
		expect(lesartProtokollsatz(erfordernis(LESARTEN_VORGABE))).toBe(
			'Gezählt nach der Zustimmung aller nach Ihrem Reglement. Ob eine Klausel gilt, nach der das Reglement nur mit der ' +
				'Zustimmung aller geändert werden kann, ist umstritten. Die Zustimmung aller nach Ihrem Reglement ist die ' +
				'Standardeinstellung: Ob die Klausel gilt, hat das Bundesgericht offengelassen; eine Änderung, der alle ' +
				'Eigentümer zustimmen, besteht nach beiden Lesarten.'
		);
	});

	it('rechnet umgekehrt nach «gesetz» und nennt die Ablehnung nach der Klausel dazu', () => {
		for (const stimmenAb of [ALLE, MIT_GEGENSTIMME]) {
			const a = zaehle(GESETZ, stimmenAb);
			expect(a.angenommen).toBe(true);
			expect(a.andereLesart).toMatchObject({
				kennung: 'L6',
				eigeneWahl: 'Nach dem Gesetz',
				wahl: 'Klausel anwenden',
				feststellbar: true,
				angenommen: false,
				abweichend: true
			});
			const s = andereLesartInWorten(a.andereLesart!, false);
			expect(s.leitung).toMatch(
				/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Nach dem Gesetz»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Klausel anwenden»: alle Stimmen aller Eigentümer — unabhängig davon, wer erscheint\) wäre er abgelehnt/
			);
			// Der Rat nach einer Annahme: die Anfechtung, falls die Klausel gilt.
			// Nach dem allgemeinen Rat der Rat der Lesart: zustellen, Fristen abwarten.
			expect(s.leitung).toContain('Folgt das Gericht der anderen Lesart, hebt es ihn auf.');
			expect(s.leitung).toContain(
				'Stellen Sie das Protokoll den Abwesenden rasch und nachweisbar zu und setzen Sie die Änderung erst um'
			);
			expect(s.protokoll).toMatch(/^Nach der anderen Lesart \(«Klausel anwenden»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
		}
		expect(lesartProtokollsatz(erfordernis(GESETZ))).toBe(
			'Gezählt nach dem qualifizierten Mehr nach dem Gesetz. Ob eine Klausel gilt, nach der das Reglement nur mit der ' +
				'Zustimmung aller geändert werden kann, ist umstritten. So hat Votum für diese ' +
				'Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. Die Standardeinstellung wäre die Zustimmung aller nach ' +
				'Ihrem Reglement: Ob die Klausel gilt, hat das Bundesgericht offengelassen; eine Änderung, der alle Eigentümer ' +
				'zustimmen, besteht nach beiden Lesarten.'
		);
	});

	it('nimmt nach der Klausel an, wenn alle sechs zustimmen, und nennt nach dem Gesetz dasselbe Ergebnis', () => {
		// Der Sechste ist vertreten: Nur so kann die Klausel eine Annahme ergeben.
		const alleSechs = [...ALLE, ...stimmen(['p6', 'yes'])];
		for (const [titel, wahl, andere] of [
			['Klausel', LESARTEN_VORGABE, 'Nach dem Gesetz'],
			['Gesetz', GESETZ, 'Klausel anwenden']
		] as const) {
			const a = zaehleAus({ momentaufnahme: M, erfordernis: erfordernis(wahl), stimmen: alleSechs, anwesende: [...ANWESENDE, 'p6'], geheim: false });
			expect(a.angenommen, titel).toBe(true);
			expect(a.andereLesart, titel).toMatchObject({ abweichend: false, angenommen: true, feststellbar: true });
			expect(andereLesartInWorten(a.andereLesart!, false).leitung, titel).toBe(`Nach der anderen Lesart («${andere}») dasselbe Ergebnis.`);
		}
		// Gegenprobe: Ohne den Sechsten scheitert die Klausel trotz fünf Ja.
		expect(zaehle(LESARTEN_VORGABE, ALLE).angenommen).toBe(false);
	});

	it('sagt bei einem unerreichten qualifizierten Mehr in beide Richtungen dasselbe Ergebnis', () => {
		for (const [titel, wahl, andere] of [
			['Klausel', LESARTEN_VORGABE, 'Nach dem Gesetz'],
			['Gesetz', GESETZ, 'Klausel anwenden']
		] as const) {
			const a = zaehle(wahl, ZU_WENIG);
			expect(a.angenommen, titel).toBe(false);
			expect(a.andereLesart, titel).toMatchObject({ abweichend: false, angenommen: false, feststellbar: true });
			expect(andereLesartInWorten(a.andereLesart!, false).leitung, titel).toBe(
				`Nach der anderen Lesart («${andere}») dasselbe Ergebnis.`
			);
			expect((a.protokollhinweise ?? []).map((h) => h.satz), titel).toContain(
				`Nach der anderen Lesart («${andere}») wäre das Ergebnis dasselbe gewesen.`
			);
		}
	});

	it('nennt auf der Karte die Klausel und was das Gesetz verlangt, je Wahl', () => {
		for (const [titel, wahl] of [
			['Klausel', LESARTEN_VORGABE],
			['Gesetz', GESETZ]
		] as const) {
			const satz = lesartKartensatz(erfordernis(wahl))!;
			// Unter «gesetz» rechnet das Mehr über alle Wertquoten, deshalb
			// steht der Satz der Lesart gemeinsam mit dem Satz zu L1 im Ausstand
			// und trägt dessen Vorspann «Zum Mehr: ».
			expect(satz, titel).toMatch(/^(Zum Mehr: )?Dieses Traktandum rechnet nach der Lesart/);
		}
		const klausel = lesartKartensatz(erfordernis(LESARTEN_VORGABE))!;
		expect(klausel).toMatch(
			/^Dieses Traktandum rechnet nach der Lesart «Klausel anwenden» \(Standardeinstellung: Ob die Klausel gilt, hat das Bundesgericht offengelassen; eine Änderung, der alle Eigentümer zustimmen, besteht nach beiden Lesarten\): alle Stimmen aller Eigentümer — unabhängig davon, wer erscheint\. Die andere Lesart \(«Nach dem Gesetz»\) verlangt mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten\. Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Lesart\./
		);
		// Die andere braucht die Wertquoten, die eine Summenzählung nicht erhebt.
		expect(klausel).toContain('Erfassen Sie dafür die Stimme jedes Eigentümers; aus Summen von Hand fehlen die Wertquoten.');
		const gesetz = lesartKartensatz(erfordernis(GESETZ))!;
		expect(gesetz).toMatch(
			/rechnet nach der Lesart «Nach dem Gesetz», die für Ihre Gemeinschaft eingestellt ist \(die Standardeinstellung wäre die andere: Ob die Klausel gilt, hat das Bundesgericht offengelassen; eine Änderung, der alle Eigentümer zustimmen, besteht nach beiden Lesarten\): mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten\. Die andere Lesart \(«Klausel anwenden»\) verlangt alle Stimmen aller Eigentümer — unabhängig davon, wer erscheint\./
		);
		// Das Mehr über alle Wertquoten stellt den gemeinsamen Satz mit L1:
		// ein Schlusssatz, der sagt, welche andere Lesart wann ein zweites
		// Ergebnis gibt.
		expect(gesetz).toContain(
			'Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «Klausel anwenden» und, wenn jemand im Ausstand ist, nach «Wertquote fällt heraus».'
		);
	});
});
