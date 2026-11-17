/**
 * Die Befunde der Probe Wertquotenmehr am gemeinsamen Abend, über den Server
 * und die Loader statt über den Kern (Featureprüfung zu `5b1b82a0`,
 * Kriterium 9).
 *
 * **Warum es diese Datei gibt.** Die Sätze für Stichentscheid, Durchgang,
 * Gleichstand und Rückzug sind im Kern geprüft
 * (`tests/domain/probe-wertquotenmehr.test.ts`). Die Gegenproben der
 * Featureprüfung vom 17.11.2026 fanden die Verdrahtung ungeprüft: Gab
 * `stelleAbendzusammenstellungZusammen` den Gleichstand oder die
 * Durchgangszeile nicht weiter, lieferte der Load der Abendleitung keinen
 * Gleichstand oder rechnete die Abendwand den Rückzug falsch, blieb der ganze
 * Prüflauf grün. Hier wird an genau diesen Stellen gemessen.
 *
 * Erfundene Gemeinschaften und Namen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleReglementsregel } from '$lib/server/reglement';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, schliesseVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { holeTraktanden, setzeGewaehltesErfordernis, stelleRueckkommensantrag, ziehAntragZurueck } from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { setzeBeschlussvermerk, setzeProtokollnotiz } from '$lib/server/protokoll';
import { gibStimmenAb, haltStichentscheidFest, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { load as leitungLoad } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import type { PageData as Leitungsdaten } from '../../src/routes/tage/[id=kennung]/leitung/$types';
import { load as wandLoad } from '../../src/routes/tage/[id=kennung]/praesentation/+page.server';
import type { PageData as Wanddaten } from '../../src/routes/tage/[id=kennung]/praesentation/$types';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });
const TITEL = 'Ersatz der Hecke';
const GLEICHSTAND = '500 zu 500 Wertquoten, nach denen hier allein gezählt wird';

beforeAll(async () => {
	betreiber = await pruefbetreiber('Probe Wertquotenmehr am Abend');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-wertquoten-abend');
});
afterAll(verbindungenSchliessen);

/** Ein Haus mit der Regel ohne Köpfe und dem Stichentscheid der Verwaltung, 500/300/200. */
async function haus(name: string, datum: string, tagId: string, stelle: number) {
	const g = await erstelleGemeinschaft(h(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'verwalter',
		tieBreakRuleSource: 'Art. 98 Reglement (erfunden)'
	});
	await erstelleReglementsregel(h(), {
		stwegId: g.id,
		geschaeftsart: 'verwaltung_gewoehnlich',
		kopfSchwelle: null,
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'anwesend_vertreten',
		fundstelle: 'Art. 99 Reglement (erfunden)',
		enthaltungZaehltMit: true
	});
	const parteien: string[] = [];
	for (const [i, q] of [500, 300, 200].entries()) {
		const e = await erstelleEinheit(h(), { stwegId: g.id, kind: 'unit', label: `Whg ${i + 1}`, quotas: { stamm: q }, countsAsHead: true });
		const p = await erstelleEigentuemer(h(), { stwegId: g.id, kind: 'natural', displayName: `Partei ${i + 1}`, isCommunity: false, representativeName: null });
		await ordneEigentumZu(h(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(h(), {
		stwegId: g.id, datum, uhrzeit: '19:00', ort: 'Prüfsaal', art: 'ordentlich', stufe: 'erste', betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(h(), tagId, v.id, stelle);
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

/** Zwei Häuser, ein gemeinsames Geschäft, eröffnet, alle anwesend. */
async function abend(name: string, datum: string) {
	const tag = await erstelleVersammlungstag(h(), { bezeichnung: `${name}, Abend`, datum, uhrzeit: '19:00', ort: 'Prüfsaal', art: 'ordentlich' });
	const a = await haus(`${name} Nord`, datum, tag.id, 0);
	const b = await haus(`${name} Süd`, datum, tag.id, 1);
	await erstelleGeschaeft(h(), tag.id, { titel: TITEL, antragswortlaut: 'Die Hecke wird ersetzt.', art: 'abstimmung', meetingIds: [a.versammlung, b.versammlung] });
	const grund: Record<string, string> = {};
	for (const x of [a, b]) {
		grund[x.versammlung] = (await holeTraktanden(betreiber, x.versammlung)).find((t) => t.knoten.titel === TITEL)!.knoten.id;
		await setzeGewaehltesErfordernis(h(), { meetingId: x.versammlung, stwegId: x.gemeinschaft }, grund[x.versammlung], 'k-verwaltung-gewoehnlich', null);
		await gibVersammlungFrei(h(), x.versammlung);
		await eroeffneVersammlung(h(), x.versammlung);
		for (const p of x.parteien) await bestaetigeAnwesenheit(h(), x.versammlung, p, 'von_hand');
		await stelleAufTraktandum(h(), x.versammlung, grund[x.versammlung]);
	}
	const schliessen = async () => {
		for (const x of [a, b]) {
			await schliesseVersammlung(h(), x.versammlung);
			for (const t of await holeTraktanden(betreiber, x.versammlung)) {
				if (t.knoten.art !== 'abstimmung' || t.knoten.titel === TITEL || t.knoten.spontanart) continue;
				await setzeProtokollnotiz(h(), x.versammlung, t.knoten.id, 'Beschluss: angenommen, von Hand gezählt.');
				await setzeBeschlussvermerk(h(), x.versammlung, t.knoten.id, true);
			}
		}
	};
	const punkt = async () => {
		const z = (await stelleAbendzusammenstellungZusammen(betreiber, tag.id, `${datum}T21:00:00.000Z`, 'Prüferin'))!;
		return z.text.slice(z.text.indexOf(`## 9 ${TITEL}`));
	};
	return { tag: tag.id, a, b, grund, schliessen, punkt };
}

/** Ja nur von der ersten Partei: 500 zu 500 Wertquoten. */
async function gleichstand(meetingId: string, id: string, parteien: string[]) {
	await oeffneAbstimmung(h(), meetingId, id);
	await gibStimmenAb(h(), meetingId, parteien.map((parteiId, i) => ({ parteiId, wahl: i === 0 ? ('yes' as const) : ('no' as const) })), true, 'Prüflauf: von der Sitzungsleitung erfasst');
	return schliesseAbstimmung(h(), meetingId);
}

async function alle(meetingId: string, id: string, parteien: string[], wahl: 'yes' | 'no') {
	await oeffneAbstimmung(h(), meetingId, id);
	await gibStimmenAb(h(), meetingId, parteien.map((parteiId) => ({ parteiId, wahl })), true, 'Prüflauf: von der Sitzungsleitung erfasst');
	return schliesseAbstimmung(h(), meetingId);
}

const anfrage = (tagId: string, pfad: string) =>
	({
		locals: {
			benutzer: { id: benutzer, operatorId: betreiber, username: 'pruefer-wertquoten-abend', displayName: 'Prüferin', role: 'admin' },
			herkunft: null
		},
		params: { id: tagId },
		url: new URL(`http://pruefung.example/${pfad}`)
	}) as never;

describe('Probe Wertquotenmehr am Abend, über Server und Loader', () => {
	it('Leitung des Abends: der offene Gleichstand trägt Zahlen und Zählweise (B5)', async () => {
		const r = await abend('Hangweg Leitung', '2029-05-02');
		const A = r.a.versammlung;
		await gleichstand(A, r.grund[A], r.a.parteien);
		const daten = (await leitungLoad(anfrage(r.tag, 'leitung'))) as unknown as Leitungsdaten;
		const e = daten.ergebnisse.find((x) => x.stichentscheidOffen);
		expect(e, 'kein offener Stichentscheid in den Ergebnissen der Abendleitung').toBeDefined();
		expect(e!.gleichstand).toBe(GLEICHSTAND);
	});

	it('Protokoll des Abends: Stichentscheid mit Person, Begründung und Gleichstand in Zahlen (B1)', async () => {
		const r = await abend('Hangweg Stich', '2029-05-03');
		const A = r.a.versammlung;
		const d = await gleichstand(A, r.grund[A], r.a.parteien);
		await haltStichentscheidFest(h(), A, d.id, {
			wahl: 'no',
			wer: 'Verwaltung Muster (erfunden)',
			begruendung: 'Prüflauf: Der Kostenrahmen ist nicht geklärt.'
		});
		await alle(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		expect(await r.punkt()).toContain(
			`- Bei Stimmengleichheit (${GLEICHSTAND}) entschied Verwaltung Muster (erfunden): Ablehnung. ` +
				'Begründung: Prüflauf: Der Kostenrahmen ist nicht geklärt.'
		);
	});

	it('Protokoll des Abends: nach einem Rückkommen der massgebende Durchgang und der ersetzte (B2)', async () => {
		const r = await abend('Hangweg Rückkommen', '2029-05-04');
		const A = r.a.versammlung;
		await alle(A, r.grund[A], r.a.parteien, 'no');
		const rk = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await alle(A, rk.id, r.a.parteien, 'yes');
		await stelleAufTraktandum(h(), A, r.grund[A]);
		await alle(A, r.grund[A], r.a.parteien, 'yes');
		await alle(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const punkt = await r.punkt();
		const grundzeile = punkt.slice(0, punkt.indexOf('####') >= 0 ? punkt.indexOf('####') : undefined);
		expect(grundzeile).toContain(
			'- 2. Durchgang.\n- Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt. Der Beschluss aus ' +
				'dem 1. Durchgang («abgelehnt») ist damit ersetzt'
		);
	});

	/*
	 * Ein Geschäft zur Abstimmung läuft am Abend je Haus als eigener Schritt
	 * (`abendschritte`; gemeinsam läuft nur eine Kenntnisnahme). Die Wand zeigt
	 * den Rückzug also für das Haus, das gerade aufgerufen ist, und folgt dem
	 * Aufruf ins nächste.
	 */
	it('Wand des Abends: ein Rückzug steht als Rückzug, und nur im Haus, das ihn hat (B4)', async () => {
		const r = await abend('Hangweg Wand', '2029-05-05');
		const [A, B] = [r.a.versammlung, r.b.versammlung];
		const wand = async () => (await wandLoad(anfrage(r.tag, 'praesentation'))) as unknown as Wanddaten;
		const vorher = await wand();
		expect(vorher.zurueckgezogen).toEqual([]);
		expect(vorher.alleZurueckgezogen).toBe(false);

		// Zuletzt aufgerufen ist Süd; dort wird zurückgezogen.
		await ziehAntragZurueck(h(), B, r.grund[B], 'Prüflauf: Die Offerte fehlt.');
		const sued = await wand();
		expect(sued.zurueckgezogen).toEqual([expect.stringMatching(/Süd/)]);
		expect(sued.alleZurueckgezogen).toBe(true);
		expect(sued.rueckzugsmarke).not.toBe(vorher.rueckzugsmarke);

		// Nord aufgerufen: dort steht der Antrag weiter an.
		await stelleAufTraktandum(h(), A, r.grund[A]);
		const nord = await wand();
		expect(nord.haeuser.find((x) => x.traktandumImSchritt === r.grund[A])).toBeDefined();
		expect(nord.zurueckgezogen).toEqual([]);
		expect(nord.alleZurueckgezogen).toBe(false);
	});
});
