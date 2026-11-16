/**
 * Den Abruf einer Unterlage im Verlauf festhalten (23.08.2026, Prüflauf I, B-14).
 *
 * **Warum es diese Datei gibt.** Der Vorbereitungsschritt «Einladung erzeugen»
 * fragte bis zum 23.08.2026 das Ereignis `agenda.pdf.created` ab — das niemand
 * schrieb. Der Schritt konnte also nie erledigt werden; in der Datenbank stand
 * zu diesem Ereignis keine einzige Zeile, obwohl die Traktandenliste hunderte
 * Male abgerufen worden war. Eine Abfrage ohne Schreiber sieht aus wie eine
 * Prüfung und ist keine.
 *
 * Vermerkt wird **einmal je Versammlung**: Wer die Einladung dreimal öffnet,
 * hat sie einmal erzeugt, und drei Zeilen im Verlauf verdeckten die eine, auf
 * die es ankommt.
 *
 * **Und einmal mehr nach jeder Rücknahme der Freigabe** (Produktentscheid
 * 06.10.2026, «Seit Rücknahme zählen»; Migration 147). Nach Rücknahme und neuer
 * Freigabe ist die Einladung eine neue; ein Vermerk von vorher sagt über sie
 * nichts. Ohne neuen Vermerk bliebe der Schritt «Einladung erzeugen» offen und
 * die Erinnerung käme, obwohl die neue Einladung erzeugt ist.
 *
 * **Die Traktandenliste ebenso.** Ihr Vermerk ist der Nachweis, wann die Liste
 * vorlag, und nach der Rücknahme ist es eine neue Liste, die anders aussehen
 * kann. Ein Vermerk von vor der Rücknahme belegte den Zeitpunkt der alten.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, zeitquelle, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis, type Ereignisart } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

async function vermerkeEinmalig(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id,
	ereignisart: Ereignisart
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		// Dieselbe Bedingung wie in Vorbereitung und Erinnerung (Migration 147).
		const [{ schon }] = await tx<{ schon: boolean }[]>`
			SELECT vermerkt_seit_ruecknahme(${meetingId}::uuid, ${ereignisart}) AS schon
		`;
		if (schon) return;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(ereignisart, { art: 'meeting', id: meetingId }, { quelle: zeitquelle() })
		);
	});
}

/** Die Einladung wurde erzeugt — daran hängt der Vorbereitungsschritt. */
export async function vermerkeEinladung(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id
): Promise<void> {
	await vermerkeEinmalig(handelnder, meetingId, EREIGNISARTEN.einladungErzeugt);
}

/**
 * Die Traktandenliste wurde erzeugt.
 *
 * **Nicht für einen Schritt, sondern für den Nachweis**: Im Anfechtungsfall
 * zählt, wann die Liste vorlag. Das Ereignis gab es seit je, mitsamt Klartext
 * im Verlauf — geschrieben hat es bis zum 23.08.2026 niemand.
 */
export async function vermerkeTraktandenliste(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id
): Promise<void> {
	await vermerkeEinmalig(handelnder, meetingId, EREIGNISARTEN.traktandenlisteErzeugt);
}
