/**
 * Das Häkchen «Begründungsakt oder Zustimmung aller» an einer Regel zur
 * Bezahlung aus dem Fonds (Migration 197, Fassung 2026-11-21; Produktentscheid
 * 17.11.2026, «Häkchen, sonst Hinweis»; R2-F-6, R5-F-2).
 *
 * Gemessen wird der Kern: Mit Häkchen gilt an `k-erneuerungsfonds-entnahme`
 * unter L17 «streng» eine Regel, ob milder oder strenger; ohne Häkchen wie
 * bisher, aber mit dem neuen Satz an einer angewandten strengeren Regel; der Weg
 * bei einer milderen Regel ohne Häkchen; an der vereinbarten Verwendung wirkt
 * es nicht (Fachprüfung F-5); unter «svit» und in der Fassung 2026-11-20 bleibt
 * alles, wie es war; gespeichert wird es nur, wo es wirken kann; der Verlauf
 * nennt Vorzustand und neuen Wert in Worten. Alle Regeln und Fundstellen sind
 * erfunden.
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import type { Regelwerk } from '$lib/domain/regelwerk';
import { ergebniskarte, erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { knotenNachLesart, LESARTEN_VORGABE, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	aendereReglementsregel,
	FONDSENTNAHME_KNOTEN,
	FONDSENTNAHME_MILDER,
	FONDSENTNAHME_MIT_HAEKCHEN,
	FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN,
	FONDSENTNAHME_VEREINBART_MILDER,
	FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN,
	FONDSENTNAHME_VERDRAENGT,
	FONDSENTNAHME_WEG_GUELTIG,
	FONDSENTNAHME_WEG_HAEKCHEN,
	FONDSREGEL_HAEKCHEN_AB,
	fondsregelHaekchenWirkt,
	haekchenMoeglich,
	karteMitReglement,
	legeReglementsregelAn,
	pruefeReglementsregel,
	wendeReglementAn,
	type Reglementsregel
} from '$lib/domain/reglement';
import { ENTNAHME_ID, VEREINBART_ID } from '$lib/rules/quorum-2026-11-20';

const NEU = holeRegelwerk('2026-11-21');
const ALT = holeRegelwerk('2026-11-20');
const STRENG: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'streng' };
const SVIT: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'svit' };

/** Eine Regel der Gemeinschaft (erfunden), Vorgabe: einfaches Mehr der Köpfe, nur für diesen Fall, ohne Häkchen. */
function regel(u: Partial<Reglementsregel> = {}): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'verwaltung_wichtig',
		knotenId: ENTNAHME_ID,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		fundstelle: 'Reglement Art. 99 (erfunden)',
		enthaltungZaehltMit: true,
		...u
	};
}

/** Strenger als das qualifizierte Mehr: zwei Drittel der Köpfe und mehr als die Hälfte aller Wertquoten. */
const STRENGER: Partial<Reglementsregel> = {
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};

function anwenden(rw: Regelwerk, id: string, regeln: Reglementsregel[], wahl: Lesartenwahl) {
	const k = rw.knoten.find((x) => x.id === id)!;
	const hergeleitet = erfordernisAusKnoten(rw, k);
	const a = wendeReglementAn(hergeleitet, regeln, null, wahl);
	const karte = karteMitReglement(
		ergebniskarte(rw, knotenNachLesart(rw, k, wahl)),
		a.regel,
		a.vorbehalt,
		null,
		null,
		a.lesart,
		hergeleitet,
		a.verdraengt,
		a.fondsregel
	);
	return { a, karte };
}

describe('Das Häkchen an der Bezahlung im gewöhnlichen Zweck, unter «streng», ab 2026-11-21', () => {
	it('wendet eine mildere Regel mit Häkchen an und nennt H4', () => {
		const { a, karte } = anwenden(NEU, ENTNAHME_ID, [regel({ gesichert: true })], STRENG);
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.typ).toBe('reglementsmehr');
		expect(a.erfordernis.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(a.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(karte.reglementsvorbehalt).toContain(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(karte.reglementsvorbehalt).not.toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
	});

	it('wendet eine strengere Regel mit Häkchen an und nennt H4, ohne Häkchen H3', () => {
		const mit = anwenden(NEU, ENTNAHME_ID, [regel({ ...STRENGER, gesichert: true })], STRENG);
		expect(mit.a.erfordernis.typ).toBe('reglementsmehr');
		expect(mit.a.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
		const ohne = anwenden(NEU, ENTNAHME_ID, [regel(STRENGER)], STRENG);
		expect(ohne.a.erfordernis.typ).toBe('reglementsmehr');
		expect(ohne.a.fondsregel).toBe(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(ohne.karte.reglementsvorbehalt).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
	});

	it('wendet eine mildere Regel ohne Häkchen nicht an und nennt den Weg mit dem Häkchen und dem Notweg', () => {
		const { a, karte } = anwenden(NEU, ENTNAHME_ID, [regel()], STRENG);
		expect(a.vorbehalt).toBe('milder_nach_lesart');
		expect(a.erfordernis.typ).toBe('qualifiziertes_mehr');
		expect(a.fondsregel).toBeUndefined();
		expect(karte.reglementsvorbehalt).toContain(FONDSENTNAHME_WEG_HAEKCHEN);
		expect(karte.reglementsvorbehalt).not.toContain(FONDSENTNAHME_WEG_GUELTIG);
		// Der bisherige Weg bleibt für den Fall nach der Freigabe (Fachprüfung F-6).
		expect(FONDSENTNAHME_WEG_HAEKCHEN).toMatch(/vor der Freigabe der Einladung/);
		expect(FONDSENTNAHME_WEG_HAEKCHEN).toContain('«Erfordernis neu herleiten»');
		expect(FONDSENTNAHME_WEG_HAEKCHEN).toContain('«Anderes Erfordernis setzen»');
		expect(FONDSENTNAHME_WEG_HAEKCHEN).toContain('«Notweg»');
	});

	it('tauscht eine mildere fallgenaue Regel mit Häkchen nicht gegen eine strengere allgemeine', () => {
		const allgemein = regel({ id: 'r2', knotenId: null, ...STRENGER, fundstelle: 'Reglement Art. 7 (erfunden)' });
		const mit = anwenden(NEU, ENTNAHME_ID, [regel({ gesichert: true }), allgemein], STRENG);
		expect(mit.a.erfordernis.fundstelle).toBe('Reglement Art. 99 (erfunden)');
		expect(mit.a.verdraengt).toBeUndefined();
		// Ohne Häkchen wie bisher: die allgemeine gilt, die fallgenaue steht im Vorbehalt, mit dem neuen Weg.
		const ohne = anwenden(NEU, ENTNAHME_ID, [regel(), allgemein], STRENG);
		expect(ohne.a.erfordernis.fundstelle).toBe('Reglement Art. 7 (erfunden)');
		expect(ohne.a.verdraengt).toContain(FONDSENTNAHME_WEG_HAEKCHEN);
		expect(ohne.a.fondsregel).toBe(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
	});

	it('wendet auch eine mildere allgemeine Regel mit Häkchen an', () => {
		const { a } = anwenden(NEU, ENTNAHME_ID, [regel({ knotenId: null, gesichert: true })], STRENG);
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.typ).toBe('reglementsmehr');
		expect(a.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
	});
});

describe('Wo das Häkchen nicht wirkt', () => {
	it('an der vereinbarten Verwendung: wie bisher nicht angewandt, mit eigenem Satz statt H4 (Fachprüfung F-5)', () => {
		const r = regel({ knotenId: VEREINBART_ID, ...STRENGER });
		const mit = anwenden(NEU, VEREINBART_ID, [{ ...r, gesichert: true }], STRENG);
		expect(mit.a.vorbehalt).toBe('milder_nach_lesart');
		expect(mit.a.erfordernis.typ).toBe('einstimmigkeit');
		expect(mit.a.fondsregel).toBeUndefined();
		expect(mit.karte.reglementsvorbehalt).toContain(FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN);
		expect(mit.karte.reglementsvorbehalt).not.toContain(FONDSENTNAHME_MIT_HAEKCHEN);
		const ohne = anwenden(NEU, VEREINBART_ID, [r], STRENG);
		expect(ohne.karte.reglementsvorbehalt).toContain(FONDSENTNAHME_VEREINBART_MILDER);
	});

	it('unter dem SVIT-Kommentar: alles wie bisher, kein Satz zum Häkchen', () => {
		const fallgenau = anwenden(NEU, ENTNAHME_ID, [regel({ gesichert: true })], SVIT);
		expect(fallgenau.a.erfordernis.typ).toBe('reglementsmehr');
		expect(fallgenau.a.fondsregel).toBeUndefined();
		const allgemein = anwenden(NEU, ENTNAHME_ID, [regel({ knotenId: null, ...STRENGER, gesichert: true })], SVIT);
		expect(allgemein.a.vorbehalt).toBe('nur_fallgenau');
		expect(allgemein.a.fondsregel).toBeUndefined();
	});

	it('in der Fassung 2026-11-20: eine mildere Regel mit Häkchen gilt nicht, und der Satz ist der alte', () => {
		const { a, karte } = anwenden(ALT, ENTNAHME_ID, [regel({ gesichert: true })], STRENG);
		expect(a.vorbehalt).toBe('milder_nach_lesart');
		expect(a.fondsregel).toBeUndefined();
		expect(karte.reglementsvorbehalt).toContain(FONDSENTNAHME_MILDER);
		const streng = anwenden(ALT, ENTNAHME_ID, [regel(STRENGER)], STRENG);
		expect(streng.a.fondsregel).toBeUndefined();
		expect(FONDSENTNAHME_VERDRAENGT.endsWith(FONDSENTNAHME_WEG_GUELTIG)).toBe(true);
		expect(fondsregelHaekchenWirkt({ knotenId: FONDSENTNAHME_KNOTEN, fassung: '2026-11-20' })).toBe(false);
		expect(fondsregelHaekchenWirkt({ knotenId: FONDSENTNAHME_KNOTEN, fassung: FONDSREGEL_HAEKCHEN_AB })).toBe(true);
		expect(fondsregelHaekchenWirkt({ knotenId: VEREINBART_ID, fassung: FONDSREGEL_HAEKCHEN_AB })).toBe(false);
	});
});

describe('Das Häkchen an der Regel selbst', () => {
	const eingabe = (u: Partial<Reglementsregel>) => {
		const { id: _id, ...r } = regel(u);
		return r;
	};

	it('bleibt nur, wo es wirken kann', () => {
		expect(pruefeReglementsregel(eingabe({ gesichert: true }), NEU).gesichert).toBe(true);
		expect(pruefeReglementsregel(eingabe({ knotenId: null, gesichert: true }), NEU).gesichert).toBe(true);
		expect(pruefeReglementsregel(eingabe({ knotenId: VEREINBART_ID, gesichert: true }), NEU).gesichert).toBe(false);
		expect(
			pruefeReglementsregel(eingabe({ geschaeftsart: 'baulich_notwendig', knotenId: null, gesichert: true }), NEU).gesichert
		).toBe(false);
		expect(pruefeReglementsregel(eingabe({}), NEU).gesichert).toBe(false);
		expect(haekchenMoeglich({ geschaeftsart: 'verwaltung_wichtig', knotenId: ENTNAHME_ID })).toBe(true);
		expect(haekchenMoeglich({ geschaeftsart: 'verwaltung_wichtig', knotenId: 'k-verwaltung-wichtig' })).toBe(false);
	});

	it('steht im Verlauf mit Vorzustand und neuem Wert in Worten', () => {
		const bisher = legeReglementsregelAn('r1', eingabe({}), NEU);
		expect(bisher.ereignisse[0].angaben).toMatchObject({ gesichert: 'nicht vermerkt' });
		const u = aendereReglementsregel(bisher.ergebnis, eingabe({ gesichert: true }), NEU);
		expect(u.ergebnis.gesichert).toBe(true);
		expect(u.ereignisse).toHaveLength(1);
		expect(u.ereignisse[0].angaben).toMatchObject({
			felder: ['gesichert'],
			vorher: { gesichert: 'nicht vermerkt' },
			nachher: { gesichert: 'im Begründungsakt oder mit Zustimmung aller' }
		});
		// Unverändert abgeschickt: kein Ereignis.
		expect(aendereReglementsregel(u.ergebnis, eingabe({ gesichert: true }), NEU).ereignisse).toHaveLength(0);
	});
});
