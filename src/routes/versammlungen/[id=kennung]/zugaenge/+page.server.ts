import { error, fail } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeZugangsuebersicht } from '$lib/server/zugaenge';
import { verschickeEinladungen } from '$lib/server/einladungsversand';
import { istEingerichtet as mailEingerichtet, MailFehler } from '$lib/server/mail';
import { herkunft } from '$lib/server/herkunft';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Übersicht zeigt, wer eine Karte hat — nie einen Code.
 *
 * Das Erzeugen liegt bewusst nicht hier, sondern beim Ausgabepunkt
 * `karten.pdf`: Der Code existiert nur im Augenblick seiner Entstehung, danach
 * steht in der Datenbank nur sein Prüfwert. Eine Seite, die erst erzeugt und
 * dann anzeigt, müsste den Code durch die Sitzung schleifen — und damit an
 * einer zweiten Stelle aufbewahren, an der er nichts verloren hat.
 */
/**
 * Die Absage eines Downloadwegs in Worten (22.08.2026, Befund B-04).
 *
 * **Warum über die Adresse:** Die beiden Wege sind Dateiauslieferungen
 * (`+server.ts`) und kennen keine Formularantwort. Sie leiten hierher zurück
 * und geben die Kennung mit — der Satz steht an einer Stelle statt in jeder
 * Route.
 *
 * **Der Rückfall ist der wichtigere Teil.** Beim ersten Bauen kannte diese
 * Tabelle zwei von vier Kennungen; im Browser klickte ich «Versandpaket als
 * ZIP» an einer geschlossenen Versammlung, bekam `?absage=geschlossen` — und
 * die Seite zeigte **gar nichts**. Ein Klick, nach dem nichts geschieht, ist
 * schlimmer als der 400er, den das hier ersetzen sollte. Eine Liste ist immer
 * unvollständig; sie braucht deshalb einen Boden, der die Kennung wenigstens
 * nennt.
 *
 * Die Kennung kommt aus der Adresse und damit von aussen: Sie wird nie als Text
 * ausgegeben, sondern nur nachgeschlagen — der Rückfall nennt sie in Anführung,
 * und Svelte maskiert sie beim Rendern.
 */
function absageInWorten(kennung: string | null): string | null {
	if (!kennung) return null;
	const saetze: Record<string, string> = {
		nichts_erzeugt:
			'Es wurde kein Zugang erzeugt: Alle gewählten Parteien haben bereits einen gültigen. ' +
			'Ein bestehender Code lässt sich nicht noch einmal ausdrucken — er steht nur ' +
			'verschlüsselt in der Datenbank. Um einen zu ersetzen, wählen Sie ihn in der Liste ' +
			'oben ausdrücklich aus («Neu erzeugen»).',
		ohne_momentaufnahme:
			'Für diese Versammlung steht noch nicht fest, wer stimmberechtigt ist. Geben Sie sie ' +
			'zuerst frei — ' +
			'dabei wird festgehalten, wer stimmberechtigt ist — und darauf beruhen die Karten.',
		nicht_freigegeben:
			'Zugänge entstehen erst mit der Freigabe: Vorher steht noch nicht fest, wer ' +
			'stimmberechtigt ist.',
		geschlossen:
			'Die Versammlung ist geschlossen. Ein neuer Zugang gäbe niemandem mehr Zutritt — die ' +
			'bestehenden Codes sind mit dem Schluss ohnehin wertlos geworden.',
		unbekannt: 'Diese Versammlung oder ihre Gemeinschaft ist nicht auffindbar.',
		ungueltige_kennung:
			'Eine der gewählten Parteien hat eine ungültige Kennung. Laden Sie die Seite neu und ' +
			'wählen Sie erneut.',
		unbekannter_verweis:
			'Eine der gewählten Parteien gibt es hier nicht. Laden Sie die Seite neu und wählen Sie ' +
			'erneut.',
		fremde_kennung:
			'Eine der gewählten Parteien gibt es hier nicht. Laden Sie die Seite neu und wählen Sie ' +
			'erneut.',
		versammlung_abgegeben:
			'Diese Versammlung wird gerade auf einem anderen Gerät geführt, etwa auf dem Notebook ' +
			'im Saal. Solange sie unterwegs ist, entstehen hier keine Zugänge.'
	};
	return (
		saetze[kennung] ??
		`Der Vorgang wurde abgewiesen («${kennung}»). Diese Absage hat hier noch keinen ` +
			'ausformulierten Satz — melden Sie sie bitte, damit sie einen bekommt.'
	);
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [gemeinschaft, uebersicht] = await Promise.all([
		holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
		holeZugangsuebersicht(locals.benutzer.operatorId, params.id)
	]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	return {
		versammlung,
		gemeinschaft,
		uebersicht,
		freigegeben: versammlung.zustand !== 'entwurf',
		ohneZugang: uebersicht.filter((u) => u.zustand !== 'gueltig').length,
		/**
		 * Die Absage eines Downloadwegs, in Worten (22.08.2026, Befund B-04).
		 *
		 * **Warum über die Adresse und nicht über `form`:** Die beiden Wege sind
		 * Dateiauslieferungen (`+server.ts`) und kennen keine Formularantwort. Sie
		 * leiten deshalb hierher zurück und geben die Kennung mit; der Satz steht
		 * hier, damit er einmal formuliert ist und nicht in jeder Route.
		 */
		absage: absageInWorten(url.searchParams.get('absage')),
		// Ohne eingerichteten Mailausgang erscheint der Weg gar nicht — wie bei
		// jedem anderen Dienst dieser Anwendung.
		mailMoeglich: mailEingerichtet()
	};
};

export const actions: Actions = {
	/**
	 * Einladung samt persönlicher Karte verschicken.
	 *
	 * **Erzeugt Zugänge**, wie das Versandpaket auch — und zwar dieselben: Das
	 * Paket entsteht dabei einmal und liefert die Karten für die Nachrichten.
	 */
	versenden: async ({ locals, params, request, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const daten = await request.formData();
		const gewaehlt = daten.getAll('partei').map(String).filter(Boolean);
		const jetzt = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' });

		try {
			const bericht = await verschickeEinladungen(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				herkunft(url),
				gewaehlt.length > 0 ? gewaehlt : undefined,
				jetzt
			);
			return { bericht };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler || fehler instanceof MailFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	}
};
