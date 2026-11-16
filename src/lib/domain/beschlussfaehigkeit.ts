/**
 * Beschlussfähigkeit nach ZGB Art. 712p (Story 2.6, FR-18, AD-1, AD-16).
 *
 * **Art. 712p:**
 *   Abs. 1 — Die Versammlung ist beschlussfähig, wenn die Hälfte aller
 *   Stockwerkeigentümer, die zugleich zur Hälfte anteilsberechtigt sind,
 *   mindestens aber zwei, anwesend oder vertreten sind.
 *   Abs. 2 — Bei ungenügender Beteiligung ist eine zweite Versammlung
 *   einzuberufen, die nicht vor Ablauf von zehn Tagen seit der ersten
 *   stattfinden darf. Die Frist beginnt am Tag nach der ersten Versammlung
 *   (Rz. 41 ad Art. 712p), der erste zulässige Termin liegt also elf Tage
 *   danach. Siehe `MINDESTABSTAND_TAGE` in `versammlung.ts`.
 *   Abs. 3 — Die zweite Versammlung ist beschlussfähig, wenn ein Drittel aller
 *   Stockwerkeigentümer, mindestens aber zwei, anwesend oder vertreten sind.
 *
 * Zwei Feinheiten, an denen sich leicht verrechnet:
 *
 *   - «die Hälfte» heisst **mindestens** die Hälfte, nicht mehr als die Hälfte.
 *     Zehn von zwanzig genügen. Wer hier die Mehrheitsformel `floor(n/2)+1`
 *     verwendet, verlangt elf und erklärt eine beschlussfähige Versammlung für
 *     unfähig.
 *   - Bei der zweiten Versammlung entfällt die Anteilsbedingung ganz. Sie
 *     stehenzulassen, machte die Erleichterung wirkungslos.
 */
import { FachlicherFehler } from './gemeinschaft';
import { zeichenzahl } from './zeichenzahl';
import { schwelle, type Schwelle } from './mehrheit';
import { FRIST_KURZ } from './versammlung';

/**
 * Erste oder zweite Versammlung im Sinne von Art. 712p — die **Stufe**, nicht
 * die Art.
 *
 * Die Unterscheidung im Namen ist keine Pedanterie: Eine Versammlung hat
 * daneben eine Art (ordentlich oder ausserordentlich), und beide erscheinen auf
 * demselben Formular. Trügen sie denselben Begriff, wäre eine ausserordentliche
 * Zweitversammlung nicht mehr beschreibbar, ohne dass jemand rät, welches «Art»
 * gemeint ist.
 */
export type Versammlungsstufe = 'erste' | 'zweite';

/** Die gesetzlichen Schwellen. Hier als Daten, damit die Erschwerung durch das Reglement dagegen prüfbar ist. */
export const GESETZLICH: Record<
	Versammlungsstufe,
	{ kopf: Schwelle; quoten: Schwelle | null; mindestens: number }
> = {
	erste: {
		kopf: { zaehler: 1, nenner: 2, art: 'mindestens' },
		quoten: { zaehler: 1, nenner: 2, art: 'mindestens' },
		mindestens: 2
	},
	zweite: {
		kopf: { zaehler: 1, nenner: 3, art: 'mindestens' },
		quoten: null,
		mindestens: 2
	}
};

export interface Beteiligung {
	/**
	 * Stockwerkeigentümer insgesamt — **Personen, nicht Stimmen**.
	 *
	 * Art. 712p Abs. 1 verlangt «die Hälfte aller Stockwerkeigentümer …
	 * mindestens aber zwei», Abs. 3 «ein Drittel aller Stockwerkeigentümer,
	 * mindestens aber zwei». Beides zählt Köpfe im wörtlichen Sinn.
	 *
	 * **Warum das eine eigene Zahl sein muss** (26.08.2026): Bis dahin stand hier
	 * nur `kopfstimmenGesamt`, und das ist bei der Zählweise «je Einheit» die Zahl
	 * der **Einheiten**. Wem zwei Wohnungen gehören, der brachte damit zwei
	 * «Köpfe» mit und erfüllte allein das «mindestens aber zwei». Die Versammlung
	 * galt als beschlussfähig, obwohl nur ein Mensch im Raum sass.
	 *
	 * Die Zählweise darf daran nichts ändern: Art. 712p ist relativ zwingend, das
	 * Reglement kann ihn erschweren, nicht erleichtern. Ein reglementarisches
	 * Anteilsstimmrecht verschiebt die Mehrheit, nicht die Beschlussfähigkeit.
	 */
	eigentuemerGesamt: number;
	/** Anwesend oder vertreten — wieder Personen. */
	eigentuemerAnwesend: number;
	/**
	 * Kopfstimmen insgesamt (alle Eigentümer beziehungsweise alle Einheiten).
	 *
	 * Für die Beschlussfähigkeit **nicht** massgebend; sie steht hier, weil das
	 * Protokoll sie ausweist und die Mehrheit auf ihr rechnet.
	 */
	kopfstimmenGesamt: number;
	/** Anwesend oder vertreten. */
	kopfstimmenAnwesend: number;
	gesamtquote: number;
	quotenAnwesend: number;
	/**
	 * Alle Anteile gehören einer Partei aus mehreren Personen (`docs/entscheide/0016`).
	 * Optional, weil Aufrufer ohne Momentaufnahme (Proben, alte Feststellungen)
	 * es nicht wissen; fehlt es, gilt der Satz für eine Person.
	 */
	einzigeParteiGemeinsam?: boolean;
}

export interface Beschlussfaehigkeitsregel {
	kopf: Schwelle;
	quoten: Schwelle | null;
	mindestens: number;
	/** Fundstelle im Reglement. Pflicht, wo abgewichen wird. */
	fundstelle: string;
}

export interface Bedingung {
	bezeichnung: string;
	noetig: number;
	vorhanden: number;
	/**
	 * Das Ganze, auf das sich `vorhanden` bezieht — alle Eigentümer, alle
	 * Wertquoten.
	 *
	 * **Der Anlass** (Auftraggeber, 11.09.2026): «Was hier fehlt ist, von wie vielen
	 * Eigentümern man ausgeht. Also 16 von 17, mindestens 9.» Der Balken der
	 * Sitzungsleitung zeigte «16 / 9» und liess offen, ob 16 alle sind oder fast
	 * alle. Ohne diese Zahl ist er voll, sobald die Schwelle erreicht ist — auch
	 * wenn noch jemand fehlt.
	 *
	 * Die Schwelle ist **keine** Bezugsgrösse, sondern eine Untergrenze; siehe
	 * `bedingungInWorten`. Erst mit dem Ganzen daneben lassen sich beide Zahlen
	 * lesen, ohne dass eine die andere erklären muss.
	 */
	gesamt: number;
	erfuellt: boolean;
}

/**
 * Eine Bedingung in Worten.
 *
 * **Nicht «14 von 7 nötigen».** «X von Y» heisst im Deutschen ein Teil von
 * einem Ganzen, und ein Teil ist nie grösser als sein Ganzes. Genau das stand
 * aber da, sobald die Versammlung gut besucht war — und las sich wie ein
 * Rechenfehler des Werkzeugs, ausgerechnet an der Stelle, die belegen soll,
 * dass beschlossen werden darf.
 *
 * Die Schwelle ist keine Bezugsgrösse, sondern eine Untergrenze. Der Satz sagt
 * das jetzt: erst was da ist, dann was mindestens sein muss.
 */
export function bedingungInWorten(b: Bedingung): string {
	return `${b.bezeichnung}: ${b.vorhanden}, mindestens ${b.noetig} nötig`;
}

/**
 * Der Satz zur Einpersonengemeinschaft (Ä-17, Produktentscheid 18.10.2026,
 * `docs/entscheide/0011`).
 *
 * Gehören alle Stockwerkanteile einer Person, setzt `stelleBeschlussfaehigkeitFest`
 * das gesetzliche «mindestens aber zwei» (Art. 712p Abs. 1) auf eins und stellt
 * die Versammlung beschlussfähig fest. Das trägt nur eine Lehrmeinung: Der
 * einzige Eigentümer kann «in der vorliegend vertretenen Auffassung» eine
 * Versammlung allein durchführen und die Beschlüsse protokollieren (Rz. 12 ad
 * Art. 712p), er «ist gehalten», es zu tun (Rz. 21a ad Art. 712m). Am
 * Volltext nachgesehen am 18.10.2026. Ein schriftlicher Beschluss als Vorgabe
 * ist dort nicht belegt.
 *
 * **Fassung vom 13.11.2026** (Produktentscheid zu Entscheid 0048, Antwort 8,
 * «Ja, Satz ergänzen»; Laien- und Fachprüfung `quellen`
 * `pruefung/berichte/2026-11-13-votum-einziger-eigentuemer.md`, «Übernommene
 * Fassung»): Die Rechnung bleibt, der Satz nennt dazu den Weg, der unabhängig
 * von der Lehrmeinung trägt. Stimmen alle Eigentümer schriftlich zu, steht das
 * einem Beschluss gleich (ZGB Art. 66 Abs. 2 mit Art. 712m Abs. 2), und die
 * eigenhändige Unterschrift unter dem Protokoll ist diese Zustimmung; eine
 * weitere Form des Geschäfts ersetzt sie nicht.
 */
export const EINZIGER_EIGENTUEMER_KURZ =
	'Alle Stockwerkanteile gehören einer Person. Für die Beschlussfähigkeit nennt das Gesetz ' +
	'mindestens zwei Eigentümer. Nach einer Lehrmeinung hält die Person die Versammlung allein ' +
	'ab und protokolliert die Beschlüsse. Unabhängig davon gilt: Stimmen alle Eigentümer einem ' +
	'Antrag schriftlich zu, stellt das Gesetz das einem Beschluss gleich. Unterschreibt die Person ' +
	'das Protokoll eigenhändig und mit Datum, liegt diese Zustimmung vor; bewahren Sie es auf. ' +
	'Verlangt ein Geschäft eine weitere Form, etwa die öffentliche Beurkundung, ersetzt die ' +
	'Unterschrift sie nicht.';

/**
 * Dasselbe mit Fundstellen, für Feststellungssatz und Protokoll: Dort liest im
 * Streitfall ein Gericht, und «Rz. 12» ohne Werk führte in den Zürcher
 * Kommentar mit anderer Zählung (Fachprüfung 18.10.2026). Die Leitung zeigt
 * vor dem Festhalten `EINZIGER_EIGENTUEMER_KURZ`.
 *
 * **Eine eigene Konstante, keine Ableitung** (seit 13.11.2026): Die Fundstellen
 * stehen je Satz, und der Rat «bewahren Sie es auf» steht nur in der
 * Kurzfassung für die Leitung, nicht im Protokoll. Beide Wortlaute sind die
 * geprüften, je wörtlich.
 */
export const EINZIGER_EIGENTUEMER =
	'Alle Stockwerkanteile gehören einer Person. Für die Beschlussfähigkeit nennt das Gesetz ' +
	'mindestens zwei Eigentümer (ZGB Art. 712p Abs. 1). Nach einer Lehrmeinung hält die Person die ' +
	'Versammlung allein ab und protokolliert die Beschlüsse (Wermelinger, SVIT-Kommentar, Rz. 12 ad ' +
	'Art. 712p, Rz. 21a ad Art. 712m). Unabhängig davon gilt: Stimmen alle Eigentümer einem Antrag ' +
	'schriftlich zu, stellt das Gesetz das einem Beschluss gleich (ZGB Art. 66 Abs. 2 mit Art. 712m ' +
	'Abs. 2; BGE 127 III 506 E. 3a). Unterschreibt die Person das Protokoll eigenhändig und mit ' +
	'Datum, liegt diese Zustimmung vor. Verlangt ein Geschäft eine weitere Form, etwa die ' +
	'öffentliche Beurkundung, ersetzt die Unterschrift sie nicht.';

/**
 * Derselbe Fall, wenn die einzige Partei mehrere Personen sind (Produktentscheid
 * 20.10.2026, `docs/entscheide/0016`). Gezählt wird ein Eigentümer (Rz. 15 ad
 * Art. 712p); ob die Lehrmeinung zum einzigen Eigentümer auch hier gilt, sagt
 * keine Stelle im Bestand. Laien- und Fachprüfung in vier Runden (`quellen`
 * `pruefung/berichte/2026-10-20-votum-drei-saetze.md`): «sicher» verspräche zu
 * viel, «die Anwesenden bevollmächtigt» war in beide Richtungen lesbar.
 */
export const EINZIGE_GEMEINSCHAFT_KURZ =
	'Alle Stockwerkanteile gehören mehreren Personen gemeinsam, etwa einem Ehepaar oder einer ' +
	'Erbengemeinschaft. Für die Beschlussfähigkeit nennt das Gesetz mindestens zwei Eigentümer; ' +
	'nach einer Lehrmeinung hält ein einziger Eigentümer die Versammlung allein ab. Ob das auch ' +
	'für gemeinsame Eigentümer gilt, ist offen. Am sichersten ist es, wenn alle da sind oder die ' +
	'Fehlenden den Anwesenden eine Vollmacht gegeben haben.';

/** Mit Fundstellen, für Feststellungssatz und Protokoll. */
export const EINZIGE_GEMEINSCHAFT = EINZIGE_GEMEINSCHAFT_KURZ.replace(
	'allein ab.',
	'allein ab (Wermelinger, SVIT-Kommentar, Rz. 12 ad Art. 712p, Rz. 21a ad Art. 712m).'
).replace(/\.$/, ' (vgl. Rz. 19 und 20 ad Art. 712o).');

/** Der Satz zum einzigen Eigentümer, je nachdem, ob er mehrere Personen sind. */
export function satzZumEinzigen(gemeinsam: boolean | undefined, mitFundstellen: boolean): string {
	if (gemeinsam) return mitFundstellen ? EINZIGE_GEMEINSCHAFT : EINZIGE_GEMEINSCHAFT_KURZ;
	return mitFundstellen ? EINZIGER_EIGENTUEMER : EINZIGER_EIGENTUEMER_KURZ;
}

export interface Beschlussfaehigkeit {
	art: Versammlungsstufe;
	beschlussfaehig: boolean;
	/**
	 * Gehören alle Anteile einer Person (`eigentuemerGesamt === 1`)? Dann gilt
	 * die Feststellung nur nach einer Lehrmeinung (`EINZIGER_EIGENTUEMER`).
	 */
	einzigerEigentuemer: boolean;
	/** Und die einzige Partei sind mehrere Personen (`docs/entscheide/0016`). */
	einzigerGemeinsam: boolean;
	bedingungen: Bedingung[];
	/** Was fehlt, in einem Satz. Leer, wenn nichts fehlt. */
	fehlt: string;
	/** Woher die angewandten Schwellen stammen. */
	grundlage: 'gesetz' | 'reglement';
	fundstelle?: string;
}

/**
 * Stellt die Beschlussfähigkeit fest.
 *
 * Die Regel des Reglements ist freiwillig; fehlt sie, gilt das Gesetz. Sie darf
 * nur erschweren — die Prüfung dazu steht in `pruefeErschwerung` und läuft beim
 * Hinterlegen, nicht hier: Eine unzulässige Regel soll gar nicht erst
 * gespeichert werden können.
 */
export function stelleBeschlussfaehigkeitFest(
	art: Versammlungsstufe,
	beteiligung: Beteiligung,
	regel?: Beschlussfaehigkeitsregel | null
): Beschlussfaehigkeit {
	const angewandt = regel ?? GESETZLICH[art];

	/*
	 * **Ohne Stimmberechtigte gibt es keine Beschlussfähigkeit** (23.08.2026,
	 * Prüflauf II, Durchgang A).
	 *
	 * Arithmetisch ist «0 von 0, mindestens 0 nötig» erfüllt — und der Kern
	 * meldete deshalb einen grünen Haken für eine Gemeinschaft ohne eine einzige
	 * stimmberechtigte Partei. Im Prüflauf stand er auf der Übersicht einer
	 * Gruppe, unter der dreissig Parteien in zwei Häusern hingen: «✓
	 * Beschlussfähig — 0, mindestens 0 nötig».
	 *
	 * **Dieselbe Falle ist in der Auszählung längst erkannt** («Eine leere Basis
	 * nimmt nichts an … ein Beschluss ohne Beschliessende», `auszaehlung.ts`) —
	 * an einer Stelle behoben, an der anderen nicht. Ein Werkzeug, das eine
	 * Versammlung ohne Stimmberechtigte für beschlussfähig erklärt, sagt den
	 * gefährlichsten Satz, den es sagen kann.
	 *
	 * Die Bedingungen bleiben leer: Sie zeigten sonst zweimal «0 / 0» und
	 * behaupteten damit eine Rechnung, die es nicht gibt.
	 */
	if (beteiligung.eigentuemerGesamt <= 0) {
		return {
			art,
			beschlussfaehig: false,
			einzigerEigentuemer: false,
			einzigerGemeinsam: false,
			bedingungen: [],
			fehlt: 'Es ist keine stimmberechtigte Partei erfasst — ohne sie kann nichts beschlossen werden.',
			grundlage: regel ? 'reglement' : 'gesetz',
			fundstelle: regel?.fundstelle
		};
	}

	/*
	 * **Eigentümer ohne Stimme sind etwas anderes als gar keine Eigentümer**
	 * (26.08.2026, aus dem Code-Review).
	 *
	 * Der Fall gibt es: eine Einstellhallen-Gemeinschaft, «je Einheit», alle
	 * Einheiten `parking`, und das Reglement zählt Nebenobjekte nicht als Kopf.
	 * Dann stehen zwölf Eigentümer da und null Kopfstimmen.
	 *
	 * Solange die Kopfbedingung an den Kopfstimmen hing, fiel das unter denselben
	 * Satz wie die leere Gemeinschaft. Das war schon vorher schief und wäre jetzt
	 * grob falsch: «Es ist keine stimmberechtigte Partei erfasst» ist eine
	 * Tatsachenbehauptung, und sie stimmt nicht. Beschliessen lässt sich trotzdem
	 * nichts — aber der Grund gehört benannt, sonst sucht jemand einen Fehler in
	 * der Eigentümerliste, der dort nicht ist.
	 */
	if (beteiligung.kopfstimmenGesamt <= 0) {
		return {
			art,
			beschlussfaehig: false,
			einzigerEigentuemer: false,
			einzigerGemeinsam: false,
			bedingungen: [],
			fehlt:
				'Keine Einheit trägt eine Kopfstimme — die Zählweise oder die Einstellung ' +
				'zu den Nebenobjekten schliesst alle aus. Ohne Stimme kann nichts beschlossen werden.',
			grundlage: regel ? 'reglement' : 'gesetz',
			fundstelle: regel?.fundstelle
		};
	}

	const bedingungen: Bedingung[] = [];

	/*
	 * **Gezählt werden Stockwerkeigentümer, nicht Stimmen** (26.08.2026).
	 *
	 * Bis hierher stand an beiden Stellen `kopfstimmen…`. Bei «je Einheit» sind
	 * das Einheiten: Wem drei Wohnungen gehören, der zählte als drei. Damit
	 * erfüllte ein einzelner Anwesender das «mindestens aber zwei» aus Art. 712p
	 * Abs. 1 im Alleingang — und die Versammlung galt als beschlussfähig, obwohl
	 * ihr das Wesentliche fehlte: ein zweiter Mensch.
	 *
	 * Bei «je Eigentümer» sind beide Zahlen gleich; dort ändert sich nichts.
	 */
	const noetigeKoepfe = Math.max(
		schwelle(beteiligung.eigentuemerGesamt, angewandt.kopf),
		// «mindestens aber zwei» — greift in Kleinstgemeinschaften, wo die Hälfte
		// von drei aufgerundet zwei ergibt, aber auch, wo die Hälfte von zwei
		// eins wäre. Und es greift nicht über den Bestand hinaus: Eine
		// Gemeinschaft mit einem einzigen Eigentümer ist ein Sonderfall des
		// Gesetzes, kein Rechenfehler.
		Math.min(angewandt.mindestens, beteiligung.eigentuemerGesamt)
	);
	bedingungen.push({
		bezeichnung: 'Stockwerkeigentümer anwesend oder vertreten',
		noetig: noetigeKoepfe,
		vorhanden: beteiligung.eigentuemerAnwesend,
		gesamt: beteiligung.eigentuemerGesamt,
		erfuellt: beteiligung.eigentuemerAnwesend >= noetigeKoepfe
	});

	if (angewandt.quoten) {
		const noetigeQuoten = schwelle(beteiligung.gesamtquote, angewandt.quoten);
		bedingungen.push({
			bezeichnung: 'Wertquoten anwesend oder vertreten',
			noetig: noetigeQuoten,
			vorhanden: beteiligung.quotenAnwesend,
			gesamt: beteiligung.gesamtquote,
			erfuellt: beteiligung.quotenAnwesend >= noetigeQuoten
		});
	}

	const offen = bedingungen.filter((b) => !b.erfuellt);

	return {
		art,
		beschlussfaehig: offen.length === 0,
		einzigerEigentuemer: beteiligung.eigentuemerGesamt === 1,
		einzigerGemeinsam: beteiligung.eigentuemerGesamt === 1 && beteiligung.einzigeParteiGemeinsam === true,
		bedingungen,
		fehlt: offen.map(bedingungInWorten).join('; '),
		grundlage: regel ? 'reglement' : 'gesetz',
		fundstelle: regel?.fundstelle
	};
}

/**
 * Prüft, ob eine Reglementsregel die Beschlussfähigkeit erschwert.
 *
 * Das Reglement darf die Beschlussfähigkeit erschweren, nicht erleichtern. Der
 * Grund ist der Minderheitenschutz: Ein tieferes Anwesenheitsquorum liesse eine
 * kleine Gruppe für alle entscheiden. Eine erleichternde Regel wird deshalb
 * abgewiesen und nicht etwa mit einem Hinweis übernommen — sie wäre ungültig,
 * und eine ungültige Regel im System sähe aus wie eine gültige.
 */
export function pruefeErschwerung(
	art: Versammlungsstufe,
	regel: Beschlussfaehigkeitsregel
): Beschlussfaehigkeitsregel {
	/*
	 * **Die Stufe ist bis hierher eine Behauptung** (Sicherheitsdurchgang
	 * 06.09.2026). Die Aktion nimmt sie mit `text(daten.get('art')) as
	 * Versammlungsstufe` entgegen — eine Zusicherung an den Übersetzer, keine
	 * Prüfung zur Laufzeit. Bei `art=dritte` oder einem fehlenden Feld ist
	 * `GESETZLICH[art]` schlicht `undefined`, und der erste Zugriff darauf wirft
	 * einen `TypeError` statt einer Absage: Fehlerseite statt Feldmeldung.
	 */
	const gesetz = GESETZLICH[art];
	if (!gesetz) {
		throw new FachlicherFehler(
			'stufe_unbekannt',
			'Wählen Sie, ob die Regel für die Erst- oder die Zweitversammlung gilt.',
			'art'
		);
	}

	if (!regel.fundstelle?.trim()) {
		throw new FachlicherFehler(
			'fundstelle_fehlt',
			'Die Fundstelle im Reglement ist anzugeben.',
			'fundstelle'
		);
	}

	/*
	 * **Erst prüfen, ob die Zahlen überhaupt speicherbar sind** (06.09.2026).
	 *
	 * Was hier durchkommt, geht als Nächstes in `bylaw_attendance_rule`. Deren
	 * Spalten sind `integer NOT NULL` und tragen den CHECK
	 * `bylaw_attendance_kopf_bruch`: Zähler ab 1, Nenner 2 bis 100, Zähler nicht
	 * grösser als der Nenner. Was diese Prüfung durchlässt und der CHECK nicht,
	 * bekommt der Benutzer als Satz zu lesen, der ihm nicht weiterhilft:
	 * `uebersetzeSchranke` macht aus 23514 einen `SchrankenFehler`, dessen
	 * Wortlaut selbst sagt «und die Anwendung hätte es vorher sagen müssen».
	 * Genau das tut sie jetzt. Zwei Fehlerarten entkommen dieser Übersetzung
	 * ganz und enden in einer Fehlerseite: 22P02 (der `NaN`-Fall) und 22003
	 * (eine Zahl ausserhalb des Wertebereichs von `integer`).
	 *
	 * **Gemessen, nicht vermutet** (Code-Review 06.09.2026): Ein erster Anlauf
	 * behauptete hier, eine Regel aus `NaN` sei gespeichert worden und habe über
	 * Beschlussfähigkeit entschieden. Das stimmt nicht. Der Treiber schickt
	 * `NaN` als Text «NaN» an eine `integer`-Spalte, Postgres antwortet mit
	 * 22P02, die Transaktion fällt zurück. Das Symptom war also eine 500-Seite
	 * an einer Stelle, an der eine Feldmeldung hingehört — schlimm genug, aber
	 * etwas anderes.
	 *
	 * **Die Prüfung bildet den CHECK nach und nicht `pruefeSchwelle`.** Jene
	 * gehört zu den Reglementsregeln, und dort ist `nenner === 1` ausdrücklich
	 * erlaubt (Einstimmigkeit, ZGB Art. 647e). Hier wäre derselbe Bruch ein
	 * Verstoss gegen den CHECK. Zwei Tabellen, zwei Schranken; eine gemeinsame
	 * Funktion müsste die strengere durchsetzen und bräche die andere Seite.
	 */
	const bruchfelder = [
		['kopf', regel.kopf],
		['quoten', regel.quoten]
	] as const;
	for (const [feld, sw] of bruchfelder) {
		if (!sw) continue;
		if (!Number.isInteger(sw.zaehler) || !Number.isInteger(sw.nenner)) {
			throw new FachlicherFehler(
				'schwelle_nicht_ganzzahlig',
				'Zähler und Nenner müssen ganze Zahlen sein.',
				feld
			);
		}
		if (sw.zaehler < 1 || sw.nenner < 2 || sw.nenner > 100) {
			throw new FachlicherFehler(
				'schwelle_unplausibel',
				'Der Bruch ist unplausibel: Zähler ab 1, Nenner von 2 bis 100.',
				feld
			);
		}
		if (sw.zaehler > sw.nenner) {
			throw new FachlicherFehler(
				'schwelle_ueber_ganzem',
				'Ein Anteil über der ganzen Bezugsgrösse wäre nie erreichbar.',
				feld
			);
		}
	}

	/*
	 * Die Mindestzahl ist ein Bruch nicht, sondern eine Personenzahl. Sie hat
	 * ihre eigene Meldung weiter unten («Die gesetzliche Untergrenze …»), und
	 * die soll auch bei 0 und 1 erscheinen — ein erster Anlauf schickte sie
	 * durch dieselbe Bruchschleife und meldete dann «Zähler und Nenner» für ein
	 * Feld, das keines von beiden hat.
	 */
	if (!Number.isInteger(regel.mindestens)) {
		throw new FachlicherFehler(
			'mindestzahl_keine_zahl',
			'Tragen Sie für die Mindestzahl eine ganze Zahl ein.',
			'mindestens'
		);
	}
	/*
	 * **Nach oben ebenfalls** (Sicherheitsdurchgang 06.09.2026). Die Untergrenze
	 * steht weiter unten im Gesetz, eine Obergrenze nirgends — und `min_heads`
	 * ist eine `integer`-Spalte. Eine Zahl darüber wird nicht von einem CHECK
	 * gefangen, sondern vom Wertebereich: Postgres antwortet mit 22003, und das
	 * übersetzt `uebersetzeSchranke` nicht. Die Grenze ist bewusst grosszügig;
	 * sie soll nicht fachlich urteilen, sondern nur speicherbar halten.
	 */
	if (regel.mindestens > 9999) {
		throw new FachlicherFehler(
			'mindestzahl_zu_gross',
			'Diese Mindestzahl ist keine Gemeinschaft mehr. Tragen Sie höchstens 9999 ein.',
			'mindestens'
		);
	}

	/*
	 * Auch die Fundstelle hat im CHECK eine Länge (`length(btrim(…)) >= 3`),
	 * während hier bisher nur auf «nicht leer» geprüft wurde. Zwei Zeichen
	 * kamen durch und schlugen in der Datenbank auf.
	 *
	 * **`zeichenzahl` und nicht `.length`**: Letzteres zählt UTF-16-Einheiten,
	 * Postgres zählt Zeichen. Bei einer Untergrenze wäre die Anwendung damit
	 * lockerer als ihre eigene Schranke — ein Zeichen ausserhalb der Grundebene
	 * zählte hier doppelt und käme durch. Der Wächter `check:zeichenzahl` hat
	 * genau das im ersten Anlauf gefangen.
	 */
	if (zeichenzahl(regel.fundstelle.trim()) < 3) {
		throw new FachlicherFehler(
			'fundstelle_zu_kurz',
			'Die Fundstelle braucht mindestens drei Zeichen — etwa «Reglement Ziff. 8.1».',
			'fundstelle'
		);
	}

	if (bruch(regel.kopf) < bruch(gesetz.kopf)) {
		throw new FachlicherFehler(
			'erleichterung_unzulaessig',
			`Das Reglement darf die Beschlussfähigkeit erschweren, nicht erleichtern (ZGB Art. 712p). ` +
				`Gesetzlich nötig sind ${anteilInWorten(gesetz.kopf)} der Stockwerkeigentümer.`,
			'kopf'
		);
	}

	// Die Anteilsbedingung ganz wegzulassen, wo das Gesetz sie kennt, ist
	// ebenfalls eine Erleichterung — und eine, die leicht übersehen wird, weil
	// sie nicht in einer Zahl steht, sondern in deren Fehlen.
	if (gesetz.quoten && !regel.quoten) {
		throw new FachlicherFehler(
			'erleichterung_unzulaessig',
			'Die Anteilsbedingung der ersten Versammlung wegzulassen, erleichtert die Beschlussfähigkeit. Das ist unzulässig.',
			'quoten'
		);
	}
	if (gesetz.quoten && regel.quoten && bruch(regel.quoten) < bruch(gesetz.quoten)) {
		throw new FachlicherFehler(
			'erleichterung_unzulaessig',
			`Das Reglement darf die Anteilsbedingung nicht senken. Gesetzlich nötig sind ${anteilInWorten(gesetz.quoten)} der Wertquoten.`,
			'quoten'
		);
	}

	if (regel.mindestens < gesetz.mindestens) {
		throw new FachlicherFehler(
			'erleichterung_unzulaessig',
			`Die gesetzliche Untergrenze von ${gesetz.mindestens} Stockwerkeigentümern darf nicht unterschritten werden.`,
			'mindestens'
		);
	}

	return { ...regel, fundstelle: regel.fundstelle.trim() };
}

/** Der Bruch als Verhältnis. Nur zum Vergleich zweier Schwellen, nie zum Zählen (AD-12). */
function bruch(s: Schwelle): number {
	return s.zaehler / s.nenner;
}

/**
 * Der Anteil in Worten — «die Hälfte» statt «1/2».
 *
 * Exportiert, weil die Oberfläche denselben Satz braucht: Wo das Reglement von
 * der gesetzlichen Schwelle abweicht, muss die abweichende Schwelle dort
 * stehen, wo jemand die Versammlungsstufe wählt. Zwei Fassungen desselben
 * Bruchs in Worten wären zwei Wahrheiten.
 */
export function anteilInWorten(s: Schwelle): string {
	if (s.zaehler === 1 && s.nenner === 2) return 'die Hälfte';
	if (s.zaehler === 1 && s.nenner === 3) return 'ein Drittel';
	if (s.zaehler === 2 && s.nenner === 3) return 'zwei Drittel';
	if (s.zaehler === 3 && s.nenner === 4) return 'drei Viertel';
	return `${s.zaehler}/${s.nenner}`;
}

/**
 * Der Hinweis, dass Beschlussfähigkeit bei Einstimmigkeit nicht genügt.
 *
 * Beschlussfähig heisst: Die Versammlung darf beschliessen. Bei einem
 * Einstimmigkeitserfordernis sagt das nichts darüber, ob der Beschluss zustande
 * kommt; dazu braucht es die Zustimmung aller, auch der Abwesenden. Eine grün
 * leuchtende Beschlussfähigkeit neben einem Einstimmigkeitstraktandum ist genau
 * die Art von richtiger Anzeige, die falsch verstanden wird.
 */
export const EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT =
	'Bei diesen Traktanden genügt die Beschlussfähigkeit nicht: Nötig ist in der Regel die ' +
	'Zustimmung aller Eigentümer. Wer nicht erscheint, muss vertreten sein, sonst fehlt seine ' +
	'Zustimmung. Was gilt, wenn eine fehlt, sagt die Karte des Traktandums.';

/**
 * Ohne Beschlussfähigkeit wird nicht verbindlich abgestimmt (Produktentscheid
 * 17.09.2026, Zweitprüfung der juristischen Gegenlesung, Ä-18).
 *
 * **Die Vorgeschichte.** Story 4.7 sah vor, zu warnen und nach einer
 * ausdrücklichen Bestätigung trotzdem abstimmen zu lassen, mit einem Vermerk im
 * Protokoll. Gebaut wurden Prüfung und Vermerk, angeschlossen nie:
 * `oeffneAbstimmung` fragte bis zum 17.09.2026 gar nicht nach der
 * Beschlussfähigkeit. Eine nicht beschlussfähige Versammlung konnte also ohne
 * jede Spur beschliessen.
 *
 * **Warum jetzt gesperrt und nicht gewarnt.** Ohne Beschlussfähigkeit fasst
 * die Versammlung keine Beschlüsse; diskutieren darf sie weiter (Wermelinger,
 * Rz. 26, 29 ad Art. 712p). Der Bestätigungsdialog hätte genau die
 * Willentlichkeit belegt, mit der Rz. 33 eine schwere Verletzung nichtig macht.
 * Die frühere Sorge, eine Sperre werde umgangen, trägt nicht mehr: Umgehen
 * liesse sie sich nur über eine falsch erfasste Anwesenheit, und jede Erfassung
 * steht mit Uhrzeit im Verlauf.
 *
 * **Der Ausweg ist die Tatsache, nicht die Rechtsfolge.** Ist jemand da, der
 * nicht als anwesend erfasst ist, berichtigt die Sitzungsleitung die
 * Anwesenheit. Sonst bleiben Warten und die zweite Versammlung.
 */
export function verlangeBeschlussfaehigkeit(b: Beschlussfaehigkeit): void {
	if (b.beschlussfaehig) return;

	// Die Sätze der Sonderfälle enden schon mit einem Punkt.
	const grund = b.fehlt.replace(/\.\s*$/, '');

	/*
	 * **Ohne Bedingungen liegt es nicht an der Anwesenheit** (Code-Review
	 * 17.09.2026). Keine stimmberechtigte Partei oder keine Kopfstimme: Dann
	 * helfen weder Nachzügler noch eine zweite Versammlung, und der Rat, die
	 * Anwesenheit zu berichtigen, schickte die Sitzungsleitung an die falsche
	 * Stelle.
	 */
	if (b.bedingungen.length === 0) {
		throw new FachlicherFehler(
			'nicht_beschlussfaehig',
			`Die Versammlung ist nicht beschlussfähig: ${grund}. Das liegt nicht an der Anwesenheit, sondern an der Eigentümerliste oder der Zählweise der Gemeinschaft.`,
			'beschlussfaehigkeit'
		);
	}

	const weiter =
		b.art === 'erste'
			? ` Sonst warten Sie auf Nachzügler oder berufen eine zweite Versammlung ein. ${FRIST_KURZ}`
			: ' Sonst warten Sie auf Nachzügler.';
	throw new FachlicherFehler(
		'nicht_beschlussfaehig',
		`Die Versammlung ist nicht beschlussfähig: ${grund}. Ohne Beschlussfähigkeit wird nicht verbindlich abgestimmt (ZGB Art. 712p). ` +
			'Ist jemand im Saal, der nicht als anwesend erfasst ist, berichtigen Sie die Anwesenheit.' +
			weiter,
		'beschlussfaehigkeit'
	);
}


/**
 * Eine **festgehaltene** Feststellung — der Befund zu einem Zeitpunkt.
 *
 * Der Unterschied zu `Beschlussfaehigkeit` ist der Zeitpunkt: Jene ist eine
 * Rechnung, die jederzeit neu ausfällt; diese ist das, was die Sitzungsleitung
 * um 17:12 festgestellt hat, mit den Zahlen von 17:12. Beides zu vermischen
 * hiesse, dass ein Beschluss von halb sieben nachträglich an Zahlen von halb
 * zehn hängt (Migration 080).
 */
export interface Feststellung {
	id: string;
	versammlungId: string;
	/** Das Traktandum, bei dem festgestellt wurde. Null, wenn keines lief. */
	traktandumId: string | null;
	zeitpunkt: Date;
	/** Wer festgestellt hat, im Klartext — das Protokoll weist ihn aus. */
	durch: string;
	kopfstimmenAnwesend: number;
	kopfstimmenGesamt: number;
	/**
	 * Anwesende und gesamte **Stockwerkeigentümer** — die Grundlage von 712p.
	 *
	 * `null` bei Feststellungen von vor dem 26.08.2026: Damals wurde auf
	 * Kopfstimmen festgestellt, und eine abgeschriebene Zahl behauptete, es sei
	 * dieselbe Grösse gewesen. Die Anzeige fällt für sie zurück und sagt es dazu.
	 */
	eigentuemerAnwesend: number | null;
	eigentuemerGesamt: number | null;
	/**
	 * Nicht in der Datenbank: nur gesetzt, wo die Feststellung eben gemacht
	 * wurde und die Momentaufnahme zur Hand war (`docs/entscheide/0016`).
	 */
	einzigeParteiGemeinsam?: boolean;
	quotenAnwesend: number;
	gesamtquote: number;
	beschlussfaehig: boolean;
	grundlage: 'gesetz' | 'reglement';
	fundstelle: string | null;
	/** Woran es fehlte. Null, wenn die Versammlung beschlussfähig war. */
	fehlt: string | null;
}

/**
 * Der Satz fürs Protokoll.
 *
 * Steht im Kern und nicht in der Schale, weil ihn drei Stellen brauchen — das
 * Protokoll einer Versammlung, das gemeinsame Protokoll eines Abends und die
 * Anzeige in der Sitzungsleitung. Drei Formulierungen für denselben Befund
 * wären drei Gelegenheiten, verschieden zu klingen.
 */
/**
 * Was in einem Haus festgestellt wurde — so viel, wie der Satz davon braucht.
 *
 * Bewusst nicht `Feststellung`: Diese Fassung kommt aus dem Abend, wo je Haus
 * gerechnet wird, und der Kern soll den Server-Typ nicht kennen.
 */
export interface Hausbefund {
	gemeinschaft: string;
	beschlussfaehig: boolean;
	/** «12 von 15» — dieselben Zahlen, die ins Protokoll gehen. */
	kopfstimmen: string;
	wertquoten: string;
	fehlt: string | null;
}

/**
 * Der Satz nach dem Feststellen am gemeinsamen Abend (Auftraggeber, 25.08.2026: «Also
 * welche Gemeinschaft ist beschlussfähig und welche nicht»).
 *
 * **Die nicht beschlussfähigen zuerst.** Wer den Knopf drückt, steht im Saal
 * und will weiterführen; was ihn aufhält, gehört an den Anfang des Satzes und
 * nicht ans Ende einer Aufzählung. Sind alle beschlussfähig, ist das eine
 * einzige kurze Zeile — der Regelfall soll nicht so lang aussehen wie der
 * Ausnahmefall.
 *
 * **Die Zahlen stehen nur bei den nicht beschlussfähigen.** Bei fünf Häusern
 * ergäben zehn Zahlenpaare eine Zeile, die niemand liest; woran es fehlt, ist
 * die Angabe, nach der gefragt wird.
 */
export function abendfeststellungssatz(befunde: Hausbefund[]): string {
	if (befunde.length === 0) return 'Nichts festgestellt.';

	const nicht = befunde.filter((b) => !b.beschlussfaehig);
	const ja = befunde.filter((b) => b.beschlussfaehig);

	if (nicht.length === 0) {
		return befunde.length === 1
			? `${befunde[0].gemeinschaft} ist beschlussfähig.`
			: `Alle ${befunde.length} Gemeinschaften sind beschlussfähig.`;
	}

	const teile = [
		`Nicht beschlussfähig: ${nicht
			.map((b) => `${b.gemeinschaft} (${b.fehlt ?? 'Grund nicht vermerkt'})`)
			.join(', ')}.`
	];
	if (ja.length > 0) {
		teile.push(`Beschlussfähig: ${ja.map((b) => b.gemeinschaft).join(', ')}.`);
	}
	return teile.join(' ');
}

/**
 * Was in einem Haus beim Sammelsiegel herauskam.
 *
 * Liegt hier neben `Hausbefund`, weil beide dasselbe tun: Sie tragen das
 * Ergebnis EINER Gemeinschaft aus einer Handlung, die über alle lief.
 */
/*
 * **Nicht `Siegelbefund`** — den Namen führt `server/siegel.ts` bereits für
 * etwas anderes (ob versiegelt werden KANN). Zwei gleichnamige Typen über
 * denselben Gegenstand sind eine Verwechslung, die beim Lesen passiert, nicht
 * beim Übersetzen.
 */
export interface Hausversiegelung {
	gemeinschaft: string;
	/** Die ersten Zeichen des Siegels — genug zum Wiedererkennen. */
	siegelkopf: string;
	/** Ob die Bezeugung durch die Zeitstempelstelle vorliegt. */
	zeitstempel: boolean;
}

/**
 * Der Satz nach dem Versiegeln am gemeinsamen Abend (Auftraggeber, 25.08.2026: «Warum
 * kann nicht auf der Stufe Gruppe versiegelt werden?»).
 *
 * **Ein Knopf, fünf Siegel — nicht ein Siegel für fünf.** Warum das kein
 * Widerspruch ist, steht in `docs/vererbung-abend.md`: Das Paket trägt neun
 * Bestandteile, und acht davon gibt es nur je Gemeinschaft. Was der Abend
 * abnimmt, ist das fünfmalige Klicken, nicht die Trennung der Pakete.
 *
 * **Der Zeitstempel steht dabei**, denn er ist der Teil, der ohne Netz
 * ausbleibt — und ein Siegel ohne Bezeugung ist im Streit weniger wert. Wer
 * das erst beim Nachsehen einzeln bemerkt, bemerkt es zu spät.
 */
export function abendsiegelsatz(befunde: Hausversiegelung[]): string {
	if (befunde.length === 0) return 'Nichts versiegelt.';

	const ohne = befunde.filter((b) => !b.zeitstempel);
	const kopf =
		befunde.length === 1
			? `${befunde[0].gemeinschaft} ist versiegelt (${befunde[0].siegelkopf}…).`
			: `${befunde.length} Gemeinschaften sind versiegelt.`;

	if (ohne.length === 0) {
		return `${kopf} Die Zeitstempel liegen vor.`;
	}
	return (
		`${kopf} Der Zeitstempel steht noch aus bei: ` +
		`${ohne.map((b) => b.gemeinschaft).join(', ')}. ` +
		'Das Siegel gilt auch ohne ihn; die Bezeugung lässt sich je Versammlung nachholen.'
	);
}

/**
 * `gemeinsam`: ob die einzige Partei mehrere Personen sind. Die Feststellung
 * hält das nicht fest; es steht in der Momentaufnahme der Versammlung, die sich
 * nach der Eröffnung nicht mehr ändert (`docs/entscheide/0016`).
 */
export function feststellungssatz(
	f: Feststellung,
	gemeinsam = f.einzigeParteiGemeinsam ?? false
): string {
	if (!f.beschlussfaehig) {
		return `Die Versammlung ist nicht beschlussfähig: ${f.fehlt}`;
	}
	// Das Kennzeichen hängt an der festgehaltenen Zahl, nicht an der heutigen
	// (Ä-17): Wer damals allein war, bleibt es im Protokoll. Dann ohne «(ZGB
	// 712p)»: Art. 712p verlangt gerade zwei, der Satz danach nennt die
	// Fundstellen (Fachprüfung 18.10.2026).
	// Auch unter einer Reglementsregel ohne Fundstelle, sonst stünde «(ZGB
	// 712p)» vor dem Satz, der sagt, dass Art. 712p zwei verlangt (Codeprüfung
	// 3d, L1).
	if (f.eigentuemerGesamt === 1 && !(f.grundlage === 'reglement' && f.fundstelle)) {
		return `Die Versammlung ist beschlussfähig. ${satzZumEinzigen(gemeinsam, true)}`;
	}
	const grund =
		f.grundlage === 'reglement' && f.fundstelle ? ` (${f.fundstelle})` : ' (ZGB 712p)';
	const einzig = f.eigentuemerGesamt === 1 ? ` ${satzZumEinzigen(gemeinsam, true)}` : '';
	return `Die Versammlung ist beschlussfähig${grund}.${einzig}`;
}

/** Was an einem Abend festgehalten und abgestimmt wurde, für `warZeitweiseBeschlussfaehig`. */
export interface Beschlussfaehigkeitsspur {
	feststellungen: readonly { beschlussfaehig: boolean }[];
	durchgaenge: readonly { konsultativ: boolean; vonHandOhneQuorum: boolean }[];
}

/**
 * Was beim Vertagen über die Folgeversammlung entscheidet: ob die vertagte
 * Versammlung an diesem Abend schon beschlussfähig war.
 *
 * **Die Regel** (F4c, Einteilung F3b zu C3; Produktentscheid 04.11.2026: die
 * Folgeversammlung als neue erste anlegen). Art. 712p Abs. 2 ZGB knüpft die
 * zweite Versammlung an die ungenügende Beteiligung an der ersten; nach
 * Rz. 20 und 34 ad Art. 712p folgt sie auf eine erste, die nicht durchgeführt
 * werden konnte. Ausdrücklich geregelt ist der Verlust mitten in der Sitzung
 * nicht, Gegenstimmen: Handschin/Wyttenbach S. 65, BGer 5A_865/2011 E. 5.1
 * (Fachprüfung F4c Block 2). Die strenge Lesart trägt für die
 * Beschlussfähigkeit unter beiden Lesarten, für die Zehntagesfrist nur, wenn
 * der Termin frühestens am elften Tag liegt; die milde wäre der Fall R3 (d)
 * des Restpakets.
 *
 * **Woran Votum es misst:** an einer festgehaltenen Feststellung «beschlussfähig»
 * oder an einem verbindlichen Durchgang. Ein verbindlicher Durchgang öffnet nur
 * nach der Prüfung der Beschlussfähigkeit (`verlangeBeschlussfaehigkeitFuer`),
 * auch wenn er danach abgebrochen oder ersetzt wurde. Ausgenommen ist der
 * Beschluss von Hand ohne Beschlussfähigkeit: Er geht an der Prüfung vorbei.
 * Eine nur angezeigte, nie festgehaltene Beschlussfähigkeit zählt nicht; sie
 * ist nicht belegt (Pendenz, Rz. 20 «bzw. deren Erreichung»).
 */
export function warZeitweiseBeschlussfaehig(spur: Beschlussfaehigkeitsspur): boolean {
	return (
		spur.feststellungen.some((f) => f.beschlussfaehig) ||
		spur.durchgaenge.some((d) => !d.konsultativ && !d.vonHandOhneQuorum)
	);
}

/**
 * Die Stufe der Folgeversammlung: die zweite nur, wenn die vertagte eine erste
 * war und an diesem Abend nie beschlussfähig. Sonst eine neue erste, mit der
 * Beschlussfähigkeit einer ersten (C3; Rz. 20 und 34 ad Art. 712p).
 */
export function folgestufeNachVertagung(
	stufe: Versammlungsstufe,
	zeitweiseBeschlussfaehig: boolean
): Versammlungsstufe {
	return stufe === 'erste' && !zeitweiseBeschlussfaehig ? 'zweite' : 'erste';
}
