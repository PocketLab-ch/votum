/**
 * Prüfdatei der Texte zu L2 (Zuständigkeitsordnung ausserhalb des Reglements),
 * aus dem Code erzeugt wie `pruefdatei-lesarten.ts` (Konzept Lesarten,
 * Abschnitt 4). Gezeigt wird die ganze Karte ohne und mit hinterlegter Regel,
 * je nach beiden Wahlen, dazu Katalog, Kartensatz, Sätze für Leitung und
 * Protokoll.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-lesart-zustaendigkeit.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { ZUSTAENDIGKEIT_ID } from '$lib/rules/quorum-2026-10-26';
import { erfordernisAusKnoten, ergebniskarte, type Ergebniskarte } from '$lib/domain/entscheidbaum';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import {
	LESARTEN_VORGABE,
	erfordernisNachAndererLesart,
	knotenNachLesart,
	lesartVon,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	andereLesartInWorten,
	erfordernisInWorten,
	lesartKartensatz,
	lesartProtokollsatz,
	type ErgebnisNachAndererLesart
} from '$lib/domain/auszaehlung';

const RW = holeRegelwerk('2026-10-26');
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

function karte(titel: string, k: Ergebniskarte | ReturnType<typeof karteMitReglement>) {
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

const QUALIFIZIERT: Lesartenwahl = { ...LESARTEN_VORGABE, L2: 'qualifiziert' };
const WAHLEN: [string, Lesartenwahl][] = [
	['Vorgabe «Einfaches Mehr»', LESARTEN_VORGABE],
	['Umgestellt auf «Qualifiziertes Mehr»', QUALIFIZIERT]
];

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, Block 3 (L2 Zuständigkeitsordnung)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-lesart-zustaendigkeit.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Die Karte erscheint im Entscheidbaum unter «Sonderfälle» › «Zuständigkeit für gewöhnliche',
	'Verwaltungshandlungen anders regeln».',
	''
);

aus('## 1. Katalog: Seite «Lesarten»', '');
const l2 = lesartVon('L2')!;
aus(`- **Frage:** ${l2.frage}`);
for (const w of l2.wahlen) {
	// Wie das Formular: erst die Wirkung, dann die Fundstelle (Lesartenwahl.svelte).
	aus(`- **Wahl «${w.bezeichnung}»${w.wert === l2.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ? `${w.wirkung} ` : ''}${w.fundstelle}`);
}
aus(`- **Warum die Vorgabe:** ${l2.warumVorgabe}`);
if (l2.geltung) aus(`- **Geltung:** ${l2.geltung}`);
aus('');

aus('## 2. Karten', '');
const knoten = RW.knoten.find((k) => k.id === ZUSTAENDIGKEIT_ID)!;
const regel: Reglementsregel = {
	id: 'r1',
	stwegId: 's1',
	geschaeftsart: 'verwaltung_gewoehnlich',
	knotenId: null,
	fundstelle: 'Reglement Ziff. 14',
	kopfbasis: 'anwesend_vertreten',
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
	quotenbasis: 'keine',
	quotenSchwelle: null,
	enthaltungZaehltMit: true
};
for (const [titel, wahl] of WAHLEN) {
	const k = knotenNachLesart(RW, knoten, wahl);
	const gesetzlich = ergebniskarte(RW, k);
	karte(`${titel}, ohne Regel`, gesetzlich);
	const a = wendeReglementAn(erfordernisAusKnoten(RW, knoten), [regel], null, wahl);
	karte(
		`${titel}, mit hinterlegter Regel «zwei Drittel der Anwesenden» (Reglement Ziff. 14)`,
		karteMitReglement(gesetzlich, a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis)
	);
}

aus('## 3. Satz zur Lesart vor der Abstimmung (Traktandenseite, Leitung)', '');
for (const [titel, wahl] of WAHLEN) {
	const e = wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl);
	aus(`- **${titel}:** ${lesartKartensatz(e)}`);
}
// Nach «qualifiziert» rechnet das Traktandum über alle Wertquoten; dann steht
// der Satz zu L1 mit im selben Satz (gemeinsamer Kartensatz).
aus('');

aus('## 4. Sätze nach der Auszählung (Leitung) und im Protokoll', '');
const vorgabe = wendeLesartAn(erfordernisAusKnoten(RW, knoten), LESARTEN_VORGABE);
const beispiel = (teil: Partial<ErgebnisNachAndererLesart>): ErgebnisNachAndererLesart => ({
	kennung: 'L2',
	eigeneWahl: 'Einfaches Mehr',
	wahl: 'Qualifiziertes Mehr',
	verlangt: erfordernisInWorten(erfordernisNachAndererLesart(vorgabe)!),
	feststellbar: true,
	angenommen: false,
	koepfe: { ja: 2, basis: 3, schwelle: 2, erreicht: true },
	quoten: { ja: 400, basis: 1000, schwelle: 501, erreicht: false },
	abweichend: true,
	...teil
});
const umgekehrt = wendeLesartAn(erfordernisAusKnoten(RW, knoten), QUALIFIZIERT);
for (const [titel, r, geheim] of [
	['Abweichend, offen abgestimmt', beispiel({}), false],
	['Abweichend, geheim abgestimmt', beispiel({}), true],
	[
		'Umgekehrt: eingestellt «Qualifiziertes Mehr», abgelehnt; nach dem einfachen Mehr angenommen',
		beispiel({
			eigeneWahl: 'Qualifiziertes Mehr',
			wahl: 'Einfaches Mehr',
			verlangt: erfordernisInWorten(erfordernisNachAndererLesart(umgekehrt)!),
			angenommen: true,
			quoten: null
		}),
		false
	],
	['Gleich', beispiel({ abweichend: false }), false],
	[
		'Nicht feststellbar (Handzählung ohne Wertquoten)',
		beispiel({ feststellbar: false, nichtFeststellbarWeil: 'summen', angenommen: null, abweichend: false }),
		false
	]
] as const) {
	const s = andereLesartInWorten(r, geheim);
	aus(`### ${titel}`, '', `- **Leitung:** ${s.leitung}`, `- **Protokoll am Ausgang:** ${s.protokoll ?? '(kein Satz)'}`, '');
}
aus('### Zeile im Protokoll je Beschluss', '');
for (const [titel, wahl] of WAHLEN) {
	aus(`- **${titel}:** ${lesartProtokollsatz(wendeLesartAn(erfordernisAusKnoten(RW, knoten), wahl))}`);
}
aus('');

console.log(zeilen.join('\n'));
