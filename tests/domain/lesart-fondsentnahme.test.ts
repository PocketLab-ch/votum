/**
 * Lesart L17, Bezahlung aus dem Erneuerungsfonds (Migration 196, Fassung
 * 2026-11-20; Produktentscheid 17.11.2026, «Strenger per Default und
 * einstellbar», «Eine: nach SVIT-Kommentar»).
 *
 * Gemessen wird der Kern: der Katalog, das Mehr beider Wahlen an beiden Karten,
 * die vier Regelfälle in `wendeReglementAn` (nach der strengeren Auffassung
 * gilt nur eine Regel, die in keiner Hinsicht milder ist, fallgenau wie
 * allgemein; nach dem SVIT-Kommentar nur eine fallgenaue, milder wie strenger),
 * dass `k-verwaltung-wichtig` unverändert bleibt, und der Satz, den die Karte
 * unter einer nicht angewandten Regel nennt. Alle Regeln und Fundstellen sind
 * erfunden.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten } from '$lib/domain/regelwerk';
import { ergebniskarte, erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import {
	fondsentnahmewahl,
	knotenNachLesart,
	L17_FRAGE,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenImRegelwerk,
	pruefeLesartenwahl,
	wahlDesKnotens,
	wahlInWorten,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	FONDSENTNAHME_MILDER,
	FONDSENTNAHME_NUR_FALLGENAU,
	FONDSENTNAHME_VEREINBART_MILDER,
	FONDSENTNAHME_VERDRAENGT,
	REICHWEITE_FONDSENTNAHME_AUSSERHALB,
	regelOhneKoepfeGiltFuer,
	karteMitReglement,
	REICHWEITE_FONDSENTNAHME_STRENG,
	REICHWEITE_FONDSENTNAHME_SVIT,
	regelNurFallgenauNachLesart,
	regelReichweite,
	wendeReglementAn,
	type Reglementsregel
} from '$lib/domain/reglement';
import { AUSSERHALB_ID, ENTNAHME_ID, KARTEN_MIT_L17, VEREINBART_ID, VEREINBART_SVIT_WEG } from '$lib/rules/quorum-2026-11-20';

const NEU = holeRegelwerk('2026-11-20');
const STRENG: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'streng' };
const SVIT: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'svit' };

const knoten = (id: string): Ergebnisknoten => NEU.knoten.find((k) => k.id === id)!;
const erfordernis = (id: string) => erfordernisAusKnoten(NEU, knoten(id));

/** Eine Regel der Gemeinschaft (erfunden), Vorgabe: einfaches Mehr der Köpfe, nur für diesen Fall. */
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

/** Die Karte, wie die Seiten sie bauen: Knoten nach der Lesart, Regel aus der Anwendung. */
function karte(id: string, regeln: Reglementsregel[], wahl: Lesartenwahl) {
	const hergeleitet = erfordernis(id);
	const a = wendeReglementAn(hergeleitet, regeln, null, wahl);
	return {
		a,
		k: karteMitReglement(
			ergebniskarte(NEU, knotenNachLesart(NEU, knoten(id), wahl)),
			a.regel,
			a.vorbehalt,
			null,
			null,
			a.lesart,
			hergeleitet
		)
	};
}

describe('L17 im Katalog', () => {
	it('führt L17 mit Frage, Vorgabe «streng» und den Wahlen «streng» und «svit»', () => {
		const l = lesartVon('L17')!;
		expect(l.frage).toBe(L17_FRAGE);
		expect(l.vorgabe).toBe('streng');
		expect(LESARTEN_VORGABE.L17).toBe('streng');
		expect(l.wahlen.map((w) => w.wert)).toEqual(['streng', 'svit']);
		expect(wahlInWorten('L17', 'streng')).toBe('Strengere Auffassung (Vorgabe)');
		expect(pruefeLesartenwahl({ L17: 'svit' })).toEqual({ L17: 'svit' });
		expect(() => pruefeLesartenwahl({ L17: 'einfach' })).toThrow(/L17/);
	});

	it('besteht die Prüfung am Regelwerk, und beide Karten rechnen nach der Vorgabe', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		for (const id of KARTEN_MIT_L17) {
			expect(knoten(id).lesart?.kennung, id).toBe('L17');
			// Am qualifizierten Mehr wie an der Zustimmung aller erkennt der Katalog «streng» (`weitereMehr`).
			expect(wahlDesKnotens(knoten(id)), id).toBe('streng');
		}
		expect(knoten(AUSSERHALB_ID).lesart).toBeUndefined();
	});
});

describe('L17 am Mehr (beide Wahlen, beide Karten)', () => {
	it('rechnet nach der strengeren Auffassung im Zweck qualifiziert, an der Vereinbarung die Zustimmung aller', () => {
		const zweck = wendeReglementAn(erfordernis(ENTNAHME_ID), [], null, STRENG);
		expect(zweck.erfordernis.typ).toBe('qualifiziertes_mehr');
		expect(zweck.erfordernis.quotenbasis).toBe('alle_quoten');
		expect(zweck.erfordernis.gemeinschaftslesart).toMatchObject({ kennung: 'L17', wahl: 'streng', vorgabe: true });
		const vereinbart = wendeReglementAn(erfordernis(VEREINBART_ID), [], null, STRENG);
		expect(vereinbart.erfordernis.typ).toBe('einstimmigkeit');
		expect(vereinbart.erfordernis.kopfbasis).toBe('alle_eigentuemer');
	});

	it('rechnet nach dem SVIT-Kommentar an beiden das einfache Mehr nach Köpfen und nennt das strengere daneben', () => {
		for (const [id, streng] of [
			[ENTNAHME_ID, 'qualifiziertes_mehr'],
			[VEREINBART_ID, 'einstimmigkeit']
		] as const) {
			const a = wendeReglementAn(erfordernis(id), [], null, SVIT);
			expect(a.erfordernis.typ, id).toBe('einfaches_mehr');
			expect(a.erfordernis.kopfbasis, id).toBe('anwesend_vertreten');
			expect(a.erfordernis.quotenbasis, id).toBe('keine');
			expect(a.erfordernis.gemeinschaftslesart, id).toMatchObject({
				kennung: 'L17',
				wahl: 'svit',
				vorgabe: false,
				andere: { wahl: 'streng', typ: streng }
			});
			expect(fondsentnahmewahl(a.erfordernis), id).toBe('svit');
			// Die Karte nach der Wahl: einfaches Mehr, und der getauschte Baum besteht die Prüfung.
			expect(knotenNachLesart(NEU, knoten(id), SVIT).typ, id).toBe('einfaches_mehr');
		}
		const getauscht = { ...NEU, knoten: NEU.knoten.map((k) => knotenNachLesart(NEU, k, SVIT)) };
		expect(pruefeRegelwerk(getauscht)).toStrictEqual([]);
	});
});

describe('L17 und die Regeln der Gemeinschaft (wendeReglementAn)', () => {
	it('streng: wendet eine strengere allgemeine Regel an', () => {
		const a = wendeReglementAn(erfordernis(ENTNAHME_ID), [regel({ ...STRENGER, knotenId: null })], null, STRENG);
		expect(a.vorbehalt).toBeNull();
		expect(a.regel?.id).toBe('r1');
		expect(a.erfordernis.quelle).toBe('reglement');
		expect(a.erfordernis.kopfSchwelle).toEqual(STRENGER.kopfSchwelle);
	});

	it('streng: wendet eine mildere fallgenaue Regel nicht an', () => {
		const a = wendeReglementAn(erfordernis(ENTNAHME_ID), [regel()], null, STRENG);
		expect(a.vorbehalt).toBe('milder_nach_lesart');
		expect(a.regel?.id).toBe('r1');
		expect(a.erfordernis.typ).toBe('qualifiziertes_mehr');
		expect(a.erfordernis.quelle).not.toBe('reglement');
		// Ebenso, wenn die allgemeine daneben auch milder ist: Dann gilt keine.
		const beide = wendeReglementAn(erfordernis(ENTNAHME_ID), [regel(), regel({ id: 'r2', knotenId: null })], null, STRENG);
		expect(beide.vorbehalt).toBe('milder_nach_lesart');
		expect(beide.erfordernis.quelle).not.toBe('reglement');
		// An der vereinbarten Verwendung ebenso: ein Mehr statt der Zustimmung aller ist milder.
		const v = wendeReglementAn(erfordernis(VEREINBART_ID), [regel({ knotenId: VEREINBART_ID })], null, STRENG);
		expect(v.vorbehalt).toBe('milder_nach_lesart');
		expect(v.erfordernis.typ).toBe('einstimmigkeit');
	});

	it('streng: weicht an der vereinbarten Verwendung nicht auf eine allgemeine Regel aus (Codeprüfung, Durchgang 3, M1)', () => {
		const alle = { kopfbasis: 'alle_eigentuemer' as const, kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' as const } };
		const a = wendeReglementAn(
			erfordernis(VEREINBART_ID),
			[regel({ knotenId: VEREINBART_ID }), regel({ ...alle, id: 'r2', knotenId: null, fundstelle: 'Reglement Art. 98 (erfunden)' })],
			null,
			STRENG
		);
		expect(a.verdraengt).toBeUndefined();
		expect(a.vorbehalt).toBe('milder_nach_lesart');
		expect(a.erfordernis.typ).toBe('einstimmigkeit');
		const k = karte(VEREINBART_ID, [regel({ knotenId: VEREINBART_ID }), regel({ ...alle, id: 'r2', knotenId: null })], STRENG).k;
		expect(k.reglementsvorbehalt).toContain(FONDSENTNAHME_VEREINBART_MILDER);
		expect(k.reglementsvorbehalt).not.toContain(FONDSENTNAHME_VERDRAENGT);
	});

	it('streng: weicht bei einer milderen fallgenauen auf eine strengere allgemeine aus (F-5)', () => {
		const a = wendeReglementAn(
			erfordernis(ENTNAHME_ID),
			[regel(), regel({ ...STRENGER, id: 'r2', knotenId: null, fundstelle: 'Reglement Art. 98 (erfunden)' })],
			null,
			STRENG
		);
		expect(a.vorbehalt).toBeNull();
		expect(a.regel?.id).toBe('r2');
		expect(a.erfordernis.quelle).toBe('reglement');
		expect(a.erfordernis.kopfSchwelle).toEqual(STRENGER.kopfSchwelle);
		expect(a.verdraengt).toContain('Reglement Art. 99 (erfunden)');
		expect(a.verdraengt).toContain(FONDSENTNAHME_VERDRAENGT);
		// Die Karte nennt die fallgenaue im Vorbehalt.
		const k = karteMitReglement(
			ergebniskarte(NEU, knoten(ENTNAHME_ID)),
			a.regel,
			a.vorbehalt,
			null,
			null,
			a.lesart,
			erfordernis(ENTNAHME_ID),
			a.verdraengt
		);
		expect(k.reglementsvorbehalt).toContain('Reglement Art. 98 (erfunden)');
		expect(k.reglementsvorbehalt).toContain(FONDSENTNAHME_VERDRAENGT);
		// Unter dem SVIT-Kommentar gilt die fallgenaue, und nichts wird verdrängt.
		const svit = wendeReglementAn(
			erfordernis(ENTNAHME_ID),
			[regel(), regel({ ...STRENGER, id: 'r2', knotenId: null })],
			null,
			SVIT
		);
		expect(svit.regel?.id).toBe('r1');
		expect(svit.verdraengt).toBeUndefined();
	});

	it('svit: wendet eine mildere fallgenaue Regel an', () => {
		const a = wendeReglementAn(erfordernis(ENTNAHME_ID), [regel({ kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mehr_als' } })], null, SVIT);
		expect(a.vorbehalt).toBeNull();
		expect(a.regel?.id).toBe('r1');
		expect(a.erfordernis.kopfSchwelle).toEqual({ zaehler: 1, nenner: 3, art: 'mehr_als' });
		const v = wendeReglementAn(erfordernis(VEREINBART_ID), [regel({ knotenId: VEREINBART_ID })], null, SVIT);
		expect(v.vorbehalt).toBeNull();
		expect(v.erfordernis.quelle).toBe('reglement');
	});

	it('svit: wendet eine allgemeine Regel nicht an, auch eine strengere', () => {
		const a = wendeReglementAn(erfordernis(ENTNAHME_ID), [regel({ ...STRENGER, knotenId: null })], null, SVIT);
		expect(a.vorbehalt).toBe('nur_fallgenau');
		expect(a.erfordernis.typ).toBe('einfaches_mehr');
		expect(a.erfordernis.quelle).not.toBe('reglement');
	});

	it('lässt k-verwaltung-wichtig unter beiden Wahlen, wie es war', () => {
		const e = erfordernisAusKnoten(NEU, knoten('k-verwaltung-wichtig'));
		const regeln = [regel({ knotenId: null })];
		const streng = wendeReglementAn(e, regeln, null, STRENG);
		const svit = wendeReglementAn(e, regeln, null, SVIT);
		expect(streng.vorbehalt).toBeNull();
		expect(streng.regel?.id).toBe('r1');
		expect(svit).toStrictEqual(streng);
		expect(knoten('k-verwaltung-wichtig')).toStrictEqual(
			holeRegelwerk('2026-11-19').knoten.find((k) => k.id === 'k-verwaltung-wichtig')
		);
	});
});

describe('L17 auf der Karte und auf der Reglementsseite', () => {
	it('nennt unter der strengeren Auffassung den eigenen Satz zur milderen Regel, je Karte', () => {
		const { a, k } = karte(ENTNAHME_ID, [regel()], STRENG);
		expect(a.vorbehalt).toBe('milder_nach_lesart');
		expect(k.reglementsvorbehalt).toContain(FONDSENTNAHME_MILDER);
		expect(k.reglementsvorbehalt).not.toContain(FONDSENTNAHME_VEREINBART_MILDER);
		// Runde 6 (R6-L-1): die Umstellung mit Namen, als nicht nötig.
		expect(k.reglementsvorbehalt).toMatch(/Die Lesart L17 auf den SVIT-Kommentar umzustellen, braucht es dafür nicht/);
		// An der vereinbarten Verwendung trägt auch der Begründungsakt nicht sicher (R2-F-3).
		const v = karte(VEREINBART_ID, [regel({ knotenId: VEREINBART_ID })], STRENG);
		expect(v.a.vorbehalt).toBe('milder_nach_lesart');
		expect(v.k.reglementsvorbehalt).toContain(FONDSENTNAHME_VEREINBART_MILDER);
		expect(v.k.reglementsvorbehalt).not.toContain(FONDSENTNAHME_MILDER);
	});

	it('nennt nach dem SVIT-Kommentar unter einer allgemeinen Regel den eigenen Satz, nicht den der Zweckbestimmung', () => {
		const { a, k } = karte(ENTNAHME_ID, [regel({ knotenId: null })], SVIT);
		expect(a.vorbehalt).toBe('nur_fallgenau');
		expect(k.reglementsvorbehalt).toContain(FONDSENTNAHME_NUR_FALLGENAU);
		expect(k.reglementsvorbehalt).not.toMatch(/Zweckbestimmung/);
		expect(k.reglementsvorbehalt).not.toMatch(/Organe oder für Wahlen/);
	});

	it('sagt auf der Reglementsseite je Wahl, welche Regel an den Karten mit L17 gilt', () => {
		const streng = regelReichweite(NEU, 'verwaltung_wichtig', STRENG)!;
		const svit = regelReichweite(NEU, 'verwaltung_wichtig', SVIT)!;
		expect(streng).toContain(REICHWEITE_FONDSENTNAHME_STRENG);
		expect(streng).not.toContain(REICHWEITE_FONDSENTNAHME_SVIT);
		expect(svit).toContain(REICHWEITE_FONDSENTNAHME_SVIT);
		// Ohne Lesarten die Vorgabe.
		expect(regelReichweite(NEU, 'verwaltung_wichtig')).toBe(streng);
		for (const id of KARTEN_MIT_L17) {
			expect(regelNurFallgenauNachLesart(knoten(id), STRENG), id).toBe(false);
			expect(regelNurFallgenauNachLesart(knoten(id), SVIT), id).toBe(true);
		}
		expect(regelNurFallgenauNachLesart(knoten('k-verwaltung-wichtig'), SVIT)).toBe(false);
	});

	it('nimmt unter einer Regel der Zustimmung aller den Weg des Knotens, nicht den der Lesart (N1)', () => {
		const alle = regel({
			knotenId: VEREINBART_ID,
			kopfbasis: 'alle_eigentuemer',
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }
		});
		const { a, k } = karte(VEREINBART_ID, [alle], SVIT);
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.quelle).toBe('reglement');
		expect(k.einstimmigkeitsweg).toBe(knoten(VEREINBART_ID).einstimmigkeitsweg);
		expect(k.einstimmigkeitsweg).not.toBe(VEREINBART_SVIT_WEG);
		// Ohne Regel bleibt unter dem SVIT-Kommentar der Weg der Lesart.
		expect(karte(VEREINBART_ID, [], SVIT).k.einstimmigkeitsweg).toBe(VEREINBART_SVIT_WEG);
	});

	it('sagt an der Bezahlung ausserhalb des Zwecks, dass nach beiden Auffassungen alle zustimmen müssen', () => {
		const satz = regelReichweite(NEU, 'verwaltung_wichtig')!;
		const titel = knoten(AUSSERHALB_ID).titel;
		expect(satz).toContain(`Bei «${titel}» ${REICHWEITE_FONDSENTNAHME_AUSSERHALB}`);
		// Nicht im Satz «umstritten, ob eine andere Ordnung dort gilt».
		const umstritten = satz.split(/(?<=\.) /).find((x) => x.includes('weil umstritten ist'));
		expect(umstritten ?? '').not.toContain(titel);
		// An der luxuriösen Massnahme bleibt der Satz, wie er war.
		expect(regelReichweite(NEU, 'baulich_luxurioes')).toMatch(/weil umstritten ist, ob eine andere Ordnung dort gilt/);
	});

	it('nennt unter dem SVIT-Kommentar die Karten, an denen eine fallgenaue Regel ohne Köpfe gilt', () => {
		const titel = KARTEN_MIT_L17.map((id) => knoten(id).titel);
		// Für alle Fälle der Art nicht (dort nur fallgenau), für genau diesen Fall schon.
		for (const t of titel) expect(regelOhneKoepfeGiltFuer(NEU, 'verwaltung_wichtig', null, SVIT)).not.toContain(t);
		for (const id of KARTEN_MIT_L17) {
			expect(regelOhneKoepfeGiltFuer(NEU, 'verwaltung_wichtig', id, SVIT), id).toEqual([knoten(id).titel]);
			expect(regelOhneKoepfeGiltFuer(NEU, 'verwaltung_wichtig', id, STRENG), id).toEqual([]);
			// Und die Anwendung tut es: Die Regel ohne Köpfe gilt unter dem SVIT-Kommentar.
			const ohneKoepfe = regel({
				knotenId: id,
				kopfSchwelle: null,
				quotenbasis: 'alle_quoten',
				quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
			});
			expect(wendeReglementAn(erfordernis(id), [ohneKoepfe], null, SVIT).vorbehalt, id).toBeNull();
		}
		// Ohne Lesarten die Vorgabe, wie bisher.
		expect(regelOhneKoepfeGiltFuer(NEU, 'verwaltung_wichtig', ENTNAHME_ID)).toEqual([]);
	});

	/*
	 * **Dieselbe Rechnung wirkt an L2, L4 und L11** (Featureprüfung, Prüfer A,
	 * Zusammenspiel 1): Die Reglementseite fragt das Mehr nach der Wahl der
	 * Gemeinschaft, wie `wendeReglementAn`, das die Lesart vor `ohne_koepfe`
	 * anwendet. Ohne die Behebung nannte die Seite diese Karten falsch.
	 */
	it('nennt an L2, L4 und L11 die Karten nach der Wahl der Gemeinschaft, wie die Anwendung rechnet', () => {
		const ohneKoepfe = (art: Reglementsregel['geschaeftsart'], knotenId: string) =>
			regel({ geschaeftsart: art, knotenId, kopfSchwelle: null, quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } });
		const faelle = [
			{ art: 'verwaltung_gewoehnlich', id: 'k-zustaendigkeit-gewoehnlich', wahl: { L2: 'qualifiziert' }, vorgabe: true },
			{ art: 'organe', id: 'k-bewirtschaftung-waehlen-erweitert', wahl: { L4: 'einfach' }, vorgabe: false },
			{ art: 'jahresgeschaefte', id: 'k-prozessfuehrung', wahl: { L11: 'einfach' }, vorgabe: false }
		] as const;
		for (const f of faelle) {
			const wahl = { ...LESARTEN_VORGABE, ...f.wahl } as Lesartenwahl;
			const titel = knoten(f.id).titel;
			expect(regelOhneKoepfeGiltFuer(NEU, f.art, null).includes(titel), `${f.id} Vorgabe`).toBe(f.vorgabe);
			expect(regelOhneKoepfeGiltFuer(NEU, f.art, null, wahl).includes(titel), `${f.id} Wahl`).toBe(!f.vorgabe);
			// Und die Anwendung rechnet unter der Wahl gleich: Gilt die Seite, greift kein `ohne_koepfe`.
			const a = wendeReglementAn(erfordernis(f.id), [ohneKoepfe(f.art, f.id)], null, wahl);
			expect(a.vorbehalt === 'ohne_koepfe', `${f.id} Anwendung`).toBe(f.vorgabe);
		}
	});
});
