import { describe, expect, it } from 'vitest';
import {
	einheitlicheWahl,
	ersterOffenerBlock,
	stimmbare,
	stimmstand
} from '$lib/domain/stimmblock';

/**
 * Die beiden Fälle, die auf der Telefonsicht falsch beantwortet waren
 * (Code-Review 08.09.2026 zu `82c00cf`). Beide Proben werden rot, wenn die
 * Regel wieder ohne den Sperrfilter beziehungsweise ohne den dritten Zustand
 * gerechnet wird.
 */
describe('Der Stand einer Partei', () => {
	it('unterscheidet offen, einheitlich und uneinheitlich', () => {
		expect(stimmstand({})).toBe('offen');
		expect(stimmstand({ a: 'yes', b: 'yes' })).toBe('einheitlich');
		expect(stimmstand({ a: 'yes', b: 'no' })).toBe('uneinheitlich');
	});

	/**
	 * **Uneinheitlich ist nicht offen.** Genau diese Gleichsetzung liess die
	 * Zeile «noch nicht gestimmt» sagen, während der Kasten darüber «2 von 2
	 * Stimmen erfasst» meldete.
	 */
	it('nennt bei uneinheitlicher Erfassung keine einzelne Wahl, zählt sie aber als erfasst', () => {
		const bisher = { a: 'yes', b: 'abstain' };
		expect(einheitlicheWahl(bisher)).toBeNull();
		expect(stimmstand(bisher)).not.toBe('offen');
	});
});

describe('Der erste offene Block', () => {
	it('ist die erste stimmbare Partei ohne Erfassung', () => {
		expect(
			ersterOffenerBlock([
				{ parteiId: 'eigen', bisher: { a: 'yes' } },
				{ parteiId: 'vollmacht', bisher: {} }
			])
		).toBe('vollmacht');
	});

	/**
	 * **Der Befund selbst.** Die eigene Partei steht immer zuerst und ist hier
	 * im Ausstand. Ohne den Sperrfilter kommt `eigen` heraus — und weil deren
	 * Block nur den Sperrsatz zeigt, stünde der Hinweis auf die Änderbarkeit
	 * dann auf keinem Block der Seite.
	 */
	it('übergeht eine gesperrte Partei, auch wenn sie zuerst steht', () => {
		expect(
			ersterOffenerBlock([
				{ parteiId: 'eigen', bisher: {}, gesperrt: 'Im Ausstand bei diesem Traktandum.' },
				{ parteiId: 'vollmacht', bisher: {} }
			])
		).toBe('vollmacht');
	});

	it('ist null, wenn alle stimmbaren Parteien erfasst sind', () => {
		expect(
			ersterOffenerBlock([
				{ parteiId: 'eigen', bisher: {}, gesperrt: 'Im Ausstand.' },
				{ parteiId: 'vollmacht', bisher: { a: 'no' } }
			])
		).toBeNull();
	});

	it('zählt eine gesperrte Partei auch nicht zu den stimmbaren', () => {
		expect(
			stimmbare([
				{ parteiId: 'eigen', bisher: {}, gesperrt: 'Im Ausstand.' },
				{ parteiId: 'vollmacht', bisher: {} }
			]).map((p) => p.parteiId)
		).toEqual(['vollmacht']);
	});
});
