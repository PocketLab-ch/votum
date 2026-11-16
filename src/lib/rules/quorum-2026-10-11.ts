/**
 * Regelwerk, Fassung 2026-10-11.
 *
 * **Daten, kein Code** (AD-4), mit einer Ausnahme, die an der Fassung hängt:
 * Ab dieser Fassung zählt die Auszählung die gemeinsame Wohnung des Beklagten
 * in der Bezugsgrösse mit (`beklagtenwohnungZaehltMit` in
 * `domain/entscheidbaum.ts`). Am Erfordernis selbst und an keinem Weg durch den
 * Entscheidbaum ändert sich etwas.
 *
 * Drei Befunde aus der Fachprüfung der Website-FAQ vom 30.09.2026
 * (`quellen/pruefung/berichte/2026-09-30-faq-quorenkarten.md`, «Kartenbefunde»):
 *
 * 1. **`k-kenntnisnahme`.** «genügt … eine anwesende Person … für die ganze
 *    Wohnung» überdehnte Rz. 19 und 24 ad Art. 712o; beide betreffen die
 *    Stimmabgabe. Jetzt: Sie stimmt für die ganze Wohnung an einer
 *    einberufenen Versammlung; für die Universalversammlung ist es unsere
 *    Lesart, und sicher ist sie, wenn alle Eigentümer der Wohnung da sind
 *    (Fachprüfung Runde 2, B1).
 * 2. **`k-ausschlussklage`, zwei und drei Eigentümer.** «In kleinen
 *    Gemeinschaften läuft das faktisch auf die Zustimmung aller übrigen hinaus»
 *    schwieg zum direkten Klagerecht bei zwei Eigentümern (Wortlaut) und zur
 *    Kommentarmeinung bei drei (Art. 712a Rz. 214, mit Piccinin).
 * 3. **`k-ausschlussklage`, gemeinsame Wohnung des Beklagten.** Votum nahm sie
 *    ganz aus der Bezugsgrösse; nach dem Wortlaut von Art. 649b Abs. 2 bleiben
 *    die übrigen Eigentümer der Wohnung Miteigentümer. Gemessen am 30.09.2026:
 *    zehn Wohnungen, eine dem Beklagten und seiner Ehefrau gemeinsam, fünf Ja
 *    von neun angenommen. Produktentscheid 30.09.2026: Rechnung ändern, auch
 *    wenn der Mitberechtigte kein Angehöriger ist. Richtet sich der Antrag
 *    gegen alle Eigentümer der Wohnung, fällt sie heraus; das hält die Leitung
 *    beim Beklagten fest (Migration 132, Produktentscheid 30.09.2026, nach
 *    F3-1: Rz. 216 ad Art. 712a). Die Karte sagt es in einem eigenen Hinweis.
 *
 * **Ohne Aussage über das Werkzeug**, wo der Satz nicht die Rechnung von Votum
 * beschreibt, weil der Export die Karte wörtlich auf die Website nimmt
 * (`scripts/quorumsbaum-export.mjs`). Wo die Karte sagt, was Votum zählt und
 * wo die Leitung etwas festhält, setzt der Export eine eigene Fassung ein
 * (`GEMEINSAME_WOHNUNG_WEBSITE`, über `UMFORMULIERUNGEN`).
 *
 * Geprüft in acht Runden Laien- und Fachprüfung,
 * `quellen/pruefung/berichte/2026-09-30-kartenbefunde-ausschlussklage.md`.
 *
 * Auftrag `.auftraege/2026-09-30-kartenbefunde-kenntnisnahme-ausschlussklage.md`.
 */

import type { Ergebnisknoten, HinweisUnterRegel } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_10 } from './quorum-2026-10-10';

/** Befund 1: der Satz zur gemeinsamen Wohnung an der Universalversammlung. */
const KENNTNISNAHME_ALT =
	'Gehört eine Wohnung mehreren, genügt nach dem SVIT-Kommentar eine anwesende Person von ihnen ' +
	'für die ganze Wohnung; eine ausdrückliche Vollmacht der übrigen braucht sie dafür nicht ' +
	'(Rz. 19 und 24 ad Art. 712o).';

export const KENNTNISNAHME_NEU =
	'Gehört eine Wohnung mehreren, lässt der SVIT-Kommentar an einer einberufenen Versammlung eine ' +
	'anwesende Person von ihnen für die ganze Wohnung stimmen, ohne ausdrückliche Vollmacht der ' +
	'übrigen (Rz. 19 und 24 ad Art. 712o). Ob eine Person auch für die Universalversammlung genügt, ' +
	'sagt er nicht; nach unserer Lesart ja. Sicher ist die Universalversammlung, wenn alle ' +
	'Eigentümer der Wohnung da sind.';

/** Befund 2: der Hinweis zu kleinen Gemeinschaften, am Wortanfang erkannt. */
const KLEINE_ANFANG = 'In kleinen Gemeinschaften läuft das faktisch';

/**
 * «Zwei Eigentümer» nach dem Gesetz; Rz. 214 spricht von zwei Anteilen und
 * überträgt es mit Piccinin, Rz. 501, auf drei Eigentümer. Der Schluss nach
 * Fachprüfung 30.09.2026, F2-1: Darf einer der beiden nicht mitstimmen, ist
 * die Zustimmung nach dem Wortlaut unerreichbar.
 */
export const KLEINE_GEMEINSCHAFTEN =
	'Bei zwei Eigentümern braucht es keinen Beschluss: Jeder kann direkt klagen (ZGB Art. 649b ' +
	'Abs. 2). Bei drei Eigentümern kann nach dem SVIT-Kommentar ebenfalls jeder direkt klagen ' +
	'(Art. 712a Rz. 214, mit Piccinin); nach dem Wortlaut braucht es die Zustimmung der beiden ' +
	'Eigentümer ausser dem Beklagten. Sicher ist die Ermächtigung dort also, wenn beide zustimmen. ' +
	'Darf einer der beiden nicht mitstimmen, etwa als Ehegatte des Beklagten mit eigener Wohnung, ' +
	'ist diese Zustimmung nicht zu erreichen. Dann bleibt die direkte Klage nach dem Kommentar. ' +
	'Lassen Sie vor der Klage trotzdem abstimmen, auch wenn dann nur eine Person stimmen darf, und ' +
	'halten Sie im Protokoll fest, wer zugestimmt hat und wer im Ausstand war.';

/** Befund 3, der gemeinsame Teil von Anwendung und Website (Prüfrunden 1 bis 8). */
const GEMEINSAME_WOHNUNG_KERN =
	'Gehört die Wohnung des Beklagten mehreren, etwa ihm und seiner Ehefrau, stimmt diese Wohnung ' +
	'nicht ab, weil es um die Person eines ihrer Eigentümer geht (SVIT-Kommentar Rz. 23 ad ' +
	'Art. 712o). Richtet sich der Antrag nur gegen ihn, bleibt die Wohnung in der Zahl, an der die ' +
	'Mehrheit gemessen wird, denn Art. 649b Abs. 2 nimmt nur den Beklagten aus; solange sie in der ' +
	'Zahl steht, wirkt sie wie ein Nein. Bei zehn Wohnungen mit je einer Stimme braucht es dann ' +
	'sechs Ja von zehn. Richtet er sich gegen alle Eigentümer der Wohnung, fällt sie aus der Zahl, ' +
	'und es braucht fünf Ja von neun. Gegen wen sich die Klage richten muss, hängt von der ' +
	'Eigentumsform ab und ist bei einer Familienwohnung umstritten (Art. 712a Rz. 216); klären Sie ' +
	'es vor der Einladung, etwa mit der Anwältin oder dem Anwalt, die für die Klage vorgesehen sind, ' +
	'und richten Sie den Antrag danach.';

/**
 * Befund 3, auf der Karte der Anwendung. Rz. 23 trägt das Ruhen der Stimme,
 * der Wortlaut von Art. 649b Abs. 2 die Bezugsgrösse; Rz. 216 nur, gegen wen
 * geklagt wird (Fachprüfung Runde 2, B5).
 */
export const GEMEINSAME_WOHNUNG =
	GEMEINSAME_WOHNUNG_KERN +
	' Dieses Werkzeug zählt die Wohnung selbst mit, wenn sich der Antrag nur gegen ihn richtet; ' +
	'zählen Sie sie nicht noch einmal hinzu. Gegen wen er sich richtet, halten Sie unter «Jetzt ' +
	'möglich», «Betroffene» beim Beklagten fest; vorgegeben ist «nur eine Person beklagt», die ' +
	'strengere Rechnung.';

/**
 * Dieselbe Stelle auf der Website, wo nichts rechnet und nichts gefragt wird
 * (Fachprüfung Runde 2, B4; Runde 3, Befund 5). Der Export setzt sie über
 * `UMFORMULIERUNGEN` ein.
 */
export const GEMEINSAME_WOHNUNG_WEBSITE =
	GEMEINSAME_WOHNUNG_KERN +
	' Zählen Sie die Wohnung dann einmal mit, wenn sich der Antrag nur gegen ihn richtet, und ' +
	'nicht noch einmal für Mitbeteiligte, denen nur diese Wohnung gehört.';

/**
 * Unter einer angewandten Regel. Nennt sie alle Eigentümer, rechnet Votum die
 * Wohnung mit (`kopfbasisDerRegel` liest das als alle ohne den Beklagten);
 * unter einer Mehrheit der Anwesenden zählt sie wie eine abwesende nicht.
 */
export const GEMEINSAME_WOHNUNG_UNTER_REGEL =
	'Gehört die Wohnung des Beklagten mehreren, etwa ihm und seiner Ehefrau, stimmt diese Wohnung ' +
	'nicht ab (SVIT-Kommentar Rz. 23 ad Art. 712o). Für die Mehrheit aller Eigentümer ohne die ' +
	'Beklagten, die es neben der Mehrheit nach Ihrem Reglement für eine sichere Ermächtigung ' +
	'braucht, zählt sie einmal mit, wenn sich der Antrag nur gegen ihn richtet; das sind bei zehn ' +
	'Wohnungen mit je einer Stimme sechs Ja. Zugleich muss die Mehrheit erreicht sein, die Ihr ' +
	'Reglement verlangt. Gegen wen sich die Klage richten muss, hängt von der Eigentumsform ab und ' +
	'ist bei einer Familienwohnung umstritten (Art. 712a Rz. 216); klären Sie es vor der ' +
	'Einladung, etwa mit der Anwältin oder dem Anwalt, die für die Klage vorgesehen sind, und ' +
	'richten Sie den Antrag danach. Gegen wen er sich richtet, halten Sie unter «Jetzt möglich», ' +
	'«Betroffene» beim Beklagten fest. Was dieses Werkzeug rechnet, hängt an Ihrer Bestimmung: Stellt sie auf ' +
	'alle Eigentümer ab, zählt es die Wohnung mit, ausser Sie haben festgehalten, dass sich der ' +
	'Antrag gegen alle ihre Eigentümer richtet; stellt sie auf die Anwesenden ab, zählt es sie ' +
	'nicht; richtet sich der Antrag in diesem Fall nur gegen ihn, zählen Sie sie nach der ' +
	'Abstimmung selbst zur Zahl aller Eigentümer hinzu, nicht zu den Ja-Stimmen.';

/** Ersetzt genau einen Hinweis; beim Laden werfen, statt still nichts zu tun. */
function ersetze(k: Ergebnisknoten, passt: (h: string) => boolean, neu: string, was: string): Ergebnisknoten {
	const alt = k.hinweise ?? [];
	const treffer = alt.filter(passt);
	if (treffer.length !== 1) {
		throw new Error(
			`Fassung 2026-10-11: «${k.id}» trägt ${treffer.length} Hinweise ${was}, erwartet war einer.`
		);
	}
	const vorher = treffer[0];
	const unterRegel = k.hinweiseUnterRegel?.map(
		(u): HinweisUnterRegel => (u.hinweis === vorher ? { ...u, hinweis: neu } : u)
	);
	return {
		...k,
		hinweise: alt.map((h) => (h === vorher ? neu : h)),
		...(unterRegel ? { hinweiseUnterRegel: unterRegel } : {})
	};
}

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function kenntnisnahme(k: Ergebnisknoten): Ergebnisknoten {
	const passt = (h: string) => h.includes(KENNTNISNAHME_ALT);
	// Ersetzt wird nur der Satz, nicht der ganze Hinweis; `ersetze` wirft, wenn
	// er nicht in genau einem Hinweis steht.
	const neu = ((k.hinweise ?? []).find(passt) ?? '').replace(KENNTNISNAHME_ALT, KENNTNISNAHME_NEU);
	return ersetze(k, passt, neu, 'mit dem Satz zur gemeinsamen Wohnung');
}

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function ausschlussklage(k: Ergebnisknoten): Ergebnisknoten {
	const n = ersetze(k, (h) => h.startsWith(KLEINE_ANFANG), KLEINE_GEMEINSCHAFTEN, `mit «${KLEINE_ANFANG}»`);
	const hinweise = n.hinweise ?? [];
	// Hinter den Hinweis zu den Angehörigen, auf den er sich bezieht.
	const nach = hinweise.findIndex((h) => h.startsWith('Ehegatte und Verwandte des Beklagten'));
	if (nach < 0) {
		throw new Error('Fassung 2026-10-11: «k-ausschlussklage» trägt den Hinweis zu den Angehörigen nicht.');
	}
	return {
		...n,
		hinweise: [...hinweise.slice(0, nach + 1), GEMEINSAME_WOHNUNG, ...hinweise.slice(nach + 1)],
		hinweiseUnterRegel: [
			...(n.hinweiseUnterRegel ?? []),
			{ hinweis: GEMEINSAME_WOHNUNG, ersatz: GEMEINSAME_WOHNUNG_UNTER_REGEL }
		]
	};
}

export const REGELWERK_2026_10_11 = {
	...REGELWERK_2026_10_10,
	fassung: '2026-10-11',

	quellen: [
		...REGELWERK_2026_10_10.quellen,
		'ZGB Art. 649b Abs. 2 (umfasst die Gemeinschaft nur zwei Miteigentümer, steht jedem das ' +
			'Klagerecht zu; im Übrigen Mehrheitsbeschluss aller Miteigentümer mit Ausnahme des ' +
			'Beklagten).',
		'Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 214 (bei zwei Stockwerkanteilen direkte ' +
			'Klage; dasselbe bei drei Stockwerkeigentümern, mit Piccinin, Rz. 501); Art. 712o Rz. 5 ' +
			'(jedes Mitglied eines gemeinschaftlichen Eigentums ist vollumfänglich Stockwerkeigentümer) ' +
			'und Rz. 23 (geht es vorwiegend um die Person eines gemeinschaftlichen Eigentümers, kann das ' +
			'Stimmrecht nicht ausgeübt werden).'
	],

	knoten: REGELWERK_2026_10_10.knoten.map((k): Ergebnisknoten =>
		k.id === 'k-kenntnisnahme' ? kenntnisnahme(k) : k.id === 'k-ausschlussklage' ? ausschlussklage(k) : k
	),

	freigabevermerk:
		REGELWERK_2026_10_10.freigabevermerk +
		' Am 11.10.2026 zählt die Ermächtigung zur Ausschlussklage eine Wohnung, die dem Beklagten mit ' +
		'anderen gemeinsam gehört, in der Bezugsgrösse mit, ohne dass sie abstimmt, wenn sich der ' +
		'Antrag nur gegen ihn richtet; das hält die Sitzungsleitung beim Beklagten fest. Die Karte ' +
		'nennt das direkte Klagerecht bei zwei Eigentümern und die Kommentarmeinung bei drei, und die ' +
		'Karte zur Kenntnisnahme sagt, wann eine Universalversammlung mit einer gemeinsamen Wohnung ' +
		'sicher ist.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
