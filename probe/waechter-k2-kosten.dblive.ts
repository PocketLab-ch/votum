/**
 * Was kostet der Wächter über K2 (Migration 177) auf dem Massenweg?
 *
 * **Nicht Teil von `npm run pruefen`**: eine Messung, kein Nachweis. Der
 * teuerste Weg ist die Übernahme aus Datei mit Eigentumswechsel, weil sie je
 * Einheit einen Verlaufseintrag in derselben Transaktion schreibt
 * (`uebernahme.ts`, `eigentumBeendet`). Gefahren wird abwechselnd mit und ohne
 * Auslöser, damit Aufwärmen und Cache nicht nur einer Seite zugutekommen;
 * dazu 1000 Einträge mit je zwei Kennungen (die eigene Gemeinschaft und eine,
 * die es nicht gibt) unmittelbar über `schreibeVerlauf`. Ergebnis in
 * `docs/proben.md`.
 *
 * ```bash
 * docker compose exec -T app sh -c 'VERSAMMLUNG_PRUEFDB=versammlung_probe_$$ npx vitest run --config probe/db.config.ts probe/waechter-k2-kosten.dblive.ts'
 * ```
 */
import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { fuehreUebernahmeAus } from '$lib/server/uebernahme';
import { alsBetreiber } from '$lib/server/db';
import { schreibeVerlauf } from '$lib/server/audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { admin, pruefbetreiber, verbindungenSchliessen } from '../tests/db/helfer';

const EINHEITEN = 300;
const RUNDEN = 3;

afterAll(verbindungenSchliessen);

async function ausloeser(an: boolean) {
	await admin.unsafe(
		`ALTER TABLE audit_entry ${an ? 'ENABLE' : 'DISABLE'} TRIGGER audit_entry_ohne_fremde_kennung`
	);
}

function median(werte: number[]): number {
	const s = [...werte].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
}

it('Übernahme mit Eigentumswechsel und Einzeleinträge, mit und ohne Auslöser', async () => {
	const betreiber = await pruefbetreiber('Probe K2 Kosten');
	const h = { operatorId: betreiber, userId: null, label: 'Probe' };
	const g = await erstelleGemeinschaft(h, {
		name: 'Erfundenweg 31',
		quotaDenominator: EINHEITEN,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	await fuehreUebernahmeAus(
		h,
		g.id,
		[
			'voter_ref;display_name;person_names;ownership_type;legal_representatives',
			'E1;Erfunden Eins;;alleineigentum;',
			'E2;Erfunden Zwei;;alleineigentum;'
		].join('\n'),
		'2026-01-01'
	);
	const einheiten = (eigentuemer: string) =>
		[
			'holding_ref;holding_type;label;owner_voter_ref;quota_units',
			...Array.from({ length: EINHEITEN }, (_, i) => `H${i};unit;${i} Wohnung;${eigentuemer};1`)
		].join('\n');
	await fuehreUebernahmeAus(h, g.id, einheiten('E1'), '2026-01-01');

	const zeiten: Record<'mit' | 'ohne', number[]> = { mit: [], ohne: [] };
	const einzeln: Record<'mit' | 'ohne', number[]> = { mit: [], ohne: [] };
	let tag = 2;
	let eigentuemer = 'E2';
	try {
		for (let r = 0; r < RUNDEN; r++) {
			for (const seite of r % 2 === 0 ? (['mit', 'ohne'] as const) : (['ohne', 'mit'] as const)) {
				await ausloeser(seite === 'mit');
				const [vorher] = await admin<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_entry`;
				const stichtag = `2026-02-${String(tag++).padStart(2, '0')}`;
				const t0 = performance.now();
				await fuehreUebernahmeAus(h, g.id, einheiten(eigentuemer), stichtag);
				zeiten[seite].push(performance.now() - t0);
				const [nachher] = await admin<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_entry`;
				// Sonst misst die Probe eine Übernahme ohne Wechsel.
				expect(nachher.n - vorher.n).toBeGreaterThanOrEqual(EINHEITEN);
				eigentuemer = eigentuemer === 'E1' ? 'E2' : 'E1';

				const t1 = performance.now();
				await alsBetreiber(betreiber, async (tx) => {
					for (let i = 0; i < 1000; i++) {
						await schreibeVerlauf(
							tx,
							h,
							ereignis(
								EREIGNISARTEN.gemeinschaftGeaendert,
								{ art: 'stweg', id: g.id },
								{ vorlage: randomUUID() }
							)
						);
					}
				});
				einzeln[seite].push(performance.now() - t1);
			}
		}
	} finally {
		await ausloeser(true);
	}

	const zeile = (name: string, w: Record<'mit' | 'ohne', number[]>, je: number) => {
		const mit = median(w.mit);
		const ohne = median(w.ohne);
		return (
			`${name}: ohne ${ohne.toFixed(0)} ms, mit ${mit.toFixed(0)} ms (Median aus ${RUNDEN}), ` +
			`Aufschlag ${(mit - ohne).toFixed(0)} ms, ${((mit - ohne) / je).toFixed(2)} ms je Eintrag; ` +
			`roh ohne [${w.ohne.map((x) => x.toFixed(0)).join(', ')}], mit [${w.mit.map((x) => x.toFixed(0)).join(', ')}]`
		);
	};
	console.log(`KOSTEN ${zeile(`Übernahme, ${EINHEITEN} Eigentumswechsel`, zeiten, EINHEITEN)}`);
	console.log(`KOSTEN ${zeile('1000 Einträge in einer Transaktion', einzeln, 1000)}`);
}, 600_000);
