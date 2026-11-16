/**
 * Gesetzte und übersteuerte Mehrheitserfordernisse festhalten (Story 2.3).
 *
 * In Welle 1 hängt ein Erfordernis noch an keinem Traktandum — das entsteht erst
 * in Epic 3. Was es schon gibt, ist die Gemeinschaft, und die Entscheidung der
 * Sitzungsleitung gehört unabhängig davon in den Verlauf: Sie ist der Vorgang,
 * auf den es im Streitfall ankommt, nicht der Vorschlag des Werkzeugs.
 */
import { alsBetreiber } from './db';
import { schreibeUebergang, type Handelnder } from './audit';
import { KENNUNGSFORM } from './zugehoerigkeit';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Uebergang } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

/**
 * Schreibt den Übergang in den Verlauf und gibt sein Ergebnis zurück.
 *
 * Der Gegenstand ist die Gemeinschaft, damit der Eintrag unter
 * `/verlauf?gegenstand=<id>` bei ihr auftaucht. Ohne Gemeinschaft — der Rechner
 * lässt sich auch ohne betreiben — wird nichts geschrieben: Ein Verlaufseintrag
 * ohne Bezug wäre später nicht zuzuordnen.
 */
export async function haltErfordernisFest(
	handelnder: Handelnder,
	stwegId: Id | null,
	u: Uebergang<Erfordernis>
): Promise<Erfordernis> {
	if (!stwegId || !handelnder.operatorId) return u.ergebnis;

	/*
	 * **Die Kennung kommt aus dem Formular und wird hier gebunden** (K2,
	 * Sicherheitsdurchgang 09.10.2026). Der Gegenstand im Verlauf ist freier
	 * Text ohne Fremdschlüssel (Migration 001); ohne diese Abfrage nahm der
	 * Verlauf die Kennung eines fremden Betreibers oder eine erfundene an, und
	 * der Eintrag liesse sich nicht mehr entfernen. Gefragt wird unter dem
	 * eigenen Betreiber, wie im Load der Quorum-Seite (`holeGemeinschaft`):
	 * Eine fremde Zeile ist dort so unsichtbar wie eine, die es nicht gibt.
	 *
	 * Als Gegenstand geht die Kennung **aus der Zeile** in den Verlauf, nicht
	 * die aus dem Formular: `KENNUNGSFORM` lässt Grossbuchstaben zu, und ein
	 * Eintrag unter `A1B2…` fände `/verlauf?gegenstand=a1b2…` nicht.
	 */
	if (!KENNUNGSFORM.test(stwegId)) throw fremdeGemeinschaft();

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<{ id: string }[]>`SELECT id FROM stweg WHERE id = ${stwegId}`;
		if (!zeile) throw fremdeGemeinschaft();

		const mitBezug: Uebergang<Erfordernis> = {
			ergebnis: u.ergebnis,
			ereignisse: u.ereignisse.map((e) => ({
				...e,
				gegenstandArt: e.gegenstandArt ?? 'stweg',
				gegenstandId: e.gegenstandId ?? zeile.id
			}))
		};
		return schreibeUebergang(tx, handelnder, mitBezug);
	});
}

function fremdeGemeinschaft(): FachlicherFehler {
	return new FachlicherFehler(
		'unbekannte_gemeinschaft',
		'Diese Gemeinschaft gibt es hier nicht. Wählen Sie unter «Zahlenbeispiel für» eine andere.'
	);
}
