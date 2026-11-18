/**
 * Fassung 2026-11-22 (Auftrag `.auftraege/2026-11-18-votum-korrektur-nach-website-pruefung.md`):
 * der Widerruf in der Reihenfolge der FAQ der Website, der Hinweis zur Rücknahme vor der
 * Wahl ohne die Lesefallen der Website-Prüfung, der Satz zum Antrag über die Arbeit mit der
 * Anfechtung und die Sätze nach dem Kernsatz K für den Website-Abzug. Hier die Proben, dass
 * kein Mehr sich ändert, dass nur sechs Karten anders sind und dass jeder Befund an seiner
 * Stelle behoben ist.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk, wendeLesartAn, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	BEZAHLUNG,
	BEZAHLUNG_KARTEN,
	BEZAHLUNG_VORHER,
	DRINGLICH_PROZESS,
	EILWEG,
	EILWEG_VORHER,
	NACH_EINEM_NEIN,
	NACH_K,
	RUECKNAHME_AUF_DER_WEBSITE,
	RUECKNAHME_IN_VOTUM,
	RUECKNAHME_VOR_DER_WAHL,
	RUECKNAHME_WEBSITE,
	STELLEN,
	WIDERRUF,
	WIDERRUF_ANFANG,
	WIDERRUF_IN_VOTUM,
	WIDERRUF_WEBSITE,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-22';
import {
	RUECKNAHME_VOR_DER_WAHL as RUECKNAHME_VORHER,
	WAEHLEN_ERWEITERT_ID,
	WARTEZEIT_K,
	WIDERRUF as WIDERRUF_VORHER
} from '$lib/rules/quorum-2026-11-21';
import { HINWEIS_GEWOEHNLICH } from '$lib/rules/quorum-2026-10-24';

const NEU = holeRegelwerk('2026-11-22');
const VOR = holeRegelwerk('2026-11-21');
const GEAENDERT = ['k-bewirtschaftung-waehlen', WAEHLEN_ERWEITERT_ID, 'k-prozessfuehrung', ...BEZAHLUNG_KARTEN];

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Wie oft ein Text in allen Zeichenketten eines Werts steht. */
function zaehle(wert: unknown, text: string): number {
	if (typeof wert === 'string') return wert.split(text).length - 1;
	if (Array.isArray(wert)) return wert.reduce((n, w) => n + zaehle(w, text), 0);
	if (wert && typeof wert === 'object') return Object.values(wert).reduce((n, w) => n + zaehle(w, text), 0);
	return 0;
}

/** Die Sätze eines Texts, an Punkt und folgendem Grossbuchstaben getrennt. */
const saetze = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÄÖÜ«])/);

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

describe('Fassung 2026-11-22', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-25');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert keine Frage, keinen Ast, keinen Typ und nur sechs Karten', () => {
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
		expect(nachDieserFassung(HINWEIS_GEWOEHNLICH)).toContain(WIDERRUF);
	});

	it('bindet das einfache Mehr an seinen Fall, bevor Reglement und Begründungsakt kommen (Fach F-4, Laien L-4)', () => {
		const s = saetze(WIDERRUF_ANFANG);
		const jederzeit = s.findIndex((x) => x.includes('jederzeit'));
		const einfach = s.findIndex((x) => x.includes('einfache Mehr'));
		// Der erste Satz nennt kein Mehr; Rz. 42 ad Art. 712m trägt nur «jederzeit».
		expect(s[jederzeit]).toContain('Rz. 42 ad Art. 712m');
		expect(s[jederzeit]).not.toMatch(/Mehr/);
		// Das einfache Mehr mit seiner Bedingung und seinen Belegen, vor jedem anderen Fall.
		expect(s[einfach]).toMatch(/^Steht die Übertragung weder im Reglement noch im Begründungsakt, /);
		expect(s[einfach]).toContain('Rz. 70 ad Art. 712s');
		expect(s[einfach]).toContain('Rz. 91 ad Art. 712g');
		expect(s[einfach]).not.toContain('Rz. 42');
		expect(einfach).toBeLessThan(s.findIndex((x) => x.startsWith('Kam die Übertragung')));
		expect(einfach).toBeLessThan(s.findIndex((x) => x.startsWith('Steht die Übertragung schon im Begründungsakt')));
		// Der Satz zum Begründungsakt am Schluss, nach den Fällen, mit dem Wort erklärt (Laien L-8).
		const erklaert = s.findIndex((x) => x.startsWith('Begründungsakt heisst'));
		expect(erklaert).toBeGreaterThan(einfach);
		expect(s[erklaert + 1]).toMatch(/^Zu ihm gehört auch ein Reglement/);
		// Kein Satz der Anwendung bindet das einfache Mehr anders als der Anfang.
		expect(WIDERRUF_IN_VOTUM).not.toContain('Beruht die Übertragung auf einem Beschluss');
		expect(WIDERRUF_WEBSITE).toBe(WIDERRUF.replace(` ${WIDERRUF_IN_VOTUM}`, ''));
		expect(WIDERRUF_WEBSITE).not.toContain('Votum');
	});

	it('trägt die Rücknahme vor der Wahl ohne die Lesefallen der Website-Prüfung', () => {
		expect(knoten(NEU, WAEHLEN_ERWEITERT_ID).hinweise?.at(-1)).toBe(RUECKNAHME_VOR_DER_WAHL);
		expect(zaehle(NEU, RUECKNAHME_VORHER)).toBe(0);
		for (const t of [RUECKNAHME_VOR_DER_WAHL, RUECKNAHME_WEBSITE]) {
			// Meldung Punkt 3: keine Wortdopplung; Laien L-5, L-6.
			expect(t).not.toMatch(/\bsie sie\b/);
			expect(t).not.toContain('oben auf dieser Karte');
			expect(t).not.toContain('in der Regel ein qualifiziertes Mehr');
			expect(t).toContain('Stehen die Kompetenzen im Reglement oder im Begründungsakt');
			// Laien L-10: der Schritt beim laufenden Vertrag.
			expect(t).toContain('stehen die Kompetenzen in ihrem laufenden Vertrag');
			expect(t).toContain('Lehnt sie ab, bleibt es für die Wahl beim Mehr dieser Karte');
		}
		// Fach F-5, Laien L-5: auf der Website ohne die Bedienung von Votum und ohne Verweis ins Leere.
		expect(RUECKNAHME_VOR_DER_WAHL).toContain(RUECKNAHME_IN_VOTUM);
		expect(RUECKNAHME_WEBSITE).toBe(RUECKNAHME_VOR_DER_WAHL.replace(RUECKNAHME_IN_VOTUM, RUECKNAHME_AUF_DER_WEBSITE));
		for (const satz of ['legen Sie das Wahltraktandum', 'jener Karte', 'wechseln Sie', 'Beantworten Sie dort']) {
			expect(RUECKNAHME_WEBSITE).not.toContain(satz);
		}
		expect(RUECKNAHME_WEBSITE).toContain('«Bewirtschaftung wählen»');
		expect(knoten(NEU, 'k-bewirtschaftung-waehlen').titel).toBe('Bewirtschaftung wählen');
	});

	it('nennt beim Antrag über die Arbeit auch die Anfechtung, an allen drei Karten (Fach F-3)', () => {
		expect(zaehle(VOR, BEZAHLUNG_VORHER)).toBe(BEZAHLUNG_KARTEN.length);
		expect(zaehle(NEU, BEZAHLUNG_VORHER)).toBe(0);
		expect(BEZAHLUNG).toContain('nicht zustande kommt oder angefochten ist');
		for (const id of BEZAHLUNG_KARTEN) expect(zaehle(knoten(NEU, id), BEZAHLUNG), id).toBe(1);
	});

	it('sagt an der Prozessführung schon in der Begründung, was dringlich ist (Laien VK-L-1)', () => {
		const vor = knoten(VOR, 'k-prozessfuehrung').begruendung!;
		const neu = knoten(NEU, 'k-prozessfuehrung').begruendung!;
		expect(vor.endsWith(EILWEG_VORHER)).toBe(true);
		expect(neu).toBe(vor.replace(EILWEG_VORHER, EILWEG));
		// Runde 3: Eilweg, Dringlichkeit mit beiden Kriterien aus Rz. 78 ad Art. 712t, dann das Nein (Fach F3-1).
		expect(neu.endsWith(`${DRINGLICH_PROZESS} ${NACH_EINEM_NEIN}`)).toBe(true);
		expect(DRINGLICH_PROZESS).toContain('bevor die Versammlung entscheiden kann');
		expect(DRINGLICH_PROZESS).toContain('Rz. 78 ad Art. 712t');
		expect(NACH_EINEM_NEIN).toContain('die Verwaltung');
	});

	it('gibt dem Website-Abzug je einen Satz nach K an den drei Karten, ohne K zu ändern', () => {
		expect(Object.keys(NACH_K).sort()).toEqual(
			['k-bewirtschaftung-waehlen-erweitert', 'k-erneuerungsfonds-entnahme', 'k-prozessfuehrung'].sort()
		);
		for (const [id, satz] of Object.entries(NACH_K)) {
			expect(knoten(NEU, id), id).toBeDefined();
			expect(satz).not.toContain(WARTEZEIT_K.slice(0, 40));
			for (const s of saetze(satz)) expect(s.length, `${id}: ${s}`).toBeLessThanOrEqual(180);
		}
		expect(NACH_K['k-prozessfuehrung']).toContain('auch wenn ein Gesuch gegen die Ermächtigung eingegangen ist');
		expect(NACH_K['k-bewirtschaftung-waehlen-erweitert']).toContain('auch wenn ein Gesuch gegen die Wahl eingegangen ist');
		// Runde 2: nur bei getrennter Abstimmung (Fach F2-1), und der Weg ohne Klausel im Antrag (F2-2).
		expect(NACH_K['k-erneuerungsfonds-entnahme']).toMatch(/^Wurde über Arbeit und Bezahlung getrennt abgestimmt, muss hier nur die Bezahlung/);
		expect(NACH_K['k-erneuerungsfonds-entnahme']).toContain('Stand beides in einem einzigen Antrag');
		expect(NACH_K['k-erneuerungsfonds-entnahme']).toContain('Sieht er dafür nichts vor');
		expect(NACH_K['k-prozessfuehrung']).toContain('sobald die Gemeinschaft selbst eine Frist einhalten muss');
	});

	it('nennt die Fassung im Freigabevermerk und lässt die Vorfassung, wie sie ist', () => {
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-22');
		expect(zaehle(VOR, WIDERRUF)).toBe(0);
		expect(zaehle(VOR, RUECKNAHME_VOR_DER_WAHL)).toBe(0);
		expect(NEU.juristischGegengelesen).toBe(false);
	});
});
