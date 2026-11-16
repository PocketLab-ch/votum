/**
 * Die Sätze zum Folgeantrag, der nach einem Rückkommen statt des alten Antrags
 * zur Abstimmung kam (Plan `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`,
 * Soll 6), und die Suche nach der Lage (`findeErsetzung`).
 *
 * Die Lage im Bestand: Grundantrag g (Traktandum 4) im 1. Durchgang
 * angenommen, Rückkommensantrag r (4.1) angenommen, Folgeantrag f (4.2) statt
 * des alten Antrags abgestimmt.
 */
import { describe, expect, it } from 'vitest';
import type { Durchgang } from '$lib/domain/abstimmung';
import {
	ergebnisLiegtAnderswo,
	ersetzungInKuerze,
	findeErsetzung,
	type Ersetzungslage
} from '$lib/domain/folgeantragsersetzung';

type D = Durchgang & { rueckkommensantragId?: string | null };

function d(id: string, traktandumId: string, zeit: string, mehr: Partial<D> = {}): D {
	return {
		id,
		meetingId: 'v',
		traktandumId,
		nummer: 1,
		zustand: 'geschlossen',
		eroeffnetAm: zeit,
		geschlossenAm: zeit,
		ueberholtAm: null,
		ueberholungsart: null,
		ueberholungsgrund: null,
		ersetztDurchId: null,
		rueckkommensantragId: null,
		...mehr
	};
}

const ziele = new Map([['r', 'g']]);
const G1 = (mehr: Partial<D> = {}) => d('g1', 'g', '2026-10-01T19:00:00.000Z', mehr);
const R1 = d('r1', 'r', '2026-10-01T19:10:00.000Z');
const F1 = (mehr: Partial<D> = {}) =>
	d('f1', 'f', '2026-10-01T19:20:00.000Z', { rueckkommensantragId: 'r', ...mehr });

describe('findeErsetzung', () => {
	const ersetzt = [
		G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
		R1,
		F1()
	];

	it('hält einen als «notweg» beendeten Durchgang nicht für den bisherigen (Migration 134)', () => {
		// Ein Beschluss von Hand am Folgeantrag beendet dort einen offenen
		// Durchgang ohne Auszählung; auch der zeigt auf ihn. Vorn in der Liste,
		// damit die Reihenfolge nicht zufällig das Richtige findet.
		const abgebrochen = d('f0', 'f', '2026-10-01T19:15:00.000Z', {
			ueberholtAm: 'x',
			ueberholungsart: 'notweg',
			ersetztDurchId: 'f1'
		});
		expect(findeErsetzung([abgebrochen, ...ersetzt], 'g', ziele)).toMatchObject({
			fruehererDurchgangId: 'g1',
			folgeDurchgangId: 'f1'
		});
	});

	/*
	 * **Die Sätze folgen dem Stand** (Produktentscheid 01.10.2026), nach einem
	 * Beschluss von Hand ohne tragendes Rückkommen (Migration 134).
	 */
	it('nimmt das Ergebnis des Beschlusses von Hand, der den Folgeantrag berichtigt hat', () => {
		const berichtigt = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			R1,
			F1({ ueberholtAm: 'y', ueberholungsart: 'notweg', ersetztDurchId: 'f2' }),
			d('f2', 'f', '2026-10-01T19:30:00.000Z', { nummer: 2 })
		];
		for (const rolle of ['g', 'f'] as const) {
			expect(findeErsetzung(berichtigt, rolle, ziele)).toMatchObject({
				art: 'ersetzt',
				folgeDurchgangId: 'f2',
				// Der bisherige bleibt der, den der Durchgang unter dem Rückkommen ersetzt hat.
				fruehererDurchgangId: 'g1',
				spaeterErsetzt: false
			});
		}
		// Gegenprobe: Ohne die Berichtigung bleibt es beim Durchgang unter dem Rückkommen.
		expect(findeErsetzung(ersetzt, 'g', ziele)?.folgeDurchgangId).toBe('f1');
	});

	it('folgt der Berichtigung nicht an ein anderes Traktandum und nicht in einen offenen Durchgang', () => {
		const fremd = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			R1,
			F1({ ueberholtAm: 'y', ueberholungsart: 'notweg', ersetztDurchId: 'h1' }),
			d('h1', 'h', '2026-10-01T19:30:00.000Z')
		];
		expect(findeErsetzung(fremd, 'g', ziele)?.folgeDurchgangId).toBe('f1');
		const offen = [
			...fremd.slice(0, 2),
			F1({ ueberholtAm: 'y', ueberholungsart: 'notweg', ersetztDurchId: 'f2' }),
			d('f2', 'f', '2026-10-01T19:30:00.000Z', { nummer: 2, zustand: 'offen' })
		];
		expect(findeErsetzung(offen, 'g', ziele)?.folgeDurchgangId).toBe('f1');
	});

	it('lässt die Sätze an Grund- und Folgeantrag fallen, wenn am Grundantrag danach von Hand beschlossen wurde', () => {
		const zwei = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			R1,
			F1(),
			d('g2', 'g', '2026-10-01T19:30:00.000Z', { nummer: 2 })
		];
		expect(findeErsetzung(zwei, 'g', ziele)).toBeNull();
		expect(findeErsetzung(zwei, 'f', ziele)).toBeNull();
		// Worüber erneut abgestimmt wurde, ändert sich dadurch nicht.
		expect(findeErsetzung(zwei, 'r', ziele)?.rolle).toBe('rueckkommensantrag');
		// Gegenprobe: Ist der spätere Durchgang selbst überholt, stehen die Sätze wieder.
		const ueberholt = [
			...zwei.slice(0, 3),
			d('g2', 'g', '2026-10-01T19:30:00.000Z', { nummer: 2, ueberholtAm: 'z', ueberholungsart: 'korrektur' })
		];
		expect(findeErsetzung(ueberholt, 'f', ziele)?.rolle).toBe('folgeantrag');
	});

	it('lässt dem Folgeantrag ohne eigenes Ergebnis den Satz (Codeprüfung 01.10.2026, M1)', () => {
		// f1 endete ohne Beschluss, g1 blieb; nach einer Neuabstimmung auf g1
		// entsteht g2 ohne Rückkommen, weil es verbraucht ist. Ohne den Satz
		// stünde am Folgeantrag «nicht abgestimmt».
		const ohne = [
			G1({ ueberholtAm: 'z', ueberholungsart: 'korrektur' }),
			R1,
			F1({ ueberholtAm: 'y', ueberholungsart: 'rueckkommen_erfolglos' }),
			d('g2', 'g', '2026-10-01T19:40:00.000Z', { nummer: 2 })
		];
		expect(findeErsetzung(ohne, 'f', ziele)).toMatchObject({ rolle: 'folgeantrag', art: 'ohne_beschluss' });
	});

	it('erkennt alle drei Rollen nach einer Ersetzung', () => {
		expect(findeErsetzung(ersetzt, 'g', ziele)).toMatchObject({
			rolle: 'grundantrag',
			art: 'ersetzt',
			fruehererDurchgangId: 'g1',
			folgeDurchgangId: 'f1',
			spaeterErsetzt: false
		});
		expect(findeErsetzung(ersetzt, 'f', ziele)?.rolle).toBe('folgeantrag');
		expect(findeErsetzung(ersetzt, 'r', ziele)?.rolle).toBe('rueckkommensantrag');
	});

	it('nennt den Ausgang ohne Beschluss und nach einer Neuabstimmung', () => {
		const ohne = [G1(), R1, F1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen_erfolglos' })];
		expect(findeErsetzung(ohne, 'g', ziele)).toMatchObject({
			art: 'ohne_beschluss',
			fruehererDurchgangId: 'g1'
		});
		const neu = [G1(), R1, F1({ ueberholtAm: 'x', ueberholungsart: 'korrektur' })];
		expect(findeErsetzung(neu, 'f', ziele)?.art).toBe('neuabstimmung');
		expect(findeErsetzung(neu, 'f', ziele)?.abgebrochen).toBe(false);
	});

	// H6: Geschlossen und überholt im selben Augenblick, ohne Verkündung, ist
	// ein Abbruch ohne Ergebnis, keine angesetzte Neuabstimmung.
	it('erkennt den Abbruch am Folgeantrag', () => {
		const ab = [
			G1(),
			R1,
			F1({ geschlossenAm: 'x', ueberholtAm: 'x', ueberholungsart: 'korrektur', verkuendetAm: null })
		];
		expect(findeErsetzung(ab, 'g', ziele)).toMatchObject({ art: 'neuabstimmung', abgebrochen: true });
	});

	it('übergeht das Rückkommen am selben Traktandum und den offenen Durchgang', () => {
		const selbes = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'g2' }),
			R1,
			d('g2', 'g', '2026-10-01T19:20:00.000Z', { nummer: 2, rueckkommensantragId: 'r' })
		];
		expect(findeErsetzung(selbes, 'g', ziele)).toBeNull();
		expect(findeErsetzung([G1(), R1, F1({ zustand: 'offen' })], 'g', ziele)).toBeNull();
	});

	it('nennt nach einem zweiten Rückkommen den Beschluss am früheren Folgeantrag (Fachprüfung, Frage A)', () => {
		// g1 durch f1 ersetzt; ein zweites Rückkommen r2, dann f2 ohne Beschluss.
		const z = new Map([
			['r', 'g'],
			['r2', 'g']
		]);
		const kette = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			F1(),
			d('f2', 'f2', '2026-10-01T19:40:00.000Z', {
				rueckkommensantragId: 'r2',
				ueberholtAm: 'y',
				ueberholungsart: 'rueckkommen_erfolglos'
			})
		];
		expect(findeErsetzung(kette, 'g', z)).toMatchObject({
			art: 'ohne_beschluss',
			folgeDurchgangId: 'f2',
			fruehererDurchgangId: 'f1'
		});
	});

	/*
	 * **Ein späteres Rückkommen am Grundantrag überholt die Lage** (Codeprüfung
	 * B2b, M1). g1, dann f1 ohne Beschluss, dann ein zweites Rückkommen r2 und g2
	 * über den alten Antrag.
	 */
	it('überlässt den Grundantrag den bisherigen Sätzen, wenn danach wieder über ihn abgestimmt wurde', () => {
		const z = new Map([
			['r', 'g'],
			['r2', 'g']
		]);
		const lage = [
			G1({ ueberholtAm: 'z', ueberholungsart: 'rueckkommen', ersetztDurchId: 'g2' }),
			R1,
			F1({ ueberholtAm: 'y', ueberholungsart: 'rueckkommen_erfolglos' }),
			d('g2', 'g', '2026-10-01T19:40:00.000Z', { nummer: 2, rueckkommensantragId: 'r2' })
		];
		expect(findeErsetzung(lage, 'g', z)).toBeNull();
		// Beim Folgeantrag bleibt der Satz, und der Beschluss, bei dem es blieb,
		// ist der damals geltende g1, nicht der spätere g2.
		expect(findeErsetzung(lage, 'f', z)).toMatchObject({
			art: 'ohne_beschluss',
			fruehererDurchgangId: 'g1'
		});
	});

	it('behält den Satz am Grundantrag, wenn der spätere Durchgang dort keinen Beschluss hinterliess', () => {
		// Codeprüfung B2b, zweiter Durchgang, Befund 2 (Lage D): g1 durch f1
		// ersetzt, dann r2 und g2 ohne Beschluss. g hat keinen eigenen geltenden
		// Durchgang; ohne den Satz fiel das Protokoll auf «nicht abgestimmt» zurück.
		const z = new Map([
			['r', 'g'],
			['r2', 'g']
		]);
		const lage = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			F1(),
			d('g2', 'g', '2026-10-01T19:40:00.000Z', {
				nummer: 2,
				rueckkommensantragId: 'r2',
				ueberholtAm: 'y',
				ueberholungsart: 'rueckkommen_erfolglos'
			})
		];
		expect(findeErsetzung(lage, 'g', z)).toMatchObject({ rolle: 'grundantrag', art: 'ersetzt' });
	});

	it('überlässt den Rückkommensantrag den bisherigen Sätzen, wenn ein späterer Durchgang ihn trägt', () => {
		// Neuabstimmung auf f1, danach über den alten Antrag, gestützt auf dasselbe r.
		const lage = [
			G1({ ueberholtAm: 'z', ueberholungsart: 'rueckkommen', ersetztDurchId: 'g2' }),
			R1,
			F1({ ueberholtAm: 'y', ueberholungsart: 'korrektur' }),
			d('g2', 'g', '2026-10-01T19:40:00.000Z', { nummer: 2, rueckkommensantragId: 'r' })
		];
		expect(findeErsetzung(lage, 'r', ziele)).toBeNull();
		expect(findeErsetzung(lage, 'g', ziele)).toBeNull();
		expect(findeErsetzung(lage, 'f', ziele)?.art).toBe('neuabstimmung');
	});

	it('merkt, wenn der Beschluss zum Folgeantrag später selbst ersetzt ist', () => {
		const kette = [
			G1({ ueberholtAm: 'x', ueberholungsart: 'rueckkommen', ersetztDurchId: 'f1' }),
			F1({ ueberholtAm: 'y', ueberholungsart: 'rueckkommen', ersetztDurchId: 'g2' })
		];
		expect(findeErsetzung(kette, 'f', ziele)?.spaeterErsetzt).toBe(true);
	});
});

describe('ergebnisLiegtAnderswo', () => {
	const l = (mehr: Partial<Ersetzungslage>): Ersetzungslage => ({
		rolle: 'grundantrag',
		grundantrag: { nummer: '4', titel: 'G' },
		folgeantrag: { nummer: '4.2', titel: 'F' },
		rueckkommensantrag: '4.1',
		frueher: null,
		ausgang: 'angenommen',
		spaeterErsetzt: false,
		...mehr
	});
	it('nennt den ersetzten Grundantrag und den später ersetzten Folgeantrag, sonst nichts', () => {
		expect(ergebnisLiegtAnderswo(l({}), null)).toBe(true);
		expect(ergebnisLiegtAnderswo(l({ rolle: 'folgeantrag', spaeterErsetzt: true }), null)).toBe(true);
		expect(ergebnisLiegtAnderswo(l({ rolle: 'folgeantrag' }), null)).toBe(false);
		expect(ergebnisLiegtAnderswo(l({ rolle: 'rueckkommensantrag' }), null)).toBe(false);
		// Mit eigener Auszählung liegt das Ergebnis hier.
		expect(ergebnisLiegtAnderswo(l({}), { angenommen: true })).toBe(false);
		expect(ergebnisLiegtAnderswo(null, null)).toBe(false);
	});
});

describe('ersetzungInKuerze', () => {
	const basis: Ersetzungslage = {
		rolle: 'grundantrag',
		grundantrag: { nummer: '4', titel: 'Fassadensanierung' },
		folgeantrag: { nummer: '4.2', titel: 'Nur die Wetterseite' },
		rueckkommensantrag: '4.1',
		frueher: { nummer: 1, ergebnis: 'angenommen' },
		ausgang: 'angenommen',
		spaeterErsetzt: false
	};
	const mit = (l: Partial<Ersetzungslage>) => ersetzungInKuerze({ ...basis, ...l });

	it('sagt am Grundantrag, dass der Folgeantrag den Beschluss ersetzt', () => {
		expect(mit({})).toBe(
			'Nach dem Rückkommen (Traktandum 4.1) kam statt dieses Antrags der Folgeantrag 4.2 ' +
				'«Nur die Wetterseite» zur Abstimmung. Er wurde angenommen; sein Beschluss ersetzt den ' +
				'bisherigen aus dem 1. Durchgang («angenommen»).'
		);
	});

	it('sagt am Grundantrag, dass die Ablehnung den Beschluss aufhebt', () => {
		// Abgelehnt ist der Folgeantrag, nicht die Sache (Fachprüfung F-3).
		expect(mit({ ausgang: 'abgelehnt' })).toContain(
			'Er wurde abgelehnt; damit ist der bisherige Beschluss aus dem 1. Durchgang («angenommen») ' +
				'aufgehoben. Abgelehnt ist nur der Folgeantrag; angenommen ist zu dieser Sache nichts mehr.'
		);
		expect(mit({ ausgang: 'abgelehnt' })).not.toMatch(/gilt die Ablehnung/);
	});

	it('nennt den bisherigen Beschluss mit seinem Traktandum, wenn er an einem Folgeantrag liegt', () => {
		const zuF = { nummer: 1, ergebnis: 'angenommen' as const, traktandum: '4.2' };
		expect(mit({ ausgang: 'ohne_beschluss', frueher: zuF })).toContain(
			'Es bleibt beim Beschluss zu Traktandum 4.2 aus dem 1. Durchgang.'
		);
		// Ein zweiter Folgeantrag 4.3 ersetzt den Beschluss zu 4.2.
		expect(
			mit({ rolle: 'folgeantrag', folgeantrag: { nummer: '4.3', titel: 'Nur die Nordseite' }, frueher: zuF })
		).toContain('Dieser Beschluss ersetzt den bisherigen zu Traktandum 4.2 aus dem 1. Durchgang («angenommen»).');
		// Am selben Folgeantrag kein Selbstverweis (Codeprüfung B2b, N5).
		expect(mit({ rolle: 'folgeantrag', frueher: zuF })).toContain(
			'Dieser Beschluss ersetzt den bisherigen aus dem 1. Durchgang («angenommen»).'
		);
	});

	it('sagt ohne Beschluss, was bleibt, mit Grund', () => {
		expect(mit({ ausgang: 'ohne_beschluss', grund: 'die Universalversammlung hielt nicht' })).toContain(
			'Ein Beschluss kam dabei nicht zustande (die Universalversammlung hielt nicht). Es bleibt beim ' +
				'Beschluss aus dem 1. Durchgang.'
		);
		expect(
			mit({ ausgang: 'ohne_beschluss', frueher: { nummer: 1, ergebnis: 'abgelehnt' } })
		).toContain('Es bleibt bei der Ablehnung aus dem 1. Durchgang.');
		expect(mit({ ausgang: 'ohne_beschluss', grund: 'stichentscheid' })).toContain(
			'bis eine Neuabstimmung entscheidet'
		);
	});

	it('nennt nach einer Neuabstimmung nur die Anordnung, nicht ihre Wirkung', () => {
		// Offene Frage (b) in docs/freigabe.md: keine neuen Sätze über die Wirkung.
		const g = mit({ ausgang: 'neuabstimmung' });
		expect(g).toContain('die Sitzungsleitung hat dort eine Neuabstimmung angesetzt');
		expect(g).not.toMatch(/gilt|bleibt|ersetzt/);
		expect(mit({ rolle: 'folgeantrag', ausgang: 'neuabstimmung' })).toBe(
			'Nach dem Rückkommen (Traktandum 4.1) wurde statt über den Antrag zu Traktandum 4 ' +
				'«Fassadensanierung» abgestimmt.'
		);
	});

	it('nennt nach einem Abbruch am Folgeantrag den Abbruch, keine Neuabstimmung', () => {
		const g = mit({ ausgang: 'neuabstimmung', abgebrochen: true });
		expect(g).toContain('die Sitzungsleitung hat die Abstimmung dort ohne Ergebnis abgebrochen');
		expect(g).not.toContain('Neuabstimmung');
	});

	it('nennt am Folgeantrag, woran er ersetzt, und am Rückkommensantrag, worüber abgestimmt wurde', () => {
		expect(mit({ rolle: 'folgeantrag' })).toBe(
			'Nach dem Rückkommen (Traktandum 4.1) wurde statt über den Antrag zu Traktandum 4 ' +
				'«Fassadensanierung» abgestimmt. Dieser Beschluss ersetzt den bisherigen zu Traktandum 4 ' +
				'aus dem 1. Durchgang («angenommen»).'
		);
		expect(mit({ rolle: 'folgeantrag', spaeterErsetzt: true })).toContain(
			'Nach einem weiteren Rückkommen ist dieser Beschluss selbst ersetzt; siehe Traktandum 4.'
		);
		expect(mit({ rolle: 'rueckkommensantrag' })).toBe(
			'Erneut abgestimmt wurde über den Folgeantrag 4.2 «Nur die Wetterseite» statt über den ' +
				'bisherigen Antrag; siehe Traktandum 4.2.'
		);
	});
});
