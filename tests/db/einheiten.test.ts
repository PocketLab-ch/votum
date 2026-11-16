/**
 * Story 1.5 — Schranken der Quotenarten und Einheiten, soweit sie in der
 * Datenbank liegen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { leseEinheitenzeilen } from '$lib/domain/einheiten';
import {
	bearbeiteEinheit,
	erstelleEinheit,
	erstelleEinheiten,
	erstelleQuotenart,
	holeEinheiten,
	holeQuotenarten,
	loescheQuotenart,
	pruefeGemeinschaftSalden,
	entferneEinheit
} from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let stweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Einheiten');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Quotenweg 5',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Stammquote wird aus der Gemeinschaft mitgeführt', () => {
	it('entsteht beim Anlegen der Gemeinschaft von selbst', async () => {
		const arten = await holeQuotenarten(betreiber, stweg);
		expect(arten).toHaveLength(1);
		expect(arten[0]).toMatchObject({ key: 'stamm', denominator: 1000, isPrimary: true });
	});

	it('zieht bei einer Änderung des Nenners nach', async () => {
		// Es darf keinen Weg geben, auf dem Gemeinschaft und Quotenart
		// auseinanderlaufen.
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE stweg SET quota_denominator = 10000 WHERE id = ${stweg}`
		);
		const arten = await holeQuotenarten(betreiber, stweg);
		expect(arten.find((a) => a.isPrimary)!.denominator).toBe(10000);

		await imKontext(
			betreiber,
			(tx) => tx`UPDATE stweg SET quota_denominator = 1000 WHERE id = ${stweg}`
		);
	});

	it('lässt keine zweite Stammquote zu', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator, is_primary)
					VALUES (${stweg}, ${betreiber}, 'stamm2', 'Zweite', 1000, true)
				`
			)
		).rejects.toThrow();
	});

	it('lässt den Schlüssel «stamm» nicht für einen Nebenverteiler zu', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator, is_primary)
					VALUES (${stweg}, ${betreiber}, 'stamm', 'Falsch', 100, false)
				`
			)
		).rejects.toThrow();
	});
});

describe('Zusätzliche Verteiler', () => {
	it('nimmt einen Aufzugsverteiler mit eigenem Nenner auf', async () => {
		await erstelleQuotenart(handelnder(betreiber), {
			stwegId: stweg,
			key: 'lift',
			name: 'Aufzug',
			denominator: 100,
			isPrimary: false,
			sortOrder: 1
		});
		const arten = await holeQuotenarten(betreiber, stweg);
		expect(arten.map((a) => a.key).sort()).toEqual(['lift', 'stamm']);
		expect(arten.find((a) => a.key === 'lift')!.denominator).toBe(100);
	});

	it('weist einen doppelten Schlüssel ab', async () => {
		await expect(
			erstelleQuotenart(handelnder(betreiber), {
				stwegId: stweg,
				key: 'lift',
				name: 'Aufzug nochmals',
				denominator: 50,
				isPrimary: false,
				sortOrder: 2
			})
		).rejects.toThrow();
	});

	it('weist einen Nenner null ab', async () => {
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator)
					VALUES (${stweg}, ${betreiber}, 'null_nenner', 'Ohne', 0)
				`
			)
		).rejects.toThrow();
	});
});

describe('Einen Verteiler wieder entfernen', () => {
	/**
	 * Eigene Gemeinschaft, weil dieser Block Einheiten mit Werten anlegt und
	 * wieder wegnimmt — die Salden der übrigen Blöcke sollen das nicht spüren.
	 */
	let eigen: string;

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Verteilerweg 9',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigen = g.id;
	});

	it('entfernt einen Verteiler, an dem noch niemand hängt', async () => {
		const art = await erstelleQuotenart(handelnder(betreiber), {
			stwegId: eigen,
			key: 'vertippt',
			name: 'Vertippt',
			denominator: 100,
			isPrimary: false,
			sortOrder: 1
		});

		const ergebnis = await loescheQuotenart(handelnder(betreiber), {
			stwegId: eigen,
			artId: art.id,
			bestaetigt: false
		});

		expect(ergebnis.rueckfrage).toBeNull();
		const arten = await holeQuotenarten(betreiber, eigen);
		expect(arten.map((a) => a.key)).toEqual(['stamm']);
	});

	it('fragt zuerst, wenn Einheiten daran Werte tragen — und löscht sie dann mit', async () => {
		// Der Weg, an dem die Datenbank sonst als 500er dazwischenfährt:
		// `unit_quota` hängt mit ON DELETE RESTRICT am Verteiler. Der Kern zählt
		// vorher, die Seite fragt mit dieser Zahl.
		const art = await erstelleQuotenart(handelnder(betreiber), {
			stwegId: eigen,
			key: 'waschen',
			name: 'Waschküche',
			denominator: 100,
			isPrimary: false,
			sortOrder: 2
		});
		await erstelleEinheit(handelnder(betreiber), {
			stwegId: eigen,
			kind: 'unit',
			label: 'Wohnung oben',
			quotas: { stamm: 600, waschen: 60 },
			countsAsHead: true
		});
		await erstelleEinheit(handelnder(betreiber), {
			stwegId: eigen,
			kind: 'unit',
			label: 'Wohnung unten',
			quotas: { stamm: 400, waschen: 40 },
			countsAsHead: true
		});

		const frage = await loescheQuotenart(handelnder(betreiber), {
			stwegId: eigen,
			artId: art.id,
			bestaetigt: false
		});
		expect(frage.rueckfrage).toEqual({ betroffen: 2, name: 'Waschküche' });
		// Ohne Bestätigung bleibt alles stehen.
		expect((await holeQuotenarten(betreiber, eigen)).map((a) => a.key).sort()).toEqual([
			'stamm',
			'waschen'
		]);

		const weg = await loescheQuotenart(handelnder(betreiber), {
			stwegId: eigen,
			artId: art.id,
			bestaetigt: true
		});
		expect(weg.rueckfrage).toBeNull();
		expect((await holeQuotenarten(betreiber, eigen)).map((a) => a.key)).toEqual(['stamm']);

		// Die Einheiten bleiben, nur ihr Wert an diesem Verteiler ist weg — die
		// Stammquote geht weiterhin auf.
		const einheiten = await holeEinheiten(betreiber, eigen);
		expect(einheiten).toHaveLength(2);
		expect(einheiten.every((e) => !('waschen' in e.quotas))).toBe(true);
		expect((await pruefeGemeinschaftSalden(betreiber, eigen)).stimmig).toBe(true);
	});

	it('lässt die Stammquote stehen', async () => {
		const stamm = (await holeQuotenarten(betreiber, eigen)).find((a) => a.isPrimary)!;
		await expect(
			loescheQuotenart(handelnder(betreiber), {
				stwegId: eigen,
				artId: stamm.id,
				bestaetigt: true
			})
		).rejects.toThrow(/Stimmrecht/);
		expect((await holeQuotenarten(betreiber, eigen)).some((a) => a.isPrimary)).toBe(true);
	});

	it('greift nicht in eine andere Gemeinschaft', async () => {
		// Die Kennung allein genügt nicht: Ohne den Abgleich auf `stweg_id` liesse
		// sich mit einer erratenen Kennung ein fremder Verteiler entfernen.
		const fremd = (await holeQuotenarten(betreiber, stweg)).find((a) => a.key === 'lift')!;
		await expect(
			loescheQuotenart(handelnder(betreiber), {
				stwegId: eigen,
				artId: fremd.id,
				bestaetigt: true
			})
		).rejects.toThrow(/gibt es nicht/);
	});
});

describe('Einheiten mit mehreren Quoten', () => {
	it('legt eine Einheit mit Stamm- und Aufzugsquote an', async () => {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: '1.1 Wohnung links',
			quotas: { stamm: 400, lift: 50 },
			countsAsHead: true
		});
		expect(e.quotas).toEqual({ stamm: 400, lift: 50 });
	});

	it('legt eine Einheit ohne Beteiligung am Aufzug an', async () => {
		// Die Erdgeschosswohnung zahlt nicht an den Aufzug. Die fehlende Zeile ist
		// ausdrücklich etwas anderes als der Wert null.
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: '0.1 Wohnung Erdgeschoss',
			quotas: { stamm: 550 },
			countsAsHead: true
		});
		expect(e.quotas).toEqual({ stamm: 550 });

		const gelesen = (await holeEinheiten(betreiber, stweg)).find(
			(u) => u.label === '0.1 Wohnung Erdgeschoss'
		)!;
		expect('lift' in gelesen.quotas).toBe(false);
	});

	it('weist eine Einheit ohne Stammquote ab', async () => {
		// Aufgeschobene Schranke in der Datenbank: Ohne sie verschwände die Einheit
		// lautlos aus jeder Zählung nach Wertquoten.
		await expect(
			imKontext(betreiber, async (tx) => {
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO unit (id, stweg_id, operator_id, kind, label)
					VALUES (${id}, ${stweg}, ${betreiber}, 'unit', 'Ohne Stammquote')
				`;
				// Die Transaktion endet hier — die Schranke greift beim Commit.
			})
		).rejects.toThrow(/keine Stammquote/);
	});

	it('lässt eine Einheit anlegen, wenn die Stammquote in derselben Transaktion folgt', async () => {
		// Die Schranke ist aufgeschoben, sonst wäre jedes Anlegen unmöglich: Die
		// Einheit muss vor ihren Quoten stehen.
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'parking',
			label: 'P1 Einstellplatz',
			quotas: { stamm: 50 },
			countsAsHead: false
		});
		expect(e.id).toBeTruthy();
	});
});

describe('Quoten bleiben in ihrer Gemeinschaft', () => {
	it('verhindert eine Quotenart aus einer fremden Gemeinschaft', async () => {
		// Ohne diese Klammer könnte eine Einheit aus Haus A einen Aufzugsverteiler
		// aus Haus B tragen, und beide Saldoprüfungen gingen nicht mehr auf, ohne
		// dass ersichtlich wäre, warum.
		const andere = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Andere Gemeinschaft',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const fremdeArt = (await holeQuotenarten(betreiber, andere.id))[0];
		const eigene = (await holeEinheiten(betreiber, stweg))[0];

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
					VALUES (${eigene.id}, ${fremdeArt.id}, ${stweg}, ${betreiber}, 10)
				`
			)
		).rejects.toThrow();
	});

	it('weist einen negativen Wert ab', async () => {
		const art = (await holeQuotenarten(betreiber, stweg)).find((a) => a.key === 'lift')!;
		const einheit = (await holeEinheiten(betreiber, stweg))[0];

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
					VALUES (${einheit.id}, ${art.id}, ${stweg}, ${betreiber}, -1)
					ON CONFLICT (unit_id, quota_kind_id) DO UPDATE SET value = -1
				`
			)
		).rejects.toThrow();
	});
});

describe('Saldoprüfung über den ganzen Baum', () => {
	it('meldet die Stammquote als stimmig und den Aufzug als offen', async () => {
		// Erfasst: 400 + 550 + 50 = 1000 Stammquote; 50 von 100 beim Aufzug.
		const ergebnis = await pruefeGemeinschaftSalden(betreiber, stweg);

		const stamm = ergebnis.zeilen.find((z) => z.quotenart === 'stamm')!;
		const lift = ergebnis.zeilen.find((z) => z.quotenart === 'lift')!;

		expect(stamm.abweichung).toBe(0);
		expect(lift.abweichung).toBe(50);
		expect(ergebnis.stammquotenStimmig).toBe(true);
		expect(ergebnis.stimmig).toBe(false);
	});

	it('bezieht Untergemeinschaften ein', async () => {
		const dach = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Überbauung Baumtest',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const hausA = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Baumtest Haus A',
			quotaDenominator: 600,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: dach.id
		});
		await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Baumtest Haus B',
			quotaDenominator: 400,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: dach.id
		});

		// Von der Dachebene aus gesehen geht die Summe der Häuser auf; in Haus A
		// fehlt aber noch alles.
		const ergebnis = await pruefeGemeinschaftSalden(betreiber, dach.id);

		const dachZeile = ergebnis.zeilen.find((z) => z.stwegId === dach.id)!;
		expect(dachZeile.summeUntergemeinschaften).toBe(1000);
		expect(dachZeile.abweichung).toBe(0);

		const hausZeile = ergebnis.zeilen.find((z) => z.stwegId === hausA.id)!;
		expect(hausZeile.abweichung).toBe(600);
		expect(ergebnis.stimmig).toBe(false);
	});
});

// ── Eine Einheit wieder entfernen ───────────────────────────────────────────
//
// **Der Anlass** (Prüflauf 22.08.2026, Befund A-01): Es gab keinen Weg. Wer sich
// beim Erfassen vertat, musste die ganze Gemeinschaft löschen und von vorne
// beginnen — die Gemeinschaft war löschbar, die einzelne Zeile nicht.

describe('Eine Einheit wieder entfernen', () => {
	let eigen: string;

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Vertippweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigen = g.id;
	});

	async function einheit(label: string, stamm: number) {
		return erstelleEinheit(handelnder(betreiber), {
			stwegId: eigen,
			kind: 'unit',
			label,
			quotas: { stamm },
			countsAsHead: true
		});
	}

	it('fragt erst zurück und nennt, was mitgeht', async () => {
		const e = await einheit('Versehentlich doppelt', 100);
		const erst = await entferneEinheit(handelnder(betreiber), {
			stwegId: eigen,
			einheitId: e.id,
			bestaetigt: false
		});
		expect(erst.rueckfrage).not.toBeNull();
		expect(erst.rueckfrage!.bezeichnung).toBe('Versehentlich doppelt');
		// Die Stammquote zählt mit — sie geht über CASCADE verloren.
		expect(erst.rueckfrage!.quoten).toBeGreaterThan(0);

		// Ohne Bestätigung ist nichts geschehen.
		expect((await holeEinheiten(betreiber, eigen)).some((x) => x.id === e.id)).toBe(true);
	});

	it('entfernt sie erst auf Bestätigung — samt Quoten', async () => {
		const e = await einheit('Wirklich weg', 120);
		const ergebnis = await entferneEinheit(handelnder(betreiber), {
			stwegId: eigen,
			einheitId: e.id,
			bestaetigt: true
		});
		expect(ergebnis.rueckfrage).toBeNull();
		expect((await holeEinheiten(betreiber, eigen)).some((x) => x.id === e.id)).toBe(false);
	});

	/*
	 * **Die eigentliche Schranke** — und der Grund, warum das Entfernen überhaupt
	 * eingeschränkt ist.
	 *
	 * Eine Einheit, die in einer Momentaufnahme steht, hat mit ihrer Wertquote an
	 * einer Abstimmung teilgenommen. Verschwände sie, stünde im Protokoll eine
	 * Quote, deren Einheit es nicht mehr gibt — im Streitfall wertlos.
	 *
	 * `snapshot_unit` hat **keinen** Fremdschlüssel auf `unit` (die Momentaufnahme
	 * ist bewusst eine Kopie und stürbe sonst mit). Die Datenbank hält hier also
	 * nichts auf; ohne diesen Test wäre die Schranke eine Behauptung.
	 */
	it('lässt eine Einheit nicht entfernen, die an einer Versammlung teilnahm', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Beschlussweg 1',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg mit Geschichte',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});
		const partei = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Aebi',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, partei.id, '2020-01-01');

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-04-01',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);

		await expect(
			entferneEinheit(handelnder(betreiber), {
				stwegId: g.id,
				einheitId: e.id,
				bestaetigt: true
			})
		).rejects.toThrow(/teilgenommen/);

		// Und sie steht danach noch da — die Absage ist keine halbe Löschung.
		expect((await holeEinheiten(betreiber, g.id)).some((x) => x.id === e.id)).toBe(true);
	});

	it('nennt eine Einheit, die es nicht gibt, beim Namen', async () => {
		await expect(
			entferneEinheit(handelnder(betreiber), {
				stwegId: eigen,
				einheitId: crypto.randomUUID(),
				bestaetigt: true
			})
		).rejects.toThrow(/gibt es nicht/);
	});
});

describe('Zimmer, Fläche und Lage stehen in eigenen Feldern (Befund 26)', () => {
	/*
	 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026): «‹Einheit hinzufügen›
	 * hat nur ein Feld ‹Bezeichnung›. Zimmerzahl, Fläche und Lage landen in
	 * einem Klumpen, der überall erscheint, auch auf der Zugangskarte.»
	 */
	let stweg: string;

	beforeAll(async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Merkmalweg 5',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		stweg = g.id;
	});

	it('nimmt sie an und gibt sie zurück', async () => {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: '1.1 Wohnung links',
			quotas: { stamm: 300 },
			countsAsHead: true,
			zimmer: 3.5,
			flaeche: 87.4,
			lage: 'EG links'
		});
		expect(e.zimmer).toBe(3.5);
		expect(e.flaeche).toBe(87.4);
		expect(e.lage).toBe('EG links');

		// **Und aus der Datenbank zurückgelesen genauso.** `numeric` kommt als
		// Zeichenkette; wer sie nicht umwandelt, hat '3.5' in einem Feld, das
		// eine Zahl verspricht.
		const gelesen = (await holeEinheiten(betreiber, stweg)).find((x) => x.id === e.id)!;
		expect(gelesen.zimmer).toBe(3.5);
		expect(gelesen.flaeche).toBe(87.4);
		expect(typeof gelesen.zimmer).toBe('number');
	});

	it('lässt sie weg, wo niemand sie erfasst hat', async () => {
		// Freiwillig heisst freiwillig: `null`, nicht 0. Eine Wohnung mit null
		// Zimmern gibt es nicht, und beim Sortieren stünde sie zuvorderst.
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'parking',
			label: 'Einstellplatz 4',
			quotas: { stamm: 20 },
			countsAsHead: false
		});
		expect(e.zimmer).toBeNull();
		expect(e.flaeche).toBeNull();
		expect(e.lage).toBeNull();
	});

	it('lässt sie nachtragen und wieder leeren', async () => {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: '2.1 Wohnung rechts',
			quotas: { stamm: 300 },
			countsAsHead: true
		});
		const nachgetragen = await bearbeiteEinheit(handelnder(betreiber), e.id, {
			stwegId: stweg,
			kind: 'unit',
			label: '2.1 Wohnung rechts',
			quotas: { stamm: 300 },
			countsAsHead: true,
			zimmer: 4.5,
			flaeche: 102,
			lage: '2. OG'
		});
		expect(nachgetragen.lage).toBe('2. OG');

		const geleert = await bearbeiteEinheit(handelnder(betreiber), e.id, {
			stwegId: stweg,
			kind: 'unit',
			label: '2.1 Wohnung rechts',
			quotas: { stamm: 300 },
			countsAsHead: true,
			lage: '   '
		});
		expect(geleert.zimmer).toBeNull();
		expect(geleert.lage).toBeNull();
	});

	/*
	 * **Die Schranken fangen Tippfehler, nicht Fachfälle.** «870» statt «87»
	 * fiele sonst erst auf, wenn jemand die Flächen summiert — und dann sieht
	 * es aus wie ein Rechenfehler der Anwendung.
	 */
	const unglaubhaft: [string, Record<string, unknown>, RegExp][] = [
		['eine Zimmerzahl über dreissig', { zimmer: 31 }, /Zimmerzahl/],
		['eine Zimmerzahl null', { zimmer: 0 }, /Zimmerzahl/],
		['eine Fläche über 10 000 m²', { flaeche: 10001 }, /Fläche/],
		['eine negative Fläche', { flaeche: -5 }, /Fläche/],
		['eine Lage über sechzig Zeichen', { lage: 'x'.repeat(61) }, /Lage/]
	];

	for (const [name, abweichung, wortlaut] of unglaubhaft) {
		it(`weist ${name} ab`, async () => {
			await expect(
				erstelleEinheit(handelnder(betreiber), {
					stwegId: stweg,
					kind: 'unit',
					label: `Unglaubhaft ${name}`,
					quotas: { stamm: 10 },
					countsAsHead: true,
					...abweichung
				})
			).rejects.toThrow(wortlaut);
		});
	}

	/*
	 * **Und sie kommen nicht auf die Zugangskarte.** Genau das war der Befund:
	 * «ein Klumpen, der überall erscheint, auch auf der Zugangskarte». Die
	 * Momentaufnahme, aus der Karte und Auswertung rechnen, führt je Einheit
	 * `label`, `quota`, `kind` und `countsAsHead` — und soll das weiter tun.
	 * Wer hier ein Feld ergänzt, sieht es an dieser Probe.
	 */
	it('trägt die Merkmale nicht in die Momentaufnahme', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Merkmalweg 6',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: '1.1 Wohnung links',
			quotas: { stamm: 1000 },
			countsAsHead: true,
			zimmer: 3.5,
			flaeche: 87,
			lage: 'EG links'
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Anna Muster',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2027-03-04',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);

		const aufnahme = await holeMomentaufnahme(betreiber, v.id);
		const einheit = aufnahme!.parties.flatMap((x) => x.units)[0];
		expect(einheit.label).toBe('1.1 Wohnung links');
		// `nutzniessung` gehört dazu: Sie entscheidet, wer stimmen darf, und ist
		// deshalb eingefroren (FR-4, FR-22). Die drei neuen Merkmale nicht.
		expect(Object.keys(einheit).sort()).toEqual(
			['countsAsHead', 'kind', 'label', 'nutzniessung', 'quota', 'unitId'].sort()
		);
	});

	/*
	 * **«Keine Zahl» ist etwas anderes als «ausserhalb der Spanne»**
	 * (Code-Review 07.09.2026). Die erste Fassung warf beides in einen Satz, und
	 * wer «87 m²» ins Zahlenfeld tippte, las «muss zwischen 0 und 10000 liegen»
	 * — und suchte den Fehler an der falschen Stelle.
	 */
	it('sagt bei etwas, das keine Zahl ist, dass es keine ist', async () => {
		await expect(
			erstelleEinheit(handelnder(betreiber), {
				stwegId: stweg,
				kind: 'unit',
				label: 'Keine Zahl',
				quotas: { stamm: 10 },
				countsAsHead: true,
				flaeche: Number.NaN
			})
		).rejects.toThrow(/ist keine Zahl/);
	});

	/*
	 * **Die Datenbank hält eine Stelle für Zimmer und zwei für die Fläche.**
	 * Ohne Prüfung rundete sie still, und die Antwort des Schreibwegs nannte
	 * 87.456, während 87.46 gespeichert ist.
	 */
	it('weist mehr Nachkommastellen ab, als gespeichert werden', async () => {
		await expect(
			erstelleEinheit(handelnder(betreiber), {
				stwegId: stweg,
				kind: 'unit',
				label: 'Zu genau',
				quotas: { stamm: 10 },
				countsAsHead: true,
				flaeche: 87.456
			})
		).rejects.toThrow(/zwei Nachkommastellen/);
		await expect(
			erstelleEinheit(handelnder(betreiber), {
				stwegId: stweg,
				kind: 'unit',
				label: 'Zu genau 2',
				quotas: { stamm: 10 },
				countsAsHead: true,
				zimmer: 3.55
			})
		).rejects.toThrow(/eine Nachkommastelle/);
	});

	/*
	 * **Und eine Änderung an den Merkmalen steht im Verlauf.** Sie wurde
	 * geschrieben und tauchte dort nicht auf: Wer aus 87 m² versehentlich 870
	 * macht, ändert die Daten, und nichts sagt später, wer wann was
	 * (Code-Review 07.09.2026).
	 */
	it('hält eine Änderung der Fläche im Verlauf fest', async () => {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: 'Verlaufsprobe',
			quotas: { stamm: 10 },
			countsAsHead: true,
			flaeche: 87
		});
		await bearbeiteEinheit(handelnder(betreiber), e.id, {
			stwegId: stweg,
			kind: 'unit',
			label: 'Verlaufsprobe',
			quotas: { stamm: 10 },
			countsAsHead: true,
			flaeche: 870
		});
		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: Record<string, unknown> }[]>`
			SELECT detail FROM audit_entry
			 WHERE subject_id = ${e.id} AND event_type LIKE 'unit.%'
			 ORDER BY occurred_at DESC, id DESC LIMIT 1
		`);
		expect(JSON.stringify(zeilen[0]?.detail ?? {})).toMatch(/flaeche/);
	});

	/*
	 * **Alles oder nichts, und zwar wirklich** (Code-Review 07.09.2026).
	 *
	 * Die erste Fassung der Sammelanlage rief `erstelleEinheit` in einer
	 * Schleife. Jeder Aufruf öffnet über `alsBetreiber` seine eigene
	 * Transaktion: Scheiterte die zweite Zeile, stand die erste bereits fest,
	 * während die Seite «es entsteht keine einzige Einheit» meldete. Der
	 * Verwalter berichtigte die Zeile, schickte erneut — und die erste stand
	 * doppelt da, der Wertquotensaldo bei 1500 statt 1000.
	 *
	 * Der Zeilenleser sieht diesen Fall nicht: Die Zimmerzahl 99 ist eine
	 * gültige Zahl. Abgewiesen wird sie erst von `pruefeEinheit`, also beim
	 * Schreiben.
	 */
	it('legt bei einem Fehler in der Mitte keine einzige Einheit an', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Sammelweg 7',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const zeilen = leseEinheitenzeilen('Whg 1; 500\nWhg 2; 500; 99', g.id);
		expect(zeilen.fehler).toEqual([]);

		await expect(
			erstelleEinheiten(handelnder(betreiber), g.id, zeilen.einheiten)
		).rejects.toThrow(/Zimmerzahl/);

		// **Auch die erste nicht.** Das ist die eigentliche Aussage.
		expect(await holeEinheiten(betreiber, g.id)).toHaveLength(0);
	});

	it('legt alle an, wenn alle gehen', async () => {
		// Die Gegenprobe: Ohne sie belegte die Probe oben auch eine Sammelanlage,
		// die grundsätzlich nichts anlegt.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Sammelweg 8',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const zeilen = leseEinheitenzeilen('Whg 1; 500; 3.5; 87; EG\nWhg 2; 500', g.id);
		const angelegt = await erstelleEinheiten(handelnder(betreiber), g.id, zeilen.einheiten);
		expect(angelegt).toHaveLength(2);
		expect((await holeEinheiten(betreiber, g.id)).map((e) => e.label).sort()).toEqual([
			'Whg 1',
			'Whg 2'
		]);
	});

	it('weist Einheiten einer fremden Gemeinschaft im selben Aufruf ab', async () => {
		// Die Quotenarten werden einmal gelesen; eine fremde Kennung würde sonst
		// still mit den falschen Arten geprüft.
		const zeilen = leseEinheitenzeilen('Whg 1; 500', 'fremde-kennung');
		await expect(
			erstelleEinheiten(handelnder(betreiber), stweg, zeilen.einheiten)
		).rejects.toThrow(/selben Gemeinschaft/);
	});

	/*
	 * **Die Gegenprobe.** Ohne sie belegten die fünf oben auch eine Schranke,
	 * die jede Zahl abwiese — und der Weg, um den es geht, ist der gültige.
	 */
	it('lässt die Randwerte durch', async () => {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: stweg,
			kind: 'unit',
			label: 'Randwerte',
			quotas: { stamm: 10 },
			countsAsHead: true,
			zimmer: 30,
			flaeche: 10000,
			lage: 'y'.repeat(60)
		});
		expect(e.zimmer).toBe(30);
		expect(e.flaeche).toBe(10000);
	});
});
