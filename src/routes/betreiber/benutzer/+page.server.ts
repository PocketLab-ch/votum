import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	ROLLEN,
	VERWALTUNG_VORBEHALTEN,
	darfStammdatenAendern,
	rolleInWorten,
	type Rolle
} from '$lib/domain/rollen';
import { MINDESTLAENGE } from '$lib/domain/kennwort';
import { datumLang, tagVon } from '$lib/domain/datum';
import { text } from '$lib/server/formular';
import {
	aendereRolle,
	holeKonten,
	legeKontoAn,
	setzeAngaben,
	setzeAusserDienst,
	setzeKennwort,
	setzeVerknuepfungsfenster,
	loeseVerknuepfung
} from '$lib/server/benutzer';
import { istEingerichtet } from '$lib/server/authentik';
import type { Actions, PageServerLoad } from './$types';

/**
 * Konten führen (13.08.2026).
 *
 * Unter `/betreiber`, also im Verwaltungsbereich — der Rollenwächter in
 * `hooks.server.ts` schützt damit jede **Änderung** hier, ohne dass diese Datei
 * etwas dafür tun muss.
 *
 * **Das Lesen aber nicht**, und das ist hier zu wenig. Die allgemeine Regel
 * lautet: Lesen ist für beide Rollen offen, weil eine Sitzungsleitung ohne
 * Einsicht in die Stammdaten keine Versammlung führen könnte
 * (`domain/rollen.ts`). Eine Kontenliste ist aber keine Stammdatenliste — sie
 * sagt, wer überhaupt hereinkommt und mit welchen Rechten, samt der Angabe,
 * welches Konto gerade angemeldet ist. Das ist eine Auskunft über die
 * Zugangswege selbst, und die geht nur die Verwaltung an.
 *
 * Gefunden im Durchlauf vom 13.08.2026: Die Sitzungsleitung sah die ganze
 * Liste. Ändern konnte sie nichts — aber lesen genügt hier schon.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);
	return {
		konten: await holeKonten(locals.benutzer.operatorId),
		eigenesKonto: locals.benutzer.id,
		rollen: ROLLEN.map((r) => ({ wert: r, name: rolleInWorten(r) })),
		mindestlaenge: MINDESTLAENGE,
		authentikEingerichtet: istEingerichtet()
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

/** Ein fachlicher Fehler wird zur Meldung am Feld, nicht zu einem Absturz. */
async function versuche<T>(fn: () => Promise<T>, erfolg: (wert: T) => { hinweis: string }) {
	try {
		return erfolg(await fn());
	} catch (fehler) {
		if (fehler instanceof FachlicherFehler) {
			return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
		}
		throw fehler;
	}
}

export const actions: Actions = {
	anlegen: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() =>
				legeKontoAn(handelnder(locals), {
					username: text(d.get('username')),
					displayName: text(d.get('displayName')),
					email: text(d.get('email')),
					rolle: text(d.get('rolle')) as Rolle,
					kennwort: String(d.get('kennwort') ?? ''),
					wiederholung: String(d.get('wiederholung') ?? '')
				}),
			(konto) => ({ hinweis: `Konto «${konto.username}» ist angelegt.` })
		);
	},

	kennwort: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() =>
				setzeKennwort(
					handelnder(locals),
					text(d.get('konto')),
					String(d.get('kennwort') ?? ''),
					String(d.get('wiederholung') ?? '')
				),
			({ entwertet }) => ({
				hinweis:
					'Das Kennwort ist gesetzt.' +
					(entwertet > 0
						? ` ${entwertet} angemeldete ${entwertet === 1 ? 'Sitzung wurde' : 'Sitzungen wurden'} beendet.`
						: '')
			})
		);
	},

	rolle: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() => aendereRolle(handelnder(locals), text(d.get('konto')), text(d.get('rolle')) as Rolle),
			() => ({ hinweis: 'Die Rolle ist geändert.' })
		);
	},

	angaben: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() =>
				setzeAngaben(
					handelnder(locals),
					text(d.get('konto')),
					text(d.get('displayName')),
					text(d.get('email'))
				),
			() => ({ hinweis: 'Name und Adresse sind gespeichert.' })
		);
	},

	/**
	 * Öffnet oder schliesst das Fenster für die Erstverknüpfung.
	 *
	 * **Der Hinweis nennt das Datum und nicht «erledigt».** Wer ein Fenster
	 * öffnet, muss jemandem sagen können, bis wann er sich anmelden soll; eine
	 * Meldung ohne die Frist zwänge dazu, sie in der Liste nachzuschlagen.
	 */
	verknuepfung: async ({ request, locals }) => {
		const d = await request.formData();
		const offen = text(d.get('offen')) === 'ja';
		return versuche(
			() => setzeVerknuepfungsfenster(handelnder(locals), text(d.get('konto')), offen),
			({ offenBis }) => ({
				hinweis: offenBis
					? `Die erste Anmeldung über Authentik steht bis zum ${datumLang(tagVon(offenBis))} offen.`
					: 'Die Erstverknüpfung ist geschlossen.'
			})
		);
	},

	/**
	 * Löst die Verknüpfung eines fremden oder des eigenen Kontos.
	 *
	 * **Die eigene Sitzung wird hier NICHT geschont**, anders als auf «Mein
	 * Konto». Wer von der Kontenliste aus löst, handelt als Verwaltung an einem
	 * Konto — im Zweifel, weil die Identität dahinter nicht mehr stimmt. Dass
	 * dabei auch die eigene Anmeldung endet, wenn es das eigene Konto ist, ist die
	 * sichere Richtung; der schonende Weg steht unter «Mein Konto» offen.
	 */
	loesen: async ({ request, locals }) => {
		const d = await request.formData();
		return versuche(
			() => loeseVerknuepfung(handelnder(locals), text(d.get('konto'))),
			({ entwertet }) => ({
				hinweis:
					'Die Verknüpfung mit Authentik ist gelöst.' +
					(entwertet > 0
						? ` ${entwertet} angemeldete ${entwertet === 1 ? 'Sitzung wurde' : 'Sitzungen wurden'} beendet.`
						: '')
			})
		);
	},

	dienst: async ({ request, locals }) => {
		const d = await request.formData();
		const ausserDienst = text(d.get('ausserDienst')) === 'ja';
		return versuche(
			() => setzeAusserDienst(handelnder(locals), text(d.get('konto')), ausserDienst),
			({ entwertet }) => ({
				hinweis: ausserDienst
					? 'Das Konto steht ausser Dienst.' +
						(entwertet > 0 ? ` ${entwertet} angemeldete Sitzung${entwertet === 1 ? '' : 'en'} beendet.` : '')
					: 'Das Konto ist wieder in Dienst.'
			})
		);
	}
};
