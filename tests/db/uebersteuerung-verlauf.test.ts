/**
 * Die Übersteuerung eines Erfordernisses am Traktandum steht im Verlauf
 * (Durchstich 30.09.2026).
 *
 * **Der Anlass.** Seit 96eb4b5 trägt die Rechtsgrundlage einer übersteuerten
 * Mehrheit nach aussen nichts mehr; Vorschlag, übergangene Grundlage,
 * Begründung und Risiko sollte allein das Ereignis `requirement.overridden`
 * festhalten. Die Route gab aber nur das Erfordernis weiter, und auf Dev stand
 * das Ereignis kein einziges Mal im Verlauf. Die Domänentests sahen das nicht,
 * weil sie `uebersteuere()` allein prüfen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { uebersteuere, waehleErfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Übersteuerung');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-uebersteuerung');
});

afterAll(verbindungenSchliessen);

async function traktandum() {
	const g = await erstelleGemeinschaft(handelnder(), {
		name: 'Übersteuerung: Erfundene Gemeinschaft',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Saal Erfunden',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		titel: 'Fassade erfunden',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	return { versammlung: v.id, traktandum: t.id };
}

async function eintraege(traktandumId: string) {
	return imKontext(betreiber, (tx) =>
		tx<{ event_type: string; subject_type: string; detail: Record<string, unknown> }[]>`
			SELECT event_type, subject_type, detail FROM audit_entry
			WHERE subject_id = ${traktandumId}
			  AND event_type IN ('requirement.overridden', 'requirement.set')
			ORDER BY id
		`
	);
}

describe('Übersteuerung am Traktandum', () => {
	it('hält Vorschlag, übergangene Grundlage und Begründung am Traktandum fest', async () => {
		const s = await traktandum();
		const rw = holeRegelwerk();
		const vorschlag = waehleErfordernis(rw, 'k-baulich-nuetzlich').ergebnis;
		const u = uebersteuere(rw, vorschlag, 'einfaches_mehr', 'Prüfung: bewusst tiefer gesetzt.');

		await haltErfordernisAmTraktandumFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			u.ergebnis,
			u.ereignisse
		);

		const alle = await eintraege(s.traktandum);
		const ueber = alle.filter((e) => e.event_type === 'requirement.overridden');
		expect(ueber).toHaveLength(1);
		expect(ueber[0].subject_type).toBe('agenda_item');
		expect(ueber[0].detail).toMatchObject({
			traktandum: 'Fassade erfunden',
			vorschlag: vorschlag.typ,
			gewaehlt: 'einfaches_mehr',
			begruendung: 'Prüfung: bewusst tiefer gesetzt.',
			vorschlagRechtsgrundlage: vorschlag.rechtsgrundlage
		});
		expect(vorschlag.rechtsgrundlage).not.toBe('');
		// Das Setzen selbst steht weiterhin genau einmal da.
		expect(alle.filter((e) => e.event_type === 'requirement.set')).toHaveLength(1);
	});

	it('schreibt ohne begleitende Ereignisse nur das Setzen', async () => {
		const s = await traktandum();
		const e = waehleErfordernis(holeRegelwerk(), 'k-baulich-nuetzlich').ergebnis;
		await haltErfordernisAmTraktandumFest(handelnder(), s.versammlung, s.traktandum, e);

		const alle = await eintraege(s.traktandum);
		expect(alle.map((x) => x.event_type)).toEqual(['requirement.set']);
	});
});
