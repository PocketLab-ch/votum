/**
 * Die Angaben zu einem Menschen, unabhängig von der Eigentumsform.
 *
 * **Warum es diese Datei gibt** (Task 8 des Hüllen-Plans, gebaut am 04.09.2026).
 * Der Auftraggeber hat am 27.08.2026 beim Durchsehen viermal dieselbe Sache gefunden: Die
 * Erfassungsmaske behandelte einen Menschen verschieden, je nachdem ob er
 * allein besitzt oder mitberechtigt ist. Einmal gab es die Frage «Wen tragen
 * Sie ein?», einmal nicht; einmal ein Telefonfeld, einmal keins; einmal einen
 * Weg zur Adresse der Gemeinschaft, einmal keinen.
 *
 * Jede Lücke war für sich klein, jede wurde einzeln behoben, und **gefunden hat
 * sie ein Mensch beim Hinsehen, nicht ein Wächter**. Beim nächsten Feld
 * wiederholt sich das, solange die Angaben an zwei Stellen beschrieben stehen.
 *
 * **Was hier gemessen wurde, bevor die Datei entstand** (04.09.2026): Der Typ
 * `Beteiligter` stand **viermal** wortgleich da, `personenliste()`,
 * `alsEingabe()` und `adresseFuerAlle()` je **zweimal**, und die Bausteine für
 * Zeile und Wahlfrage ebenfalls zweimal.
 *
 * **Auseinandergelaufen war davon noch nichts**, und das ist der Grund, es
 * jetzt zu tun statt später: Die Kommentare mit den Begründungen standen nur an
 * je einer der beiden Stellen. Wer die Kopie ändert, hat die Gründe nicht vor
 * sich, und genau so entstehen die Unterschiede, die dann ein Mensch findet.
 *
 * **Zwei Formen derselben vier Angaben**, und der Unterschied ist die Leerform:
 * Ein Formularfeld schickt einen leeren Text, die Datenbank führt `null`. Genau
 * dazwischen übersetzt `alsGespeichert`, und weil beide Formen hier stehen,
 * ist ein neues Feld, das nur in einer davon ankommt, ein Fehler beim
 * Übersetzen statt einer stillen Lücke in einer Maske.
 */

/**
 * Die vier Angaben, so wie ein Formular sie schickt: leer ist ein leerer Text,
 * nie `null` und nie `undefined`.
 */
export interface Personenangaben {
	name: string;
	email: string;
	telefon: string;
	adresse: string;
}

/**
 * Dieselben vier Angaben, so wie sie gespeichert werden: leer ist `null`.
 *
 * `name` bleibt ein Text, weil eine Zeile ohne Namen gar nicht erst angelegt
 * wird (`pruefeEigentuemer` sagt `name_zu_kurz` ab).
 */
export interface GespeichertePersonenangaben {
	name: string;
	email: string | null;
	telefon: string | null;
	adresse: string | null;
}

/**
 * Eine Zeile der Personenliste, so wie sie aus dem Formular kommt.
 *
 * **Ohne Kennung, und das ist Absicht.** Der Server liest die Kennungen in eine
 * eigene Reihe und bildet den gewählten Vertreter als **Stellung** darin ab
 * (`vertreterIndex`); die Maske setzt daraus beim Zurückspielen wieder `p0`,
 * `p1` und so fort. Trüge diese Zeile ihre echte Kennung, gewänne sie beim
 * Zurückspielen gegen die gestellte, und nach einer Absage zeigte der
 * Auswahlknopf «Übt die Stimme aus» auf niemanden mehr: Wer die erste von drei
 * Personen wegnimmt, hat p1 und p2, während der Index 0 und 1 meint.
 */
export interface Beteiligtenwahl extends Personenangaben {
	/**
	 * «neu» oder «bestehend» — was die Auswahl der Zeile sagt.
	 *
	 * **Beide Felder gibt es seit dem 27.08.2026.** Vorher nahm die Liste nur
	 * Namen entgegen und legte deshalb **immer** neue Zeilen an: Stand A schon
	 * irgendwo, entstand ein zweites A. Formal zwei Menschen, von der Datenbank
	 * nicht abgefangen, und am Versammlungstag erkennt niemand mehr, dass es
	 * derselbe ist.
	 */
	wahl: PersonenWahl;
	/** Die gewählte Person, wenn `wahl` auf «bestehend» steht. */
	personId: string;
}

/**
 * Dieselbe Zeile in der Maske, die zusätzlich eine Kennung führt.
 *
 * Über die Kennung hält die Maske die Zeilen auseinander, wenn eine dazukommt
 * oder wegfällt. Kennungen werden nie wiederverwendet.
 */
export interface Beteiligter extends Beteiligtenwahl {
	kennung: string;
}

export type PersonenWahl = 'neu' | 'bestehend';

/** Was aus dem Auswahlfeld kommt, auf die zwei gültigen Werte gebracht. */
export function alsWahl(wert: string): PersonenWahl {
	return wert === 'bestehend' ? 'bestehend' : 'neu';
}

/** Eine leere Zeile unter der gegebenen Kennung. */
export function leereZeile(kennung: string): Beteiligter {
	return { kennung, name: '', email: '', telefon: '', adresse: '', wahl: 'neu', personId: '' };
}

/**
 * Die Personenliste einer gemeinschaftlichen Zeile aus dem Formular.
 *
 * **Sieben gleich lange Reihen, verbunden über die Stellung.** Jede
 * Personenzeile schickt genau ein Feld je Reihe, auch die, die sie gerade nicht
 * zeigt: Im Zweig «bestehend» stehen Name, E-Mail, Telefon und Anschrift als
 * leere verborgene Felder da, im Zweig «neu» die Personenkennung. Ohne diese
 * Fülllöcher verschöbe sich alles um eins, sobald eine Zeile den Zweig
 * wechselt, und die zweite Person bekäme die Anschrift der ersten.
 *
 * `gleichlang` ist die Antwort darauf, ob das noch stimmt. Von der Maske stimmt
 * es immer; von aussen ist eine Absage die richtige Antwort.
 *
 * **Die Felder werden in der Aktion gelesen, nicht hier drin.** Sonst sähe
 * `scripts/check-kennungen.mjs` sie nicht mehr: Er liest die `daten.get`-Aufrufe
 * im Körper der Aktion, und ein Formular, das als Ganzes weitergereicht wird,
 * verbirgt seine Felder vor ihm.
 */
export function personenliste(reihen: {
	kennungen: string[];
	namen: string[];
	emails: string[];
	telefone: string[];
	adressen: string[];
	wahlen: string[];
	personIds: string[];
}): { kennungen: string[]; beteiligte: Beteiligtenwahl[]; gleichlang: boolean } {
	const { kennungen, namen, emails, telefone, adressen, wahlen, personIds } = reihen;

	const beteiligte: Beteiligtenwahl[] = namen.map((name, i) => ({
		name,
		email: emails[i] ?? '',
		telefon: telefone[i] ?? '',
		adresse: adressen[i] ?? '',
		wahl: alsWahl(wahlen[i] ?? ''),
		personId: personIds[i] ?? ''
	}));

	const gleichlang = [kennungen, emails, telefone, adressen, wahlen, personIds].every(
		(reihe) => reihe.length === namen.length
	);
	return { kennungen, beteiligte, gleichlang };
}

/**
 * Aus der Formularzeile werden die Angaben, wie sie gespeichert werden.
 *
 * **Die Wahl entscheidet, nicht das gefüllte Feld** (27.08.2026). Stünde hier
 * «`personId`, wenn eine da ist», bliebe eine Kennung aus einem früheren Zweig
 * wirksam, nachdem jemand zurück auf «neu» gestellt hat, und die Zeile hinge an
 * einem Menschen, dessen Namen die Maske gar nicht mehr zeigt.
 */
export function alsGespeichert(b: Beteiligtenwahl): GespeichertePersonenangaben & {
	personId?: string | null;
} {
	if (b.wahl === 'bestehend') {
		return { name: '', email: null, telefon: null, adresse: null, personId: b.personId || null };
	}
	return {
		name: b.name,
		email: b.email || null,
		telefon: b.telefon || null,
		adresse: b.adresse || null
	};
}
