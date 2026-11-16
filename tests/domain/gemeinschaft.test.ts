import { describe, expect, it } from 'vitest';
import {
	FachlicherFehler,
	aendereGemeinschaft,
	erzeugtRing,
	brauchtReglementsbeleg,
	gemeinschaftsfelder,
	grundlageDerZaehlweise,
	istKlammer,
	istSollebene,
	legeGemeinschaftAn,
	pruefeGemeinschaft,
	stichentscheidInWorten,
	zaehlweiseInWorten,
	type GemeinschaftEingabe
} from '$lib/domain/gemeinschaft';

const GRUNDFALL: GemeinschaftEingabe = {
	name: 'Musterweg 3–7',
	quotaDenominator: 1000,
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	parentStwegId: null
};

function mit(aenderung: Partial<GemeinschaftEingabe>): GemeinschaftEingabe {
	return { ...GRUNDFALL, ...aenderung };
}

describe('pruefeGemeinschaft', () => {
	// Seit dem 07.10.2026 (Migration 151): Die Klausel gilt nur, wenn alle
	// zugestimmt haben, und das kann Votum nicht prüfen. Ohne Fundstelle liesse
	// sich ein Beschluss, der erst dadurch zustande kam, nicht verteidigen.
	it('verlangt zur Einstellung «Enthaltungen zählen nicht mit» die Fundstelle', () => {
		expect(() => pruefeGemeinschaft(mit({ abstentionExcluded: true }))).toThrow(/Fundstelle/);
		expect(() =>
			pruefeGemeinschaft(mit({ abstentionExcluded: true, abstentionExcludedSource: ' 3 ' }))
		).toThrow(/Fundstelle/);
		const g = pruefeGemeinschaft(
			mit({ abstentionExcluded: true, abstentionExcludedSource: ' Art. 33 Abs. 1 ' })
		);
		expect(g.abstentionExcludedSource).toBe('Art. 33 Abs. 1');
		// Aus: Eine stehengebliebene Fundstelle wird nicht mitgeführt.
		const aus = pruefeGemeinschaft(mit({ abstentionExcludedSource: 'Art. 33' }));
		expect(aus.abstentionExcluded).toBe(false);
		expect(aus.abstentionExcludedSource).toBeUndefined();
	});

	it('nimmt den Grundfall an und beschneidet Leerzeichen', () => {
		const g = pruefeGemeinschaft(mit({ name: '  Musterweg 3  ' }));
		expect(g.name).toBe('Musterweg 3');
	});

	it('weist eine fehlende Bezeichnung ab', () => {
		expect(() => pruefeGemeinschaft(mit({ name: ' ' }))).toThrow(FachlicherFehler);
	});

	it('weist einen Nenner mit Nachkommastellen ab', () => {
		// Ein Kommawert als Nenner wäre der Anfang von Rundungsfehlern in der
		// Auszählung (AD-12).
		expect(() => pruefeGemeinschaft(mit({ quotaDenominator: 1000.5 }))).toThrow(/ganze Zahl/);
	});

	it('weist einen negativen Nenner ab', () => {
		expect(() => pruefeGemeinschaft(mit({ quotaDenominator: -1 }))).toThrow(/negativ/);
	});

	it('lässt den Nenner null zu — das ist die blosse Klammer', () => {
		expect(pruefeGemeinschaft(mit({ quotaDenominator: 0 })).quotaDenominator).toBe(0);
	});

	it('weist eine unbekannte Zählweise ab', () => {
		expect(() => pruefeGemeinschaft(mit({ headCountMode: 'per_quota' as never }))).toThrow(
			/Zählweise/
		);
	});

	it('weist eine fehlende Zählweise ab, statt eine anzunehmen', () => {
		// Der wichtigste Test dieser Datei. Rechtlich gilt eine Stimme je
		// Eigentümer, in den meisten Reglementen steht die Zählung je Einheit —
		// eine Voreinstellung wäre in beide Richtungen falsch und fiele erst auf,
		// wenn ein Beschluss angefochten wird.
		expect(() => pruefeGemeinschaft(mit({ headCountMode: '' as never }))).toThrow(/zu wählen/);
		expect(() => pruefeGemeinschaft(mit({ headCountMode: undefined as never }))).toThrow(
			/zu wählen/
		);
	});

	it('führt die Fundstelle nur bei der Zählung je Einheit', () => {
		// Bei der gesetzlichen Auffangregel gibt es nichts zu belegen; ein Verweis
		// aufs Reglement wäre irreführend.
		const jeEinheit = pruefeGemeinschaft(
			mit({ headCountMode: 'per_unit', headCountRuleSource: 'Reglement Ziff. 14.2' })
		);
		const jeEigentuemer = pruefeGemeinschaft(
			mit({ headCountMode: 'per_owner', headCountRuleSource: 'Reglement Ziff. 14.2' })
		);
		expect(jeEinheit.headCountRuleSource).toBe('Reglement Ziff. 14.2');
		expect(jeEigentuemer.headCountRuleSource).toBeUndefined();
	});

	it('streicht den Nebenobjekt-Zusatz bei der Zählung je Eigentümer', () => {
		// Bei einer Kopfstimme je Eigentümer ändert die Zahl seiner Einheiten
		// nichts; ein gesetzter Zusatz wäre irreführend.
		const g = pruefeGemeinschaft(mit({ headCountMode: 'per_owner', parkingCountsAsHead: true }));
		expect(g.parkingCountsAsHead).toBe(false);
	});

	it('behält den Nebenobjekt-Zusatz bei der Zählung je Einheit', () => {
		const g = pruefeGemeinschaft(mit({ headCountMode: 'per_unit', parkingCountsAsHead: true }));
		expect(g.parkingCountsAsHead).toBe(true);
	});
});

describe('Grundlage der Zählweise', () => {
	it('stützt die Zählung je Eigentümer auf die gesetzliche Auffangregel', () => {
		// ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 1. Der Beobachter-Ratgeber:
		// «jeder Stockwerkeigentümer nur eine Stimme, selbst als Eigentümer
		// mehrerer Wohnungen».
		expect(grundlageDerZaehlweise('per_owner')).toBe('gesetzliche_auffangregel');
		expect(brauchtReglementsbeleg('per_owner')).toBe(false);
	});

	it('stützt die Zählung je Einheit aufs Reglement', () => {
		// Das Schulskript: «In der Praxis wird dieser Punkt jedoch im Reglement oft
		// abgeändert.» Häufig, aber eben nur soweit dort etwas steht.
		expect(grundlageDerZaehlweise('per_unit')).toBe('reglement');
		expect(brauchtReglementsbeleg('per_unit')).toBe(true);
	});
});

describe('istSollebene', () => {
	it('wertet eine Ebene mit Quote als Sollebene', () => {
		expect(istSollebene({ quotaDenominator: 1000 })).toBe(true);
	});

	it('wertet eine Ebene ohne Quote als blosse Klammer', () => {
		// Die Dachgemeinschaft einer Mehrhausanlage, deren Quoten vollständig bei
		// den Untergemeinschaften liegen. Als Sollebene gewertet ergäbe sie eine
		// Abweichung, die es nicht gibt.
		expect(istSollebene({ quotaDenominator: 0 })).toBe(false);
	});
});

/**
 * Was eine blosse Klammer überhaupt braucht.
 *
 * Gefragt am 12.08.2026: «Braucht es weniger Angaben, wenn es eine übergeordnete
 * Sammelbehälter ist?» Die Antwort hängt nicht am Formular, sondern daran, was
 * eine Klammer sein kann: Ohne eigene Einheiten hat sie keine Eigentümer und
 * damit keine Abstimmung — `pruefeFreigabe` liesse eine Versammlung für sie gar
 * nicht zu.
 */
describe('gemeinschaftsfelder', () => {
	it('verlangt von einer Gemeinschaft, die tagt, alles', () => {
		const f = gemeinschaftsfelder(false);
		expect(f).toEqual({ wertquoten: true, abstimmung: true, vollmachten: true, ki: true });
	});

	it('lässt einer blossen Klammer nur Bezeichnung und Anschrift', () => {
		const f = gemeinschaftsfelder(true);
		expect(f.wertquoten).toBe(false);
		expect(f.abstimmung).toBe(false);
		expect(f.vollmachten).toBe(false);
		expect(f.ki).toBe(false);
	});
});

/**
 * Übergeordnet und zugleich untergeordnet — der Fall, den es nicht gibt.
 *
 * Gemeldet am 12.08.2026: «Wenn übergeordnet ist, sollte diese nicht ‹Gehört
 * diese Gemeinschaft zu einer übergeordneten?› möglich sein, weil übergeordnet.»
 * Nachgerechnet an einer dreistufigen Anlage (`pruefeSalden`): Eine Zwischenebene
 * ohne eigene Quote trägt nach oben nichts bei — «Sonnenhof: soll 1000, eigene 0,
 * unten 0, Abweichung 1000». Der Saldo ginge nie auf, und kein noch so
 * sorgfältiges Erfassen führte heraus.
 */
describe('übergeordnet und untergeordnet zugleich', () => {
	it('weist die Kombination ab, mit Grund und Ausweg', () => {
		try {
			pruefeGemeinschaft({ ...GRUNDFALL, quotaDenominator: 0, parentStwegId: 'dach' });
			throw new Error('Nicht abgewiesen');
		} catch (f) {
			const e = f as FachlicherFehler;
			expect(e.kennung).toBe('uebergeordnete_mit_eltern');
			expect(e.feld).toBe('parentStwegId');
			expect(e.message).toMatch(/eigenen Nenner/);
		}
	});

	it('lässt jede der beiden Eigenschaften für sich zu', () => {
		// Nur übergeordnet: keine eigene Quote, kein Elternteil.
		expect(
			pruefeGemeinschaft({ ...GRUNDFALL, quotaDenominator: 0, parentStwegId: null })
				.quotaDenominator
		).toBe(0);
		// Nur untergeordnet: eigener Nenner, ein Elternteil.
		expect(
			pruefeGemeinschaft({ ...GRUNDFALL, quotaDenominator: 600, parentStwegId: 'dach' })
				.parentStwegId
		).toBe('dach');
	});

	it('erlaubt eine Zwischenebene MIT eigenem Nenner — dann rechnet es', () => {
		// Der Ausweg, den die Meldung nennt: Wer drei Stufen braucht, gibt der
		// mittleren eine eigene Quote. Sie ist dann keine blosse Zusammenfassung.
		const g = pruefeGemeinschaft({ ...GRUNDFALL, quotaDenominator: 1000, parentStwegId: 'dach' });
		expect(g.quotaDenominator).toBe(1000);
		expect(istKlammer(g as { quotaDenominator: number })).toBe(false);
	});
});

describe('istKlammer', () => {
	it('erkennt sie am Nenner null — es gibt kein zweites Merkmal', () => {
		expect(istKlammer({ quotaDenominator: 0 })).toBe(true);
		expect(istKlammer({ quotaDenominator: 1000 })).toBe(false);
	});

	it('ist das Gegenstück zu istSollebene', () => {
		// Zwei Namen für dieselbe Unterscheidung, und sie dürfen nie auseinanderlaufen.
		for (const n of [0, 1, 5, 1000, 10000]) {
			expect(istKlammer({ quotaDenominator: n })).toBe(!istSollebene({ quotaDenominator: n }));
		}
	});
});

describe('erzeugtRing', () => {
	it('lässt eine Gemeinschaft ohne Übergeordnete zu', () => {
		expect(erzeugtRing('a', null, [])).toBe(false);
	});

	it('weist die Zuordnung auf sich selbst ab', () => {
		expect(erzeugtRing('a', 'a', [])).toBe(true);
	});

	it('weist die Zuordnung an einen eigenen Nachkommen ab', () => {
		// A ist Elternteil von B. Würde A unter B gehängt, liefe jede Saldoprüfung
		// endlos.
		expect(erzeugtRing('a', 'b', ['a'])).toBe(true);
	});

	it('lässt eine echte Untergemeinschaft zu', () => {
		expect(erzeugtRing('c', 'a', [])).toBe(false);
	});

	it('lässt eine Zuordnung über zwei Ebenen zu', () => {
		expect(erzeugtRing('c', 'b', ['a'])).toBe(false);
	});
});

describe('legeGemeinschaftAn', () => {
	it('gibt die Gemeinschaft und genau ein Ereignis zurück', () => {
		const u = legeGemeinschaftAn('s1', 'op1', GRUNDFALL);
		expect(u.ergebnis.id).toBe('s1');
		expect(u.ergebnis.operatorId).toBe('op1');
		expect(u.ereignisse).toHaveLength(1);
		expect(u.ereignisse[0].art).toBe('stweg.created');
	});

	it('hält im Verlauf fest, worauf sich die Zählweise stützt', () => {
		// Steht das nicht im Verlauf, lässt sich später nicht mehr zeigen, dass die
		// Wahl bewusst geschah.
		const auffangregel = legeGemeinschaftAn('s1', 'op1', GRUNDFALL);
		const ausReglement = legeGemeinschaftAn(
			's2',
			'op1',
			mit({ headCountMode: 'per_unit', headCountRuleSource: 'Reglement Ziff. 14.2' })
		);
		expect(auffangregel.ereignisse[0].angaben?.grundlage).toBe('gesetzliche_auffangregel');
		expect(auffangregel.ereignisse[0].angaben?.fundstelle).toBeNull();
		expect(ausReglement.ereignisse[0].angaben?.grundlage).toBe('reglement');
		expect(ausReglement.ereignisse[0].angaben?.fundstelle).toBe('Reglement Ziff. 14.2');
	});

	it('weist den Ring auf sich selbst ab', () => {
		expect(() => legeGemeinschaftAn('s1', 'op1', mit({ parentStwegId: 's1' }))).toThrow(/selbst/);
	});

	it('reicht die Prüfung der Eingabe durch', () => {
		expect(() => legeGemeinschaftAn('s1', 'op1', mit({ name: '' }))).toThrow(FachlicherFehler);
	});
});

describe('aendereGemeinschaft', () => {
	const bisher = legeGemeinschaftAn('s1', 'op1', GRUNDFALL).ergebnis;

	it('hält vorher und nachher je Feld fest', () => {
		const u = aendereGemeinschaft(bisher, mit({ name: 'Neuer Name' }));
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(felder.name).toEqual({ vorher: 'Musterweg 3–7', nachher: 'Neuer Name' });
		expect(Object.keys(felder)).toHaveLength(1);
	});

	/*
	 * **Der 500er vom 12.08.2026.** Eine Gemeinschaft mit einer Einheit auf «nur
	 * eine Klammer» gestellt: Der Auslöser in der Datenbank löscht die
	 * Stammquotenart, der Fremdschlüssel von `unit_quota` hält dagegen — und was
	 * ankam, war «500 Internal Error». Erreichbar war der Weg schon vorher über
	 * eine getippte Null; seit es dafür eine Wahl gibt, ist er ein Klick.
	 */
	it('weist eine Klammer mit eigenen Einheiten ab, mit Zahl und Ausweg', () => {
		expect(() => aendereGemeinschaft(bisher, mit({ quotaDenominator: 0 }), [], 3)).toThrow(
			FachlicherFehler
		);
		try {
			aendereGemeinschaft(bisher, mit({ quotaDenominator: 0 }), [], 3);
		} catch (f) {
			const e = f as FachlicherFehler;
			expect(e.kennung).toBe('klammer_mit_einheiten');
			expect(e.feld).toBe('quotaDenominator');
			expect(e.message).toContain('3 Einheiten');
			// Ohne Ausweg wäre die Meldung eine Sackgasse.
			expect(e.message).toMatch(/Verschieben|entfernen/);
		}
	});

	it('nennt die eine Einheit im Singular', () => {
		try {
			aendereGemeinschaft(bisher, mit({ quotaDenominator: 0 }), [], 1);
		} catch (f) {
			expect((f as FachlicherFehler).message).toContain('1 Einheit ');
		}
	});

	it('lässt die Umstellung zu, solange keine Einheit daran hängt', () => {
		const u = aendereGemeinschaft(bisher, mit({ quotaDenominator: 0 }), [], 0);
		expect(u.ergebnis.quotaDenominator).toBe(0);
		expect(istKlammer(u.ergebnis)).toBe(true);
	});

	it('erzeugt kein Ereignis, wenn sich nichts ändert', () => {
		// Sonst füllte sich der Verlauf mit Rauschen und die echten Einträge wären
		// nicht mehr auffindbar.
		const u = aendereGemeinschaft(bisher, GRUNDFALL);
		expect(u.ereignisse).toHaveLength(0);
	});

	it('erfasst den Wechsel der Zählweise mit beiden Werten', () => {
		const u = aendereGemeinschaft(bisher, mit({ headCountMode: 'per_unit' }));
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(felder.headCountMode).toEqual({ vorher: 'per_owner', nachher: 'per_unit' });
	});
});

/**
 * Der Satz, der im Kopf jeder Auswertung steht.
 *
 * Er ist der Beleg dafür, **wie** gezählt wurde. Dieselben Stimmen ergeben je
 * nach Zählweise Annahme oder Ablehnung; fehlte der Satz, wäre aus dem Papier
 * nicht zu ersehen, welche der beiden Rechnungen gilt.
 */
describe('Zählweise in Worten', () => {
	it('nennt bei der Auffangregel das Gesetz und keine Fundstelle', () => {
		const satz = zaehlweiseInWorten('per_owner', false, null);
		expect(satz).toContain('je Eigentümer');
		expect(satz).toContain('712m');
		expect(satz).not.toContain('Reglement');
	});

	it('ignoriert bei der Auffangregel eine trotzdem gesetzte Fundstelle', () => {
		// Sonst stünde auf dem Beleg ein Reglementsverweis, der nichts stützt.
		expect(zaehlweiseInWorten('per_owner', true, 'Art. 28 Abs. 1')).toBe(
			zaehlweiseInWorten('per_owner', false, null)
		);
	});

	it('nennt bei der Zählung je Einheit die Fundstelle', () => {
		const satz = zaehlweiseInWorten('per_unit', false, 'Art. 28 Abs. 1 Reglement');
		expect(satz).toContain('je Einheit');
		expect(satz).toContain('gestützt auf Art. 28 Abs. 1 Reglement');
		expect(satz).toContain('weicht von der gesetzlichen Auffangregel ab');
	});

	it('ergänzt die Quelle, wenn die Fundstelle nur den Artikel nennt', () => {
		/*
		 * **Befund des Auftraggebers vom 28.08.2026:** «Gezählt wird eine Kopfstimme je
		 * Einheit, gestützt auf Art. 18.» müsste «Art. 18 Reglement» heissen.
		 * Das Feld ist frei; wer «Art. 18» einträgt, meint seinen
		 * Reglementsartikel, und im Protokoll stand dann ein Artikel ohne
		 * Gesetz — ein Leser sucht ihn im ZGB.
		 *
		 * Der bestehende Fall darüber übergibt «Art. 28 Abs. 1 Reglement» und
		 * traf die Lücke deshalb nie.
		 */
		expect(zaehlweiseInWorten('per_unit', false, 'Art. 18')).toContain(
			'gestützt auf Art. 18 des Reglements'
		);
		expect(stichentscheidInWorten('verwalter', 'Art. 18')).toContain(
			'gestützt auf Art. 18 des Reglements'
		);
	});

	it('sagt beim Verwalter-Stichentscheid, dass die Klausel gilt und die Ablehnung empfohlen ist', () => {
		/*
		 * **Produktentscheid 28.09.2026.** Der Satz nennt die Regel, die
		 * Empfehlung und den Vorbehalt zur Befugnis eines Verwalters. Die
		 * Fundstelle bleibt genannt.
		 */
		const satz = stichentscheidInWorten('verwalter', 'Art. 7 Ziff. 5');
		// A5, Punkt 12a: die Grenze steht am Versprechen.
		expect(satz).toContain('Die Klausel wird nur beim einfachen Mehr ohne Wertquoten angewandt');
		expect(satz).toContain('nur beim einfachen Mehr ohne Wertquoten angewandt');
		expect(satz).toContain('Der Entscheid wird eingetragen');
		expect(satz).toContain('Dem Verwalter wird empfohlen, den Antrag abzulehnen');
		expect(satz).toContain('Rz. 187');
		expect(satz).toContain('ZGB Art. 712m Abs. 2 mit Art. 75');
		// Die Fundstelle bleibt genannt; «Art. 7 Ziff. 5» ist mehr als eine blosse
		// Gliederung und wird deshalb nicht um «des Reglements» ergänzt.
		expect(satz).toContain('gestützt auf Art. 7 Ziff. 5');
		// Der Quotenstichentscheid bleibt, wie er war.
		expect(stichentscheidInWorten('wertquote', 'Art. 30 Reglement')).toContain(
			'Bei Stimmengleichheit entscheidet die Anteilsberechtigung'
		);
	});

	it('nennt bei Kaskade und Vorsitz die Stufen, die Empfehlung je Person und die Frist', () => {
		/*
		 * **Codeprüfung 07.10.2026, M3.** Das Protokoll übernimmt nur diesen
		 * Satz; Empfehlung und Frist müssen also auch bei den neuen Werten hier
		 * stehen. Beim Vorsitz ohne den Einwand gegen den Verwalter
		 * (Fachprüfung 07.10.2026, F2).
		 */
		const kaskade = stichentscheidInWorten('wertquote_verwalter', 'Art. 33 Abs. 2');
		expect(kaskade).toContain('zuerst die Wertquoten');
		expect(kaskade).toContain('ab Erhalt des Protokolls');
		expect(kaskade).toContain('entscheidet der Verwalter');
		expect(kaskade).toContain('Dem Verwalter wird empfohlen, den Antrag abzulehnen');
		expect(kaskade).toContain('ZGB Art. 712m Abs. 2 mit Art. 75');

		const vorsitz = stichentscheidInWorten('wertquote_vorsitz', 'Art. 33 Abs. 2');
		expect(vorsitz).toContain('entscheidet die Person im Vorsitz');
		expect(vorsitz).toContain('zulässige Lösung im Reglement');
		expect(vorsitz).toContain('keine Richtung');
		// Der Satz steht im Protokoll; der Programmname gehört nicht hinein (L3).
		expect(vorsitz).not.toContain('Votum');
		expect(vorsitz).not.toContain('umstritten');
		expect(vorsitz).toContain('ZGB Art. 712m Abs. 2 mit Art. 75');

		const allein = stichentscheidInWorten('vorsitz', 'Art. 33 Abs. 2');
		expect(allein).toContain('die Person im Vorsitz als entscheidende Person');
		// A5, Punkt 12a: die Grenze gehört in jeden Personensatz; das Wort
		// «Wertquoten» steht seitdem auch hier, in der Grenze.
		expect(allein).toContain('nur beim einfachen Mehr ohne Wertquoten');
	});

	it('lässt jede Fundstelle in Ruhe, die mehr sagt als Artikel und Absatz', () => {
		/*
		 * **Die Ergänzung ist eng geschnitten, und das muss sie sein.** Eine
		 * erste Fassung hängte «des Reglements» an alles, worin das Wort nicht
		 * vorkam — «Art. 712m Abs. 2 ZGB» wäre zu «… ZGB des Reglements»
		 * geworden, im gesiegelten PDF. Die Fundstelle muss auch gar kein
		 * Reglement sein: Das Regelwerk nennt den Begründungsakt ausdrücklich
		 * als taugliche Grundlage (`rules/quorum-2026-07-30.ts`).
		 */
		for (const f of [
			'Art. 18 Reglement',
			'Art. 18 des Reglements vom 3. Mai 2019',
			'Art. 712m Abs. 2 ZGB',
			'Begründungsakt Ziff. 5',
			'Vereinbarung aller Eigentümer vom 1. Juni 2024'
		]) {
			expect(zaehlweiseInWorten('per_unit', false, f)).toContain(`gestützt auf ${f}`);
			expect(zaehlweiseInWorten('per_unit', false, f)).not.toContain(`${f} des Reglements`);
		}
	});

	it('ergänzt auch Absatz und Buchstabe, solange nichts anderes dabeisteht', () => {
		for (const f of ['Art. 18 Abs. 2', 'Art. 712m', 'Ziff. 5', '§ 12', 'Art. 18 Abs. 2 lit. a']) {
			expect(zaehlweiseInWorten('per_unit', false, f)).toContain(
				`gestützt auf ${f} des Reglements`
			);
		}
	});

	it('sagt es ausdrücklich, wenn die Fundstelle fehlt', () => {
		// Eine benannte Lücke lässt sich vor der nächsten Versammlung schliessen,
		// eine verschwiegene fällt erst im Streitfall auf.
		const satz = zaehlweiseInWorten('per_unit', false, null);
		expect(satz).toContain('ohne im System vermerkte Fundstelle');
	});

	it('behandelt eine Fundstelle aus Leerzeichen wie eine fehlende', () => {
		expect(zaehlweiseInWorten('per_unit', false, '   ')).toBe(
			zaehlweiseInWorten('per_unit', false, null)
		);
	});

	it('sagt in beide Richtungen, ob Nebenobjekte eine Kopfstimme tragen', () => {
		expect(zaehlweiseInWorten('per_unit', true, 'Ziff. 14')).toContain(
			'Nebenobjekte tragen dabei eine eigene Kopfstimme'
		);
		expect(zaehlweiseInWorten('per_unit', false, 'Ziff. 14')).toContain(
			'Nebenobjekte tragen dabei keine Kopfstimme'
		);
	});
});

/*
 * Ä-43, Produktentscheid 17.09.2026 (Auftrag M4, Migration 163): Pflichtfeld
 * «Trägerschaft gemäss Grundbuch», sobald Gemeinschaften Mitglied sind; der
 * Bestand bleibt leer und wird beim nächsten Speichern verlangt.
 */
describe('Trägerschaft gemäss Grundbuch', () => {
	it('verlangt sie beim Anlegen mit Häusern, sonst nicht', () => {
		expect(() => legeGemeinschaftAn('g1', 'b1', GRUNDFALL, [], true)).toThrow(/Trägerschaft/);
		const ohne = legeGemeinschaftAn('g1', 'b1', GRUNDFALL, [], false);
		expect(ohne.ergebnis.traegerschaft).toBeUndefined();
		const mitWert = legeGemeinschaftAn(
			'g1',
			'b1',
			mit({ traegerschaft: 'stammgrundstueck' }),
			[],
			true
		);
		expect(mitWert.ergebnis.traegerschaft).toBe('stammgrundstueck');
		expect(mitWert.ereignisse[0].angaben).toMatchObject({ traegerschaft: 'stammgrundstueck' });
	});

	it('weist einen unbekannten Wert ab, statt ihn still zu verwerfen', () => {
		expect(() =>
			pruefeGemeinschaft(mit({ traegerschaft: 'erfunden' as never }))
		).toThrow(FachlicherFehler);
	});

	it('verlangt sie beim Bearbeiten einer Anlage mit Häusern, die noch keine trägt', () => {
		const bisher = legeGemeinschaftAn('g1', 'b1', GRUNDFALL).ergebnis;
		expect(() => aendereGemeinschaft(bisher, mit({ name: 'Neu' }), [], 0, true)).toThrow(
			/Trägerschaft/
		);
		// Ohne Häuser bleibt das Bearbeiten frei.
		expect(() => aendereGemeinschaft(bisher, mit({ name: 'Neu' }), [], 0, false)).not.toThrow();
		const u = aendereGemeinschaft(bisher, mit({ traegerschaft: 'personen' }), [], 0, true);
		expect(u.ergebnis.traegerschaft).toBe('personen');
		expect(u.ereignisse[0].angaben).toMatchObject({
			felder: { traegerschaft: { vorher: undefined, nachher: 'personen' } }
		});
	});

	it('lässt den gespeicherten Wert stehen, wenn das Feld nicht mitkommt', () => {
		const bisher = legeGemeinschaftAn(
			'g1',
			'b1',
			mit({ traegerschaft: 'stockwerkanteile' }),
			[],
			true
		).ergebnis;
		const u = aendereGemeinschaft(bisher, mit({ name: 'Neu' }), [], 0, true);
		expect(u.ergebnis.traegerschaft).toBe('stockwerkanteile');
	});
});
