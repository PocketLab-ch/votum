/**
 * Prüfdatei der Texte zu L7 (Ausstand und Beschlussfähigkeit, B2) und, in
 * den Läufen 2 und 3, zu L8 (Vollmachten der Verwaltung, B4), aus dem Code
 * erzeugt wie `pruefdatei-f4c-l6.ts` (Auftrag F4c, Blöcke 4 und 5).
 *
 * Gezeigt wird zu L7, je Wahl («Zählt mit», «Zählt nicht mit») und je Lage:
 * die Seite «Lesarten», der Satz an die Leitung vor dem Eröffnen, die Zeile
 * im Protokoll am Beschluss und die Absage beim Eröffnen. Eine Gemeinschaft
 * mit vier Eigentümern zu 300, 300, 200 und 200 von 1000 an einer ersten
 * Versammlung: Sind die ersten beiden da, genügt das knapp (zwei von vier
 * Eigentümern, 600 von 1000 Wertquoten); steht der zweite im Ausstand, wäre
 * die Versammlung ohne ihn nicht beschlussfähig. Sind alle vier da, genügt
 * die Beschlussfähigkeit auch ohne die Person im Ausstand. Ob ein Satz in
 * einer Lage erscheint, rechnet die Datei mit denselben Kernfunktionen wie
 * die Anwendung (`ausstandsbefund`, `ausstandFehlteAmBeschluss`), nicht von
 * Hand (Gegenprüfung Lauf 1, 06.11.2026).
 *
 * Zu L8, je Wahl («Vollmachten ruhen», «Die Sitzungsleitung entscheidet»)
 * und je Lage: der Katalog, ob die Stimme zählt, die die Verwaltung mit
 * einer Vollmacht abgibt, das Ergebnis, der Satz an die Leitung vor dem
 * Eröffnen, der Satz in der Einladung, das zweite Ergebnis nach der
 * anderen Wahl und die Zeilen im Protokoll zu den ruhenden Vollmachten;
 * dazu die Absagen am Häkchen an Wahl, erweiterter Wahl und Abberufung,
 * die Absage nach der Freigabe und die beiden Hilfetexte am Häkchen der
 * Vollmacht. Sieben Lagen: gekennzeichnet mit ruhender Vollmacht und
 * offenem Ergebnis; gekennzeichnet, beide Grenzen tragen das Ergebnis
 * (vier Anwesende); gekennzeichnet, die vertretene Partei selbst da (M2);
 * gekennzeichnet ohne Vollmacht; nicht gekennzeichnet; erklärter Ausstand;
 * Wiederwahl nach der Freigabe am Traktandum mit Häkchen (Entscheid 8,
 * Lauf 4: Das Häkchen wirkt an den Wahlknoten nicht, die Stimme zählt, und
 * der Satz an die Leitung heisst «Wahl trotz Häkchen»).
 * Drei Eigentümer zu 400, 300 und 300 von 1000 (in der Lage mit vier
 * Anwesenden: 400, 300, 200 und 100); die Grosse Verwaltung AG ist die
 * Verwaltung der Gemeinschaft und hält die Vollmacht von Hans Probe. Das
 * Traktandum ist ihre Entlastung (`k-decharge`, einfaches Mehr der
 * Anwesenden), in der Lage zur Wiederwahl ihre Wahl
 * (`k-bewirtschaftung-waehlen`). Erika Beispiel stimmt zu, Kurt Beispiel
 * lehnt ab; die Verwaltung gibt für Hans Probe eine Stimme ab, wo die
 * Stimmsperre sie annimmt. Unter «Die Sitzungsleitung entscheidet» rechnen
 * zwei Lagen mit Summen (`zaehleSummenAus`, H1 und N-4 aus Lauf 4): In der
 * einen lässt sich das zweite Ergebnis nicht bestimmen, weil die Dreizahl
 * nicht sagt, wessen Hand die Stimme war; in der anderen tragen beide
 * Grenzen das Ergebnis, und der Satz sagt «dasselbe Ergebnis». Je Lage
 * steht dazu seit Lauf 4 (M-2, M-4), wo B3 ein zweites Ergebnis liefert,
 * dessen Satz an die Leitung und seine Zeile im Protokoll, und die Zeile,
 * die Auswertungsseite, Auswertungs-PDF und Stimmnachweis drucken; seit
 * Lauf 5 (M-5) auch die Hinweise der Auszählung zu den ruhenden
 * Vollmachten, die Sätze aus `ruhendInWorten`, in den Lagen, in denen sie
 * entstehen. Abschnitt 8 nennt seit Lauf 5 die Absagen beim Zurücknehmen
 * eines Ausstands aus L8 und beim Kennzeichnen während einer offenen
 * Abstimmung (H-1). Abschnitt 9 (Entscheid 0045, Punkt 9, 07.11.2026) zeigt
 * den Ausweg am Abend über Folgeanträge: die Sätze vor dem Eröffnen je Lage
 * aus derselben Funktion wie die Leitungsseiten, auch mit vorab erklärtem
 * Ausstand an der Wahl, die Sperre am Grundantrag, die Zeilen im Protokoll
 * und die Handzählung mit Summen, bei der die eigene Zählung «abgelehnt»
 * lautet (Laien- und Fachprüfung Runde 4: beide Sätze in keiner Lage).
 * Ob die Stimme zählt und welche Sätze stehen, rechnet die Datei mit
 * denselben Kernfunktionen wie die Anwendung (`zaehleAus` mit dem Ausstand
 * aus L8, `zaehleSummenAus` für die Handzählung), nicht von Hand.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-f4c-b2-b4.ts > <ziel>.md
 */
import { LESARTEN_VORGABE, lesartVon } from '$lib/domain/lesarten';
import {
	AUSSTAND_NICHT_BESCHLUSSFAEHIG,
	AUSSTAND_ZAEHLT_LEITUNG,
	VERWALTUNG_AUSSTAND_NICHT_ZURUECK,
	VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG,
	VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN,
	VERWALTUNG_HAKEN_ABSAGE_WAHL,
	VERWALTUNG_HAKEN_HILFE_EIGENTUEMER,
	VERWALTUNG_HAKEN_HILFE_LEITUNG,
	VERWALTUNG_KENNZEICHNUNG_GESPERRT,
	VERWALTUNG_LEITUNG_LEITUNG,
	VERWALTUNG_RUHEN_LEITUNG,
	VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG,
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	AUSSTAND_NICHT_GEERBT,
	verwaltungssaetzeVorDemEroeffnen,
	verwaltungssatzEinladung
} from '$lib/domain/mehrhinweise';
import { teilentschiedenSatz } from '$lib/domain/abstimmung';
import { folgeantraegeAngenommenSatz, teileEntschiedenSatz } from '$lib/domain/protokoll';
import { quittungVonHand, VON_HAND_AUSSTAND_RISIKO } from '$lib/domain/vonhand';
import { ausstandsbefund, beteiligungDerAnwesenden, beteiligungOhneAusstand } from '$lib/domain/anwesenheit';
import { ausstandFehlteAmBeschluss, ausstandFehlteSatz } from '$lib/domain/protokoll';
import type { Ausstandsbeschlussfaehigkeit, Verwaltungsvollmachtwahl } from '$lib/domain/lesarten';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { bedingungInWorten, stelleBeschlussfaehigkeitFest } from '$lib/domain/beschlussfaehigkeit';
import {
	andereLesartInWorten,
	andereLesartenVon,
	zweitesErgebnisImProtokoll,
	ergebnisInWorten,
	zaehleAus,
	zaehleSummenAus,
	type Vertretung
} from '$lib/domain/auszaehlung';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { vertreterkennung } from '$lib/domain/vollmacht';
import { holeRegelwerk } from '$lib/rules';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

/** Vier Eigentümer zu 300, 300, 200 und 200 von 1000. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-06T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: ([
		['p1', 'Erika Beispiel', 300],
		['p2', 'Hans Probe', 300],
		['p3', 'Ida Muster', 200],
		['p4', 'Kurt Beispiel', 200]
	] as const).map(([partyId, displayName, quota]) => ({
		partyId,
		displayName,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${partyId}-u`, label: `Whg ${partyId}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};
const LISTE = stimmkraftliste(M);

/** p2 ist nur über die Vertreterin ohne Partei da (Migration 167, Ä-26). */
const UEBER_FREMDE: Vertretung[] = [
	{ vertreteneId: 'p2', bevollmaechtigtId: 'vertreter:grosse-verwaltung', bevollmaechtigtName: 'Grosse Verwaltung AG' }
];

/**
 * Die Beschlussfähigkeit einer Lage, in Worten, wie sie die Leitung liest.
 * Leer, wenn nichts fehlt.
 */
function befundInWorten(anwesende: readonly string[], ausstand: readonly string[], vertretungen: Vertretung[]): string {
	const b = stelleBeschlussfaehigkeitFest(
		'erste',
		beteiligungOhneAusstand(LISTE, anwesende, ausstand, vertretungen),
		null
	);
	return b.beschlussfaehig
		? `beschlussfähig (${b.bedingungen.map(bedingungInWorten).join('; ')})`
		: `nicht beschlussfähig (${b.fehlt})`;
}

aus('# Prüfdatei: Votum F4c, B2 und B4 (L7 Ausstand und Beschlussfähigkeit, L8 Vollmachten der Verwaltung)', '');
aus('Lauf 1 trägt die Abschnitte 1 bis 3 zu L7; die Läufe 2 bis 5 die Abschnitte 4 bis 8 zu L8.', '');

/*
 * Der Katalog, wie die Einstellungsseite ihn zeigt: Frage, Wahlen mit
 * Wirkung und Fundstelle, Grund der Vorgabe und Geltung.
 */
const l7 = lesartVon('L7')!;
aus('## 1. Katalog: Seite «Lesarten»', '');
aus(`- **Frage:** ${l7.frage}`);
for (const w of l7.wahlen) {
	aus(`- **Wahl «${w.bezeichnung}»${w.wert === l7.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung}`);
	aus(`  - Fundstelle: ${w.fundstelle}`);
}
aus(`- **Warum die Vorgabe:** ${l7.warumVorgabe}`);
aus(`- **Geltung:** ${l7.geltung}`, '');
aus('### Dazu L5, die Geltung mit dem geänderten Satz', '');
aus(`- **Geltung von L5:** ${lesartVon('L5')!.geltung}`, '');

interface Lage {
	titel: string;
	text: string;
	anwesende: string[];
	ausstand: string[];
	vertretungen: Vertretung[];
}

const LAGEN: Lage[] = [
	{
		titel: 'Die Beschlussfähigkeit hängt an den Personen im Ausstand',
		text: 'Erika Beispiel und Hans Probe sind da; Hans Probe steht im Ausstand.',
		anwesende: ['p1', 'p2'],
		ausstand: ['p2'],
		vertretungen: []
	},
	{
		titel: 'Die Partei ist nur über einen Vertreter im Ausstand vertreten',
		text: 'Erika Beispiel ist da; Hans Probe nur über die Grosse Verwaltung AG, die im Ausstand steht.',
		anwesende: ['p1', 'p2'],
		ausstand: ['vertreter:grosse-verwaltung'],
		vertretungen: UEBER_FREMDE
	},
	{
		titel: 'Genug weitere Eigentümer sind da oder vertreten',
		text: 'Alle vier sind da; Kurt Beispiel steht im Ausstand.',
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		ausstand: ['p4'],
		vertretungen: []
	},
	{
		titel: 'Niemand ist im Ausstand, und die Beschlussfähigkeit fehlt',
		text: 'Nur Erika Beispiel ist da; niemand steht im Ausstand.',
		anwesende: ['p1'],
		ausstand: [],
		vertretungen: []
	},
	{
		titel: 'Die Beschlussfähigkeit fehlt schon mit den Personen im Ausstand',
		text: 'Ida Muster und Kurt Beispiel sind da; Kurt Beispiel steht im Ausstand.',
		anwesende: ['p3', 'p4'],
		ausstand: ['p4'],
		vertretungen: []
	}
];

function mitInWorten(anwesende: readonly string[]): string {
	const b = stelleBeschlussfaehigkeitFest('erste', beteiligungDerAnwesenden(LISTE, anwesende), null);
	return b.beschlussfaehig
		? `beschlussfähig (${b.bedingungen.map(bedingungInWorten).join('; ')})`
		: `nicht beschlussfähig (${b.fehlt})`;
}

function zeileAmBeschluss(wahl: Ausstandsbeschlussfaehigkeit, l: Lage, angenommen: boolean): string | null {
	const f = ausstandFehlteAmBeschluss({
		wahl,
		stimmkraft: LISTE,
		anwesende: l.anwesende,
		vertretungen: l.vertretungen,
		ausstand: l.ausstand,
		stufe: 'erste',
		regel: null,
		auszaehlung: { angenommen, keinBeschluss: null }
	});
	return f ? ausstandFehlteSatz(f) : null;
}

/*
 * Je Wahl ein Abschnitt, je Lage die Sätze, die Votum in genau dieser Lage
 * zeigt.
 */
aus('## 2. Wahl «Zählt mit (Vorgabe)»', '');
for (const l of LAGEN) {
	const b = ausstandsbefund('erste', LISTE, l.anwesende, l.ausstand, l.vertretungen, null);
	aus(`### Lage: ${l.titel}`, '');
	aus(l.text);
	aus(`- **Mit den Personen im Ausstand:** ${mitInWorten(l.anwesende)}`);
	aus(`- **Ohne die Personen im Ausstand:** ${befundInWorten(l.anwesende, l.ausstand, l.vertretungen)}`);
	aus(
		b.haengtAmAusstand
			? `- **Satz an die Leitung vor dem Eröffnen:** ${AUSSTAND_ZAEHLT_LEITUNG}`
			: '- **Satz an die Leitung vor dem Eröffnen:** keiner; die Beschlussfähigkeit hängt nicht an den Personen im Ausstand.'
	);
	const z = zeileAmBeschluss('zaehlt', l, true);
	aus(z ? `- **Zeile im Protokoll am Beschluss:** ${z}` : '- **Zeile im Protokoll am Beschluss:** keine.', '');
}

aus('## 3. Wahl «Zählt nicht mit»', '');
for (const l of LAGEN) {
	const b = ausstandsbefund('erste', LISTE, l.anwesende, l.ausstand, l.vertretungen, null);
	aus(`### Lage: ${l.titel}`, '');
	aus(l.text);
	aus(`- **Mit den Personen im Ausstand:** ${mitInWorten(l.anwesende)}`);
	aus(`- **Ohne die Personen im Ausstand:** ${befundInWorten(l.anwesende, l.ausstand, l.vertretungen)}`);
	if (!b.haengtAmAusstand) {
		aus(
			b.ohne.beschlussfaehig
				? '- **Absage beim Eröffnen:** keine; der Durchgang öffnet.'
				: '- **Absage beim Eröffnen:** die gewöhnliche zur fehlenden Beschlussfähigkeit, nicht die zu L7.',
			''
		);
		continue;
	}
	aus(`- **Satz an die Leitung vor dem Eröffnen und Absage beim Eröffnen** (im Haus und am gemeinsamen Abend gleich): ${AUSSTAND_NICHT_BESCHLUSSFAEHIG}`);
	aus('- **Unverbindlich abstimmen:** nicht angeboten; ein Versuch über die Schnittstelle bekommt dieselbe Absage (Entscheid 0043).');
	aus(`- **Beschluss von Hand, Warnung vor dem Festhalten:** ${VON_HAND_AUSSTAND_RISIKO}`);
	aus(`- **Beschluss von Hand, Quittung danach:** ${quittungVonHand([{ kennung: 'ausstand_nicht_beschlussfaehig' }])}`);
	aus(`- **Zeile im Protokoll, Beschluss von Hand angenommen:** ${zeileAmBeschluss('zaehlt_nicht', l, true)}`);
	aus(`- **Zeile im Protokoll, Beschluss von Hand abgelehnt:** ${zeileAmBeschluss('zaehlt_nicht', l, false)}`, '');
}

/*
 * L8 (Lauf 3): dieselbe Verwaltung wie in den Lagen zu L7, eine kleinere
 * Gemeinschaft, damit die eine Stimme den Ausgang entscheidet. Drei
 * Eigentümer zu 400, 300 und 300 von 1000; Hans Probe (p2) hat der Grossen
 * Verwaltung AG eine Vollmacht gegeben, erfasst als Vertreterin ohne Partei
 * mit dem Häkchen «Bevollmächtigt ist die Verwaltung» (Migration 184). Das
 * Traktandum ist die Entlastung der Verwaltung (`k-decharge`, einfaches Mehr
 * der Anwesenden: mehr als die Hälfte, Enthaltungen und Nichtabgaben bleiben
 * in der Bezugsgrösse) und trägt das Häkchen am Traktandum. Erika Beispiel
 * stimmt zu, Kurt Beispiel lehnt ab.
 *
 * Unter der Vorgabe ruht die Vollmacht, und die Stimmsperre nimmt die Stimme
 * der Verwaltung nicht an (G3, 06.11.2026): Die vertretene Partei gilt in der
 * Zählung als nicht da, gezählt sind 1 Ja von 2, nötig 2, der Antrag ist
 * abgelehnt. Das zweite Ergebnis nennt die Grenzen (alle Ja, alle Nein;
 * Entscheid 2): Hier träte die eine Stimme den Ausgang, und er ist nicht
 * bestimmbar. Unter «Die Sitzungsleitung entscheidet» zählt die Stimme
 * (2 Ja von 3), und das zweite Ergebnis rechnet ohne sie.
 */
const RW = holeRegelwerk();
const DECHARGE = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-decharge')!);
// Entscheid 8 (Lauf 4): Die Wiederwahl der Verwaltung an einem Traktandum
// mit Häkchen, nach der Freigabe gestellt.
const WAHL = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-bewirtschaftung-waehlen')!);

/** Die Verwaltung als Vertreterin ohne Partei; die Kennung bildet der Server (G4, 06.11.2026). */
const VERWALTUNG = vertreterkennung('Grosse Verwaltung AG');
const VERWALTUNGSVOLLMACHT: Vertretung[] = [
	{ vertreteneId: 'p2', bevollmaechtigtId: VERWALTUNG, bevollmaechtigtName: 'Grosse Verwaltung AG' }
];

/** Drei Eigentümer zu 400, 300 und 300 von 1000. */
const DREI: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-06T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: (
		[
			['p1', 'Erika Beispiel', 400],
			['p2', 'Hans Probe', 300],
			['p3', 'Kurt Beispiel', 300]
		] as const
	).map(([partyId, displayName, quota]) => ({
		partyId,
		displayName,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${partyId}-u`, label: `Whg ${partyId}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};

/** Vier Eigentümer zu 400, 300, 200 und 100 von 1000, für die Lage mit dem gleichen Ergebnis. */
const VIER: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-06T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: (
		[
			['p1', 'Erika Beispiel', 400],
			['p2', 'Hans Probe', 300],
			['p3', 'Ida Muster', 200],
			['p4', 'Kurt Beispiel', 100]
		] as const
	).map(([partyId, displayName, quota]) => ({
		partyId,
		displayName,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `${partyId}-u`, label: `Whg ${partyId}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};

/**
 * Die Stimmen der Lage mit drei Eigentümern. `mitVerwaltungsStimme` nur, wo
 * die Stimmsperre die Stimme der Verwaltung annimmt: Unter der Vorgabe am
 * gekennzeichneten Traktandum nimmt sie sie nicht an (G3, 06.11.2026), und
 * die Verwaltung gibt keine ab.
 */
function entlastungsStimmen(mitVerwaltungsStimme: boolean): Vote[] {
	const wahlen: [string, VoteChoice][] = [
		['p1', 'yes'],
		['p3', 'no']
	];
	if (mitVerwaltungsStimme) wahlen.splice(1, 0, ['p2', 'yes']);
	return wahlen.map(([partyId, choice]) => ({
		partyId,
		unitId: `${partyId}-u`,
		choice,
		castAt: '2026-11-06T19:10:00.000Z',
		recordedByChair: false
	}));
}

/**
 * Die Stimmen der Lage mit vier Anwesenden: Die drei, die selbst da sind, stimmen zu,
 * die Verwaltung stimmt für Hans Probe mit Nein. Auch hier `mitVerwaltungsStimme`
 * nur, wo die Stimmsperre annimmt.
 */
function vierStimmen(mitVerwaltungsStimme: boolean): Vote[] {
	const wahlen: [string, VoteChoice][] = [
		['p1', 'yes'],
		['p3', 'yes'],
		['p4', 'yes']
	];
	if (mitVerwaltungsStimme) wahlen.splice(1, 0, ['p2', 'no']);
	return wahlen.map(([partyId, choice]) => ({
		partyId,
		unitId: `${partyId}-u`,
		choice,
		castAt: '2026-11-06T19:10:00.000Z',
		recordedByChair: false
	}));
}

interface Verwaltungslage {
	titel: string;
	text: string;
	/** Das Häkchen am Traktandum (concerns_management, Migration 184). */
	haekchen: boolean;
	/** Die Verwaltung hält die bestätigte Vollmacht von Hans Probe (holder_is_management). */
	vollmacht: boolean;
	/** Die Leitung hat den Ausstand der Verwaltung erklärt (recusal.holder_key, Migration 167). */
	erklaert: boolean;
	/** Hans Probe ist selbst da; seine Anwesenheit beruht dann nicht auf der Vollmacht (M2). */
	selbstDa: boolean;
	/** Vier Anwesende statt dreien, für die Lage mit dem gleichen Ergebnis. */
	vier: boolean;
	/**
	 * Entscheid 8 (Lauf 4): Das Erfordernis steht nach der Freigabe auf der
	 * Wahl der Verwaltung; das Häkchen wirkt dort nicht, und der Ausstand aus
	 * L8 bleibt aus, in beiden Wahlen der Lesart.
	 */
	wahlknoten?: boolean;
}

const VERWALTUNGSLAGEN: Verwaltungslage[] = [
	{
		titel: 'Das Traktandum ist gekennzeichnet, und die Verwaltung hält eine Vollmacht',
		text: 'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG, die seine Vollmacht hält. Das Traktandum trägt das Häkchen. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab.',
		haekchen: true,
		vollmacht: true,
		erklaert: false,
		selbstDa: false,
		vier: false
	},
	{
		titel: 'Das Traktandum ist gekennzeichnet, und beide Grenzen tragen das Ergebnis',
		text: 'Vier Eigentümer sind da: Erika Beispiel, Ida Muster und Kurt Beispiel selbst, Hans Probe nur über die Grosse Verwaltung AG, die seine Vollmacht hält. Das Traktandum trägt das Häkchen. Die drei, die selbst da sind, stimmen zu. Unter «Die Sitzungsleitung entscheidet» stimmt die Verwaltung für Hans Probe mit Nein.',
		haekchen: true,
		vollmacht: true,
		erklaert: false,
		selbstDa: false,
		vier: true
	},
	{
		titel: 'Die vertretene Partei ist selbst da',
		text: 'Erika Beispiel, Kurt Beispiel und Hans Probe sind selbst da. Hans Probe hat der Grossen Verwaltung AG ausserdem eine Vollmacht gegeben; sie ist bestätigt, aber seine Anwesenheit beruht nicht auf ihr. Das Traktandum trägt das Häkchen. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab, Hans Probe enthält sich.',
		haekchen: true,
		vollmacht: true,
		erklaert: false,
		selbstDa: true,
		vier: false
	},
	{
		titel: 'Das Traktandum ist gekennzeichnet, die Verwaltung hält keine Vollmacht',
		text: 'Erika Beispiel und Kurt Beispiel sind da; Hans Probe ist abwesend und hat niemanden bevollmächtigt. Das Traktandum trägt das Häkchen. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab.',
		haekchen: true,
		vollmacht: false,
		erklaert: false,
		selbstDa: false,
		vier: false
	},
	{
		titel: 'Das Traktandum ist nicht gekennzeichnet, die Verwaltung hält eine Vollmacht',
		text: 'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG. Das Traktandum trägt kein Häkchen. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab; die Verwaltung stimmt für Hans Probe mit Ja, und ihre Stimme zählt.',
		haekchen: false,
		vollmacht: true,
		erklaert: false,
		selbstDa: false,
		vier: false
	},
	{
		titel: 'Die Sitzungsleitung hat den Ausstand der Verwaltung erklärt',
		text: 'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG. Das Traktandum trägt das Häkchen, und die Leitung hat den Ausstand der Verwaltung erklärt. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab.',
		haekchen: true,
		vollmacht: true,
		erklaert: true,
		selbstDa: false,
		vier: false
	},
	{
		titel: 'Wiederwahl nach der Freigabe',
		text: 'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG, die seine Vollmacht hält. Das Traktandum trägt das Häkchen, und nach der Freigabe steht sein Erfordernis auf der Wiederwahl der Verwaltung. Erika Beispiel stimmt zu, Kurt Beispiel lehnt ab; die Verwaltung stimmt für Hans Probe mit Ja, und ihre Stimme zählt.',
		haekchen: true,
		vollmacht: true,
		erklaert: false,
		selbstDa: false,
		vier: false,
		wahlknoten: true
	}
];

/*
 * Was der Server je Lage einfriert (`leseSchlussstand`): Das Merkmal aus L8
 * nur bei Häkchen und bestätigter Vollmacht und ohne erklärten Ausstand; der
 * erklärte Ausstand steht in beiden Wahlen in der Liste, nach der gerechnet
 * wird, und das Merkmal trägt nur, was ohne Erklärung ruht. Die vertretene
 * Partei, die selbst da ist, bleibt hier unberücksichtigt: `leseVertretungen`
 * führt ihre Vollmacht nicht, und der Kern filtert das Merkmal gegen die
 * wirksamen Vertretungen (M2).
 */
function ausstandAusL8(l: Verwaltungslage): string[] {
	// Entscheid 8 (Lauf 4): An den Wahlknoten liefert der Server kein Merkmal
	// (`leseVerwaltungsausstandIn`), und die Datei friert keins ein.
	return l.haekchen && l.vollmacht && !l.erklaert && !l.wahlknoten ? [VERWALTUNG] : [];
}

const l8 = lesartVon('L8')!;

/*
 * Der Katalog zu L8, wie die Einstellungsseite ihn zeigt (Abschnitt 4, an
 * der Stelle von Abschnitt 1 zu L7).
 */
aus('## 4. Katalog zu L8: Seite «Lesarten»', '');
aus(`- **Frage:** ${l8.frage}`);
for (const w of l8.wahlen) {
	aus(`- **Wahl «${w.bezeichnung}»${w.wert === l8.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung}`);
	aus(`  - Fundstelle: ${w.fundstelle}`);
}
aus(`- **Warum die Vorgabe:** ${l8.warumVorgabe}`);
aus(`- **Geltung:** ${l8.geltung}`, '');

/*
 * Je Wahl ein Abschnitt, je Lage die Sätze und Zahlen, die Votum in genau
 * dieser Lage zeigt. Das Ergebnis und das zweite Ergebnis rechnet die Datei
 * mit denselben Kernfunktionen wie die Anwendung (`zaehleAus` mit dem
 * Ausstand aus L8 in `imAusstand` unter der Vorgabe und dem Merkmal in
 * `ausstandAusVerwaltung` in beiden Wahlen), nicht von Hand.
 */
for (const [abschnitt, wahl] of [
	[5, 'ruhen'],
	[6, 'leitung']
] as const) {
	const w = l8.wahlen.find((x) => x.wert === wahl)!;
	aus(`## ${abschnitt}. Wahl «${w.bezeichnung}${wahl === l8.vorgabe ? ' (Vorgabe)' : ''}»`, '');
	for (const l of VERWALTUNGSLAGEN) {
		const ausL8 = ausstandAusL8(l);
		const imAusstand = [...(l.erklaert ? [VERWALTUNG] : []), ...(wahl === 'ruhen' ? ausL8 : [])];
		const moment = l.vier ? VIER : DREI;
		// Ist die Partei selbst da, beruht ihre Anwesenheit nicht auf der
		// Vollmacht; `leseVertretungen` führt sie deshalb nicht (M2).
		const vertretungen = l.vollmacht && !l.selbstDa ? VERWALTUNGSVOLLMACHT : [];
		const anwesende = l.selbstDa
			? ['p1', 'p2', 'p3']
			: l.vollmacht
				? l.vier
					? ['p1', 'p2', 'p3', 'p4']
					: ['p1', 'p2', 'p3']
				: l.vier
					? ['p1', 'p3', 'p4']
					: ['p1', 'p3'];
		// Die Stimme der Verwaltung steht nur in der Zählung, wo die
		// Stimmsperre sie annimmt: nicht am gekennzeichneten Traktandum unter
		// der Vorgabe (G3) und nicht bei erklärtem Ausstand.
		const mitVerwaltungsStimme =
			l.vollmacht &&
			!l.selbstDa &&
			!l.erklaert &&
			(wahl === 'leitung' || !l.haekchen || !!l.wahlknoten);
		const stimmen = l.selbstDa
			? [
					...entlastungsStimmen(false),
					{ partyId: 'p2', unitId: 'p2-u', choice: 'abstain' as VoteChoice, castAt: '2026-11-06T19:10:00.000Z', recordedByChair: false }
				]
			: l.vier
				? vierStimmen(mitVerwaltungsStimme)
				: entlastungsStimmen(mitVerwaltungsStimme);
		// Entscheid 8 (Lauf 4): In der Lage der Wiederwahl steht das Erfordernis
		// auf dem Wahlknoten; die Datei rechnet mit demselben, das die Anwendung
		// einfriert, nicht mit der Entlastung der übrigen Lagen.
		const erfordernis = l.wahlknoten ? WAHL : DECHARGE;
		const a = zaehleAus({
			momentaufnahme: { ...moment, lesarten: { ...LESARTEN_VORGABE, L8: wahl } },
			erfordernis,
			stimmen,
			anwesende,
			vertretungen,
			imAusstand,
			ausstandAusVerwaltung: ausL8
		});
		aus(`### Lage: ${l.titel}`, '');
		aus(l.text);
		const stimme = !l.vollmacht
			? 'gibt keine ab; Hans Probe hat niemanden bevollmächtigt.'
			: l.selbstDa
				? 'gibt keine ab; Hans Probe ist selbst da und stimmt selbst.'
				: l.erklaert
					? 'gibt keine ab; die Sitzungsleitung hat den Ausstand der Verwaltung erklärt.'
					: wahl === 'ruhen' && l.haekchen && !l.wahlknoten
						? 'gibt keine ab; die Stimmsperre nimmt sie nicht an, weil die Vollmacht nach der Einstellung der Gemeinschaft ruht.'
						: l.wahlknoten
							? 'zählt; das Erfordernis steht auf der Wahl der Verwaltung, und dort ruhen die Vollmachten nicht (Entscheid 8), obwohl das Traktandum das Häkchen trägt.'
							: 'zählt; ' +
							(l.haekchen
								? 'die Sitzungsleitung hat den Ausstand der Verwaltung nicht erklärt, und ohne ihn ruhen die Vollmachten nicht.'
								: 'das Traktandum ist nicht als Geschäft der Verwaltung gekennzeichnet.');
		aus(`- **Die Stimme, die die Verwaltung für Hans Probe abgibt:** ${stimme}`);
		aus(`- **Ergebnis:** ${ergebnisInWorten(a, erfordernis)}`);
		const leitungssatz =
			l.wahlknoten && l.vollmacht && !l.selbstDa && !l.erklaert
				? wahl === 'ruhen'
					? VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN
					: VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG
				: ausL8.length > 0 && !l.selbstDa
					? wahl === 'ruhen'
						? VERWALTUNG_RUHEN_LEITUNG
						: VERWALTUNG_LEITUNG_LEITUNG
					: `keiner; ${
						!l.haekchen
							? 'das Traktandum trägt kein Häkchen'
							: l.selbstDa
								? 'die Anwesenheit von Hans Probe beruht nicht auf der Vollmacht'
								: l.erklaert
									? 'die Vollmacht ruht über den erklärten Ausstand, und das Merkmal aus L8 trägt nur, was ohne Erklärung ruht'
									: 'die Verwaltung hält keine Vollmacht'
					}.`;
		aus(`- **Satz an die Leitung vor dem Eröffnen:** ${leitungssatz}`);
		// Dieselbe Satzwahl wie die Einladung (G7, 08.11.2026), nicht nachgebaut.
		const einladungssatz =
			verwaltungssatzEinladung(wahl, l.haekchen) ?? 'keiner; das Traktandum trägt kein Häkchen.';
		aus(`- **Satz in der Einladung:** ${einladungssatz}`);
		// Entscheid 8 (Lauf 4): die Zeile am Beschluss im Protokoll, nur unter
		// der Vorgabe; unter «Die Sitzungsleitung entscheidet» sagt die
		// Einladung auch seit G7 nur, dass die Leitung entscheidet, also nichts,
		// dem die Zählung an der Wahl widerspricht.
		if (l.wahlknoten) {
			aus(
				`- **Zeile im Protokoll am Beschluss:** ${
					wahl === 'ruhen' ? VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL : 'keine; sie steht nur unter der Vorgabe «Vollmachten ruhen».'
				}`,
				''
			);
		}
		const zweite = a.andereVerwaltungsvollmacht;
		if (zweite) {
			const worte = andereLesartInWorten(zweite, false);
			aus(`- **Zweites Ergebnis, an die Leitung:** ${worte.leitung}`);
			// Die Zeile steht nur im Protokoll, wo der Kern sie anfügt: bei
			// Abweichung oder wo sich das Ergebnis nicht bestimmen lässt.
			// Unter der Vorgabe trägt das Protokoll gar kein zweites Ergebnis
			// (Entscheid 3), nur die Tatsachenzeile unten.
			const protokollzeile =
				worte.protokoll && (zweite.abweichend || !zweite.feststellbar)
					? worte.protokoll
					: zweite.ruhendeVollmachten !== undefined
						? 'keine; unter der Vorgabe trägt das Protokoll kein zweites Ergebnis (Entscheid 3, 06.11.2026).'
						: 'keine; das andere Ergebnis weicht nicht ab.';
			aus(`- **Zweites Ergebnis, Zeile im Protokoll:** ${protokollzeile}`, '');
		} else {
			aus(
				`- **Zweites Ergebnis:** keins; ${
					l.erklaert
						? 'der erklärte Ausstand wirkt nach beiden Wahlen gleich'
						: l.selbstDa
							? 'die Anwesenheit von Hans Probe beruht nicht auf der Vollmacht, und ohne wirksame Vertretung ruht nichts'
							: !l.haekchen
								? 'das Traktandum ist nicht als Geschäft der Verwaltung gekennzeichnet'
								: l.wahlknoten
									? 'das Erfordernis steht auf der Wahl der Verwaltung, und dort ruhen die Vollmachten nicht (Entscheid 8)'
									: 'die Verwaltung hält keine Vollmacht, für die das Ruhen etwas änderte'
				}.`,
				''
			);
		}
		// M-2 (Lauf 4): B3 bleibt an Traktanden mit Ausstand aus L8 bestehen,
		// wie bei einem erklärten Ausstand; wo er ein zweites Ergebnis liefert,
		// zeigt die Datei seinen Satz an die Leitung und seine Zeile im Protokoll.
		if (a.vertretungImAusstand) {
			const b3 = andereLesartInWorten(a.vertretungImAusstand, false);
			aus(`- **B3, Satz an die Leitung:** ${b3.leitung}`);
			aus(
				`- **B3, Zeile im Protokoll:** ${b3.protokoll ?? 'keine; das Ergebnis wäre dasselbe.'}`,
				''
			);
		}
		// M-4 (Lauf 4): die Zeile, die Auswertungsseite, Auswertungs-PDF und
		// Stimmnachweis drucken; seit «Texte nach 0047», Punkt 2, nur, wo auch das
		// Hausprotokoll ein zweites Ergebnis nennt (`zweitesErgebnisImProtokoll`).
		const auswertungszeile = andereLesartenVon(a)
			.filter(zweitesErgebnisImProtokoll)
			.map((r) => andereLesartInWorten(r, false).protokoll)
			.filter((t): t is string => t !== null)
			.join(' ');
		aus(`- **Zeile in der Auswertung:** ${auswertungszeile || 'keine.'}`, '');
		// Die Zeilen im Protokoll zur Bezugsgrösse: bei L8 die Tatsachenzeile
		// (Entscheid 3), beim erklärten Ausstand die gewöhnliche zur ruhenden
		// Vollmacht. In diesen Lagen steht dort nichts anderes.
		const zeilenImProtokoll = (a.protokollhinweise ?? [])
			.filter((h) => h.ort === 'bezugsgroesse')
			.map((h) => h.satz);
		aus(
			`- **Zeilen im Protokoll zu den ruhenden Vollmachten:** ${
				zeilenImProtokoll.length > 0 ? zeilenImProtokoll.join(' ') : 'keine.'
			}`,
			''
		);
		/*
		 * M-5 (Lauf 5, 07.11.2026): die Sätze aus `ruhendInWorten`, die
		 * Hinweise der Auszählung, in den Lagen, in denen sie entstehen: An der
		 * ruhenden Vertretung aus L8 steht der eigene Satz, der die Einstellung
		 * der Gemeinschaft nennt, beim erklärten Ausstand der gewöhnliche mit
		 * BGE 134 III 481 E. 3.8; in den übrigen Lagen steht keiner.
		 */
		aus(`- **Hinweise der Auszählung:** ${a.hinweise.join(' ') || 'keine.'}`, '');
	}
	/*
	 * Unter «Die Sitzungsleitung entscheidet» mit Summen (H1, 06.11.2026):
	 * Die Hände der Verwaltung stehen in der Dreizahl, ohne dass sie jemand
	 * zuordnen könnte; das zweite Ergebnis ist nicht feststellbar, und der
	 * Durchgang schliesst.
	 */
	if (wahl === 'leitung') {
		const ausL8 = [VERWALTUNG];
		const a = zaehleSummenAus(
			{
				momentaufnahme: { ...DREI, lesarten: { ...LESARTEN_VORGABE, L8: wahl } },
				erfordernis: DECHARGE,
				anwesende: ['p1', 'p2', 'p3'],
				vertretungen: VERWALTUNGSVOLLMACHT,
				imAusstand: [],
				ausstandAusVerwaltung: ausL8
			},
			{ ja: 2, nein: 1, enthaltung: 0 }
		);
		aus('### Lage: Handzählung mit Summen', '');
		aus(
			'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG. ' +
				'Das Traktandum trägt das Häkchen. Von Hand gezählt: 2 Ja, 1 Nein, keine Enthaltung; die ' +
				'Ja-Stimme der Verwaltung für Hans Probe ist mitgezählt, ohne dass die Dreizahl sagt, wessen Hand es war.'
		);
		aus(`- **Ergebnis:** ${ergebnisInWorten(a, DECHARGE)}`);
		const zweite = a.andereVerwaltungsvollmacht!;
		const worte = andereLesartInWorten(zweite, false);
		aus(`- **Zweites Ergebnis, an die Leitung:** ${worte.leitung}`);
		aus(`- **Zweites Ergebnis, Zeile im Protokoll:** ${worte.protokoll}`, '');
		aus(
			`- **Zeile in der Auswertung:** ${
				andereLesartenVon(a)
					.filter(zweitesErgebnisImProtokoll)
					.map((r) => andereLesartInWorten(r, false).protokoll)
					.filter((t): t is string => t !== null)
					.join(' ') || 'keine.'
			}`,
			''
		);
		/*
		 * N-4 (Lauf 4): Dieselbe Dreizahl, die Ja-Stimme der Verwaltung diesmal
		 * in der Minderheit. Beide Grenzen rechnen abgelehnt wie die eigene
		 * Zählung, und statt «nicht bestimmbar» sagt der Satz «dasselbe
		 * Ergebnis»; das Protokoll trägt ihn nicht, weil nichts abweicht.
		 */
		const b = zaehleSummenAus(
			{
				momentaufnahme: { ...DREI, lesarten: { ...LESARTEN_VORGABE, L8: wahl } },
				erfordernis: DECHARGE,
				anwesende: ['p1', 'p2', 'p3'],
				vertretungen: VERWALTUNGSVOLLMACHT,
				imAusstand: [],
				ausstandAusVerwaltung: ausL8
			},
			{ ja: 1, nein: 2, enthaltung: 0 }
		);
		aus('### Lage: Handzählung mit Summen, beide Grenzen tragen das Ergebnis', '');
		aus(
			'Erika Beispiel und Kurt Beispiel sind selbst da; Hans Probe nur über die Grosse Verwaltung AG. ' +
				'Das Traktandum trägt das Häkchen. Von Hand gezählt: 1 Ja, 2 Nein, keine Enthaltung; die ' +
				'Ja-Stimme der Verwaltung für Hans Probe ist mitgezählt, ohne dass die Dreizahl sagt, wessen Hand es war.'
		);
		aus(`- **Ergebnis:** ${ergebnisInWorten(b, DECHARGE)}`);
		const zweiteB = b.andereVerwaltungsvollmacht!;
		const worteB = andereLesartInWorten(zweiteB, false);
		aus(`- **Zweites Ergebnis, an die Leitung:** ${worteB.leitung}`);
		aus(
			`- **Zweites Ergebnis, Zeile im Protokoll:** ${worteB.protokoll ?? 'keine; das andere Ergebnis weicht nicht ab.'}`,
			''
		);
		aus(
			`- **Zeile in der Auswertung:** ${
				andereLesartenVon(b)
					.filter(zweitesErgebnisImProtokoll)
					.map((r) => andereLesartInWorten(r, false).protokoll)
					.filter((t): t is string => t !== null)
					.join(' ') || 'keine.'
			}`,
			''
		);
	}
}

/*
 * Die Absagen am Häkchen am Traktandum (G1, 06.11.2026): im Entwurf je Knoten
 * Wahl und Abberufung, nach der Freigabe eine eigene; dazu die beiden
 * Hilfetexte am Häkchen der Vollmacht (M5). Die Titel liest die Datei aus
 * dem Regelwerk; dieselben Sätze zeigen die Masken.
 */
aus('## 7. Die Absagen am Häkchen am Traktandum und die Hilfetexte', '');
aus(
	'Das Häkchen «Es geht um die Entschädigung der Verwaltung, einen Vertrag mit ihr oder ihre ' +
		'Entlastung» nimmt die Maske nicht an, solange das Erfordernis auf einem dieser Knoten steht; ' +
		'umgekehrt nimmt sie das Erfordernis dort nicht an, solange das Häkchen steht:',
	''
);
for (const id of ['k-bewirtschaftung-waehlen', 'k-bewirtschaftung-waehlen-erweitert', 'k-bewirtschaftung-abberufen']) {
	const k = RW.knoten.find((x) => x.id === id)!;
	aus(`- «${k.titel}» (\`${id}\`)`);
}
aus('', '');
aus('Die Absage im Entwurf, an Wahl und erweiterter Wahl (Kennung `verwaltungsgeschaeft_am_wahlknoten`):', '');
aus(`- **Wortlaut:** ${VERWALTUNG_HAKEN_ABSAGE_WAHL}`, '');
aus('Die Absage im Entwurf, an der Abberufung:', '');
aus(`- **Wortlaut:** ${VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG}`, '');
aus(
	'Die Absage nach der Freigabe, nur noch an der Abberufung (Entscheid 8, 07.11.2026): Wahl und ' +
		'Wiederwahl nimmt die Maske trotz Häkchen an, und ihre Vollmachten zählen;',
	''
);
aus(`- **Wortlaut:** ${VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN}`, '');
aus('Der Hilfetext am Häkchen der Vollmacht, wo die Leitung sie erfasst (Vollmachten, Einlass durch Dritte):', '');
aus(`- **Wortlaut:** ${VERWALTUNG_HAKEN_HILFE_LEITUNG}`, '');
aus('Der Hilfetext am Häkchen der Vollmacht, wo die Eigentümerin oder der Eigentümer sie selbst erklärt (unter `/z/`):', '');
aus(`- **Wortlaut:** ${VERWALTUNG_HAKEN_HILFE_EIGENTUEMER}`, '');

/*
 * Die beiden Absagen aus Lauf 5 (07.11.2026): beim Zurücknehmen eines Ausstands
 * aus L8 und beim Kennzeichnen einer Vollmacht, solange an einem Traktandum
 * mit Häkchen abgestimmt wird (H-1). Dieselben Sätze zeigen Maske und Server.
 */
aus('## 8. Die Absagen beim Zurücknehmen und beim Kennzeichnen (Lauf 5)', '');
aus(
	'Die Absage, wenn die Leitung einen Ausstand aus L8 zurücknehmen will; er folgt aus der ' +
		'Einstellung der Gemeinschaft und steht in keiner Zeile der Tabelle (Kennung ' +
		'`ausstand_aus_einstellung`):',
	''
);
aus(`- **Wortlaut:** ${VERWALTUNG_AUSSTAND_NICHT_ZURUECK}`, '');
aus(
	'Die Absage, wenn die Kennzeichnung einer Vollmacht geändert würde, solange an einem ' +
		'Traktandum mit Häkchen abgestimmt wird; sie gilt für das Kennzeichnen und für die ' +
		'Übernahme beim Einlass (Kennung `durchgang_offen`, H-1):',
	''
);
aus(`- **Wortlaut:** ${VERWALTUNG_KENNZEICHNUNG_GESPERRT}`, '');

/*
 * Entscheid 0045, Punkt 9 (07.11.2026), und die Satzbefunde der Runde 4:
 * die Sätze vor dem Eröffnen je Lage aus derselben Funktion wie die beiden
 * Leitungsseiten (`verwaltungssaetzeVorDemEroeffnen`), die Sperre am
 * Grundantrag, die Zeilen im Protokoll und die Handzählung mit Summen, bei
 * der die eigene Zählung «abgelehnt» lautet und sich das zweite Ergebnis
 * nicht bestimmen lässt (Laien- und Fachprüfung Runde 4: in keiner Lage).
 */
aus('## 9. Der Ausweg am Abend über Folgeanträge (Entscheid 0045, Punkt 9)', '');
aus(
	'Das Traktandum trägt das Häkchen, und nach der Freigabe zeigt sich, dass es auch eine Wahl, ' +
		'Wiederwahl oder Abberufung der Verwaltung enthält. Die Leitung teilt es mit «Gegenantrag» in ' +
		'Folgeanträge auf; diese übernehmen das Häkchen. Die Grosse Verwaltung AG hält die Vollmacht von ' +
		'Hans Probe und ist im Saal.',
	''
)
const lagen9: { titel: string; wahl: 'ruhen' | 'leitung'; wahlTrotzHaekchen: boolean; ausstandErklaert: boolean; abberufungTrotzHaekchen: boolean; amFolgeantrag?: boolean }[] = [];
for (const wahl of ['ruhen', 'leitung'] as const) {
	const bez = l8.wahlen.find((x) => x.wert === wahl)!.bezeichnung;
	lagen9.push(
		{ titel: `Wahl «${bez}», Grundantrag mit dem Erfordernis der Wahl`, wahl, wahlTrotzHaekchen: true, ausstandErklaert: false, abberufungTrotzHaekchen: false, amFolgeantrag: false },
		{ titel: `Wahl «${bez}», Folgeantrag zur Wahl`, wahl, wahlTrotzHaekchen: true, ausstandErklaert: false, abberufungTrotzHaekchen: false, amFolgeantrag: true },
		{ titel: `Wahl «${bez}», dasselbe, Ausstand der Verwaltung vorab erklärt`, wahl, wahlTrotzHaekchen: true, ausstandErklaert: true, abberufungTrotzHaekchen: false },
		{ titel: `Wahl «${bez}», Folgeantrag zur Abberufung, ohne erklärten Ausstand`, wahl, wahlTrotzHaekchen: false, ausstandErklaert: false, abberufungTrotzHaekchen: true }
	);
}
for (const l of lagen9) {
	aus(`### Lage: ${l.titel}`, '');
	aus(`- **Sätze an die Leitung vor dem Eröffnen:** ${verwaltungssaetzeVorDemEroeffnen(l, null).join(' ')}`, '');
}
aus('### Lage: Folgeantrag zur Entschädigung, zum Vertrag oder zur Entlastung', '');
aus(
	'- **Sätze an die Leitung vor dem Eröffnen:** dieselben wie an jedem Traktandum mit Häkchen ' +
		'(Abschnitte 5 und 6, erste Lage); das geerbte Häkchen wirkt dort.',
	''
);
aus('### Lage: der ursprüngliche Antrag, nachdem über einen Folgeantrag zur Wahl oder Abberufung entschieden ist', '');
aus('Der Satz an die Leitung vor dem Eröffnen ersetzt alle übrigen; dieselbe Absage beim Eröffnen (Kennung `teil_entschieden`).', '');
for (const [was, teil] of [
	['Wahl angenommen', { titel: 'Wiederwahl', art: 'wahl', angenommen: true }],
	['Wahl nicht angenommen', { titel: 'Wahl der Kleinen Verwaltung GmbH', art: 'wahl', angenommen: false }],
	['Abberufung angenommen', { titel: 'Abberufung per 31.12.', art: 'abberufung', angenommen: true }],
	['Abberufung nicht angenommen', { titel: 'Abberufung per 31.12.', art: 'abberufung', angenommen: false }]
] as const) {
	aus(`- **${was}:** ${teilentschiedenSatz([teil])}`);
}
aus('');
aus('### Lage: Folgeantrag, dessen ursprünglicher Antrag einen erklärten Ausstand trägt', '');
aus(`- **Satz an die Leitung vor dem Eröffnen, zusätzlich:** ${AUSSTAND_NICHT_GEERBT}`, '');
aus('### Zeilen im Protokoll', '');
aus(
	`- **Beim ursprünglichen Antrag, ein Folgeantrag angenommen:** ${folgeantraegeAngenommenSatz([{ nummer: '3.1', titel: 'Wiederwahl' }])}`
);
aus(
	`- **Beim ursprünglichen Antrag, zwei angenommen:** ${folgeantraegeAngenommenSatz([
		{ nummer: '3.1', titel: 'Wiederwahl' },
		{ nummer: '3.2', titel: 'Entschädigung gemäss Offerte' }
	])}`
);
aus(
	`- **Beim ursprünglichen Antrag, die Wahl nicht angenommen, nichts angenommen:** ${teileEntschiedenSatz([{ nummer: '3.1', titel: 'Wiederwahl', art: 'wahl' }])}`
);
aus(
	`- **Beim Folgeantrag zur Wahl, unter der Vorgabe:** ${VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL}`
);
aus(
	`- **Beim Folgeantrag zur Abberufung, unter der Vorgabe, ohne erklärten Ausstand:** ${VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL}`
);
aus(
	`- **Dasselbe, mit erklärtem Ausstand der Verwaltung:** ${VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL}`,
	''
);

{
	const ausL8 = [VERWALTUNG];
	const c = zaehleSummenAus(
		{
			momentaufnahme: { ...VIER, lesarten: { ...LESARTEN_VORGABE, L8: 'leitung', L11: 'qualifiziert', L12: 'alle' } },
			erfordernis: DECHARGE,
			anwesende: ['p1', 'p2', 'p3', 'p4'],
			vertretungen: VERWALTUNGSVOLLMACHT,
			imAusstand: [],
			ausstandAusVerwaltung: ausL8
		},
		{ ja: 2, nein: 2, enthaltung: 0 }
	);
	const zweite = c.andereVerwaltungsvollmacht!;
	aus('### Lage: Wahl «Die Sitzungsleitung entscheidet», Handzählung mit Summen, eigene Zählung abgelehnt', '');
	aus(
		'Vier Anwesende wie in der Lage «beide Grenzen tragen das Ergebnis» der Abschnitte 5 und 6; Hans ' +
			'Probe nur über die Grosse Verwaltung AG. Das Traktandum trägt das Häkchen. Von Hand gezählt: 2 Ja, ' +
			'2 Nein, keine Enthaltung; die Hand der Verwaltung für Hans Probe steckt in einer der beiden Zahlen.'
	);
	aus(`- **Ergebnis:** ${ergebnisInWorten(c, DECHARGE)}`);
	const worte = andereLesartInWorten(zweite, false);
	aus(`- **Zweites Ergebnis, an die Leitung:** ${worte.leitung}`);
	aus(`- **Zweites Ergebnis, Zeile im Protokoll:** ${worte.protokoll ?? 'keine; das andere Ergebnis weicht nicht ab.'}`, '');
}

console.log(zeilen.join('\n'));
