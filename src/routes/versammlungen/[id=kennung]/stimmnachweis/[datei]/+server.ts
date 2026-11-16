import { error } from '@sveltejs/kit';
import { holeSiegel, holeStimmnachweis } from '$lib/server/siegel';
import { holeVersammlung } from '$lib/server/versammlungen';
import { schreibeVerlauf } from '$lib/server/audit';
import { alsBetreiber } from '$lib/server/db';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { RequestHandler } from './$types';

/**
 * Ein einzelner Stimmnachweis zum Herunterladen (S-4, Vorgabe des Auftraggebers 22.09.2026).
 *
 * **Herausgabe durch die Bewirtschaftung, nicht Selbstbedienung** (Entscheid
 * Auftraggeber, 22.09.2026). Ein Eigentümer fragt, jemand mit Konto gibt das Blatt
 * heraus. Der Eigentümerzugang läuft über `/z` mit Zugangscode und kommt hier
 * nicht vorbei; das Blatt trägt alle Namen dieses Traktandums, nicht nur den
 * des Fragenden.
 *
 * **Warum es diesen Weg überhaupt gibt und nicht nur das ganze Paket.** Das
 * Paket trägt den ganzen Abend. Im Streit um ein Traktandum geht ein Blatt
 * heraus, und seine Prüfsumme steht einzeln im Manifest: Es lässt sich prüfen,
 * ohne dass die übrigen herausgehen. Genau dafür ist es eine Datei je
 * Traktandum.
 *
 * **Jede Herausgabe steht im Verlauf.** Wer ein Blatt mit Namen weitergibt, tut
 * eine fachlich bedeutsame Handlung, und «wer hat das wann bekommen» ist im
 * Streit eine Frage, die sonst niemand mehr beantworten kann.
 *
 * **Genau genommen bezeugt der Eintrag «wem wurde es wann geschickt»**, nicht
 * «wer hat es bekommen»: Bricht die Übertragung ab, steht er trotzdem da. Die
 * andere Richtung ist ausgeschlossen, und das ist die wichtigere: Schlägt das
 * Schreiben fehl, wirft es, und dann geht kein Blatt heraus. Kein Blatt ohne
 * Spur, eher eine Spur ohne Blatt.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const siegel = await holeSiegel(locals.benutzer.operatorId, params.id);
	if (!siegel) error(404, 'Diese Versammlung ist noch nicht versiegelt.');

	let blatt;
	try {
		blatt = await holeStimmnachweis(locals.benutzer.operatorId, params.id, params.datei);
	} catch (fehler) {
		// Ein beschädigtes Paket ist kein «nicht gefunden». Die Auskunft ist
		// die Meldung selbst, und sie sagt ausdrücklich, das Blatt nicht
		// weiterzugeben.
		if (fehler instanceof FachlicherFehler) error(409, fehler.message);
		throw fehler;
	}
	if (!blatt) error(404, 'Zu diesem Traktandum liegt kein Stimmnachweis im Paket.');

	await alsBetreiber(locals.benutzer.operatorId, async (tx) => {
		await schreibeVerlauf(
			tx,
			{
				operatorId: locals.benutzer!.operatorId,
				userId: locals.benutzer!.id,
				label: locals.benutzer!.displayName
			},
			ereignis(EREIGNISARTEN.stimmnachweisHerausgegeben, { art: 'meeting', id: params.id }, {
				// Der Pfad sagt, welches Traktandum. Die Namen auf dem Blatt
				// stehen ausdrücklich nicht im Verlauf: Er ist selbst eine
				// Datei, die weitergereicht wird.
				pfad: blatt!.pfad,
				pruefsumme: blatt!.pruefsumme
			})
		);
	});

	return new Response(blatt.inhalt as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="Stimmnachweis-${versammlung.datum}-T${blatt.traktandum}.pdf"`,
			// Kein Zwischenspeicher: Jede Herausgabe soll durch den Verlauf
			// gehen, nicht aus einem Puffer beantwortet werden.
			'cache-control': 'no-store'
		}
	});
};
