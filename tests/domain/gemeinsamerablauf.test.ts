/**
 * Der Ablauf einer gemeinsamen Versammlung.
 *
 * Der Punkt, um den es geht: **Einlass und Tafel sind gesperrt, solange nichts
 * läuft — aber sichtbar, mit Grund.** Vorher stand das Einlassformular mitten in
 * der Vorbereitung und antwortete auf jeden Klick «nicht möglich — die
 * Versammlung läuft dort nicht». Ein Formular, das da ist und nichts tut, ist
 * schlimmer als eine graue Zeile, die sagt, was fehlt.
 */
import { describe, expect, it } from 'vitest';
import {
	gemeinsameGruppen,
	gemeinsameSchritte,
	type GemeinsameLage
} from '$lib/domain/gemeinsamerablauf';

const LAGE = (ueber: Partial<GemeinsameLage> = {}): GemeinsameLage => ({
	tagId: 't1',
	haeuser: 3,
	laufend: 0,
	fertig: 0,
	stammdatenOffen: 1,
	themenOffen: { einheiten: 1, eigentuemer: 0, reglement: 0, beschlussfaehigkeit: 0 },
	geschaefte: 0,
	angabenStehen: true,
	imEntwurf: 3,
	ausfallOffen: 3,
	abgeschlossen: 0,
	...ueber
});

const von = (l: GemeinsameLage, k: string) => gemeinsameSchritte(l).find((s) => s.kennung === k)!;

describe('gemeinsameSchritte', () => {
	it('sperrt Einlass und Tafel, solange nichts freigegeben ist — mit Grund', () => {
		for (const k of ['einlass', 'tafel']) {
			const s = von(LAGE(), k);
			expect(s.zustand, k).toBe('gesperrt');
			expect(s.sperrgrund, k).toBeTruthy();
		}
	});

	/*
	 * **Der Einlass öffnet mit der Freigabe, nicht mit der Eröffnung**
	 * (24.08.2026).
	 *
	 * Bis dahin war er gesperrt, solange keine Versammlung lief — eröffnet wurde
	 * aber auf der Seite jedes einzelnen Hauses. Seit das Eröffnen auf der
	 * Einlassseite steht, hätte der Schritt sich selbst ausgesperrt: Er verlangte
	 * den Zustand, den er herstellen soll.
	 *
	 * Die **Tafel** bleibt an `laufend` gebunden: Sie zeigt, was im Saal
	 * geschieht, und vor der Eröffnung geschieht dort nichts.
	 */
	it('gibt den Einlass mit der ersten Freigabe frei — die Tafel erst mit der Eröffnung', () => {
		const freigegeben = LAGE({ imEntwurf: 2 });
		expect(von(freigegeben, 'einlass').zustand).toBe('offen');
		expect(von(freigegeben, 'einlass').sperrgrund).toBeUndefined();
		expect(von(freigegeben, 'einlass').stand).toBe('noch keine eröffnet');
		expect(von(freigegeben, 'tafel').zustand).toBe('gesperrt');

		const laeuft = LAGE({ imEntwurf: 2, laufend: 1 });
		expect(von(laeuft, 'einlass').zustand).toBe('offen');
		expect(von(laeuft, 'einlass').stand).toBe('1 von 3 läuft');
		expect(von(laeuft, 'tafel').zustand).toBe('offen');
		expect(von(laeuft, 'tafel').sperrgrund).toBeUndefined();
	});

	/*
	 * **Ein Wächter gegen das Auseinanderlaufen** (24.08.2026). Die Reihenfolge
	 * «An der Versammlung» stand in zwei Dateien, und sie lief auseinander: im
	 * Haus Vollmachten vor Anwesenheit, am Abend umgekehrt. Wer wechselt, sucht
	 * in der Leiste an zwei Orten.
	 *
	 * Verglichen wird die gemeinsame Teilfolge, nicht die ganze Liste: Die
	 * **Tafel** gibt es nur am Abend, die Auswertung nur im Haus.
	 */
	it('führt «An der Versammlung» in derselben Reihenfolge wie eine einzelne', () => {
		const gemeinsam = gemeinsameGruppen(gemeinsameSchritte(LAGE({ imEntwurf: 2, laufend: 1 })))
			.find((g) => g.titel === 'An der Versammlung')!
			.schritte.map((s) => s.titel);

		// Im Haus: Vollmachten, Anwesenheit und Beschlussfähigkeit, Versammlung
		// führen — eine Vollmacht, die erst nach dem Einlassen geprüft wird,
		// kommt zu spät.
		expect(gemeinsam.slice(0, 3)).toEqual([
			'Vollmachten',
			'Anwesenheit und Beschlussfähigkeit',
			'Versammlung führen'
		]);
	});

	it('trägt denselben Titel wie im Ablauf einer einzelnen Versammlung', () => {
		// Auftraggeber, 24.08.2026: «Auch die Bezeichnung in der Seitenleiste übernehmen.»
		// Zwei Wörter für dieselbe Sache heisst: zweimal suchen.
		expect(von(LAGE(), 'einlass').titel).toBe('Anwesenheit und Beschlussfähigkeit');
	});

	it('sperrt Stammdaten und Geschäfte, solange niemand mittagt', () => {
		const l = LAGE({ haeuser: 0 });
		for (const k of ['einheiten', 'eigentuemer', 'reglement', 'beschlussfaehigkeit']) {
			expect(von(l, k).zustand, k).toBe('gesperrt');
		}
		expect(von(l, 'geschaefte').zustand).toBe('gesperrt');
		expect(von(l, 'haeuser').zustand).toBe('offen');
	});

	it('führt die vier Stammdatenthemen einzeln — wie bei einer einzelnen Versammlung', () => {
		// Gemeldet am 11.08.2026: «Bei der Einzelansicht gibt es noch Einheiten WQ,
		// Eigentümer und Zuordnung oder Reglement und Quoren. Braucht es das bei
		// der Sammelversammlung nicht?» Es stand hinter einem einzigen Schritt.
		const titel = gemeinsameSchritte(LAGE()).map((s) => s.titel);
		expect(titel).toContain('Einheiten und Wertquoten');
		expect(titel).toContain('Eigentümer und Zuordnung');
		expect(titel).toContain('Reglement und Quoren');
		expect(titel).toContain('Beschlussfähigkeit');
		// Und dasselbe Wort wie dort: «Traktandenliste», nicht «Traktanden».
		expect(titel).toContain('Traktandenliste');
	});

	it('hakt jedes Thema für sich ab', () => {
		const l = LAGE({
			themenOffen: { einheiten: 2, eigentuemer: 0, reglement: 0, beschlussfaehigkeit: 0 }
		});
		expect(von(l, 'einheiten').zustand).toBe('offen');
		expect(von(l, 'einheiten').stand).toBe('2 von 3 Gemeinschaften noch offen');
		expect(von(l, 'reglement').zustand).toBe('erledigt');
	});

	/*
	 * Die Warnung steht in der Leiste **immer** — anders als der Stand, der nur
	 * bei der offenen Zeile erscheint. Deshalb darf sie nicht am Anfang schon
	 * dastehen: Vier Ausrufezeichen an einem frisch angelegten Abend wären ein
	 * Alarm über den Normalfall (Auftraggeber, 12.08.2026: das Zeichen soll zeigen, wo
	 * etwas **fehlt**).
	 */
	it('warnt, wo ein Teil der Häuser erfasst ist und der Rest fehlt', () => {
		const l = LAGE({
			themenOffen: { einheiten: 2, eigentuemer: 0, reglement: 0, beschlussfaehigkeit: 0 }
		});
		expect(von(l, 'einheiten').warnung).toBe('2 von 3 offen');
		// Ausgeschrieben steht es weiterhin im Stand — dort, wo Platz ist.
		expect(von(l, 'einheiten').stand).toBe('2 von 3 Gemeinschaften noch offen');
	});

	it('warnt nicht, wo noch gar nichts erfasst ist — das ist der Anfang, kein Mangel', () => {
		const l = LAGE({
			themenOffen: { einheiten: 3, eigentuemer: 3, reglement: 3, beschlussfaehigkeit: 3 }
		});
		expect(von(l, 'einheiten').warnung).toBeUndefined();
		// Der Stand sagt es weiterhin — nur eben bei der Zeile, wo man steht.
		expect(von(l, 'einheiten').stand).toBe('3 von 3 Gemeinschaften noch offen');
	});

	it('warnt nicht, wo alles steht', () => {
		const l = LAGE({
			themenOffen: { einheiten: 0, eigentuemer: 0, reglement: 0, beschlussfaehigkeit: 0 }
		});
		expect(von(l, 'einheiten').warnung).toBeUndefined();
		expect(von(l, 'einheiten').zustand).toBe('erledigt');
	});

	it('warnt nicht bei einer einzigen Gemeinschaft — dort gibt es kein «ein Teil»', () => {
		const l = LAGE({ haeuser: 1, themenOffen: { einheiten: 1 } });
		expect(von(l, 'einheiten').warnung).toBeUndefined();
		expect(von(l, 'einheiten').stand).toBe('1 von 1 Gemeinschaft noch offen');
	});

	it('führt jedes Thema auf seine eigene Ansicht', () => {
		// Sonst landeten alle vier Schritte auf derselben Seite, und die Leiste
		// gäbe vier Wege an, die dasselbe tun.
		expect(von(LAGE(), 'einheiten').pfad).toBe('/tage/t1/stammdaten?thema=einheiten');
		expect(von(LAGE(), 'reglement').pfad).toBe('/tage/t1/stammdaten?thema=reglement');
	});

	it('führt das Freigeben als eigenen Schritt — er fehlte ganz', () => {
		// Der einzelne Ablauf hat den Abschnitt «Ausgeben», der gemeinsame sprang
		// von der Vorbereitung direkt in den Saal (gemeldet am 11.08.2026).
		expect(von(LAGE({ imEntwurf: 3 }), 'freigabe').zustand).toBe('offen');
		expect(von(LAGE({ imEntwurf: 3 }), 'freigabe').stand).toContain('3 von 3');
		expect(von(LAGE({ imEntwurf: 0 }), 'freigabe').zustand).toBe('erledigt');
		expect(von(LAGE({ haeuser: 0, imEntwurf: 0 }), 'freigabe').zustand).toBe('gesperrt');
	});

	/**
	 * **Die Ausfallsicherung fehlte dem Abend ganz** (02.09.2026, aus dem
	 * Praxisbefund des Auftraggebers zur Unterschriftenliste). Der einzelne Ablauf führt sie seit
	 * dem 23.08.2026; hier sprang der Weg von der Freigabe in den Saal. Wer den
	 * Abend führte, sah den Punkt nie — und die Unterlagen hängen je Gemeinschaft.
	 */
	it('führt die Ausfallsicherung als eigenen Schritt', () => {
		const s = von(LAGE({ imEntwurf: 0, ausfallOffen: 2 }), 'ausfall');
		expect(s.zustand).toBe('offen');
		expect(s.stand).toBe('2 von 3 noch offen');
		expect(s.pfad).toBe('/tage/t1/ausfall');
		expect(s.beschreibung).toMatch(/Unterschriftenliste/);

		const fertig = von(LAGE({ imEntwurf: 0, ausfallOffen: 0 }), 'ausfall');
		expect(fertig.zustand).toBe('erledigt');
		expect(fertig.stand).toBe('für alle Gemeinschaften geholt');
	});

	/**
	 * **Offen, sobald EINE Gemeinschaft freigegeben ist** (aus dem Code-Review
	 * zu diesem Block).
	 *
	 * Der erste Anlauf sperrte, solange eine Gemeinschaft im Entwurf stand. Ein
	 * gesperrter Punkt ist in der Leiste kein Link, und einen zweiten Weg zu der
	 * Seite gibt es nicht: Bei vier von fünf freigegebenen Häusern wäre sie nur
	 * über die eingetippte Adresse erreichbar gewesen — und dort hätte sie gerade
	 * das Nützliche gezeigt.
	 */
	it('öffnet die Ausfallsicherung, sobald eine Gemeinschaft freigegeben ist', () => {
		const s = von(LAGE({ imEntwurf: 1, ausfallOffen: 3 }), 'ausfall');
		expect(s.zustand).toBe('offen');
		expect(s.sperrgrund).toBeUndefined();
		expect(s.stand).toBe('3 von 3 noch offen');
	});

	it('sperrt die Ausfallsicherung, solange gar nichts freigegeben ist', () => {
		/*
		 * Die Unterlagen rechnen auf der Momentaufnahme; ohne Freigabe gibt es die
		 * nicht, und der Downloadweg sagt mit HTTP 400 ab. Ein Schritt, der dorthin
		 * führt, wäre ein Weg in eine Absage — dieselbe Begründung wie im Haus.
		 */
		const s = von(LAGE({ imEntwurf: 3, ausfallOffen: 3 }), 'ausfall');
		expect(s.zustand).toBe('gesperrt');
		expect(s.sperrgrund).toMatch(/Freigabe/);
		expect(s.stand, 'kein Zwischenstand vor der Freigabe').toBeUndefined();

		const leer = von(LAGE({ haeuser: 0, imEntwurf: 0, ausfallOffen: 0 }), 'ausfall');
		expect(leer.zustand).toBe('gesperrt');
		expect(leer.sperrgrund).toMatch(/mittagt/);
	});

	it('lässt «keine gemeinsamen Geschäfte» als erledigt gelten', () => {
		// Sonst stünde bei jeder gemeinsamen Versammlung ohne gemeinsames
		// Geschäft dauerhaft ein offener Punkt, an dem nichts zu tun ist.
		const s = von(LAGE({ geschaefte: 0 }), 'geschaefte');
		expect(s.zustand).toBe('erledigt');
		// Seit dem 11.08.2026 nicht mehr «jede Gemeinschaft hat ihre eigene Liste»:
		// Die Liste gilt für den ganzen Abend, und was die Gemeinschaften
		// mitbringen, steht beim Öffnen der Seite ohnehin schon darauf.
		expect(s.stand).toBe('noch keines');
	});

	it('nennt jeden Sperrgrund und lässt keinen Schritt ohne Weg', () => {
		for (const s of gemeinsameSchritte(LAGE({ haeuser: 0 }))) {
			expect(s.pfad, s.kennung).toMatch(/^\/tage\/t1/);
			if (s.zustand === 'gesperrt') expect(s.sperrgrund, s.kennung).toBeTruthy();
		}
	});
});

/**
 * Die Zusammenstellung des Abends (Story 7.5b).
 *
 * Der stille Fehler wäre ein Schritt, der einlädt und ins Leere führt: Solange
 * keine Versammlung geschlossen ist, stünde in der Zusammenstellung unter jedem
 * Punkt «noch kein Ergebnis». Ein Sperrgrund, der das sagt, ist besser als eine
 * leere Seite.
 */
describe('Zusammenstellung des Abends', () => {
	it('ist gesperrt, solange nichts geschlossen ist — mit Grund', () => {
		const s = von(LAGE({ abgeschlossen: 0 }), 'zusammenstellung');
		expect(s.zustand).toBe('gesperrt');
		expect(s.sperrgrund).toMatch(/geschlossen/);
	});

	it('öffnet, sobald eine Versammlung abgeschlossen ist', () => {
		const s = von(LAGE({ abgeschlossen: 1 }), 'zusammenstellung');
		expect(s.zustand).toBe('offen');
		expect(s.sperrgrund).toBeUndefined();
		expect(s.stand).toBe('1 von 3 abgeschlossen');
	});

	it('wird nie «erledigt» — es gibt nichts abzuhaken', () => {
		// Sie wird nicht gespeichert, nicht unterzeichnet, nicht genehmigt. Ein
		// Häkchen behauptete einen Abschluss, den es hier nicht gibt.
		for (const n of [0, 1, 2, 3]) {
			expect(von(LAGE({ abgeschlossen: n }), 'zusammenstellung').zustand).not.toBe('erledigt');
		}
	});

	it('führt auf die eigene Seite des Abends', () => {
		expect(von(LAGE({ abgeschlossen: 1 }), 'zusammenstellung').pfad).toBe('/tage/t1/protokoll');
	});

	it('reicht die Lücke aus dem Kern durch, statt sie selbst zu rechnen', () => {
		const s = von(LAGE({ abgeschlossen: 3, protokollluecke: '2 Punkte ohne Ergebnis' }), 'zusammenstellung');
		expect(s.warnung).toBe('2 Punkte ohne Ergebnis');
	});
});

describe('gemeinsameGruppen', () => {
	it('gliedert in dieselben Abschnitte wie der einzelne Ablauf', () => {
		// Seit Story 7.5b auch «Danach» — dort steht die Zusammenstellung des
		// Abends, wie beim einzelnen Ablauf das Protokoll. Und seit dem
		// 25.08.2026 «Jederzeit» (Auftraggeber: «bei Gruppen fehlt ‹jederzeit› in der
		// Seitenleiste»): dasselbe fünfte Kapitel wie im Haus.
		const g = gemeinsameGruppen(gemeinsameSchritte(LAGE()));
		expect(g.map((x) => x.titel)).toEqual([
			'Vorbereiten',
			'Ausgeben',
			'An der Versammlung',
			'Danach',
			'Jederzeit'
		]);
	});

	it('führt «Danach» in der Reihenfolge Siegel, Protokoll — wie im Haus', () => {
		/*
		 * Produktentscheid 03.10.2026: «Ja, mit dem Abendbau angleichen». Im Haus
		 * steht das Siegel seit dem Nachzug vor dem Protokoll; der Versand ist kein
		 * eigener Schritt, sondern steckt im Protokoll. Am Abendhaus hängt daran
		 * mehr als die Reihenfolge: Die Fassung «als versandt» lässt sich dort erst
		 * nach dem Siegel des Hauses festhalten (A2).
		 */
		const g = gemeinsameGruppen(gemeinsameSchritte(LAGE()));
		const danach = g.find((x) => x.titel === 'Danach')!;
		expect(danach.schritte.map((s) => s.kennung)).toEqual(['siegel', 'zusammenstellung']);
	});

	it('haengt an «Jederzeit» den Verlauf DIESES Abends', () => {
		// Der Weg, den es vorher gar nicht gab. `?abend=` und nicht
		// `?gegenstand=`: Am Abend selbst hängt fast nichts, was im Saal geschah,
		// hängt an seinen Versammlungen (siehe `gehoertZu` im Server).
		const g = gemeinsameGruppen(gemeinsameSchritte(LAGE()));
		const wege = g.at(-1)!.schritte.map((s) => s.pfad);
		expect(wege).toContain('/verlauf?abend=t1');
		expect(wege.some((w) => w.endsWith('/protokoll.pdf'))).toBe(true);
	});

	/**
	 * **Der Weg zur Ausfallsicherung steht auch am Abend unter «Jederzeit»**
	 * (Auftraggeber, 09.09.2026: «Bei der Gruppenversammlung steht bei ‹jederzeit› nicht
	 * die Stimmzettel für den Ausfall»).
	 *
	 * Im Haus steht sie an beiden Orten — als Schritt in der Vorbereitung und
	 * als Verweis unter «Jederzeit». Am Abend gab es nur den Schritt, und wer
	 * den Weg aus dem Haus kannte, suchte ihn hier vergeblich.
	 *
	 * Die Probe misst zusätzlich, dass der Verweis auf die **Seite** zeigt und
	 * nicht auf ein PDF: Ein gemeinsames Blatt über mehrere Gemeinschaften wäre
	 * für keinen Saal das richtige, und genau das soll der Weg nicht versprechen.
	 */
	it('führt unter «Jederzeit» zur Ausfallsicherung, ohne ein gemeinsames Blatt zu versprechen', () => {
		const g = gemeinsameGruppen(gemeinsameSchritte(LAGE()));
		const jederzeit = g.at(-1)!;
		const weg = jederzeit.schritte.find((s) => s.kennung === 'ausfallwege');
		expect(weg?.pfad).toBe('/tage/t1/ausfall');
		expect(weg?.pfad).not.toMatch(/\.pdf$/);
		// Und der Schritt in der Vorbereitung bleibt, wo er ist: Der Verweis kommt
		// dazu, nicht an seine Stelle.
		const ausgeben = g.find((x) => x.titel === 'Ausgeben');
		expect(ausgeben?.schritte.some((s) => s.kennung === 'ausfall')).toBe(true);
	});

	/**
	 * **Der Verweis darf die Sperre des Schritts nicht aushebeln** (aus dem
	 * Code-Review). Der erste Anlauf stand bedingungslos auf «offen»: In
	 * derselben Leiste hätte oben ein grauer Punkt gestanden, der «erst nach der
	 * Freigabe» sagt, und drei Zeilen tiefer ein Link auf genau diese Seite.
	 *
	 * Die Probe misst **beide** Lagen. Nur die zweite unterscheidet die
	 * Fassungen: Vor jeder Freigabe muss der Verweis mitsperren, nach der ersten
	 * muss er sich öffnen — sonst wäre die Sperre ins Gegenteil gekippt und der
	 * Weg für immer zu.
	 */
	it('sperrt den Verweis genau dann mit, wenn der Schritt gesperrt ist', () => {
		const wegAus = (l: GemeinsameLage) =>
			gemeinsameGruppen(gemeinsameSchritte(l))
				.at(-1)!
				.schritte.find((s) => s.kennung === 'ausfallwege');

		const zu = wegAus(LAGE({ imEntwurf: 3 }));
		expect(zu?.zustand).toBe('gesperrt');
		expect(zu?.sperrgrund).toBeTruthy();
		expect(zu?.sperrgrund).toBe(von(LAGE({ imEntwurf: 3 }), 'ausfall').sperrgrund);

		const offen = wegAus(LAGE({ imEntwurf: 1 }));
		expect(offen?.zustand).toBe('offen');
		expect(offen?.sperrgrund).toBeUndefined();
	});

	it('lässt keinen Schritt verschwinden, der keinem Abschnitt zugeordnet ist', () => {
		const g = gemeinsameGruppen([
			...gemeinsameSchritte(LAGE()),
			{ kennung: 'neu', titel: 'Neu', beschreibung: '', zustand: 'offen', pfad: '/tage/t1/neu' }
		]);
		// Vor «Jederzeit», nicht dahinter: Ein Schritt, den niemand zugeordnet
		// hat, soll auffallen — unter dem Kapitel, das ohnehin immer dasteht,
		// fiele er weniger auf.
		expect(g.at(-2)!.titel).toBe('Weiteres');
		expect(g.at(-2)!.schritte[0].kennung).toBe('neu');
	});
});
