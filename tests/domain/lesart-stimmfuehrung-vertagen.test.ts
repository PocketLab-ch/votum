/**
 * Lesarten L15 und L16 (Migration 194, Entscheid 0054): je Wahl ein Fall,
 * der rot wird, wenn die Wahl nicht wirkt (Akzeptanzkriterium 7 des Auftrags
 * `2026-11-16-votum-lesarten-stimmfuehrung-vertagen`). Die Sperre am Einlass
 * und das Vertagen am lebenden Stand prüfen `tests/db/lesart-stimmfuehrung`
 * und `tests/db/lesart-vertagen`.
 */
import { describe, expect, it } from 'vitest';
import { folgestufeNachVertagung, zweiteNachLesart } from '$lib/domain/beschlussfaehigkeit';
import { beschlussfaehigkeitssatz, vertretungssatz } from '$lib/domain/einladung';
import {
	L16_EINLADUNG,
	L16_FOLGE,
	LESARTEN,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenwahl
} from '$lib/domain/lesarten';
import { KOPFBASIS_HINWEIS } from '$lib/domain/reglement';
import {
	aendereVersammlung,
	folgestufenSatz,
	vertagenUeberschrift,
	vertagenZweiteNachLesartSatz,
	vertagtMeldung,
	type Versammlung,
	type VersammlungEingabe
} from '$lib/domain/versammlung';
import {
	hoechstzahlMitberechtigte,
	ueberschreitungen,
	vollmachtsgrenzeSatz,
	zaehltZurHoechstzahl,
	type Vertretungsgrund
} from '$lib/domain/vollmacht';
import { angabenInWorten } from '$lib/domain/verlauf';

describe('L15: Stimmführung in der Höchstzahl', () => {
	it('steht im Katalog mit der Vorgabe «ausserhalb»', () => {
		expect(LESARTEN_VORGABE.L15).toBe('ausserhalb');
		expect(lesartVon('L15')!.wahlen.map((w) => w.wert)).toEqual(['ausserhalb', 'mitzaehlen']);
		expect(LESARTEN.map((l) => l.kennung)).not.toContain('L14');
	});

	it('zählt die Stimmführung als Mitberechtigte nur unter «mitzaehlen»', () => {
		expect(zaehltZurHoechstzahl({ vertretungsgrund: 'mitberechtigt' })).toBe(false);
		expect(zaehltZurHoechstzahl({ vertretungsgrund: 'mitberechtigt' }, 'ausserhalb')).toBe(false);
		expect(zaehltZurHoechstzahl({ vertretungsgrund: 'mitberechtigt' }, 'mitzaehlen')).toBe(true);
	});

	it('lässt Organ und gesetzliche Vertretung in beiden Wahlen ausserhalb', () => {
		for (const grund of ['organ', 'gesetzlich'] as Vertretungsgrund[]) {
			expect(zaehltZurHoechstzahl({ vertretungsgrund: grund }, 'mitzaehlen'), grund).toBe(false);
		}
		expect(zaehltZurHoechstzahl({ vertretungsgrund: null }, 'ausserhalb')).toBe(true);
	});

	it('meldet die Überschreitung in der Warnung nur unter «mitzaehlen»', () => {
		const v = (grund: Vertretungsgrund | null) => ({
			zustand: 'bestaetigt' as const,
			bevollmaechtigtId: null,
			bevollmaechtigtName: 'Anna Beispiel',
			vertretungsgrund: grund
		});
		const drei = [v(null), v(null), v('mitberechtigt')];
		expect(ueberschreitungen(drei, { hoechstzahl: 2, fundstelle: null })).toEqual([]);
		expect(ueberschreitungen(drei, { hoechstzahl: 2, fundstelle: null, stimmfuehrung: 'ausserhalb' })).toEqual([]);
		const w = ueberschreitungen(drei, { hoechstzahl: 2, fundstelle: null, stimmfuehrung: 'mitzaehlen' });
		expect(w).toHaveLength(1);
		expect(w[0].anzahl).toBe(3);
	});

	it('nennt den Grund in der Absage, wenn eine Stimmführung mitgezählt ist', () => {
		const grund = 'zählt dabei die Stimme mit, die die Person als Mitberechtigte';
		const basis = { herkunft: 'leitung' as const, waere: 3, name: 'Anna Beispiel', hoechstzahl: 2, fundstelle: 'Ziff. 9' };
		const mit = vollmachtsgrenzeSatz({ ...basis, stimmfuehrungGezaehlt: true });
		const ohne = vollmachtsgrenzeSatz({ ...basis, stimmfuehrungGezaehlt: false });
		expect(mit).toContain(grund);
		expect(mit).toContain('die Stimme als Mitberechtigte zählt nach der Einstellung Ihrer Gemeinschaft mit');
		expect(ohne).not.toContain(grund);
		expect(ohne).toContain('Diese Vollmacht wäre die 3. für Anna Beispiel; das Reglement lässt 2 zu (Ziff. 9).');
		expect(vollmachtsgrenzeSatz({ ...basis, herkunft: 'zugang', stimmfuehrungGezaehlt: true })).toContain(
			'auch ihre Stimme für eine Einheit, die ihr mit anderen zusammen gehört'
		);
	});

	it('sagt auf der Seite «Vollmachten», wie die Gemeinschaft eingestellt hat', () => {
		expect(hoechstzahlMitberechtigte('ausserhalb')).toContain('nicht zur Höchstzahl');
		expect(hoechstzahlMitberechtigte('mitzaehlen')).toContain('zählt nach der Einstellung Ihrer Gemeinschaft zur Höchstzahl');
	});
});

describe('L16: Vertagen nach erreichter Beschlussfähigkeit', () => {
	it('steht im Katalog mit der Vorgabe «neue_erste»', () => {
		expect(LESARTEN_VORGABE.L16).toBe('neue_erste');
		expect(lesartVon('L16')!.folgeMilderWahl).toBe(L16_FOLGE);
		expect(pruefeLesartenwahl({ L16: 'zweite' })).toEqual({ L16: 'zweite' });
	});

	it('legt unter «zweite» nur nach verlorener Beschlussfähigkeit eine zweite an', () => {
		// Fachprüfung 16.11.2026, F-1: noch beschlussfähig heisst in beiden Wahlen neue erste.
		expect(folgestufeNachVertagung('erste', true, 'zweite', false)).toBe('zweite');
		expect(zweiteNachLesart('erste', true, 'zweite', false)).toBe(true);
		expect(folgestufeNachVertagung('erste', true, 'zweite', true)).toBe('erste');
		expect(zweiteNachLesart('erste', true, 'zweite', true)).toBe(false);
		expect(folgestufeNachVertagung('erste', true, 'zweite')).toBe('erste');
	});

	it('bleibt unter der Vorgabe beim heutigen Verhalten', () => {
		expect(folgestufeNachVertagung('erste', true, 'neue_erste', false)).toBe('erste');
		expect(folgestufeNachVertagung('erste', true)).toBe('erste');
		expect(folgestufeNachVertagung('erste', false)).toBe('zweite');
		expect(folgestufeNachVertagung('zweite', false, 'zweite', false)).toBe('erste');
		expect(zweiteNachLesart('erste', false, 'zweite', false)).toBe(false);
	});

	it('wählt Überschrift und Satz des Ausklappers nach der Wahl', () => {
		expect(vertagenUeberschrift(true)).toBe('Vertagen und neue Versammlung ansetzen');
		expect(vertagenUeberschrift(true, 'zweite')).toBe('Vertagen und zweite Versammlung ansetzen');
		const satz = vertagenZweiteNachLesartSatz('Montag, 30. November 2026');
		expect(satz).toContain('und ist es jetzt nicht mehr');
		expect(satz).toContain(L16_FOLGE);
		expect(satz).toContain('Kommen Sie selbst oder geben Sie eine Vollmacht.»');
	});

	it('sagt in der Meldung und am Abend, dass die zweite der Einstellung folgt', () => {
		const folge = { datum: '2026-11-30', uhrzeit: '19:00', ort: 'Saal' };
		expect(vertagtMeldung(folge, 'zweite', '30. November 2026', true)).toContain('Nach der Vorgabe wäre sie eine neue erste.');
		expect(vertagtMeldung(folge, 'zweite', '30. November 2026')).not.toContain('Nach der Vorgabe');
		expect(folgestufenSatz([{ gemeinschaft: 'Haus A', folgestufe: 'zweite', nachLesart: true }])).toContain(
			'«Haus A» war am vertagten Abend schon beschlussfähig'
		);
		expect(folgestufenSatz([{ gemeinschaft: 'Haus A', folgestufe: 'zweite' }])).not.toContain('schon beschlussfähig');
	});

	it('hängt den Zusatz nur an die Einladung einer zweiten nach L16', () => {
		expect(beschlussfaehigkeitssatz('zweite', null, true)).toContain(L16_EINLADUNG);
		expect(beschlussfaehigkeitssatz('zweite', null)).not.toContain(L16_EINLADUNG);
		expect(beschlussfaehigkeitssatz('erste', null, true)).not.toContain(L16_EINLADUNG);
	});

	it('nennt im Verlauf des Vertagens, dass die zweite der Einstellung folgt', () => {
		// Codeprüfung N1: gespeichert wird ein Wahrheitswert, wie in `vertageVersammlung`.
		const text = angabenInWorten({ folgestufe: 'zweite', nachLesart: true });
		expect(text).toContain('Zweite nach der Einstellung L16 (die vertagte war schon beschlussfähig): ja');
	});
});

describe('Frage 93: Hinweis an der Bezugsgrösse der Kopfstimmen', () => {
	it('grenzt an den Abwesenden ab, nicht am Wort «aller»', () => {
		// Fachprüfung 16.11.2026, F-2.
		expect(KOPFBASIS_HINWEIS).toContain('«Mehrheit aller Stockwerkeigentümer», wählen Sie bei den Köpfen «anwesende und vertretene Stimmen»');
		expect(KOPFBASIS_HINWEIS).toContain('dass auch die Abwesenden mitzählen, die sich nicht vertreten lassen');
	});
});

describe('L16: das Merkmal beim Ändern der Versammlung (Codeprüfung N8)', () => {
	const bisher = {
		id: 'm-2',
		operatorId: 'o',
		stwegId: 's',
		zustand: 'entwurf',
		datum: '2026-11-30',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'zweite',
		betriebsart: 'gefuehrt',
		vorgaengerId: 'm-1',
		vorgaengerDatum: '2026-11-16',
		stufeNachLesart: true
	} as unknown as Versammlung;
	const eingabe = {
		stwegId: 's',
		datum: '2026-12-01',
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'zweite',
		betriebsart: 'gefuehrt',
		vorgaengerId: 'm-1',
		vorgaengerDatum: '2026-11-16'
	} as VersammlungEingabe;

	it('bleibt an derselben zweiten auf dieselbe Vorgängerin', () => {
		expect(aendereVersammlung(bisher, eingabe).ergebnis.stufeNachLesart).toBe(true);
	});

	it('fällt weg, wenn Stufe oder Vorgängerin wechseln', () => {
		expect(aendereVersammlung(bisher, { ...eingabe, stufe: 'erste', vorgaengerId: null }).ergebnis.stufeNachLesart).toBeUndefined();
		expect(aendereVersammlung(bisher, { ...eingabe, vorgaengerId: 'm-9' }).ergebnis.stufeNachLesart).toBeUndefined();
	});
});

describe('L15: der Ausweg in der Absage unter «mitzaehlen» (Codeprüfung Durchgang 2)', () => {
	it('nennt nur Organ und gesetzliche Vertretung, auch ohne gezählte Stimmführung', () => {
		const satz = vollmachtsgrenzeSatz({
			herkunft: 'leitung',
			waere: 3,
			name: 'Anna Beispiel',
			hoechstzahl: 2,
			fundstelle: null,
			stimmfuehrungGezaehlt: false,
			stimmfuehrung: 'mitzaehlen'
		});
		expect(satz).toContain('Handelt die Person als Organ oder von Gesetzes wegen?');
		expect(satz).not.toContain('Handelt die Person nicht kraft Vollmacht?');
		expect(satz).not.toContain('zählt dabei die Stimme mit');
	});
});

describe('L15 in Einladung und Vollmachtsformular (Featureprüfung)', () => {
	it('nennt die Stimmführung bei der Höchstzahl nur unter «mitzaehlen»', () => {
		const zusatz = 'wenn sie daneben für eine eigene Einheit stimmt';
		expect(vertretungssatz(3, 'Ziff. 9', true)).toContain(zusatz);
		expect(vertretungssatz(3, 'Ziff. 9')).not.toContain(zusatz);
		expect(vertretungssatz(null, null, true)).not.toContain(zusatz);
	});
});
