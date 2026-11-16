/**
 * Suche in früheren Geschäften (Story 3.9, FR-11, AD-1).
 *
 * Die Suche selbst geschieht in der Datenbank — sie kann das besser. Hier steht,
 * was danach damit geschieht: die Fundstelle im Text finden, sie mit Umgebung
 * zeigen und die Treffer sinnvoll ordnen.
 *
 * **Warum das nicht der Datenbank überlassen ist:** Eine Textstelle mit
 * Umgebung ist eine Anzeigefrage, keine Speicherfrage, und sie ist die Stelle,
 * an der eine Suche brauchbar oder unbrauchbar wird. Als reine Funktion lässt
 * sie sich mit einer Wertetabelle prüfen — mit einer Datenbankfunktion nicht.
 */

import { zeichenzahl } from './zeichenzahl';

/** Ein durchsuchbares Feld eines Traktandums, mit seiner Beschriftung. */
export interface Fundstelle {
	feld: 'titel' | 'kurzfassung' | 'inhalt' | 'antragswortlaut';
	beschriftung: string;
	auszug: string;
}

const BESCHRIFTUNGEN: Record<Fundstelle['feld'], string> = {
	titel: 'Titel',
	kurzfassung: 'Kurzfassung',
	inhalt: 'Inhalt',
	antragswortlaut: 'Antragswortlaut'
};

/**
 * Vergleich ohne Rücksicht auf Gross- und Kleinschreibung und auf Akzente.
 *
 * Wer nach «Fassade» sucht, will «fassade» und «FASSADE» finden. Und wer nach
 * «Petrovic» sucht, weil er das Häkchen nicht auf der Tastatur hat, will
 * «Petrović» finden — sonst führt die Suche gerade bei den Namen ins Leere, bei
 * denen sie am nötigsten wäre.
 */
export function vergleichsform(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

/**
 * Findet die Fundstelle und gibt sie mit Umgebung zurück.
 *
 * Die Umgebung ist der Punkt: «…die Fassade wird saniert…» sagt, worum es geht;
 * ein blosses «gefunden in: Inhalt» sagt nichts, und der Suchende muss jedes
 * Ergebnis einzeln öffnen.
 */
export function auszugMit(text: string, suchbegriff: string, umgebung = 60): string | null {
	if (!text || !suchbegriff) return null;

	const heuhaufen = vergleichsform(text);
	const nadel = vergleichsform(suchbegriff);
	const stelle = heuhaufen.indexOf(nadel);
	if (stelle < 0) return null;

	// Auf Wortgrenzen ausdehnen, damit der Auszug nicht mitten im Wort beginnt.
	let von = Math.max(0, stelle - umgebung);
	let bis = Math.min(text.length, stelle + nadel.length + umgebung);
	while (von > 0 && !/\s/.test(text[von - 1])) von--;
	while (bis < text.length && !/\s/.test(text[bis])) bis++;

	const kern = text.slice(von, bis).trim();
	return `${von > 0 ? '… ' : ''}${kern}${bis < text.length ? ' …' : ''}`;
}

export interface Durchsuchbares {
	titel: string;
	kurzfassung?: string | null;
	inhalt?: string | null;
	antragswortlaut?: string | null;
}

/**
 * Alle Fundstellen eines Traktandums, in der Reihenfolge ihrer Aussagekraft.
 *
 * Titel und Antragswortlaut zuerst: Wer nach «Fassade» sucht und ein Traktandum
 * findet, das so heisst, ist am Ziel. Ein Treffer tief im Inhalt kann eine
 * Nebenbemerkung sein.
 */
export function fundstellen(t: Durchsuchbares, suchbegriff: string): Fundstelle[] {
	const felder: [Fundstelle['feld'], string | null | undefined][] = [
		['titel', t.titel],
		['antragswortlaut', t.antragswortlaut],
		['kurzfassung', t.kurzfassung],
		['inhalt', t.inhalt]
	];

	const treffer: Fundstelle[] = [];
	for (const [feld, wert] of felder) {
		if (!wert) continue;
		const auszug = auszugMit(wert, suchbegriff);
		if (auszug) treffer.push({ feld, beschriftung: BESCHRIFTUNGEN[feld], auszug });
	}
	return treffer;
}

/** Was die Suche verlangt, damit sie brauchbar bleibt. */
export const KUERZESTER_SUCHBEGRIFF = 3;

export function suchbegriffBrauchbar(begriff: string): boolean {
	return zeichenzahl(begriff.trim()) >= KUERZESTER_SUCHBEGRIFF;
}

export function suchhinweis(begriff: string): string | null {
	const gekuerzt = begriff.trim();
	if (gekuerzt === '') return null;
	if (zeichenzahl(gekuerzt) < KUERZESTER_SUCHBEGRIFF) {
		return (
			`Ein Suchbegriff braucht mindestens ${KUERZESTER_SUCHBEGRIFF} Zeichen. ` +
			`Kürzere fänden fast jedes Traktandum, und das ist dasselbe wie nichts zu finden.`
		);
	}
	return null;
}

// ── Kennzahlen der Historie ────────────────────────────────────────────────

export interface Versammlungszeile {
	id: string;
	datum: string;
	art: 'ordentlich' | 'ausserordentlich';
	stufe: 'erste' | 'zweite';
	zustand: string;
	ort: string;
	anzahlTraktanden: number;
	anzahlAbstimmungen: number;
	/**
	 * Zahl der gefassten Beschlüsse.
	 *
	 * In Welle 1 immer `null` und nicht `0`: Beschlüsse entstehen erst mit der
	 * Auszählung in Epic 5. Eine Null stünde da wie «es wurde nichts
	 * beschlossen» — und das wäre für eine durchgeführte Versammlung eine
	 * Falschaussage.
	 */
	anzahlBeschluesse: number | null;
}

/**
 * Art und Stufe in Worten: «Ordentliche Versammlung», «Ausserordentliche
 * Zweitversammlung». Eine Stelle für die Liste der eigenen Versammlungen und die
 * der eingespielten (Codeprüfung 06.10.2026); dort kommen die Werte aus dem
 * Manifest eines Abschlusspakets und sind nur als Text gesichert.
 */
export function versammlungsartInWorten(art: string, stufe: string): string {
	const eigenschaft = art === 'ordentlich' ? 'Ordentliche' : 'Ausserordentliche';
	return `${eigenschaft} ${stufe === 'zweite' ? 'Zweitversammlung' : 'Versammlung'}`;
}

/**
 * Ein Satz für die Liste: was diese Versammlung war und wie weit sie ist.
 *
 * Eigenschaftswort und Nomen sind **ein** Glied (06.10.2026, UI-Durchgang):
 * Als zwei Glieder der Aufzählung stand «Ordentliche, Versammlung, 14
 * Traktanden» da, mit einem Komma mitten in der Bezeichnung.
 */
export function versammlungInWorten(v: Versammlungszeile): string {
	const teile = [versammlungsartInWorten(v.art, v.stufe)];
	teile.push(
		`${v.anzahlTraktanden} ${v.anzahlTraktanden === 1 ? 'Traktandum' : 'Traktanden'}`
	);
	if (v.anzahlAbstimmungen > 0) {
		teile.push(
			`davon ${v.anzahlAbstimmungen} ${v.anzahlAbstimmungen === 1 ? 'Abstimmung' : 'Abstimmungen'}`
		);
	}
	return teile.join(', ');
}

/**
 * Wie die Zahl der Beschlüsse anzuzeigen ist.
 *
 * `null` heisst: noch nicht erfasst, nicht «keine». Der Unterschied ist derselbe
 * wie zwischen «keine Reglementsabweichung» und «noch nie nachgesehen».
 */
export function beschluesseInWorten(anzahl: number | null): string {
	if (anzahl === null) return 'Beschlüsse werden ab der Auszählung geführt.';
	if (anzahl === 0) return 'Kein Beschluss gefasst.';
	return `${anzahl} ${anzahl === 1 ? 'Beschluss' : 'Beschlüsse'}`;
}
