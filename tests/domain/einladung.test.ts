/**
 * Die Sätze der Einladung (23.08.2026, Prüflauf I, B-14).
 *
 * «Die Einladung ist heute identisch mit der Traktandenliste — kein Absender,
 * keine Anrede, kein Einberufungssatz, kein Vollmachtshinweis.»
 */
import { describe, expect, it } from 'vitest';
import {
	einberufungssatz,
	gemeinschaftssatz,
	vertretungssatz,
	beschlussfaehigkeitssatz,
	zweitversammlungssatz
} from '$lib/domain/einladung';

const ABEND = {
	gemeinschaftName: 'STWEG Sonnenhof',
	art: 'ordentlich' as const,
	datum: '2026-09-15',
	uhrzeit: '19:00',
	ort: 'Restaurant Kreuz, Bern'
};

describe('einberufungssatz', () => {
	it('nennt Gemeinschaft, Datum, Uhrzeit und Ort', () => {
		const satz = einberufungssatz(ABEND);
		expect(satz).toContain('STWEG Sonnenhof');
		expect(satz).toContain('15. September 2026');
		expect(satz).toContain('19:00 Uhr');
		expect(satz).toContain('Restaurant Kreuz, Bern');
	});

	it('schliesst kleingeschrieben an die Anrede an', () => {
		// «Sehr geehrte Damen und Herren / Hiermit laden wir» wäre ein Fehler,
		// den jeder Empfänger sieht.
		expect(einberufungssatz(ABEND).startsWith('hiermit')).toBe(true);
	});

	it('unterscheidet ordentlich und ausserordentlich', () => {
		expect(einberufungssatz(ABEND)).toContain('ordentlichen Versammlung');
		expect(einberufungssatz({ ...ABEND, art: 'ausserordentlich' })).toContain(
			'ausserordentlichen Versammlung'
		);
	});
});

describe('vertretungssatz', () => {
	it('nennt die Grenze samt Fundstelle', () => {
		const satz = vertretungssatz(2, 'Reglement Ziff. 8.2');
		expect(satz).toContain('höchstens 2 Vollmachten');
		expect(satz).toContain('Reglement Ziff. 8.2');
	});

	it('setzt die Einzahl richtig', () => {
		expect(vertretungssatz(1)).toContain('höchstens 1 Vollmacht ausüben');
		expect(vertretungssatz(1)).not.toContain('Vollmachten');
	});

	it('behauptet ohne Grenze keine', () => {
		// Eine erfundene Obergrenze in der Einladung wäre eine Rechtsbehauptung
		// gegen die eigene Gemeinschaft.
		for (const ohne of [null, undefined, 0]) {
			const satz = vertretungssatz(ohne);
			expect(satz).not.toMatch(/höchstens/);
			expect(satz).toContain('schriftlich vertreten lassen');
		}
	});

	it('weist immer auf den Nachweis beim Einlass hin', () => {
		expect(vertretungssatz(3, 'Ziff. 8')).toContain('beim Einlass vorzuweisen');
		expect(vertretungssatz(null)).toContain('beim Einlass vorzuweisen');
	});
});

describe('zweitversammlungssatz', () => {
	it('erscheint nur bei der zweiten Versammlung', () => {
		// Unter einer ersten Einladung wäre das herabgesetzte Quorum schlicht
		// falsch — dort gilt die Hälfte.
		expect(zweitversammlungssatz('erste')).toBeNull();
		expect(zweitversammlungssatz('zweite')).toContain('712p Abs. 3');
	});

	it('nennt ohne eigene Regel das Gesetz', () => {
		expect(zweitversammlungssatz('zweite')).toContain('ein Drittel der Eigentümer');
		expect(zweitversammlungssatz('zweite', null)).toContain('mindestens aber zwei');
	});

	/*
	 * **Die eigene Regel schlägt das Gesetz** (Nachprüfung 23.08.2026). Am Abend
	 * rechnet die Anwendung nach der hinterlegten Regel; nennt die Einladung
	 * trotzdem das gesetzliche Drittel, widersprechen sich Papier und Rechnung —
	 * im Dokument, das im Anfechtungsfall auf dem Tisch liegt.
	 */
	it('nennt die hinterlegte Regel samt Fundstelle', () => {
		const satz = zweitversammlungssatz('zweite', {
			kopf: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			mindestens: 3,
			fundstelle: 'Reglement Ziff. 6.4'
		})!;
		expect(satz).toContain('Reglement Ziff. 6.4');
		expect(satz).toContain('die Hälfte der Eigentümer');
		expect(satz).toContain('mindestens aber drei');
		// Und nicht beides nebeneinander — ein Satz, eine Zahl.
		expect(satz).not.toContain('ein Drittel');
	});

	it('bleibt auch mit Regel bei der ersten Versammlung stumm', () => {
		expect(
			zweitversammlungssatz('erste', {
				kopf: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				mindestens: 3,
				fundstelle: 'Ziff. 6.4'
			})
		).toBeNull();
	});
});

/**
 * Der Absatz zum gemeinschaftlichen Eigentum (27.08.2026, Produktentscheid).
 *
 * **Warum hier und nicht auf der Zugangskarte.** Die Karte gehört einer Einheit
 * und wird von allen Beteiligten gelesen; sie sagt nur, was für sie gilt. Die
 * Folge der Uneinigkeit betrifft den Abend und die Auszählung und steht deshalb
 * neben dem Hinweis auf die Vertretung.
 */
describe('gemeinschaftssatz', () => {
	it('bleibt stumm, wo es keine solche Einheit gibt', () => {
		// Ein Absatz über einen Fall, den es hier nicht gibt, verlängert die
		// Einladung und wird beim nächsten Mal überlesen — samt dem daneben.
		expect(gemeinschaftssatz(false)).toBeNull();
	});

	it('nennt die eine Stimme und lässt die Leserin sich wiedererkennen', () => {
		/*
		 * **Die Beispiele sind ein Befund der Laienprüfung vom 23.09.2026.** Der
		 * Absatz nannte niemanden, nur «mehreren Personen». Die Prüferin, der
		 * mit ihrem Bruder eine Wohnung gehört, hat ihn deshalb für einen
		 * fremden Fall gehalten und übersprungen — also genau die Person, für
		 * die der ganze Absatz geschrieben ist.
		 */
		const satz = gemeinschaftssatz(true)!;
		expect(satz).toContain('ZGB Art. 712o Abs. 1');
		expect(satz).toContain('eine Stimme');
		expect(satz).toMatch(/Ehepartnern|Erben/);
	});

	it('sagt, dass die Vollmacht vermutet wird, statt sie zu erlassen', () => {
		/*
		 * **Fachprüfung 23.09.2026.** «Eine Vollmacht braucht es dafür nicht»
		 * war zu weit. Rz. 19 ad Art. 712o: Der Anwesende braucht keine
		 * **ausdrückliche** Vollmacht, weil die Abwesenden sie durch ihr
		 * Fernbleiben erteilen. Sie wird vermutet, nicht erlassen — und nach
		 * Rz. 25 können die übrigen bei falscher Ausübung Schadenersatz
		 * verlangen. Der alte Wortlaut las sich als Freibrief.
		 */
		const satz = gemeinschaftssatz(true)!;
		expect(satz).toContain('gilt dabei als bevollmächtigt');
		expect(
			/braucht es (dafür )?nicht/.test(satz),
			'der Freibrief-Wortlaut steht wieder da'
		).toBe(false);
		// Der praktische Teil bleibt: kein Papier mitbringen.
		expect(satz).toMatch(/keine schriftliche Vollmacht/);
	});

	it('spricht über die ungültige Stimme, nicht über die Enthaltung', () => {
		/*
		 * **Der Kern des Umbaus vom 23.09.2026.** Der Satz nahm den Umweg über
		 * die Enthaltung («zählt dann wie eine Enthaltung»). Der stammte aus
		 * Rz. 28 ad Art. 712o und ist unnötig: **Rz. 181 ad Art. 712m nennt die
		 * ungültige Stimme selbst** («ungültige Stimmen oder Enthaltungen
		 * fliessen in die Berechnung ein»).
		 *
		 * Und er war gefährlich, weil er dazu verleitet, die Wirkung an eine
		 * Reglementsklausel über **Enthaltungen** zu hängen. Nach Rz. 105 ad
		 * Art. 712g deckt eine solche Klausel die ungültige Stimme nicht mit
		 * hinreichender Deutlichkeit ab; für sie bleibt es beim dispositiven
		 * Recht. Ein Entwurf hat genau das gebaut, die Fachprüfung hat es
		 * verworfen.
		 *
		 * Die Probe hält den Umweg fern, nicht nur das Ergebnis.
		 */
		const satz = gemeinschaftssatz(true)!;
		expect(satz).toContain('uneinig');
		expect(satz).toContain('ungültig');
		expect(satz).toContain('bleibt dann in der Berechnung');
		expect(satz).toContain('wirkt wie ein Nein');
		expect(
			satz.includes('Enthaltung'),
			'der Umweg über die Enthaltung ist zurück; Rz. 181 nennt die ungültige Stimme selbst'
		).toBe(false);
	});

	it('trägt den Reglementsvorbehalt, den die Hausregel verlangt', () => {
		/*
		 * **`themen/stockwerkeigentum/fragen.md`, Frage 35, Hausregel vom
		 * 15.09.2026:** Rz. 181 markiert die Aussage selbst als «nicht
		 * unumstritten», und «wer sie anfasst, darf den Vorbehalt nicht
		 * weglassen». Ein Entwurf vom 23.09.2026 hat ihn weggelassen, weil die
		 * Fallunterscheidung ihn zu ersetzen schien. Sie ersetzte ihn nicht:
		 * Sie ging vom **Datenstand** aus, nicht vom Reglement, und wo eine
		 * Abweichung nie erfasst wurde, stand die gesetzliche Aussage
		 * unbedingt im gedruckten Brief.
		 */
		expect(gemeinschaftssatz(true)!).toContain('sofern Ihr Reglement nichts anderes bestimmt');
	});

	it('nennt den Ausweg, statt nur das Unglück zu beschreiben', () => {
		/*
		 * **Der zweitschwerste Befund der Laienprüfung.** Der Absatz lehrte
		 * eine Taktik, die er nicht aussprach: «Wer allein hingeht, entscheidet
		 * allein. Wer zu zweit hingeht und streitet, verliert die Stimme ganz.»
		 * Der einzige erkennbare Ausweg war, das Erscheinen des Miteigentümers
		 * zu verhindern. Dazu darf eine Einladung nicht anleiten.
		 *
		 * Belegt ist der Gegensatz in **Rz. 18a ad Art. 712o**: «Ansonsten
		 * räumt der Vorsitzende den Anwesenden eine kurze Zeit ein, damit sie
		 * den Vertreter bestimmen.» Die Einladung ist der einzige Moment, in
		 * dem beide Miteigentümer den Hinweis **vor** der Abstimmung lesen.
		 */
		const satz = gemeinschaftssatz(true)!;
		expect(satz).toMatch(/Klären Sie .*vor der Versammlung/);
		expect(satz).toContain('wer die Stimme abgibt');
		expect(satz, 'ohne die knappe Zeit wirkt der Rat unverbindlich').toMatch(/nur kurz Zeit/);
	});

	it('spricht nicht von «mehreren», wo zwei gemeint sind', () => {
		// Laienprüfung: «mehrere» heisst für mich drei oder mehr. Die Prüferin
		// hält mit ihrem Bruder eine Wohnung und hat den Absatz deshalb für
		// einen fremden Fall gehalten.
		const satz = gemeinschaftssatz(true)!;
		expect(satz).toContain('zwei oder mehr');
		expect(
			/Kommen mehrere/.test(satz),
			'die missverständliche Fassung ist zurück'
		).toBe(false);
	});

	it('bleibt in Sätzen unter der Schranke des Textwächters', () => {
		/*
		 * `check:texte` misst 180 Zeichen je Satz. Der Wächter selbst erreicht
		 * diesen Absatz nicht (seine vier Bauformen sind Fehler, Feldform,
		 * `error()` und Abschnittslisten), diese Probe ist also der einzige.
		 *
		 * **Getrennt wird nur vor einem Grossbuchstaben** (Code-Review
		 * 23.09.2026). Der frühere Split `/(?<=\.)\s+/` zerlegte auch an
		 * «Art. » und «Abs. » und mass den ersten Satz in drei Bruchstücken
		 * statt als ganze 130 Zeichen. Heute ohne Folge, aber die Probe verlöre ihre Aussage
		 * genau dort, wo sie gebraucht wird: bei einem langen Satz mit einer
		 * Abkürzung.
		 */
		const saetze = gemeinschaftssatz(true)!.split(/(?<=\.)\s+(?=[A-ZÄÖÜ])/);
		expect(saetze.length, 'der Split trennt gar nicht mehr').toBeGreaterThan(4);
		for (const teil of saetze) {
			expect(teil.length, teil).toBeLessThanOrEqual(180);
		}
	});
});

describe('beschlussfaehigkeitssatz', () => {
	const REGEL = {
		kopf: { zaehler: 1, nenner: 2, art: 'mindestens' as const },
		// Eine erste Regel ohne Quotenbedingung lässt `pruefeErschwerung` gar
		// nicht zu — die Probe muss den echten Fall abbilden.
		quoten: { zaehler: 1, nenner: 2, art: 'mindestens' as const },
		mindestens: 3,
		fundstelle: '§ 8 des Reglements'
	};

	/*
	 * **Der Anlass** (Befund 25): «Das Einladungs-PDF nennt § 8 nicht — ein
	 * Eigentümer erfährt nicht, dass ohne drei Anwesende gar nicht beschlossen
	 * werden kann, der beste Grund zu kommen.» Bis dahin stand ein Satz dazu
	 * nur auf der zweiten Versammlung.
	 */
	it('nennt bei der ersten Versammlung die hinterlegte Regel samt Fundstelle', () => {
		const satz = beschlussfaehigkeitssatz('erste', REGEL);
		expect(satz).toContain('§ 8 des Reglements');
		expect(satz).toContain('mindestens aber drei');
		// Und den Grund, warum die Zahl den Empfänger angeht.
		expect(satz).toMatch(/Ihre Teilnahme zählt/);
	});

	/*
	 * **Beide Bedingungen** (Code-Review 07.09.2026). Bei der ersten Versammlung
	 * gilt neben dem Kopfanteil immer eine Wertquotenbedingung. Die erste
	 * Fassung nannte nur die Köpfe — die Einladung hätte ein niedrigeres Quorum
	 * behauptet, als am Abend gerechnet wird.
	 */
	it('nennt auch die Wertquotenbedingung', () => {
		expect(beschlussfaehigkeitssatz('erste', REGEL)).toContain('Wertquoten');
	});

	/*
	 * **Ohne hinterlegte Regel gilt das Gesetz, und der Satz sagt es.** Er
	 * schwieg in der ersten Fassung, mit der Begründung, die Anwendung rechne
	 * nach dem Hinterlegten. `stelleBeschlussfaehigkeitFest` nimmt aber
	 * `regel ?? GESETZLICH[art]` — der Befund wäre für die Mehrheit der
	 * Gemeinschaften offen geblieben.
	 */
	it('nennt ohne hinterlegte Regel die gesetzliche Schwelle', () => {
		for (const satz of [beschlussfaehigkeitssatz('erste'), beschlussfaehigkeitssatz('erste', null)]) {
			expect(satz).toContain('ZGB Art. 712p Abs. 1');
			expect(satz).toContain('die Hälfte der Eigentümer');
			expect(satz).toContain('mindestens aber zwei');
			expect(satz).toContain('die Hälfte der Wertquoten');
		}
	});

	it('bleibt bei der zweiten Versammlung der bisherige Satz', () => {
		// Der Wortlaut der Zweitversammlung ist unverändert; die Probe hält ihn
		// hier fest, seit `zweitversammlungssatz` nicht mehr exportiert ist.
		expect(beschlussfaehigkeitssatz('zweite')).toContain('712p Abs. 3');
		expect(beschlussfaehigkeitssatz('zweite')).toContain('ein Drittel der Eigentümer');
		expect(beschlussfaehigkeitssatz('zweite', REGEL)).toContain('§ 8 des Reglements');
	});
});
