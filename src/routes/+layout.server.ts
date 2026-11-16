import { darfStammdatenAendern } from '$lib/domain/rollen';
import { holeBetriebszustand } from '$lib/server/betriebszustand';
import { holeLaufendeVersammlung } from '$lib/server/versammlungen';
import { istOffenerPfad } from '$lib/domain/oeffentlich';
import type { LayoutServerLoad } from './$types';

/**
 * Der Betriebszustand gehört ins Gerüst, nicht auf eine Seite (Story 6.3, FR-68).
 *
 * «Jederzeit sehen, in welchem Zustand es läuft» heisst: auch dann, wenn man
 * gerade in der Sitzungsleitung steht und nicht auf der Übersicht. Angezeigt
 * wird nur die Störung — der bestimmungsgemässe Alleinbetrieb bekommt keine
 * Dauermeldung, denn eine Anzeige, die immer da ist, wird nicht mehr gelesen.
 *
 * Der Aufruf kostet nichts: Die Erreichbarkeitsprüfung merkt sich ihr Ergebnis
 * (Story 4.1), sonst fragte jede Seitenladung erneut über das Netz.
 * Seit dem Ersatzdienst (13.11.2026) kommen zwei kleine Abfragen dazu, nicht
 * zwischengespeichert: der Eintrag des Ersatzes und die letzten drei Siegel
 * (`betriebszustand.ts`, `ersatzwarnungen`). Bei den Beständen eines
 * Betreibers fällt das nicht ins Gewicht.
 */
export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	return {
		benutzer: locals.benutzer,
		// Damit keine Seite die Rolle selbst auslegen muss: Ein Knopf, den der
		// Wächter hinterher abweist, gehört gar nicht erst hingestellt.
		darfStammdaten: darfStammdatenAendern(locals.benutzer?.role),
		betrieb: await holeBetriebszustand(locals.benutzer?.operatorId),
		/*
		 * **Der Weg zurück in den Saal — auf jeder Seite** (21.08.2026).
		 *
		 * Wer während der Sitzung das Quorum nachschlägt oder eine Zuordnung
		 * prüft, findet sonst nur über die Versammlungsliste zurück. Der Knopf
		 * steht deshalb im Gerüst und nicht auf einzelnen Seiten.
		 *
		 * **Nicht auf den offenen Seiten** (`/z`, `/e`, `/p`): Das sind das
		 * Telefon des Eigentümers, der QR-Einstieg und der Beamer. Wer im selben
		 * Browser auch als Sitzungsleitung angemeldet ist, sah den Knopf dort
		 * ebenfalls — «Den Zur Sitzungsleitung darf nur der angemeldete
		 * Sitzungsleiter sehen. Nicht im /z/». Ausgeblendet wird hier und nicht
		 * erst in der Anzeige: Was das Telefon nicht braucht, soll gar nicht
		 * erst hingeschickt werden.
		 *
		 * **Und nur die eigene Sitzung**: zuerst die zuletzt besuchte (Cookie
		 * `zuletzt`, gesetzt vom Versammlungs-Layout), sonst die, in der dieser
		 * Benutzer zuletzt gehandelt hat. Beides prüft
		 * `holeLaufendeVersammlung` — ein Cookie ist ein Wunsch, keine Erlaubnis.
		 */
		laufendeVersammlung:
			locals.benutzer && !istOffenerPfad(url.pathname)
				? await holeLaufendeVersammlung(
						locals.benutzer.operatorId,
						locals.benutzer.id,
						cookies.get('zuletzt') ?? null
					)
				: null
	};
};
