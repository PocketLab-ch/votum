import { describe, expect, it } from 'vitest';
import { pruefeDurchgangsfreigabe, type Freigabelage } from '../../src/lib/domain/abstimmung';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'verwaltung',
	knotenId: 'einfach',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	// Bis zum 25.09.2026 stand hier `null`: ein Erfordernis ohne Kopfschwelle,
	// das sich nicht auszählen lässt. Seit das Eröffnen daran sperrt, trägt die
	// Fixture die Schwelle, die ein einfaches Mehr wirklich hat.
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

function lage(zusatz: Partial<Freigabelage> = {}): Freigabelage {
	return {
		versammlungszustand: 'laufend',
		traktandumart: 'abstimmung',
		traktandumtitel: 'Ersatz der Gartenbank',
		erfordernis: ERFORDERNIS,
		offeneDurchgaenge: 0,
		...zusatz
	};
}

/** Der Satz der Absage, oder `null`, wenn die Freigabe durchging. */
function meldung(l: Freigabelage): string | null {
	try {
		pruefeDurchgangsfreigabe(l);
		return null;
	} catch (e) {
		return (e as Error).message;
	}
}

/** Der Fehlerschlüssel, oder `null`, wenn die Freigabe durchging. */
function schluessel(l: Freigabelage): string | null {
	try {
		pruefeDurchgangsfreigabe(l);
		return null;
	} catch (f) {
		if (f instanceof FachlicherFehler) return f.kennung;
		throw f;
	}
}

describe('Freigabe eines Abstimmungsdurchgangs', () => {
	it('lässt ein angekündigtes Traktandum durch', () => {
		expect(schluessel(lage())).toBeNull();
	});

	it.each([
		['entwurf', 'nicht_laufend'],
		['freigegeben', 'nicht_laufend'],
		['geschlossen', 'nicht_laufend']
	])('hält bei Versammlungszustand %s auf', (zustand, erwartet) => {
		expect(schluessel(lage({ versammlungszustand: zustand }))).toBe(erwartet);
	});

	it('hält bei einer Kenntnisnahme auf', () => {
		expect(schluessel(lage({ traktandumart: 'kenntnisnahme' }))).toBe('keine_abstimmung');
	});

	it('hält ohne Mehrheitserfordernis auf', () => {
		expect(schluessel(lage({ erfordernis: null }))).toBe('ohne_erfordernis');
	});

	/*
	 * **Ein unvollständiges Erfordernis sperrt wie ein fehlendes**
	 * (Produktentscheid 25.09.2026). Sonst liesse sich eröffnen, und die
	 * Auszählung würfe erst beim Schliessen, im Saal.
	 */
	it('hält auf, wenn das Erfordernis keine Kopfschwelle nennt', () => {
		expect(schluessel(lage({ erfordernis: { ...ERFORDERNIS, kopfSchwelle: null } }))).toBe(
			'ohne_schwelle'
		);
	});

	it('hält auf, wenn die Zustimmung Betroffener nötig ist und niemand eingetragen', () => {
		const e = { ...ERFORDERNIS, zustimmungBetroffenerNoetig: true };
		expect(schluessel(lage({ erfordernis: e, betroffene: 0 }))).toBe('ohne_betroffene');
		expect(schluessel(lage({ erfordernis: e }))).toBe('ohne_betroffene');
		expect(schluessel(lage({ erfordernis: e, betroffene: 1 }))).toBeNull();
	});

	it('nennt beim Betroffenenfall den Weg, den es im Saal noch gibt', () => {
		// Seit Block A2 lassen sich Betroffene im Saal eintragen, und der Satz
		// führt dorthin statt zu «heute nicht».
		try {
			pruefeDurchgangsfreigabe(
				lage({ erfordernis: { ...ERFORDERNIS, zustimmungBetroffenerNoetig: true } })
			);
			expect.unreachable();
		} catch (f) {
			expect((f as FachlicherFehler).message).toContain('bei «Betroffene» ein');
			expect((f as FachlicherFehler).message).not.toContain('nur vor der Freigabe');
		}
	});

	it('hält bei einer Kenntnisnahme als Erfordernis eines Antrags auf', () => {
		// Sonst entstand ein Durchgang ohne Ergebnis, und die erste Fassung der
		// Sperre wies mit dem falschen Grund ab («keine Kopfschwelle»).
		expect(schluessel(lage({ erfordernis: { ...ERFORDERNIS, typ: 'keine_abstimmung' } }))).toBe(
			'kenntnisnahme_als_erfordernis'
		);
	});

	it('hält auf, solange eine andere Abstimmung offen ist', () => {
		expect(schluessel(lage({ offeneDurchgaenge: 1 }))).toBe('schon_offen');
	});
});

/**
 * Die Unterscheidung aus den Migrationen 031 und 032.
 *
 * Angekündigt sein muss der **Gegenstand**, nicht jeder Antrag dazu (ZGB
 * Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3). Ein Folgeantrag, der sich im Kern des
 * angekündigten Antrags hält, darf deshalb zur Abstimmung. Über alles andere,
 * das erst im Saal auf die Liste kam, nur mit einer Ausnahme, die beim
 * Aufnehmen vermerkt wurde (Migration 127). Ein Beschluss der Anwesenden holt
 * die Ankündigung nicht nach, denn geschützt ist nicht die Versammlung, sondern
 * wer nicht da ist und auf die Traktandenliste vertraut hat.
 */
describe('Während der Sitzung aufgenommen', () => {
	it('hält ein nicht angekündigtes Geschäft auf', () => {
		expect(schluessel(lage({ spontan: true, spontanart: 'neu' }))).toBe('nicht_angekuendigt');
	});

	it('lässt einen Folgeantrag mit Grundantrag durch', () => {
		expect(
			schluessel(lage({ spontan: true, spontanart: 'folgeantrag', grundantragId: 'tr-2' }))
		).toBeNull();
	});

	it('hält einen Folgeantrag ohne Grundantrag auf', () => {
		expect(schluessel(lage({ spontan: true, spontanart: 'folgeantrag', grundantragId: null }))).toBe(
			'ohne_grundantrag'
		);
	});

	/**
	 * Ohne gesetzte Art gilt die strenge Regel. Alter Bestand trägt sie nicht,
	 * und ein fehlender Wert darf nie der mildere sein — sonst hinge die
	 * Zulässigkeit eines Beschlusses daran, dass jemand ein Feld gefüllt hat.
	 */
	it('behandelt ein Spontantraktandum ohne Art als nicht angekündigt', () => {
		expect(schluessel(lage({ spontan: true }))).toBe('nicht_angekuendigt');
		expect(schluessel(lage({ spontan: true, spontanart: null }))).toBe('nicht_angekuendigt');
	});

	it('nennt die beiden Wege, die offen bleiben', () => {
		try {
			pruefeDurchgangsfreigabe(lage({ spontan: true, spontanart: 'neu' }));
			expect.unreachable();
		} catch (f) {
			const m = (f as FachlicherFehler).message;
			expect(m).toMatch(/Folgeantrag/);
			expect(m).toMatch(/zur Kenntnis/);
			expect(m).toMatch(/nächste Versammlung/);
			// Das Geschäft steht schon auf der Liste: kein «aufnehmen» als Rat
			// (Laienprüfung 29.09.2026, L6).
			expect(m).not.toMatch(/als Kenntnisnahme auf/);
		}
	});

	/** Der Genehmigungsbeschluss half früher — er hilft nicht mehr. */
	it('lässt sich ohne vermerkte Ausnahme durch nichts heilen, was in der Versammlung geschieht', () => {
		expect(schluessel(lage({ spontan: true, spontanart: 'neu', grundantragId: 'tr-4' }))).toBe(
			'nicht_angekuendigt'
		);
	});

	/** Migration 127: Das Reglement gestattet es, vermerkt beim Aufnehmen. */
	it('lässt ein neues Geschäft mit der Ausnahme des Reglements durch', () => {
		expect(schluessel(lage({ spontan: true, spontanart: 'neu', ausnahme: 'reglement' }))).toBeNull();
	});

	/**
	 * **Die Universalversammlung** (Migration 128). Ohne mitgegebene Lage trägt
	 * der Vermerk nicht: Ein Weg, der nicht geprüft hat, öffnet nichts.
	 */
	describe('Universalversammlung', () => {
		const vollzaehlig = {
			vollzaehlig: true,
			fehlend: [],
			nurVollmacht: [],
			durchLeitung: [],
			vertreten: [],
			anzahl: 2
		};
		const universal = (u: Partial<NonNullable<Freigabelage['universal']>> = {}) =>
			lage({
				spontan: true,
				spontanart: 'neu',
				ausnahme: 'universal',
				universal: {
					variante: 'persoenlich',
					befund: vollzaehlig,
					bestaetigt: true,
					fruehererWiderspruch: false,
					...u
				}
			});

		it('trägt ohne geprüfte Lage nicht', () => {
			expect(schluessel(lage({ spontan: true, spontanart: 'neu', ausnahme: 'universal' }))).toBe(
				'universal_traegt_nicht'
			);
		});

		it('öffnet, wenn alle da sind und die Leitung bestätigt', () => {
			expect(schluessel(universal())).toBeNull();
		});

		it('öffnet ohne Bestätigung nicht, und rät dann nicht zum Aufgeben', () => {
			const satz = meldung(universal({ bestaetigt: false }));
			expect(satz).toMatch(/Bestätigen Sie zuerst/);
			expect(satz).not.toMatch(/Lässt sich das nicht erreichen/);
		});

		/** Alle Gründe auf einmal (Fachprüfung Runde 2 zu Stelle 2, L5). */
		it('nennt alle Gründe zugleich', () => {
			const satz = meldung(
				universal({
					bestaetigt: false,
					befund: {
						...vollzaehlig,
						vollzaehlig: false,
						fehlend: ['Kunz'],
						nurVollmacht: ['Muster']
					}
				})
			);
			expect(satz).toMatch(/fehlen: Kunz/);
			expect(satz).toMatch(/Nur mit Vollmacht vertreten sind: Muster/);
			expect(satz).toMatch(/Bestätigen Sie zuerst/);
			expect(satz).toMatch(/Lässt sich das nicht erreichen/);
		});

		it('öffnet nach einem früheren Widerspruch nicht nochmals', () => {
			expect(meldung(universal({ fruehererWiderspruch: true }))).toMatch(/hat jemand widersprochen/);
		});

		it('öffnet bei der Variante «keine» nicht', () => {
			expect(meldung(universal({ variante: 'keine' }))).toMatch(/keine Universalversammlung/);
		});
	});

	it('lässt die Ausnahme nur beim neuen Geschäft gelten, nicht beim Folgeantrag ohne Grundantrag', () => {
		expect(
			schluessel(
				lage({ spontan: true, spontanart: 'folgeantrag', grundantragId: null, ausnahme: 'reglement' })
			)
		).toBe('ohne_grundantrag');
	});
});
