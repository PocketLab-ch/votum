import { redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import {
	beginneAnmeldung,
	istEingerichtet,
	PRUEFER_COOKIE,
	ZUSTAND_COOKIE
} from '$lib/server/authentik';
import { herkunft } from '$lib/server/herkunft';
import type { RequestHandler } from './$types';

/**
 * Startet die Anmeldung eines **Eigentümers** über sein eigenes Konto.
 *
 * Der Zwilling von `/anmelden/authentik`, mit einem entscheidenden Unterschied:
 * Dort entsteht eine Sitzung der Bewirtschaftung (`app_user`), hier eine
 * Gerätesitzung an einem Zugang. Zwei getrennte Wege, weil es zwei getrennte
 * Rollen sind — ein Eigentümer bekommt nie ein Konto dieser Anwendung, und die
 * Sitzungsleitung nie einen Zugang zu einer Stimme.
 *
 * **Der Rückweg trägt deshalb eine eigene Adresse.** Zwei Wege, die sich
 * denselben Rückweg teilen, müssten sich am Ende fragen, wer gemeint war — und
 * die Antwort käme aus einem mitgeschickten Merkmal, das jeder ändern kann.
 * Getrennte Adressen brauchen diese Frage gar nicht erst zu stellen.
 *
 * Die kurzlebigen Kekse (Zustand, PKCE-Prüfer) sind dieselben; sie gehören zu
 * **einem** Anlauf, und mehr als einer läuft nie gleichzeitig.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	// Ohne eingerichteten Dienst gibt es den Knopf gar nicht — wer die Adresse
	// trotzdem aufruft, landet beim Eingabefeld für den Code.
	if (!istEingerichtet()) redirect(303, '/z');

	const rueckweg = `${herkunft(url)}/z/authentik/zurueck`;

	/*
	 * **`?anderes=1` fragt neu.** Wer hier mit einer offenen Authentik-Sitzung
	 * ankommt, bekommt sonst genau die Kennung zurück, mit der er ohnehin schon
	 * angemeldet ist — als Bewirtschaftung etwa die eigene, und die steht in
	 * keiner Momentaufnahme. Ohne diesen Weg führt jeder weitere Versuch an
	 * dieselbe Wand.
	 */
	let anlauf;
	try {
		anlauf = await beginneAnmeldung(rueckweg, { erneut: url.searchParams.has('anderes') });
	} catch {
		// AD-9: Ein äusserer Dienst hält die Versammlung nicht auf. Wer vor dem
		// Saal steht, braucht einen Weg hinein — hier die Karte oder den Code der
		// Sitzungsleitung.
		redirect(303, '/z?stand=authentik_aus');
	}

	const kurz = {
		path: '/z',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: keksSicher(),
		maxAge: 600
	};
	cookies.set(ZUSTAND_COOKIE, anlauf.zustand, kurz);
	cookies.set(PRUEFER_COOKIE, anlauf.pruefer, kurz);

	redirect(303, anlauf.url);
};
