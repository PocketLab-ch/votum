/**
 * Der Grund «Eingewendete Bestimmung» am Beschluss von Hand, am lebenden
 * Schema (Entscheid 0046, A7; Auftrag E2, Kriterien 2 bis 6).
 *
 * Der Weg: Der Saal stimmt mit Votum ab, das Gesetz nimmt den Antrag an, eine
 * eingewendete strengere Bestimmung lässt ihn scheitern, und die Leitung hält
 * «abgelehnt» fest. Geprüft wird, dass die Bestimmung in Festschreibung,
 * Verlauf, Protokoll und versiegeltem Paket steht, das Protokoll den Weg nicht
 * nennt und der Grund bei offener Abstimmung abgewiesen wird.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	haltBeschlussVonHandFest,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holePaket, versiegle } from '$lib/server/siegel';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import type { VonHandEingabe } from '$lib/domain/vonhand';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
	reglementsverhalten: 'vereinbart',
	fassung: '2026-11-11',
	juristischGegengelesen: false,
	astId: 'a-bau',
	knotenId: 'k-baulich-notwendig',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 647c',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

const BESTIMMUNG = 'Reglement Art. 14: drei Viertel aller Eigentümer (Prüflauf)';

const EINWAND: VonHandEingabe = {
	ergebnis: 'abgelehnt',
	zahlen: { erfassung: 'summen', koepfe: { ja: 3, nein: 1, enthaltung: 0 }, quoten: null },
	grund: 'eingewendete_bestimmung',
	einwand: BESTIMMUNG,
	einfuehrung: 'Beilage zum Begründungsakt (Prüflauf)'
};

async function versammlung(name: string, datum: string, erfordernis: Erfordernis = ERFORDERNIS) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Probe Alpha', 'Probe Beta', 'Probe Gamma', 'Probe Delta'].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 225 },
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
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, erfordernis);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
	return { versammlung: v.id, traktandum: t.id, parteien };
}

/** Drei Ja, ein Nein: nach dem Gesetz (einfaches Mehr) angenommen, nach drei Vierteln nicht. */
async function abstimmen(s: { versammlung: string; traktandum: string; parteien: string[] }) {
	await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
	await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
	await gibStimmenAb(
		handelnder(),
		s.versammlung,
		s.parteien.map((parteiId, i) => ({ parteiId, wahl: i < 3 ? ('yes' as const) : ('no' as const) })),
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	return schliesseAbstimmung(handelnder(), s.versammlung);
}

async function protokoll(versammlungId: string): Promise<string> {
	return (await stelleEntwurfZusammen(betreiber, versammlungId, new Date().toISOString(), 'Prüflauf')).replace(
		/\s+/g,
		' '
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Eingewendete Bestimmung');
	benutzer = await pruefbenutzer(betreiber, 'eingewendete-bestimmung');
});

afterAll(verbindungenSchliessen);

describe('Eingewendete Bestimmung nach gezählter Abstimmung', () => {
	it('hält «abgelehnt» fest, mit der Bestimmung in Festschreibung, Verlauf und Protokoll', async () => {
		const s = await versammlung('Einwandweg 1', '2027-11-01');
		const gezaehlt = await abstimmen(s);
		// Nach dem Gesetz angenommen: Genau dann braucht es den Weg.
		expect((await holeErgebnis(betreiber, s.versammlung, gezaehlt.id)).auszaehlung?.angenommen).toBe(true);

		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND);

		// Festschreibung (Kriterium 3).
		// Gelesen über die Festschreibung, wie jeder Leser (`ergebnisIn`).
		const festgehalten = (await holeErgebnis(betreiber, s.versammlung, durchgang.id)).auszaehlung;
		expect(festgehalten?.angenommen).toBe(false);
		expect(festgehalten?.vonHand?.einwand).toEqual({
			bestimmung: BESTIMMUNG,
			einfuehrung: 'Beilage zum Begründungsakt (Prüflauf)',
			knotenId: 'k-baulich-notwendig'
		});

		// Verlauf.
		const { zeilen } = await leseVerlauf(betreiber, {
			versammlung: s.versammlung,
			art: EREIGNISARTEN.beschlussVonHand
		});
		const eintrag = zeilen.find((z) => z.gegenstandId === durchgang.id);
		expect(eintrag?.angaben).toMatchObject({ ergebnis: 'abgelehnt', einwand: BESTIMMUNG });

		// Protokoll: Bestimmung und Ergebnis nach dem Gesetz, nicht der Weg (Kriterium 4).
		const text = await protokoll(s.versammlung);
		expect(text).toContain(`Eingewendet wurde diese Bestimmung: «${BESTIMMUNG}»`);
		expect(text).toContain('Eingeführt nach Angabe der Sitzungsleitung: Beilage zum Begründungsakt (Prüflauf).');
		expect(text).toContain('Nach dem Gesetz hätte der Antrag das nötige Mehr erreicht, nach dieser Bestimmung nicht.');
		// An der notwendigen Massnahme der Weg zum Gericht, aus der eingefrorenen Karte.
		expect(text).toContain('dass es sie anordnet (ZGB Art. 647 Abs. 2 Ziff. 1)');
		expect(text).not.toMatch(/von Hand festgehalten|Notweg|übergangen/);
	});

	it('steht im versiegelten Paket (Kriterium 5)', async () => {
		const s = await versammlung('Einwandweg 2', '2027-11-02');
		await abstimmen(s);
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND);
		await schliesseVersammlung(handelnder(), s.versammlung);
		await versiegle(handelnder(), s.versammlung, '2027-11-02 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, s.versammlung)) as Uint8Array);
		const stimmen = JSON.parse(new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)) as {
			durchgangId: string;
			vonHand: { einwand: string | null } | null;
		}[];
		expect(stimmen.find((z) => z.durchgangId === durchgang.id)?.vonHand?.einwand).toBe(BESTIMMUNG);
		const verlauf = new TextDecoder().decode(dateien.get('daten/verlauf.json') as Uint8Array);
		expect(verlauf).toContain(BESTIMMUNG);
	});

	it('weist ab, solange die Abstimmung offen ist; der Notweg geht weiter (Kriterium 6)', async () => {
		const s = await versammlung('Einwandweg 3', '2027-11-03');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND)
		).rejects.toMatchObject({ kennung: 'einwand_offen' });
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...EINWAND,
			grund: 'notweg',
			einwand: null,
			einfuehrung: null
		});
		expect(durchgang.zustand).toBe('geschlossen');
	});

	it('weist den Grund an einem Geschäft ohne vereinbarte Ordnung ab', async () => {
		const { reglementsverhalten: _weg, ...ohne } = ERFORDERNIS;
		const s = await versammlung('Einwandweg 5', '2027-11-05', { ...ohne, knotenId: 'k-verwaltung-gewoehnlich' });
		await abstimmen(s);
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND)
		).rejects.toMatchObject({ kennung: 'einwand_hier_nicht' });
	});

	it('weist ab, wenn das Gesetz den Antrag nicht angenommen hat (Featureprüfung Z2)', async () => {
		const s = await versammlung('Einwandweg 6', '2027-11-06');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.map((parteiId, i) => ({ parteiId, wahl: i < 1 ? ('yes' as const) : ('no' as const) })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(), s.versammlung);
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND)
		).rejects.toMatchObject({ kennung: 'einwand_ohne_annahme' });
		// Ohne jede Abstimmung ebenso.
		const ohne = await versammlung('Einwandweg 7', '2027-11-07');
		await expect(
			haltBeschlussVonHandFest(handelnder(), ohne.versammlung, ohne.traktandum, EINWAND)
		).rejects.toMatchObject({ kennung: 'einwand_ohne_annahme' });
	});

	it('weist den Grund unter einem von der Leitung gesetzten Mehr ab (Featureprüfung Z1)', async () => {
		// Gesetzt heisst: gewählt ohne Rechtsgrundlage (`mehrheitGesetzt`).
		const s = await versammlung('Einwandweg 8', '2027-11-08', {
			...ERFORDERNIS,
			quelle: 'gewaehlt',
			rechtsgrundlage: ''
		});
		await abstimmen(s);
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND)
		).rejects.toMatchObject({ kennung: 'einwand_hier_nicht' });
	});

	it('lässt den direkt gewählten Fall zu und die Berichtigung mit demselben Grund (Fix-Block M1, M2)', async () => {
		const s = await versammlung('Einwandweg 10', '2027-11-10', { ...ERFORDERNIS, quelle: 'gewaehlt' });
		await abstimmen(s);
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND);
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...EINWAND,
			einwand: `${BESTIMMUNG}, berichtigt`
		});
		const festgehalten = (await holeErgebnis(betreiber, s.versammlung, durchgang.id)).auszaehlung;
		expect(festgehalten?.vonHand?.einwand?.bestimmung).toBe(`${BESTIMMUNG}, berichtigt`);
	});

	it('lässt den aufgerufenen Punkt stehen (Featureprüfung Z3)', async () => {
		const s = await versammlung('Einwandweg 9', '2027-11-09');
		await abstimmen(s);
		const vorher = await imKontext(
			betreiber,
			(tx) => tx<{ at: Date | null }[]>`SELECT current_agenda_item_at AS at FROM meeting WHERE id = ${s.versammlung}`
		);
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, EINWAND);
		const nachher = await imKontext(
			betreiber,
			(tx) => tx<{ at: Date | null }[]>`SELECT current_agenda_item_at AS at FROM meeting WHERE id = ${s.versammlung}`
		);
		expect(nachher[0].at?.toISOString()).toBe(vorher[0].at?.toISOString());
	});

	it('weist «angenommen» und eine fehlende Bestimmung ab, ohne etwas zu schreiben', async () => {
		const s = await versammlung('Einwandweg 4', '2027-11-04');
		await abstimmen(s);
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, { ...EINWAND, ergebnis: 'angenommen' })
		).rejects.toMatchObject({ kennung: 'einwand_nur_ablehnung' });
		await expect(
			haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, { ...EINWAND, einwand: ' ' })
		).rejects.toMatchObject({ kennung: 'einwand_fehlt' });
		const [n] = await imKontext(
			betreiber,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM voting_round WHERE agenda_item_id = ${s.traktandum}`
		);
		expect(n.n).toBe(1);
	});
});
