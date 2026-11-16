/**
 * Prüfdatei der Texte zu C1 und C2 (Entscheiden statt der Versammlung,
 * Fassung 2026-10-27), aus dem Code erzeugt wie
 * `pruefdatei-lesart-zustaendigkeit.ts` (Konzept Lesarten, Abschnitt 4).
 * Gezeigt werden die Fragen des Zweigs mit Hilfe, jede betroffene Karte ohne
 * und mit hinterlegter Regel für die Organe, die Nachbarkarten und der Satz,
 * den die Website ab Block 8 zum Reglement zeigt.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-statt-versammlung.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import {
	BEWIRTSCHAFTUNG_STATT_ID,
	ERWEITERT_ID,
	ORGAN_ID,
	REGLEMENT_FRAGE_ID,
	STATT_FRAGE_ID,
	UEBERTRAGUNG_BESCHLUSS_ID,
	UEBERTRAGUNG_FRAGE_ID,
	UEBERTRAGUNG_STATT_ID,
	WEBSITE_REGLEMENT_STATT
} from '$lib/rules/quorum-2026-10-27';
import { erfordernisAusKnoten, ergebniskarte, type Ergebniskarte } from '$lib/domain/entscheidbaum';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';

const RW = holeRegelwerk('2026-10-27');
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

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, Block 4 (C1, C2: entscheiden statt der Versammlung)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-statt-versammlung.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'Der Zweig beginnt im Entscheidbaum unter «Bewirtschaftung und Organe» › «Worum geht es genau?».',
	''
);

aus('## 1. Fragen', '');
for (const id of ['f2-1', 'f2-1-kompetenzen', STATT_FRAGE_ID, UEBERTRAGUNG_FRAGE_ID, REGLEMENT_FRAGE_ID]) {
	const f = RW.fragen.find((x) => x.id === id)!;
	aus(`### ${f.text}`, '');
	if (f.hilfe) aus(`- **Hilfe:** ${f.hilfe}`);
	for (const a of f.antworten) {
		const ziel = RW.knoten.find((k) => k.id === a.ziel)?.titel ?? RW.fragen.find((x) => x.id === a.ziel)?.text;
		aus(`- **Antwort «${a.text}»** → ${ziel}${a.hilfe ? `. Hilfe: ${a.hilfe}` : ''}`);
	}
	aus('');
}

aus('## 2. Karten', '');
const regel: Reglementsregel = {
	id: 'r1',
	stwegId: 's1',
	geschaeftsart: 'organe',
	knotenId: null,
	fundstelle: 'Reglement Ziff. 21',
	kopfbasis: 'anwesend_vertreten',
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
	quotenbasis: 'keine',
	quotenSchwelle: null,
	enthaltungZaehltMit: true
};
for (const id of [BEWIRTSCHAFTUNG_STATT_ID, ERWEITERT_ID, UEBERTRAGUNG_STATT_ID, UEBERTRAGUNG_BESCHLUSS_ID, ORGAN_ID]) {
	const knoten = RW.knoten.find((k) => k.id === id)!;
	aus(`### ${knoten.titel}`, '');
	const gesetzlich = ergebniskarte(RW, knoten);
	karte('Ohne Regel', gesetzlich);
	const a = wendeReglementAn(erfordernisAusKnoten(RW, knoten), [regel], null, LESARTEN_VORGABE);
	karte(
		'Mit hinterlegter Regel «zwei Drittel der Anwesenden» für die Organe (Reglement Ziff. 21)',
		karteMitReglement(gesetzlich, a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis)
	);
}

aus('## 3. Nachbarkarten (unverändert, zum Abgleich)', '');
for (const id of ['k-reglement-normal', 'k-bewirtschaftung-waehlen-erweitert', 'k-zustaendigkeit-gewoehnlich']) {
	const knoten = RW.knoten.find((k) => k.id === id)!;
	aus(`### ${knoten.titel}`, '');
	aus(`- **Begründung:** ${knoten.begruendung}`);
	for (const h of knoten.hinweise ?? []) aus(`- **Hinweis:** ${h}`);
	aus('');
}

aus(
	'## 4. Website, ab dem Abzug in Block 8',
	'',
	'Kasten «Und Ihr Reglement?» an beiden Karten mit Einstimmigkeit (`scripts/quorumsbaum-export.mjs`):',
	'',
	`- ${WEBSITE_REGLEMENT_STATT}`,
	''
);

console.log(zeilen.join('\n'));
