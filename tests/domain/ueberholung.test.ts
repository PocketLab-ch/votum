import { describe, expect, it } from 'vitest';
import {
	abgebrochen,
	brecheDurchgangAb,
	ueberholeDurchgang,
	WEG_NACH_DER_VERKUENDUNG,
	type Durchgang
} from '../../src/lib/domain/abstimmung';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';

/**
 * Die Überholung eines Durchgangs, zweierlei Ereignis
 * (Produktentscheid 08.10.2026, `docs/freigabe.md`, «Offen: Reste zur
 * Universalversammlung», Punkt 6): Die Neuabstimmung setzt die Leitung an, die
 * Neueröffnung nach einem Weggang geschieht von selbst, sobald wieder alle da
 * sind. Im Verlauf heisst die eine «Neuabstimmung angesetzt», die andere
 * «Abstimmung neu eröffnet» — und beide gehen ins Abschlusspaket.
 */
function geschlossen(): Durchgang {
	return {
		id: 'd-1',
		meetingId: 'm-1',
		traktandumId: 't-1',
		nummer: 1,
		zustand: 'geschlossen',
		eroeffnetAm: '2027-07-12T19:00:00.000Z',
		geschlossenAm: '2027-07-12T19:05:00.000Z',
		ueberholtAm: null,
		ueberholungsgrund: null
	};
}

describe('ueberholeDurchgang', () => {
	it('schreibt für die Neuabstimmung das Ereignis «Neuabstimmung angesetzt»', () => {
		const u = ueberholeDurchgang(
			geschlossen(),
			'2027-07-12T19:10:00.000Z',
			'Falsche Fragestellung im Saal.',
			'Titel'
		);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.abstimmungWiederholt);
	});

	it('schreibt für die Neueröffnung nach einem Weggang das eigene Ereignis', () => {
		const u = ueberholeDurchgang(
			geschlossen(),
			'2027-07-12T19:10:00.000Z',
			'Zwei Parteien waren während der Abstimmung gegangen.',
			'Titel',
			true
		);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.abstimmungNeuEroeffnet);
		expect(u.ereignisse[0].art).not.toBe(EREIGNISARTEN.abstimmungWiederholt);
	});
});

/**
 * **Überholen nur bis zur Verkündung** (H6; Fachprüfung 08.10.2026, `quellen`
 * Frage 65). Ein verkündeter Beschluss wirkt, bis er nach Art. 75 aufgehoben
 * ist; ändern kann ihn nur die Versammlung. Die Neueröffnung nach einem
 * Weggang ist ausgenommen, weil der Durchgang keinen Beschluss ergab.
 */
describe('ueberholeDurchgang nach der Verkündung', () => {
	const verkuendet = (): Durchgang => ({ ...geschlossen(), verkuendetAm: '2027-07-12T19:05:00.000Z' });

	it('weist die Neuabstimmung ab und nennt das Rückkommen', () => {
		expect(() =>
			ueberholeDurchgang(verkuendet(), '2027-07-12T19:10:00.000Z', 'Stimmen doppelt erfasst.', 'Titel')
		).toThrow(expect.objectContaining({ kennung: 'schon_verkuendet' }));
		expect(() =>
			ueberholeDurchgang(verkuendet(), '2027-07-12T19:10:00.000Z', 'Stimmen doppelt erfasst.', 'Titel')
		).toThrow(WEG_NACH_DER_VERKUENDUNG);
	});

	it('lässt die Neueröffnung nach einem Weggang zu', () => {
		const u = ueberholeDurchgang(
			verkuendet(),
			'2027-07-12T19:10:00.000Z',
			'Zwei Parteien waren während der Abstimmung gegangen.',
			'Titel',
			true
		);
		expect(u.ergebnis.ueberholtAm).toBe('2027-07-12T19:10:00.000Z');
	});

	it('lässt die Neuabstimmung zu, solange nicht verkündet ist (offener Gleichstand)', () => {
		const u = ueberholeDurchgang(
			{ ...geschlossen(), verkuendetAm: null },
			'2027-07-12T19:10:00.000Z',
			'Gleichstand, Stimmen einzeln erfassen.',
			'Titel'
		);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.abstimmungWiederholt);
	});
});

/**
 * **Ohne Ergebnis abbrechen** (H6; Laien- und Fachprüfung 14.10.2026, F-1):
 * nur die laufende Abstimmung, mit Begründung, geschlossen und überholt im
 * selben Augenblick, ohne Verkündung.
 */
describe('brecheDurchgangAb', () => {
	const offen = (): Durchgang => ({ ...geschlossen(), zustand: 'offen', geschlossenAm: null });

	it('schliesst und überholt im selben Augenblick, mit eigenem Ereignis', () => {
		const u = brecheDurchgangAb(offen(), '2027-07-12T19:04:00.000Z', 'Ausstand war nicht erfasst.', 'Titel');
		expect(u.ergebnis.zustand).toBe('geschlossen');
		expect(u.ergebnis.geschlossenAm).toBe('2027-07-12T19:04:00.000Z');
		expect(u.ergebnis.ueberholtAm).toBe('2027-07-12T19:04:00.000Z');
		expect(u.ergebnis.ueberholungsart).toBe('korrektur');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.abstimmungAbgebrochen);
		expect(abgebrochen(u.ergebnis)).toBe(true);
	});

	it('weist einen geschlossenen Durchgang ab', () => {
		expect(() =>
			brecheDurchgangAb(geschlossen(), '2027-07-12T19:10:00.000Z', 'Ausstand war nicht erfasst.', 'Titel')
		).toThrow(expect.objectContaining({ kennung: 'nicht_offen' }));
	});

	it('verlangt eine Begründung', () => {
		expect(() => brecheDurchgangAb(offen(), '2027-07-12T19:04:00.000Z', 'kurz', 'Titel')).toThrow(
			expect.objectContaining({ kennung: 'begruendung_fehlt' })
		);
	});

	it('erkennt eine Neuabstimmung beim Gleichstand nicht als Abbruch', () => {
		const u = ueberholeDurchgang(geschlossen(), '2027-07-12T19:10:00.000Z', 'Stimmen einzeln erfassen.', 'Titel');
		expect(abgebrochen({ ...u.ergebnis, ueberholungsart: 'korrektur' })).toBe(false);
	});
});
