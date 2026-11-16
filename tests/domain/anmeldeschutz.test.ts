import { describe, expect, it } from 'vitest';
import {
	adresseAusKopfzeile,
	FEHLVERSUCHE_BIS_SPERRE,
	NAMEN_BIS_HERKUNFTSSPERRE,
	pruefeHerkunftssperre,
	pruefeSperre,
	sitzungAbgelaufen,
	type Fehlversuch
} from '$lib/domain/anmeldeschutz';

/** Fester Bezugszeitpunkt statt echter Uhr — der Kern liest nie selbst die Zeit. */
const JETZT = 1_800_000_000_000;

function versucheVor(sekunden: number[]): Fehlversuch[] {
	return sekunden.map((s) => ({ zeitpunkt: JETZT - s * 1000 }));
}

describe('pruefeSperre', () => {
	it('lässt vier Fehlversuche durch', () => {
		const zustand = pruefeSperre(versucheVor([10, 20, 30, 40]), JETZT);
		expect(zustand.gesperrt).toBe(false);
		expect(zustand.beruecksichtigteVersuche).toBe(4);
	});

	it('sperrt beim fünften Fehlversuch', () => {
		const zustand = pruefeSperre(versucheVor([1, 10, 20, 30, 40]), JETZT);
		expect(zustand.gesperrt).toBe(true);
		expect(zustand.verbleibendSekunden).toBe(29);
	});

	it('staffelt die Wartezeit mit jedem weiteren Versuch', () => {
		const stufen = [
			{ versuche: 5, erwartet: 30 },
			{ versuche: 6, erwartet: 60 },
			{ versuche: 7, erwartet: 120 },
			{ versuche: 8, erwartet: 300 }
		];
		for (const { versuche, erwartet } of stufen) {
			const zustand = pruefeSperre(
				Array.from({ length: versuche }, () => ({ zeitpunkt: JETZT })),
				JETZT
			);
			expect(zustand.verbleibendSekunden).toBe(erwartet);
		}
	});

	it('wächst nicht ins Unendliche, damit niemand vor Ort ausgesperrt bleibt', () => {
		const zustand = pruefeSperre(
			Array.from({ length: 50 }, () => ({ zeitpunkt: JETZT })),
			JETZT
		);
		expect(zustand.verbleibendSekunden).toBe(300);
	});

	it('gibt nach Ablauf der Wartezeit wieder frei', () => {
		const zustand = pruefeSperre(versucheVor([31, 40, 50, 60, 70]), JETZT);
		expect(zustand.gesperrt).toBe(false);
	});

	it('vergisst Fehlversuche ausserhalb des Fensters', () => {
		// Ein einzelner Vertipper von gestern darf nicht mit vier neuen zusammenzählen.
		const zustand = pruefeSperre(versucheVor([1000, 1010, 1020, 1030, 5]), JETZT);
		expect(zustand.gesperrt).toBe(false);
		expect(zustand.beruecksichtigteVersuche).toBe(1);
	});

	it('behandelt eine leere Liste als frei', () => {
		expect(pruefeSperre([], JETZT).gesperrt).toBe(false);
	});

	it('ist an der Schwelle eindeutig: genau vier frei, genau fünf gesperrt', () => {
		const knappDrunter = pruefeSperre(versucheVor([1, 2, 3, 4]), JETZT);
		const knappDrueber = pruefeSperre(versucheVor([1, 2, 3, 4, 5]), JETZT);
		expect(knappDrunter.gesperrt).toBe(false);
		expect(knappDrueber.gesperrt).toBe(true);
		expect(FEHLVERSUCHE_BIS_SPERRE).toBe(5);
	});
});

describe('sitzungAbgelaufen', () => {
	it('gilt bis zum Ablaufzeitpunkt', () => {
		expect(sitzungAbgelaufen(JETZT + 1000, JETZT)).toBe(false);
	});

	it('ist im Moment des Ablaufs abgelaufen', () => {
		expect(sitzungAbgelaufen(JETZT, JETZT)).toBe(true);
	});

	it('ist danach abgelaufen', () => {
		expect(sitzungAbgelaufen(JETZT - 1, JETZT)).toBe(true);
	});
});

/**
 * **Die zweite Zählung: viele Namen von derselben Herkunft.**
 *
 * Die Sperre nach Benutzernamen bremst, wer *ein* Konto durchprobiert. Wer
 * *viele Namen* je einmal versucht, läuft an ihr vorbei — jeder Name hat seinen
 * eigenen Zähler, und keiner erreicht fünf.
 */
describe('Die Herkunftssperre', () => {
	const versuch = (username: string, minutenVorher: number) => ({
		username,
		zeitpunkt: JETZT - minutenVorher * 60_000
	});

	it('greift nicht bei vielen Versuchen an einem einzigen Konto', () => {
		/*
		 * **Der wichtigste Fall.** Im Saal sitzen Sitzungsleitung, Beamergerät und
		 * Notebook hinter einer Adresse. Wer sein eigenes Kennwort zehnmal falsch
		 * tippt, ist hier ein Name — die Namenssperre bremst ihn längst, aber die
		 * Herkunftssperre darf die anderen Geräte nicht mitreissen.
		 */
		const zehnmal = Array.from({ length: 10 }, (_, i) => versuch('mmeier', i));
		expect(pruefeHerkunftssperre(zehnmal, JETZT).gesperrt).toBe(false);
	});

	it('greift nicht bei einer Handvoll verschiedener Konten', () => {
		// Drei Personen im Saal, jede vertippt sich einmal. Das darf nichts tun.
		const drei = [versuch('anna', 1), versuch('beat', 2), versuch('cem', 3)];
		expect(pruefeHerkunftssperre(drei, JETZT).gesperrt).toBe(false);
	});

	it('greift, wo viele verschiedene Namen durchprobiert werden', () => {
		const viele = Array.from({ length: NAMEN_BIS_HERKUNFTSSPERRE }, (_, i) =>
			versuch(`nutzer${i}`, i)
		);
		const stand = pruefeHerkunftssperre(viele, JETZT);
		expect(stand.gesperrt).toBe(true);
		expect(stand.beruecksichtigteVersuche).toBe(NAMEN_BIS_HERKUNFTSSPERRE);
	});

	it('zählt denselben Namen in anderer Schreibung nur einmal', () => {
		// Sonst käme man mit «Meier», «meier», «MEIER» billig über die Schwelle
		// und sperrte damit den ganzen Saal aus.
		const gemischt = [
			versuch('Meier', 1),
			versuch('meier', 2),
			versuch('MEIER', 3),
			versuch(' meier ', 4)
		];
		expect(pruefeHerkunftssperre(gemischt, JETZT).beruecksichtigteVersuche).toBe(1);
	});

	it('vergisst, was älter ist als das Fenster', () => {
		const alt = Array.from({ length: NAMEN_BIS_HERKUNFTSSPERRE }, (_, i) =>
			versuch(`nutzer${i}`, 30)
		);
		expect(pruefeHerkunftssperre(alt, JETZT).gesperrt).toBe(false);
	});

	it('gibt nach Ablauf der Wartezeit wieder frei', () => {
		const viele = Array.from({ length: NAMEN_BIS_HERKUNFTSSPERRE }, (_, i) =>
			versuch(`nutzer${i}`, 5)
		);
		// Der letzte Versuch liegt fünf Minuten zurück, die erste Stufe wartet eine.
		expect(pruefeHerkunftssperre(viele, JETZT).gesperrt).toBe(false);
	});

	it('wartet länger, je mehr Namen dazukommen', () => {
		const knapp = Array.from({ length: NAMEN_BIS_HERKUNFTSSPERRE }, (_, i) =>
			versuch(`nutzer${i}`, 0)
		);
		const viel = Array.from({ length: NAMEN_BIS_HERKUNFTSSPERRE + 5 }, (_, i) =>
			versuch(`nutzer${i}`, 0)
		);
		const a = pruefeHerkunftssperre(knapp, JETZT).verbleibendSekunden!;
		const b = pruefeHerkunftssperre(viel, JETZT).verbleibendSekunden!;
		expect(b).toBeGreaterThan(a);
	});
});

describe('Adresse aus der Weiterleitungskopfzeile (A4)', () => {
	it('zählt eine selbst gesetzte erste Adresse nicht', () => {
		// Der Aufrufer schickt `x-forwarded-for: 203.0.113.7`, nginx hängt die
		// Adresse an, von der die Verbindung kam. Nur die zählt.
		expect(adresseAusKopfzeile('203.0.113.7, 198.51.100.20')).toBe('198.51.100.20');
	});

	it('bleibt bei derselben Herkunft, wenn der Aufrufer die erste Adresse wechselt', () => {
		// Genau das ist der Angriff: mit jedem Versuch eine andere erste Adresse,
		// damit die Herkunftssperre nie dieselbe Herkunft sieht.
		const gesehen = new Set(
			['203.0.113.1', '203.0.113.2', '203.0.113.3'].map((vorne) =>
				adresseAusKopfzeile(`${vorne}, 198.51.100.20`)
			)
		);
		expect([...gesehen]).toEqual(['198.51.100.20']);
	});

	it('nimmt den einzigen Eintrag, wenn der Aufrufer nichts mitschickte', () => {
		expect(adresseAusKopfzeile('198.51.100.20')).toBe('198.51.100.20');
	});

	it('gibt ohne Kopfzeile oder bei leerem hintersten Eintrag keine Adresse', () => {
		expect(adresseAusKopfzeile(null)).toBeNull();
		expect(adresseAusKopfzeile(undefined)).toBeNull();
		expect(adresseAusKopfzeile('')).toBeNull();
		expect(adresseAusKopfzeile('203.0.113.7, ')).toBeNull();
	});
});
