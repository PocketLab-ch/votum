/**
 * Was der gemeinsame Abend vorgibt — in der Datenbank nachgemessen.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Die Gruppenveranstaltung muss genau das
 * können, was die Einzelveranstaltung kann […] Die Gruppe gibt die
 * Einstellungen für die angehängten Einheiten vor.» Welche Angabe hart ist und
 * welche der Gemeinschaft gehört, steht in `docs/vererbung-abend.md`.
 *
 * Geprüft werden die zwei Wege, auf denen eine harte Angabe ins Haus kommt:
 * beim **Zuordnen** und beim **Ändern der Angaben** des Abends. Und die
 * Schranke, die beide teilen: Ab der Freigabe steht der Tag in versandten
 * Einladungen und bleibt stehen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung, holeVersammlung } from '$lib/server/versammlungen';
import {
	aendereVersammlungstag,
	erstelleVersammlungstag,
	holeVersammlungstag,
	legeAngabenUm,
	nimmInTagAuf
} from '$lib/server/versammlungstag';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Vererbung Abend');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-vererbung');
});

afterAll(verbindungenSchliessen);

async function abend(name: string, ueber: Partial<Parameters<typeof erstelleVersammlungstag>[1]> = {}) {
	return erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name} — Abend`,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art: 'ordentlich',
		betriebsart: 'gefuehrt',
		...ueber
	});
}

/**
 * Eine Versammlung, die absichtlich vom Abend abweicht.
 *
 * Mit `freigabefaehig` bekommt sie eine Einheit und einen Eigentümer — sonst
 * scheitert `gibVersammlungFrei` an den Wertquoten, und der Test prüfte am Ende
 * die Freigabesperre statt der Vererbung.
 */
async function abweichendesHaus(name: string, freigabefaehig = false) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	if (freigabefaehig) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 1',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const partei = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, partei.id, '2020-01-01');
	}
	const m = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-06-30',
		uhrzeit: '20:00',
		ort: 'Restaurant Sonne',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	return { gemeinschaft: g.id, versammlung: m.id };
}

describe('Der Abend führt seine Abstimmungsweise selbst', () => {
	it('legt sie an und gibt sie zurück', async () => {
		const t = await abend('Vererbweg 1', { betriebsart: 'einfach' });
		expect(t.betriebsart).toBe('einfach');
		expect((await holeVersammlungstag(betreiber, t.id))?.betriebsart).toBe('einfach');
	});

	it('lässt sie ändern', async () => {
		const t = await abend('Vererbweg 2', { betriebsart: 'einfach' });
		await aendereVersammlungstag(handelnder(), t.id, {
			bezeichnung: t.bezeichnung,
			datum: t.datum,
			uhrzeit: t.uhrzeit,
			ort: t.ort,
			art: t.art,
			betriebsart: 'gefuehrt'
		});
		expect((await holeVersammlungstag(betreiber, t.id))?.betriebsart).toBe('gefuehrt');
	});
});

describe('Zuordnen übernimmt die harten Angaben', () => {
	it('zieht Tag, Beginn, Ort und Abstimmungsweise nach', async () => {
		const t = await abend('Vererbweg 3');
		const h = await abweichendesHaus('Vererbweg 3 — Haus');

		const plan = await nimmInTagAuf(handelnder(), t.id, h.versammlung, 0);
		expect(plan.aendern[0].was).toEqual(['Tag', 'Beginn', 'Ort', 'Abstimmungsweise']);

		const v = await holeVersammlung(betreiber, h.versammlung);
		expect(v?.datum).toBe('2026-05-19');
		expect(v?.uhrzeit).toBe('17:00');
		expect(v?.ort).toBe('Halle der Proben');
		expect(v?.betriebsart).toBe('gefuehrt');
	});

	it('lässt die Stufe in Ruhe — sie ist Sache der Gemeinschaft (ZGB 712p Abs. 2)', async () => {
		const t = await abend('Vererbweg 4');
		const h = await abweichendesHaus('Vererbweg 4 — Haus');
		await nimmInTagAuf(handelnder(), t.id, h.versammlung, 0);
		expect((await holeVersammlung(betreiber, h.versammlung))?.stufe).toBe('erste');
	});

	/*
	 * Der Punkt, an dem die Vorgabe endet: Ab der Freigabe steht der Tag in
	 * versandten Einladungen. Ihn zu überschreiben hiesse, etwas zu ändern, das
	 * jemand schon gelesen hat.
	 */
	it('lässt eine freigegebene Versammlung stehen und sagt warum', async () => {
		const t = await abend('Vererbweg 5');
		const h = await abweichendesHaus('Vererbweg 5 — Haus', true);
		await gibVersammlungFrei(handelnder(), h.versammlung);

		const plan = await nimmInTagAuf(handelnder(), t.id, h.versammlung, 0);
		expect(plan.aendern).toEqual([]);
		expect(plan.gesperrt[0].grund).toContain('Einladung');

		const v = await holeVersammlung(betreiber, h.versammlung);
		expect(v?.datum).toBe('2026-06-30');
		expect(v?.betriebsart).toBe('einfach');
	});

	/*
	 * Wer Haus F anhängt, soll nicht A bis E umstellen — auch wenn die nach der
	 * Matrix ohnehin passen müssten. Das Häkchen auf der Angabenseite meint
	 * ausdrücklich «auf alle»; das Zuordnen meint dieses eine.
	 */
	it('rührt die übrigen Häuser des Abends nicht an', async () => {
		const t = await abend('Vererbweg 6');
		const alt = await abweichendesHaus('Vererbweg 6 — Haus A');
		await nimmInTagAuf(handelnder(), t.id, alt.versammlung, 0);

		// A weicht jetzt wieder ab — von Hand, wie es heute noch möglich ist.
		await aendereVersammlungstag(handelnder(), t.id, {
			bezeichnung: t.bezeichnung,
			datum: '2026-05-26',
			uhrzeit: t.uhrzeit,
			ort: t.ort,
			art: t.art,
			betriebsart: t.betriebsart
		});

		const neu = await abweichendesHaus('Vererbweg 6 — Haus B');
		await nimmInTagAuf(handelnder(), t.id, neu.versammlung, 1);

		// B ist nachgezogen, A steht auf dem alten Tag.
		expect((await holeVersammlung(betreiber, neu.versammlung))?.datum).toBe('2026-05-26');
		expect((await holeVersammlung(betreiber, alt.versammlung))?.datum).toBe('2026-05-19');
	});
});

describe('Das Häkchen auf der Angabenseite meint alle', () => {
	it('zieht jedes Haus nach, das noch im Entwurf ist', async () => {
		const t = await abend('Vererbweg 7');
		const a = await abweichendesHaus('Vererbweg 7 — Haus A');
		const b = await abweichendesHaus('Vererbweg 7 — Haus B');
		await nimmInTagAuf(handelnder(), t.id, a.versammlung, 0);
		await nimmInTagAuf(handelnder(), t.id, b.versammlung, 1);

		await aendereVersammlungstag(handelnder(), t.id, {
			bezeichnung: t.bezeichnung,
			datum: '2026-05-27',
			uhrzeit: '18:30',
			ort: 'Turnhalle',
			art: t.art,
			betriebsart: 'einfach'
		});

		const plan = await legeAngabenUm(handelnder(), t.id);
		expect(plan.aendern).toHaveLength(2);

		for (const h of [a, b]) {
			const v = await holeVersammlung(betreiber, h.versammlung);
			expect(v?.datum).toBe('2026-05-27');
			expect(v?.uhrzeit).toBe('18:30');
			expect(v?.ort).toBe('Turnhalle');
			expect(v?.betriebsart).toBe('einfach');
		}
	});
});
