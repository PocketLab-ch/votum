import { describe, expect, it } from 'vitest';
import {
	STAMMQUOTE,
	aendereEinheit,
	legeEinheitAn,
	pruefeEinheit,
	pruefeQuotenart,
	pruefeSalden,
	einheitenluecke,
	ohneEigeneQuote,
	pruefeVerteilerLoeschen,
	saldoText,
	zuordnungsluecke,
	type Ebene,
	type EinheitEingabe,
	type QuotenartEingabe,
	leseEinheitenzeilen
} from '$lib/domain/einheiten';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const STAMM: QuotenartEingabe = {
	stwegId: 's1',
	key: 'stamm',
	name: 'Stammquote',
	denominator: 1000,
	isPrimary: true,
	sortOrder: 0
};

const LIFT: QuotenartEingabe = {
	stwegId: 's1',
	key: 'lift',
	name: 'Aufzug',
	denominator: 100,
	isPrimary: false,
	sortOrder: 1
};

const ARTEN = [STAMM, LIFT];

const GRUNDFALL: EinheitEingabe = {
	stwegId: 's1',
	kind: 'unit',
	label: '3.1 Wohnung rechts',
	quotas: { stamm: 85, lift: 10 },
	countsAsHead: true
};

function mit(aenderung: Partial<EinheitEingabe>): EinheitEingabe {
	return { ...GRUNDFALL, ...aenderung };
}

describe('pruefeQuotenart', () => {
	it('nimmt die Stammquote an', () => {
		expect(pruefeQuotenart(STAMM).key).toBe('stamm');
	});

	it('nimmt einen zusätzlichen Verteiler mit eigenem Nenner an', () => {
		// Reglemente rechnen den Aufzug oft in Hundertsteln, die Stammquote in
		// Tausendsteln. Beide Nenner müssen nebeneinander bestehen können.
		expect(pruefeQuotenart(LIFT).denominator).toBe(100);
	});

	it('vereinheitlicht den Schlüssel auf Kleinbuchstaben', () => {
		expect(pruefeQuotenart({ ...LIFT, key: '  Lift  ' }).key).toBe('lift');
	});

	it('weist einen Schlüssel mit Leerzeichen ab', () => {
		expect(() => pruefeQuotenart({ ...LIFT, key: 'heizung warm' })).toThrow(/Schlüssel/);
	});

	it('weist einen Nenner null ab', () => {
		// Anders als bei der Gemeinschaft gibt es hier keine blosse Klammer: Eine
		// Quotenart ohne Nenner hätte nichts, wogegen sie prüfen könnte.
		expect(() => pruefeQuotenart({ ...LIFT, denominator: 0 })).toThrow(/grösser als null/);
	});

	it('hält den Schlüssel der Stammquote fest', () => {
		// Hiesse sie in einer Gemeinschaft «stamm» und in der nächsten «wq», fände
		// die Auszählung sie nicht mehr.
		expect(() => pruefeQuotenart({ ...STAMM, key: 'wq' })).toThrow(/Stammquote/);
	});

	it('lässt den Schlüssel «stamm» nicht für einen Nebenverteiler zu', () => {
		expect(() => pruefeQuotenart({ ...LIFT, key: 'stamm' })).toThrow(/vorbehalten/);
	});

	it('hält den festen Schlüssel als Konstante bereit', () => {
		expect(STAMMQUOTE).toBe('stamm');
	});
});

describe('pruefeVerteilerLoeschen', () => {
	const AUFZUG = { name: 'Aufzug', isPrimary: false };

	it('lässt einen ungenutzten Verteiler ohne Rückfrage weg', () => {
		// Der häufigste Fall: eben angelegt, vertippt, wieder weg. Eine Rückfrage
		// ohne Verlust wäre eine Rückfrage, die man wegklickt — und damit eine, die
		// beim nächsten Mal auch beim echten Verlust weggeklickt wird.
		expect(pruefeVerteilerLoeschen(AUFZUG, 0, false).rueckfrage).toBeNull();
	});

	it('fragt mit der Zahl der betroffenen Einheiten', () => {
		expect(pruefeVerteilerLoeschen(AUFZUG, 7, false).rueckfrage).toEqual({ betroffen: 7 });
	});

	it('löscht nach der Bestätigung', () => {
		expect(pruefeVerteilerLoeschen(AUFZUG, 7, true).rueckfrage).toBeNull();
	});

	it('schützt die Stammquote', () => {
		// Sie wird vom Nenner der Gemeinschaft geführt, jede Einheit braucht sie,
		// und ohne sie wäre jede Auszählung nach Wertquoten ohne Grundlage.
		expect(() => pruefeVerteilerLoeschen({ name: 'Stammquote', isPrimary: true }, 0, false)).toThrow(
			/Stimmrecht/
		);
	});

	it('schützt die Stammquote auch mit Bestätigung', () => {
		expect(() => pruefeVerteilerLoeschen({ name: 'Stammquote', isPrimary: true }, 0, true)).toThrow(
			FachlicherFehler
		);
	});

	it('nennt in der Absage den Weg zum Nenner', () => {
		// Eine Absage ohne Ausweg ist eine Sackgasse — dann ändert jemand den
		// Nenner, indem er die Gemeinschaft neu anlegt.
		expect(() => pruefeVerteilerLoeschen({ name: 'Stammquote', isPrimary: true }, 0, false)).toThrow(
			/Angaben der Gemeinschaft/
		);
	});
});

describe('pruefeEinheit', () => {
	it('nimmt den Grundfall mit zwei Quoten an', () => {
		const e = pruefeEinheit(GRUNDFALL, ARTEN);
		expect(e.quotas).toEqual({ stamm: 85, lift: 10 });
	});

	it('lässt eine Einheit ohne Beteiligung am Nebenverteiler zu', () => {
		// Die Erdgeschosswohnung zahlt nicht an den Aufzug. Ein fehlender Schlüssel
		// ist ausdrücklich etwas anderes als der Wert null.
		const e = pruefeEinheit(mit({ quotas: { stamm: 85 } }), ARTEN);
		expect(e.quotas).toEqual({ stamm: 85 });
		expect('lift' in e.quotas).toBe(false);
	});

	it('unterscheidet Nichtbeteiligung von einer Beteiligung mit null', () => {
		const ohne = pruefeEinheit(mit({ quotas: { stamm: 85 } }), ARTEN);
		const mitNull = pruefeEinheit(mit({ quotas: { stamm: 85, lift: 0 } }), ARTEN);
		expect('lift' in ohne.quotas).toBe(false);
		expect(mitNull.quotas.lift).toBe(0);
	});

	it('weist eine unbekannte Quotenart ab', () => {
		// Sonst ginge ein Tippfehler im Schlüssel durch, und die Einheit fehlte bei
		// der Saldoprüfung dieser Art, ohne dass es auffiele.
		expect(() => pruefeEinheit(mit({ quotas: { stamm: 85, lif: 10 } }), ARTEN)).toThrow(
			/keine Quotenart/
		);
	});

	it('verlangt eine Stammquote', () => {
		// Eine Einheit ohne Stammquote gäbe es im Grundbuch nicht — sie verschwände
		// stillschweigend aus jeder Zählung nach Wertquoten.
		expect(() => pruefeEinheit(mit({ quotas: { lift: 10 } }), ARTEN)).toThrow(/Stammquote/);
	});

	it('weist eine Quote mit Nachkommastellen ab und nennt den Schlüssel', () => {
		expect(() => pruefeEinheit(mit({ quotas: { stamm: 85.5 } }), ARTEN)).toThrow(
			/«stamm».*ganze Zahl/
		);
	});

	/*
	 * **Die Absage nennt den Weg** (Ä-10, Produktentscheid 18.10.2026,
	 * `docs/entscheide/0008`): Wertquoten bleiben ganzzahlig, also muss die
	 * Meldung sagen, wie man 123,5 Tausendstel trotzdem einträgt.
	 */
	it('nennt bei einer Stammquote mit Nachkommastellen den Weg über einen grösseren Nenner', () => {
		expect(() => pruefeEinheit(mit({ quotas: { stamm: 123.5 } }), ARTEN)).toThrow(
			/1235 von 10 000/
		);
	});

	it('nennt den Weg nicht bei einem Verteiler: Dessen Nenner ändert «Angaben» nicht', () => {
		expect(() => pruefeEinheit(mit({ quotas: { stamm: 85, lift: 10.5 } }), ARTEN)).toThrow(
			/^(?!.*Vergrössern).*ganze Zahl/
		);
	});

	it('nennt den Weg nicht bei Text (NaN), nur bei einer Nachkommastelle', () => {
		// `quoteAusEingabe` macht aus Text NaN; «Nenner vergrössern» wäre dort falsch.
		expect(() => pruefeEinheit(mit({ quotas: { stamm: Number.NaN } }), ARTEN)).toThrow(
			/^(?!.*Vergrössern).*ganze Zahl/
		);
	});

	it('nennt den Weg nicht bei einer negativen Kommazahl', () => {
		expect(() => pruefeEinheit(mit({ quotas: { stamm: -0.5 } }), ARTEN)).toThrow(
			/^(?!.*Vergrössern).*ganze Zahl/
		);
	});

	it('weist eine negative Quote ab', () => {
		expect(() => pruefeEinheit(mit({ quotas: { stamm: 85, lift: -1 } }), ARTEN)).toThrow(
			/«lift».*negativ/
		);
	});

	it('weist eine fehlende Bezeichnung ab', () => {
		expect(() => pruefeEinheit(mit({ label: '  ' }), ARTEN)).toThrow(FachlicherFehler);
	});

	it('weist eine unbekannte Einheitsart ab', () => {
		expect(() => pruefeEinheit(mit({ kind: 'garten' as never }), ARTEN)).toThrow(/Unbekannte Art/);
	});
});

describe('legeEinheitAn', () => {
	it('führt alle Quoten im Verlaufseintrag', () => {
		const u = legeEinheitAn('u1', GRUNDFALL, ARTEN);
		expect(u.ergebnis.id).toBe('u1');
		expect(u.ereignisse[0].art).toBe('unit.created');
		expect(u.ereignisse[0].angaben?.quoten).toEqual({ stamm: 85, lift: 10 });
	});
});

describe('aendereEinheit', () => {
	const bisher = legeEinheitAn('u1', GRUNDFALL, ARTEN).ergebnis;

	it('hält je Quotenart vorher und nachher fest', () => {
		// «Die Quoten haben sich geändert» wäre im Streitfall wertlos. Welche, von
		// wie viel auf wie viel — das ist die Frage.
		const u = aendereEinheit(bisher, mit({ quotas: { stamm: 90, lift: 10 } }), ARTEN);
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(felder['quote.stamm']).toEqual({ vorher: 85, nachher: 90 });
		expect(felder['quote.lift']).toBeUndefined();
	});

	it('hält das Ausscheiden aus einem Verteiler fest', () => {
		const u = aendereEinheit(bisher, mit({ quotas: { stamm: 85 } }), ARTEN);
		const felder = u.ereignisse[0].angaben?.felder as Record<string, unknown>;
		expect(felder['quote.lift']).toEqual({ vorher: 10, nachher: null });
	});

	it('erzeugt kein Ereignis ohne Änderung', () => {
		expect(aendereEinheit(bisher, GRUNDFALL, ARTEN).ereignisse).toHaveLength(0);
	});
});

describe('pruefeSalden', () => {
	const einfach: Ebene[] = [
		{
			id: 's1',
			name: 'Musterweg 3',
			parentStwegId: null,
			quotenarten: [
				{ key: 'stamm', name: 'Stammquote', denominator: 1000, isPrimary: true },
				{ key: 'lift', name: 'Aufzug', denominator: 100, isPrimary: false }
			]
		}
	];

	it('prüft jede Quotenart für sich', () => {
		const e = pruefeSalden(einfach, [
			{ stwegId: 's1', quotas: { stamm: 400, lift: 50 } },
			{ stwegId: 's1', quotas: { stamm: 600, lift: 50 } }
		]);
		expect(e.stimmig).toBe(true);
		expect(e.zeilen).toHaveLength(2);
	});

	it('meldet eine Lücke beim Nebenverteiler, ohne die Stammquote zu belasten', () => {
		// Wichtig für die Bedienung: Die Stammquote geht auf, also ist abstimmbar;
		// der Aufzugsverteiler klemmt, also ist er vor der nächsten Abrechnung zu
		// bereinigen. Beides gleichzeitig, aber getrennt beurteilt.
		const e = pruefeSalden(einfach, [
			{ stwegId: 's1', quotas: { stamm: 400, lift: 50 } },
			{ stwegId: 's1', quotas: { stamm: 600, lift: 40 } }
		]);
		expect(e.stimmig).toBe(false);
		expect(e.stammquotenStimmig).toBe(true);

		const lift = e.zeilen.find((z) => z.quotenart === 'lift')!;
		expect(lift.abweichung).toBe(10);
		expect(e.zeilen.find((z) => z.quotenart === 'stamm')!.abweichung).toBe(0);
	});

	it('meldet die Abweichung der Stammquote mit Ebene und Betrag', () => {
		const e = pruefeSalden(einfach, [
			{ stwegId: 's1', quotas: { stamm: 400, lift: 50 } },
			{ stwegId: 's1', quotas: { stamm: 598, lift: 50 } }
		]);
		const stamm = e.zeilen.find((z) => z.quotenart === 'stamm')!;
		expect(stamm.abweichung).toBe(2);
		expect(stamm.stwegName).toBe('Musterweg 3');
		expect(e.stammquotenStimmig).toBe(false);
	});

	it('erkennt auch ein Zuviel', () => {
		const e = pruefeSalden(einfach, [{ stwegId: 's1', quotas: { stamm: 1002, lift: 100 } }]);
		expect(e.zeilen.find((z) => z.quotenart === 'stamm')!.abweichung).toBe(-2);
	});

	it('zählt Nebenobjekte bei der Wertquote mit', () => {
		// Ihre Kennzeichnung wirkt nur auf die Kopfzählung. Schlüge sie hier durch,
		// ergäbe die Summe der Wertquoten nie den Nenner.
		const e = pruefeSalden(einfach, [
			{ stwegId: 's1', quotas: { stamm: 950, lift: 100 } },
			{ stwegId: 's1', quotas: { stamm: 50 } }
		]);
		expect(e.stammquotenStimmig).toBe(true);
	});

	it('überspringt eine Ebene ohne Quotenarten', () => {
		const mehrhaus: Ebene[] = [
			{ id: 'dach', name: 'Überbauung', parentStwegId: null, quotenarten: [] },
			{
				id: 'a',
				name: 'Haus A',
				parentStwegId: 'dach',
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 500, isPrimary: true }]
			},
			{
				id: 'b',
				name: 'Haus B',
				parentStwegId: 'dach',
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 500, isPrimary: true }]
			}
		];
		const e = pruefeSalden(mehrhaus, [
			{ stwegId: 'a', quotas: { stamm: 500 } },
			{ stwegId: 'b', quotas: { stamm: 500 } }
		]);
		// Die Dachgemeinschaft taucht gar nicht erst auf: Sie ist eine blosse
		// Klammer, und als Sollebene gewertet ergäbe sie eine Abweichung von 1000.
		expect(e.zeilen.map((z) => z.stwegName)).toEqual(['Haus A', 'Haus B']);
		expect(e.stimmig).toBe(true);
	});

	it('rechnet die Untergemeinschaften auf einer Dachebene mit eigener Quote an', () => {
		const gemischt: Ebene[] = [
			{
				id: 'dach',
				name: 'Überbauung',
				parentStwegId: null,
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 1000, isPrimary: true }]
			},
			{
				id: 'a',
				name: 'Haus A',
				parentStwegId: 'dach',
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 600, isPrimary: true }]
			},
			{
				id: 'b',
				name: 'Haus B',
				parentStwegId: 'dach',
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 400, isPrimary: true }]
			}
		];
		const e = pruefeSalden(gemischt, [
			{ stwegId: 'a', quotas: { stamm: 600 } },
			{ stwegId: 'b', quotas: { stamm: 400 } }
		]);
		const dach = e.zeilen.find((z) => z.stwegName === 'Überbauung')!;
		expect(dach.summeUntergemeinschaften).toBe(1000);
		expect(dach.abweichung).toBe(0);
		expect(e.stimmig).toBe(true);
	});

	it('rechnet einen Verteiler nur an, wenn die obere Ebene ihn auch führt', () => {
		// Führt Haus A einen Aufzugsverteiler und die Dachgemeinschaft nicht, hat er
		// dort oben kein Gegenstück. Würde er trotzdem angerechnet, ergäbe die
		// Stammquote der Dachebene eine Abweichung, die es nicht gibt.
		const gemischt: Ebene[] = [
			{
				id: 'dach',
				name: 'Überbauung',
				parentStwegId: null,
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 1000, isPrimary: true }]
			},
			{
				id: 'a',
				name: 'Haus A',
				parentStwegId: 'dach',
				quotenarten: [
					{ key: 'stamm', name: 'Stammquote', denominator: 1000, isPrimary: true },
					{ key: 'lift', name: 'Aufzug', denominator: 100, isPrimary: false }
				]
			}
		];
		const e = pruefeSalden(gemischt, [{ stwegId: 'a', quotas: { stamm: 1000, lift: 100 } }]);
		const dach = e.zeilen.find((z) => z.stwegName === 'Überbauung')!;
		expect(dach.summeUntergemeinschaften).toBe(1000);
		expect(dach.abweichung).toBe(0);
		// Auf der Dachebene gibt es keine Zeile für den Aufzug.
		expect(e.zeilen.filter((z) => z.quotenart === 'lift')).toHaveLength(1);
		expect(e.stimmig).toBe(true);
	});

	it('erlaubt einer Dachebene eigene Einheiten neben Untergemeinschaften', () => {
		// Kommt vor: Die Tiefgarage gehört der Dachgemeinschaft, die Wohnungen den
		// Häusern.
		const gemischt: Ebene[] = [
			{
				id: 'dach',
				name: 'Überbauung',
				parentStwegId: null,
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 1000, isPrimary: true }]
			},
			{
				id: 'a',
				name: 'Haus A',
				parentStwegId: 'dach',
				quotenarten: [{ key: 'stamm', name: 'Stammquote', denominator: 900, isPrimary: true }]
			}
		];
		const e = pruefeSalden(gemischt, [
			{ stwegId: 'a', quotas: { stamm: 900 } },
			{ stwegId: 'dach', quotas: { stamm: 100 } }
		]);
		const dach = e.zeilen.find((z) => z.stwegName === 'Überbauung')!;
		expect(dach.summeUntergemeinschaften).toBe(900);
		expect(dach.summeEinheiten).toBe(100);
		expect(dach.abweichung).toBe(0);
	});

	it('meldet eine leere Gemeinschaft als noch nicht aufgehend', () => {
		const e = pruefeSalden(einfach, []);
		expect(e.zeilen.find((z) => z.quotenart === 'stamm')!.abweichung).toBe(1000);
		expect(e.stimmig).toBe(false);
	});

	it('ist stimmig, wenn es gar keine Quotenart gibt', () => {
		const nurKlammer: Ebene[] = [
			{ id: 'dach', name: 'Überbauung', parentStwegId: null, quotenarten: [] }
		];
		expect(pruefeSalden(nurKlammer, []).stimmig).toBe(true);
	});

	it('ignoriert Einheiten einer fremden Ebene', () => {
		const e = pruefeSalden(einfach, [
			{ stwegId: 's1', quotas: { stamm: 1000, lift: 100 } },
			{ stwegId: 'fremd', quotas: { stamm: 500 } }
		]);
		expect(e.stimmig).toBe(true);
	});
});

describe('saldoText', () => {
	const zeile = {
		stwegId: 's1',
		stwegName: 'Musterweg 3',
		quotenart: 'stamm',
		quotenartName: 'Stammquote',
		istStammquote: true,
		soll: 1000,
		summeEinheiten: 998,
		summeUntergemeinschaften: 0,
		abweichung: 2,
		anzahlEinheiten: 12
	};

	it('sagt bei einer Lücke, wie viel fehlt und wo', () => {
		expect(saldoText(zeile)).toBe(
			'Musterweg 3, Stammquote: 2 fehlen (erfasst 998 von 1000).'
		);
	});

	it('sagt bei einem Zuviel, dass es zu viel ist', () => {
		expect(saldoText({ ...zeile, summeEinheiten: 1002, abweichung: -2 })).toBe(
			'Musterweg 3, Stammquote: 2 zu viel (erfasst 1002 von 1000).'
		);
	});

	it('bestätigt, wenn es aufgeht', () => {
		expect(saldoText({ ...zeile, summeEinheiten: 1000, abweichung: 0 })).toBe(
			'Musterweg 3, Stammquote: 1000 von 1000 — geht auf.'
		);
	});

	it('nennt den Verteiler beim Namen', () => {
		expect(
			saldoText({
				...zeile,
				quotenart: 'lift',
				quotenartName: 'Aufzug',
				istStammquote: false,
				soll: 100,
				summeEinheiten: 90,
				abweichung: 10
			})
		).toBe('Musterweg 3, Aufzug: 10 fehlen (erfasst 90 von 100).');
	});
});

describe('Was an den Stammdaten fehlt', () => {
	/**
	 * Gemeldet am 12.08.2026: «Bei Eigentümer und Zuordnung und auch Einheiten
	 * und Wertquoten mit einem Icon kennzeichnen, wenn die Zuordnungen nicht
	 * vollständig ist.»
	 */
	it('meldet nichts, wo alles steht', () => {
		// Ein Satz «alles in Ordnung» an jeder Zeile wäre Lärm.
		expect(einheitenluecke({ einheiten: 14, stammquotenStimmig: true })).toBeNull();
		expect(zuordnungsluecke({ einheiten: 14, ohneEigentuemer: 0 })).toBeNull();
	});

	it('nennt die leere Gemeinschaft vor dem Saldo', () => {
		// «Wertquoten gehen nicht auf» wäre bei null Einheiten richtig und
		// nutzlos — es fehlt ja alles.
		expect(einheitenluecke({ einheiten: 0, stammquotenStimmig: false })).toMatch(/keine Einheit/);
	});

	it('meldet einen offenen Saldo', () => {
		expect(einheitenluecke({ einheiten: 14, stammquotenStimmig: false })).toMatch(/gehen nicht auf/);
	});

	/**
	 * **Die Klammer ist kein Mangel** (23.08.2026, Prüflauf II, A-20).
	 *
	 * Eine übergeordnete Gemeinschaft führt keine eigenen Einheiten — das ist
	 * ihre Bauform, nicht ihr Zustand. Die Leiste mahnte bei ihr dauerhaft «noch
	 * keine Einheit erfasst», auch wenn beide Häuser darunter sauber auf 1000
	 * aufgehen. Ein Warnzeichen, das nie grün wird, wird bald übersehen — und
	 * dann auch dort, wo es etwas bedeutet.
	 */
	it('schweigt bei einer Gemeinschaft ohne eigene Wertquote', () => {
		expect(
			einheitenluecke({ einheiten: 0, stammquotenStimmig: false, ohneEigeneQuote: true })
		).toBeNull();
	});

	it('mahnt weiterhin, wo eine gewöhnliche Gemeinschaft leer ist', () => {
		// Die Gegenprobe zur Zeile darüber: Ohne das Merkmal bleibt alles beim
		// Alten. Sonst hätte die Weiche die Mahnung überall abgeschaltet.
		expect(
			einheitenluecke({ einheiten: 0, stammquotenStimmig: false, ohneEigeneQuote: false })
		).toMatch(/keine Einheit/);
		expect(einheitenluecke({ einheiten: 0, stammquotenStimmig: false })).toMatch(/keine Einheit/);
	});

	it('erkennt die Klammer am fehlenden Nenner', () => {
		expect(ohneEigeneQuote({ quotaDenominator: 0 })).toBe(true);
		expect(ohneEigeneQuote({ quotaDenominator: 1000 })).toBe(false);
		expect(ohneEigeneQuote({ quotaDenominator: 5 })).toBe(false);
	});

	it('zählt die Einheiten ohne Eigentümer, im Singular wie im Plural', () => {
		expect(zuordnungsluecke({ einheiten: 14, ohneEigentuemer: 1 })).toBe('1 Einheit ohne Eigentümer');
		expect(zuordnungsluecke({ einheiten: 14, ohneEigentuemer: 3 })).toBe(
			'3 Einheiten ohne Eigentümer'
		);
	});

	it('schweigt zur Zuordnung, solange es keine Einheiten gibt', () => {
		// Sonst stünde an einer frisch angelegten Gemeinschaft zweimal dieselbe
		// Lücke: einmal «keine Einheit erfasst», einmal «0 ohne Eigentümer».
		expect(zuordnungsluecke({ einheiten: 0, ohneEigentuemer: 0 })).toBeNull();
	});
});

describe('Mehrere Einheiten aus Zeilen lesen (Befund 29)', () => {
	/*
	 * **Der Anlass**: «Fünf Einheiten sind fünfmal dasselbe Formular; ‹Aus Datei
	 * übernehmen› verlangt je einen Eigentümer und hilft hier nicht.»
	 */
	it('liest Bezeichnung, Stammquote und die drei Merkmale', () => {
		const b = leseEinheitenzeilen(
			'1.1 Wohnung links; 300; 3.5; 87; EG links\n1.2 Wohnung rechts; 250',
			'stweg-1'
		);
		expect(b.fehler).toEqual([]);
		expect(b.einheiten).toHaveLength(2);
		expect(b.einheiten[0]).toMatchObject({
			label: '1.1 Wohnung links',
			quotas: { stamm: 300 },
			zimmer: 3.5,
			flaeche: 87,
			lage: 'EG links',
			kind: 'unit'
		});
		// Ohne Angabe bleibt es leer, nicht null-gleich-nichts-erfasst-nicht.
		expect(b.einheiten[1].zimmer).toBeNull();
		expect(b.einheiten[1].lage).toBeNull();
	});

	it('übergeht Leerzeilen und Überschriften', () => {
		// Wer aus einer Tabelle kopiert, hat die Kopfzeile dabei.
		const b = leseEinheitenzeilen('# Bezeichnung; Quote\n\n  \nWhg 1; 500\n', 'stweg-1');
		expect(b.fehler).toEqual([]);
		expect(b.einheiten).toHaveLength(1);
	});

	it('nimmt das Komma als Dezimaltrennzeichen', () => {
		// Auf einer Schweizer Tastatur tippt man «87,4». Eine Absage dafür wäre
		// eine Falle, keine Prüfung.
		const b = leseEinheitenzeilen('Whg 1; 500; 3,5; 87,4', 'stweg-1');
		expect(b.fehler).toEqual([]);
		expect(b.einheiten[0].zimmer).toBe(3.5);
		expect(b.einheiten[0].flaeche).toBe(87.4);
	});

	/*
	 * **Jede Absage nennt ihre Zeile und ihren Wortlaut.** Bei zwanzig Zeilen
	 * ist «Die Stammquote fehlt» keine Auskunft, sondern eine Suchaufgabe.
	 */
	it('nennt Zeilennummer und Wortlaut', () => {
		const b = leseEinheitenzeilen('Whg 1; 500\nWhg 2\nWhg 3; abc', 'stweg-1');
		expect(b.einheiten).toHaveLength(1);
		expect(b.fehler).toHaveLength(2);
		expect(b.fehler[0]).toMatchObject({ zeile: 2, text: 'Whg 2' });
		expect(b.fehler[0].grund).toMatch(/Stammquote fehlt/);
		expect(b.fehler[1]).toMatchObject({ zeile: 3 });
		expect(b.fehler[1].grund).toMatch(/keine Zahl/);
	});

	it('liest alle Zeilen, auch nach dem ersten Fehler', () => {
		// Wer drei Tippfehler hat, will sie in einem Durchgang sehen.
		const b = leseEinheitenzeilen('a\nb\nc', 'stweg-1');
		expect(b.fehler.map((f) => f.zeile)).toEqual([1, 2, 3]);
	});

	it('weist eine gebrochene Stammquote ab', () => {
		// Rundungsfehler summieren sich in der Auszählung zu einem falschen
		// Beschluss (AD-12).
		const b = leseEinheitenzeilen('Whg 1; 500.5', 'stweg-1');
		expect(b.einheiten).toEqual([]);
		expect(b.fehler[0].grund).toMatch(/ganze Zahl/);
	});

	it('nennt je Zeile mit Nachkommastelle den Weg, mit Komma wie mit Punkt (Ä-10)', () => {
		const b = leseEinheitenzeilen('Whg 1; 123,5\nWhg 2; 876\nWhg 3; 123.5', 'stweg-1');
		expect(b.einheiten.map((e) => e.label)).toEqual(['Whg 2']);
		expect(b.fehler.map((f) => f.zeile)).toEqual([1, 3]);
		for (const f of b.fehler) expect(f.grund).toMatch(/1235 von 10 000/);
	});

	it('nimmt «500,0» weiter als 500 und gibt «-0,5» den richtigen Grund', () => {
		const b = leseEinheitenzeilen('Whg 1; 500,0\nWhg 2; 500,\nWhg 3; -0,5', 'stweg-1');
		expect(b.einheiten.map((e) => e.quotas.stamm)).toEqual([500, 500]);
		expect(b.fehler[0].grund).toMatch(/ganze Zahl/);
		expect(b.fehler[0].grund).not.toMatch(/Vergrössern/);
	});

	it('liest «1,000» nicht als 1 (Komma als Tausendertrenner)', () => {
		const b = leseEinheitenzeilen('Whg 1; 1,000', 'stweg-1');
		expect(b.einheiten).toEqual([]);
		expect(b.fehler[0].grund).toMatch(/keine Zahl/);
	});

	it('weist mehr als fünf Angaben ab', () => {
		const b = leseEinheitenzeilen('Whg 1; 500; 3.5; 87; EG; zuviel', 'stweg-1');
		expect(b.fehler[0].grund).toMatch(/Mehr als fünf/);
	});

	it('nimmt auch Tabulatoren als Trenner', () => {
		// Wer aus Excel, Numbers oder Google Tabellen kopiert, bekommt Tabulatoren.
		// Ohne diesen Fall wurde jede Zeile mit «Die Stammquote fehlt» abgewiesen.
		const b = leseEinheitenzeilen('Whg 1\t500\t3.5\t87\tEG links', 'stweg-1');
		expect(b.fehler).toEqual([]);
		expect(b.einheiten[0]).toMatchObject({ label: 'Whg 1', quotas: { stamm: 500 }, lage: 'EG links' });
	});

	it('übergeht einen abschliessenden Strichpunkt', () => {
		// Er kommt aus jedem Tabellenexport mit Zeilenabschluss und galt als
		// sechste Angabe.
		const b = leseEinheitenzeilen('Whg 1; 500; 3.5; 87; EG links;', 'stweg-1');
		expect(b.fehler).toEqual([]);
		expect(b.einheiten).toHaveLength(1);
	});

	it('nimmt nicht beliebig viele Zeilen entgegen', () => {
		// Ohne Deckel ergab ein halbes Megabyte rund zwanzigtausend Zeilen und
		// eine Anfrage, die in den Zeitablauf lief.
		const viele = Array.from({ length: 250 }, (_, i) => `Whg ${i}; 4`).join('\n');
		const b = leseEinheitenzeilen(viele, 'stweg-1');
		expect(b.einheiten).toEqual([]);
		expect(b.fehler[0].grund).toMatch(/Mehr als 200 Zeilen/);
		// Und die Absage nennt den Weg, den es gibt.
		expect(b.fehler[0].grund).toMatch(/aus einer Datei/);
	});

	it('rät die Art nicht aus der Bezeichnung', () => {
		// Die Art entscheidet über die Kopfstimme; sie zu erraten wäre eine
		// Vermutung an einer Stelle, an der ein Irrtum eine Stimme verschiebt.
		const b = leseEinheitenzeilen('Einstellplatz 4; 20', 'stweg-1');
		expect(b.einheiten[0].kind).toBe('unit');
	});
});
