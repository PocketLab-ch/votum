/**
 * Der Satz zur Zustimmung Betroffener in Auswertung und PDF, Nutzungsrechte
 * (ZGB Art. 712g Abs. 4; Block A2, Laien- und Fachprüfung 25.09.2026).
 *
 * Je ein Fall aus der Prüfdatei
 * (`quellen/pruefung/zu-pruefen-2026-09-25-betroffene-a2.md`, V2 a bis d),
 * dazu der Widerruf durch die Vertretung. Geprüft wird der Wortlaut, weil er
 * nach aussen geht und so geprüft wurde.
 */
import { describe, expect, it } from 'vitest';
import {
	ausstandUndBetroffenHinweis,
	NICHT_IM_STAND,
	zustimmungImSaalOderVorabInWorten,
	type Betroffenenbefund
} from '$lib/domain/auszaehlung';

function befund(u: Partial<Betroffenenbefund> = {}): Betroffenenbefund {
	return {
		noetig: true,
		form: 'im_saal_oder_vorab',
		zugestimmt: [],
		fehlend: [],
		vorab: [],
		ausstehend: [],
		veto: [],
		erfuellt: true,
		...u
	};
}

const SCHREIBEN = { parteiId: 'p1', name: 'Partei Wohnung 1', vermerk: 'Schreiben vom 12.09.2026' };

describe('Zustimmung im Saal oder vorab, in Worten', () => {
	it('a) alle im Saal zugestimmt, kein Vermerk', () => {
		expect(zustimmungImSaalOderVorabInWorten(befund({ zugestimmt: ['p1'] }), [])).toBe(
			'Die Zustimmung aller unmittelbar Betroffenen liegt vor.'
		);
	});

	it('sagt ausdrücklich, wenn niemand erfasst ist', () => {
		/*
		 * Produktentscheid 04.10.2026 (Prüfdatei
		 * `quellen/pruefung/zu-pruefen-2026-10-04-647d-betroffene.md`, E4): Ein
		 * vergessener Eintrag soll nicht wie eine geprüfte Aussage aussehen.
		 */
		expect(zustimmungImSaalOderVorabInWorten(befund(), [])).toBe(
			'Als unmittelbar betroffen ist niemand erfasst.'
		);
	});

	it('b) zugestimmt über den Vermerk', () => {
		expect(
			zustimmungImSaalOderVorabInWorten(befund({ zugestimmt: ['p1'], vorab: ['p1'] }), [SCHREIBEN])
		).toBe(
			'Die Zustimmung aller unmittelbar Betroffenen liegt vor. Vorab schriftlich zugestimmt: ' +
				'Partei Wohnung 1 (laut Sitzungsleitung: Schreiben vom 12.09.2026).'
		);
	});

	it('c) Vermerk, dann Nein im Saal', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [{ parteiId: 'p1', name: 'Partei Wohnung 1', grund: 'widerrufen' }]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [SCHREIBEN])).toBe(
			'Es fehlt die Zustimmung von Partei Wohnung 1: Sie hatte vorab schriftlich zugestimmt ' +
				'(laut Sitzungsleitung: Schreiben vom 12.09.2026), im Saal aber Nein gesagt. Die ' +
				'Auswertung zählt das spätere Nein; die schriftliche Zustimmung zählt damit nicht mehr.'
		);
		// Kam das Nein von der Vertretung, sagt der Satz das (Fachprüfung, V2 c).
		expect(
			zustimmungImSaalOderVorabInWorten(b, [{ ...SCHREIBEN, durchVertretung: true }])
		).toContain('durch ihre Vertretung im Saal aber Nein gesagt');
	});

	it('d) zwei Betroffene, eine mit Vermerk, eine enthält sich', () => {
		const b = befund({
			erfuellt: false,
			zugestimmt: ['p1'],
			vorab: ['p1'],
			fehlend: [{ parteiId: 'p2', name: 'Partei Wohnung 2', grund: 'enthaltung' }]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [SCHREIBEN])).toBe(
			'Es fehlt die Zustimmung von Partei Wohnung 2 (im Saal der Stimme enthalten). Vorab schriftlich ' +
				'zugestimmt: Partei Wohnung 1 (laut Sitzungsleitung: Schreiben vom 12.09.2026).'
		);
	});

	it('gibt einer Partei ausserhalb des Stands keinen Grund, den Votum nicht kennt', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [{ parteiId: 'x', name: NICHT_IM_STAND, grund: 'nicht_anwesend' }]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [])).toBe(
			'Eine als unmittelbar betroffen bezeichnete Partei steht nicht im festgehaltenen Stand der ' +
				'Stimmberechtigten; ihre Zustimmung liess sich nicht prüfen, und die Auswertung zählt sie ' +
				'als fehlend. Zustimmen muss, wer das betroffene Recht bei der Beschlussfassung innehat.'
		);
	});

	it('nennt die Partei ausserhalb des Stands getrennt, nicht als Beifügung eines Namens', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [
				{ parteiId: 'p2', name: 'Partei Wohnung 2', grund: 'nein' },
				{ parteiId: 'x', name: NICHT_IM_STAND, grund: 'nicht_anwesend' }
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [])).toBe(
			'Es fehlt die Zustimmung von Partei Wohnung 2 (im Saal Nein gesagt). Ausserdem steht eine ' +
				'als unmittelbar betroffen bezeichnete Partei nicht im festgehaltenen Stand der ' +
				'Stimmberechtigten; ihre Zustimmung liess sich nicht prüfen, und die Auswertung zählt sie ' +
				'als fehlend. Zustimmen muss, wer das betroffene Recht bei der Beschlussfassung innehat.'
		);
	});

	it('nennt nach einem Widerruf die übrigen Fehlenden mit «ausserdem»', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [
				{ parteiId: 'p1', name: 'Partei Wohnung 1', grund: 'widerrufen' },
				{ parteiId: 'p2', name: 'Partei Wohnung 2', grund: 'nicht_anwesend' }
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [SCHREIBEN])).toMatch(
			/zählt damit nicht mehr\. Es fehlt ausserdem die Zustimmung von Partei Wohnung 2 \(nicht anwesend und nicht vertreten\)\.$/
		);
	});

	it('nennt eine Zustimmung über das Veto im Ausstand, mit dem Weg', () => {
		/*
		 * Auftrag «Veto im Ausstand» (26.09.2026). Ohne diesen Satz stünde in
		 * der Auswertung nur, dass die Zustimmung vorliegt, nicht woher sie
		 * kam — im Ausstand gibt es keine Stimme, die sie trüge.
		 */
		const b = befund({
			zugestimmt: ['p1'],
			veto: [
				{
					parteiId: 'p1',
					name: 'Partei Wohnung 1',
					entscheid: 'ja',
					weg: 'telefon',
					durchVertretung: false
				}
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [])).toBe(
			'Die Zustimmung aller unmittelbar Betroffenen liegt vor. Zustimmung im Ausstand: ' +
				'Partei Wohnung 1 (am eigenen Gerät).'
		);
	});

	it('nennt ein Veto-Nein als fehlend, mit dem Weg', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [{ parteiId: 'p1', name: 'Partei Wohnung 1', grund: 'veto_nein' }],
			veto: [
				{
					parteiId: 'p1',
					name: 'Partei Wohnung 1',
					entscheid: 'nein',
					weg: 'leitung',
					durchVertretung: false
				}
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [])).toBe(
			'Es fehlt die Zustimmung von Partei Wohnung 1 (im Ausstand; hat ausdrücklich nicht zugestimmt, ' +
				'mündlich, von der Sitzungsleitung erfasst).'
		);
	});

	it('sagt beim Widerruf durch ein Veto, auf welchem Weg das Nein kam', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [{ parteiId: 'p1', name: 'Partei Wohnung 1', grund: 'widerrufen' }],
			veto: [
				{
					parteiId: 'p1',
					name: 'Partei Wohnung 1',
					entscheid: 'nein',
					weg: 'telefon',
					durchVertretung: true
				}
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [SCHREIBEN])).toBe(
			'Es fehlt die Zustimmung von Partei Wohnung 1: Sie hatte vorab schriftlich zugestimmt ' +
				'(laut Sitzungsleitung: Schreiben vom 12.09.2026), im Ausstand aber nicht zugestimmt (durch ihre ' +
				'Vertretung). Die ' +
				'Auswertung zählt das spätere Nein; die schriftliche Zustimmung zählt damit nicht mehr.'
		);
	});
});

describe('Widerruf über ein mündlich erfasstes Veto', () => {
	it('bleibt ein ganzer Satz (Codeprüfung 26.09.2026, vierter Durchgang)', () => {
		const b = befund({
			erfuellt: false,
			fehlend: [{ parteiId: 'p1', name: 'Partei Wohnung 1', grund: 'widerrufen' }],
			veto: [
				{
					parteiId: 'p1',
					name: 'Partei Wohnung 1',
					entscheid: 'nein',
					weg: 'leitung',
					durchVertretung: false
				}
			]
		});
		expect(zustimmungImSaalOderVorabInWorten(b, [SCHREIBEN])).toContain(
			'im Ausstand aber nicht zugestimmt (mündlich, von der Sitzungsleitung erfasst). '
		);
	});
});

describe('Hinweis vor der Abstimmung, betroffen und im Ausstand', () => {
	it('schweigt ohne Überschneidung und nennt sonst Prüfung und nächsten Schritt', () => {
		expect(ausstandUndBetroffenHinweis([])).toBeNull();
		const h = ausstandUndBetroffenHinweis(['Partei Wohnung 1']) ?? '';
		expect(h).toMatch(/^«Partei Wohnung 1» ist im Ausstand/);
		expect(h).toMatch(/nehmen Sie den Ausstand zurück, bevor abgestimmt wird; dann stimmt sie mit/);
		expect(h).toMatch(/erfassen Sie den Entscheid dann unter «Veto»/);
		expect(ausstandUndBetroffenHinweis(['A', 'B'])).toMatch(/sind im Ausstand .* stimmen sie mit und können/);
	});
});
