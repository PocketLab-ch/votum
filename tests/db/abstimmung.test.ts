/**
 * Abstimmungsdurchgänge, Stimmen und Ergebnis in der Datenbank (Epic 5).
 *
 * Der Kern rechnet mit einer Wertetabelle als Netz (`tests/domain/auszaehlung`).
 * Hier wird geprüft, was sich nur an der Datenbank zeigt: dass die Regeln als
 * Bedingungen greifen, dass die eingefrorenen Angaben eingefroren bleiben, und
 * dass nichts geändert oder gelöscht werden kann, was als Beleg dasteht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	loeseAnzeigecodeAuf,
	schliesseVersammlung,
	erneuereAnzeigecode,
	setzeWandbild,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	nimmRueckzugZurueck,
	stelleRueckkommensantrag,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import { alsBetreiber } from '$lib/server/db';
import { holeAuswertung } from '$lib/server/auswertung';
import { erzeugeAuswertung } from '$lib/server/pdf/auswertung';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import {
	erfasseSummen,
	gibStimmenAb,
	haltBeschlussVonHandFest,
	holeStellvertretendeStimmen,
	haltBeschlusstextFest,
	haltStichentscheidFest,
	holeDurchgaenge,
	holeErgebnis,
	holeFortschritt,
	holeOffenen,
	oeffneAbstimmung,
	brecheAbstimmungAb,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
,
	zaehleStimmzeilen
} from '$lib/server/abstimmung';
import {
	imKontext,
	ohneKontext,
	pruefbenutzer,
	pruefbetreiber,
	verbindungenSchliessen
} from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Stichentscheid } from '$lib/domain/types';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { haltWiderspruchFest, setzeLeitungsvertreter } from '$lib/server/universal';
import { halteSperre, warteAufWartende } from './rennen';
import { vollmachtsschluessel } from '$lib/domain/vollmacht';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { UNIVERSAL_FRUEHERER_BESCHLUSS, UNIVERSAL_KENNTNIS } from '$lib/domain/ausnahmen';
import {
	bestaetigeVollmacht,
	erfasseVollmacht,
	holeParteien,
	vermerkeVorlage,
	widerrufeVollmacht
} from '$lib/server/vollmacht';
import { ergebnislage } from '$lib/domain/auszaehlung';
import { KONSULTATIV_WERTUNG } from '$lib/domain/konsultativ';
import { erstelleVersammlungstag } from '$lib/server/versammlungstag';
import { holePaket, versiegle } from '$lib/server/siegel';

let betreiber: string;
let betreiberB: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
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

/**
 * Baut eine laufende Versammlung mit zwei Eigentümern und einem
 * Abstimmungstraktandum samt Erfordernis.
 */
async function aufbau(
	name: string,
	datum: string,
	u: {
		erfordernis?: Erfordernis | null;
		anwesend?: number;
		betriebsart?: 'gefuehrt' | 'einfach';
		tieBreak?: Stichentscheid;
		/** Fundstelle, wenn das Reglement Beschlüsse über nicht Angekündigtes gestattet. */
		reglementGestattet?: string;
		/** Wer an der Universalversammlung als da gilt; Vorgabe «persönlich» (Migration 128). */
		universalvariante?: 'persoenlich' | 'vertreten' | 'keine';
	} = {}
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: u.tieBreak ?? 'keiner',
		tieBreakRuleSource: u.tieBreak && u.tieBreak !== 'keiner' ? 'Art. 7 Ziff. 5' : undefined
	});
	if (u.reglementGestattet) {
		await speichereAusnahmen(handelnder(betreiber), g.id, {
			reglementGestattet: true,
			reglementFundstelle: u.reglementGestattet
		});
	}
	if (u.universalvariante) {
		await speichereAusnahmen(handelnder(betreiber), g.id, { universalvariante: u.universalvariante });
	}

	const parteien: string[] = [];
	for (const [nummer, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: nummer === 0 ? 'Anna Muster' : 'Peter Kunz',
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
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: u.betriebsart ?? 'gefuehrt'
	});

	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});

	const kenntnis = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Jahresbericht',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});

	if (u.erfordernis !== null) {
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			v.id,
			t.id,
			u.erfordernis ?? EINFACHES_MEHR
		);
	}

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	const eroeffnet = await eroeffneVersammlung(handelnder(betreiber), v.id);

	for (const p of parteien.slice(0, u.anwesend ?? 2)) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}

	return {
		versammlung: v.id,
		traktandum: t.id,
		kenntnisnahme: kenntnis.id,
		stweg: g.id,
		parteien,
		anzeigecode: eroeffnet.anzeigecode
	};
}

/**
 * Ein geschlossener Durchgang mit offenem Gleichstand: Das Reglement weist den
 * Stichentscheid dem Verwalter zu, und eingetragen ist er nicht. Sein Ergebnis
 * ist nicht verkündet; seit H6 ist das der Durchgang, den die Leitung noch mit
 * einer Neuabstimmung überholen darf.
 */
async function gleichstandGeschlossen(name: string, datum: string) {
	const a = await aufbau(name, datum, { tieBreak: 'verwalter' });
	await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
	await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
	await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'no' }], false);
	const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	expect(d.verkuendetAm).toBeNull();
	return { ...a, d };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abstimmung A');
	betreiberB = await pruefbetreiber('Abstimmung B');
	benutzer = await pruefbenutzer(betreiber, 'pruefleitung');
});

afterAll(verbindungenSchliessen);

describe('Freigeben', () => {
	it('friert die Enthaltungsregel mit ein', async () => {
		/*
		 * **Hier hätte die Behebung geendet** (04.09.2026, aus dem Code-Review).
		 * `oeffneAbstimmung` baut das Erfordernis aus den Einzelspalten zu einem
		 * JSON zusammen und schreibt es an den Durchgang fest. Dieses JSON ist die
		 * **einzige** Quelle beider Auszählwege. Fehlt darin ein Merkmal, sind
		 * Kern, Übersetzung und Speicherweg grün, und die Anwendung rechnet
		 * trotzdem weiter falsch: Alle drei Ebenen enden vor dieser Stelle.
		 */
		const a = await aufbau('Abstimmweg Enthaltung', '2026-09-19', {
			erfordernis: {
				fassung: '2026-08-16',
				juristischGegengelesen: false,
				astId: 'a-reglement',
				knotenId: 'k-verwaltung-gewoehnlich',
				typ: 'reglementsmehr',
				titel: 'Reglementsmehr',
				rechtsgrundlage: 'Reglement der Gemeinschaft, Ziff. 9',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine',
				kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenSchwelle: null,
				enthaltungZaehltMit: false,
				zustimmungBetroffenerNoetig: false,
				pfad: [],
				quelle: 'reglement'
			}
		});
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(d.erfordernis?.typ).toBe('reglementsmehr');
		expect(d.erfordernis?.enthaltungZaehltMit).toBe(false);
	});

	it('eröffnet einen Durchgang und stellt die Versammlung auf das Traktandum', async () => {
		const a = await aufbau('Abstimmweg 1', '2026-09-15');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		expect(d.zustand).toBe('offen');
		expect(d.nummer).toBe(1);
		// Das Erfordernis wandert schon beim Eröffnen mit (AD-4).
		expect(d.erfordernis?.typ).toBe('einfaches_mehr');

		const [m] = await imKontext(betreiber, (tx) => tx<{ current_agenda_item_id: string }[]>`
			SELECT current_agenda_item_id FROM meeting WHERE id = ${a.versammlung}
		`);
		expect(m.current_agenda_item_id).toBe(a.traktandum);
	});

	it('weist eine zweite offene Abstimmung ab', async () => {
		const a = await aufbau('Abstimmweg 2', '2026-09-16');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/bereits eine Abstimmung offen/);
	});

	it('lässt die Datenbank keine zwei offenen Durchgänge zu', async () => {
		// Als Bedingung und nicht bloss als Prüfung im Code: Zwei gleichzeitige
		// Freigaben dürfen die Regel nicht unterlaufen.
		const a = await aufbau('Abstimmweg 3', '2026-09-17');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			imKontext(betreiber, (tx) => tx`
				INSERT INTO voting_round (operator_id, meeting_id, agenda_item_id, ordinal)
				VALUES (${betreiber}, ${a.versammlung}, ${a.traktandum}, 99)
			`)
		).rejects.toThrow(/voting_round_eine_offene/);
	});

	it('weist eine Kenntnisnahme ab', async () => {
		// Ein Beschluss daraus wäre nicht traktandiert und damit anfechtbar.
		const a = await aufbau('Abstimmweg 4', '2026-09-18');
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.kenntnisnahme)
		).rejects.toThrow(/Kenntnisnahme angekündigt/);
	});

	it('weist ein Traktandum ohne Mehrheitserfordernis ab', async () => {
		const a = await aufbau('Abstimmweg 5', '2026-09-19', { erfordernis: null });
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toThrow(/Entscheidbaum/);
	});

	it('weist ein fremdes Traktandum ab', async () => {
		const a = await aufbau('Abstimmweg 6', '2026-09-20');
		const b = await aufbau('Abstimmweg 6b', '2026-09-21');
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, b.traktandum)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});
});

describe('Stimmen', () => {
	it('nimmt eine Stimme an und zählt sie im Fortschritt', async () => {
		const a = await aufbau('Stimmweg 1', '2026-10-01');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);

		const f = await holeFortschritt(betreiber, a.versammlung, d.id);
		expect(f.abgegeben).toBe(1);
		expect(f.stimmberechtigt).toBe(2);
		expect(f.vollstaendig).toBe(false);

		/*
		 * **Und wer fehlt, beim Namen** (Bedienbarkeitsprüfung 05.09.2026):
		 * «Im Saal ruft man Namen auf, nicht Zahlen.»
		 *
		 * Geprüft wird hier gegen die Datenbank und nicht nur gegen die reine
		 * Funktion (Code-Review 06.09.2026): Die Namen kommen aus
		 * `snapshot_party`, also aus dem eingefrorenen Stand, und die Karte wird
		 * über `party_id` gebildet — nicht über `snapshot_party.id`. Diese zwei
		 * Kennungen zu verwechseln ist in derselben Datei schon einmal passiert
		 * und dort eigens dokumentiert; ein Tippfehler in der Spalte fiele ohne
		 * diesen Test nirgends auf.
		 */
		expect(f.offeneNamen).toHaveLength(1);
		expect(f.offeneNamen[0]).not.toMatch(/^[0-9a-f-]{36}$/);
		expect(f.offeneNamen[0]).not.toBe('ohne Namen');
	});

	it('lässt eine Berichtigung als neue Zeile stehen', async () => {
		// AD-5: Die alte bleibt, für das Ergebnis zählt die letzte.
		const a = await aufbau('Stimmweg 2', '2026-10-02');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'no' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ choice: string }[]>`
			SELECT choice FROM vote WHERE round_id = ${d.id} ORDER BY cast_at, id
		`);
		expect(zeilen.map((z) => z.choice)).toEqual(['no', 'yes']);
	});

	it('zählt für den Strom die Zeilen, nicht die Parteien', async () => {
		/*
		 * **Warum die Unterscheidung zählt** (21.08.2026): Eine offene
		 * Leitungsseite erfährt vom Ereignisstrom nur Zahlen. Schaut sie auf
		 * `abgegeben`, sieht sie eine **Berichtigung** nie — die Zahl der
		 * Parteien bleibt dieselbe, obwohl eine neue Stimmzeile entstanden ist
		 * (AD-5). Gemeldet als «geschieht noch nicht, wenn … die Stimme geändert
		 * hat».
		 */
		const a = await aufbau('Stimmweg 2b', '2026-10-09');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBe(0);

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'no' }],
			false
		);
		const nachErster = await zaehleStimmzeilen(betreiber, d.id);
		const fortschrittErst = await holeFortschritt(betreiber, a.versammlung, d.id);
		expect(nachErster).toBeGreaterThan(0);

		// Dieselbe Partei berichtigt: Die Partei bleibt eine, die Zeilen werden mehr.
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);
		const fortschrittDanach = await holeFortschritt(betreiber, a.versammlung, d.id);
		expect(fortschrittDanach.abgegeben).toBe(fortschrittErst.abgegeben);
		expect(await zaehleStimmzeilen(betreiber, d.id)).toBeGreaterThan(nachErster);
	});

	it('lässt eine Stimme weder ändern noch löschen', async () => {
		// Die Zeile ist der Beleg.
		const a = await aufbau('Stimmweg 3', '2026-10-03');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);

		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE vote SET choice = 'no'`)
		).rejects.toThrow(/denied|verweigert/i);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM vote`)
		).rejects.toThrow(/denied|verweigert/i);
	});

	it('öffnet keine Abstimmung ohne Beschlussfähigkeit, und nach berichtigter Anwesenheit doch (Ä-18)', async () => {
		// Bis zum 17.09.2026 fragte `oeffneAbstimmung` nicht danach: Eine
		// nicht beschlussfähige Versammlung konnte ohne Spur beschliessen.
		const a = await aufbau('Stimmweg Beschlussfähigkeit', '2026-10-14', { anwesend: 1 });
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toMatchObject({ kennung: 'nicht_beschlussfaehig' });
		const leer = await imKontext(
			betreiber,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM voting_round WHERE meeting_id = ${a.versammlung}`
		);
		expect(leer[0].n).toBe(0);

		// Der Ausweg ist die Tatsache: Die zweite Eigentümerin war doch da.
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[1], 'von_hand');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(d.id).toBeTruthy();
	});

	it('stimmt ohne Beschlussfähigkeit konsultativ ab, ohne Beschluss im Protokoll (H7, Teil B)', async () => {
		/*
		 * **Konsultativ heisst: gezählt, nie beschlossen** (Migration 158). Eine
		 * Eigentümerin von zwei ist da, die Versammlung ist nicht beschlussfähig.
		 * Sie stimmt Ja; nach dem einfachen Mehr der Anwesenden wäre das
		 * angenommen. Es darf nirgends als Beschluss stehen: nicht im Ergebnis,
		 * nicht in der Auswertung, nicht im Protokoll, und ein Rückkommen darauf
		 * gibt es nicht.
		 */
		const a = await aufbau('Stimmweg konsultativ', '2026-10-15', { anwesend: 1 });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			konsultativ: true
		});
		expect(d.konsultativ).toBe(true);
		// Wand und Telefone sagen es an, solange abgestimmt wird.
		expect((await ermittleStand(betreiber, a.versammlung))?.abstimmung?.konsultativ).toBe(true);

		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung?.koepfe.ja).toBe(1);
		expect(e.auszaehlung?.angenommen).toBe(false);
		expect(e.auszaehlung?.keinBeschluss?.grund).toBe('konsultativ');
		expect(ergebnislage(e.auszaehlung)).toBe('kein_beschluss');

		const w = await holeAuswertung(betreiber, a.versammlung);
		expect(w?.angenommen).toBe(0);
		expect(w?.abgelehnt).toBe(0);
		expect(w?.keinBeschluss).toBe(1);

		const entwurf = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurf).toContain(KONSULTATIV_WERTUNG);
		expect(entwurf).toContain('Kopfstimmen: 1 Ja');
		expect(entwurf).not.toMatch(/Angenommen\.|Abgelehnt\./);
		// Ohne Schwelle und Erfordernis: «1 Ja, nötig 1» läse sich als erreicht
		// (Fach- und Laienprüfung 14.10.2026, K7).
		const abschnitt = /#### \d+ Sanierung der Fassade (.*?)(?= ####| ## )/.exec(entwurf)?.[1] ?? '';
		expect(abschnitt).toContain(KONSULTATIV_WERTUNG);
		expect(abschnitt).not.toMatch(/nötig|Erforderliche Mehrheit/);

		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum)
		).rejects.toMatchObject({ kennung: 'kein_beschluss' });

		// Im Verlauf als konsultativ, beim Eröffnen und beim Verkünden.
		const verlauf = await imKontext(
			betreiber,
			(tx) => tx<{ event_type: string; detail: Record<string, unknown> }[]>`
				SELECT event_type, detail FROM audit_entry
				WHERE subject_id = ${a.versammlung}
				  AND event_type IN ('vote.round.opened', 'vote.result.published')
			`
		);
		expect(verlauf.length).toBeGreaterThanOrEqual(2);
		for (const v of verlauf) expect(v.detail.konsultativ).toBe(true);

		/*
		 * **Danach verbindlich, ohne Rückkommen** (wie nach einem Weggang). Die
		 * zweite Eigentümerin kommt; der konsultative Durchgang wird überholt,
		 * und seine Zahlen bleiben im Protokoll.
		 */
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[1], 'von_hand');
		const zwei = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(zwei.nummer).toBe(2);
		expect(zwei.konsultativ).toBe(false);
		const [erster] = (await holeDurchgaenge(betreiber, a.versammlung)).filter((x) => x.id === d.id);
		expect(erster.ueberholtAm).not.toBeNull();
		expect(erster.ueberholungsart).toBe('neueroeffnung');

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const danach = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(danach).toContain(
			'- Im 1. Durchgang wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig ' +
				'war; ein Beschluss entstand dabei nicht. Kopfstimmen: 1 Ja'
		);
		expect(danach).toContain('- 2. Durchgang.');
		expect((await holeAuswertung(betreiber, a.versammlung))?.angenommen).toBe(1);
	});

	/*
	 * **Im Abschlusspaket stehen Abbruch und Meinungsbild als solche** (H6,
	 * Codeprüfung N3; H7, Teil B, Befund 9; beide mitgenommen in H8). Vorher
	 * trugen die Stimmen eines abgebrochenen Durchgangs `gezaehlt: true`, und
	 * der Entscheidungsweg nannte einen konsultativen wie einen gezählten.
	 */
	it('vermerkt im Paket den abgebrochenen und den konsultativen Durchgang (H8)', async () => {
		const a = await aufbau('Stimmweg Paketvermerk', '2026-10-19', { anwesend: 1 });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'Prüflauf: falsche Grundlage.');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'no' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await versiegle(handelnder(betreiber), a.versammlung, '2026-10-19 21:30:00');

		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, a.versammlung)) as Uint8Array);
		const stimmen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)
		) as {
			nummer: number;
			abgebrochen: boolean;
			konsultativ: boolean;
			stimmen: { gezaehlt: boolean }[];
		}[];
		const erster = stimmen.find((d) => d.nummer === 1);
		const zweiter = stimmen.find((d) => d.nummer === 2);
		expect(erster?.abgebrochen).toBe(true);
		expect(erster?.stimmen.length).toBe(1);
		expect(erster?.stimmen.every((v) => v.gezaehlt === false)).toBe(true);
		expect(zweiter?.abgebrochen).toBe(false);
		expect(zweiter?.konsultativ).toBe(true);
		expect(zweiter?.stimmen.every((v) => v.gezaehlt === true)).toBe(true);

		const weg = new TextDecoder().decode(dateien.get('Entscheidungsweg.txt') as Uint8Array);
		expect(weg).toMatch(/1\. Durchgang: ohne Ergebnis abgebrochen/);
		expect(weg).toMatch(/2\. Durchgang: konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig war; kein Beschluss/);
		expect(weg).not.toMatch(/2\. Durchgang: gezählt nach/);
	});

	it('lässt nach einer konsultativen Abstimmung einen Folgeantrag zu (H7, Teil B)', async () => {
		/*
		 * **Keine Sackgasse** (Codeprüfung 14.10.2026, M4). Nach dem
		 * Meinungsbild ist ein geänderter Antrag der übliche nächste Schritt.
		 * Die Sperre «Grundantrag entschieden» nannte das Rückkommen als Weg, und
		 * das gibt es nach einer konsultativen Abstimmung nicht.
		 */
		const a = await aufbau('Stimmweg konsultativ Folgeantrag', '2026-10-18', { anwesend: 1 });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'no' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Nur die Nordfassade',
				art: 'abstimmung',
				antragswortlaut: 'Saniert wird vorerst nur die Nordfassade.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		expect(f.id).toBeTruthy();
	});

	it('weist «konsultativ» ab, wenn die Versammlung beschlussfähig ist (H7, Teil B)', async () => {
		const a = await aufbau('Stimmweg konsultativ beschlussfähig', '2026-10-16');
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true })
		).rejects.toMatchObject({ kennung: 'konsultativ_beschlussfaehig' });
		const leer = await imKontext(
			betreiber,
			(tx) => tx<{ n: number }[]>`SELECT count(*)::int AS n FROM voting_round WHERE meeting_id = ${a.versammlung}`
		);
		expect(leer[0].n).toBe(0);
	});

	it('hält das Merkmal «konsultativ» unveränderlich (Migration 158)', async () => {
		const a = await aufbau('Stimmweg konsultativ fest', '2026-10-17', { anwesend: 1 });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			konsultativ: true
		});
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE voting_round SET consultative = false WHERE id = ${d.id}`)
		).rejects.toThrow(/unveränderlich/);
	});

	/*
	 * **Nach einer konsultativen Abstimmung ist das Geschäft offen**
	 * (Produktentscheid 14.10.2026, Auftrag H7, Teil D). Je Kriterium der Weg
	 * am Server, und die Gegenprobe nach einem verbindlichen Beschluss.
	 */
	const QUALIFIZIERTES_MEHR: Erfordernis = {
		...EINFACHES_MEHR,
		knotenId: 'k-baulich-nuetzlich',
		typ: 'qualifiziertes_mehr',
		titel: 'Qualifiziertes Mehr',
		rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
		quotenbasis: 'alle_quoten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
	};

	const abschnittIm = (entwurf: string) =>
		/#### \d+ Sanierung der Fassade (.*?)(?= ####| ## )/.exec(entwurf.replace(/\s+/g, ' '))?.[1] ?? '';

	it('lässt nach einer konsultativen Abstimmung das Erfordernis ändern, der nächste Durchgang nimmt es (H7, Teil D)', async () => {
		const a = await aufbau('Stimmweg konsultativ offen', '2026-10-19', { anwesend: 1 });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			konsultativ: true
		});
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		// Kriterium 1: Das Erfordernis lässt sich ändern, ohne Rückkommen.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERTES_MEHR);
		const [konsultativer] = (await holeDurchgaenge(betreiber, a.versammlung)).filter((x) => x.id === d.id);
		// Er behält das Erfordernis, mit dem er eröffnet wurde, und das Protokoll nennt keines.
		expect(konsultativer.erfordernis?.titel).toBe('Einfaches Mehr');
		const vorher = abschnittIm(
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		);
		expect(vorher).toContain(KONSULTATIV_WERTUNG);
		expect(vorher).not.toMatch(/Erforderliche Mehrheit|Qualifiziertes Mehr|Einfaches Mehr/);

		// Kriterium 5: Der verbindliche Durchgang danach läuft ohne Rückkommen,
		// unter dem dann geltenden Erfordernis.
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[1], 'von_hand');
		const zwei = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(zwei.konsultativ).toBe(false);
		expect(zwei.rueckkommensantragId ?? null).toBeNull();
		expect(zwei.erfordernis?.titel).toBe('Qualifiziertes Mehr');
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect((await holeErgebnis(betreiber, a.versammlung, zwei.id)).auszaehlung?.angenommen).toBe(true);
		const nachher = abschnittIm(
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		);
		expect(nachher).toContain('Erforderliche Mehrheit');
		expect(nachher).toContain('- Im 1. Durchgang wurde konsultativ abgestimmt');

		// Kriterium 6, Gegenprobe zu 1 und 4: nach dem verbindlichen Beschluss gesperrt.
		await expect(
			haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, QUALIFIZIERTES_MEHR)
		).rejects.toMatchObject({ kennung: 'schon_abgestimmt' });
		await expect(
			ziehAntragZurueck(handelnder(betreiber), a.versammlung, a.traktandum, 'Prüflauf: zu spät')
		).rejects.toMatchObject({ kennung: 'schon_abgestimmt' });
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					UPDATE agenda_item SET withdrawn_at = now(), withdrawn_by_label = 'Prüflauf',
					       withdrawn_reason = 'Prüflauf: am Server vorbei'
					 WHERE id = ${a.traktandum}`
			)
		).rejects.toThrow(/bereits abgestimmt/);
	});

	it('lässt den Antrag nach einer konsultativen Abstimmung zurückziehen, mit Rückzug und Zahlen im Protokoll (H7, Teil D)', async () => {
		const a = await aufbau('Stimmweg konsultativ Rückzug', '2026-10-20', { anwesend: 1 });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true });

		// Während der konsultativen Abstimmung kein Rückzug, am Server wie in der
		// Datenbank (Migration 159: nur der geschlossene ist ausgenommen).
		await expect(
			ziehAntragZurueck(handelnder(betreiber), a.versammlung, a.traktandum, 'Prüflauf: mitten drin')
		).rejects.toMatchObject({ kennung: 'schon_abgestimmt' });
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					UPDATE agenda_item SET withdrawn_at = now(), withdrawn_by_label = 'Prüflauf',
					       withdrawn_reason = 'Prüflauf: am Server vorbei'
					 WHERE id = ${a.traktandum}`
			)
		).rejects.toThrow(/bereits abgestimmt/);

		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'no' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		// Kriterium 4: Danach geht der Rückzug.
		await ziehAntragZurueck(handelnder(betreiber), a.versammlung, a.traktandum, 'Die Offerte wird überarbeitet.');

		const abschnitt = abschnittIm(
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		);
		// Ohne «zurückgezogen: Zurückgezogen:», wie es seit dem 05.08.2026 dastand.
		expect(abschnitt).toContain(
			'Der Antrag wurde nach der konsultativen Abstimmung zurückgezogen: Die Offerte wird überarbeitet.'
		);
		expect(abschnitt).toContain(
			'- Es wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig ' +
				'war; ein Beschluss entstand dabei nicht. Kopfstimmen: 0 Ja, 1 Nein'
		);
		expect(abschnitt).not.toMatch(/vor der Abstimmung zurückgezogen|Es wurde nicht abgestimmt|Angenommen\.|Abgelehnt\./);

		// Die Auswertung zählt ihn nicht als Beschluss.
		const w = await holeAuswertung(betreiber, a.versammlung);
		expect(w?.angenommen).toBe(0);
		expect(w?.abgelehnt).toBe(0);
		expect(w?.keinBeschluss).toBe(1);

		// Zurückgezogen wird nicht mehr abgestimmt, auch nicht konsultativ.
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { konsultativ: true })
		).rejects.toMatchObject({ kennung: 'zurueckgezogen' });

		// Und der Rückzug lässt sich zurücknehmen, mit derselben Grenze.
		await nimmRueckzugZurueck(handelnder(betreiber), a.versammlung, a.traktandum);
		const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
		expect(t.knoten.rueckzug).toBeNull();
	});

	it('hält einen Folgeantrag nach einer konsultativen Abstimmung für offen (H7, Teil D)', async () => {
		/*
		 * Kriterium 3 am Server, die Kehrseite: Der Folgeantrag ist nach seiner
		 * konsultativen Abstimmung nicht entschieden. Der Grundantrag lässt sich
		 * deshalb nicht zurückziehen, solange er an ihm hängt
		 * (`offeneFolgeantraegeIn`).
		 */
		const a = await aufbau('Stimmweg konsultativ Folgeantrag offen', '2026-10-21', { anwesend: 1 });
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Nur die Nordfassade',
				art: 'abstimmung',
				antragswortlaut: 'Saniert wird vorerst nur die Nordfassade.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, f.id, EINFACHES_MEHR);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, f.id, { konsultativ: true });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		await expect(
			ziehAntragZurueck(handelnder(betreiber), a.versammlung, a.traktandum, 'Prüflauf: Grundantrag')
		).rejects.toMatchObject({ kennung: 'folgeantrag_offen' });
	});

	it('weist eine Stimme einer nicht anwesenden Partei ab', async () => {
		// Beide müssen zum Öffnen da sein: Bei zwei Eigentümern ist die Versammlung
		// nur mit beiden beschlussfähig (Ä-18). Danach geht einer.
		const a = await aufbau('Stimmweg 4', '2026-10-04');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await expect(
			gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], false)
		).rejects.toThrow(/nicht als anwesend/);
	});

	it('weist eine Stimme nach dem Schliessen ab', async () => {
		const a = await aufbau('Stimmweg 5', '2026-10-05');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false)
		).rejects.toThrow(/keine Abstimmung offen|geschlossen/);
	});

	it('vermerkt die Erfassung durch die Sitzungsleitung', async () => {
		// Im Protokoll ist ein Unterschied zwischen «hat gestimmt» und «wurde so
		// erfasst».
		const a = await aufbau('Stimmweg 6', '2026-10-06', { betriebsart: 'einfach' });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		const zeilen = await imKontext(betreiber, (tx) => tx<{ recorded_by_chair: boolean }[]>`
			SELECT recorded_by_chair FROM vote WHERE round_id = ${d.id}
		`);
		expect(zeilen.every((z) => z.recorded_by_chair)).toBe(true);
	});
});

describe('Schliessen und auszählen', () => {
	it('friert Erfordernis und Anwesenheitsstand ein', async () => {
		const a = await aufbau('Zaehlweg 1', '2026-11-01');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		expect(d.zustand).toBe('geschlossen');
		expect(d.erfordernis?.typ).toBe('einfaches_mehr');
		expect(d.anwesende).toHaveLength(2);
	});

	it('rechnet das Ergebnis aus den eingefrorenen Angaben', async () => {
		const a = await aufbau('Zaehlweg 2', '2026-11-02');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung?.koepfe.ja).toBe(2);
		expect(e.auszaehlung?.koepfe.basis).toBe(2);
		expect(e.auszaehlung?.angenommen).toBe(true);
	});

	it('hält Nichtabgabe und Enthaltung auseinander', async () => {
		// Der Kern der Korrektur gegenüber dem Vorgängerprojekt (AD-15).
		const a = await aufbau('Zaehlweg 3', '2026-11-03');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung?.koepfe.ohneAbgabe).toBe(1);
		expect(e.auszaehlung?.koepfe.enthaltung).toBe(0);
		expect(e.auszaehlung?.angenommen).toBe(false);
	});

	it('zählt einen offenen Durchgang nicht aus', async () => {
		const a = await aufbau('Zaehlweg 4', '2026-11-04');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung).toBeNull();
		expect(e.grund).toMatch(/läuft noch/);
	});

	it('lässt einen Durchgang nicht ohne die eingefrorenen Angaben schliessen', async () => {
		const a = await aufbau('Zaehlweg 5', '2026-11-05');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE voting_round SET state = 'geschlossen' WHERE id = ${d.id}
			`)
		).rejects.toThrow(/voting_round_eingefroren/);
	});
});

describe('Verkünden', () => {
	/**
	 * **Es gibt keinen zweiten Schritt mehr** (Produktentscheid 21.08.2026): «Mit
	 * dem Schliessen der Abstimmung, auch wenn nicht alle abgestimmt haben, soll
	 * automatisch verkündet werden. Ich sehe dort den Mehrwert nicht.»
	 *
	 * Der getrennte Knopf war zudem irreführend: Hatten alle abgestimmt, stand
	 * das Ergebnis schon an der Wand, während daneben «Erst danach erscheint es
	 * auf Leinwand und Telefonen» zu lesen war.
	 */
	it('verkündet mit dem Schliessen', async () => {
		const a = await aufbau('Verkuendweg 1', '2026-12-01');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).not.toBeNull();
	});

	it('verkündet nichts, solange die Abstimmung läuft', async () => {
		const a = await aufbau('Verkuendweg 2', '2026-12-02');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(d.verkuendetAm).toBeNull();
	});

	it('verkündet auch, wenn nicht alle abgestimmt haben', async () => {
		// Der Fall, um den es dem Auftraggeber ging: vorzeitig geschlossen. Vorher blieb das
		// Ergebnis dann verborgen, bis jemand den Knopf fand.
		const a = await aufbau('Verkuendweg 4', '2026-12-04');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).not.toBeNull();
	});

	it('lässt die Datenbank keine Verkündung vor dem Schliessen zu', async () => {
		const a = await aufbau('Verkuendweg 3', '2026-12-03');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE voting_round SET result_published_at = now() WHERE id = ${d.id}
			`)
		).rejects.toThrow(/voting_round_verkuendung/);
	});
});

describe('Neuabstimmung', () => {
	/*
	 * **Nur bis zur Verkündung** (H6, Fachprüfung 08.10.2026, `quellen` Frage
	 * 65). Ein verkündeter Beschluss wirkt, bis er nach Art. 75 ZGB aufgehoben
	 * ist; ändern darf ihn nur die Versammlung mit einem Rückkommen.
	 */
	it('weist sie auf einen verkündeten Durchgang ab und schreibt nichts', async () => {
		const a = await aufbau('Neuweg 4', '2027-01-04');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).not.toBeNull();

		const neu = setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			d.id,
			'Verfahrensfehler bei der Fragestellung'
		);
		await expect(neu).rejects.toMatchObject({ kennung: 'schon_verkuendet' });
		await expect(neu).rejects.toThrow(/verkündet und gilt[\s\S]*Beantragen Sie das Rückkommen/);

		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT superseded_at, supersede_kind FROM voting_round WHERE id = ${d.id}`
		);
		expect(z).toEqual({ superseded_at: null, supersede_kind: null });
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				WHERE event_type = 'vote.round.superseded' AND subject_id = ${a.versammlung}
			`
		);
		expect(eintraege).toHaveLength(0);
	});

	// Gegenprobe (H6): Bei offenem Gleichstand ist nichts verkündet.
	it('nimmt sie bei offenem Gleichstand an', async () => {
		const a = await gleichstandGeschlossen('Neuweg 5', '2027-01-05');
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			a.d.id,
			'Stichentscheid fehlt, neu abstimmen'
		);

		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT superseded_at, supersede_kind, result_published_at FROM voting_round
			            WHERE id = ${a.d.id}`
		);
		expect(z.superseded_at).not.toBeNull();
		expect(z.supersede_kind).toBe('korrektur');
		expect(z.result_published_at).toBeNull();
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				WHERE event_type = 'vote.round.superseded' AND subject_id = ${a.versammlung}
			`
		);
		expect(eintraege).toHaveLength(1);
	});

	/*
	 * **Ohne Ergebnis abbrechen** (H6; Laien- und Fachprüfung 14.10.2026, F-1).
	 * Stimmt die Grundlage während der Abstimmung nicht, verkündet der Abbruch
	 * nichts. Danach lässt sich ohne Rückkommen neu freigeben, und das
	 * Protokoll nennt den Abbruch mit Begründung.
	 */
	it('bricht die laufende Abstimmung ohne Ergebnis ab, danach neu freigeben', async () => {
		const a = await aufbau('Neuweg 6', '2027-01-06');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await expect(
			brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'kurz')
		).rejects.toMatchObject({ kennung: 'begruendung_fehlt' });

		const d = await brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'Ausstand war nicht erfasst.');
		expect(d.zustand).toBe('geschlossen');
		expect(d.verkuendetAm).toBeNull();
		expect(d.ueberholungsart).toBe('korrektur');
		expect(d.geschlossenAm).toBe(d.ueberholtAm);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung).toBeNull();
		expect(e.grund).toMatch(/ohne Ergebnis abgebrochen/);
		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT result_json, result_published_at FROM voting_round WHERE id = ${d.id}`
		);
		expect(z).toEqual({ result_json: null, result_published_at: null });
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				WHERE event_type = 'vote.round.aborted' AND subject_id = ${a.versammlung}
			`
		);
		expect(eintraege).toHaveLength(1);
		// Nichts mehr offen: ein zweiter Abbruch findet keine Abstimmung.
		await expect(
			brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'Ausstand war nicht erfasst.')
		).rejects.toMatchObject({ kennung: 'keine_offene' });

		const entwurfVorher = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurfVorher).toContain(
			'Die Abstimmung im 1. Durchgang hat die Sitzungsleitung ohne Ergebnis abgebrochen ' +
				'(Begründung: Ausstand war nicht erfasst). Ein Beschluss ist nicht gefasst worden.'
		);
		expect(entwurfVorher).toContain(
			'Neu abgestimmt wurde nicht; die abgegebenen Stimmen bewirken nichts. Ihre Zahlen gibt auf ' +
				'Anfrage bekannt, wer das Protokoll aufbewahrt. Soll neu entschieden werden, muss die ' +
				'Sache an einer nächsten Versammlung traktandiert werden'
		);

		// Neu freigeben, ohne Rückkommen: Es gilt kein Durchgang.
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		const zwei = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(zwei.nummer).toBe(2);
		expect(zwei.verkuendetAm).not.toBeNull();
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurf).toContain(
			'Die Sitzungsleitung hat die Abstimmung im 1. Durchgang ohne Ergebnis abgebrochen ' +
				'(Begründung: Ausstand war nicht erfasst); die abgegebenen Stimmen bewirken nichts, ihre ' +
				'Zahlen gibt auf Anfrage bekannt, wer das Protokoll aufbewahrt. Massgebend ist der ' +
				'2. Durchgang.'
		);
		expect(entwurf).not.toContain('Neuabstimmung angesetzt');
	});

	it('weist den Abbruch ab, wenn keine Abstimmung läuft', async () => {
		const a = await aufbau('Neuweg 7', '2027-01-07');
		await expect(
			brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'Ausstand war nicht erfasst.')
		).rejects.toMatchObject({ kennung: 'keine_offene' });
	});

	it('überholt den Durchgang und verlangt eine Begründung', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const { d, ...a } = await gleichstandGeschlossen('Neuweg 1', '2027-01-01');

		await expect(
			setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, d.id, 'kurz')
		).rejects.toThrow(/Begründung/);

		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			d.id,
			'Verfahrensfehler bei der Fragestellung'
		);

		const alle = await holeDurchgaenge(betreiber, a.versammlung);
		expect(alle[0].ueberholtAm).not.toBeNull();
		expect(alle[0].ueberholungsgrund).toMatch(/Verfahrensfehler/);
	});

	it('lässt danach einen zweiten Durchgang zu, mit fortlaufender Nummer', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const { d, ...a } = await gleichstandGeschlossen('Neuweg 2', '2027-01-02');
		await setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, d.id, 'Antrag neu formuliert');

		const zweiter = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(zweiter.nummer).toBe(2);

		// Der frühere bleibt einsehbar.
		const alle = await holeDurchgaenge(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
	});

	it('löscht einen Durchgang nicht', async () => {
		const a = await aufbau('Neuweg 3', '2027-01-03');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM voting_round`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Anzeigecode', () => {
	it('entsteht beim Eröffnen und löst die Versammlung auf', async () => {
		const a = await aufbau('Anzeigeweg 1', '2027-02-01');
		expect(a.anzeigecode).toHaveLength(12);

		const befund = await loeseAnzeigecodeAuf(a.anzeigecode);
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(a.versammlung);
	});

	it('wird durch einen neuen ersetzt', async () => {
		const a = await aufbau('Anzeigeweg 2', '2027-02-02');
		const neu = await erneuereAnzeigecode(handelnder(betreiber), a.versammlung);

		expect((await loeseAnzeigecodeAuf(a.anzeigecode)).gueltig).toBe(false);
		expect((await loeseAnzeigecodeAuf(neu)).gueltig).toBe(true);
	});

	it('gilt in der Stunde nach dem Schluss weiter', async () => {
		/*
		 * **Umgedreht am 21.08.2026.** Vorher entwertete das Schliessen den Code;
		 * die Leinwand fiel im selben Augenblick vor dem ganzen Saal auf die
		 * Code-Eingabe zurück. Seit es eine Abschlussseite gibt («Auf der
		 * Präsentationssicht braucht es dann eine Abschlussseite»), ist das die
		 * falsche Stelle zum Aufhören.
		 */
		const a = await aufbau('Anzeigeweg 3', '2027-02-03');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		expect((await loeseAnzeigecodeAuf(a.anzeigecode)).gueltig).toBe(true);
	});

	it('gilt nach dem Versiegeln weiter, nicht als «noch nicht freigegeben»', async () => {
		/*
		 * **Der fünfte Zustand** (04.09.2026). `loeseAnzeigecodeAuf` prüfte auf
		 * `=== 'geschlossen'`, und `versiegelt` fiel in den Zweig darunter: Die
		 * Leinwand meldete «Diese Versammlung ist noch nicht freigegeben» und fiel
		 * auf die Code-Eingabe zurück, mit demselben Code, der eben noch die
		 * Beschlussliste zeigte. Also genau der Rückfall, gegen den der Nachlauf
		 * von einer Stunde überhaupt gebaut wurde.
		 */
		const a = await aufbau('Anzeigeweg versiegelt', '2027-02-21');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'versiegelt' WHERE id = ${a.versammlung}
		`);

		const befund = await loeseAnzeigecodeAuf(a.anzeigecode);
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(a.versammlung);
	});

	it('gilt eine Stunde später nicht mehr', async () => {
		// Die Frist ist der Punkt: Was im Saal vorgelesen wurde, soll nicht Wochen
		// später noch Beschlüsse hergeben.
		const a = await aufbau('Anzeigeweg 3a', '2027-02-13');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET closed_at = now() - interval '90 minutes' WHERE id = ${a.versammlung}
		`);
		const befund = await loeseAnzeigecodeAuf(a.anzeigecode);
		expect(befund.gueltig).toBe(false);
		expect(befund.grund).toMatch(/Protokoll/);
	});

	it('speichert den Code nicht im Klartext', async () => {
		const a = await aufbau('Anzeigeweg 4', '2027-02-04');
		const [m] = await imKontext(betreiber, (tx) => tx<{ zeile: string }[]>`
			SELECT m::text AS zeile FROM meeting m WHERE id = ${a.versammlung}
		`);
		expect(m.zeile).not.toContain(a.anzeigecode);
	});
});

describe('Schliessen der Versammlung', () => {
	it('schliesst offene Abstimmungen mit', async () => {
		// Eine Sperre an dieser Stelle liesse eine Abstimmung für immer offen
		// stehen — wer im Saal schliesst, hat die Versammlung beendet.
		const a = await aufbau('Schlussweg 1', '2027-03-01');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		const e = await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		expect(e.geschlosseneAbstimmungen).toBe(1);

		const alle = await holeDurchgaenge(betreiber, a.versammlung);
		expect(alle[0].zustand).toBe('geschlossen');
		expect(alle[0].anwesende).not.toBeNull();
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber keine Durchgänge', async () => {
		const a = await aufbau('Fremdweg 1', '2027-04-01');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(await holeDurchgaenge(betreiberB, a.versammlung)).toHaveLength(0);
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM voting_round`)).toHaveLength(0);
		expect(await ohneKontext((tx) => tx`SELECT id FROM vote`)).toHaveLength(0);
	});
});

describe('Der Kranz stimmt', () => {
	it('trägt in der Traktandenliste dasselbe Erfordernis wie im Durchgang', async () => {
		// Zwei Wege zu derselben Angabe dürfen nicht auseinanderlaufen.
		const a = await aufbau('Kranzweg 1', '2027-05-01');
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const traktanden = await holeTraktanden(betreiber, a.versammlung);
		const t = traktanden.find((x) => x.knoten.id === a.traktandum);
		expect(d.erfordernis?.knotenId).toBe(t?.knoten.erfordernis?.knotenId);
	});
});

describe('Während der Sitzung aufgenommen (Stories 5.11, 5.12, Migration 032)', () => {
	it('kennzeichnet ein während der Sitzung aufgenommenes Traktandum', async () => {
		const a = await aufbau('Spontanweg 1', '2027-06-01');
		const t = await nimmTraktandumAuf(handelnder(betreiber), {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Mitteilung zur Gartenbank',
			art: 'kenntnisnahme',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});

		const traktanden = await holeTraktanden(betreiber, a.versammlung);
		const gefunden = traktanden.find((x) => x.knoten.id === t.id);
		expect(gefunden?.knoten.spontan).toBe(true);
		expect(gefunden?.knoten.spontanart).toBe('neu');
		expect(gefunden?.knoten.aufgenommenAm).not.toBeNull();
	});

	/**
	 * Der Kern von Migration 032, seit Migration 127 mit der Ausnahme des
	 * Reglements. Über ein Geschäft, das nicht auf der versandten
	 * Traktandenliste stand, wird ohne sie nicht beschlossen (ZGB Art. 67 Abs. 3
	 * i.V.m. Art. 712m Abs. 2). Die Schranke greift schon beim Aufnehmen, nicht
	 * erst bei der Freigabe.
	 */
	it('weist ein nicht angekündigtes Geschäft als Abstimmung schon beim Aufnehmen ab', async () => {
		// Nur eine Partei da: Sonst trüge die Universalversammlung (Migration 128).
		const a = await aufbau('Spontanweg 2', '2027-06-02', { anwesend: 1 });
		await expect(
			nimmTraktandumAuf(handelnder(betreiber), {
				meetingId: a.versammlung,
				parentId: null,
				titel: 'Verkauf des Bastelraums',
				art: 'abstimmung',
				antragswortlaut: 'Der Bastelraum wird verkauft.',
				antragstellerart: 'gemeinschaft',
				betroffeneParteiIds: []
			})
		).rejects.toMatchObject({ kennung: 'nicht_angekuendigt' });
	});

	/** Auch die Datenbank lässt es nicht zu, nicht nur die Schale. */
	it('lässt die Zeile auch an der Datenbank vorbei nicht zu', async () => {
		const a = await aufbau('Spontanweg 3', '2027-06-03');
		await expect(
			alsBetreiber(betreiber, async (tx) => {
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind,
					                         motion_text, proposer_kind, is_spontaneous, spontaneous_kind)
					VALUES (${id}, ${betreiber}, ${a.versammlung}, 99, 'Am Formular vorbei', 'abstimmung',
					        'Wortlaut', 'gemeinschaft', true, 'neu')
				`;
			})
			// Seit dem 26.08.2026 übersetzt `alsBetreiber` eine verletzte Schranke in
			// einen Satz — der Name steht nicht mehr darin, sondern am Fehler. Geprüft
			// wird derselbe Sachverhalt: Die Datenbank hat es aufgehalten, und zwar diese
			// Schranke.
		).rejects.toMatchObject({
			kennung: 'schranke_verletzt',
			schranke: 'agenda_neu_nur_kenntnisnahme'
		});
	});

	/**
	 * **Mit der Ausnahme des Reglements darf es** (Migration 127). Der ganze
	 * Weg: aufnehmen, eröffnen, im Protokoll mit Fundstelle. Ohne die Angabe
	 * ist dieselbe Aufnahme rot (Probe darüber), die Angabe ist also die
	 * einzige Ursache.
	 */
	it('lässt ein neues Geschäft zur Abstimmung, wenn das Reglement es gestattet', async () => {
		const a = await aufbau('Spontanweg 4', '2027-06-04', {
			reglementGestattet: 'Art. 21 Abs. 3 Reglement'
		});
		const t = await nimmTraktandumAuf(handelnder(betreiber), {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Anschaffung eines Defibrillators',
			art: 'abstimmung',
			antragswortlaut: 'Die Gemeinschaft schafft einen Defibrillator an.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});
		const gelesen = (await holeTraktanden(betreiber, a.versammlung)).find(
			(x) => x.knoten.id === t.id
		);
		expect(gelesen?.knoten.ausnahme).toBe('reglement');

		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung eines Defibrillators'
		);
		// Die volle Angabe bleibt, wie sie ist: kein «Reglement des Reglements»
		// (Codeprüfung 29.09.2026). Und «aufgenommen», nicht «beschlossen».
		expect(zeile?.ausnahmeVermerk).toMatch(
			/^Nicht angekündigt\. Zur Abstimmung aufgenommen gestützt auf Art\. 21 Abs\. 3 Reglement, das /
		);
		expect(zeile?.ausnahmeVermerk).not.toMatch(/des Reglements|Beschlossen/);
	});

	/**
	 * **Es gilt, was bei der Freigabe stand.** Wer die Angabe im Saal setzt,
	 * öffnet damit nichts: Die Eigentümer, die der Einladung vertraut haben,
	 * haben unter der alten Regel entschieden, ob sie kommen.
	 */
	it('liest die Angabe aus der Momentaufnahme, nicht aus der Gemeinschaft', async () => {
		// Nur eine Partei da: Sonst trüge die Universalversammlung (Migration 128).
		const a = await aufbau('Spontanweg 5', '2027-06-05', { anwesend: 1 });
		await speichereAusnahmen(handelnder(betreiber), a.stweg, {
			reglementGestattet: true,
			reglementFundstelle: 'Art. 21 Reglement'
		});
		await expect(
			nimmTraktandumAuf(handelnder(betreiber), {
				meetingId: a.versammlung,
				parentId: null,
				titel: 'Nachträglich erlaubt?',
				art: 'abstimmung',
				antragswortlaut: 'Wortlaut',
				antragstellerart: 'gemeinschaft',
				betroffeneParteiIds: []
			})
		).rejects.toMatchObject({ kennung: 'nicht_angekuendigt' });
	});

	/**
	 * **Am gemeinsamen Abend nicht** (Codeprüfung 29.09.2026). Dort wird über
	 * die Liste des Abends abgestimmt, und die führt kein neues Geschäft. Die
	 * Sperre steht im Server, nicht nur in der Oberfläche: Ein veraltetes
	 * Formular legte sonst eine Abstimmung an, die sich nicht eröffnen liesse.
	 */
	it('nimmt am gemeinsamen Abend kein neues Geschäft zur Abstimmung auf', async () => {
		const a = await aufbau('Spontanweg 8', '2027-06-08', { reglementGestattet: 'Art. 21' });
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: 'Prüfabend Spontanweg 8',
			datum: '2027-06-08',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		await alsBetreiber(betreiber, (tx) => tx`
			UPDATE meeting SET meeting_day_id = ${tag.id} WHERE id = ${a.versammlung}
		`);
		await expect(
			nimmTraktandumAuf(handelnder(betreiber), {
				meetingId: a.versammlung,
				parentId: null,
				titel: 'Am Abend neu',
				art: 'abstimmung',
				antragswortlaut: 'Wortlaut',
				antragstellerart: 'gemeinschaft',
				betroffeneParteiIds: []
			})
		).rejects.toThrow(/Am gemeinsamen Abend lässt Votum/);
	});

	/**
	 * **Der Vermerk braucht seine Grundlage** (Sicherheitsprüfung 29.09.2026).
	 * Ein Weg, der ihn setzte, ohne die Momentaufnahme zu fragen, bleibt an der
	 * Datenbank hängen.
	 */
	it('weist einen Vermerk ab, den die Momentaufnahme nicht trägt', async () => {
		const a = await aufbau('Spontanweg 7', '2027-06-07');
		await expect(
			alsBetreiber(betreiber, async (tx) => {
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind,
					                         motion_text, proposer_kind, is_spontaneous, spontaneous_kind,
					                         added_during_meeting_at, unannounced_basis)
					VALUES (${id}, ${betreiber}, ${a.versammlung}, 99, 'Am Reglement vorbei', 'abstimmung',
					        'Wortlaut', 'gemeinschaft', true, 'neu', now(), 'reglement')
				`;
			})
		).rejects.toMatchObject({ schranke: 'agenda_ausnahme_ohne_grundlage' });
	});

	/** Eine Ausnahme gehört nur an ein neues Spontantraktandum. */
	it('lässt die Ausnahme an einem angekündigten Traktandum nicht zu', async () => {
		// Mit Angabe, damit nicht schon der Auslöser zur Grundlage anschlägt und
		// die Probe misst, was sie behauptet: die Schranke am Traktandum.
		const a = await aufbau('Spontanweg 6', '2027-06-06', { reglementGestattet: 'Art. 21' });
		await expect(
			alsBetreiber(betreiber, (tx) => tx`
				UPDATE agenda_item SET unannounced_basis = 'reglement' WHERE id = ${a.traktandum}
			`)
		).rejects.toMatchObject({ schranke: 'agenda_ausnahme_nur_bei_neuem' });
	});

	/**
	 * Der Folgeantrag darf. Angekündigt sein muss der Gegenstand, nicht jeder
	 * Antrag dazu — sonst könnte eine Versammlung über ein angekündigtes Geschäft
	 * nur unverändert Ja oder Nein sagen, und jede Beratung wäre folgenlos.
	 */
	it('lässt einen Folgeantrag zum angekündigten Antrag zur Abstimmung', async () => {
		const a = await aufbau('Spontanweg 4', '2027-06-04');
		const t = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Statt 12000 nur 8000 Franken',
				art: 'abstimmung',
				antragswortlaut: 'Es werden 8000 Franken bewilligt.',
				antragstellerart: 'gemeinschaft',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);

		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id);
		expect(d.zustand).toBe('offen');
	});

	it('weist einen Folgeantrag ohne angekündigten Grundantrag ab', async () => {
		const a = await aufbau('Spontanweg 5', '2027-06-05');
		await expect(
			nimmTraktandumAuf(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: null,
					titel: 'Folgeantrag ohne Grundantrag',
					art: 'abstimmung',
					antragswortlaut: 'Irgendetwas.',
					antragstellerart: 'gemeinschaft',
					betroffeneParteiIds: []
				},
				'folgeantrag'
			)
		).rejects.toThrow(/braucht den angekündigten Antrag/);
	});

	/*
	 * **Die beiden Fälle, die «Jetzt möglich» kannte und der Server nicht**
	 * (07.09.2026). `moeglicheEingriffe` nimmt «Gegenantrag» aus der Zeile,
	 * sobald über die Sache entschieden oder sie zurückgezogen ist; die Auswahl
	 * im Aufnahmeformular bot dieselben Anträge weiter an, und hier kamen sie
	 * durch. Ohne die Schranke laufen beide Proben ins «resolved instead of
	 * rejecting».
	 */
	it('weist einen Folgeantrag zu einem bereits entschiedenen Grundantrag ab', async () => {
		const a = await aufbau('Spontanweg 7', '2027-06-07');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		await expect(
			nimmTraktandumAuf(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: a.traktandum,
					titel: 'Statt 12000 nur 8000 Franken',
					art: 'abstimmung',
					antragswortlaut: 'Es werden 8000 Franken bewilligt.',
					antragstellerart: 'gemeinschaft',
					betroffeneParteiIds: []
				},
				'folgeantrag'
			)
		).rejects.toThrow(/bereits abgestimmt[\s\S]*Rückkommensantrag/);
	});

	it('weist einen Folgeantrag zu einem zurückgezogenen Grundantrag ab', async () => {
		const a = await aufbau('Spontanweg 8', '2027-06-08');
		await ziehAntragZurueck(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			'Der Antragsteller zieht zurück.'
		);

		await expect(
			nimmTraktandumAuf(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: a.traktandum,
					titel: 'Statt 12000 nur 8000 Franken',
					art: 'abstimmung',
					antragswortlaut: 'Es werden 8000 Franken bewilligt.',
					antragstellerart: 'gemeinschaft',
					betroffeneParteiIds: []
				},
				'folgeantrag'
			)
		).rejects.toThrow(/zurückgezogen[\s\S]*keinen Kern mehr/);
	});

	/*
	 * **Die Gegenprobe steht schon oben.** «lässt einen Folgeantrag zum
	 * angekündigten Antrag zur Abstimmung» fährt denselben Weg mit offenem
	 * Grundantrag und geht weiter als eine eigene Probe es täte. Ohne sie
	 * belegten die Absagen hier auch eine Schranke, die jeden Folgeantrag
	 * abwiese; mit ihr ist der offene Weg nachgewiesen.
	 */
	it('weist einen Folgeantrag ab, solange über den Grundantrag abgestimmt wird', async () => {
		const a = await aufbau('Spontanweg 9', '2027-06-09');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await expect(
			nimmTraktandumAuf(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: a.traktandum,
					titel: 'Statt 12000 nur 8000 Franken',
					art: 'abstimmung',
					antragswortlaut: 'Es werden 8000 Franken bewilligt.',
					antragstellerart: 'gemeinschaft',
					betroffeneParteiIds: []
				},
				'folgeantrag'
			)
		).rejects.toThrow(/gerade abgestimmt[\s\S]*schliessen Sie den Durchgang/i);
	});

	it('weist einen Folgeantrag zu einer Kenntnisnahme ab', async () => {
		// Zu einer Kenntnisnahme gibt es keinen Antrag, in dessen Kern etwas liegen
		// könnte.
		const a = await aufbau('Spontanweg 6', '2027-06-06');
		await expect(
			nimmTraktandumAuf(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: a.kenntnisnahme,
					titel: 'Antrag zur Mitteilung',
					art: 'abstimmung',
					antragswortlaut: 'Irgendetwas.',
					antragstellerart: 'gemeinschaft',
					betroffeneParteiIds: []
				},
				'folgeantrag'
			)
		).rejects.toThrow(/Kenntnisnahme/);
	});

	it('lässt das Erfordernis während der Sitzung setzen, nach der Abstimmung nicht mehr', async () => {
		// Das Erfordernis ist die rechtliche Einschätzung der Sitzungsleitung und
		// bis zur Abstimmung änderbar, anders als Titel und Antragswortlaut. Die
		// Einladung nennt es aber; seit Migration 144 geht es im Saal nur strenger
		// (`einladungsmehr.ts`). Diese Probe setzt ein gleich strenges mit anderem Titel.
		const a = await aufbau('Spontanweg 4', '2027-06-04');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, {
			...EINFACHES_MEHR,
			titel: 'Berichtigtes Erfordernis'
		});

		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const gesperrt = () =>
			expect(
				haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACHES_MEHR)
			).rejects.toThrow(/bereits abgestimmt[\s\S]*beantragen Sie das Rückkommen/);
		await gesperrt();

		// Ein gestelltes Rückkommen allein öffnet nichts; erst das angenommene
		// (H6: der Weg über die Neuabstimmung ist für ein verkündetes Ergebnis zu).
		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		await gesperrt();
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, EINFACHES_MEHR);

		// Hat das Rückkommen seinen Durchgang getragen, ist wieder Schluss.
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		const zweiter = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(zweiter.erfordernis?.titel).toBe('Einfaches Mehr');
		await gesperrt();
	});
});


/**
 * Was die Leinwand zeigt (Migration 035).
 *
 * Gemeldet am 02.08.2026: «Wenn ich bei Alle Traktanden ein Traktandum
 * aufrufe, geschieht am Monitor nichts.» Die Ursache lag nicht in der Sicht,
 * sondern im Stand: Massgebend war der zuletzt geschlossene Durchgang der
 * ganzen Versammlung, unabhängig vom aufgerufenen Traktandum. Nach dem ersten
 * verkündeten Ergebnis hing es bis ans Ende des Abends an der Wand.
 */
describe('Der Stand für die Leinwand', () => {
	it('lässt das Ergebnis stehen, solange sein Traktandum aufgerufen ist', async () => {
		const a = await aufbau('Leinwand 1', '2026-12-20');
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung?.ergebnis).not.toBeNull();
	});

	it('nimmt das Ergebnis von der Wand, sobald das nächste Traktandum aufgerufen ist', async () => {
		const a = await aufbau('Leinwand 2', '2026-12-21');
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.kenntnisnahme);
		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung).toBeNull();
		expect(stand?.aktuellesTraktandumId).toBe(a.kenntnisnahme);
	});

	/**
	 * Eine laufende Abstimmung geht allem vor: Ihr Gegenstand darf sich nicht
	 * ändern, nur weil daneben etwas anderes aufgerufen wird.
	 */
	it('hält an der offenen Abstimmung fest, auch wenn anderes aufgerufen wird', async () => {
		const a = await aufbau('Leinwand 3', '2026-12-22');
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.kenntnisnahme);
		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung?.durchgangId).toBe(d.id);
		expect(stand?.abstimmung?.zustand).toBe('offen');
	});

	it('trägt die Marke des Wandbildes, nie seinen Wortlaut', async () => {
		const a = await aufbau('Leinwand 4', '2026-12-23');
		const vorher = await ermittleStand(betreiber, a.versammlung);
		expect(vorher?.wandbild).toMatch(/^traktanden@/);

		await setzeWandbild(handelnder(betreiber), a.versammlung, 'frei', 'Weiter um 20:15');
		const nachher = await ermittleStand(betreiber, a.versammlung);
		expect(nachher?.wandbild).toMatch(/^frei@/);
		expect(nachher?.wandbild).not.toContain('20:15');
		expect(JSON.stringify(nachher)).not.toContain('Weiter um');
	});

	it('lehnt den eigenen Text ohne Wortlaut auch in der Datenbank ab', async () => {
		const a = await aufbau('Leinwand 5', '2026-12-24');
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE meeting SET wall_kind = 'frei', wall_text = '  ' WHERE id = ${a.versammlung}
			`)
		).rejects.toThrow(/meeting_wandbild_freitext/);
	});
});

describe('Gesamtauswertung (Story 5.13)', () => {
	it('führt jedes Traktandum auf, auch die Kenntnisnahmen', async () => {
		// Nur die Beschlüsse zu zeigen machte aus der Auswertung eine
		// Beschlussliste, und im Protokoll fehlte der halbe Abend.
		const a = await aufbau('Auswertungsweg 1', '2027-07-01');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const w = await holeAuswertung(betreiber, a.versammlung);
		// Die Pflichttraktanden aus Story 3.8 sind mit dabei — die Auswertung
		// führt jedes Traktandum auf, nicht nur die beschlossenen.
		expect(w?.zeilen.some((z) => z.art === 'kenntnisnahme')).toBe(true);
		expect(w?.zeilen.filter((z) => z.titel === 'Sanierung der Fassade')).toHaveLength(1);
		expect(w?.angenommen).toBe(1);
		expect(w?.abgelehnt).toBe(0);
		expect(w?.ohneAbstimmung).toBe((w?.zeilen.length ?? 0) - 1);
		expect(w?.zeilen.find((z) => z.titel === 'Sanierung der Fassade')?.satz).toMatch(/Angenommen/);
	});

	it('nennt bei einem Traktandum ohne Abstimmung kein Ergebnis', async () => {
		const a = await aufbau('Auswertungsweg 2', '2027-07-02');
		const w = await holeAuswertung(betreiber, a.versammlung);
		expect(w?.zeilen.every((z) => z.auszaehlung === null)).toBe(true);
		expect(w?.ohneAbstimmung).toBe(w?.zeilen.length);
		expect(w?.angenommen).toBe(0);
		expect(w?.abgelehnt).toBe(0);
	});
});

/**
 * Der Stichentscheid durch eine Person (Story 7.9).
 *
 * **Seit dem 28.09.2026 gilt die Klausel wieder** (Produktentscheid: «Wendet
 * es an. Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man nicht
 * Partei ergreifen würde.»). Beim Gleichstand hält die Anwendung an, bis der
 * Entscheid eingetragen ist; `haltStichentscheidFest` nimmt ihn entgegen,
 * verkündet und schreibt den Namen in den Verlauf.
 */
describe('Stichentscheid durch den Verwalter', () => {
	/** Eine Gemeinschaft mit zwei Parteien, die sich zwangsläufig blockieren. */
	async function gleichstand(name: string, datum: string) {
		// Über die Gemeinschaft, nicht über die Momentaufnahme: Die ist bewusst
		// schreibgeschützt (AD-3), und der Weg des Tests soll der Weg der
		// Anwendung sein.
		const a = await aufbau(name, datum, { tieBreak: 'verwalter' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'no' }], false);
		return a;
	}

	it('hält den Gleichstand offen, statt ihn als Ablehnung zu verkünden', async () => {
		const a = await gleichstand('Gleichweg 2', '2027-08-02');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).toBeNull();

		const ergebnis = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnis.auszaehlung?.stichentscheidOffen).toBe(true);
		expect(ergebnis.auszaehlung?.durchStichentscheid).toBe(false);
		expect(ergebnis.auszaehlung?.angenommen).toBe(false);
		expect(ergebnis.auszaehlung?.hinweise.join(' ')).toContain('entscheidet der Verwalter');
		expect(ergebnis.auszaehlung?.hinweise.join(' ')).toContain('empfiehlt die Ablehnung');
	});

	it('verkündet mit einem eingetragenen Ja die Annahme', async () => {
		/*
		 * **Die frühere Ausnahme ist wieder da.** Vom 27.09.2026 bis zum
		 * 28.09.2026 wartete die Anwendung nicht und verkündete die Ablehnung;
		 * davor und jetzt verkündet der Eintrag.
		 */
		const a = await gleichstand('Gleichweg 3', '2027-08-03');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).toBeNull();

		const neu = await haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
			wahl: 'yes',
			wer: 'Verwaltung Prüfhaus',
			begruendung: 'Der Schaden wächst.'
		});
		expect(neu.verkuendetAm).not.toBeNull();

		const ergebnis = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnis.auszaehlung?.angenommen).toBe(true);
		expect(ergebnis.auszaehlung?.durchStichentscheid).toBe(true);
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung?.ergebnis?.angenommen).toBe(true);
	});

	it('weist den Eintrag beim Quotenstichentscheid der Handzählung ab', async () => {
		/*
		 * **Nur wo das Reglement eine Person benennt** (Nachtrag 04.10.2026).
		 * `stichentscheidOffen` entsteht auch beim Quotenstichentscheid über
		 * einer Handzählung; dort ist der Weg die Neuabstimmung mit
		 * Einzelerfassung, nicht der Eintrag einer Person.
		 */
		const a = await aufbau('Gleichweg 8', '2027-08-08', { tieBreak: 'wertquote' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 1, nein: 1, enthaltung: 0 });
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
				wahl: 'yes',
				wer: 'Verwaltung Prüfhaus'
			})
		).rejects.toThrow(/keinen Gleichstand, den das Reglement einer Person zuweist/);
	});

	it('trägt den Entscheid mit Namen in den Verlauf ein', async () => {
		const a = await gleichstand('Gleichweg 7', '2027-08-07');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
			wahl: 'no',
			wer: 'Verwaltung Prüfhaus'
		});
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE event_type = 'vote.tiebreak.decided' AND subject_id = ${a.versammlung}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(JSON.stringify(eintraege[0].detail)).toContain('Verwaltung Prüfhaus');
	});
});

/*
 * **Der Vorsitz und die Kaskade am Eintragsweg** (Auftrag 07.10.2026,
 * Codeprüfung M4). Die Schranke in `haltStichentscheidFest` liest die Art aus
 * der Auszählung; ein Fehler darin bliebe in den Domänentests grün.
 */
describe('Stichentscheid durch den Vorsitz und nach den Wertquoten', () => {
	async function gleichstandMit(
		name: string,
		datum: string,
		tieBreak: Stichentscheid
	) {
		const a = await aufbau(name, datum, { tieBreak });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'no' }], false);
		return a;
	}

	it('nimmt beim Vorsitz den Entscheid mit zweiter Stimme entgegen und hält sie fest', async () => {
		const a = await gleichstandMit('Gleichweg 21', '2027-09-01', 'vorsitz');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const offen = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(offen.auszaehlung?.stichentscheidArt).toBe('vorsitz');

		await haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
			wahl: 'yes',
			wer: 'Vorsitz Prüfhaus',
			eigentuemer: true
		});
		const ergebnis = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnis.auszaehlung?.angenommen).toBe(true);
		expect(ergebnis.auszaehlung?.koepfe.ja).toBe(1);
		expect(ergebnis.auszaehlung?.hinweise.join(' ')).toContain('selbst Stockwerkeigentümer');
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE event_type = 'vote.tiebreak.decided' AND subject_id = ${a.versammlung}
			`
		);
		expect(JSON.stringify(eintraege[0].detail)).toContain('zweiteStimme');
	});

	it('weist die zweite Stimme beim Verwalter ab', async () => {
		const a = await gleichstandMit('Gleichweg 22', '2027-09-02', 'verwalter');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
				wahl: 'yes',
				wer: 'Verwaltung Prüfhaus',
				eigentuemer: true
			})
		).rejects.toThrow(/gibt es nur, wo das Reglement den/);
	});

	it('lässt keinen Eintrag zu, wenn die Wertquoten den Gleichstand schon auflösen', async () => {
		// 600 gegen 400 Wertquoten: Die erste Stufe entscheidet, die Person kommt
		// nicht zum Zug.
		const a = await gleichstandMit('Gleichweg 23', '2027-09-03', 'wertquote_vorsitz');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const ergebnis = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnis.auszaehlung?.angenommen).toBe(true);
		expect(ergebnis.auszaehlung?.stichentscheidArt).toBe('wertquote');
		await expect(
			haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
				wahl: 'no',
				wer: 'Vorsitz Prüfhaus'
			})
		).rejects.toThrow(/keinen Gleichstand, den das Reglement einer Person zuweist/);
	});

	it('weist bei einer Handzählung mit Kaskade den Eintrag der Person ab', async () => {
		const a = await aufbau('Gleichweg 24', '2027-09-04', { tieBreak: 'wertquote_vorsitz' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 1, nein: 1, enthaltung: 0 });
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
				wahl: 'yes',
				wer: 'Vorsitz Prüfhaus'
			})
		).rejects.toThrow(/keinen Gleichstand, den das Reglement einer Person zuweist/);
	});
});

/**
 * **Der Anlass, am 20.08.2026.** «dass der Sitzungsleiter für einen Eigentümer
 * stimmen darf. Das müsste aber dokumentiert sein. Bspw. Telefon ist gerade
 * ausgefallen.»
 */
describe('Der Text zum Beschluss', () => {
	/*
	 * **Was hier gemessen wird und was nicht.** Auftraggeber, 09.09.2026: «Der Text zum
	 * Beschluss führt Details, Präzisierungen oder Änderungen aus. Annahme und
	 * Ablehnung erfolgt hart über die Abstimmung.» Die Proben prüfen deshalb
	 * beides: dass der Text ankommt — und dass er am Ergebnis nichts ändert.
	 */
	it('setzt einen Text erst nach dem Schliessen', async () => {
		const a = await aufbau('Beschlussweg 1', '2027-09-01', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const offen = await holeOffenen(betreiber, a.versammlung);
		await expect(
			haltBeschlusstextFest(handelnder(betreiber), a.versammlung, offen!.id, 'zu früh')
		).rejects.toThrow(/Schliessen/);
	});

	it('hält ihn fest und lässt das Ergebnis unberührt', async () => {
		const a = await aufbau('Beschlussweg 2', '2027-09-02', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			a.parteien.map((p) => ({ parteiId: p, wahl: 'yes' as const })),
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const vorher = await holeErgebnis(betreiber, a.versammlung, d.id);

		const neu = await haltBeschlusstextFest(
			handelnder(betreiber),
			a.versammlung,
			d.id,
			'  zum Kostendach von CHF 5000  '
		);
		expect(neu.beschlusstext).toBe('zum Kostendach von CHF 5000');

		// **Der Kern der Vorgabe:** dieselbe Auszählung, dasselbe Ergebnis.
		const nachher = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(nachher.auszaehlung?.angenommen).toBe(vorher.auszaehlung?.angenommen);
		expect(nachher.auszaehlung?.koepfe).toEqual(vorher.auszaehlung?.koepfe);
		expect(nachher.durchgang.beschlusstext).toBe('zum Kostendach von CHF 5000');
	});

	it('nimmt ihn mit einem leeren Text wieder weg', async () => {
		const a = await aufbau('Beschlussweg 3', '2027-09-03', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'Vertipper');
		const leer = await haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, '   ');
		expect(leer.beschlusstext).toBeNull();
	});

	/*
	 * **Die Maske führt, der Server begrenzt** (Sicherheitsprüfung 09.09.2026).
	 * Ohne diese Schranke fiel ein sehr langer Text am Seitenende der
	 * `Auswertung.pdf` stillschweigend heraus — aus dem Blatt, das ins
	 * Siegelpaket geht.
	 */
	it('weist einen zu langen Text ab, statt ihn später stillschweigend zu kürzen', async () => {
		const a = await aufbau('Beschlussweg 8', '2027-09-08', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'x'.repeat(601))
		).rejects.toThrow(/600 Zeichen/);
		// Und die Grenze selbst geht durch.
		const grad = await haltBeschlusstextFest(
			handelnder(betreiber),
			a.versammlung,
			d.id,
			'y'.repeat(600)
		);
		expect(grad.beschlusstext?.length).toBe(600);
	});

	it('weist ihn am überholten Durchgang ab', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const { d, ...a } = await gleichstandGeschlossen('Beschlussweg 5', '2027-09-05');
		await setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, d.id, 'Verfahrensfehler');
		await expect(
			haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'zu spät')
		).rejects.toThrow(/überholt/);
	});

	/*
	 * **Der Durchgang gehört zum Nachweis, die Protokollnotiz nicht.** Deshalb
	 * ist hier nach dem Siegel Schluss, obwohl die Notiz offen bleibt. Ohne
	 * diese Prüfung käme der Trigger `voting_round_nach_siegel` als rohe
	 * Datenbankausnahme durch und endete auf einer Fehlerseite.
	 *
	 * Der Zustand wird direkt gesetzt: Geprüft wird die Schranke, nicht der Weg
	 * zum Siegel — den prüfen die Siegelproben.
	 */
	it('weist ihn nach dem Versiegeln mit einem Satz ab, nicht mit einer Ausnahme', async () => {
		const a = await aufbau('Beschlussweg 6', '2027-09-06', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await imKontext(betreiber, (tx) =>
			tx`UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${a.versammlung}`
		);
		await expect(
			haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'zu spät')
		).rejects.toThrow(/versiegelt/);
	});

	it('weist eine stille Überschreibung ab', async () => {
		const a = await aufbau('Beschlussweg 7', '2027-09-07', {});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'zuerst', '');
		// Der zweite Absender kannte den leeren Stand noch.
		await expect(
			haltBeschlusstextFest(handelnder(betreiber), a.versammlung, d.id, 'danach', '')
		).rejects.toThrow(/Schreibkonflikt|inzwischen|geändert/i);
	});

	/*
	 * **Er gehört dem Durchgang, nicht dem Traktandum** (Produktentscheid
	 * 09.09.2026). Das ist der ganze Grund für den gewählten Ort: Nach einer
	 * Neuabstimmung darf die Präzisierung des ersten Laufs nicht unter dem
	 * Ergebnis des zweiten stehen.
	 */
	it('bleibt beim überholten Durchgang, wenn neu abgestimmt wird', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const { d: erster, ...a } = await gleichstandGeschlossen('Beschlussweg 4', '2027-09-04');
		await haltBeschlusstextFest(
			handelnder(betreiber),
			a.versammlung,
			erster.id,
			'zum Kostendach von CHF 5000'
		);

		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			erster.id,
			'Verfahrensfehler bei der Fragestellung'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const zweiter = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		expect(zweiter.id).not.toBe(erster.id);
		expect(zweiter.beschlusstext).toBeNull();
		const alter = await holeErgebnis(betreiber, a.versammlung, erster.id);
		expect(alter.durchgang.beschlusstext).toBe('zum Kostendach von CHF 5000');
	});
});

describe('Stimmen, die die Sitzungsleitung stellvertretend erfasst', () => {
	it('werden in der geführten Betriebsart ohne Grund abgewiesen', async () => {
		const a = await aufbau('Stellvertretung 1', '2026-11-01', { betriebsart: 'gefuehrt' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await expect(
			gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[{ parteiId: a.parteien[0], wahl: 'yes' }],
				true
			)
		).rejects.toThrow(/Grund/);
	});

	it('tragen den Grund an jeder einzelnen Stimme, nicht nur im Verlauf', async () => {
		const a = await aufbau('Stellvertretung 2', '2026-11-02', { betriebsart: 'gefuehrt' });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			'Telefon ausgefallen, mündlich abgegeben'
		);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ chair_reason: string | null }[]>`
			SELECT chair_reason FROM vote WHERE round_id = ${d.id}
		`);
		expect(zeilen.length).toBeGreaterThan(0);
		for (const z of zeilen) expect(z.chair_reason).toBe('Telefon ausgefallen, mündlich abgegeben');

		const je = await holeStellvertretendeStimmen(betreiber, [d.id]);
		expect(je.get(d.id)).toEqual([
			{ name: expect.any(String), grund: 'Telefon ausgefallen, mündlich abgegeben' }
		]);
	});

	it('nennen je Partei die letzte Erfassung, nicht jede Berichtigung', async () => {
		// Eine Berichtigung erzeugt eine neue Zeile (AD-5); im Protokoll gehört
		// derselbe Name nicht zweimal hin.
		const a = await aufbau('Stellvertretung 3', '2026-11-03', { betriebsart: 'gefuehrt' });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'no' }],
			true,
			'Zuerst falsch verstanden'
		);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			'Berichtigt nach Rückfrage im Saal'
		);

		const je = await holeStellvertretendeStimmen(betreiber, [d.id]);
		expect(je.get(d.id)).toEqual([
			{ name: expect.any(String), grund: 'Berichtigt nach Rückfrage im Saal' }
		]);
	});

	it('brauchen in der einfachen Betriebsart keinen Grund', async () => {
		// Dort erfasst die Sitzungsleitung alles, und der Grund ist die
		// Betriebsart selbst. Sie steht im Protokoll an anderer Stelle.
		const a = await aufbau('Stellvertretung 4', '2026-11-04', { betriebsart: 'einfach' });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true
		);

		const je = await holeStellvertretendeStimmen(betreiber, [d.id]);
		expect(je.get(d.id)).toBeUndefined();
	});

	it('lassen sich nicht mit einem Alibigrund an der Datenbank vorbei schreiben', async () => {
		// Zu jedem CHECK gehört ein Test, der ihn verletzt — sonst weiss niemand,
		// ob er greift.
		const a = await aufbau('Stellvertretung 5', '2026-11-05', { betriebsart: 'gefuehrt' });
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		await expect(
			imKontext(betreiber, async (tx) => {
				const [p] = await tx<{ id: string; unit: string }[]>`
					SELECT sp.id, su.id AS unit
					FROM snapshot_party sp JOIN snapshot_unit su ON su.snapshot_party_id = sp.id
					WHERE sp.meeting_id = ${a.versammlung} LIMIT 1
				`;
				return tx`
					INSERT INTO vote (operator_id, round_id, snapshot_party_id, snapshot_unit_id,
					                  choice, recorded_by_chair, chair_reason)
					VALUES (${betreiber}, ${d.id}, ${p.id}, ${p.unit}, 'yes', true, 'ok')
				`;
			})
		).rejects.toThrow(/vote_chair_reason_gehaltvoll/);
	});
});

/**
 * **Die Universalversammlung** (Migration 128). Die Vorgabe der Gemeinschaft
 * ist «persönlich»; im Aufbau sind beide Parteien von Hand erfasst, also selbst
 * da. Jede Probe ist ohne die Ausnahme rot: Ohne vollzählige Versammlung weist
 * schon das Aufnehmen ab (erste Probe).
 */
describe('Universalversammlung', () => {
	const neuesGeschaeft = (meetingId: string, titel = 'Anschaffung einer Ladestation') =>
		nimmTraktandumAuf(handelnder(betreiber), {
			meetingId,
			parentId: null,
			titel,
			art: 'abstimmung',
			antragswortlaut: 'Die Gemeinschaft schafft eine Ladestation an.',
			antragstellerart: 'gemeinschaft',
			betroffeneParteiIds: []
		});

	async function eroeffnet(name: string, datum: string, u: { tieBreak?: Stichentscheid } = {}) {
		const a = await aufbau(name, datum, u);
		const t = await neuesGeschaeft(a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true });
		return { ...a, geschaeft: t.id };
	}

	it('nimmt nicht auf, solange jemand fehlt, und sagt wer', async () => {
		const a = await aufbau('Allweg 1', '2027-07-01', { anwesend: 1 });
		await expect(neuesGeschaeft(a.versammlung)).rejects.toThrow(/fehlen: Peter Kunz/);
	});

	it('nimmt auf, wenn alle selbst da sind, und vermerkt die Universalversammlung', async () => {
		const a = await aufbau('Allweg 2', '2027-07-02');
		const t = await neuesGeschaeft(a.versammlung);
		const gelesen = (await holeTraktanden(betreiber, a.versammlung)).find((x) => x.knoten.id === t.id);
		expect(gelesen?.knoten.ausnahme).toBe('universal');
	});

	it('öffnet ohne Bestätigung der Leitung nicht', async () => {
		const a = await aufbau('Allweg 3', '2027-07-03');
		const t = await neuesGeschaeft(a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		await expect(oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id)).rejects.toMatchObject({
			kennung: 'universal_traegt_nicht'
		});
	});

	it('öffnet nicht mehr, wenn nach dem Aufnehmen jemand gegangen ist', async () => {
		const a = await aufbau('Allweg 4', '2027-07-04');
		const t = await neuesGeschaeft(a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true })
		).rejects.toThrow(/fehlen: Peter Kunz/);
	});

	it('beschliesst, wenn alle da bleiben, und hält den Stand fürs Protokoll fest', async () => {
		const a = await eroeffnet('Allweg 5', '2027-07-05');
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.universal?.stand?.keinBeschluss).toBeNull();
		expect(ergebnislage((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung)).toBe(
			'angenommen'
		);
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(/Alle 2 stimmberechtigten Parteien waren bei der Abstimmung persönlich anwesend/);
	});

	/** Wer abgestimmt hat, darf gehen (Fachprüfung Runde 1, B-3). */
	it('lässt gehen, wer abgestimmt hat', async () => {
		const a = await eroeffnet('Allweg 6', '2027-07-06');
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], false);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.universal?.stand?.abgestimmtUndGegangen).toEqual(['Peter Kunz']);
		expect(ergebnislage((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung)).toBe(
			'angenommen'
		);
	});

	it('ergibt «kein Beschluss», wenn jemand ohne Stimme gegangen ist', async () => {
		const a = await eroeffnet('Allweg 7', '2027-07-07');
		await gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], false);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnislage(e.auszaehlung)).toBe('kein_beschluss');
		expect(e.auszaehlung?.angenommen).toBe(false);
		expect(e.auszaehlung?.keinBeschluss).toEqual({ grund: 'weggang', namen: ['Peter Kunz'] });
		// Festgeschrieben und verkündet, nicht in der Schwebe.
		expect(d.verkuendetAm).not.toBeNull();
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(/Kein Beschluss: Peter Kunz hat die Versammlung/);
		expect((await holeAuswertung(betreiber, a.versammlung))?.keinBeschluss).toBe(1);
	});

	/*
	 * **Bei der Handzählung genügt jeder Weggang**, auch nach dem Zählen
	 * (Handbuch, «Sonderfälle im Saal»). Bis Migration 156 kam das Schliessen
	 * hier gar nicht so weit: Es warf «mehr Stimmen als Stimmberechtigte»,
	 * weil es die Hände gegen den Stand beim Schliessen rechnete (S5).
	 */
	it('ergibt «kein Beschluss», wenn nach der Handzählung jemand geht', async () => {
		const a = await eroeffnet('Prüfhaus H4 Universal', '2027-07-19');
		await erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 2, nein: 0, enthaltung: 0 });
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(ergebnislage(e.auszaehlung)).toBe('kein_beschluss');
		expect(e.auszaehlung?.keinBeschluss).toEqual({
			grund: 'weggang',
			namen: ['Peter Kunz'],
			handzaehlung: true
		});
	});

	it('ergibt «kein Beschluss» nach einem Widerspruch, und nur einmal', async () => {
		const a = await eroeffnet('Allweg 8', '2027-07-08');
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await expect(
			haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[0])
		).rejects.toMatchObject({ kennung: 'schon_widersprochen' });
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(e.auszaehlung?.keinBeschluss?.grund).toBe('widerspruch');
		expect(e.auszaehlung?.keinBeschluss?.namen).toEqual(['Peter Kunz']);

		// Nach dem Widerspruch öffnet dasselbe Geschäft nicht nochmals als
		// Universalversammlung, und eine Neuabstimmung wird gar nicht erst
		// angesetzt: Sie führte in eine Absage (Codeprüfung, dritter Durchgang, M1).
		// Ohne Rückkommen gilt kein Beschluss: Beide schliessen mit «traktandieren
		// Sie den Beschluss» (Gegenprobe zu Punkt 10).
		const neu = setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, d.id, 'Prüflauf: neu');
		await expect(neu).rejects.toMatchObject({ kennung: 'nach_widerspruch' });
		await expect(neu).rejects.toThrow(UNIVERSAL_KENNTNIS);
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, { universalBestaetigt: true })
		).rejects.toThrow(UNIVERSAL_KENNTNIS);
	});

	/**
	 * **Eine Vollmacht, die beim Gehen zurückbleibt, trägt unter «persönlich»
	 * nicht** (Codeprüfung Block 3, H-1). Kunz geht ohne Stimme und lässt eine
	 * Vollmacht auf Muster da; Muster stimmt für ihn. Als «abgestimmt» zählte
	 * das bis hierher, und die Universalversammlung hielt.
	 */
	it('zählt eine Stimme mit Vollmacht nach dem Weggang nicht als abgestimmt', async () => {
		const a = await eroeffnet('Allweg 11', '2027-07-11');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[0]);
		const stand = await holeParteien(betreiber, a.versammlung);
		const nach = (wer: string) => stand.find((p) => p.name === wer)!;
		const v = await erfasseVollmacht(handelnder(betreiber), a.versammlung, {
			vertreteneId: nach('Peter Kunz').id,
			bevollmaechtigtId: nach('Anna Muster').id
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, v.id);
		// Muster kommt zurück und bringt Kunz über die Vollmacht mit.
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const e = await holeErgebnis(betreiber, a.versammlung, d.id);
		// Die Stimme steht da und zählt nicht; das Protokoll sagt es
		// (Fachprüfung Block 3, Runde 2, Befund 3).
		expect(e.auszaehlung?.keinBeschluss).toEqual({
			grund: 'weggang',
			namen: ['Peter Kunz'],
			stimmeOhneWirkung: ['Peter Kunz']
		});
		expect(d.universal?.stand?.abgestimmtUndGegangen).toEqual([]);
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(
			/Stimme von Peter Kunz zählt dafür nicht: Für dieses nicht angekündigte Geschäft genügte eine Vollmacht nicht/
		);
	});

	/**
	 * **Die Vollmacht zählt, wie sie bei der Stimmabgabe stand** (Codeprüfung
	 * Block 3, zweiter Durchgang, F1). Kunz ist als Gesellschaft durch ihr Organ
	 * da; das Organ stimmt, danach wird die Vollmacht beendet. Nach dem Stand
	 * von heute wäre Kunz nur «mit Vollmacht» gewesen, und die Stimme zählte
	 * nicht.
	 */
	it('bewertet eine Stimme nach der Vollmacht, die bei der Stimmabgabe galt', async () => {
		const a = await aufbau('Allweg 13', '2027-07-13');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[0]);
		const stand = await holeParteien(betreiber, a.versammlung);
		const nach = (wer: string) => stand.find((p) => p.name === wer)!;
		const v = await erfasseVollmacht(handelnder(betreiber), a.versammlung, {
			vertreteneId: nach('Peter Kunz').id,
			bevollmaechtigtId: nach('Anna Muster').id,
			vertretungsgrund: 'organ'
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		const t = await neuesGeschaeft(a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true });
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		await widerrufeVollmacht(handelnder(betreiber), a.versammlung, v.id, 'Prüflauf: Organ geht');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(ergebnislage((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung)).toBe(
			'angenommen'
		);
		expect(d.universal?.stand?.abgestimmtUndGegangen).toEqual(['Peter Kunz']);
	});

	/**
	 * **Nach einem Weggang darf neu eröffnet werden** (Fachprüfung Block 3,
	 * Frage 3), ohne Neuabstimmung und ohne Rückkommen. Ein Rückkommen gibt es
	 * auf «kein Beschluss» nicht.
	 */
	it('eröffnet nach einem Weggang neu, sobald wieder alle da sind', async () => {
		const a = await eroeffnet('Allweg 12', '2027-07-12');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft)
		).rejects.toMatchObject({ kennung: 'kein_beschluss' });

		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[1], 'von_hand');
		const zweiter = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, {
			universalBestaetigt: true
		});
		expect(zweiter.nummer).toBe(2);
		// Der Durchgang ohne Beschluss ist jetzt überholt, mit eigener Art und
		// Grund: Es gibt nie zwei geltende Durchgänge zum selben Geschäft
		// (Codeprüfung, zweiter Durchgang), und die Neueröffnung ist keine von
		// der Leitung angesetzte Neuabstimmung (Migration 130).
		const [erster] = (await holeDurchgaenge(betreiber, a.versammlung)).filter(
			(d) => d.traktandumId === a.geschaeft && d.nummer === 1
		);
		expect(erster.ueberholtAm).not.toBeNull();
		expect(erster.ueberholungsart).toBe('neueroeffnung');
		expect(erster.ueberholungsgrund).toMatch(/während der Abstimmung gegangen/);
		// Der Verlauf schreibt die eigene Art, nicht die der Neuabstimmung
		// (Produktentscheid 08.10.2026): «Abstimmung neu eröffnet» geht so ins
		// Abschlusspaket, statt eine Anordnung zu behaupten, die es nicht gab.
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT event_type FROM audit_entry
				WHERE subject_id = ${a.versammlung}
				  AND event_type IN ('vote.round.reopened', 'vote.round.superseded')
			`
		);
		expect(eintraege.map((e) => e.event_type)).toEqual(['vote.round.reopened']);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(ergebnislage((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung)).toBe(
			'angenommen'
		);
	});

	/**
	 * **Der Widerspruch vor dem Eröffnen** (Produktentscheid 29.09.2026,
	 * Migration 129). Er sperrt wie der spätere und steht im Protokoll. Die
	 * Gegenprobe ist ein zweites Geschäft derselben Versammlung ohne
	 * Widerspruch: Es öffnet, die Sperre sitzt also am Geschäft.
	 */
	it('hält einen Widerspruch vor dem Eröffnen fest, und das Geschäft öffnet danach nicht', async () => {
		const a = await aufbau('Allweg 14', '2027-07-14');
		const t = await neuesGeschaeft(a.versammlung);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
		expect(
			await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], t.id)
		).toEqual({ fruehererBeschluss: false });

		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true })
		).rejects.toThrow(/Zu diesem Geschäft hat jemand widersprochen/);
		await expect(
			haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[0], t.id)
		).rejects.toMatchObject({ kennung: 'schon_widersprochen' });
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(
			/^Nicht angekündigt\. Nicht als Universalversammlung zur Abstimmung gebracht: Um \d\d:\d\d hat Peter Kunz widersprochen/
		);

		const zweites = await neuesGeschaeft(a.versammlung, 'Zweites Geschäft');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, zweites.id, EINFACHES_MEHR);
		const d = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, zweites.id, {
			universalBestaetigt: true
		});
		expect(d.universal).not.toBeNull();
	});

	/**
	 * **Die Datenbank hält die Zeitpunkte selbst** (Migration 129): Solange zum
	 * Geschäft eine Abstimmung offen ist, gehört der Widerspruch an sie. Ein
	 * Eintrag «vor dem Eröffnen» liesse den laufenden Durchgang am Beschluss
	 * vorbeiführen. Gegenprobe: derselbe Eintrag mit dem Durchgang geht durch.
	 */
	it('weist einen Widerspruch ohne Durchgang ab, während die Abstimmung offen ist', async () => {
		const a = await eroeffnet('Allweg 15', '2027-07-15');
		const einfuegen = (mitDurchgang: boolean) =>
			alsBetreiber(betreiber, async (tx) => {
				const [r] = await tx<{ id: string }[]>`
					SELECT id FROM voting_round WHERE meeting_id = ${a.versammlung} AND state = 'offen'
				`;
				const [sp] = await tx<{ id: string }[]>`
					SELECT id FROM snapshot_party WHERE meeting_id = ${a.versammlung} AND party_id = ${a.parteien[1]}
				`;
				await tx`
					INSERT INTO universal_objection
						(agenda_item_id, meeting_id, operator_id, round_id, snapshot_party_id, party_name, recorded_by)
					VALUES (${a.geschaeft}, ${a.versammlung}, ${betreiber}, ${mitDurchgang ? r.id : null},
					        ${sp.id}, 'Peter Kunz', 'Prüflauf')
				`;
			});
		await expect(einfuegen(false)).rejects.toMatchObject({ schranke: 'universal_objection_zeitpunkt' });
		await einfuegen(true);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.universal?.stand?.keinBeschluss?.grund).toBe('widerspruch');
	});

	/**
	 * **Die Vertreter der Leitung, bei der Stimme oder beim Schliessen**
	 * (Migration 129; Fachprüfung Block 4a, Frage 3). Unter «vertreten» zählt
	 * Kunz über die Vollmacht auf Muster. Ist Muster bei der Stimmabgabe oder
	 * beim Schliessen als Vertreterin der Leitung angekreuzt, zählt die Stimme
	 * dafür nicht, und es entsteht kein Beschluss. Die Gegenprobe ist der Fall
	 * ohne Kreuz. «vorher, dann ab» ergibt einen Beschluss: Kunz ist beim
	 * Schliessen über eine gewöhnliche Vollmacht da und hebt die
	 * Universalversammlung nicht auf (Fachprüfung Frage 3, ohne Befund).
	 */
	for (const [fall, kreuze, erwartet] of [
		['nie angekreuzt', [], 'angenommen'],
		['nach der Stimme angekreuzt', ['nachher'], 'kein_beschluss'],
		['vor der Stimme angekreuzt, vor dem Schliessen abgekreuzt', ['vorher', 'ab'], 'angenommen']
	] as const) {
		it(`liest die Vertreter der Leitung bei Stimme und Schluss (${fall})`, async () => {
			const nr = fall === 'nie angekreuzt' ? 16 : fall.startsWith('nach') ? 17 : 19;
			const a = await aufbau(`Allweg ${nr}`, `2027-07-${nr}`, { universalvariante: 'vertreten' });
			await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
			await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[0]);
			const stand = await holeParteien(betreiber, a.versammlung);
			const nach = (wer: string) => stand.find((p) => p.name === wer)!;
			const v = await erfasseVollmacht(handelnder(betreiber), a.versammlung, {
				vertreteneId: nach('Peter Kunz').id,
				bevollmaechtigtId: nach('Anna Muster').id
			});
			await vermerkeVorlage(handelnder(betreiber), a.versammlung, v.id);
			await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, v.id);
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

			const t = await neuesGeschaeft(a.versammlung);
			await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
			await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true });
			const muster = [vollmachtsschluessel('Anna Muster')];
			const setze = (liste: string[]) => setzeLeitungsvertreter(handelnder(betreiber), a.versammlung, liste);
			if ((kreuze as readonly string[]).includes('vorher')) await setze(muster);
			await gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[
					{ parteiId: a.parteien[0], wahl: 'yes' },
					{ parteiId: a.parteien[1], wahl: 'yes' }
				],
				false
			);
			if ((kreuze as readonly string[]).includes('nachher')) await setze(muster);
			if ((kreuze as readonly string[]).includes('ab')) await setze([]);
			const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
			expect(ergebnislage((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung)).toBe(erwartet);
		});
	}

	/**
	 * **Nur über die Leitung vertreten heisst nicht «verlassen»** (Codeprüfung
	 * Block 4a, N-4). Kunz ist von Anfang an nur über Muster da, und Muster wird
	 * nach der Stimme als Vertreterin der Leitung angekreuzt. Das Protokoll nennt
	 * den Grund, nicht einen Weggang. Gegenprobe: Kunz ist beim Eröffnen selbst
	 * da, geht während der Abstimmung und gibt Muster eine Vollmacht; dann bleibt
	 * der Satz vom Verlassen.
	 */
	for (const [fall, nr] of [
		['nie selbst da', 25],
		['während der Abstimmung gegangen', 26],
		// Codeprüfung 30.09.2026, M-1: Geht der Vertreter kurz hinaus, schreibt
		// Votum auch der Partei ein «verlassen». Gegangen ist sie nicht.
		['Vertreter kurz draussen', 27]
	] as const) {
		it(`nennt im Protokoll den richtigen Grund (${fall})`, async () => {
			const a = await aufbau(`Allweg ${nr}`, `2027-07-${nr}`, { universalvariante: 'vertreten' });
			const holeStand = async () => {
				const stand = await holeParteien(betreiber, a.versammlung);
				return (wer: string) => stand.find((p) => p.name === wer)!;
			};
			const vertrete = async () => {
				const nach = await holeStand();
				await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
				await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[0]);
				const v = await erfasseVollmacht(handelnder(betreiber), a.versammlung, {
					vertreteneId: nach('Peter Kunz').id,
					bevollmaechtigtId: nach('Anna Muster').id
				});
				await vermerkeVorlage(handelnder(betreiber), a.versammlung, v.id);
				await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, v.id);
				await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
			};
			const vonAnfang = fall !== 'während der Abstimmung gegangen';
			if (vonAnfang) await vertrete();

			const t = await neuesGeschaeft(a.versammlung);
			await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, t.id, EINFACHES_MEHR);
			await oeffneAbstimmung(handelnder(betreiber), a.versammlung, t.id, { universalBestaetigt: true });
			if (!vonAnfang) await vertrete();
			if (fall === 'Vertreter kurz draussen') {
				await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[0]);
				await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
			}
			await gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[
					{ parteiId: a.parteien[0], wahl: 'yes' },
					{ parteiId: a.parteien[1], wahl: 'yes' }
				],
				false
			);
			await setzeLeitungsvertreter(handelnder(betreiber), a.versammlung, [
				vollmachtsschluessel('Anna Muster')
			]);
			const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
			const k = (await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung?.keinBeschluss;
			expect(k?.grund).toBe('weggang');
			expect(k?.namen).toEqual(['Peter Kunz']);
			const entwurf = (
				await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
			).replace(/\s+/g, ' ');
			if (vonAnfang) {
				expect(k?.nurDurchLeitung).toEqual([
					{ name: 'Peter Kunz', vertreter: 'Anna Muster', erfasstAm: expect.any(String) }
				]);
				expect(entwurf).toMatch(
					/Kein Beschluss: Peter Kunz war bei der Abstimmung durch Anna Muster vertreten\. Die Sitzungsleitung hat Anna Muster um \d\d:\d\d als Person erfasst, die für die Sitzungsleitung oder die Verwaltung handelt\. Vollmachten an solche Personen zählten nicht dafür, dass über dieses nicht angekündigte Geschäft beschlossen werden konnte\./
				);
				expect(entwurf).not.toMatch(/Peter Kunz hat die Versammlung/);
			} else {
				expect(k?.nurDurchLeitung).toBeUndefined();
				expect(entwurf).toContain(
					'Kein Beschluss: Peter Kunz hat die Versammlung vor dem Schluss der Abstimmung verlassen, ' +
						'ohne vorher abzustimmen.'
				);
			}
		});
	}

	/**
	 * **Mit Geschäft heisst: vor dem Eröffnen gemeint** (Codeprüfung Block 4a,
	 * N-2). Ist die Abstimmung inzwischen offen, sagt Votum das, statt den
	 * Widerspruch still an den Durchgang zu schreiben.
	 */
	it('hält einen Widerspruch vor dem Eröffnen nicht still an der offenen Abstimmung fest', async () => {
		const a = await eroeffnet('Allweg 20', '2027-07-20');
		await expect(
			haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft)
		).rejects.toMatchObject({ kennung: 'schon_eroeffnet' });
		// Gegenprobe: ohne Geschäft, also während der Abstimmung gemeint, geht es.
		await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1]);
	});

	/*
	 * **Nach einem Rückkommen ohne Beschluss sagt die Wand, dass der frühere
	 * bleibt** (`docs/freigabe.md`, «Gebaut: Rückkommen, Reste 1 bis 3»,
	 * Punkt 1). Massgebend ist dann der frühere Durchgang, und ohne den Satz
	 * läse sich sein «Angenommen» wie das Ergebnis des eben geschlossenen.
	 */
	it('nennt nach einem Rückkommen ohne Beschluss den geltenden Beschluss an der Wand', async () => {
		const a = await eroeffnet('Allweg 35', '2027-08-15');
		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, { universalBestaetigt: true });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const zweiter = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const [z] = await imKontext(
			betreiber,
			(tx) => tx`SELECT supersede_kind FROM voting_round WHERE id = ${zweiter.id}`
		);
		expect(z.supersede_kind).toBe('rueckkommen_erfolglos');

		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung?.nummer).toBe(1);
		expect(stand?.abstimmung?.ergebnis?.nachRueckkommen).toBe(
			'Im 2. Durchgang nach dem Rückkommen kam kein Beschluss zustande (Widerspruch). Es ' +
				'bleibt beim Beschluss aus dem 1. Durchgang.'
		);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'zurückgekommen und erneut abgestimmt; ein Beschluss kam dabei nicht zustande. Der oben ' +
				'festgehaltene Beschluss bleibt in Kraft.'
		);
	});

	/**
	 * **Nach einem beschlossenen Rückkommen hat der Widerspruch vor dem
	 * Eröffnen wieder seinen Ort** (Fachprüfung Block 4a, Stelle 6; Codeprüfung
	 * N-3). Vorher weist Votum ab, weil schon ein Beschluss gilt; danach hält es
	 * fest, und das Eröffnen sperrt. Der frühere Beschluss bleibt massgebend.
	 */
	it('nimmt den Widerspruch vor dem Eröffnen erst nach beschlossenem Rückkommen an', async () => {
		const a = await eroeffnet('Allweg 21', '2027-07-21');
		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await expect(
			haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft)
		).rejects.toMatchObject({ kennung: 'schon_abgestimmt' });

		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		// Die Meldung danach nennt den früheren Beschluss (Codeprüfung M-a).
		expect(
			await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft)
		).toEqual({ fruehererBeschluss: true });
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, { universalBestaetigt: true })
		).rejects.toThrow(/Zu diesem Geschäft hat jemand widersprochen/);
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(
			/^Nicht angekündigt\. Als Universalversammlung zur Abstimmung gebracht: .* Neu abgestimmt wurde nicht: Um \d\d:\d\d hat Peter Kunz widersprochen, dass heute neu darüber beschlossen wird\. Es bleibt beim Beschluss aus dem 1\. Durchgang\.$/
		);
	});

	/**
	 * **Die Absagen einer veralteten Seite sagen dasselbe wie die Leitungsseite**
	 * (`docs/freigabe.md`, «Offen: Reste zur Universalversammlung», Punkt 10).
	 * Nach Rückkommen und Widerspruch gilt der frühere Beschluss; Eröffnen und
	 * Neuabstimmung schliessen mit `UNIVERSAL_FRUEHERER_BESCHLUSS`, nicht mit
	 * «traktandieren Sie den Beschluss».
	 */
	it('schliesst beide Absagen nach Rückkommen und Widerspruch mit dem früheren Beschluss', async () => {
		const a = await eroeffnet('Allweg 36', '2027-07-26');
		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		const erst = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft);

		const eroeffnen = oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, {
			universalBestaetigt: true
		});
		await expect(eroeffnen).rejects.toThrow(UNIVERSAL_FRUEHERER_BESCHLUSS);
		await expect(eroeffnen).rejects.not.toThrow(UNIVERSAL_KENNTNIS);
		const neu = setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, erst.id, 'Prüflauf: neu');
		await expect(neu).rejects.toMatchObject({ kennung: 'nach_widerspruch' });
		await expect(neu).rejects.toThrow(UNIVERSAL_FRUEHERER_BESCHLUSS);
		await expect(neu).rejects.not.toThrow(UNIVERSAL_KENNTNIS);
	});

	/**
	 * **Rückkommen, neu abgestimmt, Neuabstimmung angesetzt, dann Widerspruch
	 * vor dem neuen Eröffnen** (`docs/freigabe.md`, «Reste zur
	 * Universalversammlung», Punkt 9; Migration 131). Der frühere Beschluss
	 * gilt; Seite und Protokoll sagen, dass er in Kraft bleibt.
	 *
	 * Seit H6 über einen offenen Gleichstand im Durchgang nach dem Rückkommen:
	 * Einen verkündeten überholt die Leitung nicht mehr, und der unentschiedene
	 * hat den früheren Beschluss nie ersetzt.
	 */
	it('lässt nach Rückkommen und Neuabstimmung den früheren Beschluss gelten, auch nach einem Widerspruch', async () => {
		const a = await eroeffnet('Allweg 23', '2027-07-23', { tieBreak: 'verwalter' });
		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		const erst = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, { universalBestaetigt: true });
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'no' }
			],
			false
		);
		const zweiter = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(zweiter.verkuendetAm).toBeNull();
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			zweiter.id,
			'Prüflauf: Frage falsch gestellt'
		);

		expect(
			await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft)
		).toEqual({ fruehererBeschluss: true });
		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.durchgang).toBe(erst.nummer);
		// «Zur angesetzten Neuabstimmung kam es nicht», nicht «Neu abgestimmt
		// wurde nicht»: Neu abgestimmt wurde, nur ohne Beschluss (Laien- und
		// Fachprüfung 29.09.2026).
		expect(zeile?.ausnahmeVermerk).toMatch(
			/Zur angesetzten Neuabstimmung kam es nicht: Um \d\d:\d\d hat Peter Kunz widersprochen, dass heute neu darüber beschlossen wird\. Es bleibt beim Beschluss aus dem 1\. Durchgang\.$/
		);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'im 2. Durchgang erneut abgestimmt; es stand unentschieden, und der Stichentscheid wurde ' +
				'nicht festgestellt. Die Sitzungsleitung hat danach eine Neuabstimmung angesetzt ' +
				'(Begründung: Prüflauf: Frage falsch gestellt); zu ihr kam es nicht mehr. Es bleibt ' +
				'beim Beschluss aus dem 1. Durchgang, wie oben festgehalten.'
		);
		expect(text).not.toContain('Neu abgestimmt wurde nicht');
		expect(text).not.toContain('Ein Beschluss ist nicht gefasst worden.');
	});

	/**
	 * **Rückkommen angenommen, dann Neuabstimmung auf den geltenden Durchgang,
	 * dann widerspricht jemand im neuen** (Codeprüfung zu Punkt 9, zweiter
	 * Durchgang, M-1). Der neue Durchgang hängt am Rückkommen, aber es gibt
	 * keinen früheren zu erhalten: Er bleibt mit «kein Beschluss» stehen, statt
	 * als erfolgloses Rückkommen überholt zu werden.
	 *
	 * Seit H6 endet der erste Durchgang mit offenem Gleichstand: Nur der lässt
	 * sich nach dem Rückkommen noch überholen, ein verkündeter nicht mehr.
	 */
	it('lässt einen Durchgang ohne Beschluss stehen, wenn das Rückkommen nichts zu erhalten hat', async () => {
		const a = await eroeffnet('Allweg 24', '2027-07-24', { tieBreak: 'verwalter' });
		const beide = [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			{ parteiId: a.parteien[1], wahl: 'yes' as const }
		];
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'no' }
			],
			false
		);
		const erst = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(erst.verkuendetAm).toBeNull();
		const r = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.geschaeft);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, r.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, beide, false);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await setzeNeuabstimmungAn(
			handelnder(betreiber),
			a.versammlung,
			erst.id,
			'Prüflauf: Frage falsch gestellt'
		);

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.geschaeft, { universalBestaetigt: true });
		await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const zweiter = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT reconsideration_item_id, superseded_at, supersede_kind FROM voting_round
			            WHERE id = ${zweiter.id}`
		);
		expect(zeile).toEqual({
			reconsideration_item_id: r.id,
			superseded_at: null,
			supersede_kind: null
		});
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		const abschnitt = text.slice(text.indexOf('#### 5 Anschaffung'), text.indexOf('##### 5.1'));
		expect(abschnitt).not.toContain('Über diesen Antrag wurde nicht abgestimmt.');
		expect(abschnitt).toContain('Peter Kunz');
	});

	it('beendet einen Vertreter der Leitung, statt ihn zu löschen', async () => {
		const a = await aufbau('Allweg 18', '2027-07-18', { universalvariante: 'vertreten' });
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		const stand = await holeParteien(betreiber, a.versammlung);
		const nach = (wer: string) => stand.find((p) => p.name === wer)!;
		const v = await erfasseVollmacht(handelnder(betreiber), a.versammlung, {
			vertreteneId: nach('Peter Kunz').id,
			bevollmaechtigtId: nach('Anna Muster').id
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, v.id);
		const muster = vollmachtsschluessel('Anna Muster');
		await setzeLeitungsvertreter(handelnder(betreiber), a.versammlung, [muster]);
		await setzeLeitungsvertreter(handelnder(betreiber), a.versammlung, []);
		await setzeLeitungsvertreter(handelnder(betreiber), a.versammlung, [muster]);
		const zeilen = await imKontext(betreiber, (tx) => tx<{ ended_at: Date | null }[]>`
			SELECT ended_at FROM meeting_chair_holder WHERE meeting_id = ${a.versammlung} ORDER BY created_at, id
		`);
		expect(zeilen.map((z) => z.ended_at !== null)).toEqual([true, false]);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM meeting_chair_holder WHERE meeting_id = ${a.versammlung}`)
		).rejects.toThrow(/permission denied/);
	});

	/**
	 * **Nach einer angesetzten Neuabstimmung und einem Widerspruch vor dem
	 * neuen Eröffnen** (Fachprüfung Block 4a, Runde 3, F-1; Laienprüfung L11).
	 * Das Protokoll sagt, dass abgestimmt wurde, warum der Durchgang nicht gilt
	 * und dass kein Beschluss gefasst ist, statt «wurde nicht abgestimmt».
	 */
	it('nennt im Protokoll die angesetzte Neuabstimmung, wenn danach widersprochen wurde', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const a = await eroeffnet('Allweg 22', '2027-07-22', { tieBreak: 'verwalter' });
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).toBeNull();
		await setzeNeuabstimmungAn(handelnder(betreiber), a.versammlung, d.id, 'Prüflauf: Frage falsch gestellt');
		expect(
			await haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1], a.geschaeft)
		).toEqual({ fruehererBeschluss: false });

		const zeile = (await holeAuswertung(betreiber, a.versammlung))?.zeilen.find(
			(z) => z.titel === 'Anschaffung einer Ladestation'
		);
		expect(zeile?.ausnahmeVermerk).toMatch(/^Nicht angekündigt\. Nicht mehr als Universalversammlung/);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Abgestimmt wurde im 1. Durchgang; es stand unentschieden, und der Stichentscheid wurde ' +
				'nicht festgestellt. Die Sitzungsleitung hat eine Neuabstimmung angesetzt (Begründung: ' +
				'Prüflauf: Frage falsch gestellt). Ein Beschluss ist nicht gefasst worden.'
		);
		// Der Vermerk oben nennt das Traktandieren schon; unten kein zweiter Satz dazu.
		expect(text).not.toContain('Soll neu entschieden werden');
		// Gegenprobe: Der generische Satz steht bei diesem Geschäft nicht mehr.
		const abschnitt = text.slice(text.indexOf('Anschaffung einer Ladestation'));
		expect(abschnitt).not.toMatch(/^[^#]*Über diesen Antrag wurde nicht abgestimmt\./);
	});

	it('hält keinen Widerspruch ohne offene Universalabstimmung fest', async () => {
		const a = await aufbau('Allweg 9', '2027-07-09');
		await expect(
			haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[0])
		).rejects.toMatchObject({ kennung: 'kein_universaldurchgang' });
	});

	/** Der Vermerk braucht seine Grundlage, wie bei (a). */
	it('weist den Vermerk ab, wenn die Gemeinschaft keine Universalversammlung abhält', async () => {
		const a = await aufbau('Allweg 10', '2027-07-10', { universalvariante: 'keine' });
		await expect(neuesGeschaeft(a.versammlung)).rejects.toThrow(/keine Universalversammlung/);
		await expect(
			alsBetreiber(betreiber, async (tx) => {
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind,
					                         motion_text, proposer_kind, is_spontaneous, spontaneous_kind,
					                         added_during_meeting_at, unannounced_basis)
					VALUES (${id}, ${betreiber}, ${a.versammlung}, 99, 'Am Einstellen vorbei', 'abstimmung',
					        'Wortlaut', 'gemeinschaft', true, 'neu', now(), 'universal')
				`;
			})
		).rejects.toMatchObject({ schranke: 'agenda_ausnahme_ohne_grundlage' });
	});

	/*
	 * **Kein 40P01 mit einem Beschluss von Hand am selben Geschäft** (Auftrag
	 * Abschluss, C2, 16.10.2026). Der Widerspruch sperrt den offenen Durchgang,
	 * und sein `INSERT INTO universal_objection` fährt danach die
	 * Fremdschlüsselprüfung aufs Traktandum. Der Beschluss von Hand sperrt
	 * umgekehrt. Gesteuert wie in `abschluss-rennen.test.ts`: Eine dritte
	 * Verbindung hält das Traktandum, der Beschluss von Hand reiht sich dort
	 * zuerst ein. Am alten Stand hielt der Widerspruch dann schon den
	 * Durchgang und reihte sich erst mit dem `INSERT` dahinter ein (40P01); am
	 * neuen wartet er an der vorweggenommenen Sperre.
	 */
	it('verklemmt sich nicht mit einem Beschluss von Hand am selben Geschäft', async () => {
		const a = await eroeffnet('Allweg C2', '2027-07-30');
		const sperre = await halteSperre(async (tx) => {
			const zeilen = await tx`SELECT 1 FROM agenda_item WHERE id = ${a.geschaeft} FOR UPDATE`;
			expect(zeilen).toHaveLength(1);
		});
		let fertig = false;
		const vonHand = haltBeschlussVonHandFest(handelnder(betreiber), a.versammlung, a.geschaeft, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'parteien',
				stimmen: a.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const }))
			}
		});
		vonHand.then(() => (fertig = true), () => (fertig = true));
		await warteAufWartende(1, () => fertig);
		const widerspruch = haltWiderspruchFest(handelnder(betreiber), a.versammlung, a.parteien[1]);
		widerspruch.then(() => (fertig = true), () => (fertig = true));
		await warteAufWartende(2, () => fertig);
		expect(fertig, 'ein Lauf endete, bevor beide warteten').toBe(false);
		await sperre.loesen();

		const ausgang = (await Promise.allSettled([vonHand, widerspruch])).map((e) => {
			if (e.status === 'fulfilled') return 'ok';
			expect((e.reason as { code?: string }).code, String(e.reason)).not.toBe('40P01');
			return (e.reason as { kennung?: string }).kennung;
		});
		// Der Beschluss von Hand hat den Universaldurchgang geschlossen; danach
		// ist keiner mehr offen, an den ein Widerspruch gehörte.
		expect(ausgang).toEqual(['ok', 'kein_universaldurchgang']);
	});
});

/**
 * Die geheime Abstimmung (Produktentscheide 28.09.2026, Migration 141).
 *
 * Gerechnet wird wie bei jeder Abstimmung; das Merkmal steuert die Ausgabe.
 * Die Proben messen deshalb, was die Leser bekommen: Der Strom an die Wand
 * trägt keine Zahlen, die Auswertung keinen Zahlenspiegel.
 */
describe('Geheime Abstimmung', () => {
	async function geheimAbstimmen(name: string, datum: string) {
		const a = await aufbau(name, datum);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			geheim: true,
			geheimBeschlossen: true
		});
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'no' }],
			false
		);
		return a;
	}

	it('hält das Merkmal am Durchgang fest', async () => {
		const a = await geheimAbstimmen('Geheimweg 1', '2027-09-01');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.geheim).toBe(true);
	});

	it('lässt das Geheim-Merkmal nicht mehr ändern', async () => {
		/*
		 * **Entscheid 04.10.2026 (zweiter Blick zu Lauf B, Frage Z2):** Das
		 * Merkmal wird in der Datenbank gesperrt (Migration 143). Ein
		 * nachträgliches Umstellen drehte die Ausgaberegel eines
		 * abgeschlossenen Durchgangs; bis dahin stand die Regel nur im
		 * Spaltenkommentar. Die Sperre trifft den anderen Wert, nicht jede
		 * Schreiboperation: Dasselbe UPDATE mit dem bisherigen Wert bleibt
		 * erlaubt, und das Setzen beim Eröffnen prüft die Probe darüber.
		 */
		const a = await geheimAbstimmen('Geheimweg 7', '2027-09-07');
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await imKontext(betreiber, (tx) => tx`UPDATE voting_round SET secret = true WHERE id = ${d.id}`);
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE voting_round SET secret = false WHERE id = ${d.id}`)
		).rejects.toThrow(/unveränderlich/i);
	});

	/*
	 * **Geheim nur auf offenen Beschluss** (Ä-38, Punkt 8, Produktentscheid
	 * 16.10.2026, Migration 165): ohne Bestätigung kein geheimes Eröffnen; die
	 * Bestätigung steht am Durchgang und ist danach unveränderlich.
	 */
	it('eröffnet geheim nur mit dem bestätigten offenen Beschluss', async () => {
		const a = await aufbau('Geheimweg 8', '2027-09-08');
		await expect(
			oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { geheim: true })
		).rejects.toThrow(/offenen Beschluss/);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			geheim: true,
			geheimBeschlossen: true
		});
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.geheimBeschlossen).toBe(true);
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE voting_round SET secret_resolved = NULL WHERE id = ${d.id}`)
		).rejects.toThrow(/unveränderlich/i);
	});

	it('eröffnet geheim auch nach Reglement und nennt im Protokoll, was zutrifft', async () => {
		/*
		 * Fachprüfung 16.10.2026 (Rz. 160 f. ad Art. 712m), Produktentscheid
		 * «Warum nicht beides?», Migration 166.
		 */
		const a = await aufbau('Geheimweg 10', '2027-09-10');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			geheim: true,
			geheimNachReglement: true
		});
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.geheimNachReglement).toBe(true);
		expect(d.geheimBeschlossen).toBe(false);
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurf).toContain('Das Reglement der Gemeinschaft sieht die geheime Abstimmung hier vor.');
		expect(entwurf).not.toContain('zuvor offen beschlossen');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE voting_round SET secret_by_bylaw = NULL WHERE id = ${d.id}`)
		).rejects.toThrow(/unveränderlich/i);
	});

	it('hält bei offener Abstimmung keinen Beschluss fest, und die Datenbank lässt keinen zu', async () => {
		const a = await aufbau('Geheimweg 9', '2027-09-09');
		// Das Häkchen allein macht nichts geheim.
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			geheimBeschlossen: true
		});
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.geheim).toBe(false);
		expect(d.geheimBeschlossen).toBe(false);
		const [z] = await imKontext(
			betreiber,
			(tx) => tx<{ r: boolean | null }[]>`SELECT secret_resolved AS r FROM voting_round WHERE id = ${d.id}`
		);
		expect(z.r).toBeNull();
	});

	it('liefert an die Wand nur erreicht/nicht erreicht, blinde Spiegel', async () => {
		const a = await geheimAbstimmen('Geheimweg 2', '2027-09-02');
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const stand = await ermittleStand(betreiber, a.versammlung);
		expect(stand?.abstimmung?.geheim).toBe(true);
		expect(stand?.abstimmung?.ergebnis?.geheim).toBe(true);
		// Blind gestellt: Die Nutzlast trägt keine Verteilung.
		expect(stand?.abstimmung?.ergebnis?.koepfe.ja).toBe(0);
		expect(stand?.abstimmung?.ergebnis?.quoten.ja).toBe(0);
		const satz = stand?.abstimmung?.ergebnis?.satz ?? '';
		expect(satz).toContain('Geheim abgestimmt');
		expect(satz).not.toMatch(/\d/);
	});

	it('gibt auch in der Auswertung keine Zahlen heraus', async () => {
		const a = await geheimAbstimmen('Geheimweg 3', '2027-09-03');
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const w = await holeAuswertung(betreiber, a.versammlung);
		const zeile = w?.zeilen.find((z) => z.auszaehlung?.geheim);
		expect(zeile?.satz).toContain('Geheim abgestimmt');
		expect(zeile?.satz).not.toMatch(/\d/);
	});

	it('vermerkt die geheime Abstimmung im Protokoll, ohne Zahlenspiegel', async () => {
		const a = await geheimAbstimmen('Geheimweg 4', '2027-09-04');
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurf).toContain('Geheim abgestimmt');
		expect(entwurf).toContain('Kopfstimmen:');
		// Der Zahlenspiegel fehlt, und der Vermerk nennt, wo die Stimmen liegen.
		expect(entwurf).not.toMatch(/- Kopfstimmen: \d/);
		expect(entwurf).toContain('auf dem Stimmnachweisblatt im Abschlusspaket');
		// Die Grundlage: der offene Beschluss (Ä-38, Punkt 8, Migration 165).
		expect(entwurf).toContain(
			'Die Versammlung hat zuvor offen beschlossen, über diesen Antrag geheim abzustimmen.'
		);
	});

	it('nennt bei geheimem Gleichstand den Entscheid, aber keine Kopfzahlen', async () => {
		/*
		 * **Die Kombination aus B1 und B2** (Entscheid 04.10.2026, zweiter
		 * Blick zu Lauf B, Frage Z1): geheime Abstimmung, Verwalter-Klausel,
		 * Gleichstand. Das Patt bleibt in den Dokumenten genannt; es ist die
		 * Begründung des Entscheidwegs, und ein Stichentscheid setzt es
		 * voraus. Die Zahlen bleiben maskiert, und der Saal nennt den
		 * Entscheid nicht.
		 */
		const a = await aufbau('Geheimweg 5', '2027-09-05', { tieBreak: 'verwalter' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, {
			geheim: true,
			geheimBeschlossen: true
		});
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			false
		);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'no' }],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(d.verkuendetAm).toBeNull();

		// Der offene Zustand nennt das Patt, aber keine Kopfzahlen.
		const offen = (await holeAuswertung(betreiber, a.versammlung))!;
		const offeneZeile = offen.zeilen.find((z) => z.auszaehlung?.geheim)!;
		expect(offeneZeile.satz).toContain('Stimmengleichheit');
		expect(offeneZeile.satz).not.toMatch(/\d/);

		await haltStichentscheidFest(handelnder(betreiber), a.versammlung, d.id, {
			wahl: 'yes',
			wer: 'Verwaltung Prüfhaus'
		});

		// Der Saal-Satz bleibt der geheime Satz; der Stichentscheid steht nicht darin.
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		const stand = await ermittleStand(betreiber, a.versammlung);
		const saal = stand?.abstimmung?.ergebnis?.satz ?? '';
		expect(saal).toContain('Geheim abgestimmt');
		expect(saal).toContain('Kopfstimmen: erreicht');
		expect(saal).not.toContain('Stichentscheid');

		// Der Protokollentwurf nennt den Entscheid mit Person und ohne Stimmzahlen.
		const entwurf = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(entwurf).toContain('Bei Stimmengleichheit entschied Verwaltung Prüfhaus: Annahme');
		expect(entwurf).not.toMatch(/- Kopfstimmen: \d/);

		// Das Auswertungs-PDF nennt ihn ebenso, mit dem Patt.
		const a2 = (await holeAuswertung(betreiber, a.versammlung))!;
		const bytes = await erzeugeAuswertung({
			versammlung: a2.versammlung,
			gemeinschaftName: 'Prüfgemeinschaft',
			zaehlweise: a2.zaehlweise,
			stichentscheid: a2.stichentscheid,
			zeilen: a2.zeilen,
			erzeugtAm: '1. November 2027, 21:30'
		});
		const { PDFDocument } = await import('pdf-lib');
		const { textVonSeite } = await import('./pdftext');
		const seiten = (await PDFDocument.load(bytes)).getPageCount();
		const pdf = (
			await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i)))
		)
			.join(' ')
			.replace(/\s+/g, ' ');
		expect(pdf).toContain('Stichentscheid bei Stimmengleichheit durch Verwaltung Prüfhaus: angenommen');

		// Die Gegenprobe: ohne geheim nennt derselbe Fall die Kopfzahlen.
		const b = await aufbau('Geheimweg 6', '2027-09-06', { tieBreak: 'verwalter' });
		await oeffneAbstimmung(handelnder(betreiber), b.versammlung, b.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			b.versammlung,
			[{ parteiId: b.parteien[0], wahl: 'yes' }],
			false
		);
		await gibStimmenAb(
			handelnder(betreiber),
			b.versammlung,
			[{ parteiId: b.parteien[1], wahl: 'no' }],
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), b.versammlung);
		const offenB = (await holeAuswertung(betreiber, b.versammlung))!;
		const zeileB = offenB.zeilen.find((z) => z.auszaehlung?.stichentscheidOffen === true)!;
		expect(zeileB.satz).toContain('Stimmengleichheit bei 1 zu 1 Kopfstimmen');
	});
});
