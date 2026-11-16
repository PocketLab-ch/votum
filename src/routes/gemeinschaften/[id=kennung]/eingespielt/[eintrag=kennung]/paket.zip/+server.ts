import { error } from '@sveltejs/kit';
import { holeEingespielte1, holePaketdatei } from '$lib/server/einspielen';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { RequestHandler } from './$types';

/**
 * Das aufgenommene Paket herunterladen — unverändert.
 *
 * Genau dieselben Bytes, die eingespielt wurden. Wer prüfen will, ob hier
 * dasselbe liegt wie damals im Saal, lädt es und rechnet auf der Prüfseite nach.
 * Ohne diesen Weg wäre die Aufnahme eine Einbahnstrasse — und ein Nachweis, den
 * man nicht herausgeben kann, ist im Streitfall keiner.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const eintrag = await holeEingespielte1(locals.benutzer.operatorId, params.eintrag);
	if (!eintrag || eintrag.stwegId !== params.id) error(404, 'Nicht gefunden');

	let bytes: Uint8Array | null;
	try {
		bytes = await holePaketdatei(locals.benutzer.operatorId, params.eintrag);
	} catch (fehler) {
		// Die Prüfsumme stimmt nicht mehr: Das ist kein Fehler der Anfrage,
		// sondern ein Befund über die Ablage — und er gehört gesagt, nicht als
		// leerer Download getarnt.
		if (fehler instanceof FachlicherFehler) error(409, fehler.message);
		throw fehler;
	}
	if (!bytes) error(404, 'Nicht gefunden');

	const name = `Abschlusspaket-${eintrag.manifest.versammlung.datum}.zip`;
	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${name}"`,
			'cache-control': 'no-store'
		}
	});
};
