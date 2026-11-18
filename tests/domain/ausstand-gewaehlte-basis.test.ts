/**
 * Ausstand unter einer von Hand gesetzten Kopfbasis «aller Eigentümer»
 * (Entscheid 0050, Antwort 1, «Angleichen»; DeepSeek-Review Regel 43, B5):
 * Ab der Fassung 2026-11-16 bleibt, wer im Ausstand ist, in der Zahl und wirkt
 * wie ein Nein, wie unter L13 «Alle Eigentümer». Traktanden der Fassung
 * 2026-11-15 rechnen weiter ohne ihn (Gegenprobe je Fall).
 *
 * Zehn erfundene Eigentümer; p1 bis p5 halten je 120, p6 bis p10 je 80 von
 * 1000; da oder vertreten sind p1 bis p7, p7 ist im Ausstand.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import {
	AUSSTAND_BEI_GEWAEHLTER_BASIS_AB,
	ausstandBleibtBeiGewaehlterBasis,
	erfordernisAusKnoten,
	RUECKKOMMEN_AUF_GESETZTES_MEHR,
	setzeErfordernis,
	uebersteuere,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { wendeReglementAn } from '$lib/domain/reglement';
import { erfordernisFuerRueckkommen } from '$lib/domain/rueckkommen';
import { zaehleAus, type Auszaehlungslage } from '$lib/domain/auszaehlung';
import { mappenrechnungAus } from '$lib/domain/auszaehlmappe';
import { FREIGABEVERMERK_ZUSATZ, ZAEHLUNG_ANWESENDE, ZAEHLUNG_ANWESENDE_VORHER } from '$lib/rules/quorum-2026-11-16';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const NEU = holeRegelwerk('2026-11-16');
const VOR = holeRegelwerk('2026-11-15');

const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-16T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: Array.from({ length: 10 }, (_, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Partei ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [
			{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: i < 5 ? 120 : 80 }
		]
	}))
};
const DA = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

function stimmen(wahlen: VoteChoice[]): Vote[] {
	return wahlen.map((choice, i) => ({
		partyId: `p${i + 1}`,
		unitId: `p${i + 1}-u`,
		choice,
		castAt: '2026-11-16T19:10:00.000Z',
		recordedByChair: false
	}));
}
/** p1 bis p6 stimmen Ja; p7 ist im Ausstand und stimmt nicht. */
const SECHS_JA = stimmen(['yes', 'yes', 'yes', 'yes', 'yes', 'yes']);

function lage(e: Erfordernis, imAusstand = ['p7'], betroffene: string[] = []): Auszaehlungslage {
	return { momentaufnahme: M, erfordernis: e, stimmen: SECHS_JA, anwesende: DA, imAusstand, betroffeneParteiIds: betroffene };
}

function vorschlag(rw: typeof NEU, knotenId: string): Erfordernis {
	const k = rw.knoten.find((x) => x.id === knotenId)!;
	return wendeReglementAn(erfordernisAusKnoten(rw, k), [], null, LESARTEN_VORGABE).erfordernis;
}

/** Die Leitung setzt in «Anderes Erfordernis setzen» das qualifizierte Mehr aller Eigentümer. */
function vonHand(rw: typeof NEU, knotenId = 'k-verwaltung-wichtig', typ: Erfordernis['typ'] = 'qualifiziertes_mehr') {
	return uebersteuere(rw, vorschlag(rw, knotenId), typ, 'So stand es in der Einladung', {
		kopfbasis: 'alle_eigentuemer'
	}).ergebnis;
}

describe('Fassung 2026-11-16', () => {
	it('ist die aktuelle Fassung, besteht die Prüfungen und ändert keine Karte', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-21');
		expect(AUSSTAND_BEI_GEWAEHLTER_BASIS_AB).toBe(NEU.fassung);
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(NEU.knoten).toBe(VOR.knoten);
		expect(NEU.fragen).toBe(VOR.fragen);
		expect(NEU.aeste).toBe(VOR.aeste);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
	});

	it('ersetzt in der Erklärung zum Wortlaut genau den Satz zur Zählung der Anwesenden (T4)', () => {
		expect(VOR.wortlautErklaerung.split(ZAEHLUNG_ANWESENDE_VORHER).length - 1).toBe(1);
		expect(NEU.wortlautErklaerung.split(ZAEHLUNG_ANWESENDE).length - 1).toBe(1);
		expect(NEU.wortlautErklaerung).not.toContain(ZAEHLUNG_ANWESENDE_VORHER);
		expect(ZAEHLUNG_ANWESENDE).toMatch(/^Nach herrschender Lehre, der Auffassung der meisten Fachleute, zählen/);
		expect(NEU.wortlautErklaerung).toBe(VOR.wortlautErklaerung.replace(ZAEHLUNG_ANWESENDE_VORHER, ZAEHLUNG_ANWESENDE));
	});

	it('nennt im Freigabevermerk, was die Fassung am Ergebnis ändert (T7d)', () => {
		expect(NEU.freigabevermerk).toBe(VOR.freigabevermerk + FREIGABEVERMERK_ZUSATZ);
		expect(FREIGABEVERMERK_ZUSATZ).toMatch(/^ In der Fassung 2026-11-16 bleibt, wer im Ausstand ist, /);
	});
});

describe('Ausstand unter einer von Hand gesetzten Kopfbasis «aller Eigentümer»', () => {
	it('bleibt ab 2026-11-16 in der Zahl und wirkt wie ein Nein; unter 2026-11-15 fällt er heraus', () => {
		const neu = zaehleAus(lage(vonHand(NEU)));
		expect(neu.koepfe.basis).toBe(10);
		expect(neu.koepfe.imAusstand).toBe(1);
		const vor = zaehleAus(lage(vonHand(VOR)));
		expect(vor.koepfe.basis).toBe(9);
	});

	it('gilt ebenso beim Setzen ohne Herleitung', () => {
		const setzen = (rw: typeof NEU) =>
			setzeErfordernis(rw, 'einfaches_mehr', 'Grund der Leitung', { kopfbasis: 'alle_eigentuemer' }).ergebnis;
		expect(zaehleAus(lage(setzen(NEU))).koepfe.basis).toBe(10);
		expect(zaehleAus(lage(setzen(VOR))).koepfe.basis).toBe(9);
	});

	it('Variante A: der knappe Satz zum Ausstand, kein Satz zu den Ausgetretenen', () => {
		const neu = zaehleAus(lage(vonHand(NEU)));
		expect(neu.ausstandswirkung).toMatch(/^Der Ausstand von 1 Partei ändert die Bezugsgrösse der Kopfstimmen hier nicht\./);
		expect(neu.hinweise.join(' ')).not.toMatch(/Gerechnet wurde ohne die Ausgetretenen/);
		const vor = zaehleAus(lage(vonHand(VOR)));
		expect(vor.ausstandswirkung).toMatch(/umfasst die Bezugsgrösse 9 statt 10 Kopfstimmen/);
		expect(vor.hinweise.join(' ')).toMatch(/Gerechnet wurde ohne die Ausgetretenen/);
	});

	it('die Auszählmappe lässt die 9 in der Kopfzahl, wie unter L13 «Alle Eigentümer»', () => {
		expect(mappenrechnungAus(vonHand(NEU), M)?.ausstandNachZaehlweise).toBe(true);
		expect(mappenrechnungAus(vonHand(VOR), M)?.ausstandNachZaehlweise).toBe(false);
	});

	it('das Rückkommen auf einen solchen Beschluss rechnet wie der Beschluss', () => {
		const r = erfordernisFuerRueckkommen(vonHand(NEU), true, null, undefined);
		expect(r.rechtsgrundlage.startsWith(RUECKKOMMEN_AUF_GESETZTES_MEHR)).toBe(true);
		expect(ausstandBleibtBeiGewaehlterBasis(r)).toBe(true);
		expect(zaehleAus(lage(r)).koepfe.basis).toBe(10);
	});

	// Codeprüfung Textrunde 0050, G5: wie am L13-Weg (N2-L-04) kein Satz zu den Wertquoten,
	// wo das Mehr sie nicht zählt; der erste Satz bleibt der knappe (Variante A).
	it('ohne Wertquotenschwelle nur der Satz zu den Köpfen, ab 2026-11-16', () => {
		const setzen = (rw: typeof NEU) =>
			setzeErfordernis(rw, 'einfaches_mehr', 'Grund der Leitung', { kopfbasis: 'alle_eigentuemer' }).ergebnis;
		expect(setzen(NEU).quotenbasis).toBe('keine');
		expect(zaehleAus(lage(setzen(NEU))).ausstandswirkung).toBe(
			'Der Ausstand von 1 Partei ändert die Bezugsgrösse der Kopfstimmen hier nicht.'
		);
		// Die Fassung 2026-11-15 bleibt: Dort fällt der Ausstand heraus, mit dem Satz zu den Wertquoten.
		expect(zaehleAus(lage(setzen(VOR))).ausstandswirkung).toMatch(
			/^Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 9 statt 10 Kopfstimmen\. Bei den Wertquoten/
		);
	});

	// Codeprüfung Textrunde 0050, G6: Der Text entsteht aus der Konstante und bleibt zeichengleich.
	it('das Rückkommen speichert die Rechtsgrundlage zeichengleich wie bisher', () => {
		const leer = erfordernisFuerRueckkommen(vonHand(NEU), true, null, undefined);
		expect(leer.rechtsgrundlage).toBe(
			'Dasselbe Mehr wie für den Beschluss selbst, weil das Rückkommen ihn aufhebt (Regel dieser Anwendung).'
		);
		const mitGrundlage = erfordernisFuerRueckkommen(vorschlag(NEU, 'k-verwaltung-wichtig'), true, null, undefined);
		expect(mitGrundlage.rechtsgrundlage).toBe(
			'ZGB Art. 647b Abs. 1 — dasselbe Mehr wie für den Beschluss selbst, weil das Rückkommen ihn aufhebt (Regel dieser Anwendung).'
		);
	});

	// Codeprüfung Textrunde 0050, G7: eine Rechtsgrundlage `null` aus der Datenbank wirft nicht.
	it('liest eine Rechtsgrundlage null wie eine leere', () => {
		const ohne = { ...vonHand(NEU), rechtsgrundlage: null as unknown as string };
		expect(ausstandBleibtBeiGewaehlterBasis(ohne)).toBe(true);
		expect(ausstandBleibtBeiGewaehlterBasis({ ...ohne, fassung: '2026-11-15' })).toBe(false);
		expect(ausstandBleibtBeiGewaehlterBasis({ ...ohne, typ: 'einstimmigkeit' })).toBe(false);
	});

	it('nicht das Rückkommen auf einen Beschluss nach einer Regel des Reglements', () => {
		const regel: Erfordernis = {
			...vonHand(NEU),
			quelle: 'reglement',
			rechtsgrundlage: 'Reglement der Gemeinschaft, Art. 9 (erfunden)'
		};
		const r = erfordernisFuerRueckkommen(regel, true, null, undefined);
		expect(r.quelle).toBe('gewaehlt');
		expect(ausstandBleibtBeiGewaehlterBasis(r)).toBe(false);
		expect(ausstandBleibtBeiGewaehlterBasis(regel)).toBe(false);
	});

	it('ändert nichts unter «Anwesende und Vertretene», bei der Einstimmigkeit und an der Ausschlussklage', () => {
		const anwesende = (rw: typeof NEU) =>
			uebersteuere(rw, vorschlag(rw, 'k-verwaltung-wichtig'), 'qualifiziertes_mehr', 'Grund', {
				kopfbasis: 'anwesend_vertreten'
			}).ergebnis;
		expect(zaehleAus(lage(anwesende(NEU))).koepfe.basis).toBe(6);
		expect(zaehleAus(lage(anwesende(VOR))).koepfe.basis).toBe(6);

		const einstimmig = vonHand(NEU, 'k-verwaltung-wichtig', 'einstimmigkeit');
		expect(ausstandBleibtBeiGewaehlterBasis(einstimmig)).toBe(false);
		expect(zaehleAus(lage(einstimmig)).koepfe.basis).toBe(zaehleAus(lage(vonHand(VOR, 'k-verwaltung-wichtig', 'einstimmigkeit'))).koepfe.basis);

		// Ausschlussklage: p1 beklagt und im Ausstand, p7 Angehöriger im Ausstand.
		const klage = (rw: typeof NEU) => vonHand(rw, 'k-ausschlussklage', 'einfaches_mehr');
		const neu = zaehleAus(lage(klage(NEU), ['p1', 'p7'], ['p1']));
		const vor = zaehleAus(lage(klage(VOR), ['p1', 'p7'], ['p1']));
		expect(neu.koepfe.basis).toBe(9);
		expect(neu.koepfe).toEqual(vor.koepfe);
	});
});
