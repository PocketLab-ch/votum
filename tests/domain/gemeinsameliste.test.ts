/**
 * Die Traktandenliste einer gemeinsamen Versammlung.
 *
 * Zwei Punkte, um die es geht:
 *
 *   * **Die Nummer ist die Protokollnummer.** Was im Saal als «3.1» aufgerufen
 *     wird, steht so im Protokoll der Gemeinschaft — zwei Zählungen nebeneinander
 *     wären im Saal nicht zu führen (Auftraggeber, 11.08.2026).
 *   * **Es gibt eine Liste, nicht eine je Haus.** Lautet ein Traktandum überall
 *     gleich, ist es ein Punkt. Erst die Abweichung erzeugt Unterpunkte.
 */
import { describe, expect, it } from 'vitest';
import {
	abendschritte,
	ablegepunkt,
	angehaengteAntraege,
	fasseZusammen,
	gemeinsameListe,
	neueReihenfolge,
	laufendeStelle,
	nummernJeTraktandum,
	zielDesAntrags,
	type Abendantrag,
	type Geschaeftszeile,
	type LosesTraktandum
} from '$lib/domain/gemeinsameliste';

const HAUS = (n: number, ueber: Record<string, unknown> = {}) => ({
	traktandumId: `t${n}`,
	meetingId: `m${n}`,
	stwegId: `s${n}`,
	gemeinschaft: `Nirgendweg ${n}`,
	titel: 'Budget 2027',
	antragswortlaut: 'Das Budget sei zu genehmigen.',
	art: 'abstimmung' as const,
	erfordernisKnoten: null as string | null,
	abweichend: false,
	...ueber
});

/** Zwei Häuser, die beim Betrag auseinandergehen — der Fall, der gliedert. */
const EIGENE_BETRAEGE = [
	HAUS(1, { antragswortlaut: 'Das Budget von CHF 80 000 sei zu genehmigen.', abweichend: true }),
	HAUS(2, { antragswortlaut: 'Das Budget von CHF 120 000 sei zu genehmigen.', abweichend: true })
];

const GESCHAEFT = (ueber: Partial<Geschaeftszeile> = {}): Geschaeftszeile => ({
	geschaeftId: 'g1',
	titel: 'Budget 2027',
	antragswortlaut: 'Das Budget sei zu genehmigen.',
	inhalt: null,
	art: 'abstimmung',
	stelle: 0,
	haeuser: EIGENE_BETRAEGE,
	...ueber
});

describe('gemeinsameListe', () => {
	it('gliedert in 3.1 und 3.2, sobald die Häuser auseinandergehen', () => {
		const l = gemeinsameListe([
			GESCHAEFT({ geschaeftId: 'a', titel: 'Begrüssung', stelle: 0, haeuser: [HAUS(1)] }),
			GESCHAEFT({ geschaeftId: 'b', titel: 'Traktandenliste', stelle: 1, haeuser: [HAUS(1)] }),
			GESCHAEFT({ geschaeftId: 'c', stelle: 2 })
		]);
		expect(l.map((z) => `${z.nummer} ${z.titel}`)).toEqual([
			'1 Budget 2027',
			'2 Budget 2027',
			'3 Budget 2027',
			'3.1 Nirgendweg 1',
			'3.2 Nirgendweg 2'
		]);
	});

	it('gliedert ab zwei Gemeinschaften, auch wenn überall dasselbe steht', () => {
		// Produktentscheid 11.08.2026: «Eigentlich muss pro Haus abgestimmt werden,
		// ergo auch je ein Traktandum angekündigt werden. Sonst entstehen
		// Missverständnisse.» Was einzeln beschlossen wird, muss einzeln
		// angekündigt sein — die Zahl der Häuser gliedert, nicht der Inhalt.
		const l = gemeinsameListe([
			GESCHAEFT({ titel: 'Begrüssung', haeuser: [HAUS(1), HAUS(2), HAUS(3)] })
		]);
		expect(l).toHaveLength(4);
		expect(l[0].art).toBe('sammelpunkt');
		expect(l.slice(1).map((z) => z.nummer)).toEqual(['1.1', '1.2', '1.3']);
		// Dass überall dasselbe steht, ist trotzdem vermerkt — die Anzeige hält
		// solche Punkte zugeklappt.
		expect(l[0].einheitlich).toBe(true);
	});

	it('meldet den Sammelpunkt als aufgespalten, sobald ein Haus ausschert', () => {
		const l = gemeinsameListe([GESCHAEFT()]);
		expect(l[0].art).toBe('sammelpunkt');
		expect(l[0].einheitlich).toBe(false);
		// **Auch die Ziffern tragen den Wert ihres Punktes.** Die Anzeige fragt ihn
		// bei jeder Zeile ab; stünde bei der Ziffer «true», bliebe sie versteckt,
		// obwohl ihr Punkt aufgespalten ist (gefunden vom Durchlauf am 11.08.2026).
		expect(l[1].einheitlich).toBe(false);
		expect(l[2].einheitlich).toBe(false);
	});

	it('lässt den Sammelpunkt weg, wenn nur eine Gemeinschaft betroffen ist', () => {
		// Ein Punkt «4» mit einem einzigen Unterpunkt «4.1» gliedert nichts.
		const l = gemeinsameListe([GESCHAEFT({ haeuser: [HAUS(1)] })]);
		expect(l).toHaveLength(1);
		expect(l[0].tiefe).toBe(1);
		expect(l[0].traktandumId).toBe('t1');
		expect(l[0].art).toBe('abstimmung');
	});

	it('gliedert auch, wenn nur die Art auseinandergeht', () => {
		// Dasselbe Thema, in einem Haus zur Kenntnis, im anderen zur Abstimmung:
		// Ein gemeinsamer Punkt behauptete, überall werde gleich verfahren.
		const l = gemeinsameListe([
			GESCHAEFT({
				haeuser: [HAUS(1), HAUS(2, { art: 'kenntnisnahme', antragswortlaut: null })]
			})
		]);
		expect(l[0].art).toBe('sammelpunkt');
		expect(l).toHaveLength(3);
	});

	it('gilt als einheitlich, wenn alle Häuser gleich vom Geschäft abweichen', () => {
		// Verglichen werden die Häuser untereinander, nicht gegen das Geschäft: Wer
		// einen Tippfehler in allen Häusern korrigiert, hat weiterhin überall
		// dasselbe stehen — der Punkt darf zugeklappt bleiben.
		const l = gemeinsameListe([
			GESCHAEFT({
				titel: 'Budget 2027',
				haeuser: [
					HAUS(1, { titel: 'Budget 2027 (berichtigt)', abweichend: true }),
					HAUS(2, { titel: 'Budget 2027 (berichtigt)', abweichend: true })
				]
			})
		]);
		expect(l[0].einheitlich).toBe(true);
		// Die Marke bleibt: Der Text steht nicht mehr so da, wie er angelegt wurde.
		expect(l[0].abweichend).toBe(true);
	});

	it('stimmt über den Sammelpunkt nie ab', () => {
		const l = gemeinsameListe([GESCHAEFT()]);
		expect(l[0].art).toBe('sammelpunkt');
		expect(l[0].traktandumId).toBeNull();
		expect(l[0].traktanden).toEqual([]);
		// Die Unterpunkte dagegen schon.
		expect(l[1].art).toBe('abstimmung');
		expect(l[2].art).toBe('abstimmung');
	});

	it('nimmt beim Unterpunkt den Namen der Gemeinschaft als Titel', () => {
		// Der Sachtitel steht schon eine Zeile darüber; ihn zu wiederholen füllte
		// die Liste mit «Budget 2027 · Budget 2027 · Budget 2027».
		const l = gemeinsameListe([GESCHAEFT()]);
		expect(l[1].titel).toBe('Nirgendweg 1');
		expect(l[2].titel).toBe('Nirgendweg 2');
	});

	it('ordnet nach der Stelle, nicht nach dem Titel', () => {
		const l = gemeinsameListe([
			GESCHAEFT({
				geschaeftId: 'z',
				titel: 'Zuletzt',
				stelle: 1,
				haeuser: [HAUS(1, { titel: 'Zuletzt' })]
			}),
			GESCHAEFT({
				geschaeftId: 'a',
				titel: 'Zuerst',
				stelle: 0,
				haeuser: [HAUS(1, { titel: 'Zuerst' })]
			})
		]);
		expect(l.map((z) => z.titel)).toEqual(['Zuerst', 'Zuletzt']);
	});

	it('nimmt bei einer Gemeinschaft den Titel des Traktandums, nicht den des Geschäfts', () => {
		// Er darf abweichen: Sobald jemand das Traktandum in seinem Haus ändert,
		// gilt sein Text — die Liste zeigt, was dort wirklich steht.
		const l = gemeinsameListe([
			GESCHAEFT({ titel: 'Budget 2027', haeuser: [HAUS(1, { titel: 'Budget 2027 mit Lift' })] })
		]);
		expect(l[0].titel).toBe('Budget 2027 mit Lift');
	});

	it('meldet eine Abweichung am Sammelpunkt, wenn ein Haus abweicht', () => {
		const l = gemeinsameListe([
			GESCHAEFT({ haeuser: [HAUS(1), HAUS(2, { abweichend: true, titel: 'Budget 2027 (Lift)' })] })
		]);
		expect(l[0].abweichend).toBe(true);
		expect(l[1].abweichend).toBe(false);
		expect(l[2].abweichend).toBe(true);
	});

	it('kommt mit einer leeren Liste zurecht', () => {
		expect(gemeinsameListe([])).toEqual([]);
	});

	it('kommt mit einem Geschäft ohne Haus zurecht', () => {
		// Möglich, wenn die letzte beteiligte Versammlung aus dem Abend gelöst wurde.
		const l = gemeinsameListe([GESCHAEFT({ haeuser: [] })]);
		expect(l).toHaveLength(1);
		expect(l[0].titel).toBe('Budget 2027');
		expect(l[0].traktanden).toEqual([]);
	});
});

describe('nummernJeTraktandum', () => {
	it('gibt jedem Traktandum die Nummer, unter der es im Saal aufgerufen wird', () => {
		const l = gemeinsameListe([
			GESCHAEFT({ geschaeftId: 'a', titel: 'Begrüssung', stelle: 0, haeuser: [HAUS(9)] }),
			GESCHAEFT({ geschaeftId: 'c', stelle: 1 })
		]);
		const n = nummernJeTraktandum(l);
		expect(n.get('t9')).toBe('1');
		expect(n.get('t1')).toBe('2.1');
		expect(n.get('t2')).toBe('2.2');
	});

	it('gibt jedem Haus seine eigene Ziffer', () => {
		// Ohne das trüge nur ein Haus eine Nummer und die übrigen zählten weiter
		// für sich — der Bruch, den der Screenshot vom 11.08.2026 zeigte.
		const l = gemeinsameListe([
			GESCHAEFT({ titel: 'Begrüssung', haeuser: [HAUS(1), HAUS(2), HAUS(3)] })
		]);
		const n = nummernJeTraktandum(l);
		expect([n.get('t1'), n.get('t2'), n.get('t3')]).toEqual(['1.1', '1.2', '1.3']);
	});

	it('führt den Sammelpunkt nicht — er hat kein Traktandum', () => {
		const n = nummernJeTraktandum(gemeinsameListe([GESCHAEFT()]));
		expect(n.size).toBe(2);
	});
});

describe('fasseZusammen', () => {
	const LOS = (
		id: string,
		meeting: string,
		titel: string,
		stelle: number,
		ueber: Partial<LosesTraktandum> = {}
	): LosesTraktandum => ({
		traktandumId: id,
		meetingId: meeting,
		titel,
		antragswortlaut: null,
		art: 'kenntnisnahme',
		stelle,
		...ueber
	});

	it('macht aus gleichnamigen Traktanden mehrerer Häuser ein Geschäft', () => {
		const { neue: v } = fasseZusammen([
			LOS('a1', 'm1', 'Begrüssung', 1),
			LOS('a2', 'm2', 'Begrüssung', 1),
			LOS('a3', 'm3', 'Begrüssung', 1)
		]);
		expect(v).toHaveLength(1);
		expect(v[0].titel).toBe('Begrüssung');
		expect(v[0].traktandumIds).toEqual(['a1', 'a2', 'a3']);
	});

	it('behält die Reihenfolge der bestehenden Listen', () => {
		const { neue: v } = fasseZusammen([
			LOS('b1', 'm1', 'Budget', 6),
			LOS('a1', 'm1', 'Begrüssung', 1),
			LOS('a2', 'm2', 'Begrüssung', 1),
			LOS('b2', 'm2', 'Budget', 6)
		]);
		expect(v.map((x) => x.titel)).toEqual(['Begrüssung', 'Budget']);
	});

	it('trennt Schreibweisen nicht, die nur in der Grossschreibung abweichen', () => {
		const { neue: v } = fasseZusammen([LOS('a1', 'm1', 'Diverses', 9), LOS('a2', 'm2', 'diverses', 9)]);
		expect(v).toHaveLength(1);
		// Der Titel des ersten gewinnt — er steht in der Liste, die zuerst kam.
		expect(v[0].titel).toBe('Diverses');
	});

	it('steckt zwei gleichnamige Traktanden desselben Hauses in zwei Geschäfte', () => {
		// Ein Geschäft trägt je Gemeinschaft höchstens ein Traktandum. Sonst stünde
		// dieselbe Nummer zweimal auf der Liste desselben Hauses.
		const { neue: v } = fasseZusammen([
			LOS('a1', 'm1', 'Diverses', 9),
			LOS('a2', 'm1', 'Diverses', 10),
			LOS('b1', 'm2', 'Diverses', 9)
		]);
		expect(v).toHaveLength(2);
		expect(v[0].traktandumIds).toEqual(['a1', 'b1']);
		expect(v[1].traktandumIds).toEqual(['a2']);
	});

	it('nimmt Wortlaut und Art aus dem ersten Traktandum der Gruppe', () => {
		const { neue: v } = fasseZusammen([
			LOS('a1', 'm1', 'Budget', 6, { art: 'abstimmung', antragswortlaut: 'CHF 80 000' }),
			LOS('a2', 'm2', 'Budget', 6, { art: 'abstimmung', antragswortlaut: 'CHF 120 000' })
		]);
		expect(v[0].art).toBe('abstimmung');
		expect(v[0].antragswortlaut).toBe('CHF 80 000');
	});

	it('kommt mit nichts zurecht', () => {
		expect(fasseZusammen([])).toEqual({ anschluesse: [], neue: [] });
	});

	it('schliesst an ein bestehendes Geschäft an, statt einen zweiten Punkt zu bilden', () => {
		// Der Fall «eine Gemeinschaft kommt später dazu». Ohne das ergaben drei
		// Häuser mit je acht Pflichttraktanden vierundzwanzig Punkte statt acht.
		const e = fasseZusammen(
			[LOS('neu1', 'm2', 'Begrüssung', 1)],
			[{ geschaeftId: 'g1', titel: 'Begrüssung', besetzt: ['m1'] }]
		);
		expect(e.neue).toEqual([]);
		expect(e.anschluesse).toEqual([{ geschaeftId: 'g1', traktandumIds: ['neu1'] }]);
	});

	it('bildet einen neuen Punkt, wenn das bestehende Geschäft die Versammlung schon führt', () => {
		// Sonst stünde dieselbe Nummer zweimal in derselben Gemeinschaft.
		const e = fasseZusammen(
			[LOS('zweit', 'm1', 'Diverses', 9)],
			[{ geschaeftId: 'g1', titel: 'Diverses', besetzt: ['m1'] }]
		);
		expect(e.anschluesse).toEqual([]);
		expect(e.neue).toHaveLength(1);
	});
});

describe('neueReihenfolge', () => {
	const G = [
		{ geschaeftId: 'a', stelle: 0 },
		{ geschaeftId: 'b', stelle: 1 },
		{ geschaeftId: 'c', stelle: 2 }
	];

	it('schiebt ein Geschäft vor ein anderes', () => {
		expect(neueReihenfolge(G, 'c', 'a').map((x) => x.geschaeftId)).toEqual(['c', 'a', 'b']);
	});

	it('schiebt ans Ende, wenn kein Ziel genannt ist', () => {
		expect(neueReihenfolge(G, 'a', null).map((x) => x.geschaeftId)).toEqual(['b', 'c', 'a']);
	});

	it('vergibt lückenlose Stellen', () => {
		expect(neueReihenfolge(G, 'b', 'a').map((x) => x.stelle)).toEqual([0, 1, 2]);
	});

	it('lässt alles stehen, wenn das bewegte Geschäft nicht dabei ist', () => {
		expect(neueReihenfolge(G, 'weg', 'a').map((x) => x.geschaeftId)).toEqual(['a', 'b', 'c']);
	});

	it('ist gutmütig, wenn das Ziel nicht mehr existiert', () => {
		// Zwei Fenster nebeneinander: Wer im einen zieht, während im anderen
		// gelöscht wurde, soll keine Fehlermeldung bekommen, sondern ans Ende.
		expect(neueReihenfolge(G, 'a', 'weg').map((x) => x.geschaeftId)).toEqual(['b', 'c', 'a']);
	});
});

/**
 * **`punktart` — ob über den Punkt abgestimmt wird** (Auftraggeber, 24.08.2026: «ich
 * habe bei Traktandum 1 auf Abstimmung gedrückt und diese Meldung erhalten»).
 *
 * `art` sagt, wie der Eintrag gebaut ist: Bei zwei Häusern steht dort
 * `'sammelpunkt'`, unabhängig davon, was in den Häusern angekündigt ist. Die
 * Sitzungsleitung prüfte aber `art === 'kenntnisnahme'`, um den Knopf
 * «Abstimmung eröffnen» zu verbergen — und der Vergleich traf am Verbundabend
 * nie zu. Angeboten wurde, was der Server danach zu Recht abwies.
 */
describe('punktart', () => {
	it('meldet Kenntnisnahme, auch wenn zwei Häuser den Punkt führen', () => {
		const l = gemeinsameListe([
			GESCHAEFT({
				art: 'kenntnisnahme',
				haeuser: [
					HAUS(1, { art: 'kenntnisnahme' as const }),
					HAUS(2, { art: 'kenntnisnahme' as const })
				]
			})
		]);
		const punkt = l.find((z) => z.tiefe === 1)!;
		// `art` bleibt, was es war — der Eintrag IST ein Sammelpunkt …
		expect(punkt.art).toBe('sammelpunkt');
		// … und `punktart` sagt, was darunter steht.
		expect(punkt.punktart).toBe('kenntnisnahme');
	});

	it('meldet «gemischt», wenn ein Haus abstimmt und das andere nicht', () => {
		// Der Normalfall am Verbundabend: Die eine Gemeinschaft beschliesst über
		// die Jahresrechnung, die andere nimmt sie zur Kenntnis.
		const l = gemeinsameListe([
			GESCHAEFT({
				haeuser: [
					HAUS(1, { art: 'abstimmung' as const }),
					HAUS(2, { art: 'kenntnisnahme' as const })
				]
			})
		]);
		expect(l.find((z) => z.tiefe === 1)!.punktart).toBe('gemischt');
	});

	it('trägt bei den Unterpunkten die Art ihres eigenen Hauses', () => {
		const l = gemeinsameListe([
			GESCHAEFT({
				haeuser: [
					HAUS(1, { art: 'abstimmung' as const, abweichend: true }),
					HAUS(2, { art: 'kenntnisnahme' as const, abweichend: true })
				]
			})
		]);
		const unter = l.filter((z) => z.tiefe === 2);
		expect(unter.map((z) => z.punktart)).toEqual(['abstimmung', 'kenntnisnahme']);
	});

	it('fällt ohne Häuser auf die Art des Geschäfts zurück', () => {
		// Ein Geschäft ohne Traktanden ist noch nicht aufgeteilt; dann ist seine
		// eigene Art die einzige Auskunft, die es gibt.
		const l = gemeinsameListe([GESCHAEFT({ art: 'kenntnisnahme', haeuser: [] })]);
		expect(l[0].punktart).toBe('kenntnisnahme');
	});
});

describe('ablegepunkt', () => {
	const liste = ['a', 'b', 'c'];

	it('setzt nach vorne', () => {
		// c auf Stelle 1 heisst: vor a — daraus wird c, a, b.
		expect(ablegepunkt(liste, 'c', 1)).toBe('a');
	});

	it('setzt nach hinten', () => {
		// a auf Stelle 3 heisst: ans Ende. Ohne a bleibt b, c — Stelle 3 gibt es
		// dort nicht mehr, und das ist genau der Fall, in dem eine zweite Fassung
		// dieser Rechnung danebenläge.
		expect(ablegepunkt(liste, 'a', 3)).toBeNull();
	});

	it('setzt in die Mitte', () => {
		expect(ablegepunkt(liste, 'a', 2)).toBe('c');
	});

	it('nimmt eine zu grosse Zahl als «ans Ende»', () => {
		expect(ablegepunkt(liste, 'b', 99)).toBeNull();
	});

	it('nimmt eine zu kleine Zahl als «ganz nach vorne»', () => {
		expect(ablegepunkt(liste, 'c', 0)).toBe('a');
		expect(ablegepunkt(liste, 'c', -5)).toBe('a');
	});
});

/**
 * **Die Abfolge, in der ein Abend geführt wird** (Auftraggeber, 24.08.2026): «Wenn
 * Subtraktanden vorhanden sind, muss durch die durch navigiert werden. Eine
 * Ausnahme ist die Beschlussfähigkeit. Dort genügt eine globale Feststellung.»
 */
describe('abendschritte', () => {
	const beschlussfaehigkeit = (titel: string) => titel.includes('Beschlussfähigkeit');

	it('macht aus einem Punkt mit zwei Häusern zwei Schritte', () => {
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit);
		expect(s.map((x) => x.nummer)).toEqual(['1.1', '1.2']);
		// Der Titel des PUNKTES, nicht der der Unterzeile: Die trägt den Namen der
		// Gemeinschaft, und der sagt nicht, worüber gesprochen wird.
		expect(s.map((x) => x.titel)).toEqual(['Budget 2027', 'Budget 2027']);
		expect(s.map((x) => x.gemeinschaft)).toEqual(['Nirgendweg 1', 'Nirgendweg 2']);
		// Jeder Schritt spricht genau ein Traktandum an — dort wird abgestimmt.
		expect(s.map((x) => x.traktandumId)).toEqual(['t1', 't2']);
	});

	it('lässt die Beschlussfähigkeit ein Schritt über alle Häuser bleiben', () => {
		const s = abendschritte(
			gemeinsameListe([
				GESCHAEFT({
					titel: 'Begrüssung und Feststellung der Beschlussfähigkeit',
					art: 'kenntnisnahme',
					haeuser: [
						HAUS(1, { art: 'kenntnisnahme' as const }),
						HAUS(2, { art: 'kenntnisnahme' as const })
					]
				})
			]),
			beschlussfaehigkeit
		);
		expect(s).toHaveLength(1);
		expect(s[0].nummer).toBe('1');
		// Null heisst: alle Häuser zugleich. Eine Feststellung für den Saal
		// siebenmal zu wiederholen wäre keine Sorgfalt, sondern Zeitverlust.
		expect(s[0].traktandumId).toBeNull();
		expect(s[0].traktanden.map((t) => t.traktandumId)).toEqual(['t1', 't2']);
	});

	/*
	 * **Der Titel allein macht keinen gemeinsamen Schritt** (Produktentscheid
	 * 25.09.2026: kein Abstimmungsschritt über mehrere Häuser). Vorher lief diese
	 * Wahl als ein Schritt über alle Häuser: ohne Vorschau, ohne Sperre am Knopf,
	 * und ein Haus, das abwies, stand nur im grünen Hinweis.
	 */
	it('führt eine Abstimmung mit «Beschlussfähigkeit» im Titel je Haus', () => {
		const titel = 'Feststellung der Beschlussfähigkeit und Wahl des Protokollführers';
		const s = abendschritte(
			gemeinsameListe([GESCHAEFT({ titel, haeuser: [HAUS(1, { titel }), HAUS(2, { titel })] })]),
			beschlussfaehigkeit
		);
		expect(s.map((x) => x.nummer)).toEqual(['1.1', '1.2']);
		expect(s.map((x) => x.traktandumId)).toEqual(['t1', 't2']);
		// Der Titel des Punktes bleibt: Daran hängen «Beschlussfähigkeit
		// festhalten» und die grossen Balken der Saalansicht.
		expect(s.every((x) => beschlussfaehigkeit(x.titel))).toBe(true);
	});

	it('führt einen gemischten Punkt mit «Beschlussfähigkeit» im Titel je Haus', () => {
		// Ein Haus nimmt zur Kenntnis, das andere stimmt ab: Das abstimmende
		// braucht seinen eigenen Schritt, sonst fehlen ihm Vorschau und Sperre.
		const titel = 'Feststellung der Beschlussfähigkeit und Wahl des Protokollführers';
		const s = abendschritte(
			gemeinsameListe([
				GESCHAEFT({
					titel,
					haeuser: [
						HAUS(1, { titel, art: 'kenntnisnahme' as const }),
						HAUS(2, { titel })
					]
				})
			]),
			beschlussfaehigkeit
		);
		expect(s.map((x) => x.traktandumId)).toEqual(['t1', 't2']);
		expect(s.map((x) => x.punktart)).toEqual(['kenntnisnahme', 'abstimmung']);
	});

	it('macht aus einem Punkt mit einem Haus einen Schritt', () => {
		const s = abendschritte(
			gemeinsameListe([GESCHAEFT({ haeuser: [HAUS(1)] })]),
			beschlussfaehigkeit
		);
		expect(s).toHaveLength(1);
		expect(s[0].nummer).toBe('1');
		expect(s[0].traktandumId).toBe('t1');
	});

	it('behält die Reihenfolge des Abends über mehrere Punkte', () => {
		const s = abendschritte(
			gemeinsameListe([
				GESCHAEFT({ geschaeftId: 'a', titel: 'Begrüssung', stelle: 0, haeuser: [HAUS(1)] }),
				GESCHAEFT({ geschaeftId: 'b', stelle: 1 })
			]),
			beschlussfaehigkeit
		);
		expect(s.map((x) => x.nummer)).toEqual(['1', '2.1', '2.2']);
	});
});

/*
 * **Die angehängten Anträge am Abend** (25.09.2026): Rückkommensantrag und im
 * Saal aufgenommener Folgeantrag. Sie stehen nicht in der gemeinsamen Liste,
 * weil sie erst im Saal entstehen und kein Geschäft tragen. Ohne eigenen
 * Schritt fand der Dreischritt einen aufgerufenen Antrag nicht, und der Abend
 * wies seinen Aufruf ab. Der Kern unterscheidet die beiden Arten nicht: Beim
 * Rückkommensantrag zeigt das Ziel auf `reconsiders_item_id`, beim Folgeantrag
 * auf `parent_id`; welcher Antrag als angehängter gilt, entscheidet
 * `holeAbendantraege` (`src/lib/server/abendsteuerung.ts`).
 */
describe('abendschritte mit angehängten Anträgen', () => {
	const beschlussfaehigkeit = (titel: string) => titel.includes('Beschlussfähigkeit');
	const ANTRAG = (id: string, zielId: string, ueber: Partial<Abendantrag> = {}): Abendantrag => ({
		traktandumId: id,
		meetingId: 'm1',
		gemeinschaft: 'Probehaus Erfunden 1',
		zielId,
		nummer: '1.1.1',
		titel: 'Rückkommen auf 1.1 Budget 2027',
		antragswortlaut: 'Der Beschluss wird aufgehoben.',
		art: 'abstimmung',
		...ueber
	});

	it('setzt den Antrag direkt vor sein Ziel, mit dem Geschäft des Ziels', () => {
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit, [
			ANTRAG('r1', 't1')
		]);
		expect(s.map((x) => x.nummer)).toEqual(['1.1.1', '1.1', '1.2']);
		const antrag = s[0];
		// Über das Geschäft des Ziels ruft der Abend auf, eröffnet und schliesst.
		expect(antrag.geschaeftId).toBe('g1');
		expect(antrag.traktandumId).toBe('r1');
		expect(antrag.traktanden).toEqual([
			{ traktandumId: 'r1', meetingId: 'm1', gemeinschaft: 'Probehaus Erfunden 1' }
		]);
		// Der eigene Titel, nicht der des Punktes: «Budget 2027» wäre die falsche Frage.
		expect(antrag.titel).toBe('Rückkommen auf 1.1 Budget 2027');
		expect(antrag.punktart).toBe('abstimmung');
	});

	it('führt nach dem Antrag mit «nachher» in den zweiten Durchgang', () => {
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit, [
			ANTRAG('r1', 't1')
		]);
		const stelle = laufendeStelle(s, [
			{ traktandumId: 'r1', seit: '2026-09-25T19:10:00Z' },
			{ traktandumId: 't2', seit: '2026-09-25T19:00:00Z' }
		]);
		expect(s[stelle].traktandumId).toBe('r1');
		expect(s[stelle + 1].traktandumId).toBe('t1');
	});

	it('stellt mehrere Anträge auf dasselbe Ziel in der Reihenfolge der Aufnahme', () => {
		// Der erste wurde abgelehnt, der zweite läuft: Der jüngste steht direkt
		// vor dem Ziel, sonst führte «nachher» auf den erledigten.
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit, [
			ANTRAG('r1', 't1', { nummer: '1.1.1' }),
			ANTRAG('r2', 't1', { nummer: '1.1.2' })
		]);
		expect(s.map((x) => x.nummer)).toEqual(['1.1.1', '1.1.2', '1.1', '1.2']);
	});

	it('setzt einen Antrag auf einen Antrag vor diesen', () => {
		// r2 kommt auf den angenommenen r1 zurück: erst r2, dann r1 neu, dann das Budget.
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit, [
			ANTRAG('r1', 't1', { nummer: '1.1.1' }),
			ANTRAG('r2', 'r1', { nummer: '1.1.1.1' })
		]);
		expect(s.map((x) => x.nummer)).toEqual(['1.1.1.1', '1.1.1', '1.1', '1.2']);
		expect(s[0].geschaeftId).toBe('g1');
	});

	it('lässt einen Antrag weg, dessen Ziel in keinem Schritt steht', () => {
		const s = abendschritte(gemeinsameListe([GESCHAEFT()]), beschlussfaehigkeit, [
			ANTRAG('r1', 'fremd')
		]);
		expect(s.map((x) => x.traktandumId)).toEqual(['t1', 't2']);
	});
});

/*
 * **Die Bindung ans Geschäft** (`zieleDesPunktes`): Aus den Traktanden eines
 * Geschäfts kommen genau die Anträge dazu, die über ihr Ziel dazugehören.
 */
describe('angehaengteAntraege', () => {
	const A = (id: string, zielId: string): Abendantrag => ({
		traktandumId: id,
		meetingId: 'm1',
		gemeinschaft: 'Probehaus Erfunden 1',
		zielId,
		nummer: '1.1.1',
		titel: 'Rückkommen',
		antragswortlaut: null,
		art: 'abstimmung'
	});

	it('nimmt nur Anträge, deren Ziel in der Menge liegt', () => {
		expect(angehaengteAntraege(['t1'], [A('r1', 't1'), A('r2', 't9')]).map((a) => a.traktandumId)).toEqual(['r1']);
	});

	it('nimmt einen Antrag auf einen Antrag mit', () => {
		// Wer auf den Antrag zurückkommt, steht vor ihm, wie der Antrag vor seinem Ziel.
		expect(
			angehaengteAntraege(['t1'], [A('r2', 'r1'), A('r1', 't1')]).map((a) => a.traktandumId)
		).toEqual(['r2', 'r1']);
	});

	it('bleibt bei einem Kreis endlich', () => {
		// In der Datenbank nicht möglich; die Rechnung soll trotzdem nicht hängen.
		expect(
			angehaengteAntraege(['t1'], [A('r1', 't1'), A('t1', 'r1')]).map((a) => a.traktandumId)
		).toEqual(['r1']);
	});

	it('liefert ohne Ziele nichts', () => {
		expect(angehaengteAntraege([], [A('r1', 't1')])).toEqual([]);
	});
});

/*
 * **Welche Knoten am Abend als angehängter Antrag gelten** (Nachprüfung
 * 25.09.2026: Die Abgrenzung hatte keine Probe). Ohne sie stünde ein
 * angekündigter Unterpunkt als eigener Schritt vor seinem Elternteil.
 */
describe('zielDesAntrags', () => {
	it('nimmt beim Rückkommensantrag das Ziel', () => {
		expect(zielDesAntrags({ parentId: 't1', rueckkommenZielId: 't1' })).toBe('t1');
	});

	it('nimmt beim im Saal aufgenommenen Folgeantrag den Grundantrag', () => {
		expect(zielDesAntrags({ spontan: true, spontanart: 'folgeantrag', parentId: 't1' })).toBe('t1');
	});

	it('lässt einen angekündigten Unterpunkt weg', () => {
		expect(zielDesAntrags({ spontan: false, spontanart: null, parentId: 't1' })).toBeNull();
		expect(zielDesAntrags({ parentId: 't1' })).toBeNull();
	});

	it('lässt einen sachfremd aufgenommenen Punkt weg', () => {
		expect(zielDesAntrags({ spontan: true, spontanart: 'neu', parentId: null })).toBeNull();
		// Auch wenn er einmal einen Elternteil trüge: sachfremd bleibt sachfremd.
		expect(zielDesAntrags({ spontan: true, spontanart: 'neu', parentId: 't1' })).toBeNull();
	});

	it('lässt einen Folgeantrag ohne Grundantrag weg', () => {
		expect(zielDesAntrags({ spontan: true, spontanart: 'folgeantrag', parentId: null })).toBeNull();
	});
});
