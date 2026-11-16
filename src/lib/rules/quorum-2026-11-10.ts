/**
 * Fassung 2026-11-10: Die Ermächtigung der Bewirtschaftung zur Prozessführung
 * (L11), die luxuriöse bauliche Massnahme (L12) und die Ermächtigung zur
 * Ausschlussklage (L9; Hinweis 9 dort zu L10) als Lesarten der Gemeinschaft.
 * Die Abschnitte unten gehen Block für Block (E1, A bis D); der erste
 * beschreibt L11.
 *
 * **Daten, kein Code** (AD-4), von der Fassung 2026-11-05 abgeleitet, nicht
 * abgeschrieben: Jede Änderung holt sich ihren alten Wortlaut aus der
 * Vorfassung und bricht ab, wenn er dort nicht genau einmal steht oder der
 * neue schon dasteht. Auftrag E1, Block A (Entscheid 0044, zweiter Nachtrag,
 * Punkt R1 (d)).
 *
 * **Der Anlass.** Führt die Bewirtschaftung für die Gemeinschaft einen
 * Zivilprozess, braucht sie vorher die Ermächtigung der Versammlung (ZGB
 * Art. 712t Abs. 2). Welches Mehr dafür gilt, ist umstritten: Der
 * SVIT-Kommentar verlangt in der Regel das qualifizierte Mehr (Rz. 74 und 89a
 * ad Art. 712t), andere Autoren lassen das einfache genügen, und das
 * Bundesgericht hat die Frage offengelassen (BGer 5A_198/2014 E. 6.1.2). Bis
 * hier rechnete Votum fest nach dem qualifizierten Mehr. Jetzt stellt die
 * Gemeinschaft ein, ob Votum das qualifizierte Mehr (Vorgabe) oder das
 * einfache verlangt; das Ergebnis nach der anderen Wahl nennt Votum dazu, wie
 * bei L2, L4 und L6.
 *
 * **Was sich an der Karte `k-prozessfuehrung` ändert:**
 *
 *  - Die Begründung sagt nicht mehr, diese Ermächtigung verlange das
 *    qualifizierte Mehr, sondern dass der Kommentar es in der Regel verlangt
 *    und das einfache umstritten ist.
 *  - Das Merkmal `gegenmeinung` fällt weg. Die Lesart trägt die andere Ansicht
 *    jetzt selbst; `umstrittenSatz` schweigt an dieser Karte deshalb ab hier,
 *    und auf der Traktandenseite steht stattdessen der Satz der Lesart im
 *    Kasten der Mehrhinweise (`lesartKartensatz`).
 *  - Der Hinweis «Das Mehr ist umstritten» nennt die zweite Randziffer und die
 *    Gegenfundstelle, sagt, dass die Gemeinschaft das Mehr einstellt, und
 *    schliesst mit dem Beschluss, der nach beiden Lesarten besteht. Unter einer
 *    hinterlegten Regel steht im Abschnitt «Zum gesetzlichen Erfordernis» nur
 *    der Streit, ohne die Seite «Lesarten» (`ZUM_GESETZ`).
 *  - Neu ist ein Hinweis zum Prozess zwischen der Gemeinschaft und einem
 *    Eigentümer: Ausstand, Einladung und Anhörung (`GEGEN_EIGENTUEMER`;
 *    Fachprüfung E1 L11, F-3). Er gilt unter jeder Wahl und unter einer Regel.
 *  - Neu ist ein Hinweis zum Vorgehen nach einer Annahme mit dem einfachen
 *    Mehr (`NACH_EINFACHEM_MEHR`; Runden 3 bis 5). Er trägt seine Bedingung
 *    selbst; unter einer Regel steht er beim gesetzlichen Erfordernis.
 *  - Am Eilweg der Begründung steht, dass er nach einem Nein der Versammlung
 *    in der Regel nicht gilt (`EILWEG`).
 *  - `lesart` trägt L11, die andere Wahl ist «einfach» (Art. 647a Abs. 1
 *    i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2; Art. 712t Abs. 2).
 *  - Der Freigabevermerk nennt die Lesart, wie bei L2 in der Fassung 2026-10-26.
 *
 * **Sonst bleibt alles am Knoten**, auch `rang`, `rechtsgrundlage`,
 * `reglementsverhalten` und der Hinweis zur Ausschlussklage. Ausser den Knoten
 * zu L12 und L9 (Blöcke B bis D, Abschnitte unten) ändert sich kein Knoten und
 * keine Frage. Am Erfordernis ändert sich
 * nichts: Nach der Vorgabe rechnet die Karte weiter das qualifizierte Mehr
 * nach Köpfen und allen Wertquoten.
 *
 * **Alte Traktanden** dieser Karte aus Fassungen vor L11 rechnen ohne Lesart
 * weiter, was ihr Knoten rechnet (meist das qualifizierte Mehr; an 2026-07-30,
 * 08-05 und 08-15 das einfache, Entscheid 0048, Block A). Steht die
 * Gemeinschaft auf der anderen Wahl, sagt die Freigabe ab, bis
 * nachgezogen ist (`veralteteLesartenIn`, Review DeepSeek zu Lesarten Block 3,
 * V1). Den Streitsatz zeigen sie weiter: `knotenFuerUmstritten` fällt bei
 * Fassungen ohne `rang` auf die neueste Fassung zurück, deren Knoten gleicher
 * Kennung keine `lesart` trägt. Das ändert auch die eigene Schranke (L6); die
 * Begründung steht bei der Funktion in `index.ts`.
 *
 * **Dieselbe Fassung trägt L12** (Auftrag E1, Block B; Entscheid 0044, zweiter
 * Nachtrag, R5 (a)): Die luxuriöse bauliche Massnahme (`k-baulich-luxurioes`)
 * wird eine Lesart der Gemeinschaft. Die Vorgabe ist die Zustimmung aller
 * eingetragenen Eigentümer (herrschende Lehre, Rz. 197 ad Art. 712m); die andere
 * Wahl lässt die Zustimmung aller Anwesenden und Vertretenen genügen
 * (SVIT-Kommentar ebenda, mit Schmid). **Nach der Vorgabe ändert sich kein
 * Ergebnis.**
 *
 *  - Das Merkmal `gegenmeinung` fällt weg; die Lesart trägt die andere Ansicht.
 *  - Der Hinweis zur Zählung (W11-alt) sagt nicht mehr, dieses Werkzeug rechne
 *    über alle Eigentümer, sondern dass die Gemeinschaft die Zählung auf der
 *    Seite «Lesarten» einstellt (`HINWEIS_LUXURIOES`).
 *  - `einstimmigkeitsweg` bleibt der Weg der Vorfassung; die andere Wahl trägt
 *    ihren eigenen (`WEG_ANWESENDE`), der mit dem Satz der Einstellung beginnt
 *    und danach den Weg der Vorfassung ab dem Satz über die Unterschriften der
 *    Abwesenden unverändert weiterführt.
 *  - `lesart` trägt L12, die andere Wahl ist «anwesende» (ZGB Art. 647e
 *    Abs. 1).
 *  - Der Freigabevermerk nennt auch diese Lesart.
 *
 * **Alte Traktanden** dieser Karte aus Fassungen vor L12 rechnen ohne Lesart
 * weiter über alle Eigentümer; stellt die Gemeinschaft auf «anwesende», sagt
 * die Freigabe ab, bis nachgezogen ist (`veralteteLesartenIn`). Den Streitsatz
 * zeigen sie weiter, denn `knotenFuerUmstritten` fällt auf die neueste Fassung
 * ohne `lesart` zurück.
 *
 * **Dieselbe Fassung trägt L9** (Auftrag E1, Block C; Entscheid 0044, zweiter
 * Nachtrag, R1 (a)): Die Zählbasis der Ermächtigung zur Ausschlussklage
 * (`k-ausschlussklage`) wird eine Lesart der Gemeinschaft. Die Vorgabe ist das
 * Mehr aller Eigentümer ohne den Beklagten (Wortlaut von ZGB Art. 649b Abs. 2);
 * die andere Wahl lässt die Mehrheit der Anwesenden und Vertretenen ohne ihn
 * genügen (SVIT-Kommentar Rz. 214 ad Art. 712a). **Nach der Vorgabe ändert sich
 * kein Ergebnis.**
 *
 *  - Die Begründung sagt nicht mehr, dieses Werkzeug folge der strengeren
 *    Wortlaut-Lesart, sondern dass die Gemeinschaft die Zählbasis einstellt.
 *  - Das Merkmal `gegenmeinung` fällt weg; die Lesart trägt die andere Ansicht.
 *  - Der Hinweis zur Zählbasis (W10-alt) sagt nicht mehr, dieses Werkzeug rechne
 *    über alle, sondern dass die Gemeinschaft es auf der Seite «Lesarten»
 *    einstellt (`W10`). Unter einer hinterlegten Regel steht dort nur der
 *    Streit (`W10_STREIT`).
 *  - Neu ist ein Hinweis zu den Zahlen der Karte (`HINWEIS_ZAHLEN`): Er nennt
 *    die Vorgabe und was die andere Wahl ändert. Er steht an erster Stelle und
 *    unter einer Regel beim gesetzlichen Erfordernis.
 *  - `lesart` trägt L9, die andere Wahl ist «anwesende» (ZGB Art. 649b Abs. 2
 *    i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2).
 *  - Der Freigabevermerk nennt auch diese Lesart.
 *
 * **Das zweite Ergebnis rechnet hier 1a, nicht der allgemeine Lesartenweg**
 * (Auftrag E1, Block C): Die andere Zählbasis ist die Zählung nach den
 * Anwesenden ohne den Beklagten, und die kennt `andereZaehlbasisVon` seit dem
 * Entscheid 0018. `vergleichNachAndererLesart` schweigt deshalb für L9, und
 * `vergleichNachAndererZaehlbasis` markiert sein Ergebnis mit `ausLesart`.
 *
 * **Alte Traktanden** dieser Karte aus Fassungen vor L9 rechnen ohne Lesart
 * weiter über alle Eigentümer ohne den Beklagten; stellt die Gemeinschaft auf
 * «anwesende», sagt die Freigabe ab, bis nachgezogen ist
 * (`veralteteLesartenIn`).
 *
 * **Hinweis 9 zu L10** (Auftrag E1, Block D; Entscheid 0044, zweiter
 * Nachtrag, R1 (b)): Der Hinweis zu den Angehörigen des Beklagten an
 * `k-ausschlussklage` sagt nicht mehr fest, sie blieben in der Zahl, sondern
 * dass die Gemeinschaft es auf der Seite «Lesarten» einstellt (`W12`, aus
 * `W12_ALT`). L10 hängt an keinem Knoten, sondern an der Zählung
 * (`angehoerigenlesartWirkt`); unter L9 «anwesende» tauscht `hinweisErsatz`
 * den Hinweis weiter gegen `ANGEHOERIGE_ANWESENDE`, unter einer Regel steht
 * W12 als Schlüssel und gezeigt wird sein `ersatz`.
 */
import type { Ergebnisknoten, HinweisUnterRegel, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_11_05 } from './quorum-2026-11-05';

export const PROZESSFUEHRUNG_ID = 'k-prozessfuehrung';

const vorher = REGELWERK_2026_11_05.knoten.find((k) => k.id === PROZESSFUEHRUNG_ID);
if (!vorher) throw new Error(`Fassung 2026-11-10: «${PROZESSFUEHRUNG_ID}» fehlt in der Vorfassung.`);

export const LUXURIOES_ID = 'k-baulich-luxurioes';

const vorherLuxurioes = REGELWERK_2026_11_05.knoten.find((k) => k.id === LUXURIOES_ID);
if (!vorherLuxurioes)
	throw new Error(`Fassung 2026-11-10: «${LUXURIOES_ID}» fehlt in der Vorfassung.`);

/**
 * Die Begründung der Vorfassung, hinter der der Website-Abzug die Karte zeigt
 * (Konzept Lesarten, Block 8): Auf der Website wählt niemand.
 */
export const BEGRUENDUNG_VORHER = vorher.begruendung;

/** Der Satz der Vorfassung, der das Mehr als fest gesetzt hinstellt. */
export const BEGRUENDUNG_SATZ_VORHER =
	'Diese Ermächtigung ist eine wichtigere Verwaltungshandlung und verlangt deshalb das qualifizierte Mehr.';
export const BEGRUENDUNG_SATZ =
	'Nach dem SVIT-Kommentar ist diese Ermächtigung in der Regel eine wichtigere Verwaltungshandlung und ' +
	'verlangt dann das qualifizierte Mehr. Ob das einfache Mehr genügt, ist umstritten (Hinweis unten).';

if (BEGRUENDUNG_VORHER.split(BEGRUENDUNG_SATZ_VORHER).length !== 2) {
	throw new Error(
		`Fassung 2026-11-10: Der Satz «${BEGRUENDUNG_SATZ_VORHER.slice(0, 60)}…» steht nicht genau einmal in der Begründung von «${PROZESSFUEHRUNG_ID}».`
	);
}

/** Die neue Begründung: der Kommentar verlangt es in der Regel, das einfache ist umstritten. */
/**
 * Der Eilweg der Vorfassung gilt nicht nach einem Nein der Versammlung
 * (Fachprüfung E1 L11, Runde 3, F4; Codeprüfung des Folge-Commits, Befund 2,
 * mit Laienprüfung Runde 5, R5-L-1): Sonst erlaubte die Karte, was der Rat nach
 * der Ablehnung ausschliesst.
 */
export const EILWEG_VORHER = 'In dringenden Fällen darf die Verwaltung handeln und die Ermächtigung nachholen (ZGB Art. 712t Abs. 2; Rz. 77 ad Art. 712t).';
export const EILWEG = `${EILWEG_VORHER} Nach einem Nein der Versammlung gilt das in der Regel nicht.`;
if (BEGRUENDUNG_VORHER.split(EILWEG_VORHER).length !== 2) {
	throw new Error(`Fassung 2026-11-10: Der Eilweg steht nicht genau einmal in der Begründung von «${PROZESSFUEHRUNG_ID}».`);
}

export const BEGRUENDUNG = BEGRUENDUNG_VORHER.replace(BEGRUENDUNG_SATZ_VORHER, BEGRUENDUNG_SATZ).replace(
	EILWEG_VORHER,
	EILWEG
);

/** Der Hinweis der Vorfassung zum Streit, hinter dem der Website-Abzug die Karte zeigt. */
const streitVorher = (vorher.hinweise ?? []).filter((h) => h.startsWith('Das Mehr ist umstritten:'));
if (streitVorher.length !== 1) {
	throw new Error(`Fassung 2026-11-10: «${PROZESSFUEHRUNG_ID}» trägt den Hinweis zum Mehr nicht genau einmal.`);
}
export const HINWEIS_VORHER = streitVorher[0];

/**
 * Der Streit selbst, mit der Gegenfundstelle so, wie wir sie kennen
 * (Fachprüfung E1 L11, F-6): SVIT Rz. 74 sagt über die Gegenautoren nur
 * «a.M.»; dass sie das einfache Mehr genügen lassen, sagt BGer 5A_198/2014
 * E. 6.1.2. Meier-Hayoz/Rey liegt nicht im Volltext vor.
 */
export const STREIT =
	'Das Mehr ist umstritten: Der SVIT-Kommentar verlangt in der Regel das qualifizierte Mehr (Art. 712t ' +
	'Rz. 74 und 89a). Andere Autoren lassen das einfache genügen (Meier-Hayoz/Rey, Rz. 44 ad Art. 712t, ' +
	'nach BGer 5A_198/2014 E. 6.1.2); das Bundesgericht hat die Frage offengelassen (ebenda).';

/** Der neue Hinweis: der Streit, die zweite Randziffer und die Einstellung der Gemeinschaft. */
export const HINWEIS =
	// Wie bei L9 und L12 (Fachprüfung E1 L9, F-5; L12, F-3): wie Votum rechnet, nicht was gilt.
	`${STREIT} Nach welchem Mehr Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ` +
	'ein; welches gilt, entscheidet im Streit das Gericht. Nach der ' +
	'Auszählung nennt Votum auch das Ergebnis nach der anderen Lesart. Eine Ermächtigung mit dem ' +
	'qualifizierten Mehr genügt beiden Lesarten.';

/**
 * Unter einer Regel, im Abschnitt «Zum gesetzlichen Erfordernis»: der Streit
 * ohne die Seite «Lesarten», denn dort rechnet das Reglement, und es gibt
 * kein zweites Ergebnis (Codeprüfung E1 L11, Befund 2; Muster
 * `ZUM_GESETZ_LESART` in der Fassung 2026-10-26).
 */
export const ZUM_GESETZ = STREIT;

/**
 * Prozess gegen einen Eigentümer (Fachprüfung E1 L11, F-3): Er stimmt nicht
 * mit (ZGB Art. 68 i.V.m. Art. 712m Abs. 2; BGE 134 III 481 E. 3.4), muss aber
 * eingeladen und angehört werden (BGer 5A_198/2014 E. 5.3.4 und 5.4). Lässt
 * die Leitung ihn mitstimmen, ist der Beschluss anfechtbar (Rz. 209 ad
 * Art. 712m). Unter jeder Wahl und unter einer Regel.
 */
export const GEGEN_EIGENTUEMER =
	// Runde 2: die Angehörigen wie an der Ausschlussklage (R2-F-4; BGE 134 III 481
	// E. 3.8) und was die Anhörung für die Beratung heisst (R2-L-7). Runde 3: in
	// beide Richtungen, auch seine Anfechtungsklage (R3-F-3; Rz. 74 ad Art. 712t),
	// und die Angehörigen stimmen nur nicht mit (R3-L-5; E. 5.3.4 nur zum Betroffenen).
	'Geht es um einen Prozess zwischen der Gemeinschaft und einem Eigentümer, gleich wer klagt, etwa ' +
	'wegen ausstehender Beiträge oder um seine Anfechtungsklage, stimmt er nicht mit, weder für die ' +
	'eigene Wohnung noch als Vertretung anderer. Ebenso wenig sein Ehegatte und seine Verwandten in ' +
	'gerader Linie, etwa Eltern, Kinder oder Enkel, die hier Eigentümer sind (ZGB Art. 68 i.V.m. ' +
	'Art. 712m Abs. 2; BGE 134 III 481 E. 3.4 und 3.8; Rz. 74 ad Art. 712t). Setzen Sie sie für dieses ' +
	'Traktandum in den Ausstand. Einladen und vor der Abstimmung anhören müssen Sie den Eigentümer ' +
	'trotzdem; an der Beratung danach und an der Abstimmung nimmt er nicht teil (BGer 5A_198/2014 ' +
	'E. 5.3.4 und 5.4). Seine Angehörigen stimmen nur nicht mit.';

/**
 * Was die Bewirtschaftung nach einer Annahme mit dem einfachen Mehr tut
 * (Fachprüfung E1 L11, Runde 3, F5, mit R3-F-2): aus dem Rat im Saal hierher
 * verschoben, weil es nach der Versammlung zu tun ist. Der Hinweis trägt seine
 * Bedingung selbst und steht deshalb unter jeder Wahl richtig. «Einige Wochen»
 * und «statt das Urteil abzuwarten» sind Erfahrung der Bewirtschaftung, kein
 * Wert aus dem Volltext (Fachprüfung Runde 2 und 3). Die Kosten «kann» das
 * Gericht auferlegen: Rz. 79 ad Art. 712t ist eine Lehrmeinung mit
 * Gegenstimme, und zunächst trägt sie die Gemeinschaft (ZPO Art. 106, 108).
 */
export const NACH_EINFACHEM_MEHR =
	// Runde 4: welche Fristen (R4-L-4), und dass es nach einer Ablehnung nicht gilt
	// (R4-F-1, R4-L-3: Das Protokoll nennt dort «wäre angenommen gewesen»).
	// Runde 5, R5-L-1: der Ausschluss vorn, nicht als «das» am Schluss.
	'Dieser Hinweis gilt nach einer Annahme mit dem einfachen Mehr, nicht nach einer Ablehnung, auch ' +
	'wenn das einfache Mehr erreicht war. Eilt die Klage nicht, stellt die Bewirtschaftung das ' +
	'Protokoll allen sofort nachweisbar zu. Die Klage reicht sie erst ein, wenn die Anfechtungsfristen ' +
	'abgelaufen sind und einige Wochen danach keine Vorladung eingegangen ist (Rz. 230 und 231 ad ' +
	'Art. 712m). Die Frist ist ein Monat, für Abwesende ohne Vertretung in der Regel ab Erhalt des ' +
	'Protokolls. Geht ' +
	'eine Anfechtung ein, holt sie das qualifizierte Mehr an einer weiteren Versammlung, statt das ' +
	'Urteil abzuwarten. Eilt die Klage, etwa weil eine Frist abläuft, kann sie sofort klagen. Wird die ' +
	'Ermächtigung später aufgehoben, gibt das Gericht in der Regel eine Frist, sie mit dem qualifizierten ' +
	'Mehr nachzuholen (ZPO Art. 132 Abs. 1; Rz. 79 ad Art. 712t). Gelingt das nicht, gilt ' +
	'die Klage als nicht eingereicht, und die Kosten kann das Gericht der Bewirtschaftung auferlegen.';

// ── L12: die Zählung der Einstimmigkeit bei der luxuriösen Massnahme ─────────

/**
 * Der Hinweis der Vorfassung zur Zählung (L-4, wörtlich aus der Fassung
 * 2026-09-30). Er sagt, dieses Werkzeug rechne über alle Eigentümer; das stimmt
 * ab L12 nicht mehr, weil die Gemeinschaft es einstellt.
 */
const zaehlungVorher = (vorherLuxurioes.hinweise ?? []).filter((h) =>
	h.startsWith('Auch die Zählung ist umstritten:')
);
if (zaehlungVorher.length !== 1) {
	throw new Error(
		`Fassung 2026-11-10: «${LUXURIOES_ID}» trägt den Hinweis zur Zählung nicht genau einmal.`
	);
}
export const HINWEIS_LUXURIOES_VORHER = zaehlungVorher[0];

/**
 * Derselbe Hinweis, mit der Seite «Lesarten» statt der festen Zählung. Die
 * Einstellung legt fest, wie Votum rechnet, nicht was gilt (Fachprüfung E1 L12,
 * F-3; Laienprüfung L-2; Entscheid 0044, R5 (b)).
 */
export const HINWEIS_LUXURIOES =
	'Auch die Zählung ist umstritten: Nach dem SVIT-Kommentar genügt die Zustimmung sämtlicher ' +
	'anwesenden und vertretenen Eigentümer (Art. 712m Rz. 197; anders Manz), nach der herrschenden ' +
	'Lehre braucht es alle im Grundbuch aufgeführten. Nach welcher Zählung Votum rechnet, stellt Ihre ' +
	'Gemeinschaft auf der Seite «Lesarten» ein; welche gilt, entscheidet im Streit das Gericht. Die ' +
	'Zustimmung aller eingetragenen Eigentümer genügt beiden Lesarten.';

/**
 * Der Weg der Vorfassung, ab dem Satz über die Unterschriften der Abwesenden.
 * Er gilt unter beiden Wahlen gleich und wird deshalb unverändert übernommen;
 * der Anker muss genau einmal dastehen, sonst bricht die Fassung ab.
 */
const ANKER_ABWESENDE = 'Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach.';

const wegVorher = vorherLuxurioes.einstimmigkeitsweg;
if (!wegVorher) {
	throw new Error(`Fassung 2026-11-10: «${LUXURIOES_ID}» trägt keinen Einstimmigkeitsweg.`);
}
const wegTeile = wegVorher.split(ANKER_ABWESENDE);
if (wegTeile.length !== 2) {
	throw new Error(
		`Fassung 2026-11-10: Der Anker «${ANKER_ABWESENDE.slice(0, 40)}…» steht nicht genau einmal im Weg von «${LUXURIOES_ID}».`
	);
}

/**
 * Die Formel der Karte unter «anwesende» (E1, L12; Bericht des Baus, offener
 * Wortlaut): Die Typformel der Einstimmigkeit sagt «nicht nur der Anwesenden»
 * und widerspräche der Wahl.
 */
export const FORMEL_ANWESENDE =
	'Zustimmung sämtlicher anwesenden und vertretenen Eigentümer; wer weder da noch vertreten ist, zählt nicht mit.';

/**
 * Der Anfang des Wegs unter der milden Wahl: wie gerechnet wird, nicht was gilt
 * (Fachprüfung E1 L12, F-3).
 */
export const WEG_ANWESENDE_ANFANG =
	'Gerechnet wird nach der Einstellung Ihrer Gemeinschaft mit der Zustimmung aller Anwesenden und ' +
	'Vertretenen; wer weder da noch vertreten ist, zählt nicht mit. Nach der herrschenden Lehre braucht es die ' +
	'Zustimmung aller eingetragenen Eigentümer (Hinweis zur Zählung unten). Fehlt die Zustimmung von ' +
	'Abwesenden, ist der Beschluss deshalb nicht sicher.';

/**
 * Was nach einer Annahme nur mit den Anwesenden zu tun ist (Fachprüfung E1
 * L12, F-4 und F2, nach dem Muster von L11): Der Hinweis trägt seine Bedingung
 * selbst; unter der Vorgabe kommt eine solche Annahme nicht vor. «Einige
 * Wochen» ist Erfahrung der Bewirtschaftung, kein Wert aus dem Volltext; dass
 * sich ein Abwesender auch später gegen seinen Kostenanteil wehren kann, sagt
 * Rz. 214 ad Art. 712m.
 */
export const NACH_ANWESENDEN =
	// Runde 2 (R2-F-1): die Fundstelle am richtigen Satz, das Blatt aus dem Saal,
	// und «nicht mehr angefochten» statt eines weiteren «gilt» (R2-L-1).
	'Nach einer Annahme ohne die Zustimmung aller Abwesenden: Stellen Sie das Protokoll allen sofort ' +
	'nachweisbar zu, etwa eingeschrieben (SVIT-Kommentar Rz. 231 ad Art. 712m). Holen Sie die übrigen ' +
	'Unterschriften auf dem Blatt aus dem Saal: Wer es dort nicht unterschrieben hat, unterschreibt es ' +
	'danach, auch wer zugestimmt hat (ZGB Art. 66 Abs. 2 i.V.m. Art. 712m Abs. 2). Ficht bis einen Monat ' +
	'nach Erhalt niemand an, kann der Beschluss nicht mehr angefochten werden (Rz. 207). Offen bleibt nur, ob er nichtig sein kann; darauf könnte sich ein Abwesender ' +
	'auch später berufen, etwa gegen seinen Kostenanteil (Rz. 214). Vergeben Sie Aufträge deshalb ' +
	'frühestens, wenn die Frist abgelaufen ist und einige Wochen danach keine Vorladung eingegangen ist; ' +
	'ohne Wartezeit und ganz sicher, sobald alle unterschrieben haben. Geht eine Anfechtung ein, holen Sie die Zustimmung ' +
	'aller schriftlich oder an einer weiteren Versammlung, statt das Urteil abzuwarten.';

/** Der ganze Weg unter der milden Wahl: der neue Anfang und der alte Rest. */
export const WEG_ANWESENDE = `${WEG_ANWESENDE_ANFANG} ${ANKER_ABWESENDE}${wegTeile[1]}`;

// ── L9: die Zählbasis der Ermächtigung zur Ausschlussklage ───────────────────

export const AUSSCHLUSSKLAGE_ID = 'k-ausschlussklage';

const vorherAusschluss = REGELWERK_2026_11_05.knoten.find((k) => k.id === AUSSCHLUSSKLAGE_ID);
if (!vorherAusschluss)
	throw new Error(`Fassung 2026-11-10: «${AUSSCHLUSSKLAGE_ID}» fehlt in der Vorfassung.`);

/** Die Begründung der Vorfassung, hinter der der Website-Abzug die Karte zeigt. */
export const AUSSCHLUSS_BEGRUENDUNG_VORHER = vorherAusschluss.begruendung;

/**
 * Der Satz der Vorfassung, der die Zählbasis fest setzt: Er sagt, dieses
 * Werkzeug folge der strengeren Wortlaut-Lesart. Ab L9 stellt die Gemeinschaft
 * die Zählbasis ein.
 */
export const AUSSCHLUSS_SATZ_VORHER =
	'Der Kommentar rechnet stattdessen nach den anwesenden und vertretenen Eigentümern; dieses Werkzeug folgt der strengeren Wortlaut-Lesart — ein so gefasster Beschluss genügt beiden.';
export const AUSSCHLUSS_SATZ =
	'Der Kommentar lässt die Mehrheit der anwesenden und vertretenen Eigentümer genügen. An welcher Zahl gemessen wird, stellt Ihre Gemeinschaft ein; ein Beschluss mit der Mehrheit aller ohne den Beklagten genügt beiden.';

if (AUSSCHLUSS_BEGRUENDUNG_VORHER.split(AUSSCHLUSS_SATZ_VORHER).length !== 2) {
	throw new Error(
		`Fassung 2026-11-10: Der Satz «${AUSSCHLUSS_SATZ_VORHER.slice(0, 60)}…» steht nicht genau einmal in der Begründung von «${AUSSCHLUSSKLAGE_ID}».`
	);
}

/** Die neue Begründung: der Kommentar lässt die Anwesenden genügen, die Gemeinschaft wählt. */
export const AUSSCHLUSS_BEGRUENDUNG = AUSSCHLUSS_BEGRUENDUNG_VORHER.replace(
	AUSSCHLUSS_SATZ_VORHER,
	AUSSCHLUSS_SATZ
);

/** Der Hinweis der Vorfassung zur Zählbasis, hinter dem der Website-Abzug die Karte zeigt. */
const zaehlbasisVorher = (vorherAusschluss.hinweise ?? []).filter((h) =>
	h.startsWith('Die Zählbasis ist umstritten:')
);
if (zaehlbasisVorher.length !== 1) {
	throw new Error(
		`Fassung 2026-11-10: «${AUSSCHLUSSKLAGE_ID}» trägt den Hinweis zur Zählbasis nicht genau einmal.`
	);
}
export const HINWEIS_ZAEHLBASIS_VORHER = zaehlbasisVorher[0];

/**
 * Der Streit selbst, ohne den Satz über dieses Werkzeug. Er steht unter einer
 * hinterlegten Regel im Abschnitt «Zum gesetzlichen Erfordernis»: Dort rechnet
 * das Reglement, und es gibt kein zweites Ergebnis.
 */
export const W10_STREIT =
	'Die Zählbasis ist umstritten: Der SVIT-Kommentar lässt das einfache Mehr der anwesenden und vertretenen Eigentümer genügen (Art. 712a Rz. 214, mit Kohler; anders Strittmatter, der alle Eigentümer zählt); das Bundesgericht hat die Frage nicht entschieden.';

if (!HINWEIS_ZAEHLBASIS_VORHER.startsWith(W10_STREIT)) {
	throw new Error(
		`Fassung 2026-11-10: Der Hinweis zur Zählbasis von «${AUSSCHLUSSKLAGE_ID}» beginnt nicht mit dem Streit.`
	);
}

/** Der neue Hinweis: der Streit und die Einstellung der Gemeinschaft. */
export const W10 =
	// Fachprüfung E1 L9, F-5: Die Einstellung legt fest, wie Votum rechnet, nicht was gilt.
	`${W10_STREIT} Nach welcher Zahl Votum rechnet, stellt Ihre Gemeinschaft auf der Seite «Lesarten» ` +
	'ein; welche gilt, entscheidet im Streit das Gericht. Nach der ' +
	'Auszählung nennt Votum auch das Ergebnis an der anderen Zahl. Wer die Mehrheit aller ohne den ' +
	'Beklagten erreicht, genügt beiden Lesarten.';

/**
 * Der Hinweis zu den Zahlen der Karte (E1, L9): Er sagt, für welche Wahl sie
 * gelten, und was die andere Wahl ändert. Er steht an erster Stelle und unter
 * einer Regel beim gesetzlichen Erfordernis, denn er erklärt das Mehr des
 * Gesetzes.
 */
export const HINWEIS_ZAHLEN =
	'Die Zahlen auf dieser Karte gelten für die Vorgabe auf der Seite «Lesarten»: Gemessen wird an ' +
	'allen Eigentümern ohne den Beklagten. Hat Ihre Gemeinschaft «Anwesende und Vertretene» ' +
	'eingestellt, wird die Mehrheit nur an denen gemessen, die da oder vertreten sind, und wer im ' +
	'Ausstand ist, zählt dort nicht mit.';

/**
 * Derselbe Hinweis unter «anwesende» (Laienprüfung E1 L9 Runde 2, R2-L-5):
 * Dort tauscht `knotenNachLesart` die Zahlenbeispiele, und «gelten für die
 * Vorgabe» stünde über der Zahl der anderen Wahl.
 */
export const HINWEIS_ZAHLEN_ANWESENDE =
	'Die Zahlen auf dieser Karte gelten für die Einstellung «Anwesende und Vertretene» auf der Seite ' +
	'«Lesarten». Gemessen wird nur an denen, die da oder vertreten sind, ohne den Beklagten; wer im ' +
	'Ausstand ist, zählt nicht mit. Nach der Vorgabe würde an allen Eigentümern ohne den Beklagten ' +
	'gemessen.';

// ── Der Knoten ───────────────────────────────────────────────────────────────

/**
 * Unter einer hinterlegten Regel bekommt der Streit um das Mehr den neuen
 * Wortlaut, und im Abschnitt «Zum gesetzlichen Erfordernis» steht er ohne die
 * Seite «Lesarten» (`ZUM_GESETZ`). `ersatz` bleibt unverändert: Er sagt, was
 * nach Gesetz gilt, wenn das Reglement das Mehr regelt.
 */
const UNTER_REGEL: HinweisUnterRegel[] = [
	...(vorher.hinweiseUnterRegel ?? []).map((u) =>
		u.hinweis === HINWEIS_VORHER ? { ...u, hinweis: HINWEIS, zumGesetz: ZUM_GESETZ } : u
	),
	// Unter einer Regel rechnet Votum nach ihr, nicht nach der Lesart; der Rat zum
	// einfachen Mehr der Lesart gehört dann zum gesetzlichen Erfordernis.
	{ hinweis: NACH_EINFACHEM_MEHR, zumGesetz: true }
];
if (!UNTER_REGEL.some((u) => u.hinweis === HINWEIS)) {
	throw new Error(
		`Fassung 2026-11-10: «${PROZESSFUEHRUNG_ID}» trägt den Hinweis zum Mehr nicht unter einer Regel.`
	);
}

// ── Hinweise der Ausschlussklage unter «Anwesende und Vertretene» ─────────────

/**
 * Drei Hinweise der Karte beschreiben, wie Votum nach der Vorgabe rechnet
 * (Fachprüfung E1 L9, F-3; Laienprüfung L-3; Codeprüfung Block C, Befund 7);
 * der vierte getauschte ist `HINWEIS_ZAHLEN` (Laienprüfung Runde 2, R2-L-5).
 * Unter «anwesende» stünden sie falsch; `knotenNachLesart` tauscht sie dort
 * gegen diese Fassungen. Jeder alte Teil muss genau einmal dastehen.
 */
function ersetzeEinmal(text: string, alt: string, neu: string): string {
	if (text.split(alt).length !== 2) {
		throw new Error(`Fassung 2026-11-10: «${alt.slice(0, 60)}…» steht nicht genau einmal im Hinweis.`);
	}
	return text.replace(alt, neu);
}
function hinweisMit(anfang: string): string {
	const treffer = (vorherAusschluss!.hinweise ?? []).filter((h) => h.startsWith(anfang));
	if (treffer.length !== 1) {
		throw new Error(`Fassung 2026-11-10: Der Hinweis «${anfang}…» steht nicht genau einmal an «${AUSSCHLUSSKLAGE_ID}».`);
	}
	return treffer[0];
}

export const ZEHN_VORHER = hinweisMit('Bei zehn Eigentümern, von denen einer betroffen ist');
export const ZEHN_ANWESENDE =
	'Bei zehn Eigentümern, von denen einer beklagt ist, und sechs der übrigen neun da oder vertreten, ' +
	'genügen vier Ja-Stimmen; nach der Vorgabe wären fünf nötig.';

/**
 * Der Satz zu den Angehörigen im Ausstand, wie er bis zur Fassung 2026-11-05
 * galt (W12-alt): Votum lässt sie fest in der Zahl, weil der Wortlaut von
 * Art. 649b Abs. 2 nur den Beklagten ausnimmt.
 */
export const W12_ALT =
	'In der Zahl, an der die Mehrheit gemessen wird, lässt Votum sie trotzdem, wie es der Wortlaut von ' +
	'Art. 649b Abs. 2 sagt: Er nimmt nur den Beklagten aus. Dort wirken sie wie ein Nein, ebenso wer ' +
	'ihnen eine Vollmacht gegeben hat. Bei elf Eigentümern, einem Beklagten und seiner Ehefrau mit ' +
	'eigener Wohnung verlangt Votum deshalb sechs Ja von zehn.';

/**
 * Derselbe Satz ab der Fassung 2026-11-10 (W12): Ob die Angehörigen in der Zahl
 * bleiben, stellt die Gemeinschaft ein (L10, Migration 189). Die Vorgabe bleibt
 * «bleiben», und der Satz danach, dass kein Gericht das entschieden hat, bleibt
 * stehen.
 */
export const W12 =
	'Ob sie in der Zahl bleiben, an der die Mehrheit gemessen wird, stellt Ihre Gemeinschaft auf der Seite ' +
	'«Lesarten» ein. Nach der Vorgabe bleiben sie darin, denn der Wortlaut von Art. 649b Abs. 2 nimmt nur ' +
	'den Beklagten aus. Dort wirken sie wie ein Nein, ebenso wer ihnen eine Vollmacht gegeben hat. Bei ' +
	'elf Eigentümern, einem Beklagten und seiner Ehefrau mit eigener Wohnung braucht es dann sechs Ja ' +
	'von zehn.';

export const ANGEHOERIGE_VORHER = hinweisMit('Ehegatte und Verwandte des Beklagten in gerader Linie');
export const ANGEHOERIGE_ANWESENDE = ersetzeEinmal(
	ersetzeEinmal(
		ANGEHOERIGE_VORHER,
		'dass eine Vollmacht an diese Angehörigen bei dieser Abstimmung wie ein Nein wirkt;',
		'dass eine Vollmacht an diese Angehörigen bei dieser Abstimmung nicht zählt;'
	),
	W12_ALT +
		' Entschieden hat das kein Gericht; eine ' +
		'so gefasste Ermächtigung hält auch, wenn eines die Angehörigen herausnähme.',
	'Unter der Einstellung «Anwesende und Vertretene» nimmt Votum sie wie jede Person im Ausstand aus ' +
		'der Zahl, an der die Mehrheit gemessen wird, ebenso wer nur über sie vertreten ist. Nach der ' +
		'Vorgabe blieben sie darin und wirkten wie ein Nein.'
);

/**
 * Der Hinweis 9 der Fassung 2026-11-10 (W12): Die Zahl der Angehörigen im
 * Ausstand stellt die Gemeinschaft ein (L10, Migration 189). Der Satz danach,
 * dass kein Gericht das entschieden hat, bleibt.
 */
export const ANGEHOERIGE = ersetzeEinmal(ANGEHOERIGE_VORHER, W12_ALT, W12);

export const WOHNUNG_VORHER = hinweisMit('Gehört die Wohnung des Beklagten mehreren');
// Unter «anwesende» rechnen beide Fälle an der Karte gleich; die Angabe braucht
// Votum dort nur für das Ergebnis an allen, und das sagt der Satz jetzt
// (Laienprüfung E1 L9 Runde 2, R2-L-5; Codeprüfung Block C, Durchgang 2).
const WOHNUNG_ANWESENDE_ZAHL = ersetzeEinmal(
	ersetzeEinmal(
		WOHNUNG_VORHER,
		'Richtet sich der Antrag nur gegen ihn, bleibt die Wohnung in der Zahl, an der die Mehrheit ' +
			'gemessen wird, denn Art. 649b Abs. 2 nimmt nur den Beklagten aus; solange sie in der Zahl steht, ' +
			'wirkt sie wie ein Nein. Bei zehn Wohnungen mit je einer Stimme braucht es dann sechs Ja von zehn. ' +
			'Richtet er sich gegen alle Eigentümer der Wohnung, fällt sie aus der Zahl, und es braucht fünf Ja ' +
			'von neun.',
		'Unter der Einstellung «Anwesende und Vertretene» zählt sie nicht in der Zahl, an der die Mehrheit ' +
			'gemessen wird, ob sich der Antrag nur gegen ihn oder gegen alle ihre Eigentümer richtet. Nach der ' +
			'Vorgabe bliebe sie darin, wenn er sich nur gegen ihn richtet, und wirkte wie ein Nein.'
	),
	' Dieses Werkzeug zählt die Wohnung selbst mit, wenn sich der Antrag nur gegen ihn richtet; zählen ' +
		'Sie sie nicht noch einmal hinzu.',
	''
);
export const WOHNUNG_ANWESENDE = ersetzeEinmal(
	WOHNUNG_ANWESENDE_ZAHL,
	'; vorgegeben ist «nur eine Person beklagt», die strengere Rechnung.',
	'. Votum braucht die Angabe für das Ergebnis an allen Eigentümern, das es nach der Auszählung auch ' +
		'nennt; vorgegeben ist «nur eine Person beklagt», dort die strengere Rechnung.'
);

const KNOTEN: Ergebnisknoten[] = REGELWERK_2026_11_05.knoten.map((k) => {
	if (k.id === LUXURIOES_ID) {
		// Die Gegenmeinung fällt weg: Die Lesart trägt die andere Ansicht, und
		// `umstrittenSatz` schweigt deshalb an dieser Karte.
		const { gegenmeinung: _gegenmeinung, ...ohneGegenmeinung } = k;
		void _gegenmeinung;
		return {
			...ohneGegenmeinung,
			hinweise: [
				...(k.hinweise ?? []).map((h) => (h === HINWEIS_LUXURIOES_VORHER ? HINWEIS_LUXURIOES : h)),
				NACH_ANWESENDEN
			],
			lesart: {
				kennung: 'L12',
				andere: {
					wahl: 'anwesende',
					typ: 'einstimmigkeit',
					rechtsgrundlage: 'ZGB Art. 647e Abs. 1',
					kopfbasis: 'anwesend_vertreten',
					quotenbasis: 'keine',
					einstimmigkeitsweg: WEG_ANWESENDE,
					formel: FORMEL_ANWESENDE
				}
			}
		};
	}
	if (k.id === AUSSCHLUSSKLAGE_ID) {
		// Die Gegenmeinung fällt weg: Die Lesart trägt die andere Ansicht, und
		// `umstrittenSatz` schweigt deshalb an dieser Karte.
		const { gegenmeinung: _gegenmeinung, ...ohneGegenmeinung } = k;
		void _gegenmeinung;
		// Unter einer hinterlegten Regel rechnet Votum nach ihr; dort steht der
		// Streit ohne die Seite «Lesarten», und der Hinweis zu den Zahlen erklärt
		// das gesetzliche Mehr.
		const unterRegel = (k.hinweiseUnterRegel ?? []).map((u) => {
			if (u.hinweis === HINWEIS_ZAEHLBASIS_VORHER) return { ...u, hinweis: W10, zumGesetz: W10_STREIT };
			// Hinweis 9 trägt jetzt W12 (E1, Block D), auch als Schlüssel unter einer
			// Regel, weil `pruefeRegelwerk` ihn dort im Knoten verlangt; gezeigt wird
			// unter einer Regel weiter sein `ersatz`.
			if (u.hinweis === ANGEHOERIGE_VORHER) return { ...u, hinweis: ANGEHOERIGE };
			return u;
		});
		if (!unterRegel.some((u) => u.hinweis === W10)) {
			throw new Error(
				`Fassung 2026-11-10: «${AUSSCHLUSSKLAGE_ID}» trägt den Hinweis zur Zählbasis nicht unter einer Regel.`
			);
		}
		return {
			...ohneGegenmeinung,
			begruendung: AUSSCHLUSS_BEGRUENDUNG,
			hinweise: [
				HINWEIS_ZAHLEN,
				...(k.hinweise ?? []).map((h) =>
					h === HINWEIS_ZAEHLBASIS_VORHER ? W10 : h === ANGEHOERIGE_VORHER ? ANGEHOERIGE : h
				)
			],
			hinweiseUnterRegel: [{ hinweis: HINWEIS_ZAHLEN, zumGesetz: true }, ...unterRegel],
			lesart: {
				kennung: 'L9',
				andere: {
					wahl: 'anwesende',
					typ: 'einfaches_mehr',
					rechtsgrundlage:
						'ZGB Art. 649b Abs. 2 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2',
					kopfbasis: 'anwesend_vertreten',
					quotenbasis: 'keine',
					hinweisErsatz: [
						{ alt: ZEHN_VORHER, neu: ZEHN_ANWESENDE },
						{ alt: ANGEHOERIGE, neu: ANGEHOERIGE_ANWESENDE },
						{ alt: HINWEIS_ZAHLEN, neu: HINWEIS_ZAHLEN_ANWESENDE },
						{ alt: WOHNUNG_VORHER, neu: WOHNUNG_ANWESENDE }
					]
				}
			}
		};
	}
	if (k.id !== PROZESSFUEHRUNG_ID) return k;
	// Die Gegenmeinung fällt weg: Die Lesart trägt die andere Ansicht, und
	// `umstrittenSatz` schweigt deshalb an dieser Karte.
	const { gegenmeinung: _gegenmeinung, ...ohneGegenmeinung } = k;
	void _gegenmeinung;
	return {
		...ohneGegenmeinung,
		begruendung: BEGRUENDUNG,
		hinweise: [...(k.hinweise ?? []).map((h) => (h === HINWEIS_VORHER ? HINWEIS : h)), GEGEN_EIGENTUEMER, NACH_EINFACHEM_MEHR],
		hinweiseUnterRegel: UNTER_REGEL,
		lesart: {
			kennung: 'L11',
			andere: {
				wahl: 'einfach',
				typ: 'einfaches_mehr',
				rechtsgrundlage:
					'ZGB Art. 647a Abs. 1 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2; Art. 712t Abs. 2',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine'
			}
		}
	};
});

// ── Die Probe gegen die Vorfassung ───────────────────────────────────────────

/** Die ganze Vorfassung als Text, für die Probe, dass ein neuer Satz nicht schon dasteht. */
const VORFASSUNG = JSON.stringify(REGELWERK_2026_11_05);
for (const neu of [
	BEGRUENDUNG_SATZ,
	EILWEG,
	HINWEIS,
	GEGEN_EIGENTUEMER,
	NACH_EINFACHEM_MEHR,
	HINWEIS_LUXURIOES,
	WEG_ANWESENDE_ANFANG,
	NACH_ANWESENDEN,
	AUSSCHLUSS_SATZ,
	W10,
	HINWEIS_ZAHLEN,
	HINWEIS_ZAHLEN_ANWESENDE,
	ANGEHOERIGE
]) {
	if (VORFASSUNG.includes(JSON.stringify(neu).slice(1, -1))) {
		throw new Error(`Fassung 2026-11-10: «${neu.slice(0, 60)}…» steht schon in der Vorfassung.`);
	}
}

// ── Die Fassung ─────────────────────────────────────────────────────────────

export const REGELWERK_2026_11_10 = {
	...REGELWERK_2026_11_05,
	fassung: '2026-11-10',

	knoten: KNOTEN,

	freigabevermerk:
		REGELWERK_2026_11_05.freigabevermerk +
		' In der Fassung 2026-11-10 rechnet Votum die Ermächtigung der Bewirtschaftung zur Prozessführung ' +
		'nach der Lesart der Gemeinschaft; nach der Vorgabe ändert sich kein Ergebnis.' +
		' Ebenso rechnet sie die Zustimmung zu einer luxuriösen baulichen Massnahme nach der Lesart der ' +
		'Gemeinschaft; nach der Vorgabe ändert sich kein Ergebnis.' +
		' Ebenso rechnet sie die Zählbasis der Ermächtigung zur Ausschlussklage nach der Lesart der ' +
		'Gemeinschaft; nach der Vorgabe ändert sich kein Ergebnis.'
} satisfies Regelwerk;
