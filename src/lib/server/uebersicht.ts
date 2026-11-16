/**
 * Übersicht und Vorbereitungsstand (Stories 6.1 und 6.2, FR-64, FR-65).
 *
 * Die Schale zu `$lib/domain/uebersicht` und `$lib/domain/vorbereitung`: Sie
 * erhebt die Befunde, die Kerne formulieren sie.
 *
 * **Warum wenige, breite Abfragen.** Die Übersicht ist die erste Seite nach dem
 * Anmelden und wird häufiger geöffnet als jede andere. Eine Abfrage je
 * Versammlung — Traktanden, Zugänge, Erfordernisse — ergäbe bei zwanzig
 * Versammlungen achtzig Abfragen für eine Seite, die nur einen Überblick zeigt.
 * Deshalb hängen die Zählungen als Unterabfragen an derselben Zeile.
 */
import { offenePunkte, type OffenerPunkt } from '$lib/domain/uebersicht';
import { holeBetreiber } from './betreiber';
import {
	vorbereitungsfortschritt,
	vorbereitungsschritte,
	type Schritt,
	type Vorbereitungslage
} from '$lib/domain/vorbereitung';
// Umbenannt: `abgeschlossen` ist in dieser Datei schon ein Feldname.
import { abgeschlossen as istAbgeschlossen } from '$lib/domain/versammlung';
import type { Abendhaus } from '$lib/domain/register';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { datumLang, kalendertag } from '$lib/domain/datum';
import { alsBetreiber } from './db';
import type { Versammlungszustand } from '$lib/domain/versammlung';
import type { Id } from '$lib/domain/types';
import type { Sicht } from '$lib/domain/archivieren';
import { AUSFALLUNTERLAGEN, brauchtAuszaehlmappe } from './ausfallsicherung';

/** Eine Versammlung, wie sie auf der Übersicht steht. */
export interface Uebersichtszeile {
	id: Id;
	datum: string;
	uhrzeit: string;
	ort: string;
	zustand: Versammlungszustand;
	gemeinschaft: string;
	stwegId: Id;
	/** Anteil der erledigten unter den möglichen Vorbereitungsschritten. */
	fortschritt: number;
	/** Was als Nächstes ansteht — der erste offene Schritt. */
	naechsterSchritt: string | null;
	/**
	 * Der gemeinsame Abend, falls die Zeile für ihn steht — sonst `null`.
	 *
	 * **Eine Kachel je Abend, nicht je Haus** (Auftraggeber, 25.08.2026, mit Bild von
	 * der Startseite: «wenn die Gruppe die Sitzung führt, sollten nicht die
	 * anderen Sitzungen darunter angezeigt werden»). Beim Nirgendwerk standen
	 * unter «Jetzt im Saal» die MEG Umgebung **und** Nirgendweg 5/5a
	 * nebeneinander, mit demselben Datum, derselben Zeit, demselben Ort — als
	 * wären zwei Sitzungen gleichzeitig zu führen. Geführt wird eine: der Abend.
	 * Die Kopfzeile sagte das schon richtig, die Kacheln nicht.
	 */
	abend: { id: Id; bezeichnung: string; haeuser: number } | null;
}

export interface Uebersicht {
	laufend: Uebersichtszeile[];
	anstehend: Uebersichtszeile[];
	/** Geschlossene der letzten Zeit — der Weg zur Auswertung. */
	/**
	 * Freigegeben, Termin verstrichen, nicht eröffnet (22.08.2026, Befund C-05).
	 *
	 * Fiel bis dahin durch alle Raster: nicht «läuft gerade», nicht «anstehend».
	 */
	ueberfaellig: Uebersichtszeile[];
	abgeschlossen: Uebersichtszeile[];
	punkte: OffenerPunkt[];
	/** Ob überhaupt schon etwas erfasst ist; sonst zeigt die Seite den Einstieg. */
	leer: boolean;
}

/** Die Rohzeile aus der Datenbank, aus der sich beide Kerne bedienen. */
interface Rohzeile {
	id: string;
	meeting_date: string;
	start_time: string;
	location: string;
	state: Versammlungszustand;
	stweg_id: string;
	stweg_name: string;
	/** Die Stelle am gemeinsamen Abend. Null, wenn die Versammlung für sich steht. */
	day_position: number | null;
	/** Der Abend selbst — seit Story 7.5b entscheidet er, wo das Protokoll steht. */
	meeting_day_id: string | null;
	/** Wie der Abend heisst — für die eine Kachel, die ihn auf der Startseite vertritt. */
	meeting_day_label: string | null;
	quota_denominator: number;
	einheiten: number;
	quotensumme: number;
	eigentuemer: number;
	einheiten_ohne_eigentuemer: number;
	einheiten_erst_spaeter: number;
	bylaw_reviewed_on: Date | null;
	reglementsregeln: number;
	anwesenheitsregeln: number;
	traktanden: number;
	traktanden_aus_vorlage: number;
	agenda_confirmed_at: Date | null;
	ohne_erfordernis: number;
	zugaenge: number;
	stimmberechtigte: number;
	versiegelt: boolean;
	protokollnotizen: number;
	protokoll_entwurf: boolean;
	protokollfassungen: number;
	vollmachten_offen: number;
	vollmachten_wirksam: number;
	beschluesse: number;
	einladung_erzeugt: boolean;
	versand_vermerkt: boolean;
	/** Die Einberufungsfrist der Gemeinschaft in Tagen (Migration 098). */
	invitation_lead_days: number | null;
	/** Die Namen der geholten Unterlagen — nicht ihre Anzahl. */
	ausfallunterlagen: string[];
	auswertung_erzeugt: boolean;
	zeitstempel: string | null;
}

/**
 * Alle Versammlungen mit den Zahlen, die Übersicht und Ablauf brauchen.
 *
 * Die Unterabfragen zählen bewusst auf `meeting_id` statt über Verbünde: Ein
 * Verbund über vier Nebentabellen vervielfachte die Zeilen, und die Zahlen wären
 * die Produkte statt der Summen — ein Fehler, der erst bei mehreren Traktanden
 * *und* mehreren Zugängen sichtbar wird und dann wie ein Zufall aussieht.
 *
 * Der Filter grenzt auf eine Versammlung oder auf einen Abend ein — beides über
 * **dieselbe** Abfrage, weil beides dieselben Zählungen braucht: Der
 * Vorbereitungsstand eines Hauses ist derselbe, ob man ihn für eine Versammlung
 * oder für die Reiterleiste eines Abends erhebt. Eine zweite, schlankere Abfrage
 * daneben wäre eine zweite Wahrheit und liefe beim ersten neuen Schritt
 * auseinander.
 */
/*
 * **Der Einladungsschritt hängt an einem eigenen Ereignis** (23.08.2026,
 * Prüflauf I, B-14). Vorher fragte er 'agenda.pdf.created' ab — das keine
 * Stelle schrieb; in der Datenbank stand dazu keine einzige Zeile, obwohl die
 * Traktandenliste hunderte Male abgerufen worden war. Der Schritt konnte nie
 * erledigt werden.
 *
 * Die Begründung steht hier und nicht in der Abfrage: Ein Bezeichner in
 * Gegenzeichen beendet das Template und bricht sie. Viertes Mal am selben
 * Muster.
 */
/**
 * **Das Archiv ist hier keine Wahl, sondern eine Regel** (25.08.2026, aus dem
 * Code-Review). Wer nach einer bestimmten Versammlung oder nach einem Abend
 * fragt, bekommt sie immer — eine archivierte Versammlung soll ihre eigene
 * Seite und ihren Abend behalten. Nur die ungefilterte Abfrage, aus der die
 * Startseite ihre Listen baut, laesst Archiviertes weg — und zwar samt der
 * Gruppenregel (`stweg_archiv_wegen`, Migration 087).
 *
 * Die Abfrage einer **einzelnen** Versammlung (`meetingId`) und die eines
 * Abends (`tagId`) liefern dagegen immer alle: Dort wird nachgeschlagen, nicht
 * ausgewählt — und eine archivierte Versammlung, die an einem Abend hängt,
 * gehört in dessen Liste, sonst fehlt sie im Protokoll.
 *
 * Ein `sicht`-Merkmal stand hier bis zum 25.08.2026, setzte es aber kein
 * Aufrufer: Der Zweig war tot, und die Vorgabe trug die ganze Wirkung.
 */
async function holeRohzeilen(
	operatorId: Id,
	filter?: { meetingId?: Id; tagId?: Id }
): Promise<Rohzeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		return tx<Rohzeile[]>`
			SELECT
				m.id,
				to_char(m.meeting_date, 'YYYY-MM-DD') AS meeting_date,
				to_char(m.start_time, 'HH24:MI')      AS start_time,
				m.location,
				m.state,
				s.id   AS stweg_id,
				s.name AS stweg_name,
				m.day_position,
				m.meeting_day_id,
				d.label AS meeting_day_label,
				s.quota_denominator,

				(SELECT count(*)::int FROM unit u WHERE u.stweg_id = s.id) AS einheiten,
				(SELECT coalesce(sum(uq.value), 0)::int
				   FROM unit u
				   JOIN unit_quota uq ON uq.unit_id = u.id
				   JOIN quota_kind qk ON qk.id = uq.quota_kind_id AND qk.key = 'stamm'
				  WHERE u.stweg_id = s.id) AS quotensumme,
				(SELECT count(*)::int FROM party p WHERE p.stweg_id = s.id) AS eigentuemer,
				(SELECT count(*)::int
				   FROM unit u
				  WHERE u.stweg_id = s.id
				    AND NOT EXISTS (
				        SELECT 1 FROM unit_ownership o
				         WHERE o.unit_id = u.id
				           AND o.valid_from <= m.meeting_date
				           AND (o.valid_to IS NULL OR o.valid_to > m.meeting_date)
				    )) AS einheiten_ohne_eigentuemer,
				/*
				 * **Wie viele davon erst später einen Eigentümer bekommen.**
				 *
				 * Die Zahl darüber allein sagt «da fehlt etwas» und lässt offen,
				 * was. Im Prüfdurchgang vom 05.09.2026 waren alle fünf Einheiten
				 * korrekt erfasst — nur begann die Zuordnung am Tag der Erfassung,
				 * und die Versammlung lag davor. Der Prüfer las «5 Einheiten ohne
				 * Eigentümer», hielt seine Arbeit für verloren und machte sie ein
				 * zweites Mal: fünfmal tilgen, fünfmal neu zuordnen, sechs Minuten
				 * für nichts.
				 */
				(SELECT count(*)::int
				   FROM unit u
				  WHERE u.stweg_id = s.id
				    AND NOT EXISTS (
				        SELECT 1 FROM unit_ownership o
				         WHERE o.unit_id = u.id
				           AND o.valid_from <= m.meeting_date
				           AND (o.valid_to IS NULL OR o.valid_to > m.meeting_date)
				    )
				    AND EXISTS (
				        SELECT 1 FROM unit_ownership o
				         WHERE o.unit_id = u.id
				           AND o.valid_from > m.meeting_date
				    )) AS einheiten_erst_spaeter,

				s.bylaw_reviewed_on,
				s.invitation_lead_days,
				(SELECT count(*)::int FROM bylaw_quorum_rule b WHERE b.stweg_id = s.id)
					AS reglementsregeln,
				(SELECT count(*)::int FROM bylaw_attendance_rule b WHERE b.stweg_id = s.id)
					AS anwesenheitsregeln,

				(SELECT count(*)::int FROM agenda_item a WHERE a.meeting_id = m.id) AS traktanden,
				(SELECT count(*)::int FROM agenda_item a
				  WHERE a.meeting_id = m.id AND a.from_template) AS traktanden_aus_vorlage,
				m.agenda_confirmed_at,
				(SELECT count(*)::int
				   FROM agenda_item a
				  WHERE a.meeting_id = m.id
				    AND a.item_kind = 'abstimmung'
				    AND (a.requirement_type IS NULL OR a.requirement_type = 'grenzfall')) AS ohne_erfordernis,

				(SELECT count(*)::int FROM meeting_access k
				  WHERE k.meeting_id = m.id AND k.state = 'gueltig') AS zugaenge,
				(SELECT count(*)::int FROM snapshot_party sp WHERE sp.meeting_id = m.id) AS stimmberechtigte,
				(SELECT count(*)::int FROM proxy x
				  WHERE x.meeting_id = m.id AND x.state = 'erfasst') AS vollmachten_offen,
				(SELECT count(*)::int FROM proxy x
				  WHERE x.meeting_id = m.id AND x.state = 'bestaetigt') AS vollmachten_wirksam,
				(SELECT count(*)::int FROM agenda_item a
				  WHERE a.meeting_id = m.id AND length(btrim(coalesce(a.minute_text, ''))) > 0)
					AS protokollnotizen,
				EXISTS (SELECT 1 FROM minutes p WHERE p.meeting_id = m.id) AS protokoll_entwurf,
				EXISTS (SELECT 1 FROM seal x WHERE x.meeting_id = m.id) AS versiegelt,
				(SELECT x.timestamp_state FROM seal x WHERE x.meeting_id = m.id) AS zeitstempel,
				(SELECT count(*)::int FROM minutes_version p WHERE p.meeting_id = m.id)
					AS protokollfassungen,
				(SELECT count(*)::int FROM voting_round r
				  WHERE r.meeting_id = m.id AND r.closed_at IS NOT NULL AND r.superseded_at IS NULL)
					AS beschluesse,

				-- Die Einladung, nicht die Traktandenliste (23.08.2026, B-14), und nur
				-- seit der letzten Rücknahme der Freigabe: Danach ist die Einladung
				-- eine neue (Produktentscheid 06.10.2026, «Seit Rücknahme zählen»;
				-- Migration 147, dieselbe Bedingung wie in der Erinnerung).
				vermerkt_seit_ruecknahme(m.id, ${EREIGNISARTEN.einladungErzeugt}) AS einladung_erzeugt,
				-- Der Vermerk von Hand: «ist hinaus, nur nicht über die Anwendung»
				-- (Migration 102). Eine Spalte, kein Ereignis — er ist umkehrbar.
				(m.invitation_sent_marked_at IS NOT NULL) AS versand_vermerkt,
				EXISTS (SELECT 1 FROM audit_entry e
				         WHERE e.subject_type = 'meeting' AND e.subject_id = m.id::text
				           AND e.event_type = ${EREIGNISARTEN.auswertungErzeugt}) AS auswertung_erzeugt,

				-- WELCHE Unterlagen der Ausfallsicherung geholt wurden, nicht wie
				-- viele: Zwei gleiche Zahlen können verschiedene Mengen sein, und
				-- dann deckt eine weggefallene Unterlage eine nie geholte
				-- (02.09.2026, aus dem Code-Review). DISTINCT, weil ein zweiter
				-- Abruf derselben Datei keinen zweiten Schritt bedeutet.
				(SELECT coalesce(array_agg(DISTINCT e.detail->>'unterlage'), '{}')
				   FROM audit_entry e
				   WHERE e.subject_type = 'meeting' AND e.subject_id = m.id::text
				     AND e.event_type = ${EREIGNISARTEN.ausfallunterlageGeholt}) AS ausfallunterlagen

			FROM meeting m
			JOIN stweg s ON s.id = m.stweg_id
			LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
			WHERE ${
				filter?.meetingId
					? tx`m.id = ${filter.meetingId}`
					: filter?.tagId
						? tx`m.meeting_day_id = ${filter.tagId}`
					: tx`m.archived_at IS NULL AND stweg_archiv_wegen(m.stweg_id) IS NULL`
			}
			-- Mit created_at als letztem Schlüssel: Mehrere Versammlungen am selben
			-- Tag und zur selben Zeit kommen sonst in beliebiger Reihenfolge, und
			-- «die letzten fünf abgeschlossenen» wären mal diese und mal jene.
			-- (Kein Gegenzeichen im Kommentar: Er steht in einer Vorlagenzeichenkette,
			--  und ein Rückwärtsakzent beendete sie mitten im SQL.)
			ORDER BY m.meeting_date DESC, m.start_time DESC, m.created_at DESC
		`;
	});
}

/**
 * @param mappeNoetig Ob diese Versammlung eine Auszählmappe braucht — sonst
 *   gibt es nur zwei Ausfallunterlagen (Prüflauf II, C-02). Die Entscheidung
 *   fällt in `server/ausfallsicherung.ts`; hier wird sie nur weitergereicht.
 */
function lage(
	z: Rohzeile,
	mappeNoetig: boolean,
	briefkopfHinterlegt: boolean
): Vorbereitungslage {
	return {
		briefkopfHinterlegt,
		meetingId: z.id,
		stwegId: z.stweg_id,
		versammlungszustand: z.state,
		// Der Stichtag, auf den die Zuordnungen geprüft werden — er reist mit in
		// den Weg zur Eigentümerseite (Befund B-01).
		datum: z.meeting_date,
		// Eine Ebene ohne eigenen Nenner ist eine blosse Klammer; sie kann nicht
		// «nicht aufgehen».
		quotenGehenAuf: z.quota_denominator === 0 || z.quotensumme === z.quota_denominator,
		anzahlEinheiten: z.einheiten,
		anzahlEigentuemer: z.eigentuemer,
		einheitenOhneEigentuemer: z.einheiten_ohne_eigentuemer,
		einheitenErstSpaeter: z.einheiten_erst_spaeter,
		// Der Kalendertag, wie er in der Datenbank steht. Die Begründung, die hier
		// stand («`toISOString()` gäbe ihr eine Zone»), war verkehrt herum —
		// nachgemessen am 02.09.2026, siehe `versammlungen.ts`.
		reglementGeprueftAm: z.bylaw_reviewed_on ? kalendertag(z.bylaw_reviewed_on) : null,
		anzahlReglementsregeln: z.reglementsregeln,
		anzahlAnwesenheitsregeln: z.anwesenheitsregeln,
		anzahlTraktanden: z.traktanden,
		traktandenAusVorlage: z.traktanden_aus_vorlage,
		traktandenlisteBestaetigt: z.agenda_confirmed_at !== null,
		traktandenOhneErfordernis: z.ohne_erfordernis,
		einladungErzeugt: z.einladung_erzeugt,
		versandVermerkt: z.versand_vermerkt,
		einberufungsfristTage: z.invitation_lead_days ?? null,
		// Der heutige Kalendertag in hiesiger Zeit. Er gehört in die Schale: Der
		// Kern rechnet mit ihm, holt ihn aber nicht (AD-1).
		heute: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }),
		ausfallunterlagenGeholt: z.ausfallunterlagen ?? [],
		/*
		 * Traktandenliste, Unterschriftenliste und Stimmzettel immer; die
		 * Auszählmappe nur, wo es etwas zu rechnen gibt. Die Liste steht **nicht**
		 * als Konstante da, sondern folgt `AUSFALLUNTERLAGEN` — sonst wäre die
		 * Aufnahme einer weiteren Unterlage an zwei Stellen zu machen, und die
		 * zweite fiele beim ersten Mal aus (02.09.2026: genau so fehlte die
		 * Unterschriftenliste in der Zählung).
		 */
		ausfallunterlagenNoetig: mappeNoetig
			? [...AUSFALLUNTERLAGEN]
			: AUSFALLUNTERLAGEN.filter((u) => u !== 'auszaehlung'),
		anzahlZugaenge: z.zugaenge,
		anzahlStimmberechtigte: z.stimmberechtigte,
		versiegelt: z.versiegelt,
		protokollnotizen: z.protokollnotizen,
		protokollEntwurf: z.protokoll_entwurf,
		protokollfassungen: z.protokollfassungen,
		// Gehört die Versammlung zu einem Abend, wird das Protokoll dort geführt
		// (Auftraggeber, 12.08.2026: «Nicht pro Haus»).
		gemeinsamerTagId: z.meeting_day_id,
		vollmachtenOffen: z.vollmachten_offen,
		vollmachtenWirksam: z.vollmachten_wirksam,
		beschluesseGefasst: z.beschluesse > 0
	};
}

/*
 * `briefkopfHinterlegt` wird durchgereicht statt vermutet (Nachprüfung
 * 23.08.2026): Vorher stand hier fest `false`, und der Einladungsschritt
 * behauptete auf jeder Übersicht «kein Briefkopf hinterlegt» — sichtbar wurde
 * das noch nirgends, weil kein Leser die Beschreibung zeigt. Eine falsche
 * Behauptung, die auf ihren ersten Leser wartet, ist ein Fehler mit Datum.
 */
function zeile(z: Rohzeile, mappeNoetig: boolean, briefkopf: boolean): Uebersichtszeile {
	const schritte = vorbereitungsschritte(lage(z, mappeNoetig, briefkopf));
	const offen = schritte.find((s) => s.zustand === 'offen');
	return {
		id: z.id,
		datum: z.meeting_date,
		uhrzeit: z.start_time,
		ort: z.location,
		zustand: z.state,
		gemeinschaft: z.stweg_name,
		stwegId: z.stweg_id,
		fortschritt: vorbereitungsfortschritt(schritte).anteil,
		naechsterSchritt: offen?.titel ?? null,
		abend: null
	};
}

/**
 * Fasst die Versammlungen eines gemeinsamen Abends zu einer Zeile zusammen.
 *
 * **Der Abend ist so weit, wie sein am wenigsten weites Haus.** Deshalb der
 * kleinste Fortschritt und der nächste Schritt genau dieses Hauses — eine
 * gemittelte Zahl verspräche einen Stand, den kein Haus hat, und «alles
 * vorbereitet» wäre gelogen, solange eines noch nichts hat.
 *
 * Versammlungen ohne Abend bleiben unangetastet und stehen einzeln.
 */
function abendeZusammenfassen(
	roh: Rohzeile[],
	mach: (z: Rohzeile) => Uebersichtszeile
): Uebersichtszeile[] {
	const raus: Uebersichtszeile[] = [];
	const gesehen = new Set<string>();

	for (const z of roh) {
		if (!z.meeting_day_id) {
			raus.push(mach(z));
			continue;
		}
		if (gesehen.has(z.meeting_day_id)) continue;
		gesehen.add(z.meeting_day_id);

		// Alle Häuser **dieses Fachs**, nicht des ganzen Abends: Steht ein Haus
		// noch im Entwurf, während die anderen laufen, gehört es unter
		// «anstehend» und nicht in die Kachel, die ins Saalgeschehen führt.
		const geschwister = roh.filter((x) => x.meeting_day_id === z.meeting_day_id);
		const zeilen = geschwister.map(mach);
		const schwaechste = zeilen.reduce((a, b) => (b.fortschritt < a.fortschritt ? b : a));

		raus.push({
			...zeilen[0],
			gemeinschaft: z.meeting_day_label ?? zeilen[0].gemeinschaft,
			fortschritt: schwaechste.fortschritt,
			naechsterSchritt: schwaechste.naechsterSchritt,
			/*
			 * **Auch der Zustand vom schwächsten Haus** (25.08.2026, vierte
			 * Reviewrunde). Das Fach «anstehend» mischt Entwurf und Freigegebenes;
			 * aus `zeilen[0]` genommen trüge die Kachel die Marke «freigegeben»
			 * und daneben 20 Prozent und «Traktanden erfassen» — Marke und Balken
			 * widersprächen einander auf derselben Kachel.
			 */
			zustand: schwaechste.zustand,
			abend: {
				id: z.meeting_day_id,
				bezeichnung: z.meeting_day_label ?? '',
				haeuser: geschwister.length
			}
		});
	}
	return raus;
}

export async function holeUebersicht(operatorId: Id, heute: string): Promise<Uebersicht> {
	const zeilen = await holeRohzeilen(operatorId);
	// Eine Abfrage je Betreiber, nicht je Zeile — der Briefkopf hängt am
	// Betreiber, nicht an der Versammlung.
	const briefkopfHinterlegt = Boolean((await holeBetreiber(operatorId))?.briefkopfPruefsumme);

	const laufend = zeilen.filter((z) => z.state === 'laufend');
	// Anstehend ist, was noch nicht gelaufen ist — nach Datum aufsteigend, weil
	// die nächste Versammlung oben stehen soll und nicht die fernste.
	const anstehend = zeilen
		.filter((z) => (z.state === 'entwurf' || z.state === 'freigegeben') && z.meeting_date >= heute)
		.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
	/*
	 * **Überfällig: freigegeben, Datum verstrichen, noch nicht eröffnet**
	 * (22.08.2026, Befund C-05).
	 *
	 * Im Prüflauf war die Versammlung am Abend ihres Datums nirgends auf der
	 * Startseite — nicht unter «läuft gerade» (sie war noch nicht eröffnet) und
	 * nicht unter «anstehend» (dort steht nur, was in der Zukunft liegt). Sie fiel
	 * durch beide Raster, obwohl sie das Dringendste war, was es an diesem Tag zu
	 * tun gab.
	 *
	 * Eine eigene Reihe statt einer Aufweichung von «anstehend»: Eine Versammlung,
	 * deren Termin verstrichen ist, ohne dass sie eröffnet wurde, ist kein
	 * gewöhnlicher Vorbereitungsstand — entweder sie wird jetzt geführt, oder sie
	 * ist ausgefallen und jemand muss das festhalten.
	 */
	const ueberfaellig = zeilen
		.filter((z) => z.state === 'freigegeben' && z.meeting_date < heute)
		.sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));

	/*
	 * **Erst gruppieren, dann kürzen** (25.08.2026, vierte Reviewrunde). Auf den
	 * Rohzeilen gekürzt frisst ein Abend mit fünf Häusern alle fünf Plätze und
	 * wird danach zu **einer** Zeile — die Seite verspricht «die letzten fünf
	 * abgeschlossenen» und zeigt eine. Das Kürzen steht deshalb unten, nach
	 * `abendeZusammenfassen`.
	 */
	const abgeschlossen = zeilen.filter(
		(z) => z.state === 'geschlossen' || z.state === 'versiegelt'
	);

	// Vergangene Entwürfe stehen nicht unter «anstehend», wären aber sonst
	// unsichtbar. Sie erscheinen als offener Punkt, wenn dort etwas fehlt.
	const gemeinschaften = new Map<string, Rohzeile>();
	for (const z of zeilen) if (!gemeinschaften.has(z.stweg_id)) gemeinschaften.set(z.stweg_id, z);

	/*
	 * **Der Saldo gilt für alle Gemeinschaften, nicht nur für die mit
	 * Versammlung** (23.08.2026, Prüflauf II, A-24).
	 *
	 * Die Liste oben entsteht aus Versammlungszeilen; eine Gemeinschaft, an der
	 * noch keine hängt, kam darin gar nicht vor. Im Prüflauf fehlten Haus A fünf
	 * Anteile, und die Startseite erwähnte es mit keinem Wort — dabei ist genau
	 * das der Zeitpunkt, an dem es sich noch leicht beheben lässt: vor der ersten
	 * Versammlung.
	 *
	 * Eigene Abfrage statt Erweiterung der grossen: Die dort ist auf Versammlungen
	 * gebaut, und eine Gemeinschaft ohne Versammlung hätte in jeder ihrer Spalten
	 * nichts zu suchen.
	 */
	const saldozeilen = await alsBetreiber(operatorId, (tx) =>
		tx<{ stweg_id: string; stweg_name: string; abweichung: number }[]>`
			SELECT s.id AS stweg_id, s.name AS stweg_name,
			       (s.quota_denominator - coalesce(q.summe, 0))::int AS abweichung
			  FROM stweg s
			  LEFT JOIN LATERAL (
				SELECT sum(uq.value)::int AS summe
				  FROM unit u
				  JOIN unit_quota uq ON uq.unit_id = u.id
				  JOIN quota_kind qk ON qk.id = uq.quota_kind_id AND qk.key = 'stamm'
				 WHERE u.stweg_id = s.id
			  ) q ON true
			 WHERE s.quota_denominator > 0
			   AND coalesce(q.summe, 0) <> s.quota_denominator
			   AND EXISTS (SELECT 1 FROM unit u WHERE u.stweg_id = s.id)
			 ORDER BY s.name
		`
	);

	const punkte = offenePunkte({
		quotensaldo: saldozeilen.map((z) => ({
			stwegId: z.stweg_id,
			name: z.stweg_name,
			abweichung: z.abweichung
		})),
		ohneZugaenge: zeilen
			.filter((z) => z.state === 'freigegeben' && z.zugaenge === 0)
			.map((z) => ({ meetingId: z.id, bezeichnung: bezeichnung(z) })),
		ohneErfordernis: zeilen
			.filter((z) => z.ohne_erfordernis > 0 && z.state !== 'geschlossen' && z.state !== 'versiegelt')
			.map((z) => ({ meetingId: z.id, bezeichnung: bezeichnung(z), anzahl: z.ohne_erfordernis })),
		ohneAuswertung: zeilen
			// Auch versiegelt (04.09.2026): `auswertung_erzeugt` hängt am Abruf der
			// PDF, nicht am Siegel. Wer schliesst und sofort versiegelt, also dem
			// folgt, was die Protokollseite empfiehlt, verlöre den offenen Punkt.
			.filter((z) => istAbgeschlossen(z.state) && !z.auswertung_erzeugt)
			.map((z) => ({ meetingId: z.id, bezeichnung: bezeichnung(z) })),
		zeitstempelOffen: zeilen
			.filter((z) => z.state === 'versiegelt' && z.zeitstempel !== 'vorhanden')
			.map((z) => ({ meetingId: z.id, bezeichnung: bezeichnung(z) }))
	});

	/*
	 * **Die Mappenfrage nur, wo die Vorbereitung noch läuft** (Prüflauf II,
	 * C-02). Ob eine Versammlung eine Auszählmappe braucht, kostet zwei
	 * Abfragen — für jede abgeschlossene Versammlung im Bestand wären das
	 * hundertsechzig, um einen Schritt zu färben, der ohnehin vorbei ist.
	 * Dort bleibt es bei der Vorgabe; sichtbar wird der Unterschied nur an
	 * einem Ablauf, der noch etwas offen hat.
	 */
	const offeneZeilen = [...laufend, ...ueberfaellig, ...anstehend];
	const mappe = new Map(
		await Promise.all(
			offeneZeilen.map(
				async (z) => [z.id, await brauchtAuszaehlmappe(operatorId, z.id)] as const
			)
		)
	);
	const mitMappe = (z: Rohzeile) => zeile(z, mappe.get(z.id) ?? true, briefkopfHinterlegt);

	return {
		laufend: abendeZusammenfassen(laufend, mitMappe),
		ueberfaellig: abendeZusammenfassen(ueberfaellig, mitMappe),
		anstehend: abendeZusammenfassen(anstehend, mitMappe),
		abgeschlossen: abendeZusammenfassen(abgeschlossen, mitMappe).slice(0, 5),
		punkte,
		leer: zeilen.length === 0
	};
}

function bezeichnung(z: Rohzeile): string {
	// Ausgeschrieben, nicht ISO: Der Bezug steht auf der Übersicht neben einem
	// Satz in Prosa, und «2026-05-19» liest sich dort wie eine Kennung.
	return `${z.stweg_name}, ${datumLang(z.meeting_date)}`;
}

/** Die Schrittfolge einer einzelnen Versammlung (Story 6.2). */
export async function holeVorbereitung(
	operatorId: Id,
	meetingId: Id
): Promise<{
	schritte: Schritt[];
	fortschritt: ReturnType<typeof vorbereitungsfortschritt>;
	/**
	 * Ob für die Gemeinschaft eine Einberufungsfrist erfasst ist. Die Seite
	 * Vorbereitung zeigt danach beim Haken nur den passenden Rat (Auftrag
	 * «Hinweise lesbar», 06.10.2026).
	 */
	einberufungsfristErfasst: boolean;
} | null> {
	const [z] = await holeRohzeilen(operatorId, { meetingId });
	if (!z) return null;

	/*
	 * **Ob ein Briefkopf hinterlegt ist** (23.08.2026, Prüflauf I, B-14): Der
	 * Schritt versprach «mit Briefkopf der Bewirtschaftung», während unter
	 * Betreiber «Briefkopf hinterlegt: nein» stand. An der Stelle, wo die
	 * Einladung entsteht, sagte das niemand — und gemerkt hätte man es erst am
	 * ausgedruckten Brief.
	 */
	const [betreiber, mappe] = await Promise.all([
		holeBetreiber(operatorId),
		brauchtAuszaehlmappe(operatorId, meetingId)
	]);
	const schritte = vorbereitungsschritte(
		lage(z, mappe, Boolean(betreiber?.briefkopfPruefsumme))
	);
	return {
		schritte,
		fortschritt: vorbereitungsfortschritt(schritte),
		einberufungsfristErfasst: (z.invitation_lead_days ?? null) !== null
	};
}

/**
 * Die Häuser eines gemeinsamen Abends mit ihrem Vorbereitungsstand.
 *
 * Grundlage der Reiterleiste (`$lib/domain/register`): dasselbe Thema bei allen
 * Häusern, ein Klick statt eines Suchwegs. **Eine** Abfrage für alle Häuser —
 * bei sechs Häusern wäre eine je Haus sechsmal derselbe Aufbau.
 *
 * Sortiert nach der Stelle am Abend, nicht nach dem Namen: Die Reihenfolge der
 * Reiter ist die des Abends, sonst führt die Leiste an einer anderen Ordnung
 * entlang als der Saal.
 */
/**
 * Die anderen Versammlungen desselben Abends — für den Wechsel im Saal
 * (Auftraggeber, 23.08.2026: «Wie kann ich beide gemeinsam führen?»).
 *
 * **Warum es das braucht.** Am gemeinsamen Abend tagt jede Gemeinschaft für
 * sich: eigene Beschlussfähigkeit, eigene Stimmberechtigte, eigene Mehrheiten.
 * Eine Sitzungsleitung für beide zugleich gibt es deshalb nicht und soll es
 * nicht geben — wohl aber einen Weg von der einen zur anderen. Bisher führte
 * er über den Abend zurück und von dort auf die Tafel; im Saal sind das drei
 * Klicks und ein Suchen.
 *
 * Für Stammdaten gibt es diesen Wechsel längst (`abendregister`); an der
 * Sitzungsleitung fehlte er.
 */
export async function holeAbendgeschwister(
	operatorId: Id,
	meetingId: Id
): Promise<{ id: Id; name: string; zustand: Versammlungszustand }[]> {
	// Den Abend holt die Funktion selbst: Der Domain-Typ `Versammlung` trägt ihn
	// nicht — er steht an der Übersichtszeile, weil der Kern nichts mit ihm
	// rechnet. Ein Aufrufer, der ihn erst besorgen müsste, bräuchte zwei
	// Abfragen für eine Frage.
	const tagId = await alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ meeting_day_id: string | null }[]>`
			SELECT meeting_day_id FROM meeting WHERE id = ${meetingId}
		`;
		return z?.meeting_day_id ?? null;
	});
	if (!tagId) return [];

	const zeilen = await holeRohzeilen(operatorId, { tagId });
	return zeilen
		.filter((z) => z.id !== meetingId)
		.map((z) => ({ id: z.id, name: z.stweg_name, zustand: z.state }));
}

export async function holeAbendhaeuser(operatorId: Id, tagId: Id): Promise<Abendhaus[]> {
	const zeilen = await holeRohzeilen(operatorId, { tagId });
	const briefkopfHinterlegt = Boolean((await holeBetreiber(operatorId))?.briefkopfPruefsumme);
	// Ein Abend trägt eine Handvoll Häuser — hier lohnt die genaue Frage.
	const mappeJeHaus = new Map(
		await Promise.all(
			zeilen.map(async (z) => [z.id, await brauchtAuszaehlmappe(operatorId, z.id)] as const)
		)
	);
	return zeilen
		.slice()
		.sort(
			(a, b) =>
				(a.day_position ?? Number.MAX_SAFE_INTEGER) -
					(b.day_position ?? Number.MAX_SAFE_INTEGER) || a.stweg_name.localeCompare(b.stweg_name)
		)
		.map((z) => ({
			stwegId: z.stweg_id,
			versammlungId: z.id,
			name: z.stweg_name,
			zustand: z.state,
			mappeNoetig: mappeJeHaus.get(z.id) ?? true,
			schritte: vorbereitungsschritte(
				lage(z, mappeJeHaus.get(z.id) ?? true, briefkopfHinterlegt)
			).map((s) => ({
				kennung: s.kennung,
				titel: s.titel,
				zustand: s.zustand,
				stand: s.stand,
				beschreibung: s.beschreibung
			}))
		}));
}
