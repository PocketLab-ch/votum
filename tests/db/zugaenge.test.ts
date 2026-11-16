/**
 * Story 3.7 — Zugänge in der Datenbank.
 *
 * Die wichtigste Zusage steht im ersten Abschnitt: In der Datenbank findet sich
 * kein Code, sondern nur sein Prüfwert (NFR-5). Alles Übrige folgt daraus —
 * insbesondere, dass eine Karte nicht noch einmal erzeugt, sondern nur ersetzt
 * werden kann.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import {
	entwerteZugaenge,
	erzeugeZugaenge,
	holeZugangsuebersicht,
	pruefwert
} from '$lib/server/zugaenge';
import { normalisiere, pruefeCode } from '$lib/domain/zugang';
import { erzeugeZugangskarte, erzeugeZugangskarten } from '$lib/server/pdf/zugangskarte';
import { PDFDocument } from 'pdf-lib';
import { textVonSeite, zeilenVonSeite } from './pdftext';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function freigegebeneVersammlung(operatorId: string, name: string) {
	const g = await erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e1 = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 600 },
		countsAsHead: true
	});
	const e2 = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 2',
		quotas: { stamm: 400 },
		countsAsHead: true
	});
	const p1 = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	const p2 = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Erbengemeinschaft Kunz',
		isCommunity: true,
		representativeName: 'Karl Kunz'
	});
	await ordneEigentumZu(handelnder(operatorId), e1.id, p1.id, '2020-01-01');
	await ordneEigentumZu(handelnder(operatorId), e2.id, p2.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId: g.id,
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await erstelleTraktandum(handelnder(operatorId), {
		meetingId: v.id,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await gibVersammlungFrei(handelnder(operatorId), v.id);
	return v.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zugang A');
	betreiberB = await pruefbetreiber('Zugang B');
});

afterAll(verbindungenSchliessen);

describe('In der Datenbank steht kein Code (NFR-5)', () => {
	it('speichert nur den Prüfwert', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 1');
		const erzeugte = await erzeugeZugaenge(handelnder(betreiber), v);
		expect(erzeugte).toHaveLength(2);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ code_hash: string }[]>`
			SELECT code_hash FROM meeting_access WHERE meeting_id = ${v}
		`);

		for (const e of erzeugte) {
			// Der Prüfwert steht da, der Code nirgends.
			expect(zeilen.map((z) => z.code_hash)).toContain(pruefwert(e.code));
			expect(zeilen.map((z) => z.code_hash)).not.toContain(e.code);
		}
	});

	it('findet den Code in keiner Spalte der Tabelle wieder', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 2');
		const [erster] = await erzeugeZugaenge(handelnder(betreiber), v);

		const alles = await imKontext(betreiber, (tx) => tx<{ zeile: string }[]>`
			SELECT meeting_access::text AS zeile FROM meeting_access WHERE meeting_id = ${v}
		`);
		for (const z of alles) {
			expect(z.zeile).not.toContain(erster.code);
		}
	});

	it('schreibt den Code auch nicht in den Verlauf', async () => {
		// Der Verlauf ist für Auswertung und Beleg gedacht, nicht als zweiter
		// Speicher für Geheimnisse.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 3');
		const [erster] = await erzeugeZugaenge(handelnder(betreiber), v);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: string }[]>`
			SELECT detail::text AS detail FROM audit_entry WHERE subject_id = ${v}
		`);
		for (const z of zeilen) {
			expect(z.detail).not.toContain(erster.code);
		}
	});

	it('liefert einen Code, der die Gestaltprüfung des Kerns besteht', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 4');
		for (const e of await erzeugeZugaenge(handelnder(betreiber), v)) {
			expect(() => pruefeCode(e.code)).not.toThrow();
		}
	});

	it('erzeugt für zwei Parteien zwei verschiedene Codes', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 5');
		const erzeugte = await erzeugeZugaenge(handelnder(betreiber), v);
		expect(new Set(erzeugte.map((e) => e.code)).size).toBe(erzeugte.length);
	});
});

describe('Ersetzen statt Wiederholen', () => {
	it('erzeugt beim zweiten Aufruf ohne Auswahl nichts Neues', async () => {
		// Sonst machte ein zweiter Klick alle bisherigen Karten ungültig — was
		// niemand erwartet und was erst auffiele, wenn im Saal die Hälfte nicht
		// hereinkommt.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 6');
		await erzeugeZugaenge(handelnder(betreiber), v);
		expect(await erzeugeZugaenge(handelnder(betreiber), v)).toHaveLength(0);
	});

	it('macht bei ausdrücklicher Auswahl den alten Zugang ungültig', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 7');
		const [erster] = await erzeugeZugaenge(handelnder(betreiber), v);

		const [neuer] = await erzeugeZugaenge(handelnder(betreiber), v, [erster.snapshotPartyId]);
		expect(neuer.ersetzt).toBe(true);
		expect(neuer.code).not.toBe(erster.code);

		const zeilen = await imKontext(betreiber, (tx) => tx<{ state: string; code_hash: string }[]>`
			SELECT state, code_hash FROM meeting_access
			WHERE snapshot_party_id = ${erster.snapshotPartyId}
		`);
		expect(zeilen.find((z) => z.code_hash === pruefwert(erster.code))?.state).toBe('ersetzt');
		expect(zeilen.find((z) => z.code_hash === pruefwert(neuer.code))?.state).toBe('gueltig');
	});

	it('lässt nie zwei gültige Zugänge zur selben Partei zu', async () => {
		// Zwei gültige wären zwei Stimmrechte für dieselbe Person.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 8');
		const [erster] = await erzeugeZugaenge(handelnder(betreiber), v);
		await erzeugeZugaenge(handelnder(betreiber), v, [erster.snapshotPartyId]);

		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE meeting_access SET state = 'gueltig'
				WHERE snapshot_party_id = ${erster.snapshotPartyId} AND state = 'ersetzt'
			`)
		).rejects.toThrow(/access_ein_gueltiger/);
	});

	it('zählt in der Übersicht, wie oft ersetzt wurde', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 9');
		const [erster] = await erzeugeZugaenge(handelnder(betreiber), v);
		await erzeugeZugaenge(handelnder(betreiber), v, [erster.snapshotPartyId]);

		const u = await holeZugangsuebersicht(betreiber, v);
		expect(u.find((x) => x.snapshotPartyId === erster.snapshotPartyId)?.anzahl).toBe(2);
	});
});

describe('Unveränderlichkeit', () => {
	it('lässt den Prüfwert nicht austauschen', async () => {
		// Sonst könnte jemand einen fremden Zugang auf seinen eigenen Code
		// umschreiben.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 10');
		await erzeugeZugaenge(handelnder(betreiber), v);
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE meeting_access SET code_hash = ${'0'.repeat(64)} WHERE meeting_id = ${v}
			`)
		).rejects.toThrow(/unveränderlich/);
	});

	it('lässt einen Zugang nicht löschen', async () => {
		// Ein gelöschter liesse sich später nicht von einem nie erzeugten
		// unterscheiden — und im Streitfall ist genau das die Frage.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 11');
		await erzeugeZugaenge(handelnder(betreiber), v);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM meeting_access WHERE meeting_id = ${v}`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Zustand der Versammlung', () => {
	it('erzeugt vor der Freigabe keinen Zugang', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Entwurfweg 12',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-09-15',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await expect(erzeugeZugaenge(handelnder(betreiber), v.id)).rejects.toThrow(/Freigabe/);
	});

	it('erzeugt nach dem Schliessen keinen mehr', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 13');
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', opened_at = now(), closed_at = now()
			WHERE id = ${v}
		`);
		await expect(erzeugeZugaenge(handelnder(betreiber), v)).rejects.toThrow(/geschlossen/);
	});

	it('entwertet alle Zugänge auf einmal', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 14');
		await erzeugeZugaenge(handelnder(betreiber), v);
		expect(await entwerteZugaenge(handelnder(betreiber), v)).toBe(2);
		expect((await holeZugangsuebersicht(betreiber, v)).every((u) => u.zustand === null)).toBe(true);
	});

	it('verwirft die Zugänge mit der Rücknahme der Freigabe', async () => {
		// Sie hängen an der Momentaufnahme; wird diese verworfen, gehen sie mit.
		// Ein Zugang zu einem Stimmberechtigtenstand, den es nicht mehr gibt,
		// wäre ein Zutritt ohne Grundlage.
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 15');
		await erzeugeZugaenge(handelnder(betreiber), v);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), v);

		const zeilen = await imKontext(betreiber, (tx) => tx`
			SELECT id FROM meeting_access WHERE meeting_id = ${v}
		`);
		expect(zeilen).toHaveLength(0);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem fremden Betreiber keine Zugänge', async () => {
		const v = await freigegebeneVersammlung(betreiber, 'Zugangsweg 16');
		await erzeugeZugaenge(handelnder(betreiber), v);
		expect(await holeZugangsuebersicht(betreiberB, v)).toHaveLength(0);
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM meeting_access`)).toHaveLength(0);
	});
});

describe('Die Karte als PDF', () => {
	const rahmen = {
		gemeinschaftName: 'Sonnenhalde 12',
		gemeinschaftAdresse: 'Sonnenhalde 12, 3600 Thun',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		gesamtquote: 1000,
		zaehlweise: 'per_owner' as const,
		betriebsart: 'gefuehrt' as const
	};

	it('erzeugt eine einseitige Karte mit QR-Code', async () => {
		const bytes = await erzeugeZugangskarte(rahmen, {
			name: 'Anna Muster',
			ausgeuebtDurch: 'Anna Muster',
			istGemeinschaftlich: false,
			einheiten: [{ label: 'Whg 1', quote: 600, traegtKopfstimme: true }],
			kopfstimmen: 1,
			wertquote: 600,
			code: 'ABCDEFGHJKMNPQRSTWXY',
			link: 'https://x.ch/z/ABCDEFGHJKMNPQRSTWXY'
		});
		const d = await PDFDocument.load(bytes);
		expect(d.getPageCount()).toBe(1);
	});

	it('erzeugt eine Seite je Person', async () => {
		const bytes = await erzeugeZugangskarten(rahmen, [
			{
				name: 'Anna Muster',
				ausgeuebtDurch: 'Anna Muster',
				istGemeinschaftlich: false,
				einheiten: [{ label: 'Whg 1', quote: 600, traegtKopfstimme: true }],
				kopfstimmen: 1,
				wertquote: 600,
				code: 'ABCDEFGHJKMNPQRSTWXY',
				link: 'https://x.ch/z/A'
			},
			{
				name: 'Erbengemeinschaft Kunz',
				ausgeuebtDurch: 'Karl Kunz',
				istGemeinschaftlich: true,
				einheiten: [{ label: 'Whg 2', quote: 400, traegtKopfstimme: true }],
				kopfstimmen: 1,
				wertquote: 400,
				code: 'ZYXWTSRQPNMKJHGFEDCB',
				link: 'https://x.ch/z/B'
			}
		]);
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
	});

	it('erzeugt auch ohne Karten eine Seite', async () => {
		// Ein PDF ohne Seiten lässt sich von keinem Betrachter öffnen.
		expect((await PDFDocument.load(await erzeugeZugangskarten(rahmen, []))).getPageCount()).toBe(1);
	});

	it('setzt einen Namen mit diakritischen Zeichen', async () => {
		const bytes = await erzeugeZugangskarte(rahmen, {
			name: 'Familie Petrović-Łukasik',
			ausgeuebtDurch: 'Šefik Petrović',
			istGemeinschaftlich: true,
			einheiten: [{ label: 'Whg 3', quote: 1000, traegtKopfstimme: true }],
			kopfstimmen: 1,
			wertquote: 1000,
			code: 'ABCDEFGHJKMNPQRSTWXY',
			link: 'https://x.ch/z/ABCDEFGHJKMNPQRSTWXY'
		});
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});
});

/**
 * Was auf der Karte steht — am erzeugten PDF gelesen, nicht am Quelltext.
 *
 * **Der Anlass** (27.08.2026, Einwand des Auftraggebers): Unter dem Namen der Zeile stand
 * «Die Stimme übt aus: Anna Muster». Drei Einwände, alle zutreffend: Der Einlass
 * prüft die Karte und nicht die Person; kommt Beat statt Anna, ist das zulässig
 * (Wermelinger, Rz. 19 ad Art. 712o), und der Zettel wies ihn ab; und ein Name
 * in Fettschrift neben einem im Kleingedruckten behauptet eine Rangordnung, die
 * Art. 712o nicht kennt.
 *
 * Geprüft wird deshalb der **Text**, nicht die Seitenzahl. Eine Zeile, die aus
 * dem Satzcode verschwindet, fiele sonst erst dem Eigentümer im Briefkasten auf.
 */
describe('Was auf der Karte steht', () => {
	const rahmen = {
		gemeinschaftName: 'Sonnenhalde 12',
		gemeinschaftAdresse: 'Sonnenhalde 12, 3600 Thun',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		gesamtquote: 1000,
		zaehlweise: 'per_owner' as const,
		betriebsart: 'gefuehrt' as const
	};

	function inhalt(u: Partial<Parameters<typeof erzeugeZugangskarte>[1]> = {}) {
		return {
			name: 'Anna Muster und Beat Muster',
			ausgeuebtDurch: 'Anna Muster',
			istGemeinschaftlich: true,
			einheiten: [{ label: 'Whg 1', quote: 250, traegtKopfstimme: true }],
			kopfstimmen: 1,
			wertquote: 250,
			code: 'ABCDEFGHJKMNPQRSTWXY',
			link: 'https://x.ch/z/ABCDEFGHJKMNPQRSTWXY',
			...u
		};
	}

	it('liest den gezeichneten Text überhaupt zurück', async () => {
		// Die Sichtprobe zum Leser selbst: Fände er nichts, wären alle Prüfungen
		// darunter grün, weil sie in einer leeren Zeichenkette nichts finden.
		const zeilen = await zeilenVonSeite(await erzeugeZugangskarte(rahmen, inhalt()));
		expect(zeilen).toContain('Persönliche Zugangskarte');
		expect(zeilen).toContain('Anna Muster und Beat Muster');
	});

	it('nennt keinen Namen mehr als den der Zeile', async () => {
		const text = await textVonSeite(await erzeugeZugangskarte(rahmen, inhalt()));
		expect(text).not.toContain('Die Stimme übt aus');
		// Und auch nicht bloss ohne die Beschriftung: Der Name der einzelnen
		// Person darf nirgends allein auf dem Blatt stehen.
		expect(text.replace('Anna Muster und Beat Muster', '')).not.toContain('Anna Muster');
	});

	it('sagt bei gemeinschaftlichem Eigentum, wieso es eine Stimme ist', async () => {
		const text = await textVonSeite(await erzeugeZugangskarte(rahmen, inhalt()));
		expect(text).toContain('Eine Stimme für diese Einheit. Eine Person gibt sie ab.');
	});

	it('sagt es auch, wenn niemand als Vertretung bezeichnet ist', async () => {
		/*
		 * **Der Fall, an dem der alte Vergleich scheiterte.** Bis zum 27.08.2026
		 * hing die Zeile an `ausgeuebtDurch !== name`. Seit die Bezeichnung der
		 * Vertretung freiwillig ist, sind beide gleich, sobald niemand bezeichnet
		 * wurde — und der Satz verschwände genau dort, wo er gebraucht wird.
		 */
		const text = await textVonSeite(
			await erzeugeZugangskarte(
				rahmen,
				inhalt({ ausgeuebtDurch: 'Anna Muster und Beat Muster' })
			)
		);
		expect(text).toContain('Eine Stimme für diese Einheit.');
	});

	it('lässt den Satz beim Alleineigentümer weg', async () => {
		const text = await textVonSeite(
			await erzeugeZugangskarte(
				rahmen,
				inhalt({ name: 'Anna Muster', ausgeuebtDurch: 'Anna Muster', istGemeinschaftlich: false })
			)
		);
		expect(text).not.toContain('Eine Stimme für diese Einheit');
	});

	it('behält Name, Einheit und die Rechnung', async () => {
		// Was den Aufdruck ersetzt: Zwei Namen und eine Kopfstimme sagen die
		// Sache bereits.
		const text = await textVonSeite(await erzeugeZugangskarte(rahmen, inhalt()));
		expect(text).toContain('Anna Muster und Beat Muster');
		expect(text).toContain('Whg 1');
		expect(text).toContain('250 / 1000');
		expect(text).toContain('1 Kopfstimme · 250 von 1000 Wertquoten');
	});

	it('trägt die Folge der Uneinigkeit nicht auf den Zettel', async () => {
		// Sie steht in der Einladung (`gemeinschaftssatz`): Die Karte gehört einer
		// Einheit und wird von allen Beteiligten gelesen.
		const text = await textVonSeite(await erzeugeZugangskarte(rahmen, inhalt()));
		// «ungültig» allein taugt nicht als Suchwort: Der Zettel sagt weiter unten,
		// dass eine ersetzte Karte ungültig wird. Gesucht ist die Rechtsfolge.
		expect(text).not.toMatch(/Stimme (ist )?ungültig/);
		expect(text).not.toContain('Enthaltung');
		expect(text).not.toContain('uneinig');
	});
});

describe('Prüfwert', () => {
	it('ist unabhängig von der Schreibweise des Codes', async () => {
		const code = 'ABCDEFGHJKMNPQRSTWXY';
		expect(pruefwert(code)).toBe(pruefwert('abcd-efgh-jkmn-pqrs-twxy'));
		expect(pruefwert(code)).toBe(pruefwert(normalisiere(' abcd efgh jkmn pqrs twxy ')));
	});

	it('unterscheidet zwei Codes', () => {
		expect(pruefwert('ABCDEFGHJKMNPQRSTWXY')).not.toBe(pruefwert('ABCDEFGHJKMNPQRSTWXZ'));
	});
});
