/**
 * Das Mehr aus der Einladung als Untergrenze (`domain/einladungsmehr.ts`,
 * Produktentscheide 27.09.2026 und 06.10.2026).
 *
 * Gemessen wird der Vergleich Hinsicht für Hinsicht und die Folge je Zustand:
 * im Saal strenger ja, milder nein; vor Beginn milder, nach Ablauf der
 * Versandfrist nur, wo die Gemeinschaft es zulässt (Produktentscheid
 * 07.10.2026, Migration 148). Dazu der Hinweis vor der Versammlung und die
 * Warnung im Saal, die nur noch aufmerksam machen.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import {
	folgeFuerEinladung,
	neuversandHinweis,
	neuversandVermerkt,
	saalhinweisNachMilderung,
	untergrenzeBeiFreigabe,
	warntImSaal,
	grenzeFuerFolgeantrag,
	untergrenzeDesFolgeantrags,
	vergleicheMitEinladung,
	verlangeMehrDerEinladung,
	verlangeMehrDerEinladungImFolgeantrag,
	type Einladungslage,
	type Vorfahr
} from '../../src/lib/domain/einladungsmehr';
import { vergleicheMasse } from '../../src/lib/domain/reglement';
import { waehleErfordernis, type Erfordernis } from '../../src/lib/domain/entscheidbaum';
import type { Reglementsregel } from '../../src/lib/domain/reglement';
import { holeRegelwerk } from '../../src/lib/rules';

const EINFACH: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

const QUALIFIZIERT: Erfordernis = {
	...EINFACH,
	knotenId: 'k-bau-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	quotenbasis: 'anwesend_vertreten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};

function mit(u: Partial<Erfordernis>): Erfordernis {
	return { ...EINFACH, ...u };
}

function lage(u: Partial<Einladungslage>): Einladungslage {
	return {
		gedruckt: EINFACH,
		vorher: null,
		neu: EINFACH,
		zustand: 'laufend',
		heute: '2027-03-01',
		versandfrist: null,
		traktandum: '3 Fassadensanierung',
		milderungNachFristZulassen: false,
		...u
	};
}

describe('Was bei der Freigabe als Untergrenze gilt', () => {
	it('ein zählbares Mehr an einem Abstimmungstraktandum', () => {
		expect(untergrenzeBeiFreigabe('abstimmung', EINFACH)).toBe(EINFACH);
	});

	it('nichts, wo die Einladung kein Mehr nennt', () => {
		expect(untergrenzeBeiFreigabe('abstimmung', null)).toBeNull();
		expect(untergrenzeBeiFreigabe('abstimmung', undefined)).toBeNull();
		expect(untergrenzeBeiFreigabe('abstimmung', mit({ typ: 'grenzfall' }))).toBeNull();
		expect(untergrenzeBeiFreigabe('kenntnisnahme', EINFACH)).toBeNull();
		expect(
			untergrenzeBeiFreigabe('abstimmung', mit({ typ: 'keine_abstimmung', kopfSchwelle: null }))
		).toBeNull();
	});
});

describe('Vergleich mit dem Mehr der Einladung', () => {
	it.each<[string, Erfordernis, Erfordernis, string]>([
		['dasselbe Mehr', EINFACH, EINFACH, 'gleich'],
		['anderer Fall, dieselben Masse', mit({ knotenId: 'k-anderer', titel: 'Anderer Fall' }), EINFACH, 'gleich'],
		['Wertquoten dazu', QUALIFIZIERT, EINFACH, 'strenger'],
		['Wertquoten weg', EINFACH, QUALIFIZIERT, 'milder'],
		['alle statt Anwesende', mit({ kopfbasis: 'alle_eigentuemer' }), EINFACH, 'strenger'],
		['Anwesende statt alle', EINFACH, mit({ kopfbasis: 'alle_eigentuemer' }), 'milder'],
		['zwei Drittel statt die Hälfte', mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } }), EINFACH, 'strenger'],
		['Enthaltung fällt heraus', mit({ enthaltungZaehltMit: false }), EINFACH, 'milder'],
		['Zustimmung der Betroffenen dazu', mit({ zustimmungBetroffenerNoetig: true }), EINFACH, 'strenger'],
		['Zustimmung der Betroffenen weg', EINFACH, mit({ zustimmungBetroffenerNoetig: true }), 'milder'],
		[
			'mehr Köpfe, aber ohne Betroffene',
			mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } }),
			mit({ zustimmungBetroffenerNoetig: true }),
			'gemischt'
		],
		[
			'mehr Köpfe, aber ohne Wertquoten',
			mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } }),
			QUALIFIZIERT,
			'gemischt'
		]
	])('%s', (_, neu, gedruckt, erwartet) => {
		expect(vergleicheMitEinladung(neu, gedruckt)).toBe(erwartet);
	});

	it('die herausgelöste Rechnung meldet gleiche Masse als gleich', () => {
		const m = {
			kopfbasis: 'anwesend_vertreten' as const,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
			quotenbasis: 'keine' as const,
			quotenSchwelle: null,
			enthaltungZaehltMit: true
		};
		expect(vergleicheMasse(m, m, false)).toBe('gleich');
	});
});

describe('Folge einer Änderung', () => {
	it('ohne Untergrenze ist alles frei', () => {
		expect(folgeFuerEinladung(lage({ gedruckt: null, neu: mit({ kopfSchwelle: { zaehler: 1, nenner: 3, art: 'mindestens' } }) }))).toEqual({ art: 'frei' });
	});

	it('im Saal: strenger und gleich gehen', () => {
		expect(folgeFuerEinladung(lage({ neu: QUALIFIZIERT }))).toEqual({ art: 'frei' });
		expect(folgeFuerEinladung(lage({ neu: EINFACH }))).toEqual({ art: 'frei' });
	});

	/*
	 * **Beim Öffnen der Abstimmung nur noch die Absage im Saal** (Produktentscheid
	 * 07.10.2026, «Nur noch aufmerksam machen»): Bis dahin gab es nach einem
	 * Rückfall beim Eröffnen eine eigene Absage («Beim Eröffnen war nicht
	 * rechtzeitig vermerkt …»). Den Rückfall gibt es nicht mehr, die Absage auch
	 * nicht.
	 */
	it('beim Öffnen der Abstimmung: die Absage im Saal, ohne Satz zum Rückfall', () => {
		expect(() => verlangeMehrDerEinladung(EINFACH, QUALIFIZIERT, '3 Fassade')).toThrow(
			expect.objectContaining({
				kennung: 'milder_als_einladung',
				message: expect.not.stringMatching(/Beim Eröffnen|Ein Vermerk jetzt/)
			})
		);
		expect(() => verlangeMehrDerEinladung(EINFACH, QUALIFIZIERT, '3 Fassade')).toThrow(
			/«3 Fassade»: Die Einladung nennt .*Im Saal darf das Mehr nur strenger werden/
		);
		expect(() => verlangeMehrDerEinladung(QUALIFIZIERT, QUALIFIZIERT, '3 Fassade')).not.toThrow();
	});

	it('im Saal: milder wird abgewiesen und nennt das Mehr der Einladung', () => {
		expect(() => folgeFuerEinladung(lage({ gedruckt: QUALIFIZIERT, neu: EINFACH }))).toThrow(
			expect.objectContaining({
				kennung: 'milder_als_einladung',
				message: expect.stringMatching(/«3 Fassadensanierung»: Die Einladung nennt .*Wertquoten/)
			})
		);
	});

	it('im Saal: gemischt zählt als milder', () => {
		expect(() =>
			folgeFuerEinladung(
				lage({
					gedruckt: QUALIFIZIERT,
					neu: mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } })
				})
			)
		).toThrow(expect.objectContaining({ kennung: 'milder_als_einladung' }));
	});

	it('im Saal: ein Mehr ohne Zählung (Grenzfall) hält nicht auf, abgestimmt wird darunter nicht', () => {
		expect(folgeFuerEinladung(lage({ neu: mit({ typ: 'grenzfall' }) }))).toEqual({ art: 'frei' });
	});

	it('vor Beginn: milder senkt die Untergrenze, auch ohne hinterlegte Frist', () => {
		expect(
			folgeFuerEinladung(lage({ zustand: 'freigegeben', gedruckt: QUALIFIZIERT, neu: EINFACH }))
		).toEqual({ art: 'senken' });
	});

	it('vor Beginn: am letzten Versandtag geht es noch', () => {
		expect(
			folgeFuerEinladung(
				lage({
					zustand: 'freigegeben',
					gedruckt: QUALIFIZIERT,
					neu: EINFACH,
					heute: '2027-03-01',
					versandfrist: '2027-03-01'
				})
			)
		).toEqual({ art: 'senken' });
	});

	it('vor Beginn: nach der Versandfrist abgewiesen, mit Datum', () => {
		expect(() =>
			folgeFuerEinladung(
				lage({
					zustand: 'freigegeben',
					gedruckt: QUALIFIZIERT,
					neu: EINFACH,
					heute: '2027-03-02',
					versandfrist: '2027-03-01'
				})
			)
		).toThrow(
			expect.objectContaining({
				kennung: 'versandfrist_vorbei',
				message: expect.stringMatching(
					// Mit Bedingung (Fachprüfung B3, Korrekturrunde 06.10.2026).
					// Bezug und Folge ausgeschrieben (Laienprüfung Runde 1, Abschnitt «Offen»
					// des Prüfberichts Hinweise lesbar, 06.10.2026).
					// Runde 2 (Laienprüfung N6, 07.10.2026): was ohne und nach dem Umstellen gilt.
					/1\. März 2027.*Ohne Umstellen bleibt es beim Mehr der Einladung oder einem strengeren; nach dem Umstellen setzen Sie das mildere Mehr hier neu\. Für das mildere verschieben Sie sonst das Traktandum und laden mit voller Frist neu ein\. Hat jemand das Traktandum verlangt, entscheidet über die Verschiebung die Versammlung \(Ordnungsantrag, in der Regel einfaches Mehr\)\. Lehnt sie die Verschiebung ab, lassen Sie an der Versammlung mit dem Mehr der Einladung abstimmen\.$/
				)
			})
		);
	});

	/*
	 * **Die Einstellung «zulassen, mit Hinweis»** (Produktentscheid 07.10.2026,
	 * Migration 148): Nach der Frist geht die Milderung dann durch. Gegen den
	 * Stand davor rot: Dort sagte `pruefeVersandfrist` immer ab.
	 */
	it('vor Beginn: nach der Versandfrist geht es, wo die Gemeinschaft es zulässt', () => {
		const nachFrist = {
			zustand: 'freigegeben' as const,
			gedruckt: QUALIFIZIERT,
			neu: EINFACH,
			heute: '2027-03-02',
			versandfrist: '2027-03-01'
		};
		expect(folgeFuerEinladung(lage({ ...nachFrist, milderungNachFristZulassen: true }))).toEqual({
			art: 'senken'
		});
		expect(() => folgeFuerEinladung(lage({ ...nachFrist, milderungNachFristZulassen: false }))).toThrow(
			expect.objectContaining({ kennung: 'versandfrist_vorbei' })
		);
		// Im Saal hilft die Einstellung nicht: Dort ist das gedruckte Mehr die Untergrenze.
		expect(() =>
			folgeFuerEinladung(lage({ ...nachFrist, zustand: 'laufend', milderungNachFristZulassen: true }))
		).toThrow(expect.objectContaining({ kennung: 'milder_als_einladung' }));
	});

	/*
	 * **«Spätestens am letzten Tag», nicht «innert der Frist»** (Auftrag
	 * «Hinweise lesbar», 06.10.2026): «innert» las sich als «in den nächsten
	 * Tagen». Das Datum steht genau einmal.
	 */
	it('vor Beginn: die Absage nennt den letzten Tag ohne «innert», das Datum einmal, und verlangt keinen Empfang', () => {
		let meldung = '';
		try {
			folgeFuerEinladung(
				lage({
					zustand: 'freigegeben',
					gedruckt: QUALIFIZIERT,
					neu: EINFACH,
					heute: '2027-03-02',
					versandfrist: '2027-03-01'
				})
			);
		} catch (e) {
			meldung = (e as Error).message;
		}
		expect(meldung).not.toContain('innert');
		/*
		 * Produktentscheid 07.10.2026: kein Satz, der Empfang oder Nachweis
		 * verlangt; stattdessen warum die Vorgabe absagt und wo sie sich umstellen
		 * lässt. Gegen den Stand davor rot.
		 */
		expect(meldung).not.toMatch(/verlangt dafür|bei allen ist/);
		// «rechtzeitig» an die erfasste Frist gebunden, und die Einstellung lässt sich
		// ändern, das Risiko bleibt (Fachprüfung B4, Laienprüfung 9, Runde 1,
		// 07.10.2026); gegen den Stand davor rot.
		expect(meldung).toContain(
			'Der letzte Tag der erfassten Einberufungsfrist war der 1. März 2027. Eine berichtigte ' +
				'Einladung an alle, die zur Versammlung ihrer Gemeinschaft eingeladen werden, kann ' +
				'jetzt nach der erfassten Einberufungsfrist nicht mehr rechtzeitig ankommen.'
		);
		expect(meldung).toContain('Dort lässt sich das ändern; das Anfechtungsrisiko bleibt dann bestehen.');
		expect(meldung).toContain('angefochten werden');
		expect(meldung).toContain('«Reglement und Quoren»');
		expect(meldung.split('1. März 2027').length - 1).toBe(1);
		for (const satz of meldung.replace(/(\d)\.(?= [A-ZÄÖÜ][a-zäöü]+ \d{4})/g, '$1·').split(/(?<=[.?])\s+(?=[A-ZÄÖÜ«])/)) {
			expect(satz.length, satz).toBeLessThanOrEqual(180);
		}
	});

	it('vor Beginn: strenger lässt die Untergrenze stehen', () => {
		expect(folgeFuerEinladung(lage({ zustand: 'freigegeben', neu: QUALIFIZIERT }))).toEqual({
			art: 'frei'
		});
	});
});

describe('Rückweg vor dem neuen Versand (Laienprüfung 06.10.2026, T3-b)', () => {
	const ZWEIDRITTEL_KOEPFE = mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } });

	it('zurück auf das Mehr der Einladung stellt die Untergrenze wieder her', () => {
		expect(
			folgeFuerEinladung(
				lage({ zustand: 'freigegeben', gedruckt: EINFACH, vorher: QUALIFIZIERT, neu: QUALIFIZIERT })
			)
		).toEqual({ art: 'zurueck' });
	});

	it('strenger als die Einladung ebenso', () => {
		expect(
			folgeFuerEinladung(
				lage({
					zustand: 'freigegeben',
					gedruckt: EINFACH,
					vorher: EINFACH,
					neu: ZWEIDRITTEL_KOEPFE
				})
			)
		).toEqual({ art: 'zurueck' });
	});

	it('halb zurück: die Untergrenze folgt dem Mehr, das die berichtigte Einladung nennt', () => {
		expect(
			folgeFuerEinladung(
				lage({ zustand: 'freigegeben', gedruckt: EINFACH, vorher: QUALIFIZIERT, neu: ZWEIDRITTEL_KOEPFE })
			)
		).toEqual({ art: 'senken' });
	});

	it('dasselbe gemilderte Mehr noch einmal ändert nichts', () => {
		expect(
			folgeFuerEinladung(
				lage({ zustand: 'freigegeben', gedruckt: EINFACH, vorher: QUALIFIZIERT, neu: EINFACH })
			)
		).toEqual({ art: 'frei' });
	});

	it('im Saal gibt es keinen Rückweg, nur die Untergrenze', () => {
		expect(
			folgeFuerEinladung(
				lage({ zustand: 'laufend', gedruckt: EINFACH, vorher: QUALIFIZIERT, neu: QUALIFIZIERT })
			)
		).toEqual({ art: 'frei' });
	});
});

/*
 * **Der Hinweis macht nur noch aufmerksam** (Produktentscheid 07.10.2026, «Nur
 * noch aufmerksam machen»). Bis dahin sagte er, ohne rechtzeitigen Haken nehme
 * die Anwendung beim Eröffnen das Mehr der bisherigen Einladung, und ein
 * späterer Haken zähle nicht. Die Proben dazu sind ersetzt, nicht gelöscht:
 * Jede Lage wird jetzt daran gemessen, dass keiner dieser Sätze mehr steht.
 */
describe('Hinweis nach einer Milderung', () => {
	const OHNE = { versandfrist: null, heute: '2027-03-01' };
	const LAEUFT = { versandfrist: '2027-03-05', heute: '2027-03-01' };
	const VORBEI = { versandfrist: '2027-03-01', heute: '2027-03-02' };
	const EINS = [{ traktandum: '3 Fassade' }];
	const ZWEI = [{ traktandum: '3 Fassade' }, { traktandum: '4 Lift' }];
	const LAGEN = [
		['ohne Frist', OHNE],
		['Frist läuft', LAEUFT],
		['Frist vorbei', VORBEI]
	] as const;

	it('schweigt ohne Milderung', () => {
		expect(neuversandHinweis([], OHNE)).toBeNull();
	});

	it('nennt die Traktanden, Einzahl und Mehrzahl', () => {
		expect(neuversandHinweis(EINS, OHNE)).toMatch(/eines Traktandums milder geworden: «3 Fassade»/);
		expect(neuversandHinweis(ZWEI, OHNE)).toMatch(
			/mehrerer Traktanden milder geworden: «3 Fassade», «4 Lift»/
		);
	});

	/*
	 * Gegen den Stand vor dem 07.10.2026 rot: «ein späterer Haken zählt nicht»
	 * (Frist läuft), «Beim Eröffnen nimmt die Anwendung deshalb wieder …»
	 * (Frist vorbei), «bei allen ist» als Bedingung des Hakens (alle drei).
	 */
	it('kein Satz zum Rückfall, zum späten Haken oder zum Empfang als Bedingung, in jeder Lage', () => {
		for (const [name, frist] of LAGEN) {
			for (const tr of [EINS, ZWEI]) {
				const h = neuversandHinweis(tr, frist)!;
				expect(h, name).not.toContain('zählt nicht');
				expect(h, name).not.toContain('nimmt die Anwendung beim Eröffnen');
				expect(h, name).not.toContain('bei allen angekommen');
				expect(h, name).not.toMatch(/wieder das Mehr der bisherigen Einladung/);
				expect(h, name).not.toMatch(/Haken[^.]*erst, wenn[^.]*bei allen/);
				// Die Regel der Anwendung, nicht «gilt» (Fachprüfung B6, gilt weiter).
				expect(h, name).not.toMatch(/\bgilt\b[^.]*das (mildere )?Mehr/);
				// Der neue Hakenname und dass er nur aufmerksam macht.
				expect(h, name).toContain('den Haken «Die Einladung ist verschickt»');
				expect(h, name).toContain('Die Anwendung nimmt das mildere Mehr auch ohne Haken.');
				// Runde 1, 07.10.2026 (Laien 1, 3, 10): was der Haken wegnimmt, die Warnung
				// im Saal unabhängig vom Haken, wer für den Versand sorgt. Gegen den
				// Stand davor rot.
				expect(h, name).toContain('Der Haken nimmt nur diesen Hinweis und die Erinnerungsmail weg.');
				expect(h, name).toContain(
					tr.length === 1
						? 'Im Saal steht trotzdem eine Warnung beim Traktandum, solange das Mehr dort milder ist ' +
								'als in der Einladung vor der Milderung.'
						: 'Im Saal steht trotzdem eine Warnung bei jedem dieser Traktanden, solange das Mehr ' +
								'dort milder ist als in der Einladung vor der Milderung.'
				);
				expect(h, name).not.toContain('steht der Hinweis noch einmal');
				expect(h, name).toContain('Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.');
				expect(h, name).not.toContain('Sitzungsleitung');
				// Als Empfehlung (Fachprüfung B5).
				expect(h, name).toContain('Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen.');
				// Vor Fristablauf und ohne Frist mit der Folge (Produktentscheid 07.10.2026
				// «1a»); gegen den Stand davor rot.
				if (frist !== VORBEI) {
					expect(h, name).toContain(
						'Für das mildere Mehr sollte eine berichtigte Einladung an alle gehen. ' +
							'Kommt sie nicht rechtzeitig bei allen an, kann ein Beschluss mit dem milderen Mehr angefochten werden.'
					);
				}
				expect(h, name).not.toContain('braucht es');
			}
		}
	});

	it('Frist läuft: nennt den letzten Tag und den Postweg', () => {
		const h = neuversandHinweis(EINS, LAEUFT)!;
		expect(h).toContain('Schicken Sie sie so, dass sie spätestens am 5. März 2027 bei allen ist.');
		expect(h).toContain('Rechnen Sie den Postweg ein.');
		expect(h).toContain('Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob und wann die Einladung ankommt, prüft die Anwendung nicht.');
		expect(h).not.toContain('zehn Tage');
		expect(h).not.toContain('Erfassen Sie');
	});

	it('ohne Frist: zehn Tage und der Rat zum Erfassen, zum Schluss', () => {
		const h = neuversandHinweis(EINS, OHNE)!;
		expect(h).toContain('in der Regel mindestens zehn Tage vor der Versammlung');
		expect(h.split('zehn Tage').length - 1).toBe(1);
		expect(
			h.endsWith(
				'Für diese Gemeinschaft ist keine Einberufungsfrist erfasst. Erfassen Sie sie unter ' +
					'«Reglement und Quoren»; dann nennt dieser Hinweis den letzten Tag.'
			)
		).toBe(true);
		expect(h).not.toContain('Ausland');
		expect(h).not.toMatch(/\d{4}/);
	});

	it('Frist vorbei: nicht mehr rechtzeitig, anfechtbar, trotzdem schicken oder zurück', () => {
		const h = neuversandHinweis(EINS, VORBEI)!;
		expect(h).toContain('Der letzte Tag der erfassten Einberufungsfrist war der 1. März 2027.');
		/*
		 * **Bedingt, mit Nutzen und Grenze des späten Versands und dem sicheren
		 * Weg** (Fachprüfung B1, Laienprüfung 1 und 2, Runde 1, 07.10.2026). Gegen
		 * den Stand davor rot: Dort hiess es unbedingt «kann jetzt nicht mehr
		 * rechtzeitig ankommen», und die Verschiebung fehlte.
		 */
		expect(h).toContain(
			'Ist die berichtigte Einladung noch nicht verschickt, kommt sie nach dieser Frist nicht ' +
				'mehr rechtzeitig an. War sie am 1. März 2027 nicht bei allen, kann ein Beschluss mit dem ' +
				'milderen Mehr angefochten werden. Für Versandweg und Zeitpunkt sorgt, wer einlädt; ob ' +
				'und wann die Einladung ankommt, prüft die Anwendung nicht.\n' +
				// Die drei Wege je auf einer Zeile, der erste als Bedingung (Laienprüfung
				// Runde 2, N5, 07.10.2026); gegen den Stand davor rot.
				'Wenn Sie sie trotzdem schicken, wissen alle vom milderen Mehr; das Anfechtungsrisiko ' +
				'bleibt.\nDer sichere Weg: Verschieben Sie das Traktandum'
		);
		expect(h).toContain('\nOder bleiben Sie beim Mehr der Einladung; wie, steht unten.');
		// Nach Fristablauf B ohne die Folge: Der bedingte Satz steht schon da (1a).
		expect(h).not.toContain('Kommt sie nicht rechtzeitig bei allen an');
		expect(h).toContain(
			'Der sichere Weg: Verschieben Sie das Traktandum und laden Sie mit voller Frist neu ein. ' +
				'Hat jemand das Traktandum verlangt, entscheidet über die Verschiebung die Versammlung'
		);
		expect(h).not.toContain('kann jetzt nicht mehr');
		const zwei = neuversandHinweis(ZWEI, VORBEI)!;
		expect(zwei).toContain(
			'Der sichere Weg: Verschieben Sie die betroffenen Traktanden und laden Sie mit voller Frist ' +
				'neu ein. Hat jemand eines davon verlangt, entscheidet über dessen Verschiebung die Versammlung'
		);
		expect(zwei).not.toContain('Verschieben Sie das Traktandum');
		expect(h).not.toContain('Postweg');
		expect(h).not.toContain('zehn Tage');
		expect(h).not.toContain('rechtzeitig bei allen ist');
	});

	/*
	 * **Der Rückweg mit den Klicks, in jeder Lage** (Produktentscheid 06.10.2026,
	 * «Verweis einbauen»), und der Satz zum Haken nach dem Zurückstellen vor
	 * dem Ende (Laienprüfung Restpunkte Runde 1, B6): Mit dem Zurückstellen
	 * verschwindet die Anleitung.
	 */
	it('Rückweg: Klicks, dann der Haken für die bisherige Einladung, dann «entfällt», Einzahl und Mehrzahl', () => {
		for (const [name, frist] of LAGEN) {
			const eins = neuversandHinweis(EINS, frist)!;
			expect(eins, name).toContain(
				'Wollen Sie beim Mehr der Einladung bleiben, stellen Sie es zurück: Klicken Sie in der ' +
					'Traktandenliste auf das Traktandum und dann auf «Erfordernis ändern». Haben Sie das ' +
					'Mehr zurückgestellt, setzen Sie den Haken unten; er gilt dann für die bisherige ' +
					'Einladung. Setzen Sie ihn, sobald sie verschickt ist; ist sie das schon, gleich. Mit ' +
					'dem Zurückstellen entfällt dieser Hinweis; das Kästchen für den Haken bleibt unten ' +
					'stehen.'
			);
			const zwei = neuversandHinweis(ZWEI, frist)!;
			expect(zwei, name).toContain(
				'Klicken Sie in der Traktandenliste auf jedes betroffene Traktandum und dann auf ' +
					'«Erfordernis ändern». Haben Sie das Mehr überall zurückgestellt, setzen Sie den ' +
					'Haken unten; er gilt dann für die bisherige Einladung. Setzen Sie ihn, sobald sie ' +
					'verschickt ist; ist sie das schon, gleich. Ist das Mehr bei allen betroffenen ' +
					'Traktanden zurückgestellt, entfällt dieser Hinweis;'
			);
			expect(zwei, name).not.toContain('auf das Traktandum und');
		}
	});

	it('Blöcke: Lage, Haken, Rückweg, ohne Frist dazu der Rat', () => {
		expect(neuversandHinweis(EINS, OHNE)!.split('\n')).toHaveLength(4);
		expect(neuversandHinweis(EINS, LAEUFT)!.split('\n')).toHaveLength(3);
		// Frist vorbei: die drei Wege je auf einer Zeile (Laienprüfung Runde 2, N5).
		expect(neuversandHinweis(EINS, VORBEI)!.split('\n')).toHaveLength(6);
		const [lage, haken, rueckweg] = neuversandHinweis(EINS, LAEUFT)!.split('\n');
		expect(lage).toMatch(/^Seit der Freigabe/);
		expect(haken).toMatch(/^Setzen Sie unten den Haken/);
		expect(rueckweg).toMatch(/^Wollen Sie beim Mehr der Einladung bleiben/);
	});

	/*
	 * **Wenn die Post nicht mehr reicht** (Codeprüfung N2, Nachtrag): dieselbe
	 * Regel wie die Mail (`postZuSpaet`), nur in der Lage «Frist läuft». Der
	 * 05.03.2027 ist ein Freitag, der 08.03.2027 ein Montag.
	 */
	it('sagt am Samstag vor einer Frist am Montag, dass die Post kaum reicht, sonst, dass sie nicht mehr reicht', () => {
		expect(neuversandHinweis(EINS, { versandfrist: '2027-03-08', heute: '2027-03-05' })).toContain(
			'Rechnen Sie den Postweg ein.'
		);
		const sa = neuversandHinweis(EINS, { versandfrist: '2027-03-08', heute: '2027-03-06' })!;
		// An die erfasste Frist gebunden (Fachprüfung B4, Runde 1, 07.10.2026).
		expect(sa).toContain('Per Post kommt sie kaum noch bis zum letzten Tag der erfassten Frist an.');
		expect(sa).not.toContain('Rechnen Sie den Postweg ein.');
		for (const heute of ['2027-03-07', '2027-03-08']) {
			const h = neuversandHinweis(EINS, { versandfrist: '2027-03-08', heute })!;
			expect(h, heute).toContain(
				'Per Post kommt sie nicht mehr bis zum letzten Tag der erfassten Frist an.'
			);
		}
	});

	it('jeder Satz bleibt unter 180 Zeichen, in der Mehrzahl und in allen Lagen', () => {
		const lang = [
			{ traktandum: '3 Sanierung der Fassade' },
			{ traktandum: '4 Ersatz der Briefkästen' }
		];
		for (const frist of [
			OHNE,
			{ versandfrist: '2027-09-30', heute: '2027-09-01' },
			{ versandfrist: '2027-09-30', heute: '2027-09-30' },
			{ versandfrist: '2027-03-08', heute: '2027-03-06' },
			{ versandfrist: '2027-09-30', heute: '2027-10-01' }
		]) {
			for (const tr of [lang, lang.slice(0, 1)]) {
				const saetze = neuversandHinweis(tr, frist)!
					.replace(/(\d)\.(?= [A-ZÄÖÜ][a-zäöü]+ \d{4})/g, '$1·')
					.split(/(?<=[.?])\s+(?=[A-ZÄÖÜ«])/);
				for (const s of saetze) expect(s.length, s).toBeLessThanOrEqual(180);
			}
		}
	});
});

/*
 * **Ob nach der Milderung ein Versand vermerkt ist** (Produktentscheid
 * 07.10.2026): Jeder Haken nach der Milderung zählt, auch nach dem letzten
 * Fristtag. Bis dahin (`neuversandGilt`) zählte er nur bis zu diesem Tag.
 */
describe('Haken nach der Milderung', () => {
	const gemildertAm = new Date('2027-03-01T10:00:00Z');

	it('zählt jeder Haken nach der Milderung, keiner davor, keiner ohne', () => {
		expect(neuversandVermerkt({ vermerkt: null, gemildertAm })).toBe(false);
		expect(neuversandVermerkt({ vermerkt: new Date('2027-03-01T09:59:59Z'), gemildertAm })).toBe(false);
		expect(neuversandVermerkt({ vermerkt: new Date('2027-03-01T10:00:00Z'), gemildertAm })).toBe(true);
		// Weit nach jedem denkbaren Fristtag: zählt trotzdem.
		expect(neuversandVermerkt({ vermerkt: new Date('2027-06-30T10:00:00Z'), gemildertAm })).toBe(true);
	});
});

/*
 * **Die Warnung im Saal** (Produktentscheid 07.10.2026, Punkt 4a): mit dem
 * Mehr der Einladung davor, wo bekannt, und einer von zwei Angaben zum Haken.
 */
describe('Warnung im Saal nach einer Milderung', () => {
	it('mit Haken und bekanntem Mehr davor', () => {
		const w = saalhinweisNachMilderung({
			einladungDavor: 'mindestens zwei Drittel der anwesenden und vertretenen Eigentümer',
			vermerktAm: '2027-03-04',
			universalvariante: 'persoenlich'
		});
		/*
		 * Runde 2 (Produktentscheid 07.10.2026 «2a»): Lage und Ausweg zuerst, dann
		 * die Ansage vor der Abstimmung, dann der Hintergrund. Gegen den Stand
		 * davor rot.
		 */
		// Runde 3 (Produktentscheid 07.10.2026 «a», R3-1): Risiko bedingt, Hintergrund
		// in der Vergangenheit; gegen den Stand davor rot.
		expect(w).toBe(
			'Das Mehr dieses Traktandums ist seit der Freigabe milder als in der Einladung vor der ' +
				'Milderung. Diese nannte mindestens zwei Drittel der anwesenden und vertretenen ' +
				'Eigentümer. War die berichtigte Einladung nicht rechtzeitig bei allen, kann ein ' +
				'Beschluss mit diesem Mehr angefochten werden; ob sie es war, prüft die Anwendung nicht. ' +
				'Stellen Sie das Mehr ' +
				'auf das der Einladung vor der Milderung oder strenger, entfällt diese Warnung. Bleiben ' +
				'Sie beim milderen, sagen Sie vor der Abstimmung an, dass das Mehr milder ist als in der ' +
				// Fassung «persoenlich» (Produktentscheid 07.10.2026 zu Fassung 2).
				'Einladung. Sind alle Eigentümer persönlich anwesend und erhebt dann niemand Einwand, ' +
				'ist eine Anfechtung deswegen kaum mehr möglich. Vertretene zählen dafür nach der ' +
				'Einstellung Ihrer Gemeinschaft bei der Freigabe nicht. Für das mildere Mehr hätte eine berichtigte Einladung an alle gehen ' +
				'sollen. Nach der Milderung als verschickt vermerkt am 4. März 2027.'
		);
		expect(w).not.toContain('Ein Beschluss mit diesem Mehr kann angefochten werden.');
		expect(w.split('prüft die Anwendung nicht').length - 1).toBe(1);
		expect(w).not.toMatch(/jederzeit setzen|fehlen Eigentümer/);
	});

	it('ohne Haken und ohne bekanntes Mehr davor', () => {
		const w = saalhinweisNachMilderung({
			einladungDavor: null,
			vermerktAm: null,
			universalvariante: 'persoenlich'
		});
		expect(w).toContain(
			'Nach der Milderung ist nicht vermerkt, dass sie verschickt ist.'
		);
		expect(w).not.toContain('Die Einladung davor');
		expect(w).not.toContain('vermerkt am');
		// Ohne bekanntes Mehr: wo es steht (Laienprüfung 4, Runde 1).
		expect(w).toContain(
			'Welches Mehr sie nannte, steht in der gedruckten Einladung und im Verlauf der Versammlung.'
		);
	});

	it('jeder Satz unter 180 Zeichen, auch mit langem Mehr, in jeder Einstellung', () => {
		for (const universalvariante of ['persoenlich', 'vertreten', 'keine'] as const) {
			const w = saalhinweisNachMilderung({
				einladungDavor:
					'mindestens zwei Drittel der anwesenden und vertretenen Eigentümer und mehr als die ' +
					'Hälfte der Wertquoten aller Eigentümer',
				vermerktAm: '2027-09-30',
				universalvariante,
				leitungsvollmachtenZaehlen: false
			});
			const saetze = w
				.replace(/(\d)\.(?= [A-ZÄÖÜ][a-zäöü]+ \d{4})/g, '$1·')
				.split(/(?<=[.?])\s+(?=[A-ZÄÖÜ«])/);
			for (const s of saetze) expect(s.length, s).toBeLessThanOrEqual(180);
		}
	});

	/*
	 * **Der Satz zur Anwesenheit folgt der Einstellung zur Universalversammlung**
	 * (Produktentscheid 07.10.2026 «Ja» zu Fassung 2,
	 * `quellen/pruefung/zu-pruefen-2026-10-07-votum-vertretene-saal.md`). Gegen
	 * den Stand davor rot: Dort stand in jeder Lage «Ob Vertretene dafür als
	 * anwesend zählen, ist nicht geklärt.».
	 */
	describe('Satz zur Anwesenheit je Einstellung', () => {
		const mit = (
			universalvariante: 'persoenlich' | 'vertreten' | 'keine',
			leitungsvollmachtenZaehlen = false
		) =>
			saalhinweisNachMilderung({
				einladungDavor: null,
				vermerktAm: null,
				universalvariante,
				leitungsvollmachtenZaehlen
			});
		const ansage =
			'Bleiben Sie beim milderen, sagen Sie vor der Abstimmung an, dass das Mehr milder ist als in ' +
			'der Einladung. ';

		it('«persoenlich»: Vertretene zählen nach der Einstellung nicht', () => {
			expect(mit('persoenlich')).toContain(
				ansage +
					'Sind alle Eigentümer persönlich anwesend und erhebt dann niemand Einwand, ist eine ' +
					'Anfechtung deswegen kaum mehr möglich. Vertretene zählen dafür nach der Einstellung ' +
					// «bei der Freigabe» (Schlussprüfung, Laien N1); gegen den Stand davor rot.
					'Ihrer Gemeinschaft bei der Freigabe nicht. '
			);
			expect(mit('persoenlich')).not.toContain('nicht geklärt');
		});

		it('«vertreten»: mit Vollmacht für dieses Traktandum, nicht entschieden, Vollmachten prüfen', () => {
			expect(mit('vertreten')).toContain(
				ansage +
					'Sind alle Eigentümer anwesend oder mit einer Vollmacht für dieses Traktandum vertreten ' +
					'und erhebt dann niemand Einwand, ist eine Anfechtung deswegen kaum mehr möglich. So ist ' +
					'es nach der Einstellung Ihrer Gemeinschaft bei der Freigabe; für das Stockwerkeigentum ' +
					'entschieden ist es nicht. Vollmachten, die Sie als Leitung oder Verwaltung halten, ' +
					'zählen dafür nach dieser Einstellung nicht. Prüfen Sie die Vollmachten ' +
					'vor der Abstimmung. '
			);
			// Zählen Leitungsvollmachten nach der Einstellung mit, entfällt der Zusatz
			// (Schlussprüfung, Codeprüfung); gegen den Stand davor rot.
			expect(mit('vertreten', true)).toContain(
				'entschieden ist es nicht. Prüfen Sie die Vollmachten vor der Abstimmung. '
			);
			expect(mit('vertreten', true)).not.toContain('Leitung oder Verwaltung');
			expect(mit('vertreten')).not.toContain('Ob Vertretene');
		});

		it('«keine»: persönlich anwesend, ob Vertretene zählen, ist nicht geklärt', () => {
			expect(mit('keine')).toContain(
				ansage +
					'Sind alle Eigentümer persönlich anwesend und erhebt dann niemand Einwand, ist eine ' +
					'Anfechtung deswegen kaum mehr möglich. Ob Vertretene dafür zählen, ist nicht geklärt; ' +
					// Die sichere Lesart als Handlung (Schlussprüfung, Laien N2).
					'verlassen Sie sich dafür nur auf persönlich Anwesende. '
			);
			expect(mit('keine')).not.toContain('nach der Einstellung');
		});

		it('in keiner Fassung mehr der alte Satz', () => {
			for (const v of ['persoenlich', 'vertreten', 'keine'] as const) {
				expect(mit(v), v).not.toContain('Ob Vertretene dafür als anwesend zählen, ist nicht geklärt');
			}
		});
	});
});

describe('Folgeantrag: dieselbe Untergrenze wie das angekündigte Traktandum', () => {
	/*
	 * Produktentscheid 06.10.2026, «Ja, dieselbe Untergrenze»: Ein Folgeantrag,
	 * auch der Gegenantrag, hält das Mehr, das die Einladung für sein
	 * angekündigtes Traktandum nennt. Verglichen ohne die Zustimmung der
	 * Betroffenen (Produktentscheid 06.10.2026, «Nur wenn der Inhalt es
	 * verlangt»).
	 */
	const ANGEKUENDIGT: Vorfahr = {
		spontan: false,
		spontanart: null,
		untergrenze: QUALIFIZIERT,
		bezeichnung: '3 Fassadensanierung'
	};
	const spontan = (spontanart: string): Vorfahr => ({
		spontan: true,
		spontanart,
		untergrenze: null,
		bezeichnung: 'im Saal aufgenommen'
	});

	it.each<[string, Vorfahr[], { untergrenze: Erfordernis | null; grundantrag: string } | null]>([
		['direkt unter dem angekündigten', [ANGEKUENDIGT], { untergrenze: QUALIFIZIERT, grundantrag: '3 Fassadensanierung' }],
		[
			'angekündigt ohne Untergrenze: das Traktandum, aber kein Mehr',
			[{ ...ANGEKUENDIGT, untergrenze: null }],
			{ untergrenze: null, grundantrag: '3 Fassadensanierung' }
		],
		[
			'über eine Folgeantrag-Stufe',
			[spontan('folgeantrag'), ANGEKUENDIGT],
			{ untergrenze: QUALIFIZIERT, grundantrag: '3 Fassadensanierung' }
		],
		['die Kette trifft ein Rückkommen', [spontan('rueckkommen'), ANGEKUENDIGT], null],
		['die Kette trifft ein neues Geschäft', [spontan('neu'), ANGEKUENDIGT], null],
		['leere Kette', [], null]
	])('%s', (_, kette, erwartet) => {
		expect(untergrenzeDesFolgeantrags(kette)).toEqual(erwartet);
	});

	it.each<[string, Erfordernis]>([
		['milder', EINFACH],
		['gemischt', mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } })]
	])('%s wird abgewiesen und nennt beide', (_, mehr) => {
		expect(() =>
			verlangeMehrDerEinladungImFolgeantrag(mehr, QUALIFIZIERT, 'Gegenantrag Holzfassade', '3 Fassadensanierung')
		).toThrow(
			expect.objectContaining({
				kennung: 'milder_als_einladung',
				message: expect.stringMatching(
					/^«Gegenantrag Holzfassade» ist ein Folge- oder Gegenantrag zu «3 Fassadensanierung» und betrifft denselben Gegenstand\. Für «3 Fassadensanierung» nennt die Einladung .*Wertquoten.*\. Die Anwendung verlangt dieses Mehr deshalb auch für ihn\. Wählen Sie dieses Mehr oder ein strengeres; .*Ein milderes Mehr lässt die Anwendung im Saal nicht zu: .*Möglich ist das, wenn die Antragstellerin ihn zurückzieht .*Geschieht beides nicht, lassen Sie heute mit dem Mehr der Einladung abstimmen; ein milderes setzt die Anwendung nicht\. .*Dort steht dafür «Antrag zurückziehen» in seiner Zeile oder, wenn er gerade aufgerufen ist, «Zurückziehen» unter «Jetzt möglich»\. .*dass die Antragstellerin ihn zurückgezogen hat, nur, wenn sie es tat\. .*über «3 Fassadensanierung» stimmen Sie wie geplant ab\. Wird «3 Fassadensanierung» heute angenommen, führt die Verwaltung ihn aus\. .*Das ist ein Ordnungsantrag mit einfachem Mehr, per Handzeichen, festgehalten im Votenfeld des Traktandums\.$/

				)
			})
		);
	});

	it('gleich und strenger gehen, ohne Untergrenze ebenso', () => {
		expect(() => verlangeMehrDerEinladungImFolgeantrag(QUALIFIZIERT, QUALIFIZIERT, 'F', 'G')).not.toThrow();
		expect(() =>
			verlangeMehrDerEinladungImFolgeantrag(mit({ ...QUALIFIZIERT, kopfbasis: 'alle_eigentuemer' }), QUALIFIZIERT, 'F', 'G')
		).not.toThrow();
		expect(() => verlangeMehrDerEinladungImFolgeantrag(EINFACH, null, 'F', 'G')).not.toThrow();
	});

	it('die Zustimmung der Betroffenen zählt nicht mit, Köpfe, Wertquoten und Enthaltungen schon', () => {
		const MIT_ZUSTIMMUNG = { ...QUALIFIZIERT, zustimmungBetroffenerNoetig: true };
		// Gleiche Masse, ohne Zustimmung: Ob sie nötig ist, folgt aus dem Inhalt.
		expect(() =>
			verlangeMehrDerEinladungImFolgeantrag(QUALIFIZIERT, MIT_ZUSTIMMUNG, 'F', 'G')
		).not.toThrow();
		// Ohne Wertquoten: milder, und der Satz nennt die Zustimmung nicht als Grund.
		let satz = '';
		try {
			verlangeMehrDerEinladungImFolgeantrag(EINFACH, MIT_ZUSTIMMUNG, 'F', 'G');
		} catch (f) {
			expect(f).toMatchObject({ kennung: 'milder_als_einladung' });
			satz = (f as Error).message;
		}
		expect(satz).toContain('Köpfe, Wertquoten oder Enthaltungen');
		expect(satz).not.toContain('Betroffenen');
	});

	it('der Satz für das Traktandum, mit dem Ausweg samt Bedingung (F1)', () => {
		expect(() => verlangeMehrDerEinladung(EINFACH, QUALIFIZIERT, '3 Fassade')).toThrow(
			expect.objectContaining({
				message: expect.stringMatching(
					// Der Ausweg mit Bedingung, geändert nach Fachprüfung Teil 2 Runde 3 (F1).
					/^«3 Fassade»: Die Einladung nennt .*\. Wählen Sie dieses Mehr oder ein strengeres; .*Köpfe, Wertquoten, Enthaltungen oder die Zustimmung der Betroffenen anders zählen\. .*das kann auch eine ausserordentliche sein\. Hat jemand das Traktandum verlangt, entscheidet über die Verschiebung die Versammlung \(Ordnungsantrag, in der Regel einfaches Mehr\)\. Lehnt sie die Verschiebung ab, lassen Sie heute mit dem Mehr der Einladung abstimmen\.$/
				)
			})
		);
	});
});

describe('Was im Aufnahmeformular zu mild ist (Codeprüfung M1, Fachprüfung FP2-10)', () => {
	/*
	 * Gerechnet wie beim Setzen (`setzeGewaehltesErfordernis`): erst das
	 * Reglement, dann der Vergleich ohne die Zustimmung der Betroffenen.
	 */
	const RW = holeRegelwerk();
	const NUETZLICH = waehleErfordernis(RW, 'k-baulich-nuetzlich').ergebnis;
	const GEWOEHNLICH = waehleErfordernis(RW, 'k-verwaltung-gewoehnlich').ergebnis;

	it('führt die milderen Fälle, nicht den gleichen', () => {
		const g = grenzeFuerFolgeantrag(NUETZLICH, NUETZLICH, RW, [], null, LESARTEN_VORGABE);
		expect(g.zuMild).toContain('k-verwaltung-gewoehnlich');
		expect(g.zuMild).not.toContain('k-baulich-nuetzlich');
		expect(g.geerbtZuMild).toBe(false);
	});

	it('das geerbte Mehr: zu mild, wenn es die Untergrenze nicht hält; ohne Mehr nicht', () => {
		expect(grenzeFuerFolgeantrag(NUETZLICH, GEWOEHNLICH, RW, [], null, LESARTEN_VORGABE).geerbtZuMild).toBe(true);
		expect(grenzeFuerFolgeantrag(NUETZLICH, null, RW, [], null, LESARTEN_VORGABE).geerbtZuMild).toBe(false);
	});

	it('eine strengere Reglementsregel nimmt den Fall aus der Liste', () => {
		const regel: Reglementsregel = {
			id: 'r1',
			stwegId: 's1',
			knotenId: 'k-verwaltung-gewoehnlich',
			geschaeftsart: GEWOEHNLICH.geschaeftsart!,
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			quotenbasis: 'alle_quoten',
			fundstelle: 'Reglement Ziff. 9',
			enthaltungZaehltMit: true
		};
		expect(grenzeFuerFolgeantrag(NUETZLICH, null, RW, [regel], null, LESARTEN_VORGABE).zuMild).not.toContain(
			'k-verwaltung-gewoehnlich'
		);
	});
});

/*
 * **Ob im Saal gewarnt wird** (Produktentscheid 07.10.2026, «Die Warnung
 * rechnet im Saal laufend nach»).
 */
describe('Warnung im Saal: laufend gegen das Mehr der Einladung davor', () => {
	it('milder und gemischt warnen, gleich und strenger nicht', () => {
		expect(warntImSaal(EINFACH, QUALIFIZIERT)).toBe(true);
		expect(warntImSaal(mit({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } }), QUALIFIZIERT)).toBe(true);
		expect(warntImSaal(QUALIFIZIERT, QUALIFIZIERT)).toBe(false);
		expect(warntImSaal(mit({ ...QUALIFIZIERT, kopfbasis: 'alle_eigentuemer' }), QUALIFIZIERT)).toBe(false);
	});

	it('ohne Mass davor immer, ohne zählbares Mehr nie', () => {
		expect(warntImSaal(EINFACH, null)).toBe(true);
		expect(warntImSaal(null, QUALIFIZIERT)).toBe(false);
		expect(warntImSaal(mit({ typ: 'grenzfall' }), QUALIFIZIERT)).toBe(false);
	});
});
