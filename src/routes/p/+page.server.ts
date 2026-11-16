import { fail, redirect } from '@sveltejs/kit';
import { keksSicher } from '$lib/server/keks';
import { text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeVersammlung, loeseAnzeigecodeAuf } from '$lib/server/versammlungen';
import { holeTraktanden } from '$lib/server/traktanden';
import { abschlussbild, holeAuswertung } from '$lib/server/auswertung';
import { abgeschlossen } from '$lib/domain/versammlung';
import {
	leseAnzeigeKeks,
	loescheAnzeigeKeks,
	setzeAnzeigeKeks
} from '$lib/server/anzeigesitzung';
import { holeMehrheitsvorschau, holeDurchgaenge } from '$lib/server/abstimmung';
import { bezeichnungMitBasis } from '$lib/domain/entscheidbaum';
import { mehrheitGesetzt } from '$lib/domain/auszaehlung';
import { holeRegelwerkFuerAnzeige } from '$lib/rules';
import { ermittleStand } from '$lib/server/versammlungsstand';
import { ersetzungslage } from '$lib/server/auswertung';
import { ersetzungInKuerze } from '$lib/domain/folgeantragsersetzung';
import { stelltBeschlussfaehigkeitFest } from '$lib/domain/traktandenvorlage';
import type { Actions, PageServerLoad } from './$types';

/**
 * Die Präsentationssicht (Story 5.5, FR-35, AD-11, NFR-17).
 *
 * **Was hier nie erscheint: ein Name im Zusammenhang mit Stimmverhalten.** Nicht
 * als Vorsicht, sondern als Bauweise — die Seite bekommt gar keine Namen. Der
 * Stand, aus dem sie lebt, trägt Zahlen und Zustände, und der Traktandentext ist
 * für alle im Saal derselbe.
 *
 * Der Zugang läuft über den versammlungsgebundenen Anzeigecode. Ohne ihn ist
 * die Sicht nicht einsehbar: Eine Eigentümerversammlung ist nicht öffentlich.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const code = leseAnzeigeKeks(cookies);
	if (!code) return { offen: false as const };

	const befund = await loeseAnzeigecodeAuf(code);
	if (!befund.gueltig) {
		// Ein Keks, der nichts mehr öffnet, gehört weg — sonst zeigt die Leinwand
		// bei jedem Aufruf dieselbe Meldung, ohne Weg zurück zum Eingabefeld.
		loescheAnzeigeKeks(cookies, keksSicher());
		return { offen: false as const, grund: befund.grund };
	}

	const op = befund.operatorId as string;
	const meetingId = befund.meetingId as string;

	const versammlung = await holeVersammlung(op, meetingId);
	if (!versammlung) return { offen: false as const, grund: 'Versammlung nicht auffindbar.' };

	const [gemeinschaft, traktanden, stand] = await Promise.all([
		holeGemeinschaft(op, versammlung.stwegId),
		holeTraktanden(op, meetingId),
		ermittleStand(op, meetingId)
	]);

	/*
	 * **Der Abschluss an der Wand** (21.08.2026): «Auf der Präsentationssicht
	 * braucht es dann eine Abschlussseite. Eventuell mit den Auswertungen der
	 * Traktandenabstimmungen?»
	 *
	 * Ja — und zwar genau dann: Nach dem Schluss stehen alle im Saal auf, und was
	 * beschlossen wurde, ist die letzte Frage des Abends. Vorher wäre dieselbe
	 * Liste eine Vorwegnahme.
	 *
	 * **Nur Nummern, Titel und Ergebnis** — keine Namen, keine Stimmzeilen. Die
	 * Leinwand hat schon immer nur Zahlen gezeigt (AD-11), und daran ändert der
	 * Abschluss nichts.
	 */
	// Auch versiegelt: siehe `abgeschlossen()` in `domain/versammlung.ts`.
	const abschluss = abgeschlossen(versammlung.zustand)
		? await holeAuswertung(op, meetingId)
		: null;

	/*
	 * **Die Beschlussfähigkeit füllt die Wand, wenn sie der Punkt ist**
	 * (Praxisdurchlauf 28.08.2026, wie am gemeinsamen Abend seit 24.08.2026).
	 * Beim aufgerufenen Beschlussfähigkeits-Traktandum gehören die Balken gross
	 * in den Vordergrund; sonst bleibt es bei der Fusszeile.
	 */
	const aufgerufenes = versammlung.aktuellesTraktandumId
		? traktanden.find((t) => t.knoten.id === versammlung.aktuellesTraktandumId)
		: null;
	const beschlussfaehigkeitImVordergrund = aufgerufenes
		? stelltBeschlussfaehigkeitFest(aufgerufenes.knoten.titel)
		: false;

	/*
	 * **Die Wand nennt die Ersetzung am Grundantrag** (Produktentscheid
	 * 08.10.2026): derselbe Satz wie an der Leitungsauskunft, in der
	 * Traktandumsicht des aufgerufenen Grundantrags. Nur die Rolle
	 * Grundantrag; am Folgeantrag erklärt ihn sein eigenes Ergebnis.
	 */
	const ersetzungAmAufgerufenen = aufgerufenes
		? await ersetzungslage(
				op,
				meetingId,
				aufgerufenes.knoten.id,
				await holeDurchgaenge(op, meetingId),
				traktanden
			)
		: null;
	const ersetzungssatz =
		ersetzungAmAufgerufenen?.rolle === 'grundantrag'
			? ersetzungInKuerze(ersetzungAmAufgerufenen)
			: null;

	/*
	 * Einmal geholt: Satz und Ausstandsgrund kommen aus derselben Auszählung
	 * ohne Stimmen, und diese Seite wird bei jedem Ereignis neu gebaut. Der
	 * Ausdruck darunter suchte das Traktandum ausserdem ein zweites Mal, obwohl
	 * `aufgerufenes` drei Zeilen höher schon dasteht.
	 */
	const aufgerufeneVorschau = aufgerufenes
		? await holeMehrheitsvorschau(
				op,
				meetingId,
				aufgerufenes.knoten.id,
				aufgerufenes.knoten.erfordernis ?? null
			)
		: null;

	return {
		offen: true as const,
		gemeinschaftName: gemeinschaft?.name ?? '',
		beschlussfaehigkeitImVordergrund,
		versammlung: {
			datum: versammlung.datum,
			uhrzeit: versammlung.uhrzeit,
			ort: versammlung.ort,
			zustand: versammlung.zustand,
			wandbild: versammlung.wandbild ?? null,
			// Die Unterbrechung samt Wortlaut: Auf der Leinwand steht sie, im Strom
			// nur ihre Marke (AD-11).
			pause: versammlung.pause ?? null
		},
		// Nummer, Titel und Antragswortlaut — nichts über Personen. Der
		// Quorumstyp kommt dazu, damit die Wand ihn als Marke zeigen kann
		// (Praxisfund 03.10.2026).
		traktanden: traktanden.map((t) => ({
			id: t.knoten.id,
			nummer: t.nummer,
			tiefe: t.tiefe,
			titel: t.knoten.titel,
			art: t.knoten.art,
			antragswortlaut: t.knoten.antragswortlaut,
			// Der Ersetzungssatz nur am aufgerufenen Grundantrag: Dort zeigt ihn
			// die Traktandumsicht (Produktentscheid 08.10.2026).
			ersetzung: t.knoten.id === versammlung.aktuellesTraktandumId ? ersetzungssatz : null,
			erfordernis: t.knoten.erfordernis
				? {
						// Beim von Hand gesetzten Mehr trägt allein die Marke mit
						// Bezugsgrösse (Codeprüfung 09.10.2026).
						titel: mehrheitGesetzt(t.knoten.erfordernis)
							? null
							: t.knoten.erfordernis.titel,
						rechtsgrundlage: t.knoten.erfordernis.rechtsgrundlage,
						bezeichnung: bezeichnungMitBasis(
							holeRegelwerkFuerAnzeige(t.knoten.erfordernis.fassung),
							t.knoten.erfordernis
						)
					}
				: null
		})),
		stand,
		/**
		 * Was das aufgerufene Geschäft braucht (22.08.2026).
		 *
		 * **Auch vor dem Öffnen der Abstimmung** — und gerade dann ist sie am
		 * meisten wert: Solange nicht abgestimmt wird, kann der Saal noch
		 * reagieren. Sobald eine Abstimmung läuft, trägt der Strom dieselbe Angabe
		 * mit, weil sie sich dann mit jedem Nachzügler verschiebt.
		 */
		noetig: aufgerufeneVorschau?.satz ?? null,
		/*
		 * **Und der Grund dazu, schon vor dem Öffnen** (Sicherheitsdurchgang
		 * 06.09.2026). Der erste Anlauf gab den Ausstandshinweis nur dem
		 * laufenden Durchgang mit; an der Wand erschien er damit erst, wenn
		 * abgestimmt wird — also gerade nicht in der Phase, die der Absatz
		 * darüber als die wichtigste bezeichnet.
		 */
		ausstandsgrund: aufgerufeneVorschau?.ausstandshinweis ?? null,
		/*
		 * **Der Abschluss kommt aus einer Funktion** (Nachzug Block 2b): `/p` und
		 * die Präsentationssicht zeigen dasselbe Bild, und die Zählung dazu steht
		 * in `abschlussbild` (`server/auswertung.ts`), nicht zweimal hier.
		 */
		abschluss: abschluss ? abschlussbild(abschluss) : null
	};
};

export const actions: Actions = {
	oeffnen: async ({ cookies, request }) => {
		const daten = await request.formData();
		const eingabe = text(daten.get('code'));

		const befund = await loeseAnzeigecodeAuf(eingabe);
		if (!befund.gueltig) {
			return fail(400, { fehler: { nachricht: befund.grund ?? '' }, eingabe });
		}

		setzeAnzeigeKeks(cookies, eingabe.toUpperCase().replace(/[^A-Z0-9]/g, ''), keksSicher());
		redirect(303, '/p');
	},

	schliessen: async ({ cookies }) => {
		loescheAnzeigeKeks(cookies, keksSicher());
		redirect(303, '/p');
	}
};
