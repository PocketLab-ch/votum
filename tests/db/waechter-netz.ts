/**
 * Kein Datenbanktest wird durch den Wächter über den Verlauf grün (Migration
 * 177), ausser denen, die ihn meinen.
 *
 * **Der Anlass** (Codeprüfung zu Auftrag 2e, 28.10.2026). Die Tests der Wege
 * mit fremder Kennung verlangen oft nur eine fachliche Absage und keinen
 * Eintrag, etwa `verlauf-fremder-gegenstand.test.ts`. Seit Migration 177
 * liefert der Wächter beides auch dann, wenn die Prüfung im Code fehlt; ein
 * Umbau, der sie entfernt, fiele nicht mehr auf. Die Prüfungen im Code sollen
 * aber bleiben (Kopf der Migration). Deshalb wird hier jeder Test rot, in dem
 * der Wächter eine Absage geliefert hat, und die Datei, wenn es in ihrem Aufbau
 * oder Abbau geschah (`beforeAll`, `afterAll`; zweiter Durchgang der
 * Codeprüfung).
 *
 * Gezählt wird in `alsBetreiber` und `ohneBindung` (`abgewieseneFremdeKennungen`
 * in `src/lib/server/db.ts`). Ein Test, der das Schema unmittelbar beschreibt
 * und `VO177` roh bekommt, zählt nicht; er meint den Wächter ohnehin.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect } from 'vitest';

/*
 * **Erst im `beforeAll` einbinden, nicht oben** (gemessen 28.10.2026 an
 * `abgabe-gleichzeitig.test.ts`). `env-ersatz.ts` kopiert `process.env` beim
 * ersten Laden. Ein Einbinden hier oben lud `db.ts` und damit die Umgebung,
 * bevor eine Testdatei sie mit `vi.hoisted` setzt (`VERSAMMLUNG_DATEIEN`), und
 * die Ablage landete am falschen Ort.
 */
let abgewieseneFremdeKennungen: () => number = () => 0;

/** Dateien, die den Wächter meinen. */
const MEINEN_IHN = ['tests/db/waechter-k2.test.ts'];

const SATZ =
	'Der Wächter über den Verlauf (VO177) hat hier abgewiesen. Der Weg prüft seine Kennung nicht ' +
	'selbst unter dem eigenen Betreiber; die Prüfung im Code fehlt oder kommt zu spät.';

const meintIhn = () => MEINEN_IHN.some((d) => (expect.getState().testPath ?? '').endsWith(d));

let beimLaden = 0;
let vorher = 0;
let inTests = 0;

// Die Haken dieser Datei laufen vor denen der Testdatei an und nach ihnen ab.
beforeAll(async () => {
	({ abgewieseneFremdeKennungen } = await import('$lib/server/db'));
	beimLaden = abgewieseneFremdeKennungen();
	inTests = 0;
});

beforeEach(() => {
	vorher = abgewieseneFremdeKennungen();
});

afterEach(() => {
	const hier = abgewieseneFremdeKennungen() - vorher;
	inTests += hier;
	if (!meintIhn()) expect(hier, SATZ).toBe(0);
});

afterAll(() => {
	if (meintIhn()) return;
	expect(abgewieseneFremdeKennungen() - beimLaden - inTests, `${SATZ} (Aufbau oder Abbau der Datei)`).toBe(0);
});
