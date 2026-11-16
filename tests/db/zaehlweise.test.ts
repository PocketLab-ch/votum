/**
 * Die Zählweise der Kopfstimmen, durch die ganze Kette (FR-18 bis FR-22).
 *
 * **Warum das eigens geprüft wird.** `head_count_mode` ist die folgenreichste
 * Einstellung der ganzen Anwendung: Sie entscheidet, ob ein Eigentümer mit drei
 * Wohnungen eine Stimme hat oder drei. Rechtlich gilt eine Stimme je Person
 * (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2); die meisten Reglemente weichen
 * davon ab. Wer hier falsch einstellt, bekommt ein Ergebnis, das plausibel
 * aussieht und falsch ist.
 *
 * Der Kern rechnet die Zählweise in `domain/eigentuemer.ts` und
 * `domain/auszaehlung.ts`, beides mit Wertetabellen geprüft. Was dort **nicht**
 * geprüft werden kann, ist die Kette: Stammdaten → eingefrorener
 * Stimmberechtigtenstand → Auszählung → Ergebnis. Genau dort sitzt der Fehler,
 * der niemandem auffällt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearbeiteGemeinschaft, erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	gibStimmenAb,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holeMomentaufnahme } from '$lib/server/freigabe';
// **Die Kopfstimmen stehen nicht in der Datenbank — sie werden gerechnet.**
// Die Momentaufnahme hält die Tatsachen fest (Einheiten, Zählweise), und der
// Kern leitet daraus die Stimmkraft ab (AD-1). Genau deshalb lässt sich sie mit
// einer Wertetabelle belegen; hier wird geprüft, dass die Kette die richtigen
// Tatsachen einfriert.
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Einfaches Mehr: mehr als die Hälfte der anwesenden oder vertretenen Kopfstimmen. */
const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

/**
 * **Dieselbe Gemeinschaft, zweimal — nur die Zählweise unterscheidet sich.**
 *
 * Aebi gehören drei Wohnungen, Bucher und Christen je eine. Aebi stimmt Ja, die
 * beiden anderen Nein. Die Wertquoten sind in beiden Läufen dieselben; einzig
 * die Kopfstimmen fallen anders aus — und mit ihnen das Ergebnis.
 */
async function aufgebaut(
	name: string,
	datum: string,
	modus: 'per_owner' | 'per_unit',
	nebenobjekte = false
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: modus,
		parkingCountsAsHead: nebenobjekte,
		parentStwegId: null,
		headCountRuleSource: modus === 'per_unit' ? 'Art. 28 Abs. 1 Reglement' : undefined
	});

	async function partei(wer: string, einheiten: [string, number, 'unit' | 'parking'][]) {
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		for (const [label, quote, art] of einheiten) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: art,
				label,
				quotas: { stamm: quote },
				countsAsHead: true
			});
			await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		}
		return p.id;
	}

	const aebi = await partei('Aebi', [
		['Whg 1', 200, 'unit'],
		['Whg 2', 200, 'unit'],
		['Whg 3', 200, 'unit']
	]);
	const bucher = await partei('Bucher', [['Whg 4', 200, 'unit']]);
	const christen = await partei('Christen', [
		['Whg 5', 100, 'unit'],
		['Parkplatz 1', 100, 'parking']
	]);

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);
	await gibVersammlungFrei(handelnder(betreiber), v.id);

	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, aebi, bucher, christen };
}

/** Führt die Abstimmung durch: Aebi Ja, die beiden anderen Nein. */
async function abgestimmt(s: Awaited<ReturnType<typeof aufgebaut>>) {
	await eroeffneVersammlung(handelnder(betreiber), s.versammlung);
	for (const p of [s.aebi, s.bucher, s.christen]) {
		await bestaetigeAnwesenheit(handelnder(betreiber), s.versammlung, p, 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), s.versammlung, s.traktandum);
	await oeffneAbstimmung(handelnder(betreiber), s.versammlung, s.traktandum);
	await gibStimmenAb(
		handelnder(betreiber),
		s.versammlung,
		[
			{ parteiId: s.aebi, wahl: 'yes' },
			{ parteiId: s.bucher, wahl: 'no' },
			{ parteiId: s.christen, wahl: 'no' }
		],
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
);
	const d = await schliesseAbstimmung(handelnder(betreiber), s.versammlung);
	return holeErgebnis(betreiber, s.versammlung, d.id);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Zählweise');
	benutzer = await pruefbenutzer(betreiber, 'zaehlweisenleitung');
});

afterAll(verbindungenSchliessen);

describe('Der Stimmberechtigtenstand', () => {
	it('gibt bei der Zählung je Eigentümer jedem eine Stimme', async () => {
		const s = await aufgebaut('Zählweg 1', '2027-05-01', 'per_owner');
		const m = await holeMomentaufnahme(betreiber, s.versammlung);

		expect(m?.headCountMode).toBe('per_owner');
		const liste = stimmkraftliste(m!);
		const je = new Map(liste.eintraege.map((e) => [e.displayName, e]));
		expect(je.get('Aebi')?.kopfstimmen).toBe(1);
		expect(je.get('Bucher')?.kopfstimmen).toBe(1);
		expect(je.get('Christen')?.kopfstimmen).toBe(1);
		// Die Wertquote bleibt die Summe der Stammquoten — sie hängt nicht an der
		// Zählweise (ZGB Art. 712e).
		expect(je.get('Aebi')?.wertquote).toBe(600);
		expect(liste.summeKopfstimmen).toBe(3);
	});

	it('zählt bei der Zählung je Einheit die Wohnungen — Nebenobjekte nur auf Wunsch', async () => {
		const ohne = await aufgebaut('Zählweg 2', '2027-05-02', 'per_unit');
		const l1 = stimmkraftliste((await holeMomentaufnahme(betreiber, ohne.versammlung))!);
		const je1 = new Map(l1.eintraege.map((e) => [e.displayName, e]));

		expect(je1.get('Aebi')?.kopfstimmen).toBe(3);
		expect(je1.get('Bucher')?.kopfstimmen).toBe(1);
		// Christen hat Wohnung **und** Parkplatz — der Parkplatz zählt nicht mit.
		expect(je1.get('Christen')?.kopfstimmen).toBe(1);
		expect(l1.summeKopfstimmen).toBe(5);

		const mit = await aufgebaut('Zählweg 3', '2027-05-03', 'per_unit', true);
		const l2 = stimmkraftliste((await holeMomentaufnahme(betreiber, mit.versammlung))!);
		const je2 = new Map(l2.eintraege.map((e) => [e.displayName, e]));
		expect(je2.get('Christen')?.kopfstimmen).toBe(2);
		expect(l2.summeKopfstimmen).toBe(6);
	});

	it('lässt Nebenobjekte bei der Zählung je Eigentümer nicht mitzählen', async () => {
		// Auch wenn jemand es einträgt: Bei einer Stimme je Person gibt es nichts
		// zu erhöhen. Der Kern streicht den Zusatz, und die Momentaufnahme darf
		// ihn nicht auf Umwegen zurückholen.
		const s = await aufgebaut('Zählweg 4', '2027-05-04', 'per_owner', true);
		const m = await holeMomentaufnahme(betreiber, s.versammlung);

		expect(m?.parkingCountsAsHead).toBe(false);
		const liste = stimmkraftliste(m!);
		expect(liste.eintraege.find((e) => e.displayName === 'Christen')?.kopfstimmen).toBe(1);
	});
});

describe('Die bewusste Wahl', () => {
	it('lässt keine Gemeinschaft ohne Zählweise entstehen', async () => {
		/*
		 * **Kein Rückfallwert, und zwar absichtlich.** Eine Voreinstellung wäre
		 * hier falsch, gleich welche: Rechtlich gilt eine Stimme je Eigentümer, in
		 * den meisten Reglementen steht die Zählung je Einheit. Wer nicht wählt,
		 * hat nicht ins Reglement gesehen — und das fiele sonst erst auf, wenn ein
		 * Beschluss angefochten wird.
		 */
		await expect(
			erstelleGemeinschaft(handelnder(betreiber), {
				name: 'Ohne Zählweise',
				quotaDenominator: 1000,
				parkingCountsAsHead: false,
				parentStwegId: null
			} as never)
		).rejects.toThrow(/Zählweise/);
	});

	it('nennt die Abweichung vom Gesetz beim Namen', async () => {
		// Die Momentaufnahme friert die Fundstelle mit ein: In der Auswertung
		// einer alten Versammlung darf nicht der heutige Stand der Stammdaten
		// erscheinen.
		const s = await aufgebaut('Zählweg 8', '2027-05-08', 'per_unit');
		const m = await holeMomentaufnahme(betreiber, s.versammlung);
		expect(m?.headCountRuleSource).toBe('Art. 28 Abs. 1 Reglement');

		// Bei der gesetzlichen Auffangregel bleibt sie leer — ein Verweis aufs
		// Reglement wäre dort irreführend.
		const g = await aufgebaut('Zählweg 9', '2027-05-09', 'per_owner');
		const mg = await holeMomentaufnahme(betreiber, g.versammlung);
		expect(mg?.headCountRuleSource).toBeNull();
	});
});

describe('Dieselben Stimmen, entgegengesetztes Ergebnis', () => {
	/*
	 * **Der Kern der Sache.** Aebi stimmt Ja und hält drei Wohnungen, Bucher und
	 * Christen stimmen Nein und halten je eine. Die Wertquoten sind in beiden
	 * Läufen dieselben — 600 zu 400 für Ja. Nur die Köpfe kippen:
	 *
	 *   je Eigentümer: 1 Ja gegen 2 Nein  → abgelehnt
	 *   je Einheit:    3 Ja gegen 2 Nein  → angenommen
	 *
	 * Wer die Zählweise falsch einstellt, bekommt also nicht etwa eine ungenaue
	 * Zahl, sondern das **gegenteilige Ergebnis** — und es sieht in beiden Fällen
	 * völlig plausibel aus. Deshalb verlangt die Anwendung die bewusste Wahl und
	 * bei der Abweichung vom Gesetz die Fundstelle.
	 */
	it('lehnt bei der Zählung je Eigentümer ab', async () => {
		const s = await aufgebaut('Zählweg 5', '2027-05-05', 'per_owner');
		const e = await abgestimmt(s);

		expect(e.auszaehlung?.koepfe.ja).toBe(1);
		expect(e.auszaehlung?.koepfe.nein).toBe(2);
		expect(e.auszaehlung?.angenommen).toBe(false);
	});

	it('nimmt bei der Zählung je Einheit an — bei genau denselben Stimmen', async () => {
		const s = await aufgebaut('Zählweg 6', '2027-05-06', 'per_unit');
		const e = await abgestimmt(s);

		expect(e.auszaehlung?.koepfe.ja).toBe(3);
		expect(e.auszaehlung?.koepfe.nein).toBe(2);
		expect(e.auszaehlung?.angenommen).toBe(true);
		// Die Wertquoten sind dieselben wie im anderen Lauf — der Unterschied
		// liegt allein bei den Köpfen.
		expect(e.auszaehlung?.quoten.ja).toBe(600);
		expect(e.auszaehlung?.quoten.nein).toBe(400);
	});
});

describe('Die eingefrorene Zählweise', () => {
	it('bleibt, was sie bei der Freigabe war — auch wenn die Stammdaten wechseln', async () => {
		/*
		 * **AD-3.** Die Momentaufnahme ist der Stimmberechtigtenstand *dieser*
		 * Versammlung. Ändert jemand mitten in der Sitzung die Zählweise der
		 * Gemeinschaft — versehentlich oder für die nächste Versammlung —, darf
		 * das die laufende Auszählung nicht anfassen. Sonst verschöbe sich ein
		 * Ergebnis nachträglich, und niemand sähe es der Zahl an.
		 */
		const s = await aufgebaut('Zählweg 7', '2027-05-07', 'per_unit');

		await bearbeiteGemeinschaft(handelnder(betreiber), s.gemeinschaft, {
			name: 'Zählweg 7',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const m = await holeMomentaufnahme(betreiber, s.versammlung);
		expect(m?.headCountMode).toBe('per_unit');
		const liste = stimmkraftliste(m!);
		expect(liste.eintraege.find((e) => e.displayName === 'Aebi')?.kopfstimmen).toBe(3);

		// Und die Auszählung rechnet mit dem eingefrorenen Stand weiter.
		const e = await abgestimmt(s);
		expect(e.auszaehlung?.koepfe.ja).toBe(3);
		expect(e.auszaehlung?.angenommen).toBe(true);
	});
});
