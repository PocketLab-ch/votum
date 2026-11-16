import { error } from '@sveltejs/kit';
import { lies, DateiFehler } from '$lib/server/dateien';
import { holeAnhangsangaben } from '$lib/server/anhaenge';
import type { RequestHandler } from './$types';

/**
 * Liefert einen Anhang aus.
 *
 * Zweimal geprüft, bevor etwas das Haus verlässt: Der Anhangseintrag wird im
 * Mandantenkontext gesucht — wer den Betreiber wechselt, findet ihn nicht — und
 * die Prüfsumme muss reines Hexadezimal sein, damit aus ihr kein Pfad wird.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const angaben = await holeAnhangsangaben(locals.benutzer.operatorId, params.pruefsumme);
	if (!angaben) error(404, 'Anhang nicht gefunden');

	try {
		const inhalt = await lies(params.pruefsumme);
		return new Response(inhalt as BodyInit, {
			headers: {
				'content-type': angaben.art,
				// `inline` würde ein PDF im Browser öffnen; das ist hier erwünscht,
				// der Name bleibt für das Speichern erhalten.
				'content-disposition': `inline; filename="${encodeURIComponent(angaben.name)}"`,
				/*
				 * **`no-store` und nicht «unveränderlich»** (FP-2, Produktentscheid
				 * 12.11.2026). Ein Anhang kann Vollmachts- und
				 * Nutzniessungsnachweise mit Personendaten tragen; auf einem
				 * geteilten Gerät bliebe er nach dem Abmelden bis zu einem Jahr im
				 * Browser. Er wird nirgends eingebettet, sondern nur verlinkt; der
				 * Zwischenspeicher spart deshalb keinen Seitenaufbau.
				 */
				'cache-control': 'private, no-store'
			}
		});
	} catch (fehler) {
		if (fehler instanceof DateiFehler) error(400, fehler.message);
		error(404, 'Datei nicht auffindbar');
	}
};
