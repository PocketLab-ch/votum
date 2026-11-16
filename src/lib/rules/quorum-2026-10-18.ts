/**
 * Regelwerk, Fassung 2026-10-18: Rang und Gegenmeinung je Regel.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert kein Erfordernis, keinen
 * Weg, keinen Text auf einer Karte. Sie trägt zwei neue Merkmale ein, `rang`
 * an jedem Knoten mit Erfordernis und `gegenmeinung` an vier Knoten.
 *
 * **Der Anlass** sind Ä-01, Ä-02 und Ä-04 der Zweitprüfung vom 17.09.2026,
 * entschieden am selben Tag (`docs/freigabe.md`, Checkliste): nur sichtbar
 * machen. Jede Regel bekommt Rang und Gegenmeinung als Feld, die
 * Traktandenliste sagt bei betroffenen Regeln «umstritten, gerechnet wird die
 * strenge Lesart». Keine Wahl je Gemeinschaft (Ä-02 entfällt), das
 * Strengstprinzip vom 16.08.2026 bleibt, und keine Rangrechnung mit sechs
 * Rängen und drei Merkmalen (Abschnitt 0 in `docs/freigabe.md`).
 *
 * **Welche Knoten eine Gegenmeinung tragen.** Nur die, an denen die Quellen
 * über das gesetzliche Erfordernis selbst auseinanderliegen und der Knoten die
 * strengere Seite rechnet. Es sind dieselben vier, die der Website-Export seit
 * dem 16.08.2026 als «Streitfrage, streng ausgelegt» führt (L-1 bis L-4 des
 * Befundberichts vom 15.08.2026). Die Liste dort bleibt eine eigene Liste mit
 * eigenen Wächtern; eine Probe in `regelwerksfassungen.test.ts` hält sie mit
 * diesem Merkmal der aktuellen Fassung gleich. Nicht dabei:
 *
 *   - Knoten, an denen nur gestritten wird, ob ein Reglement abweichen darf
 *     (etwa `k-reglement-normal`, `k-zirkularbeschluss`,
 *     `k-wertquoten-aendern`). Das sagt `reglementsrecht`, und eine
 *     hinterlegte Regel wendet die Anwendung dort teils auch milder an.
 *   - `k-zustaendigkeit-gewoehnlich`: rechnet das einfache Mehr, Entscheid
 *     22.09.2026 (Befund B-08, Fassung 2026-09-23).
 *   - `k-bewirtschaftung-waehlen`: rechnet das einfache Mehr auch dann, wenn
 *     das Reglement die Kompetenzen schon erweitert hat, obwohl Art. 647b
 *     Abs. 1 diesen Fall unter die wichtigeren Verwaltungshandlungen stellt
 *     und Rz. 46 ad Art. 712q die Frage «nicht unumstritten» nennt. Das ist
 *     die mildere Seite; die Frage ist in `docs/freigabe.md` offen gestellt.
 *
 * **Woher die Fundstellen stammen**: aus den Volltexten im Repo `quellen`,
 * nachgeschlagen am 14.10.2026, nicht aus der Zweitprüfung abgeschrieben.
 *
 *   - Luxuriöse Massnahme: Wermelinger, SVIT-Kommentar 2023, Art. 712m
 *     Rz. 197; nennt die Zustimmung aller als herrschende Lehre (Rey/Maetzke,
 *     Perruchoud, Romang) und lässt selbst die Anwesenden und Vertretenen
 *     genügen (mit Jürg Schmid; a.M. Manz).
 *   - Prozessführung: BGer 5A_198/2014 E. 6.1.2, «controversé en doctrine»,
 *     einfaches Mehr bei Meier-Hayoz/Rey, Friedrich, Vouilloz, doppeltes bei
 *     Wermelinger und Gillioz; Wermelinger Art. 712t Rz. 74 nennt die Frage
 *     vom Bundesgericht offengelassen.
 *   - Ausschlussklage: Wermelinger Art. 712a Rz. 214, einfaches Mehr der
 *     anwesenden oder vertretenen Eigentümer ohne den Beklagten (mit Kohler;
 *     a.M. Strittmatter, der alle zählt).
 *   - Einstimmigkeitsklausel zur Reglementsänderung (**bewusste Ausnahme**,
 *     Fachprüfung 14.10.2026, F-4): Der Streit betrifft die Zulässigkeit
 *     einer Erschwerung durch das Reglement, also die Klasse, die sonst
 *     keinen Satz bekommt. Er steht hier, weil der Knoten selbst aus der
 *     Klausel hervorgeht und die Einstimmigkeit als sein Erfordernis rechnet.
 *     Eine gleichlautende Klausel, die als Regel an «Reglement ändern»
 *     hinterlegt ist, rechnet ebenso, zeigt den Satz aber nicht, weil das
 *     Erfordernis dann aus dem Reglement kommt. Wermelinger Art. 712g
 *     Rz. 40 und 125, Erschwerung unzulässig; BGer 5C.50/2004 E. 4.2 nennt
 *     die Lehre kontrovers und lässt die Frage offen. **Meier-Hayoz/Rey
 *     werden hier nicht genannt**: Rz. 125 führt sie für die Unzulässigkeit
 *     an, E. 4.2 unter denen, die die Erschwerung bejahen.
 *
 * **Der Rang** folgt einer Regel, nicht einer Einzelbewertung: `gesetz`, wo
 * kein Abweichen vom Wortlaut festgehalten ist; bei Wortlautabweichung
 * `bundesgericht` für Art. 647d (BGE 144 III 510 E. 2.2.4), sonst `lehre`;
 * dazu `praxis` für die Décharge und `reglement` für die
 * Einstimmigkeitsklausel. Die Prozessführung steht auf `lehre`, weil
 * Art. 647b Abs. 1 die Klage nicht nennt und das qualifizierte Mehr aus
 * Rz. 74 ad Art. 712t stammt. `pruefeRegelwerk` prüft den Rang gegen
 * Wortlautabweichung und Rechtsgrundlage.
 *
 * Die Fassung wirft beim Laden, wenn ein Knoten mit Erfordernis keinen Rang
 * bekommt oder ein genannter Knoten fehlt.
 */
import type { Ergebnisknoten, Rang, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_17 } from './quorum-2026-10-17';

/** Der Rang je Knoten mit Erfordernis. */
export const RANG: Record<string, Rang> = {
	'k-baulich-notwendig': 'lehre',
	'k-baulich-nuetzlich': 'bundesgericht',
	'k-baulich-luxurioes': 'gesetz',
	'k-baulich-luxurioes-ausweg': 'lehre',
	'k-bewirtschaftung-waehlen': 'gesetz',
	'k-bewirtschaftung-erweitert': 'lehre',
	'k-bewirtschaftung-abberufen': 'gesetz',
	'k-organ-waehlen': 'gesetz',
	'k-hausordnung': 'gesetz',
	'k-reglement-normal': 'gesetz',
	'k-reglement-quoren': 'gesetz',
	'k-reglement-eigene-schranke': 'reglement',
	'k-nutzungsrecht-zuteilung': 'gesetz',
	'k-jahresrechnung': 'gesetz',
	'k-erneuerungsfonds': 'gesetz',
	'k-decharge': 'praxis',
	'k-prozessfuehrung': 'lehre',
	'k-benutzungsweise': 'lehre',
	'k-zweckbestimmung': 'gesetz',
	'k-grundstueck-verkauf': 'gesetz',
	'k-sonderrecht-abgrenzen': 'gesetz',
	'k-wertquoten-aendern': 'gesetz',
	'k-vorkaufsrecht': 'gesetz',
	'k-aufhebung': 'gesetz',
	'k-verwaltung-gewoehnlich': 'gesetz',
	'k-verwaltung-wichtig': 'lehre',
	'k-ausschlussklage': 'gesetz',
	'k-zirkularbeschluss': 'gesetz',
	'k-zustaendigkeit-gewoehnlich': 'lehre'
};

/**
 * Die andere Lesart je Knoten, mit Fundstelle. Die Traktandenliste setzt
 * `UMSTRITTEN_SATZ` und «Nach anderer Ansicht» davor; der Satz beginnt deshalb
 * mit dem Verb (Laienprüfung 14.10.2026, Befund 2: «Andere Ansicht: Es
 * genügt …» las sich wie eine Tatsache).
 */
export const GEGENMEINUNG: Record<string, string> = {
	'k-baulich-luxurioes':
		'genügt die Zustimmung aller anwesenden und vertretenen Eigentümer (Wermelinger, ' +
		'SVIT-Kommentar 2023, Art. 712m Rz. 197).',
	'k-prozessfuehrung':
		'genügt das einfache Mehr; so ein Teil der Lehre, das Bundesgericht hat die Frage ' +
		'offengelassen (BGer 5A_198/2014 E. 6.1.2).',
	'k-ausschlussklage':
		'zählen nur die anwesenden und vertretenen Eigentümer ohne den Beklagten (Wermelinger, ' +
		'SVIT-Kommentar 2023, Art. 712a Rz. 214).',
	'k-reglement-eigene-schranke':
		'gilt die Klausel nicht, und es genügt das qualifizierte Mehr nach Art. 712g Abs. 3 ZGB ' +
		'(Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 40 und 125; offengelassen in BGer ' +
		'5C.50/2004 E. 4.2).'
};

/** Exportiert für die Gegenprobe in `regelwerksfassungen.test.ts`. */
export function fassung20261018(k: Ergebnisknoten): Ergebnisknoten {
	const ohneErfordernis = k.typ === 'grenzfall' || k.typ === 'keine_abstimmung';
	if (ohneErfordernis) return k;
	const rang = RANG[k.id];
	if (!rang) throw new Error(`Fassung 2026-10-18: Knoten «${k.id}» hat keinen Rang.`);
	const gegenmeinung = GEGENMEINUNG[k.id];
	return { ...k, rang, ...(gegenmeinung ? { gegenmeinung } : {}) };
}

const KNOTEN = REGELWERK_2026_10_17.knoten.map(fassung20261018);
for (const id of [...Object.keys(RANG), ...Object.keys(GEGENMEINUNG)]) {
	if (!KNOTEN.some((k) => k.id === id)) {
		throw new Error(`Fassung 2026-10-18: Knoten «${id}» gibt es in der Vorfassung nicht.`);
	}
}

export const REGELWERK_2026_10_18 = {
	...REGELWERK_2026_10_17,
	fassung: '2026-10-18',

	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_10_17.freigabevermerk +
		' In der Fassung 2026-10-18 trägt jede Regel, worauf ihre Rechnung steht, und wo die Quellen ' +
		'über das Erfordernis auseinanderliegen, die andere Ansicht mit Fundstelle.'
} satisfies Regelwerk;
