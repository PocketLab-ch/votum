/**
 * Mitberechtigte lesen und schreiben.
 *
 * Die Regeln stehen im Kern (`$lib/domain/mitberechtigte`); hier steht nur der
 * Weg zur Datenbank. Jede Abfrage läuft in `alsBetreiber` und damit unter der
 * Mandantengrenze.
 *
 * **Warum hier so viele Absagen stehen** (26.08.2026, beim Umsetzen ergänzt).
 * Migration 094 hält neun benannte Schranken auf `party_member` und dazu einen
 * Teilindex für die gemeldete Zustelladresse. `docs/gestaltung.md`
 * verlangt, dass jede davon **vorher** hier steht — mit Grund und Ausweg: «Eine
 * Schranke der Datenbank ist keine Fehlermeldung.» Ohne die Prüfungen käme ein
 * falsch gewähltes Gegenüber als «insert or update on table party_member
 * violates foreign key constraint» heraus, und der Verwalter stünde vor einer
 * leeren Seite.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Id, PartyKind } from '$lib/domain/types';

export interface Mitberechtigter {
	partyId: Id;
	displayName: string;
	email: string | null;
	/**
	 * Telefon und Anschrift der Mitgliedszeile.
	 *
	 * **Warum sie mitkommen** (26.08.2026, aus dem Code-Review): Seit Aufgabe 4
	 * steht die Mitgliedszeile nicht mehr eigenständig in der Liste, und mit ihr
	 * fiel der einzige Weg weg, an dem `party.email`, `party.phone` und
	 * `party.address` zu berichtigen sind — `aenderePerson` zieht nur den Namen
	 * auf die Partei nach. Der Weg steht jetzt unter der Hülle, und dafür
	 * braucht die Seite alle drei Felder: Ein Formular, das eines davon
	 * weglässt, LÖSCHT es beim Speichern (`bearbeiteEigentuemer` schreibt alle).
	 */
	phone: string | null;
	address: string | null;
	istZustelladresse: boolean;
	istVertreter: boolean;
	/**
	 * Seit wann die Zeile im Archiv liegt (Migration 086), sonst `null`.
	 *
	 * **Archivierte kommen mit** — die Entscheidung steht hier ausdrücklich,
	 * weil sie sonst still fiele. Wer zu einer Hülle gehört, ist keine Frage
	 * des Zeitpunkts: Die Mitgliedschaft ist eine Zugehörigkeit, keine
	 * Geschichte mit Anfang und Ende. Sie beim Lesen wegzufiltern verkleinerte
	 * den Empfängerkreis nach Wermelinger, Rz. 50 ad Art. 712n, stillschweigend — und eine
	 * unterbliebene Einladung macht den Beschluss anfechtbar. Wer sie **nicht**
	 * anschreiben will, sieht es hier und entscheidet selbst.
	 */
	archiviertAm: string | null;
}

/** Die Mitberechtigten einer Hülle, nach Namen sortiert. */
export async function holeMitberechtigte(
	operatorId: Id,
	huellePartyId: Id
): Promise<Mitberechtigter[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				party_id: string;
				display_name: string;
				email: string | null;
				phone: string | null;
				address: string | null;
				ist_zustelladresse: boolean;
				ist_vertreter: boolean | null;
				archived_at: Date | null;
			}[]
		>`
			SELECT m.mitglied_party_id AS party_id, p.display_name, p.email, p.phone, p.address,
			       p.archived_at, m.ist_zustelladresse,
			       (h.representative_party_id = m.mitglied_party_id) AS ist_vertreter
			  FROM party_member m
			  JOIN party p ON p.id = m.mitglied_party_id
			  JOIN party h ON h.id = m.huelle_party_id
			 WHERE m.huelle_party_id = ${huellePartyId}
			 ORDER BY p.display_name
		`;
		return zeilen.map((z) => ({
			partyId: z.party_id,
			displayName: z.display_name,
			email: z.email,
			phone: z.phone,
			address: z.address,
			istZustelladresse: z.ist_zustelladresse,
			istVertreter: z.ist_vertreter ?? false,
			archiviertAm: z.archived_at?.toISOString() ?? null
		}));
	});
}

/**
 * Zu welchen Gemeinschaften eine Partei gehört — die Namen, nicht die Kennungen.
 *
 * **Für die Rückfrage beim Zuordnen** (Bedienbarkeitsprüfung 05.09.2026,
 * Befund 16). Wird eine Einheit einer Person zugeordnet, die zu einem Paar
 * oder einer Erbengemeinschaft gehört, ist das erlaubt und meistens nicht
 * gemeint: Die gemeinsame Stimme zerfällt dann in eine einzelne.
 *
 * **Eine Frage, keine Sperre** (Produktentscheid 06.09.2026). Jemand kann
 * neben dem gemeinsamen Eigentum sehr wohl eine eigene Einheit besitzen.
 *
 * Mehrere Treffer sind möglich: dieselbe Person in zwei Erbengemeinschaften.
 */
export async function holeHuellenVonMitglied(
	operatorId: Id,
	stwegId: Id,
	mitgliedPartyId: Id
): Promise<string[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ display_name: string }[]>`
			SELECT h.display_name
			  FROM party_member m
			  JOIN party h ON h.id = m.huelle_party_id
			 WHERE m.stweg_id = ${stwegId}
			   AND m.mitglied_party_id = ${mitgliedPartyId}
			 ORDER BY h.display_name
		`;
		return zeilen.map((z) => z.display_name);
	});
}

/**
 * Alle Mitberechtigten einer Gemeinschaft, nach Hülle gebündelt.
 *
 * **Eine Abfrage statt einer je Zeile.** Die Eigentümerliste zeigt sie unter
 * jeder gemeinschaftlichen Zeile; bei dreissig Parteien wären das dreissig
 * Abfragen für eine Seite.
 */
export async function holeMitberechtigteJeHuelle(
	operatorId: Id,
	stwegId: Id
): Promise<Map<Id, Mitberechtigter[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				huelle_party_id: string;
				party_id: string;
				display_name: string;
				email: string | null;
				phone: string | null;
				address: string | null;
				ist_zustelladresse: boolean;
				ist_vertreter: boolean | null;
				archived_at: Date | null;
			}[]
		>`
			SELECT m.huelle_party_id, m.mitglied_party_id AS party_id, p.display_name,
			       p.email, p.phone, p.address, p.archived_at, m.ist_zustelladresse,
			       (h.representative_party_id = m.mitglied_party_id) AS ist_vertreter
			  FROM party_member m
			  JOIN party p ON p.id = m.mitglied_party_id
			  JOIN party h ON h.id = m.huelle_party_id
			 WHERE m.stweg_id = ${stwegId}
			 ORDER BY p.display_name
		`;
		const je = new Map<Id, Mitberechtigter[]>();
		for (const z of zeilen) {
			const bisher = je.get(z.huelle_party_id) ?? [];
			bisher.push({
				partyId: z.party_id,
				displayName: z.display_name,
				email: z.email,
				phone: z.phone,
				address: z.address,
				istZustelladresse: z.ist_zustelladresse,
				istVertreter: z.ist_vertreter ?? false,
				archiviertAm: z.archived_at?.toISOString() ?? null
			});
			je.set(z.huelle_party_id, bisher);
		}
		return je;
	});
}

/**
 * Die Zeilen, die **ausser der Mitberechtigung nichts halten** (Aufgabe 4).
 *
 * **Wozu.** Die Eigentümerliste zeigt die Mitberechtigten unter ihrer Hülle.
 * Stünden sie zusätzlich als eigene Zeilen in der Tabelle — mit «noch keine
 * zugeordnet», null Köpfen und null Quote —, sähe das aus wie eine halbfertige
 * Erfassung. Genau daran ist die Laienprüfung am 26.08.2026 hängengeblieben.
 *
 * **Warum nicht einfach «kommt in `party_member` vor».** Der erste Entwurf des
 * Plans schloss jede Zeile aus, die dort steht. Das hätte auch den Eigentümer
 * ausgeblendet, der **selbst eine Einheit hält** und zusätzlich an einer
 * zweiten mitberechtigt ist — der Doppelfall, den die Architektur ausdrücklich
 * vorsieht (eigene Wohnung plus Anteil am Paar). Seine Zeile verschwände samt
 * Stimme, und die Summe der Kopfstimmen im Fuss der Tabelle ginge nicht mehr
 * auf. Der Testfall dazu heisst «lässt den Doppelfall in der Liste stehen».
 *
 * **`unit_ownership` ohne Stichtag.** Gezählt wird jede Zuordnung, auch eine
 * beendete. Sonst wanderte eine Zeile beim Verschieben des Stichtags aus der
 * Liste und wieder hinein — und wer 2022 verkauft hat, verlöre seine Zeile samt
 * Eigentümergeschichte.
 *
 * **Nur die Anzeige, nie die Rechnung.** Diese Menge wird der Seite
 * danebengelegt; `stimmkraftAnsicht` bleibt unangetastet. Sie ist die Grundlage
 * der Momentaufnahme (`freigabe.ts`) und wird von acht Stellen gelesen — ein
 * Filter dort entschiede still für alle.
 */
export async function holeNurMitberechtigte(operatorId: Id, stwegId: Id): Promise<Id[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ party_id: string }[]>`
			SELECT DISTINCT m.mitglied_party_id AS party_id
			  FROM party_member m
			 WHERE m.stweg_id = ${stwegId}
			   AND NOT EXISTS (
			       SELECT 1 FROM unit_ownership o WHERE o.party_id = m.mitglied_party_id
			   )
		`;
		return zeilen.map((z) => z.party_id);
	});
}

/** Eine Hülle, in der eine Person steckt — für die Personenseite. */
export interface Huellenzugehoerigkeit {
	huellePartyId: Id;
	huelle: string;
	stwegId: Id;
	gemeinschaft: string;
	istVertreter: boolean;
}

/**
 * In welchen Hüllen eine Person steckt — über die Gemeinschaften hinweg.
 *
 * **Wozu die Personenseite das braucht.** Dort steht sonst «Diesem Eigentümer
 * ist noch keine Einheit zugeordnet» — richtig und irreführend zugleich: Die
 * Einheit hält die Hülle, die Person ist an ihr mitberechtigt. Wer die Seite
 * ohne diesen Satz liest, hält die Person für eine Karteileiche und räumt sie
 * weg. Genau das ist am 26.08.2026 in der Laienprüfung passiert.
 *
 * Setzt die Personenklammer an der Mitgliedszeile voraus (Produktentscheid
 * 26.08.2026). Zeilen aus der Zeit davor tragen keine und erscheinen hier
 * nicht — der Nachziehweg dafür ist «Dieselbe Person?» auf der Eigentümerseite.
 */
export async function holeHuellenDerPerson(
	operatorId: Id,
	personId: Id
): Promise<Huellenzugehoerigkeit[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				huelle_party_id: string;
				huelle: string;
				stweg_id: string;
				gemeinschaft: string;
				ist_vertreter: boolean | null;
			}[]
		>`
			SELECT h.id AS huelle_party_id, h.display_name AS huelle,
			       s.id AS stweg_id, s.name AS gemeinschaft,
			       (h.representative_party_id = m.mitglied_party_id) AS ist_vertreter
			  FROM party_member m
			  JOIN party mitglied ON mitglied.id = m.mitglied_party_id
			  JOIN party h        ON h.id = m.huelle_party_id
			  JOIN stweg s        ON s.id = m.stweg_id
			 WHERE mitglied.person_id = ${personId}
			 ORDER BY s.name, h.display_name
		`;
		return zeilen.map((z) => ({
			huellePartyId: z.huelle_party_id,
			huelle: z.huelle,
			stwegId: z.stweg_id,
			gemeinschaft: z.gemeinschaft,
			istVertreter: z.ist_vertreter ?? false
		}));
	});
}

interface ZeileFuerPruefung {
	stweg_id: string;
	display_name: string;
	kind: PartyKind;
	is_community: boolean;
	representative_party_id: string | null;
	representative_name: string | null;
}

/** Liest die Angaben, an denen die Prüfungen unten hängen. Ausserhalb der Mandantengrenze: nichts. */
async function lies(
	tx: postgres.TransactionSql,
	partyId: Id
): Promise<ZeileFuerPruefung | undefined> {
	const [zeile] = await tx<ZeileFuerPruefung[]>`
		SELECT stweg_id, display_name, kind, is_community, representative_party_id,
		       representative_name
		  FROM party WHERE id = ${partyId}
	`;
	return zeile;
}

/**
 * Nimmt eine bestehende Eigentümerzeile als Mitberechtigte in eine Hülle auf.
 *
 * Beide Zeilen müssen es schon geben: Diese Funktion verbindet, sie legt nicht
 * an. Wer Hülle und Personen in **einem** Zug anlegen will, nimmt
 * `erstelleGemeinschaftlicheZeile` in `eigentuemer.ts` — das ist der Weg, den
 * die Erfassungsmaske geht (seit dem 26.08.2026, Aufgabe 3).
 *
 * **Der Sammelname wandert nicht mit.** Nimmt jemand hier eine Person auf oder
 * weg, bleibt `display_name` der Hülle stehen. Das ist Absicht:
 * `docs/gestaltung.md` — «Was eine andere Stelle trägt, wird nicht nebenher
 * überschrieben». Ein von Hand berichtigter Name («Erbengemeinschaft Muster»)
 * würde sonst still durch die Aufzählung ersetzt. Wer den Namen nachziehen
 * will, tut es unter «Angaben berichtigen».
 */
export async function nimmMitberechtigtenAuf(
	handelnder: Handelnder & { operatorId: string },
	huellePartyId: Id,
	mitgliedPartyId: Id
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		// **Der Selbstbezug zuerst**, sonst beantwortete ihn die Prüfung unten mit
		// «ist selbst eine Hülle» — richtig, aber am Fall vorbei.
		if (huellePartyId === mitgliedPartyId) {
			throw new FachlicherFehler(
				'selbstbezug',
				'Eine gemeinschaftliche Zeile kann nicht ihr eigenes Mitglied sein. Wählen Sie die Person, die mitberechtigt ist.',
				'mitgliedPartyId'
			);
		}

		const huelle = await lies(tx, huellePartyId);
		if (!huelle) {
			throw new FachlicherFehler(
				'huelle_unbekannt',
				'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'huellePartyId'
			);
		}
		if (!huelle.is_community) {
			throw new FachlicherFehler(
				'keine_huelle',
				`«${huelle.display_name}» ist keine gemeinschaftliche Zeile. Wählen Sie dort zuerst «Gemeinschaftliches Eigentum».`,
				'huellePartyId'
			);
		}

		const mitglied = await lies(tx, mitgliedPartyId);
		if (!mitglied) {
			throw new FachlicherFehler(
				'mitglied_unbekannt',
				'Diese Eigentümerzeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'mitgliedPartyId'
			);
		}
		// Keine Hülle in der Hülle (`party_member_mitglied_ist_keine_huelle`): Eine
		// Kette versteckte eine Stimme, und der Empfängerkreis wäre nicht mehr
		// endlich ohne Zyklenprüfung.
		if (mitglied.is_community) {
			throw new FachlicherFehler(
				'mitglied_ist_huelle',
				`«${mitglied.display_name}» ist selbst gemeinschaftliches Eigentum. Nehmen Sie die einzelnen Personen auf, nicht eine zweite Hülle.`,
				'mitgliedPartyId'
			);
		}
		if (mitglied.stweg_id !== huelle.stweg_id) {
			throw new FachlicherFehler(
				'fremde_gemeinschaft',
				`«${mitglied.display_name}» gehört zu einer anderen Gemeinschaft. Legen Sie die Person in dieser Gemeinschaft an.`,
				'mitgliedPartyId'
			);
		}

		const [{ schon }] = await tx<{ schon: number }[]>`
			SELECT count(*)::int AS schon FROM party_member
			 WHERE huelle_party_id = ${huellePartyId} AND mitglied_party_id = ${mitgliedPartyId}
		`;
		if (schon > 0) {
			throw new FachlicherFehler(
				'schon_mitberechtigt',
				`«${mitglied.display_name}» steht bereits bei «${huelle.display_name}». Zweimal dieselbe Person hiesse zwei Einladungen an dieselbe Adresse.`,
				'mitgliedPartyId'
			);
		}

		await tx`
			INSERT INTO party_member (operator_id, stweg_id, huelle_party_id, mitglied_party_id)
			VALUES (${handelnder.operatorId}, ${huelle.stweg_id}, ${huellePartyId}, ${mitgliedPartyId})
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.mitberechtigterAufgenommen,
				{ art: 'party', id: huellePartyId },
				{ mitglied: mitgliedPartyId, name: mitglied.display_name, huelle: huelle.display_name }
			)
		]);
	});
}

export async function entferneMitberechtigten(
	handelnder: Handelnder & { operatorId: string },
	huellePartyId: Id,
	mitgliedPartyId: Id
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const huelle = await lies(tx, huellePartyId);
		if (!huelle) {
			throw new FachlicherFehler(
				'huelle_unbekannt',
				'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'huellePartyId'
			);
		}

		/*
		 * **Erst nachsehen, ob es die Zuordnung überhaupt gibt** — und zwar vor
		 * der Vertreterprüfung darunter. Andersherum bekäme jemand, der eine gar
		 * nicht eingetragene Zeile wegnehmen will, die Absage «bestimmen Sie
		 * zuerst eine andere Vertretung» zu lesen: richtig geraten, am Fall
		 * vorbei, und der Ausweg führte ins Leere.
		 *
		 * Der Name wird gleich mitgelesen: Er kommt in den Verlaufseintrag. Ohne
		 * ihn stünde dort nur eine Kennung, und sobald die Eigentümerzeile später
		 * getilgt ist, sagt der Eintrag niemandem mehr, wer entfernt wurde.
		 */
		const [zuordnung] = await tx<{ ist_zustelladresse: boolean; display_name: string }[]>`
			SELECT m.ist_zustelladresse, p.display_name
			  FROM party_member m
			  JOIN party p ON p.id = m.mitglied_party_id
			 WHERE m.huelle_party_id = ${huellePartyId}
			   AND m.mitglied_party_id = ${mitgliedPartyId}
		`;
		if (!zuordnung) {
			throw new FachlicherFehler(
				'nicht_mitberechtigt',
				`Diese Person steht nicht bei «${huelle.display_name}». Laden Sie die Eigentümerliste neu.`,
				'mitgliedPartyId'
			);
		}

		/*
		 * **Nicht denjenigen entfernen, der die Stimme ausübt** — solange noch
		 * jemand anderes dasteht. Seit Migration 095 verlangt
		 * `party_vertreter_ist_mitglied`, dass der Vertreter in `party_member`
		 * steht; die Schranke steht aber auf `ON DELETE SET NULL` und liesse den
		 * Verweis hier **still** fallen. Die Hülle stünde danach ohne Vertretung
		 * da, und niemand sähe es. Bezeichnet wird eine der berechtigten Personen,
		 * weil sie auch ohne Vollmacht vertreten darf (Wermelinger, Rz. 19 ad
		 * Art. 712o). Eine Drittperson vertritt über eine Vollmacht.
		 *
		 * Der Ausweg, den die Absage nennt, ist `setzeVertretung` weiter unten.
		 *
		 * **Die LETZTE Person ist davon ausgenommen** (26.08.2026, aus dem
		 * Code-Review). Sie ist zwangsläufig der Vertreter: `setzeVertretung`
		 * kann nur auf ein Mitglied zeigen, und je weniger übrig sind, desto
		 * sicherer ist es die eine. Ohne diese Ausnahme wäre die Hülle **für
		 * immer** gesperrt — weder tilgbar (`pruefeZeileTilgbar`) noch umwidmbar
		 * (`pruefeHakenUmlegbar`), und beide Absagen nennten einen Ausweg, den es
		 * nicht gibt. Genau die Falle, die diese Aufgabe schliessen sollte.
		 *
		 * Der Verweis fällt dabei ausdrücklich, nicht still: Was zurückbleibt,
		 * ist eine gemeinschaftliche Zeile ohne eingetragene Mitberechtigte —
		 * derselbe Zustand wie bei jeder Zeile aus der Zeit vor Migration 094.
		 * Der eingefrorene `representative_name` bleibt stehen. Bis zum
		 * 27.08.2026 hätte ihn zu löschen `party_vertreter_bei_gemeinschaft`
		 * gebrochen (Migration 006); die Schranke ist mit Migration 096 gefallen.
		 * Stehen bleibt er trotzdem: Er ist der Name, der zur Zeit der letzten
		 * Versammlung galt, und dieser Weg entfernt eine Mitgliedschaft, nicht
		 * eine Vergangenheit. Zurücknehmen lässt er sich unter «Vertretung
		 * wechseln» mit «Niemand bezeichnet».
		 */
		const [{ uebrige }] = await tx<{ uebrige: number }[]>`
			SELECT count(*)::int AS uebrige FROM party_member
			 WHERE huelle_party_id = ${huellePartyId} AND mitglied_party_id <> ${mitgliedPartyId}
		`;
		const letzte = uebrige === 0;

		if (huelle.representative_party_id === mitgliedPartyId && !letzte) {
			throw new FachlicherFehler(
				'vertritt_gemeinschaft',
				`«${zuordnung.display_name}» übt die Stimme von «${huelle.display_name}» aus. Bestimmen Sie zuerst eine andere Vertretung oder nehmen Sie die Bezeichnung zurück.`,
				'mitgliedPartyId'
			);
		}

		if (huelle.representative_party_id === mitgliedPartyId) {
			await tx`
				UPDATE party SET representative_party_id = NULL WHERE id = ${huellePartyId}
			`;
		}

		const weg = await tx`
			DELETE FROM party_member
			 WHERE huelle_party_id = ${huellePartyId} AND mitglied_party_id = ${mitgliedPartyId}
		`;
		// Null Zeilen hiesse: Der Klick hat nichts getan, und die Seite meldete
		// trotzdem Erfolg. Ein stiller Nichtvollzug ist schlimmer als eine Absage.
		// Erreichbar nur, wenn eine zweite Sitzung dazwischenfuhr.
		if (weg.count === 0) {
			throw new FachlicherFehler(
				'nicht_mitberechtigt',
				`Diese Person steht nicht bei «${huelle.display_name}». Laden Sie die Eigentümerliste neu.`,
				'mitgliedPartyId'
			);
		}

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.mitberechtigterEntfernt,
				{ art: 'party', id: huellePartyId },
				{
					mitglied: mitgliedPartyId,
					name: zuordnung.display_name,
					huelle: huelle.display_name,
					/*
					 * **War es die gemeldete Zustelladresse?** Dann kippt die
					 * Einladungsregel mit diesem Klick von «eine Adresse genügt»
					 * zurück auf «alle einzeln» (Wermelinger, Rz. 50 f. ad Art. 712n) — ohne
					 * dass jemand die Zustelladresse angefasst hätte. Die
					 * ungefährliche Richtung, aber sie gehört in die Spur.
					 */
					war_zustelladresse: zuordnung.ist_zustelladresse
				}
			)
		]);
	});
}

/**
 * Bestimmt, wer die eine Stimme der Hülle ausübt (ZGB Art. 712o Abs. 1).
 *
 * **Warum es diesen Weg geben muss.** `entferneMitberechtigten` weist das
 * Entfernen der vertretenden Person ab und nennt als Ausweg «Bestimmen Sie
 * zuerst eine andere Vertretung». Ohne diese Funktion nennte die Absage einen
 * Weg, den die Anwendung nicht anbietet — und die Zeile wäre nicht mehr zu
 * berichtigen.
 *
 * **`representative_name` wandert mit.** Er ist der eingefrorene Name für die
 * Momentaufnahme und für alles, was daraus gedruckt wird: Unterschriftenliste,
 * Stimmzettel, Versandliste. Bliebe er stehen, nennten sie nach einem Wechsel
 * den falschen Menschen. Der Verweis sagt, **wer** gemeint ist,
 * der Name, **wie er am Versammlungstag hiess** — beide gehören nachgeführt,
 * solange die Versammlung noch nicht freigegeben ist.
 */
export async function setzeVertretung(
	handelnder: Handelnder & { operatorId: string },
	huellePartyId: Id,
	mitgliedPartyId: Id | null
): Promise<{ huelle: string; vertreter: string | null }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const huelle = await lies(tx, huellePartyId);
		if (!huelle) {
			throw new FachlicherFehler(
				'huelle_unbekannt',
				'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'huellePartyId'
			);
		}
		if (!huelle.is_community) {
			throw new FachlicherFehler(
				'keine_huelle',
				`«${huelle.display_name}» ist keine gemeinschaftliche Zeile und hat deshalb keine Mitberechtigten.`,
				'huellePartyId'
			);
		}

		/*
		 * **Die Bezeichnung zurücknehmen** (Produktentscheid 27.08.2026). Seit
		 * heute ist sie freiwillig, und Migration 096 hat die Schranke fallen
		 * lassen, die sie erzwang. Ohne diesen Zweig wäre der Weg eine
		 * Einbahnstrasse: Wer einmal jemanden eingetragen hat, käme nie mehr auf
		 * «niemand bezeichnet» zurück — die Maske böte eine Wahl an, die sich
		 * nicht rückgängig machen lässt.
		 *
		 * Beide Spalten zusammen: Der eingefrorene Name ohne den Verweis wäre
		 * genau der Zustand, gegen den der Verweis eingeführt wurde.
		 */
		if (mitgliedPartyId === null) {
			/*
			 * **Nicht bei einer juristischen Hülle** (27.08.2026, aus dem
			 * Code-Review). Migration 096 hat nur `party_vertreter_bei_gemeinschaft`
			 * fallen lassen; `party_vertretung_bei_juristisch` (Migration 025)
			 * verlangt für `kind <> 'natural'` weiterhin einen Namen. Ohne diesen
			 * Satz käme die Schranke roh heraus, und der Benutzer läse eine
			 * Meldung über eine Spalte statt über die Sache.
			 */
			if (huelle.kind !== 'natural') {
				throw new FachlicherFehler(
					'vertretung_pflicht',
					`«${huelle.display_name}» ist keine natürliche Person und handelt nie selbst. Bezeichnen Sie, wer die Stimme ausübt.`,
					'mitgliedPartyId'
				);
			}
			if (huelle.representative_party_id === null && !huelle.representative_name) {
				return { huelle: huelle.display_name, vertreter: null };
			}
			const vorherName = huelle.representative_name;
			const geloescht = await tx`
				UPDATE party
				   SET representative_party_id = NULL, representative_name = NULL
				 WHERE id = ${huellePartyId}
			`;
			// Null Zeilen hiesse: Der Klick hat nichts getan und die Seite meldete
			// trotzdem Erfolg. Erreichbar nur, wenn eine zweite Sitzung dazwischenfuhr.
			if (geloescht.count === 0) {
				throw new FachlicherFehler(
					'huelle_unbekannt',
					'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
					'huellePartyId'
				);
			}
			await schreibeVerlauf(tx, handelnder, [
				ereignis(
					EREIGNISARTEN.vertretungGewechselt,
					{ art: 'party', id: huellePartyId },
					{
						huelle: huelle.display_name,
						mitglied: null,
						name: null,
						vorher: vorherName ?? null
					}
				)
			]);
			return { huelle: huelle.display_name, vertreter: null };
		}

		/*
		 * **Nur ein eingetragener Mitberechtigter.** Seit Migration 095 hält auch
		 * `party_vertreter_ist_mitglied` dagegen — aber eine Schranke der Datenbank
		 * ist keine Fehlermeldung (`docs/gestaltung.md`). Hier steht der Satz mit
		 * dem Ausweg.
		 */
		const [zuordnung] = await tx<{ display_name: string }[]>`
			SELECT p.display_name
			  FROM party_member m
			  JOIN party p ON p.id = m.mitglied_party_id
			 WHERE m.huelle_party_id = ${huellePartyId}
			   AND m.mitglied_party_id = ${mitgliedPartyId}
		`;
		if (!zuordnung) {
			throw new FachlicherFehler(
				'nicht_mitberechtigt',
				`Diese Person steht nicht bei «${huelle.display_name}». Als Vertretung lässt sich hier nur eine der mitberechtigten Personen eintragen; eine Drittperson vertritt über eine Vollmacht.`,
				'mitgliedPartyId'
			);
		}

		/*
		 * **Kein Eintrag, wenn nichts wechselt.** Dieselbe Person nochmals zu
		 * wählen ist kein Vorgang; ein Verlauf, der ihn als solchen führt, macht
		 * die echten Wechsel schwerer auffindbar. Der Name muss dabei
		 * übereinstimmen — bei einer Zeile aus der Zeit vor Migration 094 steht
		 * dort noch ein freier Text, und den gehört richtiggestellt.
		 */
		if (
			huelle.representative_party_id === mitgliedPartyId &&
			huelle.representative_name === zuordnung.display_name
		) {
			return { huelle: huelle.display_name, vertreter: zuordnung.display_name };
		}

		// Der bisherige Name für den Verlaufseintrag: Ohne ihn stünde dort nur,
		// wer neu vertritt — die Frage nach einem Wechsel ist aber immer, wer
		// vorher vertrat.
		const [vorher] = await tx<{ display_name: string }[]>`
			SELECT p.display_name FROM party h
			  JOIN party p ON p.id = h.representative_party_id
			 WHERE h.id = ${huellePartyId}
		`;

		const gesetzt = await tx`
			UPDATE party
			   SET representative_party_id = ${mitgliedPartyId},
			       representative_name = ${zuordnung.display_name}
			 WHERE id = ${huellePartyId}
		`;
		// Null Zeilen hiesse: Der Klick hat nichts getan und die Seite meldete
		// trotzdem Erfolg. Erreichbar nur, wenn eine zweite Sitzung dazwischenfuhr.
		if (gesetzt.count === 0) {
			throw new FachlicherFehler(
				'huelle_unbekannt',
				'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'huellePartyId'
			);
		}

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.vertretungGewechselt,
				{ art: 'party', id: huellePartyId },
				{
					huelle: huelle.display_name,
					mitglied: mitgliedPartyId,
					name: zuordnung.display_name,
					vorher: vorher?.display_name ?? huelle.representative_name ?? null
				}
			)
		]);

		return { huelle: huelle.display_name, vertreter: zuordnung.display_name };
	});
}

/**
 * Setzt oder löscht die gemeldete Zustelladresse.
 *
 * `null` heisst: keine gemeldet. Die Einladung geht dann an alle einzeln, wie
 * es die Regel nach Wermelinger, Rz. 50 f. ad Art. 712n, vorsieht.
 *
 * **Der Verlauf hält beides fest** (nicht im Plan, beim Umsetzen ergänzt).
 * Diese eine Einstellung entscheidet, wer die Einladung erhält; bleibt sie
 * ohne Spur, steht im Streit «ich wurde nie eingeladen» Aussage gegen Aussage.
 * Genau dafür gibt es den Verlauf.
 */
export async function setzeZustelladresse(
	handelnder: Handelnder & { operatorId: string },
	huellePartyId: Id,
	mitgliedPartyId: Id | null
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const huelle = await lies(tx, huellePartyId);
		if (!huelle) {
			throw new FachlicherFehler(
				'huelle_unbekannt',
				'Diese gemeinschaftliche Zeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
				'huellePartyId'
			);
		}
		// Dieselbe Prüfung wie beim Aufnehmen: Eine gewöhnliche Zeile hat keine
		// Mitberechtigten, und ein Aufruf auf sie liefe sonst durch, ohne etwas
		// zu tun — mit einem Verlaufseintrag, der etwas anderes behauptet.
		if (!huelle.is_community) {
			throw new FachlicherFehler(
				'keine_huelle',
				`«${huelle.display_name}» ist keine gemeinschaftliche Zeile und hat deshalb keine Mitberechtigten.`,
				'huellePartyId'
			);
		}

		// Erst alle zurücksetzen, dann die eine setzen: Der Teilindex lässt
		// ohnehin nur eine zu, und ein Wechsel wäre sonst je nach Reihenfolge
		// ein Verstoss gegen ihn. `AND ist_zustelladresse` engt auf die Zeilen
		// ein, die sich wirklich ändern — daran hängt unten die Frage, ob
		// überhaupt etwas geschehen ist.
		const zurueckgesetzt = await tx`
			UPDATE party_member SET ist_zustelladresse = false
			 WHERE huelle_party_id = ${huellePartyId} AND ist_zustelladresse
		`;

		if (mitgliedPartyId) {
			const gesetzt = await tx`
				UPDATE party_member SET ist_zustelladresse = true
				 WHERE huelle_party_id = ${huellePartyId} AND mitglied_party_id = ${mitgliedPartyId}
			`;
			// Ohne diese Prüfung liefe die Meldung einer fremden Zeile ins Leere:
			// Das Zurücksetzen oben wäre geschehen, das Setzen nicht — die Hülle
			// stünde ohne gemeldete Adresse da, und niemand hätte es gesehen.
			if (gesetzt.count === 0) {
				throw new FachlicherFehler(
					'nicht_mitberechtigt',
					`Diese Person steht nicht bei «${huelle.display_name}». Nehmen Sie sie zuerst als Mitberechtigte auf.`,
					'mitgliedPartyId'
				);
			}

			const mitglied = await lies(tx, mitgliedPartyId);
			await schreibeVerlauf(tx, handelnder, [
				ereignis(
					EREIGNISARTEN.zustelladresseGemeldet,
					{ art: 'party', id: huellePartyId },
					{
						mitglied: mitgliedPartyId,
						name: mitglied?.display_name ?? null,
						huelle: huelle.display_name
					}
				)
			]);
			return;
		}

		// **Kein Eintrag, wenn nichts aufzuheben war.** Ein Verlauf, der ein
		// folgenloses Speichern als Handlung führt, macht die echten Einträge
		// schwerer auffindbar — und er behauptet etwas, das nicht geschah.
		if (zurueckgesetzt.count === 0) return;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.zustelladresseAufgehoben,
				{ art: 'party', id: huellePartyId },
				{ huelle: huelle.display_name }
			)
		]);
	});
}
