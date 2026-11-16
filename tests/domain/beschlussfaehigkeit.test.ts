import { describe, expect, it } from 'vitest';
import {
	EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT,
	EINZIGE_GEMEINSCHAFT,
	EINZIGE_GEMEINSCHAFT_KURZ,
	EINZIGER_EIGENTUEMER,
	EINZIGER_EIGENTUEMER_KURZ,
	feststellungssatz,
	satzZumEinzigen,
	GESETZLICH,
	pruefeErschwerung,
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeitsregel,
	type Beteiligung,
	type Feststellung,
	type Versammlungsstufe
} from '$lib/domain/beschlussfaehigkeit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

/**
 * Zwanzig Eigentümer, tausend Wertquoten — der Fall aus der Story.
 *
 * Jeder hält eine Einheit, Personen und Kopfstimmen fallen also zusammen. Das
 * ist der Fall «je Eigentümer» und zugleich der häufigste bei «je Einheit».
 */
function beteiligung(anwesend: number, quotenAnwesend: number): Beteiligung {
	return {
		eigentuemerGesamt: 20,
		eigentuemerAnwesend: anwesend,
		kopfstimmenGesamt: 20,
		kopfstimmenAnwesend: anwesend,
		gesamtquote: 1000,
		quotenAnwesend
	};
}

describe('Erstversammlung nach ZGB Art. 712p Abs. 1', () => {
	it('ist mit 10 von 20 Eigentümern und 500 von 1000 Quoten beschlussfähig', () => {
		// «Die Hälfte» heisst mindestens die Hälfte. Wer hier die
		// Mehrheitsformel floor(n/2)+1 verwendet, verlangt elf und erklärt eine
		// beschlussfähige Versammlung für unfähig.
		const f = stelleBeschlussfaehigkeitFest('erste', beteiligung(10, 500));
		expect(f.beschlussfaehig).toBe(true);
		expect(f.bedingungen.map((b) => b.noetig)).toEqual([10, 500]);
	});

	it('ist mit 10 Eigentümern und nur 480 Quoten nicht beschlussfähig', () => {
		const f = stelleBeschlussfaehigkeitFest('erste', beteiligung(10, 480));
		expect(f.beschlussfaehig).toBe(false);
	});

	it('benennt, welche der beiden Bedingungen fehlt', () => {
		const f = stelleBeschlussfaehigkeitFest('erste', beteiligung(10, 480));
		expect(f.fehlt).toMatch(/Wertquoten/);
		expect(f.fehlt).toMatch(/480, mindestens 500 nötig/);
		expect(f.fehlt).not.toMatch(/Kopfstimmen/);
	});

	it('benennt umgekehrt die fehlenden Köpfe', () => {
		const f = stelleBeschlussfaehigkeitFest('erste', beteiligung(9, 900));
		expect(f.beschlussfaehig).toBe(false);
		expect(f.fehlt).toMatch(/Stockwerkeigentümer anwesend oder vertreten: 9, mindestens 10 nötig/);
	});

	it('verlangt beide Bedingungen zugleich, nicht eine davon', () => {
		expect(stelleBeschlussfaehigkeitFest('erste', beteiligung(20, 400)).beschlussfaehig).toBe(false);
		expect(stelleBeschlussfaehigkeitFest('erste', beteiligung(4, 1000)).beschlussfaehig).toBe(false);
	});

	it('verlangt mindestens zwei, auch in der Kleinstgemeinschaft', () => {
		// Die Hälfte von drei ist aufgerundet zwei — hier deckungsgleich. Bei
		// zwei Eigentümern wäre die Hälfte eins, das Gesetz verlangt zwei.
		const zwei = {
			eigentuemerGesamt: 2,
			eigentuemerAnwesend: 1,
			kopfstimmenGesamt: 2,
			kopfstimmenAnwesend: 1,
			gesamtquote: 1000,
			quotenAnwesend: 900
		};
		expect(stelleBeschlussfaehigkeitFest('erste', zwei).bedingungen[0].noetig).toBe(2);
		expect(stelleBeschlussfaehigkeitFest('erste', zwei).beschlussfaehig).toBe(false);
	});
});

describe('Zweitversammlung nach ZGB Art. 712p Abs. 3', () => {
	it('genügt ein Drittel nach Köpfen, ohne Anteilsbedingung', () => {
		// Ein Drittel von 20 ist aufgerundet 7.
		const f = stelleBeschlussfaehigkeitFest('zweite', beteiligung(7, 100));
		expect(f.beschlussfaehig).toBe(true);
		expect(f.bedingungen).toHaveLength(1);
	});

	it('ist mit sechs von zwanzig nicht beschlussfähig', () => {
		expect(stelleBeschlussfaehigkeitFest('zweite', beteiligung(6, 900)).beschlussfaehig).toBe(false);
	});

	it('verlangt auch hier mindestens zwei', () => {
		const klein = {
			eigentuemerGesamt: 5,
			eigentuemerAnwesend: 1,
			kopfstimmenGesamt: 5,
			kopfstimmenAnwesend: 1,
			gesamtquote: 1000,
			quotenAnwesend: 200
		};
		// Ein Drittel von 5 ist aufgerundet 2 — hier bereits die Untergrenze.
		expect(stelleBeschlussfaehigkeitFest('zweite', klein).bedingungen[0].noetig).toBe(2);
	});

	/*
	 * **Die Probe ist am 24.09.2026 umgezogen, nicht entfallen.**
	 *
	 * Sie hing an `ZWEITE_VERSAMMLUNG_FRIST`, einer blossen Weiterleitung auf
	 * `FRIST_KURZ`. Seit die Frist je Gemeinschaft hinterlegbar ist
	 * (Migration 122), beziehen die drei Routen den Satz nicht mehr unter
	 * diesem Namen, sondern über `fristKurz(tage)` mit ihrem eigenen Wert; die
	 * Weiterleitung war danach ein toter Export mit einer Begründung, die auf
	 * nichts mehr zeigte.
	 *
	 * Was der Satz zusagt, prüft jetzt `tests/domain/versammlung.test.ts` an
	 * `FRIST_KURZ` und `fristKurz` selbst — und dort zusätzlich gegen den
	 * Terminvorschlag, was hier nie geprüft war.
	 */
});

describe('Reglementsregeln zur Beschlussfähigkeit', () => {
	const strenger: Beschlussfaehigkeitsregel = {
		kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
		mindestens: 3,
		fundstelle: 'Reglement Ziff. 8.1'
	};

	it('lässt eine Erschwerung zu', () => {
		expect(pruefeErschwerung('erste', strenger).fundstelle).toBe('Reglement Ziff. 8.1');
		const f = stelleBeschlussfaehigkeitFest('erste', beteiligung(13, 700), strenger);
		expect(f.bedingungen.map((b) => b.noetig)).toEqual([14, 667]);
		expect(f.beschlussfaehig).toBe(false);
		expect(f.grundlage).toBe('reglement');
		expect(f.fundstelle).toBe('Reglement Ziff. 8.1');
	});

	/*
	 * **Was hier durchkommt, muss die Datenbank annehmen können.**
	 *
	 * `bylaw_attendance_rule` trägt `bylaw_attendance_kopf_bruch` (Zähler ab 1,
	 * Nenner 2 bis 100, Zähler nicht grösser als der Nenner), `min_heads >= 2`
	 * und eine Mindestlänge der Fundstelle. Was die Fachprüfung durchlässt und
	 * der CHECK nicht, endet in einer Fehlerseite statt in einer Feldmeldung —
	 * die Aktion fängt nur `FachlicherFehler`.
	 *
	 * **Die Probe geht über `pruefeErschwerung`, nicht über das Formular.**
	 * Dessen `required` und `max` sind Bequemlichkeiten des Browsers, keine
	 * Schranken; eine gebaute Anfrage kennt sie nicht.
	 *
	 * Ein erster Anlauf prüfte nur `NaN` und `nenner: 0` — also genau die zwei
	 * Fälle, an die der Autor beim Schreiben der Schranke gedacht hatte, und
	 * keinen der drei, an denen sie zu schwach war (Code-Review 06.09.2026).
	 */
	it('lässt nur Brüche durch, die auch die Datenbank annimmt', () => {
		const unzahl = { zaehler: Number.NaN, nenner: Number.NaN, art: 'mindestens' } as const;

		// Leere Felder: `ganzzahl('')` liefert NaN.
		expect(() => pruefeErschwerung('erste', { ...strenger, kopf: unzahl })).toThrow(
			/ganze Zahlen/
		);
		expect(() => pruefeErschwerung('erste', { ...strenger, quoten: unzahl })).toThrow(
			/ganze Zahlen/
		);

		// Nenner ausserhalb 2..100 — beide Enden.
		for (const nenner of [0, 1, 200]) {
			expect(() =>
				pruefeErschwerung('erste', {
					...strenger,
					kopf: { zaehler: 1, nenner, art: 'mindestens' }
				}), `Nenner ${nenner}`
			).toThrow(/unplausibel/);
		}

		// Ein Bruch über dem Ganzen: 5/3 ist grösser als die gesetzliche Hälfte
		// und bestand deshalb die Erschwerungsprüfung mit Auszeichnung.
		expect(() =>
			pruefeErschwerung('erste', {
				...strenger,
				kopf: { zaehler: 5, nenner: 3, art: 'mindestens' }
			})
		).toThrow(/nie erreichbar/);

		// Und die Fundstelle, die der CHECK auf drei Zeichen verlangt.
		expect(() => pruefeErschwerung('erste', { ...strenger, fundstelle: 'A' })).toThrow(
			/drei Zeichen/
		);
	});

	/*
	 * **Die Mindestzahl behält ihre eigene Meldung.** Sie ist kein Bruch,
	 * sondern eine Personenzahl; ein erster Anlauf schickte sie durch dieselbe
	 * Schleife und meldete «Zähler und Nenner müssen ganze Zahlen sein» für ein
	 * Feld, das weder das eine noch das andere hat.
	 */
	/*
	 * **Was der CHECK nicht fängt, fängt der Wertebereich** — und den übersetzt
	 * `uebersetzeSchranke` nicht. `min_heads` ist eine `integer`-Spalte; eine
	 * Zahl darüber endet als 22003 in einer Fehlerseite statt in einer
	 * Feldmeldung. Gefunden im Sicherheitsdurchgang 06.09.2026, nachdem der
	 * Code-Review die Bruchfelder bereits geschlossen hatte: Dort deckelt der
	 * Nenner (höchstens 100) alles, hier deckelte nichts.
	 */
	it('deckelt die Mindestzahl auch nach oben', () => {
		expect(() =>
			pruefeErschwerung('erste', { ...strenger, mindestens: 3_000_000_000 })
		).toThrow(/höchstens 9999/);
	});

	/*
	 * **Die Stufe war eine Behauptung, keine Prüfung.** Die Aktion nahm sie mit
	 * `as Versammlungsstufe` entgegen; bei einem unbekannten Wert war
	 * `GESETZLICH[art]` schlicht `undefined` und der erste Zugriff darauf ein
	 * `TypeError`. Die Probe ruft die Fachfunktion mit einem Wert, den der
	 * Übersetzer nicht zulässt — genau deshalb steht das `as` hier: Eine
	 * gebaute Anfrage kennt die Typen nicht.
	 */
	it('weist eine unbekannte Versammlungsstufe ab, statt zu stürzen', () => {
		for (const art of ['dritte', '']) {
			expect(
				() => pruefeErschwerung(art as Versammlungsstufe, strenger),
				`Stufe «${art}»`
			).toThrow(/Erst- oder die Zweitversammlung/);
		}
	});

	it('nennt bei der Mindestzahl die gesetzliche Untergrenze', () => {
		for (const mindestens of [0, 1]) {
			expect(() =>
				pruefeErschwerung('erste', { ...strenger, mindestens }),
				`Mindestzahl ${mindestens}`
			).toThrow(/gesetzliche Untergrenze/);
		}
		expect(() =>
			pruefeErschwerung('erste', { ...strenger, mindestens: Number.NaN })
		).toThrow(/ganze Zahl/);
	});

	it('weist eine Erleichterung bei den Köpfen ab', () => {
		// Der Minderheitenschutz: Ein tieferes Anwesenheitsquorum liesse eine
		// kleine Gruppe für alle entscheiden.
		expect(() =>
			pruefeErschwerung('erste', { ...strenger, kopf: { zaehler: 1, nenner: 3, art: 'mindestens' } })
		).toThrow(FachlicherFehler);
		expect(() =>
			pruefeErschwerung('erste', { ...strenger, kopf: { zaehler: 1, nenner: 3, art: 'mindestens' } })
		).toThrow(/erschweren, nicht erleichtern/);
	});

	it('weist eine gesenkte Anteilsbedingung ab', () => {
		expect(() =>
			pruefeErschwerung('erste', {
				...strenger,
				quoten: { zaehler: 1, nenner: 3, art: 'mindestens' }
			})
		).toThrow(/nicht senken/);
	});

	it('weist das Weglassen der Anteilsbedingung ab', () => {
		// Eine Erleichterung, die leicht übersehen wird, weil sie nicht in einer
		// Zahl steht, sondern in deren Fehlen.
		expect(() => pruefeErschwerung('erste', { ...strenger, quoten: null })).toThrow(
			/wegzulassen/
		);
	});

	it('weist eine gesenkte Untergrenze ab', () => {
		expect(() => pruefeErschwerung('erste', { ...strenger, mindestens: 1 })).toThrow(
			/Untergrenze von 2/
		);
	});

	it('verlangt die Fundstelle', () => {
		expect(() => pruefeErschwerung('erste', { ...strenger, fundstelle: '  ' })).toThrow(/Fundstelle/);
	});

	it('lässt bei der Zweitversammlung eine Anteilsbedingung zu, wo das Gesetz keine kennt', () => {
		// Eine zusätzliche Bedingung erschwert, sie erleichtert nicht.
		const mitQuoten = pruefeErschwerung('zweite', { ...strenger, mindestens: 2 });
		expect(mitQuoten.quoten).not.toBeNull();
	});
});

describe('Einstimmigkeit', () => {
	it('sagt, dass Beschlussfähigkeit hier nicht genügt', () => {
		// Eine grün leuchtende Beschlussfähigkeit neben einem
		// Einstimmigkeitstraktandum ist die Art richtiger Anzeige, die falsch
		// verstanden wird.
		expect(EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT).toMatch(/genügt die Beschlussfähigkeit nicht/);
		expect(EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT).toMatch(/Wer nicht erscheint, muss vertreten sein/);
	});
});

describe('die gesetzlichen Schwellen', () => {
	it('lesen sich als «mindestens», nicht als «mehr als»', () => {
		expect(GESETZLICH.erste.kopf.art).toBe('mindestens');
		expect(GESETZLICH.erste.quoten?.art).toBe('mindestens');
	});

	it('kennen bei der Zweitversammlung keine Anteilsbedingung', () => {
		expect(GESETZLICH.zweite.quoten).toBeNull();
	});
});

// ── Ohne Stimmberechtigte ───────────────────────────────────────────────────
//
// **Der Fund aus Prüflauf II** (23.08.2026, Durchgang A): Auf der Übersicht
// einer Gruppe stand «✓ Beschlussfähig — 0, mindestens 0 nötig», während
// darunter dreissig Parteien in zwei Häusern hingen. Arithmetisch ist «0 von 0»
// erfüllt; inhaltlich ist es der gefährlichste Satz, den ein Werkzeug sagen
// kann.

describe('Ohne stimmberechtigte Partei', () => {
	const leer = {
		eigentuemerGesamt: 0,
		eigentuemerAnwesend: 0,
		kopfstimmenAnwesend: 0,
		kopfstimmenGesamt: 0,
		quotenAnwesend: 0,
		gesamtquote: 0
	};

	it('ist nie beschlussfähig — auch wenn 0 von 0 rechnerisch aufgeht', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', leer);
		expect(b.beschlussfaehig).toBe(false);
		expect(b.fehlt).toContain('keine stimmberechtigte Partei');
	});

	it('zeigt keine Bedingungen — zwei Zeilen «0 / 0» behaupteten eine Rechnung', () => {
		expect(stelleBeschlussfaehigkeitFest('erste', leer).bedingungen).toEqual([]);
	});

	it('gilt auch für die zweite Versammlung, wo sonst jede Zahl genügt', () => {
		// Bei der Zweitversammlung ist die Beschlussfähigkeit gesetzlich nicht an
		// eine Mindestbeteiligung gebunden — trotzdem braucht es jemanden.
		expect(stelleBeschlussfaehigkeitFest('zweite', leer).beschlussfaehig).toBe(false);
	});

	it('bleibt bei einer einzigen Partei beschlussfähig', () => {
		// Die Grenze ist null, nicht «wenige»: Eine Gemeinschaft aus einer Partei
		// gibt es, und sie kann beschliessen.
		const b = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 1,
			eigentuemerAnwesend: 1,
			kopfstimmenAnwesend: 1,
			kopfstimmenGesamt: 1,
			quotenAnwesend: 1000,
			gesamtquote: 1000
		});
		expect(b.beschlussfaehig).toBe(true);
		expect(b.einzigerEigentuemer).toBe(true);
	});
});

/*
 * **Ä-17 A: Die Einpersonengemeinschaft trägt ein Kennzeichen** (Produktentscheid
 * 18.10.2026, `docs/entscheide/0011`). Beschlussfähig bleibt sie, aber nur nach
 * einer Lehrmeinung (Rz. 12 ad Art. 712p, Rz. 21a ad Art. 712m); Leitung und
 * Protokoll sagen es. Bei zwei und mehr Eigentümern steht nichts.
 */
describe('Ä-17 A: einziger Eigentümer', () => {
	const allein = {
		eigentuemerGesamt: 1,
		eigentuemerAnwesend: 1,
		kopfstimmenAnwesend: 3,
		kopfstimmenGesamt: 3,
		quotenAnwesend: 1000,
		gesamtquote: 1000
	};
	const feststellung = (eigentuemerGesamt: number | null): Feststellung => ({
		id: 'f-1',
		versammlungId: 'v-1',
		traktandumId: null,
		zeitpunkt: new Date('2026-10-18T17:00:00Z'),
		durch: 'Prüferin',
		kopfstimmenAnwesend: 3,
		kopfstimmenGesamt: 3,
		eigentuemerAnwesend: eigentuemerGesamt,
		eigentuemerGesamt,
		quotenAnwesend: 1000,
		gesamtquote: 1000,
		beschlussfaehig: true,
		grundlage: 'gesetz',
		fundstelle: null,
		fehlt: null
	});

	it('stellt beschlussfähig fest und kennzeichnet, auch an der zweiten Versammlung', () => {
		for (const stufe of ['erste', 'zweite'] as const) {
			const b = stelleBeschlussfaehigkeitFest(stufe, allein);
			expect(b.beschlussfaehig).toBe(true);
			expect(b.einzigerEigentuemer).toBe(true);
		}
	});

	it('kennzeichnet nicht, sobald zwei Personen Eigentum halten', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', { ...allein, eigentuemerGesamt: 2, eigentuemerAnwesend: 2 });
		expect(b.beschlussfaehig).toBe(true);
		expect(b.einzigerEigentuemer).toBe(false);
	});

	it('nennt im Feststellungssatz die Lehrmeinung mit Fundstelle', () => {
		const satz = feststellungssatz(feststellung(1));
		expect(satz).toBe(`Die Versammlung ist beschlussfähig. ${EINZIGER_EIGENTUEMER}`);
		// Ohne «(ZGB 712p)»: Art. 712p verlangt gerade zwei (Fachprüfung 18.10.2026).
		expect(satz).not.toContain('(ZGB 712p)');
		expect(satz).toContain('Wermelinger, SVIT-Kommentar, Rz. 12 ad Art. 712p');
		expect(satz).toContain('Rz. 21a ad Art. 712m');
	});

	it('führt in der Leitung eine Fassung ohne Randziffer', () => {
		expect(EINZIGER_EIGENTUEMER_KURZ).not.toContain('Rz.');
		expect(EINZIGER_EIGENTUEMER_KURZ).not.toContain('ZGB');
		// Beide Fassungen beginnen gleich; die lange ist seit 13.11.2026 eine eigene Konstante.
		expect(EINZIGER_EIGENTUEMER.startsWith('Alle Stockwerkanteile gehören einer Person. Für die Beschlussfähigkeit nennt das Gesetz mindestens zwei Eigentümer')).toBe(true);
		expect(EINZIGER_EIGENTUEMER_KURZ.startsWith('Alle Stockwerkanteile gehören einer Person. Für die Beschlussfähigkeit nennt das Gesetz mindestens zwei Eigentümer')).toBe(true);
	});

	/*
	 * Fassung vom 13.11.2026 (Produktentscheid zu Entscheid 0048, Antwort 8; Laien-
	 * und Fachprüfung `quellen` `pruefung/berichte/2026-11-13-votum-einziger-eigentuemer.md`):
	 * der schriftliche Weg, der unabhängig von der Lehrmeinung trägt, mit dem
	 * Formvorbehalt, kurz wie lang. Fundstellen nur in der Langfassung, je Satz.
	 */
	it('nennt den schriftlichen Weg und den Formvorbehalt, die Langfassung mit Fundstellen je Satz', () => {
		for (const satz of [EINZIGER_EIGENTUEMER_KURZ, EINZIGER_EIGENTUEMER]) {
			expect(satz).toContain('Unabhängig davon gilt: Stimmen alle Eigentümer einem Antrag schriftlich zu, stellt das Gesetz das einem Beschluss gleich');
			expect(satz).toContain('Unterschreibt die Person das Protokoll eigenhändig und mit Datum, liegt diese Zustimmung vor');
			expect(satz).toMatch(/Verlangt ein Geschäft eine weitere Form, etwa die öffentliche Beurkundung, ersetzt die Unterschrift sie nicht\.$/);
		}
		expect(EINZIGER_EIGENTUEMER_KURZ).toContain('liegt diese Zustimmung vor; bewahren Sie es auf.');
		expect(EINZIGER_EIGENTUEMER).not.toContain('bewahren Sie es auf');
		expect(EINZIGER_EIGENTUEMER).toContain('mindestens zwei Eigentümer (ZGB Art. 712p Abs. 1).');
		expect(EINZIGER_EIGENTUEMER).toContain('protokolliert die Beschlüsse (Wermelinger, SVIT-Kommentar, Rz. 12 ad Art. 712p, Rz. 21a ad Art. 712m).');
		expect(EINZIGER_EIGENTUEMER).toContain('einem Beschluss gleich (ZGB Art. 66 Abs. 2 mit Art. 712m Abs. 2; BGE 127 III 506 E. 3a).');
		// Die gemeinsame Einpersonengemeinschaft bleibt, wie sie war.
		expect(EINZIGE_GEMEINSCHAFT_KURZ).not.toContain('schriftlich');
	});

	it('Entscheid 0016: gemeinsam, wenn die einzige Partei mehrere Personen sind', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', { ...allein, einzigeParteiGemeinsam: true });
		expect(b.beschlussfaehig).toBe(true);
		expect(b.einzigerGemeinsam).toBe(true);
		// Gegenrichtung: ohne das Merkmal und bei zwei Eigentümern nicht.
		expect(stelleBeschlussfaehigkeitFest('erste', allein).einzigerGemeinsam).toBe(false);
		expect(
			stelleBeschlussfaehigkeitFest('erste', {
				...allein,
				eigentuemerGesamt: 2,
				eigentuemerAnwesend: 2,
				einzigeParteiGemeinsam: true
			}).einzigerGemeinsam
		).toBe(false);
	});

	it('Entscheid 0016: der Feststellungssatz nennt die Gemeinschaft, aus dem Merkmal oder dem Aufruf', () => {
		expect(feststellungssatz(feststellung(1), true)).toBe(`Die Versammlung ist beschlussfähig. ${EINZIGE_GEMEINSCHAFT}`);
		expect(feststellungssatz({ ...feststellung(1), einzigeParteiGemeinsam: true })).toBe(
			`Die Versammlung ist beschlussfähig. ${EINZIGE_GEMEINSCHAFT}`
		);
		expect(EINZIGE_GEMEINSCHAFT).toContain('(Wermelinger, SVIT-Kommentar, Rz. 12 ad Art. 712p, Rz. 21a ad Art. 712m)');
		expect(EINZIGE_GEMEINSCHAFT).toMatch(/\(vgl\. Rz\. 19 und 20 ad Art\. 712o\)\.$/);
		expect(EINZIGE_GEMEINSCHAFT_KURZ).not.toContain('Rz.');
		expect(satzZumEinzigen(true, false)).toBe(EINZIGE_GEMEINSCHAFT_KURZ);
		expect(satzZumEinzigen(false, false)).toBe(EINZIGER_EIGENTUEMER_KURZ);
		expect(satzZumEinzigen(undefined, true)).toBe(EINZIGER_EIGENTUEMER);
		// Was die Prüfungen gestrichen haben.
		expect(EINZIGE_GEMEINSCHAFT_KURZ).not.toMatch(/sagt keine Quelle|Sicher ist es|die Anwesenden bevollmächtigt/);
	});

	it('lässt den Satz bei zwei Eigentümern und bei alten Feststellungen ohne Personenzahl weg', () => {
		expect(feststellungssatz(feststellung(2))).not.toContain(EINZIGER_EIGENTUEMER);
		expect(feststellungssatz(feststellung(null))).not.toContain(EINZIGER_EIGENTUEMER);
	});
});

/**
 * ZGB Art. 712p zählt **Stockwerkeigentümer**, nicht Stimmen.
 *
 * **Der Anlass** (26.08.2026, aus der juristischen Prüfung zu Art. 712o). Die
 * Beteiligung trug bisher nur `kopfstimmenGesamt` — und das ist bei «je Einheit»
 * die Zahl der **Einheiten**. Art. 712p Abs. 1 verlangt aber «die Hälfte aller
 * Stockwerkeigentümer … mindestens aber zwei», und Abs. 3 «ein Drittel aller
 * Stockwerkeigentümer, mindestens aber zwei». Das sind Personen.
 *
 * Die Bestimmung ist relativ zwingend: Das Reglement darf sie erschweren, nicht
 * erleichtern. Ein reglementarisches Anteilsstimmrecht verschiebt deshalb die
 * Mehrheit, nicht die Beschlussfähigkeit.
 *
 * Der Fehler wirkte in die **nachgiebige** Richtung — die gefährliche.
 */
describe('712p zählt Stockwerkeigentümer, nicht Kopfstimmen', () => {
	it('erklärt eine Versammlung mit einem einzigen Anwesenden nicht für beschlussfähig', () => {
		// Zwei Eigentümer, «je Einheit»: A hält zwei Wohnungen, B eine.
		// Kopfstimmen 3, Stockwerkeigentümer 2. Nur A erscheint.
		const b = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 2,
			eigentuemerAnwesend: 1,
			kopfstimmenGesamt: 3,
			kopfstimmenAnwesend: 2,
			gesamtquote: 1000,
			quotenAnwesend: 700
		});

		expect(b.beschlussfaehig).toBe(false);
		// «mindestens aber zwei» meint zwei Menschen. Zwei Stimmen in einer Hand
		// sind einer.
		expect(b.fehlt).toContain('Stockwerkeigentümer');
	});

	it('lässt sie zu, sobald der zweite Eigentümer da ist', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 2,
			eigentuemerAnwesend: 2,
			kopfstimmenGesamt: 3,
			kopfstimmenAnwesend: 3,
			gesamtquote: 1000,
			quotenAnwesend: 1000
		});
		expect(b.beschlussfaehig).toBe(true);
	});

	it('lässt auch die zweite Versammlung nicht mit einem Anwesenden zu', () => {
		// Ein Drittel von sechs waere zwei — die Mindestzahl greift ohnehin.
		const b = stelleBeschlussfaehigkeitFest('zweite', {
			eigentuemerGesamt: 6,
			eigentuemerAnwesend: 1,
			kopfstimmenGesamt: 9,
			kopfstimmenAnwesend: 4,
			gesamtquote: 1000,
			quotenAnwesend: 400
		});
		expect(b.beschlussfaehig).toBe(false);
	});

	it('bei «je Eigentümer» ändert sich nichts — dort sind beide Zahlen gleich', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 4,
			eigentuemerAnwesend: 2,
			kopfstimmenGesamt: 4,
			kopfstimmenAnwesend: 2,
			gesamtquote: 1000,
			quotenAnwesend: 500
		});
		expect(b.beschlussfaehig).toBe(true);
	});
});

/**
 * Eigentümer ohne Stimme sind etwas anderes als gar keine Eigentümer.
 *
 * Der Fall aus dem Code-Review vom 26.08.2026: eine Einstellhallen-Gemeinschaft
 * mit «je Einheit», lauter `parking`-Einheiten und der Einstellung, dass
 * Nebenobjekte keine Kopfstimme tragen. Zwölf Eigentümer, null Kopfstimmen.
 */
describe('Eigentümer ohne Kopfstimme', () => {
	const einstellhalle = {
		eigentuemerGesamt: 12,
		eigentuemerAnwesend: 12,
		kopfstimmenGesamt: 0,
		kopfstimmenAnwesend: 0,
		gesamtquote: 1000,
		quotenAnwesend: 1000
	};

	it('ist nicht beschlussfähig — ohne Stimme lässt sich nichts beschliessen', () => {
		expect(stelleBeschlussfaehigkeitFest('erste', einstellhalle).beschlussfaehig).toBe(false);
	});

	it('behauptet aber nicht, es gebe keine Eigentümer', () => {
		const b = stelleBeschlussfaehigkeitFest('erste', einstellhalle);
		// Der alte Satz war eine Tatsachenbehauptung, und sie stimmte nicht: Wer
		// ihn liest, sucht den Fehler in der Eigentümerliste statt in der
		// Einstellung zu den Nebenobjekten.
		expect(b.fehlt).not.toContain('keine stimmberechtigte Partei');
		expect(b.fehlt).toContain('Kopfstimme');
	});

	it('unterscheidet sich vom Fall ohne jeden Eigentümer', () => {
		const ohne = stelleBeschlussfaehigkeitFest('erste', {
			eigentuemerGesamt: 0,
			eigentuemerAnwesend: 0,
			kopfstimmenGesamt: 0,
			kopfstimmenAnwesend: 0,
			gesamtquote: 0,
			quotenAnwesend: 0
		});
		expect(ohne.fehlt).toContain('keine stimmberechtigte Partei');
	});
});
