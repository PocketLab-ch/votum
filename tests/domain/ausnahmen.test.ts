/**
 * Die Ausnahmen bei nicht angekündigten Geschäften (Migration 126).
 *
 * Die Fixture trägt je Variante die Partei, an der sie sich unterscheidet: eine
 * mit gewöhnlicher Vollmacht. Ohne sie sähen «persönlich» und «vertreten» in
 * jedem Fall gleich aus, und die Probe liesse sich nicht rot machen.
 */
import { describe, expect, it } from 'vitest';
import {
	gemeinsamImStand,
	AUSNAHMEN_VORGABE,
	empfehlungUniversal,
	keinBeschlussKurz,
	keinBeschlussNamenszeilen,
	keinBeschlussSatz,
	wegNachKeinemBeschluss,
	ueberholungsgrundNachWeggang,
	protokollvermerkReglement,
	protokollvermerkUniversal,
	pruefeAusnahmen,
	pruefeUniversalversammlung,
	universalAmSchluss,
	universalbestaetigung,
	universalgruende,
	universalparteien,
	universalschluss,
	UNIVERSAL_FRUEHERER_BESCHLUSS,
	wiederEroeffenbar,
	type Universalpartei
} from '../../src/lib/domain/ausnahmen';
import {
	beschlossen,
	ergebnisInWorten,
	ergebnislage,
	mitKeinemBeschluss,
	type Auszaehlung
} from '../../src/lib/domain/auszaehlung';
import { vollmachtsschluessel } from '../../src/lib/domain/vollmacht';
import { FachlicherFehler } from '../../src/lib/domain/fehler';

function partei(
	name: string,
	anwesend: boolean,
	mitVollmacht = false,
	vollmachtDerLeitung = false
): Universalpartei {
	return { parteiId: name, name, anwesend, mitVollmacht, vollmachtDerLeitung };
}

/** Eine vollständige Eingabe; jede Probe setzt nur ihre Abweichung darauf. */
const LEER = {
	reglementGestattet: false,
	reglementFundstelle: null,
	universalvariante: 'persoenlich',
	universalFundstelle: null,
	leitungsvollmachtenZaehlen: false
};

const PERSOENLICH = { universalvariante: 'persoenlich', leitungsvollmachtenZaehlen: false } as const;
const VERTRETEN = { universalvariante: 'vertreten', leitungsvollmachtenZaehlen: false } as const;

describe('Die Angabe an der Gemeinschaft', () => {
	it('gibt ohne Eintrag die beste Praxis vor', () => {
		expect(AUSNAHMEN_VORGABE.reglementGestattet).toBe(false);
		expect(AUSNAHMEN_VORGABE.universalvariante).toBe('persoenlich');
		expect(AUSNAHMEN_VORGABE.leitungsvollmachtenZaehlen).toBe(false);
	});

	it('verlangt zu (a) die Fundstelle', () => {
		expect(() =>
			pruefeAusnahmen({ ...LEER, reglementGestattet: true, reglementFundstelle: ' ', universalvariante: 'persoenlich' })
		).toThrow(FachlicherFehler);
		const g = pruefeAusnahmen({
			...LEER,
			reglementGestattet: true,
			reglementFundstelle: ' Art. 21 Abs. 3 ',
			universalvariante: 'persoenlich'
		});
		expect(g.reglementFundstelle).toBe('Art. 21 Abs. 3');
	});

	it('räumt die Fundstelle zu (a) weg, wenn (a) nicht gilt', () => {
		const g = pruefeAusnahmen({
			...LEER,
			reglementGestattet: false,
			reglementFundstelle: 'Art. 21',
			universalvariante: 'vertreten'
		});
		expect(g.reglementFundstelle).toBeNull();
	});

	it('lässt die Fundstelle zu (b) auch bei der Vorgabe stehen', () => {
		const g = pruefeAusnahmen({
			...LEER,
			reglementGestattet: false,
			universalvariante: 'persoenlich',
			universalFundstelle: 'Art. 18'
		});
		expect(g.universalFundstelle).toBe('Art. 18');
	});

	it('weist eine unbekannte Variante ab', () => {
		expect(() => pruefeAusnahmen({ ...LEER, reglementGestattet: false, universalvariante: 'alle' })).toThrow(
			FachlicherFehler
		);
	});
});

describe('Die Universalversammlung', () => {
	const alleDa = [partei('A', true), partei('B', true), partei('C', true, true)];

	it('zählt bei «persönlich» eine gewöhnliche Vollmacht nicht', () => {
		const b = pruefeUniversalversammlung(PERSOENLICH, alleDa);
		expect(b.vollzaehlig).toBe(false);
		expect(b.nurVollmacht).toEqual(['C']);
		expect(b.fehlend).toEqual([]);
	});

	it('zählt bei «vertreten» die Vollmacht und nennt die Vertretenen', () => {
		const b = pruefeUniversalversammlung(VERTRETEN, alleDa);
		expect(b.vollzaehlig).toBe(true);
		expect(b.vertreten).toEqual(['C']);
	});

	it('nennt, wer ganz fehlt, unter jeder Variante', () => {
		const parteien = [partei('A', true), partei('B', false)];
		expect(pruefeUniversalversammlung(PERSOENLICH, parteien).fehlend).toEqual(['B']);
		expect(pruefeUniversalversammlung(VERTRETEN, parteien).fehlend).toEqual(['B']);
	});

	describe('Vollmachten der Sitzungsleitung', () => {
		const durchLeitung = [partei('A', true), partei('D', true, true, true)];

		it('zählen nach der Vorgabe nicht', () => {
			const b = pruefeUniversalversammlung(VERTRETEN, durchLeitung);
			expect(b.vollzaehlig).toBe(false);
			expect(b.durchLeitung).toEqual(['D']);
		});

		it('zählen, wenn die Gemeinschaft es so eingestellt hat', () => {
			const b = pruefeUniversalversammlung(
				{ universalvariante: 'vertreten', leitungsvollmachtenZaehlen: true },
				durchLeitung
			);
			expect(b.vollzaehlig).toBe(true);
			expect(b.vertreten).toEqual(['D']);
		});

		it('ändern bei «persönlich» nichts: Dort zählt keine Vollmacht', () => {
			const b = pruefeUniversalversammlung(
				{ universalvariante: 'persoenlich', leitungsvollmachtenZaehlen: true },
				durchLeitung
			);
			expect(b.nurVollmacht).toEqual(['D']);
		});
	});

	it('ist bei «keine» nie vollzählig, auch wenn alle da sind', () => {
		const b = pruefeUniversalversammlung(
			{ universalvariante: 'keine', leitungsvollmachtenZaehlen: true },
			[partei('A', true), partei('B', true)]
		);
		expect(b.vollzaehlig).toBe(false);
	});

	it('ist ohne Parteien nicht vollzählig', () => {
		expect(pruefeUniversalversammlung(VERTRETEN, []).vollzaehlig).toBe(false);
	});
});

describe('Der Vermerk im Protokoll', () => {
	it('ergänzt «des Reglements» nur bei einer blossen Artikelangabe', () => {
		expect(protokollvermerkReglement('Art. 21 Abs. 3')).toMatch(/auf Art\. 21 Abs\. 3 des Reglements, das/);
		expect(protokollvermerkReglement('Art. 21 Abs. 3 Reglement')).not.toMatch(/des Reglements/);
	});

	/** Er steht auch bei einem abgelehnten oder zurückgezogenen Geschäft. */
	it('sagt «aufgenommen», nicht «beschlossen»', () => {
		expect(protokollvermerkReglement('Art. 21')).toMatch(/Zur Abstimmung aufgenommen/);
		expect(protokollvermerkReglement('Art. 21')).not.toMatch(/[Bb]eschlossen/);
	});
});

describe('Wer als selbst da gilt (universalparteien)', () => {
	const praesenz = (id: string, ueberVertretung: boolean, anwesend = true) => ({
		parteiId: id,
		name: id,
		anwesend,
		ueberVertretung
	});

	/*
	 * **Seit dem 30.09.2026 zählt ein Mitberechtigter nicht mehr für die ganze
	 * Wohnung** (Produktentscheid nach der Fachprüfung zur Regel): Für die
	 * Universalversammlung müssen alle Eigentümer der Wohnung da sein. Vertritt
	 * einer die Wohnung allein, ist das eine Vertretung wie jede andere. Bis dahin
	 * stand hier «zählt Organ und Mitberechtigte als selbst da».
	 */
	it('zählt nur das Organ als selbst da, Mitberechtigte und gesetzliche Vertretung nicht', () => {
		const p = universalparteien(
			[praesenz('AG', true), praesenz('Ehepaar', true), praesenz('Kind', true)],
			[
				{ vertreteneParteiId: 'AG', grund: 'organ', vertreter: 'Geschäftsführerin' },
				{ vertreteneParteiId: 'Ehepaar', grund: 'mitberechtigt', vertreter: 'Ehefrau' },
				{ vertreteneParteiId: 'Kind', grund: 'gesetzlich', vertreter: 'Beistand' }
			],
			new Set()
		);
		expect(p.map((x) => x.mitVollmacht)).toEqual([false, true, true]);
		expect(pruefeUniversalversammlung(PERSOENLICH, p).nurVollmacht).toEqual(['Ehepaar', 'Kind']);
	});

	// Folge davon: Eine mitberechtigte Vertretung, die die Leitung hält und
	// angekreuzt hat, zählt unter «vertreten» als Vollmacht der Leitung
	// (Codeprüfung 30.09.2026, M2). Vorher war sie selbst da und entging dem Kreuz.
	it('zählt eine angekreuzte mitberechtigte Vertretung als Vollmacht der Leitung', () => {
		const p = universalparteien(
			[praesenz('Ehepaar', true)],
			[{ vertreteneParteiId: 'Ehepaar', grund: 'mitberechtigt', vertreter: 'Leiterin Muster' }],
			new Set([vollmachtsschluessel('Leiterin Muster')])
		);
		expect(p[0].vollmachtDerLeitung).toBe(true);
		expect(pruefeUniversalversammlung(VERTRETEN, p).durchLeitung).toEqual(['Ehepaar']);
	});

	it('nennt gemeinsame Wohnungen und Nutzniessungen, die die Leitung selbst prüft', () => {
		const p = universalparteien(
			[
				{ ...praesenz('Ehepaar', false), gemeinsam: true },
				{ ...praesenz('Erbengemeinschaft', false), gemeinsam: true, nutzniesser: ['W3: Prüf Anna'] },
				{ ...praesenz('Allein', false), nutzniesser: ['W4: Prüf Beat'] },
				{ ...praesenz('Weg', false, false), gemeinsam: true }
			],
			[],
			new Set()
		);
		const b = pruefeUniversalversammlung(PERSOENLICH, p);
		expect(b.pruefenGemeinsam).toEqual(['Ehepaar', 'Erbengemeinschaft']);
		expect(b.pruefenNutzniessung).toEqual(['W3: Prüf Anna', 'W4: Prüf Beat']);
		// Wer fehlt, ist ein Grund, keine Prüfaufgabe.
		expect(b.fehlend).toEqual(['Weg']);
	});

	/**
	 * **Die Nutzniesserin ist nie Partei** (Entscheid 29.09.2026). Ist sie für
	 * die Eigentümerin da, dann mit Vollmacht, und unter «persönlich» zählt die
	 * Eigentümerin damit nicht als anwesend.
	 */
	it('lässt eine Nutzniesserin die Eigentümerin nicht als selbst da zählen', () => {
		const p = universalparteien(
			[praesenz('Eigentümerin', true)],
			[{ vertreteneParteiId: 'Eigentümerin', grund: null, vertreter: 'Nutzniesserin' }],
			new Set()
		);
		expect(pruefeUniversalversammlung(PERSOENLICH, p).vollzaehlig).toBe(false);
	});

	it('erkennt die Vollmacht der Leitung am Schlüssel des Namens', () => {
		const p = universalparteien(
			[praesenz('B', true)],
			[{ vertreteneParteiId: 'B', grund: null, vertreter: '  Frau  Verwalterin ' }],
			new Set([vollmachtsschluessel('Frau Verwalterin')])
		);
		expect(p[0].vollmachtDerLeitung).toBe(true);
		expect(pruefeUniversalversammlung(VERTRETEN, p).durchLeitung).toEqual(['B']);
	});

	it('hält eine Vertretung ohne auffindbare Vollmacht für eine Vollmacht', () => {
		const p = universalparteien([praesenz('B', true)], [], new Set());
		expect(p[0].mitVollmacht).toBe(true);
	});
});

describe('Beim Schliessen (universalAmSchluss)', () => {
	const alle = [partei('A', true), partei('B', true)];

	it('hält, wenn alle da sind und niemand widerspricht', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: alle,
			abgestimmt: new Set(['A']),
			gegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss).toBeNull();
	});

	/** Fachprüfung Runde 1, B-3: Wer abgestimmt hat, darf gehen. */
	it('lässt gehen, wer abgestimmt hat, und nennt es', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: [partei('A', true), partei('B', false)],
			abgestimmt: new Set(['B']),
			gegangenWaehrend: ['B'],
			widerspruch: null
		});
		expect(s.keinBeschluss).toBeNull();
		expect(s.abgestimmtUndGegangen).toEqual(['B']);
	});

	it('ergibt «kein Beschluss», wenn jemand ohne Stimme gegangen ist', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: [partei('A', true), partei('B', false)],
			abgestimmt: new Set(['A']),
			gegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss).toEqual({ grund: 'weggang', namen: ['B'] });
	});

	/** Wer ging und nur noch mit Vollmacht da ist, zählt unter «persönlich» nicht. */
	it('zählt unter «persönlich» eine inzwischen erteilte Vollmacht nicht', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: [partei('A', true), partei('B', true, true)],
			abgestimmt: new Set(['A']),
			gegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss?.namen).toEqual(['B']);
	});

	/** Bei der Handzählung führt jeder Weggang zu «kein Beschluss». */
	it('ergibt bei der Handzählung schon bei einem Weggang mit Rückkehr «kein Beschluss»', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: alle,
			abgestimmt: null,
			gegangenWaehrend: ['B'],
			widerspruch: null
		});
		expect(s.keinBeschluss).toEqual({ grund: 'weggang', namen: ['B'], handzaehlung: true });
	});

	it('ergibt nach einem Widerspruch «kein Beschluss», auch wenn alle da sind', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: alle,
			abgestimmt: new Set(['A', 'B']),
			gegangenWaehrend: [],
			widerspruch: { name: 'B', zeitpunkt: '2027-06-01T18:30:00Z' }
		});
		expect(s.keinBeschluss?.grund).toBe('widerspruch');
		expect(keinBeschlussKurz(s.keinBeschluss!)).toBe('Kein Beschluss: Widerspruch');
	});
});

describe('Der vierte Zustand', () => {
	const ausgezaehlt = {
		koepfe: { ja: 2, nein: 0 },
		quoten: {},
		betroffene: {},
		ohneZustimmung: [],
		angenommen: true,
		durchStichentscheid: false,
		stichentscheidOffen: true,
		stichentscheidArt: null,
		hinweise: []
	} as unknown as Auszaehlung;

	/**
	 * Eine Ja-Mehrheit wird nicht angenommen, und ein offener Gleichstand wird
	 * erledigt: Sonst bliebe das Ergebnis unverkündet, und «kein Beschluss»
	 * erschiene nie.
	 */
	it('ist weder angenommen noch abgelehnt noch offen', () => {
		const a = mitKeinemBeschluss(ausgezaehlt, { grund: 'widerspruch', namen: ['B'] });
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(false);
		expect(ergebnislage(a)).toBe('kein_beschluss');
		expect(beschlossen(ergebnislage(a))).toBeNull();
		expect(ergebnisInWorten(a, {} as never)).toMatch(/^Kein Beschluss: /);
		// Ohne Namen an der Wand (Laienprüfung Runde 2, L14).
		expect(ergebnisInWorten(a, {} as never)).not.toMatch(/\bB\b/);
	});
});

describe('Bestätigung und Protokoll der Universalversammlung', () => {
	/** Fachprüfung Runde 2 zu Stelle 3; L6: «Parteien», nicht «alle Eigentümer persönlich». */
	it('bestätigt unter «persönlich» je Partei, bei gemeinsamem Eigentum alle, mit Organ', () => {
		const t = universalbestaetigung(PERSOENLICH);
		// Seit dem 30.09.2026 genügt bei gemeinsamem Eigentum keine einzelne Person mehr.
		expect(t).toMatch(/bei gemeinsamem Eigentum alle Eigentümer der Wohnung/);
		expect(t).not.toMatch(/mindestens eine Person je Einheit/);
		// Das Organ nur einer Eigentümergesellschaft, am Registereintrag ablesbar
		// (Fachprüfung 30.09.2026, R2-1, R2-2, R3-1); keine Prokura, kein Gesellschafter
		// einer einfachen Gesellschaft.
		expect(t).toMatch(/bei einer AG, GmbH oder anderen Eigentümergesellschaft ihr Organ, also wer laut Handelsregister Einzelunterschrift für sie hat\. Eine einfache Gesellschaft ist gemeinsames Eigentum\./);
		expect(t).not.toMatch(/Geschäftsführer|allein vertreten/);
		expect(t).toMatch(/und bei einer Pfändung, einer Pfandverwertung oder im Konkurs die zuständige Behörde\./);
		expect(t).not.toMatch(/Betreibungsamt/);
		// Was Votum nicht kennt, bestätigt die Leitung in der Ich-Form (Laienprüfung Runde 3, B2).
		expect(t).toMatch(/Ob eine Wohnung mit einem Wohnrecht, einer Pfändung oder einem Konkurs belastet ist, habe ich selbst geprüft\./);
		expect(t).not.toMatch(/Alle Eigentümer sind persönlich/);
		// Ohne solche Wohnungen kein namentlicher Satz.
		expect(t).not.toMatch(/habe ich geprüft, dass alle Eigentümer/);
	});

	it('nennt die Wohnungen, bei denen Votum nicht sieht, wer da ist, namentlich', () => {
		const befund = {
			vollzaehlig: true,
			fehlend: [],
			nurVollmacht: [],
			durchLeitung: [],
			vertreten: [],
			pruefenGemeinsam: ['Muster Hans und Muster Erika', 'Erbengemeinschaft Prüfweg 3'],
			pruefenNutzniessung: ['W4: Prüf Anna'],
			anzahl: 12
		};
		const t = universalbestaetigung(PERSOENLICH, befund);
		expect(t).toMatch(
			/Bei Muster Hans und Muster Erika; Erbengemeinschaft Prüfweg 3 habe ich geprüft, dass alle Eigentümer der Wohnung da sind\. Da sind auch die Nutzniesser: W4: Prüf Anna\. Ich habe das Geschäft/
		);
		const v = universalbestaetigung(VERTRETEN, befund);
		expect(v).toMatch(/habe ich geprüft, dass alle Eigentümer der Wohnung da oder vertreten sind\. Da oder vertreten sind auch die Nutzniesser: W4: Prüf Anna\./);
		expect(v).toMatch(/im Konkurs die zuständige Behörde\. Ob eine Wohnung mit einem Wohnrecht, einer Pfändung oder einem Konkurs belastet ist, habe ich selbst geprüft\./);
	});

	it('nennt die eigenen Vollmachten nur, wo sie zählen (L7)', () => {
		expect(universalbestaetigung(VERTRETEN)).not.toMatch(/meinen eigenen/);
		expect(
			universalbestaetigung({ universalvariante: 'vertreten', leitungsvollmachtenZaehlen: true })
		).toMatch(/Bei allen Vertretungen, auch meinen eigenen, habe ich geprüft/);
	});

	const stand = {
		variante: 'vertreten' as const,
		anzahl: 3,
		vertreten: [{ name: 'Kunz', vertreter: 'Muster' }],
		abgestimmtUndGegangen: [],
		bestaetigtAm: '2027-06-01T17:05:00Z',
		keinBeschluss: null
	};

	/** Fachprüfung Runde 2 zu 5b: «bei der Abstimmung», nicht «bis zum Schluss». */
	it('schreibt «bei der Abstimmung» und nennt die Vertretenen mit Vertreter', () => {
		const v = protokollvermerkUniversal(stand);
		expect(v).toMatch(/bei der Abstimmung anwesend oder vertreten, davon 1 vertreten \(Kunz durch Muster\)/);
		expect(v).not.toMatch(/bis zum Schluss/);
		expect(v).not.toMatch(/danach verlassen/);
		expect(v).toMatch(/bestätigt um 19:05/);
	});

	it('nennt, wer abgestimmt hat und danach ging, nur wenn es vorkam', () => {
		expect(protokollvermerkUniversal({ ...stand, abgestimmtUndGegangen: ['Kunz'] })).toMatch(
			/Kunz hat abgestimmt und die Versammlung danach verlassen/
		);
	});

	it('nennt bei «persönlich» keine Vertretenen (L11)', () => {
		expect(protokollvermerkUniversal({ ...stand, variante: 'persoenlich' })).not.toMatch(/davon/);
	});

	it('nennt bei «kein Beschluss» den Grund mit Namen und wer traktandieren lassen kann', () => {
		const v = protokollvermerkUniversal({
			...stand,
			keinBeschluss: { grund: 'weggang', namen: ['Kunz'] }
		});
		expect(v).toMatch(/Kein Beschluss: Kunz hat die Versammlung vor dem Schluss der Abstimmung verlassen, ohne vorher abzustimmen/);
		expect(v).toMatch(/bei der Verwaltung/);
	});
});

describe('Nach den Prüfungen zu Block 3', () => {
	const befund = {
		vollzaehlig: false,
		fehlend: [],
		nurVollmacht: [],
		durchLeitung: [],
		vertreten: [],
		anzahl: 2
	};

	/** U7: Wo es nichts zu erreichen gibt, kein «Lässt sich das nicht erreichen». */
	it('schliesst nach einem Widerspruch und bei «keine» ohne Bedingung', () => {
		const l = { variante: 'persoenlich' as const, fruehererWiderspruch: true };
		const g = universalgruende({ ...l, befund, bestaetigt: true });
		expect(universalschluss(l, g)).toMatch(/^Behandeln Sie/);
		const k = { variante: 'keine' as const };
		expect(universalschluss(k, universalgruende({ ...k, befund, bestaetigt: true }))).toMatch(/^Behandeln Sie/);
		const f = { variante: 'persoenlich' as const };
		expect(
			universalschluss(f, universalgruende({ ...f, befund: { ...befund, fehlend: ['B'] }, bestaetigt: true }))
		).toMatch(/^Lässt sich das nicht erreichen/);
	});

	/**
	 * Nach Rückkommen und Widerspruch gilt ein früherer Beschluss; die Absage
	 * sagt dann dasselbe wie die Leitungsseite (`docs/freigabe.md`, Punkt 10).
	 * Ohne Widerspruch zählt das Feld nicht.
	 */
	it('schliesst nach einem Widerspruch mit dem früheren Beschluss, wenn einer gilt', () => {
		const l = { variante: 'persoenlich' as const, fruehererWiderspruch: true, fruehererBeschluss: true };
		expect(universalschluss(l, universalgruende({ ...l, befund, bestaetigt: true }))).toBe(
			UNIVERSAL_FRUEHERER_BESCHLUSS
		);
		const ohne = { variante: 'persoenlich' as const, fruehererBeschluss: true };
		expect(
			universalschluss(ohne, universalgruende({ ...ohne, befund: { ...befund, fehlend: ['B'] }, bestaetigt: true }))
		).toMatch(/^Lässt sich das nicht erreichen/);
	});

	it('lässt nach einem Weggang neu eröffnen, nach einem Widerspruch nicht', () => {
		expect(wiederEroeffenbar({ keinBeschluss: { grund: 'weggang', namen: ['B'] } })).toBe(true);
		expect(wiederEroeffenbar({ keinBeschluss: { grund: 'widerspruch', namen: ['B'] } })).toBe(false);
		expect(wiederEroeffenbar(null)).toBe(false);
	});

	/** U5: Bei der Handzählung ist «ohne abzustimmen» nicht festzustellen. */
	it('sagt bei der Handzählung «während der Abstimmung verlassen»', () => {
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: [partei('A', true), partei('B', true)],
			abgestimmt: null,
			gegangenWaehrend: ['B'],
			widerspruch: null
		});
		expect(s.keinBeschluss?.handzaehlung).toBe(true);
		const v = protokollvermerkUniversal({
			variante: 'persoenlich',
			anzahl: 2,
			vertreten: [],
			abgestimmtUndGegangen: [],
			bestaetigtAm: '2027-06-01T17:05:00Z',
			keinBeschluss: s.keinBeschluss
		});
		expect(v).toMatch(/B hat die Versammlung während der Abstimmung verlassen/);
		expect(v).not.toMatch(/ohne abzustimmen/);
		expect(keinBeschlussKurz(s.keinBeschluss!)).toBe('Kein Beschluss: jemand ist gegangen');
	});

	/** Fachprüfung Block 3 zu 5b: bei gemeinsamem Eigentum, wer da war. */
	it('nennt bei gemeinsamem Eigentum, wer für die Einheit da war', () => {
		const v = protokollvermerkUniversal({
			variante: 'persoenlich',
			anzahl: 2,
			vertreten: [],
			abgestimmtUndGegangen: [],
			gemeinsam: [{ name: 'Ehepaar Beispiel', durch: 'Eva Beispiel' }],
			bestaetigtAm: '2027-06-01T17:05:00Z',
			keinBeschluss: null
		});
		expect(v).toMatch(/persönlich anwesend, bei gemeinsamem Eigentum durch mindestens eine Person je Einheit \(Ehepaar Beispiel: Eva Beispiel\)/);
	});

	/*
	 * **Seit dem 30.09.2026** (Produktentscheid): alle Eigentümer der Wohnung,
	 * laut Bestätigung der Leitung, und die Nutzniesser. Der Stand oben ist ein
	 * alter und behält seinen Wortlaut; das Merkmal `regel` unterscheidet sie.
	 */
	it('nennt seit der Regel vom 30.09.2026 alle Eigentümer der Wohnung und die Nutzniesser', () => {
		const parteien = universalparteien(
			[
				{ parteiId: 'e', name: 'Muster Hans und Muster Erika', anwesend: true, ueberVertretung: false, gemeinsam: true },
				{ parteiId: 'w', name: 'Prüf W4', anwesend: true, ueberVertretung: false, nutzniesser: ['W4: Prüf Anna'] },
				{ parteiId: 'x', name: 'Allein', anwesend: true, ueberVertretung: false }
			],
			[],
			new Set()
		);
		const neu = {
			variante: 'persoenlich' as const,
			anzahl: 3,
			vertreten: [],
			abgestimmtUndGegangen: [],
			gemeinsam: gemeinsamImStand(parteien),
			bestaetigtAm: '2027-06-01T17:05:00Z',
			keinBeschluss: null
		};
		const v = protokollvermerkUniversal(neu);
		expect(v).toMatch(
			/persönlich anwesend, bei gemeinsamem Eigentum laut Bestätigung der Sitzungsleitung alle Eigentümer der Wohnung \(Muster Hans und Muster Erika\), ebenso die Nutzniesser \(W4: Prüf Anna\)\./
		);
		expect(v).not.toMatch(/mindestens eine Person/);

		// Ohne gemeinsame Wohnung und Nutzniessung steht nichts dazu, auch nicht der alte Satz.
		const leer = { ...neu, gemeinsam: gemeinsamImStand(parteien.filter((p) => p.parteiId === 'x')) };
		expect(protokollvermerkUniversal(leer)).not.toMatch(/gemeinsamem Eigentum|Nutzniesser/);
		// Ein alter Stand ohne Eintrag behält den allgemeinen alten Satz.
		expect(protokollvermerkUniversal({ ...neu, gemeinsam: [] })).toMatch(
			/durch mindestens eine Person je Einheit\./
		);
	});

	// Unter «vertreten» steht «davon vertreten» vor den gemeinsamen Wohnungen und
	// hängt sich nicht an die Nutzniesser (Codeprüfung 30.09.2026, N1).
	it('setzt unter «vertreten» die Vertretenen vor die gemeinsamen Wohnungen', () => {
		const parteien = universalparteien(
			[
				{ parteiId: 'e', name: 'Muster Hans und Muster Erika', anwesend: true, ueberVertretung: false, gemeinsam: true },
				{ parteiId: 'w', name: 'Prüf W4', anwesend: true, ueberVertretung: false, nutzniesser: ['W4: Prüf Anna'] }
			],
			[],
			new Set()
		);
		const v = protokollvermerkUniversal({
			variante: 'vertreten',
			anzahl: 3,
			vertreten: [{ name: 'Kunz', vertreter: 'Muster' }],
			abgestimmtUndGegangen: [],
			gemeinsam: gemeinsamImStand(parteien),
			bestaetigtAm: '2027-06-01T17:05:00Z',
			keinBeschluss: null
		});
		expect(v).toMatch(
			/anwesend oder vertreten, davon 1 vertreten \(Kunz durch Muster\), bei gemeinsamem Eigentum laut Bestätigung der Sitzungsleitung alle Eigentümer der Wohnung selbst oder vertreten \(Muster Hans und Muster Erika\), ebenso die Nutzniesser \(W4: Prüf Anna\)\./
		);
	});
});

describe('Die Empfehlung bei der Universalversammlung (Nachtrag zu Frage 54)', () => {
	/*
	 * Produktentscheid 29.09.2026: Ob Vertretene zählen, regelt die Gemeinschaft.
	 * Die Leitung im Saal bekommt deshalb nicht mehr «vertretbar, entschieden ist
	 * es nicht», sondern die Frage, die sie stellen muss. Gegenprobe: Unter
	 * «persönlich» steht kein Satz über Vertretene.
	 */
	it('unter «vertreten» nennt sie die Einstellung und die Prüfung der Vollmacht', () => {
		const text = empfehlungUniversal('vertreten');
		expect(text).toMatch(/Vertretene zählen hier als anwesend; so ist es für diese Gemeinschaft eingestellt\./);
		expect(text).toMatch(/Prüfen Sie bei jeder Vertretung, ob die Vollmacht auch Geschäfte deckt/);
		expect(text).toMatch(/\(SVIT-Kommentar Rz\. 26 und 27 ad Art\. 712m\)/);
		expect(text).toMatch(/Dann ist es keine Universalversammlung, und Sie traktandieren das Geschäft für eine spätere Versammlung; ist es dringend/);
		expect(text).not.toMatch(/entschieden ist es nicht|anfechten und aufheben/);
	});
	it('die Bestätigung unter «vertreten» sagt «geprüft», nicht «gefragt»', () => {
		const text = universalbestaetigung({ universalvariante: 'vertreten', leitungsvollmachtenZaehlen: false });
		expect(text).toMatch(/Bei allen Vertretungen habe ich geprüft, dass ihre Vollmacht auch Geschäfte deckt/);
		expect(text).not.toMatch(/eigens gefragt/);
	});
	it('unter «persönlich» sagt sie nichts über Vertretene', () => {
		expect(empfehlungUniversal('persoenlich')).not.toMatch(/Vertretene|Vertretungen/);
	});
	/*
	 * Ein Ausweg für alles, was die Leitung nicht sicher weiss (Fachprüfung
	 * 30.09.2026, R2-4; Laienprüfung N1), unter beiden Varianten.
	 */
	it('nennt, was Votum nicht kennt, und den Ausweg', () => {
		for (const v of ['persoenlich', 'vertreten'] as const) {
			const text = empfehlungUniversal(v);
			expect(text).toMatch(/Ein Wohnrecht, eine Pfändung oder einen Konkurs kennt Votum nicht/);
			expect(text).toMatch(
				/Wissen Sie nicht sicher, wer alles da sein muss, etwa bei einer Erbengemeinschaft, einem Willensvollstrecker, einem Wohnrecht oder einer Pfändung, bestätigen Sie nicht\. Traktandieren Sie das Geschäft dann für die nächste Versammlung\./
			);
		}
	});
});

/**
 * Codeprüfung Block 4a, N-4: Wer beim Schliessen nur über eine Vollmacht der
 * Leitung da ist und seit dem Eröffnen nicht gegangen ist, hat die Versammlung
 * nicht verlassen. Meist wurde der Vertreter erst nach dem Eröffnen
 * angekreuzt. Gegenprobe: Wer ging und danach der Leitung eine Vollmacht gab,
 * behält den Satz vom Verlassen.
 */
describe('Nur über die Leitung vertreten (N-4)', () => {
	const mitVertreter = (p: Universalpartei, vertreter: string): Universalpartei => ({ ...p, vertreter });
	const b = mitVertreter(partei('B', true, true, true), 'Vera Beispiel');
	const stand = (keinBeschluss: ReturnType<typeof universalAmSchluss>['keinBeschluss']) => ({
		variante: 'vertreten' as const,
		anzahl: 2,
		vertreten: [{ name: 'B', vertreter: 'Vera Beispiel' }],
		abgestimmtUndGegangen: [],
		bestaetigtAm: '2027-06-01T17:05:00Z',
		keinBeschluss
	});

	it('nennt den Grund statt «verlassen», wenn die Partei nie ging', () => {
		const s = universalAmSchluss({
			einstellung: VERTRETEN,
			parteien: [partei('A', true), b],
			abgestimmt: new Set(['A']),
			mitStimme: new Set(['A', 'B']),
			gegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss).toEqual({
			grund: 'weggang',
			namen: ['B'],
			nurDurchLeitung: [{ name: 'B', vertreter: 'Vera Beispiel' }]
		});
		const v = protokollvermerkUniversal(stand(s.keinBeschluss));
		expect(v).not.toMatch(/verlassen/);
		expect(v).toContain(
			'Kein Beschluss: B war bei der Abstimmung durch Vera Beispiel vertreten. Die Sitzungsleitung ' +
				'hat Vera Beispiel als Person erfasst, die für die Sitzungsleitung oder die Verwaltung ' +
				'handelt. Vollmachten an solche Personen zählten nicht dafür, dass über dieses nicht ' +
				'angekündigte Geschäft beschlossen werden konnte. Die abgegebenen Stimmen'
		);
		// Mit der Zeit des Kreuzes, wo sie bekannt ist (Fachprüfung 30.09.2026, Befund 2).
		expect(
			protokollvermerkUniversal(
				stand({
					...s.keinBeschluss!,
					nurDurchLeitung: [{ name: 'B', vertreter: 'Vera Beispiel', erfasstAm: '2027-06-01T17:40:00Z' }]
				})
			)
		).toContain('hat Vera Beispiel um 19:40 als Person erfasst');
		expect(keinBeschlussKurz(s.keinBeschluss!)).toBe(
			'Kein Beschluss: Vollmacht bei Leitung oder Verwaltung zählt hier nicht'
		);
		// Eingegrenzt auf dieses Geschäft (Fachprüfung, Befund 1).
		expect(keinBeschlussSatz(s.keinBeschluss!)).toMatch(/für die angekündigten Geschäfte zählen sie wie jede Vollmacht/);
		expect(keinBeschlussSatz(s.keinBeschluss!)).not.toMatch(/verlassen|Ohne alle Eigentümer/);
		expect(keinBeschlussNamenszeilen(s.keinBeschluss!)).toEqual([
			'Nur über eine Vollmacht der Leitung vertreten: B (durch Vera Beispiel)'
		]);
		expect(wegNachKeinemBeschluss(s.keinBeschluss!)).toMatch(
			/^Neu eröffnen können Sie, sobald die Partei selbst da ist oder durch jemanden vertreten wird, der nicht für Sie oder die Verwaltung handelt\. Dessen Vollmacht muss von der Partei selbst stammen/
		);
		expect(wegNachKeinemBeschluss(s.keinBeschluss!)).not.toMatch(/wieder da/);
		// Der Weg danach bleibt der nach einem Weggang.
		expect(wiederEroeffenbar(s)).toBe(true);
	});

	it('behält den Satz vom Verlassen, wenn die Partei ging (Gegenprobe)', () => {
		const s = universalAmSchluss({
			einstellung: VERTRETEN,
			parteien: [partei('A', true), b],
			abgestimmt: new Set(['A']),
			mitStimme: new Set(['A', 'B']),
			gegangenWaehrend: ['B'],
			widerspruch: null
		});
		expect(s.keinBeschluss).toEqual({ grund: 'weggang', namen: ['B'], stimmeOhneWirkung: ['B'] });
		const v = protokollvermerkUniversal(stand(s.keinBeschluss));
		expect(v).toMatch(/B hat die Versammlung vor dem Schluss der Abstimmung verlassen, ohne vorher abzustimmen/);
		expect(keinBeschlussKurz(s.keinBeschluss!)).toBe('Kein Beschluss: jemand ist ohne Stimme gegangen');
	});

	it('trennt beide, wenn im selben Durchgang jemand ging und jemand nur über die Leitung da war', () => {
		const s = universalAmSchluss({
			einstellung: VERTRETEN,
			parteien: [partei('A', false), b],
			abgestimmt: new Set(),
			gegangenWaehrend: ['A'],
			widerspruch: null
		});
		const k = s.keinBeschluss!;
		const v = protokollvermerkUniversal(stand(k));
		expect(v).toMatch(/A hat die Versammlung vor dem Schluss der Abstimmung verlassen/);
		expect(v).not.toMatch(/B hat/);
		expect(v).toMatch(/B war bei der Abstimmung durch Vera Beispiel vertreten/);
		expect(keinBeschlussKurz(k)).toBe('Kein Beschluss: jemand ist ohne Stimme gegangen');
		expect(keinBeschlussNamenszeilen(k)).toEqual([
			'Ohne Stimme gegangen: A',
			'Nur über eine Vollmacht der Leitung vertreten: B (durch Vera Beispiel)'
		]);
		expect(wegNachKeinemBeschluss(k)).toMatch(/^Wer gegangen ist, muss wieder da sein\. Neu eröffnen/);
	});

	it('sagt «jede Partei, die …», wenn mehr als eine nur durch die Leitung vertreten war (F2)', () => {
		const vertreter = { name: 'B', vertreter: 'Vera Beispiel' } as never;
		const eine = { grund: 'weggang', namen: ['B'], nurDurchLeitung: [vertreter] } as never;
		const zwei = {
			grund: 'weggang',
			namen: ['B', 'C'],
			nurDurchLeitung: [vertreter, { name: 'C', vertreter: 'Vera Beispiel' }]
		} as never;
		expect(wegNachKeinemBeschluss(eine)).toMatch(/^Neu eröffnen können Sie, sobald die Partei selbst da ist/);
		expect(wegNachKeinemBeschluss(zwei)).toMatch(
			/^Neu eröffnen können Sie, sobald jede Partei, deren Vollmacht bei Ihnen oder der Verwaltung lag, selbst da ist oder durch jemanden vertreten wird/
		);
	});

	/** Codeprüfung 30.09.2026, M-1: Ging nur der Vertreter kurz hinaus, ging die Partei nicht. */
	it('hält einen Weggang des Vertreters nicht für einen der Partei', () => {
		const s = universalAmSchluss({
			einstellung: VERTRETEN,
			parteien: [partei('A', true), b],
			abgestimmt: new Set(['A']),
			gegangenWaehrend: ['B'],
			selbstGegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss?.nurDurchLeitung).toEqual([{ name: 'B', vertreter: 'Vera Beispiel' }]);
	});

	/**
	 * Fachprüfung 30.09.2026, Runde 3, Befund 2: Ging die Vollmacht während der
	 * Abstimmung an eine Person der Leitung über, ist das ein Weggang.
	 * Gegenprobe: derselbe Vertreter wie beim Eröffnen.
	 */
	it('sieht einen Wechsel zum Vertreter der Leitung als Weggang', () => {
		const eingabe = (beimEroeffnen: string) =>
			universalAmSchluss({
				einstellung: VERTRETEN,
				parteien: [partei('A', true), b],
				abgestimmt: new Set(['A']),
				gegangenWaehrend: ['B'],
				selbstGegangenWaehrend: [],
				vertreterBeimEroeffnen: new Map([['B', beimEroeffnen]]),
				widerspruch: null
			}).keinBeschluss;
		expect(eingabe('Xaver Nachbar')?.nurDurchLeitung).toBeUndefined();
		// Fachprüfung Runde 4, F4-1: Wechsel zu Vera Beispiel, erst danach
		// angekreuzt. Dann hat das Kreuz den Beschluss zu Fall gebracht.
		const mitZeiten = (kreuz: string) =>
			universalAmSchluss({
				einstellung: VERTRETEN,
				parteien: [partei('A', true), b],
				abgestimmt: new Set(['A']),
				gegangenWaehrend: ['B'],
				selbstGegangenWaehrend: [],
				vertreterBeimEroeffnen: new Map([['B', 'Xaver Nachbar']]),
				vertretenSeit: new Map([['B', '2027-06-01T17:30:00Z']]),
				kreuzSeit: new Map([['vera beispiel', kreuz]]),
				widerspruch: null
			}).keinBeschluss?.nurDurchLeitung;
		expect(mitZeiten('2027-06-01T17:40:00Z')).toEqual([{ name: 'B', vertreter: 'Vera Beispiel' }]);
		expect(mitZeiten('2027-06-01T17:00:00Z')).toBeUndefined();
		expect(eingabe(' vera  BEISPIEL')?.nurDurchLeitung).toEqual([
			{ name: 'B', vertreter: 'Vera Beispiel' }
		]);
	});

	/**
	 * Codeprüfung 30.09.2026, zweiter Durchgang, N-a: Der angekreuzte Vertreter
	 * stimmt und geht. Ohne das Kreuz hätte die Stimme gezählt. Gegenprobe: ein
	 * Vertreter ohne Kreuz, der ohne Stimme geht, bleibt ein Weggang.
	 */
	it('nennt den Grund auch, wenn der angekreuzte Vertreter danach ging', () => {
		const schluss = (kreuz: boolean) =>
			universalAmSchluss({
				einstellung: VERTRETEN,
				parteien: [partei('A', true), partei('B', false)],
				abgestimmt: new Set(['A']),
				mitStimme: new Set(['A', 'B']),
				gegangenWaehrend: ['B'],
				selbstGegangenWaehrend: [],
				vertreterBeimEroeffnen: new Map([['B', 'Vera Beispiel']]),
				vertretenSeit: new Map(),
				kreuzSeit: kreuz ? new Map([['vera beispiel', '2027-06-01T17:40:00Z']]) : new Map(),
				widerspruch: null
			}).keinBeschluss;
		expect(schluss(true)).toEqual({
			grund: 'weggang',
			namen: ['B'],
			nurDurchLeitung: [{ name: 'B', vertreter: 'Vera Beispiel' }]
		});
		expect(schluss(false)).toEqual({ grund: 'weggang', namen: ['B'], stimmeOhneWirkung: ['B'] });
	});

	it('nennt im Verlauf den Grund, auch im Mischfall', () => {
		const leitung = [{ name: 'B', vertreter: 'Vera Beispiel' }];
		expect(ueberholungsgrundNachWeggang({ grund: 'weggang', namen: ['A'] })).toMatch(
			/gegangen ist; neu eröffnet, nachdem wieder alle da waren$/
		);
		expect(
			ueberholungsgrundNachWeggang({ grund: 'weggang', namen: ['B'], nurDurchLeitung: leitung })
		).toMatch(/^Kein Beschluss, weil jemand nur durch eine Person vertreten war.*wie es für dieses nicht angekündigte Geschäft zählt$/);
		expect(
			ueberholungsgrundNachWeggang({ grund: 'weggang', namen: ['A', 'B'], nurDurchLeitung: leitung })
		).toMatch(/^Kein Beschluss, weil jemand während der Abstimmung gegangen ist und jemand nur durch/);
	});

	it('zählt mehrere Parteien und Vertreter auf', () => {
		const v = protokollvermerkUniversal(
			stand({
				grund: 'weggang',
				namen: ['B', 'C'],
				nurDurchLeitung: [
					{ name: 'B', vertreter: 'Vera Beispiel', erfasstAm: '2027-06-01T17:40:00Z' },
					{ name: 'C', vertreter: 'Walter Muster', erfasstAm: null }
				]
			})
		);
		expect(v).toContain(
			'Bei der Abstimmung waren B durch Vera Beispiel und C durch Walter Muster vertreten. Die ' +
				'Sitzungsleitung hat Vera Beispiel (um 19:40) und Walter Muster als Personen erfasst, die ' +
				'für die Sitzungsleitung oder die Verwaltung handeln.'
		);
	});

	it('gilt nur, wo die Einstellung Vollmachten der Leitung ausschliesst', () => {
		// Unter «persönlich» zählt keine Vollmacht; wer so dasteht, war beim
		// Eröffnen selbst da und ist gegangen.
		const s = universalAmSchluss({
			einstellung: PERSOENLICH,
			parteien: [partei('A', true), b],
			abgestimmt: new Set(['A']),
			gegangenWaehrend: [],
			widerspruch: null
		});
		expect(s.keinBeschluss?.nurDurchLeitung).toBeUndefined();
	});

	it('liest einen Stand von vorher ohne die Angabe wie bisher', () => {
		const k = { grund: 'weggang' as const, namen: ['B'] };
		expect(protokollvermerkUniversal(stand(k))).toMatch(/B hat die Versammlung vor dem Schluss/);
		expect(keinBeschlussNamenszeilen(k)).toEqual(['Ohne Stimme gegangen: B']);
		expect(wegNachKeinemBeschluss(k)).toMatch(/^Sind wieder alle da, können Sie neu eröffnen/);
	});
});
