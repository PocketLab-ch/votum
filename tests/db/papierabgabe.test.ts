/**
 * Stimmabgabe auf Papier an der Datenbank (Migration 107).
 *
 * Die Regel selbst prüft `tests/domain/stellvertretendestimme`. Hier steht, was
 * sich nur an der Datenbank zeigt:
 *
 *   · dass der Vermerk die Begründungspflicht wirklich aufhebt — und zwar nur
 *     für den Stapel, in dem ausschliesslich Papierparteien stehen;
 *   · dass das Siegel ihn sperrt, anders als die Pendenz;
 *   · dass die Mandantengrenze hält;
 *   · und dass der Verlaufseintrag über das AUFHEBEN auffindbar bleibt,
 *     obwohl die Zeile dann weg ist.
 *
 * Der letzte Punkt ist der, an dem der Pendenz-Block im Review aufgelaufen ist:
 * Ein Eintrag, dessen Gegenstand mit ihm verschwindet, fällt aus jedem
 * gefilterten Verlauf.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	schliesseVersammlung,
	holeVersammlung,
	setzePapierfrage
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { alsBetreiber } from '$lib/server/db';
import { bestaetigeAnwesenheit, holeUebersicht } from '$lib/server/anwesenheit';
import {
	hebePapierabgabeAuf,
	holePapierabgaben,
	vermerkePapierabgabe
} from '$lib/server/papierabgabe';
import {
	gibStimmenAb,
	holeFortschritt,
	holeStimmsperren,
	oeffneAbstimmung
} from '$lib/server/abstimmung';
import { holeErfassungsstand } from '$lib/server/erfassungsliste';
import { erklaereAusstand } from '$lib/server/ausstand';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { papiervermerkAusFormular } from '$lib/server/einlassaktionen';
import { holeBeantwortete, vermerkeFrageBeantwortet } from '$lib/server/papierabgabe';
import { nichtGefragte } from '$lib/domain/stimmabgabe';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Wortgleich zu `tests/db/abstimmung`: Ohne Erfordernis lässt sich nicht öffnen. */
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

/** Eine laufende Versammlung mit zwei Parteien und einem Traktandum. */
async function aufbau(
	name: string,
	datum: string,
	/** Ausdrücklich, weil eine Probe unten genau darauf zielt. */
	betriebsart: 'gefuehrt' | 'einfach' = 'gefuehrt'
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'keiner'
	});

	const parteien: string[] = [];
	for (const [i, wer] of ['Anna Muster', 'Bernd Beispiel'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 500 },
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
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		// Vorgabe «gefuehrt»: In «einfach» entfiele die Begründung ohnehin, und
		// die meisten Proben unten würden nichts mehr unterscheiden. Die eine,
		// die es doch tut, reicht den Wert durch.
		betriebsart
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Rampe beim Hauseingang',
		art: 'abstimmung',
		antragswortlaut: 'Die Rampe wird gemäss Offerte erstellt.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	// Ohne Anwesenheit scheitert jede Stimme schon davor, und die Proben unten
	// wären aus dem falschen Grund grün.
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Papier A');
	betreiberB = await pruefbetreiber('Papier B');
	benutzer = await pruefbenutzer(betreiber, 'pruefleitung');
});

afterAll(verbindungenSchliessen);

describe('Vermerken', () => {
	it('hält Partei, Weg und Urheber fest', async () => {
		const a = await aufbau('Prüflauf Papier 1', '2027-10-01');
		expect(await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand')).toBe(true);

		const liste = await holePapierabgaben(betreiber, a.versammlung);
		expect(liste.map((p) => p.parteiId)).toEqual([a.parteien[0]]);
		expect(liste[0].weg).toBe('von_hand');
		expect(liste[0].vermerktVon).toBe('Prüflauf');
	});

	/*
	 * Am Eingang drückt jemand denselben Knopf zweimal. Der zweite Druck darf
	 * weder scheitern noch einen zweiten Verlaufseintrag erzeugen.
	 */
	it('meldet den zweiten Knopfdruck als «nichts geschehen»', async () => {
		const a = await aufbau('Prüflauf Papier 2', '2027-10-02');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		expect(await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'gescannt')).toBe(false);

		const liste = await holePapierabgaben(betreiber, a.versammlung);
		expect(liste).toHaveLength(1);
		// Der erste Vermerk steht, nicht der zweite: Er trägt den Urheber, der
		// wirklich gehandelt hat.
		expect(liste[0].weg).toBe('von_hand');

		// Und der zweite Druck erzeugt keinen zweiten Verlaufseintrag. Ohne diese
		// Zeile misst nichts, was der Rückgabewert «false» verspricht.
		const { zeilen } = await leseVerlauf(betreiber, { versammlung: a.versammlung });
		expect(zeilen.filter((z) => z.art === 'vote.paper.set')).toHaveLength(1);
	});

	it('weist eine Partei aus einer anderen Versammlung ab', async () => {
		const a = await aufbau('Prüflauf Papier 3', '2027-10-03');
		const b = await aufbau('Prüflauf Papier 4', '2027-10-04');
		await expect(
			vermerkePapierabgabe(handelnder(betreiber), a.versammlung, b.parteien[0], 'von_hand')
		).rejects.toThrow(/nicht in der Liste der Stimmberechtigten/);
	});
});

describe('Die Wirkung auf die Begründungspflicht', () => {
	/**
	 * **Die Probe, um die es bei dieser Tabelle geht.** Ohne Vermerk verlangt die
	 * geführte Betriebsart bei jeder stellvertretend erfassten Stimme einen
	 * Grund; mit Vermerk entfällt er, weil es das vereinbarte Verfahren ist.
	 */
	it('erlässt den Grund für eine Papierpartei und verlangt ihn sonst weiter', async () => {
		const a = await aufbau('Prüflauf Papier 5', '2027-10-05');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		/*
		 * **Der Wortlaut steht in der Zusicherung, nicht bloss «wirft».** Ein
		 * blosses `toThrow()` wäre auch dann grün, wenn die Stimme an etwas ganz
		 * anderem scheitert — an der fehlenden Anwesenheit etwa, und genau das ist
		 * beim ersten Anlauf dieser Probe passiert.
		 */
		await expect(
			gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[0], wahl: 'yes' }], true, null)
		).rejects.toThrow(/Grund/);

		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		const ergebnis = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			null
		);
		expect(ergebnis.zeilen).toBeGreaterThan(0);
	});

	/**
	 * **Zwei Papierparteien in einem Stapel.** Ohne diesen Fall misst nichts die
	 * Gleichheit in `allePapier`: «eine allein» und «Papier plus Nichtpapier»
	 * wären auch dann grün, wenn dort «wenigstens eine» stünde oder «genau eine».
	 */
	it('erlässt den Grund auch für einen Stapel aus zwei Papierparteien', async () => {
		const a = await aufbau('Prüflauf Papier 14', '2027-10-14');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[1], 'gescannt');

		const ergebnis = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'no' }
			],
			true,
			null
		);
		expect(ergebnis.zeilen).toBeGreaterThan(0);
	});

	/**
	 * **Ein gemischter Stapel bleibt begründungspflichtig.** Sonst hübe eine
	 * einzige Papierpartei die Pflicht für alle anderen mit auf — und genau die
	 * Stimmen, für die der Grund gedacht ist, kämen ohne ihn durch.
	 */
	it('verlangt den Grund weiter, sobald eine Partei ohne Vermerk im Stapel steht', async () => {
		const a = await aufbau('Prüflauf Papier 6', '2027-10-06');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		await expect(
			gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[
					{ parteiId: a.parteien[0], wahl: 'yes' },
					{ parteiId: a.parteien[1], wahl: 'no' }
				],
				true,
				null
			)
		).rejects.toThrow(/Grund/);
	});
});

describe('Am Telefon', () => {
	/**
	 * **Die Sperre gilt an jedem Traktandum, nicht nur an denen mit Ausstand.**
	 * Der erste Anlauf las den Vermerk erst unterhalb des frühen Ausstiegs «keine
	 * Ausstände, also keine Sperren» — und war damit an fast jedem Geschäft
	 * unsichtbar.
	 */
	/**
	 * **Das Paar zur Probe darüber, und ohne es misst keine von beiden genug.**
	 * Die Sperre darf den eigenen Weg treffen und den der Sitzungsleitung
	 * ausdrücklich NICHT. Der erste Anlauf traf beide: Der Vermerk hätte
	 * verhindert, wofür es ihn gibt.
	 */
	it('weist die Stimme am eigenen Gerät ab und lässt die Sitzungsleitung übertragen', async () => {
		const a = await aufbau('Prüflauf Papier 13', '2027-10-13');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		await expect(
			gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[{ parteiId: a.parteien[0], wahl: 'yes' }],
				false
			)
		).rejects.toThrow(/auf Papier/);

		const ergebnis = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[0], wahl: 'yes' }],
			true,
			null
		);
		expect(ergebnis.zeilen).toBeGreaterThan(0);
	});

	it('sperrt die Papierpartei am eigenen Gerät, auch ohne jeden Ausstand', async () => {
		const a = await aufbau('Prüflauf Papier 7', '2027-10-07');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		const sperren = await holeStimmsperren(betreiber, a.versammlung, a.traktandum);
		const meine = sperren.find((s) => s.parteiId === a.parteien[0]);
		expect(meine?.art).toBe('papier');
		// Die andere Partei stimmt weiter selbst.
		expect(sperren.find((s) => s.parteiId === a.parteien[1])).toBeUndefined();
	});
});

describe('Was die Sitzungsleitung sieht', () => {
	/**
	 * **Die Papierpartei fehlt weiterhin, bis ihr Zettel übertragen ist.**
	 *
	 * Das ist die teuerste der drei Fallen aus diesem Vorhaben, und sie kam aus
	 * dem Review: `holeFortschritt` rechnet Gesperrte heraus, weil ein
	 * Ausgetretener nie abstimmt. Wäre der Papiervermerk dort mitgelaufen,
	 * stünde auf dem Bildschirm «alle haben abgestimmt», während drei Zettel
	 * noch auf dem Tisch liegen — und die Sitzungsleitung schlösse die
	 * Abstimmung.
	 *
	 * Die Probe geht rot, sobald jemand den Vermerk wieder in
	 * `leseAusstandssperre` einbaut.
	 */
	it('zählt die Papierpartei weiter als offen, nicht als erledigt', async () => {
		const a = await aufbau('Prüflauf Papier 16', '2027-10-16');
		const durchgang = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		const f = await holeFortschritt(betreiber, a.versammlung, durchgang.id);
		expect(f.stimmberechtigt).toBe(2);
		expect(f.offeneNamen).toContain('Anna Muster');
	});

	/**
	 * **Und sie steht in der Erfassungsliste, mit Marke.** Sie herauszufiltern
	 * hiesse, den Vermerk gegen seinen Zweck zu wenden: Genau ihre Stimme trägt
	 * die Sitzungsleitung ein.
	 */
	it('führt die Papierpartei in der Erfassungsliste und markiert sie', async () => {
		const a = await aufbau('Prüflauf Papier 17', '2027-10-17');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		const stand = await holeErfassungsstand(betreiber, a.versammlung);
		const meine = stand.zeilen?.find((z) => z.parteiId === a.parteien[0]);
		expect(meine).toBeDefined();
		expect(meine?.aufPapier).toBe(true);
		expect(stand.zeilen?.find((z) => z.parteiId === a.parteien[1])?.aufPapier).toBe(false);
		// Und der Satz «Am Telefon ist hier nichts zu tun» steht NICHT auf diesem
		// Bildschirm: Er wäre an die Falschen gerichtet.
		expect(stand.sperren.join(' ')).not.toMatch(/auf Papier/);
	});
});

describe('Wenn beides zutrifft', () => {
	/**
	 * **Der Ausstand ist die stärkere Aussage und behält seinen Satz.**
	 *
	 * `papierSperren` setzt nur, was noch frei ist. Wäre es umgekehrt, stünde am
	 * Telefon «stimmt auf Papier ab, am Telefon ist nichts zu tun», obwohl der
	 * Grund ein ganz anderer ist: Diese Partei stimmt bei diesem Geschäft
	 * überhaupt nicht mit, auch nicht auf Papier. Und die Sitzungsleitung dürfte
	 * ihre Stimme dann auch nicht übertragen.
	 */
	it('lässt dem Ausstand den Vortritt vor dem Papiervermerk', async () => {
		const a = await aufbau('Prüflauf Papier 18', '2027-10-18');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[0],
			'Eigenes Geschäft mit der Gemeinschaft'
		);

		const sperren = await holeStimmsperren(betreiber, a.versammlung, a.traktandum);
		expect(sperren.find((s) => s.parteiId === a.parteien[0])?.art).toBe('selbst');

		// Und die Sitzungsleitung darf hier NICHT übertragen: Der Ausstand sperrt
		// beide Wege, anders als der Papiervermerk.
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			gibStimmenAb(
				handelnder(betreiber),
				a.versammlung,
				[{ parteiId: a.parteien[0], wahl: 'yes' }],
				true,
				null
			)
		).rejects.toThrow(/Ausstand/);
	});
});

describe('Das Siegel', () => {
	/**
	 * **Anders als die Pendenz ist der Vermerk Teil des Nachweises.** Wer ihn
	 * nachträglich setzen könnte, machte aus einer stellvertretend erfassten
	 * Stimme rückwirkend eine vereinbarte.
	 */
	it('lässt nach dem Versiegeln weder setzen noch aufheben', async () => {
		const a = await aufbau('Prüflauf Papier 8', '2027-10-08');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		await imKontext(betreiber, async (tx) => {
			await tx`UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${a.versammlung}`;
		});

		/*
		 * **Seit dem 10.09.2026 greift auch beim SETZEN die Zustandsschranke
		 * zuerst** und nennt deshalb einen anderen Satz — dieselbe Lage wie beim
		 * Aufheben seit dem 09.09.2026. Der Auslöser in der Datenbank bleibt und
		 * bleibt geprüft: Die beiden Zeilen ganz unten gehen am Anwendungsweg
		 * vorbei unmittelbar auf die Tabelle und müssen an ihm scheitern. Sonst
		 * hinge der Nachweis allein an einer Prüfung im Anwendungscode, und der
		 * Wächter in der Datenbank wäre unbemerkt weggefallen.
		 */
		await expect(
			vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[1], 'von_hand')
		).rejects.toThrow(/solange die Versammlung läuft/);

		await expect(
			hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0])
		).rejects.toThrow(/solange die Versammlung läuft/);

		// Der Auslöser selbst, in beide Richtungen: einfügen und löschen.
		await expect(
			imKontext(betreiber, async (tx) => {
				await tx`
					INSERT INTO paper_ballot (operator_id, meeting_id, snapshot_party_id, channel)
					SELECT ${betreiber}, ${a.versammlung}, s.id, 'von_hand'
					  FROM snapshot_party s
					 WHERE s.meeting_id = ${a.versammlung} AND s.party_id = ${a.parteien[1]}
				`;
			})
		).rejects.toThrow(/versiegelt/i);

		await expect(
			imKontext(betreiber, async (tx) => {
				await tx`DELETE FROM paper_ballot WHERE meeting_id = ${a.versammlung}`;
			})
		).rejects.toThrow(/versiegelt/i);
	});
});

describe('Aufheben', () => {
	it('nimmt den Vermerk zurück und meldet, ob es etwas gab', async () => {
		const a = await aufbau('Prüflauf Papier 9', '2027-10-09');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		expect(await hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0])).toBe(true);
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
		// Zweimal aufheben ist kein Fehler, aber auch keine Geschichte.
		expect(await hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0])).toBe(false);
	});

	/**
	 * **Der Eintrag über das Aufheben muss auffindbar bleiben**, obwohl die Zeile
	 * dann weg ist. Genau hier lief der Pendenz-Block im Review auf: `gehoertZu`
	 * löst den Gegenstand über seine Tabelle auf, und was gelöscht ist, findet
	 * keine Unterabfrage wieder. Deshalb hängt der Eintrag an `snapshot_party`.
	 *
	 * Die Probe geht rot, sobald jemand den Gegenstand auf die Vermerkskennung
	 * umstellt — und zwar nur diese, nicht die über das Setzen.
	 */
	it('lässt den Verlaufseintrag über das Aufheben im gefilterten Verlauf stehen', async () => {
		const a = await aufbau('Prüflauf Papier 10', '2027-10-10');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0]);

		const { zeilen } = await leseVerlauf(betreiber, { versammlung: a.versammlung });
		const arten = zeilen.map((z) => z.art);
		expect(arten).toContain('vote.paper.set');
		expect(arten).toContain('vote.paper.cleared');
	});
});

describe('Die Mandantengrenze', () => {
	it('zeigt einem fremden Betreiber nichts', async () => {
		const a = await aufbau('Prüflauf Papier 11', '2027-10-11');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		expect(await holePapierabgaben(betreiberB, a.versammlung)).toEqual([]);
	});

	it('lässt einen fremden Betreiber auch nichts setzen', async () => {
		const a = await aufbau('Prüflauf Papier 15', '2027-10-15');
		/*
		 * **Was hier wirklich greift** (aus dem Review, berichtigt): Es ist der
		 * Leseweg und keine eigene Prüfung auf dem Schreibweg. Jede Abfrage in
		 * `vermerkePapierabgabe` läuft unter RLS, und dem fremden Betreiber ist
		 * schon die Versammlung nicht sichtbar.
		 *
		 * **Die Absage kommt seit dem 10.09.2026 eine Zeile früher** und lautet
		 * deshalb anders. Vorher fiel der Aufruf über `snapshot_party` («nicht in
		 * der Liste der Stimmberechtigten»); seit die Schranke `fragtNachPapier`
		 * davor nachschlägt, fällt er über `meeting`. Beides ist RLS, beides
		 * schreibt nichts — und die neue Meldung sagt weniger über eine
		 * Versammlung aus, die den Fragenden nichts angeht.
		 */
		await expect(
			vermerkePapierabgabe(
				{ operatorId: betreiberB, userId: benutzer, label: 'Fremd' },
				a.versammlung,
				a.parteien[0],
				'von_hand'
			)
		).rejects.toThrow(/Versammlung nicht gefunden/);
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
	});

	/*
	 * Und die Zeile ist nicht bloss unsichtbar, sie liegt auch wirklich unter der
	 * Regel: Ein Zugriff im fremden Kontext findet sie nicht.
	 */
	/**
	 * **Der Entzug des UPDATE-Rechts wird gemessen** (aus dem Review). Migration
	 * 107 begründet ihn als Teil des Nachweises: Wer `channel` oder
	 * `recorded_by_label` überschreiben könnte, änderte, wie und von wem die
	 * Abmachung zustande kam, ohne dass eine Zeile im Verlauf entstünde. Fiele
	 * der REVOKE bei einem späteren Umbau weg, ginge ohne diese Probe nichts rot.
	 */
	it('lässt die Anwendung den Vermerk nicht ändern, nur setzen und löschen', async () => {
		const a = await aufbau('Prüflauf Papier 19', '2027-10-19');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await expect(
			alsBetreiber(betreiber, async (tx) => {
				await tx`UPDATE paper_ballot SET channel = 'gescannt' WHERE meeting_id = ${a.versammlung}`;
			})
		).rejects.toThrow(/permission denied/i);
	});

	it('verbirgt die Zeile auch am rohen Zugriff', async () => {
		const a = await aufbau('Prüflauf Papier 12', '2027-10-12');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		const fremd = await alsBetreiber(betreiberB, async (tx) => {
			return tx<{ id: string }[]>`SELECT id FROM paper_ballot WHERE meeting_id = ${a.versammlung}`;
		});
		expect(fremd).toEqual([]);
	});
});

/**
 * Der Schalter, ob der Einlass überhaupt fragt (Migration 108).
 *
 * Er entscheidet nichts über die Stimme, nur über einen Knopf am Eingang.
 * Genau deshalb steht hier die Probe, die zählt: dass sein Umlegen **keinen**
 * bestehenden Vermerk aufhebt. Ein Schalter, der rückwirkend löschte, änderte
 * den Nachweis, und niemand hätte es an ihm vermutet.
 */
describe('Die Frage am Einlass', () => {
	it('steht ab Werk auf «fragen»', async () => {
		const a = await aufbau('Prüflauf Papierfrage 1', '2027-10-20');
		const v = await holeVersammlung(betreiber, a.versammlung);
		expect(v?.papierfrage).toBe(true);
	});

	it('lässt sich abschalten und wieder einschalten', async () => {
		const a = await aufbau('Prüflauf Papierfrage 2', '2027-10-21');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);
		expect((await holeVersammlung(betreiber, a.versammlung))?.papierfrage).toBe(false);

		await setzePapierfrage(handelnder(betreiber), a.versammlung, true);
		expect((await holeVersammlung(betreiber, a.versammlung))?.papierfrage).toBe(true);
	});

	it('nimmt beim Abschalten keinen bestehenden Vermerk weg', async () => {
		const a = await aufbau('Prüflauf Papierfrage 3', '2027-10-22');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');

		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);

		const liste = await holePapierabgaben(betreiber, a.versammlung);
		expect(liste.map((p) => p.parteiId)).toEqual([a.parteien[0]]);
	});

	it('nimmt den Vermerk nach dem Schliessen nicht mehr zurück', async () => {
		/*
		 * Symmetrie zum Setzen: Das läuft nur über die Einlasshandlungen und
		 * damit nur bei laufender Versammlung. Ohne diese Schranke liesse sich
		 * ein Vermerk danach entfernen — und das behauptete rückwirkend, die
		 * Partei habe digital abgestimmt.
		 */
		const a = await aufbau('Prüflauf Papier zurück', '2027-10-25');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);

		await expect(
			hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0])
		).rejects.toThrow(/solange die Versammlung läuft/);

		const liste = await holePapierabgaben(betreiber, a.versammlung);
		expect(liste.map((p) => p.parteiId)).toEqual([a.parteien[0]]);
	});

	it('lässt sich nach dem Schliessen nicht mehr umlegen', async () => {
		/*
		 * Auf `meeting` liegt kein Siegelauslöser; die Schranke sitzt deshalb in
		 * `setzePapierfrage`. Ohne sie entstünde an einer versiegelten
		 * Versammlung ein Verlaufseintrag über eine Handlung, die es dort nicht
		 * geben darf.
		 */
		const a = await aufbau('Prüflauf Papierfrage 5', '2027-10-24');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await expect(
			setzePapierfrage(handelnder(betreiber), a.versammlung, false)
		).rejects.toThrow(/nur einstellen/);
	});

	/*
	 * **Die Schranke am Schreibweg** (10.09.2026).
	 *
	 * Bis dahin war der Schalter eine reine Anzeigeentscheidung: Die Masken
	 * stellten die Frage nur bei `fragtNachPapier`, der Schreibweg glaubte aber
	 * jedem Formular. Wer die Frage abgeschaltet hatte, bekam den Vermerk
	 * trotzdem gesetzt — und ein gesetzter Vermerk sperrt das Telefon der Partei.
	 *
	 * Aufgefallen beim Anschluss des gemeinsamen Abends: Dort steht eine Liste
	 * über mehrere Häuser, und jedes hat seinen eigenen Schalter.
	 */
	it('lässt bei abgeschalteter Frage keinen Vermerk mehr entstehen', async () => {
		const a = await aufbau('Prüflauf Papierfrage aus', '2027-10-26');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);

		await expect(
			vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand')
		).rejects.toThrow(/abgeschaltet/);

		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
	});

	it('lässt in der Betriebsart «einfach» keinen Vermerk entstehen', async () => {
		/*
		 * Dort erfasst die Sitzungsleitung ohnehin alle Stimmen. Der Vermerk
		 * hätte nichts zu sperren und behauptete im Verlauf einen Entscheid, den
		 * niemand zu treffen hatte.
		 */
		const a = await aufbau('Prüflauf Papier einfach', '2027-10-27', 'einfach');

		await expect(
			vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand')
		).rejects.toThrow(/einfach/);

		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
	});

	it('nimmt einen bestehenden Vermerk auch nach dem Abschalten noch zurück', async () => {
		/*
		 * **Die Gegenrichtung bleibt offen, und das ist Absicht.** Wird der
		 * Schalter nach dem Einlass umgelegt, muss die Korrektur seiner eigenen
		 * Folgen möglich bleiben — sonst sperrte ein abgeschalteter Schalter die
		 * Partei für den Rest der Versammlung ein.
		 */
		const a = await aufbau('Prüflauf Papier aus danach', '2027-10-28');
		await vermerkePapierabgabe(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);

		expect(await hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0])).toBe(
			true
		);
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
	});

	it('schreibt das Umlegen in den Verlauf', async () => {
		const a = await aufbau('Prüflauf Papierfrage 4', '2027-10-23');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);

		const zeilen = await alsBetreiber(betreiber, (tx) => tx<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			 WHERE subject_type = 'meeting' AND subject_id = ${a.versammlung}
			   AND event_type = 'meeting.paper.question.set'
		`);
		expect(zeilen).toHaveLength(1);
	});
});

/**
 * Was das Formular am Eingang gesagt hat — und was es verschwiegen hat.
 *
 * **Der Anlass, am 10.09.2026.** Ein fehlendes Feld `papier` hiess bis dahin
 * dreierlei zugleich: Die Frage ist abgeschaltet, jemand hat «digital»
 * geantwortet, oder die Maske hat gar nicht gefragt. Die ersten beiden sind
 * harmlos, der dritte ist ein Fehler — und er sah aus wie die beiden anderen.
 * Die Zeile «Von Hand erfassen» in der Anwesenheitsliste war so lange stumm,
 * ohne dass ein Test etwas zu melden hatte.
 *
 * Geprüft wird deshalb nicht nur, was bei einer Antwort geschieht, sondern
 * ausdrücklich auch, was bei keiner geschieht.
 */
describe('Die Antwort aus dem Formular', () => {
	function alsLeitung(operatorId: string) {
		return {
			benutzer: { operatorId, id: benutzer, displayName: 'Prüflauf' }
		} as unknown as App.Locals;
	}

	function formular(eintraege: [string, string][]): FormData {
		const daten = new FormData();
		for (const [name, wert] of eintraege) daten.append(name, wert);
		return daten;
	}

	it('«ja» setzt den Vermerk und sagt es', async () => {
		const a = await aufbau('Prüflauf Antwort ja', '2027-11-01');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([['papier', 'ja']])
		);
		expect(p.papier).not.toBeNull();
		expect(p.grund).toBeNull();
		expect(p.satz).toContain('von Hand');
		expect(await holePapierabgaben(betreiber, a.versammlung)).toHaveLength(1);
	});

	it('«nein» heisst gefragt und verneint: kein Vermerk, kein Wort', async () => {
		const a = await aufbau('Prüflauf Antwort nein', '2027-11-02');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([['papier', 'nein']])
		);
		expect(p).toEqual({ satz: '', papier: null, grund: null });
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
	});

	it('«nachher» heisst: dieses Formular fragt danach', async () => {
		const a = await aufbau('Prüflauf Antwort nachher', '2027-11-03');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([['papier', 'nachher']])
		);
		expect(p).toEqual({ satz: '', papier: null, grund: null });
	});

	/*
	 * **Das Häkchenformular schickt beide Werte.** Das versteckte `nein` sagt
	 * «hier wurde gefragt», das angekreuzte `ja` ist die Antwort. Gelesen wird
	 * über `getAll`; mit `get` hinge das Ergebnis an der Reihenfolge im
	 * Quelltext, und ein angekreuztes Kästchen fiele unter den Tisch, sobald
	 * jemand die beiden Zeilen vertauscht.
	 */
	it('ein angekreuztes «ja» gewinnt gegen das versteckte «nein»', async () => {
		const a = await aufbau('Prüflauf Antwort beides', '2027-11-04');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([
				['papier', 'nein'],
				['papier', 'ja']
			])
		);
		expect(p.papier).not.toBeNull();
		expect(await holePapierabgaben(betreiber, a.versammlung)).toHaveLength(1);
	});

	it('und auch dann, wenn das versteckte Feld hinten steht', async () => {
		const a = await aufbau('Prüflauf Antwort beides umgekehrt', '2027-11-05');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([
				['papier', 'ja'],
				['papier', 'nein']
			])
		);
		expect(p.papier).not.toBeNull();
	});

	it('gar keine Antwort ist bei abgeschalteter Frage still', async () => {
		const a = await aufbau('Prüflauf Antwort fehlt, Frage aus', '2027-11-06');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([])
		);
		expect(p).toEqual({ satz: '', papier: null, grund: null });
	});

	it('gar keine Antwort bei laufender Frage wird gemeldet', async () => {
		const a = await aufbau('Prüflauf Antwort fehlt, Frage an', '2027-11-07');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([])
		);
		expect(p.papier).toBeNull();
		expect(p.grund).toBe('Es wurde nicht gefragt, ob diese Partei von Hand abstimmt.');
		expect(p.satz).toContain('Nachtragsliste');
		// Und es bleibt bei der Meldung: Der Eintritt selbst ist davon unberührt.
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
		/*
		 * **Und genau deshalb steht die Partei danach in der Nachtragsliste**
		 * (Migration 109): Ohne Antwortzeile ist sie eine der Ungefragten, und die
		 * Meldung ist nicht mehr das Einzige, was den Fall auffängt.
		 */
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	/*
	 * **In `einfach` gibt es die Frage nicht**, und deshalb auch keine Lücke.
	 * Ohne diese Probe wäre der neue Zweig eine Meldung, die jede Versammlung
	 * ohne geführte Betriebsart bei jedem Einlass bekäme.
	 */
	it('meldet in der Betriebsart «einfach» nichts', async () => {
		const a = await aufbau('Prüflauf Antwort fehlt, einfach', '2027-11-08', 'einfach');
		const p = await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([])
		);
		expect(p).toEqual({ satz: '', papier: null, grund: null });
	});
});

/**
 * Die Nachtragsliste: wer anwesend ist, ohne je gefragt worden zu sein
 * (Migration 109).
 *
 * **Der Anlass** (Auftraggeber, 10.09.2026): Wer die Frage mitten im Einlass
 * einschaltet, hat ein Loch — alle davor kamen ungefragt herein. Gespeichert
 * wird die **Frage** und nicht die Antwort; die Antwort steht in `paper_ballot`.
 * Geprüft wird hier, dass die Zeile bei jeder Antwort entsteht, bei keiner
 * ausbleibt, und dass sie eine zurückgenommene Antwort überlebt.
 */
describe('Wer gefragt wurde', () => {
	function alsLeitung(operatorId: string) {
		return {
			benutzer: { operatorId, id: benutzer, displayName: 'Prüflauf' }
		} as unknown as App.Locals;
	}

	function formular(eintraege: [string, string][]): FormData {
		const daten = new FormData();
		for (const [name, wert] of eintraege) daten.append(name, wert);
		return daten;
	}

	async function antworte(
		operatorId: string,
		a: Awaited<ReturnType<typeof aufbau>>,
		i: number,
		wert: string | null
	) {
		return papiervermerkAusFormular(
			alsLeitung(operatorId),
			a.versammlung,
			a.parteien[i],
			formular(wert === null ? [] : [['papier', wert]])
		);
	}

	/*
	 * **`nachher` steht hier nicht dabei**, es hat zwei eigene Proben weiter
	 * unten: Es zählt nur, wenn der Kasten danach wirklich fragt, und genau diese
	 * Bedingung wäre in einer Schleife über alle drei Werte unsichtbar.
	 */
	for (const [i, wert] of ['ja', 'nein'].entries()) {
		it(`«${wert}» hält fest, dass gefragt wurde`, async () => {
			const a = await aufbau(`Prüflauf gefragt ${wert}`, `2027-12-0${i + 1}`);
			await antworte(betreiber, a, 0, wert);
			expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([a.parteien[0]]);
		});
	}

	it('ohne Antwort entsteht keine Zeile — das ist der ganze Zweck', async () => {
		const a = await aufbau('Prüflauf gefragt gar nicht', '2027-12-04');
		await antworte(betreiber, a, 0, null);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	/*
	 * **Bei abgeschalteter Frage wird nichts festgehalten.** Sonst behauptete die
	 * Zeile einen Vorgang, den es nicht gab — und die Nachtragsliste wäre nach
	 * dem Einschalten leer, obwohl niemand gefragt worden ist. Genau der Fall,
	 * für den sie gebaut wurde.
	 */
	it('bei abgeschalteter Frage entsteht keine Zeile', async () => {
		const a = await aufbau('Prüflauf gefragt, Frage aus', '2027-12-05');
		await setzePapierfrage(handelnder(betreiber), a.versammlung, false);
		await antworte(betreiber, a, 0, 'nein');
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	/*
	 * **Die zurückgenommene Antwort bleibt eine Antwort.** Der Vermerk ist weg,
	 * gefragt wurde trotzdem. Stünde die Partei danach wieder in der
	 * Nachtragsliste, führte jede Rücknahme zurück in die Liste — und die Liste
	 * wäre keine Aussage über das Fragen mehr, sondern eine über den Vermerk.
	 */
	it('überlebt die Rücknahme des Vermerks', async () => {
		const a = await aufbau('Prüflauf gefragt, dann zurück', '2027-12-06');
		await antworte(betreiber, a, 0, 'ja');
		expect(await holePapierabgaben(betreiber, a.versammlung)).toHaveLength(1);

		await hebePapierabgabeAuf(handelnder(betreiber), a.versammlung, a.parteien[0]);

		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([a.parteien[0]]);
	});

	/*
	 * **«nachher» zählt nur, wenn der Kasten wirklich fragt** (Code-Review
	 * 10.09.2026). Der Kartenscanner am Abend schickt es an JEDEM Scan mit, auch
	 * am zweiten derselben Karte — und der zeigt keinen Kasten mehr, weil kein
	 * neuer Eintritt entstand. Ohne die Bedingung hätte ein zweiter Scan eine
	 * Partei still und unwiderruflich aus der Nachtragsliste genommen.
	 */
	it('«nachher» hält nichts fest, wenn kein Kasten mehr kommt', async () => {
		const a = await aufbau('Prüflauf nachher ohne Kasten', '2027-12-11');
		await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([['papier', 'nachher']]),
			undefined,
			false
		);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	it('und hält fest, sobald er kommt', async () => {
		const a = await aufbau('Prüflauf nachher mit Kasten', '2027-12-12');
		await papiervermerkAusFormular(
			alsLeitung(betreiber),
			a.versammlung,
			a.parteien[0],
			formular([['papier', 'nachher']]),
			undefined,
			true
		);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([a.parteien[0]]);
	});

	/*
	 * **Erst der Vermerk, dann die Antwortzeile** (Code-Review 10.09.2026). Die
	 * Zeile lässt sich nicht löschen; stünde sie zuerst, nähme eine gescheiterte
	 * Vermerkung die Partei aus der Nachtragsliste, ohne dass ein Vermerk
	 * entstanden wäre — und zurück führte kein Weg.
	 */
	it('hält nichts fest, wenn der Vermerk scheitert', async () => {
		const a = await aufbau('Prüflauf ja, aber geschlossen', '2027-12-13');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);

		const p = await antworte(betreiber, a, 0, 'ja');

		expect(p.grund).toMatch(/solange die Versammlung läuft/);
		expect(await holePapierabgaben(betreiber, a.versammlung)).toEqual([]);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	/*
	 * **Zweimal fragen legt keine zweite Zeile an**, und die erste behält ihren
	 * Urheber. Am Eingang wird dieselbe Karte gescannt, weil die Liste eben
	 * nachgeladen hat.
	 */
	it('zweimal fragen bleibt eine Zeile', async () => {
		const a = await aufbau('Prüflauf gefragt doppelt', '2027-12-07');
		await antworte(betreiber, a, 0, 'nein');
		await antworte(betreiber, a, 0, 'nein');
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([a.parteien[0]]);
	});

	/*
	 * **Die Zeile lässt sich nicht löschen** (kein DELETE für die
	 * Anwendungsrolle). Wer sie löschen könnte, brächte eine Partei zurück in die
	 * Nachtragsliste, die längst geantwortet hat.
	 */
	it('lässt sich von der Anwendung nicht löschen', async () => {
		const a = await aufbau('Prüflauf gefragt, löschen', '2027-12-08');
		await antworte(betreiber, a, 0, 'nein');
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM paper_question_answered`)
		).rejects.toThrow(/permission denied|verweigert/i);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([a.parteien[0]]);
	});

	/*
	 * **Zwei Schranken, und die erste fehlte** (Sicherheitsdurchgang 10.09.2026).
	 *
	 * Der erste Anlauf verliess sich allein auf den Siegelauslöser der Datenbank.
	 * Der prüft `state = 'versiegelt'` und sonst nichts — zwischen «geschlossen»
	 * und «versiegelt» stand das Schreiben offen. Weil die Zeile sich nicht
	 * löschen lässt, wäre so nachträglich der Anschein herzustellen gewesen, der
	 * Eingang habe gefragt. Genau die Behauptung, gegen die die Tabelle gebaut
	 * ist.
	 *
	 * Geprüft wird deshalb beides: die Schranke im Schreibweg am geschlossenen
	 * Zustand, und der Auslöser der Datenbank am versiegelten. Der zweite Weg geht
	 * am Anwendungscode vorbei und muss dort scheitern, sonst hinge der Nachweis
	 * allein an einer Prüfung, die jemand entfernen kann.
	 */
	it('lässt sich nach dem Schliessen nicht mehr anlegen', async () => {
		const a = await aufbau('Prüflauf gefragt, geschlossen', '2027-12-14');
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		await expect(
			vermerkeFrageBeantwortet(handelnder(betreiber), a.versammlung, a.parteien[0], 'nachtrag')
		).rejects.toThrow(/solange die Versammlung läuft/);
		expect(await holeBeantwortete(betreiber, a.versammlung)).toEqual([]);
	});

	it('und der Auslöser der Datenbank hält es auch am Anwendungscode vorbei auf', async () => {
		const a = await aufbau('Prüflauf gefragt, versiegelt', '2027-12-09');
		await imKontext(betreiber, async (tx) => {
			await tx`UPDATE meeting SET state = 'versiegelt', closed_at = now() WHERE id = ${a.versammlung}`;
		});
		await expect(
			imKontext(betreiber, async (tx) => {
				const [p] = await tx<{ id: string }[]>`
					SELECT id FROM snapshot_party
					 WHERE party_id = ${a.parteien[0]} AND meeting_id = ${a.versammlung}
				`;
				await tx`
					INSERT INTO paper_question_answered (operator_id, meeting_id, snapshot_party_id,
					                                     channel, recorded_by_label)
					VALUES (${betreiber}, ${a.versammlung}, ${p.id}, 'nachtrag', 'Prüflauf')
				`;
			})
		).rejects.toThrow(/versiegelt/i);
	});

	/*
	 * **Die Regel selbst steht in der Domäne**, hier geht es um das Zusammenspiel:
	 * Wer anwesend ist und keine Antwortzeile hat, gehört auf die Liste.
	 */
	it('die Liste nennt genau die Anwesenden ohne Antwort', async () => {
		const a = await aufbau('Prüflauf Nachtragsliste', '2027-12-10');
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0]);
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await antworte(betreiber, a, 0, 'nein');

		const u = await holeUebersicht(betreiber, a.versammlung);
		const offen = nichtGefragte(
			u?.staende ?? [],
			await holeBeantwortete(betreiber, a.versammlung),
			(await holePapierabgaben(betreiber, a.versammlung)).map((x) => x.parteiId)
		);
		expect(offen.map((o) => o.parteiId)).toEqual([a.parteien[1]]);
	});
});
