/**
 * Die Erinnerung an den Versand der Einladung (Auftraggeber, 28.08.2026; Auslöser
 * freigegeben am 01.09.2026).
 *
 * **Was hier geschieht.** Einmal je Lauf wird gefragt, für welche Versammlungen
 * die Versandfrist naht und keine Einladung hinausgegangen ist. Für jede davon
 * geht **eine** Nachricht an die Bewirtschaftung, und der Merker in der
 * Datenbank sorgt dafür, dass es bei der einen bleibt.
 *
 * **Und wieder nach jeder Rücknahme der Freigabe** (Produktentscheide
 * 06.10.2026, «Rücknahme setzt den Merker zurück» und «Seit Rücknahme
 * zählen»; Migration 147). Die Rücknahme leert den Merker
 * (`loescheEinladungsmehrBeiRuecknahme`), und «Einladung erzeugt» zählt nur,
 * wenn es nach der letzten Rücknahme vermerkt wurde. Nach der neuen Freigabe
 * ist die Einladung eine neue, und an ihren Versand wird erinnert wie an den
 * ersten.
 *
 * **Warum die Reihenfolge «merken, dann senden» ist.** Andersherum schickte ein
 * Absturz zwischen Versand und Merker beim nächsten Lauf dieselbe Nachricht
 * nochmals — und der nächste Lauf kommt in einer Stunde. Der Merker wird
 * deshalb **beansprucht**, bevor gesendet wird, und bei einem Fehlschlag wieder
 * freigegeben. Das Beanspruchen ist zugleich die Sperre gegen zwei gleichzeitig
 * laufende Dienste: `WHERE invitation_reminder_sent_at IS NULL` trifft nur
 * einmal.
 *
 * **Und einmal nach jeder Milderung des Mehrs** (Produktentscheid 06.10.2026,
 * «Ja, erneut erinnern»; Migration 145). Dann gilt der Merker als frei, wenn er
 * älter ist als die Milderung, bis die berichtigte Einladung gültig vermerkt
 * ist. Zurückgesetzt wird er dafür nicht; das tut allein die Rücknahme der
 * Freigabe.
 *
 * **Der Zeitgeber gehört keinem Betreiber.** Wer die Kandidaten findet, steht
 * deshalb in einer Datenbankfunktion, die den Zeilenschutz umgeht — sie gibt
 * nur zwei Kennungen heraus (Migration 099). Alles Weitere liest dieses Modul
 * im Kontext des gefundenen Betreibers, also wieder unter dem Zeilenschutz.
 */
import type postgres from 'postgres';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf } from './audit';
import { istEingerichtet, verschickeNachricht } from './mail';
import {
	erinnerungsfall,
	postlage,
	type Erinnerungsart,
	type Erinnerungsfall
} from '$lib/domain/einberufungsfrist';
import { neuversandVermerkt } from '$lib/domain/einladungsmehr';
import { betreffFuerErinnerung, textFuerErinnerung } from '$lib/domain/mailversand';
import { datumLang } from '$lib/domain/datum';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { legeMarkeAb, neueMarke } from './versandvermerk';
import { festeHerkunft } from './herkunft';
import { VERMERKPFAD } from '$lib/domain/oeffentlich';

/** Wer den Lauf im Verlauf unterschreibt. Keine Person — der Dienst selbst. */
const ZEITGEBER = 'Zeitgeber';

export interface Erinnerungsbericht {
	geprueft: number;
	verschickt: number;
	/**
	 * Warum eine Erinnerung unterblieb, **obwohl jemand etwas tun müsste** — je
	 * Versammlung ein Satz, für das Protokoll des Dienstes.
	 *
	 * **Nicht jeder Verzicht gehört hierhin.** «Heute noch nicht fällig» ist der
	 * Regelfall und stünde stündlich in jedem Protokoll; was bliebe, wäre ein
	 * Protokoll, in dem niemand mehr die Zeile findet, wegen der er hineinsieht.
	 * Solche Fälle zählt `stillGelassen`.
	 */
	uebersprungen: string[];
	/** Wie viele aus dem Regelfall heraus übergangen wurden. */
	stillGelassen: number;
	fehlgeschlagen: string[];
}

export interface Laufoptionen {
	/** Der heutige Kalendertag. Übergeben, damit der Lauf prüfbar ist. */
	heute?: string;
	/**
	 * Wer verschickt. Vorgabe ist der Mailausgang; im Test steht hier ein
	 * Empfänger, der die Nachricht aufhebt statt sie hinauszugeben.
	 */
	versende?: (an: string, betreff: string, text: string) => Promise<void>;
}

interface Kandidat {
	operator_id: string;
	meeting_id: string;
}

interface Angaben {
	meeting_tag: string;
	start_time: string;
	location: string;
	stweg_name: string;
	invitation_lead_days: number | null;
	invitation_lead_source: string | null;
	reminder_address: string | null;
	operator_name: string;
	/**
	 * Ist die Einladung erzeugt, und zwar seit der letzten Rücknahme der
	 * Freigabe (`vermerkt_seit_ruecknahme`, Migration 147)?
	 */
	versendet: boolean;
	/** Hat jemand von Hand gesagt, die Einladung sei hinaus? (Migration 102) */
	vermerkt: boolean;
	state: string;
	invitation_sent_marked_at: Date | null;
	/**
	 * Die letzte Milderung eines Traktandums, dessen berichtigte Einladung
	 * aussteht (Migration 144), oder `null`.
	 */
	milderung_seit: Date | null;
	/** Diese Traktanden, je als «Nummer Titel», in der Reihenfolge der Liste. */
	gemildert: string[];
}

function heuteHier(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Ein Durchgang. Meldet, was er getan und was er gelassen hat.
 *
 * Wirft nicht: Ein Zeitgeber, der beim ersten unerreichbaren Mailserver
 * abbricht, erinnert an die übrigen Versammlungen nie.
 */
export async function erinnerungslauf(optionen: Laufoptionen = {}): Promise<Erinnerungsbericht> {
	const heute = optionen.heute ?? heuteHier();
	/*
	 * **Wer verschickt, entscheidet auch, ob ein Mailausgang nötig ist.** Steht im
	 * Lauf ein eigener Empfänger — im Test —, braucht es keinen; sonst ist ein
	 * fehlender Ausgang der Grund, aus dem nichts hinausgeht.
	 */
	const eigenerVersand = optionen.versende !== undefined;
	const versende = optionen.versende ?? verschickeNachricht;
	const bericht: Erinnerungsbericht = {
		geprueft: 0,
		verschickt: 0,
		uebersprungen: [],
		stillGelassen: 0,
		fehlgeschlagen: []
	};

	const kandidaten = await sql<Kandidat[]>`
		SELECT operator_id, meeting_id
		  FROM faellige_einladungserinnerungen(${EREIGNISARTEN.einladungErzeugt})
	`;

	for (const k of kandidaten) {
		bericht.geprueft++;
		try {
			const ergebnis = await eineErinnerung(k, heute, versende, eigenerVersand);
			if (ergebnis === null) bericht.verschickt++;
			else if (ergebnis.meldenswert) bericht.uebersprungen.push(`${k.meeting_id}: ${ergebnis.grund}`);
			else bericht.stillGelassen++;
		} catch (fehler) {
			const grund = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler';
			bericht.fehlgeschlagen.push(`${k.meeting_id}: ${grund}`);
			console.error(`Erinnerung an den Einladungsversand fehlgeschlagen (${k.meeting_id}):`, grund);
		}
	}

	return bericht;
}

/** Warum keine Erinnerung ging — und ob das jemanden angeht. */
interface Verzicht {
	grund: string;
	/** Ob jemand etwas tun müsste. Der Regelfall («noch nicht fällig») nicht. */
	meldenswert: boolean;
}

const REGELFALL = (grund: string): Verzicht => ({ grund, meldenswert: false });
const HANDLUNGSBEDARF = (grund: string): Verzicht => ({ grund, meldenswert: true });

/**
 * Eine einzelne Erinnerung. Gibt `null` zurück, wenn sie hinausgegangen ist,
 * sonst den Grund, weshalb nicht.
 */
async function eineErinnerung(
	k: Kandidat,
	heute: string,
	versende: (an: string, betreff: string, text: string) => Promise<void>,
	eigenerVersand: boolean
): Promise<Verzicht | null> {
	/*
	 * **Lesen, entscheiden und beanspruchen in einer Transaktion, die Zeile der
	 * Versammlung gesperrt** (Codeprüfung N1, Korrekturrunde 06.10.2026).
	 * `achteEinladungsmehr` sperrt dieselbe Zeile, bevor es mildert oder
	 * zurückstellt. Ohne die Sperre konnte eine Milderung oder ein Rückweg
	 * zwischen Lesen und Beanspruchen fallen, und die Mail nannte einen Stand,
	 * den es nicht mehr gab. Verschickt wird weiter ausserhalb: merken, dann
	 * senden, damit kein Mailserver eine Sperre hält.
	 */
	const pruefung = await alsBetreiber(k.operator_id, async (tx) =>
		pruefeUndBeanspruche(tx, k, heute, eigenerVersand)
	);
	if ('verzicht' in pruefung) return pruefung.verzicht;
	const { angaben, fall, ausstehend, an, merker } = pruefung;
	const abgelaufen = fall.art === 'abgelaufen';

	/*
	 * **Die Marke wird erzeugt, aber erst nach dem Versand abgelegt.**
	 *
	 * Sie im Voraus abzulegen entwertet den Link der zuletzt zugestellten
	 * Erinnerung, weil je Versammlung nur eine Marke gilt. Scheitert der Versand
	 * danach, stünde der Empfänger mit einem toten Link da und bekäme keine neue
	 * Mail — die alte war die einzige, die je ankam (Code-Review 02.09.2026).
	 *
	 * **Auch nach einer Milderung und abgelaufener Frist eine Marke**
	 * (Produktentscheid 07.10.2026, «Nur noch aufmerksam machen»): Jeder Vermerk
	 * nach der Milderung erledigt Hinweis und Erinnerung (`neuversandVermerkt`),
	 * also hat der Link auch dann einen Zweck. Von der Codeprüfung N6
	 * (Korrekturrunde 06.10.2026) bis 07.10.2026 trug die Mail in diesem Fall
	 * keinen Link, weil ein Vermerk nach dem letzten Fristtag das mildere Mehr
	 * nicht gültig machte.
	 */
	const herkunft = festeHerkunft();
	const marke = herkunft ? neueMarke() : null;

	const texte = {
		gemeinschaft: angaben.stweg_name,
		datum: datumLang(angaben.meeting_tag),
		uhrzeit: angaben.start_time,
		ort: angaben.location,
		frist: datumLang(fall.frist),
		tage: angaben.invitation_lead_days ?? 0,
		fundstelle: angaben.invitation_lead_source,
		absenderName: angaben.operator_name,
		bestaetigungslink: marke ? `${herkunft}${VERMERKPFAD}/${marke}` : null,
		gemildert: ausstehend ? angaben.gemildert : undefined,
		vorbereitungslink:
			ausstehend && herkunft ? `${herkunft}/versammlungen/${k.meeting_id}/vorbereitung` : null,
		// Nach dem letzten Werktag vor der Frist reicht keine Post mehr, am Samstag
		// vor einem Werktag-Montag nur noch knapp (`postlage`; allgemeine Feiertage
		// zählen seit 06.10.2026, `feiertage.ts`; Fachprüfung Teil 2 Runde 3, F3,
		// und Korrekturrunde). `postZuSpaet` braucht die Mail daneben nicht mehr.
		fristtag: fall.frist === heute,
		postlage: postlage(heute, fall.frist)
	};

	try {
		await versende(
			an,
			betreffFuerErinnerung(texte, abgelaufen),
			textFuerErinnerung(texte, abgelaufen)
		);
	} catch (fehler) {
		await gibFrei(k);
		throw fehler;
	}

	/*
	 * **Erst jetzt gilt der Link**: Die Mail, die ihn trägt, ist angenommen.
	 *
	 * **Und ein Fehlschlag hier darf den Lauf nicht abbrechen** (Code-Review
	 * 02.09.2026). Die Mail ist draussen; würde die Ausnahme weiterfliegen,
	 * unterbliebe der Verlaufseintrag über eine Erinnerung, die es gegeben hat.
	 * Der Merker bleibt richtigerweise beansprucht — was verlorengeht, ist allein
	 * der bequeme Weg aus der Mail, und der ist ein Hilfsmittel.
	 */
	if (marke) {
		try {
			// Nur, wenn seither keine Milderung und keine Rücknahme gefallen ist (`legeMarkeAb`).
			const abgelegt = await legeMarkeAb(k.operator_id, k.meeting_id, marke, merker);
			if (!abgelegt) {
				console.info(
					`Erinnerung an ${k.meeting_id}: seit dem Versand milder geworden oder zurückgenommen, der Link darin gilt nicht.`
				);
			}
		} catch (fehler) {
			console.error(
				`Erinnerung an ${k.meeting_id} ging hinaus, der Link dazu liess sich nicht ablegen:`,
				fehler
			);
		}
	}

	/*
	 * **Auch der Verlaufseintrag darf den Lauf nicht abbrechen** (Code-Review
	 * 02.09.2026). Zehn Zeilen darüber steht dieselbe Begründung für die Marke;
	 * hier fehlte sie. Fällt die Datenbank zwischen Versand und Eintrag aus, ist
	 * die Mail draussen und der Merker beansprucht — eine Ausnahme an dieser
	 * Stelle meldet den Lauf als «fehlgeschlagen», obwohl der Empfänger die
	 * Erinnerung im Postfach hat, und macht den fehlenden Eintrag nicht
	 * ungeschehen.
	 *
	 * Der Verlust ist trotzdem einer, der jemanden angeht: Ohne den Eintrag lässt
	 * sich «ich habe nie eine Erinnerung bekommen» nicht mehr beantworten.
	 * Deshalb steht er deutlich im Protokoll des Containers.
	 */
	try {
		await alsBetreiber(k.operator_id, async (tx) => {
			await schreibeVerlauf(
				tx,
				{ operatorId: k.operator_id, userId: null, label: ZEITGEBER },
				ereignis(
					EREIGNISARTEN.einladungErinnert,
					{ art: 'meeting', id: k.meeting_id },
					{
						// Die Adresse gehört dazu: «ich habe nie eine Erinnerung bekommen»
						// lässt sich ohne sie nicht beantworten.
						adresse: an,
						art: fall.art,
						frist: fall.frist,
						tage: angaben.invitation_lead_days,
						// Ein bekanntes Verlaufswort: Ohne den Grund sähe die zweite
						// Erinnerung im Verlauf aus wie eine doppelte.
						...(ausstehend ? { grund: 'Mehr seit der Freigabe gemildert' } : {})
					}
				)
			);
		});
	} catch (fehler) {
		console.error(
			`Erinnerung an ${k.meeting_id} ging hinaus, der Verlaufseintrag dazu nicht:`,
			fehler
		);
	}

	return null;
}

/** Was die Prüfung in der Transaktion ergibt: ein Verzicht, oder die beanspruchte Erinnerung. */
type Pruefung =
	| { verzicht: Verzicht }
	| { angaben: Angaben; fall: Erinnerungsfall; ausstehend: boolean; an: string; merker: string };

const verzichte = (verzicht: Verzicht): Pruefung => ({ verzicht });

/**
 * Liest die Versammlung gesperrt, entscheidet und beansprucht den Merker, alles
 * in der Transaktion des Aufrufers (`eineErinnerung` begründet, warum).
 */
async function pruefeUndBeanspruche(
	tx: postgres.TransactionSql,
	k: Kandidat,
	heute: string,
	eigenerVersand: boolean
): Promise<Pruefung> {
	/*
	 * **Erst sperren, dann lesen, in zwei Anweisungen** (Codeprüfung M1,
	 * Korrekturrunde 06.10.2026). Ein einziges `SELECT … FOR UPDATE OF m` wartet
	 * zwar auf eine laufende Milderung, prüft danach aber nur die Zeile der
	 * Versammlung neu; die Unterabfragen auf die Traktanden behielten den Stand
	 * von vor der Milderung. Unter READ COMMITTED sieht jede Anweisung nach der
	 * Sperre den festgeschriebenen Stand.
	 */
	await tx`SELECT 1 FROM meeting WHERE id = ${k.meeting_id} FOR UPDATE`;
	const [z] = await tx<Angaben[]>`
		SELECT to_char(m.meeting_date, 'YYYY-MM-DD') AS meeting_tag,
		       to_char(m.start_time, 'HH24:MI')      AS start_time,
		       m.location,
		       s.name AS stweg_name,
		       s.invitation_lead_days,
		       s.invitation_lead_source,
		       o.reminder_address,
		       o.name AS operator_name,
		       -- Seit der letzten Rücknahme der Freigabe (Migration 147), dieselbe
		       -- Bedingung wie in der Datenbankfunktion und der Vorbereitung.
		       vermerkt_seit_ruecknahme(m.id, ${EREIGNISARTEN.einladungErzeugt}) AS versendet,
		       (m.invitation_sent_marked_at IS NOT NULL) AS vermerkt,
		       m.state,
		       m.invitation_sent_marked_at,
		       (SELECT max(a.released_requirement_relaxed_at) FROM agenda_item a
		         WHERE a.meeting_id = m.id AND a.released_requirement_before IS NOT NULL)
		         AS milderung_seit,
		       ARRAY(SELECT concat_ws(' ', coalesce(a.manual_number, a.released_number), a.title)
		               FROM agenda_item a
		              WHERE a.meeting_id = m.id AND a.released_requirement_before IS NOT NULL
		              ORDER BY a.position)
		         AS gemildert
		  FROM meeting m
		  JOIN stweg s    ON s.id = m.stweg_id
		  JOIN operator o ON o.id = m.operator_id
		 WHERE m.id = ${k.meeting_id}
	`;
	const angaben = z ?? null;

	/*
	 * **Die Kandidatenliste ist eine Momentaufnahme.** Zwischen ihr und hier kann
	 * jemand die Einladung geholt haben — genau das wird unten nachgelesen. Die
	 * uebrigen Bedingungen (Zustand, Archiv) prueft die Datenbankfunktion; sie
	 * hier ein zweites Mal zu fragen brachte nichts, was in den Millisekunden
	 * dazwischen umschluege.
	 */
	if (!angaben) return verzichte(REGELFALL('nicht mehr vorhanden'));

	/*
	 * **Nach einer Milderung zählt die berichtigte Einladung** (Produktentscheid
	 * 06.10.2026, «Ja, erneut erinnern»). Ausstehend ist sie nach derselben
	 * Bedingung wie beim Hinweis (`neuversandVermerkt`): Seit dem
	 * Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») erledigt sie
	 * jeder Vermerk nach der Milderung, bis dahin nur einer bis zum letzten
	 * Fristtag. Die beiden
	 * Prüfungen darunter übergeht sie, denn die erzeugte Einladung und ein
	 * Vermerk von vor der Milderung betreffen die erste Einladung, nicht die
	 * berichtigte. Ohne ausstehende Milderung bleibt alles wie bisher, auch
	 * wenn die Datenbankfunktion die Versammlung wegen einer schon gültig
	 * vermerkten Milderung geliefert hat.
	 */
	const milderungSeit = angaben.milderung_seit;
	const marked = angaben.invitation_sent_marked_at;
	const ausstehend =
		angaben.state === 'freigegeben' &&
		milderungSeit !== null &&
		!neuversandVermerkt({ vermerkt: marked, gemildertAm: milderungSeit });

	if (!ausstehend && angaben.versendet) {
		return verzichte(REGELFALL('die Einladung ist inzwischen hinausgegangen'));
	}
	/*
	 * **Der Vermerk zählt wie der Nachweis** (02.09.2026). Die Anwendung sieht
	 * nur, was durch sie hindurchgeht; wer die Einladung im eigenen Mailprogramm
	 * geschrieben hat, sagt es hier. Genau das gestand der Mailtext bisher ein,
	 * ohne einen Weg anzubieten.
	 */
	// Grund nach dem Haken benannt (Restpunkte Runde 1, 06.10.2026, seit dem
	// Produktentscheid 07.10.2026 «… ist verschickt»); er geht nur in den Zähler
	// `stillGelassen`, angezeigt wird er nicht.
	if (!ausstehend && angaben.vermerkt) {
		return verzichte(REGELFALL('vermerkt ist, dass die Einladung verschickt ist'));
	}

	const fall = erinnerungsfall(heute, {
		versammlungsdatum: angaben.meeting_tag,
		tage: angaben.invitation_lead_days,
		versendet: false
	});
	if (!fall) return verzichte(REGELFALL('heute noch nicht fällig'));

	const an = angaben.reminder_address?.trim() ?? '';
	if (!an) {
		/*
		 * **Ohne Adresse wird nichts beansprucht.** Ein gesetzter Merker hiesse
		 * «erinnert» — und sobald jemand die Adresse nachträgt, käme die
		 * Erinnerung nie mehr. Der Lauf sagt stattdessen jedes Mal, was fehlt.
		 */
		return verzichte(HANDLUNGSBEDARF('keine Erinnerungsadresse beim Betreiber hinterlegt'));
	}
	if (!eigenerVersand && !istEingerichtet()) {
		return verzichte(HANDLUNGSBEDARF('kein Mailausgang eingerichtet'));
	}

	const merker = await beanspruche(tx, k, fall.art, ausstehend);
	if (merker === null) return verzichte(REGELFALL('bereits erinnert'));

	return { angaben, fall, ausstehend, an, merker };
}

/**
 * Den Merker beanspruchen. Gibt ihn als Text zurück (Mikrosekunden bleiben
 * erhalten, `legeMarkeAb` vergleicht damit), `null`, wenn ihn jemand anderes
 * schon hat.
 *
 * Ein einziger bedingter `UPDATE`: Zwei gleichzeitig laufende Dienste bekommen
 * hier verschiedene Antworten, und nur einer verschickt. Er läuft in der
 * Transaktion, die die Zeile schon gesperrt hat (`pruefeUndBeanspruche`).
 *
 * **Nach einer Milderung gilt der Merker als frei, wenn er älter ist als sie**
 * (`nachMilderung`, Migration 145). Dieselbe Bedingung wie in der
 * Datenbankfunktion und im selben `UPDATE`, damit die Sperre gegen zwei Läufe
 * bleibt: Der erste setzt `clock_timestamp()`, das nicht vor der Milderung
 * liegt, und der zweite trifft keine Zeile mehr.
 *
 * **Der Zeitpunkt der Milderung wird hier gelesen, nicht übergeben.** Ein
 * `Date` trägt Millisekunden, die Spalte Mikrosekunden. Läge die frühere
 * Erinnerung in derselben Millisekunde knapp vor der Milderung, wäre sie für
 * die Datenbankfunktion älter und für den übergebenen Wert nicht: Die
 * Versammlung käme jede Stunde als Kandidat und nie zur Erinnerung.
 */
async function beanspruche(
	tx: postgres.TransactionSql,
	k: Kandidat,
	art: Erinnerungsart,
	nachMilderung: boolean
): Promise<string | null> {
	// `clock_timestamp()` wie beim Mildern: der Zeitpunkt nach der Sperre, nicht
	// der Beginn der Transaktion. Mit `now()` läge ein Merker, der auf eine
	// Milderung gewartet hat, vor ihr, und der nächste Lauf erinnerte ein zweites
	// Mal an dieselbe Milderung.
	const zeilen = await tx<{ merker: string }[]>`
		UPDATE meeting
		   SET invitation_reminder_sent_at = clock_timestamp(),
		       invitation_reminder_kind    = ${art}
		 WHERE id = ${k.meeting_id}
		   AND (invitation_reminder_sent_at IS NULL
		        OR (${nachMilderung}
		            AND invitation_reminder_sent_at < (
		                SELECT max(a.released_requirement_relaxed_at) FROM agenda_item a
		                 WHERE a.meeting_id = meeting.id
		                   AND a.released_requirement_before IS NOT NULL)))
		RETURNING invitation_reminder_sent_at::text AS merker
	`;
	return zeilen[0]?.merker ?? null;
}

/**
 * Nach einem Fehlschlag: der nächste Lauf soll es nochmals versuchen.
 *
 * **Auch nach einer Milderung auf NULL**, nicht auf den Stand davor. NULL liegt
 * für die Datenbankfunktion wie für `beanspruche` vor jeder Milderung, die
 * Versammlung bleibt also Kandidat.
 *
 * **Was das kostet** (Codeprüfung N9, Korrekturrunde 06.10.2026). In der
 * Spalte gehen Zeitpunkt und Art jeder früheren Erinnerung verloren, nicht nur
 * der letzten; sie stehen im Verlauf. Und der Merker gilt danach auch für den
 * ersten Zweig aus 099 (seit 147: seit der letzten Rücknahme) als leer: Wird
 * das Mehr vor dem nächsten Lauf zurückgestellt, kann die bisherige
 * Erinnerung «noch nicht hinausgegangen» kommen, sofern seit der letzten
 * Rücknahme der Freigabe weder eine Einladung erzeugt noch ein Versand
 * vermerkt ist.
 * Die Milderung hatte den Vermerk entfernt; die Aufforderung, ihn zu setzen,
 * trifft dann zu.
 */
async function gibFrei(k: Kandidat): Promise<void> {
	await alsBetreiber(k.operator_id, async (tx) => {
		await tx`
			UPDATE meeting
			   SET invitation_reminder_sent_at = NULL,
			       invitation_reminder_kind    = NULL
			 WHERE id = ${k.meeting_id}
		`;
	});
}
