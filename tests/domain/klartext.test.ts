/**
 * Klartext — die Fachbegriffe in Alltagssprache.
 *
 * Geprüft wird nicht der Wortlaut, sondern die **Bauart**: dass jede Auswahl
 * einen Eintrag hat, dass der Fachbegriff erhalten bleibt und dass die Antwort
 * kurz ist. Das Letzte ist die eigentliche Regel — «Auf Papier.» beantwortet
 * die Frage, «Unterschriftenliste auf Papier, Stimmen erfasst durch die
 * Sitzungsleitung» beantwortet sie auch, aber niemand liest sie zu Ende.
 *
 * Ohne diesen Wächter wandert der Erklärsatz beim nächsten Nachbessern wieder
 * in die Antwort zurück. Genau so ist die Versammlungsseite entstanden.
 */
import { describe, expect, it } from 'vitest';
import {
	abendabweichung,
	abendzugehoerigkeit,
	abstimmungsweise,
	beschriftung,
	versammlungsart,
	versammlungsstufe,
	type Klartextangabe
} from '$lib/domain/klartext';
import type { Beschlussfaehigkeitsregel } from '$lib/domain/beschlussfaehigkeit';

/** Alle Einträge, damit die Regeln auf jeden einzelnen laufen. */
const ALLE: { name: string; angabe: Klartextangabe }[] = [
	{ name: 'einfach', angabe: abstimmungsweise('einfach') },
	{ name: 'geführt', angabe: abstimmungsweise('gefuehrt') },
	{ name: 'ordentlich', angabe: versammlungsart('ordentlich') },
	{ name: 'ausserordentlich', angabe: versammlungsart('ausserordentlich') },
	{ name: 'erste', angabe: versammlungsstufe('erste') },
	{ name: 'zweite', angabe: versammlungsstufe('zweite') },
	{ name: 'ohne Abend', angabe: abendzugehoerigkeit(null) },
	{ name: 'mit Abend', angabe: abendzugehoerigkeit('Abend im Löwen') }
];

describe('Klartext: die Bauart jedes Eintrags', () => {
	it('fragt in der Überschrift, statt ein Substantiv hinzustellen', () => {
		for (const { name, angabe } of ALLE) {
			expect(angabe.frage, name).toMatch(/\?$/);
		}
	});

	it('antwortet in einem kurzen Satz', () => {
		for (const { name, angabe } of ALLE) {
			expect(angabe.antwort.length, `${name}: «${angabe.antwort}»`).toBeLessThanOrEqual(60);
			expect(angabe.antwort, name).toMatch(/[.!]$/);
		}
	});

	it('hält Paragraphen aus der Antwort heraus', () => {
		// Die Fundstelle gehört in die Erklärung. In der Antwort schlägt sie den
		// Leser in die Flucht, den sie überzeugen sollte.
		for (const { name, angabe } of ALLE) {
			expect(angabe.antwort, name).not.toMatch(/Art\.|Abs\.|ZGB/);
			expect(angabe.zusatz, name).not.toMatch(/Art\.|Abs\.|ZGB/);
		}
	});

	it('hält auch den Zusatz kurz', () => {
		for (const { name, angabe } of ALLE) {
			expect(angabe.zusatz.length, `${name}: «${angabe.zusatz}»`).toBeLessThanOrEqual(90);
		}
	});

	it('bewahrt den Fachbegriff, statt ihn zu ersetzen', () => {
		for (const { name, angabe } of ALLE) {
			expect(angabe.fachwort.length, name).toBeGreaterThan(0);
		}
	});

	it('gibt die Beschriftung ohne Satzzeichen', () => {
		// `kurz` steht hinter einem Auswahlknopf und auf Knöpfen. Ein Punkt dort
		// sieht aus wie ein Versehen.
		for (const { name, angabe } of ALLE) {
			expect(angabe.kurz, name).not.toMatch(/[.!?]$/);
		}
	});

	it('erklärt ausführlich, wo die Erklärung zugeklappt wartet', () => {
		// Umgekehrte Richtung: Die Erklärung darf lang sein — sie muss es sogar,
		// sonst wäre das Aufklappen umsonst.
		for (const { name, angabe } of ALLE) {
			expect(angabe.erklaerung.length, name).toBeGreaterThan(60);
		}
	});
});

describe('Klartext: was die Sätze sagen', () => {
	it('unterscheidet Papier und eigenes Gerät', () => {
		expect(abstimmungsweise('einfach').antwort).toBe('Auf Papier.');
		expect(abstimmungsweise('gefuehrt').antwort).toContain('Handy');
	});

	it('nennt beim gemeinsamen Abend dessen Bezeichnung', () => {
		expect(abendzugehoerigkeit('Abend im Löwen').antwort).toContain('Abend im Löwen');
		expect(abendzugehoerigkeit(null).antwort).toBe('Nein, sie ist allein.');
	});

	it('sagt beim gemeinsamen Abend, dass Tag und Ort geteilt werden', () => {
		// Gemeldet am 11.08.2026: «Datum und Ort wird ja geteilt, das ist der Sinn
		// vom Ganzen.» Vorher stand hier das Gegenteil.
		const mit = abendzugehoerigkeit('Abend im Löwen');
		expect(mit.zusatz).toContain('selben Tag');
		expect(mit.zusatz).toContain('selben Ort');
		expect(mit.erklaerung).not.toContain('bleiben bei jeder Versammlung für sich');
		// Getrennt bleibt das Rechtliche — auch das muss dastehen.
		expect(mit.erklaerung).toContain('Beschlussfähigkeit');
	});

	it('nennt die Fundstelle für die Beschlussfähigkeit in der Erklärung', () => {
		// Sie darf nicht verschwinden: Wer die Schwelle bestreitet, will sie sehen.
		expect(versammlungsstufe('erste').erklaerung).toContain('712p');
		expect(versammlungsstufe('zweite').erklaerung).toContain('712p');
	});
});

describe('Klartext: Versammlung gegen gemeinsamen Abend', () => {
	const abend = { datum: '2026-05-19', ort: 'Halle der Proben, Nirgendheim' };

	it('schweigt ohne Abend', () => {
		expect(abendabweichung({ datum: '2026-09-05', ort: 'Saal' }, null)).toBeNull();
	});

	it('schweigt, wenn Tag und Ort übereinstimmen', () => {
		expect(abendabweichung({ ...abend }, abend)).toBeNull();
	});

	it('übersieht keinen anderen Tag', () => {
		const m = abendabweichung({ datum: '2026-09-05', ort: abend.ort }, abend);
		expect(m).toContain('Der Tag');
		expect(m).toContain('19.05.2026');
		expect(m).toContain('weicht');
	});

	it('übersieht keinen anderen Ort', () => {
		const m = abendabweichung({ datum: abend.datum, ort: 'Gemeindesaal' }, abend);
		expect(m).toContain('Der Ort');
		expect(m).toContain('Halle der Proben');
	});

	it('nennt beides, wenn beides abweicht', () => {
		const m = abendabweichung({ datum: '2026-09-05', ort: 'Gemeindesaal' }, abend);
		expect(m).toContain('Der Tag');
		expect(m).toContain('der Ort');
		expect(m).toContain('weichen');
	});

	/*
	 * Die Abstimmungsweise ist hart (`docs/vererbung-abend.md`) — aber der
	 * Umschalter am freigegebenen Haus bleibt als Notweg. Läuft es auseinander,
	 * folgen Einlass, Tafel und Stimmerfassung im selben Saal zwei Verfahren.
	 */
	it('nennt eine abweichende Abstimmungsweise', () => {
		const m = abendabweichung(
			{ datum: abend.datum, ort: abend.ort, betriebsart: 'einfach' },
			{ ...abend, betriebsart: 'gefuehrt' }
		);
		expect(m).toContain('Abstimmungsweise');
		expect(m).toContain('Am eigenen Handy');
	});

	it('schweigt, wenn die Abstimmungsweise übereinstimmt', () => {
		expect(
			abendabweichung(
				{ datum: abend.datum, ort: abend.ort, betriebsart: 'einfach' },
				{ ...abend, betriebsart: 'einfach' }
			)
		).toBeNull();
	});

	/*
	 * Und sie schweigt, wenn der Aufrufer sie gar nicht mitgibt: Nicht jede
	 * Stelle kennt beide Werte, und «unbekannt» ist keine Abweichung.
	 */
	it('schweigt, wenn keine Abstimmungsweise mitkommt', () => {
		expect(abendabweichung({ datum: abend.datum, ort: abend.ort }, abend)).toBeNull();
	});

	it('stört sich nicht an Leerzeichen am Rand', () => {
		// Ein nachgestelltes Leerzeichen im Ort ist keine Abweichung, sondern ein
		// Tippfehler — und eine Warnung, die sich nicht abstellen lässt, wird
		// übersehen wie jede andere.
		expect(abendabweichung({ datum: abend.datum, ort: ' Halle der Proben, Nirgendheim ' }, abend)).toBeNull();
	});

	// Die Uhrzeit steht bewusst in keinem Fall: Die Funktion nimmt sie gar nicht
	// entgegen, weil an einem Abend nacheinander getagt wird. Ein Test, der ihr
	// dieselben Werte zweimal vorlegt, prüfte nur sich selbst.
});

describe('Klartext: was das Reglement daran ändert', () => {
	const strenger: Beschlussfaehigkeitsregel = {
		kopf: { zaehler: 1, nenner: 2, art: 'mindestens' },
		quoten: null,
		mindestens: 2,
		fundstelle: 'Art. 14 Abs. 2 Reglement'
	};

	it('nennt ohne Regel die gesetzliche Schwelle', () => {
		expect(versammlungsstufe('zweite').zusatz).toBe('Hier genügt ein Drittel.');
	});

	it('nennt mit Regel die Schwelle des Reglements', () => {
		// Der springende Punkt: «Hier genügt ein Drittel» wäre bei dieser
		// Gemeinschaft schlicht falsch.
		const mit = versammlungsstufe('zweite', strenger);
		expect(mit.zusatz).toBe('Ihr Reglement verlangt die Hälfte.');
		expect(mit.zusatz).not.toContain('Drittel');
	});

	it('nimmt die Anteilsbedingung mit, wo das Reglement eine setzt', () => {
		const mitQuoten = versammlungsstufe('zweite', {
			...strenger,
			quoten: { zaehler: 2, nenner: 3, art: 'mindestens' }
		});
		expect(mitQuoten.zusatz).toBe('Ihr Reglement verlangt die Hälfte, dazu zwei Drittel der Anteile.');
	});

	it('hält die Fundstelle in der Erklärung fest', () => {
		const mit = versammlungsstufe('zweite', strenger);
		expect(mit.erklaerung).toContain('Art. 14 Abs. 2 Reglement');
		// Das Gesetz bleibt daneben stehen — die Regel darf nur erschweren, und
		// wer das prüfen will, braucht beide Zahlen.
		expect(mit.erklaerung).toContain('712p');
	});

	it('lässt die Beschriftung unangetastet', () => {
		// Der Fachbegriff hängt nicht am Reglement.
		expect(beschriftung(versammlungsstufe('zweite', strenger))).toBe(
			'Das zweite Treffen (Zweitversammlung)'
		);
	});

	it('trägt den Fachbegriff in der Beschriftung mit', () => {
		// Gemeldet am 11.08.2026: Der Klartext allein verliert die Terminologie,
		// die im Protokoll und im Gesetz steht.
		expect(beschriftung(versammlungsart('ordentlich'))).toBe('Die jährliche Versammlung (ordentlich)');
		expect(beschriftung(versammlungsart('ausserordentlich'))).toContain('ausserordentlich');
		expect(beschriftung(versammlungsstufe('erste'))).toBe('Das erste Treffen (Erstversammlung)');
		expect(beschriftung(versammlungsstufe('zweite'))).toBe('Das zweite Treffen (Zweitversammlung)');
		expect(beschriftung(abstimmungsweise('einfach'))).toBe('Auf Papier (einfach)');
	});

	it('fällt bei unbekannter Eingabe auf den Regelfall zurück', () => {
		// Ein neuer Wert in der Datenbank darf keine leere Karte erzeugen.
		expect(abstimmungsweise('papierlos' as never).antwort).toBe('Auf Papier.');
		expect(versammlungsart('sonstige' as never).antwort).toContain('jährliche');
		expect(versammlungsstufe('dritte' as never).antwort).toContain('erste');
	});
});
