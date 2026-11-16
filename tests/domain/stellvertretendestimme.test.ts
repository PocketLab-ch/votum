import { describe, expect, it } from 'vitest';
import { pruefeStellvertretendeStimme } from '../../src/lib/domain/abstimmung';

/**
 * **Der Anlass, am 20.08.2026.** Gemeldet als Loch: «dass der Sitzungsleiter für
 * einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein. Bspw.
 * Telefon ist gerade ausgefallen.»
 */
describe('Wenn die Sitzungsleitung für eine Partei stimmt', () => {
	it('verlangt in der geführten Betriebsart einen Grund', () => {
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'gefuehrt', begruendung: null })
		).toThrow(/Grund/);
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'gefuehrt', begruendung: '   ' })
		).toThrow(/Grund/);
	});

	it('weist einen Grund ab, der nur so aussieht', () => {
		// «ok» ist kein Grund. Die Schranke ist dieselbe wie bei der
		// Neuabstimmung — was im Protokoll steht, muss etwas aussagen.
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'gefuehrt', begruendung: 'ok' })
		).toThrow(/Zeichen/);
	});

	it('nimmt einen tragfähigen Grund an und gibt ihn bereinigt zurück', () => {
		expect(
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				begruendung: '  Telefon ausgefallen, mündlich abgegeben  '
			})
		).toBe('Telefon ausgefallen, mündlich abgegeben');
	});

	it('verlangt in der einfachen Betriebsart keinen — dort ist sie selbst der Grund', () => {
		// Dort erfasst die Sitzungsleitung ALLE Stimmen, weil im Saal von Hand
		// abgestimmt wird. Je Partei denselben Satz zu verlangen, erzeugte
		// vierzehn Pflichtfelder und keine einzige Auskunft.
		expect(pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: null })).toBeNull();
		expect(pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: '' })).toBeNull();
	});

	it('prüft aber auch dort, was dasteht', () => {
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: 'hm' })
		).toThrow(/Zeichen/);
	});
});

/**
 * **Der Nachtrag vom 25.08.2026.** Bis dahin verlangte die Erfassung EINER
 * Partei in jeder Betriebsart einen Grund — auch auf Papier, wo die
 * Sitzungsleitung ohnehin alle Stimmen einträgt. Der Auftraggeber: «ich vermute dass die
 * Sitzung mit Handzählen ist und darum kein Kommentar beim Stimmen durch den
 * Sitzungsleiter braucht. Wenn dem so ist, müsste das Mecano angepasst
 * werden.»
 */
describe('einfache Betriebsart: der Grund ist freiwillig, auch fuer eine Partei', () => {
	it('nimmt eine einzelne Stimme ohne Grund an', () => {
		expect(
			pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: null })
		).toBeNull();
		expect(
			pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: '   ' })
		).toBeNull();
	});

	it('prueft trotzdem, was dasteht — Halbes taugt nicht', () => {
		// Freiwillig heisst nicht beliebig: Ein «ok» im Protokoll ist schlechter
		// als gar nichts, weil es wie eine Auskunft aussieht.
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'einfach', begruendung: 'ok' })
		).toThrow();
	});

	/**
	 * **Der dritte Fall: eine einzelne Partei stimmt auf Papier** (Migration
	 * 107). Die Betriebsart bleibt «gefuehrt», weil elf von vierzehn Parteien
	 * digital abstimmen; für die drei anderen ist die Erfassung durch die
	 * Sitzungsleitung das vereinbarte Verfahren und kein Eingriff.
	 *
	 * Die Probe misst BEIDE Richtungen. Ohne den zweiten Teil wäre sie auch dann
	 * grün, wenn `aufPapier` die Pflicht für alle aufhöbe — und genau das wäre
	 * der teure Fehler: Die Begründung verschwände für die elf, für die sie
	 * gemacht ist.
	 */
	it('erlässt die Begründung für eine Partei auf Papier, aber nur für sie', () => {
		expect(
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				aufPapier: true,
				begruendung: null
			})
		).toBeNull();

		// Dieselbe Versammlung, eine Partei ohne Vermerk: unverändert Pflicht.
		expect(() =>
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				aufPapier: false,
				begruendung: null
			})
		).toThrow();

		// Und ohne Angabe bleibt es bei der strengeren Lesart.
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'gefuehrt', begruendung: null })
		).toThrow();
	});

	it('prüft auch beim Papierfall, was dasteht', () => {
		// Erlaubt heisst nicht beliebig — dieselbe Regel wie in «einfach».
		expect(() =>
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				aufPapier: true,
				begruendung: 'ok'
			})
		).toThrow();
		expect(
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				aufPapier: true,
				begruendung: 'Stimmzettel Nr. 7, im Saal ausgefüllt'
			})
		).toContain('Stimmzettel');
	});

	it('laesst die gefuehrte Betriebsart unberuehrt', () => {
		// Der Fall, für den die Pflicht gemacht ist: Dort stimmen die Eigentümer
		// selbst, und wer für sie einträgt, greift ein.
		expect(() =>
			pruefeStellvertretendeStimme({ betriebsart: 'gefuehrt', begruendung: null })
		).toThrow();
		expect(
			pruefeStellvertretendeStimme({
				betriebsart: 'gefuehrt',
				begruendung: 'Telefon ausgefallen, im Saal mündlich abgegeben'
			})
		).toContain('Telefon');
	});
});
