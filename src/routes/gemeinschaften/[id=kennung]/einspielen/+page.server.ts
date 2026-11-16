import { error, fail, redirect } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { nimmAuf, vorschau } from '$lib/server/einspielen';
import { PAKET_HOECHSTGROESSE, PaketFehler } from '$lib/server/paketpruefung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';

/**
 * Eine anderswo geführte Versammlung hier aufnehmen (PRD §13, Rückführung).
 *
 * **Eigene Seite, nicht ein Knopf auf der Prüfseite.** Die Prüfseite sagt
 * ausdrücklich zu, nichts abzulegen — «ein Prüfwerkzeug, das eine Kopie behält,
 * wäre eine Datensammlung, die niemand bestellt hat». Wer ein fremdes Paket
 * bloss prüfen will, darf dabei nicht Gefahr laufen, es hier einzulagern.
 *
 * **Die Gemeinschaft steht in der Adresse**, nicht in einem Auswahlfeld: Wer
 * hier ist, ist schon in ihr. Das spart die Frage und damit die häufigste Art,
 * eine Versammlung am falschen Ort abzulegen.
 */

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');
	return { gemeinschaft };
};

/** Liest die hochgeladene Datei, mit denselben Schranken wie die Prüfseite. */
async function alsBytes(datei: unknown): Promise<Uint8Array | { fehler: string }> {
	if (!(datei instanceof File) || datei.size === 0) {
		return { fehler: 'Bitte ein Abschlusspaket wählen.' };
	}
	if (datei.size > PAKET_HOECHSTGROESSE) {
		return {
			fehler: `Das Paket ist grösser als ${PAKET_HOECHSTGROESSE / 1024 / 1024} MB und wird hier nicht gelesen.`
		};
	}
	return new Uint8Array(await datei.arrayBuffer());
}

export const actions: Actions = {
	/** Erster Schritt: zeigen, was aufgenommen würde. Nichts wird geschrieben. */
	pruefen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const bytes = await alsBytes(daten.get('paket'));
		if ('fehler' in bytes) return fail(400, { fehler: { nachricht: bytes.fehler } });

		try {
			const gesehen = await vorschau(
				locals.benutzer.operatorId,
				bytes,
				params.id,
				text(daten.get('siegel'))
			);
			return {
				...gesehen,
				dateiname: (daten.get('paket') as File).name,
				// Reist mit in den zweiten Schritt: Wer ein Siegel eingetippt hat,
				// soll es nicht ein zweites Mal abtippen — und die Prüfung dort muss
				// mit demselben Vergleichswert laufen wie die gezeigte.
				siegel: text(daten.get('siegel'))
			};
		} catch (fehler) {
			if (fehler instanceof PaketFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/** Zweiter Schritt: aufnehmen. Die Datei kommt noch einmal mit. */
	aufnehmen: async ({ locals, params, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const bytes = await alsBytes(daten.get('paket'));
		if ('fehler' in bytes) return fail(400, { fehler: { nachricht: bytes.fehler } });

		let ziel: string;
		try {
			const { id } = await nimmAuf(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				bytes,
				params.id,
				text(daten.get('herkunft')),
				text(daten.get('siegel'))
			);
			ziel = `/gemeinschaften/${params.id}/eingespielt/${id}`;
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			if (fehler instanceof PaketFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}

		// Weiter zur aufgenommenen Versammlung: Wer sie einspielt, will sehen, was
		// jetzt dasteht — nicht ein leeres Formular mit einer grünen Meldung.
		redirect(303, ziel);
	}
};
