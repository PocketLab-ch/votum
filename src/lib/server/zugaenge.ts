/**
 * Zugänge erzeugen und prüfen (Story 3.7).
 *
 * Der Code entsteht hier, wird einmal zurückgegeben und danach nie wieder: In
 * der Datenbank steht nur sein Prüfwert. Wer die Karte verliert, bekommt keinen
 * alten Code zu sehen, sondern einen neuen — und der alte wird dabei ungültig.
 */
import { createHash, randomBytes } from 'node:crypto';
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	codeAus,
	noetigeBytes,
	normalisiere,
	pruefeCode,
	type Zugangszustand
} from '$lib/domain/zugang';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

/** SHA-256 des normalisierten Codes, hexadezimal. */
export function pruefwert(code: string): string {
	return createHash('sha256').update(normalisiere(code)).digest('hex');
}

export interface ErzeugterZugang {
	snapshotPartyId: Id;
	partyId: Id;
	name: string;
	ausgeuebtDurch: string;
	einheiten: string[];
	/** Nur hier und nur jetzt. Danach existiert er ausschliesslich auf Papier. */
	code: string;
	/** Wahr, wenn dabei ein früherer Zugang ungültig wurde. */
	ersetzt: boolean;
}

export interface Zugangsuebersicht {
	snapshotPartyId: Id;
	name: string;
	ausgeuebtDurch: string;
	einheiten: string[];
	zustand: Zugangszustand | null;
	erzeugtAm: string | null;
	zuletztGenutztAm: string | null;
	/** Wie oft schon einer erzeugt wurde — mehr als eins heisst: ersetzt. */
	anzahl: number;
}

/**
 * Was an Zugängen besteht, je Partei der Momentaufnahme.
 *
 * Auch Parteien ohne Zugang erscheinen: Eine Liste, die nur die vorhandenen
 * zeigt, beantwortet die eine Frage nicht, auf die es vor dem Versand ankommt —
 * wer noch keine Karte hat.
 */
export async function holeZugangsuebersicht(
	operatorId: Id,
	meetingId: Id
): Promise<Zugangsuebersicht[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				snapshot_party_id: string;
				display_name: string;
				representative_name: string | null;
				einheiten: string[] | null;
				state: Zugangszustand | null;
				created_at: Date | null;
				last_used_at: Date | null;
				anzahl: number;
			}[]
		>`
			SELECT p.id AS snapshot_party_id, p.display_name, p.representative_name,
			       (SELECT array_agg(u.label ORDER BY u.label)
			        FROM snapshot_unit u WHERE u.snapshot_party_id = p.id) AS einheiten,
			       g.state, g.created_at, g.last_used_at,
			       (SELECT count(*)::int FROM meeting_access a
			        WHERE a.snapshot_party_id = p.id) AS anzahl
			FROM snapshot_party p
			LEFT JOIN meeting_access g
			       ON g.snapshot_party_id = p.id AND g.state = 'gueltig'
			WHERE p.meeting_id = ${meetingId}
			ORDER BY p.display_name
		`;

		return zeilen.map((z) => ({
			snapshotPartyId: z.snapshot_party_id,
			name: z.display_name,
			ausgeuebtDurch: z.representative_name ?? z.display_name,
			einheiten: z.einheiten ?? [],
			zustand: z.state,
			erzeugtAm: z.created_at?.toISOString() ?? null,
			zuletztGenutztAm: z.last_used_at?.toISOString() ?? null,
			anzahl: Number(z.anzahl)
		}));
	});
}

/**
 * Erzeugt Zugänge für die angegebenen Parteien.
 *
 * Ohne Angabe: für alle, die noch keinen gültigen haben. Das ist der Regelfall
 * vor dem Versand und verhindert, dass ein zweiter Klick alle bisherigen Karten
 * ungültig macht — was niemand erwartet und was erst auffiele, wenn im Saal die
 * Hälfte nicht hereinkommt.
 *
 * bindung: snapshotPartyIds — Die Bindung steht in einer verschachtelten
 *   Vorlage neben der Versammlungsbedingung: `${… ? tx`AND p.id = ANY(…)` :
 *   tx``}`.
 */
export async function erzeugeZugaenge(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	snapshotPartyIds?: Id[]
): Promise<ErzeugterZugang[]> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

		// Vor der Freigabe gibt es keine Momentaufnahme — und damit niemanden, für
		// den ein Zugang gälte.
		if (m.state === 'entwurf') {
			throw new FachlicherFehler(
				'nicht_freigegeben',
				'Zugänge entstehen erst mit der Freigabe: Vorher steht noch nicht fest, wer stimmberechtigt ist.',
				'zustand'
			);
		}
		if (['geschlossen', 'versiegelt'].includes(m.state)) {
			throw new FachlicherFehler(
				'geschlossen',
				'Die Versammlung ist geschlossen. Ein neuer Zugang gäbe niemandem mehr Zutritt.',
				'zustand'
			);
		}

		const parteien = await tx<
			{
				id: string;
				party_id: string;
				display_name: string;
				representative_name: string | null;
				einheiten: string[] | null;
				hat_gueltigen: boolean;
			}[]
		>`
			SELECT p.id, p.party_id, p.display_name, p.representative_name,
			       (SELECT array_agg(u.label ORDER BY u.label)
			        FROM snapshot_unit u WHERE u.snapshot_party_id = p.id) AS einheiten,
			       EXISTS (SELECT 1 FROM meeting_access a
			               WHERE a.snapshot_party_id = p.id AND a.state = 'gueltig') AS hat_gueltigen
			FROM snapshot_party p
			WHERE p.meeting_id = ${meetingId}
			  ${snapshotPartyIds?.length ? tx`AND p.id = ANY(${snapshotPartyIds})` : tx``}
			ORDER BY p.display_name
		`;

		const gewaehlt = snapshotPartyIds?.length
			? parteien
			: parteien.filter((p) => !p.hat_gueltigen);

		const erzeugte: ErzeugterZugang[] = [];

		for (const p of gewaehlt) {
			// Einen bestehenden gültigen Zugang zuerst entwerten. Zwei gültige wären
			// zwei Stimmrechte für dieselbe Person.
			const ersetzt = p.hat_gueltigen;
			if (ersetzt) {
				await tx`
					UPDATE meeting_access
					SET state = 'ersetzt', superseded_at = now()
					WHERE snapshot_party_id = ${p.id} AND state = 'gueltig'
				`;
			}

			const code = codeAus(new Uint8Array(randomBytes(noetigeBytes())));

			await tx`
				INSERT INTO meeting_access (operator_id, meeting_id, snapshot_party_id, code_hash)
				VALUES (${handelnder.operatorId}, ${meetingId}, ${p.id}, ${pruefwert(code)})
			`;

			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					ersetzt ? EREIGNISARTEN.zugangErneuert : EREIGNISARTEN.zugangErzeugt,
					{ art: 'meeting', id: meetingId },
					{
						// Der Name, nicht der Code: Der Verlauf ist für Auswertung und
						// Beleg gedacht, nicht als zweiter Speicher für Geheimnisse.
						partei: p.display_name,
						parteiId: p.party_id
					}
				)
			);

			erzeugte.push({
				snapshotPartyId: p.id,
				partyId: p.party_id,
				name: p.display_name,
				ausgeuebtDurch: p.representative_name ?? p.display_name,
				einheiten: p.einheiten ?? [],
				code,
				ersetzt
			});
		}

		return erzeugte;
	});
}

/**
 * Entwertet Zugänge und beendet Gerätesitzungen — innerhalb einer laufenden
 * Transaktion.
 *
 * Herausgezogen, weil das Schliessen der Versammlung dasselbe tun muss und
 * bereits in einer Transaktion steckt. Vorher stand die Entwertung an **zwei**
 * Stellen, und nur eine davon beendete auch die Gerätesitzungen: Der Weg über
 * `schliesseVersammlung` liess sie offen, sodass der Grund «geschlossen» im
 * Verlauf nie auftauchte, obwohl er dokumentiert war.
 */
export async function entwerteInTransaktion(
	tx: postgres.TransactionSql,
	meetingId: Id
): Promise<{ id: string }[]> {
	// Angemeldete Geräte zuerst: Eine offene Sitzung zu einer geschlossenen
	// Versammlung blockierte den Zugang für eine spätere, ohne dass jemand wüsste,
	// warum. Der Grund bleibt stehen, damit später nachvollziehbar ist, dass
	// niemand ausgesperrt wurde.
	await tx`
		UPDATE access_session s
		SET revoked_at = now(), revoked_reason = 'geschlossen'
		FROM meeting_access a
		WHERE a.id = s.meeting_access_id
		  AND a.meeting_id = ${meetingId}
		  AND s.revoked_at IS NULL
	`;

	return tx<{ id: string }[]>`
		UPDATE meeting_access SET state = 'entwertet'
		WHERE meeting_id = ${meetingId} AND state = 'gueltig'
		RETURNING id
	`;
}

/**
 * Entwertet alle Zugänge einer Versammlung, mit eigenem Verlaufseintrag.
 *
 * Fachlich nötig ist es nicht — `gibtZutritt` prüft ohnehin den
 * Versammlungszustand —, aber es macht den Zustand in der Datenbank ehrlich:
 * Ein als «gültig» geführter Zugang zu einer geschlossenen Versammlung wäre
 * eine irreführende Angabe.
 */
export async function entwerteZugaenge(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<number> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const zeilen = await entwerteInTransaktion(tx, meetingId);
		if (zeilen.length > 0) {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.zugaengeEntwertet,
					{ art: 'meeting', id: meetingId },
					{ anzahl: zeilen.length }
				)
			);
		}
		return zeilen.length;
	});
}

export interface Zugangspruefung {
	gueltig: boolean;
	grund?: string;
	meetingId?: Id;
	snapshotPartyId?: Id;
	name?: string;
}

/**
 * Prüft einen vorgezeigten Code.
 *
 * Läuft ohne Mandantenkontext: Wer eine Karte vorzeigt, ist nicht angemeldet.
 * Deshalb wird hier ausdrücklich **nicht** über `alsBetreiber` gegangen — die
 * Abfrage sucht über den Prüfwert, der über alle Betreiber eindeutig ist.
 *
 * In Welle 1 bleibt diese Funktion ungenutzt, bis Epic 4 das Check-in bringt.
 * Sie steht hier, weil der Prüfwert sonst als Datenfeld ohne Verwendung
 * dastünde und niemand sähe, wozu er da ist.
 */
export function pruefwertZu(code: string): string {
	return pruefwert(pruefeCode(code));
}
