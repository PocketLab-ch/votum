/**
 * Lesart L5 im Kern (Migration 174, Konzept Lesarten Block 7): Katalog, Sätze
 * je Wahl, Fussnote der Einladung und Quittung des Notwegs. Die Sperre selbst
 * prüft `tests/db/lesart-neue-traktanden.test.ts` am echten Weg.
 */
import { describe, expect, it } from 'vitest';
import { L5_DRITTEL_KERN, L5_NICHTIG_UNTER_UMSTAENDEN, LESARTEN_VORGABE, lesartVon, pruefeLesartenwahl, wahlInWorten } from '$lib/domain/lesarten';
import {
	NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL,
	neuAnZweiterGesperrt,
	neuAnZweiterHinweis,
	neuAnZweiterProtokoll,
	L5_OFFEN_ANDERE_LESART,
	L5_OFFEN_DRITTEL
} from '$lib/domain/mehrhinweise';
import { neutraktandenFussnote, NEUTRAKTANDUM_ZEICHEN } from '$lib/domain/einladung';
import { keinBeschlussSatz, wegNachKeinemBeschluss, type KeinBeschluss } from '$lib/domain/ausnahmen';
import { verlangeRueckkommbar } from '$lib/domain/rueckkommen';
import { neueTraktandenDerZweiten } from '$lib/domain/mehrhinweise';
import { neuAnZweiterAnfechtungssatz } from '$lib/domain/protokoll';
import {
	KONSULTATIV_OFFEN_NEU,
	KONSULTATIV_SATZ,
	KONSULTATIV_SATZ_NEU,
	KONSULTATIV_WEG,
	KONSULTATIV_WEG_NEU,
	KONSULTATIV_WERTUNG_NEU
} from '$lib/domain/konsultativ';
import {
	quittungVonHand,
	VON_HAND_FESTGEHALTEN,
	VON_HAND_FESTGEHALTEN_ANFECHTBAR,
	VON_HAND_FESTGEHALTEN_NEU_GESPERRT
} from '$lib/domain/vonhand';

describe('L5 im Katalog', () => {
	it('führt L5 mit der Vorgabe «erste» und zwei Wahlen', () => {
		const l5 = lesartVon('L5');
		expect(l5?.vorgabe).toBe('erste');
		expect(l5?.wahlen.map((w) => w.wert)).toEqual(['erste', 'drittel']);
		expect(LESARTEN_VORGABE.L5).toBe('erste');
		expect(wahlInWorten('L5', 'erste')).toMatch(/\(Vorgabe\)$/);
		expect(wahlInWorten('L5', 'drittel')).not.toMatch(/Vorgabe/);
	});

	it('nimmt die zwei Wahlen an und weist anderes ab', () => {
		expect(pruefeLesartenwahl({ L5: 'drittel' })).toEqual({ L5: 'drittel' });
		expect(() => pruefeLesartenwahl({ L5: 'zweite' })).toThrow(/Unbekannte Wahl/);
	});

	it('nennt bei beiden Wahlen, dass Votum folgert', () => {
		for (const w of lesartVon('L5')!.wahlen) expect(w.fundstelle).toMatch(/das folgert Votum/);
	});
});

describe('L5, der Hinweis auf die Nichtigkeit (F4a, S15, Endfassung; Entscheid 0039)', () => {
	it('nennt an allen vier Orten neben der Anfechtung den schweren Fall', () => {
		const l5 = lesartVon('L5')!;
		const drittel = l5.wahlen.find((w) => w.wert === 'drittel')!;
		// Ort 1: die Wirkung der milden Wahl trägt den Kern.
		expect(drittel.wirkung).toContain(L5_DRITTEL_KERN);
		expect(drittel.wirkung).toMatch(/Votum weist vor der Abstimmung darauf hin\.$/);
		expect(drittel.wirkung).not.toContain('darauf hin, dass die Frage nicht geklärt ist');
		expect(L5_DRITTEL_KERN).toContain('Rz. 33 ad Art. 712p');
		expect(L5_DRITTEL_KERN).toContain('(Rz. 50)');
		expect(L5_DRITTEL_KERN).toContain('Handschin/Wyttenbach');
		// Ort 2: warum die Vorgabe.
		expect(l5.warumVorgabe).toContain(`kann angefochten werden, ${L5_NICHTIG_UNTER_UMSTAENDEN}, und ist oft`);
		// Ort 3: Traktandenseite und Leitung nach der milden Wahl.
		for (const imSaal of [true, false]) {
			expect(neuAnZweiterHinweis('drittel', imSaal)).toContain(L5_OFFEN_DRITTEL);
			// Ort 4: nach der Vorgabe, im Satz zur anderen Lesart.
			expect(neuAnZweiterHinweis('erste', imSaal)).toContain(L5_OFFEN_ANDERE_LESART);
			for (const wahl of ['drittel', 'erste'] as const) {
				expect(neuAnZweiterHinweis(wahl, imSaal)).toMatch(/unter Umständen sogar nichtig sein/);
				expect(neuAnZweiterHinweis(wahl, imSaal)).not.toMatch(/im schweren Fall/);
				expect(neuAnZweiterHinweis(wahl, imSaal)).not.toMatch(/könnte angefochten werden\./);
			}
		}
		// Im Saal folgt wie bisher die Bitte an die Leitung.
		expect(neuAnZweiterHinweis('drittel', true)).toContain(`${L5_OFFEN_DRITTEL} Sagen Sie das der Versammlung vor der Abstimmung.`);
	});
});

describe('L5, die Sätze je Wahl', () => {
	it('nennt bei der milden Wahl die offene Frage und den sicheren Weg, im Saal die fehlende Hälfte', () => {
		for (const imSaal of [true, false]) {
			const s = neuAnZweiterHinweis('drittel', imSaal);
			expect(s).toMatch(/Ob das genügt, ist nicht geklärt/);
			expect(s).toMatch(/anwesend oder vertreten sind wie an einer ersten Versammlung/);
		}
		expect(neuAnZweiterHinweis('drittel', true)).toMatch(/jetzt nicht beschlussfähig wie eine erste/);
		expect(neuAnZweiterHinweis('drittel', false)).not.toMatch(/jetzt nicht/);
	});

	it('sagt der Leitung nach der Vorgabe, dass verbindlich nicht abgestimmt wird', () => {
		const s = neuAnZweiterHinweis('erste', true);
		expect(s).toMatch(/nur verbindlich abstimmen, wenn die Versammlung beschlussfähig ist wie eine erste, und das ist sie jetzt nicht/);
		expect(s).toMatch(/ist aber kein Beschluss/);
		expect(s).toMatch(/in jedem Fall auf die Liste einer späteren Versammlung/);
	});

	// Kriterium 4: auch nach der Vorgabe, was die andere Lesart verlangt
	// (Featureprüfung Lesarten, 22.10.2026).
	it('nennt nach der Vorgabe die andere Lesart mit dem Drittel, im Saal und in der Vorbereitung', () => {
		for (const imSaal of [true, false]) {
			const s = neuAnZweiterHinweis('erste', imSaal);
			expect(s).toContain('Nach der anderen Lesart («Ein Drittel genügt»)');
			expect(s).toContain('ein Drittel der Eigentümer');
			expect(s).toContain('Ob das genügt, ist nicht geklärt');
			expect(s).toContain('die Lesart «Nur wie an einer ersten Versammlung» eingestellt');
		}
		// Nur im Saal: dass eine Umstellung nicht mehr wirkt, die Bedingung der
		// Einladung (Fachprüfung F-3), und die Stelle vor den Handlungen (Laienprüfung L-3).
		const saal = neuAnZweiterHinweis('erste', true);
		expect(saal).toContain('eine Umstellung wirkt erst für die nächste Versammlung');
		expect(saal).toContain('wenn das Geschäft in der Einladung zur zweiten stand');
		expect(saal.indexOf('Nach der anderen Lesart')).toBeLessThan(saal.indexOf('Setzen Sie das Geschäft'));
		const vorbereitung = neuAnZweiterHinweis('erste', false);
		expect(vorbereitung).not.toContain('eine Umstellung wirkt');
		expect(vorbereitung.indexOf('Nach der anderen Lesart')).toBeGreaterThan(
			vorbereitung.indexOf('um eine Vollmacht')
		);
	});

	it('nennt in der Vorbereitung nach der Vorgabe die Ankündigung und die Fussnote', () => {
		const s = neuAnZweiterHinweis('erste', false);
		expect(s).toMatch(/wenn es in der Einladung zur zweiten steht/);
		expect(s).toMatch(/Fussnote/);
		expect(s).toMatch(/um eine Vollmacht/);
		expect(s).not.toBe(neuAnZweiterHinweis('erste', true));
	});

	it('nimmt in die Absage, was fehlt, ohne doppelten Punkt', () => {
		const s = neuAnZweiterGesperrt('Es fehlt eine Eigentümerin.');
		expect(s).toContain('wie eine erste: Es fehlt eine Eigentümerin. Ist jemand im Saal');
		expect(s).toMatch(/Sonst kann die Versammlung unverbindlich abstimmen; das ist kein Beschluss\. Setzen Sie/);
		expect(s).not.toContain('..');
	});

	it('nennt im Protokoll die Wahl, ohne Wahl nur die Tatsache', () => {
		expect(neuAnZweiterProtokoll(null)).toBe(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		expect(neuAnZweiterProtokoll('erste')).toMatch(/ob sie es bei diesem Beschluss war, ist nicht festgehalten\.$/);
		expect(neuAnZweiterProtokoll('erste', false)).toMatch(/; das war sie\.$/);
		// Gegenprobe: nach einem Beschluss von Hand trotz Sperre (Fachprüfung F7-5).
		expect(neuAnZweiterProtokoll('erste', true)).toMatch(/; das war sie bei diesem Beschluss nicht\.$/);
		expect(neuAnZweiterProtokoll('drittel')).toMatch(/Beschlussfähigkeit der zweiten Versammlung/);
		expect(neuAnZweiterProtokoll('drittel')).not.toMatch(/geklärt/);
		// Gegenprobe: erreicht, dann sagt die Zeile das (Fachprüfung Runde 8).
		expect(neuAnZweiterProtokoll('drittel', false)).toMatch(/beschlussfähig wie eine erste\.$/);
		expect(neuAnZweiterProtokoll('drittel', true)).toMatch(/nach Gesetz ein Drittel der Eigentümer\.$/);
		for (const w of ['erste', 'drittel'] as const) {
			expect(neuAnZweiterProtokoll(w).startsWith(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL)).toBe(true);
		}
	});
});

describe('L5, die Fussnote der Einladung', () => {
	it('nennt ohne Regel das Gesetz mit Köpfen und Wertquoten', () => {
		const s = neutraktandenFussnote(null);
		expect(s.startsWith(`${NEUTRAKTANDUM_ZEICHEN} `)).toBe(true);
		expect(s).toContain('anwesend oder vertreten sind wie an einer ersten Versammlung: die Hälfte der Eigentümer, mindestens aber zwei, und die Hälfte der Wertquoten.');
		expect(s).toContain('mit einer Vollmacht vertreten lassen; auch das zählt');
	});

	// Gegenprobe: Eine hinterlegte, strengere Regel der ersten Versammlung gilt
	// auch hier, denn nach ihr sperrt das Eröffnen.
	it('nennt eine hinterlegte Regel der ersten Versammlung', () => {
		const s = neutraktandenFussnote({
			kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
			mindestens: 3,
			fundstelle: 'Reglement Ziff. 9'
		});
		expect(s).toContain('zwei Drittel der Eigentümer, mindestens aber drei');
		expect(s).not.toContain('die Hälfte');
	});

	it('sagt nichts zur offenen Rechtsfrage', () => {
		expect(neutraktandenFussnote(null)).not.toMatch(/geklärt|angefochten|Gericht/);
	});
});

describe('L5, die konsultative Abstimmung nach der Sperre (Codeprüfung Block 7, H1)', () => {
	const neu: KeinBeschluss = { grund: 'konsultativ', namen: [], neuAnZweiter: true };
	const alt: KeinBeschluss = { grund: 'konsultativ', namen: [] };

	it('nennt nach der Sperre den eigenen Grund, sonst den bisherigen', () => {
		expect(keinBeschlussSatz(neu)).toBe(KONSULTATIV_SATZ_NEU);
		expect(keinBeschlussSatz(alt)).toBe(KONSULTATIV_SATZ);
		expect(wegNachKeinemBeschluss(neu)).toBe(KONSULTATIV_WEG_NEU);
		expect(wegNachKeinemBeschluss(alt)).toBe(KONSULTATIV_WEG);
	});

	it('sagt nach der Sperre nirgends «nicht beschlussfähig» ohne «wie eine erste»', () => {
		for (const s of [KONSULTATIV_OFFEN_NEU, KONSULTATIV_SATZ_NEU, KONSULTATIV_WERTUNG_NEU, KONSULTATIV_WEG_NEU]) {
			expect(s.replace(/nicht beschlussfähig(?: ist| war)? wie eine erste/g, '')).not.toMatch(/nicht beschlussfähig/);
		}
	});
});

describe('L5 am Rückkommen (Codeprüfung Block 7, R2-N1)', () => {
	const ziel = {
		id: 't-1',
		nummer: '4',
		titel: 'Neue Heizung',
		behandelt: true,
		rueckkommenOffen: false,
		zurueckgezogen: false,
		keinBeschluss: true,
		konsultativ: true
	};
	it('nennt nach der Sperre den eigenen Weg, sonst den bisherigen', () => {
		expect(() => verlangeRueckkommbar({ ...ziel, konsultativNeu: true })).toThrow(KONSULTATIV_WEG_NEU);
		expect(() => verlangeRueckkommbar(ziel)).toThrow(KONSULTATIV_WEG);
		expect(() => verlangeRueckkommbar(ziel)).not.toThrow(KONSULTATIV_WEG_NEU);
	});
});

describe('L5, Review DeepSeek zu Block 7', () => {
	it('kennzeichnet einen Folgeantrag auch, wenn er vor dem Grundantrag steht (Befund 2)', () => {
		const zeile = (id: string, folgeantragZu: string | null = null) => ({
			id,
			art: 'abstimmung' as const,
			ausVorlage: false,
			ausErsterUebernommen: false,
			spontan: folgeantragZu !== null,
			folgeantragZu,
			titel: id
		});
		// Kind des Kindes zuerst, dann das Kind, dann der Grundantrag.
		const neu = neueTraktandenDerZweiten('zweite', [zeile('enkel', 'kind'), zeile('kind', 'vater'), zeile('vater')], []);
		expect([...neu].sort()).toEqual(['enkel', 'kind', 'vater']);
	});

	it('sagt am Abend in der Absage nichts von einer unverbindlichen Abstimmung', () => {
		expect(neuAnZweiterGesperrt('Es fehlt eine Eigentümerin.', false)).not.toMatch(/unverbindlich/);
		expect(neuAnZweiterGesperrt('Es fehlt eine Eigentümerin.')).toMatch(/unverbindlich/);
	});

	it('sagt im Anfechtungssatz nicht «von Hand» (Befund 3, Produktentscheid 30.09.2026)', () => {
		expect(neuAnZweiterAnfechtungssatz(true)).not.toMatch(/von Hand/);
		expect(neuAnZweiterAnfechtungssatz(false)).toMatch(/Zahl der Anwesenden und Vertretenen gesunken/);
	});
});

describe('L5 im Notweg', () => {
	it('nennt die Anfechtbarkeit nach der Sperre mit eigenem Satz', () => {
		// Die Warnung zuerst (Laienprüfung L7-5).
		expect(quittungVonHand([{ kennung: 'neues_traktandum_gesperrt' }])).toBe(
			`${VON_HAND_FESTGEHALTEN_NEU_GESPERRT} ${VON_HAND_FESTGEHALTEN}`
		);
		expect(VON_HAND_FESTGEHALTEN_NEU_GESPERRT).toMatch(/jeder Eigentümer anfechten, der ihm nicht zugestimmt hat/);
		expect(VON_HAND_FESTGEHALTEN_NEU_GESPERRT).toMatch(/wenn alle das Protokoll seit mehr als einem Monat erhalten haben/);
		expect(quittungVonHand([{ kennung: 'nicht_beschlussfaehig' }, { kennung: 'neues_traktandum_gesperrt' }])).toBe(
			`${VON_HAND_FESTGEHALTEN} ${VON_HAND_FESTGEHALTEN_ANFECHTBAR}`
		);
		expect(quittungVonHand([])).toBe(VON_HAND_FESTGEHALTEN);
	});
});
