/**
 * Rügen lesen und schreiben (Ä-06, Migration 160).
 *
 * Die Regeln stehen im Kern (`$lib/domain/ruege`), das Modell und warum es
 * nichts sperrt in Migration 160. Jede Abfrage läuft in `alsBetreiber` und
 * damit unter der Mandantengrenze.
 *
 * **Anders als die Pendenz gehört die Rüge zum Siegel.** Nach dem Versiegeln
 * und während einer Abgabe weisen die Auslöser jede Änderung ab; die Prüfung
 * des Zustands hier steht davor, damit im Saal ein Satz erscheint statt einer
 * Datenbankmeldung. Sie ersetzt den Auslöser nicht, sie übersetzt ihn.
 *
 * **Der Verlauf hängt am Traktandum, nicht an der Rüge**, aus dem Grund, den
 * `pendenz.ts` nennt: Nach dem Entfernen ist die Zeile weg, und ein Eintrag mit
 * ihrer Kennung als Gegenstand fiele aus jedem gefilterten Verlauf heraus. Die
 * Kennung steht in den Angaben.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler, fremdesTraktandum } from '$lib/domain/fehler';
import { pruefeRuege, type Ruege, type Ruegeangabe, type Ruegeeingabe } from '$lib/domain/ruege';
import type { Id } from '$lib/domain/types';

interface Zeile {
	id: string;
	meeting_id: string;
	agenda_item_id: string;
	wording: string;
	raised_by: string;
	raised_time: string;
	ruling: string | null;
	created_at: Date;
	created_by_label: string | null;
}

function ausDb(z: Zeile): Ruege {
	return {
		id: z.id,
		versammlungId: z.meeting_id,
		traktandumId: z.agenda_item_id,
		wortlaut: z.wording,
		wer: z.raised_by,
		uhrzeit: z.raised_time,
		entscheid: z.ruling,
		erfasstAm: z.created_at.toISOString(),
		erfasstDurch: z.created_by_label
	};
}

/**
 * Wann sich eine Rüge festhalten oder entfernen lässt: solange die Versammlung
 * läuft.
 *
 * **Nicht mehr nach dem Schluss** (Codeprüfung H8, M1). Der erste Anlauf liess
 * es bis zum Siegel zu, aber die einzige Oberfläche, die Leitungsseite, zeigt
 * nach dem Schluss kein Traktandum mehr; das Versprechen «bis zum Siegel» liess
 * sich nicht einlösen. Was danach zu berichtigen ist, gehört ins Protokoll; der
 * Entwurf trägt die Rügen schon (`domain/protokoll.ts`). Vor der Eröffnung
 * gibt es keinen Saal, in dem gerügt würde.
 */
function zustandssperre(zustand: string, abgegeben: boolean): FachlicherFehler | null {
	if (abgegeben) {
		return new FachlicherFehler(
			'abgegeben',
			'Diese Versammlung ist an ein anderes Gerät abgegeben. Halten Sie die Rüge dort fest.',
			'zustand'
		);
	}
	if (zustand === 'versiegelt') {
		return new FachlicherFehler(
			'versiegelt',
			'Die Versammlung ist versiegelt. Eine Rüge lässt sich danach nicht mehr festhalten oder ' +
				'entfernen; halten Sie es im Protokoll fest.',
			'zustand'
		);
	}
	if (zustand === 'geschlossen') {
		return new FachlicherFehler(
			'geschlossen',
			'Die Versammlung ist geschlossen. Eine Rüge lässt sich nur festhalten oder entfernen, ' +
				'solange sie läuft; ergänzen oder berichtigen Sie das Protokoll.',
			'zustand'
		);
	}
	if (zustand !== 'laufend') {
		return new FachlicherFehler(
			'nicht_laufend',
			'Eine Rüge lässt sich festhalten, sobald die Versammlung eröffnet ist.',
			'zustand'
		);
	}
	return null;
}

/**
 * Hält eine Rüge zu einem Traktandum fest.
 *
 * **Die Bindung steht in der Abfrage** (`AND a.meeting_id = …`), wie bei der
 * Pendenz: Die Traktandumskennung kommt aus dem Formular. Gemessen wird sie in
 * `tests/db/ruege.test.ts`.
 */
export async function erfasseRuege(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	eingabe: Ruegeeingabe
): Promise<Ruege> {
	const geprueft = pruefeRuege(eingabe);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [t] = await tx<{ title: string; state: string; abgegeben: boolean }[]>`
			SELECT a.title, m.state, versammlung_abgegeben(m.id) AS abgegeben
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		if (!t) throw fremdesTraktandum('traktandum');
		const sperre = zustandssperre(t.state, t.abgegeben);
		if (sperre) throw sperre;

		const [neu] = await tx<Zeile[]>`
			INSERT INTO objection (operator_id, meeting_id, agenda_item_id, wording, raised_by,
			                       raised_time, ruling, created_by, created_by_label)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${traktandumId}, ${geprueft.wortlaut},
			        ${geprueft.wer}, ${geprueft.uhrzeit}, ${geprueft.entscheid},
			        ${handelnder.userId}, ${handelnder.label})
			RETURNING *
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.ruegeErfasst, { art: 'agenda_item', id: traktandumId }, {
				ruege: neu.id,
				traktandum: t.title,
				wortlaut: geprueft.wortlaut,
				ruegt: geprueft.wer,
				uhrzeit: geprueft.uhrzeit,
				// «Vorgehen», nicht «Entscheid» (Laien- und Fachprüfung H8, P1-a);
				// die Spalte heisst weiter `ruling`.
				vorgehen: geprueft.entscheid
			})
		]);
		return ausDb(neu);
	});
}

/**
 * Entfernt eine Rüge, etwa weil sie beim falschen Traktandum steht.
 *
 * **Kein Ändern, nur Entfernen und neu Erfassen.** Beides steht mit Wortlaut im
 * Verlauf; ein Ändern an Ort und Stelle liesse den früheren Wortlaut nur dort
 * zurück und machte aus einer Berichtigung etwas, das man suchen muss.
 */
export async function entferneRuege(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	ruegeId: Id
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string; abgegeben: boolean }[]>`
			SELECT state, versammlung_abgegeben(id) AS abgegeben FROM meeting WHERE id = ${meetingId}
		`;
		const sperre = m ? zustandssperre(m.state, m.abgegeben) : null;
		if (sperre) throw sperre;

		/*
		 * **Löschen und Lesen in einer Anweisung, ohne Zeilensperre.** Ein
		 * `SELECT … FOR UPDATE` verlangt in PostgreSQL das UPDATE-Recht, und das
		 * hat die Anwendung an dieser Tabelle mit Absicht nicht (Migration 160).
		 * `DELETE … RETURNING` ist ohnehin atomar: Zwei gleichzeitige Klicks
		 * löschen einmal, der zweite findet nichts und schreibt keinen zweiten
		 * Verlaufseintrag. Die Bindung an die Versammlung der Adresse steht in
		 * derselben Bedingung.
		 */
		const [r] = await tx<Zeile[]>`
			DELETE FROM objection WHERE id = ${ruegeId} AND meeting_id = ${meetingId}
			RETURNING *
		`;
		if (!r) {
			throw new FachlicherFehler(
				'unbekannt',
				'Diese Rüge gehört nicht zu dieser Versammlung.',
				'ruege'
			);
		}
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.ruegeEntfernt, { art: 'agenda_item', id: r.agenda_item_id }, {
				ruege: ruegeId,
				wortlaut: r.wording,
				ruegt: r.raised_by,
				uhrzeit: r.raised_time
			})
		]);
	});
}

/**
 * Die Rügen einer Versammlung, je Traktandum, in der Reihenfolge der Erfassung
 * (`uuidv7` ist zeitgeordnet).
 */
export async function holeRuegen(operatorId: Id, meetingId: Id): Promise<Map<Id, Ruege[]>> {
	const alle = await holeRuegenListe(operatorId, meetingId);
	const nach = new Map<Id, Ruege[]>();
	for (const r of alle) {
		const bisher = nach.get(r.traktandumId);
		if (bisher) bisher.push(r);
		else nach.set(r.traktandumId, [r]);
	}
	return nach;
}

/** Dieselben als flache Liste, für das Abschlusspaket. */
export async function holeRuegenListe(operatorId: Id, meetingId: Id): Promise<Ruege[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM objection WHERE meeting_id = ${meetingId} ORDER BY id
		`;
		return zeilen.map(ausDb);
	});
}

/**
 * Aus den Rügen nur, was ins Protokoll gehört, wie `nurAngaben` bei den
 * Pendenzen (`server/protokoll.ts`).
 *
 * **`ohneName` kappt hier, nicht erst beim Schreiben** (Codeprüfung H8, N4):
 * Das gemeinsame Protokoll eines Abends geht an alle beteiligten
 * Gemeinschaften. Was nicht in der Eingabe steht, kann kein späterer Leser
 * versehentlich mitnehmen.
 */
export function ruegeangaben(
	ruegen: Ruege[] | undefined,
	optionen: { ohneName?: boolean } = {}
): Ruegeangabe[] {
	return (ruegen ?? []).map(({ wer, uhrzeit, wortlaut, entscheid }) => ({
		wer: optionen.ohneName ? '' : wer,
		uhrzeit,
		wortlaut,
		entscheid
	}));
}
