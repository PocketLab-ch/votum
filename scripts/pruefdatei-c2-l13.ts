/**
 * Prüfdatei der Sätze zu L13 (Zählweise der Köpfe), aus dem Code erzeugt wie
 * `pruefdatei-e1-l10.ts`, für die Nachtragsprüfung nach dem Bau (Endfassung
 * Block C, Abschnitt 8): je betroffene Karte unter «Anwesende und Vertretene»
 * und «Alle Eigentümer», ohne Regel, mit angewandter Regel und mit der
 * Enthaltungsklausel, alle Sätze der Ergebniskarte, der Leitungsseite vor und
 * nach der Auszählung (mit einem Fall «abweichend» je Richtung) und des
 * Protokolls. `k-baulich-nuetzlich` als Gegenprobe: Dort wirkt L13 nicht.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-c2-l13.ts > <ziel>.md
 *
 * Alle Personen und Wohnungen sind erfunden.
 */
import { readFileSync } from 'node:fs';
import { holeRegelwerk } from '$lib/rules';
import {
	erfordernisAusKnoten,
	ergebniskarte,
	RUECKKOMMEN_TITEL,
	uebersteuere,
	type Erfordernis,
	type Ergebniskarte
} from '$lib/domain/entscheidbaum';
import { baueAuszaehlmappe, mappenpostenAus } from '$lib/domain/auszaehlmappe';
import { wahlInWorten } from '$lib/domain/lesarten';
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { knotenNachLesart, LESARTEN_VORGABE, lesartVon, type Lesartenwahl } from '$lib/domain/lesarten';
import {
	karteMitEnthaltung,
	karteMitReglement,
	wendeReglementAn,
	zaehlweiseFuerKarte,
	type Enthaltungseinstellung,
	type Reglementsregel
} from '$lib/domain/reglement';
import {
	andereLesartenVon,
	andereLesartInWorten,
	erreichbarkeitshinweis,
	kopfzaehlweiseProtokollsatz,
	kopfzaehlweiseSiegelzeile,
	lesartKartensatz,
	lesartProtokollsatz,
	mehrheitsvorschau,
	zaehleAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { kopfbasisStreit, mehrhinweise } from '$lib/domain/mehrhinweise';
import type { Snapshot, Vote, VoteChoice } from '$lib/domain/types';

const RW = holeRegelwerk();
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

const KARTEN = [
	'k-zustaendigkeit-gewoehnlich',
	'k-verwaltung-wichtig',
	'k-benutzungsweise',
	'k-bewirtschaftung-erweitert',
	'k-bewirtschaftung-waehlen-erweitert',
	'k-prozessfuehrung',
	'k-baulich-notwendig',
	'k-baulich-luxurioes-ausweg',
	'k-baulich-nuetzlich'
];

/** Die Varianten der Lesarten am Mehr, wo die Karte eine trägt. */
function mehrvarianten(k: Ergebnisknoten): [string, Partial<Lesartenwahl>][] {
	if (!k.lesart) return [['', {}]];
	const l = lesartVon(k.lesart.kennung)!;
	return l.wahlen.map((w) => [`${k.lesart!.kennung} «${w.bezeichnung}»`, { [k.lesart!.kennung]: w.wert }]);
}

const ENTHALTUNG: Enthaltungseinstellung = { fundstelle: 'Art. 12 Abs. 3 Reglement (erfunden)' };

function regelFuer(k: Ergebnisknoten): Reglementsregel {
	return {
		id: 'r-1',
		stwegId: 's-1',
		geschaeftsart: k.geschaeftsart!,
		knotenId: k.id,
		fundstelle: 'Art. 20 Reglement (erfunden)',
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quotenbasis: k.quotenbasis === 'alle_quoten' ? 'alle_quoten' : 'keine',
		quotenSchwelle: k.quotenbasis === 'alle_quoten' ? { zaehler: 1, nenner: 2, art: 'mehr_als' } : null,
		enthaltungZaehltMit: true
	};
}

function karte(titel: string, k: Ergebniskarte) {
	aus(`##### ${titel}`, '');
	for (const feld of [
		'formel',
		'rechtsgrundlage',
		'bezugsgroessensatz',
		'zahlenbeispiel',
		'stimmwirkung',
		'wortlautHinweis',
		'reglementsvorbehalt',
		'hinweise',
		'hinweiseUnterRegel'
	] as const) {
		const wert = (k as unknown as Record<string, unknown>)[feld];
		if (wert === null || wert === undefined || wert === '') continue;
		if (Array.isArray(wert)) {
			if (wert.length === 0) continue;
			aus(`- **${feld}:**`);
			for (const w of wert) aus(`  - ${typeof w === 'string' ? w : JSON.stringify(w)}`);
		} else aus(`- **${feld}:** ${String(wert)}`);
	}
	aus('');
}

/*
 * Zehn Eigentümer; p1 bis p5 halten je 120, p6 bis p10 je 80 von 1000. Da oder
 * vertreten sind p1 bis p7. Fünf Ja (p1 bis p5) erreichen unter den Anwesenden
 * die Köpfe (5 von 7) und die Wertquoten (600), unter allen aber nicht die Köpfe
 * (5 von 10). Sechs Ja erreichen beides.
 */
const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-14T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: Array.from({ length: 10 }, (_, i) => {
		const id = `p${i + 1}`;
		return {
			partyId: id,
			displayName: `Partei ${i + 1} (erfunden)`,
			representativeName: null,
			isCommunity: false,
			units: [{ unitId: `${id}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: i < 5 ? 120 : 80 }]
		};
	})
};
const DA = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

function stimmen(ja: number, nein: number, enthaltung = 0, ohne: string[] = []): Vote[] {
	const wer = DA.filter((p) => !ohne.includes(p));
	const wahl = (i: number): VoteChoice => (i < ja ? 'yes' : i < ja + nein ? 'no' : i < ja + nein + enthaltung ? 'abstain' : 'yes');
	return wer.slice(0, ja + nein + enthaltung).map((p, i) => ({
		partyId: p,
		unitId: `${p}-u`,
		choice: wahl(i),
		castAt: '2026-11-14T19:10:00.000Z',
		recordedByChair: false
	}));
}

function lage(e: Erfordernis, v: Vote[], imAusstand: string[] = []): Auszaehlungslage {
	// Wo das Erfordernis die Zustimmung Betroffener verlangt, ist es p1, und p1 stimmt Ja.
	return {
		momentaufnahme: M,
		erfordernis: e,
		stimmen: v,
		anwesende: DA,
		imAusstand,
		...(e.zustimmungBetroffenerNoetig ? { betroffeneParteiIds: ['p1'] } : {})
	};
}

function nachAuszaehlung(titel: string, l: Auszaehlungslage) {
	const a = zaehleAus(l);
	aus(
		`- **${titel}:** ${a.angenommen ? 'angenommen' : 'abgelehnt'} (Köpfe ${a.koepfe.ja} von ${a.koepfe.basis}, nötig ${a.koepfe.schwelle ?? '–'}` +
			(a.quoten.schwelle !== null ? `; Wertquoten ${a.quoten.ja} von ${a.quoten.basis}, nötig ${a.quoten.schwelle}` : '') +
			')'
	);
	for (const r of andereLesartenVon(a)) {
		const w = andereLesartInWorten(r, false);
		aus(`  - Leitung (${r.kennung}${r.abweichend ? ', abweichend' : ''}): ${w.leitung}`);
	}
	for (const h of a.hinweise ?? []) aus(`  - Hinweis: ${h}`);
	for (const h of a.protokollhinweise ?? []) aus(`  - Protokoll (${h.ort}): ${h.satz}`);
	if (a.ausstandswirkung) aus(`  - Protokoll, Wirkung des Ausstands: ${a.ausstandswirkung}`);
}

aus(
	'# Prüfdatei: Votum, Regel 43 Runde 2, Block C, Nachtrag nach dem Bau (L13 Zählweise der Köpfe)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-c2-l13.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung (Texte nach innen mit Rechtsaussagen); das Protokoll lesen auch',
	'Eigentümer. Zehn erfundene Eigentümer, p1 bis p5 zu 120, p6 bis p10 zu 80 von 1000; da oder vertreten',
	'sind p1 bis p7. Endfassung: `quellen/pruefung/zu-pruefen-2026-11-13-votum-regel43-block-c-endfassung.md`.',
	''
);

aus('## Katalog L13 (Seite «Lesarten»)', '');
const l13 = lesartVon('L13')!;
aus(`- **Frage:** ${l13.frage}`);
for (const w of l13.wahlen) aus(`- **Wahl «${w.bezeichnung}»${w.wert === l13.vorgabe ? ' (Vorgabe)' : ''}:** ${w.wirkung} ${w.fundstelle}`);
aus(`- **Warum die Vorgabe:** ${l13.warumVorgabe}`, `- **Geltung:** ${(l13.geltung ?? '').replace(/\n/g, ' / ')}`);
aus(`- **Folge (unter «Anwesende und Vertretene»):** ${l13.folgeMilderWahl}`, '');

for (const id of KARTEN) {
	const knoten = RW.knoten.find((k) => k.id === id)!;
	aus(`## ${knoten.titel} (\`${id}\`, ${knoten.rechtsgrundlage})`, '');
	for (const [mehrTitel, mehr] of mehrvarianten(knoten)) {
		for (const l13wahl of ['anwesende', 'alle'] as const) {
			const wahlen: Lesartenwahl = { ...LESARTEN_VORGABE, ...mehr, L13: l13wahl };
			for (const [fallTitel, regeln, einstellung] of [
				['ohne Regel', [], null],
				['mit Regel des Reglements', [regelFuer(knoten)], null],
				['mit Enthaltungsklausel', [], ENTHALTUNG]
			] as [string, Reglementsregel[], Enthaltungseinstellung | null][]) {
				const titel = `${mehrTitel ? `${mehrTitel}, ` : ''}L13 «${lesartVon('L13')!.wahlen.find((w) => w.wert === l13wahl)!.bezeichnung}», ${fallTitel}`;
				aus(`### ${titel}`, '');
				const hergeleitet = erfordernisAusKnoten(RW, knoten);
				const a = wendeReglementAn(hergeleitet, regeln, einstellung, wahlen);
				const e = a.erfordernis;
				aus(
					`- Gerechnet: ${e.typ}, Köpfe ${e.kopfbasis}, Wertquoten ${e.quotenbasis}, Quelle ${e.quelle}` +
						(a.regel ? `, Regel ${a.vorbehalt ? `nicht angewandt (${a.vorbehalt})` : 'angewandt'}` : '') +
						(a.enthaltung ? `, Enthaltungsklausel ${a.enthaltung.angewandt ? 'angewandt' : 'nicht angewandt'}` : ''),
					''
				);
				const gesetzlich = ergebniskarte(
					RW,
					knotenNachLesart(RW, knoten, { ...wahlen, L13: zaehlweiseFuerKarte(a, wahlen) })
				);
				karte(
					'Ergebniskarte',
					karteMitEnthaltung(karteMitReglement(gesetzlich, a.regel, a.vorbehalt, null, null, a.lesart, hergeleitet), a.enthaltung)
				);
				aus('##### Leitungsseite vor der Auszählung', '');
				aus(`- **Kartensatz:** ${lesartKartensatz(e) ?? '(keiner)'}`);
				// Neben dem Kartensatz entfällt die eigene Zeile (Endfassung, Abschnitt 5; N-L-05).
				const streit = kopfbasisStreit(e);
				if (streit && !lesartKartensatz(e)) aus(`- **Satz zur Kopfbasis (wo kein Kartensatz steht):** ${streit.satz}`);
				for (const h of mehrhinweise(e, knoten, 'zweite')) aus(`- **Hinweis an der zweiten Versammlung:** ${h}`);
				try {
					const v = mehrheitsvorschau({
						momentaufnahme: M,
						erfordernis: e,
						anwesende: ['p1', 'p2', 'p3', 'p4'],
						imAusstand: [],
						...(e.zustimmungBetroffenerNoetig ? { betroffeneParteiIds: ['p1'] } : {})
					});
					aus(`- **Vorschau mit vier Anwesenden:** ${v.satz}`);
					for (const [feld, wert] of Object.entries(v)) {
						if (typeof wert === 'string' && feld !== 'satz' && wert) aus(`  - ${feld}: ${wert}`);
					}
				} catch (f) {
					aus(`- **Vorschau:** ${(f as Error).message}`);
				}
				aus('', '##### Nach der Auszählung (Leitung) und im Protokoll', '');
				aus(`- **Zeile im Protokoll zum Mehr:** ${[lesartProtokollsatz(e), kopfzaehlweiseProtokollsatz(e)].filter(Boolean).join(' ') || '(keine)'}`);
				if (einstellung) {
					nachAuszaehlung('Vier Ja, ein Nein, zwei Enthaltungen', lage(e, stimmen(4, 1, 2)));
				} else {
					nachAuszaehlung('Fünf Ja, zwei Nein (abweichend je nach Zählweise)', lage(e, stimmen(5, 2)));
					nachAuszaehlung('Sechs Ja, ein Nein (nach beiden gleich)', lage(e, stimmen(6, 1)));
					nachAuszaehlung('Fünf Ja, ein Nein, p7 im Ausstand', lage(e, stimmen(5, 1, 0, ['p7']), ['p7']));
				}
				aus('');
			}
		}
	}
}

/*
 * **Was in der ersten Prüfdatei fehlte** (Laienprüfung Nachtrag, N-L-01;
 * Behebungsrunden): Rückkommen, Abweichung der Leitung, Anleitung zu 9 und 7 in
 * der Auszählmappe (unter L13 steht der Ausstand mit 9), Siegelzeile, Zusatz im
 * Kasten «Erfordernisse nachziehen» und die Absätze im Handbuch. Siegelzeile und Zusatz entstehen in der Schale (`server/siegel.ts`,
 * `server/reglement.ts`); der Zusatz ist hier nachgebildet, die Siegelzeile kommt aus
 * `kopfzaehlweiseSiegelzeile` (Behebungsrunde 2).
 */
const ALLE13: Lesartenwahl = { ...LESARTEN_VORGABE, L13: 'alle' };
const herleiten = (id: string, wahl: Lesartenwahl) =>
	wendeReglementAn(erfordernisAusKnoten(RW, RW.knoten.find((k) => k.id === id)!), [], null, wahl).erfordernis;

for (const id of ['k-baulich-notwendig', 'k-verwaltung-wichtig']) {
	const ziel = herleiten(id, ALLE13);
	aus(`## Rückkommen auf «${ziel.titel}», «Alle Eigentümer»`, '');
	const rk: Erfordernis = { ...ziel, titel: `${RUECKKOMMEN_TITEL}${ziel.titel}`, gemeinschaftslesart: undefined, quelle: 'gewaehlt' };
	aus(`- **Kartensatz:** ${lesartKartensatz(rk) ?? '(keiner)'}`);
	aus(`- **Zeile im Protokoll zum Mehr:** ${kopfzaehlweiseProtokollsatz(rk) ?? '(keine)'}`);
	aus(`- **Siegelzeile:** ${kopfzaehlweiseSiegelzeile(rk) ?? '(keine)'}`);
	// Codeprüfung Lauf 2, M-A; Fachprüfung Nachtrag Runde 2, N2-F-3: die Vorschau mit vier von zehn.
	const leer = zaehleAus({ ...lage(rk, []), anwesende: ['p1', 'p2', 'p3', 'p4'] });
	aus(`- **Vorschau, vier von zehn da:** ${erreichbarkeitshinweis(rk, leer, false) ?? '(keine)'}`);
	nachAuszaehlung('Fünf Ja, zwei Nein', lage(rk, stimmen(5, 2)));
	nachAuszaehlung('Fünf Ja, ein Nein, p7 im Ausstand', lage(rk, stimmen(5, 1, 0, ['p7']), ['p7']));
	aus('');
}

for (const [titel, id, typ] of [
	['notwendige Arbeiten, gesetzt auf das einfache Mehr der Anwesenden (nur die Zählweise weicht ab)', 'k-baulich-notwendig', 'einfaches_mehr'],
	['wichtigere Verwaltungshandlung, gesetzt auf das einfache Mehr der Anwesenden (Mehr und Zählweise weichen ab)', 'k-verwaltung-wichtig', 'einfaches_mehr']
] as const) {
	aus(`## Abweichung der Leitung unter «Alle Eigentümer»: ${titel}`, '');
	const gewaehlt = uebersteuere(RW, herleiten(id, ALLE13), typ, 'So stand es in der Einladung', {
		kopfbasis: 'anwesend_vertreten'
	}).ergebnis!;
	aus(`- **Kartensatz:** ${lesartKartensatz(gewaehlt) ?? '(keiner)'}`);
	nachAuszaehlung('Fünf Ja, ein Nein, p7 im Ausstand', lage(gewaehlt, stimmen(5, 1, 0, ['p7']), ['p7']));
	nachAuszaehlung('Sechs Ja, ein Nein', lage(gewaehlt, stimmen(6, 1)));
	aus('');
}

aus('## Vor der Freigabe umgestellt: L4 «Einfaches Mehr», gespeichert «Anwesende», Gemeinschaft jetzt «Alle Eigentümer»', '');
{
	const e = herleiten('k-bewirtschaftung-waehlen-erweitert', { ...LESARTEN_VORGABE, L4: 'einfach' });
	aus(`- **Kartensatz auf der Traktandenseite:** ${lesartKartensatz(e, undefined, 'alle') ?? '(keiner)'}`, '');
}

aus('## Auszählmappe: Anleitung zu 9 und 7', '');
for (const [titel, wahl] of [
	['Vorgabe', LESARTEN_VORGABE],
	['«Alle Eigentümer»', ALLE13]
] as [string, Lesartenwahl][]) {
	const e = herleiten('k-verwaltung-wichtig', wahl);
	const posten = mappenpostenAus({ nummer: '1', titel: 'Neue Heizung' }, e, M, { neuAnZweiter: false, wahl: 'erste' })!;
	const blatt = baueAuszaehlmappe({
		gemeinschaftName: 'Probe', datum: '14. Dezember 2027', uhrzeit: '19:00', ort: 'Saal',
		gesamtquote: M.totalQuota, jeEinheit: false, ausstandslesart: 'bleibt', stichentscheid: 'keiner',
		parteien: M.parties.map((p) => ({ name: p.displayName, kopfstimmen: 1, kopfstimmenJeEigentuemer: 1, wertquote: p.units[0].quota })),
		posten: [posten]
	} as never);
	aus(`### ${titel}`, '');
	for (const z of blatt.zeilen) {
		const texte = z.filter((c) => c && (c as { art: string }).art === 'text').map((c) => (c as { wert: string }).wert);
		const satz = texte.join(' ');
		if (/^(7|8|9)\b/.test(texte[1] ?? '') || /im Ausstand|Zählweise/.test(satz)) aus(`- ${satz}`);
	}
	aus('');
}

aus('## Siegelzeile (aus dem Code) und Zusatz im Kasten «Erfordernisse nachziehen» (nachgebildet)', '');
for (const w of [LESARTEN_VORGABE, ALLE13]) {
	aus(`- **Siegel, notwendige Arbeiten, L13 «${wahlInWorten('L13', w.L13)}»:** ${kopfzaehlweiseSiegelzeile(herleiten('k-baulich-notwendig', w)) ?? '(keine)'}`);
}
aus(
	`- **Kasten nach der Umstellung von «Anwesende und Vertretene» auf «Alle Eigentümer»:** bisher «… · Lesart L13: ${wahlInWorten('L13', 'anwesende')}», neu «… · Lesart L13: ${wahlInWorten('L13', 'alle')}»`,
	'- Der Zusatz steht an beiden Seiten eines Traktandums, dessen eine Seite «Alle Eigentümer» rechnet; ohne «Alle Eigentümer» auf einer Seite steht er nicht. Die Siegelzeile steht nur, wo L13 wirkt, nicht am Rückkommen.',
	''
);

aus('## Regel, die sich nicht eindeutig einordnen lässt (Vorbehalt «gemischt», Endfassung Abschnitt 7)', '');
{
	const k = RW.knoten.find((x) => x.id === 'k-verwaltung-wichtig')!;
	const hergeleitet = erfordernisAusKnoten(RW, k);
	const satz = karteMitReglement(ergebniskarte(RW, k), regelFuer(k), 'gemischt', null, null, undefined, hergeleitet)
		.reglementsvorbehalt;
	aus(`- **Reglementsvorbehalt:** ${satz ?? '(keiner)'}`, '');
}

aus('## Karten ohne Regel, deren Reglementsvorbehalt einordnet (Endfassung Abschnitt 7, `entscheidbaum.ts`)', '');
for (const id of ['k-reglement-normal', 'k-ausschlussklage']) {
	const k = RW.knoten.find((x) => x.id === id)!;
	aus(`- **${k.titel} (\`${id}\`):** ${ergebniskarte(RW, k).reglementsvorbehalt ?? '(keiner)'}`);
}
aus('');

aus('## Handbuch: Absatz zu L13, Satz unter einer Regel, Zeilen zur Auszählmappe', '');
{
	const hb = readFileSync('docs/versammlung-fuehren.md', 'utf8');
	const absatz = (anfang: string) => {
		const start = hb.indexOf(anfang);
		return hb.slice(start, hb.indexOf('\n\n', start)).replace(/\n> ?/g, ' ').replace(/\n/g, ' ');
	};
	aus(absatz('L13 gilt ab der Fassung 2026-11-14'), '');
	const regel = hb.indexOf('Sagen Sie vor\n> der Abstimmung an, nach welcher Bestimmung gezählt wird.');
	aus(`- ${hb.slice(regel, hb.indexOf('\n> Ein bestehendes Traktandum', regel)).replace(/\n> ?/g, ' ')}`);
	for (const z of hb.split('\n').filter((x) => /^\| \| `(7|9)`/.test(x))) aus(`- ${z}`);
	aus(`- ${absatz('**Die Spalten «zum Vergleich»**')}`);
	aus(`- ${absatz('**Was die 9 mit den Wertquoten macht.**')}`);
	aus('');
}

console.log(zeilen.join('\n'));
