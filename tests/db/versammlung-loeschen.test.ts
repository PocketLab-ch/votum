/**
 * Eine Versammlung im Entwurf löschen — und die Schranken drumherum.
 *
 * Hier liegt der Teil, den der Kern nicht garantieren kann: dass die
 * Anwendungsrolle `meeting` weiterhin **nicht** löschen darf, dass der eine eng
 * gefasste Weg daneben (Migration 058) den Zustand selbst prüft, und dass die
 * abhängigen Zeilen mitgehen statt an einem Fremdschlüssel hängenzubleiben.
 *
 * Der Anlass, 11.08.2026: Wer eine Gemeinschaft aus einer gemeinsamen
 * Versammlung löste, hatte danach eine Versammlung, die er nicht loswurde.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	erstelleVersammlung,
	holeVersammlung,
	loescheVersammlung
} from '$lib/server/versammlungen';
import {
	erstelleVersammlungstag,
	holeMittagende,
	nimmInTagAuf
} from '$lib/server/versammlungstag';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { VersammlungEingabe } from '$lib/domain/versammlung';

let betreiber: string;
let stweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

function eingabe(aenderung: Partial<VersammlungEingabe> = {}): VersammlungEingabe {
	return {
		stwegId: stweg,
		datum: '2026-10-08',
		uhrzeit: '19:00',
		ort: 'Halle der Proben',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach',
		...aenderung
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Löschen Prüflauf');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Löschweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(verbindungenSchliessen);

describe('loescheVersammlung', () => {
	it('fragt zuerst nach — und sagt dabei, was verschwindet', async () => {
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe());
		await expect(loescheVersammlung(handelnder(betreiber), v.id)).rejects.toMatchObject({
			feld: 'bestaetigen'
		});
		// Nichts getan: Die Versammlung steht noch.
		expect(await holeVersammlung(betreiber, v.id)).not.toBeNull();
	});

	it('löscht die Versammlung samt ihrer Pflichttraktanden', async () => {
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe());
		const vorher = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM agenda_item WHERE meeting_id = ${v.id}
		`);
		// Ohne Traktanden wäre der Zählwert unten wertlos.
		expect(vorher[0].n).toBeGreaterThan(0);

		const weg = await loescheVersammlung(handelnder(betreiber), v.id, true);
		expect(weg.traktanden).toBe(vorher[0].n);
		expect(await holeVersammlung(betreiber, v.id)).toBeNull();

		const rest = await imKontext(betreiber, (tx) => tx<{ n: number }[]>`
			SELECT count(*)::int AS n FROM agenda_item WHERE meeting_id = ${v.id}
		`);
		expect(rest[0].n).toBe(0);
	});

	it('lässt den Verlaufseintrag stehen — eine Löschung ist nicht spurlos', async () => {
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe());
		await loescheVersammlung(handelnder(betreiber), v.id, true);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: { datum: string } }[]>`
			SELECT detail FROM audit_entry
			 WHERE subject_id = ${v.id} AND event_type = 'meeting.deleted'
		`);
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].detail.datum).toContain('2026-10-08');
	});

	it('weist eine Versammlung ab, auf die eine Zweitversammlung verweist', async () => {
		const erste = await erstelleVersammlung(
			handelnder(betreiber),
			eingabe({ datum: '2026-11-02' })
		);
		await erstelleVersammlung(
			handelnder(betreiber),
			eingabe({ datum: '2026-11-13', stufe: 'zweite', vorgaengerId: erste.id })
		);
		await expect(
			loescheVersammlung(handelnder(betreiber), erste.id, true)
		).rejects.toThrow(/Vorgängerin/);
	});

	it('nimmt sie aus der gemeinsamen Versammlung, wenn sie dort mittagt', async () => {
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: 'Prüflauf gemeinsam',
			datum: '2026-12-01',
			uhrzeit: '19:00',
			ort: 'Halle der Proben'
		});
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe({ datum: '2026-12-01' }));
		await nimmInTagAuf(handelnder(betreiber), tag.id, v.id, 0);
		expect(await holeMittagende(betreiber, tag.id)).toHaveLength(1);

		await loescheVersammlung(handelnder(betreiber), v.id, true);
		expect(await holeMittagende(betreiber, tag.id)).toHaveLength(0);
	});

	it('lässt die Anwendungsrolle weiterhin nicht selbst löschen', async () => {
		// Die Schranke aus Migration 011 bleibt: Der neue Weg ist eine Funktion
		// mit den Rechten ihres Eigentümers, kein GRANT DELETE.
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe());
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM meeting WHERE id = ${v.id}`)
		).rejects.toThrow(/denied|verweigert/i);
	});

	it('lässt die Datenbankfunktion nicht in fremde Daten greifen', async () => {
		const fremd = await pruefbetreiber('Löschen fremd');
		const v = await erstelleVersammlung(handelnder(betreiber), eingabe());
		// Der Betreiber wird der Funktion mitgegeben und von ihr geprüft; sonst
		// wäre sie ein Loch neben dem Zeilenschutz.
		await expect(
			imKontext(fremd, (tx) => tx`SELECT * FROM versammlung_loeschen(${fremd}, ${v.id})`)
		).rejects.toThrow(/gibt es nicht/);
		expect(await holeVersammlung(betreiber, v.id)).not.toBeNull();
	});
});
