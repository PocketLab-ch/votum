/**
 * Die Angabe der Sitzungsleitung an einem Folgeantrag mit Häkchen
 * (Entscheid 0045, Punkt 11; Migration 185): Er betrifft eine andere als die
 * bisherige Verwaltung, oder es geht um die Kündigung ihres Vertrags nach der
 * nicht angenommenen Abberufung. Dann ruhen die Vollmachten der Verwaltung
 * dort nicht von selbst (`leseVerwaltungsausstandIn` in `server/abstimmung.ts`);
 * der erklärte Ausstand bleibt der Weg, sie doch ruhen zu lassen.
 *
 * Warum und mit welchen Schranken: `domain/verwaltungsangabe.ts`. Hier steht
 * das Lesen, die Sperre und das Schreiben mit Verlauf.
 *
 * **Gebaut wie der Ausstand** (`server/ausstand.ts`): nur während der
 * Sitzung, nicht während und nicht nach einer Abstimmung über diesen Antrag,
 * die Absage als Satz an die Leitung. Anders als dort wird das Traktandum
 * mit `FOR UPDATE` gesperrt, nicht mit `FOR KEY SHARE`: Die Angabe ist eine
 * Spalte am Traktandum, und das Eröffnen legt seinen Durchgang mit einem
 * Fremdschlüssel aufs Traktandum an (`FOR KEY SHARE`). Beide schliessen sich
 * so aus: Läuft das Eröffnen zuerst, sieht die Angabe danach seinen
 * Durchgang und sagt ab; läuft die Angabe zuerst, liest das Eröffnen sie.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { holeLesartenIn } from './lesarten';
import { leseTeilentschiedenIn } from './abstimmung';
import { VERWALTUNGSKNOTEN } from './erfordernisse';
import { verlangeZustand } from '$lib/domain/versammlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { fremdesTraktandum } from '$lib/domain/fehler';
import {
	verlangeVerwaltungsangabe,
	verlangeVerwaltungsangabeZuruecknehmbar,
	type Verwaltungsangabe,
	type Verwaltungsangabelage
} from '$lib/domain/verwaltungsangabe';
import type { Id } from '$lib/domain/types';

type Tx = postgres.TransactionSql;

/**
 * Die Lage am Traktandum, wie die Prüfung im Kern sie braucht, dazu Titel und
 * Zustand der Versammlung. `null`, wenn das Traktandum nicht zu dieser
 * Versammlung gehört.
 *
 * bindung: meetingId — `agenda_item` wird mit `meeting_id` gelesen; die
 * Durchgänge und die Geschwister hängen an dem so gebundenen Traktandum.
 */
async function leseLageIn(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<{ titel: string; zustand: string; lage: Verwaltungsangabelage } | null> {
	const [t] = await tx<{
		title: string;
		parent_id: string | null;
		spontaneous_kind: string | null;
		concerns_management: boolean;
		requirement_node: string | null;
		management_exemption: Verwaltungsangabe | null;
		zustand: string;
	}[]>`
		SELECT a.title, a.parent_id, a.spontaneous_kind, a.concerns_management, a.requirement_node,
		       a.management_exemption, m.state AS zustand
		FROM agenda_item a
		JOIN meeting m ON m.id = a.meeting_id
		WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
	`;
	if (!t) return null;
	// Jeder Durchgang zählt, auch ein konsultativer: «vor dem ersten
	// Durchgang» (Entscheid 0045, Punkt 11). Ausgenommen der ohne Ergebnis
	// abgebrochene (`abgebrochen` in `domain/abstimmung.ts`: als Korrektur
	// geschlossen und überholt im selben Augenblick, nie verkündet): Er hat
	// kein Ergebnis und verbraucht nichts, und wer die Angabe vergessen hat,
	// geht denselben Weg wie bei einer falschen Kennzeichnung der Vollmacht:
	// abbrechen, angeben, neu freigeben (Laienprüfung Runde 14, R14-4).
	const [d] = await tx<{ alle: number; offen: number }[]>`
		SELECT (count(*) FILTER (WHERE NOT coalesce(supersede_kind = 'korrektur' AND result_published_at IS NULL
		                                    AND closed_at IS NOT NULL AND closed_at = superseded_at, false)))::int AS alle,
		       (count(*) FILTER (WHERE closed_at IS NULL AND superseded_at IS NULL))::int AS offen
		FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId}
	`;
	const folgeantrag = t.spontaneous_kind === 'folgeantrag';
	const [wahl, teile] = await Promise.all([
		holeLesartenIn(tx, { meetingId }).then((l) => l.L8),
		folgeantrag && t.parent_id ? leseTeilentschiedenIn(tx, meetingId, t.parent_id) : Promise.resolve([])
	]);
	return {
		titel: t.title,
		zustand: t.zustand,
		lage: {
			folgeantrag,
			haekchen: t.concerns_management,
			wahl,
			verwaltungsknoten: !!t.requirement_node && VERWALTUNGSKNOTEN.has(t.requirement_node),
			durchgang: d.offen > 0 ? 'offen' : d.alle > 0 ? 'gewesen' : 'keiner',
			gesetzt: t.management_exemption,
			teile
		}
	};
}

/**
 * Sperrt das Traktandum und liest die Lage; wirft, wenn es nicht zu dieser
 * Versammlung gehört oder die Versammlung nicht läuft.
 *
 * bindung: meetingId — die Sperre und die Lesung filtern `agenda_item` mit
 * `meeting_id`.
 */
async function sperreUndLies(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	handlung: string
): Promise<{ titel: string; lage: Verwaltungsangabelage }> {
	const [gesperrt] = await tx<{ id: string }[]>`
		SELECT id FROM agenda_item
		WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		FOR UPDATE
	`;
	if (!gesperrt) throw fremdesTraktandum('traktandum');
	const gelesen = await leseLageIn(tx, meetingId, traktandumId);
	if (!gelesen) throw fremdesTraktandum('traktandum');
	verlangeZustand({ zustand: gelesen.zustand as never }, ['laufend'], handlung);
	return gelesen;
}

/**
 * Die Angabe am Folgeantrag machen. Liefert Titel und Grund für die
 * Rückmeldung.
 */
export async function gibVerwaltungsangabe(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	grund: string
): Promise<{ titel: string; grund: Verwaltungsangabe }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const { titel, lage } = await sperreUndLies(tx, meetingId, traktandumId, 'eine Angabe zu den Vollmachten machen');
		const geschwister = verlangeVerwaltungsangabe(lage, grund);
		const gewaehlt = grund as Verwaltungsangabe;
		await tx`
			UPDATE agenda_item SET management_exemption = ${gewaehlt}
			WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.verwaltungsangabeGemacht, { art: 'agenda_item', id: traktandumId }, {
				traktandum: titel,
				grund: gewaehlt,
				// Der entschiedene Folgeantrag, auf den sich die Angabe stützt.
				gestuetztAuf: geschwister.titel
			})
		]);
		return { titel, grund: gewaehlt };
	});
}

/** Die Angabe zurücknehmen, bis zum ersten Durchgang (ein ohne Ergebnis abgebrochener zählt nicht). */
export async function nimmVerwaltungsangabeZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id
): Promise<{ titel: string; grund: Verwaltungsangabe }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const { titel, lage } = await sperreUndLies(
			tx,
			meetingId,
			traktandumId,
			'eine Angabe zu den Vollmachten zurücknehmen'
		);
		const grund = verlangeVerwaltungsangabeZuruecknehmbar(lage);
		await tx`
			UPDATE agenda_item SET management_exemption = NULL
			WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.verwaltungsangabeZurueckgenommen, { art: 'agenda_item', id: traktandumId }, {
				traktandum: titel,
				grund
			})
		]);
		return { titel, grund };
	});
}

/**
 * Die Lage für die Leitungsseiten (`verwaltungsangabeImSaal`), ohne Sperre.
 * `null` ausserhalb der laufenden Versammlung und für ein fremdes Traktandum.
 */
export async function holeVerwaltungsangabelage(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Verwaltungsangabelage | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const gelesen = await leseLageIn(tx, meetingId, traktandumId);
		if (!gelesen || gelesen.zustand !== 'laufend') return null;
		return gelesen.lage;
	});
}
