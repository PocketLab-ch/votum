/**
 * Die konsultative Abstimmung im Kern (Migration 158; Auftrag H7, Teil B).
 *
 * Was hier steht, gilt ohne Datenbank: wann sie zulässig ist, dass ihr
 * Ausgang an jeder Stelle «kein Beschluss» heisst, und dass das Protokoll
 * einen überholten konsultativen Durchgang mit seinen Zahlen nennt. Der Weg
 * über Eröffnen, Schliessen und Protokoll steht in
 * `tests/db/abstimmung.test.ts` (Beschreibung «H7, Teil B»).
 */
import { describe, expect, it } from 'vitest';
import {
	KONSULTATIV_KURZ,
	KONSULTATIV_SATZ,
	KONSULTATIV_WEG,
	KONSULTATIV_WERTUNG,
	entscheidetDasGeschaeft,
	nurKonsultativSatz,
	abschlussOhneBeschluss,
	verlangeKonsultativZulaessig
} from '../../src/lib/domain/konsultativ';
import { moeglicheEingriffe, type Traktandumslage } from '../../src/lib/domain/eingriffe';
import {
	durchgangWiederEroeffenbar,
	keinBeschlussKurz,
	keinBeschlussNamenszeilen,
	keinBeschlussSatz,
	wegNachKeinemBeschluss,
	type KeinBeschluss
} from '../../src/lib/domain/ausnahmen';
import {
	beschlossen,
	ergebnisInWorten,
	ergebnislage,
	ergebniswertung,
	mitKeinemBeschluss,
	zustimmungBetroffenerGefragt,
	UNIVERSAL_NICHT_ERFUELLT,
	type Auszaehlung
} from '../../src/lib/domain/auszaehlung';
import { verlangeRueckkommbar } from '../../src/lib/domain/rueckkommen';
import { protokollentwurf, type Protokolleingabe, type Protokollzeile } from '../../src/lib/domain/protokoll';
import { FachlicherFehler } from '../../src/lib/domain/fehler';

const KONSULTATIV: KeinBeschluss = { grund: 'konsultativ', namen: [] };

function kennung(f: () => void): string | null {
	try {
		f();
		return null;
	} catch (e) {
		expect(e).toBeInstanceOf(FachlicherFehler);
		return (e as FachlicherFehler).kennung;
	}
}

describe('Wann konsultativ abgestimmt werden darf', () => {
	const ohne = { beschlussfaehig: false, universal: false, rueckkommen: false, beschlussGilt: false };

	it('nur bei fehlender Beschlussfähigkeit', () => {
		expect(kennung(() => verlangeKonsultativZulaessig(ohne))).toBeNull();
		expect(kennung(() => verlangeKonsultativZulaessig({ ...ohne, beschlussfaehig: true }))).toBe(
			'konsultativ_beschlussfaehig'
		);
	});

	it('nicht unter der Universalversammlung und nicht unter einem Rückkommen', () => {
		expect(kennung(() => verlangeKonsultativZulaessig({ ...ohne, universal: true }))).toBe(
			'konsultativ_universal'
		);
		expect(kennung(() => verlangeKonsultativZulaessig({ ...ohne, rueckkommen: true }))).toBe(
			'konsultativ_rueckkommen'
		);
	});

	it('nicht, solange zum Geschäft ein Beschluss gilt (Codeprüfung 14.10.2026, H1)', () => {
		expect(kennung(() => verlangeKonsultativZulaessig({ ...ohne, beschlussGilt: true }))).toBe(
			'konsultativ_beschluss'
		);
	});
});

describe('Der Ausgang einer konsultativen Abstimmung', () => {
	/** Eine Ja-Mehrheit mit offenem Gleichstand: beides darf nicht stehen bleiben. */
	const ausgezaehlt = {
		koepfe: { ja: 3, nein: 1 },
		quoten: {},
		betroffene: {},
		ohneZustimmung: [],
		angenommen: true,
		durchStichentscheid: false,
		stichentscheidOffen: true,
		stichentscheidArt: null,
		hinweise: []
	} as unknown as Auszaehlung;

	it('ist kein Beschluss, weder angenommen noch abgelehnt', () => {
		const a = mitKeinemBeschluss(ausgezaehlt, KONSULTATIV);
		expect(a.angenommen).toBe(false);
		expect(a.stichentscheidOffen).toBe(false);
		expect(ergebnislage(a)).toBe('kein_beschluss');
		expect(beschlossen(ergebnislage(a))).toBeNull();
	});

	it('sagt an Wand und im Protokoll «konsultativ», nicht «Universalversammlung»', () => {
		const a = mitKeinemBeschluss(ausgezaehlt, KONSULTATIV);
		expect(ergebnisInWorten(a, {} as never)).toBe(KONSULTATIV_SATZ);
		expect(ergebniswertung(a, {} as never)).toBe(KONSULTATIV_WERTUNG);
		expect(ergebniswertung(a, {} as never)).not.toMatch(/Universalversammlung/);
		expect(keinBeschlussSatz(KONSULTATIV)).toBe(KONSULTATIV_SATZ);
		expect(keinBeschlussKurz(KONSULTATIV)).toBe(`Kein Beschluss: ${KONSULTATIV_KURZ}`);
	});

	it('sagt unter der Universalversammlung «nicht erfüllt», nicht «entfallen» (F2, UV (12) N-c)', () => {
		const a = mitKeinemBeschluss(ausgezaehlt, { grund: 'weggang', namen: ['Muster AG'] });
		expect(ergebniswertung(a, {} as never)).toBe(UNIVERSAL_NICHT_ERFUELLT);
		expect(ergebniswertung(a, {} as never)).not.toMatch(/entfallen/);
	});

	it('nennt keine Namen und den Weg über die Beschlussfähigkeit', () => {
		expect(keinBeschlussNamenszeilen(KONSULTATIV)).toEqual([]);
		expect(wegNachKeinemBeschluss(KONSULTATIV)).toBe(KONSULTATIV_WEG);
	});

	it('lässt neu eröffnen, wie nach einem Weggang', () => {
		expect(durchgangWiederEroeffenbar({ konsultativ: true, universal: null })).toBe(true);
		expect(durchgangWiederEroeffenbar({ konsultativ: false, universal: null })).toBe(false);
		expect(
			durchgangWiederEroeffenbar({
				konsultativ: false,
				universal: { stand: { keinBeschluss: { grund: 'weggang', namen: ['B'] } } }
			})
		).toBe(true);
	});

	it('weist ein Rückkommen ab und nennt den Weg dazu', () => {
		const ziel = {
			id: 't',
			nummer: '3',
			titel: 'Ersatz der Gegensprechanlage',
			behandelt: true,
			rueckkommenOffen: false,
			zurueckgezogen: false,
			keinBeschluss: true,
			konsultativ: true
		};
		expect(() => verlangeRueckkommbar(ziel)).toThrow(/nur konsultativ abgestimmt/);
		expect(() => verlangeRueckkommbar(ziel)).toThrow(KONSULTATIV_WEG);
		// Ohne das Merkmal bleibt der Satz zum Weggang.
		expect(() => verlangeRueckkommbar({ ...ziel, konsultativ: false })).toThrow(/Weggang/);
	});
});

describe('Ein überholter konsultativer Durchgang im Protokoll', () => {
	function zeile(u: Partial<Protokollzeile> = {}): Protokollzeile {
		return {
			nummer: '1',
			tiefe: 0,
			titel: 'Ersatz der Gegensprechanlage',
			art: 'abstimmung',
			antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
			kurzfassung: null,
			notiz: null,
			erfordernis: 'Einfaches Mehr',
			rechtsgrundlage: 'ZGB 712m Abs. 2',
			rueckzug: null,
			beschlusstext: null,
			pendenzen: [],
			satz: 'Angenommen.',
			zahlen: {
				koepfe: { ja: 4, nein: 1, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 5, schwelle: 3 },
				quoten: { ja: 800, nein: 200, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 1000, schwelle: null }
			},
			quotenErhoben: true,
			handzaehlung: null,
			ohneZustimmung: [],
			durchgang: 2,
			frueherenDurchgaenge: 1,
			frueherenDurchRueckkommen: 0,
			rueckkommenErfolglos: false,
			antragsteller: null,
			folgeantraegeAngenommen: null,
			stichentscheid: null,
			stellvertretend: [],
			spontan: false,
			vorgezogen: false,
			...u
		};
	}

	function text(z: Partial<Protokollzeile>): string {
		const eingabe: Protokolleingabe = {
			gemeinschaft: 'STWEG Probeweg',
			datum: '2027-08-11',
			uhrzeit: '19:00',
			ort: 'Probesaal',
			art: 'ordentlich',
			stufe: 'erste',
			schlusszeit: '21:00',
			sitzungsleitung: null,
			protokollfuehrung: null,
			beschlussfaehigkeit: null,
			zaehlweise: 'Eine Stimme je Einheit',
			stichentscheid: null,
			teilnehmer: [],
			zeilen: [zeile(z)],
			erzeugtAm: '11. August 2027, 21:30',
			erzeugtDurch: 'Prüfer'
		};
		return protokollentwurf(eingabe).replace(/\s+/g, ' ');
	}

	const konsultativFrueher: Protokollzeile['konsultativFrueher'] = [
		{
			nummer: 1,
			zahlen: {
				// Zwei von fünf da, 400 von 1000 Wertquoten: nicht beschlussfähig
				// (Art. 712p Abs. 1; Fachprüfung 14.10.2026, Bemerkung zu K8).
				koepfe: { ja: 1, nein: 1, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 3, basis: 5, schwelle: 3 },
				quoten: { ja: 250, nein: 150, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 600, basis: 1000, schwelle: 501 }
			}
		}
	];

	it('nennt ihn mit seinen Zahlen und ohne Schwelle', () => {
		const t = text({ konsultativFrueher });
		expect(t).toContain(
			'- Im 1. Durchgang wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig ' +
				'war; ein Beschluss entstand dabei nicht. Kopfstimmen: 1 Ja, 1 Nein, 0 Enthaltung, ' +
				'0 ohne Abgabe, 3 nicht anwesend (von 5).'
		);
		expect(t).toContain('Wertquoten: 250 Ja, 150 Nein');
		// Die Schwelle steht beim massgebenden Durchgang, nicht beim konsultativen.
		const zeile = t.split(' - ').find((z) => z.startsWith('Im 1. Durchgang')) ?? '';
		expect(zeile).toContain('(von 5)');
		expect(zeile).not.toMatch(/nötig/);
		expect(t).toContain('(von 5), nötig 3');
		expect(t).toContain('- 2. Durchgang.');
		// Erklärt: keine Zeile «weitere frühere Durchgänge».
		expect(t).not.toMatch(/Weitere frühere Durchgänge|siehe Verlauf/);
	});

	it('nennt keine Zahlen bei geheimer Abstimmung', () => {
		const t = text({ konsultativFrueher: [{ nummer: 1, zahlen: null }] });
		expect(t).toContain(
			'- Im 1. Durchgang wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig ' +
				'war; ein Beschluss entstand dabei nicht.'
		);
		expect(t).not.toMatch(/Kopfstimmen: 1 Ja/);
	});
});

describe('Nach einer konsultativen Abstimmung ist das Geschäft offen (H7, Teil D)', () => {
	/*
	 * **Eine Frage für Seiten und Server** (Produktentscheid 14.10.2026, «Ja,
	 * offen»). Leitung, Erfordernisseite und Abend fragen hier, ob ein
	 * Durchgang das Geschäft entschieden hat; die SQL-Fassungen daneben tragen
	 * `NOT consultative`.
	 */
	it('zählt einen geschlossenen konsultativen Durchgang nicht als entschieden', () => {
		expect(entscheidetDasGeschaeft({ zustand: 'geschlossen', konsultativ: true })).toBe(false);
		// Gegenprobe: verbindlich geschlossen entscheidet, offen und überholt nicht.
		expect(entscheidetDasGeschaeft({ zustand: 'geschlossen', konsultativ: false })).toBe(true);
		expect(entscheidetDasGeschaeft({ zustand: 'geschlossen' })).toBe(true);
		expect(entscheidetDasGeschaeft({ zustand: 'offen' })).toBe(false);
		expect(
			entscheidetDasGeschaeft({ zustand: 'geschlossen', ueberholtAm: '2026-10-14T19:00:00Z' })
		).toBe(false);
	});

	it('bietet danach Ausstand, Betroffene, Gegenantrag, Rückzug und Mehrheit an, kein Rückkommen', () => {
		const lage: Traktandumslage = {
			art: 'abstimmung',
			abgestimmt: false,
			keinBeschluss: true,
			konsultativ: true,
			durchgangOffen: false,
			zurueckgezogen: false,
			rueckkommenLaeuft: false,
			hatErfordernis: true
		};
		const e = moeglicheEingriffe(lage);
		expect(e.map((x) => x.art)).toEqual([
			'ausstand',
			'betroffene',
			'gegenantrag',
			'zurueckziehen',
			'mehrheit'
		]);
		// «Es gab keine Abstimmung» stimmt nicht mehr; der Satz sagt, was war.
		const rueckzug = e.find((x) => x.art === 'zurueckziehen')!.satz;
		expect(rueckzug).not.toMatch(/keine Abstimmung/);
		expect(rueckzug).toMatch(/konsultative Abstimmung bleibt mit ihren Zahlen im Protokoll/);
		expect(e.find((x) => x.art === 'mehrheit')!.satz).toMatch(/nur konsultativ/);
		// Berichtigen, nicht dem Ergebnis anpassen (Fachprüfung D6, Rz. 99, 100 ad Art. 712n).
		expect(e.find((x) => x.art === 'mehrheit')!.satz).toMatch(/nicht das konsultative Ergebnis/);
		// Der Gegenantrag mit dem Satz vor der Abstimmung, nicht dem nach einem Rückkommen.
		expect(e.find((x) => x.art === 'gegenantrag')!.satz).toMatch(/zuerst abgestimmt/);

		// Gegenprobe: nach einem verbindlichen Beschluss nur das Rückkommen.
		expect(
			moeglicheEingriffe({ ...lage, abgestimmt: true, keinBeschluss: false, konsultativ: false }).map(
				(x) => x.art
			)
		).toEqual(['rueckkommen']);
	});
});

describe('Rückzug nach einer konsultativen Abstimmung im Protokoll (H7, Teil D)', () => {
	function text(z: Partial<Protokollzeile>): string {
		const eingabe: Protokolleingabe = {
			gemeinschaft: 'STWEG Probeweg',
			datum: '2027-08-11',
			uhrzeit: '19:00',
			ort: 'Probesaal',
			art: 'ordentlich',
			stufe: 'erste',
			schlusszeit: '21:00',
			sitzungsleitung: null,
			protokollfuehrung: null,
			beschlussfaehigkeit: null,
			zaehlweise: 'Eine Stimme je Einheit',
			stichentscheid: null,
			teilnehmer: [],
			zeilen: [
				{
					nummer: '1',
					tiefe: 0,
					titel: 'Ersatz der Gegensprechanlage',
					art: 'abstimmung',
					antragswortlaut: 'Die Gegensprechanlage wird ersetzt.',
					kurzfassung: null,
					notiz: null,
					erfordernis: null,
					rechtsgrundlage: null,
					rueckzug: null,
					beschlusstext: null,
					pendenzen: [],
					satz: KONSULTATIV_WERTUNG,
					zahlen: {
						koepfe: { ja: 0, nein: 2, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 3, basis: 5, schwelle: null },
						quoten: { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null }
					},
					quotenErhoben: true,
					handzaehlung: null,
					ohneZustimmung: [],
					durchgang: 1,
					frueherenDurchgaenge: 0,
					frueherenDurchRueckkommen: 0,
					rueckkommenErfolglos: false,
					antragsteller: null,
					folgeantraegeAngenommen: null,
					stichentscheid: null,
					stellvertretend: [],
					spontan: false,
					vorgezogen: false,
					...z
				}
			],
			erzeugtAm: '11. August 2027, 21:30',
			erzeugtDurch: 'Prüfer'
		};
		return protokollentwurf(eingabe).replace(/\s+/g, ' ');
	}

	it('nennt den Rückzug und den konsultativen Durchgang mit seinen Zahlen', () => {
		const t = text({
			rueckzug: 'Die Offerte wird überarbeitet.',
			konsultativFrueher: [
				{
					nummer: 1,
					zahlen: {
						koepfe: { ja: 0, nein: 2, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 3, basis: 5, schwelle: null },
						quoten: null
					}
				}
			]
		});
		expect(t).toContain(
			'Der Antrag wurde nach der konsultativen Abstimmung zurückgezogen: Die Offerte wird ' +
				'überarbeitet.'
		);
		// Ohne Ordnungszahl: Es gab nur diesen Durchgang (Laienprüfung, D3).
		expect(t).toContain(
			'- Es wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig ' +
				'war; ein Beschluss entstand dabei nicht. Kopfstimmen: 0 Ja, 2 Nein'
		);
		expect(t).not.toMatch(/Im 1\. Durchgang/);
		expect(t).toContain('Verbindlich abgestimmt wurde nicht; ein Beschluss ist nicht gefasst worden.');
		expect(t).not.toMatch(/vor der Abstimmung zurückgezogen|Es wurde nicht abgestimmt/);
	});

	it('nennt die Nummern, wo es mehrere Durchgänge gab', () => {
		const zahlen = {
			koepfe: { ja: 0, nein: 2, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 3, basis: 5, schwelle: null },
			quoten: null
		};
		const t = text({
			rueckzug: 'Die Offerte wird überarbeitet.',
			durchgang: 2,
			frueherenDurchgaenge: 1,
			konsultativFrueher: [
				{ nummer: 1, zahlen },
				{ nummer: 2, zahlen }
			]
		});
		expect(t).toContain('- Im 1. Durchgang wurde konsultativ abgestimmt');
		expect(t).toContain('- Im 2. Durchgang wurde konsultativ abgestimmt');
	});

	it('sagt nicht «verbindlich abgestimmt wurde nicht», wo ein verbindlicher Durchgang abgebrochen wurde', () => {
		// Codeprüfung 14.10.2026, Befund 3: zuerst verbindlich, abgebrochen (H6),
		// dann ohne Beschlussfähigkeit konsultativ, dann zurückgezogen.
		const t = text({
			rueckzug: 'Die Offerte wird überarbeitet.',
			durchgang: 2,
			frueherenDurchgaenge: 1,
			neuabstimmungen: [
				{ nummer: 1, begruendung: null, ergebnis: null, unentschieden: false, abgebrochen: true }
			],
			konsultativFrueher: [
				{
					nummer: 2,
					zahlen: {
						koepfe: { ja: 0, nein: 2, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 3, basis: 5, schwelle: null },
						quoten: null
					}
				}
			]
		});
		expect(t).toMatch(/im 1\. Durchgang ohne Ergebnis abgebrochen/);
		expect(t).toContain('- Im 2. Durchgang wurde konsultativ abgestimmt');
		expect(t).not.toMatch(/Verbindlich abgestimmt wurde nicht/);
		expect(t).toContain('Ein Beschluss ist nicht gefasst worden.');
	});

	it('nennt beim Schliessen die nur konsultativ abgestimmten Anträge eigens, mit Nummer (Befund 2, F2)', () => {
		expect(nurKonsultativSatz(['4'], false)).toBe(
			'Über den Antrag zu Traktandum 4 wurde nur konsultativ abgestimmt; er bleibt ohne Beschluss ' +
				'und gehört an eine neue Versammlung.'
		);
		expect(nurKonsultativSatz(['4', '5', '6.1'], false)).toMatch(
			/^Über die Anträge zu den Traktanden 4, 5 und 6\.1 wurde nur konsultativ abgestimmt; sie bleiben/
		);
	});

	it('nennt an einer ersten Versammlung den Weg übers Vertagen, an einer zweiten nicht (F2, E1)', () => {
		const vertagen = /Sie können stattdessen auf der Seite «Anwesenheit» vertagen/;
		expect(nurKonsultativSatz(['4'], true)).toMatch(vertagen);
		expect(nurKonsultativSatz(['4'], true)).toMatch(/Traktanden aus der Einladung, über die nicht beschlossen wurde\.$/);
		expect(nurKonsultativSatz(['4'], false)).not.toMatch(vertagen);
	});

	it('nennt beim Vertagen die im Saal aufgenommenen, die nicht mitgehen (Laien- und Fachprüfung F2, S1)', () => {
		expect(nurKonsultativSatz(['4', '6.1'], true, ['6.1'])).toMatch(
			/ Traktandum 6\.1 wurde im Saal aufgenommen und geht nicht mit; traktandieren Sie es selbst neu\.$/
		);
		expect(nurKonsultativSatz(['6.1', '7'], true, ['6.1', '7'])).toMatch(
			/ Die Traktanden 6\.1 und 7 wurden im Saal aufgenommen und gehen nicht mit; traktandieren Sie sie selbst neu\.$/
		);
		// Ohne Vertagen ist die Unterscheidung bedeutungslos.
		expect(nurKonsultativSatz(['6.1'], false, ['6.1'])).not.toMatch(/im Saal/);
	});

	it('sagt bei einer konsultativen Abstimmung nichts zur Zustimmung der Betroffenen (F2, H7 D (h))', () => {
		const betroffene = { noetig: true } as Auszaehlung['betroffene'];
		expect(zustimmungBetroffenerGefragt({ betroffene, keinBeschluss: undefined })).toBe(true);
		expect(
			zustimmungBetroffenerGefragt({ betroffene, keinBeschluss: { grund: 'konsultativ', namen: [] } })
		).toBe(false);
		// Unter der Universalversammlung bleibt der Stand stehen: Dort war die Zustimmung gefragt.
		expect(
			zustimmungBetroffenerGefragt({ betroffene, keinBeschluss: { grund: 'weggang', namen: ['Muster AG'] } })
		).toBe(true);
		expect(zustimmungBetroffenerGefragt({ betroffene: { noetig: false } as Auszaehlung['betroffene'] })).toBe(false);
		expect(zustimmungBetroffenerGefragt(null)).toBe(false);
	});

	it('zählt beim Abschluss ohne Abstimmung, nur konsultativ und Zurückgezogenes getrennt (F2, N5)', () => {
		const liste = [
			{ id: 'a', nummer: '1', art: 'kenntnisnahme' },
			{ id: 'b', nummer: '2', art: 'abstimmung' },
			{ id: 'c', nummer: '3', art: 'abstimmung' },
			{ id: 'd', nummer: '4', art: 'abstimmung' },
			{ id: 'e', nummer: '5', art: 'abstimmung', rueckzug: 'Offerte fehlt.' },
			{ id: 'f', nummer: '6', art: 'abstimmung' },
			{ id: 'g', nummer: '6.1', art: 'abstimmung', spontan: true }
		];
		// b entschieden, c, e und g konsultativ (e danach zurückgezogen, g im Saal
		// aufgenommen), d und f ohne Abstimmung.
		const o = abschlussOhneBeschluss(liste, new Set(['b']), new Set(['c', 'e', 'g']));
		expect(o).toEqual({ ohneAbstimmung: 2, nurKonsultativ: ['3', '6.1'], nurKonsultativImSaal: ['6.1'] });
	});

	it('bleibt beim Satz «vor der Abstimmung», wo keine konsultative war', () => {
		const t = text({
			rueckzug: 'Die Offerte wird überarbeitet.',
			satz: null,
			zahlen: null,
			durchgang: null
		});
		expect(t).toContain('Der Antrag wurde vor der Abstimmung zurückgezogen');
		expect(t).toContain('Es wurde nicht abgestimmt; ein Beschluss ist nicht gefasst worden.');
	});

	it('nennt bei der Handzählung kein Erfordernis, wo die Zeile dazu fehlt (Befund 7)', () => {
		const ohne = text({ quotenErhoben: false, handzaehlung: { vermerk: 'Handzeichen' } });
		expect(ohne).toContain('welche Einheiten dafür gestimmt haben.');
		expect(ohne).not.toMatch(/das angewandte Erfordernis verlangt hier keine Mehrheit/);
		// Gegenprobe: mit der Zeile «Erforderliche Mehrheit» bleibt der Teil.
		const mit = text({
			erfordernis: 'Einfaches Mehr',
			satz: 'Angenommen.',
			quotenErhoben: false,
			handzaehlung: { vermerk: 'Handzeichen' }
		});
		expect(mit).toContain('das angewandte Erfordernis verlangt hier keine Mehrheit der Wertquoten.');
	});
});
