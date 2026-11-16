/**
 * Eine Eigentümerzeile für sich, mit allem, was an ihr hängt.
 *
 * **Wozu diese Seite** (Auftraggeber, 27.08.2026). In der Kopfzelle der Liste standen
 * zuletzt sechs Einstiege: «Angaben berichtigen» dreimal (für die Zeile und je
 * mitberechtigter Person), «Vertretung wechseln», «Mitberechtigte» mit weiteren
 * Ausklappern darin, «Weitere Person aufnehmen» und die Wahl «Wohin geht die
 * Einladung?». Das war eine Seite in einer Tabellenzelle, samt Ausklapper im
 * Ausklapper.
 *
 * **Warum eine Seite und kein Fenster.** Das Haus hat das Muster schon:
 * `/personen/[id]` ist genau das, eine Seite je Gegenstand mit allem, was an ihm
 * hängt. Ein `<dialog>` wäre der kürzere Weg gewesen und wirkt ohne JavaScript
 * nicht — im Saal wird die Anwendung auf fremden Geräten benutzt. Und eine Seite
 * hat Platz für Personen, Einladungsziel und Vertretung, ohne dass die Tabelle
 * daneben quer läuft.
 *
 * **Die Aktionen sind umgezogen, nicht neu geschrieben.** Sie standen bis heute
 * in `../+page.server.ts`; zwei Abschriften desselben Ablaufs liefen
 * auseinander, sobald eine davon etwas mehr tut.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { hatFreigegebeneVersammlung } from '$lib/server/versammlungen';
import {
	bearbeiteEigentuemer,
	entferneEigentuemer,
	entferneJuengsteZuordnungDerEinheit,
	holeEigentuemer,
	stimmkraftAnsicht,
	trageMiteigentumEin
} from '$lib/server/eigentuemer';
import { alsGespeichert, personenliste } from '$lib/domain/personenangaben';
import {
	entferneMitberechtigten,
	holeMitberechtigteJeHuelle,
	nimmMitberechtigtenAuf,
	setzeVertretung,
	setzeZustelladresse
} from '$lib/server/mitberechtigte';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import { holePersonen, setzePersonenbemerkung } from '$lib/server/personen';
import {
	pruefeEinheitGehoert,
	pruefeParteiGehoert,
	pruefePersonAnZeile
} from '$lib/server/zugehoerigkeit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { text } from '$lib/server/formular';
import type { Actions, PageServerLoad } from './$types';

/** Heute in Schweizer Zeit, als Datum ohne Uhrzeit. */
function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}


function handelnder(benutzer: App.Locals['benutzer']) {
	return {
		operatorId: benutzer!.operatorId,
		userId: benutzer!.id,
		label: benutzer!.displayName
	};
}

/**
 * Die Zeile mit ihrem Umfeld.
 *
 * **Der Stichtag ist hier immer heute.** Diese Seite handelt; ein früherer Stand
 * gehört in die Liste daneben, die ihn ausdrücklich anbietet. Ein Formular, das
 * in die Gegenwart schreibt und einen vergangenen Stand zeigt, wäre eine
 * Ansicht, die das Gegenteil dessen verspricht, was sie tut.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	const stichtag = heute();
	const [eigentuemer, stimmkraft, personen, mitberechtigte, hatteVersammlung] = await Promise.all([
		// **Auch die archivierten**: Diese Seite ist der Weg zurück aus dem Archiv.
		holeEigentuemer(locals.benutzer.operatorId, params.id, 'alle'),
		stimmkraftAnsicht(locals.benutzer.operatorId, params.id, stichtag),
		// Nachschlagen, keine Auswahl — eine archivierte Person darf hier nicht
		// stillschweigend aus der Klammer fallen.
		holePersonen(locals.benutzer.operatorId, 'alle'),
		holeMitberechtigteJeHuelle(locals.benutzer.operatorId, params.id),
		hatFreigegebeneVersammlung(locals.benutzer.operatorId, params.id)
	]);

	/*
	 * **Die Zeile muss zu dieser Gemeinschaft gehören.** `party` hängt am
	 * Betreiber, nicht an der Gemeinschaft; ohne diese Prüfung zeigte
	 * `/gemeinschaften/A/eigentuemer/<Zeile aus B>` den Bestand von B unter der
	 * Adresse von A. Gesucht wird deshalb in der Liste dieser Gemeinschaft.
	 */
	const zeile = stimmkraft.zeilen.find((z) => z.partyId === params.partei);
	if (!zeile) error(404, 'Diese Eigentümerzeile gehört nicht zu dieser Gemeinschaft');

	const stamm = eigentuemer.find((e) => e.id === params.partei);

	return {
		gemeinschaft,
		zeile,
		/** Archivstand und Notiz stehen in den Stammdaten, nicht in der Stimmkraft. */
		archiviertAm: stamm?.archiviertAm ?? null,
		archivnotiz: stamm?.archivnotiz ?? null,
		/** Die übrigen Zeilen — für «Weitere Person aufnehmen». */
		eigentuemer,
		personen,
		// Als gewöhnliches Objekt statt als `Map`: Ein Objekt überquert die Grenze
		// zum Browser ohne Umweg.
		mitberechtigte: Object.fromEntries(mitberechtigte),
		hatteVersammlung,
		heute: stichtag,
		/*
		 * Der Zwischenschritt in der Pfadzeile des Layouts (UI-Durchgang
		 * 06.10.2026). Die Seite setzte ihn als eigene Zeile unter die des
		 * Layouts: «Gemeinschaften» und «Eigentümer und Stimmkraft» standen
		 * untereinander, ohne Trenner (31 px Versatz). Jetzt eine Zeile.
		 */
		pfadschritt: {
			titel: 'Eigentümer und Stimmkraft',
			pfad: `/gemeinschaften/${gemeinschaft.id}/eigentuemer`
		}
	};
};

export const actions: Actions = {
	/**
	 * Eine Eigentümerzeile archivieren (Migration 086).
	 *
	 * **Der Fall, für den es das braucht.** Entfernen weist zu Recht ab, sobald
	 * eine Momentaufnahme, eine Weisung oder ein Ausstand an der Zeile hängt —
	 * der Nachweis darf nicht ins Leere zeigen. Wer 2022 verkauft hat, taucht in
	 * der Stimmkraft eines späteren Datums schon nicht mehr auf; seine **Zeile**
	 * stand trotzdem für immer in der Liste. Genau die geht jetzt ins Archiv.
	 */
	archivieren: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		try {
			/*
			 * **Die Zeile muss zu DIESER Gemeinschaft gehören.** `archiviere`
			 * schränkt über die Betreiberkennung ein (RLS), nicht über die
			 * Gemeinschaft — eine fremde Parteikennung an dieser Aktion träfe
			 * sonst eine Zeile, die auf dieser Seite gar nicht steht.
			 *
			 * Ob sie noch mitzählt, prüft `archiviere` selbst am Schreibweg. Hier
			 * stand das früher hinter einem `if (zeile)` und wurde genau dann
			 * übersprungen, wenn es nötig gewesen wäre (25.08.2026).
			 */
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);

			const { name } = await archiviere(
				handelnder(locals.benutzer),
				'eigentuemer',
				parteiId,
				text(daten.get('notiz'))
			);
			return { hinweis: `«${name}» liegt im Archiv — aus der Liste genommen, sonst unverändert.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				/*
				 * `parteiId` und `notiz` reisen mit zurück: Der Knopf steht tief im
				 * Ausklapper einer Zeile, und nach dem Neuladen ist der zu. Ohne die
				 * Kennung wüsste die Seite nicht, welchen sie wieder aufklappen
				 * muss, und die getippte Begründung wäre weg (25.08.2026).
				 */
				return fail(400, {
					quelle: 'archiv',
					parteiId,
					notiz: text(daten.get('notiz')) ?? '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	hervorholen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		try {
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			const { name } = await holeAusArchiv(
				handelnder(locals.benutzer),
				'eigentuemer',
				parteiId
			);
			return { hinweis: `«${name}» steht wieder in der Liste.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// Wie beim Archivieren: Ohne `quelle` und `parteiId` bliebe der
				// Ausklapper zu, in dem der Knopf steht (25.08.2026).
				return fail(400, {
					quelle: 'archiv',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/*
	 * kennung: daten — `mitgliederAusFormular` liest die gewählten
	 * Gemeinschaften (`mitglied`) samt Anteil und Vertretung. Sie sind mit
	 * Absicht andere als die der Adresse: Sie werden ja gerade Mitglied dieser
	 * hier. `nimmGemeinschaftenAlsMitgliederAuf` schlägt jede in
	 * `listeGemeinschaften(operatorId, 'alle')` nach und meldet, was es nicht
	 * gibt; angelegt wird alles unter `params.id`.
	 */

	/**
	 * Aus Alleineigentum wird gemeinschaftliches Eigentum, ab einem Datum.
	 *
	 * **Der Fall** (Auftraggeber, 27.08.2026): «wenn A eine Einheit hat und nach einem
	 * Jahr B heiratet und Miteigentümerin wird, müsste ich dies ja ohne grossen
	 * Aufwand nachführen können.»
	 *
	 * **Warum der Weg hier steht und nicht im Erfassungsformular.** Dort steht
	 * unter «Einheit gleich zuordnen» nur, was am Stichtag **keinen** Eigentümer
	 * hat (`stimmkraftAnsicht().einheitenOhneEigentuemer`) — A's Wohnung ist dort
	 * folgerichtig nicht zu finden. Ein zweites Auswahlfeld mit allen Einheiten
	 * wäre der stille Eigentümerwechsel, den die Anwendung sonst überall mit
	 * Datum verlangt; und das Datum gehört an die Zeile, an der es gilt.
	 *
	 * kennung: mitberechtigterPersonId — `person` trägt keine `stweg_id`. Eine
	 * Person gehört keiner Gemeinschaft, sondern hat in jeder eine Zeile;
	 * `parteiAusPerson` legt sie unter der geprüften Gemeinschaft an.
	 */
	miteigentumEintragen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const parteiId = text(daten.get('parteiId'));
		const einheiten = daten
			.getAll('unitId')
			.map((w) => text(w))
			.filter((w) => w.length > 0);
		const ab = text(daten.get('ab')) || heute();

		const roh = personenliste({
			kennungen: daten.getAll('mitberechtigterKennung').map((w) => text(w)),
			namen: daten.getAll('mitberechtigterName').map((w) => text(w)),
			emails: daten.getAll('mitberechtigterEmail').map((w) => text(w)),
			telefone: daten.getAll('mitberechtigterTelefon').map((w) => text(w)),
			adressen: daten.getAll('mitberechtigterAdresse').map((w) => text(w)),
			wahlen: daten.getAll('mitberechtigterWahl').map((w) => text(w)),
			personIds: daten.getAll('mitberechtigterPersonId').map((w) => text(w))
		});
		const { kennungen, beteiligte } = roh;

		/*
		 * **Die bestehende Zeile steht an Stelle 0.** Das Formular schickt für sie
		 * das Wort `bestehend` statt einer Kennung: Sie hat keine Zeile in der
		 * Personenliste, sondern steht als «1. Person» fest darüber. Findet sich
		 * die gewählte Kennung nicht, bleibt der Index bei −1, und das heisst seit
		 * dem 27.08.2026 «niemand bezeichnet» — die Bezeichnung ist freiwillig.
		 * Ein stilles Zurückfallen auf 0 gäbe die Stimme dagegen der falschen
		 * Person, und das wäre keine offene Frage, sondern eine falsche Antwort.
		 */
		const vertreterFeld = text(daten.get('vertreter'));
		const gewaehlt = kennungen.indexOf(vertreterFeld);
		const vertreterIndex = vertreterFeld === 'bestehend' ? 0 : gewaehlt < 0 ? -1 : gewaehlt + 1;

		/*
		 * **Die getippten Angaben reisen mit** — dieselbe Lehre wie beim Anlegen:
		 * Wer zwei Personen erfasst hat und am Datum scheitert, tippt sonst alles
		 * noch einmal. `parteiId` sagt der Seite, welcher Ausklapper es war.
		 */
		const absage = (nachricht: string, feld: string | undefined) =>
			fail(400, {
				quelle: 'miteigentum',
				parteiId,
				notiz: '',
				beteiligte,
				vertreterIndex,
				fehler: { nachricht, feld }
			});

		try {
			// Beide Kennungen kommen aus dem Formular, also von aussen. Die
			// Zeilenrechte binden `party` und `unit` an den Betreiber, nicht an die
			// Gemeinschaft — wer zwei verwaltet, träfe sonst die andere.
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			for (const unitId of einheiten) {
				await pruefeEinheitGehoert(locals.benutzer.operatorId, params.id, unitId);
			}

			if (!roh.gleichlang) {
				return absage(
					'Die Angaben zu den Personen passen nicht zusammen. Laden Sie die Seite neu.',
					'mitberechtigte'
				);
			}
			const ohneWahl = beteiligte.findIndex((b) => b.wahl === 'bestehend' && !b.personId);
			if (ohneWahl >= 0) {
				return absage(
					`${ohneWahl + 2}. Person: Wählen Sie die Person aus der Liste.`,
					'mitberechtigte'
				);
			}

			const ergebnis = await trageMiteigentumEin(handelnder(locals.benutzer), {
				stwegId: params.id,
				bisherigeZeile: parteiId,
				einheiten,
				weitere: beteiligte.map(alsGespeichert),
				vertreterIndex,
				ab
			});
			return {
				hinweis:
					`«${ergebnis.name}» hält die Einheit ab dem ${ab}. Wer vorher stimmte, ` +
					'bleibt in jeder früheren Versammlung stehen.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return absage(fehler.message, fehler.feld);
			}
			throw fehler;
		}
	},

	/**
	 * Bestimmen, wer die eine Stimme einer gemeinschaftlichen Zeile ausübt.
	 *
	 * **Ohne diesen Weg nennte eine Absage einen Ausweg, den es nicht gibt:**
	 * `entferneMitberechtigten` weist das Entfernen der vertretenden Person ab
	 * mit «Bestimmen Sie zuerst eine andere Vertretung». Bis hierher liess sich
	 * die Vertretung nur beim Anlegen setzen.
	 */
	vertretungWechseln: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		const mitgliedId = text(daten.get('mitgliedId'));

		/*
		 * **«Nichts angekreuzt» ist nicht «ausdrücklich niemand»** (27.08.2026,
		 * aus dem Code-Review).
		 *
		 * Ein Auswahlknopf, den niemand anfasst, schickt sein Feld **gar nicht**;
		 * «niemand bezeichnet» schickt es leer. Ohne diese Unterscheidung wären
		 * beide dasselbe — und ein Klick auf «Übernehmen» ohne Wahl löschte den
		 * eingefrorenen `representative_name`, der auf Unterschriftenliste und
		 * Stimmzettel steht.
		 *
		 * **Erreichbar ist das nicht nur von aussen.** Eine Hülle aus der Zeit vor
		 * Migration 094 trägt den Namen als freien Text ohne Verweis; dann steht
		 * bei keinem der Knöpfe eine Vorauswahl, und wer bloss «Übernehmen»
		 * drückt, verlöre den Namen wortlos. Genau davor warnt der Hinweis, den
		 * die Seite über der Liste zeigt.
		 */
		if (!daten.has('mitgliedId')) {
			return fail(400, {
				quelle: 'vertretung',
				parteiId,
				notiz: '',
				fehler: {
					nachricht:
						'Wählen Sie, wer die Stimme ausübt — oder ausdrücklich «niemand bezeichnet».',
					feld: 'mitgliedId'
				}
			});
		}

		try {
			// Beide Kennungen kommen aus verborgenen Feldern, also von aussen. Die
			// Zeilenrechte binden `party` an den Betreiber, nicht an die
			// Gemeinschaft — wer zwei verwaltet, träfe sonst die andere.
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			/*
			 * **Leer heisst «niemand bezeichnet»** (27.08.2026). Die Bezeichnung ist
			 * seit heute freiwillig; ohne diesen Zweig führte `pruefeParteiGehoert`
			 * die Rücknahme in eine Absage, und die Wahl wäre eine Einbahnstrasse.
			 */
			if (mitgliedId) {
				await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, mitgliedId);
			}
			const { huelle, vertreter } = await setzeVertretung(
				handelnder(locals.benutzer),
				parteiId,
				mitgliedId || null
			);
			return {
				hinweis: vertreter
					? `«${vertreter}» übt jetzt die Stimme von «${huelle}» aus.`
					: `Für «${huelle}» ist keine Vertretung mehr bezeichnet.`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// `quelle` und `parteiId` reisen mit: Der Weg steht im Ausklapper
				// einer Zeile, und nach dem Neuladen ist der zu.
				return fail(400, {
					quelle: 'vertretung',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Eine Person aus einer Hülle nehmen.
	 *
	 * **Ohne diesen Weg wäre die Hülle für immer gesperrt** (26.08.2026,
	 * Aufgabe 4). Seit heute weist `pruefeZeileTilgbar` das Tilgen einer Hülle
	 * mit Mitberechtigten ab, und `pruefeHakenUmlegbar` tat das für den Haken
	 * schon vorher — beide nennen als Ausweg «Nehmen Sie die Mitberechtigten
	 * zuerst weg». `entferneMitberechtigten` gab es seit Aufgabe 2, aber keine
	 * Route rief sie auf: eine Absage, die auf nichts zeigte.
	 */
	mitberechtigtenEntfernen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		const mitgliedId = text(daten.get('mitgliedId'));
		try {
			// Beide Kennungen kommen aus verborgenen Feldern, also von aussen — wie
			// beim Wechsel der Vertretung. Die Zeilenrechte binden `party` an den
			// Betreiber, nicht an die Gemeinschaft.
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, mitgliedId);
			await entferneMitberechtigten(handelnder(locals.benutzer), parteiId, mitgliedId);
			return { hinweis: 'Die Person steht nicht mehr bei dieser gemeinschaftlichen Zeile.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				// `quelle` und `parteiId` reisen mit: Der Weg steht im Ausklapper
				// einer Zeile, und nach dem Neuladen ist der zu.
				return fail(400, {
					quelle: 'mitberechtigte',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Eine bestehende Eigentümerzeile als Mitberechtigte aufnehmen.
	 *
	 * **Das Gegenstück zum Entfernen** — `docs/gestaltung.md`: «Was angelegt
	 * werden kann, muss weggehen können», und hier auch umgekehrt. Ohne diesen
	 * Weg wäre das Entfernen eine Einbahnstrasse: Wer die falsche Person
	 * wegnimmt, bekommt die richtige nie hinein, und die Berichtigung «falsche
	 * Person weg, richtige hin» endete beim ersten Schritt.
	 *
	 * Zur Wahl stehen bestehende Zeilen, keine neuen Namen: Eine neue Person
	 * entsteht über «Eigentümer erfassen» — zwei Wege, die dieselbe Zeile
	 * verschieden anlegen, führten irgendwann zu zwei Zeilen für einen Menschen.
	 */
	mitberechtigtenAufnehmen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		const mitgliedId = text(daten.get('mitgliedId'));
		try {
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			if (!mitgliedId) {
				return fail(400, {
					quelle: 'mitberechtigte',
					parteiId,
					notiz: '',
					fehler: { nachricht: 'Wählen Sie die Person aus der Liste.', feld: 'mitgliedPartyId' }
				});
			}
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, mitgliedId);
			await nimmMitberechtigtenAuf(handelnder(locals.benutzer), parteiId, mitgliedId);
			return { hinweis: 'Die Person ist als mitberechtigt eingetragen.' };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'mitberechtigte',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Die gemeldete Zustelladresse setzen oder aufheben (ZGB Art. 712n,
	 * Rz. 49/51).
	 *
	 * **Sie entscheidet, wer die Einladung bekommt**, und ohne Weg dorthin wäre
	 * die Marke «Zustelladresse» in der Liste eine Anzeige für einen Zustand,
	 * den niemand herstellen kann. Der Regelfall bleibt «keine gemeldet» — dann
	 * geht die Einladung an alle einzeln.
	 */
	zustelladresseSetzen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		const mitgliedId = text(daten.get('mitgliedId'));
		try {
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			if (mitgliedId) {
				await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, mitgliedId);
			}
			await setzeZustelladresse(handelnder(locals.benutzer), parteiId, mitgliedId || null);
			return {
				hinweis: mitgliedId
					? 'Die Einladung geht künftig an die gemeldete Zustelladresse.'
					: 'Es ist keine Zustelladresse mehr gemeldet — die Einladung geht an alle einzeln.'
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					quelle: 'mitberechtigte',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	/**
	 * Eine versehentliche Zuordnung tilgen (23.08.2026, Befund A-13).
	 *
	 * Nicht «beenden» — das wäre ein Eigentümerwechsel und stünde als solcher im
	 * Protokoll. Hier geht es um den anderen Fall: Jemand hat sich vertan, und die
	 * Zuordnung soll nie gewesen sein.
	 */
	/**
	 * Die Angaben einer Eigentümerzeile berichtigen (23.08.2026, Prüflauf II).
	 *
	 * **Der Weg fehlte, die Funktion gab es.** `bearbeiteEigentuemer` steht seit
	 * je im Kern und kann Name, Vertreter, E-Mail, Telefon und Adresse — nur rief
	 * sie keine Route auf. Im Prüflauf standen nach der CSV-Übernahme fünfzehn
	 * Eigentümer ohne E-Mail da, und es gab keinen Weg, sie nachzutragen: Die
	 * Übernahme kennt keine Kontaktspalten, und ohne Personenverknüpfung gibt es
	 * auch keine Personenseite.
	 *
	 * **Die E-Mail ist nicht irgendein Feld** — sie trägt den Zugangscode zur
	 * Versammlung. Ohne sie bleibt nur der Postweg.
	 *
	 * Die Art (`kind`) bleibt aussen vor: Ob eine Partei ein Mensch, eine Firma
	 * oder eine Gemeinschaft ist, hängt an ihren Zuordnungen und daran, wer für
	 * sie handelt — das ist kein Schreibfehler.
	 */
	angabenBerichtigen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		const personId = text(daten.get('personId'));
		try {
			/*
			 * **Beides wird geprüft, BEVOR etwas geschrieben ist** (26.08.2026, aus
			 * der Sicherheitsprüfung und dem Code-Review ihrer Behebung).
			 *
			 * Die Zeile: `bearbeiteEigentuemer` nimmt `stwegId` aus der gefundenen
			 * Zeile und nicht aus der Eingabe — das mitgeschickte `params.id`
			 * entschied hier gar nichts.
			 *
			 * Die Person: nicht gegen die Gemeinschaft (`person` trägt keine
			 * `stweg_id`), sondern gegen die eben geprüfte Zeile. Ohne das
			 * überschrieb ein gefälschtes `personId` von der Seite der Gemeinschaft
			 * A aus die Bemerkung einer Person, die nur in B eine Zeile hat.
			 *
			 * Beide stehen **vor** `bearbeiteEigentuemer`, dessen Transaktion sonst
			 * schon abgeschlossen wäre: Hat eine zweite Sitzung die Person
			 * inzwischen gelöst, käme die Absage, nachdem Name und Anschrift bereits
			 * geschrieben sind — und der Benutzer hielte alles für unverändert.
			 */
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			if (personId) {
				await pruefePersonAnZeile(locals.benutzer.operatorId, parteiId, personId);
			}

			const e = await bearbeiteEigentuemer(handelnder(locals.benutzer), parteiId, {
				stwegId: params.id,
				kind: text(daten.get('kind')) as never,
				displayName: text(daten.get('displayName')),
				representativeName: text(daten.get('representativeName')) || null,
				isCommunity: text(daten.get('isCommunity')) === 'true',
				email: text(daten.get('email')) || undefined,
				phone: text(daten.get('phone')) || undefined,
				address: text(daten.get('address')) || undefined
			});
			/*
			 * **Die Bemerkung hängt an der Person** (Prüflauf I, A-12): «Vera
			 * Probemann kommt nie und bevollmächtigt jedes Jahr denselben Nachbarn —
			 * das gehört an die Person.» Sie wird deshalb dort geschrieben und
			 * nicht an der Eigentümerzeile; eine zweite Spalte wäre eine zweite
			 * Wahrheit gewesen.
			 *
			 * Nur wo eine Person verknüpft ist — sonst gäbe es niemanden, an dem
			 * die Bemerkung hinge. Das Formular zeigt dort statt des Feldes den
			 * Weg zum Verknüpfen.
			 */
			if (personId) {
				// Dass es die Person dieser Zeile ist, steht oben — vor dem ersten
				// Schreiben.
				await setzePersonenbemerkung(
					handelnder(locals.benutzer),
					personId,
					text(daten.get('bemerkung')) || null
				);
			}
			return { hinweis: `Die Angaben zu «${e.displayName}» sind berichtigt.` };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				/*
				 * **`quelle` reist mit** (27.08.2026, aus dem Code-Review). Der
				 * Kasten steht zugeklappt da; ohne diese Angabe läse man die Meldung
				 * am Seitenkopf und fände das Formular nicht wieder, auf das sie sich
				 * bezieht. Der Kommentar an der Seite versprach das seit dem
				 * 25.08.2026 und hielt es nur für die Archivierung, weil deren
				 * Formular im selben Ausklapper liegt.
				 */
				return fail(400, {
					quelle: 'angaben',
					parteiId,
					notiz: '',
					fehler: { nachricht: fehler.message, feld: fehler.feld }
				});
			}
			throw fehler;
		}
	},

	zuordnungTilgen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **Die Einheit, nicht die Partei** (26.08.2026, aus der
			 * Sicherheitsprüfung). Was hier von aussen kommt, ist eine
			 * Einheitskennung; sie in der Parteitabelle zu suchen, hiesse jeden
			 * gültigen Weg zu sperren.
			 */
			await pruefeEinheitGehoert(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('unitId'))
			);
			const e = await entferneJuengsteZuordnungDerEinheit(
				{
					operatorId: locals.benutzer.operatorId,
					userId: locals.benutzer.id,
					label: locals.benutzer.displayName
				},
				text(daten.get('unitId'))
			);
			return {
				hinweis: `Die Zuordnung von «${e.einheit}» ist getilgt.${
					e.wiederOffen ? ' Der frühere Eigentümer gilt wieder.' : ''
				}`
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Eine Zeile tilgen, die nie etwas gehalten hat. Die vier Schranken stehen
	 * im Kern (`entferneEigentuemer`) — hier wird nur der Name zurückgemeldet,
	 * damit die Bestätigung sagen kann, wen es getroffen hat.
	 */
	eigentuemerTilgen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		let getilgt = '';
		try {
			// Die Kennung kommt aus einem verborgenen Feld, also von aussen
			// (26.08.2026, aus der Sicherheitsprüfung).
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			const { name } = await entferneEigentuemer(handelnder(locals.benutzer), parteiId);
			/*
			 * **Zurück zur Liste** (27.08.2026, mit dem Umzug auf diese Seite). Die
			 * Zeile, deren Seite das hier ist, gibt es danach nicht mehr; ein
			 * Verbleib endete beim nächsten Laden in einem 404. Der Name reist als
			 * Abfrageteil mit, damit die Liste sagen kann, wen es getroffen hat.
			 */
			getilgt = name;
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
		// Ausserhalb des `try`: Ein `redirect` wirft, und der `catch` darüber
		// hielte ihn für einen Fehler.
		redirect(303, `/gemeinschaften/${params.id}/eigentuemer?getilgt=${encodeURIComponent(getilgt)}`);
	},
};
