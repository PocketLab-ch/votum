import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeAuswertung } from '$lib/server/auswertung';
import { erzeugeAuswertung } from '$lib/server/pdf/auswertung';
import { schreibeVerlauf, zeitquelle } from '$lib/server/audit';
import { alsBetreiber } from '$lib/server/db';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { RequestHandler } from './$types';

/**
 * Die Gesamtauswertung als PDF (Story 5.13, FR-42).
 *
 * Die Ausgabe steht mit Zeitpunkt im Verlauf: Sie geht an alle Eigentümer, und
 * wenn später zwei Fassungen im Umlauf sind, muss sich sagen lassen, wann welche
 * erzeugt wurde.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const auswertung = await holeAuswertung(op, params.id);
	if (!auswertung) error(404, 'Versammlung nicht gefunden');

	const gemeinschaft = await holeGemeinschaft(op, auswertung.versammlung.stwegId);

	const erzeugtAm = new Date().toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'long',
		timeStyle: 'short'
	});

	const bytes = await erzeugeAuswertung({
		versammlung: auswertung.versammlung,
		gemeinschaftName: gemeinschaft?.name ?? '',
		zaehlweise: auswertung.zaehlweise,
		stichentscheid: auswertung.stichentscheid,
		zeilen: auswertung.zeilen,
		erzeugtAm
	});

	await alsBetreiber(op, (tx) =>
		schreibeVerlauf(
			tx,
			{ operatorId: op, userId: locals.benutzer!.id, label: locals.benutzer!.displayName },
			ereignis(
				EREIGNISARTEN.auswertungErzeugt,
				{ art: 'meeting', id: params.id },
				{
					angenommen: auswertung.angenommen,
					abgelehnt: auswertung.abgelehnt,
					ohneAbstimmung: auswertung.ohneAbstimmung,
					// Ohne diese Zahl summieren sich die drei anderen nicht mehr auf die
					// Zahl der Traktanden — ein offener Stichentscheid zählt zu keiner.
					ohneErgebnis: auswertung.ohneErgebnis,
					keinBeschluss: auswertung.keinBeschluss,
					mitBeschlussvermerk: auswertung.mitBeschlussvermerk,
					quelle: zeitquelle()
				}
			)
		)
	);

	const name = `Auswertung-${auswertung.versammlung.datum}.pdf`;
	return new Response(bytes as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="${encodeURIComponent(name)}"`,
			'cache-control': 'private, no-store'
		}
	});
};
