/**
 * Ein Abschlusspaket aufnehmen und wieder lesen (PRD §13, Rückführung).
 *
 * **Die Prüfung ist nicht neu, nur die Aufnahme.** Geprüft wird über
 * `pruefePaket` — dieselbe Funktion, die die Prüfseite benutzt, mit denselben
 * vier Aussagen. Ein zweiter Prüfweg wäre eine zweite Stelle, an der ein
 * verändertes Paket durchkommen kann, und nur eine davon würde gepflegt.
 *
 * **Das Paket liegt in der Dateiablage, nicht in der Datenbank** (AD-17: der
 * Dateiname ist die Prüfsumme des Inhalts). In der Datenbank steht der
 * Nachweis, dass es geprüft wurde und zu welcher Gemeinschaft es gehört.
 */
import { createHash } from 'node:crypto';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { legeInternAb, lies } from './dateien';
import { entpacke, pruefePaket, type Paketbefund } from './paketpruefung';
import {
	beschluesseAus,
	pruefeEinspielbar,
	type EingespielterBeschluss,
	type Einspielbefund
} from '$lib/domain/einspielen';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Manifest } from '$lib/domain/siegel';
import type { Id } from '$lib/domain/types';

export interface Einspielvorschau {
	befund: Paketbefund;
	moeglich: Einspielbefund;
	beschluesse: EingespielterBeschluss[];
}

/** Liest die beiden Datendateien aus dem Paket. Fehlende ergeben `null`. */
function datenAus(dateien: Map<string, Uint8Array>, pfad: string): unknown {
	const bytes = dateien.get(pfad);
	if (!bytes) return null;
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		// Eine unlesbare Datendatei ist kein Grund abzubrechen: Die Prüfsummen
		// haben bereits gesagt, ob das Paket unverändert ist. Hier fehlt dann
		// eben die Anzeige, nicht der Nachweis.
		return null;
	}
}

/**
 * Zeigt, was die Aufnahme bewirken würde — bevor sie geschieht.
 *
 * Kein Schreiben. Dieselbe Reihenfolge wie überall in dieser Anwendung: erst
 * zeigen, dann bestätigen.
 */
export async function vorschau(
	operatorId: Id,
	archiv: Uint8Array,
	stwegId: Id | null,
	eingetipptesSiegel: string | null
): Promise<Einspielvorschau> {
	const befund = await pruefePaket(operatorId, archiv, null, eingetipptesSiegel);

	let gemeinschaftsname: string | null = null;
	let laeuftHier = false;
	let schonEingespielt = false;

	const kennung = befund.manifest?.versammlung?.kennung ?? null;

	if (stwegId) {
		await alsBetreiber(operatorId, async (tx) => {
			const [g] = await tx<{ name: string }[]>`
				SELECT name FROM stweg WHERE id = ${stwegId}
			`;
			gemeinschaftsname = g?.name ?? null;

			if (kennung) {
				const [eigene] = await tx<{ id: string }[]>`
					SELECT id FROM meeting WHERE id = ${kennung}
				`;
				laeuftHier = Boolean(eigene);
				const [schon] = await tx<{ id: string }[]>`
					SELECT id FROM imported_meeting WHERE meeting_key = ${kennung}
				`;
				schonEingespielt = Boolean(schon);
			}
		});
	}

	const moeglich = pruefeEinspielbar({
		manifestGelesen: befund.manifest !== null,
		inhaltUnveraendert: befund.inhalt?.bestandteileStimmen === true,
		gemeinschaftGewaehlt: Boolean(stwegId),
		nameStimmtUeberein:
			gemeinschaftsname !== null &&
			befund.manifest?.gemeinschaft?.trim() === (gemeinschaftsname as string).trim(),
		laeuftHier,
		schonEingespielt
	});

	const dateien = befund.manifest ? entpacke(archiv) : new Map<string, Uint8Array>();
	const beschluesse = befund.manifest
		? beschluesseAus(
				datenAus(dateien, 'daten/abstimmungen.json'),
				datenAus(dateien, 'daten/traktanden.json')
			)
		: [];

	return { befund, moeglich, beschluesse };
}

/**
 * Nimmt das Paket auf.
 *
 * **Geprüft wird hier noch einmal**, obwohl die Vorschau es schon getan hat: Was
 * zwischen Anzeigen und Bestätigen hochgeladen wird, entscheidet der Browser,
 * nicht der Server. Eine Prüfung, die man umgehen kann, indem man das zweite
 * Formular mit einer anderen Datei abschickt, ist keine.
 */
export async function nimmAuf(
	handelnder: Handelnder & { operatorId: string },
	archiv: Uint8Array,
	stwegId: Id,
	herkunft: string | null,
	eingetipptesSiegel: string | null
): Promise<{ id: string; kennung: string }> {
	const { befund, moeglich } = await vorschau(
		handelnder.operatorId,
		archiv,
		stwegId,
		eingetipptesSiegel
	);
	if (!moeglich.moeglich) {
		throw new FachlicherFehler(moeglich.hindernis ?? 'nicht_moeglich', moeglich.satz, 'datei');
	}

	const manifest = befund.manifest as Manifest;
	const kennung = manifest.versammlung.kennung;

	// Das Paket zuerst ablegen: Steht der Eintrag ohne Datei da, verweist er auf
	// nichts — und die Reihenfolge lässt sich nachher nicht mehr umkehren.
	const abgelegt = await legeInternAb(archiv);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;

		await tx`
			INSERT INTO imported_meeting (
				id, operator_id, stweg_id, meeting_key, seal_hash, manifest,
				package_checksum, package_size, imported_by, origin_note
			) VALUES (
				${id}, ${handelnder.operatorId}, ${stwegId}, ${kennung},
				${befund.gerechnetesSiegel ?? ''}, ${tx.json(manifest as never)},
				${abgelegt.pruefsumme}, ${abgelegt.groesse}, ${handelnder.label},
				${herkunft?.trim() || null}
			)
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.paketEingespielt,
				{ art: 'stweg', id: stwegId },
				{
					kennung,
					datum: manifest.versammlung.datum,
					ort: manifest.versammlung.ort,
					siegel: befund.gerechnetesSiegel,
					versiegeltAm: manifest.versiegeltAm,
					versiegeltDurch: manifest.versiegeltDurch,
					zeitquelle: manifest.zeitquelle,
					herkunft: herkunft?.trim() || null
				}
			)
		);

		return { id, kennung };
	});
}

export interface EingespielteVersammlung {
	id: string;
	stwegId: string;
	kennung: string;
	siegel: string;
	manifest: Manifest;
	pruefsumme: string;
	groesse: number;
	eingespieltAm: string;
	eingespieltDurch: string;
	herkunft: string | null;
}

function ausZeile(z: {
	id: string;
	stweg_id: string;
	meeting_key: string;
	seal_hash: string;
	manifest: Manifest;
	package_checksum: string;
	package_size: string | number;
	imported_at: Date;
	imported_by: string;
	origin_note: string | null;
}): EingespielteVersammlung {
	return {
		id: z.id,
		stwegId: z.stweg_id,
		kennung: z.meeting_key,
		siegel: z.seal_hash,
		manifest: z.manifest,
		pruefsumme: z.package_checksum,
		groesse: Number(z.package_size),
		eingespieltAm: new Date(z.imported_at).toISOString(),
		eingespieltDurch: z.imported_by,
		herkunft: z.origin_note
	};
}

export async function holeEingespielte(
	operatorId: Id,
	stwegId: Id
): Promise<EingespielteVersammlung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Parameters<typeof ausZeile>[0][]>`
			SELECT * FROM imported_meeting WHERE stweg_id = ${stwegId} ORDER BY imported_at DESC
		`;
		return zeilen.map(ausZeile);
	});
}

export async function holeEingespielte1(
	operatorId: Id,
	id: Id
): Promise<EingespielteVersammlung | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [zeile] = await tx<Parameters<typeof ausZeile>[0][]>`
			SELECT * FROM imported_meeting WHERE id = ${id}
		`;
		return zeile ? ausZeile(zeile) : null;
	});
}

/**
 * Die Beschlüsse einer eingespielten Versammlung — **aus dem Paket gelesen**.
 *
 * Bei jedem Aufruf neu. Das ist der Punkt: Was hier steht, ist immer das, was im
 * gesiegelten Paket steht. Eine Kopie in der Datenbank könnte sich davon
 * entfernen, ohne dass es jemand merkt.
 */
export async function holeBeschluesse(
	operatorId: Id,
	id: Id
): Promise<{ eintrag: EingespielteVersammlung; beschluesse: EingespielterBeschluss[] } | null> {
	const eintrag = await holeEingespielte1(operatorId, id);
	if (!eintrag) return null;

	const archiv = await lies(eintrag.pruefsumme);
	const dateien = entpacke(archiv);
	return {
		eintrag,
		beschluesse: beschluesseAus(
			datenAus(dateien, 'daten/abstimmungen.json'),
			datenAus(dateien, 'daten/traktanden.json')
		)
	};
}

/** Das Paket selbst, zum Herunterladen und Weitergeben. */
export async function holePaketdatei(operatorId: Id, id: Id): Promise<Uint8Array | null> {
	const eintrag = await holeEingespielte1(operatorId, id);
	if (!eintrag) return null;
	const bytes = await lies(eintrag.pruefsumme);
	// Nachgerechnet statt geglaubt: Die Ablage ist inhaltsadressiert, aber
	// geprüft wird trotzdem — sonst hinge der Nachweis daran, dass niemand die
	// Datei ausgetauscht hat.
	const ist = createHash('sha256').update(bytes).digest('hex');
	if (ist !== eintrag.pruefsumme) {
		throw new FachlicherFehler(
			'paket_veraendert',
			'Das abgelegte Paket stimmt nicht mehr mit seiner Prüfsumme überein. Es wurde in der ' +
				'Dateiablage verändert oder ersetzt.',
			'paket'
		);
	}
	return bytes;
}
