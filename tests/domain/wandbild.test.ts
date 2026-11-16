import { describe, expect, it } from 'vitest';
import {
	legeVersammlungAn,
	setzeWandbild,
	WANDBILDARTEN,
	type Versammlung
} from '../../src/lib/domain/versammlung';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';

const JETZT = '2026-05-19T18:42:00.000Z';

function versammlung(zustand: Versammlung['zustand'] = 'laufend'): Versammlung {
	const v = legeVersammlungAn('v-1', 'op-1', {
		stwegId: 'stweg-1',
		datum: '2026-05-19',
		uhrzeit: '19:00',
		ort: 'Halle der Proben, Nirgendheim',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	}).ergebnis;
	return { ...v, zustand };
}

describe('Das Wandbild', () => {
	it('kennt die drei Bilder für die stillen Zeiten', () => {
		expect(WANDBILDARTEN.map((w) => w.art)).toEqual(['traktanden', 'begruessung', 'frei']);
	});

	it('setzt Art, Wortlaut und Zeitpunkt', () => {
		const u = setzeWandbild(versammlung(), 'frei', 'Weiter um 20:15', JETZT);
		expect(u.ergebnis.wandbild).toEqual({
			art: 'frei',
			text: 'Weiter um 20:15',
			geaendertAm: JETZT
		});
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.wandbildGesetzt);
	});

	/**
	 * Sonst bliebe die Wand leer, und niemand im Saal wüsste, ob das Absicht ist
	 * oder ein Fehler.
	 */
	it('verlangt beim eigenen Text einen Wortlaut', () => {
		expect(() => setzeWandbild(versammlung(), 'frei', '   ', JETZT)).toThrow(FachlicherFehler);
		expect(() => setzeWandbild(versammlung(), 'frei', null, JETZT)).toThrow(/Wortlaut/);
	});

	it('schneidet Leerzeichen am Wortlaut ab', () => {
		const u = setzeWandbild(versammlung(), 'frei', '  Pause  ', JETZT);
		expect(u.ergebnis.wandbild?.text).toBe('Pause');
	});

	/**
	 * Ein Text an einer Art, die keinen kennt, stünde beim nächsten Wechsel auf
	 * «frei» unversehens wieder an der Wand.
	 */
	it('legt den Wortlaut ab, wo die Art keinen kennt', () => {
		const mitText = setzeWandbild(versammlung(), 'frei', 'Pause', JETZT).ergebnis;
		const zurueck = setzeWandbild(mitText, 'traktanden', 'Pause', JETZT);
		expect(zurueck.ergebnis.wandbild?.text).toBeNull();
	});

	/**
	 * Die Begrüssung gehört an die Wand, **bevor** die Versammlung beginnt — das
	 * ist ihr ganzer Zweck. Anders als das aufgerufene Traktandum, das erst ab
	 * der Eröffnung etwas zu bedeuten hat.
	 */
	it('lässt sich schon vor dem Eröffnen setzen', () => {
		const u = setzeWandbild(versammlung('freigegeben'), 'begruessung', null, JETZT);
		expect(u.ergebnis.wandbild?.art).toBe('begruessung');
	});

	it('geht im Entwurf und nach dem Schliessen nicht', () => {
		expect(() => setzeWandbild(versammlung('entwurf'), 'begruessung', null, JETZT)).toThrow(
			FachlicherFehler
		);
		expect(() => setzeWandbild(versammlung('geschlossen'), 'begruessung', null, JETZT)).toThrow(
			FachlicherFehler
		);
	});

	/** Was im Saal an der Wand stand, ist später eine Tatsache. */
	it('schreibt den Wortlaut in den Verlauf', () => {
		const u = setzeWandbild(versammlung(), 'frei', 'Weiter um 20:15', JETZT);
		expect(u.ereignisse[0].angaben).toMatchObject({
			vorher: 'traktanden',
			nachher: 'frei',
			text: 'Weiter um 20:15'
		});
	});
});
