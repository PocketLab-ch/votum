/**
 * Prüfdatei «Texte nach 0047» (Auftrag `.auftraege/2026-11-13-votum-texte-nach-0047.md`),
 * aus dem Code erzeugt für die Nachtragsprüfung: je Punkt der Satz, wie die
 * Anwendung ihn ausgibt, mit eingesetzten Beispielwerten und dem Ort.
 *
 * **Beispielwerte sind erfunden.** Die zweiten Ergebnisse unter Punkt 2 und 3a
 * sind von Hand gebildet (Ausgang, Zahlen); was die andere Wahl verlangt,
 * rechnet der Kern aus dem Erfordernis der Karte (`erfordernisInWorten`) oder
 * nimmt es aus dem Katalog, wie die Zählung.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-texte-nach-0047.ts > <ziel>.md
 */
import { readFileSync } from 'node:fs';
import { holeRegelwerk } from '$lib/rules';
import { erfordernisAusKnoten, ergebniskarte, ANGEHOERIGE_BEIM_SETZEN, type Erfordernis } from '$lib/domain/entscheidbaum';
import {
	erfordernisNachAndererLesart,
	LESARTEN_VORGABE,
	lesartVon,
	mitKopfzaehlweise,
	wahlInWorten,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import {
	andereLesartInWorten,
	ANGEHOERIGENLESART_HINWEIS,
	erfordernisInWorten,
	lesartProtokollsatz,
	zweitesErgebnisImProtokoll,
	type ErgebnisNachAndererLesart
} from '$lib/domain/auszaehlung';
import { einwandInDerAuswertung } from '$lib/domain/protokoll';
import { stimmrechtBeiNutzniessung } from '$lib/domain/nutzniessung';
import { karteMitEnthaltung, KLAUSEL_MIT_WENIGER_OFFEN, KLAUSEL_SICHER, wendeReglementAn } from '$lib/domain/reglement';
import { wortlautAnwesendeWebsite } from '$lib/rules/quorum-2026-11-15';

const RW = holeRegelwerk('2026-11-15');
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);
const knoten = (id: string) => {
	const k = RW.knoten.find((x) => x.id === id);
	if (!k) throw new Error(`Knoten ${id} fehlt in der Fassung ${RW.fassung}.`);
	return k;
};
const hergeleitet = (id: string, wahlen: Lesartenwahl = LESARTEN_VORGABE): Erfordernis =>
	wendeLesartAn(erfordernisAusKnoten(RW, knoten(id)), wahlen);
const wahl = (kennung: string, wert: string) => wahlInWorten(kennung, wert).replace(/ \(Vorgabe\)$/, '');
const handbuch = readFileSync('docs/versammlung-fuehren.md', 'utf8').replace(/\s+/g, ' ');
/** Ein Satz aus dem Handbuch, vom Anfang bis zum Ende (beides wörtlich im Handbuch). */
function ausHandbuch(anfang: string, ende: string): string {
	const i = handbuch.indexOf(anfang);
	const j = handbuch.indexOf(ende, i);
	if (i < 0 || j < 0) throw new Error(`Handbuch: «${anfang.slice(0, 40)}…» bis «${ende}» nicht gefunden.`);
	return handbuch.slice(i, j + ende.length);
}
/** Ein zweites Ergebnis, wie die Zählung es bildet, mit erfundenen Zahlen. */
function zweites(kennung: string, eigene: string, andere: string, verlangt: string, angenommen: boolean, abweichend = true): ErgebnisNachAndererLesart {
	return {
		kennung,
		eigeneWahl: wahl(kennung, eigene),
		wahl: wahl(kennung, andere),
		verlangt,
		feststellbar: true,
		angenommen,
		koepfe: { ja: 5, basis: 9, schwelle: 5, erreicht: angenommen },
		quoten: null,
		abweichend
	};
}
const imSatz = (kennung: string, wert: string) => lesartVon(kennung)!.wahlen.find((w) => w.wert === wert)!.imSatz;

aus(
	'# Nachtrag, Votum, Texte nach Entscheid 0047: die erzeugten Sätze (14.11.2026)',
	'',
	`Aus dem Code erzeugt (\`scripts/pruefdatei-texte-nach-0047.ts\`), Fassung ${RW.fassung}. Beispielwerte`,
	'(Bestimmung, Zahlen, Namen) sind erfunden. Grundlage: Fassungen 1 bis 3 der Prüfvorlage',
	'`zu-pruefen-2026-11-14-votum-texte-nach-0047*.md`.',
	'',
	'**Website:** 4b steht dort ohne «so rechnet Votum» (`wortlautAnwesendeWebsite`; die Website nennt Votum nicht, `check:abzug`). Die Website-Wortlaute zu 4b und 7 stehen unten vollständig, aus dem erzeugten Abzug gelesen.',
	''
);

// ── 1 ─────────────────────────────────────────────────────────────────────────
aus('## 1. Protokollzeile (Protokoll, Abenddokument, Auswertung, Stimmnachweis)', '');
for (const [kennung, id, wert] of [
	['L2', 'k-zustaendigkeit-gewoehnlich', 'qualifiziert'],
	['L4', 'k-bewirtschaftung-waehlen-erweitert', 'einfach'],
	['L6', 'k-reglement-eigene-schranke', 'gesetz'],
	['L9', 'k-ausschlussklage', 'anwesende'],
	['L11', 'k-prozessfuehrung', 'einfach'],
	['L12', 'k-baulich-luxurioes', 'anwesende']
] as const) {
	const e = hergeleitet(id, { ...LESARTEN_VORGABE, [kennung]: wert });
	aus(`- **${kennung}, «${wahl(kennung, wert)}» eingestellt:** ${lesartProtokollsatz(e)}`);
}
aus('');

// ── 2 ─────────────────────────────────────────────────────────────────────────
aus(
	'## 2. Zweites Ergebnis in Auswertung-PDF und Stimmnachweis (L8 und L10)',
	'',
	'Die PDFs nehmen `zweitesErgebnisImProtokoll` wie Protokoll und Abenddokument. «(keine Zeile)» heisst: PDF und Protokoll schweigen.',
	''
);
const pdf = (r: ErgebnisNachAndererLesart) =>
	zweitesErgebnisImProtokoll(r) ? (andereLesartInWorten(r, false).protokoll ?? '(keine Zeile)') : '(keine Zeile)';
const l8verlangt = imSatz('L8', 'ruhen');
aus(
	`- **L8 «${wahl('L8', 'leitung')}», einzeln erfasst, gleich:** ${pdf(zweites('L8', 'leitung', 'ruhen', l8verlangt, true, false))}`,
	`- **L8 «${wahl('L8', 'leitung')}», einzeln erfasst, abweichend:** ${pdf(zweites('L8', 'leitung', 'ruhen', l8verlangt, false))}`,
	`- **L8 «${wahl('L8', 'ruhen')}» (Grenzen):** ${pdf({ ...zweites('L8', 'ruhen', 'leitung', imSatz('L8', 'leitung'), true, false), ruhendeVollmachten: 2 })}`,
	`- **L10 «Bleiben in der Zahl», gleich:** ${pdf(zweites('L10', 'bleiben', 'fallen_heraus', imSatz('L10', 'fallen_heraus'), false, false))}`,
	`- **L10 «Bleiben in der Zahl», abweichend:** ${pdf(zweites('L10', 'bleiben', 'fallen_heraus', imSatz('L10', 'fallen_heraus'), true))}`,
	'',
	`**Handbuch:** ${ausHandbuch('Fallen die Ergebnisse auseinander,', 'in diesem Punkt sicher.')}`,
	''
);

// ── 3 ─────────────────────────────────────────────────────────────────────────
aus('## 3a. Protokollsatz bei Abweichung, je Lesart (Protokoll, PDFs)', '');
const mehr = (kennung: string, id: string): string => {
	const e = hergeleitet(id);
	const anderes = erfordernisNachAndererLesart(e);
	if (!anderes) throw new Error(`${kennung}: keine andere Lesart an ${id}.`);
	return erfordernisInWorten(anderes);
};
const l13e = hergeleitet('k-verwaltung-wichtig');
const l13anderes = mitKopfzaehlweise({ ...l13e, kopfbasis: 'alle_eigentuemer' as const }, 'alle');
const faelle: [string, ErgebnisNachAndererLesart][] = [
	['L1', zweites('L1', 'bleibt', 'faellt_heraus', imSatz('L1', 'faellt_heraus'), true)],
	['L2', zweites('L2', 'einfach', 'qualifiziert', mehr('L2', 'k-zustaendigkeit-gewoehnlich'), false)],
	['L3', zweites('L3', 'je_eigentuemer', 'je_einheit', imSatz('L3', 'je_einheit'), false)],
	['L4', zweites('L4', 'qualifiziert', 'einfach', mehr('L4', 'k-bewirtschaftung-waehlen-erweitert'), true)],
	['L6', zweites('L6', 'klausel', 'gesetz', mehr('L6', 'k-reglement-eigene-schranke'), true)],
	['L6, umgekehrt', zweites('L6', 'gesetz', 'klausel', imSatz('L6', 'klausel'), false)],
	['L8', zweites('L8', 'leitung', 'ruhen', l8verlangt, false)],
	['L10', zweites('L10', 'bleiben', 'fallen_heraus', imSatz('L10', 'fallen_heraus'), true)],
	['L11', zweites('L11', 'qualifiziert', 'einfach', mehr('L11', 'k-prozessfuehrung'), true)],
	['L12', zweites('L12', 'alle', 'anwesende', mehr('L12', 'k-baulich-luxurioes'), true)],
	['L13', zweites('L13', 'anwesende', 'alle', erfordernisInWorten(l13anderes), false)]
];
for (const [kennung, r] of faelle) aus(`- **${kennung}:** ${andereLesartInWorten(r, false).protokoll}`);
aus(
	'',
	'L8 unter «Vollmachten ruhen» erreicht diesen Satz nicht (Grenzen, ohne Protokollzeile); «den Entscheid der Sitzungsleitung über den Ausstand» steht deshalb nie hinter dem Doppelpunkt.',
	''
);
aus('## 3b. L10, was verkündet ist und gilt', '');
const ablehnung = andereLesartInWorten(zweites('L10', 'bleiben', 'fallen_heraus', imSatz('L10', 'fallen_heraus'), true), false);
const annahme = andereLesartInWorten(
	zweites('L10', 'fallen_heraus', 'bleiben', imSatz('L10', 'bleiben'), false),
	false
);
aus(
	`- **Leitung, Ablehnung unter «Bleiben in der Zahl»:** ${ablehnung.leitung}`,
	`- **Protokoll, Ablehnung:** ${ablehnung.protokoll}`,
	`- **Protokoll, Annahme unter «Fallen aus der Zahl»:** ${annahme.protokoll}`,
	''
);
aus(
	'## 3c. Die nötige Zahl vor der Abstimmung (Leitungsseite)',
	'',
	'**Nicht gebaut.** Die Bezugsgrösse rechnet Votum erst am eröffneten Durchgang (`server/abstimmung.ts`, Lage am Durchgang); vor dem Eröffnen gibt es keine Rechnung, aus der der Satz die Zahlen nähme. Der Satz bleibt:',
	'',
	`> ${ANGEHOERIGENLESART_HINWEIS}`,
	''
);

// ── 4 ─────────────────────────────────────────────────────────────────────────
aus('## 4. L10, Geltung (Seite «Lesarten»)', '', `> ${lesartVon('L10')!.geltung}`, '');

// ── 5 ─────────────────────────────────────────────────────────────────────────
aus(
	'## 5. Maske «Anderes Erfordernis setzen», unter «Mehrheit wovon?» (Ermächtigung zur Ausschlussklage)',
	'',
	`> ${ANGEHOERIGE_BEIM_SETZEN}`,
	'',
	'Gemessen am Kern (elf Eigentümer, einer beklagt, einer im Ausstand): Vorschlag behalten 10, mit «Fallen aus der Zahl» 9; «Mehrheit aller Eigentümer, auch der abwesenden» 10 (der Beklagte zählt nicht, die Person im Ausstand schon); «Mehrheit der anwesenden oder vertretenen» bei sechs Anwesenden 4. Fassung 3 sagte «auch der Beklagte»; das trifft die Rechnung nicht.',
	''
);

// ── 6 ─────────────────────────────────────────────────────────────────────────
aus(
	'## 6. Auswertung (Seite und PDF), unter dem Ergebnis eines Beschlusses von Hand',
	'',
	`> ${einwandInDerAuswertung('Art. 9 Abs. 2 Reglement (erfunden): Bauliche Massnahmen brauchen zwei Drittel aller Eigentümer.')}`,
	''
);

// ── 7 ─────────────────────────────────────────────────────────────────────────
const gegen = (knoten('k-prozessfuehrung').hinweise ?? []).find((h) => h.startsWith('Geht es um einen Prozess'));
aus('## 7. Karte `k-prozessfuehrung`, «Zu beachten»', '', `> ${gegen}`, '');

// ── 8 ─────────────────────────────────────────────────────────────────────────
aus('## 8. Kasten «Reglement» (Rechtssatz)', '');
for (const id of ['k-bewirtschaftung-erweitert', 'k-verwaltung-wichtig']) {
	const recht = knoten(id).reglementsrecht ?? '';
	const satz = recht.split(/(?<=\.) (?=[A-ZÄÖÜ])/).find((s) => s.includes('Art. 712g Abs. 2; SVIT-Kommentar Rz. 78 und 78a'));
	aus(`- **${id}:** ${satz}`);
}
aus('', 'Website-Kurztext `k-bewirtschaftung-erweitert`: Fundstellenliste «(Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 35, 76, 78, 78a, 91; …)», sonst unverändert.', '');

// ── 9 ─────────────────────────────────────────────────────────────────────────
const wq = knoten('k-wertquoten-aendern');
aus(
	'## 9. Nutzniessung',
	'',
	`- **Am Traktandum (Leitungsseite), Wertquoten ändern, ohne Vereinbarung:** ${stimmrechtBeiNutzniessung({ holderName: 'Erna Beispiel', hasAgreement: false }, wq.geschaeftsart, wq.id).satz}`,
	`- **Handbuch:** ${ausHandbuch('Verfügung und Zweckänderung sind keine Verwaltung;', 'oder beide gleich abstimmen.')}`,
	''
);

/** 10d aus der Svelte-Datei, mit den Konstanten eingesetzt, wie die Seite sie zeigt. */
const formular = readFileSync('src/lib/components/GemeinschaftFormular.svelte', 'utf8');
const hilfeAnfang = formular.indexOf('Eingeführt werden muss eine solche Klausel');
const hilfe10d = formular
	.slice(hilfeAnfang, formular.indexOf('</span>', hilfeAnfang))
	.replace('{KLAUSEL_MIT_WENIGER_OFFEN}', KLAUSEL_MIT_WENIGER_OFFEN)
	.replace('{KLAUSEL_SICHER}', KLAUSEL_SICHER)
	.replace(/\s+/g, ' ')
	.trim();

// ── 10 ────────────────────────────────────────────────────────────────────────
aus('## 10. Klausel mit zu wenig Stimmen eingeführt', '');
const KLAUSEL = { fundstelle: 'Art. 33 Abs. 1 Reglement (erfunden)' };
const gefunden = new Map<string, string>();
for (const k of RW.knoten) {
	if (k.typ === 'grenzfall') continue;
	let vorbehalt: string | null | undefined;
	try {
		const angewandt = wendeReglementAn(erfordernisAusKnoten(RW, k), [], KLAUSEL, LESARTEN_VORGABE);
		vorbehalt = karteMitEnthaltung(ergebniskarte(RW, k), angewandt.enthaltung).reglementsvorbehalt;
	} catch {
		continue;
	}
	if (!vorbehalt) continue;
	if (vorbehalt.includes('Rechtmässig eingeführt ist sie nur') && !gefunden.has('10a')) {
		gefunden.set('10a', `${k.id}, Schluss des Kastens: ${vorbehalt.slice(vorbehalt.indexOf('Ihre Einstellung zu den Enthaltungen'))}`);
	}
	if (vorbehalt.includes(`${KLAUSEL_MIT_WENIGER_OFFEN} ${KLAUSEL_SICHER}`) && !gefunden.has('10b')) gefunden.set('10b', `${k.id}: ${vorbehalt}`);
}
aus(
	`- **10a, Karte, Kasten «Reglement», Einstellung angewandt** (${gefunden.get('10a') ?? 'an keiner Karte erzeugt'})`,
	`- **10b, Karte, Kasten «Reglement», Reglement gesperrt** (${gefunden.get('10b') ?? `an keiner Karte der Fassung erzeugt; Wortlaut der Vorlage im Code: «Ausgenommen ist Ihre Einstellung zu den Enthaltungen (${KLAUSEL.fundstelle}): Votum wendet sie hier an. Ob sie einstimmig oder im Begründungsakt eingeführt wurde, war beim Setzen des Hakens in den Angaben der Gemeinschaft zu klären. ${KLAUSEL_MIT_WENIGER_OFFEN} ${KLAUSEL_SICHER}»`})`,
	`- **10c, Seite «Lesarten», L11 Geltung (letzter Satz):** ${lesartVon('L11')!.geltung!.split(/(?<=\.) (?=[A-ZÄÖÜ])/).pop()}`,
	`- **10d, Angaben der Gemeinschaft, Hilfe zur Fundstelle:** ${hilfe10d}`,
	`- **10e, Handbuch:** ${ausHandbuch('Die Fundstelle ist Pflicht.', 'wie ein Nein zählen.')}`,
	''
);

// ── 11 und 12 ─────────────────────────────────────────────────────────────────
aus('## 11 und 12. «Wortlaut und Rechtsprechung» (Karte; 4b auch Website)', '');
for (const [artikel, text] of Object.entries(RW.wortlautErklaerungJeArtikel ?? {})) {
	aus(`- **${artikel === 'ZGB Art. 647d Abs. 1' ? '4a' : '4b'}, ${artikel}:** ${text}`);
}
for (const [artikel, text] of Object.entries(RW.wortlautErklaerungJeArtikelAlle ?? {})) aus(`- **4c, ${artikel}:** ${text}`);
for (const artikel of Object.keys(RW.wortlautErklaerungJeArtikelAlle ?? {})) aus(`- **Website, 4b, ${artikel}:** ${wortlautAnwesendeWebsite(artikel)}`);
aus(`- **Allgemeine Erklärung (Rückfall; Website oberste Ebene):** ${RW.wortlautErklaerung}`, '');
const l13 = lesartVon('L13')!;
aus(
	'## 12. Katalog L13 (Seite «Lesarten»)',
	'',
	`- **«Anwesende und Vertretene», Fundstelle:** ${l13.wahlen.find((w) => w.wert === 'anwesende')!.fundstelle}`,
	`- **«Alle Eigentümer», Fundstelle:** ${l13.wahlen.find((w) => w.wert === 'alle')!.fundstelle}`,
	`- **Begründung der Vorgabe:** ${l13.warumVorgabe}`,
	`- **Geltung:** ${l13.geltung}`,
	''
);

// ── Website, aus dem erzeugten Abzug ─────────────────────────────────────────
aus('## Website-Abzug (`quorumsbaum.json`), erzeugt aus dieser Fassung', '');
if (!process.env.ABZUG) {
	aus('Ohne `ABZUG=<Pfad zum erzeugten Abzug>` nicht gezeigt.', '');
} else {
	const abzug = JSON.parse(readFileSync(process.env.ABZUG, 'utf8')) as {
		fassung: string;
		knoten: { id: string; hinweise?: string[]; wortlautErklaerung?: string | null }[];
	};
	aus(`Fassung des Abzugs: ${abzug.fassung}.`, '');
	const prozess = abzug.knoten.find((k) => k.id === 'k-prozessfuehrung');
	aus(`- **7, k-prozessfuehrung:** ${(prozess?.hinweise ?? []).find((h) => h.startsWith('Geht es um einen Prozess')) ?? '(fehlt)'}`);
	for (const k of abzug.knoten.filter((x) => x.wortlautErklaerung)) aus(`- **4b, ${k.id}:** ${k.wortlautErklaerung}`);
	aus('');
}

console.log(zeilen.join('\n'));
