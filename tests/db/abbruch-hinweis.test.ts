/**
 * Der Satz nach dem Abbruch einer Abstimmung (Auftrag Abschluss, C2, Hinweis
 * aus F6).
 *
 * Der Abbruch ist zweierlei: in der laufenden Versammlung die Korrektur einer
 * falsch eröffneten Abstimmung, nach dem Schluss der Ausweg aus der
 * Fehlersuche für einen Durchgang, der offen geblieben ist
 * (`docs/installation.md`). Der Satz «Geben Sie die Abstimmung erneut frei»
 * stimmt nur im ersten Fall; in einer geschlossenen Versammlung gibt es keine
 * neue Abstimmung. Geprüft über die Aktion der Leitungsseite, weil der Satz
 * dort entsteht.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Wie in `absagen-statt-500.test.ts`: Die Route zieht `$app/environment` herein.
vi.mock('$app/environment', () => ({
	building: false,
	browser: false,
	dev: true,
	version: 'test'
}));

import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { oeffneAbstimmung } from '$lib/server/abstimmung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { actions as leitungAktionen } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

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

/** Eine laufende Versammlung mit einer offenen Abstimmung. */
async function offeneAbstimmung(name: string): Promise<string> {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Prüfpartei Abbruch',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-10-16',
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
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
	await bestaetigeAnwesenheit(handelnder(), v.id, p.id, 'von_hand');
	await oeffneAbstimmung(handelnder(), v.id, t.id);
	return v.id;
}

async function brichAb(versammlung: string): Promise<string> {
	const daten = new FormData();
	daten.append('begruendung', 'Falsche Grundlage eröffnet');
	const ergebnis = await leitungAktionen.abbrechen({
		request: new Request('http://pruefung.example/aktion', { method: 'POST', body: daten }),
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-abbruch',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: versammlung },
		url: new URL('http://pruefung.example/versammlungen/x/leitung'),
		route: { id: '/pruefung' }
	} as never);
	return (ergebnis as { hinweis?: string }).hinweis ?? JSON.stringify(ergebnis);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abbruchsatz');
	benutzer = await pruefbenutzer(betreiber, 'abbruch-leitung');
});

afterAll(verbindungenSchliessen);

describe('Der Satz nach dem Abbruch', () => {
	it('verweist in der laufenden Versammlung auf das erneute Freigeben', async () => {
		const v = await offeneAbstimmung('Prüfhaus Abbruch laufend');
		expect(await brichAb(v)).toMatch(/erneut frei/);
	});

	it('verweist nach dem Schluss nicht auf eine Abstimmung, die es nicht mehr gibt', async () => {
		const v = await offeneAbstimmung('Prüfhaus Abbruch nach Schluss');
		// Von Hand hergestellt wie in `abschluss-rennen.test.ts` (F6): Der neue
		// Schluss lässt keinen offenen Durchgang mehr zurück.
		await admin`
			UPDATE meeting SET state = 'geschlossen', closed_at = now(),
			                   current_agenda_item_id = NULL, current_agenda_item_at = NULL
			 WHERE id = ${v}
		`;
		const satz = await brichAb(v);
		expect(satz).toMatch(/abgebrochen/);
		expect(satz).not.toMatch(/erneut frei/);
		expect(satz).toMatch(/geschlossen/);
	});
});
