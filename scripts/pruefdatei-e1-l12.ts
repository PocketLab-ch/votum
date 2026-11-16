/**
 * Prüfdatei der Texte zu L12 (Zählung der Einstimmigkeit bei der luxuriösen
 * baulichen Massnahme), aus dem Code erzeugt wie `pruefdatei-e1-l11.ts`
 * (Konzept Lesarten, Abschnitt 4). Gezeigt wird der Katalogeintrag, die Karte
 * nach beiden Wahlen, der Kartensatz vor der Abstimmung nach beiden Wahlen und
 * vier Fälle nach der Auszählung, je Leitung und Protokoll.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-e1-l12.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { LUXURIOES_ID } from '$lib/rules/quorum-2026-11-10';
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

const ANWESENDE_WAHL: Lesartenwahl = { ...LESARTEN_VORGABE, L12: 'anwesende' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Vorgabe «Alle eingetragenen Eigentümer»', LESARTEN_VORGABE],
	['Umgestellt auf «Alle Anwesenden und Vertretenen»', ANWESENDE_WAHL]
];

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block B (L12 luxuriöse bauliche Massnahme)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-e1-l12.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Die Karte erscheint im Entscheidbaum unter «Bauen, sanieren, erneuern» › «Dient die Massnahme nur',
	'der Verschönerung, der Ansehnlichkeit oder der Bequemlichkeit» › «Wird ein nicht zustimmender',
	'Eigentümer im Gebrauch dauernd beeinträchtigt?» › «Luxuriöse bauliche Massnahme».',
	''
);

aus('## 1. Katalog: Seite «Lesarten»', '');
const l12 = lesartVon('L12')!;
aus(`- **Frage:** ${l12.frage}`);
for (const w of l12.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(
		`- **Wahl «${w.bezeichnung}»${w.wert === l12.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`
	);
}
aus(`- **Warum die Vorgabe:** ${l12.warumVorgabe}`);
if (l12.geltung) aus(`- **Geltung:** ${l12.geltung}`);
// Das Feld tragen nur L11 und L12; es steht unter der Wahl, die nicht die Vorgabe ist.
if (l12.folgeMilderWahl)
	aus(
		`- **Folge der milden Wahl (steht immer unter «Alle Anwesenden und Vertretenen»; auf der Karte nur, wenn eingestellt):** ${l12.folgeMilderWahl}`
	);
aus('');

aus('## 2. Karte nach beiden Wahlen', '');
const knoten = RW.knoten.find((k) => k.id === LUXURIOES_ID)!;
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
 * 150 und 140 von 1000. Im zweiten und dritten Fall ist der Eigentümer zu 140
 * abwesend, weder da noch vertreten; im ersten und vierten sind alle sechs da.
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
const ALLE_SECHS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const FUENF = ['p1', 'p2', 'p3', 'p4', 'p5'];

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-10T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Alle sechs Eigentümer sind da und stimmen zu: nach beiden Lesarten angenommen. */
const ALLE_ZU = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'yes'],
	['p6', 'yes']
);
/** Alle fünf Anwesenden stimmen zu, der Eigentümer zu 140 fehlt. */
const ANWESENDE_ZU = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'yes']);
/** Ein Anwesender enthält sich: nach beiden Lesarten abgelehnt. */
const ENTHALTUNG = stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes'], ['p4', 'yes'], ['p5', 'abstain']);

for (const [titel, wahl, anwesende, stimmenAb] of [
	['Beide Lesarten angenommen: alle sechs Eigentümer stimmen zu', LESARTEN_VORGABE, ALLE_SECHS, ALLE_ZU],
	[
		'Eingestellt «Alle eingetragenen Eigentümer»: abgelehnt, weil einer fehlt; nach der milden Lesart angenommen',
		LESARTEN_VORGABE,
		FUENF,
		ANWESENDE_ZU
	],
	[
		'Eingestellt «Alle Anwesenden und Vertretenen»: angenommen; nach der strengen Lesart abgelehnt',
		ANWESENDE_WAHL,
		FUENF,
		ANWESENDE_ZU
	],
	['Beide Lesarten abgelehnt: ein Anwesender enthält sich', ANWESENDE_WAHL, FUENF, ENTHALTUNG]
] as const) {
	const a = zaehleAus({
		momentaufnahme: M,
		erfordernis: wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl),
		stimmen: stimmenAb,
		anwesende,
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
