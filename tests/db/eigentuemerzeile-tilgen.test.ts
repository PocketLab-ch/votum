/**
 * Zwei Wege, die Prüflauf II erzwungen hat (23.08.2026).
 *
 * **Der Befund:** Haus B führte sechzehn Eigentümerzeilen für vierzehn
 * Einheiten. Zwei davon waren Karteileichen — entstanden, weil die Übernahme
 * aus der Tabelle eine Zeile ohne Person anlegt und die Personenseite danach
 * eine **zweite** desselben Namens erzeugte. Wegräumen liess sich keine.
 *
 * Beide Hälften stehen hier: dass die Doppelung gar nicht mehr entsteht, und
 * dass sich tilgen lässt, was schon dasteht — aber nur das, was wirklich leer
 * ist.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	entferneEigentuemer,
	erstelleEigentuemer,
	ordneEigentumZu
} from '$lib/server/eigentuemer';
import { erstellePerson, ordneEinheitZuPerson, verknuepfePartei } from '$lib/server/personen';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let stweg: string;
let einheit: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zeilen tilgen');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'STWEG Karteileiche',
		quotaDenominator: 1000,
		headCountMode: 'per_unit',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: stweg,
		label: 'A 1.1',
		kind: 'unit',
		countsAsHead: true,
		quotas: { stamm: 500 }
	});
	einheit = e.id;
});

afterAll(verbindungenSchliessen);

describe('Die Doppelung entsteht nicht mehr', () => {
	it('weist eine namensgleiche, unverknüpfte Zeile ab, statt eine zweite anzulegen', async () => {
		// Die Ausgangslage der Übernahme: eine Zeile ohne Person.
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			displayName: 'Katharina Zbinden',
			kind: 'natural',
			isCommunity: false,
			representativeName: null
		});
		const person = await erstellePerson(handelnder(betreiber), {
			name: 'Katharina Zbinden',
			art: 'natural'
		});

		await expect(
			ordneEinheitZuPerson(handelnder(betreiber), person.id, einheit, '2026-01-01')
		).rejects.toThrow(FachlicherFehler);

		const zeilen = await imKontext(betreiber, (tx) =>
			tx`SELECT id FROM party WHERE stweg_id = ${stweg} AND display_name = 'Katharina Zbinden'`
		);
		expect(zeilen.length, 'es bleibt bei einer Zeile').toBe(1);
	});

	it('legt nach dem Verknüpfen normal zu — der Weg ist nicht versperrt, nur umgeleitet', async () => {
		const [zeile] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`
				SELECT id FROM party WHERE stweg_id = ${stweg} AND display_name = 'Katharina Zbinden'
			`
		);
		const [person] = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM person WHERE display_name = 'Katharina Zbinden'`
		);
		await verknuepfePartei(handelnder(betreiber), zeile.id, person.id);

		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			person.id,
			einheit,
			'2026-01-01'
		);
		expect(ergebnis.parteiId).toBe(zeile.id);
		expect(ergebnis.neuAngelegt).toBe(false);
	});
});

describe('Eine leere Zeile tilgen', () => {
	async function leereZeile(name: string): Promise<string> {
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: stweg,
			displayName: name,
			kind: 'natural',
			isCommunity: false,
			representativeName: null
		});
		return p.id;
	}

	it('tilgt eine Zeile, die nichts hält und nirgends steht', async () => {
		const id = await leereZeile('Margrit Grossenbacher-Zulauf');
		const { name } = await entferneEigentuemer(handelnder(betreiber), id);
		expect(name).toBe('Margrit Grossenbacher-Zulauf');

		const rest = await imKontext(betreiber, (tx) => tx`SELECT id FROM party WHERE id = ${id}`);
		expect(rest.length).toBe(0);
	});

	it('vermerkt die Tilgung im Verlauf — die Zeile verschwindet, ihre Spur nicht', async () => {
		const id = await leereZeile('Fritz Kobel');
		await entferneEigentuemer(handelnder(betreiber), id);
		const spur = await imKontext(betreiber, (tx) =>
			tx<{ art: string }[]>`
				SELECT event_type AS art FROM audit_entry WHERE subject_id = ${id}::text
				  AND event_type = 'party.deleted'
			`
		);
		expect(spur.length, 'party.deleted steht im Verlauf').toBe(1);
	});

	it('weist eine Zeile ab, die eine Einheit hält — auch eine beendete Zuordnung zählt', async () => {
		const id = await leereZeile('Erwin Balmer');
		const zweite = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			label: 'A 2.1',
			kind: 'unit',
			countsAsHead: true,
			quotas: { stamm: 500 }
		});
		await ordneEigentumZu(handelnder(betreiber), zweite.id, id, '2026-01-01');
		await imKontext(betreiber, (tx) =>
			tx`UPDATE unit_ownership SET valid_to = '2026-06-01' WHERE party_id = ${id}`
		);
		await expect(entferneEigentuemer(handelnder(betreiber), id)).rejects.toThrow(
			/zugeordnet/
		);
	});

	it('tilgt auch eine Zeile, die zu einer Person gehört — die Person bleibt', async () => {
		/*
		 * Eine frühere Fassung sperrte das. Der reguläre Weg «Eigentümer
		 * erfassen» legt Person und Zeile aber in einem Zug an — der Knopf wäre
		 * damit ausgerechnet für den versehentlich angelegten Eigentümer nicht da
		 * gewesen. Getilgt wird nur die Zeile in dieser Gemeinschaft.
		 */
		const id = await leereZeile('Roland Zaugg');
		const person = await erstellePerson(handelnder(betreiber), {
			name: 'Roland Zaugg',
			art: 'natural'
		});
		await verknuepfePartei(handelnder(betreiber), id, person.id);

		await entferneEigentuemer(handelnder(betreiber), id);

		const nochDa = await imKontext(betreiber, (tx) =>
			tx`SELECT id FROM person WHERE id = ${person.id}`
		);
		expect(nochDa.length, 'die Person bleibt erfasst').toBe(1);
	});

	it('weist eine unbekannte Kennung ab', async () => {
		await expect(
			entferneEigentuemer(handelnder(betreiber), '00000000-0000-7000-8000-000000000000')
		).rejects.toThrow(/gibt es nicht/);
	});
});

/**
 * **Der Klassen-Wächter.** `entferneEigentuemer` prüft von Hand, was die
 * Datenbank nicht prüft — und weiss dafür, welche Tabellen auf eine Partei
 * zeigen. Kommt eine neue dazu, ohne dass jemand die Funktion nachzieht,
 * löschte sie stillschweigend etwas weg, woran noch etwas hängt.
 *
 * Der Test liest die Fremdschlüssel aus dem Katalog statt aus einer gepflegten
 * Liste: Genau das ist der Unterschied zwischen «die Instanz gefixt» und «die
 * Klasse geschlossen».
 */
describe('kennt jede Tabelle, die auf eine Partei zeigt', () => {
	it('keine unbekannte Bindung an party', async () => {
		/*
		 * Über `pg_constraint`, nicht über `information_schema`: Dessen
		 * `constraint_column_usage` listet bei einem zusammengesetzten
		 * Fremdschlüssel **alle** beteiligten Spalten, und der Join kreuzt sie
		 * dann. Der erste Anlauf meldete deshalb `unit_ownership.stweg_id` als
		 * Bindung an `party.id` — sie zeigt in Wahrheit auf `stweg`. Hier wird
		 * die Position im Schlüssel mitgeführt, damit Quell- und Zielspalte
		 * wirklich zueinander gehören.
		 */
		const zeilen = await admin<{ tabelle: string; spalte: string }[]>`
			SELECT c.conrelid::regclass::text AS tabelle, a.attname AS spalte
			  FROM pg_constraint c
			  JOIN unnest(c.conkey) WITH ORDINALITY AS q(attnum, pos) ON true
			  JOIN unnest(c.confkey) WITH ORDINALITY AS z(attnum, pos) ON z.pos = q.pos
			  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = q.attnum
			  JOIN pg_attribute za ON za.attrelid = c.confrelid AND za.attnum = z.attnum
			 WHERE c.contype = 'f'
			   AND c.confrelid = 'party'::regclass
			   AND za.attname = 'id'
			 GROUP BY 1, 2
		`;

		/*
		 * Was `entferneEigentuemer` selbst prüft oder bewusst durchgehen lässt.
		 * `representation` fällt per CASCADE mit — eine Vertretung ohne die
		 * vertretene Zeile ist gegenstandslos.
		 *
		 * **Die drei aus Migration 094.** Zwei davon werden geprüft, nicht
		 * durchgelassen: `party_member.mitglied_party_id` (sonst verschwände ein
		 * Miteigentümer samt seinem Anspruch auf eine eigene Einladung nach ZGB
		 * Art. 712n) und `party.representative_party_id` (sonst fiele der Verweis
		 * auf die Zeile, die nach ZGB Art. 712o Abs. 1 die eine Stimme abgibt,
		 * still auf NULL zurück). Beide Absagen stehen in `pruefeZeileTilgbar`
		 * und sind in `tests/db/mitberechtigte.test.ts` festgehalten.
		 *
		 * Nur `party_member.huelle_party_id` läuft bewusst mit: Fällt die Hülle,
		 * sind ihre Mitgliedschaften gegenstandslos — CASCADE, wie bei
		 * `representation`.
		 */
		const bekannt = new Set([
			'unit_ownership.party_id',
			'instruction.party_id',
			'agenda_item.proposer_party_id',
			'agenda_item_proposer.party_id',
			'agenda_item_affected.party_id',
			'representation.party_id',
			'party_member.mitglied_party_id',
			'party_member.huelle_party_id',
			'party.representative_party_id'
		]);
		const unbekannt = zeilen
			.map((z) => `${z.tabelle}.${z.spalte}`)
			.filter((s) => !bekannt.has(s));

		expect(
			unbekannt,
			'Neue Bindung an party — entferneEigentuemer muss sie prüfen, sonst tilgt sie darüber hinweg'
		).toEqual([]);

		// Sichtprobe: Die Abfrage trifft überhaupt etwas. Ein Filter, der null
		// Zeilen liest, wäre immer grün.
		expect(zeilen.length, 'die Katalogabfrage findet Bindungen').toBeGreaterThan(3);
	});

	it('erkennt eine neu hinzugekommene Bindung', async () => {
		await admin`
			CREATE TABLE pruef_bindung (
				id uuid PRIMARY KEY DEFAULT uuidv7(),
				party_id uuid NOT NULL REFERENCES party (id)
			)
		`;
		try {
			const zeilen = await admin<{ tabelle: string }[]>`
				SELECT c.conrelid::regclass::text AS tabelle
				  FROM pg_constraint c
				  JOIN unnest(c.conkey) WITH ORDINALITY AS q(attnum, pos) ON true
				  JOIN unnest(c.confkey) WITH ORDINALITY AS z(attnum, pos) ON z.pos = q.pos
				  JOIN pg_attribute za ON za.attrelid = c.confrelid AND za.attnum = z.attnum
				 WHERE c.contype = 'f' AND c.confrelid = 'party'::regclass
				   AND za.attname = 'id'
				   AND c.conrelid = 'pruef_bindung'::regclass
			`;
			expect(zeilen.length, 'der Wächter sieht die neue Tabelle').toBe(1);
		} finally {
			await admin`DROP TABLE pruef_bindung`;
		}
	});
});
