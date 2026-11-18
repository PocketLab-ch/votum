/**
 * Fassung 2026-11-21 (Auftrag `.auftraege/2026-11-17-votum-pendenzen-folge.md`,
 * Teil 1): der neu gefasste Widerruf an beiden Wahlkarten, der Hinweis zur
 * Rücknahme vor der Wahl und der Satz zur luxuriösen Arbeit an der
 * vereinbarten Verwendung. Hier die Proben, dass kein Mehr sich ändert, dass der
 * Widerruf an jeder Stelle ersetzt ist, dass nur vier Karten anders sind und dass
 * die Fassung 2026-11-20 bleibt, wie sie war (AD-4).
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	LUXURIOES_NICHT_AUS_DEM_FONDS,
	QUOREN_FRIST,
	QUOREN_FRIST_VORHER,
	QUOREN_ID,
	WARTEZEIT_K,
	RUECKNAHME_VOR_DER_WAHL,
	STELLEN,
	VEREINBART_ID,
	WAEHLEN_ERWEITERT_ID,
	WIDERRUF,
	WIDERRUF_IN_VOTUM,
	WIDERRUF_WEBSITE,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-21';
import { WIDERRUF as WIDERRUF_VORHER } from '$lib/rules/quorum-2026-11-19';
import { HINWEIS_GEWOEHNLICH } from '$lib/rules/quorum-2026-10-24';

const NEU = holeRegelwerk('2026-11-21');
const VOR = holeRegelwerk('2026-11-20');
const GEAENDERT = ['k-bewirtschaftung-waehlen', WAEHLEN_ERWEITERT_ID, VEREINBART_ID, QUOREN_ID];

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Wie oft ein Text in allen Zeichenketten eines Werts steht. */
function zaehle(wert: unknown, text: string): number {
	if (typeof wert === 'string') return wert.split(text).length - 1;
	if (Array.isArray(wert)) return wert.reduce((n, w) => n + zaehle(w, text), 0);
	if (wert && typeof wert === 'object') return Object.values(wert).reduce((n, w) => n + zaehle(w, text), 0);
	return 0;
}

/** Was ein Ergebnis ausmacht, ohne die Sätze. */
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
		quelle: e.quelle
	};
}

describe('Fassung 2026-11-21', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-25');
		expect(NEU.fassung > '2026-11-20').toBe(true);
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert keine Frage, keinen Ast, keinen Typ und nur vier Karten', () => {
		const { fassung: _f1, freigabevermerk: _v1, knoten: _k1, ...restNeu } = NEU;
		const { fassung: _f2, freigabevermerk: _v2, knoten: _k2, ...restVor } = VOR;
		expect(restNeu).toEqual(restVor);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			if (GEAENDERT.includes(k.id)) expect(k, k.id).not.toEqual(knoten(VOR, k.id));
			else expect(k, k.id).toEqual(knoten(VOR, k.id));
		}
	});

	it('kein Mehr ändert sich, an keiner Karte, unter der Vorgabe und unter anderen Lesarten', () => {
		const wahlen: Lesartenwahl[] = [
			LESARTEN_VORGABE,
			{ ...LESARTEN_VORGABE, L4: 'einfach' },
			{ ...LESARTEN_VORGABE, L17: 'svit' },
			{ ...LESARTEN_VORGABE, L13: 'alle' }
		];
		for (const k of NEU.knoten) {
			for (const w of wahlen) {
				expect(mass(NEU, k, w), `${k.id} ${JSON.stringify(w)}`).toEqual(mass(VOR, knoten(VOR, k.id), w));
			}
		}
	});

	it('ersetzt den Widerruf an jeder Stelle, und nur dort', () => {
		const { freigabevermerk: _a, ...neu } = NEU;
		const { freigabevermerk: _b, ...vor } = VOR;
		expect(zaehle(vor, WIDERRUF_VORHER)).toBe(STELLEN);
		expect(zaehle(neu, WIDERRUF_VORHER)).toBe(0);
		expect(zaehle(neu, WIDERRUF)).toBe(STELLEN);
		for (const id of ['k-bewirtschaftung-waehlen', WAEHLEN_ERWEITERT_ID]) {
			expect(zaehle(knoten(NEU, id), WIDERRUF), id).toBeGreaterThan(0);
		}
		// Die Website-Wortlaute aus Runde 1 der Website-Prüfung (Pendenz «Widerruf an den Wahlkarten»).
		expect(WIDERRUF).toContain('Regelt es dazu nichts, braucht es das qualifizierte Mehr');
		expect(WIDERRUF).not.toContain('sonst das qualifizierte');
		expect(WIDERRUF).toContain('zu einem für die Bewirtschaftung ungünstigen Zeitpunkt');
		expect(WIDERRUF).toContain('ein anderes Mehr setzen darf, das einfache oder etwa die Zustimmung aller, ist umstritten');
		expect(WIDERRUF).not.toContain('zur Unzeit');
		expect(nachDieserFassung(HINWEIS_GEWOEHNLICH)).toContain(WIDERRUF);
		expect(nachDieserFassung(HINWEIS_GEWOEHNLICH)).not.toContain(WIDERRUF_VORHER);
	});

	it('trägt auf der Website denselben Widerruf ohne die Sätze zu Votum', () => {
		expect(WIDERRUF).toContain(WIDERRUF_IN_VOTUM);
		expect(WIDERRUF_WEBSITE).not.toContain('Votum');
		expect(WIDERRUF_WEBSITE).toBe(WIDERRUF.replace(` ${WIDERRUF_IN_VOTUM}`, ''));
	});

	it('hängt den Hinweis zur Rücknahme an die zweite Wahlkarte und den Satz zur luxuriösen Arbeit an die Vereinbarung', () => {
		expect(knoten(NEU, WAEHLEN_ERWEITERT_ID).hinweise?.at(-1)).toBe(RUECKNAHME_VOR_DER_WAHL);
		expect(knoten(VOR, WAEHLEN_ERWEITERT_ID).hinweise).not.toContain(RUECKNAHME_VOR_DER_WAHL);
		expect(knoten(NEU, VEREINBART_ID).hinweise?.at(-1)).toBe(LUXURIOES_NICHT_AUS_DEM_FONDS);
		expect(knoten(VOR, VEREINBART_ID).hinweise).not.toContain(LUXURIOES_NICHT_AUS_DEM_FONDS);
		// Der Verweis zeigt auf eine Karte, die es gibt.
		expect(RUECKNAHME_VOR_DER_WAHL).toContain('«Bewirtschaftung wählen»');
		expect(knoten(NEU, 'k-bewirtschaftung-waehlen').titel).toBe('Bewirtschaftung wählen');
		expect(zaehle(NEU, RUECKNAHME_VOR_DER_WAHL)).toBe(1);
		expect(zaehle(NEU, LUXURIOES_NICHT_AUS_DEM_FONDS)).toBe(1);
	});

	it('nennt an der Quoren-Karte die Wartezeit nach der Frist im Wortlaut der Website', () => {
		expect(zaehle(VOR, QUOREN_FRIST_VORHER)).toBe(1);
		expect(zaehle(NEU, QUOREN_FRIST_VORHER)).toBe(0);
		expect(knoten(NEU, QUOREN_ID).hinweise?.[0]?.endsWith(QUOREN_FRIST)).toBe(true);
		expect(QUOREN_FRIST).toContain('nicht vor Ablauf dieser Frist aus');
		expect(QUOREN_FRIST.endsWith(WARTEZEIT_K)).toBe(true);
		expect(zaehle(NEU, 'erst nach Ablauf dieser Frist aus; für Abwesende')).toBe(0);
	});

	it('nennt die Fassung im Freigabevermerk und lässt die Vorfassung, wie sie ist', () => {
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-21');
		expect(zaehle(VOR, WIDERRUF)).toBe(0);
		expect(NEU.juristischGegengelesen).toBe(false);
	});
});
