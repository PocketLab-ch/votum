/**
 * Der Verlauf: Filter, ihre Adresse und die Bereiche (AD-1).
 *
 * **Warum die Filter in der Adresse stehen und nicht im Gerät.** Der Verlauf
 * wird seitenweise gelesen — fünfzig Zeilen je Abruf. Ein Filter, der erst im
 * Browser greift, durchsuchte deshalb nur die gerade sichtbaren fünfzig und
 * meldete «nichts gefunden», während der Treffer auf Seite vier steht. Das ist
 * schlimmer als gar keine Suche, weil das Ergebnis wie eine Auskunft aussieht.
 *
 * Aus der Adresse folgt der Rest von selbst: Zurück-Knopf, Lesezeichen,
 * Weiterschicken — dieselbe Überlegung wie beim Entscheidbaum unter `/quorum`.
 *
 * **Die Bereiche sind das erste Grobsieb.** Es gibt weit über hundert
 * Ereignisarten (am 26.08.2026 waren es 140, beim Schreiben dieses Satzes 97);
 * eine Auswahlliste mit so vielen Einträgen ist kein Filter, sondern eine
 * zweite Suche. Der Bereich ist der Namensteil vor dem ersten Punkt
 * (`vote.round.opened` → `vote`) und trennt die Fragen, die man wirklich
 * stellt: «was geschah an den Abstimmungen», «wer hat sich angemeldet», «was
 * wurde am Reglement geändert».
 */

export interface Verlaufsfilter {
	/** Volltext über Person, Gegenstand und Angaben. */
	suche?: string;
	/** Namensteil vor dem ersten Punkt — `vote`, `meeting`, `bylaw`. */
	bereich?: string;
	/** Genau eine Ereignisart, gesetzt durch den Klick auf eine Handlung. */
	art?: string;
	/** Kennung eines einzelnen Gegenstands — genau dieser eine. */
	gegenstand?: string;
	/**
	 * Alles, was zu **einer Versammlung** gehört (Auftraggeber, 25.08.2026: «Beim
	 * Verlauf braucht es noch einen Filter nach Versammlung und nach
	 * Gemeinschaft»).
	 *
	 * Der Unterschied zu `gegenstand` ist der Punkt: Jener trifft genau die
	 * Einträge, deren Gegenstand die Versammlung IST. Was an ihr geschah, steht
	 * aber an Traktanden, Vollmachten und Momentaufnahmen — und die tragen ihre
	 * eigene Kennung. Wer «Verlauf dieser Versammlung» sucht, meint alles davon.
	 */
	versammlung?: string;
	/** Dasselbe eine Ebene höher: alles einer Gemeinschaft, über alle Jahre. */
	gemeinschaft?: string;
	/**
	 * Alles eines gemeinsamen Abends — also die Summe seiner Versammlungen.
	 *
	 * Braucht die Leiste «Jederzeit» am Abend: Dort steht «Verlauf dieses
	 * Abends», und gemeint ist, was im Saal geschah — nicht bloss die
	 * Einträge, deren Gegenstand der Abend selbst ist (das sind das Anlegen
	 * und das Zuordnen).
	 */
	abend?: string;
	/** Kalendertag, ab dem gesucht wird (einschliesslich), in Schweizer Zeit. */
	von?: string;
	/** Kalendertag, bis zu dem gesucht wird (einschliesslich). */
	bis?: string;
}

const BEREICHSNAMEN: Record<string, string> = {
	user: 'Anmeldung und Konten',
	operator: 'Bewirtschaftung',
	stweg: 'Gemeinschaft',
	unit: 'Einheiten und Wertquoten',
	party: 'Eigentümer',
	ownership: 'Eigentum',
	person: 'Personen',
	usufruct: 'Nutzniessung',
	bylaw: 'Reglement',
	meeting: 'Versammlung',
	agenda: 'Traktanden',
	requirement: 'Mehrheitserfordernis',
	quorum: 'Beschlussfähigkeit',
	vote: 'Abstimmung',
	attendance: 'Anwesenheit',
	proxy: 'Vollmacht',
	representation: 'Vertretung',
	instruction: 'Weisung',
	access: 'Zugänge',
	room: 'Saalmeldungen',
	minutes: 'Protokoll',
	todo: 'Pendenzen',
	objection: 'Rügen',
	attachment: 'Unterlagen',
	business: 'Gemeinsames Geschäft',
	import: 'Übernahme',
	seal: 'Siegel'
};

/** Der Bereich einer Ereignisart — der Namensteil vor dem ersten Punkt. */
export function bereichVon(art: string): string {
	return art.split('.')[0] ?? art;
}

/**
 * Der Name eines Bereichs.
 *
 * Unbekannte Bereiche kommen unverändert zurück statt als «Sonstiges»: Eine
 * neue Ereignisart soll im Filter auftauchen, auch wenn hier noch niemand einen
 * deutschen Namen nachgetragen hat. Ein Sammelposten verstecke sie.
 */
export function bereichsname(bereich: string): string {
	return BEREICHSNAMEN[bereich] ?? bereich;
}

/** Ob überhaupt etwas eingeschränkt ist — sonst braucht es kein «Filter aufheben». */
export function istGefiltert(filter: Verlaufsfilter): boolean {
	return Boolean(
		filter.suche?.trim() ||
			filter.bereich ||
			filter.art ||
			filter.gegenstand ||
			filter.versammlung ||
			filter.gemeinschaft ||
			filter.abend ||
			filter.von ||
			filter.bis
	);
}

/**
 * Die Adresse zu einem Filterstand.
 *
 * **Alle Angaben kommen mit, auch beim Blättern.** Vorher trugen die Verweise
 * «Neuere» und «Ältere» nur die Ereignisart weiter: Wer den Verlauf einer
 * einzelnen Versammlung durchblätterte, stand nach dem ersten Klick im
 * Gesamtverlauf — ohne dass es jemandem auffiel, denn die Seite sah gleich aus.
 *
 * Leere Angaben und die erste Seite stehen nicht in der Adresse. Ein
 * `?seite=0&art=` im Lesezeichen ist kein Fehler, aber es macht jede
 * weitergeschickte Adresse unleserlich.
 */
export function verlaufsAdresse(filter: Verlaufsfilter, seite = 0): string {
	const teile = new URLSearchParams();
	const setze = (name: string, wert: string | undefined) => {
		const w = wert?.trim();
		if (w) teile.set(name, w);
	};
	setze('suche', filter.suche);
	setze('bereich', filter.bereich);
	setze('art', filter.art);
	setze('gegenstand', filter.gegenstand);
	setze('versammlung', filter.versammlung);
	setze('gemeinschaft', filter.gemeinschaft);
	setze('abend', filter.abend);
	setze('von', filter.von);
	setze('bis', filter.bis);
	if (seite > 0) teile.set('seite', String(seite));
	const abfrage = teile.toString();
	return abfrage ? `/verlauf?${abfrage}` : '/verlauf';
}
