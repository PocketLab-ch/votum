/**
 * Feste und wiederkehrende Traktanden (Story 3.8, AD-1, AD-4).
 *
 * Als **Daten**, nicht als Code: Die Zusammensetzung einer ordentlichen
 * Versammlung ist Fachwissen, kein Ablauf. Wer sie ändern will — weil ein
 * Reglement etwas anderes vorsieht oder das Gesetz sich ändert —, ändert eine
 * Liste und nicht eine Funktion. Dasselbe Argument wie beim Regelwerk (AD-4).
 *
 * Die Vorlagen tragen ihr Mehrheitserfordernis nicht als fertiges Erfordernis,
 * sondern als Geschäftsart und Rechtsgrundlage. Der Grund: Das Erfordernis
 * entsteht aus dem Regelwerk der jeweiligen Fassung und kann durch eine
 * Reglementsabweichung verändert sein. Trüge die Vorlage ein fertiges
 * Erfordernis, ginge beides an ihr vorbei.
 */
import type { Geschaeftsart } from './regelwerk';
import type { Antragstellerart, Traktandumart } from './traktanden';

export interface Traktandumvorlage {
	/** Stabile Kennung. Erscheint im Verlauf und erlaubt, eine Vorlage wiederzuerkennen. */
	schluessel: string;
	titel: string;
	art: Traktandumart;
	kurzfassung?: string;
	antragswortlaut?: string;
	antragstellerart: Antragstellerart;
	/** Anknüpfungspunkt für Reglementsabweichungen. */
	geschaeftsart?: Geschaeftsart;
	/**
	 * Der Ergebnisknoten des Regelwerks, aus dem das Erfordernis entsteht.
	 *
	 * Nicht das fertige Erfordernis: Es hängt an der Regelfassung und kann durch
	 * eine Reglementsabweichung verändert sein. Trüge die Vorlage ein fertiges,
	 * ginge beides an ihr vorbei. Ein Knoten, den es in der geladenen Fassung
	 * nicht gibt, führt dazu, dass das Traktandum ohne Erfordernis entsteht — mit
	 * dem üblichen Hinweis, statt mit einem stillen Fehlwert.
	 */
	knotenId?: string;
	/**
	 * Die Rechtsgrundlage — **nur** wo kein Knoten sie schon trägt.
	 *
	 * Wo `knotenId` gesetzt ist, steht sie im Regelwerk und wandert mit dem
	 * Erfordernis ans Traktandum. Sie hier zu wiederholen ergäbe zwei Angaben, die
	 * auseinanderlaufen können — und zwei Artikel zum selben Geschäft sind
	 * schlimmer als einer.
	 */
	rechtsgrundlage?: string;
	/**
	 * Ob dieses Traktandum mit einer laufenden Berechnung verbunden ist.
	 *
	 * Bei der Beschlussfähigkeit sollen die Zahlen aus dem Check-in von selbst
	 * dort stehen und nicht abgetippt werden. Ein abgetippter Wert wäre der
	 * Stand von vorhin, nicht der von jetzt.
	 */
	rechnet?: 'beschlussfaehigkeit';
}

/**
 * Die festen Traktanden — bei jeder Versammlung, ordentlich wie ausserordentlich.
 *
 * Sie entstehen ohne Zutun. Eine Vorlage, die erst «angewandt» werden muss,
 * wird beim ersten Mal vergessen, und dann fehlt im Protokoll die Feststellung
 * der Beschlussfähigkeit — der Punkt, an dem sich später entscheidet, ob die
 * Versammlung überhaupt beschliessen durfte.
 */
export const FESTE_TRAKTANDEN: Traktandumvorlage[] = [
	{
		schluessel: 'begruessung',
		titel: 'Begrüssung und Feststellung der Beschlussfähigkeit',
		art: 'kenntnisnahme',
		kurzfassung:
			'Die Sitzungsleitung begrüsst und stellt fest, ob die Versammlung beschlussfähig ist.',
		antragstellerart: 'bewirtschaftung',
		rechtsgrundlage: 'ZGB Art. 712p',
		rechnet: 'beschlussfaehigkeit'
	},
	{
		schluessel: 'stimmenzaehler',
		titel: 'Wahl der Stimmenzähler',
		art: 'abstimmung',
		antragswortlaut: 'Die Versammlung wählt die Stimmenzähler.',
		kurzfassung: 'Wer die Stimmen zählt und das Ergebnis bestätigt.',
		antragstellerart: 'bewirtschaftung',
		knotenId: 'k-organ-waehlen',
		geschaeftsart: 'organe'
	}
];

/**
 * Die wiederkehrenden Jahresgeschäfte — nur bei der ordentlichen Versammlung.
 *
 * Bei einer ausserordentlichen wären sie fehl am Platz: Sie wird aus einem
 * Anlass einberufen, und eine Jahresrechnung gehört nicht dazu. Stünde sie
 * trotzdem auf der Liste, müsste die Sitzungsleitung sie jedes Mal wegräumen —
 * und irgendwann bliebe sie stehen.
 *
 * **Die Reihenfolge ist die Logik des Abends, nicht eine Liste** (Auftraggeber,
 * 01.09.2026): «In der Logik kommt zuerst der Bericht Revisoren und dann wird
 * die Jahresrechnung freigegeben. Danach die Décharge der Verwaltung. Nachher
 * kommen die restlichen Traktanden.»
 *
 * Das ist die Reihenfolge, in der die Punkte aufeinander aufbauen: Die
 * Revisionsstelle berichtet ÜBER die Rechnung, also muss ihr Bericht vorliegen,
 * bevor die Versammlung die Rechnung genehmigt. Und die Décharge entlastet die
 * Bewirtschaftung für ein Jahr, dessen Rechnung eben genehmigt wurde; vor der
 * Genehmigung entlastet sie für etwas, das die Versammlung noch nicht
 * angenommen hat. Budget und Erneuerungsfonds schauen nach vorn und stehen
 * deshalb dahinter.
 *
 * Bis zum 01.09.2026 stand die Jahresrechnung vor dem Revisionsbericht und die
 * Décharge ganz am Schluss. Wer die Liste unverändert übernahm, stimmte über
 * die Rechnung ab, bevor der Bericht dazu verlesen war.
 *
 * Gehalten wird das von `tests/domain/traktandenvorlage.test.ts`. Eine
 * Gemeinschaft mit eigener Reihenfolge (Migration 097) behält sie.
 *
 * **Mit einem Vorbehalt** (Code-Review 01.09.2026): Der Knopf auf der
 * Reglementsseite schickt immer alle Schlüssel mit, auch wenn niemand etwas
 * verschoben hat. Eine gespeicherte Ordnung ist deshalb nicht zwingend eine
 * Entscheidung — sie kann auch ein Knopfdruck ohne Änderung gewesen sein, und
 * dann bekommt die Gemeinschaft diese Verbesserung hier nicht mit. Auf Dev und
 * Prod ist `agenda_template_order` leer (01.09.2026 nachgezählt: null Zeilen),
 * es ist also niemand betroffen. Der Knopf sagt seither, was er tut.
 */
export const JAHRESGESCHAEFTE: Traktandumvorlage[] = [
	{
		schluessel: 'protokoll',
		titel: 'Genehmigung des Protokolls der letzten Versammlung',
		art: 'abstimmung',
		antragswortlaut: 'Das Protokoll der letzten Versammlung wird genehmigt.',
		/*
		 * **Kein Gesprächston** (Auftraggeber, 28.08.2026). Hier stand «Stimmt das, was
		 * beim letzten Mal aufgeschrieben wurde?» — verständlich, aber die
		 * Kurzfassung steht auf der Einladung und im Protokoll, und dort ist sie
		 * die Ankündigung eines Beschlusses, nicht eine Frage in die Runde.
		 *
		 * **Und sie erklärt den Punkt, statt ihn zu wiederholen.** Ein Satz wie
		 * «Die Versammlung genehmigt das Protokoll der letzten Versammlung»
		 * stünde im PDF zwischen Titel und Antragswortlaut als dritte fast
		 * gleiche Zeile. Alle Schwestervorlagen sagen stattdessen, worum es
		 * geht — «Was im vergangenen Jahr eingenommen und ausgegeben wurde»,
		 * «Wie viel zurückgelegt wird für spätere grosse Arbeiten».
		 */
		kurzfassung:
			'Ob das Protokoll der letzten Versammlung richtig wiedergibt, was beschlossen wurde.',
		antragstellerart: 'bewirtschaftung',
		knotenId: 'k-decharge',
		geschaeftsart: 'jahresgeschaefte'
	},
	{
		schluessel: 'revision',
		titel: 'Bericht der Revisionsstelle',
		art: 'kenntnisnahme',
		kurzfassung: 'Was die Revisionsstelle zur Jahresrechnung feststellt.',
		antragstellerart: 'bewirtschaftung',
		rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 5'
	},
	{
		schluessel: 'jahresrechnung',
		titel: 'Jahresrechnung',
		art: 'abstimmung',
		antragswortlaut: 'Die Jahresrechnung wird genehmigt.',
		kurzfassung: 'Was im vergangenen Jahr eingenommen und ausgegeben wurde.',
		antragstellerart: 'bewirtschaftung',
		knotenId: 'k-jahresrechnung',
		geschaeftsart: 'jahresgeschaefte'
	},
	{
		schluessel: 'decharge',
		titel: 'Décharge an die Bewirtschaftung',
		art: 'abstimmung',
		antragswortlaut: 'Der Bewirtschaftung wird für das vergangene Geschäftsjahr Décharge erteilt.',
		kurzfassung:
			'Die Gemeinschaft entlastet die Bewirtschaftung für das vergangene Jahr — sie verzichtet damit auf Ansprüche aus bekannten Vorgängen.',
		antragstellerart: 'gemeinschaft',
		knotenId: 'k-decharge',
		geschaeftsart: 'jahresgeschaefte'
	},
	{
		schluessel: 'budget',
		titel: 'Budget und Beiträge',
		art: 'abstimmung',
		antragswortlaut: 'Das Budget und die daraus folgenden Beiträge werden genehmigt.',
		kurzfassung: 'Was im kommenden Jahr gebraucht wird und wie viel jeder beiträgt.',
		antragstellerart: 'bewirtschaftung',
		knotenId: 'k-jahresrechnung',
		geschaeftsart: 'jahresgeschaefte'
	},
	{
		schluessel: 'erneuerungsfonds',
		titel: 'Erneuerungsfonds',
		art: 'abstimmung',
		antragswortlaut: 'Die Einlage in den Erneuerungsfonds wird beschlossen.',
		kurzfassung: 'Wie viel zurückgelegt wird für spätere grosse Arbeiten.',
		antragstellerart: 'bewirtschaftung',
		knotenId: 'k-erneuerungsfonds',
		geschaeftsart: 'jahresgeschaefte'
	},
];

/**
 * Welche Vorlagen bei welcher Versammlungsart entstehen.
 */
export function vorlagenFuer(art: 'ordentlich' | 'ausserordentlich'): Traktandumvorlage[] {
	return art === 'ordentlich'
		? [...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE]
		: [...FESTE_TRAKTANDEN];
}

/**
 * Sortiert Vorlagen nach einer gespeicherten Ordnung (Block C2, 31.08.2026).
 *
 * **Gespeicherte zuerst, neue danach.** Kommt mit einem Code-Update eine neue
 * Vorlage hinzu, muss sie erscheinen, auch wenn die gespeicherte Ordnung sie
 * nicht kennt — sie steht am Schluss. Umgekehrt wird ein gespeicherter
 * Schlüssel, den es nicht mehr gibt, still ignoriert: Die Zeile bleibt in der
 * Datenbank, aber nichts hängt mehr daran.
 *
 * **`null` heisst: keine Ordnung gespeichert.** Dann gilt die Code-Reihenfolge
 * unverändert — das ist der Zustand jeder Gemeinschaft, die noch nie
 * sortiert hat.
 *
 * Als reine Funktion im Kern, damit die Merge-Regel ohne Datenbank prüfbar
 * ist. Trüge eine Vorlagenliste zwei Vorlagen mit demselben Schlüssel, behielte
 * die Map nur die letzte — ein solcher Bestand ist im Code nicht vorgesehen
 * (die Schlüssel sind dort eindeutig), und beim Speichern weist der Server
 * doppelte Schlüssel ab.
 */
export function ordneVorlagen(
	vorlagen: Traktandumvorlage[],
	gespeichert: string[] | null
): Traktandumvorlage[] {
	if (gespeichert === null || gespeichert.length === 0) return vorlagen;

	const nachSchluessel = new Map(vorlagen.map((v) => [v.schluessel, v]));
	const geordnet: Traktandumvorlage[] = [];
	for (const schluessel of gespeichert) {
		const vorlage = nachSchluessel.get(schluessel);
		if (vorlage) {
			geordnet.push(vorlage);
			nachSchluessel.delete(schluessel);
		}
	}
	// Was keine gespeicherte Ordnung kennt, folgt in Code-Reihenfolge.
	return [...geordnet, ...nachSchluessel.values()];
}

/**
 * Der Hinweis beim Entfernen eines festen Traktandums.
 *
 * Entfernen ist zulässig — es gibt Versammlungen, die anders ablaufen. Aber die
 * Feststellung der Beschlussfähigkeit gehört zum ordentlichen Ablauf, und ohne
 * sie fehlt im Protokoll der Punkt, an dem sich später entscheidet, ob die
 * Versammlung überhaupt beschliessen durfte.
 */
export function entfernungshinweis(schluessel: string): string | null {
	if (schluessel === 'begruessung') {
		return (
			'Die Feststellung der Beschlussfähigkeit gehört zum ordentlichen Ablauf (ZGB Art. 712p). ' +
			'Ohne sie fehlt im Protokoll der Punkt, an dem sich später entscheidet, ob die Versammlung ' +
			'beschliessen durfte.'
		);
	}
	if (schluessel === 'stimmenzaehler') {
		return 'Ohne gewählte Stimmenzähler bestätigt niemand das Ergebnis der Auszählung.';
	}
	return null;
}

// ── Übernahme aus einer früheren Versammlung ────────────────────────────────

/**
 * Was bei der Übernahme mitwandert — und was nicht.
 *
 * Anhänge bleiben zurück: Eine Offerte aus dem Vorjahr ist nicht mehr gültig,
 * und sie mitzunehmen erweckte den Anschein, sie sei es. Ergebnisse und
 * Beschlüsse bleiben ebenfalls zurück — sie gehören zu der Versammlung, die sie
 * gefasst hat.
 */
export interface Uebernahmequelle {
	traktandumId: string;
	nummer: string;
	titel: string;
	art: Traktandumart;
	inhalt?: string;
	kurzfassung?: string;
	antragswortlaut?: string;
	antragstellerart: Antragstellerart;
	/** Fassungskennung des Erfordernisses von damals. */
	erfordernisFassung?: string;
	erfordernisTitel?: string;
	hatAnhaenge: boolean;
	hatBeschluss: boolean;
}

export interface Uebernahmebefund {
	quelle: Uebernahmequelle;
	/** Was beim Übernehmen zurückbleibt, damit es nicht überrascht. */
	bleibtZurueck: string[];
	/** Hinweis, wenn seither eine neuere Fassung des Regelwerks gilt. */
	fassungshinweis: string | null;
}

export function pruefeUebernahme(
	quelle: Uebernahmequelle,
	aktuelleFassung: string
): Uebernahmebefund {
	const bleibtZurueck: string[] = [];
	if (quelle.hatAnhaenge) {
		bleibtZurueck.push(
			'Die Anhänge bleiben zurück. Eine Offerte aus der früheren Versammlung ist nicht mehr ' +
				'gültig, und sie mitzunehmen erweckte den Anschein, sie sei es.'
		);
	}
	if (quelle.hatBeschluss) {
		bleibtZurueck.push(
			'Das Ergebnis bleibt zurück. Es gehört zu der Versammlung, die es gefasst hat.'
		);
	}

	// Die Fassungskennung wandert mit — das Erfordernis von damals gilt weiter,
	// bis jemand es neu herleitet. Der Hinweis macht sichtbar, dass es sich lohnt.
	const fassungshinweis =
		quelle.erfordernisFassung && quelle.erfordernisFassung !== aktuelleFassung
			? `Das Mehrheitserfordernis stammt aus der Regelfassung ${quelle.erfordernisFassung}; ` +
				`inzwischen gilt ${aktuelleFassung}. Prüfen Sie, ob es noch stimmt — übernommen wird es ` +
				`unverändert, damit sich nichts still ändert.`
			: null;

	return { quelle, bleibtZurueck, fassungshinweis };
}

/** Die Kennzeichnung am übernommenen Traktandum, solange es unbearbeitet ist. */
export function herkunftstext(datum: string): string {
	return `übernommen aus der Versammlung vom ${datum}`;
}

/**
 * Ob dieses Traktandum die Beschlussfähigkeit zum Gegenstand hat.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Das Pflichttraktandum Feststellung der
 * Beschlussfähigkeit braucht die Sicht, um zu sehen, ob man beschlussfähig
 * ist.» An der Wand steht die Beschlussfähigkeit sonst klein — hier gehört sie
 * gross hin, denn sie IST der Punkt.
 *
 * **Über den Titel, wie beim Entfernungshinweis.** Die Vorlagenkennung steht
 * nicht an der Zeile; die Entscheidung dazu ist alt und begründet («sie hätte
 * sich mit dem ersten Bearbeiten überlebt», `traktanden.ts`). Deshalb dasselbe
 * Verfahren: der Titel.
 *
 * **Nicht nur der Vorlagentitel.** Wer sein Traktandum «Feststellung der
 * Beschlussfähigkeit und Wahl des Protokollführers» nennt, meint dieselbe
 * Sache. Das Wort selbst ist das Erkennungsmerkmal — und es ist eindeutig
 * genug: Ein Traktandum, in dessen Titel «beschlussfähig» steht, hat sie zum
 * Gegenstand.
 *
 * Die Grenze: Wer den Punkt «Begrüssung» nennt, bekommt die grosse Sicht nicht.
 * Dann steht sie klein da wie überall sonst — kein Verlust, nur kein Gewinn.
 *
 * **Für die Sicht trägt das, für die Steuerung nicht allein** (25.09.2026). Am
 * Abend entscheidet derselbe Prüfer mit, ob ein Punkt als ein Schritt für alle
 * Häuser läuft. Der Titel oben trägt das Wort und ist zugleich eine Wahl, über
 * die abgestimmt wird. Deshalb verlangt `laeuftGemeinsam` zusätzlich, dass
 * überall eine Kenntnisnahme steht.
 */
export function stelltBeschlussfaehigkeitFest(titel: string): boolean {
	return titel.toLocaleLowerCase('de-CH').includes('beschlussfähig');
}
