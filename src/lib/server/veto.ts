/**
 * Das Veto einer Betroffenen im Ausstand (ZGB Art. 712g Abs. 4).
 *
 * **Was hier geschieht.** Eine Betroffene im Ausstand entscheidet über ihre
 * Zustimmung, ohne bei der Mehrheit mitzuwirken: am eigenen Telefon
 * (`weg = 'telefon'`) oder mündlich, von der Sitzungsleitung erfasst
 * (`weg = 'leitung'`). Der Entscheid ist **keine Stimme** und zählt nur als
 * Zustimmung; die Rechnung steht im Kern (`zaehleOhneWirkung`).
 *
 * **Produktentscheide 26.09.2026:** «Ob er es der Sitzungsleitung sagt oder
 * per Knopf tippt, die Wirkung ist dieselbe.» — «Ich meinte mit Zustimmung
 * das Veto. Also er ist im Ausstand. Aber er kann von seinem Veto gebrauch
 * machen entweder mündlich oder per Mobiltelefon.» Und: Die Vertretung einer
 * Betroffenen im Ausstand darf das Veto für sie ausüben; ihre Stimme ruht
 * weiter, nur das Veto geht.
 *
 * **Die Schranken**, je Handlung dieselben:
 *
 *   - Versammlung freigegeben oder laufend (`verlangeZustand`); nicht in der
 *     Pause, wie bei der Stimme. Das Siegel und die Abgabe sperren zusätzlich
 *     in der Datenhaltung (Migration 125).
 *   - Das Traktandum gehört zu dieser Versammlung.
 *   - Der Durchgang dieses Traktandums ist **offen** — die Umkehrung der
 *     Sperre bei Ausstand und Betroffenen. Der Veto-Entscheid gehört in die
 *     laufende Abstimmung; nach dem Schliessen trägt der Durchgang seinen
 *     Stand festgeschrieben (`affected_json`), und ein späterer Entscheid
 *     wirkte nicht mehr. Der Weg dorthin ist derselbe wie beim Ausstand:
 *     schliessen und das Rückkommen beantragen (H6).
 *   - Die Partei ist bei diesem Traktandum **betroffen und im Ausstand**.
 *   - Das Erfordernis des Durchgangs hat die Form `im_saal_oder_vorab`; bei
 *     `nachher` (Wertquoten) gibt es keinen Veto-Entscheid.
 *   - Die Partei steht im Stimmberechtigtenstand dieser Versammlung.
 *   - Führt eine Vertretung das Veto aus, braucht sie eine **bestätigte
 *     Vollmacht** für die Betroffene. Die Prüfung steht hier und nicht nur in
 *     der Oberfläche: Eine neue Schreibstelle erbt die Schranken nicht.
 *   - **Am eigenen Gerät** ist, wer tippt, als anwesend erfasst: die
 *     Betroffene selbst oder ihre Vertretung. So zeigt es die Oberfläche
 *     (`z/+page.svelte`, Abstimmungsblock nur bei «anwesend»), und so gilt es
 *     hier; sonst nähme der Server auch eine wartende oder abgelehnte
 *     Anmeldung an (Codeprüfung 26.09.2026, dritter Durchgang, M1).
 *   - Jede Aufnahme steht im Verlauf, mit Partei, Entscheid und Weg. Die
 *     Tabelle ist anfügend; eine Berichtigung erzeugt eine neue Zeile, und
 *     gezählt wird der letzte Entscheid.
 *
 * **Bewusst keine Schranke** (Produktentscheide 26.09.2026, nach der
 * Codeprüfung): (a) Anwesenheit beim Weg über die Sitzungsleitung. Auf die
 * Frage, ob der Anruf einer abwesenden Betroffenen bei der Sitzungsleitung
 * zählt: «ja». (b) Eine Vertretung, die
 * selbst im Ausstand ist, darf das Veto ausüben: BGE 134 III 481 E. 3.8
 * schliesst den Befangenen nur vom Stimmen aus, das Veto ist keine Stimme
 * (Rz. 207 ad 712g) und schützt die Berechtigte selbst (Rz. 208). (c) Ob die
 * Vollmacht einen Widerspruch gegen eine eigenhändige Zustimmung deckt,
 * verantwortet die Vertretung, nicht die Anwendung.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { verlangeZustand } from '$lib/domain/versammlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import { betroffenenlage } from '$lib/domain/entscheidbaum';
import type { Betroffenenzustimmung } from '$lib/domain/regelwerk';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { leseEreignisse } from './anwesenheit';
import { standVon } from '$lib/domain/anwesenheit';

type Tx = postgres.TransactionSql;

/**
 * Der Stand des Veto-Entscheids einer Betroffenen im Ausstand.
 *
 * **Auch ohne Entscheid**, mit `entscheid: null`: Die Leitungsseite zeigt die
 * Betroffenen, die im Ausstand sind, und ob schon ein Veto vorliegt.
 */
export interface VetoStand {
	parteiId: Id;
	name: string;
	/** Der letzte Entscheid im offenen Durchgang, oder `null`. */
	entscheid: 'ja' | 'nein' | null;
	weg: 'telefon' | 'leitung' | null;
	erfasstAm: string | null;
	/** Wer erfasst hat, im Klartext. */
	erfasstDurch: string | null;
	/** Wahr, wenn eine Vertretung das Veto ausgeübt hat. */
	durchVertretung: boolean;
	/**
	 * Die Angabe der vorab schriftlichen Zustimmung, oder `null`. Sie steht
	 * hier mit, damit die Leitungsseite nicht zur Eile drängt, wo die
	 * Zustimmung schon belegt ist (Laienprüfung, zweiter Durchgang).
	 */
	vorab: string | null;
}

/** Die Lage eines Durchgangs, soweit der Veto-Entscheid sie braucht. */
interface Durchgangslage {
	id: Id;
	form: Betroffenenzustimmung | null;
}

/**
 * Der offene Durchgang dieses Traktandums und die Form seines Erfordernisses.
 *
 * **Die Form aus dem Durchgang, nicht aus dem Traktandum.** Das Erfordernis
 * am Traktandum lässt sich während einer offenen Runde ändern; ausgezählt
 * wird mit dem beim Öffnen eingefrorenen (`requirement_json`). Der
 * Veto-Entscheid muss dieselbe Form lesen wie die Rechnung.
 */
async function offenerDurchgang(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	/**
	 * Für den Schreibweg: `FOR SHARE` wie die Stimme in `gibStimmenAb`
	 * (Codeprüfung H3, 13.10.2026, Befund M2: dieselbe Bauart wie S1). Ohne Sperre lief
	 * das Schliessen zwischen Lesen und Einfügen durch, und der Entscheid
	 * landete im geschlossenen Durchgang: erfasst gemeldet, im eingefrorenen
	 * Stand (`affected_json`) nicht enthalten. Das Schliessen wartet jetzt,
	 * bis der Entscheid steht; kommt er danach, fällt die Zeile heraus.
	 */
	sperren = false
): Promise<Durchgangslage | null> {
	const [z] = await tx<
		{
			id: string;
			knoten_id: string | null;
			form: string | null;
			noetig: boolean | null;
			kopfbasis: string | null;
		}[]
	>`
		SELECT id,
		       requirement_json->>'knotenId' AS knoten_id,
		       requirement_json->>'betroffenenzustimmung' AS form,
		       (requirement_json->>'zustimmungBetroffenerNoetig')::boolean AS noetig,
		       requirement_json->>'kopfbasis' AS kopfbasis
		  FROM voting_round
		 WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId}
		   AND state = 'offen' AND superseded_at IS NULL
		 ${sperren ? tx`FOR SHARE` : tx``}
	`;
	if (!z) return null;
	const lage = betroffenenlage({
		zustimmungBetroffenerNoetig: z.noetig === true,
		kopfbasis: (z.kopfbasis ?? 'anwesend_vertreten') as never,
		knotenId: z.knoten_id ?? '',
		betroffenenzustimmung: (z.form as Betroffenenzustimmung | null) ?? undefined
	});
	return { id: z.id, form: lage.form };
}

/**
 * Wer bei diesem Traktandum betroffen **und** im Ausstand ist, mit dem
 * letzten Veto-Entscheid des offenen Durchgangs.
 *
 * Leer, wo es keinen offenen Durchgang gibt oder die Form keine Zustimmung im
 * Saal oder vorab kennt: Dort gibt es keinen Veto-Entscheid, und die
 * Oberfläche soll nichts anbieten, das der Server abweist.
 */
export async function holeVeto(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<VetoStand[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const durchgang = await offenerDurchgang(tx, meetingId, traktandumId);
		if (!durchgang || durchgang.form !== 'im_saal_oder_vorab') return [];

		const zeilen = await tx<
			{
				party_id: string;
				name: string | null;
				entscheid: string | null;
				weg: string | null;
				erfasst_am: Date | null;
				erfasst_durch: string | null;
				durch_vertretung: boolean | null;
				vorab_vermerk: string | null;
			}[]
		>`
			SELECT a.party_id, p.display_name AS name, a.vorab_vermerk,
			       w.entscheid, w.weg, w.erfasst_am, w.erfasst_durch,
			       (w.cast_by_party_id IS NOT NULL) AS durch_vertretung
			FROM agenda_item_affected a
			JOIN agenda_item i ON i.id = a.agenda_item_id AND i.meeting_id = ${meetingId}
			JOIN recusal r ON r.agenda_item_id = a.agenda_item_id AND r.party_id = a.party_id
			LEFT JOIN party p ON p.id = a.party_id
			LEFT JOIN LATERAL (
				SELECT v.entscheid, v.weg, v.erfasst_am, v.erfasst_durch, v.cast_by_party_id
				FROM veto v
				JOIN snapshot_party s ON s.id = v.snapshot_party_id
				WHERE v.round_id = ${durchgang.id} AND s.party_id = a.party_id
				ORDER BY v.erfasst_am DESC, v.id DESC
				LIMIT 1
			) w ON true
			WHERE a.agenda_item_id = ${traktandumId}
			ORDER BY name, a.party_id
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			name: z.name ?? z.party_id,
			entscheid: (z.entscheid as 'ja' | 'nein' | null) ?? null,
			weg: (z.weg as 'telefon' | 'leitung' | null) ?? null,
			erfasstAm: z.erfasst_am ? new Date(z.erfasst_am).toISOString() : null,
			erfasstDurch: z.erfasst_durch,
			durchVertretung: z.durch_vertretung === true,
			vorab: z.vorab_vermerk
		}));
	});
}

/** Die Angaben, die ein Aufrufer zum Veto-Entscheid beisteuert. */
export interface VetoEingabe {
	entscheid: 'ja' | 'nein';
	weg: 'telefon' | 'leitung';
	/** Wer erfasst hat, im Klartext (Telefon: die Partei; Leitung: die Sitzungsleitung). */
	erfasstDurch: string;
	/**
	 * Die Partei, die das Veto aufgrund einer Vollmacht ausübt — die
	 * Zeilenkennung ihrer Momentaufnahme. Leer heisst: die Betroffene selbst.
	 */
	ausgeuebtVonId?: Id | null;
}

/**
 * Erfasst einen Veto-Entscheid.
 *
 * Gibt den Stand danach zurück, damit die aufrufende Action ihn zeigen kann;
 * massgebend bleibt der nächste Ladevorgang.
 */
export async function erfasseVeto(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id,
	eingabe: VetoEingabe
): Promise<VetoStand> {
	const wer = eingabe.erfasstDurch.trim();
	if (zeichenzahl(wer) < 2) {
		throw new FachlicherFehler(
			'ohne_erfasser',
			'Wer den Entscheid erfasst, gehört in den Nachweis. Tragen Sie den Namen ein.',
			'erfasstDurch'
		);
	}
	if (eingabe.entscheid !== 'ja' && eingabe.entscheid !== 'nein') {
		throw new FachlicherFehler('unbekannt', 'Unbekannter Veto-Entscheid.', 'entscheid');
	}
	if (eingabe.weg !== 'telefon' && eingabe.weg !== 'leitung') {
		throw new FachlicherFehler('unbekannt', 'Unbekannter Weg des Veto-Entscheids.', 'weg');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string; paused_at: Date | null }[]>`
			SELECT state, paused_at FROM meeting WHERE id = ${meetingId}
		`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand(
			{ zustand: m.state as never },
			['freigegeben', 'laufend'],
			'einen Veto-Entscheid erfassen'
		);

		/*
		 * **In der Pause wird nicht entschieden** — dieselbe Schranke wie bei
		 * der Stimme (`gibStimmenAb`). Die Versammlung ist unterbrochen; ein
		 * Entscheid fiele in eine Zeit, in der im Saal «Pause» steht.
		 */
		if (m.paused_at) {
			throw new FachlicherFehler(
				'unterbrochen',
				'Die Versammlung ist unterbrochen. Sobald die Sitzungsleitung fortfährt, lässt sich ' +
					'der Veto-Entscheid erfassen.',
				'zustand'
			);
		}

		const [t] = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item
			 WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		`;
		if (!t) throw fremdesTraktandum('traktandum');

		const durchgang = await offenerDurchgang(tx, meetingId, traktandumId, true);
		if (!durchgang) {
			throw new FachlicherFehler(
				'durchgang_nicht_offen',
				'Über dieses Traktandum wird gerade nicht abgestimmt. Der Veto-Entscheid gehört in ' +
					'die laufende Abstimmung; danach trägt der Durchgang seinen Stand festgeschrieben. ' +
					'Fehlte der Entscheid, ist eine neue Abstimmung nur noch über ein Rückkommen möglich; ' +
					'in ihr lässt er sich eintragen.',
				'traktandum'
			);
		}
		if (durchgang.form !== 'im_saal_oder_vorab') {
			throw new FachlicherFehler(
				'veto_unzulaessig',
				durchgang.form === 'nachher'
					? 'Bei diesem Erfordernis kommt die Zustimmung der Betroffenen nach der Versammlung, ' +
							'mit der Unterschrift auf der Abänderungsurkunde. Einen Veto-Entscheid gibt es ' +
							'hier nicht.'
					: 'Das Erfordernis dieses Traktandums verlangt keine Zustimmung Betroffener.',
				'partei'
			);
		}

		const [betroffen] = await tx<{ party_id: string; vorab_vermerk: string | null }[]>`
			SELECT party_id, vorab_vermerk FROM agenda_item_affected
			 WHERE agenda_item_id = ${traktandumId} AND party_id = ${parteiId}
		`;
		const [imAusstand] = await tx<{ party_id: string }[]>`
			SELECT party_id FROM recusal
			 WHERE agenda_item_id = ${traktandumId} AND party_id = ${parteiId}
			   AND meeting_id = ${meetingId}
		`;
		if (!betroffen || !imAusstand) {
			throw new FachlicherFehler(
				'veto_unzulaessig',
				'Das Veto setzt beides voraus: Die Partei ist bei diesem Traktandum als unmittelbar ' +
					'betroffen eingetragen und im Ausstand.',
				'partei'
			);
		}

		const [partei] = await tx<{ id: string; display_name: string }[]>`
			SELECT id, display_name FROM snapshot_party
			 WHERE meeting_id = ${meetingId} AND party_id = ${parteiId}
		`;
		if (!partei) {
			throw new FachlicherFehler(
				'unbekannt',
				'Diese Partei gehört nicht zu denen, die in dieser Versammlung stimmberechtigt sind.',
				'partei'
			);
		}

		/*
		 * **Am eigenen Gerät nur, wer als anwesend erfasst ist** (siehe Kopf).
		 * Geprüft wird, wer tippt: die Betroffene selbst oder ihre Vertretung.
		 */
		if (eingabe.weg === 'telefon') {
			const [tippt] = eingabe.ausgeuebtVonId
				? await tx<{ party_id: string }[]>`
						SELECT party_id FROM snapshot_party
						 WHERE id = ${eingabe.ausgeuebtVonId} AND meeting_id = ${meetingId}
					`
				: [{ party_id: parteiId }];
			const ereignisse = tippt ? await leseEreignisse(tx, meetingId) : [];
			const anwesend =
				tippt &&
				standVon(ereignisse.filter((e) => e.parteiId === tippt.party_id))?.zustand ===
					'anwesend';
			if (!anwesend) {
				throw new FachlicherFehler(
					'nicht_anwesend',
					'Sie sind nicht als anwesend erfasst. Wenden Sie sich an die Sitzungsleitung; sie ' +
						'kann den Entscheid auch mündlich erfassen.',
					'partei'
				);
			}
		}

		/*
		 * **Die Vertretung braucht eine bestätigte Vollmacht** (Produktentscheid
		 * 26.09.2026). Die Oberfläche holt die ausübbaren Stimmen über
		 * `holeAusuebbare`; hier wird dieselbe Bedingung nochmals geprüft, weil
		 * die Schreibstelle allein stehen muss.
		 */
		if (eingabe.ausgeuebtVonId) {
			if (eingabe.weg !== 'telefon') {
				throw new FachlicherFehler(
					'unbekannt',
					'Eine Vertretung übt am eigenen Gerät aus; die Sitzungsleitung erfasst den mündlichen ' +
						'Entscheid ohne Vertretung.',
					'ausgeuebtVon'
				);
			}
			const [vollmacht] = await tx<{ id: string }[]>`
				SELECT id FROM proxy
				 WHERE meeting_id = ${meetingId}
				   AND represented_id = ${partei.id}
				   AND holder_id = ${eingabe.ausgeuebtVonId}
				   AND state = 'bestaetigt'
			`;
			if (!vollmacht) {
				throw new FachlicherFehler(
					'keine_vollmacht',
					'Für diese Betroffene liegt keine bestätigte Vollmacht auf die ausübende Person vor.',
					'ausgeuebtVon'
				);
			}
		}

		const [zeile] = await tx<{ erfasst_am: Date }[]>`
			INSERT INTO veto (operator_id, round_id, snapshot_party_id, entscheid, weg,
			                  erfasst_durch, cast_by_party_id)
			VALUES (${handelnder.operatorId}, ${durchgang.id}, ${partei.id}, ${eingabe.entscheid},
			        ${eingabe.weg}, ${wer},
			        ${eingabe.ausgeuebtVonId ?? null})
			RETURNING erfasst_am
		`;

		const [vertretung] = eingabe.ausgeuebtVonId
			? await tx<{ display_name: string }[]>`
					SELECT display_name FROM snapshot_party WHERE id = ${eingabe.ausgeuebtVonId}
				`
			: [];
		const durchVertretung = Boolean(eingabe.ausgeuebtVonId);
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.vetoErfasst,
				{ art: 'agenda_item', id: traktandumId },
				{
					partei: partei.display_name,
					parteiId,
					traktandum: t.title,
					entscheid: eingabe.entscheid === 'ja' ? 'zugestimmt' : 'nicht zugestimmt',
					weg:
						eingabe.weg === 'telefon'
							? durchVertretung
								? 'durch ihre Vertretung'
								: 'am eigenen Gerät'
							: 'mündlich, von der Sitzungsleitung erfasst',
					erfasstDurch: wer,
					...(durchVertretung && vertretung
						? { vertretung: vertretung.display_name }
						: {})
				}
			)
		);

		return {
			parteiId,
			name: partei.display_name,
			entscheid: eingabe.entscheid,
			weg: eingabe.weg,
			erfasstAm: new Date(zeile.erfasst_am).toISOString(),
			erfasstDurch: wer,
			durchVertretung,
			vorab: betroffen.vorab_vermerk
		};
	});
}

/**
 * Wie viele Veto-Zeilen ein Durchgang hat, als Signal für das Nachladen
 * (`versammlungsstand.ts`). Keine Namen, keine Entscheide (AD-11).
 */
export async function zaehleVetozeilen(operatorId: Id, durchgangId: Id): Promise<number> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM veto WHERE round_id = ${durchgangId}
		`;
		return Number(z?.anzahl ?? 0);
	});
}
