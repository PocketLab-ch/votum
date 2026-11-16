/**
 * Übernahme von Stammdaten aus einer CSV (Story 1.9).
 *
 * Die Vorschau kommt vollständig aus dem Kern; hier wird nur der Bestand geholt
 * und, nach Bestätigung, geschrieben. Beides in einer Transaktion: Eine halb
 * übernommene Datei wäre schlimmer als eine gar nicht übernommene, weil danach
 * niemand mehr wüsste, welche Zeilen gelten.
 */
import { alsBetreiber } from './db';
import { pruefeHakenUmlegbar, schreibeGemeinschaftlicheZeile } from './eigentuemer';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	erzeugeVorschau,
	erzeugeVorschauAus,
	type Bestand,
	type Uebernahmevorschau
} from '$lib/domain/uebernahme';
import type { CsvErgebnis } from '$lib/domain/csv';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { pruefeEigentuemer } from '$lib/domain/eigentuemer';
import { pruefeEinheit } from '$lib/domain/einheiten';
import { pruefeNutzniessung } from '$lib/domain/nutzniessung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { planeZuordnung } from '$lib/domain/historie';
import { kalendertag } from '$lib/domain/datum';
import type { Id } from '$lib/domain/types';

/**
 * Fremdkennung aus der Datei.
 *
 * Sie steht in einer eigenen Spalte, damit eine zweite Übernahme dieselben
 * Datensätze wiederfindet und nicht Kopien anlegt. Ohne sie wäre jede erneute
 * Übernahme eine Verdoppelung.
 */
const KENNUNG_SPALTE = 'import_ref';

/**
 * Der Bestand, gegen den die Datei verglichen wird.
 *
 * **Mit Stichtag** (01.09.2026): Wer die Einheit hält, ist eine Frage an einen
 * Tag — dieselbe, die die ganze Anwendung stellt. Ohne ihn liesse sich ein
 * Eigentümerwechsel nicht erkennen, und genau das war der Fehler: Eine Datei,
 * die nur den Eigentümer wechselt, galt als «unverändert».
 */
async function holeBestand(operatorId: Id, stwegId: Id, stichtag: string): Promise<Bestand> {
	return alsBetreiber(operatorId, async (tx) => {
		const parteien = await tx<
			{
				import_ref: string | null;
				display_name: string;
				kind: 'natural' | 'legal';
				is_community: boolean;
				representative_name: string | null;
				authentik_subject: string | null;
				vertreter_gesetzt: boolean;
				mitberechtigte: string[];
			}[]
		>`
			SELECT p.import_ref, p.display_name, p.kind, p.is_community, p.representative_name,
			       p.authentik_subject,
			       (p.representative_party_id IS NOT NULL) AS vertreter_gesetzt,
			       -- Die Namen der Mitberechtigten, damit die Vorschau eine Abweichung
			       -- melden kann, statt sie stillschweigend zu übergehen (Aufgabe 6).
			       COALESCE(
			           (SELECT array_agg(mp.display_name ORDER BY mp.display_name)
			              FROM party_member m
			              JOIN party mp ON mp.id = m.mitglied_party_id
			             WHERE m.huelle_party_id = p.id),
			           ARRAY[]::text[]
			       ) AS mitberechtigte
			FROM party p WHERE p.stweg_id = ${stwegId} AND p.import_ref IS NOT NULL
		`;

		const einheiten = await tx<
			{
				import_ref: string | null;
				label: string;
				kind: 'unit' | 'parking';
				counts_as_head: boolean;
				quotas: Record<string, number> | null;
				hat_nutzniessung: boolean;
				eigentuemer_ref: string | null;
			}[]
		>`
			SELECT u.import_ref, u.label, u.kind, u.counts_as_head,
			       (SELECT jsonb_object_agg(qk.key, uq.value)
			        FROM unit_quota uq JOIN quota_kind qk ON qk.id = uq.quota_kind_id
			        WHERE uq.unit_id = u.id) AS quotas,
			       EXISTS (SELECT 1 FROM usufruct n WHERE n.unit_id = u.id) AS hat_nutzniessung,
			       -- Wer die Einheit AM STICHTAG hält, als Fremdkennung. Ohne sie
			       -- kann der Vergleich einen Eigentuemerwechsel nicht sehen.
			       (SELECT p.import_ref
			          FROM unit_ownership o JOIN party p ON p.id = o.party_id
			         WHERE o.unit_id = u.id
			           AND o.valid_from <= ${stichtag}
			           AND (o.valid_to IS NULL OR o.valid_to > ${stichtag})) AS eigentuemer_ref
			FROM unit u WHERE u.stweg_id = ${stwegId} AND u.import_ref IS NOT NULL
		`;

		const arten = await tx<{ key: string; denominator: number; is_primary: boolean }[]>`
			SELECT key, denominator, is_primary FROM quota_kind WHERE stweg_id = ${stwegId}
		`;

		return {
			eigentuemer: parteien.map((p) => ({
				ref: p.import_ref!,
				displayName: p.display_name,
				kind: p.kind,
				isCommunity: p.is_community,
				representativeName: p.representative_name,
				authentikSubject: p.authentik_subject,
				mitberechtigte: p.mitberechtigte,
				vertreterGesetzt: p.vertreter_gesetzt
			})),
			einheiten: einheiten.map((e) => ({
				ref: e.import_ref!,
				label: e.label,
				kind: e.kind,
				quotas: e.quotas ?? {},
				countsAsHead: e.counts_as_head,
				hatNutzniessung: e.hat_nutzniessung,
				eigentuemerRef: e.eigentuemer_ref
			})),
			quotenarten: arten.map((a) => ({
				key: a.key,
				denominator: a.denominator,
				isPrimary: a.is_primary
			}))
		};
	});
}

/**
 * @param stichtag Auf welchen Tag der Eigentumsstand gelesen wird. Die
 *   Vorschau nach der Dateiwahl kennt ihn noch nicht — dort gilt der heutige,
 *   und die Seite nennt ihn. Beim Ausführen wird die Vorschau ohnehin neu
 *   gerechnet, dann mit dem gewählten Tag.
 */
export async function vorschau(
	operatorId: Id,
	stwegId: Id,
	inhalt: string,
	stichtag: string
): Promise<Uebernahmevorschau> {
	return erzeugeVorschau(inhalt, await holeBestand(operatorId, stwegId, stichtag));
}

/** Wie `vorschau`, aber für eine schon gelesene Tabelle (Excel-Datei). */
export async function vorschauAusTabelle(
	operatorId: Id,
	stwegId: Id,
	tabelle: CsvErgebnis,
	stichtag: string,
	/** Kennungen aus einer Eigentümerdatei derselben Auswahl — siehe Kern. */
	kommendeKennungen: readonly string[] = []
): Promise<Uebernahmevorschau> {
	return erzeugeVorschauAus(
		tabelle,
		await holeBestand(operatorId, stwegId, stichtag),
		kommendeKennungen
	);
}

/**
 * Welche Verteiler diese Gemeinschaft führt.
 *
 * Für die Übernahme aus immotool (FR-7): Ein Verteiler, den es hier nicht gibt,
 * darf gar nicht erst in die Datei geschrieben werden, sonst fiele jede Zeile
 * an dieser einen Spalte durch.
 */
export async function quotenschluessel(operatorId: Id, stwegId: Id): Promise<string[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const arten = await tx<{ key: string }[]>`
			SELECT key FROM quota_kind WHERE stweg_id = ${stwegId} ORDER BY sort_order, key
		`;
		return arten.map((a) => a.key);
	});
}

export interface Uebernahmeergebnis {
	angelegt: number;
	geaendert: number;
	uebersprungen: number;
	/**
	 * Wie viele der berührten Eigentümerzeilen im Archiv liegen.
	 *
	 * Sie bleiben dort — die Übernahme ändert nur ihre Angaben. Gesagt werden
	 * muss es trotzdem: Sonst wundert sich jemand, warum eine Zeile aus der
	 * Datei nirgends auftaucht.
	 */
	imArchiv: number;
}

/**
 * Führt eine zuvor gezeigte Vorschau aus.
 *
 * Fehlerhafte Zeilen werden übersprungen, nicht abgebrochen — die Story verlangt
 * ausdrücklich, dass die übrigen übernehmbar bleiben. Was übersprungen wurde,
 * steht im Ergebnis und im Verlauf.
 */
export async function fuehreUebernahmeAus(
	handelnder: Handelnder & { operatorId: string },
	stwegId: Id,
	inhalt: string | CsvErgebnis,
	stichtag: string
): Promise<Uebernahmeergebnis> {
	// Zeichenkette oder gelesene Tabelle — beides führt zur selben Vorschau, und
	// alles danach ist für CSV und Excel dasselbe.
	const plan =
		typeof inhalt === 'string'
			? await vorschau(handelnder.operatorId, stwegId, inhalt, stichtag)
			: await vorschauAusTabelle(handelnder.operatorId, stwegId, inhalt, stichtag);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Gemeinschaft vorweg unter dem eigenen Betreiber suchen**
		 * (Auftrag 2f, 29.10.2026). Ohne Treffer sieht die Vorschau oben nur einen
		 * leeren Bestand, und bei leerem Plan liefe kein INSERT, das am
		 * Fremdschlüssel scheitern könnte; der Verlauf hielte trotzdem
		 * `uebernahmeBestaetigt` über die Gemeinschaft von B fest. Bisher wies
		 * erst der Wächter aus Migration 177 das ab.
		 *
		 * **Hier und nicht vor der Vorschau:** in derselben Transaktion wie das
		 * Schreiben, also gilt die Antwort für genau die Zeilen, die danach
		 * entstehen. Die Vorschau davor liest nur, und unter dem Zeilenschutz
		 * nichts von B.
		 */
		const [gemeinschaft] = await tx`SELECT 1 FROM stweg WHERE id = ${stwegId}`;
		if (!gemeinschaft) throw fremdeGemeinschaft('stwegId');

		let angelegt = 0;
		let geaendert = 0;
		let imArchiv = 0;

		if (plan.art === 'eigentuemer') {
			for (const v of plan.eigentuemer) {
				if (!v.satz || v.vorgang === 'fehlerhaft' || v.vorgang === 'unveraendert') continue;

				// Durch dieselbe Prüfung wie beim Formular: Eine Datei darf nichts
				// hineinbringen, was von Hand abgewiesen würde.
				const geprueft = pruefeEigentuemer({
					stwegId,
					kind: v.satz.kind,
					displayName: v.satz.displayName,
					representativeName: v.satz.representativeName,
					isCommunity: v.satz.isCommunity
				});

				/*
				 * **Melden, nicht heimlich hervorholen** (25.08.2026, vierte
				 * Reviewrunde).
				 *
				 * Die Übernahme schreibt `unit_ownership` direkt und nicht über
				 * `ordneEigentumZu`; die Schranke «keine Einheit an eine archivierte
				 * Zeile» greift hier also nicht. Die erste Fassung leerte deshalb
				 * `archived_at` gleich mit — und lag doppelt daneben: Sie las den
				 * Vorzustand aus dem `RETURNING` des Upserts, das ihn gerade
				 * überschrieben hatte (also immer «nein»), und sie hätte jedes
				 * Archivieren durch die nächste Übernahme wieder aufgehoben. Eine
				 * Eigentümerin, die ausgezogen ist, steht in der Quelldatei oft noch
				 * monatelang.
				 *
				 * Jetzt bleibt das Archiv, wie es ist, und die Übernahme sagt, was
				 * sie angefasst hat. Wer die Zeile zurückwill, holt sie selbst
				 * hervor — eine Handlung, die im Verlauf steht.
				 */
				const [vorher] = await tx<
					{ id: string; display_name: string; is_community: boolean; archived_at: Date | null }[]
				>`
					SELECT id, display_name, is_community, archived_at FROM party
					 WHERE stweg_id = ${stwegId} AND import_ref = ${v.satz.ref}
				`;

				/*
				 * **Eine neue Zeile mit mehreren Personen wird eine Hülle**
				 * (27.08.2026, Aufgabe 6).
				 *
				 * Bis hierher entstand aus «Anna Muster | Beat Muster» **eine**
				 * Zeile, in der die beiden nur noch ein Stück Text waren. Nach
				 * Wermelinger, Rz. 50 ad Art. 712n, ist aber jeder Mitberechtigte einzeln anzuschreiben, und
				 * dafür braucht er eine eigene Zeile mit eigener Adresse. Also
				 * derselbe Weg wie in der Erfassungsmaske: eine Hülle, die die
				 * Einheit und damit die eine Stimme hält (Art. 712o Abs. 1), und
				 * darunter die Personen.
				 *
				 * **In derselben Transaktion**, deshalb
				 * `schreibeGemeinschaftlicheZeile` und nicht
				 * `erstelleGemeinschaftlicheZeile`: Letztere öffnete eine zweite, und
				 * die Hülle bliebe stehen, wenn die Übernahme danach abbricht.
				 *
				 * **Nur für neue Zeilen — und `!vorher` ist die einzige Schranke davor**
				 * (27.08.2026 berichtigt, aus dem Code-Review). Steht die Zeile
				 * schon, geht es unten den gewohnten Weg über den Upsert.
				 * Mitberechtigte nachträglich anzulegen oder wegzunehmen ist
				 * ausdrücklich nicht Sache der Übernahme; weicht die Datei ab, sagt
				 * die Vorschau es als **Hinweis** und lässt die Zeile trotzdem
				 * durch. Wer diese Bedingung lockert, legt die Mitberechtigten bei
				 * jedem Lauf ein zweites Mal an.
				 *
				 * **Als eine angelegte Zeile gezählt**, nicht als `1 + n`. Gezählt
				 * werden die Zeilen der Datei; die Mitberechtigten sind ihr Inhalt.
				 */
				if (!vorher && geprueft.isCommunity && v.satz.personen.length >= 2) {
					await schreibeGemeinschaftlicheZeile(tx, handelnder, {
						stwegId,
						kind: geprueft.kind,
						bezeichnung: geprueft.displayName,
						// Die Datei führt zu den Personen nur den Namen. Adresse und
						// E-Mail tragen die Mitberechtigten erst, wenn sie jemand
						// nachträgt; bis dahin fällt der Empfängerkreis auf die Hülle
						// zurück (`empfaengerkreis`).
						personen: v.satz.personen.map((name) => ({
							name,
							email: null,
							adresse: null
						})),
						// Dass der Vertreter dazugehört, hat `pruefeEigentuemerZeile`
						// schon entschieden — hier kann `indexOf` nicht danebengreifen.
						vertreterIndex: v.satz.personen.indexOf(v.satz.representativeName ?? ''),
						importRef: v.satz.ref,
						authentikSubject: v.satz.authentikSubject
					});
					angelegt++;
					continue;
				}

				/*
				 * **Der Haken «Gemeinschaftliches Eigentum» am zweiten Schreibweg**
				 * (26.08.2026, aus dem Code-Review zu Aufgabe 2). Der Upsert unten
				 * setzt `is_community` auch auf bestehenden Zeilen, und die Quelldatei
				 * bestimmt ihn: Steht dort nur noch eine Person, kippt er auf `false`.
				 * Hängen an der Zeile Mitberechtigte, hält der Fremdschlüssel dagegen
				 * (23503) — und `uebersetzeSchranke` übersetzt ihn bewusst nicht. Die
				 * ganze Übernahme bräche dann mit einer rohen 500 ab, ohne zu sagen,
				 * an welcher Zeile es lag.
				 *
				 * Dieselbe Prüfung wie beim Speichern von Hand, damit beide Wege
				 * dieselbe Absage geben — sie nennt die Zeile beim Namen.
				 */
				if (vorher && vorher.is_community !== geprueft.isCommunity) {
					await pruefeHakenUmlegbar(tx, vorher.id, vorher.display_name, geprueft.isCommunity);
				}

				const [zeile] = await tx<{ id: string; angelegt: boolean }[]>`
					INSERT INTO party (stweg_id, operator_id, import_ref, kind, display_name,
					                   representative_name, is_community, authentik_subject)
					VALUES (${stwegId}, ${handelnder.operatorId}, ${v.satz.ref}, ${geprueft.kind},
					        ${geprueft.displayName}, ${geprueft.representativeName}, ${geprueft.isCommunity},
					        ${v.satz.authentikSubject})
					ON CONFLICT (stweg_id, import_ref) WHERE import_ref IS NOT NULL DO UPDATE
						SET kind = EXCLUDED.kind,
						    display_name = EXCLUDED.display_name,
						    /*
						     * **Steht ein Vertreterverweis, führt er den Namen**
						     * (27.08.2026, aus dem Code-Review zu Aufgabe 6). Dieselbe
						     * Regel wie in bearbeiteEigentuemer — hier fehlte sie.
						     *
						     * Eine Hülle mit Mitberechtigten trägt zwei Angaben über
						     * dieselbe Sache: den Verweis für die Anwendung und den
						     * Namen für die Urkunde. Die Datei führt oft nur die
						     * Personen und fällt für die Vertretung auf die
						     * erstgenannte zurück; immotool weiss davon gar nichts.
						     * Ohne diese Regel setzte die nächste Übernahme den
						     * gedruckten Namen zurück, während der Verweis auf die von
						     * Hand gewählte Person zeigt — Zugangskarte und
						     * Unterschriftenliste nennten dann jemand anderen als die
						     * Anwendung zählt (zugaenge.ts, ausgeuebtDurch).
						     */
						    representative_name = CASE
						        WHEN party.representative_party_id IS NOT NULL
						            THEN party.representative_name
						        ELSE EXCLUDED.representative_name
						    END,
						    is_community = EXCLUDED.is_community,
						    -- Setzen, nie entfernen: Eine Datei ohne die Spalte weiss von
						    -- der Kennung nichts und darf sie deshalb auch nicht wegnehmen.
						    -- Dieselbe Regel steht im Vergleich der Vorschau; stünde sie nur
						    -- dort, entfernte eine von Hand erzwungene Übernahme sie doch.
						    authentik_subject = COALESCE(EXCLUDED.authentik_subject,
						                                 party.authentik_subject)
					RETURNING id, (xmax = 0) AS angelegt
				`;

				if (zeile.angelegt) angelegt++;
				else geaendert++;
				// Zusätzlich, nicht anstelle: Eine archivierte Zeile ist auch
				// angelegt oder geändert worden.
				if (vorher?.archived_at) imArchiv++;
			}
		} else {
			const arten = await tx<{ id: string; key: string }[]>`
				SELECT id, key FROM quota_kind WHERE stweg_id = ${stwegId}
			`;
			const artNachSchluessel = new Map(arten.map((a) => [a.key, a.id]));

			for (const v of plan.einheiten) {
				if (!v.satz || v.vorgang === 'fehlerhaft' || v.vorgang === 'unveraendert') continue;

				pruefeEinheit(
					{
						stwegId,
						kind: v.satz.kind,
						label: v.satz.label,
						quotas: v.satz.quotas,
						countsAsHead: v.satz.countsAsHead
					},
					plan.quotensummen.map((q) => ({
						stwegId,
						key: q.key,
						name: q.key,
						denominator: q.soll,
						isPrimary: q.key === 'stamm',
						sortOrder: 0
					}))
				);

				const [einheit] = await tx<{ id: string; angelegt: boolean }[]>`
					INSERT INTO unit (stweg_id, operator_id, import_ref, kind, label, counts_as_head)
					VALUES (${stwegId}, ${handelnder.operatorId}, ${v.satz.ref}, ${v.satz.kind},
					        ${v.satz.label}, ${v.satz.countsAsHead})
					ON CONFLICT (stweg_id, import_ref) WHERE import_ref IS NOT NULL DO UPDATE
						SET kind = EXCLUDED.kind,
						    label = EXCLUDED.label,
						    counts_as_head = EXCLUDED.counts_as_head
					RETURNING id, (xmax = 0) AS angelegt
				`;

				const behalten = Object.keys(v.satz.quotas)
					.map((k) => artNachSchluessel.get(k))
					.filter((id): id is string => Boolean(id));

				await tx`
					DELETE FROM unit_quota
					WHERE unit_id = ${einheit.id} AND quota_kind_id <> ALL(${behalten}::uuid[])
				`;

				for (const [schluessel, wert] of Object.entries(v.satz.quotas)) {
					const artId = artNachSchluessel.get(schluessel);
					if (!artId) continue;
					await tx`
						INSERT INTO unit_quota (unit_id, quota_kind_id, stweg_id, operator_id, value)
						VALUES (${einheit.id}, ${artId}, ${stwegId}, ${handelnder.operatorId}, ${wert})
						ON CONFLICT (unit_id, quota_kind_id) DO UPDATE SET value = EXCLUDED.value
					`;
				}

				/*
				 * **Eigentum zuordnen — über dieselbe Rechnung wie die beiden anderen
				 * Wege** (01.09.2026).
				 *
				 * Hier stand bis dahin eine dritte Fassung: ein `UPDATE … SET
				 * valid_to = <stichtag>` über **alle** Zeilen mit offenem oder
				 * späterem Ende. Zwei Fehler steckten darin, beide gemessen:
				 *
				 * - Eine Zeile, die **am** Stichtag beginnt, bekam `valid_to =
				 *   valid_from` und verletzte die Schranke `valid_to > valid_from`.
				 *   Die ganze Übernahme brach ab, mit der Meldung «Diese Eingabe hat
				 *   die Datenbank abgewiesen, und die Anwendung hätte es vorher sagen
				 *   müssen» — bei vierzig Zeilen ist damit alles zurückgerollt, und
				 *   der Grund steht nur im Protokoll des Dienstes.
				 * - Eine Zeile, die **nach** dem Stichtag beginnt, wurde rückwärts
				 *   gekappt statt entfernt.
				 *
				 * `planeZuordnung` unterscheidet beides seit je (kappen, wenn sie
				 * früher begann; entfernen, wenn sie am Stichtag oder danach
				 * beginnt). Sie trägt den Eigentümerweg und den Personenweg; dass
				 * der Dateiweg daneben selbst rechnete, war der Grund, warum er als
				 * einziger falsch lag.
				 */
				const [partei] = await tx<{ id: string }[]>`
					SELECT id FROM party WHERE stweg_id = ${stwegId} AND import_ref = ${v.satz.ownerRef}
				`;
				if (partei) {
					const bestehende = (
						await tx<
							{ id: string; party_id: string; valid_from: Date | string; valid_to: Date | string | null }[]
						>`
							SELECT id, party_id, valid_from, valid_to
							  FROM unit_ownership WHERE unit_id = ${einheit.id}
						`
					).map((b) => ({
						id: b.id,
						partyId: b.party_id,
						validFrom: kalendertag(b.valid_from),
						validTo: b.valid_to ? kalendertag(b.valid_to) : null
					}));

					/*
					 * **Hält dieselbe Partei die Einheit am Stichtag schon, ist nichts zu
					 * tun** (01.09.2026, aus dem Code-Review — und dort ein Rückschritt
					 * gegen den alten Code).
					 *
					 * Die erste Fassung fragte den Plan: «nichts zu beenden, nichts zu
					 * entfernen». Das kann nie eintreten. Eine am Stichtag laufende Zeile
					 * überschneidet sich zwangsläufig mit `[stichtag, …)` und steht
					 * deshalb immer in einer der beiden Listen — der Wächter war tot.
					 *
					 * Was daraus folgte: Ändert die Datei nur die Bezeichnung oder eine
					 * Quote, gilt die Zeile als «geändert», und der Eigentümerblock lief
					 * mit. Er kappte die Zuordnung des **unveränderten** Eigentümers und
					 * legte eine neue mit demselben an — eine erfundene Handänderung auf
					 * sich selbst, sichtbar genau im neuen Zeitverlauf. Der alte Code tat
					 * hier nichts.
					 *
					 * Gefragt wird deshalb der Bestand, nicht der Plan.
					 */
					const laufend = bestehende.find(
						(b) => b.validFrom <= stichtag && (!b.validTo || b.validTo > stichtag)
					);
					if (laufend?.partyId !== partei.id) {
						/*
						 * **Bis zur nächsten bekannten Handänderung, nicht bis auf
						 * Weiteres** (01.09.2026, aus dem Code-Review).
						 *
						 * Ohne diese Grenze reichte die neue Zuordnung bis ins Unendliche
						 * und verdrängte damit eine bereits erfasste künftige
						 * Handänderung — stillschweigend, denn der Dateiweg hat keine
						 * Rückfrage, in der das stünde. Mit ihr wird nichts entfernt: Die
						 * neue Zeile endet, wo die nächste beginnt.
						 */
						const naechste = bestehende
							.filter((b) => b.validFrom > stichtag)
							.sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))[0];

						const zuordnungsplan = planeZuordnung(
							bestehende,
							partei.id,
							stichtag,
							naechste?.validFrom ?? null
						);

						for (const zu of zuordnungsplan.zuEntfernen) {
							/*
							 * **Der Inhalt der gelöschten Zeile geht in den Vermerk**
							 * (01.09.2026, aus dem Code-Review). Dieselbe Regel wie am
							 * Weg über `eigentuemer.ts`: Ein Verlaufseintrag, der nur
							 * «verdrängt» sagt, lässt Zeitraum und Notiz spurlos
							 * verschwinden — und hier trifft das eine ganze Datei auf
							 * einmal, ohne dass jemand die einzelne Zeile ansieht.
							 */
							const [weg] = await tx<
								{ valid_from: Date; valid_to: Date | null; note: string | null }[]
							>`
								DELETE FROM unit_ownership WHERE id = ${zu.id}
								RETURNING valid_from, valid_to, note
							`;
							await schreibeVerlauf(
								tx,
								handelnder,
								ereignis(
									EREIGNISARTEN.eigentumBeendet,
									{ art: 'unit', id: einheit.id },
									{
										einheit: v.satz.label,
										bisherigePartei: zu.partyId,
										verdraengtDurchKorrektur: true,
										per: stichtag,
										ausDatei: true,
										entfernterBeginn: weg ? kalendertag(weg.valid_from) : null,
										entferntesEnde: weg?.valid_to ? kalendertag(weg.valid_to) : null,
										entfernteNotiz: weg?.note ?? null
									}
								)
							);
						}
						for (const zu of zuordnungsplan.zuBeenden) {
							await tx`
								UPDATE unit_ownership SET valid_to = ${zu.neuesEnde} WHERE id = ${zu.id}
							`;
							/*
							 * **Auch der Dateiweg schreibt den Verlauf** (01.09.2026, aus
							 * dem Code-Review). `ordneEigentumZu` tut es seit je; hier
							 * geschah ein Eigentumswechsel bisher ohne jede Spur ausser dem
							 * Sammeleintrag über die ganze Übernahme. Wer später fragt, wann
							 * die Wohnung den Eigentümer wechselte, findet so nichts (AD-5).
							 */
							await schreibeVerlauf(
								tx,
								handelnder,
								ereignis(
									EREIGNISARTEN.eigentumBeendet,
									{ art: 'unit', id: einheit.id },
									{
										einheit: v.satz.label,
										bisherigePartei: zu.partyId,
										per: zu.neuesEnde,
										ausDatei: true
									}
								)
							);
						}
						await tx`
							INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id,
							                            valid_from, valid_to)
							VALUES (${einheit.id}, ${partei.id}, ${stwegId}, ${handelnder.operatorId},
							        ${stichtag}, ${naechste?.validFrom ?? null})
						`;
					}
				}

				if (v.satz.nutzniessung) {
					const n = pruefeNutzniessung({ unitId: einheit.id, ...v.satz.nutzniessung });
					await tx`
						INSERT INTO usufruct (unit_id, stweg_id, operator_id, holder_name,
						                      valid_from, valid_to, has_agreement, agreement_summary)
						VALUES (${einheit.id}, ${stwegId}, ${handelnder.operatorId}, ${n.holderName},
						        ${n.validFrom}, ${n.validTo ?? null}, ${n.hasAgreement},
						        ${n.agreementSummary ?? null})
						ON CONFLICT DO NOTHING
					`;
				}

				if (einheit.angelegt) angelegt++;
				else geaendert++;
			}
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.uebernahmeBestaetigt,
				{ art: 'stweg', id: stwegId },
				{
					art: plan.art,
					angelegt,
					geaendert,
					uebersprungen: plan.zusammenfassung.fehlerhaft,
					unveraendert: plan.zusammenfassung.unveraendert,
					stichtag
				}
			)
		);

		return { angelegt, geaendert, uebersprungen: plan.zusammenfassung.fehlerhaft, imArchiv };
	});
}

export { KENNUNG_SPALTE };
