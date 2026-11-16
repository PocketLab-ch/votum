/**
 * Der fachliche Fehler — eigenes Modul, weil ihn alle brauchen.
 *
 * **Warum er hier steht und nicht mehr in `gemeinschaft.ts`** (24.08.2026).
 * Dort stand er seit dem Anfang, und alle banden ihn von dort ein — auch
 * `ki.ts`. `gemeinschaft.ts` wiederum bindet `KI_FUNKTIONEN` aus `ki.ts` ein,
 * um eine Kennung zu prüfen: ein **Ring** zwischen zwei Kernmodulen. Gefunden
 * hat ihn `dependency-cruiser` am Tag seiner Einführung; das Vorgängerskript
 * prüfte je Datei und konnte eine Kette gar nicht sehen.
 *
 * Ein Ring macht die Ladereihenfolge zum Zufall: Welches Modul zuerst
 * ausgewertet wird, entscheidet der Bündler, und beim Falschen ist eine
 * Konstante beim ersten Zugriff `undefined`. Hier ist es gutgegangen — auf
 * Dauer ist das keine Zusicherung, sondern Glück.
 *
 * `gemeinschaft.ts` gibt ihn weiterhin weiter, damit die bestehenden
 * Einbindungen unverändert bleiben. Wer neu schreibt, nimmt ihn von hier.
 */

/** Fehler mit fachlicher Ursache. Trägt eine Kennung, damit die Oberfläche sie zuordnen kann. */
export class FachlicherFehler extends Error {
	constructor(
		readonly kennung: string,
		nachricht: string,
		readonly feld?: string
	) {
		super(nachricht);
		this.name = 'FachlicherFehler';
	}
}

/**
 * Die Absage, wenn eine Traktandumskennung nicht zur Versammlung der Adresse
 * gehört.
 *
 * **Warum sie hier steht und nicht dreizehnmal im Serverteil** (08.09.2026).
 * Genau das war sie: dreizehn Stellen, ein Sachverhalt, **zwei** Wortlaute und
 * **zwei** Kennungen. Neun sagten «Dieses Traktandum gehört nicht zu dieser
 * Versammlung», vier sagten «Traktandum nicht gefunden»; acht warfen
 * `fremdes_traktandum`, eine `unbekannt`. `weisung.ts` hatte beide Fassungen in
 * derselben Datei. Ein Kommentar dort hielt den Unterschied seit dem 07.09.2026
 * fest und nannte das Angleichen «einen eigenen, kleinen Schnitt» — das hier
 * ist er.
 *
 * **Gemessen, bevor entschieden wurde: Es gibt kein Orakel.** Die Sorge hinter
 * «nicht gefunden» ist, die Anwendung könnte bestätigen, dass es eine Kennung
 * gibt. Alle dreizehn Stellen fragen aber mit **einer** Abfrage
 * (`WHERE id = … AND meeting_id = …`); ob die Kennung fremd ist oder gar nicht
 * existiert, führt zum selben leeren Ergebnis und damit zum selben Satz. Ein
 * Unterschied, den niemand herstellen kann, ist keiner — die vorsichtigere
 * Fassung kaufte nichts und kostete die Einheitlichkeit.
 *
 * **Der Satz sagt, was zu tun ist**, und das gab den Ausschlag: Wer ihn liest,
 * ist auf der falschen Versammlung. «Nicht gefunden» lässt ihn im Dunkeln, ob
 * er sich vertan hat oder etwas kaputt ist.
 *
 * Die Kante ist bekannt: Bei einer Kennung, die es nirgends gibt, klingt der
 * Satz, als gäbe es das Traktandum anderswo. Er bleibt trotzdem wahr — zu
 * **dieser** Versammlung gehört es nicht —, und die Alternative wäre ein
 * dritter Wortlaut für einen Fall, den die Abfrage gar nicht von den anderen
 * trennt.
 *
 * Dass es bei einer Stelle bleibt, hält `tests/waechter/absagewortlaut.test.ts`
 * fest.
 *
 * Der Satz steht zusätzlich als `FREMDES_TRAKTANDUM` daneben: Die Route
 * `traktanden/[traktandumId]/erfordernis` sagt dasselbe, wirft aber einen
 * HTTP-404 statt eines fachlichen Fehlers. Zwei Mechanismen, ein Wortlaut.
 *
 * @param feld Das Formularfeld, an dem die Oberfläche die Absage anzeigt.
 */
export const FREMDES_TRAKTANDUM = 'Dieses Traktandum gehört nicht zu dieser Versammlung.';

export function fremdesTraktandum(feld: string): FachlicherFehler {
	return new FachlicherFehler('fremdes_traktandum', FREMDES_TRAKTANDUM, feld);
}

/**
 * Die Absage für eine Gemeinschaft aus dem Formular, die es unter diesem
 * Betreiber nicht gibt: fremd, gelöscht oder erfunden. Der Satz unterscheidet
 * die drei nicht, weil die Abfrage unter dem Zeilenschutz sie nicht
 * unterscheidet.
 *
 * **Derselbe Satz wie an den übrigen Stellen** (`holeLesarten`, `reglement.ts`
 * und weitere führen «Gemeinschaft nicht gefunden.» mit `unbekannt`), damit
 * ein Formular nicht je Weg anders absagt. Nur `erfordernis.ts` weicht ab, mit
 * einem Hinweis auf die Auswahl der Quorum-Seite. Einen Wächter wie für das
 * Traktandum gibt es dafür nicht.
 */
export function fremdeGemeinschaft(feld: string): FachlicherFehler {
	return new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', feld);
}
