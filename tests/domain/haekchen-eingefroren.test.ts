/**
 * Das Häkchen «Begründungsakt oder Zustimmung aller» am Erfordernis, eingefroren
 * bei der Freigabe (Migration 198; Entscheid des Auftraggebers vom 18.11.2026,
 * gewählte Antwort «Auch Häkchen einfrieren»: «Das Häkchen kommt beim Freigeben
 * in die Momentaufnahme, und die Karte zeigt danach den damaligen Satz.»).
 *
 * Gemessen wird der Kern: wo `wendeReglementAn` das Häkchen ans Erfordernis
 * schreibt (nur wo es allein den Satz ändert), wie `l17Regelstand` es vergleicht
 * (nur ab der Fassung des gespeicherten Erfordernisses) und dass
 * `wendeReglementAnNachFreigabe` nach der Freigabe den Satz von damals nimmt,
 * aber nur dort, wo das Mehr dasselbe bleibt. Regeln und Fundstellen sind erfunden.
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import type { Regelwerk } from '$lib/domain/regelwerk';
import { ergebniskarte, erfordernisAusKnoten, uebersteuere, type Erfordernis } from '$lib/domain/entscheidbaum';
import { knotenNachLesart, LESARTEN_VORGABE, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	FONDSENTNAHME_MIT_HAEKCHEN,
	FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN,
	FONDSENTNAHME_VEREINBART_MILDER,
	FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN,
	haekchenZusatz,
	karteMitReglement,
	l17Regelstaende,
	l17Regelstand,
	wendeReglementAn,
	wendeReglementAnNachFreigabe,
	type Regelanwendung,
	type Reglementsregel
} from '$lib/domain/reglement';
import { ENTNAHME_ID, VEREINBART_ID } from '$lib/rules/quorum-2026-11-20';

const NEU = holeRegelwerk('2026-11-21');
const ALT = holeRegelwerk('2026-11-20');
const STRENG: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'streng' };
const SVIT: Lesartenwahl = { ...LESARTEN_VORGABE, L17: 'svit' };

/** Eine Regel (erfunden), Vorgabe: einfaches Mehr der Köpfe, nur für die Bezahlung im Zweck, ohne Häkchen. */
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
		fundstelle: 'Reglement Art. 77 (erfunden)',
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

function hergeleitet(rw: Regelwerk, id: string): Erfordernis {
	return erfordernisAusKnoten(rw, rw.knoten.find((x) => x.id === id)!);
}

function karte(rw: Regelwerk, id: string, a: Regelanwendung, wahl: Lesartenwahl = STRENG): string {
	const k = rw.knoten.find((x) => x.id === id)!;
	return (
		karteMitReglement(
			ergebniskarte(rw, knotenNachLesart(rw, k, wahl)),
			a.regel,
			a.vorbehalt,
			null,
			null,
			a.lesart,
			hergeleitet(rw, id),
			a.verdraengt,
			a.fondsregel
		).reglementsvorbehalt ?? ''
	);
}

/** Was ein Traktandum nach `wendeReglementAn` speichert, so weit die Freigabe es braucht. */
function gespeichert(a: Regelanwendung) {
	const { knotenId, quelle, fundstelle, regelGesichert } = a.erfordernis;
	return { knotenId, quelle, fundstelle, regelGesichert };
}

describe('Wo das Häkchen ans Erfordernis geht', () => {
	it('an einer angewandten strengeren Regel im Zweck, mit und ohne Häkchen', () => {
		expect(wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel(STRENGER)], null, STRENG).erfordernis.regelGesichert).toBe(false);
		expect(
			wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel({ ...STRENGER, gesichert: true })], null, STRENG).erfordernis
				.regelGesichert
		).toBe(true);
	});

	it('an der vereinbarten Verwendung unter einer allgemeinen Regel, die nicht gilt', () => {
		const allgemein = regel({ knotenId: null, ...STRENGER });
		const ohne = wendeReglementAn(hergeleitet(NEU, VEREINBART_ID), [allgemein], null, STRENG);
		expect(ohne.vorbehalt).toBe('milder_nach_lesart');
		expect(ohne.erfordernis.typ).toBe('einstimmigkeit');
		expect(ohne.erfordernis.regelGesichert).toBe(false);
		const mit = wendeReglementAn(hergeleitet(NEU, VEREINBART_ID), [{ ...allgemein, gesichert: true }], null, STRENG);
		expect(mit.erfordernis.regelGesichert).toBe(true);
	});

	it('nicht, wo das Häkchen das Mehr ändert, unter «svit», in der Fassung 2026-11-20 oder von Hand gesetzt', () => {
		// Eine mildere Regel gilt nur mit Häkchen: Das gespeicherte Mehr hält es fest.
		expect(
			wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel({ gesichert: true })], null, STRENG).erfordernis.regelGesichert
		).toBeUndefined();
		expect(wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel()], null, STRENG).erfordernis.regelGesichert).toBeUndefined();
		expect(
			wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel({ ...STRENGER, gesichert: true })], null, SVIT).erfordernis
				.regelGesichert
		).toBeUndefined();
		expect(
			wendeReglementAn(hergeleitet(ALT, ENTNAHME_ID), [regel({ ...STRENGER, gesichert: true })], null, STRENG).erfordernis
				.regelGesichert
		).toBeUndefined();
		const vorschlag = wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel(STRENGER)], null, STRENG).erfordernis;
		expect(uebersteuere(NEU, vorschlag, 'qualifiziertes_mehr', 'Prüffall, erfunden').ergebnis.regelGesichert).toBeUndefined();
	});
});

describe('Der Vergleich in Freigabe und Kasten (`l17Regelstand`)', () => {
	const unterRegel = { quelle: 'reglement', fundstelle: 'Reglement Art. 77 (erfunden)' };

	it('unterscheidet das Häkchen ab der Fassung 2026-11-21 des gespeicherten Erfordernisses', () => {
		expect(l17Regelstand(true, { ...unterRegel, regelGesichert: false }, '2026-11-21')).not.toBe(
			l17Regelstand(true, { ...unterRegel, regelGesichert: true }, '2026-11-21')
		);
		// Ein vor Migration 198 gespeichertes ist veraltet, sobald ein Satz am Häkchen hängt.
		expect(l17Regelstand(true, { ...unterRegel, regelGesichert: null }, '2026-11-21')).not.toBe(
			l17Regelstand(true, { ...unterRegel, regelGesichert: false }, '2026-11-21')
		);
		// An der vereinbarten Verwendung rechnet das Traktandum nach dem Gesetz, und trotzdem zählt das Häkchen.
		expect(l17Regelstand(true, { quelle: 'hergeleitet', regelGesichert: true }, '2026-11-21')).not.toBe(
			l17Regelstand(true, { quelle: 'hergeleitet', regelGesichert: false }, '2026-11-21')
		);
	});

	it('nicht in der Fassung 2026-11-20, ohne Fassung und nicht an anderen Karten', () => {
		expect(l17Regelstand(true, { ...unterRegel, regelGesichert: false }, '2026-11-20')).toBe(
			l17Regelstand(true, { ...unterRegel, regelGesichert: true }, '2026-11-20')
		);
		expect(l17Regelstand(true, { ...unterRegel, regelGesichert: false })).toBe('Reglement Art. 77 (erfunden)');
		expect(l17Regelstand(false, { ...unterRegel, regelGesichert: true }, '2026-11-21')).toBeNull();
		expect(l17Regelstand(true, { quelle: 'hergeleitet' }, '2026-11-21')).toBeNull();
	});

	it('zählt das gespeicherte Häkchen nur, wo am neu hergeleiteten ein Satz daran hängt (`l17Regelstaende`)', () => {
		// Nach einer Umstellung auf «svit» hängt kein Satz mehr daran: nicht veraltet.
		const svit = l17Regelstaende(true, { ...unterRegel, regelGesichert: false }, { ...unterRegel }, '2026-11-21');
		expect(svit.bisher).toBe(svit.jetzt);
		// In die andere Richtung, oder vor Migration 198 gespeichert: veraltet.
		const streng = l17Regelstaende(true, { ...unterRegel }, { ...unterRegel, regelGesichert: false }, '2026-11-21');
		expect(streng.bisher).not.toBe(streng.jetzt);
		const gleich = l17Regelstaende(true, { ...unterRegel, regelGesichert: true }, { ...unterRegel, regelGesichert: true }, '2026-11-21');
		expect(gleich.bisher).toBe(gleich.jetzt);
	});

	it('nennt das Häkchen im Kasten in Worten', () => {
		expect(haekchenZusatz(true)).toBe('Häkchen «Begründungsakt oder Zustimmung aller» gesetzt');
		expect(haekchenZusatz(false)).toBe('Häkchen «Begründungsakt oder Zustimmung aller» nicht gesetzt');
		// Trägt das gespeicherte keines, nicht «nicht gesetzt» (Laienprüfung L-3).
		expect(haekchenZusatz(null)).toBe('Häkchen «Begründungsakt oder Zustimmung aller» nicht vermerkt');
	});
});

describe('Nach der Freigabe der Satz von damals (`wendeReglementAnNachFreigabe`)', () => {
	it('strengere Regel ohne Häkchen freigegeben, danach gesetzt: H3 bleibt, das Mehr auch', () => {
		const damals = wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel(STRENGER)], null, STRENG);
		const heute = [regel({ ...STRENGER, gesichert: true })];
		const live = wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG);
		expect(live.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
		const a = wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG, gespeichert(damals));
		expect(a.fondsregel).toBe(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(a.erfordernis.regelGesichert).toBe(false);
		expect(a.erfordernis.kopfSchwelle).toEqual(live.erfordernis.kopfSchwelle);
		expect(a.erfordernis.quotenSchwelle).toEqual(live.erfordernis.quotenSchwelle);
		expect(karte(NEU, ENTNAHME_ID, a)).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(karte(NEU, ENTNAHME_ID, a)).not.toContain(FONDSENTNAHME_MIT_HAEKCHEN);
	});

	it('strengere Regel mit Häkchen freigegeben, danach entfernt: H4 bleibt', () => {
		const damals = wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel({ ...STRENGER, gesichert: true })], null, STRENG);
		const a = wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), [regel(STRENGER)], null, STRENG, gespeichert(damals));
		expect(a.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(karte(NEU, ENTNAHME_ID, a)).toContain(FONDSENTNAHME_MIT_HAEKCHEN);
	});

	it('an der vereinbarten Verwendung: der Satz von damals, in beide Richtungen', () => {
		const allgemein = regel({ knotenId: null, ...STRENGER });
		const ohne = wendeReglementAn(hergeleitet(NEU, VEREINBART_ID), [allgemein], null, STRENG);
		const mit = wendeReglementAn(hergeleitet(NEU, VEREINBART_ID), [{ ...allgemein, gesichert: true }], null, STRENG);
		const gesetzt = wendeReglementAnNachFreigabe(
			hergeleitet(NEU, VEREINBART_ID),
			[{ ...allgemein, gesichert: true }],
			null,
			STRENG,
			gespeichert(ohne)
		);
		expect(karte(NEU, VEREINBART_ID, gesetzt)).toContain(FONDSENTNAHME_VEREINBART_MILDER);
		expect(karte(NEU, VEREINBART_ID, gesetzt)).not.toContain(FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN);
		const entfernt = wendeReglementAnNachFreigabe(hergeleitet(NEU, VEREINBART_ID), [allgemein], null, STRENG, gespeichert(mit));
		expect(karte(NEU, VEREINBART_ID, entfernt)).toContain(FONDSENTNAHME_VEREINBART_MIT_HAEKCHEN);
	});

	it('vor der Freigabe, ohne gespeichertes Häkchen und bei gleichem Häkchen das der Regel', () => {
		const heute = [regel({ ...STRENGER, gesichert: true })];
		expect(wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG, null).fondsregel).toBe(
			FONDSENTNAHME_MIT_HAEKCHEN
		);
		const ohneHaekchen = { knotenId: ENTNAHME_ID, quelle: 'reglement' as const, fundstelle: 'Reglement Art. 77 (erfunden)' };
		expect(wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG, ohneHaekchen).fondsregel).toBe(
			FONDSENTNAHME_MIT_HAEKCHEN
		);
	});

	it('nicht an einer anderen Karte oder einer anderen Regel', () => {
		const damals = gespeichert(wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel(STRENGER)], null, STRENG));
		const heute = [regel({ ...STRENGER, gesichert: true })];
		expect(
			wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG, { ...damals, knotenId: VEREINBART_ID })
				.fondsregel
		).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(
			wendeReglementAnNachFreigabe(hergeleitet(NEU, ENTNAHME_ID), heute, null, STRENG, {
				...damals,
				fundstelle: 'Reglement Art. 78 (erfunden)'
			}).fondsregel
		).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
	});

	it('nicht, wo das Häkchen das Mehr ändert: eine mildere Regel, nach der Freigabe mit Häkchen, gilt', () => {
		// Damals ohne Häkchen: nach der Karte gerechnet, kein Häkchen am Erfordernis.
		const damals = wendeReglementAn(hergeleitet(NEU, ENTNAHME_ID), [regel()], null, STRENG);
		expect(damals.erfordernis.typ).toBe('qualifiziertes_mehr');
		const a = wendeReglementAnNachFreigabe(
			hergeleitet(NEU, ENTNAHME_ID),
			[regel({ gesichert: true })],
			null,
			STRENG,
			gespeichert(damals)
		);
		// Der Weg über das Neuherleiten bis zur Eröffnung bleibt (`FONDSENTNAHME_WEG_HAEKCHEN`).
		expect(a.erfordernis.typ).toBe('reglementsmehr');
		expect(a.fondsregel).toBe(FONDSENTNAHME_MIT_HAEKCHEN);
	});
});
