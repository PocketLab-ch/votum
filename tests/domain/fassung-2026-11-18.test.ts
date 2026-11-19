/**
 * Fassung 2026-11-18 (Auftrag «Erneuerungsfonds im Regelwerk und Obergrenze aus
 * dem Reglement», 15.11.2026): Errichten getrennt von den Einlagen, die Einlage
 * nach dem, was das Reglement zu Höhe und Grenze sagt. Die Nummern in den
 * Titeln sind die Akzeptanzkriterien des Auftrags.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { wendeReglementAn } from '$lib/domain/reglement';
import {
	ANTWORT_ERRICHTEN_ID,
	ANTWORT_FONDS_ID,
	ENTNAHME,
	MILDERUNG,
	VERWENDUNG_HILFE,
	EINLAGE_ID,
	ERRICHTEN_ID,
	FRAGE_GELD_ID,
	FRAGE_REGLEMENT_ID,
	IN_DER_REGEL_ID,
	TITEL_VORHER,
	UEBER_REGLEMENT_ID
} from '$lib/rules/quorum-2026-11-18';

const NEU = holeRegelwerk('2026-11-18');
const VOR = holeRegelwerk('2026-11-17');
const NEUE_KNOTEN = [ERRICHTEN_ID, UEBER_REGLEMENT_ID, IN_DER_REGEL_ID];

const knoten = (rw: Regelwerk, id: string): Ergebnisknoten => rw.knoten.find((k) => k.id === id)!;

/** Der Weg durch den Baum nach Antwortkennungen, bis zu einem Knoten. */
function weg(rw: Regelwerk, antworten: string[]): Ergebnisknoten {
	let ziel = rw.aeste.find((a) => a.id === 'a-geld')!.einstieg;
	for (const id of antworten) {
		const frage = rw.fragen.find((f) => f.id === ziel);
		expect(frage, `vor «${id}» steht keine Frage, sondern «${ziel}»`).toBeDefined();
		const antwort = frage!.antworten.find((a) => a.id === id);
		expect(antwort, `«${frage!.id}» kennt «${id}» nicht`).toBeDefined();
		ziel = antwort!.ziel;
	}
	const k = rw.knoten.find((x) => x.id === ziel);
	expect(k, `«${ziel}» ist kein Knoten`).toBeDefined();
	return k!;
}

const EINLAGE_WEG = [ANTWORT_FONDS_ID];

/** Eine hinterlegte Regel der Gemeinschaft für die Reglementsänderung: zwei Drittel der Köpfe und die Hälfte der Wertquoten. */
const REGEL_REGLEMENT = {
	id: 'r1',
	stwegId: 's1',
	geschaeftsart: 'reglement' as const,
	fundstelle: 'Reglement Ziff. 99 (erfunden)',
	kopfbasis: 'anwesend_vertreten' as const,
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const },
	quotenbasis: 'alle_quoten' as const,
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
	enthaltungZaehltMit: true
};

describe('Fassung 2026-11-18', () => {
	it('ist seit der Fassung 2026-11-19 nicht mehr die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('In der Fassung 2026-11-18');
	});

	it('1: führt das Errichten getrennt, mit beiden Meinungen und den Fundstellen', () => {
		const k = weg(NEU, [ANTWORT_ERRICHTEN_ID]);
		expect(k.id).toBe(ERRICHTEN_ID);
		expect(k.typ).toBe('einfaches_mehr');
		const text = (k.hinweise ?? []).join(' ');
		expect(text).toMatch(/umstritten/);
		expect(text).toMatch(/Nach überwiegender Meinung der Fachliteratur genügt das einfache Mehr/);
		expect(text).toMatch(/Liver verlangt das qualifizierte Mehr/);
		expect(text).toContain('Rz. 123 ad Art. 712l');
		expect(text).toContain('Rz. 99 ad Art. 712m');
		expect(text).toMatch(/beiden Auffassungen/);
		// Die Karte rechnet die mildere Lesart: keine `gegenmeinung` (sie setzt die strengere voraus).
		expect(k.gegenmeinung).toBeUndefined();
		expect(k.lesart).toBeUndefined();
		// Unter einer hinterlegten Regel wandern Streit und sicherer Weg zum Gesetz.
		expect((k.hinweiseUnterRegel ?? []).map((u) => u.zumGesetz)).toEqual([true, true, true]);
	});

	it('2: die Einlage bleibt das einfache Mehr ohne Streitfrage, wo das Reglement sie nicht bindet', () => {
		for (const antwort of ['f4-1-fonds-frei', 'f4-1-fonds-im-rahmen', 'f4-1-fonds-anpassbar']) {
			const k = weg(NEU, [...EINLAGE_WEG, antwort]);
			expect(k.id, antwort).toBe(EINLAGE_ID);
			expect(k.typ).toBe('einfaches_mehr');
			expect(k.gegenmeinung).toBeUndefined();
			expect(k.lesart).toBeUndefined();
			// Umstritten ist nur das Mehr der Entnahme, ein eigener Beschluss (Fachprüfung F-1).
			expect(k.hinweise?.filter((h) => /umstritten/.test(h))).toEqual([ENTNAHME]);
			expect([k.begruendung, ...(k.hinweise ?? []).filter((h) => h !== ENTNAHME)].join(' ')).not.toMatch(/umstritten/);
		}
		// Und dasselbe Erfordernis wie in der Vorfassung, bis auf Titel und Fassung: Alte
		// Traktanden werden nicht als älteres Erfordernis gemeldet (`veralteteErfordernisseIn`
		// vergleicht Typ, Schwellen, Basen und Zustimmung, nicht den Titel).
		const ohne = (rw: Regelwerk) => {
			const { quelle: _q, titel: _t, fassung: _f, rechtsgrundlage: _r, ...rest } = erfordernisAusKnoten(rw, knoten(rw, EINLAGE_ID));
			return rest;
		};
		expect(ohne(NEU)).toEqual(ohne(VOR));
	});

	it('3: über einer festen Grenze oder bei fester Höhe das Mehr der Reglementsänderung', () => {
		for (const antwort of ['f4-1-fonds-ueber-fest', 'f4-1-fonds-hoehe', 'f4-1-fonds-mindest']) {
			const k = weg(NEU, [...EINLAGE_WEG, antwort]);
			expect(k.id, antwort).toBe(UEBER_REGLEMENT_ID);
			expect(k.typ).toBe('qualifiziertes_mehr');
			expect(k.geschaeftsart).toBe('reglement');
			expect(k.quotenbasis).toBe('alle_quoten');
			expect(k.begruendung).toMatch(/Der Text des Reglements muss dafür nicht geändert werden/);
			expect(k.hinweise?.join(' ')).toMatch(/innert eines Monats beim Gericht anfechten/);
		}
		// Wie die Reglementsänderung selbst: Typ, Basen, Geschäftsart und Verhalten.
		const normal = knoten(NEU, 'k-reglement-normal');
		const ueber = knoten(NEU, UEBER_REGLEMENT_ID);
		for (const feld of ['typ', 'kopfbasis', 'quotenbasis', 'geschaeftsart', 'reglementsverhalten'] as const) {
			expect(ueber[feld], feld).toBe(normal[feld]);
		}
	});

	it('3: über einer Grenze «in der Regel» die offene Frage, gerechnet mit dem sicheren Weg', () => {
		const k = weg(NEU, [...EINLAGE_WEG, 'f4-1-fonds-in-der-regel']);
		expect(k.id).toBe(IN_DER_REGEL_ID);
		expect(k.begruendung).toMatch(/ist offen, ob eine begründete Ausnahme mit einfachem Mehr genügt/);
		expect(k.begruendung).toMatch(/Sicher ist der Beschluss mit dem Mehr einer Reglementsänderung/);
		// Offen, nicht umstritten (Fachprüfung der Website, Runde 2, S1).
		expect(k.gegenmeinung).toBeUndefined();
		expect([k.begruendung, ...(k.hinweise ?? []).filter((h) => h !== ENTNAHME && h !== MILDERUNG)].join(' ')).not.toMatch(
			/umstritten/
		);
		const { quelle: _a, ...e } = erfordernisAusKnoten(NEU, k);
		const { quelle: _b, ...ueber } = erfordernisAusKnoten(NEU, knoten(NEU, UEBER_REGLEMENT_ID));
		expect({ ...e, knotenId: '', titel: '' }).toEqual({ ...ueber, knotenId: '', titel: '' });
	});

	it('3: mit hinterlegtem Mehr der Reglementsänderung rechnen beide Karten mit ihm, die Einlage nicht', () => {
		for (const id of [UEBER_REGLEMENT_ID, IN_DER_REGEL_ID]) {
			const a = wendeReglementAn(erfordernisAusKnoten(NEU, knoten(NEU, id)), [REGEL_REGLEMENT], null, LESARTEN_VORGABE);
			expect(a.vorbehalt, id).toBeNull();
			expect(a.regel?.id, id).toBe('r1');
			expect(a.erfordernis.kopfSchwelle, id).toEqual(REGEL_REGLEMENT.kopfSchwelle);
		}
		/*
		 * «Nur für» gilt wörtlich (Codeprüfung, zweiter Durchgang, M-A): Eine Regel
		 * nur für «Reglement ändern, gewöhnliche Bestimmung» greift an den beiden
		 * Karten nicht, eine für genau die Karte schon, und die greift nicht an
		 * «Reglement ändern, gewöhnliche Bestimmung».
		 */
		const nurNormal = { ...REGEL_REGLEMENT, id: 'r2', knotenId: 'k-reglement-normal' };
		for (const id of [UEBER_REGLEMENT_ID, IN_DER_REGEL_ID]) {
			const an = (regeln: (typeof REGEL_REGLEMENT & { knotenId?: string })[]) =>
				wendeReglementAn(erfordernisAusKnoten(NEU, knoten(NEU, id)), regeln, null, LESARTEN_VORGABE).regel?.id ?? null;
			expect(an([nurNormal]), id).toBeNull();
			const genau = { ...REGEL_REGLEMENT, id: 'r3', knotenId: id };
			expect(an([nurNormal, genau]), id).toBe('r3');
			expect(
				wendeReglementAn(erfordernisAusKnoten(NEU, knoten(NEU, 'k-reglement-normal')), [genau], null, LESARTEN_VORGABE).regel
			).toBeNull();
			// Unter der Regel wandern Anfechtung, Vollmacht und Milderung zum Gesetz (Codeprüfung M2).
			const zumGesetz = (knoten(NEU, id).hinweiseUnterRegel ?? []).map((u) => u.hinweis);
			expect(zumGesetz, id).toContain(MILDERUNG);
		}
		const einlage = wendeReglementAn(
			erfordernisAusKnoten(NEU, knoten(NEU, EINLAGE_ID)),
			[REGEL_REGLEMENT],
			null,
			LESARTEN_VORGABE
		);
		expect(einlage.regel).toBeNull();
		expect(einlage.erfordernis.typ).toBe('einfaches_mehr');
	});

	it('ändert sonst keine Frage, keinen Ast und keine Karte', () => {
		expect(NEU.aeste).toBe(VOR.aeste);
		expect(NEU.ergebnistypen).toBe(VOR.ergebnistypen);
		const vorIds = VOR.knoten.map((k) => k.id);
		expect(NEU.knoten.map((k) => k.id).filter((id) => !NEUE_KNOTEN.includes(id))).toEqual(vorIds);
		for (const k of NEU.knoten.filter((x) => vorIds.includes(x.id) && x.id !== EINLAGE_ID)) {
			expect(k, k.id).toBe(knoten(VOR, k.id));
		}
		for (const f of NEU.fragen.filter((x) => x.id !== FRAGE_GELD_ID && x.id !== FRAGE_REGLEMENT_ID)) {
			expect(f, f.id).toBe(VOR.fragen.find((x) => x.id === f.id));
		}
		const geld = NEU.fragen.find((f) => f.id === FRAGE_GELD_ID)!;
		const geldVor = VOR.fragen.find((f) => f.id === FRAGE_GELD_ID)!;
		const sonst = (id: string) => ![ANTWORT_FONDS_ID, ANTWORT_ERRICHTEN_ID, 'f4-1-verwendung'].includes(id);
		expect(geld.antworten.filter((a) => sonst(a.id))).toEqual(geldVor.antworten.filter((a) => sonst(a.id)));
		// Die Hilfe an der Verwendung sagt jetzt, dass die Bezahlung ein zweiter Beschluss ist (Fachprüfung F-1).
		const verwendung = geld.antworten.find((a) => a.id === 'f4-1-verwendung')!;
		const verwendungVor = geldVor.antworten.find((a) => a.id === 'f4-1-verwendung')!;
		expect({ ...verwendung, hilfe: '' }).toEqual({ ...verwendungVor, hilfe: '' });
		expect(verwendung.hilfe).toBe(VERWENDUNG_HILFE);
		expect(verwendung.hilfe).toMatch(/zweiter Beschluss/);
	});

	it('5: die alte Fassung bleibt, wie sie war', () => {
		const geld = VOR.fragen.find((f) => f.id === FRAGE_GELD_ID)!;
		expect(geld.antworten.find((a) => a.id === ANTWORT_FONDS_ID)).toEqual({
			id: ANTWORT_FONDS_ID,
			text: TITEL_VORHER,
			ziel: EINLAGE_ID
		});
		expect(knoten(VOR, EINLAGE_ID).titel).toBe(TITEL_VORHER);
		for (const id of [...NEUE_KNOTEN, FRAGE_REGLEMENT_ID]) {
			expect(JSON.stringify(VOR), id).not.toContain(id);
		}
		expect(holeRegelwerk('2026-11-16').knoten.find((k) => k.id === EINLAGE_ID)?.titel).toBe(TITEL_VORHER);
	});
});
