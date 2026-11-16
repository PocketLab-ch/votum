/**
 * Die Weisungsregel: wie ein Haus zu der einen Stimme kommt, die es in einer
 * Miteigentümergemeinschaft hat.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Also wie viele Kopfstimmen braucht es in
 * % oder im Verhältnis. Dasselbe wenn WQ auch abgebildet ist. Also K und oder
 * WQ.» — und für den Fall ohne Beschluss: «Enthaltung oder Nein als Auswahl
 * anbieten.»
 */
import { describe, expect, it } from 'vitest';
import {
	erfordernisAusWeisungsregel,
	haltungOhneBeschluss,
	ohneBeschlussInWorten,
	pruefeWeisungsregel,
	weisungsregelInWorten,
	type WeisungsregelEingabe
} from '$lib/domain/weisungsregel';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const EINFACH: WeisungsregelEingabe = {
	stwegId: 'g-1',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	kopfbasis: 'anwesend_vertreten',
	quotenSchwelle: null,
	quotenbasis: 'keine',
	fundstelle: 'Art. 7 Ziff. 3',
	enthaltungZaehltMit: true,
	ohneBeschluss: 'enthaltung'
};

describe('Die Weisungsregel', () => {
	it('nimmt das einfache Mehr — der Fall des Auftraggebers', () => {
		const r = pruefeWeisungsregel(EINFACH);
		expect(weisungsregelInWorten(r)).toContain('anwesenden oder vertretenen Stimmen');
		expect(haltungOhneBeschluss(r)).toBe('enthaltung');
	});

	it('nimmt ein qualifiziertes Mehr mit Kopfstimmen UND Wertquoten', () => {
		const r = pruefeWeisungsregel({
			...EINFACH,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'alle_quoten'
		});
		const satz = weisungsregelInWorten(r);
		expect(satz).toContain('aller Eigentümer');
		expect(satz).toContain('und zugleich');
		expect(satz).toContain('Wertquoten');
	});

	it('weist eine Wertquotenschwelle ohne Bezugsgrösse ab', () => {
		// Eine Schwelle, die gegen nichts misst, sähe aus wie eine Prüfung.
		expect(() =>
			pruefeWeisungsregel({
				...EINFACH,
				quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
				quotenbasis: 'keine'
			})
		).toThrow(FachlicherFehler);
	});

	it('weist eine Bezugsgrösse ohne Schwelle ab', () => {
		expect(() =>
			pruefeWeisungsregel({ ...EINFACH, quotenSchwelle: null, quotenbasis: 'alle_quoten' })
		).toThrow(FachlicherFehler);
	});

	it('verlangt die Fundstelle', () => {
		// Ohne sie steht im Protokoll eine Regel, die niemand nachschlagen kann.
		expect(() => pruefeWeisungsregel({ ...EINFACH, fundstelle: '  ' })).toThrow(FachlicherFehler);
	});

	it('weist unmögliche Brüche ab', () => {
		expect(() =>
			pruefeWeisungsregel({ ...EINFACH, kopfSchwelle: { zaehler: 3, nenner: 2, art: 'mehr_als' } })
		).toThrow(FachlicherFehler);
		expect(() =>
			pruefeWeisungsregel({
				...EINFACH,
				kopfSchwelle: { zaehler: 1, nenner: 200, art: 'mehr_als' }
			})
		).toThrow(FachlicherFehler);
	});

	it('sagt, was ohne Beschluss gilt — beide Fälle', () => {
		expect(ohneBeschlussInWorten(EINFACH)).toContain('enthält es sich');
		expect(haltungOhneBeschluss({ ...EINFACH, ohneBeschluss: 'nein' })).toBe('nein');
		expect(ohneBeschlussInWorten({ ...EINFACH, ohneBeschluss: 'nein' })).toContain('Nein');
	});

	it('wird zu einem Erfordernis, das die Fundstelle mitträgt', () => {
		/*
		 * **Ein Erfordernis, keine zweite Auszählung.** Das Haus stimmt danach ab,
		 * sein Beschluss ist die Weisung. Die Fundstelle wandert mit ins
		 * Protokoll — sonst stünde dort eine Schwelle ohne Grundlage.
		 */
		const e = erfordernisAusWeisungsregel({ ...pruefeWeisungsregel(EINFACH), id: 'r-1' });
		expect(e.quelle).toBe('reglement');
		expect(e.fundstelle).toBe('Art. 7 Ziff. 3');
		expect(e.rechtsgrundlage).toContain('Art. 7 Ziff. 3');
		expect(e.kopfSchwelle).toEqual(EINFACH.kopfSchwelle);
		expect(e.quotenSchwelle).toBeNull();
		// Kein Ast des Entscheidbaums: «Weisung» ist keine Geschäftsart.
		expect(e.geschaeftsart).toBeUndefined();
		expect(e.juristischGegengelesen).toBe(false);
	});
});
