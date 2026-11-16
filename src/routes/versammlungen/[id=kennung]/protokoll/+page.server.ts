import { error, fail } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { Schreibkonflikt } from '$lib/domain/schreibstand';
import { LEITUNGSFELDER } from '$lib/domain/versammlung';
import { FASSUNGSARTEN, type Fassungsart } from '$lib/domain/protokoll';
import { standAus, text } from '$lib/server/formular';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeTraktanden } from '$lib/server/traktanden';
import { holeVersammlung, setzeVersammlungsleitung } from '$lib/server/versammlungen';
import { holeTagDerVersammlung } from '$lib/server/versammlungstag';
import {
	erzeugeProtokollentwurf,
	halteFassungFest,
	holeBeschlussvermerkLagen,
	holeFassungen,
	holeNotizen,
	holeProtokoll,
	holeFassungsabdruck,
	setzeBeschlussvermerk,
	setzeProtokollnotiz,
	speichereProtokoll
} from '$lib/server/protokoll';
import { halteFassungAmAbendFest } from '$lib/server/gemeinsamesprotokoll';
import { kiEingerichtet,
	holeKinachweis
} from '$lib/server/ki';
import { holeSiegel } from '$lib/server/siegel';
import { pruefeKetteDerVersammlung } from '$lib/server/nachtragssiegel';
import { formuliereNotizen, haltEntwurfsentscheidFest } from '$lib/server/protokollentwurf';
import { verfuegbarkeit, verlangeEntscheid } from '$lib/domain/ki';
import type { Actions, PageServerLoad } from './$types';
import { holeBetreiber } from '$lib/server/betreiber';

/**
 * Das Protokoll (FR-46, FR-48 bis FR-50).
 *
 * Drei Dinge auf einer Seite, in der Reihenfolge, in der sie entstehen: die
 * Notizen je Traktandum (während der Sitzung), der Entwurf daraus (nach dem
 * Schluss) und die festgehaltenen Fassungen (nach dem Versand).
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');
	const operatorId = locals.benutzer.operatorId;

	const versammlung = await holeVersammlung(operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	const [
		gemeinschaft,
		traktanden,
		notizen,
		protokoll,
		fassungen,
		tag,
		fassungsabdruck,
		siegel,
		beschlussvermerke,
		kette
	] = await Promise.all([
			holeGemeinschaft(operatorId, versammlung.stwegId),
			holeTraktanden(operatorId, params.id),
			holeNotizen(operatorId, params.id),
			holeProtokoll(operatorId, params.id),
			holeFassungen(operatorId, params.id),
			holeTagDerVersammlung(operatorId, params.id),
			holeFassungsabdruck(operatorId, params.id),
			holeSiegel(operatorId, params.id),
			/*
			 * **Der Beschlussvermerk** (Block 7): je Traktandum, ob er steht und
			 * ob er stehen darf. Die Schranken 1 und 2 kommen fertig aus dem
			 * Server (`holeBeschlussvermerkLagen`); Schranke 3 prüft erst das
			 * Setzen, weil der Votentext im Feld noch unterwegs sein kann.
			 */
			holeBeschlussvermerkLagen(operatorId, params.id),
			/*
			 * **Die Siegelkette, nachgerechnet** (Ä-39, Migration 161): das Siegel
			 * des Abschlusspakets und das Nachtragssiegel jeder Fassung danach.
			 * Gerechnet bei jedem Aufruf, nicht gespeichert: Eine gespeicherte
			 * Aussage «hält» wäre eine zweite Wahrheit neben den Prüfsummen.
			 */
			pruefeKetteDerVersammlung(operatorId, params.id)
		]);

	// **Sichtbar deaktiviert statt fehlerhaft** (FR-62).
	const ki = verfuegbarkeit(
		{
			eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
			zugelassen: gemeinschaft?.aiEnabled ?? false,
			offline: false,
			ausgenommen: gemeinschaft?.aiDisabledFunctions ?? [],
			hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
		},
		'protokollentwurf'
	);

	return {
		versammlung,
		ki,
		gemeinschaft,
		/**
		 * Gehört die Versammlung zu einem gemeinsamen Abend, wird das Protokoll
		 * **dort** geführt.
		 *
		 * Der Auftraggeber am 12.08.2026: «Es gibt dann ein Protokoll für die Versammlung. Nicht
		 * pro Haus.» Dasselbe Muster wie bei der Traktandenliste (11.08.2026): Was
		 * hier bleibt, sind die Notizen — sie entstehen während der Sitzung und
		 * fliessen in das eine Protokoll ein. Was hier nicht geht: ein eigener
		 * Entwurf. Zwei Protokolle über dieselbe Sitzung wären zwei Fassungen
		 * desselben Beschlusses, und im Streit gälte die falsche. Die Fassung des
		 * Abends hält jedes Haus seit A2 (03.10.2026) auf dieser Seite selbst fest
		 * — als Versandnachweis, ohne eigenen Protokolltext.
		 */
		gemeinsam: tag ? { id: tag.id, bezeichnung: tag.bezeichnung } : null,
		traktanden: traktanden.map((t) => ({
			id: t.knoten.id,
			nummer: t.nummer,
			tiefe: t.tiefe,
			titel: t.knoten.titel,
			art: t.knoten.art,
			notiz: notizen.get(t.knoten.id) ?? '',
			/**
			 * Der Beschlussvermerk (Block 7): Der Text im Votenfeld ist der
			 * Beschluss, den Votum nicht führt.
			 *
			 * `moeglich` trägt die Schranken 1 und 2 des Setzens (geschlossen
			 * oder versiegelt, und kein Ergebnis). Schranke 3 — nicht leer —
			 * steht bewusst nicht dabei: Der Haken darf auch an einem Feld
			 * erscheinen, das eben erst getippt und noch nicht gesichert ist,
			 * und die Absage kommt dann vom Server.
			 */
			beschlussvermerk: beschlussvermerke.get(t.knoten.id)?.vermerk ?? false,
			beschlussvermerkMoeglich: beschlussvermerke.get(t.knoten.id)?.moeglich ?? false
		})),
		protokoll,
		/**
		 * Die Prüfsumme der massgeblichen Fassung (22.08.2026).
		 *
		 * Sie steht auf dieser Seite, weil sie hier gebraucht wird: Wer eine
		 * Fassung versendet, gibt den Eigentümern damit einen Wert in die Hand,
		 * den die nächste Versammlung genehmigt. Und wer sie signieren lässt,
		 * kann hinterher prüfen, ob er dieselbe Fassung unterschrieben hat.
		 */
		fassungsabdruck,
		/**
		 * Ob ein Siegel besteht — für den Hinweis zur Reihenfolge.
		 *
		 * Der Siegelabschnitt kommt nur in einen Entwurf, der **nach** dem
		 * Versiegeln entsteht. Wer zuerst das Protokoll erzeugt, bekommt ihn nicht
		 * und merkt es nie — deshalb steht der Hinweis dort, wo der Entwurf
		 * entsteht.
		 */
		versiegelt: siegel !== null,
		/**
		 * Ob der jetzige Text bereits als Fassung abgelegt ist.
		 *
		 * Nur dann darf neu erzeugt werden — sonst ginge die Überarbeitung
		 * verloren, und genau davor schützt die Sperre in
		 * `erzeugeProtokollentwurf`.
		 */
		/**
		 * Der Nachweis über maschinelle Vorbereitung (22.08.2026, Befund D-05).
		 *
		 * Die Betreiberseite versprach ihn «im Verlauf» — dort steht er nicht, und
		 * einsehbar war er nirgends. Jetzt steht er am Protokoll, wo man ihn
		 * braucht: `null`, solange nichts gefragt wurde.
		 */
		kinachweis: await holeKinachweis(locals.benutzer!.operatorId, params.id),
		fassungGesichert: Boolean(
			protokoll && fassungen.some((f) => f.body === protokoll.body)
		),
		kette: kette
			? { haelt: kette.haelt, satz: kette.satz, ohneSiegel: kette.ohneSiegel }
			: null,
		fassungen: fassungen.map((f) => ({
			...f,
			artName: FASSUNGSARTEN[f.art],
			/**
			 * Die Prüfsumme dieser Fassung (22.08.2026, Befund D-03).
			 *
			 * Daneben stand «Eine festgehaltene Fassung bleibt unverändert
			 * abrufbar» — und die Tabelle hatte keinen einzigen Link. Wer eine
			 * ältere Fassung belegen wollte, kam nicht an sie heran, und ihre
			 * Prüfsumme verschwand mit der nächsten. Beides steht jetzt in der
			 * Zeile.
			 */
			abdruck: createHash('sha256').update(f.body, 'utf8').digest('hex'),
			// Der Wortlaut alter Fassungen gehört nicht in jede Seitenladung; für
			// die Liste genügt die Länge, gelesen wird über den eigenen Abruf.
			body: undefined,
			zeichen: f.body.length
		}))
	};
};

function handelnder(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

/**
 * `quelle` ist freigestellt und benennt die Stelle, an der die Absage erscheinen
 * soll. Ohne sie steht sie am Seitenkopf, wie bisher. Sie ist nötig, wo ein
 * Formular weit unten steht: Mit `use:enhance` lädt die Seite nicht neu, und
 * eine Meldung am Kopf einer langen Seite sieht niemand, der unten geklickt hat
 * (25.08.2026 an der Betreiberseite gemessen, dasselbe Muster).
 */
// `FormDataEntryValue` und nicht `unknown`: Genau das liefert
// `Object.fromEntries(daten)`, und nur so nimmt `anfangswert` den Wert direkt
// entgegen. Mit `unknown` brauchte die Seite ein `String(...)` davor — und das
// hob den Datei-Schutz auf, für den `anfangswert` diese Signatur trägt
// (26.08.2026, aus dem Code-Review).
function fachlich(
	fehler: unknown,
	quelle?: string,
	werte?: Record<string, FormDataEntryValue>,
	/**
	 * Der Stand, den das Formular mitgeschickt hat.
	 *
	 * **Auch bei einer fachlichen Absage nötig** (26.08.2026, aus dem Review).
	 * `form` ist auf dieser Seite von zehn Aktionen geteilt, und `use:enhance`
	 * lädt bei einer Absage nicht neu. Ohne dieses Feld verlöre die Seite nach
	 * einem Konflikt den neuen Stand, sobald irgendetwas anderes abgewiesen wird
	 * — und der nächste Versuch liefe wieder in denselben Konflikt.
	 */
	stand?: Record<string, string>
) {
	/*
	 * **Der Konflikt geht mit dem neuen Stand zurück.** `use:enhance` lädt bei
	 * einer Absage die Seite nicht neu — `data` bliebe also auf dem alten Stand,
	 * die versteckten Felder schickten ihn wieder mit, und der zweite Versuch
	 * liefe in denselben Konflikt. Mit `stand` im Formularergebnis trägt das
	 * Formular danach den geltenden Stand, und ein zweites Abschicken setzt die
	 * eigene Angabe durch.
	 */
	if (fehler instanceof Schreibkonflikt) {
		return fail(409, {
			quelle,
			werte,
			stand: fehler.aktuell,
			fehler: { nachricht: fehler.message }
		});
	}
	if (fehler instanceof FachlicherFehler) {
		return fail(400, {
			quelle,
			werte,
			stand,
			fehler: { nachricht: fehler.message, feld: fehler.feld }
		});
	}
	throw fehler;
}

/** Ein Zeitpunkt in hiesiger Zeit — der Kern liest keine Uhr (AD-1, AD-12). */
function jetzt(): string {
	return new Date().toLocaleString('de-CH', {
		timeZone: 'Europe/Zurich',
		dateStyle: 'medium',
		timeStyle: 'short'
	});
}

export const actions: Actions = {
	/** Notiz zu einem Traktandum (FR-46). */
	notiz: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const e = await setzeProtokollnotiz(
				handelnder(locals),
				params.id,
				text(daten.get('traktandum')),
				text(daten.get('notiz'))
			);
			return {
				hinweis:
					e.laenge === 0
						? `Die Notiz zu «${e.titel}» ist geleert.`
						: `Notiz zu «${e.titel}» gesichert (${e.laenge} Zeichen).`
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Der Beschlussvermerk zu einem Traktandum (Block 7).
	 *
	 * `ja` setzt ihn, alles andere nimmt ihn zurück: Ein abgewähltes Kästchen
	 * schickt nichts mit, und «nicht angekreuzt» heisst hier «Vermerk weg».
	 * Die vier Schranken stehen im Server; hier wird nur gelesen und
	 * weitergereicht.
	 */
	beschlussvermerk: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const traktandumId = text(daten.get('traktandum'));
		try {
			const e = await setzeBeschlussvermerk(
				handelnder(locals),
				params.id,
				traktandumId,
				text(daten.get('vermerk')) === 'ja'
			);
			return {
				hinweis: e.vermerk
					? `Der Haken zu «${e.titel}» ist gesetzt. Ein Entwurf, den Sie jetzt erzeugen, lässt den Satz «Über diesen Antrag wurde nicht abgestimmt.» weg. Am gemeinsamen Abend zählt der Punkt nicht mehr als offen. In einem bestehenden Entwurf ändert sich nichts: Tragen Sie den Text dort nach und löschen Sie den Satz von Hand.`
					: `Der Haken zu «${e.titel}» ist entfernt.`
			};
		} catch (fehler) {
			// Am Kästchen, nicht am Seitenkopf: Die Votenliste ist lang, und wer
			// unten ankreuzt, sieht eine Meldung oben nicht.
			return fachlich(fehler, `vermerk-${traktandumId}`);
		}
	},

	entwurf: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			await erzeugeProtokollentwurf(handelnder(locals), params.id, jetzt());
			return {
				hinweis:
					'Entwurf erzeugt. Zahlen und Beschlusswortlaute stammen aus der Anwendung; alles ' +
					'Weitere schreiben Sie selbst.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	/**
	 * Die Notizen ausformulieren lassen (FR-61).
	 *
	 * **Geschrieben wird nichts.** Was zurückkommt, liegt neben der Notiz und
	 * wartet auf einen Klick je Traktandum.
	 */
	kientwurf: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');
		const g = await holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId);

		const erlaubt = verfuegbarkeit(
			{
				eingerichtet: await kiEingerichtet(locals.benutzer.operatorId),
				zugelassen: g?.aiEnabled ?? false,
				offline: false,
				ausgenommen: g?.aiDisabledFunctions ?? [],
				hinweiseAusblenden: (await holeBetreiber(locals.benutzer.operatorId))?.kiHinweiseAusblenden === true
			},
			'protokollentwurf'
		);
		if (!erlaubt.verfuegbar) return fail(400, { fehler: { nachricht: erlaubt.grund ?? '' } });

		const ergebnis = await formuliereNotizen(
			{
				operatorId: locals.benutzer.operatorId,
				userId: locals.benutzer.id,
				label: locals.benutzer.displayName
			},
			params.id
		);
		return { entwuerfe: ergebnis };
	},

	/**
	 * Einen einzelnen Absatz übernehmen — die Notiz wird dadurch ersetzt.
	 *
	 * **Das Übernehmen ist der Entscheid** (FR-63) und wird als solcher
	 * festgehalten. Ihn an einen zusätzlichen Klick zu hängen hiesse: Wer
	 * Absätze übernimmt und den Knopf vergisst, hätte ein maschinell
	 * vorbereitetes Protokoll ohne den Vermerk darüber.
	 */
	kiuebernehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await setzeProtokollnotiz(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('traktandumId')),
				text(daten.get('absatz'))
			);
			/*
			 * **Der Vermerk darf die Übernahme nicht mehr scheitern lassen**
			 * (Code-Review 02.09.2026). Die Notiz steht an dieser Stelle bereits
			 * geschrieben; wirft die Bindung danach, meldete die Aktion einen
			 * Fehlschlag für etwas, das geschehen ist — und die Sitzungsleitung
			 * drückt ein zweites Mal.
			 *
			 * Der Vermerk selbst ist der Nachweis über maschinelle Vorbereitung,
			 * nicht der Vorgang. Bleibt er aus, fehlt eine Zeile im Nachweis; das
			 * gehört ins Protokoll des Containers, nicht in eine Absage an einen
			 * Menschen, der gerade eine Versammlung führt.
			 */
			const nutzungId = text(daten.get('nutzungId'));
			if (nutzungId) {
				try {
					await haltEntwurfsentscheidFest(
						handelnder(locals),
						nutzungId,
						{ art: 'versammlung', versammlungId: params.id },
						'angenommen'
					);
				} catch (fehler) {
					console.error(
						`Absatz uebernommen, der Vermerk dazu nicht (Nutzung ${nutzungId}):`,
						fehler
					);
				}
			}
			return { hinweis: 'Absatz übernommen. Die Notiz lautet jetzt so.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	kientwurfsentscheid: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await haltEntwurfsentscheidFest(
				handelnder(locals),
				text(daten.get('nutzungId')),
				{ art: 'versammlung', versammlungId: params.id },
				verlangeEntscheid(text(daten.get('entscheid')))
			);
			return { hinweis: 'Im Nachweis festgehalten.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * **Vor dem Entwurf, nicht danach.** Die Namen gehen in den Kopf und über
	 * die Unterschriftszeilen; wer sie nachträgt, muss den Entwurf neu erzeugen.
	 * Das Formular steht deshalb über «Der Protokolltext».
	 */
	leitung: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const mitgeschickt = standAus(daten, Object.keys(LEITUNGSFELDER));
		try {
			await setzeVersammlungsleitung(
				handelnder(locals),
				params.id,
				{
					sitzungsleitung: text(daten.get('sitzungsleitung')),
					protokollfuehrung: text(daten.get('protokollfuehrung'))
				},
				mitgeschickt
			);
			// Erfolg ohne `quelle`: Die Quittung zieht ohnehin in die Ecke um
			// (`Meldung.svelte`), und ein `quelle` am Erfolg schaltete nur den
			// Kopfhinweis für den Weg ohne JavaScript ab.
			return { hinweis: 'Vorsitz und Protokollführung festgehalten.' };
		} catch (fehler) {
			// `werte` zurück, sonst steht nach der Absage wieder der alte Wert im
			// Feld und das Getippte ist weg (Weg ohne JavaScript).
			// Der mitgeschickte Stand geht zurück: Bei einer fachlichen Absage hat
			// sich in der Datenbank nichts geändert, also bleibt er der geltende.
			return fachlich(fehler, 'leitung', Object.fromEntries(daten), {
				...Object.fromEntries(Object.entries(mitgeschickt).map(([f, w]) => [f, w ?? '']))
			});
		}
	},

	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await speichereProtokoll(handelnder(locals), params.id, text(daten.get('body')));
			return { hinweis: 'Protokoll gespeichert.' };
		} catch (fehler) {
			return fachlich(fehler);
		}
	},

	festhalten: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const art = text(daten.get('art')) as Fassungsart;
		if (!(art in FASSUNGSARTEN)) {
			return fail(400, { fehler: { nachricht: 'Unbekannte Art der Fassung.' } });
		}
		try {
			/*
			 * **Am Haus eines Abends kommt der Wortlaut aus der Zusammenstellung.**
			 * Dort gibt es keine Arbeitsfassung; `halteFassungFest` bekäme keinen
			 * Text. Welcher der beiden Wege gilt, entscheidet die Zugehörigkeit zum
			 * Abend — dieselbe Auskunft, die auch die Seite über `data.gemeinsam`
			 * zeigt. Den Abend liest die Route, nicht der Schreibweg: Der Kern
			 * liest keine Datenbank, und `halteFassungFest` bleibt für beide Wege
			 * die eine Schreibregel.
			 */
			const tag = await holeTagDerVersammlung(locals.benutzer.operatorId, params.id);
			const f = tag
				? await halteFassungAmAbendFest(
						handelnder(locals),
						params.id,
						tag.id,
						art,
						text(daten.get('bemerkung')) || null,
						jetzt()
					)
				: await halteFassungFest(
						handelnder(locals),
						params.id,
						art,
						text(daten.get('bemerkung')) || null
					);
			return {
				hinweis:
					`Fassung ${f.nummer} ist festgehalten (${FASSUNGSARTEN[art]}). Sie bleibt unverändert ` +
					'abrufbar, auch wenn Sie weiterarbeiten.'
			};
		} catch (fehler) {
			return fachlich(fehler);
		}
	}
};
