/**
 * Wer die eine Stimme einer Mitgliedsgemeinschaft abgibt (Story 7.2).
 *
 * MEG Umgebung Art. 7 Ziff. 3: Die beteiligten Stockwerkeigentümer haben «nur
 * eine Stimme, die sie durch einen durch sie bezeichneten Vertreter auszuüben
 * haben». Der Vertreter wird vom Haus bezeichnet, nicht vom Verwalter bestimmt,
 * und er wechselt.
 *
 * **Mit Zeitraum, von Anfang an.** Ein Vertreterwechsel im März darf eine
 * Versammlung vom Februar nicht verändern — dieselbe Begründung wie beim
 * Eigentum (Story 1.8, FR-5). Nachträglich wäre der Umbau kein additiver Schritt
 * mehr (AD-14).
 *
 * **Mit Fundstelle.** Woraus sich die Befugnis ergibt, gehört daneben: Wer den
 * Beschluss anficht, greift zuerst die Vertretungsmacht an.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { istKalendertag } from '$lib/domain/datum';

export interface Vertretung {
	id: Id;
	parteiId: Id;
	stwegId: Id;
	personName: string;
	ab: string;
	bis: string | null;
	/** Fundstelle im Reglement, etwa «Art. 7 Ziff. 3». */
	grundlage: string | null;
	/** Die Versammlung, an der er bezeichnet wurde, falls bekannt. */
	beschlossenAnVersammlung: Id | null;
	bemerkung: string | null;
}

interface Zeile {
	id: string;
	party_id: string;
	stweg_id: string;
	person_name: string;
	valid_from: Date | string;
	valid_to: Date | string | null;
	basis: string | null;
	resolved_by_meeting_id: string | null;
	note: string | null;
}

/** Ein Kalendertag ohne Zeitzone: `date` kommt je nach Treiber als Date herein. */
function tag(w: Date | string): string {
	return typeof w === 'string' ? w : w.toISOString().slice(0, 10);
}

function ausDb(z: Zeile): Vertretung {
	return {
		id: z.id,
		parteiId: z.party_id,
		stwegId: z.stweg_id,
		personName: z.person_name,
		ab: tag(z.valid_from),
		bis: z.valid_to ? tag(z.valid_to) : null,
		grundlage: z.basis,
		beschlossenAnVersammlung: z.resolved_by_meeting_id,
		bemerkung: z.note
	};
}

export async function holeVertretungen(operatorId: Id, stwegId: Id): Promise<Vertretung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM representation WHERE stweg_id = ${stwegId}
			ORDER BY party_id, valid_from DESC
		`;
		return zeilen.map(ausDb);
	});
}

/**
 * Wer zum Stichtag für diese Partei stimmt.
 *
 * Der Stichtag ist Pflicht: Ohne ihn läse die Abfrage den heutigen Stand, und
 * eine Nachbereitung im Dezember nennte einen anderen Vertreter als die
 * Versammlung im Mai.
 */
export async function holeVertreterAm(
	operatorId: Id,
	stwegId: Id,
	stichtag: string
): Promise<Map<Id, Vertretung>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM representation
			WHERE stweg_id = ${stwegId}
			  AND valid_from <= ${stichtag}
			  AND (valid_to IS NULL OR valid_to > ${stichtag})
		`;
		return new Map(zeilen.map((z) => [z.party_id, ausDb(z)]));
	});
}

export interface VertretungEingabe {
	parteiId: Id;
	personName: string;
	ab: string;
	bis?: string | null;
	grundlage?: string | null;
	beschlossenAnVersammlung?: Id | null;
	bemerkung?: string | null;
}

export async function bezeichneVertreter(
	handelnder: Handelnder & { operatorId: string },
	eingabe: VertretungEingabe
): Promise<Vertretung> {
	const name = eingabe.personName?.trim() ?? '';
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Name des Vertreters fehlt oder ist zu kurz.',
			'personName'
		);
	}
	if (!istKalendertag(eingabe.ab)) {
		throw new FachlicherFehler('datum_ungueltig', 'Der Beginn fehlt.', 'ab');
	}
	if (eingabe.bis && eingabe.bis <= eingabe.ab) {
		throw new FachlicherFehler(
			'zeitraum_verkehrt',
			'Das Ende muss nach dem Beginn liegen.',
			'bis'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [partei] = await tx<{ stweg_id: string; kind: string; display_name: string }[]>`
			SELECT stweg_id, kind, display_name FROM party WHERE id = ${eingabe.parteiId}
		`;
		if (!partei) {
			throw new FachlicherFehler('unbekannt', 'Eigentümer nicht gefunden.', 'parteiId');
		}

		try {
			const [z] = await tx<Zeile[]>`
				INSERT INTO representation (operator_id, party_id, stweg_id, person_name,
				                            valid_from, valid_to, basis,
				                            resolved_by_meeting_id, note)
				VALUES (${handelnder.operatorId}, ${eingabe.parteiId}, ${partei.stweg_id}, ${name},
				        ${eingabe.ab}, ${eingabe.bis ?? null}, ${eingabe.grundlage?.trim() || null},
				        ${eingabe.beschlossenAnVersammlung ?? null}, ${eingabe.bemerkung?.trim() || null})
				RETURNING *
			`;

			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.vertreterBezeichnet,
					{ art: 'party', id: eingabe.parteiId },
					{
						fuer: partei.display_name,
						person: name,
						ab: eingabe.ab,
						bis: eingabe.bis ?? null,
						grundlage: eingabe.grundlage?.trim() || null
					}
				)
			);
			return ausDb(z);
		} catch (fehler) {
			// Zwei Vertreter zur selben Zeit: Im Moment der Abstimmung liesse sich
			// nicht sagen, wer die eine Stimme abgibt. Die Datenbank weist es ab;
			// hier wird daraus eine Meldung, die den Weg zeigt.
			if (fehler instanceof postgres.PostgresError && fehler.code === '23P01') {
				throw new FachlicherFehler(
					'ueberschneidung',
					'Für diesen Zeitraum ist bereits ein Vertreter bezeichnet. Beenden Sie den ' +
						'bisherigen zuerst — er bleibt für vergangene Versammlungen sichtbar.',
					'ab'
				);
			}
			throw fehler;
		}
	});
}

/**
 * Beendet eine Vertretung auf einen Tag.
 *
 * Nicht löschen: Eine vergangene Versammlung muss weiter zeigen, wer damals
 * gestimmt hat (AD-5).
 */
export async function beendeVertretung(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	bis: string
): Promise<Vertretung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<Zeile[]>`SELECT * FROM representation WHERE id = ${id}`;
		if (!vorher) throw new FachlicherFehler('unbekannt', 'Vertretung nicht gefunden.', 'id');
		if (bis <= tag(vorher.valid_from)) {
			throw new FachlicherFehler(
				'zeitraum_verkehrt',
				'Das Ende muss nach dem Beginn liegen.',
				'bis'
			);
		}

		const [z] = await tx<Zeile[]>`
			UPDATE representation SET valid_to = ${bis} WHERE id = ${id} RETURNING *
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.vertretungBeendet,
				{ art: 'party', id: vorher.party_id },
				{ person: vorher.person_name, bis }
			)
		);
		return ausDb(z);
	});
}
