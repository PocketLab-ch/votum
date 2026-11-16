import { error, json } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { setzeProtokollnotiz, speichereProtokoll } from '$lib/server/protokoll';
import { Schreibkonflikt } from '$lib/domain/schreibstand';
import { ausserAbsage } from '$lib/server/nulsperre';
import type { RequestHandler } from './$types';

/**
 * Laufendes Sichern (FR-46).
 *
 * **Warum es diesen Weg gibt.** «Erfasster Text wird laufend gesichert, weil ein
 * verlorener Text in der Sitzung nicht rekonstruierbar ist.» Ein Feld, das erst
 * auf Knopfdruck speichert, verliert alles beim Seitenwechsel, beim Neuladen und
 * beim Telefon, das sich sperrt — und im Saal merkt es niemand, bis es zu spät
 * ist.
 *
 * **Warum eigener Endpunkt statt Formularaktion.** Die Antwort einer Aktion ist
 * für Formulare gemacht; hier braucht der Browser eine kurze, eindeutige
 * Auskunft — gesichert, oder Konflikt mit dem fremden Text. Das Formular bleibt
 * daneben bestehen: Ohne JavaScript sichert der Knopf, wie er es immer tat.
 *
 * **Warum ein Konflikt kein Fehler ist.** Dasselbe Feld steht an zwei Stellen.
 * Wer beide offen hat, überschriebe sonst die frische Fassung mit einer alten,
 * und niemand sähe es. Der Konflikt kommt mit dem gespeicherten Text zurück,
 * damit sich beide Fassungen vergleichen lassen.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const eingabe = (await request.json().catch(ausserAbsage(null))) as {
		feld?: 'notiz' | 'body';
		traktandum?: string;
		text?: string;
		/**
		 * Der Stand, den der Absender kannte. **Fehlt er, wird nicht geprüft** —
		 * so setzt «meinen Text durchsetzen» den eigenen durch. `null` kommt aus
		 * einer älteren Fassung der Seite und meint dasselbe.
		 */
		bisher?: string | null;
	} | null;
	/*
	 * **Das Feld wird geprüft, nicht angenommen** (26.08.2026, aus dem Review).
	 * Der Typ oben ist eine Behauptung über fremde Eingabe. Ohne diese Prüfung
	 * landete jeder andere Wert im Zweig des Protokolltextes, und der Konflikt
	 * käme mit einem leeren Fremdtext zurück — «den anderen übernehmen» leerte
	 * dann das Feld, statt eine zweite Fassung anzubieten.
	 */
	if (eingabe?.feld !== 'notiz' && eingabe?.feld !== 'body') {
		error(400, 'Ohne bekanntes Feld lässt sich nichts sichern.');
	}

	const handelnder = {
		operatorId: locals.benutzer.operatorId,
		userId: locals.benutzer.id,
		label: locals.benutzer.displayName
	};

	try {
		if (eingabe.feld === 'notiz') {
			if (!eingabe.traktandum) error(400, 'Ohne Traktandum lässt sich keine Notiz sichern.');
			await setzeProtokollnotiz(
				handelnder,
				params.id,
				eingabe.traktandum,
				eingabe.text ?? '',
				eingabe.bisher ?? undefined
			);
		} else {
			await speichereProtokoll(handelnder, params.id, eingabe.text ?? '', eingabe.bisher ?? undefined);
		}
	} catch (fehler) {
		if (fehler instanceof Schreibkonflikt) {
			return json(
				{ konflikt: true, aktuell: fehler.aktuell[eingabe.feld], meldung: fehler.message },
				{ status: 409 }
			);
		}
		if (fehler instanceof FachlicherFehler) {
			return json({ fehler: fehler.message }, { status: 400 });
		}
		throw fehler;
	}

	// Die Uhrzeit kommt vom Server: Das Notebook im Saal kann falsch gehen, und
	// «gesichert 12:03» wäre dann eine Lüge (AD-12).
	return json({
		gesichert: true,
		zeitpunkt: new Date().toLocaleTimeString('de-CH', {
			timeZone: 'Europe/Zurich',
			hour: '2-digit',
			minute: '2-digit'
		})
	});
};
