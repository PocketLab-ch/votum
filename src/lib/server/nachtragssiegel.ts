/**
 * Nachtragssiegel je Protokollfassung (Ä-39, Migration 161) — Schale.
 *
 * Die Form und die Prüfung der Kette stehen im Kern
 * (`$lib/domain/nachtragssiegel`). Hier wird gerechnet, gelesen und gepackt.
 * Geschrieben wird das Siegel nicht hier, sondern in derselben Anweisung wie
 * die Fassung (`halteFassungFest`), damit es weder fehlen noch nachkommen kann;
 * hier steht nur, was dafür unter derselben Sperre zu lesen und zu bauen ist.
 */
import postgres from 'postgres';
import { createHash } from 'node:crypto';
import { alsBetreiber } from './db';
import { zeitquelle } from './audit';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import type { Manifest } from '$lib/domain/siegel';
import {
	fassungsdatei,
	istNachtragsmanifest,
	nachtragsmanifestAlsJson,
	nachtragsmanifestInWorten,
	pruefeKette,
	type Kettenbefund,
	type Nachtragsmanifest
} from '$lib/domain/nachtragssiegel';
import type { Id } from '$lib/domain/types';

function sha256(inhalt: string | Uint8Array): string {
	return createHash('sha256').update(inhalt).digest('hex');
}

const kodierer = new TextEncoder();

/** Was ein Nachtragssiegel an der Zeile trägt. */
export interface Nachtragsspalten {
	manifest: string;
	siegel: string;
	vorgaenger: string;
}

/**
 * Baut das Nachtragssiegel einer neuen Fassung, oder `null`, wenn die
 * Versammlung nicht versiegelt ist.
 *
 * **Muss unter der Sperre der Versammlung laufen** (`FOR UPDATE`, wie in
 * `halteFassungFest`): Das vorige Siegel wird hier gelesen, und zwischen Lesen
 * und Schreiben darf keine andere Fassung dazwischenkommen. Der eindeutige
 * Index in Migration 161 fängt es sonst ab, aber als Fehler statt als Warten.
 */
export async function baueNachtragssiegel(
	tx: postgres.TransactionSql,
	meetingId: Id,
	fassung: {
		nummer: number;
		art: string;
		bemerkung: string | null;
		body: string;
		festgehaltenAm: string;
		festgehaltenDurch: string;
	}
): Promise<Nachtragsspalten | null> {
	const [grund] = await tx<{ manifest: string; manifest_hash: string }[]>`
		SELECT manifest, manifest_hash FROM seal WHERE meeting_id = ${meetingId}
	`;
	if (!grund) return null;

	const [letzte] = await tx<{ number: number; seal_hash: string }[]>`
		SELECT number, seal_hash FROM minutes_version
		 WHERE meeting_id = ${meetingId} AND seal_hash IS NOT NULL
		 ORDER BY number DESC LIMIT 1
	`;

	// Gemeinschaft und Versammlung, wie sie das erste Siegel festhält: Die
	// Kette spricht von derselben Versammlung, nicht von ihrem heutigen Stand.
	const erstes = JSON.parse(grund.manifest) as Manifest;
	const manifest: Nachtragsmanifest = {
		fassung: 1,
		art: 'nachtragssiegel',
		gemeinschaft: erstes.gemeinschaft,
		versammlung: erstes.versammlung,
		grundsiegel: grund.manifest_hash,
		vorgaenger: letzte
			? { siegel: letzte.seal_hash, was: 'protokollfassung', nummer: letzte.number }
			: { siegel: grund.manifest_hash, was: 'abschlusspaket', nummer: null },
		protokollfassung: {
			nummer: fassung.nummer,
			art: fassung.art,
			bemerkung: fassung.bemerkung,
			festgehaltenAm: fassung.festgehaltenAm,
			festgehaltenDurch: fassung.festgehaltenDurch
		},
		zeitquelle: zeitquelle(),
		eintraege: [
			{
				pfad: fassungsdatei(fassung.nummer),
				groesse: kodierer.encode(fassung.body).byteLength,
				pruefsumme: sha256(kodierer.encode(fassung.body)),
				beschreibung: `Der Wortlaut der Protokollfassung Nr. ${fassung.nummer}, wie er festgehalten wurde.`
			}
		]
	};
	const text = nachtragsmanifestAlsJson(manifest);
	return { manifest: text, siegel: sha256(kodierer.encode(text)), vorgaenger: manifest.vorgaenger.siegel };
}

/**
 * Rechnet die ganze Kette einer Versammlung aus der Datenbank nach.
 *
 * `null`, wenn die Versammlung kein Siegel hat. Fassungen, die nach dem Siegel
 * und ohne Nachtragssiegel festgehalten wurden (vor Migration 161), stehen
 * getrennt da: Sie brechen die Kette nicht, gehören aber nicht zu ihr.
 */
export async function pruefeKetteDerVersammlung(
	operatorId: Id,
	meetingId: Id
): Promise<(Kettenbefund & { ohneSiegel: number[] }) | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [grund] = await tx<{ manifest: string; manifest_hash: string; sealed_at: Date }[]>`
			SELECT manifest, manifest_hash, sealed_at FROM seal WHERE meeting_id = ${meetingId}
		`;
		if (!grund) return null;
		const zeilen = await tx<
			{
				number: number;
				body: string;
				frozen_at: Date;
				seal_manifest: string | null;
				seal_hash: string | null;
				seal_previous: string | null;
			}[]
		>`
			SELECT number, body, frozen_at, seal_manifest, seal_hash, seal_previous
			  FROM minutes_version WHERE meeting_id = ${meetingId}
			 ORDER BY number
		`;
		const glieder = zeilen
			.filter((z) => z.seal_hash !== null)
			.map((z) => {
				let manifest: Nachtragsmanifest | null = null;
				try {
					const gelesen: unknown = JSON.parse(z.seal_manifest as string);
					manifest = istNachtragsmanifest(gelesen) ? gelesen : null;
				} catch {
					manifest = null;
				}
				return {
					nummer: z.number,
					textPruefsumme: sha256(kodierer.encode(z.body)),
					manifest,
					manifestPruefsumme: sha256(kodierer.encode(z.seal_manifest as string)),
					siegel: z.seal_hash as string,
					vorgaenger: z.seal_previous as string
				};
			});
		const befund = pruefeKette(
			{ siegel: grund.manifest_hash, manifestPruefsumme: sha256(kodierer.encode(grund.manifest)) },
			glieder
		);
		const ohneSiegel = zeilen
			.filter((z) => z.seal_hash === null && z.frozen_at > grund.sealed_at)
			.map((z) => z.number);
		return { ...befund, ohneSiegel };
	});
}

/**
 * Das Paket einer Fassung mit Nachtragssiegel: Wortlaut, `manifest.json` und
 * `MANIFEST.txt`. `null`, wenn die Fassung keines trägt.
 *
 * **Gebaut beim Abruf, nicht abgelegt.** Wortlaut und Manifest stehen
 * unveränderlich in der Zeile; das ZIP ist nur ihre Verpackung. Geprüft wird
 * der Inhalt, nicht die Bytes des Archivs (`paketpruefung.ts`).
 */
export async function holeNachtragspaket(
	operatorId: Id,
	meetingId: Id,
	nummer: number
): Promise<Uint8Array | null> {
	const [z] = await alsBetreiber(
		operatorId,
		(tx) => tx<{ body: string; frozen_at: Date; seal_manifest: string | null; seal_hash: string | null }[]>`
			SELECT body, frozen_at, seal_manifest, seal_hash FROM minutes_version
			 WHERE meeting_id = ${meetingId} AND number = ${nummer}
		`
	);
	if (!z?.seal_manifest || !z.seal_hash) return null;
	const manifest = JSON.parse(z.seal_manifest) as Nachtragsmanifest;
	return packe(
		[
			{ name: fassungsdatei(nummer), inhalt: kodierer.encode(z.body) },
			{ name: 'manifest.json', inhalt: kodierer.encode(z.seal_manifest) },
			{ name: 'MANIFEST.txt', inhalt: kodierer.encode(nachtragsmanifestInWorten(manifest, z.seal_hash)) }
		],
		dosZeitstempel(z.frozen_at.toISOString())
	);
}
