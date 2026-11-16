import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { ABGRENZUNG, GRENZE_NUTZNIESSUNG, KLAEGER, KLAGE_UND_KOSTEN } from '$lib/rules/quorum-2026-11-03';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, ergebniskarte } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { karteMitReglement, wendeReglementAn } from '$lib/domain/reglement';
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';

/** Die neue und die Vorfassung. */
const NEU = holeRegelwerk('2026-11-03');
const VOR = holeRegelwerk('2026-10-30');

function knoten(rw: Regelwerk, id: string): Ergebnisknoten {
	const gefunden = rw.knoten.find((k) => k.id === id);
	if (!gefunden) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

/** Die Karte unter einer angewandten Regel: das Gesetz, als Regel hinterlegt (wie `regelwerksfassungen.test.ts`). */
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

/** Alles, was eine Karte zeigt, in einem Text: Hinweise unter der Regel und zum Gesetz. */
function sichtbar(karte: ReturnType<typeof karteUnterRegel>): string {
	return [karte.begruendung, ...karte.hinweise, ...(karte.zumGesetz?.hinweise ?? [])].join('\n');
}

describe('Fassung 2026-11-03', () => {
	it('ist seit F4a nicht mehr die aktuelle Fassung und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-18');
		expect(NEU.fassung).toBe('2026-11-03');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	it('ändert nur die zwei Karten und am Erfordernis nichts', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const n of NEU.knoten) {
			const v = knoten(VOR, n.id);
			if (n.id === 'k-ausschlussklage' || n.id === 'k-prozessfuehrung') {
				const { hinweise: _h, hinweiseUnterRegel: _u, ...rest } = n;
				const { hinweise: _vh, hinweiseUnterRegel: _vu, ...vorRest } = v;
				expect(rest, n.id).toEqual(vorRest);
				// Bis auf die Kennung der Fassung dasselbe Erfordernis.
				expect({ ...erfordernisAusKnoten(NEU, n), fassung: '' }, n.id).toEqual({ ...erfordernisAusKnoten(VOR, v), fassung: '' });
			} else {
				expect(n, n.id).toEqual(v);
			}
		}
	});

	it('Punkt 1 und 2: Die Ausschlussklage sagt ohne Regel, wer klagt, und die Grenze bei Nutzniessern', () => {
		const k = knoten(NEU, 'k-ausschlussklage');
		const hinweise = k.hinweise ?? [];
		const gericht = hinweise.findIndex((h) => h.startsWith('Der Ausschluss selbst spricht das Gericht aus'));
		expect(hinweise.slice(gericht + 1, gericht + 4)).toEqual([KLAEGER, KLAGE_UND_KOSTEN, GRENZE_NUTZNIESSUNG]);
		// Die übrigen Hinweise der Vorfassung bleiben, in derselben Folge.
		expect(hinweise.filter((h) => ![KLAEGER, KLAGE_UND_KOSTEN, GRENZE_NUTZNIESSUNG].includes(h))).toEqual(
			knoten(VOR, 'k-ausschlussklage').hinweise
		);
		const karte = ergebniskarte(NEU, k);
		expect(karte.hinweise).toContain(KLAEGER);
		expect(KLAEGER).toContain('Die Gemeinschaft, die Bewirtschaftung und Nutzniesser können es nicht');
		// Nur wer selbst gestört ist (Fachprüfung F1-Sätze, A1; Rz. 215 ad Art. 712a).
		expect(KLAEGER).toContain('die selbst betroffen sind');
		expect(KLAEGER).toContain('mit Namen, wer von den Betroffenen klagen soll, und ermächtigt nicht die Bewirtschaftung');
		// Rz. 119 ad Art. 712h betrifft Verfahren der Gemeinschaft (A2); die Übernahme ist offen.
		expect(KLAGE_UND_KOSTEN).not.toContain('Rz. 119');
		expect(KLAGE_UND_KOSTEN).toContain('Ob die Gemeinschaft Kosten übernehmen darf, ist rechtlich nicht geklärt');
		expect(KLAGE_UND_KOSTEN).toContain('ZGB Art. 712m Abs. 2 mit Art. 67 Abs. 3');
		// Der Umweg über den Eigentümer ist verbaut (A3).
		expect(GRENZE_NUTZNIESSUNG).toContain('Tragen Sie nicht die Eigentümerin oder den Eigentümer an seiner Stelle als beklagt ein');
		expect(GRENZE_NUTZNIESSUNG).toContain('vor der Einladung');
		expect(KLAGE_UND_KOSTEN).toContain('Art. 68 Abs. 2 ZPO');
		expect(KLAGE_UND_KOSTEN).toContain('gehört in die Einladung');
		expect(GRENZE_NUTZNIESSUNG).toContain('ZGB Art. 649c');
		// Ohne Regel stand vorher nirgends, wer klagen kann.
		expect((knoten(VOR, 'k-ausschlussklage').hinweise ?? []).join(' ')).not.toMatch(/Klagen können nur|nicht selbst klagen/);
	});

	it('Punkt 1 und 2: Unter einer Regel stehen dieselben Sätze, und der zur Gemeinschaft nur einmal', () => {
		const vorher = sichtbar(karteUnterRegel(VOR, 'k-ausschlussklage'));
		const karte = karteUnterRegel(NEU, 'k-ausschlussklage');
		// Unter der Regel stehen die neuen Hinweise oben, nicht unter «Zum gesetzlichen Erfordernis».
		expect(karte.hinweise).toEqual(expect.arrayContaining([KLAEGER, KLAGE_UND_KOSTEN, GRENZE_NUTZNIESSUNG]));
		const text = sichtbar(karte);
		// Vorher sagte es nur die Klausel, jetzt nur der neue Hinweis.
		expect(vorher.split('können nicht selbst klagen').length - 1).toBe(1);
		expect(text).not.toContain('können nicht selbst klagen');
		expect(text.split('die Bewirtschaftung und Nutzniesser können es nicht').length - 1).toBe(1);
		// Der Satz zum Zuwarten der ermächtigten Eigentümer bleibt.
		expect(text).toContain('Die ermächtigten Eigentümer reichen Schlichtungsgesuch und Klage am sichersten erst');
	});

	it('Punkt 3: Die Prozessführung grenzt sich ab, ohne und unter einer Regel', () => {
		const k = knoten(NEU, 'k-prozessfuehrung');
		expect(k.hinweise?.at(-1)).toBe(ABGRENZUNG);
		expect(ergebniskarte(NEU, k).hinweise).toContain(ABGRENZUNG);
		const karte = karteUnterRegel(NEU, 'k-prozessfuehrung');
		expect(karte.hinweise).toContain(ABGRENZUNG);
		expect(karte.zumGesetz?.hinweise ?? []).not.toContain(ABGRENZUNG);
		expect(ABGRENZUNG).toContain('«Ermächtigung zur Ausschlussklage»');
		// Der Titel, auf den die Abgrenzung zeigt, ist der der Karte.
		expect(knoten(NEU, 'k-ausschlussklage').titel).toBe('Ermächtigung zur Ausschlussklage');
	});
});
