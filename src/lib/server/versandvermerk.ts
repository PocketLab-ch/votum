/**
 * Der Vermerk «Die Einladung ist verschickt» (Produktentscheid 07.10.2026,
 * «Nur noch aufmerksam machen»; vom 06.10.2026 bis 07.10.2026 «Die Einladung ist
 * bei allen angekommen», davor «Die Einladung ist hinausgegangen»). Er ist eine
 * Angabe der Sitzungsleitung, kein Nachweis des Empfangs.
 *
 * **Ein Hilfsmittel, kein Zwangsinstrument** (Auftraggeber, 02.09.2026). Er schaltet die
 * Erinnerung ab und sonst nichts: keine Rechte, keine Schranke, keine Aussage
 * über den Postausgang der Bewirtschaftung. Wer ihn versehentlich setzt, nimmt
 * ihn zurück.
 *
 * **Vom 06.10.2026 bis 07.10.2026 mit einer Wirkung mehr** (Produktentscheid
 * «Erste Einladung gilt», `einladungsmehr.ts`): Wurde das Mehr nach der
 * Freigabe gemildert, galt es beim Eröffnen nur, wenn danach ein Versand
 * vermerkt war. Seit dem Produktentscheid 07.10.2026 («Nur noch aufmerksam
 * machen») gilt der Satz oben wieder: Nach einer Milderung nimmt der Vermerk
 * nur Hinweis und Erinnerung weg, das Mehr bleibt.
 *
 * **Zwei Wege, ein Feld.** In der Anwendung setzt ihn ein angemeldeter Mensch;
 * aus der Erinnerungsmail heraus setzt ihn ein Link, hinter dem kein Konto
 * steht. Beide schreiben dieselbe Spalte und dasselbe Ereignis — mit dem
 * Unterschied im Text, weil er zählt: Der eine Weg weiss, wer es war, der
 * andere nur, dass jemand den Link aus dem richtigen Postfach hatte.
 */
import { createHash, randomBytes } from 'node:crypto';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';
import { kalendertag } from '$lib/domain/datum';
import { neuversandVermerkt } from '$lib/domain/einladungsmehr';
import { versandfrist } from '$lib/domain/einberufungsfrist';

/** So heisst der Weg im Vermerk, wenn er aus der Mail kam. */
export const WEG_UEBER_LINK = 'über den Link in der Erinnerung';

/**
 * Wie lang die Marke ist.
 *
 * 32 Bytes, wie beim Sitzungsmerkmal in `zugangssitzung.ts`. Sie steht in einer
 * Mail und damit in fremden Postfächern, Sicherungen und womöglich Protokollen
 * eines Mailservers — geraten werden können soll sie trotzdem nicht.
 */
const MARKENBYTES = 32;

/**
 * Der Prüfwert einer Marke.
 *
 * **Ohne Salz und ohne Streckung**, wie bei den Zugangscodes: Die Marke ist
 * selbst schon Zufall in voller Länge, ein Wörterbuchangriff hat daran nichts
 * zu suchen. Was der Prüfwert leistet, ist das Eine, worauf es ankommt: Wer die
 * Datenbank liest, kann daraus keinen gültigen Link bauen.
 */
export function markenPruefwert(marke: string): string {
	return createHash('sha256').update(marke, 'utf8').digest('hex');
}

/**
 * Eine frische Marke im Klartext — für die Mail.
 *
 * **Erzeugen und Ablegen sind getrennt** (Code-Review 02.09.2026). Der Text der
 * Erinnerung braucht die Marke, bevor die Mail hinausgeht; gelten soll sie aber
 * erst, wenn der Versand gelungen ist. Wäre beides eins, entwertete ein
 * misslungener Versand den Link der zuletzt zugestellten Erinnerung.
 */
export function neueMarke(): string {
	return randomBytes(MARKENBYTES).toString('base64url');
}

/**
 * Legt den Prüfwert einer Marke ab.
 *
 * Eine bestehende Marke wird dabei überschrieben: Es gilt immer nur der Link
 * aus der zuletzt verschickten Erinnerung. Sonst sammelten sich über die Wochen
 * mehrere gültige Links zur selben Versammlung an.
 *
 * **Mit `merker` nur, wenn sich seit dem Beanspruchen nichts geändert hat**
 * (Codeprüfung Teil 2 Runde 3, N1). Der Erinnerungsdienst gibt den Merker als
 * Text mit, wie er ihn gesetzt hat. Steht er nicht mehr so da, oder ist seither
 * eine Milderung gefallen (`released_requirement_relaxed_at` nach dem Merker),
 * wird die Marke verworfen: Die Mail, die sie trägt, kennt diese Milderung
 * nicht, und ihr Link bestätigte sonst eine Einladung, von der sie nichts
 * wusste. Die Milderung selbst verbraucht nur eine Marke, die schon liegt; diese
 * hier kam zwischen Versand und Ablegen. `false` heisst: nicht abgelegt.
 */
export async function legeMarkeAb(
	operatorId: Id,
	meetingId: Id,
	marke: string,
	merker?: string
): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx`
			UPDATE meeting
			   SET invitation_reminder_token_hash = ${markenPruefwert(marke)}
			 WHERE id = ${meetingId}
			   AND (${merker ?? null}::text IS NULL
			        -- Als Text übergeben und erst hier gewandelt: Ein Parameter vom Typ
			        -- timestamptz liefe durch ein Date und verlöre die Mikrosekunden.
			        OR (invitation_reminder_sent_at = (${merker ?? null}::text)::timestamptz
			            AND NOT EXISTS (
			                SELECT 1 FROM agenda_item a
			                 WHERE a.meeting_id = meeting.id
			                   AND a.released_requirement_relaxed_at > meeting.invitation_reminder_sent_at)))
			RETURNING id
		`;
		return zeilen.length === 1;
	});
}

/**
 * Der Kalendertag in hiesiger Zeit.
 *
 * **Nicht `toISOString().slice(0, 10)`** (Code-Review 02.09.2026): Das ist der
 * UTC-Tag. Ein Vermerk um halb eins nachts erschiene als der Vortag, und der
 * Test darauf würde in genau diesem Fenster rot — einmal im Jahr, nachts, ohne
 * dass sich etwas geändert hätte. Dieselbe Rechnung wie überall sonst im Haus.
 */
export function hiesigerTag(zeitpunkt: Date): string {
	return zeitpunkt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

export type Vermerkausgang = 'gesetzt' | 'schon_vermerkt' | 'unbekannt';

export interface Markenvorschau {
	gemeinschaft: string;
	tag: string;
	/** Ob schon jemand vermerkt hat — dann sagt die Seite es vorab. */
	schonVermerkt: boolean;
}

/**
 * Sieht nach, wozu eine Marke gehört, **ohne sie zu verbrauchen**.
 *
 * Für die Seite hinter dem Link: Sie soll sagen, um welche Versammlung es geht,
 * bevor jemand etwas bestätigt. Ein Vorabruf durch einen Mailserver darf hier
 * ankommen, ohne Schaden anzurichten — deshalb liest diese Funktion nur.
 *
 * Sie läuft ohne Mandantenkontext und deshalb über die Datenbankfunktion aus
 * Migration 102; herausgegeben wird nur, was ohnehin in der Mail steht, die den
 * Link enthält. Ein gewöhnliches `SELECT` bekäme hier die leere Menge — `meeting`
 * steht unter RLS mit `FORCE`.
 */
export async function schauMarkeAn(marke: string): Promise<Markenvorschau | null> {
	const [z] = await sql<{ gemeinschaft: string; tag: Date; schon_vermerkt: boolean }[]>`
		SELECT * FROM einladung_marke_ansehen(${markenPruefwert(marke)})
	`;
	if (!z) return null;
	return {
		gemeinschaft: z.gemeinschaft,
		// `meeting_date` ist eine `date`-Spalte und trägt keine Zone — dafür ist
		// `kalendertag` da, nicht `hiesigerTag`. Ein Verhaltensunterschied besteht
		// nicht (in vier Prozesszonen nachgemessen, Zürich liegt östlich von UTC);
		// falsch war das Werkzeug, nicht das Ergebnis.
		tag: kalendertag(z.tag),
		schonVermerkt: z.schon_vermerkt
	};
}

export interface NeuversandDerMarke {
	/** Steht nach einer Milderung des Mehrs eine berichtigte Einladung aus? */
	ausstehend: boolean;
	/** Der letzte Fristtag als Kalendertag, `null` ohne erfasste Frist. */
	frist: string | null;
	/** Ob dieser Tag vorbei ist. Ohne Frist nie. */
	fristVorbei: boolean;
}

/**
 * Ob hinter einer Marke nach einer Milderung eine berichtigte Einladung
 * aussteht, **ohne die Marke zu verbrauchen** (Korrekturrunde 06.10.2026).
 *
 * **Dieselbe Bedingung wie Dienst und Hinweis** (`neuversandVermerkt`).
 * Die Linkseite fragt dann nach der berichtigten Einladung und ihrem letzten
 * Tag; nach diesem Tag sagt sie bedingt dazu, dass sie nicht mehr rechtzeitig
 * ankommt, falls sie noch nicht verschickt ist (Fachprüfung B1, Runde 1). Seit dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen»)
 * erledigt jeder Vermerk nach der Milderung sie; bis dahin machte ein Vermerk
 * nach dem letzten Tag das mildere Mehr nicht gültig, und die Seite fragte
 * dann gar nicht mehr.
 *
 * Über die Datenbankfunktion aus Migration 146, aus demselben Grund wie
 * `schauMarkeAn`: Hier gibt es keinen Mandantenkontext.
 */
export async function schauNeuversandAn(
	marke: string,
	heute: string = hiesigerTag(new Date())
): Promise<NeuversandDerMarke> {
	const [z] = await sql<
		{
			milderung_seit: Date | null;
			vermerkt_am: Date | null;
			versammlungstag: Date;
			frist_tage: number | null;
		}[]
	>`
		SELECT * FROM einladung_marke_neuversand(${markenPruefwert(marke)})
	`;
	if (!z || !z.milderung_seit) return { ausstehend: false, frist: null, fristVorbei: false };
	const frist = versandfrist(kalendertag(z.versammlungstag), z.frist_tage);
	const ausstehend = !neuversandVermerkt({ vermerkt: z.vermerkt_am, gemildertAm: z.milderung_seit });
	return { ausstehend, frist, fristVorbei: frist !== null && heute > frist };
}

export interface Einloesung {
	ausgang: Vermerkausgang;
	/** Für den Satz auf der Seite — nur bei `gesetzt` und `schon_vermerkt` gefüllt. */
	gemeinschaft: string | null;
	tag: string | null;
}

/**
 * Löst die Marke aus der Mail ein.
 *
 * **Ohne angemeldeten Betreiber**, deshalb über die Datenbankfunktion aus
 * Migration 102 statt über `alsBetreiber`: Der Mandant steht nicht im Kontext,
 * er ergibt sich aus der Marke. Dasselbe Muster trägt seit Migration 018 den
 * Zugang des Eigentümers.
 *
 * Der Verlaufseintrag entsteht danach im Namen des Betreibers, den die Funktion
 * zurückgibt. Er ist der Grund, warum die Funktion ihn überhaupt herausreicht.
 */
export async function loeseMarkeEin(marke: string): Promise<Einloesung> {
	const [z] = await sql<
		{
			ausgang: Vermerkausgang;
			versammlung: string | null;
			betreiber: string | null;
			gemeinschaft: string | null;
			tag: Date | null;
		}[]
	>`
		SELECT * FROM einladung_versand_vermerken(
			${markenPruefwert(marke)},
			${WEG_UEBER_LINK}
		)
	`;

	if (!z || z.ausgang === 'unbekannt' || !z.versammlung || !z.betreiber) {
		return { ausgang: 'unbekannt', gemeinschaft: null, tag: null };
	}

	// Auch hier eine `date`-Spalte: siehe `schauMarkeAn`.
	const tag = z.tag ? kalendertag(z.tag) : null;

	if (z.ausgang === 'gesetzt') {
		await alsBetreiber(z.betreiber, async (tx) => {
			await schreibeVerlauf(
				tx,
				{ operatorId: z.betreiber!, userId: null, label: WEG_UEBER_LINK },
				ereignis(
					EREIGNISARTEN.einladungVersandVermerkt,
					{ art: 'meeting', id: z.versammlung! },
					{ gesetzt: true, weg: 'link' }
				)
			);
		});
	}

	return { ausgang: z.ausgang, gemeinschaft: z.gemeinschaft, tag };
}

/**
 * Setzt oder nimmt den Vermerk in der Anwendung — mit angemeldetem Menschen.
 *
 * **Umkehrbar, und die Rücknahme ist kein Sonderfall.** Wer aus Versehen
 * anklickt, klickt zurück; beides steht als dasselbe Ereignis im Verlauf, nur
 * mit `gesetzt: true` beziehungsweise `false`. Die Marke aus der Mail wird bei
 * beidem verbraucht: Nach einer Aussage in der Anwendung soll der alte Link
 * nicht mehr dagegenhalten können.
 */
export async function vermerkeVersand(
	handelnder: Handelnder & { operatorId: Id },
	meetingId: Id,
	gesetzt: boolean
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Der erste Vermerk behält seinen Zeitpunkt** (Code-Review 02.09.2026).
		 * Ohne `COALESCE` schrieb ein zweiter Klick — aus einem alten Reiter, oder
		 * von jemand anderem — Tag und Person des schon stehenden Vermerks um.
		 * Genau das vermeidet die Datenbankfunktion für den Weg aus der Mail
		 * seit Migration 102; die beiden Wege liefen darin auseinander.
		 *
		 * Beim Entfernen wird auf NULL gesetzt, und ein danach neu gesetzter
		 * Vermerk trägt richtigerweise das neue Datum: `COALESCE` greift dann auf
		 * nichts mehr zurück.
		 */
		/*
		 * **Ein folgenloses Speichern ist keine Aussage** (02.09.2026, zweite
		 * Runde des Code-Reviews). Seit das Kästchen selbst sendet, lässt sich der
		 * Knopf drücken, ohne etwas zu ändern — und das lief bis hierher durch:
		 * Es nullte `invitation_reminder_token_hash`, entwertete damit den
		 * Einmallink der schon verschickten Erinnerung, und hinterliess einen
		 * Verlaufseintrag über einen Vorgang, der nichts vermerkt hat.
		 *
		 * Der Absatz oben begründet das Verbrauchen der Marke mit «nach einer
		 * Aussage in der Anwendung». Genau daran hängt es jetzt: Ändert sich der
		 * Zustand nicht, greift das `WHERE` nicht, und es geschieht nichts.
		 *
		 * Der Weg aus der Mail zieht dieselbe Grenze seit Migration 102 — er
		 * antwortet dort mit `schon_vermerkt`.
		 */
		const geaendert = await tx`
			UPDATE meeting
			   SET invitation_sent_marked_at      = ${gesetzt
					? tx`COALESCE(invitation_sent_marked_at, now())`
					: tx`NULL`},
			       invitation_sent_marked_by      = ${gesetzt
					? tx`COALESCE(invitation_sent_marked_by, ${handelnder.label})`
					: tx`NULL`},
			       invitation_reminder_token_hash = NULL
			 WHERE id = ${meetingId}
			   AND (invitation_sent_marked_at IS NOT NULL) IS DISTINCT FROM ${gesetzt}
			RETURNING id
		`;
		if (geaendert.length === 0) return;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einladungVersandVermerkt,
				{ art: 'meeting', id: meetingId },
				{ gesetzt, weg: 'anwendung' }
			)
		);
	});
}

export interface Vermerkstand {
	gesetzt: boolean;
	/** Wer es gesagt hat, im Klartext. `null`, wenn nichts vermerkt ist. */
	wer: string | null;
	/** Wann, als ISO-Tag. */
	wann: string | null;
}

/** Der Stand für die Anzeige auf der Vorbereitungsseite. */
export async function holeVersandvermerk(operatorId: Id, meetingId: Id): Promise<Vermerkstand> {
	const [z] = await alsBetreiber(operatorId, async (tx) => {
		return tx<{ marked_at: Date | null; marked_by: string | null }[]>`
			SELECT invitation_sent_marked_at AS marked_at, invitation_sent_marked_by AS marked_by
			  FROM meeting WHERE id = ${meetingId}
		`;
	});
	if (!z?.marked_at) return { gesetzt: false, wer: null, wann: null };
	return {
		gesetzt: true,
		wer: z.marked_by,
		wann: hiesigerTag(z.marked_at)
	};
}
