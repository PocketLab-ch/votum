import { error, fail } from '@sveltejs/kit';
import { holeVersammlung } from '$lib/server/versammlungen';
import { holeVorbereitung } from '$lib/server/uebersicht';
import { holeVersandvermerk, vermerkeVersand } from '$lib/server/versandvermerk';
import { holeNeuversandHinweis } from '$lib/server/einladungsmehr';
import type { Actions, PageServerLoad } from './$types';

/**
 * Der geführte Vorbereitungsablauf (Story 6.2, FR-65).
 *
 * Die Seite bleibt auch nach der Versammlung erreichbar: Sie ist dann eine
 * Zusammenfassung dessen, was geschehen ist, und der kürzeste Weg zur
 * Auswertung.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const vorbereitung = await holeVorbereitung(locals.benutzer.operatorId, params.id);
	if (!vorbereitung) error(404, 'Versammlung nicht gefunden');

	const vermerk = await holeVersandvermerk(locals.benutzer.operatorId, params.id);
	// Das Mehr ist seit der Freigabe milder geworden: Die berichtigte Einladung
	// steht aus (Migration 144, `einladungsmehr.ts`).
	const neuversand = await holeNeuversandHinweis(locals.benutzer.operatorId, params.id);

	return { versammlung, ...vorbereitung, vermerk, neuversand };
};

export const actions: Actions = {
	/**
	 * «Die Einladung ist hinausgegangen» — von Hand gesagt.
	 *
	 * Vom 06.10.2026 bis 07.10.2026 hiess der Haken «Die Einladung ist bei allen
	 * angekommen» (Produktentscheid 06.10.2026), seit dem Produktentscheid
	 * 07.10.2026 («Nur noch aufmerksam machen») «Die Einladung ist verschickt».
	 * Nach einer Milderung nimmt er zusätzlich den Hinweis zur berichtigten
	 * Einladung weg; am Mehr ändert er nichts.
	 *
	 * **Ein Hilfsmittel, kein Zwangsinstrument** (Auftraggeber, 02.09.2026). Der Vermerk
	 * schaltet die Fristwarnung und die Erinnerungsmail ab, sonst nichts: keine
	 * Rechte, keine Schranke, kein Schritt gilt dadurch als erledigt. Deshalb
	 * darf ihn jeder setzen, der die Versammlung bearbeiten darf, und deshalb ist
	 * er umkehrbar.
	 *
	 * **Warum es keinen Zustand zu prüfen gibt.** Auch nach der Eröffnung bleibt
	 * die Aussage wahr oder falsch; sie richtig zu stellen, muss möglich sein.
	 * Was sie beeinflusst — Warnung und Erinnerung — hört nach der Versammlung
	 * ohnehin von selbst auf.
	 */
	versandVermerken: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) return fail(404, { fehler: { nachricht: 'Versammlung nicht gefunden' } });

		const daten = await request.formData();
		/*
		 * **Der Zustand kommt aus dem Formular, nicht aus dem Bestand.** Ein
		 * Umschalten («setze auf das Gegenteil») verrechnet sich, wenn zwei Leute
		 * gleichzeitig klicken oder jemand die Seite zweimal offen hat: Beide
		 * lesen «nicht vermerkt», beide schalten um, einer hebt den anderen auf.
		 * Das Kästchen sagt, was es sein soll.
		 *
		 * **Und seit dem 02.09.2026 tut es das auch.** Bis dahin schickte ein
		 * verstecktes Feld `data.vermerk.gesetzt ? 'false' : 'true'` — genau das
		 * Umschalten, gegen das dieser Absatz argumentiert, nur eingefroren im
		 * Augenblick des Renderns. Jetzt trägt das Kästchen selbst `name` und
		 * `value="true"`; ist es leer, kommt nichts an, und das heisst «false».
		 */
		const gesetzt = daten.get('gesetzt') === 'true';

		await vermerkeVersand(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			versammlung.id,
			gesetzt
		);
		return { vermerkt: gesetzt };
	}
};
