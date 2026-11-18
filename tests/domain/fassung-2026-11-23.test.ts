/**
 * Fassung 2026-11-23 (Meldung `.auftraege/2026-11-18-meldung-votum-befunde-abzug-2026-11-22.md`):
 * In der Anwendung ändert sich nichts. Neu sind die Sätze, die der Website-Abzug an drei Karten
 * vor und nach dem Kernsatz K setzt (`VOR_K`, `NACH_K`). Hier die Proben, dass die Fassung
 * sonst gleich der Vorfassung ist, dass die Umstellung keinen Satz der Vorfassung verliert und
 * dass die Befunde L2-1, L2-2, F2-1 und F2-2 an ihrer Stelle behoben sind.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { NACH_K, PROZESS_ID, VOR_K, nachDieserFassung } from '$lib/rules/quorum-2026-11-23';
import { NACH_K as NACH_K_VORHER, nachDieserFassung as nachDerVorfassung } from '$lib/rules/quorum-2026-11-22';
import { WAEHLEN_ERWEITERT_ID, WARTEZEIT_K } from '$lib/rules/quorum-2026-11-21';
import { ENTNAHME_ID } from '$lib/rules/quorum-2026-11-20';

const NEU = holeRegelwerk('2026-11-23');
const VOR = holeRegelwerk('2026-11-22');

/** Die Sätze eines Texts, an Punkt und folgendem Grossbuchstaben getrennt. */
const saetze = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÄÖÜ«])/);

/** Die Sätze der Vorfassung, die nur ein Stück ändern (Fach F2-1; Laien L3-1, L3-5). */
const NEUES_STUECK: Record<string, string> = {
	'Bei einem Prozess ist die Sache dringlich, sobald':
		'Ist die Ermächtigung erteilt, ist die Sache bei einem Prozess dringlich, sobald',
	'Dann führt die Bewirtschaftung den Prozess,': 'Ist die Sache dringlich, führt die Bewirtschaftung den Prozess,',
	'Dann tritt die Gewählte an,': 'Ist der Wechsel dringlich, tritt die Gewählte an,',
	'dass Frist und Wartezeit vor dem Wechsel': 'dass die Anfechtungsfrist und die Wartezeit danach, die der nächste Absatz beschreibt, vor dem Wechsel',
	'Fällige Rechnungen bezahlen Sie trotzdem': 'Fällige Rechnungen bezahlen Sie in beiden Fällen trotzdem',
	'gehört die Bezahlung fälliger Rechnungen aus dem Fonds zu dem, was eilt.':
		'ist die Bezahlung fälliger Rechnungen aus dem Fonds dringlich.'
};

/** Alle Absätze einer Karte in der Reihenfolge der Seite, ohne K. */
const absaetze = (id: string) => [...VOR_K[id], NACH_K[id]];

describe('Fassung 2026-11-23', () => {
	it('ist die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-25');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ist in der Anwendung gleich der Vorfassung, bis auf Kennung und Freigabevermerk', () => {
		const { fassung: _f1, freigabevermerk: v1, ...neu } = NEU;
		const { fassung: _f2, freigabevermerk: v2, ...vor } = VOR;
		expect(neu).toEqual(vor);
		expect(v1.startsWith(v2)).toBe(true);
		expect(v1).toContain('Die Fassung 2026-11-23');
		expect(nachDieserFassung).toBe(nachDerVorfassung);
		expect(NEU.juristischGegengelesen).toBe(false);
	});

	it('setzt den Fallteil an denselben drei Karten wie die Vorfassung, je mit fettem Anfang', () => {
		const karten = [PROZESS_ID, WAEHLEN_ERWEITERT_ID, ENTNAHME_ID].sort();
		expect(Object.keys(VOR_K).sort()).toEqual(karten);
		expect(Object.keys(NACH_K).sort()).toEqual(karten);
		expect(Object.keys(NACH_K_VORHER).sort()).toEqual(karten);
		for (const id of karten) {
			for (const { vorspann, text } of absaetze(id)) {
				expect(text.startsWith(vorspann), id).toBe(true);
				expect(vorspann.length, id).toBeLessThan(60);
				for (const s of saetze(text)) expect(s.length, `${id}: ${s}`).toBeLessThanOrEqual(180);
				// K selbst steht in keinem Absatz; der Export setzt ihn dazwischen.
				expect(text, id).not.toContain(WARTEZEIT_K.slice(0, 40));
			}
		}
	});

	it('verliert bei der Umstellung keinen Satz der Vorfassung und ändert nur die genannten Stücke', () => {
		for (const [id, vorher] of Object.entries(NACH_K_VORHER)) {
			const jetzt = absaetze(id).flatMap((a) => saetze(a.text));
			for (let s of saetze(vorher)) {
				for (const [alt, neu] of Object.entries(NEUES_STUECK)) s = s.replace(alt, neu);
				expect(jetzt, `${id}: ${s}`).toContain(s);
			}
		}
	});

	it('stellt vor K, was auf der Karte nicht warten muss, und lässt nach K, was bei einem Gesuch gilt (Laien L2-1, Fach F2-2)', () => {
		const vor = (id: string) => VOR_K[id].map((a) => a.text).join(' ');
		expect(vor(WAEHLEN_ERWEITERT_ID)).toContain('Setzen Sie die Wahl deshalb so früh an');
		expect(vor(WAEHLEN_ERWEITERT_ID)).toContain('ist die Sache dringlich');
		expect(NACH_K[WAEHLEN_ERWEITERT_ID].text).toMatch(/^Ist der Wechsel dringlich, tritt die Gewählte an, auch wenn ein Gesuch/);
		expect(vor(ENTNAHME_ID)).toMatch(/muss hier nur die Bezahlung aus dem Fonds warten/);
		// Laien L3-1: der einzige Antrag und die fälligen Rechnungen vor K.
		expect(VOR_K[ENTNAHME_ID].map((a) => a.vorspann)).toEqual([
			'Wurde über Arbeit und Bezahlung getrennt abgestimmt',
			'Stand beides in einem einzigen Antrag',
			'Fällige Rechnungen'
		]); // Laien L4-2, L5-1
		expect(vor(ENTNAHME_ID)).toContain('Fällige Rechnungen bezahlen Sie in beiden Fällen trotzdem fristgerecht');
		expect(NACH_K[ENTNAHME_ID].text).toMatch(/^Wird die Bezahlung später aufgehoben/);
		expect(NACH_K[PROZESS_ID].text).toMatch(/^Ist die Sache dringlich, führt die Bewirtschaftung den Prozess, auch wenn ein Gesuch/);
		for (const id of Object.keys(VOR_K)) expect(vor(id), id).not.toContain('Gesuch');
		// Der letzte Satz vor K nennt keine Frist des Gerichts, denn K beginnt mit «nach Ablauf der Frist».
		for (const id of Object.keys(VOR_K)) expect(saetze(vor(id)).at(-1), id).not.toMatch(/Gericht/);
	});

	it('nennt an der Prozessführung die erteilte Ermächtigung und den Weg bei Beiträgen ohne Frist (Fach F2-1, VA-1 bis VA-3; Laien L2-2, L3-2)', () => {
		const [erteilt, beitraege] = VOR_K[PROZESS_ID];
		expect(erteilt.text.startsWith('Ist die Ermächtigung erteilt, ist die Sache bei einem Prozess dringlich')).toBe(true);
		// Laien L3-2: eigener Absatz, weil er auch ohne Ermächtigung gilt.
		expect(beitraege.vorspann).toBe('Bei ausstehenden Beiträgen');
		expect(beitraege.text).toContain('ZGB Art. 712i Abs. 1');
		expect(beitraege.text).toContain('abgeschlossene Rechnungsjahre'); // Fach VA-3
		expect(beitraege.text).toContain('Ist die Ermächtigung erteilt, ist die Sache mit dieser Frist dringlich'); // Fach VA-2
		expect(beitraege.text).toContain('lassen Sie die Versammlung so früh entscheiden, dass vor Ablauf der Frist geklagt'); // VB-2
		expect(beitraege.text).toContain('Ob eine Ermächtigung für alle im Voraus trägt, ist umstritten'); // Fach VA-1
		// Runde 2, VB-1: «künftige» trägt Rz. 89a, nicht der Entscheid.
		expect(beitraege.text).toContain('fälligen und künftigen Beiträge (Rz. 89a ad Art. 712t)');
		expect(beitraege.text).toContain('Erneuern Sie die Ermächtigung an jeder ordentlichen Versammlung');
		expect(saetze(beitraege.text).at(-1)).toMatch(/Anfechtungsfrist/);
	});
});
