import { describe, expect, it } from 'vitest';
import {
	ANFECHTUNGSHINWEIS,
	einenZurueck,
	basisbezeichnung,
	bezeichnungMitBasis,
	erfordernisAus,
	erfordernisSteht,
	ergebniskarte,
	laufe,
	setzeErfordernis,
	uebersteuere,
	umstrittenSatz,
	urheberschaft,
	waehleErfordernis,
	waehlbareBasen,
	WAEHLBARE_TYPEN,
	zahlenbeispiel,
	type Kennzahlen
} from '$lib/domain/entscheidbaum';
import { knotenVon, typdefinition, UMSTRITTEN_SATZ } from '$lib/domain/regelwerk';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { holeRegelwerk, knotenFuerUmstritten } from '$lib/rules';
import { herleitung, mehrheitGesetzt } from '$lib/domain/auszaehlung';

const RW = holeRegelwerk();

/** Die echten Zahlen einer erfundenen, aber vollständigen Gemeinschaft. */
const ZAHLEN: Kennzahlen = { kopfstimmen: 20, gesamtquote: 1000, anwesend: 15, zaehlweise: 'per_owner' };

/** Läuft den Baum bis zum Ergebnis und gibt den Knoten zurück. */
function bis(astId: string, ...antworten: string[]) {
	const lauf = laufe(RW, astId, antworten);
	if (lauf.stand.art !== 'ergebnis') {
		throw new Error(`Der Lauf endete bei der Frage «${lauf.stand.frage.id}», nicht bei einem Ergebnis.`);
	}
	return lauf;
}

describe('Ersatz der defekten Heizung durch Gleichwertiges', () => {
	const lauf = bis('a-bauen', 'f1-0-nein', 'f1-1-ja');

	it('endet beim einfachen Mehr nach ZGB Art. 647c', () => {
		expect(lauf.stand.art).toBe('ergebnis');
		if (lauf.stand.art !== 'ergebnis') return;
		expect(lauf.stand.knoten.typ).toBe('einfaches_mehr');
		expect(lauf.stand.knoten.rechtsgrundlage).toBe('ZGB Art. 647c');
	});

	it('nennt den Anspruch jedes Einzelnen auf die notwendige Massnahme', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!, ZAHLEN);
		expect(karte.hinweise.join()).toMatch(/Anspruch/);
	});

	it('rechnet das Zahlenbeispiel auf die 15 Erschienenen', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!, ZAHLEN);
		// floor(15/2)+1 = 8. Die 20 Eigentümer spielen hier keine Rolle.
		expect(karte.zahlenbeispiel).toBe('Bei 15 anwesenden oder vertretenen Eigentümern: nötig sind 8 Ja-Stimmen.');
	});
});

describe('Heizungsersatz mit Systemwechsel auf eine Wärmepumpe', () => {
	const lauf = bis('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-ja');

	it('endet beim qualifizierten Mehr nach ZGB Art. 647d Abs. 1, mit der Zustimmung der Betroffenen aus Abs. 2', () => {
		if (lauf.stand.art !== 'ergebnis') throw new Error('kein Ergebnis');
		expect(lauf.stand.knoten.typ).toBe('qualifiziertes_mehr');
		expect(lauf.stand.knoten.rechtsgrundlage).toBe('ZGB Art. 647d Abs. 1 bis 3');
		expect(lauf.stand.knoten.zustimmungBetroffenerNoetig).toBe(true);
	});

	it('zeigt die beiden Schranken nach Abs. 2 und Abs. 3 als Hinweis', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-nuetzlich')!, ZAHLEN);
		expect(karte.hinweise.join()).toMatch(/Abs\. 2/);
		expect(karte.hinweise.join()).toMatch(/Abs\. 3/);
	});

	it('verlangt beides: 8 Köpfe und 501 Wertquoten', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-nuetzlich')!, ZAHLEN);
		expect(karte.zahlenbeispiel).toBe(
			'Bei 15 anwesenden oder vertretenen Eigentümern: nötig sind 8 Ja-Stimmen und zugleich mindestens 501 von 1000 Wertquoten.'
		);
	});

	it('erklärt, dass der Wortlaut anders lautet als die angewandte Rechtsprechung', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-nuetzlich')!, ZAHLEN);
		expect(karte.wortlautHinweis).toMatch(/BGE 144 III 510/);
	});
});

describe('der Grenzfall', () => {
	const lauf = bis('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-unsicher');

	it('setzt kein Erfordernis', () => {
		const e = erfordernisAus(RW, lauf);
		expect(e.typ).toBe('grenzfall');
		expect(erfordernisSteht(e)).toBe(false);
	});

	it('erklärt, warum keine belastbare Antwort möglich ist, und empfiehlt das strengere', () => {
		if (lauf.stand.art !== 'ergebnis') throw new Error('kein Ergebnis');
		const karte = ergebniskarte(RW, lauf.stand.knoten, ZAHLEN);
		expect(karte.begruendung).toMatch(/Bundesgericht/);
		expect(karte.empfehlung).toMatch(/strengere/);
	});

	it('rechnet kein Zahlenbeispiel, weil es nichts zu rechnen gibt', () => {
		// Zahlen unter einem Grenzfall sähen aus wie ein Erfordernis.
		expect(zahlenbeispiel(knotenVon(RW, 'k-grenzfall-nuetzlich')!, ZAHLEN)).toBeNull();
	});
});

describe('Zahlenbeispiel', () => {
	it('nimmt bei der Einstimmigkeit alle Eigentümer, nicht die Erschienenen', () => {
		const text = zahlenbeispiel(knotenVon(RW, 'k-zweckbestimmung')!, ZAHLEN);
		expect(text).toMatch(/Bei 20 Eigentümern/);
		expect(text).toMatch(/20 Ja-Stimmen/);
		expect(text).toMatch(/Fehlen 5 Stimmen, fehlt an der Versammlung die Zustimmung aller/);
	});

	it('nimmt bei der Ausschlussklage alle ausser dem Betroffenen', () => {
		// 20 Eigentümer, einer betroffen → Basis 19 → floor(19/2)+1 = 10.
		const text = zahlenbeispiel(knotenVon(RW, 'k-ausschlussklage')!, ZAHLEN);
		expect(text).toMatch(/Basis 19/);
		expect(text).toMatch(/10 Ja-Stimmen/);
		expect(text).toMatch(/unabhängig davon, wer erscheint/);
	});

	it('rechnet mit zehn Eigentümern und einem Betroffenen fünf Ja-Stimmen', () => {
		// Der Fall aus dem Prüfbericht, wörtlich.
		const text = zahlenbeispiel(knotenVon(RW, 'k-ausschlussklage')!, {
			kopfstimmen: 10,
			gesamtquote: 1000,
			zaehlweise: 'per_owner'
		});
		expect(text).toMatch(/Basis 9/);
		expect(text).toMatch(/5 Ja-Stimmen/);
	});

	it('sagt offen, wenn die Anwesenheit noch nicht feststeht', () => {
		const text = zahlenbeispiel(knotenVon(RW, 'k-baulich-notwendig')!, {
			kopfstimmen: 20,
			gesamtquote: 1000,
			zaehlweise: 'per_owner'
		});
		expect(text).toMatch(/wenn alle erschienen oder vertreten sind/);
	});

	it('sagt bei der Zählung je Einheit «Stimmen» statt «Eigentümer»', () => {
		// Eine Gemeinschaft mit 14 Eigentümern kann 20 Stimmen haben. «Bei 20
		// Eigentümern» wäre dort schlicht falsch — und die Zahl, mit der im Saal
		// gerechnet wird, stünde neben einem Wort, das etwas anderes zählt.
		const text = zahlenbeispiel(knotenVon(RW, 'k-baulich-notwendig')!, {
			kopfstimmen: 20,
			gesamtquote: 1000,
			anwesend: 15,
			zaehlweise: 'per_unit'
		});
		expect(text).toBe('Bei 15 anwesenden oder vertretenen Stimmen: nötig sind 8 Ja-Stimmen.');
	});

	it('schweigt bei der Kenntnisnahme', () => {
		expect(zahlenbeispiel(knotenVon(RW, 'k-kenntnisnahme')!, ZAHLEN)).toBeNull();
	});

	it('schweigt, solange keine Eigentümer erfasst sind', () => {
		// Eine leere Gemeinschaft ergäbe «nötig sind 0 Ja-Stimmen» — richtig
		// gerechnet und trotzdem irreführend.
		expect(zahlenbeispiel(knotenVon(RW, 'k-baulich-notwendig')!, { kopfstimmen: 0, gesamtquote: 0, zaehlweise: 'per_owner' })).toBeNull();
	});
});

describe('laufe', () => {
	it('bleibt bei der Frage stehen, solange nicht geantwortet ist', () => {
		const lauf = laufe(RW, 'a-bauen');
		expect(lauf.stand.art).toBe('frage');
		if (lauf.stand.art !== 'frage') return;
		expect(lauf.stand.frage.id).toBe('f1-0');
	});

	it('führt beim Ast ohne Rückfrage sofort zum Ergebnis', () => {
		const lauf = laufe(RW, 'a-kenntnisnahme');
		expect(lauf.stand.art).toBe('ergebnis');
	});

	it('weist eine Antwort ab, die nicht zur erreichten Frage gehört', () => {
		// Sonst liesse sich über die Adresszeile ein Ergebnis zusammenstellen,
		// das der Baum nie hergibt.
		expect(() => laufe(RW, 'a-bauen', ['f5-1-zweck'])).toThrow(FachlicherFehler);
		expect(() => laufe(RW, 'a-bauen', ['f5-1-zweck'])).toThrow(/gehört nicht zur Frage/);
	});

	it('weist überzählige Antworten ab', () => {
		expect(() => laufe(RW, 'a-bauen', ['f1-0-ja', 'f1-1-ja'])).toThrow(/mehr Antworten/);
	});

	it('weist einen unbekannten Einstieg ab', () => {
		expect(() => laufe(RW, 'a-gibt-es-nicht')).toThrow(/unbekannt/);
	});

	it('merkt sich den Weg mit Frage- und Antworttext', () => {
		const lauf = bis('a-bauen', 'f1-0-nein', 'f1-1-ja');
		expect(lauf.schritte).toHaveLength(2);
		expect(lauf.schritte[1].frageText).toMatch(/erhalten/);
		expect(lauf.schritte[1].antwortText).toMatch(/Ja/);
	});

	it('geht einen Schritt zurück, indem der Pfad gekürzt wird', () => {
		const pfad = ['f1-0-nein', 'f1-1-nein', 'f1-2-ja'];
		const lauf = laufe(RW, 'a-bauen', einenZurueck(pfad));
		expect(lauf.stand.art).toBe('frage');
		if (lauf.stand.art !== 'frage') return;
		expect(lauf.stand.frage.id).toBe('f1-2');
	});

	it('führt die Verwendung des Erneuerungsfonds in den Bau-Ast zurück', () => {
		// Eine Heizungssanierung wird nicht dadurch einfacher, dass sie aus dem
		// Fonds bezahlt wird. Seit der Fassung 2026-08-15 an den Anfang des Astes
		// (f1-0 statt f1-1, Befund B-18): Vorher wechselte eine Kleinreparatur aus
		// Fondsmitteln still die Geschäftsart — und damit den Reglements-Anker.
		const lauf = laufe(RW, 'a-geld', ['f4-1-verwendung']);
		expect(lauf.stand.art).toBe('frage');
		if (lauf.stand.art !== 'frage') return;
		expect(lauf.stand.frage.id).toBe('f1-0');
	});
});

describe('erfordernisAus', () => {
	it('gibt ein geschlossenes Wertobjekt mit Fassung, Pfad und Ergebnis zurück', () => {
		const e = erfordernisAus(RW, bis('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-ja'));
		expect(e.fassung).toBe(RW.fassung);
		expect(e.knotenId).toBe('k-baulich-nuetzlich');
		expect(e.typ).toBe('qualifiziertes_mehr');
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.quotenbasis).toBe('alle_quoten');
		expect(e.quelle).toBe('hergeleitet');
		expect(e.pfad.map((s) => s.antwortId)).toEqual(['f1-0-nein', 'f1-1-nein', 'f1-2-ja']);
	});

	it('übersteht das Serialisieren unverändert', () => {
		// Es wird als JSON am Traktandum gespeichert und Jahre später gelesen.
		const e = erfordernisAus(RW, bis('a-grundordnung', 'f6-1-wertquoten'));
		expect(JSON.parse(JSON.stringify(e))).toEqual(e);
	});

	it('verweigert die Auskunft, solange der Baum nicht zu Ende beantwortet ist', () => {
		expect(() => erfordernisAus(RW, laufe(RW, 'a-bauen'))).toThrow(/noch nicht zu Ende/);
	});

	it('trägt die fehlende juristische Freigabe mit', () => {
		const e = erfordernisAus(RW, bis('a-bauen', 'f1-0-ja'));
		expect(e.juristischGegengelesen).toBe(false);
	});
});

describe('die Ergebniskarte', () => {
	it('nennt den Vorschlag an die Sitzungsleitung, nicht mehr eine ausstehende Gegenlesung', () => {
		/*
		 * Entscheid 0052 (16.11.2026): Das Datenfeld bleibt, wie es ist, denn
		 * gegengelesen hat niemand; seit der Fassung 2026-11-19 sagt der Vermerk
		 * aber nicht mehr, die Gegenlesung stehe aus.
		 */
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!, ZAHLEN);
		expect(karte.ohneJuristischeFreigabe).toBe(true);
		expect(karte.freigabevermerk).not.toMatch(/Gegenlesung steht aus/);
		expect(karte.freigabevermerk).toMatch(/Jedes Ergebnis ist ein Vorschlag an die Sitzungsleitung/);
	});

	it('trägt den Reglementsvorbehalt und den Hinweis auf gemischte Geschäfte', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!, ZAHLEN);
		expect(karte.reglementsvorbehalt).toMatch(/Reglement/);
		expect(karte.gemischteGeschaefte).toMatch(/strengere/);
	});

	it('schweigt zur Bezugsgrösse, wo sie dem Regelfall entspricht', () => {
		expect(ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!).bezugsgroesse).toBeNull();
	});

	it('erklärt die Bezugsgrösse, wo sie abweicht', () => {
		expect(ergebniskarte(RW, knotenVon(RW, 'k-ausschlussklage')!).bezugsgroesse).toMatch(/ohne den Beklagten/);
	});

	it('nennt bei zustimmungspflichtigen Beschlüssen, wer als betroffen gilt', () => {
		const karte = ergebniskarte(RW, knotenVon(RW, 'k-wertquoten-aendern')!);
		expect(karte.betroffeneErlaeuterung).toMatch(/deren Wertquote sich ändert/);
	});

	it('lässt die Erläuterung weg, wo keine Zustimmung nötig ist', () => {
		expect(ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!).betroffeneErlaeuterung).toBeNull();
	});

	/*
	 * **Die Karte muss dieselbe Form nennen wie die Rechnung** (25.09.2026,
	 * Auftrag A1, N7). Der Schlusssatz unter der Betroffenen-Erläuterung hängt
	 * daran: bei den Nutzungsrechten gehört die Zustimmung zur Annahme, bei den
	 * Wertquoten kommt sie mit der Abänderungsurkunde.
	 */
	it('trägt an beiden Knoten mit Zustimmungspflicht die richtige Form', () => {
		const neu = holeRegelwerk('2026-09-28');
		expect(
			ergebniskarte(neu, knotenVon(neu, 'k-nutzungsrecht-zuteilung')!).betroffenenzustimmung
		).toBe('im_saal_oder_vorab');
		expect(
			ergebniskarte(neu, knotenVon(neu, 'k-wertquoten-aendern')!).betroffenenzustimmung
		).toBe('nachher');
	});

	it('ordnet auch einer Vorfassung die Form über die Kennung zu', () => {
		// Die Fassung 2026-09-27 trägt das Feld nicht; die Karte darf darum
		// nicht einfach `null` sagen.
		const alt = holeRegelwerk('2026-09-27');
		expect(
			ergebniskarte(alt, knotenVon(alt, 'k-nutzungsrecht-zuteilung')!).betroffenenzustimmung
		).toBe('im_saal_oder_vorab');
		expect(
			ergebniskarte(alt, knotenVon(alt, 'k-wertquoten-aendern')!).betroffenenzustimmung
		).toBe('nachher');
	});

	it('sagt null, wo keine Zustimmung verlangt ist', () => {
		expect(
			ergebniskarte(RW, knotenVon(RW, 'k-baulich-notwendig')!).betroffenenzustimmung
		).toBeNull();
	});

	/*
	 * **Die gesetzliche Karte muss die Bezugsgrössen nennen** (Code-Review
	 * 06.09.2026).
	 *
	 * Beim Herauslösen in eigene Felder verlor die Prüfmenge genau diese
	 * Zusicherung: Der alte Test las sie über `stimmwirkungsteile`, der neue
	 * prüfte die reine Funktion und den Reglementszweig. Gäbe `ergebniskarte`
	 * hier dauerhaft `null` zurück, bliebe alles grün, während auf jeder
	 * gesetzlichen Karte der Satz zur Bezugsgrösse verschwindet — Befund B-22
	 * vom 23.08.2026 in seiner ursprünglichen Form.
	 */
	it('nennt auf jeder Karte mit Erfordernis die Bezugsgrösse', () => {
		for (const knoten of RW.knoten) {
			const karte = ergebniskarte(RW, knoten);
			if (knoten.typ === 'keine_abstimmung' || knoten.typ === 'grenzfall') continue;
			expect(karte.bezugsgroessensatz, knoten.id).toBeTruthy();
			// Und der Quotensatz genau dort, wo die Bezugsgrösse absolut ist.
			expect(karte.quotenwirkungssatz !== null, `${knoten.id}: Quotensatz`).toBe(
				knoten.quotenbasis === 'alle_quoten'
			);
		}
	});

	it('sagt bei jedem Typ, wie Enthaltung und Nichtabgabe wirken', () => {
		for (const knoten of RW.knoten) {
			const teile = ergebniskarte(RW, knoten).stimmwirkung;
			expect(teile.length, `${knoten.id}: gar keine Auskunft`).toBeGreaterThan(0);
			/*
			 * **Je Teil geprüft, nicht die Summe** (06.09.2026). Seit die Auskunft
			 * in Absätzen kommt, wäre eine Längenprüfung über den zusammengefügten
			 * Text blind für einen leeren Absatz zwischen zwei vollen — und genau
			 * der erscheint in der Karte als Lücke.
			 */
			for (const [i, teil] of teile.entries()) {
				expect(teil.trim().length, `${knoten.id}, Absatz ${i + 1}`).toBeGreaterThan(20);
			}
		}
	});
});

describe('das Erfordernis selbst setzen (Story 2.3)', () => {
	const vorschlag = erfordernisAus(RW, bis('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-ja'));

	it('verlangt eine Begründung von mindestens drei Zeichen', () => {
		expect(() => uebersteuere(RW, vorschlag, 'einstimmigkeit', '')).toThrow(FachlicherFehler);
		expect(() => uebersteuere(RW, vorschlag, 'einstimmigkeit', ' a ')).toThrow(/mindestens drei Zeichen/);
	});

	/*
	 * **Die Bezugsgrösse beim Übersteuern** (23.08.2026, Prüflauf I, B-16/B-19).
	 *
	 * «Übersteuern bietet nur vier Grobstufen ohne Bezugsgrösse — zwei Drittel
	 * *der Anwesenden* statt *aller*, der häufigste Streitpunkt überhaupt.» Die
	 * Auswahl stand nur im Formular ohne Baum; im Quorumfinder stand sie sogar
	 * auf der Seite, wurde serverseitig aber verworfen, weil ``uebersteuere()``
	 * sie nicht entgegennahm.
	 */
	it('nimmt eine gewählte Bezugsgrösse an', () => {
		const u = uebersteuere(RW, vorschlag, 'qualifiziertes_mehr', 'Reglement § 15', {
			quotenbasis: 'anwesend_vertreten'
		});
		expect(u.ergebnis.quotenbasis).toBe('anwesend_vertreten');
		expect(u.ergebnis.kopfbasis).toBe(vorschlag.kopfbasis);
	});

	it('erbt die Basis des Vorschlags, wo keine gewählt wurde', () => {
		// Wer nur die Höhe ändern will, ändert nur die Höhe.
		const u = uebersteuere(RW, vorschlag, 'qualifiziertes_mehr', 'weil');
		expect(u.ergebnis.kopfbasis).toBe(vorschlag.kopfbasis);
		expect(u.ergebnis.quotenbasis).toBe('alle_quoten');
	});

	it('verwirft eine Basis, die der neue Typ nicht kennt', () => {
		// Sonst stünde «einfaches Mehr aller Wertquoten» im Protokoll — eine
		// Schwelle, gegen die gar nicht gerechnet wird.
		const u = uebersteuere(RW, vorschlag, 'einfaches_mehr', 'weil', {
			quotenbasis: 'alle_quoten'
		});
		expect(u.ergebnis.quotenbasis).toBe('keine');
	});

	/*
	 * **Die Klasse, nicht die Instanz** (B-19).
	 *
	 * Ein Erfordernis entsteht auf zwei Wegen — gesetzt oder übersteuert —, und
	 * nur einer bildete den Titel aus dem, was gilt. Der andere schleppte den
	 * Fallnamen des Vorschlags mit: «Nützliche bauliche Massnahme» stand auf der
	 * Traktandenliste, während längst Einstimmigkeit galt. Kein Test fiel um,
	 * als das behoben wurde — geprüft worden war der Titel nie.
	 *
	 * Deshalb hier gegen **jeden** wählbaren Typ und über **beide** Wege: Wer
	 * einen dritten Weg baut, kommt an dieser Stelle vorbei.
	 */
	it('nennt auf beiden Wegen die Mehrheit, die gilt', () => {
		for (const typ of WAEHLBARE_TYPEN) {
			const bezeichnung = typdefinition(RW, typ).bezeichnung;
			expect(setzeErfordernis(RW, typ).ergebnis.titel, `gesetzt: ${typ}`).toContain(bezeichnung);
			expect(uebersteuere(RW, vorschlag, typ, 'weil').ergebnis.titel, `übersteuert: ${typ}`).toContain(
				bezeichnung
			);
		}
	});

	/*
	 * **Beide Wege rechnen mit derselben Zahl** (Nachprüfung 23.08.2026).
	 *
	 * Das Übersteuern nahm die Schwellen aus einer festen Zuordnung im Code, das
	 * Setzen ohne Baum aus dem Regelwerk. Heute liefern beide dasselbe — sobald
	 * eine Fassung das qualifizierte Mehr auf zwei Drittel setzt, stünde
	 * derselbe Titel über zwei verschiedenen Zahlen, und gerechnet wird mit der
	 * Zahl.
	 */
	it('setzt dieselben Schwellen wie das Setzen ohne Baum', () => {
		for (const typ of WAEHLBARE_TYPEN) {
			const gesetzt = setzeErfordernis(RW, typ).ergebnis;
			const uebersteuert = uebersteuere(RW, vorschlag, typ, 'weil').ergebnis;
			expect(uebersteuert.kopfSchwelle, `kopf: ${typ}`).toEqual(gesetzt.kopfSchwelle);
			expect(uebersteuert.quotenSchwelle, `quoten: ${typ}`).toEqual(gesetzt.quotenSchwelle);
		}
	});

	it('nennt die gewählte Bezugsgrösse im Titel, die vorgegebene nicht', () => {
		// Die Vorgabe an jedem Traktandum mitzuschreiben wäre Lärm, der die eine
		// Abweichung verdeckt, auf die es ankommt.
		const abweichend = uebersteuere(RW, vorschlag, 'qualifiziertes_mehr', 'weil', {
			kopfbasis: 'alle_eigentuemer'
		}).ergebnis;
		expect(abweichend.titel).toContain('auch der abwesenden');

		const vorgegeben = uebersteuere(RW, vorschlag, 'qualifiziertes_mehr', 'weil', {
			kopfbasis: 'anwesend_vertreten'
		}).ergebnis;
		expect(vorgegeben.titel).toBe(typdefinition(RW, 'qualifiziertes_mehr').bezeichnung);
	});

	/*
	 * **Übersteuern verliert nie die Bezugsgrösse des Vorschlags** (Nachprüfung
	 * 23.08.2026).
	 *
	 * Der Anlassfall: «Ermächtigung zur Ausschlussklage» (ZGB Art. 649b Abs. 2)
	 * trägt die Kopfbasis «alle ausser den Betroffenen» — das Gesetz nennt sie
	 * im Wortlaut. In keiner Auswahlliste steht sie, weil es dort nichts zu
	 * wählen gibt; das Formular schickte trotzdem immer eine mit und ersetzte
	 * sie durch «anwesend_vertreten». Bei zehn Eigentümern, einer betroffen,
	 * vier erschienen: statt fünf Ja-Stimmen noch drei — und der Beklagte
	 * zählte wieder mit.
	 *
	 * Über ALLE Knoten des Regelwerks, nicht nur über den einen: Eine neue
	 * Fassung darf einem Knoten jederzeit eine eigene Basis geben.
	 */
	it('behält die Bezugsgrösse jedes Knotens, wenn keine gewählt wird', () => {
		for (const knoten of RW.knoten) {
			if (knoten.typ === 'grenzfall' || knoten.typ === 'keine_abstimmung') continue;
			// Aus dem Knoten gebaut statt über den Baum gelaufen: Nicht jeder
			// Knoten ist über eine Antwortfolge erreichbar, die der Test kennt —
			// und geprüft wird, was `uebersteuere` mit einer Basis macht, nicht
			// wie der Baum dorthin führt.
			const vorschlag = {
				...erfordernisAus(RW, bis('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-ja')),
				typ: knoten.typ,
				kopfbasis: knoten.kopfbasis,
				quotenbasis: knoten.quotenbasis
			};
			for (const typ of WAEHLBARE_TYPEN) {
				const u = uebersteuere(RW, vorschlag, typ, 'Prüflauf').ergebnis;
				// Einstimmigkeit unter den Erschienenen ist keine — die eine Ausnahme.
				const erwartet =
					typ === 'einstimmigkeit' && vorschlag.kopfbasis === 'anwesend_vertreten'
						? 'alle_eigentuemer'
						: vorschlag.kopfbasis;
				expect(u.kopfbasis, `${knoten.id} → ${typ}`).toBe(erwartet);
			}
		}
	});

	it('hält fest, wovon abgewichen wurde, im Verlauf statt im Satz', () => {
		// Gerade die Abweichung ist das, was jemand später angreift. Seit dem
		// 30.09.2026 (Produktentscheid) steht sie im Verlauf, der ins Siegelpaket
		// geht, und nicht mehr in der Rechtsgrundlage, die nach aussen läuft.
		const u = uebersteuere(RW, vorschlag, 'einstimmigkeit', 'weil');
		expect(u.ergebnis.rechtsgrundlage).not.toContain(vorschlag.rechtsgrundlage);
		expect(u.ereignisse[0].angaben).toMatchObject({
			knoten: vorschlag.knotenId,
			vorschlag: vorschlag.typ,
			vorschlagRechtsgrundlage: vorschlag.rechtsgrundlage,
			vorschlagQuelle: vorschlag.quelle
		});
	});

	it('macht aus Einstimmigkeit unter Anwesenden keine Einstimmigkeit', () => {
		// Die alte Regel, unverändert: Einstimmigkeit der Erschienenen ist keine.
		const anwesend = { ...vorschlag, kopfbasis: 'anwesend_vertreten' as const };
		expect(uebersteuere(RW, anwesend, 'einstimmigkeit', 'weil').ergebnis.kopfbasis).toBe(
			'alle_eigentuemer'
		);
		// Und die Basis, die es bei der Einstimmigkeit nicht zu wählen gibt,
		// bleibt trotzdem erhalten — sie kommt aus dem Gesetz, nicht aus einer
		// Auswahlliste.
		const ohneBetroffene = { ...vorschlag, kopfbasis: 'alle_ausser_betroffene' as const };
		expect(uebersteuere(RW, ohneBetroffene, 'einstimmigkeit', 'weil').ergebnis.kopfbasis).toBe(
			'alle_ausser_betroffene'
		);
	});

	/*
	 * **Der Anlassfall vom 22.08.2026** (Prüflauf, Befunde B-03 und D-04): Wer
	 * drei Traktanden vom Reglementsmehr auf einfaches Mehr setzte, bekam eine
	 * Einladung, die weiter «Reglement der Gemeinschaft, § 15 Reglement»
	 * druckte — während gerechnet wurde, was gewählt war. Zwei Urkunden über
	 * denselben Beschluss, die sich widersprechen.
	 *
	 * Die Ursache war, dass `fundstelle` gelöscht und `rechtsgrundlage` stehen
	 * gelassen wurde. Kein Test las sie, deshalb blieb es unbemerkt.
	 */
	it('zieht die Rechtsgrundlage mit, ohne Hinweis auf die Abweichung nach aussen', () => {
		const u = uebersteuere(RW, vorschlag, 'einstimmigkeit', 'Das Reglement verlangt hier mehr.');
		// Produktentscheid 30.09.2026: Die Rechtsgrundlage läuft in Einladung,
		// Stimmzettel, Saalbild und Protokoll. Die Abweichung steht nur im
		// Verlauf (nächster Test), nicht dort.
		expect(u.ergebnis.rechtsgrundlage).toBe('');
		expect(u.ergebnis.fundstelle).toBeUndefined();
	});

	it('hält Vorschlag, Abweichung und Begründung im Verlauf fest', () => {
		const u = uebersteuere(RW, vorschlag, 'einstimmigkeit', 'Reglement Ziff. 14 verlangt hier mehr.');
		expect(u.ereignisse).toHaveLength(1);
		expect(u.ereignisse[0].angaben).toMatchObject({
			vorschlag: 'qualifiziertes_mehr',
			gewaehlt: 'einstimmigkeit',
			begruendung: 'Reglement Ziff. 14 verlangt hier mehr.'
		});
	});

	it('kennzeichnet eine Abschwächung als Risiko', () => {
		const u = uebersteuere(RW, vorschlag, 'einfaches_mehr', 'Wir halten es für notwendigen Unterhalt.');
		expect(u.ergebnis.risiko).toBe(true);
		expect(ANFECHTUNGSHINWEIS).toMatch(/Monatsfrist/);
		expect(ANFECHTUNGSHINWEIS).toMatch(/ZGB Art. 75/);
	});

	it('kennzeichnet eine Verschärfung nicht als Risiko', () => {
		// Strenger als nötig macht den Beschluss nicht anfechtbar.
		const u = uebersteuere(RW, vorschlag, 'einstimmigkeit', 'Im Zweifel strenger.');
		expect(u.ergebnis.risiko).toBe(false);
	});

	it('behält beim Übersteuern die Kopfbasis des Knotens', () => {
		// Sie folgt dem Gegenstand des Beschlusses, nicht der Höhe der Mehrheit:
		// Wer bei der Ausschlussklage hochgeht, ändert nichts daran, dass der
		// Beklagte aus der Basis fällt.
		const ausschluss = erfordernisAus(RW, bis('a-sonderfaelle', 'f8-1-ausschluss'));
		const u = uebersteuere(RW, ausschluss, 'qualifiziertes_mehr', 'Aus Vorsicht strenger.');
		expect(u.ergebnis.kopfbasis).toBe('alle_ausser_betroffene');
		expect(u.ergebnis.quotenbasis).toBe('alle_quoten');
	});

	it('hebt die Basis bei der Einstimmigkeit auf alle Eigentümer', () => {
		// Einstimmigkeit nur unter den Erschienenen ist keine Einstimmigkeit.
		const u = uebersteuere(RW, vorschlag, 'einstimmigkeit', 'Zweckänderung, deshalb alle.');
		expect(u.ergebnis.kopfbasis).toBe('alle_eigentuemer');
	});

	it('lässt eine Zustimmungspflicht Betroffener unberührt', () => {
		const wertquoten = erfordernisAus(RW, bis('a-grundordnung', 'f6-1-wertquoten'));
		const u = uebersteuere(RW, wertquoten, 'qualifiziertes_mehr', 'Sicherheitshalber höher.');
		expect(u.ergebnis.zustimmungBetroffenerNoetig).toBe(true);
	});

	it('lässt den Grenzfall nicht setzen', () => {
		// Er besagt gerade, dass kein Erfordernis feststeht.
		expect(() => uebersteuere(RW, vorschlag, 'grenzfall', 'unklar')).toThrow(/lässt sich nicht setzen/);
	});

	it('setzt ein Erfordernis auch ohne Herleitung', () => {
		const u = setzeErfordernis(RW, 'einfaches_mehr', 'Standardtraktandum');
		expect(u.ergebnis.quelle).toBe('gewaehlt');
		expect(u.ergebnis.pfad).toEqual([]);
		expect(u.ergebnis.knotenId).toBe('');
		expect(u.ereignisse[0].art).toBe('requirement.set');
	});

	it('gibt der freien Wahl die Grundbasen ihres Typs', () => {
		expect(setzeErfordernis(RW, 'qualifiziertes_mehr').ergebnis.quotenbasis).toBe('alle_quoten');
		expect(setzeErfordernis(RW, 'einstimmigkeit').ergebnis.kopfbasis).toBe('alle_eigentuemer');
	});

	/*
	 * **Die Bezugsgrösse ist nicht der Typ** (Auftraggeber, 11.08.2026): «Es gibt halt
	 * Mehrheit aller und Mehrheit der anwesenden Köpfe, als Beispiel. Das wird
	 * nicht abgebildet.» Der Typ sagt, wie hoch die Schwelle liegt; wovon, sagt
	 * die Basis — und bei zwölf Eigentümern, von denen sieben erschienen sind,
	 * heisst «einfaches Mehr» vier Stimmen oder sieben, je nachdem.
	 */
	it('lässt die Kopfbasis frei wählen, wo das Gesetz sie nicht festlegt', () => {
		const u = setzeErfordernis(RW, 'einfaches_mehr', 'Reglement verlangt es', {
			kopfbasis: 'alle_eigentuemer'
		});
		expect(u.ergebnis.kopfbasis).toBe('alle_eigentuemer');
		// Die Schwelle bleibt dieselbe — geändert hat sich nur, wovon.
		expect(u.ergebnis.kopfSchwelle).toEqual(setzeErfordernis(RW, 'einfaches_mehr').ergebnis.kopfSchwelle);
		// Und die Karte sagt es, statt «Einfaches Mehr» zu behaupten.
		expect(u.ergebnis.titel).toMatch(/aller Eigentümer/);
	});

	it('lässt beim qualifizierten Mehr auch die Quotenbasis wählen', () => {
		const u = setzeErfordernis(RW, 'qualifiziertes_mehr', 'so hergebracht', {
			quotenbasis: 'anwesend_vertreten'
		});
		expect(u.ergebnis.quotenbasis).toBe('anwesend_vertreten');
	});

	it('hält die Basis der Einstimmigkeit fest — sonst wäre sie keine', () => {
		// Einstimmigkeit nur unter den Erschienenen ist keine Einstimmigkeit.
		const u = setzeErfordernis(RW, 'einstimmigkeit', 'alle müssen zustimmen', {
			kopfbasis: 'anwesend_vertreten'
		});
		expect(u.ergebnis.kopfbasis).toBe('alle_eigentuemer');
		expect(waehlbareBasen('einstimmigkeit').kopf).toEqual([]);
	});

	it('fällt bei einer unzulässigen Basis auf die gesetzliche Vorgabe zurück', () => {
		// Lieber die Vorgabe als eine stille Sonderregel, die niemand gewählt hat.
		const u = setzeErfordernis(RW, 'einfaches_mehr', 'x', {
			kopfbasis: 'alle_ausser_betroffene'
		});
		expect(u.ergebnis.kopfbasis).toBe('anwesend_vertreten');
	});

	it('hält die gewählte Basis im Verlauf fest', () => {
		// Ohne den Eintrag liesse sich später nicht belegen, wovon gezählt wurde.
		const u = setzeErfordernis(RW, 'einfaches_mehr', 'x', { kopfbasis: 'alle_eigentuemer' });
		expect(u.ereignisse[0].angaben).toMatchObject({ kopfbasis: 'alle_eigentuemer' });
	});

	it('nennt jede Basis im Klartext', () => {
		expect(basisbezeichnung('anwesend_vertreten')).toMatch(/anwesenden/);
		expect(basisbezeichnung('alle_eigentuemer')).toMatch(/abwesenden/);
	});

	it('macht auf jeder Karte erkennbar, wer entschieden hat', () => {
		expect(urheberschaft(vorschlag)).toMatch(/Vorschlag des Werkzeugs/);
		expect(urheberschaft(uebersteuere(RW, vorschlag, 'einstimmigkeit', 'strenger').ergebnis)).toMatch(
			/Von der Sitzungsleitung gesetzt, abweichend/
		);
		expect(urheberschaft(setzeErfordernis(RW, 'einfaches_mehr').ergebnis)).toMatch(/ohne Herleitung/);
		expect(urheberschaft({ ...vorschlag, quelle: 'reglement' })).toMatch(/hinterlegten Reglement/);
	});
});

describe('Die Anzeige zeigt keine Auszeichnung, die Quelle behält sie', () => {
	/*
	 * **Zwei Verbraucher, ein Datenbestand.** Der Website-Abzug wandelt
	 * `**Fett**` in `<strong>` um, Votum gibt denselben Text escaped aus und
	 * zeigte die Sternchen deshalb wörtlich. Drei Stellen in den Hilfetexten
	 * der Basisfassung sind betroffen.
	 *
	 * Diese Probe misst beide Richtungen, und die zweite ist die wichtigere:
	 * Wer die Auszeichnung aus der Fassung entfernte statt aus der Anzeige,
	 * änderte rückwirkend, was ausgelieferte Fassungen zeigen (AD-4), und
	 * nähme dem Abzug still sein Fett. Der Test wäre trotzdem grün.
	 */
	it('entfernt die Sternchen auf dem Weg zur Anzeige', () => {
		/*
		 * **Der erste Entwurf dieser Probe mass nichts** (23.09.2026). Er rief
		 * `laufe(rw, ast.id)` ohne Antworten auf und sah damit nur die **erste**
		 * Frage jedes Astes. Die drei Stellen mit Auszeichnung stehen in `f1-2`
		 * und `f1-4`, also zwei und vier Schritte tiefer; die Schleife kam nie
		 * dort an. Gegenprobe gefahren: Mit entfernter Behebung blieb sie grün.
		 *
		 * Jetzt wird der Weg wirklich gegangen, bis zu der Frage, die den Fall
		 * trägt.
		 */
		const rw = holeRegelwerk('2026-07-30');
		const baulich = rw.fragen.find((f) => f.id === 'f1-2')!;
		// Erst der Beleg, dass die Quelle den Fall überhaupt hergibt.
		expect(baulich.hilfe).toContain('**');

		// f1-0 «Nein, es geht um mehr» führt auf f1-1, von dort «Nein, sie geht
		// darüber hinaus» auf f1-2.
		const lauf = laufe(rw, 'a-bauen', ['f1-0-nein', 'f1-1-nein']);
		expect(lauf.stand.art).toBe('frage');
		if (lauf.stand.art !== 'frage') return;
		expect(lauf.stand.frage.id).toBe('f1-2');
		expect(lauf.stand.frage.hilfe).not.toContain('**');
		expect(lauf.stand.frage.hilfe).toContain('Nutzen der Gemeinschaft');
	});

	it('lässt die Auszeichnung in der Fassung stehen, weil der Abzug sie braucht', () => {
		/*
		 * Die Gegenrichtung. Ohne sie wäre die Probe darüber auch dann grün,
		 * wenn jemand die Sternchen in der Basisfassung gelöscht hätte, und
		 * das wäre eine Rückwirkung auf sechs eingefrorene Fassungen.
		 */
		const basis = holeRegelwerk('2026-07-30');
		const mitFett = basis.fragen.filter((f) => (f.hilfe ?? '').includes('**'));
		expect(mitFett.length, 'die Basisfassung trägt keine Auszeichnung mehr').toBeGreaterThanOrEqual(
			2
		);

		/*
		 * **Und vor allem in der aktuellen Fassung** (Code-Review 23.09.2026).
		 * Der Export verbraucht nicht die Basisfassung, sondern die aktuelle, und
		 * deren Hilfetexte stammen aus 2026-08-05. Wer die Sternchen dort
		 * entfernte, liesse die Probe oben grün, während die Website ihr Fett und
		 * zwei Einträge in `UMFORMULIERUNGEN` still verliert.
		 */
		const aktuell = holeRegelwerk();
		const aktuellMitFett = aktuell.fragen.filter((f) => (f.hilfe ?? '').includes('**'));
		expect(
			aktuellMitFett.length,
			'die aktuelle Fassung trägt keine Auszeichnung mehr; der Abzug verliert sein Fett'
		).toBeGreaterThanOrEqual(3);
	});
});

/*
 * **«hergeleitet als» nur, wo ein Fall im Titel steht** (zweite Codeprüfung
 * 30.09.2026). Gesetzt und übersteuert trägt der Titel die Mehrheit, die die
 * Leitung bestimmt hat; nach aussen steht dann keine Herkunft (Produktentscheid
 * 30.09.2026). Direkt aus der Liste gewählt trägt er den Fall, und der bleibt.
 */
describe('Herkunft nach aussen', () => {
	const vorschlag = erfordernisAus(RW, laufe(RW, 'a-bauen', ['f1-0-nein', 'f1-1-nein', 'f1-2-ja']));

	it('nennt bei gesetzter und übersteuerter Mehrheit keine Herleitung', () => {
		for (const e of [
			setzeErfordernis(RW, 'qualifiziertes_mehr', 'weil').ergebnis,
			uebersteuere(RW, vorschlag, 'einstimmigkeit', 'weil').ergebnis
		]) {
			expect(mehrheitGesetzt(e)).toBe(true);
			expect(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e))).toBe('');
		}
	});

	it('behält den Fall, wenn die Leitung ihn direkt gewählt hat', () => {
		const e = waehleErfordernis(RW, 'k-wertquoten-aendern').ergebnis;
		expect(mehrheitGesetzt(e)).toBe(false);
		expect(herleitung(e.titel, e.rechtsgrundlage, mehrheitGesetzt(e))).toContain('hergeleitet als');
	});
});

/*
 * **Die Bezeichnung mit Bezugsgrösse** (Produktentscheid 08.10.2026,
 * `docs/freigabe.md`, Nebenbefund 4). «Einfaches Mehr» stand am Traktandum
 * ohne Basis; die Marken an Leitung, Wand und Einladung zeigen seither die
 * Basis immer, anders als der gespeicherte Titel (`mehrheitMitBasis`).
 */
describe('bezeichnungMitBasis', () => {
	it('nennt beim einfachen Mehr die Basis auch dann, wenn sie die Vorgabe ist', () => {
		const e = setzeErfordernis(RW, 'einfaches_mehr').ergebnis;
		expect(bezeichnungMitBasis(RW, e)).toBe(
			'Einfaches Mehr der anwesenden oder vertretenen'
		);
		expect(bezeichnungMitBasis(RW, { ...e, kopfbasis: 'alle_eigentuemer' })).toBe(
			'Einfaches Mehr aller Eigentümer, auch der abwesenden'
		);
	});

	it('nennt beim qualifizierten Mehr beide Basen, an der Ausschlussklage den Beklagten', () => {
		const e = setzeErfordernis(RW, 'qualifiziertes_mehr').ergebnis;
		expect(bezeichnungMitBasis(RW, e)).toBe(
			'Qualifiziertes Mehr der anwesenden oder vertretenen; bei den Wertquoten zählen alle, auch die der abwesenden'
		);
		expect(
			bezeichnungMitBasis(RW, {
				...e,
				kopfbasis: 'anwesend_vertreten',
				knotenId: 'k-ausschlussklage'
			})
		).toContain('ohne den Beklagten');
		expect(
			bezeichnungMitBasis(RW, { ...e, quotenbasis: 'anwesend_vertreten' })
		).toBe(
			'Qualifiziertes Mehr der anwesenden oder vertretenen; bei den Wertquoten die der anwesenden oder vertretenen'
		);
	});

	it('bleibt bei Einstimmigkeit und Kenntnisnahme ohne Basis', () => {
		const vorschlag = erfordernisAus(RW, laufe(RW, 'a-bauen', ['f1-0-nein', 'f1-1-nein', 'f1-2-ja']));
		expect(bezeichnungMitBasis(RW, uebersteuere(RW, vorschlag, 'einstimmigkeit', 'weil').ergebnis)).toBe(
			'Einstimmigkeit'
		);
		expect(bezeichnungMitBasis(RW, { ...setzeErfordernis(RW, 'einfaches_mehr').ergebnis, typ: 'keine_abstimmung' })).toBe(
			'Keine Abstimmung'
		);
	});
});

/*
 * **Der Satz «umstritten» in der Traktandenliste** (Ä-01, Ä-02, Ä-04,
 * Entscheid 17.09.2026). Er stimmt nur für das Erfordernis, wie der Knoten es
 * rechnet; jede Abweichung davon rechnet etwas anderes als «die strenge Lesart».
 */
describe('umstrittenSatz', () => {
	const rw = holeRegelwerk('2026-10-18');
	const knoten = knotenVon(rw, 'k-prozessfuehrung')!;
	const hergeleitet = waehleErfordernis(rw, 'k-prozessfuehrung').ergebnis;

	it('sagt «umstritten» mit der anderen Ansicht, wenn das Erfordernis das des Knotens ist', () => {
		const satz = umstrittenSatz(hergeleitet, knoten);
		expect(satz).toBe(`${UMSTRITTEN_SATZ} Nach anderer Ansicht ${knoten.gegenmeinung}`);
		expect(satz).toMatch(/^Welches Mehr gilt, ist umstritten\. Gerechnet wird die strenge Lesart; .* Nach anderer Ansicht genügt das einfache Mehr/);
	});

	it('schweigt bei einem Knoten ohne Gegenmeinung', () => {
		const e = waehleErfordernis(rw, 'k-jahresrechnung').ergebnis;
		expect(umstrittenSatz(e, knotenVon(rw, 'k-jahresrechnung'))).toBeNull();
	});

	it('schweigt am Knoten einer Fassung ohne das Merkmal', () => {
		const alt = holeRegelwerk('2026-10-17');
		const e = waehleErfordernis(alt, 'k-prozessfuehrung').ergebnis;
		expect(umstrittenSatz(e, knotenVon(alt, 'k-prozessfuehrung'))).toBeNull();
	});

	it('liest bei einer Fassung ohne das Merkmal die neueste ohne Lesart, und nur dort', () => {
		// Codeprüfung H7, M-2: Sonst zeigte kein bestehendes Traktandum den Satz.
		const alt = waehleErfordernis(holeRegelwerk('2026-10-17'), 'k-prozessfuehrung').ergebnis;
		// Die neueste Fassung, deren Knoten keine Lesart trägt, nicht die aktuelle:
		// Bis 2026-10-30 war es derselbe Knoten, seit 2026-11-03 trägt er die
		// Abgrenzung zur Ausschlussklage (F1), und seit 2026-11-10 die Lesart L11
		// (E1). Ein Traktandum aus 2026-10-17 rechnet ohne Lesart; der Streit gilt
		// für es weiter, also kommt er aus 2026-11-05.
		expect(knotenFuerUmstritten('2026-10-17', 'k-prozessfuehrung')).toBe(
			knotenVon(holeRegelwerk('2026-11-05'), 'k-prozessfuehrung')
		);
		expect(umstrittenSatz(alt, knotenFuerUmstritten(alt.fassung, alt.knotenId))).toMatch(/umstritten/);
		expect(knotenFuerUmstritten('2026-10-18', 'k-prozessfuehrung')?.gegenmeinung).toBe(knoten.gegenmeinung);
		expect(knotenFuerUmstritten('ordnungsantrag-2026-08-05', 'k-prozessfuehrung')).toBeUndefined();
		// Rechnete die alte Fassung am selben Knoten ein anderes Mehr, kein Satz.
		const anders = { ...alt, typ: 'einfaches_mehr' as const };
		expect(umstrittenSatz(anders, knotenFuerUmstritten(alt.fassung, alt.knotenId))).toBeNull();
	});

	it('zeigt an der eigenen Schranke einer Fassung vor 2026-10-18 den Streit aus 2026-11-04 (E1)', () => {
		// Codeprüfung E1 L11, Befund 3: Seit L6 (2026-11-05) trägt der Knoten keine
		// Gegenmeinung. Ein altes Traktandum rechnet ohne Lesart nach der Klausel;
		// der Rückfall liest deshalb die neueste Fassung ohne Lesart.
		expect(knotenFuerUmstritten('2026-10-17', 'k-reglement-eigene-schranke')).toBe(
			knotenVon(holeRegelwerk('2026-11-04'), 'k-reglement-eigene-schranke')
		);
		expect(knotenFuerUmstritten('2026-10-17', 'k-reglement-eigene-schranke')?.gegenmeinung).toBeTruthy();
		// Seit L9 (Fassung 2026-11-10) trägt auch die Ausschlussklage keine
		// Gegenmeinung mehr; der Rückfall liest die Fassung 2026-11-05 (E1, Block C).
		expect(knotenFuerUmstritten('2026-10-17', 'k-ausschlussklage')).toBe(
			knotenVon(holeRegelwerk('2026-11-05'), 'k-ausschlussklage')
		);
		expect(knotenFuerUmstritten('2026-10-17', 'k-ausschlussklage')?.gegenmeinung).toBeTruthy();
		// An einem Knoten, der nie eine Lesart trug, bleibt es die aktuelle.
		expect(knotenFuerUmstritten('2026-10-17', 'k-baulich-nuetzlich')).toBe(
			knotenVon(holeRegelwerk(), 'k-baulich-nuetzlich')
		);
	});

	it('schweigt, wenn die Leitung Typ oder Bezugsgrösse anders gesetzt hat', () => {
		const anders = uebersteuere(rw, hergeleitet, 'einfaches_mehr', 'Weil die Lehre geteilt ist.').ergebnis;
		expect(umstrittenSatz(anders, knoten)).toBeNull();
		expect(umstrittenSatz({ ...hergeleitet, quotenbasis: 'anwesend_vertreten' }, knoten)).toBeNull();
	});

	it('schweigt bei einem Erfordernis aus dem Reglement und bei fremdem Knoten', () => {
		expect(umstrittenSatz({ ...hergeleitet, quelle: 'reglement' }, knoten)).toBeNull();
		expect(umstrittenSatz(hergeleitet, knotenVon(rw, 'k-ausschlussklage'))).toBeNull();
		expect(umstrittenSatz(null, knoten)).toBeNull();
	});
});
