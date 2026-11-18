/**
 * Fassung 2026-11-20 (Auftrag «Bezahlung aus dem Erneuerungsfonds im
 * Quorenfinder», 15.11.2026, mit den Produktentscheiden vom 17.11.2026): die
 * Bezahlung einer Arbeit aus dem Fonds als eigener Fall mit eigenem Mehr, nach
 * der Vorgabe streng, mit der Lesart L17 nach dem SVIT-Kommentar. Die Nummern
 * in den Titeln sind die Akzeptanzkriterien des Auftrags. Die Lesart selbst
 * (Katalog, Freigabe, Datenbank) prüfen `lesart-fondsentnahme.test.ts` und
 * `tests/db/lesart-fondsentnahme.test.ts`; das Signet der Website
 * `regelwerksfassungen.test.ts` und der Export.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, alleFassungen, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, knotenNachLesart, pruefeLesartenImRegelwerk, type Lesartenwahl } from '$lib/domain/lesarten';
import { wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import { ENTNAHME as ENTNAHME_VORHER, VERWENDUNG_HILFE as VERWENDUNG_HILFE_VORHER } from '$lib/rules/quorum-2026-11-18';
import {
	ANTWORT_ARBEIT_TEXT,
	ANTWORT_BEZAHLUNG_TEXT,
	AUSSERHALB_ID,
	ENTNAHME,
	ENTNAHME_ID,
	FRAGE_BESCHLUSS_ID,
	FRAGE_ZWECK_ID,
	KARTEN_MIT_ENTNAHME,
	OHNE_FONDS,
	TITEL_ENTNAHME,
	TITEL_VEREINBART,
	VEREINBART_ID,
	VEREINBART_SVIT_WEG,
	VERWENDUNG_HILFE,
	VERWENDUNG_TEXT,
	ZWECK
} from '$lib/rules/quorum-2026-11-20';

const NEU = holeRegelwerk('2026-11-20');
const VOR = holeRegelwerk('2026-11-19');
const SVIT = { ...LESARTEN_VORGABE, L17: 'svit' } as Lesartenwahl;

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;
const erfordernis = (id: string) => erfordernisAusKnoten(NEU, knoten(NEU, id));

/** Der Weg durch den Ast «Geld» nach Antwortkennungen, bis zu einer Frage oder einem Knoten. */
function ziel(rw: Regelwerk, antworten: string[]): string {
	let z = rw.aeste.find((a) => a.id === 'a-geld')!.einstieg;
	for (const id of antworten) {
		const frage = rw.fragen.find((f) => f.id === z);
		expect(frage, `vor «${id}» steht keine Frage, sondern «${z}»`).toBeDefined();
		const antwort = frage!.antworten.find((a) => a.id === id);
		expect(antwort, `«${frage!.id}» kennt «${id}» nicht`).toBeDefined();
		z = antwort!.ziel;
	}
	return z;
}

const BEZAHLUNG = ['f4-1-verwendung', 'f4-1-verwendung-bezahlung'];

/** Eine Regel der Gemeinschaft (erfunden): einfaches Mehr der Köpfe, für genau diesen Fall. */
function regel(u: Partial<Reglementsregel>): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'verwaltung_wichtig',
		knotenId: ENTNAHME_ID,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		fundstelle: 'Errichtungsbeschluss Ziff. 9 (erfunden)',
		enthaltungZaehltMit: true,
		...u
	};
}
/** Zwei Drittel der Köpfe und die Hälfte der Wertquoten: strenger als das qualifizierte Mehr. */
const STRENGER = {
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const },
	quotenbasis: 'alle_quoten' as const,
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const }
};

describe('Fassung 2026-11-20', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-24');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-20');
	});

	it('1: führt die Bezahlung als eigenen Fall, getrennt vom Mehr der Arbeit', () => {
		expect(ziel(NEU, ['f4-1-verwendung'])).toBe(FRAGE_BESCHLUSS_ID);
		// Die Arbeit bleibt beim Mehr des Vorhabens.
		expect(ziel(NEU, ['f4-1-verwendung', 'f4-1-verwendung-arbeit'])).toBe('f1-0');
		expect(ziel(NEU, BEZAHLUNG)).toBe(FRAGE_ZWECK_ID);
		expect(ziel(NEU, [...BEZAHLUNG, 'f4-1-zweck-ja'])).toBe(ENTNAHME_ID);
		expect(ziel(NEU, [...BEZAHLUNG, 'f4-1-zweck-vereinbart'])).toBe(VEREINBART_ID);
		expect(ziel(NEU, [...BEZAHLUNG, 'f4-1-zweck-nein'])).toBe(AUSSERHALB_ID);
		const antworten = NEU.fragen.find((f) => f.id === FRAGE_BESCHLUSS_ID)!.antworten.map((a) => a.text);
		expect(antworten).toEqual([ANTWORT_ARBEIT_TEXT, ANTWORT_BEZAHLUNG_TEXT]);
		const e = erfordernis(ENTNAHME_ID);
		expect(e.knotenId).toBe(ENTNAHME_ID);
		expect(e.titel).toBe(TITEL_ENTNAHME);
		// Der gemeinsame Antrag: beide Mehr, sonst abgelehnt.
		expect(knoten(NEU, ENTNAHME_ID).hinweise!.join(' ')).toMatch(/das Mehr der Arbeit und das Mehr der Bezahlung erreichen, sonst ist er abgelehnt/);
	});

	it('2: rechnet ohne Regel nach der Vorgabe das qualifizierte Mehr, mit L17 das einfache, und zeigt auf der Website das Signet', () => {
		const k = knoten(NEU, ENTNAHME_ID);
		expect(k.typ).toBe('qualifiziertes_mehr');
		expect(k.quotenbasis).toBe('alle_quoten');
		expect(k.lesart?.kennung).toBe('L17');
		expect(k.hinweise!.join(' ')).toContain('Rz. 139 ad Art. 712l');
		expect(k.hinweise!.join(' ')).toMatch(/einfache Mehr nach Köpfen/);
		const streng = wendeReglementAn(erfordernis(ENTNAHME_ID), [], null, LESARTEN_VORGABE);
		expect(streng.erfordernis.typ).toBe('qualifiziertes_mehr');
		const svit = wendeReglementAn(erfordernis(ENTNAHME_ID), [], null, SVIT);
		expect(svit.erfordernis.typ).toBe('einfaches_mehr');
		expect(svit.erfordernis.quotenbasis).toBe('keine');
		// Das Signet hängt an der Liste im Export.
		const exportSkript = readFileSync('scripts/quorumsbaum-export.mjs', 'utf8');
		const liste = exportSkript.slice(
			exportSkript.indexOf('const STREITFRAGEN_LESART_STRENG = new Set(['),
			exportSkript.indexOf('for (const id of STREITFRAGEN_LESART_STRENG)')
		);
		expect(liste).toContain('FONDS_ENTNAHME_ID,');
		expect(liste).toContain('FONDS_VEREINBART_ID');
	});

	it('3: rechnet ausserhalb des Zwecks die Zustimmung aller, nach beiden Auffassungen, und eine Regel senkt sie nicht', () => {
		const k = knoten(NEU, AUSSERHALB_ID);
		expect(k.typ).toBe('einstimmigkeit');
		expect(k.kopfbasis).toBe('alle_eigentuemer');
		expect(k.lesart).toBeUndefined();
		expect(k.einstimmigkeitsweg?.startsWith(OHNE_FONDS)).toBe(true);
		for (const wahl of [LESARTEN_VORGABE, SVIT]) {
			const a = wendeReglementAn(erfordernis(AUSSERHALB_ID), [regel({ knotenId: AUSSERHALB_ID })], null, wahl);
			expect(a.erfordernis.typ).toBe('einstimmigkeit');
			expect(a.vorbehalt).not.toBeNull();
		}
		// Die vereinbarte Verwendung: nach der Vorgabe alle (Bloch), mit L17 das Mehr im Zweck.
		const v = knoten(NEU, VEREINBART_ID);
		expect(v.typ).toBe('einstimmigkeit');
		expect(v.lesart?.kennung).toBe('L17');
		expect(wendeReglementAn(erfordernis(VEREINBART_ID), [], null, LESARTEN_VORGABE).erfordernis.typ).toBe('einstimmigkeit');
		expect(wendeReglementAn(erfordernis(VEREINBART_ID), [], null, SVIT).erfordernis.typ).toBe('einfaches_mehr');
		// Codeprüfung, Befund 1: Unter `svit` steht nicht der Weg zur Zustimmung aller da.
		expect(knotenNachLesart(NEU, v, LESARTEN_VORGABE).einstimmigkeitsweg?.startsWith(OHNE_FONDS)).toBe(true);
		expect(knotenNachLesart(NEU, v, SVIT).einstimmigkeitsweg).toBe(VEREINBART_SVIT_WEG);
	});

	it('4: wendet eine hinterlegte Regel an, nach der Vorgabe nur eine strengere, mit L17 eine für genau diesen Fall', () => {
		const e = erfordernis(ENTNAHME_ID);
		// Vorgabe: eine strengere gilt, fallgenau wie allgemein; eine mildere nicht.
		for (const knotenId of [ENTNAHME_ID, null]) {
			const a = wendeReglementAn(e, [regel({ ...STRENGER, knotenId })], null, LESARTEN_VORGABE);
			expect(a.vorbehalt, String(knotenId)).toBeNull();
			expect(a.regel?.id, String(knotenId)).toBe('r1');
			expect(a.erfordernis.kopfSchwelle).toEqual(STRENGER.kopfSchwelle);
		}
		const milderStreng = wendeReglementAn(e, [regel({})], null, LESARTEN_VORGABE);
		expect(milderStreng.vorbehalt).not.toBeNull();
		expect(milderStreng.erfordernis.typ).toBe('qualifiziertes_mehr');
		// L17 nach dem SVIT-Kommentar: die fallgenaue gilt, auch milder; die allgemeine nicht.
		const milderSvit = wendeReglementAn(e, [regel({})], null, SVIT);
		expect(milderSvit.vorbehalt).toBeNull();
		expect(milderSvit.regel?.id).toBe('r1');
		const allgemeinSvit = wendeReglementAn(e, [regel({ ...STRENGER, knotenId: null })], null, SVIT);
		expect(allgemeinSvit.vorbehalt).toBe('nur_fallgenau');
		expect(allgemeinSvit.erfordernis.typ).toBe('einfaches_mehr');
		// An der wichtigeren Verwaltungshandlung wirkt eine allgemeine Regel wie bisher.
		const wichtig = wendeReglementAn(
			erfordernisAusKnoten(NEU, knoten(NEU, 'k-verwaltung-wichtig')),
			[regel({ knotenId: null })],
			null,
			LESARTEN_VORGABE
		);
		expect(wichtig.vorbehalt).toBeNull();
		expect(wichtig.regel?.id).toBe('r1');
	});

	it('5: Hilfe und Hinweis zur Entnahme sagen dasselbe wie die Karte und verweisen auf sie', () => {
		const verwendung = NEU.fragen.find((f) => f.id === 'f4-1')!.antworten.find((a) => a.id === 'f4-1-verwendung')!;
		expect(verwendung.text).toBe(VERWENDUNG_TEXT);
		expect(verwendung.hilfe).toBe(VERWENDUNG_HILFE);
		expect(verwendung.hilfe).toMatch(/zweiter Beschluss mit eigenem Mehr/);
		expect(verwendung.hilfe).not.toMatch(/nicht zum Mehr der Bezahlung/);
		// Featureprüfung, Prüfer B: inhaltlich, nicht nur gegen die eigene Konstante. Die Hilfe
		// verweist auf die nächste Frage, und die führt zu beiden Beschlüssen.
		expect(verwendung.hilfe).toMatch(/Die nächste Frage führt zu beiden\./);
		const naechste = NEU.fragen.find((f) => f.id === verwendung.ziel)!;
		expect(naechste.antworten.map((x) => x.text)).toEqual([ANTWORT_ARBEIT_TEXT, ANTWORT_BEZAHLUNG_TEXT]);
		for (const id of KARTEN_MIT_ENTNAHME) {
			const hinweise = knoten(NEU, id).hinweise ?? [];
			expect(hinweise, id).toContain(ENTNAHME);
			expect(hinweise, id).not.toContain(ENTNAHME_VORHER);
		}
		expect(ENTNAHME).toContain(`«${TITEL_ENTNAHME}»`);
		expect(ENTNAHME).toContain(`«${VERWENDUNG_TEXT}»`);
		expect(ENTNAHME).toMatch(/das qualifizierte Mehr erreicht\. Ausserhalb des Zwecks braucht sie die Zustimmung aller/);
		// Ein Wortlaut für den Zweck an Frage und Karten (Laienprüfung L-1).
		expect(NEU.fragen.find((f) => f.id === FRAGE_ZWECK_ID)!.hilfe!.startsWith(ZWECK)).toBe(true);
		for (const id of [ENTNAHME_ID, VEREINBART_ID]) expect(knoten(NEU, id).hinweise, id).toContain(ZWECK);
		// Kein Verweis ins Leere.
		for (const titel of [TITEL_ENTNAHME, TITEL_VEREINBART]) expect(NEU.knoten.some((k) => k.titel === titel), titel).toBe(true);
		expect(knoten(NEU, AUSSERHALB_ID).reglementsrecht).toContain(`«${TITEL_VEREINBART}»`);
		expect(NEU.fragen.some((f) => f.antworten.some((a) => a.text === ANTWORT_ARBEIT_TEXT))).toBe(true);
	});

	it('6: lässt die Vorfassungen unverändert', () => {
		const vorher = VOR.fragen.find((f) => f.id === 'f4-1')!.antworten.find((a) => a.id === 'f4-1-verwendung')!;
		expect(vorher.ziel).toBe('f1-0');
		expect(vorher.hilfe).toBe(VERWENDUNG_HILFE_VORHER);
		const neu = [ENTNAHME_ID, VEREINBART_ID, AUSSERHALB_ID, FRAGE_BESCHLUSS_ID, FRAGE_ZWECK_ID];
		// Nur die Fassungen davor; die späteren leiten sich von dieser ab und tragen die Karten weiter.
		for (const rw of alleFassungen().filter((r) => r.fassung < '2026-11-20')) {
			expect([...rw.knoten, ...rw.fragen].some((x) => neu.includes(x.id)), rw.fassung).toBe(false);
		}
		for (const id of KARTEN_MIT_ENTNAHME) expect(knoten(VOR, id).hinweise, id).toContain(ENTNAHME_VORHER);
		// Ausser den neuen und den fünf geänderten Stellen ist alles wie in der Vorfassung.
		const geaendert = new Set<string>([...KARTEN_MIT_ENTNAHME, 'f4-1']);
		for (const k of VOR.knoten) if (!geaendert.has(k.id)) expect(knoten(NEU, k.id), k.id).toStrictEqual(k);
		for (const f of VOR.fragen) if (!geaendert.has(f.id)) expect(NEU.fragen.find((x) => x.id === f.id), f.id).toStrictEqual(f);
	});
});
