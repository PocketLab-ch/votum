/**
 * Was am aufgerufenen Traktandum jetzt möglich ist.
 *
 * Der Prüfstein ist nicht die Liste selbst, sondern **wann sie schrumpft**: Ein
 * Eingriff, den die Zeile anbietet und den der Server danach verweigert, ist
 * schlimmer als gar keine Zeile — im Saal, vor vierzehn Wartenden.
 */
import { describe, expect, it } from 'vitest';
import { eingriffssatz, moeglicheEingriffe, type Traktandumslage } from '$lib/domain/eingriffe';

function lage(u: Partial<Traktandumslage> = {}): Traktandumslage {
	return {
		art: 'abstimmung',
		abgestimmt: false,
		durchgangOffen: false,
		zurueckgezogen: false,
		rueckkommenLaeuft: false,
		hatErfordernis: true,
		...u
	};
}

const arten = (l: Traktandumslage) => moeglicheEingriffe(l).map((e) => e.art);

describe('Vor der Abstimmung', () => {
	it('bietet alle fünf Eingriffe an', () => {
		expect(arten(lage())).toEqual([
			'ausstand',
			'betroffene',
			'gegenantrag',
			'zurueckziehen',
			'mehrheit'
		]);
	});

	it('lässt die Mehrheit weg, wo noch keine festgehalten ist', () => {
		// Dort steht in der Zeile schon «Erfordernis setzen» als Warnung — ein
		// zweiter Weg zur selben Sache wäre keine Hilfe, sondern eine Frage.
		expect(arten(lage({ hatErfordernis: false }))).not.toContain('mehrheit');
	});

	it('bietet «Betroffene» immer an, auch wo das Erfordernis keine kennt', () => {
		/*
		 * Block A2: Seit Betroffene sich im Saal eintragen lassen, braucht die
		 * Sperre beim Eröffnen einen Weg, und der steht hier.
		 *
		 * **Und seit dem 03.10.2026 immer** (Auftrag): Beim von Hand gesetzten
		 * Mehr kennt das Erfordernis keine Betroffenen; der Eintrag fiel
		 * deshalb weg, und die Leitung fand den Weg nicht, wenn sich in der
		 * Diskussion eine betroffene Person zeigte. Jetzt steht er immer;
		 * kennt das Erfordernis keine, zeigt die Zeile statt der Eingabe den
		 * Weg über «Nötige Mehrheit ändern». Das Feld `kenntBetroffene` der
		 * Lage gibt es deshalb nicht mehr (Codeprüfung 04.10.2026, N3): Der
		 * Eingriff hing nie an ihm.
		 */
		expect(arten(lage())).toContain('betroffene');
		// Und nicht im laufenden Durchgang, dieselbe Grenze wie am Server.
		expect(arten(lage({ durchgangOffen: true }))).toEqual([]);
		expect(arten(lage({ abgestimmt: true }))).not.toContain('betroffene');
	});

	it('kennt kein Rückkommen, solange nicht abgestimmt ist', () => {
		// Es gäbe nichts, worauf zurückzukommen wäre.
		expect(arten(lage())).not.toContain('rueckkommen');
	});
});

describe('Während der Abstimmung', () => {
	it('bietet gar nichts an', () => {
		/*
		 * **Der wichtigste Fall.** Ein Ausstand jetzt verschöbe die Bezugsgrösse
		 * unter den bereits abgegebenen Stimmen weg; ein Rückzug nähme den Antrag
		 * unter den Stimmenden weg. Der Server weist beides ab — die Zeile darf es
		 * also gar nicht erst anbieten.
		 */
		expect(arten(lage({ durchgangOffen: true }))).toEqual([]);
	});

	it('nennt den Weg, statt bloss leer zu sein', () => {
		const l = lage({ durchgangOffen: true });
		expect(eingriffssatz(l, 0)).toMatch(/schliessen Sie sie zuerst/);
	});
});

describe('Nach der Abstimmung', () => {
	it('bietet nur noch das Rückkommen an', () => {
		// Zurückziehen geht nicht mehr: Das Ergebnis gehört der Versammlung. Und
		// die Mehrheit steht fest — sonst stünde am Traktandum eine andere Regel
		// als die, nach der gezählt wurde.
		expect(arten(lage({ abgestimmt: true }))).toEqual(['rueckkommen']);
	});

	it('bietet kein zweites Rückkommen an, solange das erste offen ist', () => {
		expect(arten(lage({ abgestimmt: true, rueckkommenLaeuft: true }))).toEqual([]);
		expect(eingriffssatz(lage({ abgestimmt: true, rueckkommenLaeuft: true }), 0)).toMatch(
			/bereits ein Rückkommensantrag/
		);
	});
});

describe('Sonderlagen', () => {
	it('bietet bei einer Kenntnisnahme nichts an — und sagt warum', () => {
		// Dort wird nicht abgestimmt, also gibt es kein Stimmrecht, von dem jemand
		// auszuschliessen wäre, und keinen Antrag zum Zurückziehen.
		const l = lage({ art: 'kenntnisnahme' });
		expect(arten(l)).toEqual([]);
		expect(eingriffssatz(l, 0)).toMatch(/zur Kenntnis genommen/);
	});

	it('bietet an einem zurückgezogenen Antrag nichts mehr an', () => {
		const l = lage({ zurueckgezogen: true });
		expect(arten(l)).toEqual([]);
		expect(eingriffssatz(l, 0)).toMatch(/zurückgezogen/);
	});
});

describe('Die Wörter', () => {
	it('beschriftet die Zeile ohne Fachbegriffe', () => {
		/*
		 * **Der Punkt der ganzen Übung.** «Folgeantrag» und «Rückkommen» sagen nur
		 * denen etwas, die sie schon kennen; die anderen lesen darüber hinweg. Der
		 * Fachbegriff steht in Klammern hinter der Überschrift, nicht in der Zeile
		 * (docs/gestaltung.md, Regel 3).
		 */
		const woerter = moeglicheEingriffe(lage()).map((e) => e.wort);
		expect(woerter).toContain('Gegenantrag');
		expect(woerter).not.toContain('Folgeantrag');

		const nach = moeglicheEingriffe(lage({ abgestimmt: true }));
		expect(nach[0].wort).toBe('Nochmals abstimmen');
		expect(nach[0].fachwort).toBe('Rückkommen');
	});

	it('gibt jedem Eingriff eine ganze Aussage als Überschrift und einen Satz dazu', () => {
		// Eine Überschrift, die nur den Gegenstand nennt, verlangt Vorwissen: «Was
		// bewirkt das?» ist im Saal die Frage, nicht «wie heisst es?».
		for (const e of moeglicheEingriffe(lage())) {
			expect(e.titel.length).toBeGreaterThan(15);
			expect(e.satz.length).toBeGreaterThan(40);
		}
	});
});

/*
 * **Kein Gegenantrag an einem Spontantraktandum** (Codeprüfung 29.09.2026).
 * Seit ein neues Geschäft mit der Ausnahme des Reglements zur Abstimmung darf,
 * steht dort ein offener Antrag. Ein Gegenantrag dazu wäre ein Folgeantrag ohne
 * angekündigten Grundantrag, und den weist der Server ab.
 */
describe('Am Spontantraktandum', () => {
	it('bietet keinen Gegenantrag an, den der Server abwiese', () => {
		expect(arten(lage({ spontan: true }))).not.toContain('gegenantrag');
		expect(arten(lage({ spontan: false }))).toContain('gegenantrag');
	});
});
