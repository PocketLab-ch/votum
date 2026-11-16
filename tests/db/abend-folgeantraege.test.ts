/**
 * Folgeanträge mit eigener Zeile im gemeinsamen Abenddokument, und Tafel und
 * Leiste zählen wie das Protokoll (Produktentscheid 08.11.2026, Entscheid
 * 0045, Punkt 11; Produktentscheid 02.10.2026, «Leiste und Tafel zählen wie
 * das Protokoll»).
 *
 * **Der Anlass:** Folgeanträge entstehen am Abend je Haus und standen in
 * keiner gemeinsamen Liste. Das Abenddokument, das am Abend das Protokoll
 * ist, nannte beim Grundantrag den Satz «Über diesen Antrag wurde nicht
 * abgestimmt: …», hatte aber keine Zeile zum Folgeantrag, auf den er
 * verweist; eine abgelehnte Wahl war dort nur «entschieden», und der
 * Abschnitt «Anfechtung» fehlte, wo die Wahl den einzigen Beschluss trug.
 * Die Tafel zählte dazu den gesperrten oder gegenstandslosen Grundantrag als
 * offen, während das Abenddokument kein Entwurf mehr war.
 *
 * Zwei Häuser unter einem Punkt (Sammelpunkt): Im ersten wird der Grundantrag
 * mit dem Häkchen «Geschäft der Verwaltung» über Folgeanträge zur Wiederwahl
 * und zur Entschädigung entschieden (Entscheid 0045, Punkt 9), im zweiten
 * über den Antrag selbst. Drei Eigentümer zu 400, 300 und 300 von 1000; im
 * ersten Haus ist Hans Probe nur über die Grosse Verwaltung AG da (Aufbau wie
 * `abend-teilentschieden.test.ts`).
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
import { erstelleVersammlungstag, holeTafel, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import {
	holeOhneErgebnisUndVermerk,
	setzeBeschlussvermerk,
	setzeProtokollnotiz,
	stelleEntwurfZusammen
} from '$lib/server/protokoll';
import { bestaetigeAnwesenheit, lasseDurchDritteEin } from '$lib/server/anwesenheit';
import { erfasseVollmachten, holeParteien } from '$lib/server/vollmacht';
import { gibStimmenAb, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { ENTWURFSHINWEIS, protokollluecke } from '$lib/domain/gemeinsamesprotokoll';
import { folgeantraegeAngenommenSatz, teileEntschiedenSatz } from '$lib/domain/protokoll';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });
const LEITUNG = 'Prüflauf: von der Sitzungsleitung erfasst';
const VERWALTUNG = 'Grosse Verwaltung AG';
const TITEL = 'Entlastung und Wiederwahl der Verwaltung';
const WAHL = 'Wiederwahl';
const ENTSCHAEDIGUNG = 'Entschädigung';
const OFFEN = 'Zu diesem Punkt liegt noch kein Ergebnis vor.';
const RUECKZUG = 'Kommt mit voller Frist an die nächste Versammlung.';

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abend Folgeanträge');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

const leer = (s: string) => s.replace(/\s+/g, ' ');

type Fall = {
	/** Der Folgeantrag zur Wiederwahl im ersten Haus. */
	wahl: 'angenommen' | 'abgelehnt' | 'offen' | 'zurueckgezogen';
	/** Der Folgeantrag zur Entschädigung im ersten Haus; «keiner»: nicht aufgenommen. */
	entschaedigung: 'angenommen' | 'offen' | 'keiner';
	/** Der Antrag im zweiten Haus, über ihn selbst abgestimmt oder nicht. */
	zweites: 'angenommen' | 'offen';
	/**
	 * Die übrigen Punkte der Liste mit Beschlussvermerk entschieden (Block 7),
	 * damit Entwurf und Anfechtung allein an diesem Punkt hängen.
	 */
	uebrigeVermerkt: boolean;
};

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
	const v = await erstelleVersammlung(h(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(h(), tagId, v.id, stelle);
	return { gemeinschaft: g.id, name, versammlung: v.id, parteien };
}

async function stimme(meetingId: string, traktandumId: string, abgaben: { parteiId: string; wahl: 'yes' | 'no' }[]) {
	await oeffneAbstimmung(h(), meetingId, traktandumId);
	await gibStimmenAb(h(), meetingId, abgaben, true, LEITUNG);
	await schliesseAbstimmung(h(), meetingId);
}

async function folgeantrag(
	a: { versammlung: string; gemeinschaft: string },
	grund: string,
	titel: string,
	knoten: string
) {
	const f = await nimmTraktandumAuf(
		h(),
		{
			meetingId: a.versammlung,
			parentId: grund,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel}: wie beantragt.`,
			antragstellerart: 'bewirtschaftung',
			antragstellerId: null,
			antragstellerIds: [],
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await setzeGewaehltesErfordernis(h(), { meetingId: a.versammlung, stwegId: a.gemeinschaft }, f.id, knoten, null);
	return f.id;
}

/** Der Abend mit zwei Häusern unter einem Punkt, beide danach geschlossen. */
async function abend(name: string, datum: string, fall: Fall) {
	const tag = await erstelleVersammlungstag(h(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const a = await haus(`${name} A`, datum, tag.id, 0);
	const b = await haus(`${name} B`, datum, tag.id, 1);
	await erstelleGeschaeft(h(), tag.id, {
		titel: TITEL,
		antragswortlaut: 'Die Verwaltung wird entlastet und wiedergewählt.',
		art: 'abstimmung',
		meetingIds: [a.versammlung, b.versammlung]
	});
	const grund: Record<string, string> = {};
	for (const x of [a, b]) {
		grund[x.versammlung] = (await holeTraktanden(betreiber, x.versammlung)).find(
			(t) => t.knoten.titel === TITEL
		)!.knoten.id;
		await bearbeiteTraktandum(
			h(),
			x.versammlung,
			grund[x.versammlung],
			{
				meetingId: x.versammlung,
				titel: TITEL,
				art: 'abstimmung',
				antragswortlaut: 'Die Verwaltung wird entlastet und wiedergewählt.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: [],
				// Das Häkchen nur im ersten Haus.
				verwaltungsGeschaeft: x === a
			},
			'k-decharge'
		);
		await setzeGewaehltesErfordernis(
			h(),
			{ meetingId: x.versammlung, stwegId: x.gemeinschaft },
			grund[x.versammlung],
			'k-decharge',
			null
		);
		await gibVersammlungFrei(h(), x.versammlung);
		await eroeffneVersammlung(h(), x.versammlung);
	}

	// Das erste Haus: Hans Probe über die Verwaltung, die übrigen selbst.
	const moment = await holeParteien(betreiber, a.versammlung);
	const vertreten = moment.find((p) => p.parteiId === a.parteien[1])!.id;
	await erfasseVollmachten(h(), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [vertreten],
		istVerwaltung: true
	});
	await lasseDurchDritteEin(h(), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [vertreten],
		nachweisVorgelegt: true
	});
	for (const p of [a.parteien[0], a.parteien[2]]) await bestaetigeAnwesenheit(h(), a.versammlung, p, 'von_hand');
	for (const p of b.parteien) await bestaetigeAnwesenheit(h(), b.versammlung, p, 'von_hand');

	const wahl = await folgeantrag(a, grund[a.versammlung], WAHL, 'k-bewirtschaftung-waehlen');
	const entschaedigung =
		fall.entschaedigung === 'keiner'
			? null
			: await folgeantrag(a, grund[a.versammlung], ENTSCHAEDIGUNG, 'k-verwaltung-gewoehnlich');
	if (fall.wahl === 'zurueckgezogen') {
		await ziehAntragZurueck(h(), a.versammlung, wahl, RUECKZUG);
	} else if (fall.wahl !== 'offen') {
		const w = fall.wahl === 'angenommen' ? ('yes' as const) : ('no' as const);
		await stimme(a.versammlung, wahl, a.parteien.map((parteiId) => ({ parteiId, wahl: w })));
	}
	if (entschaedigung && fall.entschaedigung === 'angenommen') {
		// Unter dem Häkchen ruhen die Vollmachten der Verwaltung (L8, Vorgabe
		// «ruhen»): Hans Probe stimmt hier nicht.
		await stimme(a.versammlung, entschaedigung, [
			{ parteiId: a.parteien[0], wahl: 'yes' },
			{ parteiId: a.parteien[2], wahl: 'yes' }
		]);
	}
	if (fall.zweites === 'angenommen') {
		await stimme(b.versammlung, grund[b.versammlung], b.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const })));
	}
	for (const x of [a, b]) await schliesseVersammlung(h(), x.versammlung);
	if (fall.uebrigeVermerkt) {
		for (const x of [a, b]) {
			for (const t of await holeTraktanden(betreiber, x.versammlung)) {
				if (t.knoten.art !== 'abstimmung' || t.knoten.titel === TITEL || t.knoten.spontanart) continue;
				await setzeProtokollnotiz(h(), x.versammlung, t.knoten.id, 'Beschluss: angenommen, von Hand gezählt.');
				await setzeBeschlussvermerk(h(), x.versammlung, t.knoten.id, true);
			}
		}
	}
	const nummern = new Map(
		(await holeTraktanden(betreiber, a.versammlung)).map((t) => [t.knoten.id, t.nummer])
	);
	const stand = async () => {
		const z = (await stelleAbendzusammenstellungZusammen(betreiber, tag.id, `${datum}T21:00:00.000Z`, 'Prüferin'))!;
		const tafel = await holeTafel(betreiber, tag.id);
		const summe = tafel.reduce((n, x) => n + x.offeneTraktanden, 0);
		// Die Leiste rechnet aus derselben Summe (`routes/tage/[id]/+layout.server.ts`).
		const leiste = protokollluecke({ versammlungen: tafel.length, offeneErgebnisse: summe, nichtGeschlossen: 0 });
		return { z, summe, leiste };
	};
	return {
		tag: tag.id,
		a,
		b,
		wahl: { id: wahl, nummer: nummern.get(wahl)! },
		entschaedigung: entschaedigung ? { id: entschaedigung, nummer: nummern.get(entschaedigung)! } : null,
		hausA: () => stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf'),
		stand
	};
}

/** Der Abschnitt des Punkts, vom Titel bis zur nächsten Überschrift der Ebene 2. */
function punkt(text: string): string {
	const von = text.indexOf(`${TITEL}\n`);
	expect(von).toBeGreaterThanOrEqual(0);
	const bis = text.indexOf('\n## ', von);
	return text.slice(von, bis < 0 ? undefined : bis);
}

/** Ein Block unter einer Überschrift, bis zur nächsten Überschrift. */
function block(text: string, ueberschrift: string): string {
	const von = text.indexOf(ueberschrift);
	expect(von, ueberschrift).toBeGreaterThanOrEqual(0);
	const bis = text.indexOf('\n#', von + ueberschrift.length);
	return leer(text.slice(von, bis < 0 ? undefined : bis));
}

describe('Abenddokument: Folgeanträge mit eigener Zeile (Produktentscheid 08.11.2026)', () => {
	it('Wahl abgelehnt, Entschädigung angenommen: je eine Zeile mit Ergebnis unter dem ersten Haus', async () => {
		const r = await abend('Folgeweg 1', '2029-01-08', {
			wahl: 'abgelehnt',
			entschaedigung: 'angenommen',
			zweites: 'angenommen',
			uebrigeVermerkt: true
		});
		const { z, summe, leiste } = await r.stand();
		const p = punkt(z.text);
		const n = /^### (\d+)\.1 Folgeweg 1 A$/m.exec(p)?.[1];
		expect(n, p).toBeDefined();

		// Der Grundantrag behält seinen Satz, mit der Nummer, unter der der
		// Folgeantrag darunter steht. Nach Bestand macht jeder angenommene
		// Folgeantrag ihn gegenstandslos, hier die Entschädigung
		// (`angenommeneFolgeantraege`, Produktentscheid 21.08.2026).
		const satz = folgeantraegeAngenommenSatz([{ nummer: r.entschaedigung!.nummer, titel: ENTSCHAEDIGUNG }]);
		expect(block(p, `### ${n}.1 Folgeweg 1 A`)).toContain(satz);
		expect(leer(await r.hausA())).toContain(satz);

		const wahl = block(p, `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`);
		expect(wahl).toContain(`Antrag: ${WAHL}: wie beantragt.`);
		expect(wahl).toMatch(/Abgelehnt/);
		expect(wahl).not.toContain(OFFEN);
		// Ohne Eigentümernamen, wie die Zeile des Hauses.
		expect(wahl).not.toMatch(/Hans Probe|Erika Beispiel|Kurt Beispiel/);
		expect(wahl).toMatch(/Angewandtes Erfordernis/);

		const entschaedigung = block(p, `#### Folgeantrag ${r.entschaedigung!.nummer} «${ENTSCHAEDIGUNG}»`);
		expect(entschaedigung).toMatch(/Angenommen/);
		expect(entschaedigung).not.toMatch(/Hans Probe|Erika Beispiel|Kurt Beispiel/);

		// Folge: Haus, seine Folgeanträge nach Nummer, dann das zweite Haus.
		const lagen = [
			`### ${n}.1 Folgeweg 1 A`,
			`#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`,
			`#### Folgeantrag ${r.entschaedigung!.nummer} «${ENTSCHAEDIGUNG}»`,
			`### ${n}.2 Folgeweg 1 B`
		].map((u) => p.indexOf(u));
		expect([...lagen].sort((x, y) => x - y)).toEqual(lagen);
		expect(block(p, `### ${n}.2 Folgeweg 1 B`)).toMatch(/Angenommen/);

		// Jede Überschrift des Dokuments genau einmal: Die Nummer des
		// Folgeantrags im Haus und die der Hauszeile verwechseln sich nicht.
		const ueberschriften = z.text.split('\n').filter((l) => /^#{2,6} \d/.test(l) || /^#{2,6} Folgeantrag /.test(l));
		expect(new Set(ueberschriften).size).toBe(ueberschriften.length);

		expect(z.offeneErgebnisse).toBe(0);
		expect(z.luecke).toBeNull();
		expect(z.text).not.toContain(ENTWURFSHINWEIS);
		// B: Tafel und Leiste zählen wie das Protokoll.
		expect(summe).toBe(z.offeneErgebnisse);
		expect(leiste).toBeNull();
	});

	it('Wahl angenommen: der Grundantrag gegenstandslos, die Wahl mit eigener Zeile', async () => {
		const r = await abend('Folgeweg 2', '2029-01-09', {
			wahl: 'angenommen',
			entschaedigung: 'angenommen',
			zweites: 'angenommen',
			uebrigeVermerkt: true
		});
		const { z, summe, leiste } = await r.stand();
		const p = punkt(z.text);
		const satz = folgeantraegeAngenommenSatz([
			{ nummer: r.wahl.nummer, titel: WAHL },
			{ nummer: r.entschaedigung!.nummer, titel: ENTSCHAEDIGUNG }
		]);
		expect(leer(p)).toContain(satz);
		expect(leer(await r.hausA())).toContain(satz);
		const wahl = block(p, `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`);
		expect(wahl).toMatch(/Angenommen/);
		expect(block(p, `#### Folgeantrag ${r.entschaedigung!.nummer} «${ENTSCHAEDIGUNG}»`)).toMatch(/Angenommen/);
		expect(z.offeneErgebnisse).toBe(0);
		expect(summe).toBe(z.offeneErgebnisse);
		expect(leiste).toBeNull();
	});

	it('Wahl abgelehnt, keine Entschädigung: der gesperrte Grundantrag ist auf der Tafel nicht offen', async () => {
		const r = await abend('Folgeweg 5', '2029-01-12', {
			wahl: 'abgelehnt',
			entschaedigung: 'keiner',
			zweites: 'angenommen',
			uebrigeVermerkt: true
		});
		const { z, summe, leiste } = await r.stand();
		const p = punkt(z.text);
		const satz = teileEntschiedenSatz([{ nummer: r.wahl.nummer, titel: WAHL, art: 'wahl' }]);
		expect(leer(p)).toContain(satz);
		expect(leer(await r.hausA())).toContain(satz);
		expect(block(p, `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`)).toMatch(/Abgelehnt/);
		expect(z.offeneErgebnisse).toBe(0);
		expect(summe).toBe(z.offeneErgebnisse);
		expect(leiste).toBeNull();
		// Vor dem Siegel nennt das Haus den gesperrten Grundantrag nicht als
		// ohne Ergebnis (`holeBeschlussvermerkLagen` über `holeFolgeantragslagen`).
		expect(await holeOhneErgebnisUndVermerk(betreiber, r.a.versammlung)).not.toContain(TITEL);
	});

	it('zurückgezogener Folgeantrag: als solcher genannt und nicht offen, wie im Hausprotokoll', async () => {
		const r = await abend('Folgeweg 6', '2029-01-13', {
			wahl: 'zurueckgezogen',
			entschaedigung: 'keiner',
			zweites: 'angenommen',
			uebrigeVermerkt: true
		});
		const { z, summe } = await r.stand();
		const wahl = block(punkt(z.text), `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`);
		expect(wahl).toContain(`Vor der Abstimmung zurückgezogen: ${RUECKZUG}`);
		expect(wahl).not.toContain(OFFEN);
		expect(await holeOhneErgebnisUndVermerk(betreiber, r.a.versammlung)).not.toContain(WAHL);
		// Offen bleibt nur der Grundantrag: Ein zurückgezogener Folgeantrag
		// entscheidet nicht über ihn.
		expect(z.offeneErgebnisse).toBe(1);
		/*
		 * **Bekannte Abweichung, gemessen** (08.11.2026): Die Tafel kennt den
		 * Rückzug nicht und zählt den zurückgezogenen Folgeantrag als offen,
		 * wie schon jeden zurückgezogenen Antrag; ebenso zählt das
		 * Abenddokument einen zurückgezogenen Grundantrag. Wird das
		 * angeglichen, fällt diese Zeile und gehört auf Gleichheit gestellt.
		 */
		expect(summe).toBe(z.offeneErgebnisse + 1);
	});

	it('nie abgestimmter Folgeantrag: offen wie im Hausprotokoll, bis der Beschlussvermerk ihn trägt', async () => {
		const r = await abend('Folgeweg 3', '2029-01-10', {
			wahl: 'offen',
			entschaedigung: 'keiner',
			zweites: 'angenommen',
			uebrigeVermerkt: true
		});
		const vorher = await r.stand();
		const wahl = block(punkt(vorher.z.text), `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`);
		expect(wahl).toContain(OFFEN);
		// Der Grundantrag ohne Entscheid und der Folgeantrag: zwei offen.
		expect(vorher.z.offeneErgebnisse).toBe(2);
		expect(vorher.z.luecke).toBe('2 Punkte ohne Ergebnis');
		expect(vorher.summe).toBe(vorher.z.offeneErgebnisse);
		expect(vorher.leiste).toBe(vorher.z.luecke);
		// Das Hausprotokoll nennt ihn ebenso ohne Ergebnis, vor dem Siegel.
		expect(await holeOhneErgebnisUndVermerk(betreiber, r.a.versammlung)).toContain(WAHL);

		await setzeProtokollnotiz(h(), r.a.versammlung, r.wahl.id, 'Beschluss: Die Wiederwahl ist abgelehnt, von Hand gezählt.');
		await setzeBeschlussvermerk(h(), r.a.versammlung, r.wahl.id, true);
		const nachher = await r.stand();
		const mitVermerk = block(punkt(nachher.z.text), `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`);
		expect(mitVermerk).toContain('Beschluss: Die Wiederwahl ist abgelehnt, von Hand gezählt.');
		expect(mitVermerk).not.toContain(OFFEN);
		expect(nachher.z.offeneErgebnisse).toBe(1);
		expect(nachher.summe).toBe(nachher.z.offeneErgebnisse);
		expect(await holeOhneErgebnisUndVermerk(betreiber, r.a.versammlung)).not.toContain(WAHL);
	});

	it('Anfechtung, wo die abgelehnte Wahl im Folgeantrag der einzige Beschluss des Abends ist', async () => {
		const r = await abend('Folgeweg 4', '2029-01-11', {
			wahl: 'abgelehnt',
			entschaedigung: 'keiner',
			zweites: 'offen',
			uebrigeVermerkt: false
		});
		const { z, summe } = await r.stand();
		expect(block(punkt(z.text), `#### Folgeantrag ${r.wahl.nummer} «${WAHL}»`)).toMatch(/Abgelehnt/);
		expect(z.text.match(/^## Anfechtung$/gm)).toHaveLength(1);
		// Entwurf, weil im zweiten Haus und bei den übrigen Punkten nichts
		// entschieden ist; die Anfechtung hängt daran nicht.
		expect(z.luecke).not.toBeNull();
		expect(summe).toBe(z.offeneErgebnisse);
	});
});
