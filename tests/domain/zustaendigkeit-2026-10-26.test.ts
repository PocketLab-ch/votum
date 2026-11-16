/**
 * Fassung 2026-10-26: die Zuständigkeitsordnung ausserhalb des Reglements als
 * Lesart der Gemeinschaft (L2, Entscheid 0018, F6).
 *
 * Gemessen wird Kriterium 8 des Konzepts Lesarten (Vorgabe einfaches Mehr der
 * Anwesenden, Wahl qualifiziertes Mehr; die Karte nennt Rz. 109 und den
 * Wortlaut «aller»), Kriterium 14 (nach der Vorgabe dasselbe Mehr, ältere
 * Fassungen ohne Lesart) und die Kriterien 4 bis 6 an L2: Kartensatz, zweites
 * Ergebnis und Protokollzeile.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { erfordernisAus, ergebniskarte, laufe } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import {
	andereLesartInWorten,
	lesartKartensatz,
	lesartProtokollsatz,
	zaehleAus
} from '$lib/domain/auszaehlung';
import {
	knotenNachLesart,
	LESARTEN,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenImRegelwerk,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import {
	BEGRUENDUNG,
	HINWEIS_LESART,
	HINWEIS_VORHER,
	ZUM_GESETZ_LESART,
	ZUSTAENDIGKEIT_ID
} from '$lib/rules/quorum-2026-10-26';

const VOR = holeRegelwerk('2026-10-25');
const NEU = holeRegelwerk('2026-10-26');
const QUALIFIZIERT: Lesartenwahl = { ...LESARTEN_VORGABE, L2: 'qualifiziert' };

function herleiten(rw: typeof NEU, wahlen: Lesartenwahl = LESARTEN_VORGABE) {
	return wendeLesartAn(erfordernisAus(rw, laufe(rw, 'a-sonderfaelle', ['f8-1-zustaendigkeit'])), wahlen);
}

describe('Fassung 2026-10-26 gegenüber 2026-10-25', () => {
	it('ist in sich stimmig, mit L2 am Knoten, und seit Lesarten Block 4 nicht mehr die aktuelle', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-19');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toEqual([]);
		expect(NEU.knoten.filter((k) => k.lesart?.kennung === 'L2').map((k) => k.id)).toEqual([ZUSTAENDIGKEIT_ID]);
	});

	it('ändert nur den Knoten der Zuständigkeitsordnung', () => {
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			if (k.id === ZUSTAENDIGKEIT_ID) continue;
			expect(k, k.id).toEqual(VOR.knoten.find((x) => x.id === k.id));
		}
	});

	it('rechnet nach der Vorgabe dasselbe Mehr wie vorher (Kriterien 8 und 14)', () => {
		const vorher = herleiten(VOR);
		const e = herleiten(NEU);
		expect({ typ: e.typ, kopf: e.kopfbasis, quoten: e.quotenbasis, ks: e.kopfSchwelle, qs: e.quotenSchwelle }).toEqual({
			typ: vorher.typ,
			kopf: vorher.kopfbasis,
			quoten: vorher.quotenbasis,
			ks: vorher.kopfSchwelle,
			qs: vorher.quotenSchwelle
		});
		expect(e).toMatchObject({ typ: 'einfaches_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'keine' });
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'einfach', vorgabe: true });
		// Die Vorfassung trägt keine Lesart: Ihre Traktanden rechnen weiter ohne.
		expect(herleiten(VOR).gemeinschaftslesart).toBeUndefined();
	});

	it('rechnet nach der Wahl «qualifiziert» das qualifizierte Mehr über alle Wertquoten (Kriterium 8)', () => {
		const e = herleiten(NEU, QUALIFIZIERT);
		expect(e).toMatchObject({
			typ: 'qualifiziertes_mehr',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			rechtsgrundlage: 'ZGB Art. 647a Abs. 2'
		});
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'qualifiziert', vorgabe: false });
		expect(e.gemeinschaftslesart?.andere).toMatchObject({ typ: 'einfaches_mehr', quotenbasis: 'keine' });
	});

	it('nennt auf der Karte Rz. 109 und den Wortlaut «aller», nach jeder Wahl (Kriterium 8)', () => {
		const k = NEU.knoten.find((x) => x.id === ZUSTAENDIGKEIT_ID)!;
		for (const w of lesartVon('L2')!.wahlen) {
			const karte = ergebniskarte(NEU, knotenNachLesart(NEU, k, { ...LESARTEN_VORGABE, L2: w.wert } as Lesartenwahl));
			const alles = [karte.begruendung, ...(karte.hinweise ?? [])].join(' ');
			expect(alles, w.wert).toMatch(/Art\. 712a Rz\. 109|Rz\. 109 ad Art\. 712a/);
			expect(alles, w.wert).toMatch(/Mehrheit aller Miteigentümer/);
			expect(alles, w.wert).not.toMatch(/dieses Werkzeug|nach diesem Werkzeug/);
		}
		expect(k.hinweise).toContain(HINWEIS_LESART);
		expect(k.hinweise).not.toContain(HINWEIS_VORHER);
		expect(k.begruendung).toBe(BEGRUENDUNG);
		// Unter einer Regel der Streit ohne die Seite «Lesarten».
		const unter = k.hinweiseUnterRegel!.find((u) => u.hinweis === HINWEIS_LESART)!;
		expect(unter.zumGesetz).toBe(ZUM_GESETZ_LESART);
		expect(ZUM_GESETZ_LESART).not.toMatch(/Lesarten/);
		// Die Vorfassung bleibt, wie sie war: Sie trägt gefasste Beschlüsse.
		expect(VOR.knoten.find((x) => x.id === ZUSTAENDIGKEIT_ID)!.hinweise).toContain(HINWEIS_VORHER);
	});

	it('baut die Ergebniskarte nach der eingestellten Lesart, wie das Erfordernis', () => {
		const k = NEU.knoten.find((x) => x.id === ZUSTAENDIGKEIT_ID)!;
		for (const w of LESARTEN.find((l) => l.kennung === 'L2')!.wahlen) {
			const wahlen = { ...LESARTEN_VORGABE, L2: w.wert } as Lesartenwahl;
			const e = herleiten(NEU, wahlen);
			const karte = ergebniskarte(NEU, knotenNachLesart(NEU, k, wahlen));
			expect({ typ: karte.typ, rechtsgrundlage: karte.rechtsgrundlage }, w.wert).toEqual({
				typ: e.typ,
				rechtsgrundlage: e.rechtsgrundlage
			});
			const getauscht = { ...NEU, knoten: NEU.knoten.map((x) => knotenNachLesart(NEU, x, wahlen)) };
			expect(pruefeRegelwerk(getauscht), w.wert).toEqual([]);
		}
	});
});

/** Drei Eigentümer: zwei kleine Wohnungen, eine grosse, dazu eine vierte für den Ausstand. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-21T17:00:00.000Z',
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
		castAt: '2026-10-21T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Zwei kleine Ja, die grosse Nein: Köpfe erreicht, Wertquoten nicht. */
const ABWEICHEND = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']);

describe('L2 im Saal (Kriterien 4 bis 6)', () => {
	it('nennt auf der Karte die Lesart und was die andere verlangt', () => {
		const satz = lesartKartensatz(herleiten(NEU))!;
		// A5, Punkt 1b: der Grund der Vorgabe statt der Software.
		expect(satz).toMatch(
			/^Dieses Traktandum rechnet nach der Lesart «Einfaches Mehr» \(Standardeinstellung: Der SVIT-Kommentar führt diesen Beschluss überwiegend beim einfachen Mehr auf; an einer Stelle verlangt er das qualifizierte\)/
		);
		expect(satz).toMatch(/Die andere Lesart \(«Qualifiziertes Mehr»\) verlangt/);
		// Die andere braucht die Wertquoten, die Vorgabe nicht: der Rat vor der Abstimmung.
		expect(satz).toMatch(/Erfassen Sie dafür die Stimme jedes Eigentümers/);
	});

	it('rechnet das zweite Ergebnis nach dem qualifizierten Mehr und hält es im Protokoll fest', () => {
		const a = zaehleAus({ momentaufnahme: M, erfordernis: herleiten(NEU), stimmen: ABWEICHEND, anwesende: ['p1', 'p2', 'p3'], geheim: false });
		expect(a.angenommen).toBe(true);
		expect(a.andereLesart).toMatchObject({
			kennung: 'L2',
			wahl: 'Qualifiziertes Mehr',
			angenommen: false,
			abweichend: true,
			quoten: { ja: 400, basis: 1000, erreicht: false }
		});
		// A5, Punkt 1a: nicht «die Lesart dieser Versammlung».
		expect(andereLesartInWorten(a.andereLesart!, false).leitung).toMatch(
			/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Einfaches Mehr»\), ist der Antrag angenommen\./
		);
		expect((a.protokollhinweise ?? []).filter((h) => h.ort === 'ausgang').map((h) => h.satz)).toContainEqual(
			expect.stringMatching(/^Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/)
		);
		expect(lesartProtokollsatz(herleiten(NEU))).toBe(
			'Gezählt nach dem einfachen Mehr. Ob ein Beschluss, der die Zuständigkeit für gewöhnliche ' +
				'Verwaltungshandlungen anders regelt, das qualifizierte Mehr braucht, ist umstritten. Das ' +
				'einfache Mehr ist die Standardeinstellung: Der SVIT-Kommentar führt diesen Beschluss ' +
				'überwiegend beim einfachen Mehr auf; an einer Stelle verlangt er das qualifizierte.'
		);
	});

	/*
	 * **Mit L1 an einem Traktandum** (L2 «qualifiziert» rechnet über alle
	 * Wertquoten): Der gemeinsame Satz nannte die andere Lesart am Mehr fest mit
	 * dem Namen aus L4. Heute tragen beide Lesarten dieselben Bezeichnungen;
	 * der erste Test hält den Satz fest, der zweite gibt L2 für die Dauer des
	 * Tests eine eigene Bezeichnung und wird ohne die Korrektur rot (Review
	 * DeepSeek Block 3, B2).
	 */
	it('nennt im gemeinsamen Satz mit L1 die andere Wahl von L2', () => {
		const e = herleiten(NEU, QUALIFIZIERT);
		const satz = lesartKartensatz(e, 'bleibt')!;
		expect(satz).toMatch(/^Zum Mehr: Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr», die für Ihre Gemeinschaft eingestellt ist/);
		expect(satz).toMatch(/Nach der Auszählung nennt Votum zusätzlich das Ergebnis nach «Einfaches Mehr» und, wenn jemand im Ausstand ist, nach «Wertquote fällt heraus»\.$/);
	});

	it('nimmt den Namen der anderen Wahl aus L2, nicht aus L4', () => {
		const einfach = lesartVon('L2')!.wahlen.find((w) => w.wert === 'einfach')!;
		const bisher = einfach.bezeichnung;
		einfach.bezeichnung = 'Einfaches Mehr nach L2';
		try {
			const satz = lesartKartensatz(herleiten(NEU, QUALIFIZIERT), 'bleibt')!;
			expect(satz).toMatch(/das Ergebnis nach «Einfaches Mehr nach L2» und/);
		} finally {
			einfach.bezeichnung = bisher;
		}
	});
});
