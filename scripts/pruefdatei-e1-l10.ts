/**
 * Prüfdatei der Texte zu L10 (Angehörige des Beklagten im Ausstand an der
 * Ermächtigung zur Ausschlussklage), aus dem Code erzeugt wie
 * `pruefdatei-e1-l9.ts` (Konzept Lesarten, Abschnitt 4). Gezeigt wird der
 * Katalogeintrag, die Karte mit dem Hinweis zu den Angehörigen, der Satz vor
 * der Abstimmung nach beiden Wahlen, der Hinweis an die Leitung nach beiden
 * Wahlen und vier Fälle nach der Auszählung, je Leitung und Protokoll.
 *
 * **Die Karte ist für beide Wahlen dieselbe.** Kein Knoten trägt L10; die Wahl
 * wirkt erst in der Zählung (`ausstandBleibtInDerZahl`). Der Hinweis 9 der Karte
 * sagt das und nennt die Seite «Lesarten».
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-e1-l10.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { AUSSCHLUSSKLAGE_ID } from '$lib/rules/quorum-2026-11-10';
import {
	erfordernisAusKnoten,
	ergebniskarte,
	type Erfordernis,
	type Ergebniskarte
} from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, lesartVon, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	andereLesartInWorten,
	angehoerigenhinweis,
	angehoerigenlesartHinweis,
	zaehleAus,
	zweitesErgebnisImProtokoll
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

const OHNE_ANGEHOERIGE: Lesartenwahl = { ...LESARTEN_VORGABE, L10: 'fallen_heraus' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Vorgabe «Bleiben in der Zahl»', LESARTEN_VORGABE],
	['Umgestellt auf «Fallen aus der Zahl»', OHNE_ANGEHOERIGE]
];

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, E1 Block D (L10 Angehörige im Ausstand an der Ermächtigung zur Ausschlussklage)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-e1-l10.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Die Karte erscheint im Entscheidbaum unter «Sonderfälle» › «Welcher Sonderfall?» ›',
	'«Bewirtschaftung zur Ausschlussklage gegen einen Eigentümer ermächtigen» › «Ermächtigung zur',
	'Ausschlussklage».',
	''
);

aus('## 1. Katalog: Seite «Lesarten»', '');
const l10 = lesartVon('L10')!;
aus(`- **Frage:** ${l10.frage}`);
for (const w of l10.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(
		`- **Wahl «${w.bezeichnung}»${w.wert === l10.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`
	);
}
aus(`- **Warum die Vorgabe:** ${l10.warumVorgabe}`);
if (l10.geltung) aus(`- **Geltung:** ${l10.geltung}`);
// Das Feld tragen L9, L10, L11 und L12; es steht unter der Wahl, die nicht die Vorgabe ist.
if (l10.folgeMilderWahl)
	aus(
		`- **Folge der milden Wahl (steht immer unter «Fallen aus der Zahl»; auf der Karte nur, wenn eingestellt):** ${l10.folgeMilderWahl}`
	);
aus('');

aus('## 2. Karte (für beide Wahlen dieselbe)', '');
const knoten = RW.knoten.find((k) => k.id === AUSSCHLUSSKLAGE_ID)!;
karte('Ermächtigung zur Ausschlussklage', ergebniskarte(RW, knoten));

/**
 * Das Erfordernis mit der Wahl zu L10. **Nicht über `wendeLesartAn`:** Das
 * tauscht das Mehr einer Lesart, die der Knoten trägt, und kein Knoten trägt
 * L10. Im Betrieb kommt die Wahl aus der Spalte `requirement_reading_l10`
 * (`erfordernisAusZeile` in `server/erfordernisspalten.ts`).
 */
function erfordernis(wahl: Lesartenwahl): Erfordernis {
	return { ...erfordernisAusKnoten(RW, knoten), angehoerigenlesart: wahl.L10 };
}

aus('## 3. Satz vor der Abstimmung (W11) nach beiden Wahlen', '');
for (const [titel, wahl] of WAHLEN) {
	aus(`- **${titel}:** ${angehoerigenlesartHinweis(erfordernis(wahl)) ?? '(kein Satz)'}`);
}
aus('');

aus('## 4. Hinweis an die Leitung zu den Angehörigen (W13) nach beiden Wahlen', '');
for (const [titel, wahl] of WAHLEN) {
	aus(`- **${titel}:** ${angehoerigenhinweis(erfordernis(wahl)) ?? '(kein Hinweis)'}`);
}
aus('');

/*
 * **Vier Fälle nach der Auszählung.** Elf Eigentümer zu je 100 von 1100; p11 ist
 * der Beklagte, p10 seine Ehefrau mit eigener Wohnung im Ausstand, p1 bis p9
 * sind da. Mit den Angehörigen in der Zahl braucht es sechs Ja von zehn, ohne
 * sie fünf von neun.
 */
aus('## 5. Sätze nach der Auszählung (Leitung) und im Protokoll', '');
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-10T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1100,
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
		['p10', 'Pia Beispiel'],
		['p11', 'Quirin Muster']
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
const ANWESENDE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
const AUSSTAND = ['p10'];
const BEKLAGTER = ['p11'];

function stimmen(...wahlen: [string, VoteChoice][]): Vote[] {
	return wahlen.map(([p, choice]) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-11-10T19:10:00.000Z',
		recordedByChair: false
	}));
}

/** Sechs Ja, drei Nein: nach beiden Wahlen angenommen. */
const SECHS = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'yes'],
	['p6', 'yes'],
	['p7', 'no'],
	['p8', 'no'],
	['p9', 'no']
);
/** Fünf Ja, vier Nein: mit ihnen in der Zahl zu wenig, ohne sie genug. */
const FUENF = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'yes'],
	['p6', 'no'],
	['p7', 'no'],
	['p8', 'no'],
	['p9', 'no']
);
/** Vier Ja, fünf Nein: nach beiden Wahlen abgelehnt. */
const VIER = stimmen(
	['p1', 'yes'],
	['p2', 'yes'],
	['p3', 'yes'],
	['p4', 'yes'],
	['p5', 'no'],
	['p6', 'no'],
	['p7', 'no'],
	['p8', 'no'],
	['p9', 'no']
);

for (const [titel, wahl, stimmenAb] of [
	['Beide Wahlen angenommen: sechs von neun Anwesenden stimmen zu', LESARTEN_VORGABE, SECHS],
	[
		'Eingestellt «Bleiben in der Zahl»: abgelehnt; ohne die Angehörigen angenommen',
		LESARTEN_VORGABE,
		FUENF
	],
	[
		'Eingestellt «Fallen aus der Zahl»: angenommen; mit ihnen in der Zahl abgelehnt',
		OHNE_ANGEHOERIGE,
		FUENF
	],
	['Beide Wahlen abgelehnt: vier Ja von neun Anwesenden', LESARTEN_VORGABE, VIER]
] as const) {
	const a = zaehleAus({
		momentaufnahme: M,
		erfordernis: erfordernis(wahl),
		stimmen: stimmenAb,
		anwesende: ANWESENDE,
		imAusstand: AUSSTAND,
		betroffeneParteiIds: BEKLAGTER,
		geheim: false
	});
	const zweites = a.andereAngehoerigenlesart;
	const s = zweites ? andereLesartInWorten(zweites, false) : null;
	aus(
		`### ${titel}`,
		'',
		`- **Ergebnis nach der eingestellten Wahl:** ${a.angenommen ? 'angenommen' : 'abgelehnt'}`,
		`- **Köpfe:** ${a.koepfe.ja} Ja von ${a.koepfe.basis}, nötig ${a.koepfe.schwelle ?? 0}`,
		`- **Leitung:** ${s?.leitung ?? '(kein Satz)'}`,
		// Wie das Hausprotokoll: L10 ohne Abweichung steht dort nicht (Codeprüfung
		// Block D, N3).
		`- **Protokoll am Ausgang:** ${zweites && zweitesErgebnisImProtokoll(zweites) ? (s?.protokoll ?? '(kein Satz)') : '(kein Satz im Protokoll)'}`,
		''
	);
}

console.log(zeilen.join('\n'));
