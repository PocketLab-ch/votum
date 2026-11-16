/**
 * Prüfdatei der Texte aus Lesarten Block 6 (1a und das Mehr aus Gesetz und
 * Reglement), aus dem Code erzeugt wie `scripts/pruefdatei-lesart-einsprache.ts`
 * für Block 5. Die Sätze kommen aus denselben Funktionen, die die Anwendung
 * ruft, je an dem Fall, an dem sie erscheinen.
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-block6.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { uebersteuere, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import {
	andereLesartInWorten,
	angehoerigenhinweis,
	lesartKartensatz,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlung,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { kopfbasisStreit } from '$lib/domain/mehrhinweise';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);
const zitat = (t: string | null | undefined) => aus(t ? `> ${t}` : '> (kein Satz)', '');

function snapshot(quoten: number[]): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-28T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: quoten.reduce((a, b) => a + b, 0),
		parties: quoten.map((quote, i) => ({
			partyId: `p${i + 1}`,
			displayName: `Partei ${i + 1}`,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: quote }]
		}))
	};
}

function stimmen(ja: string[], nein: string[]): Vote[] {
	const je = (p: string, choice: VoteChoice): Vote => ({
		partyId: p,
		unitId: `${p}-u`,
		choice,
		castAt: '2026-10-28T19:10:00.000Z',
		recordedByChair: false
	});
	return [...ja.map((p) => je(p, 'yes')), ...nein.map((p) => je(p, 'no'))];
}

const RW = holeRegelwerk('2026-10-28');

function beide(titel: string, a: Auszaehlung, feld: 'andereZaehlbasis' | 'nachGesetzUndReglement', geheim = false) {
	const r = a[feld];
	aus(`### ${titel}`, '', `Verkündet: ${a.angenommen ? 'angenommen' : 'abgelehnt'}.`, '', 'Leitung:', '');
	zitat(r ? andereLesartInWorten(r, geheim).leitung : null);
	aus('Protokoll, Auswertung und PDF:', '');
	zitat(r ? andereLesartInWorten(r, geheim).protokoll : null);
}

// ── 1a ──────────────────────────────────────────────────────────────────────
const KLAGE = waehleErfordernis(RW, 'k-ausschlussklage').ergebnis;
const ANWESENDE: Erfordernis = { ...KLAGE, kopfbasis: 'anwesend_vertreten', quelle: 'reglement' };
/** Sieben Eigentümer, p7 beklagt; da sind p1 bis p4 und p7. */
function klage(e: Erfordernis, ja: string[], nein: string[], geheim = false): Auszaehlungslage {
	return {
		momentaufnahme: snapshot([100, 100, 100, 100, 100, 100, 100]),
		erfordernis: e,
		stimmen: stimmen(ja, nein),
		anwesende: ['p1', 'p2', 'p3', 'p4', 'p7'],
		betroffeneParteiIds: ['p7'],
		geheim
	};
}

aus(
	'# Prüfdatei Lesarten Block 6: 1a und das Mehr aus Gesetz und Reglement',
	'',
	'Erzeugt aus dem Code (`scripts/pruefdatei-block6.ts`). Leser der Sätze für die',
	'Leitung: die Sitzungsleitung im Saal, Laie. Leser der Protokollsätze: alle',
	'Eigentümer. Das Mehr aus Gesetz und Reglement sieht nur die Leitung.',
	'',
	'## 1a: Ermächtigung zur Ausschlussklage',
	'',
	'Beispiel: sieben Eigentümer, einer beklagt; anwesend sind vier und der Beklagte.',
	'',
	'### Karte vor der Abstimmung (Zahl aller ausser dem Beklagten)',
	'',
	'Bestehender Satz zur Zählbasis, unverändert, zum Zusammenhang:',
	''
);
zitat(kopfbasisStreit(KLAGE)?.satz);
aus('Neu angehängt:', '');
zitat(lesartKartensatz(KLAGE));
beide('Drei Ja, ein Nein: an allen abgelehnt, an den Anwesenden angenommen', zaehleAus(klage(KLAGE, ['p1', 'p2', 'p3'], ['p4'])), 'andereZaehlbasis');
beide('Dasselbe, geheim', zaehleAus(klage(KLAGE, ['p1', 'p2', 'p3'], ['p4'], true)), 'andereZaehlbasis', true);
beide('Vier Ja: nach beiden angenommen', zaehleAus(klage(KLAGE, ['p1', 'p2', 'p3', 'p4'], [])), 'andereZaehlbasis');
beide('Zwei Ja, zwei Nein: nach beiden abgelehnt', zaehleAus(klage(KLAGE, ['p1', 'p2'], ['p3', 'p4'])), 'andereZaehlbasis');

aus('### Unter einer Regel der Anwesenden', '', 'Karte:', '');
zitat(lesartKartensatz(ANWESENDE));
aus('Hinweis zu den Angehörigen (geändert ist der Schluss ab «Hier misst sie»):', '');
zitat(angehoerigenhinweis(ANWESENDE));
beide('Drei Ja, ein Nein: an den Anwesenden angenommen, an allen abgelehnt', zaehleAus(klage(ANWESENDE, ['p1', 'p2', 'p3'], ['p4'])), 'andereZaehlbasis');
beide(
	'Sieben Eigentümer, alle da ausser p6, fünf Ja: nach beiden angenommen',
	zaehleAus({ ...klage(ANWESENDE, ['p1', 'p2', 'p3', 'p4', 'p5'], []), anwesende: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'] }),
	'andereZaehlbasis'
);

// ── Anhang A ────────────────────────────────────────────────────────────────
const EINFACH = waehleErfordernis(RW, 'k-organ-waehlen').ergebnis;
const QUALIFIZIERT = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis;
const STRENGER = uebersteuere(RW, EINFACH, 'qualifiziertes_mehr', 'So stand es in der Einladung').ergebnis;
const MILDER = uebersteuere(RW, QUALIFIZIERT, 'einfaches_mehr', 'Entscheid der Leitung').ergebnis;
function saal(e: Erfordernis): Auszaehlungslage {
	return {
		momentaufnahme: snapshot([100, 100, 100, 700]),
		erfordernis: e,
		stimmen: stimmen(['p1', 'p2', 'p3'], ['p4']),
		anwesende: ['p1', 'p2', 'p3', 'p4']
	};
}

aus(
	'## Anhang A: Mehr aus Gesetz und Reglement (nur Leitung)',
	'',
	'Beispiel: vier Eigentümer, alle da; drei mit je 100 Wertquoten stimmen Ja, einer mit 700 Nein.',
	'',
	'### Karte der Leitung, strenger gewählt',
	''
);
zitat(lesartKartensatz(STRENGER));
beide('Strenger gewählt (qualifiziert statt einfach): abgelehnt, nach Gesetz angenommen', zaehleAus(saal(STRENGER)), 'nachGesetzUndReglement');
aus('### Karte der Leitung, milder gewählt', '');
zitat(lesartKartensatz(MILDER));
beide('Milder gewählt (einfach statt qualifiziert): angenommen, nach Gesetz abgelehnt', zaehleAus(saal(MILDER)), 'nachGesetzUndReglement');
beide('Milder gewählt, geheim', zaehleAus({ ...saal(MILDER), geheim: true }), 'nachGesetzUndReglement', true);
beide(
	'Strenger gewählt, gleiche Wertquoten: nach beiden angenommen',
	zaehleAus({ ...saal(STRENGER), momentaufnahme: snapshot([250, 250, 250, 250]) }),
	'nachGesetzUndReglement'
);
{
	const { stimmen: _s, ...lage } = saal(MILDER);
	void _s;
	beide('Milder gewählt, von Hand gezählt', zaehleSummenAus(lage, { ja: 3, nein: 1, enthaltung: 0 }), 'nachGesetzUndReglement');
	beide(
		'Milder gewählt, geheim und von Hand gezählt',
		zaehleSummenAus({ ...lage, geheim: true }, { ja: 3, nein: 1, enthaltung: 0 }),
		'nachGesetzUndReglement',
		true
	);
}

process.stdout.write(zeilen.join('\n') + '\n');
