import { error } from '@sveltejs/kit';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeZeitstempeldatei } from '$lib/server/zeitstempel';
import type { RequestHandler } from './$types';

/**
 * Die Antwort des Zeitstempeldienstes zum Herunterladen (FR-53).
 *
 * **Warum als eigene Datei neben dem Paket.** Sie entsteht erst, wenn das Paket
 * fertig ist, und bezeugt dessen Prüfsumme. Ins Paket gelegt würde sie genau
 * diese Prüfsumme ändern und damit ihre eigene Aussage zerstören.
 *
 * Die Datei ist ein gewöhnlicher Zeitstempel nach RFC 3161. Sie lässt sich ohne
 * diese Anwendung prüfen, etwa mit
 * `openssl ts -verify -in zeitstempel.tsr -digest <Siegel> -CAfile <Kette>`.
 *
 * **`-digest`, nicht `-data`** (22.09.2026). Hier stand `-data Abschlusspaket.zip`,
 * und das widersprach allem anderen im Haus: `einVersuch` setzt den Abdruck der
 * Anfrage auf `Buffer.from(siegel, 'hex')`, also auf die Prüfsumme über
 * `manifest.json`. Wer dem alten Satz folgte, liess OpenSSL das ZIP hashen und
 * bekam «message imprint mismatch» — an einem Stempel, der in Ordnung ist. Der
 * Vergleichswert ist das Siegel, und es steht in `MANIFEST.txt` unter Schritt 2.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const bytes = await holeZeitstempeldatei(locals.benutzer.operatorId, params.id);
	if (!bytes) error(404, 'Für diese Versammlung liegt kein Zeitstempel vor.');

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/timestamp-reply',
			'content-disposition': `attachment; filename="Zeitstempel-${versammlung.datum}.tsr"`,
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};
