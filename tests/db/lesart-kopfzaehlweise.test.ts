/**
 * L13, Zählweise der Köpfe in der Datenhaltung (Migration 192; Entscheid 0048,
 * Block C, Akzeptanzkriterium 4): Stellt die Gemeinschaft nach der Herleitung
 * um, sagt die Freigabe ab, und der Kasten «Erfordernisse nachziehen» zeigt
 * dasselbe Traktandum; nach dem Nachziehen gibt sie frei, und die
 * Momentaufnahme hält die Wahl fest. Gemeinschaften und Namen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// Die Fassung der Herleitung ist die aktuelle, nicht eine feste Kennung («Texte nach 0047»: rot bei jeder neuen Fassung).
import { AKTUELLE_FASSUNG } from '$lib/rules';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { erstelleTraktandum, holeTraktanden, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import { erfordernisseNachziehen, veralteteErfordernisse } from '$lib/server/reglement';
import { holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { erfordernisNachAndererLesart } from '$lib/domain/lesarten';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { gibStimmenAb, holeErgebnis, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L13');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

/** Eine Versammlung im Entwurf mit drei Eigentümern (oder den Quoten, die der Aufrufer nennt) und zwei Traktanden. */
async function lage(name: string, quoten = [400, 300, 300]) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [nummer, quote] of quoten.entries()) {
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
			displayName: ['Erika Beispiel', 'Hans Probe', 'Ida Muster'][nummer] ?? `Partei ${nummer + 1} (erfunden)`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum: '2027-12-14',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const traktandum = async (titel: string, knoten: string) => {
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel} wird beschlossen.`,
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await setzeGewaehltesErfordernis(handelnder(betreiber), { meetingId: v.id, stwegId: g.id }, t.id, knoten, null);
		return t.id;
	};
	const wichtig = await traktandum('Neue Heizung', 'k-verwaltung-wichtig');
	// Gegenprobe: gewöhnliche Verwaltung nach Art. 647a Abs. 1, dort wirkt L13 nicht.
	const gewoehnlich = await traktandum('Gartenpflege', 'k-verwaltung-gewoehnlich');
	return { gemeinschaft: g.id, versammlung: v.id, wichtig, gewoehnlich, parteien, traktandum };
}

type Zeile = { requirement_head_base: string; requirement_reading_l13: string | null; requirement_version: string };
async function zeile(id: string): Promise<Zeile> {
	const [z] = await admin<Zeile[]>`
		SELECT requirement_head_base, requirement_reading_l13, requirement_version FROM agenda_item WHERE id = ${id}
	`;
	return z;
}

describe('Migration 192 und Kriterium 4', () => {
	it('neue Gemeinschaften stehen auf «Anwesende und Vertretene»; die Datenbank setzt die Wahl am Traktandum', async () => {
		const a = await lage('L13 Vorgabe');
		expect((await holeLesarteneinstellung(betreiber, a.gemeinschaft)).wahl.L13).toBe('anwesende');
		const z = await zeile(a.wichtig);
		expect(z).toMatchObject({ requirement_head_base: 'anwesend_vertreten', requirement_reading_l13: 'anwesende', requirement_version: AKTUELLE_FASSUNG });
		const [s] = await admin<{ column_default: string }[]>`
			SELECT column_default FROM information_schema.columns
			 WHERE table_name = 'stweg' AND column_name = 'reading_l13'
		`;
		expect(s.column_default).toMatch(/^'anwesende'/);
	});

	it('nach dem Umstellen sagt die Freigabe ab und der Kasten zeigt dasselbe Traktandum; nachgezogen gibt sie frei', async () => {
		const a = await lage('L13 umgestellt');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });

		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(/Lesarten/);
		const veraltet = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(veraltet.map((v) => v.traktandumId)).toEqual([a.wichtig]);
		expect(veraltet[0].bisher).toMatch(/der Anwesenden oder Vertretenen.* · Lesart L13: Anwesende und Vertretene \(Vorgabe\)$/);
		expect(veraltet[0].neu).toMatch(/aller Eigentümer.* · Lesart L13: Alle Eigentümer$/);

		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		expect(await zeile(a.wichtig)).toMatchObject({ requirement_head_base: 'alle_eigentuemer', requirement_reading_l13: 'alle' });
		expect((await zeile(a.gewoehnlich)).requirement_head_base).toBe('anwesend_vertreten');

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L13).toBe('alle');
		const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.wichtig);
		expect(t.knoten.erfordernis).toMatchObject({ kopfbasis: 'alle_eigentuemer', kopfzaehlweise: 'alle' });
	});

	/*
	 * Codeprüfung Block C, M2 (Fachprüfung Nachtrag, N-F-1): Unter L4 «einfach»
	 * betrifft L13 das gerechnete Mehr nicht, wohl aber das andere. Die Wahl muss
	 * trotzdem am Traktandum stehen, und nach dem Umstellen setzt die Freigabe sie
	 * nach (`gibVersammlungFrei`); sonst zählte das zweite Ergebnis die Anwesenden.
	 */
	it('L4 «einfach»: die Freigabe führt die Wahl nach, das zweite Ergebnis zählt unter allen (M2)', async () => {
		const a = await lage('L13 mit L4 einfach');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L4: 'einfach' });
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Neue Bewirtschaftung',
			art: 'abstimmung',
			antragswortlaut: 'Die Bewirtschaftung Beispiel Verwaltungen wird gewählt.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			t.id,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		expect((await zeile(t.id)).requirement_reading_l13).toBe('anwesende');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });
		// Das gerechnete Mehr ändert sich nicht: kein Kasten, keine Absage für dieses Traktandum.
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).map((v) => v.traktandumId)).not.toContain(t.id);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await zeile(t.id)).requirement_reading_l13).toBe('alle');
		const [x] = (await holeTraktanden(betreiber, a.versammlung)).filter((y) => y.knoten.id === t.id);
		const e = x.knoten.erfordernis!;
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.kopfzaehlweise).toBe('alle');
		expect(erfordernisNachAndererLesart(e)?.kopfbasis).toBe('alle_eigentuemer');
	});

	it('ein Traktandum einer früheren Fassung: die Freigabe sagt unter «alle» ab, der Kasten zeigt es (N1)', async () => {
		const a = await lage('L13 frühere Fassung');
		await admin`UPDATE agenda_item SET requirement_version = '2026-11-13' WHERE id = ${a.wichtig}`;
		// Unter der Vorgabe rechnet es weiter nach seiner Fassung.
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(/Lesarten/);
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).map((v) => v.traktandumId)).toEqual([a.wichtig]);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect(await zeile(a.wichtig)).toMatchObject({ requirement_version: AKTUELLE_FASSUNG, requirement_head_base: 'alle_eigentuemer' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	/*
	 * Codeprüfung Block C, Lauf 2, N-B: L4 «einfach» an einem Traktandum einer
	 * früheren Fassung. Das gerechnete Mehr kennt L13 nicht, das andere schon;
	 * Freigabe und Kasten prüfen beide (`zaehlweiseVeraltet`).
	 */
	it('L4 «einfach» einer früheren Fassung: unter «alle» sagt die Freigabe ab, der Kasten zeigt es (N-B)', async () => {
		const a = await lage('L13 frühere Fassung mit L4 einfach');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L4: 'einfach' });
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: a.versammlung,
			parentId: null,
			titel: 'Neue Bewirtschaftung',
			art: 'abstimmung',
			antragswortlaut: 'Die Bewirtschaftung Beispiel Verwaltungen wird gewählt.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			t.id,
			'k-bewirtschaftung-waehlen-erweitert',
			null
		);
		await admin`UPDATE agenda_item SET requirement_version = '2026-11-13' WHERE id = ${t.id}`;
		// Die übrigen Traktanden der Lage sollen die Absage nicht tragen: die wichtigere
		// Verwaltungshandlung schon nach «alle», die gewöhnliche kennt L13 nicht.
		await admin`UPDATE agenda_item SET requirement_head_base = 'alle_eigentuemer' WHERE id = ${a.wichtig}`;
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).map((v) => v.traktandumId)).not.toContain(t.id);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).map((v) => v.traktandumId)).toEqual([t.id]);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(/Lesarten/);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await zeile(t.id)).requirement_version).toBe(AKTUELLE_FASSUNG);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('eine Umstellung nach der Freigabe ändert das freigegebene Traktandum nicht', async () => {
		const a = await lage('L13 nach Freigabe');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		expect(await zeile(a.wichtig)).toMatchObject({ requirement_head_base: 'anwesend_vertreten', requirement_reading_l13: 'anwesende' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L13).toBe('anwesende');
	});
});

/*
 * **Durch Saal, Auswertung und Protokoll** (Featureprüfung Regel 43 Runde 2,
 * Kriterium C5, Befund M1): Die Protokollzeile zu L13 setzt `auswertung.ts`
 * in `zeile.lesart`; der Kern prüft nur die Funktion. Notwendige bauliche
 * Massnahme (Art. 647c, nur Köpfe), drei von fünf Eigentümern da, zwei stimmen
 * Ja: unter den Anwesenden angenommen (2 von 3), unter allen abgelehnt (2 von 5).
 */
describe('Im Saal und im Protokoll (Kriterium C5)', () => {
	async function abend(name: string, l13: 'anwesende' | 'alle') {
		const a = await lage(name, [300, 200, 200, 150, 150]);
		const dach = await a.traktandum('Dachsanierung', 'k-baulich-notwendig');
		if (l13 === 'alle') {
			await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L13: 'alle' });
			await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		}
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 3)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, dach);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		return { auszaehlung, text };
	}

	it('unter «Alle Eigentümer»: Zeile zu L13 und Ergebnis nach den Anwesenden im Protokoll', async () => {
		const { auszaehlung, text } = await abend('L13 im Saal, alle', 'alle');
		expect(auszaehlung?.angenommen).toBe(false);
		expect(auszaehlung?.koepfe.basis).toBe(5);
		expect(text).toContain(
			'Köpfe gezählt unter allen Eigentümern, wie es für diese Versammlung eingestellt war. Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das wäre auch die Vorgabe von Votum.'
		);
		expect(text).toMatch(/Nach der anderen Zählweise \(«Anwesende und Vertretene»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen/);
	});

	it('unter der Vorgabe: Zeile zu L13 und Ergebnis nach allen Eigentümern im Protokoll', async () => {
		const { auszaehlung, text } = await abend('L13 im Saal, Vorgabe', 'anwesende');
		expect(auszaehlung?.angenommen).toBe(true);
		expect(text).toContain(
			'Köpfe gezählt unter den Anwesenden und Vertretenen, wie die herrschende Lehre, die Auffassung der meisten Fachleute (Vorgabe von Votum). Ob hier alle Eigentümer zählen, ist umstritten.'
		);
		expect(text).toMatch(/Nach der anderen Zählweise \(«Alle Eigentümer»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});
});
