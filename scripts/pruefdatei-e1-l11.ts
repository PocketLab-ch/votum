/**
 * Prüfdatei der Texte zu L11 (Ermächtigung der Bewirtschaftung zur
 * Prozessführung), aus dem Code erzeugt wie `pruefdatei-lesarten.ts`
 * (Konzept Lesarten, Abschnitt 4). Gezeigt wird der Katalogeintrag, die Karte
 * nach beiden Wahlen, der Kartensatz vor der Abstimmung nach beiden Wahlen und
 * vier Fälle nach der Auszählung, je Leitung und Protokoll.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-e1-l11.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { PROZESSFUEHRUNG_ID } from '$lib/rules/quorum-2026-11-10';
import { erfordernisAusKnoten, ergebniskarte, type Ergebniskarte } from '$lib/domain/entscheidbaum';
import {
	LESARTEN_VORGABE,
	knotenNachLesart,
	lesartVon,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	andereLesartInWorten,
	lesartKartensatz,
	lesartProtokollsatz,
	zaehleAus
} from '$lib/domain/auszaehlung';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const RW = holeRegelwerk('2026-11-10');
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

function karte(titel: string, k: Ergebniskarte) {
	aus(`#### ${titel}`, '');
	for (const [feld, wert] of Object.entries(k)) {
		if (feld === 'freigabevermerk' || feld === 'hinweiseUnterRegel' || feld === 'lesart') continue;
		if (wert === null || wert === undefined || wert === '' || typeof wert === 'boolean') continue;
		if (Array.isArray(wert)) {
			if (wert.length === 0) continue;
			aus(`- **${feld}:**`);
			for (const w of wert) aus(`  - ${typeof w === 'string' ? w : JSON.stringify(w)}`);
		} else if (typeof wert === 'object') {
			aus(`- **${feld}:** ${JSON.stringify(wert)}`);
		} else {
			aus(`- **${feld}:** ${String(wert)}`);
		}
	}
	aus('');
}

const EINFACH: Lesartenwahl = { ...LESARTEN_VORGABE, L11: 'einfach' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Vorgabe «Qualifiziertes Mehr»', LESARTEN_VORGABE],
	['Umgestellt auf «Einfaches Mehr»', EINFACH]
];

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block A (L11 Ermächtigung zur Prozessführung)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-e1-l11.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Die Karte erscheint im Entscheidbaum unter «Geld und Jahresgeschäfte» › «Um welches Jahresgeschäft',
	'geht es?» › «Bewirtschaftung zur Prozessführung ermächtigen».',
	''
);

aus('## 1. Katalog: Seite «Lesarten»', '');
const l11 = lesartVon('L11')!;
aus(`- **Frage:** ${l11.frage}`);
for (const w of l11.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(
		`- **Wahl «${w.bezeichnung}»${w.wert === l11.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`
	);
}
aus(`- **Warum die Vorgabe:** ${l11.warumVorgabe}`);
if (l11.geltung) aus(`- **Geltung:** ${l11.geltung}`);
// Das Feld tragen nur L11; es steht unter der Wahl, die nicht die Vorgabe ist.
if (l11.folgeMilderWahl) aus(`- **Folge der milden Wahl (steht immer unter «Einfaches Mehr»; auf der Karte nur, wenn eingestellt):** ${l11.folgeMilderWahl}`);
aus('');

aus('## 2. Karte nach beiden Wahlen', '');
const knoten = RW.knoten.find((k) => k.id === PROZESSFUEHRUNG_ID)!;
for (const [titel, wahl] of WAHLEN) {
	karte(titel, ergebniskarte(RW, knotenNachLesart(RW, knoten, wahl)));
}

aus('## 3. Satz zur Lesart vor der Abstimmung (Traktandenseite, Leitung)', '');
for (const [titel, wahl] of WAHLEN) {
	const e = wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl);
	aus(`- **${titel}:** ${lesartKartensatz(e)}`);
}
aus('');

/*
 * **Vier Fälle nach der Auszählung.** Sechs Eigentümer zu 200, 180, 170, 160,
 * 150 und 140 von 1000; der Eigentümer zu 140 ist abwesend, weder da noch
 * vertreten. Gezählt wird über die fünf Anwesenden; das qualifizierte Mehr
 * verlangt zusätzlich mehr als die Hälfte aller Wertquoten (501).
 */
aus('## 4. Sätze nach der Auszählung (Leitung) und im Protokoll', '');
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-10T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [
		['p1', 'Erika Beispiel', 200],
		['p2', 'Hans Probe', 180],
		['p3', 'Grosse Wohnung AG', 170],
		['p4', 'Ida Muster', 160],
		['p5', 'Kurt Beispiel', 150],
		['p6', 'Lisa Probe', 140]
	].map(([id, name, quote]) => ({
		partyId: id as string,
		displayName: name as string,
		representativeName: null,
		isCommunity: false,
		units: [
			{
				unitId: `${id}-u`,
				label: `Whg ${id}`,
				kind: 'unit' as const,
				countsAsHead: true,
				quota: quote as number
			}
		]
	}))
};
const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5'];

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-10T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Alle fünf Anwesenden stimmen zu: nach beiden Lesarten angenommen. */
const ALLE = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']);
/** Drei Ja zu 170, 160 und 150: das einfache Mehr erreicht, das qualifizierte nicht (480 von 1000). */
const NUR_EINFACH = stimmen(['p1', 'no'], ['p2', 'no'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']);
/** Zwei Ja: nach beiden Lesarten abgelehnt. */
const ZU_WENIG = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no'], ['p4', 'no'], ['p5', 'no']);

for (const [titel, wahl, stimmenAb] of [
	['Beide Lesarten angenommen: alle fünf Anwesenden stimmen zu', LESARTEN_VORGABE, ALLE],
	[
		'Eingestellt «Qualifiziertes Mehr»: abgelehnt; nach dem einfachen Mehr angenommen',
		LESARTEN_VORGABE,
		NUR_EINFACH
	],
	[
		'Eingestellt «Einfaches Mehr»: angenommen; nach dem qualifizierten Mehr abgelehnt',
		EINFACH,
		NUR_EINFACH
	],
	['Beide Lesarten abgelehnt: zwei Ja von fünf Anwesenden', LESARTEN_VORGABE, ZU_WENIG]
] as const) {
	const a = zaehleAus({
		momentaufnahme: M,
		erfordernis: wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl),
		stimmen: stimmenAb,
		anwesende: ANWESENDE,
		geheim: false
	});
	const s = a.andereLesart ? andereLesartInWorten(a.andereLesart, false) : null;
	aus(
		`### ${titel}`,
		'',
		`- **Ergebnis nach der eingestellten Wahl:** ${a.angenommen ? 'angenommen' : 'abgelehnt'}`,
		`- **Leitung:** ${s?.leitung ?? '(kein Satz)'}`,
		`- **Protokoll am Ausgang:** ${s?.protokoll ?? '(kein Satz)'}`,
		''
	);
}

aus('### Zeile im Protokoll je Beschluss', '');
for (const [titel, wahl] of WAHLEN) {
	aus(`- **${titel}:** ${lesartProtokollsatz(wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl))}`);
}
aus('');

console.log(zeilen.join('\n'));
