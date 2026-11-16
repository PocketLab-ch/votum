/**
 * Die Schranken der Datenbank kennen jede Lesart am Knoten (Codeprüfung E1
 * L11, Befund 1).
 *
 * **Die Fehlerklasse.** Eine Lesart am Knoten steht am Erfordernis in
 * `agenda_item.requirement_reading` und, am Rückkommen auf einen Beschluss,
 * in `requirement_reading_reconsidered` (`erfordernisFuerRueckkommen`
 * übernimmt jede Kennung). Beide Spalten tragen eine Schranke mit der Liste
 * der Kennungen. Migration 186 zog zuerst nur die erste nach; das Rückkommen
 * auf eine Ermächtigung zur Prozessführung wäre an der zweiten gescheitert,
 * und kein Domain-Test hätte es gesehen. Dieser Test liest die jeweils letzte
 * Fassung beider Schranken aus `migrations/` und verlangt jede Kennung, die
 * irgendein Knoten irgendeiner Fassung als `lesart` trägt.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alleFassungen } from '$lib/rules';

const ORDNER = join(process.cwd(), 'migrations');

/** Die Kennungen in der letzten Fassung einer Schranke, aus dem Text der Migrationen. */
function kennungenDerSchranke(name: string): Set<string> {
	let zuletzt: string | null = null;
	for (const datei of readdirSync(ORDNER).filter((d) => d.endsWith('.sql')).sort()) {
		const text = readFileSync(join(ORDNER, datei), 'utf-8');
		const stelle = text.lastIndexOf(`ADD CONSTRAINT ${name}`);
		if (stelle < 0) continue;
		const rest = text.slice(stelle);
		const treffer = /->>'kennung' IN \(([^)]*)\)/.exec(rest);
		if (treffer) zuletzt = treffer[1];
	}
	if (zuletzt === null) throw new Error(`Die Schranke «${name}» steht in keiner Migration.`);
	return new Set([...zuletzt.matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

const AM_KNOTEN = new Set(
	alleFassungen().flatMap((rw) => rw.knoten.flatMap((k) => (k.lesart ? [k.lesart.kennung] : [])))
);

describe('Schranken der Lesarten am Knoten', () => {
	it('findet die Lesarten am Knoten und die Schranken überhaupt (Gegenprobe)', () => {
		expect(AM_KNOTEN.has('L2')).toBe(true);
		expect(kennungenDerSchranke('agenda_item_lesart_form').has('L2')).toBe(true);
	});

	for (const schranke of ['agenda_item_lesart_form', 'agenda_item_lesart_des_beschlusses_form']) {
		it(`«${schranke}» kennt jede Kennung, die ein Knoten trägt`, () => {
			const kennt = kennungenDerSchranke(schranke);
			expect([...AM_KNOTEN].filter((k) => !kennt.has(k))).toStrictEqual([]);
		});
	}
});
