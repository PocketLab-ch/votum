/**
 * Fassung 2026-11-24 (Produktentscheid 18.11.2026, nach den Prüfungen am Website-Abzug der
 * Fassung 2026-11-23, Fach VA-1, Laien L4-3): die Ermächtigung im Voraus in der Begründung der
 * Prozessführung nur noch für die fälligen Beiträge eines säumigen Eigentümers. Hier die Proben,
 * dass kein Mehr sich ändert, dass nur diese eine Begründung anders ist und wie sie lautet.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import {
	IM_VORAUS,
	IM_VORAUS_ANWENDUNG,
	IM_VORAUS_NUR_ANWENDUNG,
	IM_VORAUS_VORHER,
	PROZESS_ID,
	nachDieserFassung
} from '$lib/rules/quorum-2026-11-24';

const NEU = holeRegelwerk('2026-11-24');
const VOR = holeRegelwerk('2026-11-23');

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Die Sätze eines Texts, an Punkt und folgendem Grossbuchstaben getrennt. */
const saetze = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÄÖÜ«])/);

describe('Fassung 2026-11-24', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-24');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert nur die Begründung der Prozessführung, sonst nichts', () => {
		const { fassung: _f1, freigabevermerk: v1, knoten: k1, ...neu } = NEU;
		const { fassung: _f2, freigabevermerk: v2, knoten: k2, ...vor } = VOR;
		expect(neu).toEqual(vor);
		expect(v1.startsWith(v2)).toBe(true);
		expect(v1).toContain('In der Fassung 2026-11-24');
		expect(k1.map((k) => k.id)).toEqual(k2.map((k) => k.id));
		for (const k of k1) {
			const alt = knoten(VOR, k.id);
			if (k.id !== PROZESS_ID) {
				expect(k, k.id).toEqual(alt);
				continue;
			}
			const { begruendung: b1, ...rest1 } = k;
			const { begruendung: b2, ...rest2 } = alt;
			expect(rest1).toEqual(rest2);
			expect(b1).toBe(b2!.replace(IM_VORAUS_VORHER, IM_VORAUS_ANWENDUNG));
		}
	});

	it('nennt den engeren Fall mit seinem Entscheid und hält die Satzgrenze (Fach VA-1)', () => {
		const b = knoten(NEU, PROZESS_ID).begruendung!;
		expect(b).not.toContain('für fällige Beiträge im Voraus');
		expect(b).toContain('Diese kann eigens für die fälligen Beiträge eines säumigen Eigentümers erteilt werden');
		expect(b).toContain('(BGer 5A_590/2011 E. 8.3; Rz. 89a ad Art. 712t)');
		for (const s of saetze(IM_VORAUS_ANWENDUNG.slice(2))) expect(s.length, s).toBeLessThanOrEqual(180);
		// Der geteilte Satz davor endet jetzt bei der Ermächtigung.
		expect(b).toContain('dann braucht die Klage die Ermächtigung. Diese kann eigens');
		// Laien L6-1, Fach F-1: in der Anwendung der Streit und die Erneuerung.
		expect(b).toContain('ist umstritten (Rz. 88 bis 89a ad Art. 712t)');
		expect(b).toContain('Erneuern Sie deshalb die Ermächtigung für den säumigen Eigentümer an jeder ordentlichen Versammlung'); // F2-1
		expect(IM_VORAUS_ANWENDUNG.startsWith(IM_VORAUS)).toBe(true);
		expect(IM_VORAUS).not.toContain(IM_VORAUS_NUR_ANWENDUNG.trim());
	});

	it('bildet einen Wortlaut der Vorfassungen auf den der Anwendung ab (Schlüssel des Website-Abzugs)', () => {
		const alt = `Text davor${IM_VORAUS_VORHER} Text danach`;
		expect(nachDieserFassung(alt)).toBe(`Text davor${IM_VORAUS_ANWENDUNG} Text danach`);
	});
});
