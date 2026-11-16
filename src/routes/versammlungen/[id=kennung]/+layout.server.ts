import { error } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeVorbereitung } from '$lib/server/uebersicht';
import { holeWeisungspflichtige } from '$lib/server/weisung';
import { keksSicher } from '$lib/server/keks';
import type { LayoutServerLoad } from './$types';

/**
 * Die Führung einer Versammlung — für alle ihre Seiten dieselbe (Story 6.7).
 *
 * Die Schrittfolge lag bisher auf einer einzigen Seite. Dort war sie gut und
 * ansonsten unsichtbar: Wer bei den Traktanden stand, sah nicht, was davor und
 * danach kommt. Sie gehört deshalb in den Rahmen und nicht auf eine Seite.
 *
 * Endpunkte (die PDF- und Strom-Routen) führen keine Layoutladung aus; die
 * zusätzliche Abfrage trifft nur Seiten.
 */
export const load: LayoutServerLoad = async ({ locals, params, cookies }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	/*
	 * **Wo ich zuletzt war** — für den Knopf «Zur Sitzungsleitung» im Gerüst
	 * (Auftraggeber, 21.08.2026: «der Button muss sich merken, welche die letzte Sitzung
	 * war»).
	 *
	 * Vorher fragte der Knopf den Verlauf: die laufende Versammlung, in der
	 * dieser Benutzer zuletzt **gehandelt** hat. Das trifft meistens, aber nicht
	 * immer — wer in eine zweite Sitzung hineinschaut, ohne etwas zu tun, wird
	 * vom Knopf weiterhin in die erste geschickt. Bei zwei Häusern am selben
	 * Abend ist das der Regelfall, nicht die Ausnahme.
	 *
	 * **Im Cookie und nicht am Benutzer**, weil es eine Sache des Geräts ist: Am
	 * Notebook führt man die eine Sitzung, am Telefon sieht man in die andere.
	 * Zwei Geräte, zwei Antworten — und keines überschreibt dem anderen seine.
	 *
	 * Gemerkt wird die blosse Kennung. Ob sie noch etwas gilt, entscheidet das
	 * Gerüst: Es prüft bei jedem Laden, ob die Versammlung noch läuft.
	 */
	cookies.set('zuletzt', params.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: keksSicher(),
		// Ein Abend, nicht länger. Danach greift wieder der Verlauf.
		maxAge: 60 * 60 * 12
	});

	const [gemeinschaft, vorbereitung, mitglieder] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeVorbereitung(locals.benutzer.operatorId, params.id),
		// Story 7.3: Weisungen gibt es nur, wo Anteile auf andere Gemeinschaften
		// lauten. Bei einer gewöhnlichen STWEG hätte der Punkt keinen Gegenstand,
		// und ein Punkt ohne Gegenstand ist Lärm in der Führung.
		holeWeisungspflichtige(locals.benutzer.operatorId, versammlung.stwegId, versammlung.datum)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	return {
		rahmenVersammlung: versammlung,
		rahmenGemeinschaft: { id: gemeinschaft.id, name: gemeinschaft.name },
		schritte: vorbereitung?.schritte ?? [],
		fortschritt: vorbereitung?.fortschritt ?? null,
		anzahlMitgliedsgemeinschaften: mitglieder.length
	};
};
