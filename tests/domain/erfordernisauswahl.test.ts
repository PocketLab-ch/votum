import { describe, expect, it } from 'vitest';
import {
	sucheErfordernisse,
	waehlbareErfordernisse,
	waehleErfordernis
} from '../../src/lib/domain/entscheidbaum';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';
import { holeRegelwerk } from '../../src/lib/rules';

const rw = holeRegelwerk();

/**
 * Den Fall unmittelbar wählen, statt sich durch den Baum zu fragen.
 *
 * Gewünscht am 02.08.2026: «Beim Zuweisen des Traktandums soll die Möglichkeit
 * bestehen, das Quorum selbst zu bestimmen, ggf. als Dropdown mit allen
 * Variationen.»
 */
describe('Die Auswahlliste der Erfordernisse', () => {
	it('führt jeden Knoten der Fassung ausser den Grenzfällen', () => {
		const auswahl = waehlbareErfordernisse(rw);
		const grenzfaelle = rw.knoten.filter((k) => k.typ === 'grenzfall');

		expect(grenzfaelle.length).toBeGreaterThan(0);
		expect(auswahl).toHaveLength(rw.knoten.length - grenzfaelle.length);
		expect(auswahl.map((a) => a.knotenId)).not.toContain(grenzfaelle[0].id);
	});

	/**
	 * Ohne Ast wäre die Liste eine Aufzählung von dreissig Titeln ohne Ordnung —
	 * und genau das, was der Baum vermeiden soll.
	 */
	it('ordnet jeden Eintrag einem Ast zu', () => {
		for (const eintrag of waehlbareErfordernisse(rw)) {
			expect(eintrag.astId, eintrag.titel).not.toBe('');
			expect(eintrag.astTitel, eintrag.titel).not.toBe('Ohne Ast');
		}
	});

	it('hält die Reihenfolge der Äste ein', () => {
		const auswahl = waehlbareErfordernisse(rw);
		const gesehen = auswahl.map((a) => a.astId).filter((id, i, alle) => alle.indexOf(id) === i);
		const erwartet = rw.aeste.map((a) => a.id).filter((id) => gesehen.includes(id));
		expect(gesehen).toEqual(erwartet);
	});

	it('nennt zu jedem Eintrag Rechtsgrundlage und Mehrheit', () => {
		const wertquoten = waehlbareErfordernisse(rw).find((a) => a.knotenId === 'k-wertquoten-aendern');
		expect(wertquoten?.titel).toBe('Wertquoten ändern');
		expect(wertquoten?.rechtsgrundlage).toMatch(/ZGB/);
		expect(wertquoten?.kurz.length).toBeGreaterThan(0);
	});
});

describe('Ein Erfordernis unmittelbar wählen', () => {
	it('baut es aus dem Knoten und merkt sich, dass gewählt wurde', () => {
		const u = waehleErfordernis(rw, 'k-jahresrechnung');
		expect(u.ergebnis.knotenId).toBe('k-jahresrechnung');
		expect(u.ergebnis.quelle).toBe('gewaehlt');
		expect(u.ergebnis.fassung).toBe(rw.fassung);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.erfordernisGesetzt);
	});

	/**
	 * Ein erfundener Pfad sähe im Protokoll aus wie eine Herleitung, die nie
	 * stattfand — dieselbe Überlegung wie bei den Pflichttraktanden.
	 */
	it('lässt den Pfad leer, trägt aber den Ast nach', () => {
		const u = waehleErfordernis(rw, 'k-wertquoten-aendern');
		expect(u.ergebnis.pfad).toEqual([]);
		expect(u.ergebnis.astId).toBe('a-grundordnung');
	});

	it('übernimmt Bezugsgrössen und Zustimmungspflicht des Knotens', () => {
		const knoten = rw.knoten.find((k) => k.zustimmungBetroffenerNoetig);
		expect(knoten).toBeDefined();
		const u = waehleErfordernis(rw, (knoten as { id: string }).id);
		expect(u.ergebnis.zustimmungBetroffenerNoetig).toBe(true);
		expect(u.ergebnis.rechtsgrundlage).toBe(knoten?.rechtsgrundlage);
	});

	/** Ein Grenzfall besagt gerade, dass kein Erfordernis feststeht. */
	it('weist Grenzfälle ab', () => {
		const grenzfall = rw.knoten.find((k) => k.typ === 'grenzfall');
		expect(() => waehleErfordernis(rw, (grenzfall as { id: string }).id)).toThrow(FachlicherFehler);
	});

	it('weist eine unbekannte Kennung ab', () => {
		expect(() => waehleErfordernis(rw, 'k-gibt-es-nicht')).toThrow(/Fassung des Regelwerks nicht/);
	});
});

/**
 * Thematisch suchen statt den Fallnamen kennen (Auftraggeber, 11.08.2026: «Eine
 * Suchfunktion wäre hier noch gut, die auch thematisch sucht»).
 *
 * Der Punkt: Wer «Heizung» tippt, kennt den Namen «Notwendige bauliche
 * Massnahme» nicht. Die Beispiele des Regelwerks stehen zwischen dem Wort, das
 * er kennt, und dem Fall, den er braucht — und sie stammen aus der Fassung,
 * nicht aus der Suchfunktion (AD-4).
 */
describe('Thematisch suchen', () => {
	const alle = waehlbareErfordernisse(rw);

	it('findet über ein Beispiel, nicht nur über den Fallnamen', () => {
		const treffer = sucheErfordernisse(alle, 'Wärmepumpe');
		expect(treffer.map((t) => t.titel)).toContain('Nützliche bauliche Massnahme');
	});

	it('findet «Heizung», obwohl kein Fall so heisst', () => {
		const treffer = sucheErfordernisse(alle, 'Heizung');
		expect(treffer.length).toBeGreaterThan(0);
		expect(treffer.every((t) => !t.titel.toLowerCase().includes('heizung'))).toBe(true);
	});

	it('findet über die Rechtsgrundlage', () => {
		const treffer = sucheErfordernisse(alle, '647d');
		expect(treffer.length).toBeGreaterThan(0);
		expect(treffer.every((t) => t.rechtsgrundlage.includes('647d'))).toBe(true);
	});

	it('findet über das Thema des Astes', () => {
		const treffer = sucheErfordernisse(alle, 'Jahresgeschäfte');
		expect(treffer.length).toBeGreaterThan(0);
	});

	it('findet über die Höhe der Mehrheit', () => {
		// Alle Einstimmigkeitsfälle sind dabei — und zusätzlich jene, die das Wort
		// in ihrer Begründung führen (etwa der Ausweg aus der luxuriösen Massnahme).
		// Das ist gewollt: Wer nach «Einstimmigkeit» sucht, will auch wissen, wo sie
		// als Ausweg oder Schranke vorkommt.
		const treffer = sucheErfordernisse(alle, 'Einstimmigkeit');
		const einstimmige = alle.filter((t) => t.typ === 'einstimmigkeit');
		expect(einstimmige.length).toBeGreaterThan(0);
		for (const e of einstimmige) expect(treffer).toContain(e);
	});

	it('achtet nicht auf Gross- und Kleinschreibung', () => {
		expect(sucheErfordernisse(alle, 'wertquoten').length).toBe(
			sucheErfordernisse(alle, 'WERTQUOTEN').length
		);
	});

	it('verlangt alle Wörter, aber nicht nebeneinander', () => {
		// «lift sicherheit» steht in «Liftsanierung wegen Sicherheitsvorschriften»
		// als zwei getrennte Teile.
		expect(sucheErfordernisse(alle, 'lift sicherheit').length).toBeGreaterThan(0);
		expect(sucheErfordernisse(alle, 'lift marmor')).toEqual([]);
	});

	it('gibt bei leerer Suche alles zurück', () => {
		// Eine Auswahlliste, die auf nichts hin leer wird, wäre eine Sackgasse.
		expect(sucheErfordernisse(alle, '')).toHaveLength(alle.length);
		expect(sucheErfordernisse(alle, '   ')).toHaveLength(alle.length);
	});

	it('gibt nichts zurück, was es nicht gibt', () => {
		expect(sucheErfordernisse(alle, 'Trampolin')).toEqual([]);
	});
});
