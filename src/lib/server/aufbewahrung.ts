/**
 * Aufbewahrung und Löschung (FR-57).
 *
 * **Zwei gegenläufige Pflichten.** Was den Beschluss trägt, muss haltbar sein,
 * solange ihn jemand anfechten kann. Danach liegen Abschlusspaket und
 * unterzeichnetes Protokoll bei der Verwaltung im Archiv, sonst beim
 * Stockwerkeigentümer, der den Vorsitz geführt hat, und Votum darf die
 * Versammlung löschen (`loescheNachFrist`, Produktentscheid 17.09.2026; die Regel
 * steht in `$lib/domain/loeschfrist`).
 *
 * Was den Beschluss nicht trägt, hat nach der Versammlung nichts mehr verloren
 * zu suchen: Zugangscodes, Gerätesitzungen, Wartelisten sind Betriebsdaten mit
 * Personenbezug und ohne Beweiswert. Sie stehen ausdrücklich nicht im
 * Abschlusspaket, also kostet ihre Löschung keinen Nachweis.
 *
 * **Von Hand, nicht von selbst.** Kein Auftrag, der nachts läuft und wegräumt,
 * was am Morgen noch gebraucht wird. Die Anwendung zeigt, was löschbar ist; die
 * Entscheidung bleibt bei einem Menschen. Die Sperre gegen zu frühes Löschen
 * liegt dagegen in der Datenbank (Migrationen 042, 113, 115 und 137) — sie soll auch dann greifen,
 * wenn jemand an dieser Datei vorbei arbeitet.
 */
import postgres from 'postgres';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { entferneDatei } from './dateien';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { tagVon } from '$lib/domain/datum';
import {
	loeschbarAb,
	pruefeLoeschung,
	type Genehmigungsstand,
	type Loeschangaben,
	type Loeschlage
} from '$lib/domain/loeschfrist';
import type { Id, Zeitpunkt } from '$lib/domain/types';

export interface Betriebsdatenposten {
	versammlungId: Id;
	bezeichnung: string;
	datum: string;
	geschlossenAm: Zeitpunkt | null;
	versiegelt: boolean;
	zugaenge: number;
	sitzungen: number;
	saalmeldungen: number;
}

export interface Aufbewahrungslage {
	/** Heute, in Schweizer Zeit, damit die Seite «löschbar» ohne eigene Uhr zählt. */
	heute: string;
	/** Geschlossene Versammlungen, an denen noch Betriebsdaten hängen. */
	offen: Betriebsdatenposten[];
	/** Versiegelte Pakete, mit dem Tag, ab dem sie sich löschen liessen. */
	pakete: {
		versammlungId: Id;
		bezeichnung: string;
		datum: string;
		ort: string;
		versiegeltAm: Zeitpunkt;
		/**
		 * Wer den Vorsitz führte — seit Migration 091 festgehalten (Auftraggeber:
		 * «Sitzungsleiter braucht es»). Bei Paketen aus der Zeit davor leer.
		 */
		sitzungsleitung: string | null;
		/** Das Konto, das versiegelt hat — im Haus überall `versiegeltDurch`. */
		versiegeltDurch: string | null;
		/**
		 * Der Tag, an dem das Protokoll zuletzt als versandt festgehalten wurde.
		 * Ein Vorschlag, kein Beleg: Zugestellt kann es später worden sein, und
		 * beim Löschen wird deshalb danach gefragt.
		 */
		versandtAm: string | null;
		/** Ab wann gelöscht werden dürfte, wenn der Versandtag die letzte Zustellung war. */
		loeschbarAb: string | null;
		/**
		 * Wie weit die Genehmigung des Protokolls ist, beim gemeinsamen Abend der
		 * schwächste Stand seiner Versammlungen. Vor der Genehmigung ist nichts
		 * löschbar, auch wenn `loeschbarAb` schon vorbei ist (Migration 115).
		 */
		genehmigung: Genehmigungsstand;
	}[];
}

export async function erhebeLage(operatorId: Id): Promise<Aufbewahrungslage> {
	return alsBetreiber(operatorId, async (tx) => {

		const offen = await tx<
			{
				id: string;
				name: string;
				meeting_date: string;
				closed_at: string | null;
				versiegelt: boolean;
				zugaenge: string;
				sitzungen: string;
				saalmeldungen: string;
			}[]
		>`
			SELECT m.id, g.name, m.meeting_date, m.closed_at,
			       (s.meeting_id IS NOT NULL) AS versiegelt,
			       (SELECT count(*) FROM meeting_access a WHERE a.meeting_id = m.id) AS zugaenge,
			       (SELECT count(*) FROM access_session z
			         JOIN meeting_access a ON a.id = z.meeting_access_id
			        WHERE a.meeting_id = m.id) AS sitzungen,
			       (SELECT count(*) FROM room_entry_request r WHERE r.meeting_id = m.id) AS saalmeldungen
			  FROM meeting m
			  JOIN stweg g ON g.id = m.stweg_id
			  LEFT JOIN seal s ON s.meeting_id = m.id
			 WHERE m.state IN ('geschlossen', 'versiegelt')
			 ORDER BY m.meeting_date DESC
		`;

		const pakete = await tx<
			// **`Date`, nicht `string`** (25.08.2026). Der Treiber wandelt
			// `timestamptz` in ein `Date`; die falsche Angabe versteckte vor dem
			// Uebersetzer, dass die Sortierung auf der Betreiberseite den
			// Wochentagsnamen verglich.
			{
				meeting_id: string;
				name: string;
				meeting_date: string;
				location: string;
				sealed_at: Date;
				chair_label: string | null;
				sealed_by_label: string | null;
				versandt_am: Date | null;
				genehmigung: Genehmigungsstand;
			}[]
		>`
			SELECT s.meeting_id, g.name,
			       -- to_char, nicht roh (26.08.2026, aus dem Code-Review):
			       -- meeting_date ist eine date-Spalte, und der Treiber wandelt
			       -- OID 1082 in ein Date. Die Angabe string daneben waere
			       -- dieselbe Luege, vor der der Kommentar oben warnt.
			       -- Derselbe Weg wie in uebersicht.ts und versammlungen.ts.
			       to_char(m.meeting_date, 'YYYY-MM-DD') AS meeting_date,
			       m.location, s.sealed_at,
			       -- Der Abend schlaegt das Haus: Fuehrt ein Abend mehrere
			       -- Gemeinschaften, steht der Vorsitz an meeting_day (Migration
			       -- 092) und das Formular am Haus ist dort gar nicht erreichbar.
			       -- Ohne COALESCE zeigte die Liste fuer jeden Verbundabend einen
			       -- Gedankenstrich, waehrend das unterschriebene Protokoll einen
			       -- Namen nennt.
			       COALESCE(m.chair_label, d.chair_label) AS chair_label,
			       s.sealed_by_label,
			       -- Beim gemeinsamen Abend über alle seine Versammlungen: Gelöscht
			       -- wird er nur als Ganzes, und die Löschseite rechnet ebenso
			       -- (Code-Review 17.09.2026). Sonst nennte die Tabelle eine
			       -- Versammlung löschbar, die der Löschweg noch abweist.
			       (SELECT max(v.frozen_at)
			          FROM minutes_version v
			          JOIN meeting x ON x.id = v.meeting_id
			         WHERE v.kind = 'versandt'
			           AND (x.id = s.meeting_id
			                OR (m.meeting_day_id IS NOT NULL AND x.meeting_day_id = m.meeting_day_id))
			       ) AS versandt_am,
			       -- Dieselbe Klammer um den Abend. Der schwächste Stand gewinnt,
			       -- weil der Löschweg jede Versammlung des Abends einzeln prüft.
			       (SELECT CASE WHEN bool_or(q.stand = 'fehlt') THEN 'fehlt'
			                    WHEN bool_or(q.stand = 'ohne_folgeversammlung') THEN 'ohne_folgeversammlung'
			                    ELSE 'genehmigt' END
			          FROM (SELECT protokoll_genehmigung(x.id) AS stand
			                  FROM meeting x
			                 WHERE x.id = s.meeting_id
			                    OR (m.meeting_day_id IS NOT NULL AND x.meeting_day_id = m.meeting_day_id)) q
			       ) AS genehmigung
			  FROM seal s
			  JOIN meeting m ON m.id = s.meeting_id
			  JOIN stweg g ON g.id = m.stweg_id
			  LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
			 -- Zweitschluessel: sealed_at steht auf DEFAULT now(), also der
			 -- Transaktionszeit — beim Versiegeln eines Abends tragen alle Pakete
			 -- denselben Wert, und die Reihenfolge waere sonst zwischen zwei
			 -- Aufrufen nicht festgelegt.
			 ORDER BY s.sealed_at DESC, g.name
		`;

		return {
			heute: heuteInZuerich(),
			offen: offen
				.map((z) => ({
					versammlungId: z.id,
					bezeichnung: z.name,
					datum: z.meeting_date,
					geschlossenAm: z.closed_at,
					versiegelt: z.versiegelt,
					zugaenge: Number(z.zugaenge),
					sitzungen: Number(z.sitzungen),
					saalmeldungen: Number(z.saalmeldungen)
				}))
				.filter((p) => p.zugaenge + p.sitzungen + p.saalmeldungen > 0),
			pakete: pakete.map((z) => ({
				versammlungId: z.meeting_id,
				bezeichnung: z.name,
				datum: z.meeting_date,
				ort: z.location,
				versiegeltAm: z.sealed_at.toISOString(),
				sitzungsleitung: z.chair_label,
				versiegeltDurch: z.sealed_by_label,
				versandtAm: z.versandt_am ? tagVon(z.versandt_am.toISOString()) : null,
				loeschbarAb: z.versandt_am ? loeschbarAb(tagVon(z.versandt_am.toISOString())) : null,
				genehmigung: z.genehmigung
			}))
		};
	});
}

export interface Loeschbefund {
	zugaenge: number;
	sitzungen: number;
	saalmeldungen: number;
}

/**
 * Löscht die Betriebsdaten **einer** geschlossenen Versammlung (FR-57).
 *
 * Was verschwindet: Zugangscodes, Gerätesitzungen, Saalmeldungen. Was bleibt:
 * alles, was im Abschlusspaket steht — Anwesenheit, Stimmen, Vollmachten,
 * Verlauf. Die Anwesenheit **ist** der Nachweis, der Code war nur der Weg
 * dorthin.
 */
export async function loescheBetriebsdaten(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<Loeschbefund> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId}
		`;
		if (!m) {
			throw new FachlicherFehler('unbekannt', 'Diese Versammlung gibt es nicht.', 'zustand');
		}
		if (m.state !== 'geschlossen' && m.state !== 'versiegelt') {
			throw new FachlicherFehler(
				'noch_offen',
				'Diese Versammlung ist noch nicht geschlossen. Solange sie läuft, werden die Zugänge gebraucht.',
				'zustand'
			);
		}

		// **Über die Datenbankfunktion, nicht mit eigenem DELETE.** Die
		// Anwendungsrolle darf Zugänge und Gerätesitzungen nicht löschen — ein
		// gelöschter Zugang liesse sich sonst nicht von einem nie erzeugten
		// unterscheiden (Migrationen 015 und 018). Die Funktion aus Migration 042
		// ist der eine eng gefasste Weg daneben; sie prüft den Zustand selbst,
		// noch einmal, denn sie steht auch anderen Aufrufern offen.
		const [gezaehlt] = await tx<{ zugaenge: number; sitzungen: number; saalmeldungen: number }[]>`
			SELECT * FROM betriebsdaten_loeschen(${handelnder.operatorId}, ${meetingId})
		`;

		const befund: Loeschbefund = {
			zugaenge: gezaehlt.zugaenge,
			sitzungen: gezaehlt.sitzungen,
			saalmeldungen: gezaehlt.saalmeldungen
		};

		// Der Verlauf hält fest, **dass** gelöscht wurde. Er ist selbst nicht
		// löschbar (AD-5) — sonst liesse sich eine Löschung spurlos machen, und
		// genau das darf sie nicht sein.
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.betriebsdatenGeloescht,
				{ art: 'meeting', id: meetingId },
				{ ...befund }
			)
		);

		return befund;
	});
}

/** Heute, in Schweizer Zeit — der Tag, an dem die Frist gemessen wird. */
function heuteInZuerich(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

export interface Loeschlagebericht {
	/** Die Versammlungen, die zusammen gehen: eine, oder alle eines Abends. */
	versammlungen: {
		id: Id;
		gemeinschaftId: Id;
		gemeinschaft: string;
		datum: string;
		ort: string;
		zustand: string;
		versiegelt: boolean;
		geschlossenAm: Zeitpunkt | null;
		/** Wie weit die Genehmigung ihres Protokolls ist (`protokoll_genehmigung`, Migration 115). */
		genehmigung: Genehmigungsstand;
		/**
		 * Das Siegel des Abschlusspakets (SHA-256 über das Manifest), sofern
		 * versiegelt. Es geht in den Vermerk, der die Löschung überlebt: Danach
		 * gibt es die Siegelzeile nicht mehr, und das Prüfwerkzeug braucht einen
		 * Vergleichswert von aussen (FR-54).
		 */
		siegel: string | null;
	}[];
	/** Die Bezeichnung des gemeinsamen Abends, sonst `null`. */
	abend: string | null;
	offenePendenzen: number;
	/** Der späteste Versandabzug des Protokolls, als Vorschlag für das Zustelldatum. */
	versandtAm: string | null;
	/** Was mit verschwindet, gezählt über alle betroffenen Versammlungen. */
	zahlen: { traktanden: number; stimmen: number; vollmachten: number; dateien: number };
	heute: string;
}

/**
 * Was zusammen gelöscht würde, und was dem entgegensteht.
 *
 * **Eine Lesung für beide Wege.** Die Seite fragt damit vorher, der Löschweg
 * prüft damit in seiner Transaktion. Zwei Abfragen für dieselbe Frage liefen
 * auseinander, und dann sagte die Seite «löschbar», während der Löschweg absagt.
 */
async function leseLoeschlage(tx: postgres.TransactionSql, versammlungId: Id): Promise<Loeschlagebericht> {
	const [m] = await tx<{ id: string; meeting_day_id: string | null; abend: string | null }[]>`
		SELECT m.id, m.meeting_day_id, d.label AS abend
		  FROM meeting m
		  LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
		 WHERE m.id = ${versammlungId}
	`;
	if (!m) {
		throw new FachlicherFehler('unbekannt', 'Diese Versammlung gibt es nicht.', 'zustand');
	}

	const zeilen = await tx<
		{
			id: string;
			stweg_id: string;
			name: string;
			meeting_date: string;
			location: string;
			state: string;
			closed_at: Date | null;
			versiegelt: boolean;
			genehmigung: Genehmigungsstand;
			siegel: string | null;
		}[]
	>`
		SELECT m.id, m.stweg_id, g.name, to_char(m.meeting_date, 'YYYY-MM-DD') AS meeting_date,
		       m.location, m.state, m.closed_at,
		       EXISTS (SELECT 1 FROM seal s WHERE s.meeting_id = m.id) AS versiegelt,
		       protokoll_genehmigung(m.id) AS genehmigung,
		       (SELECT s.manifest_hash FROM seal s WHERE s.meeting_id = m.id) AS siegel
		  FROM meeting m
		  JOIN stweg g ON g.id = m.stweg_id
		 WHERE (${m.meeting_day_id}::uuid IS NULL AND m.id = ${m.id})
		    OR m.meeting_day_id = ${m.meeting_day_id}
		 ORDER BY m.day_position NULLS FIRST, g.name, m.id
	`;
	const kennungen = zeilen.map((z) => z.id);

	const [z] = await tx<
		{
			pendenzen: number;
			versandt_am: Date | null;
			traktanden: number;
			stimmen: number;
			vollmachten: number;
			dateien: number;
		}[]
	>`
		SELECT
		  (SELECT count(*)::int FROM pendenz
		    WHERE meeting_id = ANY (${kennungen}::uuid[]) AND state = 'offen') AS pendenzen,
		  (SELECT max(frozen_at) FROM minutes_version
		    WHERE meeting_id = ANY (${kennungen}::uuid[]) AND kind = 'versandt') AS versandt_am,
		  (SELECT count(*)::int FROM agenda_item
		    WHERE meeting_id = ANY (${kennungen}::uuid[])) AS traktanden,
		  (SELECT count(*)::int FROM vote v JOIN voting_round r ON r.id = v.round_id
		    WHERE r.meeting_id = ANY (${kennungen}::uuid[])) AS stimmen,
		  (SELECT count(*)::int FROM proxy
		    WHERE meeting_id = ANY (${kennungen}::uuid[])) AS vollmachten,
		  (SELECT count(*)::int FROM attachment a
		    WHERE (a.subject_type = 'meeting' AND a.subject_id = ANY (${kennungen}::uuid[]))
		       OR (a.subject_type = 'agenda_item' AND a.subject_id IN (
		             SELECT id FROM agenda_item WHERE meeting_id = ANY (${kennungen}::uuid[])))
		       OR (a.subject_type = 'proxy' AND a.subject_id IN (
		             SELECT id FROM proxy WHERE meeting_id = ANY (${kennungen}::uuid[])))) AS dateien
	`;

	return {
		versammlungen: zeilen.map((v) => ({
			id: v.id,
			gemeinschaftId: v.stweg_id,
			gemeinschaft: v.name,
			datum: v.meeting_date,
			ort: v.location,
			zustand: v.state,
			versiegelt: v.versiegelt,
			geschlossenAm: v.closed_at ? v.closed_at.toISOString() : null,
			genehmigung: v.genehmigung,
			siegel: v.siegel
		})),
		abend: m.meeting_day_id ? m.abend : null,
		offenePendenzen: z.pendenzen,
		versandtAm: z.versandt_am ? tagVon(z.versandt_am.toISOString()) : null,
		zahlen: {
			traktanden: z.traktanden,
			stimmen: z.stimmen,
			vollmachten: z.vollmachten,
			dateien: z.dateien
		},
		heute: heuteInZuerich()
	};
}

/** Die Lage in der Form, die der Kern prüft. */
function kernlage(lage: Loeschlagebericht): Loeschlage {
	const schluesse = lage.versammlungen
		.map((v) => v.geschlossenAm)
		.filter((d): d is string => d !== null)
		.map(tagVon)
		.sort();
	return {
		heute: lage.heute,
		spaetesterSchluss: schluesse.at(-1) ?? null,
		offenePendenzen: lage.offenePendenzen,
		nichtGeschlossen: lage.versammlungen.some(
			(v) => v.zustand !== 'geschlossen' && v.zustand !== 'versiegelt'
		),
		nichtVersiegelt: lage.versammlungen.some((v) => !v.versiegelt),
		ohneGenehmigung: lage.versammlungen
			.filter((v) => v.genehmigung === 'fehlt')
			.map((v) => v.gemeinschaft),
		ohneFolgeversammlung: lage.versammlungen
			.filter((v) => v.genehmigung === 'ohne_folgeversammlung')
			.map((v) => v.gemeinschaft)
	};
}

/** Die Lage für die Löschseite. */
export async function erhebeLoeschlage(operatorId: Id, versammlungId: Id): Promise<Loeschlagebericht> {
	return alsBetreiber(operatorId, (tx) => leseLoeschlage(tx, versammlungId));
}

/**
 * Prüft die Angaben, ohne zu löschen, und gibt zurück, was verschwinden würde.
 *
 * Für die Rückfrage vor dem Löschen: Sie nennt Zahlen, und die Absage soll vor
 * der Frage kommen, nicht nach dem «Ja».
 */
export async function pruefeLoeschungVorab(
	operatorId: Id,
	versammlungId: Id,
	angaben: Loeschangaben
): Promise<Loeschlagebericht> {
	const lage = await erhebeLoeschlage(operatorId, versammlungId);
	pruefeLoeschung(angaben, kernlage(lage));
	return lage;
}

export interface Loeschergebnis {
	/** Wie viele Versammlungen gelöscht wurden: eine, oder alle eines Abends. */
	versammlungen: number;
	/** Gelöschte Zeilen über alle Tabellen, für den Nachweis im Verlauf. */
	zeilen: number;
	/** Dateien, die aus der Ablage entfernt wurden, weil nichts mehr auf sie zeigt. */
	dateienEntfernt: number;
	/** Dateien, die hätten gehen sollen, sich aber nicht entfernen liessen. */
	dateienUebrig: number;
}

/**
 * Löscht eine versiegelte Versammlung, deren Protokoll genehmigt ist, nach
 * Ablauf der Anfechtungsfrist (Produktentscheid 17.09.2026; Genehmigung und
 * Siegel seit Migration 115).
 *
 * **Gehört sie zu einem gemeinsamen Abend, geht der ganze Abend.** Weisungen
 * und das gemeinsame Protokoll verbinden seine Versammlungen; ein halber Abend
 * wäre ein Protokoll mit Lücken.
 *
 * **Zwei Prüfungen, mit verschiedenem Zweck.** Der Kern (`pruefeLoeschung`) sagt
 * vorher verständlich, was fehlt. Die Datenbankfunktion prüft dasselbe noch
 * einmal und ist die, auf die es ankommt: Sie steht auch jedem anderen Aufrufer
 * offen.
 *
 * **Die Dateien erst nach dem Commit.** Scheitert die Transaktion, müssen die
 * Dateien noch da sein. Umgekehrt bleibt nach einem Absturz dazwischen höchstens
 * eine verwaiste Datei liegen, nie ein Verweis ins Leere.
 */
export async function loescheNachFrist(
	handelnder: Handelnder & { operatorId: string },
	versammlungId: Id,
	angaben: Loeschangaben
): Promise<Loeschergebnis> {
	let geloescht: { versammlungen: number; zeilen: number; pruefsummen: string[] };
	try {
		geloescht = await alsBetreiber(handelnder.operatorId, async (tx) => {
			const lage = await leseLoeschlage(tx, versammlungId);
			pruefeLoeschung(angaben, kernlage(lage));
			const kennungen = lage.versammlungen.map((b) => b.id);

			/*
			 * **Die Vorbereitungspakete, vor dem Löschen** (18.09.2026, aus dem
			 * Code-Review). `versammlungen_endgueltig_loeschen` stammt aus Migration
			 * 113 und kennt `meeting_handover` nicht; der Leihschein verschwindet
			 * über `ON DELETE CASCADE`, seine Datei bliebe für immer in der Ablage
			 * liegen. Sie hier einzusammeln ist die kleinere Reparatur, als die
			 * Funktion mit ihren 246 Zeilen nur wegen einer Zeile zu verdoppeln.
			 *
			 * **Vor dem Löschen, weil danach nichts mehr dasteht.** Gelöscht werden
			 * die Dateien trotzdem erst nach dem Commit, und erst, nachdem
			 * `pruefsumme_verwendet` (in Migration 118 um genau diese Tabelle
			 * erweitert) bestätigt hat, dass sie niemand mehr braucht.
			 */
			const pakete = await tx<{ package_checksum: string; returned_package: string | null }[]>`
				SELECT package_checksum, returned_package
				  FROM meeting_handover
				 WHERE meeting_id = ANY (${kennungen}::uuid[])
			`;

			const [r] = await tx<{ pruefsummen: string[]; zeilen: number }[]>`
				SELECT * FROM versammlungen_endgueltig_loeschen(
					${handelnder.operatorId}, ${kennungen}::uuid[], ${angaben.zugestelltAm}::date,
					${angaben.paketArchiviert}, ${angaben.protokollArchiviert}, ${angaben.keineAnfechtung}
				)
			`;

			// Der Vermerk steht an der Gemeinschaft, weil die Versammlung mit ihren
			// eigenen Einträgen verschwunden ist. Er nennt keine Eigentümer.
			for (const b of lage.versammlungen) {
				await schreibeVerlauf(
					tx,
					handelnder,
					ereignis(
						EREIGNISARTEN.versammlungNachFristGeloescht,
						{ art: 'stweg', id: b.gemeinschaftId },
						{
							versammlungVom: b.datum,
							versiegelt: b.versiegelt,
							gemeinsamerAbend: lage.abend !== null,
							versammlungenZusammen: lage.versammlungen.length,
							zugestelltAm: angaben.zugestelltAm,
							loeschbarAb: loeschbarAb(angaben.zugestelltAm),
							paketArchiviert: angaben.paketArchiviert,
							protokollArchiviert: angaben.protokollArchiviert,
							keineAnfechtung: angaben.keineAnfechtung,
							protokollGenehmigt: b.genehmigung === 'genehmigt',
							// Der Vergleichswert für das Prüfwerkzeug, nachdem die
							// Siegelzeile mit der Versammlung verschwunden ist.
							siegel: b.siegel,
							zeilen: r.zeilen
						}
					)
				);
			}

			return {
				versammlungen: lage.versammlungen.length,
				zeilen: r.zeilen,
				/*
				 * **Beide Richtungen des Leihscheins**, das hingebrachte und das
				 * zurückgekommene Paket. Nur eine einzusammeln hiesse, denselben
				 * Fehler noch einmal zu bauen, den diese Zeilen beheben: Migration
				 * 118 kennt beide, der Einsammler hier muss es auch.
				 */
				pruefsummen: [
					...r.pruefsummen,
					...pakete
						.flatMap((p) => [p.package_checksum, p.returned_package])
						.filter((s): s is string => Boolean(s))
				]
			};
		});
	} catch (fehler) {
		// Die Absagen der Datenbankfunktion sind eigene, deutsche Sätze ohne
		// Schemanamen. Sie greifen nur, wenn der Kern oben etwas nicht gesehen hat.
		if (fehler instanceof postgres.PostgresError && fehler.code === 'P0001') {
			throw new FachlicherFehler('loeschen_abgewiesen', fehler.message, 'zustand');
		}
		// Ein Fremdschlüssel, den die Funktion nicht kennt: eine Tabelle, die nach
		// Migration 113 dazukam. Die Transaktion ist zurückgerollt, es fehlt nichts.
		if (fehler instanceof postgres.PostgresError && fehler.code === '23503') {
			throw new FachlicherFehler(
				'loeschen_verweis',
				'Auf diese Versammlung verweist noch ein Eintrag, den das Löschen nicht kennt. Es wurde nichts gelöscht. Melden Sie das bitte mit Gemeinschaft und Datum der Versammlung.',
				'zustand'
			);
		}
		throw fehler;
	}

	// **Nur, was nirgends mehr gebraucht wird.** Zwischen der Prüfung und dem
	// Entfernen könnte jemand genau denselben Inhalt neu hochladen; dann fehlte
	// ihm die Datei. Das setzt einen byteweise gleichen Upload in denselben
	// Millisekunden voraus und ist hingenommen.
	let dateienEntfernt = 0;
	let dateienUebrig = 0;
	for (const pruefsumme of geloescht.pruefsummen) {
		try {
			const [v] = await sql<{ verwendet: boolean }[]>`
				SELECT pruefsumme_verwendet(${pruefsumme}) AS verwendet
			`;
			if (!v.verwendet && (await entferneDatei(pruefsumme))) dateienEntfernt++;
		} catch (fehler) {
			dateienUebrig++;
			const meldung = fehler instanceof Error ? fehler.message : String(fehler);
			console.error(`[aufbewahrung] Datei ${pruefsumme} nicht entfernt: ${meldung}`);
		}
	}

	return {
		versammlungen: geloescht.versammlungen,
		zeilen: geloescht.zeilen,
		dateienEntfernt,
		dateienUebrig
	};
}
