/**
 * Archivieren: die Regeln, die nicht in der Datenbank stehen dürfen.
 *
 * Warum sie hier stehen und nicht als CHECK: Eine Schranke der Datenbank ist
 * keine Fehlermeldung — und ein CHECK über den Versammlungszustand schlüge
 * später ein zweites Mal zu, beim Freigeben eines archivierten Entwurfs.
 */
import { describe, expect, it } from 'vitest';
import {
	archivhinweis,
	pruefeArchivieren,
	pruefeEigentuemerArchivierbar,
	pruefeHervorholen,
	versammlungArchivierbar
} from '$lib/domain/archivieren';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

describe('Archivieren', () => {
	it('lässt nur die versiegelte Versammlung zu', () => {
		// Auftraggeber, 25.08.2026: «Archivieren erst was versiegelt wurde.»
		expect(versammlungArchivierbar('versiegelt')).toBeNull();
	});

	it('sperrt jeden anderen Zustand — und nennt je einen eigenen Weg heraus', () => {
		expect(versammlungArchivierbar('laufend')).toContain('läuft gerade');
		/*
		 * Bei der freigegebenen steht der Weg heraus im Satz: eröffnen, die
		 * Beschlussunfähigkeit feststellen, schliessen, versiegeln; ohne
		 * Vollmacht zusätzlich die Rücknahme der Freigabe. Ein blosses «geht
		 * nicht» hilft niemandem. «Halten Sie den Ausfall fest» stand dort bis
		 * zum 03.10.2026 und nannte einen Weg, den es nicht gibt.
		 */
		const freigegeben = versammlungArchivierbar('freigegeben');
		expect(freigegeben).toContain('Einladungen');
		expect(freigegeben).toContain('Beschlussunfähigkeit');
		expect(freigegeben).not.toContain('Ausfall festhalten');
		// Der Entwurf gehört gelöscht, nicht aufbewahrt — sonst wird das Archiv
		// zum Papierkorb.
		expect(versammlungArchivierbar('entwurf')).toContain('entfernt');
		// Die geschlossene ist unfertig: Das Siegel ist der Nachweis.
		expect(versammlungArchivierbar('geschlossen')).toContain('versiegel');
	});

	/*
	 * **Die Rücknahme nur nennen, wenn sie noch geht** (Nachzug Block 3,
	 * Entscheid E vom 03.10.2026). Mit der ersten Vollmacht ist die Freigabe
	 * endgültig; ein Satz, der weiter zur Rücknahme rät, schickt die Leitung in
	 * eine Absage. Der Zustand ist derselbe, der Weg ein anderer.
	 */
	it('nennt die Rücknahme der Freigabe nur, solange keine Vollmacht hängt', () => {
		const ohne = versammlungArchivierbar('freigegeben');
		expect(ohne).toMatch(/Freigabe zurück/);
		expect(ohne).toContain('Beschlussunfähigkeit');

		const mitVollmacht = versammlungArchivierbar('freigegeben', true);
		expect(mitVollmacht).not.toMatch(/Freigabe zurück/);
		expect(mitVollmacht, 'der Weg über den Saal bleibt').toContain('Beschlussunfähigkeit');
	});

	it('reicht die Vollmachten durch `pruefeArchivieren` durch', () => {
		const fangen = () => {
			try {
				pruefeArchivieren({
					art: 'versammlung',
					name: 'Prüfweg',
					archiviertAm: null,
					zustand: 'freigegeben',
					vollmachtenHaengen: true
				});
				return null;
			} catch (fehler) {
				return fehler as FachlicherFehler;
			}
		};
		const fehler = fangen();
		expect(fehler?.kennung).toBe('nicht_archivierbar');
		expect(fehler?.message).not.toMatch(/Freigabe zurück/);
	});

	it('weist ein zweites Archivieren ab', () => {
		expect(() =>
			pruefeArchivieren({ art: 'gemeinschaft', name: 'Probehalde', archiviertAm: '2026-08-01' })
		).toThrow(FachlicherFehler);
	});

	it('weist das Hervorholen ab, was gar nicht im Archiv liegt', () => {
		expect(() =>
			pruefeHervorholen({ art: 'person', name: 'Anna Muster', archiviertAm: null })
		).toThrow(FachlicherFehler);
	});

	it('lässt eine Eigentümerzeile ohne Einheiten ins Archiv', () => {
		expect(() => pruefeEigentuemerArchivierbar('Anna Muster', [])).not.toThrow();
	});

	it('sperrt eine Eigentümerzeile, der noch Einheiten zugeordnet sind', () => {
		/*
		 * **Die wichtigste Schranke des Bausteins.** `stimmkraftAnsicht` fragt
		 * nicht nach dem Archiv — sie baut die Momentaufnahme. Wer eine Zeile mit
		 * laufender Zuordnung archivierte, hätte sie aus der Liste und trotzdem in
		 * der Abstimmung; oder, wenn die Rechnung filterte, verlöre sie ihre
		 * Stimme lautlos.
		 */
		try {
			pruefeEigentuemerArchivierbar('Anna Muster', ['Whg 1', 'PP 3']);
			throw new Error('hätte werfen müssen');
		} catch (fehler) {
			expect(fehler).toBeInstanceOf(FachlicherFehler);
			const f = fehler as FachlicherFehler;
			// Die Einheiten stehen im Satz — «geht nicht» sagt nicht, welche.
			expect(f.message).toContain('Whg 1');
			expect(f.message).toContain('PP 3');
			// Und der Weg heraus.
			expect(f.message).toContain('Zuordnung');
		}
	});

	it('sagt «dazu» nur, wenn gesucht wurde', () => {
		// Ohne Suchbegriff zeigte «die dazu passen» auf nichts (25.08.2026).
		expect(archivhinweis('gemeinschaft', 2, false)).toBe('Im Archiv liegen 2 Gemeinschaften.');
		expect(archivhinweis('gemeinschaft', 1, false)).toBe('Im Archiv liegt 1 Gemeinschaft.');
		expect(archivhinweis('gemeinschaft', 2, true)).toContain('die dazu passen');
		expect(archivhinweis('gemeinschaft', 0, false)).toBeNull();
	});

	it('zählt im Archivhinweis richtig — Einzahl, Mehrzahl, nichts', () => {
		expect(archivhinweis('gemeinschaft', 0, true)).toBeNull();
		expect(archivhinweis('gemeinschaft', 1, true)).toContain('1 Gemeinschaft');
		expect(archivhinweis('gemeinschaft', 3, true)).toContain('3 Gemeinschaften');
		expect(archivhinweis('versammlung', 2, true)).toContain('2 Versammlungen');
	});
});
