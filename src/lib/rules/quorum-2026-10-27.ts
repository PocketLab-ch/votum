/**
 * Fassung 2026-10-27: Entscheiden statt der Versammlung (C1, C2a bis C2c).
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert ein Ergebnis: Wer die
 * Bewirtschaftung, einen Ausschuss oder einen Delegierten ermächtigt, statt
 * der Versammlung über eine ihrer gesetzlichen Aufgaben zu entscheiden
 * (Art. 712m Abs. 1 Ziff. 2 bis 6 ZGB), braucht die Zustimmung aller
 * Eigentümer. Bis zur Fassung 2026-10-26 nannte `k-bewirtschaftung-erweitert`
 * das nur im Hinweis und rechnete das qualifizierte Mehr; für die Übertragung
 * an einen Ausschuss oder Delegierten gab es keinen Fall.
 *
 * **Der Anlass** ist Entscheid 0018 (Lesarten der Gemeinschaft), «Fest»: C1 und
 * C2a mit Einstimmigkeit, nach Rz. 91 ad Art. 712g (ohne «u.E.»: «muss deshalb
 * einstimmig beschlossen werden, sofern sie Art. 712m Abs. 1 Ziff. 2–6
 * widerspricht»), Rz. 87 ad Art. 712g, Rz. 45 ad Art. 712m und Rz. 70 ad
 * Art. 712s. Andere Übertragungen mit einfachem Mehr, im Reglement mit
 * qualifiziertem (C2b, Rz. 89 ad Art. 712g); Wahl und beraten, prüfen,
 * berichten mit einfachem (C2c, Art. 712m Abs. 1 Ziff. 3).
 *
 * **Wie der Baum fragt** (Produktentscheid 21.10.2026, beide Fragen wie
 * empfohlen): mit einer Frage und Beispielen, nicht mit zwei Fällen in der
 * Liste; «im Zweifel die erste Antwort» steht in der Hilfe. Die Grenze ist für
 * die Bewirtschaftung und den Ausschuss dieselbe, gefragt als «letztes Wort»
 * bei einem Geschäft, das das Gesetz der Versammlung vorbehält (Laienprüfung
 * Block 4, L4-1: «nach Gesetz» überliest man, und das Reglement weist der
 * Versammlung mehr zu als das Gesetz).
 *
 *   - `f2-1-erweitert` führt zur Frage `f2-1-statt`: letztes Wort zum neuen
 *     Knoten `k-bewirtschaftung-statt-versammlung`, anderes zum bisherigen
 *     `k-bewirtschaftung-erweitert`, nur gewöhnliche Verwaltung zu
 *     `k-zustaendigkeit-gewoehnlich`.
 *   - `f2-1` erhält die Antwort «Einem Ausschuss oder Delegierten Aufgaben
 *     übertragen» mit der Frage `f2-1-uebertragung`: letztes Wort (neu
 *     `k-uebertragung-statt-versammlung`), Ausgaben der gewöhnlichen Verwaltung
 *     (`k-zustaendigkeit-gewoehnlich`), andere Aufgaben (Frage
 *     `f2-1-uebertragung-reglement`: im Reglement `k-reglement-normal`, sonst
 *     neu `k-uebertragung-beschluss`), beraten, beaufsichtigen, prüfen,
 *     berichten (`k-organ-waehlen`).
 *
 * **Der Ausgabenrahmen rechnet nach der Lesart L2** (Produktentscheid
 * 21.10.2026 auf die Fachprüfung Block 4, F4-1, «Wie die Zuständigkeit»):
 * Rz. 71 ad Art. 712m zählt den Ausgabenrahmen nur als übertragbare Aufgabe
 * auf und nennt kein Mehr. Wer ihn überträgt, ordnet die Zuständigkeit für
 * gewöhnliche Verwaltungshandlungen anders (Art. 647a Abs. 2), und dafür
 * stellt die Gemeinschaft das Mehr ein. Wichtigere Verwaltungshandlungen und
 * bauliche Massnahmen lassen sich gar nicht übertragen (Rz. 115 ad Art. 712m).
 *
 * **Kein bestehender Knoten ändert seine Rechnung** (Produktentscheid
 * 21.10.2026: «Bleiben, neue Karte»). Alte Traktanden behalten Knoten und
 * Erfordernis; die Neuherleitung über die Knotenkennung
 * (`veralteteErfordernisseIn` und die übrigen Vergleiche) findet unter dieser
 * Fassung dasselbe und meldet sie nicht als älteres Erfordernis. Dafür bleibt
 * ein altes Traktandum, das in Wahrheit ein Fall von C1 ist, beim
 * qualifizierten Mehr seiner Fassung.
 *
 * **Am bisherigen Knoten** zeigen die Hinweise auf die neuen Karten; die
 * Begründung grenzt das qualifizierte Mehr ab (Laienprüfung L4-2). Die
 * Beispiele kommen aus Rz. 79 ad Art. 712s; «Selbständige Auftragsvergabe bis
 * zu einem festen Betrag» fällt unter die gesetzliche Zuständigkeit (Rz. 77 ad
 * Art. 712s; Pendenz vom 20.10.2026), und «Abschluss und Kündigung von
 * Serviceverträgen ohne Rückfrage» las die Laienprüfung als Alltag (L4-4), ohne
 * dass eine Stelle es als Erweiterung nennt. Die Wahl eines Organs nennt den
 * Delegierten im Titel (Laienprüfung L4-8).
 */
import type { Antwort, Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_26 } from './quorum-2026-10-26';
import { KOMPETENZFRAGE_ID } from './quorum-2026-10-24';

export const ERWEITERT_ID = 'k-bewirtschaftung-erweitert';
export const ORGAN_ID = 'k-organ-waehlen';
export const REGLEMENT_ID = 'k-reglement-normal';
export const ZUSTAENDIGKEIT_ID = 'k-zustaendigkeit-gewoehnlich';
export const BEWIRTSCHAFTUNG_STATT_ID = 'k-bewirtschaftung-statt-versammlung';
export const UEBERTRAGUNG_STATT_ID = 'k-uebertragung-statt-versammlung';
export const UEBERTRAGUNG_BESCHLUSS_ID = 'k-uebertragung-beschluss';
export const STATT_FRAGE_ID = 'f2-1-statt';
export const UEBERTRAGUNG_FRAGE_ID = 'f2-1-uebertragung';
export const REGLEMENT_FRAGE_ID = 'f2-1-uebertragung-reglement';

/** Die Titel, auf die Hinweise zeigen; als Konstanten, damit ein Verweis nicht ins Leere läuft. */
const TITEL_ERWEITERT = 'Bewirtschaftung mit erweiterten Kompetenzen';
const TITEL_ZUSTAENDIGKEIT = 'Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regeln';
const TITEL_REGLEMENT = 'Reglement ändern, gewöhnliche Bestimmung';
export const TITEL_ORGAN = 'Ausschuss, Delegierten, Revisionsstelle oder Versammlungsleitung wählen';
const TITEL_BEWIRTSCHAFTUNG_STATT = 'Bewirtschaftung entscheidet statt der Versammlung';
const TITEL_UEBERTRAGUNG_STATT = 'Ausschuss oder Delegierter entscheidet statt der Versammlung';
const TITEL_UEBERTRAGUNG_BESCHLUSS = 'Ausschuss oder Delegierter übernimmt andere Aufgaben';

/**
 * Was das Gesetz der Versammlung vorbehält (Art. 712m Abs. 1 Ziff. 2 bis 6),
 * für C1 und C2a. Die Aufsicht fehlt, weil das Gesetz sie dem Ausschuss
 * zuweisen lässt (Ziff. 3; Rz. 59 ad Art. 712m; Fachprüfung F4-3); bei der
 * Versicherung nur, ob und wogegen versichert wird (Rz. 104 ad Art. 712m,
 * Rz. 79 ad Art. 712s; F4-2); beim Fonds nur, ob es ihn gibt und wie viel
 * eingelegt wird, denn ihn verwalten gehört nach Art. 712s Abs. 2 zur
 * Bewirtschaftung (F4-R3-2).
 */
export const GESETZLICHE_AUFGABEN =
	'Das Gesetz behält der Versammlung vor, wer die Bewirtschaftung ist und welches Pflichtenheft sie ' +
	'hat und wer im Ausschuss sitzt. Ebenso, ob Budget, Jahresrechnung und Kostenverteilung gelten, ob es ' +
	'einen Erneuerungsfonds gibt und wie viel eingelegt wird, und ob und wogegen das Gebäude versichert ' +
	'wird. Vorbereiten und vorschlagen ist noch kein letztes Wort.';

/** Was sich an niemanden übertragen lässt, in der Fragehilfe (Laienprüfung L4-R2-2). */
export const GAR_NICHT_UEBERTRAGBAR =
	'Bauliche Massnahmen und das Reglement lassen sich gar nicht übertragen, auch nicht mit Zustimmung aller.';

/**
 * Was sich einem Ausschuss nicht übertragen lässt, wortgleich an jeder Stelle
 * (Laienprüfung L4-R3-2, L4-R3-5). Ohne «Anstellung»: Rz. 115 ad Art. 712m
 * nennt Art. 647b, und Rz. 112 f. ad Art. 712a zählen dort Miet- und
 * Pachtverträge auf, keine Anstellung (Fachprüfung F4-R3-1).
 */
export const AUSSCHUSS_GRENZE =
	'Wichtigere Verwaltungshandlungen wie Miet- oder Pachtverträge, bauliche Massnahmen und das ' +
	'Reglement lassen sich einem Ausschuss nicht übertragen. Das gilt auch mit Zustimmung aller.';

/**
 * Dieselbe Grenze auf den Karten, mit Beleg. Rz. 115 sagt «unzulässig», die
 * Zustimmung aller trägt erst Rz. 115a und 116a als Folgerung (Fachprüfung
 * Runde 4, F4-R4-2).
 */
export const AUSSCHUSS_GRENZE_BELEG =
	'Wichtigere Verwaltungshandlungen wie Miet- oder Pachtverträge, bauliche Massnahmen und das ' +
	'Reglement lassen sich einem Ausschuss nicht übertragen (Rz. 115 ad Art. 712m). Weil ' +
	'die Grenze aus der Ordnung des Stockwerkeigentums folgt, ändert auch die Zustimmung aller nichts ' +
	'daran (Rz. 115a und 116a).';

/**
 * Der Weg, wenn sich etwas einem Ausschuss nicht übertragen lässt (Laienprüfung
 * L4-R3-6), nur für Miet- und Pachtverträge: Bauliche Massnahmen und das
 * Reglement lassen sich auch der Bewirtschaftung nicht übertragen (Fachprüfung
 * Runde 4, F4-R4-1).
 */
const AUSSCHUSS_AUSWEG =
	'Miet- oder Pachtverträge kann die Versammlung der Bewirtschaftung übertragen (Karte ' +
	`«${TITEL_ERWEITERT}») oder selbst abschliessen. Über bauliche Massnahmen und das Reglement ` +
	'beschliesst sie immer selbst.';

/**
 * Der Hauswart beim Ausschuss: offen, mit dem sicheren Weg (L4-R4-4). Ohne
 * Wechsel auf die Karte der Bewirtschaftung: Dort stünde das falsche Geschäft
 * im Protokoll, und unter einer Regel für die Organe rechnete sie nicht das
 * qualifizierte Mehr (Laienprüfung L4-R5-2, Fachprüfung F4-R5-2).
 */
export const HAUSWART_AUSSCHUSS =
	'Ob ein Ausschuss den Hauswart selbst anstellen darf, sagt der SVIT-Kommentar nicht ausdrücklich. Am ' +
	'sichersten ist der Beschluss, wenn er zusätzlich das qualifizierte Mehr erreicht: die Mehrheit der ' +
	'Anwesenden und Vertretenen und mehr als die Hälfte aller Wertquoten. Prüfen Sie das nach der ' +
	'Auszählung anhand der Wertquoten und halten Sie das Ergebnis im Protokoll fest.';

/**
 * Was nur das Reglement der Versammlung zuweist: zählt nicht für die
 * Einstimmigkeit, wechselt aber nur mit einer Reglementsänderung
 * (Fachprüfung Runde 2, F4-R2-2; Rz. 70 ad Art. 712s, Rz. 89 ad Art. 712g).
 * Zuletzt und ohne Fundstelle (Laienprüfung L4-R3-4).
 */
export const NUR_REGLEMENT =
	'Was nur Ihr Reglement der Versammlung zuweist, etwa die Vergabe alltäglicher Aufträge über einem ' +
	'Betrag, zählt hier nicht. Ändern lässt es sich aber nur mit einer Änderung des Reglements.';

/**
 * Am Weg zur Karte mit L2: Was das Reglement regelt, wechselt mit dem
 * Reglement, und zwar über die gewöhnliche Bestimmung, nicht über die
 * Bestimmung über Zuständigkeit oder Quoren (Codeprüfung M2; Fachprüfung
 * Runde 3: Art. 647a Abs. 2 als ausdrückliche Ausnahme, Rz. 78 ad Art. 712g,
 * Rz. 109 ad Art. 712a). Dazu die Grenze zur baulichen Massnahme (Laienprüfung
 * L4-R3-3): nach Rz. 107 ad Art. 712a «gemessen am Wert des Grundstücks mit eher
 * unbedeutenden Kosten», nicht «ohne nennenswerte Kosten», das eine kleine
 * Gemeinschaft zu eng las (L4-R4-3); mit den dringlichen Massnahmen (F4-R4-3).
 */
export const ALLTAG_UND_REGLEMENT =
	'Reparaturen mit Kosten, die gemessen am Wert der Liegenschaft eher unbedeutend sind, gehören zur ' +
	'alltäglichen Verwaltung. Grössere Reparaturen und Erneuerungen sind bauliche Massnahmen und bleiben ' +
	'bei der Versammlung. Dringliches veranlasst die Bewirtschaftung nach Gesetz selbst (ZGB Art. 712s ' +
	'Abs. 1). Regelt Ihr Reglement ' +
	'heute, wer solche Aufträge vergibt, ist die Änderung eine Änderung des Reglements. Dann wählen Sie ' +
	'unter «Reglement oder Hausordnung ändern» die gewöhnliche Bestimmung, nicht die Bestimmung über ' +
	'Zuständigkeit oder Quoren.';

/**
 * Warum Einstimmigkeit, an beiden neuen Karten. Rz. 44 ad Art. 712m stellt die
 * Frage, Rz. 45 beantwortet sie (Fachprüfung F4-4: «lässt offen» gab die
 * Stelle falsch wieder). Die Verneinung gilt nur für die genannten Stellen.
 */
export const WARUM_EINSTIMMIG =
	'Verringert eine Übertragung die Mitwirkungsrechte der Eigentümer, verlangt der SVIT-Kommentar die ' +
	'Zustimmung aller. So steht es in Rz. 44 f. ad Art. 712m, Rz. 87 und 91 ad Art. 712g und Rz. 70 ad Art. 712s. ' +
	'An diesen Stellen nennt er für diesen Fall kein tieferes Mehr; deshalb rechnet Votum mit Einstimmigkeit.';

const ORGANISATION =
	'Auch mit Zustimmung aller bleibt bei der Versammlung, ob es eine Bewirtschaftung oder einen ' +
	'Ausschuss gibt und ob sie abberufen werden.';

/**
 * Was auch mit Zustimmung aller bei der Versammlung bleibt (Fachprüfung F4-5,
 * Laienprüfung L4-3), an erster Stelle der Karte (L4-R2-2). Bei der
 * Bewirtschaftung ohne die wichtigeren Verwaltungshandlungen: Art. 647b Abs. 1
 * sieht einen Verwalter mit solchen Befugnissen vor (F4-R2-1).
 */
export const NICHT_UEBERTRAGBAR =
	`${ORGANISATION} Ebenso bauliche Massnahmen und das Reglement (SVIT-Kommentar Rz. 115 f. ad Art. 712m).`;

export const NICHT_UEBERTRAGBAR_AUSSCHUSS =
	`${ORGANISATION.slice(0, -1)} (Rz. 116 ad Art. 712m). ${AUSSCHUSS_GRENZE_BELEG} Mit Zustimmung aller ` +
	'kann der Ausschuss aber auswählen, ' +
	'wer die Bewirtschaftung führt (Rz. 45 ad Art. 712q).';

/**
 * Der Kasten «Und Ihr Reglement?» an beiden Karten mit Einstimmigkeit auf der
 * Website (`scripts/quorumsbaum-export.mjs`). In der Anwendung steht dort
 * `SPERRE_NACH_LEHRE`; die Website wendet nichts an und sagt deshalb, was sicher
 * ist (Laienprüfung L4-13), «was das Mehr betrifft» (F4-R3-3). Ohne nachträgliche schriftliche Zustimmung der
 * Abwesenden: Die Mischform trägt keine Stelle (Fachprüfung F4-R2-3; `quellen`
 * `fragen.md`, «Mischfall»). Auf die Website kommt der Satz mit dem Abzug in
 * Block 8 der Lesarten.
 */
export const WEBSITE_REGLEMENT_STATT =
	'Ob Ihr Reglement hier ein tieferes Mehr vorsehen darf, ist nicht geklärt. Was das Mehr betrifft, ist ' +
	'der Beschluss sicher, wenn alle Eigentümer zustimmen. Fehlt jemand an der Versammlung, ist am ' +
	'sichersten ein schriftlicher Beschluss, den alle unterschreiben, auch die Anwesenden (ZGB Art. 66 ' +
	'Abs. 2 i.V.m. Art. 712m Abs. 2). Die blosse nachträgliche Zustimmung der Abwesenden ist nicht gesichert.';

// ── C1: die Bewirtschaftung ────────────────────────────────────────────────

export const STATT_FRAGE: Frage = {
	id: STATT_FRAGE_ID,
	text: 'Hat die Bewirtschaftung danach das letzte Wort bei einem Geschäft, das das Gesetz der Versammlung vorbehält?',
	hilfe:
		`${GESETZLICHE_AUFGABEN} Ja heisst etwa: Die Bewirtschaftung legt die Einlage in den ` +
		'Erneuerungsfonds selbst fest. Nein heisst: Sie erledigt oder entscheidet anderes, etwa den Hauswart ' +
		'einstellen und kündigen, gemeinschaftliche Teile vermieten oder Versicherungsverträge abschliessen, ' +
		`nachdem die Versammlung bestimmt hat, wogegen versichert wird. Im Zweifel wählen Sie Ja. ` +
		`${GAR_NICHT_UEBERTRAGBAR} ${NUR_REGLEMENT}`,
	antworten: [
		{
			id: 'f2-1-statt-ja',
			text: 'Ja, sie hat dann bei einem dieser Geschäfte das letzte Wort',
			ziel: BEWIRTSCHAFTUNG_STATT_ID
		},
		{
			id: 'f2-1-statt-nein',
			text: 'Nein, sie erledigt oder entscheidet anderes; diese Geschäfte bleiben bei der Versammlung',
			ziel: ERWEITERT_ID
		},
		{
			id: 'f2-1-statt-gewoehnlich',
			text: 'Es geht nur um die alltägliche Verwaltung, etwa wer kleinere Aufträge bis zu einem Betrag vergibt',
			ziel: ZUSTAENDIGKEIT_ID,
			hilfe: ALLTAG_UND_REGLEMENT
		}
	]
};

export const BEWIRTSCHAFTUNG_STATT: Ergebnisknoten = {
	id: BEWIRTSCHAFTUNG_STATT_ID,
	titel: TITEL_BEWIRTSCHAFTUNG_STATT,
	typ: 'einstimmigkeit',
	geschaeftsart: 'organe',
	rechtsgrundlage:
		'ZGB Art. 712m Abs. 1 Ziff. 2 bis 6 mit Lehre (SVIT-Kommentar Rz. 91 und 87 ad Art. 712g, Rz. 45 ad ' +
		'Art. 712m, Rz. 70 ad Art. 712s)',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Entscheidet die Bewirtschaftung über eine Aufgabe, die das Gesetz der Versammlung zuweist, verliert ' +
		'jeder Eigentümer dort sein Mitspracherecht. Das geht nach dem SVIT-Kommentar nur mit der Zustimmung ' +
		'aller (Rz. 91 ad Art. 712g, Rz. 45 ad Art. 712m).',
	beispiele: [
		'Die Bewirtschaftung legt die Einlage in den Erneuerungsfonds selbst fest',
		'Die Bewirtschaftung genehmigt das Budget selbst, statt es der Versammlung vorzulegen'
	],
	hinweise: [
		NICHT_UEBERTRAGBAR,
		WARUM_EINSTIMMIG,
		'Soll die Bewirtschaftung nur anderes erledigen oder entscheiden, etwa den Hauswart einstellen, gilt ' +
			`mit tieferem Mehr die Karte «${TITEL_ERWEITERT}».`
	],
	reglementsverhalten: 'gesperrt_zwingend',
	rang: 'lehre'
};

const vorher = REGELWERK_2026_10_26.knoten.find((k) => k.id === ERWEITERT_ID);
if (!vorher) throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» fehlt in der Vorfassung.`);
if (vorher.titel !== TITEL_ERWEITERT) throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» heisst anders als erwartet.`);

/** Der Hinweis der Vorfassung, der nur sagte, was der Kommentar verlangt. */
export const DELEGATION_VORHER = 'Eine Delegation, die den einzelnen Eigentümern eigene Mitwirkungsrechte entzieht';
export const BEISPIEL_VORHER = 'Selbständige Auftragsvergabe bis zu einem festen Betrag';

const alterHinweis = (vorher.hinweise ?? []).filter((h) => h.startsWith(DELEGATION_VORHER));

/**
 * «Mit besonderem Mehr» umfasste auch Art. 647b, den Art. 647b Abs. 1 selbst
 * beim Verwalter vorsieht (Fachprüfung Runde 2, F4-R2-1).
 */
export const DELEGATION_GESPERRT_VORHER =
	'Geschäfte, die das Gesetz der Versammlung mit besonderem Mehr zuweist (bauliche Massnahmen, ' +
	'Reglement), lassen sich gar nicht an die Bewirtschaftung delegieren.';
export const DELEGATION_GESPERRT =
	'Bauliche Massnahmen und das Reglement lassen sich gar nicht an die Bewirtschaftung delegieren ' +
	'(SVIT-Kommentar Rz. 115 ad Art. 712m).';
if ((vorher.hinweise ?? []).filter((h) => h === DELEGATION_GESPERRT_VORHER).length !== 1) {
	throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» trägt den Hinweis zur Delegation baulicher Massnahmen nicht genau einmal.`);
}
if (alterHinweis.length !== 1) {
	throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» trägt den Hinweis zur Delegation nicht genau einmal.`);
}
if ((vorher.beispiele ?? []).filter((b) => b === BEISPIEL_VORHER).length !== 1) {
	throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» trägt das Beispiel der Pendenz nicht genau einmal.`);
}
if ((vorher.hinweiseUnterRegel ?? []).length !== 0) {
	throw new Error(`Fassung 2026-10-27: «${ERWEITERT_ID}» teilt Hinweise unter einer Regel; das sieht diese Fassung nicht vor.`);
}

export const HINWEIS_STATT =
	'Soll die Bewirtschaftung danach bei einem Geschäft, das das Gesetz der Versammlung vorbehält, das ' +
	'letzte Wort haben, braucht es die Zustimmung aller. Ein Beispiel ist die Einlage in den ' +
	`Erneuerungsfonds. Dafür gibt es die Karte «${TITEL_BEWIRTSCHAFTUNG_STATT}».`;

/** Laienprüfung L4-4: der Weg zur gewöhnlichen Verwaltung. */
export const HINWEIS_ALLTAG =
	'Geht es nur darum, wer die alltägliche Verwaltung erledigt oder kleinere Aufträge vergibt, gilt die ' +
	`Karte «${TITEL_ZUSTAENDIGKEIT}».`;

/** Aus Rz. 79 ad Art. 712s: Aufgaben, die nicht zum gesetzlichen Pflichtenheft gehören. */
export const BEISPIELE_ERWEITERT = ['Hauswart einstellen, beaufsichtigen und kündigen', 'Gemeinschaftliche Teile vermieten'];

export const ERWEITERT: Ergebnisknoten = {
	...vorher,
	// Fachprüfung F4-7: Rz. 87 ad Art. 712g trägt die Ausnahme, nicht das qualifizierte Mehr.
	rechtsgrundlage:
		'ZGB Art. 647b Abs. 1; bei Verankerung im Reglement ZGB Art. 712g Abs. 3 (SVIT-Kommentar Rz. 46 ad ' +
		'Art. 712q, Rz. 54 ad Art. 712m)',
	// Laienprüfung L4-2: Die alte Begründung beschrieb genau das Merkmal der Einstimmigkeit.
	// Fachprüfung Runde 2, F4-R2-4: warum qualifiziert und nicht einfach; L4-R2-5: «bei ihr» war mehrdeutig.
	begruendung:
		'Die Bewirtschaftung erhält mehr Spielraum, als ihr das Gesetz gibt; das ist eine wichtigere ' +
		'Verwaltungshandlung (ZGB Art. 647b Abs. 1). Die Geschäfte, die das Gesetz der Versammlung vorbehält ' +
		'(Art. 712m Abs. 1 Ziff. 2 bis 6), bleiben bei der Versammlung. Deshalb genügt das qualifizierte ' +
		'Mehr, Einstimmigkeit braucht es nicht (SVIT-Kommentar Rz. 91 ad Art. 712g).',
	beispiele: BEISPIELE_ERWEITERT,
	hinweise: [
		...(vorher.hinweise ?? []).map((h) => {
			if (h === alterHinweis[0]) return HINWEIS_STATT;
			if (h === DELEGATION_GESPERRT_VORHER) return DELEGATION_GESPERRT;
			return h;
		}),
		HINWEIS_ALLTAG
	]
};

// ── C2: Ausschuss oder Delegierter ─────────────────────────────────────────

export const UEBERTRAGUNG_FRAGE: Frage = {
	id: UEBERTRAGUNG_FRAGE_ID,
	text: 'Was soll der Ausschuss oder Delegierte nach der Übertragung tun?',
	hilfe:
		'Im Zweifel wählen Sie die erste Antwort. Die Wahl des Ausschusses oder Delegierten ist ein eigener ' +
		'Beschluss; dafür wählen Sie «Anderes Organ wählen».',
	antworten: [
		{
			id: 'f2-1-uebertragung-statt',
			text: 'Bei einem Geschäft, das das Gesetz der Versammlung vorbehält, das letzte Wort haben',
			ziel: UEBERTRAGUNG_STATT_ID,
			hilfe:
				`${GESETZLICHE_AUFGABEN} Etwa: Der Ausschuss legt das Pflichtenheft der Bewirtschaftung fest ` +
				`oder genehmigt die Jahresrechnung abschliessend. ${AUSSCHUSS_GRENZE} ${NUR_REGLEMENT}`
		},
		{
			id: 'f2-1-uebertragung-gewoehnlich',
			text: 'Über Ausgaben oder Aufträge der alltäglichen Verwaltung entscheiden, etwa bis zu einem Betrag',
			ziel: ZUSTAENDIGKEIT_ID,
			hilfe: `${ALLTAG_UND_REGLEMENT} ${AUSSCHUSS_GRENZE}`
		},
		{
			id: 'f2-1-uebertragung-anderes',
			text: 'Andere Aufgaben übernehmen',
			ziel: REGLEMENT_FRAGE_ID,
			hilfe:
				'Etwa die Versammlung einberufen, die Hausordnung entwerfen, Offerten einholen und vergleichen ' +
				'oder als Baukommission eine Sanierung begleiten, die die Versammlung beschlossen hat. ' +
				`${AUSSCHUSS_GRENZE} ${AUSSCHUSS_AUSWEG} ${HAUSWART_AUSSCHUSS}`
		},
		{
			id: 'f2-1-uebertragung-beraten',
			text: 'Die Bewirtschaftung beraten, beaufsichtigen, ihre Geschäftsführung prüfen und der Versammlung berichten',
			ziel: ORGAN_ID,
			// Laienprüfung L4-10: warum eine Wahlkarte; Fachprüfung F4-3: die Aufsicht.
			hilfe:
				'Beraten, prüfen und berichten nennt das Gesetz für den Ausschuss (ZGB Art. 712m Abs. 1 Ziff. 3); ' +
				'die Aufsicht kann die Versammlung ihm ebenfalls übertragen (SVIT-Kommentar Rz. 59 ad Art. 712m). ' +
				'Ein Beschluss darüber folgt derselben Regel wie seine Wahl.'
		}
	]
};

export const REGLEMENT_FRAGE: Frage = {
	id: REGLEMENT_FRAGE_ID,
	text: 'Soll die Übertragung im Reglement stehen?',
	// Laienprüfung L4-9: woran man den Fall erkennt.
	hilfe:
		'Ja, wenn der Antrag den Text des Reglements ändert oder ergänzt oder wenn das Reglement die Aufgabe ' +
		'heute anders regelt. Nein, wenn die Versammlung die Übertragung nur beschliesst und sie im ' +
		'Protokoll steht. Im Reglement braucht es das qualifizierte Mehr nach Köpfen und Wertquoten, als ' +
		'Beschluss genügt ein tieferes (ZGB Art. 712g Abs. 3; SVIT-Kommentar Rz. 89 ad Art. 712g). Im ' +
		'Zweifel wählen Sie Ja.',
	antworten: [
		{ id: 'f2-1-uebertragung-reglement-ja', text: 'Ja, im Reglement', ziel: REGLEMENT_ID },
		{
			id: 'f2-1-uebertragung-reglement-nein',
			text: 'Nein, als Beschluss der Versammlung',
			ziel: UEBERTRAGUNG_BESCHLUSS_ID
		}
	]
};

export const UEBERTRAGUNG_STATT: Ergebnisknoten = {
	id: UEBERTRAGUNG_STATT_ID,
	titel: TITEL_UEBERTRAGUNG_STATT,
	typ: 'einstimmigkeit',
	geschaeftsart: 'organe',
	// Fachprüfung F4-6: Die Ziffern stehen nur beim Verwalter (Rz. 91 ad Art. 712g).
	rechtsgrundlage:
		'ZGB Art. 712m Abs. 1 Ziff. 3 mit Lehre (SVIT-Kommentar Rz. 45 ad Art. 712m, Rz. 87 ad Art. 712g); ' +
		'abgegrenzt nach Ziff. 2 bis 6 wie beim Verwalter (Rz. 91 ad Art. 712g)',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Entscheidet ein Ausschuss oder Delegierter über eine Aufgabe, die das Gesetz der Versammlung ' +
		'zuweist, verliert jeder Eigentümer dort sein Mitspracherecht. Das geht nach dem SVIT-Kommentar nur ' +
		'mit der Zustimmung aller (Rz. 45 ad Art. 712m, Rz. 87 ad Art. 712g).',
	beispiele: [
		'Der Ausschuss legt das Pflichtenheft der Bewirtschaftung fest',
		'Der Ausschuss genehmigt die Jahresrechnung abschliessend'
	],
	hinweise: [
		NICHT_UEBERTRAGBAR_AUSSCHUSS,
		WARUM_EINSTIMMIG,
		'Soll der Ausschuss oder Delegierte nur andere Aufgaben übernehmen, etwa die Versammlung einberufen, ' +
			`gilt mit tieferem Mehr die Karte «${TITEL_UEBERTRAGUNG_BESCHLUSS}».`,
		`Die Wahl des Ausschusses oder Delegierten ist ein eigener Beschluss (Karte «${TITEL_ORGAN}»).`
	],
	reglementsverhalten: 'gesperrt_zwingend',
	rang: 'lehre'
};

export const UEBERTRAGUNG_BESCHLUSS: Ergebnisknoten = {
	id: UEBERTRAGUNG_BESCHLUSS_ID,
	titel: TITEL_UEBERTRAGUNG_BESCHLUSS,
	typ: 'einfaches_mehr',
	geschaeftsart: 'organe',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 3; für Einberufung und Vorsitz Art. 712n Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	// Fachprüfung F4-1: Rz. 71 ad Art. 712m nennt kein Mehr; das einfache trägt das Gesetz.
	begruendung:
		'Die Versammlung kann einem Ausschuss oder Delegierten Aufgaben der Verwaltung übertragen (ZGB ' +
		'Art. 712m Abs. 1 Ziff. 3); ein besonderes Mehr verlangt das Gesetz dafür nicht (Art. 67 Abs. 2 ' +
		'i.V.m. Art. 712m Abs. 2). Für Einberufung und Vorsitz bestätigt das der SVIT-Kommentar (Rz. 89 ad ' +
		'Art. 712g).',
	beispiele: [
		'Ein Delegierter beruft die Versammlung ein',
		'Der Ausschuss holt Offerten ein und vergleicht sie',
		'Eine Baukommission begleitet eine Sanierung, die die Versammlung beschlossen hat'
	],
	hinweise: [
		'Soll der Ausschuss oder Delegierte bei einem Geschäft, das das Gesetz der Versammlung vorbehält, das ' +
			'letzte Wort haben, etwa das Budget genehmigen, braucht es die Zustimmung aller. Dafür gibt es die ' +
			`Karte «${TITEL_UEBERTRAGUNG_STATT}».`,
		'Soll er über Ausgaben oder Aufträge der alltäglichen Verwaltung entscheiden, gilt die Karte ' +
			`«${TITEL_ZUSTAENDIGKEIT}». ${AUSSCHUSS_GRENZE_BELEG} ${AUSSCHUSS_AUSWEG}`,
		HAUSWART_AUSSCHUSS,
		`Soll die Übertragung ins Reglement, gilt die Karte «${TITEL_REGLEMENT}».`
	],
	reglementsverhalten: 'frei',
	rang: 'gesetz'
};

// ── C2c: die Wahl ──────────────────────────────────────────────────────────

const organVorher = REGELWERK_2026_10_26.knoten.find((k) => k.id === ORGAN_ID);
if (!organVorher) throw new Error(`Fassung 2026-10-27: «${ORGAN_ID}» fehlt in der Vorfassung.`);
if ((organVorher.hinweise ?? []).length !== 0) {
	throw new Error(`Fassung 2026-10-27: «${ORGAN_ID}» trägt schon Hinweise; diese Fassung setzt den ersten.`);
}

export const HINWEIS_ORGAN =
	'Soll ein Ausschuss oder Delegierter mehr tun als beraten, beaufsichtigen, prüfen und berichten, ' +
	'braucht die Übertragung einen eigenen Beschluss. Sie finden ihn unter «Bewirtschaftung und Organe», ' +
	'Antwort «Einem Ausschuss oder Delegierten Aufgaben übertragen».';

export const ORGAN: Ergebnisknoten = { ...organVorher, titel: TITEL_ORGAN, hinweise: [HINWEIS_ORGAN] };

// ── Baum ───────────────────────────────────────────────────────────────────

const UEBERTRAGEN: Antwort = {
	id: 'f2-1-uebertragen',
	text: 'Einem Ausschuss oder Delegierten Aufgaben übertragen',
	ziel: UEBERTRAGUNG_FRAGE_ID
};

/** Laienprüfung L4-8: Den Delegierten wählt man unter einer Antwort, die ihn nennt. */
export const ORGAN_ANTWORT_TEXT = 'Anderes Organ wählen — Ausschuss, Delegierte, Revisionsstelle, Versammlungsleitung';

/**
 * Die Hilfe der Frage nach den Kompetenzen (Fassung 2026-10-24), an drei
 * Stellen nachgezogen:
 *
 *   - Sie sagte, die Erweiterung brauche «ein eigenes Traktandum mit
 *     qualifiziertem Mehr». Seit dieser Fassung kann es auch die Zustimmung
 *     aller sein (Codeprüfung N3; Rz. 54 ad Art. 712m: «bzw. ausnahmsweise
 *     einstimmig»); welches, zeigt der Baum (Laienprüfung L4-R4-2).
 *   - Ihr Beispiel «grössere Aufträge vergeben» stand neben dem neuen Satz, die
 *     Vergabe alltäglicher Aufträge über einem Betrag sei alltägliche
 *     Verwaltung; jetzt die Beispiele der Karte zur Erweiterung, und das Amt
 *     statt der Firma (L4-R4-1).
 *   - Solange die Erweiterung nicht beschlossen ist, ist der Vertrag ohne diese
 *     Kompetenzen abzuschliessen (Fachprüfung Runde 4, F4-R4-4; Laienprüfung
 *     L4-R5-1: auch beim Nein; Rz. 54 ad Art. 712m: «vorab»).
 */
export const KOMPETENZHILFE_ERSATZ: [string, string][] = [
	[
		'Es zählt, was die Bewirtschaftung schon darf, nicht welche Firma Sie wählen: etwa gemeinschaftliche ' +
			'Teile vermieten oder grössere Aufträge vergeben,',
		'Es zählt, welche Befugnisse das Amt der Bewirtschaftung in Ihrer Gemeinschaft schon hat, gleich welche ' +
			'Firma Sie wählen: etwa gemeinschaftliche Teile vermieten oder den Hauswart einstellen und kündigen,'
	],
	[
		'Verwaltungsvertrag; dann braucht die Erweiterung ein eigenes Traktandum mit qualifiziertem Mehr.',
		'Verwaltungsvertrag. Dann braucht die Erweiterung ein eigenes Traktandum, je nach Inhalt mit ' +
			'qualifiziertem Mehr oder mit der Zustimmung aller; welches gilt, zeigt unter «Worum geht es ' +
			'genau?» die Antwort «Bewirtschaftung mit Kompetenzen über die gewöhnliche Verwaltung hinaus ' +
			'ausstatten». Solange die Erweiterung nicht beschlossen ist, ist der Vertrag ohne diese ' +
			'Kompetenzen abzuschliessen.'
	],
	['Wird sie am Abend abgelehnt', 'Wird die Erweiterung am Abend abgelehnt']
];

function mitKompetenzhilfe(f: Frage): Frage {
	if (f.id !== KOMPETENZFRAGE_ID) return f;
	let hilfe = f.hilfe ?? '';
	for (const [vorher, neu] of KOMPETENZHILFE_ERSATZ) {
		if (hilfe.split(vorher).length !== 2) {
			throw new Error(`Fassung 2026-10-27: Die Hilfe von «${KOMPETENZFRAGE_ID}» enthält «${vorher.slice(0, 40)}…» nicht genau einmal.`);
		}
		hilfe = hilfe.replace(vorher, neu);
	}
	return { ...f, hilfe };
}

function mitZweigen(f: Frage): Frage {
	if (f.id !== 'f2-1') return mitKompetenzhilfe(f);
	if (!f.antworten.some((a) => a.id === 'f2-1-erweitert' && a.ziel === ERWEITERT_ID)) {
		throw new Error('Fassung 2026-10-27: «f2-1-erweitert» führt in der Vorfassung nicht zur Erweiterung.');
	}
	if (!f.antworten.some((a) => a.id === 'f2-1-organ' && a.ziel === ORGAN_ID)) {
		throw new Error('Fassung 2026-10-27: «f2-1-organ» führt in der Vorfassung nicht zur Wahl eines Organs.');
	}
	return {
		...f,
		antworten: f.antworten.flatMap((a) => {
			if (a.id === 'f2-1-erweitert') return [{ ...a, ziel: STATT_FRAGE_ID }];
			if (a.id === 'f2-1-organ') return [{ ...a, text: ORGAN_ANTWORT_TEXT }, UEBERTRAGEN];
			return [a];
		})
	};
}

for (const [id, titel] of [
	[ZUSTAENDIGKEIT_ID, TITEL_ZUSTAENDIGKEIT],
	[REGLEMENT_ID, TITEL_REGLEMENT]
]) {
	if (REGELWERK_2026_10_26.knoten.find((k) => k.id === id)?.titel !== titel) {
		throw new Error(`Fassung 2026-10-27: Der Verweis auf «${id}» nennt einen anderen Titel als die Karte.`);
	}
}
for (const id of [BEWIRTSCHAFTUNG_STATT_ID, UEBERTRAGUNG_STATT_ID, UEBERTRAGUNG_BESCHLUSS_ID, STATT_FRAGE_ID, UEBERTRAGUNG_FRAGE_ID, REGLEMENT_FRAGE_ID]) {
	if ([...REGELWERK_2026_10_26.knoten, ...REGELWERK_2026_10_26.fragen].some((x) => x.id === id)) {
		throw new Error(`Fassung 2026-10-27: «${id}» gibt es schon.`);
	}
}

export const REGELWERK_2026_10_27 = {
	...REGELWERK_2026_10_26,
	fassung: '2026-10-27',

	fragen: [...REGELWERK_2026_10_26.fragen.map(mitZweigen), STATT_FRAGE, UEBERTRAGUNG_FRAGE, REGLEMENT_FRAGE],

	knoten: REGELWERK_2026_10_26.knoten.flatMap((k) => {
		if (k.id === ERWEITERT_ID) return [ERWEITERT, BEWIRTSCHAFTUNG_STATT];
		if (k.id === ORGAN_ID) return [ORGAN, UEBERTRAGUNG_STATT, UEBERTRAGUNG_BESCHLUSS];
		return [k];
	}),

	freigabevermerk:
		REGELWERK_2026_10_26.freigabevermerk +
		' In der Fassung 2026-10-27 verlangt Votum die Zustimmung aller, wo die Bewirtschaftung, ein ' +
		'Ausschuss oder ein Delegierter statt der Versammlung über eine ihrer gesetzlichen Aufgaben ' +
		'entscheiden soll.'
} satisfies Regelwerk;
