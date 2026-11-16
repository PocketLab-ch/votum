/**
 * Die bestätigte Zuordnung beim Freigeben (Ä-05, nur der Kern; Auftrag M4).
 *
 * Die Kette: Die Leitungsseite liest die Zuordnung (`holeZuordnung`) und
 * schickt ihre Marke mit dem Knopf; `oeffneAbstimmung` vergleicht sie mit dem
 * Stand beim Eröffnen und schreibt die Bestätigung in den Verlauf. Hat
 * ein anderes Gerät dazwischen den Ausstand geändert, wird nicht eröffnet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { holeZuordnung, oeffneAbstimmung } from '$lib/server/abstimmung';
import { holeTraktanden } from '$lib/server/traktanden';
import { erklaereAusstand } from '$lib/server/ausstand';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet',
	geschaeftsart: 'verwaltung_gewoehnlich'
};

/** Vier Eigentümer, drei anwesend, ein Traktandum aufgerufen. */
async function laufend(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Probe A', 'Probe B', 'Probe C', 'Probe D'].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		titel: 'Budget',
		art: 'abstimmung',
		antragswortlaut: 'Das Budget wird genehmigt.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien.slice(0, 3)) {
		await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(), v.id, t.id);
	return { versammlung: v.id, traktandum: t.id, parteien };
}

/**
 * Das Erfordernis so, wie die Leitungsseite es lädt (`holeTraktanden`), nicht
 * als Konstante: Die Marke muss gegen das jsonb aus `leseEroeffnungslage`
 * stimmen, und nur der echte Lesepfad hält diese Gleichheit fest
 * (Codeprüfung M4, N6).
 */
async function erfordernisWieDieSeite(versammlung: string, traktandum: string) {
	const k = (await holeTraktanden(betreiber, versammlung)).find((t) => t.knoten.id === traktandum);
	return k?.knoten.erfordernis ?? null;
}

async function eroeffnungseintraege(versammlung: string) {
	return imKontext(
		betreiber,
		(tx) => tx<{ detail: Record<string, unknown> }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${versammlung} AND event_type = 'vote.round.opened'
		`
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Freigabezuordnung');
	benutzer = await pruefbenutzer(betreiber, 'freigabeleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Zuordnung vor dem Freigeben', () => {
	it('nennt Geschäftsart, Ausstand und Anwesende, wie die Seite sie zeigt', async () => {
		const s = await laufend('Zuordnung 1', '2027-06-01');
		await erklaereAusstand(handelnder(), s.versammlung, s.traktandum, s.parteien[1], 'Eigene Offerte.');
		const z = await holeZuordnung(betreiber, s.versammlung, s.traktandum, await erfordernisWieDieSeite(s.versammlung, s.traktandum));
		expect(z.geschaeftsart).toBe('verwaltung_gewoehnlich');
		expect(z.erfordernis).toBe('Einfaches Mehr');
		expect(z.imAusstand).toEqual(['Probe B']);
		expect(z.anwesend).toBe(3);
		expect(z.gesamt).toBe(4);
	});

	it('schreibt die Bestätigung in den Verlauf, wenn die Marke noch gilt', async () => {
		const s = await laufend('Zuordnung 2', '2027-06-02');
		const z = await holeZuordnung(betreiber, s.versammlung, s.traktandum, await erfordernisWieDieSeite(s.versammlung, s.traktandum));
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum, { zuordnung: z.marke });
		const [e] = await eroeffnungseintraege(s.versammlung);
		expect(e.detail.zuordnungBestaetigt).toEqual({
			geschaeftsart: 'verwaltung_gewoehnlich',
			erfordernis: 'Einfaches Mehr',
			imAusstand: [],
			anwesend: '3 von 4 Parteien'
		});
	});

	it('eröffnet nicht, wenn ein anderes Gerät seither den Ausstand geändert hat', async () => {
		const s = await laufend('Zuordnung 3', '2027-06-03');
		const z = await holeZuordnung(betreiber, s.versammlung, s.traktandum, await erfordernisWieDieSeite(s.versammlung, s.traktandum));
		await erklaereAusstand(handelnder(), s.versammlung, s.traktandum, s.parteien[0], 'Eigene Offerte.');
		await expect(
			oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum, { zuordnung: z.marke })
		).rejects.toMatchObject({ kennung: 'zuordnung_geaendert' });
		expect(await eroeffnungseintraege(s.versammlung)).toHaveLength(0);
	});

	it('eröffnet ohne Marke wie bisher, ohne Bestätigung im Verlauf', async () => {
		const s = await laufend('Zuordnung 4', '2027-06-04');
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		const [e] = await eroeffnungseintraege(s.versammlung);
		expect(e.detail).not.toHaveProperty('zuordnungBestaetigt');
	});
});
