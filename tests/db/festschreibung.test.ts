/**
 * Das verkündete Ergebnis wird festgeschrieben (Migration 123, seit 25.09.2026).
 *
 * **Produktentscheid 25.09.2026:** «nach jeder Abstimmung [soll] das bereits
 * abgestimmte nicht mehr verändert werden können (Momentaufnahme).» Bis dahin
 * zählte `ergebnisIn` jeden geschlossenen Durchgang bei jedem Lesen neu aus,
 * mit dem Code von heute.
 *
 * **Wie eine geänderte Zählregel hier nachgestellt wird.** Eine Codeänderung
 * lässt sich in einer Probe nicht einspielen. Was `ergebnisIn` früher bei jedem
 * Lesen neu rechnete, hängt aber an Eingaben in der Datenbank, und eine
 * geänderte Eingabe verändert die Rechnung genauso. Die Proben ändern deshalb
 * über die privilegierte Verbindung das eingefrorene Erfordernis eines
 * verkündeten Durchgangs. Wird noch gerechnet, kippt das Ergebnis; ist es
 * festgeschrieben, bleibt es.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	durchgangAngenommenInTx,
	gibStimmenAb,
	holeErgebnis,
	holeErgebnisse,
	haltStichentscheidFest,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { alsBetreiber } from '$lib/server/db';
import { FESTSCHREIBUNGSFORMAT } from '$lib/domain/festschreibung';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
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
	quelle: 'hergeleitet'
};

/** Die «geänderte Zählregel»: Einstimmigkeit aller, an der drei Ja zu vier scheitern. */
const STRENGER: Erfordernis = {
	...EINFACHES_MEHR,
	typ: 'einstimmigkeit',
	titel: 'Einstimmigkeit',
	kopfbasis: 'alle_eigentuemer',
	kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' }
};

/**
 * Parteien zu gleichen Wertquoten, alle anwesend, ein Traktandum aufgerufen.
 * Mit `tieBreak: 'verwalter'` und zwei Parteien entsteht der Gleichstand.
 */
async function laufend(
	name: string,
	datum: string,
	u: { parteien?: number; tieBreak?: 'verwalter' } = {}
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: u.tieBreak ?? 'keiner',
		tieBreakRuleSource: u.tieBreak ? 'Art. 7 Ziff. 5' : undefined
	});
	const namen = ['Erdbeer', 'Himbeer', 'Stachelbeer', 'Holunder'].slice(0, u.parteien ?? 4);
	const parteien: string[] = [];
	for (const [i, wer] of namen.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 1000 / namen.length },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Ersatz der Briefkastenanlage',
		art: 'abstimmung',
		antragswortlaut: 'Die Briefkastenanlage wird ersetzt.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
	return { versammlung: v.id, traktandum: t.id, parteien };
}

/** Drei Ja, ein Nein unter dem einfachen Mehr: angenommen. */
async function angenommenGeschlossen(name: string, datum: string) {
	const s = await laufend(name, datum);
	await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
	await gibStimmenAb(
		handelnder(betreiber),
		s.versammlung,
		[
			{ parteiId: s.parteien[0], wahl: 'yes' },
			{ parteiId: s.parteien[1], wahl: 'yes' },
			{ parteiId: s.parteien[2], wahl: 'yes' },
			{ parteiId: s.parteien[3], wahl: 'no' }
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
	return { ...s, durchgang: d.id };
}

async function zeile(durchgang: string) {
	const [z] = await admin<{ result_json: { format: number; auszaehlung: unknown } | null }[]>`
		SELECT result_json FROM voting_round WHERE id = ${durchgang}
	`;
	return z;
}

/**
 * Setzt `result_json` an einem verkündeten Durchgang, auch auf `NULL`. Der
 * Trigger aus Migration 123 sperrt das; deshalb für diese eine Zeile in einer
 * Transaktion mit abgeschalteten Triggern.
 */
async function setzeFestschreibung(durchgang: string, wert: unknown) {
	await admin.begin(async (tx) => {
		await tx`SET LOCAL session_replication_role = replica`;
		await tx`
			UPDATE voting_round SET result_json = ${wert === null ? null : tx.json(wert as never)}
			WHERE id = ${durchgang}
		`;
	});
}

/** Stellt eine geänderte Zählregel nach (siehe Kopf der Datei). */
async function aendereRechnung(durchgang: string) {
	await admin`
		UPDATE voting_round SET requirement_json = ${admin.json(STRENGER as never)}
		WHERE id = ${durchgang}
	`;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Festschreibung');
	benutzer = await pruefbenutzer(betreiber, 'festschreibungsleitung');
});

afterAll(verbindungenSchliessen);

describe('Das verkündete Ergebnis', () => {
	it('wird mit dem Schliessen festgeschrieben, und zwar das Ergebnis der Rechnung', async () => {
		const s = await angenommenGeschlossen('Festschreibeweg 1', '2027-09-01');
		const z = await zeile(s.durchgang);
		expect(z.result_json?.format).toBe(FESTSCHREIBUNGSFORMAT);

		// Verglichen mit der Rechnung, nicht mit dem Gelesenen: `holeErgebnis`
		// liest dieses `result_json` selbst, und der Vergleich wäre immer wahr
		// (Code-Review 25.09.2026, Befund 3). Ohne Festschreibung rechnet es.
		await setzeFestschreibung(s.durchgang, null);
		const gerechnet = await holeErgebnis(betreiber, s.versammlung, s.durchgang);
		expect(gerechnet.durchgang.verkuendetAm).not.toBeNull();
		expect(gerechnet.auszaehlung?.angenommen).toBe(true);
		expect(z.result_json?.auszaehlung).toEqual(gerechnet.auszaehlung);
	});

	it('ändert sich nicht mehr, wenn sich die Rechnung ändert', async () => {
		// Gegenprobe: Ohne Festschreibung rechnet `ergebnisIn` mit dem geänderten
		// Erfordernis, und drei Ja zu vier scheitern an der Einstimmigkeit.
		const s = await angenommenGeschlossen('Festschreibeweg 2', '2027-09-02');
		await aendereRechnung(s.durchgang);

		const nachher = await holeErgebnis(betreiber, s.versammlung, s.durchgang);
		expect(nachher.auszaehlung?.angenommen).toBe(true);
		expect(nachher.auszaehlung?.koepfe.schwelle).toBe(3);
	});

	it('wird bei Durchgängen ohne Festschreibung weiter gerechnet', async () => {
		/*
		 * Durchgänge, die vor dem 25.09.2026 verkündet wurden, tragen kein
		 * `result_json`. Nachgetragen wird nicht (Migration 123), also gilt für
		 * sie die Rechnung wie bisher. Nachgestellt, indem die Festschreibung
		 * entfernt wird; das sperrt der Trigger, darum für diese eine Zeile in
		 * einer Transaktion mit abgeschalteten Triggern.
		 */
		const s = await angenommenGeschlossen('Festschreibeweg 3', '2027-09-03');
		await setzeFestschreibung(s.durchgang, null);
		expect((await zeile(s.durchgang)).result_json).toBeNull();
		expect((await holeErgebnis(betreiber, s.versammlung, s.durchgang)).auszaehlung?.angenommen).toBe(
			true
		);

		await aendereRechnung(s.durchgang);
		const gerechnet = await holeErgebnis(betreiber, s.versammlung, s.durchgang);
		expect(gerechnet.auszaehlung?.angenommen).toBe(false);
	});
});

describe('Eine Festschreibung, die diese Fassung nicht lesen kann', () => {
	/*
	 * Nach einer Rücknahme auf eine ältere Fassung, die `docs/installation.md`
	 * den Regelfall nennt, kann ein Ergebnis in einem neueren Format stehen.
	 * Bis zum Code-Review vom 25.09.2026 (Befund 5) warf das Lesen dann, und
	 * mit ihm Leitung, Auswertung, Protokoll und Wand; `holeErgebnisse`
	 * verschluckte es still.
	 */
	it('zeigt einen Grund statt eines Ergebnisses und rechnet nicht neu', async () => {
		const s = await angenommenGeschlossen('Festschreibeweg 7', '2027-09-07');
		await setzeFestschreibung(s.durchgang, { format: 2, auszaehlung: { anders: true } });

		const e = await holeErgebnis(betreiber, s.versammlung, s.durchgang);
		expect(e.auszaehlung).toBeNull();
		expect(e.unlesbar).toBe(true);
		expect(e.grund).toMatch(/Format/);

		const mehrere = await holeErgebnisse(betreiber, s.versammlung, [s.durchgang]);
		expect(mehrere.get(s.durchgang)?.unlesbar).toBe(true);
	});

	it('lässt keine Folgerung «nicht angenommen» zu', async () => {
		// Beim Rückkommen entschiede sonst ein unlesbares Ergebnis still darüber,
		// ob ein Beschluss ersetzt wird.
		const s = await angenommenGeschlossen('Festschreibeweg 8', '2027-09-08');
		await setzeFestschreibung(s.durchgang, { format: 2, auszaehlung: { anders: true } });
		await expect(
			alsBetreiber(betreiber, (tx) => durchgangAngenommenInTx(tx, s.versammlung, s.durchgang))
		).rejects.toThrow(/Format/);
	});
});

describe('Die Festschreibung in der Datenbank', () => {
	it('lässt sich nicht mehr ändern, auch nicht über die privilegierte Verbindung', async () => {
		const s = await angenommenGeschlossen('Festschreibeweg 4', '2027-09-04');
		await expect(
			admin`UPDATE voting_round SET result_json = '{"format":1,"auszaehlung":{}}' WHERE id = ${s.durchgang}`
		).rejects.toThrow(/festgeschrieben/);
		await expect(
			admin`UPDATE voting_round SET result_json = NULL WHERE id = ${s.durchgang}`
		).rejects.toThrow(/festgeschrieben/);
	});

	it('gibt es nur an einem verkündeten Durchgang', async () => {
		const s = await laufend('Festschreibeweg 5', '2027-09-05');
		const offen = await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await expect(
			admin`UPDATE voting_round SET result_json = '{"format":1,"auszaehlung":{}}' WHERE id = ${offen.id}`
		).rejects.toThrow(/voting_round_festschreibung_verkuendet/);
	});
});

describe('Beim Stichentscheid des Verwalters', () => {
	async function gleichstand(name: string, datum: string) {
		const s = await laufend(name, datum, { parteien: 2, tieBreak: 'verwalter' });
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[
				{ parteiId: s.parteien[0], wahl: 'yes' },
				{ parteiId: s.parteien[1], wahl: 'no' }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
		return { ...s, durchgang: d.id };
	}

	it('wird erst mit dem Entscheid des Verwalters festgeschrieben', async () => {
		/*
		 * **Der Produktentscheid vom 28.09.2026 gilt wieder:** Das Schliessen
		 * verkündet nichts, solange der Entscheid fehlt; festgeschrieben wird
		 * erst mit dem Eintrag. Die Probe hält beides fest — das leere
		 * `result_json` nach dem Schliessen und die vollständige Festschreibung
		 * danach.
		 */
		const s = await gleichstand('Festschreibeweg 6', '2027-09-06');
		expect((await zeile(s.durchgang)).result_json).toBeNull();

		const d = await haltStichentscheidFest(handelnder(betreiber), s.versammlung, s.durchgang, {
			wahl: 'no',
			wer: 'Verwaltung Prüfhaus'
		});
		expect(d.verkuendetAm).not.toBeNull();

		const festgeschrieben = (await zeile(s.durchgang)).result_json?.auszaehlung as {
			angenommen: boolean;
			durchStichentscheid: boolean;
			stichentscheidOffen: boolean;
		};
		expect(festgeschrieben.angenommen).toBe(false);
		expect(festgeschrieben.durchStichentscheid).toBe(true);
		expect(festgeschrieben.stichentscheidOffen).toBe(false);
	});
});
