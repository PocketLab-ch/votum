/**
 * Betroffene im Traktandenformular wie im Saal (Entscheid 0050, Antwort 3:
 * «Formular wie Saal»; Pendenz aus Block C, Codeprüfung M3, N2).
 *
 * Bis zum 14.11.2026 schrieb das Formular Betroffene an jedes Traktandum
 * (`server/traktanden.ts`, `schreibeBetroffene`), der Saal liess sie nur zu,
 * wo die Karte sie kennt (`trageBetroffeneEin` über `betroffenenlage`). Die
 * Prüfung hier ist dieselbe Funktion; der Durchstich mit Datenbank steht in
 * `tests/db/traktanden.test.ts`, «Betroffene nur, wo auch der Saal sie annimmt».
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	BETROFFENE_IM_FORMULAR_OHNE_MEHR,
	betroffenenlage,
	verlangeBetroffeneAmMehr,
	waehleErfordernis
} from '$lib/domain/entscheidbaum';

const rw = holeRegelwerk();
const mehr = (knotenId: string) => waehleErfordernis(rw, knotenId).ergebnis;
const PARTEI = ['p-erfunden-1'];

function absageVon(f: () => void): FachlicherFehler | null {
	try {
		f();
		return null;
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) return fehler;
		throw fehler;
	}
}

describe('verlangeBetroffeneAmMehr', () => {
	it('sagt ab, wo das Mehr keine Betroffenen kennt, und ohne Mehr', () => {
		for (const e of [mehr('k-verwaltung-wichtig'), null]) {
			const absage = absageVon(() => verlangeBetroffeneAmMehr(e, PARTEI));
			expect(absage?.kennung).toBe('ohne_betroffene');
			expect(absage?.message).toBe(BETROFFENE_IM_FORMULAR_OHNE_MEHR);
			expect(absage?.feld).toBe('betroffene');
		}
	});

	it('lässt sie zu, wo der Saal sie annimmt: Zustimmung nötig, Ausschlussklage, Einsprache', () => {
		for (const k of ['k-nutzungsrecht-zuteilung', 'k-ausschlussklage', 'k-einsprache']) {
			expect(absageVon(() => verlangeBetroffeneAmMehr(mehr(k), PARTEI)), k).toBeNull();
		}
	});

	it('prüft nichts ohne Häkchen: Austragen geht immer', () => {
		expect(absageVon(() => verlangeBetroffeneAmMehr(null, []))).toBeNull();
	});

	it('ist an jedem Knoten der aktuellen Fassung dieselbe Prüfung wie im Saal', () => {
		for (const k of rw.knoten.filter((k) => k.typ !== 'grenzfall')) {
			const e = mehr(k.id);
			expect(absageVon(() => verlangeBetroffeneAmMehr(e, PARTEI)) === null, k.id).toBe(betroffenenlage(e).kennt);
		}
	});
});

describe('Beide Schreibwege des Formulars prüfen vor dem Schreiben', () => {
	const quelle = readFileSync(join(process.cwd(), 'src/lib/server/traktanden.ts'), 'utf-8');

	/** Der Rumpf einer Funktion bis zur nächsten auf oberster Ebene. */
	function rumpf(name: string): string {
		const anfang = quelle.indexOf(`export async function ${name}(`);
		expect(anfang, name).toBeGreaterThan(-1);
		const ende = quelle.indexOf('\nexport ', anfang + 1);
		return quelle.slice(anfang, ende === -1 ? undefined : ende);
	}

	it.each(['erstelleTraktandum', 'bearbeiteTraktandum'])('%s', (name) => {
		const r = rumpf(name);
		const pruefung = r.indexOf('await verlangeBetroffeneNachDemSpeichern(');
		const schreiben = r.indexOf('await schreibeBetroffene(');
		expect(pruefung, 'Die Prüfung fehlt').toBeGreaterThan(-1);
		expect(schreiben).toBeGreaterThan(pruefung);
	});
});
