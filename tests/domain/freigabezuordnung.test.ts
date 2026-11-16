/**
 * Die Zuordnung, die die Leitung mit dem Freigeben bestätigt (Ä-05, nur der
 * Kern; Auftrag M4). Die Datenbankseite, also die Absage bei überholter Marke
 * und der Eintrag im Verlauf, prüft `tests/db/freigabezuordnung.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	zuordnungImVerlauf,
	zuordnungsmarke,
	zuordnungssatz
} from '$lib/domain/freigabezuordnung';
import { oeffneDurchgang } from '$lib/domain/abstimmung';

const E = { fassung: '2026-09', knotenId: 'k-einfach', titel: 'Einfaches Mehr' };

describe('zuordnungsmarke', () => {
	it('ändert sich mit dem Ausstand, nicht mit seiner Reihenfolge', () => {
		expect(zuordnungsmarke(E, null, ['b', 'a'])).toBe(zuordnungsmarke(E, null, ['a', 'b']));
		expect(zuordnungsmarke(E, null, ['a'])).not.toBe(zuordnungsmarke(E, null, ['a', 'b']));
	});

	it('ändert sich mit Mehrheit und Geschäftsart, auch bei gleichem Titel', () => {
		const m = zuordnungsmarke(E, 'verwaltung_gewoehnlich', []);
		expect(zuordnungsmarke({ ...E, knotenId: 'k-anders' }, 'verwaltung_gewoehnlich', [])).not.toBe(m);
		expect(zuordnungsmarke({ ...E, fassung: '2026-10' }, 'verwaltung_gewoehnlich', [])).not.toBe(m);
		expect(zuordnungsmarke(null, 'verwaltung_gewoehnlich', [])).not.toBe(m);
		expect(zuordnungsmarke(E, 'verwaltung_wichtig', [])).not.toBe(m);
	});
});

describe('zuordnungssatz', () => {
	it('nennt Geschäftsart, Ausstand und Anwesende über dem Knopf', () => {
		expect(
			zuordnungssatz(
				{
					geschaeftsart: 'verwaltung_gewoehnlich',
					erfordernis: 'Einfaches Mehr',
					imAusstand: ['A. Muster'],
					anwesend: 5,
					gesamt: 7
				},
				'Abstimmung freigeben'
			)
		).toBe(
			'Mit «Abstimmung freigeben» bestätigen Sie: Geschäftsart «Gewöhnliche ' +
				'Verwaltungshandlungen», nötige Mehrheit «Einfaches Mehr»; im Ausstand A. Muster; ' +
				'anwesend oder vertreten 5 von 7 Parteien.'
		);
		// Ohne Geschäftsart nur die Mehrheit, ohne leere Klammer.
		const ohne = zuordnungssatz(
			{ geschaeftsart: null, erfordernis: null, imAusstand: [], anwesend: 0, gesamt: 3 },
			'X'
		);
		expect(ohne).toContain('im Ausstand niemand');
		expect(ohne).toContain('bestätigen Sie: nötige Mehrheit keine festgelegt;');
	});
});

describe('oeffneDurchgang mit bestätigter Zuordnung', () => {
	const d = { id: 'r1', meetingId: 'm1', traktandumId: 't1', nummer: 1, eroeffnetAm: '2026-10-15T18:00:00Z' };

	it('schreibt die Bestätigung in den Verlauf, wenn sie vorliegt', () => {
		const z = {
			geschaeftsart: 'verwaltung_gewoehnlich' as const,
			erfordernis: 'Einfaches Mehr',
			imAusstand: [],
			anwesend: 4,
			gesamt: 6
		};
		const u = oeffneDurchgang(d, 'Budget', z);
		expect(u.ereignisse[0].angaben?.zuordnungBestaetigt).toEqual(zuordnungImVerlauf(z));
		expect(zuordnungImVerlauf(z).anwesend).toBe('4 von 6 Parteien');
	});

	it('schreibt keine, wenn sie fehlt', () => {
		const u = oeffneDurchgang(d, 'Budget');
		expect(u.ereignisse[0].angaben).not.toHaveProperty('zuordnungBestaetigt');
	});
});
