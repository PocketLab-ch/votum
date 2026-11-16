/*
 * **B2b: das Rückkommen auf eine Reglementsänderung unter L6** (Laien- und
 * Fachprüfung F4c B2b, drei Runden, 06.11.2026; `quellen` Frage 88). Je
 * Bedingung ein Fall und sein Gegenstück: Die Sätze hängen daran, nach welcher
 * Wahl der Beschluss gerechnet war, ob er die Ja-Stimmen aller hatte, wie das
 * Rückkommen ausging und ob alle dem zweiten Durchgang zugestimmt haben.
 * Sechs Eigentümer wie in der Prüfdatei, der Sechste fehlt, wo nicht anders
 * gesagt.
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartInWorten,
	erreichbarkeitshinweis,
	ergebnisInWorten,
	herleitung,
	lesartKartensatz,
	lesartProtokollsatz,
	zaehleAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { erfordernisAusKnoten, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, wendeLesartAn } from '$lib/domain/lesarten';
import { erfordernisFuerRueckkommen } from '$lib/domain/rueckkommen';
import { EIGENE_SCHRANKE_ID } from '$lib/rules/quorum-2026-11-05';
import { holeRegelwerk } from '$lib/rules';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const RW = holeRegelwerk('2026-11-05');
const KNOTEN = RW.knoten.find((k) => k.id === EIGENE_SCHRANKE_ID)!;
const KLAUSEL = wendeLesartAn(erfordernisAusKnoten(RW, KNOTEN), LESARTEN_VORGABE);
const GESETZ = wendeLesartAn(erfordernisAusKnoten(RW, KNOTEN), { ...LESARTEN_VORGABE, L6: 'gesetz' });

const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-05T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [200, 180, 170, 160, 150, 140].map((quota, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Eigentümer ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};
const FUENF = ['p1', 'p2', 'p3', 'p4', 'p5'];
const SECHS = [...FUENF, 'p6'];

function stimmen(wahl: Partial<Record<string, VoteChoice>>): Vote[] {
	return Object.entries(wahl).map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice: choice!,
		castAt: '2026-11-05T19:10:00.000Z',
		recordedByChair: false
	}));
}
const alleJa = (wer: string[]) => stimmen(Object.fromEntries(wer.map((p) => [p, 'yes' as const])));
const VIER_ZU_EINS = stimmen({ p1: 'yes', p2: 'yes', p3: 'yes', p4: 'yes', p5: 'no' });
const ZWEI_ZU_DREI = stimmen({ p1: 'yes', p2: 'yes', p3: 'no', p4: 'no', p5: 'no' });

function zaehle(e: Erfordernis, s: Vote[], anwesende: string[], rk: Partial<Auszaehlungslage> = {}) {
	return zaehleAus({ momentaufnahme: M, erfordernis: e, stimmen: s, anwesende, geheim: false, ...rk });
}
const leer = (basis: number, schwelle: number, ohneAbgabe: number) => ({
	koepfe: { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe, nichtAnwesend: basis - ohneAbgabe, basis, schwelle, erreicht: false },
	quoten: { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: true }
});
const NACH_RK = (mitAllen: boolean): Partial<Auszaehlungslage> => ({
	nachRueckkommen: { traktandum: '1.1', geltenderDurchgang: 1, beschlussMitAllen: true, rueckkommenMitAllen: mitAllen }
});

describe('B2b, Karte des Rückkommens: der Satz zur Lesart', () => {
	it('unter der Klausel mit dem Grund, wenn der Beschluss alle hatte', () => {
		const satz = lesartKartensatz(erfordernisFuerRueckkommen(KLAUSEL, true, null, true))!;
		expect(satz).toMatch(/^Zum Mehr: Das Rückkommen braucht dasselbe Mehr wie der Beschluss und rechnet wie dieser nach der Lesart «Klausel anwenden»/);
		expect(satz).toContain('Beides besteht nach beiden Lesarten.');
		// Gegenstück: Ohne Ausgang bleibt es beim ersten Satz und dem Streit.
		const ohne = lesartKartensatz(erfordernisFuerRueckkommen(KLAUSEL, true))!;
		expect(ohne).toContain('Ob die Klausel gilt, ist umstritten (Seite «Lesarten»).');
		expect(ohne).not.toContain('Beides besteht');
	});

	it('unter dem Gesetz je nach Ausgang des Beschlusses', () => {
		const a = lesartKartensatz(erfordernisFuerRueckkommen(GESETZ, true, null, false))!;
		const b = lesartKartensatz(erfordernisFuerRueckkommen(GESETZ, true, null, true))!;
		expect(a).toContain('Die Klausel im Titel steht in Ihrem Reglement');
		expect(a).toContain('Nach ihr wäre schon der Beschluss abgelehnt gewesen.');
		expect(a).not.toContain('Seine Aufhebung');
		expect(b).toContain('Seine Aufhebung mit diesem Mehr besteht nur nach «Nach dem Gesetz»');
		expect(b).toContain('Eine nachträgliche Zustimmung ergänzt die Abstimmung im Saal nicht.');
		expect(b).not.toContain('Nach ihr wäre schon der Beschluss');
	});

	it('ohne Ausgang beim Rückkommen auf ein Rückkommen (Codeprüfung B2b, M2)', () => {
		const rk = erfordernisFuerRueckkommen(GESETZ, true, null, true);
		const rkRk = erfordernisFuerRueckkommen(rk, true, null, false);
		expect(rkRk.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'gesetz' });
		expect(rkRk.lesartDesBeschlusses?.mitAllen).toBeUndefined();
		expect(lesartKartensatz(rkRk)).not.toContain('Dem Beschluss haben alle Eigentümer zugestimmt');
	});

	it('nicht am Beschluss selbst und nicht vor L6', () => {
		expect(lesartKartensatz(KLAUSEL)).not.toContain('Das Rückkommen braucht');
		const alt = waehleErfordernis(holeRegelwerk('2026-11-04'), EIGENE_SCHRANKE_ID).ergebnis!;
		expect(lesartKartensatz(erfordernisFuerRueckkommen(alt, true, null, true)) ?? '').not.toContain('Das Rückkommen braucht');
	});

	it('mit einer Zeile im Protokoll in beiden Wahlen', () => {
		expect(lesartProtokollsatz(erfordernisFuerRueckkommen(KLAUSEL, true))).toBe(
			'Gezählt wie beim Beschluss nach der Zustimmung aller nach Ihrem Reglement, weil das Rückkommen dasselbe ' +
				'Mehr braucht. Ob eine Klausel gilt, nach der das Reglement nur mit der Zustimmung aller geändert werden ' +
				'kann, ist umstritten.'
		);
		expect(lesartProtokollsatz(erfordernisFuerRueckkommen(GESETZ, true))).toContain(
			'Gezählt wie beim Beschluss nach dem qualifizierten Mehr nach dem Gesetz'
		);
	});
});

describe('B2b, nach der Abstimmung über das Rückkommen', () => {
	it('unter der Klausel abgelehnt mit dem qualifizierten Mehr: der Beschluss gilt, ohne Anfechtung', () => {
		const rk = erfordernisFuerRueckkommen(KLAUSEL, true, null, true);
		const a = zaehle(rk, alleJa(FUENF), FUENF, { rueckkommenAufAnnahme: true });
		expect(a.angenommen).toBe(false);
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toMatch(/^Das Rückkommen hat das qualifizierte Mehr erreicht, nicht aber die Zustimmung aller\./);
		expect(s.leitung).not.toContain('anfecht');
		expect(s.protokoll).toBeNull();
		// Gegenstück: Erreicht es das qualifizierte Mehr nicht, gibt es nichts zu sagen.
		expect(zaehle(rk, ZWEI_ZU_DREI, FUENF).andereLesart).toBeUndefined();
	});

	it('unter dem Gesetz angenommen ohne alle: Anfechtung des neuen Beschlusses, nur in Fall b', () => {
		const b = zaehle(erfordernisFuerRueckkommen(GESETZ, true, null, true), VIER_ZU_EINS, FUENF);
		expect(b.angenommen).toBe(true);
		const s = andereLesartInWorten(b.andereLesart!, false);
		expect(s.leitung).toContain('kann man den neuen Beschluss beim Gericht anfechten');
		expect(s.leitung).toContain('nach einer Ablehnung also auch, wer Ja gestimmt hat');
		expect(s.protokoll).toContain('kann man den Beschluss im Durchgang nach dem Rückkommen beim Gericht anfechten');
		expect(s.protokoll).toContain('Klagen kann, wer diesem Beschluss nicht zugestimmt hat');
		expect(b.protokollhinweise?.map((h) => h.satz)).toContain(s.protokoll);
		// Gegenstücke: Fall a, und das Rückkommen mit allen sechs.
		expect(zaehle(erfordernisFuerRueckkommen(GESETZ, true, null, false), VIER_ZU_EINS, FUENF).andereLesart).toBeUndefined();
		expect(zaehle(erfordernisFuerRueckkommen(GESETZ, true, null, true), alleJa(SECHS), SECHS).andereLesart).toBeUndefined();
	});
});

describe('B2b, zweiter Durchgang nach dem Rückkommen', () => {
	it('unter dem Gesetz: nach der Klausel wäre schon das Rückkommen gescheitert', () => {
		const a = zaehle(GESETZ, ZWEI_ZU_DREI, FUENF, NACH_RK(false));
		const s = andereLesartInWorten(a.andereLesart!, false);
		expect(s.leitung).toBe(
			'Nach der anderen Lesart («Klausel anwenden») wäre schon das Rückkommen abgelehnt gewesen, und es gälte ' +
				'der Beschluss aus dem 1. Durchgang. Was daraus folgt, steht beim Rückkommen (Traktandum 1.1).'
		);
		// Gegenstücke: Das Rückkommen hatte alle; ohne Lage zum Rückkommen.
		expect(andereLesartInWorten(zaehle(GESETZ, ZWEI_ZU_DREI, FUENF, NACH_RK(true)).andereLesart!, false).leitung).toBe(
			'Nach der anderen Lesart («Klausel anwenden») dasselbe Ergebnis.'
		);
		expect(zaehle(GESETZ, ZWEI_ZU_DREI, FUENF).andereLesart?.schonRueckkommenAbgelehnt).toBeUndefined();
	});

	it('nennt den Durchgang, der gälte, nicht fest den ersten (Codeprüfung B2b, M3)', () => {
		const lage = { nachRueckkommen: { traktandum: '1.2', geltenderDurchgang: 2, beschlussMitAllen: true, rueckkommenMitAllen: false } };
		const s = andereLesartInWorten(zaehle(GESETZ, ZWEI_ZU_DREI, FUENF, lage).andereLesart!, false);
		expect(s.protokoll).toBe(
			'Nach der anderen Lesart («Klausel anwenden») wäre schon das Rückkommen abgelehnt gewesen, und es gälte ' +
				'der Beschluss aus dem 2. Durchgang (siehe Traktandum 1.2).'
		);
	});

	it('nicht, wenn alle dem zweiten Durchgang zugestimmt haben (B2b-F-1)', () => {
		const ja = zaehle(GESETZ, alleJa(SECHS), SECHS, NACH_RK(false));
		expect(andereLesartInWorten(ja.andereLesart!, false).leitung).toBe(
			'Nach der anderen Lesart («Klausel anwenden») dasselbe Ergebnis.'
		);
		const nein = zaehle(GESETZ, stimmen(Object.fromEntries(SECHS.map((p) => [p, 'no' as const]))), SECHS, NACH_RK(false));
		expect(nein.andereLesart?.schonRueckkommenAbgelehnt).toBeUndefined();
		// Gegenstück: fünf Ja, der Sechste fehlt.
		expect(zaehle(GESETZ, alleJa(FUENF), FUENF, NACH_RK(false)).andereLesart?.schonRueckkommenAbgelehnt).toBe('1.1');
	});

	it('unter der Klausel: nach einer Ablehnung genügt die blosse Aufhebung (B2b-F-5)', () => {
		const a = zaehle(KLAUSEL, alleJa(FUENF), FUENF, NACH_RK(true));
		const rat = andereLesartInWorten(a.andereLesart!, false).leitung;
		expect(rat).toContain('Hebt das Gericht die Ablehnung auf, gilt nach dem Wortlaut des Rückkommens wieder der frühere Beschluss');
		expect(rat).toContain('genügt für spätere Änderungen unter der Klausel dann das qualifizierte Mehr');
		expect(rat).not.toContain('Hebt das Gericht nur auf');
		// Gegenstück: am Beschluss selbst der Rat wie bisher.
		expect(andereLesartInWorten(zaehle(KLAUSEL, alleJa(FUENF), FUENF).andereLesart!, false).leitung).toContain(
			'Hebt das Gericht nur auf, kann die Gemeinschaft neu beschliessen'
		);
	});
});

describe('B2b, die Warnung, wenn die Mehrheit im Saal nicht zu erreichen ist', () => {
	const LAGE = leer(6, 6, 5);

	it('erkennt das Rückkommen an der Lage, auch ohne den Titel (R2-F-3)', () => {
		const ohneTitel = { ...KLAUSEL, titel: 'Regel des Reglements zum Rückkommen' };
		const w = erreichbarkeitshinweis(ohneTitel, LAGE, false, false, 0, false, { rueckkommenAufAnnahme: true })!;
		expect(w).toContain('Lassen Sie abstimmen, ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.');
		expect(w).toContain('Die Versammlung kann den Rückkommensantrag auf Antrag ans Ende des Abends verschieben');
		// Gegenstück: dieselbe Karte ohne die Angabe.
		expect(erreichbarkeitshinweis(ohneTitel, LAGE, false)).toContain('Lassen Sie abstimmen, ist der Antrag abgelehnt.');
	});

	it('im zweiten Durchgang: Nein hebt auf, und das Rückkommen geht nicht mit (P3b, B2b-F-4)', () => {
		const w = erreichbarkeitshinweis(KLAUSEL, LAGE, false, false, 0, false, NACH_RK(true))!;
		expect(w).toContain(
			'Lassen Sie abstimmen, ist der Antrag abgelehnt, und nach dem Rückkommen ersetzt auch diese Ablehnung den ' +
				'Beschluss aus dem 1. Durchgang: Er ist dann aufgehoben.'
		);
		expect(w).toContain('an eine spätere Versammlung geht das Rückkommen nicht mit');
		expect(w).not.toContain('oder auf eine spätere Versammlung');
		expect(erreichbarkeitshinweis(KLAUSEL, LAGE, false)).toContain('ans Ende des Abends oder auf eine spätere Versammlung');
	});

	it('in den Zweigen mit Streit die Folge statt der Anfechtung (R2-L-1)', () => {
		const lux = waehleErfordernis(RW, 'k-baulich-luxurioes').ergebnis!;
		const w = erreichbarkeitshinweis(lux, LAGE, false, false, 0, false, { rueckkommenAufAnnahme: true })!;
		expect(w).toContain('trotzdem eine Ablehnung. Damit ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.');
		expect(w).not.toContain('angefochten');
		expect(erreichbarkeitshinweis(lux, LAGE, false)).toContain('kann diese Ablehnung angefochten werden');
	});
});

describe('B2b, Form', () => {
	it('die Herleitung in der Klammer ohne Schlusspunkt', () => {
		expect(herleitung('Fall', 'Regel dieser Anwendung (Fundstelle).')).toBe('hergeleitet als «Fall», Regel dieser Anwendung (Fundstelle)');
		// Gegenstück: Eine erfasste Fundstelle behält ihren Punkt (Codeprüfung B2b, G2).
		expect(herleitung(null, 'Reglement der Gemeinschaft, Art. 12 ff.')).toBe('Reglement der Gemeinschaft, Art. 12 ff.');
	});

	it('der Annahmesatz wie die Ablehnung', () => {
		const a = zaehle(GESETZ, alleJa(SECHS), SECHS);
		expect(ergebnisInWorten(a, GESETZ)).toMatch(
			/^Angenommen: 6 Ja von 6 Kopfstimmen, nötig 4; 1000 Ja von 1000 Wertquoten, nötig 501\. Nötig war mehr als die Hälfte/
		);
	});
});
