/**
 * Prüfdatei der Texte aus Lesarten Block 5 (L3, Einsprache je Eigentümer), aus
 * dem Code erzeugt, wie `scripts/pruefdatei-lesart-ausstand.ts` für Block 2.
 *
 * **Warum ein Skript.** Eine abgeschriebene Prüfdatei prüft die Abschrift. Die
 * Sätze für Karte, Leitung, Handzählung, Protokoll und Mappe kommen hier aus
 * denselben Funktionen, die die Anwendung ruft, je an dem Fall, an dem sie
 * erscheinen.
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-lesart-einsprache.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { EINSPRACHE_KNOTEN, ergebniskarte, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import {
	EINSPRACHE_ZAEHLHILFE_VORSATZ,
	einsprachelesartKartensatz,
	einspracheHandzaehlungTexte,
	lesartVon,
	type Einsprachewahl
} from '$lib/domain/lesarten';
import {
	andereLesartenVon,
	andereLesartInWorten,
	einsprachelesartProtokollsatz,
	einspracheZaehlhilfe,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlung,
	type Auszaehlungslage,
	type Handzaehlung
} from '$lib/domain/auszaehlung';
import { baueAuszaehlmappe, einspracheMappensatz } from '$lib/domain/auszaehlmappe';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);
const zitat = (t: string | null | undefined) => aus(t ? `> ${t}` : '> (kein Satz)', '');

/** Gemeinschaft je Einheit: Partei 1 und 2 je eine Wohnung, Partei 3 drei, Partei 4 verkauft. */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-28T17:00:00.000Z',
	headCountMode: 'per_unit',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [1, 1, 3, 1].map((n, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Partei ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: Array.from({ length: n }, (_, j) => ({
			unitId: `p${i + 1}-u${j + 1}`,
			label: `Whg ${i + 1}.${j + 1}`,
			kind: 'unit' as const,
			countsAsHead: true,
			quota: 160
		}))
	}))
};

const RW = holeRegelwerk('2026-10-28');
const KNOTEN = RW.knoten.find((k) => k.id === EINSPRACHE_KNOTEN)!;
const GRUND = waehleErfordernis(RW, EINSPRACHE_KNOTEN).ergebnis!;
const mit = (wahl: Einsprachewahl): Erfordernis => ({ ...GRUND, einspracheLesart: wahl });

function stimmen(...w: [number, VoteChoice][]): Vote[] {
	return w.flatMap(([i, choice]) =>
		M.parties[i - 1].units.map((u) => ({
			partyId: `p${i}`,
			unitId: u.unitId,
			choice,
			castAt: '2026-10-28T19:10:00.000Z',
			recordedByChair: false
		}))
	);
}

function lage(e: Erfordernis, s: Vote[]): Auszaehlungslage {
	return {
		momentaufnahme: M,
		erfordernis: e,
		stimmen: s,
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		betroffeneParteiIds: ['p4']
	};
}

function zweites(a: Auszaehlung, geheim: boolean) {
	const r = andereLesartenVon(a).find((x) => x.kennung === 'L3');
	return r ? andereLesartInWorten(r, geheim) : null;
}

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, Block 5 (L3, Einsprache)',
	'',
	'Erzeugt aus dem Code mit `scripts/pruefdatei-lesart-einsprache.ts`, Fassung 2026-10-28.',
	'Leserin: Verwaltung und Sitzungsleitung (Texte nach innen mit Rechtsaussagen, die im Saal und',
	'im Protokoll zählen). Das Protokoll lesen auch Eigentümer. Die Seite «Lesarten» liest, wer die',
	'Einstellung wählt.',
	'',
	'Beispielgemeinschaft für alle Fälle: zählt nach dem Reglement je Einheit. Partei 1 und 2 haben je',
	'eine Wohnung, Partei 3 hat drei, Partei 4 verkauft ihre Wohnung (betroffen, stimmt nicht mit).',
	''
);

// ── 1. Seite «Lesarten» ─────────────────────────────────────────────────────
const l3 = lesartVon('L3')!;
aus('## 1. Seite «Lesarten», Eintrag L3', '', '**Frage**', '');
zitat(l3.frage);
aus('**Gegenstand** (im Protokoll als «Ob …, ist umstritten»)', '');
zitat(l3.gegenstand);
for (const w of l3.wahlen) {
	aus(`**Wahl «${w.bezeichnung}»**${w.wert === l3.vorgabe ? ' (Vorgabe)' : ''}`, '', 'Wirkung:', '');
	zitat(w.wirkung);
	aus('Fundstelle:', '');
	zitat(w.fundstelle);
}
aus('**Warum die Vorgabe**', '');
zitat(l3.warumVorgabe);
aus('**Wo die Einstellung gilt**', '');
zitat(l3.geltung);

// ── 2. Karte ────────────────────────────────────────────────────────────────
aus('## 2. Karte «Einsprache» vor der Abstimmung', '');
const zahlen = { kopfstimmen: 6, eigentuemer: 4, gesamtquote: 1000, zaehlweise: 'per_unit' as const };
for (const wahl of ['je_eigentuemer', 'je_einheit'] as const) {
	const karte = ergebniskarte(RW, KNOTEN, zahlen, wahl);
	aus(`### Nach der Wahl «${lesartVon('L3')!.wahlen.find((w) => w.wert === wahl)!.bezeichnung}»`, '');
	aus('Begründung:', '');
	zitat(karte.begruendung);
	aus('Zahlenbeispiel:', '');
	zitat(karte.zahlenbeispiel);
	aus('Hinweise (der letzte ist der Satz zur Zählweise):', '');
	for (const h of karte.hinweise) zitat(h);
}
aus('### Zum Vergleich: Kartensatz allein, beide Wahlen', '');
zitat(einsprachelesartKartensatz('je_eigentuemer'));
zitat(einsprachelesartKartensatz('je_einheit'));

// ── 3. Leitung nach der Auszählung ──────────────────────────────────────────
aus(
	'## 3. Leitung, einzeln erfasste Stimmen',
	'',
	'Partei 1 und 2 stimmen Ja, Partei 3 Nein. Je Eigentümer 2 zu 1, je Einheit 2 zu 3.',
	''
);
for (const wahl of ['je_eigentuemer', 'je_einheit'] as const) {
	for (const geheim of [false, true]) {
		const a = zaehleAus({ ...lage(mit(wahl), stimmen([1, 'yes'], [2, 'yes'], [3, 'no'])), geheim });
		const s = zweites(a, geheim);
		aus(`### Wahl ${wahl}, ${geheim ? 'geheim' : 'offen'}: ${a.angenommen ? 'beschlossen' : 'abgelehnt'}`, '', 'Leitung:', '');
		zitat(s?.leitung);
		aus('Protokoll (Ausgang):', '');
		zitat(s?.protokoll);
	}
}
aus('### Ergebnisse fallen zusammen (Partei 1, 2 und 3 Ja)', '');
zitat(zweites(zaehleAus(lage(mit('je_eigentuemer'), stimmen([1, 'yes'], [2, 'yes'], [3, 'yes']))), false)?.leitung);

// ── 4. Protokoll ────────────────────────────────────────────────────────────
aus('## 4. Protokoll, Zeile zur Zählweise', '');
for (const wahl of ['je_eigentuemer', 'je_einheit'] as const) {
	aus(`Wahl ${wahl}:`, '');
	zitat(einsprachelesartProtokollsatz(mit(wahl), M));
}

// ── 5. Handzählung ──────────────────────────────────────────────────────────
aus('## 5. Leitung, Handzählung an der Einsprache', '');
for (const wahl of ['je_eigentuemer', 'je_einheit'] as const) {
	const t = einspracheHandzaehlungTexte(wahl);
	aus(`### Wahl ${wahl}`, '', `**${t.ueberschrift}**`, '');
	zitat(t.erklaerung);
	aus(`Feld: «${t.feldEigentuemer}»${wahl === 'je_eigentuemer' ? ` (${t.zusatz})` : ''}`, '');
	aus(`Feld: «${t.feldEinheit}»${wahl === 'je_einheit' ? ` (${t.zusatz})` : ''}`, '');
	aus('Zählhilfe:', '');
	zitat(EINSPRACHE_ZAEHLHILFE_VORSATZ + einspracheZaehlhilfe(lage(mit(wahl), [])).join(', '));
	aus('Absage, wenn die zweite Zählung fehlt:', '');
	zitat(t.absage);
}
aus('### Handzählung mit beiden Dreizahlen, Vorgabe: je Eigentümer 2:1:0, je Einheit 2:3:0', '');
const summe: Handzaehlung = { ja: 2, nein: 1, enthaltung: 0, andereJa: 2, andereNein: 3, andereEnthaltung: 0 };
const h = zaehleSummenAus({ ...lage(mit('je_eigentuemer'), []) }, summe);
zitat(zweites(h, false)?.leitung);
aus('Hinweise der Handzählung:', '');
for (const x of h.hinweise) zitat(x);

// ── 6. Mappe ────────────────────────────────────────────────────────────────
aus('## 6. Auszählmappe für den Ausfall, Anleitung', '', 'Neue Spalte «Stimme je Eigentümer», dazu:', '');
zitat(einspracheMappensatz('je_eigentuemer'));
aus('Legende der 8 in einer Mappe mit Einsprache:', '');
{
	const blatt = baueAuszaehlmappe({
		gemeinschaftName: 'Prüf',
		datum: '28. Oktober 2026',
		uhrzeit: '19:00',
		ort: 'Saal',
		gesamtquote: 1000,
		jeEinheit: true,
		parteien: [{ name: 'Partei 1', kopfstimmen: 1, kopfstimmenJeEigentuemer: 1, wertquote: 1000 }],
		posten: [
			{
				nummer: '1',
				titel: 'Einsprache',
				erfordernis: 'Einfaches Mehr',
				kopfbasis: 'anwesend_vertreten',
				kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenbasis: 'keine',
				quotenSchwelle: null,
				ohneBetroffene: true,
				vollmachtenBetroffenerZaehlenNicht: true,
				zaehlweise: 'per_owner'
			}
		]
	});
	const legende = blatt.zeilen
		.flat()
		.map((z) => (z.art === 'text' ? z.wert : ''))
		.find((t) => t.startsWith('nur über eine Person vertreten'));
	if (!legende) throw new Error('Die Legende der 8 fehlt in der Mappe.');
	zitat(legende);
}

// Seit A3 rechnet die Spalte «zum Vergleich» die andere Zählweise; der Satz
// hängt an der Wahl, nicht mehr am gesetzlichen Mehr.
aus('Nach der Wahl «je Einheit»:', '');
zitat(einspracheMappensatz('je_einheit'));

process.stdout.write(zeilen.join('\n') + '\n');
