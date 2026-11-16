/**
 * Die Sätze, aus denen eine Einladung besteht (23.08.2026, Prüflauf I, B-14).
 *
 * **Der Anlass**: «Die Einladung ist heute identisch mit der Traktandenliste —
 * kein Absender, keine Anrede, kein Einberufungssatz, kein Vollmachtshinweis.»
 * Ein Blatt, das mit «Traktandenliste» beginnt und mit Traktandum 11 endet, ist
 * keine Einberufung; die Einberufung ist aber das, was im Anfechtungsfall
 * geprüft wird (ZGB Art. 712n Abs. 1).
 *
 * **Warum hier und nicht im PDF.** Der Satzbau ist Fachtext: Er sagt, wozu
 * eingeladen wird und was für die Vertretung gilt. Im Satzcode stünde er
 * zwischen Koordinaten und wäre nur über ein erzeugtes PDF prüfbar — also gar
 * nicht. Dasselbe Muster wie `erfordernisInWorten` und `antragstellerInWorten`.
 */
import { anteilInWorten, GESETZLICH } from './beschlussfaehigkeit';
import type { Beschlussfaehigkeitsregel } from './beschlussfaehigkeit';
import { mitQuelle } from './gemeinschaft';
import { datumLang } from './datum';
import type { Schwelle } from './mehrheit';

/** «zwei» statt «2» für kleine Zahlen im Fliesstext. */
export function zahlwort(n: number): string {
	const worte = ['null', 'eine', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
	return worte[n] ?? String(n);
}

export interface Einberufung {
	gemeinschaftName: string;
	art: 'ordentlich' | 'ausserordentlich';
	datum: string;
	uhrzeit: string;
	ort: string;
}

/**
 * «hiermit laden wir Sie zur ordentlichen Versammlung der … ein. Sie findet am
 * … um … Uhr in … statt.»
 *
 * Kleingeschrieben am Anfang: Der Satz schliesst an die Anrede an, und «Sehr
 * geehrte Damen und Herren / Hiermit laden wir» ist im Deutschen ein Fehler,
 * den jeder Empfänger sieht.
 */
export function einberufungssatz(e: Einberufung): string {
	const gattung = e.art === 'ordentlich' ? 'ordentlichen' : 'ausserordentlichen';
	return (
		`hiermit laden wir Sie zur ${gattung} Versammlung der ${e.gemeinschaftName} ein. ` +
		`Sie findet am ${datumLang(e.datum)} um ${e.uhrzeit} Uhr in ${e.ort} statt.`
	);
}

/**
 * Der Hinweis auf die Vertretung, mit der Grenze der Gemeinschaft.
 *
 * **Er gehört in die Einladung und nicht an den Einlass**: Wer die Grenze erst
 * dort erfährt, steht mit einer Vollmacht da, die er nicht mehr ausüben darf —
 * und der Vollmachtgeber ist dann weder anwesend noch vertreten.
 */
export function vertretungssatz(grenze?: number | null, quelle?: string | null): string {
	const anfang = 'Wer nicht selbst teilnehmen kann, kann sich schriftlich vertreten lassen.';
	const schluss = 'Die Vollmacht ist beim Einlass vorzuweisen.';
	if (!grenze || grenze <= 0) return `${anfang} ${schluss}`;
	const mitte =
		`Eine Person darf höchstens ${grenze} Vollmacht${grenze === 1 ? '' : 'en'} ausüben` +
		// `mitQuelle`: «(Art. 18)» allein liesse den Leser im ZGB suchen.
		`${quelle ? ` (${mitQuelle(quelle)})` : ''}.`;
	return `${anfang} ${mitte} ${schluss}`;
}

/**
 * Der Zusatz für Einheiten im gemeinschaftlichen Eigentum (ZGB Art. 712o).
 *
 * **Warum in die Einladung und nicht auf die Zugangskarte** (27.08.2026,
 * Produktentscheid). Die Karte gehört einer Einheit und wird von allen
 * Beteiligten gelesen; sie sagt deshalb nur, was für sie gilt: eine Stimme,
 * eine Person gibt sie ab. Die **Folge der Uneinigkeit** ist etwas anderes —
 * sie betrifft den Abend und die Auszählung, und dort steht sie neben dem
 * Hinweis auf die Vertretung.
 *
 * **Die Fundstellen für die drei Tatsachenaussagen des Absatzes** (sie waren
 * beim Umbau vom 23.09.2026 aus diesem Kopf verschwunden, gefunden im
 * Code-Review):
 *
 *   - **Eine Stimme je gemeinschaftliche Einheit:** ZGB Art. 712o Abs. 1.
 *   - **Der allein Anwesende vertritt gültig:** Rz. 19 ad Art. 712o.
 *   - **Uneinigkeit macht die Stimme ungültig:** Rz. 26 bis 29a ad Art. 712o.
 *     Rz. 28 weist das ausdrücklich als Lehrmeinung aus: «Das Gesetz selbst
 *     äussert sich nicht über die Folge einer ungelösten Meinungsverschiedenheit
 *     … Unseres Erachtens ist von der Ungültigkeit auszugehen.» Meier-Hayoz/Rey
 *     sprechen von Unwirksamkeit, Weber von Ungültigkeit. **Rechnerisch führt
 *     beides zum selben Ergebnis**, deshalb tritt der Satz nicht als
 *     Lehrstreit auf.
 *
 * ---
 *
 * **Dieser Absatz ist am 23.09.2026 nach drei Prüfungen neu gebaut worden.**
 * Was dabei gelernt wurde, steht hier, weil es sonst beim nächsten Durchgang
 * wieder von vorn beginnt.
 *
 * **1. Der Satz sprach über die Enthaltung, obwohl er über die ungültige
 * Stimme sprechen sollte.** Er lautete: «Sie zählt dann wie eine Enthaltung
 * und wirkt damit wie ein Nein.» Der Umweg stammte aus **Rz. 28 ad
 * Art. 712o**, wo die ungültige Stimme «wie im Falle einer Enthaltung» in die
 * Berechnung einfliesst. Der Umweg ist unnötig: **Rz. 181 ad Art. 712m nennt
 * die ungültige Stimme selbst** — «Das bedeutet, dass ungültige Stimmen oder
 * Enthaltungen in die Berechnung einfliessen».
 *
 * **2. Und er war gefährlich.** Ein Entwurf machte den Satz vom Reglement
 * abhängig, weil eine Klausel Enthaltungen aus der Bezugsgrösse nehmen kann.
 * Die Fachprüfung hat das verworfen, und zwar tragend: Rz. 28 steht unter «b.
 * Die **gesetzliche** Folge» und verweist auf Rz. 181, die ihrerseits unter
 * «a. Die **dispositive** Berechnungsweise» steht und mit «Wenn das Reglement
 * keine besonderen Bestimmungen enthält» beginnt. Was aus der Zuordnung wird,
 * wenn ein Reglement die Bezugsgrösse ändert, sagt der Kommentar **nirgends**;
 * korpusweit gesucht.
 *
 * **3. Für die häufigste Klauselart zeigt die Auslegung in die Gegenrichtung.**
 * **Rz. 105 ad Art. 712g:** «Wenn die Abweichung vom dispositiven Recht nicht
 * eindeutig genug ausfällt, wird am dispositiven Recht festgehalten» (BGE 144
 * III 510 E. 2.2.4; BGer 5A_865/2011 E. 3.2). Eine Klausel, die nur von
 * «Enthaltungen» spricht, deckt die ungültige Stimme nicht mit hinreichender
 * Deutlichkeit ab. Für sie bleibt es beim dispositiven Recht: Sie bleibt in
 * der Berechnung und wirkt wie ein Nein. Nur eine Klausel im Wortlaut von
 * **Rz. 186 ad Art. 712m** («keine Berücksichtigung von Enthaltungen und
 * nichtigen Stimmen») nähme sie mit heraus — und ob eine hinterlegte Regel so
 * lautet, sagen unsere Daten nicht: Das Feld heisst `enthaltungZaehltMit`.
 *
 * **Deshalb ein Satz für alle, mit dem Vorbehalt.** Der Vorbehalt ist nicht
 * Höflichkeit: `themen/stockwerkeigentum/fragen.md`, Frage 35, hält als
 * Hausregel fest, dass Rz. 181 selbst nicht unumstritten ist und dass, wer die
 * Aussage anfasst, den Vorbehalt nicht weglassen darf.
 *
 * **4. «Eine Vollmacht braucht es dafür nicht» war zu weit.** Rz. 19 sagt, der
 * Anwesende brauche keine **ausdrückliche** Vollmacht, weil die Abwesenden sie
 * durch ihr Fernbleiben erteilen. Sie wird also **vermutet**, nicht erlassen —
 * und nach Rz. 25 können die übrigen vom Vertreter bei falscher Ausübung
 * Schadenersatz verlangen. «Gilt als bevollmächtigt» sagt beides richtig,
 * ohne dass der Absatz von Haftung handeln muss.
 *
 * **Und warum nur hier, denn das ist schon einmal zu weit gelesen worden.**
 * Derselbe Wortlaut steht an sechs weiteren Stellen, zwei davon sichtbar: den
 * Hilfetexten an der Eigentümermaske, dem Handbuch «Eine Versammlung führen»
 * und der Übernahme-README. Ein Code-Review vom 23.09.2026 hat das als
 * dieselbe Fehlerklasse gemeldet. **Es ist keine**, und die Fachprüfung hat
 * die Unterscheidung selbst gezogen:
 *
 * Gegenüber der **Sitzungsleitung** ist die Verkürzung richtig — sie darf die
 * anwesende Person zählen und **muss keine Vollmacht verlangen**. Genau das
 * sagen jene Stellen, und genau diese Leserin haben sie. Gegenüber dem
 * **allein anwesenden Miteigentümer** liest sie sich als Freibrief, und der
 * ist es nicht, weil er nach Rz. 25 haftet. Dieser Absatz ist der einzige, der
 * ihn anspricht.
 *
 * Wer die anderen Stellen angleicht, ändert ihre Aussage von «du musst nicht
 * prüfen» zu «er haftet dir». Das ist eine andere Aussage an eine andere
 * Leserin, und sie bräuchte ihre eigene Prüfung.
 *
 * **5. Der Absatz beschrieb nur ein Unglück.** Die Laienprüfung: Der einzige
 * erkennbare Ausweg sei, dass einer der Miteigentümer nicht erscheint. Eine
 * Einladung darf dazu nicht anleiten. **Rz. 18a ad Art. 712o** trägt den
 * Gegensatz: «Ansonsten räumt der Vorsitzende den Anwesenden eine kurze Zeit
 * ein, damit sie den Vertreter bestimmen.» Wer vorher weiss, dass er sich vor
 * Ort in zwei Minuten einigen muss, einigt sich meistens vorher.
 *
 * **6. «Kommen mehrere» las sich als drei oder mehr**, und die Prüferin, die
 * mit ihrem Bruder eine Wohnung hält, hielt den Absatz deshalb für einen
 * fremden Fall. «Zwei oder mehr von ihnen» ist eindeutig; die Beispiele im
 * ersten Satz lassen sie sich wiedererkennen.
 *
 * `null`, wo die Gemeinschaft keine solche Einheit hat: Ein Absatz über einen
 * Fall, den es hier nicht gibt, verlängert die Einladung und wird beim nächsten
 * Mal überlesen — samt dem, was daneben steht.
 */
export function gemeinschaftssatz(hatGemeinschaftlichesEigentum: boolean): string | null {
	if (!hatGemeinschaftlichesEigentum) return null;
	return (
		'Gehört eine Einheit mehreren Personen gemeinsam, etwa Ehepartnern oder Erben, hat sie ' +
		'zusammen eine Stimme (ZGB Art. 712o Abs. 1). Ist nur eine der Personen anwesend, gibt sie ' +
		'diese Stimme ab; sie gilt dabei als bevollmächtigt und muss keine schriftliche Vollmacht ' +
		'vorweisen. Kommen zwei oder mehr von ihnen und sind sie sich uneinig, ist die Stimme ' +
		'ungültig. Sie bleibt dann in der Berechnung und wirkt wie ein Nein, sofern Ihr Reglement ' +
		'nichts anderes bestimmt. Klären Sie deshalb vor der Versammlung, wie Sie abstimmen wollen ' +
		'und wer die Stimme abgibt. An der Versammlung gibt Ihnen die Sitzungsleitung dafür nur ' +
		'kurz Zeit.'
	);
}

/**
 * Der Zusatz für die zweite Versammlung (ZGB Art. 712p Abs. 3).
 *
 * `null` für die erste: Ein Hinweis auf das herabgesetzte Quorum unter einer
 * ersten Einladung wäre schlicht falsch — dort gilt die Hälfte.
 */
/**
 * **Der Weg hinein heisst `beschlussfaehigkeitssatz`** (Code-Review
 * 07.09.2026). Diese Funktion bleibt exportiert, weil die Wertetabelle unten
 * sie einzeln prüft — aber sie liefert bei der **ersten** Versammlung still
 * `null`, und genau das war Befund 25. Wer «den Satz zur Beschlussfähigkeit»
 * sucht, nimmt die andere.
 */
export function zweitversammlungssatz(
	stufe: 'erste' | 'zweite',
	regel?: { kopf: Schwelle; mindestens: number; fundstelle: string } | null
): string | null {
	if (stufe !== 'zweite') return null;
	const kopf = 'Diese Versammlung ist die zweite Versammlung nach ZGB Art. 712p Abs. 3.';

	/*
	 * **Die eigene Regel schlägt das Gesetz** (Nachprüfung 23.08.2026).
	 *
	 * Der Satz nannte bis dahin immer das gesetzliche Drittel — auch dort, wo
	 * die Gemeinschaft eine strengere Regel hinterlegt hat. Am Abend rechnet die
	 * Anwendung nach der Regel; die Einladung hätte etwas anderes behauptet, und
	 * zwar im Dokument, das im Anfechtungsfall auf dem Tisch liegt. Genau die
	 * Klasse «Anzeige und Rechnung sagen Verschiedenes», wegen der B-19 gebaut
	 * wurde.
	 *
	 * Erschwerungen sind das Einzige, was hinterlegt werden darf
	 * (`pruefeErschwerung`) — der Satz sagt deshalb nie weniger als das Gesetz.
	 */
	if (regel) {
		return (
			`${kopf} Nach ${mitQuelle(regel.fundstelle)} ist sie beschlussfähig, wenn ` +
			// Die Mindestzahl als Wort, wie im gesetzlichen Rückfall darunter: Zwei
			// Schreibweisen derselben Untergrenze lesen sich wie ein Unterschied
			// (Code-Review 07.09.2026).
			`${anteilInWorten(regel.kopf)} der Eigentümer, mindestens aber ${zahlwort(regel.mindestens)}, ` +
			'anwesend oder vertreten sind.'
		);
	}

	return (
		`${kopf} Sie ist beschlussfähig, wenn ein Drittel der Eigentümer, mindestens aber zwei, ` +
		'anwesend oder vertreten sind.'
	);
}

/**
 * Was für die **Beschlussfähigkeit** gilt — auch bei der ersten Versammlung.
 *
 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, Befund 25): «Das
 * Einladungs-PDF nennt § 8 nicht — ein Eigentümer erfährt nicht, dass ohne drei
 * Anwesende gar nicht beschlossen werden kann, der beste Grund zu kommen.»
 *
 * Bis dahin stand ein Satz dazu nur auf der **zweiten** Versammlung
 * (`zweitversammlungssatz`), weil dort die Erleichterung erklärt werden muss.
 * Bei der ersten stand nichts — dabei ist es genau umgekehrt der Fall, in dem
 * die Zahl den Empfänger bewegt.
 *
 * **Beide Bedingungen, nicht nur die Köpfe** (Code-Review 07.09.2026). Die
 * erste Fassung nannte nur den Kopfanteil. Bei der ersten Versammlung gilt
 * daneben immer eine **Wertquotenbedingung** (`GESETZLICH.erste.quoten`, und
 * `pruefeErschwerung` lässt eine erste Regel ohne sie gar nicht zu). Eine
 * Einladung, die eine davon verschweigt, nennt ein niedrigeres Quorum als am
 * Abend gerechnet wird — genau die Klasse, wegen der B-19 gebaut wurde.
 *
 * **Und ohne hinterlegte Regel schweigt der Satz nicht** (derselbe Review). Er
 * tat es in der ersten Fassung, mit der Begründung, die Anwendung rechne nach
 * dem, was hinterlegt sei. Das stimmt nicht: `stelleBeschlussfaehigkeitFest`
 * nimmt `regel ?? GESETZLICH[art]`. Ohne Regel gilt also das Gesetz, und das
 * ist der Normalfall — der Befund wäre für die Mehrheit der Gemeinschaften
 * offen geblieben.
 */
export function beschlussfaehigkeitssatz(
	stufe: 'erste' | 'zweite',
	regel?: Beschlussfaehigkeitsregel | null
): string | null {
	if (stufe === 'zweite') return zweitversammlungssatz(stufe, regel);

	const gilt = regel ?? GESETZLICH.erste;
	const woher = regel
		? `Nach ${mitQuelle(regel.fundstelle)} ist`
		: 'Nach ZGB Art. 712p Abs. 1 ist';
	const quotensatz = gilt.quoten
		? ` und ${anteilInWorten(gilt.quoten)} der Wertquoten vertreten sind`
		: ' sind';

	return (
		`${woher} die Versammlung beschlussfähig, wenn ` +
		// Die Mindestzahl als Wort, wo sie klein ist: Der Zweitversammlungssatz
		// schreibt «mindestens aber zwei», und zwei Schreibweisen derselben
		// gesetzlichen Untergrenze im selben Dokumenttyp lesen sich wie ein
		// Unterschied (Code-Review 07.09.2026).
		`${anteilInWorten(gilt.kopf)} der Eigentümer, mindestens aber ${zahlwort(gilt.mindestens)}, ` +
		`anwesend oder vertreten${quotensatz}. Ihre Teilnahme zählt also mit, auch dann, ` +
		'wenn Sie sich vertreten lassen.'
	);
}

/** Das Zeichen am Titel eines neuen Traktandums und vor der Fussnote (L5). */
export const NEUTRAKTANDUM_ZEICHEN = '¹';

/**
 * **Die Fussnote zu neuen Traktanden einer zweiten Versammlung** (L5,
 * Migration 174; Entscheid des Auftraggebers 22.10.2026: «Ja, als Tatsache»,
 * als Fussnote, damit die Einladung nicht überladen wird).
 *
 * Nur nach der Vorgabe `erste`: Dann entscheidet die Anwesenheit, ob über das
 * Geschäft beschlossen werden kann, und nur die Einladung erreicht die
 * Eigentümer vorher. Verlangt ist der Satz nicht (Art. 712p regelt den Inhalt
 * der Einladung nicht; Rz. 49 ad Art. 712p verlangt nur die korrekte
 * Mitteilung). Er sagt deshalb nur, was die Gemeinschaft tut, und nichts zur
 * offenen Rechtsfrage.
 *
 * Die Bedingung wie in `beschlussfaehigkeitssatz` für die erste Stufe: mit der
 * Wertquote und der eigenen Regel, falls hinterlegt, denn danach sperrt das
 * Eröffnen (`stelleBeschlussfaehigkeitFest` mit `regel ?? GESETZLICH.erste`).
 */
export function neutraktandenFussnote(regelErste?: Beschlussfaehigkeitsregel | null): string {
	const gilt = regelErste ?? GESETZLICH.erste;
	const quoten = gilt.quoten ? `, und ${anteilInWorten(gilt.quoten)} der Wertquoten` : '';
	// Laienprüfung Block 7, L7-1 und L7-10; Fachprüfung F7-3: was die Eigentümer
	// tun können, und dass Vollmachten zählen.
	return (
		`${NEUTRAKTANDUM_ZEICHEN} Dieses Geschäft stand in der Einladung zur ersten Versammlung nicht zur Abstimmung. ` +
		'Ihre Gemeinschaft beschliesst darüber nur, wenn so viele Eigentümer anwesend oder vertreten ' +
		`sind wie an einer ersten Versammlung: ${anteilInWorten(gilt.kopf)} der Eigentümer, ` +
		`mindestens aber ${zahlwort(gilt.mindestens)}${quoten}. Wer nicht kommen kann, kann sich mit ` +
		'einer Vollmacht vertreten lassen; auch das zählt. Sonst kommt das Geschäft auf die Liste ' +
		'einer späteren Versammlung.'
	);
}

/**
 * Der Verweis im Anschreiben auf die Fussnote (Laienprüfung Block 7, L7-1):
 * Der Satz «beschlussfähig mit einem Drittel» darüber bleibt sonst als das
 * Ganze hängen.
 */
export const NEUTRAKTANDUM_VERWEIS =
	// Fachprüfung Runde 2, F7-12: «Ihre Gemeinschaft», sonst klingt es nach dem Gesetz.
	`Für die Geschäfte mit dem Zeichen ${NEUTRAKTANDUM_ZEICHEN} verlangt Ihre Gemeinschaft mehr; siehe die Fussnote ` +
	'unter der Liste.';
