import { error } from '@sveltejs/kit';
import { dosZeitstempel } from '$lib/domain/archiv';
import { alsOpenDocument, ODT_MEDIENTYP } from '$lib/domain/odt';
import { abendfusszeile } from '$lib/domain/protokoll';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { holeVersammlungstag } from '$lib/server/versammlungstag';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll des Abends als OpenDocument-Text.
 *
 * **Alle Wege offen** (Auftraggeber, 12.08.2026: «Auch Docx. Und beim Einzel auch PDF.
 * So hat man alle Optionen offen.», ergänzt am 05.09.2026 um das
 * OpenDocument-Format). Das PDF ist die Fassung zum Signieren, Word und
 * OpenDocument sind die zum Nachbearbeiten — welches der beiden das Haus
 * verwendet, entscheidet das Haus.
 *
 * **Derselbe Text, dieselbe Zerlegung wie beim Word-Dokument**
 * (`domain/protokollauszeichnung.ts`). Zwei Wege zu einem Bürodokument liefen
 * beim ersten Feinschliff auseinander.
 *
 * **Kein Verlaufseintrag**, anders als beim Protokoll des Hauses: Dort hängt die
 * Ausgabe an einer gespeicherten Fassung, deren Stand sich belegen lässt. Das
 * Protokoll des Abends wird nicht gespeichert (siehe `protokoll/+page.server.ts`)
 * — ein Eintrag «als OpenDocument ausgegeben» verwiese auf nichts.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const tag = await holeVersammlungstag(locals.benutzer.operatorId, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const erzeugtAm = new Date().toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	// Dieselbe Wahl wie auf der Seite und in den anderen Ausgaben — sie kommt
	// über die Adresse mit.
	const zusammenstellung = await stelleAbendzusammenstellungZusammen(
		locals.benutzer.operatorId,
		params.id,
		erzeugtAm,
		locals.benutzer.displayName,
		url.searchParams.get('unterschrift') !== 'ohne'
	);
	if (!zusammenstellung) error(404, 'Gemeinsame Versammlung nicht gefunden');

	// In hiesiger Zeit, nicht in UTC: Der Stempel steht später in einer
	// Dateiliste neben Uhrzeiten, die niemand umrechnet (AD-12).
	const bytes = alsOpenDocument(
		zusammenstellung.text,
		dosZeitstempel(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })),
		// Denselben Satz tragen das PDF und das Word-Dokument.
		abendfusszeile({
			bezeichnung: tag.bezeichnung,
			datum: tag.datum,
			stand: erzeugtAm,
			luecke: zusammenstellung.luecke
		})
	);

	const name = zusammenstellung.luecke
		? `Protokoll-Entwurf-Abend-${tag.datum}.odt`
		: `Protokoll-Abend-${tag.datum}.odt`;

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': ODT_MEDIENTYP,
			'content-disposition': `attachment; filename="${name}"`,
			'cache-control': 'no-store'
		}
	});
};
