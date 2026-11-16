import { describe, expect, it } from 'vitest';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	bestimmeVertretungsgrund,
	brauchtNachweis,
	istBestaetigbar,
	mitberechtigtenhinweis,
	verlangeEinGrundEinePartei,
	gleicheDrittePerson,
	sperrgrundAmEinlass,
	verwaltungshakenAmEinlass,
	vertretungsgrundInWorten,
	istOffen,
	istWirksam,
	pruefeEingabe,
	uebersicht,
	ueberschreitungen,
	verlangeBeendbar,
	verlangeBestaetigbar,
	verlangeGrund,
	vertretungszeitraeume,
	SELBST_ERSCHIENEN,
	VERTRETUNGSGRUND_TEXT,
	type Vollmacht
} from '$lib/domain/vollmacht';

function vollmacht(u: Partial<Vollmacht> = {}): Vollmacht {
	return {
		id: 'p-1',
		meetingId: 'm-1',
		vertreteneId: 's-1',
		vertreteneName: 'Aebi',
		bevollmaechtigtId: 's-2',
		bevollmaechtigtName: 'Bucher',
		zustand: 'erfasst',
		herkunft: 'leitung',
		istVerwaltung: false,
		vertretungsgrund: null,
		mitberechtigung: null,
		nachweisVorgelegt: false,
		anzahlDateien: 0,
		bemerkung: null,
		erfasstAm: '2026-08-04T10:00:00.000Z',
		erfasstDurch: 'Prüfer',
		bestaetigtAm: null,
		bestaetigtDurch: null,
		beendetAm: null,
		beendetGrund: null,
		beendetDurch: null,
		...u
	};
}

describe('Eine Vollmacht erfassen', () => {
	it('nimmt eine Partei dieser Versammlung als bevollmächtigt an', () => {
		const e = pruefeEingabe({ vertreteneId: 's-1', bevollmaechtigtId: 's-2' });
		expect(e.bevollmaechtigtId).toBe('s-2');
		expect(e.bevollmaechtigtName).toBeNull();
	});

	it('nimmt eine dritte Person mit Namen an', () => {
		const e = pruefeEingabe({ vertreteneId: 's-1', bevollmaechtigtName: '  Ruth Kunz ' });
		expect(e.bevollmaechtigtId).toBeNull();
		expect(e.bevollmaechtigtName).toBe('Ruth Kunz');
	});

	it('weist beides zugleich ab', () => {
		// Zwei Vertreter liessen offen, wer im Saal die Hand hebt.
		expect(() => pruefeEingabe({ vertreteneId: 's-1', bevollmaechtigtId: 's-2', bevollmaechtigtName: 'Kunz' }))
			.toThrow(FachlicherFehler);
	});

	it('weist keines von beidem ab', () => {
		expect(() => pruefeEingabe({ vertreteneId: 's-1' })).toThrow(/bevollmächtigte Person/i);
	});

	it('weist die Selbstbevollmächtigung ab', () => {
		expect(() => pruefeEingabe({ vertreteneId: 's-1', bevollmaechtigtId: 's-1' })).toThrow(
			/bevollmächtigt sich selbst/i
		);
	});

	it('weist einen zu kurzen Namen ab', () => {
		expect(() => pruefeEingabe({ vertreteneId: 's-1', bevollmaechtigtName: 'K' })).toThrow(
			FachlicherFehler
		);
	});
});

describe('Erst prüfen, dann aktivieren', () => {
	it('überträgt nichts, solange sie nur erfasst ist', () => {
		expect(istWirksam(vollmacht())).toBe(false);
		expect(istOffen(vollmacht())).toBe(true);
	});

	it('überträgt erst als bestätigte', () => {
		expect(istWirksam(vollmacht({ zustand: 'bestaetigt' }))).toBe(true);
	});

	it('lässt sich ohne Nachweis nicht bestätigen', () => {
		expect(() => verlangeBestaetigbar(vollmacht())).toThrow(/ohne Nachweis/i);
	});

	it('genügt sich mit dem vorgelegten Original', () => {
		// Der übliche Weg am Eingang: Original gesehen, Foto kommt später (FR-24).
		expect(() => verlangeBestaetigbar(vollmacht({ nachweisVorgelegt: true }))).not.toThrow();
	});

	it('genügt sich mit einer hinterlegten Datei', () => {
		expect(() => verlangeBestaetigbar(vollmacht({ anzahlDateien: 1 }))).not.toThrow();
	});

	it('bestätigt nicht zweimal', () => {
		expect(() =>
			verlangeBestaetigbar(vollmacht({ zustand: 'bestaetigt', nachweisVorgelegt: true }))
		).toThrow(/bereits bestätigt/i);
	});

	it('belebt eine beendete nicht wieder', () => {
		expect(() =>
			verlangeBestaetigbar(vollmacht({ zustand: 'zurueckgewiesen', nachweisVorgelegt: true }))
		).toThrow(/beendet/i);
		expect(() => verlangeBeendbar(vollmacht({ zustand: 'widerrufen' }))).toThrow(/bereits beendet/i);
	});
});

describe('Die Begründung', () => {
	it('ist Pflicht', () => {
		expect(() => verlangeGrund('')).toThrow(FachlicherFehler);
		expect(() => verlangeGrund('  ')).toThrow(FachlicherFehler);
		expect(() => verlangeGrund(null)).toThrow(FachlicherFehler);
	});

	it('gibt den bereinigten Wortlaut zurück', () => {
		expect(verlangeGrund('  Unterschrift fehlt.  ')).toBe('Unterschrift fehlt.');
	});
});

describe('Die Schranke aus dem Reglement', () => {
	const namen = new Map([
		['s-2', 'Bucher'],
		['s-3', 'Christen']
	]);

	it('prüft nichts ohne hinterlegte Zahl — das Gesetz kennt keine', () => {
		const dreimal = [
			vollmacht({ id: 'a', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', zustand: 'bestaetigt' }),
			vollmacht({ id: 'c', zustand: 'bestaetigt' })
		];
		expect(ueberschreitungen(dreimal, { hoechstzahl: null, fundstelle: null }, namen)).toEqual([]);
	});

	it('meldet, wer mehr hält als erlaubt', () => {
		const drei = [
			vollmacht({ id: 'a', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', zustand: 'bestaetigt' }),
			vollmacht({ id: 'c', zustand: 'erfasst' })
		];
		const w = ueberschreitungen(drei, { hoechstzahl: 2, fundstelle: 'Art. 27' }, namen);
		expect(w).toHaveLength(1);
		expect(w[0].bevollmaechtigt).toBe('Bucher');
		expect(w[0].anzahl).toBe(3);
		expect(w[0].satz).toContain('Art. 27');
		// **Seit dem 24.09.2026 ist die Liste ein Nachlauf, kein Wächter**: Das
		// Erfassen sperrt. Der Satz darf deshalb nicht mehr zur Zulassung einladen,
		// sondern muss die Folge und den Weg zurück nennen.
		expect(w[0].satz).not.toMatch(/entscheidet die Versammlung/);
		expect(w[0].satz).toMatch(/machen den Beschluss angreifbar/);
		expect(w[0].satz).toMatch(/von einer anderen Person vertreten/);
	});

	it('zählt die Vertretung von Gesetzes wegen nicht mit (Ä-28)', () => {
		// Die Warnung muss hier dasselbe tun wie die Sperre, sonst meldet sie eine
		// Überschreitung, die keine ist — und die Sitzungsleitung sucht am
		// Versammlungsabend nach einem Fehler, den es nicht gibt.
		const namen = new Map([['s-2', 'Bucher']]);
		const drei = [
			vollmacht({ id: 'a', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', zustand: 'bestaetigt' }),
			vollmacht({ id: 'c', zustand: 'erfasst', vertretungsgrund: 'organ' })
		];
		const w = ueberschreitungen(drei, { hoechstzahl: 2, fundstelle: 'Art. 27' }, namen);
		expect(w).toHaveLength(0);
	});

	it('zählt beendete nicht mit', () => {
		// Sonst wüchse die Zahl mit jeder Berichtigung, und die Warnung stünde da,
		// obwohl niemand mehr als erlaubt vertritt.
		const mitBeendeten = [
			vollmacht({ id: 'a', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', zustand: 'zurueckgewiesen' }),
			vollmacht({ id: 'c', zustand: 'widerrufen' })
		];
		expect(ueberschreitungen(mitBeendeten, { hoechstzahl: 1, fundstelle: 'Art. 27' }, namen))
			.toEqual([]);
	});

	it('zählt dritte Personen über ihren Namen', () => {
		const dritte = [
			vollmacht({ id: 'a', bevollmaechtigtId: null, bevollmaechtigtName: 'Ruth Kunz', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', bevollmaechtigtId: null, bevollmaechtigtName: 'Ruth Kunz', zustand: 'bestaetigt' })
		];
		const w = ueberschreitungen(dritte, { hoechstzahl: 1, fundstelle: null }, namen);
		expect(w).toHaveLength(1);
		expect(w[0].bevollmaechtigt).toBe('Ruth Kunz');
	});
});

describe('Die Übersicht', () => {
	it('führt je vertretener Partei die wirksame Vollmacht', () => {
		const u = uebersicht([
			vollmacht({ id: 'a', vertreteneId: 's-1', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', vertreteneId: 's-3', zustand: 'erfasst' })
		]);
		expect(u.wirksamJeVertretene.get('s-1')?.id).toBe('a');
		expect(u.wirksamJeVertretene.has('s-3')).toBe(false);
		expect(u.anzahlOffen).toBe(1);
		expect(u.anzahlWirksam).toBe(1);
	});

	it('führt je bevollmächtigter Person alle Vollmachten, die sie hält', () => {
		const u = uebersicht([
			vollmacht({ id: 'a', vertreteneId: 's-1', bevollmaechtigtId: 's-2', zustand: 'bestaetigt' }),
			vollmacht({ id: 'b', vertreteneId: 's-3', bevollmaechtigtId: 's-2', zustand: 'bestaetigt' })
		]);
		expect(u.wirksamJeBevollmaechtigt.get('s-2')).toHaveLength(2);
	});

	it('führt eine dritte Person nicht als Partei', () => {
		// Sie ist nicht stimmberechtigt; sie taucht in keiner Parteiliste auf.
		const u = uebersicht([
			vollmacht({ bevollmaechtigtId: null, bevollmaechtigtName: 'Ruth Kunz', zustand: 'bestaetigt' })
		]);
		expect(u.wirksamJeBevollmaechtigt.size).toBe(0);
		expect(u.anzahlWirksam).toBe(1);
	});
});

/**
 * Ä-09, Block 2 der Freigabeliste: Welche Vollmacht galt nur für einen Teil
 * der Abstimmungen? Zeiten in UTC; im Mai ist Zürich zwei Stunden voraus.
 */
describe('vertretungszeitraeume', () => {
	const geschlossen = [
		{ geschlossenAm: '2026-05-19T17:30:00.000Z', anwesende: ['s-1'], traktandum: '2' },
		{ geschlossenAm: '2026-05-19T18:30:00.000Z', anwesende: ['s-1'], traktandum: '3' }
	];
	const bestaetigt = (u: Partial<Vollmacht>) =>
		vollmacht({ zustand: 'bestaetigt', bestaetigtAm: '2026-05-19T16:50:00.000Z', ...u });

	it('lässt die Vollmacht weg, die den ganzen Abend galt', () => {
		expect(vertretungszeitraeume([bestaetigt({})], geschlossen).size).toBe(0);
	});

	it('nennt die Vollmacht, die zwischen zwei Abstimmungen endete, mit ihrem Ende', () => {
		const v = bestaetigt({ zustand: 'widerrufen', beendetAm: '2026-05-19T18:00:00.000Z' });
		expect(vertretungszeitraeume([v], geschlossen).get('s-1')).toEqual([
			{ durch: 'Bucher', ab: null, bis: '2026-05-19T18:00:00.000Z', traktanden: ['2'], ende: 'beendet' }
		]);
	});

	it('lässt eine Vollmacht weg, die vor der ersten Abstimmung endete', () => {
		const v = bestaetigt({ zustand: 'widerrufen', beendetAm: '2026-05-19T17:00:00.000Z' });
		expect(vertretungszeitraeume([v], geschlossen).size).toBe(0);
	});

	it('nennt den Beginn einer Vollmacht, die erst nach einer Abstimmung galt', () => {
		const v = bestaetigt({ bestaetigtAm: '2026-05-19T18:00:00.000Z' });
		expect(vertretungszeitraeume([v], geschlossen).get('s-1')).toEqual([
			{ durch: 'Bucher', ab: '2026-05-19T18:00:00.000Z', bis: null, traktanden: ['3'], ende: null }
		]);
	});

	it('nennt bei einer Vertretung von Gesetzes wegen den Grund wie die Anwesenheitsliste', () => {
		const v = bestaetigt({
			zustand: 'widerrufen',
			beendetAm: '2026-05-19T18:00:00.000Z',
			vertretungsgrund: 'organ'
		});
		expect(vertretungszeitraeume([v], geschlossen).get('s-1')?.[0].durch).toBe(
			`Bucher (${VERTRETUNGSGRUND_TEXT.organ})`
		);
	});

	it('erkennt das eigene Erscheinen als Grund des Endes', () => {
		const v = bestaetigt({
			zustand: 'widerrufen',
			beendetAm: '2026-05-19T18:00:00.000Z',
			beendetGrund: SELBST_ERSCHIENEN
		});
		expect(vertretungszeitraeume([v], geschlossen).get('s-1')?.[0].ende).toBe('selbst_erschienen');
	});

	it('lässt eine beendete Vollmacht weg, wenn die Partei bei keiner Abstimmung anwesend war', () => {
		// Bucher kam nie: Die Vollmacht galt, aber niemand stimmte über sie ab.
		const v = bestaetigt({ zustand: 'widerrufen', beendetAm: '2026-05-19T18:00:00.000Z' });
		const ohne = geschlossen.map((g) => ({ ...g, anwesende: [] }));
		expect(vertretungszeitraeume([v], ohne).size).toBe(0);
		// Ohne festgeschriebenen Stand zählt allein die Uhrzeit.
		const ohneStand = geschlossen.map((g) => ({ ...g, anwesende: null }));
		expect(vertretungszeitraeume([v], ohneStand).size).toBe(1);
	});

	it('übergeht zurückgewiesene und nie bestätigte Vollmachten', () => {
		const zurueck = vollmacht({
			zustand: 'zurueckgewiesen',
			beendetAm: '2026-05-19T18:00:00.000Z'
		});
		const offen = vollmacht({ id: 'p-2', vertreteneId: 's-3' });
		expect(vertretungszeitraeume([zurueck, offen], geschlossen).size).toBe(0);
	});
});

/*
 * **Mitberechtigte an gemeinschaftlichem Eigentum** (Produktentscheid
 * 03.11.2026, Fachprüfung F1 in zwei Runden). Ein allein anwesender
 * Mitberechtigter führt die eine Stimme der Einheit kraft vermuteter
 * Vollmacht (Rz. 19, 24 ad Art. 712o); Votum zählt sie als Regel der
 * Anwendung nicht zur Höchstzahl. Die Fehler davor: ein Klick statt einer
 * Herleitung, im Formular für Drittpersonen angeboten, ein Grund für alle
 * Vertretenen, und ein Nachweis auch dort, wo keiner nötig ist.
 */
describe('Mitberechtigte: Herleitung statt Klick', () => {
	it('setzt «mitberechtigt» für die eigene gemeinsame Einheit selbst, ohne Nachweis', () => {
		const g = bestimmeVertretungsgrund({
			gewaehlt: null,
			vertreteneIstHuelle: true,
			bevollmaechtigtIstMitglied: true
		});
		expect(g).toEqual({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'eingetragen' });
		const v = vollmacht({ ...g });
		expect(brauchtNachweis(v)).toBe(false);
		expect(() => verlangeBestaetigbar(v)).not.toThrow();
		expect(istBestaetigbar(v)).toBe(true);
	});

	it('leitet je Vertretener her: die gemeinsame Einheit frei, drei fremde zählen', () => {
		// Bucher hält Whg 4 mit Aebi gemeinsam und bringt drei Nachbarn mit.
		const huelle = bestimmeVertretungsgrund({
			gewaehlt: null,
			vertreteneIstHuelle: true,
			bevollmaechtigtIstMitglied: true
		});
		const fremd = ['x', 'y', 'z'].map(() =>
			bestimmeVertretungsgrund({ gewaehlt: null, vertreteneIstHuelle: false, bevollmaechtigtIstMitglied: false })
		);
		expect(fremd.every((f) => f.vertretungsgrund === null)).toBe(true);

		const namen = new Map([['s-2', 'Bucher']]);
		const vier = [
			vollmacht({ id: 'h', vertreteneId: 's-h', zustand: 'bestaetigt', ...huelle }),
			...fremd.map((f, i) => vollmacht({ id: `f${i}`, vertreteneId: `s-f${i}`, zustand: 'bestaetigt', ...f }))
		];
		// Grenze 3: die drei fremden gehen auf, die gemeinsame Einheit zählt nicht.
		expect(ueberschreitungen(vier, { hoechstzahl: 3, fundstelle: null }, namen)).toEqual([]);
		// Grenze 2: gemeldet werden genau die drei fremden, nicht vier.
		const w = ueberschreitungen(vier, { hoechstzahl: 2, fundstelle: null }, namen);
		expect(w).toHaveLength(1);
		expect(w[0].anzahl).toBe(3);
	});

	it('lässt «nicht eingetragen» für eine gemeinschaftliche Einheit zu, mit Nachweis', () => {
		const g = bestimmeVertretungsgrund({
			gewaehlt: 'mitberechtigt',
			vertreteneIstHuelle: true,
			bevollmaechtigtIstMitglied: false
		});
		expect(g).toEqual({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'nicht_eingetragen' });
		expect(() => verlangeBestaetigbar(vollmacht({ ...g, nachweisVorgelegt: true }))).not.toThrow();
		expect(() => verlangeBestaetigbar(vollmacht({ ...g, anzahlDateien: 1 }))).not.toThrow();
	});

	it('weist «nicht eingetragen» ohne Nachweis der Mitberechtigung ab', () => {
		const v = vollmacht({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'nicht_eingetragen' });
		expect(brauchtNachweis(v)).toBe(true);
		expect(() => verlangeBestaetigbar(v)).toThrow(/Nachweis der Mitberechtigung/);
	});

	it('lässt «nicht im Register» auch für eine Einzelperson zu, aber nur mit Nachweis', () => {
		/*
		 * **Hier stand bis zur Fachprüfung vom 03.11.2026 (C6) eine Absage.**
		 * Stirbt die Alleineigentümerin, gehört die Einheit den Erben gemeinsam
		 * (Art. 560 Abs. 2, 602 Abs. 2 ZGB), auch wenn das Register sie noch als
		 * Einzelperson führt. Die Schranke bleibt der Nachweis.
		 */
		const g = bestimmeVertretungsgrund({
			gewaehlt: 'mitberechtigt',
			vertreteneIstHuelle: false,
			bevollmaechtigtIstMitglied: false
		});
		expect(g).toEqual({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'nicht_eingetragen' });
		expect(() => verlangeBestaetigbar(vollmacht({ ...g }))).toThrow(/Nachweis der Mitberechtigung/);
		expect(() => verlangeBestaetigbar(vollmacht({ ...g, nachweisVorgelegt: true }))).not.toThrow();
	});

	it('nimmt eine dritte Person nie als eingetragen: von Hand heisst «nicht eingetragen»', () => {
		// Eine dritte Person hat keine Parteikennung, also kein Register.
		const g = bestimmeVertretungsgrund({
			gewaehlt: 'mitberechtigt',
			vertreteneIstHuelle: true,
			bevollmaechtigtIstMitglied: false
		});
		expect(g.mitberechtigung).toBe('nicht_eingetragen');
		const ohneWahl = bestimmeVertretungsgrund({
			gewaehlt: null,
			vertreteneIstHuelle: true,
			bevollmaechtigtIstMitglied: false
		});
		expect(ohneWahl.vertretungsgrund).toBeNull();
	});

	it('lässt Organ und gesetzliche Vertretung, wie gewählt', () => {
		for (const gewaehlt of ['organ', 'gesetzlich'] as const) {
			expect(
				bestimmeVertretungsgrund({ gewaehlt, vertreteneIstHuelle: false, bevollmaechtigtIstMitglied: false })
			).toEqual({ vertretungsgrund: gewaehlt, mitberechtigung: null });
		}
	});

	it('verlangt bei «mitberechtigt» ohne Vermerk weiter einen Nachweis (vor dem 03.11.2026)', () => {
		// So war es beim Erfassen; die Umdeutung des Bestands wäre eine Aussage
		// über Vorgänge, die niemand mehr prüfen kann (Migration 120).
		const alt = vollmacht({ vertretungsgrund: 'mitberechtigt', mitberechtigung: null });
		expect(() => verlangeBestaetigbar(alt)).toThrow(/ohne Nachweis/i);
	});

	it('nennt im Protokolltext den Vermerk «nicht eingetragen»', () => {
		expect(vertretungsgrundInWorten({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'nicht_eingetragen' }))
			.toBe(
				'mitberechtigt an derselben Einheit, nicht als Mitberechtigte im Register eingetragen, ' +
					'Nachweis der Mitberechtigung'
			);
		expect(vertretungsgrundInWorten({ vertretungsgrund: 'mitberechtigt', mitberechtigung: 'eingetragen' }))
			.toBe(VERTRETUNGSGRUND_TEXT.mitberechtigt);
		expect(vertretungsgrundInWorten({ vertretungsgrund: null, mitberechtigung: null })).toBeNull();
	});
});

describe('Ein Grund, eine Partei', () => {
	it('weist Organ mit mehreren Vertretenen ab', () => {
		expect(() => verlangeEinGrundEinePartei('organ', 2)).toThrow(/nur für eine einzige Partei/);
	});

	it('weist jeden Grund von Hand mit mehreren Vertretenen ab', () => {
		expect(() => verlangeEinGrundEinePartei('gesetzlich', 3)).toThrow(/einzeln/);
		expect(() => verlangeEinGrundEinePartei('mitberechtigt', 2)).toThrow(/einzeln/);
	});

	it('lässt einen Grund für eine Partei und keinen Grund für mehrere zu', () => {
		expect(() => verlangeEinGrundEinePartei('organ', 1)).not.toThrow();
		expect(() => verlangeEinGrundEinePartei(null, 4)).not.toThrow();
	});
});

describe('Mehrere Mitberechtigte im Saal', () => {
	it('sagt, wer bestimmt, was die Leitung tut, mit dem Vorbehalt des Reglements', () => {
		const h = mitberechtigtenhinweis({ huelle: 'Erbengemeinschaft Muster', fuehrt: 'Anna Muster' });
		expect(h).toContain('die Stimme führt zurzeit Anna Muster');
		expect(h).toMatch(/Die anwesenden Mitberechtigten bestimmen/);
		expect(h).toMatch(/Bei Miteigentum genügt die Mehrheit/);
		expect(h).toMatch(/Einen Nachweis braucht es nicht/);
		expect(h).toMatch(/auf der Seite Vollmachten/);
		expect(h).toMatch(/sofern das Reglement nichts anderes bestimmt/);
		// Die Handlung bei Uneinigkeit (Laienprüfung 03.11.2026, C8-1, hoch).
		expect(h).toMatch(/keine Stimme von Erbengemeinschaft Muster/);
	});
});

describe('Vorab erfasste Vollmacht am Einlass einer dritten Person (E3)', () => {
	const vorab = { gesperrt: 'bereits bevollmächtigt an Muster Verwaltung AG', vorabFuer: 'Muster Verwaltung AG' };

	it('gibt die Partei für dieselbe Person frei, auch bei anderer Schreibung', () => {
		expect(sperrgrundAmEinlass(vorab, 'Muster Verwaltung AG')).toBeNull();
		expect(sperrgrundAmEinlass(vorab, '  muster  verwaltung ag ')).toBeNull();
		expect(gleicheDrittePerson('Muster Verwaltung AG', 'muster verwaltung ag')).toBe(true);
	});

	it('Gegenprobe: eine Vollmacht an eine andere Person bleibt gesperrt', () => {
		expect(sperrgrundAmEinlass(vorab, 'Erika Beispiel')).toBe(vorab.gesperrt);
		expect(sperrgrundAmEinlass(vorab, '')).toBe(vorab.gesperrt);
		expect(gleicheDrittePerson('Muster Verwaltung AG', '')).toBe(false);
		expect(gleicheDrittePerson(null, 'Muster Verwaltung AG')).toBe(false);
	});

	it('lässt andere Sperrgründe stehen, etwa die schon anwesende Partei', () => {
		expect(sperrgrundAmEinlass({ gesperrt: 'bereits anwesend — übt selbst aus' }, 'Muster Verwaltung AG')).toBe(
			'bereits anwesend — übt selbst aus'
		);
	});
});

describe('Häkchen «Verwaltung» am Einlass einer dritten Person (E3)', () => {
	it('entfernt die Kennzeichnung, wenn das vorbelegte Kästchen abgewählt ist', () => {
		expect(verwaltungshakenAmEinlass(null, 'ja')).toBe(false);
	});

	it('Gegenprobe: ein nie vorbelegtes, leeres Kästchen heisst «nicht angegeben» (B1)', () => {
		expect(verwaltungshakenAmEinlass(null, 'nein')).toBeUndefined();
		expect(verwaltungshakenAmEinlass(null, null)).toBeUndefined();
	});

	it('setzt die Kennzeichnung, wenn das nicht vorbelegte Kästchen angekreuzt ist', () => {
		expect(verwaltungshakenAmEinlass('ja', 'nein')).toBe(true);
		expect(verwaltungshakenAmEinlass('ja', null)).toBe(true);
	});

	it('ändert nichts, wenn das vorbelegte Kästchen unberührt bleibt (Codeprüfung E3, M1)', () => {
		// Eine veraltete Seite setzte sonst eine Kennzeichnung wieder, die die
		// Leitung inzwischen unter Vollmachten entfernt hat.
		expect(verwaltungshakenAmEinlass('ja', 'ja')).toBeUndefined();
	});
});
