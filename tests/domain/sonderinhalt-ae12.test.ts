/**
 * Ä-12: Inhalte, denen alle zustimmen müssen (Fassung 2026-10-19;
 * Produktentscheid 18.10.2026, `docs/entscheide/0009`). Je Kriterium aus
 * Schritt 3e des Ablaufs `.auftraege/2026-10-18-votum-ablauf-entscheide-nach-block3.md`
 * eine Probe; die Nummern stehen am Test.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import { alleFassungen, holeRegelwerk } from '$lib/rules';
import { ANDERE_ORDNUNG_KNOTEN, SONDERINHALT_KNOTEN } from '$lib/rules/quorum-2026-10-19';
import { erfordernisAus, ergebniskarte, laufe, SPERRE_NACH_LEHRE, umstrittenSatz } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk, UMSTRITTEN_SATZ } from '$lib/domain/regelwerk';
import { GEGENMEINUNG } from '$lib/rules/quorum-2026-10-18';
import {
	karteMitReglement,
	KLAUSEL_GEGENMEINUNG,
	regelReichweite,
	umstrittenBeiStrengererKlausel,
	wendeReglementAn,
	type Reglementsregel
} from '$lib/domain/reglement';
import { auffangregelStimmrecht, gegenstandAus } from '$lib/domain/nutzniessung';

const NEU = holeRegelwerk('2026-10-19');
const VOR = holeRegelwerk('2026-10-18');
const knoten = NEU.knoten.find((k) => k.id === SONDERINHALT_KNOTEN)!;
const ordnung = NEU.knoten.find((k) => k.id === ANDERE_ORDNUNG_KNOTEN)!;
const sonderinhalt = () => erfordernisAus(NEU, laufe(NEU, 'a-reglement', ['f3-1-sonderinhalt']));
const andereOrdnung = () => erfordernisAus(NEU, laufe(NEU, 'a-reglement', ['f3-1-andere-ordnung']));
const reglementNormal = () => erfordernisAus(NEU, laufe(NEU, 'a-reglement', ['f3-1-reglement']));

function regel(u: Partial<Reglementsregel>): Reglementsregel {
	return {
		id: 'r1',
		geschaeftsart: 'reglement',
		knotenId: null,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quotenbasis: 'alle_quoten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		fundstelle: 'Reglement Ziff. 9',
		enthaltungZaehltMit: true,
		...u
	} as Reglementsregel;
}

describe('Ä-12: Fassung 2026-10-19', () => {
	/*
	 * **Zwei Antworten, zwei Knoten** statt einer (Laien- und Fachprüfung
	 * 18.10.2026, Runde 1): Der gesetzlich gesicherte Fall darf den Satz
	 * «umstritten» nicht tragen. Dateikopf der Fassung.
	 */
	it('1. f3-1 bietet beide Antworten, beide führen zur Einstimmigkeit aller Eigentümer', () => {
		const f = NEU.fragen.find((x) => x.id === 'f3-1')!;
		expect(f.antworten.find((x) => x.id === 'f3-1-andere-ordnung')!.text).toMatch(
			/Verkauf, Belastung oder Zweckänderung mit weniger als allen Stimmen/
		);
		expect(f.antworten.find((x) => x.id === 'f3-1-sonderinhalt')!.text).toMatch(
			/etwas anderes als Nutzung und Verwaltung/
		);
		for (const [e, id] of [
			[andereOrdnung(), ANDERE_ORDNUNG_KNOTEN],
			[sonderinhalt(), SONDERINHALT_KNOTEN]
		] as const) {
			expect(e.knotenId).toBe(id);
			expect(e.typ).toBe('einstimmigkeit');
			expect(e.kopfbasis).toBe('alle_eigentuemer');
		}
	});

	it('2. Rz. 40b am Gesetzesfall ohne «umstritten»; Rz. 126 mit Rang «lehre», Gegenmeinung und «umstritten»', () => {
		expect(ordnung.begruendung).toMatch(/Rz\. 40b/);
		expect(ordnung.rang).toBe('gesetz');
		expect(ordnung.gegenmeinung).toBeUndefined();
		expect(umstrittenSatz(andereOrdnung(), ordnung)).toBeNull();
		expect(knoten.begruendung).toMatch(/Rz\. 126/);
		expect(knoten.rang).toBe('lehre');
		expect(knoten.gegenmeinung).toMatch(/Rz\. 125 f\./);
		const satz = umstrittenSatz(sonderinhalt(), knoten);
		expect(satz).toContain(UMSTRITTEN_SATZ);
		expect(satz).toContain(knoten.gegenmeinung);
	});

	it('3. eine hinterlegte Regel mildert den Knoten nicht', () => {
		for (const [e, id] of [
			[andereOrdnung(), ANDERE_ORDNUNG_KNOTEN],
			[sonderinhalt(), SONDERINHALT_KNOTEN]
		] as const) {
			for (const r of [regel({ geschaeftsart: 'grundordnung' }), regel({ geschaeftsart: 'grundordnung', knotenId: id })]) {
				const a = wendeReglementAn(e, [r], null, LESARTEN_VORGABE);
				expect(a.vorbehalt).toBe('zwingend');
				expect(a.erfordernis.typ).toBe('einstimmigkeit');
			}
		}
		// Eine Regel zur Reglementsänderung trifft ihn gar nicht (andere Geschäftsart).
		expect(wendeReglementAn(sonderinhalt(), [regel({})], null, LESARTEN_VORGABE).regel).toBeNull();
	});

	/*
	 * **Nicht «zwingendes Recht» am Sonderinhalt** (Codeprüfung 3e): Die Sperre
	 * steht dort auf der strengeren Lesart; die Karte sagt selbst «umstritten».
	 */
	it('3. keine der beiden Karten nennt «zwingendes Recht»; der Sonderinhalt sagt «nicht geklärt»', () => {
		const sk = ergebniskarte(NEU, knoten);
		expect(sk.reglementsvorbehalt).toBe(SPERRE_NACH_LEHRE);
		expect(sk.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
		// An der anderen Ordnung der eigene Rechtssatz statt «zwingendes Recht»:
		// Art. 648 Abs. 2 lässt die einstimmige Abweichung zu (Runde 5).
		const ok = ergebniskarte(NEU, ordnung).reglementsvorbehalt;
		expect(ok).toContain(ordnung.reglementsrecht!);
		expect(ok).not.toMatch(/zwingendes Recht/);
		// Ist eine Regel hinterlegt, sagt der Regelkasten dasselbe.
		const r = regel({ geschaeftsart: 'grundordnung' });
		const mit = karteMitReglement(sk, r, 'zwingend', null, null);
		expect(mit.reglementsvorbehalt).toMatch(/nicht geklärt; gerechnet wird die strengere Lesart/);
		expect(mit.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
	});

	/*
	 * **Auch die Reglementsseite sagt «strengere Lesart»** (zweite Codeprüfung
	 * 3e, N-a): Der Satz zu gesperrten Knoten hiess dort «gezählt wird nach dem
	 * Gesetz», auch für den Sonderinhalt.
	 */
	it('3. die Reglementsseite zählt den Sonderinhalt nicht «nach dem Gesetz»', () => {
		const saetze = regelReichweite(NEU, 'grundordnung')!.split(/(?<=\.) /);
		const gesetz = saetze.find((s) => s.includes('nach dem Gesetz'))!;
		const lehre = saetze.find((s) => s.includes('strengeren Lesart'))!;
		expect(gesetz).toContain(`«${ordnung.titel}»`);
		expect(gesetz).not.toContain(knoten.titel);
		expect(lehre).toContain(`«${knoten.titel}»`);
		expect(lehre).not.toContain(ordnung.titel);
	});

	it('6. die Geschäftsart gibt die Stimme ohne Absprache dem Eigentümer (Ä-24)', () => {
		for (const k of [knoten, ordnung]) {
			expect(k.geschaeftsart).toBe('grundordnung');
			expect(auffangregelStimmrecht(gegenstandAus(k.geschaeftsart, k.id)!)).toBe('eigentuemer');
		}
		// Gegenprobe: die gewöhnliche Reglementsänderung bleibt beim Nutzniesser.
		const normal = NEU.knoten.find((k) => k.id === 'k-reglement-normal')!;
		expect(auffangregelStimmrecht(gegenstandAus(normal.geschaeftsart, normal.id)!)).toBe('nutzniesser');
	});
});

describe('Ä-12, Befund F-4: strengere Klausel an «Reglement ändern»', () => {
	const gesetz = reglementNormal;
	const angewandt = (r: Reglementsregel) => wendeReglementAn(gesetz(), [r], null, LESARTEN_VORGABE).erfordernis;

	it('4. eine in jeder Hinsicht strengere Klausel zeigt «umstritten»', () => {
		const e = angewandt(
			regel({
				kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
				quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
			})
		);
		expect(e.quelle).toBe('reglement');
		const satz = umstrittenBeiStrengererKlausel(e, gesetz());
		expect(satz).toContain(UMSTRITTEN_SATZ);
		expect(satz).toMatch(/Rz\. 40 und 125/);
	});

	it('4. eine mildere Klausel nicht', () => {
		const e = angewandt(
			regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }, quotenSchwelle: null, quotenbasis: 'keine' })
		);
		expect(e.quelle).toBe('reglement');
		expect(umstrittenBeiStrengererKlausel(e, gesetz())).toBeNull();
	});

	it('4. eine gemischte nicht: Dort gilt das Gesetz', () => {
		const a = wendeReglementAn(
			gesetz(),
			[regel({ kopfbasis: 'alle_eigentuemer', kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }, quotenSchwelle: null, quotenbasis: 'keine' })],
			null, LESARTEN_VORGABE
		);
		expect(a.vorbehalt).toBe('gemischt');
		expect(umstrittenBeiStrengererKlausel(a.erfordernis, gesetz())).toBeNull();
	});

	it('4. eine gleich strenge nicht: Sie erschwert nichts', () => {
		const e = angewandt(regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }));
		// Angewandt, sonst wäre die Probe aus dem falschen Grund grün.
		expect(e.quelle).toBe('reglement');
		expect(umstrittenBeiStrengererKlausel(e, gesetz())).toBeNull();
	});

	it('führt dieselbe Gegenmeinung wie die Antwort zur eigenen Schranke', () => {
		// Zwei Stellen für denselben Satz (der Kern lädt kein Regelwerk); diese Probe hält sie gleich.
		expect(KLAUSEL_GEGENMEINUNG).toBe(GEGENMEINUNG['k-reglement-eigene-schranke']);
	});
});

describe('Ä-12: 5. Fassungsprobe', () => {
	it('ändert an der Vorfassung nur f3-1 und fügt die zwei Knoten an', () => {
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.slice(0, -2)).toEqual(VOR.knoten);
		expect(NEU.knoten.slice(-2).map((k) => k.id)).toEqual([ANDERE_ORDNUNG_KNOTEN, SONDERINHALT_KNOTEN]);
		for (const f of VOR.fragen) {
			const n = NEU.fragen.find((x) => x.id === f.id)!;
			if (f.id === 'f3-1') {
				expect(
					n.antworten.filter((a) => a.id !== 'f3-1-sonderinhalt' && a.id !== 'f3-1-andere-ordnung')
				).toEqual(f.antworten);
			} else {
				expect(n).toEqual(f);
			}
		}
	});

	it('lässt die Erfordernisse älterer Fassungen unverändert: dort gibt es den Weg nicht', () => {
		for (const rw of alleFassungen().filter((r) => r.fassung < '2026-10-19')) {
			expect(rw.knoten.some((k) => k.id === SONDERINHALT_KNOTEN || k.id === ANDERE_ORDNUNG_KNOTEN), rw.fassung).toBe(false);
			// Dieselbe Antwort führt dort zur gewöhnlichen Reglementsänderung.
			expect(erfordernisAus(rw, laufe(rw, 'a-reglement', ['f3-1-reglement'])).typ, rw.fassung).toBe(
				'qualifiziertes_mehr'
			);
		}
	});
});
