/**
 * Prüfdatei der Texte aus Lesarten Block 2 (L1, 1e), aus dem Code erzeugt,
 * wie `scripts/pruefdatei-lesarten.ts` für Block 1.
 *
 * **Warum ein Skript.** Eine abgeschriebene Prüfdatei prüft die Abschrift. Die
 * Sätze für Saal, Leitung, Protokoll und Mappe kommen hier aus denselben
 * Funktionen, die die Anwendung ruft, je an dem Fall, an dem sie erscheinen.
 * Die Texte aus dem Svelte-Markup stehen als Liste; das Skript bricht ab, wenn
 * einer davon so nicht mehr in der Quelle steht.
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-lesart-ausstand.ts > <ziel>.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { holeRegelwerk } from '$lib/rules';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { LESARTEN, ausstandFestSatz, ausstandslesartSatz, wendeLesartAn } from '$lib/domain/lesarten';
import {
	andereLesartenVon,
	andereLesartInWorten,
	angehoerigenhinweis,
	imAusstandInWorten,
	lesartKartensatz,
	mehrheitsvorschau,
	zaehleAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { baueAuszaehlmappe, type Mappenposten } from '$lib/domain/auszaehlmappe';
import { lesartVeraltetInWorten } from '$lib/domain/freigabe';
import { ANGEHOERIGE_ERSATZ, ANGEHOERIGE_HINWEIS } from '$lib/rules/quorum-2026-10-25';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);
const zitat = (t: string) => aus(`> ${t}`, '');

function snapshot(quoten: number[]): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-21T17:00:00.000Z',
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

function stimmen(...w: [string, VoteChoice][]): Vote[] {
	return w.map(([p, choice]) => ({ partyId: p, unitId: `${p}-u`, choice, castAt: '2026-10-21T19:10:00.000Z', recordedByChair: false }));
}

const RW = holeRegelwerk('2026-10-25');
const QUALI = waehleErfordernis(RW, 'k-verwaltung-wichtig').ergebnis!;
const VIER = snapshot([250, 250, 250, 250]);

function papier(e: Erfordernis, u: Partial<Auszaehlungslage> = {}): Auszaehlungslage {
	return {
		momentaufnahme: VIER,
		erfordernis: e,
		stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'no']),
		anwesende: ['p1', 'p2', 'p3', 'p4'],
		imAusstand: ['p4'],
		...u
	};
}

aus(
	'# Prüfdatei: Lesarten der Gemeinschaft, Block 2 (L1 und 1e)',
	'',
	'Erzeugt aus dem Code mit `scripts/pruefdatei-lesart-ausstand.ts`, Fassung 2026-10-25.',
	'Leserin: Verwaltung und Sitzungsleitung (Texte nach innen mit Rechtsaussagen, die im Saal und',
	'im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	'',
	'Beispiel durchgehend, wo nicht anders genannt: vier Parteien zu je 250 Tausendsteln, eine im',
	'Ausstand, zwei Ja, eine Nein, qualifiziertes Mehr (Mehrheit der Köpfe der Anwesenden und mehr als',
	'die Hälfte aller Wertquoten).',
	''
);

// ── 1. Katalog ───────────────────────────────────────────────────────────────
const l1 = LESARTEN.find((l) => l.kennung === 'L1')!;
aus('## 1. Katalog: die Lesart L1 auf der Einstellungsseite', '');
aus(`**Frage:** ${l1.frage}`, '');
for (const w of l1.wahlen) {
	aus(`- **${w.bezeichnung}${w.wert === l1.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung ?? ''} ${w.fundstelle}`);
}
aus('', `**Warum die Vorgabe:** ${l1.warumVorgabe}`, '', `**Geltung:** ${l1.geltung}`, '');
aus(`**Nach einer Ablehnung, Zusatz an die Leitung:** ${l1.nachAblehnung}`, '');

// ── 2. Seitentexte ───────────────────────────────────────────────────────────
aus('## 2. Seitentexte (Seiten «Lesarten» und «Reglement und Quoren»)', '');
const SEITEN: [string, string][] = [
	[
		'src/routes/gemeinschaften/[id=kennung]/lesarten/+page.svelte',
		'Lesart Votum rechnet. Votum rechnet zusätzlich nach der anderen und nennt das Ergebnis, wo'
	],
	[
		'src/routes/gemeinschaften/[id=kennung]/lesarten/+page.svelte',
		'Bei der Wertquote im Ausstand, der Zählung an der Einsprache und neuen Geschäften'
	]
];
for (const [datei, stueck] of SEITEN) {
	if (!readFileSync(join(process.cwd(), datei), 'utf8').includes(stueck)) {
		throw new Error(`«${stueck}» steht nicht mehr in ${datei}`);
	}
}
zitat(
	'An einigen Stellen ist umstritten, wie das Gesetz zu lesen ist, und das Ergebnis einer Abstimmung ' +
		'kann davon abhängen. Hier wird für die Gemeinschaft eingestellt, nach welcher Lesart Votum rechnet. ' +
		'Votum rechnet zusätzlich nach der anderen und nennt das Ergebnis, wo die andere etwas ändern kann. ' +
		'Legt Ihr Reglement das Mehr eines Traktandums fest, rechnet Votum nach ihm; die Karte des ' +
		'Traktandums nennt dann, was das Gesetz verlangen würde.'
);
zitat(
	'Die Einstellung gilt für Versammlungen, deren Einladung danach freigegeben wird. Ändert sie das Mehr ' +
		'eines Traktandums, das schon eines hat, erscheint es unten, und Sie ziehen es dort nach. ' +
		'Bei der Wertquote im Ausstand, der Zählung an der Einsprache und neuen Geschäften an der ' +
		'zweiten Versammlung müssen Sie nichts nachziehen. Für eine schon freigegebene Einladung gilt ' +
		'die bisherige Einstellung.'
);

// ── 3. Im Saal vor der Abstimmung ────────────────────────────────────────────
aus('## 3. Im Saal vor der Abstimmung (Leitung, Wand, Telefone)', '');
const vorschau = (e: Erfordernis, u: Partial<Auszaehlungslage> = {}) => {
	const { stimmen: _s, ...ohne } = papier(e, u);
	void _s;
	return mehrheitsvorschau(ohne);
};
for (const [titel, e, u] of [
	['Vorgabe «Wertquote zählt mit»', QUALI, {}],
	['Gewählt «Wertquote fällt heraus»', { ...QUALI, ausstandslesart: 'faellt_heraus' as const }, {}],
	[
		'Gewählt «fällt heraus»; Partei 3 im Ausstand vertritt Partei 4 (die zählt wie eine Abwesende)',
		{ ...QUALI, ausstandslesart: 'faellt_heraus' as const },
		{ imAusstand: ['p3'], vertretungen: [{ vertreteneId: 'p4', bevollmaechtigtId: 'p3' }] }
	]
] as [string, Erfordernis, Partial<Auszaehlungslage>][]) {
	const v = vorschau(e, u);
	aus(`### ${titel}`, '');
	// Review DeepSeek Block 2, Befund 6: der Satz zur Lesart auf der Karte.
	aus(`- **Satz auf der Karte, auch ohne Ausstand:** ${lesartKartensatz(e) ?? '(keiner)'}`);
	aus(`- **Satz an der Wand:** ${v.satz}`);
	aus(`- **Satz zum Ausstand:** ${v.ausstandshinweis ?? '(keiner)'}`);
	if (v.erreichbarkeitshinweis) aus(`- **Erreichbarkeit (nur Leitung):** ${v.erreichbarkeitshinweis}`);
	const q = zaehleAus(papier(e, u)).quoten;
	aus(
		`- **Posten der Wertquoten nach der Abstimmung (Partei 1 und 2 Ja, Partei 3 Nein, soweit stimmberechtigt):** ${q.ja} Ja, ${q.nein} Nein, ` +
			`${q.ohneAbgabe} ohne Abgabe, ${q.nichtAnwesend} nicht anwesend` +
			((q.imAusstand ?? 0) > 0 ? `, ${q.imAusstand} im Ausstand` : '') +
			` (von ${q.basis}), nötig ${q.schwelle}`
	);
	aus('');
}
aus(
	'### Erreichbarkeit nach «fällt heraus», wenn die Anwesenden nicht reichen',
	'',
	'Andere Lage: Nur Partei 1 und Partei 4 sind erschienen, Partei 4 im Ausstand.',
	''
);
{
	const v = mehrheitsvorschau({
		momentaufnahme: snapshot([250, 250, 250, 250]),
		erfordernis: { ...QUALI, ausstandslesart: 'faellt_heraus' },
		anwesende: ['p1', 'p4'],
		imAusstand: ['p4']
	});
	aus(`- ${v.erreichbarkeitshinweis ?? '(keiner)'}`, '');
}

// ── 4. Nach der Auszählung ───────────────────────────────────────────────────
aus('## 4. Nach der Auszählung: Leitung und Protokoll', '');
for (const [titel, e, geheim] of [
	['Vorgabe, Ergebnis weicht ab', QUALI, false],
	['Gewählt «fällt heraus», Ergebnis weicht ab', { ...QUALI, ausstandslesart: 'faellt_heraus' as const }, false],
	['Vorgabe, geheime Abstimmung', QUALI, true]
] as [string, Erfordernis, boolean][]) {
	const a = zaehleAus({ ...papier(e), geheim });
	const r = a.andereAusstandslesart!;
	const w = andereLesartInWorten(r, geheim);
	aus(`### ${titel}`, '');
	aus(`- **Leitung:** ${w.leitung}`, `- **Protokoll, am Ausgang:** ${w.protokoll}`);
	aus(`- **Protokoll, zur Bezugsgrösse (Ausstandswirkung):** ${a.ausstandswirkung}`, '');
}
{
	const a = zaehleAus({ ...papier(QUALI), stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes']) });
	aus('### Gleiches Ergebnis nach beiden Wahlen', '');
	aus(`- **Leitung:** ${andereLesartInWorten(a.andereAusstandslesart!, false).leitung}`);
	aus(`- **Protokoll:** ${andereLesartInWorten(a.andereAusstandslesart!, false).protokoll}`, '');
}
{
	const e = wendeLesartAn(waehleErfordernis(RW, 'k-bewirtschaftung-waehlen-erweitert').ergebnis!, {
		L1: 'bleibt',
		L2: 'einfach',
		L4: 'qualifiziert'
	});
	const a = zaehleAus({ ...papier(e), stimmen: stimmen(['p1', 'yes'], ['p2', 'yes'], ['p3', 'yes']) });
	aus('### L4 und L1 an einem Traktandum, gleiches Ergebnis (geändert auch für L4)', '');
	aus(`- **Satz auf der Karte vor der Abstimmung:** ${lesartKartensatz(e) ?? '(keiner)'}`);
	for (const r of andereLesartenVon(a)) aus(`- ${andereLesartInWorten(r, false).leitung}`);
	aus('');
}
aus(
	'### Protokollzeile der Wertquoten',
	'',
	'Neu steht die Quote im Ausstand als eigener Posten in der Zeile, damit die Posten die Bezugsgrösse',
	'ergeben (vorher fehlte sie, und die Zeile ging nicht auf):',
	''
);
aus('Nach der Vorgabe:', '');
zitat("Wertquoten: 500 Ja, 250 Nein, 0 Enthaltung, 0 ohne Abgabe, 250 im Ausstand (von 1'000), nötig 501");
aus('Nach «fällt heraus» (die Quote im Ausstand steht dann nicht in der Zeile):', '');
zitat('Wertquoten: 500 Ja, 250 Nein, 0 Enthaltung, 0 ohne Abgabe (von 750), nötig 376');
aus(
	`Der Posten heisst bei den Wertquoten «${imAusstandInWorten(250, 'quoten')}». Bei den Köpfen gibt es ihn`,
	`nur bei der Ausschlussklage (Abschnitt 5), dort als «${imAusstandInWorten(1)}»; sonst fällt, wer im`,
	'Ausstand ist, aus der Kopfzahl (im Beispiel 3 statt 4).',
	''
);

// ── 5. 1e: Ausschlussklage ───────────────────────────────────────────────────
aus('## 5. Ausschlussklage: Angehörige bleiben in der Zahl (1e, Fassung 2026-10-25)', '');
aus(
	'**Ist-Zustand (Fassung 2026-10-24), Hinweis auf der Karte:**',
	''
);
const alt = holeRegelwerk('2026-10-24').knoten.find((k) => k.id === 'k-ausschlussklage')!;
zitat(alt.hinweise!.find((h) => h.startsWith('Ehegatte und Verwandte'))!);
aus('**Neu, Hinweis auf der Karte:**', '');
zitat(ANGEHOERIGE_HINWEIS);
aus('**Neu, unter einer hinterlegten Regel des Reglements:**', '');
zitat(ANGEHOERIGE_ERSATZ);
const klage = waehleErfordernis(RW, 'k-ausschlussklage').ergebnis!;
aus('**Neu, Hinweis an die Leitung vor der Abstimmung (Zahl über alle):**', '');
zitat(angehoerigenhinweis(klage)!);
aus('**Unverändert unter einer Klausel der Anwesenden:**', '');
zitat(angehoerigenhinweis({ ...klage, kopfbasis: 'anwesend_vertreten' })!);
aus('**Satz zum Ausstand, wo eine Regel an der Ausschlussklage Wertquoten verlangt:**', '');
zitat(ausstandFestSatz());

// ── 6. Auszählmappe ──────────────────────────────────────────────────────────
aus('## 6. Auszählmappe für den Ausfall des Servers', '');
const POSTEN: Mappenposten = {
	nummer: '1',
	titel: 'Fassade',
	erfordernis: 'Qualifiziertes Mehr',
	kopfbasis: 'anwesend_vertreten',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
};
const mappentexte = (p: Mappenposten, wahl?: 'bleibt' | 'faellt_heraus') =>
	baueAuszaehlmappe({
		gemeinschaftName: 'Prüf',
		datum: '1. Januar 2027',
		uhrzeit: '19:00',
		ort: 'Saal',
		gesamtquote: 1000,
		jeEinheit: false,
		parteien: [{ name: 'Partei 1', kopfstimmen: 1, wertquote: 1000 }],
		posten: [p],
		ausstandslesart: wahl
	})
		.zeilen.map((zeile) =>
			zeile
				.map((z) => (z.art === 'text' ? z.wert : ''))
				.filter((t) => t !== '')
				.join(': ')
		)
		.filter((t) => /Ausstand|Wertquote zählt|fällt heraus|vertreten|[Bb]etroffen/.test(t));
aus('**Nach der Vorgabe:**', '');
for (const t of mappentexte(POSTEN, 'bleibt')) zitat(t);
aus('**Nach «fällt heraus»:**', '');
for (const t of mappentexte({ ...POSTEN, ausstandFaelltHeraus: true }, 'faellt_heraus')) zitat(t);
aus('**Bei der Ausschlussklage, Anleitung zur Eingabe:**', '');
for (const t of mappentexte({
	...POSTEN,
	erfordernis: 'Ermächtigung zur Ausschlussklage',
	kopfbasis: 'alle_ausser_betroffene',
	quotenbasis: 'keine',
	quotenSchwelle: null,
	ohneBetroffene: true,
	ausstandBleibtInDerZahl: true
}).filter((t) => /Angehörige|Betroffene|DIESEM/.test(t))) zitat(t);

// ── 7. Übriges ───────────────────────────────────────────────────────────────
aus('## 7. Übriges', '');
aus('**Freigabe, als Hindernis vor dem Klick (Rest aus Block 1):**', '');
zitat(lesartVeraltetInWorten('Wahl der Bewirtschaftung'));
aus('**Nachweis im Siegel, Zeile je Traktandum mit Mehr aller Wertquoten:**', '');
zitat('Wertquote im Ausstand (Lesart L1): Wertquote zählt mit (Vorgabe)');
aus('**Satz zum Ausstand mit Fundstellen (Protokoll, Mappe), je Wahl:**', '');
zitat(ausstandslesartSatz('bleibt', true));
zitat(ausstandslesartSatz('faellt_heraus', true));

process.stdout.write(zeilen.join('\n') + '\n');
