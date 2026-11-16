/**
 * Wann eine Versammlung zu einer gemeinsamen Versammlung dazugehören darf.
 *
 * **Die Absage ist keine Meinung dieser Datei**, sondern eine Schranke der
 * Datenbank (`meeting_tag_je_gemeinschaft`, Migration 028). Der Kern sagt sie
 * vorher und nennt den Ausweg; ohne ihn fiel sie am 11.08.2026 als 500er auf den
 * Benutzer — «duplicate key value violates unique constraint», mitten im Saal.
 *
 * Der Umzug aus einer anderen gemeinsamen Versammlung dagegen ist erlaubt, aber
 * nicht wortlos: Vorher wurde die Versammlung dort still herausgerissen.
 */
import { describe, expect, it } from 'vitest';
import { pruefeAufnahme, type Aufnahmelage } from '$lib/domain/zuordnung';

const LAGE = (ueber: Partial<Aufnahmelage> = {}): Aufnahmelage => ({
	versammlung: {
		id: 'v1',
		stwegId: 's1',
		gemeinschaft: 'Nirgendweg 5/5a',
		art: 'ordentlich',
		stufe: 'erste',
		zustand: 'entwurf',
		datum: '2026-09-04',
		ort: 'Halle der Proben',
		gehoertZu: null
	},
	ziel: { id: 't1', datum: '2026-09-04', ort: 'Halle der Proben' },
	schonDrin: [],
	...ueber
});

const ANDERE = (ueber: Partial<Aufnahmelage['schonDrin'][number]> = {}) => ({
	id: 'v9',
	art: 'ordentlich' as const,
	stufe: 'erste' as const,
	datum: '2026-09-04',
	...ueber
});

describe('pruefeAufnahme', () => {
	it('nimmt eine Versammlung wortlos auf, wenn nichts dagegensteht', () => {
		const b = pruefeAufnahme(LAGE());
		expect(b.erlaubt).toBe(true);
		expect(b.bestaetigung).toBeUndefined();
		expect(b.hinweise).toEqual([]);
	});

	it('weist ab, wenn die Gemeinschaft schon mittagt — mit Grund und Ausweg', () => {
		const b = pruefeAufnahme(LAGE({ schonDrin: [ANDERE()] }));
		expect(b.erlaubt).toBe(false);
		expect(b.grund).toContain('tagt hier schon mit');
		expect(b.grund).toContain('Beschlussfähigkeiten');
		// Eine Absage ohne Ausweg ist eine Sackgasse.
		expect(b.grund).toContain('Lösen Sie die bestehende');
	});

	it('sagt, welche Versammlung im Weg steht — Art, Stufe und Tag', () => {
		const b = pruefeAufnahme(
			LAGE({ schonDrin: [ANDERE({ art: 'ausserordentlich', stufe: 'zweite', datum: '2026-08-30' })] })
		);
		expect(b.grund).toContain('ausserordentliche');
		expect(b.grund).toContain('Zweitversammlung');
		expect(b.grund).toContain('2026-08-30');
	});

	it('weist auch eine andere Art und eine andere Stufe ab', () => {
		// Die Schranke der Datenbank kennt weder Art noch Stufe: ein eindeutiger
		// Index über (meeting_day_id, stweg_id). Wer hier eine Ausnahme einbaut,
		// erzeugt einen 500er statt einer Absage.
		for (const abweichung of [{ art: 'ausserordentlich' as const }, { stufe: 'zweite' as const }]) {
			const b = pruefeAufnahme(
				LAGE({ versammlung: { ...LAGE().versammlung, ...abweichung }, schonDrin: [ANDERE()] })
			);
			expect(b.erlaubt, JSON.stringify(abweichung)).toBe(false);
		}
	});

	it('stolpert nicht über sich selbst — dieselbe Versammlung erneut aufnehmen', () => {
		const b = pruefeAufnahme(LAGE({ schonDrin: [ANDERE({ id: 'v1' })] }));
		expect(b.erlaubt).toBe(true);
		expect(b.bestaetigung).toBeUndefined();
	});

	it('sagt, dass die Versammlung anderswo herausgenommen wird', () => {
		const b = pruefeAufnahme(
			LAGE({
				versammlung: {
					...LAGE().versammlung,
					gehoertZu: { id: 't9', bezeichnung: 'Versammlung Nirgendwerk' }
				}
			})
		);
		expect(b.erlaubt).toBe(true);
		expect(b.bestaetigung).toContain('Nirgendwerk');
		expect(b.bestaetigung).toContain('herausgenommen');
	});

	it('schweigt, wenn sie schon zu genau dieser gemeinsamen Versammlung gehört', () => {
		const b = pruefeAufnahme(
			LAGE({
				versammlung: { ...LAGE().versammlung, gehoertZu: { id: 't1', bezeichnung: 'Dieselbe' } }
			})
		);
		expect(b.bestaetigung).toBeUndefined();
	});

	/*
	 * Seit dem 25.08.2026 gibt die gemeinsame Versammlung Tag und Ort vor (Auftraggeber:
	 * «Die Gruppe gibt die Einstellungen für die angehängten Einheiten vor»).
	 * Vorher blieb beides stehen — und genau daran liefen sechs Versammlungen
	 * mit sechs Terminen auseinander, obwohl es einen gab.
	 */
	it('sagt bei einem Entwurf, dass Tag und Ort übernommen werden', () => {
		const b = pruefeAufnahme(
			LAGE({ versammlung: { ...LAGE().versammlung, datum: '2026-09-30', ort: 'Anderswo' } })
		);
		expect(b.erlaubt).toBe(true);
		expect(b.hinweise).toHaveLength(1);
		expect(b.hinweise[0]).toContain('übernommen');
		expect(b.hinweise[0]).toContain('2026-09-30');
		expect(b.hinweise[0]).toContain('Anderswo');
	});

	/*
	 * Die andere Hälfte, und die wiegt schwerer: Ab der Freigabe steht der Tag
	 * in versandten Einladungen. Ein Hinweis, der «wird übernommen» behauptet
	 * und dann nichts tut, ist schlimmer als gar keiner.
	 */
	it('sagt bei einer freigegebenen, dass es stehen bleibt — mit Grund', () => {
		const b = pruefeAufnahme(
			LAGE({
				versammlung: {
					...LAGE().versammlung,
					zustand: 'freigegeben',
					datum: '2026-09-30',
					ort: 'Anderswo'
				}
			})
		);
		expect(b.erlaubt).toBe(true);
		expect(b.hinweise[0]).toContain('bleibt stehen');
		expect(b.hinweise[0]).toContain('Einladungen');
		expect(b.hinweise[0]).not.toContain('übernommen');
	});

	it('hält Gross-, Klein- und Leerzeichen im Ort nicht für einen Unterschied', () => {
		const b = pruefeAufnahme(
			LAGE({ versammlung: { ...LAGE().versammlung, ort: '  halle   der proben ' } })
		);
		expect(b.hinweise).toEqual([]);
	});
});
