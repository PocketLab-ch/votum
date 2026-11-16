import { error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { holeFassungen } from '$lib/server/protokoll';
import type { RequestHandler } from './$types';

/**
 * Der Wortlaut einer festgehaltenen Fassung (Nachprüfung 23.08.2026).
 *
 * **Der Abruf, den es nicht gab.** Die Protokollseite lädt den Wortlaut alter
 * Fassungen bewusst nicht mit — bei einem Dutzend Fassungen wären das schnell
 * hunderte Kilobyte in jeder Seitenladung, und gebraucht wird selten eine.
 * Daneben stand im Code: «gelesen wird über den eigenen Abruf». Diesen Abruf
 * hatte niemand gebaut.
 *
 * Aufgefallen ist es erst der Nachprüfung: Der Ausklapper «Fassung 1 ansehen»
 * öffnete sich, zeigte die Prüfsumme — und ein leeres Feld. Schlimmer noch, die
 * Rückfrage vor «Entwurf neu erzeugen» beruhigte mit «die festgehaltene Fassung
 * ist über die Tabelle oben erreichbar»: ein Rettungsanker, den es nicht gab.
 *
 * **Als reiner Text und nicht als JSON**: Was hier herauskommt, liest ein
 * Mensch oder legt es ab; ein Protokoll in Anführungszeichen mit `\n` dazwischen
 * wäre für beides unbrauchbar.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const nummer = Number(params.nummer);
	if (!Number.isInteger(nummer) || nummer < 1) error(400, 'Keine gültige Fassungsnummer.');

	const fassungen = await holeFassungen(locals.benutzer.operatorId, params.id);
	const fassung = fassungen.find((f) => f.nummer === nummer);
	if (!fassung) error(404, `Fassung ${nummer} gibt es zu dieser Versammlung nicht.`);

	return new Response(fassung.body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			// Im Fenster lesbar, nicht als Download: Wer vergleicht, will nebeneinander
			// legen und nicht zwei Dateien im Ordner suchen.
			'content-disposition': `inline; filename="protokoll-fassung-${nummer}.txt"`,
			// Der Abdruck reist mit, damit sich die Datei ohne zweite Abfrage
			// gegen die Angabe auf der Seite prüfen lässt.
			'x-fassung-abdruck': createHash('sha256').update(fassung.body, 'utf8').digest('hex')
		}
	});
};
