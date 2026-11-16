import { redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { merkmalStimmt, sicheresZiel } from '$lib/domain/anmeldewege';
import { legeSitzungAn, SITZUNGS_COOKIE } from '$lib/server/auth';
import { SITZUNGSDAUER_SEKUNDEN } from '$lib/domain/anmeldeschutz';
import {
	findeBenutzer,
	holePerson,
	OIDC_KEKSPFAD,
	PRUEFER_COOKIE,
	ZIEL_COOKIE,
	ZUSTAND_COOKIE
} from '$lib/server/authentik';
import type { RequestHandler } from './$types';
import { herkunft } from '$lib/server/herkunft';

/**
 * Der Rückweg von Authentik.
 *
 * Reihenfolge der Prüfungen ist Absicht: erst das Zustandsmerkmal, dann der
 * Code. Wer den Rückweg von aussen anstösst, kommt so nicht einmal bis zum
 * Tausch des Codes.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	const zustand = cookies.get(ZUSTAND_COOKIE);
	const pruefer = cookies.get(PRUEFER_COOKIE);
	const ziel = sicheresZiel(cookies.get(ZIEL_COOKIE));

	// Die Merkmale gehören zu genau einem Anlauf und werden sofort weggeräumt —
	// auch wenn es schiefgeht, damit ein zweiter Versuch nicht auf einem alten
	// Prüfer aufsetzt.
	for (const k of [ZUSTAND_COOKIE, PRUEFER_COOKIE, ZIEL_COOKIE]) {
		cookies.delete(k, { path: OIDC_KEKSPFAD, secure: keksSicher() });
	}

	if (url.searchParams.get('error')) {
		// Authentik hat abgelehnt — etwa weil die Person keine Berechtigung hat.
		redirect(303, '/anmelden?fehler=abgelehnt');
	}

	if (!merkmalStimmt(zustand, url.searchParams.get('state'))) {
		redirect(303, '/anmelden?fehler=merkmal');
	}

	const code = url.searchParams.get('code');
	if (!code || !pruefer) redirect(303, '/anmelden?fehler=unvollstaendig');

	let benutzer;
	try {
		const person = await holePerson(code, pruefer, `${herkunft(url)}/anmelden/authentik/zurueck`);
		benutzer = await findeBenutzer(person);
	} catch {
		redirect(303, '/anmelden?fehler=nicht_erreichbar');
	}

	// Kein Konto wird angelegt: Wer sich bei Authentik anmelden kann, ist damit
	// noch nicht berechtigt, eine Versammlung zu führen.
	if (!benutzer) redirect(303, '/anmelden?fehler=kein_konto');

	const merkmal = await legeSitzungAn(benutzer, 'authentik');

	cookies.set(SITZUNGS_COOKIE, merkmal, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: keksSicher(),
		maxAge: SITZUNGSDAUER_SEKUNDEN
	});

	redirect(303, ziel);
};
