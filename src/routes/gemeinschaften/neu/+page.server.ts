import { error, fail, redirect } from '@sveltejs/kit';
import { erstelleGemeinschaft, listeGemeinschaften } from '$lib/server/gemeinschaften';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { ausFormular, formularwerte, text } from '$lib/server/formular';
import {
	aufnahmesatz,
	mitgliederAusFormular,
	nimmGemeinschaftenAlsMitgliederAuf
} from '$lib/server/mitgliedsgemeinschaften';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	// Auswahl der uebergeordneten Gemeinschaft — archivierte stehen nicht zur Wahl.
	const bestehende = await listeGemeinschaften(locals.benutzer.operatorId, 'aktiv');
	/*
	 * **Wer schon unter einer anderen steht, wird gekennzeichnet** (23.08.2026,
	 * Prüflauf II, A-26). Zulässig ist es — eine Zwischenebene mit eigenem Nenner
	 * trägt nach oben bei —, aber es baut eine dritte Stufe, und das soll man
	 * sehen, bevor man wählt.
	 */
	return {
		moeglicheEltern: bestehende.map((g) => ({
			id: g.id,
			name: g.name,
			schonKind: g.parentStwegId !== null
		})),
		/**
		 * Wer Mitglied einer Miteigentümergemeinschaft werden kann (Auftraggeber,
		 * 25.08.2026). Dieselbe Liste, andere Frage: Oben geht es um «gehört zu»,
		 * hier um «gehört mir».
		 */
		moeglicheMitglieder: bestehende.map((g) => ({ id: g.id, name: g.name }))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			const wer = {
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			};
			// Vor dem Anlegen gelesen: Werden Gemeinschaften Mitglied, verlangt
			// schon das Anlegen die Trägerschaft (Ä-43). Danach abgewiesen stünde
			// die Gemeinschaft ohne sie da.
			const mitglieder = mitgliederAusFormular(daten);
			const g = await erstelleGemeinschaft(wer, ausFormular(daten), mitglieder.length > 0);

			/*
			 * **Die Mitglieder gleich mit** (Auftraggeber, 25.08.2026: «Es wäre doch
			 * einfacher, wenn eine MEG, die aus Gemeinschaften besteht, direkt in
			 * Gemeinschaften anlegt und zuordnet»).
			 *
			 * Nur, wenn welche gewählt wurden — die beiden anderen Bauarten
			 * schicken das Feld gar nicht. Was dabei misslingt, hält den Rest nicht
			 * auf: Die Gemeinschaft steht dann, und der Weg dorthin führt auf ihre
			 * Eigentümerseite, wo sich der Rest nachtragen lässt. Ein Rückbau der
			 * frisch angelegten Gemeinschaft wäre schlimmer — er nähme auch das
			 * weg, was gelungen ist.
			 */
			if (mitglieder.length > 0) {
				/*
				 * **Eine Absage hier ist ein Teilerfolg, keine Absage des Ganzen**
				 * (Codeprüfung 07.10.2026). Die Gemeinschaft steht schon. Ging die
				 * Absage in den allgemeinen Zweig unten, kam das Formular samt
				 * Mitgliedern zurück, und das nächste Absenden legte eine zweite
				 * Gemeinschaft gleichen Namens an.
				 */
				let befund: Awaited<ReturnType<typeof nimmGemeinschaftenAlsMitgliederAuf>>;
				try {
					befund = await nimmGemeinschaftenAlsMitgliederAuf(
						wer,
						g.id,
						mitglieder,
						text(daten.get('ab'))
					);
				} catch (f) {
					if (!(f instanceof FachlicherFehler)) throw f;
					return {
						angelegt: g.id,
						hinweis: `Die Gemeinschaft ist angelegt, die Mitglieder noch nicht: ${f.message}`
					};
				}
				if (befund.offen.length > 0) {
					// Kein `redirect`: Die Meldung ginge dabei verloren, und genau sie
					// nennt die Häuser, die noch fehlen.
					return { angelegt: g.id, hinweis: aufnahmesatz(befund) };
				}
			}
			redirect(303, `/gemeinschaften/${g.id}`);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die Eingaben zurückgeben, damit das Formular nicht leer neu erscheint.
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: formularwerte(daten, ['aiDisabledFunctions', 'mitglied'])
				});
			}
			throw fehler;
		}
	}
};
