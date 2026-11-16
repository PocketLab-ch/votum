/**
 * Datenzugriff auf Quotenarten und Einheiten (Story 1.5).
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import {
	aendereEinheit,
	legeEinheitAn,
	pruefeQuotenart,
	pruefeSalden,
	pruefeVerteilerLoeschen,
	type Ebene,
	type Einheit,
	type EinheitEingabe,
	type QuotenartEingabe,
	type SaldoErgebnis
} from '$lib/domain/einheiten';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Id, UnitKind } from '$lib/domain/types';

export interface Quotenart extends QuotenartEingabe {
	id: Id;
}

async function leseQuotenarten(tx: postgres.TransactionSql, stwegId: Id): Promise<Quotenart[]> {
	const zeilen = await tx<
		{
			id: string;
			stweg_id: string;
			key: string;
			name: string;
			denominator: number;
			is_primary: boolean;
			sort_order: number;
		}[]
	>`SELECT * FROM quota_kind WHERE stweg_id = ${stwegId} ORDER BY sort_order, key`;

	return zeilen.map((z) => ({
		id: z.id,
		stwegId: z.stweg_id,
		key: z.key,
		name: z.name,
		denominator: z.denominator,
		isPrimary: z.is_primary,
		sortOrder: z.sort_order
	}));
}

export async function holeQuotenarten(operatorId: Id, stwegId: Id): Promise<Quotenart[]> {
	return alsBetreiber(operatorId, (tx) => leseQuotenarten(tx, stwegId));
}

export async function erstelleQuotenart(
	handelnder: Handelnder & { operatorId: string },
	eingabe: QuotenartEingabe
): Promise<Quotenart> {
	const geprueft = pruefeQuotenart(eingabe);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<{ id: string }[]>`
			INSERT INTO quota_kind (stweg_id, operator_id, key, name, denominator, is_primary, sort_order)
			VALUES (${geprueft.stwegId}, ${handelnder.operatorId}, ${geprueft.key}, ${geprueft.name},
			        ${geprueft.denominator}, ${geprueft.isPrimary}, ${geprueft.sortOrder})
			RETURNING id
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.gemeinschaftGeaendert,
				{ art: 'stweg', id: geprueft.stwegId },
				{ quotenartAngelegt: geprueft.key, name: geprueft.name, nenner: geprueft.denominator }
			)
		);

		return { ...geprueft, id: zeile.id };
	});
}

/**
 * Entfernt einen Verteiler samt seinen Werten.
 *
 * Beides in **einer** Transaktion: `unit_quota` hängt mit `ON DELETE RESTRICT`
 * am Verteiler, also müssen seine Werte zuerst weg. Zwei getrennte Aufrufe
 * liessen bei einem Abbruch eine Gemeinschaft zurück, deren Einheiten den
 * Verteiler nicht mehr tragen, während er selbst noch in der Tabelle steht.
 *
 * Was gelöscht werden darf, entscheidet der Kern (`pruefeVerteilerLoeschen`) —
 * hier steht nur, wie gezählt und geschrieben wird.
 */
export async function loescheQuotenart(
	handelnder: Handelnder & { operatorId: string },
	eingabe: { stwegId: Id; artId: Id; bestaetigt: boolean }
): Promise<{ rueckfrage: { betroffen: number; name: string } | null }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [art] = await tx<{ key: string; name: string; is_primary: boolean }[]>`
			SELECT key, name, is_primary FROM quota_kind
			WHERE id = ${eingabe.artId} AND stweg_id = ${eingabe.stwegId}
		`;
		if (!art) {
			throw new FachlicherFehler('unbekannt', 'Diesen Verteiler gibt es nicht.', 'artId');
		}

		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM unit_quota WHERE quota_kind_id = ${eingabe.artId}
		`;

		const plan = pruefeVerteilerLoeschen(
			{ name: art.name, isPrimary: art.is_primary },
			anzahl,
			eingabe.bestaetigt
		);
		if (plan.rueckfrage) {
			return { rueckfrage: { betroffen: plan.rueckfrage.betroffen, name: art.name } };
		}

		await tx`DELETE FROM unit_quota WHERE quota_kind_id = ${eingabe.artId}`;
		await tx`DELETE FROM quota_kind WHERE id = ${eingabe.artId}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.gemeinschaftGeaendert,
				{ art: 'stweg', id: eingabe.stwegId },
				{ quotenartEntfernt: art.key, name: art.name, werteEntfernt: anzahl }
			)
		);

		return { rueckfrage: null };
	});
}

// ── Einheiten ───────────────────────────────────────────────────────────────

interface EinheitZeile {
	id: string;
	stweg_id: string;
	kind: UnitKind;
	label: string;
	counts_as_head: boolean;
	quotas: Record<string, number> | null;
	/*
	 * **Als Zeichenkette, nicht als Zahl** (Befund 26, 07.09.2026). `numeric`
	 * kommt aus postgres.js als String, weil es mehr Stellen tragen kann als
	 * eine Gleitkommazahl. Wer den Typ hier `number` nennt, hat später `'3.5'`
	 * in einem Feld, das `3.5` verspricht — und `zimmer > 3` wäre still falsch.
	 */
	rooms: string | null;
	area_m2: string | null;
	location: string | null;
}

/** `numeric` aus der Datenbank in eine Zahl, oder `null`. */
function alsZahl(wert: string | null): number | null {
	if (wert === null) return null;
	const zahl = Number(wert);
	return Number.isFinite(zahl) ? zahl : null;
}

function ausDb(z: EinheitZeile): Einheit {
	return {
		id: z.id,
		stwegId: z.stweg_id,
		kind: z.kind,
		label: z.label,
		countsAsHead: z.counts_as_head,
		quotas: z.quotas ?? {},
		zimmer: alsZahl(z.rooms),
		flaeche: alsZahl(z.area_m2),
		lage: z.location
	};
}

/**
 * Einheiten einer Gemeinschaft samt ihren Quoten.
 *
 * Die Quoten kommen als ein Objekt je Einheit aus der Datenbank, nicht als
 * zweite Abfrage — sonst entstünde je Einheit eine weitere Abfrage, und bei
 * vierzehn Gemeinschaften mit je vierzig Einheiten wäre das spürbar.
 */
async function leseEinheiten(tx: postgres.TransactionSql, stwegId: Id): Promise<Einheit[]> {
	const zeilen = await tx<EinheitZeile[]>`
		SELECT u.id, u.stweg_id, u.kind, u.label, u.counts_as_head,
		       u.rooms, u.area_m2, u.location,
		       (SELECT jsonb_object_agg(qk.key, uq.value)
		        FROM unit_quota uq
		        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
		        WHERE uq.unit_id = u.id) AS quotas
		FROM unit u
		WHERE u.stweg_id = ${stwegId}
		ORDER BY u.label
	`;
	return zeilen.map(ausDb);
}

export async function holeEinheiten(operatorId: Id, stwegId: Id): Promise<Einheit[]> {
	return alsBetreiber(operatorId, (tx) => leseEinheiten(tx, stwegId));
}

/** Schreibt die Quotenwerte einer Einheit; nicht genannte Arten werden entfernt. */
async function schreibeQuoten(
	tx: postgres.TransactionSql,
	operatorId: Id,
	stwegId: Id,
	unitId: Id,
	quotas: Record<string, number>,
	arten: Quotenart[]
): Promise<void> {
	const nachSchluessel = new Map(arten.map((a) => [a.key, a.id]));
	const behalten = Object.keys(quotas);

	// Zuerst entfernen, was nicht mehr gilt: Eine Einheit kann aus einem
	// Verteiler ausscheiden, und die alte Zeile bliebe sonst stehen.
	if (behalten.length === 0) {
		await tx`DELETE FROM unit_quota WHERE unit_id = ${unitId}`;
	} else {
		const behaltenIds = behalten.map((k) => nachSchluessel.get(k)!);
		await tx`
			DELETE FROM unit_quota
			WHERE unit_id = ${unitId} AND quota_kind_id <> ALL(${behaltenIds}::uuid[])
		`;
	}

	for (const [schluessel, wert] of Object.entries(quotas)) {
		const kindId = nachSchluessel.get(schluessel);
		if (!kindId) continue; // Der Kern hat das bereits abgewiesen.
		await tx`
			INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
			VALUES (${unitId}, ${kindId}, ${stwegId}, ${operatorId}, ${wert})
			ON CONFLICT (unit_id, quota_kind_id) DO UPDATE SET value = EXCLUDED.value
		`;
	}
}

/** Eine Einheit innerhalb einer bestehenden Transaktion anlegen. */
async function legeAnInTx(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	eingabe: EinheitEingabe,
	arten: Quotenart[]
): Promise<Einheit> {
	const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
	const u = legeEinheitAn(id, eingabe, arten);
	const e = u.ergebnis;

	await tx`
		INSERT INTO unit (id, stweg_id, operator_id, kind, label, counts_as_head,
		                  rooms, area_m2, location)
		VALUES (${e.id}, ${e.stwegId}, ${handelnder.operatorId}, ${e.kind}, ${e.label},
		        ${e.countsAsHead}, ${e.zimmer ?? null}, ${e.flaeche ?? null}, ${e.lage ?? null})
	`;
	await schreibeQuoten(tx, handelnder.operatorId, e.stwegId, e.id, e.quotas, arten);

	return schreibeUebergang(tx, handelnder, u);
}

export async function erstelleEinheit(
	handelnder: Handelnder & { operatorId: string },
	eingabe: EinheitEingabe
): Promise<Einheit> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const arten = await leseQuotenarten(tx, eingabe.stwegId);
		return legeAnInTx(tx, handelnder, eingabe, arten);
	});
}

/**
 * Mehrere Einheiten in **einer** Transaktion (Befund 29).
 *
 * **Warum nicht einfach `erstelleEinheit` in einer Schleife** (Code-Review
 * 07.09.2026). Jeder Aufruf öffnet über `alsBetreiber` seine eigene
 * Transaktion. Scheitert die dritte von zwanzig Zeilen — etwa an einer
 * Zimmerzahl, die der Kern erst hier prüft —, stehen die ersten beiden bereits
 * fest, während die Seite «es entstand keine einzige Einheit» meldet. Der
 * Verwalter berichtigt die Zeile, schickt alles erneut, und die ersten beiden
 * stehen doppelt da; der Wertquotensaldo geht danach nicht mehr auf.
 *
 * **Alle Einheiten derselben Gemeinschaft.** Die Quotenarten werden einmal
 * gelesen; Eingaben mit fremder `stwegId` gehören nicht in einen Aufruf und
 * werden abgewiesen, statt still mit den falschen Arten geprüft zu werden.
 */
export async function erstelleEinheiten(
	handelnder: Handelnder & { operatorId: string },
	stwegId: Id,
	eingaben: EinheitEingabe[]
): Promise<Einheit[]> {
	if (eingaben.some((e) => e.stwegId !== stwegId)) {
		throw new FachlicherFehler(
			'fremde_gemeinschaft',
			'Alle Einheiten eines Aufrufs gehören zur selben Gemeinschaft.',
			'stwegId'
		);
	}
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const arten = await leseQuotenarten(tx, stwegId);
		const angelegt: Einheit[] = [];
		for (const eingabe of eingaben) {
			angelegt.push(await legeAnInTx(tx, handelnder, eingabe, arten));
		}
		return angelegt;
	});
}

export async function bearbeiteEinheit(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	eingabe: EinheitEingabe
): Promise<Einheit> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<EinheitZeile[]>`
			SELECT u.id, u.stweg_id, u.kind, u.label, u.counts_as_head,
			       u.rooms, u.area_m2, u.location,
			       (SELECT jsonb_object_agg(qk.key, uq.value)
			        FROM unit_quota uq
			        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
			        WHERE uq.unit_id = u.id) AS quotas
			FROM unit u WHERE u.id = ${id}
		`;
		if (!zeile) throw new Error('Einheit nicht gefunden');

		const arten = await leseQuotenarten(tx, zeile.stweg_id);
		const u = aendereEinheit(ausDb(zeile), { ...eingabe, stwegId: zeile.stweg_id }, arten);
		const e = u.ergebnis;

		await tx`
			UPDATE unit SET kind = ${e.kind}, label = ${e.label}, counts_as_head = ${e.countsAsHead},
			                rooms = ${e.zimmer ?? null}, area_m2 = ${e.flaeche ?? null},
			                location = ${e.lage ?? null}
			WHERE id = ${id}
		`;
		await schreibeQuoten(tx, handelnder.operatorId, e.stwegId, e.id, e.quotas, arten);

		return schreibeUebergang(tx, handelnder, u);
	});
}

// ── Saldoprüfung ────────────────────────────────────────────────────────────

/**
 * Prüft die Wertquoten einer Gemeinschaft samt ihren Untergemeinschaften.
 *
 * Der Baum wird vollständig geholt: Bei einer Mehrhausanlage hängt der Saldo der
 * Dachebene an den Nennern der Häuser, und eine Prüfung nur der einen Ebene
 * meldete «geht auf», während die Anlage insgesamt nicht aufgeht.
 */
export async function pruefeGemeinschaftSalden(
	operatorId: Id,
	wurzelId: Id
): Promise<SaldoErgebnis> {
	return alsBetreiber(operatorId, async (tx) => {
		const ebenenZeilen = await tx<{ id: string; name: string; parent_stweg_id: string | null }[]>`
			WITH RECURSIVE baum AS (
				SELECT id, name, parent_stweg_id FROM stweg WHERE id = ${wurzelId}
				UNION ALL
				SELECT s.id, s.name, s.parent_stweg_id
				FROM stweg s JOIN baum b ON s.parent_stweg_id = b.id
			)
			SELECT * FROM baum
		`;

		const ids = ebenenZeilen.map((z) => z.id);
		if (ids.length === 0) return { zeilen: [], stimmig: true, stammquotenStimmig: true };

		const artenZeilen = await tx<
			{ stweg_id: string; key: string; name: string; denominator: number; is_primary: boolean }[]
		>`
			SELECT stweg_id, key, name, denominator, is_primary
			FROM quota_kind WHERE stweg_id = ANY(${ids}::uuid[])
			ORDER BY sort_order, key
		`;

		const einheitenZeilen = await tx<{ stweg_id: string; quotas: Record<string, number> | null }[]>`
			SELECT u.stweg_id,
			       (SELECT jsonb_object_agg(qk.key, uq.value)
			        FROM unit_quota uq
			        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
			        WHERE uq.unit_id = u.id) AS quotas
			FROM unit u
			WHERE u.stweg_id = ANY(${ids}::uuid[])
		`;

		const artenJeEbene = new Map<string, Ebene['quotenarten']>();
		for (const a of artenZeilen) {
			const liste = artenJeEbene.get(a.stweg_id) ?? [];
			liste.push({ key: a.key, name: a.name, denominator: a.denominator, isPrimary: a.is_primary });
			artenJeEbene.set(a.stweg_id, liste);
		}

		const ebenen: Ebene[] = ebenenZeilen.map((z) => ({
			id: z.id,
			name: z.name,
			parentStwegId: z.parent_stweg_id,
			quotenarten: artenJeEbene.get(z.id) ?? []
		}));

		return pruefeSalden(
			ebenen,
			einheitenZeilen.map((z) => ({ stwegId: z.stweg_id, quotas: z.quotas ?? {} }))
		);
	});
}

/**
 * Eine Einheit entfernen.
 *
 * **Der Anlass** (Prüflauf 22.08.2026, Befund A-01): Es gab keinen Weg. Wer sich
 * beim Erfassen vertat — fünf Wohnungen doppelt angelegt —, musste die ganze
 * Gemeinschaft löschen und von vorne beginnen. Die Gemeinschaft als Ganzes war
 * löschbar, die einzelne Zeile nicht.
 *
 * **Die Schranke ist eine andere als beim Verteiler.** Dort entscheidet die
 * Zahl der betroffenen Werte; hier entscheidet, ob die Einheit je an einer
 * freigegebenen Versammlung teilgenommen hat. Steht sie in einer Momentaufnahme,
 * hängt an ihr eine Wertquote, mit der abgestimmt wurde — und ein Protokoll, in
 * dem eine Quote auftaucht, deren Einheit es nicht mehr gibt, ist im Streitfall
 * wertlos. Dann bleibt sie, auch wenn sie ein Versehen war.
 *
 * `snapshot_unit` trägt die Kennung, hat aber **keinen** Fremdschlüssel auf
 * `unit` — die Momentaufnahme ist bewusst eine Kopie und stürbe sonst mit. Die
 * Prüfung muss deshalb von Hand geschehen; die Datenbank hält hier nichts auf.
 *
 * Was mitgeht, wenn entfernt wird: Zuordnungen, Quoten und Nutzniessungen
 * (alle `ON DELETE CASCADE`). Das steht in der Rückfrage, bevor es geschieht.
 */
export async function entferneEinheit(
	handelnder: Handelnder & { operatorId: string },
	eingabe: { stwegId: Id; einheitId: Id; bestaetigt: boolean }
): Promise<{ rueckfrage: { bezeichnung: string; zuordnungen: number; quoten: number } | null }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [einheit] = await tx<{ label: string }[]>`
			SELECT label FROM unit WHERE id = ${eingabe.einheitId} AND stweg_id = ${eingabe.stwegId}
		`;
		if (!einheit) {
			throw new FachlicherFehler('unbekannt', 'Diese Einheit gibt es nicht.', 'einheitId');
		}

		const [{ anzahl: inVersammlungen }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM snapshot_unit WHERE unit_id = ${eingabe.einheitId}
		`;
		if (inVersammlungen > 0) {
			throw new FachlicherFehler(
				'einheit_in_versammlung',
				`«${einheit.label}» hat an ${inVersammlungen === 1 ? 'einer freigegebenen Versammlung' : `${inVersammlungen} freigegebenen Versammlungen`} teilgenommen und lässt sich nicht mehr entfernen. Ihre Wertquote steht in deren Auszählung; ohne die Einheit wäre das Protokoll nicht mehr nachvollziehbar.`,
				'einheitId'
			);
		}

		const [{ anzahl: zuordnungen }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM unit_ownership WHERE unit_id = ${eingabe.einheitId}
		`;
		const [{ anzahl: quoten }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM unit_quota WHERE unit_id = ${eingabe.einheitId}
		`;

		if (!eingabe.bestaetigt) {
			return { rueckfrage: { bezeichnung: einheit.label, zuordnungen, quoten } };
		}

		// Zuordnungen, Quoten und Nutzniessungen gehen über `ON DELETE CASCADE`
		// mit — nachgesehen an den Fremdschlüsseln, nicht angenommen.
		await tx`DELETE FROM unit WHERE id = ${eingabe.einheitId}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einheitEntfernt,
				{ art: 'stweg', id: eingabe.stwegId },
				{ bezeichnung: einheit.label, zuordnungen, quoten }
			)
		);
		return { rueckfrage: null };
	});
}
