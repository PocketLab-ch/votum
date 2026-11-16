/**
 * Gerätesitzung und Ausgabecode in der Datenbank.
 *
 * Der Anlass: Der Einstieg über den Beamer-QR bestätigte die Anwesenheit, liess
 * das Gerät der Person aber ohne Nachweis zurück — in der geführten Betriebsart
 * konnte sie damit nicht abstimmen. Der Ausgabecode schliesst das.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { holeUebersicht } from '$lib/server/anwesenheit';
import {
	beendeEigeneSitzung,
	gibCodeAus,
	meldeNachEinloesungAn,
	holeGeraete,
	loeseCodeEin,
	loeseSitzungAuf,
	widerrufeSitzungen
} from '$lib/server/zugangssitzung';
import { loeseZugangAuf } from '$lib/server/anwesenheit';
import { AUSGABECODELAENGE, normalisiere } from '$lib/domain/zugang';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function aufbau(name: string, datum: string, eroeffnen = true) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e1 = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p1 = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e1.id, p1.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (eroeffnen) await eroeffneVersammlung(handelnder(betreiber), v.id);

	return { versammlung: v.id, parteiId: p1.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Sitzung A');
	betreiberB = await pruefbetreiber('Sitzung B');
});

afterAll(verbindungenSchliessen);

describe('Kartencode einlösen', () => {
	it('legt eine Gerätesitzung an', async () => {
		const { versammlung } = await aufbau('Sitzungsweg 1', '2026-09-15');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		const e = await loeseCodeEin(zugang.code);
		expect(e.gelungen).toBe(true);
		expect(e.art).toBe('karte');

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(versammlung);
		expect(befund.parteiId).toBe(zugang.partyId);
	});

	it('merkt sich, welches Gerät hereinkam', async () => {
		const { versammlung, parteiId } = await aufbau('Sitzungsweg 2', '2026-09-16');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		await loeseCodeEin(
			zugang.code,
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) Version/18.2 Safari/604.1'
		);

		const geraet = (await holeGeraete(betreiber, versammlung)).get(parteiId);
		expect(geraet?.bezeichnung).toBe('iPhone · Safari');
		expect(geraet?.herkunft).toBe('karte');
	});

	it('speichert die Browserkennung nicht, nur die Bezeichnung', async () => {
		// Die Kennung wäre ein Wiedererkennungsmerkmal, und dafür gibt es hier
		// keinen Grund.
		const { versammlung } = await aufbau('Sitzungsweg 2b', '2026-09-18');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const kennung = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Firefox/133.0';
		await loeseCodeEin(zugang.code, kennung);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ zeile: string }[]>`
			SELECT s::text AS zeile FROM access_session s
			JOIN meeting_access a ON a.id = s.meeting_access_id
			WHERE a.meeting_id = ${versammlung}
		`);
		expect(zeilen.length).toBe(1);
		expect(zeilen[0].zeile).not.toContain('Mozilla');
		expect(zeilen[0].zeile).toContain('Windows-Rechner');
	});

	it('speichert kein Sitzungsmerkmal im Klartext', async () => {
		const { versammlung } = await aufbau('Sitzungsweg 3', '2026-09-17');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const e = await loeseCodeEin(zugang.code);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ zeile: string }[]>`
			SELECT access_session::text AS zeile FROM access_session
		`);
		for (const z of zeilen) {
			expect(z.zeile).not.toContain(e.merkmal as string);
		}
	});
});

describe('Ausgabecode für den Saal', () => {
	it('gibt einen kurzen Code aus und löst ihn ein', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 1', '2026-10-01');
		await erzeugeZugaenge(handelnder(betreiber), versammlung);

		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		expect(normalisiere(a.code)).toHaveLength(AUSGABECODELAENGE);
		expect(a.name).toBe('Anna Muster');

		const e = await loeseCodeEin(a.code);
		expect(e.gelungen).toBe(true);
		expect(e.art).toBe('ausgabe');

		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(true);
		expect(befund.parteiId).toBe(parteiId);
	});

	/*
	 * **Einlösen führt in die Warteschlange** (Auftraggeber, 24.08.2026: «Wenn der QR
	 * genutzt wird, lande ich auf der Anmeldeseite. Sollte der dann nicht in die
	 * Warteschlange kommen?»).
	 *
	 * Wer seinen Code einlöst, während die Versammlung läuft, sagt damit «ich bin
	 * da». Der Knopf «Jetzt anmelden» danach war ein Tipp im Gedränge für eine
	 * Aussage, die schon gemacht wurde.
	 *
	 * **Die Sicherung bleibt:** Eine Anmeldung ist keine Anwesenheit. Geprüft
	 * wird deshalb beides — dass die Person wartet UND dass sie nicht zählt.
	 */
	it('meldet nach dem Einlösen an, ohne Anwesenheit zu erzeugen', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 1b', '2026-10-11');
		await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);

		const e = await loeseCodeEin(a.code);
		expect(await meldeNachEinloesungAn(e.merkmal as string)).toBe(true);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.wartendeParteiIds).toHaveLength(1);
		expect(u?.anzahlAnwesend).toBe(0);
	});

	it('meldet nicht an, solange die Versammlung noch nicht läuft', async () => {
		// Vorher wäre die Anmeldung ohne Gegenstand — und eine Absage nach einem
		// gelungenen Scan wäre eine Meldung über etwas, das nicht misslungen ist.
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 1c', '2026-10-12', false);
		await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);

		const e = await loeseCodeEin(a.code);
		expect(e.gelungen).toBe(true);
		expect(await meldeNachEinloesungAn(e.merkmal as string)).toBe(false);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.wartendeParteiIds ?? []).toHaveLength(0);
	});

	it('verbraucht den Ausgabecode beim Einlösen', async () => {
		// Sonst löste ihn ein zweites Gerät noch einmal ein — vorgelesen im Saal
		// hört ihn jeder.
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 2', '2026-10-02');
		await erzeugeZugaenge(handelnder(betreiber), versammlung);

		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		expect((await loeseCodeEin(a.code)).gelungen).toBe(true);
		expect((await loeseCodeEin(a.code)).gelungen).toBe(false);
	});

	it('entwertet die Karte nicht', async () => {
		// Wer sie fünf Minuten später doch in der Tasche findet, soll sie benutzen
		// können. Solange das Gerät mit dem Ausgabecode angemeldet ist, ist der
		// Zugang belegt — aber das ist etwas anderes als «ungültig», und der
		// Unterschied entscheidet, ob die Person selbst weiterkommt.
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 3', '2026-10-03');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		const ausgabe = await loeseCodeEin(a.code);

		expect((await loeseCodeEin(zugang.code)).ausgang).toBe('belegt');

		await beendeEigeneSitzung(ausgabe.merkmal as string);
		expect((await loeseCodeEin(zugang.code)).gelungen).toBe(true);
	});

	it('erzeugt einen Zugang, wenn noch keiner besteht', async () => {
		// Der häufige Fall, wenn die Karten noch nie erzeugt wurden.
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 4', '2026-10-04');
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		expect((await loeseCodeEin(a.code)).gelungen).toBe(true);
	});

	it('ersetzt einen früheren Ausgabecode', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 5', '2026-10-05');
		const erster = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		const zweiter = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);

		expect((await loeseCodeEin(erster.code)).gelungen).toBe(false);
		expect((await loeseCodeEin(zweiter.code)).gelungen).toBe(true);
	});

	it('weist einen abgelaufenen Ausgabecode ab', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 6', '2026-10-06');
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);

		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting_access SET handout_expires_at = now() - interval '1 minute'
			WHERE handout_hash IS NOT NULL AND meeting_id = ${versammlung}
		`);
		expect((await loeseCodeEin(a.code)).gelungen).toBe(false);
	});

	it('schreibt den Code nicht in den Verlauf', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 7', '2026-10-07');
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: string }[]>`
			SELECT detail::text AS detail FROM audit_entry WHERE event_type = 'access.handout.issued'
		`);
		for (const z of zeilen) {
			expect(z.detail).not.toContain(normalisiere(a.code));
		}
	});

	it('gibt vor der Freigabe keinen Code aus', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Entwurfweg 8',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-10-08',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await expect(
			gibCodeAus(handelnder(betreiber), v.id, 'egal')
		).rejects.toThrow(/Freigabe/);
	});

	it('gibt nach dem Schliessen keinen mehr aus', async () => {
		const { versammlung, parteiId } = await aufbau('Ausgabeweg 9', '2026-10-09');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await expect(
			gibCodeAus(handelnder(betreiber), versammlung, parteiId)
		).rejects.toThrow(/geschlossen/);
	});
});


/**
 * Was passiert, wenn die **Sitzungsleitung** eine Karte scannt.
 *
 * Gefragt am 02.08.2026: «Wenn ich mit der Fotoapp als Versammlungsleiter den
 * Code scanne, geschieht was?» Bisher: Der Code wurde eingelöst, und das Gerät
 * der Sitzungsleitung galt als das Gerät dieses Eigentümers — der kam mit seiner
 * eigenen Karte nicht mehr hinein.
 *
 * Neu löst die Sitzungsleitung nur **auf**, statt einzulösen. Der Unterschied
 * ist genau diese Prüfung: Nach dem Auflösen muss die Karte noch einlösbar sein.
 */
describe('Die Sitzungsleitung scannt eine Karte', () => {
	it('verbraucht die Karte nicht — der Eigentümer kommt danach noch hinein', async () => {
		const { versammlung } = await aufbau('Leitungsscan 1', '2026-09-27');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		// Was die Anwesenheitsseite tut, wenn eine gescannte Karte ankommt.
		const befund = await loeseZugangAuf(betreiber, zugang.code);
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(versammlung);
		expect(befund.parteiId).toBe(zugang.partyId);

		// Und danach das, was früher unmöglich war.
		const e = await loeseCodeEin(zugang.code);
		expect(e.gelungen).toBe(true);
	});

	/**
	 * Die Gegenprobe zum Befund: Einlösen bindet ein Gerät, und ein zweites
	 * bekommt die Karte nicht mehr. Genau das geschah der Sitzungsleitung.
	 */
	it('zeigt zum Vergleich, was Einlösen anrichtet', async () => {
		const { versammlung } = await aufbau('Leitungsscan 2', '2026-09-28');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		expect((await loeseCodeEin(zugang.code)).gelungen).toBe(true);
		const zweites = await loeseCodeEin(zugang.code);
		expect(zweites.gelungen).toBe(false);
		expect(zweites.ausgang).toBe('belegt');
	});

	it('lässt kein Gerät zurück', async () => {
		const { versammlung, parteiId } = await aufbau('Leitungsscan 3', '2026-09-29');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		await loeseZugangAuf(betreiber, zugang.code);
		expect((await holeGeraete(betreiber, versammlung)).get(parteiId)).toBeUndefined();
	});
});

describe('Sitzung endet mit der Versammlung', () => {
	it('gibt nach dem Schliessen keinen Zutritt mehr', async () => {
		const { versammlung } = await aufbau('Endeweg 1', '2026-11-01');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const e = await loeseCodeEin(zugang.code);
		expect((await loeseSitzungAuf(e.merkmal as string)).gueltig).toBe(true);

		await schliesseVersammlung(handelnder(betreiber), versammlung);
		const nachher = await loeseSitzungAuf(e.merkmal as string);
		expect(nachher.gueltig).toBe(false);
		expect(nachher.grund).toMatch(/geschlossen|entwertet/);
	});

	it('meldet eine abgelaufene Sitzung als solche', async () => {
		const { versammlung } = await aufbau('Endeweg 2', '2026-11-02');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const e = await loeseCodeEin(zugang.code);

		await imKontext(betreiber, (tx) => tx`
			UPDATE access_session s SET expires_at = now() - interval '1 hour'
			FROM meeting_access a
			WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
		`);
		const befund = await loeseSitzungAuf(e.merkmal as string);
		expect(befund.gueltig).toBe(false);
		expect(befund.grund).toMatch(/abgelaufen/);
	});

	it('gibt zu einem unbekannten Merkmal nichts preis', async () => {
		const befund = await loeseSitzungAuf('völlig-erfunden');
		expect(befund.gueltig).toBe(false);
		expect(befund.meetingId).toBeUndefined();
	});
});

describe('Eine Sitzung je Zugang', () => {
	it('weist ein zweites Gerät ab, statt das erste zu verdrängen', async () => {
		// Der Kern der Regel. Verdrängte das zweite das erste, flöge der Eigentümer
		// wortlos aus seiner Sitzung und merkte es erst, wenn seine Stimme nicht
		// mehr zählt.
		const { versammlung } = await aufbau('Einzelweg 1', '2027-02-01');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);

		const erstes = await loeseCodeEin(zugang.code);
		const zweites = await loeseCodeEin(zugang.code);

		expect(zweites.gelungen).toBe(false);
		expect(zweites.ausgang).toBe('belegt');
		expect(zweites.grund).toMatch(/Code stimmt/);
		// Und das erste Gerät ist unversehrt.
		expect((await loeseSitzungAuf(erstes.merkmal as string)).gueltig).toBe(true);
	});

	it('lässt die Datenbank keine zwei offenen Sitzungen zu', async () => {
		// Als Bedingung der Datenbank und nicht bloss als Absicht im Code: Zwei
		// Anmeldungen im selben Augenblick dürfen die Regel nicht unterlaufen.
		const { versammlung } = await aufbau('Einzelweg 2', '2027-02-02');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);

		await expect(
			imKontext(betreiber, (tx) => tx`
				INSERT INTO access_session
					(operator_id, meeting_access_id, token_hash, origin, expires_at)
				SELECT a.operator_id, a.id, repeat('a', 64), 'karte', now() + interval '1 hour'
				FROM meeting_access a WHERE a.meeting_id = ${versammlung}
			`)
		).rejects.toThrow(/access_session_eine_offene/);
	});

	it('gibt den Zugang frei, wenn die Person sich selbst abmeldet', async () => {
		// Der Weg, auf dem der Eigentümer das Gerät wechselt, ohne die
		// Sitzungsleitung zu bemühen.
		const { versammlung } = await aufbau('Einzelweg 3', '2027-02-03');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const erstes = await loeseCodeEin(zugang.code);

		expect(await beendeEigeneSitzung(erstes.merkmal as string)).toBe(true);

		const zweites = await loeseCodeEin(zugang.code);
		expect(zweites.gelungen).toBe(true);
		const alt = await loeseSitzungAuf(erstes.merkmal as string);
		expect(alt.gueltig).toBe(false);
		expect(alt.grund).toMatch(/abgemeldet/);
	});

	it('lässt einen ausgegebenen Code das Gerät ablösen', async () => {
		// Die eine Ausnahme: Ihn hat ein Mensch einer Person gegeben, die vor ihm
		// stand — dieselbe Vertrauensstufe wie das Erfassen von Hand.
		const { versammlung, parteiId } = await aufbau('Einzelweg 4', '2027-02-04');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const altes = await loeseCodeEin(zugang.code);

		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		const neues = await loeseCodeEin(a.code);
		expect(neues.gelungen).toBe(true);

		const abgeloest = await loeseSitzungAuf(altes.merkmal as string);
		expect(abgeloest.gueltig).toBe(false);
		expect(abgeloest.grund).toMatch(/übernommen/);
		expect((await holeGeraete(betreiber, versammlung)).get(parteiId)?.herkunft).toBe('ausgabe');
	});

	it('lässt eine abgelaufene Sitzung den Zugang nicht blockieren', async () => {
		// Sonst sperrte ein Gerät, das seit gestern niemand mehr anfasst, seinen
		// eigenen Eigentümer aus.
		const { versammlung } = await aufbau('Einzelweg 5', '2027-02-05');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);

		await imKontext(betreiber, (tx) => tx`
			UPDATE access_session s SET expires_at = now() - interval '1 hour'
			FROM meeting_access a
			WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
		`);

		expect((await loeseCodeEin(zugang.code)).gelungen).toBe(true);
	});
});

describe('Widerruf', () => {
	it('gibt den Zugang wieder frei, die Karte bleibt gültig', async () => {
		// Zwei Anlässe, derselbe Griff: leerer Akku, oder ein vorgelesener Code ist
		// beim Falschen gelandet.
		const { versammlung, parteiId } = await aufbau('Widerrufweg 1', '2026-12-01');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		const a = await loeseCodeEin(zugang.code);

		expect((await holeGeraete(betreiber, versammlung)).get(parteiId)?.bezeichnung).toBeTruthy();
		expect(await widerrufeSitzungen(handelnder(betreiber), versammlung, parteiId)).toBe(1);

		const alt = await loeseSitzungAuf(a.merkmal as string);
		expect(alt.gueltig).toBe(false);
		expect(alt.grund).toMatch(/freigegeben/);
		// Die Karte bleibt: Sie ist ein anderer Weg zum selben Zugang.
		expect((await loeseCodeEin(zugang.code)).gelungen).toBe(true);
	});

	it('nimmt dabei einen offenen Ausgabecode zurück', async () => {
		// Er wäre sonst der nächste Weg für denselben Falschen.
		const { versammlung, parteiId } = await aufbau('Widerrufweg 2', '2026-12-02');
		const a = await gibCodeAus(handelnder(betreiber), versammlung, parteiId);
		await widerrufeSitzungen(handelnder(betreiber), versammlung, parteiId);
		expect((await loeseCodeEin(a.code)).gelungen).toBe(false);
	});

	it('löscht die Sitzung nicht, sondern widerruft sie mit Grund', async () => {
		// Sonst liesse sich später nicht unterscheiden, ob ein Gerät nie da war
		// oder ausgesperrt wurde — und genau das ist im Streitfall die Frage.
		const { versammlung, parteiId } = await aufbau('Widerrufweg 3', '2026-12-03');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);
		await widerrufeSitzungen(handelnder(betreiber), versammlung, parteiId);

		const zeilen = await imKontext(betreiber, (tx) => tx<
			{ revoked_at: Date | null; revoked_reason: string | null }[]
		>`
			SELECT s.revoked_at, s.revoked_reason FROM access_session s
			JOIN meeting_access a ON a.id = s.meeting_access_id
			WHERE a.meeting_id = ${versammlung}
		`);
		expect(zeilen.length).toBeGreaterThan(0);
		expect(zeilen.every((z) => z.revoked_at !== null)).toBe(true);
		expect(zeilen.every((z) => z.revoked_reason === 'freigegeben')).toBe(true);
	});

	it('lässt kein Ende ohne Grund zu', async () => {
		// Eine halbe Angabe wäre schlimmer als keine: Sie sähe nach Auskunft aus.
		const { versammlung } = await aufbau('Widerrufweg 3b', '2026-12-05');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);

		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE access_session s SET revoked_at = now()
				FROM meeting_access a
				WHERE a.id = s.meeting_access_id AND a.meeting_id = ${versammlung}
			`)
		).rejects.toThrow(/access_session_ende_mit_grund/);
	});

	it('lässt Sitzungen nicht löschen', async () => {
		const { versammlung } = await aufbau('Widerrufweg 4', '2026-12-04');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM access_session`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber keine Geräte', async () => {
		const { versammlung } = await aufbau('Fremdweg 1', '2027-01-01');
		const [zugang] = await erzeugeZugaenge(handelnder(betreiber), versammlung);
		await loeseCodeEin(zugang.code);
		expect((await holeGeraete(betreiberB, versammlung)).size).toBe(0);
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM access_session`)).toHaveLength(0);
	});
});
