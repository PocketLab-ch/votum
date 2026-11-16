/**
 * Die gespeicherten Codewörter des Verlaufs in Worten (V1, 06.10.2026).
 *
 * **Der Befund.** Die Spalte «Angaben» auf `/verlauf` zeigte die Werte, wie
 * sie in der Datenbank stehen:
 * «Zählweise: per_owner, Grundlage: gesetzliche_auffangregel»,
 * «Nachweis: original_vorgelegt», «Frist: naechste_versammlung». Die
 * Schlüssel davor waren seit B2 übersetzt (`ANGABEN_WOERTER`), die Werte
 * nicht.
 *
 * **Warum eine eigene Datei.** Die Wörter stehen schon in den Kernmodulen, die
 * die Werte führen (`WEGNAMEN`, `ANTRAGSTELLERARTEN` …). Diese Module brauchen
 * selbst `ereignis` aus `domain/verlauf.ts`; bände `verlauf.ts` sie ein,
 * entstünde ein Ring, und `.dependency-cruiser.cjs` (keine-ringe-im-kern) weist
 * ihn ab. Hier dagegen bindet niemand zurück. Die Leser (Verlaufsseite und
 * Verlaufsblatt im Siegelpaket) reichen das Ergebnis von `wertwoerter()` an
 * `angabenInWorten`.
 *
 * **Was hier steht, ist abgeschrieben, nicht erfunden.** Jede Zeile nimmt eine
 * bestehende Tabelle oder Funktion. Wo es keine gibt, steht der Wortlaut mit
 * seiner Fundstelle, und nur dann, wenn er dort eindeutig ist. Die zweite
 * Quelle ist die geprüfte Wortliste
 * (`quellen/pruefung/berichte/2026-10-08-votum-verlaufsblatt-woerter.md`); ein
 * Codewort ohne solche Quelle bleibt roh, wie es gespeichert ist.
 *
 * **Übersetzt wird nur das genaue Codewort.** Ein Schlüssel, der an einer
 * Schreibstelle Freitext trägt (etwa `grundlage` bei der Vertretung), behält
 * jeden Wert, der kein Codewort ist.
 *
 * **Seit dem 08.10.2026 liest auch das Verlaufsblatt diese Wörter**, mit dem
 * Wortlaut der Wortliste aus dem Block mit Laienprüfung
 * (`docs/plan-beschluss-von-hand-2026-09-30.md`, «Ja, lesbar machen»). Wo ein
 * Wort nur für den Verlauf gilt, steht es weiter unten und übersteuert die
 * geteilte Tabelle der Oberfläche. Das Siegel bleibt unberührt: Ein
 * versiegeltes Paket wird nicht neu erzeugt, sondern gelesen (`holeVerlaufspdf`,
 * `leseGeprueftenBestandteil`), und die Prüfung vergleicht nur Prüfsummen
 * (`pruefePaket`). Ein neuer Wortlaut gilt für Pakete, die ab dann versiegelt
 * werden.
 */
import { WEGNAMEN } from './anwesenheit';
import { ARCHIVARTEN } from './archivieren';
import { UNIVERSALVARIANTE_TEXT } from './ausnahmen';
import { FONDSGRENZE_ART_TEXT } from './fondsgrenze';
import { TRAEGERSCHAFT_IN_WORTEN } from './gemeinschaft';
import { KI_FUNKTIONSNAMEN } from './ki';
import { abstimmungsweise } from './klartext';
import { fristSatz, ZUSTANDSWORT } from './pendenz';
import { GESCHAEFTSARTEN, type Regelwerk } from './regelwerk';
import { rolleInWorten, ROLLEN } from './rollen';
import { ANTRAGSTELLERARTEN } from './traktanden';
import { FESTE_TRAKTANDEN, JAHRESGESCHAEFTE } from './traktandenvorlage';
import { EREIGNISARTEN, GEGENSTANDSARTEN, type Wertwoerter } from './verlauf';
import { WANDBILDARTEN } from './versammlung';
import { MITBERECHTIGUNG_TEXT, nachweisInWorten, VERTRETUNGSGRUND_TEXT } from './vollmacht';
import { VERWALTUNGSANGABE_IM_VERLAUF } from './verwaltungsangabe';

type Woerterbuch = Readonly<Record<string, string>>;

/**
 * Woher ein Erfordernis stammt, in Worten.
 *
 * Stand bis zum 06.10.2026 als `QUELLE_IN_WORTEN` in `server/siegel.ts` und
 * diente dort nur dem Entscheidungsweg; der Verlauf schrieb daneben
 * «Quelle: gewaehlt». Seit dem 08.10.2026 trägt der Verlauf einen eigenen
 * Wortlaut (`VERLAUF_ERFORDERNISQUELLEN` unten): Dieses Blatt geht nach aussen,
 * und dort heisst «hergeleitet» ausführlicher. Diese Tabelle dient damit nur
 * noch dem Entscheidungsweg im Paket (`server/siegel.ts`).
 */
export const ERFORDERNISQUELLEN: Woerterbuch = {
	hergeleitet: 'über den Entscheidbaum hergeleitet',
	gewaehlt: 'von der Bewirtschaftung gewählt',
	reglement: 'aus einer Reglementsbestimmung'
};

/**
 * Die Zählweise der Kopfstimmen.
 *
 * **Die einzige neue Tabelle hier.** Der Kern führt nur die Werte
 * (`ZAEHLWEISEN` in `domain/gemeinschaft.ts`); der Wortlaut steht in der
 * Oberfläche, an drei Stellen gleich: `GemeinschaftFormular.svelte` («Eine
 * Kopfstimme je Eigentümer» / «… je Einheit»), `routes/gemeinschaften` und
 * `server/pdf/zugangskarte.ts`. Klein geschrieben wie im Satz in
 * `domain/gemeinschaft.ts` («Gezählt wird eine Kopfstimme je Eigentümer»).
 */
const ZAEHLWEISEN: Woerterbuch = {
	per_owner: 'eine Kopfstimme je Eigentümer',
	per_unit: 'eine Kopfstimme je Einheit'
};

/**
 * Worauf sich die Zählweise oder die Beschlussfähigkeit stützt.
 *
 * Werte aus `Rechtsgrundlage` (`domain/gemeinschaft.ts`) und aus der
 * Beschlussfähigkeit (`grundlage: 'gesetz' | 'reglement'`). Der Wortlaut ist
 * der des Verlaufs (Wortliste 08.10.2026): Ein Beweisdokument muss sagen, dass
 * hinter «Gesetz» kein Reglement steht, sonst läse sich der Unterschied zu
 * «gesetzliche Auffangregel» nicht.
 */
const GRUNDLAGEN: Woerterbuch = {
	gesetzliche_auffangregel: 'Gesetz (keine abweichende Reglementsregel hinterlegt)',
	gesetz: 'Gesetz (keine Reglementsregel hinterlegt)',
	reglement: 'Reglement'
};

/** Aus einer Liste von Einträgen mit `art` ein Wörterbuch. */
function ausListe<E extends { art: string }>(liste: readonly E[], wort: (e: E) => string): Woerterbuch {
	return Object.fromEntries(liste.map((e) => [e.art, wort(e)]));
}

/*
 * Der Antragsteller; `frei` heisst im Verlauf anders als in der Maske, weil
 * «Andere — z. B. eine Arbeitsgruppe» ein Beispiel aus dem Formular ist und
 * auf einem Beweisdokument fremd wirkt (Wortliste 08.10.2026).
 */
const ANTRAGSTELLER: Woerterbuch = {
	...ausListe(ANTRAGSTELLERARTEN, (e) => e.bezeichnung),
	frei: 'jemand anderes (Name beim Traktandum erfasst)'
};

/** Die Betriebsart wie in der Oberfläche: Klartext, das Fachwort in Klammern. */
function betriebsart(b: 'einfach' | 'gefuehrt'): string {
	const k = abstimmungsweise(b);
	return `${k.kurz} (${k.fachwort})`;
}

const BETRIEBSARTEN: Woerterbuch = {
	einfach: betriebsart('einfach'),
	gefuehrt: betriebsart('gefuehrt')
};

const ROLLENWOERTER: Woerterbuch = Object.fromEntries(ROLLEN.map((r) => [r, rolleInWorten(r)]));

// ── Die Wörter der Wortliste (Laienprüfung 08.10.2026) ──────────────────────

/*
 * Die Wörter, die nur für den Verlauf gelten (Seite und Blatt). Sie sind in
 * drei Runden Laien- und Fachprüfung festgelegt
 * (`quellen/pruefung/berichte/2026-10-08-votum-verlaufsblatt-woerter.md`) und
 * übersteuern, wo es eine geteilte Tabelle gibt, nur die genannten Codewörter.
 */

/** Die Art einer Partei beim Anlegen (`party.created`, `art`). */
const PARTEIART: Woerterbuch = {
	natural: 'natürliche Person',
	legal: 'juristische Person',
	gemeinschaft: 'ein ganzes Haus als Mitglied (eigene Stockwerkeigentümergemeinschaft)'
};

/** Die Art einer Einheit beim Anlegen (`unit.created`, `art`). */
const EINHEITSART: Woerterbuch = {
	unit: 'Hauptobjekt (Wohnung oder Geschäftsraum)',
	parking: 'Nebenobjekt'
};

/** Die Art der Übernahme (`import.applied`, `art`). */
const UEBERNAHMEART: Woerterbuch = {
	eigentuemer: 'Eigentümerliste',
	einheiten: 'Liste der Einheiten'
};

/** Die Stufe der Versammlung (`stufe`, und `versammlungsart` bei der Regel). */
const STUFE: Woerterbuch = {
	erste: 'Erstversammlung',
	zweite: 'Zweitversammlung (nach einer nicht beschlussfähigen ersten)'
};

/**
 * Die Stufe der Folgeversammlung beim Vertagen (`folgestufe`, C3, F4c): eine
 * neue erste, wenn die vertagte schon beschlussfähig war.
 */
const FOLGESTUFE: Woerterbuch = {
	erste: 'Neue Erstversammlung (die vertagte war schon beschlussfähig)',
	zweite: STUFE.zweite
};

/** Der Gegenstand einer Reglementsregel (`bylaw.rule.stored`, `gegenstand`). */
const REGELGEGENSTAND: Woerterbuch = {
	beschlussfaehigkeit: 'Beschlussfähigkeit',
	weisung: 'Weisung an den Vertreter, der das Haus in der übergeordneten Gemeinschaft vertritt'
};

/** Die Herkunft einer Vollmacht (`proxy.recorded`, `herkunft`). */
const VOLLMACHTSHERKUNFT: Woerterbuch = {
	leitung: 'von Hand erfasst',
	zugang: 'elektronisch über den persönlichen Zugang erklärt'
};

/** Der Nachweis einer bestätigten Vollmacht (`proxy.confirmed`, `nachweis`). */
const VOLLMACHTSNACHWEIS: Woerterbuch = {
	datei: 'hinterlegte Datei oder elektronische Erklärung, kein vorgelegtes Original vermerkt',
	// Seit dem 03.11.2026: die eingetragene Mitberechtigte (`brauchtNachweis`).
	nicht_noetig: 'keiner nötig, als Mitberechtigte im Register eingetragen'
};

/** Die Haltung einer Weisung (`instruction.recorded`, `haltung`). */
const WEISUNGSHALTUNG: Woerterbuch = {
	ja: 'Ja',
	nein: 'Nein',
	enthaltung: 'Enthaltung',
	frei: 'nach freiem Ermessen'
};

/** Die Herkunft einer Weisung (`instruction.recorded`, `herkunft`). */
const WEISUNGSHERKUNFT: Woerterbuch = {
	// «ohne Beleg» statt «Grundlage in der Bemerkung» (Produktentscheid
	// 08.10.2026): Der Zugangsweg ist eine Erklärung ohne Datei; wo ihre
	// Grundlage liegt, sagt die Bemerkung selbst.
	erklaerung: 'ohne Beleg',
	auffangregel: 'nach der Auffangregel der Anwendung',
	frei: 'keine Richtung des Hauses, der Vertreter entscheidet selbst',
	beschluss: 'aus einem Beschluss des vertretenen Hauses'
};

/** Der Grund des Risikos beim Übersteuern (`risikoGrund`). */
const RISIKOGRUND: Woerterbuch = {
	abschwaechung: 'tiefere Mehrheitsart als von der Anwendung vorgeschlagen',
	gegen_reglement: 'Abweichung von der hinterlegten Reglementsregel'
};

/** Die Art eines Traktandums (`traktandumart`). */
const TRAKTANDUMART: Woerterbuch = {
	abstimmung: 'Abstimmung',
	kenntnisnahme: 'Kenntnisnahme, keine Abstimmung'
};

/** Die Erfassungsart einer Handzählung (`erfassung`). */
const ERFASSUNG: Woerterbuch = {
	summen: 'nur die Gesamtzahlen',
	parteien: 'je Eigentümer einzeln'
};

/** Der Entscheid zu einem KI-Vorschlag (`ai.decision.recorded`, `entscheid`). */
const KI_ENTSCHEID: Woerterbuch = {
	angenommen: 'Übernommen',
	veraendert: 'Verändert übernommen',
	abgelehnt: 'Nicht übernommen'
};

/** Die Art einer festgehaltenen Protokollfassung (`fassungsart`). */
const FASSUNGSART_VERLAUF: Woerterbuch = {
	versandt: 'als versandt vermerkt',
	genehmigt: 'als von der Versammlung genehmigt vermerkt',
	festgehalten: 'als Stand festgehalten, nicht als versandt oder genehmigt vermerkt'
};

/** Das Dateiformat einer ausgegebenen Unterlage (`format`). */
const FORMAT: Woerterbuch = {
	pdf: 'PDF',
	docx: 'Word (.docx)',
	odt: 'OpenDocument (.odt)'
};

/** Der Zustand des Zeitstempels (`zeitstempel`). */
const ZEITSTEMPEL: Woerterbuch = {
	vorhanden: 'vom Zeitstempeldienst bestätigt',
	ausstehend: 'Bestätigung des Zeitstempeldienstes ausstehend',
	gescheitert: 'Bestätigung des Zeitstempeldienstes konnte nicht eingeholt werden'
};

/** Die am gemeinsamen Abend erzwungene Aktion (`meeting.day.bypassed`, `aktion`). */
const AKTION: Woerterbuch = {
	aufrufen: 'Traktandum aufrufen',
	oeffnen: 'Abstimmung freigeben',
	schliessen: 'Abstimmung schliessen',
	beschlussVonHand: 'Beschluss von Hand festhalten',
	widerspruch: 'Widerspruch gegen die Beschlussfassung festhalten',
	leitungsvertreter:
		'festhalten, welche Bevollmächtigten für die Sitzungsleitung oder die Verwaltung vertreten',
	pause: 'Pause begonnen oder beendet',
	wandbild: 'Anzeige auf der Leinwand wechseln'
};

/** Die Unterlage der Ausfallsicherung (`unterlage`). */
const UNTERLAGE: Woerterbuch = {
	traktanden: 'Traktandenliste',
	unterschriften: 'Anwesenheits- und Unterschriftenliste',
	stimmzettel: 'Stimmzettel und Zählblatt',
	auszaehlung: 'Auszählmappe'
};

/** Der Weg des Versandvermerks (`meeting.invitation.sent.marked`, `weg`). */
const VERSANDVERMERK_WEG: Woerterbuch = {
	anwendung: 'Vermerk von Hand in der Anwendung',
	link: 'Vermerk über den Link in der Erinnerung',
	ruecknahme: 'Vermerk entfallen, weil die Freigabe der Versammlung zurückgenommen wurde'
};

/** Der Anmeldeweg über die Anwendung (`user.login`, `method`). */
const ANMELDUNG_LOKAL: Woerterbuch = {
	local: 'mit Benutzername und Kennwort'
};

/** Der Anmeldeweg über Authentik (`user.login.oidc`, `method`). */
const ANMELDUNG_AUTHENTIK: Woerterbuch = {
	authentik: 'über die zentrale Anmeldung (Authentik)'
};

/** Der Weg der Konto-Verknüpfung (`user.link.established`, `weg`). */
const VERKNUEPFUNGSWEG: Woerterbuch = {
	erstverknuepfung_adresse:
		'bei der ersten Anmeldung über Authentik, erkannt an der dienstlichen E-Mail-Adresse'
};

/** Wer die Verknüpfung gelöst hat (`user.link.released`, `durch`). */
const GELOEST_DURCH: Woerterbuch = {
	selbst: 'die Person selbst',
	verwaltung: 'die Verwaltung'
};

/** Die Zeitquelle einer erzeugten Unterlage (`quelle` bei den vier Ereignissen). */
const ZEITQUELLE: Woerterbuch = {
	system: 'Systemuhr',
	'local-unsynced': 'Uhr des Geräts, auf dem die Anwendung lief; ein Abgleich ist nicht festgehalten'
};

/**
 * Die Erfordernisquelle des Verlaufs, in Worten.
 *
 * Der Verlauf trägt sie bei `requirement.set` (`quelle`) und
 * `requirement.overridden` (`vorschlagQuelle`); der Wortlaut ist ausführlicher
 * als der des Entscheidungswegs (`ERFORDERNISQUELLEN` oben), weil das Blatt
 * nach aussen geht und dort «hergeleitet» und «gewählt» für sich verständlich
 * sein müssen.
 */
const VERLAUF_ERFORDERNISQUELLEN: Woerterbuch = {
	hergeleitet: 'von der Anwendung aus den Angaben zum Geschäft hergeleitet',
	gewaehlt: 'von Hand gewählt, nicht hergeleitet',
	reglement: 'aus der hinterlegten Reglementsregel'
};

/** Die Basis der Kopfstimmen im Verlauf (`kopfbasis`). */
const KOPFBASIS_VERLAUF: Woerterbuch = {
	anwesend_vertreten: 'die anwesenden oder vertretenen Eigentümer',
	alle_eigentuemer: 'alle Eigentümer, auch die abwesenden',
	alle_ausser_betroffene:
		'alle Eigentümer, auch die abwesenden, ausser den beim Traktandum als betroffen eingetragenen'
};

/** Die Basis der Wertquoten im Verlauf (`quotenbasis`). */
const QUOTENBASIS_VERLAUF: Woerterbuch = {
	anwesend_vertreten: 'die Wertquoten der anwesenden oder vertretenen Eigentümer',
	alle_quoten: 'alle Wertquoten, auch die der abwesenden Eigentümer',
	keine: 'kein Mehr nach Wertquoten verlangt'
};

/** Der Grenzfall unter `typ`, `gewaehlt` und `vorschlag`. */
const GRENZFALL_VERLAUF: Woerterbuch = {
	grenzfall: 'Grenzfall (es steht kein Erfordernis fest; abgestimmt wird erst nach einer Wahl von Hand)'
};

/**
 * Die Wörter je Schlüssel, für jede Ereignisart.
 *
 * Nur Schlüssel, die an allen Schreibstellen dieselbe Wertmenge tragen
 * (gezählt am 06.10.2026 über `ereignis(…)` und `angaben:` in `src/lib` und
 * `src/routes`, seit dem 08.10.2026 ergänzt um die Schlüssel der Wortliste,
 * die je Ereignisart gleich sind). Schlüssel wie `art`, `weg`, `vorher` und
 * `nachher` tragen je Ereignisart anderes; die stehen in `JE_ART`.
 */
const JE_SCHLUESSEL: Readonly<Record<string, Woerterbuch>> = {
	zaehlweise: ZAEHLWEISEN,
	// Beim Anlegen und als Feld einer Änderung (dort über `vorher`/`nachher`).
	traegerschaft: TRAEGERSCHAFT_IN_WORTEN,
	grundlage: GRUNDLAGEN,
	frist: {
		// `fristSatz` braucht für «datum» das Datum selbst; das steht in
		// `fristDatum` daneben. «datum» allein hat keinen Wortlaut und bleibt.
		naechste_versammlung: fristSatz({ fristArt: 'naechste_versammlung', fristDatum: null }),
		keine: fristSatz({ fristArt: 'keine', fristDatum: null })
	},
	// «datei» hat bei `vollmachtBestaetigt` einen eigenen Wortlaut
	// (`VOLLMACHTSNACHWEIS` in `JE_ART`); hier bleibt nur `original_vorgelegt`,
	// wie `nachweisInWorten` es schreibt.
	nachweis: { original_vorgelegt: nachweisInWorten('leitung', true, 0) },
	// Die Schwellenart, wie `schwelleInWorten` (domain/mehrheit.ts) sie
	// schreibt; «mindestens» steht dort wie gespeichert.
	kopfart: { mehr_als: 'mehr als' },
	kopfbasis: KOPFBASIS_VERLAUF,
	quotenbasis: QUOTENBASIS_VERLAUF,
	geschaeftsart: {
		...ausListe(GESCHAEFTSARTEN, (e) => e.bezeichnung),
		// Nur für den Verlauf, die Maske sagt «Notwendige Massnahmen» ohne das
		// «bauliche»; auf einem Blatt nach aussen steht die vollständige Art.
		baulich_notwendig: 'Notwendige bauliche Massnahmen',
		baulich_nuetzlich: 'Nützliche bauliche Massnahmen',
		baulich_luxurioes: 'Luxuriöse bauliche Massnahmen'
	},
	antragsteller: ANTRAGSTELLER,
	antragstellerart: ANTRAGSTELLER,
	betriebsart: BETRIEBSARTEN,
	universalvariante: UNIVERSALVARIANTE_TEXT,
	fondsgrenzenart: FONDSGRENZE_ART_TEXT,
	fondsgrenzenartVorher: FONDSGRENZE_ART_TEXT,
	funktion: KI_FUNKTIONSNAMEN,
	// `quelle` und `vorschlagQuelle` tragen je Ereignisart Verschiedenes (die
	// Erfordernisquelle bei `requirement.*`, die Zeitquelle bei den erzeugten
	// Unterlagen); beide stehen deshalb in `JE_ART`, nicht hier.
	vertretungsgrund: VERTRETUNGSGRUND_TEXT,
	rolle: ROLLENWOERTER,
	role: ROLLENWOERTER,
	gegenstandArt: GEGENSTANDSARTEN,
	was: Object.fromEntries(Object.entries(ARCHIVARTEN).map(([k, v]) => [k, v.einzahl])),
	stufe: STUFE,
	folgestufe: FOLGESTUFE,
	risikoGrund: RISIKOGRUND,
	traktandumart: TRAKTANDUMART,
	erfassung: ERFASSUNG,
	fassungsart: FASSUNGSART_VERLAUF,
	format: FORMAT,
	zeitstempel: ZEITSTEMPEL,
	unterlage: UNTERLAGE,
	// `typ`, `gewaehlt` und `vorschlag` tragen sonst einen Erfordernistyp aus
	// dem Regelwerk; nur der Grenzfall bekommt hier einen Verlaufswortlaut, der
	// Rest fällt an `typnamen` durch.
	typ: GRENZFALL_VERLAUF,
	gewaehlt: GRENZFALL_VERLAUF,
	vorschlag: GRENZFALL_VERLAUF
};

/** Die Traktandenvorlagen nach Schlüssel, mit ihrem Titel. */
const VORLAGEN: Woerterbuch = Object.fromEntries(
	[...FESTE_TRAKTANDEN, ...JAHRESGESCHAEFTE].map((v) => [v.schluessel, v.titel])
);

const WANDBILDER: Woerterbuch = ausListe(WANDBILDARTEN, (e) => e.titel);

/** Der Erfassungsweg der Anwesenheit; die Papierabgabe nimmt zwei davon. */
const ERFASSUNGSWEG: Readonly<Record<string, Woerterbuch>> = { weg: WEGNAMEN };

/**
 * Die Wörter, die nur bei einer Ereignisart gelten.
 *
 * Gefragt wird hier zuerst, dann `JE_SCHLUESSEL`. Ein `vorher`/`nachher`
 * auf oberster Ebene steht hier; eines in einem verschachtelten Feld
 * (`felder: { betriebsart: { vorher, nachher } }`) fragt mit dem Schlüssel
 * darüber (`Wertwoerter`).
 */
const JE_ART: Readonly<Record<string, Readonly<Record<string, Woerterbuch>>>> = {
	[EREIGNISARTEN.anwesenheitAngemeldet]: ERFASSUNGSWEG,
	[EREIGNISARTEN.anwesenheitBestaetigt]: ERFASSUNGSWEG,
	[EREIGNISARTEN.anwesenheitAbgelehnt]: ERFASSUNGSWEG,
	[EREIGNISARTEN.anwesenheitVerlassen]: ERFASSUNGSWEG,
	[EREIGNISARTEN.papierabgabeGesetzt]: ERFASSUNGSWEG,
	[EREIGNISARTEN.vollmachtNachweisNachgereicht]: {
		art: { original_vorgelegt: nachweisInWorten('leitung', true, 0) }
	},
	[EREIGNISARTEN.betriebsartGewechselt]: { vorher: BETRIEBSARTEN, nachher: BETRIEBSARTEN },
	[EREIGNISARTEN.wandbildGesetzt]: { vorher: WANDBILDER, nachher: WANDBILDER },
	[EREIGNISARTEN.pendenzZustandGesetzt]: { vorher: ZUSTANDSWORT, nachher: ZUSTANDSWORT },
	[EREIGNISARTEN.kontoRolleGeaendert]: { vorher: ROLLENWOERTER, nachher: ROLLENWOERTER },
	[EREIGNISARTEN.pflichttraktandenAngelegt]: { schluessel: VORLAGEN },
	// ── Die Ereignisarten der Wortliste (Laienprüfung 08.10.2026) ────────────
	[EREIGNISARTEN.eigentuemerAngelegt]: { art: PARTEIART },
	[EREIGNISARTEN.einheitAngelegt]: { art: EINHEITSART },
	[EREIGNISARTEN.uebernahmeBestaetigt]: { art: UEBERNAHMEART },
	[EREIGNISARTEN.reglementsregelHinterlegt]: { versammlungsart: STUFE, gegenstand: REGELGEGENSTAND },
	[EREIGNISARTEN.vollmachtErfasst]: { herkunft: VOLLMACHTSHERKUNFT, mitberechtigung: MITBERECHTIGUNG_TEXT },
	[EREIGNISARTEN.vollmachtBestaetigt]: { nachweis: VOLLMACHTSNACHWEIS },
	[EREIGNISARTEN.weisungErfasst]: { haltung: WEISUNGSHALTUNG, herkunft: WEISUNGSHERKUNFT },
	[EREIGNISARTEN.kiEntscheid]: { entscheid: KI_ENTSCHEID },
	[EREIGNISARTEN.traktandenordnungGespeichert]: { schluessel: VORLAGEN },
	[EREIGNISARTEN.versammlungNotweg]: { aktion: AKTION },
	[EREIGNISARTEN.einladungVersandVermerkt]: { weg: VERSANDVERMERK_WEG },
	[EREIGNISARTEN.anmeldung]: { method: ANMELDUNG_LOKAL },
	[EREIGNISARTEN.anmeldungAuthentik]: { method: ANMELDUNG_AUTHENTIK },
	[EREIGNISARTEN.kontoVerknuepft]: { weg: VERKNUEPFUNGSWEG },
	[EREIGNISARTEN.kontoVerknuepfungGeloest]: { durch: GELOEST_DURCH },
	[EREIGNISARTEN.erfordernisGesetzt]: { quelle: VERLAUF_ERFORDERNISQUELLEN },
	[EREIGNISARTEN.erfordernisUebersteuert]: { vorschlagQuelle: VERLAUF_ERFORDERNISQUELLEN },
	[EREIGNISARTEN.traktandenlisteErzeugt]: { quelle: ZEITQUELLE },
	[EREIGNISARTEN.ausfallunterlageGeholt]: { quelle: ZEITQUELLE },
	[EREIGNISARTEN.einladungErzeugt]: { quelle: ZEITQUELLE },
	[EREIGNISARTEN.auswertungErzeugt]: { quelle: ZEITQUELLE },
	// Entscheid 0045, Punkt 11: der Grund der Angabe, aus `domain/verwaltungsangabe.ts`.
	[EREIGNISARTEN.verwaltungsangabeGemacht]: { grund: VERWALTUNGSANGABE_IM_VERLAUF },
	[EREIGNISARTEN.verwaltungsangabeZurueckgenommen]: { grund: VERWALTUNGSANGABE_IM_VERLAUF }
};

/**
 * Die Bezeichnungen der Erfordernistypen aus einem Regelwerk.
 *
 * Sie stehen nur im Regelwerk (`src/lib/rules`), und der Kern darf es nicht
 * einbinden (kern-bleibt-rein). Wer sie zeigen will, holt sie in der Schale
 * (`holeRegelwerk()`) und reicht sie herein. Die Bezeichnungen sind über alle
 * Fassungen gleich; die Fassungen ändern Formel und Stimmwirkung.
 */
export type Typnamen = Readonly<Record<string, string>>;

export function typnamenAus(rw: Pick<Regelwerk, 'ergebnistypen'>): Typnamen {
	return Object.fromEntries(rw.ergebnistypen.map((t) => [t.typ, t.bezeichnung]));
}

/** Die Schlüssel, deren Wert ein Erfordernistyp ist. */
const TYP_SCHLUESSEL: ReadonlySet<string> = new Set(['typ', 'gewaehlt', 'vorschlag']);

function nachschlagen(buch: Woerterbuch | undefined, wert: string): string | undefined {
	return buch && Object.hasOwn(buch, wert) ? buch[wert] : undefined;
}

/**
 * Die Übersetzung der Codewörter für einen Verlaufseintrag der Art `art`.
 *
 * Für `angabenInWorten(angaben, aufloesen, wertwoerter(art, typnamen))`.
 * Ohne `typnamen` bleiben die Erfordernistypen roh.
 */
export function wertwoerter(art: string, typnamen?: Typnamen): Wertwoerter {
	const jeArt = Object.hasOwn(JE_ART, art) ? JE_ART[art] : undefined;
	return (wert, schluessel) =>
		nachschlagen(jeArt && Object.hasOwn(jeArt, schluessel) ? jeArt[schluessel] : undefined, wert) ??
		nachschlagen(
			Object.hasOwn(JE_SCHLUESSEL, schluessel) ? JE_SCHLUESSEL[schluessel] : undefined,
			wert
		) ??
		(TYP_SCHLUESSEL.has(schluessel) ? nachschlagen(typnamen, wert) : undefined);
}
