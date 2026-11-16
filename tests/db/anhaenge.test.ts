/**
 * Story 3.4 — Anhänge an Versammlung und Traktandum.
 *
 * Geprüft wird der Weg durch die Schale: die Ablage unter der Prüfsumme, die
 * Zuordnung zum Gegenstand, die Sperre nach der Freigabe und dass eine
 * behauptete Dateiart nichts nützt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum } from '$lib/server/traktanden';
import {
	haengeAn,
	holeAnhaengeDerVersammlung,
	holeAnhangsangaben,
	loeseAb
} from '$lib/server/anhaenge';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiberA: string;
let betreiberB: string;
let stwegA: string;
let versammlungA: string;
let traktandumA: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Eine Datei, wie ein Formular sie liefert. */
function alsDatei(bytes: number[], name: string, behaupteterTyp: string): File {
	return new File([new Uint8Array([...bytes, ...new Array(64).fill(0x41)])], name, {
		type: behaupteterTyp
	});
}

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const EXE = [0x4d, 0x5a, 0x90, 0x00];
const DOCX = [0x50, 0x4b, 0x03, 0x04];

async function neueVersammlung(operatorId: string, stwegId: string, datum: string) {
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	return v.id;
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Anhänge A');
	betreiberB = await pruefbetreiber('Anhänge B');

	const a = await erstelleGemeinschaft(handelnder(betreiberA), {
		name: 'Anhangweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegA = a.id;
	versammlungA = await neueVersammlung(betreiberA, stwegA, '2026-11-10');

	const t = await erstelleTraktandum(handelnder(betreiberA), {
		meetingId: versammlungA,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	traktandumA = t.id;
});

afterAll(verbindungenSchliessen);

describe('Anhängen', () => {
	it('hängt eine Unterlage ans Traktandum', async () => {
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'agenda_item',
			traktandumA,
			alsDatei(PDF, 'offerte-meier.pdf', 'application/pdf')
		);
		expect(a.name).toBe('offerte-meier.pdf');
		expect(a.pruefsumme).toMatch(/^[0-9a-f]{64}$/);

		const liste = await holeAnhaengeDerVersammlung(betreiberA, versammlungA);
		expect(liste.some((x) => x.id === a.id && x.gegenstandId === traktandumA)).toBe(true);
	});

	it('hängt eine Unterlage an die Versammlung selbst', async () => {
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'meeting',
			versammlungA,
			alsDatei(PDF, 'raumbestaetigung.pdf', 'application/pdf')
		);
		const liste = await holeAnhaengeDerVersammlung(betreiberA, versammlungA);
		expect(liste.find((x) => x.id === a.id)?.gegenstandArt).toBe('meeting');
	});

	it('legt denselben Inhalt nur einmal ab', async () => {
		// Der Dateiname ist die Prüfsumme. Wer dieselbe Offerte an zwei Geschäfte
		// hängt, erzeugt keine zweite Kopie (AD-17).
		const eins = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'meeting',
			versammlungA,
			alsDatei(PNG, 'plan.png', 'image/png')
		);
		const zwei = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'agenda_item',
			traktandumA,
			alsDatei(PNG, 'derselbe-plan.png', 'image/png')
		);
		expect(zwei.pruefsumme).toBe(eins.pruefsumme);
		expect(zwei.id).not.toBe(eins.id);
	});

	it('schreibt die Prüfsumme in den Verlauf', async () => {
		// Damit sich später belegen lässt, welcher Inhalt zum Zeitpunkt des
		// Beschlusses vorlag.
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'agenda_item',
			traktandumA,
			alsDatei([...PDF, 0x0a, 0x99], 'nachweis.pdf', 'application/pdf')
		);
		const zeilen = await imKontext(betreiberA, (tx) => tx<{ detail: { pruefsumme: string } }[]>`
			SELECT detail FROM audit_entry
			WHERE event_type = 'attachment.added' AND subject_id = ${traktandumA}
		`);
		expect(zeilen.map((z) => z.detail.pruefsumme)).toContain(a.pruefsumme);
	});
});

describe('Die Angabe des Browsers zählt nicht', () => {
	it('weist eine als PDF ausgegebene ausführbare Datei ab', async () => {
		await expect(
			haengeAn(
				handelnder(betreiberA),
				versammlungA,
				'agenda_item',
				traktandumA,
				alsDatei(EXE, 'offerte.pdf', 'application/pdf')
			)
		).rejects.toThrow(/ausführbares Programm/);
	});

	it('weist ein umbenanntes Office-Dokument ab', async () => {
		await expect(
			haengeAn(
				handelnder(betreiberA),
				versammlungA,
				'agenda_item',
				traktandumA,
				alsDatei(DOCX, 'antrag.pdf', 'application/pdf')
			)
		).rejects.toThrow(/Makros/);
	});

	it('speichert die erkannte Art, nicht die behauptete', async () => {
		// Sonst öffnete der Browser den Inhalt später in der falschen Annahme.
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'meeting',
			versammlungA,
			alsDatei([...PNG, 0x11], 'skizze.png', 'application/pdf')
		);
		expect(a.art).toBe('image/png');
		expect((await holeAnhangsangaben(betreiberA, a.pruefsumme))?.art).toBe('image/png');
	});

	it('weist eine leere Datei ab', async () => {
		await expect(
			haengeAn(handelnder(betreiberA), versammlungA, 'meeting', versammlungA, new File([], 'leer.pdf'))
		).rejects.toThrow(/keine Datei/);
	});
});

describe('Ablösen', () => {
	it('löst einen Anhang ab und hält es im Verlauf fest', async () => {
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'meeting',
			versammlungA,
			alsDatei([...PDF, 0x2a], 'zu-loeschen.pdf', 'application/pdf')
		);
		await loeseAb(handelnder(betreiberA), versammlungA, a.id);

		const liste = await holeAnhaengeDerVersammlung(betreiberA, versammlungA);
		expect(liste.some((x) => x.id === a.id)).toBe(false);

		const zeilen = await imKontext(betreiberA, (tx) => tx<{ detail: { name: string } }[]>`
			SELECT detail FROM audit_entry WHERE event_type = 'attachment.removed'
		`);
		expect(zeilen.map((z) => z.detail.name)).toContain('zu-loeschen.pdf');
	});
});

describe('Sperre nach der Freigabe', () => {
	it('nimmt keine Unterlage mehr an', async () => {
		// Die Unterlagen sind mit der Einladung verschickt. Kämen danach noch
		// welche dazu, hätten die Eigentümer über eine andere Grundlage
		// entschieden, als sie erhalten haben.
		const v = await neueVersammlung(betreiberA, stwegA, '2026-11-20');
		await imKontext(
			betreiberA,
			(tx) => tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}`
		);
		await expect(
			haengeAn(handelnder(betreiberA), v, 'meeting', v, alsDatei(PDF, 'spaet.pdf', 'application/pdf'))
		).rejects.toThrow(/freigegeben/);
	});
});

describe('Ein Anhang hängt an einem Traktandum DIESER Versammlung', () => {
	/*
	 * **Die Klasse, nicht die Instanz** (07.09.2026). Der Anhangsweg bekommt die
	 * Versammlung aus der Adresse und das Traktandum aus dem Formular, und
	 * `bezugPruefen` fragte nur nach dem Traktandum. Dieselbe Bauart wie bei den
	 * Vollmachten (`69f107c`) und den Traktanden (`ec57517`); der Prüfbericht
	 * `docs/audit/2026-09-07-traktandumsbindung.md` hat diesen Weg ausdrücklich
	 * offen gelassen.
	 *
	 * Die Zeilensicherheit trennt hier nichts: Beide Versammlungen gehören
	 * demselben Betreiber. Die Grenze zwischen ihnen ist Anwendungscode.
	 */
	let drueben: string;
	let druebenTraktandum: string;

	beforeAll(async () => {
		drueben = await neueVersammlung(betreiberA, stwegA, '2026-12-01');
		const t = await erstelleTraktandum(handelnder(betreiberA), {
			meetingId: drueben,
			titel: 'Ganz anderes Geschäft',
			art: 'abstimmung',
			antragswortlaut: 'Etwas anderes.',
			antragstellerart: 'bewirtschaftung'
		});
		druebenTraktandum = t.id;
	});

	it('weist ein Traktandum aus einer anderen Versammlung ab', async () => {
		await expect(
			haengeAn(
				handelnder(betreiberA),
				versammlungA,
				'agenda_item',
				druebenTraktandum,
				alsDatei(PDF, 'fremd.pdf', 'application/pdf')
			)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});

	it('weist eine andere Versammlung als Gegenstand ab', async () => {
		await expect(
			haengeAn(
				handelnder(betreiberA),
				versammlungA,
				'meeting',
				drueben,
				alsDatei(PDF, 'fremd2.pdf', 'application/pdf')
			)
		).rejects.toThrow(/nicht gefunden/);
	});

	/*
	 * **Die Gegenprobe.** Ohne sie belegten die beiden oben auch eine Schranke,
	 * die jeden Anhang abwiese — und der Weg, um den es geht, ist der richtige.
	 * Sie muss zugleich beweisen, dass die Reihenfolge der beiden Kennungen
	 * stimmt: Vertauscht man sie, ist es dieselbe Zeichenkette (`Id`).
	 */
	it('nimmt das Traktandum der eigenen Versammlung an', async () => {
		const a = await haengeAn(
			handelnder(betreiberA),
			drueben,
			'agenda_item',
			druebenTraktandum,
			alsDatei(PDF, 'eigen.pdf', 'application/pdf')
		);
		expect(a.name).toBe('eigen.pdf');
	});

	it('löst keinen Anhang einer anderen Versammlung ab', async () => {
		/*
		 * **Auch der Ablöseweg** (Code-Review 07.09.2026). Die erste Fassung
		 * leitete die Versammlung aus dem Anhang selbst ab und verglich sie mit
		 * sich — eine Prüfung, die nicht scheitern kann. Beide
		 * `abloesen`-Aktionen nahmen die Kennung aus dem Formular.
		 */
		const a = await haengeAn(
			handelnder(betreiberA),
			drueben,
			'meeting',
			drueben,
			alsDatei([...PDF, 0x5c], 'drueben.pdf', 'application/pdf')
		);
		await expect(loeseAb(handelnder(betreiberA), versammlungA, a.id)).rejects.toThrow(
			/nicht gefunden/
		);
		// Und er liegt noch da.
		expect((await holeAnhaengeDerVersammlung(betreiberA, drueben)).some((x) => x.id === a.id)).toBe(
			true
		);
		// Gegenprobe: mit dem richtigen Rahmen geht es.
		await loeseAb(handelnder(betreiberA), drueben, a.id);
		expect((await holeAnhaengeDerVersammlung(betreiberA, drueben)).some((x) => x.id === a.id)).toBe(
			false
		);
	});

	it('weist die vertauschte Paarung ab', async () => {
		// Rahmen und Gegenstand verwechselt: beide sind `Id`, der Übersetzer
		// merkt nichts.
		await expect(
			haengeAn(
				handelnder(betreiberA),
				druebenTraktandum,
				'agenda_item',
				drueben,
				alsDatei(PDF, 'vertauscht.pdf', 'application/pdf')
			)
		).rejects.toThrow(/gehört nicht zu dieser Versammlung/);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem Betreiber keine fremden Anhänge', async () => {
		expect(await holeAnhaengeDerVersammlung(betreiberB, versammlungA)).toHaveLength(0);
	});

	it('gibt zu einer fremden Prüfsumme keine Angaben heraus', async () => {
		const a = await haengeAn(
			handelnder(betreiberA),
			versammlungA,
			'meeting',
			versammlungA,
			alsDatei([...PDF, 0x77], 'geheim.pdf', 'application/pdf')
		);
		expect(await holeAnhangsangaben(betreiberB, a.pruefsumme)).toBeNull();
		expect(await holeAnhangsangaben(betreiberA, a.pruefsumme)).not.toBeNull();
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT id FROM attachment`)).toHaveLength(0);
	});
});
