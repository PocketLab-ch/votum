/**
 * Archivieren in der Datenbank — und vor allem: was dabei **nicht** verschwindet.
 *
 * **Die Frage, um die es geht.** Eine Liste beantwortet entweder «woraus wähle
 * ich» oder «was gab es». Archiviertes gehört aus der ersten heraus und muss in
 * der zweiten bleiben. Wer beide gleich behandelt, nimmt an einem Ende zu viel
 * weg — im Verlauf stünden Zeilen ohne Namen.
 *
 * Geprüft werden deshalb **beide Enden**: Was aus Auswahl und Suche fällt, und
 * was sichtbar bleibt.
 *
 * **Und die schwerste Schranke**: Die Stimmkraft darf sich durch Archivieren
 * nicht ändern. `stimmkraftAnsicht` baut die Momentaufnahme einer Versammlung;
 * eine archivierte Partei, die dort wegfiele, verlöre ihre Stimme — lautlos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft, listeGemeinschaften } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu, stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { erstelleVersammlung, holeAlleVersammlungen } from '$lib/server/versammlungen';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import { holeUebersicht } from '$lib/server/uebersicht';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function wer() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

let wegId: string;
let bleibtId: string;
let wegVersammlung: string;
let bleibtVersammlung: string;
let parteiOhneEinheit: string;
let parteiMitEinheit: string;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Archiv');
	benutzer = await pruefbenutzer(betreiber, 'archiv');

	for (const name of ['Archivhaus weg', 'Archivhaus bleibt']) {
		const g = await erstelleGemeinschaft(wer(), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(wer(), {
			stwegId: g.id,
			datum: '2026-05-20',
			uhrzeit: '19:00',
			ort: `Saal ${name}`,
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		if (name === 'Archivhaus weg') {
			wegId = g.id;
			wegVersammlung = v.id;
		} else {
			bleibtId = g.id;
			bleibtVersammlung = v.id;
		}
	}

	// Zwei Eigentümerzeilen im bleibenden Haus: eine mit Einheit, eine ohne.
	const e = await erstelleEinheit(wer(), {
		stwegId: bleibtId,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const mit = await erstelleEigentuemer(wer(), {
		stwegId: bleibtId,
		kind: 'natural',
		displayName: 'Hält noch',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(wer(), e.id, mit.id, '2020-01-01');
	parteiMitEinheit = mit.id;

	const ohne = await erstelleEigentuemer(wer(), {
		stwegId: bleibtId,
		kind: 'natural',
		displayName: 'Hat verkauft',
		isCommunity: false,
		representativeName: null
	});
	parteiOhneEinheit = ohne.id;
});

afterAll(verbindungenSchliessen);

describe('Eine archivierte Gemeinschaft', () => {
	it('fällt aus Auswahl und Suche, bleibt aber beim Nachschlagen', async () => {
		await archiviere(wer(), 'gemeinschaft', wegId, 'Mandat beendet');

		const auswahl = await listeGemeinschaften(betreiber, 'aktiv');
		expect(auswahl.map((g) => g.id)).not.toContain(wegId);
		// **Beide Enden**: «ist weg» allein bewiese auch eine Abfrage, die nichts
		// mehr liefert.
		expect(auswahl.map((g) => g.id)).toContain(bleibtId);

		const alle = await listeGemeinschaften(betreiber, 'alle');
		expect(alle.map((g) => g.id)).toContain(wegId);
		const archiviert = alle.find((g) => g.id === wegId);
		expect(archiviert?.archiviertAm).toBeTruthy();
		expect(archiviert?.archivnotiz).toBe('Mandat beendet');
	});

	it('nimmt ihre Versammlungen mit — ohne dass jemand sie einzeln wegräumt', async () => {
		const liste = await holeAlleVersammlungen(betreiber, 'aktiv');
		expect(liste.map((v) => v.id)).not.toContain(wegVersammlung);
		expect(liste.map((v) => v.id)).toContain(bleibtVersammlung);

		const alle = await holeAlleVersammlungen(betreiber, 'alle');
		expect(alle.map((v) => v.id)).toContain(wegVersammlung);
	});

	it('steht nicht mehr auf der Startseite', async () => {
		const u = await holeUebersicht(betreiber, '2026-05-19');
		const ids = [...u.laufend, ...u.anstehend, ...u.ueberfaellig, ...u.abgeschlossen].map(
			(z) => z.id
		);
		expect(ids).not.toContain(wegVersammlung);
		expect(ids).toContain(bleibtVersammlung);
	});

	it('lässt sich wieder hervorholen', async () => {
		await holeAusArchiv(wer(), 'gemeinschaft', wegId);
		const auswahl = await listeGemeinschaften(betreiber, 'aktiv');
		expect(auswahl.map((g) => g.id)).toContain(wegId);
		// Die Notiz galt fürs Archiv und fällt mit ihm weg.
		expect(auswahl.find((g) => g.id === wegId)?.archivnotiz).toBeNull();
	});

	it('lässt sich nicht zweimal archivieren', async () => {
		await archiviere(wer(), 'gemeinschaft', wegId);
		await expect(archiviere(wer(), 'gemeinschaft', wegId)).rejects.toThrow(FachlicherFehler);
		await holeAusArchiv(wer(), 'gemeinschaft', wegId);
	});
});

describe('Eine archivierte Eigentümerzeile', () => {
	it('ändert die Stimmkraft NICHT', async () => {
		/*
		 * Der Fall, der alles entscheidet. Die Momentaufnahme entsteht aus
		 * `stimmkraftAnsicht`; fiele Archiviertes dort weg, verlöre die Partei
		 * ihre Stimme, und sichtbar würde es erst am Ergebnis.
		 */
		const vorher = await stimmkraftAnsicht(betreiber, bleibtId, '2026-05-20');
		await archiviere(wer(), 'eigentuemer', parteiOhneEinheit);
		const nachher = await stimmkraftAnsicht(betreiber, bleibtId, '2026-05-20');

		expect(nachher.zeilen.length).toBe(vorher.zeilen.length);
		expect(nachher.zeilen.map((z) => z.partyId)).toContain(parteiOhneEinheit);
		expect(nachher.summeKopfstimmen).toBe(vorher.summeKopfstimmen);
		expect(nachher.summeWertquote).toBe(vorher.summeWertquote);
	});

	it('fällt aus der Eigentümerliste, bleibt in der vollen Sicht', async () => {
		const { holeEigentuemer } = await import('$lib/server/eigentuemer');
		const aktiv = await holeEigentuemer(betreiber, bleibtId, 'aktiv');
		expect(aktiv.map((e) => e.id)).not.toContain(parteiOhneEinheit);
		expect(aktiv.map((e) => e.id)).toContain(parteiMitEinheit);

		const alle = await holeEigentuemer(betreiber, bleibtId, 'alle');
		expect(alle.map((e) => e.id)).toContain(parteiOhneEinheit);
	});
});

describe('Eine archivierte Versammlung', () => {
	/*
	 * **Archiviert wird, was versiegelt ist** (Auftraggeber, 25.08.2026). Der Zustand
	 * wird hier direkt gesetzt statt über den ganzen Weg Freigabe → Eröffnen →
	 * Schliessen → Siegel: Geprüft wird das Archiv, nicht der Sitzungsablauf,
	 * und der steht in `tests/db/siegel.test.ts`.
	 */
	/*
	 * Die Zeitstempel gehören zum Zustand — `meeting_zeitstempel` hält beides
	 * zusammen. Ein Zustand allein gesetzt verletzt die Schranke; deshalb reisen
	 * sie hier mit. Abgelesen mit `pg_get_constraintdef`, nicht nachgebaut.
	 */
	const zustandSetzen = (zustand: string) =>
		imKontext(betreiber, (tx) =>
			tx`
				UPDATE meeting SET
					state = ${zustand},
					released_at = ${zustand === 'entwurf' ? null : new Date()},
					opened_at = ${zustand === 'entwurf' || zustand === 'freigegeben' ? null : new Date()},
					closed_at = ${
						zustand === 'geschlossen' || zustand === 'versiegelt' ? new Date() : null
					}
				WHERE id = ${bleibtVersammlung}
			`
		);

	it('lässt sich vor dem Versiegeln nicht archivieren', async () => {
		for (const zustand of ['entwurf', 'freigegeben', 'laufend', 'geschlossen']) {
			await zustandSetzen(zustand);
			await expect(archiviere(wer(), 'versammlung', bleibtVersammlung)).rejects.toThrow(
				FachlicherFehler
			);
		}
	});

	it('bleibt an ihrem Abend und in ihrer eigenen Sicht sichtbar', async () => {
		await zustandSetzen('versiegelt');
		await archiviere(wer(), 'versammlung', bleibtVersammlung, 'Nicht mehr gebraucht');
		const liste = await holeAlleVersammlungen(betreiber, 'aktiv');
		expect(liste.map((v) => v.id)).not.toContain(bleibtVersammlung);

		// Die Zeile selbst ist unverändert da — nachgeschlagen wird sie über ihre
		// Kennung, und dort filtert nichts.
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ archived_at: Date | null; archived_note: string | null }[]>`
				SELECT archived_at, archived_note FROM meeting WHERE id = ${bleibtVersammlung}
			`
		);
		expect(z.archived_at).toBeTruthy();
		expect(z.archived_note).toBe('Nicht mehr gebraucht');
	});
});

/*
 * **Die Schranken am Schreibweg** (25.08.2026, aus beiden Reviews). Sie standen
 * vorher in einer Route hinter einem `if (zeile)` beziehungsweise gar nicht.
 * Geprüft wird hier der Baustein selbst — eine Prüfung in der Route bewiese nur,
 * dass diese eine Route sie hat.
 */
describe('Wer noch mitzählt', () => {
	it('lässt sich als Eigentümerzeile nicht archivieren', async () => {
		await expect(archiviere(wer(), 'eigentuemer', parteiMitEinheit)).rejects.toThrow(
			FachlicherFehler
		);
		await expect(archiviere(wer(), 'eigentuemer', parteiMitEinheit)).rejects.toThrow(/Whg 1/);

		// Und die Zeile ist wirklich nicht archiviert — «wirft» allein bewiese
		// auch eine Schranke, die nach dem Schreiben zuschlägt.
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ archived_at: Date | null }[]>`
				SELECT archived_at FROM party WHERE id = ${parteiMitEinheit}
			`
		);
		expect(z.archived_at).toBeNull();
	});

	it('lässt sich auch als Person nicht archivieren', async () => {
		// Die Person hinter der Zeile, die noch eine Einheit hält.
		const personId = await imKontext(betreiber, async (tx) => {
			const [p] = await tx<{ id: string }[]>`
				INSERT INTO person (operator_id, display_name)
				VALUES (${betreiber}, 'Hält noch, als Person')
				RETURNING id
			`;
			await tx`UPDATE party SET person_id = ${p.id} WHERE id = ${parteiMitEinheit}`;
			return p.id;
		});

		await expect(archiviere(wer(), 'person', personId)).rejects.toThrow(/Whg 1/);

		await imKontext(betreiber, (tx) => tx`UPDATE party SET person_id = NULL WHERE id = ${parteiMitEinheit}`);
	});
});

describe('Eine archivierte Eigentümerzeile', () => {
	it('nimmt keine Einheit mehr an', async () => {
		const e = await erstelleEinheit(wer(), {
			stwegId: bleibtId,
			kind: 'unit',
			label: 'Whg 9',
			quotas: { stamm: 0 },
			countsAsHead: true
		});
		await expect(ordneEigentumZu(wer(), e.id, parteiOhneEinheit, '2026-01-01')).rejects.toThrow(
			/Archiv/
		);
	});
});

/*
 * **Die Gruppe ist eine Einheit** (Auftraggeber, 25.08.2026: «Gruppen müssen als gesamte
 * Gruppe archiviert und wiederhergestellt werden, weil diese zusammenhängen»).
 *
 * Geprüft werden beide Richtungen und die Ausnahme: Was mitgeht, kommt mit
 * zurück — und was **vorher schon** einzeln im Archiv lag, bleibt dort. Ohne
 * diesen letzten Fall holte das Hervorholen der Klammer ein Haus mit hervor,
 * das niemand hervorholen wollte.
 */
describe('Eine Gruppe von Gemeinschaften', () => {
	let klammerId: string;
	let hausId: string;
	let hausVersammlung: string;
	let einzelnId: string;

	beforeAll(async () => {
		const klammer = await erstelleGemeinschaft(wer(), {
			name: 'Gruppenklammer',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		klammerId = klammer.id;

		for (const name of ['Gruppenhaus A', 'Gruppenhaus einzeln']) {
			const h = await erstelleGemeinschaft(wer(), {
				name,
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: klammer.id
			});
			if (name === 'Gruppenhaus A') {
				hausId = h.id;
				const v = await erstelleVersammlung(wer(), {
					stwegId: h.id,
					datum: '2026-06-10',
					uhrzeit: '19:00',
					ort: 'Saal Gruppenhaus A',
					art: 'ordentlich',
					stufe: 'erste',
					betriebsart: 'gefuehrt'
				});
				hausVersammlung = v.id;
			} else {
				einzelnId = h.id;
			}
		}
	});

	it('nimmt Häuser und deren Versammlungen mit — und bringt sie zurück', async () => {
		// Das eine Haus liegt schon vorher einzeln im Archiv.
		await archiviere(wer(), 'gemeinschaft', einzelnId, 'Vorher einzeln');

		const vorher = await listeGemeinschaften(betreiber, 'aktiv');
		expect(vorher.map((g) => g.id)).toContain(klammerId);
		expect(vorher.map((g) => g.id)).toContain(hausId);

		await archiviere(wer(), 'gemeinschaft', klammerId, 'Mandat beendet');

		// **Weg ist die ganze Gruppe** — nicht nur die Klammer.
		const nachher = await listeGemeinschaften(betreiber, 'aktiv');
		expect(nachher.map((g) => g.id)).not.toContain(klammerId);
		expect(nachher.map((g) => g.id)).not.toContain(hausId);

		// Und die Versammlung des Hauses ebenso — die alte Fassung sah nur eine
		// Ebene weit (`s.archived_at`) und liess sie stehen.
		const liste = await holeAlleVersammlungen(betreiber, 'aktiv');
		expect(liste.map((v) => v.id)).not.toContain(hausVersammlung);

		// Die vollständige Sicht sagt, **weswegen** das Haus im Archiv liegt.
		const alle = await listeGemeinschaften(betreiber, 'alle');
		const haus = alle.find((g) => g.id === hausId)!;
		expect(haus.archiviertAm).toBeNull();
		expect(haus.imArchivWegen?.id).toBe(klammerId);
		expect(haus.imArchivSeit).toBeTruthy();

		// **Zurück kommt die Gruppe gemeinsam** — bis auf das, was vorher schon
		// einzeln im Archiv lag.
		await holeAusArchiv(wer(), 'gemeinschaft', klammerId);
		const zurueck = await listeGemeinschaften(betreiber, 'aktiv');
		expect(zurueck.map((g) => g.id)).toContain(klammerId);
		expect(zurueck.map((g) => g.id)).toContain(hausId);
		expect(zurueck.map((g) => g.id)).not.toContain(einzelnId);
		expect((await holeAlleVersammlungen(betreiber, 'aktiv')).map((v) => v.id)).toContain(
			hausVersammlung
		);
	});

	it('lässt kein Haus einzeln aus der Gruppe heraus', async () => {
		await archiviere(wer(), 'gemeinschaft', klammerId, 'Noch einmal');

		// Ein Haus, das schon über die Klammer im Archiv liegt, ein zweites Mal
		// zu archivieren setzte ein eigenes Datum — beim Hervorholen der Klammer
		// bliebe genau dieses Haus zurück.
		await expect(archiviere(wer(), 'gemeinschaft', hausId)).rejects.toThrow(/Gruppenklammer/);
		// Und einzeln hervorholen ginge ins Leere: Das Haus trägt gar kein Datum.
		await expect(holeAusArchiv(wer(), 'gemeinschaft', hausId)).rejects.toThrow(/Gruppenklammer/);

		await holeAusArchiv(wer(), 'gemeinschaft', klammerId);
	});
});
