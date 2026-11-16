import { describe, expect, it } from 'vitest';
import {
	abgeschlossen,
	aendereVersammlung,
	betriebsartVorschlag,
	istImEntwurf,
	legeVersammlungAn,
	FRISTLAUF,
	fristvermerk,
	FRIST_KURZ,
	FRIST_TAGE,
	fristAmAbend,
	fristKurz,
	fristlaufSatz,
	fruehesterZweitTermin,
	geltendeZweitfrist,
	ZWEITFRIST_HOECHSTENS_TAGE,
	pruefeZweitversammlungsfrist,
	MINDESTABSTAND_TAGE,
	pruefeVersammlung,
	pruefeZehntagesfrist,
	rechnetAufMomentaufnahme,
	SCHWELLE_GEFUEHRT,
	tageZwischen,
	verlangeZustand,
	wechsleBetriebsart,
	zustandsname,
	ZUSTANDSNAMEN,
	type Versammlung,
	type VersammlungEingabe,
	type Versammlungszustand
} from '../../src/lib/domain/versammlung';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';

function eingabe(ueberschreibung: Partial<VersammlungEingabe> = {}): VersammlungEingabe {
	return {
		stwegId: 'stweg-1',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären, Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt',
		...ueberschreibung
	};
}

function angelegt(ueberschreibung: Partial<VersammlungEingabe> = {}): Versammlung {
	return legeVersammlungAn('v-1', 'op-1', eingabe(ueberschreibung)).ergebnis;
}

describe('Angaben der Versammlung', () => {
	it('nimmt eine vollständige Erfassung an und stellt sie in den Entwurf', () => {
		const u = legeVersammlungAn('v-1', 'op-1', eingabe());
		expect(u.ergebnis.zustand).toBe('entwurf');
		expect(u.ergebnis.ort).toBe('Restaurant Bären, Saal');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.versammlungAngelegt);
	});

	it('verlangt ein Datum', () => {
		expect(() => pruefeVersammlung(eingabe({ datum: '15.09.2026' }))).toThrow(FachlicherFehler);
	});

	it('verlangt eine gültige Uhrzeit', () => {
		expect(() => pruefeVersammlung(eingabe({ uhrzeit: '25:00' }))).toThrow(/Uhrzeit/);
		expect(() => pruefeVersammlung(eingabe({ uhrzeit: '19 Uhr' }))).toThrow(/Uhrzeit/);
	});

	it('verlangt einen Ort, weil er in die Einladung gehört', () => {
		expect(() => pruefeVersammlung(eingabe({ ort: ' ' }))).toThrow(/Versammlungsort/);
	});

	it('schneidet Leerzeichen am Ort ab', () => {
		expect(pruefeVersammlung(eingabe({ ort: '  Saal  ' })).ort).toBe('Saal');
	});
});

describe('Ordentlich und ausserordentlich', () => {
	it('verlangt bei der ausserordentlichen Versammlung den Anlass', () => {
		expect(() => pruefeVersammlung(eingabe({ art: 'ausserordentlich' }))).toThrow(/Anlass/);
	});

	it('nimmt die ausserordentliche Versammlung mit Anlass an', () => {
		const g = pruefeVersammlung(
			eingabe({ art: 'ausserordentlich', anlass: 'Wasserschaden Tiefgarage' })
		);
		expect(g.anlass).toBe('Wasserschaden Tiefgarage');
	});

	it('verwirft einen Anlass bei der ordentlichen Versammlung, statt ihn mitzuschleppen', () => {
		// Er hätte dort keine Bedeutung und erschiene doch in der Einladung.
		const g = pruefeVersammlung(eingabe({ art: 'ordentlich', anlass: 'irrtümlich erfasst' }));
		expect(g.anlass).toBeUndefined();
	});

	it('weist eine unbekannte Art ab', () => {
		expect(() =>
			pruefeVersammlung(eingabe({ art: 'jährlich' as never }))
		).toThrow(/Art der Versammlung/);
	});
});

describe('Zehntagesfrist nach ZGB Art. 712p Abs. 2', () => {
	it('zählt Tage über Monatsgrenzen', () => {
		expect(tageZwischen('2026-01-28', '2026-02-07')).toBe(10);
		expect(tageZwischen('2026-02-27', '2026-03-01')).toBe(2); // 2026 ist kein Schaltjahr
		expect(tageZwischen('2024-02-27', '2024-03-01')).toBe(3); // 2024 schon
	});

	it('zählt über die Sommerzeitumstellung richtig', () => {
		// Die Nacht auf den 29. März 2026 hat 23 Stunden. Wer mit lokalen
		// Zeitstempeln rechnet, bekommt hier 9,96 Tage und rundet auf 9 ab —
		// und weist damit eine fristgerechte Versammlung als verfrüht zurück.
		expect(tageZwischen('2026-03-25', '2026-04-04')).toBe(10);
		expect(pruefeZehntagesfrist('2026-03-25', '2026-04-05').eingehalten).toBe(true);
	});

	/*
	 * **Befund R-1 vom 23.09.2026.** Hier stand vorher die Probe «hält genau zehn
	 * Tage für eingehalten», und sie war grün: Die Prüfung liess einen Abstand
	 * von zehn Tagen durch. Art. 712p Abs. 2 lässt die zweite Versammlung «nicht
	 * vor Ablauf von zehn Tagen» stattfinden, und nach Rz. 41 ad Art. 712p
	 * beginnt die Frist erst am Tag nach der ersten Versammlung. Erste am
	 * 1. September, Frist vom 2. bis zum 11., erster zulässiger Termin der 12.
	 *
	 * Die Richtung war die unangenehme: Das Werkzeug erlaubte, was das Gesetz
	 * nicht erlaubt. Deshalb stehen beide Tage hier, der letzte unzulässige und
	 * der erste zulässige.
	 */
	it('weist genau zehn Tage Abstand zurück', () => {
		const b = pruefeZehntagesfrist('2026-09-01', '2026-09-11');
		expect(b.eingehalten).toBe(false);
		expect(b.abstandTage).toBe(FRIST_TAGE);
	});

	it('hält elf Tage Abstand für eingehalten', () => {
		const b = pruefeZehntagesfrist('2026-09-01', '2026-09-12');
		expect(b.eingehalten).toBe(true);
		expect(b.abstandTage).toBe(MINDESTABSTAND_TAGE);
	});

	/*
	 * **Was diese Probe festhält, ist ein Entscheid, keine Formulierung**
	 * (Auftraggeber, 23.09.2026, nach Befund 2 der Fachprüfung).
	 *
	 * Hier stand bis zum 23.09.2026 «anfechtbar» allein, und R-2 hielt das für
	 * zu mild. Der Ersatz «vermag keine rechtsgültigen Beschlüsse zu fassen»
	 * war zu streng: Rz. 39 ad Art. 712p sagt diesen Satz zwar, entscheidet
	 * damit aber nicht zwischen Nichtigkeit und Anfechtbarkeit. Für die
	 * Verletzung von Abs. 1 benutzt derselbe Autor in Rz. 30 fast dieselbe
	 * Wendung und löst sie in Rz. 31 mit «Im Zweifelsfall anfechtbar» auf.
	 *
	 * Die Meldung nennt deshalb die **Handlung** statt der Einordnung. Wer die
	 * Frist wahrt, steht in beiden Lesarten richtig. Die strenge Fassung allein
	 * lud zum Nichtstun ein und liess die Monatsfrist ablaufen.
	 */
	it('meldet neun Tage als Verstoss und nennt Folge und Frist', () => {
		const b = pruefeZehntagesfrist('2026-09-01', '2026-09-10');
		expect(b.eingehalten).toBe(false);
		expect(b.hinweis).toMatch(/712p/);
		expect(b.hinweis).toMatch(/darf keine Beschlüsse fassen/);
		expect(b.hinweis).toMatch(/beim Gericht anfechten/);
		expect(b.hinweis).toMatch(/Art\. 75/);
		// Befund 3 der Fachprüfung: Ein Reglement darf eine längere Frist
		// vorsehen (Rz. 40). Ohne «gesetzlich» verspricht die Meldung eine
		// Zulässigkeit, die nur das Gesetz deckt.
		expect(b.hinweis).toMatch(/gesetzliche Frist/);
	});

	/*
	 * **Der Wächter über die ausgeschriebenen Zahlwörter.**
	 *
	 * `FRISTLAUF` und `FRIST_KURZ` schreiben «zehn» und «elften» aus, weil die
	 * Laienprüfung vom 23.09.2026 die Zahlenkette «9, 10, 11» als den Grund
	 * benannt hat, aus dem die Meldung wie ein Rechenfehler der Anwendung
	 * aussieht. Ausgeschriebene Wörter neben einer Konstanten sind aber genau
	 * die Bauweise, aus der R-1 entstanden ist: zwei Schreiber derselben Zahl.
	 * Deshalb hält diese Probe beide gegeneinander. Wer die Frist ändert, muss
	 * hier vorbei.
	 */
	it('hält die ausgeschriebenen Zahlwörter an den Konstanten', () => {
		const worte: Record<number, string> = {
			9: 'neun',
			10: 'zehn',
			11: 'elf'
		};
		expect(FRISTLAUF).toMatch(new RegExp(`${worte[FRIST_TAGE]} Tagen`));
		expect(FRIST_KURZ).toMatch(new RegExp(`${worte[MINDESTABSTAND_TAGE]}ten Tag`));
		// Der dritte Schreiber, den dieser Wächter zuerst ausliess (Code-Review
		// vom 23.09.2026, Befund 4): Der Satz im Erfolgsfall schreibt «zehn
		// Tagen» ein weiteres Mal von Hand und stand damit ausserhalb der
		// Zusicherung, die der Kommentar oben verspricht.
		expect(pruefeZehntagesfrist('2026-09-01', '2026-09-12').hinweis).toMatch(
			new RegExp(`${worte[FRIST_TAGE]} Tagen`)
		);
	});

	it('nennt das früheste zulässige Datum statt einer Tageszahl', () => {
		// Laienprüfung L-1 und L-3: Bei genau zehn Tagen stand die Zahl 10
		// zweimal im selben Satz, einmal als Ist und einmal als Soll. Wer ein
		// Datum eingibt, bekommt sonst nur Tageszahlen zurück und zählt im Saal
		// im Kopf weiter.
		const b = pruefeZehntagesfrist('2026-09-01', '2026-09-11');
		expect(b.fruehesterTermin).toBe('2026-09-12');
		expect(b.hinweis).toMatch(/12\. September 2026/);
		/*
		 * **Hier stand eine Zusicherung, die nie rot werden konnte**
		 * (Code-Review vom 23.09.2026, Befund 7): `not.toMatch(/11 Tage nach der
		 * ersten/)` im Verstosszweig, wo der Abstand per Definition kleiner als
		 * elf ist. Sie sah aus wie eine Messung und war keine.
		 *
		 * Gemeint war L-1 der Laienprüfung: Das Soll darf nicht als blosse
		 * Ziffer neben dem Ist stehen, sonst liest sich die Meldung bei genau
		 * zehn Tagen als Rechenfehler der Anwendung. Das misst diese Zeile, und
		 * sie wird rot, wenn jemand das Zahlwort wieder zur Ziffer macht.
		 */
		expect(b.hinweis).not.toMatch(new RegExp(`von ${FRIST_TAGE} Tagen`));
	});

	/*
	 * **Die Frist hält nicht mehr auf, und das ist der Punkt** (Befund R-2b,
	 * Produktentscheid vom 23.09.2026). Bis dahin standen hier drei Proben über
	 * ein Begründungsfeld: eine, die ohne Begründung abwies, eine, die mit
	 * Begründung durchliess, und eine, die die Begründung in den Verlauf schrieb.
	 * Alle drei massen einen Ausweg, den es rechtlich nicht gibt.
	 */
	it('lässt eine Zweitversammlung mit verletzter Frist zu, statt sie abzuweisen', () => {
		const g = pruefeVersammlung(
			eingabe({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				vorgaengerDatum: '2026-09-10',
				datum: '2026-09-15'
			})
		);
		expect(g.datum).toBe('2026-09-15');
	});

	it('gibt ihr dafür einen Vermerk, der die Rechtsfolge nennt', () => {
		const vermerk = fristvermerk('2026-09-10', '2026-09-15');
		expect(vermerk).toMatch(/nur 5 Tage nach der ersten/);
		expect(vermerk).toMatch(/712p Abs\. 2/);
		// Die Rechtsfolge, nicht nur der Verstoss. Und sie ist erst brauchbar mit
		// ihren drei Angaben (Fachprüfung 24.09.2026, F-1/F-5/F-6): wer darf,
		// wo, und ab wann die Frist läuft.
		expect(vermerk).toMatch(/der nicht zugestimmt hat/);
		expect(vermerk).toMatch(/beim Gericht anfechten/);
		expect(vermerk).toMatch(/sobald er von ihnen erfahren hat/);
		// Und die Zusage bleibt auf das Gesetz beschränkt (F-2): Ein Reglement
		// darf eine längere Frist vorsehen, dann ist der errechnete Tag nicht
		// der erste zulässige.
		expect(vermerk).toMatch(/Nach Gesetz hätte sie frühestens/);
	});

	it('schweigt, wo die Frist eingehalten ist', () => {
		expect(fristvermerk('2026-09-10', '2026-09-21')).toBeNull();
		expect(fristvermerk(null, '2026-09-21')).toBeNull();
		// Der verdrehte Fall ist ein Datenfehler und bekommt keinen Vermerk,
		// sondern eine Absage — die Probe darunter misst sie.
		expect(fristvermerk('2026-09-20', '2026-09-15')).toBeNull();
	});

	it('schreibt den Vermerk an die Versammlung und in den Verlauf', () => {
		const u = legeVersammlungAn(
			'v-2',
			'op-1',
			eingabe({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				vorgaengerDatum: '2026-09-10',
				datum: '2026-09-15'
			})
		);
		expect(u.ergebnis.fristvermerk).toMatch(/nur 5 Tage nach der ersten/);
		expect(u.ereignisse[0].angaben?.fristvermerk).toBe(u.ergebnis.fristvermerk);
	});

	it('lässt ihn wieder weg, sobald das Datum die Frist einhält', () => {
		const angelegt = legeVersammlungAn(
			'v-2',
			'op-1',
			eingabe({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				vorgaengerDatum: '2026-09-10',
				datum: '2026-09-15'
			})
		).ergebnis;
		expect(angelegt.fristvermerk).not.toBeNull();

		const berichtigt = aendereVersammlung(
			angelegt,
			eingabe({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				vorgaengerDatum: '2026-09-10',
				datum: '2026-09-25'
			})
		).ergebnis;
		expect(berichtigt.fristvermerk).toBeNull();
	});

	it('weist eine zweite Versammlung vor der ersten weiterhin ab', () => {
		expect(() =>
			pruefeVersammlung(
				eingabe({
					stufe: 'zweite',
					vorgaengerId: 'v-0',
					vorgaengerDatum: '2026-09-20',
					datum: '2026-09-15'
				})
			)
		).toThrow(/vor der ersten/);
	});
});

describe('Erst- und Zweitversammlung', () => {
	it('verlangt bei der Zweitversammlung den Bezug zur ersten', () => {
		expect(() => pruefeVersammlung(eingabe({ stufe: 'zweite' }))).toThrow(/Bezug zur ersten/);
	});

	it('weist einen Vorgänger bei der Erstversammlung ab', () => {
		expect(() => pruefeVersammlung(eingabe({ vorgaengerId: 'v-0' }))).toThrow(
			/Nur eine Zweitversammlung/
		);
	});
});

describe('Betriebsart', () => {
	it('schlägt bis fünf Parteien die einfache Führung vor', () => {
		expect(betriebsartVorschlag(1)).toBe('einfach');
		expect(betriebsartVorschlag(SCHWELLE_GEFUEHRT)).toBe('einfach');
	});

	it('schlägt darüber die geführte vor', () => {
		expect(betriebsartVorschlag(SCHWELLE_GEFUEHRT + 1)).toBe('gefuehrt');
		expect(betriebsartVorschlag(14)).toBe('gefuehrt');
	});

	it('lässt den Wechsel im Entwurf zu', () => {
		const u = wechsleBetriebsart(angelegt(), 'einfach', 'Kein Beamer im Saal');
		expect(u.ergebnis.betriebsart).toBe('einfach');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.betriebsartGewechselt);
		expect(u.ereignisse[0].angaben).toMatchObject({ vorher: 'gefuehrt', nachher: 'einfach' });
	});

	it('lässt ihn auch nach der Freigabe zu, solange nicht eröffnet ist', () => {
		const v: Versammlung = { ...angelegt(), zustand: 'freigegeben' };
		expect(wechsleBetriebsart(v, 'einfach').ergebnis.betriebsart).toBe('einfach');
	});

	it('weist ihn nach der Eröffnung ab', () => {
		// Mitten in der Versammlung wechselten sonst die Erfassungswege, und
		// niemand wüsste, welche der beiden Erfassungen gilt.
		const v: Versammlung = { ...angelegt(), zustand: 'laufend' };
		expect(() => wechsleBetriebsart(v, 'einfach')).toThrow(FachlicherFehler);
	});

	it('erzeugt kein Ereignis, wenn sich nichts ändert', () => {
		expect(wechsleBetriebsart(angelegt(), 'gefuehrt').ereignisse).toHaveLength(0);
	});
});

describe('Ändern und Zustände', () => {
	it('hält fest, welche Felder sich geändert haben', () => {
		const u = aendereVersammlung(angelegt(), eingabe({ ort: 'Gemeindesaal' }));
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(Object.keys(felder)).toEqual(['ort']);
	});

	it('erzeugt keinen Verlaufseintrag ohne Änderung', () => {
		expect(aendereVersammlung(angelegt(), eingabe()).ereignisse).toHaveLength(0);
	});

	it('weist eine Änderung nach der Freigabe ab', () => {
		// Datum und Ort stehen dann in versandten Einladungen.
		const v: Versammlung = { ...angelegt(), zustand: 'freigegeben' };
		expect(() => aendereVersammlung(v, eingabe({ ort: 'Anderswo' }))).toThrow(/freigegeben/);
	});

	it('nennt im Fehler den Ist-Zustand und die möglichen', () => {
		try {
			verlangeZustand({ zustand: 'versiegelt' }, ['entwurf'], 'ändern');
			expect.unreachable();
		} catch (f) {
			expect((f as FachlicherFehler).message).toMatch(/versiegelt/);
			expect((f as FachlicherFehler).message).toMatch(/Entwurf/);
		}
	});

	it('beschriftet jeden Zustand lesbar', () => {
		for (const z of ['entwurf', 'freigegeben', 'laufend', 'geschlossen', 'versiegelt'] as const) {
			expect(zustandsname(z)).not.toBe('');
		}
	});

	it('trennt Entwurf von allem, was auf der Momentaufnahme rechnet', () => {
		expect(istImEntwurf({ zustand: 'entwurf' })).toBe(true);
		expect(rechnetAufMomentaufnahme({ zustand: 'entwurf' })).toBe(false);
		for (const z of ['freigegeben', 'laufend', 'geschlossen', 'versiegelt'] as const) {
			expect(rechnetAufMomentaufnahme({ zustand: z })).toBe(true);
		}
	});
});

describe('abgeschlossen', () => {
	/*
	 * **Warum diese Frage eine eigene Funktion hat** (04.09.2026). Der Zustand
	 * hat fünf Werte, und `versiegelt` kam als fünfter dazu. Sechs Stellen
	 * fragten weiterhin nur `=== 'geschlossen'` und behandelten die versiegelte
	 * Versammlung, als wäre sie noch offen: Die Führung schlug einen
	 * Vorbereitungsschritt vor, die Protokollseite nannte gesperrte Zahlen
	 * «vorläufig», die Leinwand fiel vor dem Saal auf die Code-Eingabe zurück,
	 * und an einer versiegelten Versammlung liess sich eine Vollmacht ändern.
	 */
	it('gilt für die geschlossene wie für die versiegelte Versammlung', () => {
		expect(abgeschlossen('geschlossen')).toBe(true);
		expect(abgeschlossen('versiegelt')).toBe(true);
	});

	it('gilt für keinen Zustand davor', () => {
		expect(abgeschlossen('entwurf')).toBe(false);
		expect(abgeschlossen('freigegeben')).toBe(false);
		expect(abgeschlossen('laufend')).toBe(false);
	});

	it('deckt jeden Zustand ab, den die Anwendung kennt', () => {
		/*
		 * **Aus dem Bestand abgeleitet, nicht von Hand aufgezählt** (04.09.2026,
		 * aus dem Code-Review). Eine getippte Liste hält nicht, was der Name
		 * verspricht: Käme ein sechster Zustand dazu, bliebe die Probe grün.
		 * `zustandsname` kennt jeden Zustand, weil die Oberfläche ihn anzeigen
		 * muss; ein neuer ohne Namen fällt schon dort auf.
		 */
		const alle = Object.keys(ZUSTANDSNAMEN) as Versammlungszustand[];
		expect(alle.length).toBeGreaterThanOrEqual(5);
		expect(alle.filter(abgeschlossen).sort()).toEqual(['geschlossen', 'versiegelt']);
		for (const z of alle) expect(typeof zustandsname(z)).toBe('string');
	});
});

/*
 * **Die Reglementsfrist zur zweiten Versammlung** (Produktentscheid
 * 24.09.2026, Migration 122).
 *
 * Der Kern der Sache ist die **Richtung**: Ein Reglement darf die Frist
 * verlängern, nicht verkürzen (Wermelinger, Rz. 40 ad Art. 712p). Fiele diese
 * Schranke weg, wäre genau der Ausweg wieder offen, den R-2b geschlossen hat —
 * statt eines Begründungsfelds, das die Prüfung einmalig abschaltet, täte es
 * eine Reglementszahl dauerhaft und je Gemeinschaft.
 */
describe('Reglementsfrist zur zweiten Versammlung', () => {
	it('weist eine kürzere Frist als die gesetzliche ab', () => {
		expect(() => pruefeZweitversammlungsfrist(9, 'Ziff. 14.2')).toThrow(/verlängern, nicht verkürzen/);
	});

	it('lässt die gesetzliche Zahl zu — Reglemente wiederholen sie oft', () => {
		expect(pruefeZweitversammlungsfrist(FRIST_TAGE, 'Ziff. 14.2')).toEqual({
			tage: FRIST_TAGE,
			fundstelle: 'Ziff. 14.2'
		});
	});

	it('verlangt die Fundstelle, sobald eine Zahl dasteht', () => {
		expect(() => pruefeZweitversammlungsfrist(20, '')).toThrow(/Fundstelle/);
	});

	it('nimmt die Frist ohne Zahl auch aus der Fundstelle heraus', () => {
		expect(pruefeZweitversammlungsfrist(null, 'Ziff. 14.2')).toEqual({
			tage: null,
			fundstelle: null
		});
	});

	/*
	 * **Ohne hinterlegte Frist muss sich nichts ändern.** Diese Probe ist der
	 * Grund, warum die Reglementsfrist überall als optionaler Wert durchgereicht
	 * wird statt als Pflichtangabe: Wer sie nicht hinterlegt, bekommt Tag für Tag
	 * dieselben Zahlen wie vorher.
	 */
	it('rechnet ohne hinterlegte Frist wie bisher', () => {
		expect(fruehesterZweitTermin('2026-10-01')).toBe(fruehesterZweitTermin('2026-10-01', null));
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-12').eingehalten).toBe(true);
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-11').eingehalten).toBe(false);
	});

	it('verschiebt den frühesten Termin um genau die längere Frist', () => {
		// Zwanzig Tage Reglementsfrist: Die Frist läuft ab dem Tag nach der ersten
		// Versammlung, der erste zulässige Termin ist also der einundzwanzigste Tag.
		expect(fruehesterZweitTermin('2026-10-01', 20)).toBe('2026-10-22');
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-21', 20).eingehalten).toBe(false);
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-22', 20).eingehalten).toBe(true);
	});

	it('nimmt eine kürzere Zahl aus dem Bestand nicht an', () => {
		// `geltendeZweitfrist` sieht auch Werte, die nicht durch die Eingangsprüfung
		// kamen. Eine Zahl unter zehn darf die gesetzliche Frist nie unterbieten.
		expect(geltendeZweitfrist(3)).toBe(FRIST_TAGE);
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-11', 3).eingehalten).toBe(false);
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-12', 3).eingehalten).toBe(true);
	});

	it('nennt im Vermerk das Reglement samt Fundstelle, nicht das Gesetz', () => {
		const v = fristvermerk('2026-10-01', '2026-10-15', { tage: 20, fundstelle: 'Ziff. 14.2' });
		expect(v).toMatch(/Nach dem Reglement Ihrer Gemeinschaft \(Ziff\. 14\.2\)/);
		expect(v).toMatch(/22\. Oktober 2026/);
		// Das Gesetz bleibt sichtbar: Das Reglement ist eine Verschärfung, keine
		// eigene Rechtsgrundlage.
		expect(v).toMatch(/gesetzliche Frist von zehn Tagen/);
	});

	/*
	 * **Diese Proben halten die beiden neuen Textzweige selbst fest**
	 * (Code-Review 24.09.2026, Befund 7). Vorher liess sich der Rumpf von
	 * `fristlaufSatz` durch `return FRISTLAUF;` ersetzen, ohne dass eine von
	 * 4432 Proben rot wurde: Die einzige Probe, die den Satz berührte, prüfte
	 * auf «gesetzliche Frist von zehn Tagen» — und das steht in beiden Zweigen.
	 */
	it('sagt im Fristlaufsatz, dass das Reglement mehr verlangt', () => {
		expect(fristlaufSatz(20)).toMatch(/Reglement Ihrer Gemeinschaft verlangt mehr, nämlich 20 Tage/);
		expect(fristlaufSatz(20)).toMatch(/massgebend ist dann die längere Frist/);
		// Ohne und bei gleicher Frist bleibt es beim blossen Gesetzessatz.
		expect(fristlaufSatz(null)).toBe(FRISTLAUF);
		expect(fristlaufSatz(FRIST_TAGE)).toBe(FRISTLAUF);
	});

	it('nennt bei eingehaltener Frist das Reglement, nicht das Gesetz', () => {
		const b = pruefeZehntagesfrist('2026-10-01', '2026-10-22', 20);
		expect(b.hinweis).toMatch(/Frist Ihres Reglements von 20 Tagen ist eingehalten/);
		expect(pruefeZehntagesfrist('2026-10-01', '2026-10-12').hinweis).toMatch(
			/gesetzliche Frist von zehn Tagen ist eingehalten/
		);
	});

	it('weist eine unsinnig lange oder gebrochene Frist ab', () => {
		expect(() => pruefeZweitversammlungsfrist(ZWEITFRIST_HOECHSTENS_TAGE + 1, 'Ziff. 14.2')).toThrow(
			/ganze Zahl/
		);
		expect(() => pruefeZweitversammlungsfrist(14.5, 'Ziff. 14.2')).toThrow(/ganze Zahl/);
	});

	/*
	 * **Der kurze Hinweis muss ohne Gemeinschaft wahr bleiben** (Befund 1). Er
	 * steht an fünf Anzeigen, von denen drei die Gemeinschaft kennen und zwei
	 * nicht. Die zwei bekommen `FRIST_KURZ`, und der darf nichts Unbedingtes
	 * über den elften Tag behaupten.
	 */
	it('behauptet im kurzen Hinweis ohne Wert nichts Unbedingtes', () => {
		expect(FRIST_KURZ).toMatch(/Nach Gesetz/);
		expect(FRIST_KURZ).toMatch(/ein Reglement kann eine längere Frist vorsehen/);
		expect(fristKurz(null)).toBe(FRIST_KURZ);
		expect(fristKurz(FRIST_TAGE)).toBe(FRIST_KURZ);
		expect(fristKurz(20)).toMatch(/frühestens am 21\. Tag/);
	});

	/*
	 * **Satz und Termin gegeneinander**, in derselben Bauart wie die Probe, die
	 * die Zahlwörter an den Konstanten hält. Genau diese Zusicherung war im
	 * ersten Durchgang gebrochen: Der Hinweis nannte den elften Tag, der
	 * Terminvorschlag daneben den einundzwanzigsten. Beide für sich zu prüfen
	 * hätte das nicht gefunden.
	 */
	it('nennt im Hinweis denselben Tag, den der Terminvorschlag ausrechnet', () => {
		for (const tage of [null, FRIST_TAGE, 14, 20, 90]) {
			const termin = fruehesterZweitTermin('2026-10-01', tage);
			const abstand = tageZwischen('2026-10-01', termin);
			const satz = fristKurz(tage);
			const genannt = abstand === MINDESTABSTAND_TAGE ? 'elften' : `${abstand}.`;
			expect(satz).toContain(`${genannt} Tag`);
		}
	});

	it('schreibt dem Abend keine fremde Reglementsklausel zu', () => {
		// Am gemeinsamen Abend stehen mehrere Gemeinschaften nebeneinander. Die
		// längste Frist gilt für alle, sie gehört aber nur einer.
		const satz = fristAmAbend(20);
		expect(satz).toMatch(/An diesem Abend gilt die längste hinterlegte Frist: 20 Tage/);
		expect(satz).not.toMatch(/Ihr Reglement verlangt/);
		expect(satz).not.toMatch(/Reglement Ihrer Gemeinschaft/);
		expect(fristAmAbend(null)).toBe(FRIST_KURZ);
		expect(fristAmAbend(FRIST_TAGE)).toBe(FRIST_KURZ);
	});

	it('nennt ohne Reglementsfrist weiterhin das Gesetz', () => {
		const v = fristvermerk('2026-10-01', '2026-10-05');
		expect(v).toMatch(/Nach Gesetz/);
		expect(v).not.toMatch(/Reglement Ihrer Gemeinschaft/);
	});
});
