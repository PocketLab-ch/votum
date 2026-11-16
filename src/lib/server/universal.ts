/**
 * Die Universalversammlung im Saal (Migration 128). Der Kern steht in
 * `domain/ausnahmen.ts`; hier wird gelesen, wer im Moment wie da ist, und
 * geschrieben, was die Leitung dazu festhält.
 *
 * **Eine Lesestelle für Aufnehmen, Eröffnen, Schliessen und die Leitungsseite.**
 * Rechneten die vier je für sich, liefe «vollzählig» auseinander, und die
 * Leitungsseite zeigte eine Versammlung als vollzählig, deren Eröffnung der
 * Server abweist.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { leseEreignisse } from './anwesenheit';
import { standVon } from '$lib/domain/anwesenheit';
import {
	pruefeUniversalversammlung,
	universalparteien,
	zaehltAlsDa,
	type AusnahmenNichtangekuendigtes,
	type Universalbefund,
	type Universalpartei,
	type Universalvariante
} from '$lib/domain/ausnahmen';
import { vollmachtsschluessel, type Vertretungsgrund } from '$lib/domain/vollmacht';
import { FachlicherFehler } from '$lib/domain/fehler';
/*
 * Gegenseitig mit `abstimmung.ts`, das von hier liest. Beide Seiten brauchen
 * die andere nur in Funktionen, nicht beim Laden des Moduls.
 */
import { beschlussGiltIn, rueckkommenZuEroeffnen, sperreOffenenDurchgang } from './abstimmung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id, Zeitpunkt } from '$lib/domain/types';

type Tx = postgres.TransactionSql;

export interface Universallage {
	/** Wie es bei der Freigabe stand (Migration 127). */
	einstellung: AusnahmenNichtangekuendigtes;
	parteien: Universalpartei[];
	befund: Universalbefund;
}

/** Die Einstellung aus der Momentaufnahme, null ohne Freigabe. */
export async function leseEinstellungIn(
	tx: Tx,
	meetingId: Id
): Promise<AusnahmenNichtangekuendigtes | null> {
	const [s] = await tx<
		{
			unannounced_bylaw_allowed: boolean;
			unannounced_bylaw_source: string | null;
			universal_meeting_mode: Universalvariante;
			universal_meeting_source: string | null;
			universal_chair_proxies_count: boolean;
		}[]
	>`
		SELECT unannounced_bylaw_allowed, unannounced_bylaw_source, universal_meeting_mode,
		       universal_meeting_source, universal_chair_proxies_count
		FROM snapshot WHERE meeting_id = ${meetingId}
	`;
	if (!s) return null;
	return {
		reglementGestattet: s.unannounced_bylaw_allowed,
		reglementFundstelle: s.unannounced_bylaw_source,
		universalvariante: s.universal_meeting_mode,
		universalFundstelle: s.universal_meeting_source,
		leitungsvollmachtenZaehlen: s.universal_chair_proxies_count
	};
}

/**
 * Wer im Moment wie da ist, je Partei der Momentaufnahme.
 *
 * **Jede Partei, nicht nur die mit Ereignis.** Wer nie erschienen ist, hat
 * kein Anwesenheitsereignis; eine Liste aus den Ereignissen allein fände ihn
 * nicht und hielte die Versammlung für vollzählig.
 *
 * **Der Grund der Vertretung aus der Vollmacht** (`representation_basis`,
 * Migration 120). `leseVertretungen` in `server/abstimmung.ts` kennt ihn nicht
 * und lässt Vertreter ohne Partei weg; beides braucht es hier.
 */
export async function leseUniversallage(tx: Tx, meetingId: Id): Promise<Universallage | null> {
	const quelle = await ladeUniversalquelle(tx, meetingId);
	if (!quelle) return null;
	const parteien = quelle.parteienBis();
	return {
		einstellung: quelle.einstellung,
		parteien,
		befund: pruefeUniversalversammlung(quelle.einstellung, parteien)
	};
}

/**
 * Einmal gelesen, zu jedem Zeitpunkt ausgewertet: Präsenz, Vollmachten mit
 * Grund, Vertreter der Leitung. `parteienBis(t)` sagt, wie die Parteien zum
 * Zeitpunkt `t` dastanden, ausser bei den Vertretern der Leitung: Dort gilt
 * das Kreuz bei `t` oder jetzt (siehe unten). Ohne `t` jetzt.
 */
async function ladeUniversalquelle(
	tx: Tx,
	meetingId: Id
): Promise<{
	einstellung: AusnahmenNichtangekuendigtes;
	parteienBis: (bis?: Zeitpunkt) => Universalpartei[];
} | null> {
	const einstellung = await leseEinstellungIn(tx, meetingId);
	if (!einstellung) return null;

	/*
	 * **Gemeinsames Eigentum und Nutzniessung aus der Momentaufnahme**
	 * (Produktentscheid 30.09.2026): Bei beiden sieht Votum nicht, welche
	 * Personen im Saal sind, und nennt der Leitung die Wohnungen, bei denen sie
	 * es selbst prüft (`Universalbefund.pruefenGemeinsam`, `pruefenNutzniessung`).
	 */
	const parteien = await tx<
		{ party_id: string; display_name: string; is_community: boolean; nutzniesser: string[] }[]
	>`
		SELECT sp.party_id, sp.display_name, sp.is_community,
		       coalesce(array_agg(su.label || ': ' || su.usufruct_holder_name ORDER BY su.label)
		                FILTER (WHERE su.usufruct_holder_name IS NOT NULL), '{}') AS nutzniesser
		FROM snapshot_party sp
		LEFT JOIN snapshot_unit su ON su.snapshot_party_id = sp.id
		WHERE sp.meeting_id = ${meetingId}
		GROUP BY sp.id, sp.party_id, sp.display_name, sp.is_community
		ORDER BY sp.display_name, sp.party_id
	`;
	const ereignisse = await leseEreignisse(tx, meetingId);
	/*
	 * **Jede Vollmacht, die je bestätigt war, mit ihrer Zeit** (Codeprüfung
	 * Block 3, zweiter Durchgang, F1). Die Stimme eines Organs, dessen
	 * Vollmacht danach beendet wurde, zählt nach dem Stand bei der Stimmabgabe,
	 * nicht nach dem von heute.
	 */
	const vertretungen = await tx<
		{
			partei: string;
			grund: Vertretungsgrund | null;
			vertreter: string | null;
			state: string;
			confirmed_at: Date | null;
			ended_at: Date | null;
		}[]
	>`
		SELECT v.party_id AS partei, x.representation_basis AS grund,
		       coalesce(h.display_name, x.holder_name) AS vertreter,
		       x.state, x.confirmed_at, x.ended_at
		FROM proxy x
		JOIN snapshot_party v ON v.id = x.represented_id
		LEFT JOIN snapshot_party h ON h.id = x.holder_id
		WHERE x.meeting_id = ${meetingId} AND x.confirmed_at IS NOT NULL
	`;
	const wirksamBis = (bis?: Zeitpunkt) =>
		vertretungen.filter((v) =>
			bis
				? v.confirmed_at!.toISOString() <= bis &&
					(v.ended_at === null || v.ended_at.toISOString() > bis)
				: v.state === 'bestaetigt'
		);
	const leitung = await leseLeitungsschluessel(tx, meetingId);

	return {
		einstellung,
		parteienBis: (bis) =>
			universalparteien(
				parteien.map((p) => {
					const stand = standVon(
						ereignisse.filter((e) => e.parteiId === p.party_id),
						bis
					);
					return {
						parteiId: p.party_id,
						name: p.display_name,
						anwesend: stand?.zustand === 'anwesend',
						ueberVertretung: stand?.weg === 'vertretung',
						gemeinsam: p.is_community,
						nutzniesser: p.nutzniesser
					};
				}),
				wirksamBis(bis).map((v) => ({
					vertreteneParteiId: v.partei,
					grund: v.grund,
					vertreter: v.vertreter ?? ''
				})),
				/*
				 * **Zum Zeitpunkt der Stimme oder jetzt** (Fachprüfung Block 4a,
				 * Frage 3). Die Liste hält eine Tatsache fest, sie begründet keine
				 * Vertretung wie eine Vollmacht. Wird jemand nach der Stimme
				 * angekreuzt, ist das meist eine berichtigte Erfassungslücke, und
				 * nach dem Zeitpunkt allein hielte die Universalversammlung über
				 * eine Vertretung, die die Einstellung ausschliesst; bewusst
				 * genutzt, ein Umgehungsweg. Votum kann Berichtigung und
				 * Rollenwechsel nicht unterscheiden, also gilt die strengere
				 * Lesung. Die Zeit bleibt für die Stimme: Wer bei ihr angekreuzt
				 * war, dessen Stimme zählt dafür nicht, auch wenn er danach
				 * abgekreuzt wird. Ins Gewicht fällt das nur, wenn die Partei beim
				 * Schliessen nicht mehr da ist; sonst zählt sie ohnehin.
				 */
				bis ? new Set([...leitung(bis), ...leitung()]) : leitung()
			)
	};
}

/**
 * Wer in diesem Durchgang **so abgestimmt hat, wie es nach der Einstellung
 * zählt** (Codeprüfung Block 3, H-1).
 *
 * Eine Stimme allein genügt nicht. Wer unter «persönlich» geht und eine
 * Vollmacht dalässt, hat danach eine Stimme im Durchgang, abgegeben von
 * jemand anderem; als «abgestimmt» gezählt, hielte die Universalversammlung
 * genau über den Weg, den die Einstellung ausschliesst. Gezählt wird deshalb
 * nur eine Stimme, die abgegeben wurde, während die Partei nach der
 * Einstellung als da galt.
 *
 * Die Vollmachten werden so gelesen, wie sie bei der Stimmabgabe wirksam
 * waren. Die Vertreter der Leitung, wie sie bei der Stimmabgabe **oder** jetzt
 * angekreuzt sind (`ladeUniversalquelle`; Liste mit Zeit seit Migration 129).
 */
export async function leseGueltigAbgestimmt(
	tx: Tx,
	meetingId: Id,
	durchgangId: Id,
	einstellung: Pick<AusnahmenNichtangekuendigtes, 'universalvariante' | 'leitungsvollmachtenZaehlen'>
): Promise<{ gueltig: Set<Id>; mitStimme: Set<Id> }> {
	const quelle = await ladeUniversalquelle(tx, meetingId);
	if (!quelle) return { gueltig: new Set(), mitStimme: new Set() };
	const stimmen = await tx<{ party_id: string; cast_at: Date }[]>`
		SELECT p.party_id, v.cast_at FROM vote v
		JOIN snapshot_party p ON p.id = v.snapshot_party_id
		JOIN voting_round r ON r.id = v.round_id
		WHERE v.round_id = ${durchgangId} AND r.meeting_id = ${meetingId}
	`;
	const gueltig = new Set<Id>();
	const mitStimme = new Set(stimmen.map((s) => s.party_id));
	for (const s of stimmen) {
		if (gueltig.has(s.party_id)) continue;
		const p = quelle.parteienBis(s.cast_at.toISOString()).find((x) => x.parteiId === s.party_id);
		if (p && zaehltAlsDa(einstellung, p)) gueltig.add(s.party_id);
	}
	return { gueltig, mitStimme };
}

/**
 * Die Vertreter der Leitung, zu jedem Zeitpunkt auszuwerten wie `wirksamBis`
 * (Migration 129). Ohne Zeitpunkt die jetzt angekreuzten.
 */
async function leseLeitungsschluessel(
	tx: Tx,
	meetingId: Id
): Promise<(bis?: Zeitpunkt) => Set<string>> {
	const zeilen = await tx<{ holder_key: string; created_at: Date; ended_at: Date | null }[]>`
		SELECT holder_key, created_at, ended_at FROM meeting_chair_holder
		WHERE meeting_id = ${meetingId}
	`;
	return (bis) =>
		new Set(
			zeilen
				.filter((z) =>
					bis
						? z.created_at.toISOString() <= bis &&
							(z.ended_at === null || z.ended_at.toISOString() > bis)
						: z.ended_at === null
				)
				.map((z) => z.holder_key)
		);
}

/**
 * Wer zum Zeitpunkt `t` über welchen Vertreter da war, je Partei; nur
 * Parteien, die mit Vollmacht da waren. Für das Merkmal «nur durch die Leitung
 * vertreten» beim Schliessen (Fachprüfung 30.09.2026, Runde 3, Befund 2).
 */
export async function leseVertreterBis(tx: Tx, meetingId: Id, t: Zeitpunkt): Promise<Map<Id, string>> {
	const quelle = await ladeUniversalquelle(tx, meetingId);
	if (!quelle) return new Map();
	return new Map(
		quelle
			.parteienBis(t)
			.filter((p) => p.anwesend && p.mitVollmacht && p.vertreter)
			.map((p) => [p.parteiId, p.vertreter!])
	);
}

/**
 * Seit wann jede Partei über ihre jetzige Vertretung da ist: das letzte
 * «eingetroffen» über eine Vertretung (Fachprüfung 30.09.2026, Runde 4, F4-1).
 */
export async function leseVertretenSeit(tx: Tx, meetingId: Id): Promise<Map<Id, Zeitpunkt>> {
	const zeilen = await tx<{ party_id: string; seit: Date }[]>`
		SELECT p.party_id, max(e.occurred_at) AS seit
		FROM attendance_event e
		JOIN snapshot_party p ON p.id = e.snapshot_party_id
		WHERE e.meeting_id = ${meetingId} AND e.kind = 'eingetroffen' AND e.channel = 'vertretung'
		GROUP BY p.party_id
	`;
	return new Map(zeilen.map((z) => [z.party_id, z.seit.toISOString()]));
}

/**
 * Seit wann jeder jetzt angekreuzte Vertreter der Leitung angekreuzt ist, je
 * Schlüssel (Migration 129). Für den Protokollvermerk, wenn eine Partei nur
 * über einen solchen Vertreter da war (Fachprüfung 30.09.2026, Befund 2).
 */
export async function leseLeitungskreuzSeit(tx: Tx, meetingId: Id): Promise<Map<string, Zeitpunkt>> {
	const zeilen = await tx<{ holder_key: string; created_at: Date }[]>`
		SELECT holder_key, created_at FROM meeting_chair_holder
		WHERE meeting_id = ${meetingId} AND ended_at IS NULL
	`;
	return new Map(zeilen.map((z) => [z.holder_key, z.created_at.toISOString()]));
}

/**
 * Wer während der Abstimmung als gegangen erfasst wurde. Bei der Handzählung
 * führt jeder Weggang zu «kein Beschluss»; sonst trennt die Liste Gegangene von
 * Parteien, die nur über die Leitung vertreten waren (`universalAmSchluss`).
 */
export async function leseGegangenSeit(
	tx: Tx,
	meetingId: Id,
	seit: Zeitpunkt,
	/** Nur wer selbst ging, nicht mit seinem Vertreter (Codeprüfung 30.09.2026, M-1). */
	selbst = false
): Promise<Id[]> {
	const zeilen = await tx<{ party_id: string }[]>`
		SELECT DISTINCT p.party_id
		FROM attendance_event e
		JOIN snapshot_party p ON p.id = e.snapshot_party_id
		WHERE e.meeting_id = ${meetingId} AND e.kind = 'verlassen' AND e.occurred_at >= ${seit}
		  AND (${!selbst} OR e.channel <> 'vertretung')
	`;
	return zeilen.map((z) => z.party_id);
}

// ── Die Leitungsseite ───────────────────────────────────────────────────────

export interface Leitungsvertreter {
	schluessel: string;
	name: string;
	/** Wen er vertritt, nach Namen. */
	vertritt: string[];
	angekreuzt: boolean;
}

export interface Universalansicht extends Universallage {
	/**
	 * Die Vertreter mit gewöhnlicher Vollmacht, zum Ankreuzen. Leer, wo die
	 * Liste nichts bewirkt: unter «persönlich», bei «keine» und wenn Vollmachten
	 * der Leitung ohnehin zählen (Fachprüfung Runde 2 zu Stelle 9).
	 */
	vertreter: Leitungsvertreter[];
}

export async function holeUniversalansicht(
	operatorId: Id,
	meetingId: Id
): Promise<Universalansicht | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const lage = await leseUniversallage(tx, meetingId);
		if (!lage) return null;
		const e = lage.einstellung;
		if (e.universalvariante !== 'vertreten' || e.leitungsvollmachtenZaehlen) {
			return { ...lage, vertreter: [] };
		}
		return { ...lage, vertreter: await leseVertreter(tx, meetingId) };
	});
}

/**
 * Die Vertreter mit gewöhnlicher Vollmacht, erfasst oder bestätigt, dazu die
 * schon angekreuzten, auch wenn ihre Vollmacht inzwischen beendet ist: Ein
 * Häkchen, das still verschwindet, wäre beim nächsten Mal nicht mehr gesetzt.
 */
async function leseVertreter(tx: Tx, meetingId: Id): Promise<Leitungsvertreter[]> {
	const vollmachten = await tx<{ vertreter: string | null; vertretene: string }[]>`
		SELECT coalesce(h.display_name, x.holder_name) AS vertreter, v.display_name AS vertretene
		FROM proxy x
		JOIN snapshot_party v ON v.id = x.represented_id
		LEFT JOIN snapshot_party h ON h.id = x.holder_id
		WHERE x.meeting_id = ${meetingId} AND x.state IN ('erfasst', 'bestaetigt')
		  AND x.representation_basis IS DISTINCT FROM 'organ'
		ORDER BY v.display_name
	`;
	const angekreuzt = await tx<{ holder_key: string; holder_label: string }[]>`
		SELECT holder_key, holder_label FROM meeting_chair_holder
		WHERE meeting_id = ${meetingId} AND ended_at IS NULL
	`;
	const je = new Map<string, Leitungsvertreter>();
	for (const v of vollmachten) {
		const name = v.vertreter?.trim() ?? '';
		const schluessel = vollmachtsschluessel(name);
		if (!schluessel) continue;
		const bisher = je.get(schluessel);
		if (bisher) bisher.vertritt.push(v.vertretene);
		else je.set(schluessel, { schluessel, name, vertritt: [v.vertretene], angekreuzt: false });
	}
	for (const a of angekreuzt) {
		const bisher = je.get(a.holder_key);
		if (bisher) bisher.angekreuzt = true;
		else je.set(a.holder_key, { schluessel: a.holder_key, name: a.holder_label, vertritt: [], angekreuzt: true });
	}
	return [...je.values()].sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
}

/**
 * Hält fest, welche Vertreter als Sitzungsleitung oder Verwaltung handeln.
 *
 * **Die ganze Liste, nicht eine Änderung.** Das Formular zeigt alle
 * Kandidaten; was nicht angekreuzt ist, gilt nicht. Angenommen werden nur
 * Schlüssel, die die Liste auch anbietet, damit kein Formular einen Namen
 * einschleust, zu dem es keine Vollmacht gibt.
 */
export async function setzeLeitungsvertreter(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	schluessel: string[]
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		if (m.state !== 'freigegeben' && m.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				'Die Vertreter der Sitzungsleitung kreuzen Sie an, solange die Versammlung freigegeben ist oder läuft.',
				'vertreter'
			);
		}
		const vertreter = await leseVertreter(tx, meetingId);
		const moeglich = new Map(vertreter.map((v) => [v.schluessel, v]));
		const gewaehlt = [...new Set(schluessel)].filter((s) => moeglich.has(s));
		const bisher = new Set(vertreter.filter((v) => v.angekreuzt).map((v) => v.schluessel));

		/*
		 * **Beenden statt löschen** (Migration 129): Eine Stimme wird mit der
		 * Liste gelesen, wie sie bei der Stimmabgabe und beim Schliessen stand.
		 * Unverändert Angekreuzte behalten ihre Zeile und damit ihre Zeit.
		 */
		const weg = [...bisher].filter((s) => !gewaehlt.includes(s));
		if (weg.length > 0) {
			await tx`
				UPDATE meeting_chair_holder SET ended_at = now(), ended_by = ${handelnder.label}
				WHERE meeting_id = ${meetingId} AND ended_at IS NULL AND holder_key IN ${tx(weg)}
			`;
		}
		for (const s of gewaehlt.filter((s) => !bisher.has(s))) {
			await tx`
				INSERT INTO meeting_chair_holder (meeting_id, operator_id, holder_key, holder_label, created_by)
				VALUES (${meetingId}, ${handelnder.operatorId}, ${s}, ${moeglich.get(s)!.name}, ${handelnder.label})
			`;
		}
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.leitungsvertreterGesetzt,
				{ art: 'meeting', id: meetingId },
				{ vertreter: gewaehlt.map((s) => moeglich.get(s)!.name) }
			)
		);
	});
}

/** Ein festgehaltener Widerspruch am Geschäft (Migration 129). */
export interface Widerspruch {
	traktandumId: Id;
	name: string;
	am: Zeitpunkt;
	durch: string;
	/** Während welcher Abstimmung; null heisst: vor dem Eröffnen. */
	durchgangId: Id | null;
}

/**
 * Die Widersprüche einer Versammlung, je Geschäft. **Die eine Lesestelle** für
 * Eröffnen, Schliessen, Neuabstimmung, Leitungsseite und Protokoll: Lasen sie
 * je für sich, prüfte die eine den frühen und die andere den späten
 * Widerspruch (Codeprüfung Block 3, zweimal).
 */
export async function leseWidersprueche(tx: Tx, meetingId: Id): Promise<Map<Id, Widerspruch>> {
	const zeilen = await tx<
		{ agenda_item_id: string; party_name: string; objected_at: Date; recorded_by: string; round_id: string | null }[]
	>`
		SELECT agenda_item_id, party_name, objected_at, recorded_by, round_id
		FROM universal_objection WHERE meeting_id = ${meetingId}
	`;
	return new Map(
		zeilen.map((z) => [
			z.agenda_item_id,
			{
				traktandumId: z.agenda_item_id,
				name: z.party_name,
				am: z.objected_at.toISOString(),
				durch: z.recorded_by,
				durchgangId: z.round_id
			}
		])
	);
}

export async function holeWidersprueche(operatorId: Id, meetingId: Id): Promise<Map<Id, Widerspruch>> {
	return alsBetreiber(operatorId, (tx) => leseWidersprueche(tx, meetingId));
}

/**
 * Hält den Widerspruch einer Partei fest: während der offenen Abstimmung an
 * ihr, sonst vor dem Eröffnen am genannten Geschäft (Migration 129,
 * Produktentscheid 29.09.2026). Beide sperren gleich: Als Universalversammlung
 * wird heute nicht mehr darüber beschlossen.
 *
 * **Nur eine Partei, die im Moment da ist** (Fachprüfung Runde 2, Stelle 8):
 * Widersprechen kann, wer Mitglied der Versammlung ist oder für eines handelt.
 * Ein Gast oder Mieter steht nicht in der Auswahl, und der Server nimmt keine
 * Kennung an, die dort nicht stünde.
 */
export async function haltWiderspruchFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	parteiId: Id,
	traktandumId: Id | null = null
): Promise<{ fruehererBeschluss: boolean }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Traktandum vor Durchgang: Das `INSERT INTO universal_objection` unten
		// fährt die Fremdschlüsselprüfung aufs Traktandum (Auftrag Abschluss,
		// C2, Begründung bei `sperreOffenenDurchgang`).
		const r = await sperreOffenenDurchgang(tx, meetingId);
		let geschaeft: Id;
		let durchgang: Id | null;
		let fruehererBeschluss = false;
		if (r) {
			/*
			 * **Mit Geschäft heisst: vor dem Eröffnen gemeint** (Codeprüfung
			 * Block 4a, N-2). Ist inzwischen eröffnet, still an den Durchgang zu
			 * schreiben, hielte etwas anderes fest, als die Rückfrage angekündigt
			 * hat. Dieselbe Absage wie nach der Sperre in
			 * `geschaeftVorDemEroeffnen`.
			 */
			if (traktandumId && traktandumId === r.agenda_item_id) throw schonEroeffnet();
			if (!r.universal_mode || traktandumId) {
				throw new FachlicherFehler(
					'kein_universaldurchgang',
					'Während eine andere Abstimmung offen ist, wird kein Widerspruch festgehalten. ' +
						'Halten Sie ihn fest, sobald sie geschlossen ist.',
					'widerspruch'
				);
			}
			geschaeft = r.agenda_item_id;
			durchgang = r.id;
		} else {
			({ geschaeft, fruehererBeschluss } = await geschaeftVorDemEroeffnen(tx, meetingId, traktandumId));
			durchgang = null;
		}

		const [frueher] = await tx<{ ja: number }[]>`
			SELECT 1 AS ja FROM universal_objection
			WHERE agenda_item_id = ${geschaeft} AND meeting_id = ${meetingId}
		`;
		if (frueher) {
			throw new FachlicherFehler(
				'schon_widersprochen',
				'Zu diesem Geschäft ist schon ein Widerspruch festgehalten. Als Universalversammlung wird ' +
					'heute nicht mehr darüber beschlossen.',
				'widerspruch'
			);
		}
		const lage = await leseUniversallage(tx, meetingId);
		const partei = lage?.parteien.find((p) => p.parteiId === parteiId && p.anwesend);
		if (!partei) {
			throw new FachlicherFehler(
				'nicht_anwesend',
				'Widersprechen kann nur eine Partei, die im Moment anwesend oder vertreten ist.',
				'partei'
			);
		}
		const [sp] = await tx<{ id: string }[]>`
			SELECT id FROM snapshot_party WHERE meeting_id = ${meetingId} AND party_id = ${parteiId}
		`;
		await tx`
			INSERT INTO universal_objection
				(agenda_item_id, meeting_id, operator_id, round_id, snapshot_party_id, party_name, recorded_by)
			VALUES (${geschaeft}, ${meetingId}, ${handelnder.operatorId}, ${durchgang}, ${sp.id},
			        ${partei.name}, ${handelnder.label})
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.universalWiderspruch,
				durchgang ? { art: 'voting_round', id: durchgang } : { art: 'agenda_item', id: geschaeft },
				{
					versammlung: meetingId,
					traktandum: geschaeft,
					partei: partei.name,
					...(durchgang ? {} : { vorDemEroeffnen: true })
				}
			)
		);
		return { fruehererBeschluss };
	});
}

/**
 * Prüft, ob sich am Geschäft vor dem Eröffnen ein Widerspruch festhalten
 * lässt, und sperrt seine Zeile.
 *
 * **Die Sperre am Geschäft** teilt sich dieser Weg mit `oeffneAbstimmung`.
 * Ohne sie könnten Widerspruch und Eröffnen gleichzeitig durchgehen: Der
 * Widerspruch stünde vor dem Eröffnen, der Durchgang wüsste nichts davon, und
 * beim Schliessen entstünde ein Beschluss.
 */
async function geschaeftVorDemEroeffnen(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id | null
): Promise<{ geschaeft: Id; fruehererBeschluss: boolean }> {
	// Ohne Geschäft kommt die Anfrage vom Formular während der Abstimmung, und
	// die ist inzwischen geschlossen (Codeprüfung Block 4a, N-1).
	if (!traktandumId) {
		throw new FachlicherFehler(
			'kein_universaldurchgang',
			'Ein Widerspruch wird nur festgehalten, solange eine Abstimmung als Universalversammlung offen ist.',
			'widerspruch'
		);
	}
	const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
	if (m?.state !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_laufend',
			'Ein Widerspruch wird festgehalten, während die Versammlung läuft.',
			'widerspruch'
		);
	}
	const [t] = await tx<
		{ id: string; title: string; unannounced_basis: string | null; withdrawn_at: Date | null }[]
	>`
		SELECT id, title, unannounced_basis, withdrawn_at FROM agenda_item
		WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		FOR UPDATE
	`;
	if (!t || t.unannounced_basis !== 'universal' || t.withdrawn_at) {
		throw new FachlicherFehler(
			'kein_universalgeschaeft',
			'Ein Widerspruch vor dem Eröffnen gehört an ein Geschäft, das als Universalversammlung ' +
				'aufgenommen ist.',
			'widerspruch'
		);
	}
	/*
	 * Nach der Sperre gelesen: Hat das Eröffnen sie zuerst gehabt, steht sein
	 * Durchgang jetzt da.
	 */
	const [offen] = await tx<{ ja: number }[]>`
		SELECT 1 AS ja FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId} AND state = 'offen'
	`;
	if (offen) throw schonEroeffnet();
	/*
	 * **Dieselbe Frage wie beim Eröffnen** (Fachprüfung Block 4a, Stelle 6;
	 * Codeprüfung N-3): Darf zu diesem Geschäft jetzt ein Durchgang eröffnet
	 * werden? Nach einem angenommenen Rückkommen ja, und dann braucht es wieder
	 * den Verzicht aller; der Widerspruch hat dort seinen Ort.
	 */
	/*
	 * Nur die Absage «kein neuer Durchgang» wird übersetzt (Codeprüfung Block
	 * 4a, zweiter Durchgang, N-4). Eine unlesbare Festschreibung bleibt, was
	 * sie ist; und nach einem Widerspruch sagt die Prüfung im Aufrufer
	 * (`schon_widersprochen`), was gilt, nicht diese.
	 */
	const [schonWidersprochen] = await tx<{ ja: number }[]>`
		SELECT 1 AS ja FROM universal_objection
		WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId}
	`;
	if (!schonWidersprochen) {
		try {
			await rueckkommenZuEroeffnen(tx, meetingId, traktandumId, t.title);
		} catch (fehler) {
			if (!(fehler instanceof FachlicherFehler) || fehler.kennung === 'festschreibung_unlesbar') {
				throw fehler;
			}
			// «Ergebnis», nicht «Beschluss»: Beim offenen Stichentscheid gibt es
			// keinen (Codeprüfung Block 4a, dritter Durchgang, N-2).
			throw new FachlicherFehler(
				'schon_abgestimmt',
				'Über dieses Geschäft ist schon abgestimmt; das Ergebnis bleibt. Einen Widerspruch vor dem ' +
					'Eröffnen gibt es erst wieder, wenn die Versammlung auf das Geschäft zurückkommt.',
				'widerspruch'
			);
		}
	}
	return {
		geschaeft: t.id,
		fruehererBeschluss: await beschlussGiltIn(tx, meetingId, traktandumId)
	};
}

/** Die Seite lag hinter einem anderen Gerät zurück (Laienprüfung Block 4a, L3). */
function schonEroeffnet(): FachlicherFehler {
	return new FachlicherFehler(
		'schon_eroeffnet',
		'Die Abstimmung ist inzwischen eröffnet. Halten Sie den Widerspruch bei der offenen Abstimmung ' +
			'mit «Widerspruch festhalten» fest; laden Sie die Seite neu, falls Sie sie nicht sehen.',
		'widerspruch'
	);
}
