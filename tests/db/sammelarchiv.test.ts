/**
 * Sammelarchivierung — und die zwei Fallen, die nur im Verbund auftreten.
 *
 * **Der Auftrag** (Auftraggeber, 15.09.2026): «ein Bulk zum Massenarchivieren.»
 *
 * Die Einzelarchivierung ist an anderer Stelle geprüft (`archivieren.test.ts`).
 * Hier geht es nur um das, was **erst entsteht, wenn mehrere zusammen gehen**:
 *
 *   1. **Die Reihenfolge.** Die Auswahl kommt in der Reihenfolge der Liste, und
 *      die ist nach Namen sortiert. Ginge ein Haus vor seiner Klammer ins
 *      Archiv, trüge es ein eigenes `archived_at` — und käme beim Hervorholen
 *      der Klammer nicht mit zurück. Der Bestand sähe danach richtig aus und
 *      verhielte sich falsch: Die MEG kommt, ein Haus bleibt.
 *   2. **Was kein Fehlschlag ist.** Wer Klammer und Kind zusammen auswählt,
 *      will beides wegräumen. Das Kind geht mit der Klammer; seine
 *      Einzelabsage lautete danach «liegt bereits im Archiv, weil …». Als
 *      Ablehnung gemeldet, liest sich ein gelungener Vorgang wie ein
 *      Fehlschlag — und lädt zu einer Wiederholung ein, die nichts ändert.
 *
 * **Warum das in die Datenbank und nicht in einen Kerntest gehört.** Beide
 * Fallen hängen am Baum in `stweg` und an der Ableitung `stweg_archiv_wegen`.
 * Ohne echte Zeilen prüfte man die eigene Annahme über den Baum, nicht den Baum.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft, listeGemeinschaften } from '$lib/server/gemeinschaften';
import {
	archiviere,
	archiviereMehrere,
	holeAusArchiv,
	SAMMELGRENZE
} from '$lib/server/archivieren';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function wer() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

/** Legt eine Gemeinschaft an und gibt ihre Kennung zurück. */
async function haus(name: string, eltern: string | null = null): Promise<string> {
	const g = await erstelleGemeinschaft(wer(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: eltern
	});
	return g.id;
}

/** Liegt sie im Archiv — eigen oder geerbt? */
async function imArchiv(id: string): Promise<boolean> {
	const alle = await listeGemeinschaften(betreiber, 'alle');
	return Boolean(alle.find((g) => g.id === id)?.imArchivSeit);
}

/** Trägt sie ein **eigenes** Archivdatum? Das ist der Unterschied, der zählt. */
async function eigenesDatum(id: string): Promise<boolean> {
	const alle = await listeGemeinschaften(betreiber, 'alle');
	return Boolean(alle.find((g) => g.id === id)?.archiviertAm);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Sammelarchiv');
	benutzer = await pruefbenutzer(betreiber, 'sammel');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('archiviereMehrere', () => {
	it('archiviert mehrere eigenständige Gemeinschaften auf einmal', async () => {
		const a = await haus('Prüflauf Sammel A');
		const b = await haus('Prüflauf Sammel B');

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [a, b], 'Mandat beendet');

		expect(ergebnis.gelungen.map((g) => g.id).sort()).toEqual([a, b].sort());
		expect(ergebnis.abgelehnt).toEqual([]);
		expect(ergebnis.mitgegangen).toEqual([]);
		expect(await imArchiv(a)).toBe(true);
		expect(await imArchiv(b)).toBe(true);
	});

	it('zählt eine doppelt genannte Kennung nur einmal', async () => {
		/*
		 * Sonst stünde derselbe Name einmal unter «archiviert» und einmal unter
		 * «ging nicht» — und beides stimmte, was die Meldung unlesbar macht.
		 */
		const a = await haus('Prüflauf Sammel Doppelt');

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [a, a, a]);

		expect(ergebnis.gelungen).toHaveLength(1);
		expect(ergebnis.abgelehnt).toEqual([]);
	});

	it('meldet je Gegenstand den Grund, statt am ersten abzubrechen', async () => {
		/*
		 * **Einzeln, nicht alles-oder-nichts.** Bei zwanzig Ausgewählten trifft
		 * fast immer einen ein Grund; alles-oder-nichts hiesse, dass er
		 * neunzehn richtige Vorgänge verhindert.
		 */
		const schon = await haus('Prüflauf Sammel Schon');
		await archiviereMehrere(wer(), 'gemeinschaft', [schon]);
		const frisch = await haus('Prüflauf Sammel Frisch');

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [schon, frisch]);

		expect(ergebnis.gelungen.map((g) => g.id)).toEqual([frisch]);
		expect(ergebnis.abgelehnt).toHaveLength(1);
		expect(ergebnis.abgelehnt[0].id).toBe(schon);
		// Der Grund kommt im Wortlaut der Einzelabsage, nicht als Kennung.
		expect(ergebnis.abgelehnt[0].grund.length).toBeGreaterThan(10);
	});

	it('führt das Kind einer gewählten Klammer als «mitgegangen», nicht als Absage', async () => {
		const klammer = await haus('Prüflauf Sammel Klammer');
		const kind = await haus('Prüflauf Sammel Kind', klammer);

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [klammer, kind]);

		expect(ergebnis.gelungen.map((g) => g.id)).toEqual([klammer]);
		expect(ergebnis.abgelehnt).toEqual([]);
		expect(ergebnis.mitgegangen.map((m) => m.id)).toEqual([kind]);
		expect(ergebnis.mitgegangen[0].wegen).toContain('Klammer');
		expect(await imArchiv(kind)).toBe(true);
	});

	it('meldet eine Absage, wenn die Klammer NICHT mitgewählt war', async () => {
		/*
		 * Die Gegenrichtung zum Test darüber — und der Grund, warum «mitgegangen»
		 * an der Auswahl hängt und nicht am Zustand: Liegt das Haus im Archiv
		 * wegen einer Klammer, die gar nicht gewählt war, hat der Aufrufer etwas
		 * anderes gewollt, als er bekommt, und muss es erfahren.
		 */
		const klammer = await haus('Prüflauf Sammel Fremd MEG');
		const kind = await haus('Prüflauf Sammel Fremd Haus', klammer);
		await archiviereMehrere(wer(), 'gemeinschaft', [klammer]);

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [kind]);

		expect(ergebnis.gelungen).toEqual([]);
		expect(ergebnis.mitgegangen).toEqual([]);
		expect(ergebnis.abgelehnt).toHaveLength(1);
		expect(ergebnis.abgelehnt[0].grund).toContain('Fremd MEG');
	});

	it('archiviert die Klammer zuerst, auch wenn das Kind vorn in der Liste steht', async () => {
		/*
		 * **Der Test, um den es hier eigentlich geht.** Die Auswahl kommt nach
		 * Namen sortiert: «Aarestrasse» vor «Zentrum», auch wenn es darunter
		 * hängt. Ohne die Sortierung nach Tiefe ginge das Haus zuerst einzeln ins
		 * Archiv, trüge ein eigenes `archived_at` — und bliebe beim Hervorholen
		 * der Klammer zurück.
		 *
		 * Gemessen wird deshalb nicht «liegt im Archiv» (das täte beides), sondern
		 * **ob es ein eigenes Datum trägt**. Genau daran entscheidet sich, ob es
		 * mit zurückkommt.
		 */
		const klammer = await haus('Prüflauf Sammel ZZZ Klammer');
		const kind = await haus('Prüflauf Sammel AAA Kind', klammer);

		// Die Reihenfolge, die eine nach Namen sortierte Liste liefert: Kind zuerst.
		await archiviereMehrere(wer(), 'gemeinschaft', [kind, klammer]);

		expect(await eigenesDatum(klammer)).toBe(true);
		expect(await eigenesDatum(kind)).toBe(false);
		expect(await imArchiv(kind)).toBe(true);

		// Und die Probe aufs Exempel: Das Hervorholen der Klammer bringt es mit.
		await holeAusArchiv(wer(), 'gemeinschaft', klammer);
		expect(await imArchiv(klammer)).toBe(false);
		expect(await imArchiv(kind)).toBe(false);
	});

	it('weist mehr als die Sammelgrenze ab, ohne etwas anzufassen', async () => {
		const eines = await haus('Prüflauf Sammel Grenze');
		const zuviele = Array.from({ length: SAMMELGRENZE + 1 }, () => eines);

		await expect(archiviereMehrere(wer(), 'gemeinschaft', zuviele)).rejects.toThrow(
			FachlicherFehler
		);
		// Nichts angefasst: Die Absage kommt vor dem ersten Vorgang.
		expect(await imArchiv(eines)).toBe(false);
	});

	it('kommt mit einer leeren Auswahl zurecht', async () => {
		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', []);
		expect(ergebnis).toEqual({ gelungen: [], abgelehnt: [], mitgegangen: [] });
	});

	it('lässt das GESUNDE Geschwister einer gescheiterten Klammer stehen', async () => {
		/*
		 * **Der Fall, den die blosse Sortierung nicht deckte** (aus dem
		 * Code-Review, 15.09.2026). Klammern zuerst zu archivieren schützt die
		 * Invariante nur, solange die Klammer durchgeht. Scheitert sie, gingen
		 * ihre Kinder danach **einzeln** ins Archiv und trugen ein eigenes
		 * `archived_at` — und blieben beim Hervorholen der Klammer zurück.
		 *
		 * **Und warum es drei Häuser braucht, nicht zwei** (aus der Gegenprobe:
		 * die erste Fassung dieses Tests wurde zwar rot, aber am falschen
		 * Merkmal). Liegt die sperrende Versammlung im einzigen Kind, scheitert
		 * dieses Kind ohnehin aus eigenem Recht — der Test wäre auch ohne die
		 * Sperre fast grün. Gefährlich ist das **gesunde Geschwister**: Es würde
		 * allein durchgehen, und genau daran zeigt sich, ob die Sperre greift.
		 *
		 *   K  (Klammer)          — scheitert, weil die Gruppe gesperrt ist
		 *   ├─ A  freigegebene V. — scheitert aus eigenem Recht
		 *   └─ B  leer            — ginge allein durch  ← hier entscheidet es sich
		 */
		const k = await haus('Prüflauf Sammel Blockiert MEG');
		const a = await haus('Prüflauf Sammel Blockiert Haus A', k);
		const b = await haus('Prüflauf Sammel Blockiert Haus B', k);
		const v = await erstelleVersammlung(wer(), {
			stwegId: a,
			datum: '2026-05-20',
			uhrzeit: '19:00',
			ort: 'Prüflauf Blockiert',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		/*
		 * Freigegeben: Die Einladungen sind draussen, die Gruppe ist damit
		 * gesperrt. `released_at` gehört dazu — die Schranke `meeting_zeitstempel`
		 * (Migration 011) lässt `freigegeben` ohne Zeitstempel nicht zu, und das
		 * ist richtig so: Ein Zustand ohne seinen Beleg wäre eine Behauptung.
		 */
		await imKontext(betreiber, async (tx) => {
			await tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v.id}`;
		});

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [k, a, b]);

		expect(ergebnis.gelungen).toEqual([]);
		expect(ergebnis.mitgegangen).toEqual([]);
		expect(ergebnis.abgelehnt.map((x) => x.id).sort()).toEqual([k, a, b].sort());

		/*
		 * **Die Messung, um die es geht.** Ohne die Sperre stünde B hier mit einem
		 * eigenen Archivdatum — und käme beim späteren Hervorholen von K nicht
		 * mit zurück.
		 */
		expect(await eigenesDatum(b)).toBe(false);
		expect(await imArchiv(b)).toBe(false);

		// B bekommt den Grund der Klammer, nicht einen eigenen: Es hat keinen.
		const eintragB = ergebnis.abgelehnt.find((x) => x.id === b);
		const grundK = ergebnis.abgelehnt.find((x) => x.id === k)?.grund;
		expect(eintragB?.grund).toBe(grundK);
		/*
		 * **Und der Name unterscheidet die Zeilen.** Erben drei Häuser denselben
		 * Wortlaut, ist die Absageliste ohne Namen dreimal derselbe Satz.
		 */
		expect(eintragB?.name).toContain('Blockiert Haus B');
	});

	it('sondert eine krumme Kennung aus, ohne die gültigen mitzunehmen', async () => {
		/*
		 * Die Kennungen kommen aus Formularfeldern, an die kein Routenprüfer
		 * kommt. Ohne die Formprüfung antwortete PostgreSQL mit «invalid input
		 * syntax for type uuid», die Anwendung mit einer rohen 500 — und weil die
		 * Vorfahrenkette vor der Schleife läuft, wäre dabei **keine einzige**
		 * gültige Kennung archiviert worden.
		 */
		const gut = await haus('Prüflauf Sammel Krumm Gut');

		const ergebnis = await archiviereMehrere(wer(), 'gemeinschaft', [
			'kein-uuid',
			gut,
			"'; DROP TABLE stweg; --"
		]);

		expect(ergebnis.gelungen.map((g) => g.id)).toEqual([gut]);
		expect(ergebnis.abgelehnt).toHaveLength(2);
		expect(ergebnis.abgelehnt.every((a) => a.grund.includes('Kennung'))).toBe(true);
		// Zu einer krummen Kennung gibt es keinen Namen — und das steht so da.
		expect(ergebnis.abgelehnt.every((a) => a.name === null)).toBe(true);
		expect(await imArchiv(gut)).toBe(true);
	});

	it('weist eine Versammlung ab, die über ihre Gemeinschaft schon im Archiv liegt', async () => {
		/*
		 * **Aus dem Sicherheitsdurchgang, 15.09.2026.** Migration 087 leitet den
		 * Archivstand der Gruppe ab, statt ihn zu schreiben: Eine Versammlung
		 * unter einer archivierten Gemeinschaft trägt weiterhin `archived_at IS
		 * NULL`. Ohne Schranke bekäme sie beim Archivieren ein **eigenes** Datum
		 * — und bliebe nach dem Hervorholen der Gemeinschaft unsichtbar.
		 *
		 * Die Liste zeigte dafür bereits kein Kästchen. Das ist Oberfläche, und
		 * Oberfläche hält keine Kennung auf, die jemand selbst mitschickt.
		 */
		const g = await haus('Prüflauf Sammel Archivgruppe');
		const v = await erstelleVersammlung(wer(), {
			stwegId: g,
			datum: '2026-05-20',
			uhrzeit: '19:00',
			ort: 'Prüflauf Archivgruppe',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		// Versiegelt: sonst greift schon die Zustandsschranke und der Test misst sie.
		await imKontext(betreiber, async (tx) => {
			await tx`
				UPDATE meeting
				   SET state = 'versiegelt', released_at = now(), opened_at = now(), closed_at = now()
				 WHERE id = ${v.id}
			`;
		});
		await archiviereMehrere(wer(), 'gemeinschaft', [g]);

		await expect(archiviere(wer(), 'versammlung', v.id)).rejects.toThrow(FachlicherFehler);

		/*
		 * **Die Messung, um die es geht**: kein eigenes Datum. Läge eines hier,
		 * bliebe die Versammlung nach dem Hervorholen der Gemeinschaft weg.
		 */
		const [zeile] = await imKontext(betreiber, (tx) =>
			tx`SELECT archived_at FROM meeting WHERE id = ${v.id}`
		);
		expect(zeile.archived_at).toBeNull();
	});
});
