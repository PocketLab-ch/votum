/**
 * Ob sich eine Gemeinschaft entfernen lässt — und wenn nicht, warum.
 *
 * **Der Anlass** (Auftraggeber, 15.09.2026): «Bei "Gemeinschaft entfernen" anzeigen, ob
 * bei der ausgewählten Gemeinschaft bereits etwas anhängt, wenn ja, den Button
 * für das Entfernen eingrauen und nicht anklickbar machen.»
 *
 * Bis dahin stand der Knopf immer offen. Wer ihn drückte, bekam die Absage erst
 * **nach** der Rückfrage «Endgültig entfernen?» — also nach dem Moment, in dem
 * man sich innerlich schon entschieden hat. Die Auskunft kam richtig, aber zu
 * spät, um noch etwas wert zu sein.
 *
 * **Warum das hier steht und nicht im Serverzugriff.** Die Zählung ist SQL, die
 * Bewertung ist eine Regel. Getrennt lässt sich die Regel ohne Datenbank prüfen
 * — und genau diese Regel muss an **zwei** Stellen dasselbe sagen: einmal
 * vorher auf der Seite, einmal beim Vollzug als Absage.
 *
 * **Und warum nicht zwei Listen.** In `entferneGemeinschaft` steht seit dem
 * 01.09.2026 eine Warnung, die sich genau darauf bezieht: Die Löschfunktion und
 * das SQL-Aufräumskript waren «zwei Listen derselben Sache, und sie sind
 * auseinandergelaufen» — `bylaw_instruction_rule` und `agenda_template_order`
 * fehlten in der einen. Eine dritte Liste für die Anzeige hätte denselben Weg
 * genommen, nur diesmal mit dem Ausgang «Der Knopf war offen, obwohl es nicht
 * ging» oder, schlimmer, «Der Knopf war gesperrt, obwohl es gegangen wäre».
 * Deshalb gibt es eine Liste, und beide Seiten lesen sie.
 */

/**
 * Was an einer Gemeinschaft hängen kann, in Zahlen.
 *
 * Die Namen sind die der Zählung in `gemeinschaften.ts`; die Tabellen dahinter
 * stehen dort. Hier interessiert nur, ob eine Zahl grösser als null ist.
 */
export interface Anhaengendes {
	/** `meeting` — Versammlungen der Gemeinschaft. */
	versammlungen: number;
	/** `imported_meeting` — eingespielte Abschlusspakete. */
	eingespielt: number;
	/** `stweg` mit dieser als Elternteil — Untergemeinschaften. */
	kinder: number;
	/** `party.member_stweg_id` — sie ist andernorts als Eigentümerin geführt. */
	mitgliedschaften: number;
	/** `agenda_item.proposer_stweg_id` — sie ist Antragstellerin. */
	traktanden: number;
	/** `representation` — eine Vertretung verweist auf sie. */
	vertretungen: number;
}

/** Ein Grund, der dem Entfernen entgegensteht. */
export interface Hindernis {
	/** Maschinenlesbar, für Prüfungen und die Absage. */
	kennung: string;
	/** Der Satz für den Menschen — nennt die Zahl und den Ausweg. */
	nachricht: string;
	/** Woran es hängt; trägt die Zuordnung im Formular. */
	feld: string;
}

/**
 * Das erste Hindernis, oder `null`, wenn nichts entgegensteht.
 *
 * **Nur das erste, nicht alle.** Wer eine Gemeinschaft entfernen will und drei
 * Gründe vorgesetzt bekommt, arbeitet sie ohnehin einzeln ab; und die
 * Reihenfolge unten ist nicht beliebig, sondern die, in der ein Mensch sie
 * hören will: erst was er selbst angelegt hat, dann was andere daran hängen.
 * Diese Reihenfolge stand vor dieser Datei schon so in `entferneGemeinschaft`
 * und ist bewusst unverändert übernommen.
 */
export function entfernungshindernis(name: string, z: Anhaengendes): Hindernis | null {
	if (z.versammlungen > 0) {
		return {
			kennung: 'hat_versammlungen',
			nachricht:
				`«${name}» hat ${z.versammlungen === 1 ? 'eine Versammlung' : `${z.versammlungen} Versammlungen`}. ` +
				'Eine Gemeinschaft mit Versammlungen lässt sich nicht entfernen — an ihnen hängen ' +
				'Beschlüsse, Anwesenheitslisten und Zugänge, und die beantworten später Fragen.',
			feld: 'versammlungen'
		};
	}
	/*
	 * **Eingespielte Abschlusspakete sind unantastbar** (01.09.2026). Sie hängen
	 * am selben Fremdschlüssel wie alles andere, aber die Schranke «hat
	 * Versammlungen» greift dafür nicht: Das Einspielen schreibt nur
	 * `imported_meeting`, keine `meeting`-Zeile.
	 */
	if (z.eingespielt > 0) {
		return {
			kennung: 'hat_eingespielte_pakete',
			nachricht:
				`«${name}» trägt ${z.eingespielt === 1 ? 'ein eingespieltes Abschlusspaket' : `${z.eingespielt} eingespielte Abschlusspakete`} ` +
				'aus einer früheren Versammlung. Die bleiben, wo sie sind: Ein eingespieltes ' +
				'Paket ist ein Nachweis und wird weder geändert noch gelöscht.',
			feld: 'eingespielt'
		};
	}
	if (z.kinder > 0) {
		return {
			kennung: 'hat_untergemeinschaften',
			nachricht:
				`«${name}» ist die übergeordnete Gemeinschaft von ${z.kinder} weiteren. Lösen Sie diese ` +
				'zuerst ab oder entfernen Sie sie.',
			feld: 'kinder'
		};
	}
	if (z.mitgliedschaften > 0) {
		return {
			kennung: 'ist_eigentuemerin',
			nachricht:
				`«${name}» ist in einer anderen Gemeinschaft als Eigentümerin geführt. Entfernen Sie ` +
				'dort zuerst die Zuordnung.',
			feld: 'mitgliedschaften'
		};
	}
	if (z.traktanden > 0 || z.vertretungen > 0) {
		return {
			kennung: 'wird_verwiesen',
			nachricht:
				`Auf «${name}» wird andernorts verwiesen — als Antragstellerin oder über eine ` +
				'Vertretung. Lösen Sie diese Verweise zuerst.',
			feld: 'verweise'
		};
	}
	return null;
}
