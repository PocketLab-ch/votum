import { describe, expect, it } from 'vitest';
import {
	geaenderteZeilen,
	vorgezogene,
	GROESSTE_TIEFE,
	hoehe,
	naechsterPunkt,
	nummeriere,
	ordneUm,
	pruefeNummer,
	teilbaum,
	tiefeVon,
	verschiebe,
	type Knoten
} from '../../src/lib/domain/traktandenbaum';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';

/**
 * Ein Baum, wie er in der Datenbank steht — flach, mit Elternverweis:
 *
 *   1  Begrüssung
 *   2  Jahresrechnung
 *   2.1  Bericht der Revisionsstelle
 *   2.2  Décharge
 *   3  Sanierung
 */
function baum(): Knoten[] {
	return [
		{ id: 'a', parentId: null, position: 1 },
		{ id: 'b', parentId: null, position: 2 },
		{ id: 'b1', parentId: 'b', position: 1 },
		{ id: 'b2', parentId: 'b', position: 2 },
		{ id: 'c', parentId: null, position: 3 }
	];
}

function nummern(k: Knoten[]): string[] {
	return nummeriere(k).map((n) => `${n.nummer} ${n.knoten.id}`);
}

describe('Nummerierung', () => {
	it('nummeriert über den ganzen Baum', () => {
		expect(nummern(baum())).toEqual(['1 a', '2 b', '2.1 b1', '2.2 b2', '3 c']);
	});

	it('gibt die Knoten in Anzeigereihenfolge, Untertraktanden direkt unter ihrem Elternteil', () => {
		expect(nummeriere(baum()).map((n) => n.knoten.id)).toEqual(['a', 'b', 'b1', 'b2', 'c']);
	});

	it('nennt die Ebene je Knoten', () => {
		const n = nummeriere(baum());
		expect(n.find((x) => x.knoten.id === 'b')?.tiefe).toBe(1);
		expect(n.find((x) => x.knoten.id === 'b1')?.tiefe).toBe(2);
	});

	it('lässt eine von Hand gesetzte Nummer unberührt', () => {
		const k = baum().map((x) => (x.id === 'b' ? { ...x, nummerManuell: '2a' } : x));
		expect(nummern(k)).toEqual(['1 a', '2a b', '2a.1 b1', '2a.2 b2', '3 c']);
	});

	it('zählt die manuell nummerierte Stelle trotzdem mit', () => {
		// Sonst bekäme das nächste Traktandum ebenfalls die 2, und auf der Liste
		// stünde zweimal dieselbe Nummer.
		const k = baum().map((x) => (x.id === 'a' ? { ...x, nummerManuell: '1bis' } : x));
		expect(nummern(k)).toEqual(['1bis a', '2 b', '2.1 b1', '2.2 b2', '3 c']);
	});

	it('kennzeichnet manuelle Nummern', () => {
		const k = baum().map((x) => (x.id === 'c' ? { ...x, nummerManuell: '9' } : x));
		expect(nummeriere(k).find((n) => n.knoten.id === 'c')?.manuell).toBe(true);
		expect(nummeriere(k).find((n) => n.knoten.id === 'a')?.manuell).toBe(false);
	});

	it('sortiert nach Position, nicht nach Eingabereihenfolge', () => {
		const verdreht = [...baum()].reverse();
		expect(nummern(verdreht)).toEqual(nummern(baum()));
	});

	it('kommt mit einer leeren Liste zurecht', () => {
		expect(nummeriere([])).toEqual([]);
	});
});

describe('Teilbaum und Tiefe', () => {
	it('findet alle Nachkommen einschliesslich der Wurzel', () => {
		expect(teilbaum(baum(), 'b').sort()).toEqual(['b', 'b1', 'b2']);
	});

	it('gibt für ein Blatt nur dieses zurück', () => {
		expect(teilbaum(baum(), 'a')).toEqual(['a']);
	});

	it('misst die Höhe', () => {
		expect(hoehe(baum(), 'a')).toBe(1);
		expect(hoehe(baum(), 'b')).toBe(2);
	});

	it('misst die Ebene', () => {
		expect(tiefeVon(baum(), 'b1')).toBe(2);
		expect(tiefeVon(baum(), null)).toBe(0);
	});
});

describe('Verschieben', () => {
	it('setzt ein Traktandum an eine andere Stelle derselben Ebene', () => {
		const neu = verschiebe(baum(), { id: 'c', neuerElternteil: null, stelle: 0 });
		expect(nummern(neu)).toEqual(['1 c', '2 a', '3 b', '3.1 b1', '3.2 b2']);
	});

	it('nimmt den ganzen Teilbaum mit', () => {
		const neu = verschiebe(baum(), { id: 'b', neuerElternteil: 'a', stelle: 0 });
		expect(nummern(neu)).toEqual(['1 a', '1.1 b', '1.1.1 b1', '1.1.2 b2', '2 c']);
	});

	it('schliesst die Lücke bei den alten Geschwistern', () => {
		const neu = verschiebe(baum(), { id: 'b1', neuerElternteil: null, stelle: 0 });
		const b2 = neu.find((k) => k.id === 'b2');
		expect(b2?.position).toBe(1);
	});

	it('hängt an das Ende, wenn die Stelle über die Zahl der Geschwister hinausgeht', () => {
		const neu = verschiebe(baum(), { id: 'a', neuerElternteil: null, stelle: 99 });
		expect(nummern(neu)).toEqual(['1 b', '1.1 b1', '1.2 b2', '2 c', '3 a']);
	});

	it('weist das Verschieben unter einen eigenen Nachkommen ab', () => {
		// Ohne diese Prüfung verschwände der ganze Teilbaum aus der Anzeige: Die
		// Daten wären noch da, von der Wurzel aus aber unerreichbar.
		expect(() => verschiebe(baum(), { id: 'b', neuerElternteil: 'b1', stelle: 0 })).toThrow(/eigenen/);
	});

	it('weist das Verschieben unter sich selbst ab', () => {
		expect(() => verschiebe(baum(), { id: 'b', neuerElternteil: 'b', stelle: 0 })).toThrow(
			FachlicherFehler
		);
	});

	it('weist ein unbekanntes Traktandum ab', () => {
		expect(() => verschiebe(baum(), { id: 'x', neuerElternteil: null, stelle: 0 })).toThrow(/gibt es nicht/);
	});
});

describe('Grösste Tiefe', () => {
	/** Eine Kette der Länge n: k1 → k2 → … */
	function kette(n: number): Knoten[] {
		return Array.from({ length: n }, (_, i) => ({
			id: `k${i + 1}`,
			parentId: i === 0 ? null : `k${i}`,
			position: 1
		}));
	}

	it('lässt die vierte Ebene zu', () => {
		const k = [...kette(3), { id: 'neu', parentId: null, position: 2 }];
		const neu = verschiebe(k, { id: 'neu', neuerElternteil: 'k3', stelle: 0 });
		expect(tiefeVon(neu, 'neu')).toBe(GROESSTE_TIEFE);
	});

	it('weist die fünfte ab', () => {
		const k = [...kette(4), { id: 'neu', parentId: null, position: 2 }];
		expect(() => verschiebe(k, { id: 'neu', neuerElternteil: 'k4', stelle: 0 })).toThrow(
			/4 Ebenen/
		);
	});

	it('rechnet die mitwandernden Ebenen mit ein', () => {
		// Ein Traktandum mit Untertraktanden reicht nach dem Verschieben tiefer als
		// es selbst. Wer nur die Zieltiefe prüft, lässt einen Baum entstehen, der
		// die Grenze überschreitet, ohne dass es jemand gemeldet hätte.
		const k = [...kette(2), ...[
			{ id: 'm', parentId: null, position: 2 },
			{ id: 'm1', parentId: 'm', position: 1 },
			{ id: 'm2', parentId: 'm1', position: 1 }
		]];
		expect(() => verschiebe(k, { id: 'm', neuerElternteil: 'k2', stelle: 0 })).toThrow(
			/weitere.*Ebenen/
		);
	});
});

describe('Geänderte Zeilen', () => {
	it('meldet nur, was sich tatsächlich geändert hat', () => {
		const vorher = baum();
		const nachher = verschiebe(vorher, { id: 'c', neuerElternteil: null, stelle: 0 });
		const geaendert = geaenderteZeilen(vorher, nachher);
		expect(geaendert.map((g) => g.id).sort()).toEqual(['a', 'b', 'c']);
		// b1 und b2 haben sich nicht bewegt: Sie hängen an b und wandern mit ihm,
		// ohne dass ihre eigene Position sich ändert.
		expect(geaendert.map((g) => g.id)).not.toContain('b1');
	});

	it('meldet nichts, wenn nichts geschieht', () => {
		const vorher = baum();
		const nachher = verschiebe(vorher, { id: 'a', neuerElternteil: null, stelle: 0 });
		expect(geaenderteZeilen(vorher, nachher)).toEqual([]);
	});
});

describe('Umordnen als Übergang', () => {
	it('hält alte und neue Nummer im Verlauf fest', () => {
		const u = ordneUm('v-1', baum(), { id: 'c', neuerElternteil: null, stelle: 0 });
		expect(u.ereignisse[0].angaben).toMatchObject({ vonNummer: '3', zuNummer: '1' });
	});

	it('erzeugt keinen Eintrag, wenn sich nichts ändert', () => {
		expect(ordneUm('v-1', baum(), { id: 'a', neuerElternteil: null, stelle: 0 }).ereignisse).toHaveLength(0);
	});
});

describe('Manuelle Nummern', () => {
	it('nimmt Ziffern, Punkte und einen Zusatz an', () => {
		expect(pruefeNummer('2a')).toBe('2a');
		expect(pruefeNummer('3.1bis')).toBe('3.1bis');
		expect(pruefeNummer(' 12 ')).toBe('12');
	});

	it('macht aus Leerem keine Nummer', () => {
		expect(pruefeNummer('  ')).toBeNull();
	});

	it('weist Freitext ab', () => {
		// Er machte jede Sortierung und jeden Verweis im Protokoll unmöglich.
		expect(() => pruefeNummer('siehe oben')).toThrow(/Ziffern/);
		expect(() => pruefeNummer('2/3')).toThrow(FachlicherFehler);
	});
});

/**
 * Die Nummer aus der Einladung (Migration 072).
 *
 * **Der Anlass**, am 21.08.2026: Ein Rückkommensantrag wurde im Saal von Platz
 * 9 auf Platz 8 gezogen — und die «Décharge an die Bewirtschaftung» rutschte
 * dabei von 8 auf 9. Die Einladung sagte danach etwas anderes als die Liste im
 * Saal.
 *
 * Jeder Test hier ist gegen die Fassung vor der Änderung geprüft: Ohne
 * `nummerFest` fallen sie durch.
 */
describe('Festgeschriebene Nummern', () => {
	/** Dieselbe Liste, aber freigegeben: jede Zeile trägt ihre Nummer. */
	function freigegeben(): Knoten[] {
		return [
			{ id: 'a', parentId: null, position: 1, nummerFest: '1' },
			{ id: 'b', parentId: null, position: 2, nummerFest: '2' },
			{ id: 'b1', parentId: 'b', position: 1, nummerFest: '2.1' },
			{ id: 'b2', parentId: 'b', position: 2, nummerFest: '2.2' },
			{ id: 'c', parentId: null, position: 3, nummerFest: '3' }
		];
	}

	it('lässt die Nummer stehen, wenn die Reihenfolge sich ändert', () => {
		// Genau der Fall des Auftraggebers: den letzten Punkt nach vorne ziehen.
		const neu = verschiebe(freigegeben(), { id: 'c', neuerElternteil: null, stelle: 0 });
		expect(nummern(neu)).toEqual(['3 c', '1 a', '2 b', '2.1 b1', '2.2 b2']);
	});

	it('rechnet ohne Festschreibung weiter aus der Reihenfolge', () => {
		// Der Entwurf soll sich genau umgekehrt verhalten: Dort rücken die Nummern
		// nach, weil noch niemand eingeladen wurde.
		const neu = verschiebe(baum(), { id: 'c', neuerElternteil: null, stelle: 0 });
		expect(nummern(neu)).toEqual(['1 c', '2 a', '3 b', '3.1 b1', '3.2 b2']);
	});

	it('markiert die feste Nummer als solche, nicht als von Hand gesetzt', () => {
		// An `manuell` hängt die gepunktete Unterstreichung in der Liste. Wäre nach
		// der Freigabe alles «von Hand gesetzt», sagte die Kennzeichnung nichts mehr.
		const n = nummeriere(freigegeben());
		expect(n.every((x) => x.fest && !x.manuell)).toBe(true);
		// Und die Nummer stammt wirklich von dort: Ohne die Markierung mitzuprüfen
		// bliebe der Test auch dann grün, wenn gerechnet würde.
		expect(nummern(freigegeben())).toEqual(['1 a', '2 b', '2.1 b1', '2.2 b2', '3 c']);
	});

	it('lässt die von Hand gesetzte Nummer vorgehen', () => {
		const k = freigegeben().map((x) => (x.id === 'b' ? { ...x, nummerManuell: '2bis' } : x));
		const n = nummeriere(k);
		const b = n.find((x) => x.knoten.id === 'b');
		expect(b?.nummer).toBe('2bis');
		expect(b?.manuell).toBe(true);
		// Und die Kinder hängen an der angezeigten Nummer, nicht an der festen.
		expect(n.find((x) => x.knoten.id === 'b1')?.nummer).toBe('2.1');
	});

	it('gibt dem im Saal Aufgenommenen die nächste freie Zahl', () => {
		const k = [...freigegeben(), { id: 'neu', parentId: null, position: 4 }];
		expect(nummeriere(k).find((x) => x.knoten.id === 'neu')?.nummer).toBe('4');
	});

	it('vergibt keine Zahl zweimal, auch wenn das Neue vorgezogen wird', () => {
		/*
		 * Der Fall, an dem eine naive Zählung scheitert: Das im Saal aufgenommene
		 * Traktandum steht an zweiter Stelle. Aus der Position gerechnet hiesse es
		 * «2» — eine Nummer, die es auf der Einladung schon gibt.
		 */
		const k = [
			{ id: 'a', parentId: null, position: 1, nummerFest: '1' },
			{ id: 'neu', parentId: null, position: 2 },
			{ id: 'b', parentId: null, position: 3, nummerFest: '2' },
			{ id: 'c', parentId: null, position: 4, nummerFest: '3' }
		];
		const n = nummeriere(k);
		expect(n.find((x) => x.knoten.id === 'neu')?.nummer).toBe('4');
		expect(new Set(n.map((x) => x.nummer)).size).toBe(n.length);
	});

	it('zählt mehrere Neue fortlaufend weiter', () => {
		const k = [
			...freigegeben(),
			{ id: 'n1', parentId: null, position: 4 },
			{ id: 'n2', parentId: null, position: 5 }
		];
		const n = nummeriere(k);
		expect(n.find((x) => x.knoten.id === 'n1')?.nummer).toBe('4');
		expect(n.find((x) => x.knoten.id === 'n2')?.nummer).toBe('5');
	});

	it('hängt den Antrag im Saal unter sein Traktandum', () => {
		// Rückkommens- und Folgeanträge sind Untertraktanden (Entscheid 21.08.2026):
		// Beschlossen wird nur über Angekündigtes, und der Antrag liegt in dessen Kern.
		const k = [...freigegeben(), { id: 'r', parentId: 'b', position: 3 }];
		expect(nummeriere(k).find((x) => x.knoten.id === 'r')?.nummer).toBe('2.3');
	});

	it('bleibt auch unter einer von Hand gesetzten Nummer eindeutig', () => {
		const k = [
			{ id: 'b', parentId: null, position: 1, nummerManuell: '7a' },
			{ id: 'r', parentId: 'b', position: 1 }
		];
		// «7a.1» — das Muster, wegen dessen der CHECK auf `released_number` weiter
		// ist als der auf `manual_number`.
		expect(nummeriere(k).find((x) => x.knoten.id === 'r')?.nummer).toBe('7a.1');
	});
});

describe('Vorgezogen behandelt', () => {
	function nummerierteFolge(paare: [string, string][], elternId: string | null = null) {
		return nummeriere(
			paare.map(([id, nummer], i) => ({
				id,
				parentId: elternId,
				position: i + 1,
				nummerFest: nummer
			}))
		);
	}

	it('erkennt den Punkt, der nach vorne gezogen wurde', () => {
		// Genau der Fall des Auftraggebers: 9 vor 8 behandelt.
		const treffer = vorgezogene(nummerierteFolge([['a', '7'], ['c', '9'], ['b', '8']]));
		expect([...treffer]).toEqual(['c']);
	});

	it('schweigt, wenn die Reihenfolge der Liste entspricht', () => {
		const treffer = vorgezogene(nummerierteFolge([['a', '7'], ['b', '8'], ['c', '9']]));
		expect(treffer.size).toBe(0);
	});

	it('vermerkt nur beim Vorgezogenen, nicht beim Zurückgestellten', () => {
		// Sonst trüge dieselbe Umstellung zwei Vermerke — der Leser suchte nach
		// zwei Entscheiden, wo es einer war.
		const treffer = vorgezogene(nummerierteFolge([['c', '9'], ['a', '7'], ['b', '8']]));
		expect([...treffer]).toEqual(['c']);
	});

	it('vergleicht nur innerhalb einer Ebene', () => {
		// «2.1» steht nach «3» — das ist keine Umstellung, sondern die Verschachtelung.
		const knoten = [
			{ id: 'b', parentId: null, position: 1, nummerFest: '2' },
			{ id: 'b1', parentId: 'b', position: 1, nummerFest: '2.1' },
			{ id: 'c', parentId: null, position: 2, nummerFest: '3' }
		];
		expect(vorgezogene(nummeriere(knoten)).size).toBe(0);
	});

	it('behauptet nichts über eine von Hand gesetzte Nummer', () => {
		// Wohin «2bis» gehört, lässt sich nicht rechnen.
		const knoten = [
			{ id: 'x', parentId: null, position: 1, nummerManuell: '2bis' },
			{ id: 'a', parentId: null, position: 2, nummerFest: '1' }
		];
		expect(vorgezogene(nummeriere(knoten)).size).toBe(0);
	});
});

describe('Die Stelle als Eingabe', () => {
	/**
	 * Seit die Stelle eingetippt werden kann (21.08.2026, «anstelle dem Pfeil,
	 * ein Feld, in dem man die Positionsnummer eingeben kann»), kann dort Unsinn
	 * stehen. Vorher stand im Formular ein fester Wert.
	 */
	it('weist eine Stelle ab, die keine Zahl ist', () => {
		// Gemessen: Ohne die Prüfung landete der Punkt lautlos ganz vorne —
		// `slice(0, NaN)` ist leer, `slice(NaN)` ist alles.
		expect(() => verschiebe(baum(), { id: 'c', neuerElternteil: null, stelle: NaN })).toThrow(
			/als Zahl/
		);
		expect(() =>
			verschiebe(baum(), { id: 'c', neuerElternteil: null, stelle: Number('abc') })
		).toThrow(FachlicherFehler);
	});

	it('klemmt eine zu grosse oder negative Stelle an den Rand', () => {
		// Das ist etwas anderes als Unsinn: «an Stelle 99» meint erkennbar «ans
		// Ende», und dort gehört es hin.
		expect(nummern(verschiebe(baum(), { id: 'a', neuerElternteil: null, stelle: 99 }))).toEqual([
			'1 b',
			'1.1 b1',
			'1.2 b2',
			'2 c',
			'3 a'
		]);
		expect(nummern(verschiebe(baum(), { id: 'c', neuerElternteil: null, stelle: -5 }))[0]).toBe(
			'1 c'
		);
	});
});

describe('Was als Nächstes drankommt', () => {
	const p = (behandelt: boolean, aufgerufen = false) => ({ behandelt, aufgerufen });

	it('nimmt den Punkt nach dem aufgerufenen', () => {
		const liste = [p(true), p(false, true), p(false), p(false)];
		expect(naechsterPunkt(liste)).toBe(liste[2]);
	});

	it('fällt ohne aufgerufenen Punkt nicht an den Anfang zurück', () => {
		/*
		 * **Befund 13 der Bewirtschaftersicht** (05.09.2026): Nach «Aufruf
		 * zurücknehmen» stand im Ablauf «NACHHER 1 Begrüssung», obwohl 1
		 * behandelt und 2 angenommen war. Die alte Fassung nahm `liste[0]`,
		 * sobald nichts aufgerufen war.
		 */
		const liste = [p(true), p(true), p(false), p(false)];
		expect(naechsterPunkt(liste)).toBe(liste[2]);
	});

	it('überspringt einen behandelten Punkt, der hinter dem aufgerufenen steht', () => {
		/*
		 * **Befund 5 der Telefonsicht**: «NACHHER: 3.1 Rückkommen», während 3.1
		 * unten als «angenommen» geführt wurde. Ein Rückkommensantrag steht in
		 * der Liste hinter seinem Grundantrag und wird vor ihm entschieden.
		 */
		const liste = [p(true), p(false, true), p(true), p(false)];
		expect(naechsterPunkt(liste)).toBe(liste[3]);
	});

	it('gibt null, wenn nichts mehr folgt', () => {
		expect(naechsterPunkt([p(true), p(true)])).toBeNull();
		expect(naechsterPunkt([])).toBeNull();
	});

	it('nennt den ersten Punkt, solange die Versammlung noch nicht begonnen hat', () => {
		const liste = [p(false), p(false)];
		expect(naechsterPunkt(liste)).toBe(liste[0]);
	});
});
