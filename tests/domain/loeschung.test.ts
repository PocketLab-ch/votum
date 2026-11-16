/**
 * Wann sich eine Versammlung löschen lässt.
 *
 * Der Wächter über zwei Dinge: dass die Absage **immer** einen Ausweg nennt,
 * und dass die Rückfrage sagt, was verschwindet. Eine Rückfrage ohne Inhalt
 * wird weggeklickt, und eine Absage ohne Ausweg lässt den Benutzer stehen — so
 * entstand am 11.08.2026 die Frage, ob man denn wenigstens das Datum löschen
 * könne.
 */
import { describe, expect, it } from 'vitest';
import { pruefeLoeschung, type Loeschlage } from '$lib/domain/loeschung';

const LAGE = (ueber: Partial<Loeschlage> = {}): Loeschlage => ({
	zustand: 'entwurf',
	bezeichnung: 'Nirgendweg 5/5a, 4. September 2026',
	folgeversammlungen: [],
	gemeinsam: null,
	haengtDran: { traktanden: 0, dateien: 0 },
	...ueber
});

describe('pruefeLoeschung', () => {
	it('erlaubt das Löschen einer Versammlung im Entwurf', () => {
		const b = pruefeLoeschung(LAGE());
		expect(b.erlaubt).toBe(true);
		expect(b.grund).toBeUndefined();
		expect(b.folgen).toContain('Nirgendweg 5/5a');
		expect(b.folgen).toContain('nicht rückgängig');
	});

	it('nennt, was mit verschwindet — und zählt richtig', () => {
		const b = pruefeLoeschung(LAGE({ haengtDran: { traktanden: 7, dateien: 1 } }));
		expect(b.folgen).toContain('7 Traktanden');
		expect(b.folgen).toContain('1 Datei');
		expect(b.folgen).not.toContain('1 Dateien');
	});

	it('sagt es auch im Singular richtig', () => {
		const b = pruefeLoeschung(LAGE({ haengtDran: { traktanden: 1, dateien: 0 } }));
		expect(b.folgen).toContain('1 Traktandum');
	});

	it('sagt, dass sie aus der gemeinsamen Versammlung wegfällt', () => {
		const b = pruefeLoeschung(LAGE({ gemeinsam: 'Versammlung Nirgendwerk' }));
		expect(b.folgen).toContain('Nirgendwerk');
		expect(b.folgen).toContain('fällt dort weg');
	});

	it('weist ab Freigabe ab — mit dem Weg zurück', () => {
		const b = pruefeLoeschung(LAGE({ zustand: 'freigegeben' }));
		expect(b.erlaubt).toBe(false);
		expect(b.grund).toContain('Einladungen');
		// Eine Absage ohne Ausweg ist eine Sackgasse.
		expect(b.grund).toContain('Freigabe');
		expect(b.grund).toContain('zurück');
	});

	it('weist eine Versammlung ab, die getagt hat', () => {
		for (const zustand of ['laufend', 'geschlossen', 'versiegelt'] as const) {
			const b = pruefeLoeschung(LAGE({ zustand }));
			expect(b.erlaubt, zustand).toBe(false);
			expect(b.grund, zustand).toContain('Nachweis');
		}
	});

	it('weist ab, solange eine Zweitversammlung darauf verweist', () => {
		const b = pruefeLoeschung(
			LAGE({ folgeversammlungen: [{ id: 'v9', bezeichnung: 'Nirgendweg, 20. September 2026' }] })
		);
		expect(b.erlaubt).toBe(false);
		expect(b.grund).toContain('20. September 2026');
		expect(b.grund).toContain('712p');
		expect(b.grund).toContain('zuerst heraus');
	});

	it('sagt es im Plural, wenn mehrere darauf verweisen', () => {
		const b = pruefeLoeschung(
			LAGE({
				folgeversammlungen: [
					{ id: 'v9', bezeichnung: 'A' },
					{ id: 'v8', bezeichnung: 'B' }
				]
			})
		);
		expect(b.grund).toContain('verweisen');
	});

	it('gibt bei jeder Absage einen Grund und keine leeren Folgen aus', () => {
		for (const lage of [
			LAGE({ zustand: 'geschlossen' }),
			LAGE({ folgeversammlungen: [{ id: 'v9', bezeichnung: 'A' }] })
		]) {
			const b = pruefeLoeschung(lage);
			expect(b.grund && b.grund.length > 40).toBe(true);
			expect(b.folgen).toBe('');
		}
	});
});
