import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { anzeigeLink, gruppiere } from '$lib/domain/zugang';
import {
	betriebsartVorschlag,
	istImEntwurf,
	pruefeZehntagesfrist,
	type Betriebsart
} from '$lib/domain/versammlung';
import { text, versammlungAusFormular } from '$lib/server/formular';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import { darfStammdatenAendern, VERWALTUNG_VORBEHALTEN } from '$lib/domain/rollen';
import { haengeAn, holeAnhaengeDerVersammlung, loeseAb } from '$lib/server/anhaenge';
import { DateiFehler } from '$lib/server/dateien';
import { holeOffeneAbgabe } from '$lib/server/abgabe';
import { holeNeuversandLage } from '$lib/server/einladungsmehr';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeAnwesenheitsregeln } from '$lib/server/reglement';
import { verkuendeStand } from '$lib/server/versammlungsstand';
import {
	holeTagDerVersammlung,
	holeVersammlungstage,
	nimmAusTag,
	nimmInTagAuf
} from '$lib/server/versammlungstag';
import {
	bearbeiteVersammlung,
	eroeffneVersammlung,
	erneuereAnzeigecode,
	holeMoeglicheVorgaengerinnen,
	holeVersammlung,
	loescheVersammlung,
	schliesseVersammlung,
	setzeBetriebsart,
	setzePapierfrage,
	zaehleParteien
} from '$lib/server/versammlungen';
import type { Actions, PageServerLoad } from './$types';
import { herkunft } from '$lib/server/herkunft';
import { NACHLAUF_MS } from '$lib/domain/versammlung';

/**
 * Wie lange der Anzeigecode nach dem Schluss noch gilt, in Worten. Aus
 * `NACHLAUF_MS` gerechnet, damit der Satz der Schlussmeldung nicht still vom
 * Wert abweicht (F7, aus der Codeprüfung 16.10.2026).
 */
function nachlaufInWorten(): string {
	const minuten = Math.round(NACHLAUF_MS / 60000);
	if (minuten % 60 !== 0) return `${minuten} Minuten`;
	const stunden = minuten / 60;
	return stunden === 1 ? 'eine Stunde' : `${stunden} Stunden`;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
	if (!versammlung) error(404, 'Versammlung nicht gefunden');

	// Der zugeordnete Abend steht an der Versammlung; das Modell führt ihn nicht
	// mit, weil er die Versammlung selbst nicht verändert (Story 7.5).
	const zugeordneterTag = await holeTagDerVersammlung(locals.benutzer.operatorId, params.id);

	const [gemeinschaft, anzahlParteien, alleVorgaengerinnen, anhaenge, tage, anwesenheitsregeln] =
		await Promise.all([
			holeGemeinschaft(locals.benutzer.operatorId, versammlung.stwegId),
			zaehleParteien(locals.benutzer.operatorId, versammlung.stwegId, versammlung.datum),
			holeMoeglicheVorgaengerinnen(locals.benutzer.operatorId, versammlung.stwegId),
			holeAnhaengeDerVersammlung(locals.benutzer.operatorId, params.id),
			holeVersammlungstage(locals.benutzer.operatorId),
			// Weicht das Reglement bei der Beschlussfähigkeit ab, muss die
			// abweichende Schwelle dort stehen, wo die Stufe gewählt wird —
			// «hier genügt ein Drittel» wäre bei dieser Gemeinschaft falsch
			// (gemeldet am 11.08.2026).
			holeAnwesenheitsregeln(locals.benutzer.operatorId, versammlung.stwegId)
		]);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	// Sich selbst nicht als eigene Vorgängerin anbieten.
	const vorgaengerinnen = alleVorgaengerinnen.filter((v) => v.id !== versammlung.id);
	const vorgaengerin = vorgaengerinnen.find((v) => v.id === versammlung.vorgaengerId) ?? null;

	return {
		versammlung,
		gemeinschaft,
		// Nur die an der Versammlung selbst; die an den Traktanden erscheinen dort.
		anhaenge: anhaenge.filter((a) => a.gegenstandArt === 'meeting'),
		vorgaengerinnen,
		anzahlParteien,
		vorschlagBetriebsart: betriebsartVorschlag(anzahlParteien),
		aenderbar: istImEntwurf(versammlung),
		// Der Fristbefund wird bei jeder Anzeige neu gerechnet, nicht beim Anlegen
		// festgeschrieben: Wird das Datum der ersten Versammlung später korrigiert,
		// muss der Verstoss mitwandern.
		// Die Reglementsfrist geht mit: Ohne sie rechnete diese Anzeige mit den
		// gesetzlichen zehn Tagen, während der Vermerk in der Einladung die
		// längere des Reglements nennt (Migration 122).
		frist:
			vorgaengerin !== null
				? pruefeZehntagesfrist(
						vorgaengerin.datum,
						versammlung.datum,
						gemeinschaft.zweitversammlungsfristTage
					)
				: null,
		// Story 7.5: Zuordnen soll auch von hier gehen — hier ist man, wenn man
		// merkt, dass die Versammlung zu einem gemeinsamen Abend gehört.
		tage,
		tag: zugeordneterTag,
		anwesenheitsregeln,
		/*
		 * **Ist die Versammlung gerade auf einem anderen Gerät?** Dann fehlen hier
		 * die Knöpfe, und zwar nicht aus Versehen: Die Datenbank weist jede
		 * Änderung ab (Migration 117). Wer die Seite öffnet und nichts tun kann,
		 * soll den Grund lesen und nicht suchen.
		 */
		abgabe: await holeOffeneAbgabe(locals.benutzer.operatorId, params.id),
		/*
		 * **Steht nach einer Milderung die berichtigte Einladung aus?**
		 * (Produktentscheid 06.10.2026, «Verweis auf der Übersicht»). Dieselbe
		 * Rechnung wie der Hinweis auf der Seite Vorbereitung; der Kasten braucht
		 * nur die Zahl der Traktanden und ob der letzte Fristtag vorbei ist.
		 * `null` heisst: keine aussteht, auch weil sie schon gültig vermerkt ist.
		 */
		neuversand:
			versammlung.zustand === 'freigegeben'
				? await holeNeuversandLage(locals.benutzer.operatorId, params.id)
				: null
	};
};

/** Der Handelnde aus der Sitzung — für die Handlungen, die ihn brauchen. */
function wer(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

export const actions: Actions = {
	/**
	 * Ein Knopf, ein Vorgang.
	 *
	 * Die Seite hatte drei Formulare mit drei Knöpfen — Angaben, gemeinsamer
	 * Abend, Datei. Wer alle drei geändert hatte, musste dreimal speichern und
	 * merkte es an zweien nicht. Seit dem 11.08.2026 gehören alle Felder zu
	 * diesem einen Formular, und diese Aktion arbeitet sie der Reihe nach ab.
	 *
	 * Die Reihenfolge ist nicht beliebig: Erst die Angaben, denn sie können
	 * fachlich scheitern und sollen dann nichts halb Getanes hinterlassen.
	 */
	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const versammlung = await holeVersammlung(locals.benutzer.operatorId, params.id);
		if (!versammlung) error(404, 'Versammlung nicht gefunden');

		const wer = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};

		/*
		 * **Die harten Angaben kommen vom Abend, nicht aus dem Formular** (Auftraggeber,
		 * 25.08.2026: «wenn die Gruppe mit Hart im Lead ist, sollte man in der
		 * Einzelveranstaltung keine Einstellungen machen können»).
		 *
		 * Das Formular zeigt sie für eine zugeordnete Versammlung nur noch als
		 * Satz und schickt sie gar nicht mehr mit. Käme der Wert dann aus
		 * `versammlungAusFormular`, wäre er **leer** — und `pruefeVersammlung`
		 * bräche mit «Das Datum der Versammlung fehlt» ab. Hier stehen sie
		 * deshalb ausdrücklich, aus der einen Quelle, die dafür gilt.
		 *
		 * Und es ist keine Anzeigefrage: Auch ein von Hand nachgereichtes Feld
		 * kommt so nicht durch. Was die Oberfläche nicht anbietet, soll der
		 * Server auch nicht annehmen.
		 */
		const abend = await holeTagDerVersammlung(locals.benutzer.operatorId, params.id);
		const eingabe = versammlungAusFormular(daten, versammlung.stwegId);
		const hart = abend
			? {
					datum: abend.datum,
					uhrzeit: abend.uhrzeit,
					ort: abend.ort,
					art: abend.art,
					anlass: abend.anlass ?? undefined,
					betriebsart: abend.betriebsart
				}
			: {};

		try {
			await bearbeiteVersammlung(wer, params.id, { ...eingabe, ...hart });

			/*
			 * **Nur bei echter Änderung.** Ohne den Vergleich mit `tagVorher`
			 * schriebe jedes Speichern ein «aus dem Abend genommen» in den
			 * Verlauf, das niemand ausgelöst hat.
			 *
			 * **Und was der Abend dabei umstellt, wird gesagt** (25.08.2026).
			 * Hier stand `await nimmInTagAuf(…)` ohne den Rückgabewert — und der
			 * trägt genau die Auskunft, um die es geht. Auf diesem Formular wählt
			 * man Tag, Ort und Abstimmungsweise **und** den gemeinsamen Anlass in
			 * einem Zug; die Zuordnung überschreibt anschliessend, was der Abend
			 * hart vorgibt. Wer «Von Hand gezählt» ankreuzte und speicherte, hatte
			 * danach «Über die App» stehen und erfuhr es nirgends.
			 *
			 * Gefunden, weil der Verbund-Durchlauf genau daran hängenblieb: Die
			 * Häkchenliste der einfachen Betriebsart war weg, obwohl der Lauf sie
			 * eine Zeile vorher gewählt hatte. Die Häuserseite des Abends meldet
			 * es seit gestern; diese Stelle war die zweite und wurde vergessen.
			 */
			let umgestellt: string[] = [];
			if (daten.has('tagVorher')) {
				const jetzt = text(daten.get('tag'));
				const vorher = text(daten.get('tagVorher'));
				if (jetzt !== vorher) {
					if (jetzt) {
						const plan = await nimmInTagAuf(wer, jetzt, params.id, 0);
						umgestellt = plan.aendern[0]?.was ?? [];
					} else await nimmAusTag(wer, params.id);
				}
			}

			// Eine Datei ist freiwillig: Das Feld ist leer, wenn niemand eine
			// gewählt hat, und leer heisst hier nichts zu tun — nicht «Fehler».
			const datei = daten.get('datei');
			if (datei instanceof File && datei.size > 0) {
				await haengeAn(wer, params.id, 'meeting', params.id, datei);
			}

			return {
				gespeichert: true,
				hinweis:
					umgestellt.length > 0
						? `Vom gemeinsamen Anlass übernommen: ${umgestellt.join(', ')}.`
						: undefined
			};
		} catch (fehler) {
			if (fehler instanceof DateiFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					// **Ohne die Datei.** Seit sie zum selben Formular gehört, steckt
					// im FormData ein `File`; das lässt sich nicht an den Browser
					// zurückgeben, und der Versuch beendet die Antwort mit einem
					// Serverfehler statt mit der fachlichen Meldung.
					werte: Object.fromEntries(
						[...daten.entries()].filter(([, w]) => typeof w === 'string')
					)
				});
			}
			throw fehler;
		}
	},

	/**
	 * Die Versammlung löschen — nur im Entwurf, und nur mit Bestätigung.
	 *
	 * Zwei Stufen: Der erste Klick bringt die Frage zurück, was verschwindet;
	 * der zweite trägt `bestaetigt=ja` mit. Kein `confirm()` im Browser — der
	 * Text nennt Zahlen, die nur der Server kennt (Traktanden, Dateien, ob sie
	 * bei einer gemeinsamen Versammlung mittagt).
	 */
	/**
	 * Archivieren und Hervorholen (Migration 086).
	 *
	 * **Anders als das Löschen ohne Zustandsschranke — fast.** Gelöscht wird nur
	 * im Entwurf; archiviert wird alles ausser dem, was läuft oder bevorsteht.
	 * Die Regel und ihre Sätze stehen im Kern (`domain/archivieren.ts`).
	 */
	archivieren: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		/*
		 * **Dieselbe Schranke wie am Sammelweg** (Sicherheitsdurchgang
		 * 15.09.2026). Archivieren gehört zur Verwaltung (Vorgabe des Auftraggebers). Die
		 * Sammelaktion auf `/versammlungen` prüfte das seit demselben Tag, diese
		 * Einzelaktion nicht — und `/versammlungen` steht bewusst nicht in
		 * `VERWALTUNGSBEREICHE`, der zentrale Wächter greift hier also auch
		 * nicht. Eine Sitzungsleitung bekam am Sammelweg ihr 403, holte sich die
		 * Kennungen aus der Liste und setzte N einzelne Aufrufe ab: dieselbe
		 * Wirkung, ein Umweg.
		 *
		 * Eine Schranke, die nur den bequemen Weg sperrt, ist eine Aussage über
		 * die Oberfläche und keine über den Server.
		 */
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);
		const daten = await request.formData();
		try {
			const { name } = await archiviere(
				wer(locals),
				'versammlung',
				params.id,
				text(daten.get('notiz'))
			);
			return {
				archiv: `Die Versammlung in ${name} liegt im Archiv — aus Liste und Suche genommen, sonst unverändert.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Die getippte Begründung reist mit zurück — sonst ist sie nach
				// einer Absage weg und muss neu geschrieben werden (25.08.2026).
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
		// Der Rückweg gehört derselben Rolle wie der Hinweg — sonst könnte eine
		// Sitzungsleitung zwar nicht archivieren, aber alles hervorholen.
		if (!darfStammdatenAendern(locals.benutzer.role)) error(403, VERWALTUNG_VORBEHALTEN);
		try {
			await holeAusArchiv(wer(locals), 'versammlung', params.id);
			return { archiv: 'Die Versammlung steht wieder in Liste und Suche.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	loeschen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		let weg: { bezeichnung: string };
		try {
			weg = await loescheVersammlung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('bestaetigt')) === 'ja'
			);
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				if (fehler.feld === 'bestaetigen') {
					return fail(400, { loeschfrage: fehler.message });
				}
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
		// Ausserhalb des `try`: `redirect` wirft, und der Fänger oben hielte ihn
		// sonst für einen Fehler.
		redirect(303, `/versammlungen?geloescht=${encodeURIComponent(weg.bezeichnung)}`);
	},

	anhaengen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await haengeAn(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				'meeting',
				params.id,
				daten.get('datei') as File
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler || fehler instanceof DateiFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	abloesen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await loeseAb(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('id'))
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	eroeffnen: async ({ locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const e = await eroeffneVersammlung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			// Auch beim Eröffnen: Wer schon mit dem Telefon wartet, soll es sehen,
			// ohne selbst nachzuladen.
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			// Der Anzeigecode erscheint genau einmal: In der Datenbank steht nur sein
			// Prüfwert. Deshalb reist er hier durch die Antwort und nirgends sonst.
			return {
				anzeige: {
					code: gruppiere(e.anzeigecode),
					link: anzeigeLink(herkunft(url), e.anzeigecode)
				}
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/** Einen neuen Anzeigecode erzeugen — etwa wenn der Beamer neu aufgesetzt wird. */
	anzeigecode: async ({ locals, params, url }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const code = await erneuereAnzeigecode(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			return { anzeige: { code: gruppiere(code), link: anzeigeLink(herkunft(url), code) } };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	schliessen: async ({ locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		try {
			const e = await schliesseVersammlung(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id
			);
			// **Den Saal benachrichtigen.** Ohne diesen Aufruf erfährt kein Gerät vom
			// Ende: Der Ereignisstrom meldet sonst nur Wechsel eines Durchgangs, und
			// das Schliessen wechselt keinen. Jedes Telefon zeigte danach weiter eine
			// laufende Versammlung, und auf der Leinwand hinge das letzte Geschäft.
			await verkuendeStand(locals.benutzer.operatorId, params.id);
			return {
				geschlossen:
					'Versammlung geschlossen. ' +
					(e.geschlosseneAbstimmungen > 0
						? `${e.geschlosseneAbstimmungen} offene ${
								e.geschlosseneAbstimmungen === 1 ? 'Abstimmung' : 'Abstimmungen'
							} mitgeschlossen, `
						: '') +
					`${e.entwertet} ${e.entwertet === 1 ? 'Zugang' : 'Zugänge'} entwertet, ` +
					/*
					 * **Der Anzeigecode gilt noch eine Stunde** (M7-2-03,
					 * 15.10.2026). Hier stand «der Anzeigecode für den Beamer
					 * gilt nicht mehr», das Gegenteil des Verhaltens: Seit dem
					 * 21.08.2026 bleibt er gültig, damit die Wand die
					 * Abschlussseite zeigen kann (`schliesseVersammlung`
					 * setzt `display_code_hash` nicht mehr auf NULL), und zwar
					 * für `NACHLAUF_MS` nach dem Schluss. Entwertet werden die
					 * Zugänge der Teilnehmenden.
					 */
					`der Anzeigecode gilt noch ${nachlaufInWorten()}: So lange zeigt die Leinwand die Abschlussseite.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message } });
			}
			throw fehler;
		}
	},

	/**
	 * Die Frage am Einlass ein- oder ausschalten (Migration 108).
	 *
	 * Getrennt von `betriebsart`, weil sie etwas anderes entscheidet: die
	 * Betriebsart sagt, WER abstimmt, dieser Schalter nur, ob am Eingang
	 * gefragt wird. Deshalb auch keine Zustandsschranke — siehe
	 * `setzePapierfrage`.
	 */
	papierfrage: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			await setzePapierfrage(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				// **Ausdrücklich und nicht `jaNein`**: Dieser Umschalter schickt in
				// beiden Richtungen einen Wert; `jaNein` kennt nur `true`/`on` und
				// machte aus «einschalten» ein stilles Nichts.
				text(daten.get('fragen')) === 'ja'
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	betriebsart: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			await setzeBetriebsart(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				params.id,
				text(daten.get('betriebsart')) as Betriebsart,
				text(daten.get('grund')) || undefined
			);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
,

	/** Story 7.5: Die Versammlung einem gemeinsamen Abend zuordnen. */
	tag: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const tagId = text(daten.get('tag'));
		const wer = {
			operatorId: locals.benutzer.operatorId,
			userId: locals.benutzer.id,
			label: locals.benutzer.displayName
		};
		try {
			if (tagId) {
				// Auch hier: Was der Abend hart vorgibt, überschreibt die eigenen
				// Angaben — und das gehört gesagt, nicht bemerkt.
				const plan = await nimmInTagAuf(wer, tagId, params.id, 0);
				const was = plan.aendern[0]?.was ?? [];
				return {
					gespeichert: true,
					hinweis:
						was.length > 0 ? `Vom gemeinsamen Anlass übernommen: ${was.join(', ')}.` : undefined
				};
			}
			await nimmAusTag(wer, params.id);
			return { gespeichert: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
