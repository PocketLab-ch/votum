/**
 * Musterwortlaute für Anträge, je Geschäftsart.
 *
 * **Der Anlass** (Prüflauf I, B-18): «Für elf Traktanden habe ich elf Anträge
 * frei formuliert. Die Anwendung kennt die Geschäftsart, den Titel und den
 * Betrag — ein Vorschlag wäre möglich gewesen.»
 *
 * **Ein Vorschlag, keine Vorgabe.** Der Antragswortlaut ist das, worüber
 * abgestimmt wird und was später im Protokoll steht; ein Muster, das ungeprüft
 * durchgeht, wäre schlimmer als ein leeres Feld. Deshalb wird es auf Knopfdruck
 * eingesetzt und nicht vorbelegt — und es endet dort, wo die Gemeinschaft
 * entscheiden muss.
 *
 * **Warum die Geschäftsart und nicht der Fall.** «Notwendige bauliche
 * Massnahme» und «Nützliche bauliche Massnahme» tragen denselben Satzbau; was
 * sie unterscheidet, ist das Mehr, nicht die Formulierung. Dreizehn Muster
 * lassen sich pflegen, siebzig nicht.
 *
 * Der Titel wird eingesetzt, wo er passt — «Die Versammlung beschliesst die
 * Sanierung der Tiefgaragen-Einfahrt» liest sich besser als ein Platzhalter.
 */
import type { Geschaeftsart } from './regelwerk';

/**
 * `{titel}` wird durch den Traktandentitel ersetzt, `{betrag}` bleibt als
 * Lücke stehen — die Zahl kennt die Anwendung nicht, und eine erfundene wäre
 * schlimmer als eine sichtbare Lücke.
 */
const MUSTER: Partial<Record<Geschaeftsart, string>> = {
	/*
	 * **Ohne «und dem Erneuerungsfonds entnommen»** (17.11.2026, Fassung 2026-11-20):
	 * Die Bezahlung aus dem Fonds ist ein zweiter Beschluss mit eigenem Mehr
	 * (SVIT-Kommentar Rz. 139 ad Art. 712l). Im Muster der Arbeit stand sie im selben
	 * Antrag, und Votum rechnete dann nur das Mehr der Arbeit. Ein eigenes Traktandum
	 * führt über «Über die Bezahlung aus dem Fonds» (Produktentscheid 17.11.2026).
	 */
	baulich_notwendig:
		'Die Versammlung beschliesst {titel}. Die Kosten von … Franken werden nach Wertquoten ' +
		'verlegt. Die Bewirtschaftung wird mit der Ausführung beauftragt.',
	baulich_nuetzlich:
		'Die Versammlung beschliesst {titel}. Die Kosten von … Franken werden nach Wertquoten ' +
		'verlegt. Die Bewirtschaftung wird mit der Ausführung beauftragt.',
	baulich_luxurioes:
		'Die Versammlung beschliesst {titel}. Die Kosten von … Franken tragen die zustimmenden ' +
		'Eigentümer; den übrigen entsteht daraus keine Belastung.',
	verwaltung_gewoehnlich:
		'Die Versammlung genehmigt {titel} und beauftragt die Bewirtschaftung mit der Ausführung.',
	verwaltung_wichtig:
		'Die Versammlung beschliesst {titel}. Die Bewirtschaftung wird ermächtigt, die dafür ' +
		'nötigen Verträge abzuschliessen.',
	organe:
		'Die Versammlung wählt … für die Amtsdauer von … Jahren, beginnend am … .',
	jahresgeschaefte:
		'Die Versammlung genehmigt {titel} und erteilt der Bewirtschaftung Décharge.',
	/*
	 * Ohne Titel: Hier heisst ein Traktandum meist «Hausordnung anpassen» oder
	 * «Revision Reglement» — eine Handlung, kein Gegenstand. Mitten in den Satz
	 * gesetzt ergäbe das «beschliesst Hausordnung anpassen in der vorliegenden
	 * Fassung». Der Gegenstand steht schon im Satz; der Titel bringt nichts.
	 */
	hausordnung:
		'Die Versammlung beschliesst die vorliegende Fassung der Hausordnung vom … . Sie tritt ' +
		'am … in Kraft.',
	reglement:
		'Die Versammlung beschliesst die vorliegende Fassung des Reglements vom … . Sie tritt ' +
		'mit der Genehmigung in Kraft.',
	nutzungsrechte:
		'Die Versammlung räumt … das ausschliessliche Nutzungsrecht an … ein. Die Einzelheiten ' +
		'ergeben sich aus … .',
	nutzungsaenderung:
		'Die Versammlung stimmt {titel} zu. Die bisherige Zweckbestimmung wird entsprechend ' +
		'angepasst.',
	grundordnung:
		'Die Versammlung beschliesst {titel} und ermächtigt die Bewirtschaftung, die nötigen ' +
		'Anmeldungen beim Grundbuchamt vorzunehmen.'
};

/**
 * Der Musterwortlaut zu einer Geschäftsart, mit eingesetztem Titel.
 *
 * `null`, wo es keinen gibt: Für Sonderfälle und Kenntnisnahmen lässt sich
 * nichts vorschlagen, was mehr wäre als eine Behauptung.
 */
export function antragsmuster(art: Geschaeftsart | null, titel: string): string | null {
	if (!art) return null;
	const muster = MUSTER[art];
	if (!muster) return null;

	/*
	 * **Nur ein führender Artikel wird kleingeschrieben.** «Die Versammlung
	 * beschliesst Die Sanierung der Einfahrt» ist ein Fehler, den jeder sieht
	 * und der doch durchginge, weil man einen Vorschlag überfliegt.
	 *
	 * Alles andere bleibt, wie es dasteht: Im Deutschen wird ein Substantiv auch
	 * mitten im Satz grossgeschrieben, und «beschliesst dachsanierung» wäre der
	 * schlimmere Fehler — er sieht nach Tippfehler aus, nicht nach Vorschlag.
	 */
	const roh = titel.trim();
	if (!roh) return muster.replaceAll('{titel}', '…');
	const eingesetzt = /^(Der|Die|Das|Den|Dem)\s/.test(roh)
		? roh.charAt(0).toLowerCase() + roh.slice(1)
		: roh;
	return muster.replaceAll('{titel}', eingesetzt);
}

/** Ob es für diese Geschäftsart überhaupt ein Muster gibt. */
export function hatMuster(art: Geschaeftsart | null): boolean {
	return Boolean(art && MUSTER[art]);
}
