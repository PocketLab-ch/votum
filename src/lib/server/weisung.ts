/**
 * Weisungen lesen und erfassen (Stories 7.3 und 7.4).
 *
 * Der Kern (`$lib/domain/weisung`) entscheidet, was vollständig heisst; hier
 * steht, woher die Zahlen kommen und welche Schranken die Datenbank durchsetzt.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import {
	haltungAusBeschluss,
	pruefeWeisungen,
	type Haltung,
	type Weisung,
	type Weisungsbefund,
	type Weisungsherkunft,
	type Weisungspflichtige
} from '$lib/domain/weisung';
import { gibStimmenAb, holeErgebnis, holeOffenen } from './abstimmung';
import { holeGeschaeftslage, holeHausbeschluesseZumGeschaeft } from './weisungsquellen';
import { holeWeisungsregel } from './reglement';
import { haltungOhneBeschluss } from '$lib/domain/weisungsregel';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

interface Zeile {
	id: string;
	agenda_item_id: string;
	party_id: string;
	stance: Haltung;
	source_kind: Weisungsherkunft;
	source_meeting_id: string | null;
	source_voting_round_id: string | null;
	note: string | null;
	recorded_at: Date;
	recorded_by_label: string | null;
}

function ausDb(z: Zeile): Weisung {
	return {
		id: z.id,
		traktandumId: z.agenda_item_id,
		parteiId: z.party_id,
		haltung: z.stance,
		herkunft: z.source_kind,
		quelleVersammlungId: z.source_meeting_id,
		quelleDurchgangId: z.source_voting_round_id,
		bemerkung: z.note,
		erfasstAm: z.recorded_at.toISOString(),
		erfasstVon: z.recorded_by_label
	};
}

/**
 * Wer zu dieser Versammlung eine Weisung geben muss.
 *
 * Das sind die Parteien der Art «gemeinschaft» — die Mitgliedsgemeinschaften.
 * Gelesen wird aus den heutigen Stammdaten und nicht aus der Momentaufnahme:
 * Die Weisung entsteht vor der Abstimmung, und wer bis dahin Mitglied ist, ist
 * weisungsbefugt. Der Vertreter kommt zum Datum der Versammlung.
 */
export async function holeWeisungspflichtige(
	operatorId: Id,
	stwegId: Id,
	stichtag: string
): Promise<Weisungspflichtige[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ party_id: string; display_name: string; vertreter: string | null }[]
		>`
			SELECT p.id AS party_id,
			       p.display_name,
			       COALESCE(
			           (SELECT r.person_name FROM representation r
			            WHERE r.party_id = p.id
			              AND r.valid_from <= ${stichtag}
			              AND (r.valid_to IS NULL OR r.valid_to > ${stichtag})
			            LIMIT 1),
			           p.representative_name
			       ) AS vertreter
			FROM party p
			WHERE p.stweg_id = ${stwegId} AND p.kind = 'gemeinschaft'
			ORDER BY p.display_name
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			name: z.display_name,
			vertreter: z.vertreter
		}));
	});
}

/** Die geltenden Weisungen eines Traktandums — überholte bleiben aussen vor. */
export async function holeWeisungen(operatorId: Id, traktandumId: Id): Promise<Weisung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM instruction
			WHERE agenda_item_id = ${traktandumId} AND superseded_by IS NULL
			ORDER BY recorded_at
		`;
		return zeilen.map(ausDb);
	});
}

/** Alle, auch die überholten — für den Nachweis, wie es dazu kam. */
export async function holeWeisungsverlauf(
	operatorId: Id,
	traktandumId: Id
): Promise<Weisung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM instruction WHERE agenda_item_id = ${traktandumId} ORDER BY recorded_at
		`;
		return zeilen.map(ausDb);
	});
}

export interface Weisungsstand extends Weisungsbefund {
	weisungsgebunden: boolean;
}

/**
 * Das Traktandum **dieser** Versammlung — die eine Stelle, an der die Bindung
 * geprüft wird (07.09.2026).
 *
 * **Warum sie nötig wurde.** Die Weisungsseite bekommt die Versammlung aus der
 * Adresse und das Traktandum aus dem Formular, und keine der vier Handlungen
 * verglich die beiden. `SELECT … FROM agenda_item WHERE id = ${…}` allein
 * findet jedes Traktandum des Betreibers, auch eines aus einer anderen
 * Versammlung. Dieselbe Bauart wie bei den Vollmachten (`69f107c`) und bei den
 * Traktanden (`ec57517`); der Prüfbericht
 * `docs/audit/2026-09-07-traktandumsbindung.md` hat sie hier ausdrücklich
 * offen gelassen.
 *
 * **In der Abfrage und nicht in der Route**, aus demselben Grund wie dort: Eine
 * Absicherung je Weg hat eine Lücke je künftigem Weg.
 */
interface Traktandumszeile {
	meeting_id: string;
	title: string;
	stweg_id: string;
	instruction_bound: boolean;
	meeting_date: Date;
}

/**
 * Dasselbe, ohne zu werfen — für den Lesestand, der `null` zurückgibt statt
 * abzusagen.
 */
async function findeTraktandumIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	traktandumId: Id
): Promise<Traktandumszeile | null> {
	const [t] = await tx<Traktandumszeile[]>`
		SELECT a.meeting_id, a.title, a.instruction_bound, m.stweg_id, m.meeting_date
		FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
		WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
	`;
	return t ?? null;
}

async function leseTraktandumIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	traktandumId: Id
): Promise<Traktandumszeile> {
	const t = await findeTraktandumIn(tx, meetingId, traktandumId);
	if (!t) {
		throw fremdesTraktandum('traktandumId');
	}
	return t;
}

/**
 * Der Stand zu einem Traktandum: wer geben muss, wer gegeben hat, was fehlt.
 */
export async function holeWeisungsstand(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Weisungsstand | null> {
	// Über denselben Leser wie die Schreibwege: Zwei Fassungen derselben
	// Bedingung liefen früher oder später auseinander (Code-Review 07.09.2026).
	const rahmen = await alsBetreiber(operatorId, (tx) =>
		findeTraktandumIn(tx, meetingId, traktandumId)
	);
	if (!rahmen) return null;

	const stichtag = rahmen.meeting_date.toISOString().slice(0, 10);
	const [pflichtige, weisungen] = await Promise.all([
		holeWeisungspflichtige(operatorId, rahmen.stweg_id, stichtag),
		holeWeisungen(operatorId, traktandumId)
	]);

	// «Ohne Weisung» ist als Weisung mit Herkunft `frei` und Bemerkung erfasst —
	// ein eigener Speicher dafür wäre eine zweite Wahrheit.
	return {
		weisungsgebunden: rahmen.instruction_bound,
		...pruefeWeisungen({ pflichtige, weisungen })
	};
}

export interface WeisungEingabe {
	traktandumId: Id;
	parteiId: Id;
	haltung: Haltung;
	herkunft: Weisungsherkunft;
	/** Bei `beschluss`: der Durchgang der Hausversammlung. */
	quelleDurchgangId?: Id | null;
	bemerkung?: string | null;
}

/**
 * Trägt eine Weisung ein — oder berichtigt eine bestehende.
 *
 * Eine Berichtigung ist eine **neue Zeile**; die bisherige wird als überholt
 * gekennzeichnet und bleibt einsehbar (AD-5). Ab dem Öffnen des Durchgangs
 * nimmt die Anwendung keine Weisung mehr entgegen: Danach entstünde der
 * Eindruck, das Haus habe nachträglich angewiesen, was der Vertreter längst
 * abgegeben hat.
 */
export async function halteWeisungFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	eingabe: WeisungEingabe
): Promise<Weisung> {
	if (eingabe.herkunft === 'frei' && eingabe.haltung !== 'frei') {
		throw new FachlicherFehler(
			'frei_mit_haltung',
			'Wer dem Vertreter den Entscheid überlässt, gibt ihm keine Richtung mit.',
			'haltung'
		);
	}
	if (eingabe.herkunft !== 'frei' && eingabe.haltung === 'frei') {
		throw new FachlicherFehler(
			'haltung_fehlt',
			'Geben Sie an, wie das Haus angewiesen hat — oder wählen Sie «nach freiem Ermessen».',
			'haltung'
		);
	}
	if (eingabe.herkunft === 'beschluss' && !eingabe.quelleDurchgangId) {
		throw new FachlicherFehler(
			'ohne_verweis',
			'Eine Weisung aus einem Beschluss braucht den Verweis darauf — er ist der Beleg.',
			'quelleDurchgangId'
		);
	}
	if (eingabe.herkunft === 'erklaerung' && zeichenzahl(eingabe.bemerkung?.trim() ?? '') < 3) {
		throw new FachlicherFehler(
			'ohne_bemerkung',
			'Halten Sie fest, was erklärt wurde und von wem — sonst ist die Weisung unbelegt.',
			'bemerkung'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const t = await leseTraktandumIn(tx, meetingId, eingabe.traktandumId);

		// Auch ein über einen Folgeantrag ersetzter Beschluss (Migration 133).
		const [offen] = await tx<{ id: string }[]>`
			SELECT id FROM voting_round
			WHERE agenda_item_id = ${eingabe.traktandumId} AND superseded_at IS NULL
			UNION ALL
			SELECT ${eingabe.traktandumId}::uuid WHERE durch_anderes_traktandum_ersetzt(${eingabe.traktandumId})
			LIMIT 1
		`;
		if (offen) {
			throw new FachlicherFehler(
				'schon_abgestimmt',
				'Über dieses Traktandum wird bereits abgestimmt oder es ist abgestimmt. Eine Weisung ' +
					'danach erweckte den Eindruck, das Haus habe nachträglich angewiesen.',
				'traktandumId'
			);
		}

		/*
		 * **Auch die Partei gehört gegen die Versammlung geprüft** (Code-Review
		 * 07.09.2026). Sie kam aus demselben Formular wie das Traktandum, und
		 * `WHERE id = …` allein findet jedes Haus des Betreibers. Eine Weisung
		 * eines fremden Hauses zu einem Traktandum dieser Versammlung wäre eine
		 * Zeile, die niemand erteilt hat.
		 */
		const [partei] = await tx<{ display_name: string; kind: string }[]>`
			SELECT display_name, kind FROM party
			WHERE id = ${eingabe.parteiId} AND stweg_id = ${t.stweg_id}
		`;
		if (!partei) {
			throw new FachlicherFehler(
				'unbekannt',
				'Dieses Haus gehört nicht zur Gemeinschaft dieser Versammlung.',
				'parteiId'
			);
		}
		if (partei.kind !== 'gemeinschaft') {
			throw new FachlicherFehler(
				'keine_gemeinschaft',
				'Eine Weisung gibt eine Mitgliedsgemeinschaft, keine Einzelperson.',
				'parteiId'
			);
		}

		// Die bisherige geltende Weisung, falls es eine gibt.
		const [bisher] = await tx<{ id: string }[]>`
			SELECT id FROM instruction
			WHERE agenda_item_id = ${eingabe.traktandumId}
			  AND party_id = ${eingabe.parteiId}
			  AND superseded_by IS NULL
		`;

		// Erst die neue Zeile, dann die alte als überholt kennzeichnen: Der
		// Eindeutigkeitsindex greift auf die nicht überholten, also muss die alte
		// zuerst aus dem Weg — aber sie darf nicht verschwinden.
		if (bisher) {
			await tx`
				UPDATE instruction SET superseded_by = ${bisher.id} WHERE id = ${bisher.id}
			`;
		}

		const [z] = await tx<Zeile[]>`
			INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id,
			                         stance, source_kind, source_meeting_id,
			                         source_voting_round_id, note, recorded_by, recorded_by_label)
			VALUES (${handelnder.operatorId}, ${t.meeting_id}, ${eingabe.traktandumId},
			        ${eingabe.parteiId}, ${eingabe.haltung}, ${eingabe.herkunft},
			        (SELECT meeting_id FROM voting_round WHERE id = ${eingabe.quelleDurchgangId ?? null}),
			        ${eingabe.quelleDurchgangId ?? null}, ${eingabe.bemerkung?.trim() || null},
			        ${handelnder.userId}, ${handelnder.label})
			RETURNING *
		`;

		if (bisher) {
			await tx`UPDATE instruction SET superseded_by = ${z.id} WHERE id = ${bisher.id}`;
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				bisher ? EREIGNISARTEN.weisungBerichtigt : EREIGNISARTEN.weisungErfasst,
				{ art: 'meeting', id: t.meeting_id },
				{
					traktandum: t.title,
					haus: partei.display_name,
					haltung: eingabe.haltung,
					herkunft: eingabe.herkunft,
					bemerkung: eingabe.bemerkung?.trim() || null
				}
			)
		);
		return ausDb(z);
	});
}

/**
 * Leitet die Weisung aus einem Beschluss der Hausversammlung ab.
 *
 * Die Anwendung **liest** das Ergebnis und rechnet es nicht nach: Das Haus hat
 * über denselben Antrag abgestimmt, sein Ergebnis steht fest, und es hier ein
 * zweites Mal auszuzählen erzeugte eine zweite Wahrheit.
 */
export async function leiteWeisungAusBeschlussAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	eingabe: { traktandumId: Id; parteiId: Id; quelleVersammlungId: Id; quelleDurchgangId: Id }
): Promise<Weisung> {
	/*
	 * **Auch der Beleg gehört zum Haus** (Code-Review 07.09.2026). Die
	 * Auswahlliste stellt nur Versammlungen des eigenen Hauses zur Wahl
	 * (`weisungsquellen.ts`: `JOIN meeting m ON m.stweg_id = p.member_stweg_id`),
	 * geprüft wurde das serverseitig aber nie: `holeErgebnis` hält den Durchgang
	 * gegen die genannte Quellversammlung, und dabei blieb es. Damit liess sich
	 * die Weisung von Haus A auf einen Beschluss von Haus B stützen — und diese
	 * Weisung stimmt danach für A mit.
	 */
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [treffer] = await tx<{ id: string }[]>`
			SELECT m.id FROM meeting m
			JOIN party p ON p.member_stweg_id = m.stweg_id
			WHERE m.id = ${eingabe.quelleVersammlungId} AND p.id = ${eingabe.parteiId}
		`;
		if (!treffer) {
			throw new FachlicherFehler(
				'fremde_quelle',
				'Der gewählte Beschluss stammt nicht aus einer Versammlung dieses Hauses.',
				'quelleDurchgangId'
			);
		}
	});

	const ergebnis = await holeErgebnis(
		handelnder.operatorId,
		eingabe.quelleVersammlungId,
		eingabe.quelleDurchgangId
	);
	if (!ergebnis.auszaehlung) {
		throw new FachlicherFehler(
			'ohne_ergebnis',
			ergebnis.grund ??
				'Dieser Durchgang hat kein Ergebnis; eine Weisung lässt sich daraus nicht ableiten.',
			'quelleDurchgangId'
		);
	}
	if (ergebnis.auszaehlung.stichentscheidOffen) {
		// Der Grund nach der Regel (Codeprüfung 07.10.2026, N5): Bis dahin nannte
		// die Absage auch bei einer Person die Wertquoten.
		const grund =
			ergebnis.auszaehlung.stichentscheidArt === 'wertquote'
				? 'Die Wertquoten entscheiden, und die lassen sich aus der Handzählung nicht ablesen.'
				: 'Nach dem Reglement entscheidet eine Person, und ihr Entscheid fehlt noch.';
		throw new FachlicherFehler(
			'stichentscheid_offen',
			`Im Haus ist der Gleichstand noch offen. ${grund} Solange gibt es kein Ergebnis, das ` +
				'der Vertreter mitnehmen könnte.',
			'quelleDurchgangId'
		);
	}

	/*
	 * **Kein Beschluss ist keine Ablehnung** (Migration 128). `angenommen` ist
	 * dort falsch, und daraus würde still eine Nein-Weisung. Hat die
	 * Universalversammlung im Haus nicht gehalten, gibt es nichts mitzunehmen.
	 */
	if (ergebnis.auszaehlung.keinBeschluss) {
		throw new FachlicherFehler(
			'kein_beschluss',
			// Wortlaut der Fachprüfung Block 3 zu Stelle 10.
			'Im Haus ist über dieses Geschäft kein Beschluss zustande gekommen. Daraus lässt sich keine ' +
				'Weisung ableiten, auch nicht aus den abgegebenen Stimmen. Tragen Sie eine Weisung nur von ' +
				'Hand ein, wenn sie sich auf etwas anderes stützt, und nennen Sie es; sonst halten Sie ' +
				'fest, dass keine vorliegt.',
			'quelleDurchgangId'
		);
	}

	return halteWeisungFest(handelnder, meetingId, {
		traktandumId: eingabe.traktandumId,
		parteiId: eingabe.parteiId,
		haltung: haltungAusBeschluss(ergebnis.auszaehlung.angenommen),
		herkunft: 'beschluss',
		quelleDurchgangId: eingabe.quelleDurchgangId
	});
}

/**
 * Setzt die Weisungsbindung eines Traktandums (Story 7.3).
 */
export async function setzeWeisungsbindung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	gebunden: boolean
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const t = await leseTraktandumIn(tx, meetingId, traktandumId);

		await tx`
			UPDATE agenda_item SET instruction_bound = ${gebunden} WHERE id = ${traktandumId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.weisungsbindungGesetzt,
				{ art: 'meeting', id: t.meeting_id },
				{ traktandum: t.title, gebunden }
			)
		);
	});
}


// ── Die Kette: Hausbeschluss → Weisung → Stimme ────────────────────────────
//
// **Der Auftrag** (Auftraggeber, 25.08.2026): «Ja, und die Weisung müsstest du dann
// auch bauen, dass dann korrekt abgestimmt wird.»
//
// Bis hierher war jedes Glied für sich da und keines mit dem nächsten
// verbunden: Das Haus beschloss, jemand tippte die Weisung ab, und dieselbe
// Haltung wurde danach ein drittes Mal als Stimme eingetragen. Dreimal
// dieselbe Angabe von Hand — dreimal die Gelegenheit, sich zu vertippen.

export interface Sammelbefund {
	/** Was gelungen ist, mit dem Namen des Hauses. */
	gelungen: string[];
	/** Was nicht ging, mit Grund. */
	offen: { name: string; grund: string }[];
}

/**
 * Leitet die Weisungen **aller** Mitgliedshäuser aus ihren Beschlüssen ab.
 *
 * Abgeleitet wird nur, was feststeht. Wo ein Haus nicht entschieden hat, steht
 * der Grund im Befund — und daneben, was das Reglement des Hauses dafür
 * vorsieht (`ohneBeschluss`). Eingetragen wird das **nicht** von selbst: Eine
 * Weisung, die niemand erteilt hat, ist eine Behauptung, und sie gehört
 * ausdrücklich festgehalten.
 */
export async function leiteWeisungenAbSammel(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id
): Promise<Sammelbefund> {
	const [beschluesse, lage] = await Promise.all([
		holeHausbeschluesseZumGeschaeft(handelnder.operatorId, traktandumId),
		holeWeisungsstand(handelnder.operatorId, meetingId, traktandumId)
	]);
	if (!lage) {
		throw fremdesTraktandum('traktandumId');
	}
	/*
	 * **Zuerst die beiden Fragen, die den Grund entscheiden** (08.09.2026, im
	 * Browserlauf gemessen).
	 *
	 * Vorher kannte diese Stelle zwei Zustände: Beschluss da oder nicht. Damit
	 * bekam jedes Haus denselben Satz «kein geschlossener Beschluss zu diesem
	 * Geschäft» — auch das Haus, das eine Minute vorher genau darüber
	 * abgestimmt und geschlossen hatte. Der Satz war nicht falsch und zeigte
	 * trotzdem in die falsche Richtung: Es fehlte kein Beschluss, es fehlte die
	 * **Klammer** zwischen den beiden Punkten. Ein Grund, der zum falschen Ort
	 * führt, kostet mehr als gar keiner.
	 */
	const geschaeftslage = await holeGeschaeftslage(handelnder.operatorId, traktandumId);
	/*
	 * **Der Ausweg, den die Absage nennt, muss der beste sein** (Code-Review
	 * 08.09.2026). Der erste Anlauf schickte den Leser «von Hand eintragen» —
	 * dabei steht auf derselben Seite je Haus die Auswahl «Aus einem Beschluss
	 * des Hauses», und die braucht kein gemeinsames Geschäft
	 * (`holeMitgliedsgemeinschaft` liest jeden geschlossenen Durchgang des
	 * Hauses). Sie führt zur Herkunft `beschluss` mit Quellverweis statt zu
	 * einer abgetippten Erklärung. Eine berichtigte Absage, die an den
	 * zweitbesten Ort zeigt, ist derselbe Fehler noch einmal.
	 */
	const jeHaus =
		'Wählen Sie die Weisung je Haus unter «Aus einem Beschluss des Hauses» — dort steht ' +
		'jeder geschlossene Hausbeschluss zur Wahl.';
	if (!geschaeftslage.gemeinsam) {
		throw new FachlicherFehler(
			'kein_geschaeft',
			`Dieser Punkt gehört zu keinem gemeinsamen Geschäft. ${jeHaus}`,
			'traktandumId'
		);
	}
	if (geschaeftslage.haeuser.size === 0) {
		throw new FachlicherFehler(
			'geschaeft_nur_hier',
			'Kein Haus führt diesen Punkt als dasselbe Geschäft; der Abend verbindet Traktanden ' +
				`über ihren Titel. ${jeHaus}`,
			'traktandumId'
		);
	}
	const jeParteiId = new Map(beschluesse.map((b) => [b.parteiId, b]));

	const gelungen: string[] = [];
	const offen: { name: string; grund: string }[] = [];

	for (const pflichtiger of lage.stand) {
		const b = jeParteiId.get(pflichtiger.parteiId);
		if (!b) {
			/*
			 * **Zwei verschiedene Gründe, zwei verschiedene Sätze.** Ein Haus, das
			 * den Punkt gar nicht führt, hat keinen Beschluss zu fassen; eines, das
			 * ihn führt, hat ihn noch nicht geschlossen. Der erste Fall führt in
			 * die gemeinsame Liste, der zweite in die Versammlung des Hauses.
			 */
			offen.push({
				name: pflichtiger.name,
				grund: geschaeftslage.haeuser.has(pflichtiger.parteiId)
					? 'noch kein geschlossener Beschluss'
					: 'führt diesen Punkt nicht als dasselbe Geschäft'
			});
			continue;
		}
		/*
		 * **Ein Beschluss über einen Folgeantrag ist kein Beschluss über diesen
		 * Punkt** (Codeprüfung B2a, M3). Nach einem Rückkommen darf im Haus ein
		 * Folgeantrag an die Stelle des alten Antrags treten (Produktentscheid
		 * 30.09.2026); sein Wortlaut ist ein anderer. Ein Ja zu «nur die
		 * Wetterseite» als Ja zu «die Fassade wird saniert» abzuleiten hiesse,
		 * eine Weisung zu unterstellen. Die Leitung entscheidet und trägt sie über
		 * «Aus einem Beschluss des Hauses» ein.
		 */
		if (b.folgeantrag) {
			offen.push({
				name: pflichtiger.name,
				// Zum besten Weg, nicht zum zweitbesten: Der Beschluss steht unter «Aus
				// einem Beschluss des Hauses» zur Wahl (Codeprüfung B2a, N-a).
				grund:
					`hat nach einem Rückkommen über den Folgeantrag «${b.folgeantrag}» beschlossen, nicht ` +
					'über diesen Wortlaut; ob daraus eine Weisung folgt, entscheiden Sie unter «Aus einem ' +
					'Beschluss des Hauses». Beantwortet der Beschluss die Frage nicht eindeutig, liegt ' +
					'keine Weisung vor'
			});
			continue;
		}
		try {
			await leiteWeisungAusBeschlussAb(handelnder, meetingId, {
				traktandumId,
				parteiId: pflichtiger.parteiId,
				quelleVersammlungId: b.versammlungId,
				quelleDurchgangId: b.durchgangId
			});
			gelungen.push(pflichtiger.name);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ name: pflichtiger.name, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen, offen };
}

/**
 * Trägt für Häuser ohne Beschluss ein, was ihr Reglement dafür vorsieht.
 *
 * **Ein eigener Handgriff**, nicht Teil der Ableitung: «Enthaltung oder Nein»
 * (Auftraggeber, 25.08.2026) ist eine Rechtsfolge aus dem Reglement des Hauses, keine
 * Auskunft aus einer Abstimmung. Wer sie einträgt, tut das ausdrücklich — die
 * Herkunft der Weisung heisst dann `erklaerung`, und die Fundstelle steht in
 * der Bemerkung.
 *
 * Häuser **ohne** hinterlegte Weisungsregel bleiben offen: Ohne Regel gibt es
 * nichts abzuleiten, und «Enthaltung» zu unterstellen wäre geraten.
 */
export async function trageOhneBeschlussEin(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id
): Promise<Sammelbefund> {
	const lage = await holeWeisungsstand(handelnder.operatorId, meetingId, traktandumId);
	if (!lage) {
		throw fremdesTraktandum('traktandumId');
	}
	/*
	 * **Ein Haus, das über einen Folgeantrag beschlossen hat, ist nicht ohne
	 * Beschluss** (Codeprüfung B2a, N-a). `leiteWeisungenAbSammel` lässt es
	 * offen, weil der Wortlaut ein anderer ist; ohne diese Zeile schriebe dieser
	 * Knopf danach «Ohne Beschluss des Hauses» hinein.
	 */
	const ueberFolgeantrag = new Map(
		(await holeHausbeschluesseZumGeschaeft(handelnder.operatorId, traktandumId))
			.filter((b) => b.folgeantrag)
			.map((b) => [b.parteiId, b.folgeantrag as string])
	);

	const gelungen: string[] = [];
	const offen: { name: string; grund: string }[] = [];

	for (const pflichtiger of lage.stand) {
		// Wer schon eine Weisung hat, bleibt unberührt — auch eine Enthaltung ist
		// eine Weisung, und sie zu überschreiben hiesse, sie zu erfinden.
		if (pflichtiger.weisung) continue;
		const folgeantrag = ueberFolgeantrag.get(pflichtiger.parteiId);
		if (folgeantrag) {
			offen.push({
				name: pflichtiger.name,
				grund:
					`hat nach einem Rückkommen über den Folgeantrag «${folgeantrag}» beschlossen; ob daraus ` +
					'eine Weisung folgt, entscheiden Sie unter «Aus einem Beschluss des Hauses». ' +
					'Beantwortet der Beschluss die Frage nicht eindeutig, liegt keine Weisung vor'
			});
			continue;
		}
		const haus = await holeMitgliedsgemeinschaftId(handelnder.operatorId, pflichtiger.parteiId);
		const regel = haus ? await holeWeisungsregel(handelnder.operatorId, haus) : null;
		if (!regel) {
			offen.push({
				name: pflichtiger.name,
				grund: 'keine Weisungsregel hinterlegt — im Reglement des Hauses nachsehen'
			});
			continue;
		}
		try {
			await halteWeisungFest(handelnder, meetingId, {
				traktandumId,
				parteiId: pflichtiger.parteiId,
				haltung: haltungOhneBeschluss(regel),
				// Die Auffangregel trägt einen eigenen Wert statt `erklaerung`
				// (Produktentscheid 08.10.2026): Erklärt hat niemand etwas; im
				// Paket heisst die Herkunft «nach der Auffangregel der Anwendung».
				herkunft: 'auffangregel',
				bemerkung: `Ohne Beschluss des Hauses; ${regel.fundstelle}`
			});
			gelungen.push(`${pflichtiger.name} (${haltungOhneBeschluss(regel)})`);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				offen.push({ name: pflichtiger.name, grund: fehler.message });
				continue;
			}
			throw fehler;
		}
	}

	return { gelungen, offen };
}

/** Auf welche Gemeinschaft eine weisungspflichtige Partei lautet. */
async function holeMitgliedsgemeinschaftId(operatorId: Id, parteiId: Id): Promise<Id | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ member_stweg_id: string | null }[]>`
			SELECT member_stweg_id FROM party WHERE id = ${parteiId}
		`;
		return z?.member_stweg_id ?? null;
	});
}

/**
 * Gibt die Stimmen der Miteigentümergemeinschaft nach den Weisungen ab.
 *
 * **Warum das kein Abkürzen ist.** Die Stimme gehört dem Haus, und die Weisung
 * sagt, wie sie lautet — sie abzuschreiben ist Handarbeit ohne Entscheidung.
 * Was hier entsteht, sind gewöhnliche Stimmzeilen mit dem Vermerk, dass die
 * Sitzungsleitung sie erfasst hat, und der Begründung «nach den Weisungen».
 *
 * **Ohne Weisung keine Stimme.** Ein Haus ohne Weisung bleibt leer; sein Name
 * steht im Befund. «Frei» ebenso: Dort entscheidet der Vertreter im Saal, und
 * die Anwendung darf ihm nicht vorgreifen.
 */
export async function stimmeNachWeisungenAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id
): Promise<Sammelbefund & { zeilen: number }> {
	const offener = await holeOffenen(handelnder.operatorId, meetingId);
	if (!offener) {
		throw new FachlicherFehler(
			'keine_offene',
			'Hier ist keine Abstimmung offen. Eröffnen Sie sie zuerst.',
			'durchgang'
		);
	}
	if (offener.traktandumId !== traktandumId) {
		throw new FachlicherFehler(
			'anderer_punkt',
			'Die offene Abstimmung gehört zu einem anderen Punkt.',
			'durchgang'
		);
	}

	const lage = await holeWeisungsstand(handelnder.operatorId, meetingId, traktandumId);
	if (!lage) {
		throw fremdesTraktandum('traktandumId');
	}

	const abgaben: { parteiId: Id; wahl: 'yes' | 'no' | 'abstain' }[] = [];
	const gelungen: string[] = [];
	const offen: { name: string; grund: string }[] = [];

	for (const pflichtiger of lage.stand) {
		const w = pflichtiger.weisung;
		if (!w) {
			offen.push({ name: pflichtiger.name, grund: 'keine Weisung' });
			continue;
		}
		if (w.herkunft === 'frei') {
			offen.push({
				name: pflichtiger.name,
				grund: 'nach freiem Ermessen des Vertreters — er stimmt selbst ab'
			});
			continue;
		}
		const wahl = w.haltung === 'ja' ? 'yes' : w.haltung === 'nein' ? 'no' : 'abstain';
		abgaben.push({ parteiId: pflichtiger.parteiId, wahl });
		gelungen.push(`${pflichtiger.name}: ${w.haltung}`);
	}

	if (abgaben.length === 0) return { gelungen, offen, zeilen: 0 };

	const { zeilen } = await gibStimmenAb(
		handelnder,
		meetingId,
		abgaben,
		true,
		'Nach den Weisungen der Mitgliedsgemeinschaften'
	);
	return { gelungen, offen, zeilen };
}
