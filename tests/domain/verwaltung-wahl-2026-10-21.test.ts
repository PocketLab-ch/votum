/**
 * Fassung 2026-10-21: Wahl der Bewirtschaftung mit Gegenmeinung
 * (Produktentscheid 20.10.2026, `docs/entscheide/0015`).
 *
 * Geprüft wird: Die Fassung ändert an der Vorfassung nur den einen Hinweis von
 * `k-bewirtschaftung-waehlen` und seine Teilung unter einer Regel; die Karte
 * nennt ohne Regel Art. 647b Abs. 1 und wie gerechnet wird; unter einer Regel
 * steht bei den Hinweisen nur die Erweiterung, und der Abschnitt zum Gesetz
 * trägt die Gegenmeinung ohne die Zusage, wie dieses Werkzeug rechnet.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import {
	ERWEITERUNG,
	HINWEIS,
	WAHL_MIT_GEGENMEINUNG,
	WAHL_ZUM_GESETZ
} from '$lib/rules/quorum-2026-10-21';
import { erfordernisAus, ergebniskarte, laufe } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';

const VOR = holeRegelwerk('2026-10-20');
const NEU = holeRegelwerk('2026-10-21');
const ID = 'k-bewirtschaftung-waehlen';

describe('Fassung 2026-10-21 gegenüber 2026-10-20', () => {
	it('ist in sich stimmig', () => {
		// Die Fassung selbst, nicht «die aktuelle»: Seit 2026-10-22 folgt eine weitere.
		expect(NEU.fassung).toBe('2026-10-21');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
	});

	it('ändert nur den Hinweis der Wahl der Bewirtschaftung', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			if (k.id !== ID) {
				expect(k, k.id).toEqual(v);
				continue;
			}
			// Erfordernis unverändert: nur Hinweise und ihre Teilung.
			const { hinweise: hn, hinweiseUnterRegel: un, ...restNeu } = k;
			const { hinweise: hv, hinweiseUnterRegel: uv, ...restVor } = v;
			expect(restNeu).toEqual(restVor);
			expect(hn).toHaveLength(hv!.length);
			expect(hn).toContain(HINWEIS);
			expect(un).toHaveLength(uv!.length);
		}
	});
});

describe('Die Karte zur Wahl der Bewirtschaftung', () => {
	const knoten = NEU.knoten.find((k) => k.id === ID)!;

	it('nennt ohne Regel Art. 647b Abs. 1, wie gerechnet wird und den sicheren Weg', () => {
		const k = ergebniskarte(NEU, knoten);
		const hinweis = k.hinweise.find((h) => h.startsWith('Soll die Bewirtschaftung'))!;
		expect(hinweis).toBe(`${ERWEITERUNG} ${WAHL_MIT_GEGENMEINUNG}`);
		expect(hinweis).toMatch(/Art\. 647b Abs\. 1 ZGB/);
		expect(hinweis).toMatch(/so rechnet dieses Werkzeug/);
		expect(hinweis).toMatch(/Wer sicher gehen will, strebt das qualifizierte Mehr an\./);
		// Was die Fachprüfung gestrichen hat.
		expect(hinweis).not.toMatch(/herrschende Lehre|Aufträge bis zu einem Betrag/);
	});

	it('teilt den Hinweis unter einer Regel, ohne Zusage zur Rechnung im Abschnitt zum Gesetz', () => {
		const regel: Reglementsregel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: 'organe',
			knotenId: ID,
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'keine',
			quotenSchwelle: null,
			fundstelle: 'Reglement Ziff. 4 (erfunden)',
			enthaltungZaehltMit: true
		};
		const e = erfordernisAus(NEU, laufe(NEU, 'a-organe', ['f2-1-waehlen']));
		const a = wendeReglementAn(e, [regel], null, LESARTEN_VORGABE);
		// Anker: Die Regel greift, sonst prüfte der Rest die gesetzliche Karte.
		expect(a.regel).not.toBeNull();
		const k = karteMitReglement(ergebniskarte(NEU, knoten), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(k.hinweise).toContain(ERWEITERUNG);
		expect(k.hinweise.join(' ')).not.toMatch(/Art\. 647b/);
		expect(k.zumGesetz?.hinweise).toContain(WAHL_ZUM_GESETZ);
		expect(WAHL_ZUM_GESETZ).not.toMatch(/so rechnet dieses Werkzeug/);
	});
});
