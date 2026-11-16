import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { VERWALTUNG_VORBEHALTEN, darfStammdatenAendern } from '$lib/domain/rollen';
import {
	GEDULD_HOECHSTWERT_MS,
	GEDULD_KLEINSTWERT_MS,
	GEDULD_VORGABE_MS,
	pruefeStufe
} from '$lib/domain/dienste';
import { ganzzahl, text } from '$lib/server/formular';
import {
	aendereKistufe,
	entferneErsatzdienst,
	entferneKistufe,
	entferneZeitstempeldienst,
	hefteAn,
	holeDienstelage,
	holePruefzeitstempel,
	legeKistufeAn,
	pruefeKiVerbindung,
	setzeErsatzdienst,
	setzeZeitstempeldienst,
	uebernimmAusUmgebung,
	verschiebeKistufe
} from '$lib/server/dienste';
import { GEHEIMNIS_ERZEUGEN, GEHEIMNIS_VARIABLE } from '$lib/server/tresor';
import type { Actions, PageServerLoad } from './$types';

/**
 * Äussere Dienste einrichten (14.08.2026).
 *
 * **Der Verwaltung vorbehalten, auch das Lesen.** Dieselbe Überlegung wie bei
 * den Konten: Hier steht, wohin Inhalte der Versammlung hinausgehen und welcher
 * Stelle die Anwendung einen Zeitstempel abnimmt. Das ist eine Auskunft über
 * die Aussenwege, keine Stammdatenliste — die allgemeine Regel «Lesen ist für
 * beide Rollen offen» trägt hier nicht.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

	return {
		lage: await holeDienstelage(locals.benutzer.operatorId),
		geduld: {
			kleinst: GEDULD_KLEINSTWERT_MS,
			hoechst: GEDULD_HOECHSTWERT_MS,
			vorgabe: GEDULD_VORGABE_MS
		},
		geheimnis: { variable: GEHEIMNIS_VARIABLE, erzeugen: GEHEIMNIS_ERZEUGEN }
	};
};

function handelnder(locals: App.Locals) {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	return {
		operatorId: locals.benutzer.operatorId,
		userId: locals.benutzer.id,
		label: locals.benutzer.displayName
	};
}

/**
 * Ein fachlicher Fehler wird zur Meldung am Feld, nicht zu einem Absturz.
 *
 * **Ohne Herkunftsmarke.** Ein erster Anlauf gab zusätzlich zurück, welches
 * Formular abgewiesen wurde, damit die Seite es wieder aufklappen kann. Das ist
 * unerreichbar: Aufgeklappt wird nur mit JavaScript, und dort hält
 * `use:enhance` den Zustand ohnehin. Eine Angabe, die niemand liest, sieht beim
 * nächsten Lesen aus wie ein Faden, an dem etwas hängt (Review 17.08.2026).
 */
async function versuche<T>(fn: () => Promise<T>, erfolg: (wert: T) => object) {
	try {
		return erfolg(await fn());
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
		}
		throw fehler;
	}
}

/** Die Felder einer Stufe, aus dem Formular gelesen. */
function stufenfelder(d: FormData) {
	return {
		name: text(d.get('name')),
		url: text(d.get('url')),
		modell: text(d.get('modell')),
		geduldMs: ganzzahl(d.get('geduldMs')) ?? GEDULD_VORGABE_MS,
		schluessel: String(d.get('schluessel') ?? ''),
		schluesselEntfernen: d.get('schluesselEntfernen') === 'ja'
	};
}

export const actions: Actions = {
	stufeAnlegen: async ({ request, locals }) => {
		const d = await request.formData();
		const felder = stufenfelder(d);
		// Die Hinweise kommen aus derselben Prüfung wie die Fehler — sie sollen
		// **nach** dem Anlegen dastehen, nicht statt ihm (Gestaltungsregel 8).
		const { hinweise } = pruefeStufe(felder);
		return versuche(
			() => legeKistufeAn(handelnder(locals), felder),
			({ nummer }) => ({ hinweis: `Stufe ${nummer} ist eingerichtet.`, hinweise })
		);
	},

	stufeAendern: async ({ request, locals }) => {
		const d = await request.formData();
		const felder = stufenfelder(d);
		const { hinweise } = pruefeStufe(felder);
		return versuche(
			() => aendereKistufe(handelnder(locals), text(d.get('stufe')), felder),
			() => ({ hinweis: 'Die Stufe ist geändert.', hinweise })
		);
	},

	/**
	 * Die Reihenfolge ist die Aussage: Stufe 1 antwortet im Saal, alles Weitere
	 * ist Ausweichung. Deshalb eine eigene Handlung — und nicht ein Zahlenfeld
	 * im Änderungsformular, das zwei Stufen auf dieselbe Nummer setzen könnte.
	 */
	stufeVerschieben: async ({ request, locals }) => {
		const d = await request.formData();
		// Kein stiller Rückfall auf «vor»: Ein unbekannter Wert ist ein Fehler,
		// keine Richtung. Sonst verschöbe ein Vertipper in die Gegenrichtung, und
		// die Meldung sagte «ist jetzt Stufe 1» — was auch stimmte.
		const roh = text(d.get('richtung'));
		if (roh !== 'vor' && roh !== 'zurueck') {
			return fail(400, { fehler: { nachricht: 'Unbekannte Richtung.', feld: 'richtung' } });
		}
		return versuche(
			() => verschiebeKistufe(handelnder(locals), text(d.get('stufe')), roh),
			({ name, nummer }) => ({ hinweis: `«${name}» ist jetzt Stufe ${nummer}.` })
		);
	},

	stufeEntfernen: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() => entferneKistufe(handelnder(locals), text(d.get('stufe'))),
			({ name }) => ({ hinweis: `«${name}» ist aus der Kette entfernt.` })
		);
	},

	/**
	 * Der Befund geht **an die Stufe zurück**, auf deren Knopf gedrückt wurde,
	 * nicht als Meldung an den Seitenkopf. Gemeldet am 17.08.2026: «Es geschieht
	 * nicht viel, wenn ich auf Testen klicke.» Es geschah etwas — nur weit weg
	 * vom Knopf und in derselben Farbe wie der übrige Text.
	 */
	stufePruefen: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const d = await request.formData();
		const stufenId = text(d.get('stufe'));
		const nummer = ganzzahl(d.get('nummer')) ?? 1;
		return versuche(
			() =>
				pruefeKiVerbindung(
					locals.benutzer!.operatorId,
					stufenId === '' ? null : stufenId,
					nummer
				),
			(probe) => ({
				geprueft: { stufe: stufenId, nummer, ok: probe.ok, bemerkung: probe.bemerkung }
			})
		);
	},

	zeitstempel: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() =>
				setzeZeitstempeldienst(handelnder(locals), {
					url: text(d.get('url')),
					name: text(d.get('name')),
					fingerabdruecke: String(d.get('fingerabdruecke') ?? '')
				}),
			({ hinweise }) => ({ hinweis: 'Der Zeitstempeldienst ist eingetragen.', hinweise })
		);
	},

	zeitstempelEntfernen: async ({ locals }) => {
		return versuche(
			() => entferneZeitstempeldienst(handelnder(locals)),
			() => ({
				hinweis:
					'Der Zeitstempeldienst ist entfernt. Pakete werden weiterhin versiegelt, aber nicht ' +
					'mehr von aussen bezeugt.'
			})
		);
	},

	/**
	 * Nur die Probe, keine zweite Meldung am Seitenkopf: Der Kasten steht
	 * unmittelbar am Knopf und sagt dasselbe. Zweimal derselbe Satz an zwei
	 * Stellen liest sich wie zwei Ergebnisse.
	 */
	zeitstempelPruefen: async ({ locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		return versuche(
			() => holePruefzeitstempel(locals.benutzer!.operatorId, 'haupt'),
			(probe) => ({ probe })
		);
	},

	/**
	 * Der Ersatzdienst (13.11.2026). Eigene Handlungen, eigene Meldungen: Die
	 * beiden Kästen stehen untereinander, und eine Meldung am Seitenkopf liesse
	 * offen, welcher Dienst gemeint war.
	 */
	ersatz: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() =>
				setzeErsatzdienst(handelnder(locals), {
					url: text(d.get('url')),
					name: text(d.get('name')),
					fingerabdruecke: String(d.get('fingerabdruecke') ?? '')
				}),
			({ hinweise }) => ({ hinweis: 'Der Ersatzdienst ist eingetragen.', hinweise })
		);
	},

	ersatzEntfernen: async ({ locals }) => {
		return versuche(
			() => entferneErsatzdienst(handelnder(locals)),
			() => ({
				hinweis:
					'Der Ersatzdienst ist entfernt. Liefert der Hauptdienst keinen geprüften Stempel, ' +
					'bleibt das Siegel ohne Bezeugung.'
			})
		);
	},

	ersatzPruefen: async ({ locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		return versuche(
			() => holePruefzeitstempel(locals.benutzer!.operatorId, 'ersatz'),
			(probe) => ({ probe })
		);
	},

	anheften: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() => hefteAn(handelnder(locals), text(d.get('fingerabdruck')), 'haupt'),
			() => ({
				hinweis:
					'Das Zertifikat ist angeheftet. Ab jetzt wird jede Antwort abgewiesen, die nicht ' +
					'von diesem Aussteller unterschrieben ist.'
			})
		);
	},

	ersatzAnheften: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() => hefteAn(handelnder(locals), text(d.get('fingerabdruck')), 'ersatz'),
			() => ({
				hinweis:
					'Das Zertifikat ist beim Ersatzdienst angeheftet. Der Hauptdienst prüft weiter ' +
					'gegen seine eigene Liste.'
			})
		);
	},

	uebernehmen: async ({ locals }) => {
		return versuche(
			() => uebernimmAusUmgebung(handelnder(locals)),
			({ stufen, zeitstempel }) => ({
				hinweis:
					`Übernommen: ${stufen} KI-${stufen === 1 ? 'Stufe' : 'Stufen'}` +
					(zeitstempel ? ' und der Zeitstempeldienst' : '') +
					'. Die Einträge in der Umgebung können stehen bleiben — sie gelten nur noch, ' +
					'wenn hier nichts eingerichtet ist.'
			})
		);
	}
};
