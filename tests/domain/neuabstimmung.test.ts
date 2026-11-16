/**
 * Die Neuabstimmung nach Eintritt der Beschlussfähigkeit, reine Rechnungen
 * (Produktentscheid 03.10.2026, Migration 139).
 *
 * Geprüft werden die Werte der Einstellung, die zwei Sätze der Sitzungsleitung
 * und der Protokollsatz. Den Weg am Bestand (Tor, Ersetzung, Protokoll) misst
 * `tests/db/beschluss-von-hand.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	NEUABSTIMMUNG_VORGABE,
	direktNachQuorumSatz,
	istNeuabstimmungsart,
	pruefeNeuabstimmung
} from '$lib/domain/neuabstimmung';
import { nachQuorumSatz } from '$lib/domain/protokoll';
import {
	ohneAnnahmeNachQuorum,
	ohneAnnahmeNachQuorumNach,
	rueckkommensauskunft,
	type Ersetzungsart
} from '$lib/domain/rueckkommen';

describe('Die Einstellung', () => {
	it('kennt zwei Werte und die Vorgabe «direkt»', () => {
		expect(NEUABSTIMMUNG_VORGABE).toBe('direkt');
		expect(istNeuabstimmungsart('direkt')).toBe(true);
		expect(istNeuabstimmungsart('rueckkommen')).toBe(true);
		expect(istNeuabstimmungsart('vielleicht')).toBe(false);
		expect(pruefeNeuabstimmung('rueckkommen')).toBe('rueckkommen');
		expect(() => pruefeNeuabstimmung('vielleicht')).toThrow(/direkt oder über das Rückkommen/);
	});
});

describe('Der Satz der Sitzungsleitung', () => {
	it('nennt bei beschlussfähiger Versammlung die Wirkung und die Wahl', () => {
		const s = direktNachQuorumSatz(1, true);
		expect(s).toMatch(
			/Die Sitzungsleitung hat den Beschluss des 1\. Durchgangs festgehalten, obwohl die Versammlung nicht beschlussfähig war\./
		);
		expect(s).toMatch(/Ihre Gemeinschaft lässt den zweiten Durchgang direkt zu\./);
		expect(s).toMatch(/Die Versammlung ist jetzt beschlussfähig; Sie können die Abstimmung freigeben\./);
		expect(s).toMatch(
			/Wird der Antrag angenommen, ersetzt der neue Durchgang das frühere Ergebnis\./
		);
		expect(s).toMatch(
			/Wird er abgelehnt oder kommt kein Beschluss zustande, bleibt es beim früheren Ergebnis\./
		);
		expect(s).toMatch(/Ob neu abgestimmt wird, entscheiden Sie\./);
	});

	it('sagt bei fehlender Beschlussfähigkeit, worauf der Weg wartet', () => {
		const s = direktNachQuorumSatz(2, false);
		expect(s).toMatch(
			/Sobald die Versammlung beschlussfähig ist, können Sie die Abstimmung freigeben; solange die Warnung «Nicht beschlussfähig» steht, ist es noch nicht so weit\./
		);
		expect(s).not.toMatch(/ist jetzt beschlussfähig/);
	});
});

describe('Die Auskunft an der Leitung', () => {
	it('gibt ohne Rückkommensantrag den direkten Weg frei', () => {
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: null,
			direktNachQuorum: { nummer: 1, beschlussfaehig: true }
		});
		expect(a.abstimmbar).toBe(true);
		expect(a.weg).toBeNull();
		expect(a.satz).toBe(direktNachQuorumSatz(1, true));
	});

	it('bleibt ohne die Angabe bei der Rückkommensabsage', () => {
		const a = rueckkommensauskunft({ abgestimmt: true, antrag: null });
		expect(a.abstimmbar).toBe(false);
		expect(a.weg).toBe('rueckkommen_beantragen');
		expect(a.satz).toMatch(/Ein zweiter Durchgang braucht einen Beschluss der Versammlung/);
	});

	it('lässt einen gestellten Rückkommensantrag vorgehen', () => {
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: {
				nummer: '4.1',
				stand: 'unbehandelt',
				verbraucht: false
			},
			direktNachQuorum: { nummer: 1, beschlussfaehig: true }
		});
		expect(a.abstimmbar).toBe(false);
		expect(a.weg).toBe('antrag_aufrufen');
		expect(a.satz).not.toMatch(/direkt neu abstimmen/);
	});
});

describe('Die Leser des gescheiterten zweiten Durchgangs', () => {
	const dazu: { nummer: number; ueberholungsart: Ersetzungsart | null }[] = [
		{ nummer: 1, ueberholungsart: 'nachquorum' },
		{ nummer: 2, ueberholungsart: 'nachquorum_erfolglos' }
	];

	it('findet den gescheiterten zweiten Durchgang nach dem geltenden ersten', () => {
		expect(
			ohneAnnahmeNachQuorumNach(dazu, { nummer: 1, ueberholungsart: null })?.nummer
		).toBe(2);
	});

	it('nimmt keinen früheren Durchgang als den zweiten', () => {
		// Wird nach dem gescheiterten zweiten erneut von Hand festgehalten (3),
		// liegt der Fehlversuch vor dem geltenden und gehört nicht in den Satz.
		expect(ohneAnnahmeNachQuorumNach(dazu, { nummer: 3, ueberholungsart: null })).toBeNull();
	});

	it('nennt die Ablehnung und die Nichtannahme, und keine «Beschluss», wo der erste abgelehnt war', () => {
		expect(ohneAnnahmeNachQuorum(2, 1, 'abgelehnt', false)).toBe(
			'Im 2. Durchgang wurde der Antrag abgelehnt; der Beschluss aus dem 1. Durchgang bleibt in Kraft.'
		);
		expect(ohneAnnahmeNachQuorum(2, 1, 'kein_beschluss', false)).toBe(
			'Ein Beschluss kam im 2. Durchgang nicht zustande; der Beschluss aus dem 1. Durchgang bleibt in Kraft.'
		);
		expect(ohneAnnahmeNachQuorum(2, 1, 'abgelehnt', true)).toBe(
			'Im 2. Durchgang wurde der Antrag abgelehnt; es bleibt bei der Ablehnung aus dem 1. Durchgang.'
		);
		expect(ohneAnnahmeNachQuorum(2, 1, 'kein_beschluss', true)).not.toMatch(/der Beschluss/);
	});
});

describe('Der Protokollsatz', () => {
	const lage = {
		ohneQuorum: {
			nummer: 1,
			zeitpunkt: '19:42',
			anwesend: {
				eigentuemerGesamt: 4,
				eigentuemerAnwesend: 1,
				kopfstimmenGesamt: 4,
				kopfstimmenAnwesend: 1,
				gesamtquote: 900,
				quotenAnwesend: 225
			},
			angenommen: true
		},
		danach: {
			nummer: 2,
			zeitpunkt: '20:15',
			anwesend: {
				eigentuemerGesamt: 4,
				eigentuemerAnwesend: 2,
				kopfstimmenGesamt: 4,
				kopfstimmenAnwesend: 2,
				gesamtquote: 900,
				quotenAnwesend: 450
			}
		},
		ausgang: 'angenommen' as const,
		grundlage: 'gesetz' as const,
		fundstelle: null
	};

	it('nennt beide Durchgänge mit Uhrzeit und Präsenz und die Ersetzung', () => {
		const s = nachQuorumSatz(lage);
		expect(s).toMatch(
			/Der 1\. Durchgang wurde um 19:42 Uhr ohne Beschlussfähigkeit festgehalten \(ZGB Art\. 712p\)\./
		);
		expect(s).toMatch(/Die Sitzungsleitung hat den Beschluss festgehalten\./);
		expect(s).toMatch(
			/Beim Festhalten waren anwesend oder vertreten: 1 von 4 Stockwerkeigentümern, dazu 1 von 4 Kopfstimmen und 225 von 900 Wertquoten\./
		);
		expect(s).toMatch(
			/Nachdem die Versammlung beschlussfähig geworden war, wurde im 2\. Durchgang um 20:15 Uhr erneut abgestimmt\./
		);
		expect(s).toMatch(
			/Beim Schluss des Durchgangs waren anwesend oder vertreten: 2 von 4 Stockwerkeigentümern, dazu 2 von 4 Kopfstimmen und 450 von 900 Wertquoten\./
		);
		expect(s).toMatch(/Dieser Beschluss ersetzt den Beschluss aus dem 1\. Durchgang\./);
	});

	it('nennt bei einer Handzählung die Präsenz beim Zählen, nicht beim Schluss', () => {
		// Der eingefrorene Stand ist dann der beim Zählen der Hände (Migration
		// 156); «beim Schluss» behauptete eine Präsenz, die es dann nicht gab.
		const s = nachQuorumSatz({ ...lage, danach: { ...lage.danach, vonHandGezaehlt: true } });
		expect(s).toMatch(
			/Beim Zählen der Hände waren anwesend oder vertreten: 2 von 4 Stockwerkeigentümern/
		);
		expect(s).not.toMatch(/Beim Schluss des Durchgangs/);
	});

	it('lässt bei einer Ablehnung den früheren in Kraft, mit der Reglementsfundstelle', () => {
		const s = nachQuorumSatz({
			...lage,
			ausgang: 'abgelehnt',
			grundlage: 'reglement',
			fundstelle: 'Art. 18'
		});
		expect(s).toMatch(/\(Art\. 18 des Reglements\)/);
		expect(s).toMatch(
			/Im 2\. Durchgang wurde der Antrag abgelehnt; der Beschluss aus dem 1\. Durchgang bleibt in Kraft\./
		);
		expect(s).not.toMatch(/Dieser Beschluss ersetzt/);
	});

	it('lässt bei einem Durchgang ohne Beschluss den früheren in Kraft', () => {
		const s = nachQuorumSatz({ ...lage, ausgang: 'kein_beschluss' });
		expect(s).toMatch(
			/Ein Beschluss kam im 2\. Durchgang nicht zustande; der Beschluss aus dem 1\. Durchgang bleibt in Kraft\./
		);
		expect(s).not.toMatch(/Dieser Beschluss ersetzt/);
	});

	it('spricht bei einem abgelehnten ersten Durchgang nicht von einem Beschluss', () => {
		const ersetzt = nachQuorumSatz({
			...lage,
			ohneQuorum: { ...lage.ohneQuorum, angenommen: false }
		});
		expect(ersetzt).toMatch(/Dieser Beschluss ersetzt die Ablehnung aus dem 1\. Durchgang\./);
		expect(ersetzt).not.toMatch(/ersetzt den Beschluss/);
		const bleibt = nachQuorumSatz({
			...lage,
			ausgang: 'abgelehnt',
			ohneQuorum: { ...lage.ohneQuorum, angenommen: false }
		});
		expect(bleibt).toMatch(
			/Im 2\. Durchgang wurde der Antrag abgelehnt; es bleibt bei der Ablehnung aus dem 1\. Durchgang\./
		);
	});

	it('der Satz der Wand ist der des Protokolls, damit die Leser nicht auseinanderlaufen', () => {
		// Codeprüfung 03.10.2026, zweiter Durchgang: Der Wortlaut wird an zwei
		// Stellen geführt; der Test bindet sie aneinander. `geltendAbgelehnt`
		// der Wand ist das Gegenteil von `angenommen` des ersten Durchgangs.
		for (const [ausgang, angenommen] of [
			['abgelehnt', true],
			['kein_beschluss', true],
			['abgelehnt', false],
			['kein_beschluss', false]
		] as const) {
			const protokoll = nachQuorumSatz({
				...lage,
				ausgang,
				ohneQuorum: { ...lage.ohneQuorum, angenommen }
			});
			expect(protokoll.endsWith(ohneAnnahmeNachQuorum(2, 1, ausgang, !angenommen))).toBe(true);
		}
	});

	it('lässt fehlende Zahlen weg, statt eine Null zu behaupten', () => {
		const s = nachQuorumSatz({
			...lage,
			ohneQuorum: { ...lage.ohneQuorum, anwesend: null },
			danach: { ...lage.danach, anwesend: null }
		});
		expect(s).not.toMatch(/waren anwesend oder vertreten/);
		expect(s).toMatch(/Der 1\. Durchgang wurde um 19:42 Uhr ohne Beschlussfähigkeit festgehalten/);
	});
});
