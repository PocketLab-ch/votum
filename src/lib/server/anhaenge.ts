/**
 * Anhänge an Versammlungen und Traktanden (Story 3.4, FR-16, AD-17).
 *
 * Die Tabelle `attachment` steht seit Migration 007 und trägt Gegenstandsart und
 * -kennung. Hier kommen zwei Arten dazu: `meeting` für die Raumbestätigung und
 * Ähnliches, `agenda_item` für Offerten, Anträge und Pläne.
 *
 * Der Inhalt liegt unter seiner Prüfsumme in der Ablage. Eine zweite Fassung ist
 * damit zwangsläufig eine zweite Datei — ein Abschlusspaket, dessen Manifest auf
 * eine Datei verweist, kann nie auf einen veränderten Inhalt zeigen.
 */
import { alsBetreiber } from './db';
import { legeAb, liesHochgeladene } from './dateien';
import { schreibeVerlauf, type Handelnder } from './audit';
import { istImEntwurf } from '$lib/domain/versammlung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id, Zeitpunkt } from '$lib/domain/types';

export type Anhangsgegenstand = 'meeting' | 'agenda_item';

export interface Anhang {
	id: Id;
	pruefsumme: string;
	name: string;
	art: string;
	groesse: number;
	hochgeladenAm: Zeitpunkt;
	gegenstandArt: Anhangsgegenstand;
	gegenstandId: Id;
}

interface AnhangZeile {
	id: string;
	checksum: string;
	original_name: string;
	content_type: string;
	size_bytes: number;
	uploaded_at: Date;
	subject_type: Anhangsgegenstand;
	subject_id: string;
}

function ausDb(z: AnhangZeile): Anhang {
	return {
		id: z.id,
		pruefsumme: z.checksum,
		name: z.original_name,
		art: z.content_type,
		groesse: z.size_bytes,
		hochgeladenAm: z.uploaded_at.toISOString(),
		gegenstandArt: z.subject_type,
		gegenstandId: z.subject_id
	};
}

/**
 * Alle Anhänge einer Versammlung — die an ihr selbst und die an ihren
 * Traktanden, in einer Abfrage.
 *
 * In einer, weil die Seite beide braucht und zwei Abfragen zwei Zeitpunkte
 * hätten: Zwischen ihnen könnte ein Anhang dazukommen, und dann stünde er in
 * der einen Liste und in der Zählung der anderen nicht.
 */
export async function holeAnhaengeDerVersammlung(
	operatorId: Id,
	meetingId: Id
): Promise<Anhang[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<AnhangZeile[]>`
			SELECT a.id, a.checksum, a.original_name, a.content_type, a.size_bytes,
			       a.uploaded_at, a.subject_type, a.subject_id
			FROM attachment a
			WHERE (a.subject_type = 'meeting' AND a.subject_id = ${meetingId})
			   OR (a.subject_type = 'agenda_item'
			       AND a.subject_id IN (SELECT id FROM agenda_item WHERE meeting_id = ${meetingId}))
			ORDER BY a.uploaded_at
		`;
		return zeilen.map(ausDb);
	});
}

/**
 * Hängt eine Datei an.
 *
 * Die Ablage geschieht vor der Transaktion: Der Inhalt ist unveränderlich und
 * wird über seine Prüfsumme angesprochen. Bricht die Transaktion ab, bleibt eine
 * Datei liegen, auf die nichts verweist — harmlos, und allemal besser, als eine
 * Transaktion für die Dauer eines Uploads offen zu halten.
 */
export async function haengeAn(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	gegenstandArt: Anhangsgegenstand,
	gegenstandId: Id,
	datei: File
): Promise<Anhang> {
	if (!datei || datei.size === 0) {
		throw new FachlicherFehler('keine_datei', 'Es wurde keine Datei gewählt.', 'datei');
	}

	/*
	 * **Erst prüfen, dann ablegen** (07.09.2026).
	 *
	 * Die Ablage stand bis hierher **vor** der Transaktion, und die Absage kam
	 * damit, nachdem die Datei auf der Platte lag — dieselbe Reihenfolge, die
	 * schon bei den Vollmachten auffiel (`69f107c`). Die Prüfung selbst war
	 * zusätzlich zu schwach: `bezugPruefen` fand jedes Traktandum des
	 * Betreibers, auch eines aus einer fremden Versammlung, obwohl die
	 * Versammlung in der Adresse steht.
	 *
	 * Der Grund für die alte Reihenfolge trägt nicht mehr: Er lautete, eine
	 * Transaktion solle nicht «für die Dauer eines Uploads» offen stehen — der
	 * Inhalt ist an dieser Stelle aber längst vollständig im Speicher, und
	 * `legeAb` schreibt nur noch lokal.
	 */
	const inhalt = await liesHochgeladene(datei);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const bezug = await bezugPruefen(tx, meetingId, gegenstandArt, gegenstandId);
		const abgelegt = await legeAb(inhalt, datei.name, datei.type);

		const [zeile] = await tx<AnhangZeile[]>`
			INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id,
			                        checksum, original_name, content_type, size_bytes, uploaded_by)
			VALUES (${handelnder.operatorId}, ${bezug.stwegId}, ${gegenstandArt}, ${gegenstandId},
			        ${abgelegt.pruefsumme}, ${abgelegt.name}, ${abgelegt.art}, ${abgelegt.groesse},
			        ${handelnder.userId})
			RETURNING id, checksum, original_name, content_type, size_bytes, uploaded_at,
			          subject_type, subject_id
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.anhangHinzugefuegt,
				{ art: gegenstandArt, id: gegenstandId },
				{
					versammlung: bezug.meetingId,
					name: abgelegt.name,
					// Die Prüfsumme in den Verlauf: Damit lässt sich später belegen,
					// welcher Inhalt zum Zeitpunkt des Beschlusses vorlag — auch dann,
					// wenn die Zeile in `attachment` einmal nicht mehr da wäre.
					pruefsumme: abgelegt.pruefsumme,
					art: abgelegt.art,
					groesse: abgelegt.groesse
				}
			)
		);

		return ausDb(zeile);
	});
}

/**
 * Löst einen Anhang wieder ab.
 *
 * Die Datei selbst bleibt in der Ablage. Sie wird über ihre Prüfsumme
 * angesprochen und kann an einem anderen Gegenstand hängen; sie zu löschen
 * hiesse, dort einen Verweis ins Leere zu erzeugen (AD-17).
 *
 * bindung: anhangId — `bezugPruefen(tx, meetingId, …)` prüft den Gegenstand
 *   des Anhangs danach gegen den Rahmen; zwei Abfragen statt einer.
 */
export async function loeseAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	anhangId: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<AnhangZeile[]>`
			SELECT id, checksum, original_name, content_type, size_bytes, uploaded_at,
			       subject_type, subject_id
			FROM attachment WHERE id = ${anhangId}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Anhang nicht gefunden.', 'id');

		/*
		 * **Der Rahmen kommt aus der Adresse, nicht aus der Zeile** (Code-Review
		 * 07.09.2026). Die erste Fassung leitete die Versammlung aus dem
		 * Gegenstand des Anhangs ab und verglich sie mit sich selbst — eine
		 * Prüfung, die nicht scheitern kann. Beide `abloesen`-Aktionen nahmen die
		 * Anhangskennung aus dem Formular, also liess sich der Anhang einer
		 * anderen Versammlung von hier aus entfernen, samt Verlaufseintrag dort.
		 */
		const bezug = await bezugPruefen(tx, meetingId, z.subject_type, z.subject_id);

		await tx`DELETE FROM attachment WHERE id = ${anhangId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.anhangEntfernt,
				{ art: z.subject_type, id: z.subject_id },
				{ versammlung: bezug.meetingId, name: z.original_name, pruefsumme: z.checksum }
			)
		);
	});
}

/**
 * Prüft, dass der Gegenstand existiert und die Versammlung noch im Entwurf ist.
 *
 * Nach der Freigabe ist Schluss: Die Unterlagen sind mit der Einladung
 * verschickt. Kämen danach noch welche dazu, hätten die Eigentümer über eine
 * andere Grundlage entschieden, als sie erhalten haben.
 */
async function bezugPruefen(
	tx: import('postgres').TransactionSql,
	meetingId: Id,
	art: Anhangsgegenstand,
	id: Id
): Promise<{ meetingId: Id; stwegId: Id }> {
	/*
	 * **Der Rahmen kommt aus der Adresse, der Gegenstand aus dem Formular** —
	 * und hier werden die beiden verglichen. Bei `meeting` sind sie dasselbe;
	 * bei `agenda_item` bindet die Bedingung das Traktandum an die Versammlung,
	 * deren Seite gerade offen ist. `FOR KEY SHARE` aus demselben Grund wie in
	 * `erklaereAusstand`: Ein Löschen des Traktandums wartet auf diesen Anhang
	 * und räumt ihn dann ab (`server/traktandenreste.ts`).
	 */
	const [z] =
		art === 'meeting'
			? await tx<{ id: string; stweg_id: string; state: string }[]>`
					SELECT id, stweg_id, state FROM meeting WHERE id = ${id} AND id = ${meetingId}
				`
			: await tx<{ id: string; stweg_id: string; state: string }[]>`
					SELECT m.id, m.stweg_id, m.state
					FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
					WHERE a.id = ${id} AND a.meeting_id = ${meetingId}
					FOR KEY SHARE OF a
				`;

	if (!z) {
		/*
		 * **Zwei Sachverhalte, zwei Würfe** (08.09.2026). Vorher stand hier
		 * einer mit zwei Bedingungen darin — Kennung und Satz je einmal
		 * verzweigt. Das las sich wie eine Absage und waren zwei, und die eine
		 * Hälfte liess sich nicht mit den zwölf Geschwistern zusammenführen.
		 */
		throw art === 'meeting'
			? new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id')
			: fremdesTraktandum('id');
	}
	if (!istImEntwurf({ zustand: z.state as never })) {
		throw new FachlicherFehler(
			'zustand_unpassend',
			'Die Versammlung ist freigegeben. Unterlagen sind mit der Einladung verschickt — kämen ' +
				'danach noch welche dazu, hätten die Eigentümer über eine andere Grundlage entschieden, ' +
				'als sie erhalten haben.',
			'zustand'
		);
	}
	return { meetingId: z.id, stwegId: z.stweg_id };
}

/** Liest die Anhangsangaben zu einer Prüfsumme, im Kontext des Betreibers. */
export async function holeAnhangsangaben(
	operatorId: Id,
	pruefsumme: string
): Promise<{ name: string; art: string } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ original_name: string; content_type: string }[]>`
			SELECT original_name, content_type FROM attachment
			WHERE checksum = ${pruefsumme} LIMIT 1
		`;
		return z ? { name: z.original_name, art: z.content_type } : null;
	});
}
