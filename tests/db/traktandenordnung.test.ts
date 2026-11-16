/**
 * Die gespeicherte Reihenfolge der Standardtraktanden (Block C2, 31.08.2026).
 *
 * Geprüft werden beide Enden: das Speichern und Zurücksetzen selbst, und die
 * Wirkung beim Anlegen neuer Versammlungen. Ein Kern-Test allein sähe die
 * Ordnung nicht ankommen — er prüft `ordneVorlagen`, nicht die Positionen in
 * `agenda_item`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import {
	holeTraktandenordnung,
	setzeTraktandenordnungZurueck,
	speichereTraktandenordnung
} from '$lib/server/traktandenordnung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { FESTE_TRAKTANDEN, JAHRESGESCHAEFTE } from '$lib/domain/traktandenvorlage';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function neueGemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

/** Die Titel der Pflichttraktanden einer Versammlung, in Position-Reihenfolge. */
async function pflichttitel(versammlungId: string): Promise<string[]> {
	const traktanden = await holeTraktanden(betreiber, versammlungId);
	return traktanden.map((t) => t.knoten.titel);
}

/**
 * Der Schlüssel zu einem Titel — damit die Tests unten die Ordnung aus der
 * Code-Reihenfolge ABLEITEN statt sie ein zweites Mal auszuschreiben.
 *
 * **Der Anlass** (01.09.2026): Beim Umstellen auf die Reihenfolge des Auftraggebers —
 * Revisionsbericht, Jahresrechnung, Décharge, dann das Vorausschauende — wurden
 * zwei Tests rot, weil sie dieselbe Reihenfolge noch einmal von Hand als
 * Schlüsselliste führten. Zwei Listen für eine Sache laufen auseinander.
 */
const SCHLUESSEL_ZU_TITEL = new Map(
	[...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE].map((v) => [v.titel, v.schluessel])
);
const schluesselVon = (titel: string) => SCHLUESSEL_ZU_TITEL.get(titel)!;

/** Die Schlüssel-Reihenfolge, wie sie der Code ohne Ordnung erzeugt. */
const CODE_REIHENFOLGE = [
	'Begrüssung und Feststellung der Beschlussfähigkeit',
	'Wahl der Stimmenzähler',
	'Genehmigung des Protokolls der letzten Versammlung',
	'Bericht der Revisionsstelle',
	'Jahresrechnung',
	'Décharge an die Bewirtschaftung',
	'Budget und Beiträge',
	'Erneuerungsfonds'
];

beforeAll(async () => {
	betreiber = await pruefbetreiber('Traktandenordnung');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Ordnung speichern und lesen', () => {
	it('liefert null, wenn nichts gespeichert ist', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 1');
		expect(await holeTraktandenordnung(betreiber, g.id)).toBeNull();
	});

	it('speichert und liest eine Reihenfolge', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 2');
		const schluessel = ['stimmenzaehler', 'begruessung', 'decharge'];
		await speichereTraktandenordnung(handelnder(betreiber), g.id, schluessel);
		expect(await holeTraktandenordnung(betreiber, g.id)).toEqual(schluessel);
	});

	it('ersetzt eine gespeicherte Ordnung, statt sie zu mischen', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 3');
		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['decharge']);
		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['budget', 'revision']);
		expect(await holeTraktandenordnung(betreiber, g.id)).toEqual(['budget', 'revision']);
	});

	it('weist doppelte Schlüssel ab', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 4');
		await expect(
			speichereTraktandenordnung(handelnder(betreiber), g.id, ['budget', 'budget'])
		).rejects.toThrow(/zweimal/);
		// Und nichts ist stehen geblieben.
		expect(await holeTraktandenordnung(betreiber, g.id)).toBeNull();
	});

	it('weist fremde Schlüssel ab', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 5');
		await expect(
			speichereTraktandenordnung(handelnder(betreiber), g.id, ['budget', 'gibtsnicht'])
		).rejects.toThrow(FachlicherFehler);
		expect(await holeTraktandenordnung(betreiber, g.id)).toBeNull();
	});

	it('leere Liste setzt zurück — Code-Reihenfolge gilt wieder', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 6');
		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['decharge']);
		await speichereTraktandenordnung(handelnder(betreiber), g.id, []);
		expect(await holeTraktandenordnung(betreiber, g.id)).toBeNull();
	});

	it('zurücksetzen weist ab, wenn nichts gespeichert ist', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 7');
		await expect(setzeTraktandenordnungZurueck(handelnder(betreiber), g.id)).rejects.toThrow(
			/keine Reihenfolge gespeichert/
		);
	});

	it('zurücksetzen löscht die gespeicherte Ordnung', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 8');
		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['decharge']);
		await setzeTraktandenordnungZurueck(handelnder(betreiber), g.id);
		expect(await holeTraktandenordnung(betreiber, g.id)).toBeNull();
	});

	it('hält Ordnungen verschiedener Gemeinschaften auseinander', async () => {
		const a = await neueGemeinschaft('Ordnungshaus 9a');
		const b = await neueGemeinschaft('Ordnungshaus 9b');
		await speichereTraktandenordnung(handelnder(betreiber), a.id, ['decharge']);
		await speichereTraktandenordnung(handelnder(betreiber), b.id, ['budget']);
		expect(await holeTraktandenordnung(betreiber, a.id)).toEqual(['decharge']);
		expect(await holeTraktandenordnung(betreiber, b.id)).toEqual(['budget']);
	});
});

describe('Wirkung beim Anlegen neuer Versammlungen', () => {
	it('ohne Ordnung gilt die Code-Reihenfolge', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 10');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2026-06-01',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		expect(await pflichttitel(v.id)).toEqual(CODE_REIHENFOLGE);
	});

	it('gespeicherte Ordnung sortiert die Pflichttraktanden', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 11');
		// Décharge ganz nach vorn, Begrüssung an zweiter Stelle.
		await speichereTraktandenordnung(handelnder(betreiber), g.id, [
			'decharge',
			'begruessung'
		]);
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2026-06-02',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		const titel = await pflichttitel(v.id);
		expect(titel[0]).toBe('Décharge an die Bewirtschaftung');
		expect(titel[1]).toBe('Begrüssung und Feststellung der Beschlussfähigkeit');
		// Der Rest folgt in Code-Reihenfolge — die Ordnung nennt nur zwei.
		const genannt = ['Décharge an die Bewirtschaftung', 'Begrüssung und Feststellung der Beschlussfähigkeit'];
		expect(titel.slice(2)).toEqual(CODE_REIHENFOLGE.filter((t) => !genannt.includes(t)));
	});

	it('eine Ordnung, die alles nennt, sortiert alles', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 12');
		const umgekehrt = [...CODE_REIHENFOLGE].reverse();
		// Die Schlüssel kommen aus der Vorlage, nicht aus einer zweiten Liste.
		const schluessel = umgekehrt.map(schluesselVon);
		await speichereTraktandenordnung(handelnder(betreiber), g.id, schluessel);
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2026-06-03',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		expect(await pflichttitel(v.id)).toEqual(umgekehrt);
	});

	it('ausserordentliche Versammlung kennt nur die zwei festen — in ihrer Ordnung', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 13');
		// Die Ordnung nennt Jahresgeschäfte vor den festen; die ausserordentliche
		// Versammlung hat nur die festen, und die erscheinen in Ordnungsstelle.
		await speichereTraktandenordnung(handelnder(betreiber), g.id, [
			'decharge',
			'stimmenzaehler',
			'begruessung'
		]);
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ausserordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			anlass: 'Dringlicher Beschluss',
			datum: '2026-06-04',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		expect(await pflichttitel(v.id)).toEqual([
			'Wahl der Stimmenzähler',
			'Begrüssung und Feststellung der Beschlussfähigkeit'
		]);
	});

	it('nachträglich geänderte Ordnung lässt bestehende Versammlungen unberührt', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 14');
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2026-06-05',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		const vorher = await pflichttitel(v.id);

		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['decharge']);
		expect(await pflichttitel(v.id)).toEqual(vorher);

		// Die nächste Versammlung bekommt die neue Ordnung.
		const v2 = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt',
			datum: '2027-06-05',
			uhrzeit: '19:00',
			ort: 'Saal'
		});
		expect((await pflichttitel(v2.id))[0]).toBe('Décharge an die Bewirtschaftung');
	});

	it('jede Ordnungsänderung steht im Verlauf', async () => {
		const g = await neueGemeinschaft('Ordnungshaus 15');
		await speichereTraktandenordnung(handelnder(betreiber), g.id, ['decharge']);
		await setzeTraktandenordnungZurueck(handelnder(betreiber), g.id);

		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ event_type: string }[]>`
				SELECT event_type FROM audit_entry
				 WHERE subject_id = ${g.id}
				 ORDER BY occurred_at
			`
		);
		const arten = eintraege
			.map((z) => z.event_type)
			.filter((a) => a.startsWith('agenda.template.order'));
		expect(arten).toEqual(['agenda.template.order.saved', 'agenda.template.order.reset']);
	});
});
