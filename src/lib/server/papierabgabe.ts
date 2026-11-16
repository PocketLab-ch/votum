/**
 * Wer an dieser Versammlung auf Papier abstimmt.
 *
 * Das Modell steht in Migration 107, die Wirkung auf die Begründungspflicht im
 * Kern (`pruefeStellvertretendeStimme` in `$lib/domain/abstimmung`). Hier steht
 * der Weg zur Datenbank. Jede Abfrage läuft in `alsBetreiber` und damit unter
 * der Mandantengrenze.
 *
 * **Anders als die Pendenz ist dies Teil des Siegels.** Der Auslöser
 * `paper_ballot_nach_siegel` weist jedes Schreiben an einer versiegelten
 * Versammlung ab. Das ist Absicht und nicht dieselbe Ausnahme wie dort: Eine
 * Pendenz wird nach der Versammlung abgehakt, dieser Vermerk sagt, WIE
 * abgestimmt wurde. Wer ihn nachträglich setzen könnte, machte aus einer
 * stellvertretend erfassten Stimme rückwirkend eine vereinbarte.
 *
 * **Der Verlauf hängt an der Momentaufnahme der Partei, nicht am Vermerk.**
 * Aufheben löscht die Zeile; ein Eintrag mit deren Kennung wäre danach aus
 * jedem gefilterten Verlauf verschwunden, ausgerechnet der über das Aufheben.
 * `snapshot_party` löst `verlaufsabfrage.ts` in allen drei Filtern auf und
 * überlebt. Dieselbe Lehre wie bei der Pendenz.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { fragtNachPapier } from '$lib/domain/versammlung';
import type { Betriebsart } from '$lib/domain/versammlung';
import type { Id } from '$lib/domain/types';

/**
 * Wie der Vermerk am Eingang entstanden ist. Dieselbe Vokabel wie
 * `attendance_event.channel`.
 *
 * **`gemeinschaft` ist weggefallen** (Migration 108). Der Wert war für eine
 * Voreinstellung «alle Parteien auf Papier» gedacht, und die ist die
 * Betriebsart `einfach`. Es blieben die beiden Wege des Eingangs, und nur die.
 *
 * **Aber «nur am Eingang» ist eine Vokabel, keine Schranke** (nachgetragen am
 * 10.09.2026, weil der Satz hier vorher mehr behauptete). Der Weg sagt, WOHER
 * ein Vermerk kam; er sagt nicht, WANN er entstehen durfte. Die fünf Sekunden
 * des Rückwegs sind Sache der Maske, und der Schreibweg nimmt einen Vermerk,
 * solange die Versammlung läuft.
 *
 * Das ist heute keine Rechteausweitung: Wer den Schreibweg erreicht, ist die
 * Sitzungsleitung, und für sie gilt die Vorgabe des Auftraggebers vom 09.09.2026
 * ausdrücklich: «Der Entscheid fällt am Eingang, nicht während der laufenden
 * Sitzung. Dort gilt höchstens der bestehende Weg, wenn es technische Probleme
 * gibt.» Der bestehende Weg ist genau dieser hier. Eine Frist am Vermerk («nur
 * solange der Eintritt jünger ist als X») nähme ihn weg und ersetzte ihn durch
 * eine erfundene Zahl.
 *
 * **Zur Schranke wird die Lücke an dem Tag, an dem es eine Rolle je Versammlung
 * gibt.** Dann darf jemand am Eingang stehen, ohne die Sitzung zu führen, und
 * «nur am Eingang» muss hier geprüft werden statt in der Maske. Wer diese Rolle
 * baut, kommt an dieser Stelle vorbei.
 */
export type Papierweg = 'von_hand' | 'gescannt';

export interface Papierabgabe {
	/** Kennung der Partei aus den Stammdaten, wie sie die Momentaufnahme führt. */
	parteiId: Id;
	name: string;
	weg: Papierweg;
	vermerktAm: string;
	vermerktVon: string | null;
}

/**
 * Setzt den Vermerk für eine Partei.
 *
 * **Zweimal setzen ist kein Fehler.** Am Eingang drückt jemand denselben Knopf
 * zweimal, weil die Liste inzwischen nachgeladen hat. `ON CONFLICT DO NOTHING`
 * lässt den ersten Vermerk samt seinem Urheber stehen, statt ihn durch einen
 * gleichlautenden zu ersetzen. Gemeldet wird trotzdem, ob etwas entstanden ist:
 * Ein Verlaufseintrag je Knopfdruck wäre eine Geschichte, die nicht stattfand.
 *
 * **Die Bindung an die Versammlung steht in der Abfrage.** Die Parteikennung
 * kommt aus einem Formular; ohne das `AND meeting_id = …` liesse sich eine
 * Partei aus einer fremden Versammlung vermerken. Die Schranke
 * `paper_ballot_gleiche_versammlung` hielte das zwar auf, aber als rohe
 * Datenbankmeldung.
 */
/**
 * Ob diese Versammlung am Eingang nach der Abstimmungsweise fragt.
 *
 * **Wozu die eigene Abfrage** (10.09.2026). `papiervermerkAusFormular` muss
 * «gefragt und verneint» von «gar nicht gefragt» unterscheiden können. Die
 * Formulare sagen das inzwischen selbst, aber wer der Maske glaubt, ob die Maske
 * gefragt hat, dreht sich im Kreis. Die Versammlung weiss es unabhängig davon.
 *
 * Sie kostet ein Lesen je Einlass, auch wenn die Frage abgeschaltet ist. Das ist
 * ein Schlüsselzugriff an einem Vorgang im Menschentakt.
 */
export async function fragtNachPapierabgabe(operatorId: string, meetingId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [v] = await tx<{ operation_mode: Betriebsart; ask_paper_ballot: boolean }[]>`
			SELECT operation_mode, ask_paper_ballot FROM meeting WHERE id = ${meetingId}
		`;
		if (!v) return false;
		return fragtNachPapier({ betriebsart: v.operation_mode, papierfrage: v.ask_paper_ballot });
	});
}

/**
 * Wo die Frage am Eingang gestellt wurde. Dieselben Wörter wie
 * `attendance_event.channel`, plus den Nachtrag.
 */
export type Fragweg = Papierweg | 'nachtrag';

/**
 * Hält fest, dass diese Partei am Eingang gefragt wurde (Migration 109).
 *
 * **Gespeichert wird die Frage, nicht die Antwort.** Die Antwort steht in
 * `paper_ballot`: vorhanden heisst «von Hand», fehlend heisst «digital». Was
 * fehlte, ist die dritte Lage — niemand hat gefragt —, und die sah aus wie die
 * zweite. Eine zweite Stelle mit der Antwort liefe vom Vermerk weg, sobald ihn
 * jemand zurücknimmt.
 *
 * **Zweimal fragen ist kein Fehler**, wie beim Vermerk: Wird dieselbe Karte
 * nochmals gescannt, bleibt die erste Zeile samt Urheber und Zeitpunkt stehen.
 * Geändert wird dann die Antwort, und die steht woanders.
 *
 * Ohne Verlaufseintrag, und das ist Absicht: Der Verlauf erzählt, was geschah —
 * die Anwesenheit, der Vermerk, seine Rücknahme. «Es wurde gefragt» ist keine
 * Handlung an der Versammlung, sondern die Notiz, dass eine Handlung vollständig
 * war. Ein Eintrag je Einlass verdoppelte den Verlauf, ohne etwas zu erzählen.
 */
export async function vermerkeFrageBeantwortet(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	parteiId: Id,
	weg: Fragweg
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Dieselbe Zustandsschranke wie an den beiden Nachbarn**
		 * (Sicherheitsdurchgang 10.09.2026). Der erste Anlauf verliess sich auf den
		 * Siegelauslöser — und der prüft `state = 'versiegelt'`, sonst nichts.
		 * Zwischen «geschlossen» und «versiegelt» stand das Schreiben damit offen.
		 *
		 * Das wiegt hier schwerer als beim Vermerk: Diese Zeile lässt sich nicht
		 * löschen. Wer sie nach dem Schluss noch anlegen könnte, stellte
		 * nachträglich den Anschein her, der Eingang habe gefragt — genau die
		 * Behauptung, gegen die die Tabelle gebaut ist. Der Vermerk daneben lässt
		 * sich wenigstens zurücknehmen, solange die Versammlung läuft.
		 *
		 * Die Schranke steht am Schreibweg und nicht beim Aufrufer: Im Zweig «ja»
		 * wirft `vermerkePapierabgabe` ohnehin vorher, im Zweig «nein» und beim
		 * Scanner gab es davor gar keine Prüfung.
		 */
		const [v] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId}
		`;
		if (!v) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		if (v.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				'Die Frage lässt sich nur festhalten, solange die Versammlung läuft.',
				'zustand'
			);
		}

		const [p] = await tx<{ id: string }[]>`
			SELECT id FROM snapshot_party
			 WHERE party_id = ${parteiId} AND meeting_id = ${meetingId}
		`;
		if (!p) return;
		await tx`
			INSERT INTO paper_question_answered (operator_id, meeting_id, snapshot_party_id,
			                                     channel, recorded_by, recorded_by_label)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${p.id}, ${weg},
			        ${handelnder.userId}, ${handelnder.label})
			ON CONFLICT (snapshot_party_id) DO NOTHING
		`;
	});
}

/**
 * Die Parteien, die am Eingang gefragt wurden — als Parteikennungen.
 *
 * Wer hier fehlt und trotzdem anwesend ist, wurde nie gefragt. Das ist die
 * Nachtragsliste; sie steht in `domain/stimmabgabe`, weil zwei Masken sie
 * brauchen und die Regel keine Datenbank sehen muss.
 */
export async function holeBeantwortete(operatorId: Id, meetingId: Id): Promise<Id[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ party_id: string }[]>`
			SELECT s.party_id
			  FROM paper_question_answered a
			  JOIN snapshot_party s ON s.id = a.snapshot_party_id
			 WHERE a.meeting_id = ${meetingId}
		`;
		return zeilen.map((z) => z.party_id);
	});
}

export async function vermerkePapierabgabe(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	parteiId: Id,
	weg: Papierweg
): Promise<boolean> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Der Schalter wirkt hier und nicht in der Maske** (10.09.2026).
		 *
		 * Bis hierher war «fragt diese Versammlung nach Papier?» eine reine
		 * Anzeigeentscheidung: Die Masken stellten die Frage nur bei
		 * `fragtNachPapier`, der Schreibweg glaubte aber jedem Formular, das
		 * `papier=ja` mitschickte. Wer die Frage abgeschaltet hatte, bekam den
		 * Vermerk trotzdem gesetzt — und ein gesetzter Vermerk sperrt das Telefon
		 * der Partei.
		 *
		 * Aufgefallen ist es beim Anschluss des gemeinsamen Abends: Dort steht
		 * eine Liste über mehrere Häuser, und die Frage hängt am einzelnen Haus.
		 * Eine Maske, die eine Zeile dem falschen Haus zuordnet, wäre sonst
		 * nirgends aufgehalten worden.
		 *
		 * **Nur beim Setzen, nicht beim Aufheben.** Wird der Schalter nach dem
		 * Einlass umgelegt, müssen bestehende Vermerke zurücknehmbar bleiben —
		 * sonst sperrte ein abgeschalteter Schalter die Korrektur seiner eigenen
		 * Folgen ein.
		 */
		const [v] = await tx<
			{ state: string; operation_mode: Betriebsart; ask_paper_ballot: boolean }[]
		>`
			SELECT state, operation_mode, ask_paper_ballot FROM meeting WHERE id = ${meetingId}
		`;
		if (!v) {
			throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		}
		/*
		 * **Und dieselbe Zustandsschranke wie beim Aufheben** (10.09.2026, im
		 * Code-Review gefunden). Bisher trugen sie die Aufrufer: Jeder Setzweg lief
		 * über `bestaetigeAnwesenheit`, und das verlangt `nurLaufend`. Der Nachtrag
		 * am gemeinsamen Abend schreibt ohne Anwesenheitsereignis und hatte die
		 * Schranke damit nicht mehr im Rücken.
		 *
		 * Zwischen «geschlossen» und «versiegelt» wäre so ein Vermerk entstanden,
		 * den `hebePapierabgabeAuf` nicht mehr wegnimmt — eine Aussage über die
		 * Abstimmungsweise, nachträglich gesetzt und nicht mehr zu berichtigen.
		 * Genau die Asymmetrie, die dort schon einmal die falsche Richtung hatte.
		 */
		if (v.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				'Der Vermerk lässt sich nur setzen, solange die Versammlung läuft.',
				'zustand'
			);
		}
		if (!fragtNachPapier({ betriebsart: v.operation_mode, papierfrage: v.ask_paper_ballot })) {
			throw new FachlicherFehler(
				'papierfrage_aus',
				v.operation_mode === 'einfach'
					? 'Diese Versammlung läuft in der Betriebsart «einfach». Dort erfasst die ' +
						'Sitzungsleitung ohnehin alle Stimmen.'
					: 'Die Frage «digital oder von Hand» ist für diese Versammlung abgeschaltet.',
				'papierfrage'
			);
		}

		const [p] = await tx<{ id: string; display_name: string }[]>`
			SELECT id, display_name FROM snapshot_party
			 WHERE party_id = ${parteiId} AND meeting_id = ${meetingId}
		`;
		if (!p) {
			throw new FachlicherFehler(
				'unbekannte_partei',
				'Diese Partei steht nicht in der Liste der Stimmberechtigten dieser Versammlung.',
				'parteiId'
			);
		}

		const neu = await tx<{ id: string }[]>`
			INSERT INTO paper_ballot (operator_id, meeting_id, snapshot_party_id, channel,
			                          recorded_by, recorded_by_label)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${p.id}, ${weg},
			        ${handelnder.userId}, ${handelnder.label})
			ON CONFLICT (snapshot_party_id) DO NOTHING
			RETURNING id
		`;
		if (neu.length === 0) return false;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.papierabgabeGesetzt,
				{ art: 'snapshot_party', id: p.id },
				{ partei: p.display_name, weg }
			)
		]);
		return true;
	});
}

/**
 * Nimmt den Vermerk zurück.
 *
 * **Löschen und nicht ein zweiter Vermerk.** Bei der Anwesenheit ist die
 * Gegenbewegung ein eigenes Ereignis, weil «gekommen und wieder gegangen» eine
 * Geschichte ist, die das Protokoll erzählen muss. Hier gibt es nichts zu
 * erzählen, was der Verlauf nicht besser erzählt: Am Ende zählt, ob die Partei
 * auf Papier abgestimmt hat oder nicht.
 */
export async function hebePapierabgabeAuf(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	parteiId: Id
): Promise<boolean> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Dieselbe Schranke wie beim Setzen** (09.09.2026, aus dem
		 * Sicherheitsdurchgang). Gesetzt wird der Vermerk nur über die
		 * Einlasshandlungen, und die verlangen alle `nurLaufend`. Das Aufheben
		 * hatte keine Schranke und war zwischen «geschlossen» und «versiegelt»
		 * noch möglich.
		 *
		 * Als Sicherheitslücke taugt das nicht — der Handelnde ist eine ohnehin
		 * berechtigte Sitzungsleitung, und die gefährliche Richtung ist das
		 * Hinzufügen, nicht das Wegnehmen. Falsch ist es trotzdem: Ein Vermerk,
		 * der nach dem Schluss verschwindet, behauptet rückwirkend, die Partei
		 * habe digital abgestimmt, während ihre Stimmen in Wahrheit übertragen
		 * wurden. Das ist derselbe Eingriff in den Nachweis wie das nachträgliche
		 * Setzen, nur mit umgekehrtem Vorzeichen.
		 */
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) {
			throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		}
		if (m.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				'Der Vermerk lässt sich nur zurücknehmen, solange die Versammlung läuft.',
				'zustand'
			);
		}

		const weg = await tx<{ id: string; display_name: string }[]>`
			DELETE FROM paper_ballot b
			 USING snapshot_party s
			 WHERE b.snapshot_party_id = s.id
			   AND b.meeting_id = ${meetingId}
			   AND s.party_id = ${parteiId}
			RETURNING s.id, s.display_name
		`;
		if (weg.length === 0) return false;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.papierabgabeAufgehoben,
				{ art: 'snapshot_party', id: weg[0].id },
				{ partei: weg[0].display_name }
			)
		]);
		return true;
	});
}

/** Alle Parteien dieser Versammlung, die auf Papier abstimmen. */
export async function holePapierabgaben(
	operatorId: Id,
	meetingId: Id
): Promise<Papierabgabe[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				party_id: string;
				display_name: string;
				channel: string;
				recorded_at: Date;
				recorded_by_label: string | null;
			}[]
		>`
			SELECT s.party_id, s.display_name, b.channel, b.recorded_at, b.recorded_by_label
			  FROM paper_ballot b
			  JOIN snapshot_party s ON s.id = b.snapshot_party_id
			 WHERE b.meeting_id = ${meetingId}
			 ORDER BY s.display_name
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			name: z.display_name,
			weg: z.channel as Papierweg,
			vermerktAm: z.recorded_at.toISOString(),
			vermerktVon: z.recorded_by_label
		}));
	});
}
