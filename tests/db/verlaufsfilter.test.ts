/**
 * Die Filter des Verlaufs — geprüft gegen die Datenbank, nicht gegen einen Mock.
 *
 * Sie stehen als SQL in `verlaufsabfrage.ts`: Suchmuster mit Fluchtzeichen,
 * `split_part` für den Bereich, ein Kalendertag, der in **Schweizer** Zeit
 * verstanden werden muss. Kein Test mit nachgebauten Objekten sähe davon etwas
 * — er prüfte die Nachbildung, nicht die Abfrage.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { holeBereiche, leseVerlauf } from '$lib/server/verlaufsabfrage';
import { admin, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
const kennung = crypto.randomUUID();
const fremdeKennung = crypto.randomUUID();

/**
 * Die Prüfeinträge entstehen unter der privilegierten Rolle mit gesetztem
 * Zeitpunkt: `schreibeVerlauf` nimmt die Uhr, und ein Test über Zeiträume
 * braucht Zeitpunkte, die er selbst bestimmt.
 */
beforeAll(async () => {
	betreiber = await pruefbetreiber('Verlaufsfilter');

	const eintraege: [string, string, string, Record<string, unknown>, string][] = [
		['vote.round.opened', 'Renate Berger', kennung, { traktandum: '5' }, '2026-05-19 18:00+02'],
		['vote.round.closed', 'Renate Berger', kennung, { ja: 6400 }, '2026-05-19 18:20+02'],
		['meeting.created', 'Peter Bucher', kennung, { ort: 'Nirgendheim' }, '2026-05-01 09:00+02'],
		['bylaw.reviewed', 'Peter Bucher', fremdeKennung, { hinweis: '100% geprüft' }, '2026-04-30 23:30+02'],
		// Kurz nach Mitternacht Schweizer Zeit — in UTC noch der Vortag. Der
		// Tagesfilter muss diesen Eintrag dem 1. Mai zuordnen, nicht dem 30. April.
		['meeting.closed', 'Nachtsitzung', kennung, {}, '2026-05-01 00:30+02']
	];

	for (const [art, person, gegenstand, angaben, zeit] of eintraege) {
		await admin`
			INSERT INTO audit_entry (operator_id, event_type, actor_label, subject_type, subject_id,
			                         detail, occurred_at, clock_source)
			VALUES (${betreiber}, ${art}, ${person}, 'meeting', ${gegenstand},
			        ${admin.json(angaben as never)}, ${zeit}::timestamptz, 'system')
		`;
	}
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Volltextsuche', () => {
	it('findet über die handelnde Person', async () => {
		const { zeilen, gesamt } = await leseVerlauf(betreiber, { suche: 'berger' });
		expect(gesamt).toBe(2);
		expect(zeilen.every((z) => z.handelnder === 'Renate Berger')).toBe(true);
	});

	it('findet in den Angaben — dort stehen die Sachdaten', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { suche: 'nirgendheim' });
		expect(gesamt).toBe(1);
	});

	it('findet über die Kennung des Gegenstands', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { suche: fremdeKennung.slice(0, 8) });
		expect(gesamt).toBe(1);
	});

	it('behandelt das Prozentzeichen als Zeichen, nicht als Platzhalter', async () => {
		// Ohne Fluchtzeichen wäre «100%» ein Muster und träfe jede Zeile, die mit
		// «100» beginnt — hier: keine, aber die Absicht ist die Suche nach dem Text.
		const { gesamt } = await leseVerlauf(betreiber, { suche: '100%' });
		expect(gesamt).toBe(1);

		const nichts = await leseVerlauf(betreiber, { suche: '%%%' });
		expect(nichts.gesamt).toBe(0);
	});

	it('sucht ohne Rücksicht auf Gross- und Kleinschreibung', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { suche: 'RENATE' });
		expect(gesamt).toBe(2);
	});
});

describe('Bereich', () => {
	it('filtert auf den Namensteil vor dem ersten Punkt', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { bereich: 'vote' });
		expect(gesamt).toBe(2);
	});

	it('zählt nur die Bereiche, die es gibt', async () => {
		const bereiche = await holeBereiche(betreiber);
		expect(bereiche).toEqual([
			{ bereich: 'bylaw', anzahl: 1 },
			{ bereich: 'meeting', anzahl: 2 },
			{ bereich: 'vote', anzahl: 2 }
		]);
	});

	it('zählt die Bereiche innerhalb der übrigen Filter', async () => {
		const bereiche = await holeBereiche(betreiber, { suche: 'berger' });
		expect(bereiche).toEqual([{ bereich: 'vote', anzahl: 2 }]);
	});
});

describe('Zeitraum', () => {
	it('nimmt beide Grenztage mit', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { von: '2026-05-19', bis: '2026-05-19' });
		expect(gesamt).toBe(2);
	});

	it('versteht den Kalendertag in Schweizer Zeit, nicht in UTC', async () => {
		// Der Eintrag von 00:30 Uhr Schweizer Zeit liegt in UTC am 30. April.
		// Wer nach dem 1. Mai fragt, muss ihn bekommen — und wer nach dem
		// 30. April fragt, darf ihn nicht bekommen.
		const erster = await leseVerlauf(betreiber, { von: '2026-05-01', bis: '2026-05-01' });
		expect(erster.zeilen.map((z) => z.handelnder).sort()).toEqual(['Nachtsitzung', 'Peter Bucher']);

		const vortag = await leseVerlauf(betreiber, { von: '2026-04-30', bis: '2026-04-30' });
		expect(vortag.zeilen.map((z) => z.handelnder)).toEqual(['Peter Bucher']);
	});

	it('lässt eine offene Grenze offen', async () => {
		const abMai = await leseVerlauf(betreiber, { von: '2026-05-01' });
		expect(abMai.gesamt).toBe(4);
	});
});

describe('Gegenstand und Kombinationen', () => {
	it('filtert auf einen einzelnen Gegenstand', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { gegenstand: fremdeKennung });
		expect(gesamt).toBe(1);
	});

	it('verbindet die Filter mit UND', async () => {
		const { gesamt } = await leseVerlauf(betreiber, {
			bereich: 'vote',
			suche: 'berger',
			von: '2026-05-19',
			bis: '2026-05-19'
		});
		expect(gesamt).toBe(2);

		const leer = await leseVerlauf(betreiber, { bereich: 'vote', suche: 'bucher' });
		expect(leer.gesamt).toBe(0);
		expect(leer.zeilen).toEqual([]);
	});
});

describe('Die Gesamtzahl', () => {
	it('zählt alle Treffer, nicht nur die Seite', async () => {
		const { zeilen, gesamt, weitere } = await leseVerlauf(betreiber, {});
		expect(gesamt).toBe(5);
		expect(zeilen).toHaveLength(5);
		expect(weitere).toBe(false);
	});

	it('ist null, wenn nichts passt', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { suche: 'gibtesnicht' });
		expect(gesamt).toBe(0);
	});
});

/**
 * **Der Filter nach Versammlung und Gemeinschaft** (Auftraggeber, 25.08.2026: «Beim
 * Verlauf braucht es noch einen Filter nach Versammlung und nach
 * Gemeinschaft»).
 *
 * Warum das ein DB-Test sein muss: Die Zugehörigkeit steht als Menge von
 * Unterabfragen in `gehoertZu` — ein Traktandum trägt seine eigene Kennung,
 * nicht die der Versammlung. Ein Test mit nachgebauten Objekten sähe davon
 * nichts.
 */
describe('Zugehörigkeit zu Versammlung und Gemeinschaft', () => {
	const stwegA = crypto.randomUUID();
	const stwegB = crypto.randomUUID();
	const sitzungA = crypto.randomUUID();
	const sitzungB = crypto.randomUUID();
	const traktandumA = crypto.randomUUID();

	beforeAll(async () => {
		for (const [id, name] of [
			[stwegA, 'Prüf-STWEG A'],
			[stwegB, 'Prüf-STWEG B']
		]) {
			await admin`
				INSERT INTO stweg (id, operator_id, name) VALUES (${id}, ${betreiber}, ${name})
			`;
		}
		for (const [id, stweg] of [
			[sitzungA, stwegA],
			[sitzungB, stwegB]
		]) {
			await admin`
				INSERT INTO meeting (id, operator_id, stweg_id, meeting_date, start_time, location,
				                     kind, operation_mode)
				VALUES (${id}, ${betreiber}, ${stweg}, '2026-06-01', '18:00', 'Prüfsaal',
				        'ordentlich', 'gefuehrt')
			`;
		}
		await admin`
			INSERT INTO agenda_item (id, operator_id, meeting_id, position, title,
			                         item_kind, proposer_kind, motion_text)
			VALUES (${traktandumA}, ${betreiber}, ${sitzungA}, 1, 'Prüftraktandum',
			        'abstimmung', 'bewirtschaftung', 'Die Versammlung beschliesst.')
		`;

		const eintraege: [string, string, string, string][] = [
			// An der Versammlung selbst.
			['meeting.opened', 'meeting', sitzungA, 'Leitung A'],
			// Am Traktandum — trägt DESSEN Kennung, nicht die der Versammlung.
			['vote.round.opened', 'agenda_item', traktandumA, 'Leitung A'],
			// An der Gemeinschaft.
			['stweg.updated', 'stweg', stwegA, 'Bewirtschaftung'],
			// Fremde Versammlung, fremde Gemeinschaft.
			['meeting.opened', 'meeting', sitzungB, 'Leitung B']
		];
		for (const [art, typ, id, person] of eintraege) {
			await admin`
				INSERT INTO audit_entry (operator_id, event_type, actor_label, subject_type,
				                         subject_id, detail, occurred_at, clock_source)
				VALUES (${betreiber}, ${art}, ${person}, ${typ}, ${id},
				        '{}'::jsonb, '2026-06-01 18:00+02'::timestamptz, 'system')
			`;
		}
	});

	it('nimmt das Traktandum mit — nicht nur die Versammlung selbst', async () => {
		// Der Kern der Sache: Ein Filter auf `subject_id` allein fände hier EINEN
		// Eintrag. Was an der Versammlung geschah, steht am Traktandum.
		const { gesamt } = await leseVerlauf(betreiber, { versammlung: sitzungA });
		expect(gesamt).toBe(2);
	});

	it('laesst die fremde Versammlung draussen', async () => {
		const { zeilen } = await leseVerlauf(betreiber, { versammlung: sitzungA });
		expect(zeilen.every((z) => z.handelnder === 'Leitung A')).toBe(true);
	});

	it('findet ueber die Gemeinschaft alles: Gemeinschaft, Versammlung, Traktandum', async () => {
		const { gesamt } = await leseVerlauf(betreiber, { gemeinschaft: stwegA });
		expect(gesamt).toBe(3);
	});

	it('verbindet beide Filter mit UND', async () => {
		// Versammlung A liegt in Gemeinschaft A — zusammen bleiben die zwei.
		expect(
			(await leseVerlauf(betreiber, { versammlung: sitzungA, gemeinschaft: stwegA })).gesamt
		).toBe(2);
		// Versammlung A liegt NICHT in Gemeinschaft B — zusammen bleibt nichts.
		expect(
			(await leseVerlauf(betreiber, { versammlung: sitzungA, gemeinschaft: stwegB })).gesamt
		).toBe(0);
	});

	it('behandelt eine unsinnige Kennung als keinen Filter, nicht als Fehler', async () => {
		// `?versammlung=abc` landete sonst als Zeichenkette in einem `::uuid` —
		// PostgreSQL antwortet darauf mit einem Fehler, und die Seite mit 500.
		const alle = await leseVerlauf(betreiber, {});
		const mitMuell = await leseVerlauf(betreiber, { versammlung: 'abc' });
		expect(mitMuell.gesamt).toBe(alle.gesamt);
	});

	it('findet ueber den Abend alles, was in seinen Versammlungen geschah', async () => {
		/*
		 * Der Fall, für den die Leiste «Jederzeit» ihn braucht: «Verlauf dieses
		 * Abends». Am Abend selbst hängt fast nichts — das Anlegen, das Zuordnen.
		 * Was im Saal geschah, hängt an den Versammlungen und ihren Traktanden.
		 *
		 * Am Dev-Bestand nachgemessen (25.08.2026): `?gegenstand=<abend>` fand
		 * NULL Einträge, `?abend=<abend>` fand 124.
		 */
		const abend = crypto.randomUUID();
		await admin`
			INSERT INTO meeting_day (id, operator_id, label, day_date, start_time, location, kind)
			VALUES (${abend}, ${betreiber}, 'Prüfabend', '2026-06-01', '18:00', 'Prüfsaal', 'ordentlich')
		`;
		await admin`UPDATE meeting SET meeting_day_id = ${abend} WHERE id = ${sitzungA}`;

		const { gesamt } = await leseVerlauf(betreiber, { abend });
		// Die Versammlung und ihr Traktandum — nicht der Eintrag an der
		// Gemeinschaft, der gehört ihr und nicht dem Abend.
		expect(gesamt).toBe(2);

		await admin`UPDATE meeting SET meeting_day_id = NULL WHERE id = ${sitzungA}`;
		await admin`DELETE FROM meeting_day WHERE id = ${abend}`;
	});

	it('zaehlt die Bereiche mit demselben Filter', async () => {
		// Sonst stuenden in der Bereichsliste die Zahlen des GESAMTEN Verlaufs,
		// waehrend die Tabelle darunter gefiltert ist.
		const bereiche = await holeBereiche(betreiber, { versammlung: sitzungA });
		const summe = bereiche.reduce((n, b) => n + b.anzahl, 0);
		expect(summe).toBe(2);
	});
});
