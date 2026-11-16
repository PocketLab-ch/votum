/**
 * Die Lesart am Knoten seiner Fassung, nicht an der Vorgabe des Katalogs
 * (Entscheid 0048, Block A; Auftrag `.auftraege/2026-11-13-votum-a-lesart-am-knoten.md`).
 *
 * Bis Block A fragte die Rechnung «rechnet dieser Knoten die Wahl W?» an der
 * einen Vorgabe je Lesart. Stellt eine spätere Fassung die Vorgabe um (Block B:
 * L4 auf «qualifiziert»), rechnet der Knoten einer früheren Fassung weiter das
 * einfache Mehr. Gemessen wird an einem nachgebauten Knoten, der die
 * Nicht-Vorgabe rechnet: eine Kopie von `k-bewirtschaftung-waehlen-erweitert`
 * mit vertauschtem Mehr und `andere` = einfach. Auf dem Stand vor Block A wird
 * er rot (Gegenprobe im Auftrag, Kriterium 6).
 *
 * **Seit Block B ist das kein Nachbau mehr, sondern der Fall** (Fassung
 * 2026-11-13, Entscheid 0048): Die Vorgabe von L4 ist «qualifiziert», und der
 * Knoten der Fassung 2026-11-11 rechnet die Nicht-Vorgabe «einfach». Gemessen
 * wird deshalb an der Fassung 2026-11-11 (`BASIS`), nicht an der aktuellen:
 * Ihr Knoten ist der, den alte Traktanden tragen.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, FASSUNGEN, holeRegelwerk, knotenDerFassung } from '$lib/rules';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import {
	knotenNachLesart,
	LESARTEN,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenImRegelwerk,
	wahlDesKnotens,
	wahlOhneGespeicherte,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';

const ID = 'k-bewirtschaftung-waehlen-erweitert';
const AKTUELL = holeRegelwerk();
/** Die letzte Fassung, deren Knoten das einfache Mehr rechnet (Block A). */
const BASIS = holeRegelwerk('2026-11-11');
const ORIGINAL = BASIS.knoten.find((k) => k.id === ID)!;

/** Der Knoten, wie ihn eine Fassung mit der Vorgabe «qualifiziert» trüge. */
function nachgebaut(): Ergebnisknoten {
	return {
		...ORIGINAL,
		typ: 'qualifiziertes_mehr',
		rechtsgrundlage: ORIGINAL.lesart!.andere.rechtsgrundlage,
		kopfbasis: 'anwesend_vertreten',
		quotenbasis: 'alle_quoten',
		lesart: {
			kennung: 'L4',
			andere: {
				wahl: 'einfach',
				typ: 'einfaches_mehr',
				rechtsgrundlage: ORIGINAL.rechtsgrundlage,
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine'
			}
		}
	};
}

/** Eine Fassung mit dem nachgebauten Knoten, die nicht die aktuelle ist. */
function frueher(k = nachgebaut()): Regelwerk {
	return { ...BASIS, fassung: 'nachbau-vorgabe-gewechselt', knoten: BASIS.knoten.map((x) => (x.id === ID ? k : x)) };
}

const mit = (L4: string) => ({ ...LESARTEN_VORGABE, L4 }) as Lesartenwahl;

describe('knotenNachLesart misst die Wahl am Knoten (Kriterien 1, 2 und 6)', () => {
	it('lässt den Knoten bei seiner eigenen Wahl stehen, auch wenn sie nicht die Vorgabe ist', () => {
		// Seit Block B die Vorgabe «qualifiziert»: Der Knoten der Fassung 2026-11-11
		// rechnet «einfach», die Nicht-Vorgabe, und bleibt bei ihr stehen.
		expect(lesartVon('L4')!.vorgabe).toBe('qualifiziert');
		expect(knotenNachLesart(BASIS, ORIGINAL, mit('einfach'))).toBe(ORIGINAL);
		const rw = frueher();
		const k = rw.knoten.find((x) => x.id === ID)!;
		expect(knotenNachLesart(rw, k, mit('qualifiziert'))).toBe(k);
	});

	it('wahlDesKnotens liest die Wahl am Mehr des Knotens', () => {
		expect(wahlDesKnotens(nachgebaut())).toBe('qualifiziert');
		expect(wahlDesKnotens(ORIGINAL)).toBe('einfach');
	});

	it('tauscht bei der anderen Wahl, auch wenn die andere die Vorgabe ist', () => {
		const rw = frueher();
		const k = rw.knoten.find((x) => x.id === ID)!;
		const getauscht = knotenNachLesart(rw, k, mit('einfach'));
		expect(getauscht).not.toBe(k);
		expect(getauscht).toMatchObject({
			typ: 'einfaches_mehr',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			rechtsgrundlage: ORIGINAL.rechtsgrundlage
		});
	});

	it('wirft weiter bei einer unbekannten Wahl', () => {
		const rw = frueher();
		const k = rw.knoten.find((x) => x.id === ID)!;
		expect(() => knotenNachLesart(rw, k, mit('zwei_drittel'))).toThrow(/kennt der Knoten/);
		expect(() => knotenNachLesart(BASIS, ORIGINAL, mit('zwei_drittel'))).toThrow(/kennt der Knoten/);
	});

	it('wirft, wenn der Knoten keine Wahl des Katalogs rechnet, statt eine anzunehmen', () => {
		const k = { ...nachgebaut(), typ: 'einstimmigkeit' as const };
		expect(() => knotenNachLesart(frueher(k), k, mit('einfach'))).toThrow(/rechnet nicht genau eine Wahl/);
		expect(() => wahlDesKnotens(k)).toThrow(/rechnet nicht genau eine Wahl des Katalogs/);
	});

	it('trägt die Wahl des Knotens ans Erfordernis, «vorgabe» bleibt Herkunft', () => {
		const rw = frueher();
		const e = erfordernisAusKnoten(rw, rw.knoten.find((x) => x.id === ID)!);
		// Seit Block B ist «qualifiziert» die Vorgabe, «einfach» nicht mehr.
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L4', wahl: 'qualifiziert', vorgabe: true });
		expect(e.gemeinschaftslesart!.andere).toMatchObject({ wahl: 'einfach', typ: 'einfaches_mehr' });
		expect(wendeLesartAn(e, mit('qualifiziert'))).toBe(e);
		expect(wendeLesartAn(e, mit('einfach'))).toMatchObject({
			typ: 'einfaches_mehr',
			gemeinschaftslesart: { wahl: 'einfach', vorgabe: false, andere: { wahl: 'qualifiziert' } }
		});
		// Der Knoten der Fassung 2026-11-11 trägt «einfach» ans Erfordernis, nicht mehr als Vorgabe.
		expect(erfordernisAusKnoten(BASIS, ORIGINAL).gemeinschaftslesart).toMatchObject({ wahl: 'einfach', vorgabe: false });
	});
});

describe('pruefeLesartenImRegelwerk je Fassung (Kriterium 3)', () => {
	it('ist für alle Fassungen ohne Befund', () => {
		for (const f of Object.keys(FASSUNGEN)) expect(pruefeLesartenImRegelwerk(holeRegelwerk(f), AKTUELLE_FASSUNG), f).toEqual([]);
	});

	it('nimmt an einer früheren Fassung einen Knoten, der die Nicht-Vorgabe rechnet, ohne Befund', () => {
		expect(pruefeLesartenImRegelwerk(frueher(), AKTUELLE_FASSUNG)).toEqual([]);
	});

	it('verlangt die Vorgabe nur an der aktuellen Fassung', () => {
		// Der Knoten der Fassung 2026-11-11, als stünde er in der aktuellen.
		const rw = { ...BASIS, fassung: AKTUELLE_FASSUNG };
		const befunde = pruefeLesartenImRegelwerk(rw, AKTUELLE_FASSUNG).join();
		expect(befunde).toMatch(/rechnet nicht die Vorgabe «qualifiziert»/);
		expect(befunde).toMatch(/andere Wahl ist die Vorgabe/);
		expect(pruefeLesartenImRegelwerk(BASIS, AKTUELLE_FASSUNG)).toEqual([]);
		expect(pruefeLesartenImRegelwerk({ ...frueher(), fassung: AKTUELLE_FASSUNG }, AKTUELLE_FASSUNG)).toEqual([]);
	});

	it('meldet an jeder Fassung, was nicht zum Katalog passt', () => {
		const befund = (k: Ergebnisknoten) => pruefeLesartenImRegelwerk(frueher(k), AKTUELLE_FASSUNG).join();
		const n = nachgebaut();
		expect(befund({ ...n, lesart: { ...n.lesart!, kennung: 'L99' as 'L4' } })).toMatch(/unbekannte Lesart «L99»/);
		expect(befund({ ...n, lesart: { ...n.lesart!, andere: { ...n.lesart!.andere, wahl: 'halb' } } })).toMatch(
			/Die Wahl «halb» steht nicht im Katalog/
		);
		expect(befund({ ...n, typ: 'einstimmigkeit' })).toMatch(/rechnet keine Wahl des Katalogs zu L4/);
		// `andere` nennt die Wahl, die der Knoten selbst rechnet.
		expect(
			befund({
				...n,
				lesart: { ...n.lesart!, andere: { ...n.lesart!.andere, wahl: 'qualifiziert', typ: 'qualifiziertes_mehr', quotenbasis: 'alle_quoten' } }
			})
		).toMatch(/«andere» nennt die Wahl «qualifiziert», die der Knoten selbst rechnet/);
		expect(befund({ ...n, lesart: { ...n.lesart!, andere: { ...n.lesart!.andere, quotenbasis: 'alle_quoten' } } })).toMatch(
			/«andere» rechnet nicht die Wahl «einfach»/
		);
		// Und an einer früheren Fassung nichts zur Vorgabe.
		expect(befund({ ...n, typ: 'einstimmigkeit' })).not.toMatch(/Vorgabe/);
	});
});

/*
 * **Kein Ergebnis ändert sich** (Kriterium 5). Für jede Fassung, die es bei
 * Block A gab, jeden Knoten mit Lesart und jede Wahl des Katalogs: dieselbe
 * Antwort wie die Rechnung vor Block A, die an der Vorgabe mass. Die Vorgaben
 * stehen hier fest, wie sie bei Block A galten, damit Block B mit der neuen
 * Vorgabe für L4 diesen Vergleich nicht verschiebt.
 */
const VORGABE_BEI_BLOCK_A: Readonly<Record<string, string>> = {
	L2: 'einfach',
	L4: 'einfach',
	L6: 'klausel',
	L9: 'alle',
	L11: 'qualifiziert',
	L12: 'alle', L13: 'anwesende'
};
const BIS_BLOCK_A = Object.keys(FASSUNGEN).filter((f) => f <= '2026-11-11');

describe('dieselbe Antwort wie vor Block A (Kriterium 5)', () => {
	it('für jede Fassung, jeden Knoten mit Lesart und jede Wahl', () => {
		let gezaehlt = 0;
		for (const f of BIS_BLOCK_A) {
			const rw = holeRegelwerk(f);
			for (const k of rw.knoten.filter((x) => x.lesart)) {
				const l = k.lesart!;
				const vorgabe = VORGABE_BEI_BLOCK_A[l.kennung];
				for (const w of [...lesartVon(l.kennung)!.wahlen.map((x) => x.wert), 'unbekannt']) {
					const was = `${f} ${k.id} ${w}`;
					const wahlen = { ...LESARTEN_VORGABE, [l.kennung]: w } as Lesartenwahl;
					gezaehlt++;
					if (w === vorgabe) {
						expect(knotenNachLesart(rw, k, wahlen), was).toBe(k);
					} else if (w === l.andere.wahl) {
						const r = knotenNachLesart(rw, k, wahlen);
						expect(r, was).not.toBe(k);
						expect(r, was).toMatchObject({ typ: l.andere.typ, kopfbasis: l.andere.kopfbasis, quotenbasis: l.andere.quotenbasis });
					} else {
						expect(() => knotenNachLesart(rw, k, wahlen), was).toThrow(/kennt der Knoten/);
					}
				}
				// Am Erfordernis: die Wahl wie bisher die Vorgabe von Block A. Als Vorgabe
				// ausgewiesen ist sie, wo der Katalog sie noch so führt; bei L4 seit Block B
				// nicht mehr (`vorgabe` ist Herkunft am heutigen Katalog).
				expect(erfordernisAusKnoten(rw, k).gemeinschaftslesart, `${f} ${k.id}`).toMatchObject({
					wahl: vorgabe,
					vorgabe: vorgabe === lesartVon(l.kennung)!.vorgabe
				});
			}
		}
		expect(gezaehlt).toBe(93);
	});
});

/*
 * **Ein Traktandum ohne gespeicherte Wahl** (Kriterium 4): Es rechnet, was der
 * Knoten seiner Fassung rechnet, ohne ihn das gespeicherte Mehr. Freigabe und
 * Kasten «Erfordernisse nachziehen» fragen beide `wahlOhneGespeicherte`.
 */
describe('wahlOhneGespeicherte (Kriterium 4)', () => {
	const leer = { typ: null, kopfbasis: null, quotenbasis: null };

	it('nimmt die Wahl am Knoten der Fassung, nicht die Vorgabe', () => {
		expect(wahlOhneGespeicherte('L4', nachgebaut(), leer)).toBe('qualifiziert');
		expect(wahlOhneGespeicherte('L4', ORIGINAL, leer)).toBe('einfach');
		// Der Knoten geht dem gespeicherten Mehr vor.
		expect(wahlOhneGespeicherte('L4', ORIGINAL, { typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'alle_quoten' })).toBe('einfach');
	});

	it('ohne Knoten das gespeicherte Mehr, und ohne beides keine Wahl', () => {
		expect(wahlOhneGespeicherte('L4', undefined, { typ: 'qualifiziertes_mehr', kopfbasis: 'anwesend_vertreten', quotenbasis: 'alle_quoten' })).toBe('qualifiziert');
		expect(wahlOhneGespeicherte('L4', undefined, { typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer', quotenbasis: 'keine' })).toBeUndefined();
		expect(wahlOhneGespeicherte('L4', undefined, leer)).toBeUndefined();
		expect(wahlOhneGespeicherte('L99', ORIGINAL, leer)).toBeUndefined();
	});

	/*
	 * **Wo die Antwort von der Vorgabe abweicht, und warum das richtig ist.**
	 * Vor Block A galt jedes Traktandum ohne Wahl als «nach der Vorgabe». An
	 * sechs frühen Fassungen rechnete der Knoten aber die andere Wahl:
	 * `k-zustaendigkeit-gewoehnlich` in 2026-08-16, 09-21 und 09-22 das
	 * qualifizierte Mehr, `k-prozessfuehrung` in 2026-07-30, 08-05 und 08-15 das
	 * einfache. Dort nennt die Freigabe jetzt die Wahl, die das Traktandum
	 * tatsächlich rechnet. An allen übrigen Fassungen ist die Antwort die
	 * Vorgabe von Block A, wie bisher.
	 */
	it('an jeder Fassung die Wahl, die ihr Knoten rechnet; nur sechs frühe weichen von der Vorgabe ab', () => {
		const abweichend: string[] = [];
		for (const a of AKTUELL.knoten.filter((k) => k.lesart)) {
			for (const f of BIS_BLOCK_A) {
				const k = knotenDerFassung(f, a.id);
				if (!k) continue;
				const wahl = wahlOhneGespeicherte(a.lesart!.kennung, k, leer);
				expect(wahl, `${f} ${a.id}`).toBeDefined();
				if (wahl !== VORGABE_BEI_BLOCK_A[a.lesart!.kennung]) abweichend.push(`${f} ${a.id} ${wahl}`);
			}
		}
		expect(abweichend.sort()).toEqual([
			'2026-07-30 k-prozessfuehrung einfach',
			'2026-08-05 k-prozessfuehrung einfach',
			'2026-08-15 k-prozessfuehrung einfach',
			'2026-08-16 k-zustaendigkeit-gewoehnlich qualifiziert',
			'2026-09-21 k-zustaendigkeit-gewoehnlich qualifiziert',
			'2026-09-22 k-zustaendigkeit-gewoehnlich qualifiziert'
		]);
	});
});

/*
 * Die Vorgabe steht zweimal: am Katalog (`vorgabe` je Lesart) und als
 * `LESARTEN_VORGABE`, die Wahl einer Gemeinschaft ohne Einstellung. Stellt
 * eine Fassung die Vorgabe um (Block B, L4), müssen beide mitgehen; sonst
 * zeigte die Seite «(Vorgabe)» an einer Wahl, die eine Momentaufnahme ohne
 * Lesarten nicht nimmt (Codeprüfung Block A, Befund 4, als Klasse).
 */
describe('zwei Träger der Vorgabe', () => {
	it('LESARTEN_VORGABE gleicht je Lesart der Vorgabe im Katalog', () => {
		const ungleich = LESARTEN.filter(
			(l) => LESARTEN_VORGABE[l.kennung as keyof Lesartenwahl] !== l.vorgabe
		).map((l) => l.kennung);
		expect(ungleich).toEqual([]);
		expect(Object.keys(LESARTEN_VORGABE).sort()).toEqual(LESARTEN.map((l) => l.kennung).sort());
	});
});
