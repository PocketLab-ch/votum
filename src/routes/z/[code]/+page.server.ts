import { redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { normalisiere } from '$lib/domain/zugang';
import { loeseZugangAuf } from '$lib/server/anwesenheit';
import { holeVersammlung } from '$lib/server/versammlungen';
import {
	KARTENKEKS,
	KARTENKEKS_PFAD,
	setzeKartenscan
} from '$lib/server/zugangssitzung';
import type { PageServerLoad } from './$types';

/**
 * Der Weg von der Karte: Code merken, dann weiter zu `/z`.
 *
 * **Eingelöst wird hier nicht mehr** (FP-1, 12.11.2026). Früher löste dieses
 * `load` den Code sofort ein. Je Zugang ist nur ein Gerät zugelassen;
 * damit belegte jeder Abruf des Links den Zugang (der Vorschau-Bot eines
 * Messengers, ein Mailprogramm, ein Crawler), und der Eigentümer kam mit
 * seiner eigenen Karte nicht mehr hinein. Jetzt wandert der Code in einen
 * kurzlebigen, für Skripte unlesbaren Keks, und `/z` schickt das Formular zum
 * Einlösen selbst ab: mit JavaScript ohne Tipp, solange die Versammlung läuft,
 * vor Beginn und ohne JavaScript mit einem Knopf «Anmelden» (FP-1b). Erst
 * dieser POST löst ein.
 *
 * Der Code verschwindet dabei aus der Adresszeile. Vorher blieb er dort stehen —
 * im Verlauf des Browsers, sichtbar für jeden, der aufs Display schaut, und noch
 * da, wenn das Telefon herumgereicht wird. Jetzt liegt er in einem Keks, den
 * kein Skript lesen kann.
 *
 * Auch ein Code, der nicht greift, führt nach `/z` (seit FP-1 über die Aktion
 * `karte` auf `/z`, im Zweig der Sitzungsleitung weiter von hier aus): Dort steht die Meldung samt
 * Eingabefeld, und wer sich vertippt hat, kann es gleich richtigstellen. Der
 * **Grund** wandert als Kennwort in der Adresse mit — ohne ihn stünde nach dem
 * Abscannen wortlos ein leeres Eingabefeld da, und niemand wüsste, dass bereits
 * ein Gerät angemeldet ist. Der Code selbst wandert nicht mit; er soll ja gerade
 * aus der Adresszeile verschwinden.
 *
 * ## Wenn die Sitzungsleitung scannt
 *
 * Gefragt am 02.08.2026: «Wenn ich mit der Fotoapp als Versammlungsleiter den
 * Code scanne, geschieht was? Ich müsste den Code scannen können, ohne händisch
 * den Code in Anwesenheit einzutippen.»
 *
 * Bisher geschah das Falsche, und zwar still: Die Kamera öffnete diese Adresse,
 * der Code wurde **eingelöst**, und das Gerät der Sitzungsleitung galt fortan
 * als das Gerät dieses Eigentümers. Weil je Zugang nur ein Gerät zugelassen ist,
 * kam der Eigentümer danach selbst nicht mehr hinein — mit seiner eigenen Karte
 * in der Hand.
 *
 * Deshalb wird zuerst gefragt, wer da scannt. Ist es eine angemeldete
 * Sitzungsleitung, wird **nichts** eingelöst. Der Code wandert in einen
 * kurzlebigen Keks, und die Anwesenheitsseite fragt: «Anna Muster als anwesend
 * erfassen?» Ein Tipp, fertig — und die Karte des Eigentümers bleibt seine.
 */
export const load: PageServerLoad = async ({ cookies, locals, params }) => {
	if (locals.benutzer) {
		const code = normalisiere(params.code);
		const befund = await loeseZugangAuf(locals.benutzer.operatorId, code);

		// Nur für die eigene Versammlung. Eine fremde Karte verrät hier so wenig
		// wie anderswo — sie führt denselben Weg wie eine unbekannte.
		if (befund.gueltig && befund.meetingId) {
			const v = await holeVersammlung(locals.benutzer.operatorId, befund.meetingId);
			if (v) {
				cookies.set(KARTENKEKS, code, {
					path: KARTENKEKS_PFAD,
					httpOnly: true,
					sameSite: 'lax',
					secure: keksSicher(),
					// Zwei Minuten: genug für den Weg vom Scannen zur Rückfrage. Ein
					// Code, der länger herumliegt, ist ein Code, der herumliegt.
					maxAge: 120
				});
				/*
				 * **Auf die schmale Einlass-Seite**, nicht auf die Anwesenheitssicht.
				 *
				 * Wer mit der Kamera-App scannt, hält ein Telefon in der Hand und hat
				 * jemanden vor sich stehen. Auf der grossen Seite stand die
				 * Kontrollkarte 935 px unter dem Anfang — im Bild, aber ungesehen, und
				 * es sah aus, als sei nichts passiert (20.08.2026 nachgemessen). Hier
				 * steht sie zuoberst.
				 */
				redirect(303, `/versammlungen/${v.id}/einlass`);
			}
		}

		redirect(303, `/z?stand=unbekannt`);
	}

	/*
	 * **Nur vormerken, nicht einlösen** (FP-1, 12.11.2026). Wer diesen Link
	 * abruft, ist noch nicht der Eigentümer mit der Karte in der Hand: Es kann
	 * der Vorschau-Bot eines Messengers sein. Der Code wartet darum höchstens
	 * zwei Minuten in einem `httpOnly`-Keks, und erst das Formular auf `/z`
	 * löst ihn ein.
	 */
	setzeKartenscan(cookies, normalisiere(params.code), keksSicher());
	redirect(303, '/z');
};
