/**
 * Fassung 2026-11-19 (Auftrag «Gegenlesung streichen», 16.11.2026, mit der
 * Meldung der Website zum Widerruf einer Übertragung): nur Wortlaut. Hier die
 * Prüfungen, dass kein Ergebnis sich ändert, dass der Widerruf an jeder Stelle
 * des Satzes zur Erweiterung steht und dass der Vermerk die Gegenlesung nicht
 * mehr als ausstehend nennt.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	ERWEITERUNG,
	FOLGESATZ,
	FOLGESATZ_VORHER,
	GEGENLESUNG_VORHER,
	STELLEN,
	VORSCHLAG,
	WIDERRUF,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-19';
import { ERWEITERUNG as ERWEITERUNG_VORHER } from '$lib/rules/quorum-2026-10-23';

const NEU = holeRegelwerk('2026-11-19');
const VOR = holeRegelwerk('2026-11-18');
const WAHLKARTEN = ['k-bewirtschaftung-waehlen', 'k-bewirtschaftung-waehlen-erweitert'];

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Wie oft ein Text in allen Zeichenketten eines Werts steht. */
function zaehle(wert: unknown, text: string): number {
	if (typeof wert === 'string') return wert.split(text).length - 1;
	if (Array.isArray(wert)) return wert.reduce((n, w) => n + zaehle(w, text), 0);
	if (wert && typeof wert === 'object') return Object.values(wert).reduce((n, w) => n + zaehle(w, text), 0);
	return 0;
}

/** Was ein Ergebnis ausmacht, ohne die Sätze: das Erfordernis nach der Wahl der Gemeinschaft. */
function mass(rw: Regelwerk, k: Ergebnisknoten, wahlen: Lesartenwahl) {
	const e = wendeLesartAn(erfordernisAusKnoten(rw, k), wahlen);
	return {
		typ: e.typ,
		rechtsgrundlage: e.rechtsgrundlage,
		kopfbasis: e.kopfbasis,
		quotenbasis: e.quotenbasis,
		kopfSchwelle: e.kopfSchwelle,
		quotenSchwelle: e.quotenSchwelle,
		geschaeftsart: e.geschaeftsart,
		reglementsverhalten: e.reglementsverhalten,
		enthaltungZaehltMit: e.enthaltungZaehltMit,
		zustimmungBetroffenerNoetig: e.zustimmungBetroffenerNoetig,
		betroffenenzustimmung: e.betroffenenzustimmung,
		quelle: e.quelle
	};
}

describe('Fassung 2026-11-19', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-20');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert keine Frage, keinen Ast, keinen Typ und nur die zwei Wahlkarten', () => {
		// Alles ausser Kennung, Vermerk und Karten gleich wie in der Vorfassung (Codeprüfung N3).
		const { fassung: _f1, freigabevermerk: _v1, knoten: _k1, ...restNeu } = NEU;
		const { fassung: _f2, freigabevermerk: _v2, knoten: _k2, ...restVor } = VOR;
		expect(restNeu).toEqual(restVor);
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.ergebnistypen).toEqual(VOR.ergebnistypen);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			const v = knoten(VOR, k.id);
			if (WAHLKARTEN.includes(k.id)) expect(k, k.id).not.toEqual(v);
			else expect(k, k.id).toEqual(v);
		}
	});

	it('kein Ergebnis ändert sich, an keiner Karte, unter der Vorgabe und unter anderen Lesarten', () => {
		const wahlen: Lesartenwahl[] = [
			LESARTEN_VORGABE,
			{ ...LESARTEN_VORGABE, L4: 'einfach' },
			{ ...LESARTEN_VORGABE, L13: 'alle' }
		];
		for (const k of NEU.knoten) {
			for (const w of wahlen) {
				expect(mass(NEU, k, w), `${k.id} ${JSON.stringify(w)}`).toEqual(mass(VOR, knoten(VOR, k.id), w));
			}
		}
	});

	it('hängt den Widerruf an jede Stelle des Satzes zur Erweiterung, und nur dort', () => {
		const { freigabevermerk: _a, ...neu } = NEU;
		const { freigabevermerk: _b, ...vor } = VOR;
		expect(zaehle(vor, ERWEITERUNG_VORHER)).toBe(STELLEN);
		expect(zaehle(neu, ERWEITERUNG)).toBe(STELLEN);
		expect(zaehle(neu, WIDERRUF)).toBe(STELLEN);
		// Kein alter Satz ohne den Widerruf dahinter.
		expect(zaehle(neu, ERWEITERUNG_VORHER)).toBe(zaehle(neu, ERWEITERUNG));
		for (const id of WAHLKARTEN) expect(zaehle(knoten(NEU, id), WIDERRUF), id).toBeGreaterThan(0);
		expect(nachDieserFassung(ERWEITERUNG_VORHER)).toBe(ERWEITERUNG);
		// Der Verweis auf die zweite Wahlkarte nennt die Kompetenzen wieder selbst (Laienprüfung 1c).
		expect(zaehle(vor, FOLGESATZ_VORHER)).toBe(1);
		expect(zaehle(neu, FOLGESATZ_VORHER)).toBe(0);
		expect(zaehle(knoten(NEU, 'k-bewirtschaftung-waehlen'), FOLGESATZ)).toBeGreaterThan(0);
	});

	it('nennt im Freigabevermerk den Vorschlag statt der ausstehenden Gegenlesung', () => {
		expect(NEU.freigabevermerk).not.toContain(GEGENLESUNG_VORHER);
		expect(NEU.freigabevermerk).not.toMatch(/Gegenlesung steht aus/);
		expect(NEU.freigabevermerk.split(VORSCHLAG).length - 1).toBe(1);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk.replace(GEGENLESUNG_VORHER, VORSCHLAG))).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-19');
	});

	it('lässt das Datenfeld und die Vorfassung, wie sie sind', () => {
		expect(NEU.juristischGegengelesen).toBe(false);
		expect(VOR.freigabevermerk).toContain(GEGENLESUNG_VORHER);
		expect(zaehle(VOR, WIDERRUF)).toBe(0);
	});
});
