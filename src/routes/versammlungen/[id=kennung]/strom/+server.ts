import { error } from '@sveltejs/kit';
import { abonniere, merke, stromantwort } from '$lib/server/ereignisstrom';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { holeVersammlung } from '$lib/server/versammlungen';
import type { RequestHandler } from './$types';

/**
 * Der Ereignisstrom als Server-Sent-Events.
 *
 * Kein WebSocket: Der Fluss geht nur in eine Richtung, SSE kommt ohne
 * Zusatzbibliothek aus und überlebt einen Verbindungsabbruch von selbst — der
 * Browser verbindet neu, und der erste Beitrag ist wieder der volle Stand.
 * Genau das braucht ein Notebook im Saal-WLAN.
 *
 * Übertragen werden ausschliesslich Zahlen und Zustände (AD-11). Wer die
 * Adresse kennt, erfährt, wie viele anwesend sind — nicht, wer.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const operatorId = locals.benutzer.operatorId;
	const meetingId = params.id;

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

			// Der erste Beitrag ist der volle Stand, damit die Seite nicht leer
			// bleibt, bis sich zufällig etwas ändert.
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

			// Ein Doppelpunkt-Kommentar alle 25 Sekunden hält die Verbindung offen.
			// Ohne ihn schliessen Zwischenstellen sie nach Untätigkeit, und im Saal
			// steht dann eine Anzeige, die von selbst eingefroren ist.
			// Als benanntes Event, nicht als SSE-Kommentar: Kommentare halten nur
			// Proxys wach, der Browser-Client sieht sie nicht. Das Event lässt die
			// Gegenseite Totenstille erkennen — im Saal-WLAN sterben offene
			// Verbindungen still, und ohne Lebenszeichen zeigt ein Gerät einfach
			// weiter, was zuletzt ankam. Fünf Sekunden Takt, damit der Client nach
			// rund zwanzig Sekunden Stille sicher urteilen kann.
			herzschlag = setInterval(() => {
				try {
					steuerung.enqueue(kodierer.encode('event: herzschlag\ndata: {}\n\n'));
				} catch {
					/* siehe oben */
				}
			}, 5_000);
		},

		cancel() {
			abbestellen?.();
			if (herzschlag) clearInterval(herzschlag);
		}
	});

	return stromantwort(strom);
};
