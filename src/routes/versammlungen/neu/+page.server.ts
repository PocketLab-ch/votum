import { error, fail, redirect } from '@sveltejs/kit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { betriebsartVorschlag, type Versammlungsart } from '$lib/domain/versammlung';
import { text } from '$lib/server/formular';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { ohneEigeneQuote } from '$lib/domain/einheiten';
import { erstelleVersammlung, holeAlleVersammlungen, zaehleParteien } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import type { Actions, PageServerLoad } from './$types';

/**
 * Ein Einstieg für beides — und seit dem 11.08.2026 auch **derselbe Weg**.
 *
 * Vorher liefen die zwei Fälle verschieden: Bei einer einzelnen Versammlung
 * führte die Auswahl der Gemeinschaft auf eine zweite Seite mit den Eckdaten,
 * bei mehreren stand alles zusammen auf einer. Die Schrittanzeige zeigte einmal
 * drei Schritte, einmal zwei. Gemeldet: «Warum gibt man bei einzelner
 * Versammlung die Eckdaten nicht ein und bei mehreren Gemeinschaften schon?
 * Hier bräuchte es eine Konsistenz.»
 *
 * Jetzt beide gleich: **wer tagt, wann und wo** — auf einer Seite, mit einem
 * Knopf. Was darüber hinaus zu einer Versammlung gehört (ordentlich oder
 * ausserordentlich, Erst- oder Zweitversammlung, Abstimmungsweise, Anlass,
 * Vorgängerin), steht danach auf ihrer eigenen Seite, wo es ohnehin änderbar
 * ist. Es zweimal zu führen hiess, zwei Formulare für dieselben Felder zu
 * pflegen — und eines davon lief zuverlässig hinterher.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaften = await listeGemeinschaften(locals.benutzer.operatorId, 'aktiv');

	return {
		// Die Adresse kommt mit, weil sie das Unterscheidungsmerkmal ist: Zwei
		// Gemeinschaften heissen «Haus 4», und die Wahl fällt sonst auf gut Glück.
		/*
		 * **Klammern tagen nicht** (23.08.2026, Prüflauf II, B-03). Eine
		 * übergeordnete Gemeinschaft ohne eigene Wertquote hat keine Einheiten und
		 * damit keine Stimmberechtigten. Sie stand trotzdem in der Auswahl; wer
		 * sie ankreuzte, bekam eine Versammlung, an der niemand teilnehmen kann.
		 *
		 * Sie verschwindet nicht, sondern wird gesperrt und erklärt: Wer sie sucht
		 * und nicht findet, sucht weiter. Wer liest, warum sie nicht wählbar ist,
		 * weiss danach mehr als vorher.
		 */
		gemeinschaften: gemeinschaften.map((g) => ({
			id: g.id,
			name: g.name,
			ort: g.ort ?? '',
			adresse: [g.strasse, [g.plz, g.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '),
			klammer: ohneEigeneQuote(g)
		})),
		/** Kommt man aus einer Gemeinschaft, ist sie vorgewählt. */
		fuer: url.searchParams.get('fuer'),
		heute: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' })
	};
};

/**
 * Ordentlich oder ausserordentlich — für alle, die hier entstehen.
 *
 * Gilt für den ganzen Anlass, nicht je Haus: «Ob es die ordentliche oder
 * ausserordentliche ist, ist für die Versammlung ja gesamt» (11.08.2026). Der
 * Anlass reist mit, weil er bei einer ausserordentlichen Versammlung in die
 * Einladung gehört; der Kern weist sie ohne ihn ab.
 */
function artUndAnlass(daten: FormData): { art: Versammlungsart; anlass?: string } {
	const art: Versammlungsart =
		text(daten.get('versammlungsart')) === 'ausserordentlich' ? 'ausserordentlich' : 'ordentlich';
	return { art, anlass: art === 'ausserordentlich' ? text(daten.get('anlass')) : undefined };
}

function wer(locals: App.Locals) {
	return {
		operatorId: locals.benutzer!.operatorId,
		userId: locals.benutzer!.id,
		label: locals.benutzer!.displayName
	};
}

export const actions: Actions = {
	/**
	 * Eine einzelne Versammlung.
	 *
	 * Art und Anlass kommen aus dem Formular; Stufe und Abstimmungsweise aus den
	 * Regelwerten (Erstversammlung, Weise nach der Zahl der Parteien). Beides
	 * steht danach auf der Versammlungsseite und lässt sich dort ändern, solange
	 * sie im Entwurf ist.
	 */
	einzeln: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const stwegId = text(daten.get('gemeinschaft'));
		const datum = text(daten.get('datum'));

		const scheitern = (nachricht: string, feld?: string) =>
			fail(400, { fehler: { nachricht, feld }, werte: Object.fromEntries(daten), gewaehlt: [stwegId] });

		if (!stwegId) return scheitern('Wählen Sie die Gemeinschaft.', 'gemeinschaft');
		/*
		 * **Das Datum muss vor die Zählung** (Sicherheitsdurchgang 06.09.2026).
		 * Seit `zaehleParteien` auf einen Stichtag rechnet, läuft es als erstes
		 * in die Abfrage: Ein leeres Feld ergäbe dort `''::date` und damit einen
		 * Datenbankfehler, den `uebersetzeSchranke` nicht kennt (22007) — statt
		 * der Meldung «Das Datum der Versammlung fehlt.» käme eine Fehlerseite.
		 * Bis dahin fing `erstelleVersammlung` den Fall ab; `required` im
		 * Formular hilft nur im Browser.
		 */
		if (!datum) return scheitern('Das Datum der Versammlung fehlt.', 'datum');

		let id: string;
		try {
			const parteien = await zaehleParteien(locals.benutzer.operatorId, stwegId, datum);
			const v = await erstelleVersammlung(wer(locals), {
				stwegId,
				datum,
				uhrzeit: text(daten.get('uhrzeit')),
				ort: text(daten.get('ort')),
				...artUndAnlass(daten),
				stufe: 'erste',
				betriebsart: betriebsartVorschlag(parteien),
				vorgaengerId: null
			});
			id = v.id;
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) return scheitern(fehler.message, fehler.feld);
			throw fehler;
		}
		redirect(303, `/versammlungen/${id}`);
	},

	/**
	 * Die gemeinsame Versammlung und ihre Teilnehmerinnen in einem Zug.
	 *
	 * Bis zum 11.08.2026 entstand sie leer, und jede Versammlung war danach
	 * einzeln anzulegen und einzeln zuzuordnen — bei sieben Häusern fünfzehn
	 * Formulare für einen Vorgang, den man als einen erlebt.
	 *
	 * Die Auswahl bleibt **freiwillig**: Steht noch nicht fest, wer tagt, legt
	 * man sie leer an und ordnet später zu.
	 */
	gemeinsam: async ({ request, locals }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const datum = text(daten.get('datum'));
		const uhrzeit = text(daten.get('uhrzeit'));
		const ort = text(daten.get('ort'));
		const gewaehlt = daten
			.getAll('gemeinschaft')
			.map((g) => String(g))
			.filter(Boolean);

		const scheitern = (nachricht: string, feld?: string) =>
			fail(400, {
				fehler: { nachricht, feld },
				// Ohne die Auswahl selbst: `Object.fromEntries` behielte von
				// mehrfach vergebenen Feldern nur den letzten Wert, und die Seite
				// zeigte danach eine Gemeinschaft angekreuzt statt fünf.
				werte: Object.fromEntries(daten),
				gewaehlt
			});

		/*
		 * **Vorher prüfen, nicht unterwegs scheitern.**
		 *
		 * Es gibt keine Klammer über die einzelnen Schreibvorgänge. Bräche der
		 * dritte ab, stünden zwei Versammlungen und eine halbe gemeinsame im
		 * Bestand, und niemand wüsste, welche.
		 *
		 * Geprüft wird auf **gleiche Stufe**, nicht bloss auf gleiche Gemeinschaft.
		 * Hier entstehen immer Erstversammlungen; eine bestehende Zweitversammlung
		 * am selben Tag ist deshalb kein Hindernis — auch wenn es sie nach ZGB
		 * Art. 712p Abs. 2 (erster zulässiger Abstand: elf Tage) gar nicht geben dürfte.
		 * Diese Prüfung ist nicht der Ort, das zu ahnden.
		 */
		if (gewaehlt.length > 0) {
			/*
			 * **Zuerst: Gehört jede gewählte Gemeinschaft diesem Betreiber?**
			 * Sonst entstand der Abend, und erst die erste Versammlung scheiterte
			 * an der fremden Kennung: ein leerer Abend unter dem eigenen Betreiber
			 * und eine 500-Seite (Feldteil von `e2e/fremdbetreiber.mjs`,
			 * 27.10.2026). Verglichen wird mit der eigenen Liste, ohne Umwandlung
			 * nach `uuid`; eine krumme Kennung ist damit dieselbe Absage.
			 */
			const eigene = new Set(
				(await listeGemeinschaften(locals.benutzer.operatorId, 'alle')).map((g) => g.id)
			);
			if (gewaehlt.some((g) => !eigene.has(g))) {
				const f = fremdeGemeinschaft('gemeinschaft');
				return scheitern(f.message, f.feld);
			}

			const alle = await holeAlleVersammlungen(locals.benutzer.operatorId, 'alle');
			const belegt = alle.filter(
				(v) => v.datum === datum && v.stufe === 'erste' && gewaehlt.includes(v.stwegId)
			);
			if (belegt.length > 0) {
				const namen = [...new Set(belegt.map((v) => v.gemeinschaftName))].join(', ');
				return scheitern(
					`An diesem Tag besteht bereits eine Erstversammlung für ${namen}. ` +
						'Nehmen Sie die Gemeinschaft aus der Auswahl und nehmen Sie die bestehende ' +
						'Versammlung unter «Wer tagt mit» auf, oder wählen Sie einen anderen Tag.',
					'gemeinschaft'
				);
			}
		}

		let id: string;
		try {
			const tag = await erstelleVersammlungstag(wer(locals), {
				bezeichnung: text(daten.get('bezeichnung')),
				datum,
				uhrzeit,
				ort,
				bemerkung: text(daten.get('bemerkung')) || null
			});
			id = tag.id;

			for (const [stelle, stwegId] of gewaehlt.entries()) {
				const parteien = await zaehleParteien(locals.benutzer.operatorId, stwegId, datum);
				const v = await erstelleVersammlung(wer(locals), {
					stwegId,
					datum,
					uhrzeit,
					ort,
					...artUndAnlass(daten),
					stufe: 'erste',
					betriebsart: betriebsartVorschlag(parteien),
					vorgaengerId: null
				});
				await nimmInTagAuf(wer(locals), id, v.id, stelle);
			}
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return scheitern(fehler.message, fehler.feld);
			}
			throw fehler;
		}
		// Ausserhalb des try: Die Weiterleitung wirkt über eine Ausnahme, die der
		// Fehlerzweig sonst als fachlichen Fehler behandelte.
		redirect(303, `/tage/${id}/haeuser`);
	}
};
