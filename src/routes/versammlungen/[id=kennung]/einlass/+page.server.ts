import { error } from '@sveltejs/kit';
import { KARTENKEKS, KARTENKEKS_PFAD } from '$lib/server/zugangssitzung';
import { keksSicher } from '$lib/server/keks';
import { holeUebersicht, loeseZugangAuf } from '$lib/server/anwesenheit';
import { holeOffeneSaalmeldungen } from '$lib/server/saaleinstieg';
import { holeVersammlung } from '$lib/server/versammlungen';
import { fragtNachPapier } from '$lib/domain/versammlung';
import { holePapierabgaben } from '$lib/server/papierabgabe';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { einlassaktionen, zurKontrolle, type Kontrollkarte } from '$lib/server/einlassaktionen';
import type { Actions, PageServerLoad } from './$types';

/**
 * Der Einlass als eigene, schmale Seite — für das Telefon am Eingang.
 *
 * **Warum getrennt von der Anwesenheitssicht** (Auftraggeber, 20.08.2026: «Kann man das
 * nicht auf einer separaten Seite machen? Also die Handy-Lösung? … Das muss ja
 * nicht in die Ansicht gepresst werden, wenn das Handy für das Checkin gebraucht
 * wird. Der Laptop liegt ja nebenan.»):
 *
 * Die Anwesenheitssicht ist 7300 px lang und kann alles — Beamer, Wandbild,
 * Beschlussfähigkeit, die ganze Liste, Vollmachten, Codes. Am Eingang braucht
 * man davon **drei Dinge**: scannen, sehen wer es ist, entscheiden. Alles andere
 * ist dort Ballast, und Ballast auf einem Telefonbildschirm heisst scrollen,
 * während jemand vor einem steht.
 *
 * Sie ist **kein Ersatz**, sondern der zweite Zugang zu denselben Handlungen:
 * Beide Seiten benutzen `einlassaktionen` aus `$lib/server`. Zwei Abschriften
 * liefen auseinander, und dann verhielte sich dieselbe Schaltfläche am Telefon
 * anders als am Notebook.
 */
export const load: PageServerLoad = async ({ cookies, locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(op, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, uebersicht, saalmeldungen] = await Promise.all([
		holeGemeinschaft(op, versammlung.stwegId),
		holeUebersicht(op, params.id),
		holeOffeneSaalmeldungen(op, params.id)
	]);

	/*
	 * Eine Karte, die eben mit der Kamera-App gescannt wurde. Derselbe Keks wie
	 * auf der Anwesenheitsseite — `/z/<CODE>` legt ihn ab, und wer ihn liest,
	 * räumt ihn weg: Die Rückfrage erscheint einmal, wie die Karte einmal
	 * gescannt wurde.
	 */
	let gescannt: Kontrollkarte | null = null;
	const kartencode = cookies.get(KARTENKEKS);
	if (kartencode) {
		cookies.delete(KARTENKEKS, { path: KARTENKEKS_PFAD, secure: keksSicher() });
		const befund = await loeseZugangAuf(op, kartencode);
		if (befund.gueltig && befund.meetingId === params.id && befund.parteiId) {
			const stand = uebersicht?.staende.find((s) => s.parteiId === befund.parteiId);
			if (stand) {
				const papier = await holePapierabgaben(op, params.id);
				gescannt = zurKontrolle(
					stand,
					uebersicht?.gesamtquote ?? 0,
					papier.some((x) => x.parteiId === stand.parteiId)
				);
			}
		}
	}

	const staende = uebersicht?.staende ?? [];
	const papierfrage = fragtNachPapier(versammlung);

	return {
		versammlung,
		papierfrage,
		gemeinschaftName: gemeinschaft?.name ?? '',
		gescannt,
		saalmeldungen: saalmeldungen.map((m) => ({ ...m, papierfrage })),
		/**
		 * Wer angemeldet ist und auf die Freigabe wartet.
		 *
		 * **Vollständig.** Wer oben schon als Kontrollkarte steht, wird erst in der
		 * Maske ausgenommen (`ohneKontrollkarte`) — hier ginge es nicht: Die
		 * gezeigte Karte ist `form.geprueft ?? data.gescannt`, und `form` entsteht
		 * nach diesem Loader. Der eingebaute Scanner und «Nachschlagen» schreiben
		 * gar keinen Kartenkeks; ein Filter hier träfe nur den Weg über die
		 * Kamera-App und liesse den Hauptweg unverändert. Im Code-Review vom
		 * 11.09.2026 gefunden.
		 */
		wartende: staende
			.filter((s) => s.zustand === 'wartet')
			.map((s) => ({ parteiId: s.parteiId, name: s.name, einheiten: s.einheiten, papierfrage })),
		/** Für den Namensabgleich bei Saalmeldungen. */
		parteien: staende.map((s) => ({
			parteiId: s.parteiId,
			name: s.name,
			zustand: s.zustand,
			seit: s.seit
		})),
		/**
		 * Für den Einlass mit Vollmacht steht auf dieser Seite kein Platz — sie ist
		 * für das Telefon gebaut, und Vollmachten kommen auf Papier an den Tisch.
		 * Der Verweis auf die grosse Sicht steht am Fuss.
		 */
		vertretbare: [],
		anwesend: staende.filter((s) => s.zustand === 'anwesend').length,
		gesamt: staende.length
	};
};

export const actions: Actions = { ...einlassaktionen };
