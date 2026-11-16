/**
 * Lesart L8 im Kern (Migration 184, Einteilung F3b, B4; Lauf 3): Katalog, die
 * zwei Häkchen, die Stimme der Verwaltung je Wahl und Lage, die Grenzen unter
 * der Vorgabe (Entscheid 2), die Tatsachenzeile im Protokoll (Entscheid 3),
 * M2, die Handzählung (H1) und das zweite Ergebnis nach der anderen Wahl. Die
 * Sperre am Häkchen, das Einfrieren und die Sätze an der Leitung prüft
 * `tests/db/lesart-verwaltungsvollmacht.test.ts` am echten Weg; die Lagen der
 * Sätze zeigt die Prüfdatei `scripts/pruefdatei-f4c-b2-b4.ts`.
 *
 * Drei Eigentümer zu 400, 300 und 300 von 1000 (in der Lage mit vier
 * Anwesenden: 400, 300, 200 und 100). Hans Probe (p2) hat der Grossen
 * Verwaltung AG eine Vollmacht gegeben; das Traktandum ist ihre Entlastung
 * (`k-decharge`, einfaches Mehr der Anwesenden: mehr als die Hälfte,
 * Enthaltungen und Nichtabgaben bleiben in der Bezugsgrösse). Erika Beispiel
 * stimmt zu, Kurt Beispiel lehnt ab; die Verwaltung gibt für Hans Probe eine
 * Stimme ab, wo die Stimmsperre sie annimmt.
 */
import { describe, expect, it } from 'vitest';
import { LESARTEN_VORGABE, lesartVon, pruefeLesartenwahl, wahlInWorten } from '$lib/domain/lesarten';
import {
	VERWALTUNG_AUSSTAND_NICHT_ZURUECK,
	VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG,
	VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN,
	VERWALTUNG_HAKEN_ABSAGE_WAHL,
	VERWALTUNG_HAKEN_HILFE_EIGENTUEMER,
	VERWALTUNG_HAKEN_HILFE_LEITUNG,
	VERWALTUNG_KENNZEICHNUNG_GESPERRT,
	VERWALTUNG_LEITUNG_LEITUNG,
	VERWALTUNG_RUHEN_EINLADUNG,
	VERWALTUNG_LEITUNG_EINLADUNG,
	verwaltungssatzEinladung,
	VERWALTUNG_RUHEN_LEITUNG,
	VERWALTUNG_WAHL_AUSSTAND_ERKLAERT,
	VERWALTUNG_WAHL_AUSSTAND_ERKLAERT_LEITUNG,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_LEITUNG,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN,
	AUSSTAND_NICHT_GEERBT,
	verwaltungWahlTrotzHakenRuhen,
	verwaltungssaetzeVorDemEroeffnen,
	VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG,
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN
} from '$lib/domain/mehrhinweise';
import { pruefeEingabe, vertreterkennung } from '$lib/domain/vollmacht';
import { legeTraktandumAn, pruefeTraktandum } from '$lib/domain/traktanden';
import { mitKeinemBeschluss } from '$lib/domain/auszaehlung';
import {
	andereLesartInWorten,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage,
	type Vertretung
} from '$lib/domain/auszaehlung';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

/** Drei Eigentümer zu 400, 300 und 300 von 1000. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-06T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	lesarten: LESARTEN_VORGABE,
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

/** Vier Eigentümer zu 400, 300, 200 und 100 von 1000, für die Grenzen mit gleichem Ergebnis. */
const VIER: Snapshot = {
	...M,
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

/** Die Verwaltung als Vertreterin ohne Partei, mit der Kennung, die der Server bildet (G4). */
const VERWALTUNG = vertreterkennung('Grosse Verwaltung AG');
const VERWALTUNGSVOLLMACHT: Vertretung[] = [
	{ vertreteneId: 'p2', bevollmaechtigtId: VERWALTUNG, bevollmaechtigtName: 'Grosse Verwaltung AG' }
];

const RW = holeRegelwerk();
const DECHARGE = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-decharge')!);
/** Entscheid 8 (Lauf 4): das Erfordernis der Wiederwahl der Verwaltung. */
const WAHL = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-bewirtschaftung-waehlen')!);

/**
 * Die Stimmen: Erika stimmt zu, Kurt lehnt ab; die Verwaltung gibt für Hans
 * Probe eine Ja-Stimme ab, wo die Stimmsperre sie annimmt.
 */
function stimmen(mitVollmacht: boolean): Vote[] {
	const wahlen: [string, VoteChoice][] = [
		['p1', 'yes'],
		['p3', 'no']
	];
	if (mitVollmacht) wahlen.splice(1, 0, ['p2', 'yes']);
	return wahlen.map(([partyId, choice]) => ({
		partyId,
		unitId: `${partyId}-u`,
		choice,
		castAt: '2026-11-06T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Die Stimmen der Lage mit vier Anwesenden: Die drei selbst Da stimmen zu, die Verwaltung lehnt für Hans Probe ab. */
function vierStimmen(mitVollmacht: boolean): Vote[] {
	const wahlen: [string, VoteChoice][] = [
		['p1', 'yes'],
		['p3', 'yes'],
		['p4', 'yes']
	];
	if (mitVollmacht) wahlen.splice(1, 0, ['p2', 'no']);
	return wahlen.map(([partyId, choice]) => ({
		partyId,
		unitId: `${partyId}-u`,
		choice,
		castAt: '2026-11-06T19:10:00.000Z',
		recordedByChair: false
	}));
}

/**
 * Die Lage der Zählung, wie der Server sie festschreibt (`leseSchlussstand`):
 * Der Ausstand aus L8 nur bei Häkchen und bestätigter Vollmacht und ohne
 * erklärten Ausstand; unter der Vorgabe steht er auch in der Liste, nach der
 * gerechnet wird, unter «Die Sitzungsleitung entscheidet» nur im Merkmal für
 * das zweite Ergebnis. Ist Hans Probe selbst da, friert der Server das
 * Merkmal trotzdem ein, führt aber keine wirksame Vertretung (M2); ist die
 * Verwaltung abwesend, ebenso.
 */
function lage(
	wahl: 'ruhen' | 'leitung',
	l: {
		haekchen: boolean;
		vollmacht: boolean;
		erklaert: boolean;
		/** Hans Probe ist selbst da; die Vollmacht ist dann nur erfasst (M2). */
		selbstDa?: boolean;
		/** Die Verwaltung ist abwesend; Hans Probe ist dann gar nicht da (M2). */
		abwesend?: boolean;
		/** Vier Anwesende, für die Grenzen mit gleichem Ergebnis. */
		vier?: boolean;
		/** Die Momentaufnahme, wenn eine andere nötig ist (etwa der Stichentscheid). */
		moment?: Snapshot;
		/**
		 * Entscheid 8 (Lauf 4): Das Erfordernis steht nach der Freigabe auf der
		 * Wahl der Verwaltung. Der Server liefert an den Wahlknoten kein Merkmal
		 * aus L8 (`leseVerwaltungsausstandIn`), und die Stimme zählt in beiden
		 * Wahlen trotz Häkchen.
		 */
		wahlknoten?: boolean;
	}
): Auszaehlungslage {
	const ausL8 = l.haekchen && l.vollmacht && !l.erklaert && !l.wahlknoten ? [VERWALTUNG] : [];
	const da = l.vollmacht && !l.selbstDa && !l.abwesend;
	// Die Stimme der Verwaltung steht nur in der Zählung, wo die Stimmsperre
	// sie annimmt: nicht am gekennzeichneten Traktandum unter der Vorgabe und
	// nicht bei erklärtem Ausstand, in beiden Wahlen; am Wahlknoten nimmt
	// sie die Stimmsperre in beiden Wahlen an (Entscheid 8).
	const mitVerwaltungsStimme =
		da && !l.erklaert && (wahl === 'leitung' || !l.haekchen || !!l.wahlknoten);
	return {
		momentaufnahme: {
			...(l.moment ?? (l.vier ? VIER : M)),
			lesarten: { ...LESARTEN_VORGABE, L8: wahl }
		},
		erfordernis: l.wahlknoten ? WAHL : DECHARGE,
		stimmen: l.vier
			? vierStimmen(mitVerwaltungsStimme)
			: l.selbstDa
				? [
						...stimmen(false),
						{
							partyId: 'p2',
							unitId: 'p2-u',
							choice: 'abstain' as VoteChoice,
							castAt: '2026-11-06T19:10:00.000Z',
							recordedByChair: false
						}
					]
				: stimmen(mitVerwaltungsStimme),
		anwesende: l.selbstDa
			? ['p1', 'p2', 'p3']
			: da
				? l.vier
					? ['p1', 'p2', 'p3', 'p4']
					: ['p1', 'p2', 'p3']
				: l.vier
					? ['p1', 'p3', 'p4']
					: ['p1', 'p3'],
		vertretungen: da ? VERWALTUNGSVOLLMACHT : [],
		imAusstand: [...(l.erklaert ? [VERWALTUNG] : []), ...(wahl === 'ruhen' ? ausL8 : [])],
		ausstandAusVerwaltung: ausL8
	};
}

/** Häkchen am Traktandum, die Verwaltung hält die Vollmacht, niemand hat den Ausstand erklärt. */
const GESCHAEFT = { haekchen: true, vollmacht: true, erklaert: false };

describe('L8 im Katalog', () => {
	it('führt L8 mit der Vorgabe «Vollmachten ruhen» und zwei Wahlen', () => {
		const l8 = lesartVon('L8');
		expect(l8?.vorgabe).toBe('ruhen');
		expect(l8?.wahlen.map((w) => w.wert)).toEqual(['ruhen', 'leitung']);
		expect(LESARTEN_VORGABE.L8).toBe('ruhen');
		expect(wahlInWorten('L8', 'ruhen')).toBe('Vollmachten ruhen (Vorgabe)');
		expect(wahlInWorten('L8', 'leitung')).toBe('Die Sitzungsleitung entscheidet');
	});

	it('nimmt die zwei Wahlen an und weist anderes ab', () => {
		expect(pruefeLesartenwahl({ L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })).toEqual({ L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(() => pruefeLesartenwahl({ L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })).not.toThrow();
		expect(() => pruefeLesartenwahl({ L8: 'automatisch', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' })).toThrow(
			/Unbekannte Wahl «automatisch» für die Lesart L8/
		);
	});

	it('nennt die Frage in Alltagssprache und den Gegenstand mit «ob»', () => {
		const l8 = lesartVon('L8')!;
		expect(l8.frage).toBe(
			'Ruhen die Vollmachten der Verwaltung, wenn über ihre Entschädigung, einen Vertrag mit ihr oder ihre Entlastung abgestimmt wird?'
		);
		expect(l8.gegenstand).toMatch(/^ob /);
	});

	it('trägt die Wirkung und die Fundstelle je Wahl mit den Wortlauten des Auftrags', () => {
		const l8 = lesartVon('L8')!;
		expect(l8.wahlen[0].wirkung).toBe(
			'An einem Traktandum, das als Entschädigung, Vertrag oder Entlastung der Verwaltung ' +
				'gekennzeichnet ist, zählt Votum die Stimmen nicht, die die Verwaltung mit Vollmachten abgibt. ' +
				'Die Vertretenen stimmen dort nur, wenn sie selbst kommen oder eine Person bevollmächtigt haben, ' +
				'die nicht für die Verwaltung arbeitet. Bei Wahl und Wiederwahl ruhen die Vollmachten nicht.'
		);
		expect(l8.wahlen[0].fundstelle).toBe(
			'Wer selbst nicht stimmen darf, stimmt auch als Vertreter nicht (BGE 134 III 481 E. 3.6 und ' +
				'3.8); für eine Verwaltung, die nicht Eigentümerin ist, sinngemäss. Bei der Entlastung schliesst ' +
				'das Bundesgericht im Aktienrecht alle anwesenden Organe aus, auch als Vertreter mit Weisung ' +
				'(Art. 695 Abs. 1 OR; BGE 128 III 142 E. 3b). Für die Entlastung im Stockwerkeigentum übernimmt ' +
				'der SVIT-Kommentar die Grundsätze des Aktienrechts (Rz. 145 ad Art. 712q).'
		);
		expect(l8.wahlen[1].wirkung).toBe(
			'Votum lässt die Vollmachten der Verwaltung nur ruhen, wenn die Sitzungsleitung bei diesem ' +
				'Traktandum ihren Ausstand erklärt. Sonst zählen die Stimmen, die die Verwaltung mit ' +
				'Vollmachten abgibt. Leitet die Verwaltung die Versammlung, entscheidet sie so über ihre eigenen ' +
				'Vollmachten. Den Vorsitz für dieses Traktandum übernimmt dann besser eine Eigentümerin oder ein ' +
				'Eigentümer.'
		);
		expect(l8.wahlen[1].fundstelle).toBe(
			'Ob die Vollmachten einer Verwaltung ohne Eigentum ruhen, sagt für das Stockwerkeigentum keine ' +
				'Stelle ausdrücklich. BGE 134 III 481 E. 3.8 schliesst eine Verwalterin ohne Eigentum aus, weil ' +
				'ihr Vollmachtgeber selbst ausgeschlossen war. Für die Entlastung schliesst das Bundesgericht im ' +
				'Aktienrecht alle anwesenden Organe aus, auch als Vertreter (BGE 128 III 142 E. 3b).'
		);
	});

	it('trägt den Grund der Vorgabe und die Geltung mit den Wortlauten des Auftrags', () => {
		const l8 = lesartVon('L8')!;
		expect(l8.warumVorgabe).toBe(
			'Wer bei einem Geschäft nicht selbst stimmen darf, darf es nach dem Bundesgericht auch nicht als ' +
				'Vertreter (BGE 134 III 481 E. 3.8). Für eine Verwaltung, die nicht Eigentümerin ist, sagt das keine ' +
				'Stelle ausdrücklich; Votum überträgt es auf ihre Entschädigung, Verträge mit ihr und ihre ' +
				'Entlastung. Auch Stimmen, die zu Unrecht nicht zählen, machen einen Beschluss anfechtbar ' +
				'(BGer 5A_972/2020 E. 7.2.4). Wer an der Versammlung ist, muss das vor der Abstimmung beanstanden, ' +
				'sonst kann er das Recht zur Anfechtung verlieren (E. 7.2.3.2). Deshalb sagt Votum, ob die andere ' +
				'Wahl am Ergebnis etwas ändern könnte.'
		);
		expect(l8.geltung).toBe(
			'Die Einstellung wirkt nur an Traktanden, die als Entschädigung, Vertrag oder Entlastung der ' +
				'Verwaltung gekennzeichnet sind, und nur für Vollmachten, bei denen vermerkt ist, dass die Verwaltung ' +
				'sie hält. Bei Wahl und Wiederwahl ruhen die Vollmachten nicht (BGE 134 III 481 E. 3.5 und 3.8). Bei ' +
				'der Abberufung ist es nicht geklärt; dort ruhen sie nur, wenn die Sitzungsleitung den Ausstand der ' +
				'Verwaltung erklärt. Einen Rechtsstreit mit der Verwaltung erfasst die Einstellung nicht; dort ' +
				'erklärt die Sitzungsleitung den Ausstand ebenfalls selbst.'
		);
	});

	it('trägt den Rat zur Beanstandung an der Lesart, für beide Richtungen denselben Satz', () => {
		const l8 = lesartVon('L8')!;
		const satz =
			'Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
			'beanstandet haben (BGer 5A_709/2010 E. 4).';
		expect(l8.nachAnnahme).toBe(satz);
		expect(l8.nachAblehnung).toBe(satz);
	});
});

describe('Die Sätze zu L8', () => {
	it('trägt die Sätze an die Leitung und in die Einladung mit den Wortlauten des Auftrags', () => {
		const ruege =
			'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer ' +
			'anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. ' +
			'Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das ' +
			'im Feld «Voten, Begründungen, Ordnungsentscheide».';
		expect(VERWALTUNG_RUHEN_LEITUNG).toBe(
			'Bei diesem Traktandum ruhen die Vollmachten der Verwaltung nach der Einstellung Ihrer Gemeinschaft. ' +
				'Die Stimmen, die die Verwaltung mit Vollmachten abgibt, zählen nicht; die Vertretenen stimmen nur, ' +
				'wenn sie selbst da sind oder eine andere Person bevollmächtigt haben. ' +
				ruege +
				// Fachprüfung Runde 4, R4-4: der Erfassungsfehler vor dem Eröffnen.
				' Beanstandet jemand, dass die Vollmachten ruhen, halten Sie das fest. Gehört eine Vollmacht in ' +
				'Wahrheit nicht der Verwaltung, entfernen Sie das Häkchen unter Vollmachten, bevor Sie eröffnen. ' +
				'Sonst können Sie trotzdem abstimmen; die Einstellung Ihrer Gemeinschaft gilt.'
		);
		expect(VERWALTUNG_LEITUNG_LEITUNG).toBe(
			'Bei diesem Traktandum geht es um ein Geschäft der Verwaltung. Nach der Einstellung Ihrer ' +
				'Gemeinschaft entscheiden Sie, ob ihre Vollmachten ruhen; wollen Sie das, erklären Sie den Ausstand ' +
				'der Verwaltung. Leitet die Verwaltung die Versammlung, entscheidet sie so über ihre eigenen ' +
				'Vollmachten. Den Vorsitz für dieses Traktandum übernimmt dann besser eine Eigentümerin oder ein ' +
				'Eigentümer. ' +
				ruege +
				' Beanstandet jemand, dass die Vollmachten zählen, können Sie den Ausstand der Verwaltung jetzt noch ' +
				'erklären.'
		);
		expect(VERWALTUNG_RUHEN_EINLADUNG).toBe(
			'Bei diesem Traktandum zählen keine Stimmen, die die Verwaltung mit einer Vollmacht abgibt, auch ' +
				'nicht solche mit Weisung. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen hier ' +
				'mitstimmen, kommen Sie selbst oder bevollmächtigen eine andere Person, die nicht für die ' +
				'Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der Verwaltung, dass ' +
				'ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen Traktanden dieser ' +
				'Versammlung für Sie.'
		);
	});

	it('G7: die Einladung trägt auch unter «Die Sitzungsleitung entscheidet» einen eigenen Satz', () => {
		// Produktentscheid 08.11.2026; Entscheid 0045, Punkt 10; Anhang 3 des
		// Restpakets: «Bei beiden Lesarten rät die Einladung …».
		expect(VERWALTUNG_LEITUNG_EINLADUNG).toBe(
			'Bei diesem Traktandum entscheidet die Sitzungsleitung, ob Stimmen zählen, die die Verwaltung ' +
				'mit einer Vollmacht abgibt. Das gilt auch für Stimmen, zu denen Sie der Verwaltung eine Weisung ' +
				'gegeben haben. Haben Sie der Verwaltung eine Vollmacht gegeben und wollen sicher sein, dass ' +
				'Ihre Stimme hier zählt? Dann kommen Sie selbst oder bevollmächtigen eine andere Person, die ' +
				'nicht für die Verwaltung arbeitet. Bevollmächtigen Sie eine andere Person, sagen Sie der ' +
				'Verwaltung, dass ihre Vollmacht für diese Versammlung nicht mehr gilt. Diese Person stimmt dann bei allen Traktanden ' +
				'dieser Versammlung für Sie.'
		);
		expect(verwaltungssatzEinladung('ruhen', true)).toBe(VERWALTUNG_RUHEN_EINLADUNG);
		expect(verwaltungssatzEinladung('leitung', true)).toBe(VERWALTUNG_LEITUNG_EINLADUNG);
		expect(verwaltungssatzEinladung('ruhen', false)).toBeNull();
		expect(verwaltungssatzEinladung('leitung', false)).toBeNull();
		expect(verwaltungssatzEinladung(undefined, true)).toBeNull();
	});

	it('trägt die drei Absagen am Häkchen mit den Wortlauten des Auftrags', () => {
		expect(VERWALTUNG_HAKEN_ABSAGE_WAHL).toBe(
			'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.5). ' +
				'Geht es auch um ihre Entschädigung, stimmen Sie diese in einem eigenen Traktandum ab und setzen ' +
				'Sie das Häkchen nur dort.'
		);
		expect(VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG).toBe(
			'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen, und das Häkchen ' +
				'gilt dort nicht. Bitten Sie die Vertretenen schon mit der Einladung, selbst zu kommen oder eine ' +
				'andere Person zu bevollmächtigen, und schlagen Sie einen Vorsitz für dieses Traktandum vor. Am ' +
				'Abend erklären Sie den Ausstand der Verwaltung, wenn sie den Raum verlässt; mehr dazu im Handbuch ' +
				'unter «Bei der Abberufung der Verwaltung».'
		);
		// Entscheid 8 (Lauf 4): Nach der Freigabe bleibt nur die Abberufung am
		// Grundantrag abgesagt; Entscheid 0045, Punkt 9: Der Satz nennt den
		// Folgeantrag und die Grenze als die von Votum (R3-5, R4-2).
		expect(VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN).toBe(
			'Dieses Traktandum trägt das Häkchen zur Entschädigung, zu einem Vertrag oder zur Entlastung der ' +
				'Verwaltung, und nach der Freigabe lässt es sich nicht mehr abnehmen. Als Abberufung nimmt Votum ' +
				'es deshalb nicht an. Kündigt die Einladung die Abberufung bei diesem Traktandum klar an, nehmen ' +
				'Sie sie mit «Gegenantrag» als eigenen Folgeantrag auf. Dort stellen Sie das nötige Mehr auf ' +
				'«Bewirtschaftung abberufen» und nehmen eine Kündigung des Vertrags in denselben Wortlaut auf. Sonst stimmen Sie sie unter einem eigenen Traktandum ab. Steht keines ' +
				'auf der Traktandenliste, kann Votum sie an dieser Versammlung nicht abstimmen lassen; setzen Sie ' +
				'sie auf eine spätere, wenn nötig eine ausserordentliche.'
		);
	});

	it('trägt die Sätze zur Wahl trotz Häkchen und die Absagen beim Zurücknehmen und Kennzeichnen mit den Wortlauten des Auftrags', () => {
		// Entscheid 0045, Punkt 9: Der gemischte Antrag wird in Folgeanträge
		// aufgeteilt; die Ankündigung prüft Votum nicht (R4-1, R4-2).
		const ruege =
			'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer ' +
			'anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. ' +
			'Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das ' +
			'im Feld «Voten, Begründungen, Ordnungsentscheide».';
		const nurDieWahl = (uebrige: string) =>
			'Votum prüft nicht, ob die Einladung die Wahl bei diesem Traktandum ankündigt; das prüfen Sie. ' +
			'Eine Erneuerung des Verwaltungsvertrags mit der bisherigen Verwaltung gilt in der Regel als ' +
			'Ankündigung der Wiederwahl. ' +
			'Kündigt sie sie nicht an, stimmen Sie die Wahl nicht ab, sondern setzen sie auf eine spätere ' +
			'Versammlung, und stellen das nötige Mehr wieder auf das vorherige. Lautet der Antrag nur auf die ' +
			'Wahl, stimmen Sie hier darüber ab. Stehen darin auch Entschädigung, Entlastung oder neue ' +
			'Vertragsbedingungen, stimmen Sie die Teile getrennt ab. Nehmen Sie dafür mit «Gegenantrag» einen ' +
			'Folgeantrag mit der Wahl auf, mit dem nötigen Mehr «Bewirtschaftung wählen». Die Erneuerung des ' +
			'Vertrags zu den bisherigen Bedingungen gehört zu ihm. Für die übrigen Teile nehmen Sie je einen ' +
			'eigenen auf; ' +
			uebrige +
			'Über diesen Antrag stimmen Sie danach nicht mehr ab.';
		expect(VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN).toBe(
			'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
				'Votum zählt sie hier, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen; ' +
				'sagen Sie das der Versammlung vor der Abstimmung. ' +
				nurDieWahl('dort ruhen die Vollmachten der Verwaltung. ') +
				' ' +
				ruege +
				// Laienprüfung Runde 4, R4-3, Punkt 1.
				' Beanstandet jemand, dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie ' +
				'trotzdem.'
		);
		expect(VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG).toBe(
			'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.8). ' +
				nurDieWahl('dort entscheiden Sie dann selbst, ob die Vollmachten der Verwaltung ruhen. ')
		);
		expect(VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL).toBe(
			'Bei diesem Traktandum ging es um die Wahl der Verwaltung; anders als die Einladung angekündigt ' +
				'hatte, ruhten ihre Vollmachten hier nicht.'
		);
		expect(VERWALTUNG_AUSSTAND_NICHT_ZURUECK).toBe(
			'Diesen Ausstand hat niemand erklärt: Er folgt aus der Einstellung Ihrer Gemeinschaft und lässt sich ' +
				'hier nicht zurücknehmen. Ist das Häkchen an der Vollmacht falsch, entfernen Sie es unter ' +
				// Laienprüfung Runde 4, R4-7.
				'Vollmachten. Ist das Traktandum eine Wahl der Verwaltung, stellen Sie stattdessen das nötige Mehr ' +
				'unter «Nötige Mehrheit ändern» auf «Bewirtschaftung wählen».'
		);
		// R3-3 (Lauf 5): zusätzlich an der Wahl trotz Häkchen, wenn ein
		// Ausstand der Verwaltung vorab erklärt ist.
		expect(VERWALTUNG_WAHL_AUSSTAND_ERKLAERT).toBe(
			'Sie haben den Ausstand der Verwaltung bei diesem Traktandum erklärt. Bei der Wahl ruhen ihre ' +
				'Vollmachten nicht; nehmen Sie den Ausstand deshalb vor der Abstimmung zurück.'
		);
		// Laienprüfung Runde 4, R4-3, Punkt 2: unter «leitung» mit der Rüge.
		expect(VERWALTUNG_WAHL_AUSSTAND_ERKLAERT_LEITUNG).toBe(
			'Sie haben den Ausstand der Verwaltung bei diesem Traktandum erklärt. Bei der Wahl ruhen ihre ' +
				'Vollmachten nicht; nehmen Sie den Ausstand deshalb vor der Abstimmung zurück. Sagen Sie der ' +
				'Versammlung, dass die Vollmachten der Verwaltung hier zählen. ' +
				ruege
		);
		// H-1 (Lauf 5): die Absage beim Kennzeichnen während einer offenen
		// Abstimmung an einem Traktandum mit Häkchen.
		// Laienprüfung Runde 4, R4-4, und Fachprüfung Runde 4, R4-3.
		expect(VERWALTUNG_KENNZEICHNUNG_GESPERRT).toBe(
			'An einem Traktandum zu einem Geschäft der Verwaltung wird gerade abgestimmt. Solange lässt sich ' +
				'die Kennzeichnung dieser Vollmacht nicht ändern, auch nicht beim Bestätigen oder beim Einlass. ' +
				'Sonst stimmte das Ergebnis nicht mit den abgegebenen Stimmen überein. Ist die Kennzeichnung ' +
				'falsch, brechen Sie die Abstimmung mit «Ohne Ergebnis abbrechen» ab, ändern die Kennzeichnung und ' +
				'geben die Abstimmung neu frei. Kommt nur eine weitere Vollmacht auf denselben Namen dazu, ändern ' +
				'Sie sie, wenn die Abstimmung zu Ende ist. Lassen Sie ' +
				'eine Person, die so eine Vollmacht bringt, erst danach ein; nehmen Sie das Häkchen nicht weg, um ' +
				'sie früher einzulassen.'
		);
		// Entscheid 0045, Punkt 9: die Abberufung als Folgeantrag; nach Runde 5
		// mit Vorsitz und Beanstandung (Laien R5-5, R5-6; Fach R5-3).
		const entscheid =
			'Entscheiden Sie, ob sie ruhen, und sagen Sie der Versammlung vor der Abstimmung, dass die Frage ' +
			'nicht geklärt ist und was Sie entschieden haben. Leitet die Verwaltung die Versammlung, gibt sie ' +
			'den Vorsitz für die Behandlung dieses Folgeantrags ab, damit sie nicht selbst über ihre ' +
			'Vollmachten entscheidet. Verlässt die Verwaltung den Raum, erklären Sie ihren Ausstand; mehr dazu im Handbuch ' +
			'unter «Bei der Abberufung der Verwaltung». ' +
			ruege +
			' Beanstandet jemand Ihren Entscheid, halten Sie das fest; abstimmen können Sie trotzdem.';
		expect(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN).toBe(
			'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen. Das Häkchen wirkt ' +
				'hier nicht von selbst: Votum zählt die Vollmachten, bis Sie den Ausstand der Verwaltung erklären. ' +
				'Das gilt, obwohl die Einladung bei diesem Traktandum sagt, dass sie nicht zählen. ' +
				entscheid
		);
		expect(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_LEITUNG).toBe(
			'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen. Votum zählt sie, ' +
				'bis Sie den Ausstand der Verwaltung erklären. ' +
				entscheid
		);
		expect(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL).toBe(
			'Bei diesem Traktandum ging es um die Abberufung der Verwaltung. Anders als die Einladung ' +
				'angekündigt hatte, zählten ihre Vollmachten hier; die Sitzungsleitung hat ihren Ausstand nicht ' +
				'erklärt.'
		);
		expect(VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL).toBe(
			'Bei diesem Traktandum ging es um die Abberufung der Verwaltung; ihre Vollmachten ruhten, weil die ' +
				'Sitzungsleitung ihren Ausstand erklärt hat.'
		);
		expect(AUSSTAND_NICHT_GEERBT).toBe(
			'Einen Ausstand, den Sie beim ursprünglichen Antrag erklärt haben, übernimmt dieser Folgeantrag ' +
				'nicht. Betrifft sein Grund auch diesen Folgeantrag, erklären Sie ihn hier erneut.'
		);
	});

	it('trägt die beiden Hilfetexte am Häkchen der Vollmacht mit den Wortlauten des Auftrags', () => {
		expect(VERWALTUNG_HAKEN_HILFE_LEITUNG).toBe(
			'Ankreuzen, wenn die Vollmacht auf die Verwaltung lautet oder auf eine Person, die für sie handelt, ' +
				'etwa die Bewirtschafterin oder die Geschäftsführung. Daran erkennt Votum die Vollmachten der ' +
				'Verwaltung. Ob sie an Traktanden zu ihrer Entschädigung, zu Verträgen mit ihr und zu ihrer ' +
				'Entlastung ruhen, regelt die Einstellung Ihrer Gemeinschaft. Bei Wahl, Wiederwahl und Abberufung ' +
				'ruhen sie deswegen nicht.'
		);
		expect(VERWALTUNG_HAKEN_HILFE_EIGENTUEMER).toBe(
			'Kreuzen Sie das an, wenn Sie die Verwaltung bevollmächtigen oder eine Person, die für sie arbeitet. ' +
				'Je nach Einstellung Ihrer Gemeinschaft zählen Vollmachten der Verwaltung nicht, wenn über ihre ' +
				'Entschädigung, einen Vertrag mit ihr oder ihre Entlastung abgestimmt wird. Die Sitzungsleitung ' +
				'prüft das Häkchen. Wollen Sie dort sicher mitstimmen, kommen Sie selbst oder bevollmächtigen Sie ' +
				'eine andere Person.'
		);
	});
});

describe('Das Häkchen an der Vollmacht', () => {
	it('gilt nur bei einem Vertreter ohne Partei, nicht bei einer Partei der Versammlung', () => {
		expect(
			pruefeEingabe({ vertreteneId: 'p2', bevollmaechtigtName: 'Grosse Verwaltung AG', istVerwaltung: true })
				.istVerwaltung
		).toBe(true);
		// Bei einer Partei dieser Versammlung gilt das Häkchen als nicht
		// gesetzt: Die Datenbank weist beides zugleich ab
		// (`proxy_verwaltung_nur_dritte`).
		expect(
			pruefeEingabe({ vertreteneId: 'p2', bevollmaechtigtId: 'p3', istVerwaltung: true }).istVerwaltung
		).toBe(false);
		expect(pruefeEingabe({ vertreteneId: 'p2', bevollmaechtigtName: 'Grosse Verwaltung AG' }).istVerwaltung).toBe(
			false
		);
	});
});

describe('Das Häkchen am Traktandum', () => {
	const basis = {
		meetingId: 'v-1',
		titel: 'Entlastung der Verwaltung',
		antragswortlaut: 'Die Verwaltung wird entlastet.',
		antragstellerart: 'bewirtschaftung' as const
	};

	it('gilt nur bei einer Abstimmung; an einer Kenntnisnahme ruhen keine Vollmachten', () => {
		expect(pruefeTraktandum({ ...basis, art: 'abstimmung', verwaltungsGeschaeft: true }).verwaltungsGeschaeft).toBe(
			true
		);
		expect(pruefeTraktandum({ ...basis, art: 'kenntnisnahme', verwaltungsGeschaeft: true }).verwaltungsGeschaeft).toBe(
			false
		);
		expect(pruefeTraktandum({ ...basis, art: 'abstimmung' }).verwaltungsGeschaeft).toBe(false);
	});
});

describe('L8, die Stimme der Verwaltung je Wahl und Lage', () => {
	it('lässt die Stimme unter der Vorgabe ruhen: Der Antrag ist abgelehnt, 1 zu 1', () => {
		const a = zaehleAus(lage('ruhen', GESCHAEFT));
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		expect(a.angenommen).toBe(false);
		// Die vertretene Partei gilt in der Zählung als nicht da; ihre Stimme
		// ist nicht erfasst, weil die Stimmsperre sie nicht annimmt (G3).
		expect(a.koepfe.basis).toBe(2);
	});

	it('zählt die Stimme unter «Die Sitzungsleitung entscheidet» ohne erklärten Ausstand', () => {
		const a = zaehleAus(lage('leitung', GESCHAEFT));
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(1);
		expect(a.angenommen).toBe(true);
	});

	it('zählt die Stimme unter der Vorgabe, wenn das Traktandum kein Häkchen trägt', () => {
		const a = zaehleAus(lage('ruhen', { ...GESCHAEFT, haekchen: false }));
		expect(a.koepfe.ja).toBe(2);
		expect(a.angenommen).toBe(true);
		expect(a.andereVerwaltungsvollmacht).toBeUndefined();
	});

	it('zählt unter der Vorgabe, wenn die Verwaltung keine Vollmacht hält', () => {
		const a = zaehleAus(lage('ruhen', { ...GESCHAEFT, vollmacht: false }));
		// Hans Probe ist abwesend und hat niemanden bevollmächtigt; die
		// Abstimmung ist eine ganz gewöhnliche.
		expect(a.koepfe.ja).toBe(1);
		expect(a.koepfe.nein).toBe(1);
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toBeUndefined();
	});

	it('lässt die Stimme über den erklärten Ausstand in beiden Wahlen ruhen', () => {
		for (const wahl of ['ruhen', 'leitung'] as const) {
			const a = zaehleAus(lage(wahl, { ...GESCHAEFT, erklaert: true }));
			expect(a.koepfe.ja, wahl).toBe(1);
			expect(a.angenommen, wahl).toBe(false);
			// Der erklärte Ausstand wirkt nach beiden Wahlen gleich; es gibt
			// kein zweites Ergebnis zu rechnen.
			expect(a.andereVerwaltungsvollmacht, wahl).toBeUndefined();
		}
	});

	it('zählt die Stimme am Wahlknoten in beiden Wahlen trotz Häkchen, ohne zweites Ergebnis (Entscheid 8)', () => {
		for (const wahl of ['ruhen', 'leitung'] as const) {
			const a = zaehleAus(lage(wahl, { ...GESCHAEFT, wahlknoten: true }));
			// Der Server liefert an den Wahlknoten kein Merkmal aus L8
			// (`leseVerwaltungsausstandIn`); ohne Merkmal ruht nichts, die
			// Stimme der Verwaltung zählt, und die Rechnung kommt ohne zweites
			// Ergebnis aus.
			expect(a.koepfe.ja, wahl).toBe(2);
			expect(a.koepfe.basis, wahl).toBe(3);
			expect(a.angenommen, wahl).toBe(true);
			expect(a.andereVerwaltungsvollmacht, wahl).toBeUndefined();
			expect((a.protokollhinweise ?? []).map((h) => h.satz).join(' '), wahl).not.toContain('ruhten');
		}
	});
});

describe('L8, die Grenzen unter «Vollmachten ruhen» (Entscheid 2)', () => {
	it('sagt bei 1 Ja, 1 Nein und einer ruhenden Vollmacht «nicht bestimmbar» mit n = 1', () => {
		const a = zaehleAus(lage('ruhen', GESCHAEFT));
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toEqual({
			kennung: 'L8',
			eigeneWahl: 'Vollmachten ruhen',
			wahl: 'Die Sitzungsleitung entscheidet',
			verlangt: 'den Entscheid der Sitzungsleitung über den Ausstand',
			ruhendeVollmachten: 1,
			// N-1 (Lauf 4): Der Rat hängt an der Richtung des eigenen Ergebnisses;
			// deshalb trägt das Ergebnis das Feld.
			eigenesErgebnis: false,
			feststellbar: false,
			angenommen: null,
			koepfe: null,
			quoten: null,
			abweichend: false
		});
		// Alle Ja hätte angenommen, alle Nein abgelehnt: Die Grenzen tragen
		// das Ergebnis nicht beide, also ist es nicht bestimmbar; die eigene
		// Ablehnung gilt, und der Rat sagt einer Partei, die nur über die
		// ruhende Vollmacht vertreten war, wie sie die Ablehnung anficht (N-1,
		// N-5).
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der Verwaltung gezählt. ' +
				'Je nachdem, wie die Verwaltung damit gestimmt hätte, hätte das Ergebnis anders ausfallen können; erfasst ist das nicht, weil ' +
				'Votum diese Stimmen nicht annimmt. Die Ablehnung gilt wie gezählt. Wer nicht Nein gestimmt hat, auch eine Partei, die nur über ' +
				'die ruhende Vollmacht vertreten war, und meint, diese Stimmen hätten zählen müssen, kann die Ablehnung beim Gericht anfechten, ' +
				'innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab ' +
				'Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Das Gericht hebt sie dann in der Regel nur auf; angenommen ist der ' +
				'Antrag damit nicht. Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung beanstandet haben. ' +
				'Für die Vertretenen, deren Vollmacht ruhte, läuft die Frist womöglich schon ab heute; stellen Sie ihnen das Protokoll rasch zu.'
		);
		expect(worte.protokoll).toBeNull();
	});

	it('sagt bei angenommenem eigenem Ergebnis, dass der Beschluss gilt, und wie ihn anficht, wer nicht zugestimmt hat', () => {
		// Vier Anwesende, die vertretene Partei ruht: Erika und Ida stimmen zu,
		// Kurt lehnt ab — 2 Ja von 3, angenommen. Alle Nein ergäbe 2 zu 2 von
		// 4, abgelehnt: Die Grenzen tragen das Ergebnis nicht beide, und der
		// Rat gilt der angenommenen Richtung (N-1).
		const stimmenVier: Vote[] = (
			[
				['p1', 'yes'],
				['p3', 'yes'],
				['p4', 'no']
			] as const
		).map(([partyId, choice]) => ({
			partyId,
			unitId: `${partyId}-u`,
			choice,
			castAt: '2026-11-06T19:10:00.000Z',
			recordedByChair: false
		}));
		const a = zaehleAus({ ...lage('ruhen', { ...GESCHAEFT, vier: true }), stimmen: stimmenVier });
		expect(a.angenommen).toBe(true);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			ruhendeVollmachten: 1,
			eigenesErgebnis: true,
			feststellbar: false,
			angenommen: null
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der Verwaltung gezählt. ' +
				'Je nachdem, wie die Verwaltung damit gestimmt hätte, hätte das Ergebnis anders ausfallen können; erfasst ist das nicht, weil ' +
				'Votum diese Stimmen nicht annimmt. Der Beschluss gilt wie gezählt. Wer ihm nicht zugestimmt hat, auch eine Partei, die nur über ' +
				'die ruhende Vollmacht vertreten war, und meint, diese Stimmen hätten zählen müssen, kann ihn beim Gericht anfechten, innert ' +
				'eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab ' +
				'Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75). Wer an der Versammlung war, muss die Zählung dafür in der Regel ' +
				'schon vor der Abstimmung beanstandet haben. Für die Vertretenen, deren Vollmacht ruhte, läuft die Frist womöglich schon ab ' +
				'heute; stellen Sie ihnen das Protokoll rasch zu.'
		);
		expect(worte.protokoll).toBeNull();
	});

	it('rechnet kein zweites Ergebnis, wenn jede vertretene Partei aus anderem Grund ausgeschlossen ist (G-1)', () => {
		// Die Ausschlussklage nimmt den Beklagten vom Stimmrecht; ist die
		// vertretene Partei selbst betroffen, ruht ihre Vertretung nach
		// beiden Wahlen, und über «0 ruhende Vollmachten» gäbe es nichts zu
		// sagen: Die Grenzen rechneten zweimal dasselbe wie die eigene
		// Zählung.
		const klage = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-ausschlussklage')!);
		const a = zaehleAus({
			...lage('ruhen', GESCHAEFT),
			erfordernis: klage,
			betroffeneParteiIds: ['p2']
		});
		expect(a.andereVerwaltungsvollmacht).toBeUndefined();
	});

	it('rechnet auch unter «Die Sitzungsleitung entscheidet» kein zweites Ergebnis in derselben Lage (G-4)', () => {
		// Dieselbe Lage wie bei G-1, unter der anderen Wahl: Die Regel
		// `n = 0` gilt auch hier. Ohne sie rechnete die zweite Rechnung
		// zweimal dasselbe wie die eigene und sagte «dasselbe Ergebnis»
		// zu einem Ausstand, der nach keiner Wahl etwas änderte.
		const klage = erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === 'k-ausschlussklage')!);
		const a = zaehleAus({
			...lage('leitung', GESCHAEFT),
			erfordernis: klage,
			betroffeneParteiIds: ['p2']
		});
		expect(a.andereVerwaltungsvollmacht).toBeUndefined();
	});

	it('sagt bei 3 Ja, 1 Nein und einer ruhenden Vollmacht «dasselbe Ergebnis»', () => {
		const a = zaehleAus(lage('ruhen', { ...GESCHAEFT, vier: true }));
		// Die drei selbst Da stimmen zu; die vertretene Partei gilt als nicht
		// da. 3 Ja von 3, angenommen.
		expect(a.koepfe.ja).toBe(3);
		expect(a.angenommen).toBe(true);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			ruhendeVollmachten: 1,
			feststellbar: true,
			angenommen: true
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Die Sitzungsleitung entscheidet») hätte die ruhende Vollmacht der Verwaltung gezählt. ' +
				'Das Ergebnis wäre dasselbe, gleich wie die Verwaltung damit gestimmt hätte.'
		);
		expect(worte.protokoll).toBeNull();
	});

	it('rechnet die Grenzen auch aus einer Handzählung, mit den Köpfen der ruhenden Vertretung', () => {
		// Von Hand gezählt: 1 Ja, 1 Nein; die vertretene Partei gilt als
		// nicht da, also stehen zwei Stimmen zur Verfügung. Die Grenzen
		// addieren den Kopf der ruhenden Vertretung zu Ja und zu Nein.
		const a = zaehleSummenAus(lage('ruhen', GESCHAEFT), { ja: 1, nein: 1, enthaltung: 0 });
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			ruhendeVollmachten: 1,
			feststellbar: false,
			angenommen: null
		});
	});

	it('sagt «nicht bestimmbar», wenn eine Grenze Stimmengleichheit mit offenem Stichentscheid ergibt', () => {
		// Drei selbst Da: Erika stimmt zu, Ida und Kurt lehnen ab; die
		// vertretene Partei gilt als nicht da. 1 Ja von 3, abgelehnt. Alle Ja
		// ergäbe 2 zu 2, und nach dem Reglement entscheidet der Verwalter.
		const stimmenDrei: Vote[] = (
			[
				['p1', 'yes'],
				['p3', 'no'],
				['p4', 'no']
			] as const
		).map(([partyId, choice]) => ({
			partyId,
			unitId: `${partyId}-u`,
			choice,
			castAt: '2026-11-06T19:10:00.000Z',
			recordedByChair: false
		}));
		const offen = zaehleAus({
			...lage('ruhen', { ...GESCHAEFT, vier: true, moment: { ...VIER, tieBreak: 'verwalter' } }),
			stimmen: stimmenDrei
		});
		expect(offen.andereVerwaltungsvollmacht).toMatchObject({
			ruhendeVollmachten: 1,
			feststellbar: false,
			angenommen: null
		});
		// Ohne Stichentscheid entscheidet dieselbe Gleichstandslage nichts:
		// Beide Grenzen lehnen ab wie die Zählung, das Ergebnis ist dasselbe.
		const ohne = zaehleAus({
			...lage('ruhen', { ...GESCHAEFT, vier: true }),
			stimmen: stimmenDrei
		});
		expect(ohne.andereVerwaltungsvollmacht).toMatchObject({
			ruhendeVollmachten: 1,
			feststellbar: true,
			angenommen: false
		});
	});
});

describe('L8, das Protokoll unter «Vollmachten ruhen» (Entscheid 3)', () => {
	it('trägt nur die Tatsachenzeile, kein zweites Ergebnis und keine zweite Zeile zur selben Partei', () => {
		const a = zaehleAus(lage('ruhen', GESCHAEFT));
		const zeilen = (a.protokollhinweise ?? []).map((h) => h.satz);
		expect(zeilen).toEqual([
			'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
				'Für eine vertretene Partei (Hans Probe) zählte deshalb keine Stimme.'
		]);
		// Kein zweites Ergebnis im Protokoll, weder «dasselbe» noch «nicht
		// bestimmbar», und keine Zeile aus `ruhendProtokollInWorten` zur
		// selben Partei daneben.
		expect(zeilen.join(' ')).not.toContain('Nach der anderen Lesart');
		expect(zeilen.join(' ')).not.toContain('war nur über');
		expect(andereLesartInWorten(a.andereVerwaltungsvollmacht!, false).protokoll).toBeNull();
	});

	it('zählt die vertretenen Parteien in der Tatsachenzeile und lässt die Klammern weg, wo verlangt', () => {
		// G-5 (Lauf 4): Der Name sagt Mehrzahl und Klammern-weg; das
		// Tagprotokoll führt Namen ohne Anführungszeichen wie
		// `ausstandProtokollInWorten` (G-4). Zwei Vertretungen über dieselbe
		// Verwaltung, beide ruhen aus L8.
		// Nur Erika Beispiel ist selbst da und stimmt mit Nein; Ida Muster ist
		// abwesend, Hans Probe und Kurt Beispiel sind nur über die Verwaltung
		// da, deren Vollmachten ruhen. Die eigene Zählung lehnt ab, und B3
		// rechnet mit den beiden Vertretenen in der Bezugsgrösse dasselbe:
		// Im Protokoll steht nur die Tatsachenzeile.
		const a = zaehleAus({
			...lage('ruhen', GESCHAEFT),
			momentaufnahme: { ...VIER, lesarten: { ...LESARTEN_VORGABE, L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle' } },
			anwesende: ['p1', 'p2', 'p4'],
			vertretungen: [
				...VERWALTUNGSVOLLMACHT,
				{ vertreteneId: 'p4', bevollmaechtigtId: VERWALTUNG, bevollmaechtigtName: 'Grosse Verwaltung AG' }
			],
			stimmen: [
				{ partyId: 'p1', unitId: 'p1-u', choice: 'no', castAt: '2026-11-06T19:10:00.000Z', recordedByChair: false }
			]
		});
		expect(a.protokollhinweise?.length).toBe(1);
		expect(a.protokollhinweise?.[0].ort).toBe('bezugsgroesse');
		expect(a.protokollhinweise?.[0].satz).toBe(
			'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
				'Für 2 vertretene Parteien (Hans Probe, Kurt Beispiel) zählte deshalb keine Stimme.'
		);
	});

	it('sagt zur ruhenden Vertretung aus L8 den eigenen Satz, nicht den zum erklärten Ausstand', () => {
		// Lauf 4: Das Bundesgericht hat die Regel für eine Verwaltung ohne
		// Eigentum nicht entschieden; Votum überträgt sie hier selbst, und der
		// Satz nennt die Einstellung der Gemeinschaft statt BGE 134 III 481
		// E. 3.8.
		const a = zaehleAus(lage('ruhen', GESCHAEFT));
		expect(a.hinweise).toContain(
			'«Hans Probe» war nur über Grosse Verwaltung AG vertreten; nach der Einstellung Ihrer Gemeinschaft ' +
				'ruhen die Vollmachten der Verwaltung bei diesem Traktandum. Diese Partei kann hier keine Stimme ' +
				'abgeben; bei den übrigen Traktanden gilt sie wieder, ausser wo die Vollmachten der Verwaltung ' +
				'ebenfalls ruhen.'
		);
	});
});

describe('L8, M2: selbst da, nur erfasst, Verwaltung abwesend', () => {
	// G-3 (Lauf 5): Die drei Fälle laufen zusätzlich unter «leitung», damit
	// eine Beschädigung des Filters `ausL8 … wirksam.has(k)` rot wird; der
	// Server friert das Merkmal in beiden Wahlen ein.
	it('rechnet kein zweites Ergebnis und keine Protokollzeile, wenn die Partei selbst da ist', () => {
		for (const wahl of ['ruhen', 'leitung'] as const) {
			const a = zaehleAus(lage(wahl, { ...GESCHAEFT, selbstDa: true }));
			// Das Merkmal ist eingefroren, aber die Vollmacht ist nicht wirksam:
			// Der Kern filtert es gegen die wirksamen Vertretungen.
			expect(a.andereVerwaltungsvollmacht, wahl).toBeUndefined();
			expect((a.protokollhinweise ?? []).map((h) => h.satz).join(' '), wahl).not.toContain('ruhten');
			expect(a.koepfe.basis, wahl).toBe(3);
			expect(a.angenommen, wahl).toBe(false);
		}
	});

	it('rechnet kein zweites Ergebnis, wenn die Vollmacht nur erfasst ist', () => {
		// Der Server friert nur bestätigte Vollmachten ein
		// (Sicherheitsbefund); eine erfasste steht nicht im Merkmal.
		for (const wahl of ['ruhen', 'leitung'] as const) {
			const a = zaehleAus(lage(wahl, { ...GESCHAEFT, vollmacht: false }));
			expect(a.andereVerwaltungsvollmacht, wahl).toBeUndefined();
		}
	});

	it('rechnet kein zweites Ergebnis und keine Protokollzeile, wenn die Verwaltung abwesend ist', () => {
		for (const wahl of ['ruhen', 'leitung'] as const) {
			const a = zaehleAus(lage(wahl, { ...GESCHAEFT, abwesend: true }));
			// Das Merkmal ist eingefroren, aber niemand ist über die Verwaltung
			// da: Die wirksamen Vertretungen sind leer, der Kern filtert das
			// Merkmal heraus.
			expect(a.andereVerwaltungsvollmacht, wahl).toBeUndefined();
			expect((a.protokollhinweise ?? []).map((h) => h.satz).join(' '), wahl).not.toContain('ruhten');
			expect(a.koepfe.basis, wahl).toBe(2);
		}
	});
});

describe('L8, Summen unter «Die Sitzungsleitung entscheidet» (H1)', () => {
	it('sagt, dass sich das zweite Ergebnis aus den Summen nicht bestimmen lässt, und wirft nicht', () => {
		// Von Hand gezählt: 2 Ja, 1 Nein; die Ja-Stimme der Verwaltung ist
		// mitgezählt, ohne dass die Dreizahl sagt, wessen Hand es war. Früher
		// warf die zweite Rechnung `summe_zu_hoch`; jetzt sagt der Satz das.
		const a = zaehleSummenAus(lage('leitung', GESCHAEFT), { ja: 2, nein: 1, enthaltung: 0 });
		expect(a.angenommen).toBe(true);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			feststellbar: false,
			nichtFeststellbarWeil: 'verwaltung_summen',
			angenommen: null,
			abweichend: false
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		// N-4 (Lauf 4): Das eigene Ergebnis steht; an die Leitung kommt der
		// Zusatz, dass der Beschluss trotzdem gilt. Seit Lauf 5 hängt an ihm
		// der Rat zur Anfechtung, hier zur angenommenen Richtung.
		const frist =
			'innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da ' +
			'noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75)';
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung) ' +
				'lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht ' +
				'getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat. Der Beschluss gilt wie gezählt.' +
				' Wer ihm nicht zugestimmt hat und meint, diese Stimmen hätten ruhen müssen, kann ihn beim ' +
				`Gericht anfechten, ${frist}.` +
				' Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
				'beanstandet haben.'
		);
		expect(worte.protokoll).toBe(
			'Nach der anderen Lesart («Vollmachten ruhen») lässt sich das Ergebnis nicht bestimmen: ' +
				'Gezählt wurden nur die Summen, und darin ist nicht getrennt, wie die Verwaltung mit ihren ' +
				'Vollmachten gestimmt hat.'
		);
		// Nicht feststellbar steht immer im Protokoll (Entscheid 0023).
		expect((a.protokollhinweise ?? []).map((h) => h.satz)).toContain(worte.protokoll);
	});

	it('sagt «dasselbe Ergebnis», wenn beide Grenzen das eigene tragen (N-4)', () => {
		// Von Hand gezählt: 1 Ja, 2 Nein; die Ja-Stimme der Verwaltung ist
		// mitgezählt. Die eigene Zählung lehnt ab — 1 Ja von 3, nötig 2 —,
		// und beide Grenzen rechnen abgelehnt: die untere ohne die Ja-Stimme
		// der Verwaltung (0 Ja von 2), die obere mit ihr (1 Ja von 2, daneben
		// 1 Nein). Keine Grenze hätte angenommen, das Ergebnis ist dasselbe.
		const a = zaehleSummenAus(lage('leitung', GESCHAEFT), { ja: 1, nein: 2, enthaltung: 0 });
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			summenGrenzen: true,
			feststellbar: true,
			angenommen: false,
			abweichend: false
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Vollmachten ruhen») dasselbe Ergebnis, gleich wie die Verwaltung mit ' +
				'ihren Vollmachten gestimmt hat.'
		);
		// Keine Abweichung, keine Zeile im Protokoll (wie unter der Vorgabe).
		expect(worte.protokoll).toBeNull();
		expect((a.protokollhinweise ?? []).map((h) => h.satz).join(' ')).not.toContain('Nach der anderen Lesart');
	});

	it('sagt an der oberen Grenze «nicht bestimmbar», wenn nur sie das Ergebnis dreht (G-2)', () => {
		// Von Hand gezählt, vier Anwesende: 2 Ja, 2 Nein. Die eigene Zählung
		// lehnt ab — 2 Ja von 4, nötig 3 —, die untere Grenze ebenso (1 Ja
		// von 3), aber die obere nimmt an: So wenige Ja wie möglich fielen
		// aus der Dreizahl (2 Ja von 3). Nur eine Grenze trägt das Ergebnis
		// nicht, also ist es nicht bestimmbar; der Rat gilt der abgelehnten
		// Richtung.
		const a = zaehleSummenAus(lage('leitung', { ...GESCHAEFT, vier: true }), {
			ja: 2,
			nein: 2,
			enthaltung: 0
		});
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			nichtFeststellbarWeil: 'verwaltung_summen',
			eigenesErgebnis: false,
			feststellbar: false,
			angenommen: null,
			abweichend: false
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		const frist =
			'innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da ' +
			'noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75)';
		expect(worte.leitung).toBe(
			'Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung) ' +
				'lässt sich das Ergebnis nicht bestimmen: Gezählt wurden nur die Summen, und darin ist nicht ' +
				'getrennt, wie die Verwaltung mit ihren Vollmachten gestimmt hat. Der Beschluss gilt wie gezählt.' +
				' Wer nicht Nein gestimmt hat und meint, diese Stimmen hätten ruhen müssen, kann die Ablehnung ' +
				`beim Gericht anfechten, ${frist}. Das Gericht hebt sie dann in der Regel nur auf; angenommen ist ` +
				'der Antrag damit nicht.' +
				' Wer an der Versammlung war, muss die Zählung dafür in der Regel schon vor der Abstimmung ' +
				'beanstandet haben.'
		);
		// Gegenprobe: Drei Ja tragen das eigene Ergebnis in beiden Grenzen;
		// die obere Grenze dreht nichts, und der Satz sagt «dasselbe».
		const gegen = zaehleSummenAus(lage('leitung', { ...GESCHAEFT, vier: true }), {
			ja: 3,
			nein: 1,
			enthaltung: 0
		});
		expect(gegen.angenommen).toBe(true);
		expect(gegen.andereVerwaltungsvollmacht).toMatchObject({
			summenGrenzen: true,
			feststellbar: true,
			angenommen: true
		});
	});

	it('nimmt die Enthaltungen je Grenze aus der Dreizahl, unten zuerst, oben zuletzt (G-2)', () => {
		// Drei Anwesende, von Hand gezählt: 2 Ja, 1 Enthaltung. Die eigene
		// Zählung nimmt an — 2 Ja von 3 —, die untere Grenze lehnt ab (1 Ja
		// von 2, der Kopf der Verwaltung fiel aus den Ja), die obere nimmt an
		// (2 Ja von 2, er fiel aus der Enthaltung). Nur eine Grenze trägt das
		// Ergebnis, also ist es nicht bestimmbar.
		const a = zaehleSummenAus(lage('leitung', GESCHAEFT), { ja: 2, nein: 0, enthaltung: 1 });
		expect(a.angenommen).toBe(true);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			nichtFeststellbarWeil: 'verwaltung_summen',
			eigenesErgebnis: true,
			feststellbar: false,
			angenommen: null
		});
		// Gegenprobe: 1 Ja, 1 Nein, 1 Enthaltung. Beide Grenzen rechnen
		// abgelehnt wie die eigene — die untere ohne das Ja (0 Ja von 2), die
		// obere ohne ein Nein (1 Ja von 2) —, die Enthaltung bleibt in der
		// Bezugsgrösse, und der Satz sagt «dasselbe Ergebnis».
		const gegen = zaehleSummenAus(lage('leitung', GESCHAEFT), { ja: 1, nein: 1, enthaltung: 1 });
		expect(gegen.angenommen).toBe(false);
		expect(gegen.andereVerwaltungsvollmacht).toMatchObject({
			summenGrenzen: true,
			feststellbar: true,
			angenommen: false
		});
		expect(andereLesartInWorten(gegen.andereVerwaltungsvollmacht!, false).leitung).toBe(
			'Nach der anderen Lesart («Vollmachten ruhen») dasselbe Ergebnis, gleich wie die Verwaltung mit ' +
				'ihren Vollmachten gestimmt hat.'
		);
	});

	it('rechnet auch, wenn mehr Verwaltungsköpfe ruhen als Ja-Stimmen abgegeben wurden (G-2)', () => {
		// Vier Anwesende, zwei nur über die Verwaltung da: Beide Köpfe
		// fallen nach der anderen Wahl aus der Dreizahl, aber nur eine
		// Ja-Stimme ist abgegeben. Die untere Grenze nimmt das einzige Ja und
		// dazu eine Enthaltung weg (0 Ja von 2), die obere zwei Nein (1 Ja
		// von 2); beide lehnen ab wie die eigene Zählung, und nichts wirft.
		const lageZwei: Auszaehlungslage = {
			...lage('leitung', { ...GESCHAEFT, vier: true }),
			vertretungen: [
				...VERWALTUNGSVOLLMACHT,
				{ vertreteneId: 'p4', bevollmaechtigtId: VERWALTUNG, bevollmaechtigtName: 'Grosse Verwaltung AG' }
			]
		};
		const a = zaehleSummenAus(lageZwei, { ja: 1, nein: 2, enthaltung: 1 });
		expect(a.angenommen).toBe(false);
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			summenGrenzen: true,
			feststellbar: true,
			angenommen: false,
			abweichend: false
		});
		// Gegenprobe: Zwei Ja-Stimmen, so viele wie Köpfe ruhen. Die obere
		// Grenze nimmt an (2 Ja von 2), die eigene Zählung lehnt ab (2 Ja von
		// 4, nötig 3), und das Ergebnis ist nicht bestimmbar.
		const gegen = zaehleSummenAus(lageZwei, { ja: 2, nein: 1, enthaltung: 1 });
		expect(gegen.angenommen).toBe(false);
		expect(gegen.andereVerwaltungsvollmacht).toMatchObject({
			nichtFeststellbarWeil: 'verwaltung_summen',
			feststellbar: false,
			angenommen: null
		});
	});
});

describe('L8, das zweite Ergebnis nach der anderen Wahl', () => {
	it('nennt unter «Die Sitzungsleitung entscheidet» das Ergebnis nach der Vorgabe', () => {
		const a = zaehleAus(lage('leitung', GESCHAEFT));
		expect(a.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			eigeneWahl: 'Die Sitzungsleitung entscheidet',
			wahl: 'Vollmachten ruhen',
			verlangt: 'das Ruhen der Vollmachten der Verwaltung',
			angenommen: false,
			abweichend: true
		});
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, false);
		expect(worte.leitung).toMatch(
			/^Nach der Lesart, die für Ihre Gemeinschaft eingestellt ist \(«Die Sitzungsleitung entscheidet»\), ist der Antrag angenommen\. Nach der anderen Lesart \(«Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung\) wäre er abgelehnt/
		);
		expect(worte.protokoll).toMatch(/^Nach der anderen Lesart \(«Vollmachten ruhen»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});

	it('rechnet kein zweites Ergebnis, wo beide Wahlen dasselbe rechnen', () => {
		// Ohne Häkchen, ohne Vollmacht der Verwaltung und mit erklärtem
		// Ausstand gibt es keinen Ausstand aus L8, der nach der anderen Wahl
		// wirkte oder nicht wirkte.
		for (const l of [
			{ ...GESCHAEFT, haekchen: false },
			{ ...GESCHAEFT, vollmacht: false },
			{ ...GESCHAEFT, erklaert: true }
		]) {
			for (const wahl of ['ruhen', 'leitung'] as const) {
				expect(zaehleAus(lage(wahl, l)).andereVerwaltungsvollmacht, `${wahl} ${JSON.stringify(l)}`).toBeUndefined();
			}
		}
	});

	it('nimmt bei geheimer Abstimmung keine Zahlen ins zweite Ergebnis auf', () => {
		const a = zaehleAus({ ...lage('leitung', GESCHAEFT), geheim: true });
		const worte = andereLesartInWorten(a.andereVerwaltungsvollmacht!, true);
		// Keine Zahlen, aus denen sich die Stimmen der Verwaltung ablesen
		// liessen; der Ausgang allein bleibt (wie B3 bei `geheim`).
		expect(worte.leitung).not.toMatch(/Ja von \d+ Kopfstimmen/);
		expect(worte.protokoll).not.toMatch(/Ja von \d+ Kopfstimmen/);
	});

	it('wirft bei konsultativer Abstimmung und nicht gehaltener Universalversammlung das zweite Ergebnis weg', () => {
		const ausgezaehlt = zaehleAus(lage('leitung', GESCHAEFT));
		expect(ausgezaehlt.andereVerwaltungsvollmacht).not.toBeNull();
		const satz = andereLesartInWorten(ausgezaehlt.andereVerwaltungsvollmacht!, false).protokoll!;
		expect((ausgezaehlt.protokollhinweise ?? []).map((h) => h.satz)).toContain(satz);
		for (const grund of ['konsultativ', 'widerspruch'] as const) {
			const a = mitKeinemBeschluss(ausgezaehlt, { grund, namen: [] });
			expect(a.andereVerwaltungsvollmacht, grund).toBeNull();
			expect((a.protokollhinweise ?? []).map((h) => h.satz), grund).not.toContain(satz);
		}
	});
});

describe('L8, G-6: das Häkchen im Verlauf beim Anlegen und Erben', () => {
	it('trägt das Häkchen im Ereignis des Anlegens, nur wenn es trägt', () => {
		// Folge- und Gegenantrag laufen über dieselbe Funktion; das Erben
		// zeigt der DB-Test zu Entscheid 5 am echten Weg.
		const an = legeTraktandumAn('t-1', 'op-1', 1, {
			meetingId: 'v-1',
			parentId: null,
			titel: 'Entlastung der Verwaltung',
			art: 'abstimmung',
			antragswortlaut: 'Die Verwaltung wird entlastet.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [],
			verwaltungsGeschaeft: true
		});
		expect(an.ereignisse[0].angaben).toMatchObject({ verwaltungsGeschaeft: true });
		// Ohne Häkchen steht keine Verneinung im Verlauf, die niemand
		// angekreuzt hat.
		const ohne = legeTraktandumAn('t-2', 'op-1', 1, {
			meetingId: 'v-1',
			parentId: null,
			titel: 'Sanierung der Fassade',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [],
			verwaltungsGeschaeft: false
		});
		expect(ohne.ereignisse[0].angaben).not.toHaveProperty('verwaltungsGeschaeft');
	});
});

describe('Entscheid 0045, Punkt 9: die Sätze vor dem Eröffnen je Lage', () => {
	const basis = { wahl: 'ruhen' as const, wahlTrotzHaekchen: false, ausstandErklaert: false, abberufungTrotzHaekchen: false };

	it('nennt an der Abberufung als Folgeantrag den eigenen Satz, je Einstellung', () => {
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, abberufungTrotzHaekchen: true }, null)).toEqual([
			VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN
		]);
		expect(
			verwaltungssaetzeVorDemEroeffnen({ ...basis, wahl: 'leitung', abberufungTrotzHaekchen: true }, null)
		).toEqual([VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_LEITUNG]);
	});

	it('nennt den vorab erklärten Ausstand an der Wahl unter «leitung» mit der Rüge, unter «ruhen» ohne', () => {
		expect(
			verwaltungssaetzeVorDemEroeffnen({ ...basis, wahlTrotzHaekchen: true, ausstandErklaert: true }, null)
		).toEqual([VERWALTUNG_WAHL_TROTZ_HAKEN_RUHEN, VERWALTUNG_WAHL_AUSSTAND_ERKLAERT]);
		expect(
			verwaltungssaetzeVorDemEroeffnen(
				{ ...basis, wahl: 'leitung', wahlTrotzHaekchen: true, ausstandErklaert: true },
				null
			)
		).toEqual([VERWALTUNG_WAHL_TROTZ_HAKEN_LEITUNG, VERWALTUNG_WAHL_AUSSTAND_ERKLAERT_LEITUNG]);
	});

	it('lässt am Folgeantrag zur Wahl die Anleitung zum Aufteilen weg (Codeprüfung P9, G-3)', () => {
		const [satz] = verwaltungssaetzeVorDemEroeffnen({ ...basis, wahlTrotzHaekchen: true, amFolgeantrag: true }, null);
		expect(satz).toBe(verwaltungWahlTrotzHakenRuhen(true));
		expect(satz).toContain(
			'Kündigt sie sie nicht an, stimmen Sie diesen Folgeantrag nicht ab; die Wahl kommt auf eine spätere Versammlung.'
		);
		expect(satz).not.toContain('«Gegenantrag»');
	});

	it('ersetzt mit dem Satz zur Sperre am Grundantrag alle übrigen, auch ohne Vollmachten der Verwaltung', () => {
		expect(verwaltungssaetzeVorDemEroeffnen(basis, 'Sperre')).toEqual(['Sperre']);
		expect(verwaltungssaetzeVorDemEroeffnen(null, 'Sperre')).toEqual(['Sperre']);
		expect(verwaltungssaetzeVorDemEroeffnen(null, null)).toEqual([]);
		expect(verwaltungssaetzeVorDemEroeffnen(basis, null)).toEqual([VERWALTUNG_RUHEN_LEITUNG]);
	});
});
