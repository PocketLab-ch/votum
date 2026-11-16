import { error } from '@sveltejs/kit';
import { holeVersammlungstag } from '$lib/server/versammlungstag';
import { holeAbendhaeuser } from '$lib/server/uebersicht';
import { abonniere, merke, stromantwort, type Stromnachricht } from '$lib/server/ereignisstrom';
import { ermittleStand } from '$lib/server/versammlungsstand';
import type { RequestHandler } from './$types';

/**
 * Der Ereignisstrom des gemeinsamen Abends (Auftraggeber, 23.08.2026).
 *
 * «Was nicht brauchbar ist, sind 5 Bildschirme für Präsentationen. Ein
 * gemeinsamer Abend hat auch einen gemeinsamen Bildschirm.»
 *
 * **Warum ein gebündelter Strom und nicht mehrere Verbindungen.** Der
 * naheliegende Weg wäre, im Browser je Haus ein `EventSource` zu öffnen. Über
 * HTTP/1.1 sind aber sechs Verbindungen je Herkunft das Limit — bei sechs
 * Häusern bliebe keine für die Seite selbst übrig, und der Monitor stünde
 * still, sobald jemand darauf klickt. Ein Strom trägt alle Häuser.
 *
 * **Ein Beitrag, alle Häuser.** Die Gegenseite bekommt bei jeder Änderung den
 * vollen Satz und muss nichts zusammenführen. Ein Teilbeitrag («Haus 3 hat sich
 * geändert») zwänge sie, den Rest im Gedächtnis zu halten — und ein Monitor,
 * der stundenlang läuft, hätte dann irgendwann einen Stand, den niemand mehr
 * nachvollziehen kann.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const operatorId = locals.benutzer.operatorId;

	const tag = await holeVersammlungstag(operatorId, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const haeuser = await holeAbendhaeuser(operatorId, params.id);

	const abbestellen: (() => void)[] = [];
	let herzschlag: ReturnType<typeof setInterval> | undefined;
	/*
	 * **Der Abbruch kann `start` überholen** (Code-Review 24.08.2026, Befund 9).
	 *
	 * SvelteKit ruft bei `res.on('close')` sofort `reader.cancel()`, und das
	 * wartet nicht auf das Versprechen aus `start`. Bricht die Verbindung ab,
	 * während die Anfangsstände geholt werden — eine Schleife über alle Häuser
	 * mit mehreren Abfragen je Haus —, ist `abbestellen` noch leer und
	 * `herzschlag` `undefined`. Danach läuft `start` weiter und hinterlässt N
	 * Zuhörer und ein Intervall, die niemand mehr abräumt. `enqueue` wirft dann
	 * bei jedem Senden, wird aber vom `catch` geschluckt: Es heilt sich nicht.
	 *
	 * Dieselbe Bauform hat der Strom der einzelnen Versammlung — dort mit einem
	 * Haus, hier mit allen.
	 */
	let abgebrochen = false;

	const strom = new ReadableStream({
		async start(steuerung) {
			const kodierer = new TextEncoder();
			const staende = new Map<string, Stromnachricht>();

			const schicke = () => {
				const satz = haeuser.map((h) => ({
					meetingId: h.versammlungId,
					gemeinschaft: h.name,
					stand: staende.get(h.versammlungId) ?? null
				}));
				try {
					steuerung.enqueue(kodierer.encode(`data: ${JSON.stringify({ haeuser: satz })}\n\n`));
				} catch {
					// Der Browser ist weg. `cancel` räumt gleich auf.
				}
			};

			// Der erste Beitrag ist der volle Satz — sonst bliebe der Monitor leer,
			// bis sich zufällig etwas ändert.
			for (const h of haeuser) {
				if (abgebrochen) return;
				const stand = await ermittleStand(operatorId, h.versammlungId);
				if (stand) {
					staende.set(h.versammlungId, stand);
					merke(h.versammlungId, stand);
				}
			}
			if (abgebrochen) return;
			schicke();

			for (const h of haeuser) {
				abbestellen.push(
					abonniere(
						h.versammlungId,
						(nachricht) => {
							staende.set(h.versammlungId, nachricht);
							schicke();
						},
						// Ohne den gemerkten Stand: Der frische ist eben hinausgegangen,
						// und ein älterer dahinter liesse den Monitor springen.
						false
					)
				);
			}

			/*
			 * Herzschlag wie beim einzelnen Strom: Im Saal-WLAN sterben offene
			 * Verbindungen still, und ohne Lebenszeichen zeigt eine Wand einfach
			 * weiter, was zuletzt ankam.
			 */
			herzschlag = setInterval(() => {
				try {
					steuerung.enqueue(kodierer.encode('event: herzschlag\ndata: {}\n\n'));
				} catch {
					/* siehe oben */
				}
			}, 5_000);
		},

		cancel() {
			abgebrochen = true;
			for (const weg of abbestellen) weg();
			if (herzschlag) clearInterval(herzschlag);
		}
	});

	return stromantwort(strom);
};
