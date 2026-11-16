import { error } from '@sveltejs/kit';
import { abonniere, merke, stromantwort } from '$lib/server/ereignisstrom';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { loeseAnzeigecodeAuf } from '$lib/server/versammlungen';
import { leseAnzeigeKeks } from '$lib/server/anzeigesitzung';
import type { RequestHandler } from './$types';

/**
 * Der Ereignisstrom für die Leinwand.
 *
 * Dieselbe Quelle wie für die Steuerungssicht, aber über den Anzeigecode
 * berechtigt statt über eine Anmeldung: Der Beamer ist niemand, der sich
 * anmeldet. Was fliesst, sind Zahlen und Zustände (AD-11).
 *
 * NFR-3: Bricht die Verbindung ab, verbindet der Browser von selbst neu, und
 * der erste Beitrag ist wieder der volle Stand — die Leinwand stellt sich damit
 * selbsttätig richtig.
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const code = leseAnzeigeKeks(cookies);
	if (!code) error(401, 'Kein Code für die Leinwand');

	const befund = await loeseAnzeigecodeAuf(code);
	if (!befund.gueltig) error(401, befund.grund ?? 'Der Code gilt nicht');

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
			 * **Der Herzschlag prüft den Code nach** (A3, Sicherheitsdurchgang
			 * 09.10.2026). Bis zum 15.10.2026 wurde er nur beim Verbinden
			 * aufgelöst. Erneuerte die Sitzungsleitung ihn, war der alte Keks für
			 * jede neue Anfrage wertlos (`anzeigesitzung.ts`), die offene
			 * Verbindung lieferte aber weiter Live-Stände, solange sie stand.
			 * Takt, Schliessen statt Melden und Fail-open wie in `/z/strom`, dort
			 * mit Begründung: Jeder dritte Schlag, also nach höchstens fünfzehn
			 * Sekunden; der Browser verbindet neu, bekommt 401 und fällt auf die
			 * Code-Eingabe zurück. Das `catch` ist Pflicht, eine unbehandelte
			 * Ablehnung beendete den Prozess für alle Geräte.
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
				void loeseAnzeigecodeAuf(code, { zaehlen: false })
					.then((jetzt) => {
						if (jetzt.gueltig && jetzt.meetingId === meetingId) return;
						if (herzschlag) clearInterval(herzschlag);
						abbestellen?.();
						try {
							steuerung.close();
						} catch {
							/* schon zu */
						}
					})
					.catch(() => {
						/* Fail-open, siehe `/z/strom`. */
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
