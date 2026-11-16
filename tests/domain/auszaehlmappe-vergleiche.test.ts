/**
 * Die Auszählmappe rechnet jede Rechnung vor, die die Karte ankündigt (A3,
 * 30.10.2026): Spalten «zum Vergleich» für L1 bis L6, 1a und das Mehr aus
 * Gesetz und Reglement, den Stichentscheid nach A1 Frage 1 und die
 * Beschlussfähigkeit einer ersten Versammlung für neue Traktanden. Diese
 * Datei prüft davon nur einen Teil, L6 nicht: Die L6-Spalten rechnet allein
 * `scripts/mappe-nachrechnen.mjs` nach (Posten 9 und 10 der Mappe «Lesarten
 * am Mehr, 1a und Gesetz»), von Hand und nicht im Prüflauf.
 *
 * Ob eine Tabellenkalkulation daraus dieselben Zahlen macht wie der Kern, misst
 * `scripts/mappe-nachrechnen.mjs` mit LibreOffice; hier stehen Aufbau, Bezüge
 * und Wortlaut, die der Prüflauf ohne LibreOffice sieht.
 */
import { describe, expect, it } from 'vitest';
import {
	baueAuszaehlmappe,
	brauchtRechnung,
	mappenpostenAus,
	mappenrechnungAus,
	stichentscheidMappensatz,
	type Mappenangaben,
	type Mappenposten
} from '$lib/domain/auszaehlmappe';
import { andereLesartenVon, vergleicheZu, zaehleAus } from '$lib/domain/auszaehlung';
import { erfordernisNachAndererLesart, LESARTEN_VORGABE, wendeLesartAn } from '$lib/domain/lesarten';
import { waehleErfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot, Stichentscheid, Vote } from '$lib/domain/types';
import type { Zelle } from '$lib/domain/xlsx';
import { holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk('2026-10-29');
const L4 = waehleErfordernis(RW, RW.knoten.find((k) => k.lesart?.kennung === 'L4')!.id).ergebnis!;
/**
 * Die Wahl, die der Knoten der Fassung 2026-10-29 rechnet: «einfach». Bis Block B
 * war sie die Vorgabe (`LESARTEN_VORGABE`); seit der Fassung 2026-11-13 ist es
 * «qualifiziert» (Entscheid 0048).
 */
const EINFACH_L4 = { ...LESARTEN_VORGABE, L4: 'einfach' as const };
const EINFACH = waehleErfordernis(RW, 'k-organ-waehlen').ergebnis!;
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis!;
const KLAGE = waehleErfordernis(RW, 'k-ausschlussklage').ergebnis!;
const OHNE_L5 = { neuAnZweiter: false, wahl: 'erste' as const };

const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-30T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [
		['p1', 'Aebi', 400],
		['p2', 'Berger', 300],
		['p3', 'Caduff', 300]
	].map(([id, name, quote]) => ({
		partyId: id as string,
		displayName: name as string,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${id}-u`, label: `Whg ${id}`, kind: 'unit' as const, countsAsHead: true, quota: quote as number }]
	}))
};

function mappe(posten: Mappenposten[], mehr: Partial<Mappenangaben> = {}) {
	return baueAuszaehlmappe({
		gemeinschaftName: 'Prüf',
		datum: '30. Oktober 2026',
		uhrzeit: '19:00',
		ort: 'Saal',
		gesamtquote: 1000,
		jeEinheit: false,
		parteien: M.parties.map((p) => ({ name: p.displayName, kopfstimmen: 1, wertquote: p.units[0].quota })),
		posten,
		...mehr
	});
}

const zeile = (b: { zeilen: Zelle[][] }, beschriftung: string) => {
	const z = b.zeilen.find((r) => r[0]?.art === 'text' && r[0].wert === beschriftung);
	if (!z) throw new Error(`Zeile «${beschriftung}» fehlt`);
	return z;
};
const formel = (z: Zelle | undefined) => (z?.art === 'formel' ? z.formel : '');
const texte = (b: { zeilen: Zelle[][] }) =>
	b.zeilen.flat().map((z) => (z.art === 'text' ? z.wert : '')).join(' ');

describe('Die Vergleiche kommen aus dem Kern', () => {
	it('bildet den Vergleich nach L4 aus demselben anderen Erfordernis wie zaehleAus', () => {
		const e = wendeLesartAn(L4, EINFACH_L4);
		const p = mappenpostenAus({ nummer: '1', titel: 'Wahl' }, e, M, OHNE_L5)!;
		expect(p.vergleiche?.map((v) => v.kennung)).toEqual(['L4']);
		expect(p.vergleiche?.[0].rechnung).toEqual(mappenrechnungAus(erfordernisNachAndererLesart(e)!, M));
		expect(p.vergleiche?.[0].wahl).toBe('Qualifiziertes Mehr');
	});

	it('nennt dieselben zweiten Ergebnisse wie die Zählung, sobald jemand im Ausstand ist', () => {
		const e = wendeLesartAn(L4, { ...LESARTEN_VORGABE, L4: 'qualifiziert' });
		const stimmen: Vote[] = [
			{ partyId: 'p1', unitId: 'p1-u', choice: 'yes', castAt: '2026-10-30T19:00:00.000Z', recordedByChair: false },
			{ partyId: 'p2', unitId: 'p2-u', choice: 'no', castAt: '2026-10-30T19:00:00.000Z', recordedByChair: false }
		];
		const a = zaehleAus({ momentaufnahme: M, erfordernis: e, stimmen, anwesende: ['p1', 'p2', 'p3'], imAusstand: ['p3'] });
		// B3 führt die Mappe bewusst nicht (Entscheid 0041); ausdrücklich, damit eine
		// Vorlage ab Fassung 2026-11-05 nicht zufällig rot wird (Review DeepSeek zu F4c Block 3).
		expect(andereLesartenVon(a).map((r) => r.kennung).filter((k) => k !== 'B3')).toEqual(
			vergleicheZu(e, M).map((v) => v.worte.kennung)
		);
	});

	it('nennt 1a an der Ausschlussklage', () => {
		const p = mappenpostenAus({ nummer: '1', titel: 'Klage' }, KLAGE, M, OHNE_L5)!;
		expect(p.vergleiche?.map((v) => v.kennung)).toContain('1a');
		expect(p.vergleiche?.find((v) => v.kennung === '1a')?.rechnung.kopfbasis).toBe('anwesend_vertreten');
	});
});

describe('Die Spalte «zum Vergleich»', () => {
	const e = wendeLesartAn(L4, EINFACH_L4);
	const p = mappenpostenAus({ nummer: '1', titel: 'Wahl' }, e, M, OHNE_L5)!;

	it('zählt die Stimmen aus der Spalte des Traktandums und steht in der eigenen', () => {
		const b = mappe([p]);
		const ja = zeile(b, 'Ja (Kopfstimmen)');
		// Vier Vorspalten: E ist das Traktandum, F der Vergleich.
		expect(formel(ja[4])).toContain('E$');
		expect(formel(ja[5])).toContain('E$');
		expect(formel(zeile(b, 'Nötig (Kopfstimmen)')[5])).toContain('F');
		expect(zeile(b, 'Traktandum')[5]).toMatchObject({ wert: '1 zum Vergleich' });
	});

	it('hat in der Matrix keine gelben Felder', () => {
		const b = mappe([p]);
		const aebi = zeile(b, 'Aebi');
		expect(aebi[4]).toMatchObject({ stil: 'eingabe' });
		expect(aebi[5]).not.toMatchObject({ stil: 'eingabe' });
	});

	it('sagt, ob sie abweicht, und am Fuss, was dann zu tun ist', () => {
		const b = mappe([p]);
		expect(formel(zeile(b, 'Weicht vom Traktandum ab?')[5])).toContain('JA, siehe unten');
		// Codeprüfung A3, N4: «kein Beschluss» steht vor «offen» in der Formel.
		const f = formel(zeile(b, 'Weicht vom Traktandum ab?')[5]);
		expect(f.indexOf('kein Beschluss')).toBeLessThan(f.indexOf('"offen"'));
		// Runde 3, R3-F-2: Nach L5 ohne Beschlussfähigkeit gibt es nichts anzufechten.
		expect(formel(zeile(b, 'Weicht vom Traktandum ab?')[5])).toContain('kein Beschluss, siehe unten');
		expect(texte(b)).toContain('Eine Spalte «zum Vergleich» zählt die Stimmen des Traktandums');
		// Ohne Vergleich weder Zeile noch Satz.
		const ohne = mappe([{ ...p, vergleiche: undefined }]);
		expect(() => zeile(ohne, 'Weicht vom Traktandum ab?')).toThrow();
		expect(texte(ohne)).not.toContain('zum Vergleich');
	});

	it('holt ein Traktandum in die Mappe, wenn nur sein Vergleich rechnen muss', () => {
		// L4 «einfach» der Anwesenden: Handzählen genügt, für «qualifiziert» nicht.
		const r = mappenrechnungAus(e, M)!;
		expect(brauchtRechnung({ ...r, nummer: '1', titel: 'Wahl' }, false)).toBe(false);
		expect(brauchtRechnung(p, false)).toBe(true);
	});
});

describe('Der Stichentscheid nach A1 Frage 1', () => {
	it('ist nur beim einfachen Mehr ohne Wertquoten möglich', () => {
		expect(mappenrechnungAus(EINFACH, M)?.stichentscheidMoeglich).toBe(true);
		expect(mappenrechnungAus(QUALIFIZIERT, M)?.stichentscheidMoeglich).toBe(false);
	});

	it.each<[Stichentscheid, string | null, boolean]>([
		['wertquote', null, true],
		['wertquote_verwalter', 'GLEICHSTAND: Verwalter entscheidet', true],
		['verwalter', 'GLEICHSTAND: Verwalter entscheidet', false],
		['vorsitz', 'GLEICHSTAND: Vorsitz entscheidet', false]
	])('rechnet nach «%s» im Ergebnis', (art, person, quoten) => {
		const einfach = mappenpostenAus({ nummer: '1', titel: 'Wahl' }, EINFACH, M, OHNE_L5)!;
		const quali = mappenpostenAus({ nummer: '2', titel: 'Wichtig' }, QUALIFIZIERT, M, OHNE_L5)!;
		const b = mappe([einfach, quali], { stichentscheid: art });
		const ergebnis = zeile(b, 'Ergebnis');
		const f = formel(ergebnis[4]);
		expect(f.includes('ANGENOMMEN (Stichentscheid)')).toBe(quoten);
		if (person) expect(f).toContain(person);
		// Das qualifizierte Mehr und sein Vergleich lösen keinen Gleichstand auf.
		for (const z of ergebnis.slice(5)) {
			expect(formel(z)).not.toMatch(/Stichentscheid|GLEICHSTAND/);
		}
	});

	it('holt das einfache Mehr in die Mappe, wo die Wertquoten den Gleichstand entscheiden (Codeprüfung A3, M2)', () => {
		const einfach = mappenpostenAus({ nummer: '1', titel: 'Wahl' }, EINFACH, M, OHNE_L5)!;
		expect(brauchtRechnung(einfach, false)).toBe(false);
		expect(brauchtRechnung(einfach, false, 'verwalter')).toBe(false);
		expect(brauchtRechnung(einfach, false, 'wertquote')).toBe(true);
		expect(brauchtRechnung(einfach, false, 'wertquote_vorsitz')).toBe(true);
	});

	it('löst ohne Klausel nichts auf', () => {
		const einfach = mappenpostenAus({ nummer: '1', titel: 'Wahl' }, EINFACH, M, OHNE_L5)!;
		expect(formel(zeile(mappe([einfach]), 'Ergebnis')[4])).not.toMatch(/Stichentscheid|GLEICHSTAND/);
	});

	it('sagt für jede Art: nur beim einfachen Mehr ohne Wertquoten, auch für eine Person', () => {
		for (const art of ['wertquote', 'verwalter', 'vorsitz', 'wertquote_verwalter', 'wertquote_vorsitz'] as const) {
			const satz = stichentscheidMappensatz(art);
			expect(satz).toContain('gilt ein Stichentscheid nur beim einfachen Mehr nach Köpfen, ohne Wertquoten');
			expect(satz).toContain('Bei jedem anderen Mehr ist ein Antrag bei Stimmengleichheit abgelehnt');
			expect(satz).toContain('ergeben zusammen die Zahl in der Zeile «Bezugsgrösse Kopfstimmen»');
		}
		// Runde 2, R2-F-2: Die Person entscheidet im Saal, nicht nachträglich.
		for (const art of ['verwalter', 'vorsitz', 'wertquote_verwalter'] as const) {
			expect(stichentscheidMappensatz(art)).toContain('gleich im Saal');
			expect(stichentscheidMappensatz(art)).not.toContain('nachträglich');
		}
		expect(stichentscheidMappensatz('keiner')).toContain('keinen Stichentscheid');
		// Der alte Satz galt nur für die Wertquoten.
		expect(texte(mappe([mappenpostenAus({ nummer: '1', titel: 'Wahl' }, EINFACH, M, OHNE_L5)!], { stichentscheid: 'verwalter' }))).not.toContain(
			'Ein Stichentscheid nach Wertquoten gilt nur beim einfachen Mehr'
		);
	});
});

describe('L5: neue Traktanden der zweiten Versammlung', () => {
	const neu = (wahl: 'erste' | 'drittel') =>
		mappenpostenAus({ nummer: '1', titel: 'Neu' }, EINFACH, M, { neuAnZweiter: true, wahl })!;

	it('rechnet die Beschlussfähigkeit einer ersten mit den Zahlen des Kerns', () => {
		const b = mappe([neu('erste')], { ersteVersammlung: null, neuAnZweiterWahl: 'erste' });
		// Drei Eigentümer: die Hälfte aufgerundet, mindestens zwei; 500 von 1000 Wertquoten.
		expect(zeile(b, 'Mindestens nötig (Eigentümer, von 3)')[3]).toMatchObject({ art: 'zahl', wert: 2 });
		expect(zeile(b, 'Mindestens nötig (Wertquoten, von 1000)')[3]).toMatchObject({ art: 'zahl', wert: 500 });
		expect(formel(zeile(b, 'Eigentümer anwesend oder vertreten')[3])).toMatch(/^COUNTIF\(\$D\$/);
	});

	it('nach «erste» ist das Traktandum ohne sie nicht verbindlich, der Vergleich schon', () => {
		const b = mappe([neu('erste')], { ersteVersammlung: null, neuAnZweiterWahl: 'erste' });
		const ergebnis = zeile(b, 'Ergebnis');
		expect(formel(ergebnis[4])).toContain('NICHT VERBINDLICH');
		expect(formel(ergebnis[5])).not.toContain('NICHT VERBINDLICH');
		expect(zeile(b, 'Neu an der zweiten Versammlung')[4]).toMatchObject({ wert: 'ja, siehe unten' });
		expect(texte(b)).toContain('Ihre Gemeinschaft lässt über das Traktandum nur dann verbindlich abstimmen');
		expect(texte(b)).toContain('ZGB Art. 712s Abs. 1');
	});

	it('nach «drittel» umgekehrt', () => {
		const b = mappe([neu('drittel')], { ersteVersammlung: null, neuAnZweiterWahl: 'drittel' });
		const ergebnis = zeile(b, 'Ergebnis');
		expect(formel(ergebnis[4])).not.toContain('NICHT VERBINDLICH');
		expect(formel(ergebnis[5])).toContain('NICHT VERBINDLICH');
		expect(texte(b)).toContain('Ob das genügt, ist nicht geklärt');
		// F4a, T3 (Entscheid 0039): nicht nur anfechtbar, unter Umständen nichtig, mit Erklärung.
		expect(texte(b)).toContain('angefochten werden könnte, unter Umständen sogar nichtig wäre');
		expect(texte(b)).toContain('Nichtig heisst: ungültig auch ohne Anfechtung');
	});

	it('kommt immer in die Mappe und verlangt die Regel der ersten', () => {
		expect(brauchtRechnung(neu('drittel'), false)).toBe(true);
		expect(() => mappe([neu('erste')])).toThrow(/Regel der ersten/);
	});
});

describe('Aus A2: Beklagter und gemeinsame Wohnung', () => {
	const klage = mappenpostenAus({ nummer: '1', titel: 'Klage' }, KLAGE, M, OHNE_L5)!;

	it('gibt der gemeinsamen Wohnung des Beklagten die 7 statt leer', () => {
		const b = mappe([klage]);
		const zeilen = b.zeilen.filter((z) => z.some((c) => c.art === 'text' && c.wert.includes('Wohnung, die dem Beklagten mit anderen gehört')));
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0][4]).toMatchObject({ wert: '7' });
		expect(texte(b)).not.toContain('gemeinsame Wohnung des Beklagten: leer');
	});

	it('nennt den Beklagten in der Zeile der Wertquoten, die nicht zählen', () => {
		const b = mappe([{ ...klage, quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }]);
		expect(() => zeile(b, 'Wertquoten im Ausstand oder der Betroffenen (9, 7)')).not.toThrow();
		expect(formel(zeile(b, 'Erfordernis überhaupt noch erreichbar?')[4])).toContain('im Ausstand oder bei Betroffenen');
	});
});
