/**
 * Was zwischen zwei Fassungen gleich bleiben muss (AD-4).
 *
 * Die Fassung 2026-08-05 sagt von sich, sie ändere **nur Hilfetexte**. Das ist
 * die Art Zusage, die man nicht in einen Kommentar schreibt, sondern nachrechnet:
 * Wer später einen Knoten «nur schnell» in der neuen Fassung ändert, hat sonst
 * die Rechtslage geändert und den Vermerk stehen lassen.
 */
import {
	EINLAGE_VORAUSSETZUNG as EINLAGE_VORAUSSETZUNG_2026_11_18,
	ENTNAHME as ENTNAHME_2026_11_18,
	ERRICHTEN_ERSTE_EINLAGE as ERRICHTEN_ERSTE_EINLAGE_2026_11_18,
	ERRICHTEN_ID as FONDS_ERRICHTEN_2026_11_18,
	ERRICHTEN_INHALT as ERRICHTEN_INHALT_2026_11_18,
	ERRICHTEN_KEINE_DELEGATION as ERRICHTEN_KEINE_DELEGATION_2026_11_18,
	ERRICHTEN_REGLEMENT as ERRICHTEN_REGLEMENT_2026_11_18,
	IN_DER_REGEL_ID as FONDS_IN_DER_REGEL_2026_11_18,
	IN_DER_REGEL_EHER as IN_DER_REGEL_EHER_2026_11_18,
	IN_DER_REGEL_GRUND as IN_DER_REGEL_GRUND_2026_11_18,
	UEBER_DAUER as UEBER_DAUER_2026_11_18,
	UEBER_FUNDSTELLEN as UEBER_FUNDSTELLEN_2026_11_18,
	UEBER_GRENZE as UEBER_GRENZE_2026_11_18,
	UEBER_HOEHE as UEBER_HOEHE_2026_11_18,
	UEBER_MINDEST as UEBER_MINDEST_2026_11_18,
	UEBER_REGLEMENT_ID as FONDS_UEBER_2026_11_18
} from '$lib/rules/quorum-2026-11-18';
import { HINWEIS_GEWOEHNLICH as HINWEIS_GEWOEHNLICH_2026_10_24 } from '$lib/rules/quorum-2026-10-24';
import {
	DELEGATION_GESPERRT as DELEGATION_GESPERRT_2026_10_27,
	HINWEIS_ALLTAG as HINWEIS_ALLTAG_2026_10_27,
	HINWEIS_ORGAN as HINWEIS_ORGAN_2026_10_27,
	HINWEIS_STATT as HINWEIS_STATT_2026_10_27,
	UEBERTRAGUNG_BESCHLUSS as UEBERTRAGUNG_BESCHLUSS_2026_10_27
} from '$lib/rules/quorum-2026-10-27';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, alleFassungen, holeRegelwerk, holeRegelwerkFuerAnzeige } from '$lib/rules';
import { kenntnisnahme } from '$lib/rules/quorum-2026-10-09';
import { kenntnisnahmeUniversal } from '$lib/rules/quorum-2026-10-10';
import {
	ausschlussklage as ausschlussklage1011,
	GEMEINSAME_WOHNUNG,
	GEMEINSAME_WOHNUNG_UNTER_REGEL,
	GEMEINSAME_WOHNUNG_WEBSITE,
	KENNTNISNAHME_NEU,
	kenntnisnahme as kenntnisnahme1011,
	KLEINE_GEMEINSCHAFTEN
} from '$lib/rules/quorum-2026-10-11';
import {
	ANGEHOERIGE_ANWENDUNG,
	ANGEHOERIGE_WEBSITE,
	ausschlussklage as ausschlussklage1012,
	KENNTNISNAHME_1012,
	kenntnisnahme as kenntnisnahme1012
} from '$lib/rules/quorum-2026-10-12';
import {
	NUTZLICH_BETROFFEN_ANWENDUNG,
	NUTZLICH_BETROFFEN_WEBSITE,
	NUTZLICH_KOSTEN_ANWENDUNG,
	NUTZLICH_KOSTEN_WEBSITE
} from '$lib/rules/quorum-2026-10-13';
import { REGLEMENT_MILDERUNG, reglementMilderung } from '$lib/rules/quorum-2026-10-14';
import { fassung20261015, REGLEMENTSRECHT } from '$lib/rules/quorum-2026-10-15';
import { fassung20261016, REGLEMENTSRECHT_NEU } from '$lib/rules/quorum-2026-10-16';
import { AUSWEG_HINWEISE, fassung20261017 } from '$lib/rules/quorum-2026-10-17';
import { fassung20261018, GEGENMEINUNG, RANG } from '$lib/rules/quorum-2026-10-18';
import { EINSPRACHE } from '$lib/rules/quorum-2026-10-20';
import { GEGEN_EIGENTUEMER as GEGEN_EIGENTUEMER_2026_11_10 } from '$lib/rules/quorum-2026-11-10';
import { nachDieserFassung as nachDieserFassung_2026_11_15 } from '$lib/rules/quorum-2026-11-15';
import { ABGRENZUNG as ABGRENZUNG_2026_11_03, GRENZE_NUTZNIESSUNG as GRENZE_2026_11_03, KLAEGER as KLAEGER_2026_11_03, KLAGE_UND_KOSTEN as KOSTEN_2026_11_03 } from '$lib/rules/quorum-2026-11-03';
import {
	DELEGATION_RZ_115 as DELEGATION_RZ_115_2026_11_04,
	EINSPRACHE_BETROFFENE_ANWENDUNG as EINSPRACHE_BETROFFENE_2026_11_04,
	ERMAECHTIGUNG_VORHER as ERMAECHTIGUNG_VORHER_2026_11_04,
	KLAEGER as KLAEGER_2026_11_04
} from '$lib/rules/quorum-2026-11-04';
import { pruefeRegelwerk, regelNurFallgenau, typdefinition } from '$lib/domain/regelwerk';
import { teileHilfe } from '$lib/domain/hilfetext';
import { karteMitReglement, regelGiltFuer, regelReichweite, wendeReglementAn } from '$lib/domain/reglement';
import { erfordernisAusKnoten, ergebniskarte } from '$lib/domain/entscheidbaum';
import type { Kopfbasis, Regelwerk } from '$lib/domain/regelwerk';
import {
	KLAUSEL_BEI_AUSSCHLUSSKLAGE,
	QUOTE_BEKLAGTER,
	VERSCHAERFUNG_ALT_ANFANG
} from '$lib/rules/quorum-2026-10-07';

const ALT = holeRegelwerk('2026-07-30');
const NEU = holeRegelwerk('2026-08-05');

describe('Die Fassung 2026-08-05 gegenüber 2026-07-30', () => {
	it('ändert keinen Ast', () => {
		expect(NEU.aeste).toEqual(ALT.aeste);
	});

	it('ändert keinen Knoten — nicht Typ, nicht Bezugsgrösse, nicht Grundlage', () => {
		// Der eigentliche Prüfpunkt: Hier stünde eine geänderte Rechtslage.
		expect(NEU.knoten).toEqual(ALT.knoten);
	});

	it('ändert keine Frage ausser ihrem Hilfetext', () => {
		expect(NEU.fragen.map((f) => ({ ...f, hilfe: null }))).toEqual(
			ALT.fragen.map((f) => ({ ...f, hilfe: null }))
		);
	});

	it('führt jeden Weg zum selben Ausgang', () => {
		/*
		 * Die Antworten zeigen auf dieselben Ziele — Frage für Frage, Antwort für
		 * Antwort. Damit endet jeder denkbare Weg an demselben Knoten wie vorher.
		 */
		for (const f of ALT.fragen) {
			const neu = NEU.fragen.find((x) => x.id === f.id);
			expect(neu?.antworten.map((a) => [a.id, a.ziel])).toEqual(
				f.antworten.map((a) => [a.id, a.ziel])
			);
		}
	});

	it('schärft die Hilfe genau dort, wo gemessen wurde', () => {
		/*
		 * **Der Grund für die Fassung.** Am 05.08.2026 ordnete ein Modell einen
		 * Liftanbau in drei von vier Läufen als «notwendige bauliche Massnahme»
		 * ein — es beantwortete «nötig, um Wert oder Gebrauchsfähigkeit zu
		 * erhalten?» mit Ja für etwas, das es vorher gar nicht gab. Der Hilfetext
		 * sagte, was Erhaltung ist, aber nicht, was sie nicht ist.
		 */
		const f11 = NEU.fragen.find((f) => f.id === 'f1-1')!;
		expect(f11.hilfe).toMatch(/Erhalten lässt sich nur, was schon da ist/);
		expect(f11.hilfe).toMatch(/Lift/);
		// Und die Gegenseite nennt den Lift als Beispiel, damit die Abgrenzung von
		// beiden Seiten steht.
		expect(NEU.fragen.find((f) => f.id === 'f1-2')!.hilfe).toMatch(/Lift/);
	});

	it('lässt die alte Fassung unangetastet', () => {
		// Sie trägt Beschlüsse, die schon gefasst sind.
		expect(ALT.fragen.find((f) => f.id === 'f1-1')!.hilfe).not.toMatch(/Erhalten lässt sich nur/);
		expect(alleFassungen().map((r) => r.fassung)).toEqual([
			'2026-11-18',
			'2026-11-17',
			'2026-11-16',
			'2026-11-15',
			'2026-11-14',
			'2026-11-13',
			'2026-11-11',
			'2026-11-10',
			'2026-11-05',
			'2026-11-04',
			'2026-11-03',
			'2026-10-30',
			'2026-10-29',
			'2026-10-28',
			'2026-10-27',
			'2026-10-26',
			'2026-10-25',
			'2026-10-24',
			'2026-10-23',
			'2026-10-22',
			'2026-10-21',
			'2026-10-20',
			'2026-10-19',
			'2026-10-18',
			'2026-10-17',
			'2026-10-16',
			'2026-10-15',
			'2026-10-14',
			'2026-10-13',
			'2026-10-12',
			'2026-10-11',
			'2026-10-10',
			'2026-10-09',
			'2026-10-08',
			'2026-10-07',
			'2026-10-06',
			'2026-10-05',
			'2026-10-04',
			'2026-10-03',
			'2026-10-02',
			'2026-10-01',
			'2026-09-30',
			'2026-09-29',
			'2026-09-28',
			'2026-09-27',
			'2026-09-26',
			'2026-09-25',
			'2026-09-24',
			'2026-09-23',
			'2026-09-22',
			'2026-09-21',
			'2026-08-16',
			'2026-08-15',
			'2026-08-05',
			'2026-07-30'
		]);
	});
});

/*
 * Die Fassung 2026-08-15 setzt die Blöcke 1 und 2 des Befundberichts vom
 * 15.08.2026 um (`docs/befunde-entscheidbaum-2026-08-15.md`) und verspricht
 * dabei: **Kein bestehender Knoten ändert sein Ergebnis.** Geändert sind
 * Texte, Belege, Hilfen, neue Wege (Grenzfall notwendig/nützlich, dritte
 * f1-4-Antwort, Vorkaufsrecht-Weiche) und das Reglementsverhalten — nicht
 * aber Typ, Basen oder Zustimmungserfordernisse. Die als Lehrstreit
 * ausgewiesenen Punkte (Block 3) warten auf die juristische Gegenlesung.
 * Dieser Test rechnet die Zusage nach, statt sie zu versprechen.
 */
describe('Die Fassung 2026-08-15 gegenüber 2026-08-05', () => {
	const BASIS = holeRegelwerk('2026-08-05');
	const NEU15 = holeRegelwerk('2026-08-15');

	it('besteht den Regelwerks-Wächter — bis auf den damals unerkannten B-2-Widerspruch', () => {
		// Die Formel-Regel des Wächters entstand mit der Fassung 2026-08-16
		// (Befund B-2): Die eingefrorene 08-15 zeigt an der Ausschlussklage
		// noch die Typformel der Anwesenden neben der Basis «alle ausser dem
		// Beklagten». Eingefrorene Fassungen werden nicht angefasst (AD-4) —
		// der Wächter darf genau diesen einen, bekannten Befund melden.
		expect(pruefeRegelwerk(NEU15)).toEqual([
			'Knoten «k-ausschlussklage» zählt nach «alle_ausser_betroffene», zeigte aber die Typformel der Anwesenden — er braucht eine eigene Formel.'
		]);
	});

	it('ändert an keinem bestehenden Knoten das Ergebnis', () => {
		for (const alt of BASIS.knoten) {
			const neu = NEU15.knoten.find((k) => k.id === alt.id);
			expect(neu, alt.id).toBeDefined();
			expect(neu!.typ, alt.id).toBe(alt.typ);
			expect(neu!.kopfbasis, alt.id).toBe(alt.kopfbasis);
			expect(neu!.quotenbasis, alt.id).toBe(alt.quotenbasis);
			expect(neu!.zustimmungBetroffenerNoetig, alt.id).toBe(alt.zustimmungBetroffenerNoetig);
			expect(neu!.geschaeftsart, alt.id).toBe(alt.geschaeftsart);
		}
	});

	it('lässt die Lehrstreit-Punkte ausdrücklich unangetastet', () => {
		// L-1: Zählbasis der Ausschlussklage — bleibt bis zur Gegenlesung.
		const ausschluss = NEU15.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		expect(ausschluss.kopfbasis).toBe('alle_ausser_betroffene');
		// L-3: Prozessführung bleibt einfaches Mehr mit unverändertem Beleg.
		const prozess = NEU15.knoten.find((k) => k.id === 'k-prozessfuehrung')!;
		expect(prozess.typ).toBe('einfaches_mehr');
		expect(prozess.rechtsgrundlage).toBe('ZGB Art. 712t Abs. 2');
		// L-2: Die Selbstverschärfungs-Begründung bleibt, bis die juristische Gegenleserin entschieden hat.
		const schranke = NEU15.knoten.find((k) => k.id === 'k-reglement-eigene-schranke')!;
		expect(schranke.typ).toBe('einstimmigkeit');
	});

	it('hat genau einen neuen Knoten: den Grenzfall notwendig/nützlich', () => {
		const neueIds = NEU15.knoten.map((k) => k.id).filter((id) => !BASIS.knoten.some((k) => k.id === id));
		expect(neueIds).toEqual(['k-grenzfall-baulich']);
		expect(NEU15.knoten.find((k) => k.id === 'k-grenzfall-baulich')!.typ).toBe('grenzfall');
	});

	it('trägt an jedem entscheidungsfähigen Knoten das Reglementsverhalten', () => {
		for (const k of NEU15.knoten) {
			const ohneErfordernis = k.typ === 'grenzfall' || k.typ === 'keine_abstimmung';
			if (ohneErfordernis) expect(k.reglementsverhalten, k.id).toBeUndefined();
			else expect(k.reglementsverhalten, k.id).toBeDefined();
		}
	});

	it('lässt jede alte Antwort bestehen — ausser den zwei angesagten', () => {
		// f1-3-ja wurde in zwei benannte Ja-Antworten geteilt (Laienleser:
		// Doppelfrage); f4-1-verwendung zielt neu auf f1-0 (Befund B-18). Alles
		// andere führt unverändert dorthin, wohin es führte.
		for (const altFrage of BASIS.fragen) {
			const neuFrage = NEU15.fragen.find((f) => f.id === altFrage.id)!;
			for (const alt of altFrage.antworten) {
				if (alt.id === 'f1-3-ja') continue;
				const neu = neuFrage.antworten.find((a) => a.id === alt.id);
				expect(neu, alt.id).toBeDefined();
				if (alt.id === 'f4-1-verwendung') {
					expect(neu!.ziel).toBe('f1-0');
					continue;
				}
				expect(neu!.ziel, alt.id).toBe(alt.ziel);
			}
		}
	});

	it('setzt die inhaltlichen Befunde um', () => {
		// B-1: Das dritte Kriterium des ZGB Art. 647d Abs. 1 steht in der Frage.
		expect(NEU15.fragen.find((f) => f.id === 'f1-2')!.text).toMatch(/Gebrauchsfähigkeit/);
		// B-5: Ermächtigt werden Eigentümer, nicht die Bewirtschaftung.
		const f81 = NEU15.fragen.find((f) => f.id === 'f8-1')!;
		expect(f81.antworten[0].text).not.toMatch(/Bewirtschaftung/);
		// B-15/B-16: die neuen Wege.
		expect(NEU15.fragen.find((f) => f.id === 'f1-1')!.antworten.map((a) => a.ziel)).toContain('k-grenzfall-baulich');
		const f14 = NEU15.fragen.find((f) => f.id === 'f1-4')!;
		expect(f14.antworten).toHaveLength(3);
		expect(f14.antworten[2].ziel).toBe('k-baulich-luxurioes');
		// B-14: das reglementarische Vorkaufsrecht hat einen Weg.
		expect(NEU15.fragen.find((f) => f.id === 'f3-1')!.antworten.map((a) => a.ziel)).toContain('k-vorkaufsrecht');
		// B-24: die Wortlaut-Liste ohne den toten 647-Abs.-1bis-Eintrag.
		expect(NEU15.wortlautArtikel).toHaveLength(5);
		expect(NEU15.wortlautArtikel).not.toContain('ZGB Art. 647 Abs. 1bis');
	});
});

/*
 * Die Fassung 2026-08-16 entscheidet die Lehrstreite L-1 bis L-6 des
 * Befundberichts nach dem Strengstprinzip vor (Auftraggeber, 16.08.2026): Bei
 * Uneinigkeit der Quellen gilt die strengere vertretbare Auslegung, und der
 * Streit steht als Hinweis auf der Karte. Genau zwei Knoten ändern ihr
 * Ergebnis — angesagt, nicht still. Die juristische Gegenlesung kann lockern; ein
 * Beschluss nach der strengeren Lesart genügt immer auch der milderen.
 */
describe('Die Fassung 2026-08-16 gegenüber 2026-08-15', () => {
	const BASIS = holeRegelwerk('2026-08-15');
	const NEU16 = holeRegelwerk('2026-08-16');

	it('besteht den Regelwerks-Wächter — einschliesslich der neuen Formel-Regel', () => {
		expect(pruefeRegelwerk(NEU16)).toEqual([]);
	});

	it('ändert genau die zwei angesagten Ergebnisse: L-3 und L-5 auf das qualifizierte Mehr', () => {
		const angesagt = new Set(['k-prozessfuehrung', 'k-zustaendigkeit-gewoehnlich']);
		for (const alt of BASIS.knoten) {
			const neu = NEU16.knoten.find((k) => k.id === alt.id)!;
			if (angesagt.has(alt.id)) {
				expect(neu.typ, alt.id).toBe('qualifiziertes_mehr');
				expect(neu.quotenbasis, alt.id).toBe('alle_quoten');
				expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
			} else {
				expect(neu.typ, alt.id).toBe(alt.typ);
				expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
				expect(neu.quotenbasis, alt.id).toBe(alt.quotenbasis);
			}
			expect(neu.zustimmungBetroffenerNoetig, alt.id).toBe(alt.zustimmungBetroffenerNoetig);
			expect(neu.geschaeftsart, alt.id).toBe(alt.geschaeftsart);
		}
		expect(NEU16.knoten.map((k) => k.id)).toEqual(BASIS.knoten.map((k) => k.id));
	});

	it('L-1: Ausschlussklage behält die strenge Basis, trägt die eigene Formel und weist den Streit aus', () => {
		const k = NEU16.knoten.find((x) => x.id === 'k-ausschlussklage')!;
		expect(k.kopfbasis).toBe('alle_ausser_betroffene');
		expect(k.formel).toMatch(/aller Miteigentümer mit Ausnahme des beklagten/);
		expect(k.begruendung).not.toMatch(/eigene Basisregel/);
		expect(k.hinweise!.join(' ')).toMatch(/Zählbasis ist umstritten/);
		// L-6: Die Reglementssperre heisst «umstritten», nicht mehr «zwingend».
		expect(k.reglementsverhalten).toBe('gesperrt_reglement');
		expect(k.hinweise!.join(' ')).toMatch(/wenn nichts anderes vereinbart ist/);
	});

	it('L-2: Die Selbstverschärfung bleibt angesetzt, aber als ausgewiesene Vorsichtsregel', () => {
		const k = NEU16.knoten.find((x) => x.id === 'k-reglement-eigene-schranke')!;
		expect(k.typ).toBe('einstimmigkeit');
		expect(k.begruendung).not.toMatch(/darf strenger sein/);
		expect(k.begruendung).toMatch(/umstritten/);
		expect(k.hinweise!.join(' ')).toMatch(/5C\.50\/2004/);
	});

	it('L-3 und L-5 weisen ihren Streit samt Fundstellen aus', () => {
		const prozess = NEU16.knoten.find((x) => x.id === 'k-prozessfuehrung')!;
		expect(prozess.rechtsgrundlage).toBe('ZGB Art. 647b Abs. 1 i.V.m. Art. 712t Abs. 2');
		expect(prozess.wortlautAbweichung).toBe(true);
		expect(prozess.hinweise!.join(' ')).toMatch(/5A_198\/2014/);
		const zustaendigkeit = NEU16.knoten.find((x) => x.id === 'k-zustaendigkeit-gewoehnlich')!;
		expect(zustaendigkeit.hinweise!.join(' ')).toMatch(/Rz\. 34.*Rz\. 109|Rz\. 109/);
	});

	it('L-4: Die Einstimmigkeits-Zählung bleibt streng und weist den Streit aus', () => {
		const k = NEU16.knoten.find((x) => x.id === 'k-baulich-luxurioes')!;
		expect(k.typ).toBe('einstimmigkeit');
		expect(k.hinweise!.join(' ')).toMatch(/Rz\. 197/);
	});

	it('ändert keine Frage und keinen Weg', () => {
		expect(NEU16.fragen).toEqual(BASIS.fragen);
		expect(NEU16.aeste).toEqual(BASIS.aeste);
	});

	it('trägt das Strengstprinzip im Freigabevermerk und ist nicht gegengelesen', () => {
		expect(NEU16.fassung).toBe('2026-08-16');
		expect(NEU16.juristischGegengelesen).toBe(false);
		expect(NEU16.freigabevermerk).toMatch(/Strengstprinzip/);
	});
});

/*
 * Die Fassung 2026-09-21 sagt von sich, sie ändere **einen einzigen Text**:
 * `wortlautErklaerung`, dazu den Freigabevermerk. Das ist dieselbe Art Zusage
 * wie bei 2026-08-05, und sie wird hier genauso nachgerechnet.
 *
 * **Warum es diese Fassung überhaupt gibt**, obwohl kein Ergebnis sich ändert:
 * `src/lib/rules/index.ts` lässt bestehende Fassungen nicht anfassen (AD-4).
 * Ein Traktandum speichert die Kennung, unter der sein Erfordernis hergeleitet
 * wurde; wer den Text einer ausgelieferten Fassung ändert, ändert rückwirkend,
 * was unter dieser Kennung stand. Also eine neue Fassung, auch für einen Satz.
 */
const VOR21 = holeRegelwerk('2026-08-16');
const NEU21 = holeRegelwerk('2026-09-21');

describe('Die Fassung 2026-09-21 gegenüber 2026-08-16', () => {
	it('ändert nichts, woraus ein Ergebnis entsteht', () => {
		expect(NEU21.knoten).toEqual(VOR21.knoten);
		expect(NEU21.aeste).toEqual(VOR21.aeste);
		expect(NEU21.fragen).toEqual(VOR21.fragen);
		expect(NEU21.ergebnistypen).toEqual(VOR21.ergebnistypen);
		expect(NEU21.wortlautArtikel).toEqual(VOR21.wortlautArtikel);
		/*
		 * **Auch die drei Felder, die auf die Karte gehen** (21.09.2026, aus
		 * dem Code-Review). `reglementsvorbehalt` und `gemischteGeschaefte`
		 * setzt `entscheidbaum.ts` auf jede Ergebniskarte, und der erste ist
		 * ausserdem der Grundtext, auf dem `domain/reglement.ts` bei
		 * hinterlegten Regeln aufbaut. Aus ihnen entsteht Kartentext, also
		 * gehören sie in einen Test, der «ändert nichts» im Titel trägt.
		 * `quellen` steht daneben, weil eine Fassung sonst unbemerkt eine
		 * Fundstelle verlieren könnte.
		 */
		expect(NEU21.reglementsvorbehalt).toEqual(VOR21.reglementsvorbehalt);
		expect(NEU21.gemischteGeschaefte).toEqual(VOR21.gemischteGeschaefte);
		expect(NEU21.quellen).toEqual(VOR21.quellen);
	});

	it('trägt genau den Wortlaut, der auf der Website geprüft wurde', () => {
		/*
		 * **Warum ein Test und nicht ein Kommentar.** Der Satz ging auf der
		 * Website durch eine Fach- und eine Laienprüfung; hier steht er ein
		 * zweites Mal. Zwei Orte mit demselben Text laufen auseinander, sobald
		 * einer geändert wird, und der Abzug für die Website entsteht aus
		 * dieser Datei. Der Test hält fest, was der geprüfte Wortlaut trägt,
		 * damit eine spätere Änderung hier auffällt statt dort.
		 *
		 * Geprüft werden die drei Aussagen, um die es ging, nicht der ganze
		 * Satz: Ein Zeichenvergleich wäre beim ersten Komma rot und sagte
		 * nichts darüber, ob die Reichweite noch stimmt.
		 */
		expect(NEU21.wortlautErklaerung).toMatch(/nützlichen baulichen Massnahmen entschieden/);
		expect(NEU21.wortlautErklaerung).toMatch(/zu Art\. 647d/);
		expect(NEU21.wortlautErklaerung).toMatch(/überträgt der SVIT-Kommentar dieselbe Zählweise/);
		expect(NEU21.wortlautErklaerung).toMatch(/äussert sich der Entscheid nicht/);
	});

	it('lässt die pauschale Zuschreibung der Vorfassung hinter sich', () => {
		// Der alte Satz lautete «Das Bundesgericht entscheidet gleich
		// (BGE 144 III 510)» und sagte nicht, wozu.
		expect(VOR21.wortlautErklaerung).toMatch(/entscheidet gleich/);
		expect(NEU21.wortlautErklaerung).not.toMatch(/entscheidet gleich/);
	});

	it('nennt die Vertretung, die in der Regeste fehlt', () => {
		// E. 2.2.4 rechnet «presenti (o rappresentati)»; die Regeste verkürzt
		// auf die Anwesenden. Wer nur sie liest, verliert die Vertretenen.
		expect(NEU21.wortlautErklaerung).toMatch(/anwesend oder vertreten sind/);
	});

	it('nennt für die Reglementsabweichung auch das nötige Mehr', () => {
		// Der Entscheid behält die Abweichung vor, sagt aber nichts über das
		// Mehr. Das folgt aus ZGB Art. 712g Abs. 2.
		expect(NEU21.wortlautErklaerung).toMatch(/Zustimmung aller Eigentümer/);
		expect(NEU21.wortlautErklaerung).toMatch(/712g Abs\. 2/);
	});

	it('ist nicht mehr die aktuelle Fassung, bleibt aber unverändert abrufbar (AD-4)', () => {
		// Seit dem 22.09.2026 läuft die Herleitung unter der Folgefassung. Diese
		// hier bleibt stehen, weil Traktanden ihre Kennung speichern.
		expect(AKTUELLE_FASSUNG).not.toBe('2026-09-21');
		expect(holeRegelwerk('2026-09-21').fassung).toBe('2026-09-21');
		expect(NEU21.juristischGegengelesen).toBe(false);
		// Der Vermerk der Vorfassung bleibt lesbar, der neue kommt dazu.
		expect(NEU21.freigabevermerk).toMatch(/Strengstprinzip/);
		expect(NEU21.freigabevermerk).toMatch(/Reichweite von BGE 144 III 510/);
	});
});

/*
 * Die Fassung 2026-09-22 trägt die vier Rückstände aus dem Website-Abzug
 * zurück, setzt die Befunde B1 bis B6 der Fachprüfung um (ohne B4, siehe
 * unten) und berichtigt eine ausgelieferte Rechtsgrundlage. Ihre Zusage:
 * **kein Ergebnistyp, keine Bezugsgrösse, kein Weg ändert sich.** Wie bei
 * 2026-08-05 und 2026-09-21 wird die Zusage nachgerechnet, nicht geglaubt.
 */
const VOR22 = holeRegelwerk('2026-09-21');
const NEU22 = holeRegelwerk('2026-09-22');

describe('Die Fassung 2026-09-22 gegenüber 2026-09-21', () => {
	it('besteht den Regelwerks-Wächter', () => {
		expect(pruefeRegelwerk(NEU22)).toEqual([]);
	});

	it('ändert an keinem Knoten das Ergebnis — nur Texte und zwei Reglementsverhalten', () => {
		expect(NEU22.knoten.map((k) => k.id)).toEqual(VOR22.knoten.map((k) => k.id));
		for (const alt of VOR22.knoten) {
			const neu = NEU22.knoten.find((k) => k.id === alt.id)!;
			expect(neu.typ, alt.id).toBe(alt.typ);
			expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
			expect(neu.quotenbasis, alt.id).toBe(alt.quotenbasis);
			expect(neu.zustimmungBetroffenerNoetig, alt.id).toBe(alt.zustimmungBetroffenerNoetig);
			expect(neu.geschaeftsart, alt.id).toBe(alt.geschaeftsart);
		}
		expect(NEU22.fragen).toEqual(VOR22.fragen);
		expect(NEU22.aeste).toEqual(VOR22.aeste);
		expect(NEU22.ergebnistypen).toEqual(VOR22.ergebnistypen);
	});

	it('B1: der Grenzfall sagt nicht mehr «ungültig», sondern «anfechtbar»', () => {
		/*
		 * **Die gefährliche Richtung.** Der alte Satz lautete «ist ungültig,
		 * nicht bloss anfechtbar». Wer ihm glaubt, ficht nicht an und steht nach
		 * einem Monat mit einem verbindlichen Beschluss da: BGE 143 III 537
		 * E. 4.2.4 hält den Beschluss trotz verletztem Quorum für bloss
		 * anfechtbar, und Rz. 213 ad Art. 712m rät ausdrücklich, vorsichtshalber
		 * anzufechten, selbst wenn man von der Nichtigkeit überzeugt ist.
		 */
		const k = NEU22.knoten.find((x) => x.id === 'k-grenzfall-nutzung')!;
		expect(k.empfehlung).toMatch(/in der Regel anfechtbar/);
		expect(k.empfehlung).not.toMatch(/ungültig, nicht bloss anfechtbar/);
		// Die Vorfassung trug den alten Satz; sie bleibt, wie sie war (AD-4).
		expect(VOR22.knoten.find((x) => x.id === 'k-grenzfall-nutzung')!.empfehlung).toMatch(
			/ungültig, nicht bloss anfechtbar/
		);
	});

	it('B3: die gewöhnliche Zuständigkeit ist nicht mehr zwingend gesperrt', () => {
		// Art. 647a Abs. 2 lässt die abweichende Regelung ausdrücklich zu
		// (Rz. 34 ad Art. 712g); Rz. 78 nennt sie als die «ausdrücklich
		// anderslautende Gesetzesbestimmung», die Art. 712g Abs. 2 verdrängt.
		expect(
			VOR22.knoten.find((k) => k.id === 'k-zustaendigkeit-gewoehnlich')!.reglementsverhalten
		).toBe('gesperrt_zwingend');
		expect(
			NEU22.knoten.find((k) => k.id === 'k-zustaendigkeit-gewoehnlich')!.reglementsverhalten
		).toBe('frei');
	});

	it('B2: der Luxus-Ausweg folgt der strengeren Lesart', () => {
		expect(
			NEU22.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!.reglementsverhalten
		).toBe('gesperrt_vereinbarung');
	});

	it('A1: die Zählweise steht auf der Norm, die sie trägt', () => {
		/*
		 * **Zwei Entscheide, die bisher für dasselbe zitiert wurden.** Die
		 * Einstimmigkeit für die geänderte Berechnungsweise trägt BGE 143 III 537
		 * E. 4.2.3 im Wortlaut («Cette modification ne peut s'opérer que par
		 * décision unanime»). BGE 144 III 510 trägt sie nicht: Das Wort kommt
		 * dort nicht vor, auch nicht italienisch. Und die Norm ist nicht
		 * Art. 712g Abs. 2, dessen Abs. 1 nur auf Art. 647 ff. verweist, sondern
		 * Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2. Hergeleitet in
		 * `quellen/themen/stockwerkeigentum/fragen.md` Nr. 42.
		 */
		expect(NEU22.wortlautErklaerung).toMatch(/Art\. 712m Abs\. 2 i\.V\.m\. Art\. 67 Abs\. 2/);
		expect(NEU22.wortlautErklaerung).toMatch(/BGE 143 III 537 E\. 4\.2\.3/);
		expect(NEU22.wortlautErklaerung).not.toMatch(/Zustimmung aller Eigentümer \(ZGB Art\. 712g Abs\. 2\)/);
		// Die Vorfassung trägt die falsche Norm weiter; sie ist ausgeliefert.
		expect(VOR22.wortlautErklaerung).toMatch(/Zustimmung aller Eigentümer \(ZGB Art\. 712g Abs\. 2\)/);
		// Der übrige Satz ist unangetastet, nur die Klammer wurde getauscht.
		expect(NEU22.wortlautErklaerung).toMatch(/nützlichen baulichen Massnahmen entschieden/);
		expect(NEU22.wortlautErklaerung).toMatch(/anwesend oder vertreten sind/);
	});

	it('ist nicht mehr die aktuelle Fassung, bleibt aber abrufbar (AD-4)', () => {
		expect(AKTUELLE_FASSUNG).not.toBe('2026-09-22');
		expect(holeRegelwerk('2026-09-22').fassung).toBe('2026-09-22');
		expect(NEU22.juristischGegengelesen).toBe(false);
		expect(NEU22.freigabevermerk).toMatch(/Art\. 712m Abs\. 2 i\.V\.m\. Art\. 67 Abs\. 2/);
	});
});

/*
 * **Der Wächter über die Exportzeile.** `scripts/quorumsbaum-export.mjs`
 * importiert die Fassung ausgeschrieben, weil es ausserhalb von Vite läuft und
 * `index.ts` seine Fassungen endungslos importiert. Wer eine neue Fassung
 * aufnimmt und diese Zeile vergisst, erzeugt einen Abzug mit altem Stand und
 * alter Kennung und überschreibt damit still eine Korrektur auf der Website.
 *
 * Das Export-Skript behauptete diesen Wächter seit dem 21.09.2026 in seinem
 * Kopf, geschrieben war er nie. Beim Aufnehmen der Fassung 2026-09-22 trat
 * genau der Fall ein, vor dem er schützen soll.
 */
describe('Das Export-Skript zieht die aktuelle Fassung', () => {
	it('bezieht die Fassung, unter der die Anwendung herleitet', async () => {
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const { dirname, join } = await import('node:path');
		/*
		 * Über den Dateipfad dieses Tests statt über das Arbeitsverzeichnis:
		 * Ein relativer Pfad hinge daran, aus welchem Verzeichnis der Lauf
		 * gestartet wurde.
		 */
		const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
		const quelle = readFileSync(join(wurzel, 'scripts/quorumsbaum-export.mjs'), 'utf-8');

		/*
		 * **Nur die Codezeilen, nicht der Dateikopf.** Der erste Versuch dieses
		 * Wächters prüfte den ganzen Dateitext auf `holeRegelwerk(` — und der
		 * Kopf des Export-Skripts enthält den Satz «Warum nicht
		 * `holeRegelwerk()` aus `index.ts`». Damit war die Bedingung immer
		 * erfüllt, der Wächter konnte nicht mehr rot werden, und der Fall, für
		 * den er geschrieben wurde, blieb unentdeckt. Gefunden im zweiten
		 * Review-Durchgang am 22.09.2026. Ein Wächter, der seine eigene
		 * Begründung mitliest, misst den Kommentar statt den Code.
		 */
		const code = quelle
			.split('\n')
			.filter((z) => {
				const t = z.trimStart();
				return t !== '' && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
			})
			.join('\n');

		/*
		 * **Geprüft wird die Eigenschaft, nicht eine Schreibweise.** Zulässig
		 * sind zwei Wege: die Fassung ausgeschrieben importieren (heute nötig,
		 * weil das Skript ausserhalb von Vite läuft) oder sie über
		 * `holeRegelwerk()` aus dem Verzeichnis holen (sobald der Exportweg
		 * repariert ist). Ein Test, der nur den ersten Weg kennt, würde rot,
		 * sobald jemand den Defekt behebt.
		 */
		const kennung = AKTUELLE_FASSUNG.replace(/-/g, '_');
		const ausgeschrieben =
			code.includes(`REGELWERK_${kennung}`) && code.includes(`quorum-${AKTUELLE_FASSUNG}`);
		const ausDemVerzeichnis = /holeRegelwerk\s*\(/.test(code);
		expect(
			ausgeschrieben || ausDemVerzeichnis,
			`Das Export-Skript nennt weder REGELWERK_${kennung} noch holeRegelwerk(). ` +
				'Es erzeugte damit einen Abzug mit veralteter Fassung und veralteter Kennung.'
		).toBe(true);

		/*
		 * Und wenn es den ausgeschriebenen Weg geht: keine **ältere** Fassung
		 * in der Importzeile. Sonst stünde die neue Kennung irgendwo im
		 * Kommentar und die alte im Import.
		 */
		if (!ausDemVerzeichnis) {
			const importzeile = code
				.split('\n')
				.find((z) => z.trimStart().startsWith('import { REGELWERK_'));
			expect(importzeile, 'Keine Importzeile mit REGELWERK_ gefunden.').toBeDefined();
			expect(importzeile).toContain(`REGELWERK_${kennung}`);

			/*
			 * **Und die Zeile darunter, die den Import erst benutzt**
			 * (Hinweis website-78, 22.09.2026). Der Import und die Zuweisung
			 * sind zwei Zeilen:
			 *
			 *     import { REGELWERK_2026_09_22 } from '…/quorum-2026-09-22.ts';
			 *     const rw = REGELWERK_2026_09_22;
			 *
			 * Wer eine zweite Fassung dazu importiert und `rw` darauf zeigen
			 * lässt, hielt diesen Wächter grün, während der Abzug still den
			 * alten Stand schreibt. Der Import allein sagt nur, was verfügbar
			 * ist, nicht, was verwendet wird.
			 */
			const zuweisung = code
				.split('\n')
				.find((z) => /^\s*const\s+rw\s*=/.test(z));
			expect(zuweisung, 'Keine Zuweisung `const rw = …` gefunden.').toBeDefined();
			expect(
				zuweisung,
				`Das Export-Skript importiert REGELWERK_${kennung}, verwendet aber eine andere Fassung. ` +
					'Der Abzug bekäme damit den alten Stand samt alter Kennung.'
			).toContain(`REGELWERK_${kennung}`);
		}
	});

	it('kann rot werden: eine veraltete Importzeile fällt auf', async () => {
		/*
		 * **Die Gegenprobe zum Wächter darüber.** Ein Wächter, der nie rot
		 * wird, sieht aus wie ein Schutz und ist keiner; genau das war er einen
		 * Durchgang lang. Hier wird an einer nachgebauten Datei gezeigt, dass
		 * die Prüfung greift, statt es zu behaupten.
		 */
		const kennung = AKTUELLE_FASSUNG.replace(/-/g, '_');
		const veraltet = [
			'/*',
			' * Warum nicht `holeRegelwerk()` aus `index.ts`: geht nicht.',
			' */',
			"import { REGELWERK_2026_08_16 } from '../src/lib/rules/quorum-2026-08-16.ts';"
		].join('\n');
		const code = veraltet
			.split('\n')
			.filter((z) => {
				const t = z.trimStart();
				return t !== '' && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
			})
			.join('\n');
		expect(/holeRegelwerk\s*\(/.test(code)).toBe(false);
		expect(code.includes(`REGELWERK_${kennung}`)).toBe(false);
	});

	it('weist jede neu ausgewiesene Streitfrage auch im Signet aus', async () => {
		/*
		 * **Befund 4 des Code-Reviews vom 22.09.2026.** Das Signet «Streitfrage,
		 * streng ausgelegt» hängt an einer ausdrücklichen Liste im Export, nicht
		 * am Text des Hinweises. Die Fassung 2026-09-22 wies den Streit an zwei
		 * weiteren Knoten aus, ohne die Liste nachzuziehen; der Dateikopf
		 * behauptete das Signet, der Abzug hätte es nicht gezeigt.
		 */
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const { dirname, join } = await import('node:path');
		const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
		const quelle = readFileSync(join(wurzel, 'scripts/quorumsbaum-export.mjs'), 'utf-8');

		/*
		 * **Die Liste wird aus dem Skript gelesen, nicht im Test wiederholt.**
		 * Der erste Versuch verdrahtete die zwei neuen IDs hier fest; beim
		 * nächsten neuen Streit wäre der Wächter wieder ausgefallen, weil
		 * niemand den Test anfasst. Gelesen wird der Inhalt des Set-Literals.
		 */
		const block = quelle.match(/const STREITFRAGEN = new Set\(\[([\s\S]*?)\]\)/);
		expect(block, 'STREITFRAGEN nicht gefunden — wurde die Liste umbenannt?').not.toBeNull();
		/*
		 * **Zwei Listen, ein Signet** (Fassung 2026-11-10, Lesart L12). Seit
		 * `k-baulich-luxurioes` keine `gegenmeinung` mehr trägt, steht er in
		 * `STREITFRAGEN_LESART_STRENG`; das Signet «streng ausgelegt» vergibt
		 * `streitfrageRichtung` aus beiden Listen. Ohne die zweite Liste
		 * meldete der Wächter einen Knoten, dessen Signet sehr wohl steht.
		 */
		const blockLesart = quelle.match(
			/const STREITFRAGEN_LESART_STRENG = new Set\(\[([\s\S]*?)\]\)/
		);
		expect(
			blockLesart,
			'STREITFRAGEN_LESART_STRENG nicht gefunden — wurde die Liste umbenannt?'
		).not.toBeNull();
		const kennungen = (text: string) =>
			text
				.split('\n')
				.map((z) => z.trim())
				.filter((z) => z.startsWith("'"))
				.map((z) => z.slice(1, z.indexOf("'", 1)));
		const eingetragen = new Set([...kennungen(block![1]), ...kennungen(blockLesart![1])]);

		/*
		 * Wessen Ergebnis auf einem ausgewiesenen Streit beruht, trägt das
		 * Signet. Massstab ist, ob das Werkzeug wegen des Streits die strengere
		 * Lesart ansetzt — erkennbar daran, dass der Hinweis «umstritten» sagt
		 * **und** der Knoten eine Reglementssperre trägt. Ein blosser Hinweis
		 * auf einen Lehrstreit, der das Ergebnis nicht trägt (etwa
		 * k-bewirtschaftung-waehlen), braucht kein Signet.
		 */
		/*
		 * **Über alle Fassungen, nicht über eine** (23.09.2026). Diese Probe
		 * stand einen Tag lang auf `NEU22` und prüfte damit die Fassung, die
		 * beim Schreiben gerade aktuell war. Ihr eigener Kommentar hatte davor
		 * gewarnt: «beim nächsten neuen Streit wäre der Wächter wieder
		 * ausgefallen, weil niemand den Test anfasst.» Genau das geschah beim
		 * Fassungswechsel auf 2026-09-23 — er wäre zufällig grün geblieben.
		 *
		 * Geprüft wird jetzt jede bekannte Fassung. Eine eingefrorene kann den
		 * Massstab nicht mehr verletzen, weil sie sich nicht ändert; erfüllt
		 * eine ihn heute nicht, ist das ein echter Befund an der Liste.
		 */
		/*
		 * **Der Massstab und sein Messwert sind nicht dasselbe** (23.09.2026).
		 * Gemessen wird «Hinweis sagt umstritten» und «Knoten ist gesperrt»,
		 * gemeint ist «das Ergebnis beruht auf dem Streit». Die beiden fallen
		 * auseinander, sobald ein gesperrter Knoten einen Streit nennt, der sein
		 * Quorum gar nicht berührt.
		 *
		 * Aufgefallen bei `k-bewirtschaftung-abberufen`: Dort ist umstritten, ob
		 * die Abberufung den Bewirtschaftungsvertrag beendet. Das Quorum steht
		 * davon unberührt in Art. 712r Abs. 1. Bis dahin ging die Karte nur
		 * durch, weil ihr Text das Wort «umstritten» zufällig nicht gebrauchte;
		 * der Wächter mass also die Wortwahl, nicht die Lage.
		 *
		 * Die Ausnahme trägt ihren Grund bei sich und prüft sich selbst: Wer hier
		 * steht, darf **auch nicht** in STREITFRAGEN stehen. Sonst liesse sich
		 * über diese Liste ein Signet stilllegen, das gesetzt gehört.
		 */
		/*
		 * **Die Ausnahme hängt am Streit, nicht an der Karte** (Code-Review
		 * 23.09.2026). Eine Ausnahme auf die Kennung hätte für jeden künftigen
		 * Streit dieser Karte gegolten, auch für einen, der das Quorum trägt,
		 * und wäre dann stillgeblieben: genau der Fehler, gegen den der Wächter
		 * gebaut ist. Das Erkennungsmerkmal bindet sie an den einen Streit, der
		 * gemeint ist. Wechselt der Hinweis das Thema, greift die Ausnahme nicht
		 * mehr und der Wächter meldet wieder.
		 */
		const streitTraegtDasErgebnisNicht = new Map([
			[
				'k-bewirtschaftung-abberufen',
				{
					erkennung: /beendet, ist umstritten/,
					grund:
						'Umstritten ist die Wirkung auf den Vertrag, nicht das Quorum (ZGB Art. 712r Abs. 1).'
				}
			],
			[
				'k-zirkularbeschluss',
				{
					erkennung: /Ob das Reglement eine Urabstimmung/,
					grund:
						'Umstritten ist, ob ein Reglement die Urabstimmung vorsehen darf; die gezeigte ' +
						'Einstimmigkeit steht in Art. 66 Abs. 2 (Fachprüfung der Kurztexte 08.10.2026, Runde 3).'
				}
			]
		]);
		for (const [id, { grund }] of streitTraegtDasErgebnisNicht) {
			expect(eingetragen.has(id), `${id}: ${grund}`).toBe(false);
		}

		/*
		 * **Was die aktuelle Fassung nicht mehr sperrt, braucht kein Signet**
		 * (07.10.2026, Fassung 2026-10-15). Das Signet steht im Abzug, und der
		 * entsteht aus der aktuellen Fassung. `k-baulich-luxurioes-ausweg` ist in
		 * den eingefrorenen Fassungen gesperrt und nennt dort den Streit; seit
		 * 2026-10-15 wendet das Werkzeug eine mildere Regel an, das Signet «streng
		 * ausgelegt» wäre die entgegengesetzte Aussage. Ein Knoten, den die
		 * aktuelle Fassung weiter sperrt, wird weiter über alle Fassungen geprüft.
		 */
		const heuteGesperrt = new Set(
			AKTUELL.knoten
				.filter((k) => (k.reglementsverhalten ?? '').startsWith('gesperrt_'))
				.map((k) => k.id)
		);
		for (const k of alleFassungen().flatMap((rw) => rw.knoten)) {
			/*
			 * **Nur die Hinweise, nicht der Rechtssatz** (seit 08.10.2026). Der
			 * Rechtssatz sagt, ob ein Reglement abweichen darf; das Signet steht
			 * am gezeigten Quorum, und ein Streit über die Abweichung macht das
			 * gesetzliche Quorum nicht zur strengen Lesart (Fachprüfung des
			 * Abzugs 07.10.2026, Befund 4). Vom 07. bis 08.10.2026 las die Probe
			 * den Rechtssatz mit und verlangte das Signet an Verkauf und
			 * Wertquoten.
			 */
			const umstritten = (k.hinweise ?? []).some((h) => h.includes('umstritten'));
			const gesperrt = (k.reglementsverhalten ?? '').startsWith('gesperrt_');
			if (!umstritten || !gesperrt || !heuteGesperrt.has(k.id)) continue;
			const ausnahme = streitTraegtDasErgebnisNicht.get(k.id);
			if (ausnahme && (k.hinweise ?? []).some((h) => ausnahme.erkennung.test(h))) continue;
			expect(
				eingetragen.has(k.id),
				`${k.id} weist einen Streit aus und ist gesperrt, steht aber in keiner der beiden ` +
					'Streitfragenlisten — auf der Website fehlte das Signet «Streitfrage, streng ausgelegt».'
			).toBe(true);
		}
	});

	/*
	 * **Die Gegenrichtung, und sie hat gefehlt** (Code-Review 23.09.2026).
	 *
	 * Der Wächter darüber misst nur «Streit im Text, aber nicht im Signet». Der
	 * umgekehrte Fall fiel still durch die `continue`-Zeile: Wer den
	 * Streithinweis aus einem Kartentext **entfernt**, während die Kennung in
	 * STREITFRAGEN stehen bleibt, bekommt im Website-Abzug das Signet
	 * «Streitfrage, streng ausgelegt» über einen Text, der keinen Streit nennt.
	 *
	 * **Das ist kein gedachter Fall.** Genau das ist beim Entwurf der Fassung
	 * 2026-09-27 passiert, an zwei Karten zugleich: `hinweise` wurde neu
	 * gesetzt statt ergänzt, und die zwei Lehrstreit-Absätze L-4 und B2 waren
	 * weg. Der Prüflauf blieb grün, weil die eingefrorenen Vorfassungen das
	 * Wort «umstritten» weitertragen und die Schleife oben über
	 * `alleFassungen()` läuft.
	 *
	 * Diese Probe liest deshalb **nur die aktuelle Fassung**: Sie ist die
	 * einzige, aus der der Abzug entsteht.
	 */
	it('jede Karte mit Signet nennt den Streit auch in der aktuellen Fassung', async () => {
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const { dirname, join } = await import('node:path');
		const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
		const quelle = readFileSync(join(wurzel, 'scripts/quorumsbaum-export.mjs'), 'utf-8');
		const block = quelle.match(/const STREITFRAGEN = new Set\(\[([\s\S]*?)\]\)/);
		expect(block, 'STREITFRAGEN nicht gefunden — wurde die Liste umbenannt?').not.toBeNull();
		/*
		 * **Auch die Karten mit strenger Lesart** (Codeprüfung E1 Block B,
		 * Befund 2): Sie tragen dasselbe Signet aus `STREITFRAGEN_LESART_STRENG`,
		 * und ohne diese Liste fiele eine Karte aus der Probe, sobald sie eine
		 * Lesart bekommt (L6, L9, L11, L12).
		 */
		const streng = quelle.match(/const STREITFRAGEN_LESART_STRENG = new Set\(\[([\s\S]*?)\]\)/);
		expect(streng, 'STREITFRAGEN_LESART_STRENG nicht gefunden').not.toBeNull();
		const eingetragen = new Set(
			(block![1] + '\n' + streng![1])
				.split('\n')
				.map((z) => z.trim().replace(/,$/, ''))
				.filter((z) => z.startsWith("'"))
				.map((z) => z.slice(1, z.indexOf("'", 1)))
		);
		expect(eingetragen.has('k-baulich-luxurioes'), 'die Karten mit Lesart fehlen in der Probe').toBe(true);
		expect(eingetragen.size, 'keine Streitfragen gelesen').toBeGreaterThan(0);
		const jetzt = holeRegelwerk();
		for (const id of eingetragen) {
			const k = jetzt.knoten.find((x) => x.id === id);
			expect(k, `STREITFRAGEN nennt «${id}», die aktuelle Fassung kennt den Knoten nicht.`)
				.toBeDefined();
			const texte = [k!.begruendung, k!.empfehlung, ...(k!.hinweise ?? []), k!.reglementsrecht]
				.filter((t): t is string => typeof t === 'string')
				.join(' ');
			expect(
				/umstritten|Lehrstreit|strengere Lesart/.test(texte),
				`${id} trägt im Abzug das Signet «Streitfrage, streng ausgelegt», nennt den Streit ` +
					'aber in keinem Text der aktuellen Fassung. Auf der Website stünde ein Signet ' +
					'ohne Erklärung — und im Saal fehlte der Satz, dass hier die strengere von zwei ' +
					'Lesarten angewandt wird.'
			).toBe(true);
		}
	});
});

/*
 * **Was der Rohknotenvergleich nicht sieht** (Befund 1 des Code-Reviews vom
 * 22.09.2026). Der Test «ändert an keinem Knoten das Ergebnis» weiter oben
 * vergleicht Typ, Basen und Geschäftsart — also genau die Felder, die der
 * Spread ohnehin nicht anfasst. Das `reglementsverhalten` ist aber kein
 * Textmerkmal: `wendeReglementAn` entscheidet allein daran, ob eine
 * hinterlegte Reglementsregel das gesetzliche Erfordernis **ersetzt**. Die
 * zwei Wechsel der Fassung 2026-09-22 drehen damit ein Ergebnis im Saal, und
 * zwar in beide Richtungen. Hier wird das nachgerechnet, statt es im
 * Freigabevermerk zu behaupten.
 */
describe('Die Fassung 2026-09-22 ändert die Wirkung hinterlegter Reglementsregeln', () => {
	function vorbehaltFuer(rw: Regelwerk, knotenId: string) {
		const knoten = rw.knoten.find((k) => k.id === knotenId)!;
		const erfordernis = erfordernisAusKnoten(rw, knoten);
		/*
		 * Eine Regel für die ganze Geschäftsart, ohne knotenId — der Normalfall
		 * auf der Erfassungsseite. **Die Bezugsgrösse wird vom Knoten
		 * übernommen, und das ist nicht Bequemlichkeit:** `nur_mildern` wendet
		 * eine Regel nur an, wenn sie nachweislich milder ist, und eine Regel
		 * auf anderer Bezugsgrösse gilt als «nicht vergleichbar», also ebenfalls
		 * als nicht anwendbar. Mit einer festen Basis hätte dieser Test am
		 * Ausweg-Knoten «vorher nicht angewandt, nachher nicht angewandt»
		 * gemessen und die Ergebnisänderung gerade verfehlt.
		 */
		const regel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart!,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mindestens' as const },
			kopfbasis: knoten.kopfbasis,
			quotenSchwelle: null,
			quotenbasis: 'keine' as const,
			fundstelle: 'Reglement Ziff. 1',
			enthaltungZaehltMit: true
		};
		return wendeReglementAn(erfordernis, [regel], null, LESARTEN_VORGABE).vorbehalt;
	}

	/*
	 * **Und dieselbe Messung mit einer strengeren Regel** (zweiter
	 * Review-Durchgang, 22.09.2026). Eine mildere Regel wird sowohl bei `frei`
	 * als auch bei `nur_mildern` angewandt; mit ihr allein sind die beiden
	 * Verhalten ununterscheidbar, und ein Rückfall von `nur_mildern` auf `frei`
	 * bliebe unbemerkt. Erst die strengere Regel trennt sie: `nur_mildern`
	 * weist sie ab, `frei` nimmt sie an.
	 */
	function vorbehaltStrengFuer(rw: Regelwerk, knotenId: string) {
		const knoten = rw.knoten.find((k) => k.id === knotenId)!;
		const erfordernis = erfordernisAusKnoten(rw, knoten);
		const regel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart!,
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' as const },
			kopfbasis: knoten.kopfbasis,
			quotenSchwelle: null,
			quotenbasis: 'keine' as const,
			fundstelle: 'Reglement Ziff. 1',
			enthaltungZaehltMit: true
		};
		return wendeReglementAn(erfordernis, [regel], null, LESARTEN_VORGABE).vorbehalt;
	}

	it('B3: die eigene Regel greift neu an der gewöhnlichen Verwaltungszuständigkeit', () => {
		// Vorher sperrte «zwingend» die Regel ab, obwohl Art. 647a Abs. 2 die
		// abweichende Ordnung ausdrücklich zulässt.
		expect(vorbehaltFuer(VOR22, 'k-zustaendigkeit-gewoehnlich')).toBe('zwingend');
		expect(vorbehaltFuer(NEU22, 'k-zustaendigkeit-gewoehnlich')).toBeNull();
	});

	it('B2: die eigene Regel greift neu nicht mehr am Ausweg bei luxuriösen Massnahmen', () => {
		// Vorher wurde eine mildere Regel dort angewandt; nach der strengeren
		// Lesart braucht es Einstimmigkeit oder den Begründungsakt.
		expect(vorbehaltFuer(VOR22, 'k-baulich-luxurioes-ausweg')).toBeNull();
		expect(vorbehaltFuer(NEU22, 'k-baulich-luxurioes-ausweg')).toBe('vereinbarung');
	});

	it('lässt die übrigen Knoten in ihrer Wirkung unangetastet', () => {
		const gewollt = new Set(['k-zustaendigkeit-gewoehnlich', 'k-baulich-luxurioes-ausweg']);
		let geprueft = 0;
		for (const knoten of VOR22.knoten) {
			if (gewollt.has(knoten.id) || !knoten.geschaeftsart) continue;
			// Beide Richtungen: die mildere Regel trennt die gesperrt_*-Fälle,
			// die strengere trennt frei von nur_mildern.
			expect(vorbehaltFuer(NEU22, knoten.id), knoten.id).toBe(vorbehaltFuer(VOR22, knoten.id));
			expect(vorbehaltStrengFuer(NEU22, knoten.id), knoten.id).toBe(
				vorbehaltStrengFuer(VOR22, knoten.id)
			);
			geprueft++;
		}
		// Damit der Test nicht still leerläuft, falls die Skip-Bedingung einmal
		// alles wegfiltert.
		expect(geprueft).toBeGreaterThan(25);
	});

	it('trennt die beiden gewollten Wechsel auch gegen eine strengere Regel', () => {
		// k-zustaendigkeit-gewoehnlich ist neu `frei`, nimmt die strengere Regel
		// also an; vorher sperrte «zwingend» sie ab.
		expect(vorbehaltStrengFuer(VOR22, 'k-zustaendigkeit-gewoehnlich')).toBe('zwingend');
		expect(vorbehaltStrengFuer(NEU22, 'k-zustaendigkeit-gewoehnlich')).toBeNull();
	});
});

/*
 * Die Fassung 2026-09-23 setzt die sieben dringenden Befunde der ersten
 * vollständigen Rechtsprüfung um (`quellen/pruefung/berichte/`, 22.09.2026).
 *
 * **Sie ist die erste Fassung seit 2026-08-16, die ein Ergebnis ändert, und
 * die erste überhaupt, die eine Entscheidung des Auftraggebers umkehrt.** Beides wird
 * hier nachgerechnet statt im Freigabevermerk behauptet: der Ergebnistyp von
 * `k-zustaendigkeit-gewoehnlich` (B-08) und die Wirkung hinterlegter
 * Reglementsregeln an vier Knoten (B-02).
 */
const VOR23 = holeRegelwerk('2026-09-22');
const NEU23 = holeRegelwerk('2026-09-23');

describe('Die Fassung 2026-09-23 gegenüber 2026-09-22', () => {
	it('besteht den Regelwerks-Wächter', () => {
		expect(pruefeRegelwerk(NEU23)).toEqual([]);
	});

	it('ändert genau einen Ergebnistyp, und zwar den angesagten', () => {
		/*
		 * **B-08, die Umkehr von L-5.** Der Knoten stand seit 2026-08-16 auf
		 * dem qualifizierten Mehr, entschieden nach dem Strengstprinzip. Die
		 * Fachprüfung zeigt, dass die Quellen nicht uneinig sind: Art. 647a
		 * Abs. 2 kennt kein Wertquotenelement, Rz. 34 ad 712g und Rz. 166 ad
		 * 712m nennen das einfache Mehr, und `fragen.md` Nr. 42 setzt diesen
		 * Knoten namentlich darauf.
		 *
		 * Das Strengstprinzip macht hier keine ungültigen Beschlüsse gültig,
		 * es verhindert gültige: sechs von zehn Köpfen mit 46 Prozent der
		 * Wertquoten galten als «nicht erreicht».
		 */
		const angesagt = 'k-zustaendigkeit-gewoehnlich';
		for (const alt of VOR23.knoten) {
			const neu = NEU23.knoten.find((k) => k.id === alt.id)!;
			if (alt.id === angesagt) continue;
			expect(neu.typ, alt.id).toBe(alt.typ);
			expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
			expect(neu.quotenbasis, alt.id).toBe(alt.quotenbasis);
			expect(neu.zustimmungBetroffenerNoetig, alt.id).toBe(alt.zustimmungBetroffenerNoetig);
		}
		const vorher = VOR23.knoten.find((k) => k.id === angesagt)!;
		const nachher = NEU23.knoten.find((k) => k.id === angesagt)!;
		expect(vorher.typ).toBe('qualifiziertes_mehr');
		expect(vorher.quotenbasis).toBe('alle_quoten');
		expect(nachher.typ).toBe('einfaches_mehr');
		expect(nachher.quotenbasis).toBe('keine');
		/*
		 * Der Streit bleibt ausgewiesen, weil Rz. 109 ad 712a eine andere Lesart
		 * stützt; nur folgt das Werkzeug ihr nicht mehr.
		 *
		 * **Der Satz dazu hat die Richtung gewechselt** (Fachprüfung F-16).
		 * «Wer das qualifizierte Mehr erreicht, genügt beiden Lesarten» war der
		 * Rat unter der strengen Einstellung. Unter der milden ist der operative
		 * Fall der Beschluss, der **nur** das einfache Mehr erreicht, und über
		 * den sagte die Karte nichts. Deshalb prüft diese Zeile jetzt beides:
		 * dass die Anfechtbarkeit benannt ist und dass der sichere Weg
		 * danebensteht.
		 */
		expect(nachher.hinweise!.join(' ')).toMatch(/bleibt aber anfechtbar/);
		expect(nachher.hinweise!.join(' ')).toMatch(/nach beiden Lesarten/);
	});

	it('ändert keinen Weg, keine Frage, keinen Ast', () => {
		expect(NEU23.fragen).toEqual(VOR23.fragen);
		expect(NEU23.aeste).toEqual(VOR23.aeste);
		expect(NEU23.knoten.map((k) => k.id)).toEqual(VOR23.knoten.map((k) => k.id));
	});

	it('B-03: keine Karte sagt mehr, die Minderheit sei nicht gebunden', () => {
		/*
		 * Die gefährlichste Klasse des Berichts. Ein widerrechtlicher Beschluss
		 * wirkt, bis ihn ein Gericht aufhebt (Rz. 206 f. ad 712m); Rz. 209
		 * führt den Luxusbeschluss mit qualifiziertem Mehr ausdrücklich als
		 * bloss anfechtbar. Wer las, er müsse nicht zahlen, klagte nicht und
		 * schuldete nach einem Monat seinen Anteil.
		 */
		const alleTexte = (rw: Regelwerk) =>
			rw.knoten
				.map((k) => [k.empfehlung ?? '', k.begruendung ?? '', ...(k.hinweise ?? [])].join(' '))
				.join(' ');
		expect(alleTexte(VOR23)).toMatch(/Kosten nicht mittragen|Unverbindlichkeit gegenüber der Minderheit/);
		expect(alleTexte(NEU23)).not.toMatch(/Kosten nicht mittragen/);
		expect(alleTexte(NEU23)).not.toMatch(/Unverbindlichkeit gegenüber der Minderheit/);
		// Und die Monatsfrist steht jetzt dort, wo vorher die falsche Zusage stand.
		expect(NEU23.knoten.find((k) => k.id === 'k-grenzfall-nuetzlich')!.empfehlung).toMatch(
			/innert eines Monats/
		);
	});

	it('B-01: der spontane Antrag ist kein neues Traktandum', () => {
		const k = NEU23.knoten.find((x) => x.id === 'k-kenntnisnahme')!;
		expect(VOR23.knoten.find((x) => x.id === 'k-kenntnisnahme')!.hinweise!.join(' ')).toMatch(
			/neues Traktandum mit eigenem Erfordernis/
		);
		expect(k.hinweise!.join(' ')).toMatch(/Art\. 67 Abs\. 3/);
		expect(k.hinweise!.join(' ')).toMatch(/nächsten Versammlung/);
		expect(k.hinweise!.join(' ')).not.toMatch(/neues Traktandum mit eigenem Erfordernis/);
	});

	it('B-02: die Art.-647-Karten tragen den strengen Reglementshinweis', () => {
		/*
		 * Art. 712g Abs. 2 gilt für Art. 647 ff.: eine andere Ordnung nur im
		 * Begründungsakt oder einstimmig. `k-reglement-quoren` sagte das im
		 * selben Werkzeug längst, diese vier das Gegenteil.
		 */
		const betroffen = [
			'k-baulich-notwendig',
			'k-baulich-nuetzlich',
			'k-benutzungsweise',
			'k-verwaltung-wichtig'
		];
		for (const id of betroffen) {
			expect(VOR23.knoten.find((k) => k.id === id)!.reglementsverhalten, id).toBe('frei');
			expect(NEU23.knoten.find((k) => k.id === id)!.reglementsverhalten, id).toBe(
				'gesperrt_vereinbarung'
			);
		}
		/*
		 * **Und die Ausnahme, die keine Nachlässigkeit ist.** Art. 647a Abs. 2
		 * lässt die abweichende Ordnung selbst zu; Rz. 78 ad 712g nennt ihn
		 * wörtlich als die Bestimmung, die Abs. 2 verdrängt. Der Knoten bleibt
		 * deshalb `frei`, und dieser Test hält fest, dass das gewollt ist.
		 */
		expect(
			NEU23.knoten.find((k) => k.id === 'k-zustaendigkeit-gewoehnlich')!.reglementsverhalten
		).toBe('frei');
	});

	it('F-04/F-11/F-14: drei Karten sind wieder aus der Sperre heraus', () => {
		/*
		 * **Der Wächter über den Rückschritt, nicht über den Fortschritt.** Der
		 * erste Entwurf dieser Fassung setzte den strengen Kasten auf sieben
		 * Karten, geprüft war er für vier. Bei diesen dreien stammt das Quorum
		 * nicht aus Art. 647: `k-prozessfuehrung` aus Art. 712t Abs. 2 (dispositiv),
		 * `k-verwaltung-gewoehnlich` aus Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2
		 * (Rz. 41a ad 712g lässt dort ein anderes Quorum ausdrücklich zu), und
		 * `k-bewirtschaftung-erweitert` auch aus Art. 712g Abs. 3 (Rz. 46 ad 712q,
		 * Rz. 70 ad 712s, `fragen.md` Nr. 27).
		 *
		 * Ohne diese Probe wäre die Rücknahme eine Zeile, die beim nächsten
		 * Sammelbefund wieder verschwindet.
		 */
		for (const id of [
			'k-prozessfuehrung',
			'k-verwaltung-gewoehnlich',
			'k-bewirtschaftung-erweitert'
		]) {
			expect(NEU23.knoten.find((k) => k.id === id)!.reglementsverhalten, id).toBe('frei');
		}

		/*
		 * **Die Gegenprobe steht im selben Werkzeug.** `k-hausordnung` trägt
		 * dieselbe Normkette wie `k-verwaltung-gewoehnlich` und hat den milden
		 * Kasten nie verloren. Stünden die beiden auseinander, gäbe das Werkzeug
		 * für dieselbe Grundlage gegenteilige Auskunft.
		 */
		expect(NEU23.knoten.find((k) => k.id === 'k-hausordnung')!.reglementsverhalten).toBe('frei');
		expect(NEU23.knoten.find((k) => k.id === 'k-hausordnung')!.reglementsverhalten).toBe(
			NEU23.knoten.find((k) => k.id === 'k-verwaltung-gewoehnlich')!.reglementsverhalten
		);
	});

	it('F-17: die Begründung dreht mit dem Ergebnistyp', () => {
		/*
		 * Die Fassung 2026-08-16 setzte Ergebnistyp **und** Begründung. Der erste
		 * Entwurf dieser Fassung drehte nur den Typ zurück; die Karte hätte oben
		 * «Einfaches Mehr» gezeigt und darunter behauptet, sie setze das
		 * qualifizierte an. Kein bestehender Wächter sah das, weil keiner an der
		 * Begründung hängt.
		 */
		/*
		 * **Und sie prüft die Lage, nicht den alten Wortlaut** (Code-Review
		 * 23.09.2026). Ein `not.toMatch(/strengere qualifizierte Mehr/)` fängt
		 * nur den Rückfall per Zwischenablage; eine neu formulierte Begründung
		 * «setzt das qualifizierte Mehr an, obwohl das einfache vertretbar wäre»
		 * käme durch. Deshalb über alle Fassungen und gegen den Ergebnistyp:
		 * Wessen Typ das einfache Mehr ist, dessen Begründung darf nicht
		 * behaupten, das Werkzeug setze das qualifizierte an.
		 */
		for (const rw of alleFassungen()) {
			for (const n of rw.knoten) {
				if (n.typ !== 'einfaches_mehr' || !n.begruendung) continue;
				expect(
					/[Ww]erkzeug setzt das (strengere )?qualifizierte Mehr an/.test(n.begruendung),
					`${rw.fassung}/${n.id}: Ergebnistyp einfaches Mehr, Begründung sagt qualifiziert`
				).toBe(false);
			}
		}

		const k = NEU23.knoten.find((n) => n.id === 'k-zustaendigkeit-gewoehnlich')!;
		expect(k.typ).toBe('einfaches_mehr');
		expect(k.begruendung).toMatch(/einfache Mehr/);
	});

	it('F-05/F-06: die Abberufung empfiehlt keine Kündigung und sichert kein Geld zu', () => {
		/*
		 * `quellen/themen/stockwerkeigentum/fragen.md` Nr. 10: «Produktentscheid
		 * 07.09.2026: Keine Kündigungsempfehlung.» Die Linie gilt für die ganze
		 * Site, auch für `/verwaltung-wechseln/`.
		 *
		 * Und Rz. 10 ad Art. 712r zählt auf, was die Bewirtschaftung **verlangen
		 * kann** («Spesen, Entschädigungen, Honorar usw.»). Der Satz, ein Honorar
		 * für die Restlaufzeit sei «ohnehin nicht geschuldet», sagte das Gegenteil
		 * seiner eigenen Fundstelle.
		 */
		const text = NEU23.knoten
			.find((k) => k.id === 'k-bewirtschaftung-abberufen')!
			.hinweise!.join(' ');
		expect(text).not.toMatch(/Kündigung des Bewirtschaftungsvertrags/);
		// Und die Aufforderungsform, die derselbe Rat in anderen Worten wäre.
		expect(text).not.toMatch(/[Kk]ündigen Sie/);
		expect(text).not.toMatch(/ohnehin nicht geschuldet/);
		expect(text).toMatch(/Abberufung auf ein Datum/);
	});

	it('F-07: kein Reglementskasten behauptet an einer Streitfrage Geklärtes', () => {
		/*
		 * **Der Kasten steht vor dem Hinweis und gewinnt.** Bei
		 * `k-reglement-normal` behauptete er «Verschärfen lässt sich dieses
		 * Erfordernis allerdings nicht», während der Hinweis derselben Karte
		 * riet, die strengere Klausel sicherheitshalber zu erreichen.
		 *
		 * **Diese Probe hat den ersten Entwurf nicht überlebt** (Code-Review
		 * 23.09.2026, M-4). Sie hatte eine Vorbedingung auf den Wortlaut des
		 * Hinweises und eine Zusicherung auf den Wortlaut des alten Kastens.
		 * Beides zusammen heisst: Wer umformuliert, lässt die Schleife leer
		 * laufen, und der Test ist grün, ohne eine einzige Zusicherung
		 * ausgeführt zu haben. Jetzt zählt sie mit, und sie misst positiv.
		 */
		let geprueft = 0;
		for (const rw of alleFassungen()) {
			for (const n of rw.knoten) {
				if (n.reglementsverhalten !== 'nur_mildern') continue;
				geprueft++;
				const satz = ergebniskarte(rw, n).reglementsvorbehalt;
				/*
				 * **Kein `toMatch(/umstritten/)` mehr** (Gegenprüfung 23.09.2026,
				 * M-3). Der Streit hängt an Art. 712g Abs. 3; dieser Zweig trägt in
				 * den Fassungen bis 2026-09-21 auch `k-baulich-luxurioes-ausweg`
				 * mit Art. 647e Abs. 2, wo Rz. 54 die Sache ohne Streit führt. Eine
				 * Probe, die den Streit im allgemeinen Kasten verlangt, erzwingt
				 * eine Behauptung, die für eine der beiden Grundlagen falsch ist.
				 *
				 * Verlangt wird stattdessen die Aussage über das Werkzeug, die für
				 * alle drei Fälle stimmt, und das Verbot der Rechtsbehauptung.
				 */
				expect(satz, `${rw.fassung}/${n.id}`).toMatch(/nur an, wenn sie nachweislich nicht strenger ist/);
				expect(
					/nicht verschärft werden|nicht, nur mildern|verschärfen lässt sich/i.test(satz),
					`${rw.fassung}/${n.id}: Der Kasten verneint die Verschärfung als geklärtes Recht.`
				).toBe(false);
			}
		}
		expect(geprueft, 'kein Knoten mit nur_mildern gefunden').toBeGreaterThan(0);
		/*
		 * **Und mindestens einer davon in der aktuellen Fassung** (Gegenprüfung
		 * 23.09.2026). Der blosse Zähler bliebe positiv, wenn nur die
		 * eingefrorenen Altfassungen solche Knoten tragen; die Probe misste dann
		 * still nicht mehr den Fall, um den es geht.
		 */
		expect(
			NEU23.knoten.some((n) => n.reglementsverhalten === 'nur_mildern'),
			'die aktuelle Fassung trägt keinen Knoten mit nur_mildern'
		).toBe(true);
	});

	it('F-07: auch der Satz, der den Kasten ersetzt, behauptet es nicht', () => {
		/*
		 * **Der wichtigste Weg war der ungeprüfte** (Code-Review 23.09.2026,
		 * H-1). Hat eine Gemeinschaft eine strengere Klausel hinterlegt, ersetzt
		 * `karteMitReglement` den Reglementskasten durch den Vorbehaltssatz. Das
		 * ist genau der Fall, zu dem der Hinweis rät, die strengere Klausel zu
		 * erreichen, und dort stand die Behauptung weiter.
		 *
		 * Die Probe darüber hätte das nie gesehen: Sie misst `ergebniskarte`,
		 * also die Karte **vor** der Überlagerung.
		 */
		const knoten = NEU23.knoten.find((n) => n.id === 'k-reglement-normal')!;
		const regel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart!,
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' as const },
			kopfbasis: knoten.kopfbasis,
			quotenSchwelle: null,
			quotenbasis: 'keine' as const,
			fundstelle: 'Reglement Ziff. 1',
			enthaltungZaehltMit: true
		};
		const angewandt = wendeReglementAn(erfordernisAusKnoten(NEU23, knoten), [regel], null, LESARTEN_VORGABE);
		// Die Lage, die der Befund beschreibt: strengere Regel, deshalb Vorbehalt.
		expect(angewandt.vorbehalt).toBe('verschaerfung');

		const karte = karteMitReglement(
			ergebniskarte(NEU23, knoten),
			regel,
			angewandt.vorbehalt,
			null,
			null
		);
		expect(karte.reglementsvorbehalt).toMatch(/nur eine Regel durch, die nachweislich nicht strenger ist/);
		// Und der zweite Grund für die Nichtanwendung bleibt benannt, sonst liest
		// ihn niemand, dessen Regel eine andere Bezugsgrösse hat.
		expect(karte.reglementsvorbehalt).toMatch(/Bezugsgrösse/);
		expect(
			/nicht verschärft werden|verschärfen lässt sich/i.test(karte.reglementsvorbehalt),
			'Der ersetzende Satz verneint die Verschärfung als geklärtes Recht.'
		).toBe(false);
	});

	it('F-07: der Satz über das eigene Verhalten stimmt mit dem Verhalten überein', () => {
		/*
		 * **Zweimal falsch an derselben Stelle** (Gegenprüfung 23.09.2026, S-1,
		 * und eigenes Nachrechnen danach). Der Kasten sagte erst «Verschärfen
		 * lässt sich dieses Erfordernis nicht», also eine Rechtsbehauptung an
		 * einer Streitfrage. Der Ersatz sagte «Eine mildere Regel setzt dieses
		 * Werkzeug durch», also eine Verhaltensbehauptung, die für eine Regel
		 * mit anderer Bezugsgrösse nicht stimmt. Der Ersatz davon sagte «nur,
		 * wenn sie sich als milder nachweisen lässt» und schloss damit die
		 * gleich strenge Regel zu Unrecht aus, die sehr wohl angewandt wird.
		 *
		 * Eine Zusicherung auf den Wortlaut hätte keinen dieser drei Fehler
		 * gefunden. Diese Probe misst deshalb das Verhalten selbst, und der Satz
		 * im Kasten ist an sie gebunden: Wer ihn ändert, muss hier vorbei.
		 */
		const knoten = NEU23.knoten.find((n) => n.id === 'k-reglement-normal')!;
		const gesetz = erfordernisAusKnoten(NEU23, knoten);

		/*
		 * **Der erste Versuch dieser Probe war eine Dublette** (Gegenprüfung
		 * 23.09.2026, S2). Er baute alle Regeln über eine Hilfsfunktion, die
		 * `art: 'mindestens'` und `quotenSchwelle: null` fest verdrahtete. Das
		 * Gesetz verlangt hier aber «mehr als» die Hälfte der Köpfe **und** mehr
		 * als die Hälfte aller Wertquoten. Die angeblich gleich strenge Regel war
		 * damit in beiden Achsen milder und zeichengleich mit der milden darüber;
		 * der Fall, um den es ging, war nie gebaut.
		 *
		 * Deshalb steht die gesetzliche Schwelle hier ausgeschrieben daneben, und
		 * jede Regel wird einzeln gebaut statt aus einer Vorlage.
		 */
		expect(gesetz.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(gesetz.quotenSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(gesetz.kopfbasis).toBe('anwesend_vertreten');
		expect(gesetz.quotenbasis).toBe('alle_quoten');

		const grund = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart!,
			fundstelle: 'Reglement Ziff. 1',
			enthaltungZaehltMit: true
		};

		// 1. Milder: tiefere Kopfschwelle, keine Quotenbedingung. Wird angewandt.
		expect(
			wendeReglementAn(gesetz, [
				{
					...grund,
					kopfbasis: 'anwesend_vertreten',
					kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mindestens' },
					quotenSchwelle: null,
					quotenbasis: 'keine'
				}
			], null, LESARTEN_VORGABE).vorbehalt
		).toBeNull();

		// 2. Gleich streng: dieselbe Schwelle, dieselbe Art, dieselbe Basis, in
		//    beiden Achsen. Wird ebenfalls angewandt. Genau diesen Fall schloss
		//    die Formulierung «nur, wenn sie milder ist» zu Unrecht aus.
		expect(
			wendeReglementAn(gesetz, [
				{
					...grund,
					kopfbasis: 'anwesend_vertreten',
					kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
					quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
					quotenbasis: 'alle_quoten'
				}
			], null, LESARTEN_VORGABE).vorbehalt
		).toBeNull();

		// 3. Strenger: höhere Kopfschwelle. Wird nicht angewandt.
		expect(
			wendeReglementAn(gesetz, [
				{
					...grund,
					kopfbasis: 'anwesend_vertreten',
					kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
					quotenSchwelle: null,
					quotenbasis: 'keine'
				}
			], null, LESARTEN_VORGABE).vorbehalt
		).toBe('verschaerfung');

		// 4. Andere Bezugsgrösse: der Länge nach tiefer, aber auf alle Eigentümer
		//    statt auf die Anwesenden bezogen. Nicht vergleichbar, also ebenfalls
		//    nicht angewandt. Das ist der Fall, den die erste Ersatzformulierung
		//    verschwieg, und er ist nicht «milder», sondern unvergleichbar.
		expect(
			wendeReglementAn(gesetz, [
				{
					...grund,
					kopfbasis: 'alle_eigentuemer',
					kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mindestens' },
					quotenSchwelle: null,
					quotenbasis: 'keine'
				}
			], null, LESARTEN_VORGABE).vorbehalt
		).toBe('verschaerfung');
	});

	it('F-08: wer die Milderung nennt, nennt ihre Bedingung', () => {
		/*
		 * Rz. 84 ad Art. 712g: «Durch analoge Anwendung von Art. 712g Abs. 2 ist
		 * eine solche Erleichterung einstimmig zu beschliessen, weil sie den
		 * Schutz der Minderheit verringert.» Ohne diesen Halbsatz liest eine
		 * Sitzungsleitung im Saal eine mildere Klausel als geltend.
		 *
		 * Die Bedingung steht im Hinweis der Karte, nicht im Kasten: Der Kasten
		 * gilt für jeden Knoten mit `nur_mildern` in jeder Fassung, und die
		 * Randziffer passt nicht zu jeder Rechtsgrundlage (M-2).
		 */
		const k = NEU23.knoten.find((n) => n.id === 'k-reglement-normal')!;
		expect(k.hinweise!.join(' ')).toMatch(/einstimmig beschlossen/);
		expect(k.hinweise!.join(' ')).toMatch(/Art\. 712g Rz\. 84/);
	});

	it('B-05: der Beschluss wird nicht mehr für den Vollzug gehalten', () => {
		const quoten = NEU23.knoten.find((k) => k.id === 'k-wertquoten-aendern')!;
		expect(quoten.hinweise!.join(' ')).toMatch(/erst der Eintrag ändert die Wertquoten/);
		const aufhebung = NEU23.knoten.find((k) => k.id === 'k-aufhebung')!;
		expect(aufhebung.hinweise!.join(' ')).toMatch(/dinglich Berechtigten/);
		expect(aufhebung.hinweise!.join(' ')).toMatch(/712f Abs\. 2/);
	});

	it('B-06: die zwei Reglementskarten sagen dasselbe und nennen den Ausweg', () => {
		const normal = NEU23.knoten.find((k) => k.id === 'k-reglement-normal')!;
		const schranke = NEU23.knoten.find((k) => k.id === 'k-reglement-eigene-schranke')!;
		// Vorher stand auf der einen «wäre unbeachtlich», auf der anderen
		// «umstritten» — bei derselben Klausel.
		for (const k of [normal, schranke]) {
			// Auf die Substanz geprüft, nicht auf ein Wort: Die eine Karte
			// schreibt «umstritten», die andere «Zum Streit». Beide müssen
			// nennen, dass Steinauer anders sieht und das Bundesgericht die
			// Frage offenliess — das ist die Aussage, nicht die Vokabel.
			expect(k.hinweise!.join(' '), k.id).toMatch(/Steinauer/);
			expect(k.hinweise!.join(' '), k.id).toMatch(/5C\.50\/2004/);
			expect(k.hinweise!.join(' '), k.id).toMatch(/Art\. 712m Rz\. 196/);
		}
		/*
		 * **Kein `not.toMatch(/wäre unbeachtlich/)` hier** (Code-Review
		 * 23.09.2026). Der Satz stand nie in den Hinweisen dieses Knotens,
		 * sondern im Reglementskasten des Website-Abzugs
		 * (`quorumsbaum-export.mjs`, `case 'nur_mildern'`). Eine Zusicherung
		 * darauf wäre schon vor dieser Fassung grün gewesen und könnte nie rot
		 * werden.
		 *
		 * **Der Widerspruch ist inzwischen behoben**, am selben Tag und in einem
		 * eigenen Block: Alle Träger dieser Aussage sagen jetzt, was das Werkzeug
		 * tut, statt was angeblich gilt. Zwei Proben weiter unten (`F-07`)
		 * sichern das, für den Kasten an der Karte und für den Satz, der ihn bei
		 * hinterlegter Regel ersetzt.
		 */
		expect(normal.hinweise!.join(' ')).toMatch(/Sicher ist ein Beschluss nur/);
	});

	/*
	 * **Hier stand B-07, und die Probe schrieb einen Fehler fest.** Sie
	 * verlangte wörtlich `toMatch(/im selben Beschluss die Kündigung/)` und
	 * hätte damit jeden Versuch, den Rat zurückzunehmen, rot gemeldet. Der Rat
	 * selbst kehrte `fragen.md` Nr. 10 um («Produktentscheid 07.09.2026: Keine
	 * Kündigungsempfehlung»). Gefunden hat das die Fachprüfung, nicht der
	 * Prüflauf; der Prüflauf war grün, weil die Probe genau das verlangte, was
	 * falsch war.
	 *
	 * Ersetzt durch «F-05/F-06» weiter oben, das die Gegenrichtung sichert.
	 */

	it('ist nicht mehr die aktuelle Fassung und weiter als nicht gegengelesen gekennzeichnet', () => {
		// Seit der Fassung 2026-09-24 leitet die Anwendung unter jener her.
		expect(AKTUELLE_FASSUNG).toBe('2026-11-18');
		/*
		 * **Und das bleibt so, obwohl gerade zwei Prüfungen gelaufen sind.**
		 * Sie prüften die Vorfassung; die Texte hier sind neu und deshalb
		 * ungeprüft. Der Prüfauftrag sagt es selbst: «Was in Fassung 2
		 * dazukam, hat noch niemand geprüft.»
		 */
		expect(NEU23.juristischGegengelesen).toBe(false);
	});
});

/*
 * **Was der Rohknotenvergleich nicht sieht, zum zweiten Mal.** Wie bei der
 * Fassung 2026-09-22 ändert das `reglementsverhalten` die Wirkung hinterlegter
 * Reglementsregeln, ohne dass ein Knotenfeld es zeigt, das der Spread anfasst.
 * Diesmal betrifft es vier Knoten statt zwei.
 */
describe('Die Fassung 2026-09-23 sperrt vier Knoten für Reglementsregeln', () => {
	function vorbehaltFuer(rw: Regelwerk, knotenId: string, zaehler: number, nenner: number) {
		const knoten = rw.knoten.find((k) => k.id === knotenId)!;
		const erfordernis = erfordernisAusKnoten(rw, knoten);
		const regel = {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart!,
			kopfSchwelle: { zaehler, nenner, art: 'mindestens' as const },
			kopfbasis: knoten.kopfbasis,
			quotenSchwelle: null,
			quotenbasis: 'keine' as const,
			fundstelle: 'Reglement Ziff. 1',
			enthaltungZaehltMit: true
		};
		return wendeReglementAn(erfordernis, [regel], null, LESARTEN_VORGABE).vorbehalt;
	}

	/*
	 * **Vier, nicht sieben** (zweiter Prüfdurchgang, 23.09.2026). Diese Liste
	 * misst die Wirkung, nicht den Text: `wendeReglementAn` gibt für einen
	 * gesperrten Knoten den Vorbehalt «vereinbarung» zurück statt der Regel.
	 * Dass sie beim Kürzen der Sperre rot wurde, ist der Beweis, dass sie die
	 * Wirkung misst und nicht die Absicht.
	 */
	const betroffen = [
		'k-baulich-notwendig',
		'k-baulich-nuetzlich',
		'k-benutzungsweise',
		'k-verwaltung-wichtig'
	];

	/*
	 * Und die Gegenprobe: An den drei herausgenommenen Knoten **wirkt** die
	 * hinterlegte Regel wieder. Ohne diese Zeile stünde nur, dass die Sperre
	 * fehlt, nicht, dass die Regel zurück ist.
	 */
	const wiederFrei = [
		'k-prozessfuehrung',
		'k-verwaltung-gewoehnlich',
		'k-bewirtschaftung-erweitert'
	];

	it('wendet eine hinterlegte Regel dort nicht mehr an', () => {
		for (const id of betroffen) {
			// Eine mildere Regel wurde vorher angewandt; jetzt greift der
			// Vorbehalt «einstimmig oder im Begründungsakt».
			expect(vorbehaltFuer(VOR23, id, 1, 2), id).toBeNull();
			expect(vorbehaltFuer(NEU23, id, 1, 2), id).toBe('vereinbarung');
		}
	});

	it('wendet die Regel an den drei zurückgenommenen Knoten wieder an', () => {
		/*
		 * F-04, F-11, F-14. Die Rücknahme ist erst dann eine Rücknahme, wenn die
		 * hinterlegte Regel wieder **greift**. Dass keine Sperre mehr eingetragen
		 * ist, sagt das nicht: Es sagt nur, dass an einer Stelle nichts steht.
		 */
		for (const id of wiederFrei) {
			expect(vorbehaltFuer(NEU23, id, 1, 2), id).toBeNull();
			expect(vorbehaltFuer(NEU23, id, 1, 2), id).toBe(vorbehaltFuer(VOR23, id, 1, 2));
		}
	});

	it('lässt die Wirkung der übrigen Knoten unangetastet', () => {
		let geprueft = 0;
		for (const knoten of VOR23.knoten) {
			if (betroffen.includes(knoten.id) || !knoten.geschaeftsart) continue;
			expect(vorbehaltFuer(NEU23, knoten.id, 1, 2), knoten.id).toBe(
				vorbehaltFuer(VOR23, knoten.id, 1, 2)
			);
			expect(vorbehaltFuer(NEU23, knoten.id, 3, 4), knoten.id).toBe(
				vorbehaltFuer(VOR23, knoten.id, 3, 4)
			);
			geprueft++;
		}
		expect(geprueft).toBeGreaterThan(20);
	});
});

/*
 * Die Fassung 2026-09-24 baut die Grenzfallkarte zwischen Benutzungsweise und
 * Zweckbestimmung aus und berichtigt dabei eine Rechtsaussage. Anlass war ein
 * Vorschlag aus einer anderen Sitzung, durch Fach- und Laienprüfung gelaufen.
 */
const VOR24 = holeRegelwerk('2026-09-23');
const NEU24 = holeRegelwerk('2026-09-24');

describe('Die Fassung 2026-09-24 gegenüber 2026-09-23', () => {
	it('verliert beim Umverteilen weder Fundstelle noch Monatsfrist', () => {
		/*
		 * **Der Vorschlag war als Rechtskorrektur angekündigt, und er war
		 * keine.** Die Karte trug bis zur Fassung 2026-09-21 wirklich die
		 * falsche Aussage «ungültig, nicht bloss anfechtbar»; berichtigt wurde
		 * sie aber schon mit 2026-09-22. Wer den Wortlaut aus der Basisfassung
		 * liest und auf die aktuelle schliesst, meldet eine Korrektur, die
		 * längst geschehen ist. Diese Probe hält den Unterschied fest.
		 *
		 * **Und der Vorschlag hätte dabei zwei Dinge verloren**: die
		 * Fundstellen und den praktisch wichtigsten Satz, wonach auch der von
		 * der Nichtigkeit Überzeugte vorsichtshalber anficht. Genau die Klasse
		 * «gestrichener Halbsatz»: Beim Umbauen geht die Einschränkung
		 * verloren, nicht die Hauptaussage. Beides steht jetzt im ersten
		 * Hinweis, damit die Empfehlung kurz bleiben kann.
		 */
		const vor21 = holeRegelwerk('2026-09-21').knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		expect(vor21.empfehlung).toMatch(/ungültig, nicht bloss anfechtbar/);

		const alt = VOR24.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		expect(alt.empfehlung).toMatch(/in der Regel anfechtbar, nicht ungültig/);

		const neu = NEU24.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		const alles = [neu.empfehlung, ...(neu.hinweise ?? [])].join(' ');
		expect(alles).toMatch(/in der Regel anfechtbar und nicht nichtig/);
		expect(alles).toMatch(/Rz\. 206/);
		expect(alles).toMatch(/Rz\. 212/);
		expect(alles).toMatch(/Rz\. 213/);
		expect(alles).toMatch(/Monatsfrist/);
		expect(alles).toMatch(/vorsichtshalber an/);
		// Und die Empfehlung bleibt handlungsfähig statt zur Rechtsprosa zu werden.
		expect(neu.empfehlung).toMatch(/bevor die Einladung hinausgeht/);
	});

	it('füllt die zwei leeren Felder der Grenzfallkarte', () => {
		/*
		 * Alles, was die Karte zu sagen hatte, stand in der Empfehlung. Die
		 * Fachprüfung wollte mehr Präzision, die Laienprüfung weniger
		 * Fliesstext und endlich ein Beispiel; im selben Feld liess sich
		 * beides nicht erfüllen.
		 */
		const alt = VOR24.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		const neu = NEU24.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		expect(alt.beispiele ?? []).toHaveLength(0);
		expect(alt.hinweise ?? []).toHaveLength(0);
		/*
		 * **Zwei Beispiele, nicht drei** (Code-Review 23.09.2026, Befund 9). Der
		 * Vorschlag führte zusätzlich «gewerbsmässige Kinderbetreuung in einer
		 * Wohnung» als Zweckänderung, also Einstimmigkeit. Das einzige Beispiel
		 * der Nachbarkarte `k-benutzungsweise` lautet «Verbot einer Kinderkrippe
		 * in einer Wohnung» und steht dort für das qualifizierte Mehr. Zwei
		 * Karten desselben Astes, dieselbe Lebenslage, gegenläufiges Ergebnis,
		 * und kein Wort dazu, was sie trennt.
		 *
		 * Das Beispiel ist deshalb herausgenommen und nicht durch einen selbst
		 * erdachten Abgrenzungssatz ersetzt: Die Unterscheidung ist eine
		 * Rechtsfrage und gehört belegt, nicht geschrieben. Geführt als offener
		 * Punkt für die Fachprüfung, zusammen mit dem Umstand, dass BGer
		 * 5A_98/2017 auf `k-zweckbestimmung` mit einem anderen Sachverhalt
		 * beschrieben ist.
		 */
		expect(neu.beispiele!.length).toBeGreaterThanOrEqual(2);
		expect(neu.beispiele!.join(' ')).not.toMatch(/Kinderbetreuung/);
		expect(neu.hinweise!.length).toBeGreaterThanOrEqual(4);
		// Die Zählweise beim qualifizierten Mehr, die Hauslinie aus fragen.md
		// Nr. 39: Köpfe nach den Anwesenden und Vertretenen, Quoten an allen.
		const h = neu.hinweise!.join(' ');
		expect(h).toMatch(/nur die anwesenden und vertretenen/);
		expect(h).toMatch(/bei den Wertquoten dagegen alle/);
	});

	it('sagt bei der Benutzungsweise, worauf sich der Reglementskasten bezieht', () => {
		/*
		 * F-12. Die Karte trägt seit 2026-09-23 den strengen Kasten, und ihr
		 * einziges Beispiel ist ein Fall, in dem das gesetzliche qualifizierte
		 * Mehr genügt hat. Nebeneinander gelesen entsteht der Eindruck, das
		 * Gericht habe sich darüber hinweggesetzt. Die Zuordnung bleibt, sie
		 * trägt; falsch war das Schweigen daneben.
		 */
		const neu = NEU24.knoten.find((k) => k.id === 'k-benutzungsweise')!;
		expect(neu.reglementsverhalten).toBe('gesperrt_vereinbarung');
		expect(neu.hinweise!.join(' ')).toMatch(/abweichendes Quorum in Ihrem Reglement/);
		// Und das Beispiel bleibt, es ist der Anlass des Hinweises.
		expect(neu.beispiele!.join(' ')).toMatch(/5A_352\/2012/);
	});

	it('ändert sonst nichts', () => {
		const angefasst = new Set(['k-grenzfall-nutzung', 'k-benutzungsweise']);
		for (const alt of VOR24.knoten) {
			const neu = NEU24.knoten.find((k) => k.id === alt.id)!;
			expect(neu.typ, alt.id).toBe(alt.typ);
			expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
			expect(neu.quotenbasis, alt.id).toBe(alt.quotenbasis);
			expect(neu.reglementsverhalten, alt.id).toBe(alt.reglementsverhalten);
			if (!angefasst.has(alt.id)) expect(neu, alt.id).toEqual(alt);
		}
		expect(NEU24.fragen).toEqual(VOR24.fragen);
		expect(NEU24.aeste).toEqual(VOR24.aeste);
	});
});

/*
 * Die Fassung 2026-09-25 berichtigt drei Beispiele: B-17 und B-18 aus dem
 * Bericht der Fachprüfung vom 22.09.2026, beide mit Wortlautvorschlag.
 */
const VOR25 = holeRegelwerk('2026-09-24');
const NEU25 = holeRegelwerk('2026-09-25');

describe('Die Fassung 2026-09-25 gegenüber 2026-09-24', () => {
	it('B-17: das Verbot betraf Räume mit gemischter Zweckbestimmung, nicht eine Wohnung', () => {
		/*
		 * Im Entscheid ging es um «locaux avec affectation tertiaire», die noch
		 * nie genutzt worden waren; das Verbot hielt als blosse Präzisierung
		 * dieser bestehenden Zweckbestimmung, gerade **weil** es keine
		 * Zweckänderung war (E. 3.3 und 4.3). Bei einer dem Wohnen gewidmeten
		 * Einheit liegt der Fall anders und kann nach E. 4.3.3 in
		 * Art. 648 Abs. 2 kippen.
		 *
		 * Die alte Verkürzung war zugleich der Grund, warum zwei Karten
		 * desselben Astes dieselbe Lebenslage mit gegenläufigem Ergebnis
		 * führten.
		 */
		const alt = VOR25.knoten.find((k) => k.id === 'k-benutzungsweise')!;
		const neu = NEU25.knoten.find((k) => k.id === 'k-benutzungsweise')!;
		expect(alt.beispiele!.join(' ')).toMatch(/Kinderkrippe in einer Wohnung/);
		expect(neu.beispiele!.join(' ')).not.toMatch(/Kinderkrippe/);
		expect(neu.beispiele!.join(' ')).toMatch(/gemischter Zweckbestimmung/);
		expect(neu.beispiele!.join(' ')).toMatch(/5A_352\/2012 E\. 4\.3\.3/);
	});

	it('B-18: die Erwägung zu BGer 5A_632/2011 trägt erst ab E. 5.2.1', () => {
		/*
		 * **Dieselbe falsche Angabe stand an zwei Stellen**, und die zweite war
		 * zwei Stunden alt: Beim Ausbauen der Grenzfallkarte wurde die Fundstelle
		 * aus der Nachbarkarte übernommen, statt sie am Entscheid zu prüfen.
		 * Der Befund lag zu diesem Zeitpunkt schon im Prüfbericht.
		 *
		 * E. 4.3 stellt nur fest, **dass** die Liegenschaft eine
		 * Zweckbestimmung hat. Die Aussage über die Umnutzung steht in
		 * E. 5.2.1 und E. 5.3.
		 *
		 * Die Probe hat zwei Teile, und sie misst nicht dasselbe. Der erste
		 * vergleicht die beiden betroffenen Karten in der Vor- und in der
		 * Neufassung. Der zweite läuft über **die aktuelle Fassung**, nicht über
		 * alle: Die eingefrorenen müssen ihren Wortlaut behalten (AD-4), auch den
		 * falschen.
		 */
		for (const id of ['k-zweckbestimmung', 'k-grenzfall-nutzung']) {
			const alt = VOR25.knoten.find((k) => k.id === id)!;
			const neu = NEU25.knoten.find((k) => k.id === id)!;
			expect(alt.beispiele!.join(' '), id).toMatch(/5A_632\/2011 E\. 4\.3/);
			expect(neu.beispiele!.join(' '), id).not.toMatch(/5A_632\/2011 E\. 4\.3/);
			expect(neu.beispiele!.join(' '), id).toMatch(/5A_632\/2011 E\. 5\.2\.1 und 5\.3/);
		}

		/*
		 * **Der Vorwärtsteil, und er misst die Sache statt einer Schreibweise**
		 * (Code-Review 23.09.2026). Der erste Entwurf verlangte die Zeichenfolge
		 * «5A_632/2011 E. 4.3» zusammenhängend; «BGer 5A_632/2011, E. 4.3» oder
		 * «Erw. 4.3» wären durchgelaufen. Geprüft wird deshalb getrennt: Wer den
		 * Entscheid nennt, darf im selben Text keine Erwägung 4.3 führen.
		 *
		 * **Und über alle Felder, in denen eine Fundstelle stehen kann**, nicht
		 * nur über die Beispiele. Der Bestand führt Fundstellen auch in Hinweisen
		 * und Begründungen; der erste Entwurf hätte eine künftige Fassung, die
		 * die falsche Erwägung in einen Hinweis schreibt, grün gelassen.
		 */
		const aktuell = holeRegelwerk();
		let gesehen = 0;
		for (const k of aktuell.knoten) {
			const texte = [
				k.titel,
				k.begruendung,
				k.empfehlung,
				k.formel,
				k.betroffeneErlaeuterung,
				k.rechtsgrundlage,
				...(k.hinweise ?? []),
				...(k.beispiele ?? [])
			].filter((t): t is string => typeof t === 'string');
			for (const t of texte) {
				gesehen++;
				if (t.includes('5A_632/2011')) {
					expect(
						/\b4\.3\b/.test(t),
						`${k.id}: E. 4.3 trägt die Aussage nicht, sie steht in E. 5.2.1 und 5.3`
					).toBe(false);
				}
				/*
				 * **B-17 in dieselbe Richtung** (Code-Review 23.09.2026). Der
				 * erste Entwurf sicherte nur B-18 nach vorn. Nichts hinderte eine
				 * künftige Fassung daran, den falschen Sachverhalt zurückzubringen,
				 * und genau dieser hatte schon einmal einen zweiten Widerspruch
				 * erzeugt.
				 */
				expect(
					/Kinderkrippe/.test(t),
					`${k.id}: Im Entscheid ging es um Räume mit gemischter Zweckbestimmung, nicht um eine Wohnung`
				).toBe(false);
			}
		}
		expect(gesehen, 'keine Kartentexte gesehen').toBeGreaterThan(100);
	});

	it('ändert sonst nichts', () => {
		const angefasst = new Set(['k-benutzungsweise', 'k-zweckbestimmung', 'k-grenzfall-nutzung']);
		for (const alt of VOR25.knoten) {
			const neu = NEU25.knoten.find((k) => k.id === alt.id)!;
			expect(neu.typ, alt.id).toBe(alt.typ);
			expect(neu.reglementsverhalten, alt.id).toBe(alt.reglementsverhalten);
			if (!angefasst.has(alt.id)) expect(neu, alt.id).toEqual(alt);
			else expect(neu.hinweise, alt.id).toEqual(alt.hinweise);
		}
		expect(NEU25.fragen).toEqual(VOR25.fragen);
		expect(NEU25.aeste).toEqual(VOR25.aeste);
	});
});

const VOR26 = holeRegelwerk('2026-09-25');
const NEU26 = holeRegelwerk('2026-09-26');

describe('Die Fassung 2026-09-26 gegenüber 2026-09-25', () => {
	it('gibt dem Grenzfall ein drittes Beispiel, kein Paar', () => {
		/*
		 * **Ein erster Entwurf stellte ein Paar gegenüber, und es trug nicht.**
		 * Kinderbetreuung zulassen gegen dieselbe Nutzung verbieten
		 * unterscheidet sich in **zwei** Dingen zugleich: in der Richtung und
		 * in der Breite der bisherigen Zweckbestimmung. Ein Paar, das zwei
		 * Dinge zugleich ändert, zeigt keine Grenze, es erfindet eine.
		 */
		const alt = VOR26.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		const neu = NEU26.knoten.find((k) => k.id === 'k-grenzfall-nutzung')!;
		expect(alt.beispiele).toHaveLength(2);
		expect(neu.beispiele).toHaveLength(3);
		expect(neu.beispiele!.filter((b) => b.startsWith('Keine Zweckänderung:'))).toHaveLength(1);
		expect(neu.beispiele!.join(' '), 'kein Beispiel zum Einschränkungsweg').not.toMatch(
			/verbiet|verbot|präzisier/i
		);

		/*
		 * **L-6: Die Gegenprobe darf nicht hinter der längsten Zeile stehen.**
		 * Sie ist das einzige Beispiel der Karte, das sagt, wann es die
		 * Zustimmung aller nicht braucht; dahinter las die Laienprüfung sie
		 * nicht mehr und setzte zu streng an. Die Probe hält die Stellung
		 * fest, nicht bloss das Vorhandensein: Wer ein viertes Beispiel
		 * anhängt, soll hier anstossen und die Reihenfolge mitdenken.
		 */
		const gegenprobe = neu.beispiele!.findIndex((b) => b.startsWith('Keine Zweckänderung:'));
		const laengste = neu.beispiele!.indexOf(
			[...neu.beispiele!].sort((x, y) => y.length - x.length)[0]
		);
		expect(gegenprobe, 'die Gegenprobe steht vor der längsten Zeile').toBeLessThan(laengste);
	});

	it('beschreibt den Entscheid so, wie er sein Ergebnis begründet', () => {
		/*
		 * **Ausschlaggebend war das Streichen, nicht das Zulassen.** BGer
		 * 5A_98/2017 E. 3.3: Das alte Reglement verlangte ausdrücklich Ruhe;
		 * die Änderung beschränkte sich auf die «bonne tenue» und schuf damit,
		 * bei drei Wohnungen im Haus, eine Unvereinbarkeit mit der
		 * ursprünglichen Zweckbestimmung.
		 *
		 * Drei Befunde stecken im Wortlaut: «bestätigt in BGer 5A_127/2020»
		 * ist gestrichen (Entscheid nicht im Repo, und die einzige Stelle
		 * bezieht ihn auf die Nutzungsfrage, nicht auf das Quorum), «klein»
		 * ist dazugekommen, weil die tragende Erwägung die Gebäudegrösse nennt,
		 * und «im Reglement» steht da, weil die Laienprüfung ihr eigenes
		 * Traktandum sonst nicht wiedererkannte.
		 */
		const b = NEU26.knoten
			.find((k) => k.id === 'k-grenzfall-nutzung')!
			.beispiele!.find((x) => x.includes('Kinderbetreuung'))!;
		expect(b).toMatch(/im Reglement/);
		expect(b).toMatch(/kleinen Wohnhauses/);
		expect(b).toMatch(/Bedingung gestrichen/);
		expect(b).toMatch(/5A_98\/2017 E\. 3\.3/);
		expect(b, 'der Entscheid liegt nicht im Repo').not.toMatch(/5A_127\/2020/);
		expect(b, 'die Deutung stand nicht in der Quelle').not.toMatch(/Eingriff klein/);

		/*
		 * **Nach vorn, und über alle Textfelder.** Ein erster Entwurf las nur
		 * `beispiele` und hätte damit denselben Fehler durchgelassen, gegen
		 * den die Probe zur Fassung 2026-09-25 weiter oben schon erweitert
		 * wurde: Eine künftige Fassung, die den nicht nachprüfbaren Entscheid
		 * in einen Hinweis, eine Begründung oder eine Empfehlung schreibt,
		 * wäre grün geblieben. Der angekündigte Weichen-Block fasst genau
		 * solche Felder an.
		 *
		 * **Der zweite Entwurf las Knoten und Fragen und nannte sich trotzdem
		 * «über alle Textfelder».** Ausgelassen war unter anderem `quellen`,
		 * und das ist die Liste, in der die Entscheide mit ihrem Nachweis
		 * stehen: die naheliegendste Stelle überhaupt, an der jemand einen
		 * nicht aufschlagbaren Entscheid einträgt. Eine Überschrift, die mehr
		 * behauptet als die Schleife liest, ist schlimmer als eine ehrliche
		 * Lücke, weil sie das Nachsehen erspart.
		 */
		/*
		 * **Je Gruppe zählen, nicht insgesamt.** Eine Gesamtschranke sähe nicht,
		 * wenn die Schleife über die Regelwerksebene ins Leere liefe: Die
		 * Knoten allein tragen 196 der Texte, die Summe bliebe weit über jeder
		 * Untergrenze. Dieselbe Überlegung wie beim Markup-Wächter weiter
		 * unten, und sie ist dort aus demselben Fehler entstanden.
		 */
		const gz = { regelwerk: 0, knoten: 0, fragen: 0 };
		const rw = holeRegelwerk();
		for (const t of [
			rw.freigabevermerk,
			rw.reglementsvorbehalt,
			rw.gemischteGeschaefte,
			rw.wortlautErklaerung,
			...rw.quellen,
			...rw.wortlautArtikel,
			...rw.ergebnistypen.flatMap((t) => Object.values(t)),
			...rw.aeste.flatMap((a) => [a.titel, a.beschreibung])
		].filter((t): t is string => typeof t === 'string')) {
			gz.regelwerk++;
			expect(/Eingriff klein/.test(t), 'Regelwerksebene').toBe(false);
			expect(/5A_127\/2020/.test(t), 'Regelwerksebene: nicht am Entscheid nachprüfbar').toBe(
				false
			);
		}
		for (const k of holeRegelwerk().knoten) {
			const texte = [
				k.titel,
				k.begruendung,
				k.empfehlung,
				k.formel,
				k.betroffeneErlaeuterung,
				k.rechtsgrundlage,
				...(k.hinweise ?? []),
				...(k.beispiele ?? [])
			].filter((t): t is string => typeof t === 'string');
			for (const t of texte) {
				gz.knoten++;
				expect(/Eingriff klein/.test(t), `${k.id}`).toBe(false);
				expect(/5A_127\/2020/.test(t), `${k.id}: nicht am Entscheid nachprüfbar`).toBe(false);
			}
		}
		for (const f of holeRegelwerk().fragen) {
			for (const t of [f.text, f.hilfe, ...f.antworten.flatMap((x) => [x.text, x.hilfe])].filter(
				(t): t is string => typeof t === 'string'
			)) {
				gz.fragen++;
				expect(/Eingriff klein/.test(t), `${f.id}`).toBe(false);
				expect(/5A_127\/2020/.test(t), `${f.id}: nicht am Entscheid nachprüfbar`).toBe(false);
			}
		}
		/*
		 * **Gemessen an der aktuellen Fassung** (23.09.2026): 58 Texte auf der
		 * Regelwerksebene samt Ästen, 196 an den Knoten, 73 an den Fragen.
		 *
		 * Der erste Entwurf setzte hier eine einzige Schranke von 1900, weil er
		 * die Zahl aus dem Markup-Wächter weiter unten übernahm, und der zählt
		 * über **alle** Fassungen. Die Probe war damit rot, bevor sie je etwas
		 * gefunden hätte. Eine Schranke aus einer fremden Messung ist keine
		 * Messung.
		 */
		expect(gz.regelwerk, 'die Regelwerksebene fehlt').toBeGreaterThan(50);
		expect(gz.knoten, 'die Knoten fehlen').toBeGreaterThan(180);
		expect(gz.fragen, 'die Fragen fehlen').toBeGreaterThan(65);
	});

	it('lässt die Weiche unangetastet, und das ist entschieden', () => {
		/*
		 * **Ein Entwurf hat die Antwortzeile von `f5-1` geändert, und es war die
		 * falsche von zwei Stellen.** Der Hilfetext eine Zeile darüber gibt für
		 * genau den Fall des neuen Beispiels Entwarnung; die Antwortzeile allein
		 * zu weiten, erreichte das Ziel nicht und machte die Zeile für eine Laiin
		 * zugleich unbeantwortbar, weil sie kein Merkmal mehr nennt.
		 *
		 * Die Weiche ist ein eigener Block. Diese Probe hält fest, dass dieser
		 * hier sie nicht anfasst; ohne sie sähe später niemand, dass das eine
		 * Entscheidung war und kein Vergessen.
		 */
		expect(NEU26.fragen).toEqual(VOR26.fragen);
		expect(NEU26.aeste).toEqual(VOR26.aeste);
	});

	it('B-5 und B-2: derselbe Entscheid steht nicht mehr mit zwei Sachverhalten da', () => {
		/*
		 * `k-benutzungsweise` belegte mit E. 4.3.3, dem abstrakten Rechtssatz.
		 * Die Karte führt aber ein Beispiel, also das Ergebnis eines Falles,
		 * und das steht in E. 4.4.1 Abs. 3: Das doppelte Mehr genügte, weil
		 * das Gebäude «demeure affecté à l'habitation ou à des activités du
		 * domaine tertiaire, dont le cercle a simplement été restreint».
		 *
		 * Und `k-zweckbestimmung` beschrieb 5A_98/2017 als «aus ruhigem Wohnen
		 * generell Gewerbe». Art. 7A des Reglements erlaubte die
		 * Berufsausübung seit 2004; gestrichen wurde allein die Ruhe.
		 */
		const weise = NEU26.knoten.find((k) => k.id === 'k-benutzungsweise')!;
		/*
		 * **Nur die Erwägung wechselt, der Sachverhalt bleibt.** Ein Entwurf
		 * tauschte auch ihn aus und stützte sich auf den ersten Absatz von
		 * E. 4.4.1, der den Einwand der wohlerworbenen Rechte erledigt. Das
		 * Quorum trägt der dritte Absatz, und der begründet es mit der
		 * fortbestehenden gemischten Widmung. Eine Erwägung hat Absätze, und
		 * sie tragen Verschiedenes.
		 */
		expect(weise.beispiele!.join(' ')).toMatch(/mit gemischter Zweckbestimmung/);
		expect(weise.beispiele!.join(' '), 'bei einem Verbot fast immer erfüllt').not.toMatch(
			/noch nie zugeführt/
		);
		expect(weise.beispiele!.join(' ')).toMatch(/5A_352\/2012 E\. 4\.4\.1/);
		/*
		 * **Nicht am Wortlaut des Entwurfs prüfen, sondern an der Schreibweise
		 * der Fundstelle.** «Erw. 4.3.3» oder «E. 4.3.3.» liefen an einer
		 * Probe vorbei, die nur die eine Form kennt. Dieselbe Lehre steht
		 * oben beim Wächter zu 5A_632/2011.
		 */
		expect(
			weise.beispiele!.join(' '),
			'E. 4.3.3 trägt den Rechtssatz, nicht den Fall'
		).not.toMatch(/(E\.|Erw\.?|Erwägung)\s*4\.3\.3/i);

		const zweck = NEU26.knoten.find((k) => k.id === 'k-zweckbestimmung')!;
		expect(zweck.beispiele!.join(' ')).toMatch(/ohnehin erlaubter Berufsausübung/);
		expect(zweck.beispiele!.join(' '), 'Gewerbe war seit 2004 erlaubt').not.toMatch(
			/generell Gewerbe/
		);
	});

	it('ändert am Erfordernis nichts', () => {
		const angefasst = new Set(['k-grenzfall-nutzung', 'k-benutzungsweise', 'k-zweckbestimmung']);
		for (const alt of VOR26.knoten) {
			const neu = NEU26.knoten.find((k) => k.id === alt.id)!;
			expect(neu.typ, alt.id).toBe(alt.typ);
			expect(neu.kopfbasis, alt.id).toBe(alt.kopfbasis);
			expect(neu.quotenbasis, alt.id).toBe(alt.quotenbasis);
			expect(neu.reglementsverhalten, alt.id).toBe(alt.reglementsverhalten);
			expect(neu.empfehlung, alt.id).toBe(alt.empfehlung);
			expect(neu.hinweise, alt.id).toEqual(alt.hinweise);
			if (!angefasst.has(alt.id)) expect(neu, alt.id).toEqual(alt);
		}
	});
});

describe('Kein Kartentext trägt Markup', () => {
	/*
	 * **Die Klasse, nicht die Stelle** (23.09.2026). Ein Vorschlag wollte
	 * einen Link in die Empfehlung einer Karte schreiben, mit dem richtigen
	 * Befund, dass die Website die Karten per `innerHTML` zusammensetzt. Der
	 * zweite Verbraucher war nicht mitgedacht: Votum gibt dieselben Felder als
	 * gewöhnliche Svelte-Interpolation aus und zeigt ein `<a>`-Tag wörtlich.
	 *
	 * Der Verweis steht deshalb im Export (`VERWEISE` in
	 * `scripts/quorumsbaum-export.mjs`), und diese Probe hält fest, dass er
	 * nicht in die Quelle zurückwandert. Sie läuft über **alle** Fassungen,
	 * damit auch eine künftige davon erfasst ist.
	 *
	 * **Sternchen sind nicht dabei**, obwohl sie dasselbe Problem sind: Die
	 * Basisfassung trägt drei Stellen mit `**Fett**` in Hilfetexten, und die
	 * eingefrorenen Fassungen erben sie. Sie hier zu verbieten, hiesse
	 * ausgelieferte Fassungen zu ändern. Sie gehören auf der Anzeigeseite
	 * behandelt; geführt als eigener Punkt.
	 */
	it('kein HTML in irgendeinem angezeigten Text, über alle Fassungen', () => {
		/*
		 * **Der erste Entwurf deckte nicht, was sein Name versprach** (Code-Review
		 * 23.09.2026). Er nannte «Knoten, Fragen oder Äste», eine Schleife über
		 * die Äste gab es aber nicht, und `rechtsgrundlage`,
		 * `betroffeneErlaeuterung` sowie die Texte auf Regelwerksebene fehlten
		 * ebenfalls. Alle gehen in den Abzug und werden dort per `innerHTML`
		 * eingesetzt.
		 *
		 * Die Zählschranke fing das nicht: Allein die Knotenfelder liegen über
		 * allen Fassungen deutlich über 500, ein weggefallener Schleifenteil wäre
		 * also unbemerkt geblieben. Sie ist jetzt an der tatsächlichen Zahl
		 * ausgerichtet.
		 */
		const markup = /<\/?[a-z][^>]*>/i;
		/*
		 * **Gezählt wird je Gruppe, nicht insgesamt.** Eine einzige Schranke über
		 * alles wäre wertlos: Gemessen sind es 3421 Felder, und die Knotenfelder
		 * allein tragen den grössten Teil. Fiele die Schleife über die Fragen
		 * oder die Äste weg, bliebe die Summe weit über jeder vernünftigen
		 * Untergrenze, und genau das soll die Schranke verhindern.
		 */
		const zahl = { regelwerk: 0, aeste: 0, knoten: 0, fragen: 0 };
		const pruefe = (gruppe: keyof typeof zahl, wo: string, wert: unknown) => {
			if (typeof wert !== 'string') return;
			zahl[gruppe]++;
			expect(markup.test(wert), `${wo} trägt Markup: Votum zeigt es wörtlich`).toBe(false);
		};

		for (const rw of alleFassungen()) {
			const f = rw.fassung;
			pruefe('regelwerk', `${f}/wortlautErklaerung`, rw.wortlautErklaerung);
			pruefe('regelwerk', `${f}/gemischteGeschaefte`, rw.gemischteGeschaefte);
			pruefe('regelwerk', `${f}/reglementsvorbehalt`, rw.reglementsvorbehalt);
			/*
			 * **`freigabevermerk` fehlte, und er wird angezeigt** (Code-Review
			 * 23.09.2026): `routes/quorum/+page.svelte` und
			 * `routes/.../erfordernis/+page.svelte` setzen ihn ein. Er war von
			 * beiden Wächtern ungedeckt, obwohl jede Fassung ihn verlängert —
			 * die Stelle also, an der am häufigsten geschrieben wird.
			 *
			 * `quellen` und `wortlautArtikel` kommen mit, obwohl sie heute
			 * nirgends ausgegeben werden. Sie kosten nichts und decken den Tag,
			 * an dem jemand einen Verbraucher dafür baut.
			 */
			pruefe('regelwerk', `${f}/freigabevermerk`, rw.freigabevermerk);
			for (const [i, q] of (rw.quellen ?? []).entries())
				pruefe('regelwerk', `${f}/quellen[${i}]`, q);
			for (const [i, a] of (rw.wortlautArtikel ?? []).entries())
				pruefe('regelwerk', `${f}/wortlautArtikel[${i}]`, a);
			for (const [name, typ] of Object.entries(rw.ergebnistypen ?? {}))
				for (const [feld, wert] of Object.entries(typ as unknown as Record<string, unknown>))
					pruefe('regelwerk', `${f}/ergebnistypen/${name}/${feld}`, wert);
			for (const ast of rw.aeste) {
				pruefe('aeste', `${f}/${ast.id}/titel`, ast.titel);
				pruefe('aeste', `${f}/${ast.id}/beschreibung`, ast.beschreibung);
			}
			for (const k of rw.knoten) {
				for (const feld of [
					'titel',
					'begruendung',
					'empfehlung',
					'formel',
					'betroffeneErlaeuterung',
					'rechtsgrundlage'
				] as const)
					pruefe('knoten', `${f}/${k.id}/${feld}`, k[feld]);
				for (const [i, h] of (k.hinweise ?? []).entries()) pruefe('knoten', `${f}/${k.id}/hinweise[${i}]`, h);
				for (const [i, b] of (k.beispiele ?? []).entries()) pruefe('knoten', `${f}/${k.id}/beispiele[${i}]`, b);
			}
			for (const q of rw.fragen) {
				pruefe('fragen', `${f}/${q.id}/text`, q.text);
				pruefe('fragen', `${f}/${q.id}/hilfe`, q.hilfe);
				for (const a of q.antworten) {
					pruefe('fragen', `${f}/${q.id}/${a.id}/text`, a.text);
					pruefe('fragen', `${f}/${q.id}/${a.id}/hilfe`, a.hilfe);
				}
			}
		}
		/*
		 * **Gemessen, nicht geschätzt** (23.09.2026, elf Fassungen): 442 Texte
		 * auf Regelwerksebene, 198 an den Ästen, 2004 an den Knoten, 777 an den
		 * Fragen. Die Schranken liegen knapp darunter, damit der Wegfall einer
		 * Gruppe auffällt; eine neue Fassung hebt alle vier, eine gelöschte
		 * Gruppe senkt genau eine auf null.
		 *
		 * **Der Sprung auf der Regelwerksebene von 270 auf 442 ist der Wächter
		 * selbst**, nicht die neue Fassung: `freigabevermerk`, `quellen` und
		 * `wortlautArtikel` sind gerade dazugekommen. Wer die nächste Zahl mit
		 * dieser vergleicht, vergleicht wieder Gleiches.
		 *
		 * **Die Zahlen altern mit jeder Fassung, die Schranken nicht.** Wer
		 * eine Fassung hinzufügt, misst hier nach und zieht beide nach; sonst
		 * steht «gemessen» neben einem Wert, den niemand mehr gemessen hat.
		 *
		 * Der erste Entwurf hatte hier geratene Zahlen, und eine davon lag über
		 * dem wahren Wert. Die Probe war rot, bevor sie je etwas gefunden hätte.
		 */
		expect(zahl.regelwerk, 'die Texte auf Regelwerksebene fehlen').toBeGreaterThan(420);
		expect(zahl.aeste, 'die Äste fehlen').toBeGreaterThan(190);
		expect(zahl.knoten, 'die Knotenfelder fehlen').toBeGreaterThan(1950);
		expect(zahl.fragen, 'die Fragen fehlen').toBeGreaterThan(750);
	});

	it('kein Fettdruck in den Feldern, die der Anzeigepfad nicht reinigt', () => {
		/*
		 * **Ein Kommentar ist kein Wächter** (Code-Review 23.09.2026). Der
		 * Anzeigepfad entfernt `**…**` aus Fragen und Brotkrumen, nicht aus den
		 * Ergebniskarten. In der Fassungsdatei stand die Regel nur als Kommentar
		 * neben dem einen Text, in den sie fast hineingeraten wäre.
		 *
		 * Geprüft wird **nur die aktuelle Fassung**: Die Hilfetexte der
		 * eingefrorenen Fassungen tragen Auszeichnung, und sie dort zu verbieten
		 * hiesse, ausgelieferte Fassungen zu ändern (AD-4). Der Export braucht
		 * sie ausserdem, um daraus `<strong>` zu machen.
		 */
		const rw = holeRegelwerk();
		let geprueft = 0;
		const ohneFett = (wo: string, wert: unknown) => {
			if (typeof wert !== 'string') return;
			geprueft++;
			expect(wert.includes('**'), `${wo}: der Anzeigepfad reinigt dieses Feld nicht`).toBe(false);
		};
		for (const k of rw.knoten) {
			for (const feld of ['titel', 'begruendung', 'empfehlung', 'formel'] as const)
				ohneFett(`${k.id}/${feld}`, k[feld]);
			for (const [i, h] of (k.hinweise ?? []).entries()) ohneFett(`${k.id}/hinweise[${i}]`, h);
			for (const [i, b] of (k.beispiele ?? []).entries()) ohneFett(`${k.id}/beispiele[${i}]`, b);
		}
		expect(geprueft, 'keine Knotenfelder gesehen').toBeGreaterThan(50);
	});
});

/*
 * Die Fassung 2026-09-27 belegt, was unbelegt dastand, und vervollständigt eine
 * Karte, der eine von drei Bedingungen fehlte. Ihre Zusage: **am Erfordernis
 * ändert sich an keiner Stelle etwas.** Diese Proben rechnen sie nach.
 */
const VOR27 = holeRegelwerk('2026-09-26');
const NEU27 = holeRegelwerk('2026-09-27');

describe('Die Fassung 2026-09-27 gegenüber 2026-09-26', () => {
	it('ändert an keinem Knoten das Erfordernis', () => {
		/*
		 * Verglichen wird, was rechnet — nicht der ganze Knoten, denn Texte
		 * ändern sich gerade absichtlich. Fiele hier etwas auf, hätte eine
		 * Fassung, die sich «nur Belege» nennt, die Rechtslage verschoben.
		 */
		/*
		 * **`reglementsverhalten` gehört dazu, und ein erster Entwurf hat es
		 * ausgelassen** (Code-Review 23.09.2026). Es ist kein Textmerkmal:
		 * `wendeReglementAn` entscheidet allein daran, ob eine hinterlegte
		 * Reglementsregel das gesetzliche Erfordernis **ersetzt**. Genau diese
		 * Auslassung war Befund 1 des Code-Reviews vom 22.09.2026, und der
		 * Entwurf hat sie wiederholt. Ebenso `formel` (die Zählanweisung, die
		 * vor der Abstimmung vorgelesen wird) und `betroffeneErlaeuterung`.
		 */
		const rechnend = (rw: Regelwerk) =>
			rw.knoten.map((k) => ({
				id: k.id,
				typ: k.typ,
				geschaeftsart: k.geschaeftsart,
				kopfbasis: k.kopfbasis,
				quotenbasis: k.quotenbasis,
				rechtsgrundlage: k.rechtsgrundlage,
				zustimmungBetroffenerNoetig: k.zustimmungBetroffenerNoetig,
				wortlautAbweichung: k.wortlautAbweichung,
				reglementsverhalten: k.reglementsverhalten,
				formel: k.formel,
				betroffeneErlaeuterung: k.betroffeneErlaeuterung
			}));
		expect(rechnend(NEU27)).toEqual(rechnend(VOR27));

		/*
		 * **Und jeder Knoten, den diese Fassung nicht anfasst, bleibt ganz
		 * gleich.** Das ist die Probe, die die zwei verlorenen
		 * Lehrstreit-Hinweise gefunden hätte — sie sind an Knoten passiert, die
		 * die Fassung anfasst, deshalb braucht es daneben die Signetprobe.
		 */
		const angefasst = new Set(['k-baulich-luxurioes', 'k-baulich-luxurioes-ausweg']);
		for (const k of NEU27.knoten.filter((x) => !angefasst.has(x.id))) {
			expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(
				VOR27.knoten.find((x) => x.id === k.id)
			);
		}
		expect(NEU27.fragen).toEqual(VOR27.fragen);
		expect(NEU27.aeste).toEqual(VOR27.aeste);
		expect(NEU27.ergebnistypen).toEqual(VOR27.ergebnistypen);
	});

	it('ist in sich stimmig und bleibt als nicht gegengelesen gekennzeichnet', () => {
		expect(pruefeRegelwerk(NEU27)).toEqual([]);
		expect(NEU27.juristischGegengelesen).toBe(false);
	});

	it('nennt beim Ausweg alle drei Bedingungen, nicht zwei', () => {
		/*
		 * **Die mittlere fehlte, und sie ist die teuerste.** Rz. 135 ad
		 * Art. 712a nennt drei kumulative Bedingungen; die Karte nannte die
		 * dauernde Beeinträchtigung und den Kostenanteil. Der **Ersatz für die
		 * bloss vorübergehende Beeinträchtigung** stand nirgends. Wer nur an
		 * die Kosten denkt, beschliesst den Ausweg und hat eine Bedingung
		 * nicht erfüllt.
		 */
		const k = NEU27.knoten.find((x) => x.id === 'k-baulich-luxurioes-ausweg')!;
		const alles = [k.begruendung, ...(k.hinweise ?? [])].join(' ');
		expect(alles).toMatch(/dauernd/);
		expect(alles, 'die zweite Bedingung fehlt').toMatch(/vorübergehende Beeinträchtigung/);
		expect(alles).toMatch(/Kostenanteil/);
		expect(alles, 'ohne «kumulativ» liest sich das wie eine Auswahl').toMatch(/zugleich|kumulativ/);
		expect(alles).toMatch(/Rz\. 135/);

		/*
		 * **Und die Beweislast, samt der Herkunft ihrer Fundstelle.** Rz. 135a
		 * stützt sich auf einen Entscheid des Kantonsgerichts von Graubünden.
		 * Ihn als «das Gericht» auszugeben, ist genau der Fehler, den die
		 * Fachprüfung am 23.09.2026 zweimal gefunden hat, deshalb sichert die
		 * Probe das Wort «kantonal» und nicht bloss die Aktennummer.
		 */
		expect(alles).toMatch(/Rz\. 135a/);
		expect(alles).toMatch(/beweisen/);
		expect(alles, 'die kantonale Herkunft muss dastehen').toMatch(/kantonal/i);

		// Und der strenge Knoten daneben verweist auf denselben Dreiklang.
		const streng = NEU27.knoten.find((x) => x.id === 'k-baulich-luxurioes')!;
		expect(streng.hinweise!.join(' ')).toMatch(/drei Bedingungen/);
	});

	it('belegt den Trennungsrat am baulichen Fall und nicht darüber hinaus', () => {
		/*
		 * **Rz. 115a spricht von Bauprojekten und den drei baulichen
		 * Kategorien.** Der Rat dieser Anwendung gilt für gemischte Geschäfte
		 * überhaupt. Eine Fundstelle am allgemeinen Satz behauptete mehr, als
		 * die Quelle hergibt — deshalb steht der Beleg hinter dem baulichen
		 * Beispiel, und diese Probe hält die Reihenfolge fest.
		 */
		const t = NEU27.gemischteGeschaefte;
		expect(t).toMatch(/Rz\. 115a/);
		expect(t).toMatch(/5A_798\/2010 E\. 4\.6\.2/);

		/*
		 * **Der Vorbehalt steht vor dem Beleg, und beide müssen dastehen.**
		 * Ein erster Entwurf schrieb `indexOf(a) < indexOf(b)` ohne den Anker
		 * zu sichern: Fehlt «Für Bauprojekte», gibt `indexOf` −1 zurück, und
		 * −1 ist kleiner als jede Zahl. Die Probe wäre grün geblieben,
		 * ausgerechnet in dem Fall, den sie verhindern soll — der Beleg hinge
		 * dann wieder am allgemeinen Satz.
		 */
		const vorbehalt = t.indexOf('Für Bauprojekte');
		const beleg = t.indexOf('Rz. 115a');
		expect(vorbehalt, 'der bauliche Vorbehalt «Für Bauprojekte» fehlt').toBeGreaterThan(-1);
		expect(beleg, 'die Fundstelle fehlt').toBeGreaterThan(-1);
		expect(vorbehalt, 'der bauliche Vorbehalt muss vor der Fundstelle stehen').toBeLessThan(beleg);
	});

	it('nimmt BGE 134 III 481 nicht für die Bezugsgrösse in Anspruch', () => {
		/*
		 * **Die Gegenrichtung, und sie ist der Grund für diese Probe.** Ein
		 * erster Entwurf dieser Fassung las E. 3.9 («ungültig zu betrachten und
		 * nicht zu zählen») als Entscheid auch über den **Nenner**. Der Satz
		 * steht über die abgegebenen Stimmen, und der Fall konnte die Frage
		 * nicht stellen: Die beiden Ausgeschlossenen waren die einzigen
		 * Teilnehmer der Versammlung.
		 *
		 * Die Probe sichert deshalb nicht, dass der Entscheid dasteht, sondern
		 * dass er **mit seiner Grenze** dasteht. Wer ihn später ohne sie
		 * zitiert, stösst hier an.
		 */
		const eintrag = NEU27.quellen.find((q) => q.includes('134 III 481'))!;
		expect(eintrag, 'der Entscheid fehlt in der Quellenliste').toBeDefined();
		expect(eintrag).toMatch(/E\. 3\.8/);
		expect(eintrag).toMatch(/E\. 3\.9/);
		expect(eintrag, 'die Grenze des Entscheids fehlt').toMatch(/Bezugsgrösse/);
		expect(eintrag).toMatch(/äussert sich der Entscheid nicht/);
	});

	it('führt den Revisionsentwurf mit dem Vermerk, dass er nicht gilt', () => {
		/*
		 * Eine Fassungskennung bleibt für immer stehen (AD-4). Wer 2029
		 * nachschlägt, warum ein Beschluss von 2026 so gerechnet wurde, soll
		 * sehen, was damals schon bekannt und was noch nicht in Kraft war.
		 */
		const eintrag = NEU27.quellen.find((q) => q.includes('BBl 2026 1517'))!;
		expect(eintrag, 'der Entwurf fehlt in der Quellenliste').toBeDefined();
		expect(eintrag, 'ohne diesen Vermerk liest ihn jemand als geltendes Recht').toMatch(
			/Gilt nicht/
		);
		expect(eintrag).toMatch(/712obis/);
		expect(eintrag).toMatch(/712o Abs\. 3/);
		expect(eintrag).toMatch(/712n Abs\. 2/);
		expect(eintrag).toMatch(/712g Abs\. 4/);

		// Und keine Karte rechnet nach dem Entwurf: Er steht in der Quellenliste
		// und in keinem Knotentext.
		for (const k of NEU27.knoten) {
			const texte = [k.begruendung, k.empfehlung, ...(k.hinweise ?? []), ...(k.beispiele ?? [])]
				.filter((t): t is string => typeof t === 'string')
				.join(' ');
			expect(/712obis|BBl 2026 1517/.test(texte), `${k.id} rechnet nach dem Entwurf`).toBe(false);
		}
	});
});

/**
 * **Die Fassung 2026-09-29** ändert an den beiden Knoten mit Zustimmung
 * Betroffener nur die Erläuterung, wer betroffen ist (Fachprüfung 25.09.2026,
 * B7 und B8). Ihre Zusage: am Erfordernis ändert sich nichts, und jeder andere
 * Knoten bleibt ganz gleich. Diese Proben rechnen das nach.
 */
const VOR29 = holeRegelwerk('2026-09-28');
const NEU29 = holeRegelwerk('2026-09-29');

describe('Die Fassung 2026-09-29 gegenüber 2026-09-28', () => {
	const angefasst = new Set(['k-nutzungsrecht-zuteilung', 'k-wertquoten-aendern']);

	it('ändert an keinem Knoten das Erfordernis, und an den beiden nur die Erläuterung', () => {
		for (const k of NEU29.knoten) {
			const vor = VOR29.knoten.find((x) => x.id === k.id)!;
			if (angefasst.has(k.id)) {
				const { betroffeneErlaeuterung: _neu, ...rest } = k;
				const { betroffeneErlaeuterung: _alt, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Erläuterung geändert`).toEqual(restVor);
				expect(k.betroffeneErlaeuterung).not.toBe(vor.betroffeneErlaeuterung);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		expect(NEU29.knoten.map((k) => k.id)).toEqual(VOR29.knoten.map((k) => k.id));
		/*
		 * **Alles ausserhalb der Knoten bleibt gleich, bis auf drei Felder**
		 * (Codeprüfung 26.09.2026): Ein Vergleich Feld für Feld hätte ein neues
		 * Feld der Vorfassung übersehen, das diese Fassung neu setzt statt zu
		 * ergänzen, die Fehlerklasse, die schon einmal zwei Lehrstreite löschte.
		 */
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU29;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR29;
		expect(restNeu).toEqual(restVor);
		// Die drei gewollten Felder werden ergänzt, nicht ersetzt.
		expect(NEU29.freigabevermerk.startsWith(VOR29.freigabevermerk)).toBe(true);
		expect(NEU29.freigabevermerk).toMatch(/Am 29\.09\.2026 .* Am Erfordernis ändert sich nichts\.$/);
		expect(NEU29.quellen).toHaveLength(VOR29.quellen.length + 1);
	});

	it('ist in sich stimmig und behält die Kennzeichnung der Vorfassung', () => {
		expect(pruefeRegelwerk(NEU29)).toEqual([]);
		expect(NEU29.juristischGegengelesen).toBe(VOR29.juristischGegengelesen);
		// Ergänzt, nicht ersetzt: die Quellen der Vorfassung bleiben alle stehen.
		expect(NEU29.quellen.slice(0, VOR29.quellen.length)).toEqual(VOR29.quellen);
	});

	it('B8: beim Nutzungsrecht zählt jede Änderung, auch eine Ausweitung', () => {
		const t = NEU29.knoten.find((k) => k.id === 'k-nutzungsrecht-zuteilung')!.betroffeneErlaeuterung!;
		expect(t).toMatch(/bei jeder Änderung, auch bei einer Erweiterung/);
		expect(t).toMatch(/Dauer, Entschädigung oder Unterhaltspflicht/);
		expect(t).not.toMatch(/entzieht, schmälert oder verschiebt/);
		// Nach der Fachprüfung (Runden 2 und 3) keine Rechtsfolge zu Art. 712h Abs. 3,
		// sondern die offene Frage und der Schritt: Die Praxis ist zurückhaltend.
		expect(t).not.toMatch(/nichtig/);
		expect(t).toMatch(/Gartensitzplatz, nicht geklärt \(Art\. 712h Abs\. 3\)/);
	});

	it('B7: bei den Wertquoten stehen die Grundpfandgläubiger da, bei Senkung wie Erhöhung', () => {
		const t = NEU29.knoten.find((k) => k.id === 'k-wertquoten-aendern')!.betroffeneErlaeuterung!;
		expect(t).toMatch(/Grundpfandgläubiger/);
		expect(t).toMatch(/bei einer Senkung wie bei einer Erhöhung/);
		expect(t).toMatch(/nicht in der Versammlung, sondern in der öffentlichen Urkunde/);
	});

	it('lässt die Vorfassung unangetastet', () => {
		expect(
			VOR29.knoten.find((k) => k.id === 'k-nutzungsrecht-zuteilung')!.betroffeneErlaeuterung
		).toMatch(/entzieht, schmälert oder verschiebt/);
	});
});

/**
 * **Die Fassung 2026-09-30** berichtigt die Karten zur luxuriösen Massnahme
 * und den Satz zu gemischten Geschäften, nach der Laien- und Fachprüfung, die
 * die Texte der Fassung 2026-09-27 nie hatten. Zusage: am Erfordernis ändert
 * sich nichts, und die Lehrstreite L-4 und B2 bleiben.
 */
const VOR30 = holeRegelwerk('2026-09-29');
const NEU30 = holeRegelwerk('2026-09-30');

describe('Die Fassung 2026-09-30 gegenüber 2026-09-29', () => {
	const angefasst = new Set(['k-baulich-luxurioes', 'k-baulich-luxurioes-ausweg']);
	const ausweg = () => NEU30.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!;
	const luxus = () => NEU30.knoten.find((k) => k.id === 'k-baulich-luxurioes')!;

	it('ändert an den zwei Karten nur Texte und sonst nichts', () => {
		expect(NEU30.knoten.map((k) => k.id)).toEqual(VOR30.knoten.map((k) => k.id));
		for (const k of NEU30.knoten) {
			const vor = VOR30.knoten.find((x) => x.id === k.id)!;
			if (angefasst.has(k.id)) {
				const { hinweise: _h1, begruendung: _b1, ...rest } = k;
				const { hinweise: _h2, begruendung: _b2, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Texte geändert`).toEqual(restVor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, gemischteGeschaefte: _g1, ...restNeu } = NEU30;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, gemischteGeschaefte: _g2, ...restVor } = VOR30;
		expect(restNeu).toEqual(restVor);
		expect(NEU30.freigabevermerk.startsWith(VOR30.freigabevermerk)).toBe(true);
		expect(NEU30.quellen.slice(0, VOR30.quellen.length)).toEqual(VOR30.quellen);
		expect(NEU30.quellen).toHaveLength(VOR30.quellen.length + 1);
		expect(pruefeRegelwerk(NEU30)).toEqual([]);
	});

	it('lässt die Lehrstreite L-4 und B2 stehen', () => {
		const vorLuxus = VOR30.knoten.find((k) => k.id === 'k-baulich-luxurioes')!.hinweise!;
		expect(luxus().hinweise).toContain(vorLuxus.find((h) => h.startsWith('Auch die Zählung ist umstritten')));
		const b2 = ausweg().hinweise!.find((h) => h.startsWith('Ob das Reglement dieses Quorum mildern darf'));
		expect(b2).toMatch(/Art\. 712g Rz\. 54/);
		// Beleg berichtigt: Rz. 125 betrifft notwendige Massnahmen (Fachprüfung 26.09.2026).
		expect(b2).toMatch(/\(Art\. 712a Rz\. 136\)/);
		expect(b2).not.toMatch(/Rz\. 125/);
	});

	it('nennt bei der Beweislast die Anfechtung beim Gericht und die Monatsfrist', () => {
		const alles = ausweg().hinweise!.join(' ');
		expect(alles).toMatch(/innert eines Monats beim Gericht anfechten/);
		expect(alles).toMatch(/Ohne Anfechtung gilt der Beschluss/);
		expect(alles).not.toMatch(/Wer später bestreitet/);
		expect(alles).not.toMatch(/fällt die Massnahme zurück/);
	});

	it('sagt in der Begründung, dass die Kostenübernahme allein nicht genügt', () => {
		expect(ausweg().begruendung).toMatch(/Die Kostenübernahme allein genügt nicht/);
		// Der Vorspann zum Grundsatz bleibt (Vorgabe vom 15.08.2026).
		expect(ausweg().begruendung).toMatch(/^Grundsatz ist die Einstimmigkeit/);
	});

	it('behält die Kernaussagen der Vorfassung an beiden Karten', () => {
		/*
		 * Codeprüfung 26.09.2026: Die Proben zu 2026-09-27 hängen an jener
		 * Fassung und schützen die aktuelle nicht. Hier stehen sie für diese.
		 */
		const ausweg_ = ausweg().hinweise!.join(' ');
		expect(luxus().hinweise![0]).toMatch(/drei Bedingungen zugleich/);
		for (const teil of [/vorübergehend/, /Kostenanteil/, /Rz\. 135a/, /kantonaler Entscheid/]) {
			expect(ausweg_).toMatch(teil);
		}
		expect(ausweg().begruendung).toMatch(/drei Bedingungen zugleich/);
		expect(ausweg().hinweise).not.toEqual(VOR30.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!.hinweise);
		expect(NEU30.gemischteGeschaefte.indexOf('Für Bauprojekte')).toBeLessThan(
			NEU30.gemischteGeschaefte.indexOf('Rz. 115a')
		);
	});

	it('belegt den Trennungsrat nur für Bauprojekte mit einem luxuriösen Teil', () => {
		expect(NEU30.gemischteGeschaefte).toMatch(/Für Bauprojekte mit einem luxuriösen Teil/);
		expect(NEU30.gemischteGeschaefte).toMatch(/für durchführbar/);
		expect(NEU30.gemischteGeschaefte).not.toMatch(/zumutbar/);
		// Der Satz zur Vorsichtsregel bleibt wörtlich.
		expect(NEU30.gemischteGeschaefte.startsWith(VOR30.gemischteGeschaefte.split('. ')[0])).toBe(true);
	});
});

/**
 * **Die Fassung 2026-10-01** berichtigt die Frage `f1-4` vor den Karten zur
 * luxuriösen Massnahme. Zusage: nur Texte dieser einen Frage, jede Antwort
 * behält Kennung und Ziel, und sonst bleibt alles gleich.
 */
const VOR01 = holeRegelwerk('2026-09-30');
const NEU01 = holeRegelwerk('2026-10-01');

describe('Die Fassung 2026-10-01 gegenüber 2026-09-30', () => {
	const frage = (rw: Regelwerk) => rw.fragen.find((f) => f.id === 'f1-4')!;

	it('ändert nur Texte der Frage f1-4, kein Ziel und sonst nichts', () => {
		const { fassung: _f1, fragen: _q1, freigabevermerk: _v1, ...restNeu } = NEU01;
		const { fassung: _f2, fragen: _q2, freigabevermerk: _v2, ...restVor } = VOR01;
		expect(restNeu).toEqual(restVor);
		expect(NEU01.fragen.filter((f) => f.id !== 'f1-4')).toEqual(VOR01.fragen.filter((f) => f.id !== 'f1-4'));
		expect(frage(NEU01).text).toBe(frage(VOR01).text);
		expect(Object.keys(frage(NEU01)).sort()).toEqual(Object.keys(frage(VOR01)).sort());
		expect(frage(NEU01).antworten.find((a) => a.id === 'f1-4-ja')).toEqual(
			frage(VOR01).antworten.find((a) => a.id === 'f1-4-ja')
		);
		expect(frage(NEU01).antworten.map((a) => [a.id, a.ziel])).toEqual(
			frage(VOR01).antworten.map((a) => [a.id, a.ziel])
		);
		expect(NEU01.freigabevermerk.startsWith(VOR01.freigabevermerk)).toBe(true);
		expect(pruefeRegelwerk(NEU01)).toEqual([]);
	});

	it('verlangt Ersatz nur, soweit jemand vorübergehend beeinträchtigt wird', () => {
		const f = frage(NEU01);
		expect(f.hilfe).toMatch(/soweit ihn die Arbeiten vorübergehend beeinträchtigen/);
		expect(f.hilfe).not.toMatch(/die übrigen die vorübergehende Beeinträchtigung ersetzen/);
		const nein = f.antworten.find((a) => a.id === 'f1-4-nein')!;
		expect(nein.text).toMatch(/soweit er vorübergehend beeinträchtigt wird/);
		const keine = f.antworten.find((a) => a.id === 'f1-4-keine-uebernahme')!;
		expect(keine.text).toMatch(/die Kostenübernahme oder ein nötiger Ersatz ist nicht zugesagt/);
		expect(keine.hilfe).toMatch(/Ersatz braucht es nur, soweit/);
		// Die Hilfe verweist wörtlich auf die Ausweg-Antwort; ändert deren Text, veraltet der Verweis.
		const verweis = keine.hilfe!.match(/die Antwort «(.+?) …»/)![1];
		expect(nein.text.startsWith(verweis)).toBe(true);
	});

	it('nennt den Massstab, damit eine blosse Behauptung die Frage nicht unklar macht', () => {
		expect(frage(NEU01).hilfe).toMatch(/Durchschnittsmenschen/);
		expect(frage(NEU01).hilfe).toMatch(/bloss behauptet, ohne einen Grund zu nennen/);
		// Der zweite Ausweg der Karte (Fachprüfung Runde 2) und die Richtung bei den laufenden Kosten.
		expect(frage(NEU01).hilfe).toMatch(/ausser Sie ändern das Projekt/);
		expect(frage(NEU01).hilfe).toMatch(/am sichersten übernehmen die übrigen auch diese Kosten/);
	});
});

/**
 * **Die Fassung 2026-10-02** ergänzt die Karte zur luxuriösen Massnahme mit
 * qualifiziertem Mehr um die laufenden Kosten, den Nutzungsausschluss und die
 * Fläche mit Sondernutzungsrecht und fasst die erste Bedingung für eine
 * gemeinsame Fläche. Zusage: nur Hinweise dieser einen Karte und die Hilfe der
 * Frage `f1-4`; jede Antwort behält Kennung und Ziel, am Erfordernis ändert
 * sich nichts, und die Lehrstreite der Karte bleiben.
 */
const VOR02 = holeRegelwerk('2026-10-01');
const NEU02 = holeRegelwerk('2026-10-02');

describe('Die Fassung 2026-10-02 gegenüber 2026-10-01', () => {
	const karte = (rw: Regelwerk) => rw.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!;
	const frage = (rw: Regelwerk) => rw.fragen.find((f) => f.id === 'f1-4')!;

	it('ändert nur die Hinweise einer Karte und die Hilfe einer Frage', () => {
		expect(NEU02.knoten.map((k) => k.id)).toEqual(VOR02.knoten.map((k) => k.id));
		for (const k of NEU02.knoten) {
			const vor = VOR02.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-baulich-luxurioes-ausweg') {
				const { hinweise: _h1, ...rest } = k;
				const { hinweise: _h2, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Hinweise geändert`).toEqual(restVor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		expect(NEU02.fragen.filter((f) => f.id !== 'f1-4')).toEqual(VOR02.fragen.filter((f) => f.id !== 'f1-4'));
		const { hilfe: _hq1, ...restFrage } = frage(NEU02);
		const { hilfe: _hq2, ...restFrageVor } = frage(VOR02);
		expect(restFrage).toEqual(restFrageVor);
		const { fassung: _f1, quellen: _q1, knoten: _k1, fragen: _r1, freigabevermerk: _v1, ...restNeu } = NEU02;
		const { fassung: _f2, quellen: _q2, knoten: _k2, fragen: _r2, freigabevermerk: _v2, ...restVor } = VOR02;
		expect(restNeu).toEqual(restVor);
		expect(NEU02.freigabevermerk.startsWith(VOR02.freigabevermerk)).toBe(true);
		expect(NEU02.quellen.slice(0, VOR02.quellen.length)).toEqual(VOR02.quellen);
		expect(NEU02.quellen).toHaveLength(VOR02.quellen.length + 1);
		expect(pruefeRegelwerk(NEU02)).toEqual([]);
	});

	it('ersetzt zwei Bedingungen, fügt drei Hinweise ein und ergänzt die Anfechtung, sonst bleibt alles', () => {
		const vor = karte(VOR02).hinweise!;
		const neu = karte(NEU02).hinweise!;
		expect(neu).toHaveLength(vor.length + 3);
		const iErste = vor.findIndex((h) => h.startsWith('Erste Bedingung:'));
		const iDritte = vor.findIndex((h) => h.startsWith('Dritte Bedingung:'));
		const iAnfechtung = vor.findIndex((h) => h.startsWith('Wer bestreitet, dass die drei Bedingungen'));
		expect(iErste).toBeGreaterThanOrEqual(0);
		expect(iDritte).toBeGreaterThan(iErste);
		expect(iAnfechtung).toBeGreaterThan(iDritte);
		// Alles ausser den drei angefassten Stellen steht wörtlich und in derselben Reihenfolge da,
		// darunter die Beweislast und der Lehrstreit B2.
		const unberuehrt = vor.filter((_, i) => i !== iErste && i !== iDritte && i !== iAnfechtung);
		expect(neu.filter((h) => unberuehrt.includes(h))).toEqual(unberuehrt);
		expect(neu[iErste]).toMatch(/^Erste Bedingung:/);
		expect(neu[iDritte]).toMatch(/^Dritte Bedingung:/);
		expect(neu[iDritte + 1]).toMatch(/^Ob der Kostenanteil auch Betrieb und Unterhalt umfasst/);
		// «wirkt wie», nicht «ist»: die Einordnung steht so in keiner Quelle (Fachprüfung Runde 3, Befund E).
		expect(neu[iDritte + 2]).toMatch(/^Der Ausschluss von der Nutzung wirkt wie ein Sondernutzungsrecht/);
		expect(neu[iDritte + 3]).toMatch(/^Steht die Anlage auf einer Fläche mit Sondernutzungsrecht/);
		// Die Anfechtung bekommt nur ein Beispiel dazu, der Rest des Hinweises bleibt wörtlich.
		const alt = vor[iAnfechtung];
		const ergaenzt = neu[iAnfechtung + 3];
		expect(ergaenzt).toMatch(/oder weil ihn der Beschluss nicht von den laufenden Kosten befreit \(ob Letzteres genügt, ist nicht geklärt\)/);
		expect(ergaenzt.replace(' oder weil ihn der Beschluss nicht von den laufenden Kosten befreit (ob Letzteres genügt, ist nicht geklärt)', '')).toBe(alt);
		expect(neu.find((h) => h.startsWith('Ob das Reglement dieses Quorum mildern darf'))).toMatch(/Art\. 712a Rz\. 136/);
	});

	it('führt bei einer gemeinsamen Fläche zur Einstimmigkeit, von der Karte zurück an die Frage', () => {
		const erste = karte(NEU02).hinweise!.find((h) => h.startsWith('Erste Bedingung:'))!;
		// Massgebend ist das Recht, die Fläche zu benutzen, nicht die ausgeübte Nutzung; ausgenommen
		// eine Fläche mit Sondernutzungsrecht (Produktentscheide 27.09.2026; Art. 647e Abs. 2 schützt
		// das «Nutzungs- und Gebrauchsrecht»).
		expect(erste).toMatch(/eine gemeinsame Fläche, die er benutzen darf, etwa ein Pool im Garten oder eine Sauna im Kellerraum/);
		expect(erste).toMatch(/auch wenn er die Fläche selbst kaum genutzt hat/);
		expect(erste).toMatch(/Ausgenommen ist eine Fläche, an der ein anderer ein Sondernutzungsrecht hat/);
		// Die Karte selbst rechnet mit dem Mehr; sie schickt zurück an die Frage (Codeprüfung 27.09.2026, M1).
		expect(erste).toMatch(/Dieses Werkzeug geht dann von Einstimmigkeit aus: Wählen Sie an der Frage davor «Ja, oder es ist unklar»/);
		expect(erste).not.toMatch(/rechnet dann mit Einstimmigkeit/);
		expect(erste).toMatch(/ändern Sie das Projekt, bis er ausgeräumt ist/);
		expect(erste).toMatch(/geklärt ist das nicht/);
		expect(erste).not.toMatch(/tatsächlich genutzt|fällt nicht darunter|besonders sorgfältig/);
		const hilfe = frage(NEU02).hilfe!;
		expect(hilfe).toMatch(/wählen Sie «Ja, oder es ist unklar»/);
		expect(hilfe).toMatch(/das gilt vor allem anderen in dieser Hilfe/);
		// Die Zustimmung des Berechtigten gehört an die Weiche, nicht nur auf die Karte (Fachprüfung Runde 5, B1).
		expect(hilfe).toMatch(/dann braucht es aber seine Zustimmung \(ZGB Art\. 712g Abs\. 4\)\. Stimmt er nicht zu/);
		expect(hilfe).not.toMatch(/besonders sorgfältig/);
		// Die Hilfe nennt die Antwort wörtlich; ändert deren Text, veraltet der Verweis.
		const ja = frage(NEU02).antworten.find((a) => a.id === 'f1-4-ja')!;
		expect(hilfe).toContain(`«${ja.text}»`);
		expect(ja.ziel).toBe('k-baulich-luxurioes');
		// Der Vermerk sagt dasselbe wie die Karte (Fachprüfung Runde 5, B4).
		expect(NEU02.freigabevermerk).toMatch(/die ein Nichtzustimmender benutzen darf, geht das Werkzeug von Einstimmigkeit aus/);
		expect(NEU02.freigabevermerk).not.toMatch(/bisher genutzte/);
	});

	it('empfiehlt die Kostenregel über Nutzung und Einkauf als Beispiel, nicht als Rechtsfolge', () => {
		const alles = karte(NEU02).hinweise!.join(' ');
		// Das Zitat bleibt wörtlich; es neigt zur Befreiung (Fachprüfung Runde 3, Befund A).
		expect(alles).toMatch(/Betrieb und Unterhalt umfasst, ist nicht geklärt\. Der Kommentar sagt nur, der Nichtzustimmende sei «von den anfallenden Kosten zu befreien»/);
		expect(alles).toMatch(/zum Beispiel so: Wer nicht zugestimmt hat, darf die Anlage erst nutzen, wenn er sich eingekauft hat/);
		expect(alles).toMatch(/Als nicht zustimmend gilt auch, wer sich enthält oder fehlt/);
		// Kosten und Rechte hängen an der Wohnung, nicht an der Person (Fachprüfung Runde 5, B2).
		expect(alles).toMatch(/zulasten der Wohnungen der Zustimmenden und der eingekauften Wohnungen, nicht des Erneuerungsfonds/);
		expect(alles).toMatch(/hängen an der Wohnung, nicht an der Person/);
		// Den Ausschluss zuerst und für sich beschliessen, sonst hängt der Rest an ihm (Fachprüfung Runde 4).
		expect(alles).toMatch(/Stellen Sie ihn als eigenen Antrag und stimmen Sie zuerst darüber ab/);
		// Der Rat der Vorfassung, den die Karte ersetzt, ist weg, und die Rechtsfolge wird nicht aus
		// Art. 712h Abs. 3 behauptet (Fachprüfung Runde 2, B1).
		expect(alles).not.toMatch(/Am sichersten übernehmen die übrigen/);
		expect(alles).not.toMatch(/fallen die laufenden Kosten nicht auf ihn/);
		const hilfe = frage(NEU02).hilfe!;
		expect(hilfe).toMatch(/Regeln Sie es im Antrag, zum Beispiel so/);
		expect(hilfe).not.toMatch(/am sichersten übernehmen die übrigen auch diese Kosten/);
		// Erneuerung und Rückbau gehören zur Befreiung, der Fonds zur Kostenübernahme
		// (Fachprüfung Runde 3, F und G; Runde 4, H-a).
		expect(hilfe).toMatch(/Ob der Kostenanteil auch Betrieb, Unterhalt, Erneuerung und einen allfälligen Rückbau umfasst/);
		expect(hilfe).toMatch(/Hält der Antrag, über den abgestimmt wird, nicht fest, dass der Nichtzustimmende von diesen Kosten befreit ist/);
		expect(hilfe).toMatch(/Zugesagt ist sie nicht, wenn der Bau ganz oder teilweise aus dem Erneuerungsfonds bezahlt werden soll/);
		// Die Hilfe beginnt weiter mit den drei Bedingungen, und «Mehr dazu» trennt an derselben Stelle;
		// die Flächenregel steht direkt dahinter, vor dem Satz über blosse Behauptungen (Laienprüfung Runde 3).
		expect(teileHilfe(hilfe).anfang).toBe(teileHilfe(frage(VOR02).hilfe!).anfang);
		expect(teileHilfe(hilfe).mehr).toMatch(/^Belegt die Anlage dauernd eine gemeinsame Fläche/);
		expect(hilfe.indexOf('Belegt die Anlage')).toBeLessThan(hilfe.indexOf('bloss behauptet'));
	});
});

/*
 * **Ehegatte und Verwandte des Beklagten** (Produktentscheid 27.09.2026,
 * `quellen/themen/stockwerkeigentum/fragen.md`, «Offen»). Nur ein Hinweis an
 * einer Karte; alles andere bleibt, auch die fünf Hinweise, die sie schon trug
 * (drei aus 2026-07-30, zwei Lehrstreite aus 2026-08-16).
 */
const VOR03 = holeRegelwerk('2026-10-02');
const NEU03 = holeRegelwerk('2026-10-03');

describe('Die Fassung 2026-10-03 gegenüber 2026-10-02', () => {
	const karte = (rw: Regelwerk) => rw.knoten.find((k) => k.id === 'k-ausschlussklage')!;

	it('ändert nur die Hinweise der Karte zur Ausschlussklage', () => {
		expect(NEU03.knoten.map((k) => k.id)).toEqual(VOR03.knoten.map((k) => k.id));
		for (const k of NEU03.knoten) {
			const vor = VOR03.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-ausschlussklage') {
				const { hinweise: _h1, ...rest } = k;
				const { hinweise: _h2, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Hinweise geändert`).toEqual(restVor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		expect(NEU03.fragen).toEqual(VOR03.fragen);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU03;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR03;
		expect(restNeu).toEqual(restVor);
		expect(NEU03.freigabevermerk.startsWith(VOR03.freigabevermerk)).toBe(true);
		expect(NEU03.quellen.slice(0, VOR03.quellen.length)).toEqual(VOR03.quellen);
		expect(NEU03.quellen).toHaveLength(VOR03.quellen.length + 1);
		expect(pruefeRegelwerk(NEU03)).toEqual([]);
	});

	it('hängt einen Hinweis an und lässt die bisherigen wörtlich stehen', () => {
		const vor = karte(VOR03).hinweise!;
		const neu = karte(NEU03).hinweise!;
		expect(neu.slice(0, vor.length)).toEqual(vor);
		expect(neu).toHaveLength(vor.length + 1);
		const hinweis = neu[vor.length];
		expect(hinweis).toMatch(/^Ehegatte und Verwandte des Beklagten in gerader Linie/);
		expect(hinweis).toMatch(/weder für eine eigene Wohnung noch als Vertretung anderer/);
		// Sinngemäss und nicht entschieden (Fachprüfung 27.09.2026, A1-2).
		expect(hinweis).toMatch(/ZGB Art\. 68, der hier sinngemäss gilt \(BGer 5A_198\/2014 E\. 5\.4; BGE 134 III 481 E\. 3\.8\)/);
		expect(hinweis).toMatch(/für die Ausschlussklage entschieden hat es kein Gericht/);
		expect(hinweis).toMatch(/Geschwister, Schwiegereltern und Lebenspartner ohne Ehe stimmen normal mit/);
		expect(hinweis).toMatch(/erklärt für diese Angehörigen den Ausstand/);
		// Auch die Miteigentümerin der Wohnung des Beklagten (Fachprüfung Runde 4, A1-R4-1).
		expect(hinweis).toMatch(/die selbst Eigentümer sind, stimmen ebenfalls nicht mit, weder für eine eigene Wohnung noch als Vertretung anderer, auch wenn ihnen nur die Wohnung des Beklagten mitgehört/);
		// Rechtzeitig, damit Vollmachten umgelenkt werden können (Laienprüfung Runde 3, A1-R3-3; Runde 4, A1-R4-2).
		expect(hinweis).toMatch(/Wer einlädt, klärt das möglichst schon mit der Einladung/);
		// Die Brücke zum Lehrstreit über die Zählbasis weiter oben (Runde 3, A1-R3-1; Runde 4, A1-R4-1).
		expect(hinweis).toMatch(/Der Satz oben «wer diese Mehrheit erreicht, genügt beiden Lesarten» gilt hier nur, wenn die Angehörigen mit eigener Wohnung mitgezählt werden/);
		expect(hinweis).toMatch(/etwa Eltern, Kinder, Grosseltern oder Enkel/);
		// Wer ihnen eine Vollmacht gibt, erfährt die Folge (Laienprüfung Runde 2, A1-3).
		expect(hinweis).toMatch(/wer ihnen eine Vollmacht gibt, zählt bei dieser Abstimmung sonst wie ein Abwesender/);
		// Die Bezugsgrösse: Votum zählt milder als der Wortlaut, mit Zahlen (Fachprüfung, A1-1).
		expect(hinweis).toMatch(/nimmt Art\. 649b Abs\. 2 aber nur den Beklagten/);
		expect(hinweis).toMatch(/Sicher ist die Ermächtigung also nur, wenn die Ja-Stimmen auch mit ihnen reichen/);
		expect(hinweis).toMatch(/verlangt dieses Werkzeug fünf Ja von neun, sicher ist die Ermächtigung erst mit sechs von zehn/);
	});
});

/*
 * **Dach und Fassade über dem eigenen Sondernutzungsbereich** (Produktentscheid
 * 27.09.2026, `quellen/themen/stockwerkeigentum/fragen.md`, «Offen»). Eingefügt
 * in die erste Bedingung der Karte und in die Hilfe zu `f1-4`; sonst bleibt
 * alles, auch die Flächenregel und die Ausnahme für das Sondernutzungsrecht
 * eines anderen.
 */
const VOR04 = holeRegelwerk('2026-10-03');
const NEU04 = holeRegelwerk('2026-10-04');

describe('Die Fassung 2026-10-04 gegenüber 2026-10-03', () => {
	const karte = (rw: Regelwerk) => rw.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!;
	const frage = (rw: Regelwerk) => rw.fragen.find((f) => f.id === 'f1-4')!;
	const erste = (rw: Regelwerk) => karte(rw).hinweise!.find((h) => h.startsWith('Erste Bedingung:'))!;

	it('ändert nur die erste Bedingung und den Kostenhinweis einer Karte und die Hilfe einer Frage', () => {
		expect(NEU04.knoten.map((k) => k.id)).toEqual(VOR04.knoten.map((k) => k.id));
		for (const k of NEU04.knoten) {
			const vor = VOR04.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-baulich-luxurioes-ausweg') {
				const { hinweise: _h1, ...rest } = k;
				const { hinweise: _h2, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Hinweise geändert`).toEqual(restVor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		// Nur die erste Bedingung und der Kostenhinweis zur Sondernutzungsfläche, die übrigen
		// Hinweise wörtlich und in derselben Reihenfolge.
		const vorH = karte(VOR04).hinweise!;
		const neuH = karte(NEU04).hinweise!;
		expect(neuH).toHaveLength(vorH.length);
		neuH.forEach((h, i) => {
			if (h.startsWith('Erste Bedingung:')) return;
			if (vorH[i].startsWith('Steht die Anlage auf einer Fläche mit Sondernutzungsrecht und')) {
				// Die Markise hängt darüber, nicht darauf (Codeprüfung 27.09.2026, Niedrig 1), und
				// an der Fassade kommt die Montage bei Fassadenarbeiten dazu (Fachprüfung Runde 8).
				expect(h).toMatch(/^Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt darüber, etwa an der Fassade, und bleibt sie dem Berechtigten vorbehalten, braucht es weder Ausschluss noch Einkauf/);
				expect(h).toMatch(/über der Fläche verliert niemand eine Nutzung \(Wermelinger, SVIT-Kommentar 2023, Art\. 712a Rz\. 143, 144\)/);
				// Nicht nur an der Fassade: auch über der Abdichtung einer Dachterrasse (Fachprüfung Runde 9).
				expect(h).toMatch(/auch Ab- und Wiedermontage, wenn die Gemeinschaft am Bauteil darunter oder dahinter arbeitet/);
				expect(h).toMatch(/\(Art\. 712a Rz\. 182; Art\. 712h Rz\. 110, 111\)\.$/);
				return;
			}
			expect(h).toBe(vorH[i]);
		});
		expect(NEU04.fragen.filter((f) => f.id !== 'f1-4')).toEqual(VOR04.fragen.filter((f) => f.id !== 'f1-4'));
		const { hilfe: _hq1, ...restFrage } = frage(NEU04);
		const { hilfe: _hq2, ...restFrageVor } = frage(VOR04);
		expect(restFrage).toEqual(restFrageVor);
		const { fassung: _f1, quellen: _q1, knoten: _k1, fragen: _r1, freigabevermerk: _v1, ...restNeu } = NEU04;
		const { fassung: _f2, quellen: _q2, knoten: _k2, fragen: _r2, freigabevermerk: _v2, ...restVor } = VOR04;
		expect(restNeu).toEqual(restVor);
		expect(NEU04.freigabevermerk.startsWith(VOR04.freigabevermerk)).toBe(true);
		expect(NEU04.quellen.slice(0, VOR04.quellen.length)).toEqual(VOR04.quellen);
		expect(NEU04.quellen).toHaveLength(VOR04.quellen.length + 1);
		expect(pruefeRegelwerk(NEU04)).toEqual([]);
	});

	it('fügt die Ausnahme ein und lässt den Rest der ersten Bedingung stehen', () => {
		const vor = erste(VOR04);
		const neu = erste(NEU04);
		const anker = 'als eigenen Antrag.';
		const [kopfVor, fussVor] = vor.split(anker);
		expect(neu.startsWith(kopfVor + anker)).toBe(true);
		// Der Folgesatz schliesst Aussehen und andere Wohnungen ausdrücklich ein (Laienprüfung Runde 3 und 4).
		expect(fussVor).toMatch(/^ Bleibt bei einer anderen Beeinträchtigung Zweifel,/);
		expect(neu.endsWith(fussVor.replace('Bleibt bei einer anderen Beeinträchtigung Zweifel,', 'Bleibt beim Aussehen, bei einer anderen Wohnung oder bei einer anderen Beeinträchtigung Zweifel,'))).toBe(true);
		// Nur über dem eigenen Sondernutzungsbereich, nicht Dach und Fassade allgemein (Produktentscheid).
		expect(neu).toMatch(/Ausgenommen ist auch ein Teil von Dach oder Fassade direkt über dem Sitzplatz oder Garten des Bauherrn, also über einer Fläche, an der er selbst ein Sondernutzungsrecht hat/);
		expect(neu).toMatch(/Dach und Fassade im Übrigen gehören nicht dazu, auch keine gemeinsame Dachterrasse/);
		expect(neu).toMatch(/Art\. 712a Rz\. 143, 144/);
		// Keine Einzelzustimmung, aber ein Beschluss (Laienprüfung Runde 2, C1-2).
		expect(neu).toMatch(/Die Zustimmung eines einzelnen Eigentümers braucht es für diese Fläche nicht; beschliessen muss die Versammlung trotzdem/);
		// Das Aussehen bleibt offen, die Fundstellen sagen, wofür sie stehen (Fachprüfung C1-1, C1-R2-1).
		expect(neu).toMatch(/ob das Aussehen allein genügt, ist nicht geklärt \(Rz\. 129, dort zu Art\. 647d Abs\. 2; Rz\. 141, dort zu Baurechten im Reglement\)/);
		expect(neu).toMatch(/Dass man die Anlage sieht, etwa eine Markise in Farbe und Art der übrigen, begründet noch keinen Zweifel/);
		// Sonderrecht ist bewusst nicht erfasst (Rückfrage an das Haus, Fachprüfung Runde 1, C1-2).
		// «Sondernutzungsrecht» enthält die Zeichenfolge nicht; jede Form von «Sonderrecht» wäre neu.
		expect(neu).not.toMatch(/Sonderrecht/);
		expect(frage(NEU04).hilfe!).not.toMatch(/Sonderrecht/);
	});

	it('fügt dieselbe Ausnahme in die Hilfe ein, unter «Mehr dazu», mit der Antwort bei Zweifel', () => {
		const vor = frage(VOR04).hilfe!;
		const neu = frage(NEU04).hilfe!;
		const anker = 'Stimmt er nicht zu, wählen Sie «Ja, oder es ist unklar».';
		const [kopfVor, fussVor] = vor.split(anker);
		expect(neu.startsWith(kopfVor + anker)).toBe(true);
		expect(neu.endsWith(fussVor)).toBe(true);
		expect(neu).toMatch(/Ausgenommen ist auch ein Teil von Dach oder Fassade direkt über dem Sitzplatz oder Garten des Bauherrn/);
		expect(neu).toMatch(/wählen Sie «Ja, oder es ist unklar»; ob das Aussehen allein genügt, ist nicht geklärt/);
		// Der sichtbare Anfang vor «Mehr dazu» bleibt Wort für Wort.
		expect(teileHilfe(neu).anfang).toBe(teileHilfe(vor).anfang);
		const ja = frage(NEU04).antworten.find((a) => a.id === 'f1-4-ja')!;
		expect(neu).toContain(`«${ja.text}»`);
	});
});

/*
 * **Auch der Balkon im Sonderrecht** (Produktentscheid 27.09.2026 auf die
 * Rückfrage der Fachprüfung, C1-2). Drei Wortlaute werden ersetzt, sonst bleibt
 * alles; der Rest der ersten Bedingung, des Kostenhinweises und der Hilfe
 * steht wörtlich.
 */
const VOR05 = holeRegelwerk('2026-10-04');
const NEU05 = holeRegelwerk('2026-10-05');

describe('Die Fassung 2026-10-05 gegenüber 2026-10-04', () => {
	const karte = (rw: Regelwerk) => rw.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!;
	const frage = (rw: Regelwerk) => rw.fragen.find((f) => f.id === 'f1-4')!;
	const ERSETZT: [string, string][] = [
		[
			'direkt über dem Sitzplatz oder Garten des Bauherrn, also über einer Fläche, an der er selbst ein Sondernutzungsrecht hat, etwa seine Markise über diesem Sitzplatz.',
			'direkt über einem Sitzplatz oder Garten, an dem der Bauherr ein Sondernutzungsrecht hat, oder über seinem Balkon oder seiner Loggia, wenn sie ihm im Sonderrecht gehören oder er daran ein Sondernutzungsrecht hat, etwa seine Markise darüber; was gilt, steht im Begründungsakt, im Aufteilungsplan, im Reglement oder als Dienstbarkeit im Grundbuch (zum Balkon im Sonderrecht Wermelinger, SVIT-Kommentar 2023, Art. 712b Rz. 66 bis 68, 113). Dasselbe gilt für eine Markise an der Unterseite des Balkons darüber oder an der Decke der Loggia: Die äussere Seite eines Balkons ist gemeinschaftlich wie die Fassade, die Decke trägt das Gebäude und ist deshalb ebenfalls gemeinschaftlich (Art. 712b Abs. 2 Ziff. 2; Rz. 70, 154, 168).'
		],
		[
			'eine Markise, die an einem fremden Balkon hängt, kann die anderen Eigentümer dauernd beeinträchtigen;',
			'eine Markise, die an der Innenseite eines fremden Balkons befestigt ist oder in ihn hineinragt, kann die anderen Eigentümer dauernd beeinträchtigen;'
		],
		[
			'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt darüber, etwa an der Fassade, und bleibt sie dem Berechtigten vorbehalten,',
			'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht oder direkt über einer solchen Fläche oder über einem Balkon oder einer Loggia im Sonderrecht, etwa an der Fassade, und bleibt sie dem Berechtigten vorbehalten,'
		],
		[
			'wenn die Gemeinschaft am Bauteil darunter oder dahinter arbeitet,',
			'wenn die Anlage für Arbeiten der Gemeinschaft weichen muss,'
		]
	];

	it('ersetzt nur die genannten Wortlaute der Karte und der Hilfe', () => {
		expect(NEU05.knoten.map((k) => k.id)).toEqual(VOR05.knoten.map((k) => k.id));
		for (const k of NEU05.knoten) {
			const vor = VOR05.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-baulich-luxurioes-ausweg') {
				const { hinweise: _h1, ...rest } = k;
				const { hinweise: _h2, ...restVor } = vor;
				expect(rest, `${k.id}: mehr als die Hinweise geändert`).toEqual(restVor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
		// Jeder Hinweis ist entweder wörtlich gleich oder genau um einen der zwei Wortlaute ersetzt.
		const vorH = karte(VOR05).hinweise!;
		const neuH = karte(NEU05).hinweise!;
		expect(neuH).toHaveLength(vorH.length);
		let ersetzt = 0;
		neuH.forEach((h, i) => {
			let erwartet = vorH[i];
			for (const [alt, neu] of ERSETZT) {
				if (erwartet.includes(alt)) {
					ersetzt += 1;
					erwartet = erwartet.replace(alt, neu);
				}
			}
			expect(h).toBe(erwartet);
		});
		expect(ersetzt).toBe(ERSETZT.length);
		expect(NEU05.fragen.filter((f) => f.id !== 'f1-4')).toEqual(VOR05.fragen.filter((f) => f.id !== 'f1-4'));
		const { hilfe: _hq1, ...restFrage } = frage(NEU05);
		const { hilfe: _hq2, ...restFrageVor } = frage(VOR05);
		expect(restFrage).toEqual(restFrageVor);
		expect(frage(NEU05).hilfe).toBe(
			frage(VOR05).hilfe!
				.replace(
					'direkt über dem Sitzplatz oder Garten des Bauherrn, also über einer Fläche, an der er selbst ein Sondernutzungsrecht hat, etwa seine Markise darüber,',
					'direkt über einem Sitzplatz oder Garten, an dem der Bauherr ein Sondernutzungsrecht hat, oder über seinem Balkon oder seiner Loggia, wenn sie ihm im Sonderrecht gehören oder er daran ein Sondernutzungsrecht hat, etwa seine Markise darüber, auch an der Unterseite des Balkons darüber oder an der Decke der Loggia,'
				)
				.replace(
					'an einer anderen Wohnung, etwa an einem fremden Balkon, jemanden dauernd beeinträchtigt,',
					'an einer anderen Wohnung, etwa an der Innenseite eines fremden Balkons, jemanden dauernd beeinträchtigt,'
				)
		);
		const { fassung: _f1, quellen: _q1, knoten: _k1, fragen: _r1, freigabevermerk: _v1, ...restNeu } = NEU05;
		const { fassung: _f2, quellen: _q2, knoten: _k2, fragen: _r2, freigabevermerk: _v2, ...restVor } = VOR05;
		expect(restNeu).toEqual(restVor);
		expect(NEU05.freigabevermerk.startsWith(VOR05.freigabevermerk)).toBe(true);
		expect(NEU05.quellen.slice(0, VOR05.quellen.length)).toEqual(VOR05.quellen);
		expect(NEU05.quellen).toHaveLength(VOR05.quellen.length + 1);
		expect(pruefeRegelwerk(NEU05)).toEqual([]);
	});

	it('begrenzt das Sonderrecht auf Balkon und Loggia, und «Mehr dazu» trennt wie vorher', () => {
		const alles = karte(NEU05).hinweise!.join(' ');
		const hilfe = frage(NEU05).hilfe!;
		// Garten und Sitzplatz stehen nie im Sonderrecht, der Boden ist zwingend gemeinschaftlich
		// (Art. 712b Abs. 2 Ziff. 1; Fachprüfung Runde 11, Befund 1).
		for (const text of [alles, hilfe]) {
			expect(text).toMatch(/über einem Sitzplatz oder Garten, an dem der Bauherr ein Sondernutzungsrecht hat, oder über seinem Balkon oder seiner Loggia, wenn sie ihm im Sonderrecht gehören/);
			// Die Markise unter dem Balkon darüber (Laienprüfung Runde 11, C1-1).
			expect(text).toMatch(/Unterseite des Balkons darüber/);
		}
		expect(alles).toMatch(/was gilt, steht im Begründungsakt, im Aufteilungsplan, im Reglement oder als Dienstbarkeit im Grundbuch/);
		// Der fremde Balkon meint die Innenseite, nicht die Unterseite darüber (Runde 12).
		for (const text of [alles, hilfe]) {
			expect(text).not.toMatch(/an einem fremden Balkon/);
			expect(text).toMatch(/Innenseite eines fremden Balkons/);
		}
		// Jede Lage der Anlage zum Bauteil, auch unter einer sanierten Balkonplatte (Laienprüfung Runde 13).
		expect(alles).toMatch(/auch Ab- und Wiedermontage, wenn die Anlage für Arbeiten der Gemeinschaft weichen muss/);
		expect(alles).toMatch(/Dach und Fassade im Übrigen gehören nicht dazu/);
		expect(teileHilfe(hilfe).anfang).toBe(teileHilfe(frage(VOR05).hilfe!).anfang);
	});

});

/*
 * **Reglementsklauseln einordnen, Gehör des Beklagten** (Produktentscheide
 * 27.09.2026). Zwei Karten ändern sich, jede in genau einem Feld: das Verhalten
 * der gewöhnlichen Reglementsänderung und ein angehängter Hinweis an der
 * Ausschlussklage. Alles andere steht wörtlich.
 */
const VOR06 = holeRegelwerk('2026-10-05');
const NEU06 = holeRegelwerk('2026-10-06');

describe('Die Fassung 2026-10-06 gegenüber 2026-10-05', () => {
	it('ändert nur das Verhalten der Reglementsänderung und hängt an der Ausschlussklage an', () => {
		expect(NEU06.knoten.map((k) => k.id)).toEqual(VOR06.knoten.map((k) => k.id));
		expect(NEU06.fragen).toEqual(VOR06.fragen);
		for (const k of NEU06.knoten) {
			const vor = VOR06.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-reglement-normal') {
				expect(vor.reglementsverhalten).toBe('nur_mildern');
				expect(k.reglementsverhalten).toBe('einordnen');
				expect({ ...k, reglementsverhalten: vor.reglementsverhalten }).toEqual(vor);
			} else if (k.id === 'k-ausschlussklage') {
				const vorH = vor.hinweise ?? [];
				// Angehängt, nicht ersetzt: Die sechs bisherigen stehen wörtlich vorne.
				expect(vorH).toHaveLength(6);
				expect(k.hinweise!.slice(0, vorH.length)).toEqual(vorH);
				expect(k.hinweise).toHaveLength(vorH.length + 1);
				expect(k.hinweise!.at(-1)).toMatch(/muss zur Versammlung eingeladen sein/);
				expect(k.hinweise!.at(-1)).toMatch(/5A_198\/2014 E\. 5\.3\.2 bis 5\.4/);
				expect({ ...k, hinweise: vorH }).toEqual(vor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
	});

	/*
	 * **Die drei Fälle am Gesetz der Reglementsänderung** (Art. 712g Abs. 3:
	 * mehr als die Hälfte der Anwesenden nach Köpfen, zugleich mehr als die
	 * Hälfte aller Wertquoten). Gegenprobe ist jeweils die Vorfassung.
	 */
	function vorbehalt(rw: Regelwerk, regelTeil: {
		kopfSchwelle: { zaehler: number; nenner: number; art: 'mehr_als' | 'mindestens' };
		quotenSchwelle: { zaehler: number; nenner: number; art: 'mehr_als' | 'mindestens' } | null;
		quotenbasis: 'keine' | 'alle_quoten' | 'anwesend_vertreten';
	}) {
		const knoten = rw.knoten.find((k) => k.id === 'k-reglement-normal')!;
		const erfordernis = erfordernisAusKnoten(rw, knoten);
		return wendeReglementAn(erfordernis, [
			{
				id: 'r1',
				stwegId: 's1',
				geschaeftsart: 'reglement' as const,
				kopfbasis: 'anwesend_vertreten' as Kopfbasis,
				fundstelle: 'Reglement Ziff. 1',
				enthaltungZaehltMit: true,
				...regelTeil
			}
		], null, LESARTEN_VORGABE).vorbehalt;
	}
	const HAELFTE = { zaehler: 1, nenner: 2, art: 'mehr_als' as const };
	const ZWEIDRITTEL = { zaehler: 2, nenner: 3, art: 'mindestens' as const };

	it('wendet eine in jeder Hinsicht strengere Regel an', () => {
		const strenger = { kopfSchwelle: ZWEIDRITTEL, quotenSchwelle: HAELFTE, quotenbasis: 'alle_quoten' as const };
		expect(vorbehalt(NEU06, strenger)).toBeNull();
		// Gegenprobe: Die Vorfassung wies sie ab.
		expect(vorbehalt(VOR06, strenger)).toBe('verschaerfung');
	});

	it('wendet eine in jeder Hinsicht mildere Regel an, wie bisher', () => {
		const milder = { kopfSchwelle: HAELFTE, quotenSchwelle: null, quotenbasis: 'keine' as const };
		expect(vorbehalt(NEU06, milder)).toBeNull();
		expect(vorbehalt(VOR06, milder)).toBeNull();
	});

	it('rechnet bei einer gemischten Regel nach Gesetz und sagt warum', () => {
		// Bei den Köpfen strenger, aber ohne die Wertquoten des Gesetzes.
		const gemischt = { kopfSchwelle: ZWEIDRITTEL, quotenSchwelle: null, quotenbasis: 'keine' as const };
		expect(vorbehalt(NEU06, gemischt)).toBe('gemischt');
		// Die Vorfassung hielt sie für strenger und wies sie deshalb ab.
		expect(vorbehalt(VOR06, gemischt)).toBe('verschaerfung');
	});
});

const VOR07 = holeRegelwerk('2026-10-06');
const NEU07 = holeRegelwerk('2026-10-07');

/**
 * Die Fassung 2026-10-07 setzt zwei Punkte der Anwaltsfragen um: den
 * berichtigten Kartentext zur Prozessführungs-Ermächtigung (C-1) und den
 * Entscheid vom 28.09.2026 zur Ausschlussklage (A-4). Der zweite ist der
 * erste Knoten nach `k-reglement-normal`, der vom Verhalten `einordnen`
 * Gebrauch macht; die Proben messen deshalb zugleich, dass der Rechenkern
 * dafür keine Änderung brauchte.
 */
describe('Die Fassung 2026-10-07 gegenüber 2026-10-06', () => {
	it('berichtigt den Text der Prozessführung und ordnet die Ausschlussklage ein', () => {
		expect(NEU07.knoten.map((k) => k.id)).toEqual(VOR07.knoten.map((k) => k.id));
		expect(NEU07.fragen).toEqual(VOR07.fragen);
		for (const k of NEU07.knoten) {
			const vor = VOR07.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-prozessfuehrung') {
				// Der alte Satz las sich, als sei auch das vereinfachte Verfahren
				// von der Ermächtigung ausgenommen.
				expect(vor.begruendung).toMatch(/vereinfachtes, rasches Gerichtsverfahren/);
				expect(k.begruendung).not.toMatch(/vereinfachtes, rasches/);
				expect(k.begruendung).toMatch(/Betreibung, die Rechtsöffnung und die vorläufige Eintragung/);
				expect(k.begruendung).toMatch(/Schlichtungsgesuch und die Klage/);
				expect(k.begruendung).toMatch(/im Voraus erteilt werden/);
				expect({ ...k, begruendung: vor.begruendung }).toEqual(vor);
			} else if (k.id === 'k-ausschlussklage') {
				const vorH = vor.hinweise ?? [];
				expect(vor.reglementsverhalten).toBe('gesperrt_reglement');
				expect(k.reglementsverhalten).toBe('einordnen');
				/*
				 * **Genau ein Hinweis ersetzt, einer angehängt** (Codeprüfung
				 * 28.09.2026, N-1). Der zur Verschärfbarkeit schloss mit «klären
				 * Sie ihre Geltung vor der Versammlung», was nicht mehr stimmt,
				 * seit Votum die Klausel anwendet. Ersetzt wird über den
				 * Wortanfang; fände der nichts, liefe die Fassung still mit dem
				 * alten Satz. Deshalb zuerst: Es gibt ihn genau einmal.
				 */
				const alt = vorH.findIndex((h) => h.startsWith(VERSCHAERFUNG_ALT_ANFANG));
				expect(vorH.filter((h) => h.startsWith(VERSCHAERFUNG_ALT_ANFANG))).toHaveLength(1);
				expect(vorH[alt]).toMatch(/klären Sie ihre Geltung vor der Versammlung/);
				expect(k.hinweise).toHaveLength(vorH.length + 1);
				expect(k.hinweise![alt]).toBe(KLAUSEL_BEI_AUSSCHLUSSKLAGE);
				expect(k.hinweise!.slice(0, vorH.length).filter((_, i) => i !== alt)).toEqual(
					vorH.filter((_, i) => i !== alt)
				);
				expect(k.hinweise!.at(-1)).toBe(QUOTE_BEKLAGTER);
				expect(k.hinweise!.at(-1)).toMatch(/Rz\. 191 ad Art\. 712m/);
				// M-3: Im Nenner bleibt die Quote nur unter «aller Wertquoten».
				expect(k.hinweise!.at(-1)).toMatch(/Mehrheit aller Wertquoten/);
				expect(k.hinweise!.at(-1)).toMatch(/anwesenden und vertretenen Wertquoten, rechnet/);
				expect({ ...k, hinweise: vorH, reglementsverhalten: 'gesperrt_reglement' }).toEqual(vor);
			} else {
				expect(k, `${k.id} wurde angefasst, obwohl die Fassung das nicht vorsieht`).toEqual(vor);
			}
		}
	});

	/**
	 * Eine hinterlegte Regel zur Ausschlussklage. Die Bezugsgrösse des Gesetzes
	 * ist `alle_ausser_betroffene` (ZGB Art. 649b Abs. 2); nur eine Regel mit
	 * derselben Basis lässt sich damit vergleichen.
	 */
	function vorbehalt(
		rw: Regelwerk,
		regelTeil: {
			kopfbasis: Kopfbasis;
			kopfSchwelle: { zaehler: number; nenner: number; art: 'mehr_als' | 'mindestens' };
			enthaltungZaehltMit?: boolean;
		}
	) {
		return angewandt(rw, regelTeil).vorbehalt;
	}

	function angewandt(
		rw: Regelwerk,
		regelTeil: {
			kopfbasis: Kopfbasis;
			kopfSchwelle: { zaehler: number; nenner: number; art: 'mehr_als' | 'mindestens' };
			enthaltungZaehltMit?: boolean;
		}
	) {
		const knoten = rw.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const erfordernis = erfordernisAusKnoten(rw, knoten);
		return wendeReglementAn(erfordernis, [
			{
				id: 'r1',
				stwegId: 's1',
				geschaeftsart: 'sonderfall' as const,
				fundstelle: 'Reglement Ziff. 9',
				quotenbasis: 'keine' as const,
				quotenSchwelle: null,
				enthaltungZaehltMit: true,
				...regelTeil
			}
		], null, LESARTEN_VORGABE);
	}

	it('wendet eine strengere Klausel an, weil die Bezugsgrösse dieselbe bleibt', () => {
		const strenger = {
			kopfbasis: 'alle_ausser_betroffene' as const,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const }
		};
		expect(vorbehalt(NEU07, strenger)).toBeNull();
		// Bis 2026-10-06 war die Karte gesperrt: Die Klausel wurde nicht angewandt.
		expect(vorbehalt(VOR07, strenger)).toBe('reglementsschranke');
	});

	it('wendet eine mildere Klausel an', () => {
		const milder = {
			kopfbasis: 'alle_ausser_betroffene' as const,
			kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mehr_als' as const }
		};
		expect(vorbehalt(NEU07, milder)).toBeNull();
		expect(vorbehalt(VOR07, milder)).toBe('reglementsschranke');
	});

	/*
	 * **Die Formularvorgabe und «alle Eigentümer»** (Produktentscheid
	 * 29.09.2026, Rückfrage M-4). Bis dahin landeten beide in `gemischt`, weil
	 * `KOPFRANG` die Basis des Gesetzes nicht kannte, und der Entscheid A-4
	 * griff praktisch nie: Kaum ein Reglement schreibt «mit Ausnahme des
	 * Beklagten».
	 */
	it('wendet die Mehrheit der Anwesenden als mildere Klausel an, ohne den Beklagten', () => {
		const anwesende = {
			kopfbasis: 'anwesend_vertreten' as const,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const }
		};
		const a = angewandt(NEU07, anwesende);
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.kopfbasis).toBe('anwesend_vertreten');
		// Der Ausschluss des Beklagten hängt am Knoten, nicht an der Basis.
		expect(a.erfordernis.knotenId).toBe('k-ausschlussklage');
		expect(a.lesart).toBeUndefined();
		expect(vorbehalt(VOR07, anwesende)).toBe('reglementsschranke');

		// Der Bezugsgrössensatz der Karte sagt, dass der Beklagte fehlt
		// (Codeprüfung M-1); ohne das Erfordernis bliebe es der allgemeine Satz.
		const knoten = NEU07.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const karte = karteMitReglement(ergebniskarte(NEU07, knoten), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(karte.bezugsgroessensatz).toMatch(/ohne den Beklagten, der nicht mitstimmt/);
	});

	it('liest «alle Eigentümer» als alle ohne den Beklagten und sagt das auf der Karte', () => {
		const alle = {
			kopfbasis: 'alle_eigentuemer' as const,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const }
		};
		const a = angewandt(NEU07, alle);
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.kopfbasis).toBe('alle_ausser_betroffene');
		expect(a.regel!.kopfbasis).toBe('alle_ausser_betroffene');
		expect(a.lesart).toMatch(/als alle Eigentümer ohne den Beklagten/);

		const knoten = NEU07.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const karte = karteMitReglement(
			ergebniskarte(NEU07, knoten),
			a.regel,
			a.vorbehalt,
			null,
			null,
			a.lesart,
			a.erfordernis
		);
		expect(karte.reglementsvorbehalt).toMatch(/als alle Eigentümer ohne den Beklagten/);
		expect(karte.formel).toMatch(/ausser den unmittelbar Betroffenen/);
		// Die Erklärung darunter nennt den Beklagten, wie der Bezugsgrössensatz
		// (Codeprüfung 30.09.2026, M1). Die Formel bleibt allgemein: `regelInWorten`
		// kennt den Knoten nicht und gilt für jede Regel mit dieser Bezugsgrösse;
		// gedruckt wird über `erfordernisInWorten`, das «ohne den Beklagten» sagt.
		expect(karte.bezugsgroesse).toMatch(/Hier zählen alle Eigentümer ohne den Beklagten/);
		expect(karte.bezugsgroessensatz).toMatch(/alle Eigentümer ohne den Beklagten/);

		// Zwei Drittel aller: gleiche Basis, strengerer Bruch, also angewandt.
		expect(vorbehalt(NEU07, { ...alle, kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } })).toBeNull();
	});

	it('rechnet bei einer gemischten Klausel nach dem Gesetz und nennt sie', () => {
		// Andere Bezugsgrösse: Die Anwesenden sind milder, zwei Drittel strenger.
		const andereBasis = {
			kopfbasis: 'anwesend_vertreten' as const,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const }
		};
		expect(vorbehalt(NEU07, andereBasis)).toBe('gemischt');
		expect(vorbehalt(VOR07, andereBasis)).toBe('reglementsschranke');

		/*
		 * **Und ein echter Mischfall mit gleicher Kopfbasis** (Codeprüfung
		 * 28.09.2026, M-4). Die Basis ist dieselbe, der Bruch strenger, aber
		 * Enthaltungen zählen nicht mit: in einer Hinsicht strenger, in einer
		 * milder. Ohne diese Probe wäre `gemischt` hier nur über die Basis
		 * erreicht worden.
		 */
		const gleicheBasis = {
			kopfbasis: 'alle_ausser_betroffene' as const,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const },
			enthaltungZaehltMit: false
		};
		expect(vorbehalt(NEU07, gleicheBasis)).toBe('gemischt');
		// Dasselbe mit «alle Eigentümer»: nach der Umdeutung dieselbe Lage.
		expect(vorbehalt(NEU07, { ...gleicheBasis, kopfbasis: 'alle_eigentuemer' })).toBe('gemischt');
	});

	it('vergleicht «alle ohne die Betroffenen» anderswo weiter nicht mit den Anwesenden', () => {
		/*
		 * Die Rangfolge der Ausschlussklage gilt nur dort. An der
		 * Reglementsänderung zählen Betroffene unter «den Anwesenden» mit; ob
		 * «alle ohne sie» strenger ist, hängt davon ab, wer erscheint.
		 */
		const knoten = NEU07.knoten.find((k) => k.id === 'k-reglement-normal')!;
		const { vorbehalt: v } = wendeReglementAn(erfordernisAusKnoten(NEU07, knoten), [
			{
				id: 'r1',
				stwegId: 's1',
				geschaeftsart: knoten.geschaeftsart,
				fundstelle: 'Reglement Ziff. 9',
				kopfbasis: 'alle_ausser_betroffene',
				kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenbasis: 'alle_quoten',
				quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				enthaltungZaehltMit: true
			}
		], null, LESARTEN_VORGABE);
		expect(v).toBe('gemischt');
	});
});

/*
 * **Die Fassung 2026-10-08: Die Karte erklärt die angewandte Regel**
 * (Produktentscheid 29.09.2026, `docs/freigabe.md`). Unter einer angewandten
 * Regel ersetzt ein Satz zur Regel die Begründung, und was nur das Gesetz
 * erklärt, steht im Abschnitt «Zum gesetzlichen Erfordernis». Ohne Regel und
 * unter einer nicht angewandten bleibt jede Karte, wie sie war.
 */
const NEU08 = holeRegelwerk('2026-10-08');

/**
 * Die Karten, an denen eine hinterlegte Regel angewandt werden kann, **in der
 * aktuellen Fassung**, nicht in 2026-10-08 (Codeprüfung 29.09.2026, N-2). Eine
 * spätere Fassung, die eine Karte oder einen Hinweis dazubringt, soll hier
 * rot werden, damit jemand entscheidet, ob der Hinweis unter einer Regel zum
 * Gesetz gehört.
 */
const AKTUELL = holeRegelwerk();
const MIT_REGEL = AKTUELL.knoten.filter(
	(k) =>
		k.typ !== 'grenzfall' &&
		k.typ !== 'keine_abstimmung' &&
		!k.reglementsverhalten?.startsWith('gesperrt')
);

/** Eine Regel, die an diesem Knoten angewandt wird: das Gesetz, als Regel hinterlegt. */
function regelWieGesetz(rw: Regelwerk, id: string, teil: Record<string, unknown> = {}) {
	const knoten = rw.knoten.find((k) => k.id === id)!;
	const erfordernis = erfordernisAusKnoten(rw, knoten);
	return {
		knoten,
		erfordernis,
		regel: {
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart,
			fundstelle: 'Reglement Ziff. 11',
			kopfbasis: erfordernis.kopfbasis,
			kopfSchwelle: erfordernis.kopfSchwelle ?? { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
			quotenbasis: erfordernis.quotenbasis,
			quotenSchwelle: erfordernis.quotenSchwelle,
			enthaltungZaehltMit: erfordernis.enthaltungZaehltMit ?? true,
			...teil
		}
	};
}

function karteUnter(rw: Regelwerk, id: string, teil: Record<string, unknown> = {}) {
	const { knoten, erfordernis, regel } = regelWieGesetz(rw, id, teil);
	const a = wendeReglementAn(erfordernis, [regel as Parameters<typeof wendeReglementAn>[1][number]], null, LESARTEN_VORGABE);
	const gesetzlich = ergebniskarte(rw, knoten);
	return {
		knoten,
		a,
		gesetzlich,
		karte: karteMitReglement(gesetzlich, a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis)
	};
}

describe('Die Fassung 2026-10-08 gegenüber 2026-10-07', () => {
	it('ändert an keinem Knoten etwas ausser den Hinweisen unter einer Regel', () => {
		expect(pruefeRegelwerk(NEU08)).toEqual([]);
		expect(NEU08.aeste).toEqual(NEU07.aeste);
		expect(NEU08.fragen).toEqual(NEU07.fragen);
		expect(NEU08.knoten.map(({ hinweiseUnterRegel: _, ...k }) => k)).toEqual(NEU07.knoten);
		expect(NEU08.knoten.filter((k) => k.hinweiseUnterRegel).map((k) => k.id)).toEqual([
			'k-bewirtschaftung-waehlen',
			'k-prozessfuehrung',
			'k-ausschlussklage',
			'k-zustaendigkeit-gewoehnlich'
		]);
	});

	it('hat alle zweiundzwanzig Karten eingeordnet, an denen eine Regel angewandt werden kann', () => {
		// Kommt eine weitere dazu, gehört sie eingeordnet wie diese; die
		// Probe sagt es, statt dass die Karte still das Gesetz erklärt. Seit der
		// Fassung 2026-10-15 sechs mehr (`vereinbart` und der Ausweg mit
		// `nur_mildern`, Produktentscheid 07.10.2026 nach Fachprüfung), seit
		// 2026-10-20 die Einsprache (`nur_verschaerfen`), seit 2026-10-24 die Wahl
		// mit erweiterten Kompetenzen (Lesart L4), seit 2026-10-27 die Übertragung
		// anderer Aufgaben an einen Ausschuss oder Delegierten (C2b), seit
		// 2026-11-18 das Errichten des Erneuerungsfonds und die beiden Karten zur
		// Einlage über Grenze oder Höhe im Reglement.
		expect(MIT_REGEL.map((k) => k.id)).toEqual([
			'k-baulich-notwendig',
			'k-baulich-nuetzlich',
			'k-baulich-luxurioes-ausweg',
			'k-bewirtschaftung-waehlen',
			'k-bewirtschaftung-waehlen-erweitert',
			'k-bewirtschaftung-erweitert',
			'k-organ-waehlen',
			'k-uebertragung-beschluss',
			'k-hausordnung',
			'k-reglement-normal',
			'k-nutzungsrecht-zuteilung',
			'k-jahresrechnung',
			'k-erneuerungsfonds-errichten',
			'k-erneuerungsfonds',
			'k-erneuerungsfonds-ueber-reglement',
			'k-erneuerungsfonds-grenze-in-der-regel',
			'k-decharge',
			'k-prozessfuehrung',
			'k-benutzungsweise',
			'k-zweckbestimmung',
			'k-verwaltung-gewoehnlich',
			'k-verwaltung-wichtig',
			'k-ausschlussklage',
			'k-zustaendigkeit-gewoehnlich',
			'k-einsprache'
		]);
		// Die aktuelle Fassung ist in sich stimmig, auch die Wortlaute unter
		// `hinweiseUnterRegel` (Codeprüfung 29.09.2026, Runde 2, M-A).
		expect(pruefeRegelwerk(AKTUELL)).toEqual([]);
	});

	it('kennt jeden Hinweis dieser Karten oder hat ihn eingeordnet', () => {
		/*
		 * **Wortlaute, nicht Zahlen** (Codeprüfung Runde 2, M-A). Eine Zählung
		 * bliebe grün, wenn eine spätere Fassung einen Hinweis durch einen
		 * ersetzt, der das Gesetz erklärt. Bekannt sind die Hinweise, die mit
		 * 2026-10-08 geprüft und eingeordnet wurden. Ein neuer Wortlaut muss in
		 * der neuen Fassung unter `hinweiseUnterRegel` stehen, oder die Probe
		 * nimmt ihn nach einem Entscheid hier als unter jeder Regel gültig auf.
		 */
		const bekannt = new Map(NEU08.knoten.map((k) => [k.id, new Set(k.hinweise ?? [])]));
		/*
		 * **Nach einem Entscheid aufgenommen** (07.10.2026, Fassung 2026-10-15):
		 * Die beiden Hinweise zu Art. 647d Abs. 2 und 3 an der nützlichen
		 * Massnahme sind jünger als 2026-10-08 und gelten unter jeder Regel
		 * («gelten trotz jeder Klausel», Fachprüfung 07.10.2026; Rz. 53 ad
		 * Art. 712g). Sie bleiben deshalb unter einer angewandten Regel stehen.
		 */
		const nuetzlich = AKTUELL.knoten.find((k) => k.id === 'k-baulich-nuetzlich')!;
		for (const h of nuetzlich.hinweise ?? []) {
			if (/647d Abs\. [23]\)/.test(h)) bekannt.get(nuetzlich.id)!.add(h);
		}
		/*
		 * **Die Hinweise am Ausweg ab 2026-10-17** sind dieselben Aussagen, neu
		 * gegliedert (Rückmeldung des Auftraggebers 08.10.2026). Sie betreffen
		 * die drei Bedingungen, Kosten und Anfechtung, und die gelten auch unter
		 * einer milderen Regel (Rechtssatz ab 2026-10-16: «Die drei Bedingungen
		 * gelten ausdrücklich nach Rz. 136»).
		 */
		for (const h of AUSWEG_HINWEISE) bekannt.get('k-baulich-luxurioes-ausweg')!.add(h);
		/*
		 * **Die Hinweise der Einsprache ab 2026-10-20** gelten unter jeder Regel:
		 * Frist, Einladung, wichtiger Grund, wer nicht mitstimmt, und Form. Keiner
		 * erklärt das gesetzliche Mehr; angewandt wird dort ohnehin nur eine
		 * strengere Regel (`nur_verschaerfen`).
		 */
		bekannt.set(EINSPRACHE.id, new Set(EINSPRACHE.hinweise ?? []));
		/*
		 * **Die Wahl ohne erweiterte Kompetenzen ab 2026-10-24** trägt den Satz
		 * zur Erweiterung (`ERWEITERUNG` der Fassung 2026-10-23, dort schon der
		 * Ersatz unter einer Regel) und den Verweis auf die Karte mit Lesart. Beide
		 * gelten unter jeder Regel.
		 */
		bekannt.get('k-bewirtschaftung-waehlen')!.add(HINWEIS_GEWOEHNLICH_2026_10_24);
		/*
		 * **Die Verweise ab 2026-10-27** (Entscheiden statt der Versammlung) zeigen
		 * auf eine andere Karte und erklären nicht das Mehr dieser Karte; sie
		 * gelten unter jeder Regel. Die Einstimmigkeit, auf die zwei davon
		 * zeigen, kann eine Regel ohnehin nicht mildern (`gesperrt_zwingend`).
		 */
		bekannt.get('k-bewirtschaftung-erweitert')!.add(HINWEIS_STATT_2026_10_27);
		bekannt.get('k-bewirtschaftung-erweitert')!.add(HINWEIS_ALLTAG_2026_10_27);
		bekannt.get('k-bewirtschaftung-erweitert')!.add(DELEGATION_GESPERRT_2026_10_27);
		bekannt.get('k-organ-waehlen')!.add(HINWEIS_ORGAN_2026_10_27);
		bekannt.set(UEBERTRAGUNG_BESCHLUSS_2026_10_27.id, new Set(UEBERTRAGUNG_BESCHLUSS_2026_10_27.hinweise ?? []));
		/*
		 * **Der Hauswart am Ausschuss ab 2026-10-30** (A4, Punkt 5): Der neue
		 * Satz gilt unter jeder Regel. Die Anfechtung an der Zuständigkeitsordnung
		 * und an der Wahl mit erweiterten Kompetenzen hängt an der Lesart und ist
		 * über `hinweiseUnterRegel` eingeordnet, gehört also nicht hierher
		 * (Codeprüfung Prüfschritt A4, N2).
		 */
		const hauswart = AKTUELL.knoten.find((k) => k.id === 'k-uebertragung-beschluss')!.hinweise?.find((h) => h.includes('Hauswart'));
		expect(hauswart).toBeDefined();
		bekannt.set('k-uebertragung-beschluss', new Set([...(bekannt.get('k-uebertragung-beschluss') ?? []), hauswart!]));
		/*
		 * **Wer bei der Ausschlussklage klagt, ab 2026-11-03** (F1, Frage 3):
		 * Kläger, Antrag, Kosten und die Grenze bei Nutzniessern gelten unter
		 * jeder Regel; sie sagen nichts über das Mehr. Ebenso die Abgrenzung an
		 * der Prozessführung, die unter einer Regel neben
		 * `ERMAECHTIGUNG_UNTER_REGEL` sichtbar bleiben soll.
		 */
		for (const h of [KLAEGER_2026_11_03, KOSTEN_2026_11_03, GRENZE_2026_11_03]) bekannt.get('k-ausschlussklage')!.add(h);
		bekannt.get('k-prozessfuehrung')!.add(ABGRENZUNG_2026_11_03);
		/*
		 * **Fundstellen statt «offen», ab 2026-11-04** (F4a): Der Beschluss vor
		 * der Klage (S2), wer betroffen ist (S4, in `KLAEGER`) und die
		 * Vollmachten des Betroffenen an der Einsprache (S5) gelten unter jeder
		 * Regel; keiner erklärt das gesetzliche Mehr. Der Satz zum einfachen Mehr
		 * an der Übertragung (S7) und der zum Mehr der Erweiterung samt Rz. 115
		 * ad Art. 712m (S8: «dieses Mehr», «Danach rechnet Votum»; Runde 3, T4)
		 * erklären es und stehen deshalb unter `hinweiseUnterRegel` mit
		 * `zumGesetz`, nicht hier.
		 */
		bekannt.get('k-ausschlussklage')!.add(ERMAECHTIGUNG_VORHER_2026_11_04);
		bekannt.get('k-ausschlussklage')!.add(KLAEGER_2026_11_04);
		bekannt.get(EINSPRACHE.id)!.add(EINSPRACHE_BETROFFENE_2026_11_04);
		/*
		 * **Prozess gegen einen Eigentümer, ab 2026-11-10** (E1, Fachprüfung L11,
		 * F-3): Ausstand, Einladung und Anhörung gelten unter jeder Regel; der
		 * Hinweis sagt nichts über das Mehr.
		 */
		bekannt.get('k-prozessfuehrung')!.add(GEGEN_EIGENTUEMER_2026_11_10);
		// Ab der Fassung 2026-11-15 mit dem Satz zur Beratung der Angehörigen (Entscheid 0047, 4).
		bekannt.get('k-prozessfuehrung')!.add(nachDieserFassung_2026_11_15(GEGEN_EIGENTUEMER_2026_11_10));
		/*
		 * **Erneuerungsfonds ab 2026-11-18:** Am Errichten gelten erste Einlage,
		 * Inhalt des Beschlusses, Reglement, Delegation und Entnahme unter jeder
		 * Regel; Streit, sicherer Weg und knapper Ausgang erklären das gesetzliche
		 * Mehr und stehen unter `hinweiseUnterRegel`. An der Einlage gelten der
		 * Verweis auf die Frage zum Reglement und die Entnahme unter jeder Regel;
		 * die Entnahme ist ein eigener Beschluss, über dessen Mehr die Regel der
		 * Einlage nichts sagt. An den beiden Karten zur Grenze gelten die Hinweise
		 * zu Höhe, Grenze, Mindesteinlage, Fundstellen, Dauer, Begründung und
		 * Entnahme unter jeder Regel; die übrigen stehen unter `hinweiseUnterRegel`.
		 */
		bekannt.set(
			FONDS_ERRICHTEN_2026_11_18,
			new Set([
				ERRICHTEN_ERSTE_EINLAGE_2026_11_18,
				ERRICHTEN_INHALT_2026_11_18,
				ERRICHTEN_REGLEMENT_2026_11_18,
				ERRICHTEN_KEINE_DELEGATION_2026_11_18,
				ENTNAHME_2026_11_18
			])
		);
		bekannt.get('k-erneuerungsfonds')!.add(EINLAGE_VORAUSSETZUNG_2026_11_18);
		bekannt.get('k-erneuerungsfonds')!.add(ENTNAHME_2026_11_18);
		/*
		 * **Einzeln genannt, nicht «alle Hinweise der Karte»** (Codeprüfung
		 * 15.11.2026, M2): Mit allen Hinweisen der Karte selbst wäre die Probe
		 * blind gewesen. Anfechtung, Vollmacht, knapper Ausgang und Milderung
		 * setzen das gesetzliche Mehr voraus und stehen unter `hinweiseUnterRegel`.
		 */
		bekannt.set(
			FONDS_UEBER_2026_11_18,
			new Set([UEBER_HOEHE_2026_11_18, UEBER_GRENZE_2026_11_18, UEBER_MINDEST_2026_11_18, UEBER_FUNDSTELLEN_2026_11_18, UEBER_DAUER_2026_11_18, ENTNAHME_2026_11_18])
		);
		bekannt.set(
			FONDS_IN_DER_REGEL_2026_11_18,
			new Set([IN_DER_REGEL_EHER_2026_11_18, IN_DER_REGEL_GRUND_2026_11_18, UEBER_DAUER_2026_11_18, ENTNAHME_2026_11_18])
		);
		const erweitert = AKTUELL.knoten.find((k) => k.id === 'k-bewirtschaftung-erweitert')!;
		expect(erweitert.hinweiseUnterRegel ?? []).toContainEqual({ hinweis: DELEGATION_RZ_115_2026_11_04, zumGesetz: true });
		expect(bekannt.get('k-bewirtschaftung-erweitert')?.has(DELEGATION_RZ_115_2026_11_04)).toBe(false);
		for (const k of MIT_REGEL) {
			for (const h of k.hinweise ?? []) {
				const eingeordnet = (k.hinweiseUnterRegel ?? []).some((u) => u.hinweis === h);
				expect(bekannt.get(k.id)?.has(h) || eingeordnet, `${k.id}: «${h.slice(0, 60)}…»`).toBe(true);
			}
		}
	});

	it('erklärt unter einer angewandten Regel an jeder dieser Karten die Regel', () => {
		for (const k of MIT_REGEL) {
			// An der Zweckbestimmung nur eine Regel für genau diesen Fall
			// (Fassung 2026-10-15, Vorbehalt `nur_fallgenau`), ebenso an der
			// Einsprache (2026-10-20).
			const { a, karte } = karteUnter(AKTUELL, k.id, regelNurFallgenau(k) ? { knotenId: k.id } : {});
			expect(a.vorbehalt, k.id).toBeNull();

			expect(karte.begruendung, k.id).not.toBe(k.begruendung);
			expect(karte.begruendung, k.id).toMatch(/^Dieses Mehr stammt aus der Bestimmung Ihres Reglements/);
			expect(karte.begruendung, k.id).toMatch(/\(Reglement Ziff\. 11\), nicht aus dem Gesetz/);
			expect(karte.zumGesetz?.begruendung, k.id).toBe(k.begruendung);
			expect(karte.zumGesetz?.einleitung, k.id).toMatch(/gilt nicht für das Ergebnis oben/);

			const unterRegel = k.hinweiseUnterRegel ?? [];
			const finde = (h: string) => unterRegel.find((x) => x.hinweis === h);
			expect(karte.zumGesetz?.hinweise, k.id).toEqual(
				(k.hinweise ?? []).flatMap((h) => {
					const ziel = finde(h)?.zumGesetz;
					return ziel === undefined ? [] : [ziel === true ? h : ziel];
				})
			);
			// Kein Hinweis zum Gesetz bleibt bei den übrigen, und keiner geht verloren.
			const erwartet = (k.hinweise ?? []).flatMap((h) => {
				const u = finde(h);
				return u === undefined ? [h] : u.ersatz === undefined ? [] : [u.ersatz];
			});
			expect(karte.hinweise, k.id).toEqual(erwartet);
		}
	});

	it('lässt ohne Regel jede Karte, wie sie war (Gegenprobe)', () => {
		// Gegen 2026-10-07 gemessen, also an den Knoten von 2026-10-08.
		const ids = new Set(MIT_REGEL.map((x) => x.id));
		for (const k of NEU08.knoten.filter((x) => ids.has(x.id))) {
			const gesetzlich = ergebniskarte(NEU08, k);
			const karte = karteMitReglement(gesetzlich, null, null, null, null);
			expect(karte.zumGesetz, k.id).toBeNull();
			expect(karte.begruendung, k.id).toBe(k.begruendung);
			expect(karte.hinweise, k.id).toEqual(k.hinweise ?? []);
			// Und dieselbe Karte wie unter 2026-10-07, bis auf den Fassungsvermerk.
			const alt = ergebniskarte(NEU07, NEU07.knoten.find((x) => x.id === k.id)!);
			expect({ ...gesetzlich, hinweiseUnterRegel: [], freigabevermerk: '' }).toEqual({
				...alt,
				freigabevermerk: ''
			});
		}
	});

	it('lässt die Karte unter einer Regel, die nicht angewandt wird, wie sie war (Gegenprobe)', () => {
		// Andere Bezugsgrösse und strengerer Bruch: gemischt, also nach dem Gesetz.
		const { a, gesetzlich, karte } = karteUnter(NEU08, 'k-ausschlussklage', {
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
		});
		expect(a.vorbehalt).toBe('gemischt');
		expect(karte.zumGesetz).toBeNull();
		expect(karte.begruendung).toBe(gesetzlich.begruendung);
		expect(karte.hinweise).toEqual(gesetzlich.hinweise);
		expect(karte.hinweise).toContain(KLAUSEL_BEI_AUSSCHLUSSKLAGE);
	});

	it('nimmt an der Ausschlussklage unter einer Klausel der Anwesenden das Gesetz aus der Erklärung', () => {
		const { karte } = karteUnter(NEU08, 'k-ausschlussklage', {
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		});
		// Der Anlass (Laienprüfung 29.09.2026, C1; Codeprüfung N-1).
		expect(karte.begruendung).not.toMatch(/Wortlaut-Lesart/);
		const beachten = karte.hinweise.join(' ');
		expect(beachten).not.toMatch(/unabhängig davon, wie viele erschienen sind/);
		expect(beachten).not.toMatch(/fünf Ja von neun/);
		expect(beachten).not.toMatch(/Dieses Werkzeug rechnet über alle/);
		expect(beachten).not.toMatch(/gilt nicht, was diese Karte sonst über das Rechnen über alle sagt/);
		expect(beachten).not.toMatch(/Der Satz oben/);
		// Was unter der Regel gilt, bleibt: Gericht, Gehör, Quote, Angehörige, Klausel.
		expect(beachten).toMatch(/Der Ausschluss selbst spricht das Gericht aus/);
		expect(beachten).toMatch(/muss zur Versammlung eingeladen sein/);
		expect(karte.hinweise).toContain(QUOTE_BEKLAGTER);
		// Sicher ist die Mehrheit über alle, mit allen Angehörigen (Fachprüfung G5).
		expect(beachten).toMatch(/die Angehörigen mit eigener Wohnung mitgezählt, ob sie erschienen sind oder nicht/);
		expect(beachten).toMatch(/Sofort sicher ist die Ermächtigung nur, wenn sie beide Mehrheiten erreicht/);
		// Der Weg über die Anfechtungsfrist (Fachprüfung G4; Rz. 219a, Rz. 230),
		// mit Fristbeginn und den richtigen Klägern (Runde 2, K4 und K5).
		expect(beachten).toMatch(/reichen Schlichtungsgesuch und Klage am sichersten erst einige Wochen nach Ablauf der Frist ein, wenn die Bewirtschaftung bestätigt, dass keine Vorladung/);
		expect(beachten).toMatch(/Stellen Sie das Protokoll deshalb rasch und nachweisbar allen zu/);
		// Was unter jeder Regel gilt, bleibt, obwohl die Begründung wandert (G1).
		expect(karteUnter(NEU08, 'k-prozessfuehrung').karte.hinweise.join(' ')).toMatch(
			/für jeden anderen Prozess, den jemand gegen die Gemeinschaft anhebt, etwa die Anfechtung eines Beschlusses/
		);
		expect(karteUnter(NEU08, 'k-zustaendigkeit-gewoehnlich').karte.hinweise.join(' ')).toMatch(
			/dringliche Massnahmen selbst zu treffen; das lässt sich nicht anders ordnen/
		);
		// Und das einfache Mehr der Wahl widerspricht einer Wahlklausel nicht mehr (G7).
		const wahl = karteUnter(NEU08, 'k-bewirtschaftung-waehlen').karte;
		expect(wahl.hinweise.join(' ')).not.toMatch(/Die Wahl selbst bleibt/);
		expect(wahl.zumGesetz!.hinweise.join(' ')).toMatch(/Die Wahl selbst bleibt nach Gesetz beim einfachen Mehr/);
		// Und das Gesetz steht vollständig im eigenen Abschnitt.
		expect(karte.zumGesetz!.begruendung).toMatch(/folgt der strengeren Wortlaut-Lesart/);
		expect(karte.zumGesetz!.hinweise.join(' ')).toMatch(/unabhängig davon, wie viele erschienen sind/);
		expect(karte.zumGesetz!.hinweise.join(' ')).toMatch(/Die Zählbasis ist umstritten/);
		expect(karte.zumGesetz!.hinweise).toHaveLength(3);
	});

	it('nimmt unter einer Regel in einer Fassung vor 2026-10-08 nur die Begründung heraus', () => {
		// Die Fassung trägt keine Einordnung der Hinweise, also bleiben sie.
		const { karte, gesetzlich } = karteUnter(NEU07, 'k-ausschlussklage', {
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
		});
		expect(karte.zumGesetz).toMatchObject({ begruendung: gesetzlich.begruendung, hinweise: [] });
		expect(karte.hinweise).toEqual(gesetzlich.hinweise);
	});

	it('meldet eine Einordnung, die ins Leere zeigt oder an einem gesperrten Knoten steht (Gegenprobe)', () => {
		const leer: Regelwerk = {
			...NEU08,
			knoten: NEU08.knoten.map((k) =>
				k.id === 'k-prozessfuehrung'
					? { ...k, hinweiseUnterRegel: [{ hinweis: 'Das Mehr war einmal umstritten.', zumGesetz: true }] }
					: k
			)
		};
		expect(pruefeRegelwerk(leer).join('\n')).toMatch(/k-prozessfuehrung.*einen Hinweis, den er nicht trägt/);

		const gesperrt: Regelwerk = {
			...NEU08,
			knoten: NEU08.knoten.map((k) =>
				k.id === 'k-prozessfuehrung' ? { ...k, reglementsverhalten: 'gesperrt_zwingend' } : k
			)
		};
		expect(pruefeRegelwerk(gesperrt).join('\n')).toMatch(/k-prozessfuehrung.*wendet aber keine an/);
	});
});

/**
 * **Die Fassung 2026-10-09: die Karte zur Kenntnisnahme nennt beide
 * Ausnahmen** (Block 4b der Universalversammlung; Codeprüfung Block 3, N-3).
 * Ganzes Paar verglichen, freigestellt allein die Hinweise dieser Karte. Die
 * Gegenprobe steht in der Vorfassung: dort der alte Wortlaut.
 */
const VOR09 = holeRegelwerk('2026-10-08');
const NEU09 = holeRegelwerk('2026-10-09');

describe('Die Fassung 2026-10-09 gegenüber 2026-10-08', () => {
	it('ändert allein die Hinweise der Karte zur Kenntnisnahme', () => {
		expect(pruefeRegelwerk(NEU09)).toEqual([]);
		expect(NEU09.aeste).toEqual(VOR09.aeste);
		expect(NEU09.fragen).toEqual(VOR09.fragen);
		expect(NEU09.knoten.map((k) => k.id)).toEqual(VOR09.knoten.map((k) => k.id));
		// Das ganze Paar, nicht nur Äste, Fragen und Knoten (Codeprüfung 4b, M-1).
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU09;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR09;
		expect(restNeu).toEqual(restVor);
		expect(NEU09.freigabevermerk.startsWith(VOR09.freigabevermerk)).toBe(true);
		expect(NEU09.quellen.slice(0, VOR09.quellen.length)).toEqual(VOR09.quellen);
		expect(NEU09.quellen).toHaveLength(VOR09.quellen.length + 2);
		for (const k of NEU09.knoten) {
			const vor = VOR09.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-kenntnisnahme') {
				expect({ ...k, hinweise: vor.hinweise }).toEqual(vor);
			} else {
				expect(k).toEqual(vor);
			}
		}
	});

	it('nennt beide Ausnahmen und nicht mehr «hält praktisch»', () => {
		const vor = VOR09.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise ?? [];
		const neu = NEU09.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise ?? [];
		expect(vor.join(' ')).toMatch(/nur einen Beschluss, wenn das Reglement es ausdrücklich zulässt/);
		expect(vor.join(' ')).toMatch(/hält ein solcher Beschluss praktisch/);
		// Aus zwei werden vier, der Grundsatz zuerst, die Anfechtung zuletzt.
		expect(vor).toHaveLength(2);
		expect(neu).toHaveLength(4);
		expect(neu[0]).toMatch(/^Wird während der Behandlung doch ein Antrag in der Sache gestellt/);
		expect(neu[3]).toMatch(/beim Gericht, in der Regel mit einem Schlichtungsgesuch/);
		expect(neu.join(' ')).not.toMatch(/hält ein solcher Beschluss praktisch/);
		expect(neu.join(' ')).toMatch(/Eine Nein-Stimme ist kein Widerspruch/);
		expect(neu.join(' ')).toMatch(/innert eines Monats/);
		expect(neu.join(' ')).toMatch(/Anträge zum Ablauf/);
		expect(neu.join(' ')).toMatch(/Ausnahmen gibt es zwei: Das Reglement gestattet es ausdrücklich, oder die Versammlung tagt als Universalversammlung/);
		expect(neu.join(' ')).toMatch(/Alle Eigentümer sind persönlich da/);
		expect(neu.join(' ')).toMatch(/Rz\. 38 und 39 ad Art\. 712n/);
		// Keine Aussage über das Werkzeug: Der Export nimmt die Karte wörtlich.
		expect(neu.join(' ')).not.toMatch(/Votum|dieses Werkzeug/i);
	});
});

describe('Die Fassung 2026-10-09 wirft beim Laden, wenn die Vorfassung nicht passt', () => {
	// Gegenprobe zum Ersatz über den Wortanfang (Codeprüfung 4b, N-4): Ein
	// umformulierter alter Hinweis liesse sonst still den alten Satz stehen.
	const vor = VOR09.knoten.find((k) => k.id === 'k-kenntnisnahme')!;
	it('ersetzt an der Vorfassung genau die beiden alten Hinweise', () => {
		expect(kenntnisnahme(vor).hinweise).toEqual(
			NEU09.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise
		);
	});
	it('wirft, wenn ein alter Hinweis fehlt oder doppelt steht', () => {
		const [erster, zweiter] = vor.hinweise!;
		expect(() => kenntnisnahme({ ...vor, hinweise: [erster] })).toThrow(/2026-10-09/);
		expect(() => kenntnisnahme({ ...vor, hinweise: [erster, erster, zweiter] })).toThrow(/2026-10-09/);
		expect(() => kenntnisnahme({ ...vor, hinweise: [`Umformuliert: ${erster}`, zweiter] })).toThrow(
			/2026-10-09/
		);
	});
});

/**
 * **Die Fassung 2026-10-10: der Hinweis zur Universalversammlung sagt, wo die
 * Antwort steht** (Nachtrag zu Frage 54 in `quellen`, Produktentscheid
 * 29.09.2026). Ganzes Paar verglichen, freigestellt allein die Hinweise dieser
 * Karte, und von ihnen allein der dritte.
 */
const VOR10 = holeRegelwerk('2026-10-09');
const NEU10 = holeRegelwerk('2026-10-10');

describe('Die Fassung 2026-10-10 gegenüber 2026-10-09', () => {
	it('ändert allein den Hinweis zur Universalversammlung auf der Karte zur Kenntnisnahme', () => {
		expect(pruefeRegelwerk(NEU10)).toEqual([]);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU10;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR10;
		expect(restNeu).toEqual(restVor);
		expect(NEU10.freigabevermerk.startsWith(VOR10.freigabevermerk)).toBe(true);
		expect(NEU10.freigabevermerk.length).toBeGreaterThan(VOR10.freigabevermerk.length);
		expect(NEU10.quellen.slice(0, VOR10.quellen.length)).toEqual(VOR10.quellen);
		expect(NEU10.quellen).toHaveLength(VOR10.quellen.length + 2);
		expect(NEU10.knoten.map((k) => k.id)).toEqual(VOR10.knoten.map((k) => k.id));
		for (const k of NEU10.knoten) {
			const vor = VOR10.knoten.find((x) => x.id === k.id)!;
			if (k.id !== 'k-kenntnisnahme') {
				expect(k).toEqual(vor);
				continue;
			}
			expect({ ...k, hinweise: vor.hinweise }).toEqual(vor);
			// Von den vier Hinweisen ändert allein der dritte.
			expect(k.hinweise).toHaveLength(4);
			expect(vor.hinweise).toHaveLength(4);
			k.hinweise!.forEach((h, i) => (i === 2 ? expect(h).not.toBe(vor.hinweise![i]) : expect(h).toBe(vor.hinweise![i])));
		}
	});

	it('rät nicht mehr pauschal zum Traktandieren, sondern nennt Rz. 19, 24, Reglement und Vollmacht', () => {
		const vor = VOR10.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		const neu = NEU10.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		// Gegenprobe: die Vorfassung trägt den alten Rat.
		expect(vor).toMatch(/ist jemand nur vertreten, traktandieren Sie die Sache besser/);
		expect(vor).toMatch(/ist nur einer da, gilt dasselbe/);
		expect(neu).not.toMatch(/traktandieren Sie die Sache besser|gilt dasselbe|persönlich da/);
		expect(neu).toMatch(/eine ausdrückliche Vollmacht der übrigen braucht sie dafür nicht \(Rz\. 19 und 24 ad Art\. 712o\)/);
		expect(neu).toMatch(/Schliesst Ihr Reglement Vertretene aus, zählen sie nicht/);
		expect(neu).toMatch(/Vollmacht auch Geschäfte deckt, die nicht angekündigt waren/);
		expect(neu).toMatch(/\(OR Art\. 33 Abs\. 2; SVIT-Kommentar Rz\. 26 und 27 ad Art\. 712m\)/);
		// Kein pauschaler Rat mehr, aber der Auffangfall (Laienprüfung Runde 1, 1A).
		expect(neu).toMatch(/Im Zweifel traktandieren Sie die Sache\./);
		expect(neu).toMatch(/Eine Nein-Stimme ist kein Widerspruch/);
		// Keine Aussage über das Werkzeug: Der Export nimmt die Karte wörtlich.
		expect(neu).not.toMatch(/Votum|dieses Werkzeug|Einstellung/i);
	});
});

describe('Die Fassung 2026-10-10 wirft beim Laden, wenn die Vorfassung nicht passt', () => {
	const vor = VOR10.knoten.find((k) => k.id === 'k-kenntnisnahme')!;
	it('ersetzt an der Vorfassung genau den alten Hinweis', () => {
		expect(kenntnisnahmeUniversal(vor).hinweise).toEqual(
			NEU10.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise
		);
	});
	it('wirft, wenn der alte Hinweis fehlt, doppelt steht oder umformuliert ist', () => {
		const h = vor.hinweise!;
		expect(() => kenntnisnahmeUniversal({ ...vor, hinweise: [h[0], h[1], h[3]] })).toThrow(/2026-10-10/);
		expect(() => kenntnisnahmeUniversal({ ...vor, hinweise: [...h, h[2]] })).toThrow(/2026-10-10/);
		expect(() =>
			kenntnisnahmeUniversal({ ...vor, hinweise: [h[0], h[1], `Umformuliert: ${h[2]}`, h[3]] })
		).toThrow(/2026-10-10/);
	});
});

/**
 * **Die Fassung 2026-10-11: drei Kartenbefunde aus der Fachprüfung der
 * Website-FAQ** (30.09.2026). Ganzes Paar verglichen, freigestellt allein die
 * Hinweise der Karten zur Kenntnisnahme und zur Ausschlussklage.
 */
const VOR11 = holeRegelwerk('2026-10-10');
const NEU11 = holeRegelwerk('2026-10-11');

describe('Die Fassung 2026-10-11 gegenüber 2026-10-10', () => {
	it('ändert allein Hinweise an den Karten zur Kenntnisnahme und zur Ausschlussklage', () => {
		expect(pruefeRegelwerk(NEU11)).toEqual([]);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU11;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR11;
		expect(restNeu).toEqual(restVor);
		expect(NEU11.freigabevermerk.startsWith(VOR11.freigabevermerk)).toBe(true);
		expect(NEU11.quellen.slice(0, VOR11.quellen.length)).toEqual(VOR11.quellen);
		expect(NEU11.quellen).toHaveLength(VOR11.quellen.length + 2);
		expect(NEU11.knoten.map((k) => k.id)).toEqual(VOR11.knoten.map((k) => k.id));
		for (const k of NEU11.knoten) {
			const vor = VOR11.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-kenntnisnahme') {
				expect({ ...k, hinweise: vor.hinweise }).toEqual(vor);
				// Von den vier Hinweisen ändert allein der dritte.
				k.hinweise!.forEach((h, i) =>
					i === 2 ? expect(h).not.toBe(vor.hinweise![i]) : expect(h).toBe(vor.hinweise![i])
				);
			} else if (k.id === 'k-ausschlussklage') {
				expect({ ...k, hinweise: vor.hinweise, hinweiseUnterRegel: vor.hinweiseUnterRegel }).toEqual(vor);
				expect(k.hinweise).toHaveLength(vor.hinweise!.length + 1);
				expect(k.hinweiseUnterRegel).toHaveLength(vor.hinweiseUnterRegel!.length + 1);
			} else {
				expect(k).toEqual(vor);
			}
		}
	});

	it('Befund 1: eine Person stimmt für die ganze Wohnung; die Universalversammlung als Lesart mit sicherem Weg', () => {
		const vor = VOR11.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		const neu = NEU11.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		// Gegenprobe: die Vorfassung trägt die Überdehnung.
		expect(vor).toMatch(/genügt nach dem SVIT-Kommentar eine anwesende Person/);
		expect(neu).not.toMatch(/genügt nach dem SVIT-Kommentar/);
		expect(neu).toContain(KENNTNISNAHME_NEU);
		// Fachprüfung Runde 2, B1: die Hauslesart als solche, der sichere Weg dazu.
		expect(KENNTNISNAHME_NEU).toMatch(/nach unserer Lesart ja\. Sicher ist die Universalversammlung, wenn alle Eigentümer der Wohnung da sind\./);
		// Der Rest des Hinweises bleibt, wie er war.
		expect(neu.replace(/Gehört eine Wohnung mehreren.*?da sind\./, '')).toBe(
			vor.replace(/Gehört eine Wohnung mehreren.*?712o\)\./, '')
		);
		expect(neu).not.toMatch(/Votum|dieses Werkzeug|Einstellung/i);
	});

	it('Befund 2: zwei Eigentümer klagen direkt, bei dreien nennt die Karte beide Lesarten', () => {
		const vor = VOR11.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const neu = NEU11.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		expect(vor.hinweise!.some((h) => h.startsWith('In kleinen Gemeinschaften'))).toBe(true);
		expect(neu.hinweise!.some((h) => h.startsWith('In kleinen Gemeinschaften'))).toBe(false);
		expect(neu.hinweise).toContain(KLEINE_GEMEINSCHAFTEN);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Bei zwei Eigentümern braucht es keinen Beschluss/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/\(Art\. 712a Rz\. 214, mit Piccinin\)/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Sicher ist die Ermächtigung dort also, wenn beide zustimmen/);
		// Fachprüfung 30.09.2026, F2-1: wenn einer der beiden nicht mitstimmen darf.
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/ist diese Zustimmung nicht zu erreichen\. Dann bleibt die direkte Klage/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/der beiden Eigentümer ausser dem Beklagten/);
		// Unter einer Regel wandert er weiter zum Gesetz, wie der alte.
		expect(neu.hinweiseUnterRegel!.find((u) => u.hinweis === KLEINE_GEMEINSCHAFTEN)?.zumGesetz).toBe(true);
	});

	it('Befund 3: die gemeinsame Wohnung des Beklagten, hinter dem Hinweis zu den Angehörigen', () => {
		const neu = NEU11.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const i = neu.hinweise!.findIndex((h) => h.startsWith('Ehegatte und Verwandte des Beklagten'));
		expect(neu.hinweise![i + 1]).toBe(GEMEINSAME_WOHNUNG);
		expect(GEMEINSAME_WOHNUNG).toMatch(/braucht es dann sechs Ja von zehn/);
		expect(GEMEINSAME_WOHNUNG).toMatch(/Richtet er sich gegen alle Eigentümer der Wohnung, fällt sie aus der Zahl, und es braucht fünf Ja von neun/);
		expect(GEMEINSAME_WOHNUNG).toMatch(/SVIT-Kommentar Rz\. 23 ad Art\. 712o\)/);
		// Werkzeugsätze nur in der Anwendung; die Website bekommt eine eigene
		// Fassung (Fachprüfung Runde 2, B4), mit demselben Anfang.
		expect(GEMEINSAME_WOHNUNG).toMatch(/Dieses Werkzeug zählt die Wohnung selbst mit/);
		expect(GEMEINSAME_WOHNUNG_WEBSITE).not.toMatch(/Werkzeug|Jetzt möglich|Betroffene/);
		const gemeinsam = 'und richten Sie den Antrag danach.';
		expect(GEMEINSAME_WOHNUNG.split(gemeinsam)[0]).toBe(GEMEINSAME_WOHNUNG_WEBSITE.split(gemeinsam)[0]);
		expect(neu.hinweiseUnterRegel!.find((u) => u.hinweis === GEMEINSAME_WOHNUNG)?.ersatz).toBe(
			GEMEINSAME_WOHNUNG_UNTER_REGEL
		);
		// Gegenprobe: Die Vorfassung sagt nichts dazu.
		const vor = VOR11.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		expect(vor.hinweise!.some((h) => h.includes('Rz. 23 ad Art. 712o'))).toBe(false);
	});
});

describe('Die Fassung 2026-10-11 wirft beim Laden, wenn die Vorfassung nicht passt', () => {
	const kenntnis = VOR11.knoten.find((k) => k.id === 'k-kenntnisnahme')!;
	const klage = VOR11.knoten.find((k) => k.id === 'k-ausschlussklage')!;
	it('baut aus der Vorfassung genau die neuen Karten', () => {
		expect(kenntnisnahme1011(kenntnis)).toEqual(NEU11.knoten.find((k) => k.id === 'k-kenntnisnahme'));
		expect(ausschlussklage1011(klage)).toEqual(NEU11.knoten.find((k) => k.id === 'k-ausschlussklage'));
	});
	it('wirft, wenn ein zu ersetzender Satz fehlt oder doppelt steht', () => {
		const h = kenntnis.hinweise!;
		expect(() => kenntnisnahme1011({ ...kenntnis, hinweise: [h[0], h[1], h[3]] })).toThrow(/2026-10-11/);
		expect(() => kenntnisnahme1011({ ...kenntnis, hinweise: [...h, h[2]] })).toThrow(/2026-10-11/);
		const k = klage.hinweise!;
		const ohneKlein = k.filter((x) => !x.startsWith('In kleinen Gemeinschaften'));
		expect(() => ausschlussklage1011({ ...klage, hinweise: ohneKlein, hinweiseUnterRegel: [] })).toThrow(
			/2026-10-11/
		);
		const ohneAngehoerige = k.filter((x) => !x.startsWith('Ehegatte und Verwandte'));
		expect(() => ausschlussklage1011({ ...klage, hinweise: ohneAngehoerige })).toThrow(/2026-10-11/);
	});
});

/**
 * **Die Fassung 2026-10-12: Universalversammlung bei gemeinsamem Eigentum und
 * die Angehörigen an der Ausschlussklage** (30.09.2026). Ganzes Paar
 * verglichen, freigestellt allein je ein Hinweis der Karten zur Kenntnisnahme
 * und zur Ausschlussklage.
 */
const VOR12 = holeRegelwerk('2026-10-11');
const NEU12 = holeRegelwerk('2026-10-12');

describe('Die Fassung 2026-10-12 gegenüber 2026-10-11', () => {
	it('ändert allein je einen Hinweis an den Karten zur Kenntnisnahme und zur Ausschlussklage', () => {
		expect(pruefeRegelwerk(NEU12)).toEqual([]);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU12;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR12;
		expect(restNeu).toEqual(restVor);
		expect(NEU12.freigabevermerk.startsWith(VOR12.freigabevermerk)).toBe(true);
		expect(NEU12.quellen.slice(0, VOR12.quellen.length)).toEqual(VOR12.quellen);
		expect(NEU12.quellen).toHaveLength(VOR12.quellen.length + 1);
		expect(NEU12.knoten.map((k) => k.id)).toEqual(VOR12.knoten.map((k) => k.id));
		for (const k of NEU12.knoten) {
			const vor = VOR12.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-kenntnisnahme' || k.id === 'k-ausschlussklage') {
				expect({ ...k, hinweise: vor.hinweise, hinweiseUnterRegel: vor.hinweiseUnterRegel }).toEqual(vor);
				expect(k.hinweise).toHaveLength(vor.hinweise!.length);
				// Genau ein Hinweis ändert sich.
				expect(k.hinweise!.filter((h, i) => h !== vor.hinweise![i])).toHaveLength(1);
			} else {
				expect(k).toEqual(vor);
			}
		}
	});

	it('Befund 1: an der Universalversammlung alle Eigentümer der Wohnung, als sichere Lesart', () => {
		const vor = VOR12.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		const neu = NEU12.knoten.find((k) => k.id === 'k-kenntnisnahme')!.hinweise![2];
		// Gegenprobe: Die Vorfassung liess eine Person genügen.
		expect(vor).toMatch(/nach unserer Lesart ja\./);
		expect(neu).toContain(KENNTNISNAHME_1012);
		expect(KENNTNISNAHME_1012).toMatch(/Für die Universalversammlung genügt das nach unserer Lesart nicht/);
		expect(KENNTNISNAHME_1012).toMatch(/Wörtlich sagt der Kommentar das für gemeinsames Eigentum nicht\./);
		expect(KENNTNISNAHME_1012).toMatch(/\(Rz\. 3 und 5 ad Art\. 712o\)/);
		expect(KENNTNISNAHME_1012).toMatch(/einem Ehepaar, einer Erbengemeinschaft oder einer einfachen Gesellschaft/);
		// Fachprüfung Runde 2, R2-3: Pfandverwertung und Konkurs, die zuständige Behörde.
		expect(KENNTNISNAHME_1012).toMatch(/bei einer Pfändung, einer Pfandverwertung oder im Konkurs die zuständige Behörde/);
		expect(KENNTNISNAHME_1012).toMatch(/\(Rz\. 56 und 58 ad Art\. 712n; Rz\. 25 ad Art\. 712m\); ob es ohne sie geht, sagt der Kommentar nicht\./);
		expect(neu).not.toMatch(/Votum|dieses Werkzeug|Einstellung Ihrer/i);
		// Der Rest des Hinweises bleibt, wie er war.
		expect(neu.replace(KENNTNISNAHME_1012, '')).toBe(vor.replace(KENNTNISNAHME_NEU, ''));
	});

	it('Befund 2: die Karte zur Ausschlussklage misst ohne Angehörige mit eigener Wohnung', () => {
		const vor = VOR12.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const neu = NEU12.knoten.find((k) => k.id === 'k-ausschlussklage')!;
		const angehoerige = (k: typeof neu) => k.hinweise!.find((h) => h.startsWith('Ehegatte und Verwandte des Beklagten'))!;
		// Gegenprobe: Die Vorfassung sagte «ohne die Angehörigen» schlechthin.
		expect(angehoerige(vor)).toMatch(/misst die Mehrheit dann ohne die Angehörigen, wie ohne den Beklagten\./);
		expect(angehoerige(neu)).toBe(ANGEHOERIGE_ANWENDUNG);
		expect(ANGEHOERIGE_ANWENDUNG).toMatch(/ohne die Angehörigen mit eigener Wohnung, wie ohne den Beklagten; eine Wohnung, die ihnen mit dem Beklagten gehört, behandelt der nächste Hinweis\./);
		expect(ANGEHOERIGE_ANWENDUNG).toMatch(/wenn die Ja-Stimmen auch dann reichen, wenn die Angehörigen mitgezählt werden, obwohl sie nicht abstimmen:/);
		// Unter einer Regel trägt der Ersatz denselben ersten Satzteil.
		const unter = neu.hinweiseUnterRegel!.find((u) => u.hinweis === ANGEHOERIGE_ANWENDUNG);
		expect(unter).toBeDefined();
		expect(unter?.ersatz).toMatch(/ohne die Angehörigen mit eigener Wohnung/);
		// Die Website ohne Werkzeugsätze.
		expect(ANGEHOERIGE_WEBSITE).not.toMatch(/Werkzeug|Jetzt möglich/);
		expect(ANGEHOERIGE_WEBSITE).toMatch(/braucht es sechs Ja von zehn\.$/);
	});
});

describe('Die Fassung 2026-10-12 wirft beim Laden, wenn die Vorfassung nicht passt', () => {
	const kenntnis = VOR12.knoten.find((k) => k.id === 'k-kenntnisnahme')!;
	const klage = VOR12.knoten.find((k) => k.id === 'k-ausschlussklage')!;
	it('baut aus der Vorfassung genau die neuen Karten', () => {
		expect(kenntnisnahme1012(kenntnis)).toEqual(NEU12.knoten.find((k) => k.id === 'k-kenntnisnahme'));
		expect(ausschlussklage1012(klage)).toEqual(NEU12.knoten.find((k) => k.id === 'k-ausschlussklage'));
	});
	it('wirft, wenn ein zu ersetzender Satz fehlt oder doppelt steht', () => {
		const h = kenntnis.hinweise!;
		expect(() => kenntnisnahme1012({ ...kenntnis, hinweise: [h[0], h[1], h[3]] })).toThrow(/2026-10-12/);
		expect(() => kenntnisnahme1012({ ...kenntnis, hinweise: [...h, h[2]] })).toThrow(/2026-10-12/);
		const k = klage.hinweise!;
		const ohneAngehoerige = k.filter((x) => !x.startsWith('Ehegatte und Verwandte'));
		expect(() => ausschlussklage1012({ ...klage, hinweise: ohneAngehoerige })).toThrow(/2026-10-12/);
		const i = k.findIndex((x) => x.startsWith('Ehegatte und Verwandte'));
		const umformuliert = k.map((x, j) => (j === i ? x.replace('wie ohne den Beklagten.', 'wie ohne ihn.') : x));
		expect(() => ausschlussklage1012({ ...klage, hinweise: umformuliert })).toThrow(/2026-10-12/);
	});
});

/**
 * **Die Fassung 2026-10-13: die Zustimmung der Betroffenen an der nützlichen
 * baulichen Massnahme** (04.10.2026). Ganzes Paar verglichen, freigestellt
 * allein der Knoten `k-baulich-nuetzlich`.
 *
 * Laien- und Fachprüfung in drei Runden:
 * `quellen/pruefung/berichte/2026-10-04-647d-betroffene.md`.
 */
const VOR13 = holeRegelwerk('2026-10-12');
const NEU13 = holeRegelwerk('2026-10-13');

/**
 * **Der Rückfall für Anzeigen** (Codeprüfung 04.10.2026, H1 und N2): Es gibt
 * gespeicherte Erfordernisse mit Fassungen, die absichtlich nicht in
 * `FASSUNGEN` stehen (`ordnungsantrag-2026-08-05` aus `domain/rueckkommen.ts`,
 * `reglement-<geschäftsart>` aus `domain/reglement.ts`, übernommene
 * Altfassungen). `holeRegelwerk` wirft dort; die Quorumstyp-Anzeige braucht
 * deshalb den Rückfall auf die Basisfassung, und dieser Test hält ihn fest:
 * Ohne ihn wäre die Fehlerklasse aus H1 (500 auf Leitung, Wand und PDF)
 * beim nächsten Umbau unbemerkt wieder da.
 */
describe('holeRegelwerkFuerAnzeige', () => {
	it('wirft nicht, wo holeRegelwerk wirft, und liefert die Typbezeichnung', () => {
		expect(() => holeRegelwerk('ordnungsantrag-2026-08-05')).toThrow(/nicht bekannt/);
		const ordnung = holeRegelwerkFuerAnzeige('ordnungsantrag-2026-08-05');
		expect(ordnung.fassung).toBe('2026-07-30');
		expect(typdefinition(ordnung, 'einfaches_mehr').bezeichnung).toBe('Einfaches Mehr');
		// Die Reglements-Fassungen und übernommene Altfassungen.
		expect(typdefinition(holeRegelwerkFuerAnzeige('reglement-wohnen'), 'reglementsmehr').bezeichnung).toBe(
			'Reglementsmehr'
		);
		expect(
			typdefinition(holeRegelwerkFuerAnzeige('2025-01-01'), 'qualifiziertes_mehr').bezeichnung
		).toBe('Qualifiziertes Mehr');
	});

	it('nimmt die gespeicherte Fassung, wo sie bekannt ist', () => {
		expect(holeRegelwerkFuerAnzeige('2026-10-12').fassung).toBe('2026-10-12');
	});
});

describe('Die Fassung 2026-10-13 gegenüber 2026-10-12', () => {
	it('ändert allein den Knoten der nützlichen baulichen Massnahme', () => {
		expect(pruefeRegelwerk(NEU13)).toEqual([]);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU13;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR13;
		expect(restNeu).toEqual(restVor);
		expect(NEU13.freigabevermerk.startsWith(VOR13.freigabevermerk)).toBe(true);
		expect(NEU13.quellen.slice(0, VOR13.quellen.length)).toEqual(VOR13.quellen);
		expect(NEU13.quellen).toHaveLength(VOR13.quellen.length + 1);
		expect(NEU13.knoten.map((k) => k.id)).toEqual(VOR13.knoten.map((k) => k.id));
		for (const k of NEU13.knoten) {
			const vor = VOR13.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-baulich-nuetzlich') {
				// Nur diese fünf Felder ändern sich; alles andere bleibt.
				expect({
					...k,
					rechtsgrundlage: vor.rechtsgrundlage,
					zustimmungBetroffenerNoetig: vor.zustimmungBetroffenerNoetig,
					betroffenenzustimmung: vor.betroffenenzustimmung,
					betroffeneErlaeuterung: vor.betroffeneErlaeuterung,
					hinweise: vor.hinweise
				}).toEqual(vor);
				expect(k.rechtsgrundlage).toBe('ZGB Art. 647d Abs. 1 bis 3');
				expect(k.zustimmungBetroffenerNoetig).toBe(true);
				expect(k.betroffenenzustimmung).toBe('im_saal_oder_vorab');
				expect(k.betroffeneErlaeuterung).toBeDefined();
				expect(k.hinweise).toHaveLength(vor.hinweise!.length);
			} else {
				expect(k).toEqual(vor);
			}
		}
	});

	it('verlangt die Zustimmung der Betroffenen im Saal oder vorab, mit den geprüften Texten', () => {
		const neu = NEU13.knoten.find((k) => k.id === 'k-baulich-nuetzlich')!;
		expect(neu.typ).toBe('qualifiziertes_mehr');
		expect(neu.zustimmungBetroffenerNoetig).toBe(true);
		expect(neu.betroffenenzustimmung).toBe('im_saal_oder_vorab');
		expect(neu.betroffeneErlaeuterung).toMatch(/erheblich und dauernd erschwert oder unwirtschaftlich/);
		expect(neu.betroffeneErlaeuterung).toMatch(/Dann braucht es die Zustimmung der Person/);
		expect(neu.betroffeneErlaeuterung).toMatch(/bei der Gründung des Stockwerkeigentums/);
		expect(neu.betroffeneErlaeuterung).toMatch(/Durfte er sie nur formlos nutzen, hat er daraus kein Vetorecht/);
		expect(neu.betroffeneErlaeuterung).toMatch(/ohnehin geschützt; wird er erheblich und dauernd erschwert/);
		expect(neu.betroffeneErlaeuterung).toMatch(/auf Zusehen hin, also vorläufig/);
		expect(neu.betroffeneErlaeuterung).toMatch(/keinem Verhältnis zum Wert seines Anteils/);
		expect(neu.betroffeneErlaeuterung).toMatch(/die Zustimmung ersetzen, wenn sie den Teil übernehmen/);
		expect(neu.betroffeneErlaeuterung).toMatch(/Sind Sie unsicher, erfassen Sie die Person/);
		expect(neu.hinweise![0]).toMatch(/zweites, eigenes Erfordernis/);
		expect(neu.hinweise![1]).toMatch(/den unzumutbaren Teil übernehmen \(ZGB Art\. 647d Abs\. 3\)/);
		expect(neu.hinweise![1]).toMatch(/nur um die Kosten geht/);
		expect(neu.hinweise![1]).toMatch(/Kommt die Übernahme nicht zustande/);
		expect(neu.hinweise![1]).toMatch(/auch wenn die übrigen die Kosten übernehmen/);
	});

	it('lässt die Vorfassung unangetastet', () => {
		const vor = VOR13.knoten.find((k) => k.id === 'k-baulich-nuetzlich')!;
		expect(vor.zustimmungBetroffenerNoetig).toBe(false);
		expect(vor.betroffeneErlaeuterung).toBeUndefined();
	});

	it('die Website-Fassungen sind die Anwendungsfassungen ohne die Werkzeugsätze (N6)', () => {
		expect(NUTZLICH_BETROFFEN_ANWENDUNG).toContain('Sind Sie unsicher, erfassen Sie die Person');
		expect(NUTZLICH_BETROFFEN_WEBSITE).not.toMatch(/Sind Sie unsicher|erfassen Sie|Zustimmung ein\./);
		expect(NUTZLICH_KOSTEN_ANWENDUNG).toContain('halten Sie sie im Antragstext fest');
		expect(NUTZLICH_KOSTEN_WEBSITE).not.toMatch(/Antragstext|erfassen|in der Versammlung geschieht/);
		// Die Rechtslage bleibt auf der Website stehen.
		expect(NUTZLICH_KOSTEN_WEBSITE).toContain('ZGB Art. 647d Abs. 3');
		expect(NUTZLICH_KOSTEN_WEBSITE).toContain('bleibt die Zustimmung nötig');
	});
});

/**
 * **Die Fassung 2026-10-14: die Milderung des Quorums ist umstritten**
 * (04.10.2026). Ganzes Paar verglichen, freigestellt allein der Knoten
 * `k-reglement-normal` und dort allein die Hinweise.
 */
const VOR14 = holeRegelwerk('2026-10-13');
const NEU14 = holeRegelwerk('2026-10-14');

describe('Die Fassung 2026-10-14 gegenüber 2026-10-13', () => {
	it('ändert allein den Knoten der gewöhnlichen Reglementsänderung', () => {
		expect(pruefeRegelwerk(NEU14)).toEqual([]);
		const { fassung: _f1, quellen: _q1, knoten: _k1, freigabevermerk: _v1, ...restNeu } = NEU14;
		const { fassung: _f2, quellen: _q2, knoten: _k2, freigabevermerk: _v2, ...restVor } = VOR14;
		expect(restNeu).toEqual(restVor);
		expect(NEU14.freigabevermerk.startsWith(VOR14.freigabevermerk)).toBe(true);
		expect(NEU14.quellen.slice(0, VOR14.quellen.length)).toEqual(VOR14.quellen);
		expect(NEU14.quellen).toHaveLength(VOR14.quellen.length + 1);
		expect(NEU14.knoten.map((k) => k.id)).toEqual(VOR14.knoten.map((k) => k.id));
		for (const k of NEU14.knoten) {
			const vor = VOR14.knoten.find((x) => x.id === k.id)!;
			if (k.id === 'k-reglement-normal') {
				// Nur die Hinweise ändern sich — und mit ihnen der Eintrag, der den
				// neuen Hinweis unter einer Regel einordnet; alles andere bleibt.
				expect({ ...k, hinweise: vor.hinweise, hinweiseUnterRegel: vor.hinweiseUnterRegel }).toEqual(
					vor
				);
				expect(k.hinweise).toHaveLength(vor.hinweise!.length);
				expect(k.hinweiseUnterRegel).toHaveLength((vor.hinweiseUnterRegel ?? []).length + 1);
				expect(k.hinweiseUnterRegel?.at(-1)).toEqual({
					hinweis: REGLEMENT_MILDERUNG,
					zumGesetz: true
				});
			} else {
				expect(k).toEqual(vor);
			}
		}
	});

	it('nennt die Milderung umstritten und beide Meinungen', () => {
		const neu = NEU14.knoten.find((k) => k.id === 'k-reglement-normal')!;
		const erster = neu.hinweise![0];
		expect(erster).toBe(REGLEMENT_MILDERUNG);
		expect(erster).toContain('umstritten');
		expect(erster).toContain('SVIT-Kommentar bejaht sie');
		expect(erster).toContain('Einstimmigkeit');
		expect(erster).toContain('Rey/Maetzke');
		expect(erster).toContain('unzulässig');
		expect(erster).toContain('gesetzliche Erfordernis erreicht');
		// Der alte, zu sichere Satz ist weg.
		expect(erster).not.toContain('darf dieses Quorum mildern');
	});

	it('lässt die Vorfassung unangetastet', () => {
		const vor = VOR14.knoten.find((k) => k.id === 'k-reglement-normal')!;
		expect(vor.hinweise![0]).toContain('darf dieses Quorum mildern');
		expect(vor.hinweise![0]).not.toContain('Rey/Maetzke halten eine Milderung');
	});
});

describe('Die Fassung 2026-10-14 wirft beim Laden, wenn die Vorfassung nicht passt', () => {
	const vor = VOR14.knoten.find((k) => k.id === 'k-reglement-normal')!;

	it('baut aus der Vorfassung genau den neuen Hinweis', () => {
		expect(reglementMilderung(vor)).toEqual(NEU14.knoten.find((k) => k.id === 'k-reglement-normal'));
	});

	it('wirft, wenn der zu ersetzende Satz fehlt oder doppelt steht', () => {
		const h = vor.hinweise!;
		// Fehlt: nur der zweite Hinweis bleibt.
		expect(() => reglementMilderung({ ...vor, hinweise: [h[1]] })).toThrow(/2026-10-14/);
		// Doppelt.
		expect(() => reglementMilderung({ ...vor, hinweise: [...h, h[0]] })).toThrow(/2026-10-14/);
		// Umformuliert: Der Wortanfang trifft nicht mehr.
		const umformuliert = h.map((x, i) => (i === 0 ? x.replace('darf', 'kann') : x));
		expect(() => reglementMilderung({ ...vor, hinweise: umformuliert })).toThrow(/2026-10-14/);
	});
});

/*
 * **Die Fassung 2026-10-15: hinterlegte Regeln an der vereinbarten Ordnung**
 * (Produktentscheid 07.10.2026 «Nach Fachprüfung»; Fachprüfung vor dem Bau,
 * `quellen/pruefung/berichte/2026-10-07-votum-vereinbarte-ordnung.md`).
 */
const NEU15 = holeRegelwerk('2026-10-15');

describe('Die Fassung 2026-10-15 gegenüber 2026-10-14', () => {
	const knoten15 = (id: string) => NEU15.knoten.find((k) => k.id === id)!;
	const knoten14 = (id: string) => NEU14.knoten.find((k) => k.id === id)!;
	const regel = (id: string, teil: Record<string, unknown>) => ({
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: knoten15(id).geschaeftsart,
		fundstelle: 'Reglement Ziff. 9',
		kopfbasis: 'anwesend_vertreten' as Kopfbasis,
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const },
		quotenbasis: 'keine' as const,
		quotenSchwelle: null,
		enthaltungZaehltMit: true,
		...teil
	});
	const anwenden = (id: string, teil: Record<string, unknown> = {}) =>
		wendeReglementAn(
			erfordernisAusKnoten(NEU15, knoten15(id)),
			[regel(id, teil) as Parameters<typeof wendeReglementAn>[1][number]],
			null, LESARTEN_VORGABE
		);

	it('ändert nur Verhalten, Rechtssatz und einen Hinweis, an den Wegen nichts', () => {
		expect(pruefeRegelwerk(NEU15)).toEqual([]);
		expect(NEU15.aeste).toEqual(NEU14.aeste);
		expect(NEU15.fragen).toEqual(NEU14.fragen);
		const ohne = (k: (typeof NEU15.knoten)[number]) => {
			const { reglementsverhalten: _v, reglementsrecht: _r, hinweise: _h, ...rest } = k;
			return rest;
		};
		expect(NEU15.knoten.map(ohne)).toEqual(NEU14.knoten.map(ohne));
		const verhalten = Object.fromEntries(
			NEU15.knoten
				.filter((k) => k.reglementsverhalten !== knoten14(k.id).reglementsverhalten)
				.map((k) => [k.id, k.reglementsverhalten])
		);
		expect(verhalten).toEqual({
			'k-baulich-notwendig': 'vereinbart',
			'k-baulich-nuetzlich': 'vereinbart',
			'k-baulich-luxurioes-ausweg': 'nur_mildern',
			'k-benutzungsweise': 'vereinbart',
			'k-zweckbestimmung': 'vereinbart',
			'k-verwaltung-wichtig': 'vereinbart'
		});
		expect(NEU15.knoten.filter((k) => k.reglementsrecht).map((k) => k.id).sort()).toEqual(
			Object.keys(REGLEMENTSRECHT).sort()
		);
	});

	it('lässt die Vorfassung unangetastet', () => {
		expect(knoten14('k-baulich-notwendig').reglementsverhalten).toBe('gesperrt_vereinbarung');
		expect(knoten14('k-baulich-notwendig').reglementsrecht).toBeUndefined();
		const vorher = wendeReglementAn(
			erfordernisAusKnoten(NEU14, knoten14('k-verwaltung-wichtig')),
			[regel('k-verwaltung-wichtig', {}) as Parameters<typeof wendeReglementAn>[1][number]],
			null, LESARTEN_VORGABE
		);
		expect(vorher.vorbehalt).toBe('vereinbarung');
	});

	it('wendet an den fünf Karten eine Regel an, strenger wie milder', () => {
		for (const id of [
			'k-baulich-notwendig',
			'k-baulich-nuetzlich',
			'k-benutzungsweise',
			'k-verwaltung-wichtig'
		]) {
			const streng = anwenden(id, { kopfbasis: 'alle_eigentuemer' });
			expect(streng.vorbehalt, id).toBeNull();
			expect(streng.erfordernis.typ, id).toBe('reglementsmehr');
			const mild = anwenden(id, { kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } });
			expect(mild.vorbehalt, id).toBeNull();
		}
		// Die Zweckbestimmung verlangt von Gesetzes wegen alle; gemildert wird nur
		// mit einer Regel für genau diesen Fall (Laienprüfung nach dem Bau, B7).
		expect(anwenden('k-zweckbestimmung', { knotenId: 'k-zweckbestimmung' }).vorbehalt).toBeNull();
	});

	it('wendet dort keine Regel an, die Einstimmigkeit verlangt', () => {
		const alle = {
			kopfbasis: 'alle_eigentuemer',
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }
		};
		for (const id of ['k-baulich-notwendig', 'k-baulich-nuetzlich', 'k-benutzungsweise', 'k-verwaltung-wichtig']) {
			const a = anwenden(id, alle);
			expect(a.vorbehalt, id).toBe('einstimmigkeit_ausgeschlossen');
			expect(a.erfordernis.typ, id).not.toBe('reglementsmehr');
			const karte = karteMitReglement(ergebniskarte(NEU15, knoten15(id)), a.regel, a.vorbehalt, null, null);
			expect(karte.reglementsvorbehalt, id).toMatch(/die Zustimmung aller nicht oder nur ausnahmsweise/);
			expect(karte.reglementsvorbehalt, id).toMatch(/Wird Ihre Bestimmung im Saal eingewendet/);
			// Ohne «gilt wohl trotzdem», das sich auf die verworfene Klausel bezöge (A4).
			expect(karte.reglementsvorbehalt, id).not.toMatch(/wohl trotzdem/);
		}
	});

	it('wendet am Ausweg nur eine mildere Regel an', () => {
		const ausweg = 'k-baulich-luxurioes-ausweg';
		const e = erfordernisAusKnoten(NEU15, knoten15(ausweg));
		const gleich = { kopfbasis: e.kopfbasis, kopfSchwelle: e.kopfSchwelle, quotenbasis: e.quotenbasis, quotenSchwelle: e.quotenSchwelle };
		expect(anwenden(ausweg, gleich).vorbehalt).toBeNull();
		expect(
			anwenden(ausweg, { ...gleich, kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' } }).vorbehalt
		).toBe('verschaerfung');
		// Der Hinweis, das Werkzeug folge der strengeren Lesart, ist weg.
		expect((knoten15(ausweg).hinweise ?? []).some((h) => /strengeren Lesart/.test(h))).toBe(false);
		expect((knoten14(ausweg).hinweise ?? []).some((h) => /strengeren Lesart/.test(h))).toBe(true);
	});

	it('sperrt luxuriöse Massnahme und Verkauf weiter, mit eigenem Rechtssatz', () => {
		for (const id of ['k-baulich-luxurioes', 'k-grundstueck-verkauf']) {
			expect(knoten15(id).reglementsverhalten, id).toBe('gesperrt_vereinbarung');
			expect(anwenden(id).vorbehalt, id).toBe('vereinbarung');
		}
	});

	it('nennt im Kasten Bedingung und Rechtssatz, ohne Versprechen ohne Weg', () => {
		for (const id of ['k-baulich-notwendig', 'k-zweckbestimmung', 'k-verwaltung-wichtig']) {
			const kasten = ergebniskarte(NEU15, knoten15(id)).reglementsvorbehalt;
			expect(kasten, id).toMatch(/Rechtmässig ist eine andere Ordnung hier nur, wenn alle Eigentümer/);
			expect(kasten, id).toContain(REGLEMENTSRECHT[id]);
			expect(kasten, id).toMatch(/Dieses Werkzeug wendet sie dann an/);
			expect(kasten, id).not.toMatch(/dürfen Sie nach ihr auszählen/);
		}
		// An der Zweckbestimmung ist «gilt trotzdem» nicht geklärt (Fachprüfung, A3).
		expect(REGLEMENTSRECHT['k-zweckbestimmung']).not.toMatch(/wohl trotzdem/);
		expect(REGLEMENTSRECHT['k-zweckbestimmung']).toMatch(/nicht geklärt/);
		const abberufung = ergebniskarte(NEU15, knoten15('k-bewirtschaftung-abberufen'));
		expect(abberufung.reglementsvorbehalt).toMatch(/Rz\. 64 ad Art\. 712g/);
		expect(abberufung.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
	});

	it('nennt unter einer angewandten Regel die Bedingung', () => {
		const id = 'k-verwaltung-wichtig';
		const a = anwenden(id);
		const karte = karteMitReglement(
			ergebniskarte(NEU15, knoten15(id)),
			a.regel,
			a.vorbehalt,
			null,
			null,
			undefined,
			erfordernisAusKnoten(NEU15, knoten15(id))
		);
		expect(karte.reglementsvorbehalt).toMatch(/Angewandt wird die hinterlegte Regel/);
		expect(karte.reglementsvorbehalt).toMatch(/alle Eigentümer ihr zugestimmt haben/);
		expect(karte.reglementsvorbehalt).toMatch(/erst nach Ablauf der Anfechtungsfrist/);
		expect(karte.reglementsvorbehalt).toMatch(/kann dieses Werkzeug nicht prüfen/);
	});

	it('wirft beim Laden, wenn der Hinweis der Vorfassung am Ausweg nicht passt', () => {
		const vor = knoten14('k-baulich-luxurioes-ausweg');
		expect(fassung20261015(vor)).toEqual(knoten15('k-baulich-luxurioes-ausweg'));
		const ohne = (vor.hinweise ?? []).filter((h) => !/strengeren Lesart/.test(h));
		expect(() => fassung20261015({ ...vor, hinweise: ohne })).toThrow(/2026-10-15/);
	});

	it('zeigt jeden Rechtssatz im Kasten der Karte, ohne und mit hinterlegter Regel', () => {
		// Fach- und Laienprüfung nach dem Bau (A1, B6): Drei Rechtssätze standen
		// in keinem angezeigten Feld.
		for (const [id, recht] of Object.entries(REGLEMENTSRECHT)) {
			const k = knoten15(id);
			expect(ergebniskarte(NEU15, k).reglementsvorbehalt, id).toContain(recht);
			const a = anwenden(id, id === 'k-zweckbestimmung' ? { knotenId: id } : {});
			const karte = karteMitReglement(
				ergebniskarte(NEU15, k),
				a.regel,
				a.vorbehalt,
				null,
				null,
				undefined,
				erfordernisAusKnoten(NEU15, k)
			);
			expect(karte.reglementsvorbehalt, `${id} mit Regel`).toContain(recht);
		}
	});

	it('wendet an der Zweckbestimmung keine Regel für die ganze Geschäftsart an', () => {
		const a = anwenden('k-zweckbestimmung');
		expect(a.vorbehalt).toBe('nur_fallgenau');
		const karte = karteMitReglement(ergebniskarte(NEU15, knoten15('k-zweckbestimmung')), a.regel, a.vorbehalt, null, null);
		expect(karte.reglementsvorbehalt).toMatch(/für genau diesen Fall/);
		// Dieselbe Regel gilt an der Benutzungsweise.
		expect(anwenden('k-benutzungsweise').vorbehalt).toBeNull();
	});

	it('bietet an der Nutzungsänderung beide Fälle zur Wahl (H3)', () => {
		expect(regelGiltFuer(NEU15, 'nutzungsaenderung')).toEqual([
			'Benutzungsweise ändern',
			'Zweckbestimmung der Liegenschaft ändern'
		]);
		expect(regelGiltFuer(NEU14, 'nutzungsaenderung')).toEqual([]);
	});

	it('verspricht an luxuriöser Massnahme und Verkauf keinen Weg (H2)', () => {
		for (const id of ['k-baulich-luxurioes', 'k-grundstueck-verkauf']) {
			const a = anwenden(id);
			const karte = karteMitReglement(ergebniskarte(NEU15, knoten15(id)), a.regel, a.vorbehalt, null, null);
			expect(karte.reglementsvorbehalt, id).not.toMatch(/wendet sie eine solche Regel an/);
			expect(karte.reglementsvorbehalt, id).toMatch(/Ausgezählt wird nach dem Gesetz/);
			expect(ergebniskarte(NEU15, knoten15(id)).reglementsvorbehalt, id).not.toMatch(/klären Sie/);
		}
	});
	it('nennt den Fristbeginn, wo sie den Vollzug bis nach der Anfechtungsfrist rät (Fachprüfung Runde 3, B1)', () => {
		const { karte } = karteUnter(NEU15, 'k-baulich-notwendig');
		expect(karte.reglementsvorbehalt).toMatch(
			/Anfechtungsfrist von einem Monat; für Abwesende ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben/
		);
	});

	it('sagt am Ausweg «rechtmässig» wie an den anderen Karten, nicht «gilt nur» (Fachprüfung Runde 3, B2)', () => {
		const satz = REGLEMENTSRECHT['k-baulich-luxurioes-ausweg'];
		expect(satz).toMatch(/Rechtmässig ist eine solche Bestimmung nur/);
		expect(satz).not.toMatch(/gilt nur/);
		expect(satz).toMatch(/ist nicht geklärt/);
	});

	it('nimmt in der Reichweite die Zweckbestimmung von der Einstimmigkeitsausnahme aus (Codeprüfung Runde 3, N1)', () => {
		const satz = regelReichweite(NEU15, knoten15('k-zweckbestimmung').geschaeftsart) ?? '';
		const ausnahme = satz.match(/Verlangt sie bei ([^.]*?) die Zustimmung aller/);
		expect(ausnahme?.[1]).toMatch(/Benutzungsweise/);
		expect(ausnahme?.[1]).not.toMatch(/Zweckbestimmung/);
	});
});

/**
 * **Die Fassung 2026-10-16: sieben Rechtssätze genauer** (Fachprüfung des
 * Website-Abzugs, 07.10.2026; Produktentscheid 08.10.2026 «Bleibt, Text
 * ehrlich»). Nur `reglementsrecht` ändert sich.
 */
const NEU16 = holeRegelwerk('2026-10-16');

describe('Die Fassung 2026-10-16 gegenüber 2026-10-15', () => {
	const k15 = (id: string) => NEU15.knoten.find((k) => k.id === id)!;
	const k16 = (id: string) => NEU16.knoten.find((k) => k.id === id)!;

	it('ändert nur den Rechtssatz, und das an genau sieben Karten', () => {
		expect(pruefeRegelwerk(NEU16)).toEqual([]);
		expect(NEU16.aeste).toEqual(NEU15.aeste);
		expect(NEU16.fragen).toEqual(NEU15.fragen);
		const ohne = (k: (typeof NEU16.knoten)[number]) => {
			const { reglementsrecht: _r, ...rest } = k;
			return rest;
		};
		expect(NEU16.knoten.map(ohne)).toEqual(NEU15.knoten.map(ohne));
		const geaendert = NEU16.knoten
			.filter((k) => k.reglementsrecht !== k15(k.id).reglementsrecht)
			.map((k) => k.id)
			.sort();
		expect(geaendert).toEqual(
			[
				'k-baulich-luxurioes',
				'k-baulich-luxurioes-ausweg',
				'k-baulich-notwendig',
				'k-baulich-nuetzlich',
				'k-benutzungsweise',
				'k-grundstueck-verkauf',
				'k-verwaltung-wichtig'
			].sort()
		);
	});

	it('nennt den Fristbeginn überall mit «ohne Vertretung»', () => {
		for (const k of NEU16.knoten) {
			if (!k.reglementsrecht?.includes('Erhalt des Protokolls')) continue;
			expect(k.reglementsrecht, k.id).toContain('für Abwesende ohne Vertretung');
		}
	});

	it('sagt am Ausweg, dass das Senken umstritten ist, mit beiden Stellen', () => {
		const satz = k16('k-baulich-luxurioes-ausweg').reglementsrecht!;
		expect(satz).toMatch(/Ob es das Mehr senken darf, ist ebenfalls umstritten/);
		expect(satz).toMatch(/ob die Regel des Auswegs zwingend ist, ist in der Lehre umstritten/);
		expect(satz).toContain('Rz. 54 ad Art. 712g');
		expect(satz).toContain('Rz. 136 ad Art. 712a');
		expect(satz).not.toMatch(/darf das Mehr für diesen Ausweg senken/);
		// Das Verhalten bleibt (Produktentscheid 08.10.2026).
		expect(k16('k-baulich-luxurioes-ausweg').reglementsverhalten).toBe('nur_mildern');
	});

	it('gibt Rz. 18 beim Verkauf wieder, wie sie steht, und lässt die Sperre', () => {
		const satz = k16('k-grundstueck-verkauf').reglementsrecht!;
		expect(satz).toMatch(/ausdrücklich auch im Stockwerkeigentum an \(Rz\. 18\)/);
		expect(satz).toMatch(/Beides ist offen\.$/);
		expect(k16('k-grundstueck-verkauf').reglementsverhalten).toBe('gesperrt_vereinbarung');
	});

	it('verweist an der wichtigeren Verwaltungshandlung auf die eigene Karte der notwendigen Massnahme', () => {
		const satz = k16('k-verwaltung-wichtig').reglementsrecht!;
		expect(satz).not.toMatch(/bleiben beim einfachen Mehr/);
		expect(satz).toContain('gilt nicht diese Karte, sondern ihre eigene');
	});

	it('ersetzt nur Karten, die schon einen Rechtssatz trugen, und lässt die übrigen', () => {
		expect(Object.keys(REGLEMENTSRECHT_NEU)).toHaveLength(7);
		for (const id of Object.keys(REGLEMENTSRECHT_NEU)) {
			expect(REGLEMENTSRECHT[id], id).toBeTruthy();
		}
		expect(fassung20261016(k15('k-baulich-luxurioes'))).toEqual(k16('k-baulich-luxurioes'));
		expect(fassung20261016(k15('k-bewirtschaftung-abberufen'))).toEqual(
			k15('k-bewirtschaftung-abberufen')
		);
	});
});

/**
 * **Die Fassung 2026-10-17: die Hinweise am Ausweg neu gegliedert** (Rückmeldung
 * des Auftraggebers 08.10.2026: «Wenn ich nicht zustimme, bin ich auch nicht
 * dauerhaft beeinträchtigt?»). Nur die Hinweise dieser einen Karte ändern sich.
 */
const NEU17 = holeRegelwerk('2026-10-17');

describe('Die Fassung 2026-10-17 gegenüber 2026-10-16', () => {
	const AUSWEG = 'k-baulich-luxurioes-ausweg';
	const k16 = (id: string) => NEU16.knoten.find((k) => k.id === id)!;
	const k17 = (id: string) => NEU17.knoten.find((k) => k.id === id)!;

	it('ändert nur Hinweise und Begründung am Ausweg', () => {
		expect(pruefeRegelwerk(NEU17)).toEqual([]);
		expect(NEU17.aeste).toEqual(NEU16.aeste);
		expect(NEU17.fragen).toEqual(NEU16.fragen);
		for (const k of NEU17.knoten) {
			if (k.id === AUSWEG) continue;
			expect(k, k.id).toEqual(k16(k.id));
		}
		const { hinweise: _a, begruendung: b17, ...ohne17 } = k17(AUSWEG);
		const { hinweise: _b, begruendung: b16, ...ohne16 } = k16(AUSWEG);
		expect(ohne17).toEqual(ohne16);
		expect(b16).toContain('Wer nicht zustimmt, wird nicht dauernd beeinträchtigt');
		expect(b17).toContain('Wer nicht zustimmt, darf nicht dauernd beeinträchtigt werden');
		expect(k17(AUSWEG).hinweise).toEqual(AUSWEG_HINWEISE);
	});

	it('sagt die erste Bedingung als Bedingung, mit ihrer Folge', () => {
		const erste = AUSWEG_HINWEISE[0];
		expect(erste).toMatch(/^Erste Bedingung: Wer nicht zustimmt, darf durch die Anlage/);
		expect(erste).toContain('gilt dieser Weg für ihn nicht: Dann braucht es auch seine Zustimmung');
		// Die Gegenseite erfährt schon hier, dass sie selbst anfechten muss (Laienprüfung).
		expect(erste).toContain('wenn er ihn nicht selbst innert eines Monats anficht');
	});

	it('ist kürzer als die Vorfassung und hat keinen Hinweis über 1100 Zeichen', () => {
		const laenge = (h: string[]) => h.reduce((n, x) => n + x.length, 0);
		expect(laenge(AUSWEG_HINWEISE)).toBeLessThan(laenge(k16(AUSWEG).hinweise!));
		for (const h of AUSWEG_HINWEISE) expect(h.length, h.slice(0, 40)).toBeLessThanOrEqual(1100);
	});

	it('wirft, wenn die Vorfassung andere Hinweise trägt', () => {
		const vor = k16(AUSWEG);
		expect(() => fassung20261017({ ...vor, hinweise: vor.hinweise!.slice(1) })).toThrow(
			/2026-10-17/
		);
	});
});

/**
 * **Die Fassung 2026-10-18: Rang und Gegenmeinung je Regel** (Ä-01, Ä-02,
 * Ä-04 der Zweitprüfung, Entscheid 17.09.2026: nur sichtbar machen). Kein
 * Erfordernis, kein Weg und kein Kartentext ändert sich.
 */
const NEU18 = holeRegelwerk('2026-10-18');

describe('Die Fassung 2026-10-18 gegenüber 2026-10-17', () => {
	const k17 = (id: string) => NEU17.knoten.find((k) => k.id === id)!;

	it('ändert nur Rang und Gegenmeinung', () => {
		expect(pruefeRegelwerk(NEU18)).toEqual([]);
		expect(NEU18.aeste).toEqual(NEU17.aeste);
		expect(NEU18.fragen).toEqual(NEU17.fragen);
		expect(NEU18.knoten.map((k) => k.id)).toEqual(NEU17.knoten.map((k) => k.id));
		for (const k of NEU18.knoten) {
			const { rang: _r, gegenmeinung: _g, ...ohne } = k;
			expect(ohne, k.id).toEqual(k17(k.id));
		}
	});

	it('gibt jedem Knoten mit Erfordernis einen Rang und keinem anderen', () => {
		for (const k of NEU18.knoten) {
			const ohneErfordernis = k.typ === 'grenzfall' || k.typ === 'keine_abstimmung';
			expect(k.rang === undefined, k.id).toBe(ohneErfordernis);
		}
		// Die Regel aus dem Dateikopf: Wortlautabweichung heisst nie «gesetz»,
		// und das Bundesgericht trägt nur Art. 647d (BGE 144 III 510).
		for (const k of NEU18.knoten.filter((x) => x.wortlautAbweichung)) {
			expect(k.rang, k.id).toBe(k.rechtsgrundlage.startsWith('ZGB Art. 647d') ? 'bundesgericht' : 'lehre');
		}
		expect(NEU18.knoten.filter((k) => k.rang === 'bundesgericht').map((k) => k.id)).toEqual([
			'k-baulich-nuetzlich'
		]);
	});

	it('nennt die Gegenmeinung an genau den Streitfragen des Website-Exports', async () => {
		/*
		 * Zwei Stellen für dieselbe Aussage: das Merkmal hier und die Liste
		 * `STREITFRAGEN` im Export, die das Signet «Streitfrage, streng
		 * ausgelegt» trägt. Die Liste ist mit eigenen Wächtern verdrahtet und
		 * bleibt; diese Probe hält beide gleich.
		 */
		const { readFileSync } = await import('node:fs');
		const { fileURLToPath } = await import('node:url');
		const { dirname, join } = await import('node:path');
		const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
		const quelle = readFileSync(join(wurzel, 'scripts/quorumsbaum-export.mjs'), 'utf-8');
		const block = quelle.match(/const STREITFRAGEN = new Set\(\[([\s\S]*?)\]\)/);
		expect(block).not.toBeNull();
		const eingetragen = block![1]
			.split('\n')
			.map((z) => z.trim())
			.filter((z) => z.startsWith("'"))
			.map((z) => z.slice(1, z.indexOf("'", 1)))
			.sort();
		/*
		 * **Die aktuelle Fassung, nicht diese** (Codeprüfung H7, M-1): Der Export
		 * liest die aktuelle. Auf `NEU18` bliebe die Probe beim nächsten
		 * Fassungswechsel grün, dieselbe Falle wie «Über alle Fassungen, nicht
		 * über eine» weiter oben.
		 */
		const mitGegenmeinung = holeRegelwerk()
			.knoten.filter((k) => k.gegenmeinung)
			.map((k) => k.id)
			.sort();
		expect(mitGegenmeinung).toEqual(eingetragen);
		expect(NEU18.knoten.filter((k) => k.gegenmeinung)).toHaveLength(4);
	});

	it('nennt keine Gegenmeinung, wo der Knoten die mildere Lesart rechnet', () => {
		// Produktentscheid 22.09.2026 (B-08) und die offene Frage in `docs/freigabe.md`.
		expect(GEGENMEINUNG['k-zustaendigkeit-gewoehnlich']).toBeUndefined();
		expect(GEGENMEINUNG['k-bewirtschaftung-waehlen']).toBeUndefined();
	});

	it('trägt in jeder Gegenmeinung eine Fundstelle', () => {
		for (const [id, satz] of Object.entries(GEGENMEINUNG)) {
			expect(satz, id).toMatch(/Rz\. \d+|E\. \d/);
			expect(satz, id).not.toMatch(/ – | — /);
		}
	});

	it('wirft, wenn ein Knoten mit Erfordernis keinen Rang bekommt', () => {
		expect(Object.keys(RANG)).toHaveLength(NEU18.knoten.filter((k) => k.rang).length);
		const fremd = { ...k17('k-jahresrechnung'), id: 'k-unbekannt' };
		expect(() => fassung20261018(fremd)).toThrow(/2026-10-18/);
	});

	it('meldet Gegenmeinung und Rang, die nicht zur Karte passen', () => {
		const mit = (id: string, zusatz: object) => ({
			...NEU18,
			knoten: NEU18.knoten.map((k) => (k.id === id ? { ...k, ...zusatz } : k))
		});
		expect(pruefeRegelwerk(mit('k-jahresrechnung', { gegenmeinung: 'Anders (Rz. 1).' })).join()).toMatch(
			/führt den Streit aber nicht aus/
		);
		expect(pruefeRegelwerk(mit('k-baulich-notwendig', { rang: 'gesetz' })).join()).toMatch(
			/weicht vom Wortlaut ab/
		);
		expect(pruefeRegelwerk(mit('k-jahresrechnung', { rang: undefined })).join()).toMatch(
			/trägt keinen Rang/
		);
		expect(pruefeRegelwerk(mit('k-jahresrechnung', { rang: 'reglement' })).join()).toMatch(
			/passen nicht zusammen/
		);
	});
});

describe('Fassung 2026-10-28 gegenüber 2026-10-27 (L3, die Einsprache je Eigentümer)', () => {
	const ALT28 = holeRegelwerk('2026-10-27');
	const NEU28 = holeRegelwerk('2026-10-28');

	it('ändert am Baum nichts, nur am Vermerk', () => {
		expect(pruefeRegelwerk(NEU28)).toEqual([]);
		// Die Zählung hängt an der Fassung, nicht am Knoten (AD-4): Kein Knoten,
		// keine Frage, kein Ast ändert sich.
		expect(NEU28.aeste).toEqual(ALT28.aeste);
		expect(NEU28.fragen).toEqual(ALT28.fragen);
		expect(NEU28.knoten).toEqual(ALT28.knoten);
		expect(NEU28.freigabevermerk).toContain('zählt die Einsprache');
	});

	it('die Einsprache trägt weiter Kennung und Mehr', () => {
		const knoten = NEU28.knoten.find((k) => k.id === 'k-einsprache')!;
		expect(knoten.typ).toBe('einfaches_mehr');
		expect(knoten.kopfbasis).toBe('anwesend_vertreten');
	});
});

/*
 * Keine Fassung gilt als juristisch gegengelesen, bis die Antwort auf das
 * Restpaket eingearbeitet ist (Ablaufplan F4b; Prompt F4c: «juristischGegengelesen
 * bleibt false»). Die Fassungen erben den Vermerk über den Spread; die aktuelle
 * prüft `regelwerk.test.ts`, die übrigen prüften bis zur Featureprüfung F4c
 * (06.11.2026) nur einzelne Zeilen. Wird F4b gebaut, ändert sich dieser Test
 * bewusst mit.
 */
describe('Der Vermerk «juristisch gegengelesen» ohne Gegenlesung', () => {
	it('steht an keiner Fassung', () => {
		expect(alleFassungen().filter((rw) => rw.juristischGegengelesen).map((rw) => rw.fassung)).toEqual([]);
	});
});
