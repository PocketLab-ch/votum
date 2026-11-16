/**
 * 1a: das Ergebnis nach der anderen Zählbasis an der Ermächtigung zur
 * Ausschlussklage (Lesarten Block 6, Kriterien 1, 2, 4, 5, 7; Konzept,
 * Kriterium 13). Votum zählt fest an allen Eigentümern ausser dem Beklagten
 * und nennt daneben das Ergebnis an den Anwesenden und Vertretenen; unter einer
 * Regel der Anwesenden umgekehrt (Produktentscheid 21.10.2026).
 */
import { describe, expect, it } from 'vitest';
import {
	andereLesartInWorten,
	andereLesartenVon,
	andereZaehlbasisVon,
	angehoerigenhinweis,
	lesartKartensatz,
	mitKeinemBeschluss,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { gesetzesmassVon, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';
import { holeRegelwerk } from '$lib/rules';

function snapshot(anzahl: number): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-21T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: anzahl * 100,
		parties: Array.from({ length: anzahl }, (_, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${i + 1}`,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: 100 }]
		}))
	};
}

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-21T19:10:00.000Z',
		recordedByChair: false
	}));
}

const KLAGE = waehleErfordernis(holeRegelwerk('2026-10-28'), 'k-ausschlussklage').ergebnis!;
const ANWESENDE_REGEL: Erfordernis = { ...KLAGE, kopfbasis: 'anwesend_vertreten', quelle: 'reglement' };

/**
 * Sieben Eigentümer, p7 beklagt. Da sind p1 bis p4 und p7; p1 bis p3 Ja, p4
 * Nein. An allen ausser dem Beklagten: 3 Ja von 6, nötig 4. An den Anwesenden
 * ausser dem Beklagten: 3 Ja von 4, nötig 3.
 */
function saal(e: Erfordernis, ja = ['p1', 'p2', 'p3'], geheim = false): Auszaehlungslage {
	const anwesend = ['p1', 'p2', 'p3', 'p4'];
	return {
		momentaufnahme: snapshot(7),
		erfordernis: e,
		stimmen: stimmen(...anwesend.map((p): [string, VoteChoice] => [p, ja.includes(p) ? 'yes' : 'no'])),
		anwesende: [...anwesend, 'p7'],
		betroffeneParteiIds: ['p7'],
		geheim
	};
}

describe('1a: Votum zählt an allen ausser dem Beklagten und nennt die Anwesenden', () => {
	it('verkündet nach der festen Zählung und nennt das abweichende Ergebnis mit Zahlen', () => {
		const a = zaehleAus(saal(KLAGE));
		expect(a.koepfe).toMatchObject({ ja: 3, basis: 6, schwelle: 4 });
		expect(a.angenommen).toBe(false);
		expect(a.andereZaehlbasis).toMatchObject({
			kennung: '1a',
			feststellbar: true,
			angenommen: true,
			abweichend: true,
			koepfe: { ja: 3, basis: 4, schwelle: 3, erreicht: true }
		});
		const w = andereLesartInWorten(a.andereZaehlbasis!, false);
		expect(w.leitung).toContain('Gezählt an allen Eigentümern ausser dem Beklagten, ist der Antrag abgelehnt.');
		expect(w.leitung).toContain('wäre er angenommen: 3 Ja von 4 Kopfstimmen, nötig 3');
		expect(w.leitung).toContain('Votum verkündet die Ablehnung');
		expect(w.protokoll).toBe(
			'Verkündet ist die Ablehnung, gezählt an allen Eigentümern ausser dem Beklagten. Gezählt nur an den ' +
				'Anwesenden und Vertretenen ausser dem Beklagten, wäre der Antrag angenommen gewesen: 3 Ja von 4 ' +
				'Kopfstimmen, nötig 3. Eine Anfechtung der Ablehnung allein ermächtigt niemanden zur Klage.'
		);
		expect(a.protokollhinweise).toContainEqual({ ort: 'ausgang', satz: w.protokoll });
	});

	it('bei gleichem Ergebnis hört es die Leitung, das Protokoll schweigt (Entscheid 0023)', () => {
		const a = zaehleAus(saal(KLAGE, ['p1', 'p2', 'p3', 'p4']));
		expect(a.angenommen).toBe(true);
		expect(a.andereZaehlbasis).toMatchObject({ abweichend: false, angenommen: true });
		const w = andereLesartInWorten(a.andereZaehlbasis!, false);
		expect(w.leitung).toBe(
			'Gezählt an den Anwesenden und Vertretenen ausser dem Beklagten, wäre das Ergebnis dasselbe.'
		);
		expect(w.protokoll).toBeNull();
		expect((a.protokollhinweise ?? []).some((h) => h.satz.includes('ausser dem Beklagten'))).toBe(false);
	});

	it('bei geheimer Abstimmung ohne Zahlen', () => {
		const a = zaehleAus(saal(KLAGE, undefined, true));
		const w = andereLesartInWorten(a.andereZaehlbasis!, true);
		expect(w.leitung).toContain('wäre er angenommen. Votum verkündet');
		expect(w.protokoll).not.toContain('Kopfstimmen');
	});

	it('die Handzählung bildet dieselbe zweite Zahl', () => {
		const { stimmen: _s, ...lage } = saal(KLAGE);
		void _s;
		const a = zaehleSummenAus(lage, { ja: 3, nein: 1, enthaltung: 0 });
		expect(a.angenommen).toBe(false);
		expect(a.andereZaehlbasis).toMatchObject({ abweichend: true, koepfe: { ja: 3, basis: 4, schwelle: 3 } });
	});

	it('ohne Beschluss fällt das zweite Ergebnis weg, samt Protokollsatz', () => {
		const a = mitKeinemBeschluss(zaehleAus(saal(KLAGE)), { grund: 'konsultativ', namen: [] });
		expect(andereLesartenVon(a)).toEqual([]);
		expect((a.protokollhinweise ?? []).some((h) => h.satz.includes('ausser dem Beklagten'))).toBe(false);
	});
});

describe('1a umgekehrt: unter einer Regel der Anwesenden nennt Votum die Zahl aller', () => {
	it('ein angenommener Beschluss, der an allen scheitert, heisst angreifbar', () => {
		const a = zaehleAus(saal(ANWESENDE_REGEL));
		expect(a.koepfe).toMatchObject({ ja: 3, basis: 4 });
		expect(a.angenommen).toBe(true);
		expect(a.andereZaehlbasis).toMatchObject({
			abweichend: true,
			angenommen: false,
			koepfe: { ja: 3, basis: 6, schwelle: 4 }
		});
		const w = andereLesartInWorten(a.andereZaehlbasis!, false);
		expect(w.leitung).toContain('Die Ermächtigung ist damit angreifbar');
		expect(w.leitung).toContain('wie es der Wortlaut von ZGB Art. 649b Abs. 2 nahelegt');
		expect(w.leitung).toContain('Welche Zahl gilt, ist umstritten.');
		expect(w.protokoll).toBe(
			'Verkündet ist die Annahme, gezählt an den Anwesenden und Vertretenen ausser dem Beklagten. Gezählt ' +
				'an allen Eigentümern ausser dem Beklagten, wäre der Antrag abgelehnt gewesen: 3 Ja von 6 ' +
				// A5, Punkt 14: Berechtigte, Stelle und Frist am Protokollsatz, weil
				// das Protokoll für Abwesende die Frist in Gang setzt (Rz. 230).
				'Kopfstimmen, nötig 4. Welche Zahl gilt, ist umstritten; die Ermächtigung kann deshalb ' +
				'angefochten werden: Wer nicht zugestimmt hat, kann sie beim Gericht anfechten, innert eines ' +
				'Monats, seit er davon weiss; wer anwesend oder vertreten war, ab der Versammlung, wer weder ' +
				'da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. ' +
				'Art. 75).'
		);
	});

	it('die Angehörige im Ausstand zählt dabei mit (1e)', () => {
		const a = zaehleAus({ ...saal(ANWESENDE_REGEL, ['p1', 'p2', 'p3', 'p5']), anwesende: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p5', 'no']), imAusstand: ['p4'] });
		expect(a.andereZaehlbasis?.koepfe).toMatchObject({ basis: 6, schwelle: 4 });
	});

	it('erst ab der Fassung 2026-10-25, sonst bleibt der Rat, von Hand zu zählen', () => {
		const alt: Erfordernis = { ...ANWESENDE_REGEL, fassung: '2026-10-24' };
		expect(andereZaehlbasisVon(alt)).toBeNull();
		expect(zaehleAus(saal(alt)).andereZaehlbasis ?? null).toBeNull();
		expect(angehoerigenhinweis(alt)).toContain('Zählen Sie nach der Abstimmung alle');
	});

	it('der Hinweis zu den Angehörigen lässt nicht mehr von Hand zählen', () => {
		const h = angehoerigenhinweis(ANWESENDE_REGEL)!;
		expect(h).toContain('Nach der Auszählung nennt Ihnen die Anwendung auch das Ergebnis an dieser Zahl');
		expect(h).not.toContain('Zählen Sie nach der Abstimmung alle');
		expect(h).toContain('Ein Schlichtungsgesuch am letzten Tag genügt');
	});
});

describe('1a nicht, wo die Leitung abgewichen ist: dort gilt Anhang A', () => {
	const abgewichen: Erfordernis = {
		...ANWESENDE_REGEL,
		quelle: 'gewaehlt',
		begruendung: 'Wunsch der Versammlung',
		gesetzlich: gesetzesmassVon(KLAGE)
	};

	it('keine zweite Zählbasis, aber das Mehr aus Gesetz und Reglement', () => {
		const a = zaehleAus(saal(abgewichen));
		expect(a.andereZaehlbasis ?? null).toBeNull();
		expect(a.nachGesetzUndReglement).toMatchObject({ kennung: 'A', abweichend: true, angenommen: false });
	});

	it('unter einer Fassung vor 2026-10-25 bleibt bei der Abweichung der Rat, von Hand zu zählen (N2)', () => {
		expect(angehoerigenhinweis({ ...abgewichen, fassung: '2026-10-24' })).toContain(
			'Zählen Sie nach der Abstimmung alle'
		);
	});

	it('der Hinweis zu den Angehörigen kündigt die Zahl aller an, wenn das Gesetz sie verlangt', () => {
		expect(angehoerigenhinweis(abgewichen)).toContain('Nach der Auszählung nennt Ihnen die Anwendung');
		const ohneMass = { ...abgewichen, gesetzlich: undefined };
		expect(angehoerigenhinweis(ohneMass)).toContain('Zählen Sie nach der Abstimmung alle');
	});

	it('ein von Hand gewählter Knoten ohne Begründung ist keine Abweichung', () => {
		expect(KLAGE.quelle).toBe('gewaehlt');
		expect(andereZaehlbasisVon(KLAGE)).toBe('anwesend_vertreten');
	});
});

describe('Die Karte kündigt das zweite Ergebnis an (Kriterium 4)', () => {
	it('an der Ausschlussklage je nach Zählbasis', () => {
		expect(lesartKartensatz(KLAGE)).toBe(
			'Nach der Auszählung nennt Votum auch das Ergebnis, gezählt an den Anwesenden und Vertretenen ' +
				'ausser dem Beklagten.'
		);
		expect(lesartKartensatz(ANWESENDE_REGEL)).toBe(
			'Nach der Auszählung nennt Votum auch das Ergebnis, gezählt an allen Eigentümern ausser dem Beklagten.'
		);
	});

	it('an anderen Knoten nicht', () => {
		const anderes = waehleErfordernis(holeRegelwerk('2026-10-28'), 'k-organ-waehlen').ergebnis!;
		expect(lesartKartensatz(anderes)).toBeNull();
	});
});
