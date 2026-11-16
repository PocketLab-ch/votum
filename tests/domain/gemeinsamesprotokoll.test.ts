/**
 * Das Protokoll der gemeinsamen Versammlung (Story 7.5b).
 *
 * **Was hier eigentlich geprüft wird, ist die Sperre gegen die Unterschrift.**
 * Seit dem 12.08.2026 ist das Dokument rechtsgültig und wird elektronisch
 * signiert (Auftraggeber: «Das Protokoll muss rechtsgültig sein. Ich kann das PDF dann
 * digital mit Skribble signieren.»). Damit ist eine Lücke nicht mehr bloss
 * unschön: Wer einen Entwurf qualifiziert signiert, hat einen Beschluss belegt,
 * den es so nie gab. Deshalb steht der Entwurfsfall in diesem Test ganz vorn.
 */
import { ANFECHTUNG_IM_PROTOKOLL, l8Protokollzeilen } from '$lib/domain/protokoll';
import { zweitesErgebnisImProtokoll, type ErgebnisNachAndererLesart } from '$lib/domain/auszaehlung';
import {
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL,
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL
} from '$lib/domain/mehrhinweise';
import { describe, expect, it } from 'vitest';
import {
	ENTWURFSHINWEIS,
	GELTUNG,
	gemeinsamerProtokollentwurf,
	protokollluecke,
	type Abendergebnis,
	type Abendfolgeantrag,
	type GemeinsamesProtokoll
} from '$lib/domain/gemeinsamesprotokoll';

const ABEND = (ueber: Partial<GemeinsamesProtokoll> = {}): GemeinsamesProtokoll => ({
	bezeichnung: 'MEG- und STWEG-Versammlung Nirgendwerk',
	datum: '2026-05-19',
	uhrzeit: '19:00:00',
	ort: 'Saal Nirgendwerk',
	teilnahme: [
		{
			gemeinschaft: 'Nirgendweg 3',
			zustand: 'versiegelt',
			beschlussfaehigkeit: 'Beschlussfähig: 8 von 12 Kopfstimmen anwesend',
			versiegelt: true,
			protokoll: true,
			// Ohne Papierpartei: der Regelfall, kein Abschnitt «Stimmabgabe».
			aufPapier: 0,
			eingelassen: 12
		},
		{
			gemeinschaft: 'Nirgendweg 5/5a',
			zustand: 'geschlossen',
			beschlussfaehigkeit: 'Beschlussfähig: 10 von 14 Kopfstimmen anwesend',
			versiegelt: false,
			protokoll: true,
			aufPapier: 0,
			eingelassen: 14
		}
	],
	punkte: [
		{
			nummer: '2',
			titel: 'Betriebskostenabrechnung 2025',
			antragswortlaut: 'Die Abrechnung 2025 wird genehmigt.',
			ergebnisse: [
				{
					nummer: '2.1',
					gemeinschaft: 'Nirgendweg 3',
					abweichenderTitel: null,
					satz: 'Angenommen mit 8 Ja zu 0 Nein.',
					erfordernis: 'einfaches Mehr',
					rechtsgrundlage: 'ZGB 712m Abs. 2',
					rueckzug: null,
					beschlusstext: null,
					pendenzen: [],
					ruegen: [],
					notiz: null,
					art: 'abstimmung'
				},
				{
					nummer: '2.2',
					gemeinschaft: 'Nirgendweg 5/5a',
					abweichenderTitel: null,
					satz: 'Angenommen mit 9 Ja zu 4 Nein.',
					erfordernis: 'einfaches Mehr',
					rechtsgrundlage: 'ZGB 712m Abs. 2',
					rueckzug: null,
					beschlusstext: null,
					pendenzen: [],
					ruegen: [],
					notiz: null,
					art: 'abstimmung'
				}
			]
		}
	],
	erzeugtAm: '20.05.2026, 08:12',
	erzeugtDurch: 'Max Probère',
	...ueber
});

describe('gemeinsamerProtokollentwurf', () => {
	/**
	 * **Auch das Tagprotokoll nennt die Handzählung** (28.08.2026, aus dem
	 * Code-Review zum Befund des Auftraggebers «Handabstimmung fehlt im Protokoll»).
	 *
	 * Die Einzelfassung schrieb bei einer Handzählung einen leeren Quotenspiegel
	 * aus; das gibt es hier nicht, weil dieses Dokument keinen Spiegel führt,
	 * sondern nur den Ergebnissatz. Es fehlte aber ebenso der Hinweis, dass die
	 * Zahlen aus gezählten Händen stammen und niemandem zugeordnet sind — und
	 * genau den braucht, wer später fragt, warum keine Namen dastehen.
	 */
	it('nennt eine Handzählung samt Vermerk der Sitzungsleitung', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].handzaehlung = {
			vermerk: 'Handerheben, ausgezählt durch zwei Stimmenzähler'
		};
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain('Von Hand gezählt, ohne Zuordnung zu Personen');
		expect(text).toContain('Handerheben, ausgezählt durch zwei Stimmenzähler');
	});

	it('nennt die eingewendete Bestimmung mit dem Namen der Gemeinschaft, ohne den Weg (E2, Kriterium 4)', () => {
		const abend = ABEND();
		const r = abend.punkte[0].ergebnisse[0];
		r.einwand = 'Reglement Art. 14: vier Fünftel aller Eigentümer';
		r.einwandEinfuehrung = 'Beilage zum Begründungsakt';
		r.einwandNotwendig = true;
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(`${r.gemeinschaft}: Eingewendet wurde diese Bestimmung: «Reglement Art. 14: vier Fünftel aller Eigentümer».`);
		expect(text).toContain('Eingeführt nach Angabe der Sitzungsleitung: Beilage zum Begründungsakt.');
		expect(text).toContain('Wer Eigentümer in dieser Gemeinschaft ist, der Ablehnung nicht zugestimmt hat');
		expect(text).toContain('dass es sie anordnet (ZGB Art. 647 Abs. 2 Ziff. 1)');
		expect(text).not.toMatch(/von Hand festgehalten|Notweg|übergangen/i);
		// Ohne Einwand kein Satz.
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('Eingewendet wurde');
	});

	it('nennt bei geheimer Abstimmung Grundlage und Vermerk (Ä-38)', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].geheim = true;
		abend.punkte[0].ergebnisse[0].geheimBeschlossen = true;
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain('zuvor offen beschlossen');
		expect(text).toContain('Stimmnachweisblatt');
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('Stimmnachweisblatt');
	});

	it('nennt die Fassung der Berechnungsregeln am Erfordernis (Ä-09)', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].regelfassung = '2026-10-18';
		expect(gemeinsamerProtokollentwurf(abend)).toMatch(
			/^- Angewandtes Erfordernis: .*\. Berechnungsregeln der Software Votum, Stand 18\. Oktober 2026\.$/m
		);
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('Software Votum');
	});

	it('nennt die Lesart und ein abweichendes Ergebnis nach der anderen (Migration 169)', () => {
		const abend = ABEND();
		const lesart = 'Gerechnet nach der Lesart der Gemeinschaft «Einfaches Mehr» (Vorgabe); die andere Lesart wäre «Qualifiziertes Mehr».';
		const fest = 'Nach der anderen Lesart («Qualifiziertes Mehr») wäre der Antrag abgelehnt gewesen: 2 Ja von 3 Kopfstimmen, nötig 2.';
		abend.punkte[0].ergebnisse[0].lesart = lesart;
		abend.punkte[0].ergebnisse[0].nachAndererLesart = fest;
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(`- ${lesart}`);
		expect(text).toContain(`- ${fest}`);
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('anderen Lesart');
	});

	/**
	 * **Auch hier steht, was der Ausstand an der Basis geändert hat**
	 * (Produktentscheid 24.09.2026). Der Ergebnissatz trägt die Bezugsgrösse;
	 * ohne den Satz darunter stünde sie ohne Erklärung da (Befund D-02).
	 */
	it('nennt die Wirkung eines Ausstands unter dem Ergebnis, vor dem Erfordernis', () => {
		const abend = ABEND();
		const satz = 'Wegen des Ausstands von 1 Partei umfasst die Bezugsgrösse 3 statt 4 Kopfstimmen.';
		abend.punkte[0].ergebnisse[0].ausstandswirkung = satz;
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(`- ${satz}`);
		expect(text).toContain('- Angewandtes Erfordernis');
		expect(text.indexOf(satz)).toBeLessThan(text.indexOf('- Angewandtes Erfordernis'));
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('Wegen des Ausstands');
	});

	it('trägt L7 am Beschluss mit dem Namen der Gemeinschaft, je eingefrorener Wahl (Migration 183)', () => {
		const ohne = gemeinsamerProtokollentwurf(ABEND());
		expect(ohne).not.toContain('Ohne die Personen im Ausstand');
		const mit = ABEND();
		const gemeinschaft = mit.punkte[0].ergebnisse[0].gemeinschaft;
		mit.punkte[0].ergebnisse[0].ohneAusstandFehlte = { wahl: 'zaehlt', angenommen: true };
		expect(gemeinsamerProtokollentwurf(mit)).toContain(
			`Ohne die Personen im Ausstand wäre die Versammlung von ${gemeinschaft} bei diesem Beschluss nicht beschlussfähig gewesen`
		);
		const nicht = ABEND();
		nicht.punkte[0].ergebnisse[0].ohneAusstandFehlte = { wahl: 'zaehlt_nicht', angenommen: true };
		expect(gemeinsamerProtokollentwurf(nicht)).toContain(
			`Ohne die Personen im Ausstand war die Versammlung von ${gemeinschaft} bei diesem Beschluss nicht beschlussfähig`
		);
		// Nicht doppelt neben der fehlenden Beschlussfähigkeit.
		const beides = ABEND();
		beides.punkte[0].ergebnisse[0].ohneAusstandFehlte = { wahl: 'zaehlt', angenommen: true };
		beides.punkte[0].ergebnisse[0].beschlussfaehigkeitFehlte = { grundlage: 'gesetz', fundstelle: null, angenommen: true };
		expect(gemeinsamerProtokollentwurf(beides)).not.toContain('Ohne die Personen im Ausstand');
	});

	it('trägt die Betroffenen-Zeilen ohne Namen unter dem Ergebnis (Block A3a)', () => {
		/*
		 * Bis A3a hatte das Abenddokument keine dieser Zeilen; eine fehlende
		 * oder im Ausstand erteilte Zustimmung hinterliess dort keine Spur.
		 */
		const abend = ABEND();
		const zeile =
			'Insgesamt fehlt die nach ZGB Art. 712g Abs. 4 nötige Zustimmung bei 1 betroffenen Partei.';
		abend.punkte[0].ergebnisse[0].betroffenenzeilen = [
			zeile,
			'Die Namen stehen in der Auswertung der jeweiligen Gemeinschaft; einsehen lässt sie sich ' +
				'bei der Verwaltung.'
		];
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(`- ${zeile}`);
		expect(text.indexOf(zeile)).toBeLessThan(text.indexOf('- Angewandtes Erfordernis'));
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('betroffenen Partei');
	});

	it('schweigt, wo einzeln erfasst wurde', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).not.toContain('Von Hand gezählt');
	});

	it('setzt die Geltungsklausel in den Kopf, vor alles Inhaltliche', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain(GELTUNG);
		// Vor dem ersten Traktandum, nicht am Schluss: Wer nur den Anfang liest,
		// muss wissen, für wen dieses Protokoll gilt.
		expect(text.indexOf(GELTUNG)).toBeLessThan(text.indexOf('## 2 '));
	});

	it('heisst Protokoll — es ist eines', () => {
		// Der Titel ist die erste Zeile und damit das, was auf dem Deckblatt steht.
		const erste = gemeinsamerProtokollentwurf(ABEND()).split('\n')[0];
		expect(erste).toBe('# Protokoll der gemeinsamen Versammlung');
	});

	/*
	 * ── Die Sperre gegen die Unterschrift ──────────────────────────────────
	 *
	 * Der teuerste Fehler dieser Story: ein signierter Entwurf. Geprüft wird
	 * deshalb dreifach — Titel, Kopf und Schluss müssen alle sagen, dass noch
	 * nicht unterzeichnet werden darf, und der Unterschriftsblock muss fehlen.
	 */
	it('trägt «Entwurf» im Titel, solange etwas fehlt', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ luecke: '2 Punkte ohne Ergebnis' }));
		expect(text.split('\n')[0]).toBe('# Protokoll der gemeinsamen Versammlung (Entwurf)');
	});

	it('sagt im Kopf und am Schluss, dass es nicht zu unterzeichnen ist', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ luecke: '2 von 7 noch nicht geschlossen' }));
		const treffer = [...text.matchAll(new RegExp(ENTWURFSHINWEIS, 'g'))];
		expect(treffer).toHaveLength(2);
		// Und die Lücke steht dabei — «nicht unterzeichnen» ohne Grund führt dazu,
		// dass jemand es doch tut.
		expect(text).toContain('2 von 7 noch nicht geschlossen');
	});

	it('lässt im Entwurf den Unterschriftsblock weg', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ luecke: '1 Punkt ohne Ergebnis' }));
		expect(text).not.toContain('Die Sitzungsleitung des Abends:');
		expect(text).not.toContain('Die Protokollführung:');
	});

	it('zeigt ihn, sobald nichts mehr fehlt', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('Die Sitzungsleitung des Abends:');
		expect(text).toContain('Die Protokollführung:');
		expect(text).not.toContain(ENTWURFSHINWEIS);
	});

	/*
	 * **Die Unterschrift ist wählbar** (Auftraggeber, 12.08.2026: «Mache die Unterschrift
	 * als Option»). ZGB 712n Abs. 2 verlangt keine; die Reglemente sind
	 * verschieden. Was **nicht** wählbar ist: der Satz, wer welchen Teil genehmigt
	 * — er gilt unabhängig davon, ob jemand unterschreibt.
	 */
	it('lässt den Unterschriftsblock weg, wenn er nicht gewollt ist', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ unterschriften: false }));
		expect(text).not.toContain('Die Sitzungsleitung des Abends:');
		expect(text).not.toContain('Die Protokollführung:');
		// Der Genehmigungssatz bleibt.
		expect(text).toContain('genehmigt den sie betreffenden Teil an ihrer nächsten Versammlung');
	});

	it('nimmt ihn ohne Angabe mit — die Vorgabe ist «mit»', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ unterschriften: undefined }));
		expect(text).toContain('Die Sitzungsleitung des Abends:');
	});

	it('führt die Punkte in der Reihenfolge des Abends, mit den Nummern des Saals', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('## 2 Betriebskostenabrechnung 2025');
		expect(text).toContain('### 2.1 Nirgendweg 3');
		expect(text).toContain('### 2.2 Nirgendweg 5/5a');
		// Und die Nummer des Abends steht vor dem Namen — im Saal wird sie zuerst
		// aufgerufen.
		expect(text.indexOf('### 2.1')).toBeLessThan(text.indexOf('### 2.2'));
	});

	/*
	 * Seit es nur noch ein Protokoll gibt (Auftraggeber, 12.08.2026: «Nicht pro Haus»),
	 * müssen die Notizen der Sitzungsleitung hierher — sie sind das Einzige am
	 * Protokoll, was von Hand kommt. Blieben sie beim Haus, führte das eine
	 * Protokoll nur noch Zahlen.
	 */
	it('nimmt die Notiz der Sitzungsleitung auf, vor dem Ergebnis', () => {
		const a = ABEND();
		a.punkte[0].ergebnisse[0].notiz = 'Die Verwaltung erläuterte die Abweichung beim Heizöl.';
		const text = gemeinsamerProtokollentwurf(a);
		expect(text).toContain('Die Verwaltung erläuterte die Abweichung beim Heizöl.');
		// Vor dem Ergebnis: Wer das Ergebnis gelesen hat, liest die Begründung nicht
		// mehr.
		expect(text.indexOf('Die Verwaltung erläuterte')).toBeLessThan(
			text.indexOf('Angenommen mit 8 Ja zu 0 Nein.')
		);
	});

	it('stellt die Ergebnisse je Gemeinschaft untereinander', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('Angenommen mit 8 Ja zu 0 Nein.');
		expect(text).toContain('Angenommen mit 9 Ja zu 4 Nein.');
		expect(text).toContain('- Angewandtes Erfordernis: einfaches Mehr (ZGB 712m Abs. 2)');
	});

	/*
	 * Der teuerste Fehler wäre eine glatte Formulierung, die den Unterschied
	 * verwischt: «nicht abgestimmt» ist nicht «abgelehnt», und «zurückgezogen»
	 * ist es erst recht nicht.
	 */
	/*
	 * **Eine Kenntnisnahme hat kein Ergebnis, und das ist keine Lücke.** Ohne
	 * diese Unterscheidung bliebe jedes Protokoll mit Begrüssung und
	 * Stimmenzählerwahl ewig Entwurf, und der Unterschriftsblock erschiene nie —
	 * gesehen am 12.08.2026, als 16 von 16 Punkten als offen galten.
	 */
	it('nennt eine Kenntnisnahme als solche, nicht als fehlendes Ergebnis', () => {
		const a = ABEND();
		a.punkte[0].ergebnisse[0].art = 'kenntnisnahme';
		a.punkte[0].ergebnisse[0].satz = null;
		const text = gemeinsamerProtokollentwurf(a);
		expect(text).toContain('Zur Kenntnis genommen; es wurde nicht abgestimmt.');
		expect(text).not.toContain('noch kein Ergebnis vor');
	});

	it('unterscheidet zurückgezogen von ohne Ergebnis', () => {
		const a = ABEND();
		a.punkte[0].ergebnisse[0].satz = null;
		a.punkte[0].ergebnisse[0].erfordernis = null;
		a.punkte[0].ergebnisse[1].rueckzug = 'Der Antragsteller hat zurückgezogen.';
		a.punkte[0].ergebnisse[1].satz = null;
		const text = gemeinsamerProtokollentwurf(a);
		expect(text).toContain('noch kein Ergebnis vor');
		expect(text).toContain(
			'Vor der Abstimmung zurückgezogen: Der Antragsteller hat zurückgezogen.'
		);
		expect(text).not.toContain('abgelehnt');
	});

	it('zeigt einen abweichenden Wortlaut nur, wo er abweicht', () => {
		const gleich = gemeinsamerProtokollentwurf(ABEND());
		expect(gleich).not.toContain('Wortlaut in dieser Gemeinschaft');

		const a = ABEND();
		a.punkte[0].ergebnisse[1].abweichenderTitel = 'Betriebskosten 2025 samt Nachtrag';
		expect(gemeinsamerProtokollentwurf(a)).toContain(
			'Wortlaut in dieser Gemeinschaft: Betriebskosten 2025 samt Nachtrag'
		);
	});

	/*
	 * Der Verweis statt eines eigenen Siegels (Entscheid 4 im Kopf der Datei).
	 * Ohne ihn läse sich die Zusammenstellung wie ein abgeschlossenes Dokument,
	 * obwohl die Hälfte der Versammlungen noch offen sein kann.
	 */
	it('sagt, welche Versammlungen noch nicht versiegelt sind', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('Noch nicht versiegelt: Nirgendweg 5/5a');
	});

	it('sagt es auch, wenn alles versiegelt ist', () => {
		const a = ABEND();
		a.teilnahme = a.teilnahme.map((t) => ({ ...t, versiegelt: true }));
		const text = gemeinsamerProtokollentwurf(a);
		expect(text).toContain('Alle 2 Versammlungen sind versiegelt');
		expect(text).not.toContain('Noch nicht versiegelt');
	});

	/*
	 * Keine Unterschriftslinien: Unterzeichnet wird elektronisch (Skribble, FES
	 * oder QES). Eine Linie wäre die Aufforderung, es doch von Hand zu tun — und
	 * ein Papierausdruck neben dem signierten PDF ist genau die zweite Fassung,
	 * die niemand auseinanderhalten kann.
	 */
	it('nennt die Unterzeichnenden ohne Linien zum Ausdrucken', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).not.toMatch(/_{3,}|\.{5,}/);
		expect(text).toContain('Die Sitzungsleitung des Abends:');
	});

	it('sagt, wer welchen Teil genehmigt', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('genehmigt den sie betreffenden Teil an ihrer nächsten Versammlung');
		expect(GELTUNG).toContain('Anfechtbar ist der Beschluss der einzelnen Gemeinschaft');
	});

	it('kommt mit einem leeren Abend zurecht, ohne etwas zu behaupten', () => {
		const text = gemeinsamerProtokollentwurf(ABEND({ teilnahme: [], punkte: [] }));
		expect(text).toContain('Keine Gemeinschaft zugeordnet.');
		expect(text).toContain('Für diesen Abend ist kein Geschäft erfasst.');
		expect(text).toContain('An diesem Abend tagt keine Gemeinschaft.');
	});

	it('sagt bei einem Punkt ohne Gemeinschaft, dass dort nichts beschlossen wurde', () => {
		const a = ABEND();
		a.punkte[0].ergebnisse = [];
		expect(gemeinsamerProtokollentwurf(a)).toContain(
			'Noch keiner Gemeinschaft zugeordnet — hier wurde nichts beschlossen.'
		);
	});

	/*
	 * **Eine Nummer, eine Überschrift.** Läuft ein Punkt nur in einer
	 * Gemeinschaft, trügen Punkt und Unterpunkt dieselbe Ziffer — im PDF des
	 * Prüflaufs stand etwa «9 Türdämpfer Waschküche» und direkt darunter
	 * «9 Nirgendweg 5/5a», was sich wie zwei Traktanden liest.
	 */
	it('setzt bei einer einzigen Gemeinschaft keine zweite Überschrift', () => {
		const a = ABEND();
		a.punkte[0].ergebnisse = [a.punkte[0].ergebnisse[0]];
		const text = gemeinsamerProtokollentwurf(a);
		expect(text).not.toContain('### 2.1');
		// Der Name steht dann in der Ergebniszeile, wo er kurz ist und stimmt.
		expect(text).toContain('Nirgendweg 3: Angenommen mit 8 Ja zu 0 Nein.');
	});

	it('behält die Überschriften, sobald mehrere Gemeinschaften beteiligt sind', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('### 2.1 Nirgendweg 3');
		expect(text).not.toContain('Nirgendweg 3: Angenommen');
	});

	it('ist reproduzierbar — dieselbe Eingabe, derselbe Text', () => {
		// Die Bedingung dafür, dass sich der Text mit einer Wertetabelle belegen
		// lässt (AD-1). Ohne sie wäre jede Prüfung wertlos.
		expect(gemeinsamerProtokollentwurf(ABEND())).toBe(gemeinsamerProtokollentwurf(ABEND()));
	});

	it('schreibt das Datum aus und kürzt die Uhrzeit auf Stunden und Minuten', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).toContain('| Datum, Beginn | 19. Mai 2026, 19:00 Uhr |');
		// Die Gegenprobe: der alte Aufzählungskopf ist weg, nicht bloss ergänzt.
		expect(text).not.toContain('- Datum:');
		expect(text).not.toContain('- Beginn:');
	});
});

/**
 * **Die Pendenz im Abendprotokoll** (Migration 106).
 *
 * Zweite Aufbaustelle derselben Auskunft — und deshalb hier geprüft und nicht
 * bloss im Hausprotokoll. Die Lehre vom 09.09.2026: Ein Feld, das nur einer von
 * zwei Fassungen kennt, ist halb gebaut, und die Erfolgsmeldung «steht im
 * Protokoll» ist dann in der anderen Hälfte falsch.
 */
describe('Pendenzen am Abend', () => {
	const rampe = {
		text: 'Offerten für die Rampe einholen',
		verantwortlich: 'die Bewirtschaftung',
		fristArt: 'naechste_versammlung' as const,
		fristDatum: null
	};

	it('nennt sie je Haus, mit Zuständigem und Frist', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].pendenzen = [rampe];
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(
			'- die Bewirtschaftung: Offerten für die Rampe einholen (bis zur nächsten Versammlung)'
		);
	});

	/*
	 * **Der Hausname steht genau einmal je Block** (Code-Review 09.09.2026).
	 * Die Regel dafür heisst `wer2`: Wer den Namen schon gesagt hat, sagt ihn
	 * nicht noch einmal. Der erste Anlauf setzte ihn vor die Pendenzen und
	 * erzeugte «Nirgendweg 3: Ein Votum aus dem Saal.» … «Nirgendweg 3:
	 * Pendenz:» im selben Absatz.
	 *
	 * Die Probe misst deshalb die Anzahl und nicht das Vorkommen — mit
	 * `toContain` wäre die falsche Fassung grün geblieben.
	 */
	/*
	 * **Die Rüge je Haus, ohne Namen** (H8, Ä-06). Das Abenddokument geht an
	 * alle beteiligten Gemeinschaften; der Name, wer rügt, bleibt im Paket und
	 * im Verlauf des Hauses. Und der Hausname steht trotzdem nur einmal.
	 */
	it('nennt die Rüge je Haus vor dem Votum, ohne Namen und ohne den Hausnamen zu wiederholen', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse = [abend.punkte[0].ergebnisse[0]];
		abend.punkte[0].ergebnisse[0].notiz = 'Ein Votum aus dem Saal.';
		abend.punkte[0].ergebnisse[0].ruegen = [
			{
				uhrzeit: '19:12',
				wer: 'Erika Beispiel',
				wortlaut: 'Die Einladung kam zu spät',
				entscheid: 'Die Abstimmung findet statt'
			}
		];
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain(
			'Rüge im Saal:\n- 19:12 Uhr: Die Einladung kam zu spät. Vorgehen des Vorsitzes: Die ' +
				'Abstimmung findet statt.\n\nEin Votum aus dem Saal.'
		);
		expect(text).not.toContain('Erika Beispiel');
		const haus = abend.punkte[0].ergebnisse[0].gemeinschaft;
		expect(text.split(`${haus}:`).length - 1).toBe(1);
	});

	it('wiederholt den Hausnamen nicht, wo er schon dasteht', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse = [abend.punkte[0].ergebnisse[0]];
		abend.punkte[0].ergebnisse[0].notiz = 'Ein Votum aus dem Saal.';
		abend.punkte[0].ergebnisse[0].pendenzen = [rampe];
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toMatch(/^Pendenz:$/m);
		expect(text.match(/Nirgendweg 3:/g)?.length ?? 0).toBe(1);
	});

	/** Eine Leerzeile davor: Daraus macht das PDF den Absatzabstand. */
	it('setzt die Pendenzen als eigenen Absatz', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].pendenzen = [rampe];
		expect(gemeinsamerProtokollentwurf(abend)).toMatch(/\n\nPendenz:\n/);
	});

	it('nennt sie auch bei einer Kenntnisnahme ohne Abstimmung', () => {
		const abend = ABEND();
		const e = abend.punkte[0].ergebnisse[0];
		e.art = 'kenntnisnahme';
		e.satz = null;
		e.pendenzen = [
			{
				text: 'Antrag auf Torersatz für 2027 vorbereiten',
				verantwortlich: 'die Revisionsstelle',
				fristArt: 'datum',
				fristDatum: '2027-03-31'
			}
		];
		const text = gemeinsamerProtokollentwurf(abend);
		expect(text).toContain('die Revisionsstelle: Antrag auf Torersatz für 2027 vorbereiten (bis 31.03.2027)');
	});

	/** Wie im Hausprotokoll: was vereinbart wurde, nicht wie es heute steht. */
	it('sagt nichts darüber, wie es heute um sie steht', () => {
		const abend = ABEND();
		abend.punkte[0].ergebnisse[0].pendenzen = [rampe];
		expect(gemeinsamerProtokollentwurf(abend)).not.toMatch(/erledigt|hinfällig/i);
	});

	it('schweigt, wo keine erfasst wurde', () => {
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toMatch(/Pendenz/);
	});
});

describe('Vorsitz und Protokollführung des Abends', () => {
	/*
	 * **Warum gerade hier** (Auftraggeber, 26.08.2026: «Auch bei einer gemeinsamen
	 * Versammlung muss der Vorsitz benannt werden»): Am Abend unterschreiben alle
	 * Beteiligten dasselbe Dokument. Ohne Namen über der Zeile trägt es keine
	 * einzige Zurechnung — und der Fall, dass eine Person mehrere Häuser führt,
	 * ist am Verbundabend der Normalfall.
	 */
	it('nennt beide im Kopf und über den Unterschriftszeilen', () => {
		const text = gemeinsamerProtokollentwurf(
			ABEND({
				sitzungsleitung: 'Rita Berger',
				protokollfuehrung: 'Notariat Muster'
			})
		);
		expect(text).toContain('| Vorsitz | Rita Berger |');
		expect(text).toContain('| Protokollführung | Notariat Muster |');
		expect(text).toContain('Die Sitzungsleitung des Abends — Rita Berger:');
		expect(text).toContain('Die Protokollführung — Notariat Muster:');
	});

	it('lässt die Zeilen leer, wenn niemand eingetragen ist', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text).not.toContain('| Vorsitz |');
		// Beide Richtungen: Ohne die zweite Zusicherung bliebe ein Durchschlagen
		// der Protokollführung in den Kopf unbemerkt.
		expect(text).not.toContain('| Protokollführung |');
		expect(text).toContain('Die Sitzungsleitung des Abends:');
		expect(text).toContain('Die Protokollführung:');
	});

	it('nennt im Entwurf niemanden über der Zeile — es gibt dort keine', () => {
		const text = gemeinsamerProtokollentwurf(
			ABEND({
				sitzungsleitung: 'Rita Berger',
				luecke: 'Haus B ist noch offen'
			})
		);
		// Im Kopf steht der Name; einen Unterschriftsblock gibt es im Entwurf nicht.
		expect(text).toContain('| Vorsitz | Rita Berger |');
		expect(text).not.toContain('Die Sitzungsleitung des Abends');
	});

	it('nennt den Vorsitz auch dann nicht, wenn der Block abgewählt ist', () => {
		const text = gemeinsamerProtokollentwurf(
			ABEND({ sitzungsleitung: 'Rita Berger', unterschriften: false })
		);
		// Im Kopf steht er weiterhin — dort ist er eine Angabe zur Sitzung, keine
		// Unterschriftszeile.
		expect(text).toContain('| Vorsitz | Rita Berger |');
		expect(text).not.toContain('Die Sitzungsleitung des Abends');
	});
});

describe('protokollluecke', () => {
	it('schweigt, solange kein Abend mit Versammlungen besteht', () => {
		expect(
			protokollluecke({
				versammlungen: 0,
				offeneErgebnisse: 0,
				nichtGeschlossen: 0
			})
		).toBeNull();
	});

	/*
	 * Der Fall, der zuerst durchfiel: Wo keine Gemeinschaft zugeordnet ist, gibt
	 * es auch kein fehlendes Ergebnis zu zählen — das Protokoll galt als
	 * vollständig, obwohl acht Punkte leer blieben.
	 */
	it('zählt Punkte ohne Gemeinschaft als Lücke', () => {
		expect(
			protokollluecke({
				versammlungen: 2,
				offeneErgebnisse: 0,
				nichtGeschlossen: 0,
				ohneZuordnung: 8
			})
		).toBe('8 Punkte ohne Gemeinschaft');
		expect(
			protokollluecke({
				versammlungen: 2,
				offeneErgebnisse: 0,
				nichtGeschlossen: 0,
				ohneZuordnung: 1
			})
		).toBe('1 Punkt ohne Gemeinschaft');
	});

	it('nennt zuerst die offenen Versammlungen — sie wiegen schwerer', () => {
		// Solange eine Versammlung läuft, kann sich jedes Ergebnis noch ändern.
		// Die Zahl der offenen Punkte wäre dann eine Momentaufnahme ohne Wert.
		expect(
			protokollluecke({
				versammlungen: 7,
				offeneErgebnisse: 3,
				nichtGeschlossen: 2
			})
		).toBe('2 von 7 noch nicht geschlossen');
	});

	it('nennt danach die Punkte ohne Ergebnis, im richtigen Numerus', () => {
		expect(
			protokollluecke({
				versammlungen: 7,
				offeneErgebnisse: 1,
				nichtGeschlossen: 0
			})
		).toBe('1 Punkt ohne Ergebnis');
		expect(
			protokollluecke({
				versammlungen: 7,
				offeneErgebnisse: 4,
				nichtGeschlossen: 0
			})
		).toBe('4 Punkte ohne Ergebnis');
	});

	it('schweigt, wenn alles steht', () => {
		expect(
			protokollluecke({
				versammlungen: 7,
				offeneErgebnisse: 0,
				nichtGeschlossen: 0
			})
		).toBeNull();
	});
});

/**
 * Die Mischform am gemeinsamen Abend (Migration 108).
 *
 * **Warum sie hier stehen muss und nicht nur im Hausprotokoll.** Am gemeinsamen
 * Abend führt das Haus kein eigenes Protokoll mehr; diese Zusammenstellung ist
 * das Dokument. Stünde der Abschnitt nur dort, sagte am Verbundabend niemand,
 * dass ein Teil der Stimmen von der Sitzungsleitung übertragen wurde.
 */
describe('Stimmabgabe auf Papier', () => {
	it('nennt die Häuser in der Mischform mit ihren Parteien', () => {
		const t = gemeinsamerProtokollentwurf(
			ABEND({
				teilnahme: [
					{
						gemeinschaft: 'Nirgendweg 3',
						zustand: 'geschlossen',
						beschlussfaehigkeit: null,
						versiegelt: false,
						protokoll: true,
						aufPapier: 2,
						eingelassen: 12
					},
					{
						gemeinschaft: 'Nirgendweg 5/5a',
						zustand: 'geschlossen',
						beschlussfaehigkeit: null,
						versiegelt: false,
						protokoll: true,
						aufPapier: 0,
						eingelassen: 14
					}
				]
			})
		);
		expect(t).toContain('### Stimmabgabe auf Papier');
		expect(t).toContain('- Nirgendweg 3: 2 von 12 anwesenden Parteien stimmten auf Papier ab.');
		// Das Haus ohne Papierpartei steht NICHT in diesem Abschnitt: Es tagte
		// nicht in der Mischform, und ein leerer Eintrag behauptete das Gegenteil.
		expect(t).not.toContain('- Nirgendweg 5/5a:');

		/*
		 * **Diese zwei Zeilen sind eine Aussage über den EINGANGSTYP, nicht über
		 * das Rendern** (10.09.2026, von website-ab gegengelesen).
		 *
		 * Sie können hier nicht rot werden, und das ist kein Versehen: `ABEND`
		 * führt die beiden Namen nirgends, und `GemeinsamesProtokoll` hat gar kein
		 * Feld, das eine Parteinamensliste tragen könnte — `Abendteilnahme.aufPapier`
		 * ist eine Zahl. Sie halten damit fest, dass das so bleibt: Wer daraus
		 * wieder `string[]` macht, muss diese Stelle anfassen.
		 *
		 * **Der echte Wächter steht eine Schicht tiefer**, in
		 * `tests/db/tagprotokoll.test.ts` («nennt die Mischform je Haus, aber keinen
		 * Eigentümernamen»). Dort führen `staende` und `papierparteien` die Namen
		 * noch, und erst `.length` nimmt sie weg. Die Defektprobe ist gefahren: Wird
		 * `.length` dort auf die Namensliste zurückgedreht, ist jener Test rot und
		 * dieser hier bleibt grün.
		 */
		expect(t).not.toContain('Aebi');
		expect(t).not.toContain('Bucher');
	});

	it('erklärt es einmal, nicht je Haus', () => {
		/*
		 * Bei fünf Gemeinschaften stünde derselbe Absatz sonst fünfmal da. Gezählt
		 * wird der tragende Satz.
		 */
		const t = gemeinsamerProtokollentwurf(
			ABEND({
				teilnahme: [
					{
						gemeinschaft: 'Nirgendweg 3',
						zustand: 'geschlossen',
						beschlussfaehigkeit: null,
						versiegelt: false,
						protokoll: true,
						aufPapier: 1,
						eingelassen: 12
					},
					{
						gemeinschaft: 'Nirgendweg 5/5a',
						zustand: 'geschlossen',
						beschlussfaehigkeit: null,
						versiegelt: false,
						protokoll: true,
						aufPapier: 1,
						eingelassen: 14
					}
				]
			})
		);
		expect(t.split('Sitzungsleitung übertragen')).toHaveLength(2);
	});

	it('schweigt, wo kein Haus in der Mischform tagte', () => {
		// Die Grundfixture führt beide Häuser ohne Papierpartei.
		expect(gemeinsamerProtokollentwurf(ABEND())).not.toContain('### Stimmabgabe auf Papier');
	});
});

describe('Anfechtung im gemeinsamen Protokoll (A5, Punkt 2)', () => {
	it('nennt Weg und Frist einmal, wo ein Beschluss vorliegt', () => {
		const text = gemeinsamerProtokollentwurf(ABEND());
		expect(text.match(/## Anfechtung/g)).toHaveLength(1);
		expect(text).toContain(ANFECHTUNG_IM_PROTOKOLL);
	});

	it('schweigt ohne Beschluss', () => {
		const abend = ABEND();
		const ohne = {
			...abend,
			punkte: abend.punkte.map((p) => ({
				...p,
				ergebnisse: p.ergebnisse.map((r) => ({ ...r, satz: 'Kein Beschluss: Die Versammlung war nicht beschlussfähig.' }))
			}))
		};
		expect(gemeinsamerProtokollentwurf(ohne)).not.toContain('## Anfechtung');
	});
});

/**
 * Folgeanträge mit eigener Zeile im Abenddokument (Produktentscheid
 * 08.11.2026, Entscheid 0045, Punkt 11): wie im Hausprotokoll, unter der
 * Zeile des Hauses, mit Nummer des Hauses, Titel, dem Wort «Folgeantrag» und
 * dem Ergebnis.
 */
describe('Folgeanträge im Abenddokument (Produktentscheid 08.11.2026)', () => {
	const grundantrag = (): Abendergebnis => ({
		nummer: '4',
		gemeinschaft: 'Nirgendweg 3',
		abweichenderTitel: null,
		satz: null,
		teileEntschieden: [{ nummer: '4.1', titel: 'Wiederwahl', art: 'wahl' }],
		erfordernis: null,
		rechtsgrundlage: null,
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		ruegen: [],
		notiz: null,
		art: 'abstimmung'
	});
	const folgeantrag = (nummer: string, titel: string, ueber: Partial<Abendfolgeantrag> = {}): Abendfolgeantrag => ({
		...grundantrag(),
		teileEntschieden: null,
		nummer,
		titel,
		antragswortlaut: `${titel}: so beantragt.`,
		...ueber
	});
	const punkt = (ergebnisse: Abendergebnis[]): GemeinsamesProtokoll =>
		ABEND({
			punkte: [{ nummer: '4', titel: 'Wahl und Entschädigung der Verwaltung', antragswortlaut: null, ergebnisse }]
		});

	it('setzt je Folgeantrag eine eigene Zeile nach dem Grundantrag, in der Folge der Nummern', () => {
		const g = grundantrag();
		g.folgeantraege = [
			folgeantrag('4.2', 'Entschädigung', {
				satz: 'Angenommen mit 2 Ja zu 1 Nein.',
				erfordernis: 'einfaches Mehr',
				lesart: 'Gerechnet nach der Lesart der Gemeinschaft.',
				ausstandswirkung: 'Die Vollmachten der Verwaltung ruhten bei diesem Traktandum.',
				beschlusstext: 'Zum Ansatz des Vorjahrs.'
			}),
			folgeantrag('4.1', 'Wiederwahl', { satz: 'Abgelehnt mit 1 Ja zu 2 Nein.', erfordernis: 'einfaches Mehr' })
		];
		const text = gemeinsamerProtokollentwurf(punkt([g]));
		const grund = text.indexOf('Über diesen Antrag wurde nicht abgestimmt');
		const wahl = text.indexOf('### Folgeantrag 4.1 «Wiederwahl»');
		const entschaedigung = text.indexOf('### Folgeantrag 4.2 «Entschädigung»');
		expect(grund).toBeGreaterThan(0);
		expect(wahl).toBeGreaterThan(grund);
		expect(entschaedigung).toBeGreaterThan(wahl);
		expect(text).toContain('Antrag: Wiederwahl: so beantragt.');
		// Bei einem einzigen Haus der Name in der Ergebniszeile, wie beim Grundantrag.
		expect(text).toContain('Nirgendweg 3: Abgelehnt mit 1 Ja zu 2 Nein.');
		expect(text).toContain('Nirgendweg 3: Angenommen mit 2 Ja zu 1 Nein.\nZum Ansatz des Vorjahrs.');
		expect(text).toContain('- Gerechnet nach der Lesart der Gemeinschaft.');
		expect(text).toContain('- Die Vollmachten der Verwaltung ruhten bei diesem Traktandum.');
	});

	it('hält die Zeile des Folgeantrags unter mehreren Häusern von der Hauszeile mit gleicher Nummer getrennt', () => {
		const a = grundantrag();
		a.nummer = '4.1';
		a.folgeantraege = [folgeantrag('4.1', 'Wiederwahl', { satz: 'Abgelehnt mit 1 Ja zu 2 Nein.' })];
		const b: Abendergebnis = { ...grundantrag(), nummer: '4.2', gemeinschaft: 'Nirgendweg 5/5a', satz: 'Angenommen mit 9 Ja zu 4 Nein.', teileEntschieden: null };
		const text = gemeinsamerProtokollentwurf(punkt([a, b]));
		expect(text.match(/^### 4\.1 /gm)).toHaveLength(1);
		const haus = text.indexOf('### 4.1 Nirgendweg 3');
		const fa = text.indexOf('#### Folgeantrag 4.1 «Wiederwahl»');
		const zweites = text.indexOf('### 4.2 Nirgendweg 5/5a');
		expect(haus).toBeGreaterThan(0);
		expect(fa).toBeGreaterThan(haus);
		expect(zweites).toBeGreaterThan(fa);
		// Unter der Überschrift des Hauses ohne den Namen davor.
		expect(text).not.toContain('Nirgendweg 3: Abgelehnt');
	});

	it('sagt beim nie abgestimmten Folgeantrag, dass kein Ergebnis vorliegt', () => {
		const g = { ...grundantrag(), teileEntschieden: null };
		g.folgeantraege = [folgeantrag('4.1', 'Wiederwahl')];
		const text = gemeinsamerProtokollentwurf(punkt([g]));
		const abschnitt = text.slice(text.indexOf('### Folgeantrag 4.1'));
		expect(abschnitt).toContain('Nirgendweg 3: Zu diesem Punkt liegt noch kein Ergebnis vor.');
	});

	it('nennt den zurückgezogenen Folgeantrag als solchen', () => {
		const g = { ...grundantrag(), teileEntschieden: null };
		g.folgeantraege = [folgeantrag('4.1', 'Wiederwahl', { rueckzug: 'Antrag zurückgezogen, kommt an die nächste Versammlung.' })];
		const text = gemeinsamerProtokollentwurf(punkt([g]));
		expect(text).toContain(
			'Nirgendweg 3: Vor der Abstimmung zurückgezogen: Antrag zurückgezogen, kommt an die nächste Versammlung.'
		);
	});

	it('nennt die Anfechtung, wo ein Folgeantrag den einzigen Beschluss trägt', () => {
		const g = grundantrag();
		g.folgeantraege = [
			folgeantrag('4.1', 'Abberufung', { satz: 'Abgelehnt mit 1 Ja zu 2 Nein.', anfechtungssonderfall: 'abberufung' })
		];
		const text = gemeinsamerProtokollentwurf(punkt([g]));
		expect(text.match(/## Anfechtung/g)).toHaveLength(1);
		expect(text).toContain(ANFECHTUNG_IM_PROTOKOLL);
		expect(text).toContain('Anders bei einer abgelehnten Abberufung der Verwaltung');
	});

	it('Gegenprobe: ohne Beschluss am Folgeantrag keine Anfechtung', () => {
		const g = grundantrag();
		g.folgeantraege = [folgeantrag('4.1', 'Wiederwahl', { satz: 'Kein Beschluss: Die Versammlung war nicht beschlussfähig.' })];
		expect(gemeinsamerProtokollentwurf(punkt([g]))).not.toContain('## Anfechtung');
	});
});

describe('Die Zeilen zu L8 im Abenddokument (Codeprüfung P11, H1)', () => {
	const ergebnis = (ueber: Partial<Abendergebnis> = {}): Abendergebnis => ({
		nummer: '4.1',
		gemeinschaft: 'Nirgendweg 3',
		abweichenderTitel: null,
		satz: 'Angenommen mit 2 Ja zu 0 Nein.',
		erfordernis: 'einfaches Mehr',
		rechtsgrundlage: null,
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		ruegen: [],
		notiz: null,
		art: 'abstimmung',
		...ueber
	});
	const text = (e: Abendergebnis) =>
		gemeinsamerProtokollentwurf(
			ABEND({ punkte: [{ nummer: '4', titel: 'Entlastung der Verwaltung', antragswortlaut: null, ergebnisse: [e] }] })
		);
	const RUHEN =
		'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
		'Für eine vertretene Partei zählte deshalb keine Stimme.';

	it('setzt dieselben Sätze wie das Hausprotokoll, nach dem Ergebnis und vor den Zahlenvermerken', () => {
		const lage = {
			wahlTrotzHaekchen: true,
			abberufungTrotzHaekchen: true,
			abberufungAusstandErklaert: true,
			verwaltungsangabe: { grund: 'kuendigung' as const, ausstandErklaert: false }
		};
		expect(l8Protokollzeilen(lage)).toEqual([
			VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL,
			VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
			VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL
		]);
		const t = text(ergebnis({ ...lage, ausstandswirkung: 'Ein Ausstand.', bezugsgroessenvermerke: [RUHEN] }));
		const zeilen = t.split('\n');
		const ergebniszeile = zeilen.indexOf('Nirgendweg 3: Angenommen mit 2 Ja zu 0 Nein.');
		const saetze = l8Protokollzeilen(lage).map((s) => zeilen.indexOf(s));
		expect(ergebniszeile).toBeGreaterThanOrEqual(0);
		expect(saetze).toEqual([ergebniszeile + 1, ergebniszeile + 2, ergebniszeile + 3]);
		// Die Zeile zum Ruhen unter dem Ausstand, im selben Absatz, vor dem Erfordernis.
		const ausstand = zeilen.indexOf('- Ein Ausstand.');
		expect(zeilen[ausstand + 1]).toBe(`- ${RUHEN}`);
		expect(zeilen.indexOf(`- ${RUHEN}`)).toBeLessThan(zeilen.findIndex((z) => z.startsWith('- Angewandtes Erfordernis')));
	});

	it('setzt die Zeile zum Ruhen ohne Ausstand mit eigener Leerzeile davor', () => {
		const zeilen = text(ergebnis({ bezugsgroessenvermerke: [RUHEN] })).split('\n');
		const i = zeilen.indexOf(`- ${RUHEN}`);
		expect(zeilen[i - 1]).toBe('');
	});

	it('Gegenprobe: ohne Angaben keine Zeile zu L8 und keine Leerzeile dafür', () => {
		const ohne = text(ergebnis());
		expect(ohne).not.toContain('Vollmachten');
		expect(ohne).not.toContain('Einladung angekündigt');
		expect(text(ergebnis({ bezugsgroessenvermerke: [] }))).toBe(ohne);
		expect(text(ergebnis({ wahlTrotzHaekchen: false, verwaltungsangabe: null }))).toBe(ohne);
	});

	it('nennt das zweite Ergebnis zu L8 nur bei Abweichung oder ohne Bestimmung, die übrigen immer', () => {
		const r = (kennung: string, abweichend: boolean, feststellbar: boolean) =>
			({ kennung, abweichend, feststellbar }) as ErgebnisNachAndererLesart;
		expect(zweitesErgebnisImProtokoll(r('L8', false, true))).toBe(false);
		expect(zweitesErgebnisImProtokoll(r('L8', true, true))).toBe(true);
		expect(zweitesErgebnisImProtokoll(r('L8', false, false))).toBe(true);
		expect(zweitesErgebnisImProtokoll(r('L2', false, true))).toBe(true);
	});
});
