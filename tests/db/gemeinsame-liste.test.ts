/**
 * Eine Sitzung, eine Traktandenliste (Auftraggeber, 11.08.2026).
 *
 * Der Befund: Sechs Gemeinschaften tagten zusammen, jede trug ihre acht
 * Pflichttraktanden mit eigener Zählung 1–8, und das einzige gemeinsam angelegte
 * Geschäft hiess daneben «1.1». Zwei Ordnungen auf einer Seite — im Saal nicht zu
 * führen und im Protokoll nicht zu belegen.
 *
 * Geprüft wird deshalb der ganze Kreis: Die mitgebrachten Traktanden gehen in die
 * gemeinsame Liste ein, tragen dort eine durchgehende Nummer, und diese Nummer
 * steht anschliessend in jeder Gemeinschaft.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import {
	erstelleVersammlungstag,
	nimmAusTag,
	nimmInTagAuf
} from '$lib/server/versammlungstag';
import {
	bearbeiteGeschaeft,
	erstelleGeschaeft,
	holeGemeinsameListe,
	loescheGeschaeft,
	schreibeNummern,
	setzeBeteiligte,
	setzeErfordernisAmGeschaeft,
	vereinheitlicheListe,
	verschiebeGeschaeft,
	verschiebeInGeschaeft
} from '$lib/server/geschaeft';
import { fehlendeMuster, uebernimmMuster } from '$lib/server/vorlagen';
import { holeTraktanden } from '$lib/server/traktanden';
import { gemeinsameListe } from '$lib/domain/gemeinsameliste';
import { FESTE_TRAKTANDEN, JAHRESGESCHAEFTE } from '$lib/domain/traktandenvorlage';

/**
 * Der Titel des LETZTEN Standardtraktandums, aus der Vorlage geholt.
 *
 * **Nicht ausgeschrieben** (01.09.2026): Hier stand «Décharge an die
 * Bewirtschaftung», weil das damals der letzte Punkt war. Als die Reihenfolge
 * auf Vorgabe des Auftraggebers umgestellt wurde — Revisionsbericht, Jahresrechnung,
 * Décharge, dann das Vorausschauende —, wurden zwei Nummerierungstests rot,
 * obwohl an der Nummerierung nichts falsch war. Diese Tests prüfen die
 * NUMMER, nicht welcher Punkt zuletzt kommt; das prüft
 * `tests/domain/traktandenvorlage.test.ts`.
 */
const LETZTES_STANDARDTRAKTANDUM =
	[...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE].at(-1)!.titel;
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

beforeAll(async () => {
	betreiber = await pruefbetreiber('Gemeinsame Liste');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-liste');
});

afterAll(verbindungenSchliessen);

/** Ein Abend mit `anzahl` Gemeinschaften, jede mit ihren Pflichttraktanden. */
async function abendMit(name: string, anzahl: number, art: 'ordentlich' | 'ausserordentlich' = 'ordentlich') {
	const tag = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name} — Abend`,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art,
		// Bei einer ausserordentlichen gehört der Anlass in die Einladung.
		anlass: art === 'ausserordentlich' ? 'Sanierung der Rampe' : null
	});
	const versammlungen: { id: string; gemeinschaft: string }[] = [];
	for (let i = 0; i < anzahl; i++) {
		const g = await erstelleGemeinschaft(handelnder(), {
			name: `${name} — Haus ${i + 1}`,
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const m = await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art,
			anlass: art === 'ausserordentlich' ? 'Sanierung der Rampe' : undefined,
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await nimmInTagAuf(handelnder(), tag.id, m.id, i);
		versammlungen.push({ id: m.id, gemeinschaft: `Haus ${i + 1}` });
	}
	return { tag: tag.id, versammlungen };
}

async function liste(tagId: string) {
	return gemeinsameListe(await holeGemeinsameListe(betreiber, tagId));
}

/**
 * Nur die Punkte des Abends, ohne ihre Ziffern.
 *
 * Ab zwei Gemeinschaften trägt jedes Haus eine eigene Ziffer (Produktentscheid
 * 11.08.2026) — die Liste ist deshalb länger als die Zahl der Traktanden.
 */
async function punkte(tagId: string) {
	return (await liste(tagId)).filter((z) => z.tiefe === 1);
}

/** Die Nummern, wie sie in einer einzelnen Gemeinschaft stehen. */
async function nummernIn(meetingId: string) {
	return (await holeTraktanden(betreiber, meetingId)).map((t) => `${t.nummer} ${t.knoten.titel}`);
}

describe('Die mitgebrachten Traktanden gehen in die gemeinsame Liste ein', () => {
	it('fasst gleichnamige Pflichttraktanden zu einem Punkt zusammen', async () => {
		const a = await abendMit('Einsammeln', 3);
		const p = await punkte(a.tag);

		// Acht Punkte, nicht 3 × 8: Die Begrüssung ist eine Sache des Abends. Dass
		// jedes Haus darunter seine eigene Ziffer trägt, ist die zweite Ebene.
		expect(p).toHaveLength(8);
		expect(p.map((z) => z.nummer)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
		expect(p[0].titel).toBe('Begrüssung und Feststellung der Beschlussfähigkeit');
		expect(p.every((z) => z.haeuser === 3)).toBe(true);
		// Ab zwei Gemeinschaften ist jeder Punkt ein Sammelpunkt mit drei Ziffern.
		expect(p.every((z) => z.art === 'sammelpunkt')).toBe(true);
		expect((await liste(a.tag)).filter((z) => z.tiefe === 2)).toHaveLength(24);
	});

	it('gibt allen Gemeinschaften dieselbe Nummer', async () => {
		const a = await abendMit('Gleiche Nummer', 3);
		// Je Haus die eigene Ziffer unter derselben Punktnummer: Haus 1 bekommt
		// 1.1, Haus 2 die 1.2 — aufgerufen wird beides unter Punkt 1.
		for (const [i, v] of a.versammlungen.entries()) {
			const n = await nummernIn(v.id);
			expect(n[0]).toBe(`1.${i + 1} Begrüssung und Feststellung der Beschlussfähigkeit`);
			expect(n[7]).toBe(`8.${i + 1} ${LETZTES_STANDARDTRAKTANDUM}`);
		}
	});

	it('hängt ein neu angelegtes Geschäft hinten an, nicht auf die 1', async () => {
		// Genau der Screenshot vom 11.08.2026: «1.1 Budget 2027» stand unter einer
		// Liste, die bei 8 endete.
		const a = await abendMit('Anhängen', 2);
		await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Budget 2027',
			antragswortlaut: 'Das Budget 2027 sei zu genehmigen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		const p = await punkte(a.tag);
		expect(p).toHaveLength(9);
		expect(p[8].nummer).toBe('9');
		expect(p[8].titel).toBe('Budget 2027');

		const n = await nummernIn(a.versammlungen[0].id);
		expect(n[8]).toBe('9.1 Budget 2027');
	});

	it('sammelt beim Dazukommen in die bestehenden Punkte ein, statt neue anzulegen', async () => {
		const a = await abendMit('Dazukommen', 1);
		expect(await punkte(a.tag)).toHaveLength(8);

		// Eine zweite Gemeinschaft bringt dieselben acht Pflichttraktanden mit.
		const g = await erstelleGemeinschaft(handelnder(), {
			name: 'Dazukommen — Nachzügler',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const m = await erstelleVersammlung(handelnder(), {
			stwegId: g.id,
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		await nimmInTagAuf(handelnder(), a.tag, m.id, 1);

		const p = await punkte(a.tag);
		expect(p).toHaveLength(8);
		expect(p.every((z) => z.haeuser === 2)).toBe(true);
		expect((await nummernIn(m.id))[0]).toBe(
			'1.2 Begrüssung und Feststellung der Beschlussfähigkeit'
		);
	});

	it('löst die Bindung, wenn eine Gemeinschaft den Abend verlässt', async () => {
		const a = await abendMit('Verlassen', 2);
		await nimmAusTag(handelnder(), a.versammlungen[1].id);

		// Die Gelöste zählt wieder für sich — ohne Nummern aus einer fremden Ordnung.
		const zeilen = await imKontext(betreiber, (tx) =>
			tx<{ manual_number: string | null; business_id: string | null }[]>`
				SELECT manual_number, business_id FROM agenda_item
				 WHERE meeting_id = ${a.versammlungen[1].id}
			`
		);
		expect(zeilen.every((z) => z.manual_number === null && z.business_id === null)).toBe(true);

		// Und der Abend führt nur noch die verbliebene.
		const l = await liste(a.tag);
		expect(l.every((z) => z.haeuser === 1)).toBe(true);
	});
});

/**
 * Ein Geschäft ohne beteiligte Gemeinschaft gibt es nicht.
 *
 * Der Auftraggeber am 12.08.2026: «Die Anwendung soll keine solche Geschäfte zulassen.» Sie
 * tut es auch nicht — beide Wege weisen eine leere Auswahl seit je ab. Was ich
 * als «acht Geschäfte ohne Gemeinschaft» gemeldet hatte, war ein Fehler im
 * Protokoll des Abends: Es nahm die Sammelpunkte für unzugeordnet, weil deren
 * Traktanden eine Ebene tiefer stehen. Im Bestand hatte jedes dieser Geschäfte
 * seine zwei Traktanden.
 *
 * Diese Tests halten die Sperre fest, damit sie bleibt.
 */
describe('Kein Geschäft ohne Gemeinschaft', () => {
	it('weist das Anlegen ohne Auswahl ab, mit Grund', async () => {
		const a = await abendMit('Ohne Haus', 2);
		await expect(
			erstelleGeschaeft(handelnder(), a.tag, {
				titel: 'Geschäft ohne Haus',
				antragswortlaut: 'Irgendetwas sei zu beschliessen.',
				meetingIds: []
			})
		).rejects.toThrow(/mindestens eine|Gemeinschaften das Geschäft läuft/i);
	});

	it('weist das Leeren der Beteiligten ab und nennt den Ausweg', async () => {
		const a = await abendMit('Leeren', 2);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Bleibt zugeordnet',
			antragswortlaut: 'Etwas sei zu beschliessen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		// Ohne Ausweg wäre die Absage eine Sackgasse: Wer das Traktandum ganz weg
		// haben will, nimmt es von der Liste — das muss dastehen.
		await expect(setzeBeteiligte(handelnder(), a.tag, g.id, [])).rejects.toThrow(
			/von der Liste/i
		);
	});
});

describe('Die Zahl der Häuser gliedert, die Abweichung wird nur gemeldet', () => {
	it('meldet den Punkt als aufgespalten, sobald ein Haus einen eigenen Wortlaut trägt', async () => {
		const a = await abendMit('Abweichung', 2);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Budget 2027',
			antragswortlaut: 'Das Budget sei zu genehmigen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		// Gegliedert ist er von Anfang an — zwei Häuser, zwei Ziffern.
		const vorher = (await punkte(a.tag))[8];
		expect(vorher.art).toBe('sammelpunkt');
		expect(vorher.einheitlich).toBe(true);

		// Ein Haus bekommt seinen eigenen Betrag.
		const eigenes = g.traktanden.find((t) => t.meetingId === a.versammlungen[0].id)!;
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE agenda_item SET motion_text = 'Das Budget von CHF 80 000 sei zu genehmigen.'
				 WHERE id = ${eigenes.traktandumId}
			`
		);

		const l = await liste(a.tag);
		const sammel = l.find((z) => z.nummer === '9')!;
		expect(sammel.art).toBe('sammelpunkt');
		// Jetzt steht dort etwas zu sehen — die Anzeige klappt ihn auf.
		expect(sammel.einheitlich).toBe(false);
		expect(l.filter((z) => z.nummer.startsWith('9.')).map((z) => z.nummer)).toEqual([
			'9.1',
			'9.2'
		]);
	});
});

describe('Die Liste wird am Abend geführt', () => {
	it('zieht beim Ändern mit, wer denselben Wortlaut trug', async () => {
		const a = await abendMit('Ändern', 3);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Rampe',
			antragswortlaut: 'Die Rampe sei zu sanieren.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		// Eines schert aus.
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE agenda_item SET motion_text = 'Die Rampe sei zu ersetzen.'
				 WHERE id = ${g.traktanden[0].traktandumId}
			`
		);

		const e = await bearbeiteGeschaeft(handelnder(), a.tag, g.id, {
			titel: 'Rampe Südseite',
			antragswortlaut: 'Die Rampe an der Südseite sei zu sanieren.',
			art: 'abstimmung'
		});
		expect(e.mitgezogen).toBe(2);
		expect(e.geblieben).toBe(1);

		// Das ausgescherte Haus behält seinen Wortlaut — sichtbar als Abweichung.
		const sammel = (await punkte(a.tag))[8];
		expect(sammel.art).toBe('sammelpunkt');
		expect(sammel.einheitlich).toBe(false);
	});

	it('nimmt beim Entfernen die Traktanden aller Häuser mit', async () => {
		const a = await abendMit('Entfernen', 2);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Veloständer',
			antragswortlaut: 'Ein Veloständer sei zu beschaffen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		const weg = await loescheGeschaeft(handelnder(), a.tag, g.id);
		expect(weg.haeuser).toBe(2);

		// Nicht bloss die Bindung gelöst: Sonst stünde es weiter in den
		// Gemeinschaften und würde beim nächsten Öffnen wieder eingesammelt.
		const [{ anzahl }] = await imKontext(betreiber, (tx) =>
			tx<{ anzahl: number }[]>`
				SELECT count(*)::int AS anzahl FROM agenda_item WHERE title = 'Veloständer'
				  AND meeting_id = ANY(${a.versammlungen.map((v) => v.id)}::uuid[])
			`
		);
		expect(Number(anzahl)).toBe(0);
		expect(await punkte(a.tag)).toHaveLength(8);
	});

	it('zieht die Reihenfolge der Häuser beim Verschieben nach', async () => {
		// Ohne das stimmte die Nummer, aber die Zeile stünde am alten Ort: «9»
		// zwischen «3» und «4».
		const a = await abendMit('Verschieben', 2);
		const p = await punkte(a.tag);
		const letztes = p[7].geschaeftId;
		const erstes = p[0].geschaeftId;

		await verschiebeGeschaeft(handelnder(), a.tag, letztes, erstes);

		const n = await nummernIn(a.versammlungen[0].id);
		expect(n[0]).toBe(`1.1 ${LETZTES_STANDARDTRAKTANDUM}`);
		expect(n[1]).toBe('2.1 Begrüssung und Feststellung der Beschlussfähigkeit');
	});

	it('zieht veraltete Nummern nach, auch ohne dass etwas eingesammelt wird', async () => {
		/*
		 * Der Befund vom 11.08.2026, gefunden bei einer Rückfrage: Nach der
		 * Rücknahme der Gliederungsregel zeigte die gemeinsame Liste «1.1», während
		 * in der Gemeinschaft weiterhin die «1» stand — die feste Nummer ist eine
		 * Abschrift der Rechnung, und niemand zog sie nach, weil nichts angelegt
		 * oder verschoben wurde.
		 */
		const a = await abendMit('Nachziehen', 2);
		expect((await nummernIn(a.versammlungen[0].id))[0]).toMatch(/^1\.1 /);

		// Eine von Hand verstellte Nummer steht für den veralteten Stand.
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE agenda_item SET manual_number = '1'
				 WHERE meeting_id = ${a.versammlungen[0].id} AND manual_number = '1.1'
			`
		);
		expect((await nummernIn(a.versammlungen[0].id))[0]).toMatch(/^1 /);

		// Nichts ist lose — trotzdem muss der Aufruf die Nummer richtigstellen.
		expect(await vereinheitlicheListe(handelnder(), a.tag)).toBe(0);
		expect((await nummernIn(a.versammlungen[0].id))[0]).toMatch(/^1\.1 /);
	});

	it('ist wirkungslos, wenn nichts mehr lose ist', async () => {
		const a = await abendMit('Wirkungslos', 2);
		expect(await vereinheitlicheListe(handelnder(), a.tag)).toBe(0);
		expect(await punkte(a.tag)).toHaveLength(8);
	});
});

describe('Beteiligte, Reihenfolge und Quorum', () => {
	it('nimmt eine Gemeinschaft nachträglich dazu und wieder heraus', async () => {
		// «Es sollte möglich sein, Gemeinschaften nachträglich aus einem Traktandum
		// zu entfernen oder hinzuzufügen» (Auftraggeber, 11.08.2026).
		const a = await abendMit('Beteiligte', 3);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Allgemeinstrom',
			antragswortlaut: 'Der Allgemeinstrom sei zu überprüfen.',
			meetingIds: [a.versammlungen[0].id]
		});
		expect((await punkte(a.tag)).find((z) => z.titel === 'Allgemeinstrom')!.haeuser).toBe(1);

		// Zwei dazu — jetzt entsteht die Gliederung.
		const dazu = await setzeBeteiligte(handelnder(), a.tag, g.id, a.versammlungen.map((v) => v.id));
		expect(dazu.dazu).toHaveLength(2);
		expect(dazu.weg).toHaveLength(0);
		const mit = (await punkte(a.tag)).find((z) => z.titel === 'Allgemeinstrom')!;
		expect(mit.haeuser).toBe(3);
		expect(mit.art).toBe('sammelpunkt');

		// Und wieder heraus.
		const weg = await setzeBeteiligte(handelnder(), a.tag, g.id, [a.versammlungen[0].id]);
		expect(weg.weg).toHaveLength(2);
		expect((await punkte(a.tag)).find((z) => z.titel === 'Allgemeinstrom')!.haeuser).toBe(1);
	});

	it('lässt die letzte Gemeinschaft nicht entfernen', async () => {
		const a = await abendMit('Beteiligte leer', 2);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Rampe',
			antragswortlaut: 'Die Rampe sei zu sanieren.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		await expect(setzeBeteiligte(handelnder(), a.tag, g.id, [])).rejects.toThrow(/Mindestens eine/);
	});

	it('sortiert die Gemeinschaften innerhalb eines Traktandums', async () => {
		// «Kann ja sein, dass die Auswahl uneinheitlich ist oder abweicht von
		// anderen Abstimmungen mit denselben Gemeinschaften» (Auftraggeber, 11.08.2026).
		const a = await abendMit('Sortieren', 3);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Einstellhalle',
			antragswortlaut: 'Die Sanierung sei zu beschliessen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		const kurz = (z: { gemeinschaft: string | null }) => z.gemeinschaft?.replace(/^.*— /, '');
		const vorher = (await liste(a.tag)).filter((z) => z.geschaeftId === g.id && z.tiefe === 2);
		expect(vorher.map(kurz)).toEqual(['Haus 1', 'Haus 2', 'Haus 3']);

		// Das dritte Haus nach vorn — nur in diesem Traktandum.
		const drittes = vorher[2].traktandumId!;
		await verschiebeInGeschaeft(handelnder(), a.tag, g.id, drittes, vorher[0].traktandumId);

		const nachher = (await liste(a.tag)).filter((z) => z.geschaeftId === g.id && z.tiefe === 2);
		expect(nachher.map(kurz)).toEqual(['Haus 3', 'Haus 1', 'Haus 2']);
		expect(nachher.map((z) => z.nummer)).toEqual(['9.1', '9.2', '9.3']);

		// Die anderen Traktanden behalten die Ordnung des Abends.
		const begruessung = (await liste(a.tag)).filter(
			(z) => z.tiefe === 2 && z.nummer.startsWith('1.')
		);
		expect(begruessung.map(kurz)).toEqual(['Haus 1', 'Haus 2', 'Haus 3']);

		// Und die neue Ziffer steht in der Gemeinschaft.
		expect(await nummernIn(a.versammlungen[2].id)).toContain('9.1 Einstellhalle');
	});

	it('setzt das Quorum beim Erfassen — in jeder Gemeinschaft', async () => {
		// «Das Quorum muss beim Erfassen definiert werden können. Sonst muss ich
		// immer für jede Gemeinschaft einzeln erfassen» (Auftraggeber, 11.08.2026).
		const a = await abendMit('Quorum', 3);
		await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Hausordnung',
			antragswortlaut: 'Die Hausordnung sei zu ändern.',
			meetingIds: a.versammlungen.map((v) => v.id),
			erfordernis: 'k-hausordnung'
		});

		for (const v of a.versammlungen) {
			const t = (await holeTraktanden(betreiber, v.id)).find(
				(x) => x.knoten.titel === 'Hausordnung'
			);
			expect(t?.knoten.erfordernis).toBeTruthy();
			expect(t?.knoten.erfordernis?.knotenId).toBe('k-hausordnung');
		}
	});

	it('ändert das Quorum im Bestand — in allen Häusern', async () => {
		// «Was noch gemacht werden muss ist, dass man das Quorum ändern kann, im
		// Bestand» (Auftraggeber, 11.08.2026). Vorher ging es nur beim Erfassen.
		const a = await abendMit('Quorum aendern', 3);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Velounterstand',
			antragswortlaut: 'Ein Velounterstand sei zu bauen.',
			meetingIds: a.versammlungen.map((v) => v.id),
			erfordernis: 'k-hausordnung'
		});

		const n = await setzeErfordernisAmGeschaeft(handelnder(), a.tag, g.id, 'k-baulich-nuetzlich');
		expect(n).toBe(3);

		for (const v of a.versammlungen) {
			const t = (await holeTraktanden(betreiber, v.id)).find(
				(x) => x.knoten.titel === 'Velounterstand'
			);
			expect(t?.knoten.erfordernis?.knotenId).toBe('k-baulich-nuetzlich');
		}

		// Und die Liste meldet den Fall als gemeinsam — die Auswahl steht vorbelegt.
		const punkt = (await punkte(a.tag)).find((z) => z.titel === 'Velounterstand')!;
		expect(punkt.erfordernis).toBe('k-baulich-nuetzlich');
	});

	it('meldet kein gemeinsames Quorum, wenn die Häuser auseinandergehen', async () => {
		// Ein vorbelegter Wert behauptete eine Einheitlichkeit, die es nicht gibt.
		const a = await abendMit('Quorum uneinheitlich', 2);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Sitzbank',
			antragswortlaut: 'Eine Sitzbank sei zu beschaffen.',
			meetingIds: a.versammlungen.map((v) => v.id),
			erfordernis: 'k-hausordnung'
		});
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE agenda_item SET requirement_node = 'k-baulich-nuetzlich'
				 WHERE business_id = ${g.id} AND meeting_id = ${a.versammlungen[0].id}
			`
		);
		expect((await punkte(a.tag)).find((z) => z.titel === 'Sitzbank')!.erfordernis).toBeNull();
	});

	it('lässt das Quorum nach der Eröffnung nicht mehr ändern', async () => {
		// Nach welchem Mehr ausgezählt wird, muss vor der Abstimmung feststehen.
		const a = await abendMit('Quorum gesperrt', 1);
		const g = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Zaun',
			antragswortlaut: 'Ein Zaun sei zu errichten.',
			meetingIds: [a.versammlungen[0].id],
			erfordernis: 'k-hausordnung'
		});
		await imKontext(
			betreiber,
			// Die Schranke `meeting_zeitstempel` verlangt bei «laufend» beide Marken.
			(tx) => tx`
				UPDATE meeting SET state = 'laufend', released_at = now(), opened_at = now()
				 WHERE id = ${a.versammlungen[0].id}
			`
		);
		await expect(
			setzeErfordernisAmGeschaeft(handelnder(), a.tag, g.id, 'k-baulich-nuetzlich')
		).rejects.toThrow(/bereits eröffnet/);
	});

	it('lässt das Quorum offen, wenn keines gewählt wurde', async () => {
		// Wer den Fall nicht kennt, soll nicht raten müssen — der Entscheidbaum
		// führt später je Gemeinschaft hin.
		const a = await abendMit('Quorum offen', 2);
		await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Offene Frage',
			antragswortlaut: 'Etwas sei zu beschliessen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const t = (await holeTraktanden(betreiber, a.versammlungen[0].id)).find(
			(x) => x.knoten.titel === 'Offene Frage'
		);
		expect(t?.knoten.erfordernis).toBeFalsy();
	});
});

describe('Ein Geschäft gehört zu genau einem Abend', () => {
	/*
	 * **Dieselbe Klasse wie bei Vollmachten, Traktanden und Weisungen**
	 * (07.09.2026). Die Geschäfteseite bekommt den Abend aus der Adresse und
	 * das Geschäft aus dem Formular, und keine der vier Handlungen verglich die
	 * beiden. `SELECT * FROM business WHERE id = ${…}` fand jedes Geschäft des
	 * Betreibers. Die Zeilensicherheit trennt hier nichts — beide Abende gehören
	 * demselben Betreiber.
	 *
	 * Jede Probe holt sich ihre eigenen zwei Abende, sonst verschenkten die
	 * späteren ihr Rot (`fb_geteiltes_pruefobjekt_verschenkt_das_gruen`).
	 */
	async function zweiAbende(name: string) {
		const hier = await abendMit(`${name} A`, 2);
		const dort = await abendMit(`${name} B`, 2);
		const fremdes = (await liste(dort.tag)).find((z) => z.titel === 'Jahresrechnung')!;
		return { hier, dort, fremdes };
	}

	it('bearbeitet kein Geschäft eines anderen Abends', async () => {
		const { hier, fremdes } = await zweiAbende('Abendbindung 1');
		await expect(
			bearbeiteGeschaeft(handelnder(), hier.tag, fremdes.geschaeftId, {
				titel: 'Umbenannt von aussen',
				antragswortlaut: null,
				art: 'kenntnisnahme'
			})
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});

	it('nimmt kein Geschäft eines anderen Abends von der Liste', async () => {
		const { hier, fremdes } = await zweiAbende('Abendbindung 2');
		await expect(loescheGeschaeft(handelnder(), hier.tag, fremdes.geschaeftId)).rejects.toThrow(
			/gehört nicht zu diesem Abend/
		);
	});

	it('setzt am Geschäft eines anderen Abends kein Erfordernis', async () => {
		const { hier, fremdes } = await zweiAbende('Abendbindung 3');
		await expect(
			setzeErfordernisAmGeschaeft(handelnder(), hier.tag, fremdes.geschaeftId, 'k-baulich-nuetzlich')
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});

	it('ändert die Beteiligten eines Geschäfts eines anderen Abends nicht', async () => {
		const { hier, dort, fremdes } = await zweiAbende('Abendbindung 4');
		await expect(
			setzeBeteiligte(
				handelnder(),
				hier.tag,
				fremdes.geschaeftId,
				dort.versammlungen.map((v) => v.id)
			)
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});

	/*
	 * **Die Gegenprobe.** Ohne sie belegten die vier oben auch eine Schranke,
	 * die jedes Geschäft abwiese. Und sie prüft zugleich die Reihenfolge der
	 * beiden Kennungen: Vertauscht sind es dieselben Zeichenketten.
	 */
	it('bearbeitet das Geschäft des eigenen Abends', async () => {
		const dort = await abendMit('Abendbindung 5', 2);
		const g = await erstelleGeschaeft(handelnder(), dort.tag, {
			titel: 'Allgemeinstrom',
			antragswortlaut: 'Der Allgemeinstrom sei zu überprüfen.',
			meetingIds: dort.versammlungen.map((v) => v.id)
		});
		const e = await bearbeiteGeschaeft(handelnder(), dort.tag, g.id, {
			titel: 'Allgemeinstrom und Wasser',
			antragswortlaut: 'Beides sei zu überprüfen.',
			art: 'abstimmung'
		});
		expect(e.mitgezogen + e.geblieben).toBeGreaterThan(0);
	});

	it('ordnet in einem Geschäft eines anderen Abends nicht um', async () => {
		// Der fünfte Weg derselben Klasse, aus dem Code-Review: Die Aktion
		// `umordnen` las `params` gar nicht, und der Abend wurde aus der ersten
		// gefundenen Zeile abgeleitet.
		const { hier, dort, fremdes } = await zweiAbende('Abendbindung 7');
		const unter = (await liste(dort.tag)).filter((z) => z.geschaeftId === fremdes.geschaeftId);
		await expect(
			verschiebeInGeschaeft(
				handelnder(),
				hier.tag,
				fremdes.geschaeftId,
				unter[unter.length - 1].traktandumId!,
				unter[0].traktandumId!
			)
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});

	it('weist die vertauschte Paarung ab', async () => {
		// Ein Abend genügt: Vertauscht werden Rahmen und Gegenstand desselben.
		const dort = await abendMit('Abendbindung 6', 2);
		const fremdes = (await liste(dort.tag)).find((z) => z.titel === 'Jahresrechnung')!;
		await expect(
			loescheGeschaeft(handelnder(), fremdes.geschaeftId, dort.tag)
		).rejects.toThrow(/gehört nicht zu diesem Abend/);
	});
});

describe('Ab der Freigabe schreibt der Abend keine Nummern mehr', () => {
	/**
	 * **Die Lücke, um die es hier geht** (21.08.2026).
	 *
	 * Seit die Freigabe die Nummern festschreibt (Migration 072), darf die
	 * Versammlung ihre Reihenfolge ändern, ohne dass die Nummern wandern. Der
	 * Versammlungstag schreibt sie aber über einen **zweiten** Weg: `manual_number`,
	 * damit alle Häuser eines Abends dieselbe Nummer tragen — und eine von Hand
	 * gesetzte Nummer geht der festgeschriebenen vor.
	 *
	 * Ohne Sperre hebelte ein Umsortieren am Abend die Festschreibung damit
	 * wieder aus: Die Häuser bekämen andere Nummern, als auf ihren Einladungen
	 * stehen — genau der Fall, den die Festschreibung verhindern soll.
	 */
	it('lässt die Nummer eines freigegebenen Hauses stehen', async () => {
		const a = await abendMit('Freigabesperre', 2);
		await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Rampe beim Hintereingang',
			antragswortlaut: 'Die Rampe sei zu sanieren.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});
		const zweites = await erstelleGeschaeft(handelnder(), a.tag, {
			titel: 'Allgemeinstrom',
			antragswortlaut: 'Der Allgemeinstrom sei zu überprüfen.',
			meetingIds: a.versammlungen.map((v) => v.id)
		});

		/*
		 * Der Zustand wird hier gesetzt statt über `gibVersammlungFrei` erhoben:
		 * Die Freigabe verlangt Einheiten, Eigentümer und einen vollständigen
		 * Stimmberechtigtenstand, und nichts davon gehört zu dem, was dieser Test
		 * prüft — nämlich dass der Abend eine Nummer in Ruhe lässt, sobald das Haus
		 * nicht mehr im Entwurf ist.
		 */
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'freigegeben', released_at = now()
			 WHERE id = ${a.versammlungen[0].id}
		`);

		const vorher = await nummernIn(a.versammlungen[0].id);
		const imEntwurf = await nummernIn(a.versammlungen[1].id);

		// Umsortieren am Abend: das zweite Geschäft nach vorn. Dieselben zwei
		// Schritte wie in der Seite — das Verschieben ordnet, das Schreiben
		// beschriftet (`tage/[id]/geschaefte/+page.server.ts`).
		const punkteVorher = await punkte(a.tag);
		await verschiebeGeschaeft(handelnder(), a.tag, zweites.id, punkteVorher[0].geschaeftId);
		await schreibeNummern(handelnder(), a.tag);

		/*
		 * Verglichen wird die **Zuordnung** Nummer↔Titel, nicht die Reihenfolge:
		 * Die ändert sich auch im freigegebenen Haus, und genau so soll es sein —
		 * die Versammlung darf umstellen, nur die Nummern wandern nicht mit.
		 */
		expect((await nummernIn(a.versammlungen[0].id)).sort()).toEqual([...vorher].sort());
		// … das Haus im Entwurf zieht wie bisher nach.
		expect((await nummernIn(a.versammlungen[1].id)).sort()).not.toEqual([...imEntwurf].sort());
	});
});

describe('Mustertraktanden am Abend', () => {
	it('bietet nur an, was fehlt', async () => {
		const a = await abendMit('Muster', 2);
		// Die Pflichttraktanden sind über die Versammlungen schon da und
		// eingesammelt — es fehlt nichts mehr.
		expect((await fehlendeMuster(betreiber, a.tag)).fehlen).toHaveLength(0);
	});

	it('legt ein fehlendes Muster als einen Punkt für alle Häuser an', async () => {
		const a = await abendMit('Muster nachtragen', 2);

		// Die Lücke entsteht, indem jemand einen Punkt von der Liste nimmt — der
		// häufige Fall: versehentlich entfernt und später vermisst.
		const weg = (await liste(a.tag)).find((z) => z.titel === 'Jahresrechnung')!;
		await loescheGeschaeft(handelnder(), a.tag, weg.geschaeftId);

		const fehlen = (await fehlendeMuster(betreiber, a.tag)).fehlen;
		expect(fehlen.map((v) => v.schluessel)).toEqual(['jahresrechnung']);

		const e = await uebernimmMuster(handelnder(), a.tag, ['jahresrechnung']);
		expect(e.haeuser).toBe(2);
		expect(e.traktanden).toBe(2);

		const jr = (await punkte(a.tag)).find((z) => z.titel === 'Jahresrechnung');
		expect(jr).toBeDefined();
		expect(jr!.haeuser).toBe(2);

		// In beiden Gemeinschaften unter derselben Punktnummer, je eigene Ziffer.
		for (const [i, v] of a.versammlungen.entries()) {
			expect(await nummernIn(v.id)).toContain(`${jr!.nummer}.${i + 1} Jahresrechnung`);
		}
	});

	it('leitet das Erfordernis je Gemeinschaft her', async () => {
		const a = await abendMit('Muster Erfordernis', 2);
		const budget = (await liste(a.tag)).find((z) => z.titel === 'Budget und Beiträge')!;
		await loescheGeschaeft(handelnder(), a.tag, budget.geschaeftId);

		await uebernimmMuster(handelnder(), a.tag, ['budget']);

		for (const v of a.versammlungen) {
			const t = (await holeTraktanden(betreiber, v.id)).find(
				(x) => x.knoten.titel === 'Budget und Beiträge'
			);
			expect(t?.knoten.erfordernis).toBeTruthy();
		}
	});

	it('lehnt ab, wenn nichts gewählt ist', async () => {
		const a = await abendMit('Muster leer', 1);
		await expect(uebernimmMuster(handelnder(), a.tag, [])).rejects.toThrow(/Wählen Sie/);
	});
});
