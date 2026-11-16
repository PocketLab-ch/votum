/**
 * Regelwerk, Fassung 2026-10-20: der Einsprachebeschluss nach ZGB Art. 712c
 * Abs. 2.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung fügt der Frage `f8-1` («Welcher
 * Sonderfall?») eine Antwort und dem Baum einen Knoten hinzu und nennt die
 * Einsprache in der Beschreibung des Asts «Sonderfälle». An den übrigen Ästen,
 * Knoten, Fragen und Antworten ändert sich nichts; die Fassungsprobe in
 * `tests/domain/einsprache-712c.test.ts` hält das fest.
 *
 * **Der Anlass** (Auftrag 19.10.2026, aus der Pendenz «Kein Knoten für den
 * Einsprachebeschluss»): Der Baum kannte das Einführen und Aufheben eines
 * Einspracherechts (`k-vorkaufsrecht`, Einstimmigkeit), nicht aber den
 * Beschluss, mit dem die übrigen Eigentümer ein vereinbartes Einspracherecht
 * ausüben. Am Volltext erhoben am 19.10.2026:
 *
 *   - **Mehr:** einfaches Mehr der Versammlung, «unter Vorbehalt einer
 *     anderslautenden Vereinbarung» (Wermelinger, SVIT-Kommentar 2023,
 *     Art. 712c Rz. 185); ebenso Handschin/Wyttenbach, S. 68 f., mit der dort
 *     zitierten Lehre. Das Gesetz sagt nur «Beschluss»; deshalb Rang `lehre`.
 *   - **Betroffener:** Wer verkauft, vermietet oder belastet, stimmt nicht mit
 *     (Rz. 185: «die übrigen Stockwerkeigentümer»; Handschin/Wyttenbach,
 *     S. 64). Die Kopfbasis bleibt die der Anwesenden; herausgenommen wird er
 *     über `betroffeneStimmenNichtMit`, wie der Beklagte der Ausschlussklage.
 *   - **Reglement:** verschärfen ja, erleichtern nicht (Rz. 186). Dafür das
 *     neue Verhalten `nur_verschaerfen`.
 *   - **Frist, wichtiger Grund, Form:** Rz. 187 bis 194; die Hinweise unten.
 *
 * **Geschäftsart `grundordnung`**, wie beim Vorkaufs- und Einspracherecht
 * (Ä-24): Ohne Absprache stimmt der Eigentümer, nicht der Nutzniesser
 * (`auffangregelStimmrecht`). Die Einsprache betrifft, wer in die
 * Gemeinschaft eintritt, nicht die Verwaltung (vgl. Rz. 46 ad Art. 712o). Ob
 * der Nutzniesser trotzdem stimmt, ist nicht geklärt: Nach Rz. 45 ad
 * Art. 712o hat er eine beinahe vollständige Verwaltungsmacht. Votum wählt den
 * Eigentümer (Laien- und Fachprüfung Runde 1, 19.10.2026).
 *
 * **Nur fallgenau** (`regelNurFallgenau`): Eine Regel für die ganze
 * Grundordnung wirkt nicht auf die Einsprache, sonst senkte etwa eine Regel
 * zum Verkauf gemeinschaftlicher Teile still ein Mehr, das sich nicht
 * erleichtern lässt.
 */
import type { Antwort, Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_19 } from './quorum-2026-10-19';

export const EINSPRACHE_KNOTEN_ID = 'k-einsprache';

/**
 * Der Hinweis zu den Betroffenen, in der Fassung für die Anwendung. Die
 * Website rechnet und erfasst nichts; dort steht die Fassung darunter
 * (`scripts/quorumsbaum-export.mjs`, `UMFORMULIERUNGEN`).
 */
export const EINSPRACHE_BETROFFENE_ANWENDUNG =
	'Wer verkauft, vermietet oder belastet, stimmt nicht mit. Ob er Vollmachten anderer ausüben ' +
	'darf, ist nicht geklärt; Votum zählt sie hier nicht. Raten Sie den übrigen Eigentümern, etwa ' +
	'im Begleitschreiben zur Einladung, ihm keine zu geben. Tragen Sie ihn am Traktandum als ' +
	'betroffene Partei ein, in der Sitzungsleitung unter «Jetzt möglich», «Betroffene».';

export const EINSPRACHE_BETROFFENE_WEBSITE =
	'Wer verkauft, vermietet oder belastet, stimmt nicht mit. Ob er Vollmachten anderer ausüben ' +
	'darf, ist nicht geklärt; geben Sie ihm für diese Versammlung besser keine.';

export const EINSPRACHE: Ergebnisknoten = {
	id: EINSPRACHE_KNOTEN_ID,
	titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
	typ: 'einfaches_mehr',
	geschaeftsart: 'grundordnung',
	rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Das Gesetz verlangt einen Beschluss der übrigen Eigentümer, nennt aber kein Mehr. Nach der ' +
		'Lehre genügt das einfache Mehr der Anwesenden oder Vertretenen (Wermelinger, SVIT-Kommentar ' +
		'2023, Art. 712c Rz. 185; Handschin/Wyttenbach, S. 68 f.). Nach Gesetz hat dabei jeder ' +
		'Eigentümer eine Stimme (Art. 712m Rz. 181). Wer verkauft, vermietet oder mit Nutzniessung oder ' +
		'Wohnrecht belastet, stimmt nicht mit (Handschin/Wyttenbach, S. 64).',
	beispiele: [
		'Einsprache gegen die Vermietung einer Wohnung an einen Betrieb, der sie tageweise an ' +
			'wechselnde Gäste weitervermietet'
	],
	hinweise: [
		'Die Einsprache muss innert 14 Tagen beim Eigentümer eingehen, der verkauft, vermietet oder ' +
			'belastet; der Beschluss allein genügt nicht. Die Frist beginnt, sobald Ihnen der ' +
			'abgeschlossene Vertrag mitgeteilt wird, auch von der Gegenpartei (etwa Käufer, Mieter oder Nutzniesser) und auch wenn die ' +
			'Mitteilung nur bei der Verwaltung eingeht (Art. 712t Abs. 3; Rz. 190, 41 ad Art. 712c). Sie ' +
			'lässt sich weder verlängern noch unterbrechen (Rz. 190 ad Art. 712c). Legen Sie im Beschluss ' +
			'fest, wer die Einsprache überbringt, und halten Sie fest, wann sie zugegangen ist, etwa mit ' +
			'Übergabe gegen Quittung (Rz. 192).',
		'Massgebend ist die Einladungsfrist Ihres Reglements, ohne eine solche eine den Umständen ' +
			'angemessene Frist (Rz. 25 f. ad Art. 712n). Reicht sie nicht für Beschluss und Zustellung in ' +
			'14 Tagen (Rz. 29 ad Art. 712n), bleibt nach dem SVIT-Kommentar eine Universalversammlung ' +
			'(Rz. 191 ad Art. 712c). Nach einer abweichenden Meinung gehen die 14 Tage einer längeren ' +
			'Einladungsfrist vor. Ist die Versammlung nicht beschlussfähig, käme eine zweite zu spät ' +
			'(Rz. 38 ad Art. 712p). Klären Sie das Vorgehen deshalb mit einer Fachperson, sobald Sie ' +
			'hören, dass jemand verkaufen, vermieten oder belasten will, nicht erst nach dem Vertrag.',
		'Die Einsprache wirkt nur bei einem wichtigen Grund, etwa wenn das Geschäft für die übrigen ' +
			'Eigentümer unannehmbare Folgen hat. Nennen Sie ihn im Antrag und in der Einsprache, mit den ' +
			'Folgen für das Haus. Ob er vorliegt, entscheidet auf Klage des Eigentümers, der verkauft, ' +
			'vermietet oder belastet, das Gericht (Art. 712c Abs. 3; Rz. 187 bis 194).',
		EINSPRACHE_BETROFFENE_ANWENDUNG
	],
	reglementsverhalten: 'nur_verschaerfen',
	reglementsrecht:
		'Ein strengeres Mehr gilt nur, wenn es mit dem Einspracherecht oder später von allen ' +
		'Eigentümern schriftlich vereinbart wurde. Ein milderes gilt nie (Wermelinger, ' +
		'SVIT-Kommentar 2023, Art. 712c Rz. 183, 186; Art. 712g Rz. 83).',
	rang: 'lehre'
};

export const EINSPRACHE_ANTWORT: Antwort = {
	id: 'f8-1-einsprache',
	text:
		'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht an einer Einheit erheben ' +
		'(vereinbartes Einspracherecht)',
	ziel: EINSPRACHE_KNOTEN_ID,
	hilfe:
		'Nur möglich, wenn das Einspracherecht im Begründungsakt steht oder alle damaligen Eigentümer ' +
		'es schriftlich vereinbart haben. Das steht etwa im Begründungsakt beim Grundbuchamt oder in ' +
		'einem von allen unterschriebenen Reglement; ein mit Mehrheit beschlossenes Reglement genügt ' +
		'nicht. ' +
		'Gegen Käufer, Mieter oder Berechtigte wirkt es nur, wenn es im Grundbuch vorgemerkt ist ' +
		'(Grundbuchauszug). Sonst bleibt der Vertrag gültig; erheben Sie die Einsprache trotzdem ' +
		'fristgerecht. Hält sich der Eigentümer nicht daran, bleibt Schadenersatz. Bei Miete, ' +
		'Nutzniessung oder Wohnrecht bleibt unter strengen Voraussetzungen auch das ' +
		'Ausschlussverfahren (Rz. 180 bis 182, 195 ad Art. 712c). Es ' +
		'einführen oder aufheben: «Grundstück und Grundordnung».'
};

/** Die Beschreibung des Asts «Sonderfälle», mit der Einsprache. */
export const SONDERFAELLE_BESCHREIBUNG =
	'Ausschlussklage, Einsprache, Zirkularbeschluss, Zuständigkeit neu regeln.';

/** Hinter der Ausschlussklage, vor dem Zirkularbeschluss. */
function mitNeuerAntwort(f: Frage): Frage {
	if (f.id !== 'f8-1') return f;
	const i = f.antworten.findIndex((a) => a.id === 'f8-1-ausschluss');
	if (i < 0) throw new Error('Fassung 2026-10-20: «f8-1-ausschluss» fehlt in der Vorfassung.');
	return {
		...f,
		antworten: [...f.antworten.slice(0, i + 1), EINSPRACHE_ANTWORT, ...f.antworten.slice(i + 1)]
	};
}

if (REGELWERK_2026_10_19.knoten.some((k) => k.id === EINSPRACHE_KNOTEN_ID)) {
	throw new Error(`Fassung 2026-10-20: «${EINSPRACHE_KNOTEN_ID}» gibt es schon.`);
}
if (!REGELWERK_2026_10_19.aeste.some((a) => a.id === 'a-sonderfaelle')) {
	throw new Error('Fassung 2026-10-20: «a-sonderfaelle» fehlt in der Vorfassung.');
}

export const REGELWERK_2026_10_20 = {
	...REGELWERK_2026_10_19,
	fassung: '2026-10-20',

	aeste: REGELWERK_2026_10_19.aeste.map((a) =>
		a.id === 'a-sonderfaelle' ? { ...a, beschreibung: SONDERFAELLE_BESCHREIBUNG } : a
	),

	fragen: REGELWERK_2026_10_19.fragen.map(mitNeuerAntwort),

	knoten: [...REGELWERK_2026_10_19.knoten, EINSPRACHE],

	freigabevermerk:
		REGELWERK_2026_10_19.freigabevermerk +
		' In der Fassung 2026-10-20 kennt der Baum den Beschluss über eine Einsprache nach Art. 712c ' +
		'Abs. 2, bei dem die betroffene Partei nicht mitstimmt.'
} satisfies Regelwerk;
