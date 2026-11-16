/**
 * Fassung 2026-10-23: Vorbehalt der Einstimmigkeit an der Wahl der
 * Bewirtschaftung (Prüfung des Website-Abzugs vom 20.10.2026).
 *
 * Geprüft wird: Die Fassung ändert an der Vorfassung nur den ersten Satz des
 * Hinweises von `k-bewirtschaftung-waehlen`, ohne Regel und unter einer Regel;
 * der zweite Satz und das Erfordernis bleiben; der neue Satz nennt die
 * Einstimmigkeit und die Abgrenzung zum blossen Vorschlagen.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { ERWEITERUNG, HINWEIS } from '$lib/rules/quorum-2026-10-23';
import {
	ERWEITERUNG as ERWEITERUNG_VORHER,
	WAHL_MIT_GEGENMEINUNG,
	WAHL_ZUM_GESETZ
} from '$lib/rules/quorum-2026-10-21';
import { erfordernisAus, ergebniskarte, laufe } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';

const VOR = holeRegelwerk('2026-10-22');
const NEU = holeRegelwerk('2026-10-23');
const ID = 'k-bewirtschaftung-waehlen';

describe('Fassung 2026-10-23 gegenüber 2026-10-22', () => {
	it('ist in sich stimmig', () => {
		// Die Fassung selbst, nicht «die aktuelle»: Seit 2026-10-24 folgt eine weitere.
		expect(NEU.fassung).toBe('2026-10-23');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
	});

	it('ändert nur den ersten Satz des Hinweises zur Wahl', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			if (k.id !== ID) {
				expect(k, k.id).toEqual(v);
				continue;
			}
			const ersetze = (t: string) => t.replace(ERWEITERUNG_VORHER, ERWEITERUNG);
			expect(k).toEqual({
				...v,
				hinweise: v.hinweise!.map(ersetze),
				hinweiseUnterRegel: v.hinweiseUnterRegel!.map((u) => ({
					...u,
					hinweis: ersetze(u.hinweis),
					ersatz: u.ersatz === ERWEITERUNG_VORHER ? ERWEITERUNG : u.ersatz
				}))
			});
			// Die Ersetzung hat wirklich getroffen.
			expect(k.hinweise).toContain(HINWEIS);
			expect(v.hinweise).not.toContain(HINWEIS);
		}
	});

	it('nennt die Einstimmigkeit und die Grenze zum Vorschlagen', () => {
		expect(ERWEITERUNG).toMatch(/soll sie statt der Versammlung entscheiden/);
		expect(ERWEITERUNG).toMatch(/festlegen statt nur vorschlagen, braucht es Einstimmigkeit/);
		expect(ERWEITERUNG).toMatch(/Rz\. 91 ad Art\. 712g, Rz\. 45 ad Art\. 712m/);
		// «solche Kompetenzen» im zweiten Satz braucht den Bezug.
		expect(ERWEITERUNG).toMatch(/^Soll die Bewirtschaftung Kompetenzen/);
		expect(HINWEIS).toBe(`${ERWEITERUNG} ${WAHL_MIT_GEGENMEINUNG}`);
	});
});

describe('Die Karte unter einer Regel', () => {
	it('trägt den neuen Satz bei den Hinweisen und die Gegenmeinung beim Gesetz', () => {
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
		const knoten = NEU.knoten.find((k) => k.id === ID)!;
		const a = wendeReglementAn(erfordernisAus(NEU, laufe(NEU, 'a-organe', ['f2-1-waehlen'])), [regel], null, LESARTEN_VORGABE);
		expect(a.regel).not.toBeNull();
		const k = karteMitReglement(ergebniskarte(NEU, knoten), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(k.hinweise).toContain(ERWEITERUNG);
		expect(k.hinweise).not.toContain(ERWEITERUNG_VORHER);
		expect(k.zumGesetz?.hinweise).toContain(WAHL_ZUM_GESETZ);
	});
});
