import { describe, expect, it } from 'vitest';
import {
	bestaetigeEintreffen,
	erfasseVerlassen,
	istAnwesend,
	lehneAb,
	meldeAn,
	ohneKontrollkarte,
	standVon,
	stimmtUeberSitzungsleitung,
	uebersicht,
	WEGNAMEN,
	ZUSTANDSNAMEN,
	type Anwesenheitsart,
	type Anwesenheitsereignis,
	type Erfassungsweg
} from '../../src/lib/domain/anwesenheit';
import { FachlicherFehler } from '../../src/lib/domain/gemeinschaft';
import { EREIGNISARTEN } from '../../src/lib/domain/verlauf';
import type { Snapshot } from '../../src/lib/domain/types';

let lauf = 0;

function e(
	art: Anwesenheitsart,
	zeitpunkt: string,
	weg: Erfassungsweg = 'gescannt',
	parteiId = 'p-1',
	bemerkung?: string
): Anwesenheitsereignis {
	return {
		id: `e-${++lauf}`,
		meetingId: 'v-1',
		parteiId,
		art,
		weg,
		zeitpunkt,
		bemerkung
	};
}

function momentaufnahme(): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-09-15T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			{
				partyId: 'p-1',
				displayName: 'Anna Muster',
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: 'u-1', label: 'Whg 1', kind: 'unit', countsAsHead: true, quota: 600 }]
			},
			{
				partyId: 'p-2',
				displayName: 'Beat Beispiel',
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: 'u-2', label: 'Whg 2', kind: 'unit', countsAsHead: true, quota: 400 }]
			}
		]
	};
}

describe('Stand aus der Ereignisfolge', () => {
	it('ist ohne Ereignis unbekannt', () => {
		expect(standVon([])).toBeNull();
	});

	it('wird durch Eintreffen anwesend', () => {
		const s = standVon([e('eingetroffen', '2026-09-15T18:00:00.000Z')]);
		expect(s?.zustand).toBe('anwesend');
		expect(s?.seit).toBe('2026-09-15T18:00:00.000Z');
	});

	it('wird durch Verlassen gegangen, behält aber das Eintreffen', () => {
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('verlassen', '2026-09-15T20:15:00.000Z')
		]);
		expect(s?.zustand).toBe('gegangen');
		expect(s?.seit).toBe('2026-09-15T18:00:00.000Z');
		expect(s?.gegangenSeit).toBe('2026-09-15T20:15:00.000Z');
	});

	it('wird durch Rückkehr wieder anwesend, mit dem ersten Eintreffen', () => {
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('verlassen', '2026-09-15T20:15:00.000Z'),
			e('eingetroffen', '2026-09-15T20:40:00.000Z')
		]);
		expect(s?.zustand).toBe('anwesend');
		expect(s?.seit).toBe('2026-09-15T18:00:00.000Z');
		expect(s?.gegangenSeit).toBeNull();
	});

	it('trägt die Begründung des letzten Verlassens', () => {
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('verlassen', '2026-09-15T20:15:00.000Z', 'von_hand', 'p-1', 'Arzttermin')
		]);
		expect(s?.gegangenGrund).toBe('Arzttermin');
	});

	it('lässt die Begründung mit der Rückkehr fallen', () => {
		// Sie gehört zum letzten Verlassen; wer wieder da ist, geht nicht mehr
		// «wegen Arzttermin».
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('verlassen', '2026-09-15T20:15:00.000Z', 'von_hand', 'p-1', 'Arzttermin'),
			e('eingetroffen', '2026-09-15T20:40:00.000Z')
		]);
		expect(s?.gegangenGrund).toBeNull();
	});

	it('rechnet zum Stichzeitpunkt, nicht zum jetzigen Stand', () => {
		// Das ist die eigentliche Zusage von AD-16: Wer um 20:15 geht, war um
		// 20:00 anwesend, und das Ergebnis von 20:00 darf sich nicht ändern.
		const folge = [
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('verlassen', '2026-09-15T20:15:00.000Z')
		];
		expect(istAnwesend(folge, '2026-09-15T20:00:00.000Z')).toBe(true);
		expect(istAnwesend(folge, '2026-09-15T20:30:00.000Z')).toBe(false);
		expect(istAnwesend(folge)).toBe(false);
	});

	it('sortiert nach Zeitpunkt, nicht nach Eingabereihenfolge', () => {
		const verdreht = [
			e('verlassen', '2026-09-15T20:15:00.000Z'),
			e('eingetroffen', '2026-09-15T18:00:00.000Z')
		];
		expect(standVon(verdreht)?.zustand).toBe('gegangen');
	});

	it('behält den Erfassungsweg des letzten Ereignisses', () => {
		expect(standVon([e('eingetroffen', '2026-09-15T18:00:00.000Z', 'von_hand')])?.weg).toBe(
			'von_hand'
		);
	});
});

describe('Anmelden ist keine Anwesenheit', () => {
	it('setzt den Zustand auf wartend', () => {
		expect(standVon([e('angemeldet', '2026-09-15T18:00:00.000Z', 'selbst')])?.zustand).toBe(
			'wartet'
		);
	});

	it('zählt nicht als anwesend', () => {
		// Sonst könnte sich jeder mit einem Zugangscode selbst stimmberechtigt
		// machen.
		expect(istAnwesend([e('angemeldet', '2026-09-15T18:00:00.000Z', 'selbst')])).toBe(false);
	});

	it('wirft einen bereits Bestätigten nicht in die Warteliste zurück', () => {
		// Sonst verlöre er seine Stimmberechtigung, indem er seinen eigenen Link
		// noch einmal öffnet.
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('angemeldet', '2026-09-15T18:05:00.000Z', 'selbst')
		]);
		expect(s?.zustand).toBe('anwesend');
	});

	it('setzt nach Ablehnung auf nicht erschienen zurück', () => {
		const s = standVon([
			e('angemeldet', '2026-09-15T18:00:00.000Z', 'selbst'),
			e('abgelehnt', '2026-09-15T18:02:00.000Z', 'von_hand')
		]);
		expect(s?.zustand).toBe('nicht_erschienen');
	});

	it('lässt einen bereits Anwesenden von einer Ablehnung unberührt', () => {
		const s = standVon([
			e('eingetroffen', '2026-09-15T18:00:00.000Z'),
			e('abgelehnt', '2026-09-15T18:02:00.000Z', 'von_hand')
		]);
		expect(s?.zustand).toBe('anwesend');
	});
});

describe('Übergänge', () => {
	const erfassung = {
		meetingId: 'v-1',
		parteiId: 'p-1',
		name: 'Anna Muster',
		weg: 'gescannt' as const
	};

	it('bestätigt das Eintreffen und schreibt es in den Verlauf', () => {
		const u = bestaetigeEintreffen([], erfassung);
		expect(u.ergebnis.neu).toBe(true);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.anwesenheitBestaetigt);
	});

	it('erzeugt beim zweiten Scan kein zweites Ereignis', () => {
		// Am Eingang ist der zweite Scan ein Versehen. Ein zweites Ereignis gäbe
		// der Frage «wann kam er» zwei Antworten.
		const u = bestaetigeEintreffen([e('eingetroffen', '2026-09-15T18:00:00.000Z')], erfassung);
		expect(u.ergebnis.neu).toBe(false);
		expect(u.ereignisse).toHaveLength(0);
	});

	it('vermerkt, ob die Sitzungsleitung erfasst hat', () => {
		expect(
			bestaetigeEintreffen([], { ...erfassung, weg: 'von_hand' }).ereignisse[0].angaben
				?.durchSitzungsleitung
		).toBe(true);
		expect(
			bestaetigeEintreffen([], { ...erfassung, weg: 'selbst' }).ereignisse[0].angaben
				?.durchSitzungsleitung
		).toBe(false);
		/*
		 * **`authentik` gehört dazu** (24.08.2026). Die Bedingung lautete
		 * `weg !== 'selbst'` und meldete deshalb «durch die Sitzungsleitung» für
		 * jemanden, der sich über sein eigenes Konto angemeldet hat. Eine
		 * Aufzählung, bei der ein Fall vergessen ging — dieselbe Klasse wie beim
		 * Weg selbst, nur kleiner.
		 */
		expect(
			bestaetigeEintreffen([], { ...erfassung, weg: 'authentik' }).ereignisse[0].angaben
				?.durchSitzungsleitung
		).toBe(false);
	});

	/*
	 * **Der Weg, den niemand behauptet hat** (Auftraggeber, 24.08.2026: «beheben»).
	 *
	 * Wer den Knopf «Freigeben» am wartenden Eintrag drückt, sagt nichts darüber,
	 * WIE die Person hereinkam — er bestätigt eine Anmeldung, die sie selbst vom
	 * eigenen Telefon gemacht hat. Die Vorgabe war `gescannt`, und im Verlauf
	 * stand danach «Karte gescannt» für jemanden, der nie eine Karte in der Hand
	 * hatte. An allen drei Sichten gleich falsch.
	 */
	describe('Der Weg beim Freigeben einer Anmeldung', () => {
		const wartet = (weg: Erfassungsweg) => [e('angemeldet', '2026-09-15T18:00:00.000Z', weg)];

		it('behält den Weg der Selbstanmeldung, wenn keiner genannt wird', () => {
			const u = bestaetigeEintreffen(wartet('selbst'), { ...erfassung, weg: undefined });
			expect(u.ergebnis.weg).toBe('selbst');
			expect(u.ereignisse[0].angaben?.weg).toBe('selbst');
			expect(u.ereignisse[0].angaben?.durchSitzungsleitung).toBe(false);
		});

		it('behält auch den Weg über das eigene Konto', () => {
			const u = bestaetigeEintreffen(wartet('authentik'), { ...erfassung, weg: undefined });
			expect(u.ergebnis.weg).toBe('authentik');
			expect(u.ereignisse[0].angaben?.weg).toBe('authentik');
		});

		it('nimmt ohne Anmeldung und ohne Angabe «von Hand» an, nicht «gescannt»', () => {
			// Wer eine Zeile aus eigenem Antrieb erfasst, erfasst sie von Hand.
			// «Gescannt» wäre eine Behauptung über ein Stück Papier.
			const u = bestaetigeEintreffen([], { ...erfassung, weg: undefined });
			expect(u.ergebnis.weg).toBe('von_hand');
			expect(u.ereignisse[0].angaben?.durchSitzungsleitung).toBe(true);
		});

		it('lässt eine ausdrückliche Angabe vorgehen', () => {
			// Die Person hat sich angemeldet UND legt am Eingang die Karte vor.
			// Wer etwas behauptet, wird beim Wort genommen.
			const u = bestaetigeEintreffen(wartet('selbst'), { ...erfassung, weg: 'gescannt' });
			expect(u.ergebnis.weg).toBe('gescannt');
		});

		it('lässt den Weg des ersten Eintreffens stehen, wenn schon jemand anwesend ist', () => {
			const u = bestaetigeEintreffen(
				[e('eingetroffen', '2026-09-15T18:00:00.000Z', 'liste')],
				{ ...erfassung, weg: undefined }
			);
			expect(u.ergebnis.neu).toBe(false);
			expect(u.ergebnis.weg).toBe('liste');
		});
	});

	it('meldet an, ohne Anwesenheit zu erzeugen', () => {
		const u = meldeAn([], { ...erfassung, weg: 'selbst' });
		expect(u.ergebnis.zustand).toBe('wartet');
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.anwesenheitAngemeldet);
	});

	it('meldet einen bereits Anwesenden nicht noch einmal an', () => {
		const u = meldeAn([e('eingetroffen', '2026-09-15T18:00:00.000Z')], erfassung);
		expect(u.ergebnis.zustand).toBe('anwesend');
		expect(u.ereignisse).toHaveLength(0);
	});

	it('trägt einen bereits Wartenden nicht doppelt ein', () => {
		// Sonst stünde dieselbe Person mehrfach in der Warteliste, und die
		// Sitzungsleitung gäbe sie zweimal frei.
		const u = meldeAn([e('angemeldet', '2026-09-15T18:00:00.000Z', 'selbst')], erfassung);
		expect(u.ereignisse).toHaveLength(0);
	});

	it('lehnt nur ab, wer wartet', () => {
		expect(() => lehneAb([], erfassung)).toThrow(/nicht in der Warteliste/);
		const u = lehneAb([e('angemeldet', '2026-09-15T18:00:00.000Z', 'selbst')], erfassung, 'Kein Eigentümer');
		expect(u.ereignisse[0].angaben?.grund).toBe('Kein Eigentümer');
	});

	it('erfasst das Verlassen nur bei Anwesenheit', () => {
		expect(() => erfasseVerlassen([], erfassung)).toThrow(FachlicherFehler);
		const u = erfasseVerlassen([e('eingetroffen', '2026-09-15T18:00:00.000Z')], erfassung);
		expect(u.ereignisse[0].art).toBe(EREIGNISARTEN.anwesenheitVerlassen);
	});

	it('nimmt die Begründung in den Verlaufseintrag', () => {
		// Sie ist nicht nur Maske: Wer im Verlauf liest, dass jemand gegangen
		// ist, soll auch lesen, warum (Befund 03.10.2026, Punkt 8).
		const u = erfasseVerlassen([e('eingetroffen', '2026-09-15T18:00:00.000Z')], {
			...erfassung,
			bemerkung: 'Arzttermin'
		});
		expect(u.ereignisse[0].angaben?.grund).toBe('Arzttermin');
	});
});

describe('Übersicht auf der Momentaufnahme', () => {
	it('zählt Kopfstimmen und Wertquoten der Anwesenden', () => {
		const u = uebersicht(momentaufnahme(), [
			e('eingetroffen', '2026-09-15T18:00:00.000Z', 'gescannt', 'p-1')
		]);
		expect(u.kopfstimmenAnwesend).toBe(1);
		expect(u.quotenAnwesend).toBe(600);
		expect(u.kopfstimmenGesamt).toBe(2);
		expect(u.gesamtquote).toBe(1000);
	});

	it('führt jede Partei auf, auch die nicht erschienenen', () => {
		const u = uebersicht(momentaufnahme(), []);
		expect(u.staende).toHaveLength(2);
		expect(u.staende.every((s) => s.zustand === 'nicht_erschienen')).toBe(true);
		expect(u.anzahlAnwesend).toBe(0);
		expect(u.anzahlGesamt).toBe(2);
	});

	it('trennt Wartende von Anwesenden', () => {
		const u = uebersicht(momentaufnahme(), [
			e('eingetroffen', '2026-09-15T18:00:00.000Z', 'gescannt', 'p-1'),
			e('angemeldet', '2026-09-15T18:05:00.000Z', 'selbst', 'p-2')
		]);
		expect(u.anwesendeParteiIds).toEqual(['p-1']);
		expect(u.wartendeParteiIds).toEqual(['p-2']);
		// Wer wartet, zählt für nichts.
		expect(u.kopfstimmenAnwesend).toBe(1);
	});

	it('nimmt die Wertquoten aus dem Nenner, nicht aus der Summe der Einheiten', () => {
		// «Die Hälfte aller Anteile» meint 500 von 1000, auch wenn erst 998
		// erfasst sind.
		const m = momentaufnahme();
		m.totalQuota = 1200;
		expect(uebersicht(m, []).gesamtquote).toBe(1200);
	});

	it('rechnet zum Stichzeitpunkt', () => {
		const folge = [
			e('eingetroffen', '2026-09-15T18:00:00.000Z', 'gescannt', 'p-1'),
			e('verlassen', '2026-09-15T20:15:00.000Z', 'von_hand', 'p-1')
		];
		expect(uebersicht(momentaufnahme(), folge, '2026-09-15T20:00:00.000Z').kopfstimmenAnwesend).toBe(1);
		expect(uebersicht(momentaufnahme(), folge).kopfstimmenAnwesend).toBe(0);
	});

	it('zählt bei der Zählung je Einheit anders', () => {
		const m = momentaufnahme();
		m.headCountMode = 'per_unit';
		m.parties[0].units.push({
			unitId: 'u-3',
			label: 'Whg 3',
			kind: 'unit',
			countsAsHead: true,
			quota: 0
		});
		const u = uebersicht(m, [e('eingetroffen', '2026-09-15T18:00:00.000Z', 'gescannt', 'p-1')]);
		expect(u.kopfstimmenAnwesend).toBe(2);
	});
});

describe('Beschriftungen', () => {
	it('beschriftet jeden Zustand und jeden Weg lesbar', () => {
		for (const z of Object.values(ZUSTANDSNAMEN)) expect(z.length).toBeGreaterThan(5);
		for (const w of Object.values(WEGNAMEN)) expect(w.length).toBeGreaterThan(5);
	});

	it('kennzeichnet, wessen Stimmen die Sitzungsleitung erfasst', () => {
		expect(stimmtUeberSitzungsleitung('von_hand')).toBe(true);
		expect(stimmtUeberSitzungsleitung('liste')).toBe(true);
		expect(stimmtUeberSitzungsleitung('gescannt')).toBe(false);
		expect(stimmtUeberSitzungsleitung('selbst')).toBe(false);
		expect(stimmtUeberSitzungsleitung(null)).toBe(false);
	});
});

/**
 * Die doppelte Kachel am Eingang (11.09.2026, vom Auftraggeber im Eingangstest
 * gefunden).
 *
 * Wer seinen QR selbst abscannt, steht angemeldet im Kasten «Am Eingang»; legt
 * er danach dieselbe Karte am Tisch vor, entstand daneben eine zweite Kachel mit
 * einem zweiten Knopfpaar. Produktentscheid: Oben gewinnt.
 */
describe('ohneKontrollkarte', () => {
	const wartende = [
		{ parteiId: 'a', name: 'Ammann' },
		{ parteiId: 'b', name: 'Berger' }
	];

	it('nimmt den heraus, der oben als Kontrollkarte steht', () => {
		expect(ohneKontrollkarte(wartende, { parteiId: 'b' })).toEqual([
			{ parteiId: 'a', name: 'Ammann' }
		]);
	});

	it('lässt die Liste stehen, wenn keine Karte gescannt wurde', () => {
		// Der Regelfall: Ohne Scan gibt es keine Kachel oben, und dann darf unten
		// nichts fehlen.
		expect(ohneKontrollkarte(wartende, null)).toEqual(wartende);
		expect(ohneKontrollkarte(wartende, undefined)).toEqual(wartende);
	});

	it('lässt die Liste stehen, wenn die gescannte Partei gar nicht wartet', () => {
		// Der häufigste Fall überhaupt: Wer eine Karte vorlegt, hat sich meistens
		// nicht vorher selbst angemeldet.
		expect(ohneKontrollkarte(wartende, { parteiId: 'c' })).toEqual(wartende);
	});
});
