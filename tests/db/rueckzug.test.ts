/**
 * Einen Antrag zurückziehen (Welle 3, FR-45).
 *
 * **Der Satz, um den es geht: zurückgezogen ist nicht abgelehnt.** Es gab keine
 * Abstimmung und damit keine Mehrheit dagegen. Wer das im Protokoll
 * zusammenwirft, behauptet eine Mehrheit, die nie gezählt wurde — und hält den
 * Antragsteller womöglich davon ab, dieselbe Sache im nächsten Jahr erneut
 * vorzubringen.
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
import {
	erstelleTraktandum,
	nimmTraktandumAuf,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmRueckzugZurueck,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import {
	brecheAbstimmungAb,
	gibStimmenAb,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { erzeugeProtokollentwurf } from '$lib/server/protokoll';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
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
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

/**
 * Eine Gemeinschaft mit zwei Anträgen und einer Kenntnisnahme, im Zustand
 * `entwurf`: angelegt, aber weder freigegeben noch eröffnet.
 */
async function anlagen(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Aebi',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const antrag = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	const zweiter = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Spielplatz',
		art: 'abstimmung',
		antragswortlaut: 'Der Spielplatz wird erneuert.',
		antragstellerart: 'bewirtschaftung'
	});
	const kenntnis = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Jahresbericht',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung'
	});
	for (const t of [antrag.id, zweiter.id]) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t, ERFORDERNIS);
	}

	return { versammlung: v.id, antrag: antrag.id, zweiter: zweiter.id, kenntnis: kenntnis.id, partei: p.id };
}

/** Eine laufende Versammlung mit zwei Anträgen und einer Kenntnisnahme. */
async function laufend(name: string, datum: string) {
	const s = await anlagen(name, datum);
	await gibVersammlungFrei(handelnder(betreiber), s.versammlung);
	await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
	await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, s.partei, 'von_hand');
	return s;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Rückzug');
	benutzer = await pruefbenutzer(betreiber, 'rueckzugsleitung');
});

afterAll(verbindungenSchliessen);

describe('Der Rückzug', () => {
	it('hält Zeitpunkt, Person und Grund fest — und lässt das Traktandum stehen', async () => {
		// **Kein Löschen.** Ein verschwundener Antrag liesse die versandte
		// Traktandenliste und das Protokoll auseinanderlaufen, und niemand könnte
		// erklären, wohin Nummer 1 gekommen ist.
		const s = await laufend('Rückzugsweg 1', '2027-06-01');
		const t = await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Offerte liegt nicht vor');

		expect(t.rueckzug?.grund).toBe('Offerte liegt nicht vor');
		expect(t.rueckzug?.durch).toBe('Prüflauf');
		expect(t.rueckzug?.am).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		const alle = await holeTraktanden(betreiber, s.versammlung);
		expect(alle.map((x) => x.knoten.id)).toContain(s.antrag);
	});

	it('verlangt einen Grund', async () => {
		// «Zurückgezogen» ohne Grund lässt jeden Leser des Protokolls rätseln.
		const s = await laufend('Rückzugsweg 2', '2027-06-02');
		await expect(ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, '')).rejects.toThrow(
			FachlicherFehler
		);
		await expect(ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'x')).rejects.toThrow(/Grund/i);
	});

	it('gibt es für eine Kenntnisnahme nicht', async () => {
		// Es gibt keinen Antrag, den man zurücknehmen könnte.
		const s = await laufend('Rückzugsweg 3', '2027-06-03');
		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.kenntnis, 'Passt nicht mehr')
		).rejects.toThrow(/Kenntnisnahme/i);
	});

	it('geschieht nur einmal', async () => {
		const s = await laufend('Rückzugsweg 4', '2027-06-04');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Erster Grund');
		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Zweiter Grund')
		).rejects.toThrow(/bereits zurückgezogen/i);
	});
});

describe('Ein Folgeantrag am Grundantrag', () => {
	/**
	 * **Der offene Punkt der Bedienbarkeitsprüfung vom 05.09.2026.** Ein
	 * Grundantrag liess sich zurückziehen, während ein Änderungsantrag daran
	 * hing. Danach stand im Saal ein Antrag zu einem Antrag, den es nicht mehr
	 * gibt — die Versammlung hätte über eine Änderung an nichts abgestimmt.
	 */
	it('verhindert den Rückzug des Grundantrags', async () => {
		const s = await laufend('Rückzug 20', '2027-06-20');
		await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: s.versammlung,
				titel: 'Nur die Nordfassade',
				art: 'abstimmung',
				antragswortlaut: 'Saniert wird nur die Nordfassade.',
				antragstellerart: 'bewirtschaftung',
				parentId: s.antrag
			},
			'folgeantrag'
		);

		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Doch nicht nötig.')
		).rejects.toThrow(/hängt noch ein Folgeantrag/);
	});

	/**
	 * **Und lässt ihn zu, sobald der Folgeantrag erledigt ist.** Sonst wäre die
	 * Absage eine Sackgasse: Die Meldung nennt zwei Wege heraus, und mindestens
	 * einer davon muss auch wirklich gehen.
	 */
	it('lässt den Rückzug zu, wenn der Folgeantrag selbst zurückgezogen ist', async () => {
		const s = await laufend('Rückzug 21', '2027-06-21');
		const folge = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: s.versammlung,
				titel: 'Nur die Nordfassade',
				art: 'abstimmung',
				antragswortlaut: 'Saniert wird nur die Nordfassade.',
				antragstellerart: 'bewirtschaftung',
				parentId: s.antrag
			},
			'folgeantrag'
		);
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, folge.id, 'Erledigt sich.');

		const zurueck = await ziehAntragZurueck(
			handelnder(betreiber),
			s.versammlung,
			s.antrag,
			'Doch nicht nötig.'
		);
		expect(zurueck.rueckzug?.grund).toBe('Doch nicht nötig.');
	});

	/**
	 * **Eine Kenntnisnahme darunter sperrt nicht** (Code-Review 08.09.2026).
	 * Sie lässt sich weder abstimmen noch zurückziehen; als Hindernis gezählt
	 * wäre der Grundantrag dauerhaft gefangen, und die Absage nennte zwei
	 * Auswege, die es für sie beide nicht gibt.
	 */
	it('stört nicht, wenn das Kind eine Kenntnisnahme ist', async () => {
		const s = await laufend('Rückzug 23', '2027-06-23');
		await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: s.versammlung,
				titel: 'Zwischenbericht der Verwaltung',
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung',
				parentId: s.antrag
			},
			'folgeantrag'
		);

		const zurueck = await ziehAntragZurueck(
			handelnder(betreiber),
			s.versammlung,
			s.antrag,
			'Doch nicht nötig.'
		);
		expect(zurueck.rueckzug).not.toBeNull();
	});

	/** Ein Folgeantrag an einem ANDEREN Antrag steht dem Rückzug nicht im Weg. */
	it('stört nicht, wenn er an einem anderen Antrag hängt', async () => {
		const s = await laufend('Rückzug 22', '2027-06-22');
		await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: s.versammlung,
				titel: 'Kleinerer Spielplatz',
				art: 'abstimmung',
				antragswortlaut: 'Der Spielplatz wird kleiner erneuert.',
				antragstellerart: 'bewirtschaftung',
				parentId: s.zweiter
			},
			'folgeantrag'
		);

		const zurueck = await ziehAntragZurueck(
			handelnder(betreiber),
			s.versammlung,
			s.antrag,
			'Doch nicht nötig.'
		);
		expect(zurueck.rueckzug).not.toBeNull();
	});
});

describe('Die Grenze zur Abstimmung', () => {
	it('lässt über einen zurückgezogenen Antrag nicht abstimmen', async () => {
		const s = await laufend('Rückzugsweg 5', '2027-06-05');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Zurückgestellt');

		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.antrag);
		await expect(
			oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.antrag)
		).rejects.toThrow(/zurückgezogen/i);

		// Und auch nicht an der Anwendung vorbei: Die Datenbank weist es ab.
		await expect(
			imKontext(betreiber, (tx) => tx`
				INSERT INTO voting_round (operator_id, meeting_id, agenda_item_id, ordinal)
				VALUES (${betreiber}, ${s.versammlung}, ${s.antrag}, 9)
			`)
		).rejects.toThrow(/zurückgezogen/i);
	});

	it('lässt einen beschlossenen Antrag nicht mehr zurückziehen', async () => {
		// Ist einmal abgestimmt, gehört das Ergebnis der Versammlung. Ein
		// nachträglicher Rückzug nähme ihr einen Beschluss weg — ohne Abstimmung
		// darüber.
		const s = await laufend('Rückzugsweg 6', '2027-06-06');
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.antrag);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.antrag);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.partei, wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Doch nicht')
		).rejects.toThrow(/bereits abgestimmt/i);

		// Auch mit vollen Rechten nicht: Der Auslöser fängt den Weg an der
		// Anwendung vorbei.
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE agenda_item
				   SET withdrawn_at = now(), withdrawn_by_label = 'Wartung', withdrawn_reason = 'egal'
				 WHERE id = ${s.antrag}
			`)
		).rejects.toThrow(/bereits abgestimmt|Rückkommensantrag/i);
	});
});

describe('Der Rückzug ausserhalb der Sitzung', () => {
	/**
	 * Entscheid 0027: Ein Rückzug geht nur im Zustand `laufend`. Der Test hält
	 * die Schranke für Entwurf, Freigabe und Schluss fest (versiegelt folgt auf
	 * den Schluss und ist nicht eigens geprüft); fällt sie einmal, wird er
	 * rot und die Frage kommt zurück.
	 */
	const unveraendert = async (versammlung: string, antrag: string) => {
		const alle = await holeTraktanden(betreiber, versammlung);
		const knoten = alle.find((x) => x.knoten.id === antrag)!.knoten;
		expect(knoten.rueckzug).toBeFalsy();
	};

	it('wird im Entwurf abgewiesen und lässt das Traktandum unverändert', async () => {
		const s = await anlagen('Rückzugsweg 8', '2027-06-08');
		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Passt nicht mehr')
		).rejects.toThrow(/im Zustand «Entwurf»[\s\S]*im Zustand «laufend»/);
		await unveraendert(s.versammlung, s.antrag);
	});

	it('wird nach der Freigabe abgewiesen und lässt das Traktandum unverändert', async () => {
		const s = await anlagen('Rückzugsweg 9', '2027-06-09');
		await gibVersammlungFrei(handelnder(betreiber), s.versammlung);
		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Passt nicht mehr')
		).rejects.toThrow(/im Zustand «freigegeben»[\s\S]*im Zustand «laufend»/);
		await unveraendert(s.versammlung, s.antrag);
	});

	it('wird nach dem Schluss abgewiesen und lässt das Traktandum unverändert', async () => {
		const s = await laufend('Rückzugsweg 10', '2027-06-10');
		await schliesseVersammlung(handelnder(betreiber), s.versammlung);
		await expect(
			ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Passt nicht mehr')
		).rejects.toThrow(/im Zustand «geschlossen»[\s\S]*im Zustand «laufend»/);
		await unveraendert(s.versammlung, s.antrag);
	});
});

describe('Im Protokoll', () => {
	it('steht «zurückgezogen» — nicht «abgelehnt»', async () => {
		const s = await laufend('Rückzugsweg 7', '2027-06-07');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Offerte fehlt');

		// Der zweite Antrag wird abgelehnt — damit im selben Protokoll beides
		// nebeneinander steht und sich nicht verwechseln lässt.
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.zweiter);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.zweiter);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.partei, wahl: 'no' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
 );
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		const entwurf = await erzeugeProtokollentwurf(
			handelnder(betreiber),
			s.versammlung,
			'2027-06-07 21:00:00'
		);

		expect(entwurf.body).toMatch(/zurückgezogen: Offerte fehlt/i);
		expect(entwurf.body).toMatch(/ein Beschluss ist nicht gefasst worden/i);
		// Der abgelehnte Antrag steht daneben und heisst anders.
		expect(entwurf.body).toMatch(/Abgelehnt/);

		// Und der zurückgezogene taucht nirgends als abgelehnt auf: Zwischen
		// seinem Titel und dem nächsten Traktandum steht kein Ergebnissatz.
		const abschnitt = entwurf.body.slice(
			entwurf.body.indexOf('Fassadensanierung'),
			entwurf.body.indexOf('Spielplatz')
		);
		expect(abschnitt).not.toMatch(/Abgelehnt|Angenommen/);
	});

	it('sagt nach der Rücknahme «nicht abgestimmt», wenn danach keiner kam (F2, H7 D (d))', async () => {
		const s = await laufend('Rückzugsweg 8', '2027-06-08');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Offerte fehlt');
		await nimmRueckzugZurueck(handelnder(betreiber), s.versammlung, s.antrag);

		const entwurf = await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-06-08 21:00:00');
		expect(entwurf.body).toContain('der Rückzug wurde zurückgenommen. Danach wurde über ihn nicht abgestimmt.');
		expect(entwurf.body).not.toContain('und es wurde darüber abgestimmt');
	});

	it('zählt einen danach abgebrochenen Durchgang nicht als Abstimmung (F2, Codeprüfung Befund 5)', async () => {
		const s = await laufend('Rückzugsweg 10', '2027-06-10');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Offerte fehlt');
		await nimmRueckzugZurueck(handelnder(betreiber), s.versammlung, s.antrag);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.antrag);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.antrag);
		await brecheAbstimmungAb(handelnder(betreiber), s.versammlung, 'Prüflauf: falsche Grundlage.');

		const entwurf = await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-06-10 21:00:00');
		expect(entwurf.body).toContain('der Rückzug wurde zurückgenommen. Danach wurde über ihn nicht abgestimmt.');
	});

	it('sagt nach der Rücknahme «abgestimmt», wenn danach abgestimmt wurde (F2, H7 D (d))', async () => {
		// Eine eigene Versammlung: Ein zweiter Entwurf derselben weist der Server ab.
		const s = await laufend('Rückzugsweg 9', '2027-06-09');
		await ziehAntragZurueck(handelnder(betreiber), s.versammlung, s.antrag, 'Offerte fehlt');
		await nimmRueckzugZurueck(handelnder(betreiber), s.versammlung, s.antrag);
		await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.antrag);
		await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.antrag);
		await gibStimmenAb(
			handelnder(betreiber),
			s.versammlung,
			[{ parteiId: s.partei, wahl: 'yes' }],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(betreiber), s.versammlung);

		const entwurf = await erzeugeProtokollentwurf(handelnder(betreiber), s.versammlung, '2027-06-09 21:00:00');
		expect(entwurf.body).toContain('der Rückzug wurde zurückgenommen, und es wurde darüber abgestimmt.');
		expect(entwurf.body).not.toContain('Danach wurde über ihn nicht abgestimmt');
	});
});
