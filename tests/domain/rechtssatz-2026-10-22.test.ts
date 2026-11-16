/**
 * Fassung 2026-10-22: Rechtssätze an zwei gesperrten Karten (Pendenz
 * «Zwingendes Recht» im Reglementskasten, Fachprüfung 20.10.2026).
 *
 * Geprüft wird: Nur `k-zirkularbeschluss` und `k-sonderrecht-abgrenzen`
 * bekommen einen Rechtssatz; der Kasten der Karte nennt ihn statt «zwingendes
 * Recht»; die zwei Karten, an denen der Satz trägt, behalten ihn.
 */
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import {
	SONDERRECHT_RECHTSSATZ,
	ZIRKULAR_RECHTSSATZ,
} from '$lib/rules/quorum-2026-10-22';
import { ergebniskarte } from '$lib/domain/entscheidbaum';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';

const VOR = holeRegelwerk('2026-10-21');
const NEU = holeRegelwerk('2026-10-22');
const GEAENDERT = new Map([
	['k-zirkularbeschluss', ZIRKULAR_RECHTSSATZ],
	['k-sonderrecht-abgrenzen', SONDERRECHT_RECHTSSATZ],
]);
const karte = (id: string) =>
	ergebniskarte(
		NEU,
		NEU.knoten.find((k) => k.id === id)!,
	);

describe('Fassung 2026-10-22 gegenüber 2026-10-21', () => {
	it('ist in sich stimmig', () => {
		// Die Fassung selbst, nicht «die aktuelle»: Seit 2026-10-23 folgt eine weitere.
		expect(NEU.fassung).toBe('2026-10-22');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
	});

	it('ändert nur den Rechtssatz der zwei Karten', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			const satz = GEAENDERT.get(k.id);
			if (!satz) {
				expect(k, k.id).toEqual(v);
				continue;
			}
			expect(v.reglementsrecht, k.id).toBeUndefined();
			expect(k).toEqual({ ...v, reglementsrecht: satz });
		}
	});
});

describe('Der Reglementskasten der gesperrten Karten', () => {
	it('nennt am Zirkularbeschluss die Streitfrage statt «zwingendes Recht»', () => {
		const k = karte('k-zirkularbeschluss');
		expect(k.reglementsvorbehalt).toContain(ZIRKULAR_RECHTSSATZ);
		expect(k.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
		expect(ZIRKULAR_RECHTSSATZ).toMatch(/umstritten/);
		// Der Rahmen aus `reglementssatz` sagt «… wendet dieses Werkzeug nicht an»; der
		// Rechtssatz sagt es nicht noch einmal (Codeprüfung 20.10.2026, Prüfrunde 3).
		expect(k.reglementsvorbehalt.split('nicht an').length - 1).toBe(1);
		expect(ZIRKULAR_RECHTSSATZ).toMatch(
			/Mehrheitsabstimmung ohne Versammlung \(Urabstimmung\)/,
		);
	});

	it('nennt an der Abgrenzung des Sonderrechts den Grund und den Umbau', () => {
		const k = karte('k-sonderrecht-abgrenzen');
		expect(k.reglementsvorbehalt).toContain(SONDERRECHT_RECHTSSATZ);
		expect(k.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
		expect(SONDERRECHT_RECHTSSATZ).toMatch(
			/Ein Beschluss der Versammlung allein genügt nicht/,
		);
		expect(SONDERRECHT_RECHTSSATZ).toMatch(
			/Ein Umbau, der nichts daran ändert/,
		);
	});

	it('Gegenrichtung: Vorkaufsrecht und Quoren behalten «zwingendes Recht»', () => {
		for (const id of ['k-vorkaufsrecht', 'k-reglement-quoren']) {
			expect(karte(id).reglementsvorbehalt, id).toMatch(/zwingendes Recht/);
		}
	});
});
