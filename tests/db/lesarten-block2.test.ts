/**
 * Lesarten Block 2 am lebenden Weg: L1 und 1e im Saal bis ins Protokoll, und
 * die zwei Reste aus Block 1 (Konzept Lesarten, Kriterien 3, 5, 6, 7, 14;
 * Auftrag `2026-10-21-votum-lesarten-block2.md`, Akzeptanzkriterium 1).
 *
 * - **L1 im Saal:** Eine Gemeinschaft mit «fällt heraus» rechnet das Papier-
 *   beispiel (vier zu 250, eine im Ausstand, zwei Ja, eine Nein) angenommen;
 *   das Protokoll nennt die Lesart und das Ergebnis nach der anderen.
 * - **1e im Saal:** An der Ausschlussklage bleibt die Angehörige im Ausstand in
 *   der Zahl, und das Protokoll sagt es.
 * - **Rest 1:** Folgeantrag und Auswahl vergleichen mit dem Mehr am Haus.
 * - **Rest 2:** Die Freigabelage nennt eine veraltete Lesart vor dem Klick.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erhebeFreigabelage, gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erfordernisAmHaus,
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	setzeGewaehltesErfordernis,
	waehlbareErfordernisseAmHaus
} from '$lib/server/traktanden';
import { gibStimmenAb, holeErgebnis, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { erklaereAusstand } from '$lib/server/ausstand';
import { speichereLesarten } from '$lib/server/lesarten';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import { vorschlagAmHaus } from '$lib/server/erfordernisvorschlag';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { waehlbareErfordernisse, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

function erfordernisVon(knotenId: string): Erfordernis {
	const e = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
	if (!e) throw new Error(`Knoten ${knotenId} liefert kein Erfordernis`);
	return e;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesarten Block 2');
	benutzer = await pruefbenutzer(betreiber, 'lesarten2leitung');
});
afterAll(verbindungenSchliessen);

/** Eine Gemeinschaft mit `anzahl` Parteien zu je 250 und einer Versammlung im Entwurf. */
async function haus(name: string, datum: string, anzahl = 4) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: anzahl * 250,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 1; i <= anzahl; i++) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Prüfpartei ${i}`,
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
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis»; hier die Ausschlussklage.
	const traktandum = (titel: string, betroffeneParteiIds: string[] = []) =>
		erstelleTraktandum(
			handelnder(betreiber),
			{
				meetingId: v.id,
				titel,
				art: 'abstimmung',
				antragswortlaut: `${titel}: Wortlaut für den Prüflauf.`,
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds
			},
			betroffeneParteiIds.length > 0 ? 'k-ausschlussklage' : null
		);
	return { gemeinschaft: g.id, versammlung: v.id, parteien, traktandum };
}

/** Eröffnen, alle anwesend, das Traktandum aufrufen. */
async function imSaal(versammlung: string, parteien: string[], traktandum: string) {
	await eroeffneVersammlung(handelnder(betreiber), versammlung);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, p, 'von_hand');
	await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
}

async function protokolltext(versammlung: string) {
	return (await stelleEntwurfZusammen(betreiber, versammlung, new Date().toISOString(), 'Prüflauf')).replace(
		/\s+/g,
		' '
	);
}

describe('L1 im Saal (Kriterien 3, 5, 6, 7)', () => {
	it('rechnet nach «fällt heraus», wie eingefroren, und nennt das Ergebnis nach der anderen', async () => {
		const h = await haus('Prüfhaus L1 Saal', '2027-12-10');
		const t = await h.traktandum('Fassade streichen');
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L1: 'faellt_heraus' });
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			h.versammlung,
			t.id,
			erfordernisVon('k-verwaltung-wichtig')
		);
		await gibVersammlungFrei(handelnder(betreiber), h.versammlung);
		// Nach der Freigabe zurückgestellt: wirkt erst für die nächste Versammlung.
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L1: 'bleibt' });

		await imSaal(h.versammlung, h.parteien, t.id);
		await erklaereAusstand(handelnder(betreiber), h.versammlung, t.id, h.parteien[3], 'Auftrag an die eigene Firma');
		await oeffneAbstimmung(handelnder(betreiber), h.versammlung, t.id);
		await gibStimmenAb(
			handelnder(betreiber),
			h.versammlung,
			[
				{ parteiId: h.parteien[0], wahl: 'yes' },
				{ parteiId: h.parteien[1], wahl: 'yes' },
				{ parteiId: h.parteien[2], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), h.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, h.versammlung, d.id);
		expect(auszaehlung?.quoten).toMatchObject({ ja: 500, basis: 750, schwelle: 376 });
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereAusstandslesart).toMatchObject({
			wahl: 'Wertquote zählt mit',
			angenommen: false,
			abweichend: true
		});

		const text = await protokolltext(h.versammlung);
		expect(text).toContain('Gerechnet wird nach der Lesart «Wertquote fällt heraus»');
		expect(text).toContain('Nach der anderen Lesart («Wertquote zählt mit»: die Rechnung mit der Wertquote im Ausstand), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen');
	});
});

describe('1e im Saal (Kriterien 7 und 14)', () => {
	it('lässt die Angehörige im Ausstand in der Zahl und sagt es im Protokoll', async () => {
		const h = await haus('Prüfhaus 1e Saal', '2027-12-11', 5);
		const t = await h.traktandum('Ermächtigung zur Ausschlussklage', [h.parteien[4]]);
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			h.versammlung,
			t.id,
			erfordernisVon('k-ausschlussklage')
		);
		await gibVersammlungFrei(handelnder(betreiber), h.versammlung);
		await imSaal(h.versammlung, h.parteien, t.id);
		await erklaereAusstand(handelnder(betreiber), h.versammlung, t.id, h.parteien[3], 'Ehefrau des Beklagten');
		await oeffneAbstimmung(handelnder(betreiber), h.versammlung, t.id);
		await gibStimmenAb(
			handelnder(betreiber),
			h.versammlung,
			[
				{ parteiId: h.parteien[0], wahl: 'yes' },
				{ parteiId: h.parteien[1], wahl: 'yes' },
				{ parteiId: h.parteien[2], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), h.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, h.versammlung, d.id);
		expect(auszaehlung?.koepfe).toMatchObject({ ja: 2, basis: 4, schwelle: 3, imAusstand: 1 });
		expect(auszaehlung?.angenommen).toBe(false);
		expect(await protokolltext(h.versammlung)).toContain('1 im Ausstand, zählt in der Zahl mit');
	});
});

describe('Rest 1: Vergleich mit dem Mehr am Haus', () => {
	const ERWEITERT = 'k-bewirtschaftung-waehlen-erweitert';

	it('die Auswahl trägt den Typ nach der Lesart; der Knoten allein die Vorgabe', async () => {
		// Seit Block B (Fassung 2026-11-13, Entscheid 0048) ist «qualifiziert» die
		// Vorgabe; die Gemeinschaft stellt deshalb hier auf «einfach».
		const h = await haus('Prüfhaus Mehr am Haus', '2027-12-12');
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L4: 'einfach' });
		const wo = { meetingId: h.versammlung, stwegId: h.gemeinschaft };
		expect((await erfordernisAmHaus(betreiber, wo, ERWEITERT)).typ).toBe('einfaches_mehr');
		const amHaus = (await waehlbareErfordernisseAmHaus(betreiber, wo)).find((e) => e.knotenId === ERWEITERT);
		expect(amHaus?.typ).toBe('einfaches_mehr');
		// Gegenprobe: der Typ des Knotens, mit dem bis Block 2 verglichen wurde.
		expect(waehlbareErfordernisse(holeRegelwerk()).find((e) => e.knotenId === ERWEITERT)?.typ).toBe(
			'qualifiziertes_mehr'
		);
	});

	it('der Folgeantrag mit demselben Mehr wie der Grundantrag warnt nicht «schwächer»', async () => {
		const h = await haus('Prüfhaus Folgeantrag L4', '2027-12-13');
		await speichereAusnahmen(handelnder(betreiber), h.gemeinschaft, {
			reglementGestattet: true,
			reglementFundstelle: 'Art. 99 Prüfreglement'
		});
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L4: 'einfach' });
		const t = await h.traktandum('Wahl der Prüf AG');
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: h.versammlung, stwegId: h.gemeinschaft },
			t.id,
			ERWEITERT,
			null
		);
		await gibVersammlungFrei(handelnder(betreiber), h.versammlung);
		await imSaal(h.versammlung, h.parteien, t.id);
		const f = new FormData();
		f.set('spontanart', 'folgeantrag');
		f.set('grundantrag', t.id);
		f.set('art', 'abstimmung');
		f.set('titel', 'Wahl der Prüf AG für zwei Jahre');
		f.set('antragswortlaut', 'Die Prüf AG wird für zwei Jahre gewählt.');
		f.set('erfordernis', ERWEITERT);
		const auf = await nimmImSaalAuf(handelnder(betreiber), h.versammlung, f, 'versammlung');
		const satz = `${auf.warnung ?? ''} ${auf.hinweis ?? ''}`;
		expect(satz).toContain('ist als Folgeantrag aufgenommen');
		expect(satz).not.toMatch(/schwächeres|strengeres/);
	});
});

describe('Rest 2: Die Freigabelage nennt die veraltete Lesart vor dem Klick', () => {
	it('als Hindernis mit Weg zur Seite «Lesarten», bis nachgezogen ist', async () => {
		const h = await haus('Prüfhaus Freigabelage', '2027-12-14');
		const t = await h.traktandum('Wahl der Prüf AG');
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: h.versammlung, stwegId: h.gemeinschaft },
			t.id,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		expect((await erhebeFreigabelage(betreiber, h.versammlung)).befund.hindernisse).toEqual([]);

		// Seit Block B ist «qualifiziert» die Vorgabe; umgestellt wird auf «einfach».
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L4: 'einfach' });
		const { befund } = await erhebeFreigabelage(betreiber, h.versammlung);
		expect(befund.moeglich).toBe(false);
		expect(befund.hindernisse).toEqual([
			{
				kennung: 'lesart_veraltet',
				text:
					'Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «Wahl der Prüf AG» sein Mehr ' +
					'bekam. Ziehen Sie das Mehr auf der Seite «Lesarten» der Gemeinschaft nach und geben Sie ' +
					'dann frei.',
				weg: 'lesarten'
			}
		]);
		// Die Absage der Freigabe sagt dasselbe.
		await expect(gibVersammlungFrei(handelnder(betreiber), h.versammlung)).rejects.toThrow(
			befund.hindernisse[0].text
		);
	});
});

describe('Rest 1: der KI-Vorschlag trägt den Typ am Haus', () => {
	it('mit L4 «einfach» das einfache Mehr, ein Grenzfall bleibt', async () => {
		// Seit Block B rechnet der Knoten nach der Vorgabe «qualifiziert»; die
		// Gemeinschaft stellt hier auf «einfach».
		const h = await haus('Prüfhaus KI-Vorschlag', '2027-12-15');
		await speichereLesarten(handelnder(betreiber), 'admin', h.gemeinschaft, { L4: 'einfach' });
		const wo = { meetingId: h.versammlung, stwegId: h.gemeinschaft };
		const vorschlag = {
			astId: 'a-organe',
			astTitel: 'Organe',
			knotenId: 'k-bewirtschaftung-waehlen-erweitert',
			titel: 'Bewirtschaftung wählen, die schon erweiterte Kompetenzen hat',
			rechtsgrundlage: 'ZGB Art. 712q',
			typ: 'qualifiziertes_mehr' as const,
			schritte: [],
			grenzfall: false
		};
		const am = await vorschlagAmHaus(betreiber, wo, { vorschlag, grund: null });
		expect(am.vorschlag?.typ).toBe('einfaches_mehr');
		const grenz = { ...vorschlag, typ: 'grenzfall' as const };
		expect((await vorschlagAmHaus(betreiber, wo, { vorschlag: grenz, grund: null })).vorschlag?.typ).toBe('grenzfall');
		expect((await vorschlagAmHaus(betreiber, wo, { vorschlag: null, grund: 'keiner' })).vorschlag).toBeNull();
	});
});
