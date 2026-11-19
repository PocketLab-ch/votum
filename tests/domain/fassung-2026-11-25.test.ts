/**
 * Fassung 2026-11-25 (Produktentscheid 18.11.2026, niedrige Befunde L2-3 bis L2-6 der
 * Website-Prüfung am Abzug 2026-11-22, dazu die Pendenzen an der Hilfe von `f2-1-kompetenzen`).
 * Hier die Proben, dass kein Mehr sich ändert, dass nur die genannten Stellen anders sind und
 * dass jeder Befund an seiner Stelle behoben ist.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { teileHilfe } from '$lib/domain/hilfetext';
import {
	ERSATZWEG_ALLE,
	ERSATZWEG_ENTNAHME,
	ERSATZWEG_JE_KARTE,
	ERSATZWEG_VORHER,
	ERSETZUNGEN,
	KOMPETENZEN_FRAGE,
	OFFERTE,
	OFFERTE_WEBSITE,
	QUALIFIZIERT_ERKLAERT,
	VOR_K,
	WAEHLEN_ID,
	WIEDERWAHL,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-25';
import { VOR_K as VOR_K_VORHER } from '$lib/rules/quorum-2026-11-23';
import { WAEHLEN_ERWEITERT_ID } from '$lib/rules/quorum-2026-11-21';

const NEU = holeRegelwerk('2026-11-25');
const VOR = holeRegelwerk('2026-11-24');

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;
const saetze = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÄÖÜ«])/);
const ersetzeAlle = (t: string) => ERSETZUNGEN.reduce((s, [alt, neu]) => s.split(alt).join(neu), t);

describe('Fassung 2026-11-25', () => {
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
		expect(v1).toContain('In der Fassung 2026-11-25');
		expect(q1).toEqual(JSON.parse(ersetzeAlle(JSON.stringify(q2))));
		for (const k of k1) {
			const alt = knoten(VOR, k.id);
			const { fassung: _a, ...e1 } = erfordernisAusKnoten(NEU, k);
			const { fassung: _b, ...e2 } = erfordernisAusKnoten(VOR, alt);
			expect(e1, k.id).toEqual(e2);
			const erwartet = JSON.parse(ersetzeAlle(JSON.stringify(alt)));
			if (k.id === WAEHLEN_ID) erwartet.hinweise = [...erwartet.hinweise, QUALIFIZIERT_ERKLAERT];
			const ersatz = ERSATZWEG_JE_KARTE[k.id];
			if (ersatz) erwartet.hinweise = erwartet.hinweise.map((h: string) => h.replace(ERSATZWEG_VORHER, ersatz));
			expect(k, k.id).toEqual(erwartet);
		}
	});

	it('behebt L2-6, die Pendenzen an der Hilfe und L2-3 an der Frage nach den Kompetenzen', () => {
		const hilfe = NEU.fragen.find((f) => f.id === KOMPETENZEN_FRAGE)!.hilfe!;
		expect(hilfe).toContain('ebenso wenig ein Betrag, bis zu dem sie Reparaturen selbst vergibt.');
		// Runde 2, Laien L3-1, Fach F5-5: im sichtbaren Anfang und an der Antwort.
		expect(hilfe).toContain('Wählen Sie die bisherige Bewirtschaftung wieder, zählt auch ihr laufender Vertrag');
		expect(hilfe.indexOf('laufender Vertrag')).toBeLessThan(hilfe.indexOf('ebenso wenig ein Betrag'));
		expect(NEU.fragen.find((f) => f.id === KOMPETENZEN_FRAGE)!.antworten[0].text).toContain('laufendem Vertrag');
		expect(hilfe).toContain('nehmen Sie sie im Antrag zur Wahl aus'); // F5-4
		expect(hilfe).toContain('Holen Sie für diesen Fall vor der Versammlung Vollmachten ein'); // L3-2
		expect(hilfe).toContain('wird die Rücknahme abgelehnt, bleibt es bei Ja');
		expect(hilfe).toContain('Steht dieses Traktandum erst nach der Wahl, bleibt es für die Wahl bei Nein.');
		// Der Satz zur Reihenfolge steht nach dem Satz, der das Traktandum einführt.
		expect(hilfe.indexOf('Steht dieses Traktandum')).toBeGreaterThan(hilfe.indexOf('Dann braucht die Erweiterung ein eigenes Traktandum'));
		// Nur die neuen Sätze; der erste Satz der Hilfe liegt als Bestand darüber.
		for (const [, neu] of ERSETZUNGEN.slice(1, 3)) for (const s of saetze(neu).slice(1)) expect(s.length, s).toBeLessThanOrEqual(180);
		// Runde 3, Laien L4-1: der Vergabebetrag im sichtbaren Anfang.
		expect(teileHilfe(hilfe).anfang).toContain('ebenso wenig ein Betrag');
	});

	it('erklärt an der Wahlkarte das qualifizierte Mehr (L2-5) und nennt am Fonds den Ersatzweg (L2-4)', () => {
		expect(knoten(NEU, WAEHLEN_ID).hinweise!.at(-1)).toBe(QUALIFIZIERT_ERKLAERT);
		expect(knoten(NEU, WAEHLEN_ID).hinweise!.length).toBe(knoten(VOR, WAEHLEN_ID).hinweise!.length + 1);
		const fonds = NEU.knoten.filter((k) => (k.hinweise ?? []).some((h) => h.includes('nicht mehr widerrufen')));
		expect(fonds.length).toBe(3);
		for (const k of fonds) {
			const h = k.hinweise!.find((x) => x.includes('nicht mehr widerrufen'))!;
			// Runde 2, Fach F5-2: je Karte die eigene Fassung, je einmal.
			expect(h.split(ERSATZWEG_JE_KARTE[k.id]).length - 1, k.id).toBe(1);
			expect(h, k.id).toContain('nach dem Verteiler der Arbeit');
			expect(h, k.id).not.toContain('nicht mehr zurück');
			for (const s of saetze(h)) expect(s.length, `${k.id}: ${s}`).toBeLessThanOrEqual(180);
		}
	});

	it('nimmt beim Hinweis zur Offerte den laufenden Vertrag aus, an allen drei Stellen der Karte (Laien L4-3)', () => {
		const karte = JSON.stringify(knoten(NEU, WAEHLEN_ERWEITERT_ID));
		expect(karte.split(JSON.stringify(OFFERTE).slice(1, -1)).length - 1).toBe(3);
		expect(JSON.stringify(NEU).split(JSON.stringify(OFFERTE).slice(1, -1)).length - 1).toBe(3);
		for (const t of [OFFERTE, OFFERTE_WEBSITE]) {
			expect(t).toContain('genügt das Streichen aus der Offerte ebenso wenig');
			for (const s of saetze(t)) expect(s.length, s).toBeLessThanOrEqual(180);
		}
	});

	it('lässt an den Karten mit Zustimmung aller den Fonds nicht vorläufig zahlen (Fach F5-2)', () => {
		expect(ERSATZWEG_ALLE).not.toContain('trotzdem aus dem Fonds');
		expect(ERSATZWEG_ENTNAHME).toContain('trotzdem aus dem Fonds');
		expect(knoten(NEU, WAEHLEN_ID).hinweise!.at(-1)).toContain('nur die Anwesenden und Vertretenen'); // F5-1
	});

	it('nennt im Website-Abzug an der Wahl die Wiederwahl und lässt die übrigen Fallteile (L2-3)', () => {
		expect(VOR_K[WAEHLEN_ERWEITERT_ID].map((a) => a.text).join(' ')).toContain(WIEDERWAHL);
		for (const id of Object.keys(VOR_K_VORHER)) {
			if (id !== WAEHLEN_ERWEITERT_ID) expect(VOR_K[id], id).toEqual(VOR_K_VORHER[id]);
		}
		expect(nachDieserFassung(ERSETZUNGEN[0][0])).toBe(ERSETZUNGEN[0][1]);
	});
});
