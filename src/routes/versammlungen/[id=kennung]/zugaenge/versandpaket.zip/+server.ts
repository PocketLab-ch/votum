import { error, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { erzeugeVersandpaket } from '$lib/server/versandpaket';
import { ausserAbsage } from '$lib/server/nulsperre';
import type { RequestHandler } from './$types';
import { herkunft } from '$lib/server/herkunft';

/**
 * Das Versandpaket zum Herunterladen.
 *
 * Was darin liegt und warum, steht in `$lib/server/versandpaket`. Hier bleibt
 * nur der Weg hinaus.
 *
 * POST und nicht GET, wie beim Sammel-PDF: Hier geschieht etwas Unumkehrbares —
 * die Zugangscodes entstehen dabei, und zwar alle in einem Zug.
 */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	// Ohne Formularinhalt gilt: für alle, die noch keinen Zugang haben. Das ist
	// der Regelfall, und ein Aufruf ohne Rumpf soll daran nicht scheitern.
	const daten = await request.formData().catch(ausserAbsage(new FormData()));
	const gewaehlt = daten.getAll('partei').map(String).filter(Boolean);

	// In hiesiger Zeit, nicht in UTC: Der Stempel steht später in einer
	// Dateiliste neben Uhrzeiten, die niemand umrechnet.
	const jetzt = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' });

	let paket;
	try {
		paket = await erzeugeVersandpaket(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.id,
			herkunft(url),
			gewaehlt.length > 0 ? gewaehlt : undefined,
			jetzt
		);
	} catch (fehler) {
		/*
		 * **Eine Schranke ist keine Fehlerseite** (22.08.2026, Befund B-04 des
		 * Prüflaufs). Bis hierher warf jede fachliche Absage den Verwalter mit
		 * einem nackten «400» aus der Anwendung — mitten in der Vorbereitung, und
		 * der einzige Weg zurück war die Zurück-Taste.
		 *
		 * Die häufigste Absage ist dabei gar kein Fehler, sondern eine Auskunft:
		 * «Alle gewählten Parteien haben bereits einen gültigen Zugang.» Ein
		 * bestehender Code lässt sich nicht nochmals ausdrucken — er steht nur
		 * gehasht in der Datenbank —, sondern nur ersetzen. Das gehört auf die
		 * Seite, von der aus geklickt wurde.
		 */
		if (fehler instanceof FachlicherFehler) {
			redirect(303, `/versammlungen/${params.id}/zugaenge?absage=${encodeURIComponent(fehler.kennung)}`);
		}
		throw fehler;
	}

	return new Response(paket.bytes as BodyInit, {
		headers: {
			'content-type': 'application/zip',
			// Zum Herunterladen, nicht zum Ansehen: Die Datei enthält Zugangscodes
			// und gehört nicht in den Verlauf des Browsers, den ein Kollege am selben
			// Rechner aufklappt.
			'content-disposition': `attachment; filename="${encodeURIComponent(paket.dateiname)}"`,
			'cache-control': 'private, no-store'
		}
	});
};
