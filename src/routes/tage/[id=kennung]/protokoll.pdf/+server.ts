import { error } from '@sveltejs/kit';
import { abendfusszeile } from '$lib/domain/protokoll';
import { erzeugeProtokollPdf } from '$lib/server/pdf/protokoll';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { holeVersammlungstag } from '$lib/server/versammlungstag';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll des Abends als PDF — die Fassung, die signiert wird.
 *
 * **Wozu es das PDF gibt.** Der Auftraggeber am 12.08.2026: «Das Protokoll muss rechtsgültig
 * sein. Ich kann das PDF dann digital mit Skribble signieren. FES oder QES.» Die
 * Signatur wird ausserhalb angebracht; die Anwendung liefert das Dokument, das
 * sie trägt.
 *
 * **Derselbe Setzer wie beim Protokoll einer einzelnen Versammlung**
 * (`pdf/protokoll.ts`). Zwei Setzer nebeneinander liefen beim ersten Feinschliff
 * auseinander, und dann sähe das Protokoll des Abends anders aus als das des
 * Hauses — bei zwei Dokumenten über dieselbe Sitzung fiele das auf.
 *
 * **Ein Entwurf wird mitgeliefert, nicht verweigert.** Wer prüfen will, was
 * fehlt, druckt ihn aus; das Dokument sagt in Titel, Kopf und Schluss, dass es
 * so nicht zu unterzeichnen ist (`domain/gemeinsamesprotokoll.ts`). Eine Sperre
 * hier hülfe nichts — der Text lässt sich ohnehin kopieren — und nähme den
 * Nutzen für die Durchsicht.
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

	// Dieselbe Wahl wie auf der Seite — sie kommt über die Adresse mit, damit
	// Bildschirm und PDF dasselbe Dokument zeigen.
	const zusammenstellung = await stelleAbendzusammenstellungZusammen(
		locals.benutzer.operatorId,
		params.id,
		erzeugtAm,
		locals.benutzer.displayName,
		url.searchParams.get('unterschrift') !== 'ohne'
	);
	if (!zusammenstellung) error(404, 'Gemeinsame Versammlung nicht gefunden');

	// Die Fusszeile trägt den Entwurfsvermerk mit: Sie steht auf **jedem** Blatt.
	// Denselben Satz setzt die Word- und die OpenDocument-Ausgabe (`abendfusszeile`).
	const fuss = abendfusszeile({
		bezeichnung: tag.bezeichnung,
		datum: tag.datum,
		stand: erzeugtAm,
		luecke: zusammenstellung.luecke
	});

	const bytes = await erzeugeProtokollPdf(zusammenstellung.text, fuss);

	const name = zusammenstellung.luecke
		? `Protokoll-Entwurf-Abend-${tag.datum}.pdf`
		: `Protokoll-Abend-${tag.datum}.pdf`;

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="${name}"`,
			'cache-control': 'no-store'
		}
	});
};
