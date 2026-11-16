import { error } from '@sveltejs/kit';
import { holeOffeneAbgabe } from '$lib/server/abgabe';
import { holeVersammlung } from '$lib/server/versammlungen';
import { lies } from '$lib/server/dateien';
import type { RequestHandler } from './$types';

/**
 * Das Vorbereitungspaket zum Herunterladen.
 *
 * **Verschlüsselt, und deshalb mit eigener Endung.** Wer die Datei findet, kann
 * ohne den Leihschlüssel nichts damit anfangen; ein `.zip` zu nennen, was sich
 * nicht entpacken lässt, wäre nur verwirrend.
 *
 * Es wird unverändert aus der Ablage geliefert und nicht neu erzeugt: Ein
 * zweites Erzeugen ergäbe andere Bytes, einen anderen Zufallsvorspann und damit
 * ein Paket, das nicht mehr zum Leihschein passt.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const abgabe = await holeOffeneAbgabe(locals.benutzer.operatorId, params.id);
	if (!abgabe) error(404, 'Diese Versammlung ist nicht abgegeben.');

	const bytes = await lies(abgabe.paketPruefsumme).catch(() => null);
	if (!bytes) error(404, 'Das Vorbereitungspaket ist nicht auffindbar.');

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-disposition': `attachment; filename="Vorbereitung-${versammlung.datum}.votum"`,
			/*
			 * **`no-store` und nicht «unveränderlich»** (18.09.2026, aus dem
			 * Code-Review). Hier stand `max-age=1 Jahr, immutable`, weil das Paket
			 * inhaltsadressiert ist und sich nie ändert. Die **Adresse** ändert sich
			 * aber sehr wohl: Sie trägt keine Prüfsumme, sondern die Versammlung.
			 * Wer zurücknimmt und an ein anderes Gerät neu abgibt, bekäme aus dem
			 * Zwischenspeicher das alte Paket — verschlüsselt für das alte Gerät,
			 * und das neue kann es nicht öffnen. Der Fehler fiele im Saal auf.
			 */
			'cache-control': 'no-store'
		}
	});
};
