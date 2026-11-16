/**
 * Die Einstellung «Neuabstimmung nach Eintritt der Beschlussfähigkeit»
 * (Migration 139). Der Kern steht in `domain/neuabstimmung.ts`.
 *
 * **Ein eigener Schreibweg**, aus demselben Grund wie bei
 * `speichereAusnahmen`: Die Spalte hängt an `stweg`, und das Angabenformular
 * der Gemeinschaft schreibt dieselbe Zeile ohne sie. Stünde sie in
 * `GemeinschaftEingabe`, löschte jedes Speichern der Anschrift die Angabe.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { pruefeNeuabstimmung, type Neuabstimmungsart } from '$lib/domain/neuabstimmung';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

export async function speichereNeuabstimmung(
	handelnder: Handelnder,
	stwegId: Id,
	neuabstimmung: unknown
): Promise<Neuabstimmungsart> {
	const operatorId = handelnder.operatorId as string;
	const geprueft = pruefeNeuabstimmung(neuabstimmung);

	return alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ revote_after_quorum: Neuabstimmungsart }[]>`
			SELECT revote_after_quorum FROM stweg WHERE id = ${stwegId} FOR UPDATE
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		await tx`
			UPDATE stweg
			SET revote_after_quorum = ${geprueft}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.neuabstimmungNachQuorumGesetzt, { art: 'stweg', id: stwegId }, {
				vorher: vorher.revote_after_quorum,
				neu: geprueft
			})
		);
		return geprueft;
	});
}
