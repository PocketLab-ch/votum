import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { abendsiegelsatz } from '$lib/domain/beschlussfaehigkeit';
import { versiegleAmAbend } from '$lib/server/abendsteuerung';
import { holeSiegel, erhebeSiegellage } from '$lib/server/siegel';
import { holeOhneErgebnisUndVermerk } from '$lib/server/protokoll';
import { hinweisVorDemVersiegeln } from '$lib/domain/protokoll';
import { holeTafel, holeVersammlungstag } from '$lib/server/versammlungstag';
import { siegelangaben } from './siegelangaben';
import type { Actions, PageServerLoad } from './$types';

function handelnder(locals: App.Locals) {
	const b = locals.benutzer!;
	return { operatorId: b.operatorId, userId: b.id, label: b.displayName };
}

/**
 * Versiegeln am gemeinsamen Abend — ein Knopf, ein Paket je Gemeinschaft.
 *
 * **Warum es kein gemeinsames Siegel gibt** (Auftraggeber, 25.08.2026: «Warum kann
 * nicht auf der Stufe Gruppe versiegelt werden?»): Die Begründung steht im
 * Kern bei `versiegleAmAbend` und ausführlich in `docs/vererbung-abend.md`.
 * Kurz: Acht der neun Bestandteile eines Abschlusspakets gibt es nur je
 * Gemeinschaft.
 *
 * Diese Seite nimmt deshalb nicht die Trennung weg, sondern das Klicken.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const tag = await holeVersammlungstag(op, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	/*
	 * Die Tafel und nicht `holeAbendhaeuser`: Nur sie trägt den **Zustand** der
	 * Versammlung, und der entscheidet hier alles — versiegelt wird, was
	 * geschlossen ist.
	 */
	const haeuser = await holeTafel(op, params.id);
	const zeilen = await Promise.all(
		haeuser.map(async (h) => {
			/*
			 * **Für ein geschlossenes Haus ist `erhebeSiegellage` die einzige
			 * Quelle.** Sie liest das Siegel selbst und kennt die Hindernisse;
			 * ein zweiter, früherer Blick auf das Siegel daneben ging nur
			 * auseinander: Wurde das Haus dazwischen versiegelt, las die Zeile
			 * einen leeren Grund und stand auf «bereit». Für die übrigen
			 * Zustände bleibt es beim Siegel allein; ein Haus in Vorbereitung
			 * oder im Gang steht weiter mit seinem Zustandsnamen da.
			 */
			// zustand-nur-geschlossen: Hier geht es um den Schritt VOR dem Siegel.
			const geschlossen = h.zustand === 'geschlossen';
			const lage = geschlossen ? await erhebeSiegellage(op, h.meetingId) : null;
			const siegel = lage ? null : await holeSiegel(op, h.meetingId);
			const angaben = siegelangaben(siegel, lage);
			return {
				versammlungId: h.meetingId,
				gemeinschaft: h.gemeinschaft,
				zustand: h.zustand,
				...angaben,
				/*
				 * Derselbe Hinweis wie auf der Siegelseite der Versammlung (Block
				 * 7c), nur für die Häuser, die der Knopf unten gleich versiegelt.
				 * Ein Haus, dessen Siegel schon dasteht, braucht ihn nicht.
				 */
				// zustand-nur-geschlossen: der Zustand vor dem Siegel, wie unten in der Seite.
				hakenhinweis:
					geschlossen && !angaben.siegelkopf
						? hinweisVorDemVersiegeln(await holeOhneErgebnisUndVermerk(op, h.meetingId))
						: null
			};
		})
	);

	return {
		tagId: params.id,
		zeilen,
		/** Wie viele noch fehlen — die Zahl entscheidet, ob der Knopf lohnt. */
		offen: zeilen.filter((z) => !z.siegelkopf).length
	};
};

export const actions: Actions = {
	versiegeln: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const e = await versiegleAmAbend(
				handelnder(locals),
				params.id,
				// In hiesiger Zeit, wie bei der einzelnen Versammlung: Der Stempel
				// steht später neben Uhrzeiten, die niemand umrechnet (AD-12).
				new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' })
			);
			if (e.gelungen === 0) {
				return fail(400, {
					fehler:
						e.offen.length > 0
							? `Nirgends möglich: ${e.offen
									.map((o) => `${o.gemeinschaft} (${o.grund})`)
									.join(', ')}`
							: 'Zu diesem Abend gehört keine Gemeinschaft.'
				});
			}
			const nicht =
				e.offen.length > 0
					? ` Nicht versiegelt: ${e.offen
							.map((o) => `${o.gemeinschaft} (${o.grund})`)
							.join(', ')}.`
					: '';
			return { hinweis: `${abendsiegelsatz(e.befunde)}${nicht}` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return fail(400, { fehler: fehler.message });
			throw fehler;
		}
	}
};
