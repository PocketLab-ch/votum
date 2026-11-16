import { describe, expect, it } from 'vitest';
import {
	hinweisVorDemVersiegeln,
	abendfusszeile,
	beschlussfaehigkeitFehlteAmBeschluss,
	beschlussfaehigkeitFehlteSatz,
	ohneErgebnis,
	ANFECHTUNG_IM_PROTOKOLL,
	protokollentwurf,
	l16Beschlusssatz,
	ergebnissatzDerAuswertung,
	rueckzugInDerAuswertung,
	rueckzugssatz,
	protokollfusszeile,
	geheimGrundlage,
	GEHEIM_BESCHLUSS_SATZ,
	GEHEIM_REGLEMENT_SATZ,
	fristvermerkImProtokoll,
	type Protokolleingabe,
	type Protokollzeile
} from '$lib/domain/protokoll';
import { FRISTFOLGE, fristvermerk } from '$lib/domain/versammlung';
import { L16_PROTOKOLLSTUFE } from '$lib/domain/lesarten';
import { ergebniswertung, zaehleAus } from '$lib/domain/auszaehlung';
import {
	AUSSTAND_UNGEKLAERT,
	NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL
} from '$lib/domain/mehrhinweise';
import type { Snapshot } from '$lib/domain/types';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { alsWorddokument } from '$lib/domain/docx';
import { dosZeitstempel } from '$lib/domain/archiv';

/**
 * Der Protokollentwurf.
 *
 * Geprüft wird nicht die Schönheit des Textes, sondern das, worauf es im
 * Streitfall ankommt: dass die Zahlen aus den Daten stammen, dass nichts
 * Fehlendes glattgebügelt wird, und dass der Text nichts erfindet.
 */
function eingabe(u: Partial<Protokolleingabe> = {}): Protokolleingabe {
	return {
		gemeinschaft: 'STWEG Musterweg 1',
		datum: '2026-05-19',
		uhrzeit: '19:00',
		ort: 'Restaurant Sonne',
		art: 'ordentlich',
		stufe: 'erste',
		schlusszeit: '21:15',
		sitzungsleitung: null,
		protokollfuehrung: null,
		beschlussfaehigkeit: {
			beschlussfaehig: true,
			satz: 'Die Versammlung ist beschlussfähig (ZGB 712p).',
			kopfstimmenAnwesend: 9,
			kopfstimmenGesamt: 14,
			eigentuemerAnwesend: null,
			eigentuemerGesamt: null,
			quotenAnwesend: 6500,
			gesamtquote: 10000,
			festgehalten: { zeitpunkt: '19:04', durch: 'Max Probère' }
		},
		zaehlweise: 'Eine Stimme je Einheit (Art. 28 Abs. 1 Reglement)',
		stichentscheid: null,
		teilnehmer: [
			{
				name: 'Aebi',
				einheiten: ['Whg 1'],
				zustand: 'anwesend',
				vertretenDurch: null,
				bevollmaechtigtFuer: ['Christen']
			},
			{
				name: 'Christen',
				einheiten: ['Whg 3'],
				zustand: 'anwesend',
				vertretenDurch: 'Aebi',
				bevollmaechtigtFuer: []
			},
			{
				name: 'Dubois',
				einheiten: ['Whg 4'],
				zustand: 'nicht_erschienen',
				vertretenDurch: null,
				bevollmaechtigtFuer: []
			}
		],
		zeilen: [
			{
				nummer: '1',
				tiefe: 0,
				titel: 'Fassadensanierung',
				art: 'abstimmung',
				antragswortlaut: 'Die Fassade wird saniert.',
				kurzfassung: null,
				notiz: 'Herr Aebi wies auf die Kosten hin.',
				erfordernis: 'Nützliche bauliche Massnahme',
				rechtsgrundlage: 'ZGB 647d',
				rueckzug: null,
				beschlusstext: null,
				pendenzen: [],
				satz: 'Angenommen.',
				zahlen: {
					koepfe: {
						ja: 8,
						nein: 1,
						enthaltung: 0,
						ohneAbgabe: 0,
						nichtAnwesend: 0,
						basis: 9,
						schwelle: 5
					},
					quoten: {
						ja: 6000,
						nein: 500,
						enthaltung: 0,
						ohneAbgabe: 0,
						nichtAnwesend: 0,
						basis: 6500,
						schwelle: null
					}
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
				vorgezogen: false
			}
		],
		erzeugtAm: '4. August 2026, 10:15',
		erzeugtDurch: 'Prüfer',
		...u
	};
}

describe('Der Protokollentwurf', () => {
	it('nennt einmal je Protokoll, wer einen Beschluss anfechten kann und innert welcher Frist (A5, Punkt 2)', () => {
		const t = protokollentwurf(eingabe());
		expect(t.match(/## Anfechtung/g)).toHaveLength(1);
		expect(t).toContain(ANFECHTUNG_IM_PROTOKOLL);
		expect(t).toContain('bei einem abgelehnten, wer nicht Nein gestimmt hat');
		expect(t).not.toContain('Abberufung der Verwaltung');
		const sonderfaelle = protokollentwurf(
			eingabe({ zeilen: [{ ...eingabe().zeilen[0], anfechtungssonderfall: 'abberufung' }] })
		);
		expect(sonderfaelle).toContain('Anders bei einer abgelehnten Abberufung der Verwaltung');
		expect(sonderfaelle).not.toContain('Für die Einsprache selbst läuft');
		// Ein zurückgezogenes Traktandum löst den Sonderfall nicht aus.
		const zurueck = protokollentwurf(
			eingabe({
				zeilen: [
					eingabe().zeilen[0],
					{ ...eingabe().zeilen[0], rueckzug: 'Vor der Abstimmung zurückgezogen.', anfechtungssonderfall: 'einsprache' }
				]
			})
		);
		expect(zurueck).not.toContain('Für die Einsprache selbst läuft');
		// Ohne Beschluss steht der Satz nicht.
		const ohne = protokollentwurf(
			eingabe({ zeilen: [{ ...eingabe().zeilen[0], satz: null, zahlen: null }] })
		);
		expect(ohne).not.toContain('## Anfechtung');
	});
	it('nennt Gemeinschaft, Datum, Ort und Beginn', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('STWEG Musterweg 1');
		expect(t).toContain('19. Mai 2026');
		expect(t).toContain('Restaurant Sonne');
		expect(t).toContain('19:00 Uhr');
	});

	it('führt die Beschlussfähigkeit mit beiden Zahlenpaaren', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('9 von 14');
		expect(t).toMatch(/6.500 von 10.000/);
		expect(t).toContain('Die Versammlung ist beschlussfähig');
	});

	it('nennt die fehlende Beschlussfähigkeit am Beschluss, nicht den Weg (Block 5)', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						vonHand: true,
						beschlussfaehigkeitFehlte: { grundlage: 'gesetz', fundstelle: null, angenommen: true }
					}
				]
			})
		);
		expect(t).toContain(
			'Die Versammlung war bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p). Wer ihm ' +
				'nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert eines Monats beim ' +
				'Gericht anfechten (ZGB Art. 75). Die Frist beginnt für Anwesende und Vertretene mit ' +
				'der Versammlung, für alle anderen, sobald sie vom Beschluss erfahren, spätestens mit ' +
				'dem Erhalt dieses Protokolls.'
		);
		expect(t).not.toMatch(/von Hand|übergangen|Notweg/);

		// Gegenprobe: Ohne das Merkmal steht der Satz nicht am Beschluss.
		const ohne = protokollentwurf(
			eingabe({ zeilen: [{ ...eingabe().zeilen[0], vonHand: true }] })
		);
		expect(ohne).not.toContain('nicht beschlussfähig');

		/*
		 * **Scheitert es an der strengeren Regel des Reglements, steht deren
		 * Fundstelle** (Fachprüfung 01.10.2026): ZGB Art. 712p muss dann nicht
		 * verletzt sein, und das Blatt kann vor Gericht gehen. Art. 75 bleibt.
		 */
		const reglement = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						vonHand: true,
						beschlussfaehigkeitFehlte: {
							grundlage: 'reglement',
							fundstelle: 'Art. 18',
							angenommen: true
						}
					}
				]
			})
		);
		// Über `mitQuelle`, wie im Kopf: «(Art. 18)» neben «(ZGB Art. 75)» liesse
		// den Leser im ZGB suchen.
		expect(reglement).toContain('nicht beschlussfähig (Art. 18 des Reglements). Wer ihm');
		// Der Kopf des Protokolls nennt 712p weiterhin; gemeint ist der Satz am Beschluss.
		expect(reglement).not.toContain('bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p)');
		expect(reglement).toContain('(ZGB Art. 75)');

		/*
		 * **Bei «Abgelehnt» beide Hinweise, in dieser Reihenfolge**
		 * (Produktentscheid 02.10.2026: «Beides»): erst neu vorlegen, dann die
		 * Anfechtung. «Wer ihm nicht zugestimmt hat» kehrte dort die Berechtigten
		 * um (Fachprüfung Block 5, Runde 2); es steht «mit der Ablehnung nicht
		 * einverstanden».
		 */
		const abgelehnt = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						vonHand: true,
						beschlussfaehigkeitFehlte: { grundlage: 'gesetz', fundstelle: null, angenommen: false }
					}
				]
			})
		);
		expect(abgelehnt).toContain(
			'Die Versammlung war bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p). Der ' +
				'Antrag kann einer beschlussfähigen Versammlung erneut vorgelegt werden. Wer mit der ' +
				'Ablehnung nicht einverstanden war, auch wer nicht dabei war, kann sie innert eines ' +
				'Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die Ablehnung in der ' +
				'Regel nur auf; angenommen ist der Antrag damit nicht. Die Frist beginnt für Anwesende ' +
				'und Vertretene mit der Versammlung, für alle anderen, sobald sie vom Beschluss ' +
				'erfahren, spätestens mit dem Erhalt dieses Protokolls.'
		);
		expect(abgelehnt).not.toContain('Wer ihm nicht zugestimmt hat');
	});

	it('nennt am gemeinsamen Abend die Gemeinschaft im Satz, im Hausprotokoll nicht (Block 6)', () => {
		/*
		 * Das Abenddokument lesen auch die Eigentümer der anderen Häuser
		 * (Laien- und Fachprüfung 02.10.2026; Rz. 223c, 226 ad Art. 712m).
		 */
		const abgelehnt = beschlussfaehigkeitFehlteSatz(
			{ grundlage: 'reglement', fundstelle: 'Art. 18', angenommen: false },
			'Musterweg 6'
		);
		expect(abgelehnt).toBe(
			'Die Versammlung von Musterweg 6 war bei diesem Beschluss nicht ' +
				'beschlussfähig (Reglement dieser Gemeinschaft, Art. 18). Der Antrag kann einer ' +
				'beschlussfähigen Versammlung erneut vorgelegt werden. Wer in dieser Gemeinschaft ' +
				'stimmberechtigt ist und mit der Ablehnung nicht einverstanden war, auch wer nicht dabei ' +
				'war, kann sie innert eines Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die ' +
				'Ablehnung in der Regel nur auf; angenommen ist der Antrag damit nicht. Die Frist ' +
				'beginnt für Anwesende und Vertretene mit der Versammlung, für alle anderen, sobald sie ' +
				'vom Beschluss erfahren, spätestens mit dem Erhalt dieses Protokolls.'
		);
		const angenommen = beschlussfaehigkeitFehlteSatz(
			{ grundlage: 'gesetz', fundstelle: null, angenommen: true },
			'Musterweg 6'
		);
		expect(angenommen).toContain(
			'Die Versammlung von Musterweg 6 war bei diesem Beschluss nicht ' +
				'beschlussfähig (ZGB Art. 712p). Wer in dieser Gemeinschaft stimmberechtigt ist und ' +
				'ihm nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert'
		);
		// Freier Text als Fundstelle hängt nicht bezugslos an «dieser Gemeinschaft»,
		// und ohne Fundstelle bleibt die Klammer lesbar (Codeprüfung 02.10.2026).
		expect(
			beschlussfaehigkeitFehlteSatz(
				{ grundlage: 'reglement', fundstelle: 'Art. 18.2', angenommen: true },
				'STWEG Musterweg 6'
			)
		).toContain(
			'Die Versammlung von STWEG Musterweg 6 war bei diesem Beschluss nicht beschlussfähig ' +
				'(Reglement dieser Gemeinschaft, Art. 18.2).'
		);
		expect(
			beschlussfaehigkeitFehlteSatz(
				{ grundlage: 'reglement', fundstelle: null, angenommen: true },
				'Musterweg 6'
			)
		).toContain('nicht beschlussfähig (Reglement dieser Gemeinschaft).');
		// Ohne Namen bleibt der Wortlaut des Hausprotokolls, wie er geprüft ist.
		expect(
			beschlussfaehigkeitFehlteSatz({ grundlage: 'gesetz', fundstelle: null, angenommen: true })
		).toBe(
			'Die Versammlung war bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p). Wer ihm ' +
				'nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert eines Monats beim ' +
				'Gericht anfechten (ZGB Art. 75). Die Frist beginnt für Anwesende und Vertretene mit ' +
				'der Versammlung, für alle anderen, sobald sie vom Beschluss erfahren, spätestens mit ' +
				'dem Erhalt dieses Protokolls.'
		);
	});

	it('rechnet die fehlende Beschlussfähigkeit am Beschluss an einer Stelle (Block 6)', () => {
		/*
		 * Drei Eigentümer zu je 300 von 900. Die Funktion ist die eine Rechnung
		 * für das Hausprotokoll und das gemeinsame Protokoll des Abends.
		 */
		const eintrag = (partyId: string) => ({
			partyId,
			displayName: partyId,
			ausgeuebtDurch: null,
			einheiten: [{ unitId: `e-${partyId}`, label: 'Whg', kind: 'unit' as const, wertquote: 300 }],
			kopfstimmen: 1,
			wertquote: 300
		});
		const stimmkraft = {
			eintraege: ['a', 'b', 'c'].map(eintrag),
			summeKopfstimmen: 3,
			summeWertquote: 900,
			zaehlweise: 'per_owner' as const,
			nebenobjekteZaehlen: false,
			gesamtquote: 900
		} as unknown as Parameters<typeof beschlussfaehigkeitFehlteAmBeschluss>[0]['stimmkraft'];
		const vonHand = { vonHand: { erfassung: 'summen' }, angenommen: false } as unknown as NonNullable<
			Parameters<typeof beschlussfaehigkeitFehlteAmBeschluss>[0]['auszaehlung']
		>;
		const lage = {
			stimmkraft,
			anwesende: ['a'],
			stufe: 'erste' as const,
			regel: null,
			auszaehlung: vonHand
		};

		// Einer von dreien: nach dem Gesetz nicht beschlussfähig; der Ausgang geht mit.
		expect(beschlussfaehigkeitFehlteAmBeschluss(lage)).toEqual({
			grundlage: 'gesetz',
			fundstelle: null,
			angenommen: false
		});
		// Zwei von dreien mit 600 von 900: beschlussfähig, kein Satz.
		expect(beschlussfaehigkeitFehlteAmBeschluss({ ...lage, anwesende: ['a', 'b'] })).toBeNull();
		// Dieselben zwei, aber die Regel des Reglements verlangt drei: Grundlage ist das Reglement.
		expect(
			beschlussfaehigkeitFehlteAmBeschluss({
				...lage,
				anwesende: ['a', 'b'],
				regel: {
					kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
					quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
					mindestens: 3,
					fundstelle: 'Art. 18'
				}
			})
		).toEqual({ grundlage: 'reglement', fundstelle: 'Art. 18', angenommen: false });
		// Zweite Versammlung: ein Drittel der Eigentümer, mindestens zwei, ohne Wertquoten.
		expect(beschlussfaehigkeitFehlteAmBeschluss({ ...lage, stufe: 'zweite' })).not.toBeNull();
		expect(
			beschlussfaehigkeitFehlteAmBeschluss({ ...lage, stufe: 'zweite', anwesende: ['a', 'b'] })
		).toBeNull();
		// Ein gezählter Durchgang trägt den Satz nie; ohne Stand oder Stimmkraft auch nicht.
		expect(
			beschlussfaehigkeitFehlteAmBeschluss({
				...lage,
				auszaehlung: { angenommen: true } as typeof vonHand
			})
		).toBeNull();
		expect(beschlussfaehigkeitFehlteAmBeschluss({ ...lage, anwesende: null })).toBeNull();
		expect(beschlussfaehigkeitFehlteAmBeschluss({ ...lage, stimmkraft: null })).toBeNull();
	});

	it('schreibt die Vertretung an beide Zeilen', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('Christen (Whg 3) — vertreten durch Aebi');
		expect(t).toContain('Aebi (Whg 1) — bevollmächtigt für Christen');
	});

	it('trennt Anwesende von Nichterschienenen', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('Anwesend oder vertreten (2)');
		expect(t).toContain('Nicht erschienen (1)');
	});

	it('vermerkt, wer vorzeitig ging', () => {
		const t = protokollentwurf(
			eingabe({
				teilnehmer: [
					{
						name: 'Aebi',
						einheiten: [],
						zustand: 'gegangen',
						vertretenDurch: null,
						bevollmaechtigtFuer: []
					}
				]
			})
		);
		expect(t).toContain('hat die Versammlung vorzeitig verlassen');
	});

	/*
	 * **«Erforderliche Mehrheit: Décharge und Protokollgenehmigung» war keine
	 * Mehrheit** (Prüflauf 22.08.2026, Befund D-04). Dort stand der Fallname, und
	 * daneben eine Rechtsgrundlage, die nach einer Übersteuerung nicht mehr
	 * stimmte. Seither trägt die Zeile drei Dinge an ihrem Platz: die Regel, den
	 * Fall, die Herkunft.
	 */
	it('nennt Regel, Fall und Herkunft an ihrem jeweiligen Platz', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						erfordernis: 'mehr als die Hälfte aller Eigentümer',
						fall: 'Nützliche bauliche Massnahme',
						rechtsgrundlage: 'ZGB Art. 647d'
					}
				]
			})
		);
		/*
		 * **«hergeleitet als» vor der Fallgruppe** (Auftraggeber, 03.09.2026). Ohne das
		 * stand unter der Protokollgenehmigung «(Décharge und
		 * Protokollgenehmigung, …)», und das Wort «Décharge» las sich wie ein
		 * Fehler. Der Knotentitel ist die Fallgruppe des Entscheidbaums, nicht die
		 * Bezeichnung dieses Geschäfts — und das muss der Satz sagen.
		 */
		expect(t).toContain(
			'Erforderliche Mehrheit: mehr als die Hälfte aller Eigentümer ' +
				'(hergeleitet als «Nützliche bauliche Massnahme», ZGB Art. 647d)'
		);
	});

	/*
	 * **Eine Mehrheit, die die Leitung gesetzt hat, ist keine Herleitung**
	 * (Codeprüfung 30.09.2026). Vorher stand hier «Von der Sitzungsleitung
	 * gesetzt (abweichend von: …)». Seit dem Produktentscheid vom 30.09.2026
	 * geht keine Herkunft mehr nach aussen, und «hergeleitet als» behauptete
	 * sonst, das Werkzeug habe bestimmt, was die Leitung entschieden hat.
	 */
	it('nennt bei einer gesetzten Mehrheit weder Herleitung noch leere Klammer', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						erfordernis: 'mehr als die Hälfte aller Eigentümer',
						fall: 'Qualifiziertes Mehr aller Eigentümer',
						mehrheitGesetzt: true,
						rechtsgrundlage: ''
					}
				]
			})
		);
		expect(t).toContain('Erforderliche Mehrheit: mehr als die Hälfte aller Eigentümer\n');
		expect(t).not.toContain('hergeleitet als');
		expect(t).not.toContain('()');
	});

	/**
	 * **Eine Fallgruppe deckt zwei Geschäfte ab, und beide lesen sich richtig.**
	 *
	 * `k-decharge` im Entscheidbaum heisst «Décharge und Protokollgenehmigung»,
	 * weil beide Geschäfte dieselbe Schwelle haben. Im Protokoll steht der Titel
	 * unter jedem der beiden Traktanden — bei der Protokollgenehmigung fiel dem Auftraggeber
	 * das Wort «Décharge» auf.
	 */
	it('kennzeichnet eine Fallgruppe als Herleitung, nicht als Gegenstand', () => {
		const geschaeft = (nummer: string, titel: string) => ({
			...eingabe().zeilen[0],
			nummer,
			titel,
			erfordernis: 'mehr als die Hälfte der Anwesenden und Vertretenen',
			fall: 'Décharge und Protokollgenehmigung',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 (Praxis)'
		});
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					geschaeft('3', 'Genehmigung des Protokolls der letzten Versammlung'),
					geschaeft('8', 'Décharge an die Bewirtschaftung')
				]
			})
		);
		expect(t).toContain(
			'(hergeleitet als «Décharge und Protokollgenehmigung», ZGB Art. 712m Abs. 1 (Praxis))'
		);
		expect(
			t,
			'ohne «hergeleitet als» liest sich die Fallgruppe wie der Gegenstand des Traktandums'
		).not.toContain('Vertretenen (Décharge');
	});

	it('übernimmt Antrag, Notiz, Erfordernis und Ergebnis je Traktandum', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('Antrag: Die Fassade wird saniert.');
		expect(t).toContain('Herr Aebi wies auf die Kosten hin.');
		expect(t).toContain('Erforderliche Mehrheit: Nützliche bauliche Massnahme (ZGB 647d)');
		expect(t).toContain('Angenommen.');
		expect(t).toContain('Kopfstimmen: 8 Ja, 1 Nein');
	});

	/**
	 * **Die Zahlen stehen einmal** (28.08.2026, Befund des Auftraggebers: «Beim
	 * qualifizierten Mehr steht das Ergebnis zweimal für die Köpfe und einmal für
	 * die Wertquoten»).
	 *
	 * Die Ursache war, dass das Protokoll den Leinwandsatz übernahm. Der muss
	 * dort seine Zahlen tragen, weil er allein steht; hier folgt der Spiegel
	 * unmittelbar darunter. Und weil der Satz nur die **gescheiterte** Seite
	 * nennt, war die Wiederholung einseitig.
	 *
	 * Die Zusicherung prüft deshalb nicht auf einen Wortlaut, sondern auf die
	 * Eigenschaft: In der Wertungszeile steht keine Ziffer. Mit dem alten Satz
	 * wird sie rot.
	 */
	it('trägt die Zahlen nur im Spiegel, nicht auch in der Wertung', () => {
		const t = protokollentwurf(eingabe());
		const wertung = t
			.split('\n')
			.filter((zeile) => /^(Angenommen|Abgelehnt|Stimmengleichheit)/.test(zeile));
		expect(wertung.length).toBeGreaterThan(0);
		for (const zeile of wertung) expect(zeile).not.toMatch(/\d/);
	});

	/**
	 * **Die Beschlussfähigkeit steht an einer Stelle** (28.08.2026, Befund des Auftraggebers:
	 * «Beschlussfähigkeit steht zweimal — am Anfang und in der Ziffer. Sie gehört
	 * in die Ziffer»).
	 *
	 * Vorher: ein eigener Abschnitt mit allen Zahlen, und daneben im
	 * Verhandlungsteil dieselbe Ziffer, unter der nur «Zur Kenntnis genommen»
	 * stand. Jetzt wandern die Zahlen unter die Ziffer, sofern es eine gibt.
	 */
	it('setzt die Feststellung unter die Ziffer, die sie ankündigt', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						nummer: '1',
						titel: 'Begrüssung und Feststellung der Beschlussfähigkeit',
						art: 'kenntnisnahme',
						antragswortlaut: null,
						notiz: null,
						beschlusstext: null,
						pendenzen: [],
						satz: null,
						zahlen: null
					}
				]
			})
		);
		expect(t).not.toContain('## Feststellung der Beschlussfähigkeit');
		const unterDerZiffer = t.slice(t.indexOf('Begrüssung und Feststellung'));
		expect(unterDerZiffer).toContain('Anwesend und vertreten sind');
		expect(unterDerZiffer).toContain('Die Versammlung ist beschlussfähig');
	});

	/**
	 * **Der Rückfall.** Der Träger wird am Titel erkannt, und ein Titel ist frei
	 * gewählt. Fehlt das Wort, muss die Feststellung dennoch im Protokoll
	 * stehen — sonst hätte eine Umbenennung sie zum Verschwinden gebracht.
	 */
	it('behält den eigenen Abschnitt, wo kein Traktandum sie trägt', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('## Feststellung der Beschlussfähigkeit');
		expect(t).toContain('Anwesend und vertreten sind');
	});

	/**
	 * **Ein Antrag über eine Beschlussfähigkeitsregel ist kein Träger.** Er wird
	 * abgestimmt; die Feststellung gehört nicht unter ihn. Deshalb greift die
	 * Erkennung nur bei Kenntnisnahmen.
	 */
	it('zieht die Zahlen nicht unter einen Antrag mit demselben Wort im Titel', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						titel: 'Änderung der Beschlussfähigkeitsregel im Reglement',
						art: 'abstimmung'
					}
				]
			})
		);
		expect(t).toContain('## Feststellung der Beschlussfähigkeit');
	});

	/**
	 * **Abwesende, die nicht in die Bezugsgrösse zählen** (28.08.2026, zweiter
	 * Code-Review).
	 *
	 * Bei «Mehrheit der Anwesenden» steht `nichtAnwesend` neben der Basis, nicht
	 * darin. In derselben Aufzählung ergäbe das eine Eimersumme, die zur
	 * Bezugsgrösse nicht passt — und seit die Wertung keine Zahlen mehr trägt,
	 * löst das nichts mehr auf.
	 */
	it('weist Abwesende gesondert aus, wo sie nicht zur Bezugsgrösse zählen', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						zahlen: {
							// 8 + 1 = 9 = basis, die sechs Abwesenden stehen daneben.
							koepfe: {
								ja: 8,
								nein: 1,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 6,
								basis: 9,
								schwelle: 5
							},
							quoten: {
								ja: 6000,
								nein: 500,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								basis: 6500,
								schwelle: null
							}
						}
					}
				]
			})
		);
		expect(t).toContain('ausserhalb der Bezugsgrösse');
		expect(t).not.toContain('ohne Abgabe, 6 nicht anwesend (von 9)');
	});

	it('reiht Abwesende ein, wo die Bezugsgrösse sie umfasst', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						zahlen: {
							// 8 + 1 + 6 = 15 = basis.
							koepfe: {
								ja: 8,
								nein: 1,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 6,
								basis: 15,
								schwelle: 8
							},
							quoten: {
								ja: 6000,
								nein: 500,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								basis: 6500,
								schwelle: null
							}
						}
					}
				]
			})
		);
		expect(t).toContain('0 ohne Abgabe, 6 nicht anwesend (von 15), nötig 8');
		expect(t).not.toContain('ausserhalb der Bezugsgrösse');
	});

	/*
	 * **Die gemeinsame Wohnung des Beklagten, die nicht abstimmt** (Codeprüfung
	 * 30.09.2026, N1 und M-a). Bei den Köpfen steht sie in der Basis und in der
	 * Klammer, bei Wertquoten ohne Basis über alle dahinter.
	 */
	it('nennt die Wohnung des Beklagten eigens, in oder neben der Bezugsgrösse', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						zahlen: {
							// 5 + 4 + 1 = 10 = basis.
							koepfe: {
								ja: 5,
								nein: 4,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								stimmtNicht: 1,
								basis: 10,
								schwelle: 6
							},
							// 500 + 400 = 900 = basis; die 100 der Wohnung stehen daneben.
							quoten: {
								ja: 500,
								nein: 400,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								stimmtNicht: 100,
								basis: 900,
								schwelle: null
							}
						}
					}
				]
			})
		);
		expect(t).toContain(
			'0 ohne Abgabe, 1 Wohnung des Beklagten, stimmt nicht ab (von 10), nötig 6'
		);
		expect(t).toContain('(von 900); 100 bei der Wohnung des Beklagten, die nicht abstimmt, ausserhalb der Bezugsgrösse');
		expect(t).not.toContain('nicht anwesend');
	});

	/**
	 * **Der Platzhalter ist kein Name** (28.08.2026, zweiter Code-Review). Wer
	 * die Zeile liest, will wissen, bei wem nachzufragen ist; «(nicht im Stand)»
	 * beantwortet das nicht und gehört deshalb nicht in dieselbe Aufzählung.
	 */
	it('setzt eine nicht im Stand stehende Partei nicht als Namen ein', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						ohneZustimmung: ['Anna Muster', '(nicht im Stand)']
					}
				]
			})
		);
		expect(t).toContain('- Ohne die nach ZGB Art. 712g Abs. 4 nötige Zustimmung: Anna Muster');
		expect(t).not.toContain('Zustimmung: Anna Muster, (nicht im Stand)');
		/*
		 * **Wortlaut nachgezogen, Aussage nicht** (23.09.2026). «Stimmberechtigten
		 * stand» ist Hausjargon und fiel dem Textwächter auf; die Aussage bleibt
		 * dieselbe — die Partei fehlt im festgehaltenen Stand, über ihr Stimmrecht
		 * sagt die Zeile nichts. Ein erster Anlauf schrieb «nicht stimmberechtigt»
		 * und hat genau das behauptet; diese Probe hat es gefangen.
		 */
		expect(t).toContain('nicht im festgehaltenen Stand der Stimmberechtigten');
	});

	/**
	 * **Die Handzählung im Protokoll** (28.08.2026, Befund des Auftraggebers: «Handabstimmung
	 * fehlt im Protokoll»).
	 *
	 * Sie fehlte doppelt: Dass von Hand gezählt wurde, stand nirgends, und der
	 * leere Quotenspiegel wurde ausgeschrieben — «0 Ja, 0 Nein, 0 Enthaltung, 0
	 * ohne Abgabe (von 0)». Das liest sich wie ein Ergebnis und ist keines. Die
	 * Auszählung unterscheidet die beiden Fälle seit der Handzählung über
	 * `quotenErhoben`; Leitungssicht, Auswertungsseite und Auswertungs-PDF
	 * fragten es ab, das Protokoll nicht.
	 */
	it('schreibt bei einer Handzählung keine Wertquoten, die niemand gezählt hat', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						beschlusstext: null,
						pendenzen: [],
						satz: 'Angenommen.',
						zahlen: {
							koepfe: {
								ja: 8,
								nein: 1,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								basis: 9,
								schwelle: 5
							},
							quoten: {
								ja: 0,
								nein: 0,
								enthaltung: 0,
								ohneAbgabe: 0,
								nichtAnwesend: 0,
								basis: 0,
								schwelle: null
							}
						},
						quotenErhoben: false,
						handzaehlung: {
							vermerk: 'Handerheben, ausgezählt durch zwei Stimmenzähler'
						}
					}
				]
			})
		);
		expect(t).toContain('- Stimmen nach Wertquoten: nicht erhoben');
		expect(t).toContain('Von Hand gezählt, ohne Zuordnung zu Personen: Handerheben');
		// Der leere Spiegel darf nicht als Ergebnis erscheinen.
		expect(t).not.toContain('Wertquoten: 0 Ja');
	});

	/**
	 * **Die Schwelle wandert mit** (28.08.2026). Sie stand bisher allein im Satz
	 * («nötig 5») und damit nur bei der Seite, an der es scheiterte. Nimmt man
	 * die Zahlen aus dem Satz, muss sie in den Spiegel — sonst verschwände die
	 * Zahl, an der sich alles entscheidet.
	 */
	it('nennt die Schwelle bei der Zahl, die sich an ihr misst', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain(
			'- Kopfstimmen: 8 Ja, 1 Nein, 0 Enthaltung, 0 ohne Abgabe (von 9), nötig 5'
		);
	});

	it('erfindet kein Ergebnis, wo keines ist', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						beschlusstext: null,
						pendenzen: [],
						satz: null,
						zahlen: null,
						durchgang: null
					}
				]
			})
		);
		expect(t).toContain('Über diesen Antrag wurde nicht abgestimmt.');
		expect(t).not.toContain('Angenommen');
	});

	it('nennt eine Kenntnisnahme als solche', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						art: 'kenntnisnahme',
						beschlusstext: null,
						pendenzen: [],
						satz: null,
						zahlen: null
					}
				]
			})
		);
		expect(t).toContain('Zur Kenntnis genommen; es wurde nicht abgestimmt.');
	});

	it('sagt es, wenn die Beschlussfähigkeit fehlt — statt sie zu verschweigen', () => {
		const t = protokollentwurf(eingabe({ beschlussfaehigkeit: null }));
		expect(t).toContain('nicht festgehalten');
		expect(t).toContain('nachzutragen');
	});

	it('sagt es, wenn die Versammlung noch offen ist', () => {
		const t = protokollentwurf(eingabe({ schlusszeit: null }));
		expect(t).toContain('noch nicht geschlossen');
	});

	it('hält den Stichentscheid mit Person und Begründung fest', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						stichentscheid: {
							// Der reale Wert aus `Stichentscheidbefund`; die Fixture
							// führte hier bis zum 04.10.2026 «Ja» und damit einen
							// Wert, den der Serverpfad nie liefert.
							wahl: 'yes',
							wer: 'Ruth Kunz',
							begruendung: 'Art. 30 Reglement'
						}
					}
				]
			})
		);
		expect(t).toContain('entschied Ruth Kunz: Annahme. Begründung: Art. 30 Reglement');
	});

	/*
	 * **Der Anlass, am 20.08.2026.** Gemeldet als Loch: «dass der Sitzungsleiter
	 * für einen Eigentümer stimmen darf. Das müsste aber dokumentiert sein.»
	 * Dokumentiert heisst: im Protokoll, nicht nur in der Datenbank.
	 */
	it('hält fest, für wen die Sitzungsleitung erfasst hat — und warum', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						stellvertretend: [
							{
								name: 'Anna Muster',
								grund: 'Telefon ausgefallen, mündlich abgegeben'
							},
							{ name: 'Erbengemeinschaft Kunz', grund: 'kein Empfang im Saal' }
						]
					}
				]
			})
		);
		expect(t).toContain(
			'- Für Anna Muster erfasste die Sitzungsleitung die Stimme: Telefon ausgefallen, mündlich abgegeben'
		);
		expect(t).toContain(
			'- Für Erbengemeinschaft Kunz erfasste die Sitzungsleitung die Stimme: kein Empfang im Saal'
		);
	});

	it('schweigt darüber, wo nichts stellvertretend erfasst wurde', () => {
		// Sonst stünde unter jedem Traktandum eine Zeile über etwas, das nicht
		// geschehen ist.
		expect(protokollentwurf(eingabe())).not.toContain('erfasste die Sitzungsleitung');
	});

	it('rückt Untertraktanden als tiefere Überschrift ein', () => {
		const t = protokollentwurf(
			eingabe({
				zeilen: [{ ...eingabe().zeilen[0], tiefe: 1, nummer: '1.1' }]
			})
		);
		expect(t).toContain('#### 1.1 Fassadensanierung');
	});

	it('weist die zweite Versammlung aus', () => {
		// Seit dem 03.09.2026 als Kopffeld statt als Aufzählungspunkt.
		expect(protokollentwurf(eingabe({ stufe: 'zweite' }))).toContain(
			'| Stufe | Zweite Versammlung nach ZGB 712p Abs. 3 |'
		);
	});

	it('sagt an einer zweiten nach L16, dass sie auf der Einstellung beruht (Migration 194)', () => {
		const text = protokollentwurf(eingabe({ stufe: 'zweite', stufeNachLesart: true }));
		expect(text).toContain(`| Stufe | ${L16_PROTOKOLLSTUFE} |`);
		expect(text).not.toContain('| Stufe | Zweite Versammlung nach ZGB 712p Abs. 3 |');
		expect(L16_PROTOKOLLSTUFE).toContain('Standardeinstellung wäre eine neue erste Versammlung');
		expect(L16_PROTOKOLLSTUFE).toContain('Bei jedem angenommenen Beschluss steht');
	});

	it('sagt an jedem Beschluss einer zweiten nach L16, ob die erste Beschlussfähigkeit erreicht war', () => {
		expect(l16Beschlusssatz(undefined)).toBeNull();
		expect(l16Beschlusssatz(null)).toBeNull();
		expect(l16Beschlusssatz(null, true)).toContain('lässt sich aus den erfassten Angaben nicht bestimmen');
		expect(l16Beschlusssatz(false)).toContain('wirkt sich auf ihn nicht aus');
		expect(l16Beschlusssatz({ angenommen: true, vonHand: false })).toContain('steht unter «Anfechtung»');
		expect(l16Beschlusssatz({ angenommen: false, vonHand: false })).toBeNull();
	});

	/*
	 * **Der Fristvermerk im Kopf** (Befund R-2b, 24.09.2026).
	 *
	 * Direkt unter der Stufe, weil die Zeile darüber sonst unvollständig ist:
	 * «Zweite Versammlung nach ZGB 712p Abs. 3» liest sich wie eine
	 * ordnungsgemässe. Das Protokoll ist der Text, den ein Gericht liest; ob die
	 * Versammlung überhaupt beschliessen durfte, gehört vor das erste Traktandum
	 * und nicht in eine Fussnote.
	 */
	it('führt den Fristvermerk unter der Stufe', () => {
		const t = protokollentwurf(
			eingabe({ stufe: 'zweite', fristvermerk: 'Diese Versammlung ist zu früh angesetzt: nur 5 Tage nach der ersten.' })
		);
		const zeilen = t.split('\n');
		const stufe = zeilen.findIndex((z) => z.startsWith('| Stufe |'));
		const frist = zeilen.findIndex((z) => z.startsWith('| Frist nicht eingehalten |'));
		expect(stufe).toBeGreaterThan(-1);
		// Nicht nur «steht irgendwo»: unmittelbar darunter, sonst trennt ihn der
		// Vorsitz von der Angabe, die er ergänzt.
		expect(frist).toBe(stufe + 1);
		expect(zeilen[frist]).toContain('nur 5 Tage nach der ersten');
	});

	it('nennt bei der Vertretung den Grund, wenn es einer ist (Ä-28)', () => {
		// Wer über der Höchstzahl des Reglements vertrat, soll im Anfechtungsfall
		// im Protokoll belegen können, warum das zulässig war. «vertreten durch X»
		// allein liesse die Frage offen.
		const t = protokollentwurf(
			eingabe({
				teilnehmer: [
					{
						name: 'Aebi',
						einheiten: ['Whg 1'],
						zustand: 'anwesend',
						vertretenDurch: 'Zemp (Organ einer juristischen Person)',
						bevollmaechtigtFuer: []
					}
				]
			})
		);
		expect(t).toContain('vertreten durch Zemp (Organ einer juristischen Person)');
	});

	/*
	 * **Die Ausnahme der Universalversammlung im Protokoll** (Ä-17, 17.10.2026).
	 * Gerechnet aus dem echten Vermerk, damit die Probe rot wird, wenn
	 * `fristvermerk` seinen Folgesatz ändert und das Ersetzen still ausfällt.
	 */
	describe('Rechtsfolge des Fristvermerks (Ä-17)', () => {
		const vermerk = fristvermerk('2026-09-10', '2026-09-15')!;
		const zeile = (universaleinstellung?: Protokolleingabe['universaleinstellung']) =>
			protokollentwurf(eingabe({ stufe: 'zweite', fristvermerk: vermerk, universaleinstellung }))
				.split('\n')
				.find((z) => z.startsWith('| Frist nicht eingehalten |'))!;

		it('nennt die Ausnahme statt des unbedingten Satzes, Vorgabe persönlich', () => {
			const z = zeile();
			expect(z).toContain('Bei jedem Beschluss sind alle Eigentümer anwesend, und niemand hat');
			expect(z).toContain('Rz. 39 ad Art. 712p, Rz. 28 ad Art. 712n');
			expect(z).toContain('diese Gemeinschaft zählt nur persönlich Anwesende');
			expect(z).not.toContain(FRISTFOLGE);
			// Was vor der Rechtsfolge steht, bleibt.
			expect(z).toContain('nur 5 Tage nach der ersten');
		});

		it('folgt der Einstellung der Gemeinschaft', () => {
			expect(zeile({ universalvariante: 'vertreten', leitungsvollmachtenZaehlen: true })).toContain(
				'diese Gemeinschaft zählt auch Vertretene. Werden'
			);
			expect(zeile({ universalvariante: 'vertreten', leitungsvollmachtenZaehlen: false })).toContain(
				'auch Vertretene, nicht aber über eine Vollmacht der Sitzungsleitung oder der Verwaltung.'
			);
			// «Keine Universalversammlung»: der Satz von vorher.
			expect(zeile({ universalvariante: 'keine', leitungsvollmachtenZaehlen: false })).toContain(FRISTFOLGE);
		});

		it('lässt einen Vermerk unbekannter Fassung stehen', () => {
			expect(fristvermerkImProtokoll('Alter Wortlaut.', null)).toBe('Alter Wortlaut.');
		});

		it('ändert die Einladung nicht', () => {
			expect(vermerk.endsWith(FRISTFOLGE)).toBe(true);
		});
	});

	it('lässt den Kopf ohne Vermerk, wo die Frist eingehalten ist', () => {
		expect(protokollentwurf(eingabe({ stufe: 'zweite' }))).not.toContain('Frist nicht eingehalten');
	});

	it('nennt Zeitpunkt und Person der Erzeugung', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('Entwurf erzeugt am 4. August 2026, 10:15 durch Prüfer');
		expect(t).toContain('nicht neu formuliert');
	});

	it('liefert bei gleicher Eingabe denselben Text', () => {
		// Der Kern liest keine Uhr (AD-1): Zweimal aufgerufen, zweimal dasselbe.
		expect(protokollentwurf(eingabe())).toBe(protokollentwurf(eingabe()));
	});
});

/**
 * **Der Kopf ist eine Tabelle** (Auftraggeber, 03.09.2026, mit einer Word-Vorlage:
 * «Struktur im Sinne von hier. Das wäre meine Vorstellung.»).
 *
 * Seine Vorlage führt den Kopf zweispaltig — Bezeichnung links, Wert rechts.
 * Vorher war es eine Aufzählung, und Datum und Beginn standen auf zwei Zeilen.
 */
describe('Der Kopf als Tabelle', () => {
	it('führt jedes Feld als zweispaltige Zeile', () => {
		const t = protokollentwurf(
			eingabe({
				sitzungsleitung: 'Rita Berger',
				protokollfuehrung: 'Anna Muster'
			})
		);
		expect(t).toContain('| Gemeinschaft | STWEG Musterweg 1 |');
		expect(t).toContain('| Ort | Restaurant Sonne |');
		expect(t).toContain('| Vorsitz | Rita Berger |');
		expect(t).toContain('| Protokollführung | Anna Muster |');
	});

	/*
	 * **Datum und Beginn in einer Zeile**, wie in der Vorlage («Datum/Zeit:
	 * dd.mm.yyyy / hh:MM Uhr»). Zwei Zeilen für eine Angabe waren der Anfang der
	 * Lücken, über die der Auftraggeber gestolpert ist.
	 */
	it('setzt Datum und Beginn in dieselbe Zeile', () => {
		const t = protokollentwurf(eingabe());
		expect(t).toContain('| Datum, Beginn | 19. Mai 2026, 19:00 Uhr |');
		expect(t, 'die alte Aufzählung steht nicht mehr daneben').not.toContain('- Datum:');
	});

	it('lässt leere Felder ganz weg, statt sie leer zu zeigen', () => {
		const t = protokollentwurf(eingabe());
		expect(t).not.toContain('| Vorsitz |');
		expect(t).not.toContain('| Stufe |');
	});
});

/**
 * **Erst der Kopf, dann die Traktanden, dann die Inhalte** (Auftraggeber, 03.09.2026:
 * «Das Protokoll soll wie ein Protokoll aufgebaut sein … Erste Seite im Kopf
 * alles relevante dann Traktanden und dann die Inhalte»).
 *
 * Vorher sprang das Dokument vom Kopf unmittelbar in die Verhandlungen: Wer
 * wissen wollte, worüber der Abend ging, musste alle Ergebnisse durchlesen.
 */
describe('Die Traktandenübersicht', () => {
	function mitDrei() {
		const erste = eingabe().zeilen[0];
		return protokollentwurf(
			eingabe({
				zeilen: [
					erste,
					{ ...erste, nummer: '2', titel: 'Jahresrechnung', tiefe: 0 },
					{ ...erste, nummer: '2.1', titel: 'Revisionsbericht', tiefe: 1 }
				]
			})
		);
	}

	it('steht zwischen dem Kopf und den Verhandlungen', () => {
		const t = mitDrei();
		expect(t.indexOf('## Traktanden')).toBeGreaterThan(t.indexOf('## Anwesenheit'));
		expect(t.indexOf('## Traktanden')).toBeLessThan(t.indexOf('## Verhandlungen'));
	});

	/*
	 * **Ohne Einzug, mit Nummer** (aus dem Code-Review). Führende Leerzeichen
	 * überleben den PDF-Umbruch nicht (`umbrich` zerlegt in Wörter) und haben in
	 * Word keine Entsprechung. Die Gliederung steht in der Nummer.
	 */
	it('führt Nummer und Titel, ohne Einzug', () => {
		const t = mitDrei();
		expect(t).toContain('- 1 Fassadensanierung');
		expect(t).toContain('- 2 Jahresrechnung');
		expect(t).toContain('- 2.1 Revisionsbericht');
		const uebersicht = t.slice(t.indexOf('## Traktanden'), t.indexOf('## Verhandlungen'));
		expect(uebersicht, 'ein Einzug, den nur das Textfeld zeigt').not.toMatch(/-\s\s+/);
	});

	/*
	 * **Kein Ergebnis in der Übersicht.** Es wäre eine zweite Fassung des
	 * Beschlusses und liefe bei der ersten Berichtigung auseinander — im
	 * Protokoll ist eine zweite Fassung schlimmer als eine fehlende Angabe.
	 */
	it('nennt dort kein Ergebnis', () => {
		const t = mitDrei();
		const uebersicht = t.slice(t.indexOf('## Traktanden'), t.indexOf('## Verhandlungen'));
		expect(uebersicht).not.toContain('Angenommen');
		expect(uebersicht).not.toContain('Kopfstimmen');
	});

	it('entfällt ganz, wenn keine Traktanden erfasst sind', () => {
		expect(protokollentwurf(eingabe({ zeilen: [] }))).not.toContain('## Traktanden');
	});
});

describe('Vorsitz und Protokollführung', () => {
	/*
	 * **Warum beide Richtungen.** Das Gesetz verlangt die Angabe nicht (ZGB
	 * Art. 712n Abs. 2 nennt als Mindestinhalt die Beschlüsse); gebraucht wird sie
	 * für die Unterschriftszeilen, die der SVIT-Kommentar empfiehlt (Rz. 107).
	 * Fehlt sie, muss das Protokoll unverändert aussehen wie zuvor — sonst hätte
	 * ein freiwilliges Feld die Form erzwungen.
	 */
	it('nennt beide im Kopf und über den Unterschriftszeilen', () => {
		const text = protokollentwurf(
			eingabe({
				sitzungsleitung: 'Rita Berger',
				protokollfuehrung: 'Notariat Muster'
			})
		);
		// Seit dem 03.09.2026 steht der Kopf als Tabelle (Vorlage des Auftraggebers).
		expect(text).toContain('| Vorsitz | Rita Berger |');
		expect(text).toContain('| Protokollführung | Notariat Muster |');
		expect(text).toContain('Die Sitzungsleitung — Rita Berger:');
		expect(text).toContain('Die Protokollführung — Notariat Muster:');
	});

	it('lässt die Zeilen leer, wenn niemand eingetragen ist', () => {
		const text = protokollentwurf(eingabe());
		expect(text).not.toContain('| Vorsitz |');
		expect(text).not.toContain('| Protokollführung |');
		// Die blossen Zeilen bleiben — unterschrieben wird auch ohne Namensangabe.
		expect(text).toContain('Die Sitzungsleitung:');
		expect(text).toContain('Die Protokollführung:');
	});

	it('nennt nur, was da ist', () => {
		const text = protokollentwurf(eingabe({ sitzungsleitung: 'Rita Berger' }));
		expect(text).toContain('Die Sitzungsleitung — Rita Berger:');
		expect(text).toContain('Die Protokollführung:');
		expect(text).not.toContain('| Protokollführung |');
	});
});

/*
 * **Die Fusszeile der Ausgaben** (05.09.2026). Derselbe Satz steht im PDF, im
 * Word-Dokument und in jeder weiteren Ausgabe; er wird deshalb an einer Stelle
 * gebaut.
 */
describe('Der Vermerk auf jedem Blatt', () => {
	it('nennt Gemeinschaft, Versammlung und Stand', () => {
		expect(
			protokollfusszeile({
				gemeinschaft: 'Rosenweg 4',
				datum: '2026-08-04',
				stand: '4. Aug. 2026, 10:15'
			})
		).toBe('Rosenweg 4 · Versammlung vom 4. August 2026 · Stand 4. Aug. 2026, 10:15');
	});

	/*
	 * **Der Gemeinschaftsname kann fehlen** (aus dem Code-Review): Er kommt aus
	 * einer Abfrage, die nichts finden kann, und die Route reicht dann eine leere
	 * Zeichenkette weiter. Ohne diese Regel begänne jedes Blatt mit einem
	 * Mittelpunkt, der nach einem verlorenen Wort aussieht.
	 */
	it('lässt eine fehlende Angabe weg, statt ein leeres Feld zu setzen', () => {
		const zeile = protokollfusszeile({
			gemeinschaft: '',
			datum: '2026-08-04',
			stand: '4. Aug. 2026, 10:15'
		});
		expect(zeile.startsWith('·'), zeile).toBe(false);
		expect(zeile).toBe('Versammlung vom 4. August 2026 · Stand 4. Aug. 2026, 10:15');
	});

	it('lässt auch einen fehlenden Stand weg', () => {
		expect(
			protokollfusszeile({ gemeinschaft: 'Rosenweg 4', datum: '2026-08-04', stand: '' })
		).toBe('Rosenweg 4 · Versammlung vom 4. August 2026');
	});

	/*
	 * Beim Abend verdrängt der Entwurfsvermerk den Stand, statt neben ihm zu
	 * stehen: Wer nur die dritte Seite in der Hand hält, muss sehen, dass das
	 * Dokument noch nicht vollständig ist.
	 */
	it('setzt beim Abend den Entwurfsvermerk an die Stelle des Standes', () => {
		const zeile = abendfusszeile({
			bezeichnung: 'Drei Häuser',
			datum: '2026-08-04',
			stand: '4. Aug. 2026, 10:15',
			luecke: 'zwei Versammlungen ohne Protokoll'
		});
		expect(zeile).toContain('ENTWURF — zwei Versammlungen ohne Protokoll');
		expect(zeile, 'kein Stand daneben').not.toContain('Stand');
	});

	it('nennt beim vollständigen Abend den Stand', () => {
		expect(
			abendfusszeile({
				bezeichnung: 'Drei Häuser',
				datum: '2026-08-04',
				stand: '4. Aug. 2026, 10:15',
				luecke: null
			})
		).toBe('Drei Häuser · Abend vom 4. August 2026 · Stand 4. Aug. 2026, 10:15');
	});
});

describe('Das Worddokument', () => {
	const stempel = dosZeitstempel('2026-08-04 10:15:00');
	// Der Vermerk, der auf jedem Blatt steht. Ein Pflichtparameter seit dem
	// 05.09.2026 — siehe `alsWorddokument`.
	const FUSS = 'Rosenweg 4 · Versammlung vom 4. August 2026 · Stand 4. Aug. 2026, 10:15';

	it('ist ein ZIP mit den Teilen, die Word verlangt', () => {
		const bytes = alsWorddokument('# Protokoll\n\nEin Absatz.', stempel, FUSS);
		const text = new TextDecoder('latin1').decode(bytes);
		expect(bytes[0]).toBe(0x50); // «PK»
		expect(bytes[1]).toBe(0x4b);
		for (const teil of [
			'[Content_Types].xml',
			'_rels/.rels',
			'word/_rels/document.xml.rels',
			'word/styles.xml',
			'word/document.xml'
		]) {
			expect(text).toContain(teil);
		}
	});

	/**
	 * **Eine leere Zeile wird kein leerer Absatz** (Auftraggeber, 03.09.2026: «Jetzt hat
	 * es viele Lücken und sieht optisch nicht ansprechend aus»).
	 *
	 * Im Entwurfstext trennt die Leerzeile zwei Absätze — Markdown-Schreibweise,
	 * kein Inhalt. Word trennt selbst: `w:after="120"` in der Vorlage «Standard».
	 * Der zusätzliche leere Absatz brachte je Lücke rund 26 Punkt zusammen, bei
	 * vier Angaben je Traktandum also 27 Millimeter Luft.
	 */
	it('macht aus einer Leerzeile keinen leeren Absatz', () => {
		const mit = alsWorddokument('Erster Absatz.\n\nZweiter Absatz.', stempel, FUSS);
		const ohne = alsWorddokument('Erster Absatz.\nZweiter Absatz.', stempel, FUSS);
		expect(
			Buffer.from(mit).equals(Buffer.from(ohne)),
			'die Leerzeile schlägt sich noch im Dokument nieder'
		).toBe(true);
	});

	/*
	 * **Aber wo eine Liste endet, bleibt sie** (aus dem Code-Review). Ein
	 * Listenabsatz trägt nur 2 Punkt Abstand (`w:after="40"`); ohne die Leerzeile
	 * klebte «Nicht erschienen (1):» am letzten Namen der Gruppe darüber und las
	 * sich als deren Fortsetzung.
	 */
	it('behält die Leerzeile, wo eine Liste endet oder beginnt', () => {
		const mit = alsWorddokument('- Aebi\n\nNicht erschienen (1):', stempel, FUSS);
		const ohne = alsWorddokument('- Aebi\nNicht erschienen (1):', stempel, FUSS);
		expect(
			Buffer.from(mit).equals(Buffer.from(ohne)),
			'nach einer Liste fehlt die Trennung, die es nur dort gibt'
		).toBe(false);
	});

	/**
	 * **Der Kopf wird eine Word-Tabelle, keine Absätze** (Auftraggeber, 03.09.2026).
	 *
	 * Geprüft wird am erzeugten XML: `<w:tbl>` genau einmal für den ganzen
	 * Kopfblock. Einzeln gesetzt wären es so viele Tabellen wie Zeilen, jede mit
	 * eigenem Rahmen — Word zeichnet dann doppelte Linien zwischen den Feldern.
	 */
	it('setzt zusammenhängende Tabellenzeilen als EINE Tabelle', () => {
		const bytes = alsWorddokument('| Ort | Bern |\n| Datum | heute |', stempel, FUSS);
		// `packe` speichert unverdichtet — das XML steht im Klartext in den Bytes.
		const xml = new TextDecoder('latin1').decode(bytes);
		expect(xml.match(/<w:tbl>/g) ?? [], 'eine Tabelle, nicht zwei').toHaveLength(1);
		expect(xml.match(/<w:tr>/g) ?? [], 'zwei Zeilen').toHaveLength(2);
		expect(xml).toContain('Bern');
		expect(xml).toContain('heute');
	});

	/*
	 * **Die Falscherkennung, gemessen** (aus dem Code-Review). Der erste Anlauf
	 * prüfte nur, dass überhaupt Bytes herauskommen, und nahm dafür eine Zeile,
	 * die nicht einmal mit `|` beginnt — er konnte im schlechten Zustand gar
	 * nicht rot werden.
	 */
	it('macht aus einem Satz mit senkrechtem Strich keine Tabelle', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('Er nannte A | B als Möglichkeit.', stempel, FUSS)
		);
		expect(xml, 'ein Strich mitten im Satz ist keine Tabelle').not.toContain('<w:tbl>');
	});

	it('braucht den Strich am Anfang UND am Ende', () => {
		const nurVorn = new TextDecoder('latin1').decode(alsWorddokument('| Ort Bern', stempel, FUSS));
		expect(nurVorn).not.toContain('<w:tbl>');
		const nurHinten = new TextDecoder('latin1').decode(alsWorddokument('Ort Bern |', stempel, FUSS));
		expect(nurHinten).not.toContain('<w:tbl>');
	});

	/*
	 * **Ein `|` im Wert zerreisst den Kopf nicht** (aus dem Code-Review). Ort,
	 * Gemeinschaft und Vorsitz sind Freitextfelder ohne Einschränkung.
	 * Geschnitten wird am ersten inneren Trenner, alles Weitere ist der Wert.
	 */
	it('lässt einen senkrechten Strich im Wert zu', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('| Ort | Saal A | B, Bern |', stempel, FUSS)
		);
		expect(xml).toContain('<w:tbl>');
		expect(xml, 'der ganze Wert steht in einer Zelle').toContain('Saal A | B, Bern');
	});

	/*
	 * **Zwei Tabellen brauchen den Absatz dazwischen** (aus dem Code-Review):
	 * Ohne ihn stehen zwei `<w:tbl>` unmittelbar nebeneinander, und Word
	 * verschmilzt sie zu einer — im PDF blieben es zwei Blöcke.
	 */
	/*
	 * **Die vier Befunde des Code-Reviews vom 03.09.2026**, jeder mit der Probe,
	 * die im schlechten Zustand rot wird. Alle vier hätte Word gezeigt und kein
	 * Test: Sie betreffen die Reihenfolge im XML, nicht den Inhalt.
	 */
	it('setzt die Tabelleneigenschaften in der Reihenfolge, die Word verlangt', () => {
		const xml = new TextDecoder('latin1').decode(alsWorddokument('| Ort | Bern |', stempel, FUSS));
		const stelle = (marke: string) => xml.indexOf(marke);
		expect(stelle('<w:tblW')).toBeGreaterThan(-1);
		expect(stelle('<w:tblW'), 'tblW vor tblBorders').toBeLessThan(stelle('<w:tblBorders>'));
		expect(stelle('<w:tblBorders>'), 'tblBorders vor tblLayout').toBeLessThan(
			stelle('<w:tblLayout')
		);
		expect(stelle('<w:tblLayout'), 'tblLayout vor tblCellMar').toBeLessThan(
			stelle('<w:tblCellMar>')
		);
	});

	it('setzt hinter die letzte Tabelle einen Absatz', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('| Ort | Bern |\n| Datum | heute |', stempel, FUSS)
		);
		expect(xml, 'ohne Absatz meldet Word beschädigten Inhalt').not.toContain('</w:tbl><w:sectPr>');
	});

	it('trennt zwei Tabellen auch über mehrere Leerzeilen hinweg', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('| a | 1 |\n\n\n| b | 2 |', stempel, FUSS)
		);
		expect(xml.match(/<w:tbl>/g) ?? [], 'zwei Tabellen').toHaveLength(2);
		expect(xml).not.toContain('</w:tbl><w:tbl>');
	});

	it('verwirft die Markdown-Trennzeile, statt Striche zu setzen', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('| Ort | Bern |\n| --- | --- |\n| Datum | heute |', stempel, FUSS)
		);
		expect(xml.match(/<w:tbl>/g) ?? [], 'eine Tabelle, nicht zwei').toHaveLength(1);
		expect(xml, 'keine Zeile mit Strichen').not.toContain('>---<');
		expect(xml.match(/<w:tr>/g) ?? [], 'zwei Zeilen, nicht drei').toHaveLength(2);
	});

	/*
	 * **Der Lückenbefund selbst** (Auftraggeber, 28.08.2026: «hat viele Lücken»).
	 * Gemessen an der Sichtprobe durch LibreOffice: Zwischen der Überschrift
	 * «Traktanden» und ihrer Liste stand ein leerer Absatz zusätzlich zum
	 * eigenen Abstand der Überschrift, und nach der Liste noch einmal einer.
	 * Die Regel «um eine Liste herum bleibt die Leerzeile» ist richtig, aber die
	 * Überschrift ist der stärkere Nachbar.
	 */
	it('setzt um eine Überschrift herum keinen leeren Absatz', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('## Traktanden\n\n- 1 Begrüssung\n- 2 Rechnung\n\n## 1 Begrüssung', stempel, FUSS)
		);
		// Ein leerer Absatz ist `<w:p></w:p>` — die erste Fassung dieser Probe
		// suchte ein leeres `w:t` und blieb deshalb im schlechten Zustand grün.
		const leere = xml.match(/<w:p><\/w:p>/g) ?? [];
		expect(leere, 'die Überschrift bringt ihren Abstand mit').toHaveLength(0);
	});

	it('trennt zwei Tabellenblöcke mit einem Absatz', () => {
		const xml = new TextDecoder('latin1').decode(
			alsWorddokument('| a | 1 |\n\n| b | 2 |', stempel, FUSS)
		);
		expect(xml.match(/<w:tbl>/g) ?? [], 'zwei Tabellen').toHaveLength(2);
		expect(xml, 'ohne Absatz dazwischen verschmilzt Word sie').not.toContain('</w:tbl><w:tbl>');
	});

	it('behält die Leerzeile im Entwurfstext selbst', () => {
		// Nur die Word-Ausgabe lässt sie weg: Im Textfeld und im Markdown gehört
		// sie hin, sonst stünden dort alle Absätze aneinander.
		expect(protokollentwurf(eingabe())).toContain('\n\n');
	});

	it('setzt Überschriften auf die passende Vorlage', () => {
		const text = new TextDecoder('latin1').decode(
			alsWorddokument('# Eins\n## Zwei\n### Drei', stempel, FUSS)
		);
		expect(text).toContain('w:val="berschrift1"');
		expect(text).toContain('w:val="berschrift2"');
		expect(text).toContain('w:val="berschrift3"');
	});

	it('macht aus «- » einen Listenabsatz mit sichtbarem Zeichen', () => {
		const text = new TextDecoder('utf-8').decode(alsWorddokument('- Erster Punkt', stempel, FUSS));
		expect(text).toContain('w:val="Listenabsatz"');
		expect(text).toContain('– Erster Punkt');
	});

	it('schützt XML vor dem Inhalt', () => {
		// Ein Antragswortlaut mit «&» oder «<» darf das Dokument nicht zerreissen.
		const text = new TextDecoder('utf-8').decode(
			alsWorddokument('Kosten & Nutzen <intern>', stempel, FUSS)
		);
		expect(text).toContain('Kosten &amp; Nutzen &lt;intern&gt;');
	});

	it('ergibt bei gleichem Text und gleichem Stempel dieselben Bytes', () => {
		const a = alsWorddokument('# Gleich', stempel, FUSS);
		const b = alsWorddokument('# Gleich', stempel, FUSS);
		expect(Array.from(a)).toEqual(Array.from(b));
	});

	/*
	 * **Die Fusszeile** (05.09.2026). Sie trägt den Vermerk, aus welcher Fassung
	 * ein Blatt stammt, und stand bis dahin allein im PDF. Ein ausgedrucktes
	 * Word-Protokoll liess sich ab Seite zwei keiner Fassung mehr zuordnen.
	 *
	 * Geprüft wird nicht nur, **dass** sie da ist, sondern die drei Stellen, an
	 * denen sie still verschwinden kann: der fehlende Eintrag in den
	 * Inhaltstypen, der fehlende Verweis in den Beziehungen, und die vertauschte
	 * Reihenfolge in `sectPr`. Jede davon ergibt eine Datei, die Word öffnet —
	 * ohne Fusszeile, oder mit einer stillen Reparatur.
	 */
	describe('Die Fusszeile', () => {
		const xmlVon = (text: string, fuss = FUSS) =>
			new TextDecoder('utf-8').decode(alsWorddokument(text, stempel, fuss));

		/*
		 * **Geprüft wird der Fusszeilenteil, nicht das ganze Archiv** (aus dem
		 * Code-Review, 05.09.2026). Der erste Anlauf suchte den Vermerk im
		 * gesamten Byte-Feld — und traf damit auch den Dokumenttext. Der
		 * Ausschnitt zwischen den `w:ftr`-Marken ist die Fusszeile und sonst
		 * nichts.
		 */
		const fussVon = (alles: string) =>
			alles.slice(alles.indexOf('<w:ftr'), alles.indexOf('</w:ftr>'));

		/*
		 * **Der Nachweis hängt am Inhalt, nicht am Namen** (aus dem Code-Review):
		 * «word/footer1.xml» steht auch im Inhaltstyp-Verzeichnis, und ein
		 * Archiv ohne den Teil hätte den Namen trotzdem getragen. `<w:ftr` gibt
		 * es nur in der Datei selbst.
		 */
		it('liegt als eigener Teil im Archiv und ist überall angemeldet', () => {
			const alles = xmlVon('Ein Absatz.');
			expect(alles, 'der Teil selbst, an seinem Inhalt erkannt').toContain('<w:ftr');
			expect(alles, 'sein Inhaltstyp').toContain(
				'wordprocessingml.footer+xml'
			);
			expect(alles, 'die Beziehung vom Dokument aus').toContain(
				'relationships/footer'
			);
		});

		it('trägt den Vermerk und die Seitenzahl als Feld', () => {
			const alles = xmlVon('Ein Absatz.');
			expect(alles).toContain(FUSS);
			expect(alles, 'die Seitenzahl kennt erst die Textverarbeitung').toContain(
				'<w:fldSimple w:instr=" PAGE ">'
			);
			expect(alles).toContain('<w:fldSimple w:instr=" NUMPAGES ">');
		});

		/*
		 * `CT_SectPr` ist eine Sequenz: Der Verweis auf die Fusszeile bildet die
		 * erste Gruppe, vor `pgSz`. Dieselbe Falle wie bei `tblPr` — wer sie
		 * vertauscht, bekommt «unlesbarer Inhalt» oder eine stille Reparatur, die
		 * den Verweis verwirft. Dass die Fusszeile dann fehlt, sähe man erst am
		 * Ausdruck.
		 */
		it('steht in sectPr vor der Seitengrösse', () => {
			const alles = xmlVon('Ein Absatz.');
			expect(alles).toContain('<w:sectPr><w:footerReference w:type="default"');
			expect(
				alles.indexOf('<w:footerReference'),
				'der Verweis steht vor <w:pgSz>'
			).toBeLessThan(alles.indexOf('<w:pgSz'));
		});

		/*
		 * Der Rand zum Blattende muss kleiner sein als der untere Textrand, sonst
		 * setzt Word die Fusszeile in den Textkörper hinein.
		 */
		it('bekommt einen eigenen Rand innerhalb des unteren Seitenrandes', () => {
			const alles = xmlVon('Ein Absatz.');
			const rand = /<w:pgMar[^>]*w:bottom="(\d+)"[^>]*w:footer="(\d+)"/.exec(alles);
			expect(rand, 'pgMar nennt beide Ränder').not.toBeNull();
			expect(Number(rand?.[2])).toBeLessThan(Number(rand?.[1]));
		});

		/*
		 * **Der erste Anlauf war in beiden Zuständen grün** (aus dem
		 * Code-Review): Er suchte « · Seite » im XML, und diese Zeichenfolge
		 * entsteht nie — Vermerk und «Seite » stehen in getrennten Läufen. Der
		 * Mittelpunkt im Fusszeilenteil ist der Nachweis, der sich messen lässt.
		 */
		it('lässt bei leerem Vermerk das Trennzeichen weg', () => {
			const fuss = fussVon(xmlVon('Ein Absatz.', ''));
			expect(fuss, 'kein Mittelpunkt ohne einen Vermerk davor').not.toContain('·');
			expect(fuss, 'die Seitenzahl bleibt').toContain('Seite ');
		});

		it('setzt bei gesetztem Vermerk das Trennzeichen', () => {
			const fuss = fussVon(xmlVon('Ein Absatz.', 'Rosenweg 4'));
			expect(fuss).toContain('Rosenweg 4 · ');
		});
	});
});

describe('Wenn ein Gegenantrag angenommen wurde', () => {
	/*
	 * Gefragt am 21.08.2026: «Wenn der Folgeantrag angenommen wird und nicht über
	 * den Hauptantrag abgestimmt wurde, was geschieht dann? Nicht eingetreten?»
	 *
	 * Weder noch. «Nicht eingetreten» hiesse, die Versammlung habe die Sache gar
	 * nicht beraten; sie hat beraten und entschieden — in der Fassung des
	 * Gegenantrags. Das Protokoll muss den Zusammenhang nennen, sonst steht dort
	 * ein Antrag ohne Ergebnis und ohne Grund.
	 */
	function zeile(teil: Record<string, unknown>) {
		return {
			nummer: '6',
			tiefe: 1,
			titel: 'Neue Veloständer',
			art: 'abstimmung',
			antragswortlaut: 'Vor dem Haus werden zwei Veloständer aufgestellt.',
			kurzfassung: null,
			notiz: null,
			antragsteller: null,
			folgeantraegeAngenommen: null,
			erfordernis: 'Gewöhnliche Verwaltungshandlung',
			rechtsgrundlage: 'ZGB 647a',
			rueckzug: null,
			beschlusstext: null,
			pendenzen: [],
			satz: null,
			zahlen: null,
			quotenErhoben: true,
			handzaehlung: null,
			ohneZustimmung: [],
			durchgang: null,
			frueherenDurchgaenge: 0,
			frueherenDurchRueckkommen: 0,
			rueckkommenErfolglos: false,
			stichentscheid: null,
			stellvertretend: [],
			spontan: false,
			vorgezogen: false,
			...teil
		};
	}

	it('nennt den Grund, statt den Antrag ergebnislos stehen zu lassen', () => {
		const text = protokollentwurf(
			eingabe({
				zeilen: [
					zeile({
						folgeantraegeAngenommen: [
							{
								nummer: '6.1',
								titel: 'Nur ein Veloständer'
							}
						]
					})
				]
			})
		);
		// Entscheid 0045, Punkt 9: «Folgeantrag», nicht «Gegenantrag».
		expect(text).toMatch(/den Folgeantrag 6\.1 «Nur ein Veloständer» angenommen/);
		expect(text).toMatch(/gegenstandslos/);
		// **Nicht «nicht eingetreten»**: Das hiesse, es sei gar nicht beraten worden.
		expect(text).not.toMatch(/nicht eingetreten/i);
	});

	it('sagt ohne Gegenantrag weiterhin nur, dass nicht abgestimmt wurde', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile({})] }));
		expect(text).toMatch(/Über diesen Antrag wurde nicht abgestimmt\./);
		expect(text).not.toMatch(/gegenstandslos/);
	});

	it('stellt den Antragsteller vor den Antragstext', () => {
		const text = protokollentwurf(
			eingabe({
				zeilen: [zeile({ antragsteller: 'Aebi, Bucher & Christen' })]
			})
		);
		expect(text).toMatch(/Antrag von Aebi, Bucher & Christen:/);
		// Der Text selbst bleibt frei von Namen — das ist der Zweck der Trennung.
		expect(text).toMatch(/Antrag: Vor dem Haus werden zwei Veloständer/);
	});
});

/**
 * **Die Pendenz im Protokoll** (Migration 106).
 *
 * Der Anlass steht in `docs/echte-protokolle-2026-09-08.md`: «Die Verwaltung
 * wird diesen Punkt noch mit dem Bauleiter klären» ist der Satz, wegen dem ein
 * Protokoll im Folgejahr gelesen wird.
 */
describe('Pendenzen', () => {
	function zeile(teil: Record<string, unknown>) {
		return {
			nummer: '7',
			tiefe: 0,
			titel: 'Rampe beim Hauseingang',
			art: 'abstimmung',
			antragswortlaut: 'Die Rampe wird gemäss Offerte erstellt.',
			kurzfassung: null,
			notiz: null,
			antragsteller: null,
			folgeantraegeAngenommen: null,
			erfordernis: null,
			rechtsgrundlage: null,
			rueckzug: null,
			beschlusstext: null,
			pendenzen: [],
			satz: null,
			zahlen: null,
			quotenErhoben: true,
			handzaehlung: null,
			ohneZustimmung: [],
			durchgang: null,
			frueherenDurchgaenge: 0,
			frueherenDurchRueckkommen: 0,
			rueckkommenErfolglos: false,
			stichentscheid: null,
			stellvertretend: [],
			spontan: false,
			vorgezogen: false,
			...teil
		};
	}

	const rampe = {
		text: 'Offerten für die Rampe einholen',
		verantwortlich: 'die Bewirtschaftung',
		fristArt: 'naechste_versammlung' as const,
		fristDatum: null
	};

	it('nennt sie mit Zuständigem und Frist', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile({ pendenzen: [rampe] })] }));
		expect(text).toMatch(/^Pendenz:$/m);
		expect(text).toMatch(
			/- die Bewirtschaftung: Offerten für die Rampe einholen \(bis zur nächsten Versammlung\)/
		);
	});

	/*
	 * **Der Fall, den eine naheliegende Fassung verfehlt.** Wer die Pendenzen in
	 * den Zweig «es gibt ein Ergebnis» hängt, verliert genau den häufigsten:
	 * ein Traktandum ausdrücklich «(Informativ)», daraus eine Zusage mit
	 * Jahreszahl. So steht er in Protokollen wörtlich.
	 */
	it('nennt sie auch ohne Abstimmung', () => {
		const text = protokollentwurf(
			eingabe({
				zeilen: [
					zeile({
						art: 'kenntnisnahme',
						antragswortlaut: null,
						pendenzen: [
							{
								text: 'Antrag auf Torersatz für die Versammlung 2027 vorbereiten',
								verantwortlich: 'die Revisionsstelle',
								fristArt: 'datum',
								fristDatum: '2027-03-31'
							}
						]
					})
				]
			})
		);
		expect(text).toMatch(/die Revisionsstelle: Antrag auf Torersatz .* \(bis 31\.03\.2027\)/);
	});

	it('schreibt die Mehrzahl, wo mehrere stehen', () => {
		const text = protokollentwurf(
			eingabe({
				zeilen: [
					zeile({
						pendenzen: [rampe, { ...rampe, text: 'Termin mit dem Bauleiter abmachen' }]
					})
				]
			})
		);
		expect(text).toMatch(/^Pendenzen:$/m);
	});

	/**
	 * **Der Zustand steht bewusst NICHT im Protokoll**, und diese Probe hält das
	 * fest. Das Protokoll hält fest, was an dieser Versammlung vereinbart wurde;
	 * vereinbart wurde eine offene Pendenz. Stünde der Zustand darin, sagten zwei
	 * festgehaltene Fassungen desselben Protokolls Verschiedenes, ohne dass sich
	 * an der Versammlung etwas geändert hätte — und `minutes_version` friert den
	 * gerenderten Text ein (Migration 037).
	 *
	 * Die Probe ist deshalb eine Zusicherung gegen einen naheliegenden Zusatz,
	 * nicht gegen einen Fehler.
	 */
	it('sagt nichts darüber, wie es heute um sie steht', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile({ pendenzen: [rampe] })] }));
		expect(text).not.toMatch(/erledigt|hinfällig|offen seit/i);
	});

	it('schweigt, wo keine erfasst wurde', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile({})] }));
		expect(text).not.toMatch(/Pendenz/);
	});
});

describe('Vorgezogen behandelt', () => {
	/**
	 * Seit die Nummer bei der Freigabe festgeschrieben wird (Migration 072), darf
	 * die Versammlung umstellen, ohne dass die Nummern wandern. Im Protokoll
	 * steht dann eine Folge wie «7, 9, 8» — ohne Vermerk sähe das nach einem
	 * Fehler aus statt nach einem Ordnungsentscheid.
	 */
	function zeile(vorgezogen: boolean) {
		return {
			nummer: '9',
			tiefe: 1,
			titel: 'Rampe beim Hintereingang',
			art: 'kenntnisnahme',
			antragswortlaut: null,
			kurzfassung: null,
			notiz: null,
			antragsteller: null,
			folgeantraegeAngenommen: null,
			erfordernis: null,
			rechtsgrundlage: null,
			rueckzug: null,
			beschlusstext: null,
			pendenzen: [],
			satz: null,
			zahlen: null,
			quotenErhoben: true,
			handzaehlung: null,
			ohneZustimmung: [],
			durchgang: null,
			frueherenDurchgaenge: 0,
			frueherenDurchRueckkommen: 0,
			rueckkommenErfolglos: false,
			stichentscheid: null,
			stellvertretend: [],
			spontan: false,
			vorgezogen
		};
	}

	it('nennt die Abweichung von der Traktandenliste', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile(true)] }));
		expect(text).toMatch(/Vorgezogen behandelt; die Versammlung hat die Reihenfolge geändert\./);
	});

	it('schweigt, wenn die Reihenfolge der Liste entspricht', () => {
		const text = protokollentwurf(eingabe({ zeilen: [zeile(false)] }));
		expect(text).not.toMatch(/Vorgezogen/);
	});
});

/**
 * Der Siegelabschnitt am Schluss (22.08.2026).
 *
 * «Also die Signatur ins Folgeprotokoll zu nehmen. Bau das so.» Der Aufdruck
 * trägt nur unter drei Bedingungen, die die Rechtsprüfung vom selben Tag nennt:
 * Der Prüfweg muss dabeistehen, die Reichweite ehrlich benannt sein, und es
 * darf nichts versprochen werden, was es nicht gibt.
 */
describe('Der Siegelabschnitt im Protokoll', () => {
	const SIEGEL = {
		abdruck: '7f3a91c42b8e0d55aa1122334455667788990011223344556677889900aabbcc',
		bezeugtAm: '22. August 2026 um 21:14 Uhr',
		stelle: 'freetsa.org',
		bezeugungAbdruck: 'a04e77b1c9d3f210ffeeddccbbaa99887766554433221100ffeeddccbbaa9988'
	};

	it('nennt Abdruck, Zeitpunkt, Stelle und die Prüfsumme der Bezeugung', () => {
		const text = protokollentwurf(eingabe({ siegel: SIEGEL }));
		expect(text).toContain(SIEGEL.abdruck);
		expect(text).toContain('freetsa.org');
		expect(text).toContain('22. August 2026 um 21:14 Uhr');
		expect(text).toContain(SIEGEL.bezeugungAbdruck);
	});

	it('sagt, wie geprüft wird', () => {
		// Eine Zeichenkette ohne Anleitung ist Dekoration.
		const text = protokollentwurf(eingabe({ siegel: SIEGEL }));
		expect(text).toMatch(/manifest\.json/);
		expect(text).toMatch(/SHA-256/);
	});

	it('sagt ausdrücklich, dass der Protokolltext nicht gedeckt ist', () => {
		/*
		 * Die Bedingung, unter der der Aufdruck überhaupt trägt: Stünde der Wert
		 * unbeschriftet unter dem Text, entstünde der Eindruck, das Siegel decke
		 * ihn — und der fiele im Streitfall auf den Verwender zurück.
		 */
		const text = protokollentwurf(eingabe({ siegel: SIEGEL }));
		expect(text).toMatch(/nicht Teil des Siegels/);
	});

	it('trägt kein Markup im Text — weder docx noch PDF kennen Fettdruck', () => {
		/*
		 * **Gemessen am 04.09.2026 im Prüfdurchgang.** Hier stand `**Dieser
		 * Protokolltext …**`, und die Sterne standen wörtlich im Word-Dokument und
		 * im PDF: `docx.ts` kennt bewusst keinen Fettdruck («Kein Fettdruck, keine
		 * Bilder»), der PDF-Satz ebenso wenig.
		 *
		 * Die Probe greift den ganzen Entwurf, nicht nur den einen Satz: Der
		 * nächste, der Markup schreibt, tut es an einer anderen Stelle. Die
		 * Überschriften mit `##` sind ausgenommen — die kennt der Erzeuger.
		 */
		const text = protokollentwurf(eingabe({ siegel: SIEGEL }));
		const ohneUeberschriften = text
			.split('\n')
			.filter((z) => !z.startsWith('#'))
			.join('\n');

		/*
		 * **Auch die einfache Betonung** (aus dem Code-Review): `*kursiv*` hat nur
		 * ein Sternchen, und bei `_kursiv_.` folgt dem schliessenden Zeichen ein
		 * Punkt statt eines Leerzeichens. Beide Schreibweisen sind häufiger als
		 * die doppelte, und beide standen sonst wörtlich im Word-Dokument.
		 *
		 * Die Zeichen müssen Text umschliessen: Ein einzelnes `*` als Aufzählung
		 * oder ein `_` in einer Kennung soll nicht melden.
		 */
		expect(ohneUeberschriften).not.toMatch(/\*[^\s*][^*]*\*/);
		expect(ohneUeberschriften).not.toMatch(/(^|\s)_[^\s_][^_]*_/m);
	});

	it('verspricht nichts, was es nicht gibt', () => {
		// Es gibt keine Beweisregel, nur freie Beweiswürdigung (ZPO Art. 157).
		const text = protokollentwurf(eingabe({ siegel: SIEGEL }));
		expect(text).not.toMatch(/gerichtsfest|rechtssicher|beweiskräftig|unveränderbar/i);
	});

	it('nennt die fehlende Bezeugung, statt sie zu verschweigen', () => {
		const text = protokollentwurf(
			eingabe({
				siegel: { abdruck: SIEGEL.abdruck, bezeugtAm: null, stelle: null }
			})
		);
		expect(text).toContain(SIEGEL.abdruck);
		expect(text).toMatch(/Zeitstempel liegt zu diesem Siegel nicht vor/);
	});

	it('lässt den Abschnitt weg, wenn nicht versiegelt ist', () => {
		// Ein leeres Feld wäre schlechter als keines.
		const text = protokollentwurf(eingabe({}));
		expect(text).not.toMatch(/Abschlusspaket dieser Versammlung/);
	});
});

// ── Was ausser dem Abstimmen geschah ────────────────────────────────────────
//
// **Vier Vorgänge fehlten vollständig** (Prüflauf 22.08.2026, Befund D-02):
// Ausstand, Rückzug, dessen Rücknahme und die Unterbrechung. Die Anwendung
// kennt alle vier und führt sie im Verlauf — nur das Protokoll schwieg. Bei
// Traktandum 7 stand «(von 4)» statt «(von 5)», ohne ein Wort dazu.

describe('Vorgänge neben der Abstimmung', () => {
	function mitVorgaengen(vorgaenge: Protokollzeile['vorgaenge']) {
		const grund = eingabe();
		return protokollentwurf({
			...grund,
			zeilen: [{ ...grund.zeilen[0], vorgaenge }]
		});
	}

	it('nennt den Ausstand eines Vertreters ohne Eigentum als solchen (Ä-26)', () => {
		const t = mitVorgaengen([
			{
				art: 'agenda.item.recusal.declared',
				wer: 'Sitzungsleitung',
				angaben: { partei: 'Prüfverwaltung AG', vertreter: true, grund: 'Eigene Entschädigung' },
				zeitpunkt: '2026-03-12T19:40:00.000Z'
			}
		]);
		expect(t).toContain(
			'Prüfverwaltung AG, nicht Eigentümer, ist bei diesem Traktandum als Vertreter in den Ausstand ' +
				'getreten; Vollmachten dieses Vertreters ruhten hier, soweit es welche gab. Grund: Eigene Entschädigung'
		);
		expect(t).not.toContain('hat dazu keine Stimme abgegeben');
	});

	it('erklärt einen Ausstand samt Grund — er verschiebt die Bezugsgrösse', () => {
		const t = mitVorgaengen([
			{
				art: 'agenda.item.recusal.declared',
				wer: 'Sitzungsleitung',
				angaben: {
					partei: 'Immo Nirgendheim AG',
					grund: 'Mit dem Fassadenbauer verschwägert.'
				},
				zeitpunkt: '2026-03-12T19:40:00.000Z'
			}
		]);
		// Ohne Anführungszeichen: Der Absatz über die Rücknahme schreibt denselben
		// Namen blank, und zwei Schreibweisen untereinander sehen in der Urkunde
		// nach einem Fehler aus.
		expect(t).toContain('Immo Nirgendheim AG ist bei diesem Traktandum in den Ausstand getreten');
		expect(t).not.toContain('«Immo Nirgendheim AG»');
		// **Nicht mehr «weder Köpfe noch Wertquoten»** (Ä-25, 24.09.2026): Der Satz
		// war zu unbedingt und stand an vier Stellen. Das Protokoll ist die
		// bleibende davon, und es wird im Streitfall gelesen.
		expect(t).not.toContain('weder bei den Kopfstimmen noch bei den Wertquoten');
		// Die Urkunde stellt fest (H3, Fachprüfung 08.10.2026): Vergangenheit,
		// und ohne den Überleitungssatz der Anzeige.
		expect(t).toContain('hat dazu keine Stimme abgegeben');
		expect(t).not.toContain('hängt vom Erfordernis des Traktandums ab');
		// Der Grund ist die eigentliche Auskunft: Ohne ihn steht da eine
		// Behauptung, mit ihm ein nachvollziehbarer Entscheid.
		expect(t).toContain('Mit dem Fassadenbauer verschwägert.');
		expect(t).toContain('Art. 68 i.V.m. Art. 712m Abs. 2 ZGB');
	});

	it('nennt die Wirkung des Ausstands unmittelbar unter den Zahlen', () => {
		/*
		 * Der Befund D-02 im Wortlaut: «von 5 auf 4, ohne ein Wort der
		 * Erklärung». Die Erklärung gehört unter die Zahl, die sie erklärt, nicht
		 * zum Vorgang weiter oben: Dort ist der massgebende Durchgang nicht
		 * bekannt.
		 */
		const grund = eingabe();
		const satz = 'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen.';
		const t = protokollentwurf({
			...grund,
			zeilen: [{ ...grund.zeilen[0], ausstandswirkung: satz }]
		});
		const zeilen = t.split('\n');
		const wertquoten = zeilen.findIndex((z) => z.startsWith('- Wertquoten:'));
		expect(wertquoten).toBeGreaterThan(-1);
		expect(zeilen[wertquoten + 1]).toBe(`- ${satz}`);
	});

	it('bleibt direkt unter den Zahlen, auch wenn Betroffene fehlen', () => {
		// Gerade wenn ein Betroffener im Ausstand ist, steht die Zeile zu den
		// fehlenden Zustimmungen da; sie darf sich nicht zwischen Zahl und
		// Erklärung schieben (Code-Review 24.09.2026 zu `ausstandswirkung`, Befund 6).
		const grund = eingabe();
		const satz = 'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 4 statt 5 Kopfstimmen.';
		const t = protokollentwurf({
			...grund,
			zeilen: [{ ...grund.zeilen[0], ausstandswirkung: satz, ohneZustimmung: ['Beispiel AG'] }]
		});
		const zeilen = t.split('\n');
		const wertquoten = zeilen.findIndex((z) => z.startsWith('- Wertquoten:'));
		expect(zeilen[wertquoten + 1]).toBe(`- ${satz}`);
		expect(zeilen[wertquoten + 2]).toMatch(/^- Ohne die nach ZGB Art\. 712g Abs\. 4 nötige Zustimmung/);
	});

	it('druckt ohne Ausstand keine Zeile dazu', () => {
		const grund = eingabe();
		const t = protokollentwurf({
			...grund,
			zeilen: [{ ...grund.zeilen[0], ausstandswirkung: null }]
		});
		expect(t).not.toContain('Wegen des Ausstands');
		expect(t).not.toContain('ändert der Ausstand');
	});

	it('hält fest, dass ein Rückzug zurückgenommen wurde', () => {
		// Der gefährliche Fall: Danach sieht das Traktandum aus wie jedes andere,
		// und dass über einen einmal zurückgezogenen Antrag abgestimmt wurde,
		// stand nirgends.
		const t = mitVorgaengen([
			{
				art: 'agenda.item.withdrawal.revoked',
				wer: 'Sitzungsleitung',
				angaben: {},
				zeitpunkt: '2026-03-12T20:05:00.000Z'
			}
		]);
		expect(t).toContain('Der Antrag war zurückgezogen worden');
		expect(t).toContain('wurde darüber abgestimmt');
	});

	it('nennt den Rückzug in der Auswertung mit dem Satz des Protokolls (F2, H7 D (h))', () => {
		expect(rueckzugInDerAuswertung('Offerte fehlt', false)).toBe(
			'Der Antrag wurde vor der Abstimmung zurückgezogen: Offerte fehlt. Es wurde nicht abgestimmt.'
		);
		expect(rueckzugInDerAuswertung('Die Offerte wird überarbeitet.', true)).toBe(
			'Der Antrag wurde nach der konsultativen Abstimmung zurückgezogen: Die Offerte wird ' +
				'überarbeitet. Die Zahlen der konsultativen Abstimmung zeigen nur, wie die Anwesenden zum ' +
				'Antrag standen; ein Beschluss ist nicht gefasst worden.'
		);
		// Derselbe Anfang wie im Protokoll, damit beide nicht auseinanderlaufen.
		expect(rueckzugInDerAuswertung('x', true).startsWith(rueckzugssatz('x', true))).toBe(true);
	});

	it('wählt in der Auswertung den Rückzugssatz nur nach einer konsultativen Abstimmung (F2, Befund 3)', () => {
		const konsultativ = { keinBeschluss: { grund: 'konsultativ' } };
		expect(ergebnissatzDerAuswertung({ satz: 'Kein Beschluss: …', rueckzug: 'Offerte fehlt', auszaehlung: konsultativ })).toBe(
			rueckzugInDerAuswertung('Offerte fehlt', true)
		);
		// Ohne Rückzug, oder wo der massgebende Durchgang nicht konsultativ war: der Satz der Auszählung.
		expect(ergebnissatzDerAuswertung({ satz: 'Angenommen.', rueckzug: null, auszaehlung: konsultativ })).toBe(
			'Angenommen.'
		);
		expect(
			ergebnissatzDerAuswertung({ satz: 'Abgelehnt.', rueckzug: 'Offerte fehlt', auszaehlung: { keinBeschluss: null } })
		).toBe('Abgelehnt.');
	});

	it('sagt nach der Rücknahme eines Rückzugs nicht «abgestimmt», wenn danach keiner kam (F2, H7 D (d))', () => {
		const vorgang = (danachAbgestimmt: boolean) => ({
			art: 'agenda.item.withdrawal.revoked',
			wer: 'Sitzungsleitung',
			angaben: {},
			zeitpunkt: '2026-03-12T20:05:00.000Z',
			danachAbgestimmt
		});
		const ohne = mitVorgaengen([vorgang(false)]);
		expect(ohne).toContain('der Rückzug wurde zurückgenommen. Danach wurde über ihn nicht abgestimmt.');
		expect(ohne).not.toContain('wurde darüber abgestimmt');
		expect(mitVorgaengen([vorgang(true)])).toContain('und es wurde darüber abgestimmt');
	});

	it('führt die Unterbrechungen mit Uhrzeit in einem eigenen Abschnitt', () => {
		const grund = eingabe();
		const t = protokollentwurf({
			...grund,
			unterbrechungen: [
				{
					art: 'unterbrochen',
					zeitpunkt: '2026-03-12T19:30:00.000Z',
					text: 'Weiter um 21:45'
				},
				{
					art: 'fortgesetzt',
					zeitpunkt: '2026-03-12T19:45:00.000Z',
					text: null
				}
			]
		});
		expect(t).toContain('## Unterbrechungen');
		// **Vor der Unterschrift** (Nachprüfung 23.08.2026): Was unterschrieben
		// wird, muss über der Unterschrift stehen — sonst bezeugt sie es nicht.
		expect(t.indexOf('## Unterbrechungen')).toBeLessThan(t.indexOf('Die Sitzungsleitung:'));
		expect(t).toContain('wird unterbrochen');
		expect(t).toContain('Weiter um 21:45');
		expect(t).toContain('wird fortgesetzt');
		// Hiesige Zeit, nicht UTC: 19:30 UTC sind 20:30 in Zürich (Sommerzeit).
		expect(t).toMatch(/2[01]:[0-9]{2} Uhr — die Versammlung wird unterbrochen/);
	});

	it('schweigt, wo nichts geschah — kein leerer Abschnitt', () => {
		expect(protokollentwurf(eingabe())).not.toContain('## Unterbrechungen');
	});
});

/**
 * Die Mischform im Kopf des Protokolls (Migration 108).
 *
 * **Warum sie überhaupt dastehen muss.** In der Mischform überträgt die
 * Sitzungsleitung die Stimmen der Papierparteien ohne Grund je Traktandum, und
 * eine Stimme ohne Grund erscheint im Protokoll gar nicht
 * (`holeStellvertretendeStimmen` filtert auf `chair_reason IS NOT NULL`). Ohne
 * diesen Abschnitt stünde nirgends, dass ein Teil der Stimmen übertragen wurde.
 */
describe('Stimmabgabe in der Mischform', () => {
	it('nennt die Parteien auf Papier und den Grund für den fehlenden Grund', () => {
		const t = protokollentwurf(eingabe({ aufPapier: ['Aebi'] }));
		expect(t).toContain('## Stimmabgabe');
		expect(t).toContain('Auf Papier abgestimmt haben (1):');
		expect(t).toContain('- Aebi');
		expect(t).toContain('Sitzungsleitung übertragen');
	});

	it('steht vor der Zählweise — erst abstimmen, dann zählen', () => {
		const t = protokollentwurf(eingabe({ aufPapier: ['Aebi'] }));
		expect(t.indexOf('## Stimmabgabe')).toBeLessThan(t.indexOf('## Zählweise'));
	});

	it('steht über der Unterschrift', () => {
		// Was unterschrieben wird, muss über der Unterschrift stehen — sonst
		// bezeugt sie es nicht. Dieselbe Zusicherung wie bei den Unterbrechungen.
		const t = protokollentwurf(eingabe({ aufPapier: ['Aebi'] }));
		expect(t.indexOf('## Stimmabgabe')).toBeLessThan(t.indexOf('Die Sitzungsleitung:'));
	});

	it('schweigt ohne Papierpartei', () => {
		expect(protokollentwurf(eingabe())).not.toContain('## Stimmabgabe');
		expect(protokollentwurf(eingabe({ aufPapier: [] }))).not.toContain('## Stimmabgabe');
	});

	it('schweigt, wenn alle Parteien auf Papier stimmten', () => {
		/*
		 * Die Fixture führt drei Parteien. Stehen alle drei auf Papier, war es
		 * eine Handabstimmung und keine Mischform (Vorgabe des Auftraggebers, 09.09.2026).
		 */
		const t = protokollentwurf(eingabe({ aufPapier: ['Aebi', 'Christen', 'Dubois'] }));
		expect(t).not.toContain('## Stimmabgabe');
	});
});

/*
 * **Rückkommen, dann Neuabstimmung auf den Durchgang danach** (Migration 131).
 * Der überholte liegt nach dem geltenden; der Satz nennt sein Ergebnis und den
 * Durchgang, der gilt (Laien- und Fachprüfung 29.09.2026).
 */
describe('Neuabstimmung auf den Durchgang nach dem Rückkommen', () => {
	const mit = (zeile: Partial<Protokolleingabe['zeilen'][number]>) =>
		protokollentwurf(eingabe({ zeilen: [{ ...eingabe().zeilen[0], ...zeile }] })).replace(/\s+/g, ' ');

	/*
	 * **Seit H6 nur nach einem unentschiedenen Durchgang**: Ein verkündeter
	 * lässt sich nicht mehr überholen. Der Satz nennt den Grund, warum es beim
	 * früheren Beschluss bleibt, und schreibt ihn nicht mehr der Anordnung zu
	 * («gilt deshalb nicht», Fachprüfung 08.10.2026, Frage 65).
	 */
	it('nennt den Gleichstand des überholten und bleibt beim Beschluss des geltenden', () => {
		const t = mit({
			durchgang: 1,
			frueherenDurchgaenge: 1,
			neuabstimmungNachRueckkommen: {
				nummer: 2,
				begruendung: 'Stimmen einzeln erfassen.',
				ergebnis: null,
				unentschieden: true,
				geltenderDurchgang: 1,
				geltendAbgelehnt: false
			}
		});
		expect(t).toContain(
			'Auf dieses Traktandum wurde zurückgekommen und im 2. Durchgang erneut abgestimmt; es ' +
				'stand unentschieden, und der Stichentscheid wurde nicht festgestellt. Die ' +
				'Sitzungsleitung hat danach eine Neuabstimmung angesetzt (Begründung: Stimmen einzeln ' +
				'erfassen); zu ihr kam es nicht mehr. Es bleibt beim Beschluss aus dem 1. Durchgang, wie ' +
				'oben festgehalten.'
		);
		expect(t).not.toContain('gilt deshalb nicht');
		// Der überholte liegt nach dem geltenden: «früher» träfe nicht zu.
		expect(t).not.toMatch(/früherer? Durchgang wurde überholt/);
	});

	it('sagt bei einem abgelehnten Antrag, dass es bei der Ablehnung bleibt', () => {
		const t = mit({
			satz: 'Abgelehnt.',
			durchgang: 1,
			frueherenDurchgaenge: 1,
			neuabstimmungNachRueckkommen: {
				nummer: 2,
				begruendung: null,
				ergebnis: null,
				unentschieden: true,
				geltenderDurchgang: 1,
				geltendAbgelehnt: true
			}
		});
		expect(t).toContain('Es bleibt bei der Ablehnung aus dem 1. Durchgang, wie oben festgehalten.');
		expect(t).not.toContain('Es bleibt beim Beschluss');
	});

	it('nennt nach einem Beschluss von Hand nur die Nummer, sonst weiter den Verweis', () => {
		// Produktentscheid 01.10.2026: «Nummer ohne Verweis».
		const vonHand = mit({ durchgang: 2, frueherenDurchgaenge: 1, vonHand: true });
		// `mit` legt die Zeilen aneinander; nach dem Punkt folgt der nächste Abschnitt.
		expect(vonHand).toMatch(/- 2\. Durchgang\. ##/);
		expect(vonHand).not.toContain('siehe Verlauf');
		// Gegenprobe: Der gezählte Durchgang trägt den Verweis wie bisher.
		expect(mit({ durchgang: 2, frueherenDurchgaenge: 1 })).toContain(
			'- 2. Durchgang; weitere Durchgänge siehe Verlauf'
		);
	});

	it('steht auch neben dem Weggang, statt von ihm verdrängt zu werden', () => {
		const t = mit({
			durchgang: 2,
			frueherenDurchgaenge: 2,
			nachWeggang: [{ nummer: 1, namen: ['Dubois'], handzaehlung: false }],
			neuabstimmungNachRueckkommen: {
				nummer: 3,
				begruendung: 'Stimmen doppelt erfasst',
				ergebnis: 'angenommen',
				geltenderDurchgang: 2,
				geltendAbgelehnt: false
			}
		});
		expect(t).toContain('Der 1. Durchgang ergab keinen Beschluss: Dubois hatte');
		expect(t).toContain('Es bleibt beim Beschluss aus dem 2. Durchgang, wie oben festgehalten.');
		expect(t).not.toContain('weitere Durchgänge siehe Verlauf');
	});
});

/**
 * Codeprüfung Block 4a, N-4: Der frühere Durchgang ohne Beschluss nennt, wer nur
 * über eine Vollmacht der Leitung vertreten war, nicht als gegangen. Gegenprobe:
 * ein Stand ohne die Angabe liest sich wie bisher.
 */
describe('Früherer Durchgang: nur über die Leitung vertreten (N-4)', () => {
	const mit = (zeile: Partial<Protokolleingabe['zeilen'][number]>) =>
		protokollentwurf(eingabe({ zeilen: [{ ...eingabe().zeilen[0], ...zeile }] })).replace(/\s+/g, ' ');

	it('sagt «vertreten», nicht «verlassen»', () => {
		const t = mit({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			nachWeggang: [
				{
					nummer: 1,
					namen: ['Partei Beispiel'],
					handzaehlung: false,
					nurDurchLeitung: [
						{ name: 'Partei Beispiel', vertreter: 'Vera Beispiel', erfasstAm: '2027-06-01T17:40:00Z' }
					]
				}
			]
		});
		expect(t).toContain(
			'Der 1. Durchgang ergab keinen Beschluss: Partei Beispiel war bei der Abstimmung durch Vera ' +
				'Beispiel vertreten. Die Sitzungsleitung hat Vera Beispiel um 19:40 als Person erfasst, die ' +
				'für die Sitzungsleitung oder die Verwaltung handelt. Vollmachten an solche Personen ' +
				'zählten nicht dafür, dass über dieses nicht angekündigte Geschäft beschlossen werden ' +
				'konnte. Nachdem alle so da oder ' +
				'vertreten waren, wie es dafür zählt, wurde die Abstimmung neu eröffnet.'
		);
		expect(t).not.toMatch(/Partei Beispiel hatte die Versammlung/);
	});

	it('nennt im Mischfall beide und verlangt nicht nur «wieder alle da»', () => {
		const t = mit({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			nachWeggang: [
				{
					nummer: 1,
					namen: ['Partei Ahorn', 'Partei Beispiel'],
					handzaehlung: false,
					nurDurchLeitung: [{ name: 'Partei Beispiel', vertreter: 'Vera Beispiel' }]
				}
			]
		});
		expect(t).toContain('Partei Ahorn hatte die Versammlung vor dem Schluss der Abstimmung verlassen');
		expect(t).toContain('Partei Beispiel war bei der Abstimmung durch Vera Beispiel vertreten.');
		expect(t).toContain('Nachdem alle so da oder vertreten waren, wie es dafür zählt');
		expect(t).not.toContain('Nachdem wieder alle da waren');
	});

	it('behält «verlassen» ohne die Angabe (Gegenprobe)', () => {
		const t = mit({
			durchgang: 2,
			frueherenDurchgaenge: 1,
			nachWeggang: [{ nummer: 1, namen: ['Partei Beispiel'], handzaehlung: false }]
		});
		expect(t).toContain(
			'Der 1. Durchgang ergab keinen Beschluss: Partei Beispiel hatte die Versammlung vor dem ' +
				'Schluss der Abstimmung verlassen, ohne vorher abzustimmen. Nachdem wieder alle da waren'
		);
	});
});

describe('hinweisVorDemVersiegeln (Block 7c)', () => {
	it('schweigt, wo jede Abstimmung ein Ergebnis oder den Haken hat', () => {
		expect(hinweisVorDemVersiegeln([])).toBeNull();
	});

	it('nennt das eine Traktandum beim Namen, zuerst die Entwarnung, dann den Weg', () => {
		const satz = hinweisVorDemVersiegeln(['Fassadensanierung'])!;
		expect(satz).toMatch(/^Zu «Fassadensanierung» ist in Votum kein Ergebnis festgehalten\./);
		expect(satz).toContain('vor dem Versiegeln');
		expect(satz).toContain('bei «Voten»');
		expect(satz).toMatch(/«Es wurde nicht abgestimmt\.»\.$/);
		// Die Entwarnung steht vor der Handlung (Laienprüfung 02.10.2026).
		expect(satz.indexOf('ist nichts zu tun')).toBeLessThan(satz.indexOf('tragen Sie ihn'));
		// Der dritte Fall: von Hand abgestimmt, aber bewusst kein Beschluss.
		expect(satz).toContain('und halten Sie den Beschluss fest');
	});

	it('nennt bei vielen die Zahl, höchstens vier Titel und den gemischten Fall', () => {
		const satz = hinweisVorDemVersiegeln(['A', 'B', 'C', 'D', 'E', 'F'])!;
		expect(satz).toMatch(
			/^Zu 6 Abstimmungen ist in Votum kein Ergebnis festgehalten: «A», «B», «C», «D» und 2 weitere\./
		);
		expect(satz).toContain('über einzelne davon');
		expect(satz).toContain('Für die übrigen');
		// Wo nicht alle genannt sind, sagt der Satz, woran man sie erkennt.
		expect(satz).toContain('der Haken angeboten wird');
		expect(hinweisVorDemVersiegeln(['A', 'B', 'C', 'D', 'E'])).toContain('«D» und eine weitere.');
		// Genau vier: alle genannt, kein «weitere».
		expect(hinweisVorDemVersiegeln(['A', 'B', 'C', 'D'])).toContain('«A», «B», «C», «D». Wurde');
		const zwei = hinweisVorDemVersiegeln(['A', 'B'])!;
		expect(zwei).toMatch(/^Zu 2 Abstimmungen ist in Votum kein Ergebnis festgehalten: «A», «B»\. Wurde/);
		expect(zwei).not.toContain('der Haken angeboten wird');
	});

	it('hält jeden Satz unter der Grenze des Textwächters', () => {
		// Der Wächter liest Svelte und Meldungen, nicht diese Funktion.
		for (const titel of [['Fassadensanierung'], ['A', 'B', 'C', 'D', 'E', 'F']]) {
			for (const s of hinweisVorDemVersiegeln(titel)!.split(/(?<=\.) (?=[A-ZÄÖÜ])/)) {
				expect(s.length, s).toBeLessThanOrEqual(180);
			}
		}
	});
});

describe('ohneErgebnis: die Lage, in der der Beschlussvermerk stehen darf (Block 7)', () => {
	/*
	 * Das Prädikat ist die Abschrift der Zweige vor dem letzten `else` von
	 * `protokollentwurf`. Die Datenbankprobe fährt nur den Fall «massgebender
	 * Durchgang»; hier steht jeder Zweig einmal (Codeprüfung zur Abnahme,
	 * 02.10.2026).
	 */
	const leer = {
		art: 'abstimmung',
		rueckzug: null,
		satz: null,
		zahlen: null,
		ersetzung: null,
		neuabstimmungOffen: null,
		folgeantraegeAngenommen: null
	};
	const ersetzung = { rolle: 'grundantrag' } as never;

	it('trifft zu, wo Votum nichts führt', () => {
		expect(ohneErgebnis(leer)).toBe(true);
	});

	it.each([
		['Kenntnisnahme', { art: 'kenntnisnahme' }],
		['Rückzug', { rueckzug: 'auf Wunsch der Antragstellerin' }],
		['Ergebnis', { satz: 'Angenommen.', zahlen: {} }],
		['Ersetzung', { ersetzung }],
		['angenommener Folgeantrag', { folgeantraegeAngenommen: [{ nummer: '4.1', titel: 'Gegenantrag' }] }],
		['angesetzte Neuabstimmung', { neuabstimmungOffen: { nummer: 1 } }],
		['Neuabstimmung am ersetzten Antrag', { ersetzung, neuabstimmungOffen: { nummer: 1 } }]
	])('trifft nicht zu bei: %s', (_name, lage) => {
		expect(ohneErgebnis({ ...leer, ...lage })).toBe(false);
	});
});

describe('Ä-17 B: neues Traktandum an der zweiten Versammlung im Protokoll', () => {
	it('nennt beim Beschluss, dass das Traktandum neu war', () => {
		const text = protokollentwurf(
			eingabe({ zeilen: [{ ...eingabe().zeilen[0], neuAnZweiterVersammlung: true }] })
		);
		expect(text).toContain(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		// Beim Beschluss, nach dem Satz zum Ergebnis.
		expect(text.indexOf(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL)).toBeGreaterThan(text.indexOf('Angenommen.'));
	});

	it('nennt es auch beim Beschlussvermerk ohne Ergebnis, und nur die Tatsache', () => {
		// Mit einer Wahl an der Zeile: Der Vermerk muss sie selbst übergehen.
		const zeile = {
			...eingabe().zeilen[0],
			satz: null,
			zahlen: null,
			beschlussvermerk: true,
			neuAnZweiterWahl: 'drittel' as const
		};
		const text = protokollentwurf(eingabe({ zeilen: [{ ...zeile, neuAnZweiterVersammlung: true }] }));
		expect(text).toContain(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		// Ohne Ergebnis gibt es keine Wahl, über die die Zeile berichten könnte.
		expect(text).not.toContain('Nach der Einstellung der Gemeinschaft');
		expect(text).not.toContain('Abgestimmt wurde mit der Beschlussfähigkeit der zweiten');
	});

	it('lässt bei Widerspruch und Weggang nur die Tatsache stehen', () => {
		/*
		 * Der Server setzt `neuAnZweiterWahl` bei `keinBeschluss` auf null
		 * (`server/protokoll.ts`); die Auszählung trägt dann einen Satz und Zahlen,
		 * aber keine Wahl. Die Zeile nennt nur, dass das Traktandum neu war.
		 */
		const basis = eingabe().zeilen[0];
		const zeile = {
			...basis,
			neuAnZweiterVersammlung: true,
			neuAnZweiterWahl: null,
			satz: 'Kein Beschluss: Erika Beispiel ist ohne Stimme gegangen.',
			zahlen: basis.zahlen
		};
		const text = protokollentwurf(eingabe({ zeilen: [zeile] }));
		expect(text).toContain(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
		expect(text).not.toContain('Nach der Einstellung der Gemeinschaft');
		expect(text).not.toContain('Abgestimmt wurde mit der Beschlussfähigkeit der zweiten');
	});

	it('schweigt bei übernommenen Traktanden', () => {
		expect(protokollentwurf(eingabe())).not.toContain(NEU_AN_ZWEITER_VERSAMMLUNG_PROTOKOLL);
	});
});

/*
 * **Ä-27: Das Protokoll rechnet wie die Auszählung** (`docs/entscheide/0010`).
 * Vier Parteien zu 250, D im Ausstand, A und B Ja, C Nein. Die Zahlen kommen
 * aus `zaehleAus`, wie im Betrieb über `protokollspiegel`; das Protokoll muss
 * dieselbe Basis und dieselbe Schwelle nennen und die offene Frage führen.
 */
describe('Ä-27: Ausstand im Protokoll', () => {
	const teil = (quotenbasis: 'alle_quoten' | 'anwesend_vertreten') => {
		const m: Snapshot = {
			meetingId: 'v-1',
			takenAt: '2026-10-18T17:00:00.000Z',
			headCountMode: 'per_owner',
			parkingCountsAsHead: true,
			headCountRuleSource: null,
			tieBreak: 'keiner',
			totalQuota: 1000,
			parties: ['A', 'B', 'C', 'D'].map((n, i) => ({
				partyId: `p${i + 1}`,
				displayName: n,
				representativeName: null,
				isCommunity: false,
				units: [{ unitId: `u${i + 1}`, label: n, kind: 'unit' as const, countsAsHead: true, quota: 250 }]
			}))
		};
		const stimme = (p: string, choice: 'yes' | 'no') => ({
			partyId: p,
			unitId: `u${p.slice(1)}`,
			choice,
			castAt: '2026-10-18T19:10:00.000Z',
			recordedByChair: false
		});
		const erfordernis: Erfordernis = {
			fassung: '2026-07-30',
			juristischGegengelesen: false,
			astId: 'a-bau',
			knotenId: 'k-baulich-nuetzlich',
			typ: 'qualifiziertes_mehr',
			titel: 'Qualifiziertes Mehr',
			rechtsgrundlage: 'ZGB Art. 647d Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			zustimmungBetroffenerNoetig: false,
			pfad: [],
			quelle: 'hergeleitet'
		};
		const a = zaehleAus({
			momentaufnahme: m,
			stimmen: [stimme('p1', 'yes'), stimme('p2', 'yes'), stimme('p3', 'no')],
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			imAusstand: ['p4'],
			erfordernis
		});
		const text = protokollentwurf(
			eingabe({
				zeilen: [
					{
						...eingabe().zeilen[0],
						// Der Satz aus der Auszählung wie in `server/auswertung.ts`, nicht der
						// der Fixture: Sie sagt «Angenommen.» (Featureprüfung 3b bis 3e).
						satz: ergebniswertung(a, erfordernis),
						zahlen: { koepfe: a.koepfe, quoten: a.quoten },
						ausstandswirkung: a.ausstandswirkung ?? null
					}
				]
			})
		);
		return { a, text, erfordernis };
	};

	it('nennt unter «alle Wertquoten» 1000 und nötig 501 wie die Auszählung', () => {
		const { a, text, erfordernis } = teil('alle_quoten');
		expect(a.angenommen).toBe(false);
		// Seit Lesarten Block 2 mit der Quote im Ausstand als eigenem Posten: Die
		// Posten ergeben die Bezugsgrösse (Codeprüfung Teil 2, M1).
		expect(text).toContain(
			"- Wertquoten: 500 Ja, 250 Nein, 0 Enthaltung, 0 ohne Abgabe, 250 im Ausstand (von 1'000), nötig 501"
		);
		expect(text).toContain(AUSSTAND_UNGEKLAERT);
		expect(text).toMatch(/nicht angenommen|abgelehnt/i);
		expect(text).not.toContain('Angenommen.');
	});

	it('nennt unter «anwesend/vertreten» 750 und nötig 376 wie die Auszählung', () => {
		const { a, text, erfordernis } = teil('anwesend_vertreten');
		expect(a.angenommen).toBe(true);
		expect(text).toContain('- Wertquoten: 500 Ja, 250 Nein, 0 Enthaltung, 0 ohne Abgabe (von 750), nötig 376');
		expect(text).toContain('Bei den Wertquoten sind es 750 statt 1000.');
		expect(text).toContain(ergebniswertung(a, erfordernis));
		// Der Abschnitt zur Anfechtung spricht allgemein von abgelehnten Anträgen.
		expect(text.replace(ANFECHTUNG_IM_PROTOKOLL, '')).not.toMatch(/nicht angenommen|abgelehnt/i);
	});
});

/**
 * Ä-09, Block 2 der Freigabeliste: Regelfassung und Einheit je Beschluss,
 * Vollmachten mit Traktanden und Uhrzeit in der Anwesenheitsliste.
 */
describe('Klartext je Beschluss (Ä-09)', () => {
	const ersteZeile = (u: Partial<Protokollzeile>) => [{ ...eingabe().zeilen[0], ...u }];
	const teilnehmer = (u: Partial<Protokolleingabe['teilnehmer'][number]>) => ({
		name: 'Erfunden-Partei',
		einheiten: ['Whg 7'],
		zustand: 'anwesend' as const,
		vertretenDurch: null,
		bevollmaechtigtFuer: [],
		...u
	});

	it('nennt die Fassung der Berechnungsregeln hinter dem Erfordernis', () => {
		const t = protokollentwurf(eingabe({ zeilen: ersteZeile({ regelfassung: '2026-10-18' }) }));
		expect(t).toMatch(
			/^Erforderliche Mehrheit: .*\. Berechnungsregeln der Software Votum, Stand 18\. Oktober 2026\.$/m
		);
	});

	it('lässt den Satz zur Fassung weg, wo die Leitung die Mehrheit gesetzt hat', () => {
		const t = protokollentwurf(
			eingabe({ zeilen: ersteZeile({ regelfassung: '2026-10-18', mehrheitGesetzt: true }) })
		);
		expect(t).toContain('Erforderliche Mehrheit: ');
		expect(t).not.toContain('Software Votum');
	});

	it('lässt den Satz zur Fassung weg, wo keine bekannt ist', () => {
		expect(protokollentwurf(eingabe())).not.toContain('Software Votum');
	});

	it('nennt unter der Mehrheit die Lesart der Gemeinschaft, wo eine gilt (Kriterium 6)', () => {
		const satz = 'Gerechnet nach der Lesart der Gemeinschaft «Einfaches Mehr» (Vorgabe); die andere Lesart wäre «Qualifiziertes Mehr».';
		const t = protokollentwurf(eingabe({ zeilen: ersteZeile({ lesart: satz }) }));
		const zeilen = t.split('\n');
		const mehr = zeilen.findIndex((z) => z.startsWith('Erforderliche Mehrheit: '));
		expect(zeilen[mehr + 1]).toBe(satz);
		expect(protokollentwurf(eingabe())).not.toContain('Gerechnet nach der Lesart');
	});

	it('nennt die Einheit der Wertquoten aus dem Nenner', () => {
		expect(protokollentwurf(eingabe({ quotennenner: 10000 }))).toContain(
			'- Wertquoten (Zehntausendstel): 6'
		);
		expect(protokollentwurf(eingabe({ quotennenner: 1000 }))).toContain(
			'- Wertquoten (Tausendstel): '
		);
		expect(protokollentwurf(eingabe({ quotennenner: 360 }))).toContain(
			'- Wertquoten (Anteile von 360): '
		);
		expect(protokollentwurf(eingabe())).toMatch(/^- Wertquoten: 6/m);
	});

	it('nennt eine beendete Vollmacht mit Traktanden und Ende', () => {
		const t = protokollentwurf(
			eingabe({
				teilnehmer: [
					teilnehmer({
						vertretungszeitraeume: [
							{
								durch: 'Erfunden-Vertreter',
								ab: null,
								bis: '2026-05-19T18:15:00.000Z',
								traktanden: ['1', '2', '3'],
								ende: 'selbst_erschienen'
							}
						]
					})
				]
			})
		);
		expect(t).toContain(
			'- Erfunden-Partei (Whg 7) — vertreten durch Erfunden-Vertreter bei den Traktanden 1, 2 und 3 (bis 20:15 Uhr, danach selbst anwesend)'
		);
	});

	it('nennt Beginn und Ende einer Vertretung, die nur in der Mitte galt', () => {
		const t = protokollentwurf(
			eingabe({
				teilnehmer: [
					teilnehmer({
						zustand: 'gegangen',
						vertretungszeitraeume: [
							{
								durch: 'Erfunden-Vertreter',
								ab: '2026-05-19T17:10:00.000Z',
								bis: '2026-05-19T18:40:00.000Z',
								traktanden: ['4'],
								ende: 'beendet'
							}
						]
					})
				]
			})
		);
		expect(t).toContain(
			'— vertreten durch Erfunden-Vertreter bei Traktandum 4 (von 19:10 bis 20:40 Uhr, danach nicht mehr vertreten) — am Schluss weder anwesend noch vertreten'
		);
		expect(t).not.toContain('Erfunden-Partei (Whg 7) — vertreten durch Erfunden-Vertreter bei Traktandum 4 (von 19:10 bis 20:40 Uhr, danach nicht mehr vertreten) — hat');
	});

	it('nennt den Beginn einer Vertretung, die erst im Lauf des Abends galt', () => {
		const t = protokollentwurf(
			eingabe({
				teilnehmer: [
					teilnehmer({
						vertretenDurch: 'Erfunden-Vertreter',
						vertretungszeitraeume: [
							{
								durch: 'Erfunden-Vertreter',
								ab: '2026-05-19T18:05:00.000Z',
								bis: null,
								traktanden: ['5', '6'],
								ende: null
							}
						]
					})
				]
			})
		);
		expect(t).toContain(
			'- Erfunden-Partei (Whg 7) — vertreten durch Erfunden-Vertreter bei den Traktanden 5 und 6 (ab 20:05 Uhr)'
		);
	});
});

describe('Grundlage der geheimen Abstimmung (Ä-38)', () => {
	it('nennt, was angekreuzt war, in fester Folge, und nichts bei altem Bestand', () => {
		expect(geheimGrundlage({ geheimBeschlossen: true, geheimNachReglement: true })).toEqual([
			GEHEIM_BESCHLUSS_SATZ,
			GEHEIM_REGLEMENT_SATZ
		]);
		expect(geheimGrundlage({ geheimNachReglement: true })).toEqual([GEHEIM_REGLEMENT_SATZ]);
		expect(geheimGrundlage({})).toEqual([]);
	});
});
