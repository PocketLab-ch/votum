import { error } from '@sveltejs/kit';
import { holePaket, holeSiegel } from '$lib/server/siegel';
import { holeVersammlung } from '$lib/server/versammlungen';
import type { RequestHandler } from './$types';

/**
 * Das Abschlusspaket zum Herunterladen (FR-51).
 *
 * Es liegt unter seiner Prüfsumme in der Ablage und wird unverändert
 * ausgeliefert — jedes Neuerzeugen ergäbe andere Bytes und damit ein anderes
 * Siegel.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const siegel = await holeSiegel(locals.benutzer.operatorId, params.id);
	if (!siegel) error(404, 'Diese Versammlung ist noch nicht versiegelt.');

	const bytes = await holePaket(locals.benutzer.operatorId, params.id);
	if (!bytes) error(404, 'Das Abschlusspaket ist nicht auffindbar.');

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="Abschlusspaket-${versammlung.datum}.zip"`,
			/*
			 * **`no-store` und nicht «unveränderlich»** (FP-2, Produktentscheid
			 * 12.11.2026). Das Paket ist zwar unverändert, doch es trägt
			 * Stimmberechtigtenstand, Anwesenheit, Vollmachten und Nachweise. Auf
			 * einem geteilten Gerät im Saal bliebe es nach dem Abmelden bis zu
			 * einem Jahr im Browser. Der Zwischenspeicher hat hier keinen Nutzen:
			 * Das Paket wird heruntergeladen, nicht in einer Seite angezeigt.
			 */
			'cache-control': 'private, no-store'
		}
	});
};
