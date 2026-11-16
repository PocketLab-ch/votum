import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import {
	aenderePerson,
	einheitenDerPerson,
	frueheresEigentumDerPerson,
	einheitenMitEigentuemerAm,
	entfernePerson,
	holePersonen,
	ordneEinheitZuPerson
} from '$lib/server/personen';
import { holeHuellenDerPerson } from '$lib/server/mitberechtigte';
import { mitAbsage } from '$lib/server/absage';
import type { Actions, PageServerLoad } from './$types';

/**
 * Ein Eigentümer und alles, was er hält — über die Gemeinschaften hinweg.
 *
 * Der Zuschnitt beantwortet die Frage, mit der die Bewirtschaftung anfängt:
 * «Was hat Herr Probère?» Bisher musste man sie in sieben Gemeinschaften einzeln
 * stellen.
 *
 * **Der Stichtag kommt aus der Adresszeile** (`?stichtag=`, Block B2,
 * 16.10.2026). Ein ungültiger Wert warf in den Ladefunktionen eine rohe
 * Ausnahme (500); `verlangeStichtag` prüft ihn, `mitAbsage` übersetzt die
 * Absage in `error(400, …)`.
 */
export const load: PageServerLoad = mitAbsage(async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
	const stichtag = url.searchParams.get('stichtag') || heute;

	const personen = await holePersonen(op, 'alle');
	const person = personen.find((p) => p.id === params.id);
	if (!person) error(404, 'Eigentümer nicht gefunden');

	/*
	 * **In welchen Hüllen diese Person steckt** (26.08.2026, Aufgabe 4).
	 *
	 * Ohne diese Angabe stünde bei einem Mitberechtigten «Diesem Eigentümer ist
	 * noch keine Einheit zugeordnet» — richtig gerechnet und trotzdem
	 * irreführend: Die Einheit hält die Hülle. Wer das liest, hält die Zeile für
	 * eine Karteileiche. Genau daran ist die Laienprüfung am 26.08.2026
	 * hängengeblieben.
	 */
	const huellen = await holeHuellenDerPerson(op, params.id);

	const [einheiten, frueher, belegung] = await Promise.all([
		einheitenDerPerson(op, params.id, stichtag),
		/**
		 * Was diese Person früher hielt (Auftraggeber, 01.09.2026).
		 *
		 * Die Gegenrichtung zur Eigentumshistorie an der Gemeinschaft: Dort steht
		 * die Kette je Einheit, hier die Spur einer Person durch die Häuser.
		 */
		frueheresEigentumDerPerson(op, params.id, stichtag),
		// Die Handlung zeigt immer den heutigen Eigentumsstand. Der optionale
		// Seitenstichtag bleibt allein für die historische Liste oben massgeblich.
		einheitenMitEigentuemerAm(op, heute)
	]);

	const gruppen = new Map<
		string,
		{ stwegId: string; gemeinschaft: string; einheiten: { id: string; label: string; eigentuemer: string | null }[] }
	>();
	for (const e of belegung) {
		if (e.eigentuemer?.personId === params.id) continue;
		let gruppe = gruppen.get(e.stwegId);
		if (!gruppe) {
			gruppe = { stwegId: e.stwegId, gemeinschaft: e.gemeinschaft, einheiten: [] };
			gruppen.set(e.stwegId, gruppe);
		}
		gruppe.einheiten.push({ id: e.unitId, label: e.label, eigentuemer: e.eigentuemer?.name ?? null });
	}
	const auswahl = [...gruppen.values()];

	return { person, einheiten, frueher, huellen, auswahl, stichtag, heute, belegungsstichtag: heute };
});

/** Der Handelnde aus der Sitzung. */
function handelnder(benutzer: NonNullable<App.Locals['benutzer']>) {
	return { operatorId: benutzer.operatorId, userId: benutzer.id, label: benutzer.displayName };
}

export const actions: Actions = {
	/**
	 * Die Stammangaben berichtigen (22.08.2026, Befund A-03).
	 *
	 * Der Weg, den es bis dahin nicht gab: Erfassen ging, ändern nicht.
	 */
	/** Archivieren und Hervorholen (Migration 086). */
	archivieren: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const { name } = await archiviere(
				handelnder(locals.benutzer),
				'person',
				params.id,
				text(daten.get('notiz'))
			);
			return {
				hinweis: `«${name}» liegt im Archiv — aus der Eigentümerliste genommen, sonst unverändert.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die getippte Begründung reist mit zurück (25.08.2026).
				return fail(400, {
					quelle: 'archiv',
					notiz: text(daten.get('notiz')) ?? '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	hervorholen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const { name } = await holeAusArchiv(handelnder(locals.benutzer), 'person', params.id);
			return { hinweis: `«${name}» steht wieder in der Eigentümerliste.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Person löschen — endgültig, und nur wenn nichts daran hängt.
	 *
	 * Auftraggeber, 25.08.2026: «Personen sollen eine Löschung bekommen, wenn sie keiner
	 * Einheit zugeordnet sind.» Bis dahin gab es nur das Archiv; eine
	 * versehentlich doppelt erfasste Person blieb für immer im Bestand.
	 *
	 * Nach dem Löschen führt kein Weg mehr auf diese Seite — deshalb zurück zur
	 * Liste, und die Meldung reist über die Adresse mit: Die gelöschte Person
	 * hat keine Seite mehr, auf der sie stehen könnte.
	 */
	entfernen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		let name: string;
		try {
			({ name } = await entfernePerson(handelnder(locals.benutzer), params.id));
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'entfernen',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
		redirect(303, `/personen?geloescht=${encodeURIComponent(name)}`);
	},

	aendern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const person = await aenderePerson(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				{
					name: text(daten.get('name')),
					email: text(daten.get('email')) || null,
					telefon: text(daten.get('telefon')) || null,
					adresse: text(daten.get('adresse')) || null,
					bemerkung: text(daten.get('bemerkung')) || null
				}
			);
			return { hinweis: `Die Angaben zu ${person.name} sind berichtigt.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	zuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const unitId = text(daten.get('unitId'));
		const ab = text(daten.get('ab'));
		const notiz = text(daten.get('notiz')) || undefined;
		const bestaetigt = text(daten.get('bestaetigt')) === 'true';
		try {
			const ergebnis = await ordneEinheitZuPerson(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				unitId,
				ab,
				notiz,
				bestaetigt
			);
			if (ergebnis.rueckfrage) {
				return fail(409, {
					rueckfrage: { ...ergebnis.rueckfrage, unitId, notiz: notiz ?? '' }
				});
			}
			return {
				hinweis: `«${ergebnis.einheit}» ist ${ergebnis.person} zugeordnet.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
