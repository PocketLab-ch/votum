/**
 * Die Ausnahmen bei nicht angekündigten Geschäften, an der Gemeinschaft
 * (Migration 126). Der Kern steht in `domain/ausnahmen.ts`.
 *
 * **Ein eigener Schreibweg**, aus demselben Grund wie bei Einberufungsfrist
 * und Änderungsschranke: Die Spalten hängen an `stweg`, und das
 * Angabenformular schreibt dieselbe Zeile ohne sie. Stünden sie in
 * `GemeinschaftEingabe`, löschte jedes Speichern der Anschrift die Angabe.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	pruefeAusnahmen,
	type AusnahmenNichtangekuendigtes,
	type Universalvariante
} from '$lib/domain/ausnahmen';
import { FachlicherFehler } from '$lib/domain/fehler';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

/**
 * Speichert eine Änderung an den Angaben.
 *
 * **Was fehlt, bleibt, wie es war** (Codeprüfung 29.09.2026). Die Angaben
 * stehen auf der Reglementsseite nicht zwingend in einem Formular. Ersetzte
 * dieser Weg immer den ganzen Satz, setzte jedes Formular, das nur einen Teil
 * zeigt, den Rest still zurück. Ergänzt wird deshalb hier aus dem Vorzustand,
 * in derselben Transaktion; `null` heisst «leeren», `undefined` «nicht
 * angefasst». Geprüft wird danach der vollständige Satz.
 */
export async function speichereAusnahmen(
	handelnder: Handelnder,
	stwegId: Id,
	aenderung: Partial<Parameters<typeof pruefeAusnahmen>[0]>
): Promise<AusnahmenNichtangekuendigtes> {
	const operatorId = handelnder.operatorId as string;

	return alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<
			{
				unannounced_bylaw_allowed: boolean;
				unannounced_bylaw_source: string | null;
				universal_meeting_mode: Universalvariante;
				universal_meeting_source: string | null;
				universal_chair_proxies_count: boolean;
			}[]
		>`
			SELECT unannounced_bylaw_allowed, unannounced_bylaw_source, universal_meeting_mode,
			       universal_meeting_source, universal_chair_proxies_count
			FROM stweg WHERE id = ${stwegId}
			FOR UPDATE
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}

		const bisher = {
			reglementGestattet: vorher.unannounced_bylaw_allowed,
			reglementFundstelle: vorher.unannounced_bylaw_source,
			universalvariante: vorher.universal_meeting_mode,
			universalFundstelle: vorher.universal_meeting_source,
			leitungsvollmachtenZaehlen: vorher.universal_chair_proxies_count
		};
		const geprueft = pruefeAusnahmen({
			reglementGestattet: aenderung.reglementGestattet ?? bisher.reglementGestattet,
			reglementFundstelle:
				aenderung.reglementFundstelle !== undefined
					? aenderung.reglementFundstelle
					: bisher.reglementFundstelle,
			universalvariante: aenderung.universalvariante ?? bisher.universalvariante,
			universalFundstelle:
				aenderung.universalFundstelle !== undefined
					? aenderung.universalFundstelle
					: bisher.universalFundstelle,
			leitungsvollmachtenZaehlen:
				aenderung.leitungsvollmachtenZaehlen ?? bisher.leitungsvollmachtenZaehlen
		});

		await tx`
			UPDATE stweg
			SET unannounced_bylaw_allowed = ${geprueft.reglementGestattet},
			    unannounced_bylaw_source  = ${geprueft.reglementFundstelle},
			    universal_meeting_mode    = ${geprueft.universalvariante},
			    universal_meeting_source  = ${geprueft.universalFundstelle},
			    universal_chair_proxies_count = ${geprueft.leitungsvollmachtenZaehlen}
			WHERE id = ${stwegId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.nichtangekuendigtesGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					// Der ganze Satz, alt und neu: Im Anfechtungsfall zählt, welche
					// Angabe zur Zeit des Beschlusses galt.
					vorher: bisher,
					...geprueft
				}
			)
		);
		return geprueft;
	});
}
