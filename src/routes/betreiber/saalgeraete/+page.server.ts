import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/fehler';
import { VERWALTUNG_VORBEHALTEN, darfStammdatenAendern } from '$lib/domain/rollen';
import { GEHEIMNIS_ERZEUGEN, GEHEIMNIS_VARIABLE, TresorFehler, tresorBereit } from '$lib/server/tresor';
import { GeraetecodeFehler } from '$lib/server/saalgeraet';
import {
	holeEigenesGeraet,
	holeGeraete,
	registriereGeraet,
	richteEigenesGeraetEin,
	widerrufeGeraet
} from '$lib/server/geraete';
import type { Actions, PageServerLoad } from './$types';

/**
 * Saalgeräte (18.09.2026).
 *
 * **Eine Seite für beide Rollen**, weil dieselbe Anwendung beides sein kann:
 * das Notebook, das im Saal steht, und die Stelle, die dorthin abgibt. Oben das
 * eigene Gerät, unten die Gegenstellen.
 *
 * **Der Verwaltung vorbehalten, auch das Lesen** — dieselbe Überlegung wie bei
 * den äusseren Diensten: Hier steht, wohin eine ganze Versammlung samt
 * Eigentümerliste gehen darf.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

	return {
		eigenes: await holeEigenesGeraet(),
		geraete: await holeGeraete(locals.benutzer.operatorId),
		/*
		 * Ohne Geheimnis in der Umgebung lässt sich der geheime Teil nicht ablegen.
		 * Die Seite sagt das **vor** dem Ausfüllen, nicht beim Speichern: Ein
		 * Formular, dessen Absenden an einer Voraussetzung scheitert, ist der Weg,
		 * Eingaben zu verlieren.
		 */
		tresor: { bereit: tresorBereit(), variable: GEHEIMNIS_VARIABLE, erzeugen: GEHEIMNIS_ERZEUGEN }
	};
};

function handelnderAus(benutzer: App.Locals['benutzer']) {
	return {
		operatorId: benutzer!.operatorId,
		userId: benutzer!.id,
		label: benutzer!.displayName
	};
}

export const actions: Actions = {
	einrichten: async ({ locals, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

		const formular = await request.formData();
		try {
			const eigenes = await richteEigenesGeraetEin(String(formular.get('name') ?? ''));
			return {
				hinweis: `Dieses Gerät heisst jetzt «${eigenes.name}». Übertragen Sie den Code auf die Stelle, die abgibt.`
			};
		} catch (fehler) {
			if (fehler instanceof TresorFehler) {
				return fail(400, { fehler: fehler.message, feld: 'name' });
			}
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: fehler.message, feld: fehler.feld });
			}
			throw fehler;
		}
	},

	eintragen: async ({ locals, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

		const formular = await request.formData();
		try {
			const geraet = await registriereGeraet(
				handelnderAus(locals.benutzer),
				String(formular.get('name') ?? ''),
				String(formular.get('code') ?? '')
			);
			return {
				hinweis: `«${geraet.name}» ist eingetragen. Vergleichen Sie den Fingerabdruck mit dem auf dem Gerät, bevor Sie das erste Mal abgeben.`
			};
		} catch (fehler) {
			if (fehler instanceof GeraetecodeFehler) {
				return fail(400, { fehler: fehler.message, feld: 'code' });
			}
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: fehler.message, feld: fehler.feld });
			}
			throw fehler;
		}
	},

	widerrufen: async ({ locals, request }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);

		const formular = await request.formData();
		try {
			await widerrufeGeraet(
				handelnderAus(locals.benutzer),
				String(formular.get('id') ?? ''),
				String(formular.get('grund') ?? '')
			);
			return { hinweis: 'Das Gerät ist widerrufen. An dieses Gerät wird nichts mehr abgegeben.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: fehler.message, feld: fehler.feld });
			}
			throw fehler;
		}
	}
};
