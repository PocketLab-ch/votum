/**
 * Die Bestimmung zur Einlage in den Erneuerungsfonds im Kern (Migration 193,
 * `domain/fondsgrenze.ts`; Auftrag «Erneuerungsfonds im Regelwerk», Kriterium
 * 4): gezeigt an Frage und Karte, nichts gerechnet, und ohne Eintrag wie
 * vorher.
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import {
	FONDSGRENZE_ANTWORTEN,
	FONDSGRENZE_ARTEN,
	FONDSGRENZE_FRAGE,
	FONDSGRENZE_KARTEN,
	fondsgrenzeKartensatz,
	fondsgrenzeSatz,
	fondsgrenzeSchrankeSatz,
	pruefeFondsgrenze,
	type Fondsgrenze
} from '$lib/domain/fondsgrenze';
import { mehrhinweise } from '$lib/domain/mehrhinweise';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { FachlicherFehler } from '$lib/domain/fehler';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import {
	mitMehrDerReglementsaenderung,
	umstrittenBeiStrengererKlausel,
	wendeReglementAn,
	WIE_REGLEMENTSAENDERUNG
} from '$lib/domain/reglement';
import { ERRICHTEN_ID, EINLAGE_ID, IN_DER_REGEL_ID, UEBER_REGLEMENT_ID } from '$lib/rules/quorum-2026-11-18';

const RW = holeRegelwerk('2026-11-18');
const FEST: Fondsgrenze = {
	art: 'fest',
	wortlaut: 'Die Einlage darf 0.25 Prozent des Versicherungswerts nicht übersteigen.',
	fundstelle: 'Reglement Ziff. 9.2'
};
const erfordernis = (id: string) => erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === id)!);

describe('Die Bestimmung zum Erneuerungsfonds', () => {
	it('kennt die Frage und die Antworten der Fassung 2026-11-18, die der Kern wörtlich nennt', () => {
		const frage = RW.fragen.find((f) => f.id === FONDSGRENZE_FRAGE);
		expect(frage).toBeDefined();
		const ids = frage!.antworten.map((a) => a.id);
		for (const art of FONDSGRENZE_ARTEN) {
			expect(FONDSGRENZE_ANTWORTEN[art].length, art).toBeGreaterThan(0);
			for (const id of FONDSGRENZE_ANTWORTEN[art]) expect(ids, `${art}: ${id}`).toContain(id);
		}
		expect([...FONDSGRENZE_KARTEN].sort()).toEqual([EINLAGE_ID, IN_DER_REGEL_ID, UEBER_REGLEMENT_ID].sort());
	});

	it('führt jede Art auf Antworten, deren Karten zur Folge der Art passen', () => {
		const ziel = (id: string) => RW.fragen.find((f) => f.id === FONDSGRENZE_FRAGE)!.antworten.find((a) => a.id === id)!.ziel;
		expect(FONDSGRENZE_ANTWORTEN.fest.map(ziel)).toEqual([EINLAGE_ID, UEBER_REGLEMENT_ID]);
		expect(FONDSGRENZE_ANTWORTEN.in_der_regel.map(ziel)).toEqual([EINLAGE_ID, IN_DER_REGEL_ID]);
		expect(FONDSGRENZE_ANTWORTEN.mindest.map(ziel)).toEqual([EINLAGE_ID, UEBER_REGLEMENT_ID]);
		expect(FONDSGRENZE_ANTWORTEN.hoehe_anpassbar.map(ziel)).toEqual([EINLAGE_ID, UEBER_REGLEMENT_ID, IN_DER_REGEL_ID]);
		expect(FONDSGRENZE_ANTWORTEN.hoehe_fest.map(ziel)).toEqual([EINLAGE_ID, UEBER_REGLEMENT_ID]);
	});

	it('nennt im Kern genau die Karten mit dem Mehr der Reglementsänderung, und dort gilt der Vermerk zur strengeren Klausel', () => {
		expect([...WIE_REGLEMENTSAENDERUNG].sort()).toEqual([IN_DER_REGEL_ID, UEBER_REGLEMENT_ID].sort());
		for (const id of WIE_REGLEMENTSAENDERUNG) {
			const k = RW.knoten.find((x) => x.id === id)!;
			expect(k.geschaeftsart, id).toBe('reglement');
			const gesetz = erfordernisAusKnoten(RW, k);
			const streng = wendeReglementAn(
				gesetz,
				[
					{
						id: 'r1',
						stwegId: 's1',
						geschaeftsart: 'reglement',
						fundstelle: 'Reglement Ziff. 99 (erfunden)',
						kopfbasis: 'anwesend_vertreten',
						kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
						quotenbasis: 'alle_quoten',
						quotenSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
						enthaltungZaehltMit: true
					}
				],
				null,
				LESARTEN_VORGABE
			);
			expect(umstrittenBeiStrengererKlausel(streng.erfordernis, gesetz), id).toMatch(/umstritten/);
		}
		expect(mitMehrDerReglementsaenderung(EINLAGE_ID)).toBe(false);
	});

	it('nennt an der Frage die Änderungsschranke mit Fundstelle, ohne zu behaupten, die Karten rechneten sie', () => {
		const satz = fondsgrenzeSchrankeSatz('Art. 34 Abs. 2 Reglement');
		expect(satz).toMatch(/^Weicht der Antrag vom Reglement ab:/);
		expect(satz).toContain('(Art. 34 Abs. 2 Reglement)');
		expect(satz).toMatch(/nicht geklärt/);
		expect(satz).not.toMatch(/rechnen nicht/);
		expect(fondsgrenzeSchrankeSatz(null)).not.toContain('()');
	});

	it('verlangt Wortlaut und Fundstelle und nimmt ohne Art alles heraus', () => {
		expect(pruefeFondsgrenze('fest', ` ${FEST.wortlaut} `, ' Reglement Ziff. 9.2 ')).toEqual(FEST);
		expect(pruefeFondsgrenze(null, FEST.wortlaut, FEST.fundstelle)).toBeNull();
		expect(pruefeFondsgrenze('', FEST.wortlaut, FEST.fundstelle)).toBeNull();
		expect(() => pruefeFondsgrenze('fest', FEST.wortlaut, ' ')).toThrow(FachlicherFehler);
		expect(() => pruefeFondsgrenze('fest', 'ab', FEST.fundstelle)).toThrow(FachlicherFehler);
		expect(() => pruefeFondsgrenze('gross', FEST.wortlaut, FEST.fundstelle)).toThrow(FachlicherFehler);
	});

	it('nennt Wortlaut, Fundstelle und Folge an den Karten zur Einlage, nicht am Errichten', () => {
		const satz = fondsgrenzeSatz(FEST);
		expect(satz).toContain(`«${FEST.wortlaut}»`);
		expect(satz).toContain('(Reglement Ziff. 9.2)');
		expect(satz).toMatch(/Darüber braucht es dasselbe Mehr wie für eine Reglementsänderung/);
		expect(satz).toMatch(/Votum vergleicht den beantragten Betrag nicht/);
		for (const id of FONDSGRENZE_KARTEN) expect(fondsgrenzeKartensatz(erfordernis(id), FEST), id).toBe(satz);
		expect(fondsgrenzeKartensatz(erfordernis(ERRICHTEN_ID), FEST)).toBeNull();
		expect(fondsgrenzeKartensatz(erfordernis('k-jahresrechnung'), FEST)).toBeNull();
	});

	it('ohne Eintrag verhält sich die Karte am Traktandum wie ohne diesen Baustein', () => {
		const e = erfordernis(EINLAGE_ID);
		const k = RW.knoten.find((x) => x.id === EINLAGE_ID)!;
		const ohne = mehrhinweise(e, k, 'erste', true, false, 'per_owner');
		expect(mehrhinweise(e, k, 'erste', true, false, 'per_owner', null)).toEqual(ohne);
		expect(mehrhinweise(e, k, 'erste', true, false, 'per_owner', FEST)).toEqual([...ohne, fondsgrenzeSatz(FEST)]);
	});
});
