/**
 * Saalgeräte verwalten: die eigene Identität und die registrierten Gegenstellen.
 *
 * Zwei Seiten derselben Sache, und dieselbe Anwendung kann beides sein:
 *
 *   * **Die eigene Identität** (`device_identity`) hat, wer als Saalgerät
 *     dienen will. Sie entsteht einmal und wird danach nur noch angezeigt.
 *   * **Registrierte Geräte** (`handover_device`) führt, wer abgibt. Sie sind
 *     die Empfänger, für die ein Vorbereitungspaket verschlüsselt wird.
 *
 * Die Krypto steht in `saalgeraet.ts`, hier steht der Weg zur Datenbank.
 */
import { alsBetreiber, sql } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	alsGeraetecode,
	ausGeraetecode,
	erzeugeGeraeteschluessel,
	oeffneGeheimteil,
	versiegeleGeheimteil
} from './saalgeraet';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import type { Id } from '$lib/domain/types';

export interface EigenesGeraet {
	name: string;
	code: string;
	fingerabdruck: string;
	eingerichtetAm: string;
}

export interface RegistriertesGeraet {
	id: string;
	name: string;
	encPublic: string;
	sigPublic: string;
	fingerabdruck: string;
	registriertAm: string;
	registriertDurch: string | null;
	zuletztBenutzt: string | null;
	widerrufenAm: string | null;
	widerrufenGrund: string | null;
}

// ── Die eigene Identität ────────────────────────────────────────────────────

/**
 * Wer bin ich als Saalgerät?
 *
 * **Ohne Betreiberbezug und deshalb ohne `alsBetreiber`.** Die Identität gehört
 * dem Gerät, nicht einem Mandanten; dieselbe Anwendung kann für mehrere
 * Gemeinschaften im Saal stehen. Der geheime Teil wird hier nicht gelesen: Wer
 * ihn braucht, holt ihn über `holeGeheimteile`.
 */
export async function holeEigenesGeraet(): Promise<EigenesGeraet | null> {
	const [z] = await sql<
		{ name: string; enc_public_key: string; sig_public_key: string; fingerprint: string; created_at: Date }[]
	>`SELECT name, enc_public_key, sig_public_key, fingerprint, created_at FROM device_identity LIMIT 1`;

	return z
		? {
				name: z.name,
				code: alsGeraetecode({
					encPublic: z.enc_public_key,
					sigPublic: z.sig_public_key,
					fingerabdruck: z.fingerprint
				}),
				fingerabdruck: z.fingerprint,
				eingerichtetAm: z.created_at.toISOString()
			}
		: null;
}

/** Die geheimen Teile, für das Öffnen eines Pakets und das Unterschreiben. */
export async function holeGeheimteile(): Promise<{ encSecret: string; sigSecret: string } | null> {
	const [z] = await sql<{ enc_secret_key: string; sig_secret_key: string }[]>`
		SELECT enc_secret_key, sig_secret_key FROM device_identity LIMIT 1
	`;
	return z
		? {
				encSecret: oeffneGeheimteil(z.enc_secret_key),
				sigSecret: oeffneGeheimteil(z.sig_secret_key)
			}
		: null;
}

/**
 * Richtet diese Anwendung als Saalgerät ein.
 *
 * **Genau einmal, und das ist keine Bequemlichkeit.** Ein zweites Paar hiesse
 * zwei Identitäten für dasselbe Gerät; welche gerade gilt, wüsste niemand, und
 * ein Paket, das für die eine verschlüsselt wurde, liesse sich mit der anderen
 * nicht öffnen. Der eindeutige Schlüssel in Migration 116 hält das fest, hier
 * steht die Absage in Worten.
 */
export async function richteEigenesGeraetEin(name: string): Promise<EigenesGeraet> {
	const sauber = name.trim();
	if (zeichenzahl(sauber) < 2) {
		throw new FachlicherFehler(
			'name_fehlt',
			'Geben Sie dem Gerät einen Namen, etwa «Notebook Saal». Er steht später in der Liste der abgebenden Stelle.',
			'name'
		);
	}
	if (await holeEigenesGeraet()) {
		throw new FachlicherFehler(
			'schon_eingerichtet',
			'Dieses Gerät ist bereits eingerichtet. Sein Code steht oben; ein zweiter würde die Pakete unbrauchbar machen, die für den ersten verschlüsselt wurden.',
			'name'
		);
	}

	const paar = erzeugeGeraeteschluessel();
	await sql`
		INSERT INTO device_identity (
			name, enc_public_key, enc_secret_key, sig_public_key, sig_secret_key, fingerprint
		) VALUES (
			${sauber}, ${paar.encPublic}, ${versiegeleGeheimteil(paar.encSecret)},
			${paar.sigPublic}, ${versiegeleGeheimteil(paar.sigSecret)}, ${paar.fingerabdruck}
		)
	`;

	const eigenes = await holeEigenesGeraet();
	if (!eigenes) {
		throw new FachlicherFehler('nicht_gespeichert', 'Das Gerät liess sich nicht einrichten.', 'name');
	}
	return eigenes;
}

// ── Die Gegenstellen ────────────────────────────────────────────────────────

interface GeraetZeile {
	id: string;
	name: string;
	enc_public_key: string;
	sig_public_key: string;
	fingerprint: string;
	registered_at: Date;
	registered_by_label: string | null;
	last_used_at: Date | null;
	revoked_at: Date | null;
	revoked_reason: string | null;
}

function ausDb(z: GeraetZeile): RegistriertesGeraet {
	return {
		id: z.id,
		name: z.name,
		encPublic: z.enc_public_key,
		sigPublic: z.sig_public_key,
		fingerabdruck: z.fingerprint,
		registriertAm: z.registered_at.toISOString(),
		registriertDurch: z.registered_by_label,
		zuletztBenutzt: z.last_used_at?.toISOString() ?? null,
		widerrufenAm: z.revoked_at?.toISOString() ?? null,
		widerrufenGrund: z.revoked_reason
	};
}

export async function holeGeraete(operatorId: Id): Promise<RegistriertesGeraet[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<GeraetZeile[]>`
			SELECT * FROM handover_device ORDER BY revoked_at NULLS FIRST, registered_at DESC
		`;
		return zeilen.map(ausDb);
	});
}

export async function holeGeraet(operatorId: Id, id: Id): Promise<RegistriertesGeraet | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<GeraetZeile[]>`SELECT * FROM handover_device WHERE id = ${id}`;
		return z ? ausDb(z) : null;
	});
}

/**
 * Trägt ein Gerät ein.
 *
 * Der Code wird **vor** der Datenbank gelesen und geprüft: Ein unbrauchbarer
 * Code soll nicht als Zeile dastehen, an der erst das erste Paket scheitert.
 */
export async function registriereGeraet(
	handelnder: Handelnder & { operatorId: string },
	name: string,
	code: string
): Promise<RegistriertesGeraet> {
	const sauber = name.trim();
	if (zeichenzahl(sauber) < 2) {
		throw new FachlicherFehler(
			'name_fehlt',
			'Geben Sie dem Gerät einen Namen, unter dem Sie es wiedererkennen.',
			'name'
		);
	}

	const oeffentlich = ausGeraetecode(code);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [schon] = await tx<GeraetZeile[]>`
			SELECT * FROM handover_device WHERE fingerprint = ${oeffentlich.fingerabdruck}
		`;
		if (schon) {
			throw new FachlicherFehler(
				'schon_registriert',
				`Dieses Gerät ist bereits eingetragen, als «${schon.name}». Zwei Namen für dasselbe Gerät hiessen bei der Rückgabe zwei mögliche Absender.`,
				'code'
			);
		}

		const [z] = await tx<GeraetZeile[]>`
			INSERT INTO handover_device (
				operator_id, name, enc_public_key, sig_public_key, fingerprint,
				registered_by, registered_by_label
			) VALUES (
				${handelnder.operatorId}, ${sauber}, ${oeffentlich.encPublic}, ${oeffentlich.sigPublic},
				${oeffentlich.fingerabdruck}, ${handelnder.userId}, ${handelnder.label}
			)
			RETURNING *
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.saalgeraetRegistriert,
				{ art: 'operator', id: handelnder.operatorId },
				{ geraet: sauber, fingerabdruck: oeffentlich.fingerabdruck }
			)
		);

		return ausDb(z);
	});
}

/**
 * Widerruft ein Gerät.
 *
 * **Die Zeile bleibt stehen** (AD-5): Frühere Abgaben verweisen darauf, und
 * ohne sie stünde im Leihschein eine Kennung ohne Namen. Was der Widerruf
 * bewirkt, ist die Zukunft: An ein widerrufenes Gerät wird nichts mehr
 * abgegeben.
 */
export async function widerrufeGeraet(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	grund: string
): Promise<void> {
	const sauber = grund.trim();
	if (zeichenzahl(sauber) < 5) {
		throw new FachlicherFehler(
			'grund_fehlt',
			'Sagen Sie, warum das Gerät nicht mehr gilt, etwa «verloren gegangen» oder «ersetzt».',
			'grund'
		);
	}

	const geraet = await holeGeraet(handelnder.operatorId, id);
	if (!geraet) {
		throw new FachlicherFehler('unbekannt', 'Dieses Gerät gibt es nicht.', 'id');
	}
	if (geraet.widerrufenAm) {
		throw new FachlicherFehler(
			'schon_widerrufen',
			'Dieses Gerät ist bereits widerrufen.',
			'id'
		);
	}

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		await tx`
			UPDATE handover_device
			   SET revoked_at = now(), revoked_by = ${handelnder.userId}, revoked_reason = ${sauber}
			 WHERE id = ${id}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.saalgeraetWiderrufen,
				{ art: 'operator', id: handelnder.operatorId },
				{ geraet: geraet.name, fingerabdruck: geraet.fingerabdruck, grund: sauber }
			)
		);
	});
}

/** Vermerkt, dass an dieses Gerät abgegeben wurde. */
export async function vermerkeVerwendung(operatorId: Id, id: Id): Promise<void> {
	await alsBetreiber(operatorId, async (tx) => {
		await tx`UPDATE handover_device SET last_used_at = now() WHERE id = ${id}`;
	});
}
