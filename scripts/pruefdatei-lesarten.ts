/**
 * Prüfdatei der Lesarten-Texte, aus dem Code erzeugt (Konzept Lesarten,
 * Abschnitt 4: «Jeder Block mit Aussentext läuft nach `aussentext`, mit
 * Prüfdatei aus dem Code»).
 *
 * **Warum ein Skript und nicht von Hand.** Eine abgeschriebene Prüfdatei prüft
 * die Abschrift. Hier kommen Katalog, Karten, Sätze für Leitung und Protokoll
 * und die Absagen aus denselben Funktionen, die die Anwendung ruft. Die Texte
 * aus dem Svelte-Markup lassen sich nicht aufrufen; sie stehen unten als Liste,
 * und das Skript bricht ab, wenn einer davon so nicht mehr in der Quelle steht.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-lesarten.ts > <ziel>.md
 *
 * Laien- und Fachprüfung arbeiten mit der Ausgabe (`quellen/pruefung/`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { holeRegelwerk } from '$lib/rules';
import { KOMPETENZFRAGE_ID, WAEHLEN_ERWEITERT_ID, WAEHLEN_ID } from '$lib/rules/quorum-2026-10-24';
import { erfordernisAusKnoten, ergebniskarte, type Ergebniskarte } from '$lib/domain/entscheidbaum';
import { karteMitReglement, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import {
	LESARTEN,
	LESARTEN_VORGABE,
	LESARTENRECHT_IN_WORTEN,
	erfordernisNachAndererLesart,
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
import { beschriftung, EREIGNISARTEN } from '$lib/domain/verlauf';

const RW = holeRegelwerk('2026-10-24');
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

function karte(titel: string, k: Ergebniskarte | ReturnType<typeof karteMitReglement>) {
	aus(`#### ${titel}`, '');
	for (const [feld, wert] of Object.entries(k)) {
		// Der Freigabevermerk ist die Geschichte aller Fassungen, und die Hinweise
		// unter einer Regel erscheinen auf der Karte mit Regel als «zumGesetz».
		// `einstimmigkeitswegDesKnotens` zeigt die Seite nie (Codeprüfung 17.11.2026, Durchgang 3, N1).
		if (feld === 'freigabevermerk' || feld === 'hinweiseUnterRegel' || feld === 'einstimmigkeitswegDesKnotens') continue;
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
	'# Prüfdatei: Lesarten der Gemeinschaft, Block 1 (L4)',
	'',
	`Erzeugt aus dem Code mit \`scripts/pruefdatei-lesarten.ts\`, Fassung ${RW.fassung}.`,
	'Leserin: Verwaltung und Sitzungsleitung einer Stockwerkeigentümergemeinschaft (Texte nach innen,',
	'aber mit Rechtsaussagen, die im Saal und im Protokoll zählen). Das Protokoll lesen auch Eigentümer.',
	''
);

aus('## 1. Katalog: Frage, Wahlen, Vorgabe', '');
for (const l of LESARTEN) {
	aus(`### ${l.kennung}`, '', `- **Frage:** ${l.frage}`);
	for (const w of l.wahlen) {
		aus(`- **Wahl «${w.bezeichnung}»${w.wert === l.vorgabe ? ' (Vorgabe)' : ''}:** gestützt auf ${w.fundstelle}`);
	}
	aus(`- **Warum die Vorgabe:** ${l.warumVorgabe}`, '');
}
aus('**Wer umstellen darf (Wahlen):** ' + Object.values(LESARTENRECHT_IN_WORTEN).join(' · '), '');

aus('## 2. Entscheidbaum: neue Frage', '');
const frage = RW.fragen.find((f) => f.id === KOMPETENZFRAGE_ID)!;
aus(`- **Frage:** ${frage.text}`, `- **Hilfe:** ${frage.hilfe ?? ''}`);
for (const a of frage.antworten) aus(`- **Antwort:** ${a.text}`);
aus('');

aus('## 3. Karten', '');
const regel: Reglementsregel = {
	id: 'r1',
	stwegId: 's1',
	geschaeftsart: 'organe',
	knotenId: null,
	fundstelle: 'Reglement Ziff. 11',
	kopfbasis: 'anwesend_vertreten',
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
	quotenbasis: 'keine',
	quotenSchwelle: null,
	enthaltungZaehltMit: true
};
for (const id of [WAEHLEN_ERWEITERT_ID, WAEHLEN_ID]) {
	const knoten = RW.knoten.find((k) => k.id === id)!;
	const gesetzlich = ergebniskarte(RW, knoten);
	karte(`${knoten.titel} (${id}), ohne Regel`, gesetzlich);
	const a = wendeReglementAn(erfordernisAusKnoten(RW, knoten), [regel], null, LESARTEN_VORGABE);
	karte(
		`${knoten.titel}, mit hinterlegter Regel «zwei Drittel der Anwesenden» (Reglement Ziff. 11)`,
		karteMitReglement(gesetzlich, a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis)
	);
}

aus('## 4. Satz zur Lesart vor der Abstimmung (Traktandenseite, Leitung)', '');
const knotenErweitert = RW.knoten.find((k) => k.id === WAEHLEN_ERWEITERT_ID)!;
for (const wahl of [LESARTEN_VORGABE, { ...LESARTEN_VORGABE, L4: 'einfach' } as Lesartenwahl]) {
	const e = wendeLesartAn(erfordernisAusKnoten(RW, knotenErweitert), wahl);
	aus(`- **Gewählt «${wahl.L4}»:** ${lesartKartensatz(e)}`);
}
aus('');

aus('## 5. Sätze nach der Auszählung (Leitung) und im Protokoll', '');
const beispiel = (teil: Partial<ErgebnisNachAndererLesart>): ErgebnisNachAndererLesart => ({
	kennung: 'L4',
	eigeneWahl: 'Einfaches Mehr',
	wahl: 'Qualifiziertes Mehr',
	verlangt: erfordernisInWorten(erfordernisNachAndererLesart(erfordernisAusKnoten(RW, knotenErweitert))!),
	feststellbar: true,
	angenommen: false,
	koepfe: { ja: 2, basis: 3, schwelle: 2, erreicht: true },
	quoten: { ja: 400, basis: 1000, schwelle: 501, erreicht: false },
	abweichend: true,
	...teil
});
for (const [titel, r, geheim] of [
	['Abweichend, offen abgestimmt', beispiel({}), false],
	['Abweichend, geheim abgestimmt', beispiel({}), true],
	[
		'Umgekehrt: eingestellt «Qualifiziertes Mehr», abgelehnt; nach dem einfachen Mehr angenommen',
		beispiel({
			eigeneWahl: 'Qualifiziertes Mehr',
			wahl: 'Einfaches Mehr',
			verlangt: 'mehr als die Hälfte der Anwesenden oder Vertretenen',
			angenommen: true,
			quoten: null
		}),
		false
	],
	['Gleich', beispiel({ abweichend: false }), false],
	[
		'Nicht feststellbar (Handzählung)',
		beispiel({ feststellbar: false, nichtFeststellbarWeil: 'summen', angenommen: null, abweichend: false }),
		false
	],
	[
		// Bei L4 nicht erreichbar (Fachprüfung Runde 5; Wächter im Test), für die nächste Lesart.
		'Nicht feststellbar (Stichentscheid nach der anderen Lesart offen; bei L4 nicht erreichbar)',
		beispiel({ feststellbar: false, nichtFeststellbarWeil: 'stichentscheid', angenommen: null, abweichend: false }),
		false
	]
] as const) {
	const s = andereLesartInWorten(r, geheim);
	aus(`### ${titel}`, '', `- **Leitung:** ${s.leitung}`, `- **Protokoll am Ausgang:** ${s.protokoll ?? '(kein Satz)'}`, '');
}
aus('### Zeile im Protokoll je Beschluss', '');
for (const wahl of [LESARTEN_VORGABE, { ...LESARTEN_VORGABE, L4: 'einfach' } as Lesartenwahl]) {
	const e = wendeLesartAn(erfordernisAusKnoten(RW, knotenErweitert), wahl);
	aus(`- **Gewählt «${wahl.L4}»:** ${lesartProtokollsatz(e)}`);
}
aus('');

aus('## 6. Absagen und Verlauf', '');
const server = readFileSync(join(process.cwd(), 'src/lib/server/lesarten.ts'), 'utf8');
const freigabe = readFileSync(join(process.cwd(), 'src/lib/server/freigabe.ts'), 'utf8');
const zeichenketten = (t: string, anker: string) => {
	const i = t.indexOf(anker);
	// Ohne Anker kein stiller Unsinn (Codeprüfung Teil 4, niedrig 5).
	if (i < 0) {
		console.error(`pruefdatei-lesarten: Anker «${anker}» steht nicht mehr in der Quelle.`);
		process.exit(1);
	}
	const stueck = t.slice(i, t.indexOf(';', i));
	return [...stueck.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
};
aus(
	`- **Sitzungsleitung ohne Erlaubnis:** ${zeichenketten(server, 'LESARTEN_DER_VERWALTUNG_VORBEHALTEN =')}`,
	`- **Wer umstellen darf, durch die Sitzungsleitung:** Wer die Lesarten umstellen darf, legt nur die Verwaltung fest.`,
	`- **Freigabe mit veraltetem Traktandum:** Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «…» sein ${zeichenketten(freigabe.slice(0, freigabe.indexOf("'lesart'\n\t);")), "'Mehr bekam.")}`,
	`- **Verlauf:** ${beschriftung(EREIGNISARTEN.lesartGesetzt)} · ${beschriftung(EREIGNISARTEN.lesartenrechtGesetzt)}`,
	''
);

/*
 * Die Texte aus dem Markup. Jeder muss so, mit Leerraum zusammengefasst, in
 * seiner Datei stehen; sonst bricht das Skript ab.
 */
const MARKUP: [string, string[]][] = [
	[
		'src/routes/gemeinschaften/[id=kennung]/lesarten/+page.svelte',
		[
			'Lesarten der Gemeinschaft',
			'An einigen Stellen ist umstritten, wie das Gesetz zu lesen ist, und das Ergebnis einer Abstimmung kann davon abhängen. Hier wird für die Gemeinschaft eingestellt, nach welcher Lesart Votum rechnet. Votum rechnet zusätzlich nach der anderen und nennt das Ergebnis. Gilt für ein Traktandum eine Regel Ihres Reglements, rechnet es nach ihr; die Karte des Traktandums nennt dann, was das Gesetz verlangen würde.',
			'Die Einstellung gilt für Versammlungen, deren Einladung danach freigegeben wird. Haben Traktanden einer Versammlung, die noch nicht freigegeben ist, schon ein Mehr, erscheinen sie unten, und Sie ziehen sie dort nach.',
			'Ihr Konto kann die Lesarten hier nur ansehen.',
			'Lesarten, die das Gesetz offenlässt',
			'Auch die Universalversammlung hängt an einer Einstellung. An ihr beschliesst die Versammlung ohne ordentliche Einladung, weil alle Eigentümer da sind und niemand widerspricht; nicht geklärt ist, ob dafür eine Vollmacht genügt. Eingestellt ist:',
			'Diese Angabe stellt nur die Verwaltung um, auf der Seite'
		]
	],
	[
		'src/lib/components/Lesartenwahl.svelte',
		['Warum die Vorgabe:', 'Vorgabe, nie geändert.', 'Lesarten speichern']
	],
	[
		'src/routes/gemeinschaften/[id=kennung]/reglement/+page.svelte',
		[
			'An einigen Stellen ist umstritten, wie das Gesetz zu lesen ist, und das Ergebnis einer Abstimmung kann davon abhängen. Votum rechnet nach der Lesart, die auf der Seite «Lesarten» eingestellt ist, und zusätzlich nach der anderen und nennt das Ergebnis. Gilt eine Regel Ihres Reglements, rechnet es nach ihr; die Karte des Traktandums nennt dann, was das Gesetz verlangen würde.',
			'Die Einstellung gilt für Versammlungen, deren Einladung danach freigegeben wird. Haben Traktanden einer Versammlung, die noch nicht freigegeben ist, schon ein Mehr, erscheinen sie oben als Traktanden mit älterem Erfordernis, und Sie ziehen sie dort nach.',
			'Wer darf die Lesarten umstellen?',
			'Die Sitzungsleitung stellt dann nur die Lesarten um, auf der Seite',
			'Nur die Verwaltung ändert diese Einstellung und die Angabe zur Universalversammlung.'
		]
	]
];
aus('## 7. Seitentexte (aus dem Markup, gegen die Quelle geprüft)', '');
const fehlt: string[] = [];
for (const [datei, texte] of MARKUP) {
	const quelle = readFileSync(join(process.cwd(), datei), 'utf8').replace(/\s+/g, ' ');
	aus(`### ${datei}`, '');
	for (const t of texte) {
		if (!quelle.includes(t)) fehlt.push(`${datei}: «${t.slice(0, 70)}…»`);
		aus(`- ${t}`);
	}
	aus('');
}
if (fehlt.length > 0) {
	console.error(`pruefdatei-lesarten: ${fehlt.length} Text(e) stehen so nicht mehr in der Quelle:\n  ${fehlt.join('\n  ')}`);
	process.exit(1);
}

console.log(zeilen.join('\n'));
