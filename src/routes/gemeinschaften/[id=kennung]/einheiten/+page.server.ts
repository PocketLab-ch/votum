import { error, fail } from '@sveltejs/kit';
import { hatFreigegebeneVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import {
	bearbeiteEinheit,
	erstelleEinheit,
	erstelleEinheiten,
	erstelleQuotenart,
	holeEinheiten,
	holeQuotenarten,
	loescheQuotenart,
	pruefeGemeinschaftSalden,
	entferneEinheit
} from '$lib/server/einheiten';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	leseEinheitenzeilen,
	pruefeEinheit,
	quoteAusEingabe,
	type Zeilenfehler
} from '$lib/domain/einheiten';
import { pruefeEinheitenGehoeren } from '$lib/server/zugehoerigkeit';
import { ganzzahl, jaNein, text, zahlOderNichts } from '$lib/server/formular';
import type { UnitKind } from '$lib/domain/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const [quotenarten, einheiten, salden] = await Promise.all([
		holeQuotenarten(locals.benutzer.operatorId, params.id),
		holeEinheiten(locals.benutzer.operatorId, params.id),
		pruefeGemeinschaftSalden(locals.benutzer.operatorId, params.id)
	]);

	return {
		gemeinschaft,
		quotenarten,
		einheiten,
		salden,
		/**
		 * Ob diese Gemeinschaft schon eine Versammlung freigegeben hat
		 * (Nachprüfung 23.08.2026).
		 *
		 * Ab da hält eine Momentaufnahme fest, welche Einheit welche Wertquote
		 * trug; der Kern weist das Entfernen dann ab. Der Knopf verschwindet
		 * deshalb — eine Absage, die sich vorher wissen lässt, gehört nicht
		 * angeboten.
		 */
		hatteVersammlung: await hatFreigegebeneVersammlung(locals.benutzer.operatorId, params.id)
	};
};

function handelnder(benutzer: App.Locals['benutzer']) {
	return {
		operatorId: benutzer!.operatorId,
		userId: benutzer!.id,
		label: benutzer!.displayName
	};
}

/**
 * Liest die Quotenwerte eines Formularabschnitts.
 *
 * Ein leeres Feld bedeutet «an diesem Verteiler nicht beteiligt» und erzeugt
 * keinen Eintrag — anders als die Null, die eine Beteiligung mit Anteil null ist.
 *
 * Gelesen wird nur, was die Gemeinschaft an Arten führt. Ein Feld zu einem
 * inzwischen entfernten Verteiler wird übergangen statt abgewiesen: Ein Formular,
 * das seit fünf Minuten offen steht, soll nicht mit einem Fehler enden. Beim
 * CSV-Import ist es umgekehrt — dort prüft der Kern jeden Schlüssel, weil eine
 * unbekannte Spalte dort ein echter Fehler in der Datei ist.
 */
function quotenAus(daten: FormData, praefix: string, schluessel: string[]): Record<string, number> {
	const quotas: Record<string, number> = {};
	for (const k of schluessel) {
		const roh = text(daten.get(`${praefix}${k}`));
		if (roh === '') continue;
		// `quoteAusEingabe`: «123,5» wird eine Nachkommastelle, und der Kern nennt
		// in der Absage den Weg über einen grösseren Nenner (Ä-10); «1,000» bleibt
		// abgewiesen. Gerundet wird nichts.
		quotas[k] = quoteAusEingabe(roh);
	}
	return quotas;
}

export const actions: Actions = {
	/**
	 * Legt eine Einheit an.
	 *
	 * kennung: daten — `quotenAus` liest nur Zahlenfelder (`quote.<schlüssel>`).
	 * Welche Schlüssel es gibt, kommt aus `holeQuotenarten(…, params.id)`, also
	 * aus dieser Gemeinschaft; ein Feld zu einem fremden Schlüssel wird gar
	 * nicht erst gelesen. Kennungen sind nicht dabei.
	 */
	anlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const arten = await holeQuotenarten(locals.benutzer.operatorId, params.id);

		try {
			await erstelleEinheit(handelnder(locals.benutzer), {
				stwegId: params.id,
				kind: (text(daten.get('kind')) || 'unit') as UnitKind,
				label: text(daten.get('label')),
				quotas: quotenAus(daten, 'quote.', arten.map((a) => a.key)),
				countsAsHead: jaNein(daten.get('countsAsHead')),
				// Freiwillig, aber eigene Felder (Befund 26): Ohne sie landet «3.5 Zi.,
				// 87 m², EG links» in der Bezeichnung und steht danach überall.
				zimmer: zahlOderNichts(daten.get('zimmer')),
				flaeche: zahlOderNichts(daten.get('flaeche')),
				lage: text(daten.get('lage')) || null
			});
			return { angelegt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Mehrere Einheiten auf einmal — eine Zeile je Einheit.
	 *
	 * **Der Anlass** (Bedienbarkeitsprüfung 05.09.2026, Befund 29): «Fünf
	 * Einheiten sind fünfmal dasselbe Formular; ‹Aus Datei übernehmen› verlangt
	 * je einen Eigentümer und hilft hier nicht.»
	 *
	 * **Alles oder nichts.** Steht in einer Zeile ein Fehler, entsteht keine
	 * einzige Einheit. Die Hälfte anzulegen hiesse, dass der Verwalter nach der
	 * Absage nicht weiss, was schon dasteht — und beim zweiten Anlauf die ersten
	 * doppelt erzeugt.
	 */
	sammelAnlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const roh = String(daten.get('zeilen') ?? '');

		const befund = leseEinheitenzeilen(roh, params.id);
		if (befund.fehler.length > 0) {
			return fail(400, {
				zeilenfehler: befund.fehler,
				zeilen: roh,
				fehler: {
					nachricht:
						befund.fehler.length === 1
							? 'Eine Zeile geht nicht auf. Sie steht unten mit dem Grund.'
							: `${befund.fehler.length} Zeilen gehen nicht auf. Sie stehen unten mit dem Grund.`,
					feld: 'zeilen'
				}
			});
		}
		if (befund.einheiten.length === 0) {
			return fail(400, {
				zeilenfehler: [] as Zeilenfehler[],
				zeilen: roh,
				fehler: { nachricht: 'Es steht keine Zeile da.', feld: 'zeilen' }
			});
		}

		try {
			/*
			 * **In einer Transaktion, nicht in einer Schleife** (Code-Review
			 * 07.09.2026). Der Zeilenleser prüft die Form, `pruefeEinheit` die
			 * Sache — und die zweite Prüfung läuft erst beim Schreiben. Eine
			 * Schleife über `erstelleEinheit` hätte die Zeilen vor der ersten
			 * Absage festgeschrieben, während der Text darunter «es entsteht keine
			 * einzige Einheit» verspricht.
			 */
			const angelegt = await erstelleEinheiten(
				handelnder(locals.benutzer),
				params.id,
				befund.einheiten
			);
			return { sammelAngelegt: angelegt.length };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					zeilenfehler: [] as Zeilenfehler[],
					zeilen: roh,
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Speichert die ganze Tabelle auf einmal.
	 *
	 * Wer vierzehn Gemeinschaften erfasst, tippt die Quoten in einem Durchgang.
	 * Einheiten ohne Änderung erzeugen keinen Verlaufseintrag — das entscheidet
	 * der Kern, nicht diese Schleife.
	 *
	 * kennung: daten — wie beim Anlegen: `quotenAus` liest nur Zahlenfelder zu
	 * Schlüsseln aus dieser Gemeinschaft.
	 */
	speichern: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const arten = await holeQuotenarten(locals.benutzer.operatorId, params.id);
		const schluessel = arten.map((a) => a.key);
		const ids = daten.getAll('einheitId').map(String);

		try {
			/*
			 * **Jede Kennung muss zu DIESER Gemeinschaft gehören** (26.08.2026, aus
			 * der Sicherheitsprüfung). Die Liste kommt aus verborgenen Feldern, also
			 * von aussen — und `bearbeiteEinheit` nimmt `stwegId` aus der gefundenen
			 * Zeile, nicht aus der Eingabe: Das hier mitgeschickte `params.id`
			 * entschied gar nichts. Ohne diese Zeile benannte ein Speichern der
			 * einen Tabelle die Einheiten der anderen um, mit den Quoten dieser
			 * Seite.
			 *
			 * **Alle auf einmal und VOR der Schleife** (aus dem Code-Review der
			 * Behebung). Stand die Prüfung darin, waren beim Abweisen der dritten
			 * Kennung die ersten beiden schon geschrieben: Die Seite meldete eine
			 * Absage, und die Tabelle war trotzdem halb geändert.
			 */
			await pruefeEinheitenGehoeren(locals.benutzer.operatorId, params.id, ids);

			/*
			 * **Erst alle prüfen, dann alle schreiben** (Code-Review 07.09.2026).
			 * Dieselbe Überlegung wie bei der Zugehörigkeit eine Zeile darüber: Die
			 * Schleife schreibt je Zeile in eigener Transaktion, und ein «87 m2» in
			 * der letzten von vierzig Flächen liesse 39 Zeilen geschrieben und die
			 * Seite eine Absage melden. Die Felder tragen nur `inputmode`, also
			 * keine Browserprüfung.
			 *
			 * Vollständig ist das nicht — was erst die Datenbank sieht, sieht sie
			 * weiterhin erst dort. Es nimmt aber die Fälle heraus, die der Kern
			 * kennt, und das sind die, die im Alltag vorkommen.
			 */
			const eingaben = ids.map((id) => ({
				stwegId: params.id,
				kind: (text(daten.get(`kind.${id}`)) || 'unit') as UnitKind,
				label: text(daten.get(`label.${id}`)),
				quotas: quotenAus(daten, `q.${id}.`, schluessel),
				countsAsHead: jaNein(daten.get(`kopf.${id}`)),
				zimmer: zahlOderNichts(daten.get(`zimmer.${id}`)),
				flaeche: zahlOderNichts(daten.get(`flaeche.${id}`)),
				lage: text(daten.get(`lage.${id}`)) || null
			}));
			for (const eingabe of eingaben) pruefeEinheit(eingabe, arten);

			for (const [i, id] of ids.entries()) {
				await bearbeiteEinheit(handelnder(locals.benutzer), id, eingaben[i]);
			}
			return { gespeichert: ids.length };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/** Legt einen zusätzlichen Verteiler an. */
	verteilerAnlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			await erstelleQuotenart(handelnder(locals.benutzer), {
				stwegId: params.id,
				key: text(daten.get('key')),
				name: text(daten.get('name')),
				denominator: ganzzahl(daten.get('denominator')),
				isPrimary: false,
				sortOrder: ganzzahl(daten.get('sortOrder')) || 1
			});
			return { verteilerAngelegt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Entfernt einen Verteiler.
	 *
	 * Die Rückfrage kommt vom Server, weil nur er weiss, wie viele Einheiten an
	 * diesem Verteiler einen Wert tragen (docs/gestaltung.md). Ein `confirm()` im
	 * Browser fragte «wirklich?» und bekäme immer ja.
	 */
	/**
	 * Eine Einheit entfernen (22.08.2026, Befund A-01).
	 *
	 * Zweistufig wie beim Verteiler: Der erste Klick bringt die Rückfrage mit dem,
	 * was mitgeht; der zweite trägt `bestaetigt`. Die Schranke — hat die Einheit
	 * an einer freigegebenen Versammlung teilgenommen — sitzt im Kern und kommt
	 * als fachlicher Fehler zurück, nicht als Rückfrage: Sie ist nicht
	 * wegzuklicken.
	 */
	einheitEntfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * kennung: entfernen — `entferneEinheit` sucht die Zeile mit
			 * `WHERE id = … AND stweg_id = …` und sagt mit eigenem Satz ab («Diese
			 * Einheit gibt es nicht.»). Eine Prüfung davor stellte dieselbe Frage
			 * ein zweites Mal.
			 */
			const ergebnis = await entferneEinheit(handelnder(locals.benutzer), {
				stwegId: params.id,
				einheitId: text(daten.get('entfernen')),
				bestaetigt: text(daten.get('bestaetigt')) === 'true'
			});
			/*
			 * **Die Rückfrage ist eine Absage, kein Erfolg** (27.08.2026). Sie stand
			 * hier als gewöhnlicher Rückgabewert, `verteilerLoeschen` weiter unten
			 * beantwortet dieselbe Lage seit jeher mit `fail(409)`. 409, weil die
			 * Handlung an einem Zustand hängt, den der Aufrufer noch nicht kannte.
			 *
			 * **Was daran mit `use:enhance` zusammenhängt.** Ein Erfolg zieht
			 * `reset()` und `invalidateAll()` nach sich (`runtime/app/forms.js`,
			 * nachgelesen), eine Absage nicht. Für eine Frage, auf die noch niemand
			 * geantwortet hat, ist beides falsch: Sie ändert nichts und soll
			 * nichts anrühren. Dass der Entfernen-Knopf einer Tabellenzeile
			 * inzwischen einem eigenen, leeren Formular gehört (`form=`), nimmt dem
			 * `reset()` zwar den Schaden — der Grund für 409 ist aber der Zustand,
			 * nicht das Formular.
			 */
			if (ergebnis.rueckfrage) {
				return fail(409, {
					einheitRueckfrage: {
						...ergebnis.rueckfrage,
						einheitId: text(daten.get('entfernen'))
					}
				});
			}
			return { einheitEntfernt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	verteilerLoeschen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		try {
			/*
			 * kennung: artId — `loescheQuotenart` sucht den Verteiler mit
			 * `WHERE id = … AND stweg_id = …` und sagt mit eigenem Satz ab («Diesen
			 * Verteiler gibt es nicht.»).
			 */
			const ergebnis = await loescheQuotenart(handelnder(locals.benutzer), {
				stwegId: params.id,
				artId: text(daten.get('artId')),
				bestaetigt: jaNein(daten.get('bestaetigt'))
			});
			if (ergebnis.rueckfrage) {
				return fail(409, {
					rueckfrage: { ...ergebnis.rueckfrage, artId: text(daten.get('artId')) }
				});
			}
			return { verteilerEntfernt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
