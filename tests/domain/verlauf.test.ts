import { describe, expect, it } from 'vitest';
import { EREIGNISARTEN, beschriftung, ereignis, uebergang } from '$lib/domain/verlauf';

describe('Ereignisarten', () => {
	it('sind untereinander eindeutig', () => {
		const werte = Object.values(EREIGNISARTEN);
		// Zwei Namen auf dieselbe Art wären keine Fehlermeldung, sondern ein
		// Verlauf, in dem sich zwei verschiedene Vorgänge nicht mehr trennen lassen.
		expect(new Set(werte).size).toBe(werte.length);
	});

	it('folgen dem Muster gegenstand.verb', () => {
		for (const art of Object.values(EREIGNISARTEN)) {
			expect(art).toMatch(/^[a-z]+(\.[a-z]+)+$/);
		}
	});

	it('decken die Vorgänge aus Epic 1 ab', () => {
		// Fällt eine dieser Arten weg, entsteht eine Lücke im Verlauf, die erst
		// im Streitfall auffiele.
		expect(EREIGNISARTEN.anmeldung).toBe('user.login');
		expect(EREIGNISARTEN.abmeldung).toBe('user.logout');
		expect(EREIGNISARTEN.gemeinschaftAngelegt).toBe('stweg.created');
		expect(EREIGNISARTEN.einheitAngelegt).toBe('unit.created');
		expect(EREIGNISARTEN.eigentumZugeordnet).toBe('ownership.assigned');
		expect(EREIGNISARTEN.nutzniessungErfasst).toBe('usufruct.created');
	});
});

describe('ereignis', () => {
	it('nimmt den Gegenstand auf', () => {
		const e = ereignis(EREIGNISARTEN.einheitAngelegt, { art: 'unit', id: 'u1' }, { label: '3.OG' });
		expect(e).toEqual({
			art: 'unit.created',
			gegenstandArt: 'unit',
			gegenstandId: 'u1',
			angaben: { label: '3.OG' }
		});
	});

	it('kommt ohne Gegenstand und ohne Angaben aus', () => {
		const e = ereignis(EREIGNISARTEN.anmeldung);
		expect(e.art).toBe('user.login');
		expect(e.gegenstandArt).toBeUndefined();
	});

	it('setzt keinen Zeitstempel', () => {
		// Der Kern liest die Uhr nicht. Täte er es, wäre keine seiner Funktionen
		// mehr mit einer Wertetabelle prüfbar (AD-1).
		const e = ereignis(EREIGNISARTEN.anmeldung) as unknown as Record<string, unknown>;
		expect(Object.keys(e)).not.toContain('zeitpunkt');
		expect(JSON.stringify(e)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
	});
});

describe('beschriftung', () => {
	it('hat für jede bekannte Art eine verständliche Bezeichnung', () => {
		// Eine neue Art ohne Beschriftung erschiene im Verlauf als technische
		// Zeichenkette. Der Verlauf soll aber im Streitfall lesbar sein.
		for (const art of Object.values(EREIGNISARTEN)) {
			expect(beschriftung(art)).not.toBe(art);
			expect(beschriftung(art).length).toBeGreaterThan(3);
		}
	});

	it('reicht eine unbekannte Art unverändert durch', () => {
		// Die Rohbezeichnung sagt mehr als «Unbekannt».
		expect(beschriftung('etwas.neues')).toBe('etwas.neues');
	});
});

describe('uebergang', () => {
	it('reicht Ergebnis und Ereignisse getrennt weiter', () => {
		const u = uebergang({ id: 'x' }, ereignis(EREIGNISARTEN.gemeinschaftAngelegt));
		expect(u.ergebnis).toEqual({ id: 'x' });
		expect(u.ereignisse).toHaveLength(1);
	});

	it('erlaubt einen Übergang ohne Ereignis', () => {
		// Eine reine Abfrage ändert nichts und gehört deshalb nicht in den Verlauf.
		expect(uebergang('nur lesen').ereignisse).toEqual([]);
	});

	it('behält die Reihenfolge bei', () => {
		const u = uebergang(
			null,
			ereignis(EREIGNISARTEN.einheitAngelegt),
			ereignis(EREIGNISARTEN.eigentumZugeordnet)
		);
		expect(u.ereignisse.map((e) => e.art)).toEqual(['unit.created', 'ownership.assigned']);
	});
});
