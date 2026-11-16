/**
 * Das feste Beispiel «fünf Ja-Stimmen» unter einer angewandten Regel
 * (Pendenz vom 19.10.2026, Codeprüfung zur Einsprache, Durchgang 2).
 *
 * `bezugsgroessenHinweis` rechnet sein Beispiel mit dem einfachen Mehr des
 * Gesetzes. Verlangt eine hinterlegte Klausel an der Ausschlussklage zwei
 * Drittel, nennt das Zahlenbeispiel der Regel sechs von neun, und der Satz
 * darunter sagte weiter «fünf Ja-Stimmen». Unter einer Regel entfällt das
 * feste Beispiel; ohne Regel bleibt es.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { erfordernisAus, ergebniskarte, laufe } from '$lib/domain/entscheidbaum';
import { bezugsgroessenHinweis } from '$lib/domain/regelwerk';
import {
	karteMitReglement,
	wendeReglementAn,
	zahlenbeispielFuerRegel,
	type Reglementsregel
} from '$lib/domain/reglement';

const RW = holeRegelwerk('2026-10-20');
const AUSSCHLUSS = RW.knoten.find((k) => k.id === 'k-ausschlussklage')!;
const zahlen = { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner' as const, betroffene: 1 };

function zweiDrittel(): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'sonderfall',
		knotenId: 'k-ausschlussklage',
		kopfbasis: 'alle_ausser_betroffene',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		fundstelle: 'Reglement Ziff. 9 (erfunden)',
		enthaltungZaehltMit: true
	};
}

describe('Ausschlussklage unter einer strengeren Klausel', () => {
	it('nennt kein festes «fünf Ja», wenn die Regel sechs von neun verlangt', () => {
		const e = erfordernisAus(RW, laufe(RW, 'a-sonderfaelle', ['f8-1-ausschluss']));
		const a = wendeReglementAn(e, [zweiDrittel()], null, LESARTEN_VORGABE);
		// Anker: Die Regel greift, sonst prüfte der Rest die gesetzliche Karte.
		expect(a.vorbehalt).toBeNull();
		expect(a.regel).not.toBeNull();
		const beispiel = zahlenbeispielFuerRegel(a.regel!, zahlen, a.erfordernis)!;
		const k = karteMitReglement(
			ergebniskarte(RW, AUSSCHLUSS),
			a.regel,
			a.vorbehalt,
			null,
			beispiel,
			a.lesart,
			a.erfordernis
		);
		expect(k.zahlenbeispiel).toMatch(/nötig sind 6 Ja-Stimmen/);
		expect(k.bezugsgroesse).toBe(
			'Hier zählen alle Eigentümer ohne den Beklagten, unabhängig davon, wer erschienen ist. ' +
				'Wer nicht da ist und niemanden bevollmächtigt hat, wirkt wie ein Nein.'
		);
		expect(k.bezugsgroesse).not.toMatch(/fünf|zehn/);
	});

	it('Gegenrichtung: ohne Regel bleibt das Beispiel des Gesetzes', () => {
		expect(ergebniskarte(RW, AUSSCHLUSS).bezugsgroesse).toMatch(/fünf Ja-Stimmen/);
		expect(bezugsgroessenHinweis({ kopfbasis: 'alle_ausser_betroffene', id: 'k-ausschlussklage' })).toMatch(
			/zehn Eigentümern .* fünf Ja-Stimmen/
		);
	});

	it('gilt auch für den allgemeinen Fall mit Betroffenen', () => {
		const ohne = bezugsgroessenHinweis(
			{ kopfbasis: 'alle_ausser_betroffene', id: 'k-verwaltung-gewoehnlich' },
			{ mitBeispiel: false }
		);
		expect(ohne).toBe(
			'Hier zählen alle Eigentümer ausser den unmittelbar Betroffenen, unabhängig davon, wer ' +
				'erschienen ist. Wer nicht da ist und niemanden bevollmächtigt hat, wirkt wie ein Nein.'
		);
		expect(
			bezugsgroessenHinweis({ kopfbasis: 'alle_ausser_betroffene', id: 'k-verwaltung-gewoehnlich' })
		).toMatch(/fünf Ja-Stimmen/);
	});
});
