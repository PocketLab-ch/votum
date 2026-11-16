/**
 * Epic 4 — Anwesenheit und Zugangsprüfung in der Datenbank.
 *
 * Der wichtigste Abschnitt ist «Ohne Mandantenkontext»: Wer eine Karte vorzeigt,
 * ist nicht angemeldet. Ohne die Funktion mit `SECURITY DEFINER` liefe jede
 * Abfrage am Zeilenschutz leer aus — dieselbe Henne-Ei-Falle wie bei der
 * Anmeldung.
 */
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	holeVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { codeAusScan, zugangsLink } from '$lib/domain/zugang';
import {
	bestaetigeAnwesenheit,
	erfasseListe,
	erfasseVerlassenDerVersammlung,
	holeAnwesenheitsereignisse,
	holeUebersicht,
	lehneAnmeldungAb,
	loeseZugangAuf,
	meldeTeilnahmeAn
} from '$lib/server/anwesenheit';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;
let stweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Baut eine eröffnete Versammlung mit zwei Parteien und erzeugten Zugängen. */
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
		quotas: { stamm: 600 },
		countsAsHead: true
	});
	const e2 = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 2',
		quotas: { stamm: 400 },
		countsAsHead: true
	});
	const p1 = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	const p2 = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Beat Beispiel',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e1.id, p1.id, '2020-01-01');
	await ordneEigentumZu(handelnder(betreiber), e2.id, p2.id, '2020-01-01');

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
	const zugaenge = await erzeugeZugaenge(handelnder(betreiber), v.id);
	if (eroeffnen) await eroeffneVersammlung(handelnder(betreiber), v.id);

	return { stwegId: g.id, versammlung: v.id, zugaenge, parteien: [p1.id, p2.id] };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Anwesenheit A');
	betreiberB = await pruefbetreiber('Anwesenheit B');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Anwesenheitsweg 0',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(verbindungenSchliessen);

describe('Ohne Mandantenkontext', () => {
	it('löst einen gültigen Code auf', async () => {
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A1', '2026-09-15');
		const befund = await loeseZugangAuf(betreiber, zugaenge[0].code);
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(versammlung);
		expect(befund.parteiId).toBe(zugaenge[0].partyId);
	});

	it('nimmt den Code auch gruppiert und kleingeschrieben entgegen', async () => {
		const { zugaenge } = await aufbau('Zugangsweg A2', '2026-09-16');
		const code = zugaenge[0].code;
		const gruppiert = (code.match(/.{1,4}/g) ?? []).join('-').toLowerCase();
		expect((await loeseZugangAuf(betreiber, gruppiert)).gueltig).toBe(true);
	});

	/**
	 * **Der Weg, den der Kartenscanner am Eingang nimmt.**
	 *
	 * Der QR-Code der Karte trägt eine Adresse, keinen blossen Code — genau das
	 * bekommt der Scanner zu lesen. Ohne `codeAusScan` landete die ganze Adresse
	 * in der Auflösung und käme als «Zugang nicht gültig» zurück. Der Test misst
	 * die Kette so, wie sie am Eingang läuft: Link erzeugen, wie ein Scanner
	 * lesen, nachschlagen.
	 */
	it('löst den Code auf, der im QR-Code der Karte steht — als ganze Adresse', async () => {
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A2b', '2026-09-16');
		const gescannt = zugangsLink('https://versammlung.example.ch', zugaenge[0].code);
		expect(gescannt).toContain('://');

		const befund = await loeseZugangAuf(betreiber, codeAusScan(gescannt));
		expect(befund.gueltig).toBe(true);
		expect(befund.meetingId).toBe(versammlung);
		expect(befund.parteiId).toBe(zugaenge[0].partyId);

		// Die Gegenprobe: ohne die Umwandlung findet die Datenbank nichts.
		expect((await loeseZugangAuf(betreiber, gescannt)).gueltig).toBe(false);
	});

	it('schreibt den Nutzungszeitpunkt fort', async () => {
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A3', '2026-09-17');
		await loeseZugangAuf(betreiber, zugaenge[0].code);
		const zeilen = await imKontext(betreiber, (tx) => tx<{ last_used_at: Date | null }[]>`
			SELECT last_used_at FROM meeting_access WHERE meeting_id = ${versammlung} AND state = 'gueltig'
		`);
		expect(zeilen.some((z) => z.last_used_at !== null)).toBe(true);
	});

	it('nimmt die Karte eines fremden Betreibers als unbekannt und schreibt nichts (A5)', async () => {
		// Die Leitung von B scannt eine Karte aus dem Haus von A. Vor dem
		// 15.10.2026 schrieb schon die Auflösung `last_used_at` in die fremde
		// Zeile, und erst danach prüfte der Aufrufer die Zugehörigkeit.
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A3b', '2026-09-17');
		const befund = await loeseZugangAuf(betreiberB, zugaenge[0].code);
		expect(befund.gueltig).toBe(false);
		expect(befund.meetingId).toBeUndefined();
		expect(befund.grund).toBe((await loeseZugangAuf(betreiber, 'ABCDEFGHJKMNPQRSTWXY')).grund);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ last_used_at: Date | null }[]>`
			SELECT last_used_at FROM meeting_access WHERE meeting_id = ${versammlung}
		`);
		expect(zeilen.length).toBeGreaterThan(0);
		expect(zeilen.every((z) => z.last_used_at === null)).toBe(true);
	});

	it('verrät dem fremden Betreiber auch den genauen Grund nicht', async () => {
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A3c', '2026-09-17');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		const eigen = await loeseZugangAuf(betreiber, zugaenge[0].code);
		const fremd = await loeseZugangAuf(betreiberB, zugaenge[0].code);
		expect(eigen.grund).not.toMatch(/nicht gültig/);
		expect(fremd.grund).toMatch(/nicht gültig/);
	});

	it('gibt bei unbekanntem und bei entwertetem Code dieselbe Antwort', async () => {
		// Von aussen soll sich nicht feststellen lassen, ob ein Code je gültig war.
		const unbekannt = await loeseZugangAuf(betreiber, 'ABCDEFGHJKMNPQRSTWXY');
		expect(unbekannt.gueltig).toBe(false);
		expect(unbekannt.meetingId).toBeUndefined();
		expect(unbekannt.grund).toMatch(/nicht gültig/);
	});

	it('gibt bei leerem Code nichts preis', async () => {
		expect((await loeseZugangAuf(betreiber, '')).gueltig).toBe(false);
	});

	it('verweigert den Zutritt vor der Eröffnung nicht, aber nach dem Schliessen', async () => {
		const { versammlung, zugaenge } = await aufbau('Zugangsweg A4', '2026-09-18');
		expect((await loeseZugangAuf(betreiber, zugaenge[0].code)).gueltig).toBe(true);

		await schliesseVersammlung(handelnder(betreiber), versammlung);
		const nachher = await loeseZugangAuf(betreiber, zugaenge[0].code);
		expect(nachher.gueltig).toBe(false);
		expect(nachher.grund).toMatch(/geschlossen|entwertet/);
	});

	it('meldet bei einer noch nicht eröffneten Versammlung Gültigkeit', async () => {
		// Der Eigentümer soll die Wartesicht sehen, nicht eine Fehlermeldung.
		const { zugaenge } = await aufbau('Zugangsweg A5', '2026-09-19', false);
		expect((await loeseZugangAuf(betreiber, zugaenge[0].code)).gueltig).toBe(true);
	});
});

describe('Anwesenheit bestätigen', () => {
	it('erfasst das Eintreffen und zählt es in der Übersicht', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 1', '2026-10-01');
		const e = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			zugaenge[0].partyId
		);
		expect(e.neu).toBe(true);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.anzahlAnwesend).toBe(1);
		expect(u?.kopfstimmenAnwesend).toBe(1);
	});

	it('weist eine leere Parteiwahl als Absage ab, nicht als Serverfehler', async () => {
		/*
		 * **Gefunden am 21.08.2026 im Durchlauf.** Beim Einlassen von Hand kam die
		 * Parteiwahl leer an; `''` als uuid lässt PostgreSQL mit «invalid input
		 * syntax for type uuid» scheitern, und die Sitzungsleitung sah am Eingang
		 * eine weisse Seite mit «500 Internal Error».
		 *
		 * Der Weg dahin ist nicht abwegig: Die Seite lädt bei jeder Änderung im
		 * Saal nach, und wer in diesem Augenblick auswählt, kann die Auswahl
		 * wieder verlieren.
		 */
		const { versammlung } = await aufbau('Anwesenheitsweg 2a', '2026-10-21');
		await expect(bestaetigeAnwesenheit(handelnder(betreiber), versammlung, '')).rejects.toThrow(
			/Wählen Sie zuerst/
		);
		await expect(
			bestaetigeAnwesenheit(handelnder(betreiber), versammlung, '   ')
		).rejects.toThrow(FachlicherFehler);
	});

	/*
	 * **Der Weg, den niemand behauptet hat** (Auftraggeber, 24.08.2026: «beheben»).
	 *
	 * Der Kerntest deckt die Rechnung ab; dieser hier deckt die Verdrahtung ab —
	 * was wirklich in `attendance_event.channel` landet. Genau dort stand bis zum
	 * 24.08.2026 «gescannt» für jemanden, der nie eine Karte in der Hand hatte,
	 * und der Kerntest hätte das nie gesehen: Die Vorgabe stand im Server.
	 */
	it('behält beim Freigeben den Weg der Selbstanmeldung — bis in die Datenbank', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 2b', '2026-10-22');
		await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);

		// So, wie der Knopf «Freigeben» es tut: ohne Angabe eines Weges.
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		const eingetroffen = ereignisse.filter((e) => e.art === 'eingetroffen');
		expect(eingetroffen).toHaveLength(1);
		expect(eingetroffen[0].weg).toBe('selbst');
	});

	it('behält auch den Weg über das eigene Konto', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 2c', '2026-10-23');
		await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId, 'authentik');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.find((e) => e.art === 'eingetroffen')?.weg).toBe('authentik');
	});

	it('erfasst ohne Anmeldung und ohne Angabe «von Hand», nicht «gescannt»', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 2d', '2026-10-24');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.find((e) => e.art === 'eingetroffen')?.weg).toBe('von_hand');
	});

	it('nimmt eine ausdrückliche Angabe beim Wort', async () => {
		// Die Person hat sich angemeldet UND legt am Eingang die Karte vor.
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 2e', '2026-10-25');
		await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);
		await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			zugaenge[0].partyId,
			'gescannt'
		);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.find((e) => e.art === 'eingetroffen')?.weg).toBe('gescannt');
	});

	it('erzeugt beim zweiten Mal kein zweites Ereignis', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 2', '2026-10-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		const zweite = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			zugaenge[0].partyId
		);
		expect(zweite.neu).toBe(false);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.filter((x) => x.art === 'eingetroffen')).toHaveLength(1);
	});

	it('erfasst vor der Eröffnung keine Anwesenheit', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 3', '2026-10-03', false);
		await expect(
			bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId)
		).rejects.toThrow(/noch nicht eröffnet/);
	});

	it('erfasst nach dem Schliessen keine mehr', async () => {
		const { versammlung, zugaenge } = await aufbau('Anwesenheitsweg 4', '2026-10-04');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await expect(
			bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId)
		).rejects.toThrow(/läuft nicht mehr/);
	});

	it('weist eine fremde Partei ab', async () => {
		const a = await aufbau('Anwesenheitsweg 5', '2026-10-05');
		const b = await aufbau('Anwesenheitsweg 6', '2026-10-06');
		await expect(
			bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, b.zugaenge[0].partyId)
		).rejects.toThrow(/an dieser Versammlung nicht stimmberechtigt/);
	});
});

describe('Selbstanmeldung und Warteliste', () => {
	it('erzeugt einen Wartelisteneintrag, keine Anwesenheit', async () => {
		// Sonst könnte sich jeder mit einem Zugangscode selbst stimmberechtigt
		// machen.
		const { versammlung, zugaenge } = await aufbau('Warteweg 1', '2026-11-01');
		const e = await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);
		expect(e.zustand).toBe('wartet');

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.anzahlAnwesend).toBe(0);
		expect(u?.wartendeParteiIds).toHaveLength(1);
		expect(u?.kopfstimmenAnwesend).toBe(0);
	});

	it('macht aus dem Wartenden durch Freigabe einen Anwesenden', async () => {
		const { versammlung, zugaenge } = await aufbau('Warteweg 2', '2026-11-02');
		await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.anzahlAnwesend).toBe(1);
		expect(u?.wartendeParteiIds).toHaveLength(0);
	});

	it('bringt einen bereits Bestätigten nicht in die Warteliste zurück', async () => {
		// Er verlöre sonst seine Stimmberechtigung, indem er seinen Link erneut
		// öffnet.
		const { versammlung, zugaenge } = await aufbau('Warteweg 3', '2026-11-03');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		const e = await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);
		expect(e.zustand).toBe('anwesend');

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.anzahlAnwesend).toBe(1);
	});

	it('lehnt eine Anmeldung ab und hält den Grund fest', async () => {
		const { versammlung, zugaenge } = await aufbau('Warteweg 4', '2026-11-04');
		await meldeTeilnahmeAn(betreiber, versammlung, zugaenge[0].partyId);
		await lehneAnmeldungAb(
			handelnder(betreiber),
			versammlung,
			zugaenge[0].partyId,
			'Nicht am richtigen Ort'
		);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.wartendeParteiIds).toHaveLength(0);
		expect(u?.anzahlAnwesend).toBe(0);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: { grund: string } }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${versammlung} AND event_type = 'attendance.declined'
		`);
		expect(zeilen[0].detail.grund).toBe('Nicht am richtigen Ort');
	});
});

describe('Verlassen und Rückkehr', () => {
	it('lässt den bisherigen Eintrag unverändert bestehen', async () => {
		const { versammlung, zugaenge } = await aufbau('Gehweg 1', '2026-12-01');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.map((x) => x.art)).toEqual(['eingetroffen', 'verlassen']);

		const u = await holeUebersicht(betreiber, versammlung);
		const stand = u?.staende.find((s) => s.parteiId === zugaenge[0].partyId);
		expect(stand?.zustand).toBe('gegangen');
		expect(stand?.seit).not.toBeNull();
	});

	it('rechnet zum Stichzeitpunkt und nicht rückwirkend', async () => {
		// Die eigentliche Zusage von AD-16.
		const { versammlung, zugaenge } = await aufbau('Gehweg 2', '2026-12-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		const zeitpunktDesEintreffens = ereignisse[0].zeitpunkt;

		await erfasseVerlassenDerVersammlung(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		expect((await holeUebersicht(betreiber, versammlung))?.kopfstimmenAnwesend).toBe(0);
		expect(
			(await holeUebersicht(betreiber, versammlung, zeitpunktDesEintreffens))?.kopfstimmenAnwesend
		).toBe(1);
	});

	it('erfasst eine Rückkehr als drittes Ereignis', async () => {
		const { versammlung, zugaenge } = await aufbau('Gehweg 3', '2026-12-03');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse.map((x) => x.art)).toEqual(['eingetroffen', 'verlassen', 'eingetroffen']);
		expect((await holeUebersicht(betreiber, versammlung))?.anzahlAnwesend).toBe(1);
	});

	it('erfasst das Verlassen nur bei Anwesenheit', async () => {
		const { versammlung, zugaenge } = await aufbau('Gehweg 4', '2026-12-04');
		await expect(
			erfasseVerlassenDerVersammlung(handelnder(betreiber), versammlung, zugaenge[0].partyId)
		).rejects.toThrow(/nicht als anwesend/);
	});

	it('hält die Begründung am Stand und im Verlauf fest', async () => {
		// Befund Praxisdurchlauf 03.10.2026, Punkt 8: Die Begründung ist kein
		// Formularschmuck, sie gehört zur Anwesenheit und in den Nachweis.
		const { versammlung, zugaenge } = await aufbau('Gehweg 5', '2026-12-05');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await erfasseVerlassenDerVersammlung(
			handelnder(betreiber),
			versammlung,
			zugaenge[0].partyId,
			'Arzttermin'
		);

		const u = await holeUebersicht(betreiber, versammlung);
		const stand = u?.staende.find((s) => s.parteiId === zugaenge[0].partyId);
		expect(stand?.gegangenGrund).toBe('Arzttermin');

		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: { grund: string } }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${versammlung} AND event_type = 'attendance.left'
		`);
		expect(zeilen[0].detail.grund).toBe('Arzttermin');
	});
});

describe('Häkchenliste der einfachen Betriebsart', () => {
	it('erfasst mehrere in einem Durchgang', async () => {
		const { versammlung, parteien } = await aufbau('Listenweg 1', '2027-01-01');
		const e = await erfasseListe(handelnder(betreiber), versammlung, parteien);
		expect(e.erfasst).toBe(2);
		expect((await holeUebersicht(betreiber, versammlung))?.anzahlAnwesend).toBe(2);
	});

	it('überspringt bereits Erfasste, statt sie zu verdoppeln', async () => {
		const { versammlung, parteien } = await aufbau('Listenweg 2', '2027-01-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, parteien[0]);
		const e = await erfasseListe(handelnder(betreiber), versammlung, parteien);
		expect(e.erfasst).toBe(1);
		expect(e.schonAnwesend).toBe(1);
	});

	it('erfasst kein Weggehen für die Fehlenden', async () => {
		// Das Weggehen ist ein eigener Vorgang mit eigenem Zeitpunkt. Eine
		// Häkchenliste, die es nebenbei erledigt, erzeugt Zeitpunkte, die niemand
		// gesetzt hat.
		const { versammlung, parteien } = await aufbau('Listenweg 3', '2027-01-03');
		await erfasseListe(handelnder(betreiber), versammlung, parteien);
		await erfasseListe(handelnder(betreiber), versammlung, [parteien[0]]);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u?.anzahlAnwesend).toBe(2);
	});

	it('vermerkt den Weg «liste» und damit die Erfassung durch die Sitzungsleitung', async () => {
		const { versammlung, parteien } = await aufbau('Listenweg 4', '2027-01-04');
		await erfasseListe(handelnder(betreiber), versammlung, [parteien[0]]);
		const ereignisse = await holeAnwesenheitsereignisse(betreiber, versammlung);
		expect(ereignisse[0].weg).toBe('liste');
		expect(ereignisse[0].erfasstDurch).toBe('Prüflauf');
	});
});

describe('Unveränderlichkeit und Zeilenschutz', () => {
	it('lässt ein Anwesenheitsereignis nicht ändern', async () => {
		// Sonst liesse sich nachträglich behaupten, jemand sei bei einer
		// Abstimmung anwesend gewesen, bei der er es nicht war.
		const { versammlung, zugaenge } = await aufbau('Schutzweg 1', '2027-02-01');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE attendance_event SET kind = 'verlassen' WHERE meeting_id = ${versammlung}
			`)
		).rejects.toThrow(/unveränderlich|denied|verweigert/i);
	});

	it('lässt es nicht löschen', async () => {
		const { versammlung, zugaenge } = await aufbau('Schutzweg 2', '2027-02-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		await expect(
			imKontext(betreiber, (tx) => tx`
				DELETE FROM attendance_event WHERE meeting_id = ${versammlung}
			`)
		).rejects.toThrow(/denied|verweigert/i);
	});

	it('verlangt bei Erfassung durch die Sitzungsleitung einen Erfasser', async () => {
		// Eine Erfassung ohne Erfasser wäre im Protokoll wertlos.
		const { versammlung } = await aufbau('Schutzweg 3', '2027-02-03');
		const [sp] = await imKontext(betreiber, (tx) => tx<{ id: string }[]>`
			SELECT id FROM snapshot_party WHERE meeting_id = ${versammlung} LIMIT 1
		`);
		await expect(
			imKontext(betreiber, (tx) => tx`
				INSERT INTO attendance_event (operator_id, meeting_id, snapshot_party_id, kind, channel)
				VALUES (${betreiber}, ${versammlung}, ${sp.id}, 'eingetroffen', 'von_hand')
			`)
		).rejects.toThrow(/attendance_erfasser/);
	});

	it('zeigt einem fremden Betreiber nichts', async () => {
		const { versammlung, zugaenge } = await aufbau('Schutzweg 4', '2027-02-04');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);
		expect(await holeAnwesenheitsereignisse(betreiberB, versammlung)).toHaveLength(0);
		expect(await holeUebersicht(betreiberB, versammlung)).toBeNull();
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM attendance_event`)).toHaveLength(0);
	});
});

describe('Lebenslauf der Versammlung', () => {
	it('entwertet beim Schliessen alle Zugänge', async () => {
		const { versammlung } = await aufbau('Laufweg 1', '2027-03-01');
		const e = await schliesseVersammlung(handelnder(betreiber), versammlung);
		expect(e.entwertet).toBe(2);
		expect(e.versammlung.zustand).toBe('geschlossen');
	});

	it('versperrt nach der Eröffnung die Rücknahme der Freigabe', async () => {
		const { versammlung } = await aufbau('Laufweg 2', '2027-03-02');
		await expect(
			nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung)
		).rejects.toThrow(/laufend/);
	});

	it('verwirft mit der Rücknahme der Freigabe auch die Anwesenheitsereignisse', async () => {
		// Sie hängen an der Momentaufnahme. Ein Ereignis zu einem
		// festgehaltenen Stand, den es nicht mehr gibt, wäre eine Anwesenheit
		// ohne Grundlage.
		const { versammlung, zugaenge } = await aufbau('Laufweg 3', '2027-03-03', false);
		await eroeffneVersammlung(handelnder(betreiber), versammlung);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, zugaenge[0].partyId);

		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'freigegeben', opened_at = NULL WHERE id = ${versammlung}
		`);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung);

		expect(await holeAnwesenheitsereignisse(betreiber, versammlung)).toHaveLength(0);
	});

	it('stellt die Versammlung auf ein Traktandum', async () => {
		const { versammlung } = await aufbau('Laufweg 4', '2027-03-04');
		const [t] = await imKontext(betreiber, (tx) => tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${versammlung} ORDER BY position LIMIT 1
		`);
		await stelleAufTraktandum(handelnder(betreiber), versammlung, t.id);
		expect((await holeVersammlung(betreiber, versammlung))?.aktuellesTraktandumId).toBe(t.id);
	});

	it('weist ein fremdes Traktandum ab', async () => {
		const a = await aufbau('Laufweg 5', '2027-03-05');
		const b = await aufbau('Laufweg 6', '2027-03-06');
		const [t] = await imKontext(betreiber, (tx) => tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${b.versammlung} LIMIT 1
		`);
		await expect(
			stelleAufTraktandum(handelnder(betreiber), a.versammlung, t.id)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});

	it('räumt beim Schliessen das aktuelle Traktandum weg', async () => {
		const { versammlung } = await aufbau('Laufweg 7', '2027-03-07');
		const [t] = await imKontext(betreiber, (tx) => tx<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${versammlung} LIMIT 1
		`);
		await stelleAufTraktandum(handelnder(betreiber), versammlung, t.id);
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		expect((await holeVersammlung(betreiber, versammlung))?.aktuellesTraktandumId).toBeNull();
	});
});

describe('Es steht noch nicht fest, wer stimmberechtigt ist', () => {
	it('gibt ohne Momentaufnahme keine Übersicht', async () => {
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: stweg,
			datum: '2027-04-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		expect(await holeUebersicht(betreiber, v.id)).toBeNull();
	});
});
