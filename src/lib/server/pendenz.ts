/**
 * Pendenzen lesen und schreiben.
 *
 * Die Regeln stehen im Kern (`$lib/domain/pendenz`), das Modell in Migration
 * 106; hier steht der Weg zur Datenbank. Jede Abfrage läuft in `alsBetreiber`
 * und damit unter der Mandantengrenze.
 *
 * **Warum hier keine Prüfung auf das Siegel steht.** An jedem anderen
 * Schreibweg der Versammlung steht eine — am Durchgang, an der Anwesenheit, an
 * der Vollmacht. Die Pendenz ist wie die Protokollnotiz ausgenommen (PRD
 * §4.11): Sie ist nicht Teil des Siegelpakets (`siegel.ts` legt sie nicht
 * hinein), und ihr Zustand ändert sich gerade DANN, wenn die Versammlung längst
 * versiegelt ist. Eine Sperre hier verböte das Abhaken, für das es sie gibt.
 *
 * Die Ausnahme ist ausdrücklich und nicht vergessen: Wer eine Pendenz ins
 * Siegelpaket legt, muss diesen Absatz zuerst widerlegen.
 *
 * **Der Verlauf hängt am Traktandum, nicht an der Pendenz** (Code-Review
 * 09.09.2026). Der erste Anlauf setzte die Pendenzkennung als Gegenstand — und
 * damit fielen alle vier Ereignisse aus jedem gefilterten Verlauf heraus:
 * `gehoertZu` in `verlaufsabfrage.ts` löst den Gegenstand über seine Tabelle
 * zur Versammlung auf, und `pendenz` stand dort nicht.
 *
 * Nachtragen allein hätte es nicht behoben. Beim Entfernen ist die Zeile weg,
 * und eine Unterabfrage findet sie nie wieder — ausgerechnet der Eintrag, der
 * die einzige Spur ist, dass es die Pendenz gab. Das Traktandum überlebt
 * dagegen. `minutes.note.recorded` macht es aus demselben Grund seit jeher so;
 * die Pendenzkennung steht in den Angaben.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler, fremdesTraktandum } from '$lib/domain/fehler';
import { kalendertag } from '$lib/domain/datum';
import {
	pruefePendenz,
	pruefeZustand,
	type Pendenz,
	type Pendenzeingabe,
	type Fristart,
	type Pendenzzustand
} from '$lib/domain/pendenz';
import type { Id } from '$lib/domain/types';

interface Zeile {
	id: string;
	meeting_id: string;
	agenda_item_id: string;
	wording: string;
	responsible: string | null;
	due_kind: string;
	due_date: Date | string | null;
	state: string;
	state_since: Date;
	closing_note: string | null;
	created_at: Date;
}

function ausDb(z: Zeile): Pendenz {
	return {
		id: z.id,
		versammlungId: z.meeting_id,
		traktandumId: z.agenda_item_id,
		text: z.wording,
		verantwortlich: z.responsible,
		fristArt: z.due_kind as Fristart,
		// `kalendertag` und nicht `tagVon`: `due_date` ist eine `date`-Spalte
		// ohne Zone, und die hiesige Zone verschöbe sie um einen Tag.
		fristDatum: z.due_date === null ? null : kalendertag(z.due_date),
		zustand: z.state as Pendenzzustand,
		zustandSeit: z.state_since.toISOString(),
		abschlussNotiz: z.closing_note,
		erfasstAm: z.created_at.toISOString()
	};
}

/**
 * Erfasst eine Pendenz an einem Traktandum.
 *
 * **Die Bindung steht in der Abfrage, nicht in der Route.** Die
 * Traktandumskennung kommt aus dem Formular; ohne das `AND meeting_id = …`
 * liesse sich eine Pendenz an ein Traktandum einer fremden Versammlung hängen.
 * Die Schranke `pendenz_herkunft_traktandum` hielte sie zwar auf — aber als
 * rohe Datenbankmeldung.
 *
 * **Kein Wächter hält das hier**, anders als im Gemeinschaftsbaum:
 * `check-kennungen` liest nur `routes/gemeinschaften`, `check-abendbindung` nur
 * `routes/tage`. Gemessen wird die Bindung stattdessen in `tests/db/pendenz`
 * («weist ein Traktandum aus einer anderen Versammlung ab»), und die Probe geht
 * rot, wenn das `AND` fällt.
 */
export async function erfassePendenz(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	eingabe: Pendenzeingabe
): Promise<Pendenz> {
	const geprueft = pruefePendenz(eingabe);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [t] = await tx<{ title: string; stweg_id: string }[]>`
			SELECT a.title, m.stweg_id
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		if (!t) throw fremdesTraktandum('traktandumId');

		const [neu] = await tx<Zeile[]>`
			INSERT INTO pendenz (operator_id, stweg_id, meeting_id, agenda_item_id,
			                     wording, responsible, due_kind, due_date)
			VALUES (${handelnder.operatorId}, ${t.stweg_id}, ${meetingId}, ${traktandumId},
			        ${geprueft.text}, ${geprueft.verantwortlich},
			        ${geprueft.fristArt}, ${geprueft.fristDatum})
			RETURNING *
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.pendenzErfasst, { art: 'agenda_item', id: traktandumId }, {
				pendenz: neu.id,
				traktandum: t.title,
				verantwortlich: geprueft.verantwortlich,
				frist: geprueft.fristArt,
				fristDatum: geprueft.fristDatum
			})
		]);
		return ausDb(neu);
	});
}

/**
 * Ändert Wortlaut, Zuständigkeit oder Frist.
 *
 * Der Zustand bleibt aussen vor: Er hat einen eigenen Weg, weil er einen
 * eigenen Zeitpunkt und eine eigene Notiz trägt.
 */
export async function aenderePendenz(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	pendenzId: Id,
	eingabe: Pendenzeingabe
): Promise<Pendenz> {
	const geprueft = pruefePendenz(eingabe);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [alt] = await tx<Zeile[]>`
			SELECT * FROM pendenz
			 WHERE id = ${pendenzId} AND meeting_id = ${meetingId}
			 FOR UPDATE
		`;
		if (!alt) throw unbekannt();

		const [neu] = await tx<Zeile[]>`
			UPDATE pendenz
			   SET wording = ${geprueft.text},
			       responsible = ${geprueft.verantwortlich},
			       due_kind = ${geprueft.fristArt},
			       due_date = ${geprueft.fristDatum},
			       updated_at = now()
			 WHERE id = ${pendenzId}
			RETURNING *
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.pendenzGeaendert, { art: 'agenda_item', id: alt.agenda_item_id }, {
				pendenz: pendenzId,
				vorher: alt.wording,
				nachher: geprueft.text,
				verantwortlich: geprueft.verantwortlich,
				frist: geprueft.fristArt,
				fristDatum: geprueft.fristDatum
			})
		]);
		return ausDb(neu);
	});
}

/**
 * Hakt eine Pendenz ab, lässt sie verfallen oder öffnet sie wieder.
 *
 * **Der eigene Weg ist der Punkt der ganzen Bauart.** Diese Handlung geschieht
 * Monate nach der Sitzung, oft an der nächsten — deshalb hängt die Pendenz an
 * der Gemeinschaft und deshalb steht hier keine Siegelprüfung (siehe oben).
 */
export async function setzePendenzzustand(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	pendenzId: Id,
	zustand: string,
	notiz?: string | null
): Promise<Pendenz> {
	const gewaehlt = pruefeZustand(zustand, notiz);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [alt] = await tx<Zeile[]>`
			SELECT * FROM pendenz
			 WHERE id = ${pendenzId} AND meeting_id = ${meetingId}
			 FOR UPDATE
		`;
		if (!alt) throw unbekannt();

		// **Ohne Änderung kein Eintrag.** Zweimal «erledigt» ist keine zweite
		// Erledigung, und ein Verlauf, der das behauptet, macht die echten
		// Übergänge unauffindbar. Der Zeitpunkt bleibt der der ersten.
		if (alt.state === gewaehlt.zustand && (alt.closing_note ?? null) === gewaehlt.notiz) {
			return ausDb(alt);
		}

		const [neu] = await tx<Zeile[]>`
			UPDATE pendenz
			   SET state = ${gewaehlt.zustand},
			       state_since = now(),
			       closing_note = ${gewaehlt.notiz},
			       updated_at = now()
			 WHERE id = ${pendenzId}
			RETURNING *
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.pendenzZustandGesetzt,
				{ art: 'agenda_item', id: alt.agenda_item_id },
				{
				pendenz: pendenzId,
				wortlaut: alt.wording,
				vorher: alt.state,
				nachher: gewaehlt.zustand,
				notiz: gewaehlt.notiz
				}
			)
		]);
		return ausDb(neu);
	});
}

/**
 * Entfernt eine Pendenz.
 *
 * **Nur solange sie offen ist.** Eine erledigte oder hinfällige Pendenz trägt
 * eine Auskunft, die niemand sonst hat: dass etwas getan wurde oder still
 * verfallen ist. Wer sie wegräumt, nimmt genau das mit. Offen dagegen heisst,
 * dass noch nichts daran hängt — und im Saal vertippt sich jemand.
 */
export async function entfernePendenz(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	pendenzId: Id
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [p] = await tx<Zeile[]>`
			SELECT * FROM pendenz
			 WHERE id = ${pendenzId} AND meeting_id = ${meetingId}
			 FOR UPDATE
		`;
		if (!p) throw unbekannt();
		if (p.state !== 'offen') {
			throw new FachlicherFehler(
				'nicht_offen',
				'Diese Pendenz ist bereits abgeschlossen und bleibt stehen. Dass etwas erledigt ' +
					'wurde oder verfallen ist, gehört zum Sachstand.',
				'pendenz'
			);
		}
		await tx`DELETE FROM pendenz WHERE id = ${pendenzId}`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.pendenzEntfernt, { art: 'agenda_item', id: p.agenda_item_id }, {
				pendenz: pendenzId,
				wortlaut: p.wording
			})
		]);
	});
}

/**
 * Die Pendenzen einer Versammlung, je Traktandum.
 *
 * Sortiert wie sie erfasst wurden (`uuidv7` ist zeitgeordnet) — im Saal ist die
 * Reihenfolge des Sprechens die verständlichste.
 */
export async function holePendenzen(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, Pendenz[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM pendenz
			 WHERE meeting_id = ${meetingId}
			 ORDER BY id
		`;
		const nach = new Map<Id, Pendenz[]>();
		for (const z of zeilen) {
			const p = ausDb(z);
			const bisher = nach.get(p.traktandumId);
			if (bisher) bisher.push(p);
			else nach.set(p.traktandumId, [p]);
		}
		return nach;
	});
}

function unbekannt(): FachlicherFehler {
	return new FachlicherFehler(
		'unbekannt',
		'Diese Pendenz gehört nicht zu dieser Versammlung.',
		'pendenz'
	);
}
