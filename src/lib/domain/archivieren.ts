/**
 * Archivieren: da behalten, aus dem Weg räumen (Migration 086, rein).
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Kann man eigentlich archivieren? Also
 * dass die Daten noch da sind, aber nicht in der Suche und Anzeige erscheinen?»
 * — «Alles. Gemeinschaften, Eigentümer und Versammlungen.»
 *
 * **Nicht `archiv.ts`**: Der Name ist seit dem 30.07.2026 vergeben — dort liegt
 * das ZIP-Archiv für Kartensätze und Siegelpakete. Zwei verschiedene Dinge
 * unter einem Namen sind eine Verwechslung, die beim Lesen passiert.
 *
 * **Die eine Unterscheidung, um die es geht.** Eine Liste beantwortet entweder
 * «woraus wähle ich» oder «was gab es». Archiviertes gehört aus der ersten
 * heraus und muss in der zweiten bleiben:
 *
 *   auswaehlen   Gemeinschaftsliste, Startseite, Elternwahl, MEG-Mitglieder,
 *                Zuordnung zum Abend, Versammlung anlegen, Personenliste
 *   nachschlagen Verlauf, Protokoll, der Name einer Mitgliedsgemeinschaft,
 *                die Seite des Gegenstands selbst, jedes Siegelpaket
 *
 * Wer beide gleich behandelt, nimmt an einem Ende zu viel weg: Im Verlauf
 * stünden Zeilen ohne Namen, und eine bestehende MEG verlöre die Beschriftung
 * ihres Mitglieds.
 *
 * Rein: keine Datenbank, keine Uhr (AD-1).
 */
import { FachlicherFehler } from './gemeinschaft';
import type { Versammlungszustand } from './versammlung';

/**
 * Welche Zeilen eine Abfrage liefert.
 *
 * **Die Vorgabe ist `aktiv`** — und das ist Absicht: Wer eine neue Liste baut
 * und nicht an das Archiv denkt, bekommt das sichere Verhalten. Wer
 * Archiviertes braucht, muss es hinschreiben, und dann steht im Aufruf, warum.
 */
export type Sicht = 'aktiv' | 'alle';

/** Was archiviert werden kann. */
export type Archivart = 'gemeinschaft' | 'versammlung' | 'eigentuemer' | 'person';

export const ARCHIVARTEN: Record<Archivart, { einzahl: string; mehrzahl: string }> = {
	gemeinschaft: { einzahl: 'Gemeinschaft', mehrzahl: 'Gemeinschaften' },
	versammlung: { einzahl: 'Versammlung', mehrzahl: 'Versammlungen' },
	eigentuemer: { einzahl: 'Eigentümerzeile', mehrzahl: 'Eigentümerzeilen' },
	person: { einzahl: 'Person', mehrzahl: 'Personen' }
};

/**
 * Ob sich eine Versammlung in diesem Zustand archivieren lässt.
 *
 * **Nur die versiegelte.** Jeder andere Zustand bekommt eine eigene Absage mit
 * dem Weg heraus — die Gründe stehen im Rumpf.
 */
export function versammlungArchivierbar(
	zustand: Versammlungszustand,
	/**
	 * Ob an der Versammlung bereits eine Vollmacht hängt — in irgendeinem
	 * Zustand (Nachzug Block 3, Entscheid E vom 03.10.2026). Dann ist die
	 * Freigabe nicht mehr zurücknehmbar, und der Satz darf sie nicht mehr als
	 * Weg nennen: Wer ihm folgt, läuft in die Absage `vollmachten_haengen`.
	 */
	vollmachtenHaengen = false
): string | null {
	/*
	 * **Archiviert wird, was versiegelt ist** (Auftraggeber, 25.08.2026: «Archivieren
	 * erst was versiegelt wurde»).
	 *
	 * Die erste Fassung sperrte nur `laufend` und `freigegeben` — der Entwurf
	 * und die geschlossene, aber unversiegelte Versammlung liessen sich
	 * wegräumen. Beides ist falsch, aus zwei verschiedenen Gründen:
	 *
	 *   - Ein **Entwurf** ist kein Nachweis, sondern ein Plan. Was daran stört,
	 *     gehört gelöscht, nicht aufbewahrt — und löschen geht im Entwurf.
	 *     Archivieren wäre der bequemere Weg, der einen Papierkorb aus dem
	 *     Archiv machte.
	 *   - Eine **geschlossene, unversiegelte** Versammlung ist unfertige Arbeit.
	 *     Das Siegel ist der Nachweis, dass das Protokoll zu dem gehört, was im
	 *     Saal geschah; wer stattdessen archiviert, räumt genau diese Lücke aus
	 *     dem Blick.
	 */
	if (zustand === 'laufend') {
		return 'Diese Versammlung läuft gerade. Schliessen Sie sie zuerst.';
	}
	if (zustand === 'freigegeben') {
		if (vollmachtenHaengen) {
			return (
				'Diese Versammlung ist freigegeben: Die Einladungen sind draussen. Die Freigabe ' +
				'lässt sich nicht mehr zurücknehmen, weil bereits eine Vollmacht daran hängt, auch ' +
				'eine zurückgewiesene oder widerrufene. Eröffnen Sie die Versammlung, stellen Sie ' +
				'die Beschlussunfähigkeit fest, schliessen Sie sie und versiegeln Sie sie. Danach ' +
				'lässt sie sich archivieren.'
			);
		}
		return (
			'Diese Versammlung ist freigegeben: Die Einladungen sind draussen. Nehmen Sie die ' +
			'Freigabe zurück, oder eröffnen Sie die Versammlung, stellen Sie die ' +
			'Beschlussunfähigkeit fest, schliessen Sie sie und versiegeln Sie sie. Danach lässt ' +
			'sie sich archivieren.'
		);
	}
	if (zustand === 'entwurf') {
		return (
			'Diese Versammlung ist ein Entwurf und wurde nie gehalten. Was daran stört, gehört ' +
			'entfernt — archiviert wird, was versiegelt ist.'
		);
	}
	if (zustand === 'geschlossen') {
		return (
			'Diese Versammlung ist geschlossen, aber noch nicht versiegelt. Das Siegel ist der ' +
			'Nachweis, dass das Protokoll zu dem gehört, was im Saal geschah — versiegeln Sie sie ' +
			'zuerst, danach lässt sie sich archivieren.'
		);
	}
	return null;
}

export interface Archivlage {
	art: Archivart;
	/** Wie der Gegenstand heisst — steht in der Rückfrage und im Verlauf. */
	name: string;
	archiviertAm: string | null;
	/** Nur bei einer Versammlung gesetzt. */
	zustand?: Versammlungszustand;
	/**
	 * Nur bei einer freigegebenen Versammlung von Belang: ob bereits eine
	 * Vollmacht hängt. Dann nennt der Hindernissatz die Rücknahme nicht mehr.
	 */
	vollmachtenHaengen?: boolean;
}

/**
 * Prüft, ob archiviert werden darf — und wirft mit einem Satz, wenn nicht.
 *
 * **Warum hier und nicht als CHECK in der Datenbank.** Eine Schranke der
 * Datenbank ist keine Fehlermeldung (docs/gestaltung.md): Sie meldet
 * «verletzt constraint …» und lässt die Sitzungsleitung ratlos zurück. Und ein
 * CHECK schlüge später ein zweites Mal zu — beim Freigeben eines archivierten
 * Entwurfs, mit einer Meldung, die von der Freigabe handelt.
 */
export function pruefeArchivieren(lage: Archivlage): void {
	if (lage.archiviertAm) {
		throw new FachlicherFehler(
			'schon_archiviert',
			`${ARCHIVARTEN[lage.art].einzahl} «${lage.name}» liegt bereits im Archiv.`,
			'archiv'
		);
	}
	if (lage.art === 'versammlung' && lage.zustand) {
		const hindernis = versammlungArchivierbar(lage.zustand, lage.vollmachtenHaengen ?? false);
		if (hindernis) throw new FachlicherFehler('nicht_archivierbar', hindernis, 'archiv');
	}
}

/**
 * Ob sich eine Eigentümerzeile archivieren lässt.
 *
 * **Nein, solange ihr Einheiten zugeordnet sind** — und das ist die wichtigste
 * Schranke dieses ganzen Bausteins.
 *
 * `stimmkraftAnsicht` rechnet die Stimmkraft, und die Freigabe baut daraus die
 * Momentaufnahme einer Versammlung. Diese Rechnung fragt **nicht** nach dem
 * Archiv, mit Absicht: Sonst verlöre eine archivierte Partei ihre Stimme,
 * lautlos und sichtbar erst am Ergebnis. Damit Liste und Rechnung nicht
 * auseinanderlaufen, darf nur archiviert werden, wer ohnehin nicht mehr
 * mitzählt — wessen Zuordnung beendet ist.
 *
 * Der Eigentumswechsel ist zeitlich abgebildet (`unit_ownership.valid_to`); der
 * Weg heraus heisst also «Zuordnung beenden», nicht «Archiv erzwingen».
 */
export function pruefeEigentuemerArchivierbar(name: string, einheiten: string[]): void {
	if (einheiten.length === 0) return;
	throw new FachlicherFehler(
		'haelt_einheiten',
		`«${name}» sind noch Einheiten zugeordnet (${einheiten.join(', ')}). Solange ` +
			'zählt die Stimme mit, und die Zeile gehört in die Liste. Beenden Sie zuerst die ' +
			'Zuordnung — danach lässt sie sich archivieren.',
		'archiv'
	);
}

export function pruefeHervorholen(lage: Archivlage): void {
	if (!lage.archiviertAm) {
		throw new FachlicherFehler(
			'nicht_archiviert',
			`${ARCHIVARTEN[lage.art].einzahl} «${lage.name}» liegt gar nicht im Archiv.`,
			'archiv'
		);
	}
}

/**
 * Der Satz an der Leerstelle einer Suche ohne Treffer.
 *
 * **Der Fall, wegen dem man sonst eine eigene Archivseite baut** (der Auftraggeber fragte
 * genau danach: «Was ist besser eigene Seite oder Schalter?»). Ein Schalter
 * allein hat eine Lücke: Wer sucht und nichts findet, weiss nicht, dass im
 * Archiv etwas liegt. Er sucht dann anders, gibt auf — oder legt den Gegenstand
 * ein zweites Mal an.
 *
 * Deshalb rechnet die Leerstelle mit: Sie zählt, was im Archiv zur selben Suche
 * passt, und sagt es. Null heisst: Es gibt wirklich nichts, und dann steht der
 * Hinweis auch nicht da.
 */
export function archivhinweis(art: Archivart, treffer: number, gesucht: boolean): string | null {
	if (treffer <= 0) return null;
	const wort = treffer === 1 ? ARCHIVARTEN[art].einzahl : ARCHIVARTEN[art].mehrzahl;
	/*
	 * **«dazu» nur, wenn es ein «dazu» gibt** (25.08.2026, aus dem Code-Review).
	 * Ohne Suchbegriff stand «Im Archiv liegen 2 Gemeinschaften, die dazu
	 * passen» — eine Angabe, die auf nichts zeigt.
	 */
	if (!gesucht) {
		return treffer === 1
			? `Im Archiv liegt 1 ${wort}.`
			: `Im Archiv liegen ${treffer} ${wort}.`;
	}
	return treffer === 1
		? `Im Archiv liegt 1 ${wort}, die dazu passt.`
		: `Im Archiv liegen ${treffer} ${wort}, die dazu passen.`;
}
