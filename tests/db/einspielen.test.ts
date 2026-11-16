/**
 * Eine anderswo geführte Versammlung hier aufnehmen (PRD §13, Rückführung).
 *
 * **Geprüft wird mit echten Paketen.** Eines entsteht in diesem Test durch
 * `versiegle` — dieselbe Funktion, die auf dem Notebook im Saal läuft. Ein
 * zweites wird daraus abgeleitet, indem im Manifest die Kennung der Versammlung
 * getauscht wird: Das ist genau der Fall, um den es geht — ein Paket, dessen
 * Versammlung dieser Server nicht kennt.
 *
 * Das Umschreiben ändert das Siegel, aber nicht die Prüfsummen der
 * Bestandteile — die stehen im Manifest und gelten den Dateien daneben. Genau
 * so verhält sich auch ein Paket, das jemand mit einem gewöhnlichen Werkzeug
 * neu gepackt hat.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { holePaket, versiegle } from '$lib/server/siegel';
import { entpacke } from '$lib/server/paketpruefung';
import {
	holeBeschluesse,
	holeEingespielte,
	holePaketdatei,
	nimmAuf,
	vorschau
} from '$lib/server/einspielen';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import { manifestAlsJson, type Manifest } from '$lib/domain/siegel';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
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

/** Eine Gemeinschaft mit zwei Einheiten und einer versiegelten Versammlung. */
async function versiegelt(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 500 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
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
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[0], 'von_hand');
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[1], 'von_hand');
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
	await oeffneAbstimmung(handelnder(betreiber), v.id, t.id);
	await gibStimmenAb(
		handelnder(betreiber),
		v.id,
		[
			{ parteiId: parteien[0], wahl: 'yes' },
			{ parteiId: parteien[1], wahl: 'yes' }
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
);
	await schliesseAbstimmung(handelnder(betreiber), v.id);
	await schliesseVersammlung(handelnder(betreiber), v.id);
	await versiegle(handelnder(betreiber), v.id, `${datum} 21:30:00`);

	const paket = await holePaket(betreiber, v.id);
	if (!paket) throw new Error('Kein Paket entstanden');
	return { gemeinschaft: g.id, name, versammlung: v.id, paket };
}

/**
 * Dasselbe Paket, aber mit einer anderen Versammlungskennung — und wahlweise
 * einem anderen Gemeinschaftsnamen.
 *
 * So entsteht der Fall, um den es geht: ein Paket von einem Gerät, dessen
 * Versammlung dieser Server nicht als eigene führt.
 */
function alsFremdesPaket(
	paket: Uint8Array,
	aenderung: (m: Manifest) => Manifest
): { bytes: Uint8Array; manifest: Manifest } {
	const dateien = entpacke(paket);
	const roh = dateien.get('manifest.json');
	if (!roh) throw new Error('Kein Manifest im Paket');
	const manifest = aenderung(JSON.parse(new TextDecoder().decode(roh)) as Manifest);

	const kodierer = new TextEncoder();
	const eintraege = [...dateien.entries()]
		.filter(([pfad]) => pfad !== 'manifest.json')
		.map(([name, inhalt]) => ({ name, inhalt }));
	eintraege.push({ name: 'manifest.json', inhalt: kodierer.encode(manifestAlsJson(manifest)) });

	return { bytes: packe(eintraege, dosZeitstempel('2026-12-01 21:30:00')), manifest };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Einspielen');
	benutzer = await pruefbenutzer(betreiber, 'einspielleitung');
});

afterAll(verbindungenSchliessen);

describe('Ein Paket von aussen', () => {
	it('wird aufgenommen, geprüft und wiedergefunden', async () => {
		const quelle = await versiegelt('Rückführung 1', '2026-12-01');
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));

		const gesehen = await vorschau(betreiber, fremd.bytes, quelle.gemeinschaft, null);
		expect(gesehen.moeglich.moeglich).toBe(true);
		// Die Beschlüsse kommen aus dem Paket, nicht aus der Datenbank. Die
		// Pflichttraktanden stehen davor — gesucht wird deshalb nach dem Titel und
		// nicht nach der Stelle.
		const sanierung = gesehen.beschluesse.find((b) => b.titel === 'Fassadensanierung');
		expect(sanierung).toBeTruthy();
		expect(sanierung!.satz).toBeTruthy();
		// Und die Begrüssung ist mit dabei, ohne Ergebnissatz: Sie wird zur
		// Kenntnis genommen, nicht beschlossen.
		expect(gesehen.beschluesse.length).toBeGreaterThan(1);

		const { id } = await nimmAuf(
			handelnder(betreiber),
			fremd.bytes,
			quelle.gemeinschaft,
			'Notebook aus dem Saal',
			null
		);

		const liste = await holeEingespielte(betreiber, quelle.gemeinschaft);
		expect(liste).toHaveLength(1);
		expect(liste[0].id).toBe(id);
		expect(liste[0].herkunft).toBe('Notebook aus dem Saal');
		expect(liste[0].manifest.versammlung.datum).toBe('2026-12-01');
	});

	it('liefert seine Beschlüsse aus dem Paket, nicht aus einer Kopie', async () => {
		const quelle = await versiegelt('Rückführung 2', '2026-12-02');
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));
		const { id } = await nimmAuf(handelnder(betreiber), fremd.bytes, quelle.gemeinschaft, null, null);

		const gelesen = await holeBeschluesse(betreiber, id);
		expect(gelesen).not.toBeNull();
		const b = gelesen!.beschluesse.find((x) => x.titel === 'Fassadensanierung');
		expect(b).toBeTruthy();
		expect(b!.antragswortlaut).toBe('Die Fassade wird saniert.');
		/*
		 * **Die Regel, nicht der Fallname** (seit 22.08.2026). Vorher stand hier
		 * «Einfaches Mehr» — der Fall. Ein Paket trägt jetzt die Mehrheit in
		 * Worten, weil genau das die Frage beantwortet, die jemand an einen
		 * fremden Beschluss stellt.
		 *
		 * **Ältere Pakete tragen weiterhin den Fallnamen.** Sie sind unveränderlich
		 * und werden es bleiben; die Anzeige muss beides vertragen und tut es,
		 * weil sie den Text nimmt, wie er im Paket steht.
		 */
		expect(b!.erfordernis).toContain('mehr als die Hälfte');
		expect(b!.rechtsgrundlage).toMatch(/712m/);
	});

	it('gibt genau die Bytes wieder heraus, die hereinkamen', async () => {
		// Ein Nachweis, den man nicht herausgeben kann, ist im Streitfall keiner.
		const quelle = await versiegelt('Rückführung 3', '2026-12-03');
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));
		const { id } = await nimmAuf(handelnder(betreiber), fremd.bytes, quelle.gemeinschaft, null, null);

		const zurueck = await holePaketdatei(betreiber, id);
		expect(zurueck).not.toBeNull();
		expect(Buffer.from(zurueck!).equals(Buffer.from(fremd.bytes))).toBe(true);
	});

	it('kommt kein zweites Mal herein', async () => {
		const quelle = await versiegelt('Rückführung 4', '2026-12-04');
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));
		await nimmAuf(handelnder(betreiber), fremd.bytes, quelle.gemeinschaft, null, null);

		const nochmal = await vorschau(betreiber, fremd.bytes, quelle.gemeinschaft, null);
		expect(nochmal.moeglich.hindernis).toBe('schon_eingespielt');
		await expect(
			nimmAuf(handelnder(betreiber), fremd.bytes, quelle.gemeinschaft, null, null)
		).rejects.toThrow(FachlicherFehler);
	});
});

describe('Abgewiesen wird', () => {
	it('ein Paket, dessen Versammlung hier bereits geführt wird', async () => {
		// Zwei Fassungen derselben Versammlung nebeneinander — und keine hebt die
		// andere auf. Welche gilt, liesse sich danach nicht mehr sagen.
		const quelle = await versiegelt('Rückführung 5', '2026-12-05');
		const gesehen = await vorschau(betreiber, quelle.paket, quelle.gemeinschaft, null);
		expect(gesehen.moeglich.hindernis).toBe('laeuft_hier');
	});

	it('ein Paket, das eine andere Gemeinschaft nennt', async () => {
		const quelle = await versiegelt('Rückführung 6', '2026-12-06');
		const andere = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Rückführung 6 — andere',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));

		const gesehen = await vorschau(betreiber, fremd.bytes, andere.id, null);
		expect(gesehen.moeglich.hindernis).toBe('name_weicht_ab');
		await expect(
			nimmAuf(handelnder(betreiber), fremd.bytes, andere.id, null, null)
		).rejects.toThrow(/andere Gemeinschaft/);
	});

	it('ein Paket, dessen Inhalt nicht zum Manifest passt', async () => {
		/*
		 * **Der Fall, der zählt.** Wer eine Datei im Paket austauscht, ändert die
		 * Prüfsummen der Bestandteile — und dann ist es kein Nachweis mehr. Ein
		 * verändertes Paket aufzunehmen hiesse, hier einen Beleg zu führen, der
		 * keiner ist.
		 */
		const quelle = await versiegelt('Rückführung 7', '2026-12-07');
		const dateien = entpacke(quelle.paket);
		const roh = dateien.get('manifest.json');
		const manifest = JSON.parse(new TextDecoder().decode(roh!)) as Manifest;

		const kodierer = new TextEncoder();
		const eintraege = [...dateien.entries()].map(([name, inhalt]) =>
			name === 'daten/traktanden.json'
				? { name, inhalt: kodierer.encode('[{"nummer":"1","knoten":{"titel":"Untergeschoben"}}]') }
				: { name, inhalt }
		);
		const verfaelscht = packe(eintraege, dosZeitstempel('2026-12-07 21:30:00'));
		expect(manifest.eintraege.some((e) => e.pfad === 'daten/traktanden.json')).toBe(true);

		const gesehen = await vorschau(betreiber, verfaelscht, quelle.gemeinschaft, null);
		expect(gesehen.moeglich.hindernis).toBe('inhalt_veraendert');
	});

	it('ein Archiv ohne Manifest', async () => {
		const kein = packe(
			[{ name: 'irgendwas.txt', inhalt: new TextEncoder().encode('nichts') }],
			dosZeitstempel('2026-12-08 12:00:00')
		);
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Rückführung 8',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const gesehen = await vorschau(betreiber, kein, g.id, null);
		expect(gesehen.moeglich.hindernis).toBe('kein_manifest');
	});
});

describe('Der Eintrag', () => {
	it('lässt sich nicht ändern und nicht löschen', async () => {
		/*
		 * Wie beim Siegel selbst: Der Schutz greift in der Datenbank, nicht bloss
		 * in der Oberfläche. Ein Nachweis, den die Anwendung überschreiben kann,
		 * ist keiner.
		 */
		const quelle = await versiegelt('Rückführung 9', '2026-12-09');
		const fremd = alsFremdesPaket(quelle.paket, (m) => ({
			...m,
			versammlung: { ...m.versammlung, kennung: crypto.randomUUID() }
		}));
		const { id } = await nimmAuf(handelnder(betreiber), fremd.bytes, quelle.gemeinschaft, null, null);

		await expect(
			admin`UPDATE imported_meeting SET origin_note = 'anders' WHERE id = ${id}`
		).rejects.toThrow(/nicht geändert und nicht gelöscht/);
		await expect(admin`DELETE FROM imported_meeting WHERE id = ${id}`).rejects.toThrow(
			/nicht geändert und nicht gelöscht/
		);
	});
});
