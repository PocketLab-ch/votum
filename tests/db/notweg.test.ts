/**
 * Der Notweg an der gemeinsamen Steuerung vorbei hinterlässt eine Spur
 * (Erhebung der Sperrstellen, 30.09.2026, Befund 1).
 *
 * **Der Anlass.** Der Kommentar an `nurWennNichtAmAbend` versprach seit dem
 * 25.08.2026, ein Aufruf über den Notweg «steht im Verlauf». Geschrieben wurde
 * nichts: Die Leitungsseite liess die Handlung nur durch. Produktentscheid
 * 30.09.2026: «Das ist nicht gut. Muss korrigiert werden.»
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { abendSperrt, erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Notweg');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-notweg');
});

afterAll(verbindungenSchliessen);

async function versammlung(name: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	return erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Saal Erfunden',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
}

async function eintraege(meetingId: string) {
	return imKontext(betreiber, (tx) =>
		tx<{ actor_label: string; detail: Record<string, unknown> }[]>`
			SELECT actor_label, detail FROM audit_entry
			WHERE event_type = 'meeting.day.bypassed'
			  AND subject_type = 'meeting' AND subject_id = ${meetingId}
		`
	);
}

describe('Notweg zur Einzelleitung', () => {
	it('sperrt ohne Notweg und hält den Notweg mit Aktion, Abend und Person fest', async () => {
		const m = await versammlung('Notweg: am Abend');
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Notweg-Abend',
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Saal Erfunden',
			art: 'ordentlich'
		});
		await nimmInTagAuf(handelnder(), tag.id, m.id, 1, true);

		// Ohne Notweg: gesperrt, und nichts im Verlauf.
		expect((await abendSperrt(handelnder(), m.id, 'aufrufen', false))?.id).toBe(tag.id);
		expect(await eintraege(m.id)).toHaveLength(0);

		// Mit Notweg: frei, und die Wahl steht im Verlauf.
		expect(await abendSperrt(handelnder(), m.id, 'aufrufen', true)).toBeNull();

		const liste = await eintraege(m.id);
		expect(liste).toHaveLength(1);
		expect(liste[0].actor_label).toBe('Prüferin');
		expect(liste[0].detail).toMatchObject({
			aktion: 'aufrufen',
			abend: tag.id,
			abendBezeichnung: 'Notweg-Abend'
		});
	});

	it('schreibt nichts, wenn die Versammlung an keinem Abend tagt', async () => {
		// Dann gibt es keine gemeinsame Steuerung, an der vorbeigeführt würde.
		const m = await versammlung('Notweg: allein');
		expect(await abendSperrt(handelnder(), m.id, 'aufrufen', true)).toBeNull();
		expect(await abendSperrt(handelnder(), m.id, 'aufrufen', false)).toBeNull();
		expect(await eintraege(m.id)).toHaveLength(0);
	});
});
