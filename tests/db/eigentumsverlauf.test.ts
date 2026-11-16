/**
 * Die Eigentumshistorie, sichtbar gemacht (Auftraggeber, 01.09.2026: «eine Historie wer
 * von wann bis wann Eigentümer war»).
 *
 * **Die Tabelle gab es seit Migration 006**, die Sicht darauf nicht: `valid_from`
 * erschien in keiner einzigen Ansicht. Was hier gemessen wird, ist deshalb nicht
 * das Schreiben — das läuft seit je —, sondern dass die Lesewege die Kette
 * vollständig und in der richtigen Ordnung liefern, samt der laufenden Zeile.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import {
	erstelleEigentuemer,
	holeEigentumsverlauf,
	ordneEigentumZu
} from '$lib/server/eigentuemer';
import {
	einheitenDerPerson,
	erstellePerson,
	frueheresEigentumDerPerson,
	ordneEinheitZuPerson,
	verknuepfePartei
} from '$lib/server/personen';
import { nimmMitberechtigtenAuf } from '$lib/server/mitberechtigte';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { EREIGNISARTEN } from '$lib/domain/verlauf';

let betreiber: string;
function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Eigentumsverlauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaftMitEinheit(name: string, label: string) {
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
		label,
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	return { g, e };
}

async function person(stwegId: string, name: string) {
	return erstelleEigentuemer(handelnder(betreiber), {
		stwegId,
		kind: 'natural',
		displayName: name,
		representativeName: null,
		isCommunity: false
	});
}

/**
 * Ordnet eine Einheit über den **Personenweg** zu — dem Weg, den die
 * Personenseite geht.
 *
 * **Warum nicht über `erstelleEigentuemer` mit `personId`**: Dort wird das Feld
 * nur für Mitberechtigte ausgewertet, die Hauptzeile bleibt ohne `person_id`.
 * Die Gegenrichtung fragt aber genau danach, und der erste Anlauf dieses Tests
 * mass deshalb nichts — ein Fehler im Aufbau, nicht im Code.
 */
async function personMitEinheit(name: string, unitId: string, ab: string) {
	const mensch = await erstellePerson(handelnder(betreiber), { name });
	await ordneEinheitZuPerson(handelnder(betreiber), mensch.id, unitId, ab);
	return mensch.id;
}

describe('Die Zuordnung über den Personenweg', () => {
	/*
	 * **Der zweite Schreibweg fragt ebenso zurück** (Code-Review 06.09.2026,
	 * Befund 2 zum Block «drei Entscheide»).
	 *
	 * Die Rückfrage bei gemeinschaftlichem Eigentum entstand am Eigentümerweg.
	 * Hier führt ein zweiter Weg auf dieselbe Tabelle, und ausgerechnet den
	 * empfiehlt der Hilfetext dort. Gemessen wurde am 06.09.2026, dass ihn
	 * nichts bewachte: Mit ausgebauter Prüfung blieb der ganze Prüflauf grün.
	 */
	it('fragt zurück, wenn die Person zu einer Eigentümergemeinschaft gehört', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Hüllenweg 1', 'Whg 1');
		const eine = await person(g.id, 'Eine Beteiligte');
		const andere = await person(g.id, 'Andere Beteiligte');
		const huelle = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Eine und Andere',
			representativeName: null,
			isCommunity: true
		});
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, eine.id);
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, andere.id);

		/*
		 * Die Person hinter der Mitgliedszeile: Der Personenweg fragt nach ihr,
		 * nicht nach der Partei. Ohne diesen Umweg misst der Test nichts — genau
		 * die Falle, vor der `personMitEinheit` oben warnt.
		 */
		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Eine Beteiligte' });
		await verknuepfePartei(handelnder(betreiber), eine.id, mensch.id);

		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-01-01'
		);
		expect(ergebnis.rueckfrage).not.toBeNull();
		expect(ergebnis.rueckfrage?.teilEinerGemeinschaft).toEqual(['Eine und Andere']);
	});
});

describe('Der Eigentumsverlauf einer Gemeinschaft', () => {
	it('führt die Kette einer Einheit vollständig, älteste zuerst', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Verlaufsweg 1', 'Whg 1');
		const a = await person(g.id, 'Anna Erst');
		const b = await person(g.id, 'Bruno Zweit');
		const c = await person(g.id, 'Clara Dritt');

		await ordneEigentumZu(handelnder(betreiber), e.id, a.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), e.id, b.id, '2023-05-01');
		await ordneEigentumZu(handelnder(betreiber), e.id, c.id, '2026-03-01');

		const verlauf = await holeEigentumsverlauf(betreiber, g.id);
		expect(verlauf.map((z) => [z.eigentuemer, z.von, z.bis])).toEqual([
			['Anna Erst', '2020-01-01', '2023-05-01'],
			['Bruno Zweit', '2023-05-01', '2026-03-01'],
			// Die laufende Zuordnung trägt kein Ende — daraus wird «auf Weiteres».
			['Clara Dritt', '2026-03-01', null]
		]);
	});

	/*
	 * **Die Bereiche stossen aneinander, sie überschneiden sich nicht** (`[)`,
	 * Migration 006). Das Ende der einen ist der Beginn der nächsten; wäre es
	 * anders, hätte die Einheit an einem Tag zwei Eigentümer und damit zwei
	 * Stimmen (ZGB Art. 712o Abs. 1).
	 */
	it('lässt keine Lücke und keine Überschneidung zwischen den Zeilen', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Verlaufsweg 2', 'Whg 2');
		const a = await person(g.id, 'Anna Erst');
		const b = await person(g.id, 'Bruno Zweit');
		await ordneEigentumZu(handelnder(betreiber), e.id, a.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), e.id, b.id, '2024-07-01');

		const verlauf = await holeEigentumsverlauf(betreiber, g.id);
		expect(verlauf[0].bis).toBe(verlauf[1].von);
	});

	it('nennt die Einheit an jeder Zeile, damit die Anzeige gruppieren kann', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Verlaufsweg 3', 'Whg 3');
		const zweite = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 4',
			quotas: { stamm: 0 },
			countsAsHead: true
		});
		const a = await person(g.id, 'Anna Erst');
		await ordneEigentumZu(handelnder(betreiber), e.id, a.id, '2020-01-01');
		await ordneEigentumZu(handelnder(betreiber), zweite.id, a.id, '2021-01-01');

		const verlauf = await holeEigentumsverlauf(betreiber, g.id);
		// Nach Einheit sortiert: «Whg 3» vor «Whg 4».
		expect(verlauf.map((z) => z.einheit)).toEqual(['Whg 3', 'Whg 4']);
		expect(verlauf.every((z) => z.unitId)).toBe(true);
	});

	it('bleibt leer, solange nichts zugeordnet ist', async () => {
		const { g } = await gemeinschaftMitEinheit('Verlaufsweg 4', 'Whg 5');
		expect(await holeEigentumsverlauf(betreiber, g.id)).toEqual([]);
	});
});

describe('Die Gegenrichtung an der Person', () => {
	it('trennt, was sie hält, von dem, was sie hielt', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Verlaufsweg 5', 'Whg 6');
		const personA = await personMitEinheit('Anna Erst', e.id, '2020-01-01');
		const b = await person(g.id, 'Bruno Zweit');
		await ordneEigentumZu(handelnder(betreiber), e.id, b.id, '2026-03-01');
		const haelt = await einheitenDerPerson(betreiber, personA, '2026-09-01');
		const hielt = await frueheresEigentumDerPerson(betreiber, personA, '2026-09-01');

		expect(haelt).toHaveLength(0);
		expect(hielt.map((z) => [z.label, z.ab, z.bis])).toEqual([
			['Whg 6', '2020-01-01', '2026-03-01']
		]);
	});

	/*
	 * **Ein Ende am Stichtag ist Vergangenheit.** Die Bereiche sind rechts offen:
	 * Wer am 1. März verkauft, hält die Einheit an diesem Tag nicht mehr. Stünde
	 * die Zeile hier noch unter «hält», zählte eine verkaufte Wohnung in der
	 * Stimmkraft mit.
	 */
	it('zählt ein Ende am Stichtag selbst schon zur Vergangenheit', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Verlaufsweg 6', 'Whg 7');
		const personA = await personMitEinheit('Anna Erst', e.id, '2020-01-01');
		const b = await person(g.id, 'Bruno Zweit');
		await ordneEigentumZu(handelnder(betreiber), e.id, b.id, '2026-03-01');
		expect(await einheitenDerPerson(betreiber, personA, '2026-03-01')).toHaveLength(0);
		expect(await frueheresEigentumDerPerson(betreiber, personA, '2026-03-01')).toHaveLength(1);
	});

	it('nennt die laufende Zuordnung nicht als frühere', async () => {
		const { e } = await gemeinschaftMitEinheit('Verlaufsweg 7', 'Whg 8');
		const personA = await personMitEinheit('Anna Erst', e.id, '2020-01-01');

		expect(await frueheresEigentumDerPerson(betreiber, personA, '2026-09-01')).toEqual([]);
		expect(await einheitenDerPerson(betreiber, personA, '2026-09-01')).toHaveLength(1);
	});
});

/**
 * Die Rückfrage im Personenweg (01.09.2026).
 *
 * **Sie nannte die Zielperson selbst als «verdrängt».** Wer den Stichtag
 * derselben Zuordnung berichtigt, verdrängt sich selbst — und die Rückfrage
 * schloss trotzdem mit «Sollen beide zusammen Eigentümer sein?», einer Frage
 * nach zwei Personen, wo nur eine steht. Beim Kappen war der Filter da, beim
 * Entfernen fehlte er. Der Eigentümerweg unterscheidet es seit dem 26.08.2026.
 */
describe('Die Rückfrage beim Zuordnen über die Person', () => {
	/*
	 * **Auch die eigene Zeile verschwindet, also wird gefragt** (02.09.2026,
	 * Korrektur der Fassung vom Vortag). Sie wird entfernt und nicht gekappt —
	 * danach gibt es sie nicht mehr, nur noch den Verlaufseintrag. Was die
	 * Rückfrage unterscheidet, ist der Schlusssatz: `fremdeBetroffen` bleibt
	 * falsch, und die Seite schreibt «Es ist dieselbe Person» statt der Frage
	 * nach gemeinschaftlichem Eigentum.
	 */
	it('fragt auch nach, wenn nur der eigene Stichtag berichtigt wird', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Rueckfrageweg 1', 'Whg 9');
		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Dora Einzig' });
		await ordneEinheitZuPerson(handelnder(betreiber), mensch.id, e.id, '2026-05-01');

		// Dieselbe Person, neuer Stichtag: Die alte Zeile beginnt danach und wird
		// vollständig entfernt — auch wenn sie ihr selbst gehört.
		const gefragt = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-04-01'
		);
		expect(gefragt.rueckfrage).not.toBeNull();
		expect(gefragt.rueckfrage!.fremdeBetroffen).toBe(false);
		expect(gefragt.rueckfrage!.verdraengt.map((v) => v.name)).toEqual(['Dora Einzig']);

		// Ohne Bestätigung ist nichts geschehen.
		const vorher = await holeEigentumsverlauf(betreiber, g.id);
		expect(vorher.map((z) => [z.eigentuemer, z.von])).toEqual([['Dora Einzig', '2026-05-01']]);

		// Bestätigt läuft er durch.
		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-04-01',
			undefined,
			true
		);
		expect(ergebnis.rueckfrage).toBeNull();

		const verlauf = await holeEigentumsverlauf(betreiber, g.id);
		expect(verlauf.map((z) => [z.eigentuemer, z.von])).toEqual([['Dora Einzig', '2026-04-01']]);
	});

	/*
	 * **Ein reines Kappen fragt weiter nicht.** Die Zeile bleibt stehen, nur ihr
	 * Ende wandert — es geht nichts verloren, und eine Rückfrage bei jeder
	 * Datumskorrektur wäre die Sorte Fenster, die man ungelesen wegklickt.
	 */
	it('fragt nicht nach, wenn die eigene Zeile nur gekappt wird', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Rueckfrageweg 3', 'Whg 11');
		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Emma Frueher' });
		await ordneEinheitZuPerson(handelnder(betreiber), mensch.id, e.id, '2026-01-01');

		// Späterer Stichtag: Die bestehende Zeile beginnt früher und wird gekappt.
		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-06-01'
		);
		expect(ergebnis.rueckfrage).toBeNull();

		const verlauf = await holeEigentumsverlauf(betreiber, g.id);
		expect(verlauf.map((z) => [z.von, z.bis])).toEqual([
			['2026-01-01', '2026-06-01'],
			['2026-06-01', null]
		]);
	});

	/*
	 * **Gefragt wird wegen fremder Zeilen, gezeigt wird alles** (01.09.2026,
	 * zweite Reviewrunde). Der erste Anlauf filterte auch die Anzeige — und
	 * verschwieg damit, dass die eigene Zeile samt Notiz gelöscht wird.
	 */
	it('zeigt auch die eigene Zeile, die dabei entfällt', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Rueckfrageweg 3', 'Whg 11');
		const fremd = await person(g.id, 'Gustav Alt');
		await ordneEigentumZu(handelnder(betreiber), e.id, fremd.id, '2020-01-01');

		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Hanna Neu' });
		// Erst ab 2026-06-01 zuordnen (kappt die fremde Zeile) …
		await ordneEinheitZuPerson(handelnder(betreiber), mensch.id, e.id, '2026-06-01', undefined, true);
		// … dann rückwirkend ab 2026-02-01: Das kappt die fremde Zeile erneut und
		// entfernt die eigene von 2026-06-01, weil sie danach beginnt.
		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-02-01'
		);

		expect(ergebnis.rueckfrage).not.toBeNull();
		expect(ergebnis.rueckfrage!.verdraengt.map((v) => v.name)).toContain('Hanna Neu');
		expect(ergebnis.rueckfrage!.fremdeBetroffen).toBe(true);
	});

	it('fragt nach, sobald eine fremde Zuordnung entfällt — und nennt nur sie', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Rueckfrageweg 2', 'Whg 10');
		const fremd = await person(g.id, 'Emil Vorher');
		await ordneEigentumZu(handelnder(betreiber), e.id, fremd.id, '2026-05-01');

		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Frida Nachher' });
		const ergebnis = await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-04-01'
		);

		expect(ergebnis.rueckfrage).not.toBeNull();
		const namen = ergebnis.rueckfrage!.verdraengt.map((v) => v.name);
		expect(namen).toEqual(['Emil Vorher']);
		// Und nicht die Person, der gerade zugeordnet wird.
		expect(namen).not.toContain('Frida Nachher');
		expect(ergebnis.rueckfrage!.fremdeBetroffen).toBe(true);
	});

	/*
	 * **Was gelöscht wird, muss im Verlauf stehen — nicht nur, dass es das gab**
	 * (01.09.2026, aus dem Code-Review).
	 *
	 * Eine verdrängte Zuordnung wird gelöscht, nicht gekappt. Der Eintrag hielt
	 * bisher nur `verdraengtDurchKorrektur` fest; Zeitraum und Notiz der Zeile
	 * waren danach nirgends mehr. Das trifft gerade den Weg, der zum Berichtigen
	 * gedacht ist: Dort verdrängt sich dieselbe Person selbst, und die Rückfrage
	 * entfällt zu Recht — sie fragt nach gemeinschaftlichem Eigentum.
	 */
	it('nimmt Zeitraum und Notiz der gelöschten Zuordnung in den Verlauf', async () => {
		const { g, e } = await gemeinschaftMitEinheit('Spurenweg 1', 'Whg 12');
		const mensch = await erstellePerson(handelnder(betreiber), { name: 'Berta Berichtigt' });

		// Erste Erfassung, mit Notiz — und zwar zu spät angesetzt.
		await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-06-01',
			'Kauf laut Vertrag Nr. 42'
		);
		// Dieselbe Person, früherer Beginn: Die Junizeile wird verdrängt. Bestätigt,
		// weil seit dem 02.09.2026 jede entfallende Zeile eine Rückfrage auslöst.
		await ordneEinheitZuPerson(
			handelnder(betreiber),
			mensch.id,
			e.id,
			'2026-01-01',
			undefined,
			true
		);

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<
				{ detail: { entfernterBeginn: string; entfernteNotiz: string | null } }[]
			>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'unit' AND subject_id = ${e.id}
				   AND event_type = ${EREIGNISARTEN.eigentumBeendet}
				   AND detail->>'verdraengtDurchKorrektur' = 'true'
				 ORDER BY id
			`;
		});

		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].detail.entfernterBeginn).toBe('2026-06-01');
		expect(zeilen[0].detail.entfernteNotiz).toBe('Kauf laut Vertrag Nr. 42');
	});
});
