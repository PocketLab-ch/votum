import { error, fail } from '@sveltejs/kit';
import { hatFreigegebeneVersammlung } from '$lib/server/versammlungen';
import { holeGemeinschaft } from '$lib/server/gemeinschaften';
import { holeEinheiten } from '$lib/server/einheiten';
import {
	aufnahmesatz,
	mitgliederAusFormular,
	nimmGemeinschaftenAlsMitgliederAuf
} from '$lib/server/mitgliedsgemeinschaften';
import {
	erstelleEigentuemer,
	erstelleGemeinschaftlicheZeile,
	holeEigentuemer,
	ordneEigentumZu,
	planeEigentumszuordnung,
	stimmkraftAnsicht,
	holeEigentumsverlauf
} from '$lib/server/eigentuemer';
import { alsGespeichert, personenliste } from '$lib/domain/personenangaben';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { mitAbsage } from '$lib/server/absage';
import {
	holeHuellenVonMitglied,
	holeMitberechtigteJeHuelle,
	holeNurMitberechtigte
} from '$lib/server/mitberechtigte';
import { listeGemeinschaften } from '$lib/server/gemeinschaften';
import { beendeVertretung, bezeichneVertreter, holeVertretungen } from '$lib/server/vertretung';
import {
	eigentuemerzeileAusPerson,
	erstellePerson,
	holePersonen,
	verknuepfePartei
} from '$lib/server/personen';
import {
	pruefeEinheitGehoert,
	pruefeParteiGehoert,
	pruefeVertretungGehoert
} from '$lib/server/zugehoerigkeit';
import { eigentuemerfelder } from '$lib/domain/eigentuemer';
import { jaNein, text } from '$lib/server/formular';
import type { PartyKind } from '$lib/domain/types';
import type { Actions, PageServerLoad } from './$types';

/** Heute in Schweizer Zeit, als Datum ohne Uhrzeit. */
function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}


/**
 * Der Stichtag ist sichtbar und veränderbar und kommt aus der Adresszeile
 * (`?stichtag=`). Ein ungültiger Wert lief bis zum 16.10.2026 als rohe
 * Ausnahme durch (Block B2); `verlangeStichtag` in den Ladefunktionen und der
 * gemeinsame Fang `mitAbsage` machen daraus die Absage «Der Stichtag ist kein
 * gültiges Datum.».
 */
export const load: PageServerLoad = mitAbsage(async ({ locals, params, url }) => {
	if (!locals.benutzer) error(401, 'Nicht angemeldet');

	const gemeinschaft = await holeGemeinschaft(locals.benutzer.operatorId, params.id);
	if (!gemeinschaft) error(404, 'Gemeinschaft nicht gefunden');

	// Der Stichtag ist sichtbar und veränderbar: Wer den Stand einer vergangenen
	// Versammlung sehen will, muss ihn setzen können, ohne die Daten anzurühren.
	const stichtag = url.searchParams.get('stichtag') || heute();

	/*
	 * **Der Name der getilgten Zeile reist im Abfrageteil mit** (27.08.2026).
	 * Getilgt wird auf der Seite der Zeile; danach gibt es sie nicht mehr, und
	 * ein Verbleib dort endete beim nächsten Laden in einem 404. Der Weg zurück
	 * führt hierher, und die Meldung muss sagen, wen es getroffen hat.
	 */
	const getilgt = url.searchParams.get('getilgt') || null;

	const [
		eigentuemer,
		einheiten,
		stimmkraft,
		alle,
		vertretungen,
		personen,
		mitberechtigte,
		nurMitberechtigte
	] = await Promise.all([
			// **Auch die archivierten** — die Seite filtert selbst, damit der Schalter
			// ohne Seitenwechsel wirkt.
			holeEigentuemer(locals.benutzer.operatorId, params.id, 'alle'),
			holeEinheiten(locals.benutzer.operatorId, params.id),
			stimmkraftAnsicht(locals.benutzer.operatorId, params.id, stichtag),
			// Auswahl moeglicher Mitgliedsgemeinschaften — eine archivierte gehoert
			// nicht zur Wahl gestellt.
			listeGemeinschaften(locals.benutzer.operatorId, 'aktiv'),
			holeVertretungen(locals.benutzer.operatorId, params.id),
			// **Nachschlagen, keine Auswahl**: Die Seite sucht zu jeder Zeile die
			// Person. Fiele die archivierte heraus, verloere die Zeile ihre
			// Verknuepfung — lautlos.
			holePersonen(locals.benutzer.operatorId, 'alle'),
			/*
			 * **Die Mitberechtigten je Hülle** (Migration 094). Gebraucht wird die
			 * Zuordnung hier schon für den Wechsel der Vertretung: Zur Wahl steht
			 * genau, wer eingetragen ist — `party_vertreter_ist_mitglied` (Migration
			 * 095) liesse nichts anderes zu.
			 */
			holeMitberechtigteJeHuelle(locals.benutzer.operatorId, params.id),
			/*
			 * **Wer aus der Hauptliste genommen wird** (Aufgabe 4, Schritt 2).
			 * Nur Zeilen, die ausser der Mitberechtigung nichts halten — der
			 * Eigentümer mit eigener Einheit **und** einem Anteil am Paar bleibt
			 * stehen, samt seiner Kopfstimme.
			 */
			holeNurMitberechtigte(locals.benutzer.operatorId, params.id)
		]);

	return {
		gemeinschaft,
		getilgt,
		eigentuemer,
		einheiten,
		stimmkraft,
		/**
		 * Ob diese Gemeinschaft schon eine Versammlung freigegeben hat
		 * (23.08.2026, Befund A-13).
		 *
		 * Entscheidet, ob der Weg zum Tilgen einer Zuordnung angeboten wird. Ab
		 * der ersten Freigabe steht in einer Momentaufnahme, wem was gehörte —
		 * und der Kern weist das Tilgen dann ab. Einen Knopf anzubieten, den der
		 * Server abweist, ist auch mit schöner Meldung ein Fehler (Lehre vom
		 * 21.08.2026); hier steht er deshalb gar nicht erst da.
		 */
		hatteVersammlung: await hatFreigegebeneVersammlung(locals.benutzer.operatorId, params.id),
		stichtag,
		heute: heute(),
		// Story 7.1: Welche Gemeinschaften als Eigentümerinnen in Frage kommen.
		// Sich selbst nicht — das wiese der Kern ohnehin ab.
		moeglicheMitglieder: alle
			.filter((g) => g.id !== params.id)
			.map((g) => ({ id: g.id, name: g.name })),
		vertretungen,
		personen,
		// Als gewöhnliches Objekt statt als `Map`: Die Seite schlägt je Zeile
		// nach, und ein Objekt überquert die Grenze zum Browser ohne Umweg.
		mitberechtigte: Object.fromEntries(mitberechtigte),
		nurMitberechtigte,
		/**
		 * Die Eigentumshistorie (Auftraggeber, 01.09.2026).
		 *
		 * **Alle Zeilen, unabhängig vom Stichtag.** Die ganze übrige Seite zeigt
		 * den Stand zu einem Tag; genau deshalb war der Verlauf bis hierher
		 * unsichtbar. Wer wissen will, wem die Wohnung 2024 gehörte, müsste sonst
		 * den Stichtag der ganzen Seite verstellen und wieder zurückstellen.
		 */
		verlauf: await holeEigentumsverlauf(locals.benutzer.operatorId, params.id)
	};
});

function handelnder(benutzer: App.Locals['benutzer']) {
	return {
		operatorId: benutzer!.operatorId,
		userId: benutzer!.id,
		label: benutzer!.displayName
	};
}

export const actions: Actions = {
	/*
	 * kennung: daten — `mitgliederAusFormular` liest die gewählten
	 * Gemeinschaften (`mitglied`) samt Anteil und Vertretung. Sie sind mit
	 * Absicht andere als die der Adresse: Sie werden ja gerade Mitglied dieser
	 * hier. `nimmGemeinschaftenAlsMitgliederAuf` schlägt jede in
	 * `listeGemeinschaften(operatorId, 'alle')` nach und meldet, was es nicht
	 * gibt; angelegt wird alles unter `params.id`.
	 */
	/**
	 * Weitere Gemeinschaften als Mitglieder aufnehmen.
	 *
	 * **Der Regelfall steht auf der Anlegeseite** («Eine Miteigentümergemeinschaft,
	 * deren Mitglieder Gemeinschaften sind»); hier kommt später eines dazu. Beide
	 * Wege laufen durch `nimmGemeinschaftenAlsMitgliederAuf` — zwei Abschriften
	 * desselben Ablaufs liefen auseinander, sobald eine davon etwas mehr tut.
	 */
	mitgliederAnlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			const befund = await nimmGemeinschaftenAlsMitgliederAuf(
				handelnder(locals.benutzer),
				params.id,
				mitgliederAusFormular(daten),
				text(daten.get('ab'))
			);
			if (befund.gelungen.length === 0) {
				return fail(400, { fehler: { nachricht: aufnahmesatz(befund), feld: 'mitglied' } });
			}
			return { hinweis: aufnahmesatz(befund) };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	},

	/**
	 * Erfasst einen Eigentümer — **entweder** jemanden Neuen **oder** eine
	 * bereits erfasste Person.
	 *
	 * Gemeldet am 11.08.2026: «Beim Anlegen einer Person kann man entweder einen
	 * neuen erfassen oder man wählt einen bestehenden. So ist beides irgendwie
	 * vermischt.» Vorher stand beides nebeneinander im selben Formular — ein
	 * Namensfeld und daneben eine Auswahlliste, und wer beides ausfüllte, bekam
	 * die Zeile unter dem getippten Namen und die Klammer auf die gewählte
	 * Person. Jetzt entscheidet ein Schalter, welcher der beiden Wege gilt.
	 *
	 * Bei «bereits erfasst» wird kein Name getippt: Er kommt von der Person, und
	 * die Zeile entsteht über denselben Weg wie beim Zuordnen einer Einheit von
	 * der Personenseite aus (`parteiAusPerson`). Zwei Wege, die dieselbe Zeile
	 * verschieden anlegen, führten irgendwann zu zwei Zeilen für einen Menschen.
	 */
	/*
	 * kennung: mitberechtigterPersonId — dieselbe Lage wie `personId` darunter:
	 * `person` trägt keine `stweg_id`, und `parteiAusPerson` legt die Zeile unter
	 * `params.id` an. Eine Prüfung «Person gehört zur Gemeinschaft» wäre erfunden.
	 *
	 * kennung: personId — `person` trägt keine `stweg_id`. Eine Person gehört
	 * keiner Gemeinschaft, sondern hat in jeder eine Zeile; die Schranke ist der
	 * Betreiber, und die hält der Zeilenschutz. `eigentuemerzeileAusPerson` legt
	 * die Zeile unter `params.id` an.
	 *
	 * kennung: memberStwegId — die Gemeinschaft, der der Anteil gehört. Sie ist
	 * mit Absicht eine andere; die Datenbank verlangt sie beim selben Betreiber
	 * (`FOREIGN KEY (member_stweg_id, operator_id)`) und verbietet die eigene
	 * (`CHECK (member_stweg_id IS DISTINCT FROM stweg_id)`).
	 */
	anlegen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const art = (text(daten.get('kind')) || 'natural') as PartyKind;
		/*
		 * **«Wem gehört die Einheit?» statt eines Häkchens** (Auftraggeber, 27.08.2026).
		 *
		 * Das Formular schickt seit heute `eigentumsform` mit den zwei Werten
		 * `allein` und `gemeinschaftlich`. Gelesen wird wörtlich und nicht mehr
		 * über `jaNein()`: Ein Kästchen kannte nur «angekreuzt oder nicht», und
		 * sein Gegenteil hatte keinen Namen.
		 */
		const gemeinschaftlich = text(daten.get('eigentumsform')) === 'gemeinschaftlich';
		const felder = eigentuemerfelder(art, gemeinschaftlich);
		const bestehend = felder.personenklammer && text(daten.get('personwahl')) === 'bestehend';

		/*
		 * **Die Personenliste der gemeinschaftlichen Zeile** (Aufgabe 3).
		 *
		 * Die Zeilen werden **vor** dem `try` eingesammelt, damit sie im
		 * Fehlerfall zurückreisen können: Wer drei Personen erfasst hat und an
		 * der letzten scheitert, tippt sonst alles noch einmal.
		 */
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
		const vertreterIndex = kennungen.indexOf(text(daten.get('vertreter')));

		try {
			/*
			 * **Die Einheit wird geprüft, BEVOR irgendetwas angelegt ist**
			 * (26.08.2026, aus dem Code-Review der Sicherheitsbehebung).
			 *
			 * Die erste Fassung prüfte sie erst unmittelbar vor `ordneEigentumZu` —
			 * also nachdem `erstelleEigentuemer` und die Personenklammer ihre
			 * Transaktionen bereits abgeschlossen hatten. Eine Absage fiel dann in
			 * den äusseren `catch`, der die getippten Werte zurückschickt: Das
			 * Formular stand wieder gefüllt da, und ein zweiter Klick legte die
			 * Zeile ein zweites Mal an. Genau die Falle, gegen die im Zweig der
			 * gemeinschaftlichen Zeile ein eigener innerer `catch` steht.
			 *
			 * Hier vorn kostet sie nichts und kann nichts halb Angelegtes
			 * hinterlassen.
			 */
			const einheitVorab = text(daten.get('gleichEinheit'));
			if (einheitVorab) {
				await pruefeEinheitGehoert(locals.benutzer.operatorId, params.id, einheitVorab);
			}

			if (gemeinschaftlich && art !== 'gemeinschaft') {
				/*
				 * **Gleich viele Kennungen wie Namen.** Die Kennung verbindet Name,
				 * Anschrift und den gewählten Vertreter derselben Zeile; passen die
				 * Längen nicht zusammen, wäre jede Zuordnung geraten. Erreichbar ist
				 * das nur von aussen — dann ist eine Absage die richtige Antwort.
				 */
				if (!roh.gleichlang) {
					return fail(400, {
						fehler: {
							nachricht: 'Die Angaben zu den Personen passen nicht zusammen. Laden Sie die Seite neu.',
							feld: 'mitberechtigte'
						},
						quelle: 'anlegen',
						beteiligte,
						vertreterIndex,
						gemeinschaftlich,
						art
					});
				}

				const ohneWahl = beteiligte.findIndex((b) => b.wahl === 'bestehend' && !b.personId);
				if (ohneWahl >= 0) {
					return fail(400, {
						fehler: {
							nachricht: `${ohneWahl + 1}. Person: Wählen Sie die Person aus der Liste.`,
							feld: 'mitberechtigte'
						},
						quelle: 'anlegen',
						beteiligte,
						vertreterIndex,
						gemeinschaftlich,
						art
					});
				}

				const zeile = await erstelleGemeinschaftlicheZeile(handelnder(locals.benutzer), {
					stwegId: params.id,
					kind: art,
					personen: beteiligte.map(alsGespeichert),
					vertreterIndex
				});

				// Die Einheit gehört der Hülle, nicht einer der Personen: Sie hält
				// die Einheit und damit die eine Stimme (ZGB Art. 712o Abs. 1).
				const gleich = text(daten.get('gleichEinheit'));
				if (gleich) {
					try {
						// Dass die Einheit zu dieser Gemeinschaft gehört, steht oben —
						// vor dem ersten Schreiben.
						await ordneEigentumZu(
							handelnder(locals.benutzer),
							gleich,
							zeile.huelle,
							text(daten.get('gleichAb')) || heute()
						);
					} catch (fehler) {
						/*
						 * **Der Teilerfolg muss sichtbar bleiben** (26.08.2026, aus dem
						 * Code-Review). `erstelleGemeinschaftlicheZeile` hat seine
						 * Transaktion bereits abgeschlossen — Hülle und Personen stehen.
						 * Fiele die Meldung in den äusseren `catch`, käme die ausgefüllte
						 * Personenliste zurück, und ein zweiter Klick auf «Hinzufügen»
						 * legte alles ein zweites Mal an.
						 *
						 * Ohne `beteiligte` und `gemeinschaftlich`: Die Maske steht danach
						 * leer, und die Meldung sagt, was schon da ist.
						 */
						if (fehler instanceof FachlicherFehler) {
							return fail(400, {
								fehler: {
									nachricht:
										`Die Zeile «${zeile.name}» ist angelegt — die Einheit aber nicht ` +
										`zugeordnet: ${fehler.message}`,
									feld: 'gleichEinheit'
								}
							});
						}
						throw fehler;
					}
					return { angelegt: true, zugeordnet: true };
				}
				return { angelegt: true };
			}

			if (bestehend) {
				const personId = text(daten.get('personId'));
				if (!personId) {
					return fail(400, {
						fehler: { nachricht: 'Wählen Sie die Person aus der Liste.', feld: 'personId' },
						werte: Object.fromEntries(daten)
					});
				}
				const zeile = await eigentuemerzeileAusPerson(
					handelnder(locals.benutzer),
					personId,
					params.id
				);

				/*
				 * **Die Zuordnung gleich mit, auch für eine bestehende Person**
				 * (Auftraggeber, 27.08.2026).
				 *
				 * Bis hierher stand das Feld «Einheit gleich zuordnen» nur im Zweig
				 * «jemanden, den es hier noch nicht gibt». Für die Ungleichheit gab es
				 * weder im Code noch im Kommentar einen Grund — und sie traf den Fall,
				 * in dem der kurze Weg am meisten wert ist: Wer eine Person aus einer
				 * anderen Gemeinschaft übernimmt, weiss in aller Regel schon, welche
				 * Einheit ihr hier gehört.
				 *
				 * Der eigene `catch` steht aus demselben Grund wie im Zweig der
				 * gemeinschaftlichen Zeile: `eigentuemerzeileAusPerson` hat seine
				 * Transaktion abgeschlossen, die Zeile steht. Fiele die Absage in den
				 * äusseren `catch`, käme das Formular gefüllt zurück, und ein zweiter
				 * Klick liefe erneut durch.
				 */
				const gleichFuerBestehende = text(daten.get('gleichEinheit'));
				if (gleichFuerBestehende) {
					try {
						// Geprüft ist sie oben, vor dem ersten Schreiben.
						await ordneEigentumZu(
							handelnder(locals.benutzer),
							gleichFuerBestehende,
							zeile.id,
							text(daten.get('gleichAb')) || heute()
						);
					} catch (fehler) {
						if (fehler instanceof FachlicherFehler) {
							return fail(400, {
								fehler: {
									nachricht:
										`Die Zeile steht ${zeile.neu ? 'jetzt' : 'bereits'} in dieser ` +
										`Gemeinschaft, die Einheit ist aber nicht zugeordnet: ${fehler.message}`,
									feld: 'gleichEinheit'
								}
							});
						}
						throw fehler;
					}
					// Eine schon vorhandene Zeile darf nicht als «angelegt» gemeldet
					// werden; die Zuordnung ist trotzdem geschehen und gehört in den Satz.
					return zeile.neu
						? { angelegt: true, zugeordnet: true }
						: {
								hinweis:
									'Diese Person wird in dieser Gemeinschaft bereits geführt. Die Einheit ist ihrer bestehenden Zeile zugeordnet.'
							};
				}

				// Eine vorhandene Zeile ist kein Fehler, aber auch kein Erfolg: Wer sie
				// stillschweigend als «angelegt» meldete, suchte sie nachher in der
				// Tabelle und fände sie dort schon lange stehen.
				return zeile.neu ? { angelegt: true } : { schonVorhanden: true };
			}

			const neu = await erstelleEigentuemer(handelnder(locals.benutzer), {
				stwegId: params.id,
				kind: art,
				displayName: text(daten.get('displayName')),
				representativeName: text(daten.get('representativeName')) || null,
				isCommunity: gemeinschaftlich,
				// Story 7.1: Der Anteil gehört einer Gemeinschaft, nicht einem Menschen.
				memberStwegId: text(daten.get('memberStwegId')) || null,
				email: text(daten.get('email')) || undefined,
				phone: text(daten.get('phone')) || undefined,
				address: text(daten.get('address')) || undefined
			});

			// Die Personenklammer gleich mit: Wer sie erst später setzt, setzt sie
			// meist gar nicht — und dann steht dieselbe Person am Versammlungstag
			// in sieben Listen, ohne dass die Anwendung es weiss.
			if (felder.personenklammer) {
				const person = await erstellePerson(handelnder(locals.benutzer), {
					art: art === 'legal' ? 'legal' : 'natural',
					name: text(daten.get('displayName')),
					email: text(daten.get('email')) || null,
					telefon: text(daten.get('phone')) || null,
					adresse: text(daten.get('address')) || null
				});
				await verknuepfePartei(handelnder(locals.benutzer), neu.id, person.id);
			}
			/*
			 * **Die Zuordnung gleich mit, wenn eine Einheit gewählt ist**
			 * (23.08.2026, Prüflauf II, A-30).
			 *
			 * Vorher waren es zwei Formulare: erfassen, absenden, hinunterscrollen,
			 * Einheit wählen, Eigentümer wählen, absenden. Gemessen für Haus A:
			 * achtzig Handgriffe für vierzehn Parteien und achtzig für sechzehn
			 * Zuordnungen; für die ganze Anlage 243. Wer gerade einen Eigentümer
			 * anlegt, weiss in aller Regel schon, welche Einheit ihm gehört.
			 *
			 * Das Feld bleibt freiwillig: Beim Aufbau aus einer Liste erfasst man
			 * oft erst alle Namen und ordnet danach zu. Und es steht auch dann noch
			 * unten, wo es immer stand — eine Zuordnung ohne neuen Eigentümer
			 * braucht es weiterhin.
			 */
			const gleichZuordnen = text(daten.get('gleichEinheit'));
			if (gleichZuordnen) {
				try {
					// Geprüft ist sie oben, vor dem ersten Schreiben.
					await ordneEigentumZu(
						handelnder(locals.benutzer),
						gleichZuordnen,
						neu.id,
						text(daten.get('gleichAb')) || heute()
					);
				} catch (fehler) {
					/*
					 * **Der Teilerfolg muss sichtbar bleiben** (27.08.2026, aus dem
					 * Code-Review; die beiden Nachbarzweige haben denselben `catch`
					 * schon länger). `erstelleEigentuemer` und die Personenklammer
					 * haben ihre Transaktionen abgeschlossen — die Zeile steht. Fiele
					 * die Absage in den äusseren `catch`, käme das Formular über
					 * `werte` **gefüllt** zurück; wer das Datum berichtigt und erneut
					 * klickt, legte die Zeile ein zweites Mal an. Genau die
					 * Karteileichen aus Prüflauf II.
					 *
					 * Erreichbar etwa mit einem «gültig ab», das vor einer früheren
					 * Zuordnung derselben Einheit liegt: `ordneEigentumZu` sagt dann
					 * mit `luecke` ab.
					 */
					if (fehler instanceof FachlicherFehler) {
						return fail(400, {
							fehler: {
								nachricht:
									`Die Zeile «${neu.displayName}» ist angelegt — die Einheit aber nicht ` +
									`zugeordnet: ${fehler.message}`,
								feld: 'gleichEinheit'
							}
						});
					}
					throw fehler;
				}
				return { angelegt: true, zugeordnet: true };
			}
			return { angelegt: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: Object.fromEntries(daten),
					quelle: 'anlegen',
					beteiligte,
					vertreterIndex,
					/*
					 * **Haken und Art reisen mit** (26.08.2026, im Durchstich
					 * gemessen). Ohne sie stand die Maske nach einer Absage wieder
					 * auf «einzelne Person»: Die Personenliste war weg, und die
					 * getippten Namen mit ihr — die Absage nahm mehr weg, als sie
					 * beanstandete.
					 */
					gemeinschaftlich,
					art
				});
			}
			throw fehler;
		}
	},

	zuordnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();

		const unitId = text(daten.get('unitId'));
		const partyId = text(daten.get('partyId'));
		const ab = text(daten.get('ab'));
		const bestaetigt = jaNein(daten.get('bestaetigt'));
		/*
		 * **Zwei Rückfragen, zwei Bestätigungen** (Code-Review 06.09.2026).
		 *
		 * Diese Aktion fragt aus zwei ganz verschiedenen Gründen zurück: ob die
		 * Zuordnung an ein Mitglied einer Gemeinschaft gemeint war, und was sie
		 * an bestehenden Zuordnungen verdrängt. Ein gemeinsames `bestaetigt`
		 * hiesse: Wer die erste Frage bejaht, überspringt die zweite ungesehen —
		 * und das ist der häufigste Fall überhaupt, weil die Gemeinschaft die
		 * Einheit meist schon hält. Die Verdrängung geschähe dann stumm.
		 */
		const gemeinschaftBestaetigt = jaNein(daten.get('gemeinschaftBestaetigt'));

		if (!unitId || !partyId || !ab) {
			return fail(400, { fehler: { nachricht: 'Einheit, Eigentümer und Stichtag sind nötig.' } });
		}

		try {
			/*
			 * **Beide Kennungen müssen zu DIESER Gemeinschaft gehören** (26.08.2026,
			 * aus der Sicherheitsprüfung).
			 *
			 * Der zusammengesetzte Fremdschlüssel auf `unit_ownership` hält zwar
			 * fest, dass Einheit und Partei zueinander gehören — nicht aber, dass
			 * sie zu der Gemeinschaft gehören, deren Seite den Knopf trägt. Ein Paar
			 * aus der Nachbargemeinschaft ginge durch, und die Vorschau darüber
			 * zählte Zuordnungen auf, die auf dieser Seite gar nicht stehen.
			 *
			 * **Vor `planeEigentumszuordnung`**, nicht danach: Die Vorschau liest die
			 * Eigentumsgeschichte der Einheit und gäbe sonst preis, wer in der
			 * anderen Gemeinschaft was hält.
			 */
			await pruefeEinheitGehoert(locals.benutzer.operatorId, params.id, unitId);
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, partyId);

			/*
			 * **Gehört die gewählte Partei zu einer Gemeinschaft?**
			 * (Bedienbarkeitsprüfung 05.09.2026, Befund 16, Produktentscheid
			 * 06.09.2026.)
			 *
			 * Bei einem Ehepaar bietet die Auswahl drei Einträge an: die
			 * Gemeinschaft «Beat und Corinne» und die beiden einzeln. Alle drei
			 * sind zulässig — jemand kann daneben eine eigene Einheit besitzen —,
			 * und deshalb wird hier nicht gesperrt, sondern gefragt. Wer die
			 * einzelne Person wählte, zerlegte sonst die gemeinsame Stimme, ohne
			 * dass ein Wort dazu fiel.
			 *
			 * **Vor dem Verdrängungsplan**, weil die Frage eine andere ist: Dort
			 * geht es darum, was die Zuordnung kostet, hier darum, ob sie
			 * überhaupt gemeint war.
			 */
			const huellen = await holeHuellenVonMitglied(
				locals.benutzer.operatorId,
				params.id,
				partyId
			);
			if (!gemeinschaftBestaetigt && huellen.length > 0) {
				return fail(409, {
					rueckfrage: {
						unitId,
						partyId,
						ab,
						verdraengt: [],
						gekappt: [],
						fremdeBetroffen: false,
						teilEinerGemeinschaft: huellen,
						/*
						 * **Was schon zugesagt ist, reist mit.** Sonst löscht die zweite
						 * Antwort die erste: Das Fenster sendet nur die Bestätigung zu
						 * der Frage, die es gerade stellt, und der Server prüft bei jeder
						 * Anfrage beide. Wer erst die Gemeinschaftsfrage bejaht und dann
						 * die Verdrängungsfrage, bekäme wieder die erste — endlos, ohne
						 * dass die Zuordnung je zustande käme (Sicherheitsdurchgang
						 * 06.09.2026, funktionaler Befund).
						 */
						schonBestaetigt: bestaetigt,
						schonGemeinschaftBestaetigt: gemeinschaftBestaetigt
					}
				});
			}

			// Verdrängt die Zuordnung etwas, wird zuerst gezeigt, was — nachher liesse
			// sich der entfernte Datensatz nicht mehr sehen, nur noch der Verlauf.
			const plan = await planeEigentumszuordnung(locals.benutzer.operatorId, unitId, partyId, ab);
			if (!bestaetigt && plan.zuEntfernen.length > 0) {
				// Namensnachschlag fuer die Rueckfrage — vollstaendig, sonst steht
				// dort eine Kennung statt eines Namens.
				const parteien = await holeEigentuemer(locals.benutzer.operatorId, params.id, 'alle');
				const namen = new Map(parteien.map((p) => [p.id, p.displayName]));
				return fail(409, {
					rueckfrage: {
						unitId,
						partyId,
						ab,
						verdraengt: plan.zuEntfernen.map((e) => namen.get(e.partyId) ?? e.partyId),
						gekappt: plan.zuBeenden.map((b) => namen.get(b.partyId) ?? b.partyId),
						/*
						 * **Trifft es eine andere Partei oder dieselbe?** (26.08.2026, aus
						 * dem Code-Review.) Wer nur den Stichtag derselben Zuordnung
						 * berichtigt, verdrängt sich selbst — dort wäre der Satz «sollen
						 * beide zusammen Eigentümer sein» sinnlos. Die Unterscheidung ist
						 * die Partei, nicht die Zahl der betroffenen Zeilen.
						 */
						fremdeBetroffen:
							plan.zuEntfernen.some((e) => e.partyId !== partyId) ||
							plan.zuBeenden.some((b) => b.partyId !== partyId),
						/*
						 * Leer, aber vorhanden: Beide Rückfragen tragen dieselbe Gestalt,
						 * sonst muss die Seite bei jedem Zugriff prüfen, welche der
						 * beiden sie gerade vor sich hat.
						 */
						teilEinerGemeinschaft: [] as string[],
						schonBestaetigt: bestaetigt,
						schonGemeinschaftBestaetigt: gemeinschaftBestaetigt
					}
				});
			}

			await ordneEigentumZu(handelnder(locals.benutzer), unitId, partyId, ab);
			/*
			 * **Die Meldung nennt, was geschehen ist** (Prüflauf I, A-25). «Einheit
			 * zugeordnet.» sagt nicht, welche und wem; bei fünf Zuordnungen
			 * hintereinander weiss man nach der dritten nicht mehr, ob die vierte
			 * durchging.
			 */
			const [einheiten, parteien] = await Promise.all([
				holeEinheiten(locals.benutzer.operatorId, params.id),
				holeEigentuemer(locals.benutzer.operatorId, params.id, 'alle')
			]);
			const label = einheiten.find((e) => e.id === unitId)?.label;
			const wem = parteien.find((p) => p.id === partyId)?.displayName;
			return {
				zugeordnet: label && wem ? `«${label}» an ${wem}` : true
			};
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			// Der Überschneidungsschutz der Datenbank meldet sich hier. Seine Meldung
			// ist für die Sitzungsleitung unbrauchbar, deshalb übersetzt.
			const meldung = String((fehler as Error).message);
			if (meldung.includes('unit_ownership_keine_ueberschneidung')) {
				return fail(400, {
					fehler: {
						nachricht:
							'Zu diesem Zeitpunkt hat die Einheit bereits einen anderen Eigentümer. ' +
							'Gemeinsames Eigentum wird über eine Partei mit benanntem Vertreter abgebildet, nicht über zwei Zuordnungen.'
					}
				});
			}
			throw fehler;
		}
	}
,

	/** Story 7.2: Wer die eine Stimme einer Mitgliedsgemeinschaft abgibt. */
	vertreterBezeichnen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		try {
			// Die Kennung kommt aus einem verborgenen Feld, also von aussen
			// (26.08.2026, aus der Sicherheitsprüfung).
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			await bezeichneVertreter(handelnder(locals.benutzer), {
				parteiId,
				personName: text(daten.get('personName')),
				ab: text(daten.get('ab')),
				grundlage: text(daten.get('grundlage')) || null,
				bemerkung: text(daten.get('bemerkung')) || null
			});
			return { vertreterBezeichnet: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, {
					fehler: { nachricht: fehler.message, feld: fehler.feld },
					werte: Object.fromEntries(daten)
				});
			}
			throw fehler;
		}
	},

	vertretungBeenden: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		try {
			/*
			 * **`id` ist hier eine Vertretung**, keine Partei (26.08.2026, aus der
			 * Sicherheitsprüfung). `representation` führt eine eigene `stweg_id`;
			 * gefragt wird deshalb dort.
			 */
			await pruefeVertretungGehoert(
				locals.benutzer.operatorId,
				params.id,
				text(daten.get('id'))
			);
			await beendeVertretung(
				handelnder(locals.benutzer),
				text(daten.get('id')),
				text(daten.get('bis'))
			);
			return { vertretungBeendet: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
,

	/*
	 * kennung: personId — dieselbe Lage wie beim Berichtigen: `person` trägt
	 * keine `stweg_id`. Geprüft wird die Zeile; dass dieselbe Person in
	 * derselben Gemeinschaft nicht zweimal hängt, prüft `schreibeKlammer`.
	 */
	/** Eine bestehende Zeile nachträglich mit einer Person verknüpfen. */
	verknuepfen: async ({ request, locals, params }) => {
		if (!locals.benutzer) error(401, 'Nicht angemeldet');
		const daten = await request.formData();
		const parteiId = text(daten.get('parteiId'));
		try {
			/*
			 * **Geprüft wird die Zeile, nicht die Person** (26.08.2026, aus der
			 * Sicherheitsprüfung). `person` trägt keine `stweg_id` — eine Person
			 * gehört keiner Gemeinschaft, sondern hat in jeder eine Zeile. Eine
			 * Prüfung «Person gehört zur Gemeinschaft» wäre erfunden und sperrte
			 * genau den Fall, für den es diesen Weg gibt. Dass dieselbe Person in
			 * derselben Gemeinschaft nicht zweimal hängt, prüft `schreibeKlammer`.
			 */
			await pruefeParteiGehoert(locals.benutzer.operatorId, params.id, parteiId);
			await verknuepfePartei(
				handelnder(locals.benutzer),
				parteiId,
				text(daten.get('personId')) || null
			);
			return { verknuepft: true };
		} catch (fehler) {
			if (fehler instanceof FachlicherFehler) {
				return fail(400, { fehler: { nachricht: fehler.message, feld: fehler.feld } });
			}
			throw fehler;
		}
	}
};
