/**
 * Story 6.1 — die Übersicht gegen die Datenbank (FR-64).
 *
 * Der Kern ist mit Wertetabellen geprüft; hier geht es allein um die Abfrage.
 * Ihr grösstes Risiko steht im Test «zählt nicht über Kreuz»: Ein Verbund über
 * mehrere Nebentabellen ergäbe statt der Summen ihre Produkte — ein Fehler, der
 * erst bei mehreren Traktanden **und** mehreren Zugängen sichtbar wird und dann
 * wie ein Zufall aussieht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { holeUebersicht, holeVorbereitung } from '$lib/server/uebersicht';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Eine Gemeinschaft mit zwei Einheiten zu je 500 und zwei Eigentümern. */
async function gemeinschaft(operatorId: string, name: string, nenner = 1000) {
	const g = await erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: nenner,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	for (const [i, label] of ['Whg 1', 'Whg 2'].entries()) {
		const e = await erstelleEinheit(handelnder(operatorId), {
			stwegId: g.id,
			kind: 'unit',
			label,
			quotas: { stamm: 500 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(operatorId), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Person ${i + 1} ${name}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(operatorId), e.id, p.id, '2020-01-01');
	}
	return g.id;
}

async function versammlung(operatorId: string, stwegId: string, datum: string) {
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	return v.id;
}

async function antrag(operatorId: string, meetingId: string, titel: string) {
	return erstelleTraktandum(handelnder(operatorId), {
		meetingId,
		titel,
		art: 'abstimmung',
		antragswortlaut: `${titel} wird beschlossen.`,
		antragstellerart: 'bewirtschaftung'
	});
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Uebersicht A');
	betreiberB = await pruefbetreiber('Uebersicht B');
});

afterAll(verbindungenSchliessen);

describe('Übersicht', () => {
	it('meldet die leere Lage als leer', async () => {
		const u = await holeUebersicht(betreiberB, '2026-07-30');
		expect(u.leer).toBe(true);
		expect(u.anstehend).toEqual([]);
		expect(u.punkte).toEqual([]);
	});

	it('hebt die laufende Versammlung heraus', async () => {
		const g = await gemeinschaft(betreiber, 'Laufweg 1');
		const v = await versammlung(betreiber, g, '2026-09-15');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'laufend', opened_at = now() WHERE id = ${v}
		`);

		const u = await holeUebersicht(betreiber, '2026-09-15');
		expect(u.laufend.map((z) => z.id)).toContain(v);
		// Eine laufende Versammlung steht nicht zugleich unter «steht an» — sonst
		// stünde dieselbe Sache zweimal auf einer Seite, die Überblick schaffen soll.
		expect(u.anstehend.map((z) => z.id)).not.toContain(v);
	});

	it('ordnet die anstehenden nach Datum aufsteigend', async () => {
		const g = await gemeinschaft(betreiber, 'Reihenweg 2');
		const spaet = await versammlung(betreiber, g, '2027-11-01');
		const frueh = await versammlung(betreiber, g, '2027-10-01');

		const u = await holeUebersicht(betreiber, '2027-01-01');
		const meine = u.anstehend.filter((z) => z.id === frueh || z.id === spaet);
		expect(meine.map((z) => z.id)).toEqual([frueh, spaet]);
	});

	it('lässt vergangene Entwürfe aus den anstehenden weg', async () => {
		const g = await gemeinschaft(betreiber, 'Gesternweg 3');
		const alt = await versammlung(betreiber, g, '2020-01-15');

		const u = await holeUebersicht(betreiber, '2026-07-30');
		expect(u.anstehend.map((z) => z.id)).not.toContain(alt);
	});

	/*
	 * **Freigegeben, Termin verstrichen, nicht eröffnet** (22.08.2026, Befund
	 * C-05). Im Prüflauf war die Versammlung am Abend ihres Datums nirgends auf
	 * der Startseite: nicht unter «läuft gerade» (noch nicht eröffnet) und nicht
	 * unter «anstehend» (dort steht nur Zukünftiges). Sie fiel durch beide Raster
	 * — obwohl sie das Dringendste war, was es an diesem Tag zu tun gab.
	 */
	it('führt eine freigegebene Versammlung mit verstrichenem Termin als überfällig', async () => {
		const g = await gemeinschaft(betreiber, 'Verstrichenweg 7');
		const v = await versammlung(betreiber, g, '2026-03-12');
		// `released_at` muss mit: Der CHECK `meeting_zeitstempel` verlangt zu jedem
		// Zustand die passenden Marken — «freigegeben» ohne Freigabezeitpunkt gibt
		// es nicht, und das ist richtig so.
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}
		`);

		const u = await holeUebersicht(betreiber, '2026-07-30');
		expect(u.ueberfaellig.map((z) => z.id)).toContain(v);
		// Und nicht doppelt: Sie steht weder unter «anstehend» noch «läuft gerade».
		expect(u.anstehend.map((z) => z.id)).not.toContain(v);
		expect(u.laufend.map((z) => z.id)).not.toContain(v);
	});

	it('führt eine freigegebene Versammlung in der Zukunft NICHT als überfällig', async () => {
		const g = await gemeinschaft(betreiber, 'Kommtnochweg 8');
		const v = await versammlung(betreiber, g, '2027-05-01');
		// `released_at` muss mit: Der CHECK `meeting_zeitstempel` verlangt zu jedem
		// Zustand die passenden Marken — «freigegeben» ohne Freigabezeitpunkt gibt
		// es nicht, und das ist richtig so.
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}
		`);

		const u = await holeUebersicht(betreiber, '2026-07-30');
		expect(u.ueberfaellig.map((z) => z.id)).not.toContain(v);
		expect(u.anstehend.map((z) => z.id)).toContain(v);
	});

	it('zählt nicht über Kreuz, wenn mehrere Traktanden und mehrere Zugänge bestehen', async () => {
		// Der Test, für den die Unterabfragen da sind: Ein Verbund über beide
		// Tabellen ergäbe 3 × 2 = 6 Traktanden und ebenso viele Zugänge.
		const g = await gemeinschaft(betreiber, 'Kreuzweg 4');
		const v = await versammlung(betreiber, g, '2027-03-01');
		await imKontext(betreiber, (tx) => tx`DELETE FROM agenda_item WHERE meeting_id = ${v}`);
		for (const t of ['Antrag A', 'Antrag B', 'Antrag C']) await antrag(betreiber, v, t);
		await gibVersammlungFrei(handelnder(betreiber), v);
		await erzeugeZugaenge(handelnder(betreiber), v);

		const vorbereitung = await holeVorbereitung(betreiber, v);
		expect(vorbereitung?.schritte.find((s) => s.kennung === 'traktanden')?.stand).toBe(
			'3 Traktanden'
		);
		expect(vorbereitung?.schritte.find((s) => s.kennung === 'zugaenge')?.stand).toBe(
			'2 Zugänge erzeugt'
		);
	});
});

describe('Offene Punkte', () => {
	it('meldet den unausgeglichenen Wertquotensaldo mit der Abweichung', async () => {
		const g = await gemeinschaft(betreiber, 'Schiefweg 5');
		await versammlung(betreiber, g, '2027-05-01');
		await imKontext(betreiber, (tx) => tx`
			UPDATE unit_quota SET value = 400
			WHERE unit_id IN (SELECT id FROM unit WHERE stweg_id = ${g} ORDER BY label LIMIT 1)
			  AND quota_kind_id IN (SELECT id FROM quota_kind WHERE key = 'stamm')
		`);

		const u = await holeUebersicht(betreiber, '2027-01-01');
		const p = u.punkte.find((x) => x.kennung === 'quotensaldo' && x.bezug === 'Schiefweg 5');
		expect(p?.stufe).toBe('hindernis');
		expect(p?.text).toContain('es fehlen 100');
	});

	it('meldet die freigegebene Versammlung ohne Zugänge', async () => {
		const g = await gemeinschaft(betreiber, 'Ohnezugangweg 6');
		const v = await versammlung(betreiber, g, '2027-06-01');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);

		const u = await holeUebersicht(betreiber, '2027-01-01');
		expect(u.punkte.some((p) => p.kennung === 'ohne_zugaenge' && p.pfad.includes(v))).toBe(true);
	});

	it('schweigt, sobald die Zugänge erzeugt sind', async () => {
		const g = await gemeinschaft(betreiber, 'Mitzugangweg 7');
		const v = await versammlung(betreiber, g, '2027-07-01');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);
		await erzeugeZugaenge(handelnder(betreiber), v);

		const u = await holeUebersicht(betreiber, '2027-01-01');
		expect(u.punkte.some((p) => p.kennung === 'ohne_zugaenge' && p.pfad.includes(v))).toBe(false);
	});

	it('meldet Anträge ohne Mehrheitserfordernis', async () => {
		const g = await gemeinschaft(betreiber, 'Ohneerfordernisweg 8');
		const v = await versammlung(betreiber, g, '2027-08-01');
		await imKontext(betreiber, (tx) => tx`DELETE FROM agenda_item WHERE meeting_id = ${v}`);
		await antrag(betreiber, v, 'Antrag ohne Erfordernis');

		const u = await holeUebersicht(betreiber, '2027-01-01');
		const p = u.punkte.find((x) => x.kennung === 'ohne_erfordernis' && x.pfad.includes(v));
		expect(p?.text).toContain('Ein Antrag hat');
	});

	it('zählt Kenntnisnahmen nicht als Antrag ohne Erfordernis', async () => {
		// Eine Kenntnisnahme braucht keines — sie mitzuzählen ergäbe einen Punkt,
		// der sich nicht erledigen lässt.
		const g = await gemeinschaft(betreiber, 'Kenntnisweg 9');
		const v = await versammlung(betreiber, g, '2027-09-01');
		await imKontext(betreiber, (tx) => tx`DELETE FROM agenda_item WHERE meeting_id = ${v}`);
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v,
			titel: 'Bericht der Bewirtschaftung',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});

		const u = await holeUebersicht(betreiber, '2027-01-01');
		expect(u.punkte.some((p) => p.kennung === 'ohne_erfordernis' && p.pfad.includes(v))).toBe(
			false
		);
	});

	it('meldet die geschlossene Versammlung ohne Auswertung', async () => {
		const g = await gemeinschaft(betreiber, 'Schlussweg 10');
		const v = await versammlung(betreiber, g, '2026-02-01');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', opened_at = now(), closed_at = now()
			WHERE id = ${v}
		`);

		const u = await holeUebersicht(betreiber, '2026-07-30');
		expect(u.punkte.some((p) => p.kennung === 'ohne_auswertung' && p.pfad.includes(v))).toBe(true);
		// Und sie steht unter «abgeschlossen», nicht unter «steht an».
		expect(u.abgeschlossen.map((z) => z.id)).toContain(v);
	});

	it('meldet den ausstehenden Zeitstempel des versiegelten Pakets', async () => {
		// **Warum das hierher gehört und nicht nur auf die Siegelseite:** Die
		// ruft nach dem Abschluss niemand mehr auf. Stünde die Lücke allein dort,
		// bliebe sie für immer offen.
		const g = await gemeinschaft(betreiber, 'Stempelweg 12');
		const v = await versammlung(betreiber, g, '2026-04-01');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'versiegelt', opened_at = now(), closed_at = now()
			WHERE id = ${v}
		`);
		await imKontext(betreiber, (tx) => tx`
			INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash, package_hash,
			                  package_bytes, timestamp_state)
			VALUES (${betreiber}, ${v}, '{}', repeat('a', 64), repeat('b', 64), 1234, 'ausstehend')
		`);

		const u = await holeUebersicht(betreiber, '2026-07-30');
		const punkt = u.punkte.find((p) => p.kennung === 'zeitstempel_offen' && p.pfad.includes(v));
		expect(punkt).toBeDefined();
		// Kein Hindernis: Das Siegel gilt auch ohne Bezeugung von aussen.
		expect(punkt!.stufe).toBe('aufgabe');

		// Und er verschwindet, sobald der Stempel da ist.
		await imKontext(betreiber, (tx) => tx`
			UPDATE seal SET timestamp_state = 'vorhanden', timestamp_at = now(),
			                timestamp_hash = repeat('c', 64)
			WHERE meeting_id = ${v}
		`);
		const nachher = await holeUebersicht(betreiber, '2026-07-30');
		expect(nachher.punkte.some((p) => p.kennung === 'zeitstempel_offen')).toBe(false);
	});

	it('schweigt, sobald die Auswertung erzeugt wurde', async () => {
		const g = await gemeinschaft(betreiber, 'Ausgewertetweg 11');
		const v = await versammlung(betreiber, g, '2026-03-01');
		await antrag(betreiber, v, 'Ein Antrag');
		await gibVersammlungFrei(handelnder(betreiber), v);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', opened_at = now(), closed_at = now()
			WHERE id = ${v}
		`);
		await imKontext(betreiber, (tx) => tx`
			INSERT INTO audit_entry (operator_id, actor_label, event_type, subject_type, subject_id)
			VALUES (${betreiber}, 'Prüflauf', 'meeting.summary.created', 'meeting', ${v})
		`);

		const u = await holeUebersicht(betreiber, '2026-07-30');
		expect(u.punkte.some((p) => p.kennung === 'ohne_auswertung' && p.pfad.includes(v))).toBe(false);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber nichts von alledem', async () => {
		const g = await gemeinschaft(betreiber, 'Fremdweg 12');
		const v = await versammlung(betreiber, g, '2027-12-01');

		const u = await holeUebersicht(betreiberB, '2027-01-01');
		expect(u.anstehend.map((z) => z.id)).not.toContain(v);
		expect(u.punkte.some((p) => p.pfad.includes(v))).toBe(false);
		expect(await holeVorbereitung(betreiberB, v)).toBeNull();
	});
});
