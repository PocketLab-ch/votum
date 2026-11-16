import { redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { merkmalStimmt } from '$lib/domain/anmeldewege';
import { holePerson, PRUEFER_COOKIE, ZUSTAND_COOKIE } from '$lib/server/authentik';
import { loeseAuthentikEin, setzeKeks } from '$lib/server/zugangssitzung';
import { herkunft } from '$lib/server/herkunft';
import type { RequestHandler } from './$types';

/**
 * Der Rückweg des Eigentümers von Authentik.
 *
 * Dieselbe Reihenfolge wie beim Rückweg der Bewirtschaftung: erst das
 * Zustandsmerkmal, dann der Code. Wer den Rückweg von aussen anstösst, kommt so
 * nicht einmal bis zum Tausch.
 *
 * **Was hier nicht passiert: eine Berechtigung entstehen lassen.** Die Kennung
 * wird in der Momentaufnahme gesucht. Findet sich nichts, endet der Weg mit
 * einer Meldung — es wird kein Zugang «freundlicherweise» angelegt und keine
 * Partei erraten. Ein Konto ist eine Identität, keine Stimme.
 */
/**
 * Ein Wort ins Serverprotokoll, wenn der Weg nicht ans Ziel kommt.
 *
 * **Warum es das braucht.** Am 20.08.2026 blieb eine Anmeldung auf einem iPhone
 * hängen, und die Fehlersuche stand still: Von aussen sieht jeder Fehlschlag
 * gleich aus — eine Umleitung auf `/z` mit einem Satz. Welcher Zweig gegriffen
 * hat, wusste nur der Server, und er sagte es niemandem. Ohne diese Zeile bleibt
 * nur Raten, und Raten kostet den Nutzer einen Versuch nach dem anderen.
 *
 * **Was NICHT protokolliert wird:** die Kennung der Person, der Code, der
 * Prüfer, die Marke. Nur der Name des Zweigs — er sagt, wo es klemmt, und
 * verrät nichts über den Menschen.
 */
function halt(zweig: string): void {
	console.warn(`[z/authentik] Anmeldung abgebrochen: ${zweig}`);
}

export const GET: RequestHandler = async ({ cookies, request, url }) => {
	const zustand = cookies.get(ZUSTAND_COOKIE);
	const pruefer = cookies.get(PRUEFER_COOKIE);

	// Die Merkmale gehören zu einem Anlauf und gehen mit ihm — auch wenn es
	// schiefgeht, damit ein zweiter Versuch nicht auf einem alten Prüfer aufsetzt.
	for (const k of [ZUSTAND_COOKIE, PRUEFER_COOKIE]) {
		cookies.delete(k, { path: '/z', secure: keksSicher() });
	}

	if (url.searchParams.get('error')) {
		halt('abgelehnt');
		redirect(303, '/z?stand=abgelehnt');
	}
	if (!merkmalStimmt(zustand, url.searchParams.get('state'))) {
		// Der haeufigste Grund auf einem Telefon: Der kurzlebige Keks kam nicht
		// zurueck. Deshalb steht dabei, ob ueberhaupt einer da war.
		halt(`merkmal (Keks ${zustand ? 'da' : 'FEHLT'})`);
		redirect(303, '/z?stand=merkmal');
	}

	const code = url.searchParams.get('code');
	if (!code || !pruefer) {
		halt('unvollstaendig');
		redirect(303, '/z?stand=unvollstaendig');
	}

	let kennung: string;
	try {
		const person = await holePerson(code, pruefer, `${herkunft(url)}/z/authentik/zurueck`);
		kennung = person.subject;
	} catch (fehler) {
		// Hier steht ausnahmsweise die Meldung des Dienstes dabei — sie nennt den
		// Grund des Fehlschlags (Status, Zeitablauf) und keine Person.
		halt(`Tausch beim Dienst: ${(fehler as Error)?.message ?? 'unbekannt'}`);
		redirect(303, '/z?stand=authentik_aus');
	}

	const einloesung = await loeseAuthentikEin(kennung, request.headers.get('user-agent') ?? '');

	if (!einloesung.gelungen || !einloesung.merkmal) {
		halt(`Zugang: ${einloesung.ausgang}`);
		// Der Grund steht auf der Seite, nicht in der Adresse: Er kann ein ganzer
		// Satz sein, und die Adresse landet im Verlauf des Browsers.
		redirect(303, einloesung.ausgang === 'belegt' ? '/z?stand=belegt' : '/z?stand=kein_zugang');
	}

	setzeKeks(cookies, einloesung.merkmal, keksSicher());

	/*
	 * **Wenn dabei ein anderes Gerät gewichen ist, steht es auf der Seite.**
	 *
	 * Gemeldet am 20.08.2026: «wenn ich mit dem iOS über Firefox … mich mit
	 * Authentik einlogge, kommt die Meldung, dass ich woanders eingeloggt sei und
	 * dass das nicht geht.» Jetzt geht es — aber lautlos darf es nicht gehen: Wer
	 * hier ankommt, soll wissen, dass sein anderes Gerät gerade herausgefallen
	 * ist, und die bevollmächtigte Person, der man versehentlich die Sitzung
	 * genommen hat, findet den Grund auf ihrem Bildschirm.
	 */
	redirect(303, einloesung.uebernommen ? '/z?stand=uebernommen' : '/z');
};