/**
 * Fassung 2026-11-26 (Rücknahme einer Übertragung: Fach F2-1, Laien L4-1 und L5-2; dazu VK3-L-2
 * und F4-1; VK-L-6 ohne Änderung). Hier die Proben, dass kein Mehr sich ändert, dass nur die genannten Stellen
 * anders sind und dass jeder Befund an seiner Stelle behoben ist, in der Anwendung und im Website-Teil.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import {
	ABREDE,
	ABREDE_VORHER,
	BESTANDTEIL,
	ERSETZUNGEN,
	ERSTRECKUNG,
	IN_VOTUM,
	NACH_K,
	NACHHOLEN,
	PROZESS_ID,
	QUOREN_ANTWORT,
	QUOREN_HILFE,
	SICHER_BEIDE,
	SPAETER_GEAENDERT,
	STREIT,
	NUR_ERWEITERUNG,
	VOR_K,
	WAEHLEN_ID,
	ZWEI_TRAKTANDEN,
	WIDERRUF_WEBSITE,
	mitErstreckung,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-26';
import { VOR_K as VOR_K_VORHER, NACH_K as NACH_K_VORHER } from '$lib/rules/quorum-2026-11-25';
import { WIDERRUF_IN_VOTUM, WIDERRUF_WEBSITE as WIDERRUF_WEBSITE_VORHER } from '$lib/rules/quorum-2026-11-22';
import { WAEHLEN_ERWEITERT_ID } from '$lib/rules/quorum-2026-11-21';

const NEU = holeRegelwerk('2026-11-26');
const VOR = holeRegelwerk('2026-11-25');

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;
const saetze = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÄÖÜ«])/);
const ersetzeAlle = (t: string) => ERSETZUNGEN.reduce((s, [alt, neu]) => s.split(alt).join(neu), t);
const zahl = (t: string, s: string) => t.split(s).length - 1;
/** Die Sätze, die diese Fassung neu schreibt, ohne den Bestand davor. */
const neueSaetze = (alt: string, neu: string) => saetze(neu.slice(neu.indexOf(alt) + alt.length).trim() || neu);

describe('Fassung 2026-11-26', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert kein Mehr und nur die genannten Texte', () => {
		const { fassung: _f1, freigabevermerk: v1, knoten: k1, fragen: q1, ...neu } = NEU;
		const { fassung: _f2, freigabevermerk: v2, knoten: k2, fragen: q2, ...vor } = VOR;
		expect(neu).toEqual(vor);
		expect(v1.startsWith(v2)).toBe(true);
		expect(v1).toContain('In der Fassung 2026-11-26');
		expect(q1).toEqual(JSON.parse(ersetzeAlle(JSON.stringify(q2))));
		expect(k1.length).toBe(k2.length);
		for (const k of k1) {
			const alt = knoten(VOR, k.id);
			const { fassung: _a, ...e1 } = erfordernisAusKnoten(NEU, k);
			const { fassung: _b, ...e2 } = erfordernisAusKnoten(VOR, alt);
			expect(e1, k.id).toEqual(e2);
			expect(k, k.id).toEqual(JSON.parse(ersetzeAlle(JSON.stringify(alt))));
		}
		// Gegenprobe: Es ändert sich wirklich etwas, an genau den Karten der Befunde.
		const geaendert = k1.filter((k) => JSON.stringify(k) !== JSON.stringify(knoten(VOR, k.id))).map((k) => k.id);
		expect(geaendert.sort()).toEqual([WAEHLEN_ID, WAEHLEN_ERWEITERT_ID, PROZESS_ID].sort());
	});

	it('führt an `f3-1-quoren` die Rücknahme auf die gewöhnliche Bestimmung (F2-1)', () => {
		const hilfe = NEU.fragen.flatMap((f) => f.antworten).find((a) => a.id === QUOREN_ANTWORT)!.hilfe!;
		expect(zahl(hilfe, QUOREN_HILFE)).toBe(1);
		expect(hilfe).toContain('Die gewöhnliche Bestimmung gilt auch für die Rücknahme einer Übertragung an die Bewirtschaftung, die später mit Mehrheit'); // Runde 5, Fach F4-1
		expect(hilfe).toContain('Antwort zu Zuständigkeit oder Quoren der sichere Weg'); // Runde 3, Laien L2-2
		expect(hilfe).toContain('wählen Sie überall, wo diese Hilfe die gewöhnliche Bestimmung nennt, die Antwort dazu'); // Fach F2-1, F5-1
		// Runde 4, Fach F3-1: die Vergabeklausel aus dem Begründungsakt bleibt bei der gewöhnlichen Bestimmung.
		expect(hilfe).toContain('nehmen Sie mit der gewöhnlichen Bestimmung zurück (ZGB Art. 647a Abs. 2, 712g Abs. 3). Das gilt auch, wenn sie schon im Begründungsakt stand oder später erweitert wurde.');
		// Runde 6, Laien L5-2: gleich nach dem Begründungsakt; Fach F5-2: der Verweis nicht direkt danach.
		expect(hilfe).toContain('der sichere Weg. Eine Klausel, die nur sagt');
		expect(hilfe.indexOf('Was zum Begründungsakt zählt')).toBeGreaterThan(hilfe.indexOf('legen Sie zwei Traktanden an'));
		expect(hilfe).not.toContain('Das gilt auch für eine Klausel über alltägliche Aufträge');
		// Runde 4, Laien L3-2: der Satz zur Einstimmigkeitsklausel gleich nach dem, den er ersetzt.
		expect(hilfe.indexOf('Verlangt Ihr Reglement')).toBeLessThan(hilfe.indexOf('Stand die Übertragung schon'));
		expect(hilfe).toContain('Nehmen Sie bei einer anderen Übertragung nur eine spätere, mit Mehrheit beschlossene Erweiterung zurück'); // Laien L-2, L4-2, Fach F2-2
		expect(hilfe).toContain('Verlangt Ihr Reglement für seine eigene Änderung Einstimmigkeit'); // Fach F-1, Laien L-3
		// Runde 2, Laien L-1: hinter Regel und Ausnahme, damit sich die Ausnahme nicht auf die Rücknahme bezieht.
		expect(hilfe.indexOf('Die gewöhnliche Bestimmung gilt auch für die Rücknahme')).toBeGreaterThan(hilfe.indexOf('Das gilt nicht für eine Klausel'));
		for (const s of neueSaetze(ERSETZUNGEN[0][0], QUOREN_HILFE)) expect(s.length, s).toBeLessThanOrEqual(180);
	});

	it('nennt im Widerruf den sicheren Weg und die später erweiterte Übertragung, an allen sechs Stellen (L5-2, L4-1)', () => {
		const text = JSON.stringify(NEU);
		for (const satz of [SICHER_BEIDE, SPAETER_GEAENDERT, NUR_ERWEITERUNG, ZWEI_TRAKTANDEN]) {
			expect(zahl(text, satz), satz).toBe(6);
		}
		const hinweis = knoten(NEU, WAEHLEN_ID).hinweise![0];
		// Der sichere Weg direkt nach dem Streit, die Erweiterung direkt nach dem Bestandteil, die Sätze zu Votum danach.
		expect(hinweis).toContain(STREIT);
		expect(hinweis).toContain(BESTANDTEIL);
		expect(hinweis.indexOf(SPAETER_GEAENDERT)).toBeLessThan(hinweis.indexOf(IN_VOTUM));
		expect(hinweis.indexOf(IN_VOTUM)).toBeLessThan(hinweis.indexOf(ZWEI_TRAKTANDEN));
		// Runde 2: kein Betrag als Beispiel, weil ein Vergabebetrag nach der Fassung 2026-11-25 nicht zählt.
		expect(SPAETER_GEAENDERT).not.toContain('Betrag');
		for (const s of [...saetze(SICHER_BEIDE), ...saetze(SPAETER_GEAENDERT), ...saetze(NUR_ERWEITERUNG), ...saetze(ZWEI_TRAKTANDEN)]) {
			expect(s.length, s).toBeLessThanOrEqual(180);
		}
	});

	it('trägt auf der Website denselben Widerruf ohne die Sätze zu Votum', () => {
		expect(WIDERRUF_WEBSITE).toContain(STREIT);
		expect(WIDERRUF_WEBSITE).toContain(BESTANDTEIL);
		expect(WIDERRUF_WEBSITE).not.toContain('Votum');
		expect(WIDERRUF_WEBSITE).not.toContain(WIDERRUF_IN_VOTUM.slice(0, 40));
		// Sonst wie bisher: Entfernt man die zwei Einfügungen, bleibt der Widerruf der Vorfassung.
		expect(WIDERRUF_WEBSITE.replace(` ${SICHER_BEIDE}`, '').replace(` ${SPAETER_GEAENDERT}`, '')).toBe(WIDERRUF_WEBSITE_VORHER);
		expect(nachDieserFassung(WIDERRUF_WEBSITE_VORHER)).toBe(WIDERRUF_WEBSITE);
	});

	it('nennt an der Prozessführung die Erstreckung, vor dem Satz zum Nein (F4-1)', () => {
		const b = knoten(NEU, PROZESS_ID).begruendung;
		expect(zahl(b, ERSTRECKUNG)).toBe(1);
		expect(b.indexOf(ERSTRECKUNG)).toBeLessThan(b.indexOf('Nach einem Nein der Versammlung'));
		for (const s of saetze(ERSTRECKUNG)) expect(s.length, s).toBeLessThanOrEqual(180);
		expect(ERSTRECKUNG).toContain('die das Gericht gesetzt hat'); // Runde 2, Fach F-5
		// Die Seite der Website im Export bekommt denselben Satz an derselben Stelle.
		expect(mitErstreckung(knoten(VOR, PROZESS_ID).begruendung)).toBe(b);
		expect(() => mitErstreckung('ohne den Satz')).toThrow();
	});

	it('ändert im Website-Teil nur die Sätze nach K an Wahl und Prozessführung (VK3-L-2, F4-1)', () => {
		// VK-L-6 ohne Änderung (Fach F-3): Der Fallteil vor K bleibt.
		expect(VOR_K).toEqual(VOR_K_VORHER);
		expect(NACH_K[WAEHLEN_ERWEITERT_ID].text).toContain(ABREDE);
		expect(NACH_K[WAEHLEN_ERWEITERT_ID].text).not.toContain(ABREDE_VORHER);
		expect(NACH_K[PROZESS_ID].text).toContain(NACHHOLEN);
		for (const id of Object.keys(VOR_K_VORHER)) {
			if (id !== WAEHLEN_ERWEITERT_ID && id !== PROZESS_ID) expect(NACH_K[id], id).toEqual(NACH_K_VORHER[id]);
			expect(NACH_K[id].vorspann, id).toBe(NACH_K_VORHER[id].vorspann);
		}
		for (const s of [...saetze(ABREDE), ...saetze(NACHHOLEN)]) expect(s.length, s).toBeLessThanOrEqual(180);
	});
});
