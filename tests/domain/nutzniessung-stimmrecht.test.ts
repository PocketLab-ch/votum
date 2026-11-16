/**
 * Wer bei Nutzniessung stimmt (Welle 3, FR-22 letzter Punkt).
 *
 * **ZGB Art. 712o Abs. 2:** «Ebenso haben sich der Eigentümer und der
 * Nutzniesser eines Stockwerkes über die Ausübung des Stimmrechtes zu
 * verständigen, ansonst der Nutzniesser in allen Fragen der Verwaltung mit
 * Ausnahme der bloss nützlichen oder der Verschönerung und Bequemlichkeit
 * dienenden baulichen Massnahmen als stimmberechtigt gilt.»
 *
 * Zwei Dinge daraus tragen diesen Prüfstand: Die **Verständigung geht vor**
 * («ansonst»), und die Ausnahme nennt **genau zwei** bauliche Fälle — alles
 * andere ist Verwaltung.
 */
import { describe, expect, it } from 'vitest';
import {
	gegenstandAus,
	stimmrechtBeiNutzniessung,
	type Beschlussgegenstand
} from '$lib/domain/nutzniessung';
import { GESCHAEFTSARTEN, type Geschaeftsart } from '$lib/domain/regelwerk';
import { holeRegelwerk } from '$lib/rules';
import { SONDERINHALT_KNOTEN } from '$lib/rules/quorum-2026-10-19';

const OHNE_VEREINBARUNG = { holderName: 'Frau Keller', hasAgreement: false };

describe('Der Beschlussgegenstand aus der Geschäftsart', () => {
	const erwartet: [Geschaeftsart, Beschlussgegenstand][] = [
		['baulich_notwendig', 'notwendige_bauliche_massnahme'],
		['baulich_nuetzlich', 'nuetzliche_bauliche_massnahme'],
		['baulich_luxurioes', 'verschoenernde_bauliche_massnahme'],
		['verwaltung_gewoehnlich', 'verwaltung'],
		['verwaltung_wichtig', 'verwaltung'],
		['organe', 'verwaltung'],
		['jahresgeschaefte', 'verwaltung'],
		['hausordnung', 'verwaltung'],
		['reglement', 'verwaltung'],
		['nutzungsrechte', 'verwaltung'],
		// Zweckänderung und Verfügung sind keine Verwaltung im Sinn von
		// ZGB Art. 712o Abs. 2 (Rz. 46 ad Art. 712o): Der Nutzniesser kann weder
		// über die Sache verfügen noch ihren Zweck ändern (Art. 769).
		['nutzungsaenderung', 'nutzungsaenderung'],
		['grundordnung', 'grundordnung'],
		['sonderfall', 'verwaltung'],
		['kenntnisnahme', 'verwaltung'],
		/*
		 * Der Ordnungsantrag über das Rückkommen selbst. Er steht hier nur als
		 * Rückfall: Wo der aufzuhebende Beschluss eine Geschäftsart trägt, behält
		 * das Rückkommen sie (`domain/rueckkommen.ts`), damit eine bauliche
		 * Massnahme nicht über den Umweg des Verfahrens in die Auffangregel fällt.
		 */
		['rueckkommen', 'verwaltung']
	];

	it.each(erwartet)('ordnet %s als %s ein', (art, gegenstand) => {
		expect(gegenstandAus(art)).toBe(gegenstand);
	});

	it('deckt jede Geschäftsart des Regelwerks ab', () => {
		// Damit eine neu hinzukommende Art hier auffällt und nicht stillschweigend
		// als «Verwaltung» durchgeht.
		for (const g of GESCHAEFTSARTEN) {
			expect(erwartet.some(([art]) => art === g.art)).toBe(true);
		}
	});

	it('rät nicht, wenn die Geschäftsart fehlt', () => {
		// Ein Erfordernis darf «ohne Herleitung» gesetzt werden — dann gibt es
		// keine Geschäftsart.
		expect(gegenstandAus(null)).toBeNull();
		expect(gegenstandAus(undefined)).toBeNull();
	});
});

describe('Ohne Vereinbarung greift die Auffangregel', () => {
	it('gibt dem Eigentümer die Stimme bei nützlichen Massnahmen', () => {
		const b = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'baulich_nuetzlich');
		expect(b.wer).toBe('eigentuemer');
		expect(b.vonHand).toBe(false);
		expect(b.satz).toMatch(/nützliche bauliche Massnahme/);
		expect(b.satz).toMatch(/712o/);
	});

	it('gibt dem Eigentümer die Stimme bei luxuriösen Massnahmen', () => {
		const b = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'baulich_luxurioes');
		expect(b.wer).toBe('eigentuemer');
		// **Beide Wörter im Satz.** Der Ratgeber der Webseite sagt «luxuriös», das
		// Gesetz «der Verschönerung und Bequemlichkeit dienend» — wer nur eines
		// liest, vermutet zwei Kategorien.
		expect(b.satz).toMatch(/Verschönerung oder Bequemlichkeit/);
		expect(b.satz).toMatch(/luxuriöse/);
	});

	it('gibt dem Eigentümer die Stimme bei Zweckänderung und Verfügung', () => {
		/*
		 * **Die Berichtigung vom 27.09.2026.** Bis dahin fielen beide
		 * Geschäftsarten unter «Verwaltung» und damit an den Nutzniesser. Nach
		 * Rz. 46 ad Art. 712o sind Verfügung und Zweckänderung aber nicht von
		 * Abs. 2 erfasst; ohne Absprache stimmt dort der Eigentümer.
		 */
		const zweck = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'nutzungsaenderung');
		expect(zweck.wer).toBe('eigentuemer');
		expect(zweck.vonHand).toBe(false);
		expect(zweck.satz).toMatch(/Zweckänderung/);
		expect(zweck.satz).toMatch(/Art\. 712o Rz\. 46/);

		const grundordnung = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'grundordnung');
		expect(grundordnung.wer).toBe('eigentuemer');
		expect(grundordnung.vonHand).toBe(false);
		expect(grundordnung.satz).toMatch(/Grundordnung/);
		expect(grundordnung.satz).toMatch(/Art\. 712o Rz\. 46/);
	});

	it('ordnet unter der Nutzungsänderung je Knoten zu', () => {
		/*
		 * **Die Geschäftsart allein ist zu grob** (27.09.2026). Unter
		 * `nutzungsaenderung` steht auch die Benutzungsweise nach Art. 647b
		 * Abs. 1, eine wichtigere Verwaltungshandlung: Dort stimmt der
		 * Nutzniesser. Gegenprobe: ohne Knoten fiele sie an den Eigentümer.
		 */
		const ohneKnoten = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'nutzungsaenderung');
		expect(ohneKnoten.wer).toBe('eigentuemer');

		const benutzung = stimmrechtBeiNutzniessung(
			OHNE_VEREINBARUNG,
			'nutzungsaenderung',
			'k-benutzungsweise'
		);
		expect(benutzung.wer).toBe('nutzniesser');

		const zweck = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'nutzungsaenderung', 'k-zweckbestimmung');
		expect(zweck.wer).toBe('eigentuemer');

		// Der Grenzfall trägt kein Erfordernis, das eine Zuordnung stützte.
		expect(gegenstandAus('nutzungsaenderung', 'k-grenzfall-nutzung')).toBeNull();
	});

	it('gibt dem Nutzniesser die Stimme bei notwendigen Massnahmen', () => {
		// **Die Falle:** Notwendige bauliche Massnahmen sind Verwaltung im weiteren
		// Sinn. Ausgenommen sind ausdrücklich nur die «bloss nützlichen» und die
		// «der Verschönerung und Bequemlichkeit dienenden».
		const b = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, 'baulich_notwendig');
		expect(b.wer).toBe('nutzniesser');
		expect(b.satz).toMatch(/Frau Keller/);
		// Im eigenen Text «Bewirtschaftung» wie auf der Webseite, das Gesetzeswort
		// dazu — nicht statt dessen.
		expect(b.satz).toMatch(/Bewirtschaftung/);
		expect(b.satz).toMatch(/«Verwaltung»/);
	});

	it('gibt dem Nutzniesser die Stimme in allen Verwaltungsfragen', () => {
		for (const art of ['verwaltung_gewoehnlich', 'verwaltung_wichtig', 'organe', 'reglement'] as const) {
			expect(stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, art).wer).toBe('nutzniesser');
		}
	});
});

describe('Eine Vereinbarung geht vor', () => {
	it('lässt die Anwendung nicht entscheiden', () => {
		/*
		 * **Hier zu raten wäre der schlimmste Fehler dieses Bausteins.** Der
		 * Vertrag kann das Stimmrecht für alle Beschlussarten regeln, auch
		 * umgekehrt zur gesetzlichen Auffangregel. Wer ihn nicht kennt, kann
		 * nichts ableiten — und es geht um die Stimmberechtigung, den ersten
		 * Angriffspunkt jeder Anfechtung.
		 */
		const b = stimmrechtBeiNutzniessung(
			{ holderName: 'Frau Keller', hasAgreement: true, agreementSummary: 'Sie stimmt in allem.' },
			'baulich_nuetzlich'
		);
		expect(b.wer).toBe('unbestimmt');
		expect(b.vonHand).toBe(true);
		expect(b.satz).toMatch(/Vereinbarung/);
		expect(b.satz).toMatch(/geht der gesetzlichen Regel vor/);
		// Der Wortlaut der Vereinbarung steht da — sonst müsste jemand die Akte
		// holen, während vierzehn Leute warten.
		expect(b.satz).toMatch(/Sie stimmt in allem/);
	});

	it('lässt den Vermerk genügen — die Kopie ist ein Nachtrag', () => {
		/*
		 * **Einwand des Auftraggebers vom 05.08.2026:** Der Vertrag liegt schon vor der
		 * Versammlung bei der Bewirtschaftung, weil er die Grundlage der Erfassung
		 * ist. Ihn ein zweites Mal in die Anwendung zu heben, ist eine
		 * Bequemlichkeit, kein Nachweis — wie bei der Vollmacht, wo «Original
		 * vorgelegen» vollwertig ist.
		 */
		const nurVermerk = stimmrechtBeiNutzniessung(
			{
				holderName: 'Frau Keller',
				hasAgreement: true,
				agreementSummary: 'Sie stimmt.',
				contractOnFile: true,
				hasDocument: false
			},
			'verwaltung_gewoehnlich'
		);
		expect(nurVermerk.satz).not.toMatch(/nichts vermerkt/);

		// Eine hinterlegte Kopie genügt selbstverständlich auch.
		const nurKopie = stimmrechtBeiNutzniessung(
			{ holderName: 'Frau Keller', hasAgreement: true, contractOnFile: false, hasDocument: true },
			'verwaltung_gewoehnlich'
		);
		expect(nurKopie.satz).not.toMatch(/nichts vermerkt/);

		// Steht zum Vertrag gar nichts, wird es gesagt — gesperrt wird nichts.
		const garnichts = stimmrechtBeiNutzniessung(
			{ holderName: 'Frau Keller', hasAgreement: true, contractOnFile: false, hasDocument: false },
			'verwaltung_gewoehnlich'
		);
		expect(garnichts.satz).toMatch(/nichts vermerkt/);
		expect(garnichts.wer).toBe('unbestimmt');
	});

	it('sagt es auch ohne hinterlegten Wortlaut', () => {
		const b = stimmrechtBeiNutzniessung(
			{ holderName: 'Frau Keller', hasAgreement: true },
			'verwaltung_gewoehnlich'
		);
		expect(b.wer).toBe('unbestimmt');
		expect(b.satz).toMatch(/Bestimmen Sie danach/);
	});
});

describe('Ohne Geschäftsart', () => {
	it('erfindet die Anwendung keine Antwort', () => {
		const b = stimmrechtBeiNutzniessung(OHNE_VEREINBARUNG, null);
		expect(b.wer).toBe('unbestimmt');
		expect(b.vonHand).toBe(true);
		expect(b.satz).toMatch(/ohne Herleitung gesetzt/);
		expect(b.satz).toMatch(/Bestimmen Sie/);
	});
});

/*
 * **Die Zustimmung neben der Stimme** (Produktentscheid 03.11.2026, fachgeprüft
 * in zwei Runden, `quellen/pruefung/berichte/2026-11-03-votum-f1-fachfragen-fach.md`
 * und `…-fach-runde2.md`, Frage 2 und 2.3). Bei den Wertquoten braucht das
 * Grundbuch die schriftliche Zustimmung des Nutzniessers (SVIT-Kommentar 2023,
 * Art. 712e Rz. 80, 88), bei der Aufhebung ist sie ratsam und unter Umständen
 * nötig (Rz. 62 ad Art. 712f; Art. 712f Abs. 2). Gezählt wird wie bisher.
 *
 * Die Knoten kommen aus der aktuellen Fassung: Wer einen umbenennt, sieht es
 * hier statt im Saal.
 */
describe('Zustimmung der nutzniessenden Person neben der Stimme', () => {
	const rw = holeRegelwerk();
	const knoten = (id: string) => {
		const k = rw.knoten.find((x) => x.id === id);
		if (!k) throw new Error(`Knoten ${id} fehlt in der Fassung ${rw.fassung}`);
		return k;
	};
	const OHNE = { holderName: 'Erna Beispiel', hasAgreement: false };
	const MIT = {
		holderName: 'Erna Beispiel',
		hasAgreement: true,
		agreementSummary: 'Die Nutzniesserin stimmt in allen Fragen.',
		contractOnFile: true
	};
	const WERTQUOTEN =
		'Ändert sich die Wertquote dieser Einheit, braucht es für das Grundbuch zusätzlich die ' +
		'schriftliche Zustimmung von Erna Beispiel. Für die Abstimmung ändert das nichts.';
	const AUFHEBUNG =
		'Holen Sie am sichersten auch die schriftliche Zustimmung von Erna Beispiel ein. Nötig ist ' +
		'sie, wenn die Nutzniessung nicht ohne Nachteil auf das ganze Grundstück übergehen kann; ' +
		'das klärt der Notar.';

	it.each([
		['k-wertquoten-aendern', WERTQUOTEN],
		['k-aufhebung', AUFHEBUNG]
	])('%s ohne Vereinbarung: der Eigentümer stimmt, der Satz steht dabei', (id, satz) => {
		const k = knoten(id);
		const b = stimmrechtBeiNutzniessung(OHNE, k.geschaeftsart, k.id);
		expect(b.wer).toBe('eigentuemer');
		expect(b.vonHand).toBe(false);
		// Bei den Wertquoten als Vorgabe von Votum, nicht als gesichertes Recht (Auftrag «Texte nach
		// 0047», Punkt 9; `quellen` Frage 78).
		expect(b.satz).toMatch(
			id === 'k-wertquoten-aendern'
				? /Ohne Absprache stimmt nach der Vorgabe von Votum der \*\*Eigentümer\*\*, nicht Erna Beispiel; geklärt ist das bei den Wertquoten nicht\. Sicher ist, wenn beide vorher vereinbaren, wer stimmt, oder beide gleich abstimmen\./
				: /Ohne Absprache stimmt deshalb der \*\*Eigentümer\*\*, nicht Erna Beispiel\./
		);
		expect(b.satz.endsWith(` ${satz}`)).toBe(true);
	});

	it.each([
		['k-wertquoten-aendern', WERTQUOTEN],
		['k-aufhebung', AUFHEBUNG]
	])('%s mit Vereinbarung: die Stimme bleibt offen, die Zustimmung bleibt nötig', (id, satz) => {
		const k = knoten(id);
		const b = stimmrechtBeiNutzniessung(MIT, k.geschaeftsart, k.id);
		expect(b.wer).toBe('unbestimmt');
		expect(b.vonHand).toBe(true);
		expect(b.satz).toMatch(/Bestimmen Sie danach, wer stimmt\./);
		expect(b.satz.endsWith(` ${satz}`)).toBe(true);
	});

	it('Gegenprobe: der Sonderinhalt, auch Grundordnung, bekommt keinen der Sätze', () => {
		const k = knoten(SONDERINHALT_KNOTEN);
		expect(k.geschaeftsart).toBe('grundordnung');
		for (const n of [OHNE, MIT]) {
			const b = stimmrechtBeiNutzniessung(n, k.geschaeftsart, k.id);
			expect(b.satz).not.toMatch(/schriftliche Zustimmung/);
			expect(b.satz).not.toMatch(/Grundbuch|Notar/);
		}
		// Und ohne Knoten, nur mit der Geschäftsart, ebenso nicht.
		expect(stimmrechtBeiNutzniessung(OHNE, 'grundordnung').satz).not.toMatch(/schriftliche Zustimmung/);
	});

	/*
	 * Endwortlaut T6b der Textrunde zu den Pendenzen nach Regel 43 (Fachprüfung
	 * «Texte nach 0047», F-6): Am Sonderinhalt ist wie bei den Wertquoten nicht
	 * geklärt, ob der Nutzniesser stimmt. Nur an dieser Karte; die übrige
	 * Grundordnung behält den Satz zur Verfügung.
	 */
	it('der Sonderinhalt nennt ohne Absprache den Eigentümer als Vorgabe von Votum (T6b)', () => {
		const k = knoten(SONDERINHALT_KNOTEN);
		const b = stimmrechtBeiNutzniessung(OHNE, k.geschaeftsart, k.id);
		expect(b.wer).toBe('eigentuemer');
		expect(b.satz).toBe(
			'Es geht um eine Reglementsbestimmung über etwas anderes als Nutzung und Verwaltung. Der Nutzniesser ' +
				'stimmt in fast allen Fragen der Verwaltung, nicht bei Verfügungen (ZGB Art. 712o Abs. 2; ' +
				'SVIT-Kommentar 2023, Art. 712o Rz. 45 und 46). Ob er auch über eine solche Bestimmung stimmt, ist ' +
				'nicht geklärt. Ohne Absprache stimmt nach der Vorgabe von Votum der **Eigentümer**, nicht Erna ' +
				'Beispiel. Sicher ist, wenn beide vorher vereinbaren, wer stimmt, oder beide gleich abstimmen.'
		);
		const anders = stimmrechtBeiNutzniessung(OHNE, 'grundordnung', 'k-grundstueck-verkauf');
		expect(anders.satz).toMatch(/^Es geht um das Grundstück oder die Grundordnung\. Über die Sache verfügen/);
	});

	/*
	 * **Heutiges Verhalten festgehalten, nicht gebilligt.** Die Ausschlussklage
	 * trägt die Geschäftsart `sonderfall`; die fällt in `gegenstandAus` in den
	 * Zweig `default` und damit an die Verwaltung: Ohne Absprache stimmt der
	 * Nutzniesser. Ob das richtig ist, ist nicht entschieden; eine Klage gegen
	 * einen Nutzniesser (Art. 649c ZGB) führt Votum ohnehin nicht (Handbuch,
	 * Nutzniessung). Wer das ändert, macht diese Probe rot und sieht es.
	 */
	it('hält fest: bei der Ausschlussklage stimmt ohne Absprache der Nutzniesser (Zweig default)', () => {
		const k = knoten('k-ausschlussklage');
		expect(k.geschaeftsart).toBe('sonderfall');
		expect(gegenstandAus(k.geschaeftsart, k.id)).toBe('verwaltung');
		const b = stimmrechtBeiNutzniessung(OHNE, k.geschaeftsart, k.id);
		expect(b.wer).toBe('nutzniesser');
		expect(b.vonHand).toBe(false);
		expect(b.satz).not.toMatch(/schriftliche Zustimmung/);
	});
});
