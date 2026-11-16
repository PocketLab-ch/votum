/**
 * Story 6.1 — die offenen Punkte der Übersicht (FR-64).
 *
 * Die Story nennt vier Punkte namentlich. Jeder hat hier seinen Test, und dazu
 * kommt der wichtigste: dass ein Punkt sagt, **was** fehlt und **wo** — nicht
 * bloss, dass etwas unvollständig ist.
 */
import { describe, expect, it } from 'vitest';
import { offenePunkte, type Uebersichtslage } from '$lib/domain/uebersicht';

function lage(u: Partial<Uebersichtslage> = {}): Uebersichtslage {
	return {
		quotensaldo: [],
		ohneZugaenge: [],
		ohneErfordernis: [],
		ohneAuswertung: [],
		zeitstempelOffen: [],
		...u
	};
}

describe('Offene Punkte', () => {
	it('meldet nichts, wenn nichts offen ist', () => {
		expect(offenePunkte(lage())).toEqual([]);
	});

	it('meldet den unausgeglichenen Wertquotensaldo als Hindernis', () => {
		const [p] = offenePunkte({
			...lage(),
			quotensaldo: [{ stwegId: 'g-1', name: 'Rosenweg 4', abweichung: 2 }]
		});
		expect(p.stufe).toBe('hindernis');
		expect(p.bezug).toBe('Rosenweg 4');
		expect(p.text).toContain('es fehlen 2');
		expect(p.pfad).toBe('/gemeinschaften/g-1/einheiten');
	});

	it('sagt beim Saldo auch, wenn zu viel erfasst ist', () => {
		const [p] = offenePunkte({
			...lage(),
			quotensaldo: [{ stwegId: 'g-1', name: 'Rosenweg 4', abweichung: -3 }]
		});
		expect(p.text).toContain('es sind 3 zu viel');
	});

	it('meldet die freigegebene Versammlung ohne Zugänge', () => {
		const [p] = offenePunkte({
			...lage(),
			ohneZugaenge: [{ meetingId: 'v-1', bezeichnung: 'Rosenweg 4, 2026-09-15' }]
		});
		expect(p.kennung).toBe('ohne_zugaenge');
		expect(p.stufe).toBe('aufgabe');
		expect(p.text).toContain('kann sich im Saal niemand anmelden');
		expect(p.pfad).toBe('/versammlungen/v-1/zugaenge');
	});

	it('meldet Anträge ohne Mehrheitserfordernis und zählt sie', () => {
		const [p] = offenePunkte({
			...lage(),
			ohneErfordernis: [{ meetingId: 'v-1', bezeichnung: 'Rosenweg 4', anzahl: 3 }]
		});
		expect(p.text).toContain('3 Anträge haben');
		expect(p.pfad).toBe('/versammlungen/v-1/traktanden');
	});

	it('setzt beim einzelnen Antrag die Einzahl', () => {
		const [p] = offenePunkte({
			...lage(),
			ohneErfordernis: [{ meetingId: 'v-1', bezeichnung: 'Rosenweg 4', anzahl: 1 }]
		});
		expect(p.text).toContain('Ein Antrag hat');
	});

	it('meldet die geschlossene Versammlung ohne Auswertung', () => {
		const [p] = offenePunkte({
			...lage(),
			ohneAuswertung: [{ meetingId: 'v-1', bezeichnung: 'Rosenweg 4, 2026-09-15' }]
		});
		expect(p.kennung).toBe('ohne_auswertung');
		expect(p.pfad).toBe('/versammlungen/v-1/auswertung');
	});

	it('stellt Hindernisse vor die Aufgaben', () => {
		// Ein Hindernis steht für etwas, das gerade falsch läuft; eine Aufgabe für
		// etwas, das noch aussteht. Gleich dargestellt verbrauchten sie dieselbe
		// Aufmerksamkeit.
		const punkte = offenePunkte({
			...lage(),
			ohneZugaenge: [{ meetingId: 'v-1', bezeichnung: 'A' }],
			quotensaldo: [{ stwegId: 'g-1', name: 'B', abweichung: 1 }],
			ohneAuswertung: [{ meetingId: 'v-2', bezeichnung: 'C' }]
		});
		expect(punkte[0].stufe).toBe('hindernis');
		expect(punkte.slice(1).every((p) => p.stufe === 'aufgabe')).toBe(true);
	});

	it('nennt bei jedem Punkt den Bezug und einen Weg', () => {
		// Der ganze Zweck der Übersicht: nicht suchen müssen.
		const punkte = offenePunkte({
			quotensaldo: [{ stwegId: 'g-1', name: 'B', abweichung: 1 }],
			ohneZugaenge: [{ meetingId: 'v-1', bezeichnung: 'A' }],
			ohneErfordernis: [{ meetingId: 'v-2', bezeichnung: 'C', anzahl: 2 }],
			ohneAuswertung: [{ meetingId: 'v-3', bezeichnung: 'D' }],
			zeitstempelOffen: [{ meetingId: 'v-4', bezeichnung: 'E' }]
		});
		expect(punkte).toHaveLength(5);
		for (const p of punkte) {
			expect(p.bezug.length).toBeGreaterThan(0);
			expect(p.pfad.startsWith('/')).toBe(true);
			expect(p.text.length).toBeGreaterThan(20);
		}
	});

	it('meldet den ausstehenden Zeitstempel — sonst merkt ihn niemand', () => {
		// Nach dem Abschluss ruft die Siegelseite niemand mehr auf. Stünde die
		// Lücke nur dort, bliebe sie für immer offen.
		const [p] = offenePunkte({
			...lage(),
			zeitstempelOffen: [{ meetingId: 'v-9', bezeichnung: 'Nirgendwerk, 19. Mai 2026' }]
		});
		expect(p.kennung).toBe('zeitstempel_offen');
		expect(p.stufe).toBe('aufgabe');
		// Und nicht als Fehler: Das Siegel gilt auch ohne Bezeugung.
		expect(p.text).toMatch(/gilt auch so/);
		expect(p.pfad).toBe('/versammlungen/v-9/siegel');
	});
});
