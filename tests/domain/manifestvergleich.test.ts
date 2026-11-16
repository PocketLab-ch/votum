/**
 * Der Vergleich zweier Paketmanifeste (Produktentscheid 21.09.2026).
 *
 * **Warum das als Kerntest gehört und nicht als Datenbanktest.** Das Fenster,
 * in dem zwischen den zwei Bauten etwas hereinkommen kann, ist Millisekunden
 * breit; ein Test, der es im Betrieb treffen müsste, träfe es nur mit Glück.
 * Die reine Funktion lässt sich mit zwei erfundenen Manifesten prüfen, und die
 * Prüfsummen dürfen dabei ausgedacht sein: Verglichen wird, ob zwei gleiche
 * Zeichenketten gleich sind, nicht ob ein Hash stimmt.
 */
import { describe, expect, it } from 'vitest';
import { vergleicheManifeste, type Manifesteintrag } from '$lib/domain/manifestvergleich';

const eins: Manifesteintrag = { pfad: 'daten/meeting.json', pruefsumme: 'a'.repeat(64) };
const zwei: Manifesteintrag = { pfad: 'daten/agenda_item.json', pruefsumme: 'b'.repeat(64) };
const vorher = [eins, zwei];

describe('Zwei Manifeste vergleichen', () => {
	it('meldet nichts, wenn die Einträge gleich sind', () => {
		expect(vergleicheManifeste(vorher, [...vorher])).toEqual([]);
	});

	it('meldet einen Eintrag mit anderer Prüfsumme als geändert', () => {
		const nachher = [eins, { ...zwei, pruefsumme: 'c'.repeat(64) }];
		expect(vergleicheManifeste(vorher, nachher)).toEqual([
			{ pfad: 'daten/agenda_item.json', art: 'geaendert' }
		]);
	});

	it('meldet einen zusätzlichen Eintrag als neu', () => {
		const nachher = [...vorher, { pfad: 'daten/proxy.json', pruefsumme: 'd'.repeat(64) }];
		expect(vergleicheManifeste(vorher, nachher)).toEqual([
			{ pfad: 'daten/proxy.json', art: 'neu' }
		]);
	});

	it('meldet einen fehlenden Eintrag als entfernt', () => {
		expect(vergleicheManifeste(vorher, [eins])).toEqual([
			{ pfad: 'daten/agenda_item.json', art: 'entfernt' }
		]);
	});

	it('achtet nicht auf die Reihenfolge der Einträge', () => {
		expect(vergleicheManifeste(vorher, [...vorher].reverse())).toEqual([]);
	});
});
