import { describe, expect, it } from 'vitest';
import {
	folgeversammlung,
	MINDESTABSTAND_TAGE,
	pruefeZehntagesfrist
} from '$lib/domain/versammlung';

/**
 * Die zweite Versammlung, wenn die erste vertagt wird (ZGB Art. 712p Abs. 2).
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
 * durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
 * später.»
 */
const ERSTE = {
	id: 'm1',
	stwegId: 's1',
	datum: '2026-05-19',
	uhrzeit: '18:00',
	ort: 'Kirchgemeindehaus Nirgendheim',
	art: 'ordentlich' as const,
	anlass: null,
	betriebsart: 'gefuehrt' as const
};

describe('folgeversammlung', () => {
	it('setzt Stufe UND Vorgaengerin — beides, sonst rechnet das Quorum falsch', () => {
		// Der eigentliche Grund für diese Funktion: Wer von Hand anlegt, setzt das
		// Datum und vergisst die anderen zwei. Dann sieht die zweite Versammlung
		// aus wie eine erste, und die Anwendung verlangt ein Quorum, das ZGB 712p
		// Abs. 3 für sie gar nicht mehr verlangt.
		const f = folgeversammlung(ERSTE);
		expect(f.stufe).toBe('zweite');
		expect(f.vorgaengerId).toBe('m1');
		expect(f.vorgaengerDatum).toBe('2026-05-19');
	});

	/*
	 * **Elf, nicht zehn** (Befund R-1, 23.09.2026). Diese Probe stand auf dem
	 * 29. Mai und war grün, und genau daran sieht man die Fehlerklasse: Der
	 * Vorschlag war nicht bloss ungeprüft zu mild, er war der eine Tag, den
	 * Art. 712p Abs. 2 ausschliesst. Wer vertagte und den Vorschlag übernahm,
	 * landete ungefragt im Verstoss.
	 */
	it('schlaegt den fruehestmoeglichen Tag vor', () => {
		expect(folgeversammlung(ERSTE).datum).toBe('2026-05-30');
		expect(MINDESTABSTAND_TAGE).toBe(11);
	});

	/*
	 * **Diese Probe hat beim Schreiben zuerst nichts gemessen.** Sie lautete
	 * `pruefeZehntagesfrist(ERSTE.datum, folgeversammlung(ERSTE).datum)` und
	 * blieb in der Gegenprobe grün, als beide Rechnungen auf zehn Tage
	 * zurückgedreht wurden: Vorschlag und Prüfung lesen dieselbe Konstante und
	 * bewegen sich deshalb gemeinsam. Sie fing die Abweichung der beiden ab, aber
	 * nicht den Fall, dass beide zusammen falsch stehen, und genau der war R-1.
	 *
	 * Jetzt hängt sie an festen Daten statt an der Konstanten. Der 29. Mai ist
	 * der letzte unzulässige Tag nach einer Versammlung vom 19. Mai, der 30. der
	 * erste zulässige.
	 */
	it('schlaegt einen Tag vor, den die Fristpruefung auch annimmt', () => {
		const f = folgeversammlung(ERSTE);
		expect(pruefeZehntagesfrist(ERSTE.datum, f.datum).eingehalten).toBe(true);
		expect(pruefeZehntagesfrist('2026-05-19', '2026-05-30').eingehalten).toBe(true);
		expect(pruefeZehntagesfrist('2026-05-19', '2026-05-29').eingehalten).toBe(false);
	});

	it('rechnet ueber einen Monatswechsel richtig', () => {
		// Ein Datum ist kein String, den man addieren kann: Der 25. Mai plus elf
		// Tage ist der 5. Juni, nicht der 36. Mai.
		expect(folgeversammlung({ ...ERSTE, datum: '2026-05-25' }).datum).toBe('2026-06-05');
	});

	it('rechnet ueber einen Jahreswechsel und einen Schalttag richtig', () => {
		expect(folgeversammlung({ ...ERSTE, datum: '2026-12-28' }).datum).toBe('2027-01-08');
		expect(folgeversammlung({ ...ERSTE, datum: '2028-02-25' }).datum).toBe('2028-03-07');
	});

	it('uebernimmt Uhrzeit, Ort, Art und Betriebsart', () => {
		// Wer vertagt, plant meist dieselbe Stunde am selben Ort. Und die
		// Betriebsart gehoert mit: Sie ist eine Eigenschaft der Gemeinschaft,
		// nicht des Termins.
		const f = folgeversammlung(ERSTE);
		expect(f.uhrzeit).toBe('18:00');
		expect(f.ort).toBe('Kirchgemeindehaus Nirgendheim');
		expect(f.art).toBe('ordentlich');
		expect(f.betriebsart).toBe('gefuehrt');
	});

	it('nimmt den Anlass einer ausserordentlichen Versammlung mit', () => {
		// Ohne ihn scheiterte das Anlegen: Bei «ausserordentlich» ist er Pflicht.
		const f = folgeversammlung({
			...ERSTE,
			art: 'ausserordentlich',
			anlass: 'Dringliche Dachsanierung'
		});
		expect(f.anlass).toBe('Dringliche Dachsanierung');
	});

	it('laesst einen groesseren Abstand zu', () => {
		// Der fruehestmoegliche Tag ist selten der passende.
		expect(folgeversammlung(ERSTE, 21).datum).toBe('2026-06-09');
	});
});
