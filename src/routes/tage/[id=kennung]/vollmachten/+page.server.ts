import { error } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { hausDesAbends, holeTafel } from '$lib/server/versammlungstag';
import {
	bestaetigeVollmacht,
	holeVollmachten,
	kennzeichneVerwaltung,
	vermerkeVorlage,
	weiseVollmachtZurueck,
	widerrufeVollmacht
} from '$lib/server/vollmacht';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import type { Vollmacht } from '$lib/domain/vollmacht';
import type { Actions, PageServerLoad } from './$types';

function handelnder(locals: App.Locals) {
	const b = locals.benutzer!;
	return { operatorId: b.operatorId, userId: b.id, label: b.displayName };
}

/**
 * Die Vollmachten des ganzen Abends an einer Stelle (Auftraggeber, 23.08.2026).
 *
 * «Der Einlass (Anwesenheit und Beschlussfähigkeit) muss aber über die Gruppe
 * gehen. Wie auch Vollmachten und Versammlung führen.»
 *
 * **Was hier zusammenkommt, ist die Sicht — nicht die Vollmacht.** Eine
 * Vollmacht gilt für eine Gemeinschaft: Wer in zwei Häusern Eigentümer ist,
 * erteilt zwei. Zusammengelegt würde aus zwei Erklärungen eine, und im
 * Anfechtungsfall stünde nicht mehr fest, wofür unterschrieben wurde. Die Zeile
 * nennt deshalb immer ihr Haus.
 *
 * **Was hier NICHT steht: das Erfassen.** Eine neue Vollmacht verlangt die
 * Auswahl von Bevollmächtigtem und Vertretenen — beides Parteien EINER
 * Gemeinschaft, mit ihren Sperrgründen («bereits anwesend», «bereits
 * bevollmächtigt an …»). Diese Auswahl hier zu wiederholen hiesse, sie an zwei
 * Stellen zu pflegen. Der Weg ins Haus steht an jeder Gruppe.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const tafel = await holeTafel(op, params.id);

	const haeuser = await Promise.all(
		tafel.map(async (z) => ({
			meetingId: z.meetingId,
			gemeinschaft: z.gemeinschaft,
			vollmachten: (await holeVollmachten(op, z.meetingId)).map((v) => ({
				id: v.id,
				vertreteneName: v.vertreteneName,
				bevollmaechtigt: v.bevollmaechtigtName ?? v.bevollmaechtigtId,
				// H-1 (07.11.2026): Das Merkmal «· Verwaltung» wie auf der Seite
				// je Versammlung, und die Kennung der Partei, an der die Knöpfe
				// hängen: Bei einer Partei dieser Versammlung gibt es sie nicht.
				bevollmaechtigtId: v.bevollmaechtigtId,
				istVerwaltung: v.istVerwaltung,
				zustand: v.zustand,
				nachweisVorgelegt: v.nachweisVorgelegt,
				anzahlDateien: v.anzahlDateien,
				// Für `istBestaetigbar`: Die eingetragene Mitberechtigte braucht
				// keinen Nachweis (Produktentscheid 03.11.2026).
				vertretungsgrund: v.vertretungsgrund,
				mitberechtigung: v.mitberechtigung,
				/*
				 * **Woher die Vollmacht kommt** (Bedienbarkeitsprüfung 05.09.2026,
				 * Befund 32). Ohne diese Angabe kann die Sicht nicht wissen, ob
				 * «Bestätigen» überhaupt durchgeht: `verlangeBestaetigbar` weist
				 * eine Vollmacht ohne Nachweis ab — es sei denn, sie kam über den
				 * Zugangsweg, dann ist die Erklärung selbst der Nachweis.
				 */
				herkunft: v.herkunft
			}))
		}))
	);

	return {
		tagId: params.id,
		haeuser,
		/** Was offen ist, entscheidet über den Aufwand im Saal — deshalb oben. */
		offen: haeuser.reduce(
			(summe, h) => summe + h.vollmachten.filter((v) => v.zustand === 'erfasst').length,
			0
		)
	};
};

function fachlich(fehler: unknown) {
	if (fehler instanceof FachlicherFehler) return { fehler: fehler.message };
	throw fehler;
}

/**
 * Vier Handlungen, eine Mechanik: prüfen, tun, den Saal nachziehen.
 *
 * Der **Grund** wird durchgereicht, wo der Kern ihn verlangt: Zurückweisen und
 * Widerrufen sind begründungspflichtig (`verlangeGrund`), und das ist keine
 * Formsache — im Protokoll steht später, warum eine Stimmkraft nicht übertragen
 * wurde.
 */
function handlung(
	tun: (
		h: ReturnType<typeof handelnder>,
		meetingId: string,
		id: string,
		grund: string
	) => Promise<unknown>,
	hinweis: string | ((ergebnis: unknown) => string)
) {
	return async ({ request, locals, params }: Parameters<Actions[string]>[0]) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id!, meetingId);
			const ergebnis = await tun(
				handelnder(locals),
				meetingId,
				text(daten.get('id')),
				text(daten.get('grund'))
			);
			// Die Wand zeigt Stimmkraft; eine bestätigte Vollmacht ändert sie.
			await verkuendeStand(locals.benutzer.operatorId, meetingId);
			return { hinweis: typeof hinweis === 'function' ? hinweis(ergebnis) : hinweis };
		} catch (fehler) {
			return fachlich(fehler);
		}
	};
}

export const actions: Actions = {
	/**
	 * Das Häkchen «Bevollmächtigt ist die Verwaltung» an einer bestehenden
	 * Vollmacht (L8, Migration 184; H-1, 07.11.2026): setzen und entfernen,
	 * wie auf der Seite je Versammlung. Ohne `verkuendeStand`, denn das
	 * Häkchen ändert keine Stimmkraft; die Wand bliebe dieselbe.
	 */
	verwaltung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const meetingId = text(daten.get('meeting'));
		try {
			await hausDesAbends(locals.benutzer.operatorId, params.id!, meetingId);
			const v = await kennzeichneVerwaltung(
				handelnder(locals),
				meetingId,
				text(daten.get('id')),
				daten.get('istVerwaltung') === 'ja'
			);
			return {
				hinweis: v.istVerwaltung
					? 'Gekennzeichnet: Bevollmächtigt ist die Verwaltung.'
					: 'Kennzeichnung entfernt.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},
	vorlegen: handlung(
		(h, m, id) => vermerkeVorlage(h, m, id),
		// Beim Nachweis der Mitberechtigung lag keine Vollmacht vor
		// (Codeprüfung 03.11.2026, M2; wie auf der Seite je Versammlung).
		(v) =>
			(v as Vollmacht).mitberechtigung === 'nicht_eingetragen'
				? 'Vermerkt: Der Nachweis der Mitberechtigung hat vorgelegen.'
				: 'Vermerkt: Das Original hat vorgelegen.'
	),
	bestaetigen: handlung(
		(h, m, id) => bestaetigeVollmacht(h, m, id),
		'Bestätigt — die Stimmkraft ist übertragen.'
	),
	zurueckweisen: handlung(
		(h, m, id, grund) => weiseVollmachtZurueck(h, m, id, grund),
		'Zurückgewiesen. Die Stimmkraft bleibt bei der vertretenen Person.'
	),
	widerrufen: handlung(
		(h, m, id, grund) => widerrufeVollmacht(h, m, id, grund),
		'Widerrufen. Die Stimmkraft fällt zurück.'
	)
};
