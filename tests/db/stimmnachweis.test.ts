/**
 * Der Stimmnachweis je Traktandum (S-1, Vorgabe des Auftraggebers 22.09.2026).
 *
 * Diese Datei liegt bei den Datenbanktests, obwohl sie keine Datenbank braucht:
 * Sie prüft Schalencode, und nur dieser Prüflauf löst `$lib/server` auf. Das
 * ist dieselbe Einordnung wie bei `pdf.test.ts`.
 *
 * **Gelesen wird der sichtbare Text**, nicht nur die Seitenzahl. Ein Blatt, das
 * im Streit vorgelegt wird, ist an genau drei Stellen gefährlich, wenn ein Satz
 * still fehlt: bei der Marke, welche Zeile gezählt hat, beim Vermerk der
 * Handzählung, und beim Hinweis, an wen das Blatt sich richtet. Alle drei
 * werden deshalb am Text geprüft und nicht daran, dass eine Datei entsteht.
 */
import { describe, expect, it } from 'vitest';
import { erzeugeStimmnachweis } from '$lib/server/pdf/stimmnachweis';
import { PDFDocument } from 'pdf-lib';
import { textVonSeite } from './pdftext';
import type { Stimmnachweisangaben, Stimmzeile } from '$lib/server/pdf/stimmnachweis';
import type { Auswertungszeile } from '$lib/server/pdf/auswertung';
import type { Versammlung } from '$lib/domain/versammlung';
import { einsprachelesartProtokollsatz, zaehleAus } from '$lib/domain/auszaehlung';
import { EINSPRACHE_KNOTEN, type Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot } from '$lib/domain/types';

function versammlung(u: Partial<Versammlung> = {}): Versammlung {
	return {
		id: 'v-1',
		operatorId: 'op-1',
		stwegId: 'stweg-1',
		zustand: 'geschlossen',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach',
		papierfrage: true,
		vorgaengerId: null,
		...u
	};
}

function zeile(u: Partial<Auswertungszeile> = {}): Auswertungszeile {
	return {
		nummer: '4',
		tiefe: 1,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		spontan: false,
		durchgang: 1,
		frueherenDurchgaenge: 0,
		erfordernis: 'qualifiziertes Mehr nach Köpfen und Wertquoten',
		rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
		satz: 'Angenommen mit 3 von 4 Köpfen und 720 von 1000 Wertquoten.',
		protokollsatz: 'Angenommen.',
		satzOhneNamen: 'Angenommen mit 3 von 4 Köpfen und 720 von 1000 Wertquoten.',
		auszaehlung: null,
		stichentscheid: null,
		...u
	};
}

function stimme(u: Partial<Stimmzeile> = {}): Stimmzeile {
	return {
		name: 'Petrović, Milan',
		einheit: 'Wohnung 1',
		quote: 180,
		wahl: 'yes',
		gezaehlt: true,
		durchSitzungsleitung: false,
		zeitpunkt: '15.09.2026, 21:42',
		erfasstIso: '2026-09-15T19:42:00.000Z',
		...u
	};
}

function angaben(u: Partial<Stimmnachweisangaben> = {}): Stimmnachweisangaben {
	return {
		gemeinschaftName: 'STWEG Nirgendweg 3',
		versammlung: versammlung(),
		zaehlweise: 'Gezählt nach Köpfen der anwesenden oder vertretenen Stockwerkeigentümer.',
		zeile: zeile(),
		stimmen: [stimme()],
		parteiwahlen: null,
		pfadImPaket: 'stimmnachweis/T-4.pdf',
		erzeugtAm: '2026-09-22 11:05',
		...u
	};
}

describe('Der Stimmnachweis trägt die Angaben, auf die es im Streit ankommt', () => {
	it('nennt Traktandum, Erfordernis, Ergebnis und die einzelnen Stimmen', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					stimmen: [
						stimme({ name: 'Petrović, Milan', einheit: 'Wohnung 1', quote: 180, wahl: 'yes' }),
						stimme({ name: 'Nowak-Łukasik, Ewa', einheit: 'Wohnung 2', quote: 220, wahl: 'no' }),
						stimme({ name: 'Bucher, Anna', einheit: 'Wohnung 3', quote: 300, wahl: 'abstain' })
					]
				})
			)
		);

		expect(text).toContain('Sanierung der Fassade');
		expect(text).toContain('qualifiziertes Mehr nach Köpfen und Wertquoten');
		expect(text).toContain('ZGB Art. 647d Abs. 1');
		expect(text).toContain('Angenommen mit 3 von 4 Köpfen');

		// Die Namen mit diakritischen Zeichen sind der Grund, aus dem die
		// Schrift als Teilmenge eingebettet wird; sie gehören in die Probe.
		expect(text).toContain('Petrović, Milan');
		expect(text).toContain('Nowak-Łukasik, Ewa');
		expect(text).toContain('Wohnung 2');
		expect(text).toContain('Ja');
		expect(text).toContain('Nein');
		expect(text).toContain('Enthaltung');

		// «Stimmpartei» steht auch über dieser Tabelle und ist erklärt (B-6).
		expect(text).toContain('Eine Stimmpartei ist eine einzelne Person oder mehrere Personen');

		/*
		 * **Gegenprobe zu B-1:** Ein gezählter Durchgang nennt die Erfassung
		 * durch die Sitzungsleitung nicht als Herkunft der Zahlen; die Angabe
		 * gehört nur zum von Hand festgehaltenen Beschluss.
		 */
		expect(text).not.toContain('je Stimmpartei erfasst');
		expect(text).not.toContain('hat die Zahlen eingetragen');
		expect(text).not.toContain('nicht selbst in der Anwendung abgegeben');
	});

	it('nennt bei L1 die Lesart und den Ausstand, mit der eingestellten Wahl (A5, Punkt 5)', async () => {
		const blatt = async (eigeneWahl: string, wahl: string) =>
			(
				await textVonSeite(
					await erzeugeStimmnachweis(
						angaben({
							zeile: zeile({
								auszaehlung: {
									geheim: false,
									andereAusstandslesart: {
										kennung: 'L1',
										eigeneWahl,
										wahl,
										verlangt: 'mehr als die Hälfte aller Wertquoten',
										feststellbar: true,
										angenommen: false,
										koepfe: null,
										quoten: null,
										abweichend: true
									}
								} as never
							})
						})
					)
				)
			).replace(/\s+/g, ' ');

		const heraus = await blatt('Wertquote fällt heraus', 'Wertquote zählt mit');
		expect(heraus).toContain('einer Partei im Ausstand');
		expect(heraus).toContain('Gerechnet wird nach der Lesart «Wertquote fällt heraus»');
		const bleibt = await blatt('Wertquote zählt mit', 'Wertquote fällt heraus');
		expect(bleibt).toContain('Gerechnet wird nach der Lesart «Wertquote zählt mit»');
		// Ohne zweites Ergebnis zu L1 kein Absatz.
		expect(await textVonSeite(await erzeugeStimmnachweis(angaben()))).not.toContain('Gerechnet wird nach der Lesart');
	});

	it('sagt auf dem Blatt selbst, an wen es sich richtet', async () => {
		const text = await textVonSeite(await erzeugeStimmnachweis(angaben()));

		/*
		 * Ohne diesen Satz ist das Blatt von der Auswertung nicht zu
		 * unterscheiden, und die geht an alle Eigentümer. Die Unterscheidung nur
		 * in der Ablage zu führen hiesse, sie einer Übergabenotiz anzuvertrauen.
		 */
		expect(text).toContain('namentlich');
		expect(text).toContain('nicht zur Verteilung an die');
	});

	it('nennt den Pfad im Paket und sagt, wogegen sich das Blatt prüfen lässt', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(angaben({ pfadImPaket: 'stimmnachweis/T-7.pdf' }))
		);

		expect(text).toContain('stimmnachweis/T-7.pdf');
		expect(text).toContain('Manifest');
		// Die eigene Prüfsumme steht bewusst nicht darauf: Eine Datei kann sie
		// nicht enthalten, die Rechnung wäre zirkulär.
		expect(text).toContain('Siegel');
	});
});

describe('Eine berichtigte Stimme ist als solche zu erkennen', () => {
	it('markiert die Zeile, die nicht gezählt hat, und erklärt es unter der Tabelle', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					stimmen: [
						stimme({ name: 'Bucher, Anna', einheit: 'Wohnung 3', wahl: 'no', gezaehlt: false }),
						stimme({ name: 'Bucher, Anna', einheit: 'Wohnung 3', wahl: 'yes', gezaehlt: true })
					]
				})
			)
		);

		expect(text).toContain('berichtigt, hat nicht gezählt');
		expect(text).toContain('Gezählt hat je Einheit die letzte');
	});

	it('zählt die berichtigten Zeilen richtig', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					stimmen: [
						stimme({ gezaehlt: false }),
						stimme({ gezaehlt: false }),
						stimme({ gezaehlt: true })
					]
				})
			)
		);

		expect(text).toContain('2 Zeilen sind grau');
	});

	it('vermerkt, wenn die Sitzungsleitung erfasst hat', async () => {
		/*
		 * «Hat gestimmt» und «wurde so erfasst» sind nicht dasselbe. In der
		 * Betriebsart «einfach» trägt jede Stimme diesen Vermerk, und ohne ihn
		 * sähe das Blatt nach einer Abstimmung durch die Person selbst aus.
		 */
		const text = await textVonSeite(
			await erzeugeStimmnachweis(angaben({ stimmen: [stimme({ durchSitzungsleitung: true })] }))
		);

		expect(text).toContain('durch die Sitzungsleitung erfasst');
	});
});

describe('Ein von Hand gezählter Durchgang sagt, dass es keine Einzelstimmen gibt', () => {
	it('schreibt den Vermerk aus, statt eine leere Tabelle zu zeigen', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zeile: zeile({
						handzaehlung: { vermerk: 'Auszählung durch zwei Stimmenzähler', erfasstAm: null }
					}),
					stimmen: []
				})
			)
		);

		expect(text).toContain('Von Hand gezählt, keine Einzelstimmen');
		expect(text).toContain('Auszählung durch zwei Stimmenzähler');
		// Und keine Tabellenüberschrift, die eine Liste erwarten liesse.
		expect(text).not.toContain('Stimmpartei');
	});

	it('sagt auch dann etwas, wenn die Sitzungsleitung keinen Vermerk hinterlegt hat', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zeile: zeile({ handzaehlung: { vermerk: null, erfasstAm: null } }),
					stimmen: []
				})
			)
		);

		expect(text).toContain('keinen Vermerk zur Zählweise');
	});

	it('unterscheidet die Handzählung von «niemand hat gestimmt»', async () => {
		/*
		 * Der Unterschied ist der Grund für diese drei Proben. Eine leere Liste
		 * ohne Vermerk läse sich wie eine Versammlung, in der niemand abgestimmt
		 * hat; der Fehlschluss ist im Repo schon einmal gemacht worden
		 * (Code-Review 17.09.2026, `siegel.ts`).
		 */
		const ohneStimmen = await textVonSeite(
			await erzeugeStimmnachweis(angaben({ stimmen: [] }))
		);

		expect(ohneStimmen).toContain('keine Stimme erfasst');
		expect(ohneStimmen).not.toContain('Von Hand gezählt');
	});

	it('zeigt die Wahl je Partei statt «keine Stimme erfasst» (Block 3, Punkt 4)', async () => {
		/*
		 * Der Beschluss von Hand trägt die Wahl je Partei in der Festschreibung
		 * (`vonHand.stimmen`), nicht in `vote`. Ohne diesen Zweig stünde «keine
		 * Stimme erfasst» neben den Zahlen, die aus ebendiesen Wahlen folgen.
		 */
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zeile: zeile({ auszaehlung: { vonHand: { erfassung: 'parteien' } } as never }),
					stimmen: [],
					parteiwahlen: [
						{ name: 'Probe Beta', wahl: 'no' },
						{ name: 'Probe Alpha', wahl: 'yes' }
					]
				})
			)
		);

		expect(text).toContain('Die Wahl je Partei');
		expect(text).toContain('Stimmpartei');
		/*
		 * **B-1 der Laienprüfung vom 01.10.2026:** Ohne diese zwei Sätze wirkt
		 * die Tabelle wie einzeln abgegebene Stimmen. Die Erfassung steht auf
		 * dem Blatt, der Weg dorthin nicht.
		 */
		expect(text).toContain('Von der Sitzungsleitung je Stimmpartei erfasst');
		expect(text).toContain('haben ihre Stimme nicht selbst in der Anwendung abgegeben');
		expect(text).toContain('hat für jede eingetragen, wie sie gestimmt hat');
		// Und der Begriff «Stimmpartei» ist einmal erklärt (B-6).
		expect(text).toContain('Eine Stimmpartei ist eine einzelne Person oder mehrere Personen');
		// Nach Namen sortiert, nicht in Eingabereihenfolge.
		expect(text.indexOf('Probe Alpha')).toBeLessThan(text.indexOf('Probe Beta'));
		expect(text).not.toContain('keine Stimme erfasst');
		// Der Weg steht nicht auf dem Blatt, wie nirgends nach aussen.
		expect(text).not.toMatch(/von Hand|Notweg|übergangen/i);
	});

	it('sagt bei Summen, dass keine Einzelstimmen erfasst wurden', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zeile: zeile({ auszaehlung: { vonHand: { erfassung: 'summen' } } as never }),
					stimmen: []
				})
			)
		);

		expect(text).toContain('Als Summen erfasst');
		// Dieselbe Angabe zur Erfassung wie im Parteienzweig (B-1).
		expect(text).toContain('Die Sitzungsleitung hat die Zahlen eingetragen; die Anwendung hat nicht');
		expect(text).not.toContain('keine Stimme erfasst');
		expect(text).not.toMatch(/von Hand|Notweg/i);
	});
});

describe('Frühere Durchgänge stehen auf dem Blatt', () => {
	it('sagt, dass schon abgestimmt wurde, und welcher Durchgang gilt', async () => {
		/*
		 * Wer dieses Blatt allein in der Hand hält, muss sehen, dass vorher schon
		 * abgestimmt wurde. Sonst wirkt ein Rückkommen wie eine Erstabstimmung.
		 */
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zeile: zeile({ frueherenDurchgaenge: 2, frueherenDurchRueckkommen: 1, durchgang: 3 })
				})
			)
		);

		expect(text).toContain('2 weitere Durchgänge');
		expect(text).toContain('durch ein Rückkommen ersetzt');
		expect(text).toContain('Massgebend ist der hier ausgewiesene Durchgang');
	});

	it('schweigt, wenn es nur einen Durchgang gab', async () => {
		const text = await textVonSeite(await erzeugeStimmnachweis(angaben()));
		expect(text).not.toContain('frühere');
	});
});

describe('Mehrseitige Blätter bleiben einzeln lesbar', () => {
	/*
	 * **Der Grund für diese Proben.** Die erste Fassung zeichnete Kopf und
	 * Empfängerhinweis genau einmal. Seite 2 war damit ein loses Blatt mit
	 * Klarnamen und Stimmverhalten, ohne Gemeinschaft, ohne Versammlung, ohne
	 * Traktandum und ohne den Satz, dass es nicht verteilt werden darf.
	 * Unsichtbar war das, weil keine einzige Vorgabe ein zweites Blatt erzeugte.
	 */
	async function alleSeiten(bytes: Uint8Array): Promise<string[]> {
		const zahl = (await PDFDocument.load(bytes)).getPageCount();
		return Promise.all(Array.from({ length: zahl }, (_, i) => textVonSeite(bytes, i)));
	}

	function viele(anzahl: number): Stimmzeile[] {
		return Array.from({ length: anzahl }, (_, i) =>
			stimme({ name: `Person ${i + 1}`, einheit: `Wohnung ${i + 1}`, quote: 10 })
		);
	}

	it('trägt auf jeder Seite Gemeinschaft, Traktandum und den Empfängerhinweis', async () => {
		const seiten = await alleSeiten(await erzeugeStimmnachweis(angaben({ stimmen: viele(80) })));

		expect(seiten.length).toBeGreaterThan(1);
		for (const [i, text] of seiten.entries()) {
			expect(text, `Seite ${i + 1} ohne Gemeinschaft`).toContain('STWEG Nirgendweg 3');
			expect(text, `Seite ${i + 1} ohne Traktandum`).toContain('Traktandum 4');
			expect(text, `Seite ${i + 1} ohne Verteilhinweis`).toContain('nicht zur Verteilung');
			expect(text, `Seite ${i + 1} ohne Seitenzahl`).toContain(`Seite ${i + 1} von ${seiten.length}`);
		}
	});

	it('setzt die Tabellenüberschrift auf jeder Seite mit Stimmen neu', async () => {
		const seiten = await alleSeiten(await erzeugeStimmnachweis(angaben({ stimmen: viele(80) })));
		for (const [i, text] of seiten.entries()) {
			if (!text.includes('Person')) continue;
			expect(text, `Seite ${i + 1} ohne Tabellenkopf`).toContain('Stimmpartei');
		}
	});
});

describe('Langer Text schiebt nichts vom Blatt', () => {
	/*
	 * Dieselbe Fehlerklasse, die `auswertung.ts` am 09.09.2026 behoben hat: Ein
	 * Beschlusstext von einigen hundert Zeichen schob den Spiegel unter den
	 * Seitenrand, und pdf-lib schneidet stillschweigend ab. Gemessen am
	 * 22.09.2026: Bei 2800 Zeichen fiel die ganze Tabellenüberschrift vom Blatt.
	 */
	it('behält Tabellenkopf und Stimmen bei einem sehr langen Beschlusstext', async () => {
		const bytes = await erzeugeStimmnachweis(
			angaben({
				zeile: zeile({ beschlusstext: 'Der Beschluss lautet im Einzelnen wie folgt. '.repeat(70) }),
				stimmen: [stimme({ name: 'Petrović, Milan' })]
			})
		);
		const zahl = (await PDFDocument.load(bytes)).getPageCount();
		const alles = (
			await Promise.all(Array.from({ length: zahl }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');

		expect(alles).toContain('Stimmpartei');
		expect(alles).toContain('Petrović, Milan');
		expect(alles).toContain('Prüfsumme steht im Manifest');
	});

	it('behält den Vermerk der Handzählung bei langem Beschlusstext', async () => {
		const bytes = await erzeugeStimmnachweis(
			angaben({
				zeile: zeile({
					beschlusstext: 'Der Beschluss lautet im Einzelnen wie folgt. '.repeat(70),
					handzaehlung: { vermerk: 'Auszählung durch zwei Stimmenzähler', erfasstAm: null }
				}),
				stimmen: []
			})
		);
		const zahl = (await PDFDocument.load(bytes)).getPageCount();
		const alles = (
			await Promise.all(Array.from({ length: zahl }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');

		expect(alles).toContain('Von Hand gezählt, keine Einzelstimmen');
		expect(alles).toContain('Auszählung durch zwei Stimmenzähler');
	});
});

describe('Was das Blatt sagt, wenn Angaben fehlen', () => {
	it('sagt es, wenn kein ausgewertetes Ergebnis vorliegt', async () => {
		/*
		 * `satz` fehlt, wo kein Erfordernis festgehalten oder nicht ausgezählt
		 * wurde; das Blatt entsteht trotzdem, weil `durchgangId` nicht an dieser
		 * Bedingung hängt. Ohne diesen Zweig trüge es alle Namen und keine
		 * Ergebnisaussage.
		 */
		const text = await textVonSeite(
			await erzeugeStimmnachweis(angaben({ zeile: zeile({ satz: null, erfordernis: null }) }))
		);
		expect(text).toContain('kein ausgewertetes Ergebnis');
	});

	it('schreibt «unbekannt» statt einer Null, wenn die Quote fehlt', async () => {
		const text = await textVonSeite(
			await erzeugeStimmnachweis(angaben({ stimmen: [stimme({ quote: null })] }))
		);
		expect(text).toContain('unbekannt');
		// Eine «0» wäre keine Lücke, sondern die falsche Aussage, die Einheit
		// trage nichts zum Mehr bei.
		expect(text).not.toMatch(/\s0\s/);
	});
});

/*
 * **Lesart und Ergebnis nach der anderen** (Review DeepSeek zu Lesarten Block 5,
 * Befund 1): An einer Einsprache nach L3 «je Eigentümer» nannte das Blatt nur
 * die Zählweise der Gemeinschaft (je Einheit) und widersprach dem eigenen
 * Ergebnis; das Ergebnis je Einheit fehlte.
 */
describe('Der Stimmnachweis nennt die Lesart und das Ergebnis nach der anderen', () => {
	it('an einer Einsprache nach L3', async () => {
		const einheiten = (id: string, n: number) =>
			Array.from({ length: n }, (_, i) => ({
				unitId: `${id}-u${i + 1}`,
				label: `Whg ${id} ${i + 1}`,
				kind: 'unit' as const,
				countsAsHead: true,
				quota: 100
			}));
		const m: Snapshot = {
			meetingId: 'v-1',
			takenAt: '2026-10-28T17:00:00.000Z',
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			headCountRuleSource: null,
			tieBreak: 'keiner',
			totalQuota: 500,
			parties: [
				{ partyId: 'p1', displayName: 'Partei 1', representativeName: null, isCommunity: false, units: einheiten('p1', 1) },
				{ partyId: 'p2', displayName: 'Partei 2', representativeName: null, isCommunity: false, units: einheiten('p2', 1) },
				{ partyId: 'p3', displayName: 'Partei 3', representativeName: null, isCommunity: false, units: einheiten('p3', 3) }
			]
		};
		const e: Erfordernis = {
			fassung: '2026-10-28',
			juristischGegengelesen: false,
			astId: 'a-sonderfaelle',
			knotenId: EINSPRACHE_KNOTEN,
			typ: 'einfaches_mehr',
			titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
			rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: null,
			zustimmungBetroffenerNoetig: false,
			pfad: [],
			quelle: 'hergeleitet'
		};
		const stimmen = (p: Snapshot['parties'][number], choice: 'yes' | 'no') =>
			p.units.map((u) => ({ partyId: p.partyId, unitId: u.unitId, choice, castAt: '2026-10-28T19:10:00.000Z', recordedByChair: false }));
		const auszaehlung = zaehleAus({
			momentaufnahme: m,
			erfordernis: e,
			stimmen: [...stimmen(m.parties[0], 'yes'), ...stimmen(m.parties[1], 'yes'), ...stimmen(m.parties[2], 'no')],
			anwesende: ['p1', 'p2', 'p3']
		});
		const text = await textVonSeite(
			await erzeugeStimmnachweis(
				angaben({
					zaehlweise: 'Eine Kopfstimme je Einheit.',
					zeile: zeile({
						titel: 'Einsprache gegen den Verkauf',
						erfordernis: 'einfaches Mehr',
						rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
						lesart: einsprachelesartProtokollsatz(e, m),
						auszaehlung,
						satz: 'Angenommen mit 2 von 3 Kopfstimmen.'
					})
				})
			)
		);
		const flach = text.replace(/\s+/g, ' ');
		expect(flach).toContain('Gezählt nach dem Gesetz: eine Stimme je Eigentümer');
		expect(flach).toContain('Nach der anderen Lesart («Eine Stimme je Einheit»: die Zählung je Einheit), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen');
		// Die Zählweise der Gemeinschaft steht hier nicht daneben (Codeprüfung der Korrektur, M1).
		expect(flach).not.toContain('Eine Kopfstimme je Einheit.');
	});
});
