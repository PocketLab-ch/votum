/**
 * Fassung 2026-11-04 (F4a): Fundstellen statt «offen», und der sichere Weg.
 *
 * Geprüft an der aktuellen Fassung: je geänderter Karte steht der neue Satz da
 * und der alte nicht (S1 bis S8, S14 der Prüfdatei
 * `quellen/pruefung/zu-pruefen-2026-11-04-votum-f4a-saetze.md`), und am
 * Erfordernis ändert sich nichts: Typ und Bezugsgrössen jedes Knotens wie in
 * 2026-11-03.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import {
	AUSSCHLUSS_REGLEMENTSHINWEIS,
	BETROFFEN_IST,
	DELEGATION_RZ_115,
	BETROFFEN_BEITRAEGE,
	EIGENE_SCHRANKE_LEHRE,
	EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER,
	EINSPRACHE_BETROFFENE_ANWENDUNG,
	EINSPRACHE_BETROFFENE_WEBSITE,
	EINSPRACHE_SEITE,
	EINSPRACHE_VOLLMACHTEN,
	ERMAECHTIGUNG_VORHER,
	KLAEGER,
	REGLEMENT_DARF_AENDERN,
	REGLEMENT_DARF_AENDERN_WEBSITE,
	UEBERGANG_OHNE_ZUSTIMMUNG,
	UEBERTRAGUNG_EINFACHES_MEHR,
	WARUM_EINSTIMMIG,
	WERKZEUG_PRUEFT_EINFUEHRUNG_NICHT,
	WERTQUOTEN_ALLE
} from '$lib/rules/quorum-2026-11-04';
import { KLAEGER as KLAEGER_VORHER } from '$lib/rules/quorum-2026-11-03';
import { WARUM_EINSTIMMIG as WARUM_EINSTIMMIG_VORHER } from '$lib/rules/quorum-2026-10-27';
import { EINSPRACHE_BETROFFENE_ANWENDUNG as EINSPRACHE_VORHER } from '$lib/rules/quorum-2026-10-20';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, ergebniskarte } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { karteMitReglement, wendeReglementAn } from '$lib/domain/reglement';

const NEU = holeRegelwerk('2026-11-04');
const VOR = holeRegelwerk('2026-11-03');

function knoten(rw: Regelwerk, id: string): Ergebnisknoten {
	const gefunden = rw.knoten.find((k) => k.id === id);
	if (!gefunden) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

/** Alles, was ein Knoten an Text trägt, in einem Text. */
function alles(k: Ergebnisknoten): string {
	return JSON.stringify(k);
}

/** Die Karte unter einer angewandten Regel: das Gesetz, als Regel hinterlegt (wie `fassung-2026-11-03.test.ts`). */
function karteUnterRegel(rw: Regelwerk, id: string) {
	const k = knoten(rw, id);
	const erfordernis = erfordernisAusKnoten(rw, k);
	const regel = {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: k.geschaeftsart,
		fundstelle: 'Reglement Ziff. 11',
		kopfbasis: erfordernis.kopfbasis,
		kopfSchwelle: erfordernis.kopfSchwelle ?? { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
		quotenbasis: erfordernis.quotenbasis,
		quotenSchwelle: erfordernis.quotenSchwelle,
		enthaltungZaehltMit: erfordernis.enthaltungZaehltMit ?? true
	};
	const a = wendeReglementAn(erfordernis, [regel as Parameters<typeof wendeReglementAn>[1][number]], null, LESARTEN_VORGABE);
	expect(a.vorbehalt, id).toBeNull();
	return karteMitReglement(ergebniskarte(rw, k), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
}

/** Was die Karte unter der Regel zeigt, oben und unter «Zum gesetzlichen Erfordernis». */
function sichtbar(karte: ReturnType<typeof karteUnterRegel>): string {
	return [karte.begruendung, ...karte.hinweise, ...(karte.zumGesetz?.hinweise ?? [])].join('\n');
}

describe('Fassung 2026-11-04', () => {
	it('ist seit F4c nicht mehr die aktuelle Fassung und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(NEU.fassung).toBe('2026-11-04');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('nennen die Karten Fundstellen statt «offen»');
		expect(NEU.freigabevermerk.endsWith('Am Erfordernis ändert sich nichts.')).toBe(true);
	});

	it('ändert am Erfordernis nichts: Typ, Bezugsgrössen und Verhalten jedes Knotens wie in 2026-11-03', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const n of NEU.knoten) {
			const v = knoten(VOR, n.id);
			expect(n.typ, n.id).toBe(v.typ);
			expect(n.kopfbasis, n.id).toBe(v.kopfbasis);
			expect(n.quotenbasis, n.id).toBe(v.quotenbasis);
			expect(n.zustimmungBetroffenerNoetig, n.id).toBe(v.zustimmungBetroffenerNoetig);
			expect(n.reglementsverhalten, n.id).toBe(v.reglementsverhalten);
			expect(n.rang, n.id).toBe(v.rang);
			expect(n.gegenmeinung, n.id).toBe(v.gegenmeinung);
			expect({ ...erfordernisAusKnoten(NEU, n), fassung: '' }, n.id).toEqual({ ...erfordernisAusKnoten(VOR, v), fassung: '' });
		}
	});

	it('ändert nur die acht Karten, und an ihnen nur Begründung und Hinweise', () => {
		const geaendert = NEU.knoten.filter((n) => JSON.stringify(n) !== JSON.stringify(knoten(VOR, n.id))).map((n) => n.id);
		expect(geaendert.sort()).toEqual(
			[
				'k-ausschlussklage',
				'k-bewirtschaftung-erweitert',
				'k-bewirtschaftung-statt-versammlung',
				'k-einsprache',
				'k-reglement-eigene-schranke',
				'k-uebertragung-beschluss',
				'k-uebertragung-statt-versammlung',
				'k-wertquoten-aendern'
			].sort()
		);
		for (const id of geaendert) {
			const { hinweise: _h, hinweiseUnterRegel: _u, begruendung: _b, ...rest } = knoten(NEU, id);
			const { hinweise: _vh, hinweiseUnterRegel: _vu, begruendung: _vb, ...vorRest } = knoten(VOR, id);
			expect(rest, id).toEqual(vorRest);
		}
	});

	it('S1: Wertquoten aller Einheiten, die zwei Erfordernisse statt «Einstimmigkeit»', () => {
		const k = knoten(NEU, 'k-wertquoten-aendern');
		expect(k.hinweise).toContain(WERTQUOTEN_ALLE);
		expect(WERTQUOTEN_ALLE).toContain('(ZGB Art. 712e Abs. 2)');
		expect(WERTQUOTEN_ALLE).toContain('auch wer nicht an die Versammlung kommt');
		expect(WERTQUOTEN_ALLE).toContain('Rz. 75 und 78 bis 80 ad Art. 712e');
		expect(alles(k)).not.toContain('läuft die Bestimmung auf Einstimmigkeit hinaus');
		expect(alles(knoten(VOR, k.id))).toContain('läuft die Bestimmung auf Einstimmigkeit hinaus');
	});

	it('S2: der Beschluss vor der Klage, direkt nach dem Ausschluss durch das Gericht', () => {
		const hinweise = knoten(NEU, 'k-ausschlussklage').hinweise ?? [];
		const gericht = hinweise.findIndex((h) => h.startsWith('Der Ausschluss selbst spricht das Gericht aus'));
		expect(gericht).toBeGreaterThanOrEqual(0);
		expect(hinweise[gericht + 1]).toBe(ERMAECHTIGUNG_VORHER);
		expect(hinweise[gericht + 2]).toBe(KLAEGER);
		expect(ERMAECHTIGUNG_VORHER).toContain('Fassen Sie diesen Beschluss, bevor jemand klagt.');
		expect(ERMAECHTIGUNG_VORHER).toContain('Rz. 219a ad Art. 712a');
		expect(alles(knoten(VOR, 'k-ausschlussklage'))).not.toContain('bevor jemand klagt');
		// Unter jeder Regel, auch unter einer angewandten oben.
		expect(karteUnterRegel(NEU, 'k-ausschlussklage').hinweise).toContain(ERMAECHTIGUNG_VORHER);
	});

	it('S3 ohne Regel: an drei Stellen, der Satz zum Ändern, der Übergang und der sichere Weg am Ende', () => {
		const k = knoten(NEU, 'k-ausschlussklage');
		expect(k.hinweise).toContain(AUSSCHLUSS_REGLEMENTSHINWEIS);
		expect(AUSSCHLUSS_REGLEMENTSHINWEIS).toContain(REGLEMENT_DARF_AENDERN);
		expect(REGLEMENT_DARF_AENDERN).toBe(`${REGLEMENT_DARF_AENDERN_WEBSITE} ${WERKZEUG_PRUEFT_EINFUEHRUNG_NICHT}`);
		expect(AUSSCHLUSS_REGLEMENTSHINWEIS).toContain(`(BGE 143 III 537 E. 4.2.4). ${UEBERGANG_OHNE_ZUSTIMMUNG} Sicher bleibt`);
		expect(
			AUSSCHLUSS_REGLEMENTSHINWEIS.endsWith(
				`Sicher bleibt deshalb nur, beide Mehrheiten zu erreichen. ${EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER}`
			)
		).toBe(true);
		// Aus der Runde 1 fällt beides ganz weg (Endfassung).
		expect(alles(k)).not.toContain('Dieses Werkzeug folgt dem Wortlaut des Gesetzes');
		expect(alles(k)).not.toContain('am sichersten einstimmig');
		expect(alles(k)).not.toContain('Ob das Reglement dieses Mehr überhaupt ändern darf');
		expect(alles(knoten(VOR, k.id))).toContain('Ob das Reglement dieses Mehr überhaupt ändern darf, ist umstritten');
		expect(ergebniskarte(NEU, k).hinweise).toContain(AUSSCHLUSS_REGLEMENTSHINWEIS);
	});

	it('S3 unter der Regel: derselbe Wortlaut im Ersatz, ohne «ebenfalls umstritten»', () => {
		const k = knoten(NEU, 'k-ausschlussklage');
		const eintrag = (k.hinweiseUnterRegel ?? []).find((u) => u.hinweis === AUSSCHLUSS_REGLEMENTSHINWEIS);
		expect(eintrag?.ersatz).toBeDefined();
		expect(eintrag!.ersatz).toContain(REGLEMENT_DARF_AENDERN);
		expect(
			eintrag!.ersatz!.endsWith(
				`(BGE 143 III 537 E. 4.2.4). ${UEBERGANG_OHNE_ZUSTIMMUNG} ${EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER}`
			)
		).toBe(true);
		expect(eintrag!.ersatz).not.toContain('ist ebenfalls umstritten: Der Wortlaut');
		const text = sichtbar(karteUnterRegel(NEU, 'k-ausschlussklage'));
		expect(text).toContain(REGLEMENT_DARF_AENDERN);
		expect(text).not.toContain('Ob das Reglement dieses Mehr überhaupt ändern darf');
		expect(sichtbar(karteUnterRegel(VOR, 'k-ausschlussklage'))).toContain('ist ebenfalls umstritten: Der Wortlaut');
	});

	it('S4: wer betroffen ist, vor dem Rat zur Anwältin', () => {
		const k = knoten(NEU, 'k-ausschlussklage');
		expect(k.hinweise).toContain(KLAEGER);
		expect(k.hinweise).not.toContain(KLAEGER_VORHER);
		expect(KLAEGER).toContain(`${BETROFFEN_IST} ${BETROFFEN_BEITRAEGE} Wer betroffen ist, klären Sie im Zweifel`);
		expect(BETROFFEN_IST).toContain('(ZGB Art. 649b Abs. 1)');
		expect(KLAEGER_VORHER).not.toContain(BETROFFEN_IST);
	});

	it('S5: an der Einsprache auch keine Vollmachten, mit Fundstelle; die Begründung auf S. 63', () => {
		const k = knoten(NEU, 'k-einsprache');
		expect(k.hinweise).toContain(EINSPRACHE_BETROFFENE_ANWENDUNG);
		expect(k.hinweise).not.toContain(EINSPRACHE_VORHER);
		expect(EINSPRACHE_BETROFFENE_ANWENDUNG.startsWith(`${EINSPRACHE_VOLLMACHTEN} Votum zählt sie hier nicht.`)).toBe(true);
		expect(alles(k)).not.toContain('Ob er Vollmachten anderer ausüben darf, ist nicht geklärt');
		expect(EINSPRACHE_BETROFFENE_WEBSITE).not.toMatch(/Werkzeug|Votum|Sitzungsleitung/);
		expect(k.begruendung).toContain(`stimmt nicht mit ${EINSPRACHE_SEITE}.`);
		expect(k.begruendung).not.toContain('S. 64');
		expect(knoten(VOR, k.id).begruendung).toContain('(Handschin/Wyttenbach, S. 64)');
	});

	it('S6: an beiden Karten statt der Versammlung Rz. 44 als Frage und Rz. 45 als Antwort', () => {
		for (const id of ['k-bewirtschaftung-statt-versammlung', 'k-uebertragung-statt-versammlung']) {
			const k = knoten(NEU, id);
			expect(k.hinweise, id).toContain(WARUM_EINSTIMMIG);
			expect(k.hinweise, id).not.toContain(WARUM_EINSTIMMIG_VORHER);
			expect(knoten(VOR, id).hinweise, id).toContain(WARUM_EINSTIMMIG_VORHER);
		}
		expect(WARUM_EINSTIMMIG).toContain('stellt die Frage selbst (Rz. 44 ad Art. 712m)');
		expect(WARUM_EINSTIMMIG).toContain('als Meinung der Autoren');
		expect(WARUM_EINSTIMMIG).not.toContain('Rz. 44 f.');
		expect(WARUM_EINSTIMMIG).toContain('(ZGB Art. 712m Abs. 1 Ziff. 3 und Art. 712s)');
		expect(WARUM_EINSTIMMIG.endsWith('kein tieferes Mehr; deshalb rechnet Votum mit Einstimmigkeit.')).toBe(true);
	});

	it('S7: an der Übertragung das einfache Mehr für gesetzliche Aufgaben; unter einer Regel beim Gesetz', () => {
		const k = knoten(NEU, 'k-uebertragung-beschluss');
		expect(k.hinweise?.[0]).toBe(UEBERTRAGUNG_EINFACHES_MEHR);
		expect(alles(knoten(VOR, k.id))).not.toContain('Das einfache Mehr genügt, wenn');
		// Der Verweis zeigt auf eine Karte, die es gibt.
		expect(UEBERTRAGUNG_EINFACHES_MEHR).toContain(`«${knoten(NEU, 'k-uebertragung-statt-versammlung').titel}»`);
		expect(k.hinweiseUnterRegel).toEqual([{ hinweis: UEBERTRAGUNG_EINFACHES_MEHR, zumGesetz: true }]);
		const karte = karteUnterRegel(NEU, k.id);
		expect(karte.hinweise).not.toContain(UEBERTRAGUNG_EINFACHES_MEHR);
		expect(karte.zumGesetz?.hinweise ?? []).toContain(UEBERTRAGUNG_EINFACHES_MEHR);
	});

	it('S8: an der Erweiterung Rz. 115 als Gegenstimme, nach dem Satz zur gesperrten Delegation', () => {
		const hinweise = knoten(NEU, 'k-bewirtschaftung-erweitert').hinweise ?? [];
		const gesperrt = hinweise.findIndex((h) => h.startsWith('Bauliche Massnahmen und das Reglement lassen sich gar nicht'));
		expect(gesperrt).toBeGreaterThanOrEqual(0);
		expect(hinweise[gesperrt + 1]).toBe(DELEGATION_RZ_115);
		expect(alles(knoten(VOR, 'k-bewirtschaftung-erweitert'))).not.toContain('Der SVIT-Kommentar zieht eine engere Grenze');
		expect(DELEGATION_RZ_115).toContain('(ZGB Art. 647b Abs. 1)');
		expect(DELEGATION_RZ_115).toContain('Rz. 79 ad Art. 712s');
		// Runde 3, T4: «dieses Mehr» und «Danach rechnet Votum» gelten nur nach Gesetz.
		expect(knoten(NEU, 'k-bewirtschaftung-erweitert').hinweiseUnterRegel).toEqual([
			...(knoten(VOR, 'k-bewirtschaftung-erweitert').hinweiseUnterRegel ?? []),
			{ hinweis: DELEGATION_RZ_115, zumGesetz: true }
		]);
	});

	it('S14: der Meinungsstand nach BGer 5C.50/2004, der Rest des Hinweises bleibt', () => {
		const k = knoten(NEU, 'k-reglement-eigene-schranke');
		const streit = (k.hinweise ?? []).find((h) => h.startsWith('Zum Streit:'));
		expect(streit).toContain(EIGENE_SCHRANKE_LEHRE);
		expect(streit).not.toContain('Steinauer lässt sie zu; BGer');
		expect(streit).toContain('Ob Ihre Klausel deshalb bei einem Nebenpunkt nicht gilt, hat kein Gericht entschieden.');
		const vorher = (knoten(VOR, k.id).hinweise ?? []).find((h) => h.startsWith('Zum Streit:'))!;
		// Ab dem Satz zum qualifizierten Mehr derselbe Wortlaut.
		const ab = (t: string) => t.slice(t.indexOf('Erreicht der Beschluss nur das qualifizierte Mehr'));
		expect(ab(streit!)).toBe(ab(vorher));
	});
});
