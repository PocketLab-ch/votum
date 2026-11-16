/**
 * Das gemeinsame Abenddokument beim Antrag, über den nicht abgestimmt wurde,
 * weil Folgeanträge entschieden haben (Featureprüfung 2 zu F4c, M1,
 * 08.11.2026).
 *
 * **Der Anlass:** Am gemeinsamen Abend, unter dem Häkchen «Geschäft der
 * Verwaltung» (Lesart L8, Entscheid 0045, Punkt 9), wird die Wiederwahl als
 * Folgeantrag abgestimmt, und Votum sperrt danach den Grundantrag
 * (`teil_entschieden`). Das Hausprotokoll nannte den Grund, das Abenddokument
 * schrieb «Zu diesem Punkt liegt noch kein Ergebnis vor.», zählte den Punkt
 * zu `offeneErgebnisse` und blieb «ENTWURF». Ebenso im Bestandsfall ohne
 * Häkchen: Folgeantrag angenommen, Grundantrag nie abgestimmt.
 *
 * Gemessen wird je Fall: derselbe Satz beim Grundantrag im Abenddokument wie
 * im Hausprotokoll, der Punkt ist nicht offen, und nach dem Schluss der
 * Versammlung ist das Dokument kein Entwurf. Dazu die Gegenrichtung: ein
 * Folgeantrag, über den nicht entschieden ist, macht den Grundantrag nicht
 * entschieden.
 *
 * Drei Eigentümer zu 400, 300 und 300 von 1000; Hans Probe ist nur über die
 * Grosse Verwaltung AG da (Aufbau wie `lesart-verwaltungsvollmacht.test.ts`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis
} from '$lib/server/traktanden';
import {
	setzeBeschlussvermerk,
	setzeProtokollnotiz,
	stelleEntwurfZusammen
} from '$lib/server/protokoll';
import { bestaetigeAnwesenheit, lasseDurchDritteEin } from '$lib/server/anwesenheit';
import { erfasseVollmachten, holeParteien } from '$lib/server/vollmacht';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { ENTWURFSHINWEIS } from '$lib/domain/gemeinsamesprotokoll';
import { folgeantraegeAngenommenSatz, teileEntschiedenSatz } from '$lib/domain/protokoll';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });
const LEITUNG = 'Prüflauf: von der Sitzungsleitung erfasst';
const VERWALTUNG = 'Grosse Verwaltung AG';
const TITEL = 'Entlastung der Verwaltung';
const FOLGEANTRAG = 'Wiederwahl';
const OFFEN = 'Zu diesem Punkt liegt noch kein Ergebnis vor.';

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abend teilentschieden');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

type Fall = {
	/** Das Häkchen «Geschäft der Verwaltung» am Grundantrag. */
	haekchen: boolean;
	/** Der Folgeantrag: angenommen, abgelehnt oder nicht abgestimmt. */
	folgeantrag: 'angenommen' | 'abgelehnt' | 'offen';
};

const leer = (s: string) => s.replace(/\s+/g, ' ');

/** Ein Haus am Versammlungstag, der Grundantrag nie abgestimmt, danach geschlossen. */
async function abend(name: string, datum: string, fall: Fall) {
	const g = await erstelleGemeinschaft(h(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, q] of [400, 300, 300].entries()) {
		const e = await erstelleEinheit(h(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: q },
			countsAsHead: true
		});
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
	const tag = await erstelleVersammlungstag(h(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const v = await erstelleVersammlung(h(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(h(), tag.id, v.id, 0);
	await erstelleGeschaeft(h(), tag.id, {
		titel: TITEL,
		antragswortlaut: 'Die Verwaltung wird entlastet.',
		art: 'abstimmung',
		meetingIds: [v.id]
	});
	const grund = (await holeTraktanden(betreiber, v.id)).find((x) => x.knoten.titel === TITEL)!
		.knoten.id;
	await bearbeiteTraktandum(
		h(),
		v.id,
		grund,
		{
			meetingId: v.id,
			titel: TITEL,
			art: 'abstimmung',
			antragswortlaut: 'Die Verwaltung wird entlastet.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [],
			verwaltungsGeschaeft: fall.haekchen
		},
		'k-decharge'
	);
	await setzeGewaehltesErfordernis(h(), { meetingId: v.id, stwegId: g.id }, grund, 'k-decharge', null);
	await gibVersammlungFrei(h(), v.id);
	const moment = await holeParteien(betreiber, v.id);
	const m = parteien.map((id) => moment.find((p) => p.parteiId === id)!.id);
	await eroeffneVersammlung(h(), v.id);
	await erfasseVollmachten(h(), v.id, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [m[1]],
		istVerwaltung: true
	});
	await lasseDurchDritteEin(h(), v.id, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [m[1]],
		nachweisVorgelegt: true
	});
	for (const p of [parteien[0], parteien[2]]) await bestaetigeAnwesenheit(h(), v.id, p, 'von_hand');
	const f = await nimmTraktandumAuf(
		h(),
		{
			meetingId: v.id,
			parentId: grund,
			titel: FOLGEANTRAG,
			art: 'abstimmung',
			antragswortlaut: 'Die Verwaltung wird wiedergewählt.',
			antragstellerart: 'bewirtschaftung',
			antragstellerId: null,
			antragstellerIds: [],
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await setzeGewaehltesErfordernis(
		h(),
		{ meetingId: v.id, stwegId: g.id },
		f.id,
		'k-bewirtschaftung-waehlen',
		null
	);
	if (fall.folgeantrag !== 'offen') {
		await oeffneAbstimmung(h(), v.id, f.id);
		const wahl = fall.folgeantrag === 'angenommen' ? ('yes' as const) : ('no' as const);
		await gibStimmenAb(
			h(),
			v.id,
			parteien.map((parteiId) => ({ parteiId, wahl })),
			true,
			LEITUNG
		);
		await schliesseAbstimmung(h(), v.id);
	}
	const nummer = (await holeTraktanden(betreiber, v.id)).find((x) => x.knoten.id === f.id)!.nummer;
	// Die Sperre nur, wo sie greifen muss: Ein Eröffnen, das gelänge, legte
	// am Grundantrag einen Durchgang an, und er wäre nicht mehr «nie abgestimmt».
	const sperre =
		fall.haekchen && fall.folgeantrag !== 'offen'
			? await oeffneAbstimmung(h(), v.id, grund).then(
					() => 'geöffnet',
					(x) => x
				)
			: null;
	await schliesseVersammlung(h(), v.id);
	/*
	 * **Die übrigen Abstimmungen der Liste entschieden** (Beschlussvermerk,
	 * Block 7): Die Liste des Abends trägt neben dem Grundantrag weitere
	 * Punkte. Ohne Vermerk blieben sie offen, und das Dokument wäre Entwurf,
	 * gleich was beim Grundantrag steht. So hängt der Entwurf allein an ihm.
	 */
	for (const t of await holeTraktanden(betreiber, v.id)) {
		if (t.knoten.art !== 'abstimmung' || t.knoten.id === grund || t.knoten.id === f.id) continue;
		await setzeProtokollnotiz(h(), v.id, t.knoten.id, 'Beschluss: angenommen, von Hand gezählt.');
		await setzeBeschlussvermerk(h(), v.id, t.knoten.id, true);
	}
	const haus = leer(await stelleEntwurfZusammen(betreiber, v.id, new Date().toISOString(), 'Prüflauf'));
	const a = (await stelleAbendzusammenstellungZusammen(
		betreiber,
		tag.id,
		`${datum}T21:00:00.000Z`,
		'Prüferin'
	))!;
	return { nummer, sperre, haus, a };
}

/** Der Abschnitt des Abenddokuments zum Grundantrag, bis zur nächsten Überschrift. */
function abschnitt(text: string): string {
	const von = text.indexOf(TITEL);
	expect(von).toBeGreaterThanOrEqual(0);
	const bis = text.indexOf('\n#', von);
	return leer(text.slice(von, bis < 0 ? undefined : bis));
}

describe('Abenddokument: der Grundantrag, über den Folgeanträge entschieden haben', () => {
	it('unter dem Häkchen, Wiederwahl abgelehnt: der Satz zur Sperre wie im Hausprotokoll', async () => {
		const r = await abend('Abendweg 1', '2028-12-01', { haekchen: true, folgeantrag: 'abgelehnt' });
		expect(r.sperre).toMatchObject({ kennung: 'teil_entschieden' });
		const satz = teileEntschiedenSatz([{ nummer: r.nummer, titel: FOLGEANTRAG, art: 'wahl' }]);
		expect(r.haus).toContain(satz);
		expect(abschnitt(r.a.text)).toContain(satz);
		expect(abschnitt(r.a.text)).not.toContain(OFFEN);
		expect(r.a.offeneErgebnisse).toBe(0);
		expect(r.a.luecke).toBeNull();
		expect(r.a.text).not.toContain(ENTWURFSHINWEIS);
	});

	it('unter dem Häkchen, Wiederwahl angenommen: «gegenstandslos» wie im Hausprotokoll', async () => {
		const r = await abend('Abendweg 2', '2028-12-02', { haekchen: true, folgeantrag: 'angenommen' });
		expect(r.sperre).toMatchObject({ kennung: 'teil_entschieden' });
		const satz = folgeantraegeAngenommenSatz([{ nummer: r.nummer, titel: FOLGEANTRAG }]);
		expect(r.haus).toContain(satz);
		expect(abschnitt(r.a.text)).toContain(satz);
		expect(abschnitt(r.a.text)).not.toContain(OFFEN);
		expect(r.a.offeneErgebnisse).toBe(0);
		expect(r.a.luecke).toBeNull();
		expect(r.a.text).not.toContain(ENTWURFSHINWEIS);
	});

	it('Bestand ohne Häkchen: Folgeantrag angenommen, Grundantrag nie abgestimmt', async () => {
		const r = await abend('Abendweg 3', '2028-12-03', { haekchen: false, folgeantrag: 'angenommen' });
		const satz = folgeantraegeAngenommenSatz([{ nummer: r.nummer, titel: FOLGEANTRAG }]);
		expect(r.haus).toContain(satz);
		expect(abschnitt(r.a.text)).toContain(satz);
		expect(abschnitt(r.a.text)).not.toContain(OFFEN);
		expect(r.a.offeneErgebnisse).toBe(0);
		expect(r.a.luecke).toBeNull();
	});

	it('Gegenrichtung: ein Folgeantrag ohne Entscheid lässt den Grundantrag offen', async () => {
		const r = await abend('Abendweg 4', '2028-12-04', { haekchen: true, folgeantrag: 'offen' });
		const text = abschnitt(r.a.text);
		expect(text).toContain(OFFEN);
		expect(text).not.toMatch(/Über diesen Antrag wurde nicht abgestimmt/);
		// Der Grundantrag und, seit er eine eigene Zeile hat, der Folgeantrag
		// selbst (Produktentscheid 08.11.2026).
		expect(r.a.offeneErgebnisse).toBe(2);
		expect(r.a.luecke).toBe('2 Punkte ohne Ergebnis');
		expect(r.a.text).toContain(ENTWURFSHINWEIS);
	});
});
