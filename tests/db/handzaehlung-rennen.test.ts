/**
 * Die Handzählung als gleichwertiger Schreibweg (Sicherheitsdurchgang
 * 09.10.2026, Befunde S3, S4, S5).
 *
 * Die Summen-Erfassung schreibt auf denselben Durchgang wie die Einzelstimme.
 * Was dort gilt, muss deshalb auch hier gelten: keine Erfassung in der Pause,
 * kein Rennen, in dem beide Wege zugleich durchkommen, und beim Schliessen
 * keine zweite Prüfung gegen einen anderen Stand als beim Erfassen.
 *
 * Das Rennen wird gesteuert wie in `stimmweg-rennen.test.ts`: Eine dritte
 * Verbindung hält die Einheit der Momentaufnahme, an der die Stimme beim
 * Einfügen anhält, nachdem sie den Durchgang schon gelesen hat.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	setzePause
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import {
	erfasseSummen,
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung,
	zaehleStimmzeilen
} from '$lib/server/abstimmung';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

interface Haus {
	versammlung: string;
	traktandum: string;
	parteien: string[];
}

/** Eine laufende Versammlung, fünf anwesende Parteien, ein Traktandum mit einfachem Mehr. */
async function haus(name: string): Promise<Haus> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 500,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 0; i < 5; i++) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 100 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Prüfpartei ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-10-13',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Ersatz der Briefkastenanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Briefkastenanlage wird ersetzt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	}
	return { versammlung: v.id, traktandum: t.id, parteien };
}

async function summeAm(durchgangId: string) {
	const [z] = await admin<{ tally_yes: number | null }[]>`
		SELECT tally_yes FROM voting_round WHERE id = ${durchgangId}
	`;
	return z.tally_yes;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Handzählung im Rennen');
	benutzer = await pruefbenutzer(betreiber, 'handzaehlung-rennen');
});

afterAll(verbindungenSchliessen);

describe('S3: Handzählung in der Pause', () => {
	it('wird abgewiesen, wie die Einzelstimme', async () => {
		const h = await haus('Prüfhaus H4 Pause');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await setzePause(handelnder(), h.versammlung, { an: true, text: null });

		await expect(
			erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 1, enthaltung: 0, vermerk: null })
		).rejects.toMatchObject({ kennung: 'unterbrochen' });
		expect(await summeAm(d.id)).toBeNull();

		// Nach der Pause geht es weiter, und die Rücknahme ist ebenso gesperrt
		// wie das Erfassen: In der Pause bleibt die Zählung, wie sie ist.
		await setzePause(handelnder(), h.versammlung, { an: false });
		await erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 1, enthaltung: 0, vermerk: null });
		await setzePause(handelnder(), h.versammlung, { an: true, text: null });
		await expect(erfasseSummen(handelnder(), h.versammlung, null)).rejects.toMatchObject({
			kennung: 'unterbrochen'
		});
		expect(await summeAm(d.id)).toBe(3);
	});
});

describe('S4: Handzählung im Rennen mit einer Einzelstimme', () => {
	it('wartet auf die angefangene Stimme und weist danach ab', async () => {
		const h = await haus('Prüfhaus H4 Rennen');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);

		// Die Stimme liest den Durchgang (ohne Summe) und hält dann beim
		// Einfügen an der gesperrten Einheit an.
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`
				SELECT su.id FROM snapshot_unit su
				  JOIN snapshot_party sp ON sp.id = su.snapshot_party_id
				 WHERE sp.meeting_id = ${h.versammlung} AND sp.party_id = ${h.parteien[1]}
				   FOR UPDATE OF su
			`;
			expect(zeilen).toHaveLength(1);
		});
		const stimme = gibStimmenAb(
			handelnder(),
			h.versammlung,
			[{ parteiId: h.parteien[1], wahl: 'no' }],
			false
		);
		await warteAufWartende(1);
		const summe = erfasseSummen(handelnder(), h.versammlung, {
			ja: 3,
			nein: 1,
			enthaltung: 0,
			vermerk: null
		});
		// Der alte Code zählt die Stimmen, bevor die Stimme eingefügt ist, und
		// wartet erst beim Schreiben der Summe; der neue wartet schon beim Lesen.
		await warteAufWartende(2);
		await sperre.loesen();

		const [s, z] = await Promise.allSettled([stimme, summe]);
		expect(s.status).toBe('fulfilled');
		expect(z.status).toBe('rejected');
		const fehler = (z as PromiseRejectedResult).reason;
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect(fehler.kennung).toBe('stimmen_erfasst');

		// Am Durchgang steht nur einer der beiden Wege.
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBe(1);
		expect(await summeAm(d.id)).toBeNull();
	});
});

describe('S5: Weggang zwischen Handzählung und Schliessen', () => {
	it('schliesst die Abstimmung gegen den Stand beim Zählen', async () => {
		const h = await haus('Prüfhaus H4 Zählen A');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		// Alle fünf heben die Hand; danach geht eine Person.
		await erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 2, enthaltung: 0, vermerk: null });
		await erfasseVerlassenDerVersammlung(handelnder(), h.versammlung, h.parteien[4]);

		await schliesseAbstimmung(handelnder(), h.versammlung);

		const e = await holeErgebnis(betreiber, h.versammlung, d.id);
		expect(e.auszaehlung?.angenommen).toBe(true);
		expect(e.auszaehlung?.koepfe.ja).toBe(3);
		expect(e.auszaehlung?.koepfe.ohneAbgabe).toBe(0);
		// Im Protokoll stehen die Anwesenden des Augenblicks, in dem gezählt wurde.
		expect(e.durchgang.anwesende).toHaveLength(5);
		expect(e.durchgang.anwesende).toContain(h.parteien[4]);
	});

	it('lässt die Versammlung schliessen, auch mit offener Handzählung', async () => {
		const h = await haus('Prüfhaus H4 Zählen B');
		const d = await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 2, enthaltung: 0, vermerk: null });
		await erfasseVerlassenDerVersammlung(handelnder(), h.versammlung, h.parteien[4]);

		const r = await schliesseVersammlung(handelnder(), h.versammlung);
		expect(r.geschlosseneAbstimmungen).toBe(1);
		const e = await holeErgebnis(betreiber, h.versammlung, d.id);
		expect(e.auszaehlung?.angenommen).toBe(true);
	});

	it('friert mit einer neuen Zählung den neuen Stand ein', async () => {
		const h = await haus('Prüfhaus H4 Zählen C');
		await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 2, enthaltung: 0, vermerk: null });
		await erfasseVerlassenDerVersammlung(handelnder(), h.versammlung, h.parteien[4]);

		// Zurückgenommen und neu gezählt: Jetzt sind nur noch vier im Saal.
		await erfasseSummen(handelnder(), h.versammlung, null);
		await expect(
			erfasseSummen(handelnder(), h.versammlung, { ja: 3, nein: 2, enthaltung: 0, vermerk: null })
		).rejects.toMatchObject({ kennung: 'summe_zu_hoch' });
	});
});
