/**
 * Prüfdatei der Texte zu L9 (Zählbasis der Ermächtigung zur Ausschlussklage),
 * aus dem Code erzeugt wie `pruefdatei-e1-l12.ts` (Konzept Lesarten,
 * Abschnitt 4). Gezeigt wird der Katalogeintrag, die Karte nach beiden Wahlen,
 * der Kartensatz vor der Abstimmung nach beiden Wahlen und vier Fälle nach der
 * Auszählung, je Leitung und Protokoll.
 *
 * **Das zweite Ergebnis rechnet hier 1a**, nicht der allgemeine Lesartenweg:
 * Die andere Zählbasis ist die Zählung nach den Anwesenden ohne den Beklagten,
 * und die kennt `andereZaehlbasisVon` seit dem Entscheid 0018. Das Skript liest
 * deshalb `andereZaehlbasis` und fällt nur zur Sicherheit auf `andereLesart`
 * zurück.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-e1-l9.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { AUSSCHLUSSKLAGE_ID } from '$lib/rules/quorum-2026-11-10';
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

const ANWESENDE_WAHL: Lesartenwahl = { ...LESARTEN_VORGABE, L9: 'anwesende' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Vorgabe «Alle Eigentümer ohne den Beklagten»', LESARTEN_VORGABE],
	['Umgestellt auf «Anwesende und Vertretene ohne den Beklagten»', ANWESENDE_WAHL]
];

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block C (L9 Zählbasis der Ermächtigung zur Ausschlussklage)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-e1-l9.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Die Karte erscheint im Entscheidbaum unter «Sonderfälle» › «Welcher Sonderfall?» ›',
	'«Bewirtschaftung zur Ausschlussklage gegen einen Eigentümer ermächtigen» › «Ermächtigung zur',
	'Ausschlussklage».',
	''
);

aus('## 1. Katalog: Seite «Lesarten»', '');
const l9 = lesartVon('L9')!;
aus(`- **Frage:** ${l9.frage}`);
for (const w of l9.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(
		`- **Wahl «${w.bezeichnung}»${w.wert === l9.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`
	);
}
aus(`- **Warum die Vorgabe:** ${l9.warumVorgabe}`);
if (l9.geltung) aus(`- **Geltung:** ${l9.geltung}`);
// Das Feld tragen L9, L11 und L12; es steht unter der Wahl, die nicht die Vorgabe ist.
if (l9.folgeMilderWahl)
	aus(
		`- **Folge der milden Wahl (steht immer unter «Anwesende und Vertretene ohne den Beklagten»; auf der Karte nur, wenn eingestellt):** ${l9.folgeMilderWahl}`
	);
aus('');

aus('## 2. Karte nach beiden Wahlen', '');
const knoten = RW.knoten.find((k) => k.id === AUSSCHLUSSKLAGE_ID)!;
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
 * **Vier Fälle nach der Auszählung.** Zehn Eigentümer zu je 100 von 1000; der
 * Eigentümer zu p10 ist der Beklagte und weder da noch vertreten, von den neun
 * übrigen sind sechs da oder vertreten. An den neun übrigen braucht es fünf Ja,
 * an den sechs Anwesenden vier.
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
		['p1', 'Erika Beispiel'],
		['p2', 'Hans Probe'],
		['p3', 'Grosse Wohnung AG'],
		['p4', 'Ida Muster'],
		['p5', 'Kurt Beispiel'],
		['p6', 'Lisa Probe'],
		['p7', 'Martin Beispiel'],
		['p8', 'Nora Probe'],
		['p9', 'Otto Muster'],
		['p10', 'Pia Beispiel']
	].map(([id, name]) => ({
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
				quota: 100
			}
		]
	}))
};
const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const BEKLAGTER = ['p10'];

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-10T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Fünf Ja, ein Nein: nach beiden Wahlen angenommen. */
const FUENF = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'yes'],
	['p6', 'no']
);
/** Vier Ja, zwei Nein: an den neun übrigen zu wenig, an den sechs Anwesenden genug. */
const VIER = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'no'],
	['p6', 'no']
);
/** Drei Ja, drei Nein: nach beiden Wahlen abgelehnt. */
const DREI = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'no'],
	['p5', 'no'],
	['p6', 'no']
);

for (const [titel, wahl, stimmenAb] of [
	['Beide Wahlen angenommen: fünf von sechs Anwesenden stimmen zu', LESARTEN_VORGABE, FUENF],
	[
		'Eingestellt «Alle Eigentümer ohne den Beklagten»: abgelehnt; nach den Anwesenden angenommen',
		LESARTEN_VORGABE,
		VIER
	],
	[
		'Eingestellt «Anwesende und Vertretene ohne den Beklagten»: angenommen; nach allen abgelehnt',
		ANWESENDE_WAHL,
		VIER
	],
	['Beide Wahlen abgelehnt: drei Ja von sechs Anwesenden', LESARTEN_VORGABE, DREI]
] as const) {
	const a = zaehleAus({
		momentaufnahme: M,
		erfordernis: wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl),
		stimmen: stimmenAb,
		anwesende: ANWESENDE,
		betroffeneParteiIds: BEKLAGTER,
		geheim: false
	});
	// L9 rechnet das zweite Ergebnis über 1a; `andereLesart` bleibt leer.
	const zweites = a.andereZaehlbasis ?? a.andereLesart;
	const s = zweites ? andereLesartInWorten(zweites, false) : null;
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
