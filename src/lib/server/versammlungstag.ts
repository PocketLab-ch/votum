/**
 * Der Versammlungstag (Stories 7.5, 7.5a und 7.7).
 *
 * Eine Klammer über mehrere Versammlungen desselben Abends. Die Versammlungen
 * bleiben, was sie sind: eigene Beschlussfähigkeit, eigenes Protokoll, eigene
 * Anfechtungsfrist. Was der Tag beisteuert, ist die Sicht des Saals — eine
 * Reihenfolge vorne, eine Tafel mit dem Stand aller Gemeinschaften.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { LEITUNGSFELDER, pruefeLeitungsnamen } from '$lib/domain/versammlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { stelleBeschlussfaehigkeitFest } from '$lib/domain/beschlussfaehigkeit';
import { beteiligungDerAnwesenden, standVon } from '$lib/domain/anwesenheit';
import { bestaetigeAnwesenheit, holeAnwesenheitsereignisse } from './anwesenheit';
import { parteienAmTag } from './personen';
import { holeMomentaufnahme } from './freigabe';
import { holeAnwesenheitsregeln } from './reglement';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { pruefeAufnahme, type Aufnahmelage } from '$lib/domain/zuordnung';
import { planeUmlegung, type Mittagende, type Umlegeplan } from '$lib/domain/umlegen';
import {
	bearbeiteVersammlung,
	eroeffneVersammlung,
	holeVersammlung,
	schliesseVersammlung
} from './versammlungen';
import { vereinheitlicheListe } from './geschaeft';
import { holeAuswertung } from './auswertung';
import { holeTraktanden } from './traktanden';
import { durchFolgeantraegeEntschieden, holeFolgeantragslagen } from './protokoll';
import type { Id } from '$lib/domain/types';
import type { Betriebsart, Versammlungsart, Versammlungszustand } from '$lib/domain/versammlung';
import type { Versammlungsstufe } from '$lib/domain/beschlussfaehigkeit';
import {
	Schreibkonflikt,
	konfliktsatz,
	veralteteFelder,
	type Schreibstand
} from '$lib/domain/schreibstand';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { istKalendertag } from '$lib/domain/datum';

export interface Versammlungstag {
	id: Id;
	bezeichnung: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	bemerkung: string | null;
	/** Gilt für den ganzen Anlass; die Angabenseite legt sie auf alle um. */
	art: Versammlungsart;
	anlass: string | null;
	/**
	 * Wie im Saal abgestimmt wird — für alle gleich (Auftraggeber, 25.08.2026: «Wie
	 * wird abgestimmt? fehlt bei Gruppenveranstaltung»).
	 *
	 * **Hart**, und zwar nicht aus Ordnungsliebe: Einlass, Wand und
	 * Stimmerfassung folgen ihr. Halb Handzeichen, halb Telefon hiesse, im
	 * selben Raum zwei Verfahren zugleich zu führen.
	 */
	betriebsart: Betriebsart;
	/**
	 * Wer den Vorsitz des Abends führte und wer schrieb (Migration 092).
	 *
	 * Am Abend gibt es **ein** Protokoll für alle Häuser — also auch eine
	 * Unterschriftszeile, und die braucht einen Namen darüber. Freiwillig wie bei
	 * der einzelnen Versammlung: Der gesetzliche Mindestinhalt sind die
	 * Beschlüsse (ZGB Art. 712n Abs. 2).
	 */
	sitzungsleitung: string | null;
	protokollfuehrung: string | null;
}

interface Tagzeile {
	id: string;
	label: string;
	day_date: Date;
	start_time: string;
	location: string;
	note: string | null;
	kind: Versammlungsart;
	occasion: string | null;
	operation_mode: Betriebsart;
	chair_label: string | null;
	minutes_keeper_label: string | null;
}

function tag(w: Date | string): string {
	return typeof w === 'string' ? w : w.toISOString().slice(0, 10);
}

function ausDb(z: Tagzeile): Versammlungstag {
	return {
		id: z.id,
		bezeichnung: z.label,
		datum: tag(z.day_date),
		uhrzeit: String(z.start_time).slice(0, 5),
		ort: z.location,
		bemerkung: z.note,
		art: z.kind,
		anlass: z.occasion,
		betriebsart: z.operation_mode,
		sitzungsleitung: z.chair_label,
		protokollfuehrung: z.minutes_keeper_label
	};
}

export async function holeVersammlungstage(operatorId: Id): Promise<Versammlungstag[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Tagzeile[]>`
			SELECT * FROM meeting_day ORDER BY day_date DESC
		`;
		return zeilen.map(ausDb);
	});
}

export async function holeVersammlungstag(
	operatorId: Id,
	id: Id
): Promise<Versammlungstag | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<Tagzeile[]>`SELECT * FROM meeting_day WHERE id = ${id}`;
		return z ? ausDb(z) : null;
	});
}

/** Zu welchem Abend eine Versammlung gehört. Null, wenn sie für sich steht. */
export async function holeTagDerVersammlung(
	operatorId: Id,
	meetingId: Id
): Promise<Versammlungstag | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<Tagzeile[]>`
			SELECT d.* FROM meeting_day d
			JOIN meeting m ON m.meeting_day_id = d.id
			WHERE m.id = ${meetingId}
		`;
		return z ? ausDb(z) : null;
	});
}

/**
 * Ob die gemeinsame Steuerung des Abends eine Handlung der Hausleitung sperrt,
 * und der Vermerk, wenn die Leitung sie über den Notweg trotzdem führt
 * (Erhebung 30.09.2026, Befund 1).
 *
 * Gibt den Abend zurück, der sperrt, sonst `null`.
 *
 * **Sperre und Vermerk in einer Funktion**, nicht zwei (Codeprüfung
 * 30.09.2026). Der Kommentar an der Leitungsseite versprach den Eintrag seit
 * dem 25.08.2026, und der Code liess den Notweg nur durch. Stünde der Vermerk
 * als eigener Aufruf daneben, liesse er sich wieder weglassen, ohne dass eine
 * Probe es merkt; hier fällt mit ihm auch die Sperre.
 *
 * **Vor der Handlung, nicht mit ihr.** Der Notweg öffnet acht Aktionen, jede
 * mit eigenem Schreibweg. Festgehalten wird deshalb die Wahl, und die Art sagt
 * das auch: «gewählt», nicht «aufgerufen». Scheitert die Handlung danach,
 * steht die Wahl allein da, und das ist wahr. Tagt die Versammlung an keinem
 * Abend, gibt es nichts vorbeizuführen und nichts zu schreiben.
 */
export async function abendSperrt(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	aktion: string,
	notweg: boolean
): Promise<Versammlungstag | null> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<Tagzeile[]>`
			SELECT d.* FROM meeting_day d
			JOIN meeting m ON m.meeting_day_id = d.id
			WHERE m.id = ${meetingId}
		`;
		if (!z) return null;
		const abend = ausDb(z);
		if (!notweg) return abend;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungNotweg,
				{ art: 'meeting', id: meetingId },
				{ aktion, abend: abend.id, abendBezeichnung: abend.bezeichnung }
			)
		);
		return null;
	});
}

export interface TagEingabe {
	bezeichnung: string;
	datum: string;
	uhrzeit: string;
	ort: string;
	bemerkung?: string | null;
	art?: Versammlungsart;
	anlass?: string | null;
	betriebsart?: Betriebsart;
}

/** Dieselben Regeln beim Anlegen wie beim Ändern — sonst laufen sie auseinander. */
function pruefeTagEingabe(eingabe: TagEingabe): void {
	if (zeichenzahl(eingabe.bezeichnung?.trim() ?? '') < 2) {
		throw new FachlicherFehler('name_zu_kurz', 'Die Bezeichnung fehlt.', 'bezeichnung');
	}
	if (!istKalendertag(eingabe.datum)) {
		throw new FachlicherFehler('datum_ungueltig', 'Das Datum fehlt.', 'datum');
	}
	if (zeichenzahl(eingabe.ort?.trim() ?? '') < 2) {
		throw new FachlicherFehler('ort_fehlt', 'Der Ort fehlt — er steht in der Einladung.', 'ort');
	}
	// Dieselbe Regel wie an der einzelnen Versammlung: Der Anlass gehört in die
	// Einladung, also darf er bei einer ausserordentlichen nicht fehlen.
	if (eingabe.art === 'ausserordentlich' && (eingabe.anlass?.trim().length ?? 0) === 0) {
		throw new FachlicherFehler(
			'anlass_fehlt',
			'Bei einer ausserordentlichen Versammlung gehört der Anlass in die Einladung.',
			'anlass'
		);
	}
}

/** Was in die Spalten `kind` und `occasion` geht — sie hängen zusammen (Migration 059). */
function artUndAnlass(eingabe: TagEingabe): { art: Versammlungsart; anlass: string | null } {
	const art = eingabe.art ?? 'ordentlich';
	return { art, anlass: art === 'ausserordentlich' ? (eingabe.anlass?.trim() ?? null) : null };
}

export async function erstelleVersammlungstag(
	handelnder: Handelnder & { operatorId: string },
	eingabe: TagEingabe
): Promise<Versammlungstag> {
	pruefeTagEingabe(eingabe);
	const bezeichnung = eingabe.bezeichnung.trim();

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const aa = artUndAnlass(eingabe);
		const [z] = await tx<Tagzeile[]>`
			INSERT INTO meeting_day (operator_id, label, day_date, start_time, location, note,
			                         kind, occasion, operation_mode)
			VALUES (${handelnder.operatorId}, ${bezeichnung}, ${eingabe.datum},
			        ${eingabe.uhrzeit || '19:00'}, ${eingabe.ort.trim()},
			        ${eingabe.bemerkung?.trim() || null}, ${aa.art}, ${aa.anlass},
			        ${eingabe.betriebsart ?? 'gefuehrt'})
			RETURNING *
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungstagAngelegt,
				{ art: 'meeting_day', id: z.id },
				{ bezeichnung, datum: eingabe.datum, ort: eingabe.ort.trim() }
			)
		);
		return ausDb(z);
	});
}

/**
 * Ändert Bezeichnung, Tag, Beginn, Ort und Art einer gemeinsamen Versammlung.
 *
 * **Die zugeordneten Versammlungen ändert diese Funktion nicht.** Datum und Ort
 * stehen in versandten Einladungen; das Nachziehen ist ein eigener, sichtbarer
 * Schritt — `legeAngabenUm`, ausgelöst vom Häkchen auf der Angabenseite.
 */
export async function aendereVersammlungstag(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	eingabe: TagEingabe
): Promise<Versammlungstag> {
	pruefeTagEingabe(eingabe);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const aa = artUndAnlass(eingabe);
		const [z] = await tx<Tagzeile[]>`
			UPDATE meeting_day
			   SET label = ${eingabe.bezeichnung.trim()},
			       day_date = ${eingabe.datum},
			       start_time = ${eingabe.uhrzeit || '19:00'},
			       location = ${eingabe.ort.trim()},
			       note = ${eingabe.bemerkung?.trim() || null},
			       kind = ${aa.art},
			       occasion = ${aa.anlass},
			       operation_mode = ${eingabe.betriebsart ?? 'gefuehrt'}
			 WHERE id = ${tagId}
			RETURNING *
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'id');
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungstagGeaendert,
				{ art: 'meeting_day', id: tagId },
				{
				bezeichnung: z.label,
				datum: tag(z.day_date),
				ort: z.location,
				art: z.kind,
				betriebsart: z.operation_mode
			}
			)
		);
		return ausDb(z);
	});
}

/**
 * Hält fest, wer den Vorsitz des Abends führte und wer das Protokoll schrieb.
 *
 * **Der Auftrag** (Auftraggeber, 26.08.2026): «Auch bei einer gemeinsamen Versammlung
 * muss der Vorsitz benannt werden.» Migration 091 hatte die Felder nur an der
 * einzelnen Versammlung; das Protokoll des Abends ist aber ein eigenes Dokument
 * mit eigenen Unterschriftszeilen.
 *
 * **Auch nach dem Versiegeln.** Die erste Fassung sperrte hier, sobald ein Haus
 * versiegelt war, mit der Begründung, das gemeinsame Protokoll stecke in jedem
 * Paket. Das stimmt nicht: `siegel.ts` führt es im Manifest ausdrücklich unter
 * «nicht enthalten» — «Es entsteht nach der Sitzung … und ist nicht Teil dieses
 * Siegels.» Die Sperre hätte damit nichts geschützt und den Normalfall verboten:
 * Versiegelt wird am Ende des Abends, geschrieben wird am Dienstag darauf.
 *
 * Nachweisbar bleibt der Name über den Verlauf — jede Änderung mit vorher und
 * nachher, und `audit_entry` ist nur anfügbar.
 */
export async function setzeAbendleitung(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	angaben: { sitzungsleitung: string | null; protokollfuehrung: string | null },
	/** Der Stand, den das Formular vorfand — siehe `setzeVersammlungsleitung`. */
	bekannt?: Schreibstand
): Promise<void> {
	const { sitzungsleitung: vorsitz, protokollfuehrung: fuehrung } = pruefeLeitungsnamen(angaben);

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		// `FOR UPDATE`: Zwischen Lesen und Schreiben liegt die Konfliktprüfung. Ohne
		// Sperre lesen zwei gleichzeitige Vorgänge denselben Stand, beide finden
		// nichts Veraltetes, und der zweite überschreibt den ersten still.
		const [z] = await tx<Tagzeile[]>`SELECT * FROM meeting_day WHERE id = ${tagId} FOR UPDATE`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'id');
		const bisher = ausDb(z);

		const gespeichert = {
			sitzungsleitung: bisher.sitzungsleitung,
			protokollfuehrung: bisher.protokollfuehrung
		};
		const veraltet = veralteteFelder(gespeichert, bekannt, {
			sitzungsleitung: vorsitz,
			protokollfuehrung: fuehrung
		});
		if (veraltet.length > 0) {
			throw new Schreibkonflikt(gespeichert, konfliktsatz(veraltet, gespeichert, LEITUNGSFELDER));
		}

		const felder: Record<string, { vorher: string | null; nachher: string | null }> = {};
		if (bisher.sitzungsleitung !== vorsitz) {
			felder.sitzungsleitung = { vorher: bisher.sitzungsleitung, nachher: vorsitz };
		}
		if (bisher.protokollfuehrung !== fuehrung) {
			felder.protokollfuehrung = { vorher: bisher.protokollfuehrung, nachher: fuehrung };
		}
		if (Object.keys(felder).length === 0) return;

		await tx`
			UPDATE meeting_day
			   SET chair_label = ${vorsitz}, minutes_keeper_label = ${fuehrung}
			 WHERE id = ${tagId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.versammlungstagGeaendert,
				{ art: 'meeting_day', id: tagId },
				{ felder }
			)
		);
	});
}

/** Was an den mittagenden Versammlungen steht — Grundlage für `planeUmlegung`. */
export async function holeMittagende(operatorId: Id, tagId: Id): Promise<Mittagende[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				name: string;
				state: Versammlungszustand;
				meeting_date: Date;
				start_time: string;
				location: string;
				kind: Versammlungsart;
				occasion: string | null;
				operation_mode: Betriebsart;
			}[]
		>`
			SELECT m.id, s.name, m.state, m.meeting_date, m.start_time, m.location, m.kind, m.occasion,
			       m.operation_mode
			  FROM meeting m
			  JOIN stweg s ON s.id = m.stweg_id
			 WHERE m.meeting_day_id = ${tagId}
			 ORDER BY m.day_position NULLS LAST, s.name
		`;
		return zeilen.map((z) => ({
			id: z.id,
			gemeinschaft: z.name,
			zustand: z.state,
			datum: tag(z.meeting_date),
			uhrzeit: String(z.start_time).slice(0, 5),
			ort: z.location,
			art: z.kind,
			anlass: z.occasion,
			betriebsart: z.operation_mode
		}));
	});
}

/**
 * Legt Tag, Beginn, Ort und Art auf die mittagenden Versammlungen um.
 *
 * **Der Grund, warum es diese Funktion gibt**, steht in `domain/umlegen.ts`:
 * Wer den Abend verschiebt, verschiebt sechs Versammlungen — und tat das bis
 * zum 11.08.2026 sechsmal von Hand.
 *
 * Geschrieben wird über `bearbeiteVersammlung`, nicht mit einem eigenen UPDATE:
 * Dort hängen die Zustandsprüfung, die Zehntagesfrist und der Verlaufseintrag.
 * Ein UPDATE daneben umginge alle drei.
 */
export async function legeAngabenUm(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	/**
	 * Nur diese eine Versammlung nachziehen.
	 *
	 * Für das Zuordnen: Wer Haus F an den Abend hängt, will nicht, dass dabei
	 * A bis E stillschweigend umgestellt werden — auch wenn sie nach der Matrix
	 * ohnehin passen müssten. Das Häkchen auf der Angabenseite meint dagegen
	 * ausdrücklich «auf alle», und dort bleibt es dabei.
	 */
	nur: Id | null = null
): Promise<Umlegeplan> {
	const [tagDaten, alle] = await Promise.all([
		holeVersammlungstag(handelnder.operatorId, tagId),
		holeMittagende(handelnder.operatorId, tagId)
	]);
	if (!tagDaten) {
		throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'id');
	}
	const mittagende = nur ? alle.filter((m) => m.id === nur) : alle;

	const plan = planeUmlegung(
		{
			datum: tagDaten.datum,
			uhrzeit: tagDaten.uhrzeit,
			ort: tagDaten.ort,
			art: tagDaten.art,
			anlass: tagDaten.anlass,
			betriebsart: tagDaten.betriebsart
		},
		mittagende
	);

	for (const a of plan.aendern) {
		const v = await holeVersammlung(handelnder.operatorId, a.id);
		if (!v) continue;
		await bearbeiteVersammlung(handelnder, a.id, {
			stwegId: v.stwegId,
			datum: tagDaten.datum,
			uhrzeit: tagDaten.uhrzeit,
			ort: tagDaten.ort,
			art: tagDaten.art,
			anlass: tagDaten.anlass ?? undefined,
			stufe: v.stufe,
			// Hart: Die Betriebsart kommt vom Abend, nicht aus dem Haus.
			betriebsart: tagDaten.betriebsart,
			vorgaengerId: v.vorgaengerId
			// Kein Fristvermerk: Er ist keine Eingabe. `bearbeiteVersammlung`
			// rechnet ihn aus Datum und Vorgängerdatum neu, und genau das ist hier
			// nötig — der Abend verschiebt die Daten der Häuser.
		});
	}

	return plan;
}

/**
 * Erhebt die Lage für `pruefeAufnahme` — was sonst nur die Datenbank weiss.
 *
 * Getrennt von der Aufnahme selbst, weil die Seite denselben Befund **vor** dem
 * Klick braucht: Ohne ihn wäre die Bestätigung ein Dialog, der erst kommt,
 * nachdem der Benutzer schon abgeschickt hat.
 *
 * bindung: meetingId — Diese Funktion FRAGT die Zugehörigkeit zum Abend; sie
 *   darf sie nicht voraussetzen.
 * bindung: tagId — Diese Funktion FRAGT die Zugehörigkeit zum Abend; sie darf
 *   sie nicht voraussetzen.
 */
export async function erhebeAufnahmelage(
	operatorId: Id,
	tagId: Id,
	meetingId: Id
): Promise<Aufnahmelage> {
	return alsBetreiber(operatorId, async (tx) => {
		const [m] = await tx<
			{
				id: string;
				stweg_id: string;
				stweg_name: string;
				kind: Versammlungsart;
				tier: Versammlungsstufe;
				state: Versammlungszustand;
				meeting_date: Date;
				location: string;
				meeting_day_id: string | null;
				tag_label: string | null;
			}[]
		>`
			SELECT m.id, m.stweg_id, s.name AS stweg_name, m.kind, m.tier, m.state, m.meeting_date,
			       m.location, m.meeting_day_id, d.label AS tag_label
			FROM meeting m
			JOIN stweg s ON s.id = m.stweg_id
			LEFT JOIN meeting_day d ON d.id = m.meeting_day_id
			WHERE m.id = ${meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');

		const [z] = await tx<Tagzeile[]>`SELECT * FROM meeting_day WHERE id = ${tagId}`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'tagId');

		const schonDrin = await tx<
			{ id: string; kind: Versammlungsart; tier: Versammlungsstufe; meeting_date: Date }[]
		>`
			SELECT id, kind, tier, meeting_date FROM meeting
			WHERE meeting_day_id = ${tagId} AND stweg_id = ${m.stweg_id}
		`;

		return {
			versammlung: {
				id: m.id,
				stwegId: m.stweg_id,
				gemeinschaft: m.stweg_name,
				art: m.kind,
				stufe: m.tier,
				zustand: m.state,
				datum: tag(m.meeting_date),
				ort: m.location,
				gehoertZu:
					m.meeting_day_id && m.tag_label
						? { id: m.meeting_day_id, bezeichnung: m.tag_label }
						: null
			},
			ziel: { id: z.id, datum: tag(z.day_date), ort: z.location },
			schonDrin: schonDrin.map((s) => ({
				id: s.id,
				art: s.kind,
				stufe: s.tier,
				datum: tag(s.meeting_date)
			}))
		};
	});
}

/**
 * Nimmt eine Versammlung in eine gemeinsame Versammlung auf.
 *
 * `bestaetigt` ist kein Formfehler-Schalter, sondern die Antwort auf eine Frage,
 * die der Benutzer gesehen haben muss: Eine Zweitversammlung neben der ersten,
 * oder ein Entzug aus einer anderen gemeinsamen Versammlung. Ohne die
 * Bestätigung bricht der Aufruf ab und liefert den Wortlaut zurück — die Seite
 * zeigt ihn, statt hinterher zu melden, was schon geschehen ist.
 *
 * bindung: meetingId — `erhebeAufnahmelage` davor entscheidet, ob aufgenommen
 *   werden darf; diese Funktion STELLT die Zuordnung erst her.
 * bindung: tagId — `erhebeAufnahmelage` davor entscheidet, ob aufgenommen
 *   werden darf; diese Funktion STELLT die Zuordnung erst her.
 */
export async function nimmInTagAuf(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	meetingId: Id,
	stelle: number,
	bestaetigt = false
): Promise<Umlegeplan> {
	const lage = await erhebeAufnahmelage(handelnder.operatorId, tagId, meetingId);
	const befund = pruefeAufnahme(lage);

	if (!befund.erlaubt) {
		throw new FachlicherFehler('doppelt', befund.grund ?? 'Nicht möglich.', 'meetingId');
	}
	if (befund.bestaetigung && !bestaetigt) {
		throw new FachlicherFehler('bestaetigen', befund.bestaetigung, 'bestaetigt');
	}

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE meeting SET meeting_day_id = ${tagId}, day_position = ${stelle}
			WHERE id = ${meetingId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.versammlungInTag, { art: 'meeting', id: meetingId }, { tag: tagId, stelle })
		);
	});

	/*
	 * Die mitgebrachte Traktandenliste geht in die gemeinsame ein. Ohne diesen
	 * Schritt führte die neu aufgenommene Gemeinschaft ihre eigene Zählung weiter,
	 * und am Abend stünden zwei Listen nebeneinander — der Befund vom 11.08.2026.
	 */
	await vereinheitlicheListe(handelnder, tagId);

	/*
	 * **Und die harten Angaben kommen mit** (Auftraggeber, 25.08.2026: «Die Gruppe gibt
	 * die Einstellungen für die angehängten Einheiten vor»).
	 *
	 * Bis hierher war das Zuordnen rein organisatorisch: Die Versammlung hing
	 * am Abend und behielt ihren eigenen Tag, ihren eigenen Ort und ihre eigene
	 * Abstimmungsweise. Der Hinweis sagte es sogar — und niemand las ihn zweimal.
	 * Am Abend standen dann sechs Termine für einen Saal.
	 *
	 * Gerechnet wird über `legeAngabenUm` und damit über **dieselbe** Regel wie
	 * beim Häkchen auf der Angabenseite: Was noch im Entwurf ist, zieht nach;
	 * was freigegeben ist, bleibt stehen und wird genannt. Zwei Rechnungen für
	 * dieselbe Frage liefen auseinander, und die eine wäre die stille.
	 *
	 * Der Plan kommt zurück, damit die Seite sagen kann, was geschehen ist. Wer
	 * ihn nicht braucht, ignoriert ihn — das ist der Normalfall.
	 */
	return legeAngabenUm(handelnder, tagId, meetingId);
}

/**
 * Löst eine Versammlung aus der gemeinsamen Versammlung — und sagt, wo sie war.
 *
 * Die Rückgabe ist der Preis dafür, dass sich der Schritt rückgängig machen
 * lässt: Ohne die alte Stelle im Ablauf käme die Versammlung beim Zurücknehmen
 * ans Ende der Reihe, und wer sich vertippt hat, müsste die Reihenfolge des
 * ganzen Saals von Hand richten. Gemeldet am 11.08.2026 — «Ich wollte das
 * rückgängig machen und konnte nicht.»
 */
export async function nimmAusTag(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<{ tagId: Id | null; stelle: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<{ meeting_day_id: string | null; day_position: number | null }[]>`
			SELECT meeting_day_id, day_position FROM meeting WHERE id = ${meetingId}
		`;
		/*
		 * **Ohne Treffer kein Verlauf.** Eine fremde Versammlung findet die
		 * Abfrage unter dem Zeilenschutz nicht; bis 27.10.2026 schrieb der Weg
		 * trotzdem «aus der gemeinsamen Versammlung gelöst» über sie (Klasse K2;
		 * Durchstich `e2e/fremdbetreiber.mjs`).
		 */
		if (!vorher) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		/*
		 * **Ohne Abend nichts zu lösen, also auch kein Verlauf.** Die Aktion `tag`
		 * ruft hierher, wenn man bei einer Versammlung, die für sich allein steht,
		 * «Übernehmen» drückt; bis 27.10.2026 hielt der Verlauf dann «aus der
		 * gemeinsamen Versammlung gelöst» fest, ohne dass sich etwas änderte
		 * (Codeprüfung, `docs/pendenzen-sicherheit.md`). Keine Absage: Das
		 * gewünschte Ergebnis besteht schon.
		 */
		if (vorher.meeting_day_id === null) return { tagId: null, stelle: 0 };
		await tx`
			UPDATE meeting SET meeting_day_id = NULL, day_position = NULL WHERE id = ${meetingId}
		`;

		/*
		 * Die Traktanden lösen sich mit. Bliebe die Bindung stehen, trüge die
		 * herausgelöste Versammlung weiter Nummern aus einer Ordnung, an der sie
		 * nicht mehr teilnimmt — «3.1» ohne einen Abend, der eine 3 kennt. Die
		 * Traktanden selbst bleiben; nur ihre Zugehörigkeit endet, und die Zählung
		 * fällt auf die eigene zurück. Wer das Lösen rückgängig macht, sammelt sie
		 * über den Titel wieder ein.
		 */
		await tx`
			UPDATE agenda_item SET business_id = NULL, manual_number = NULL
			 WHERE meeting_id = ${meetingId} AND business_id IS NOT NULL
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.versammlungAusTag, { art: 'meeting', id: meetingId })
		);
		return { tagId: vorher.meeting_day_id ?? null, stelle: vorher.day_position ?? 0 };
	});
}

// ── Die Tafel (Story 7.7) ───────────────────────────────────────────────────

export interface Tafelzeile {
	meetingId: Id;
	stwegId: Id;
	gemeinschaft: string;
	zustand: Versammlungszustand;
	/**
	 * Erste oder zweite Versammlung — je Haus verschieden (ZGB 712p Abs. 2).
	 *
	 * Die Abfrage liest `tier` seit jeher, um die Beschlussfaehigkeit zu rechnen;
	 * hinausgegeben wurde es nicht. Die Sitzungsleitung braucht es: Vertagen gibt
	 * es nur bei der ersten — eine dritte Versammlung kennt das Gesetz nicht.
	 */
	stufe: 'erste' | 'zweite';
	stelle: number;
	/** Null, solange keine Momentaufnahme besteht — also vor der Freigabe. */
	beschlussfaehig: {
		erfuellt: boolean;
		/** Was fehlt, in einem Satz. Leer, wenn nichts fehlt. */
		fehlt: string;
		grundlage: 'gesetz' | 'reglement';
		/**
		 * Die einzelnen Bedingungen mit ihren Schwellen (23.08.2026).
		 *
		 * Bisher gingen nur die vier Rohzahlen mit, und die Tafel setzte daraus
		 * einen Satz zusammen: «14 von 30 Köpfen · 512 von 1000 Wertquoten». Wie
		 * viele es BRAUCHT, stand nirgends — und bei einer verschärften
		 * Reglementsregel (§ 8: «mindestens drei») liegt die Schwelle ganz
		 * woanders als bei der Hälfte.
		 *
		 * Der Kern rechnet sie längst; sie wurden hier bloss weggeworfen.
		 */
			bedingungen: {
			bezeichnung: string;
			noetig: number;
			vorhanden: number;
			/** Das Ganze, auf das sich `vorhanden` bezieht — siehe `domain/beschlussfaehigkeit`. */
			gesamt: number;
			erfuellt: boolean;
		}[];
		kopfstimmenAnwesend: number;
		kopfstimmenGesamt: number;
		quotenAnwesend: number;
		gesamtquote: number;
		/** Ä-17 A: ein einziger Eigentümer; die Leitung nennt den Vorbehalt. */
		einzigerEigentuemer: boolean;
		/** Und er sind mehrere Personen (`docs/entscheide/0016`). */
		einzigeParteiGemeinsam: boolean;
	} | null;
	/**
	 * Wie viele Traktanden noch offen sind: ohne Ergebnis, ohne
	 * Beschlussvermerk und ohne Entscheid durch Folgeanträge (`holeTafel`).
	 */
	offeneTraktanden: number;
}

/**
 * Der Stand aller Gemeinschaften eines Abends, je Gemeinschaft eine Zeile.
 *
 * Gerechnet wird je Gemeinschaft mit **ihrer** Schwelle: Haus 4 kann
 * beschlussfähig sein und die Einstellhalle nicht. Eine gemeinsame Zahl gäbe es
 * gar nicht — sie wäre der häufigste Fehler, den dieses Werkzeug verhindern soll.
 */
export async function holeTafel(operatorId: Id, tagId: Id): Promise<Tafelzeile[]> {
	const zeilen = await alsBetreiber(operatorId, async (tx) => {
		return tx<
			{
				meeting_id: string;
				stweg_id: string;
				name: string;
				state: Versammlungszustand;
				day_position: number | null;
				tier: 'erste' | 'zweite';
				offene: number;
				kandidaten: string[];
			}[]
		>`
			SELECT m.id AS meeting_id, m.stweg_id, s.name, m.state, m.day_position, m.tier,
			       o.offene, o.kandidaten
			FROM meeting m JOIN stweg s ON s.id = m.stweg_id
			CROSS JOIN LATERAL (
			       SELECT count(*)::int AS offene,
			              -- Die offenen mit einem abgestimmten Folgeantrag: Ob er
			              -- über den Antrag entschieden hat, sagt erst die Auszählung
			              -- (unten, holeFolgeantragslagen; Produktentscheid
			              -- 08.11.2026).
			              coalesce(array_agg(a.id::text) FILTER (WHERE EXISTS (
			                SELECT 1 FROM agenda_item c
			                JOIN voting_round fv ON fv.agenda_item_id = c.id
			                WHERE c.parent_id = a.id AND c.meeting_id = m.id
			                  AND c.spontaneous_kind = 'folgeantrag'
			                  AND fv.state = 'geschlossen')), '{}') AS kandidaten
			       FROM agenda_item a
			        WHERE a.meeting_id = m.id
			          AND a.item_kind = 'abstimmung'
			          -- Mit dem Beschlussvermerk steht der Beschluss im Protokoll
			          -- (Migration 135). Das Protokoll des Abends zählt den Punkt
			          -- nicht als Lücke; Leiste und Tafel zählen wie das Protokoll
			          -- (Produktentscheid 02.10.2026).
			          AND NOT a.minute_decision
			          AND NOT EXISTS (
			            SELECT 1 FROM voting_round v
			            WHERE v.agenda_item_id = a.id
			              AND v.state = 'geschlossen'
			              AND v.superseded_at IS NULL
			              -- Konsultativ ist offen (H7, Teil D), wie im Haus.
			              AND NOT v.consultative)
			          -- Ein Beschluss, den ein Folgeantrag nach einem Rückkommen
			          -- ersetzt hat, ist entschieden (Migration 133).
			          AND NOT durch_anderes_traktandum_ersetzt(a.id)) o
			WHERE m.meeting_day_id = ${tagId}
			ORDER BY m.day_position NULLS LAST, s.name
		`;
	});

	const tafel: Tafelzeile[] = [];
	for (const z of zeilen) {
		const momentaufnahme = await holeMomentaufnahme(operatorId, z.meeting_id);
		let stand: Tafelzeile['beschlussfaehig'] = null;

		if (momentaufnahme) {
			const [ereignisse, regeln] = await Promise.all([
				holeAnwesenheitsereignisse(operatorId, z.meeting_id),
				holeAnwesenheitsregeln(operatorId, z.stweg_id)
			]);
			const liste = stimmkraftliste(momentaufnahme);
			const anwesende = new Set<string>();
			for (const p of new Set(ereignisse.map((e) => e.parteiId))) {
				const s = standVon(ereignisse.filter((e) => e.parteiId === p));
				if (s?.zustand === 'anwesend') anwesende.add(p);
			}

			/*
			 * **Eine Rechnung, nicht drei** (Nachzug Block 2a, 03.10.2026). Hier
			 * summierte die Tafel die Beteiligung von Hand — neben
			 * `beteiligungDerAnwesenden` (`domain/anwesenheit.ts`), die dieselben
			 * Zahlen schon liefert, und mit dem Nenner aus
			 * `momentaufnahme.totalQuota` statt aus der Stimmkraftliste. Gemessen
			 * vor dem Umbau: Die beiden Rechnungen konnten in keinem Bestand
			 * auseinanderlaufen — `stimmkraftliste` setzt `gesamtquote` aus
			 * demselben `snapshot.totalQuota` (`stimmkraft.ts`), und die übrigen
			 * fünf Felder sind dieselben Formeln. Der dritte Rechenweg war damit
			 * eine Abschrift, die beim nächsten Umbau davongelaufen wäre.
			 *
			 * Wer Stockwerkeigentümer ist (Parteien mit mindestens einer Einheit,
			 * nicht die Kopfstimmen und nicht alle Zeilen des Standes), entscheidet
			 * `beteiligungDerAnwesenden`; die Begründung steht dort.
			 */
			const beteiligung = beteiligungDerAnwesenden(liste, [...anwesende]);

			const befund = stelleBeschlussfaehigkeitFest(z.tier, beteiligung, regeln[z.tier]);
			stand = {
				erfuellt: befund.beschlussfaehig,
				fehlt: befund.fehlt,
				grundlage: befund.grundlage,
				bedingungen: befund.bedingungen,
				einzigerEigentuemer: befund.einzigerEigentuemer,
				...beteiligung
			};
		}

		/*
		 * **Der Grundantrag, über den Folgeanträge entschieden haben, ist nicht
		 * offen** (Produktentscheid 08.11.2026, B; «Leiste und Tafel zählen wie
		 * das Protokoll», 02.10.2026): angenommen, dann gegenstandslos; unter
		 * dem Häkchen gesperrt (`teil_entschieden`, Entscheid 0045, Punkt 9).
		 * Bis dahin meldete die Leiste «1 Punkt ohne Ergebnis», während das
		 * Abenddokument kein Entwurf mehr war. Die Bedingung ist die des
		 * Protokolls (`holeFolgeantragslagen`), nicht eine zweite in SQL; die
		 * Auswertung dazu wird nur für die Häuser geholt, in denen ein offener
		 * Antrag einen abgestimmten Folgeantrag hat.
		 */
		const entschieden =
			z.kandidaten.length > 0
				? await durchFolgeantraegeEntschiedeneIn(operatorId, z.meeting_id)
				: new Set<Id>();

		tafel.push({
			meetingId: z.meeting_id,
			stwegId: z.stweg_id,
			gemeinschaft: z.name,
			zustand: z.state,
			stufe: z.tier,
			stelle: Number(z.day_position ?? 0),
			beschlussfaehig: stand,
			offeneTraktanden: Number(z.offene) - z.kandidaten.filter((id) => entschieden.has(id)).length
		});
	}
	return tafel;
}

/**
 * Die Traktanden einer Versammlung, über die Folgeanträge entschieden haben
 * (`durchFolgeantraegeEntschieden`), aus derselben Stelle wie Hausprotokoll
 * und Abenddokument (`holeFolgeantragslagen`). Ob ein Folgeantrag angenommen
 * ist, steht in der Auszählung, nicht in einer Spalte; deshalb nicht in SQL.
 *
 * bindung: meetingId — an den Betreiber gebunden in `holeAuswertung` und
 *   `holeTraktanden`; aufgerufen nur mit Kennungen aus der Tafel des Abends.
 */
async function durchFolgeantraegeEntschiedeneIn(operatorId: Id, meetingId: Id): Promise<Set<Id>> {
	const [auswertung, traktanden] = await Promise.all([
		holeAuswertung(operatorId, meetingId),
		holeTraktanden(operatorId, meetingId)
	]);
	const lage = await holeFolgeantragslagen(operatorId, meetingId, auswertung, traktanden);
	const kennung = new Map(traktanden.map((t) => [t.nummer, t.knoten.id]));
	const entschieden = new Set<Id>();
	for (const z of auswertung?.zeilen ?? []) {
		const id = kennung.get(z.nummer);
		if (id && durchFolgeantraegeEntschieden(lage(z))) entschieden.add(id);
	}
	return entschieden;
}

// ── Ein Einlass für den ganzen Abend (Story 7.6) ────────────────────────────

export interface Einlassbefund {
	person: string;
	/** Je Versammlung, in der die Person stimmberechtigt ist. */
	zeilen: {
		meetingId: Id;
		gemeinschaft: string;
		name: string;
		/**
		 * Die Partei in DIESEM Haus — die Kennung aus den Stammdaten, wie sie die
		 * Momentaufnahme führt.
		 *
		 * **Sie muss mit**, seit der Eingang auch am Abend nach «digital oder von
		 * Hand» fragt (10.09.2026): Der Vermerk hängt an Partei UND Versammlung,
		 * und eine Person hält an einem Abend mehrere Parteien in mehreren Häusern.
		 * Null, wo nichts erfasst wurde.
		 */
		parteiId: Id | null;
		/** Was geschehen ist: neu erfasst, war schon da, oder warum nicht. */
		ergebnis: 'erfasst' | 'schon_anwesend' | 'nicht_laufend';
	}[];
}

/**
 * Meldet eine Person in allen Versammlungen des Abends an, in denen sie
 * stimmberechtigt ist.
 *
 * **Warum das nötig ist.** Wer im Haus 4 wohnt und zwei Parkplätze in der
 * Einstellhalle hat, ist an zwei Versammlungen stimmberechtigt — und steht
 * einmal am Eingang. Fünfmal anstehen wäre der sichere Weg zurück zur
 * Papierliste.
 *
 * **Was trotzdem getrennt bleibt.** Je Versammlung entsteht ein **eigenes**
 * Anwesenheitsereignis, mit eigenem Zeitpunkt und eigener Quelle (AD-5). Der
 * Verlauf jeder Gemeinschaft bleibt für sich lückenlos; eine gemeinsame
 * Anwesenheit gäbe es rechtlich nicht.
 *
 * Nicht laufende Versammlungen werden übersprungen und benannt — stillschweigend
 * zu überspringen hiesse, am Eingang den Eindruck zu erzeugen, es sei alles
 * erledigt.
 */
export async function lasseEin(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	personId: Id,
	weg: 'gescannt' | 'von_hand' = 'von_hand'
): Promise<Einlassbefund> {
	const parteien = await parteienAmTag(handelnder.operatorId, tagId, personId);
	if (parteien.length === 0) {
		throw new FachlicherFehler(
			'nicht_stimmberechtigt',
			'Diese Person ist hier an keiner Versammlung stimmberechtigt. Prüfen Sie, ob ' +
				'die Versammlungen freigegeben sind — der Stand wird bei der Freigabe festgehalten.',
			'personId'
		);
	}

	const zustaende = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; state: string }[]>`
			SELECT id, state FROM meeting WHERE meeting_day_id = ${tagId}
		`;
		return new Map(zeilen.map((z) => [z.id, z.state]));
	});

	const zeilen: Einlassbefund['zeilen'] = [];
	for (const p of parteien) {
		if (zustaende.get(p.meetingId) !== 'laufend') {
			zeilen.push({ ...p, parteiId: null, ergebnis: 'nicht_laufend' });
			continue;
		}
		const ergebnis = await bestaetigeAnwesenheit(
			handelnder,
			p.meetingId,
			p.snapshotPartyId,
			weg,
			'Einlass am Versammlungstag'
		);
		zeilen.push({
			...p,
			parteiId: ergebnis.parteiId,
			ergebnis: ergebnis.neu ? 'erfasst' : 'schon_anwesend'
		});
	}

	return { person: parteien[0].name, zeilen };
}

/**
 * Was aus einer Versammlung des Abends wurde — je Haus eine Zeile.
 *
 * Dieselbe Form wie beim Einlass: Was ging, was ging schon vorher, und was
 * nicht ging und warum. Stillschweigend zu überspringen hiesse, am Eingang den
 * Eindruck zu erzeugen, es sei alles erledigt.
 */
export interface Hausbefund {
	meetingId: Id;
	gemeinschaft: string;
	ergebnis: 'getan' | 'schon' | 'nicht_moeglich';
	grund?: string;
}

/** Die Versammlungen eines Abends mit Namen und Zustand — für die Sammelwege. */
async function haeuserDesAbends(
	operatorId: Id,
	tagId: Id
): Promise<{ meetingId: string; gemeinschaft: string; zustand: string }[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ id: string; name: string; state: string }[]>`
			SELECT m.id, s.name, m.state
			FROM meeting m JOIN stweg s ON s.id = m.stweg_id
			WHERE m.meeting_day_id = ${tagId}
			ORDER BY m.day_position NULLS LAST, s.name
		`;
		return zeilen.map((z) => ({ meetingId: z.id, gemeinschaft: z.name, zustand: z.state }));
	});
}

/**
 * Gehört diese Versammlung zu **diesem** Abend?
 *
 * **Warum das geprüft werden muss** (24.08.2026). Die Handlungen der Abendseiten
 * nehmen die Versammlung aus dem **Formular** — anders als in der Leitung eines
 * Hauses, wo sie im Pfad steht. Das ist Absicht: An einem Abend tagen mehrere
 * Häuser, und die Adresse trägt den Abend, nicht das Haus. Damit ist die
 * Versammlung ein Wert von aussen. Der Zeilenschutz der Datenbank hält fremde
 * Betreiber ab; innerhalb des eigenen liesse sich über eine untergeschobene
 * Kennung eine Versammlung ansteuern, die heute gar nicht mittagt.
 *
 * **Kein Rechtegewinn, sondern eine fehlende Zusicherung** — dieselbe Lage wie
 * bei `$lib/server/zugehoerigkeit`: dass eine Handlung nur trifft, was auf der
 * Seite steht, von der sie ausgelöst wurde.
 *
 * **Warum sie hier steht und nicht dreimal daneben** (08.09.2026). Dieselbe
 * Funktion stand als lokale Abschrift in `einlass`, `vollmachten` und `leitung`,
 * und die drei liefen bereits auseinander: zwei gaben nichts zurück, eine die
 * Kennung, und das Feld der Absage hiess einmal `meeting` und einmal
 * `versammlung`. Genau der Verlauf, gegen den `zugehoerigkeit` gebaut wurde
 * («fünf Abschriften liefen auseinander, sobald eine davon etwas mehr tut»).
 *
 * Sie **gibt die Kennung zurück**, damit der Aufruf sich in den Ausdruck setzen
 * lässt, der sie braucht: Ein Wert, der nur geprüft danebensteht, wird beim
 * nächsten Umbau leicht übergangen.
 *
 * Dass jede Abendhandlung sie aufruft, hält `scripts/check-abendbindung.mjs`
 * fest.
 *
 * bindung: tagId — die Bindung steht nicht in der Abfrage, sondern hinter ihr:
 * `holeTafel` holt die Häuser **dieses** Abends über `tagId`, danach sucht
 * JavaScript `meetingId` darin. Eine fremde Kennung ist nicht in der Tafel und
 * fällt durch das `some` — dieselbe Form wie `punktMitHaeusern`.
 * bindung: meetingId — dasselbe, von der anderen Seite her gelesen.
 */
export async function hausDesAbends(operatorId: Id, tagId: Id, meetingId: Id): Promise<Id> {
	const tafel = await holeTafel(operatorId, tagId);
	if (!tafel.some((z) => z.meetingId === meetingId)) {
		throw new FachlicherFehler(
			'fremdes_haus',
			'Diese Versammlung gehört nicht zu diesem Abend.',
			'versammlung'
		);
	}
	return meetingId;
}

/**
 * Die Versammlungen des Abends eröffnen — alle auf einmal oder eine bestimmte.
 *
 * **Der Anlass** (Auftraggeber, 24.08.2026): «Die Funktionalität von Anwesenheit und
 * Beschlussfähigkeit gegenüber Einlass ist auch nicht identisch.» Sie war es an
 * der Wurzel nicht: Eröffnet wurde bis hierher **nur** auf der Seite eines
 * einzelnen Hauses. Wer einen Abend mit fünf Gemeinschaften führte, musste
 * fünfmal die Sicht wechseln, bevor er überhaupt jemanden einlassen konnte —
 * genau das, was er zwei Tage vorher abgestellt haben wollte («ohne dass ich in
 * 5 STWEG hin und her springen muss»). Der Einlassschritt selbst war so lange
 * gesperrt und verwies auf eine Handlung, die er nicht anbot.
 *
 * **Reihum, nicht in einer Transaktion.** Jede Eröffnung schreibt einen eigenen
 * Übergang und einen eigenen Anzeigecode; ein Fehler beim dritten Haus darf die
 * beiden ersten nicht zurücknehmen. Der Befund benennt jede Zeile einzeln.
 */
export async function eroeffneAmAbend(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	nurDieses: Id | null = null
): Promise<Hausbefund[]> {
	const haeuser = await haeuserDesAbends(handelnder.operatorId, tagId);
	const ziele = nurDieses ? haeuser.filter((h) => h.meetingId === nurDieses) : haeuser;
	if (ziele.length === 0) {
		throw new FachlicherFehler(
			'fremdes_haus',
			'Diese Versammlung gehört nicht zu diesem Abend.',
			'meeting'
		);
	}

	const befund: Hausbefund[] = [];
	for (const h of ziele) {
		if (h.zustand !== 'freigegeben') {
			befund.push(eroeffnungsbefund(h, h.zustand));
			continue;
		}
		/*
		 * **Gelesen wurde der Zustand oben ohne Sperre** (Auftrag Abschluss, C2,
		 * aus der Codeprüfung zu F6). Hat jemand dieses Haus inzwischen einzeln
		 * eröffnet oder seine Freigabe zurückgenommen, sagt `eroeffneVersammlung`
		 * unter seiner Sperre ab. Bis dahin brach diese Absage den Lauf über die
		 * Häuser mitten ab: Die schon eröffneten standen offen, aber in keinem
		 * Befund, und die übrigen kamen nicht dran. Anders als beim Schliessen
		 * führen aus «freigegeben» zwei Wege hinaus; welcher es war, sagt erst
		 * der Zustand nach der Absage.
		 */
		try {
			await eroeffneVersammlung(handelnder, h.meetingId);
		} catch (e) {
			if (e instanceof FachlicherFehler && e.kennung === 'zustand_unpassend') {
				const jetzt = (await haeuserDesAbends(handelnder.operatorId, tagId)).find(
					(x) => x.meetingId === h.meetingId
				);
				befund.push(eroeffnungsbefund(h, jetzt?.zustand ?? h.zustand));
				continue;
			}
			// Jede andere fachliche Absage ebenso als Befund, nicht als Abbruch,
			// etwa ein Haus, das an ein Saalgerät abgegeben ist (VO117,
			// `versammlung_abgegeben`; Codeprüfung C2).
			if (e instanceof FachlicherFehler) {
				befund.push({ ...h, ergebnis: 'nicht_moeglich', grund: e.message });
				continue;
			}
			throw e;
		}
		befund.push({ ...h, ergebnis: 'getan' });
	}
	return befund;
}

/** Was das Eröffnen am Abend über ein Haus sagt, das nicht «freigegeben» ist. */
function eroeffnungsbefund(
	h: { meetingId: Id; gemeinschaft: string },
	zustand: string
): Hausbefund {
	if (zustand === 'laufend') return { ...h, ergebnis: 'schon' };
	return {
		...h,
		ergebnis: 'nicht_moeglich',
		grund:
			zustand === 'entwurf'
				? 'die Traktandenliste ist noch nicht freigegeben'
				: 'die Versammlung ist bereits geschlossen'
	};
}

/**
 * Die Versammlungen des Abends schliessen — alle auf einmal oder eine bestimmte.
 *
 * Das Gegenstück zum Eröffnen, und aus demselben Grund hier: Am Ende eines
 * gemeinsamen Abends stehen alle auf, und wer dann fünf Hausseiten nacheinander
 * aufsucht, schliesst die letzte am nächsten Tag. Offene Abstimmungen werden
 * dabei mitgeschlossen — das entscheidet `schliesseVersammlung`, nicht diese
 * Stelle.
 */
export async function schliesseAmAbendGanz(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	nurDieses: Id | null = null
): Promise<Hausbefund[]> {
	const haeuser = await haeuserDesAbends(handelnder.operatorId, tagId);
	const ziele = nurDieses ? haeuser.filter((h) => h.meetingId === nurDieses) : haeuser;
	if (ziele.length === 0) {
		throw new FachlicherFehler(
			'fremdes_haus',
			'Diese Versammlung gehört nicht zu diesem Abend.',
			'meeting'
		);
	}

	const befund: Hausbefund[] = [];
	for (const h of ziele) {
		if (h.zustand === 'geschlossen' || h.zustand === 'versiegelt') {
			befund.push({ ...h, ergebnis: 'schon' });
			continue;
		}
		if (h.zustand !== 'laufend') {
			befund.push({
				...h,
				ergebnis: 'nicht_moeglich',
				grund: 'die Versammlung läuft nicht'
			});
			continue;
		}
		/*
		 * Gelesen wurde der Zustand oben ohne Sperre. Hat jemand dieses Haus
		 * inzwischen einzeln geschlossen, sagt `schliesseVersammlung` unter
		 * seiner Sperre ab (M7-A1); aus «laufend» führt nur der Schluss heraus,
		 * die Absage heisst also «schon geschlossen», und die übrigen Häuser
		 * kommen trotzdem dran.
		 */
		try {
			await schliesseVersammlung(handelnder, h.meetingId);
		} catch (e) {
			if (e instanceof FachlicherFehler && e.kennung === 'zustand_unpassend') {
				befund.push({ ...h, ergebnis: 'schon' });
				continue;
			}
			// Wie beim Eröffnen: Jede andere fachliche Absage ist ein Befund,
			// kein Abbruch mitten im Lauf (Codeprüfung C2, 16.10.2026).
			if (e instanceof FachlicherFehler) {
				befund.push({ ...h, ergebnis: 'nicht_moeglich', grund: e.message });
				continue;
			}
			throw e;
		}
		befund.push({ ...h, ergebnis: 'getan' });
	}
	return befund;
}

/**
 * Ein Befund als Satz — dieselbe Sprache wie beim Einlass.
 *
 * `tuwort` ist die Vergangenheitsform der Handlung: «eröffnet», «geschlossen».
 */
export function hausbefundssatz(befund: Hausbefund[], tuwort: string): string {
	const teile: string[] = [];
	const getan = befund.filter((b) => b.ergebnis === 'getan');
	const schon = befund.filter((b) => b.ergebnis === 'schon');
	if (getan.length > 0) {
		teile.push(`${tuwort}: ${getan.map((b) => b.gemeinschaft).join(', ')}`);
	}
	if (schon.length > 0) {
		teile.push(`war schon ${tuwort}: ${schon.map((b) => b.gemeinschaft).join(', ')}`);
	}
	for (const b of befund.filter((x) => x.ergebnis === 'nicht_moeglich')) {
		teile.push(`nicht möglich in ${b.gemeinschaft} — ${b.grund}`);
	}
	return teile.join(' · ');
}
