/**
 * Der gemeinsame Pausenstand — der Wächter über die Klasse «Einigkeit nicht am
 * Zeitstempel messen».
 *
 * Der Befund vom 01.09.2026: Zwei Häuser wurden mit einem Knopfdruck
 * unterbrochen, bekamen aber je einen eigenen `now()` aus je einer eigenen
 * Transaktion. Der Vergleich über die Zeitstempel hielt sie deshalb für
 * uneinig, die Seite zeigte keine Pause, und «Fortfahren» erschien nie —
 * während die Wand längst «Pause» zeigte und niemand mehr abstimmen konnte.
 *
 * Der erste Test unten wird ohne den Fix rot: Er gibt genau zwei Zeitstempel,
 * die eine Mikrosekunde auseinanderliegen.
 */
import { describe, expect, it } from 'vitest';
import { gemeinsamePause } from '$lib/domain/pausenstand';

const laeuft = (pause: { seit: string; text?: string | null } | null = null) => ({
	zustand: 'laufend',
	pause
});

describe('gemeinsamePause', () => {
	it('erkennt die Pause, obwohl die Zeitstempel der Häuser auseinandergehen', () => {
		const stand = gemeinsamePause([
			laeuft({ seit: '2026-05-19T17:31:02.481Z', text: 'Weiter um 17:50' }),
			laeuft({ seit: '2026-05-19T17:31:02.517Z', text: 'Weiter um 17:50' }),
			laeuft({ seit: '2026-05-19T17:31:02.603Z', text: 'Weiter um 17:50' })
		]);
		expect(stand.pause).not.toBeNull();
		expect(stand.einig).toBe(true);
	});

	it('nimmt die früheste Unterbrechung, mit ihrem Text', () => {
		const stand = gemeinsamePause([
			laeuft({ seit: '2026-05-19T17:31:02.603Z', text: 'zweiter' }),
			laeuft({ seit: '2026-05-19T17:31:02.481Z', text: 'erster' })
		]);
		expect(stand.pause?.seit).toBe('2026-05-19T17:31:02.481Z');
		expect(stand.pause?.text).toBe('erster');
	});

	it('meldet keine Pause und keine Uneinigkeit, solange alle laufen', () => {
		expect(gemeinsamePause([laeuft(), laeuft(), laeuft()])).toEqual({ pause: null, einig: true });
	});

	/**
	 * **Der Fall, für den der Hinweis auf der Seite da ist.** Ein Haus wurde
	 * einzeln unterbrochen, das andere läuft. Die Pause gilt trotzdem — die Wand
	 * zeigt sie, und dort kann niemand mehr abstimmen —, aber die Seite sagt
	 * dazu, dass die Häuser auseinanderliegen.
	 */
	it('zeigt die Pause auch bei gemischtem Stand, meldet sie aber als uneinig', () => {
		const stand = gemeinsamePause([
			laeuft({ seit: '2026-05-19T17:31:02.481Z', text: null }),
			laeuft()
		]);
		expect(stand.pause?.seit).toBe('2026-05-19T17:31:02.481Z');
		expect(stand.einig).toBe(false);
	});

	/**
	 * **Ein geschlossenes Haus hat keine Pause.** `paused_at` bleibt beim
	 * Schliessen stehen — nichts löscht ihn. Zählte das Haus mit, hinge die
	 * Pause nach dem Schluss für immer an der Wand, und lösen liesse sie sich
	 * nicht: `setzePause` verlangt den Zustand «laufend».
	 */
	it('lässt ein geschlossenes Haus mit stehengebliebener Pause aussen vor', () => {
		const stand = gemeinsamePause([
			{ zustand: 'geschlossen', pause: { seit: '2026-05-19T17:31:02.481Z', text: 'Weiter um 17:50' } },
			laeuft()
		]);
		expect(stand).toEqual({ pause: null, einig: true });
	});

	it('hält einen Abend ohne laufendes Haus für einig', () => {
		expect(gemeinsamePause([{ zustand: 'vorbereitung', pause: null }])).toEqual({
			pause: null,
			einig: true
		});
		expect(gemeinsamePause([])).toEqual({ pause: null, einig: true });
	});
});
