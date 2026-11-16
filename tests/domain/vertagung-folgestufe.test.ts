/**
 * C3 (F4c): Nach zeitweiser Beschlussfähigkeit wird die Folgeversammlung eine
 * neue erste (Einteilung F3b; Produktentscheid 04.11.2026). Die Regel steht bei
 * `warZeitweiseBeschlussfaehig` und `folgestufeNachVertagung`, die Sätze bei
 * `folgestufenSatz`, `vertagtMeldung` und `vertagenNeueErsteSatz`.
 */
import { describe, expect, it } from 'vitest';
import { folgestufeNachVertagung, warZeitweiseBeschlussfaehig } from '$lib/domain/beschlussfaehigkeit';
import {
	folgestufenSatz,
	folgeversammlung,
	vertagenNeueErsteSatz,
	vertagenUeberschrift,
	vertagtMeldung
} from '$lib/domain/versammlung';

const leer = { feststellungen: [], durchgaenge: [] };

describe('warZeitweiseBeschlussfaehig', () => {
	it('ist ohne Feststellung und ohne Durchgang nicht beschlussfähig gewesen', () => {
		expect(warZeitweiseBeschlussfaehig(leer)).toBe(false);
	});

	it('zählt eine festgehaltene Beschlussfähigkeit, auch wenn eine spätere sie verneint', () => {
		expect(
			warZeitweiseBeschlussfaehig({
				...leer,
				feststellungen: [{ beschlussfaehig: true }, { beschlussfaehig: false }]
			})
		).toBe(true);
	});

	it('zählt eine Feststellung «nicht beschlussfähig» nicht', () => {
		expect(warZeitweiseBeschlussfaehig({ ...leer, feststellungen: [{ beschlussfaehig: false }] })).toBe(false);
	});

	it('zählt einen verbindlichen Durchgang, weil er nur nach der Prüfung öffnet', () => {
		expect(
			warZeitweiseBeschlussfaehig({ ...leer, durchgaenge: [{ konsultativ: false, vonHandOhneQuorum: false }] })
		).toBe(true);
	});

	it('zählt weder einen konsultativen Durchgang noch einen Beschluss von Hand ohne Beschlussfähigkeit', () => {
		expect(
			warZeitweiseBeschlussfaehig({
				...leer,
				durchgaenge: [
					{ konsultativ: true, vonHandOhneQuorum: false },
					{ konsultativ: false, vonHandOhneQuorum: true }
				]
			})
		).toBe(false);
	});
});

describe('folgestufeNachVertagung', () => {
	it('ergibt die zweite nur an einer ersten, die nie beschlussfähig war', () => {
		expect(folgestufeNachVertagung('erste', false)).toBe('zweite');
		expect(folgestufeNachVertagung('erste', true)).toBe('erste');
	});
});

describe('folgeversammlung', () => {
	const vorgaengerin = {
		id: 'v-1',
		stwegId: 'g-1',
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich' as const,
		betriebsart: 'gefuehrt' as const
	};

	it('setzt an der zweiten Stufe und Vorgängerin', () => {
		const e = folgeversammlung(vorgaengerin, 11);
		expect(e.stufe).toBe('zweite');
		expect(e.vorgaengerId).toBe('v-1');
		expect(e.vorgaengerDatum).toBe('2026-05-20');
	});

	it('lässt an einer neuen ersten die Vorgängerin weg', () => {
		const e = folgeversammlung(vorgaengerin, 11, 'erste');
		expect(e.stufe).toBe('erste');
		expect(e.vorgaengerId).toBeUndefined();
		expect(e.vorgaengerDatum).toBeUndefined();
		expect(e.datum).toBe('2026-05-31');
	});
});

describe('Sätze zur Folgeversammlung', () => {
	it('nennt je Stufe die Häuser, in Einzahl und Mehrzahl', () => {
		expect(folgestufenSatz([{ gemeinschaft: 'Erfundenweg 1', folgestufe: 'zweite' }])).toBe(
			'Als zweite Versammlung tagt «Erfundenweg 1». Dort genügt nach Gesetz ein Drittel aller Eigentümer, ' +
				'mindestens zwei (ZGB Art. 712p Abs. 3). Das gilt für die Geschäfte, die in der Einladung zur ' +
				'vertagten Versammlung zur Abstimmung angekündigt waren.'
		);
		const gemischt = folgestufenSatz([
			{ gemeinschaft: 'A', folgestufe: 'zweite' },
			{ gemeinschaft: 'B', folgestufe: 'erste' },
			{ gemeinschaft: 'C', folgestufe: 'erste' }
		]);
		expect(gemischt).toContain('Als zweite Versammlung tagt «A». Dort genügt');
		expect(gemischt).toContain('Als neue erste Versammlung tagen «B» und «C», weil diese');
		expect(gemischt).toContain('schon beschlussfähig waren');
	});

	it('sagt nicht mehr «ohne Mindestzahl»', () => {
		const alle = [
			folgestufenSatz([{ gemeinschaft: 'A', folgestufe: 'zweite' }]),
			vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'zweite', '31. Mai 2026'),
			vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'erste', '31. Mai 2026')
		];
		for (const s of alle) expect(s).not.toContain('Mindestzahl');
	});

	it('meldet die neue erste mit dem Grund', () => {
		const s = vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'erste', '31. Mai 2026');
		expect(s).toContain('war schon beschlussfähig');
		expect(s).toContain('neue erste Versammlung');
		expect(s).toContain('frühestens am elften Tag');
		expect(s).toContain('Votum prüft beides nicht');
		expect(s).not.toContain('712p Abs. 3');
	});

	it('stellt die offene Lesart nicht als Kommentarmeinung dar (Fachprüfung F4c, Block 2)', () => {
		const alle = [
			vertagenNeueErsteSatz('31. Mai 2026'),
			folgestufenSatz([{ gemeinschaft: 'B', folgestufe: 'erste' }]),
			vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'erste', '31. Mai 2026')
		];
		for (const s of alle) expect(s).not.toContain('Rz. 29');
		expect(vertagenNeueErsteSatz('31. Mai 2026')).toContain('Ausdrücklich geregelt ist der Fall nicht');
		// Der Entwurf vom Datum ist die neue erste, nicht die zweite danach (Runde 2).
		expect(vertagenNeueErsteSatz('31. Mai 2026')).toContain('Die neue erste entsteht sofort als Entwurf');
		expect(vertagenNeueErsteSatz('31. Mai 2026')).toMatch(/folgt ihr eine zweite\.$/);
		expect(folgestufenSatz([{ gemeinschaft: 'B', folgestufe: 'erste' }])).not.toContain('Rz.');
	});

	it('hält jeden Satz unter 180 Zeichen', () => {
		const text = [
			vertagenNeueErsteSatz('31. Mai 2026'),
			vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'zweite', '31. Mai 2026'),
			vertagtMeldung({ datum: '2026-05-31', uhrzeit: '19:00', ort: 'Saal' }, 'erste', '31. Mai 2026'),
			folgestufenSatz([
				{ gemeinschaft: 'A', folgestufe: 'zweite' },
				{ gemeinschaft: 'B', folgestufe: 'erste' }
			])
		].join(' ');
		for (const satz of text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ«])/)) expect(satz.length).toBeLessThanOrEqual(180);
	});

	it('hält den Ausklapper auch mit langem Monatsnamen unter 180 Zeichen je Satz', () => {
		const text = vertagenNeueErsteSatz('30. September 2026');
		for (const satz of text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ«])/)) expect(satz.length).toBeLessThanOrEqual(180);
	});

	it('nennt im Ausklapper die neue erste und das Datum', () => {
		expect(vertagenUeberschrift(true)).toBe('Vertagen und neue Versammlung ansetzen');
		expect(vertagenUeberschrift(false)).toBe('Vertagen und zweite Versammlung ansetzen');
		expect(vertagenNeueErsteSatz('31. Mai 2026')).toContain('Datum 31. Mai 2026.');
	});
});
