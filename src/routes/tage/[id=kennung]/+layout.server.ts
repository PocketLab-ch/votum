import { error } from '@sveltejs/kit';
import { holeTafel, holeVersammlungstag } from '$lib/server/versammlungstag';
import { holeAbendhaeuser } from '$lib/server/uebersicht';
import { holeGeschaefte } from '$lib/server/geschaeft';
import { gemeinsameSchritte } from '$lib/domain/gemeinsamerablauf';
import { protokollluecke } from '$lib/domain/gemeinsamesprotokoll';
import { vorbereitungsfortschritt } from '$lib/domain/vorbereitung';
import { datumLang } from '$lib/domain/datum';
import type { Versammlungszustand } from '$lib/domain/versammlung';
import type { LayoutServerLoad } from './$types';

/**
 * Der Rahmen einer gemeinsamen Versammlung — dieselbe Bauart wie bei einer
 * einzelnen (`versammlungen/[id]/+layout.server.ts`).
 *
 * Bis zum 11.08.2026 hatte diese Seite keinen Rahmen: vier Abschnitte
 * untereinander, keine Leiste, keine Führung. Wer sie öffnete, kam aus der
 * Einzelversammlung und stand vor einer Seite, die von derselben Sache handelte
 * und völlig anders aussah.
 */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const op = locals.benutzer.operatorId;

	const tag = await holeVersammlungstag(op, params.id);
	if (!tag) error(404, 'Gemeinsame Versammlung nicht gefunden');

	const [tafel, haeuser, geschaefte] = await Promise.all([
		holeTafel(op, params.id),
		holeAbendhaeuser(op, params.id),
		holeGeschaefte(op, params.id)
	]);

	/*
	 * «Stammdaten offen» zählt dieselben vier Schritte, die im Register stehen —
	 * aus derselben Rechnung wie die Ablaufleiste einer Versammlung. Eine eigene
	 * Zählung daneben liefe beim ersten neuen Schritt auseinander.
	 */
	const THEMEN = ['einheiten', 'eigentuemer', 'reglement', 'beschlussfaehigkeit'];
	const stammdatenOffen = haeuser.filter((h) =>
		h.schritte.some((s) => THEMEN.includes(s.kennung) && s.zustand !== 'erledigt')
	).length;

	// Je Thema getrennt, denn jedes ist ein eigener Schritt in der Leiste.
	const themenOffen = Object.fromEntries(
		THEMEN.map((k) => [
			k,
			haeuser.filter((h) => h.schritte.some((s) => s.kennung === k && s.zustand !== 'erledigt'))
				.length
		])
	);

	const abgeschlossen = tafel.filter(
		(z) => z.zustand === 'geschlossen' || z.zustand === 'versiegelt'
	).length;

	/*
	 * Die Lücke der Zusammenstellung (Story 7.5b) kommt fertig aus dem Kern —
	 * dieselbe Rechnung, die auf der Seite selbst steht. Gezählt wird sie nur,
	 * wenn der Schritt überhaupt offen ist: Solange nichts geschlossen ist, sagt
	 * schon der Sperrgrund, was fehlt, und die Abfragen über sieben Versammlungen
	 * wären für nichts.
	 */
	const lueckeDerZusammenstellung =
		abgeschlossen > 0
			? protokollluecke({
					versammlungen: tafel.length,
					offeneErgebnisse: tafel.reduce((n, z) => n + z.offeneTraktanden, 0),
					nichtGeschlossen: tafel.length - abgeschlossen
				})
			: null;

	const schritte = gemeinsameSchritte({
		tagId: tag.id,
		haeuser: tafel.length,
		laufend: tafel.filter((z) => z.zustand === 'laufend').length,
		fertig: abgeschlossen,
		stammdatenOffen,
		themenOffen,
		geschaefte: geschaefte.length,
		angabenStehen: tag.bezeichnung.length > 0 && tag.ort.length > 0,
		imEntwurf: tafel.filter((z) => z.zustand === 'entwurf').length,
		/*
		 * Gezählt wird aus **denselben** Schritten, die im Haus stehen — wie bei
		 * den Stammdatenthemen darüber. Eine eigene Zählung daneben liefe beim
		 * ersten neuen Schritt auseinander.
		 */
		ausfallOffen: haeuser.filter((h) =>
			h.schritte.some((s) => s.kennung === 'ausfall' && s.zustand !== 'erledigt')
		).length,
		abgeschlossen,
		protokollluecke: lueckeDerZusammenstellung
	});

	/*
	 * **Der Kopf der Leiste sagt dasselbe wie im Haus** (Auftraggeber, 24.08.2026: «Auch
	 * der Titel der Seitenleiste ist anders. […] Das sollte überall identisch
	 * sein. Einzelveranstaltung finde ich besser gelöst»).
	 *
	 * Dort steht: der **Anlass** («Versammlung vom 19. Mai 2026»), daneben eine
	 * Marke mit dem **Zustand**, darunter Uhrzeit und Ort in einer Zeile. Wer
	 * die Sache besitzt — die Gemeinschaft —, steht im Brotkrumenpfad daneben.
	 *
	 * Hier stand stattdessen die Bezeichnung des Abends über drei Zeilen, ohne
	 * Zustand, und die Unterzeile trug Datum, Uhrzeit und Ort zusammen. Die
	 * Bezeichnung geht nicht verloren: Sie steht in der Kopfleiste und im
	 * Brotkrumenpfad.
	 *
	 * **Ein Zustand über alle Häuser** gibt es nicht — deshalb der gemeinsame
	 * Nenner: Läuft eines, läuft der Abend. Sind alle geschlossen, ist er
	 * geschlossen. Sonst wird vorbereitet.
	 */
	const laufend = tafel.filter((z) => z.zustand === 'laufend').length;
	const zustand: { text: string; art: Versammlungszustand } =
		laufend > 0
			? { text: 'laufend', art: 'laufend' }
			: tafel.length > 0 && abgeschlossen === tafel.length
				? { text: 'geschlossen', art: 'geschlossen' }
				: { text: 'in Vorbereitung', art: 'entwurf' };

	return {
		rahmenTag: {
			id: tag.id,
			bezeichnung: tag.bezeichnung,
			/** Der Anlass, wie im Haus — nicht der Name des Abends. */
			gegenstand: `Gemeinsame Versammlung vom ${datumLang(tag.datum)}`,
			unterzeile: `${tag.uhrzeit} Uhr · ${tag.ort}`,
			zustand
		},
		schritte,
		fortschritt: vorbereitungsfortschritt(schritte),
		// Für die Registerleiste über die Häuser — dieselbe wie auf den
		// Stammdatenseiten, nur mit der gemeinsamen Versammlung als Gegenstand.
		haeuser
	};
};
