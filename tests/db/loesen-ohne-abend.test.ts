/**
 * Lösen aus dem Abend, wenn es keinen Abend gibt.
 *
 * **Der Befund (Codeprüfung 27.10.2026, am Code gelesen).** Die Aktion `tag`
 * unter `/versammlungen/[id]` ruft `nimmAusTag` auch für eine Versammlung, die
 * für sich allein steht. Das UPDATE änderte nichts, der Verlauf hielt
 * trotzdem «aus der gemeinsamen Versammlung gelöst» fest. Der Verlauf ist nur
 * anfügbar; ein solcher Eintrag bleibt.
 *
 * Gemessen wird die Wirkung in der Datenbank, mit beiden Gegenhälften: Mit
 * Abend wird weiter gelöst und verzeichnet, eine fremde Versammlung wird
 * weiter abgewiesen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmAusTag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let benutzerA: string;
let betreiberB: string;
let benutzerB: string;

const handelnderA = () => ({ operatorId: betreiberA, userId: benutzerA, label: 'Prüferin A' });
const handelnderB = () => ({ operatorId: betreiberB, userId: benutzerB, label: 'Prüferin B' });

const GEMEINSCHAFT = {
	quotaDenominator: 1000,
	headCountMode: 'per_owner' as const,
	parkingCountsAsHead: false,
	parentStwegId: null
};

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Prüflauf Lösen ohne Abend A');
	benutzerA = await pruefbenutzer(betreiberA, 'pruefer-loesen-a');
	betreiberB = await pruefbetreiber('Prüflauf Lösen ohne Abend B');
	benutzerB = await pruefbenutzer(betreiberB, 'pruefer-loesen-b');
});

afterAll(verbindungenSchliessen);

/** Eine Versammlung einer neuen Gemeinschaft, ohne Abend. */
async function versammlung(handelnder: typeof handelnderA, name: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(), { ...GEMEINSCHAFT, name });
	return (
		await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Probesaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		})
	).id;
}

/** Alle Verlaufseinträge über die Versammlung, gleich welcher Betreiber. */
async function eintraegeUeber(kennung: string): Promise<string[]> {
	const zeilen = await admin<{ event_type: string }[]>`
		SELECT event_type FROM audit_entry WHERE subject_id = ${kennung} ORDER BY id
	`;
	return zeilen.map((z) => z.event_type);
}

/** Die ganze Zeile: «unverändert» heisst jede Spalte, auch `updated_at`. */
async function zeile(kennung: string) {
	const [z] = await admin<{ z: Record<string, unknown> }[]>`
		SELECT to_jsonb(m) AS z FROM meeting m WHERE id = ${kennung}
	`;
	return z.z;
}

describe('nimmAusTag', () => {
	it('ohne Abend: kein Verlauf, nichts geändert, Rückgabe ohne Abend', async () => {
		const m = await versammlung(handelnderA, 'Einzelweg 1');
		const eintraegeVorher = await eintraegeUeber(m);
		const vorher = await zeile(m);

		expect(await nimmAusTag(handelnderA(), m)).toEqual({ tagId: null, stelle: 0 });

		expect(await eintraegeUeber(m)).toEqual(eintraegeVorher);
		expect(await zeile(m)).toEqual(vorher);
	});

	it('mit Abend: gelöst, genau ein Eintrag «meeting.day.left» (Gegenhälfte)', async () => {
		const m = await versammlung(handelnderA, 'Abendweg 2');
		const tag = await erstelleVersammlungstag(handelnderA(), {
			bezeichnung: 'Probeabend',
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Probesaal',
			bemerkung: null
		});
		await nimmInTagAuf(handelnderA(), tag.id, m, 3);
		const gezaehlt = (e: string[]) => e.filter((t) => t === EREIGNISARTEN.versammlungAusTag).length;
		expect(gezaehlt(await eintraegeUeber(m))).toBe(0);

		expect(await nimmAusTag(handelnderA(), m)).toEqual({ tagId: tag.id, stelle: 3 });

		expect(gezaehlt(await eintraegeUeber(m))).toBe(1);
		const z = await zeile(m);
		expect(z.meeting_day_id).toBeNull();
		expect(z.day_position).toBeNull();
	});

	it('fremde Versammlung: weiter «Versammlung nicht gefunden.», kein Eintrag', async () => {
		const fremd = await versammlung(handelnderB, 'Fremdweg 3');
		const eintraegeVorher = await eintraegeUeber(fremd);

		const absage = nimmAusTag(handelnderA(), fremd);
		await expect(absage).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(absage).rejects.toThrow('Versammlung nicht gefunden.');

		expect(await eintraegeUeber(fremd)).toEqual(eintraegeVorher);
	});
});
