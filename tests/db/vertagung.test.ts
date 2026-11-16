/**
 * Vertagen: die zweite Versammlung nach ZGB Art. 712p Abs. 2 — in der Datenbank.
 *
 * **Warum es diese Datei gibt.** Die Vertagung hatte sieben grüne Kerntests
 * (`tests/domain/folgeversammlung.test.ts`) und war trotzdem halb: Sie legte
 * die zweite Versammlung richtig an — Stufe, Vorgängerin, Datum — und liess
 * deren Geschäfte weg. Nachgemessen am 25.08.2026 am laufenden Dev-Bestand:
 * drei angekündigte Sachtraktanden in der ersten, **null** in der zweiten. Die
 * acht Pflichttraktanden entstehen von selbst, deshalb sah die Liste
 * vollständig aus.
 *
 * Der Kern konnte das nicht sehen: `folgeversammlung()` ist eine reine
 * Funktion über Datum und Stufe und weiss von Traktanden nichts. Was hier
 * geprüft wird, ist genau der Teil dazwischen — was die Datenbank nach einer
 * Vertagung enthält.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	vertageVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	nimmTraktandumAuf,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import { haltBeschlussVonHandFest, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { halteBeschlussfaehigkeitFest } from '$lib/server/beschlussfaehigkeit';
import { speichereZweitversammlungsfrist } from '$lib/server/reglement';
import { fruehesterZweitTermin } from '$lib/domain/versammlung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

/**
 * Eine laufende Versammlung mit allem, was beim Vertagen verschieden behandelt
 * werden muss: erledigt, zurückgezogen, spontan, offen — und ein Antrag mit
 * betroffenen Eigentümern, weil an denen das Erfordernis hängt.
 */
async function aufbau(name: string, { abstimmen = true }: { abstimmen?: boolean } = {}) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const parteien: string[] = [];
	for (const [nummer, quote] of [600, 400].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: nummer === 0 ? 'Anna Muster' : 'Peter Kunz',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: '2026-05-20',
		uhrzeit: '19:00',
		ort: 'Gemeindesaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});

	/*
	 * Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr
	 * an, das sie kennt. Gesetzt wird danach das einfache Mehr: Betroffene an
	 * einem solchen Mehr gibt es im Bestand von vorher, und die Vertagung nimmt
	 * sie mit, wie sie stehen.
	 */
	const traktandum = async (titel: string, betroffene: string[] = []) =>
		(
			await erstelleTraktandum(
				handelnder(betreiber),
				{
					meetingId: v.id,
					parentId: null,
					titel,
					art: 'abstimmung',
					antragswortlaut: `${titel} wird beschlossen.`,
					antragstellerart: 'bewirtschaftung',
					betroffeneParteiIds: betroffene
				},
				betroffene.length > 0 ? 'k-nutzungsrecht-zuteilung' : null
			)
		).id;

	const erledigt = await traktandum('Jahresrechnung 2025');
	const zurueckgezogen = await traktandum('Spielplatz');
	const offen = await traktandum('Fassadensanierung', [parteien[0]]);
	const kenntnis = (
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel: 'Bericht des Ausschusses',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		})
	).id;

	// Das Erfordernis steht an beiden Anträgen — an einem, weil darüber
	// abgestimmt wird, am anderen, weil es beim Übertragen mitwandern soll.
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, erledigt, EINFACHES_MEHR);
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, offen, EINFACHES_MEHR);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}

	// Über eines ist entschieden — der Durchgang ist geschlossen und nicht überholt.
	// Ohne ihn war die Versammlung nie nachweislich beschlussfähig, und die
	// Folgeversammlung wird eine zweite (C3, F4c); mit ihm eine neue erste.
	if (abstimmen) {
		await oeffneAbstimmung(handelnder(betreiber), v.id, erledigt);
		await schliesseAbstimmung(handelnder(betreiber), v.id);
	}

	await ziehAntragZurueck(handelnder(betreiber), v.id, zurueckgezogen, 'Offerte zurückgezogen');

	// Und eines ist im Saal aufgekommen — nicht angekündigt, also nur Kenntnisnahme.
	const spontan = (
		await nimmTraktandumAuf(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel: 'Hinweis auf die Grillsaison',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		})
	).id;

	return { stweg: g.id, versammlung: v.id, erledigt, zurueckgezogen, offen, kenntnis, spontan, parteien };
}

/** Titel der Traktanden einer Versammlung, die nicht aus der Vorlage stammen. */
async function sachtraktanden(operatorId: string, meetingId: string): Promise<string[]> {
	const zeilen = await imKontext(operatorId, (tx) =>
		tx<{ title: string }[]>`
			SELECT title FROM agenda_item
			WHERE meeting_id = ${meetingId} AND from_template = false
			ORDER BY position
		`
	);
	return zeilen.map((z) => z.title);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Vertagung');
});

afterAll(verbindungenSchliessen);

describe('Vertagen legt die zweite Versammlung an', () => {
	// Der Termin ist der erste zulässige, also elf Tage später (Befund R-1,
	// 23.09.2026). Vorher stand hier der 30. Mai als «zehn Tage später», und das
	// war genau der Tag, den Art. 712p Abs. 2 ausschliesst.
	it('setzt Stufe, Vorgängerin und den ersten zulässigen Termin', async () => {
		const a = await aufbau('Vertagungsweg 1', { abstimmen: false });
		const { vertagt, folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		expect(vertagt.zustand).toBe('laufend'); // der Stand VOR dem Schliessen
		expect(folge.stufe).toBe('zweite');
		expect(folge.vorgaengerId).toBe(a.versammlung);
		expect(folge.datum).toBe('2026-05-31');
		expect(folge.zustand).toBe('entwurf');
		expect(folge.ort).toBe('Gemeindesaal');
	});

	it('schliesst die vertagte Versammlung', async () => {
		const a = await aufbau('Vertagungsweg 2');
		await vertageVersammlung(handelnder(betreiber), a.versammlung, { grund: 'nicht beschlussfähig' });

		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${a.versammlung}`
		);
		expect(z.state).toBe('geschlossen');
	});

	/*
	 * Der Punkt mit der Rechtsfolge: Wird eine Versammlung abgesagt, bevor sie
	 * eröffnet ist, hat es keine «ungenügende Beteiligung» gegeben — die neue ist
	 * weiterhin die erste, mit dem vollen Quorum nach ZGB 712p Abs. 1. Eine
	 * «zweite» daraus zu machen, senkte das Quorum auf einen Drittel, ohne dass
	 * jemand je zusammengekommen wäre.
	 */
	it('vertagt nur eine laufende Versammlung, nicht einen Entwurf', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Vertagungsweg Entwurf',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-05-20',
			uhrzeit: '19:00',
			ort: 'Gemeindesaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});

		await expect(
			vertageVersammlung(handelnder(betreiber), v.id, { grund: 'doch kein Saal' })
		).rejects.toThrow(/lässt sich nicht vertagen/);

		// Und es ist auch keine zweite Versammlung entstanden.
		const folgen = await imKontext(betreiber, (tx) =>
			tx<{ anzahl: number }[]>`
				SELECT count(*)::int AS anzahl FROM meeting WHERE previous_meeting_id = ${v.id}
			`
		);
		expect(folgen[0].anzahl).toBe(0);
	});

	it('verlangt einen Grund', async () => {
		const a = await aufbau('Vertagungsweg 3');
		await expect(
			vertageVersammlung(handelnder(betreiber), a.versammlung, { grund: ' ' })
		).rejects.toThrow(/Protokoll/);
	});
});

describe('Die Geschäfte kommen mit — und nur die richtigen', () => {
	it('trägt die unerledigten angekündigten Traktanden in die Folgeversammlung', async () => {
		const a = await aufbau('Vertagungsweg 4');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		expect(await sachtraktanden(betreiber, folge.id)).toEqual([
			'Fassadensanierung',
			'Bericht des Ausschusses'
		]);
	});

	it('lässt das erledigte Traktandum zurück — sonst stünde es zweimal zur Abstimmung', async () => {
		const a = await aufbau('Vertagungsweg 5');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'Beschluss der Versammlung'
		});
		expect(await sachtraktanden(betreiber, folge.id)).not.toContain('Jahresrechnung 2025');
	});

	it('nimmt ein nur konsultativ abgestimmtes Geschäft mit (H7, Teil D)', async () => {
		/*
		 * Konsultativ wird abgestimmt, wenn die Beschlussfähigkeit fehlt, und
		 * dann wird vertagt (ZGB Art. 712p Abs. 2). Das Geschäft ist nicht
		 * entschieden; fehlte es in der Folgeversammlung, fehlte dort gerade
		 * das, wofür sie einberufen wird (Codeprüfung 14.10.2026, Befund 1).
		 * `aufbau` stimmt vorher verbindlich ab, die Folgeversammlung ist hier
		 * also eine neue erste (C3); für das Übertragen ist das gleich.
		 */
		const a = await aufbau('Vertagungsweg konsultativ');
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.offen, { konsultativ: true });
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(await sachtraktanden(betreiber, folge.id)).toContain('Fassadensanierung');
		// Gegenprobe: das verbindlich entschiedene bleibt weiter zurück.
		expect(await sachtraktanden(betreiber, folge.id)).not.toContain('Jahresrechnung 2025');
	});

	it('lässt den zurückgezogenen Antrag zurück', async () => {
		const a = await aufbau('Vertagungsweg 6');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(await sachtraktanden(betreiber, folge.id)).not.toContain('Spielplatz');
	});

	it('lässt das spontan aufgenommene zurück — es war nicht einberufen', async () => {
		const a = await aufbau('Vertagungsweg 7');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(await sachtraktanden(betreiber, folge.id)).not.toContain('Hinweis auf die Grillsaison');
	});

	it('legt die Pflichttraktanden nicht doppelt an', async () => {
		const a = await aufbau('Vertagungsweg 8');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ title: string; anzahl: number }[]>`
				SELECT title, count(*)::int AS anzahl FROM agenda_item
				WHERE meeting_id = ${folge.id}
				GROUP BY title HAVING count(*) > 1
			`
		);
		expect(zeilen).toEqual([]);
	});

	it('nimmt die betroffenen Eigentümer mit — an ihnen hängt das Erfordernis', async () => {
		const a = await aufbau('Vertagungsweg 9');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		const betroffene = await imKontext(betreiber, (tx) =>
			tx<{ party_id: string }[]>`
				SELECT b.party_id FROM agenda_item_affected b
				JOIN agenda_item t ON t.id = b.agenda_item_id
				WHERE t.meeting_id = ${folge.id}
			`
		);
		expect(betroffene.map((b) => b.party_id)).toEqual([a.parteien[0]]);
	});

	it('vermerkt die Herkunft am übernommenen Traktandum', async () => {
		const a = await aufbau('Vertagungsweg 10');
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ copied_from_meeting_id: string | null }[]>`
				SELECT copied_from_meeting_id FROM agenda_item
				WHERE meeting_id = ${folge.id} AND title = 'Fassadensanierung'
			`
		);
		expect(zeilen[0]?.copied_from_meeting_id).toBe(a.versammlung);
	});
});

/**
 * C3 (F4c): War die Versammlung an diesem Abend schon beschlussfähig, wird die
 * Folgeversammlung eine neue erste, mit der Beschlussfähigkeit einer ersten
 * (Rz. 29 und 34 ad Art. 712p; Produktentscheid 04.11.2026).
 */
describe('Vertagen nach zeitweiser Beschlussfähigkeit', () => {
	it('legt nach einem verbindlichen Durchgang eine neue erste an, ohne Vorgängerin', async () => {
		const a = await aufbau('Vertagungsweg 12');
		const { folge, folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('erste');
		expect(folge.stufe).toBe('erste');
		expect(folge.vorgaengerId).toBeNull();
		expect(await sachtraktanden(betreiber, folge.id)).toContain('Fassadensanierung');
		const [e] = await imKontext(betreiber, (tx) =>
			tx<{ detail: { folgestufe: string } }[]>`
				SELECT detail FROM audit_entry
				WHERE subject_type = 'meeting' AND subject_id = ${a.versammlung}
				  AND event_type = 'meeting.adjourned'
			`
		);
		expect(e.detail.folgestufe).toBe('erste');
	});

	it('legt nach einer festgehaltenen Beschlussfähigkeit ohne Durchgang eine neue erste an', async () => {
		const a = await aufbau('Vertagungsweg 13', { abstimmen: false });
		await halteBeschlussfaehigkeitFest(handelnder(betreiber), a.versammlung);
		const { folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('erste');
	});

	it('setzt die neue erste auf den Termin, den die Maske vorab zeigt, auch mit Reglementsfrist', async () => {
		// Die Ausklapper in Leitung und Anwesenheit nennen `fruehesterZweitTermin`;
		// legte das Vertagen einen anderen Tag an, widerspräche sich die Maske.
		const a = await aufbau('Vertagungsweg 15');
		await speichereZweitversammlungsfrist(handelnder(betreiber), a.stweg, 20, 'Reglement Ziff. 9');
		const { folge, folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('erste');
		expect(folge.datum).toBe(fruehesterZweitTermin('2026-05-20', 20));
	});

	it('legt nach einem nur konsultativen Durchgang die zweite an', async () => {
		const a = await aufbau('Vertagungsweg 16', { abstimmen: false });
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.offen, { konsultativ: true });
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('zweite');
	});

	it('legt nach einem Beschluss von Hand ohne Beschlussfähigkeit die zweite an', async () => {
		// Er geht an der Prüfung vorbei und belegt keine Beschlussfähigkeit
		// (`istVonHandOhneQuorum`). Mit nur einer anwesenden Partei fehlt die
		// Mindestzahl von zwei.
		const a = await aufbau('Vertagungsweg 17', { abstimmen: false });
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await haltBeschlussVonHandFest(handelnder(betreiber), a.versammlung, a.offen, {
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'summen',
				koepfe: { ja: 1, nein: 0, enthaltung: 0 },
				quoten: { ja: 600, nein: 0, enthaltung: 0 }
			},
			begruendung: 'Probe: der Saal hat trotz fehlender Beschlussfähigkeit abgestimmt'
		});
		const { folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('zweite');
	});

	it('weist eine neue erste vor der vertagten Versammlung ab, bevor geschlossen wird', async () => {
		const a = await aufbau('Vertagungsweg 18');
		await expect(
			vertageVersammlung(handelnder(betreiber), a.versammlung, {
				grund: 'nicht beschlussfähig',
				datum: '2026-05-19'
			})
		).rejects.toThrow(/vor der vertagten/);
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${a.versammlung}`
		);
		expect(z.state).toBe('laufend');
	});

	it('legt ohne Feststellung und ohne verbindlichen Durchgang die zweite an', async () => {
		const a = await aufbau('Vertagungsweg 14', { abstimmen: false });
		const { folgestufe } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});
		expect(folgestufe).toBe('zweite');
	});
});

describe('Eine dritte Versammlung kennt das Gesetz nicht', () => {
	it('weist das Vertagen einer zweiten Versammlung ab', async () => {
		const a = await aufbau('Vertagungsweg 11', { abstimmen: false });
		const { folge } = await vertageVersammlung(handelnder(betreiber), a.versammlung, {
			grund: 'nicht beschlussfähig'
		});

		await expect(
			vertageVersammlung(handelnder(betreiber), folge.id, { grund: 'wieder niemand da' })
		).rejects.toThrow(/712p/);
	});
});
