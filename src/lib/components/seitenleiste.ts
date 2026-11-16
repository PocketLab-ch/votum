/**
 * Die Form der Seitenleiste — als eigene Datei, weil ein Svelte-Baustein aus
 * seinem Anweisungsteil keine Typen ausgibt und beide Seiten dieselbe Form
 * brauchen: die Leiste, um sie zu zeichnen, und der Rahmen, um sie zu füllen.
 */

export interface Leistenpunkt {
	titel: string;
	/** Null bedeutet gesperrt: kein Verweis, keine Tabulatorstelle. */
	pfad: string | null;
	/** Was gerade gilt — «14 Einheiten, Saldo geht auf». */
	stand?: string;
	/** Nur bei gesperrt, und dann immer: Eine Sperre ohne Grund ist eine Sackgasse. */
	sperrgrund?: string;
	zustand?: 'erledigt' | 'offen' | 'gesperrt';
	/**
	 * Was hier fehlt — «2 Einheiten ohne Eigentümer», «Saldo geht nicht auf».
	 *
	 * Gemeldet am 12.08.2026: «Bei Eigentümer und Zuordnung und auch Einheiten
	 * und Wertquoten mit einem Icon kennzeichnen, wenn die Zuordnungen nicht
	 * vollständig ist. Ziel, damit der Nutzer es sofort sieht.» Vorher stand die
	 * Lücke nur auf der Seite selbst — man musste sie öffnen, um zu erfahren,
	 * dass dort etwas offen ist.
	 *
	 * **Ein Satz, nicht nur ein Zeichen.** Ein «!» allein sagt, dass etwas ist,
	 * aber nicht was; und wer per Sprachausgabe liest, hört gar nichts. Das
	 * Zeichen steht daneben, damit es im Vorbeisehen auffällt.
	 */
	warnung?: string;
	/** Öffnet in einem eigenen Fenster — PDF, Beamersicht. */
	extern?: boolean;
}

export interface Leistengruppe {
	titel: string | null;
	punkte: Leistenpunkt[];
}

/**
 * Zeigt dieser Punkt auf die Seite, auf der man gerade steht?
 *
 * **Der Abfrageteil unterscheidet mit, wenn der Punkt einen trägt.** Gemeldet am
 * 12.08.2026: «Obwohl ich auf Reglement und Quoren bin, zeigt die Sitelink
 * Einheiten und Wertquoten an.» Die vier Stammdatenschritte einer gemeinsamen
 * Versammlung führen alle auf `/tage/<id>/stammdaten` und unterscheiden sich nur
 * durch `?thema=`; wer den Abfrageteil wegschnitt, markierte immer den ersten.
 *
 * Verglichen wird nur, was der **Punkt** mitbringt: Die Seite darf weitere
 * Parameter tragen — einen Stichtag, eine Herkunft `?zur=` —, ohne dass die
 * Marke verschwindet. Andersherum wäre es falsch: Ein Punkt ohne Abfrageteil
 * («Verlauf dieser Gemeinschaft») zeigt auf etwas anderes als derselbe Pfad mit
 * einem, und beide stehen in derselben Leiste.
 */
export function zeigtHierher(punktpfad: string | null, hier: string, abfrage: URLSearchParams): boolean {
	if (punktpfad === null) return false;
	const [pfad, teil] = punktpfad.split('?');
	if (hier !== pfad) return false;
	if (!teil) return true;
	return [...new URLSearchParams(teil)].every(([k, v]) => abfrage.get(k) === v);
}
