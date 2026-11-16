/**
 * **Wächter für den geprüften Wortlaut** der Endfassungen Block B und Block C
 * zu Entscheid 0048 (Featureprüfung Regel 43 Runde 2, Kriterien B4 und C7,
 * Befund M2): Jeder geltende Satz steht wörtlich im Text, den Votum erzeugt.
 * Vorher waren die Texte nur über Bruchstücke gebunden; ein gestrichener oder
 * gekürzter Satz blieb ohne Alarm.
 *
 * **Die Sätze stehen hier als Liste**, nicht zur Laufzeit aus `quellen`
 * gelesen: Quellen sind die Endfassungen
 * `quellen/pruefung/zu-pruefen-2026-11-13-votum-regel43-block-{b,c}-endfassung.md`
 * mit den Änderungen der drei Nachtragsrunden, wie sie im Code stehen, und
 * mit eingesetzten Platzhaltern ({Lehre}, {Gericht}, [Reglement]). Wer einen
 * Satz ändert, ändert ihn hier mit und braucht dafür die Laien- und die
 * Fachprüfung (`quellen/pruefung/README.md`). **Ausnahme Block D:** Die Gruppe
 * «Block D» trägt den Inhalt der Fachprüfung (N3-F-1, N3-F-2) in der Fassung,
 * die die Laienprüfung bestimmt hat (D-L-1, D-L-2); nach Ablauf 3 von
 * `pruefung/README.md` darf sie das, solange Inhalt, Bedingungen und
 * Einschränkungen gleich bleiben. Einen eigenen Fachbericht dazu gibt es nicht.
 *
 * **Der erzeugte Text** ist die Ausgabe der Prüfdatei
 * (`scripts/pruefdatei-c2-l13.ts`: Karten, Leitungsseite, Protokoll,
 * Auszählmappe, Handbuch je Wahl und Fall) und die Texte von Katalog und
 * Regelwerk der Fassungen 2026-11-13 und der aktuellen (2026-11-15; seit
 * «Texte nach 0047» stehen die Sätze aus Block C dort mit den Punkten 11 und 12).
 *
 * **Dazu die zwölf Punkte von «Texte nach 0047»** (unten, eigene Gruppe): je
 * eine Probe auf den neuen Satz und eine auf den alten an der neuen Fassung oder
 * im Kern (Auftrag `.auftraege/2026-11-13-votum-texte-nach-0047.md`, Abnahme).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { holeRegelwerk } from '$lib/rules';
import { LESARTEN_VORGABE, lesartVon, mitKopfzaehlweise, wendeLesartAn } from '$lib/domain/lesarten';
import {
	AUSLEGUNG_EBENFALLS_VERTRETEN,
	andereLesartInWorten,
	erfordernisInWorten,
	GERECHNET_NACH_EINSTELLUNG,
	lesartProtokollsatz,
	ZAEHLBASIS_VERKUENDET,
	type ErgebnisNachAndererLesart
} from '$lib/domain/auszaehlung';
import {
	ANGEHOERIGE_BEIM_SETZEN,
	angehoerigeBeimSetzen,
	erfordernisAusKnoten
} from '$lib/domain/entscheidbaum';
import {
	EINWAND_AUSWERTUNG_FRIST,
	EINWAND_AUSWERTUNG_VERWEIS,
	EINWAND_GESETZ_UND_BESTIMMUNG,
	einwandInDerAuswertung
} from '$lib/domain/protokoll';
import { stimmrechtBeiNutzniessung } from '$lib/domain/nutzniessung';
import {
	ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15,
	KLAUSEL_MIT_WENIGER_OFFEN,
	KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN,
	KLAUSEL_SICHER,
	wendeReglementAn
} from '$lib/domain/reglement';
import {
	ANGEHOERIGE_BERATUNG,
	KLAUSEL_AUSSCHLUSS,
	VOLLMACHT_AN_IHN,
	BELEG_712G,
	BELEG_REGLEMENT,
	ENTHALTUNG_SATZ,
	ENTHALTUNG_SATZ_647D,
	GEGENMEINUNG_647D,
	REGLEMENT_SATZ
} from '$lib/rules/quorum-2026-11-15';

function tief(w: unknown, aus: string[]): void {
	if (typeof w === 'string') aus.push(w);
	else if (Array.isArray(w)) w.forEach((x) => tief(x, aus));
	else if (w && typeof w === 'object') Object.values(w).forEach((x) => tief(x, aus));
}

/**
 * Vier Texte, je Gruppe einer (`ziel`): `b13` ist das Regelwerk der Fassung
 * 2026-11-13 allein, ohne Katalog (Codeprüfung Block D, Lauf 2, A: Sätze, die
 * auch im Katalog L4 stehen, fänden sich sonst dort); `c` die Prüfdatei samt
 * Katalog und Regelwerk 2026-11-14; `l4` und `l13` je nur der Eintrag im
 * Katalog. Getrennt, weil ein Satz an mehreren Orten stehen kann und dann nur
 * einer gebunden wäre (Gegenproben zu [Reglement] und Lauf 1, N1).
 */
async function erzeugteTexte(): Promise<Record<Ziel, string>> {
	const ausgabe: string[] = [];
	const spy = vi.spyOn(console, 'log').mockImplementation((...z: unknown[]) => {
		ausgabe.push(z.map(String).join(' '));
	});
	try {
		await import('../../scripts/pruefdatei-c2-l13.ts');
	} finally {
		spy.mockRestore();
	}
	const katalog: string[] = [];
	for (const k of ['L1', 'L2', 'L4', 'L11', 'L13']) tief(lesartVon(k), katalog);
	const b: string[] = [];
	tief(holeRegelwerk('2026-11-13'), b);
	const c = [...ausgabe, ...katalog];
	tief(holeRegelwerk('2026-11-15'), c);
	const flach = (t: string[]) => t.join('\n').replace(/\s+/g, ' ');
	// Die Gruppen zum Katalog nur gegen ihren Eintrag (Codeprüfung Block D, N1):
	// Ein Satz, der auch an einer anderen Lesart oder Karte steht, fände sich sonst dort.
	const eintrag = (k: string) => {
		const t: string[] = [];
		tief(lesartVon(k), t);
		return flach(t);
	};
	return { b13: flach(b), c: flach(c), l4: eintrag('L4'), l13: eintrag('L13') };
}

/** Woran eine Gruppe gemessen wird (Codeprüfung Block D, Lauf 2, E): ein eigenes Feld, nicht der Anfang des Titels. */
type Ziel = 'b13' | 'c' | 'l4' | 'l13';

const GRUPPEN: { gruppe: string; ziel: Ziel; saetze: string[] }[] = [
	{
		gruppe: 'Katalog L4, alle Felder (Endfassung B, Stelle 1; Endfassung C, Abschnitt 7)',
		ziel: 'l4',
		saetze: [
			'Welches Mehr braucht die Wahl einer Bewirtschaftung, die schon Kompetenzen über die gewöhnliche Verwaltung hinaus hat?',
			'ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht',
			'Mehr als die Hälfte der Eigentümer stimmt zu, gezählt, wie es die Frage zur Zählweise der Köpfe einstellt (Vorgabe: Anwesende und Vertretene), und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
			'Die Wertquoten der Abwesenden wirken dabei wie ein Nein.',
			'Wird das nicht erreicht, weist Votum die Wahl als abgelehnt aus.',
			'Art. 647b Abs. 1 ZGB; wie die Köpfe zählen, stellt die Frage zur Zählweise der Köpfe ein',
			'Es genügt, dass mehr als die Hälfte der anwesenden und vertretenen Eigentümer zustimmt.',
			'Die Wertquoten zählen nicht.',
			'SVIT-Kommentar Rz. 46 ad Art. 712q; Rz. 112 ad Art. 712a',
			'Nach dem Wortlaut von Art. 647b Abs. 1 ZGB braucht die Wahl einer Verwaltung mit mehr als gewöhnlichen Befugnissen das qualifizierte Mehr.',
			'Der SVIT-Kommentar und ein Teil der Lehre lassen das einfache genügen, weil im Stockwerkeigentum die Regeln zur Verwaltung vorgingen.',
			'Ein Entscheid des Bundesgerichts zu dieser Frage ist uns nicht bekannt.',
			'Art. 647b Abs. 1 ZGB nennt die Bestellung eines Verwalters, dessen Zuständigkeit nicht auf gewöhnliche Verwaltungshandlungen beschränkt ist, ausdrücklich bei den Geschäften mit qualifiziertem Mehr.',
			'Der SVIT-Kommentar lässt für die Wahl das einfache Mehr genügen, auch wenn das Reglement die Befugnisse erweitert hat: Im Stockwerkeigentum gingen die Regeln zur Verwaltung vor (Art. 712q ff.; Rz. 112 ad Art. 712a).',
			'Er verweist für das einfache Mehr auf ein kantonales Urteil und mehrere Lehrmeinungen und nennt die Frage bei erweiterten Befugnissen selbst umstritten (Rz. 46 ad Art. 712q).',
			'Für die Verwalterwahl im Allgemeinen nennt auch das Bundesgericht das einfache Mehr (BGer 5A_48/2022 E. 6.1.2.1); zu erweiterten Befugnissen äussert es sich dort nicht, und ein anderer Entscheid dazu ist uns nicht bekannt.',
			'Votum verlangt deshalb nach dem Wortlaut von Art. 647b Abs. 1 das qualifizierte Mehr.',
			'Eine Wahl, die es erreicht, erfüllt das Mehr nach beiden Wahlen dieser Einstellung.',
			'Verlangt Ihr Reglement mehr, gilt das Reglement.',
			'Die Einstellung gilt für die Wahl einer Verwaltung, die nach Reglement oder Verwaltungsvertrag mehr als die gewöhnliche Verwaltung besorgen darf, etwa gemeinschaftliche Teile selbständig vermieten; den Abschluss von Miet- und Pachtverträgen nennt Art. 647b Abs. 1 ZGB selbst.',
			'Hat die Verwaltung nur die Aufgaben, die das Gesetz jeder Verwaltung gibt (namentlich ZGB Art. 712s und 712t), bleibt es nach dem SVIT-Kommentar beim einfachen Mehr (Rz. 44 ad Art. 712m).',
			'Steht in Ihrem Reglement eine Bestimmung zu diesem Mehr und haben Sie sie in Votum eingetragen, rechnet Votum nach ihr.',
			'Hier gehen der Wortlaut von Art. 647b Abs. 1 ZGB und der SVIT-Kommentar auseinander.',
			'Wer das einfache Mehr wählt, folgt dem Kommentar.',
			'Wer nicht zugestimmt hat, kann eine Wahl mit nur einfachem Mehr anfechten: beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde.',
			'Die Frist beträgt einen Monat, für Anwesende und Vertretene ab der Versammlung, für Abwesende in der Regel ab Erhalt des Protokolls.',
			'Stellen Sie das Protokoll deshalb rasch und nachweisbar allen zu.',
			'Den Verwaltungsvertrag unterzeichnet die Gemeinschaft, wo es nicht eilt, erst, wenn die Frist für alle abgelaufen ist, also frühestens einen Monat, nachdem auch die Abwesenden das Protokoll erhalten haben.',
			'Hat die Gemeinschaft danach keine Bewirtschaftung mehr, kann jeder Eigentümer ohne vorherige Anfechtung das Gericht um die Ernennung ersuchen (ZGB Art. 712q Abs. 1).',
			'Eine Frist dafür ist nicht geklärt; der Kommentar rät, sich möglichst an einen Monat seit der Versammlung zu halten.',
			'An die vorgeschlagene Bewirtschaftung ist das Gericht nicht gebunden.',
			'Läuft das bisherige Mandat noch, setzen Sie die Wahl für eine Versammlung vor seinem Ende neu auf die Traktandenliste.'
		]
	},
	{
		gruppe: 'Katalog L13, alle Felder (Endfassung C, Abschnitt 1, mit den Nachtragsrunden)',
		ziel: 'l13',
		saetze: [
			'Zählen bei Beschlüssen, für die das Gesetz die «Mehrheit aller Miteigentümer» verlangt, nur die Köpfe der Anwesenden und Vertretenen oder die aller Eigentümer?',
			'ob bei der «Mehrheit aller Miteigentümer» nur die Köpfe der Anwesenden und Vertretenen zählen oder die aller Eigentümer',
			'die Zählung unter den Anwesenden und Vertretenen',
			'der Zählung unter den Anwesenden und Vertretenen',
			'Gezählt werden die Köpfe der Eigentümer, die an der Versammlung anwesend oder vertreten sind.',
			'Wer fehlt und keine Vollmacht gegeben hat, zählt nicht mit.',
			'Bei 20 Eigentümern, von denen 12 da oder vertreten sind, genügen bei den Köpfen 7 Ja.',
			'Herrschende Lehre: Für die Versammlung gilt das Vereinsrecht, und es geht dem Wortlaut vor (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b, 181 und 190 f. ad Art. 712m; Handschin/Wyttenbach 2011, S. 67 bis 70).',
			'Für nützliche bauliche Massnahmen bestätigt vom Bundesgericht (BGE 144 III 510 E. 2.2.4).',
			'die Zählung unter allen Eigentümern',
			'der Zählung unter allen Eigentümern',
			'Gezählt werden die Köpfe aller Eigentümer, auch der abwesenden.',
			'Wer fehlt und keine Vollmacht gegeben hat, wirkt wie ein Nein, ebenso wer im Ausstand ist.',
			'Im selben Beispiel braucht es bei den Köpfen 11 Ja.',
			'Das ist strenger als die herrschende Lehre: Ein Antrag, dem nur die Mehrheit der Anwesenden und Vertretenen zustimmt, gilt dann als abgelehnt, und auch diese Ablehnung kann angefochten werden.',
			'Kann höchstens die Hälfte der Eigentümer mitstimmen, weil die übrigen fehlen oder im Ausstand sind, kann die Versammlung solche Beschlüsse nicht fassen, auch nicht an einer zweiten Versammlung.',
			'Fehlen zu viele, helfen nur Vollmachten.',
			'Bei zwei Eigentümern kommt ein solcher Beschluss unter dieser Zählweise nie zustande, wenn einer im Ausstand ist; unter «Anwesende und Vertretene» entscheidet bei den Köpfen dann der andere.',
			'Wer nur sicher gehen will, muss nicht auf «Alle Eigentümer» umstellen: Es genügt, dass mehr als die Hälfte aller Eigentümer zustimmt; dann besteht der Beschluss nach beiden Zählweisen.',
			'Wortlaut von ZGB Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e Abs. 2.',
			'Bei nützlichen baulichen Massnahmen zählten so Simonius/Sutter und Michaud (genannt in BGE 144 III 510 E. 2.2.4); das Bundesgericht ist ihnen dort nicht gefolgt.',
			// Punkt 12b.
			'Ch. Müller und K. Müller zählen nur die Abstimmenden (genannt im selben Urteil); das Bundesgericht ist ihnen nicht gefolgt.',
			'So zählt die herrschende Lehre, die Auffassung der meisten Fachleute.',
			'Das Gesetz sagt bei diesen Beschlüssen «Mehrheit aller Miteigentümer».',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt im Stockwerkeigentum trotzdem nur die Anwesenden und Vertretenen.',
			'Denn für die Versammlung gilt das Vereinsrecht, und danach entscheidet die Mehrheit der Anwesenden (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b und 190 f. ad Art. 712m; Handschin/Wyttenbach, S. 67 bis 70).',
			'Das Bundesgericht hat das für nützliche bauliche Massnahmen bestätigt (BGE 144 III 510 E. 2.2.4).',
			'Sein Grund: Ist eine Versammlung nicht beschlussfähig, wird eine zweite einberufen, und an ihr genügt ein Drittel der Eigentümer.',
			'Müsste die Mehrheit aller zustimmen, könnte eine solche Versammlung oft weder nützliche noch notwendige Arbeiten beschliessen.',
			'Über die übrigen Beschlüsse hat das Bundesgericht nicht entschieden.',
			// Auftrag «Texte nach 0047», Punkt 12a.
			'Einzelne Autoren zählen alle Eigentümer, andere nur die Eigentümer, die abstimmen; beide Ansichten nennt BGE 144 III 510 E. 2.2.4, dort zu den nützlichen baulichen Massnahmen.',
			'Wer nur die Abstimmenden zählt, lässt Enthaltungen weg (SVIT-Kommentar Rz. 181 ad Art. 712m).',
			'Ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt, besteht nach beiden Zählweisen.',
			'Die Einstellung gilt für Beschlüsse, bei denen das Gesetz «Mehrheit aller Miteigentümer» sagt:',
			'- wer gewöhnliche Verwaltungsarbeiten in Auftrag geben darf, wenn die Versammlung das anders regelt (ZGB Art. 647a Abs. 2),',
			'- wichtigere Verwaltungshandlungen (Art. 647b Abs. 1),',
			'- notwendige bauliche Massnahmen (Art. 647c),',
			'- luxuriöse Massnahmen gegen den Willen Einzelner (Art. 647e Abs. 2).',
			'- bei nützlichen baulichen Massnahmen (Art. 647d): Dort zählt Votum immer die Anwesenden und Vertretenen, weil das Bundesgericht diese Zählung bestätigt hat,',
			'- bei der Ermächtigung zur Ausschlussklage: dafür gibt es eine eigene Frage auf dieser Seite,',
			'- wenn Votum eine Bestimmung Ihres Reglements anwendet.',
			'Dazu gehört die Bestimmung, nach der Enthaltungen beim einfachen Mehr nicht mitzählen (Angaben der Gemeinschaft); sie betrifft hier die notwendigen baulichen Massnahmen und die Zuständigkeit für gewöhnliche Verwaltungsarbeiten.',
			'Wertquoten (die Anteile am Grundstück) zählen, wo das Gesetz sie verlangt, immer über alle Wertquoten.',
			'Wer im Ausstand ist, stimmt nicht mit.',
			'Im Ausstand ist, wer mitentscheiden würde über ein Geschäft oder einen Streit zwischen ihm und der Gemeinschaft.',
			'Unter «Alle Eigentümer» zählt er trotzdem in der Gesamtzahl und wirkt wie ein Nein, weil der Wortlaut niemanden ausnimmt; geklärt ist das nicht.',
			'Unter «Anwesende und Vertretene» zählt er nicht mit.',
			// Punkt 12e.
			'Votum zählt Enthaltungen in beiden Fällen mit, wie die herrschende Lehre; sie wirken wie ein Nein.',
			'Ausgenommen ist, wo Votum die Bestimmung Ihres Reglements anwendet, nach der sie beim einfachen Mehr nicht mitzählen.',
			'Ein Beschluss, den nur die Mehrheit der Anwesenden und Vertretenen trägt, gilt, bis ein Gericht ihn aufhebt.',
			'Wer nicht zugestimmt hat, kann ihn beim Gericht anfechten, innert eines Monats, seit er davon weiss, und sich auf den Wortlaut berufen.',
			'Bei nützlichen baulichen Massnahmen hat das Bundesgericht die Zählung unter den Anwesenden bestätigt; über die übrigen Beschlüsse hat es nicht entschieden.',
			'Wer sicher gehen will, holt vor der Versammlung Vollmachten ein, damit mehr als die Hälfte aller Eigentümer zustimmen kann.',
			'Die Zählung folgt der herrschenden Lehre; ob Sie mit der Ausführung zuwarten, wägen Sie am Geschäft ab.',
			'Wer sicher gehen will, stellt das Protokoll rasch und nachweisbar allen zu.',
			'Er wartet dann, bis die Frist für alle abgelaufen ist und bei der Bewirtschaftung keine Mitteilung der Schlichtungsbehörde oder des Gerichts eingegangen ist; das kann einige Wochen länger dauern als die Frist.',
			'Eilt die Arbeit, darf der Beschluss ausgeführt werden, denn er gilt.',
			'Hebt ein Gericht ihn später auf, kann das Kosten oder einen Rückbau nach sich ziehen.',
			'Für die nächste Versammlung: Holen Sie vorher Vollmachten ein.',
			'Bei der Zählweise «Alle Eigentümer» wirkt jeder, der fehlt und niemanden bevollmächtigt, wie ein Nein.',
			'Am einfachsten traktandieren Sie den Antrag an der nächsten Versammlung wieder und holen vorher Vollmachten ein.',
			'Daneben steht der Weg ans Gericht offen: Bei notwendigen Arbeiten kann jeder Eigentümer verlangen, dass das Gericht sie anordnet; das Urteil ersetzt dann den Beschluss (ZGB Art. 647 Abs. 2 Ziff. 1; SVIT-Kommentar Rz. 235a ad Art. 712m, Rz. 103 ad Art. 712a).',
			'Wer nicht Nein gestimmt hat, kann zudem die Ablehnung anfechten, innert eines Monats, seit er davon weiss: wer hier oder vertreten ist, ab heute, wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75).',
			'Die Anfechtung allein hebt die Ablehnung in der Regel nur auf.',
			'Nur was sofort nötig ist, um Schaden abzuwenden, etwa bei einem Wasserschaden, darf jeder auf Kosten aller selbst veranlassen, wenn die Bewirtschaftung nicht rechtzeitig eingreift (ZGB Art. 647 Abs. 2 Ziff. 2); für alles Weitere braucht es den Beschluss oder das Gericht.',
			'Der Beschluss gilt, bis ein Gericht ihn aufhebt.',
			'Das Bundesgericht hat für diese Art von Beschluss nicht entschieden, ob alle Eigentümer zählen.',
			'Wer nicht zugestimmt hat, kann den Beschluss beim Gericht anfechten, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert eines Monats, seit er davon weiss; wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75).',
			'Die Ablehnung gilt, bis die Versammlung neu beschliesst oder ein Gericht sie aufhebt.',
			'Wer nicht Nein gestimmt hat, kann sie beim Gericht anfechten, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert eines Monats, seit er davon weiss; wer weder da noch vertreten war, in der Regel ab Erhalt des Protokolls (ZGB Art. 712m Abs. 2 i.V.m. Art. 75).',
			'Hebt das Gericht die Ablehnung auf, ist der Antrag damit nicht angenommen.',
			'Er kann an einer späteren Versammlung neu traktandiert werden, auch ohne Anfechtung.',
			'Bei notwendigen Arbeiten kann zudem jeder Eigentümer beim Gericht verlangen, dass sie angeordnet werden (ZGB Art. 647 Abs. 2 Ziff. 1).'
		]
	},
	{
		gruppe: 'Block B: REST, REST_EINFACH, Begründung und kleine Gemeinschaften (Fassung 2026-11-13)',
		ziel: 'b13',
		saetze: [
			'Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die gewöhnliche Verwaltung besorgen, etwa gemeinschaftliche Teile selbständig vermieten, verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für die Wahl das qualifizierte Mehr: Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt zu, und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
			'Hat die Bewirtschaftung nur die Aufgaben, die das Gesetz jeder Bewirtschaftung gibt (namentlich ZGB Art. 712s und 712t), bleibt es nach dem SVIT-Kommentar beim einfachen Mehr (Rz. 44 ad Art. 712m).',
			'Der SVIT-Kommentar lässt auch bei erweiterten Befugnissen das einfache Mehr genügen und nennt die Frage selbst umstritten (Rz. 46 ad Art. 712q); ein Entscheid des Bundesgerichts dazu ist uns nicht bekannt.',
			'Diese Karte verlangt deshalb das qualifizierte Mehr.',
			'Holen Sie vor der Versammlung Vollmachten ein, denn die Wertquoten der Abwesenden wirken wie ein Nein.',
			'Erreicht die Wahl nur das einfache Mehr, ist der Antrag nach dieser Karte abgelehnt; Sie können an einer weiteren, ordentlich einberufenen Versammlung mit mehr Vollmachten neu abstimmen.',
			'Ist die Gemeinschaft ohne Bewirtschaftung, etwa weil der bisherige Vertrag abgelaufen ist, kann jeder Eigentümer beim Gericht die Ernennung verlangen (ZGB Art. 712q Abs. 1).',
			'Eine Frist dafür ist nicht geklärt; vorsichtshalber handeln Sie innert eines Monats seit der Versammlung, an der die Wahl zuletzt gescheitert ist.',
			'Solange die bisherige Bewirtschaftung im Amt ist, steht dieser Weg nicht offen; läuft ihr Vertrag noch, setzen Sie die Wahl für eine Versammlung vor seinem Ende neu auf die Traktandenliste.',
			'Hält die Versammlungsleitung eine solche Wahl trotzdem als angenommen fest, gilt sie, bis ein Gericht sie aufhebt.',
			'Wer nicht zugestimmt hat, kann sie anfechten: beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert eines Monats, für Anwesende und Vertretene ab der Versammlung, für Abwesende in der Regel ab Erhalt des Protokolls.',
			'Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die gewöhnliche Verwaltung besorgen, verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für die Wahl das qualifizierte Mehr.',
			'In den Einstellungen Ihrer Gemeinschaft (Seite «Lesarten») ist gewählt, dass Votum dem SVIT-Kommentar (einem Fachbuch zum Stockwerkeigentum) folgt und das einfache Mehr genügen lässt (Rz. 46 ad Art. 712q).',
			'Wer sicher gehen will, holt vor der Versammlung Vollmachten ein und wählt trotzdem mit qualifiziertem Mehr: Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt zu, und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
			'Das Gesetz nennt die Bestellung einer Verwaltung, deren Befugnisse über die gewöhnliche Verwaltung hinausgehen, ausdrücklich bei den wichtigeren Verwaltungshandlungen (ZGB Art. 647b Abs. 1).',
			'Bei zwei Eigentümern braucht es keinen Beschluss: Jeder kann direkt klagen (ZGB Art. 649b Abs. 2).',
			'Sonst müssen die Eigentümer ohne den Beklagten mit Mehrheit beschliessen, dass geklagt wird, wenn nichts anderes vereinbart ist, etwa im Reglement (ZGB Art. 649b Abs. 2).',
			'Das gilt auch bei drei Eigentümern; das Bundesgericht sagt es ebenso, wenn auch nur in Fällen mit mehr Eigentümern (BGer 5A_447/2014 E. 3; BGer 5A_735/2019 E. 3.3.1).',
			'Der SVIT-Kommentar lässt bei drei Eigentümern jeden direkt klagen (Art. 712a Rz. 214, mit Verweis auf Piccinin); Votum folgt dem Gesetz.',
			'Bei drei Eigentümern ist der Beschluss sicher, wenn beide anderen zustimmen.',
			'Muss einer der beiden in den Ausstand treten, etwa als Ehegatte des Beklagten, ist offen, ob die Zustimmung des anderen allein genügt.',
			'In einem verwandten Fall (zwei Eigentümer, Klage der Gemeinschaft gegen den einen) liess das Bundesgericht den verbleibenden Eigentümer allein entscheiden (BGer 5A_721/2021 E. 3.3); zur Ausschlussklage ist uns dazu kein Entscheid bekannt.',
			'Lassen Sie deshalb abstimmen, auch wenn nur eine Person stimmen darf, halten Sie im Protokoll fest, wer zugestimmt hat und wer im Ausstand war, und klären Sie das Vorgehen vor der Klage mit einer Anwältin oder einem Anwalt.',
			'Wer nicht zugestimmt hat, kann eine Wahl mit nur einfachem Mehr anfechten: beim Gericht, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde.',
			'Die Frist beträgt einen Monat, für Anwesende und Vertretene ab der Versammlung, für Abwesende in der Regel ab Erhalt des Protokolls.',
			'Stellen Sie das Protokoll deshalb rasch und nachweisbar allen zu.',
			'Den Verwaltungsvertrag unterzeichnet die Gemeinschaft, wo es nicht eilt, erst, wenn die Frist für alle abgelaufen ist, also frühestens einen Monat, nachdem auch die Abwesenden das Protokoll erhalten haben.'
		]
	},
	{
		gruppe: 'Block B in der Fassung 2026-11-14 (REST und REST_EINFACH nach Abschnitt 7 und den Nachtragsrunden)',
		ziel: 'c',
		saetze: [
			'Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die gewöhnliche Verwaltung besorgen, etwa gemeinschaftliche Teile selbständig vermieten, verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für die Wahl das qualifizierte Mehr: Mehr als die Hälfte der Eigentümer stimmt zu, und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
			'Wie die Köpfe gezählt werden, steht unter «Wortlaut und Rechtsprechung».',
			'Wer sicher gehen will, holt vor der Versammlung Vollmachten ein und wählt trotzdem mit qualifiziertem Mehr: Mehr als die Hälfte aller Eigentümer stimmt zu, auch der abwesenden, und sie halten zusammen mehr als die Hälfte aller Wertquoten.',
			'Dann kommt es weder auf den Streit um das Mehr noch auf den um die Zählweise der Köpfe an.'
		]
	},
	{
		gruppe: 'Endfassung C, Vorspann ([Reglement] eingesetzt; Beleg nach «Texte nach 0047», Punkt 11)',
		ziel: 'c',
		saetze: [
			'Ihr Reglement darf eine andere Zählweise vorsehen, dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare Formulierung (BGE 144 III 510 E. 2.2.4).'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 1, übrige Sätze',
		ziel: 'c',
		saetze: [
			'Die Einstellung gilt für Beschlüsse, bei denen das Gesetz «Mehrheit aller Miteigentümer» sagt: - wer gewöhnliche Verwaltungsarbeiten in Auftrag geben darf, wenn die Versammlung das anders regelt (ZGB Art. 647a Abs. 2), - wichtigere Verwaltungshandlungen (Art. 647b Abs. 1), - notwendige bauliche Massnahmen (Art. 647c), - luxuriöse Massnahmen gegen den Willen Einzelner (Art. 647e Abs. 2).',
			'Sie gilt nicht: - bei nützlichen baulichen Massnahmen (Art. 647d): Dort zählt Votum immer die Anwesenden und Vertretenen, weil das Bundesgericht diese Zählung bestätigt hat, - bei der Ermächtigung zur Ausschlussklage: dafür gibt es eine eigene Frage auf dieser Seite, - wenn Votum eine Bestimmung Ihres Reglements anwendet.',
			'Folgt das Gericht der anderen Zählweise, hebt es ihn auf.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 2: Kartensätze',
		ziel: 'c',
		saetze: [
			'Die Köpfe zählt Votum hier unter den Anwesenden und Vertretenen; das ist die Standardeinstellung.',
			'Nach der anderen Zählweise («Alle Eigentümer») zählten alle Eigentümer, und wer fehlt, ohne eine Vollmacht zu geben, wirkte wie ein Nein.',
			'Nach der Auszählung nennt Votum auch das Ergebnis nach der anderen Zählweise.',
			'Die Köpfe zählt Votum hier unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist; die Standardeinstellung wäre die Zählung unter den Anwesenden und Vertretenen.',
			'Wer fehlt, ohne eine Vollmacht zu geben, wirkt wie ein Nein, ebenso wer im Ausstand ist, also nicht mitstimmen darf, weil es um ein Geschäft oder einen Streit zwischen ihm und der Gemeinschaft geht.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 3: Protokollzeilen',
		ziel: 'c',
		saetze: [
			'Köpfe gezählt unter den Anwesenden und Vertretenen, wie die herrschende Lehre, die Auffassung der meisten Fachleute (Vorgabe von Votum).',
			'Ob hier alle Eigentümer zählen, ist umstritten.',
			'Köpfe gezählt unter allen Eigentümern, wie es für diese Versammlung eingestellt war.',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das wäre auch die Vorgabe von Votum.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 4: 4a bis 4c',
		ziel: 'c',
		saetze: [
			// [Reglement] hinter dem Satz zu den Enthaltungen, je in 4a und in 4b.
			'Einzelne Autoren zählen alle Eigentümer, andere nur die Abstimmenden; das Bundesgericht ist beiden nicht gefolgt, Enthaltungen nennt es dabei nicht. Enthaltungen zählen nach herrschender Lehre, der Auffassung der meisten Fachleute, mit und wirken wie ein Nein; so rechnet Votum. Ihr Reglement darf eine andere Zählweise vorsehen, dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare Formulierung (BGE 144 III 510 E. 2.2.4).',
			'holen Sie dafür vor der Versammlung Vollmachten ein. Enthaltungen zählen nach herrschender Lehre mit und wirken wie ein Nein; so rechnet Votum. Ihr Reglement darf eine andere Zählweise vorsehen, dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare Formulierung (BGE 144 III 510 E. 2.2.4).',
			'Das Gesetz sagt hier «Mehrheit aller Miteigentümer».',
			'Gezählt werden trotzdem die Köpfe der Anwesenden und Vertretenen: So hat es das Bundesgericht für nützliche bauliche Massnahmen bestätigt, der herrschenden Lehre folgend (BGE 144 III 510 E. 2.2.4; SVIT-Kommentar Rz. 181 und 190 f. ad Art. 712m).',
			'Die Einstellung Ihrer Gemeinschaft zur Zählweise gilt hier deshalb nicht.',
			'Einzelne Autoren zählen alle Eigentümer, andere nur die Abstimmenden; das Bundesgericht ist beiden nicht gefolgt, Enthaltungen nennt es dabei nicht.',
			'Enthaltungen zählen nach herrschender Lehre mit und wirken wie ein Nein; so rechnet Votum.',
			'Soll diese Zählung unabhängig vom Streit gelten, gehört sie ins Reglement; dafür braucht es die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2; SVIT-Kommentar Rz. 186 ad Art. 712m) und eine klare Formulierung (BGE 144 III 510 E. 2.2.4).',
			'Das Bundesgericht hat über die Zählweise hier nicht entschieden; Näheres unter «Zu beachten».',
			'Das Bundesgericht hat diese Zählung nur für nützliche bauliche Massnahmen bestätigt (BGE 144 III 510 E. 2.2.4), für wichtigere Verwaltungshandlungen nicht entschieden.',
			'Das Bundesgericht hat nur über nützliche bauliche Massnahmen entschieden und die notwendigen Arbeiten dabei erwähnt, aber nicht beurteilt (BGE 144 III 510 E. 2.2.4).',
			'Das Bundesgericht hat nur über nützliche bauliche Massnahmen entschieden (BGE 144 III 510 E. 2.2.4); zu den luxuriösen äussert es sich nicht.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 5: Streit um die Kopfbasis',
		ziel: 'c',
		saetze: [
			'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern.',
			'Erreicht ein Antrag die Mehrheit der Anwesenden und Vertretenen, aber nicht die aller Eigentümer, weist Votum ihn als abgelehnt aus; nach der herrschenden Lehre wäre er angenommen.',
			'Bei notwendigen Arbeiten kann jeder Eigentümer beim Gericht verlangen, dass sie angeordnet werden (ZGB Art. 647 Abs. 2 Ziff. 1).'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 6: Enthaltungsklausel',
		ziel: 'c',
		saetze: [
			'Ihre Gemeinschaft hat für die Köpfe «Alle Eigentümer» eingestellt.',
			'Hier wirkt das nicht: Ihr Reglement zählt Enthaltungen beim einfachen Mehr nicht mit, und Votum wendet das an.',
			'Gezählt werden deshalb die Anwesenden und Vertretenen ohne die Enthaltungen.',
			'Gezählt nach dem Reglement: die Anwesenden und Vertretenen ohne die Enthaltungen.',
			'Die für die Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt hier nicht.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 7: Sätze des Bestands, mit «kommt es auf … nicht an» aus reglement.ts (der Satz aus entscheidbaum.ts steht in der Rückrichtung)',
		ziel: 'c',
		saetze: [
			'Die Einstellung gilt nur für das Mehr aller Wertquoten.',
			'Bei den Köpfen zählt Votum, wer im Ausstand ist, nicht mit, auch bei der Einstimmigkeit.',
			'Bei der «Mehrheit aller Miteigentümer» gilt das nicht, wenn Votum die Köpfe dort an allen Eigentümern zählt (Frage zur Zählweise der Köpfe auf dieser Seite): Dann bleibt, wer im Ausstand ist, in der Zahl aller Eigentümer und wirkt wie ein Nein.',
			'Gezählt werden nur die Köpfe, so wie es die Frage zur Zählweise der Köpfe auf dieser Seite einstellt (Vorgabe: Anwesende und Vertretene); die Wertquoten zählen nicht.',
			'SVIT-Kommentar Rz. 109 ad Art. 712a: qualifiziertes Mehr nach Köpfen und Wertquoten; wie die Köpfe zählen, stellt die Frage zur Zählweise der Köpfe ein',
			'Ein Beschluss, der das qualifizierte Mehr erreicht, besteht nach beiden Wahlen zum Mehr.',
			'Ob Votum die Köpfe dabei an allen Eigentümern zählt, stellt die Frage zur Zählweise der Köpfe auf dieser Seite ein.',
			'Erreicht ein Beschluss auch Ihre Regel, kommt es auf die Regel nicht an.',
			'Erreicht der Antrag das Mehr auch mit den Enthaltungen, kommt es auf Ihre Klausel nicht an; sonst klären Sie vor der Versammlung, wie gezählt wird.',
			'Erreicht der Beschluss auch das gesetzliche Erfordernis, kommt es auf Ihre Bestimmung nicht an; den Vergleich rechnen Sie aus dem Stimmenspiegel selbst.',
			'Erreicht er nur das mildere, halten Sie das im Protokoll fest und vollziehen Sie ihn, wo es nicht eilt, erst nach Ablauf der Anfechtungsfrist.',
			'Im Streit um die Zählweise der Köpfe sicher ist er, wenn mehr als die Hälfte aller Eigentümer zugestimmt hat.'
		]
	},
	{
		gruppe: 'Endfassung C, Abschnitt 4: {Lehre} und {Gericht} je Artikel eingesetzt',
		ziel: 'c',
		saetze: [
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt trotzdem nur die Köpfe der Anwesenden und Vertretenen (SVIT-Kommentar Rz. 166b ad Art. 712m; Handschin/Wyttenbach, S. 67 f.).',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt trotzdem nur die Köpfe der Anwesenden und Vertretenen (SVIT-Kommentar Rz. 168 und 190 f. ad Art. 712m).',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt trotzdem nur die Köpfe der Anwesenden und Vertretenen (SVIT-Kommentar Rz. 124 ad Art. 712a, Rz. 166b ad Art. 712m; Handschin/Wyttenbach, S. 67 f.).'
		]
	},
	{
		gruppe: 'Formeln der Ergebniskarte unter «Alle Eigentümer»',
		ziel: 'c',
		saetze: [
			'Mehrheit der Köpfe aller Eigentümer, auch der abwesenden; wer fehlt und keine Vollmacht gegeben hat, wirkt wie ein Nein.',
			'Mehrheit der Köpfe aller Eigentümer, auch der abwesenden, und zugleich mehr als die Hälfte aller Wertquoten (bei einem Nenner von 1000 also mindestens 501). Wer fehlt und keine Vollmacht gegeben hat, wirkt bei Köpfen und Wertquoten wie ein Nein.'
		]
	},
	{
		gruppe: 'Nachtragsrunden 1 bis 3 der Fach- und Laienprüfung, wie im Code',
		ziel: 'c',
		saetze: [
			'Ohne sie hätte Votum nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») verlangt: Mehrheit der Köpfe aller Eigentümer, auch der abwesenden; wer fehlt und keine Vollmacht gegeben hat, wirkt wie ein Nein.',
			'Ohne sie hätte Votum nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») verlangt: Mehrheit der Köpfe aller Eigentümer, auch der abwesenden, und zugleich mehr als die Hälfte aller Wertquoten (bei einem Nenner von 1000 also mindestens 501).',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt auch dort nur die Köpfe der Anwesenden und Vertretenen.',
			'Vergleichen Sie Ihre Regel mit dem Gesetz, rechnen Sie nach beiden Zählweisen.',
			'Im Streit um das Mehr sicher ist eine Ermächtigung mit dem qualifizierten Mehr.',
			'Stimmt dabei mehr als die Hälfte aller Eigentümer zu, kommt es auch auf den Streit um die Zählweise der Köpfe nicht an.',
			'Wer sicher gehen will, strebt das qualifizierte Mehr an; stimmt dabei mehr als die Hälfte aller Eigentümer zu, auch der abwesenden, kommt es auch auf den Streit um die Zählweise der Köpfe nicht an.',
			'Im Streit um das Mehr sicher wird die Ermächtigung mit dem qualifizierten Mehr an einer weiteren Versammlung; stimmt dort mehr als die Hälfte aller Eigentümer zu, kommt es auch auf die Zählweise der Köpfe nicht an.',
			'Bei den Enthaltungen zählen die Karten wie die herrschende Lehre; ein Beschluss, der so besteht, besteht auch nach der Mindermeinung.',
			'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer» in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10.',
			'Wer im Ausstand ist, hier 1 Partei, bleibt bei der Zählweise «Alle Eigentümer», wie beim ursprünglichen Beschluss, in der Zahl aller Eigentümer und wirkt wie ein Nein; die Bezugsgrösse der Kopfstimmen bleibt deshalb bei 10.',
			'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist.',
			'Dieses zweite Ergebnis zählt die Köpfe unter allen Eigentümern, wie es für diese Versammlung eingestellt war; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.',
			'Hier wirkt das am einfachen Mehr nicht: Ihr Reglement zählt Enthaltungen beim einfachen Mehr nicht mit, und Votum wendet das an.',
			'Die für die Gemeinschaft eingestellte Zählweise «Alle Eigentümer» wirkt am einfachen Mehr hier nicht; das Ergebnis nach dem qualifizierten Mehr zählt nach ihr.',
			'Das Mehr für dieses Traktandum misst sich aber an allen Eigentümern (Einstellung Ihrer Gemeinschaft).',
			'Das Mehr für dieses Traktandum misst sich aber bei den Köpfen an allen Eigentümern (Einstellung Ihrer Gemeinschaft) und bei den Wertquoten an allen Wertquoten der Gemeinschaft, auch an denen der Abwesenden (Wermelinger, Rz. 191 ad Art. 712m, zu den Wertquoten).',
			'Ein Beschluss, der das qualifizierte Mehr erreicht, besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
			'Eine Ermächtigung mit dem qualifizierten Mehr genügt beiden Wahlen zum Mehr, einfach oder qualifiziert.',
			'Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr» (Standardeinstellung: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert): mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten.',
			'Das qualifizierte Mehr ist die Standardeinstellung: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
			'Dieses Traktandum rechnet nach der Lesart «Qualifiziertes Mehr» (Standardeinstellung: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert): mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten.',
			'Dieses Traktandum rechnet nach der Lesart «Einfaches Mehr», die für Ihre Gemeinschaft eingestellt ist (die Standardeinstellung wäre die andere: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert): mehr als die Hälfte der Anwesenden oder Vertretenen.',
			'Die Standardeinstellung wäre das qualifizierte Mehr: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
			'Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.',
			'Das kann das Gericht nur, wenn ein Eigentümer innert der Anfechtungsfrist anficht, dann aber auch Monate später, während der Prozess schon läuft.',
			'Sagen Sie vor der Abstimmung an, wie Enthaltung und fehlende Stimme zählen, und fragen Sie vor dem Schliessen nach, wer noch nicht abgestimmt hat.',
			'Am Ergebnis, das Sie verkünden, ändert die Wertquote im Ausstand nichts.',
			'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») gälte mehr als die Hälfte aller Eigentümer, gleich wer erscheint; nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach.',
			'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre er abgelehnt: 5 Ja von 10 Kopfstimmen, nötig 6.',
			'Nach der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe («Alle Eigentümer») wäre das Ergebnis dasselbe.',
			'So zählt auch der Wortlaut des Gesetzes.',
			'Die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen; das Bundesgericht hat für diese Art von Beschluss nicht entschieden.',
			'Ein angenommener Beschluss, dem nicht mehr als die Hälfte aller Eigentümer zugestimmt hat, kann angefochten werden.',
			'Nach dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, gälte mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten; nach der Auszählung nennt Votum Ihnen auch das Ergebnis danach.',
			'Das gewählte Mehr ist in mindestens einem Punkt milder: Ein angenommener Beschluss, der das Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, verfehlt, kann angefochten werden.',
			'Nach dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet (mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten), wäre er abgelehnt: 5 Ja von 10 Kopfstimmen, nötig 6; 600 Ja von 1000 Wertquoten, nötig 501.',
			'Führen Sie ihn deshalb erst aus, wenn diese Fristen ohne Anfechtung abgelaufen sind, oder stellen Sie den Antrag an einer weiteren Versammlung erneut, mit dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, in der Einladung.',
			'Nach dem Mehr, das Votum aus Gesetz, Reglement und der Einstellung Ihrer Gemeinschaft zur Zählweise der Köpfe herleitet, wäre das Ergebnis dasselbe.',
			'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, wie am Beschluss selbst; die herrschende Lehre zählt nur die Anwesenden und Vertretenen.',
			'Dieser Hinweis gilt, wenn die Ermächtigung mit dem einfachen Mehr angenommen wurde, etwa weil Ihre Gemeinschaft es so eingestellt hat; nicht nach einer Ablehnung, auch wenn das einfache Mehr erreicht war.',
			'Bei den Beschlüssen nach Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e Abs. 2 gilt dazu: Im Streit um die Zählweise der Köpfe sicher ist er, wenn mehr als die Hälfte aller Eigentümer zugestimmt hat.'
		]
	},
	{
		gruppe: 'Endfassungen B und C, Rückrichtung: zitierte Sätze mit Auslassung, Platzhalter oder aus dem Bestand von Abschnitt 7',
		ziel: 'c',
		saetze: [
			// Mit dem, was die andere Zählweise verlangt (Auftrag «Texte nach 0047», Punkt 3a); dahinter folgen die Wertquoten.
			'(«Anwesende und Vertretene»: mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag angenommen gewesen',
			'Nach der anderen Zählweise («Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen: 5 Ja von 10 Kopfstimmen, nötig 6',
			'Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt; holen Sie dafür vor der Versammlung Vollmachten ein.',
			'Die Einstellung Ihrer Gemeinschaft, die Köpfe an allen Eigentümern zu zählen, ist keine Bestimmung Ihres Reglements und bindet ein Gericht nicht.',
			'Ihre Gemeinschaft hat eine solche Zählweise eingestellt (Art. 12 Abs. 3 Reglement (erfunden)); Votum zählt hier deshalb ohne Enthaltungen, siehe oben und den Absatz zum Reglement.',
			'Anders auch bei der Ermächtigung zur Ausschlussklage: Ob Angehörige des Beklagten im Ausstand dort in der Zahl bleiben, stellt eine eigene Frage auf dieser Seite ein, solange Votum dort keine Bestimmung Ihres Reglements anwendet.',
			'An einer anderen Stelle verlangt er für denselben Beschluss das qualifizierte Mehr nach Köpfen und Wertquoten (Rz. 109 ad Art. 712a).',
			'Es braucht die Mehrheit nach Köpfen, gezählt, wie es die Frage zur Zählweise der Köpfe einstellt (Vorgabe: Anwesende und Vertretene), und dazu mehr als die Hälfte aller Wertquoten.',
			'Diese Zählung wendet der SVIT-Kommentar beim Stockwerkeigentum nicht an (Rz. 166b ad Art. 712m), ebenso Handschin/Wyttenbach (S. 68).',
			'Ob Votum die Köpfe trotzdem an allen Eigentümern zählt, wird auf der Seite «Lesarten» eingestellt; Vorgabe sind die Anwesenden und Vertretenen.',
			'Erreicht das Ja auch mehr als die Hälfte, wenn Sie die Enthaltungen mitzählen, kommt es auf diese Bestimmung nicht an.',
			'Sonst ist der Beschluss angreifbarer als andere; ist die Sache nicht dringlich, vergeben Sie den Auftrag erst nach Ablauf der Anfechtungsfrist von einem Monat; für Abwesende ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten haben.',
			'Ist sie in einem Punkt strenger und in einem anderen milder, rechnet es nach dem Gesetz und nennt Ihre Regel dazu, ohne nach ihr zu rechnen; erreicht ein Beschluss beide, kommt es auf den Unterschied zwischen Ihrer Regel und dem Gesetz nicht an.',
			'Erreicht ein Beschluss nur das mildere Mehr einer solchen Bestimmung, gilt er nach dem Kommentar; erreicht er auch das Mehr des Gesetzes, kommt es auf diesen Streit nicht an.',
			'Auch eine höhere Zahl kann weniger verlangen als das Gesetz: «Zwei Drittel der Anwesenden» zählt nur Köpfe; nach dem Gesetz braucht es neben der Mehrheit nach Köpfen mehr als die Hälfte aller Wertquoten.',
			'Eine Ermächtigung, die das qualifizierte Mehr erreicht, besteht nach beiden Wahlen zum Mehr.'
		]
	},
	{
		gruppe: 'Block D, nach der Laienprüfung gefasst (Inhalt N3-F-1/N3-F-2, Formulierung D-L-1/D-L-2; pruefung/README.md, Ablauf 3)',
		ziel: 'c',
		saetze: [
			'Das Ergebnis danach zählt die Köpfe unter allen Eigentümern, wie es für Ihre Gemeinschaft eingestellt ist; die herrschende Lehre, die Auffassung der meisten Fachleute, zählt nur die Anwesenden und Vertretenen.',
			// Seit der Textrunde zu den Pendenzen nach Regel 43 (Endfassung 14.11.2026, T7a, T7c, T7e;
			// R3-F-1): auch unter einer von der Leitung gesetzten Basis aller, «Wer im Ausstand ist».
			'Stimme zählt bei DIESEM Traktandum nicht: im Ausstand. Brauchen Sie selten; im Zweifel keine 9 setzen und den Zweifel im Protokoll festhalten. Setzen Sie die 9 auch dort, wo die Köpfe unter allen Eigentümern zählen, nach der Einstellung Ihrer Gemeinschaft oder weil die Sitzungsleitung das Mehr so gesetzt hat. Wer im Ausstand ist, bleibt dann in der Zahl aller Eigentümer und wirkt wie ein Nein. Die Mappe weiss, bei welchen Traktanden das gilt, und rechnet es selbst.',
			'Stimme zählt bei **diesem** Traktandum nicht (Ausstand, oder unmittelbar betroffen, wo die Zeile «Unmittelbar Betroffene» «stimmen nicht mit» sagt). Wer im Ausstand ist, bleibt trotzdem in der Zahl aller Eigentümer und wirkt wie ein Nein, wo Ihre Gemeinschaft die Köpfe unter allen Eigentümern zählt (Seite «Lesarten», Frage zur Zählweise der Köpfe, Lesart L13) oder die Sitzungsleitung dieses Mehr selbst so gesetzt hat. Setzen Sie die 9 trotzdem; die Mappe rechnet das selbst.',
			'Ausnahme: Zählt Ihre Gemeinschaft die Köpfe unter allen Eigentümern (Seite «Lesarten», Frage zur Zählweise der Köpfe, Lesart L13) oder hat die Sitzungsleitung das Mehr selbst so gesetzt, stimmt, wer im Ausstand ist, nicht mit, bleibt aber in der Zahl aller Eigentümer und wirkt wie ein Nein.'
		]
	}
];

describe('Geprüfter Wortlaut der Endfassungen Block B und C (Entscheid 0048)', () => {
	let texte: Record<Ziel, string> = { b13: '', c: '', l4: '', l13: '' };
	beforeAll(async () => {
		texte = await erzeugteTexte();
	}, 60_000);

	it('der erzeugte Text entsteht', () => {
		expect(texte.c.length).toBeGreaterThan(100_000);
		expect(texte.b13.length).toBeGreaterThan(10_000);
	});

	it.each(GRUPPEN)('$gruppe', ({ ziel, saetze }) => {
		expect(saetze.length).toBeGreaterThan(0);
		const text = texte[ziel];
		const fehlen = saetze.filter((s) => !text.includes(s));
		expect(fehlen, 'Sätze ohne Treffer im erzeugten Text').toEqual([]);
	});

	it('hält die Zahl der Sätze fest, damit keine Gruppe still schrumpft', () => {
		expect(GRUPPEN.reduce((n, g) => n + g.saetze.length, 0)).toBe(248);
	});
});

// ── «Texte nach 0047»: je Punkt der neue Satz und der alte ──────────────────

const WURZEL = join(__dirname, '..', '..');
/**
 * Ein Text des Baums, flach: ohne Zitatmarken des Handbuchs und ohne Verkettung
 * über Zeilen, wie `normalisiere` in `abgeloeste-wortlaute.test.ts` (nicht
 * eingebunden, sonst liefen dessen Tests hier ein zweites Mal).
 */
const datei = (pfad: string) =>
	readFileSync(join(WURZEL, pfad), 'utf8')
		.replace(/\n[ \t]*>[ \t]?/g, '\n')
		.replace(/(['"`])\s*\+\s*(?:\/\/[^\n]*\n\s*)*(['"`])/g, '')
		.replace(/\s+/g, ' ');
const NEU = holeRegelwerk('2026-11-15');
const NEU_TEXT = JSON.stringify(NEU);
const knoten = (id: string) => NEU.knoten.find((k) => k.id === id)!;
/** Ein zweites Ergebnis nach L10, so wie die Zählung es bildet (5 Ja von 9 nach der anderen Wahl). */
const L10_ZWEITES = (angenommen: boolean): ErgebnisNachAndererLesart => ({
	kennung: 'L10',
	eigeneWahl: 'Bleiben in der Zahl',
	wahl: 'Fallen aus der Zahl',
	verlangt: 'die Rechnung ohne die Angehörigen',
	feststellbar: true,
	angenommen,
	koepfe: { ja: 5, basis: 9, schwelle: 5, erreicht: angenommen },
	quoten: null,
	abweichend: true
});
/** Die Dateien im Kern, in denen ein abgelöster Satz nicht mehr stehen darf. */
const KERN = [
	'src/lib/domain/auszaehlung.ts',
	'src/lib/domain/lesarten.ts',
	'src/lib/domain/reglement.ts',
	'src/lib/domain/nutzniessung.ts',
	'src/lib/components/GemeinschaftFormular.svelte',
	'docs/versammlung-fuehren.md'
];
const imKern = (satz: string) => KERN.filter((p) => datei(p).includes(satz));

describe('«Texte nach 0047», die zwölf Punkte', () => {
	it('1: die Protokollzeile sagt, wie Votum gerechnet hat, nicht was galt', () => {
		const k = knoten('k-prozessfuehrung');
		const e = wendeLesartAn(erfordernisAusKnoten(NEU, k), { ...LESARTEN_VORGABE, L11: 'einfach' });
		expect(lesartProtokollsatz(e)).toContain(`${GERECHNET_NACH_EINSTELLUNG}. Die Standardeinstellung wäre`);
		expect(GERECHNET_NACH_EINSTELLUNG).toBe('So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet');
		expect(imKern('galt für diese Versammlung nach der Einstellung')).toEqual([]);
	});

	it('2: die PDFs nennen ein zweites Ergebnis nur, wo das Protokoll es nennt; das Handbuch sagt es', () => {
		for (const pdf of [
			'src/lib/server/pdf/auswertung.ts',
			'src/lib/server/pdf/stimmnachweis.ts',
			'src/routes/versammlungen/[id=kennung]/auswertung/+page.svelte'
		]) {
			expect(datei(pdf), pdf).toMatch(/andereLesartenVon\([^)]*\)\s*\.filter\(zweitesErgebnisImProtokoll\)/);
		}
		const hb = datei('docs/versammlung-fuehren.md');
		expect(hb).toContain(
			'Protokoll, Auswertung und Stimmnachweis nennen das Ergebnis nach der anderen Lesart an denselben Stellen: bei den meisten Lesarten immer, auch wenn es gleich ausfällt, bei L8, L9 und L10 nur, wenn es abweicht oder sich nicht bestimmen lässt.'
		);
		expect(hb).not.toContain('und das Protokoll hält es fest; dann kann der Beschluss angefochten werden');
	});

	it('3: «nach der anderen Lesart» erklärt, was verkündet ist und gilt (L10)', () => {
		const ablehnung = andereLesartInWorten(L10_ZWEITES(true), false);
		expect(ablehnung.protokoll).toContain(
			`(«Fallen aus der Zahl»: die Rechnung ohne die Angehörigen), ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre der Antrag angenommen gewesen`
		);
		expect(AUSLEGUNG_EBENFALLS_VERTRETEN).toBe('einer Auslegung, die ebenfalls in Frage kommt');
		expect(ablehnung.leitung).toContain(`${ZAEHLBASIS_VERKUENDET} ${lesartVon('L10')!.verkuendetNachAblehnung} `);
		expect(lesartVon('L10')!.verkuendetNachAblehnung).toBe(
			'Eine Ermächtigung, die die Mehrheit nur ohne die Angehörigen erreicht, kann angefochten werden, und wird sie aufgehoben, scheitert die Ausschlussklage.'
		);
		const annahme = andereLesartInWorten(L10_ZWEITES(false), false);
		expect(annahme.protokoll).toContain('Verkündet ist die Ermächtigung; sie gilt, bis ein Gericht sie aufhebt.');
		expect(annahme.leitung).not.toContain(ZAEHLBASIS_VERKUENDET);
		expect(ZAEHLBASIS_VERKUENDET).toBe('Verkündet wird nach der Einstellung Ihrer Gemeinschaft die Ablehnung:');
		expect(imKern('Die Ermächtigung kann angefochten werden: Wer nicht zugestimmt hat')).toEqual([]);
	});

	it('3a: hinter dem Doppelpunkt keine Klammer in der Klammer, an L12 und L6 «Klausel anwenden» der Katalog', () => {
		const zweites = (kennung: string, wahl: string, verlangt: string): ErgebnisNachAndererLesart => ({
			...L10_ZWEITES(true),
			kennung,
			eigeneWahl: 'eigene',
			wahl,
			verlangt
		});
		// Strichform am Satzende (Codeprüfung Lauf 2, N2): einfaches Mehr an Art. 647c unter «Alle Eigentümer».
		const notwendig = erfordernisAusKnoten(NEU, knoten('k-baulich-notwendig'));
		const alle = erfordernisInWorten(mitKopfzaehlweise({ ...notwendig, kopfbasis: 'alle_eigentuemer' as const }, 'alle'));
		expect(alle).toMatch(/ — unabhängig davon, wer erscheint$/);
		expect(andereLesartInWorten(zweites('L13', 'Alle Eigentümer', alle), false).protokoll).toContain(
			`(«Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden), ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre`
		);
		// Klammerform vor «und» (R3-L-1).
		const mitQuoten = 'mehr als die Hälfte aller Eigentümer (unabhängig davon, wer erscheint) und mehr als die Hälfte aller Wertquoten';
		expect(andereLesartInWorten(zweites('L13', 'Alle Eigentümer', mitQuoten), false).protokoll).toContain(
			'(«Alle Eigentümer»: mehr als die Hälfte aller Eigentümer, auch der abwesenden, und mehr als die Hälfte aller Wertquoten), '
		);
		// L12 in beiden Richtungen und L6 «Klausel anwenden» nach dem Katalog (R3-L-2; Codeprüfung Lauf 2, N1;
		// Featureprüfung M2). L6 «Nach dem Gesetz» behält die Formel des Mehrs.
		const gesetz = lesartVon('L6')!.wahlen.find((x) => x.wert === 'gesetz')!;
		const formel = 'mehr als die Hälfte der Anwesenden oder Vertretenen und mehr als die Hälfte aller Wertquoten';
		expect(andereLesartInWorten(zweites('L6', gesetz.bezeichnung, formel), false).protokoll).toContain(
			`(«${gesetz.bezeichnung}»: ${formel}), ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre`
		);
		for (const [kennung, wert] of [['L6', 'klausel'], ['L12', 'alle'], ['L12', 'anwesende']] as const) {
			const w = lesartVon(kennung)!.wahlen.find((x) => x.wert === wert)!;
			const satz = andereLesartInWorten(zweites(kennung, w.bezeichnung, 'alle Stimmen der Formel'), false).protokoll!;
			expect(satz, `${kennung} ${wert}`).toContain(`(«${w.bezeichnung}»: ${w.imSatz}), ${AUSLEGUNG_EBENFALLS_VERTRETEN}, wäre`);
		}
	});

	it('4: L10 erklärt die gemeinsame Wohnung des Beklagten', () => {
		const geltung = lesartVon('L10')!.geltung!;
		expect(geltung).toContain(
			'Richtet sich der Antrag nur gegen ihn, bleibt sie nach beiden Wahlen in der Zahl und wirkt wie ein Nein, denn Art. 649b Abs. 2 nimmt nur den Beklagten aus.'
		);
		expect(geltung).toContain(
			'Ob deren Grund (wer nicht stimmen darf, zählt nicht mit) auch eine solche Wohnung erfasst, ist offen; Votum hält sich hier an den Wortlaut des Gesetzes und rechnet strenger.'
		);
		expect(geltung).not.toContain('stimmt in jeder Lesart nicht; wie sie in der Zahl steht');
	});

	it('5: die Maske sagt, wann L10 an einem selbst gesetzten Mehr wirkt', () => {
		const e = erfordernisAusKnoten(NEU, knoten('k-ausschlussklage'));
		expect(angehoerigeBeimSetzen(e)).toBe(ANGEHOERIGE_BEIM_SETZEN);
		// Kein Satz für ältere Fassungen: Die Maske leitet nach der aktuellen her (Runde 2, R2-F-1).
		expect(angehoerigeBeimSetzen({ ...e, fassung: '2026-11-03' })).toBeNull();
		// Wörtlich, alle Sätze (Featureprüfung N1).
		expect(ANGEHOERIGE_BEIM_SETZEN).toBe(
			'Behalten Sie hier den Vorschlag, gilt weiter die Einstellung Ihrer Gemeinschaft, ob die Angehörigen des Beklagten im Ausstand in der Zahl bleiben. ' +
				'Wählen Sie eine andere Zählung, gilt die Einstellung nicht. ' +
				'Unter «Mehrheit aller Eigentümer, auch der abwesenden» zählen alle ausser dem Beklagten, auch seine Angehörigen im Ausstand; sie wirken wie ein Nein. ' +
				'Unter «Mehrheit der anwesenden oder vertretenen» zählt niemand mit, der im Ausstand ist. ' +
				'Eine Ermächtigung, die nur die Mehrheit der Anwesenden erreicht, kann aber angefochten werden, und wird sie aufgehoben, scheitert die Ausschlussklage.'
		);
		// Verdrahtung Server → Maske: dieselbe Kette wie die Seite (`wendeReglementAn` über dem Vorschlag), Wert
		// nicht null an k-ausschlussklage ab Fassung 2026-11-10, und der Server reicht ihn durch.
		const angewandt = wendeReglementAn(e, [], null, LESARTEN_VORGABE);
		expect(angehoerigeBeimSetzen(angewandt.erfordernis)).toBe(ANGEHOERIGE_BEIM_SETZEN);
		expect(angehoerigeBeimSetzen({ ...angewandt.erfordernis, fassung: '2026-11-10' })).toBe(ANGEHOERIGE_BEIM_SETZEN);
		expect(datei('src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.server.ts')).toContain(
			'angehoerigeBeimSetzen: angehoerigeBeimSetzen(angewandt.erfordernis),'
		);
		expect(imKern('Dieses Traktandum stammt aus einer Fassung vor der Einstellung zu den Angehörigen')).toEqual([]);
		expect(angehoerigeBeimSetzen({ ...e, kopfbasis: 'anwesend_vertreten' })).toBeNull();
		expect(angehoerigeBeimSetzen(erfordernisAusKnoten(NEU, knoten('k-prozessfuehrung')))).toBeNull();
		expect(datei('src/routes/versammlungen/[id=kennung]/traktanden/[traktandumId]/erfordernis/+page.svelte')).toContain(
			'{data.stand.angehoerigeBeimSetzen}'
		);
	});

	it('6: die Auswertung nennt die eingewendete Bestimmung', () => {
		expect(einwandInDerAuswertung('Art. 9 Abs. 2 Reglement (erfunden): Bauliches braucht zwei Drittel.')).toBe(
			'Eingewendet wurde diese Bestimmung: «Art. 9 Abs. 2 Reglement (erfunden): Bauliches braucht zwei Drittel». ' +
				`${EINWAND_GESETZ_UND_BESTIMMUNG} ${EINWAND_AUSWERTUNG_VERWEIS} ${EINWAND_AUSWERTUNG_FRIST}`
		);
		expect(EINWAND_GESETZ_UND_BESTIMMUNG).toBe(
			'Nach dem Gesetz hätte der Antrag das nötige Mehr erreicht, nach dieser Bestimmung nicht.'
		);
		expect(EINWAND_AUSWERTUNG_VERWEIS).toBe(
			'Weshalb die Sitzungsleitung sie angewandt hat und wie die Ablehnung angefochten werden kann, steht im Protokoll.'
		);
		expect(EINWAND_AUSWERTUNG_FRIST).toBe(
			'Die Frist dafür beträgt einen Monat, seit man davon weiss. Für Anwesende und Vertretene beginnt sie mit der Versammlung, für alle anderen in der Regel mit dem Erhalt des Protokolls.'
		);
		expect(datei('src/lib/server/pdf/auswertung.ts')).toContain('einwandInDerAuswertung(einwand)');
		expect(datei('src/routes/versammlungen/[id=kennung]/auswertung/+page.svelte')).toContain('einwandInDerAuswertung(');
	});

	it('7: an der Prozessführung beraten die Angehörigen nicht mit, wie auf der Website', () => {
		const hinweise = JSON.stringify(knoten('k-prozessfuehrung'));
		expect(hinweise).toContain(`${ANGEHOERIGE_BERATUNG} ${VOLLMACHT_AN_IHN}`);
		expect(hinweise).not.toContain('Seine Angehörigen stimmen nur nicht mit.');
		expect(ANGEHOERIGE_BERATUNG).toBe(
			'Seine Angehörigen stimmen nicht mit. Ob sie an der Beratung teilnehmen dürfen, hat kein Gericht entschieden; sicher ist, sie wie ihn vorher anzuhören und an der Beratung danach nicht teilnehmen zu lassen.'
		);
		expect(VOLLMACHT_AN_IHN).toBe(
			'Wer ihm oder einem seiner Angehörigen eine Vollmacht gegeben hat, zählt bei dieser Abstimmung wie ein Abwesender (BGE 134 III 481 E. 3.8). Klären Sie das möglichst schon mit der Einladung, damit die Vollmacht einer anderen Person gegeben werden kann.'
		);
		// Die Website setzt dieselben zwei Konstanten in ihren Wortlaut (`UMFORMULIERUNGEN`, Schlüssel `GEGEN_EIGENTUEMER`).
		const exportskript = readFileSync(join(WURZEL, 'scripts/quorumsbaum-export.mjs'), 'utf8');
		expect(exportskript).toContain('`${ANGEHOERIGE_BERATUNG} ` +');
		expect(exportskript).toContain('`${VOLLMACHT_AN_IHN} Bei den Wertquoten zählt trotzdem das Ganze, ` +');
		// Das Handbuch rät wie die Karte (Codeprüfung Lauf 1, M1).
		expect(datei('docs/versammlung-fuehren.md')).toContain(`Abstimmung nimmt er nicht teil. ${ANGEHOERIGE_BERATUNG} ${VOLLMACHT_AN_IHN}`);
		expect(imKern('Seine Angehörigen stimmen nur nicht mit.')).toEqual([]);
		expect(datei('scripts/quorumsbaum-export.mjs')).not.toContain('kann (BGE 134 III 481 E. 3.8; Rz. 150 ad Art. 712m)');
	});

	it('8: die Bedingung «alle oder Begründungsakt» ohne Rz. 84', () => {
		for (const id of ['k-bewirtschaftung-erweitert', 'k-verwaltung-wichtig']) {
			expect(knoten(id).reglementsrecht, id).toContain(BELEG_712G);
			expect(knoten(id).reglementsrecht, id).not.toContain('78a und 84');
		}
		expect(BELEG_712G).toBe('(ZGB Art. 712g Abs. 2; SVIT-Kommentar Rz. 78 und 78a ad Art. 712g)');
		expect(datei('scripts/quorumsbaum-export.mjs')).not.toContain('Rz. 35, 76, 78, 78a, 84, 91');
	});

	it('9: bei den Wertquoten ist der Eigentümer die Vorgabe von Votum', () => {
		const ohne = { holderName: 'Erna Beispiel', hasAgreement: false };
		const wq = knoten('k-wertquoten-aendern');
		expect(stimmrechtBeiNutzniessung(ohne, wq.geschaeftsart, wq.id).satz).toContain(
			'Ohne Absprache stimmt nach der Vorgabe von Votum der **Eigentümer**, nicht Erna Beispiel; geklärt ist das bei den Wertquoten nicht. Sicher ist, wenn beide vorher vereinbaren, wer stimmt, oder beide gleich abstimmen.'
		);
		const auf = knoten('k-aufhebung');
		expect(stimmrechtBeiNutzniessung(ohne, auf.geschaeftsart, auf.id).satz).toContain('Ohne Absprache stimmt deshalb der **Eigentümer**');
		expect(datei('docs/versammlung-fuehren.md')).toContain(
			'Dass dort der Eigentümer stimmt, ist eine Vorgabe von Votum, kein gesichertes Recht.'
		);
	});

	it('10: eine Klausel mit zu wenig Stimmen: nicht geklärt, nicht «in der Regel trotzdem»', () => {
		expect(datei('src/lib/domain/reglement.ts')).toContain('${KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN}');
		expect(datei('src/lib/domain/reglement.ts')).toContain('${KLAUSEL_MIT_WENIGER_OFFEN}');
		expect(datei('src/lib/domain/reglement.ts')).toContain('${KLAUSEL_SICHER}');
		expect(datei('src/lib/components/GemeinschaftFormular.svelte')).toContain(
			'{KLAUSEL_MIT_WENIGER_OFFEN} Votum kann beides nicht prüfen. Die Fundstelle steht deshalb bei jedem Beschluss, der so gezählt wird. {KLAUSEL_SICHER}'
		);
		expect(KLAUSEL_MIT_WENIGER_OFFEN).toBe(
			'Ob sie trotzdem gilt, wenn sie mit weniger beschlossen und nicht innert Frist angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4 (dort zum Wechsel von Köpfen zu Anteilen).'
		);
		expect(KLAUSEL_SICHER).toBe('Sicher ist ein Beschluss, der das Mehr auch erreicht, wenn die Enthaltungen wie ein Nein zählen.');
		// Fachprüfung Runde 3, R3-F-1: was der Fall war, dann was das Gericht entschied.
		expect(KLAUSEL_MIT_WENIGER_STIMMEN_OFFEN).toBe(
			'Ob sie trotzdem gilt, wenn sie mit weniger Stimmen eingeführt und nicht innert Frist angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4. Dort hatte eine Gemeinschaft ohne Einstimmigkeit von Köpfen auf Anteile umgestellt. Das Bundesgericht hielt das nur für anfechtbar, nicht für nichtig, also für wirksam, wenn niemand es rechtzeitig anficht. Die Lehre ist geteilt.'
		);
		expect(lesartVon('L11')!.geltung).toContain(
			'Ob die Bestimmung trotzdem gilt, wenn sie mit weniger Stimmen eingeführt und nicht innert Frist angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4 (dort zum Wechsel von Köpfen zu Anteilen).'
		);
		expect(datei('docs/versammlung-fuehren.md')).toContain(
			'Ob sie trotzdem gilt, wenn sie mit weniger beschlossen und nicht innert Frist angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4'
		);
		expect(datei('docs/versammlung-fuehren.md')).toContain(`Solange die Frist läuft, bleibt sie anfechtbar. Votum kann beides nicht prüfen. ${KLAUSEL_SICHER}`);
		expect(imKern('in der Regel trotzdem')).toEqual([]);
		// Dieselbe Aussage in anderen Worten, an der Ausschlussklage (Featureprüfung M1): neue Fassung, Kern, Handbuch, Export.
		expect(imKern('in der Regel nicht weg')).toEqual([]);
		expect(NEU_TEXT).not.toContain('in der Regel nicht weg');
		expect(datei('scripts/quorumsbaum-export.mjs')).not.toContain('in der Regel nicht weg');
		expect(JSON.stringify(knoten('k-ausschlussklage'))).toContain(KLAUSEL_AUSSCHLUSS);
		expect(KLAUSEL_AUSSCHLUSS).toBe(
			'(Art. 712m Rz. 186). Ob sie trotzdem gilt, wenn sie ohne Einstimmigkeit ins Reglement kam und nicht rechtzeitig angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4: Dort hielt das Bundesgericht einen Wechsel von Köpfen zu Anteilen, der ohne Einstimmigkeit beschlossen worden war, nur für anfechtbar. Für eine Bestimmung zu diesem Mehr hat kein Gericht entschieden.'
		);
		expect(datei('docs/versammlung-fuehren.md')).toContain(`einstimmig beschlossen werden ${KLAUSEL_AUSSCHLUSS} Eine neue Bestimmung`);
		// Fachprüfung Nachtrag 2: Der Übergang «Ob das auch …» fällt an der Karte, im Handbuch und auf der Website weg.
		const uebergang = 'Ob das auch für eine Bestimmung zu diesem Mehr gilt';
		expect(JSON.stringify(knoten('k-ausschlussklage'))).not.toContain(uebergang);
		expect(datei('docs/versammlung-fuehren.md')).not.toContain(uebergang);
		// Die Teilzeichenketten des Kastens verbunden, damit der Zeilenumbruch im Quelltext nicht zählt.
		const export_ = readFileSync(join(WURZEL, 'scripts/quorumsbaum-export.mjs'), 'utf8').replace(/' \+\n\s*(?:\/\/[^\n]*\n\s*)*'/g, '');
		expect(export_).toContain(
			// Textrunde zu den Pendenzen nach Regel 43 (Endfassung 14.11.2026, T5): mit dem Beleg zur Einführung.
			'(ZGB Art. 712g Abs. 2; SVIT-Kommentar Rz. 27 und 78a ad Art. 712g). Ob sie trotzdem gilt, wenn sie mit weniger ins Reglement kam und nicht rechtzeitig angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4: Dort hielt das Bundesgericht einen Wechsel von Köpfen zu Anteilen ohne Einstimmigkeit nur für anfechtbar. Für dieses Mehr hat kein Gericht entschieden. Der SVIT-Kommentar'
		);
		expect(export_).not.toContain('Ob das für dieses Mehr gilt');
		// Der zweite Website-Satz, «Zu beachten» an der Ausschlussklage (UMFORMULIERUNG), wörtlich mit dem Satz
		// davor und danach (Featureprüfung NN1): Platzhalter eingesetzt, Teilzeichenketten verbunden.
		const hinweisWebsite = readFileSync(join(WURZEL, 'scripts/quorumsbaum-export.mjs'), 'utf8')
			.replaceAll('${KLAUSEL_AUSSCHLUSS}', KLAUSEL_AUSSCHLUSS)
			.replace(/[`'] \+\n\s*(?:\/\/[^\n]*\n\s*)*[`']/g, '');
		expect(hinweisWebsite).toContain(
			'Eine Abweichung von der gesetzlichen Zählweise muss zudem einstimmig beschlossen werden (Art. 712m Rz. 186). Ob sie trotzdem gilt, wenn sie ohne Einstimmigkeit ins Reglement kam und nicht rechtzeitig angefochten wurde, ist nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4: Dort hielt das Bundesgericht einen Wechsel von Köpfen zu Anteilen, der ohne Einstimmigkeit beschlossen worden war, nur für anfechtbar. Für eine Bestimmung zu diesem Mehr hat kein Gericht entschieden. Steht in Ihrem Reglement eine abweichende Bestimmung, klären Sie ihre Geltung vor der Versammlung.'
		);
	});

	it('11: die Zählweise im Reglement mit Rz. 186 und BGE 144 III 510, nicht mit E. 4.2.3', () => {
		expect(REGLEMENT_SATZ.endsWith(BELEG_REGLEMENT)).toBe(true);
		for (const text of [NEU.wortlautErklaerung, ...Object.values(NEU.wortlautErklaerungJeArtikel ?? {}), ...Object.values(NEU.wortlautErklaerungJeArtikelAlle ?? {})]) {
			expect(text).toContain(BELEG_REGLEMENT);
		}
		expect(NEU_TEXT).not.toContain('537 E. 4.2.3');
	});

	it('12: beide Gegenmeinungen, Enthaltungen nach herrschender Lehre', () => {
		const art647d = NEU.wortlautErklaerungJeArtikel!['ZGB Art. 647d Abs. 1'];
		expect(art647d).toContain(`${GEGENMEINUNG_647D} ${ENTHALTUNG_SATZ_647D}`);
		for (const [artikel, text] of Object.entries(NEU.wortlautErklaerungJeArtikel ?? {})) {
			if (artikel !== 'ZGB Art. 647d Abs. 1') expect(text, artikel).toContain(ENTHALTUNG_SATZ);
		}
		expect(NEU_TEXT).not.toContain('Einzelne Autoren zählen alle Eigentümer; das Bundesgericht ist ihnen');
		expect(NEU_TEXT).not.toContain(' Enthaltungen zählen mit und wirken wie ein Nein.');
		expect(ENTHALTUNG_IM_WORTLAUT_AB_2026_11_15).toBe(` ${ENTHALTUNG_SATZ}`);
		const l13 = JSON.stringify(lesartVon('L13'));
		expect(l13).toContain('andere nur die Eigentümer, die abstimmen; beide Ansichten nennt BGE 144 III 510 E. 2.2.4');
		expect(l13).toContain('Wer nur die Abstimmenden zählt, lässt Enthaltungen weg (SVIT-Kommentar Rz. 181 ad Art. 712m).');
		expect(l13).toContain('Ch. Müller und K. Müller zählen nur die Abstimmenden');
		expect(l13).not.toContain('Enthaltungen zählen in beiden Fällen mit und wirken wie ein Nein');
	});
});

// ── Textrunde zu den Pendenzen nach Regel 43: die Endwortlaute T1 bis T7e ───

/*
 * Endfassung `quellen` `pruefung/zu-pruefen-2026-11-14-votum-pendenzen-textrunde-endfassung.md`,
 * Abschnitt «Endwortlaut», nach drei Runden Laien- und Fachprüfung. Je Stelle
 * der neue Satz und, wo er einen ersetzt, der alte. T4 und T7d mit Punkt statt
 * Strichpunkt bzw. in zwei Sätzen (`check:texte`, 180 Zeichen); T6b, T7a und
 * T7c binden `nutzniessung-stimmrecht.test.ts`, `auszaehlmappe.test.ts` und
 * die Gruppe «Block D» oben.
 */
describe('Textrunde zu den Pendenzen nach Regel 43 (Endfassung 14.11.2026)', () => {
	const hb = datei('docs/versammlung-fuehren.md');
	const rw16 = holeRegelwerk('2026-11-16');

	it('T1: Handbuch zu L13 und der Freigabe', () => {
		expect(hb).toContain(
			'Die Einstellung kann das Mehr ändern: Stellen Sie um, nachdem ein Traktandum schon ein Erfordernis hat, und ändert sich dadurch seine Zählung, ziehen Sie es auf der Seite «Lesarten» nach (Knopf «Erfordernis neu herleiten»); vorher lässt sich die Freigabe nicht auslösen. Welche Traktanden das betrifft, zeigt dort der Kasten «… tragen noch ein älteres Erfordernis». Wo L13 nicht wirkt, etwa bei nützlichen baulichen Massnahmen oder unter einer angewandten Bestimmung Ihres Reglements, ändert die Umstellung das Mehr nicht, und die Freigabe bleibt möglich.'
		);
		expect(hb).not.toContain('sonst lässt sich die Freigabe nicht auslösen');
	});

	it('T2 und T3: Handbuch, «Eine Rüge festhalten»', () => {
		expect(hb).toContain(
			'Er ist für den Fall, dass jemand im Saal einen Mangel im Ablauf beanstandet, meist bevor abgestimmt wird: die Einladung kam zu spät, der Antrag stand so nicht in der Einladung, jemand müsste in den Ausstand. Auch einen Einwand nach dem Ergebnis halten Sie hier fest, solange die Versammlung läuft.'
		);
		expect(hb).toContain('Darauf kommt es an: ob die Rüge vor der Abstimmung kam oder erst danach.');
		expect(hb).toContain(
			'**Ist die Rüge begründet, beheben Sie den Mangel im Saal, wo das geht**, etwa indem jemand in den Ausstand tritt. War die angesagte Mehrheit zu mild, setzen Sie unter «Nötige Mehrheit ändern» die richtige, strengere; eine mildere lässt Votum im Saal nicht zu. Sonst ist Verschieben meist der sichere Weg.'
		);
	});

	it('T3b: Hilfe am Feld der Rüge', () => {
		expect(datei('src/lib/components/Ruegen.svelte')).toContain(
			'Ist die Rüge begründet, beheben Sie den Mangel im Saal, wo das geht, etwa mit dem Ausstand, oder, wenn die angesagte Mehrheit zu mild war, mit der richtigen, strengeren. Sonst ist Verschieben meist der sichere Weg, und darüber beschliesst die Versammlung.'
		);
		expect(datei('src/lib/components/Ruegen.svelte')).not.toContain('etwa mit dem Ausstand oder einem strengeren Mehr');
	});

	it('T4: allgemeine Erklärung zum Wortlaut ab der Fassung 2026-11-16', () => {
		expect(rw16.wortlautErklaerung).toContain(
			'Nach herrschender Lehre, der Auffassung der meisten Fachleute, zählen die Eigentümer, die anwesend oder vertreten sind, nicht nur jene, die abstimmen. Eine Enthaltung wirkt deshalb wie ein Nein. Einzelne Autoren zählen alle Eigentümer, andere nur die Abstimmenden. Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt. Wo das Gesetz zugleich die Wertquoten verlangt, müssen auch sie erreicht sein.'
		);
		expect(rw16.wortlautErklaerung).not.toContain('nicht nach jenen, die abstimmen');
		expect(holeRegelwerk('2026-11-15').wortlautErklaerung).toContain('nicht nach jenen, die abstimmen');
	});

	it('T6: Handbuch zur Nutzniessung', () => {
		expect(hb).toContain(
			'Bei der Genehmigung einer Änderung der Wertquoten und bei Reglementsbestimmungen über etwas anderes als Nutzung und Verwaltung ist das nicht geklärt: Der Kommentar gibt dem Nutzniesser eine beinahe vollständige Verwaltungsmacht (Rz. 45) und nimmt Verfügungen davon aus (Rz. 46).'
		);
		expect(hb).toContain(
			'| **Eigentümer** (bei Wertquoten und bei Reglementsbestimmungen über etwas anderes als Nutzung und Verwaltung nicht geklärt, siehe unten) |'
		);
	});

	it('T7b und T7d: Handbuch zu L13 und der Freigabevermerk', () => {
		expect(hb).toContain(
			'Wer im Ausstand ist, bleibt seit der Fassung 2026-11-16 auch dann in der Zahl, wenn die Sitzungsleitung unter «Anderes Erfordernis setzen» bei «Mehrheit wovon?» selbst «aller Eigentümer, auch der abwesenden» wählt.'
		);
		expect(rw16.freigabevermerk).toContain(
			' In der Fassung 2026-11-16 bleibt, wer im Ausstand ist, auch unter einer von der Sitzungsleitung gesetzten Mehrheit aller Eigentümer in der Zahl und wirkt wie ein Nein. So ist es schon unter der Einstellung «Alle Eigentümer». An der Ausschlussklage und an der Einsprache ändert sich nichts.'
		);
		// Fachprüfung des Nachtrags, N-F-1: Handbuch zu L13 (T7b) und zur 9 (T7e) nennen die Einsprache.
		expect(hb.split('Ausgenommen ist die Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht; dort fällt, wer im Ausstand ist, weiter aus der Zahl.').length - 1).toBe(2);
		expect(holeRegelwerk('2026-11-15').freigabevermerk).not.toContain('2026-11-16');
	});
});
