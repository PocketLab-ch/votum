import { describe, expect, it } from 'vitest';
import {
	FESTE_TRAKTANDEN,
	JAHRESGESCHAEFTE,
	ordneVorlagen,
	stelltBeschlussfaehigkeitFest
} from '$lib/domain/traktandenvorlage';

describe('stelltBeschlussfaehigkeitFest', () => {
	it('erkennt das Pflichttraktandum aus der Vorlage', () => {
		const vorlage = FESTE_TRAKTANDEN.find((t) => t.rechnet === 'beschlussfaehigkeit')!;
		expect(stelltBeschlussfaehigkeitFest(vorlage.titel)).toBe(true);
	});

	it('erkennt auch einen erweiterten Titel', () => {
		expect(
			stelltBeschlussfaehigkeitFest(
				'Feststellung der Beschlussfähigkeit und Wahl des Protokollführers'
			)
		).toBe(true);
	});

	it('lässt andere Traktanden in Ruhe', () => {
		expect(stelltBeschlussfaehigkeitFest('Jahresrechnung')).toBe(false);
		expect(stelltBeschlussfaehigkeitFest('Wahl der Stimmenzähler')).toBe(false);
	});
});

/**
 * Die Merge-Regel der gespeicherten Traktandenordnung (Block C2, 31.08.2026).
 *
 * Gespeicherte Reihenfolge gilt, neue Code-Vorlagen folgen am Schluss, tote
 * Schlüssel werden ignoriert. Ohne gespeicherte Ordnung gilt die
 * Code-Reihenfolge unverändert.
 */
describe('ordneVorlagen', () => {
	const alle = [...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE];

	it('gibt die Code-Reihenfolge zurück, wenn nichts gespeichert ist', () => {
		expect(ordneVorlagen(alle, null)).toEqual(alle);
		expect(ordneVorlagen(alle, [])).toEqual(alle);
	});

	it('sortiert nach der gespeicherten Reihenfolge', () => {
		const gespeichert = [...alle.map((v) => v.schluessel)].reverse();
		const geordnet = ordneVorlagen(alle, gespeichert);
		expect(geordnet.map((v) => v.schluessel)).toEqual(gespeichert);
	});

	it('stellt eine neue Vorlage ans Ende, die die Ordnung nicht kennt', () => {
		// Simuliert ein Code-Update: die Ordnung kennt nur die ersten drei.
		const gespeichert = ['stimmenzaehler', 'begruessung', 'protokoll'];
		const ohneBudget = alle.filter((v) => v.schluessel !== 'budget');
		const geordnet = ordneVorlagen(ohneBudget, gespeichert);
		// Die drei genannten zuerst, in ihrer Reihenfolge …
		expect(geordnet.slice(0, 3).map((v) => v.schluessel)).toEqual(gespeichert);
		// … der Rest in Code-Reihenfolge dahinter.
		expect(geordnet.slice(3).map((v) => v.schluessel)).toEqual(
			ohneBudget
				.filter((v) => !gespeichert.includes(v.schluessel))
				.map((v) => v.schluessel)
		);
	});

	it('ignoriert Schlüssel, die es nicht mehr gibt', () => {
		const geordnet = ordneVorlagen(alle, ['gibtsnicht', 'begruessung']);
		expect(geordnet[0]?.schluessel).toBe('begruessung');
		expect(geordnet).toHaveLength(alle.length);
	});

	it('verliert keine Vorlage und verdoppelt keine', () => {
		const geordnet = ordneVorlagen(alle, alle.map((v) => v.schluessel).reverse());
		expect(geordnet).toHaveLength(alle.length);
		expect(new Set(geordnet.map((v) => v.schluessel)).size).toBe(alle.length);
	});

	it('ein doppelter Schlüssel in der Ordnung verdoppelt nichts', () => {
		const geordnet = ordneVorlagen(alle, ['budget', 'budget', 'decharge']);
		expect(geordnet.filter((v) => v.schluessel === 'budget')).toHaveLength(1);
		expect(geordnet[0]?.schluessel).toBe('budget');
		expect(geordnet[1]?.schluessel).toBe('decharge');
	});
});

describe('Die Reihenfolge der Jahresgeschäfte', () => {
	/**
	 * **Der Ablauf baut aufeinander auf** (Auftraggeber, 01.09.2026): «In der Logik kommt
	 * zuerst der Bericht Revisoren und dann wird die Jahresrechnung freigegeben.
	 * Danach die Décharge der Verwaltung.»
	 *
	 * Bis dahin stand die Jahresrechnung VOR dem Revisionsbericht und die
	 * Décharge ganz am Schluss. Wer die Vorlage unverändert übernahm, stimmte
	 * über die Rechnung ab, bevor der Bericht dazu verlesen war.
	 *
	 * Geprüft wird die Reihenfolge und nicht bloss das Vorkommen: Genau das war
	 * der Fehler, und eine Liste lässt sich beim nächsten Anfassen unbemerkt
	 * umsortieren.
	 */
	it('legt Revisionsbericht vor Jahresrechnung vor Décharge', () => {
		const stelle = (s: string) => JAHRESGESCHAEFTE.findIndex((v) => v.schluessel === s);
		expect(stelle('revision')).toBeGreaterThanOrEqual(0);
		expect(stelle('revision')).toBeLessThan(stelle('jahresrechnung'));
		expect(stelle('jahresrechnung')).toBeLessThan(stelle('decharge'));
	});

	it('stellt die vorausschauenden Punkte hinter die Décharge', () => {
		const stelle = (s: string) => JAHRESGESCHAEFTE.findIndex((v) => v.schluessel === s);
		expect(stelle('decharge')).toBeLessThan(stelle('budget'));
		expect(stelle('decharge')).toBeLessThan(stelle('erneuerungsfonds'));
	});

	it('beginnt mit der Genehmigung des letzten Protokolls', () => {
		expect(JAHRESGESCHAEFTE[0]?.schluessel).toBe('protokoll');
	});
});
