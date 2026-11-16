import { error, fail } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { ganzzahl, jaNein, text } from '$lib/server/formular';
import {
	entferneBriefkopf,
	hinterlegeBriefkopf,
	holeBetreiber,
	setzeBetreiberbezeichnung,
	setzeErinnerungsadresse,
	setzeKiHinweise
} from '$lib/server/betreiber';
import { DateiFehler } from '$lib/server/dateien';
import { istEingerichtet } from '$lib/server/mail';
import { darfStammdatenAendern, VERWALTUNG_VORBEHALTEN } from '$lib/domain/rollen';
import { erhebeLage, loescheBetriebsdaten } from '$lib/server/aufbewahrung';
import type { Actions, PageServerLoad } from './$types';

/**
 * **Der Verwaltung vorbehalten, auch das Lesen** (26.08.2026, aus dem
 * Code-Review).
 *
 * Der Riegel fehlte hier als einziger unter `/betreiber`; die beiden
 * Schwesterseiten tragen ihn seit dem Durchlauf vom 13.08.2026 mit der
 * Begründung «Ändern konnte sie nichts — aber lesen genügt hier schon».
 * Schreiben war geschützt (`verlangtVerwaltung` im Hook), Lesen nicht:
 * `rollen.ts` steigt bei GET und HEAD sofort aus, der Hook greift dort also
 * nie.
 *
 * Aufgefallen ist es, weil die Pakettabelle Versammlungsdatum, Ort und das
 * versiegelnde Konto dazubekam — eine Sitzungsleitung, die für einen Abend ein
 * Konto erhält, hätte damit den ganzen Bestand des Betreibers gelesen. Der
 * Kommentar in `+layout.svelte` behauptete ohnehin schon, hierher komme sie
 * nie.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);
	const betreiber = await holeBetreiber(locals.benutzer.operatorId);
	if (!betreiber) error(404, 'Betreiber nicht gefunden');
	const aufbewahrung = await erhebeLage(locals.benutzer.operatorId);
	/*
	 * **Ob überhaupt etwas hinausgehen kann.** Eine Adresse für Erinnerungen
	 * ohne eingerichteten Mailausgang wäre ein Feld, das nichts bewirkt — und
	 * das erführe man erst, wenn die Erinnerung ausbleibt.
	 */
	return {
		betreiber,
		aufbewahrung,
		mailausgangEingerichtet: istEingerichtet(),
		// Nach dem Löschen einer Versammlung kommt man hierher zurück, und die
		// Meldung sagt, was weg ist (dasselbe Muster wie `/versammlungen`).
		geloescht: url.searchParams.get('geloescht')
	};
};

export const actions: Actions = {
	briefkopf: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await hinterlegeBriefkopf(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				daten.get('datei') as File,
				ganzzahl(daten.get('hoeheMm')),
				jaNein(daten.get('alleSeiten'))
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler || fehler instanceof DateiFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/** Der Name der Bewirtschaftung — er steht als Absender auf der Einladung. */
	bezeichnung: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const { name } = await setzeBetreiberbezeichnung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				String(daten.get('name') ?? '')
			);
			return { hinweis: `Die Bewirtschaftung heisst jetzt «${name}».` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'bezeichnung',
					werte: { name: String(daten.get('name') ?? '') },
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	kihinweise: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const ausblenden = await setzeKiHinweise(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			jaNein(daten.get('ausblenden')),
			jaNein(daten.get('vermerk'))
		);
		return {
			hinweis: ausblenden
				? 'Gespeichert. KI-Hinweise ausgeblendet; zugelassene Funktionen bleiben sichtbar.'
				: 'Gespeichert.'
		};
	},

	/**
	 * Die Adresse für Erinnerungen (Migration 099).
	 *
	 * Ein leeres Feld ist eine gültige Antwort und heisst «nicht erinnern» —
	 * deshalb keine Pflichtangabe und keine Rückfrage.
	 */
	erinnerungsadresse: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const eingabe = text(daten.get('erinnerungsadresse'));
		try {
			const adresse = await setzeErinnerungsadresse(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				eingabe
			);
			return {
				hinweis: adresse
					? `Gespeichert. Erinnerungen gehen an ${adresse}.`
					: 'Gespeichert. Ohne Adresse wird nicht erinnert.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				/*
				 * **Die abgewiesene Eingabe geht zurück** (01.09.2026, aus dem
				 * Code-Review), wie bei der Bezeichnung darüber. Sonst liest das
				 * Feld wieder den Datenbankstand, und der Vertipper ist weg — zu
				 * berichtigen gäbe es dann nichts mehr.
				 */
				return fail(400, {
					quelle: 'erinnerungsadresse',
					werte: { erinnerungsadresse: eingabe },
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Betriebsdaten einer geschlossenen Versammlung löschen (FR-57).
	 *
	 * Von Hand ausgelöst, nicht als nächtlicher Auftrag: Was weg ist, ist weg,
	 * und dafür soll jemand gedrückt haben.
	 */
	betriebsdaten: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const befund = await loescheBetriebsdaten(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				String(daten.get('versammlung') ?? '')
			);
			return {
				hinweis:
					`Gelöscht: ${befund.zugaenge} Zugangscodes, ${befund.sitzungen} Gerätesitzungen, ` +
					`${befund.saalmeldungen} Saalmeldungen. Anwesenheit, Stimmen und Verlauf bleiben.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// `quelle` und die Kennung: Die Absage gehört in **diese** Zeile,
				// nicht an den Seitenkopf — mit `use:enhance` springt die Seite
				// nicht mehr dorthin (25.08.2026).
				return fail(400, {
					quelle: 'betriebsdaten',
					versammlung: String(daten.get('versammlung') ?? ''),
					fehler: { nachricht: fehler.message }
				});
			}
			throw fehler;
		}
	},

	entfernen: async ({ locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		await entferneBriefkopf({
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		});
		return { entfernt: true };
	}
};
