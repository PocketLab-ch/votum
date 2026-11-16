/**
 * Vertretung und Vollmacht — Zugriff auf die Datenbank (FR-23 bis FR-25).
 *
 * Der Kern in `$lib/domain/vollmacht` entscheidet, was zulässig ist; hier steht
 * nur, wie es gespeichert und gelesen wird (AD-1).
 *
 * **Nicht zu verwechseln mit `vertretung.ts`.** Jenes führt die Vertretung einer
 * Mitgliedsgemeinschaft im Verbund (Story 7.2) — eine Dauereinrichtung mit
 * Zeitraum, aus dem Reglement der MEG. Hier geht es um die Vollmacht einer
 * einzelnen Person für **eine** Versammlung.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { legeAb, liesHochgeladene } from './dateien';
import { leseEreignisseJeMomentpartei, schreibeEreignis } from './anwesenheitsereignisse';
import { standVon } from '$lib/domain/anwesenheit';
import { schreibeVerlauf, type Handelnder } from './audit';
import { abgeschlossen, type Versammlungszustand } from '$lib/domain/versammlung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { VERWALTUNG_KENNZEICHNUNG_GESPERRT } from '$lib/domain/mehrhinweise';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { holeLesartenIn } from './lesarten';
import {
	bestimmeVertretungsgrund,
	brauchtNachweis,
	MITBERECHTIGUNGEN,
	pruefeEingabe,
	verlangeEinGrundEinePartei,
	verlangeBeendbar,
	verlangeBestaetigbar,
	verlangeGrund,
	vollmachtsgrenzeSatz,
	vollmachtsschluessel,
	zaehltZurHoechstzahl,
	type GepruefteEingabe,
	type Mitberechtigung,
	type Vertretungsgrund,
	type Vollmacht,
	type Vollmachtseingabe,
	type Vollmachtsherkunft,
	type Vollmachtszustand
} from '$lib/domain/vollmacht';
import type { Id } from '$lib/domain/types';

interface Zeile {
	id: string;
	meeting_id: string;
	represented_id: string;
	vertretene_name: string;
	holder_id: string | null;
	vertreter_name_partei: string | null;
	holder_name: string | null;
	state: Vollmachtszustand;
	declared_via: Vollmachtsherkunft;
	holder_is_management: boolean;
	representation_basis: Vertretungsgrund | null;
	mitberechtigung: string | null;
	proof_shown: boolean;
	anzahl_dateien: string | number;
	note: string | null;
	created_at: Date;
	created_by_label: string | null;
	confirmed_at: Date | null;
	confirmed_by_label: string | null;
	ended_at: Date | null;
	ended_reason: string | null;
	ended_by_label: string | null;
}

function ausDb(z: Zeile): Vollmacht {
	return {
		id: z.id,
		meetingId: z.meeting_id,
		vertreteneId: z.represented_id,
		vertreteneName: z.vertretene_name,
		bevollmaechtigtId: z.holder_id,
		// Der Name kommt aus der Momentaufnahme, wenn die bevollmächtigte Person
		// selbst Partei ist — nie zweitgespeichert. Ein Name an zwei Stellen läuft auseinander.
		bevollmaechtigtName: z.holder_id ? z.vertreter_name_partei : z.holder_name,
		zustand: z.state,
		herkunft: z.declared_via,
		istVerwaltung: z.holder_is_management,
		vertretungsgrund: z.representation_basis,
		// Nur die beiden bekannten Werte; alles andere heisst «kein Vermerk» und
		// damit belegpflichtig (`brauchtNachweis`).
		mitberechtigung:
			z.representation_basis === 'mitberechtigt' &&
			(MITBERECHTIGUNGEN as readonly string[]).includes(z.mitberechtigung ?? '')
				? (z.mitberechtigung as Mitberechtigung)
				: null,
		nachweisVorgelegt: z.proof_shown,
		anzahlDateien: Number(z.anzahl_dateien),
		bemerkung: z.note,
		erfasstAm: z.created_at.toISOString(),
		erfasstDurch: z.created_by_label,
		bestaetigtAm: z.confirmed_at?.toISOString() ?? null,
		bestaetigtDurch: z.confirmed_by_label,
		beendetAm: z.ended_at?.toISOString() ?? null,
		beendetGrund: z.ended_reason,
		beendetDurch: z.ended_by_label
	};
}

export async function holeVollmachten(operatorId: Id, meetingId: Id): Promise<Vollmacht[]> {
	return alsBetreiber(operatorId, async (tx) => leseVollmachten(tx, meetingId));
}

/**
 * Wie viele Vollmachten an einer Versammlung hängen — in jedem Zustand.
 *
 * **Wozu die blosse Zahl, wo es `holeVollmachten` gibt** (Nachzug Block 3,
 * Entscheid E vom 03.10.2026). Mit der ersten Vollmacht ist die Freigabe
 * endgültig: `proxy_nur_lebensweg` (Migration 036) weist jedes Löschen ab, auch
 * das einer zurückgewiesenen oder widerrufenen Zeile, und die Rücknahme der
 * Freigabe verwirft die Momentaufnahme, an der sie hängt. Die Leitung soll das
 * sehen, **bevor** sie die erste Vollmacht erfasst; dafür genügt die Zahl, und
 * ein voller Lesevorgang samt Anhängen wäre dafür zu viel.
 *
 * **Gezählt wird wie in der Schranke** (`nimmVersammlungsfreigabeZurueck`,
 * `server/freigabe.ts`): alle Zeilen der Versammlung, ohne Filter auf den
 * Zustand. Eine zweite Zählung mit anderem Filter wäre die Stelle, an der die
 * Anzeige und die Absage auseinanderlaufen.
 */
export async function zaehleVollmachten(operatorId: Id, meetingId: Id): Promise<number> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM proxy WHERE meeting_id = ${meetingId}
		`;
		return z.anzahl;
	});
}

/**
 * Der Vermerk «eingetragen» oder «nicht eingetragen» zu `mitberechtigt`, aus
 * dem Verlaufseintrag der Erfassung (Produktentscheid 03.11.2026).
 *
 * **Warum aus dem Verlauf und nicht aus dem Register.** Der Verlauf ist nur
 * anfügbar (AD-5) und hält den Stand vom Augenblick der Erfassung. Das
 * Register ändert sich: Trägt die Verwaltung den Erben nach der Versammlung
 * als Mitberechtigten ein, verlöre das Protokoll den Vermerk, dass ein
 * Nachweis vorlag; nimmt sie jemanden heraus, stünde dort ein Nachweis, den
 * es nie gab. Eine neue Spalte hätte dasselbe geleistet, aber eine Migration
 * gekostet; das Muster, einen Wert aus dem Verlauf zu lesen, steht schon in
 * `server/einladungsmehr.ts`.
 *
 * Als Teilabfrage für die beiden Lesewege, die eine ganze Vollmacht bauen
 * (`leseVollmachten`, `holeEine`). Die Kennung im Verlauf ist Text.
 */
function mitberechtigungAusVerlauf(tx: postgres.TransactionSql) {
	return tx`(SELECT e.detail->>'mitberechtigung' FROM audit_entry e
		         WHERE e.subject_type = 'proxy' AND e.subject_id = p.id::text
		           AND e.event_type = ${EREIGNISARTEN.vollmachtErfasst}
		         ORDER BY e.id LIMIT 1) AS mitberechtigung`;
}

async function leseVollmachten(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<Vollmacht[]> {
	const zeilen = await tx<Zeile[]>`
		SELECT p.*,
		       v.display_name AS vertretene_name,
		       h.display_name AS vertreter_name_partei,
		       (SELECT count(*) FROM attachment a
		         WHERE a.subject_type = 'proxy' AND a.subject_id = p.id) AS anzahl_dateien,
		       ${mitberechtigungAusVerlauf(tx)}
		FROM proxy p
		JOIN snapshot_party v ON v.id = p.represented_id
		LEFT JOIN snapshot_party h ON h.id = p.holder_id
		WHERE p.meeting_id = ${meetingId}
		ORDER BY v.display_name, p.created_at
	`;
	return zeilen.map(ausDb);
}

/**
 * Eine Vollmacht **dieser** Versammlung.
 *
 * ## Warum die Versammlung mitfiltert
 *
 * Gefunden am 06.09.2026 im Sicherheitsdurchgang. Die Kennung der Vollmacht
 * kommt aus dem Formular, die Versammlung aus der Adresse — und bis hierher
 * hat niemand die beiden verglichen. `nurVorDemSchluss` prüfte die Versammlung
 * aus der Adresse, geändert wurde die Vollmacht aus dem Formular. Wer eine
 * offene Versammlung als Adresse nahm und die Kennung einer Vollmacht aus
 * einer **geschlossenen** einsetzte, kam an der Schranke vorbei, die genau das
 * verhindern soll: «Nach dem Schluss stehen Anwesenheit und Ergebnisse fest.»
 *
 * Die Zeilensicherheit begrenzt das auf den eigenen Betreiber — eine
 * Bewirtschaftung führt aber viele Gemeinschaften, und über die Grenze
 * zwischen ihnen sagt sie nichts.
 *
 * **Die Bedingung gehört an den Lesevorgang**, nicht an jede einzelne
 * Handlung: Bestätigen, Vorlage vermerken, Zurückweisen, Widerrufen und
 * Nachweis anhängen holen die Vollmacht alle hierüber.
 *
 * Zwei Wege lesen sie nicht und können deshalb nicht hier hängen:
 * `vermerkeVorlageInTx` und `haengeAbgelegtenNachweisAn` schreiben direkt.
 * Sie rufen `verlangeVollmachtIn` und scheitern damit an derselben Absage.
 * Ein erster Anlauf dieses Blocks behauptete an dieser Stelle, alle Wege
 * gingen über `holeEine` — der Code-Review hat den sechsten gefunden.
 *
 * Die Absage ist die vorhandene: Aus Sicht dieser Versammlung gibt es die
 * Vollmacht tatsächlich nicht.
 */
async function holeEine(tx: postgres.TransactionSql, meetingId: Id, id: Id): Promise<Vollmacht> {
	const [z] = await tx<Zeile[]>`
		SELECT p.*,
		       v.display_name AS vertretene_name,
		       h.display_name AS vertreter_name_partei,
		       (SELECT count(*) FROM attachment a
		         WHERE a.subject_type = 'proxy' AND a.subject_id = p.id) AS anzahl_dateien,
		       ${mitberechtigungAusVerlauf(tx)}
		FROM proxy p
		JOIN snapshot_party v ON v.id = p.represented_id
		LEFT JOIN snapshot_party h ON h.id = p.holder_id
		WHERE p.id = ${id} AND p.meeting_id = ${meetingId}
	`;
	if (!z) throw new FachlicherFehler('unbekannt', 'Diese Vollmacht gibt es nicht.', 'id');
	return ausDb(z);
}

/**
 * Verlangt, dass die Vollmacht zu dieser Versammlung gehört.
 *
 * Für die beiden Wege, die sie nicht ohnehin lesen. Sie **muss** absagen statt
 * nichts zu tun: Ein `UPDATE`, das keine Zeile trifft, ist von einem
 * erfolgreichen nicht zu unterscheiden, und der Verlaufseintrag dahinter
 * behauptete danach eine Vorlage, die nie stattgefunden hat. Ein Nachweis, den
 * die Datenbank nicht kennt und das Protokoll führt, ist schlimmer als gar
 * keiner.
 */
async function verlangeVollmachtIn(
	tx: postgres.TransactionSql,
	meetingId: Id,
	id: Id
): Promise<void> {
	const [z] = await tx<{ id: string }[]>`
		SELECT id FROM proxy WHERE id = ${id} AND meeting_id = ${meetingId}
	`;
	if (!z) throw new FachlicherFehler('unbekannt', 'Diese Vollmacht gibt es nicht.', 'id');
}

/**
 * Verlangt, dass die Versammlung noch nicht geschlossen ist.
 *
 * Nach dem Schluss stehen Anwesenheit und Ergebnisse fest; eine Vollmacht, die
 * danach entstünde, könnte an keiner Abstimmung mehr etwas ändern und sähe im
 * Protokoll aus wie ein nachgeschobener Beleg.
 */
async function nurVorDemSchluss(tx: postgres.TransactionSql, meetingId: Id): Promise<void> {
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
	if (m.state === 'entwurf') {
		throw new FachlicherFehler(
			'vor_freigabe',
			'Vollmachten lassen sich erst nach der Freigabe erfassen: Vorher steht nicht fest, wer stimmberechtigt ist.',
			'zustand'
		);
	}
	/*
	 * **Auch versiegelt** (04.09.2026): Hier stand nur `=== 'geschlossen'`, und
	 * an einer versiegelten Versammlung liess sich eine Vollmacht noch ändern.
	 * Das ist die Klasse, gegen die das Siegel überhaupt gebaut ist.
	 */
	if (abgeschlossen(m.state as Versammlungszustand)) {
		throw new FachlicherFehler(
			'geschlossen',
			'Die Versammlung ist geschlossen. Die Vertretungen stehen fest.',
			'zustand'
		);
	}
}

/** Ein Satz für den Verlauf: wer wen vertritt. */
function bezeichnung(v: Vollmacht): string {
	return `${v.bevollmaechtigtName ?? '?'} für ${v.vertreteneName}`;
}

export async function erfasseVollmacht(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	eingabe: Vollmachtseingabe
): Promise<Vollmacht> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		erfasseInTx(tx, handelnder, meetingId, eingabe)
	);
}

/**
 * Mehrere Vollmachten **einer** bevollmächtigten Person auf einmal erfassen.
 *
 * Der Regelfall auf der Erfassungsseite: Ein Blatt liegt vor, und darauf stehen
 * zwei oder drei Namen — oder dieselbe Person bringt mehrere Blätter mit. Je
 * Vollmacht einmal durch das Formular zu gehen ist derselbe Weg dreimal, und
 * beim dritten Mal wählt jemand die falsche Zeile.
 *
 * In **einer** Transaktion: Bricht es bei der zweiten ab, weil jemand schon
 * vertreten wird, entsteht auch die erste nicht. Sonst stünde die Hälfte da,
 * und niemand sähe der Liste an, welche Hälfte.
 */
export async function erfasseVollmachten(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	eingabe: {
		bevollmaechtigtId?: Id | null;
		bevollmaechtigtName?: string | null;
		vertritt: Id[];
		vertretungsgrund?: Vertretungsgrund | null;
		bemerkung?: string | null;
		istVerwaltung?: boolean;
	}
): Promise<Vollmacht[]> {
	if (eingabe.vertritt.length === 0) {
		throw new FachlicherFehler(
			'ohne_vertretene',
			'Wählen Sie, für wen die Vollmacht gilt.',
			'vertritt'
		);
	}
	// Ein Grund von Hand gilt für genau eine Partei (Produktentscheid 03.11.2026).
	verlangeEinGrundEinePartei(eingabe.vertretungsgrund, eingabe.vertritt.length);
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const aus: Vollmacht[] = [];
		for (const vertreteneId of eingabe.vertritt) {
			aus.push(
				await erfasseInTx(tx, handelnder, meetingId, {
					vertreteneId,
					bevollmaechtigtId: eingabe.bevollmaechtigtId,
					bevollmaechtigtName: eingabe.bevollmaechtigtName,
					vertretungsgrund: eingabe.vertretungsgrund,
					bemerkung: eingabe.bemerkung,
					istVerwaltung: eingabe.istVerwaltung
				})
			);
		}
		return aus;
	});
}

/**
 * Dasselbe innerhalb einer bestehenden Transaktion.
 *
 * Gebraucht vom Einlass am Eingang: Dort entstehen Anwesenheit und Vollmachten
 * in **einem** Vorgang. Zwei getrennte hiessen, dass dazwischen eine Abstimmung
 * geschlossen werden könnte — und dann fehlten Stimmen, die niemand vermisst.
 */
export async function erfasseInTx(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	eingabe: Vollmachtseingabe
): Promise<Vollmacht> {
	const roh = pruefeEingabe(eingabe);
	await nurVorDemSchluss(tx, meetingId);

	// Beide Parteien müssen zu dieser Versammlung gehören. Ohne die Prüfung
	// liesse sich eine Partei einer fremden Versammlung eintragen — die
	// Fremdschlüssel allein sehen die Versammlung nicht.
	await verlangeParteiDerVersammlung(tx, meetingId, roh.vertreteneId, 'vertreteneId');
	if (roh.bevollmaechtigtId) {
		await verlangeParteiDerVersammlung(tx, meetingId, roh.bevollmaechtigtId, 'bevollmaechtigtId');
	}

	/*
	 * **Der Grund für diese eine Vertretung** (Produktentscheid 03.11.2026).
	 * Ist die bevollmächtigte Partei im Register Mitglied der vertretenen
	 * gemeinschaftlichen Zeile, gilt `mitberechtigt` ohne Klick; «mitberechtigt»
	 * von Hand geht seit der Fachprüfung vom 03.11.2026 (C6) auch für eine
	 * Einzelperson, etwa die verstorbene Alleineigentümerin. Hier und nicht im Kern,
	 * weil die Mitgliedschaft in `party_member` steht.
	 *
	 * **Das Register von heute, nicht die Momentaufnahme.** Die Mitgliedschaft
	 * wird bei der Freigabe nicht eingefroren (Migration 013 kopiert nur
	 * Parteien und Einheiten). Gelesen wird sie im Augenblick der Erfassung und
	 * mit ihr festgeschrieben: Der Grund steht in der Zeile, der Vermerk im
	 * Verlauf, und beides ändert sich danach nicht mehr (Migration 121).
	 */
	const [tatsachen] = await tx<
		{ ist_huelle: boolean; mitglied: boolean }[]
	>`
		SELECT v.is_community AS ist_huelle,
		       EXISTS (
		         SELECT 1 FROM snapshot_party b
		           JOIN party_member m ON m.mitglied_party_id = b.party_id
		                              AND m.huelle_party_id = v.party_id
		          WHERE b.id = ${roh.bevollmaechtigtId}
		            AND b.meeting_id = ${meetingId}
		       ) AS mitglied
		FROM snapshot_party v
		WHERE v.id = ${roh.vertreteneId} AND v.meeting_id = ${meetingId}
	`;
	const hergeleitet = bestimmeVertretungsgrund({
		gewaehlt: roh.vertretungsgrund,
		vertreteneIstHuelle: tatsachen?.ist_huelle ?? false,
		bevollmaechtigtIstMitglied: tatsachen?.mitglied ?? false
	});
	const geprueft: GepruefteEingabe = { ...roh, vertretungsgrund: hergeleitet.vertretungsgrund };

	/*
	 * **Zwei Lagen, in denen eine Vollmacht nichts bewirken kann** (Hinweis
	 * des Auftraggebers vom 04.08.2026). Die Oberfläche sperrt sie schon in der Auswahl
	 * und nennt den Grund; hier steht dieselbe Regel noch einmal, weil eine
	 * abgeschickte Anfrage nicht davon abhängen darf, was eine Seite angezeigt
	 * hat.
	 */
	const [ziel] = await tx<{ party_id: string; display_name: string }[]>`
		SELECT party_id, display_name FROM snapshot_party WHERE id = ${geprueft.vertreteneId}
	`;
	const eigene = await leseEreignisseJeMomentpartei(tx, meetingId, geprueft.vertreteneId);
	if (standVon(eigene)?.zustand === 'anwesend') {
		// Wer selbst im Saal steht, übt selbst aus. Eine Vollmacht darüber endete
		// im selben Augenblick wieder (FR-25) — sie anzulegen führte in die Irre.
		throw new FachlicherFehler(
			'bereits_anwesend',
			`${ziel?.display_name ?? 'Diese Partei'} ist bereits anwesend und übt selbst aus. ` +
				'Eine Vollmacht darüber endete sofort wieder.',
			'vertreteneId'
		);
	}

	if (geprueft.bevollmaechtigtId) {
		const ueberDieAusuebende = await leseOffeneOderWirksame(
			tx,
			meetingId,
			geprueft.bevollmaechtigtId
		);
		if (ueberDieAusuebende) {
			// Wer sich selbst vertreten lässt, ist nicht da — und wer nicht da ist,
			// kann für niemanden die Hand heben.
			throw new FachlicherFehler(
				'selbst_vertreten',
				`${ueberDieAusuebende.vertreteneName} wird selbst durch ` +
					`${ueberDieAusuebende.bevollmaechtigtName} vertreten und kann deshalb keine Vollmacht ` +
					'ausüben.',
				'bevollmaechtigtId'
			);
		}
	}

	await verlangeVollmachtsgrenze(tx, meetingId, geprueft);

	const [angelegt] = await tx<{ id: string }[]>`
		INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_id, holder_name,
		                   holder_is_management, representation_basis, note, declared_via,
		                   created_by, created_by_label)
		VALUES (${handelnder.operatorId}, ${meetingId}, ${geprueft.vertreteneId},
		        ${geprueft.bevollmaechtigtId}, ${geprueft.bevollmaechtigtName},
		        ${geprueft.istVerwaltung}, ${geprueft.vertretungsgrund}, ${geprueft.bemerkung},
		        ${geprueft.herkunft}, ${handelnder.userId}, ${handelnder.label})
		RETURNING id
	`.catch(eindeutig);

	const v = await holeEine(tx, meetingId, angelegt.id);
	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.vollmachtErfasst, { art: 'proxy', id: v.id }, {
			vertretene: v.vertreteneName,
			vertreter: v.bevollmaechtigtName,
			dritte_person: v.bevollmaechtigtId === null,
			herkunft: geprueft.herkunft,
			// Ausdrücklich im Verlauf: Wer über der Höchstzahl vertrat, soll im
			// Anfechtungsfall belegen können, warum das zulässig war (Ä-28).
			vertretungsgrund: geprueft.vertretungsgrund,
			// L8 (Migration 184): Das Häkchen an der Vollmacht wie die übrigen
			// Felder; nur gesetzt, wenn es trägt, sonst stünde im Verlauf eine
			// Verneinung, die niemand angekreuzt hat.
			...(geprueft.istVerwaltung ? { verwaltung: true } : {}),
			// Ob Votum die Mitberechtigung aus dem Register kennt oder ein Nachweis
			// sie belegen muss. Von hier liest sie jede spätere Anzeige
			// (`mitberechtigungAusVerlauf`); deshalb nur bei `mitberechtigt`.
			...(hergeleitet.mitberechtigung ? { mitberechtigung: hergeleitet.mitberechtigung } : {})
		})
	]);
	// `holeEine` lief vor dem Verlaufseintrag und kennt den Vermerk noch nicht.
	return { ...v, mitberechtigung: hergeleitet.mitberechtigung };
}

/** Übersetzt den Verstoss gegen den eindeutigen Schlüssel in einen Satz. */
function eindeutig(fehler: unknown): never {
	const meldung = String((fehler as { message?: string })?.message ?? '');
	if (meldung.includes('proxy_eine_je_partei')) {
		throw new FachlicherFehler(
			'schon_vertreten',
			'Für diese Partei besteht bereits eine offene oder wirksame Vollmacht. Beenden Sie sie zuerst — zwei gleichzeitige wären zwei Personen für dieselbe Stimme.',
			'vertreteneId'
		);
	}
	throw fehler;
}

/**
 * Sperrt die Vollmacht, die die Grenze des Reglements überschreiten würde.
 *
 * **Produktentscheid 24.09.2026**, mit der Begründung im Wortlaut: «Das
 * Reglement geht dann vor. Ich würde noch früher ansetzen und beim Erfassen der
 * Vollmachten blockieren. Wenn nämlich ein Beschluss zustande kommt, weil das
 * Reglement nicht eingehalten wird, könnte der Beschluss seine Gültigkeit
 * verlieren (nichtig oder ungültig) und das Protokoll wird anfechtbar.»
 *
 * **Warum das die Leitplanke nicht bricht.** Das Werkzeug empfiehlt sonst und
 * sperrt nur, wo ein Schritt zwingend ist. Hier ist er es: Die überzählige
 * Vollmacht bleibt nicht folgenlos neben der Abstimmung stehen, sie **zählt
 * mit** — bei den Köpfen und bei den Wertquoten — und kann damit das Ergebnis
 * drehen. Was daran hängt, ist nicht die Ordnung der Erfassung, sondern die
 * Gültigkeit des Beschlusses.
 *
 * **Bis zum 24.09.2026 wurde nur gewarnt**, auf der Vollmachtenseite, und die
 * Auszählung wusste von der Grenze nichts: `proxyLimit` kam in
 * `anwesenheit.ts`, `auszaehlung.ts`, `stimmkraft.ts` und `server/abstimmung.ts`
 * nicht vor. Wer die Seite nicht öffnete, erfuhr nichts, und gezählt wurde
 * trotzdem.
 *
 * **Der Einwand dagegen, und warum er hier nicht trägt.** Eine Vollmacht, die
 * die Anwendung nicht erfasst, steht nachher auch nicht im Protokoll — das
 * spricht sonst gegen Sperren. Hier ist es umgekehrt richtig: Erfasst würde sie
 * ja nicht als Vermerk, sondern als **Stimmrecht**. Wer sie trotzdem festhalten
 * will, schreibt sie in die Bemerkung der Anwesenheit oder ins Protokoll, wo
 * sie keine Stimme trägt.
 *
 * **Ohne hinterlegte Grenze wird nichts geprüft**: Das Gesetz kennt keine
 * (ZGB Art. 712o schweigt dazu), die Zahl kommt allein aus dem Reglement.
 *
 * **Gezählt wird wie in `ueberschreitungen`**, über den angezeigten Namen und
 * nicht über die Kennung: Eine Person, die einmal als Eigentümerin dieser
 * Versammlung und einmal als dritte Person erfasst wird, ist dieselbe Person.
 * Zwei Zählweisen ergäben zwei Zahlen für dieselbe Lage, und die Warnung auf
 * der Vollmachtenseite widerspräche der Absage hier.
 *
 * **Und zwar über `vollmachtsschluessel`**, nicht über die rohe Zeichenkette
 * (Sicherheitsprüfung vom 24.09.2026, Befund 1). Der Name einer dritten Person
 * ist Freitext, auch auf dem Eigentümerpfad `/z` ohne Benutzerkonto: «Aebi»,
 * «aebi» und «Hans  Aebi» waren drei Zählgruppen, und weil die Warnung denselben
 * Schlüssel bildete, blieb die Umgehung ohne jede Spur.
 *
 * **Gezählt wird deshalb hier und nicht in der Abfrage.** Die erste Behebung
 * bildete die Normalisierung in SQL nach — und genau daran ist sie gescheitert
 * (zweiter Code-Review vom 24.09.2026, Befund 1): `\s` heisst in JavaScript und
 * in Postgres nicht dasselbe. Nachgemessen am lebenden System, als Hex:
 *
 *     «Hans<NBSP>Aebi»   SQL: 68616e73 c2a0 61656269
 *                         JS: 68616e73   20 61656269
 *
 * Postgres behält das geschützte Leerzeichen, JavaScript macht ein gewöhnliches
 * daraus. Wer die erste Vollmacht mit einem solchen Zeichen erfasste und die
 * zweite normal, wurde nicht gesperrt — und weil sich beliebig viele solcher
 * Varianten bilden lassen, war die Zahl der Zusatzvollmachten nicht begrenzt.
 * Dasselbe gilt für schmale und Ogham-Leerzeichen, die Byte-Reihenfolgemarke und
 * `btrim`, das nur gewöhnliche Leerzeichen abschneidet.
 *
 * **Die Lehre ist nicht «die Zeichenklasse angleichen».** Zwei Umsetzungen
 * derselben Regel laufen auseinander, sobald die Sprachen sie verschieden
 * verstehen, und die Stelle sieht beide Male richtig aus. Die Abfrage holt
 * deshalb nur noch die Namen; normalisiert wird **einmal**, in
 * `vollmachtsschluessel`. Eine Versammlung hat Dutzende Vollmachten, nicht
 * Tausende — die Zeilen zu holen kostet nichts.
 *
 * **Der Satz der Absage ist auf dem Zugangspfad knapper** (Befund 2). Dort
 * handelt ein Eigentümer ohne Benutzerkonto und darf den Namen frei tippen;
 * die ausführliche Meldung liesse sich als Orakel benutzen, um vor der
 * Versammlung abzufragen, wer wie viele Vollmachten hält. Die Leitung, die die
 * Liste ohnehin vor sich hat, bekommt die Zahl.
 *
 * **Die Warnung bleibt trotzdem stehen.** Sie fängt, was diese Sperre nicht
 * erreicht: Vollmachten, die erfasst wurden, bevor eine Grenze hinterlegt war,
 * und solche, die eine nachträglich gesenkte Grenze überschreiten.
 */
async function verlangeVollmachtsgrenze(
	tx: postgres.TransactionSql,
	meetingId: Id,
	geprueft: GepruefteEingabe
): Promise<void> {
	/*
	 * **Ä-28: Wer von Gesetzes wegen vertritt, zählt nicht mit.** Die
	 * Zweitprüfung vom 17.09.2026 nimmt Organvertreter juristischer Personen,
	 * gesetzliche Vertreter und Mitberechtigte von der Höchstzahl aus. Ohne
	 * diese Zeile wiese die Sperre eine rechtlich einwandfreie Vertretung ab,
	 * und es gäbe keinen Weg daran vorbei.
	 *
	 * **L15** (Migration 194): Unter «mitzaehlen» zählt die Stimmführung als
	 * Mitberechtigte doch mit, ab der Freigabe nach der Momentaufnahme. Dieselbe
	 * Regel wie `zaehltZurHoechstzahl` und die Abfrage über den Bestand unten.
	 */
	const stimmfuehrung = (await holeLesartenIn(tx, { meetingId })).L15;
	if (!zaehltZurHoechstzahl({ vertretungsgrund: geprueft.vertretungsgrund ?? null }, stimmfuehrung)) return;

	const [grenze] = await tx<{ proxy_limit: number | null; proxy_limit_rule_source: string | null }[]>`
		SELECT g.proxy_limit, g.proxy_limit_rule_source
		FROM meeting m JOIN stweg g ON g.id = m.stweg_id
		WHERE m.id = ${meetingId}
	`;
	if (!grenze?.proxy_limit) return;

	// Der angezeigte Name der bevollmächtigten Person: bei einer Partei dieser
	// Versammlung der hinterlegte, bei einer dritten Person der getippte.
	let name = geprueft.bevollmaechtigtName;
	if (geprueft.bevollmaechtigtId) {
		const [h] = await tx<{ display_name: string }[]>`
			SELECT display_name FROM snapshot_party WHERE id = ${geprueft.bevollmaechtigtId}
		`;
		name = h?.display_name ?? null;
	}
	if (!name) return;
	const schluessel = vollmachtsschluessel(name);
	if (!schluessel) return;

	// Nur wirksame und noch offene zählen, wie in `ueberschreitungen`:
	// Zurückgewiesene und widerrufene mitzuzählen hiesse, dass die Zahl mit
	// jeder Berichtigung wächst und der Einlass sich irgendwann aussperrt.
	/*
	 * **Die Zeile der Versammlung wird gesperrt, bevor gezählt wird** (zweiter
	 * Code-Review, Befund 7). Ohne das ist die Prüfung ein Lesen ohne Schloss:
	 * Zwei Erklärungen, die gleichzeitig über den Eigentümerzugang eintreffen,
	 * lesen beide `n = Grenze − 1` und fügen beide ein. Am Einlasstisch mit einem
	 * Bedienplatz wäre das unwahrscheinlich; vor der Versammlung, wo beliebig
	 * viele Eigentümer zugleich erklären, ist es der Normalbetrieb. Der
	 * vorhandene eindeutige Schlüssel fängt es nicht, weil er über die
	 * **vertretene** Partei geht, und das sind hier zwei verschiedene.
	 */
	await tx`SELECT id FROM meeting WHERE id = ${meetingId} FOR UPDATE`;

	const bestand = await tx<{ name: string | null; grund: string | null }[]>`
		SELECT coalesce(h.display_name, p.holder_name) AS name, p.representation_basis AS grund
		FROM proxy p LEFT JOIN snapshot_party h ON h.id = p.holder_id
		WHERE p.meeting_id = ${meetingId}
		  AND p.state IN ('erfasst', 'bestaetigt')
		  -- Ä-28, dieselbe Ausnahme wie oben: Was von Gesetzes wegen vertritt,
		  -- zählt auch im Bestand nicht zur Höchstzahl; die Stimmführung als
		  -- Mitberechtigte nur nach L15 «mitzaehlen» (Migration 194).
		  AND (p.representation_basis IS NULL
		       OR (${stimmfuehrung === 'mitzaehlen'} AND p.representation_basis = 'mitberechtigt'))
	`;
	const gezaehlt = bestand.filter((b) => b.name && vollmachtsschluessel(b.name) === schluessel);
	const waere = gezaehlt.length + 1;
	if (waere <= grenze.proxy_limit) return;

	throw new FachlicherFehler(
		'vollmachtsgrenze',
		vollmachtsgrenzeSatz({
			herkunft: geprueft.herkunft === 'zugang' ? 'zugang' : 'leitung',
			waere,
			name,
			hoechstzahl: grenze.proxy_limit,
			fundstelle: grenze.proxy_limit_rule_source,
			// Wer eine einwandfreie Organvertretung erfasst und den Grund zu wählen
			// vergisst, wurde vor B2 in die falsche Richtung geschickt; der Satz
			// nennt den Ausweg über den Grund (`vollmachtsgrenzeSatz`).
			stimmfuehrungGezaehlt:
				geprueft.vertretungsgrund === 'mitberechtigt' || gezaehlt.some((b) => b.grund === 'mitberechtigt'),
			stimmfuehrung
		}),
		// Das Feld folgt der Eingabeart, wie in `pruefeEingabe`: Wer den Namen
		// getippt hat, soll die Markierung am Namensfeld bekommen und nicht an
		// einer Auswahl, die er gar nicht benutzt hat. Heute wertet keine Seite
		// `feld` aus; wer die Markierung einschaltet, soll sie nicht erst
		// berichtigen müssen.
		geprueft.bevollmaechtigtId ? 'bevollmaechtigtId' : 'bevollmaechtigtName'
	);
}

async function verlangeParteiDerVersammlung(
	tx: postgres.TransactionSql,
	meetingId: Id,
	id: Id,
	feld: string
): Promise<void> {
	const [z] = await tx<{ id: string }[]>`
		SELECT id FROM snapshot_party WHERE id = ${id} AND meeting_id = ${meetingId}
	`;
	if (!z) {
		throw new FachlicherFehler(
			'fremde_partei',
			'Diese Partei ist an dieser Versammlung nicht stimmberechtigt.',
			feld
		);
	}
}

/**
 * Vermerkt, dass das Original vorgelegen hat.
 *
 * Getrennt vom Bestätigen, weil es zwei Aussagen sind: «ich habe es gesehen»
 * und «es gilt». Am Eingang fallen sie meist zusammen, aber wer eine Vollmacht
 * sieht und sie trotzdem zurückweisen will, braucht beide Schritte einzeln.
 */
export async function vermerkeVorlage(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id
): Promise<Vollmacht> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurVorDemSchluss(tx, meetingId);
		const v = await holeEine(tx, meetingId, id);
		verlangeBeendbar(v);
		await tx`UPDATE proxy SET proof_shown = true WHERE id = ${id} AND meeting_id = ${meetingId}`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.vollmachtNachweisNachgereicht, { art: 'proxy', id }, {
				art: 'original_vorgelegt',
				vollmacht: bezeichnung(v)
			})
		]);
		return holeEine(tx, meetingId, id);
	});
}

export async function bestaetigeVollmacht(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id
): Promise<Vollmacht> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		bestaetigeInTx(tx, handelnder, meetingId, id)
	);
}

/** Dasselbe innerhalb einer bestehenden Transaktion — siehe `erfasseInTx`. */
export async function bestaetigeInTx(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id
): Promise<Vollmacht> {
	await nurVorDemSchluss(tx, meetingId);
	const v = await holeEine(tx, meetingId, id);
	verlangeBestaetigbar(v);

	/*
	 * Eine Kennzeichnung je Name auch beim Bestätigen (Codeprüfung Lauf 5,
	 * B3, 07.11.2026): Erst die bestätigte Vollmacht zählt für den Ausstand aus
	 * L8, und der gilt je Name. Trägt diese Vollmacht das Häkchen, gleicht der
	 * Aufruf alle Vollmachten des Namens an, über die Sperre bei offener
	 * Abstimmung (H-1), denn sonst ruhte während der Abstimmung eine schon
	 * bestätigte Schwester, und ihre abgegebene Stimme fiele beim Schliessen
	 * weg. Trägt der Name das Häkchen schon, übernimmt diese Vollmacht es; sie
	 * ruhte ohnehin mit ihm. Entfernt wird es hier nie, sondern mit
	 * «Kennzeichnung entfernen» oder am Einlass mit dem abgewählten,
	 * vorbelegten Kästchen (E3, nach dem Bestätigen).
	 */
	if (!v.bevollmaechtigtId && v.bevollmaechtigtName) {
		let soll = v.istVerwaltung;
		if (!soll) {
			const schluessel = vollmachtsschluessel(v.bevollmaechtigtName);
			const andere = await tx<{ holder_name: string }[]>`
				SELECT holder_name FROM proxy
				WHERE meeting_id = ${meetingId} AND id <> ${id}
				  AND holder_id IS NULL AND holder_name IS NOT NULL
				  AND holder_is_management AND state = 'bestaetigt'
			`;
			soll = andere.some((z) => vollmachtsschluessel(z.holder_name) === schluessel);
		}
		if (soll) await kennzeichneVerwaltungInTx(tx, handelnder, meetingId, id, true);
	}

	await tx`
		UPDATE proxy SET state = 'bestaetigt', confirmed_at = now(),
		                 confirmed_by = ${handelnder.userId},
		                 confirmed_by_label = ${handelnder.label}
		WHERE id = ${id} AND meeting_id = ${meetingId}
	`;
	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.vollmachtBestaetigt, { art: 'proxy', id }, {
			vollmacht: bezeichnung(v),
			// «nicht_noetig» für die eingetragene Mitberechtigte (Produktentscheid
			// 03.11.2026); «datei» stünde dort für einen Beleg, den es nicht gibt.
			nachweis: v.nachweisVorgelegt
				? 'original_vorgelegt'
				: !brauchtNachweis(v) && v.anzahlDateien === 0 && v.herkunft !== 'zugang'
					? 'nicht_noetig'
					: 'datei'
		})
	]);
	return holeEine(tx, meetingId, id);
}

/** Vermerkt die Vorlage des Originals innerhalb einer Transaktion. */
export async function vermerkeVorlageInTx(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id
): Promise<void> {
	// Dieser Weg liest die Vollmacht nicht, fragt also eigens nach.
	await verlangeVollmachtIn(tx, meetingId, id);
	await tx`UPDATE proxy SET proof_shown = true WHERE id = ${id} AND meeting_id = ${meetingId}`;
	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.vollmachtNachweisNachgereicht, { art: 'proxy', id }, {
			art: 'original_vorgelegt'
		})
	]);
}

/**
 * Das Häkchen «Bevollmächtigt ist die Verwaltung» an einer bestehenden
 * Vollmacht setzen oder entfernen (L8, Migration 184; H-1, 07.11.2026).
 *
 * **Warum es diesen Weg braucht:** Hat ein Eigentümer die Vollmacht über
 * `/z/` erklärt, gibt es dort kein Häkchen nachzutragen und keines zu
 * entfernen, und beim Einlass durch Dritte verfiele es still, wenn schon eine
 * Vollmacht auf denselben Namen erfasst ist. Die Leitung sieht das Blatt und
 * weiss, für wen die Person arbeitet; ihr gehört die Angabe.
 *
 * **Dieselben Prüfungen wie die übrigen Änderungen** an einer Vollmacht:
 * `nurVorDemSchchluss`, gebunden an die Versammlung über `holeEine`, und
 * `verlangeBeendbar` — nur `erfasst` und `bestaetigt` tragen es, eine
 * beendete Vollmacht überträgt nichts mehr, und an ihr wäre das Häkchen eine
 * Angabe ohne Wirkung.
 *
 * **Bei einer Partei dieser Versammlung gilt es als nicht gesetzt**, wie der
 * Kern bei der Erfassung (`pruefeEingabe`): Die Maske bietet die Knöpfe nur
 * bei einer dritten Person an, und die Schranke der Datenbank
 * (`proxy_verwaltung_nur_dritte`) bleibt die Rückfallebene für jeden Weg,
 * der hier ohne Maske vorbeikommt.
 *
 * **Lauf 5 (07.11.2026):** Zwei Ergänzungen aus der Prüfung von Lauf 4. Die
 * Kennzeichnung bestätigter Vollmachten ruht, solange an einem Traktandum mit
 * Häkchen derselben Versammlung ein Durchgang offen ist (H-1, die Sperre
 * unten; erfasste lassen sich weiter kennzeichnen, B2), und sie gilt
 * je Name: Das Häkchen wandert an alle Vollmachten derselben Versammlung mit
 * demselben normalisierten Namen, jede mit ihrem Verlaufseintrag (M-4), denn
 * der Ausstand aus L8 ruht je Name und nicht je Zeile.
 */
export async function kennzeichneVerwaltung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	istVerwaltung: boolean
): Promise<Vollmacht> {
	return alsBetreiber(handelnder.operatorId, async (tx) =>
		kennzeichneVerwaltungInTx(tx, handelnder, meetingId, id, istVerwaltung)
	);
}

/**
 * H-1 (Lauf 5, 07.11.2026): Die Kennzeichnung einer Vollmacht als Verwaltung
 * lässt sich nicht ändern, solange an einem Traktandum mit Häkchen derselben
 * Versammlung ein Durchgang offen ist. Die Stimmsperre liest den Ausstand aus
 * L8 beim Abgeben, eingefroren wird er beim Schliessen; eine Änderung
 * dazwischen drehte das Ergebnis still. Das Muster ist
 * `verlangeKeinenOffenenDurchgang` in `ausstand.ts`, dort je Traktandum für
 * den erklärten Ausstand; hier über alle Traktanden der Versammlung, denn das
 * Häkchen wirkt an jedem von ihnen. Aufgerufen wird sie nur, wenn sich eine
 * bestätigte Vollmacht des Namens ändert (Codeprüfung Lauf 5, B2): beim
 * Kennzeichnen, bei der Übernahme beim Einlass, beim Entfernen am Einlass
 * (E3) und beim Bestätigen, wenn es den Namen angleicht (B3); dann scheitert
 * auch das Bestätigen oder der ganze Einlass.
 */
async function verlangeKeineOffeneAbstimmungAnVerwaltungsgeschaeften(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<void> {
	const [offen] = await tx<{ id: string }[]>`
		SELECT v.id
		FROM voting_round v
		JOIN agenda_item a ON a.id = v.agenda_item_id
		WHERE v.meeting_id = ${meetingId}
		  AND v.closed_at IS NULL AND v.superseded_at IS NULL
		  AND a.concerns_management
	`;
	if (!offen) return;
	throw new FachlicherFehler('durchgang_offen', VERWALTUNG_KENNZEICHNUNG_GESPERRT, 'istVerwaltung');
}

/** Dasselbe innerhalb einer bestehenden Transaktion — siehe `erfasseInTx`. */
export async function kennzeichneVerwaltungInTx(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	istVerwaltung: boolean
): Promise<Vollmacht> {
	await nurVorDemSchluss(tx, meetingId);
	const v = await holeEine(tx, meetingId, id);
	verlangeBeendbar(v);
	// Bei einer Partei dieser Versammlung still verwerfen wie der Kern; der
	// CHECK der Datenbank fängt jeden Weg, der es trotzdem versucht.
	if (v.bevollmaechtigtId) return v;
	/*
	 * M-4 (Lauf 5, 07.11.2026): Der Ausstand aus L8 gilt je Name
	 * (`vollmachtsschluessel`), nicht je Zeile. Die Kennzeichnung trägt ihn
	 * deshalb an allen Vollmachten derselben Versammlung mit demselben
	 * normalisierten Namen, sonst ruhte der Name weiter, obwohl die Leitung
	 * das Häkchen gerade entfernt hatte, und das Merkmal «· Verwaltung»
	 * stünde an der einen Zeile und fehlte an der anderen. Nur die beendbaren
	 * Zustände wie am Ziel selbst (`verlangeBeendbar`), und nur Zeilen ohne
	 * Partei: An einer Partei gilt das Häkchen als nicht gesetzt. Der
	 * Schlüssel wird in JavaScript gerechnet, nicht in SQL, aus demselben
	 * Grund wie bei `verlangeVollmachtsgrenze`.
	 */
	const schluessel = vollmachtsschluessel(v.bevollmaechtigtName ?? '');
	const zeilen = schluessel
		? await tx<
				{ id: string; holder_name: string; vertretene_name: string; ist_verwaltung: boolean; state: string }[]
			>`
			SELECT p.id, p.holder_name, v.display_name AS vertretene_name,
			       p.holder_is_management AS ist_verwaltung, p.state
			FROM proxy p
			JOIN snapshot_party v ON v.id = p.represented_id
			WHERE p.meeting_id = ${meetingId}
			  AND p.holder_id IS NULL AND p.holder_name IS NOT NULL
			  AND p.state IN ('erfasst', 'bestaetigt')
		`
		: [];
	const gleiche = zeilen.filter(
		(z) =>
			(z.id === id || vollmachtsschluessel(z.holder_name) === schluessel) &&
			z.ist_verwaltung !== istVerwaltung
	);
	// Ändert sich an keiner Zeile des Namens etwas, bleibt alles, wie es ist,
	// auch die Sperre (ein Einlass ohne Änderung kommt durch). Die Prüfung
	// gilt dem ganzen Namen, nicht nur dieser Zeile: Trägt sie den Wert schon,
	// eine bestätigte Vollmacht desselben Namens aber nicht, gleicht der Aufruf
	// beim Bestätigen den Namen an (`bestaetigeInTx`).
	if (gleiche.length === 0) return v;
	// H-1 (Lauf 5, 07.11.2026): Die Sperre greift nur, wenn sich eine
	// bestätigte Vollmacht ändert. Nur sie zählt für den Ausstand aus L8
	// (`leseVerwaltungsausstandIn`); eine erfasste trägt noch keine Stimme, ihre
	// Kennzeichnung dreht kein Ergebnis. So kommt eine Verwaltung, die während
	// einer Abstimmung eintritt, mit dem Häkchen herein, solange ihr Name nicht
	// schon bestätigte Vollmachten mit anderem Wert hat.
	if (gleiche.some((z) => z.state === 'bestaetigt')) {
		await verlangeKeineOffeneAbstimmungAnVerwaltungsgeschaeften(tx, meetingId);
	}
	for (const z of gleiche) {
		await tx`
			UPDATE proxy SET holder_is_management = ${istVerwaltung}
			WHERE id = ${z.id} AND meeting_id = ${meetingId}
		`;
	}
	await schreibeVerlauf(
		tx,
		handelnder,
		gleiche.map((z) =>
			ereignis(
				EREIGNISARTEN.vollmachtVerwaltungGesetzt,
				{ art: 'proxy', id: z.id },
				{
					vollmacht: `${z.holder_name} für ${z.vertretene_name}`,
					// Beide Richtungen im Verlauf (H-1): Das Entfernen ist eine
					// Entscheidung wie das Setzen, und ohne sie stünde da eine
					// Vollendung, die niemand vollzogen hat. Je Zeile einer
					// (M-4), weil jede für sich sichtbar gemacht wird.
					verwaltung: istVerwaltung
				}
			)
		)
	);
	return holeEine(tx, meetingId, id);
}

/**
 * Hängt eine bereits abgelegte Datei innerhalb einer Transaktion an.
 *
 * bindung: vollmachtId — Die Bindung steht in der Join-Bedingung: `JOIN proxy
 *   p ON p.meeting_id = m.id AND p.id = ${vollmachtId}`.
 */
export async function haengeAbgelegtenNachweisAn(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	vollmachtId: Id,
	abgelegt: { pruefsumme: string; name: string; art: string; groesse: number }
): Promise<void> {
	/*
	 * **Eine Abfrage, zwei Fragen.** Auch dieser Weg liest die Vollmacht nicht:
	 * Ohne die Bedingung landete eine Datei an einer Vollmacht einer fremden
	 * Versammlung, verbucht unter der Gemeinschaft dieser hier.
	 *
	 * Der Verbund beantwortet zugleich, unter welcher Gemeinschaft der Anhang
	 * steht. Getrennt gefragt wäre es eine Abfrage mehr, und diese Funktion
	 * läuft am Einlass in einer Doppelschleife: je Vollmacht, je Datei.
	 * Nebenbei fällt damit die Annahme weg, die Versammlung existiere — bisher
	 * las die Zeile `m.stweg_id` ohne jede Rückfrage.
	 */
	const [m] = await tx<{ stweg_id: string }[]>`
		SELECT m.stweg_id
		FROM meeting m
		JOIN proxy p ON p.meeting_id = m.id AND p.id = ${vollmachtId}
		WHERE m.id = ${meetingId}
	`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Diese Vollmacht gibt es nicht.', 'id');
	await tx`
		INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id,
		                        checksum, original_name, content_type, size_bytes, uploaded_by)
		VALUES (${handelnder.operatorId}, ${m.stweg_id}, 'proxy', ${vollmachtId},
		        ${abgelegt.pruefsumme}, ${abgelegt.name}, ${abgelegt.art}, ${abgelegt.groesse},
		        ${handelnder.userId})
	`;
	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.vollmachtNachweisNachgereicht, { art: 'proxy', id: vollmachtId }, {
			name: abgelegt.name,
			pruefsumme: abgelegt.pruefsumme,
			groesse: abgelegt.groesse
		})
	]);
}

export async function weiseVollmachtZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	grund: string
): Promise<Vollmacht> {
	const wortlaut = verlangeGrund(grund);
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurVorDemSchluss(tx, meetingId);
		const v = await holeEine(tx, meetingId, id);
		verlangeBeendbar(v);
		await beende(tx, handelnder, meetingId, id, 'zurueckgewiesen', wortlaut);
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.vollmachtZurueckgewiesen, { art: 'proxy', id }, {
				vollmacht: bezeichnung(v),
				grund: wortlaut
			})
		]);
		return holeEine(tx, meetingId, id);
	});
}

export async function widerrufeVollmacht(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	grund: string
): Promise<Vollmacht> {
	const wortlaut = verlangeGrund(grund);
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurVorDemSchluss(tx, meetingId);
		const v = await holeEine(tx, meetingId, id);
		verlangeBeendbar(v);
		await beende(tx, handelnder, meetingId, id, 'widerrufen', wortlaut);
		await schreibeVerlauf(tx, handelnder, [
			ereignis(EREIGNISARTEN.vollmachtWiderrufen, { art: 'proxy', id }, {
				vollmacht: bezeichnung(v),
				grund: wortlaut
			})
		]);
		return holeEine(tx, meetingId, id);
	});
}

async function beende(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	id: Id,
	zustand: 'zurueckgewiesen' | 'widerrufen',
	grund: string,
	/**
	 * Ob die Anwesenheit der vertretenen Partei mitgenommen wird.
	 *
	 * Aus bei «selbst erschienen»: Dort steht die Person im Saal und hat ein
	 * eigenes Eintreffen — ihre Anwesenheit endet nicht, sie beginnt gerade.
	 */
	anwesenheitMitnehmen = true
): Promise<void> {
	const [vorher] = await tx<{ represented_id: string; name: string }[]>`
		SELECT p.represented_id, v.display_name AS name
		FROM proxy p JOIN snapshot_party v ON v.id = p.represented_id
		WHERE p.id = ${id} AND p.meeting_id = ${meetingId}
	`;
	/*
	 * **Auch hier absagen statt nichts tun** (Sicherheitsdurchgang 06.09.2026).
	 *
	 * Ohne diese Zeile kehrte die Funktion bei einer Vollmacht aus einer
	 * fremden Versammlung still zurück: kein Treffer beim Lesen, kein Treffer
	 * beim Schreiben, und die beiden Aufrufer schrieben ihren Verlaufseintrag
	 * trotzdem. Heute erreicht das niemand, weil alle drei Aufrufer vorher
	 * prüfen — aber genau darauf sich zu verlassen ist das Muster, gegen das
	 * `verlangeVollmachtIn` zwanzig Zeilen weiter oben argumentiert.
	 */
	if (!vorher) throw new FachlicherFehler('unbekannt', 'Diese Vollmacht gibt es nicht.', 'id');

	await tx`
		UPDATE proxy SET state = ${zustand}, ended_at = now(), ended_reason = ${grund},
		                 ended_by = ${handelnder.userId}, ended_by_label = ${handelnder.label}
		WHERE id = ${id} AND meeting_id = ${meetingId}
	`;

	if (!anwesenheitMitnehmen) return;

	/*
	 * **Wer nur durch die Vertretung anwesend war, ist es danach nicht mehr.**
	 *
	 * Gefunden am 04.08.2026 beim Bau des Einlasses: Nach dem Beenden blieb die
	 * vertretene Partei als anwesend stehen, obwohl niemand mehr ihre Stimme
	 * ausübte. Die Beschlussfähigkeit rechnete sie weiter mit — und das ist
	 * genau der Fehler, den ein Werkzeug für Beschlüsse nicht machen darf.
	 *
	 * Nur wenn die Anwesenheit **aus** der Vertretung stammt: Ist die Person
	 * selbst eingetroffen und liess sich vorher vertreten, bleibt ihre eigene
	 * Anwesenheit unberührt.
	 */
	/*
	 * **Die Versammlung ist hier beweisbar die richtige.** Bis zum 06.09.2026
	 * schlug diese Zeile sie eigens nach, weil die Funktion sie nicht bekam.
	 * Jetzt bekommt sie sie, und die Abfrage oben hat gegen sie gefiltert: Läge
	 * die Vollmacht in einer anderen Versammlung, wäre `vorher` leer und die
	 * Absage weiter oben hätte schon gegriffen.
	 */
	const bisher = await leseEreignisseJeMomentpartei(tx, meetingId, vorher.represented_id);
	const stand = standVon(bisher);
	if (stand?.zustand !== 'anwesend' || stand.weg !== 'vertretung') return;
	await schreibeEreignis(
		tx,
		handelnder.operatorId,
		meetingId,
		vorher.represented_id,
		'verlassen',
		'vertretung',
		{ userId: handelnder.userId, label: handelnder.label },
		'Die Vertretung ist beendet; die Anwesenheit beruhte allein auf ihr.'
	);
	await schreibeVerlauf(tx, handelnder, [
		ereignis(
			EREIGNISARTEN.anwesenheitVerlassen,
			{ art: 'snapshot_party', id: vorher.represented_id },
			{ partei: vorher.name, weg: 'vertretung', grund: 'Vertretung beendet' }
		)
	]);
}

// ── Was die Anwesenheit davon wissen muss ───────────────────────────────────

export interface WirksameVollmacht {
	id: Id;
	/** Zeilenkennung der Momentaufnahme — damit wird das Ereignis geschrieben. */
	vertreteneId: Id;
	/** Kennung der Partei — damit werden die bisherigen Ereignisse gelesen. */
	vertreteneParteiId: Id;
	vertreteneName: string;
	bevollmaechtigtId: Id | null;
	bevollmaechtigtName: string;
}

/**
 * Die wirksamen Vollmachten einer Versammlung, für die Anwesenheitserfassung.
 *
 * Läuft innerhalb der bestehenden Transaktion: Wer eintrifft und wen er
 * mitbringt, gehört in **einen** Vorgang. Zwei getrennte hiessen, dass zwischen
 * dem Eintreffen der bevollmächtigten Person und der Anwesenheit der Parteien eine
 * Abstimmung geschlossen werden könnte — und dann fehlten deren Stimmen.
 */
export async function leseWirksame(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<WirksameVollmacht[]> {
	const zeilen = await tx<
		{
			id: string;
			represented_id: string;
			vertretene_partei_id: string;
			vertretene_name: string;
			holder_id: string | null;
			holder_name: string | null;
			vertreter_name_partei: string | null;
		}[]
	>`
		SELECT p.id, p.represented_id, v.party_id AS vertretene_partei_id,
		       p.holder_id, p.holder_name,
		       v.display_name AS vertretene_name,
		       h.display_name AS vertreter_name_partei
		FROM proxy p
		JOIN snapshot_party v ON v.id = p.represented_id
		LEFT JOIN snapshot_party h ON h.id = p.holder_id
		WHERE p.meeting_id = ${meetingId} AND p.state = 'bestaetigt'
	`;
	return zeilen.map((z) => ({
		id: z.id,
		vertreteneId: z.represented_id,
		vertreteneParteiId: z.vertretene_partei_id,
		vertreteneName: z.vertretene_name,
		bevollmaechtigtId: z.holder_id,
		bevollmaechtigtName: (z.holder_id ? z.vertreter_name_partei : z.holder_name) ?? ''
	}));
}

/**
 * Beendet die Vollmacht einer Partei, weil sie selbst erschienen ist (FR-25).
 *
 * Ohne Rückfrage: Wer selbst im Saal steht, übt selbst aus. Bereits abgegebene
 * Stimmen der bevollmächtigten Person in geschlossenen Abstimmungen bleiben gültig — sie
 * sind Ereignisse der Vergangenheit, und ein Ende wirkt nach vorn.
 */
export async function beendeWegenEigenerAnwesenheit(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	vertreteneId: Id,
	grund: string
): Promise<string | null> {
	const [z] = await tx<{ id: string; name: string }[]>`
		SELECT p.id, coalesce(h.display_name, p.holder_name) AS name
		FROM proxy p
		LEFT JOIN snapshot_party h ON h.id = p.holder_id
		WHERE p.meeting_id = ${meetingId} AND p.represented_id = ${vertreteneId}
		  AND p.state IN ('erfasst', 'bestaetigt')
	`;
	if (!z) return null;

	await beende(tx, handelnder, meetingId, z.id, 'widerrufen', grund, false);
	await schreibeVerlauf(tx, handelnder, [
		ereignis(EREIGNISARTEN.vollmachtWiderrufen, { art: 'proxy', id: z.id }, { grund, vertreter: z.name })
	]);
	return z.name;
}

/**
 * Die offene oder wirksame Vollmacht einer Partei, innerhalb einer Transaktion.
 *
 * Gebraucht am Eingang: Steht eine dritte Person mit einem Blatt da, ist die
 * Vollmacht entweder schon erfasst (dann ist sie zu bestätigen) oder noch nicht
 * (dann entsteht sie jetzt). Beides ohne diese Abfrage zu unterscheiden hiesse,
 * blind eine zweite anzulegen — und der eindeutige Schlüssel wiese sie mit
 * einer Meldung ab, die am Eingang niemandem hilft.
 */
export async function leseOffeneOderWirksame(
	tx: postgres.TransactionSql,
	meetingId: Id,
	vertreteneId: Id
): Promise<Vollmacht | null> {
	const [z] = await tx<{ id: string }[]>`
		SELECT id FROM proxy
		WHERE meeting_id = ${meetingId} AND represented_id = ${vertreteneId}
		  AND state IN ('erfasst', 'bestaetigt')
	`;
	return z ? holeEine(tx, meetingId, z.id) : null;
}

// ── Der Nachweis als Datei ──────────────────────────────────────────────────

export interface Nachweis {
	id: Id;
	pruefsumme: string;
	name: string;
	art: string;
	groesse: number;
	hochgeladenAm: string;
}

/**
 * Hängt einen Nachweis an eine Vollmacht.
 *
 * **Eigener Weg statt `haengeAn`.** Die allgemeine Funktion weist Anhänge nach
 * der Freigabe ab, und das zu Recht: Unterlagen zu einem Traktandum sind mit
 * der Einladung verschickt, und was danach dazukommt, hätte niemand vor der
 * Abstimmung gesehen. Ein Vollmachtsnachweis ist das Gegenteil — er entsteht
 * naturgemäss **nach** der Freigabe, meist am Eingang, oft erst danach als
 * Foto (FR-24). Die beiden Regeln lassen sich nicht zu einer verschmelzen,
 * ohne eine davon aufzugeben.
 */
export async function haengeNachweisAn(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	vollmachtId: Id,
	datei: File
): Promise<Nachweis> {
	if (!datei || datei.size === 0) {
		throw new FachlicherFehler('keine_datei', 'Es wurde keine Datei gewählt.', 'datei');
	}
	const inhalt = await liesHochgeladene(datei);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		await nurVorDemSchluss(tx, meetingId);
		const v = await holeEine(tx, meetingId, vollmachtId);

		/*
		 * **Erst prüfen, dann ablegen** (Code-Review 06.09.2026).
		 *
		 * Bis dahin lief `legeAb` vor der Transaktion: Die Datei lag auf der
		 * Platte, bevor irgendjemand gefragt hatte, ob die Vollmacht zu dieser
		 * Versammlung gehört und ob die Versammlung noch offen ist. Bei einer
		 * Absage blieb sie als Waise liegen, auf die keine Zeile zeigt, und
		 * nach AD-17 räumt die Ablage bewusst nichts weg.
		 *
		 * Die Ablage bleibt aussen vor der Datenbanktransaktion, was sie ist:
		 * Bricht das `INSERT` danach ab, bleibt die Datei liegen. Das ist
		 * dieselbe Ausnahme wie bisher, aber nur noch für den Fall, dass die
		 * Prüfungen durch sind.
		 */
		const abgelegt = await legeAb(inhalt, datei.name, datei.type);

		const [m] = await tx<{ stweg_id: string }[]>`
			SELECT stweg_id FROM meeting WHERE id = ${meetingId}
		`;

		const [zeile] = await tx<
			{
				id: string;
				checksum: string;
				original_name: string;
				content_type: string;
				size_bytes: number;
				uploaded_at: Date;
			}[]
		>`
			INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id,
			                        checksum, original_name, content_type, size_bytes, uploaded_by)
			VALUES (${handelnder.operatorId}, ${m.stweg_id}, 'proxy', ${vollmachtId},
			        ${abgelegt.pruefsumme}, ${abgelegt.name}, ${abgelegt.art}, ${abgelegt.groesse},
			        ${handelnder.userId})
			RETURNING id, checksum, original_name, content_type, size_bytes, uploaded_at
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.vollmachtNachweisNachgereicht,
				{ art: 'proxy', id: vollmachtId },
				{
					vollmacht: bezeichnung(v),
					name: abgelegt.name,
					// Die Prüfsumme in den Verlauf: Damit lässt sich später belegen,
					// welcher Inhalt vorlag — auch dann, wenn die Zeile in `attachment`
					// einmal nicht mehr da wäre.
					pruefsumme: abgelegt.pruefsumme,
					groesse: abgelegt.groesse
				}
			)
		]);

		return {
			id: zeile.id,
			pruefsumme: zeile.checksum,
			name: zeile.original_name,
			art: zeile.content_type,
			groesse: zeile.size_bytes,
			hochgeladenAm: zeile.uploaded_at.toISOString()
		};
	});
}

/** Die Nachweise aller Vollmachten einer Versammlung, nach Vollmacht geordnet. */
export async function holeNachweise(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, Nachweis[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				subject_id: string;
				id: string;
				checksum: string;
				original_name: string;
				content_type: string;
				size_bytes: number;
				uploaded_at: Date;
			}[]
		>`
			SELECT a.subject_id, a.id, a.checksum, a.original_name, a.content_type,
			       a.size_bytes, a.uploaded_at
			FROM attachment a
			JOIN proxy p ON p.id = a.subject_id
			WHERE a.subject_type = 'proxy' AND p.meeting_id = ${meetingId}
			ORDER BY a.uploaded_at
		`;
		const aus = new Map<Id, Nachweis[]>();
		for (const z of zeilen) {
			const bisher = aus.get(z.subject_id) ?? [];
			bisher.push({
				id: z.id,
				pruefsumme: z.checksum,
				name: z.original_name,
				art: z.content_type,
				groesse: z.size_bytes,
				hochgeladenAm: z.uploaded_at.toISOString()
			});
			aus.set(z.subject_id, bisher);
		}
		return aus;
	});
}

// ── Die Parteien zur Auswahl ────────────────────────────────────────────────

export interface Wahlpartei {
	/** Zeilenkennung der Momentaufnahme — daran hängt die Vollmacht. */
	id: Id;
	parteiId: Id;
	name: string;
	einheiten: string[];
}

/**
 * Die Parteien dieser Versammlung, für die beiden Auswahllisten.
 *
 * Unmittelbar aus der Momentaufnahme und nicht über `Snapshot`: Dort steht die
 * Zeilenkennung nicht, weil die Auszählung sie nicht braucht (AD-1 — der Kern
 * kennt die Speicherung nicht). Die Vollmacht braucht sie, denn sie hängt an
 * genau dieser Versammlung.
 */
export async function holeParteien(operatorId: Id, meetingId: Id): Promise<Wahlpartei[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ id: string; party_id: string; display_name: string; einheiten: string[] | null }[]
		>`
			SELECT p.id, p.party_id, p.display_name,
			       array_remove(array_agg(u.label ORDER BY u.label), NULL) AS einheiten
			FROM snapshot_party p
			LEFT JOIN snapshot_unit u ON u.snapshot_party_id = p.id
			WHERE p.meeting_id = ${meetingId}
			GROUP BY p.id, p.party_id, p.display_name
			ORDER BY p.display_name
		`;
		return zeilen.map((z) => ({
			id: z.id,
			parteiId: z.party_id,
			name: z.display_name,
			einheiten: z.einheiten ?? []
		}));
	});
}

// ── Was ein Gerät ausüben darf ──────────────────────────────────────────────

export interface Ausuebbar {
	/** Zeilenkennung der Momentaufnahme. */
	id: Id;
	/** Kennung der Partei — damit stimmt `gibStimmenAb`. */
	parteiId: Id;
	name: string;
	einheiten: string[];
	/** Wahr für die Partei des Geräts selbst, falsch für die vertretenen. */
	eigene: boolean;
	/** Die Vollmacht, über die es geht — leer bei der eigenen Stimme. */
	vollmachtId: Id | null;
}

/**
 * Welche Stimmen dieses Gerät abgeben darf (FR-38 mit FR-23).
 *
 * **Fall des Auftraggebers vom 04.08.2026:** «Wenn ein Bevollmächtigter auch Eigentümer
 * ist, kann dieser bei dem aufgeschalteten Traktandum beide oder alle
 * abstimmen.» Bisher konnte ein Telefon genau eine Stimme abgeben — die eigene.
 * Wer drei Vollmachten hielt, musste die Sitzungsleitung bitten, und die tippte
 * dreimal.
 *
 * Zurück kommt die eigene Partei und jede, für die eine **bestätigte** Vollmacht
 * auf sie lautet. Nicht die bloss erfassten: Die übertragen nichts (FR-24), und
 * ein Knopf, der eine Stimme abgäbe, die nachher nicht zählt, wäre schlimmer als
 * keiner.
 *
 * bindung: eigeneParteiId — Die Bindung steht im Hilfsblock `WITH eigen AS (…
 *   WHERE meeting_id = ${meetingId} AND party_id = ${eigeneParteiId})`.
 */
export async function holeAusuebbare(
	operatorId: Id,
	meetingId: Id,
	eigeneParteiId: Id
): Promise<Ausuebbar[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				party_id: string;
				display_name: string;
				einheiten: string[] | null;
				eigene: boolean;
				vollmacht_id: string | null;
			}[]
		>`
			WITH eigen AS (
				SELECT id FROM snapshot_party
				WHERE meeting_id = ${meetingId} AND party_id = ${eigeneParteiId}
			)
			SELECT p.id, p.party_id, p.display_name,
			       array_remove(array_agg(u.label ORDER BY u.label), NULL) AS einheiten,
			       (p.id = (SELECT id FROM eigen)) AS eigene,
			       (SELECT x.id FROM proxy x
			         WHERE x.meeting_id = ${meetingId}
			           AND x.represented_id = p.id
			           AND x.holder_id = (SELECT id FROM eigen)
			           AND x.state = 'bestaetigt'
			         LIMIT 1) AS vollmacht_id
			FROM snapshot_party p
			LEFT JOIN snapshot_unit u ON u.snapshot_party_id = p.id
			WHERE p.meeting_id = ${meetingId}
			  AND (
			        p.id = (SELECT id FROM eigen)
			     OR EXISTS (
			          SELECT 1 FROM proxy x
			           WHERE x.meeting_id = ${meetingId}
			             AND x.represented_id = p.id
			             AND x.holder_id = (SELECT id FROM eigen)
			             AND x.state = 'bestaetigt'
			        )
			      )
			GROUP BY p.id, p.party_id, p.display_name
			-- Die eigene zuerst: Sie ist die, die man sucht, wenn es schnell gehen
			-- muss. Die übrigen alphabetisch.
			ORDER BY (p.id = (SELECT id FROM eigen)) DESC, p.display_name
		`;
		return zeilen.map((z) => ({
			id: z.id,
			parteiId: z.party_id,
			name: z.display_name,
			einheiten: z.einheiten ?? [],
			eigene: z.eigene,
			vollmachtId: z.vollmacht_id
		}));
	});
}
