import { error } from '@sveltejs/kit';
import { dosZeitstempel } from '$lib/domain/archiv';
import { alsWorddokument } from '$lib/domain/docx';
import { abendfusszeile } from '$lib/domain/protokoll';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { holeVersammlungstag } from '$lib/server/versammlungstag';
import type { RequestHandler } from './$types';

/**
 * Das Protokoll des Abends als Word-Dokument.
 *
 * **Beide Formate, damit alle Wege offen bleiben** (Auftraggeber, 12.08.2026: «Auch
 * Docx. Und beim Einzel auch PDF. So hat man alle Optionen offen.»). Das PDF ist
 * die Fassung zum Signieren, Word die zum Nachbearbeiten: Briefkopf,
 * Unterschriftenzeilen, die Eigenheiten jeder Bewirtschaftung. Welcher Weg der
 * richtige ist, entscheidet der Fall — nicht die Anwendung.
 *
 * **Derselbe Text, derselbe Setzer wie beim Protokoll der Einzelversammlung**
 * (`domain/docx.ts`). Zwei Wege zu einem Word-Dokument liefen beim ersten
 * Feinschliff auseinander.
 *
 * **Kein Verlaufseintrag**, anders als beim Protokoll des Hauses: Dort hängt die
 * Ausgabe an einer gespeicherten Fassung, deren Stand sich belegen lässt. Das
 * Protokoll des Abends wird nicht gespeichert (siehe `protokoll/+page.server.ts`)
 * — ein Eintrag «als Word ausgegeben» verwiese auf nichts.
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

	// Dieselbe Wahl wie auf der Seite und im PDF — sie kommt über die Adresse mit.
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
	const bytes = alsWorddokument(
		zusammenstellung.text,
		dosZeitstempel(new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })),
		// Denselben Satz trägt das PDF. Der Entwurfsvermerk gehört auf jedes Blatt.
		abendfusszeile({
			bezeichnung: tag.bezeichnung,
			datum: tag.datum,
			stand: erzeugtAm,
			luecke: zusammenstellung.luecke
		})
	);

	const name = zusammenstellung.luecke
		? `Protokoll-Entwurf-Abend-${tag.datum}.docx`
		: `Protokoll-Abend-${tag.datum}.docx`;

	return new Response(bytes as BodyInit, {
		headers: {
			'content-type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'content-disposition': `attachment; filename="${name}"`,
			'cache-control': 'no-store'
		}
	});
};
