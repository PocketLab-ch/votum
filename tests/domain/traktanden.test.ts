import { describe, expect, it } from 'vitest';
import {
	aendereTraktandum,
	entferneTraktandum,
	hinweiseZu,
	legeTraktandumAn,
	pruefeTraktandum,
	SCHWELLE_KURZFASSUNG,
	setzeTraktandumErfordernis,
	type Traktandum,
	type TraktandumEingabe
} from '../../src/lib/domain/traktanden';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';

function eingabe(u: Partial<TraktandumEingabe> = {}): TraktandumEingabe {
	return {
		meetingId: 'v-1',
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte Meier AG saniert.',
		antragstellerart: 'bewirtschaftung',
		...u
	};
}

function traktandum(u: Partial<TraktandumEingabe> = {}): Traktandum {
	return legeTraktandumAn('t-1', 'op-1', 1, eingabe(u)).ergebnis;
}

function erfordernis(u: Partial<Erfordernis> = {}): Erfordernis {
	return {
		fassung: '2026-07-30',
		juristischGegengelesen: false,
		astId: 'a-baulich',
		knotenId: 'k-baulich-nuetzlich',
		typ: 'qualifiziertes_mehr',
		titel: 'Qualifiziertes Mehr',
		rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
		kopfbasis: 'alle_eigentuemer',
		quotenbasis: 'alle_quoten',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'hergeleitet',
		...u
	};
}

describe('Erfassen', () => {
	it('nimmt ein vollständiges Traktandum an', () => {
		const u = legeTraktandumAn('t-1', 'op-1', 1, eingabe());
		expect(u.ergebnis.titel).toBe('Sanierung der Fassade');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.traktandumAngelegt);
	});

	it('verlangt einen Titel', () => {
		expect(() => pruefeTraktandum(eingabe({ titel: 'ab' }))).toThrow(/Titel/);
	});

	it('verlangt bei einer Abstimmung den Antragswortlaut', () => {
		// Ohne ihn stünde im Protokoll, es sei «dem Antrag zugestimmt worden» —
		// ohne dass irgendwo stünde, welchem.
		expect(() => pruefeTraktandum(eingabe({ antragswortlaut: '  ' }))).toThrow(/Antragswortlaut/);
	});

	it('verwirft den Wortlaut bei einer Kenntnisnahme, statt ihn mitzuschleppen', () => {
		const g = pruefeTraktandum(
			eingabe({ art: 'kenntnisnahme', antragswortlaut: 'irrtümlich erfasst' })
		);
		expect(g.antragswortlaut).toBeUndefined();
	});

	it('lässt die Kenntnisnahme ohne Wortlaut zu', () => {
		expect(pruefeTraktandum(eingabe({ art: 'kenntnisnahme', antragswortlaut: undefined })).art).toBe(
			'kenntnisnahme'
		);
	});

	it('verlangt bei einem Antrag eines Eigentümers, welcher', () => {
		expect(() => pruefeTraktandum(eingabe({ antragstellerart: 'eigentuemer' }))).toThrow(
			/welcher/
		);
	});

	it('verlangt bei einer Untergemeinschaft, welche', () => {
		expect(() => pruefeTraktandum(eingabe({ antragstellerart: 'untergemeinschaft' }))).toThrow(
			/welcher/
		);
	});

	it('verlangt bei Bewirtschaftung und Gemeinschaft keine Person', () => {
		expect(pruefeTraktandum(eingabe({ antragstellerart: 'gemeinschaft' })).antragstellerId).toBeNull();
	});

	it('weist eine unbekannte Antragstellerart ab', () => {
		expect(() =>
			pruefeTraktandum(eingabe({ antragstellerart: 'nachbar' as never }))
		).toThrow(/Antragsteller/);
	});
});

describe('Hinweise, die nicht blockieren', () => {
	it('mahnt eine fehlende Kurzfassung bei langem Inhalt an', () => {
		const h = hinweiseZu({
			art: 'abstimmung',
			inhalt: 'x'.repeat(SCHWELLE_KURZFASSUNG + 1),
			kurzfassung: undefined
		});
		expect(h.map((x) => x.feld)).toContain('kurzfassung');
	});

	it('mahnt sie bei kurzem Inhalt nicht an', () => {
		const h = hinweiseZu({ art: 'abstimmung', inhalt: 'kurz', kurzfassung: undefined });
		expect(h.map((x) => x.feld)).not.toContain('kurzfassung');
	});

	it('blockiert nie — ein Traktandum kommt auch ohne Kurzfassung aus', () => {
		expect(() =>
			pruefeTraktandum(eingabe({ inhalt: 'y'.repeat(SCHWELLE_KURZFASSUNG + 1) }))
		).not.toThrow();
	});

	it('meldet eine Ausschlussklage ohne beklagte Partei schon im Entwurf', () => {
		const e = { knotenId: 'k-ausschlussklage' } as Erfordernis;
		expect(hinweiseZu({ art: 'abstimmung' }, e, []).map((x) => x.feld)).toContain('betroffene');
		expect(hinweiseZu({ art: 'abstimmung' }, e, ['p1']).map((x) => x.feld)).not.toContain(
			'betroffene'
		);
	});

	it('meldet ein fehlendes Mehrheitserfordernis bei einer Abstimmung', () => {
		expect(hinweiseZu({ art: 'abstimmung' }, null).map((x) => x.feld)).toContain('erfordernis');
	});

	it('meldet es bei einer Kenntnisnahme nicht', () => {
		expect(hinweiseZu({ art: 'kenntnisnahme' }, null).map((x) => x.feld)).not.toContain(
			'erfordernis'
		);
	});

	it('meldet fehlende Betroffene, wo das Erfordernis ihre Zustimmung verlangt', () => {
		const h = hinweiseZu(
			{ art: 'abstimmung' },
			erfordernis({ zustimmungBetroffenerNoetig: true }),
			[]
		);
		expect(h.map((x) => x.feld)).toContain('betroffene');
	});

	it('schweigt, sobald jemand zugewiesen ist', () => {
		const h = hinweiseZu(
			{ art: 'abstimmung' },
			erfordernis({ zustimmungBetroffenerNoetig: true }),
			['p-1']
		);
		expect(h.map((x) => x.feld)).not.toContain('betroffene');
	});

	it('mahnt einen Grenzfall an, weil er vor der Einladung zu entscheiden ist', () => {
		const h = hinweiseZu({ art: 'abstimmung' }, erfordernis({ typ: 'grenzfall' }));
		expect(h.some((x) => x.text.includes('Grenzfall'))).toBe(true);
	});
});

describe('Ändern', () => {
	it('hält fest, welche Felder sich geändert haben', () => {
		const u = aendereTraktandum(traktandum(), eingabe({ titel: 'Sanierung des Dachs' }));
		expect(Object.keys(u.ereignisse[0].angaben?.felder as object)).toEqual(['titel']);
	});

	it('erzeugt keinen Eintrag ohne Änderung', () => {
		expect(aendereTraktandum(traktandum(), eingabe()).ereignisse).toHaveLength(0);
	});

	it('meldet auch eine geänderte Menge Betroffener', () => {
		const u = aendereTraktandum(traktandum(), eingabe({ betroffeneParteiIds: ['p-1'] }));
		expect(Object.keys(u.ereignisse[0].angaben?.felder as object)).toContain('betroffene');
	});

	it('nimmt die Kennzeichnung «übernommen» beim Bearbeiten weg', () => {
		// Sie sagt, dass der Text der von damals ist. Nach einer Änderung wäre sie
		// eine Falschauskunft.
		const t: Traktandum = {
			...traktandum(),
			uebernommenAus: { versammlungId: 'v-0', datum: '2025-09-15' }
		};
		expect(aendereTraktandum(t, eingabe({ titel: 'Neu' })).ergebnis.uebernommenAus).toBeNull();
	});

	it('behält den Elternteil, den die Eingabe nennt, nicht', () => {
		// Bearbeiten schreibt `parent_id` nicht; ein Ergebnis mit dem Elternteil
		// aus dem Formular gäbe einen Stand wieder, den die Zeile nie hatte.
		const t = traktandum({ parentId: 't-eltern' });
		const u = aendereTraktandum(t, eingabe({ titel: 'Neu', parentId: 't-anderswo' }));
		expect(u.ergebnis.parentId).toBe('t-eltern');
		expect(JSON.stringify(u.ereignisse)).not.toContain('t-anderswo');
	});
});

describe('Entfernen', () => {
	it('entfernt ein Blatt', () => {
		const u = entferneTraktandum(traktandum(), 0);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.traktandumEntfernt);
	});

	it('weist das Entfernen eines Traktandums mit Untertraktanden ab', () => {
		// Sonst verschwänden Geschäfte, an die niemand gedacht hat.
		expect(() => entferneTraktandum(traktandum(), 2)).toThrow(/Untertraktanden/);
	});
});

describe('Mehrheitserfordernis am Traktandum', () => {
	it('setzt es und schreibt Fassung und Quelle in den Verlauf', () => {
		const u = setzeTraktandumErfordernis(traktandum(), erfordernis());
		expect(u.ergebnis.erfordernis?.typ).toBe('qualifiziertes_mehr');
		expect(u.ereignisse[0].angaben).toMatchObject({ fassung: '2026-07-30', quelle: 'hergeleitet' });
	});

	it('weist es bei einer Kenntnisnahme ab', () => {
		// Sonst entstünde bei der Auswertung ein Beschluss, den niemand fassen wollte.
		const t = traktandum({ art: 'kenntnisnahme', antragswortlaut: undefined });
		expect(() => setzeTraktandumErfordernis(t, erfordernis())).toThrow(FachlicherFehler);
	});
});
