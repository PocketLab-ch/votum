import { describe, expect, it } from 'vitest';
import { abendsiegelsatz, type Hausversiegelung } from '$lib/domain/beschlussfaehigkeit';

/**
 * Der Satz nach dem Versiegeln am gemeinsamen Abend.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Warum kann nicht auf der Stufe Gruppe
 * versiegelt werden? Die Gruppe ist doch fest und bleibt es.» Ein gemeinsames
 * Siegel geht nicht — acht der neun Bestandteile eines Abschlusspakets gibt es
 * nur je Gemeinschaft. Was der Abend abnimmt, ist das fünfmalige Klicken.
 */
function haus(name: string, bezeugt: boolean): Hausversiegelung {
	return { gemeinschaft: name, siegelkopf: 'a1b2c3d4e5f60718', zeitstempel: bezeugt };
}

describe('abendsiegelsatz', () => {
	it('nennt bei einem einzigen Haus den Siegelkopf', () => {
		// Bei einem Haus ist der Kopf die Auskunft; bei fünf wäre er Rauschen.
		expect(abendsiegelsatz([haus('STWEG Nirgendweg 11', true)])).toBe(
			'STWEG Nirgendweg 11 ist versiegelt (a1b2c3d4e5f60718…). Die Zeitstempel liegen vor.'
		);
	});

	it('fasst den Regelfall kurz', () => {
		const satz = abendsiegelsatz(['A', 'B', 'C'].map((n) => haus(n, true)));
		expect(satz).toBe('3 Gemeinschaften sind versiegelt. Die Zeitstempel liegen vor.');
	});

	it('nennt die Haeuser ohne Zeitstempel — und sagt, dass das Siegel trotzdem gilt', () => {
		// Der Fall ohne Netz: Das Siegel steht, die Bezeugung fehlt. Wer das erst
		// beim einzelnen Nachsehen bemerkt, bemerkt es zu spät.
		const satz = abendsiegelsatz([haus('A', true), haus('B', false), haus('C', false)]);
		expect(satz).toContain('Der Zeitstempel steht noch aus bei: B, C.');
		expect(satz).toContain('Das Siegel gilt auch ohne ihn');
	});

	it('sagt bei leerer Liste nichts Falsches', () => {
		expect(abendsiegelsatz([])).toBe('Nichts versiegelt.');
	});
});
