/**
 * Der von Hand festgehaltene Beschluss im Kern (Plan
 * `docs/plan-beschluss-von-hand-2026-09-30.md`, Block 1).
 *
 * Was hier steht, lässt sich ohne Datenbank sagen: wie aus der Eingabe eine
 * Auszählung wird, was die Sätze nach aussen weglassen und dass die
 * Festschreibung das Merkmal trägt. Das Zusammenspiel mit Durchgängen,
 * Rückkommen und Verlauf prüft `tests/db/beschluss-von-hand.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	ERFORDERNIS_VON_HAND,
	auszaehlungVonHand,
	begruendungVonHand,
	beschlussVonHandEreignis,
	eingabeAusFormular,
	quittungVonHand,
	ueberholtInWorten,
	verlangeVonHandMoeglich,
	VON_HAND_BEGRUENDUNG_HOECHSTENS,
	VON_HAND_EINLEITUNG,
	VON_HAND_FESTGEHALTEN,
	VON_HAND_OHNE_BESCHLUSS
} from '../../src/lib/domain/vonhand';
import {
	beschlussGilt,
	ergebnisInWorten,
	ergebnislage,
	ergebniswertung,
	vonHandZahlen
} from '../../src/lib/domain/auszaehlung';
import { ausFestschreibung, festschreibung } from '../../src/lib/domain/festschreibung';
import { ABWEICHUNGSARTEN } from '../../src/lib/domain/verlauf';
import type { Erfordernis } from '../../src/lib/domain/entscheidbaum';
import type { Snapshot } from '../../src/lib/domain/types';

/** Ein Erfordernis mit beiden Schwellen: Sein Wortlaut darf in keinem Satz stehen. */
const QUALIFIZIERT: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-bau',
	knotenId: 'k-nuetzlich',
	typ: 'qualifiziertes_mehr',
	titel: 'Nützliche bauliche Massnahme',
	rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'alle_quoten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

function momentaufnahme(zaehlweise: 'per_owner' | 'per_unit'): Snapshot {
	return {
		meetingId: 'v',
		takenAt: '2027-01-01T00:00:00.000Z',
		headCountMode: zaehlweise,
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: [
			{
				partyId: 'a',
				displayName: 'Probe Alpha',
				representativeName: null,
				isCommunity: false,
				units: [
					{ unitId: 'a1', label: 'Whg 1', kind: 'unit', countsAsHead: true, quota: 250.5 },
					{ unitId: 'a2', label: 'Whg 2', kind: 'unit', countsAsHead: true, quota: 149.5 },
					{ unitId: 'ap', label: 'Platz 1', kind: 'parking', countsAsHead: true, quota: 10 }
				]
			},
			{
				partyId: 'b',
				displayName: 'Probe Beta',
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: 'b1', label: 'Whg 3', kind: 'unit', countsAsHead: true, quota: 290 }]
			},
			{
				partyId: 'c',
				displayName: 'Probe Gamma',
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: 'c1', label: 'Whg 4', kind: 'unit', countsAsHead: true, quota: 300 }]
			}
		]
	};
}

const SUMMEN = {
	ergebnis: 'angenommen',
	zahlen: {
		erfassung: 'summen',
		koepfe: { ja: 5, nein: 2, enthaltung: 1 },
		quoten: { ja: 620, nein: 280.5, enthaltung: 99.5 }
	}
} as const;

describe('Auszählung aus Summen', () => {
	it('trägt die eingetragenen Zahlen und keine Schwelle', () => {
		const a = auszaehlungVonHand(SUMMEN, null);
		expect(a.koepfe).toEqual({
			ja: 5,
			nein: 2,
			enthaltung: 1,
			ohneAbgabe: 0,
			nichtAnwesend: 0,
			basis: 8,
			schwelle: null,
			erreicht: true
		});
		expect(a.quoten.ja).toBe(620);
		expect(a.quoten.schwelle).toBeNull();
		expect(a.vonHand).toEqual({ erfassung: 'summen' });
		expect(a.quotenErhoben).toBeUndefined();
		expect(a.hinweise).toEqual([]);
	});

	it('setzt das Ergebnis, wie die Leitung es wählt, auch gegen die Zahlen', () => {
		// Genau dafür gibt es den Weg: Eine Wertung aus den Zahlen wäre wieder
		// die Regel des Werkzeugs.
		const a = auszaehlungVonHand(
			{ ergebnis: 'abgelehnt', zahlen: { erfassung: 'summen', koepfe: { ja: 7, nein: 1, enthaltung: 0 }, quoten: null } },
			null
		);
		expect(a.angenommen).toBe(false);
		expect(ergebnislage(a)).toBe('abgelehnt');
		expect(beschlussGilt(a)).toBe(true);
	});

	it('unterscheidet «Wertquoten nicht eingetragen» von «null Wertquoten»', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'summen', koepfe: { ja: 3, nein: 0, enthaltung: 0 }, quoten: null } },
			null
		);
		expect(a.quotenErhoben).toBe(false);
	});

	it('weist ab, was keine Zahl ist, und nennt das Feld', () => {
		const mit = (koepfe: { ja: number; nein: number; enthaltung: number }) => () =>
			auszaehlungVonHand({ ergebnis: 'angenommen', zahlen: { erfassung: 'summen', koepfe, quoten: null } }, null);
		expect(mit({ ja: -1, nein: 0, enthaltung: 0 })).toThrow(/«Ja» bei den Kopfstimmen/);
		expect(mit({ ja: 1, nein: 1.5, enthaltung: 0 })).toThrow(/«Nein» bei den Kopfstimmen/);
		expect(mit({ ja: 1, nein: 1, enthaltung: Number.NaN })).toThrow(/«Enthaltung»/);
		expect(() =>
			auszaehlungVonHand(
				{
					ergebnis: 'angenommen',
					zahlen: {
						erfassung: 'summen',
						koepfe: { ja: 1, nein: 0, enthaltung: 0 },
						quoten: { ja: Number.POSITIVE_INFINITY, nein: 0, enthaltung: 0 }
					}
				},
				null
			)
		).toThrow(/«Ja» bei den Wertquoten/);
	});

	it('kennt keine Obergrenze: Der Weg führt an den Sperren vorbei', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'summen', koepfe: { ja: 900, nein: 0, enthaltung: 0 }, quoten: null } },
			null
		);
		expect(a.koepfe.ja).toBe(900);
	});

	it('weist eine Eingabe ab, deren Form nicht stimmt, statt sie als Summen zu lesen', () => {
		const mit = (zahlen: unknown) => () =>
			auszaehlungVonHand({ ergebnis: 'angenommen', zahlen: zahlen as never }, null);
		for (const zahlen of [
			null,
			{},
			{ erfassung: 'irgendwas', koepfe: { ja: 1, nein: 0, enthaltung: 0 }, quoten: null },
			{ erfassung: 'summen' },
			{ erfassung: 'summen', koepfe: null, quoten: null },
			{ erfassung: 'parteien' },
			{ erfassung: 'parteien', stimmen: 'a' },
			{ erfassung: 'parteien', stimmen: [null] }
		]) {
			expect(mit(zahlen)).toThrow(/als Summen ein oder wählen Sie je Partei/);
		}
	});

	it('verlangt ein Ergebnis', () => {
		expect(() =>
			auszaehlungVonHand(
				{ ergebnis: 'vielleicht' as never, zahlen: { erfassung: 'summen', koepfe: { ja: 1, nein: 0, enthaltung: 0 }, quoten: null } },
				null
			)
		).toThrow(/angenommen oder abgelehnt/);
	});
});

describe('Auszählung aus der Wahl je Partei', () => {
	const stimmen = [
		{ parteiId: 'a', wahl: 'yes' },
		{ parteiId: 'b', wahl: 'no' },
		{ parteiId: 'c', wahl: 'abstain' }
	] as const;

	it('zählt je Eigentümer einen Kopf und summiert die Wertquoten der Einheiten', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'parteien', stimmen: [...stimmen] } },
			momentaufnahme('per_owner')
		);
		expect([a.koepfe.ja, a.koepfe.nein, a.koepfe.enthaltung]).toEqual([1, 1, 1]);
		// 250.5 + 149.5 + 10: ohne Runden stünde hier ein Bruchteil am Ende.
		expect([a.quoten.ja, a.quoten.nein, a.quoten.enthaltung]).toEqual([410, 290, 300]);
		expect(a.vonHand).toEqual({
			erfassung: 'parteien',
			stimmen: [
				{ partei: 'a', wahl: 'yes' },
				{ partei: 'b', wahl: 'no' },
				{ partei: 'c', wahl: 'abstain' }
			]
		});
	});

	it('zählt je Einheit nach der Zählweise der Momentaufnahme, ohne den Parkplatz', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'parteien', stimmen: [...stimmen] } },
			momentaufnahme('per_unit')
		);
		expect([a.koepfe.ja, a.koepfe.nein, a.koepfe.enthaltung]).toEqual([2, 1, 1]);
	});

	it('lässt eine Partei ohne Wahl in keiner Zahl stehen', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'parteien', stimmen: [{ parteiId: 'b', wahl: 'yes' }] } },
			momentaufnahme('per_owner')
		);
		expect(a.koepfe.basis).toBe(1);
		expect(a.koepfe.ohneAbgabe).toBe(0);
		expect(a.koepfe.nichtAnwesend).toBe(0);
	});

	it('weist eine fremde Partei, eine doppelte Wahl und eine fehlende Momentaufnahme ab', () => {
		const m = momentaufnahme('per_owner');
		const mit = (s: { parteiId: string; wahl: 'yes' | 'no' | 'abstain' }[], snap: Snapshot | null = m) => () =>
			auszaehlungVonHand({ ergebnis: 'angenommen', zahlen: { erfassung: 'parteien', stimmen: s } }, snap);
		expect(mit([{ parteiId: 'fremd', wahl: 'yes' }])).toThrow(/nicht im festgehaltenen Stand/);
		expect(mit([{ parteiId: 'a', wahl: 'yes' }, { parteiId: 'a', wahl: 'no' }])).toThrow(
			/«Probe Alpha» ist mehr als eine Wahl/
		);
		expect(mit([{ parteiId: 'a', wahl: 'vielleicht' as never }])).toThrow(/weder Ja noch Nein/);
		// Ein geerbtes Merkmal ist keine Wahl.
		expect(mit([{ parteiId: 'a', wahl: 'constructor' as never }])).toThrow(/weder Ja noch Nein/);
		expect(mit([{ parteiId: 'a', wahl: 'toString' as never }])).toThrow(/weder Ja noch Nein/);
		expect(mit([{ parteiId: 'a', wahl: 'yes' }], null)).toThrow(/als Summen/);
	});
});

describe('Was nach aussen geht', () => {
	const a = auszaehlungVonHand(SUMMEN, null);
	const VERRAETER = /nötig|Hälfte|Mehrheit|Massnahme|647d|hergeleitet|ohne Abgabe|von Hand|Grund|Bezugsgrösse/;

	it('nennt im Leinwandsatz Ergebnis und Zahlen, aber kein Erfordernis und keine Schwelle', () => {
		const satz = ergebnisInWorten(a, QUALIFIZIERT);
		expect(satz).toBe(
			'Angenommen. Kopfstimmen: 5 Ja, 2 Nein, 1 Enthaltung; Wertquoten: 620 Ja, 280.5 Nein, 99.5 Enthaltung.'
		);
		expect(satz).not.toMatch(VERRAETER);
	});

	it('nennt im Protokollsatz nur das Ergebnis, auch bei einer Ablehnung', () => {
		expect(ergebniswertung(a, QUALIFIZIERT)).toBe('Angenommen.');
		const nein = auszaehlungVonHand({ ...SUMMEN, ergebnis: 'abgelehnt' }, null);
		// Ohne den eigenen Zweig stünde hier «der Grund ist nicht festgehalten».
		expect(ergebniswertung(nein, QUALIFIZIERT)).toBe('Abgelehnt.');
		expect(ergebnisInWorten(nein, QUALIFIZIERT)).not.toMatch(VERRAETER);
	});

	it('lässt Zahlen weg, die nicht eingetragen sind', () => {
		const ohne = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'summen', koepfe: { ja: 0, nein: 0, enthaltung: 0 }, quoten: null } },
			null
		);
		expect(ergebnisInWorten(ohne, QUALIFIZIERT)).toBe('Angenommen.');
		expect(vonHandZahlen(ohne.koepfe)).toBeNull();
		const nurKoepfe = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'summen', koepfe: { ja: 4, nein: 0, enthaltung: 0 }, quoten: null } },
			null
		);
		expect(ergebnisInWorten(nurKoepfe, QUALIFIZIERT)).toBe('Angenommen. Kopfstimmen: 4 Ja, 0 Nein, 0 Enthaltung.');
	});

	it('schreibt Zahlen so, wie der Aufrufer es vorgibt: das Protokoll in seiner Schreibweise', () => {
		const sp = { ja: 1000, nein: 0, enthaltung: 0 };
		expect(vonHandZahlen(sp)).toBe('1000 Ja, 0 Nein, 0 Enthaltung');
		// Ein fester Formatierer statt `toLocaleString`: Welches Trennzeichen
		// «de-CH» liefert, hängt an der Laufzeit (gemessen: im Container «'»).
		expect(vonHandZahlen(sp, (n) => `«${n}»`)).toBe('«1000» Ja, «0» Nein, «0» Enthaltung');
	});

	it('Gegenprobe: Ohne das Merkmal nennt derselbe Satz das Erfordernis', () => {
		const { vonHand: _weg, ...gerechnet } = a;
		expect(ergebnisInWorten(gerechnet, QUALIFIZIERT)).toMatch(/Hälfte/);
	});
});

describe('Festschreibung', () => {
	it('trägt das Merkmal unter Format 1 hin und zurück', () => {
		const a = auszaehlungVonHand(
			{ ergebnis: 'angenommen', zahlen: { erfassung: 'parteien', stimmen: [{ parteiId: 'a', wahl: 'yes' }] } },
			momentaufnahme('per_owner')
		);
		const huelle = JSON.parse(JSON.stringify(festschreibung(a)));
		expect(huelle.format).toBe(1);
		expect(ausFestschreibung(huelle)).toEqual(a);
	});
});

describe('Grenzen des Notwegs', () => {
	const lage = { versammlungszustand: 'laufend', traktandumtitel: 'Dachsanierung', zurueckgezogen: false };

	it('geht nur bei laufender Versammlung', () => {
		expect(() => verlangeVonHandMoeglich(lage)).not.toThrow();
		expect(() => verlangeVonHandMoeglich({ ...lage, versammlungszustand: 'freigegeben' })).toThrow(
			/noch nicht eröffnet/
		);
		expect(() => verlangeVonHandMoeglich({ ...lage, versammlungszustand: 'geschlossen' })).toThrow(
			/läuft nicht mehr/
		);
	});

	it('nennt beim zurückgezogenen Antrag den Weg', () => {
		expect(() => verlangeVonHandMoeglich({ ...lage, zurueckgezogen: true })).toThrow(
			/«Dachsanierung» ist zurückgezogen.*Rückzug zurück/
		);
	});
});

describe('Begründung', () => {
	it('ist freiwillig und begrenzt', () => {
		expect(begruendungVonHand(undefined)).toBeNull();
		expect(begruendungVonHand('   ')).toBeNull();
		expect(begruendungVonHand(' Neues Urteil ')).toBe('Neues Urteil');
		expect(() => begruendungVonHand('x'.repeat(VON_HAND_BEGRUENDUNG_HOECHSTENS + 1))).toThrow(/höchstens/);
	});
});

describe('Verlaufseintrag', () => {
	const e = beschlussVonHandEreignis({
		durchgangId: 'd',
		meetingId: 'v',
		traktandumId: 't',
		traktandumtitel: 'Dachsanierung',
		nummer: 2,
		auszaehlung: auszaehlungVonHand(
			{ ergebnis: 'abgelehnt', zahlen: { erfassung: 'summen', koepfe: { ja: 1, nein: 3, enthaltung: 0 }, quoten: null } },
			null
		),
		begruendung: null,
		uebergangen: [{ kennung: 'nicht_beschlussfaehig', satz: 'Die Versammlung ist nicht beschlussfähig.' }],
		ueberholt: [{ durchgang: 1, offen: true, art: 'notweg' }]
	});

	it('ist eine Abweichung, hängt am Durchgang und trägt die Versammlung', () => {
		expect(ABWEICHUNGSARTEN.has(e.art)).toBe(true);
		expect(e.gegenstandArt).toBe('voting_round');
		expect(e.gegenstandId).toBe('d');
		expect(e.angaben).toMatchObject({
			versammlung: 'v',
			traktandumId: 't',
			durchgang: 2,
			ergebnis: 'abgelehnt',
			erfassung: 'summen',
			koepfe: { ja: 1, nein: 3, enthaltung: 0 },
			quoten: null,
			begruendung: null,
			ueberholt: [{ durchgang: 1, offen: true, art: 'notweg' }],
			abweichung: {
				uebergangen: [{ kennung: 'nicht_beschlussfaehig', satz: 'Die Versammlung ist nicht beschlussfähig.' }]
			}
		});
	});
});

describe('Platzhalter-Erfordernis', () => {
	it('behauptet keine Regel', () => {
		expect(ERFORDERNIS_VON_HAND.typ).toBe('grenzfall');
		expect(ERFORDERNIS_VON_HAND.kopfSchwelle).toBeNull();
		expect(ERFORDERNIS_VON_HAND.rechtsgrundlage).toBe('');
	});
});

describe('Das Formular der Maske (Block 2)', () => {
	function formular(felder: Record<string, string>): FormData {
		const daten = new FormData();
		for (const [name, wert] of Object.entries(felder)) daten.append(name, wert);
		return daten;
	}

	it('liest die Summen als Zahlen und leere Wertquoten als «nicht eingetragen»', () => {
		const e = eingabeAusFormular(
			formular({
				erfassung: 'summen',
				koepfe_ja: '3',
				koepfe_nein: '1',
				koepfe_enthaltung: '0',
				quoten_ja: '',
				quoten_nein: '',
				quoten_enthaltung: '',
				ergebnis: 'angenommen'
			})
		);
		expect(e).toEqual({
			ergebnis: 'angenommen',
			zahlen: {
				erfassung: 'summen',
				koepfe: { ja: 3, nein: 1, enthaltung: 0 },
				quoten: null
			},
			begruendung: ''
		});
		// Und der Kern liest das als «Wertquoten nicht erhoben», nicht als Nullen.
		expect(auszaehlungVonHand(e, null).quotenErhoben).toBe(false);
	});

	it('macht aus einem leeren Kopffeld keine stille Null', () => {
		const e = eingabeAusFormular(
			formular({
				erfassung: 'summen',
				koepfe_ja: '',
				koepfe_nein: '0',
				koepfe_enthaltung: '0',
				ergebnis: 'abgelehnt'
			})
		);
		expect(e.zahlen).toMatchObject({ koepfe: { ja: Number.NaN } });
		expect(() => auszaehlungVonHand(e, null)).toThrow(/«Ja» bei den Kopfstimmen/);
	});

	it('sammelt die Wahl je Partei und lässt «nichts» weg', () => {
		const e = eingabeAusFormular(
			formular({
				erfassung: 'parteien',
				wahl_a: 'yes',
				wahl_b: '',
				wahl_c: 'no',
				ergebnis: 'angenommen'
			})
		);
		expect(e.zahlen).toEqual({
			erfassung: 'parteien',
			stimmen: [
				{ parteiId: 'a', wahl: 'yes' },
				{ parteiId: 'c', wahl: 'no' }
			]
		});
	});

	it('gibt ein fehlendes Ergebnis leer weiter, damit der Kern es abweist', () => {
		const e = eingabeAusFormular(
			formular({
				erfassung: 'summen',
				koepfe_ja: '1',
				koepfe_nein: '0',
				koepfe_enthaltung: '0'
			})
		);
		expect(e.ergebnis).toBe('');
		expect(() => auszaehlungVonHand(e, null)).toThrow(/angenommen oder abgelehnt/);
	});

	it('weist «je Partei» ohne eine einzige Wahl ab, statt null zu null festzuschreiben', () => {
		const e = eingabeAusFormular(
			formular({ erfassung: 'parteien', wahl_a: '', wahl_b: '', ergebnis: 'angenommen' })
		);
		expect(e.zahlen).toEqual({ erfassung: 'parteien', stimmen: [] });
		expect(() => auszaehlungVonHand(e, { parties: [] } as never)).toThrow(
			/mindestens eine Partei/
		);
	});

	it('reicht eine unbekannte Erfassung durch, damit der Kern sie abweist', () => {
		const faelle: Record<string, string>[] = [
			{ koepfe_ja: '1', koepfe_nein: '0', koepfe_enthaltung: '0', ergebnis: 'angenommen' },
			{ erfassung: 'irgendwas', koepfe_ja: '1', koepfe_nein: '0', koepfe_enthaltung: '0', ergebnis: 'angenommen' }
		];
		for (const felder of faelle) {
			expect(() => auszaehlungVonHand(eingabeAusFormular(formular(felder)), null)).toThrow(
				/als Summen ein oder wählen Sie je Partei/
			);
		}
	});

	it('nimmt die Begründung mit, leer bleibt leer', () => {
		expect(
			eingabeAusFormular(formular({ erfassung: 'summen', begruendung: '' })).begruendung
		).toBe('');
		expect(
			eingabeAusFormular(formular({ erfassung: 'summen', begruendung: 'Neues Urteil' }))
				.begruendung
		).toBe('Neues Urteil');
	});
});

describe('Das Überholte in Worten (Block 2)', () => {
	it('nennt Durchgang, Vorgang und Traktandum', () => {
		expect(ueberholtInWorten({ durchgang: 2, offen: false, art: 'notweg', traktandum: null })).toBe(
			'Der bisherige Beschluss (2. Durchgang) wird überholt; an seine Stelle tritt der neue Eintrag.'
		);
		expect(
			ueberholtInWorten({
				durchgang: 1,
				offen: true,
				art: 'notweg',
				traktandum: '7.1 Nur die Wetterseite'
			})
		).toBe(
			'Der offene 1. Durchgang beim Traktandum «7.1 Nur die Wetterseite» wird ohne Auszählung beendet und überholt; schon abgegebene Stimmen zählen nicht.'
		);
		expect(
			ueberholtInWorten({ durchgang: 1, offen: false, art: 'rueckkommen', traktandum: null })
		).toBe(
			'Der bisherige Beschluss (1. Durchgang) wird ersetzt, weil die Versammlung das Rückkommen angenommen hat.'
		);
	});

	it('führt im Ausweg beide Fälle: nicht abgestimmt, und abgestimmt ohne Mehr', () => {
		// Fachprüfung 01.10.2026: Ein verfehltes Mehr, auch bei Stimmengleichheit,
		// ist eine Ablehnung und gehört eingetragen, nicht in die Notiz.
		expect(VON_HAND_OHNE_BESCHLUSS).toMatch(/nicht abgestimmt.*halten Sie hier nichts fest/);
		expect(VON_HAND_OHNE_BESCHLUSS).toMatch(/«Voten, Begründungen, Ordnungsentscheide»/);
		expect(VON_HAND_OHNE_BESCHLUSS).toMatch(/auch bei Stimmengleichheit, ist er abgelehnt/);
	});

	it('nennt in der Quittung die Anfechtbarkeit nur, wo die Beschlussfähigkeit fehlte', () => {
		expect(quittungVonHand([{ kennung: 'nicht_beschlussfaehig' }])).toMatch(
			/festgehalten.*kann angefochten werden/
		);
		expect(quittungVonHand([{ kennung: 'ohne_rueckkommen' }])).not.toMatch(/angefochten/);
		expect(quittungVonHand([])).not.toMatch(/angefochten/);
	});

	it('sagt in keinem Satz der Maske, der Beschluss «gelte»', async () => {
		// Fach- und Laienprüfung 01.10.2026: Die Rechtswirkung kann das Werkzeug
		// nicht zusagen; es sagt, was Wand und Protokoll zeigen. Gelesen werden
		// alle Sätze der Maske, nicht nur die zwei, die es einmal sagten.
		const modul = await import('../../src/lib/domain/vonhand');
		const saetze = Object.entries(modul).filter(
			([name, wert]) => name.startsWith('VON_HAND_') && typeof wert === 'string'
		) as [string, string][];
		expect(saetze.length).toBeGreaterThanOrEqual(20);
		for (const [name, satz] of saetze) {
			expect(satz, name).not.toMatch(/\bg[ie]lt(e|en|et)?\b|\bgültig/);
		}
		for (const satz of [VON_HAND_EINLEITUNG, VON_HAND_FESTGEHALTEN]) {
			expect(satz).toMatch(/Wand und Protokoll zeigen/);
		}
	});
});
