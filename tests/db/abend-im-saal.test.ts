/**
 * Das Protokoll des gemeinsamen Abends: zurückgezogene Anträge, Rückkommen und
 * im Saal Aufgenommenes (Kriterien 4 und 5 des Auftrags
 * `2026-11-16-votum-erste-versammlung-wertquoten-abend-h1.md`).
 *
 * **Gemessen vor dem Bau (16.11.2026):** Ein zurückgezogener Grundantrag stand
 * als «Zu diesem Punkt liegt noch kein Ergebnis vor.» da, und das Dokument
 * blieb Entwurf; die Tafel zählte jeden zurückgezogenen Antrag als offen. Ein
 * Rückkommen hatte keine eigene Zeile, ein abgelehntes stand gar nicht darin,
 * und eine im Saal aufgenommene Kenntnisnahme fehlte. Folgeanträge nach einem
 * Rückkommen hängen am Grundantrag und hatten schon ihre Zeile; einen
 * Folgeantrag an einem Rückkommen oder an einem neuen Geschäft gibt es nicht
 * (`hindernisAlsGrundantrag`), und ein neues Geschäft zur Abstimmung lässt
 * Votum am Abend nicht zu.
 *
 * Erfundene Gemeinschaften und Namen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, schliesseVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, holeTafel, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft, vereinheitlicheListe } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis,
	stelleRueckkommensantrag,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { setzeBeschlussvermerk, setzeProtokollnotiz } from '$lib/server/protokoll';
import { gibStimmenAb, haltBeschlussVonHandFest, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });
const TITEL = 'Ersatz der Hecke';

beforeAll(async () => {
	betreiber = await pruefbetreiber('Messung Abend im Saal');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

async function haus(name: string, datum: string, tagId: string, stelle: number) {
	const g = await erstelleGemeinschaft(h(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, q] of [400, 300, 300].entries()) {
		const e = await erstelleEinheit(h(), { stwegId: g.id, kind: 'unit', label: `Whg ${i + 1}`, quotas: { stamm: q }, countsAsHead: true });
		const p = await erstelleEigentuemer(h(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe', 'Kurt Beispiel'][i],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(h(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(h(), {
		stwegId: g.id, datum, uhrzeit: '19:00', ort: 'Prüfsaal', art: 'ordentlich', stufe: 'erste', betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(h(), tagId, v.id, stelle);
	return { gemeinschaft: g.id, versammlung: v.id, parteien };
}

async function stimme(meetingId: string, id: string, parteien: string[], wahl: 'yes' | 'no') {
	await oeffneAbstimmung(h(), meetingId, id);
	await gibStimmenAb(h(), meetingId, parteien.map((parteiId) => ({ parteiId, wahl })), true, 'Prüflauf: von der Sitzungsleitung erfasst');
	await schliesseAbstimmung(h(), meetingId);
}

const OFFEN = 'Zu diesem Punkt liegt noch kein Ergebnis vor.';
const RUECKZUG = 'Kommt an die nächste Versammlung.';

/** Der Abend: zwei Häuser, ein gemeinsames Geschäft, alles andere mit Beschlussvermerk. */
async function abend(name: string, datum: string) {
	const tag = await erstelleVersammlungstag(h(), { bezeichnung: `${name}, Abend`, datum, uhrzeit: '19:00', ort: 'Prüfsaal', art: 'ordentlich' });
	const a = await haus(`${name} A`, datum, tag.id, 0);
	const b = await haus(`${name} B`, datum, tag.id, 1);
	await erstelleGeschaeft(h(), tag.id, { titel: TITEL, antragswortlaut: 'Die Hecke wird ersetzt.', art: 'abstimmung', meetingIds: [a.versammlung, b.versammlung] });
	const grund: Record<string, string> = {};
	for (const x of [a, b]) {
		grund[x.versammlung] = (await holeTraktanden(betreiber, x.versammlung)).find((t) => t.knoten.titel === TITEL)!.knoten.id;
		await setzeGewaehltesErfordernis(h(), { meetingId: x.versammlung, stwegId: x.gemeinschaft }, grund[x.versammlung], 'k-verwaltung-gewoehnlich', null);
		await gibVersammlungFrei(h(), x.versammlung);
		await eroeffneVersammlung(h(), x.versammlung);
		for (const p of x.parteien) await bestaetigeAnwesenheit(h(), x.versammlung, p, 'von_hand');
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
	const stand = async () => {
		const z = (await stelleAbendzusammenstellungZusammen(betreiber, tag.id, `${datum}T21:00:00.000Z`, 'Prüferin'))!;
		const summe = (await holeTafel(betreiber, tag.id)).reduce((n, x) => n + x.offeneTraktanden, 0);
		return { z, summe, punkt: z.text.slice(z.text.indexOf(`## 9 ${TITEL}`)) };
	};
	return { tag: tag.id, a, b, grund, schliessen, stand };
}

describe('Zurückgezogener Grundantrag am Abend (Kriterium 4)', () => {
	it('gilt in Tafel und Dokument als entschieden, und das Dokument ist kein Entwurf mehr', async () => {
		const r = await abend('Heckenweg 1', '2029-03-05');
		await stimme(r.a.versammlung, r.grund[r.a.versammlung], r.a.parteien, 'yes');
		await ziehAntragZurueck(h(), r.b.versammlung, r.grund[r.b.versammlung], RUECKZUG);
		await r.schliessen();
		const { z, summe, punkt } = await r.stand();
		expect(punkt).toContain(`Vor der Abstimmung zurückgezogen: ${RUECKZUG}`);
		expect(punkt.split('\n## ')[0]).not.toContain(OFFEN);
		expect(z.offeneErgebnisse).toBe(0);
		expect(summe).toBe(z.offeneErgebnisse);
		expect(z.luecke).toBeNull();
	});

	it('ein nie abgestimmter, nicht zurückgezogener Grundantrag bleibt offen (Gegenprobe)', async () => {
		const r = await abend('Heckenweg 2', '2029-03-06');
		await stimme(r.a.versammlung, r.grund[r.a.versammlung], r.a.parteien, 'yes');
		await r.schliessen();
		const { z, summe } = await r.stand();
		expect(z.offeneErgebnisse).toBe(1);
		expect(summe).toBe(1);
		expect(z.luecke).not.toBeNull();
	});
});

describe('Rückkommen und im Saal Aufgenommenes mit eigener Zeile (Kriterium 5)', () => {
	it('angenommenes Rückkommen mit Folgeantrag: beide mit eigener Zeile, gezählt wie die Tafel', async () => {
		const r = await abend('Heckenweg 3', '2029-03-07');
		const A = r.a.versammlung;
		await stimme(A, r.grund[A], r.a.parteien, 'yes');
		const rk = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(A, rk.id, r.a.parteien, 'yes');
		const f = await nimmTraktandumAuf(h(), { meetingId: A, parentId: r.grund[A], titel: 'Nur die Südseite', art: 'abstimmung', antragswortlaut: 'Nur die Südseite.', antragstellerart: 'bewirtschaftung', betroffeneParteiIds: [] }, 'folgeantrag');
		await setzeGewaehltesErfordernis(h(), { meetingId: A, stwegId: r.a.gemeinschaft }, f.id, 'k-verwaltung-gewoehnlich', null);
		await stimme(A, f.id, r.a.parteien, 'yes');
		await stimme(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const { z, summe, punkt } = await r.stand();
		const nr = (await holeTraktanden(betreiber, A)).find((t) => t.knoten.id === rk.id)!.nummer;
		expect(punkt).toMatch(new RegExp(`#### ${nr.replace(/\./g, '\\.')} Rückkommen auf`));
		expect(punkt).toContain('«Nur die Südseite»');
		// Die Rückkommenszeile steht vor dem Folgeantrag und trägt ein Ergebnis.
		const rueck = punkt.slice(punkt.indexOf(`#### ${nr} Rückkommen`), punkt.indexOf('Folgeantrag', punkt.indexOf(`#### ${nr} Rückkommen`)));
		expect(rueck).toMatch(/Angenommen/);
		expect(rueck).not.toContain('Damit bleibt es beim bisherigen Ergebnis');
		expect(rueck).not.toContain(OFFEN);
		expect(summe).toBe(z.offeneErgebnisse);
		expect(z.luecke).toBeNull();
	});

	it('abgelehntes Rückkommen steht mit Ergebnis im Dokument', async () => {
		const r = await abend('Heckenweg 4', '2029-03-08');
		const A = r.a.versammlung;
		await stimme(A, r.grund[A], r.a.parteien, 'yes');
		const rk = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(A, rk.id, r.a.parteien, 'no');
		await stimme(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const { z, summe, punkt } = await r.stand();
		expect(punkt).toMatch(/#### \S+ Rückkommen auf/);
		expect(punkt).toMatch(/Abgelehnt/);
		// Laienprüfung Runde 2, R2-L6: was daraus folgt.
		const grundNr = (await holeTraktanden(betreiber, A)).find((t) => t.knoten.id === r.grund[A])!.nummer;
		expect(punkt).toContain(`Damit bleibt es beim bisherigen Ergebnis zu Traktandum ${grundNr}.`);
		expect(summe).toBe(z.offeneErgebnisse);
		expect(z.luecke).toBeNull();
	});

	it('gestelltes, nie abgestimmtes Rückkommen zählt in Tafel und Dokument als offen', async () => {
		const r = await abend('Heckenweg 5', '2029-03-09');
		const A = r.a.versammlung;
		await stimme(A, r.grund[A], r.a.parteien, 'yes');
		await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const { z, summe, punkt } = await r.stand();
		expect(z.offeneErgebnisse).toBe(1);
		expect(summe).toBe(1);
		expect(punkt).toContain(OFFEN);
	});

	it('im Saal aufgenommene Kenntnisnahme steht als eigener Punkt und zählt nicht', async () => {
		const r = await abend('Heckenweg 6', '2029-03-10');
		const A = r.a.versammlung;
		await nimmTraktandumAuf(h(), { meetingId: A, parentId: null, titel: 'Mitteilung zum Veloraum', art: 'kenntnisnahme', antragstellerart: 'gemeinschaft', betroffeneParteiIds: [] });
		for (const x of [r.a, r.b]) await stimme(x.versammlung, r.grund[x.versammlung], x.parteien, 'yes');
		await r.schliessen();
		const { z, summe } = await r.stand();
		expect(z.text).toMatch(/## Im Saal aufgenommen, Heckenweg 6 A: \S+ Mitteilung zum Veloraum/);
		expect(z.text).toContain('Zur Kenntnis genommen; es wurde nicht abgestimmt.');
		expect(z.offeneErgebnisse).toBe(0);
		expect(summe).toBe(0);
		expect(z.luecke).toBeNull();
	});

	it('nach dem Aufruf der Seite «Geschäfte» steht sie nur einmal da (Codeprüfung Block B, M3)', async () => {
		const r = await abend('Heckenweg 7', '2029-03-11');
		const A = r.a.versammlung;
		await nimmTraktandumAuf(h(), { meetingId: A, parentId: null, titel: 'Mitteilung zur Waschküche', art: 'kenntnisnahme', antragstellerart: 'gemeinschaft', betroffeneParteiIds: [] });
		for (const x of [r.a, r.b]) await stimme(x.versammlung, r.grund[x.versammlung], x.parteien, 'yes');
		await r.schliessen();
		await vereinheitlicheListe(h(), r.tag);
		const { z } = await r.stand();
		expect(z.text.split('Mitteilung zur Waschküche').length - 1).toBe(1);
	});

	it('mit einem Beschluss von Hand trägt sie das Ergebnis (Codeprüfung Block B, M1)', async () => {
		const r = await abend('Heckenweg 8', '2029-03-12');
		const A = r.a.versammlung;
		const k = await nimmTraktandumAuf(h(), { meetingId: A, parentId: null, titel: 'Mitteilung zum Dach', art: 'kenntnisnahme', antragstellerart: 'gemeinschaft', betroffeneParteiIds: [] });
		await haltBeschlussVonHandFest(h(), A, k.id, {
			ergebnis: 'angenommen',
			zahlen: { erfassung: 'summen', koepfe: { ja: 3, nein: 0, enthaltung: 0 }, quoten: { ja: 1000, nein: 0, enthaltung: 0 } }
		});
		for (const x of [r.a, r.b]) await stimme(x.versammlung, r.grund[x.versammlung], x.parteien, 'yes');
		await r.schliessen();
		const { z, summe } = await r.stand();
		const abschnitt = z.text.slice(z.text.indexOf('Mitteilung zum Dach'));
		expect(abschnitt.split('\n## ')[0]).toMatch(/Angenommen/);
		expect(abschnitt.split('\n## ')[0]).not.toContain('Zur Kenntnis genommen');
		expect(summe).toBe(z.offeneErgebnisse);
	});

	it('nach einer Ersetzung durch einen Folgeantrag: der Satz auch am ersetzten Grundantrag (zweiter Durchgang, Befund 1)', async () => {
		const r = await abend('Heckenweg 10', '2029-03-14');
		const A = r.a.versammlung;
		await stimme(A, r.grund[A], r.a.parteien, 'yes');
		const rk1 = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(A, rk1.id, r.a.parteien, 'yes');
		const f = await nimmTraktandumAuf(h(), { meetingId: A, parentId: r.grund[A], titel: 'Nur die Nordseite', art: 'abstimmung', antragswortlaut: 'Nur die Nordseite.', antragstellerart: 'bewirtschaftung', betroffeneParteiIds: [] }, 'folgeantrag');
		await setzeGewaehltesErfordernis(h(), { meetingId: A, stwegId: r.a.gemeinschaft }, f.id, 'k-verwaltung-gewoehnlich', null);
		await stimme(A, f.id, r.a.parteien, 'yes');
		const rk2 = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(A, rk2.id, r.a.parteien, 'yes');
		await stimme(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const { punkt } = await r.stand();
		// Am Grundantrag der Satz, auf den das Rückkommen verweist.
		const grundzeile = punkt.slice(0, punkt.indexOf('####'));
		expect(grundzeile).toMatch(/Die Versammlung hat beschlossen, auf dieses Traktandum zurückzukommen/);
		expect(grundzeile).toMatch(/Es bleibt beim Beschluss zum Folgeantrag/);
	});

	it('angenommenes Rückkommen ohne neue Abstimmung: derselbe Satz wie im Hausprotokoll (Codeprüfung Block B, N2)', async () => {
		const r = await abend('Heckenweg 9', '2029-03-13');
		const A = r.a.versammlung;
		await stimme(A, r.grund[A], r.a.parteien, 'yes');
		const rk = await stelleRueckkommensantrag(h(), A, r.grund[A]);
		await stimme(A, rk.id, r.a.parteien, 'yes');
		await stimme(r.b.versammlung, r.grund[r.b.versammlung], r.b.parteien, 'yes');
		await r.schliessen();
		const { punkt } = await r.stand();
		expect(punkt).toMatch(/erneut abgestimmt wurde nicht/i);
	});
});
