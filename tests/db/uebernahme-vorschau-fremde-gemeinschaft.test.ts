/**
 * Die Übernahme sagt unter einer fremden Gemeinschaft schon im ersten Schritt
 * ab (Auftrag 2g).
 *
 * **Der Anlass** (`docs/pendenzen-sicherheit.md`, «Übernahme: Vorschau unter A
 * mit der Gemeinschaft von B sagt nicht ab»). Nur `load` suchte die
 * Gemeinschaft; die drei Aktionen nahmen `params.id` ungeprüft. `pruefen`
 * zeigte unter A mit der Kennung von B «neu», `ausImmotool` fragte immotool,
 * bevor irgendetwas abwies. Von B war nichts zu sehen, der Zeilenschutz liest
 * dort leer: eine fehlende Absage, kein Leck.
 *
 * **Die Aktionen selbst, nicht `e2e/fremdbetreiber.mjs`:** Dessen Pfadteil
 * schickt einen leeren Rumpf; vor 2g scheiterte der schon an «Keine Datei
 * gewählt» (am Code gelesen), und eine Abweisung zählte der Lauf gleich.
 *
 * **Gezählt wird, ob gelesen wurde, nicht nur, was zurückkommt.** Bei
 * `uebernehmen` wäre die Antwort ohne die Prüfung dieselbe: Die Vorschau liest
 * die Quotenarten von B leer, die Rückfrage (409) bleibt aus, und
 * `fuehreUebernahmeAus` sagt seit 2f mit demselben Satz ab. Rot wird der Test
 * dort erst an `vorschauAusTabelle`, die vor der Absage nicht laufen darf.
 *
 * **Bewusst nicht in `waechter-k2.test.ts`:** Diese Datei steht nicht in
 * `MEINEN_IHN` (`waechter-netz.ts`).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Wie in `fremde-kennung-im-feld.test.ts`: Die Route zieht `$app/environment`.
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

// Nur `holeStammdaten` ersetzt; `ImmotoolFehler` und `istEingerichtet` kommen
// aus demselben Modul und bleiben echt. Im Prüflauf gibt es kein immotool.
vi.mock('$lib/server/immotool', async (importOriginal) => {
	const echt = await importOriginal<typeof import('$lib/server/immotool')>();
	return {
		...echt,
		holeStammdaten: vi.fn(async () => {
			throw new echt.ImmotoolFehler('Im Prüflauf ist kein immotool angebunden.');
		})
	};
});

// Echt, aber gezählt: Lesen die Aktionen den Bestand, bevor sie absagen?
vi.mock('$lib/server/uebernahme', async (importOriginal) => {
	const echt = await importOriginal<typeof import('$lib/server/uebernahme')>();
	return {
		...echt,
		vorschauAusTabelle: vi.fn(echt.vorschauAusTabelle),
		quotenschluessel: vi.fn(echt.quotenschluessel)
	};
});

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { holeStammdaten } from '$lib/server/immotool';
import { quotenschluessel, vorschauAusTabelle } from '$lib/server/uebernahme';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { actions } from '../../src/routes/gemeinschaften/[id=kennung]/uebernahme/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let gemeinschaftA: string;
let gemeinschaftB: string;

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

const EIGENTUEMER = [
	'voter_ref;display_name;person_names;ownership_type;legal_representatives',
	'E1;Erfunden Berta;;alleineigentum;'
].join('\n');

/** Stammquote 998 von 1000: Unter der eigenen Gemeinschaft folgt die Rückfrage. */
const EINHEITEN_UNGLEICH = [
	'holding_ref;label;owner_voter_ref;quota_units',
	'H1;1.1 Wohnung;E1;400',
	'H2;1.2 Wohnung;E1;598'
].join('\n');

const ABSAGE = {
	status: 400,
	data: {
		fehler: {
			nachricht: fremdeGemeinschaft('stwegId').message,
			feld: fremdeGemeinschaft('stwegId').feld
		}
	}
};

/** Wie `bestand()` in `uebernahme-fremde-gemeinschaft.test.ts`. */
async function bestand(): Promise<Record<string, number>> {
	const [z] = await admin<Record<string, number>[]>`
		SELECT
		  (SELECT count(*)::int FROM party WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS party,
		  (SELECT count(*)::int FROM unit WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit,
		  (SELECT count(*)::int FROM unit_ownership
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit_ownership,
		  (SELECT count(*)::int FROM party_member
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS party_member,
		  (SELECT count(*)::int FROM unit_quota
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS unit_quota,
		  (SELECT count(*)::int FROM usufruct
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS usufruct,
		  (SELECT count(*)::int FROM audit_entry
		    WHERE operator_id IN (${betreiberA}, ${betreiberB})) AS audit_entry
	`;
	return z;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Übernahmevorschau fremd A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-vorschau-a');
	betreiberB = await pruefbetreiber('Prüflauf Übernahmevorschau fremd B');
	const benutzerB = await pruefbenutzer(betreiberB, 'pruefer-vorschau-b');
	gemeinschaftA = (
		await erstelleGemeinschaft(
			{ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' },
			{ ...GEMEINSCHAFT, name: 'Erfundenweg 31' }
		)
	).id;
	gemeinschaftB = (
		await erstelleGemeinschaft(
			{ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' },
			{ ...GEMEINSCHAFT, name: 'Ausgedachtweg 32' }
		)
	).id;
});

beforeEach(() => {
	vi.mocked(holeStammdaten).mockClear();
	vi.mocked(vorschauAusTabelle).mockClear();
	vi.mocked(quotenschluessel).mockClear();
});

afterAll(verbindungenSchliessen);

/** Eine Aktion, wie SvelteKit sie aufruft, als A unter der Gemeinschaft `id`. */
async function rufe(
	aktion: (e: never) => unknown,
	id: string,
	felder: Record<string, string | File>
) {
	const daten = new FormData();
	for (const [feld, wert] of Object.entries(felder)) daten.append(feld, wert);
	const ereignis = {
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzerA,
				operatorId: betreiberA,
				username: 'pruefer-vorschau-a',
				displayName: 'Prüferin A',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id },
		url: new URL('http://pruefung.example/aktion'),
		route: { id: '/gemeinschaften/[id=kennung]/uebernahme' }
	};
	return aktion(ereignis as never);
}

const datei = () => new File([EIGENTUEMER], 'eigentuemer.csv', { type: 'text/csv' });

describe('Übernahme unter A mit der Gemeinschaft von B', () => {
	it('pruefen sagt ab, ohne Vorschau und ohne den Bestand zu lesen', async () => {
		const antwort = await rufe(actions.pruefen, gemeinschaftB, { datei: datei() });
		expect(antwort).toMatchObject(ABSAGE);
		// Ein Erfolg trägt `plaene` oben, eine Absage `data`: hier beides prüfen.
		expect(antwort).not.toHaveProperty('plaene');
		expect(antwort).not.toHaveProperty('data.plaene');
		expect(vorschauAusTabelle).not.toHaveBeenCalled();
	});

	it('uebernehmen sagt ab statt mit der Rückfrage, und nichts ändert sich', async () => {
		const vorher = await bestand();
		const antwort = await rufe(actions.uebernehmen, gemeinschaftB, {
			inhalt: EINHEITEN_UNGLEICH,
			stichtag: '2026-09-01'
		});
		expect(antwort).toMatchObject(ABSAGE);
		expect(antwort).not.toHaveProperty('data.warnungQuoten');
		expect(vorschauAusTabelle).not.toHaveBeenCalled();
		expect(await bestand()).toEqual(vorher);
	});

	it('ausImmotool sagt ab, bevor es immotool fragt', async () => {
		const antwort = await rufe(actions.ausImmotool, gemeinschaftB, {
			liegenschaft: '00000000-0000-4000-8000-000000000001',
			stichtag: '2026-09-01'
		});
		expect(antwort).toMatchObject(ABSAGE);
		expect(holeStammdaten).not.toHaveBeenCalled();
		expect(quotenschluessel).not.toHaveBeenCalled();
	});
});

describe('Gegenhälfte: dieselben Aufrufe unter der eigenen Gemeinschaft', () => {
	it('pruefen liefert die Vorschau wie bisher', async () => {
		const antwort = (await rufe(actions.pruefen, gemeinschaftA, { datei: datei() })) as {
			plaene: { art: string; zusammenfassung: { neu: number } }[];
		};
		expect(antwort.plaene).toHaveLength(1);
		expect(antwort.plaene[0]).toMatchObject({ art: 'eigentuemer', zusammenfassung: { neu: 1 } });
		// Der Zähler greift; sonst bewiese sein «nicht aufgerufen» oben nichts.
		expect(vorschauAusTabelle).toHaveBeenCalled();
	});

	it('uebernehmen stellt bei diesem Inhalt die Rückfrage', async () => {
		const vorher = await bestand();
		const antwort = await rufe(actions.uebernehmen, gemeinschaftA, {
			inhalt: EINHEITEN_UNGLEICH,
			stichtag: '2026-09-01'
		});
		expect(antwort).toMatchObject({ status: 409, data: { warnungQuoten: true } });
		expect(vorschauAusTabelle).toHaveBeenCalled();
		expect(await bestand()).toEqual(vorher);
	});

	it('ausImmotool fragt immotool', async () => {
		const antwort = await rufe(actions.ausImmotool, gemeinschaftA, {
			liegenschaft: '00000000-0000-4000-8000-000000000001',
			stichtag: '2026-09-01'
		});
		expect(quotenschluessel).toHaveBeenCalledTimes(1);
		expect(holeStammdaten).toHaveBeenCalledTimes(1);
		expect(antwort).toMatchObject({ status: 502 });
	});
});
