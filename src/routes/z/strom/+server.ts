import { error } from '@sveltejs/kit';
import { abonniere, merke, stromantwort } from '$lib/server/ereignisstrom';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { leseKeks, loeseSitzungAuf } from '$lib/server/zugangssitzung';
import type { RequestHandler } from './$types';

/**
 * Der Ereignisstrom für das Telefon des Eigentümers.
 *
 * **Warum ein Strom und kein Takt.** Story 5.6 verlangt, dass die Frage innert
 * zwei Sekunden auf allen bestätigten Geräten steht. Ein Abfragetakt von vier
 * Sekunden verfehlt das, und ein Takt von zwei Sekunden erzeugt bei hundert
 * Telefonen dreissig Anfragen je Sekunde — mehr Last als hundert offene
 * Verbindungen, die still daliegen.
 *
 * Berechtigt über die Gerätesitzung, nicht über eine Anmeldung. Übertragen
 * werden Zahlen und Zustände (AD-11): Wer mitliest, erfährt, wie viele
 * abgestimmt haben — nie, wer wie.
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const merkmal = leseKeks(cookies);
	if (!merkmal) error(401, 'Nicht angemeldet');

	const befund = await loeseSitzungAuf(merkmal);
	if (!befund.gueltig) error(401, befund.grund ?? 'Zugang gilt nicht');

	const operatorId = befund.operatorId as string;
	const meetingId = befund.meetingId as string;

	let abbestellen: (() => void) | undefined;
	let herzschlag: ReturnType<typeof setInterval> | undefined;

	const strom = new ReadableStream({
		async start(steuerung) {
			const kodierer = new TextEncoder();
			const schicke = (daten: unknown) => {
				try {
					steuerung.enqueue(kodierer.encode(`data: ${JSON.stringify(daten)}\n\n`));
				} catch {
					// Der Browser ist weg. `cancel` räumt gleich auf.
				}
			};

			const stand = await ermittleStand(operatorId, meetingId);
			if (stand) {
				schicke(stand);
				// Auch ins Gedächtnis: Sonst bliebe dort ein älterer Stand stehen und
				// ginge beim nächsten Hinzukommenden als der gültige durch.
				merke(meetingId, stand);
			}

			// Ohne den gemerkten Stand: Der frische ist eben hinausgegangen, und ein
			// älterer dahinter liesse die Sicht zwischen zwei Ständen springen.
			abbestellen = abonniere(meetingId, schicke, false);

			// Als benanntes Event, nicht als SSE-Kommentar: Kommentare halten nur
			// Proxys wach, der Browser-Client sieht sie nicht. Das Event lässt die
			// Gegenseite Totenstille erkennen — im Saal-WLAN sterben offene
			// Verbindungen still, und ohne Lebenszeichen zeigt ein Gerät einfach
			// weiter, was zuletzt ankam. Fünf Sekunden Takt, damit der Client nach
			// rund zwanzig Sekunden Stille sicher urteilen kann.
			/*
			 * **Der Herzschlag prüft mit, ob die Sitzung noch gilt** (20.08.2026).
			 *
			 * Bis dahin wurde die Gerätesitzung **einmal** beim Verbinden geprüft.
			 * Gab die Sitzungsleitung danach den Zugang frei, setzte
			 * `widerrufeSitzungen` zwar `revoked_at` — die offene Verbindung erfuhr
			 * davon nie. Das Gerät zeigte weiter und bekam weiter Live-Daten;
			 * abgewiesen wurde es erst bei der nächsten Formularaktion (die
			 * Stimmabgabe löst die Sitzung neu auf, dort war nie eine Lücke). Der
			 * Bildschirm konnte beliebig lange stehen bleiben.
			 *
			 * **Nicht bei jedem Schlag.** Eine Abfrage je Gerät alle fünf Sekunden
			 * wäre bei hundert Telefonen genau die Last, die dieser Strom vermeidet
			 * (siehe oben). Jeder dritte Schlag genügt: Nach höchstens fünfzehn
			 * Sekunden ist die Verbindung zu, und der Wachhund im Browser wertet
			 * zwanzig Sekunden Stille ohnehin als tote Verbindung.
			 *
			 * **Schliessen, nicht melden.** Eine Nachricht «du bist draussen» müsste
			 * die Gegenseite erst deuten; eine geschlossene Verbindung deutet sie
			 * schon: Der Browser verbindet neu, bekommt 401, und die Seite landet
			 * beim Eingabefeld.
			 */
			let schlag = 0;
			herzschlag = setInterval(() => {
				try {
					steuerung.enqueue(kodierer.encode('event: herzschlag\ndata: {}\n\n'));
				} catch {
					/* siehe oben */
				}

				schlag++;
				if (schlag % 3 !== 0) return;
				void loeseSitzungAuf(merkmal)
					.then((jetzt) => {
						if (jetzt.gueltig) return;
						if (herzschlag) clearInterval(herzschlag);
						abbestellen?.();
						try {
							steuerung.close();
						} catch {
							/* schon zu */
						}
					})
					.catch(() => {
						/*
						 * **Fail-open, und der zweite Grund ist der harte.**
						 *
						 * Fachlich: Eine Datenbank, die eine Sekunde stolpert, darf nicht
						 * den ganzen Saal aussperren — mitten in einer Abstimmung wäre das
						 * der teuerste denkbare Fehlalarm. Wer nicht mehr darf, wird beim
						 * nächsten Durchgang erwischt, und schreiben konnte er ohnehin nie:
						 * Jede Formularaktion löst die Sitzung neu auf.
						 *
						 * Technisch: Ohne dieses `catch` ist eine abgelehnte Prüfung eine
						 * **unbehandelte Ablehnung**, und Node beendet darauf den Prozess.
						 * Im Entwicklungscontainer nachgemessen (Node v24.19.0): Exit 1.
						 * Der Server stürbe also nicht für dieses eine Gerät, sondern für
						 * alle — ausgelöst von genau der Störung, gegen die die Prüfung
						 * absichern soll. Befund aus einer Parallelsitzung, hier
						 * nachvollzogen; der Fehler war meiner.
						 */
					});
			}, 5_000);
		},

		cancel() {
			abbestellen?.();
			if (herzschlag) clearInterval(herzschlag);
		}
	});

	return stromantwort(strom);
};
