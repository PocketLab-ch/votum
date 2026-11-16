/**
 * Story 3.1 — Schranken der Versammlung in der Datenbank.
 *
 * Die fachlichen Prüfungen stehen im Kern. Hier geht es um das, was der Kern
 * nicht garantieren kann: den Zeilenschutz je Betreiber, die Widerspruchsfreiheit
 * zwischen Zustand und Zeitstempeln, und dass eine Versammlung nicht gelöscht
 * werden kann.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	bearbeiteVersammlung,
	erstelleVersammlung,
	holeAlleVersammlungen,
	holeMoeglicheVorgaengerinnen,
	holeVersammlung,
	holeVersammlungen,
	setzeBetriebsart,
	setzeVersammlungsleitung
} from '$lib/server/versammlungen';
import { holeLaufendeVersammlung } from '$lib/server/versammlungen';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { VersammlungEingabe } from '$lib/domain/versammlung';
import { Schreibkonflikt } from '$lib/domain/schreibstand';

let betreiberA: string;
let betreiberB: string;
let stwegA: string;
let stwegB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

function eingabe(stwegId: string, aenderung: Partial<VersammlungEingabe> = {}): VersammlungEingabe {
	return {
		stwegId,
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach',
		...aenderung
	};
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Versammlung A');
	betreiberB = await pruefbetreiber('Versammlung B');
	const a = await erstelleGemeinschaft(handelnder(betreiberA), {
		name: 'Versammlungsweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const b = await erstelleGemeinschaft(handelnder(betreiberB), {
		name: 'Fremdweg 9',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegA = a.id;
	stwegB = b.id;
});

afterAll(verbindungenSchliessen);

describe('Anlegen und Lesen', () => {
	it('legt eine Versammlung im Entwurf an', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		expect(v.zustand).toBe('entwurf');

		const gelesen = await holeVersammlung(betreiberA, v.id);
		expect(gelesen?.datum).toBe('2026-09-15');
		expect(gelesen?.uhrzeit).toBe('19:00');
		expect(gelesen?.ort).toBe('Restaurant Bären');
	});

	it('gibt den Kalendertag unverdreht zurück', async () => {
		// Ein `date` hat keine Zeitzone. Wer es über `toISOString()` zurückgibt,
		// verschiebt in der Schweizer Sommerzeit den 1. Januar auf den 31. Dezember.
		const v = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-01-01', uhrzeit: '00:30' })
		);
		expect((await holeVersammlung(betreiberA, v.id))?.datum).toBe('2027-01-01');
	});

	it('schreibt einen Verlaufseintrag', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		const zeilen = await imKontext(betreiberA, (tx) => tx<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry WHERE subject_id = ${v.id}
		`);
		expect(zeilen.map((z) => z.event_type)).toContain('meeting.created');
	});

	it('listet nur die Versammlungen der eigenen Gemeinschaft', async () => {
		await erstelleVersammlung(handelnder(betreiberB), eingabe(stwegB));
		const liste = await holeVersammlungen(betreiberA, stwegA, 'aktiv');
		expect(liste.every((v) => v.stwegId === stwegA)).toBe(true);
	});
});

describe('Zeilenschutz', () => {
	it('zeigt einem Betreiber keine fremde Versammlung', async () => {
		const fremd = await erstelleVersammlung(handelnder(betreiberB), eingabe(stwegB));
		expect(await holeVersammlung(betreiberA, fremd.id)).toBeNull();
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		// Die Gegenprobe unter der Anwendungsrolle: Ohne gesetzten Betreiber
		// scheitert die Abfrage nicht, sie liefert leer. Genau deshalb muss der
		// Kontext in derselben Transaktion gesetzt sein.
		const zeilen = await ohneKontext((tx) => tx`SELECT id FROM meeting`);
		expect(zeilen).toHaveLength(0);
	});

	it('führt in der Gesamtliste nur eigene Versammlungen', async () => {
		const alle = await holeAlleVersammlungen(betreiberB, 'aktiv');
		const eigene = await holeVersammlungen(betreiberB, stwegB, 'aktiv');
		expect(alle.length).toBe(eigene.length);
	});
});

describe('Vorsitz und Protokollführung', () => {
	/*
	 * **Warum gegen die Datenbank und nicht nur im Kern** (26.08.2026, aus dem
	 * Code-Review): Die Prüfung im Schreibweg und die CHECK-Schranke der
	 * Migration 091 zählen verschieden. `'😀'.length` ist in JavaScript 2, in
	 * Postgres ist `length(btrim('😀'))` 1 — beides nachgemessen. Ein einzelnes
	 * solches Zeichen kam durch den Wächter und schlug als `check_violation`
	 * durch: eine rohe 500 statt einer Meldung. Nur ein Test mit echter Datenbank
	 * sieht diese Klasse.
	 */
	it('hält beide Namen fest und macht leeren Text zu «nicht angegeben»', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));

		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Rita Berger',
			protokollfuehrung: '  Notariat Muster  '
		});
		const nachher = await holeVersammlung(betreiberA, v.id);
		expect(nachher?.sitzungsleitung).toBe('Rita Berger');
		expect(nachher?.protokollfuehrung).toBe('Notariat Muster');

		// Leeren heisst leeren — nicht «eingetragen, aber leer».
		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: '   ',
			protokollfuehrung: ''
		});
		const geleert = await holeVersammlung(betreiberA, v.id);
		expect(geleert?.sitzungsleitung).toBeNull();
		expect(geleert?.protokollfuehrung).toBeNull();
	});

	it('weist einen zu kurzen Namen mit einem Satz ab, nicht mit einer Schrankenmeldung', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));

		// Ein Zeichen — der offensichtliche Fall.
		await expect(
			setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
				sitzungsleitung: 'R',
				protokollfuehrung: null
			})
		).rejects.toThrow(/mindestens zwei Zeichen/);

		// **Und ein Zeichen ausserhalb der Grundebene.** Genau hier zählten die
		// beiden Seiten verschieden; ohne diesen Fall bliebe der Test grün und die
		// Anwendung antwortete mit 500.
		await expect(
			setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
				sitzungsleitung: '😀',
				protokollfuehrung: null
			})
		).rejects.toThrow(/mindestens zwei Zeichen/);

		await expect(
			setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
				sitzungsleitung: 'R'.repeat(121),
				protokollfuehrung: null
			})
		).rejects.toThrow(/länger als 120 Zeichen/);

		// Nichts davon ist angekommen.
		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBeNull();
	});

	it('überschreibt nicht, was inzwischen ein anderes Fenster eingetragen hat', async () => {
		/*
		 * Der Vorsitz wird **nach** der Sitzung eingetragen, oft von zwei Personen:
		 * der, die geleitet hat, und der, die schreibt. Beide haben dieselbe
		 * Versammlung offen. Ohne diese Prüfung setzte das später abgeschickte
		 * Formular den fremden Eintrag still zurück — und beide hielten ihren für
		 * gespeichert.
		 */
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));

		// Beide Fenster sehen: nichts eingetragen.
		const standBeimOeffnen = { sitzungsleitung: '', protokollfuehrung: '' };

		// Fenster 1 speichert.
		await setzeVersammlungsleitung(
			handelnder(betreiberA),
			v.id,
			{ sitzungsleitung: 'Rita Berger', protokollfuehrung: null },
			standBeimOeffnen
		);

		// Fenster 2 speichert mit demselben — inzwischen überholten — Stand.
		await expect(
			setzeVersammlungsleitung(
				handelnder(betreiberA),
				v.id,
				{ sitzungsleitung: 'Peter Muster', protokollfuehrung: null },
				standBeimOeffnen
			)
		).rejects.toThrow(Schreibkonflikt);

		// Der fremde Eintrag steht unverändert da.
		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBe('Rita Berger');

		// Mit dem geltenden Stand geht es durch — die Absage ist eine Rückfrage,
		// keine Sperre.
		await setzeVersammlungsleitung(
			handelnder(betreiberA),
			v.id,
			{ sitzungsleitung: 'Peter Muster', protokollfuehrung: null },
			{ sitzungsleitung: 'Rita Berger', protokollfuehrung: '' }
		);
		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBe('Peter Muster');
	});

	it('lässt ohne mitgeschickten Stand schreiben wie bisher', async () => {
		/*
		 * **Nicht der Weg ohne JavaScript** — der schickt seine versteckten Felder
		 * sehr wohl mit (26.08.2026 im Review richtiggestellt). Geprüft wird der
		 * Aufruf ohne Stand, den es weiterhin gibt: das Erzwingen von einem laufend
		 * sichernden Feld aus und jeder Aufruf aus einem Skript. Er darf nicht an
		 * einer Prüfung scheitern, die er nicht bedienen kann.
		 */
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Rita Berger',
			protokollfuehrung: null
		});
		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Peter Muster',
			protokollfuehrung: null
		});
		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBe('Peter Muster');
	});

	it('hält den Vorzustand im Verlauf fest — sonst wäre der frühere Name weg', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Rita Berger',
			protokollfuehrung: null
		});
		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Hans Muster',
			protokollfuehrung: null
		});

		const eintraege = await imKontext(
			betreiberA,
			(tx) => tx<{ detail: { felder?: Record<string, { vorher: string | null; nachher: string | null }> } }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_id = ${v.id} AND event_type = 'meeting.updated'
				 ORDER BY occurred_at
			`
		);
		const letzter = eintraege.at(-1);
		expect(letzter?.detail.felder?.sitzungsleitung).toEqual({
			vorher: 'Rita Berger',
			nachher: 'Hans Muster'
		});
	});

	/*
	 * **Auch nach dem Siegel — und das ist der Punkt** (26.08.2026, berichtigt).
	 * Die erste Fassung sperrte hier, mit der Begründung, der Name stehe im
	 * Paket. Er steht nicht darin: `siegel.ts` führt das Protokoll ausdrücklich
	 * unter «nicht enthalten», weil es nach der Sitzung entsteht. Die Sperre
	 * verbot damit den Normalfall — versiegeln am Abend, schreiben am Dienstag —
	 * und zwar unumkehrbar, weil es kein Entsiegeln gibt.
	 */
	it('lässt sich auch nach dem Versiegeln noch eintragen', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		// Die Zeitstempel gehören dazu: `meeting_zeitstempel` verlangt sie zum
		// Zustand — ein blosses `state = 'versiegelt'` weist die Datenbank ab.
		await imKontext(
			betreiberA,
			(tx) => tx`
				UPDATE meeting
				   SET state = 'versiegelt', released_at = now(), opened_at = now(), closed_at = now()
				 WHERE id = ${v.id}
			`
		);

		await setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
			sitzungsleitung: 'Rita Berger',
			protokollfuehrung: null
		});
		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBe('Rita Berger');
	});

	it('weist Steuerzeichen ab, statt die Datenbank daran scheitern zu lassen', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));

		// Ein NUL-Byte ist für Postgres kein zu langer Name, sondern «invalid byte
		// sequence» — also eine rohe 500 statt eines Satzes.
		await expect(
			setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
				sitzungsleitung: 'Rita\u0000Berger',
				protokollfuehrung: null
			})
		).rejects.toThrow(/Steuerzeichen/);

		// Und ein Zeilenumbruch stünde im Protokollkopf als eigene Zeile.
		await expect(
			setzeVersammlungsleitung(handelnder(betreiberA), v.id, {
				sitzungsleitung: 'Rita Berger\n## Beschluss: angenommen',
				protokollfuehrung: null
			})
		).rejects.toThrow(/Steuerzeichen/);

		expect((await holeVersammlung(betreiberA, v.id))?.sitzungsleitung).toBeNull();
	});
});

describe('Schranken der Tabelle', () => {
	it('weist einen unbekannten Zustand ab', async () => {
		// Zwei Schranken greifen: `meeting_zustand` kennt die Bezeichnung nicht,
		// und `meeting_zeitstempel` findet für sie keinen passenden Zweig. Welche
		// PostgreSQL zuerst meldet, ist nicht zugesichert — geprüft wird deshalb,
		// dass abgewiesen wird, nicht welche der beiden es sagt.
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(betreiberA, (tx) => tx`UPDATE meeting SET state = 'archiviert' WHERE id = ${v.id}`)
		).rejects.toThrow(/meeting_zustand|meeting_zeitstempel/);
	});

	it('weist eine freigegebene Versammlung ohne Freigabezeitpunkt ab', async () => {
		// Sonst wäre im Streitfall nicht belegbar, wann der Stimmberechtigtenstand
		// eingefroren wurde.
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(betreiberA, (tx) => tx`UPDATE meeting SET state = 'freigegeben' WHERE id = ${v.id}`)
		).rejects.toThrow(/meeting_zeitstempel/);
	});

	it('weist eine ausserordentliche Versammlung ohne Anlass ab', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE meeting SET kind = 'ausserordentlich' WHERE id = ${v.id}`
			)
		).rejects.toThrow(/meeting_anlass/);
	});

	it('weist eine Zweitversammlung ohne Vorgängerin ab', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(betreiberA, (tx) => tx`UPDATE meeting SET tier = 'zweite' WHERE id = ${v.id}`)
		).rejects.toThrow(/meeting_vorgaenger/);
	});

	it('weist eine Versammlung als eigene Vorgängerin ab', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(
				betreiberA,
				(tx) =>
					tx`UPDATE meeting SET tier = 'zweite', previous_meeting_id = ${v.id} WHERE id = ${v.id}`
			)
		).rejects.toThrow(/meeting_nicht_selbst/);
	});

	it('lässt die Versammlung nicht löschen', async () => {
		// Eine Versammlung, die stattgefunden hat, verschwindet nicht. Wäre sie
		// löschbar, hinge die Grenze zwischen «nie stattgefunden» und «weggeräumt»
		// am Zeitpunkt der Betrachtung.
		//
		// Dieser Test hat die Schranke erst hergestellt: Migration 002 vergibt das
		// Löschrecht über `ALTER DEFAULT PRIVILEGES` an jede künftige Tabelle. Ein
		// GRANT ohne DELETE nimmt es nicht weg — nötig ist ein REVOKE.
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await expect(
			imKontext(betreiberA, (tx) => tx`DELETE FROM meeting WHERE id = ${v.id}`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Zweitversammlung', () => {
	it('nimmt eine Zweitversammlung mit gewahrter Frist an', async () => {
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2026-11-02' })
		);
		const zweite = await erstelleVersammlung(
			handelnder(betreiberA),
			// Der 12. wäre der zehnte Tag und damit zu früh (Befund R-1).
			eingabe(stwegA, { datum: '2026-11-13', stufe: 'zweite', vorgaengerId: erste.id })
		);
		expect(zweite.vorgaengerId).toBe(erste.id);
	});

	it('rechnet die Frist auf dem Datum aus der Datenbank, nicht auf dem mitgeschickten', async () => {
		/*
		 * Sonst liesse sich die Zehntagesfrist umgehen, indem man im Formular ein
		 * falsches Datum der ersten Versammlung mitschickt.
		 *
		 * **Gemessen wird seit dem 24.09.2026 der Vermerk, nicht mehr eine
		 * Absage** (Befund R-2b). Die Frist hält niemanden mehr auf; was sie
		 * bewirkt, ist der Satz in Einladung und Protokoll. Das misst dieselbe
		 * Unterschiebung sogar schärfer als vorher: Zählte das mitgeschickte
		 * Datum, läge der Abstand bei über elf Monaten und der Vermerk wäre
		 * `null`. Dass er dasteht und «4 Tage» sagt, kann nur vom Datum aus der
		 * Datenbank kommen.
		 */
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2026-12-01' })
		);
		const zweite = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, {
				datum: '2026-12-05',
				stufe: 'zweite',
				vorgaengerId: erste.id,
				vorgaengerDatum: '2026-01-01'
			})
		);
		expect(zweite.fristvermerk).toMatch(/nur 4 Tage nach der ersten/);

		// Und er überlebt den Weg durch die Datenbank: Einladung und Protokoll
		// lesen die Versammlung zurück, sie halten nicht das Ergebnis des
		// Schreibwegs in der Hand.
		const gelesen = await holeVersammlung(betreiberA, zweite.id);
		expect(gelesen?.fristvermerk).toBe(zweite.fristvermerk);
	});

	/*
	 * **Der Vermerk wandert mit** (Code-Review vom 24.09.2026, Befund 1).
	 *
	 * `fristvermerk` wird beim Speichern der **zweiten** Versammlung gerechnet.
	 * Wer danach das Datum der **ersten** verschiebt, ändert den Abstand, ohne
	 * die zweite anzufassen — und bis zur Nachrechnung blieb ihr Vermerk stehen,
	 * wie er war. Beide Richtungen werden hier gemessen, weil beide schaden und
	 * die zweite mehr: ein fehlender Vermerk ist eine Lücke, ein falscher ist
	 * eine unrichtige Rechtsaussage in der Einladung.
	 */
	it('rechnet den Vermerk der Zweitversammlung nach, wenn die erste verschoben wird', async () => {
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-03-01' })
		);
		const zweite = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-03-20', stufe: 'zweite', vorgaengerId: erste.id })
		);
		// Ausgangslage: neunzehn Tage Abstand, die Frist ist eingehalten.
		expect(zweite.fristvermerk ?? null).toBeNull();

		// Die erste rückt nach hinten, der Abstand schrumpft auf vier Tage.
		await bearbeiteVersammlung(handelnder(betreiberA), erste.id, {
			...eingabe(stwegA, { datum: '2027-03-16' }),
			stwegId: erste.stwegId
		});
		expect((await holeVersammlung(betreiberA, zweite.id))?.fristvermerk).toMatch(
			/nur 4 Tage nach der ersten/
		);

		// Und zurück: Die Frist ist wieder eingehalten, der Vermerk muss weg.
		// Bliebe er stehen, druckte die Einladung eine Anfechtbarkeit, die es
		// nicht gibt.
		await bearbeiteVersammlung(handelnder(betreiberA), erste.id, {
			...eingabe(stwegA, { datum: '2027-03-01' }),
			stwegId: erste.stwegId
		});
		expect((await holeVersammlung(betreiberA, zweite.id))?.fristvermerk ?? null).toBeNull();
	});

	/*
	 * **Die zwei Schranken der Nachrechnung** (zweiter Code-Review vom
	 * 24.09.2026, Befunde 1 und 2). Beide Lagen hat erst die Nachrechnung
	 * erreichbar gemacht; ohne sie gab es an der abhängigen Zeile nichts
	 * anzufassen.
	 */
	it('weist ab, statt die Vorgängerin hinter ihre Nachfolgerin zu schieben', async () => {
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-06-01' })
		);
		await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-06-05', stufe: 'zweite', vorgaengerId: erste.id })
		);
		// Ohne die Schranke ginge das durch, und `fristvermerk` löschte für den
		// negativen Abstand den Vermerk — ein Datensatz in genau der Lage, die
		// der Kern als Datenfehler ausschliesst, nur ohne Absage und ohne Spur.
		await expect(
			bearbeiteVersammlung(handelnder(betreiberA), erste.id, {
				...eingabe(stwegA, { datum: '2027-07-20' }),
				stwegId: erste.stwegId
			})
		).rejects.toThrow(/läge dann vor der ersten/);
	});

	it('weist ab, wenn die abhängige Zweitversammlung nicht mehr im Entwurf steht', async () => {
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-08-01' })
		);
		const zweite = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-08-20', stufe: 'zweite', vorgaengerId: erste.id })
		);
		// Die Datenbank sperrt nach dem Siegel `agenda_item`, `vote` und
		// `minutes`, aber nicht `meeting` — die Schranke muss also hier sitzen.
		// Freigegeben genügt als Nachweis und ist die frühere Stufe: Ab da ist die
		// Einladung draussen, und in ihr steht der Vermerk. `meeting_zeitstempel`
		// verlangt dafür den Freigabezeitpunkt mit.
		// **`imKontext`, nicht `ohneKontext`.** Ohne gesetzten Mandanten trifft das
		// UPDATE unter RLS keine Zeile und meldet trotzdem Erfolg — die Probe wäre
		// grün geblieben, weil der Zustand nie gesetzt wurde.
		const gesetzt = await imKontext(
			betreiberA,
			async (tx) =>
				(
					await tx`
						UPDATE meeting SET state = 'freigegeben', released_at = now()
						WHERE id = ${zweite.id}
					`
				).count
		);
		expect(gesetzt, 'der Zustand liess sich nicht setzen').toBe(1);
		await expect(
			bearbeiteVersammlung(handelnder(betreiberA), erste.id, {
				...eingabe(stwegA, { datum: '2027-08-14' }),
				stwegId: erste.stwegId
			})
		).rejects.toThrow(/nicht mehr im Entwurf/);
	});

	it('schreibt keinen Verlaufseintrag, wenn sich nichts geändert hat', async () => {
		// Befund 2 desselben Reviews: `vorgaengerDatum` stand in der Feldliste des
		// Vergleichs, wird aus der Datenbank aber nie zurückgelesen. `undefined`
		// gegen `null` schlug damit bei **jeder** Speicherung an, und der Verlauf
		// füllte sich mit Einträgen, hinter denen keine Änderung stand.
		const v = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-05-04' })
		);
		const zaehle = () =>
			ohneKontext(
				async (tx) =>
					(
						await tx<{ n: number }[]>`
							SELECT count(*)::int AS n FROM audit_entry WHERE subject_id = ${v.id}
						`
					)[0].n
			);
		const vorher = await zaehle();
		await bearbeiteVersammlung(handelnder(betreiberA), v.id, {
			...eingabe(stwegA, { datum: '2027-05-04' }),
			stwegId: v.stwegId
		});
		expect(await zaehle()).toBe(vorher);
	});

	it('bietet keine fremde Versammlung als Vorgängerin an', async () => {
		const moeglich = await holeMoeglicheVorgaengerinnen(betreiberA, stwegA);
		const fremde = await holeVersammlungen(betreiberB, stwegB, 'aktiv');
		for (const f of fremde) {
			expect(moeglich.map((m) => m.id)).not.toContain(f.id);
		}
	});

	it('führt Zweitversammlungen nicht als mögliche Vorgängerinnen', async () => {
		// Art. 712p kennt die Erleichterung einmal, nicht kaskadierend.
		const erste = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-03-01' })
		);
		const zweite = await erstelleVersammlung(
			handelnder(betreiberA),
			eingabe(stwegA, { datum: '2027-03-15', stufe: 'zweite', vorgaengerId: erste.id })
		);
		const moeglich = await holeMoeglicheVorgaengerinnen(betreiberA, stwegA);
		expect(moeglich.map((m) => m.id)).toContain(erste.id);
		expect(moeglich.map((m) => m.id)).not.toContain(zweite.id);
	});
});

describe('Ändern', () => {
	it('speichert geänderte Angaben', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await bearbeiteVersammlung(
			handelnder(betreiberA),
			v.id,
			eingabe(stwegA, { ort: 'Gemeindesaal', uhrzeit: '18:30' })
		);
		const neu = await holeVersammlung(betreiberA, v.id);
		expect(neu?.ort).toBe('Gemeindesaal');
		expect(neu?.uhrzeit).toBe('18:30');
	});

	it('wechselt die Betriebsart und hält den Grund fest', async () => {
		const v = await erstelleVersammlung(handelnder(betreiberA), eingabe(stwegA));
		await setzeBetriebsart(handelnder(betreiberA), v.id, 'gefuehrt', 'Beamer vorhanden');
		expect((await holeVersammlung(betreiberA, v.id))?.betriebsart).toBe('gefuehrt');

		const zeilen = await imKontext(betreiberA, (tx) => tx<{ detail: { grund: string } }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${v.id} AND event_type = 'meeting.mode.changed'
		`);
		expect(zeilen[0].detail.grund).toBe('Beamer vorhanden');
	});
});

/**
 * Welche Sitzung der Knopf «Zur Sitzungsleitung» anbietet.
 *
 * **Der Anlass** (Auftraggeber, 21.08.2026): «Bei dem Zurück zur Laufenden Sitzung
 * Button — der Button muss sich merken, welche die letzte Sitzung war.»
 *
 * Vorher fragte der Knopf allein den Verlauf: die laufende Versammlung, in der
 * dieser Benutzer zuletzt **gehandelt** hat. Wer in eine zweite Sitzung
 * hineinschaut, ohne dort etwas zu tun, wurde weiterhin in die erste geschickt —
 * bei zwei Häusern am selben Abend der Regelfall.
 *
 * (Davor war es noch gröber: `ORDER BY opened_at DESC LIMIT 1` über den ganzen
 * Betreiber. «es zeigt eine andere Sitzung an, als ich drin bin.»)
 */
describe('Die laufende Sitzung für das Gerüst', () => {
	async function zweiLaufende(name: string) {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const eine = await erstelleVersammlung(handelnder(betreiberA), eingabe(g.id, { datum: '2027-03-01' }));
		const andere = await erstelleVersammlung(handelnder(betreiberA), eingabe(g.id, { datum: '2027-03-02' }));
		/*
		 * Der Zustand wird gesetzt statt erhoben: Zwei Versammlungen freizugeben
		 * und zu eröffnen verlangt Einheiten, Eigentümer und einen vollständigen
		 * Stimmberechtigtenstand — nichts davon gehört zu dem, was hier geprüft
		 * wird.
		 */
		await imKontext(betreiberA, (tx) => tx`
			UPDATE meeting SET state = 'laufend', released_at = now(), opened_at = now()
			 WHERE id IN (${eine.id}, ${andere.id})
		`);
		return { eine: eine.id, andere: andere.id };
	}

	it('nimmt die gemerkte Sitzung, auch ohne Handlung darin', async () => {
		const { eine, andere } = await zweiLaufende('Knopfweg 1');
		expect((await holeLaufendeVersammlung(betreiberA, null as never, andere))?.id).toBe(andere);
		expect((await holeLaufendeVersammlung(betreiberA, null as never, eine))?.id).toBe(eine);
	});

	it('lässt eine gemerkte Sitzung fallen, die nicht mehr läuft', async () => {
		// Ein Cookie ist ein Wunsch, keine Erlaubnis: Was geschlossen ist, führt
		// nirgendwohin.
		const { eine } = await zweiLaufende('Knopfweg 2');
		await imKontext(betreiberA, (tx) => tx`
			UPDATE meeting SET state = 'geschlossen', closed_at = now() WHERE id = ${eine}
		`);
		expect(await holeLaufendeVersammlung(betreiberA, null as never, eine)).toBeNull();
	});

	it('nimmt keine fremde Sitzung, auch wenn sie gemerkt ist', async () => {
		const fremd = await erstelleVersammlung(handelnder(betreiberB), eingabe(stwegB, { datum: '2027-03-03' }));
		await imKontext(betreiberB, (tx) => tx`
			UPDATE meeting SET state = 'laufend', released_at = now(), opened_at = now()
			 WHERE id = ${fremd.id}
		`);
		expect(await holeLaufendeVersammlung(betreiberA, null as never, fremd.id)).toBeNull();
	});
});
