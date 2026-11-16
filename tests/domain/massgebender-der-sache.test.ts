/**
 * Der massgebende Durchgang einer Sache im Kern, und was daran hängt (Plan
 * `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B2a).
 *
 * `massgebenderDerSache` und `durchAnderesTraktandumErsetzt` sind das
 * Gegenstück zu den SQL-Funktionen aus Migration 133. Ob sie dasselbe sagen,
 * prüft `tests/db/folgeantrag-leitung.test.ts` am Loader gegen den Server;
 * hier stehen die Fälle, die sich ohne Datenbank benennen lassen.
 */
import { describe, expect, it } from 'vitest';
import {
	durchAnderesTraktandumErsetzt,
	massgebender,
	massgebenderDerSache,
	type Durchgang
} from '$lib/domain/abstimmung';
import { lageZumGrundantrag } from '$lib/domain/folgeantrag';
import { moeglicheEingriffe, type Traktandumslage } from '$lib/domain/eingriffe';
import { rueckkommensauskunft } from '$lib/domain/rueckkommen';

function d(
	id: string,
	traktandumId: string,
	nummer: number,
	eroeffnetAm: string,
	mehr: Partial<Durchgang> = {}
): Durchgang {
	return {
		id,
		meetingId: 'v',
		traktandumId,
		nummer,
		zustand: 'geschlossen',
		eroeffnetAm,
		geschlossenAm: eroeffnetAm,
		ueberholtAm: null,
		ueberholungsart: null,
		ueberholungsgrund: null,
		ersetztDurchId: null,
		...mehr
	};
}

/** Grundantrag g im 1. Durchgang, durch den Durchgang über den Folgeantrag f ersetzt. */
const ersetzt = [
	d('g1', 'g', 1, '2026-10-01T19:00:00.000Z', {
		ueberholtAm: '2026-10-01T19:30:00.000Z',
		ueberholungsart: 'rueckkommen',
		ersetztDurchId: 'f1'
	}),
	d('r1', 'r', 1, '2026-10-01T19:10:00.000Z'),
	d('f1', 'f', 1, '2026-10-01T19:20:00.000Z')
];

describe('massgebenderDerSache', () => {
	it('sagt ohne Ersetzung über ein anderes Traktandum dasselbe wie massgebender', () => {
		const eigen = [
			d('g1', 'g', 1, '2026-10-01T19:00:00.000Z', {
				ueberholtAm: '2026-10-01T19:30:00.000Z',
				ueberholungsart: 'rueckkommen',
				ersetztDurchId: 'g2'
			}),
			d('g2', 'g', 2, '2026-10-01T19:20:00.000Z')
		];
		expect(massgebenderDerSache(eigen, 'g')?.id).toBe(massgebender(eigen)?.id);
		expect(massgebenderDerSache(eigen, 'g')?.id).toBe('g2');
	});

	it('folgt nach der Ersetzung dem Verweis auf den Folgeantrag', () => {
		expect(massgebender(ersetzt.filter((x) => x.traktandumId === 'g'))).toBeNull();
		expect(massgebenderDerSache(ersetzt, 'g')?.id).toBe('f1');
		expect(massgebenderDerSache(ersetzt, 'f')?.id).toBe('f1');
	});

	it('kehrt nach einer Neuabstimmung auf den Durchgang über den Folgeantrag zum Grundantrag zurück', () => {
		/*
		 * Der Zustand, den `setzeNeuabstimmungAn` hinterlässt: Der Durchgang über
		 * f ist als `korrektur` überholt, der frühere über g gilt wieder, und sein
		 * Verweis ist gelöscht (Migration 131).
		 */
		const wieder = [
			d('g1', 'g', 1, '2026-10-01T19:00:00.000Z'),
			d('r1', 'r', 1, '2026-10-01T19:10:00.000Z'),
			d('f1', 'f', 1, '2026-10-01T19:20:00.000Z', {
				ueberholtAm: '2026-10-01T19:40:00.000Z',
				ueberholungsart: 'korrektur'
			})
		];
		expect(massgebenderDerSache(wieder, 'g')?.id).toBe('g1');
		expect(massgebenderDerSache(wieder, 'f')).toBeNull();
		expect(durchAnderesTraktandumErsetzt(wieder, 'g')).toBe(false);
	});
});

describe('durchAnderesTraktandumErsetzt', () => {
	it('erkennt die Ersetzung über den Folgeantrag, nicht die über einen eigenen Durchgang', () => {
		expect(durchAnderesTraktandumErsetzt(ersetzt, 'g')).toBe(true);
		expect(durchAnderesTraktandumErsetzt(ersetzt, 'f')).toBe(false);
		const eigen = [
			d('g1', 'g', 1, '2026-10-01T19:00:00.000Z', {
				ueberholtAm: '2026-10-01T19:30:00.000Z',
				ueberholungsart: 'rueckkommen',
				ersetztDurchId: 'g2'
			}),
			d('g2', 'g', 2, '2026-10-01T19:20:00.000Z')
		];
		expect(durchAnderesTraktandumErsetzt(eigen, 'g')).toBe(false);
	});
});

describe('lageZumGrundantrag', () => {
	const ohneWeggang = () => false;

	it('nennt den Grundantrag entschieden, auch nach der Ersetzung', () => {
		expect(lageZumGrundantrag(ersetzt, 'f', 'g', ohneWeggang)).toMatchObject({
			entschieden: true,
			// Der Durchgang über f ist der massgebende der Sache, kein eigener daneben.
			eigenerDurchgang: false
		});
	});

	it('erkennt einen Durchgang über den Folgeantrag vor dem Grundantrag', () => {
		const vorher = [d('f1', 'f', 1, '2026-10-01T19:00:00.000Z'), d('g1', 'g', 1, '2026-10-01T19:10:00.000Z')];
		expect(lageZumGrundantrag(vorher, 'f', 'g', ohneWeggang)).toMatchObject({
			entschieden: true,
			eigenerDurchgang: true
		});
	});

	it('nennt ihn nicht entschieden nach einem Weggang ohne Beschluss', () => {
		const g = [d('g1', 'g', 1, '2026-10-01T19:00:00.000Z')];
		expect(lageZumGrundantrag(g, 'f', 'g', () => true).entschieden).toBe(false);
		expect(lageZumGrundantrag([], 'f', 'g', ohneWeggang).entschieden).toBe(false);
	});
});

describe('Eingriffe und Auskunft am Folgeantrag', () => {
	const lage: Traktandumslage = {
		art: 'abstimmung',
		abgestimmt: true,
		durchgangOffen: false,
		zurueckgezogen: false,
		rueckkommenLaeuft: false,
		hatErfordernis: true
	};
	const arten = (l: Traktandumslage) => moeglicheEingriffe(l).map((e) => e.art);

	it('bietet den Gegenantrag nach der Abstimmung nur mit offenem Rückkommen an', () => {
		expect(arten(lage)).not.toContain('gegenantrag');
		expect(arten({ ...lage, rueckkommenOffen: true })).toContain('gegenantrag');
		// Ein erst im Saal aufgenommener Antrag trägt keinen, auch dann nicht.
		expect(arten({ ...lage, rueckkommenOffen: true, spontan: true })).not.toContain('gegenantrag');
	});

	it('sagt beim Gegenantrag nach dem Rückkommen, was Ja und Nein bewirken, je nach bisherigem Beschluss', () => {
		// Fachprüfung 30.09.2026, Runde 2, R2-1: Nach einem Rückkommen auf eine
		// Ablehnung bleibt es mit Nein bei einer Ablehnung.
		const satz = (beschlussAngenommen?: boolean) =>
			moeglicheEingriffe({ ...lage, rueckkommenOffen: true, beschlussAngenommen }).find(
				(e) => e.art === 'gegenantrag'
			)!.satz;
		expect(satz(true)).toContain('der bisherige Beschluss fällt mit Ja wie mit Nein weg');
		expect(satz(undefined)).toContain('fällt mit Ja wie mit Nein weg');
		expect(satz(false)).toContain('mit Ja gilt er, mit Nein bleibt es bei einer Ablehnung');
		expect(satz(false)).not.toContain('fällt');
		expect(satz(true)).toContain('als Ordnungsantrag mit einfachem Mehr, per Handzeichen');
		expect(satz(true)).toContain('oder umgekehrt über einen Gegenantrag');
		// Vor der Abstimmung der bisherige Satz.
		expect(moeglicheEingriffe({ ...lage, abgestimmt: false }).find((e) => e.art === 'gegenantrag')!.satz).toContain(
			'Über ihn wird zuerst abgestimmt'
		);
	});

	it('sagt vor dem Freigeben des Folgeantrags an, was Ja und Nein bewirken', () => {
		const frei = (geltendAngenommen: boolean) =>
			rueckkommensauskunft({
				abgestimmt: false,
				antrag: { nummer: '4.1', stand: 'angenommen', verbraucht: false },
				grundantrag: {
					titel: 'Fassadensanierung',
					eigenerDurchgang: false,
					geltend: { durchgang: 1, traktandum: '4' },
					geltendAngenommen,
					folgeantragTitel: 'Nur die Wetterseite'
				}
			}).satz;
		expect(frei(true)).toContain('bleibt es beim Ergebnis des 1. Durchgangs zu Traktandum 4.');
		// Die Ansage in Anführungszeichen, mit den Titeln (Laienprüfung Runde 3).
		expect(frei(true)).toContain(
			'Sagen Sie vor dem Freigeben an: «Mit Ja gilt «Nur die Wetterseite» an Stelle des bisherigen ' +
				'Beschlusses zu «Fassadensanierung». Mit Nein ist zu dieser Sache nichts mehr angenommen; ' +
				'den bisherigen Beschluss hält in dieser Abstimmung keine Stimme. Wer stattdessen nochmals ' +
				'über «Fassadensanierung» abstimmen will, soll das jetzt sagen.»'
		);
		expect(frei(false)).toContain('«Mit Ja gilt «Nur die Wetterseite». Mit Nein bleibt es bei einer Ablehnung.');
		expect(frei(false)).not.toContain('keine Stimme');
		// Nicht «wer ihn behalten will»: Das verspräche, dass er bleibt (Laienprüfung Runde 2).
		expect(frei(true)).not.toMatch(/behalten will/);
		// Nach Stimmen gezählt, Notiz in jedem Fall (Fachprüfung Runde 3, F3-1).
		expect(frei(true)).toContain('Vertreter zählen für jede Vollmacht, Zugeschaltete fragen Sie einzeln.');
		expect(frei(true)).toContain('geben Sie diesen Antrag nicht frei, sondern rufen den bisherigen auf');
		expect(frei(true)).toContain('in jedem Fall als Notiz bei diesem Traktandum fest');
	});

	it('bietet am Folgeantrag kein Rückkommen an, wenn der Grundantrag entschieden ist', () => {
		expect(arten(lage)).toContain('rueckkommen');
		expect(arten({ ...lage, grundantragEntschieden: true })).not.toContain('rueckkommen');
	});

	it('nennt den Folgeantrag erst mit angenommenem, unverbrauchtem Rückkommen abstimmbar', () => {
		const grundantrag = { titel: 'Fassadensanierung', eigenerDurchgang: false };
		const mit = (stand: 'unbehandelt' | 'laeuft' | 'angenommen' | 'abgelehnt', verbraucht = false) =>
			rueckkommensauskunft({ abgestimmt: false, antrag: { nummer: '4.1', stand, verbraucht }, grundantrag });
		expect(rueckkommensauskunft({ abgestimmt: false, antrag: null, grundantrag }).abstimmbar).toBe(false);
		expect(mit('unbehandelt')).toMatchObject({ abstimmbar: false, weg: 'antrag_aufrufen' });
		expect(mit('laeuft')).toMatchObject({ abstimmbar: false, weg: 'antrag_aufrufen' });
		expect(mit('abgelehnt')).toMatchObject({ abstimmbar: false, weg: null });
		expect(mit('angenommen', true)).toMatchObject({ abstimmbar: false, weg: null });
		expect(mit('angenommen').abstimmbar).toBe(true);
		expect(
			rueckkommensauskunft({
				abgestimmt: true,
				antrag: { nummer: '4.1', stand: 'angenommen', verbraucht: false },
				grundantrag: { ...grundantrag, eigenerDurchgang: true }
			}).abstimmbar
		).toBe(false);
	});
});
