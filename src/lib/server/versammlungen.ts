/**
 * Datenzugriff auf Versammlungen (Story 3.1).
 *
 * Der Zustand wird hier nie gesetzt, sondern nur geschrieben, was ein Übergang
 * des Kerns zurückgegeben hat (AD-10).
 */
import { createHash, randomBytes } from 'node:crypto';
import type postgres from 'postgres';
import { alsBetreiber, sql } from './db';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import { legePflichttraktandenAn, uebertrageOffeneTraktanden } from './vorlagen';
import { schliesseOffeneAbstimmungen, warZeitweiseBeschlussfaehigIn } from './abstimmung';
import { entwerteInTransaktion } from './zugaenge';
import {
	ANZEIGECODELAENGE,
	anzeigecodeAus,
	normalisiere,
	pruefeAnzeigecode
} from '$lib/domain/zugang';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import {
	aendereVersammlung,
	eroeffne,
	folgeversammlung,
	fristvermerk,
	geltendeZweitfrist,
	legeVersammlungAn,
	schliesse,
	setzeAktuellesTraktandum,
	verlangeZustand,
	wechsleBetriebsart,
	type Betriebsart,
	type Versammlung,
	type Zweitversammlungsfrist,
	type VersammlungEingabe,
	type Versammlungsart,
	abgeschlossen,
	NACHLAUF_MS,
	type Versammlungszustand,
	type Wandbildart,
	setzeWandbild as setzeWandbildImKern,
	LEITUNGSFELDER,
	pruefeLeitungsnamen
} from '$lib/domain/versammlung';
import { folgestufeNachVertagung, type Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import { pruefeLoeschung } from '$lib/domain/loeschung';
import { datumLang, kalendertag, zeitpunktKurz } from '$lib/domain/datum';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdeGemeinschaft, fremdesTraktandum } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';
import type { Sicht } from '$lib/domain/archivieren';
import { haltCodeversuchFest } from './codeversuche';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import {
	Schreibkonflikt,
	konfliktsatz,
	veralteteFelder,
	type Schreibstand
} from '$lib/domain/schreibstand';
import { regleEinladungsmehrBeimEroeffnen } from './einladungsmehr';

interface MeetingZeile {
	agenda_confirmed_at: Date | null;
	id: string;
	operator_id: string;
	stweg_id: string;
	meeting_day_id: string | null;
	day_position: number | null;
	state: Versammlungszustand;
	meeting_date: Date;
	start_time: string;
	location: string;
	kind: Versammlungsart;
	occasion: string | null;
	tier: Versammlungsstufe;
	previous_meeting_id: string | null;
	interval_note: string | null;
	operation_mode: Betriebsart;
	ask_paper_ballot: boolean;
	current_agenda_item_id: string | null;
	current_agenda_item_at: Date | null;
	archived_at: Date | null;
	archived_note: string | null;
	chair_label: string | null;
	minutes_keeper_label: string | null;
	wall_kind: Wandbildart;
	wall_text: string | null;
	wall_changed_at: Date | null;
	paused_at: Date | null;
	pause_text: string | null;
	released_at: Date | null;
	opened_at: Date | null;
	closed_at: Date | null;
}

/**
 * Der kurze Name für `kalendertag` aus dem Kern.
 *
 * **Die Begründung, die hier stand, war verkehrt herum** (02.09.2026,
 * nachgemessen). Sie warnte vor `toISOString()`, es «verschöbe den 1. Januar auf
 * den 31. Dezember» — und beschrieb damit genau das, was die Ortszeit-Getter
 * darunter taten. Gemessen an einer `date`-Spalte über den Treiber:
 *
 * | Prozesszone | `toISOString()` | `getFullYear()` & Co. |
 * |---|---|---|
 * | UTC | 2026-01-01 | 2026-01-01 |
 * | Europe/Zurich | 2026-01-01 | 2026-01-01 |
 * | America/New_York | 2026-01-01 | **2025-12-31** |
 *
 * Der Treiber liefert die Spalte als Mitternacht **UTC**, in jeder Zone. Wer
 * sie durch die Ortszeit dreht, verliert bei negativem Versatz einen Tag.
 */
const tag = kalendertag;

function ausDb(z: MeetingZeile): Versammlung {
	return {
		id: z.id,
		operatorId: z.operator_id,
		stwegId: z.stweg_id,
		zustand: z.state,
		traktandenlisteBestaetigtAm: z.agenda_confirmed_at?.toISOString() ?? null,
		datum: tag(z.meeting_date),
		uhrzeit: z.start_time.slice(0, 5),
		ort: z.location,
		art: z.kind,
		anlass: z.occasion ?? undefined,
		stufe: z.tier,
		vorgaengerId: z.previous_meeting_id,
		fristvermerk: z.interval_note,
		betriebsart: z.operation_mode,
		papierfrage: z.ask_paper_ballot,
		aktuellesTraktandumId: z.current_agenda_item_id,
		aufgerufenSeit: z.current_agenda_item_at?.toISOString() ?? null,
		archiviertAm: z.archived_at?.toISOString() ?? null,
		archivnotiz: z.archived_note,
		sitzungsleitung: z.chair_label,
		protokollfuehrung: z.minutes_keeper_label,
		wandbild: {
			art: z.wall_kind,
			text: z.wall_text,
			geaendertAm: z.wall_changed_at?.toISOString() ?? null
		},
		pause: z.paused_at
			? { seit: z.paused_at.toISOString(), text: z.pause_text }
			: null,
		freigegebenAm: z.released_at?.toISOString() ?? null,
		eroeffnetAm: z.opened_at?.toISOString() ?? null,
		geschlossenAm: z.closed_at?.toISOString() ?? null
	};
}

export async function holeVersammlung(operatorId: Id, id: Id): Promise<Versammlung | null> {
	return alsBetreiber(operatorId, async (tx) => {
		// Der Archivstand der Gruppe reist mit: Die Seite muss sagen können,
		// **weswegen** die Versammlung aus den Listen gefallen ist — und die
		// Freigabe muss ihn prüfen (25.08.2026, dritte Reviewrunde).
		const [z] = await tx<(MeetingZeile & { gemeinschaft_archiviert_seit: Date | null })[]>`
			SELECT m.*, w.archived_at AS gemeinschaft_archiviert_seit
			  FROM meeting m
			  LEFT JOIN stweg w ON w.id = stweg_archiv_wegen(m.stweg_id)
			 WHERE m.id = ${id}
		`;
		return z
			? {
					...ausDb(z),
					gemeinschaftArchiviertSeit: z.gemeinschaft_archiviert_seit?.toISOString() ?? null
				}
			: null;
	});
}

export interface VersammlungsZeile extends Versammlung {
	gemeinschaftName: string;
	/**
	 * Der Abend, zu dem sie gehört (Story 7.5) — null, wenn sie für sich steht.
	 *
	 * Steht an der Zeile und nicht am Domain-Typ: Der Kern rechnet nichts mit dem
	 * Abend, die Übersicht gruppiert bloss danach.
	 */
	tagId: Id | null;
	/**
	 * Die Stelle im Ablauf der gemeinsamen Versammlung — null, wenn sie für sich
	 * steht.
	 *
	 * Muss mitkommen, weil sonst niemand danach sortieren kann: «Wer tagt mit»
	 * zeigte die Karten in der Reihenfolge von `meeting_date DESC`, und bei
	 * gleichem Datum ist das die Reihenfolge der Datenbankseiten. Eine gelöste und
	 * wieder aufgenommene Versammlung stand danach irgendwo — obwohl das
	 * Aufnehmen ihre alte Stelle sorgfältig wiederherstellt (Prüflauf 11.08.2026).
	 */
	stelle: number | null;
	/**
	 * Seit wann die **Gruppe** der Gemeinschaft im Archiv liegt — `null`, wenn
	 * sie in den Listen steht.
	 *
	 * Nicht dasselbe wie `archiviertAm` der Versammlung: Eine Versammlung kann
	 * einzeln archiviert sein, und sie kann als Teil einer archivierten Gruppe
	 * aus den Listen fallen. Die Liste auf `/versammlungen` braucht beides.
	 */
	gemeinschaftArchiviertSeit?: string | null;
}

/** Alle Versammlungen einer Gemeinschaft, neueste zuerst. */
export async function holeVersammlungen(
	operatorId: Id,
	stwegId: Id,
	/**
	 * Ohne Vorgabe, wie bei den anderen Lesewegen (25.08.2026). Diese Funktion
	 * traegt die Seitenleiste der Gemeinschaft und «die naechste Versammlung» —
	 * ohne Filter stand eine archivierte Versammlung dort weiter, obwohl sie aus
	 * jeder Liste verschwunden war, und war so wieder erreichbar.
	 */
	sicht: Sicht
): Promise<VersammlungsZeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<(MeetingZeile & { stweg_name: string })[]>`
			SELECT m.*, s.name AS stweg_name
			FROM meeting m
			JOIN stweg s ON s.id = m.stweg_id
			WHERE m.stweg_id = ${stwegId}
			${
				sicht === 'aktiv'
					? // **Auch die Gruppe** (25.08.2026, dritte Reviewrunde). Vorher stand
						// hier nur die eigene Spalte: Die Seitenleiste eines Hauses in einer
						// archivierten Gruppe zeigte genau die Versammlungen weiter, die
						// Liste und Startseite ausblendeten — und bot damit den Weg zur
						// Freigabe an, den der Server danach abweisen soll.
						tx`AND m.archived_at IS NULL AND stweg_archiv_wegen(m.stweg_id) IS NULL`
					: tx``
			}
			ORDER BY m.meeting_date DESC, m.start_time DESC
		`;
		return zeilen.map((z) => ({
			...ausDb(z),
			gemeinschaftName: z.stweg_name,
			tagId: z.meeting_day_id,
			stelle: z.day_position
		}));
	});
}

/** Alle Versammlungen des Betreibers, neueste zuerst. */
/**
 * Alle Versammlungen — vorgabemässig **ohne** die archivierten (Migration 086).
 *
 * Archiviert ist eine Versammlung auch dann, wenn ihre **Gemeinschaft** im
 * Archiv liegt: Wer ein Mandat abgibt, will nicht deren zwölf Versammlungen
 * einzeln wegräumen.
 */
export async function holeAlleVersammlungen(
	operatorId: Id,
	/**
	 * Ob Archiviertes mitkommt — **ohne Vorgabe, mit Absicht** (25.08.2026).
	 *
	 * Eine Vorgabe `'aktiv'` entschied still für jeden neuen Aufrufer, und
	 * dreimal traf sie das Falsche: Die Elternauswahl verlor die archivierte
	 * Klammer und loeste das Haus beim naechsten Speichern heraus, die
	 * Doppelpruefung beim Anlegen sah die archivierte Erstversammlung nicht
	 * mehr, und am Einlass fehlte die archivierte Person in der Auswahl.
	 * Wer liest, entscheidet jetzt sichtbar: Listen filtern, Pruefungen und
	 * Abendabfragen nie.
	 */
	sicht: Sicht
): Promise<VersammlungsZeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Die Gemeinschaft nimmt ihre Versammlungen mit** — und zwar die ganze
		 * Gruppe (Migration 087, Auftraggeber 25.08.2026). Vorher stand hier
		 * `s.archived_at IS NULL`: Das sah genau eine Ebene weit. Eine
		 * Versammlung von «Sonnenhof A» blieb stehen, wenn die Klammer «MEG
		 * Sonnenhof» archiviert wurde.
		 *
		 * `gemeinschaft_archiviert_seit` reist mit, weil die Liste auf
		 * `/versammlungen` selbst filtert und zählt. Ohne dieses Feld kannte die
		 * Seite nur die Archivmarke der Versammlung — sie zeigte die zwölf
		 * Versammlungen einer archivierten Gemeinschaft weiter an, und der
		 * Schalter erschien nicht, weil sie keine davon als archiviert zählte.
		 */
		const zeilen = await tx<
			(MeetingZeile & { stweg_name: string; gemeinschaft_archiviert_seit: Date | null })[]
		>`
			SELECT m.*, s.name AS stweg_name, w.archived_at AS gemeinschaft_archiviert_seit
			/*
			 * **Die Funktion gehoert nicht in eine Join-Bedingung** (25.08.2026,
			 * dritte Reviewrunde).
			 *
			 * Als LEFT JOIN stweg w ON w.id = stweg_archiv_wegen(...) geschrieben
			 * darf der Planer sie in den Join-Filter ziehen und wertet sie dann
			 * einmal je **Zeilenpaar** aus statt einmal je Zeile. Gemessen bei 29
			 * Versammlungen und 38 Gemeinschaften: 1102 Auswertungen, 53 ms. Bei
			 * 800 Versammlungen und 200 Gemeinschaften waeren das 160 000 — und
			 * diese Abfrage traegt vier Seiten.
			 *
			 * Ein blosses LATERAL genuegt **nicht**: Der Planer zieht eine
			 * triviale Unterabfrage flach, und der schlechte Plan war zurueck
			 * (nachgemessen). OFFSET 0 ist die Optimierungsschranke, die das
			 * verhindert — die Funktion wird je aeusserer Zeile genau einmal
			 * ausgewertet, auch wenn dem Planer Hash- und Merge-Join genommen
			 * werden. Gemessen: 5.4 statt 53 ms.
			 */
			FROM meeting m
			JOIN stweg s ON s.id = m.stweg_id
			LEFT JOIN LATERAL (SELECT stweg_archiv_wegen(m.stweg_id) AS id OFFSET 0) k ON true
			LEFT JOIN stweg w ON w.id = k.id
			WHERE ${
				sicht === 'aktiv' ? tx`m.archived_at IS NULL AND w.id IS NULL` : tx`true`
			}
			ORDER BY m.meeting_date DESC, m.start_time DESC
		`;
		return zeilen.map((z) => ({
			...ausDb(z),
			gemeinschaftName: z.stweg_name,
			tagId: z.meeting_day_id,
			stelle: z.day_position,
			gemeinschaftArchiviertSeit: z.gemeinschaft_archiviert_seit?.toISOString() ?? null
		}));
	});
}

/**
 * Die möglichen Vorgängerinnen für eine Zweitversammlung.
 *
 * Nur Erstversammlungen derselben Gemeinschaft: Eine Zweitversammlung auf eine
 * Zweitversammlung folgen zu lassen, kennt Art. 712p nicht — die erleichterte
 * Beschlussfähigkeit gilt einmal, nicht kaskadierend.
 */
export async function holeMoeglicheVorgaengerinnen(
	operatorId: Id,
	stwegId: Id
): Promise<{ id: Id; datum: string; ort: string }[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; meeting_date: Date; location: string }[]>`
			SELECT id, meeting_date, location FROM meeting
			WHERE stweg_id = ${stwegId} AND tier = 'erste'
			  -- Eine Auswahlliste: Eine archivierte Erstversammlung als
			  -- Vorgängerin anzubieten hiesse, eine neue Zweitversammlung an
			  -- etwas zu hängen, das aus jeder Liste verschwunden ist
			  -- (25.08.2026, zweite Reviewrunde).
			  AND archived_at IS NULL
			ORDER BY meeting_date DESC
			LIMIT 50
		`;
		return zeilen.map((z) => ({ id: z.id, datum: tag(z.meeting_date), ort: z.location }));
	});
}

/**
 * Die Reglementsfrist der Gemeinschaft, aus derselben Transaktion.
 *
 * **Warum aus der Datenbank und nicht aus dem Formular** (dieselbe Begründung
 * wie beim Datum der Vorgängerin): Käme sie von aussen, liesse sich die Frist
 * umgehen, indem man eine kürzere mitschickt. `pruefeZweitversammlungsfrist`
 * weist zwar ab, was zu kurz ist — aber nur beim Hinterlegen, und hier wird
 * gerechnet, nicht hinterlegt.
 */
async function zweitfristVon(
	tx: postgres.TransactionSql,
	stwegId: Id
): Promise<Zweitversammlungsfrist | null> {
	const [z] = await tx<
		{ second_meeting_interval_days: number | null; second_meeting_interval_source: string | null }[]
	>`
		SELECT second_meeting_interval_days, second_meeting_interval_source
		FROM stweg WHERE id = ${stwegId}
	`;
	if (!z || z.second_meeting_interval_days === null) return null;
	return { tage: z.second_meeting_interval_days, fundstelle: z.second_meeting_interval_source };
}

/**
 * Rechnet die Fristvermerke der Zweitversammlungen nach, die auf `id` folgen.
 *
 * **Der Anlass** (Code-Review vom 24.09.2026, Befund 1). `fristvermerk` wird
 * beim Speichern der **zweiten** Versammlung gerechnet. Ein Datumswechsel an
 * der **ersten** löste bis dahin nichts aus, und beide dürfen im Entwurf stehen
 * — der Normalfall beim Planen. Die Folge ging in beide Richtungen, und die
 * zweite ist die schlimmere:
 *
 *   - Erste nach hinten geschoben: Der Abstand wird zu knapp, `interval_note`
 *     bleibt leer, und Einladung wie Protokoll gehen **ohne** Vermerk hinaus.
 *     Genau das Loch, das R-2b schliessen sollte.
 *   - Erste nach vorn geschoben: Die Frist ist wieder eingehalten, der
 *     gespeicherte Vermerk bleibt und behauptet weiter, die Beschlüsse seien
 *     anfechtbar. **Eine falsche Rechtsaussage, nicht bloss eine fehlende.**
 *
 * **Warum hier und nicht im Kern.** Die Rechnung selbst steht im Kern; was hier
 * steht, ist das Einsammeln der abhängigen Zeilen, und das braucht die
 * Datenbank. Dieselbe Stelle kennt den Weg schon vom Löschschutz her, der
 * ebenfalls über `previous_meeting_id` fragt.
 *
 * **Ohne Verlaufseintrag**, und das ist Absicht: Niemand hat die zweite
 * Versammlung geändert. Ihr Vermerk ist eine Ableitung aus zwei Daten, kein
 * Beschluss und keine Eingabe; ein `meeting.updated` an einer Versammlung, die
 * niemand angefasst hat, machte den Verlauf unlesbar. Die Änderung, die es zu
 * belegen gibt, steht am Vorgänger.
 *
 * ## Zwei Schranken, und beide hat erst diese Funktion nötig gemacht
 *
 * Sie stammen aus dem zweiten Code-Review vom 24.09.2026, der die Nachbesserung
 * selbst geprüft hat. Beide Lagen waren vorher unerreichbar: Ohne Nachrechnung
 * gab es an der abhängigen Zeile nichts anzufassen.
 *
 * **Die Vorgängerin darf nicht hinter ihre Nachfolgerin rutschen** (Befund 1).
 * `pruefeVersammlung` wirft `vorgaenger_spaeter` nur, wenn die **zweite**
 * Versammlung gespeichert wird. Wird stattdessen die **erste** nach hinten
 * geschoben, prüfte niemand etwas, und `fristvermerk` gibt für einen negativen
 * Abstand `null` zurück — die Nachrechnung hätte den Vermerk also stillschweigend
 * gelöscht und einen Datensatz hinterlassen, den der Kern als Datenfehler
 * ausschliesst: eine zweite Versammlung fünfundvierzig Tage vor ihrer ersten,
 * ohne Absage, ohne Vermerk, ohne Spur im Verlauf. Gemessen im Review.
 *
 * **Und was nicht mehr im Entwurf steht, wird nicht mehr angefasst** (Befund 2).
 * `aendereVersammlung` verlangt für die eigene Zeile `entwurf`, die Datenbank
 * sperrt nach dem Siegel `agenda_item`, `vote` und `minutes` — aber nicht
 * `meeting`. Die Nachrechnung hätte deshalb den Vermerk einer **versiegelten**
 * Zweitversammlung neu geschrieben, und zwar ohne Verlaufseintrag. Das
 * widerspricht dem Satz, der unverändert über `aendereVersammlung` steht: «Nach
 * der Freigabe ist Schluss … eine stille Änderung im System machte die Einladung
 * zur Falschauskunft.» Der Vermerk steht in genau dieser Einladung.
 *
 * **Beide Schranken sagen ab, statt still zu rechnen.** Das ist die Stelle, an
 * der das Werkzeug sperren darf: Es geht nicht um eine Rechtsfolge, über die die
 * Sitzungsleitung entscheidet, sondern darum, dass zwei Datensätze zueinander
 * passen müssen.
 */
async function schreibeAbhaengigeVermerke(
	tx: postgres.TransactionSql,
	id: Id,
	datum: string,
	reglement: Zweitversammlungsfrist | null
): Promise<void> {
	const abhaengige = await tx<{ id: string; meeting_date: Date; state: Versammlungszustand }[]>`
		SELECT id, meeting_date, state FROM meeting WHERE previous_meeting_id = ${id}
	`;
	for (const a of abhaengige) {
		const ihrDatum = tag(a.meeting_date);
		if (a.state !== 'entwurf') {
			throw new FachlicherFehler(
				'nachfolgerin_nicht_im_entwurf',
				`Die zweite Versammlung vom ${datumLang(ihrDatum)} steht nicht mehr im Entwurf. ` +
					'Ihr Fristvermerk hängt an diesem Datum und dürfte sich nicht mehr ändern. ' +
					'Lösen Sie zuerst die Verbindung zur zweiten Versammlung.',
				'datum'
			);
		}
		if (ihrDatum < datum) {
			throw new FachlicherFehler(
				'nachfolgerin_zu_frueh',
				`Die zweite Versammlung vom ${datumLang(ihrDatum)} läge dann vor der ersten. ` +
					'Verschieben Sie zuerst die zweite Versammlung.',
				'datum'
			);
		}
		await tx`
			UPDATE meeting SET interval_note = ${fristvermerk(datum, ihrDatum, reglement)}
			WHERE id = ${a.id}
		`;
	}
}

async function datumVon(
	tx: postgres.TransactionSql,
	id: Id | null | undefined
): Promise<string | null> {
	if (!id) return null;
	const zeilen = await tx<{ meeting_date: Date }[]>`
		SELECT meeting_date FROM meeting WHERE id = ${id}
	`;
	return zeilen[0] ? tag(zeilen[0].meeting_date) : null;
}

export async function erstelleVersammlung(
	handelnder: Handelnder & { operatorId: string },
	eingabe: VersammlungEingabe,
	/**
	 * Die unerledigten Traktanden dieser Versammlung mitnehmen — für die
	 * Folgeversammlung einer Vertagung.
	 *
	 * **In derselben Transaktion**, aus demselben Grund wie bei den
	 * Pflichttraktanden: Eine Versammlung, die entsteht und ihre Geschäfte erst
	 * im zweiten Schritt bekommt, steht bei einem Abbruch dazwischen leer da —
	 * und sieht mit ihren acht Pflichttraktanden vollständig aus.
	 */
	uebernimmAus: Id | null = null
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Gemeinschaft vorweg unter dem eigenen Betreiber suchen.** Der
		 * Fremdschlüssel `(stweg_id, operator_id)` hält eine fremde ohnehin ab,
		 * aber als roher Datenbankfehler und damit als 500-Seite. Die Kennung
		 * kommt aus dem Formular (`/versammlungen/neu`); eine fremde ist hier so
		 * unsichtbar wie eine, die es nicht gibt.
		 */
		const [gemeinschaft] = await tx`SELECT 1 FROM stweg WHERE id = ${eingabe.stwegId}`;
		if (!gemeinschaft) throw fremdeGemeinschaft('gemeinschaft');

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;

		// Das Datum der Vorgängerin kommt aus der Datenbank, nicht aus dem
		// Formular: Sonst liesse sich die Zehntagesfrist umgehen, indem man ein
		// falsches mitschickt.
		const vorgaengerDatum = await datumVon(tx, eingabe.vorgaengerId);

		const reglementsfrist = await zweitfristVon(tx, eingabe.stwegId);
		const u = legeVersammlungAn(
			id,
			handelnder.operatorId,
			{ ...eingabe, vorgaengerDatum },
			reglementsfrist
		);
		const v = u.ergebnis;

		await tx`
			INSERT INTO meeting (id, operator_id, stweg_id, state, meeting_date, start_time, location,
			                     kind, occasion, tier, previous_meeting_id, interval_note,
			                     operation_mode)
			VALUES (${v.id}, ${handelnder.operatorId}, ${v.stwegId}, ${v.zustand}, ${v.datum},
			        ${v.uhrzeit}, ${v.ort}, ${v.art}, ${v.anlass ?? null}, ${v.stufe},
			        ${v.vorgaengerId}, ${v.fristvermerk ?? null}, ${v.betriebsart})
		`;

		// In derselben Transaktion: Eine Vorlage, die erst «angewandt» werden
		// muss, wird beim ersten Mal vergessen — und dann fehlt im Protokoll die
		// Feststellung der Beschlussfähigkeit (Story 3.8).
		// Das Datum mitgeben: Daran findet die Vorlage die letzte Versammlung
		// dieser Gemeinschaft — deren Protokoll steht zur Genehmigung an, und der
		// Antrag nennt es mit seiner Prüfsumme.
		await legePflichttraktandenAn(tx, handelnder, v.id, v.stwegId, v.art, v.datum);

		if (uebernimmAus) {
			await uebertrageOffeneTraktanden(tx, handelnder, uebernimmAus, v.id);
		}

		return schreibeUebergang(tx, handelnder, u);
	});
}

export async function bearbeiteVersammlung(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	eingabe: VersammlungEingabe
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		const vorgaengerDatum = await datumVon(tx, eingabe.vorgaengerId);
		const reglementsfrist = await zweitfristVon(tx, ausDb(z).stwegId);
		const u = aendereVersammlung(ausDb(z), { ...eingabe, vorgaengerDatum }, reglementsfrist);
		const v = u.ergebnis;

		await tx`
			UPDATE meeting SET
				meeting_date = ${v.datum},
				start_time = ${v.uhrzeit},
				location = ${v.ort},
				kind = ${v.art},
				occasion = ${v.anlass ?? null},
				tier = ${v.stufe},
				previous_meeting_id = ${v.vorgaengerId},
				interval_note = ${v.fristvermerk ?? null},
				operation_mode = ${v.betriebsart}
			WHERE id = ${id}
		`;

		// Erst nach dem UPDATE: Die abhängigen Vermerke sollen auf dem **neuen**
		// Datum stehen, nicht auf dem alten.
		//
		// **Und nur, wenn sich das Datum wirklich geändert hat.** Wer den Ort oder
		// die Uhrzeit der Erstversammlung berichtigt, geht die Nachfolgerin nichts
		// an; die beiden Absagen in `schreibeAbhaengigeVermerke` dafür auszulösen
		// wäre eine Sperre ohne Anlass.
		if (v.datum !== tag(z.meeting_date)) {
			await schreibeAbhaengigeVermerke(tx, id, v.datum, reglementsfrist);
		}

		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Löscht eine Versammlung, die noch im Entwurf steht.
 *
 * Zwei Stufen, wie beim Aufnehmen in eine gemeinsame Versammlung: Ohne
 * `bestaetigt` kommt die Frage zurück, was verschwindet — als
 * `FachlicherFehler` mit dem Feld `bestaetigen`, damit die Seite sie als
 * Rückfrage zeigen kann und nicht als Fehler.
 *
 * Gelöscht wird über die Datenbankfunktion aus Migration 058, nicht mit einem
 * eigenen DELETE: Die Anwendungsrolle darf `meeting` nicht löschen, und diese
 * Schranke soll bleiben.
 */
export async function loescheVersammlung(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	bestaetigt = false
): Promise<{ traktanden: number; dateien: number; bezeichnung: string }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<
			{
				state: Versammlungszustand;
				/*
				 * Als Text, nicht als `date`. Der Treiber gibt eine `date`-Spalte als
				 * JavaScript-`Date` zurück, und `datumLang` erwartet «2026-10-08» —
				 * der Aufruf endete in einem `TypeError: iso.split is not a function`
				 * und riss das Löschen mit. Gefunden vom Datenbanktest.
				 */
				datum: string;
				stweg_id: string;
				name: string;
				tag: string | null;
				traktanden: number;
				dateien: number;
			}[]
		>`
			SELECT m.state, to_char(m.meeting_date, 'YYYY-MM-DD') AS datum,
			       m.stweg_id, g.name, d.label AS tag,
			       (SELECT count(*)::int FROM agenda_item a WHERE a.meeting_id = m.id) AS traktanden,
			       (SELECT count(*)::int FROM attachment t
			         WHERE (t.subject_type = 'meeting' AND t.subject_id = m.id)
			            OR (t.subject_type = 'agenda_item'
			                AND t.subject_id IN (SELECT id FROM agenda_item WHERE meeting_id = m.id))
			       ) AS dateien
			  FROM meeting m
			  JOIN stweg g ON g.id = m.stweg_id
			  LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
			 WHERE m.id = ${id}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Diese Versammlung gibt es nicht.', 'id');

		const nachfolge = await tx<{ id: string; datum: string; name: string }[]>`
			SELECT m.id, to_char(m.meeting_date, 'YYYY-MM-DD') AS datum, g.name
			  FROM meeting m JOIN stweg g ON g.id = m.stweg_id
			 WHERE m.previous_meeting_id = ${id}
		`;

		const bezeichnung = `${z.name}, ${datumLang(z.datum)}`;
		const befund = pruefeLoeschung({
			zustand: z.state,
			bezeichnung,
			folgeversammlungen: nachfolge.map((f) => ({
				id: f.id,
				bezeichnung: `${f.name}, ${datumLang(f.datum)}`
			})),
			gemeinsam: z.tag,
			haengtDran: { traktanden: z.traktanden, dateien: z.dateien }
		});

		if (!befund.erlaubt) {
			throw new FachlicherFehler('loeschen_gesperrt', befund.grund!, 'zustand');
		}
		if (!bestaetigt) {
			throw new FachlicherFehler('bestaetigen', befund.folgen, 'bestaetigen');
		}

		// Der Verlaufseintrag **vor** dem Löschen: Danach gibt es die Versammlung
		// nicht mehr, und der Eintrag trägt nur noch ihre Kennung. Was sie war,
		// steht deshalb in seinen Daten.
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungGeloescht,
				{ art: 'meeting', id },
				{
					gemeinschaft: z.name,
					datum: z.datum,
					traktanden: z.traktanden,
					dateien: z.dateien,
					gemeinsameVersammlung: z.tag
				}
			)
		);

		const [gezaehlt] = await tx<{ traktanden: number; dateien: number }[]>`
			SELECT * FROM versammlung_loeschen(${handelnder.operatorId}, ${id})
		`;

		return { ...gezaehlt, bezeichnung };
	});
}

export async function setzeBetriebsart(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	neue: Betriebsart,
	grund?: string
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		const u = wechsleBetriebsart(ausDb(z), neue, grund);
		await tx`UPDATE meeting SET operation_mode = ${u.ergebnis.betriebsart} WHERE id = ${id}`;
		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Schaltet die Frage am Einlass ein oder aus (Migration 108).
 *
 * **Kein Kernübergang wie die Betriebsart.** `wechsleBetriebsart` prüft, ob der
 * Zustand den Wechsel noch erlaubt, denn die Betriebsart entscheidet, wer
 * abstimmen darf; ab der Eröffnung steht sie fest. Dieser Schalter entscheidet
 * nur, ob am Eingang ein zweiter Knopf steht. Ihn während der Versammlung
 * umzulegen ändert nichts an dem, was schon vermerkt ist, und wer mitten im
 * Einlass merkt, dass doch alle digital abstimmen, soll die Frage loswerden
 * können, ohne die Versammlung anzuhalten.
 *
 * **Was er nicht tut: bestehende Vermerke aufheben.** Wer die Frage abschaltet,
 * nimmt niemandem den Vermerk weg; er hört nur auf, sie zu stellen. Ein
 * Schalter, der rückwirkend Vermerke löschte, änderte den Nachweis.
 */
export async function setzePapierfrage(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	fragen: boolean
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		/*
		 * **Nur solange der Eingang noch arbeitet** (09.09.2026, im zweiten
		 * Code-Review gefunden). Auf `meeting` liegt kein Siegelauslöser — der
		 * deckt Anwesenheit, Vollmacht, Durchgang, Stimme und Momentaufnahme, aber
		 * nicht die Versammlungszeile. Ohne diese Schranke liesse sich der
		 * Schalter an einer geschlossenen und versiegelten Versammlung umlegen,
		 * samt Verlaufseintrag. Er änderte dort nichts am Nachweis, aber ein
		 * Eintrag über eine Handlung, die es nach dem Siegel nicht geben darf,
		 * ist selbst ein falscher Nachweis.
		 */
		if (z.state !== 'freigegeben' && z.state !== 'laufend') {
			throw new FachlicherFehler(
				'papierfrage_zustand',
				'Die Frage am Einlass lässt sich nur einstellen, solange die Versammlung freigegeben ist oder läuft.',
				'fragen'
			);
		}

		await tx`UPDATE meeting SET ask_paper_ballot = ${fragen} WHERE id = ${id}`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.papierfrageGesetzt,
				{ art: 'meeting', id },
				{ fragen }
			)
		]);
		const [neu] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		return ausDb(neu);
	});
}

/**
 * Hält fest, wer den Vorsitz führte und wer das Protokoll schrieb.
 *
 * **Zwei freie Texte, keine Rolle** (26.08.2026, Auftraggeber: «Sitzungsleiter braucht
 * es, weil er ja im Protokoll stehen muss»). Der Vorsitz ist nicht zwingend der
 * Verwalter — ZGB Art. 712n Abs. 1 lässt die Versammlung anders beschliessen —,
 * und für die Protokollführung nennt der SVIT-Kommentar (Wermelinger 2023,
 * Rz. 112) ausdrücklich auch Dritte: «ein anwesender dinglich Berechtigter
 * (z.B. Nutzniesser) oder ein Dritter (z.B. Angestellter des Verwalters, Notar
 * usw.)». Ein Verweis auf `person` oder `app_user` bildete genau die Fälle
 * nicht ab, die im Saal vorkommen.
 *
 * **Keine Pflichtangabe.** Der gesetzliche Mindestinhalt des Protokolls sind
 * die Beschlüsse (Art. 712n Abs. 2, Rz. 127); alles Weitere kann nur die
 * Gemeinschaftsordnung verlangen. Eine Schranke, die eine Freigabe aufhielte,
 * wäre strenger als das Recht.
 *
 * Leerer Text wird zu `null`: «eingetragen, aber leer» wäre eine Angabe, die
 * niemand sieht, und der Unterschied fiele erst im Protokoll auf.
 */
export async function setzeVersammlungsleitung(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	angaben: { sitzungsleitung: string | null; protokollfuehrung: string | null },
	/**
	 * Der Stand, den das Formular beim Anzeigen vorfand.
	 *
	 * **Wozu.** Der Vorsitz wird nach der Sitzung eingetragen, oft von einer
	 * anderen Person als der, die das Protokoll schreibt — und dieselbe
	 * Versammlung liegt dann in zwei Fenstern offen. Ohne diesen Vergleich setzt
	 * das später abgeschickte Formular das andere still zurück.
	 *
	 * Ohne Angabe wird nicht geprüft; die Regel steht in
	 * `$lib/domain/schreibstand`.
	 */
	bekannt?: Schreibstand
): Promise<void> {
	const { sitzungsleitung: vorsitz, protokollfuehrung: fuehrung } = pruefeLeitungsnamen(angaben);

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		// `FOR UPDATE`: Zwischen Lesen und Schreiben liegt die Konfliktprüfung. Ohne
		// Sperre lesen zwei gleichzeitige Vorgänge denselben Stand, beide finden
		// nichts Veraltetes, und der zweite überschreibt den ersten still.
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id} FOR UPDATE`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		const bisher = ausDb(z);

		/*
		 * **Auch nach dem Siegel — und das ist Absicht.**
		 *
		 * Die erste Fassung sperrte hier ab `versiegelt` (26.08.2026). Das war
		 * falsch, und zwar genau andersherum, als es aussah: Das Protokoll ist
		 * **nicht Teil des Siegels**. `siegel.ts` schreibt es ausdrücklich ins
		 * Manifest — «Es entsteht nach der Sitzung, wird redigiert und von der
		 * nächsten Versammlung genehmigt. Es wird getrennt geführt und ist nicht
		 * Teil dieses Siegels.» Und die Protokollseite fordert selbst auf, **zuerst
		 * zu versiegeln**, damit der Siegelabschnitt in den Entwurf kommt.
		 *
		 * Der übliche Ablauf ist damit: schliessen, versiegeln, Protokoll
		 * schreiben, Vorsitz eintragen, Entwurf erzeugen. Eine Sperre ab
		 * `versiegelt` verbietet nicht den Missbrauch, sondern den Normalfall — und
		 * unumkehrbar, weil es kein Entsiegeln gibt.
		 *
		 * Was den Namen trotzdem nachweisbar hält, ist der Verlauf: Jede Änderung
		 * steht dort mit vorher und nachher, und `audit_entry` ist nur anfügbar.
		 * Dasselbe gilt für den Protokolltext selbst, der aus demselben Grund
		 * bearbeitbar bleibt.
		 *
		 * Archiviert ist etwas anderes: Dort ist die Versammlung aus dem Weg
		 * geräumt, und wer sie ändern will, holt sie zuerst hervor.
		 */
		if (bisher.archiviertAm) {
			throw new FachlicherFehler(
				'archiviert',
				'Diese Versammlung liegt im Archiv. Holen Sie sie zuerst hervor.',
				'id'
			);
		}

		const gespeichert = {
			sitzungsleitung: bisher.sitzungsleitung ?? null,
			protokollfuehrung: bisher.protokollfuehrung ?? null
		};
		const neuerStand = { sitzungsleitung: vorsitz, protokollfuehrung: fuehrung };
		const veraltet = veralteteFelder(gespeichert, bekannt, neuerStand);
		if (veraltet.length > 0) {
			throw new Schreibkonflikt(gespeichert, konfliktsatz(veraltet, gespeichert, LEITUNGSFELDER));
		}

		// Vorher und nachher, nicht bloss die Feldnamen: Der Verlauf ist hier das
		// einzige, was den früheren Namen noch kennt — dieselbe Form wie
		// `aendereVersammlung` unter derselben Ereignisart.
		const felder: Record<string, { vorher: string | null; nachher: string | null }> = {};
		if ((bisher.sitzungsleitung ?? null) !== vorsitz) {
			felder.sitzungsleitung = { vorher: bisher.sitzungsleitung ?? null, nachher: vorsitz };
		}
		if ((bisher.protokollfuehrung ?? null) !== fuehrung) {
			felder.protokollfuehrung = { vorher: bisher.protokollfuehrung ?? null, nachher: fuehrung };
		}
		if (Object.keys(felder).length === 0) return;

		// `updated_at` setzt der Auslöser `meeting_updated_at` (Migration 011);
		// von Hand gesetzt sähe es aus, als bräuchte die Tabelle das.
		await tx`
			UPDATE meeting
			   SET chair_label = ${vorsitz}, minutes_keeper_label = ${fuehrung}
			 WHERE id = ${id}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.versammlungGeaendert, { art: 'meeting', id }, { felder })
		);
	});
}

/**
 * Wie viele Parteien in dieser Gemeinschaft **eine Stimme haben** — also
 * mindestens eine Einheit halten.
 *
 * **Nicht alle Zeilen der Tabelle** (Bedienbarkeitsprüfung 05.09.2026,
 * Befund 8 der Bewirtschaftersicht). Die Zahl stand als «7 Parteien erfasst»
 * beim Vorschlag der Abstimmungsweise, während die Freigabe zwei Klicks weiter
 * «5 Parteien» meldete. Beide sagten «Parteien» und zählten Verschiedenes:
 * hier jede Zeile, dort die mit Einheiten.
 *
 * Gemeint ist hier die zweite Menge, und zwar nicht nur der Einheitlichkeit
 * wegen: Die Zahl steuert `betriebsartVorschlag`, dessen Schwelle bei fünf
 * liegt («bis und mit fünf Parteien passen alle an einen Tisch»). Eine Zeile
 * ohne Einheit sitzt dort nicht, und ein Mitglied einer Eigentümergemeinschaft
 * auch nicht — die Stimme übt die Gemeinschaft aus. Mit der alten Zählung kippte
 * der Vorschlag bei einem Ehepaar von «einfach» auf «geführt».
 */
export async function zaehleParteien(
	operatorId: Id,
	stwegId: Id,
	/**
	 * Der Tag, auf den gezählt wird — der Versammlungstag.
	 *
	 * **Ohne ihn käme der Befund über die Historie zurück** (Code-Review
	 * 06.09.2026): `stimmkraftAnsicht` rechnet auf einen Stichtag, diese
	 * Zählung tat es nicht. Eine Partei, die verkauft hat, hielte hier ewig
	 * eine Einheit, und die beiden Zahlen liefen wieder auseinander — genau
	 * das, was der Befund beheben sollte.
	 */
	stichtag: string
): Promise<number> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl
			  FROM party p
			 WHERE p.stweg_id = ${stwegId}
			   AND EXISTS (
			       SELECT 1
			         FROM unit_ownership o
			         JOIN unit u ON u.id = o.unit_id
			        WHERE o.party_id = p.id
			          AND u.stweg_id = p.stweg_id
			          AND o.valid_from <= ${stichtag}::date
			          AND (o.valid_to IS NULL OR o.valid_to > ${stichtag}::date)
			   )
		`;
		return Number(z?.anzahl ?? 0);
	});
}

/**
 * Eröffnet die Versammlung.
 *
 * Ab hier zählt die Anwesenheit, und die Momentaufnahme ist unveränderlich: Die
 * Rücknahme der Freigabe ist damit versperrt (AD-3).
 */
export async function eroeffneVersammlung(
	handelnder: Handelnder & { operatorId: string },
	id: Id
): Promise<{ versammlung: Versammlung; anzeigecode: string }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Gesperrt, weil eine Milderung vor Beginn dieselbe Zeile sperrt
		// (`achteEinladungsmehr`): Ohne Sperre fiele eine Milderung zwischen den
		// Verlaufseintrag unten und den Zustandswechsel und stünde im Saal ohne
		// Eintrag und ohne Warnung. Bis 07.10.2026 hiess es «zwischen das
		// Zurückstellen und den Zustandswechsel»; den Rückfall gibt es nicht mehr.
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id} FOR UPDATE`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		const u = eroeffne(ausDb(z));
		// Vor dem Zustandswechsel: Danach hält die Sperre aus Migration 144 die
		// Untergrenze fest (Produktentscheid 06.10.2026, `einladungsmehr.ts`).
		// Seit dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen»)
		// schreibt der Aufruf nur den Verlauf und leert das Mehr davor; das
		// mildere Mehr bleibt.
		await regleEinladungsmehrBeimEroeffnen(tx, handelnder, id);
		await tx`UPDATE meeting SET state = 'laufend', opened_at = now() WHERE id = ${id}`;
		const versammlung = await schreibeUebergang(tx, handelnder, u);
		const anzeigecode = await setzeAnzeigecodeIn(tx, handelnder, id);
		return { versammlung, anzeigecode };
	});
}

/**
 * Erzeugt den Anzeigecode für die Präsentationssicht.
 *
 * Er erscheint **einmal**: In der Datenbank steht nur sein Prüfwert (NFR-5).
 * Geht er verloren, wird ein neuer erzeugt, und der alte gilt nicht mehr —
 * dieselbe Regel wie bei der Zugangskarte, aus demselben Grund.
 */
async function setzeAnzeigecodeIn(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	id: Id
): Promise<string> {
	const code = anzeigecodeAus(new Uint8Array(randomBytes(ANZEIGECODELAENGE * 2)));
	await tx`
		UPDATE meeting
		SET display_code_hash = ${createHash('sha256').update(normalisiere(code)).digest('hex')},
		    display_code_set_at = now()
		WHERE id = ${id}
	`;
	await schreibeVerlauf(
		tx,
		handelnder,
		// Der Code selbst steht nicht im Verlauf: Der ist für Auswertung und Beleg
		// gedacht, nicht als zweiter Speicher für Geheimnisse.
		ereignis(EREIGNISARTEN.anzeigecodeErzeugt, { art: 'meeting', id })
	);
	return code;
}

/** Einen neuen Anzeigecode erzeugen — der alte wird damit wertlos. */
export async function erneuereAnzeigecode(
	handelnder: Handelnder & { operatorId: string },
	id: Id
): Promise<string> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${id}`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		if (!['freigegeben', 'laufend'].includes(z.state)) {
			throw new FachlicherFehler(
				'zustand_unpassend',
				z.state === 'entwurf'
					? 'Die Präsentationssicht gibt es erst ab der Freigabe.'
					: 'Die Versammlung ist geschlossen. Ein Code für die Leinwand zeigte nichts mehr.',
				'zustand'
			);
		}
		return setzeAnzeigecodeIn(tx, handelnder, id);
	});
}

export interface Anzeigebefund {
	gueltig: boolean;
	operatorId?: Id;
	meetingId?: Id;
	grund?: string;
}

/**
 * Löst einen Anzeigecode auf — ohne Mandantenkontext.
 *
 * Wer die Präsentationssicht auf dem Beamer öffnet, ist nicht angemeldet. Wie
 * beim Zugangscode läuft die Abfrage deshalb über eine Funktion mit
 * `SECURITY DEFINER`.
 *
 * **`zaehlen: false` nur für das Nachprüfen im Herzschlag von `/p/strom`**
 * (A3, 15.10.2026). Er prüft alle fünfzehn Sekunden einen Code, der beim
 * Verbinden schon gezählt durchging; gezählt schriebe jede offene Wand dabei
 * fortlaufend «gelungene» Versuche in den Zähler. Der Load von `/p` und der
 * Aufbau des Stroms zählen weiter, obwohl auch sie den Code aus dem Keks
 * lesen: Den Keks setzt, wer will, und ungezählt wäre dort Probieren
 * unsichtbar. Nach dem Erneuern stehen deshalb je Wand ein oder zwei
 * vergebliche Versuche im Zähler, aus dem Wiederaufbau und dem Load.
 */
export async function loeseAnzeigecodeAuf(
	eingabe: string,
	{ zaehlen = true }: { zaehlen?: boolean } = {}
): Promise<Anzeigebefund> {
	let code: string;
	try {
		code = pruefeAnzeigecode(eingabe);
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			// Auch eine Eingabe, die schon an der Form scheitert, ist ein Versuch
			// (Audit B-05).
			if (zaehlen) await haltCodeversuchFest('anzeigecode', false);
			return { gueltig: false, grund: fehler.message };
		}
		throw fehler;
	}

	const [z] = await sql<
		{ operator_id: string; meeting_id: string; meeting_state: string; closed_at: Date | null }[]
	>`
		SELECT * FROM anzeigecode_aufloesen(
			${createHash('sha256').update(code).digest('hex')}
		)
	`;
	// Der Code stimmte oder nicht — die geschlossene Versammlung darunter ist ein
	// eigener Fall und kein vergeblicher Versuch (Audit B-05).
	if (zaehlen) await haltCodeversuchFest('anzeigecode', Boolean(z));

	if (!z) {
		return {
			gueltig: false,
			grund:
				'Dieser Code gilt nicht. Prüfen Sie, ob Sie ihn richtig abgetippt haben — sonst ' +
				'erzeugt die Sitzungsleitung einen neuen.'
		};
	}
	/*
	 * **Auch nach dem Schluss — aber nicht für immer** (21.08.2026).
	 *
	 * Vorher endete die Leinwand hier: Im selben Augenblick, in dem die
	 * Sitzungsleitung schloss, fiel die Wand vor dem ganzen Saal auf die
	 * Code-Eingabe zurück. Seit es eine Abschlussseite gibt, ist das die falsche
	 * Stelle zum Aufhören — dort steht, was beschlossen wurde, und genau danach
	 * schauen alle.
	 *
	 * **Die Stunde danach** ist der Saal: aufstehen, nachlesen, hinausgehen. Was
	 * die Wand dann zeigt, steht ohnehin im Protokoll (Nummern, Titel, Ergebnis;
	 * keine Namen, AD-11). Danach verfällt der Code — er wurde im Saal
	 * vorgelesen, und ein Zettel in einer Tasche soll nicht Wochen später noch
	 * Beschlüsse hergeben.
	 *
	 * Der Entwurf bleibt aussen vor: Vor der Freigabe gibt es keine Versammlung,
	 * die man an die Wand werfen könnte.
	 */
	/*
	 * **Versiegelt zählt wie geschlossen** (04.09.2026). Hier stand nur
	 * `=== 'geschlossen'`, und `versiegelt` fiel in den Zweig darunter: Die
	 * Leinwand meldete «Diese Versammlung ist noch nicht freigegeben» und fiel
	 * auf die Code-Eingabe zurück, mit demselben Code, der eben noch die
	 * Beschlussliste zeigte. Genau davor warnt der Entscheid in
	 * `schliesseVersammlung` weiter unten: «vor dem ganzen Saal».
	 */
	if (abgeschlossen(z.meeting_state as Versammlungszustand)) {
		const geschlossenSeit = z.closed_at ? Date.now() - z.closed_at.getTime() : Infinity;
		if (geschlossenSeit > NACHLAUF_MS) {
			return {
				gueltig: false,
				grund: 'Diese Versammlung ist geschlossen. Was beschlossen wurde, steht im Protokoll.'
			};
		}
	} else if (!['freigegeben', 'laufend'].includes(z.meeting_state)) {
		return { gueltig: false, grund: 'Diese Versammlung ist noch nicht freigegeben.' };
	}
	return { gueltig: true, operatorId: z.operator_id, meetingId: z.meeting_id };
}

/**
 * Schliesst die Versammlung und entwertet dabei alle Zugänge.
 *
 * Das Entwerten ist fachlich nicht nötig — `gibtZutritt` prüft ohnehin den
 * Zustand der Versammlung. Es macht den Zustand in der Datenbank ehrlich: Ein
 * als «gültig» geführter Zugang zu einer geschlossenen Versammlung wäre eine
 * irreführende Angabe, und wer die Liste liest, müsste die Regel im Kopf haben.
 */
export async function schliesseVersammlung(
	handelnder: Handelnder & { operatorId: string },
	id: Id
): Promise<{ versammlung: Versammlung; entwertet: number; geschlosseneAbstimmungen: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Erst sperren, dann lesen** (Pentest-Runde M7, Befunde M7-A1 und
		 * P1-01). Ohne Sperre sah der Schluss einen Durchgang nicht, den ein
		 * gleichzeitiges Eröffnen schon angelegt, aber noch nicht festgeschrieben
		 * hatte, wartete erst beim UPDATE und schloss die Versammlung mit einem
		 * offenen Durchgang. Zwei Schlüsse schrieben zwei Einträge.
		 *
		 * **Die Reihenfolge: Traktanden, Versammlung, Durchgänge.** Eröffnen und
		 * Beschluss von Hand sperren zuerst ihr Traktandum (`FOR UPDATE`), danach
		 * die Versammlung und erst dann Durchgänge. Der Schluss hält dieselbe
		 * Folge, und zwar über **alle** Traktanden der Versammlung, nach Kennung
		 * geordnet, damit zwei Schlüsse einander nicht kreuzen.
		 *
		 * **Warum alle und nicht nur die mit offenem Durchgang** (Codeprüfung
		 * F6, gemessen). Der Schluss braucht das Traktandum jedes Durchgangs, den
		 * er schliesst: `schliesseInTransaktion` schreibt die Zeile zweimal
		 * (schliessen, verkünden), und beim zweiten Mal prüft PostgreSQL den
		 * Fremdschlüssel aufs Traktandum, weil die Zeile aus der eigenen
		 * Transaktion stammt; das ist eine Schlüsselsperre und wartet auf jedes
		 * `FOR UPDATE`. Ein Durchgang, den ein gleichzeitiges Eröffnen erst
		 * festschreibt, während der Schluss an der Versammlung wartet, ist vorher
		 * nicht zu sehen. Hielt danach ein Beschluss von Hand dessen Traktandum
		 * und wartete auf die Versammlung, standen beide: 40P01
		 * (`abschluss-rennen.test.ts`, drei Läufe zugleich). Sperrt der Schluss
		 * alle Traktanden vorab, wartet er schon dort, bis Eröffnen oder
		 * Beschluss von Hand fertig ist.
		 *
		 * Der Widerspruch (`haltWiderspruchFest`) sperrt die Versammlung nicht;
		 * er nimmt am Traktandum nur die Schlüsselsperre der
		 * Fremdschlüsselprüfung, und die verträgt sich mit der Sperre hier.
		 *
		 * `FOR NO KEY UPDATE` an beiden Stellen: Es wartet auf jedes `FOR UPDATE`
		 * (am Traktandum Eröffnen und Beschluss von Hand, an der Versammlung das
		 * Siegel) und auf jedes zweite Schliessen, lässt aber
		 * Fremdschlüsselprüfungen durch, wie beim Eröffnen. Bearbeitungen eines
		 * Traktandums warten die paar Millisekunden des Schlusses ab.
		 *
		 * **Ein Durchgang, der erst nach dem Sperren festgeschrieben wird,** ist
		 * kein Loch: Sein Eröffnen hält die Versammlung bis zum Festschreiben,
		 * der Schluss wartet dort und sieht ihn danach unter READ COMMITTED in
		 * `schliesseOffeneAbstimmungen`.
		 *
		 * **Hingenommen:** Wege, die zuerst die Versammlung sperren und danach
		 * ein Traktandum schreiben (`eroeffneVersammlung`), prüfen vorher den
		 * Zustand und schreiben in einer laufenden Versammlung kein Traktandum.
		 * Täte es einer, bräche PostgreSQL einen der zwei Läufe mit 40P01 ab,
		 * ohne dass etwas geschrieben wäre.
		 */
		await tx`
			SELECT 1 FROM agenda_item WHERE meeting_id = ${id} ORDER BY id FOR NO KEY UPDATE
		`;
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id} FOR NO KEY UPDATE`;
		if (!z) throw new Error('Versammlung nicht gefunden');
		// Vor dem Mitschliessen: Ein zweiter Schluss bekommt hier die Absage,
		// bevor er etwas anfasst.
		const u = schliesse(ausDb(z), 0);

		/*
		 * **Der Anzeigecode bleibt gültig** (berichtigt am 21.08.2026).
		 *
		 * Bis hierher setzte das Schliessen `display_code_hash = NULL`, mit der
		 * Begründung, die Leinwand zeige danach nichts mehr, was nicht ohnehin im
		 * Protokoll steht. Seit es eine Abschlussseite gibt, stimmt der Schluss
		 * nicht mehr: «Auf der Präsentationssicht braucht es dann eine
		 * Abschlussseite. Eventuell mit den Auswertungen der
		 * Traktandenabstimmungen?» Mit entwertetem Code fiel die Wand im selben
		 * Augenblick auf die Code-Eingabe zurück — vor dem ganzen Saal.
		 *
		 * Preisgegeben wird dadurch nichts: Die Abschlussseite zeigt Nummern,
		 * Titel und Ergebnis, also genau das, was das Protokoll ohnehin trägt, und
		 * keine Namen (AD-11). Die **Zugänge der Teilnehmer** werden weiterhin
		 * entwertet — das ist etwas anderes, denn an ihnen hängt die
		 * Stimmberechtigung.
		 */

		// Offene Abstimmungen werden mitgeschlossen und nicht als Hindernis
		// vorgehalten: Wer im Saal die Versammlung schliesst, hat sie beendet, und
		// eine Sperre an dieser Stelle liesse eine Abstimmung für immer offen
		// stehen. Der Übergang erfährt deshalb null offene — sie sind es dann auch.
		const offene = await schliesseOffeneAbstimmungen(tx, handelnder, id);

		// An den Zustand gebunden: hält auch, wenn ein künftiger Weg die Sperre
		// oben vergisst.
		const [geschlossen] = await tx<{ id: string }[]>`
			UPDATE meeting SET state = 'geschlossen', closed_at = now(),
			                   current_agenda_item_id = NULL,
			                   current_agenda_item_at = NULL
			WHERE id = ${id} AND state = 'laufend'
			RETURNING id
		`;
		if (!geschlossen) {
			throw new FachlicherFehler(
				'zustand_unpassend',
				'Die Versammlung läuft nicht mehr und lässt sich deshalb nicht schliessen.',
				'zustand'
			);
		}

		const entwertet = await entwerteInTransaktion(tx, id);

		const versammlung = await schreibeUebergang(tx, handelnder, u);
		return { versammlung, entwertet: entwertet.length, geschlosseneAbstimmungen: offene };
	});
}

/**
 * Vertagt eine Versammlung und legt die Folgeversammlung an: die zweite nach
 * ZGB Art. 712p Abs. 2, oder eine neue erste, wenn die vertagte an diesem
 * Abend schon beschlussfähig war (C3, F4c; `folgestufeNachVertagung`).
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «Wenn nur eine von fünf einheiten
 * beschlussfähig sind, wird die Sitzung mit der beschlussfähigen Gemeinschaft
 * durchgeführt. Die anderen brauchen einen neuen Termin, frühestens in 10 Tage
 * später. Wobei auch die Gemeinschaft entscheiden kann, die Sitzung zu
 * verschieben.»
 *
 * **Warum das eine Handlung ist und nicht zwei.** Die Bausteine gab es alle
 * schon — schliessen, anlegen, Stufe, Vorgängerin, Frist. Was fehlte, war der
 * Weg von der Feststellung «nicht beschlussfähig» zur zweiten Versammlung. Wer
 * ihn von Hand ging, legte eine neue Versammlung an und setzte das Datum; Stufe
 * und Vorgängerin blieben leer, weil das Formular sie gar nicht anbietet
 * (`/versammlungen/neu` setzt fest `stufe: 'erste'`). Dann sah die zweite
 * Versammlung aus wie eine erste, und die Anwendung verlangte ein Quorum, das
 * das Gesetz für sie nicht mehr verlangt.
 *
 * **Eine vertagte Versammlung hat stattgefunden.** Sie wird geschlossen wie
 * jede andere — mit einer eigenen Ereignisart, damit im Protokoll später steht,
 * ob die Geschäfte erledigt wurden oder ob es nicht ging.
 *
 * Der Grund ist Pflicht: «nicht beschlussfähig» und «die Versammlung hat es so
 * beschlossen» sind zwei verschiedene Sachverhalte und gehören ins Protokoll.
 * Die Stufe der Folgeversammlung hängt nicht am Grund, sondern daran, ob die
 * Versammlung an diesem Abend beschlussfähig war: Eine nie beschlussfähige
 * hatte die ungenügende Beteiligung nach Abs. 2, gleich aus welchem Grund
 * vertagt wird.
 */
export async function vertageVersammlung(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	eingabe: {
		grund: string;
		abstandTage?: number;
		/**
		 * Ein fester Folgetermin statt des berechneten Abstands.
		 *
		 * Gebraucht beim gemeinsamen Abend: Werden vier Häuser zusammen vertagt,
		 * bekommen sie **einen** neuen Termin (Auftraggeber, 25.08.2026: «Die anderen
		 * brauchen einen neuen Termin, frühestens in 10 Tage später»). Ohne feste
		 * Vorgabe rechnete jedes Haus von seinem eigenen Datum aus — was am selben
		 * Abend meist dasselbe ergibt, aber eben nur meist.
		 *
		 * **Ein zu früher Termin scheitert nicht**, seit R-2b das Begründungsfeld
		 * entfernt hat (24.09.2026): `pruefeVersammlung` weist nur noch einen
		 * negativen Abstand ab, also die zweite Versammlung **vor** der ersten.
		 * Ein zu knapper Abstand wird erfasst und bekommt den Fristvermerk — nach
		 * der Frist dieser Gemeinschaft, gesetzlich oder aus dem Reglement.
		 */
		datum?: string;
	}
): Promise<{ vertagt: Versammlung; folge: Versammlung; folgestufe: Versammlungsstufe }> {
	const grund = eingabe.grund?.trim() ?? '';
	if (zeichenzahl(grund) < 3) {
		throw new FachlicherFehler(
			'grund_fehlt',
			'Warum vertagt wird, gehört ins Protokoll — «nicht beschlussfähig» ist etwas anderes als «die Versammlung hat es beschlossen».',
			'grund'
		);
	}

	const alt = await holeVersammlung(handelnder.operatorId, id);
	if (!alt) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
	if (alt.stufe === 'zweite') {
		throw new FachlicherFehler(
			'schon_zweite',
			'Das ist bereits die zweite Versammlung. Eine dritte kennt ZGB Art. 712p nicht — hier braucht es eine neue erste Versammlung.',
			'stufe'
		);
	}

	/*
	 * **Vertagt wird nur, was läuft** — und das ist keine Förmlichkeit.
	 *
	 * ZGB Art. 712p Abs. 2 knüpft die erleichterte Zweitversammlung an eine
	 * **ungenügende Beteiligung an der ersten**. Dafür muss die erste
	 * stattgefunden haben. Wird eine Versammlung abgesagt, bevor sie eröffnet
	 * ist, ist die neue weiterhin die **erste** — mit dem vollen Quorum nach
	 * Abs. 1. Liesse man hier den Entwurf oder die freigegebene Versammlung zu,
	 * entstünde eine «zweite», an der ein Drittel genügte, obwohl niemand je
	 * zusammengekommen war. Die dort gefassten Beschlüsse wären anfechtbar, und
	 * die Anwendung hätte den Fehler selbst herbeigerechnet.
	 *
	 * Wer einen Termin verschieben will, ändert das Datum — dafür gibt es die
	 * Angabenseite.
	 */
	verlangeZustand(alt, ['laufend'], 'vertagen');

	/*
	 * **War sie an diesem Abend schon beschlussfähig, wird die Folgeversammlung
	 * eine neue erste** (C3, F4c; `folgestufeNachVertagung`). Gelesen vor dem
	 * Schliessen, das offene Durchgänge aufräumt.
	 */
	const folgestufe = folgestufeNachVertagung(
		alt.stufe,
		await alsBetreiber(handelnder.operatorId, (tx) => warZeitweiseBeschlussfaehigIn(tx, id))
	);

	// Eine neue erste hat keine Vorgängerin, also prüft `pruefeVersammlung` die
	// Reihenfolge nicht. Die Schranke steht deshalb hier, vor dem Schliessen,
	// für beide Stufen, damit eine Absage keine geschlossene Versammlung ohne
	// Folge hinterlässt (Codeprüfung F4c Block 2, N1 und zweiter Durchgang, 4).
	// Auch ein negativer Abstand legte sie vor die vertagte (DeepSeek-Review
	// F4c Block 2, N-2); heute gibt ihn kein Aufrufer.
	if ((eingabe.datum && eingabe.datum < alt.datum) || (!eingabe.datum && (eingabe.abstandTage ?? 0) < 0)) {
		throw new FachlicherFehler(
			'vorgaenger_spaeter',
			'Die Folgeversammlung liegt vor der vertagten Versammlung.',
			'datum'
		);
	}

	// Erst schliessen: `schliesseVersammlung` prüft den Zustand und räumt
	// Zugänge und offene Abstimmungen auf. Dieselbe Mechanik wie am regulären
	// Schluss — vertagt oder erledigt, der Saal ist danach leer.
	await schliesseVersammlung(handelnder, id);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.versammlungVertagt,
				{ art: 'meeting', id },
				{ grund, stufe: alt.stufe, folgestufe }
			)
		]);
		return { vertagt: alt };
	}).then(async ({ vertagt }) => {
		// Nur lesen, wenn sie gebraucht wird: Am gemeinsamen Abend ist das Datum
		// immer vorgegeben, und die Abfrage wäre je Haus eine Transaktion ohne
		// Wirkung (Code-Review 24.09.2026, Befund 11).
		const vertagungsfrist =
			eingabe.datum || eingabe.abstandTage
				? null
				: (await alsBetreiber(handelnder.operatorId, (tx) => zweitfristVon(tx, vertagt.stwegId)))
						?.tage;
		const entwurf = folgeversammlung(
			{
				id: vertagt.id,
				stwegId: vertagt.stwegId,
				datum: vertagt.datum,
				uhrzeit: vertagt.uhrzeit,
				ort: vertagt.ort,
				art: vertagt.art,
				anlass: vertagt.anlass,
				betriebsart: vertagt.betriebsart
			},
			// **Die Reglementsfrist steuert auch den Vorschlag** (Migration 122).
			// Ohne sie schlüge die Vertagung den elften Tag vor, während der
			// Fristvermerk der so entstandenen Versammlung sofort sagt, sie sei zu
			// früh — das Werkzeug widerspräche sich in einem Arbeitsgang.
			eingabe.abstandTage ?? geltendeZweitfrist(vertagungsfrist) + 1,
			// Auch eine neue erste bekommt diesen Vorschlag, denn die Maske zeigt
			// ihn vorab (`fruehesterZweitTermin`). Ein Termin nach der
			// Einladungsfrist einer ersten ist Pendenz.
			folgestufe
		);
		if (eingabe.datum) entwurf.datum = eingabe.datum;

		const folge = await erstelleVersammlung(
			handelnder,
			entwurf,
			/*
			 * **Die Geschäfte kommen mit.** Ohne dies bekam die zweite Versammlung
			 * nur ihre Pflichttraktanden — acht Zeilen, die vollständig aussehen,
			 * und keines der Geschäfte, wegen deren Unerledigtheit sie überhaupt
			 * einberufen wird (ZGB Art. 712p Abs. 2). Was mitkommt und was nicht,
			 * steht bei `uebertrageOffeneTraktanden`.
			 */
			vertagt.id
		);
		return { vertagt, folge, folgestufe };
	});
}

/** Stellt die Versammlung auf ein Traktandum — die eine Wahrheit nach AD-10. */
export async function stelleAufTraktandum(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	traktandumId: Id | null
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		if (traktandumId) {
			const [t] = await tx<{ id: string }[]>`
				SELECT id FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${id}
			`;
			if (!t) {
				throw fremdesTraktandum('traktandumId');
			}
		}

		const u = setzeAktuellesTraktandum(ausDb(z), traktandumId);
		/*
		 * **Der Zeitpunkt gehoert dazu** (Migration 084). Die gemeinsame Wand zeigt
		 * den zuletzt aufgerufenen Punkt des Abends; ohne ihn fiel sie bei
		 * Gleichstand auf die alphabetische Reihenfolge der Haeuser zurueck und
		 * blieb dort stehen. Der CHECK in der Datenbank haelt beides zusammen.
		 */
		await tx`
			UPDATE meeting
			   SET current_agenda_item_id = ${traktandumId},
			       current_agenda_item_at = ${traktandumId ? tx`now()` : null}
			 WHERE id = ${id}
		`;
		return schreibeUebergang(tx, handelnder, u);
	});
}

/**
 * Unterbricht die Versammlung — oder nimmt die Unterbrechung zurück.
 *
 * **Der Anlass** (Auftraggeber, 21.08.2026): «Für die Pause braucht es einen eigenen
 * Knopf bei der Steuerung. […] Der Pausenschalter könnte so sein, dass wenn
 * aktiv den Inhalt übernimmt und auf der Präsi-Ansicht überlagert bis der
 * Schalter aus ist. Pause würde auch eine Abstimmung unterbrechen, wenn diese
 * bspw. ungeplant ist (notfall, störung oder so).»
 *
 * **Was sie nicht tut:** schliessen. Ein offener Durchgang bleibt offen, die
 * abgegebenen Stimmen bleiben stehen, und nach der Pause geht es weiter, wo es
 * aufgehört hat. Gesperrt ist nur das Weiterstimmen — sonst gäbe jemand mit
 * offener Seite seine Stimme in die Pause hinein ab, und niemand im Saal hätte
 * es gesehen.
 */
export async function setzePause(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	pause: { an: boolean; text?: string | null }
): Promise<Versammlung> {
	const text = pause.text?.trim() || null;
	if (text && zeichenzahl(text) > 200) {
		throw new FachlicherFehler(
			'text_zu_lang',
			'Ein Satz genügt — er steht auf der Leinwand, nicht im Protokoll.',
			'pausentext'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		verlangeZustand({ zustand: z.state }, ['laufend'], 'unterbrechen');

		const [neu] = await tx<MeetingZeile[]>`
			UPDATE meeting
			   SET paused_at = ${pause.an ? tx`now()` : null},
			       pause_text = ${pause.an ? text : null}
			 WHERE id = ${id}
			RETURNING *
		`;

		/*
		 * **Beginn und Ende der Pause gespeichert** (Produktentscheid
		 * 08.10.2026, Migration 153). Bis dahin ging das Ende mit dem Leeren
		 * von `paused_at` verloren; `meeting_pause` hält je Pause das Paar.
		 * Beim Fortsetzen wird die jüngste offene Zeile geschlossen. Beim
		 * Unterbrechen wird eine allfällige noch offene Zeile zuerst
		 * geschlossen (Codeprüfung 09.10.2026): `setzePause` weist ein
		 * zweites Unterbrechen nicht ab, und ohne das Schliessen bliebe die
		 * erste Zeile für immer offen — eine Datenleiche im Nachweis.
		 */
		let pausenbeginn: Date | null = null;
		if (pause.an) {
			await tx`
				UPDATE meeting_pause SET ende_at = now()
				 WHERE id = (SELECT id FROM meeting_pause
				              WHERE meeting_id = ${id} AND ende_at IS NULL
				              ORDER BY beginn_at DESC LIMIT 1)
			`;
			await tx`
				INSERT INTO meeting_pause (meeting_id, operator_id, beginn_at, text, created_by)
				VALUES (${id}, ${handelnder.operatorId}, now(), ${text}, ${handelnder.label})
			`;
			pausenbeginn = (await tx<{ beginn_at: Date }[]>`SELECT beginn_at FROM meeting_pause
				WHERE meeting_id = ${id} AND ende_at IS NULL ORDER BY beginn_at DESC LIMIT 1`)[0]
				?.beginn_at;
		} else {
			const [beendet] = await tx<{ beginn_at: Date | null }[]>`
				UPDATE meeting_pause SET ende_at = now()
				 WHERE id = (SELECT id FROM meeting_pause
				              WHERE meeting_id = ${id} AND ende_at IS NULL
				              ORDER BY beginn_at DESC LIMIT 1)
				RETURNING beginn_at
			`;
			pausenbeginn = beendet?.beginn_at ?? null;
		}

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				pause.an ? EREIGNISARTEN.versammlungUnterbrochen : EREIGNISARTEN.versammlungFortgesetzt,
				{ art: 'meeting', id },
				pause.an
					? { text }
					: pausenbeginn
						? // Schweizer Zeit statt rohem UTC-ISO: Der Verlauf geht
							// nach aussen, und eine Pause um «19:45» liest dort
							// niemand als «2026-12-03T19:45:12.123Z»
							// (Codeprüfung 09.10.2026).
							{ beginn: zeitpunktKurz(pausenbeginn.toISOString()) }
						: {}
			)
		]);

		return ausDb(neu);
	});
}

/**
 * Setzt das Wandbild.
 *
 * `wall_changed_at` trägt die Datenbank selbst mit `now()`: Die Saalsicht liest
 * daran ab, dass sie nachladen muss, und ein Zeitstempel aus der Anwendung
 * könnte hinter dem der Datenbank liegen.
 */
export async function setzeWandbild(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	art: Wandbildart,
	text: string | null
): Promise<Versammlung> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<MeetingZeile[]>`SELECT * FROM meeting WHERE id = ${id}`;
		if (!z) throw new Error('Versammlung nicht gefunden');

		const [{ jetzt }] = await tx<{ jetzt: Date }[]>`SELECT now() AS jetzt`;
		const u = setzeWandbildImKern(ausDb(z), art, text, jetzt.toISOString());
		await tx`
			UPDATE meeting
			   SET wall_kind = ${u.ergebnis.wandbild!.art},
			       wall_text = ${u.ergebnis.wandbild!.text ?? null},
			       wall_changed_at = ${jetzt}
			 WHERE id = ${id}
		`;
		return schreibeUebergang(tx, handelnder, u);
	});
}


/**
 * Die laufende Versammlung dieses Betreibers — für den Rückweg im Gerüst.
 *
 * **Wozu** (21.08.2026): «Es sollte bei einer laufenden Versammlung, wenn man im
 * Browser herumklickt, noch einen Knopf geben, zurück zur Versammlung. Ziel die
 * Einfachheit und Hürden tief halten. … Das müsste bei jeder Seite sein.»
 *
 * Wer im Saal das Quorum nachschlägt oder eine Zuordnung prüft, landet auf
 * Seiten, die von der Sitzung wegführen — und muss den Weg zurück über die
 * Versammlungsliste suchen, während vierzehn Leute warten.
 *
 * **Eine Zeile, kein Bestand.** Geholt wird nur, was der Knopf braucht: Kennung
 * und Name. Laufen mehrere Versammlungen (ein Verbund tagt gemeinsam), gilt die
 * zuletzt eröffnete — sie ist die, in der jemand gerade steht.
 */
export async function holeLaufendeVersammlung(
	operatorId: Id,
	userId: Id,
	gemerkt: Id | null = null
): Promise<{ id: Id; gemeinschaft: string; tag: { id: Id; bezeichnung: string } | null } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Zuerst die gemerkte** (Auftraggeber, 21.08.2026: «der Button muss sich merken,
		 * welche die letzte Sitzung war»). Das Versammlungs-Layout legt bei jedem
		 * Besuch die Kennung in ein Cookie; hier wird nur noch geprüft, ob sie
		 * etwas gilt — läuft die Versammlung noch, und gehört sie diesem
		 * Betreiber?
		 *
		 * Fällt sie weg (geschlossen, gelöscht, fremd), greift der Verlauf
		 * darunter. Der Knopf ist damit nie leer, solange irgendwo eine Sitzung
		 * läuft, in der dieser Mensch tätig war.
		 */
		if (gemerkt) {
			const [g] = await tx<{ id: string; name: string; tag_id: string | null; tag_name: string | null }[]>`
				SELECT m.id, s.name, d.id AS tag_id, d.label AS tag_name
				FROM meeting m
				JOIN stweg s ON s.id = m.stweg_id
				LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
				WHERE m.id = ${gemerkt} AND m.state = 'laufend'
			`;
			if (g)
				return {
					id: g.id,
					gemeinschaft: g.name,
					tag: g.tag_id ? { id: g.tag_id, bezeichnung: g.tag_name ?? '' } : null
				};
		}

		/*
		 * **Die Versammlung, in der DIESER Mensch tätig ist** — nicht die zuletzt
		 * eröffnete des Betreibers.
		 *
		 * Gemeldet am 21.08.2026: «es zeigt eine andere Sitzung an, als ich drin
		 * bin. ist das so gewollt oder eine Leiche?» Gewollt war es nicht: Die
		 * erste Fassung nahm schlicht `ORDER BY opened_at DESC LIMIT 1`. Auf dem
		 * Entwicklungsstand liefen zu dem Zeitpunkt neunzehn Versammlungen
		 * nebeneinander — jeder Prüflauf lässt eine offen —, und die jüngste
		 * verdrängte die eigene. Im Betrieb genügen zwei Häuser am selben Abend
		 * für denselben Fehler.
		 *
		 * **Gefragt wird deshalb der Verlauf.** Wer eine Versammlung führt,
		 * hinterlässt dort Spuren mit `meeting` als Gegenstand: Traktandum
		 * aufrufen, Abstimmung öffnen und schliessen, Anwesenheit bestätigen,
		 * Reihenfolge ändern. Wer in keiner tätig war, bekommt keinen Knopf — er
		 * leitet gerade nichts, und ein Verweis in eine fremde Sitzung ist
		 * schlimmer als keiner.
		 *
		 * Der Verlauf ist nur anfügbar (AD-5); die Auskunft kann deshalb nicht
		 * hinter dem Geschehen zurückbleiben.
		 */
		const [z] = await tx<
			{ id: string; name: string; tag_id: string | null; tag_name: string | null }[]
		>`
			SELECT m.id, s.name, d.id AS tag_id, d.label AS tag_name, max(a.occurred_at) AS zuletzt
			FROM meeting m
			JOIN stweg s ON s.id = m.stweg_id
			LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
			JOIN audit_entry a
			  ON a.subject_type = 'meeting' AND a.subject_id = m.id::text
			WHERE m.state = 'laufend' AND a.actor_user_id = ${userId}
			GROUP BY m.id, s.name, d.id, d.label
			ORDER BY zuletzt DESC
			LIMIT 1
		`;
		return z
			? {
					id: z.id,
					gemeinschaft: z.name,
					tag: z.tag_id ? { id: z.tag_id, bezeichnung: z.tag_name ?? '' } : null
				}
			: null;
	});
}


/**
 * Ob eine Gemeinschaft je eine Versammlung freigegeben hat (23.08.2026).
 *
 * Gebraucht dort, wo ein Korrekturweg nur vor der ersten Freigabe offensteht:
 * Ab da hält eine Momentaufnahme fest, wem was gehörte, und Stammdaten zu
 * tilgen machte Protokolle unerklärlich.
 */
export async function hatFreigegebeneVersammlung(operatorId: Id, stwegId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ vorhanden: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM meeting
				 WHERE stweg_id = ${stwegId} AND state <> 'entwurf'
			) AS vorhanden
		`;
		return z?.vorhanden ?? false;
	});
}
