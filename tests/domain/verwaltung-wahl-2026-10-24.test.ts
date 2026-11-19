/**
 * Fassung 2026-10-24: die Wahl der Bewirtschaftung mit erweiterten
 * Kompetenzen als Lesart der Gemeinschaft (L4, Entscheid 0018).
 *
 * Gemessen wird, dass sich nur die Frage nach den Kompetenzen, der neue Knoten
 * und der Hinweis am bisherigen ändern, dass nach der Vorgabe dasselbe Mehr
 * gilt (Kriterium 14) und dass die Karte nicht mehr «so rechnet dieses
 * Werkzeug» sagt.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { erfordernisAus, ergebniskarte, laufe, waehlbareErfordernisse } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import {
	knotenNachLesart,
	LESARTEN,
	LESARTEN_VORGABE,
	pruefeLesartenImRegelwerk,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { ERWEITERUNG, HINWEIS as HINWEIS_VORHER } from '$lib/rules/quorum-2026-10-23';
import {
	HINWEIS_ERWEITERT,
	HINWEIS_GEWOEHNLICH,
	KOMPETENZFRAGE_ID,
	WAEHLEN_ERWEITERT_ID,
	WAEHLEN_ID
} from '$lib/rules/quorum-2026-10-24';

const VOR = holeRegelwerk('2026-10-23');
const NEU = holeRegelwerk('2026-10-24');

function herleiten(rw: typeof NEU, ...antworten: string[]) {
	return erfordernisAus(rw, laufe(rw, 'a-organe', antworten));
}

describe('Fassung 2026-10-24 gegenüber 2026-10-23', () => {
	it('ist in sich stimmig, auch die Lesart am Knoten, und nicht mehr die aktuelle', () => {
		// Seit Lesarten Block 4 leitet die Anwendung unter 2026-10-27 her.
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toEqual([]);
		expect(NEU.knoten.filter((k) => k.lesart).map((k) => k.id)).toEqual([WAEHLEN_ERWEITERT_ID]);
	});

	it('ändert nur die Wahl der Bewirtschaftung', () => {
		expect(NEU.aeste).toEqual(VOR.aeste);
		// Fragen: dieselben, ausser dass «Neue Bewirtschaftung wählen» jetzt nachfragt.
		const ohneNeue = NEU.fragen.filter((f) => f.id !== KOMPETENZFRAGE_ID);
		expect(ohneNeue.length).toBe(VOR.fragen.length);
		for (const f of ohneNeue) {
			const v = VOR.fragen.find((x) => x.id === f.id)!;
			if (f.id !== 'f2-1') {
				expect(f, f.id).toEqual(v);
				continue;
			}
			expect(f.antworten.map((a) => [a.id, a.ziel])).toEqual(
				v.antworten.map((a) => [a.id, a.id === 'f2-1-waehlen' ? KOMPETENZFRAGE_ID : a.ziel])
			);
		}
		// Knoten: dieselben, die Wahl geteilt in gewöhnliche und erweiterte.
		expect(NEU.knoten.map((k) => k.id)).toEqual(
			VOR.knoten.flatMap((k) => (k.id === WAEHLEN_ID ? [WAEHLEN_ID, WAEHLEN_ERWEITERT_ID] : [k.id]))
		);
		for (const k of NEU.knoten) {
			if (k.id === WAEHLEN_ID || k.id === WAEHLEN_ERWEITERT_ID) continue;
			expect(k, k.id).toEqual(VOR.knoten.find((x) => x.id === k.id));
		}
	});

	it('rechnet nach der Vorgabe dasselbe Mehr wie vorher, auf beiden Wegen (Kriterium 14)', () => {
		// «Vorgabe» heisst hier die Vorgabe von damals, «einfach». Seit Block B
		// (Entscheid 0048, Fassung 2026-11-13) ist die Vorgabe «qualifiziert»; ein
		// Traktandum dieser Fassung rechnet mit «einfach» weiter, was es rechnete.
		const vorher = herleiten(VOR, 'f2-1-waehlen');
		for (const antwort of ['f2-1-kompetenzen-ja', 'f2-1-kompetenzen-nein']) {
			const e = wendeLesartAn(herleiten(NEU, 'f2-1-waehlen', antwort), { ...LESARTEN_VORGABE, L4: 'einfach' });
			expect(
				{ typ: e.typ, kopfbasis: e.kopfbasis, quotenbasis: e.quotenbasis, kopf: e.kopfSchwelle, quoten: e.quotenSchwelle },
				antwort
			).toEqual({
				typ: vorher.typ,
				kopfbasis: vorher.kopfbasis,
				quotenbasis: vorher.quotenbasis,
				kopf: vorher.kopfSchwelle,
				quoten: vorher.quotenSchwelle
			});
		}
	});

	it('führt bei Ja zur Lesart, bei Nein ohne sie', () => {
		const ja = herleiten(NEU, 'f2-1-waehlen', 'f2-1-kompetenzen-ja');
		expect(ja.knotenId).toBe(WAEHLEN_ERWEITERT_ID);
		// `vorgabe` ist Herkunft am heutigen Katalog: seit Block B nicht mehr «einfach».
		expect(ja.gemeinschaftslesart).toMatchObject({ kennung: 'L4', wahl: 'einfach', vorgabe: false });
		expect(ja.gemeinschaftslesart?.andere).toMatchObject({
			typ: 'qualifiziertes_mehr',
			quotenbasis: 'alle_quoten',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1'
		});
		const nein = herleiten(NEU, 'f2-1-waehlen', 'f2-1-kompetenzen-nein');
		expect(nein.knotenId).toBe(WAEHLEN_ID);
		expect(nein.gemeinschaftslesart).toBeUndefined();
	});

	it('sagt nicht mehr «so rechnet dieses Werkzeug», sondern dass die Gemeinschaft wählt', () => {
		const erweitert = NEU.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID)!;
		const gewoehnlich = NEU.knoten.find((k) => k.id === WAEHLEN_ID)!;
		const alle = [...(erweitert.hinweise ?? []), ...(gewoehnlich.hinweise ?? [])].join(' ');
		expect(alle).not.toMatch(/so rechnet dieses Werkzeug/);
		expect(erweitert.hinweise).toContain(HINWEIS_ERWEITERT);
		expect(HINWEIS_ERWEITERT).toMatch(/wird auf der Seite «Lesarten» der Gemeinschaft eingestellt/);
		// Ohne erweiterte Kompetenzen gibt es den Streit nicht; es bleibt der Satz zur Erweiterung.
		expect(gewoehnlich.hinweise).toContain(HINWEIS_GEWOEHNLICH);
		expect(HINWEIS_GEWOEHNLICH.startsWith(ERWEITERUNG)).toBe(true);
		expect(gewoehnlich.hinweise).not.toContain(HINWEIS_VORHER);
		// Die Vorfassung bleibt, wie sie war: Sie trägt gefasste Beschlüsse.
		expect(VOR.knoten.find((k) => k.id === WAEHLEN_ID)!.hinweise).toContain(HINWEIS_VORHER);
	});

	/*
	 * **Karte und Erfordernis rechnen dasselbe Mehr** (Review DeepSeek, B1):
	 * Die Ergebniskarte der Herleitung entstand aus dem Knoten der Fassung und
	 * zeigte bei umgestellter Lesart das Mehr der Vorgabe, während das
	 * qualifizierte gespeichert wurde. Gemessen an der Wahl mit erweiterten
	 * Kompetenzen und jeder Wahl des Katalogs; ein zweiter Knoten mit Lesart
	 * macht den Test rot, bis er hier seinen Pfad bekommt.
	 */
	it('baut die Ergebniskarte nach der eingestellten Lesart, wie das Erfordernis', () => {
		const mitLesart = NEU.knoten.filter((k) => k.lesart);
		expect(mitLesart.length).toBeGreaterThan(0);
		let gegenVorgabe = 0;
		for (const k of mitLesart) {
			for (const w of LESARTEN.find((l) => l.kennung === k.lesart!.kennung)!.wahlen) {
				const wahlen = { ...LESARTEN_VORGABE, [k.lesart!.kennung]: w.wert } as Lesartenwahl;
				const e = wendeLesartAn(herleiten(NEU, 'f2-1-waehlen', 'f2-1-kompetenzen-ja'), wahlen);
				const karte = ergebniskarte(NEU, knotenNachLesart(NEU, k, wahlen));
				expect({ typ: karte.typ, rechtsgrundlage: karte.rechtsgrundlage }, `${k.id} ${w.wert}`).toEqual({
					typ: e.typ,
					rechtsgrundlage: e.rechtsgrundlage
				});
				if (karte.typ !== k.typ) gegenVorgabe++;
			}
		}
		// Gegenprobe: Mindestens eine Wahl weicht vom Knoten ab, sonst mässe der Test nichts.
		expect(gegenVorgabe).toBeGreaterThan(0);
	});

	it('hält mit jeder Wahl die Regeln des Regelwerks ein, auch Wortlaut und Formel (Codeprüfung, Befund 1)', () => {
		for (const w of LESARTEN.find((l) => l.kennung === 'L4')!.wahlen) {
			const wahlen = { ...LESARTEN_VORGABE, L4: w.wert } as Lesartenwahl;
			const getauscht = { ...NEU, knoten: NEU.knoten.map((k) => knotenNachLesart(NEU, k, wahlen)) };
			expect(pruefeRegelwerk(getauscht), w.wert).toEqual([]);
		}
		const qualifiziert = knotenNachLesart(NEU, NEU.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID)!, { L1: 'bleibt', L2: 'einfach', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende', L15: 'ausserhalb', L16: 'neue_erste', L17: 'streng' });
		expect(ergebniskarte(NEU, qualifiziert).wortlautHinweis).toBe(NEU.wortlautErklaerung);
	});

	it('wirft bei einer Wahl, die der Knoten nicht kennt, wie wendeLesartAn', () => {
		const k = NEU.knoten.find((x) => x.id === WAEHLEN_ERWEITERT_ID)!;
		expect(() => knotenNachLesart(NEU, k, { L1: 'bleibt', L2: 'einfach', L4: 'unbekannt' } as unknown as Lesartenwahl)).toThrow(/kennt der Knoten/);
	});

	it('nennt in der Fallauswahl beide Mehre, wo eine Lesart entscheidet (Review DeepSeek, B2)', () => {
		const fall = waehlbareErfordernisse(NEU).find((f) => f.knotenId === WAEHLEN_ERWEITERT_ID)!;
		expect(fall.kurz).toMatch(/\(Voreinstellung\) oder .+, je nach Lesart$/);
		const gewoehnlich = waehlbareErfordernisse(NEU).find((f) => f.knotenId === WAEHLEN_ID)!;
		expect(gewoehnlich.kurz).not.toMatch(/Lesart/);
	});
});
