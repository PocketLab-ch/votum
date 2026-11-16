/**
 * Anwesenheit: Zugang prüfen, Ereignisse schreiben, Übersicht lesen (Epic 4).
 */
import type postgres from 'postgres';
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, zeitquelle, type Handelnder } from './audit';
import {
	beendeWegenEigenerAnwesenheit,
	bestaetigeInTx,
	erfasseInTx,
	haengeAbgelegtenNachweisAn,
	kennzeichneVerwaltungInTx,
	leseOffeneOderWirksame,
	leseWirksame,
	vermerkeVorlageInTx
} from './vollmacht';
import { begrenzeNachweise, DateiFehler, legeAb, liesHochgeladene } from './dateien';
import { leseEreignisse, schreibeEreignis } from './anwesenheitsereignisse';
import {
	brauchtNachweis,
	gleicheDrittePerson,
	mitberechtigtenhinweis,
	OHNE_NACHWEIS_DER_MITBERECHTIGUNG,
	SELBST_ERSCHIENEN,
	verlangeEinGrundEinePartei,
	type Vertretungsgrund
} from '$lib/domain/vollmacht';
import { pruefwert } from './zugaenge';
import { holeMomentaufnahme } from './freigabe';
import {
	bestaetigeEintreffen,
	erfasseVerlassen,
	lehneAb,
	meldeAn,
	standVon,
	uebersicht,
	type Anwesenheitsart,
	type Anwesenheitsereignis,
	type Anwesenheitsuebersicht,
	type Erfassungsweg
} from '$lib/domain/anwesenheit';
import { gibtZutritt, normalisiere, zutrittsgrund } from '$lib/domain/zugang';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id, Zeitpunkt } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

export { leseEreignisse } from './anwesenheitsereignisse';

// ── Zugang prüfen (ohne Mandantenkontext) ──────────────────────────────────

export interface Zugangsbefund {
	gueltig: boolean;
	/** Nur bei Gültigkeit gesetzt. */
	operatorId?: Id;
	meetingId?: Id;
	snapshotPartyId?: Id;
	parteiId?: Id;
	versammlungszustand?: string;
	/** Warum kein Zutritt besteht — in einem Satz für die Person davor. */
	grund?: string;
}

/**
 * Löst einen vorgezeigten Zugangscode für die Sitzungsleitung eines Betreibers
 * auf.
 *
 * Die Auflösung geht über eine Funktion mit `SECURITY DEFINER` (Migration 016),
 * weil der Code erst sagt, wem er gehört. Ein unbekannter Code und der eines
 * fremden Betreibers bekommen dieselbe Antwort: Von aussen soll sich nicht
 * feststellen lassen, ob ein Code irgendwo gilt, sonst liesse sich durch
 * Probieren herausfinden, welche Codes es gibt. Dem eigenen Haus nennt die
 * Funktion den Grund («entwertet», «geschlossen»).
 *
 * **An den Betreiber gebunden** (A5, Sicherheitsdurchgang 09.10.2026). Alle
 * Aufrufer sind angemeldete Sitzungsleitungen beim Scannen einer Karte; die
 * Eigentümerin löst ihren Code über `loeseCodeEin` ein. Bis zum 15.10.2026
 * schrieb diese Funktion `last_used_at` über `zugang_benutzt`, bevor irgendein
 * Aufrufer geprüft hatte, ob die Karte zu seinem Haus gehört: Ein Scan im
 * eigenen Saal schrieb in die Zugangszeile eines fremden Betreibers. Jetzt
 * gilt die Karte eines fremden Betreibers als unbekannt, mit demselben Satz,
 * und es wird nichts geschrieben. Auch der genaue Grund («ersetzt»,
 * «Versammlung geschlossen») bleibt dem eigenen Haus vorbehalten.
 */
export async function loeseZugangAuf(operatorId: Id, code: string): Promise<Zugangsbefund> {
	const bereinigt = normalisiere(code);
	if (bereinigt.length === 0) {
		return { gueltig: false, grund: UNBEKANNT };
	}

	const zeilen = await sql<
		{
			operator_id: string;
			meeting_id: string;
			snapshot_party_id: string;
			party_id: string;
			access_state: 'gueltig' | 'ersetzt' | 'entwertet';
			meeting_state: string;
		}[]
	>`SELECT * FROM zugang_aufloesen(${pruefwert(bereinigt)})`;

	const z = zeilen[0];
	if (!z || z.operator_id !== operatorId) return { gueltig: false, grund: UNBEKANNT };

	if (!gibtZutritt({ zustand: z.access_state }, z.meeting_state)) {
		return {
			gueltig: false,
			// Hier darf der Grund genau sein: Der Code existiert, die Person hält
			// ihn in der Hand, und «funktioniert nicht» hilft ihr nicht weiter.
			grund: zutrittsgrund({ zustand: z.access_state }, z.meeting_state) ?? UNBEKANNT
		};
	}

	await sql`SELECT zugang_benutzt(${pruefwert(bereinigt)})`;

	return {
		gueltig: true,
		operatorId: z.operator_id,
		meetingId: z.meeting_id,
		snapshotPartyId: z.snapshot_party_id,
		parteiId: z.party_id,
		versammlungszustand: z.meeting_state
	};
}

/**
 * Die Meldung bei einem unbekannten Code.
 *
 * Ohne technische Angaben und ohne Hinweis darauf, ob der Code je gültig war.
 */
const UNBEKANNT =
	'Dieser Zugang ist nicht gültig. Prüfen Sie, ob Sie den Code richtig abgetippt haben — ' +
	'sonst wenden Sie sich an die Bewirtschaftung.';

// ── Ereignisse lesen und schreiben ─────────────────────────────────────────


export async function holeAnwesenheitsereignisse(
	operatorId: Id,
	meetingId: Id
): Promise<Anwesenheitsereignis[]> {
	return alsBetreiber(operatorId, (tx) => leseEreignisse(tx, meetingId));
}

/**
 * Die Anwesenheitsübersicht zu einem Zeitpunkt.
 *
 * Ohne `bis` der aktuelle Stand. Mit `bis` der Stand jenes Augenblicks — so
 * rechnet die Auswertung einer geschlossenen Abstimmung auf dem Stand, der beim
 * Schliessen galt (AD-16).
 */
export async function holeUebersicht(
	operatorId: Id,
	meetingId: Id,
	bis?: Zeitpunkt
): Promise<Anwesenheitsuebersicht | null> {
	const momentaufnahme = await holeMomentaufnahme(operatorId, meetingId);
	if (!momentaufnahme) return null;
	const ereignisse = await holeAnwesenheitsereignisse(operatorId, meetingId);
	return uebersicht(momentaufnahme, ereignisse, bis);
}

interface Ziel {
	snapshotPartyId: Id;
	parteiId: Id;
	name: string;
}

/** Findet die Partei der Momentaufnahme, über ihre Zeilenkennung oder die Parteikennung. */
async function findeZiel(
	tx: postgres.TransactionSql,
	meetingId: Id,
	kennung: Id
): Promise<Ziel> {
	/*
	 * **Eine leere Kennung ist eine Absage, kein Serverfehler** (21.08.2026).
	 *
	 * Ein Formularfeld, das nichts mitschickt, liefert `''` — und `''` als uuid
	 * lässt PostgreSQL mit «invalid input syntax for type uuid» scheitern. Aus
	 * einer vergessenen Auswahl wurde so eine weisse Seite mit «500 Internal
	 * Error», mitten am Eingang. Gefunden im Durchlauf, nachdem beim Einlassen
	 * von Hand die Parteiwahl leer ankam.
	 *
	 * Die Prüfung steht hier und nicht in der Route: Diesen Weg gehen der
	 * Kartenscanner, das Eintippen, der Einlass von Hand und der Nachtrag — vier
	 * Eingänge, und jeder hätte die Prüfung sonst selbst gebraucht.
	 */
	if (!kennung?.trim()) {
		throw new FachlicherFehler(
			'ohne_partei',
			'Wählen Sie zuerst, wer eintrifft.',
			'partei'
		);
	}

	const [z] = await tx<{ id: string; party_id: string; display_name: string }[]>`
		SELECT id, party_id, display_name FROM snapshot_party
		WHERE meeting_id = ${meetingId} AND (id = ${kennung} OR party_id = ${kennung})
		LIMIT 1
	`;
	if (!z) {
		throw new FachlicherFehler(
			'unbekannte_partei',
			'Diese Partei ist an dieser Versammlung nicht stimmberechtigt.',
			'parteiId'
		);
	}
	return { snapshotPartyId: z.id, parteiId: z.party_id, name: z.display_name };
}

/** Verlangt, dass die Versammlung läuft — vorher und nachher zählt keine Anwesenheit. */
async function nurLaufend(tx: postgres.TransactionSql, meetingId: Id): Promise<void> {
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	if (m.state !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_laufend',
			m.state === 'freigegeben'
				? 'Die Versammlung ist noch nicht eröffnet. Die Anwesenheit zählt erst ab der Eröffnung.'
				: 'Die Versammlung läuft nicht mehr. Die Anwesenheit steht fest.',
			'zustand'
		);
	}
}


export interface Erfassungsergebnis {
	neu: boolean;
	name: string;
	parteiId: Id;
	/**
	 * Die Zeile der Momentaufnahme, auf die sich das bezieht.
	 *
	 * **Sie steht hier, damit niemand die Eingabe weiterreicht.** `findeZiel`
	 * nimmt beide Kennungen entgegen — die der Partei und die der
	 * Momentaufnahme —, weil die Oberfläche an verschiedenen Stellen
	 * verschiedene mitschickt. Wer danach den EINGEGEBENEN Wert weiterverwendet,
	 * schreibt womöglich eine `party_id` in eine Spalte, die auf
	 * `snapshot_party` zeigt. Genau das ist am 20.08.2026 beim Zuordnen einer
	 * Saalmeldung geschehen: Die Anwesenheit gelang, und der nächste Schritt
	 * scheiterte mit einem Serverfehler.
	 */
	snapshotPartyId: Id;
	/** Namen der Parteien, die mit dieser Person als vertreten eingetroffen sind. */
	mitgebracht?: string[];
	/** Gesetzt, wenn die eigene Anwesenheit eine bestehende Vertretung beendet hat. */
	vertretungBeendet?: string | null;
}

/**
 * Zieht die vertretenen Parteien nach — eintreffen oder verlassen.
 *
 * **Warum als Ereignis und nicht als Ableitung beim Lesen.** Anwesenheit zu
 * einem Zeitpunkt ist eine Frage an die Ereignisfolge (AD-16). Würde die
 * Anwesenheit einer vertretenen Partei beim Lesen aus der Vollmacht abgeleitet,
 * gäbe es zwei Quellen für dieselbe Aussage — und ein später widerrufenes
 * Vollmachtsverhältnis verschöbe rückwirkend das Ergebnis einer Abstimmung von
 * 20:00 Uhr.
 *
 * In derselben Transaktion wie das Ereignis der bevollmächtigten Person: Zwei getrennte
 * Vorgänge hiessen, dass dazwischen eine Abstimmung geschlossen werden könnte —
 * und dann fehlten die Stimmen der Vertretenen.
 */
async function zieheVertreteneNach(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	bevollmaechtigtSnapshotId: Id,
	bevollmaechtigtName: string,
	art: 'eingetroffen' | 'verlassen'
): Promise<string[]> {
	const wirksame = (await leseWirksame(tx, meetingId)).filter(
		(v) => v.bevollmaechtigtId === bevollmaechtigtSnapshotId
	);
	const namen: string[] = [];

	for (const v of wirksame) {
		const bisher = await leseEreignisse(tx, meetingId, v.vertreteneParteiId);
		const stand = standVon(bisher);
		// Kein zweites Ereignis für einen Zustand, der schon gilt. Am Eingang ist
		// der zweite Scan ein Versehen, kein Vorgang — für die Mitgebrachten
		// ebenso.
		if (art === 'eingetroffen' && stand?.zustand === 'anwesend') continue;
		if (art === 'verlassen' && stand?.zustand !== 'anwesend') continue;

		await schreibeEreignis(
			tx,
			handelnder.operatorId,
			meetingId,
			v.vertreteneId,
			art,
			'vertretung',
			{ userId: handelnder.userId, label: handelnder.label },
			art === 'eingetroffen'
				? `Vertreten durch ${bevollmaechtigtName}.`
				: `${bevollmaechtigtName} hat die Versammlung verlassen; die Vertretung endet damit tatsächlich.`
		);
		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				art === 'eingetroffen'
					? EREIGNISARTEN.anwesenheitBestaetigt
					: EREIGNISARTEN.anwesenheitVerlassen,
				{ art: 'snapshot_party', id: v.vertreteneId },
				{ partei: v.vertreteneName, weg: 'vertretung', vertreter: bevollmaechtigtName }
			)
		]);
		namen.push(v.vertreteneName);
	}

	return namen;
}

/**
 * Bestätigt das Eintreffen — durch Scannen, von Hand oder ab Liste.
 *
 * Ein bereits Anwesender erzeugt kein zweites Ereignis; der Rückgabewert sagt
 * es. Am Eingang ist der zweite Scan ein Versehen, kein Vorgang.
 */
export async function bestaetigeAnwesenheit(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id,
	/**
	 * Wie die Person hereinkam.
	 *
	 * **Ohne Angabe gilt der Weg ihrer Anmeldung** (24.08.2026). Vorher stand
	 * hier `= 'gescannt'`, und wer den Knopf «Freigeben» am wartenden Eintrag
	 * drückte, schrieb «Karte gescannt» in den Verlauf einer Person, die sich
	 * vom eigenen Telefon aus angemeldet hatte. Die Vorgabe machte aus
	 * «niemand hat etwas behauptet» eine Behauptung; der Kern entscheidet das
	 * jetzt (`bestaetigeEintreffen`).
	 */
	weg?: Erfassungsweg,
	bemerkung?: string
): Promise<Erfassungsergebnis> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const ziel = await findeZiel(tx, meetingId, kennung);
		const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);

		const u = bestaetigeEintreffen(bisher, {
			meetingId,
			parteiId: ziel.parteiId,
			name: ziel.name,
			weg,
			erfasstDurch: handelnder.label,
			bemerkung
		});

		if (u.ergebnis.neu) {
			await schreibeEreignis(
				tx,
				handelnder.operatorId,
				meetingId,
				ziel.snapshotPartyId,
				'eingetroffen',
				// Der **aufgelöste** Weg, nicht der übergebene: Sonst stünde im
				// Ereignis etwas anderes als im Verlauf daneben.
				u.ergebnis.weg,
				{ userId: handelnder.userId, label: handelnder.label },
				bemerkung
			);
			await schreibeVerlauf(tx, handelnder, u.ereignisse);
		}

		/*
		 * Zwei Wirkungen der Vollmacht, beide in diesem Vorgang (FR-25):
		 *
		 *   1. Wer eintrifft, bringt die von ihm Vertretenen mit.
		 *   2. Wer selbst erscheint, obwohl er sich vertreten liess, beendet die
		 *      Vertretung — ohne Rückfrage. Wer selbst im Saal steht, übt selbst
		 *      aus. Bereits abgegebene Stimmen der bevollmächtigten Person in geschlossenen
		 *      Abstimmungen bleiben gültig; ein Ende wirkt nach vorn.
		 */
		const vertretungBeendet = await beendeWegenEigenerAnwesenheit(
			tx,
			handelnder,
			meetingId,
			ziel.snapshotPartyId,
			SELBST_ERSCHIENEN
		);
		const mitgebracht = await zieheVertreteneNach(
			tx,
			handelnder,
			meetingId,
			ziel.snapshotPartyId,
			ziel.name,
			'eingetroffen'
		);

		return {
			neu: u.ergebnis.neu,
			name: ziel.name,
			parteiId: ziel.parteiId,
			snapshotPartyId: ziel.snapshotPartyId,
			mitgebracht,
			vertretungBeendet
		};
	});
}

/**
 * Meldet die Teilnahme an — der Weg des Eigentümers selbst.
 *
 * Läuft im Mandantenkontext des Betreibers, den die Zugangsprüfung geliefert
 * hat, nicht in dem eines angemeldeten Benutzers. Der Handelnde ist die Partei
 * selbst; einen Benutzer gibt es hier nicht.
 *
 * bindung: parteiId — `findeZiel` bindet mit `WHERE meeting_id = ${meetingId}
 *   AND (id = ${kennung} OR party_id = ${kennung})`; die Klammergruppe sieht die
 *   Regel nicht.
 */
export async function meldeTeilnahmeAn(
	operatorId: Id,
	meetingId: Id,
	parteiId: Id,
	/**
	 * Wie die Person hereinkam. Vorgabe ist der Weg über den Code — er war der
	 * einzige, bis der Zugang über Authentik dazukam, und ein Aufrufer, der
	 * nichts angibt, meint ihn.
	 */
	weg: 'selbst' | 'authentik' = 'selbst'
): Promise<{ zustand: string; name: string }> {
	return alsBetreiber(operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const ziel = await findeZiel(tx, meetingId, parteiId);
		const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);

		const u = meldeAn(bisher, {
			meetingId,
			parteiId: ziel.parteiId,
			name: ziel.name,
			weg
		});

		if (u.ereignisse.length > 0) {
			await schreibeEreignis(
				tx,
				operatorId,
				meetingId,
				ziel.snapshotPartyId,
				'angemeldet',
				weg,
				// Kein Benutzer und keine Beschriftung: Die Partei hat sich selbst
				// gemeldet. Die Schranke der Tabelle lässt das bei `selbst` und
				// `authentik` zu — bei allem anderen muss ein Erfasser dastehen
				// (Migration 067).
				{ userId: null, label: null }
			);
			await schreibeVerlauf(
				tx,
				{ operatorId, userId: null, label: `Eigentümer: ${ziel.name}` },
				u.ereignisse
			);
		}

		return { zustand: u.ergebnis.zustand, name: ziel.name };
	});
}

export async function lehneAnmeldungAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id,
	grund?: string
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const ziel = await findeZiel(tx, meetingId, kennung);
		const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);

		const u = lehneAb(
			bisher,
			{ meetingId, parteiId: ziel.parteiId, name: ziel.name, weg: 'gescannt' },
			grund
		);

		await schreibeEreignis(
			tx,
			handelnder.operatorId,
			meetingId,
			ziel.snapshotPartyId,
			'abgelehnt',
			'von_hand',
			{ userId: handelnder.userId, label: handelnder.label },
			grund
		);
		await schreibeVerlauf(tx, handelnder, u.ereignisse);
	});
}

export async function erfasseVerlassenDerVersammlung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id,
	/**
	 * Warum die Person geht (Befund Praxisdurchlauf 03.10.2026, Punkt 8).
	 *
	 * **Freiwillig, nicht Pflicht — hier.** Ob eine Begründung verlangt wird,
	 * entscheidet der Weg: Die Anwesenheitsseite verlangt sie, der Einlass am
	 * gemeinsamen Abend fragt sie noch nicht ab. Beides ist derselbe Vorgang,
	 * und der Grund gehört in beiden Fällen in den Nachweis, wenn er da ist.
	 */
	begruendung?: string
): Promise<{ name: string; mitgenommen: string[] }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const ziel = await findeZiel(tx, meetingId, kennung);
		const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);

		const u = erfasseVerlassen(bisher, {
			meetingId,
			parteiId: ziel.parteiId,
			name: ziel.name,
			weg: 'von_hand',
			bemerkung: begruendung
		});

		await schreibeEreignis(
			tx,
			handelnder.operatorId,
			meetingId,
			ziel.snapshotPartyId,
			'verlassen',
			'von_hand',
			{ userId: handelnder.userId, label: handelnder.label },
			begruendung
		);
		await schreibeVerlauf(tx, handelnder, u.ereignisse);

		// Wer geht, nimmt die von ihm Vertretenen mit: Ihre Stimme übt niemand
		// mehr aus. Die Vollmacht bleibt bestehen — sie ist nicht widerrufen,
		// sondern die bevollmächtigte Person ist nicht mehr da. Kommt sie zurück, ziehen sie
		// wieder nach.
		const mitgenommen = await zieheVertreteneNach(
			tx,
			handelnder,
			meetingId,
			ziel.snapshotPartyId,
			ziel.name,
			'verlassen'
		);

		return { name: ziel.name, mitgenommen };
	});
}

/**
 * Erfasst mehrere Parteien in einem Durchgang — die Häkchenliste der einfachen
 * Betriebsart (Story 4.5).
 *
 * Wer schon anwesend ist, wird übersprungen; wer angehakt fehlt und bisher
 * anwesend war, wird **nicht** automatisch als gegangen erfasst. Das Weggehen
 * ist ein eigener Vorgang mit eigenem Zeitpunkt, und eine Häkchenliste, die es
 * nebenbei mit erledigt, erzeugt Zeitpunkte, die niemand gesetzt hat.
 *
 * bindung: kennungen — Die Schleife ruft je Kennung `findeZiel(tx, meetingId,
 *   kennung)`, das über `snapshot_party.meeting_id` bindet.
 */
export async function erfasseListe(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennungen: Id[]
): Promise<{ erfasst: number; schonAnwesend: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);

		let erfasst = 0;
		let schonAnwesend = 0;

		for (const kennung of kennungen) {
			const ziel = await findeZiel(tx, meetingId, kennung);
			const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);
			const u = bestaetigeEintreffen(bisher, {
				meetingId,
				parteiId: ziel.parteiId,
				name: ziel.name,
				weg: 'liste',
				erfasstDurch: handelnder.label
			});

			if (!u.ergebnis.neu) {
				schonAnwesend++;
				continue;
			}

			await schreibeEreignis(
				tx,
				handelnder.operatorId,
				meetingId,
				ziel.snapshotPartyId,
				'eingetroffen',
				'liste',
				{ userId: handelnder.userId, label: handelnder.label }
			);
			await schreibeVerlauf(tx, handelnder, u.ereignisse);
			erfasst++;
		}

		return { erfasst, schonAnwesend };
	});
}

/**
 * Einlass am Eingang, in **einem** Vorgang: anwesend erfassen und dabei die
 * mitgebrachten Vollmachten erfassen, belegen und bestätigen.
 *
 * **Warum zusammen und nicht nacheinander** (Vorschlag des Auftraggebers vom 04.08.2026):
 * Am Eingang steht eine Person mit drei Blättern in der Hand. Der Weg über die
 * Vollmachtsseite hiesse: einlassen, Seite wechseln, dreimal erfassen, dreimal
 * Nachweis vermerken, dreimal bestätigen, zurückwechseln — während hinter ihr
 * die Schlange steht. Hier ist es ein Formular und ein Tipp.
 *
 * **Und warum in einer Transaktion:** Bräche es in der Mitte ab, wäre jemand
 * anwesend, dessen Vollmachten teils erfasst und teils bestätigt sind. Im Saal
 * merkt das niemand, und die nächste Abstimmung rechnete mit einer halben
 * Wahrheit.
 *
 * Bestätigt wird hier ohne Zwischenschritt, und das ist kein Bruch der Regel
 * «erst prüfen, dann aktivieren»: Die prüfende Person **ist** die, die am Tisch
 * steht und das Original in der Hand hält. Der Zweischritt auf der
 * Vollmachtsseite gilt den Vollmachten, die vorab mit der Post kommen.
 */
export async function lasseEinMitVertretungen(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	kennung: Id,
	angaben: {
		vertritt: Id[];
		weg?: Erfassungsweg;
		nachweisVorgelegt: boolean;
		/**
		 * Der Grund, den die Leitung von Hand gewählt hat (Ä-28, Migration 120).
		 *
		 * Auf diesem Weg ist die eintretende Person selbst Partei der
		 * Versammlung. Alle drei Gründe kommen in Frage: Sie kann daneben als
		 * Organ oder gesetzliche Vertretung für eine andere Einheit handeln
		 * (`pruefeEingabe`, Absatz zum 24.09.2026). **Hier stand bis zum
		 * 03.11.2026, `pruefeEingabe` weise `organ` und `gesetzlich` für eine
		 * Partei ab**; das war seit dem 24.09.2026 nicht mehr wahr.
		 *
		 * **Seit dem 03.11.2026 gilt ein gewählter Grund nur für genau eine
		 * Vertretene** (`verlangeEinGrundEinePartei`), und `mitberechtigt` für
		 * eingetragene Mitberechtigte setzt Votum je Vertretener selbst
		 * (`bestimmeVertretungsgrund` in `erfasseInTx`). Vorher galt ein Grund für
		 * alle angekreuzten Vertretenen, und wer «Organ» wählte, nahm fremde
		 * Vollmachten mit aus der Höchstzahl.
		 */
		vertretungsgrund?: Vertretungsgrund | null;
		dateien?: File[];
	}
): Promise<Erfassungsergebnis & { vollmachten: string[]; mitberechtigte: string[] }> {
	verlangeEinGrundEinePartei(angaben.vertretungsgrund, angaben.vertritt.length);

	// Die Dateien vor der Transaktion ablegen: Der Inhalt liegt unter seiner
	// Prüfsumme (AD-17), das Ablegen ist wiederholbar und hält keine Sperre.
	const abgelegt = await legeNachweiseAb(angaben.dateien ?? []);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const ziel = await findeZiel(tx, meetingId, kennung);
		const weg = angaben.weg ?? 'von_hand';

		/*
		 * 1. Zuerst die **eigene** Vertretung beenden, falls es eine gibt.
		 *
		 * Die Reihenfolge ist nicht beliebig: Wer eintrifft, übt ab jetzt selbst
		 * aus (FR-25) — und erst dann kann er überhaupt eine Vollmacht für andere
		 * halten. Andersherum wiese die Prüfung «wer selbst vertreten wird, kann
		 * nicht ausüben» genau die Person ab, die eben zur Tür hereinkam.
		 */
		// Für den Hinweis in Schritt 5: Führte bisher eine Mitberechtigte die Stimme?
		// Gelesen vor dem Beenden; danach ist die Vollmacht nicht mehr offen.
		const bisherigeVertretung = await leseOffeneOderWirksame(tx, meetingId, ziel.snapshotPartyId);
		const vertretungBeendetVorher = await beendeWegenEigenerAnwesenheit(
			tx,
			handelnder,
			meetingId,
			ziel.snapshotPartyId,
			SELBST_ERSCHIENEN
		);

		// 2. Die Vollmachten, damit sie beim Einlass schon wirken.
		const vollmachten: string[] = [];
		for (const vertreteneId of angaben.vertritt) {
			const v = await erfasseInTx(tx, handelnder, meetingId, {
				vertreteneId,
				bevollmaechtigtId: ziel.snapshotPartyId,
				vertretungsgrund: angaben.vertretungsgrund
			});
			/*
			 * **Der Nachweis je Vertretung, nicht für den ganzen Einlass**
			 * (Produktentscheid 03.11.2026). Hier stand die Prüfung vor der
			 * Transaktion und verlangte einen Nachweis, sobald überhaupt eine
			 * Vollmacht dabei war, auch für die eingetragene Mitberechtigte, die
			 * keinen braucht. Ob einer nötig ist, weiss erst `erfasseInTx`.
			 *
			 * Für die eingetragene Mitberechtigte wird auch nichts vermerkt: Das
			 * vorbelegte «Das Original liegt mir vor» behauptete sonst ein Blatt,
			 * das es nicht gibt, und die Dateien gehören zu den übrigen Vollmachten.
			 */
			const belegpflichtig = brauchtNachweis(v);
			if (belegpflichtig && !angaben.nachweisVorgelegt && abgelegt.length === 0) {
				throw new FachlicherFehler(
					'ohne_nachweis',
					v.mitberechtigung === 'nicht_eingetragen'
						? OHNE_NACHWEIS_DER_MITBERECHTIGUNG
						: OHNE_NACHWEIS_BEIM_EINLASS,
					'nachweis'
				);
			}
			if (belegpflichtig) {
				if (angaben.nachweisVorgelegt) await vermerkeVorlageInTx(tx, handelnder, meetingId, v.id);
				for (const a of abgelegt) {
					await haengeAbgelegtenNachweisAn(tx, handelnder, meetingId, v.id, a);
				}
			}
			await bestaetigeInTx(tx, handelnder, meetingId, v.id);
			vollmachten.push(v.vertreteneName);
		}

		// 3. Der Einlass selbst.
		const bisher = await leseEreignisse(tx, meetingId, ziel.parteiId);
		const u = bestaetigeEintreffen(bisher, {
			meetingId,
			parteiId: ziel.parteiId,
			name: ziel.name,
			weg,
			erfasstDurch: handelnder.label
		});
		if (u.ergebnis.neu) {
			await schreibeEreignis(
				tx,
				handelnder.operatorId,
				meetingId,
				ziel.snapshotPartyId,
				'eingetroffen',
				weg,
				{ userId: handelnder.userId, label: handelnder.label }
			);
			await schreibeVerlauf(tx, handelnder, u.ereignisse);
		}

		// 4. Und die Parteien nachziehen, für die diese Person Vollmachten hält.
		const mitgebracht = await zieheVertreteneNach(
			tx,
			handelnder,
			meetingId,
			ziel.snapshotPartyId,
			ziel.name,
			'eingetroffen'
		);

		// 5. Der Hinweis, wenn mehrere Mitberechtigte derselben Einheit da sind.
		const mitberechtigte = await mehrereMitberechtigte(
			tx,
			meetingId,
			ziel,
			vertretungBeendetVorher !== null && bisherigeVertretung?.vertretungsgrund === 'mitberechtigt'
		);

		return {
			neu: u.ergebnis.neu,
			name: ziel.name,
			parteiId: ziel.parteiId,
			snapshotPartyId: ziel.snapshotPartyId,
			mitgebracht,
			vertretungBeendet: vertretungBeendetVorher,
			vollmachten,
			mitberechtigte
		};
	});
}

/**
 * Sind nach diesem Einlass mehrere Mitberechtigte derselben gemeinschaftlichen
 * Einheit da? Dann ein Satz je Einheit für die Leitung (Produktentscheid
 * 03.11.2026, Punkt 2; `mitberechtigtenhinweis`).
 *
 * **So klein wie möglich, und was es schon verhindert.** Eine Einheit wird
 * nie zweimal vertreten (`proxy_eine_je_partei`), und wer selbst anwesend ist,
 * lässt sich nicht zusätzlich vertreten. Offen bleibt nur, dass zwei
 * Mitberechtigte da sind und Votum die Stimme einer von beiden zuschreibt,
 * ohne dass die beiden das bestimmt hätten. Das kann Votum nicht prüfen, es
 * kann es nur sagen. Drei Lagen:
 *
 *   - Die eintretende Person ist selbst die gemeinschaftliche Zeile (ihre
 *     Karte), und ihr Eintritt hat eben eine Vertretung durch eine
 *     Mitberechtigte beendet (`mitberechtigteAbgeloest`), oder eine
 *     Mitberechtigte mit eigener Einheit ist schon anwesend.
 *
 *     **Nicht mehr bei jedem zweiten Einlass und jeder beendeten Vertretung**
 *     (Codeprüfung 03.11.2026, M1). Die erste Fassung gab den Hinweis auch,
 *     wenn dieselbe Person ihre Karte zweimal einlesen liess oder wenn der
 *     Eintritt eine gewöhnliche Vollmacht eines Nachbarn beendete; dort ist
 *     keine zweite Mitberechtigte da.
 *   - Sie führt nun die Stimme einer Einheit, an der eine andere
 *     Mitberechtigte schon anwesend ist.
 *   - Sie ist Mitberechtigte einer Einheit, die schon anwesend ist, über ihre
 *     Karte oder eine Vertretung durch jemand anderen.
 *
 * Mitberechtigte ohne eigene Einheit stehen nicht in der Momentaufnahme
 * (`freigabe.ts`, «Parteien ohne Einheit»); sie kommen über die Karte der
 * gemeinschaftlichen Zeile. Kommt die zweite von ihnen über dieselbe Karte,
 * unterscheidet Votum das nicht vom doppelten Einlesen und schweigt
 * (Codeprüfung F1, Runde 2, B2; Pendenz «Aus F1»); das Handbuch rät, bei
 * gemeinsamem Eigentum selbst nachzufragen.
 */
async function mehrereMitberechtigte(
	tx: postgres.TransactionSql,
	meetingId: Id,
	ziel: Ziel,
	mitberechtigteAbgeloest: boolean
): Promise<string[]> {
	const [selbst] = await tx<{ is_community: boolean }[]>`
		SELECT is_community FROM snapshot_party WHERE id = ${ziel.snapshotPartyId}
	`;
	if (selbst?.is_community) {
		if (mitberechtigteAbgeloest) return [mitberechtigtenhinweis({ huelle: ziel.name, fuehrt: null })];
		const mitglieder = await tx<{ party_id: string }[]>`
			SELECT s.party_id
			  FROM party_member m
			  JOIN snapshot_party s ON s.party_id = m.mitglied_party_id AND s.meeting_id = ${meetingId}
			 WHERE m.huelle_party_id = ${ziel.parteiId}
		`;
		for (const m of mitglieder) {
			if (standVon(await leseEreignisse(tx, meetingId, m.party_id))?.zustand === 'anwesend') {
				return [mitberechtigtenhinweis({ huelle: ziel.name, fuehrt: null })];
			}
		}
		return [];
	}

	const huellen = await tx<
		{
			id: string;
			party_id: string;
			display_name: string;
			fuehrt_id: string | null;
			fuehrt: string | null;
			andere: { party_id: string; name: string }[] | null;
		}[]
	>`
		SELECT h.id, h.party_id, h.display_name,
		       x.holder_id AS fuehrt_id,
		       coalesce(xs.display_name, x.holder_name) AS fuehrt,
		       (SELECT json_agg(json_build_object('party_id', s.party_id, 'name', s.display_name))
		          FROM party_member m2
		          JOIN snapshot_party s ON s.party_id = m2.mitglied_party_id
		                               AND s.meeting_id = ${meetingId}
		         WHERE m2.huelle_party_id = h.party_id
		           AND s.id <> ${ziel.snapshotPartyId}) AS andere
		FROM snapshot_party ich
		JOIN party_member m ON m.mitglied_party_id = ich.party_id
		JOIN snapshot_party h ON h.party_id = m.huelle_party_id AND h.meeting_id = ${meetingId}
		LEFT JOIN proxy x ON x.meeting_id = ${meetingId} AND x.represented_id = h.id
		                 AND x.state = 'bestaetigt'
		LEFT JOIN snapshot_party xs ON xs.id = x.holder_id
		WHERE ich.id = ${ziel.snapshotPartyId}
		ORDER BY h.display_name
	`;

	const hinweise: string[] = [];
	for (const h of huellen) {
		const fuehrtSelbst = h.fuehrt_id === ziel.snapshotPartyId;
		if (fuehrtSelbst) {
			let andereDa = false;
			for (const a of h.andere ?? []) {
				if (standVon(await leseEreignisse(tx, meetingId, a.party_id))?.zustand === 'anwesend') {
					andereDa = true;
					break;
				}
			}
			if (andereDa) hinweise.push(mitberechtigtenhinweis({ huelle: h.display_name, fuehrt: ziel.name }));
		} else if (standVon(await leseEreignisse(tx, meetingId, h.party_id))?.zustand === 'anwesend') {
			hinweise.push(mitberechtigtenhinweis({ huelle: h.display_name, fuehrt: h.fuehrt }));
		}
	}
	return hinweise;
}

/**
 * Ob eine offene oder bestätigte Vollmacht an eine dritte Person mit diesem
 * Namen (unter `vollmachtsschluessel`) das Häkchen «Verwaltung» trägt.
 *
 * bindung: meetingId — `proxy` wird mit `meeting_id` gelesen.
 */
async function nameTraegtVerwaltungshaken(
	tx: postgres.TransactionSql,
	meetingId: Id,
	name: string
): Promise<boolean> {
	const zeilen = await tx<{ holder_name: string }[]>`
		SELECT holder_name FROM proxy
		WHERE meeting_id = ${meetingId}
		  AND holder_id IS NULL AND holder_name IS NOT NULL
		  AND holder_is_management AND state IN ('erfasst', 'bestaetigt')
	`;
	return zeilen.some((z) => gleicheDrittePerson(z.holder_name, name));
}

/**
 * Einlass einer **dritten Person**, die eine Vollmacht ausübt (FR-23, FR-24).
 *
 * **Die Lücke, die das schliesst** (gefunden am 04.08.2026 auf Frage des Auftraggebers):
 * Eine dritte Person ist keine Partei. Sie steht in keiner Momentaufnahme, hat
 * keine Karte und kann deshalb auch nicht «eintreffen» — und so kam die
 * vertretene Partei nie in den Saal. Wurde sie stattdessen von Hand erfasst,
 * galt das als «selbst erschienen» und **beendete die Vollmacht**, die eben
 * geprüft worden war. Der Weg fehlte also nicht nur, er führte in die Irre.
 *
 * Hier ist er ausdrücklich: Nicht die dritte Person wird anwesend, sondern die
 * **vertretene Partei** — mit dem Weg `vertretung` und dem Namen der Person in
 * der Bemerkung. Ihre Stimme erfasst die Sitzungsleitung, oder die Person
 * bekommt einen Ausgabecode auf ihr eigenes Telefon.
 *
 * Eine bereits erfasste Vollmacht wird bestätigt statt ein zweites Mal
 * angelegt; eine, die schon einer anderen Person gehört, wird abgewiesen.
 *
 * **Die Maske sperrt Parteien mit Vollmacht an eine andere Person** (H-1,
 * 07.11.2026; seit E3, 11.11.2026, nur noch an eine andere): Für denselben
 * Namen gibt sie die Partei frei (`sperrgrundAmEinlass`), und das Häkchen der
 * Maske erreicht die Zeile. Eine erfasste Vollmacht auf denselben Namen
 * übernimmt eine Änderung aus der Maske (`verwaltungshakenAmEinlass`), bevor
 * sie bestätigt wird, mit Verlaufseintrag, wenn er sich ändert. Ein veraltetes Formular oder ein Weg ohne Maske
 * liefe sonst mit dem Häkchen von damals weiter, und an den Traktanden mit
 * Häkchen ruhte die Vollmacht oder ruhte sie nicht, je nachdem, wer zuerst
 * erfasst hat. Lauf 5 (07.11.2026): Die Übernahme gilt je Name wie das
 * Kennzeichnen (M-4): Der Wert wandert an alle erfassten und bestätigten
 * Vollmachten desselben normalisierten Namens. Sie trifft dieselbe Sperre
 * (H-1), solange an einem Traktandum mit Häkchen abgestimmt wird, aber nur,
 * wenn sie eine schon bestätigte Vollmacht des Namens änderte; dann scheitert
 * der Einlass als Ganzes. Dasselbe gilt für eine neue Vollmacht mit Häkchen,
 * deren Name schon bestätigte Vollmachten ohne Häkchen hat: Beim Bestätigen
 * gleicht `bestaetigeInTx` den Namen an und trifft dieselbe Sperre. Trägt
 * der Name das Häkchen schon, übernimmt die Vollmacht es dort.
 */
export async function lasseDurchDritteEin(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	angaben: {
		bevollmaechtigtName: string;
		vertritt: Id[];
		nachweisVorgelegt: boolean;
		/**
		 * Der Grund bei «Handelt für die Eigentümerin selbst?» (Ä-28,
		 * Migration 120; Frage seit dem 03.11.2026, `GRUNDFRAGE`).
		 *
		 * **Hier ausdrücklich durchgereicht**, obwohl das Feld an
		 * `Vollmachtseingabe` freiwillig ist: Der Einlasstisch ist genau der Ort,
		 * an dem ein Organvertreter oder ein Beistand auftaucht. Wer ihn hier
		 * vergässe, bekäme still die Vorgabe «gewöhnliche Vollmacht», und die
		 * Höchstzahl des Reglements wiese eine rechtlich einwandfreie Vertretung
		 * ab. Der Prüflauf bliebe dabei grün, weil das Feld freiwillig ist.
		 *
		 * **Und genau das ist am 24.09.2026 passiert**, eine Ebene höher: Diese
		 * Funktion nahm den Wert entgegen, aber keine Route gab ihn ihr. Der
		 * Parameter war tot, und dieser Kommentar behauptete das Gegenteil.
		 * Gefunden hat es die Sicherheitsprüfung, nicht die Probe — die ruft die
		 * Funktion unmittelbar auf und reicht den Wert dabei selbst mit, misst
		 * also die Funktion und nicht den Weg dorthin. Seither bewacht
		 * `scripts/check-vertretungsgrund.mjs` den Aufrufweg.
		 */
		vertretungsgrund?: Vertretungsgrund | null;
		/**
		 * Die bevollmächtigte Person ist die Verwaltung (L8, Migration 184,
		 * M3, 06.11.2026). Wie der Grund ausdrücklich durchgereicht, obwohl
		 * das Feld an `Vollmachtseingabe` freiwillig ist: Der Einlasstisch ist
		 * ein Ort, an dem die Verwaltung mit einer Vollmacht auftaucht, und
		 * ohne das Häkchen ruhten ihre Stimmen an den gekennzeichneten
		 * Traktanden nicht. Der Verlaufseintrag entsteht in `erfasseInTx`,
		 * wie bei den übrigen Feldern der Vollmacht.
		 */
		istVerwaltung?: boolean;
		dateien?: File[];
	}
): Promise<{ bevollmaechtigtName: string; eingelassen: string[] }> {
	// Ein Grund von Hand gilt für genau eine Partei (Produktentscheid 03.11.2026).
	// Eine dritte Person ist nie eingetragene Mitberechtigte; «mitberechtigt»
	// heisst hier immer «nicht eingetragen» und verlangt den Nachweis der
	// Mitberechtigung (`bestimmeVertretungsgrund`, `verlangeBestaetigbar`).
	verlangeEinGrundEinePartei(angaben.vertretungsgrund, angaben.vertritt.length);
	const name = angaben.bevollmaechtigtName.trim();
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Name der vertretenden Person fehlt oder ist zu kurz.',
			'bevollmaechtigtName'
		);
	}
	if (angaben.vertritt.length === 0) {
		throw new FachlicherFehler(
			'ohne_vertretene',
			'Wählen Sie, wen diese Person vertritt.',
			'vertritt'
		);
	}

	const abgelegt = await legeNachweiseAb(angaben.dateien ?? []);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurLaufend(tx, meetingId);
		const eingelassen: string[] = [];

		for (const vertreteneId of angaben.vertritt) {
			let vollmacht = await leseOffeneOderWirksame(tx, meetingId, vertreteneId);

			if (vollmacht && vollmacht.bevollmaechtigtId) {
				throw new FachlicherFehler(
					'schon_vertreten',
					`${vollmacht.vertreteneName} wird bereits durch ${vollmacht.bevollmaechtigtName} vertreten. ` +
						'Beenden Sie diese Vertretung zuerst.',
					'vertritt'
				);
			}
			// Derselbe Vergleich wie in der Auswahl der Maske (`sperrgrundAmEinlass`),
			// unter dem Schlüssel der Zählung statt wörtlich (E3, 11.11.2026).
			if (vollmacht && !gleicheDrittePerson(vollmacht.bevollmaechtigtName, name)) {
				throw new FachlicherFehler(
					'anderer_vertreter',
					`Für ${vollmacht.vertreteneName} ist eine Vollmacht auf ${vollmacht.bevollmaechtigtName} ` +
						'erfasst. Beenden Sie sie zuerst, wenn jemand anderes vertritt.',
					'vertritt'
				);
			}

			if (!vollmacht) {
				vollmacht = await erfasseInTx(tx, handelnder, meetingId, {
					vertreteneId,
					bevollmaechtigtName: name,
					vertretungsgrund: angaben.vertretungsgrund,
					// Ohne Angabe der Stand des Namens, wie er jetzt in der
					// Datenbank steht, nicht wie ihn die Seite beim Laden sah
					// (Codeprüfung E3, M1). Die Kennzeichnung gilt je Name (M-4).
					istVerwaltung: angaben.istVerwaltung ?? (await nameTraegtVerwaltungshaken(tx, meetingId, name))
				});
			} else if (angaben.istVerwaltung !== undefined && vollmacht.istVerwaltung !== angaben.istVerwaltung) {
				// H-1 (07.11.2026): Die erfasste Zeile übernimmt das Häkchen aus
				// der Maske, bevor sie bestätigt wird; der Verlaufseintrag entsteht
				// in `kennzeichneVerwaltungInTx`, nur wenn er sich ändert. Nur wenn
				// die Maske eine Änderung gegenüber ihrer Vorbelegung mitgibt
				// (`verwaltungshakenAmEinlass`; Codeprüfung Lauf 5, B1, und E3, M1);
				// ein Aufruf ohne die Angabe lässt das Häkchen der Zeile stehen.
				vollmacht = await kennzeichneVerwaltungInTx(
					tx,
					handelnder,
					meetingId,
					vollmacht.id,
					angaben.istVerwaltung
				);
			}
			if (angaben.nachweisVorgelegt) await vermerkeVorlageInTx(tx, handelnder, meetingId, vollmacht.id);
			for (const a of abgelegt) {
				await haengeAbgelegtenNachweisAn(tx, handelnder, meetingId, vollmacht.id, a);
			}
			if (vollmacht.zustand !== 'bestaetigt') {
				await bestaetigeInTx(tx, handelnder, meetingId, vollmacht.id);
			}
			// E3 (11.11.2026): Hat die Maske das vorbelegte Häkchen abgewählt,
			// entfernt der Einlass es am ganzen Namen, nach dem Bestätigen: Das
			// Bestätigen übernimmt das Häkchen sonst von einer bestätigten
			// Vollmacht desselben Namens (`bestaetigeInTx`, B3), und eine neu
			// erfasste Zeile trüge es wieder.
			if (angaben.istVerwaltung === false) {
				vollmacht = await kennzeichneVerwaltungInTx(tx, handelnder, meetingId, vollmacht.id, false);
			}

			// Die vertretene Partei tritt ein — nicht die dritte Person.
			const bisher = await leseEreignisse(tx, meetingId, await parteiIdVon(tx, vertreteneId));
			if (standVon(bisher)?.zustand !== 'anwesend') {
				await schreibeEreignis(
					tx,
					handelnder.operatorId,
					meetingId,
					vertreteneId,
					'eingetroffen',
					'vertretung',
					{ userId: handelnder.userId, label: handelnder.label },
					`Vertreten durch ${name} — bevollmächtigt, selbst nicht stimmberechtigt.`
				);
				await schreibeVerlauf(tx, handelnder, [
					ereignis(
						EREIGNISARTEN.anwesenheitBestaetigt,
						{ art: 'snapshot_party', id: vertreteneId },
						{ partei: vollmacht.vertreteneName, weg: 'vertretung', vertreter: name }
					)
				]);
			}
			eingelassen.push(vollmacht.vertreteneName);
		}

		return { bevollmaechtigtName: name, eingelassen };
	});
}

/** Die Absage am Einlass, wenn für eine gewöhnliche Vollmacht der Nachweis fehlt. */
const OHNE_NACHWEIS_BEIM_EINLASS =
	'Ohne Nachweis keine Vollmacht: Bestätigen Sie, dass Ihnen das Original vorliegt, oder ' +
	'fotografieren Sie es.';

/** Die Parteikennung zu einer Zeile der Momentaufnahme. */
async function parteiIdVon(tx: postgres.TransactionSql, snapshotPartyId: Id): Promise<Id> {
	const [z] = await tx<{ party_id: string }[]>`
		SELECT party_id FROM snapshot_party WHERE id = ${snapshotPartyId}
	`;
	if (!z) {
		throw new FachlicherFehler(
			'unbekannte_partei',
			'Diese Partei ist an dieser Versammlung nicht stimmberechtigt.',
			'vertritt'
		);
	}
	return z.party_id;
}

/**
 * Legt die Nachweise vom Einlass ab, höchstens `HOECHSTZAHL_JE_ABSENDEN`.
 *
 * **Ein Dateifehler wird hier zur fachlichen Absage** (Auftrag Abschluss, B3).
 * Die Einlasswege (`einlassen` in `einlassaktionen.ts`, Einlass und
 * Vertretung durch Dritte auf der Anwesenheitsseite) übersetzen nur
 * `FachlicherFehler` in einen Satz; eine zu grosse oder
 * unzulässige Datei endete dort bis zum 16.10.2026 als Fehlerseite. Hier
 * gefangen statt an jedem dieser Wege, weil alle durch diese beiden
 * Funktionen laufen.
 */
async function legeNachweiseAb(
	dateien: File[]
): Promise<{ pruefsumme: string; name: string; art: string; groesse: number }[]> {
	const abgelegt: { pruefsumme: string; name: string; art: string; groesse: number }[] = [];
	try {
		for (const datei of begrenzeNachweise(dateien)) {
			abgelegt.push(await legeAb(await liesHochgeladene(datei), datei.name, datei.type));
		}
	} catch (fehler) {
		if (fehler instanceof DateiFehler) {
			throw new FachlicherFehler(fehler.kennung, fehler.message, 'nachweis');
		}
		throw fehler;
	}
	return abgelegt;
}
