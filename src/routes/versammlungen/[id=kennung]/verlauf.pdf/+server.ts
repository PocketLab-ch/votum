import { error } from '@sveltejs/kit';
import { holeSiegel, holeVerlaufspdf } from '$lib/server/siegel';
import { holeVersammlung } from '$lib/server/versammlungen';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { RequestHandler } from './$types';

/**
 * Den Verlauf als PDF herunterladen (Plan Beschluss von Hand, Block 3).
 *
 * **Aus dem versiegelten Paket, nicht neu erzeugt.** Das Dokument liegt als
 * `Verlauf.pdf` im Abschlusspaket und wird unverändert ausgeliefert; jedes
 * Neuerzeugen ergäbe ein anderes Dokument als das, dessen Prüfsumme das Siegel
 * deckt. Aus demselben Grund geht es erst nach dem Versiegeln heraus: Vorher
 * gibt es keinen geprüften Stand, und ein Blatt, das sich nicht gegen das
 * Manifest halten lässt, wäre als Beweismittel wertlos.
 *
 * **Herausgabe durch die Bewirtschaftung, nicht Selbstbedienung**, wie beim
 * Stimmnachweis daneben.
 *
 * **Und ohne eigenen Verlaufseintrag** (bewusster Entscheid, Codeprüfung
 * 01.10.2026). Der Stimmnachweis daneben wird bei jeder Herausgabe quittiert;
 * das Verlaufs-PDF ist dagegen Teil des Abschlusspakets und wird wie dieses
 * selbst herausgegeben. Der Paket-Download schreibt ebenfalls keine Spur.
 * Wollte man eine, wäre das ein eigener Entscheid samt Ereignisart.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const siegel = await holeSiegel(locals.benutzer.operatorId, params.id);
	if (!siegel) error(404, 'Diese Versammlung ist noch nicht versiegelt.');

	let blatt;
	try {
		blatt = await holeVerlaufspdf(locals.benutzer.operatorId, params.id);
	} catch (fehler) {
		// Ein beschädigtes Paket ist kein «nicht gefunden». Die Auskunft ist die
		// Meldung selbst, und sie sagt ausdrücklich, das Dokument nicht
		// weiterzugeben.
		if (fehler instanceof FachlicherFehler) error(409, fehler.message);
		throw fehler;
	}
	if (!blatt) error(404, 'Das Paket dieser Versammlung trägt keinen Verlauf als PDF.');

	return new Response(blatt.inhalt as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="Verlauf-${versammlung.datum}.pdf"`,
			// Kein Zwischenspeicher: Ausgeliefert wird der versiegelte Stand.
			'cache-control': 'private, no-store'
		}
	});
};
