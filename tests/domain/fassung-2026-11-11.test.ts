/**
 * Fassung 2026-11-11 (Auftrag E2; Entscheid 0046, A7): der Einwand einer im
 * Saal eingewendeten, nicht hinterlegten strengeren Bestimmung. Kriterien 7 bis
 * 10 in `.auftraege/2026-11-11-votum-e2-kriterien.md` (Arbeitsverzeichnis).
 *
 * Geprüft: Die Fassung ändert keinen Knoten und kein Erfordernis; der Kasten an
 * allen Karten mit vereinbarter Ordnung und die Absage an der erweiterten
 * Bewirtschaftung tragen die neuen Sätze, die Vorfassung behält ihre.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, alleFassungen, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten } from '$lib/domain/regelwerk';
import {
	EINWAND_ABGELEHNT_FESTHALTEN,
	EINWAND_IM_SAAL,
	EINWAND_STRENGER_AB,
	NOTWENDIGE_MASSNAHME_KNOTEN,
	einwandStrengerAb,
	erfordernisAusKnoten,
	ergebniskarte
} from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { karteMitReglement, wendeReglementAn } from '$lib/domain/reglement';
import { VON_HAND_GRUND_EINWAND, VON_HAND_TITEL } from '$lib/domain/vonhand';

const NEU = holeRegelwerk('2026-11-11');
const VOR = holeRegelwerk('2026-11-10');

const ALTER_SATZ =
	'Wird im Saal eine Bestimmung eingewendet, die nicht hinterlegt ist, zählen Sie nach dem Gesetz und halten den Einwand im Protokoll fest.';
const UNKLARE_EINFUEHRUNG = 'oder eine, deren Einführung sich nicht feststellen lässt, entscheiden Sie';

function knoten(rw: ReturnType<typeof holeRegelwerk>, id: string): Ergebnisknoten {
	const k = rw.knoten.find((x) => x.id === id);
	if (!k) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return k;
}

/** Die Karte ohne hinterlegte Regel, wie die Seite sie zeigt. */
function karteOhneRegel(rw: ReturnType<typeof holeRegelwerk>, k: Ergebnisknoten) {
	return karteMitReglement(ergebniskarte(rw, k), null, null, null, null, undefined, erfordernisAusKnoten(rw, k));
}
function kastenOhneRegel(rw: ReturnType<typeof holeRegelwerk>, k: Ergebnisknoten): string {
	return karteOhneRegel(rw, k).reglementsvorbehalt;
}
const DREI_DINGE = 'Halten Sie sie nur ein, wenn drei Dinge feststehen.';
const VERWEIS = 'steht im Abschnitt «Wird im Saal eine Bestimmung eingewendet»';

const VEREINBART = NEU.knoten.filter((k) => k.reglementsverhalten === 'vereinbart');

describe('Fassung 2026-11-11', () => {
	it('ist seit Block B (Entscheid 0048) nicht mehr die aktuelle und in sich stimmig', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-21');
		expect(EINWAND_STRENGER_AB).toBe('2026-11-11');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
	});

	it('ändert keinen Knoten, keine Frage und kein Erfordernis (Kriterium 10)', () => {
		expect(JSON.stringify(NEU.knoten)).toBe(JSON.stringify(VOR.knoten));
		expect(JSON.stringify(NEU.fragen)).toBe(JSON.stringify(VOR.fragen));
		expect(JSON.stringify(NEU.aeste)).toBe(JSON.stringify(VOR.aeste));
		for (const k of NEU.knoten) {
			const { fassung: _neu, ...neu } = erfordernisAusKnoten(NEU, k);
			const { fassung: _vor, ...vor } = erfordernisAusKnoten(VOR, knoten(VOR, k.id));
			expect(neu, k.id).toEqual(vor);
		}
	});

	it('gilt nur ab der Kennung, nicht für Sonderfassungen', () => {
		expect(einwandStrengerAb('2026-11-11')).toBe(true);
		expect(einwandStrengerAb('2026-12-01')).toBe(true);
		expect(einwandStrengerAb('2026-11-10')).toBe(false);
		expect(einwandStrengerAb('ordnungsantrag-2026-08-05')).toBe(false);
		expect(einwandStrengerAb(undefined)).toBe(false);
	});

	it('trägt sechs Karten mit vereinbarter Ordnung', () => {
		expect(VEREINBART.map((k) => k.id).sort()).toEqual([
			'k-baulich-notwendig',
			'k-baulich-nuetzlich',
			'k-benutzungsweise',
			'k-bewirtschaftung-erweitert',
			'k-verwaltung-wichtig',
			'k-zweckbestimmung'
		]);
	});

	it('eigener Abschnitt: einhalten, abgelehnt über den Grund, sonst das Gesetz (Kriterium 7)', () => {
		for (const k of VEREINBART) {
			const karte = karteOhneRegel(NEU, k);
			expect(karte.einwandImSaal, k.id).toContain(DREI_DINGE);
			expect(karte.einwandImSaal, k.id).toContain(EINWAND_ABGELEHNT_FESTHALTEN);
			expect(karte.einwandImSaal, k.id).toMatch(/die Versammlung stimmt darüber nicht ab/);
			expect(karte.einwandImSaal, k.id).toMatch(/Steht eines der drei nicht fest, bleibt es beim Ergebnis nach dem Gesetz/);
			expect(karte.einwandImSaal, k.id).toMatch(/wenn die Anfechtungsfrist für alle abgelaufen ist, ausser es eilt/);
			expect(karte.einwandImSaal, k.id).toMatch(/Ist ein Gesuch eingegangen, vollziehen Sie nur, was eilt, bis das Verfahren abgeschlossen ist/);
			expect(karte.reglementsvorbehalt, k.id).toContain(VERWEIS);
			expect(karte.reglementsvorbehalt, k.id).not.toContain(ALTER_SATZ);
			// Kein Weg «nicht abstimmen» (V1, R7-F-1).
			expect(`${karte.reglementsvorbehalt} ${karte.einwandImSaal}`, k.id).not.toMatch(/stimmen Sie heute nicht/);
		}
	});

	it('die Zustimmung aller nur dort ausgenommen, wo Votum sie auch hinterlegt nicht anwendet, je Karte belegt (F-1, R2-F-2)', () => {
		const ohne = (id: string) => karteOhneRegel(NEU, knoten(NEU, id)).einwandImSaal ?? '';
		expect(ohne('k-baulich-notwendig')).toContain('Rz. 125 ad Art. 712a');
		expect(ohne('k-baulich-nuetzlich')).toMatch(/ist umstritten \(SVIT-Kommentar Rz\. 130 ad Art\. 712a/);
		for (const id of ['k-benutzungsweise', 'k-verwaltung-wichtig']) {
			expect(ohne(id), id).toMatch(/nur ausnahmsweise verlangen \(Rz\. 196 ad Art\. 712m\)/);
		}
		for (const id of ['k-baulich-notwendig', 'k-baulich-nuetzlich', 'k-benutzungsweise', 'k-verwaltung-wichtig']) {
			expect(ohne(id), id).toMatch(/Verlangt sie die Zustimmung aller, halten Sie sie nicht ein\./);
		}
		for (const id of ['k-zweckbestimmung', 'k-bewirtschaftung-erweitert']) {
			expect(ohne(id), id).not.toMatch(/Verlangt sie die Zustimmung aller/);
		}
	});

	it('strenger heisst nirgends weniger, auch bei der Bezugsgrösse; Grundbuchvermerk genügt nicht (R2-F-1, R2-F-3)', () => {
		const t = karteOhneRegel(NEU, knoten(NEU, 'k-baulich-notwendig')).einwandImSaal ?? '';
		expect(t).toMatch(/nirgends weniger, weder bei den Köpfen noch bei den Wertquoten noch bei der Zahl/);
		expect(t).toMatch(/«zwei Drittel der abgegebenen Stimmen» keine Enthaltungen/);
		expect(t).toMatch(/der Vermerk «im Grundbuch angemerkt» genügt nicht/);
	});

	it('an der notwendigen Massnahme: hinterlegen nur, wenn die Einführung feststeht (F-6)', () => {
		expect(kastenOhneRegel(NEU, knoten(NEU, NOTWENDIGE_MASSNAHME_KNOTEN))).toMatch(/hält eine Ablehnung aber den Unterhalt auf/);
		expect(kastenOhneRegel(NEU, knoten(NEU, 'k-baulich-nuetzlich'))).not.toMatch(/den Unterhalt auf/);
	});

	it('nennt Knopf und Grund mit dem Wortlaut der Maske', () => {
		expect(EINWAND_ABGELEHNT_FESTHALTEN).toContain(`«${VON_HAND_TITEL}»`);
		expect(VON_HAND_GRUND_EINWAND.startsWith('Eingewendete Bestimmung')).toBe(true);
		expect(EINWAND_ABGELEHNT_FESTHALTEN).toContain('«Eingewendete Bestimmung»');
	});

	it('Kasten ohne Regel und k-baulich-notwendig: die unklare Einführung (Kriterium 8)', () => {
		for (const k of VEREINBART) {
			expect(kastenOhneRegel(NEU, k), k.id).toContain(UNKLARE_EINFUEHRUNG);
			expect(kastenOhneRegel(NEU, k), k.id).toContain('Sicherer ist, eine strengere zu hinterlegen');
		}
		// An `nur_mildern` bleibt die alte Wahl: Dort wendet Votum keine strengere an.
		for (const k of NEU.knoten.filter((x) => x.reglementsverhalten === 'nur_mildern' && x.reglementsrecht)) {
			expect(kastenOhneRegel(NEU, k), k.id).not.toContain('Sicherer ist, eine strengere');
		}
	});

	it('die Vorfassung behält ihren Wortlaut (Kriterium 10)', () => {
		for (const k of VOR.knoten.filter((x) => x.reglementsverhalten === 'vereinbart')) {
			const kasten = kastenOhneRegel(VOR, k);
			expect(kasten, k.id).toContain(ALTER_SATZ);
			expect(kasten, k.id).not.toContain(VERWEIS);
			expect(kasten, k.id).not.toContain(UNKLARE_EINFUEHRUNG);
			expect(karteOhneRegel(VOR, k).einwandImSaal, k.id).toBeUndefined();
		}
	});

	it('unter einer angewandten Regel kein Abschnitt zum Einwand (Codeprüfung M1)', () => {
		const k = knoten(NEU, 'k-baulich-nuetzlich');
		const erfordernis = erfordernisAusKnoten(NEU, k);
		const regel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: k.geschaeftsart,
			fundstelle: 'Reglement Art. 9',
			kopfbasis: erfordernis.kopfbasis,
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			quotenbasis: erfordernis.quotenbasis,
			quotenSchwelle: erfordernis.quotenSchwelle,
			enthaltungZaehltMit: true
		} as unknown as Parameters<typeof wendeReglementAn>[1][number];
		const a = wendeReglementAn(erfordernis, [regel], null, LESARTEN_VORGABE);
		expect(a.vorbehalt).toBeNull();
		expect(a.regel).not.toBeNull();
		const karte = karteMitReglement(ergebniskarte(NEU, k), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(karte.einwandImSaal).toBeUndefined();
	});

	it('keine Fassung vor 2026-11-11 trägt an irgendeiner Karte einen neuen Satz (Kriterium 10, Featureprüfung)', () => {
		const neueSaetze = [VERWEIS, UNKLARE_EINFUEHRUNG, DREI_DINGE, EINWAND_ABGELEHNT_FESTHALTEN, 'brauchen Sie für das Zählen nach dem Gesetz'];
		let karten = 0;
		for (const rw of alleFassungen().filter((r) => r.fassung < EINWAND_STRENGER_AB)) {
			for (const k of rw.knoten) {
				const karte = karteOhneRegel(rw, k);
				karten += 1;
				expect(karte.einwandImSaal, `${rw.fassung} ${k.id}`).toBeUndefined();
				for (const satz of neueSaetze) expect(karte.reglementsvorbehalt, `${rw.fassung} ${k.id}`).not.toContain(satz);
			}
		}
		expect(karten).toBeGreaterThan(1000);
	});

	describe('Absage an k-bewirtschaftung-erweitert (Kriterium 9)', () => {
		function absage(rw: ReturnType<typeof holeRegelwerk>) {
			const k = knoten(rw, 'k-bewirtschaftung-erweitert');
			const erfordernis = erfordernisAusKnoten(rw, k);
			const regel = {
				id: 'r1',
				stwegId: 's1',
				geschaeftsart: 'organe',
				fundstelle: 'Reglement Ziff. 21',
				kopfbasis: erfordernis.kopfbasis,
				kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
				quotenbasis: erfordernis.quotenbasis,
				quotenSchwelle: erfordernis.quotenSchwelle,
				enthaltungZaehltMit: true
			} as unknown as Parameters<typeof wendeReglementAn>[1][number];
			const a = wendeReglementAn(erfordernis, [regel], null, LESARTEN_VORGABE);
			expect(a.vorbehalt).toBe('nur_fallgenau');
			return karteMitReglement(ergebniskarte(rw, k), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		}

		it('nennt denselben Weg wie der Kasten, mit der Erweiterung als Gegenstand (F-11)', () => {
			const karte = absage(NEU);
			expect(karte.reglementsvorbehalt).toMatch(/lesen Sie den Abschnitt «Wird im Saal eine Bestimmung eingewendet»/);
			expect(karte.reglementsvorbehalt).toMatch(/brauchen Sie für das Zählen nach dem Gesetz nicht nachzuforschen/);
			expect(karte.reglementsvorbehalt).not.toContain(EINWAND_IM_SAAL);
			expect(karte.einwandImSaal).toMatch(/Sie meint klar auch diese Erweiterung/);
			expect(karte.einwandImSaal).toContain(DREI_DINGE);
			expect(karte.einwandImSaal).toContain(EINWAND_ABGELEHNT_FESTHALTEN);
		});

		it('die Vorfassung sagt es wie bisher', () => {
			const karte = absage(VOR);
			expect(karte.reglementsvorbehalt).toContain(`${EINWAND_IM_SAAL} Den Beschluss vollziehen Sie dann`);
			expect(karte.reglementsvorbehalt).toContain('brauchen Sie dafür nicht nachzuforschen');
			expect(karte.einwandImSaal).toBeUndefined();
		});
	});
});
