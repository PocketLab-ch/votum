/**
 * Die Person über den Gemeinschaften — und ihre Berichtigung.
 *
 * **Der Anlass** (Usability-Prüflauf 22.08.2026, Befund A-03): Im ganzen
 * Servercode stand kein einziges `UPDATE person`. Erfassen ging, zuordnen ging,
 * verknüpfen ging — ändern nicht. Ein Tippfehler im Namen blieb für immer
 * stehen, und eine neue E-Mail-Adresse liess sich nicht nachtragen, obwohl
 * genau sie den Zugangscode zur Versammlung trägt.
 *
 * Gefunden hat es ein Prüfer, der eine Person anlegte und danach den Knopf zum
 * Berichtigen suchte. Im Betrieb wäre es spätestens im zweiten Jahr
 * aufgeschlagen — bei einer Gemeinschaft mit dreissig Parteien im ersten.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	aenderePerson,
	entfernePerson,
	erstellePerson,
	holePersonen,
	holeUnverknuepfteParteien,
	verknuepfePartei
} from '$lib/server/personen';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleEinheit } from '$lib/server/einheiten';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Personen');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Stammangaben berichtigen', () => {
	it('ändert Name, E-Mail, Telefon und Adresse', async () => {
		const p = await erstellePerson(handelnder(betreiber), {
			name: 'Vera Probemann-Musterr',
			email: 'vera@example.ch'
		});

		const berichtigt = await aenderePerson(handelnder(betreiber), p.id, {
			name: 'Vera Probemann-Muster',
			email: 'v.probemann@example.ch',
			telefon: '031 000 00 00',
			adresse: 'Probehalde 14, 9999 Nirgendheim'
		});

		expect(berichtigt.name).toBe('Vera Probemann-Muster');
		expect(berichtigt.email).toBe('v.probemann@example.ch');
		expect(berichtigt.telefon).toBe('031 000 00 00');
		expect(berichtigt.adresse).toContain('Nirgendheim');

		// Und die Liste zeigt danach denselben Stand — nicht nur der Rückgabewert.
		const inListe = (await holePersonen(betreiber, 'aktiv')).find((x) => x.id === p.id);
		expect(inListe?.name).toBe('Vera Probemann-Muster');
		expect(inListe?.email).toBe('v.probemann@example.ch');
	});

	/*
	 * **Der Name steht zweimal da** (Nachprüfung 23.08.2026). `party.display_name`
	 * ist eine Kopie; wer nur die Person berichtigte, sah den neuen Namen unter
	 * «Eigentümer» und den alten in der Gemeinschaft, in der Anwesenheitsliste und
	 * im Protokollentwurf. Ich hatte «Person ändern ✓» gemeldet — die Nachprüfung
	 * hat es gemessen.
	 */
	it('zieht die Eigentümerzeilen mit, die denselben Namen tragen', async () => {
		const p = await erstellePerson(handelnder(betreiber), { name: 'Vertippt Zuerst' });
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Namensweg 1',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const partei = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Vertippt Zuerst',
			representativeName: null,
			isCommunity: false
		});
		await verknuepfePartei(handelnder(betreiber), partei.id, p.id);

		await aenderePerson(handelnder(betreiber), p.id, { name: 'Richtig Geschrieben' });

		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT display_name FROM party WHERE id = ${partei.id}`
		);
		expect(zeile.display_name).toBe('Richtig Geschrieben');
	});

	it('lässt einen eigenständig gepflegten Parteinamen stehen', async () => {
		// «Erbengemeinschaft Müller» neben «Hans Müller»: Das hat jemand bewusst so
		// geschrieben, und eine Namensberichtigung an der Person darf es nicht
		// überschreiben.
		const p = await erstellePerson(handelnder(betreiber), { name: 'Hans Muster' });
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Namensweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const partei = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Muster',
			representativeName: null,
			isCommunity: false
		});
		await verknuepfePartei(handelnder(betreiber), partei.id, p.id);

		await aenderePerson(handelnder(betreiber), p.id, { name: 'Hans Muster-Berger' });

		const [zeile] = await imKontext(
			betreiber,
			(tx) => tx`SELECT display_name FROM party WHERE id = ${partei.id}`
		);
		expect(zeile.display_name).toBe('Erbengemeinschaft Muster');
	});

	it('leert ein Feld, wenn es leer übergeben wird', async () => {
		const p = await erstellePerson(handelnder(betreiber), {
			name: 'Hans Beispiel',
			telefon: '031 000 00 00'
		});
		const ohne = await aenderePerson(handelnder(betreiber), p.id, {
			name: 'Hans Beispiel',
			telefon: ''
		});
		// Ein geleertes Feld muss leer werden — sonst liesse sich eine veraltete
		// Nummer nie loswerden, nur überschreiben.
		expect(ohne.telefon).toBeNull();
	});

	it('verlangt einen Namen von mindestens zwei Zeichen', async () => {
		const p = await erstellePerson(handelnder(betreiber), { name: 'Anna Muster' });
		await expect(
			aenderePerson(handelnder(betreiber), p.id, { name: 'A' })
		).rejects.toThrow(/Name/);
	});

	it('nennt eine Person, die es nicht gibt, beim Namen', async () => {
		await expect(
			aenderePerson(handelnder(betreiber), crypto.randomUUID(), { name: 'Niemand Hier' })
		).rejects.toThrow(/gibt es nicht/);
	});
});


/*
 * **Löschen, nicht nur archivieren** (Auftraggeber, 25.08.2026: «Personen sollen eine
 * Löschung bekommen, wenn sie keiner Einheit zugeordnet sind»).
 *
 * Geprüft werden beide Seiten: dass es geht, wenn nichts daran hängt — und dass
 * es abgewiesen wird, sobald etwas daran hängt. «Wirft» allein bewiese auch
 * eine Schranke, die nie durchlässt; «löscht» allein eine, die alles durchlässt.
 */
describe('Eine Person löschen', () => {
	it('nimmt ihre leeren Eigentümerzeilen mit', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Loeschhaus',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const person = await erstellePerson(handelnder(betreiber), { name: 'Doppelt Erfasst' });
		const partei = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Doppelt Erfasst',
			isCommunity: false,
			representativeName: null
		});
		await verknuepfePartei(handelnder(betreiber), partei.id, person.id);

		const { name, zeilen } = await entfernePerson(handelnder(betreiber), person.id);
		expect(name).toBe('Doppelt Erfasst');
		expect(zeilen).toHaveLength(1);

		// **Beide Seiten messen**: Person weg UND Zeile weg — die Datenbank liesse
		// das Löschen der Person sonst gar nicht zu (`party.person_id` RESTRICT).
		const [zaehlung] = await imKontext(betreiber, (tx) =>
			tx<{ personen: number; parteien: number }[]>`
				SELECT (SELECT count(*) FROM person WHERE id = ${person.id})::int AS personen,
				       (SELECT count(*) FROM party WHERE id = ${partei.id})::int AS parteien
			`
		);
		expect(zaehlung.personen).toBe(0);
		expect(zaehlung.parteien).toBe(0);

		// Und die Gemeinschaft steht noch — gelöscht wurde die Person, nicht ihr Haus.
		const [haus] = await imKontext(betreiber, (tx) =>
			tx<{ n: number }[]>`SELECT count(*)::int AS n FROM stweg WHERE id = ${g.id}`
		);
		expect(haus.n).toBe(1);
	});

	it('wird abgewiesen, solange eine Zeile eine Einheit hält', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Haltehaus',
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
		const person = await erstellePerson(handelnder(betreiber), { name: 'Haelt Etwas' });
		const partei = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Haelt Etwas',
			isCommunity: false,
			representativeName: null
		});
		await verknuepfePartei(handelnder(betreiber), partei.id, person.id);
		await ordneEigentumZu(handelnder(betreiber), e.id, partei.id, '2020-01-01');

		await expect(entfernePerson(handelnder(betreiber), person.id)).rejects.toThrow(
			FachlicherFehler
		);
		// Die Absage nennt die Zeile mit ihrer Gemeinschaft — bei mehreren muss
		// erkennbar sein, welche im Weg steht.
		await expect(entfernePerson(handelnder(betreiber), person.id)).rejects.toThrow(/Haltehaus/);

		// Und nichts ist dabei verschwunden.
		const [zaehlung] = await imKontext(betreiber, (tx) =>
			tx<{ personen: number; parteien: number }[]>`
				SELECT (SELECT count(*) FROM person WHERE id = ${person.id})::int AS personen,
				       (SELECT count(*) FROM party WHERE id = ${partei.id})::int AS parteien
			`
		);
		expect(zaehlung.personen).toBe(1);
		expect(zaehlung.parteien).toBe(1);
	});

	it('gibt es nicht für eine unbekannte Kennung', async () => {
		await expect(
			entfernePerson(handelnder(betreiber), '01a03a00-0000-7000-8000-000000000000')
		).rejects.toThrow(/gibt es nicht/);
	});
});

/**
 * Block B1: Unverknuepfte Eigentuemerzeilen fachlich abgrenzen (31.08.2026).
 *
 * `holeUnverknuepfteParteien()` nahm bisher jede `party` mit `person_id IS NULL`
 * und vermischte drei Faelle: eine gewoehnliche noch nicht verknuepfte Zeile,
 * eine Huelle gemeinschaftlichen Eigentums und eine Gemeinschaft als
 * Eigentuemerin. Die letzten beiden duerfen absichtlich keine einzelne
 * `person_id` tragen. Der Test legt alle drei an und weist nach, dass nur die
 * gewoehnliche unverknuepfte Zeile geliefert wird.
 */
describe('Unverknuepfte Eigentuemerzeilen fachlich abgrenzen', () => {
	it('liefert nur Zeilen, die mit einer Person verknuepft werden koennen', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Abgrenzhaus',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const gh = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Haus Des Hauses',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		// 1. Eine gewoehnliche unverknuepfte Eigentuemerzeile — die einzige,
		//    die eine Personenklammer tragen darf und hier erscheinen soll.
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Gewoehnlich Unverknuepft',
			representativeName: null,
			isCommunity: false
		});

		// 2. Eine Huelle gemeinschaftlichen Eigentums — sie darf absichtlich
		//    keine `person_id` tragen; die Mitberechtigten haengen ueber
		//    `party_member` daran.
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Erbengemeinschaft Huelle',
			representativeName: 'Vertreter Huelle',
			isCommunity: true
		});

		// 3. Eine Gemeinschaft als Eigentuemerin — auch hinter ihr steht keine
		//    einzelne Person.
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'gemeinschaft',
			displayName: 'Gemeinschaft Als Eigentuemerin',
			representativeName: 'Bezeichneter Vertreter',
			isCommunity: false,
			memberStwegId: gh.id
		});

		const unverknuepft = await holeUnverknuepfteParteien(betreiber, 'aktiv');

		// Nur die gewoehnliche Zeile erscheint — Huelle und Gemeinschaft sind
		// fachlich nicht ueber eine einzelne Personenklammer verknuepfbar.
		expect(unverknuepft).toHaveLength(1);
		expect(unverknuepft[0].name).toBe('Gewoehnlich Unverknuepft');
	});
});
