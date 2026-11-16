import { redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { sicheresZiel } from '$lib/domain/anmeldewege';
import {
	beginneAnmeldung,
	istEingerichtet,
	OIDC_KEKSPFAD,
	PRUEFER_COOKIE,
	ZIEL_COOKIE,
	ZUSTAND_COOKIE
} from '$lib/server/authentik';
import type { RequestHandler } from './$types';
import { herkunft } from '$lib/server/herkunft';

/**
 * Startet die Anmeldung bei Authentik.
 *
 * Zustandsmerkmal und PKCE-Prüfer landen in kurzlebigen, streng gesetzten
 * Keksen: Sie gehören zu diesem einen Anlauf und dürfen ihn nicht überleben.
 * In einer Sitzung im Speicher zu halten ginge auch — aber dann bräuchte es
 * eine Sitzung, bevor jemand angemeldet ist, und genau das soll es nicht geben.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!istEingerichtet()) redirect(303, '/anmelden?fehler=nicht_eingerichtet');

	const rueckweg = `${herkunft(url)}/anmelden/authentik/zurueck`;

	let anlauf;
	try {
		anlauf = await beginneAnmeldung(rueckweg);
	} catch {
		// Nicht erreichbar oder falsch eingerichtet: zurück zur Anmeldeseite, die
		// dann die lokale Anmeldung anbietet (AD-9). Kein Fehlerbildschirm — wer
		// vor dem Saal steht, braucht einen Weg hinein, keine Diagnose.
		redirect(303, '/anmelden?fehler=nicht_erreichbar');
	}

	const kurz = {
		path: OIDC_KEKSPFAD,
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: keksSicher(),
		maxAge: 600
	};
	cookies.set(ZUSTAND_COOKIE, anlauf.zustand, kurz);
	cookies.set(PRUEFER_COOKIE, anlauf.pruefer, kurz);
	cookies.set(ZIEL_COOKIE, sicheresZiel(url.searchParams.get('weiter')), kurz);

	redirect(303, anlauf.url);
};
