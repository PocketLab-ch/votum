/**
 * Exportiert die aktuelle Regelwerksfassung als JSON für den Quorenfinder der
 * Website (15.08.2026).
 *
 * **Eine Umwandlung, nicht zwei Abschriften:** Die Website führt keinen
 * eigenen Baum, sondern einen erzeugten Abzug dieser Fassung — mit
 * Fassungskennung im Abzug, damit Drift sichtbar ist. Nach jeder neuen
 * Fassung: Skript laufen lassen und die JSON-Datei im Website-Repo ersetzen.
 *
 * **Seit dem 16.08.2026 (Servervariante):** Der Abzug wird nicht mehr an den
 * Browser ausgeliefert, sondern liegt im callback-api-Abbild und wird je
 * Schritt abgefragt. Nach dem Ersetzen der JSON-Datei deshalb BEIDE
 * Website-Abbilder neu bauen (stockwerkweb UND callback-api), sonst zeigt
 * das Werkzeug die alte Fassung weiter.
 *
 * **Aufruf, im App-Container:**
 *
 *   docker compose exec -T app ./node_modules/.bin/vite-node scripts/quorumsbaum-export.mjs > /tmp/abzug-neu.json
 *
 * Den bestehenden Abzug im Website-Repo nie direkt überschreiben: erst
 * erzeugen, dann vergleichen, dann ersetzen.
 *
 * **`vite-node`, nicht `node`, und das ist der ganze Punkt** (gemessen am
 * 22.09.2026). Hier stand bis dahin ein Aufruf mit
 * `node --experimental-strip-types`, und der scheitert:
 *
 *   Error [ERR_MODULE_NOT_FOUND]: Cannot find module
 *   '/app/src/lib/rules/quorum-2026-09-21'
 *
 * Zwei Dinge muss der Lauf können, und nacktes Node kann nur das erste:
 * TypeScript lesen (das leistet die Typ-Streifung) **und** endungslose
 * Importe auflösen. Die Fassungskette importiert durchgehend endungslos
 * (`from './quorum-2026-08-16'`), weil sie sonst überall anders aussähe als
 * der übrige Quellbaum. Vite löst beides, und damit läuft der Export durch.
 *
 * **`vite-node` ist eine Entwicklungsabhängigkeit, seit dem 22.09.2026.**
 * Hier stand zuerst, es «liege im Container bereit». Das war aus dem
 * funktionierenden Aufruf geschlossen, nicht gemessen. Die Sicherheitsprüfung
 * fand am 22.09.2026 das Gegenteil: null Treffer in `package.json` und
 * `package-lock.json`, kein `node_modules/.bin/vite-node`, `require.resolve`
 * scheiterte. `npx` holte das Paket also **zur Laufzeit aus der Registry**,
 * ungepinnt und ohne Integritätsprüfung.
 *
 * Das wog schwer, weil ein Wächter (`scripts/check-abzug.mjs`) den Export in
 * `npm run pruefen` hängen sollte und derselbe Lauf am Pre-Commit-Hook
 * hängt: Ein ungepinnter Netzabruf wäre damit an jeden Commit geraten, in
 * einem Container, der `.env` und das Repo gemountet hat.
 *
 * **Entschieden vom Auftraggeber am 22.09.2026, und umgesetzt:** `vite-node` steht
 * als Entwicklungsabhängigkeit in `package.json` und mit Fassung und
 * Integritätsprüfsumme im Lockfile. Der Wächter ruft `node_modules/.bin/vite-node`
 * unmittelbar auf, nicht über `npx`; damit hängt der Prüflauf an keiner
 * Registry mehr.
 *
 * **Der Aufruf oben nennt deshalb kein `npx` mehr, sondern den Pfad im Baum.**
 * `npx` sah harmloser aus, als es ist: Es bevorzugt zwar eine lokale Fassung,
 * greift aber sonst wortlos auf seinen eigenen Zwischenspeicher oder auf die
 * Registry zurück. Am 22.09.2026 nachgemessen, und die Messung selbst zeigte
 * die Falle: `npx --no-install vite-node --version` gelang auch aus einem
 * Verzeichnis ohne `node_modules`, weil der Zwischenspeicher vom Vormittag
 * noch lag. Wer so prüft, misst den Zwischenspeicher und nicht den Baum.
 * `./node_modules/.bin/vite-node` ist da oder ist es nicht.
 *
 * **Und dieser Aufruf gilt für den Entwicklungsstapel, nicht für den
 * Betriebsstapel.** `Dockerfile` Zeile 21 baut die Laufzeitschicht mit
 * `npm ci --omit=dev`; `vite-node` ist Entwicklungsabhängigkeit und liegt dort
 * also nicht. Im Betriebsabbild scheitert der Aufruf, und das ist gewollt: Er
 * scheitert sichtbar, statt still aus dem Netz nachzuladen. Der Abzug wird auf
 * dem Entwicklungsstapel erzeugt, nicht im Betrieb.
 *
 * **Die schärfere Gegenprobe steht aus** (Vorschlag website-5e): den Export in
 * einem frisch gebauten Entwicklungsabbild **ohne Netz** fahren. Gelingt er,
 * kommt das Paket sicher aus dem Lockfile.
 *
 * **Was daraus folgt, und es ist mehr als eine Zeile Doku:** Der Export galt
 * seit dem 21.09.2026 als defekt, und daraus entstand der Plan, die ganze
 * Fassungskette auf `.ts`-Endungen umzustellen — acht Dateien samt Tests,
 * ein Entwurf dazu liegt unter `.patches/` im Arbeitsverzeichnis. Dieser Umbau ist
 * nicht nötig. Wer ihn dennoch erwägt, wäge ihn als Konventionsfrage ab,
 * nicht als Reparatur.
 *
 * **Drei Anpassungen an den Website-Ton**, alle mechanisch:
 *   - Gedankenstriche sind auf der Website nicht zugelassen (Stilregel);
 *     « — » wird zu «, ». Wo das holpert, gehört der Satz im Regelwerk
 *     umgestellt, nicht hier von Hand nachgebessert. Der Ersatz in
 *     `UMFORMULIERUNGEN` und die Kurztexte laufen nicht durch diesen Schritt;
 *     dort steht das Komma von Hand, und der Wächter `KEIN_GEDANKENSTRICH`
 *     am Ende bricht ab, wenn ein Strich durchgeht (Website-Abzug E4).
 *   - **Fett** aus den Hilfetexten wird zu <strong>, weil die Insel HTML
 *     rendert.
 *   - «anwesenden oder vertretenen» wird zu «anwesenden und vertretenen»,
 *     auch gross geschrieben (Produktentscheid 15.08.2026): Als
 *     Beschreibung der Gruppe ist «und» für Laien eindeutig; das juristische «oder» meint den Einzelnen (anwesend oder
 *     vertreten) und liest sich auf der Website wie eine Wahl zwischen zwei
 *     Mehrheiten. Die Anwendung selbst bleibt beim Wortlaut von Gesetz und
 *     Kommentar. Das prädikative «anwesend oder vertreten» (etwa bei der
 *     Beschlussfähigkeit) bleibt unangetastet, dort stimmt das «oder» auch
 *     für Laien.
 */
/*
 * **Die Fassung steht hier ausgeschrieben, und das ist eine Falle** (21.09.2026,
 * aus der Sicherheitsprüfung zur Fassung 2026-09-21). Hier stand bis dahin
 * `REGELWERK_2026_08_16`, während die Anwendung längst eine neuere Fassung
 * fuhr. Der Export hätte den alten Stand samt alter Kennung geschrieben und
 * eine Korrektur auf der Website beim nächsten Lauf still überschrieben.
 *
 * **Warum die Fassung hier ausgeschrieben steht und nicht aus
 * `holeRegelwerk()` kommt.** Der Grund von damals («Node löst endungslose
 * Importe nicht auf») ist seit dem 22.09.2026 überholt: Unter `vite-node`
 * liefe auch `holeRegelwerk()`. Geblieben ist ein schwächerer, aber echter
 * Grund: Die ausgeschriebene Fassung macht im Diff sichtbar, welchen Stand
 * ein Abzug trägt, und der Wächter unten hält sie an `AKTUELLE_FASSUNG`.
 * Wer auf `holeRegelwerk()` umstellt, verliert diese Sichtbarkeit und
 * gewinnt, dass die Zeile nie mehr vergessen werden kann. Beides ist
 * vertretbar; der Wächter trägt ausdrücklich beide Wege.
 *
 * **Deshalb ein Wächter statt einer Bitte.** `tests/domain/regelwerksfassungen.test.ts`
 * liest diese Datei und vergleicht die hier importierte Fassung mit
 * `AKTUELLE_FASSUNG`. Wer eine neue Fassung aufnimmt und diese Zeile vergisst,
 * bekommt einen roten Prüflauf statt eines veralteten Abzugs.
 *
 * **Diesen Wächter gab es bis zum 22.09.2026 nicht.** Der Absatz darüber stand
 * seit dem 21.09.2026 hier und beschrieb einen Test, der nie geschrieben
 * wurde; `grep` über `tests/` fand keine Stelle, die diese Datei liest. Der
 * Schutz war also eine Behauptung, und genau der Fall trat beim Aufnehmen der
 * Fassung 2026-09-22 ein.
 *
 * **Was der Wächter misst und was nicht** (Code-Review vom 22.09.2026, damit
 * hier nicht die nächste zu weite Zusage steht): Er prüft, dass in der
 * Importzeile die Kennung aus `AKTUELLE_FASSUNG` steht. Er prüft **nicht**,
 * dass dieses Skript läuft. Es läuft derzeit nicht: Die Fassungskette
 * importiert endungslos, Vite löst das auf, Node nicht, und der Lauf endet
 * mit `ERR_MODULE_NOT_FOUND` — am 22.09.2026 im Container nachgemessen. Ein
 * grüner Wächter bedeutet also «die richtige Fassung ist eingetragen», nicht
 * «der Abzug lässt sich erzeugen».
 */
import {
	ANGEHOERIGE_BERATUNG,
	ENTHALTUNG_SATZ,
	ENTHALTUNG_SATZ_647D,
	ENTHALTUNG_SATZ_WEBSITE,
	KLAUSEL_AUSSCHLUSS,
	VOLLMACHT_AN_IHN
} from '../src/lib/rules/quorum-2026-11-15.ts';
import { LEHRE_UND_GERICHT } from '../src/lib/rules/quorum-2026-11-14.ts';
// Die aktuelle Fassung (2026-11-18): Die Wortlaute der Website hängen an den Ersetzungen
// der Fassungen 2026-11-14, 2026-11-15 und 2026-11-17 (`nachDieserFassung`). Die Fassung
// 2026-11-18 teilt den Erneuerungsfonds und ersetzt den Satz zur Verwendung und die Hilfe
// an `f4-1-verwendung` selbst, nicht über `ERSETZUNGEN`; der Abzug übernimmt sie wie jede Karte.
// Zwei Importzeilen mit Absicht: Der Wächter in `regelwerksfassungen.test.ts` sucht die Zeile, die mit `REGELWERK_` beginnt.
import { REGELWERK_2026_11_18 } from '../src/lib/rules/quorum-2026-11-18.ts';
import { ERRICHTEN_ID as FONDS_ERRICHTEN_ID } from '../src/lib/rules/quorum-2026-11-18.ts';
import {
	ANFECHTUNG_VERWEIS,
	GERICHT_647C,
	GRENZFALL,
	SICHER_JE_ARTIKEL,
	STUETZE_RZ112,
	VORSITZ_WAHL,
	WAHL_REST,
	WAHL_STUECKE,
	nachDieserFassung
} from '../src/lib/rules/quorum-2026-11-17.ts';
import { KOPFZAEHLWEISE_ARTIKEL } from '../src/lib/domain/lesarten.ts';
import { HINWEIS as WAHL_HINWEIS_NACH_GESETZ, KLEINE_GEMEINSCHAFTEN } from '../src/lib/rules/quorum-2026-11-13.ts';
import {
	AUSSCHLUSS_REGLEMENTSHINWEIS,
	DELEGATION_RZ_115,
	EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER,
	EINSPRACHE_BETROFFENE_ANWENDUNG,
	EINSPRACHE_BETROFFENE_WEBSITE,
	REGLEMENT_DARF_AENDERN_WEBSITE,
	WARUM_EINSTIMMIG
} from '../src/lib/rules/quorum-2026-11-04.ts';
import { BEGRUENDUNG as SCHRANKE_BEGRUENDUNG, ZUM_STREIT as SCHRANKE_ZUM_STREIT, ZUM_STREIT_VORHER as SCHRANKE_ZUM_STREIT_VORHER, BEGRUENDUNG_VORHER as SCHRANKE_BEGRUENDUNG_VORHER, SELBST_HILFE as SCHRANKE_SELBST_HILFE } from '../src/lib/rules/quorum-2026-11-05.ts';
import {
	BEGRUENDUNG as PROZESS_BEGRUENDUNG,
	BEGRUENDUNG_VORHER as PROZESS_BEGRUENDUNG_VORHER,
	HINWEIS as PROZESS_HINWEIS,
	HINWEIS_VORHER as PROZESS_HINWEIS_VORHER,
	NACH_EINFACHEM_MEHR,
	HINWEIS_LUXURIOES,
	HINWEIS_LUXURIOES_VORHER,
	NACH_ANWESENDEN,
	AUSSCHLUSS_BEGRUENDUNG,
	AUSSCHLUSS_BEGRUENDUNG_VORHER,
	HINWEIS_ZAEHLBASIS_VORHER,
	HINWEIS_ZAHLEN,
	W10,
	ANGEHOERIGE,
	GEGEN_EIGENTUEMER
} from '../src/lib/rules/quorum-2026-11-10.ts';
import { GRENZE_NUTZNIESSUNG } from '../src/lib/rules/quorum-2026-11-03.ts';
import { ANFECHTUNG_ZUSTAENDIGKEIT, HAUSWART_KARTE, WEG_MEHRERE } from '../src/lib/rules/quorum-2026-10-30.ts';
import {
	BEWIRTSCHAFTUNG_STATT_ID,
	UEBERTRAGUNG_STATT_ID,
	WEBSITE_REGLEMENT_STATT
} from '../src/lib/rules/quorum-2026-10-27.ts';
import { BEGRUENDUNG, BEGRUENDUNG_VORHER, HINWEIS_LESART } from '../src/lib/rules/quorum-2026-10-26.ts';
import { AUSWEG_HINWEISE } from '../src/lib/rules/quorum-2026-10-17.ts';
import { HINWEIS_GEWOEHNLICH as WAHL_ERWEITERUNG } from '../src/lib/rules/quorum-2026-10-24.ts';
import { GEMEINSAME_WOHNUNG, GEMEINSAME_WOHNUNG_WEBSITE } from '../src/lib/rules/quorum-2026-10-11.ts';
import { ANGEHOERIGE_WEBSITE } from '../src/lib/rules/quorum-2026-10-12.ts';
import {
	NUTZLICH_BETROFFEN_ANWENDUNG,
	NUTZLICH_BETROFFEN_WEBSITE,
	NUTZLICH_KOSTEN_ANWENDUNG,
	NUTZLICH_KOSTEN_WEBSITE
} from '../src/lib/rules/quorum-2026-10-13.ts';
import { teileHilfe } from '../src/lib/domain/hilfetext.ts';
import { createHash } from 'node:crypto';

const rw = REGELWERK_2026_11_18;

/** Die Karten mit Einstimmigkeit, weil statt der Versammlung entschieden wird (ab 2026-10-27). */
const STATT_VERSAMMLUNG = new Set([BEWIRTSCHAFTUNG_STATT_ID, UEBERTRAGUNG_STATT_ID]);

/**
 * Karten, deren Ergebnis oder Zählweise auf einem ausgewiesenen Lehrstreit
 * beruht (L-1 bis L-6 des Befundberichts, nach dem Strengstprinzip
 * vorentschieden). Die Website zeigt dort ein Signet «Streitfrage, streng
 * ausgelegt» — als ausdrückliche Liste statt einer Texterkennung, damit ein
 * umformulierter Hinweis das Signet nicht still verliert.
 *
 * **Seit der Fassung 2026-10-18 führt das Regelwerk dieselbe Aussage als
 * Merkmal `gegenmeinung`** (H7, Ä-01). Die Liste bleibt, weil ihre Wächter an
 * ihr hängen; die Probe «nennt die Gegenmeinung an genau den Streitfragen des
 * Website-Exports» in `regelwerksfassungen.test.ts` hält beide gleich. Wer hier
 * einträgt oder austrägt, zieht das Merkmal in einer neuen Fassung nach.
 */
const STREITFRAGEN = new Set([
	/*
	 * **`k-ausschlussklage` steht seit der Fassung 2026-11-10 in
	 * `STREITFRAGEN_LESART_STRENG`** (unten, Lesart L9): Die Liste hier ist an
	 * `gegenmeinung` gebunden, und die trägt die Karte nicht mehr. Das Signet
	 * «streng ausgelegt» bleibt, denn die Website geht weiter von der Mehrheit
	 * aller Eigentümer ohne den Beklagten aus.
	 */
	/*
	 * **`k-prozessfuehrung` steht seit der Fassung 2026-11-10 in
	 * `STREITFRAGEN_LESART_STRENG`** (unten, Lesart L11): Die Liste hier ist an
	 * `gegenmeinung` gebunden, und die trägt die Karte nicht mehr. Das Signet
	 * «streng ausgelegt» bleibt, denn die Website geht weiter vom qualifizierten
	 * Mehr aus.
	 */
	/*
	 * **`k-zustaendigkeit-gewoehnlich` ist hier am 23.09.2026 ausgetragen
	 * worden.** Er stand seit dem 16.08.2026 als L-5 darin, weil das Werkzeug
	 * das qualifizierte Mehr nach dem Strengstprinzip vorentschieden hatte.
	 * Mit der Fassung 2026-09-23 folgt es dort bewusst dem einfachen Mehr
	 * (Befund B-08: Gesetzeswortlaut, Rz. 34 ad Art. 712g und Rz. 166 ad
	 * Art. 712m sagen es, nur Rz. 109 ad Art. 712a stützt die strenge
	 * Lesart). Das Signet behauptet «streng ausgelegt»; auf dieser Karte
	 * wäre das ab jetzt die entgegengesetzte Aussage.
	 *
	 * Der Streit **bleibt** auf der Karte ausgewiesen, im Hinweis mit beiden
	 * Randziffern. Was wegfällt, ist allein die Behauptung, er sei streng
	 * aufgelöst. Seit Lesarten Block 8 trägt die Karte das Signet «mild
	 * ausgelegt» über `STREITFRAGEN_MILD` (unten).
	 */
	/*
	 * **`k-reglement-eigene-schranke` steht seit der Fassung 2026-11-05 in
	 * `STREITFRAGEN_LESART_STRENG`** (unten, Lesart L6): Die Liste hier ist an
	 * `gegenmeinung` gebunden, und die trägt die Karte nicht mehr. Das Signet
	 * «streng ausgelegt» bleibt, denn die Website geht weiter von der
	 * Einstimmigkeit aus.
	 */
	// Seit der Fassung 2026-10-19 (Ä-12): Einstimmigkeit für Inhalte ausserhalb
	// der Nutzungs- und Verwaltungsordnung nur «möglicherweise» (Rz. 126 ad 712g).
	'k-reglement-sonderinhalt',
	/*
	 * **`k-baulich-luxurioes` steht seit der Fassung 2026-11-10 in
	 * `STREITFRAGEN_LESART_STRENG`** (unten, Lesart L12): Die Liste hier ist an
	 * `gegenmeinung` gebunden, und die trägt die Karte nicht mehr. Das Signet
	 * «streng ausgelegt» bleibt, denn die Website geht weiter von der Zustimmung
	 * aller eingetragenen Eigentümer aus.
	 */
	/*
	 * Seit der Fassung 2026-09-22 (Befunde B2 und B5). Beide Knoten weisen
	 * ihren Streit neu im Hinweis aus; ohne den Eintrag hier fehlte auf der
	 * Website das Signet, und der Dateikopf der Fassung behauptete etwas
	 * anderes als der Abzug zeigte. Genau die Falle, vor der der Absatz über
	 * dieser Liste warnt: Das Signet hängt an der Liste, nicht am Text.
	 */
	/*
	 * **`k-reglement-normal` und `k-zirkularbeschluss` sind hier am 08.10.2026
	 * ausgetragen worden** (Fachprüfung der Kurztexte, Runde 3, Frage 4). Die
	 * gezeigten Quoren stehen im Gesetz (Art. 712g Abs. 3, Art. 66 Abs. 2);
	 * gestritten wird nur, ob ein Reglement abweichen darf, und das sagt der
	 * Kasten. `k-reglement-eigene-schranke` blieb bis zur Fassung 2026-11-05:
	 * Dort setzte das Werkzeug die Einstimmigkeit nach der strengen Lesart an;
	 * mit der Lesart L6 stellt die Gemeinschaft es ein (Austrag oben).
	 */
	/*
	 * **`k-baulich-luxurioes-ausweg` ist hier am 07.10.2026 ausgetragen
	 * worden** (Fassung 2026-10-15). Das Signet sagte «streng ausgelegt»:
	 * Votum wandte eine mildere Reglementsregel nicht an; seit 2026-10-15 wendet
	 * es eine an. Die Begründung, die hier zuerst stand («Rz. 136 betrifft die
	 * Erleichterung von Abs. 1, nicht das Quorum von Abs. 2»), trug nicht:
	 * Rz. 136 hält das System von Abs. 1 und 2 für zwingend, und ob ein
	 * Reglement senken darf, ist umstritten (Fachprüfung des Abzugs 07.10.2026,
	 * Befund 2; Rechtssatz ab 2026-10-16). Ohne Signet bleibt die Karte trotzdem
	 * zu Recht: Die Website zeigt das gesetzliche Quorum, und das beruht auf
	 * keiner strengen Lesart; der Streit über das Senken steht im Kasten.
	 */
	/*
	 * **Vorgefunden, nicht aus dieser Fassung** (22.09.2026). Der Knoten trägt
	 * seit Längerem einen Hinweis auf einen echten Streit (SVIT hält die
	 * reglementarische Urabstimmung für unzulässig, das Bundesgericht hat die
	 * Frage offengelassen) und steht deswegen auf `gesperrt_zwingend`, also
	 * auf der strengeren Lesart — nur das Signet fehlte. Aufgefallen ist es,
	 * weil der Wächter in `tests/domain/regelwerksfassungen.test.ts` die Liste
	 * nicht mehr gegen zwei feste Namen prüft, sondern gegen den Massstab:
	 * Wessen Sperre auf einem ausgewiesenen Streit beruht, trägt das Signet.
	 */
	/*
	 * **`k-grundstueck-verkauf` und `k-wertquoten-aendern` stehen nicht mehr
	 * hier** (Fachprüfung des Abzugs 07.10.2026, Befund 4; Produktentscheid
	 * 08.10.2026 «Eigene Kurztexte»). Das Signet steht am gezeigten Quorum, und
	 * eine Leserin versteht es als «dieses Quorum ist die strenge Seite eines
	 * Streits». Beim Verkauf ist die Einstimmigkeit ohne andere Ordnung
	 * unbestritten, bei den Wertquoten wäre «einfaches Mehr, streng ausgelegt»
	 * widersinnig. Gestritten wird dort nur, ob ein Reglement abweichen darf,
	 * und das sagt der Kasten «Und Ihr Reglement?». Auf der Website trägt das
	 * Signet deshalb nur, wessen gezeigtes Quorum selbst auf der strengen
	 * Lesart beruht.
	 */
]);

/**
 * **Streitfragen, an denen die Karte die mildere Lesart rechnet** (Lesarten
 * Block 8, 22.10.2026). Hier stehen die Lesarten der Gemeinschaft, deren Vorgabe
 * die mildere Seite ist: L2 an der Zuständigkeitsordnung. Bis zur Fassung
 * 2026-11-11 stand hier auch L4 an der Wahl einer Bewirtschaftung, die schon
 * erweiterte Kompetenzen hat; seit der Fassung 2026-11-13 rechnet sie nach der
 * Vorgabe das qualifizierte Mehr nach dem Gesetz und steht in
 * `STREITFRAGEN_LESART_STRENG` (Entscheid 0048, Block B). Beide waren
 * Lehrstreite, und bis zu diesem Block trugen sie kein Signet, weil es «streng
 * ausgelegt» behauptete. Die Website zeigt hier «mild ausgelegt» und nennt auf der Karte
 * den Weg, der nach beiden Seiten trägt.
 *
 * **Eine eigene Liste, nicht ein Eintrag oben:** `STREITFRAGEN` ist über
 * `gegenmeinung` an das Regelwerk gebunden, und die Gegenmeinung nennt die
 * Anwendung nur, wo sie die strengere Lesart rechnet (Probe «nennt keine
 * Gegenmeinung, wo der Knoten die mildere Lesart rechnet»). An diesen Karten
 * nennt die Anwendung die andere Lesart über den Katalog (`domain/lesarten.ts`).
 *
 * **Ab der Fassung 2026-11-18 das Errichten des Erneuerungsfonds**, ohne
 * Lesart: Die Karte rechnet nach überwiegender Meinung das einfache Mehr und
 * nennt Liver mit dem qualifizierten Mehr und den Weg, der beiden Auffassungen
 * genügt, im Hinweis (Produktentscheid 15.11.2026 «Einfaches Mehr, mit
 * Hinweis»; Rz. 123 ad Art. 712l).
 */
const STREITFRAGEN_MILD = new Set(['k-zustaendigkeit-gewoehnlich', FONDS_ERRICHTEN_ID]);

for (const id of STREITFRAGEN_MILD) {
	if (STREITFRAGEN.has(id)) throw new Error(`«${id}» steht in beiden Streitfragenlisten.`);
	if (!rw.knoten.some((k) => k.id === id)) throw new Error(`STREITFRAGEN_MILD nennt «${id}», die Fassung kennt den Knoten nicht.`);
}

/**
 * **Streitfragen mit einer Lesart, deren Vorgabe die strengere Seite ist**
 * (Fassung 2026-11-05, Lesart L6; Fassung 2026-11-10, Lesarten L9, L11 und L12;
 * Fassung 2026-11-13, Lesart L4).
 * Das Gegenstück zu `STREITFRAGEN_MILD`: An der eigenen Schranke des Reglements
 * und an der luxuriösen baulichen Massnahme rechnet die Vorgabe die Zustimmung
 * aller eingetragenen Eigentümer, an der Ermächtigung zur Prozessführung und
 * an der Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das
 * qualifizierte Mehr, und die Website geht jeweils davon aus. Die Karten tragen keine `gegenmeinung` mehr, weil die Anwendung die
 * andere Lesart über den Katalog nennt; ohne diese Liste verlöre die Website
 * das Signet «streng ausgelegt», obwohl ihr Text unverändert streng rechnet.
 */
const STREITFRAGEN_LESART_STRENG = new Set([
	'k-reglement-eigene-schranke',
	'k-prozessfuehrung',
	'k-baulich-luxurioes',
	'k-ausschlussklage',
	// Seit der Fassung 2026-11-13 (L4 nach dem Gesetz, Entscheid 0048, Block B);
	// bis dahin in `STREITFRAGEN_MILD`.
	'k-bewirtschaftung-waehlen-erweitert'
]);

for (const id of STREITFRAGEN_LESART_STRENG) {
	if (STREITFRAGEN.has(id) || STREITFRAGEN_MILD.has(id)) throw new Error(`«${id}» steht in zwei Streitfragenlisten.`);
	const k = rw.knoten.find((x) => x.id === id);
	if (!k) throw new Error(`STREITFRAGEN_LESART_STRENG nennt «${id}», die Fassung kennt den Knoten nicht.`);
	if (!k.lesart) throw new Error(`STREITFRAGEN_LESART_STRENG nennt «${id}», die Karte trägt keine Lesart.`);
}
/*
 * **Und umgekehrt** (Featureprüfung E1, Prüfer B, Befund 1): Jede Karte mit
 * einer Lesart steht in einer der beiden Listen. Seit die Lesart die
 * `gegenmeinung` ersetzt, deckte sonst nichts das Signet; fehlte eine Karte,
 * verlöre die Website es still.
 */
for (const k of rw.knoten.filter((x) => x.lesart)) {
	if (!STREITFRAGEN_MILD.has(k.id) && !STREITFRAGEN_LESART_STRENG.has(k.id)) {
		throw new Error(
			`«${k.id}» trägt die Lesart ${k.lesart.kennung}, steht aber weder in STREITFRAGEN_MILD noch in STREITFRAGEN_LESART_STRENG.`
		);
	}
}

/**
 * **Die Karten des Lesarten-Katalogs** (Lesarten Block 8). L2, L4, L6, L9, L11 und L12 hängen als
 * `lesart` am Knoten; L3 rechnet an der Zählung der Einsprache und steht nicht
 * am Knoten (Fassung 2026-10-28). L1 und L5 haben keine eigene Karte. Der
 * Abzug trägt die Kennung, damit `check-abzug.mjs` an diesen Karten jeden
 * Werkzeugsatz abfangen kann (Konzept Lesarten, Kriterium 15).
 */
const LESARTKARTEN = new Map([
	...rw.knoten.filter((k) => k.lesart).map((k) => [k.id, k.lesart.kennung]),
	['k-einsprache', 'L3']
]);
if (!rw.knoten.some((k) => k.id === 'k-einsprache')) throw new Error('Die Fassung kennt «k-einsprache» nicht.');

/** Die Richtung des Signets: «streng», «mild» oder keine Streitfrage. */
function streitfrageRichtung(id) {
	if (STREITFRAGEN.has(id) || STREITFRAGEN_LESART_STRENG.has(id)) return 'streng';
	if (STREITFRAGEN_MILD.has(id)) return 'mild';
	return null;
}

/** Ab wann die Anfechtungsfrist läuft (Rz. 230 ad Art. 712m), wie in Votum. */
const FRISTBEGINN =
	'für Abwesende ohne Vertretung beginnt sie in der Regel erst, wenn sie das Protokoll erhalten ' +
	'haben';

/**
 * **Ein Fristbeginn auf der ganzen Website** (Laienprüfung Block 8, R2-L8-1):
 * «nachdem Sie davon erfahren haben» (Art. 75 ZGB), was das heisst, in einem
 * Nebensatz (Rz. 230 ad Art. 712m).
 */
const KENNTNIS =
	'wer an der Versammlung da oder vertreten war, rechnet ab der Versammlung, wer weder da noch ' +
	'vertreten war, in der Regel ab Erhalt des Protokolls';

/** Der Verweis auf den Ratgeber, mit den Klassen der übrigen Links im Finder (Codeprüfung Block 8, Befund 1). */
const LINK_ANFECHTUNG =
	'<a href="/ratgeber/#faq-anfechtung" class="underline decoration-black/20 hover:decoration-black/40">' +
	'Wie und bis wann Sie anfechten</a>';

/**
 * **Wie man anficht, in einem Zug** (Lesarten Block 8; Laienprüfung L8-7, L8-8;
 * Fachprüfung F8-4): Beginn, Stelle und Frist. Wer der Verwaltung schreibt,
 * statt ein Gesuch einzureichen, verpasst die Monatsfrist (Rz. 223, 230, 233a
 * ad Art. 712m; bis A4 stand hier Rz. 213, die den Rat nicht trägt).
 */
const ANFECHTEN =
	'beim Gericht anfechten, in der Regel zuerst mit einem Gesuch an die Schlichtungsbehörde, innert ' +
	`eines Monats, nachdem Sie davon erfahren haben; ${KENNTNIS}`;

/** Der zweite Hinweis zur Zuständigkeitsordnung (L2) auf der Website. */
const ZUSTAENDIGKEIT_WEBSITE =
	'Erreicht Ihr Beschluss nur das einfache Mehr, ist er nach dieser Karte zustande gekommen. Weil ein ' +
	'Gericht der strengeren Lesart folgen könnte, kann ihn aber anfechten, wer nicht zugestimmt hat: ' +
	`${ANFECHTEN}. ` +
	'Wenden Sie ihn deshalb, wo es nicht eilt, erst nach Ablauf dieser Frist an. Halten die Zustimmenden ' +
	'zusammen mehr als die Hälfte aller Wertquoten, auch der Wohnungen, die nicht vertreten waren, halten ' +
	'Sie das im Protokoll fest; dann trägt der Beschluss nach beiden Lesarten.';

/**
 * **Hauswart beim Ausschuss** (Fachprüfung Block 8, F8-6): «am sichersten mit
 * qualifiziertem Mehr» widersprach der eigenen Einordnung der Anstellung als
 * wichtigere Verwaltungshandlung, die sich einem Ausschuss nach Rz. 115 ad
 * Art. 712m nicht übertragen lässt. Seit der Fassung 2026-10-30 (Fachprüfung
 * A4, F-11) sagen Anwendung und Website dieselbe offene Lage
 * (`HAUSWART_KARTE` in `quorum-2026-10-30.ts`); der Abzug nimmt hier nur noch
 * die Fundstellen heraus.
 */
const HAUSWART_WEBSITE =
	'Ob ein Ausschuss den Hauswart selbst anstellen darf, ist nicht geklärt. Wichtigere ' +
	'Verwaltungshandlungen lassen sich nicht abtreten. Ohne Verwalter kann ein Ausschuss aber dessen ' +
	'Aufgaben übernehmen. Sicher ist die Anstellung durch die Versammlung; ist eine Eigentümerin selbst ' +
	'Kandidatin, stimmt sie dabei nicht mit. Die Anstellung kann auch im Vertrag mit der Bewirtschaftung ' +
	'stehen. Das geht über ihr ordentliches Pflichtenheft hinaus; beschliessen Sie es über die Karte ' +
	'«Bewirtschaftung mit erweiterten Kompetenzen». Dem Ausschuss können Sie die Vorbereitung übertragen, ' +
	'etwa Bewerbungen sichten und einen Vorschlag machen.';
const HAUSWART_TEXTE = [
	...rw.knoten.flatMap((k) => k.hinweise ?? []),
	...rw.fragen.flatMap((f) => f.antworten.map((a) => a.hilfe ?? ''))
].filter((t) => t.includes(HAUSWART_KARTE));
if (HAUSWART_TEXTE.length !== 2) {
	throw new Error(`Der Satz zum Hauswart beim Ausschuss steht ${HAUSWART_TEXTE.length}-mal statt zweimal im Regelwerk.`);
}

/**
 * **Hinweise, die nur die Anwendung betreffen, gehen nicht auf die Website**
 * (Fassung 2026-11-03, F1). Die Grenze bei der Klage gegen Nutzniesser sagt,
 * was Votum noch nicht kann (Pendenz Ä-23); auf der Website rechnet nichts,
 * und der Abzugswächter lässt «Votum» dort nicht zu. Steht der Satz nicht
 * genau einmal im Regelwerk, bricht der Export ab, statt still nichts
 * herauszunehmen.
 */
/*
 * Dazu die Hinweise zum Vorgehen nach einer Annahme unter der milden Wahl einer
 * Lesart (Fassung 2026-11-10, L11 und L12; Codeprüfung E1 Block B, Befund 1):
 * Die Website rechnet streng, und dort gibt es keine milde Wahl.
 */
// Im Wortlaut der Fassung 2026-11-14 (Laienprüfung Nachtrag Runde 2, N2-L-10).
const NUR_ANWENDUNG = new Set([GRENZE_NUTZNIESSUNG, nachDieserFassung(NACH_EINFACHEM_MEHR), NACH_ANWESENDEN, HINWEIS_ZAHLEN]);
for (const satz of NUR_ANWENDUNG) {
	const treffer = rw.knoten.flatMap((k) => k.hinweise ?? []).filter((h) => h === satz).length;
	if (treffer !== 1) throw new Error(`Ein Hinweis nur für die Anwendung steht ${treffer}-mal statt einmal im Regelwerk.`);
}

/**
 * T6, F4a (zu S3; Prüfdatei `quellen/pruefung/zu-pruefen-2026-11-04-votum-f4a-saetze-runde3.md`):
 * der Kasten «Reglement» an der Karte zur Ausschlussklage (Feld
 * `reglementshinweis`). Vorher nannte er die Frage umstritten; nach Art. 649b
 * Abs. 2 ZGB darf das Reglement es, eingeführt nach Art. 712g Abs. 2.
 */
// Runde 3: Fachprüfung R3-1 (umstritten zuerst, beide Stellen des Kommentars
// selbst umstritten), Laienprüfung L3-1 (Übergang zur Bestimmung, die mit
// weniger eingeführt wurde, wie im Hinweis S3; «nur» im Schlusssatz).
const AUSSCHLUSSKLAGE_REGLEMENT_KASTEN =
	'Ob Ihr Reglement dieses Mehr anders regeln darf, ist umstritten. Das Gesetz lässt eine andere Regel zu ' +
	'(ZGB Art. 649b Abs. 2). Sie muss aber bei der Gründung des Stockwerkeigentums festgelegt oder später mit ' +
	// Textrunde zu den Pendenzen nach Regel 43 (Endfassung 14.11.2026, T5): der Beleg zur Einführung.
	'Zustimmung aller Eigentümer eingeführt worden sein (ZGB Art. 712g Abs. 2; SVIT-Kommentar Rz. 27 und 78a ad ' +
	'Art. 712g). ' +
	// Fassung 2026-11-15 («Texte nach 0047», Punkt 10; Featureprüfung M1): nicht geklärt statt «in der Regel».
	// Wortlaut der Fachprüfung zu Nachtrag 2: der Inhalt des Urteils im Satz, ohne Übergang «Ob das …».
	'Ob sie trotzdem gilt, wenn sie mit weniger ins Reglement kam und nicht rechtzeitig angefochten wurde, ist ' +
	'nicht geklärt. Dafür spricht BGE 143 III 537 E. 4.2.4: Dort hielt das Bundesgericht einen Wechsel von ' +
	'Köpfen zu Anteilen ohne Einstimmigkeit nur für anfechtbar. Für dieses Mehr hat kein Gericht entschieden. ' +
	'Der SVIT-Kommentar hält die ' +
	'Regel des Gesetzes für zwingend und eine Verschärfung für unzulässig, nennt beides aber selbst umstritten ' +
	'(Art. 712g Rz. 55; Art. 712a Rz. 206). Prüfen Sie, was bei Ihnen steht. Sicher ist die Ermächtigung nur, ' +
	'wenn sie das Mehr nach Gesetz und nach Ihrem Reglement erreicht.';

/** Ersetzt einen Teilstring, der genau einmal vorkommen muss; sonst bricht der Export ab. */
function ersetzeGenau(text, alt, neu) {
	if (text.split(alt).length !== 2) {
		throw new Error(`Umformulierung: «${alt}» kommt nicht genau einmal vor in «${text.slice(0, 60)}…».`);
	}
	return text.replace(alt, neu);
}

/*
 * **Nach den Befunden vom 15.11.2026** (Meldung der Website-Sitzung,
 * `.auftraege/2026-11-15-meldung-votum-website-abzug-verweise.md`, mit Laien-
 * und Fachprüfung `quellen/pruefung/berichte/2026-11-15-website-regel43-faq-*`):
 * Die Sätze unten gelten nur auf der Website. Massstab ist die FAQ der
 * Website, die die Lage zwischen beiden Zählweisen schon so sagt.
 *
 * **Seit der Fassung 2026-11-17** trägt die Anwendung den sicheren Weg (L7,
 * L5), den Satz zum Bundesgericht an Art. 647c (F4) und die Sätze zur Wahl
 * mit erweiterten Befugnissen selbst, wegen `check:texte` aber mit Punkt, wo
 * die Website einen Strichpunkt hat. Die Ersetzungen unten hängen deshalb an
 * den Konstanten der Fassung und setzen den geprüften Website-Wortlaut ein
 * (gemessen: `docs/proben.md`, «Fassung 2026-11-17»). Was gilt, wenn die Ja
 * zwischen beiden Zählweisen liegen (L2), sagt die Anwendung im Kasten nur
 * kurz mit Verweis auf den Rat nach der Auszählung, die Website hier
 * ausführlich (Grund in `quorum-2026-11-17.ts`).
 */

/** «anfechten» als Link, mit Ziel und Klassen von `LINK_ANFECHTUNG`. */
const LINK_ANFECHTEN = ersetzeGenau(LINK_ANFECHTUNG, '>Wie und bis wann Sie anfechten</a>', '>anfechten</a>');

/** Der Verweis auf den Kasten der Karte, an Formel, Kurztext und Hinweisen. */
const VERWEIS_ZAEHLWEISE = 'Wie die Köpfe gezählt werden, steht unter «Wortlaut und Rechtsprechung».';

/** L2: Wer nur die Mehrheit der Anwesenden hat, ist angenommen und anfechtbar. */
const ANGENOMMEN_NACH_LEHRE =
	'Erreicht der Antrag nur die Mehrheit der Anwesenden und Vertretenen, ist er nach der herrschenden Lehre angenommen.';
const ANFECHTBAR_4B =
	`Wer nicht zugestimmt hat, kann ihn aber innert eines Monats ${LINK_ANFECHTEN}: für Anwesende und Vertretene ` +
	'ab der Versammlung, für Abwesende, die nicht vertreten waren, in der Regel ab Zustellung des Protokolls.';
/** Der Vollmachten-Halbsatz hinter dem sicheren Weg, in 4b und am Grenzfall der Nutzung. */
const VOLLMACHTEN_4B = 'holen Sie dafür vor der Versammlung Vollmachten ein.';
/** L2 beim qualifizierten Mehr: die Wertquoten erreicht, die Köpfe nur unter den Anwesenden. */
const ANGENOMMEN_QUALIFIZIERT =
	'Erreicht der Antrag die Wertquoten, bei den Köpfen aber nur die Mehrheit der Anwesenden und Vertretenen, ist ' +
	'er nach der herrschenden Lehre angenommen.';
// Runde 2, R4 (Laien 5): «rasch und nachweisbar zu, etwa eingeschrieben», wie an den übrigen Karten.
const ZUSTELLEN_4B = 'Stellen Sie das Protokoll deshalb rasch und nachweisbar zu, etwa eingeschrieben';
const AUSFUEHREN_4B =
	`${ZUSTELLEN_4B}, und führen Sie den Beschluss, wenn die Sache nicht dringlich ist, ` +
	'erst einige Tage nach Ablauf dieser Frist aus.';

/**
 * L7 («Weil die Zählweise umstritten ist» statt «Im Streit um»), L2 (die Lage
 * dazwischen) und an den Karten mit qualifiziertem Mehr L5 (die Wertquoten
 * neben den Köpfen). An Art. 647c beginnt der Satz mit «Am sichersten», neben
 * dem neuen Satz zur Begründung des Bundesgerichts (F4, unten); Wortlaut nach
 * der Textvorgabe der auftraggebenden Sitzung vom 15.11.2026.
 */
const SICHER_4B_QUALIFIZIERT =
	'Weil die Zählweise umstritten ist, ist bei den Köpfen nur ein Beschluss ganz sicher, dem mehr als die Hälfte ' +
	'aller Eigentümer zustimmt; daneben braucht es mehr als die Hälfte aller Wertquoten. Holen Sie dafür vor der ' +
	`Versammlung Vollmachten ein. ${ANGENOMMEN_QUALIFIZIERT} ${ANFECHTBAR_4B} ${AUSFUEHREN_4B}`;
const SICHER_4B_WEBSITE = {
	// Runde 2, R3 (Laien 2, Fach A1): «bei den Köpfen», und die Wertquoten nach dem Hinweis der Karte (L2).
	'ZGB Art. 647a Abs. 2':
		'Weil die Zählweise umstritten ist, ist bei den Köpfen nur ein Beschluss ganz sicher, dem mehr als die ' +
		`Hälfte aller Eigentümer zustimmt; ${VOLLMACHTEN_4B} Ob daneben auch die ` +
		'Wertquoten nötig sind, steht unter «Gut zu wissen». ' +
		`${ANGENOMMEN_NACH_LEHRE} ${ANFECHTBAR_4B} ${AUSFUEHREN_4B}`,
	'ZGB Art. 647b Abs. 1': SICHER_4B_QUALIFIZIERT,
	'ZGB Art. 647c':
		`Am sichersten ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt; ${VOLLMACHTEN_4B} ` +
		`${ANGENOMMEN_NACH_LEHRE} ${ANFECHTBAR_4B} ${ZUSTELLEN_4B}; ` +
		'ist die Arbeit nicht dringlich, vergeben Sie sie erst einige Tage nach Ablauf dieser Frist.',
	'ZGB Art. 647e Abs. 2': SICHER_4B_QUALIFIZIERT
};

/**
 * {Gericht} auf der Website, wo der Satz der Fassung nicht trägt. An Art. 647a
 * Abs. 2 verwies er auf «Zu beachten», einen Titel, den der Quorum-Finder nicht
 * hat, und auf einen Hinweis, der nicht im Abzug steht (Meldung, Befund; jetzt
 * mit dem Inhalt von `WORTLAUT_ALLER` der Fassung 2026-10-26). An Art. 647c sagte
 * er «erwähnt, aber nicht beurteilt», und das unterschätzt die tragende
 * Begründung von BGE 144 III 510 E. 2.2.4 (F4); seit der Fassung 2026-11-17
 * sagt die Anwendung dasselbe in drei Sätzen (`GERICHT_647C`), hier steht der
 * geprüfte Satz der Website. Art. 647b Abs. 1 und 647e Abs. 2 behalten den
 * Satz der Fassung.
 */
const GERICHT_4B_WEBSITE = {
	'ZGB Art. 647a Abs. 2':
		'Das Bundesgericht hat über die Zählweise hier nicht entschieden. Es nennt Art. 647a Abs. 2 zwar bei den ' +
		'Beschlüssen mit einfachem Mehr nach Köpfen (BGE 131 III 459 E. 5.2), aber nur in einer allgemeinen ' +
		'Aufzählung; der Fall selbst betraf eine andere Frage.',
	'ZGB Art. 647c':
		'Das Bundesgericht hat diese Zählung nur für die nützlichen Massnahmen entschieden (BGE 144 III 510 E. 2.2.4, ' +
		'zu Art. 647d). In seiner Begründung hält es aber fest, dass eine Zweitversammlung, an der nicht die Hälfte ' +
		'aller Eigentümer teilnimmt, nach dem Wortlaut auch notwendige Arbeiten nicht beschliessen könnte, was der ' +
		'Gesetzgeber nicht gewollt haben könne.'
};

/** {Gericht} der Anwendung, an dessen Stelle `GERICHT_4B_WEBSITE` tritt. */
const GERICHT_4B_ANWENDUNG = {
	'ZGB Art. 647a Abs. 2': LEHRE_UND_GERICHT['ZGB Art. 647a Abs. 2'].gericht,
	'ZGB Art. 647c': GERICHT_647C
};

// Je Artikel der Kopfzählweise genau ein Satz zum sicheren Weg, und kein Satz zu einem anderen Artikel.
for (const [name, satz] of [
	['SICHER_4B_WEBSITE', SICHER_4B_WEBSITE],
	['SICHER_JE_ARTIKEL', SICHER_JE_ARTIKEL]
]) {
	if (Object.keys(satz).sort().join('|') !== [...KOPFZAEHLWEISE_ARTIKEL].sort().join('|')) {
		throw new Error(`${name} trägt nicht genau die Artikel von KOPFZAEHLWEISE_ARTIKEL.`);
	}
}
if (Object.keys(GERICHT_4B_ANWENDUNG).sort().join('|') !== Object.keys(GERICHT_4B_WEBSITE).sort().join('|')) {
	throw new Error('GERICHT_4B_ANWENDUNG und GERICHT_4B_WEBSITE nennen nicht dieselben Artikel.');
}
// Codeprüfung N6: ein Satz zum Bundesgericht für einen Artikel ohne 4b griffe nie.
for (const artikel of Object.keys(GERICHT_4B_WEBSITE)) {
	if (!KOPFZAEHLWEISE_ARTIKEL.includes(artikel)) {
		throw new Error(`GERICHT_4B_WEBSITE nennt ${artikel}, der nicht in KOPFZAEHLWEISE_ARTIKEL steht.`);
	}
}

/** Der Artikel, nach dem eine Karte 4b trägt, oder `undefined`. */
function artikel4b(k) {
	if (k.wortlautAbweichung !== true) return undefined;
	return KOPFZAEHLWEISE_ARTIKEL.find((a) => k.rechtsgrundlage.startsWith(a));
}

/**
 * 4b auf der Website: 4b der aktuellen Fassung (`rw`) ohne «so rechnet Votum»,
 * mit den Sätzen oben, je genau einmal ersetzt (`ersetzeGenau`), damit eine
 * neue Fassung mit anderem Wortlaut den Export abbricht, statt still den alten
 * Satz zu zeigen. **Aus `rw`, nicht aus einer Hilfsfunktion einer festen
 * Fassung** (Codeprüfung der Fassung 2026-11-17, M2): Sonst bliebe der Text
 * nach dem Nachziehen der Importzeile der alte, und nichts bräche ab.
 */
function wortlautErklaerungWebsite(artikel) {
	const anwendung = rw.wortlautErklaerungJeArtikel?.[artikel];
	if (!anwendung) throw new Error(`Die Fassung ${rw.fassung} trägt 4b an ${artikel} nicht.`);
	let wortlaut = ersetzeGenau(ersetzeGenau(anwendung, ENTHALTUNG_SATZ, ENTHALTUNG_SATZ_WEBSITE), SICHER_JE_ARTIKEL[artikel], SICHER_4B_WEBSITE[artikel]);
	if (GERICHT_4B_WEBSITE[artikel]) {
		wortlaut = ersetzeGenau(wortlaut, GERICHT_4B_ANWENDUNG[artikel], GERICHT_4B_WEBSITE[artikel]);
	}
	return wortlaut;
}

/**
 * **Die Erklärung zu Art. 647d** (F9, L3, H-2): 4a der Fassung, ohne den Satz
 * zur Einstellung der Gemeinschaft, die es auf der Website nicht gibt, und ohne
 * «so rechnet Votum». Sie steht als allgemeine Erklärung im Abzug (Grund am Feld
 * unten). Bis hier war das die allgemeine Erklärung der Fassung, die einen
 * «sicheren» Weg empfahl, wo das Bundesgericht entschieden hat, und die zweite
 * Gegenmeinung ohne «das Bundesgericht ist beiden nicht gefolgt» nannte.
 * Abgeleitet, damit kein zweiter Wortlaut entsteht.
 */
const ART_647D = 'ZGB Art. 647d Abs. 1';
const WORTLAUT_647D_WEBSITE = ersetzeGenau(
	ersetzeGenau(
		rw.wortlautErklaerungJeArtikel?.[ART_647D] ?? '',
		'Die Einstellung Ihrer Gemeinschaft zur Zählweise gilt hier deshalb nicht. ',
		''
	),
	ENTHALTUNG_SATZ_647D,
	ersetzeGenau(ENTHALTUNG_SATZ_647D, '; so rechnet Votum.', '.')
);
/**
 * Die Karten nach Art. 647d; heute nur die nützliche bauliche Massnahme. Sie
 * tragen keine eigene Erklärung, die Website zeigt dort die allgemeine des
 * Abzugs, und die ist dieser Text (Grund am Feld `wortlautErklaerung` unten).
 */
const KARTEN_647D = new Set(
	rw.knoten.filter((k) => k.wortlautAbweichung === true && k.rechtsgrundlage.startsWith(ART_647D)).map((k) => k.id)
);
if ([...KARTEN_647D].join('|') !== 'k-baulich-nuetzlich') {
	throw new Error(`Die Erklärung zu Art. 647d gilt für «k-baulich-nuetzlich», die Fassung hat dort: ${[...KARTEN_647D].join(', ')}.`);
}
/*
 * **Jede andere Karte mit Abweichung vom Wortlaut trägt 4b.** Sonst fiele sie auf
 * der Website auf die allgemeine Erklärung zurück und bekäme still den Text zu
 * Art. 647d (`callback-api/server.js` Z. 1409).
 */
for (const k of rw.knoten.filter((x) => x.wortlautAbweichung === true && !KARTEN_647D.has(x.id))) {
	if (!artikel4b(k)) {
		throw new Error(
			`«${k.id}» weicht vom Wortlaut ab, trägt aber keine eigene Erklärung (4b); auf der Website bekäme sie den Text zu Art. 647d.`
		);
	}
}

/**
 * **Die Formel unter «Erforderliches Quorum»** (F2): An den Karten mit
 * qualifiziertem Mehr und 4b nannte die Typformel «Mehrheit der anwesenden und
 * vertretenen Köpfe» ohne Vorbehalt, neben einem Kasten, der genau das
 * umstritten nennt. Die Typformel bleibt für Art. 647d und das Reglement. Die
 * Liste ist die der Textvorgabe; kommt eine Karte dazu oder fällt eine weg,
 * bricht der Export ab, damit der Satz dort erst geprüft wird.
 */
const FORMEL_KOEPFE_KARTEN = new Set(rw.knoten.filter((k) => k.typ === 'qualifiziertes_mehr' && artikel4b(k)).map((k) => k.id));
const FORMEL_KOEPFE_ERWARTET = [
	'k-bewirtschaftung-waehlen-erweitert',
	'k-bewirtschaftung-erweitert',
	'k-prozessfuehrung',
	'k-benutzungsweise',
	'k-verwaltung-wichtig',
	'k-baulich-luxurioes-ausweg'
];
if ([...FORMEL_KOEPFE_KARTEN].sort().join('|') !== [...FORMEL_KOEPFE_ERWARTET].sort().join('|')) {
	throw new Error(`Die Karten mit qualifiziertem Mehr und 4b sind andere als erwartet: ${[...FORMEL_KOEPFE_KARTEN].join(', ')}.`);
}
/*
 * **Dasselbe beim einfachen Mehr** (F2, Nacharbeit 15.11.2026): An Art. 647a
 * Abs. 2 und 647c nannte die Typformel «der anwesenden und vertretenen
 * Eigentümer» neben dem Kasten, der das umstritten nennt. Feste Menge wie oben.
 *
 * **Vorgegeben, nicht abgeleitet** (Textvorgabe, Nachtrag Runde 3; Codeprüfung
 * N5): Die Formel lässt den Beleg der Typformel (ZGB Art. 67 Abs. 2 i.V.m.
 * Art. 712m Abs. 2) mit Absicht weg, denn er trägt die Zählung unter den
 * Anwesenden, die die Karte gerade offenlässt. Damit eine geänderte Typformel
 * die Vorgabe neu ansehen lässt, hält der Export an ihrem heutigen Wortlaut fest.
 */
const FORMEL_KOEPFE_EINFACH = 'Mehrheit der Köpfe. ' + VERWEIS_ZAEHLWEISE;
const TYPFORMEL_EINFACH_GEPRUEFT =
	'Mehrheit der Stimmen der anwesenden oder vertretenen Eigentümer (ZGB Art. 67 Abs. 2 i.V.m. Art. 712m Abs. 2).';
if (rw.ergebnistypen.find((t) => t.typ === 'einfaches_mehr')?.formel !== TYPFORMEL_EINFACH_GEPRUEFT) {
	throw new Error(
		'Die Typformel einfaches_mehr hat sich geändert; die Formel an den Karten mit 4b (FORMEL_KOEPFE_EINFACH) ' +
			'ist gegen den alten Wortlaut vorgegeben und gehört neu angesehen.'
	);
}
const FORMEL_EINFACH_KARTEN = new Set(rw.knoten.filter((k) => k.typ === 'einfaches_mehr' && artikel4b(k)).map((k) => k.id));
const FORMEL_EINFACH_ERWARTET = ['k-zustaendigkeit-gewoehnlich', 'k-baulich-notwendig'];
if ([...FORMEL_EINFACH_KARTEN].sort().join('|') !== [...FORMEL_EINFACH_ERWARTET].sort().join('|')) {
	throw new Error(`Die Karten mit einfachem Mehr und 4b sind andere als erwartet: ${[...FORMEL_EINFACH_KARTEN].join(', ')}.`);
}
for (const k of rw.knoten.filter((x) => FORMEL_KOEPFE_KARTEN.has(x.id) || FORMEL_EINFACH_KARTEN.has(x.id))) {
	if (k.formel) throw new Error(`«${k.id}» trägt schon eine eigene Formel; der Export überschreibt sie nicht.`);
}

/**
 * Die Formel der Karten mit qualifiziertem Mehr und 4b, aus der Typformel der
 * Website abgeleitet (sie läuft dafür durch `text()` und deren Umformulierung,
 * unten). Die Formel beim einfachen Mehr ist dagegen vorgegeben
 * (`FORMEL_KOEPFE_EINFACH`, oben).
 */
function formelKoepfeOffen() {
	const typ = rw.ergebnistypen.find((t) => t.typ === 'qualifiziertes_mehr');
	const formel = ersetzeGenau(text(typ.formel), 'Mehrheit der anwesenden und vertretenen Köpfe', 'Mehrheit der Köpfe');
	return `${formel} ${VERWEIS_ZAEHLWEISE}`;
}

/**
 * **Der erste Satz der Wahl der Bewirtschaftung auf der Website** (Fassungen
 * 2026-10-21 und 2026-10-23; Laien- und Fachprüfung des Abzugs 20.10.2026), an
 * der gewöhnlichen Wahl allein und an der Wahl mit erweiterten Kompetenzen vor
 * dem Satz nach dem Gesetz. Die Anwendung sagt dasselbe mit «Kompetenzen über
 * die gewöhnliche Verwaltung hinaus erhalten» (`ERWEITERUNG`).
 */
const WAHL_ERSTER_SATZ_WEBSITE =
	'Soll die Bewirtschaftung mehr als die gewöhnliche Verwaltung übernehmen, etwa ' +
	'gemeinschaftliche Teile vermieten, braucht das einen eigenen Beschluss mit qualifiziertem ' +
	'Mehr; um statt der Versammlung zu entscheiden, etwa Budget oder Fondseinlagen festlegen ' +
	'statt nur vorschlagen, Einstimmigkeit (ZGB Art. 647b Abs. 1, 712g Abs. 3; ' +
	'SVIT-Kommentar Rz. 46 ad Art. 712q, Rz. 91 ad Art. 712g, Rz. 45 ad Art. 712m).';

/**
 * Gezielte Umformulierungen für die Website, je mit Grund (Durchgang über
 * alle «oder»-Stellen, Auftraggeber 15.08.2026). Greifen NACH den mechanischen
 * Ersetzungen, deshalb stehen die Schlüssel in der bereits umgeformten
 * Fassung (Komma statt Gedankenstrich).
 */
/**
 * Der fünfte Hinweis der Karte zur strengeren Beschlussfähigkeit (Fassung
 * 2026-10-30), gesucht am Anfang, weil die Fassung ihn nicht einzeln
 * exportiert. Fehlt er, bricht der Export ab.
 */
const BESCHLUSSFAEHIGKEIT_NICHT_GEKLAERT = rw.knoten
	.find((k) => k.id === 'k-reglement-beschlussfaehigkeit')
	?.hinweise?.find((h) => h.startsWith('Ob eine Klausel, die mit weniger beschlossen wurde,'));
if (!BESCHLUSSFAEHIGKEIT_NICHT_GEKLAERT) {
	throw new Error('Der Hinweis «Ob eine Klausel, die mit weniger beschlossen wurde, …» fehlt an k-reglement-beschlussfaehigkeit.');
}

/**
 * Der dritte Hinweis an `k-grenzfall-nutzung` (Fassung 2026-09-24), gesucht wie
 * oben, weil die Fassung ihn nicht einzeln exportiert. Fehlt er oder steht er
 * mehr als einmal, bricht der Export ab.
 */
const GRENZFALL_NUTZUNG_KOEPFE = (() => {
	const treffer = (rw.knoten.find((k) => k.id === 'k-grenzfall-nutzung')?.hinweise ?? []).filter((h) =>
		h.startsWith('Beim qualifizierten Mehr zählen')
	);
	if (treffer.length !== 1) {
		throw new Error(`Der Hinweis «Beim qualifizierten Mehr zählen …» steht ${treffer.length}-mal statt einmal an k-grenzfall-nutzung.`);
	}
	return treffer[0];
})();

const UMFORMULIERUNGEN = new Map([
	// **Der Grenzfall der Nutzung: die Köpfe nicht als gesichert** (Runde 3, S2; Codeprüfung
	// M1). Der Hinweis nannte die Zählung unter den Anwesenden ohne Vorbehalt, wo die Karten
	// mit 4b sie umstritten nennen. Die Karte hat keinen Kasten «Wortlaut und Rechtsprechung»,
	// deshalb ohne Verweis. Seit der Fassung 2026-11-17 sagt die Anwendung dasselbe (`GRENZFALL`),
	// mit Punkt statt Strichpunkt, «anfechten» ohne Link und am Schluss der Wartezeit nach L13
	// statt «einige Tage nach Ablauf» (Grund dort); hier bleibt der geprüfte Website-Wortlaut.
	[
		GRENZFALL_NUTZUNG_KOEPFE,
		ersetzeGenau(
			GRENZFALL_NUTZUNG_KOEPFE,
			GRENZFALL,
			// Runde 4, U2 (Fach R3 F1, Laien R3 2): was das Bundesgericht entschieden hat, und die Lage dazwischen;
			// Runde 5, V1 (Laien R4 1, Fach R4 F2): der Schluss aus den Bausteinen von 4b, kein zweiter Wortlaut.
			'Beim qualifizierten Mehr zählen bei den Wertquoten alle Eigentümer, auch die abwesenden. Bei den Köpfen ' +
				'sagt das Gesetz «Mehrheit aller Miteigentümer»; die herrschende Lehre, die Auffassung der meisten ' +
				'Fachleute, zählt trotzdem nur die anwesenden und vertretenen Eigentümer (Art. 712m Rz. 181, 190 f.). ' +
				'Das Bundesgericht ist ihr für nützliche bauliche Massnahmen gefolgt (BGE 144 III 510 E. 2.2.4), für ' +
				'wichtigere Verwaltungshandlungen hat es nicht entschieden. Ganz sicher ist bei den Köpfen deshalb nur ' +
				`ein Beschluss, dem mehr als die Hälfte aller Eigentümer zustimmt; ${VOLLMACHTEN_4B} ` +
				`${ANGENOMMEN_QUALIFIZIERT} ${ANFECHTBAR_4B} ${AUSFUEHREN_4B}`
		)
	],
	// **«eine gemeinsame Fläche, die die anderen benutzen dürfen»** (08.10.2026):
	// grammatisch richtig, aber der Inhaltswächter der Website meldet «die die»
	// als halb angewandte Ersetzung, und mit «welche» liest es sich leichter. Die
	// Fassung 2026-10-17 ist ausgeliefert und bleibt nach AD-4; geändert wird
	// nur der Wortlaut auf der Website.
	// Abgeleitet statt als Wortlaut geschrieben; damit der Wächter auf ungenutzte
	// Schlüssel nicht blind ist, bricht ein Ersatz ab, der nichts ersetzt.
	[AUSWEG_HINWEISE[1], ersetzeGenau(AUSWEG_HINWEISE[1], 'Fläche, die die anderen', 'Fläche, welche die anderen')],
	// **Die gemeinsame Wohnung des Beklagten** (Fassung 2026-10-11, Laien- und
	// Fachprüfung 30.09.2026, Runde 2 B4, Runde 3 Befund 5). Die Karte der
	// Anwendung sagt, was Votum zählt und wo die Leitung festhält, gegen wen
	// sich der Antrag richtet. Die Website rechnet nichts und fragt nichts;
	// dort steht die Handlung für die Zählung von Hand. Beide Fassungen stehen
	// in der Fassungsdatei, damit der Schlüssel nicht still veraltet.
	[GEMEINSAME_WOHNUNG, GEMEINSAME_WOHNUNG_WEBSITE],
	// **Der Hinweis zu den Angehörigen ohne Werkzeugsätze** (Fassung 2026-10-12,
	// Laien- und Fachprüfung 30.09.2026, A3): Auf der Website rechnet nichts.
	// Seit Fassung 2026-11-10 sagt die Anwendung, dass die Gemeinschaft die Zahl
	// der Angehörigen im Ausstand einstellt (L10, W12); die Website behält ihren
	// geprüften Wortlaut zur Zählung von Hand. Er sagt dasselbe ohne
	// Werkzeugsatz, und auf der Website zählt niemand nach einer Lesart (Lesarten
	// Block 8, 22.10.2026; E1, Block D).
	[ANGEHOERIGE, ANGEHOERIGE_WEBSITE],
	// **Die nützliche Massnahme: die Werkzeugsätze bleiben in der Anwendung**
	// (Fassung 2026-10-13, Codeprüfung 04.10.2026, N6). «Sind Sie unsicher,
	// erfassen Sie die Person …» und «halten Sie sie im Antragstext fest»
	// richten sich an die Sitzungsleitung; die Website rechnet und erfasst
	// nichts. Dort bleibt die Rechtslage. Beide Fassungen stehen in der
	// Fassungsdatei, damit der Schlüssel nicht still veraltet.
	[NUTZLICH_BETROFFEN_ANWENDUNG, NUTZLICH_BETROFFEN_WEBSITE],
	[NUTZLICH_KOSTEN_ANWENDUNG, NUTZLICH_KOSTEN_WEBSITE],
	// **Die Einsprache: ohne Werkzeugsätze** (Fassung 2026-10-20). Wie oben: Die
	// Website zählt und erfasst nichts, es bleibt, wer nicht mitstimmt. Seit der
	// Fassung 2026-11-04 (F4a, S5) aus jener Fassung, beide Wortlaute dort.
	[EINSPRACHE_BETROFFENE_ANWENDUNG, EINSPRACHE_BETROFFENE_WEBSITE],
	// **Die Abgrenzung des Sonderrechts: der Weg zum Notar in der Begründung**
	// (Laienprüfung des Abzugs 20.10.2026, Runde 6). Wer kein Reglement dazu hat,
	// überspringt den Kasten und las nur «eine Vereinbarung aller»; das las sich
	// wie ein einstimmiger Beschluss ins Protokoll.
	[
		'Die Abgrenzung von Sonderrecht und gemeinschaftlichen Teilen ist Teil der Grundordnung; ' +
			'eine nachträgliche Änderung ist eine Vereinbarung aller.',
		'Die Abgrenzung von Sonderrecht und gemeinschaftlichen Teilen ist Teil der Grundordnung; ' +
			'eine nachträgliche Änderung braucht einen Vertrag aller, öffentlich beurkundet.'
	],
	// **Die Wahl der Bewirtschaftung: eine eigene Website-Fassung** (Fassungen
	// 2026-10-21 und 2026-10-23; Laien- und Fachprüfung des Abzugs 20.10.2026). Auf der Website
	// rechnet nichts, also kein «so rechnet dieses Werkzeug»; der Lehrstreit steht
	// kürzer da, und die Erweiterung nennt den Vorbehalt der Einstimmigkeit
	// (Rz. 46 ad Art. 712q, Rz. 91 ad Art. 712g, Rz. 45 ad Art. 712m); die
	// Anwendung trägt ihn seit Fassung 2026-10-23. Der Ratgeber der Website
	// sagt dasselbe (`faq.md`, «Qualifiziertes Mehr»).
	//
	// **Seit Fassung 2026-10-24** hängt der Hinweis mit dem Lehrstreit an der
	// Wahl mit erweiterten Kompetenzen und sagt, dass die Gemeinschaft die
	// Lesart wählt. Auf der Website wählt niemand; sie nennt, von welcher Seite
	// die Karte ausgeht, die andere mit Fundstelle und den sicheren Weg, und
	// schweigt zur Umstellung (Produktentscheid 22.10.2026, Lesarten Block 8).
	// Das leistet ihr geprüfter Wortlaut schon. Die gewöhnliche Wahl trägt den ersten Satz
	// und den Verweis auf die Karte mit Lesart; die Website setzt dafür den
	// ersten Satz ihrer Fassung.
	[WAHL_ERWEITERUNG, WAHL_ERSTER_SATZ_WEBSITE],
	// **Die Wahl mit erweiterten Kompetenzen nach dem Gesetz** (Fassung
	// 2026-11-13, Entscheid 0048, Block B): Die Karte rechnet nach der Vorgabe
	// das qualifizierte Mehr, und ihr Hinweis folgt dem Gesetz. Er sagt nichts
	// über Votum und nichts über die Seite «Lesarten»; die Website nimmt ihn
	// deshalb, wie er ist, nur mit ihrem eigenen ersten Satz. Bis zur Fassung
	// 2026-11-11 stand hier der geprüfte Website-Wortlaut «diese Karte geht vom
	// einfachen Mehr aus» mit der Anfechtung.
	// Seit der Fassung 2026-11-14 mit dem Satz zur Zählweise der Köpfe (L13,
	// Endfassung Block C, Abschnitt 7): Die Website zeigt «Wortlaut und
	// Rechtsprechung» nach der Vorgabe (`wortlautErklaerung` an der Karte).
	[
		// Seit der Fassung 2026-11-17 steht die Erweiterung in der Anwendung am Schluss; der Wert
		// ist nur der Schlüssel der Aufteilung unten, die die Reihenfolge der Website setzt.
		nachDieserFassung(WAHL_HINWEIS_NACH_GESETZ),
		`${WAHL_ERSTER_SATZ_WEBSITE} ${WAHL_REST}`
	],
	// **Kleine Gemeinschaften an der Ausschlussklage: ohne «Votum»** (Fassung
	// 2026-11-13, Entscheid 0048, Block B). Die Website nennt Votum nirgends
	// (`check-abzug.mjs`); sie sagt wie an den übrigen Karten «diese Karte».
	[KLEINE_GEMEINSCHAFTEN, ersetzeGenau(KLEINE_GEMEINSCHAFTEN, '; Votum folgt dem Gesetz.', '; diese Karte folgt dem Gesetz.')],
	// **Die Zuständigkeitsordnung: der Wortlaut vor der Lesart, ohne
	// Werkzeugsatz** (Fassung 2026-10-26, Lesart L2; Lesarten Block 8). Die
	// Anwendung sagt seither, dass die Gemeinschaft die Lesart wählt; auf der
	// Website wählt niemand. Sie nennt wie bei der Wahl der Bewirtschaftung
	// oben, von welcher Seite die Karte ausgeht (Produktentscheid 22.10.2026),
	// und sagt nicht mehr «dieses Werkzeug» (Konzept Lesarten, Kriterium 15).
	[
		BEGRUENDUNG,
		ersetzeGenau(
			BEGRUENDUNG_VORHER,
			'dieses Werkzeug setzt deshalb das einfache Mehr an.',
			'diese Karte geht deshalb vom einfachen Mehr aus.'
		)
	],
	// Laienprüfung Block 8, L8-4 und L8-5: Frist und Rat zum Zuwarten, «mehr als
	// die Hälfte aller Wertquoten» statt «die Mehrheit der Wertquoten». Die
	// Anfechtung steht seit der Fassung 2026-10-30 an der Karte
	// (`ANFECHTUNG_ZUSTAENDIGKEIT` in `quorum-2026-10-30.ts`); der Schlüssel
	// ist der neue Hinweis, der Wert bleibt der geprüfte der Website.
	// Der Schlüssel nach der Fassung 2026-11-14 (L13); der Wert bleibt der geprüfte der Website.
	// Runde 2, R3 (Laien 2): «nach beiden Lesarten» meint die Wahl zum Mehr, nicht die Zählweise der Köpfe,
	// wie in der Anwendung seit der Fassung 2026-11-14 («beiden Wahlen zum Mehr»); nur auf der Website.
	[
		nachDieserFassung(`${HINWEIS_LESART} ${ANFECHTUNG_ZUSTAENDIGKEIT}`),
		ersetzeGenau(
			// Runde 3, S3 (Laien R2 3, Codeprüfung N4): «einige Tage nach», wie in 4b derselben Karte.
			ersetzeGenau(
				ZUSTAENDIGKEIT_WEBSITE,
				'Wenden Sie ihn deshalb, wo es nicht eilt, erst nach Ablauf dieser Frist an.',
				'Wenden Sie ihn deshalb, wo es nicht eilt, erst einige Tage nach Ablauf dieser Frist an.'
			),
			'dann trägt der Beschluss nach beiden Lesarten.',
			`dann trägt der Beschluss nach beiden Lesarten zum Mehr, einfach oder qualifiziert. ${VERWEIS_ZAEHLWEISE}`
		)
	],
	// **Entscheiden statt der Versammlung: ohne «Votum»** (Fassung 2026-10-27,
	// C1 und C2; Lesarten Block 8). Die Website nennt Votum nirgends; dass die
	// Karte Einstimmigkeit verlangt, sagt schon das Erfordernis. Seit der
	// Fassung 2026-11-04 (F4a, S6) deren Wortlaut, derselbe Schnitt.
	[
		WARUM_EINSTIMMIG,
		ersetzeGenau(WARUM_EINSTIMMIG, 'kein tieferes Mehr; deshalb rechnet Votum mit Einstimmigkeit.', 'kein tieferes Mehr.')
	],
	// **Die erweiterten Befugnisse der Bewirtschaftung: ohne «Votum»** (Fassung
	// 2026-11-04, F4a, S8). Derselbe Grund wie oben; nur der Satz «Danach
	// rechnet Votum.» fällt weg, der Rest ist der geprüfte Wortlaut.
	[DELEGATION_RZ_115, ersetzeGenau(DELEGATION_RZ_115, ' Danach rechnet Votum.', '')],
	// Die Enthaltungen: Seit der Fassung 2026-10-30 zählen die Karten wie die
	// herrschende Lehre (Punkt 6, `quorum-2026-10-30.ts`); der Abzug setzt hier
	// nichts mehr um.
	...HAUSWART_TEXTE.map((t) => [t, ersetzeGenau(t, HAUSWART_KARTE, HAUSWART_WEBSITE)]),
	// **Die eigene Schranke: der Wortlaut vor der Lesart** (Fassung
	// 2026-11-05, Lesart L6). Die Anwendung sagt seither, dass die Gemeinschaft
	// einstellt; auf der Website wählt niemand. Sie behält ihren geprüften
	// Wortlaut bis Block 8, wie bei der Zuständigkeitsordnung oben, nur ohne
	// den Werkzeugsatz (Konzept Lesarten, Kriterium 15): An einer Karte mit
	// Lesart sagt sie, von welcher Seite die Karte ausgeht.
	[
		SCHRANKE_BEGRUENDUNG,
		ersetzeGenau(
			SCHRANKE_BEGRUENDUNG_VORHER,
			' — deshalb setzt dieses Werkzeug die Einstimmigkeit an.',
			', deshalb geht diese Karte von der Einstimmigkeit aus.'
		)
	],
	// Derselbe Grund im Hinweis «Zum Streit»: Die zwei neuen Sätze nennen die
	// Einstellung der Gemeinschaft und das Verkünden nach ihr; die Website
	// behält die Sätze der Fassung 2026-11-04, bis ihre eigene Fassung der
	// Lesarten geprüft ist.
	[SCHRANKE_ZUM_STREIT, SCHRANKE_ZUM_STREIT_VORHER],
	// **Die Ermächtigung zur Prozessführung: der Wortlaut vor der Lesart**
	// (Fassung 2026-11-10, Lesart L11). Wie bei der eigenen Schranke oben: Die
	// Anwendung sagt seither, dass die Gemeinschaft das Mehr einstellt; auf der
	// Website wählt niemand, und sie geht weiter vom qualifizierten Mehr aus.
	// Sie behält ihren geprüften Wortlaut bis Block 8, nur ohne den
	// Werkzeugsatz (Konzept Lesarten, Kriterium 15).
	[PROZESS_BEGRUENDUNG, PROZESS_BEGRUENDUNG_VORHER],
	// **Die luxuriöse Massnahme: der Wortlaut vor der Lesart** (Fassung
	// 2026-11-10, L12; Codeprüfung E1 Block B, Befund 1), wie bei L11: ohne die
	// Seite «Lesarten» und ohne den Werkzeugsatz. Die Sätze dieses Abschnitts bis
	// zur Ausschlussklage sind im Website-Abzug E4 geprüft (`quellen`,
	// `pruefung/berichte/2026-11-11-website-e4-*`); «auch der abwesenden» nach L-10.
	[
		HINWEIS_LUXURIOES,
		ersetzeGenau(
			HINWEIS_LUXURIOES_VORHER,
			'Dieses Werkzeug rechnet über alle Eigentümer, wer das erreicht, genügt beiden Lesarten.',
			'Diese Karte geht von der Zustimmung aller im Grundbuch eingetragenen Eigentümer aus, auch der ' +
				'abwesenden; wer sie hat, genügt beiden Lesarten.'
		)
	],
	// Der Hinweis zur Prozessführung (L11) ohne den Werkzeugsatz (Featureprüfung E1, B1).
	[
		// Der Schlüssel nach der Fassung 2026-11-14 (R5-F-3, «beiden Wahlen zum Mehr»).
		nachDieserFassung(PROZESS_HINWEIS),
		ersetzeGenau(
			PROZESS_HINWEIS_VORHER,
			'Dieses Werkzeug setzt das strengere Erfordernis an — wer es erreicht, genügt beiden Lesarten.',
			'Diese Karte geht vom strengeren Erfordernis aus; wer es erreicht, genügt beiden Lesarten.'
		)
	],
	// **Die Ermächtigung zur Ausschlussklage: der Wortlaut vor der Lesart**
	// (Fassung 2026-11-10, Lesart L9). Wie bei L11 und L12: Die Anwendung sagt
	// seither, dass die Gemeinschaft die Zählbasis einstellt; auf der Website
	// wählt niemand, und sie geht weiter von der Mehrheit aller Eigentümer ohne
	// den Beklagten aus. Die Vorfassung kommt hier nicht ohne den Werkzeugsatz
	// aus, deshalb nur «dieses Werkzeug» durch «diese Karte». Der Ersatz läuft
	// nicht durch die mechanischen Ersetzungen von `text()`; das Komma statt des
	// Gedankenstrichs steht deshalb hier, wie im Abzug der Fassung 2026-11-04
	// (Website-Abzug E4, 11.11.2026; Wächter `KEIN_GEDANKENSTRICH` unten).
	[
		AUSSCHLUSS_BEGRUENDUNG,
		ersetzeGenau(
			AUSSCHLUSS_BEGRUENDUNG_VORHER,
			'dieses Werkzeug folgt der strengeren Wortlaut-Lesart — ein',
			'diese Karte folgt der strengeren Wortlaut-Lesart, ein'
		)
	],
	// Derselbe Grund im Hinweis zur Zählbasis: Die Vorfassung sagt «Dieses
	// Werkzeug rechnet über alle»; die Website rechnet nichts, sie geht von der
	// strengeren Zahl aus (E4: «Diese Karte rechnet» stimmte so nicht).
	[
		W10,
		ersetzeGenau(
			HINWEIS_ZAEHLBASIS_VORHER,
			'Dieses Werkzeug rechnet über alle — wer',
			'Diese Karte geht von allen Eigentümern ohne den Beklagten aus; wer'
		)
	],
	// **Strengere Beschlussfähigkeit, «Gut zu wissen»** (Codeprüfung E4, M1): Der
	// Kasten der Website sagt seit E4 «ist es sicherer, sie einzuhalten» und
	// trennt die gültig eingeführte Klausel ab; der Hinweis darunter sagte
	// unbedingt «Halten Sie eine solche Klausel ein». Auf der Website derselbe Rat.
	[
		BESCHLUSSFAEHIGKEIT_NICHT_GEKLAERT,
		ersetzeGenau(
			BESCHLUSSFAEHIGKEIT_NICHT_GEKLAERT,
			'Halten Sie eine solche Klausel ein, solange sie nicht aufgehoben ist.',
			'Sicherer ist, eine solche Klausel einzuhalten, solange sie nicht aufgehoben ist.'
		)
	],
	// **Prozess gegen einen Eigentümer: auf der Website zählt die Leserin selbst**
	// (Website-Abzug E4, Laienprüfung L-11 bis L-13, Fachprüfung F-6, F-7). In der
	// Anwendung setzt die Leitung den Ausstand, und Votum zählt; hier muss der Satz
	// sagen, wer bleibt, was mit Vollmachten geschieht und dass über alle gezählt
	// wird (BGer 5A_721/2021 E. 3.3; BGE 134 III 481 E. 3.8; Rz. 150 ad Art. 712m).
	// Der Schlüssel nach der Fassung 2026-11-15, die den Schluss wie die Website
	// fasst (Entscheid 0047, 4). Der Wert ist der geprüfte der Website, seit
	// «Texte nach 0047» mit den Sätzen der Anwendung (`ANGEHOERIGE_BERATUNG`,
	// `VOLLMACHT_AN_IHN`: zwei Sätze, ohne Rz. 150 ad Art. 712m).
	[
		nachDieserFassung(GEGEN_EIGENTUEMER),
		ersetzeGenau(
			GEGEN_EIGENTUEMER,
			'Setzen Sie sie für dieses ' +
				'Traktandum in den Ausstand. Einladen und vor der Abstimmung anhören müssen Sie den Eigentümer ' +
				'trotzdem; an der Beratung danach und an der Abstimmung nimmt er nicht teil (BGer 5A_198/2014 ' +
				'E. 5.3.4 und 5.4). Seine Angehörigen stimmen nur nicht mit.',
			'Einladen und vor der Abstimmung anhören müssen Sie den Eigentümer trotzdem; an der Beratung ' +
				'danach und an der Abstimmung nimmt er nicht teil (BGer 5A_198/2014 E. 5.3.4 und 5.4). ' +
				// Runde 2: ob die Angehörigen mitberaten, ist offen (R2-F-3); seit der Fassung
				// 2026-11-15 derselbe Satz in der Anwendung (`ANGEHOERIGE_BERATUNG`). Vollmacht
				// auch an ihn, Geschwister (R2-L-1 zu L-12); Zählung wie Nein (R2-L-4).
				`${ANGEHOERIGE_BERATUNG} ` +
				// Runde 3 (R3-F-2): Art. 68 nennt eingetragene Partner nicht, anders als Art. 21.
				'Geschwister und Lebenspartner ohne Ehe stimmen normal mit. Für eingetragene Partner, ' +
				'die das Gesetz hier nicht nennt, ist das nicht geklärt; holen Sie in diesem Fall Rat ein. ' +
				// Seit der Fassung 2026-11-15 derselbe Satz in der Anwendung, ohne Rz. 150 ad Art. 712m
				// (Fachprüfung «Texte nach 0047», Runde 2, R2-F-2).
				`${VOLLMACHT_AN_IHN} Bei den Wertquoten zählt trotzdem das Ganze, ` +
				'auch ihre: Nötig ist mehr als die Hälfte aller Wertquoten (so beiläufig BGer 5A_721/2021 E. 3.3). ' +
				// L6 (Meldung vom 15.11.2026): «sicher» galt nur für den Ausstand und stand neben dem «sicher»
				// des Kastens, das die Hälfte aller verlangt; jetzt eingegrenzt und an den Kasten gebunden.
				'Was den Ausstand angeht, ist die Ermächtigung sicher, wenn die Ja-Stimmen auch dann reichen, wenn ' +
				'Sie den Eigentümer und seine Angehörigen wie Nein-Stimmen zählen: bei den Köpfen, soweit sie ' +
				'anwesend oder vertreten sind, bei den Wertquoten immer. Wie die Köpfe sonst gezählt werden und was ' +
				'nach jeder Zählweise trägt, steht unter «Wortlaut und Rechtsprechung».'
		)
	],
	// **Was Votum mit einer hinterlegten Klausel tut, gehört nicht auf die
	// Website** (Fassung 2026-10-07, 29.09.2026). Die Leserin hat nichts
	// hinterlegt, und die Website wendet nichts an; derselbe Grund wie beim
	// Reglementshinweis weiter unten. Es bleibt, was für sie gilt.
	// Seit der Fassung 2026-11-04 (F4a, S3, Endfassung) ist der Schlüssel der
	// Hinweis jener Fassung (`AUSSCHLUSS_REGLEMENTSHINWEIS`). Die Website trägt
	// den Satz zum Gesetz ohne den Werkzeugsatz, den Übergang vor «Steht in
	// Ihrem Reglement …» und den sicheren Weg am Ende (alle drei in
	// `quorum-2026-11-04.ts`); der Rest bleibt der geprüfte Wortlaut der Website.
	// Schlüssel und Wert nach der Fassung 2026-11-15 (Punkt 10 an der Ausschlussklage, `KLAUSEL_AUSSCHLUSS`,
	// der den Übergang vor «Steht in Ihrem Reglement …» mit ersetzt).
	[
		nachDieserFassung(AUSSCHLUSS_REGLEMENTSHINWEIS),
		`${REGLEMENT_DARF_AENDERN_WEBSITE} Eine Abweichung von der ` +
			`gesetzlichen Zählweise muss zudem einstimmig beschlossen werden ${KLAUSEL_AUSSCHLUSS} ` +
			'Steht in Ihrem Reglement eine abweichende Bestimmung, klären Sie ihre ' +
			'Geltung vor der Versammlung. Sicher ist die Ermächtigung nur, wenn sie das Mehr nach ' +
			`Gesetz und nach dem Wortlaut des Reglements erreicht. ${EINFUEHRUNG_MIT_ZUSTIMMUNG_ALLER}`
	],
	[
		'Der Beklagte zählt bei den Köpfen nicht mit (ZGB Art. 649b Abs. 2). Verlangt eine ' +
			'hinterlegte Regel zusätzlich eine Mehrheit aller Wertquoten, lässt dieses Werkzeug seine ' +
			'Quote im Nenner, weil sich das Mehr nach Wertquoten am gesamten Stockwerkeigentum bemisst ' +
			'(Rz. 191 ad Art. 712m); ob die Quote des Beklagten dort mitzählt, sagt keine Stelle ' +
			'ausdrücklich. Ein Beschluss, der so angenommen ist, hat die Mehrheit auch ohne seine ' +
			'Quote. Verlangt sie die Mehrheit der anwesenden und vertretenen Wertquoten, rechnet dieses ' +
			'Werkzeug ohne seine Quote, weil er nicht mitstimmt.',
		'Der Beklagte zählt bei den Köpfen nicht mit (ZGB Art. 649b Abs. 2). Verlangt Ihr ' +
			'Reglement zusätzlich eine Mehrheit aller Wertquoten, bleibt seine Quote nach der ' +
			'allgemeinen Regel im Nenner: Das Mehr nach Wertquoten bemisst sich am gesamten ' +
			'Stockwerkeigentum (Rz. 191 ad Art. 712m). Ausdrücklich zum Beklagten sagen das weder das ' +
			'Gesetz noch der SVIT-Kommentar. Ein Beschluss, der die Mehrheit so erreicht, hat sie auch ' +
			'ohne seine Quote.'
	],
	// Der Gedankenstrich der App-Fassung wurde hier zum falschen Komma vor
	// «oder»; als Frage mit zwei Verben liest sie sich sauber.
	[
		'Ändert sich nur die Art der Benutzung, oder der Charakter der Liegenschaft?',
		'Ändert sich nur die Art der Benutzung oder kippt der Charakter der Liegenschaft?'
	],
	// Dieselbe Klasse wie «anwesend oder vertreten»: Die Vertretenen fehlten
	// im Gegensatzpaar, obwohl ihre Stimme über die Vollmacht mitzählt.
	[
		'Zustimmung sämtlicher im Grundbuch eingetragener Eigentümer, nicht nur der Anwesenden.',
		'Zustimmung sämtlicher im Grundbuch eingetragener Eigentümer, nicht nur der Anwesenden und Vertretenen.'
	],
	// Der Nachklapp «— im Unterschied zur blossen Erhaltung eine Stufe darüber»
	// holpert als Komma-Anschluss; als Doppelpunkt-Schluss trägt er.
	[
		'Massgebend ist der Nutzen der <strong>Gemeinschaft</strong>, nicht der einzelner Eigentümer. ' +
			'Fassadenisolation, Heizungsersatz mit Systemwechsel, Photovoltaik, der nachträgliche ' +
			'Einbau eines Lifts. Hierher gehört auch, was das Haus erst gebrauchstauglicher macht, ' +
			'als es je war, im Unterschied zur blossen Erhaltung eine Stufe darüber.',
		'Massgebend ist der Nutzen der <strong>Gemeinschaft</strong>, nicht der einzelner Eigentümer. ' +
			'Fassadenisolation, Heizungsersatz mit Systemwechsel, Photovoltaik, der nachträgliche ' +
			'Einbau eines Lifts. Hierher gehört auch, was das Haus erst gebrauchstauglicher macht, ' +
			'als es je war: eine Stufe über der blossen Erhaltung.'
	],
	// Der Einschub «— ein Lift, … Balkon —» wird ohne Gedankenstriche zum
	// Kommasalat (fünf Kommas in einem Satz). Die Beispiele werden zum Subjekt,
	// der Satz kommt ohne Einschub aus.
	[
		'Reparatur, Ersatz von Defektem durch Gleichwertiges, behördliche Auflage. ' +
			'Massgebend ist, ob ohne die Massnahme Wert oder Gebrauchsfähigkeit leiden. ' +
			'<strong>Erhalten lässt sich nur, was schon da ist:</strong> Was neu geschaffen wird, ein Lift, ' +
			'wo es keinen gab, eine Photovoltaikanlage, ein zusätzlicher Balkon, ist keine ' +
			'Erhaltung, auch wenn es das Haus aufwertet und alle es vernünftig finden. ' +
			'Fragen Sie sich zuerst: Bestand die Sache bisher, und wird sie wiederhergestellt?',
		'Reparatur, Ersatz von Defektem durch Gleichwertiges, behördliche Auflage. ' +
			'Massgebend ist, ob ohne die Massnahme Wert oder Gebrauchsfähigkeit leiden. ' +
			'<strong>Erhalten lässt sich nur, was schon da ist:</strong> Ein Lift, wo es keinen gab, ' +
			'eine Photovoltaik-Anlage oder ein zusätzlicher Balkon ist keine Erhaltung, ' +
			'auch wenn es das Haus aufwertet und alle es vernünftig finden. ' +
			'Fragen Sie sich zuerst: Bestand die Sache bisher, und wird sie wiederhergestellt?'
	],
	// Laiensicht (Auftraggeber, 15.08.2026): Auf der Website steckt die Zählanweisung
	// im Zahlenbeispiel und im Wortlaut-Kasten der Karte; der zweite Satz der
	// E2-Formel doppelte sie und überlud den Einstieg. Die App behält die
	// volle Formel, dort gibt es die beiden Bausteine nicht.
	[
		'Mehrheit der anwesenden und vertretenen Köpfe und zugleich mehr als die Hälfte aller ' +
			'Wertquoten (bei einem Nenner von 1000 also mindestens 501). Die Köpfe zählen nach den ' +
			'Anwesenden und Vertretenen, die Wertquoten nach dem gesamten Bestand, auch die Quoten ' +
			'der Abwesenden zählen mit.',
		'Mehrheit der anwesenden und vertretenen Köpfe und zugleich mehr als die Hälfte aller ' +
			'Wertquoten (bei einem Nenner von 1000 also mindestens 501).'
	]
]);

/**
 * Welche Schlüssel aus `UMFORMULIERUNGEN` tatsächlich gegriffen haben.
 *
 * **Warum das nachgehalten wird** (Code-Review 23.09.2026): Die Schlüssel sind
 * Wortlaute, nicht Kennungen. Wer den Text im Regelwerk umformuliert, verliert
 * die Umformulierung still: Der Export läuft fehlerfrei durch, und auf der
 * Website steht wieder die Fassung, die der Eintrag seit dem 15.08.2026
 * behebt. Der Kommentar bei `VERWEISE` nennt genau diese Falle, seit dem
 * 23.09.2026; bis zu diesem Wächter hatte sie niemand geschlossen.
 *
 * Der nächste Block ändert den Text der Weiche `f5-1`, und das ist der erste
 * Schlüssel dieser Tabelle. Der Wächter gehört deshalb jetzt hierher und nicht
 * dann.
 */
const GEGRIFFEN = new Set();

/**
 * **Die Hilfe an «f3-1-selbst» bleibt der Website fern** (Fassung 2026-11-05,
 * Lesart L6; Fachprüfung Runde 2, R2-E-1). Sie sagt, welche Antwort je nach
 * Einstellung der Gemeinschaft zu wählen ist, und auf der Website stellt
 * niemand ein. Wie Begründung und «Zum Streit» oben behält die Website den
 * Stand der Vorfassung, und dort trug die Antwort keine Hilfe. Eine eigene
 * Fassung für die Website wäre ein neuer Aussentext mit eigener Prüfung.
 */
function websiteHilfe(a) {
	if (a.id === 'f3-1-selbst' && a.hilfe === SCHRANKE_SELBST_HILFE) return undefined;
	return text(a.hilfe);
}

/** Website-Ton: keine Gedankenstriche, Markdown-Fett als HTML. */
function text(s) {
	if (s === undefined || s === null) return s;
	const mechanisch = s
		// Schliessender Gedankenstrich mit folgendem Komma («… Balkon —, ist …»):
		// Das Komma gehört zum Satz, der Strich fällt weg. Ohne diese Regel
		// entstünde «,,».
		.replaceAll(' —, ', ', ')
		.replaceAll(' — ', ', ')
		.replaceAll('—', ',')
		// Auch am Satzanfang und als Hauptwort («der Anwesenden oder
		// Vertretenen», Einsprache 2026-10-20); die Grundform «anwesend oder
		// vertreten» bleibt, sie beschreibt eine einzelne Person.
		.replace(/\b([Aa]nwesenden?) oder ([Vv]ertretenen?)\b/g, '$1 und $2')
		// Dieselbe Klasse in der Erklärung der Kopfzählung: Auch dort zählen
		// die Vertretenen mit, nicht nur die Anwesenden.
		.replaceAll('Köpfe zählen nach den Anwesenden,', 'Köpfe zählen nach den Anwesenden und Vertretenen,')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	const ersatz = UMFORMULIERUNGEN.get(mechanisch);
	if (ersatz !== undefined) GEGRIFFEN.add(mechanisch);
	// **«das das», «die die» als Relativsatz** (Lesarten Block 8): grammatisch
	// richtig, aber der Inhaltswächter der Website meldet die Dopplung als halb
	// angewandte Ersetzung, und mit «welches» liest es sich leichter; wie oben
	// bei «Fläche, welche die anderen». Nach der Umformulierung, damit ihre
	// Schlüssel den Wortlaut des Regelwerks behalten.
	return (ersatz ?? mechanisch).replaceAll(', das das ', ', welches das ').replaceAll(', die die ', ', welche die ');
}


/**
 * Anfang und Rest einer langen Frage-Hilfe für die Website (26.09.2026).
 *
 * **Die Teile müssen zusammen genau das Ganze ergeben**, nach `text()`. Sonst
 * griffe eine Umwandlung über die Naht hinweg, und das bekannteste Beispiel
 * steht oben: `UMFORMULIERUNGEN` ist auf den ganzen Wortlaut geschlüsselt und
 * trifft einen Teil nie. `hilfe` bekäme dann die Umformulierung, Anfang und
 * Rest nicht, und die Website zeigte still die alte Fassung (Codeprüfung
 * 26.09.2026). Also abbrechen statt ausliefern.
 */
function geteilteHilfe(f) {
	if (!f.hilfe) return { hilfeAnfang: null, hilfeMehr: null };
	const teile = teileHilfe(f.hilfe);
	if (teile.mehr === null) return { hilfeAnfang: text(f.hilfe), hilfeMehr: null };
	const anfang = text(teile.anfang);
	const mehr = text(teile.mehr);
	if (`${anfang} ${mehr}` !== text(f.hilfe)) {
		throw new Error(
			`Die geteilte Hilfe zu ${f.id} ergibt nach der Umwandlung nicht das Ganze. ` +
				'Greift eine Umformulierung auf diese Hilfe, gehört sie in die Fassung selbst.'
		);
	}
	return { hilfeAnfang: anfang, hilfeMehr: mehr };
}

/** Wirft, wenn ein Schlüssel im ganzen Abzug nicht ein einziges Mal passte. */
function pruefeUmformulierungen() {
	const blind = [...UMFORMULIERUNGEN.keys()].filter((k) => !GEGRIFFEN.has(k));
	if (blind.length === 0) return;
	throw new Error(
		`${blind.length} Umformulierung(en) haben im ganzen Abzug nicht gegriffen:\n` +
			blind.map((k) => `  «${k}»`).join('\n') +
			'\nDer Schlüssel ist ein Wortlaut. Entweder ist der Text im Regelwerk ' +
			'umformuliert worden, dann gehört der Schlüssel nachgezogen, oder der ' +
			'Eintrag ist überholt und gehört entfernt.'
	);
}

/**
 * Verweise, die **nur** auf der Website stehen.
 *
 * **Warum nicht im Regelwerk** (23.09.2026): Dieselben Felder haben zwei
 * Verbraucher. Die Website setzt die Karten per `innerHTML` zusammen und
 * rendert HTML; Votum gibt denselben Text als gewöhnliche Svelte-Interpolation
 * aus (`Ergebniskarte.svelte`, `{karte.empfehlung}`) und zeigt ein `<a>`-Tag
 * deshalb wörtlich. Eine Sitzungsleitung läse den Tag mitten im Satz, in dem
 * Moment, in dem sie am wenigsten Zeit hat, ihn zu deuten.
 *
 * **Und an der Kennung statt am Wortlaut**, anders als `UMFORMULIERUNGEN`: Ein
 * Eintrag, der auf den ganzen Empfehlungstext passen muss, fällt bei der
 * nächsten Umformulierung still aus, ohne dass jemand etwas merkt. Fehlt die
 * Karte dagegen, bleibt der Text einfach ohne Verweis.
 */
const VERWEISE = new Map([
	[
		'k-grenzfall-nutzung',
		{
			// Der Verweis gehört an den Satz, der von Anfechtung handelt. Das ist
			// seit der Fassung 2026-09-24 der erste Hinweis, nicht mehr die
			// Empfehlung: Sie endet mit «Im Zweifel als Zweckänderung behandeln».
			anker: 'Monatsfrist',
			html: ' <a href="/ratgeber/#faq-anfechtung">Wie und bis wann Sie anfechten</a>'
		}
	]
]);

/**
 * Hängt den Verweis an den Hinweis, der seinen Anker trägt.
 *
 * **Und bricht ab, wenn er ihn nicht findet.** Ein stilles Weglassen wäre
 * dieselbe Falle wie ein Wortlautschlüssel in `UMFORMULIERUNGEN`: Wer den Text
 * umformuliert, verlöre den Verweis, ohne dass jemand etwas merkt. Der Export
 * läuft im Bauweg, ein Abbruch fällt also sofort auf.
 */
function mitVerweisen(id, hinweise) {
	const verweis = VERWEISE.get(id);
	if (!verweis) return hinweise;
	const treffer = hinweise.findIndex((h) => h.includes(verweis.anker));
	if (treffer < 0) {
		throw new Error(
			`Der Verweis für «${id}» sucht einen Hinweis mit «${verweis.anker}» und findet keinen. ` +
				'Entweder ist der Text umformuliert worden, dann gehört der Anker nachgezogen, ' +
				'oder der Verweis gehört entfernt.'
		);
	}
	return hinweise.map((h, i) => (i === treffer ? h + verweis.html : h));
}

/**
 * **Ein Hinweis wird auf der Website zu mehreren** (Meldung vom 15.11.2026,
 * F5 und L10; Produktentscheid 15.11.2026, Entscheid 0048, Antwort 11). Der
 * Hinweis an der Wahl mit erweiterten Kompetenzen war ein Absatz von gut 300
 * Wörtern, die Handlung stand in der Mitte. Auf der Website steht sie zuerst,
 * der Weg ohne Bewirtschaftung und der Lehrstreit je für sich, die Erweiterung
 * selbst am Schluss. Die Karte nennt eine Wahl mit nur einfachem Mehr weiter
 * abgelehnt; der Lehrstreit nennt die Gesetzesstütze des Kommentars (F5).
 *
 * **Warum ein eigener Schritt und nicht `UMFORMULIERUNGEN`:** `text()` läuft
 * über jedes Feld und gibt je Wortlaut einen Wortlaut zurück; Begründung,
 * Formel und Hilfe tragen nur einen. Einzig die Hinweise sind eine Liste, also
 * gehört das Aufteilen dorthin, neben `mitVerweisen`, und wie dort an der
 * Kennung der Karte. Geschlüsselt ist der Website-Wortlaut, den die
 * Umformulierung davor erzeugt; steht er nicht genau einmal unter den Hinweisen
 * der Karte, bricht der Export ab.
 *
 * **Aus `REST` der Fassung 2026-11-13 geschnitten, nicht abgeschrieben**
 * (bis zur Fassung 2026-11-16 hier, seither in der Fassung, `WAHL_STUECKE`),
 * und die Stücke müssen `REST` lückenlos ergeben, bis auf den Satz «Diese
 * Karte verlangt deshalb das qualifizierte Mehr.», den auf der Website der neue
 * erste Satz trägt. Neu sind nur «verlangt diese Karte für die Wahl», der Satz
 * zum Wortlaut von Art. 647b Abs. 1 und der Halbsatz zu Rz. 112 ad Art. 712a,
 * seit Runde 2 der Prüfung (R1, R2) dazu der Satz zum einfachen Mehr, der zum
 * Vorsitz und der Hinweis zur Offerte; die Karte trägt damit fünf Hinweise.
 *
 * **Seit der Fassung 2026-11-17** schneidet die Fassung die Stücke selbst
 * (`WAHL_STUECKE`) und stellt sie in der Anwendung schon in die Reihenfolge der
 * Website, in einem Hinweis (L10: `hinweisErsatz` tauscht unter «einfach» einen
 * Hinweis gegen genau einen). Die Stütze (Rz. 112), der Vorsitz und die Offerte
 * stehen darin mit Punkt statt Strichpunkt (`check:texte`), Vorsitz und Offerte
 * nach der Laienprüfung der Fassung mit mehr als auf der Website (M3, M4), die
 * Anfechtung mit einem Verweis auf den Lehrstreit (R2-M1). An diesen Stellen
 * und an «Diese Karte folgt …» setzt der Export den geprüften Website-Wortlaut
 * ein.
 */
const {
	was: WAHL_WAS,
	vollmachten: WAHL_VOLLMACHTEN,
	anfechtung: WAHL_ANFECHTUNG,
	nur712s: WAHL_NUR_712S,
	ohne: WAHL_OHNE_BEWIRTSCHAFTUNG,
	kommentar: WAHL_KOMMENTAR
} = WAHL_STUECKE;
// Lückenlos geprüft wird in der Fassung, gegen `REST` der Vorfassung; hängt der Hinweis an `rw`
// nicht mehr an diesen Stücken, greift der Schlüssel der Umformulierung oben nicht und
// `pruefeUmformulierungen` bricht ab.

const AUFTEILUNGEN = new Map([
	[
		'k-bewirtschaftung-waehlen-erweitert',
		{
			// Der Wert der Umformulierung zu `WAHL_HINWEIS_NACH_GESETZ` oben.
			alt: `${WAHL_ERSTER_SATZ_WEBSITE} ${WAHL_REST}`,
			neu: [
				// Was gilt und was Sie tun.
				[
					ersetzeGenau(
						WAHL_WAS,
						'verlangt Art. 647b Abs. 1 ZGB nach seinem Wortlaut auch für die Wahl',
						'verlangt diese Karte für die Wahl'
					),
					ersetzeGenau(
						// Runde 2, R1 (Laien 1): was «nur das einfache Mehr» hier heisst.
						ersetzeGenau(
							WAHL_VOLLMACHTEN,
							'Erreicht die Wahl nur das einfache Mehr, ist der Antrag nach dieser Karte abgelehnt;',
							'Stimmt zwar die Mehrheit der Eigentümer zu, halten die Zustimmenden aber nicht mehr als die ' +
								'Hälfte aller Wertquoten (nur das einfache Mehr), ist der Antrag nach dieser Karte abgelehnt;'
						),
						// Runde 2, R1 (Fach A3), Stelle und Wortlaut nach Runde 3, S1: der Vorsitz, wenn die
						// bisherige Verwaltung leitet, direkt nach den Vollmachten, auch ohne Ankündigung in der
						// Einladung (Runde 4, U1: «der Vorsitzwechsel»). Die Anwendung trägt ihn seit der Fassung
						// 2026-11-17 an derselben Stelle in drei Sätzen (`VORSITZ_WAHL`).
						VORSITZ_WAHL,
						'Leitet die bisherige Verwaltung die ' +
							'Versammlung, lassen Sie für diese Wahl eine Eigentümerin oder einen Eigentümer den Vorsitz ' +
							'übernehmen; das beschliesst die Versammlung mit einfachem Mehr, sofern Ihr Reglement nichts ' +
							// Runde 4, U1: «der Vorsitzwechsel» statt «der Antrag», damit der Bezug klar ist.
							'anderes vorsieht, auch wenn der Vorsitzwechsel nicht in der Einladung stand; sicherer ist, ihn ' +
							'anzukündigen (ZGB Art. 712n Abs. 1; SVIT-Kommentar Rz. 75 und 76a ad Art. 712n).'
					),
					// Der Verweis auf den Lehrstreit weiter unten gilt nur in der Anwendung: Auf der Website
					// steht der Lehrstreit in einem eigenen Punkt (Laienprüfung der Fassung, Runde 2, R2-M1).
					ersetzeGenau(WAHL_ANFECHTUNG, ANFECHTUNG_VERWEIS, '')
				].join(' '),
				// Runde 2, R2 (Laien 3): Befugnisse nur in der Offerte. Der geprüfte Website-Wortlaut; die
				// Anwendung sagt seit der Fassung 2026-11-17 dazu, was «Offerte» heisst und was gilt, wenn
				// die Befugnisse später dazukommen (`WAHL_STUECKE.streichen`, Laienprüfung M3).
				'Stehen die weitergehenden Befugnisse nur in der Offerte und nicht im Reglement, können Sie sie vor der ' +
					'Wahl streichen lassen; dann genügt für die Wahl das einfache Mehr (SVIT-Kommentar Rz. 44 ad Art. 712m).',
				// Wenn die Gemeinschaft ohne Bewirtschaftung ist.
				WAHL_OHNE_BEWIRTSCHAFTUNG,
				// Warum, und die Gegenmeinung (F5: Rz. 112 ad Art. 712a).
				[
					'Die Karte folgt dem Wortlaut von Art. 647b Abs. 1 ZGB, der die Wahl einer solchen Bewirtschaftung ' +
						'ausdrücklich nennt.',
					// Seit der Fassung 2026-11-17 trägt die Anwendung die Stütze als eigenen Satz (`STUETZE_RZ112`).
					ersetzeGenau(
						WAHL_KOMMENTAR,
						`(Rz. 46 ad Art. 712q). ${STUETZE_RZ112}`,
						'(Rz. 46 ad Art. 712q); er hält die Bestimmungen über den Verwalter für massgebend, die kein ' +
							'qualifiziertes Mehr nennen (Rz. 112 ad Art. 712a).'
					),
					WAHL_NUR_712S
				].join(' '),
				// Die Erweiterung selbst, unverändert.
				WAHL_ERSTER_SATZ_WEBSITE
			]
		}
	]
]);

/** Setzt an die Stelle des einen Hinweises die Teile; bricht ab, wenn er nicht genau einmal dasteht. */
function mitAufteilung(id, hinweise) {
	const aufteilung = AUFTEILUNGEN.get(id);
	if (!aufteilung) return hinweise;
	const treffer = hinweise.filter((h) => h === aufteilung.alt).length;
	if (treffer !== 1) {
		throw new Error(
			`Die Aufteilung für «${id}» sucht ihren Hinweis und findet ihn ${treffer}-mal statt einmal. Entweder ist ` +
				'der Text umformuliert worden, dann gehört der Schlüssel nachgezogen, oder die Aufteilung gehört entfernt.'
		);
	}
	return hinweise.flatMap((h) => (h === aufteilung.alt ? aufteilung.neu : [h]));
}

/**
 * Wo eine abweichende Regel eingeführt sein muss, wie man es prüft, was offen
 * ist und wie anficht, wer nicht zugestimmt hat. `zwischen` steht direkt hinter
 * «ist offen, ob sie trotzdem gilt», wo eine Karte dazu einen eigenen Satz hat
 * (Prüfrunde 7, R7-F-6: hinter der Anfechtung zeigte «in diesem Fall» auf sie).
 */
const EINFUEHRUNG = (zwischen = '', nachFrist = '') =>
	'Eine abweichende Regel muss von allen Eigentümern beschlossen worden sein, auch von den ' +
	'abwesenden, oder schon im Begründungsakt stehen, der Urkunde, mit der das Stockwerkeigentum ' +
	'errichtet wurde. Prüfen Sie vor der Versammlung, wie Ihre Regel zustande kam, etwa im ' +
	'Protokoll von damals. Wurde sie mit weniger Stimmen eingeführt, ist offen, ob sie trotzdem gilt. ' +
	(zwischen ? `${zwischen} ` : '') +
	// Prüfrunde 6 (R6-F-3, R6-L-9): «offen» lädt sonst zum Abwarten ein, und die
	// Monatsfrist ist eine Verwirkungsfrist (Rz. 207, 230 ad Art. 712m). Prüfrunde 7
	// (R7-L-1, R7-F-7): Sie läuft ab Kenntnis des Beschlusses, nicht des Mangels.
	'Haben Sie der Einführung nicht zugestimmt und wollen Sie die Regel nicht gelten lassen, fechten Sie ' +
	'den Beschluss an, mit dem sie eingeführt wurde: beim Gericht, in der Regel zuerst mit einem Gesuch ' +
	// Prüfrunde 8: Fristbeginn auch für Vertretene (R8-F-4), «Mangel» nicht als
	// Baumangel lesbar (R8-L-5), Erwerb nach der Einführung (R8-F-3, R8-L-2, Rz. 223b
	// ad Art. 712m), und nach Ablauf bleibt die Geltung offen (R8-F-2).
	'an die Schlichtungsbehörde. Ein Schreiben an die Verwaltung genügt nicht. Die Frist beträgt einen ' +
	'Monat: als Anwesender oder Vertretener ab der Versammlung, als Abwesender ohne Vertretung in der ' +
	'Regel ab Erhalt des Protokolls. Wann Sie bemerken, dass die Regel mit zu wenigen Stimmen eingeführt ' +
	'wurde, zählt nicht. Haben Sie erst nach der Einführung erworben, etwa gekauft oder geerbt, können Sie ' +
	'nur anfechten, wenn Ihre Vorgängerin nicht zugestimmt hat und die Monatsfrist noch eingehalten werden ' +
	'kann; das ist selten möglich. Liegt die Einführung länger zurück, ist die Frist deshalb in der Regel ' +
	`abgelaufen; ob die Regel dann gilt, ist nicht geklärt${nachFrist ? `, ${nachFrist}` : ''} (${LINK_ANFECHTUNG}).`;
/**
 * Der Weg, der nach jeder Lesart trägt, und was zu tun ist, wenn nur ein Mehr
 * erreicht ist.
 *
 * **Zwei Fälle, nicht einer** (Fachprüfung Runde 3, B1): Verfehlt der
 * Beschluss eine wirksam eingeführte strengere Regel, ist der Antrag
 * abgelehnt, wie Votum es sagt; nur bei einer milderen Regel wird nach der
 * Frist ausgeführt. Am Ausweg darf ein Reglement nicht erhöhen, dort steht nur
 * der zweite Fall.
 */
const SICHER = (mitStrengerer) =>
	'Was das Mehr angeht, ist ein Beschluss sicher, der es nach Gesetz und nach Ihrem Reglement ' +
	'erreicht. ' +
	(mitStrengerer
		? 'Verfehlt er eine wirksam eingeführte strengere Regel Ihres Reglements, ist der Antrag ' +
			'abgelehnt; halten Sie im Protokoll fest, ob er das Gesetz erreicht hätte. '
		: '') +
	'Erreicht er nur das mildere Mehr Ihres Reglements, führen Sie ihn, wenn die Sache nicht ' +
	'dringlich ist, erst nach Ablauf der Anfechtungsfrist von einem Monat aus; ' +
	`${FRISTBEGINN}. ` +
	// Prüfrunde 6 (R6-F-4): Hat ein Abwesender das Protokoll der Einführung nie
	// erhalten, läuft deren Frist noch (Rz. 230 ad Art. 712m). Prüfrunde 7 (R7-L-8):
	// ohne «kürzlich», das niemand messen kann.
	// Prüfrunde 8 (R8-F-1, R8-L-1): Die Frist beträgt einen Monat; «eine der letzten
	// Versammlungen» lag meist ein Jahr zurück (Rz. 230, 231 ad Art. 712m).
	// Prüfrunde 9 (R9-F-3, R9-L-4): Wortlaut der Fachprüfung.
	'Läuft die Frist für die Anfechtung der Regel selbst noch, etwa weil sie an derselben Versammlung ' +
	'eingeführt wurde oder ein Abwesender ohne Vertretung das Protokoll der Einführung vor weniger als ' +
	'einem Monat oder nachweislich nie erhalten hat, warten Sie auch diese ab. Lässt sich die Zustellung ' +
	'nicht belegen, stellen Sie das Protokoll rasch und nachweisbar zu, etwa eingeschrieben.';
/** Wo das Gesetz die Zustimmung aller verlangt. */
const ALLE = 'Sicher ist ein Beschluss, dem alle Eigentümer zustimmen, auch die abwesenden.';
/** Erhebliche Einschränkung des Sonderrechts (Rz. 79 ad Art. 712a; BGer 5A_352/2012 E. 4.3.2). */
const SONDERRECHT =
	'Wird jemandem die Nutzung seiner Wohnung erheblich eingeschränkt, braucht es seine Zustimmung, ' +
	'nach dem führenden Kommentar und neuerer Rechtsprechung die aller; sicher ist dann nur ein ' +
	'Beschluss, dem alle Eigentümer zustimmen, auch die abwesenden.';
/**
 * Der häufige Fall alter Reglemente (Fachprüfung A4, R4-F-4).
 *
 * **Seit dem Website-Abzug E4 (11.11.2026) wie die Karte** (Fachprüfung E2,
 * F-7): Bis dahin stand hier «halten Sie sie ein, solange sie nicht aufgehoben
 * ist», als gälte die Regel sicher; ob sie gilt, ist offen (BGE 143 III 537
 * E. 4.2.4 gegen Rz. 130 ad Art. 712a). Vor der Versammlung der sicherere Weg
 * wie die Wahl beim Hinterlegen (`FOLGE_DER_WAHL_UNKLAR`), im Saal das Gesetz
 * mit Einwand im Protokoll und Vollzug nach der Frist wie `einwandImSaal`.
 *
 * Steht als `zwischen` in `EINFUEHRUNG`, direkt hinter «ist offen, ob sie
 * trotzdem gilt»; weiter hinten hörte die Leitung vorher auf zu lesen
 * (Laienprüfung E4, L-4). «Zusätzlich zum Gesetz» (L-5), der Grund für die
 * Saalregel (L-6), ein Vollzugssatz für beide Wege (Fachprüfung E4, F-3), die
 * Ablehnung hebt das Gericht nur auf (F-4; Rz. 234, 235 ad Art. 712m).
 * `ohneEinstimmigkeit`: Die Karte hat oben schon gesagt, dass dort bei einer
 * Regel mit der Zustimmung aller in der Regel das Gesetz gilt; der Aufschub
 * des Vollzugs gilt auch dann, wie in Votum (`einstimmigkeitImSaalSatz` mit
 * `EINWAND_VOLLZUG`; Fachprüfung E4 Runde 2, R2-F-2).
 */
const strengerUnklar = (ohneEinstimmigkeit) =>
	`Ist offen, ob eine strengere Regel gilt${ohneEinstimmigkeit ? ', die nicht die Zustimmung aller verlangt' : ''}, ` +
	'ist es sicherer, sie zusätzlich zum Gesetz einzuhalten. ' +
	'Angenommen ist ein Antrag dann nur, wenn er beides erreicht. Verfehlt er die Regel, wird nichts ' +
	'ausgeführt, was sich später als ungültig erweisen könnte. Wer meint, die Regel gelte nicht, kann ' +
	'die Ablehnung innert eines Monats anfechten; das Gericht hebt sie dann nur auf, angenommen ist der ' +
	'Antrag erst mit einem neuen Beschluss. Entscheiden Sie vor der Versammlung, nach welchem Mehr Sie ' +
	'zählen, sagen Sie es am besten schon in der Einladung an, spätestens vor der Abstimmung, und halten ' +
	'Sie im Protokoll fest, ob der Antrag das Gesetz erreicht hätte. Wird eine solche Regel erst an der ' +
	'Versammlung eingewendet und steht dort nicht fest, dass sie wirksam eingeführt wurde, zählen Sie ' +
	'nach dem Gesetz, denn im Saal lässt sich das meist nicht mehr prüfen. Halten Sie den Einwand im ' +
	'Protokoll fest. Verfehlt ein nach dem Gesetz angenommener Antrag eine solche Regel, ob im Saal ' +
	'eingewendet oder von Ihnen vorher so entschieden, führen Sie ihn, wenn die Sache nicht dringlich ist, ' +
	'erst nach Ablauf der Anfechtungsfrist aus.' +
	(ohneEinstimmigkeit
		? ' Das gilt auch, wenn Sie bei einer Regel, welche die Zustimmung aller verlangt, nach dem Gesetz ' +
			'zählen und nicht alle zugestimmt haben.'
		: '');
/** Wenn ein Reglement dort die Zustimmung aller verlangt, wo es das nicht darf. */
const EINSTIMMIG_GILT_GESETZ = (wer) =>
	`Verlangt Ihr Reglement hier die Zustimmung aller, gilt ${wer} das Gesetz; halten Sie im ` +
	'Protokoll fest, ob auch alle zugestimmt hätten.';

/**
 * **Eigene Kurztexte für die Website** (Produktentscheid 08.10.2026 «Eigene
 * Kurztexte», nach der Laien- und Fachprüfung des Abzugs vom 07.10.2026 und
 * einer zweiten Runde über diese Texte am 08.10.2026). Die Rechtssätze der
 * Fassung sind für die Sitzungsleitung in Votum geschrieben, mit acht bis
 * zwölf Randziffern je Karte; Website-Leserinnen hörten dort auf zu lesen.
 * Hier je Karte die Rechtslage in Klartext, der Weg, der nach jeder Lesart
 * trägt, und die Fundstellen am Schluss.
 *
 * **Jeder Eintrag ist an seinen Rechtssatz gebunden** (Codeprüfung
 * 08.10.2026, M4): `zu` ist die Prüfsumme des Rechtssatzes, gegen den der
 * Kurztext geschrieben und geprüft wurde. Ändert eine neue Fassung den
 * Rechtssatz, bricht der Export ab, bis jemand den Kurztext ansieht und die
 * Prüfsumme nachzieht. Ein Knoten mit Rechtssatz ohne Eintrag bricht ebenso
 * ab, und ein Eintrag ohne Knoten mit Rechtssatz auch.
 */
const REGLEMENT_WEBSITE = new Map([
	[
		// Fassung 2026-10-22: Der Satz stand bis dahin als Sonderfall unten in
		// `reglementshinweis` (geprüft 08.10.2026) und gilt unverändert weiter.
		'k-zirkularbeschluss',
		{
			zu: '9119e07799fb',
			text:
				'Ob ein Reglement eine schriftliche Abstimmung mit Mehrheit (Urabstimmung) vorsehen ' +
				'darf, ist umstritten: Die herrschende Lehre lässt es unter Vorbehalt zu, der führende ' +
				'Kommentar lehnt es ab, das Bundesgericht hat die Frage offengelassen. Sicher ist ein ' +
				'schriftlicher Beschluss, dem alle Eigentümer zustimmen, auch die abwesenden. ' +
				'(Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 131, 135)'
		}
	],
	[
		// Fassung 2026-10-22: Der Rechtssatz kommt ohne Werkzeugbezug aus, ist aber
		// für die Sitzungsleitung geschrieben. Für Eigentümer: der Notar zu
		// «öffentlich beurkundet», «Mehrheitsbeschluss» statt «Beschluss» (ein
		// einstimmiger, beurkundeter Beschluss genügt, Rz. 58 ad 712g), das
		// Nutzungsrecht mit Verweis auf die eigenen Karten (Laien- und Fachprüfung
		// des Abzugs 20.10.2026). Die zwingend gemeinschaftlichen Teile nennt der
		// Hinweis derselben Karte; im Kasten standen sie doppelt (Codeprüfung).
		'k-sonderrecht-abgrenzen',
		{
			zu: 'ac3d3d3932ce',
			text:
				'Ob ein Teil gemeinschaftlich ist oder zum Sonderrecht gehört, ändert nur ein Vertrag aller ' +
				'Eigentümer, öffentlich beurkundet, in der Regel beim Notar (Art. 648 Abs. 2, 712e Abs. 1 ' +
				'ZGB; SVIT-Kommentar 2023, Art. 712b Rz. 12, 12a). Ein Mehrheitsbeschluss genügt nicht, ' +
				'auch nicht nach einer Regel in Reglement oder Begründungsakt (SVIT-Kommentar, Art. 712g ' +
				'Rz. 56, 58). Ein alleiniges Nutzungsrecht oder ein Umbau ändert das Eigentum nicht; ' +
				'dafür gelten eigene Karten.'
		}
	],
	[
		// Einsprache nach Art. 712c Abs. 2, Fassung 2026-10-20: derselbe Satz wie der
		// Rechtssatz, der ohne Werkzeugbezug auskommt (Laien- und Fachprüfung Runden 1
		// und 2, 19.10.2026).
		// Lesart L3 seit Lesarten Block 8 (Produktentscheid 22.10.2026): beide
		// Seiten und der sichere Weg, ohne die Umstellung, die es nur in Votum gibt.
		'k-einsprache',
		{
			zu: 'a48635080213',
			text:
				'Ein strengeres Mehr gilt nur, wenn es mit dem Einspracherecht oder später von allen ' +
				'Eigentümern schriftlich vereinbart wurde. Ein milderes gilt nie (Wermelinger, ' +
				'SVIT-Kommentar 2023, Art. 712c Rz. 183, 186; Art. 712g Rz. 83). Zählt Ihr Reglement ' +
				'die Stimmen je Wohnung oder Einheit, ist nicht geklärt, ob das auch für die Einsprache ' +
				'gilt. Diese Karte geht vom Gesetz aus: Jeder Eigentümer hat eine Stimme, gleich wie ' +
				'viele Einheiten er hat (Art. 712m Rz. 181). Für die Zählung je Einheit lässt sich ' +
				'anführen, dass der Kommentar zur Einsprache auf die allgemeinen Regeln verweist ' +
				'(Art. 712c Rz. 185; Art. 712m Rz. 186). Sicher ist die Einsprache, wenn sie nach ' +
				'beiden Zählungen beschlossen ist. Reicht es nur nach einer, halten Sie beide Ergebnisse im ' +
				'Protokoll fest und überbringen die Einsprache trotzdem innert der 14 Tage; sonst ist sie ' +
				'nach keiner Zählung mehr möglich.'
		}
	],
	[
		// Ä-12, Fassung 2026-10-19 (Laien- und Fachprüfung, Runde 5 und 6).
		'k-reglement-andere-ordnung',
		{
			zu: '111959c6e2ad',
			text:
				'Die Zustimmung aller verlangt hier das Gesetz. Eine Bestimmung, die weniger verlangt, ' +
				'gilt nur, wenn alle Eigentümer ihr zugestimmt haben. Sicher ist ein Beschluss, dem ' +
				'alle Eigentümer zustimmen, auch die abwesenden. (Art. 648 Abs. 2 ZGB; Wermelinger, ' +
				'SVIT-Kommentar 2023, Art. 712g Rz. 38, 40b)'
		}
	],
	[
		'k-baulich-notwendig',
		{
			// Fassung 2026-10-30 (A4, Punkt 3): Der Rechtssatz der Karte nennt seither,
			// wie anficht, wer bei der Einführung nicht zugestimmt hat. Der Kurztext
			// bleibt bewusst ohne diesen Satz, hier wie an `k-baulich-nuetzlich`,
			// `k-benutzungsweise` und `k-baulich-luxurioes-ausweg` (Prüfschritt A4,
			// Prüfrunde 6); Prüfsumme nachgezogen.
			zu: '89650297d845',
			text:
				'Ihr Reglement darf das Mehr strenger fassen, nach herrschender Lehre aber nicht bis zur ' +
				'Zustimmung aller. Ob es das Mehr erleichtern darf, ist umstritten. Jeder Eigentümer kann ' +
				'notwendige Arbeiten weiter beim Gericht verlangen und solche, die keinen Aufschub dulden, ' +
				`selbst veranlassen. ${EINSTIMMIG_GILT_GESETZ('nach herrschender Lehre')} ${EINFUEHRUNG()} ` +
				`${SICHER(true)} (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 36; Art. 712a Rz. 125; ` +
				'Art. 712m Rz. 223b, 230)'
		}
	],
	[
		'k-baulich-nuetzlich',
		{
			zu: '68575833a003',
			text:
				'Ihr Reglement darf das Mehr strenger fassen und nach dem führenden Kommentar bis zum ' +
				'einfachen Mehr erleichtern, was andere bestreiten. Wem die Massnahme die Nutzung ' +
				'erheblich und dauernd erschwert, der muss in jedem Fall zustimmen. Sind jemandem die ' +
				'Kosten nicht zuzumuten, geht es ohne seine Zustimmung nur, wenn die anderen den Teil ' +
				'übernehmen, der ihm nicht zuzumuten ist. ' +
				`${EINSTIMMIG_GILT_GESETZ('nach dem führenden Kommentar')} ` +
				`${EINFUEHRUNG('Für diese Massnahme wendet der führende Kommentar dann das Gesetz an.', 'nach dem führenden Kommentar gilt dann das Gesetz, das Bundesgericht hat eine ähnlich eingeführte Regel dagegen gelten lassen')} ${SICHER(true)} (Wermelinger, ` +
				'SVIT-Kommentar 2023, Art. 712g Rz. 37, 53; Art. 712a Rz. 129, 130; Art. 712m Rz. 223b, 230)'
		}
	],
	[
		'k-benutzungsweise',
		{
			zu: '560166fcfd2d',
			text:
				'Ihr Reglement darf das Mehr strenger oder milder fassen, solange es nicht missbräuchlich ' +
				'ist. Für jede Änderung die Zustimmung aller zu verlangen, hält der führende Kommentar in ' +
				`der Regel für missbräuchlich. ${EINSTIMMIG_GILT_GESETZ('in der Regel')} Für die ` +
				'Zweckbestimmung, also wozu das Haus dient, gilt nicht diese Karte, sondern ihre eigene. ' +
				`${EINFUEHRUNG()} ${SICHER(true)} ${SONDERRECHT} (Wermelinger, SVIT-Kommentar 2023, ` +
				'Art. 712g Rz. 35; Art. 712m Rz. 196, 223b, 230; Art. 712a Rz. 79; BGer 5A_352/2012 E. 4.3.2)'
		}
	],
	[
		'k-verwaltung-wichtig',
		{
			// Prüfsumme nachgezogen mit der Fassung 2026-11-14 (Block C, R5-F-1 und
			// R5-F-2 am Rechtssatz der Anwendung): Der Kurztext bleibt, denn die Website
			// zeigt die Vorgabe, die Köpfe unter den Anwesenden und Vertretenen. Die
			// Prüfung des Abzugs vor dem Ausliefern steht aus (Auftrag Website Regel 43).
			// Nachgezogen mit der Fassung 2026-11-15 (Beleg ohne Rz. 84 am Rechtssatz der
			// Anwendung); der Kurztext nennt Rz. 84 nicht und bleibt.
			zu: '9b5b6094ade4',
			text:
				'Nach dem führenden Kommentar darf Ihr Reglement das Mehr strenger oder milder fassen, solange ' +
				'es nicht missbräuchlich ist; andere bestreiten das. Für jede solche Handlung die Zustimmung aller zu verlangen, hält der führende ' +
				`Kommentar in der Regel für missbräuchlich. ${EINSTIMMIG_GILT_GESETZ('in der Regel')} Für ` +
				'notwendige bauliche Massnahmen gilt nicht diese Karte, sondern ihre eigene. ' +
				// Fundstellen ergänzt nach der Fachprüfung E4 (F-5).
				`${EINFUEHRUNG(strengerUnklar(true))} ${SICHER(true)} (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 35, 78, ` +
				'78a; Art. 712a Rz. 130, dort zu nützlichen baulichen Massnahmen; Art. 712m Rz. 196, 223b, 230, ' +
				'234, 235; Art. 712n Rz. 99, 100; BGE 143 III 537 E. 4.2.4, dort zur Berechnungsweise; ' +
				'Handschin/Wyttenbach, S. 73)'
		}
	],
	[
		'k-zweckbestimmung',
		{
			zu: 'd87dc6892a8f',
			text:
				'Ihr Reglement darf hier ein anderes Mehr vorsehen, aber nur, wenn alle Eigentümer dieser ' +
				'Regel zugestimmt haben, in der Regel mit ihrer Unterschrift; ein Versammlungsprotokoll ' +
				'genügt meist nicht. Oder sie steht schon im Begründungsakt, der Urkunde, mit der das ' +
				'Stockwerkeigentum errichtet wurde. Ob eine mit weniger Stimmen eingeführte Regel trotzdem ' +
				`gilt, ist offen. ${ALLE} ${SONDERRECHT.replace(/; sicher ist dann .*$/, '.')} ` +
				'(ZGB Art. 648 Abs. 2; Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 8a; Art. 712a ' +
				'Rz. 79; BGer 5A_352/2012 E. 4.3.2)'
		}
	],
	[
		'k-baulich-luxurioes-ausweg',
		{
			zu: 'e431c5af586d',
			text:
				'Erhöhen darf Ihr Reglement dieses Mehr nach dem führenden Kommentar nicht. Ob es das Mehr ' +
				'senken darf, ist umstritten. Die drei Bedingungen weiter unten gelten in jedem Fall. ' +
				`${EINFUEHRUNG()} ${SICHER(false)} (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 54; ` +
				'Art. 712a Rz. 136; Art. 712m Rz. 223b, 230)'
		}
	],
	[
		'k-baulich-luxurioes',
		{
			zu: 'e4111085c53c',
			text:
				'Strenger als die Zustimmung aller geht nicht. Ob Ihr Reglement weniger verlangen darf, ist ' +
				'umstritten. Nach dem führenden Kommentar darf es höchstens bis zu dem erleichtern, was der ' +
				'Weg mit Kostenübernahme durch die übrigen verlangt, samt dessen drei Bedingungen; dieser ' +
				'Weg hat im Finder eine eigene Karte. Eine solche Regel müsste zudem von allen Eigentümern ' +
				'beschlossen worden sein oder im Begründungsakt stehen, der Urkunde, mit der das ' +
				`Stockwerkeigentum errichtet wurde. ${ALLE} (Wermelinger, SVIT-Kommentar 2023, Art. 712a ` +
				'Rz. 136)'
		}
	],
	[
		'k-grundstueck-verkauf',
		{
			zu: 'b35b84b020cb',
			text:
				'Alle Eigentümer können gemeinsam eine andere Regel für Verkauf und Belastung vereinbaren, ' +
				'nicht aber für die Aufhebung des Stockwerkeigentums. Der führende Kommentar lässt das auch ' +
				'im Stockwerkeigentum zu; ob eine solche Regel spätere Käufer bindet, ist umstritten. Klären ' +
				`Sie das vor der Versammlung mit einer Fachperson. ${ALLE} (ZGB Art. 648 Abs. 2; ` +
				'Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 18)'
		}
	],
	[
		'k-bewirtschaftung-abberufen',
		{
			zu: '07919ee9add6',
			text:
				'Es zählt das einfache Mehr, auch wenn Ihr Reglement etwas anderes sagt: Ein Reglement ' +
				'darf die Abberufung weder erschweren noch erleichtern. So sehen es der führende Kommentar ' +
				'und die herrschende Lehre; eine Einzelmeinung widerspricht. Verlangt Ihr Reglement mehr, ' +
				'halten Sie im Protokoll fest, ob auch das erreicht wäre. (Wermelinger, SVIT-Kommentar ' +
				'2023, Art. 712g Rz. 64)'
		}
	],
	[
		'k-wertquoten-aendern',
		{
			zu: '6275ca87c098',
			text:
				'Wer unmittelbar betroffen ist, muss einzeln zustimmen: jede Eigentümerin, deren Quote sich ' +
				'ändert, und in der Regel auch die Bank, die ein Pfandrecht an ihrer Wohnung hat. Ohne ' +
				'diese Zustimmungen kann die Änderung nicht im Grundbuch eingetragen werden und gilt nicht; ' +
				'kein Reglement ändert daran etwas. Wer übergangen wurde, ficht den Beschluss ' +
				'vorsichtshalber trotzdem innert eines Monats an, denn ob ein Gericht ihn als ungültig ' +
				`oder nur als anfechtbar ansieht, weiss man vorher nicht; ${FRISTBEGINN}. Sicher ist, ` +
				'wenn alle Betroffenen schriftlich zustimmen und die Versammlung die Änderung mit dem Mehr ' +
				'nach Gesetz und nach Ihrem Reglement genehmigt. (Wermelinger, SVIT-Kommentar 2023, ' +
				'Art. 712e Rz. 75 ff., 88 f.; Art. 712m Rz. 212 f., 230)'
		}
	],
	[
		// Fassung 2026-10-30 (A4, Punkt 1): Die Karte trägt erstmals einen
		// Rechtssatz, weil eine Regel nur noch fallgenau greift. Fachprüfung A4,
		// F-1: die Erweiterung selbst braucht nur das qualifizierte Mehr.
		'k-bewirtschaftung-erweitert',
		{
			// Prüfsumme nachgezogen mit der Fassung 2026-11-14 (Block C, R5-F-1 und
			// R5-F-2 am Rechtssatz der Anwendung): Der Kurztext bleibt, denn die Website
			// zeigt die Vorgabe, die Köpfe unter den Anwesenden und Vertretenen. Die
			// Prüfung des Abzugs vor dem Ausliefern steht aus (Auftrag Website Regel 43).
			// Nachgezogen mit der Fassung 2026-11-15 (Beleg ohne Rz. 84, Fachprüfung E2,
			// F-12); der Kurztext verliert dieselbe Randziffer.
			zu: 'b6b6229fb73d',
			text:
				// F3, L6 (Meldung vom 15.11.2026): «der anwesenden und vertretenen Eigentümer» widersprach dem
				// Kasten derselben Karte, der nur die Hälfte aller sicher nennt; jetzt mit Verweis auf ihn.
				'Für die erweiterten Kompetenzen genügt das qualifizierte Mehr: mehr als die Hälfte der ' +
				`Eigentümer, die zusammen mehr als die Hälfte aller Wertquoten halten. ${VERWEIS_ZAEHLWEISE} ` +
				// Prüfrunde 6 (R6-L-1, R6-L-2): der Grund wie an der Karte, und ausgeführt
				// wird nur ein angenommener Antrag.
				'Eine Regel für die Organe oder für Wahlen sagt, wie gewählt wird, nicht, welche Befugnisse ein ' +
				'Organ erhält; für diese Erweiterung gilt sie im Zweifel nicht. Dann zählt dieses Mehr, und Sie ' +
				'brauchen nicht nachzuforschen, wie die Regel eingeführt wurde. ' +
				// Codeprüfung Prüfschritt A4, Durchgang 2, N1: dieselbe Ansage wie die Anwendung.
				// Prüfrunde 9 (R9-L-5): Zeitpunkt, Grund und Protokoll wie in der Anwendung.
				'Wurde bei Ihnen bisher auch hier nach dieser Regel gezählt, oder wissen Sie es nicht, sagen Sie an, ' +
				'dass diesmal nach dem Gesetz gezählt wird, weil die Regel diese Erweiterung nicht klar nennt: schon in ' +
				'der Einladung, spätestens vor der Abstimmung, und halten Sie es im Protokoll fest. Wendet jemand die Regel im Saal ' +
				// Prüfrunde 7 (R7-L-5): Erreicht er auch die Regel, ist er sicher.
				'ein, halten Sie den Einwand im Protokoll fest. Wird der Antrag angenommen und erreicht er die Regel ' +
				'nicht, führen Sie den Beschluss, wenn die Sache nicht dringlich ist, erst nach Ablauf der ' +
				'Anfechtungsfrist aus. Das Folgende gilt nur für ' +
				// Website-Abzug E4: der Satz zur strengeren Regel unklarer Herkunft hinter
				// «ist offen, ob sie trotzdem gilt» (L-4), deshalb der Streit davor.
				'eine Regel, die diese Erweiterung eigens nennt oder klar mitmeint. Ob sich das Mehr überhaupt ' +
				`ändern lässt, ist umstritten. ${EINFUEHRUNG(strengerUnklar(false))} ${SICHER(true)} ` +
				// Fassung 2026-11-15 (Fachprüfung E2, F-12): ohne Rz. 84, die die Erleichterung nach Art. 712g
				// Abs. 3 betrifft.
				'(Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 35, 76, 78, 78a, 91; Art. 712a Rz. 130, dort zu ' +
				'nützlichen baulichen Massnahmen; Art. 712m Rz. 190, 191, 194, 223b, 230, 234, 235; Art. 712n Rz. 99, ' +
				'100; Art. 712q Rz. 46; BGE 143 III 537 E. 4.2.4, dort zur Berechnungsweise; BGer 5A_865/2011 E. 3.2; ' +
				'Handschin/Wyttenbach, S. 73)'
		}
	]
]);

/** Die Prüfsumme eines Rechtssatzes, an die ein Kurztext gebunden ist. */
function pruefsumme(text) {
	return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

// Ein Eintrag ohne Knoten mit Rechtssatz bliebe still ungenutzt.
for (const id of REGLEMENT_WEBSITE.keys()) {
	if (!rw.knoten.some((k) => k.id === id && k.reglementsrecht)) {
		throw new Error(`REGLEMENT_WEBSITE nennt «${id}», die Fassung hat dort keinen Rechtssatz.`);
	}
}

/**
 * Die strengere Beschlussfähigkeit (Fassung 2026-10-30, A4, Punkt 2): Sperre nach der Lehre, ohne Rechtssatz.
 * Ohne Rechtssatz hängt der Text an Begründung und Hinweisen der Karte (`BESCHLUSSFAEHIGKEIT_ZU`).
 */
const BESCHLUSSFAEHIGKEIT_ZU = 'c81e63304535';
const BESCHLUSSFAEHIGKEIT_WEBSITE =
	// Prüfrunde 6 (R6-L-11): Begründung und «Gut zu wissen» stehen auf derselben
	// Karte; der Hinweis sagt nur, was gilt und was zu tun ist, mit den vier
	// Aussagen, die nach der Fachprüfung bleiben müssen.
	'Diese Karte sagt, was es braucht, um eine solche Klausel einzuführen, nicht, wie die Versammlung danach ' +
	'beschliesst. Einführen lässt sie sich nach der Lehre nur, wenn alle Eigentümer zustimmen, auch die ' +
	'abwesenden, oder wenn sie im Begründungsakt steht; unter die Schwelle des Gesetzes geht es nie. Die zweite ' +
	'Versammlung darf nicht strenger sein als die erste, und eine Klausel, die sie nicht nennt, gilt im Zweifel ' +
	// Website-Abzug E4 (Fachprüfung E4, Antwort auf F4): dieselbe Klasse wie F-7
	// aus E2, «halten Sie sie ein, solange sie nicht aufgehoben ist» trat als
	// gesichert auf; die Karte sagt selbst «nicht geklärt».
	// Runde 2 (R2-L-5, R2-F-4): was gilt, wer nicht einhält; E. 4.2.4 mit Einschränkung.
	// Runde 3 (R3-F-1): Eine gültig eingeführte Klausel gilt (Rz. 9 ad Art. 712p);
	// die Wahl besteht nur bei unklarer Herkunft (Rz. 31, 33).
	'nur für die erste. Steht schon eine Klausel in Ihrem Reglement, der alle zugestimmt haben oder die im ' +
	'Begründungsakt steht, gilt sie. Wurde sie mit weniger Stimmen eingeführt oder lässt sich das nicht ' +
	'feststellen, ist es sicherer, sie einzuhalten. Tagen Sie dann trotzdem nach dem Gesetz, führen Sie die ' +
	'Beschlüsse, wenn die Sache nicht dringlich ist, erst nach Ablauf der Anfechtungsfrist aus. Blockiert die Klausel ' +
	'auch die zweite Versammlung, holen Sie Rat ein. Wollen Sie eine neue, nennen Sie die zweite Versammlung ausdrücklich: tiefer ' +
	'als an der ersten, nie unter dem gesetzlichen Drittel. Einzelheiten unter «Gut zu wissen». (ZGB Art. 712p; ' +
	'Wermelinger, SVIT-Kommentar 2023, Art. 712p Rz. 8, 9, 31, 33, 42, 43; Art. 712g Rz. 90; BGer 5A_865/2011 E. 4.2, ' +
	'5.2 und 6; BGE 143 III 537 E. 4.2.4, dort zur Berechnungsweise; Handschin/Wyttenbach, S. 76)';

/**
 * Der Reglements-Hinweis je Knoten — die Website kennt das Reglement des
 * Lesers nicht, sagt aber, was seines dürfte (Auftrag vom 15.08.2026).
 */
function reglementshinweis(knoten) {
	/*
	 * **Ab Fassung 2026-10-15 der Rechtssatz des Knotens, wo er einen hat**
	 * (Codeprüfung 07.10.2026, H1). Der Ausweg der luxuriösen Massnahme trägt
	 * `nur_mildern`, steht aber auf Art. 647e Abs. 2; der Satz zu Rz. 84 ad
	 * Art. 712g passt dort nicht, und der Export brach ab. An den Karten mit
	 * vereinbarter Ordnung sagte die Website weiter «dürfen Sie nach ihr
	 * auszählen», auch für eine Klausel, die dort nach dem Kommentar nicht
	 * zulässig ist.
	 *
	 * **Seit dem 08.10.2026 der Kurztext aus `REGLEMENT_WEBSITE`, nicht der
	 * Rechtssatz selbst** (Laien- und Fachprüfung des Abzugs 07.10.2026;
	 * Produktentscheid «Eigene Kurztexte»). Der Rechtssatz mit Einleitung und
	 * dem Schlusssatz «lassen Sie die Geltung klären» war für Website-Leser zu
	 * dicht, die Einleitung liess «aller» weg, und an der Abberufung schickte
	 * der Schlusssatz zur Klärung, wo nichts zu klären ist.
	 *
	 * **Ein neuer Abzug ist ein Aussentext** und braucht vor dem Ausliefern
	 * auf die Website die Laienprüfung für Website-Leser.
	 */
	if (knoten.reglementsrecht) {
		const kurz = REGLEMENT_WEBSITE.get(knoten.id);
		if (!kurz) {
			throw new Error(
				`${knoten.id} trägt einen Rechtssatz, aber keinen Kurztext für die Website ` +
					'(REGLEMENT_WEBSITE). Der Rechtssatz ist für die Sitzungsleitung geschrieben.'
			);
		}
		const summe = pruefsumme(knoten.reglementsrecht);
		if (kurz.zu !== summe) {
			throw new Error(
				`Der Rechtssatz von ${knoten.id} hat sich geändert (Prüfsumme ${summe}, der Kurztext ` +
					`ist gegen ${kurz.zu} geschrieben). Kurztext in REGLEMENT_WEBSITE prüfen, mit Laien- ` +
					'und Fachprüfung, dann die Prüfsumme nachziehen.'
			);
		}
		return kurz.text;
	}
	switch (knoten.reglementsverhalten) {
		case 'frei':
			return (
				'Ihr Reglement oder der Begründungsakt kann ein anderes Quorum vorsehen, das ' +
				'gesetzliche gilt nur, wenn dort nichts anderes steht. Prüfen Sie zuerst Ihr Reglement.'
			);
		// **`einordnen` sagt der Leserin dasselbe** (27.09.2026). Das Verhalten
		// ändert, was die Anwendung mit einer hinterlegten Regel tut, nicht die
		// Rechtslage; und die Website wendet nichts an. Der Satz bleibt wortgleich.
		case 'einordnen':
		case 'nur_mildern':
			// Derselbe Befund wie in `entscheidbaum.ts` (F-07/F-08): Der Kasten
			// behauptete an einer Streitfrage Geklärtes, und die Milderung stand
			// ohne ihre Bedingung da. Rz. 84 ad Art. 712g verlangt für die
			// Erleichterung selbst einen einstimmigen Beschluss.
			// **Und hier steht die Bedingung im Kasten, anders als in der
			// Anwendung** (Gegenprüfung 23.09.2026, G-1). Der Abzug trägt nur die
			// aktuelle Fassung, und dort ist `k-reglement-normal` der einzige
			// Knoten mit diesem Verhalten; die Randziffer passt also. Ein Satz
			// darüber, was das Werkzeug mit einer hinterlegten Regel tut, gehört
			// dagegen nicht hierher: Die Website kennt das Reglement der Leserin
			// nicht und wendet nichts an.
			//
			// **Die Annahme «einziger Knoten» brach mit der Fassung 2026-10-07**
			// (Codeprüfung 28.09.2026, H-1): Seither trägt auch
			// `k-ausschlussklage` `einordnen`, und deren Rechtsgrundlage ist
			// Art. 649b Abs. 2, nicht Art. 712g. Sie bekommt ihren eigenen Satz,
			// und jeder weitere Knoten ohne Art. 712g bricht den Export ab,
			// statt still die falsche Randziffer zu tragen.
			if (knoten.id === 'k-ausschlussklage') return AUSSCHLUSSKLAGE_REGLEMENT_KASTEN;
			if (!knoten.rechtsgrundlage.includes('Art. 712g')) {
				throw new Error(
					`${knoten.id} trägt ${knoten.reglementsverhalten}, steht aber nicht auf Art. 712g ` +
						`(«${knoten.rechtsgrundlage}»). Der Satz zu Rz. 84 ad Art. 712g passt dort ` +
						'nicht; der Knoten braucht einen eigenen Reglementshinweis.'
				);
			}
			return (
				'Ihr Reglement kann dieses Quorum mildern; ob eine solche Milderung gilt, ist ' +
				'aber umstritten: Der SVIT-Kommentar bejaht sie und verlangt für die Milderung ' +
				'selbst die Einstimmigkeit (Art. 712g Rz. 84), Rey/Maetzke halten eine Milderung ' +
				'des gesetzlichen Mehrs für unzulässig (Rz. 40). Ob es sich auch verschärfen ' +
				'lässt, ist ebenfalls umstritten; prüfen Sie, was bei Ihnen steht, und lassen Sie ' +
				'die Geltung vor der Versammlung klären.'
			);
		case 'gesperrt_zwingend':
			/*
			 * **Am Zirkularbeschluss nicht «zwingendes Recht»** (Fachprüfung der
			 * Kurztexte, Runde 3, B4). Seit Fassung 2026-10-22 trägt der Knoten
			 * einen Rechtssatz, und sein Kurztext steht oben in `REGLEMENT_WEBSITE`;
			 * dieser Zweig erreicht ihn nicht mehr.
			 */
			// Ä-12 (Fassung 2026-10-19): gesperrt nach der strengeren Lesart, nicht
			// als zwingendes Recht; der Kommentar sagt «möglicherweise» (Rz. 126).
			// Erkannt am Merkmal wie in der Anwendung (`sperreNachLehre`); ein
			// zweiter solcher Knoten bräche hier ab, statt still «zwingendes Recht»
			// zu zeigen (zweite Codeprüfung 3e).
			if (knoten.rang === 'lehre' && !knoten.reglementsrecht) {
				// Ab Fassung 2026-10-27: Entscheiden statt der Versammlung (C1, C2a);
				// der Satz steht in der Fassung und ist mit den Karten geprüft.
				// Laienprüfung Block 8, L8-11: so stark wie der Weg der Einstimmigkeit.
				if (STATT_VERSAMMLUNG.has(knoten.id)) {
					return ersetzeGenau(
						WEBSITE_REGLEMENT_STATT,
						'Die blosse nachträgliche Zustimmung der Abwesenden ist nicht gesichert.',
						'Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach (unter «Wenn eine ' +
							'Zustimmung fehlt»).'
					);
				}
				if (knoten.id === 'k-reglement-beschlussfaehigkeit') {
					// Gebunden wie die Kurztexte: Ändern sich Begründung oder Hinweise der
					// Karte, bricht der Export ab (Codeprüfung Prüfschritt A4, N5).
					const summe = pruefsumme(JSON.stringify([knoten.begruendung, knoten.hinweise]));
					if (summe !== BESCHLUSSFAEHIGKEIT_ZU) {
						throw new Error(
							`Begründung oder Hinweise von ${knoten.id} haben sich geändert (Prüfsumme ${summe}, der ` +
								`Website-Text ist gegen ${BESCHLUSSFAEHIGKEIT_ZU} geschrieben). Text prüfen, mit Laien- und ` +
								'Fachprüfung, dann die Prüfsumme nachziehen.'
						);
					}
					return BESCHLUSSFAEHIGKEIT_WEBSITE;
				}
				if (knoten.id !== 'k-reglement-sonderinhalt') {
					throw new Error(`Export: Für «${knoten.id}» fehlt der Satz zur Sperre nach der strengeren Lesart.`);
				}
				return (
					'Ob ein Reglement für solche Inhalte ein anderes Mehr vorsehen darf, ist nicht ' +
					'geklärt; der führende Kommentar empfiehlt die Zustimmung aller. Beim Mehr sicher ist ' +
					'ein Beschluss, dem alle Eigentümer zustimmen, auch die abwesenden. (Wermelinger, ' +
					'SVIT-Kommentar 2023, Art. 712g Rz. 126)'
				);
			}
			return (
				'Dieses Quorum ist zwingendes Recht. Eine abweichende Bestimmung im Reglement oder ' +
				'Begründungsakt wäre unbeachtlich.'
			);
		// Ab Fassung 2026-10-15 (Produktentscheid 07.10.2026): Dieselbe
		// Rechtslage; dass Votum die Regel jetzt anwendet, betrifft die Website
		// nicht, die nichts auszählt.
		case 'vereinbart':
		case 'gesperrt_vereinbarung':
			// **F-03: der Kasten endete ohne Handlung** (Fachprüfung und
			// Laienprüfung, 23.09.2026). Der milde Kasten, den er ersetzt hat,
			// schloss mit «Prüfen Sie zuerst Ihr Reglement»; der neue schloss mit
			// einer Verneinung. Die Überschrift lautet «Und Ihr Reglement?», die
			// Antwort sinngemäss «zählt wahrscheinlich nicht», und was zu tun
			// wäre, stand nirgends. Dazu war «Begründungsakt» das Wort, das die
			// Laienprüfung nicht verstand, und es war die einzige Tür.
			return (
				'Das Gesetz lässt eine andere Ordnung zu, aber nur, wenn sie einstimmig beschlossen ' +
				'oder im Begründungsakt vereinbart wurde; eine gewöhnliche Reglementsänderung genügt ' +
				'nicht. Sehen Sie deshalb nicht nur im Reglement nach, sondern auch im ' +
				'Begründungsakt, also in der Urkunde, mit der das Stockwerkeigentum errichtet wurde. ' +
				'Kam Ihre Klausel dort oder durch einen einstimmigen Beschluss zustande, dürfen Sie ' +
				'nach ihr auszählen; klären Sie das vor der Versammlung, nicht im Saal.'
			);
		case 'nur_verschaerfen':
			// Ab Fassung 2026-10-20 (Einsprache). Der Satz hängt am Rechtsgrund des
			// Knotens, und dafür gibt es den Kurztext oben; ohne Rechtssatz bricht
			// der Export ab, statt einen allgemeinen Satz an die falsche Norm zu hängen.
			throw new Error(
				`${knoten.id} trägt nur_verschaerfen, aber keinen Rechtssatz. Der Knoten braucht einen ` +
					'Rechtssatz und einen Kurztext in REGLEMENT_WEBSITE.'
			);
		case 'gesperrt_reglement':
			return (
				'Ob eine solche Klausel überhaupt gilt, ist umstritten. Klären Sie das vor der ' +
				'Versammlung, nicht im Saal.'
			);
		default:
			// Grenzfall und Kenntnisnahme: Der Vorbehalt hängt an der offenen
			// Einordnung beziehungsweise es gibt nichts zu beschliessen.
			return null;
	}
}

/**
 * **Was die Website unter den Weg der Einstimmigkeit setzt** (Lesarten Block 8,
 * aus der Prüfung der nachträglichen Zustimmung vom 22.10.2026). Die Anwendung
 * hält einen Beschluss ohne alle Zustimmungen als nicht zustande gekommen fest;
 * die Leserin der Website kann aber vor einer Verwaltung stehen, die ihn mit
 * Unterschriften danach für angenommen erklärt. Ohne Anfechtung gilt er dann
 * eher (Fachprüfung N-4; BGE 143 III 537 E. 4.2.4).
 *
 * **Wer bei einer Wohnung mit mehreren Berechtigten unterschreibt, sagt seit
 * der Fassung 2026-10-30 der Weg der Karte selbst** (Rz. 22 ad Art. 712o,
 * `WEG_MEHRERE` in `quorum-2026-10-30.ts`). Die Website nimmt den Satz dort
 * heraus und stellt ihn wie bisher als eigenen Absatz dahinter (Laienprüfung
 * L8-10; Codeprüfung Prüfschritt A4, N6).
 */
const WEG_ANFECHTUNG =
	'<strong>Wenn Sie nicht zugestimmt haben</strong> und der Beschluss trotzdem als angenommen ' +
	'festgehalten wird: Fechten Sie ihn vorsichtshalber beim Gericht an, in der Regel zuerst mit einem ' +
	'Gesuch an die Schlichtungsbehörde, innert eines Monats, nachdem Sie davon erfahren haben. Ein ' +
	'Schreiben an die Verwaltung genügt nicht. Ob der Beschluss auch ohne Anfechtung unwirksam ist, hängt ' +
	'vom Einzelfall ab; in einem Fall, in dem die nötige Einstimmigkeit fehlte, hat das Bundesgericht ihn ' +
	'als anfechtbar, nicht nichtig behandelt (ZGB Art. 75 i.V.m. Art. 712m Abs. 2; BGE 143 III 537 ' +
	'E. 4.2.1 und 4.2.4; SVIT-Kommentar Rz. 211, 213, 223 und 233a ad Art. 712m). ' +
	LINK_ANFECHTUNG;

/** Der Weg der Einstimmigkeit für die Website, mit dem Zusatz oben. */
function einstimmigkeitswegWebsite(k) {
	if (!k.einstimmigkeitsweg) return null;
	// Drei Absätze (Laienprüfung L8-10): was gilt und wie, wer unterschreibt,
	// was tut, wer nicht zugestimmt hat. `ersetzeGenau` bricht ab, wenn der
	// Satz nicht genau einmal im Weg steht.
	return [ersetzeGenau(text(k.einstimmigkeitsweg), ` ${text(WEG_MEHRERE)}`, ''), text(WEG_MEHRERE), WEG_ANFECHTUNG].join('<br><br>');
}

const abzug = {
	fassung: rw.fassung,
	quelle: 'versammlung/src/lib/rules/quorum-' + rw.fassung + '.ts',
	erzeugtDurch: 'versammlung/scripts/quorumsbaum-export.mjs',
	juristischGegengelesen: rw.juristischGegengelesen,
	/*
	 * **Die allgemeine Erklärung ist die zu Art. 647d** (F9, L3, H-2; Nacharbeit
	 * 15.11.2026). Die Website liest sie nur als Rückfall für Karten ohne eigene
	 * (`callback-api/server.js` Z. 1409), und das ist allein noch
	 * `k-baulich-nuetzlich`. Eine eigene Erklärung an der Karte schaltete dort
	 * `zaehlweiseOffen` ein (Z. 1414: Abweichung und eigene Erklärung) und damit
	 * das Zahlenbeispiel «sicher nach jeder Zählweise», wo das Bundesgericht
	 * entschieden hat. `KARTEN_647D` oben hält fest, dass keine andere Karte auf
	 * diesen Rückfall fällt.
	 */
	wortlautErklaerung: text(WORTLAUT_647D_WEBSITE),
	gemischteGeschaefte: text(rw.gemischteGeschaefte),
	ergebnistypen: rw.ergebnistypen.map((t) => ({
		typ: t.typ,
		kurz: t.kurz,
		bezeichnung: t.bezeichnung,
		formel: text(t.formel),
		stimmwirkung: text(t.stimmwirkungen.art === 'festgelegt' ? t.stimmwirkungen.wirkung : t.stimmwirkungen.satz)
	})),
	aeste: rw.aeste.map((a) => ({
		id: a.id,
		titel: text(a.titel),
		beschreibung: text(a.beschreibung),
		einstieg: a.einstieg
	})),
	fragen: rw.fragen.map((f) => ({
		id: f.id,
		text: text(f.text),
		hilfe: text(f.hilfe),
		// Lange Hilfen teilt der Kern an einer Satzgrenze (`teileHilfe`, 26.09.2026);
		// die Website zeigt den Rest unter «Mehr dazu». Geteilt wird der Quelltext,
		// damit keine Hervorhebung zerschnitten wird; `hilfe` bleibt für ältere
		// Abbilder der callback-api vollständig.
		...geteilteHilfe(f),
		antworten: f.antworten.map((a) => ({ id: a.id, text: text(a.text), ziel: a.ziel, hilfe: websiteHilfe(a) }))
	})),
	knoten: rw.knoten.map((k) => ({
		id: k.id,
		titel: text(k.titel),
		typ: k.typ,
		// Knoteneigene Formel (B-2): Wo die Kopfbasis von der Typformel
		// abweicht, zeigt die Karte diese statt der Typformel. An den Karten mit
		// einfachem oder qualifiziertem Mehr und 4b die Formel ohne «anwesenden und vertretenen» (F2).
		formel: FORMEL_KOEPFE_KARTEN.has(k.id)
			? formelKoepfeOffen()
			: FORMEL_EINFACH_KARTEN.has(k.id)
				? FORMEL_KOEPFE_EINFACH
				: text(k.formel),
		streitfrage: streitfrageRichtung(k.id) !== null,
		// «streng» oder «mild» (Lesarten Block 8); das Signet der Website richtet
		// sich danach. Ohne Streitfrage `null`.
		streitfrageRichtung: streitfrageRichtung(k.id),
		// Kennung der Lesart der Gemeinschaft, die diese Karte trägt; die Website
		// zeigt sie nicht, der Abzugswächter prüft daran.
		lesart: LESARTKARTEN.get(k.id) ?? null,
		// Auch hier ohne Gedankenstrich: Artikelangaben enthalten keinen, nur der
		// Prosa-Fall der Kenntnisnahme («keine, es wird nicht abgestimmt»).
		rechtsgrundlage: text(k.rechtsgrundlage),
		zustimmungBetroffenerNoetig: k.zustimmungBetroffenerNoetig,
		betroffeneErlaeuterung: text(k.betroffeneErlaeuterung),
		begruendung: text(k.begruendung),
		// Was gilt, wenn an der Versammlung eine Zustimmung fehlt (ab Fassung
		// 2026-10-29, nur Einstimmigkeit). Die Website zeigt das Feld seit
		// Lesarten Block 8 unter der Wirkung des Typs.
		einstimmigkeitsweg: einstimmigkeitswegWebsite(k),
		beispiele: (k.beispiele ?? []).map(text),
		hinweise: mitVerweisen(k.id, mitAufteilung(k.id, (k.hinweise ?? []).filter((h) => !NUR_ANWENDUNG.has(h)).map(text))),
		empfehlung: text(k.empfehlung),
		wortlautAbweichung: k.wortlautAbweichung === true,
		/*
		 * «Wortlaut und Rechtsprechung» je Karte (Fassung 2026-11-14, Endfassung
		 * Block C, Abschnitt 4): an Art. 647a Abs. 2, 647b Abs. 1, 647c und 647e
		 * Abs. 2 die Fassung 4b, wie Votum unter der Vorgabe; die Website kennt
		 * keine Einstellung. Ab der Fassung 2026-11-15 ohne «so rechnet Votum» am
		 * Satz zu den Enthaltungen (`ENTHALTUNG_SATZ_WEBSITE`): Die Website nennt
		 * Votum nicht. Seit den Befunden vom 15.11.2026 mit den Sätzen der Website
		 * zum sicheren Weg und zum Bundesgericht (`wortlautErklaerungWebsite`).
		 * Art. 647d trägt keine eigene; dort gilt die allgemeine des Abzugs
		 * (`WORTLAUT_647D_WEBSITE`, Grund oben am Feld).
		 */
		wortlautErklaerung: artikel4b(k) ? text(wortlautErklaerungWebsite(artikel4b(k))) : null,
		reglementshinweis: reglementshinweis(k)
	}))
};

pruefeUmformulierungen();

/*
 * **Kein Gedankenstrich im Abzug** (Website-Abzug E4, 11.11.2026). `text()`
 * entfernt «—» aus dem Wortlaut der Fassung, nicht aus dem Ersatz in
 * `UMFORMULIERUNGEN` und nicht aus den Kurztexten; mit E1 ging so erstmals ein
 * Strich in den erzeugten Abzug, und kein Lauf merkte es. Gesucht wird der
 * Geviertstrich und der Halbgeviertstrich mit Leerzeichen; der Bis-Strich ohne
 * Leerzeichen («Rz. 78–80») ist erlaubt, wie in `_tools/content-check.py` der
 * Website (Codeprüfung E4, G1).
 */
const KEIN_GEDANKENSTRICH = /—| – /;
const mitStrich = JSON.stringify(abzug).match(new RegExp(`.{0,60}${KEIN_GEDANKENSTRICH.source}.{0,30}`));
if (mitStrich) throw new Error(`Gedankenstrich im Website-Abzug: «${mitStrich[0]}»`);

process.stdout.write(JSON.stringify(abzug, null, '\t') + '\n');
