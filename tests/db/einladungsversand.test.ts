/**
 * Der Mailversand von Einladungen (PRD §13, «Mailversand»).
 *
 * **Geprüft wird alles ausser der Leitung.** Der SMTP-Dialog gehört
 * `nodemailer`; was hier zählt, ist der Weg davor: Entsteht das Versandpaket
 * genau **einmal**, findet jede Nachricht ihren **eigenen** Anhang, und steht
 * danach je Empfänger ein Eintrag im Verlauf?
 *
 * Der Mailausgang zeigt dabei auf einen Port, an dem nichts lauscht. Das ist
 * Absicht: Der Versand scheitert damit an der Verbindung — und **nicht** am
 * Anhang. Genau diese Unterscheidung beweist, dass jede Karte gefunden wurde.
 * Ein Test gegen einen echten Mailserver prüfte zusätzlich nur, was ohnehin
 * nicht unser Code ist.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { verschickeEinladungen } from '$lib/server/einladungsversand';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { env } from './env-ersatz';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Ein Mailausgang, an dem nichts lauscht — der Versand scheitert am Netz. */
function totenMailausgang() {
	env.VERSAMMLUNG_SMTP_HOST = '127.0.0.1';
	// Port 1: Die Verbindung wird sofort abgelehnt, der Test wartet nicht.
	env.VERSAMMLUNG_SMTP_PORT = '1';
	env.VERSAMMLUNG_SMTP_ABSENDER = 'versammlung@example.ch';
	env.VERSAMMLUNG_SMTP_ABSENDERNAME = 'Prüflauf';
}

function ohneMailausgang() {
	delete env.VERSAMMLUNG_SMTP_HOST;
	delete env.VERSAMMLUNG_SMTP_PORT;
	delete env.VERSAMMLUNG_SMTP_ABSENDER;
	delete env.VERSAMMLUNG_SMTP_ABSENDERNAME;
}

/** Eine freigegebene Versammlung mit drei Parteien, zwei davon mit Adresse. */
async function vorbereitet(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const leute: { name: string; adresse: string | null }[] = [
		{ name: 'Aebi', adresse: 'aebi@example.ch' },
		{ name: 'Bucher', adresse: 'bucher@example.ch' },
		{ name: 'Christen', adresse: null }
	];
	const parteien: string[] = [];
	for (const [i, wer] of leute.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 300 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer.name,
			isCommunity: false,
			representativeName: null
		});
		if (wer.adresse) {
			await admin`UPDATE party SET email = ${wer.adresse} WHERE id = ${p.id}`;
		}
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
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Einladungsversand');
	benutzer = await pruefbenutzer(betreiber, 'versandleitung');
});

afterEach(ohneMailausgang);
afterAll(verbindungenSchliessen);

describe('Ohne eingerichteten Mailausgang', () => {
	it('wird gar nicht erst verschickt', async () => {
		// Der Versand ist eine Option. Ohne sie bleibt alles, wie es war.
		const s = await vorbereitet('Versand 1', '2027-04-01');
		await expect(
			verschickeEinladungen(
				handelnder(betreiber),
				s.versammlung,
				'http://pruef',
				undefined,
				'2027-03-01 10:00:00'
			)
		).rejects.toThrow(/kein Mailausgang eingerichtet/);
	});
});

describe('Mit eingerichtetem Mailausgang', () => {
	it('macht je Empfänger mit Adresse eine Nachricht — und nennt die ohne', async () => {
		totenMailausgang();
		const s = await vorbereitet('Versand 2', '2027-04-02');

		const bericht = await verschickeEinladungen(
			handelnder(betreiber),
			s.versammlung,
			'http://pruef',
			undefined,
			'2027-03-01 10:00:00'
		);

		expect(bericht.plan.nachrichten).toHaveLength(2);
		expect(bericht.plan.ohneAdresse).toEqual(['Christen']);
		// Jede Nachricht trägt einen anderen Anhang — der Zugangscode ist
		// persönlich.
		const anhaenge = bericht.plan.nachrichten.map((n) => n.anhaenge[0]);
		expect(new Set(anhaenge).size).toBe(2);
	});

	it('scheitert an der Verbindung und nicht am Anhang', async () => {
		/*
		 * **Der eigentliche Nachweis.** Wäre die Zuordnung von Karte zu Person
		 * kaputt, meldete der Versand «Der Anhang fehlt im Versandpaket». Dass
		 * stattdessen die Verbindung scheitert, heisst: Jede Karte wurde gefunden.
		 */
		totenMailausgang();
		const s = await vorbereitet('Versand 3', '2027-04-03');

		const bericht = await verschickeEinladungen(
			handelnder(betreiber),
			s.versammlung,
			'http://pruef',
			undefined,
			'2027-03-01 10:00:00'
		);

		expect(bericht.ergebnisse).toHaveLength(2);
		for (const e of bericht.ergebnisse) {
			expect(e.zugestellt).toBe(false);
			expect(e.grund).not.toMatch(/Anhang/);
			expect(e.grund).toMatch(/connect|ECONNREFUSED|Connection|refused/i);
		}
		expect(bericht.satz).toMatch(/Keine der 2 Nachrichten/);
	});

	it('hält je Empfänger einen Verlaufseintrag fest, mit Adresse', async () => {
		// Im Streitfall ist die Adresse genau das, worum es geht: «Ich habe keine
		// Einladung erhalten» lässt sich ohne sie nicht beantworten.
		totenMailausgang();
		const s = await vorbereitet('Versand 4', '2027-04-04');

		await verschickeEinladungen(
			handelnder(betreiber),
			s.versammlung,
			'http://pruef',
			undefined,
			'2027-03-01 10:00:00'
		);

		const eintraege = await admin<{ detail: Record<string, unknown> }[]>`
			SELECT detail FROM audit_entry
			WHERE event_type = 'access.invitation.sent' AND subject_id = ${s.versammlung}
			ORDER BY id
		`;
		expect(eintraege).toHaveLength(2);
		expect(eintraege.map((e) => e.detail.adresse).sort()).toEqual([
			'aebi@example.ch',
			'bucher@example.ch'
		]);
		expect(eintraege[0].detail.zugestellt).toBe(false);
		// Der Text der Nachricht steht nicht dabei, und der Anhang erst recht
		// nicht — er trägt einen Zugangscode.
		expect(Object.keys(eintraege[0].detail)).not.toContain('text');
		expect(Object.keys(eintraege[0].detail)).not.toContain('anhaenge');
	});

	it('sagt es, wenn zu niemandem eine Adresse erfasst ist', async () => {
		totenMailausgang();
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Versand 5',
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
			displayName: 'Ohne Adresse',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-04-05',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);

		await expect(
			verschickeEinladungen(
				handelnder(betreiber),
				v.id,
				'http://pruef',
				undefined,
				'2027-03-01 10:00:00'
			)
		).rejects.toThrow(FachlicherFehler);
	});
});
