/**
 * Unmittelbar Betroffene im Saal, und die Vorab-Zustimmung
 * (ZGB Art. 712e Abs. 2, Art. 712g Abs. 4; Block A2, 25.09.2026).
 *
 * **Was hier geschieht.** Die Sitzungsleitung trägt Betroffene ein oder aus und
 * vermerkt eine Zustimmung, die vor der Versammlung schriftlich erteilt wurde
 * (SVIT-Kommentar 2023, Art. 712g Rz. 209). Bis hierher liessen sich
 * Betroffene nur im Entwurf zuordnen, über das Traktandenformular
 * (`server/traktanden.ts`, `schreibeBetroffene`); der Weg bleibt dort.
 *
 * **Eine neue Schreibstelle erbt die Schranken nicht.** Die Sperre «nur im
 * Entwurf» galt bisher für jede Änderung an `agenda_item_affected`. Dieser Weg
 * läuft ab der Freigabe und braucht darum seine eigenen, je Handlung dieselben:
 *
 *   - Versammlung freigegeben oder laufend (`verlangeZustand`); nach dem
 *     Schliessen und nach dem Siegel nicht mehr. Das Siegel sperrt zusätzlich
 *     die Datenbank (Migration 124), die Abgabe an ein anderes Gerät ebenso
 *     (Migration 117).
 *   - Das Traktandum gehört zu dieser Versammlung, der Zeilenschutz trennt nach
 *     Betreiber.
 *   - Kein offener Durchgang dieses Traktandums: Eine Änderung verschöbe sonst,
 *     woran die laufende Abstimmung gemessen wird. Nach dem Schliessen geht es
 *     wieder, für ein Rückkommen; der geschlossene Durchgang trägt seinen Stand
 *     festgeschrieben (`voting_round.affected_json`) und merkt davon nichts.
 *   - Beim Eintragen und Vermerken: Die Partei steht im
 *     Stimmberechtigtenstand dieser Versammlung. Ab der Freigabe gibt es ihn,
 *     und wer nicht darin steht, kann im Saal weder zustimmen noch widerrufen;
 *     ein Vermerk für sie bliebe ohne Wirkung (Code-Review 25.09.2026, M3).
 *     Austragen und Zurücknehmen gehen auch ohne, damit sich eine solche
 *     Zuordnung aus dem Traktandenformular berichtigen lässt.
 *   - Das Erfordernis kennt Betroffene überhaupt; der Vorab-Vermerk nur bei der
 *     Form `im_saal_oder_vorab`.
 *   - Jede Handlung steht im Verlauf, mit Person und Angabe.
 *
 * **Zustand «freigegeben» und «laufend»**, nicht nur «laufend», wie der Plan
 * (Abschnitt 4) sagt: Eine Vorab-Zustimmung trifft vor der Versammlung ein und
 * soll sich vermerken lassen, sobald die Traktanden feststehen. Der Ausstand
 * steht in denselben Zuständen offen (`server/ausstand.ts`).
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { verlangeZustand } from '$lib/domain/versammlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { betroffenenlage } from '$lib/domain/entscheidbaum';
import type { Betroffenenzustimmung, Kopfbasis } from '$lib/domain/regelwerk';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { abbrechenStattSchliessen } from '$lib/domain/abstimmung';

type Tx = postgres.TransactionSql;

/** Eine betroffene Partei am Traktandum, wie die Leitungsseite sie zeigt. */
export interface Betroffene {
	parteiId: Id;
	name: string;
	/** Wer im Saal eingetragen hat. `null`: in der Vorbereitung zugeordnet. */
	eingetragenDurch: string | null;
	vorab: { vermerk: string; erfasstAm: string; erfasstDurch: string } | null;
	/** Ob die Wohnung der Partei mehreren gehört (gemeinsames Eigentum). */
	gemeinsam: boolean;
	/**
	 * Bei der Ausschlussklage: wahr, wenn alle Eigentümer der gemeinsamen
	 * Wohnung beklagt sind (Migration 132). Vorgabe: nur eine Person.
	 */
	alleEigentuemerBeklagt: boolean;
}

/**
 * Der Veto-Entscheid, wie er beim Schliessen in `voting_round.affected_json`
 * festgehalten wird (Migration 125, 26.09.2026).
 */
export interface VetoImDurchgang {
	entscheid: 'ja' | 'nein';
	weg: 'telefon' | 'leitung';
	/** Wahr, wenn die Vertretung das Veto ausgeübt hat. */
	durchVertretung: boolean;
}

/**
 * Der Stand, der beim Schliessen eines Durchgangs festgeschrieben wird
 * (`voting_round.affected_json`, Migration 124; Veto seit 125).
 */
export interface BetroffeneImDurchgang {
	parteiId: Id;
	/** Die Angabe des Vorab-Vermerks, oder `null`. */
	vorab: string | null;
	/** Der letzte Veto-Entscheid im Durchgang, oder `null`. */
	veto: VetoImDurchgang | null;
	/**
	 * Die Angabe «alle Eigentümer der Wohnung beklagt» (Migration 132). Steht
	 * nur, wenn sie wahr ist; fehlt sie, gilt «nur eine Person», auch bei
	 * Durchgängen, die vor Migration 132 geschlossen wurden.
	 */
	alleBeklagt?: boolean;
}

/**
 * Die Betroffenen eines Traktandums für das Festschreiben beim Schliessen.
 *
 * Nach Kennung geordnet, damit derselbe Stand dasselbe JSON ergibt.
 *
 * **Der Veto-Entscheid kommt aus der Tabelle, nicht aus dem Vorab-Vermerk.**
 * Er gilt je Durchgang (Auftrag vom 26.09.2026); gelesen wird der **letzte**
 * je Partei, denn `veto` ist anfügend und eine Berichtigung erzeugt eine neue
 * Zeile. Für Durchgänge, die vor dieser Migration geschlossen wurden, steht
 * in `affected_json` kein `veto`; dort gilt `null`.
 */
export async function leseBetroffeneIn(
	tx: Tx,
	traktandumId: Id,
	roundId: Id
): Promise<BetroffeneImDurchgang[]> {
	const zeilen = await tx<
		{
			party_id: string;
			vorab_vermerk: string | null;
			alle_eigentuemer_beklagt: boolean;
			veto_entscheid: string | null;
			veto_weg: string | null;
			veto_vertretung: boolean | null;
		}[]
	>`
		SELECT a.party_id, a.vorab_vermerk, a.alle_eigentuemer_beklagt,
		       w.entscheid AS veto_entscheid, w.weg AS veto_weg,
		       (w.cast_by_party_id IS NOT NULL) AS veto_vertretung
		FROM agenda_item_affected a
		LEFT JOIN LATERAL (
			SELECT v.entscheid, v.weg, v.cast_by_party_id
			FROM veto v
			JOIN snapshot_party s ON s.id = v.snapshot_party_id
			WHERE v.round_id = ${roundId} AND s.party_id = a.party_id
			ORDER BY v.erfasst_am DESC, v.id DESC
			LIMIT 1
		) w ON true
		WHERE a.agenda_item_id = ${traktandumId}
		ORDER BY a.party_id
	`;
	return zeilen.map((z) => ({
		parteiId: z.party_id,
		vorab: z.vorab_vermerk,
		veto:
			z.veto_entscheid && z.veto_weg
				? {
						entscheid: z.veto_entscheid as 'ja' | 'nein',
						weg: z.veto_weg as 'telefon' | 'leitung',
						durchVertretung: z.veto_vertretung === true
					}
				: null,
		// Nur wenn gesetzt: Der Stand ohne Angabe bleibt derselbe JSON wie vor
		// Migration 132, und «fehlt» heisst dort wie hier «nur eine Person».
		...(z.alle_eigentuemer_beklagt ? { alleBeklagt: true } : {})
	}));
}

/** Wer bei diesem Traktandum als betroffen eingetragen ist. */
export async function holeBetroffene(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Betroffene[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				party_id: string;
				name: string | null;
				eingetragen_durch: string | null;
				vorab_vermerk: string | null;
				vorab_erfasst_am: Date | null;
				vorab_erfasst_durch: string | null;
				gemeinsam: boolean | null;
				alle_eigentuemer_beklagt: boolean;
			}[]
		>`
			SELECT b.party_id, p.display_name AS name, b.eingetragen_durch,
			       b.vorab_vermerk, b.vorab_erfasst_am, b.vorab_erfasst_durch,
			       COALESCE(s.is_community, p.is_community) AS gemeinsam,
			       b.alle_eigentuemer_beklagt
			FROM agenda_item_affected b
			JOIN agenda_item a ON a.id = b.agenda_item_id
			LEFT JOIN party p ON p.id = b.party_id
			-- Gezählt wird auf dem eingefrorenen Stand (AD-3); die Stammdaten nur,
			-- solange es ihn nicht gibt.
			LEFT JOIN snapshot_party s ON s.meeting_id = a.meeting_id AND s.party_id = b.party_id
			WHERE b.agenda_item_id = ${traktandumId} AND a.meeting_id = ${meetingId}
			ORDER BY p.display_name, b.party_id
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			// Fehlt die Partei in den Stammdaten, bleibt die Kennung stehen statt
			// einer leeren Zeile (wie beim Ausstand).
			name: z.name ?? z.party_id,
			eingetragenDurch: z.eingetragen_durch,
			vorab:
				z.vorab_vermerk && z.vorab_erfasst_am && z.vorab_erfasst_durch
					? {
							vermerk: z.vorab_vermerk,
							erfasstAm: new Date(z.vorab_erfasst_am).toISOString(),
							erfasstDurch: z.vorab_erfasst_durch
						}
					: null,
			gemeinsam: z.gemeinsam === true,
			alleEigentuemerBeklagt: z.alle_eigentuemer_beklagt
		}));
	});
}

interface Traktandumslage {
	titel: string;
	/** Wie die Zustimmung erteilt wird; `null`, wo keine nötig ist. */
	form: Betroffenenzustimmung | null;
	/** Ob Betroffene bei diesem Erfordernis überhaupt etwas bewirken. */
	kenntBetroffene: boolean;
	/** Ob die Angabe «alle Eigentümer beklagt» hier wirkt (`beklagtenwohnungZaehltMit`). */
	beklagtenumfangWirkt: boolean;
}

/**
 * Die Schranken, die für jede Handlung dieser Datei gelten (siehe oben).
 *
 * `handlung` steht in der Absage des Zustands, etwa «Betroffene eintragen».
 */
async function verlangeSchranken(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	handlung: string
): Promise<Traktandumslage> {
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	verlangeZustand({ zustand: m.state as never }, ['freigegeben', 'laufend'], handlung);

	const [t] = await tx<
		{
			title: string;
			requirement_node: string | null;
			requirement_needs_affected_consent: boolean | null;
			requirement_affected_consent_form: Betroffenenzustimmung | null;
			requirement_head_base: string | null;
			requirement_version: string | null;
		}[]
	>`
		SELECT title, requirement_node, requirement_needs_affected_consent,
		       requirement_affected_consent_form, requirement_head_base, requirement_version
		FROM agenda_item
		WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
	`;
	if (!t) throw fremdesTraktandum('traktandum');

	/*
	 * **Der offene Durchgang dieses Traktandums**, nicht irgendeiner. Dieselbe
	 * Bedingung wie beim Ausstand (`server/ausstand.ts`): Solange abgestimmt
	 * wird, misst der Durchgang an dem, was jetzt eingetragen ist; eingefroren
	 * wird erst beim Schliessen.
	 *
	 * **Der Ausweg gehört in die Absage** (Code-Review 25.09.2026, M1). Nach dem
	 * Schliessen wirkt eine Änderung auf diesen Durchgang nicht mehr, er ist
	 * eingefroren. «Erst nach dem Schliessen ändern» wäre darum ein Weg ins
	 * Leere; der echte heisst wie beim Ausstand: ohne Ergebnis abbrechen, ordnen,
	 * neu freigeben (H6, `brecheAbstimmungAb`). Schliessen verkündete ein
	 * Ergebnis auf falscher Grundlage, und eine Neuabstimmung der Leitung gibt
	 * es danach nicht mehr.
	 *
	 * Gelesen und geschrieben wird ohne Sperre gegen ein gleichzeitiges Öffnen,
	 * dasselbe Muster wie in `server/ausstand.ts`.
	 */
	const [offen] = await tx<{ id: string }[]>`
		SELECT id FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND closed_at IS NULL AND superseded_at IS NULL
	`;
	if (offen) {
		throw new FachlicherFehler(
			'durchgang_offen',
			'Über dieses Traktandum wird gerade abgestimmt. Eine Änderung an den Betroffenen ' +
				'verschöbe, woran die laufende Abstimmung gemessen wird. ' +
				abbrechenStattSchliessen('die Betroffenen'),
			'traktandum'
		);
	}

	const lage = betroffenenlage({
		zustimmungBetroffenerNoetig: t.requirement_needs_affected_consent === true,
		kopfbasis: (t.requirement_head_base ?? 'anwesend_vertreten') as Kopfbasis,
		knotenId: t.requirement_node ?? '',
		betroffenenzustimmung: t.requirement_affected_consent_form ?? undefined,
		fassung: t.requirement_version ?? ''
	});
	return {
		titel: t.title,
		form: lage.form,
		kenntBetroffene: lage.kennt,
		beklagtenumfangWirkt: lage.beklagtenumfang
	};
}

/**
 * Verlangt, dass die Partei im Stimmberechtigtenstand dieser Versammlung
 * steht, und gibt ihren Namen von dort zurück.
 *
 * **Über die Momentaufnahme, nicht über die Gemeinschaft** wie beim Ausstand:
 * Der wird auch im Entwurf erklärt, dieser Weg läuft erst ab der Freigabe, und
 * gezählt wird auf dem eingefrorenen Stand (AD-3). Wer dort nicht steht, kann
 * im Saal weder zustimmen noch widerrufen. Die Momentaufnahme gehört zur
 * Gemeinschaft der Versammlung; damit ist auch die fremde Partei abgewiesen.
 */
async function verlangeParteiImStand(tx: Tx, meetingId: Id, parteiId: Id): Promise<string> {
	const [p] = await tx<{ display_name: string }[]>`
		SELECT display_name FROM snapshot_party
		WHERE meeting_id = ${meetingId} AND party_id = ${parteiId}
	`;
	if (!p) {
		throw new FachlicherFehler(
			'unbekannt',
			'Diese Partei gehört nicht zu denen, die in dieser Versammlung stimmberechtigt sind.',
			'partei'
		);
	}
	return p.display_name;
}

/**
 * Löscht die Vorab-Vermerke eines Traktandums, dessen Antragswortlaut sich
 * geändert hat, und schreibt je Vermerk einen Verlaufseintrag.
 *
 * **Warum** (Fachprüfung 25.09.2026, Block A2, V1-1): Eine schriftliche
 * Zustimmung gilt dem Antrag, dem sie erteilt wurde (SVIT-Kommentar 2023,
 * Art. 712g Rz. 209 bis 211). **Mit Verlaufseintrag** (Code-Review A2b,
 * Befund 9): Jede andere Handlung an einem Vermerk steht dort, mit Angabe.
 * Zwei Schreiber ändern den Wortlaut: das Traktandenformular hier und das
 * Geschäft am Abend (`server/geschaeft.ts`); beide rufen diese Funktion.
 */
export async function loescheVorabvermerkeNachNeuemWortlaut(
	tx: Tx,
	handelnder: Handelnder,
	traktandumId: Id,
	titel: string
): Promise<void> {
	const geloescht = await tx<{ party_id: string; hatte: string; name: string | null }[]>`
		UPDATE agenda_item_affected b
		   SET vorab_vermerk = NULL, vorab_erfasst_am = NULL, vorab_erfasst_durch = NULL
		  FROM (SELECT party_id, vorab_vermerk AS hatte FROM agenda_item_affected
		         WHERE agenda_item_id = ${traktandumId} AND vorab_vermerk IS NOT NULL) alt
		 WHERE b.agenda_item_id = ${traktandumId} AND b.party_id = alt.party_id
		RETURNING b.party_id, alt.hatte, (SELECT display_name FROM party WHERE id = b.party_id) AS name
	`;
	for (const z of geloescht) {
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.vorabZustimmungZurueckgenommen,
				{ art: 'agenda_item', id: traktandumId },
				{
					partei: z.name ?? z.party_id,
					parteiId: z.party_id,
					traktandum: titel,
					vermerk: z.hatte,
					grund: 'Der Wortlaut des Antrags wurde geändert.'
				}
			)
		);
	}
}

/**
 * Trägt Parteien bei einem Traktandum als unmittelbar betroffen ein.
 *
 * Mehrere auf einmal, in einer Transaktion: Scheitert eine, ist keine
 * eingetragen, und die Leitung sieht einen Stand statt eines halben.
 *
 * bindung: parteiIds — `verlangeParteiImStand` sucht jede Kennung in
 *   `snapshot_party` mit `meeting_id = ${meetingId}`, vor dem INSERT.
 */
export async function trageBetroffeneEin(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiIds: Id[]
): Promise<string[]> {
	if (parteiIds.length === 0) {
		throw new FachlicherFehler(
			'niemand',
			'Niemand ausgewählt. Kreuzen Sie an, wer unmittelbar betroffen ist.',
			'partei'
		);
	}
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const lage = await verlangeSchranken(tx, meetingId, traktandumId, 'Betroffene eintragen');
		if (!lage.kenntBetroffene) {
			throw new FachlicherFehler(
				'ohne_betroffene',
				'Das Erfordernis dieses Traktandums verlangt keine Zustimmung von Betroffenen. ' +
					'Stimmt das nicht, setzen Sie zuerst die nötige Mehrheit neu.',
				'traktandum'
			);
		}
		const [m] = await tx<{ stweg_id: string }[]>`
			SELECT stweg_id FROM meeting WHERE id = ${meetingId}
		`;

		const namen: string[] = [];
		for (const parteiId of [...new Set(parteiIds)]) {
			const name = await verlangeParteiImStand(tx, meetingId, parteiId);
			const [neu] = await tx<{ party_id: string }[]>`
				INSERT INTO agenda_item_affected
				       (agenda_item_id, party_id, operator_id, stweg_id, eingetragen_durch)
				VALUES (${traktandumId}, ${parteiId}, ${handelnder.operatorId}, ${m.stweg_id},
				        ${handelnder.label})
				ON CONFLICT (agenda_item_id, party_id) DO NOTHING
				RETURNING party_id
			`;
			if (!neu) {
				throw new FachlicherFehler(
					'schon_eingetragen',
					`«${name}» ist bei diesem Traktandum bereits als betroffen eingetragen.`,
					'partei'
				);
			}
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.betroffeneEingetragen,
					{ art: 'agenda_item', id: traktandumId },
					{ partei: name, parteiId, traktandum: lage.titel }
				)
			);
			namen.push(name);
		}
		return namen;
	});
}

/**
 * Trägt eine Partei als betroffen aus, samt einem Vorab-Vermerk.
 *
 * Der Vermerk steht dann nur noch im Verlauf, mit seiner Angabe: Wer
 * versehentlich ausgetragen hat, soll ihn nachlesen und neu vermerken können.
 *
 * **Ob etwas ausgetragen wurde, sagt der Rückgabewert** (Kreuzteil des
 * Fremdbetreiber-Durchstichs, 28.10.2026). Eine Partei, die hier nicht
 * eingetragen ist, auch eine von anderswo, trifft das DELETE nicht; die
 * Aktion meldete trotzdem «nicht mehr als betroffen eingetragen». Wie
 * `nimmAusstandZurueck`: `false` heisst «nichts geändert», und die Aktion sagt
 * das, statt Erfolg zu melden.
 *
 * bindung: parteiId — Das DELETE trifft nur die Zeile am Traktandum, und das
 *   Traktandum bindet `verlangeSchranken` an `meeting_id = ${meetingId}`.
 */
export async function trageBetroffeneAus(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id
): Promise<boolean> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const lage = await verlangeSchranken(tx, meetingId, traktandumId, 'Betroffene austragen');
		const [weg] = await tx<{ vorab_vermerk: string | null; name: string | null }[]>`
			DELETE FROM agenda_item_affected b
			WHERE b.agenda_item_id = ${traktandumId} AND b.party_id = ${parteiId}
			RETURNING b.vorab_vermerk,
			          (SELECT display_name FROM party WHERE id = b.party_id) AS name
		`;
		if (!weg) return false;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.betroffeneAusgetragen,
				{ art: 'agenda_item', id: traktandumId },
				{
					partei: weg.name ?? parteiId,
					parteiId,
					traktandum: lage.titel,
					...(weg.vorab_vermerk ? { vermerk: weg.vorab_vermerk } : {})
				}
			)
		);
		return true;
	});
}

/**
 * Vermerkt eine vorab schriftlich erteilte Zustimmung (ZGB Art. 712g Abs. 4).
 *
 * **Produktentscheid 25.09.2026:** ein Vermerk mit Pflichtangabe, erfasst
 * durch wen und wann, keine Beilage. Ein Nein im Saal widerruft ihn; das
 * rechnet der Kern (`zaehleAus`, Grund `widerrufen`), nicht diese Datei.
 * Bei geheimer Abstimmung nicht (Ä-38): Dort widerruft die Stimme nichts.
 *
 * **Nur bei der Form `im_saal_oder_vorab`.** Bei den Wertquoten
 * (`nachher`) kommt die Zustimmung mit der Abänderungsurkunde, und ein
 * Vermerk hier sähe aus wie eine erteilte Zustimmung, die nichts bewirkt.
 *
 * bindung: parteiId — `verlangeParteiImStand` sucht sie in `snapshot_party`
 *   mit `meeting_id = ${meetingId}`; das UPDATE trifft nur die Zeile am
 *   Traktandum, das `verlangeSchranken` an dieselbe Versammlung bindet.
 */
export async function vermerkeVorabZustimmung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id,
	angabe: string
): Promise<void> {
	const vermerk = angabe.trim();
	if (zeichenzahl(vermerk) < 3) {
		throw new FachlicherFehler(
			'vermerk_fehlt',
			'Geben Sie an, worauf sich die Zustimmung stützt, etwa «Schreiben vom 12.09.2026». ' +
				'Ohne Angabe liesse sich der Vermerk später nicht belegen.',
			'vermerk'
		);
	}
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const lage = await verlangeSchranken(
			tx,
			meetingId,
			traktandumId,
			'eine Vorab-Zustimmung vermerken'
		);
		await verlangeParteiImStand(tx, meetingId, parteiId);
		if (lage.form !== 'im_saal_oder_vorab') {
			throw new FachlicherFehler(
				'vorab_unzulaessig',
				lage.form === 'nachher'
					? 'Bei diesem Erfordernis kommt die Zustimmung der Betroffenen nach der Versammlung, ' +
							'mit der Unterschrift auf der Abänderungsurkunde. Eine Vorab-Zustimmung wird ' +
							'hier nicht vermerkt.'
					: 'Das Erfordernis dieses Traktandums verlangt keine Zustimmung von Betroffenen.',
				'vermerk'
			);
		}
		const [z] = await tx<{ name: string | null; hatte: string | null }[]>`
			UPDATE agenda_item_affected b
			   SET vorab_vermerk = ${vermerk}, vorab_erfasst_am = now(),
			       vorab_erfasst_durch = ${handelnder.label}
			  FROM (SELECT vorab_vermerk AS hatte FROM agenda_item_affected
			         WHERE agenda_item_id = ${traktandumId} AND party_id = ${parteiId}) alt
			 WHERE b.agenda_item_id = ${traktandumId} AND b.party_id = ${parteiId}
			RETURNING (SELECT display_name FROM party WHERE id = b.party_id) AS name, alt.hatte
		`;
		if (!z) {
			throw new FachlicherFehler(
				'nicht_eingetragen',
				'Diese Partei ist bei diesem Traktandum nicht als betroffen eingetragen. Tragen ' +
					'Sie sie zuerst ein.',
				'partei'
			);
		}
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.vorabZustimmungVermerkt,
				{ art: 'agenda_item', id: traktandumId },
				{
					partei: z.name ?? parteiId,
					parteiId,
					traktandum: lage.titel,
					vermerk,
					...(z.hatte ? { bisher: z.hatte } : {})
				}
			)
		);
	});
}

/**
 * Nimmt einen Vorab-Vermerk zurück, etwa nach einem Erfassungsfehler.
 *
 * Das ist die Berichtigung durch die Sitzungsleitung. Der Widerruf durch die
 * Betroffene selbst ist ein Nein im Saal und steht im Ergebnis, nicht hier.
 * **Bei geheimer Abstimmung ist es dieser Weg** (Ä-38): Dort widerruft die
 * Stimme nichts; wer zurückzieht, sagt es vor dem Eröffnen, und die Leitung
 * nimmt den Vermerk hier zurück.
 *
 * Gibt `false` zurück, wenn kein Vermerk dieser Partei an diesem Traktandum
 * stand und also nichts geändert ist (wie `trageBetroffeneAus`).
 *
 * bindung: parteiId — Das UPDATE trifft nur die Zeile am Traktandum, und das
 *   Traktandum bindet `verlangeSchranken` an `meeting_id = ${meetingId}`.
 */
export async function nimmVorabZustimmungZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id
): Promise<boolean> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const lage = await verlangeSchranken(
			tx,
			meetingId,
			traktandumId,
			'einen Vorab-Vermerk zurücknehmen'
		);
		const [z] = await tx<{ name: string | null; hatte: string | null }[]>`
			UPDATE agenda_item_affected b
			   SET vorab_vermerk = NULL, vorab_erfasst_am = NULL, vorab_erfasst_durch = NULL
			  FROM (SELECT vorab_vermerk AS hatte FROM agenda_item_affected
			         WHERE agenda_item_id = ${traktandumId} AND party_id = ${parteiId}) alt
			 WHERE b.agenda_item_id = ${traktandumId} AND b.party_id = ${parteiId}
			   AND alt.hatte IS NOT NULL
			RETURNING (SELECT display_name FROM party WHERE id = b.party_id) AS name, alt.hatte
		`;
		if (!z) return false;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.vorabZustimmungZurueckgenommen,
				{ art: 'agenda_item', id: traktandumId },
				{ partei: z.name ?? parteiId, parteiId, traktandum: lage.titel, vermerk: z.hatte }
			)
		);
		return true;
	});
}

/**
 * Hält bei der Ausschlussklage fest, ob nur eine Person oder alle Eigentümer
 * der gemeinsamen Wohnung beklagt sind (Migration 132).
 *
 * **Produktentscheid 30.09.2026**, Anlass Fachprüfung F3-1: Bei
 * Gesamteigentum richtet sich die Klage gegen alle (SVIT-Kommentar 2023,
 * Rz. 216 ad Art. 712a), und dann fällt die Wohnung aus der Zahl. Vorgabe
 * «nur eine Person»: Die Wohnung zählt mit und stimmt nicht ab.
 *
 * **Dieselben Schranken wie jede Handlung hier**, dazu zwei eigene: Die
 * Angabe muss wirken (`beklagtenwohnungZaehltMit`: Ausschlussklage ab Fassung
 * 2026-10-11, Bezugsgrösse über alle), und die Partei muss im
 * Stimmberechtigtenstand als gemeinsames Eigentum stehen. Sonst stünde eine
 * Angabe da, die nichts bewirkt, und sähe aus wie eine, die etwas bewirkt.
 * Zurück auf «nur eine Person» geht immer, damit sich eine solche Angabe nach
 * einem geänderten Erfordernis berichtigen lässt.
 *
 * bindung: parteiId — `verlangeParteiImStand` sucht sie in `snapshot_party`
 *   mit `meeting_id = ${meetingId}`; das UPDATE trifft nur die Zeile am
 *   Traktandum, das `verlangeSchranken` an dieselbe Versammlung bindet.
 */
export async function setzeBeklagtenumfang(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id,
	alle: boolean
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const lage = await verlangeSchranken(
			tx,
			meetingId,
			traktandumId,
			'die Angabe zu den beklagten Eigentümern setzen'
		);
		if (alle) {
			if (!lage.beklagtenumfangWirkt) {
				throw new FachlicherFehler(
					'umfang_unwirksam',
					'Diese Angabe gibt es nur bei der Ermächtigung zur Ausschlussklage, gemessen an ' +
						'allen Eigentümern. Beim Erfordernis dieses Traktandums rechnet die Anwendung nicht ' +
						'damit.',
					'partei'
				);
			}
			await verlangeParteiImStand(tx, meetingId, parteiId);
			const [p] = await tx<{ is_community: boolean }[]>`
				SELECT is_community FROM snapshot_party
				WHERE meeting_id = ${meetingId} AND party_id = ${parteiId}
			`;
			if (!p?.is_community) {
				throw new FachlicherFehler(
					'umfang_unwirksam',
					'Diese Wohnung gehört einer Person allein. Die Angabe gibt es nur bei einer Wohnung, ' +
						'die mehreren gehört.',
					'partei'
				);
			}
		}
		const [z] = await tx<{ name: string | null; hatte: boolean }[]>`
			UPDATE agenda_item_affected b
			   SET alle_eigentuemer_beklagt = ${alle}
			  FROM (SELECT alle_eigentuemer_beklagt AS hatte FROM agenda_item_affected
			         WHERE agenda_item_id = ${traktandumId} AND party_id = ${parteiId}) alt
			 WHERE b.agenda_item_id = ${traktandumId} AND b.party_id = ${parteiId}
			RETURNING (SELECT display_name FROM party WHERE id = b.party_id) AS name, alt.hatte
		`;
		if (!z) {
			throw new FachlicherFehler(
				'nicht_eingetragen',
				'Diese Partei ist bei diesem Traktandum nicht als beklagt eingetragen. Tragen Sie sie ' +
					'zuerst ein.',
				'partei'
			);
		}
		if (z.hatte === alle) return;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.beklagtenumfangGesetzt,
				{ art: 'agenda_item', id: traktandumId },
				{
					partei: z.name ?? parteiId,
					parteiId,
					traktandum: lage.titel,
					vorher: beklagtenumfangInWorten(z.hatte),
					nachher: beklagtenumfangInWorten(alle)
				}
			)
		);
	});
}

/** Die Angabe in Worten, für Verlauf und Leitung. */
export function beklagtenumfangInWorten(alle: boolean): string {
	return alle ? 'alle Eigentümer der Wohnung beklagt' : 'nur eine Person beklagt';
}

/** Die Rückmeldung nach dem Setzen, für beide Leitungsseiten. */
export function beklagtenumfangMeldung(alle: boolean): string {
	return alle
		? 'Festgehalten: Alle Eigentümer der Wohnung sind beklagt. Die Wohnung zählt nicht in der Zahl.'
		: 'Festgehalten: Nur eine Person ist beklagt. Die Wohnung zählt in der Zahl und stimmt nicht ab.';
}
