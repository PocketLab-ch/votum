/**
 * Was das Protokoll über die Mischform sagt.
 *
 * **Der Anlass** (Auftraggeber, 09.09.2026): «Einleitend, wenn es eine Mischform ist.
 * Ansonsten ist es wie, wenn jemand das Protokoll schreibt und im Excel die
 * Stimmen auszählt. Also wenn alle von Hand abstimmen, braucht es nach mir
 * keinen Protokolleintrag. Nur bei der Mischform.»
 *
 * **Warum es überhaupt einen Satz braucht.** In der Mischform überträgt die
 * Sitzungsleitung die Stimmen der Papierparteien, und zwar **ohne Grund je
 * Traktandum**: Der Grund ist der Vermerk am Eingang. Eine stellvertretend
 * erfasste Stimme ohne Grund taucht im Protokoll aber gar nicht auf
 * (`holeStellvertretendeStimmen` filtert `chair_reason IS NOT NULL`). Ohne
 * diesen Abschnitt stünde also nirgends, dass ein Teil der Stimmen übertragen
 * wurde, und der Leser hätte keine Möglichkeit, es nachzuvollziehen.
 *
 * **Warum an einer Stelle und nicht zweimal geschrieben.** Den Abschnitt
 * brauchen zwei Texte: das Protokoll einer einzelnen Versammlung und die
 * Zusammenstellung eines gemeinsamen Abends. Beide sind grosse Textbauer, die
 * nichts voneinander wissen; der gemeinsame Wortlaut steht deshalb hier und
 * nicht in einem von beiden. Zweimal getippt liefe er auseinander, und dann
 * hiesse dieselbe Abmachung in zwei Dokumenten Verschiedenes.
 *
 * **Ältere Fassungen tragen den Abschnitt nicht, und das ist kein Fehler.**
 * `minutes_version.body` ist ein festgeschriebener Abzug; der Auslöser
 * `minutes_version_unveraenderlich_trigger` (Migration 037) verbietet UPDATE
 * und DELETE, und der Anwendungsrolle ist nur SELECT und INSERT erteilt. Ein
 * neuer Abschnitt kann also nicht rückwirkend in eine versandte oder genehmigte
 * Fassung einwandern. Wurde ein Mischform-Protokoll vor dem 10.09.2026
 * festgehalten, zeigt die festgehaltene Fassung den Abschnitt nicht, die
 * lebende Ansicht daneben schon. Fachlich ist das richtig herum: Festgehalten
 * ist, was hinausging.
 */

/**
 * Lief diese Versammlung in der Mischform?
 *
 * **Beide Grenzen gehören dazu.** Ohne Papierpartei ist es keine Mischform,
 * sondern der Regelfall. Sind **alle** Parteien auf Papier, ist es ebenfalls
 * keine: Dann wurde durchgehend von Hand abgestimmt, und dazu braucht es keinen
 * eigenen Abschnitt (Vorgabe des Auftraggebers, 09.09.2026). Gemischt ist nur, was dazwischen
 * liegt.
 *
 * **`eingelassen` sind die anwesenden und vertretenen Parteien, nicht alle der
 * Momentaufnahme** (10.09.2026, im Code-Review gefunden). Ein Papiervermerk
 * entsteht nur am Eingang; wer nicht erschienen ist, kann nie im Zähler stehen,
 * stünde aber immer im Nenner. Gerechnet gegen alle 14 Parteien wäre eine
 * Versammlung mit 5 Anwesenden, die alle von Hand abstimmten, eine «Mischform»
 * gewesen, und das Protokoll hätte behauptet, ein Teil habe am eigenen Gerät
 * abgestimmt. Die Ausnahme des Auftraggebers «alle von Hand, kein Eintrag» hätte nur noch bei
 * vollständiger Anwesenheit gegriffen.
 *
 * «Vertreten» zählt mit: Die Stimme wird abgegeben, nur von jemand anderem.
 */
export function istMischform(aufPapier: number, eingelassen: number): boolean {
	return aufPapier > 0 && aufPapier < eingelassen;
}

/**
 * Der Eröffnungssatz für das Protokoll **einer** Versammlung.
 *
 * **Er steht nicht in der geteilten Erklärung** (10.09.2026, im Code-Review
 * gefunden). «Diese Versammlung lief in der Mischform» ist am gemeinsamen Abend
 * falsch: Dort steht der Absatz einmal über der Liste aller Häuser, und bei
 * einem gemischten von fünf behauptete er die Mischform für den ganzen Abend.
 * Geteilt wird deshalb nur, was für beide gilt.
 */
export const MISCHFORM_EINE_VERSAMMLUNG =
	'Diese Versammlung lief in der Mischform: Ein Teil der Parteien stimmte am eigenen Gerät ab, ein Teil auf Papier.';

/** Derselbe Satz für die Zusammenstellung eines gemeinsamen Abends. */
export const MISCHFORM_MEHRERE_HAEUSER =
	'Die folgenden Gemeinschaften tagten in der Mischform: Ein Teil ihrer Parteien stimmte am eigenen Gerät ab, ein Teil auf Papier.';

/**
 * Was für beide gilt, in Sätzen unter 180 Zeichen.
 *
 * Zwei Dinge, und beide werden gebraucht: dass die Stimmen der einen Seite
 * übertragen wurden, und warum daneben kein Grund steht.
 */
export const MISCHFORM_ERKLAERUNG: readonly string[] = [
	'Die Parteien auf Papier wurden am Eingang so vermerkt; ihre Stimmen hat die Sitzungsleitung übertragen.',
	'Zu den einzelnen Traktanden steht dafür kein Grund, denn der Grund ist der Vermerk am Eingang. Er steht mit Urheber und Uhrzeit im Verlauf.'
];

/**
 * Der Abschnitt für das Protokoll einer einzelnen Versammlung.
 *
 * Leer, wenn es keine Mischform ist. Ein leeres Feld ist hier die richtige
 * Antwort und keine Lücke: Der Abschnitt soll dann gar nicht dastehen.
 *
 * **Die Namen stehen dabei, nicht nur die Zahl.** Ohne sie liesse sich der
 * Abschnitt nicht prüfen: Wer im Anfechtungsfall wissen will, welche Stimme
 * übertragen wurde und welche nicht, findet es sonst nirgends. Ein Name neben
 * dem **Weg** der Stimmabgabe ist etwas anderes als ein Name neben dem
 * Stimmverhalten (AD-11); das Protokoll nennt aus demselben Grund schon heute,
 * wer wen vertreten hat.
 */
export function stimmabgabeabschnitt(namen: readonly string[], eingelassen: number): string[] {
	if (!istMischform(namen.length, eingelassen)) return [];
	const z: string[] = ['## Stimmabgabe', '', MISCHFORM_EINE_VERSAMMLUNG, ''];
	for (const satz of MISCHFORM_ERKLAERUNG) {
		z.push(satz);
		z.push('');
	}
	z.push(`Auf Papier abgestimmt haben (${namen.length}):`);
	z.push('');
	for (const name of namen) z.push(`- ${name}`);
	z.push('');
	return z;
}

/** Eine Zeile der Anwesenheitsliste, so weit die Nachtragsliste sie braucht. */
export interface Stand {
	parteiId: string;
	name: string;
	zustand: string;
	/** Wie die Partei hereinkam. `vertretung` heisst: durch jemand anderen. */
	weg?: string | null;
}

/**
 * Wer anwesend ist, ohne je gefragt worden zu sein — die Nachtragsliste.
 *
 * **Der Anlass** (Auftraggeber, 10.09.2026): Wer die Frage mitten im Einlass
 * **einschaltet**, hat ein Loch. Alle, die vorher hereinkamen, wurden nie
 * gefragt und stimmen still digital ab. Im Haus führte nur das nochmalige
 * Scannen der Karte zur Frage, am gemeinsamen Abend gar kein Weg.
 *
 * **Das ist kein Entscheid mitten in der Sitzung**, sondern das Nachholen der
 * Eingangsfrage für Leute, die hereinkamen, bevor es die Frage gab. Die Menge
 * ist endlich, bekannt und schrumpft auf null. Ein freier Knopf an jeder Zeile
 * wäre das andere und wurde ausdrücklich verworfen.
 *
 * **Nur Anwesende, nicht Gegangene.** Wer den Saal verlassen hat, stimmt nicht
 * mehr mit; ihn zu fragen wäre eine Frage ohne Folge. Kommt er zurück, steht er
 * wieder auf «anwesend» und damit wieder in der Liste.
 *
 * **Vertretene Parteien bleiben draussen** (Code-Review 10.09.2026). Wer über
 * eine Vollmacht anwesend ist, hat kein Gerät im Saal — seine Stimme gibt der
 * Bevollmächtigte ab, und die Frage «digital oder von Hand» trifft ihn gar
 * nicht. Sie kommen auch nie durch den Einlasshelfer: Vertretene werden
 * nachgezogen, gefragt wird der, der hereinkommt. Ohne diesen Ausschluss hätte
 * jede Versammlung mit Vollmachten eine Nachtragsliste, die sich nie leert —
 * und eine Liste, die man nicht abarbeiten kann, liest bald niemand mehr.
 *
 * **`aufPapier` steht zusätzlich drin, obwohl der Vermerk seit Migration 109
 * immer neben einer Antwort entsteht.** Für Versammlungen, die vorher liefen,
 * gibt es Vermerke ohne Antwortzeile — und eine Partei mit Vermerk wurde
 * offensichtlich gefragt. Ohne diesen Zusatz stünde sie in der Nachtragsliste
 * und daneben, an derselben Zeile, ihr Vermerk «stimmt von Hand».
 */
export function nichtGefragte(
	staende: readonly Stand[],
	beantwortet: readonly string[],
	aufPapier: readonly string[]
): Stand[] {
	const bekannt = new Set([...beantwortet, ...aufPapier]);
	return staende.filter(
		(s) => s.zustand === 'anwesend' && s.weg !== 'vertretung' && !bekannt.has(s.parteiId)
	);
}
