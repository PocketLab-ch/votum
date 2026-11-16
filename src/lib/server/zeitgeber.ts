/**
 * Der Zeitgeber: der einzige Vorgang dieser Anwendung, den niemand auslöst
 * (Auftraggeber, 01.09.2026: «Der Auslöser kann ein Timer sein»).
 *
 * **Warum es ihn überhaupt gibt.** Die Erinnerung an den Einladungsversand muss
 * an einem Tag hinausgehen, an dem vielleicht niemand die Anwendung öffnet.
 * Alles andere hier hängt an einer Anfrage; dies nicht.
 *
 * **Was er ausdrücklich nicht ist: ein Aufräumjob.** In diesem Verzeichnis gilt
 * «keine automatischen Cleanup- oder Wartungsjobs» — nichts wird gelöscht,
 * verdichtet oder verschoben. Der Lauf liest, verschickt höchstens eine
 * Nachricht je Versammlung und schreibt einen Merker.
 *
 * **Warum im Dienst und nicht als Cron.** Ein Cron ausserhalb bräuchte einen
 * eigenen Weg in die Datenbank, eigene Zugangsdaten und eine zweite Fassung der
 * Fristrechnung. Der Lauf hier benutzt denselben Code wie die Anzeige — und die
 * Anwendung läuft ohnehin durchgehend.
 *
 * **Abschaltbar** über `VERSAMMLUNG_ERINNERUNG=aus`, ohne Neubau.
 */
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { erinnerungslauf } from './einladungserinnerung';

/** Wie oft nachgesehen wird. Stündlich: Die Erinnerung ist auf den Tag genau, nicht auf die Minute. */
const TAKT_MS = 60 * 60 * 1000;

/** Beim Start etwas warten — der erste Augenblick gehört dem Hochfahren. */
const VORLAUF_MS = 60 * 1000;

/**
 * **Der Riegel gegen den doppelten Start.** Im Entwicklungsbetrieb wird dieses
 * Modul beim Nachladen neu ausgewertet; eine Modulvariable wäre dann jedes Mal
 * frisch, und nach zehn Änderungen liefen zehn Zeitgeber. Deshalb steht die
 * Marke am globalen Objekt, das den Neuaufbau überlebt.
 */
const MARKE = Symbol.for('versammlung.zeitgeber');
const global = globalThis as unknown as Record<symbol, boolean | undefined>;

export function starteZeitgeber(): void {
	// Beim Bauen wird `hooks.server.ts` ausgewertet, ohne dass ein Dienst läuft.
	if (building) return;
	if (env.VERSAMMLUNG_ERINNERUNG?.trim() === 'aus') return;
	if (global[MARKE]) return;
	global[MARKE] = true;

	const anstossen = () => {
		void lauf();
	};

	// `unref`: Ein wartender Zeitgeber darf den Prozess nicht am Beenden hindern.
	setTimeout(anstossen, VORLAUF_MS).unref();
	setInterval(anstossen, TAKT_MS).unref();
}

async function lauf(): Promise<void> {
	try {
		const bericht = await erinnerungslauf();
		if (bericht.verschickt > 0 || bericht.fehlgeschlagen.length > 0) {
			// Nur melden, wenn etwas geschehen ist: Ein stündlicher «nichts zu tun»
			// füllt das Protokoll und verdeckt die Zeilen, auf die es ankommt.
			console.log(
				`Erinnerungen an den Einladungsversand: ${bericht.verschickt} verschickt, ` +
					`${bericht.fehlgeschlagen.length} fehlgeschlagen, ${bericht.geprueft} geprüft.`
			);
		}
		/*
		 * **Die Gründe gebündelt, nicht je Versammlung einzeln.** Auf einem
		 * Entwicklungsstapel liegen Dutzende Prüfversammlungen; stündlich eine
		 * Zeile je Versammlung machte das Protokoll unlesbar und verdeckte genau
		 * die Zeilen, wegen deren man hineinsieht.
		 */
		const gruende = new Map<string, number>();
		for (const zeile of bericht.uebersprungen) {
			const grund = zeile.slice(zeile.indexOf(': ') + 2);
			gruende.set(grund, (gruende.get(grund) ?? 0) + 1);
		}
		for (const [grund, anzahl] of gruende) {
			console.log(`Erinnerung übersprungen (${anzahl}×): ${grund}`);
		}
	} catch (fehler) {
		// Ein Fehler hier darf den Dienst nicht mitnehmen: Er läuft im Hintergrund,
		// und niemand wartet auf seine Antwort.
		console.error('Der Erinnerungslauf ist gescheitert:', fehler);
	}
}
