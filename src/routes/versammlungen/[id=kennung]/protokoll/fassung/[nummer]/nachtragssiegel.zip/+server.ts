import { error } from '@sveltejs/kit';
import { holeNachtragspaket } from '$lib/server/nachtragssiegel';
import type { RequestHandler } from './$types';

/**
 * Eine Protokollfassung mit ihrem Nachtragssiegel (Ä-39, Migration 161).
 *
 * Wortlaut, `manifest.json` und `MANIFEST.txt` in einem ZIP, das sich im
 * Prüfwerkzeug (`/pruefen`) prüfen lässt wie das Abschlusspaket. Gebaut beim
 * Abruf aus der unveränderlichen Zeile; geprüft wird der Inhalt, nicht die
 * Bytes des Archivs.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const nummer = Number(params.nummer);
	if (!Number.isInteger(nummer) || nummer < 1 || nummer > 2_147_483_647) {
		error(400, 'Keine gültige Fassungsnummer.');
	}

	const paket = await holeNachtragspaket(locals.benutzer.operatorId, params.id, nummer);
	if (!paket) {
		error(
			404,
			`Fassung ${nummer} trägt kein Nachtragssiegel. Das tragen nur Fassungen, die nach dem Versiegeln festgehalten wurden.`
		);
	}

	return new Response(paket as BodyInit, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="protokoll-fassung-${nummer}-nachtragssiegel.zip"`
		}
	});
};
