/**
 * Quorums-Regelwerk, Fassung 2026-08-05 — **nur die Hilfetexte**.
 *
 * **Was sich ändert:** vier Hilfetexte im Ast «Bauen, sanieren, erneuern».
 * **Was sich nicht ändert:** kein Knoten, keine Frage, keine Antwort, kein
 * Ergebnistyp, keine Bezugsgrösse, keine Rechtsgrundlage. Jeder Weg durch den
 * Baum endet an demselben Ausgang wie in der Fassung 2026-07-30.
 *
 * **Warum trotzdem eine neue Fassung.** Die alte anzufassen wäre einfacher
 * gewesen und falsch: Ein Traktandum hält die Fassungskennung fest, unter der
 * sein Erfordernis hergeleitet wurde (AD-4). Wer im August den Text ändert, den
 * die Sitzungsleitung im Juli gelesen hat, macht einen Beschluss unerklärbar —
 * auch wenn das Ergebnis dasselbe geblieben wäre.
 *
 * **Warum abgeleitet und nicht abgeschrieben.** Eine Kopie von tausend Zeilen
 * für vier geänderte Sätze driftet auseinander, sobald jemand einmal nur die
 * eine Datei pflegt. Was hier steht, ist deshalb die Abweichung — und
 * `tests/domain/regelwerksfassungen.test.ts` rechnet nach, dass es wirklich nur
 * Hilfetexte sind. Die Zusage «nichts als Hilfetexte» ist damit geprüft und
 * nicht versprochen.
 *
 * **Warum überhaupt.** Am 05.08.2026 gegen echte Geschäfte gemessen: Ein
 * **Liftanbau** wurde in drei von vier Läufen als «notwendige bauliche
 * Massnahme» eingeordnet — einfaches statt qualifiziertes Mehr, also die
 * Richtung, in der ein Fehler anfechtbar macht. Beantwortet wurde dabei die
 * Frage «Ist die Massnahme nötig, um Wert oder Gebrauchsfähigkeit zu
 * **erhalten**?» mit Ja, für etwas, das es vorher gar nicht gab.
 *
 * Der Hilfetext sagte, was Erhaltung ist, aber nicht, was sie **nicht** ist.
 * Das half einem Menschen so wenig wie einer Maschine — die Ergänzung steht
 * deshalb im Regelwerk und nicht im Auftrag an das Modell. Es gibt eine Quelle
 * für die Rechtslage, und das ist diese Datei.
 */
import type { Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_07_30 } from './quorum-2026-07-30';

/**
 * Die geschärften Hilfetexte, nach Fragekennung.
 *
 * Jeder sagt jetzt zusätzlich, was **nicht** unter die Frage fällt. Eine
 * Abgrenzung, die nur die eine Seite nennt, lädt zum Ja ein.
 */
const HILFE: Record<string, string> = {
	'f1-1':
		'Reparatur, Ersatz von Defektem durch Gleichwertiges, behördliche Auflage. ' +
		'Massgebend ist, ob ohne die Massnahme Wert oder Gebrauchsfähigkeit leiden. ' +
		'**Erhalten lässt sich nur, was schon da ist:** Was neu geschaffen wird — ein Lift, ' +
		'wo es keinen gab, eine Photovoltaikanlage, ein zusätzlicher Balkon —, ist keine ' +
		'Erhaltung, auch wenn es das Haus aufwertet und alle es vernünftig finden. ' +
		'Fragen Sie sich zuerst: Bestand die Sache bisher, und wird sie wiederhergestellt?',

	'f1-2':
		'Massgebend ist der Nutzen der **Gemeinschaft**, nicht der einzelner Eigentümer. ' +
		'Fassadenisolation, Heizungsersatz mit Systemwechsel, Photovoltaik, der nachträgliche ' +
		'Einbau eines Lifts. Hierher gehört auch, was das Haus erst gebrauchstauglicher macht, ' +
		'als es je war — im Unterschied zur blossen Erhaltung eine Stufe darüber.',

	'f1-3':
		'Marmor-Eingangshalle, Gemeinschaftssauna, Springbrunnen, Terrassenplatten auf einer ' +
		'Sondernutzungsfläche. Kennzeichen ist, dass die Sache das Haus schöner oder bequemer ' +
		'macht, ohne seinen Gebrauchswert für die Gemeinschaft zu erhöhen — oder dass der ' +
		'Nutzen praktisch bei einzelnen Eigentümern liegt.',

	'f1-4':
		'ZGB Art. 647e Abs. 2 öffnet einen Weg ohne Einstimmigkeit — aber nur, wenn keine ' +
		'dauernde Beeinträchtigung vorliegt **und** die übrigen die vorübergehende ' +
		'Beeinträchtigung ersetzen **und** seinen Kostenanteil übernehmen. ' +
		'**Alle drei müssen zutreffen und feststehen.** Solange die übrigen die Übernahme nicht ' +
		'zugesagt haben, ist die Antwort nicht «ja, sie übernehmen» — dann bleibt es bei der ' +
		'Einstimmigkeit.'
};

export const REGELWERK_2026_08_05 = {
	...REGELWERK_2026_07_30,
	fassung: '2026-08-05',

	// Unverändert offen: An der Rechtslage ändert diese Fassung nichts, also
	// auch nichts am Stand der Durchsicht.
	juristischGegengelesen: false,
	freigabevermerk:
		'Fachlich geprüft und vorläufig angenommen am 30.07.2026 (Prüfbericht zum Entscheidbaum), ' +
		'Hilfetexte des Astes «Bauen, sanieren, erneuern» geschärft am 05.08.2026 — Entscheidbaum, ' +
		'Ergebnisse und Rechtsgrundlagen unverändert. Die juristische Gegenlesung steht aus; bis ' +
		'dahin ist jedes Ergebnis ein Vorschlag an die Sitzungsleitung und keine Feststellung.',

	fragen: REGELWERK_2026_07_30.fragen.map((f): Frage =>
		HILFE[f.id] === undefined ? f : { ...f, hilfe: HILFE[f.id] }
	)
} satisfies Regelwerk;
