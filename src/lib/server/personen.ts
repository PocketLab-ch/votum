/**
 * Die Person über den Gemeinschaften.
 *
 * Sie beantwortet eine einzige Frage, die sich sonst nicht beantworten lässt:
 * **Ist der Mensch, der hier am Eingang steht, derselbe wie dort?** Ohne sie
 * müsste am Versammlungstag jeder in jeder Gemeinschaft einzeln angemeldet
 * werden, in der er eine Einheit hält.
 *
 * Die Verknüpfung wird gesetzt, nie geraten — dazu die Begründung in
 * `migrations/029_person.sql`.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { verlangeStichtag } from './stichtag';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { schreibeEigentumszuordnung, pruefeZeileTilgbar } from './eigentuemer';
import { giltAm, planeZuordnung, type Zuordnung } from '$lib/domain/historie';
import { kalendertag, istKalendertag } from '$lib/domain/datum';
import type { Id } from '$lib/domain/types';
import type { Sicht } from '$lib/domain/archivieren';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

export interface Person {
	id: Id;
	art: 'natural' | 'legal';
	name: string;
	email: string | null;
	telefon: string | null;
	adresse: string | null;
	bemerkung: string | null;
}

/** Eine Person mit dem, was sie in den Gemeinschaften hält. */
export interface Personenstand extends Person {
	parteien: {
		parteiId: Id;
		stwegId: Id;
		gemeinschaft: string;
		anzeigename: string;
	}[];
	/** Seit wann die Person im Archiv liegt (Migration 086). */
	archiviertAm?: string | null;
	archivnotiz?: string | null;
}

interface Zeile {
	id: string;
	kind: 'natural' | 'legal';
	display_name: string;
	archived_at: Date | null;
	archived_note: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	note: string | null;
}

function ausDb(z: Zeile): Person {
	return {
		id: z.id,
		art: z.kind,
		name: z.display_name,
		email: z.email,
		telefon: z.phone,
		adresse: z.address,
		bemerkung: z.note
	};
}

/**
 * Die Personen — vorgabemässig **ohne** die archivierten (Migration 086).
 *
 * `'alle'` gehört dorthin, wo nachgeschlagen wird: auf die Seite einer Person
 * und in den Verlauf. In der Liste, aus der man auswählt, bleiben sie draussen.
 */
export async function holePersonen(
	operatorId: Id,
	/**
	 * Ob Archiviertes mitkommt — **ohne Vorgabe, mit Absicht** (25.08.2026).
	 *
	 * Eine Vorgabe `'aktiv'` entschied still für jeden neuen Aufrufer, und
	 * dreimal traf sie das Falsche: Die Elternauswahl verlor die archivierte
	 * Klammer und loeste das Haus beim naechsten Speichern heraus, die
	 * Doppelpruefung beim Anlegen sah die archivierte Erstversammlung nicht
	 * mehr, und am Einlass fehlte die archivierte Person in der Auswahl.
	 * Wer liest, entscheidet jetzt sichtbar: Listen filtern, Pruefungen und
	 * Abendabfragen nie.
	 */
	sicht: Sicht
): Promise<Personenstand[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const personen = await tx<Zeile[]>`
			SELECT * FROM person
			WHERE ${sicht === 'aktiv' ? tx`archived_at IS NULL` : tx`true`}
			ORDER BY display_name
		`;
		if (personen.length === 0) return [];

		const parteien = await tx<
			{
				person_id: string;
				party_id: string;
				stweg_id: string;
				stweg_name: string;
				display_name: string;
			}[]
		>`
			SELECT p.person_id, p.id AS party_id, p.stweg_id, s.name AS stweg_name, p.display_name
			FROM party p JOIN stweg s ON s.id = p.stweg_id
			WHERE p.person_id IS NOT NULL
			ORDER BY s.name
		`;

		return personen.map((z) => ({
			...ausDb(z),
			archiviertAm: z.archived_at?.toISOString() ?? null,
			archivnotiz: z.archived_note,
			parteien: parteien
				.filter((p) => p.person_id === z.id)
				.map((p) => ({
					parteiId: p.party_id,
					stwegId: p.stweg_id,
					gemeinschaft: p.stweg_name,
					anzeigename: p.display_name
				}))
		}));
	});
}

export interface PersonEingabe {
	art?: 'natural' | 'legal';
	name: string;
	email?: string | null;
	telefon?: string | null;
	adresse?: string | null;
	bemerkung?: string | null;
}

/**
 * Eine Person in der **laufenden** Transaktion anlegen.
 *
 * **Wozu getrennt** (26.08.2026, Aufgabe 4). `erstelleGemeinschaftlicheZeile`
 * legt Hülle, Mitberechtigte und deren Personenklammern in **einer**
 * Transaktion an. `alsBetreiber` dort ein zweites Mal aufzurufen öffnete eine
 * zweite Verbindung: Sie sähe die eben eingefügte Partei nicht, und ein
 * Teilerfolg bliebe stehen, wo der Rest zurückgerollt wird.
 *
 * Dasselbe Muster wie `schreibeZeile` in `eigentuemer.ts`.
 */
export async function schreibePerson(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	eingabe: PersonEingabe
): Promise<Person> {
	const name = eingabe.name?.trim() ?? '';
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler('name_zu_kurz', 'Der Name fehlt oder ist zu kurz.', 'name');
	}

	const [z] = await tx<Zeile[]>`
		INSERT INTO person (operator_id, kind, display_name, email, phone, address, note)
		VALUES (${handelnder.operatorId}, ${eingabe.art ?? 'natural'}, ${name},
		        ${eingabe.email?.trim() || null}, ${eingabe.telefon?.trim() || null},
		        ${eingabe.adresse?.trim() || null}, ${eingabe.bemerkung?.trim() || null})
		RETURNING *
	`;
	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(EREIGNISARTEN.personAngelegt, { art: 'person', id: z.id }, { name })
	);
	return ausDb(z);
}

export async function erstellePerson(
	handelnder: Handelnder & { operatorId: string },
	eingabe: PersonEingabe
): Promise<Person> {
	return alsBetreiber(handelnder.operatorId, (tx) => schreibePerson(tx, handelnder, eingabe));
}

/**
 * Verknüpft eine bestehende Partei mit einer Person.
 *
 * Getrennt vom Anlegen, weil das Verknüpfen der häufigere Vorgang ist: Die
 * Parteien bestehen längst, die Klammer kommt später. Und weil eine falsche
 * Verknüpfung Folgen hat, ist sie ein eigener, bewusster Schritt.
 */
export async function verknuepfePartei(
	handelnder: Handelnder & { operatorId: string },
	parteiId: Id,
	personId: Id | null
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		schreibeKlammer(tx, handelnder, parteiId, personId)
	);
}

/**
 * Dasselbe in der **laufenden** Transaktion — siehe `schreibePerson`.
 *
 * Gebraucht von `erstelleGemeinschaftlicheZeile`: Dort entstehen Zeile und
 * Klammer im selben Zug, und ein zweiter `alsBetreiber` sähe die eben
 * eingefügte Partei nicht.
 */
export async function schreibeKlammer(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	parteiId: Id,
	personId: Id | null
): Promise<void> {
	const [p] = await tx<
		{ display_name: string; kind: string; is_community: boolean; stweg_id: string }[]
	>`
		SELECT display_name, kind, is_community, stweg_id FROM party WHERE id = ${parteiId}
	`;
	if (!p) throw new FachlicherFehler('unbekannt', 'Eigentümer nicht gefunden.', 'parteiId');

	if (personId && (p.kind === 'gemeinschaft' || p.is_community)) {
		throw new FachlicherFehler(
			'keine_einzelperson',
			'Hinter dieser Zeile steht keine einzelne Person — eine Gemeinschaft oder mehrere ' +
				'Berechtigte. Eine Personenklammer gäbe einem von ihnen die Stimme aller.',
			'parteiId'
		);
	}

	if (personId) {
		/*
		 * **Die Person unter dem eigenen Betreiber suchen.** Eine fremde Kennung
		 * scheiterte sonst erst am Fremdschlüssel `party_person_gleicher_betreiber`
		 * und endete als 500 (Kreuzteil des Fremdbetreiber-Durchstichs,
		 * 27.10.2026).
		 */
		const [person] = await tx`SELECT 1 FROM person WHERE id = ${personId}`;
		if (!person) throw new FachlicherFehler('unbekannt', 'Person nicht gefunden.', 'personId');

		const [schon] = await tx<{ id: string; display_name: string }[]>`
			SELECT id, display_name FROM party
			WHERE stweg_id = ${p.stweg_id} AND person_id = ${personId} AND id <> ${parteiId}
		`;
		if (schon) {
			throw new FachlicherFehler(
				'doppelt',
				`Diese Person ist in derselben Gemeinschaft bereits als «${schon.display_name}» ` +
					'erfasst. Zwei Zeilen wären zwei Kopfstimmen, wo ihr eine zusteht.',
				'personId'
			);
		}
	}

	await tx`UPDATE party SET person_id = ${personId} WHERE id = ${parteiId}`;
	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			personId ? EREIGNISARTEN.personVerknuepft : EREIGNISARTEN.personGeloest,
			{ art: 'party', id: parteiId },
			{ eigentuemer: p.display_name, person: personId }
		)
	);
}

/**
 * Alle Parteien einer Person, die an einem Versammlungstag stimmberechtigt sind
 * (Story 7.6).
 *
 * Gelesen wird aus der **Momentaufnahme** und nicht aus den Stammdaten: Wer am
 * Stichtag nicht stimmberechtigt war, ist es am Abend auch nicht, selbst wenn er
 * inzwischen gekauft hat (AD-3).
 */
export async function parteienAmTag(
	operatorId: Id,
	tagId: Id,
	personId: Id
): Promise<{ meetingId: Id; gemeinschaft: string; snapshotPartyId: Id; name: string }[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ meeting_id: string; stweg_name: string; snapshot_party_id: string; display_name: string }[]
		>`
			SELECT m.id AS meeting_id, s.name AS stweg_name,
			       sp.id AS snapshot_party_id, sp.display_name
			FROM meeting m
			JOIN stweg s          ON s.id = m.stweg_id
			JOIN snapshot_party sp ON sp.meeting_id = m.id
			JOIN party p           ON p.id = sp.party_id
			WHERE m.meeting_day_id = ${tagId}
			  AND p.person_id = ${personId}
			ORDER BY m.day_position NULLS LAST, s.name
		`;
		return zeilen.map((z) => ({
			meetingId: z.meeting_id,
			gemeinschaft: z.stweg_name,
			snapshotPartyId: z.snapshot_party_id,
			name: z.display_name
		}));
	});
}

/**
 * Die Eigentümerzeile einer Person in einer Gemeinschaft — vorhanden oder neu.
 *
 * **Warum es sie gibt.** Zwei Wege führen hierher: das Zuordnen einer Einheit
 * von der Personenseite aus und das Erfassen eines Eigentümers in der
 * Gemeinschaft, wenn dort «eine bereits erfasste Person» gewählt wird. Beide
 * müssen dieselbe Zeile finden statt zwei anzulegen — sonst stünde derselbe
 * Mensch zweimal in derselben Gemeinschaft, mit doppelter Kopfstimme.
 *
 * Der Anzeigename wird von der Person übernommen und danach **nicht**
 * nachgeführt: Er ist das, was in der damaligen Traktandenliste und im damaligen
 * Protokoll stand.
 */
export async function parteiAusPerson(
	handelnder: Handelnder & { operatorId: string },
	tx: postgres.TransactionSql,
	personId: Id,
	stwegId: Id
): Promise<{ id: Id; neu: boolean }> {
	const [person] = await tx<{ display_name: string; kind: 'natural' | 'legal' }[]>`
		SELECT display_name, kind FROM person WHERE id = ${personId}
	`;
	if (!person) throw new FachlicherFehler('unbekannt', 'Person nicht gefunden.', 'personId');

	const [vorhanden] = await tx<{ id: string }[]>`
		SELECT id FROM party WHERE stweg_id = ${stwegId} AND person_id = ${personId}
	`;
	if (vorhanden) return { id: vorhanden.id, neu: false };

	// Die Abfrage oben findet nur, was schon **verknüpft** ist. Eine Zeile aus
	// der Übernahme trägt keine `person_id` — sie bliebe unsichtbar, und wir
	// legten dieselbe Person ein zweites Mal an. Genau so entstanden in einer
	// Gemeinschaft sechzehn Zeilen für vierzehn Einheiten (Prüflauf 23.08.2026):
	// «Katharina Zbinden» stand zweimal da, einmal aus der Übernahme ohne
	// Zuordnung, einmal aus der Personenseite.
	//
	// Verknüpfen tun wir hier trotzdem NICHT von uns aus. Ob die namensgleiche
	// Zeile dieselbe Person ist oder deren Nachfolgerin im Eigentum, kann nur
	// entscheiden, wer die Gemeinschaft kennt — und eine falsche Klammer gäbe am
	// Versammlungstag jemandem Zutritt zu einer fremden Versammlung. Den
	// bestätigten Weg dafür gibt es: den Vorschlag «Dieselbe Person?» auf der
	// Eigentümerseite. Wir halten an und weisen darauf hin.
	const [namensgleich] = await tx<{ id: string; display_name: string }[]>`
		SELECT id, display_name FROM party
		WHERE stweg_id = ${stwegId} AND person_id IS NULL
		  AND lower(display_name) = lower(${person.display_name})
		LIMIT 1
	`;
	if (namensgleich) {
		throw new FachlicherFehler(
			'namensgleich_unverknuepft',
			`In dieser Gemeinschaft steht bereits die Eigentümerzeile «${namensgleich.display_name}», ` +
				`die noch zu keiner Person gehört. Verknüpfen Sie die beiden zuerst auf der Seite ` +
				`«Eigentümer» der Gemeinschaft (Abschnitt «Dieselbe Person?») — sonst führt die ` +
				`Gemeinschaft denselben Menschen zweimal. Ist es nicht dieselbe Person, geben Sie den ` +
				`Namen der bestehenden Zeile so an, dass die beiden unterscheidbar sind.`,
			'personId'
		);
	}

	const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
	await tx`
		INSERT INTO party (id, stweg_id, operator_id, kind, display_name,
		                   representative_name, is_community, person_id)
		VALUES (${id}, ${stwegId}, ${handelnder.operatorId}, ${person.kind},
		        ${person.display_name},
		        ${person.kind === 'legal' ? person.display_name : null}, false, ${personId})
	`;
	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			EREIGNISARTEN.eigentuemerAngelegt,
			{ art: 'party', id },
			{
				name: person.display_name,
				art: person.kind,
				gemeinschaftlich: false,
				aus_person: personId,
				vertreter: null
			}
		)
	);
	return { id, neu: true };
}

/**
 * Dieselbe Zeile, aber als eigener Aufruf mit eigener Transaktion — für die
 * Seite «Eigentümer erfassen», die keine Einheit im Spiel hat.
 */
export async function eigentuemerzeileAusPerson(
	handelnder: Handelnder & { operatorId: string },
	personId: Id,
	stwegId: Id
): Promise<{ id: Id; neu: boolean }> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		parteiAusPerson(handelnder, tx, personId, stwegId)
	);
}

export interface EinheitMitEigentuemer {
	unitId: Id;
	label: string;
	stwegId: Id;
	gemeinschaft: string;
	eigentuemer: { parteiId: Id; name: string; personId: Id | null } | null;
}

/**
 * Alle Einheiten aktiver Gemeinschaften mit ihrem Eigentümer am Pflichtstichtag.
 *
 * Eine Abfrage statt einer je Gemeinschaft hält Datum und Belegungslogik für
 * die ganze Auswahl gleich. Die Hülle gemeinschaftlichen Eigentums bleibt dabei
 * der Eigentümer; ihre Mitberechtigten werden nicht an ihre Stelle geraten.
 */
export async function einheitenMitEigentuemerAm(
	operatorId: Id,
	stichtag: string
): Promise<EinheitMitEigentuemer[]> {
	// Die Prüfung stand hier zuerst; sie sitzt seit dem 16.10.2026 in
	// `stichtag.ts`, damit die vier Stichtag-Wege dieselbe Absage tragen.
	verlangeStichtag(stichtag);

	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				unit_id: string;
				label: string;
				stweg_id: string;
				stweg_name: string;
				party_id: string | null;
				display_name: string | null;
				person_id: string | null;
			}[]
		>`
			SELECT u.id AS unit_id, u.label, s.id AS stweg_id, s.name AS stweg_name,
			       p.id AS party_id, p.display_name, p.person_id
			  FROM unit u
			  JOIN stweg s ON s.id = u.stweg_id
			  LEFT JOIN unit_ownership o
			    ON o.unit_id = u.id
			   AND o.valid_from <= ${stichtag}
			   AND (o.valid_to IS NULL OR o.valid_to > ${stichtag})
			  LEFT JOIN party p ON p.id = o.party_id
			 WHERE stweg_archiv_wegen(s.id) IS NULL
			 ORDER BY s.name, u.label
		`;

		return zeilen.map((z) => ({
			unitId: z.unit_id,
			label: z.label,
			stwegId: z.stweg_id,
			gemeinschaft: z.stweg_name,
			eigentuemer:
				z.party_id && z.display_name
					? { parteiId: z.party_id, name: z.display_name, personId: z.person_id }
					: null
		}));
	});
}

export interface EigentumswechselRueckfrage {
	einheit: string;
	person: string;
	ab: string;
	bisherigerEigentuemer: string | null;
	/**
	 * Zu welchen Eigentümergemeinschaften die Zielperson in dieser Gemeinschaft
	 * gehört — leer, wenn zu keiner.
	 *
	 * **Warum das eine Rückfrage wert ist** (Bedienbarkeitsprüfung 05.09.2026,
	 * Befund 16): Die Einheit geht dann an die einzelne Person, nicht an die
	 * Gemeinschaft, und aus einer gemeinsamen Stimme wird eine einzelne. Erlaubt
	 * ist es — jemand kann daneben allein etwas besitzen —, gemeint meistens
	 * nicht.
	 */
	teilEinerGemeinschaft: string[];
	gekappt: { name: string; von: string; bisherBis: string | null; neuBis: string }[];
	verdraengt: { name: string; von: string; bis: string | null }[];
	/**
	 * Ob eine **fremde** Partei betroffen ist (01.09.2026, aus dem Code-Review).
	 *
	 * Entscheidet über den Schlusssatz «Sollen beide zusammen Eigentümer sein?».
	 * Wer nur den Stichtag derselben Person berichtigt, verdrängt sich selbst —
	 * dort wäre die Frage nach zwei Personen sinnlos. Der Eigentümerweg
	 * unterscheidet das seit dem 26.08.2026 genauso.
	 */
	fremdeBetroffen: boolean;
}

export interface EinheitZuPersonErgebnis {
	parteiId: Id | null;
	neuAngelegt: boolean;
	einheit: string;
	person: string;
	rueckfrage: EigentumswechselRueckfrage | null;
}

interface Eigentumszeile extends Zuordnung {
	name: string;
}

/*
 * **Eine Fassung, nicht zwei** (01.09.2026). Dieselbe Umwandlung wurde für die
 * Eigentumshistorie ein zweites Mal gebraucht; sie steht jetzt als
 * `kalendertag` im Kern, und diese Zeile ist nur noch der kurze Name dafür.
 */
const tag = kalendertag;

/**
 * Einheiten einer Person zuordnen — über die Gemeinschaften hinweg.
 *
 * **Der Eigentümer wird einmal geführt, nicht siebenmal.** Bisher legte man ihn
 * in jeder Gemeinschaft neu an; hier wählt man die Einheit, und die Zeile in
 * jener Gemeinschaft entsteht von selbst.
 *
 * **Warum die Zeile trotzdem entsteht.** Sie ist nicht Verwaltungsballast,
 * sondern der Stimmberechtigte **in dieser einen Gemeinschaft**: Die Kopfstimme
 * gilt je Gemeinschaft (ZGB Art. 712o), die Zählweise ist dort verschieden — im
 * Haus je Einheit, anderswo je Eigentümer —, und die Momentaufnahme friert sie
 * je Versammlung ein. Ohne sie liesse sich nicht sagen, mit welcher Stimmkraft
 * jemand wo antritt.
 *
 * Der Anzeigename der Zeile wird beim Anlegen von der Person übernommen und
 * danach nicht mehr nachgeführt: Er ist das, was in der damaligen
 * Traktandenliste und im damaligen Protokoll stand.
 */
export async function ordneEinheitZuPerson(
	handelnder: Handelnder & { operatorId: string },
	personId: Id,
	unitId: Id,
	ab: string,
	notiz?: string,
	bestaetigt = false
): Promise<EinheitZuPersonErgebnis> {
	if (!istKalendertag(ab)) {
		throw new FachlicherFehler('datum_ungueltig', 'Das Datum «gültig ab» fehlt.', 'ab');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [einheit] = await tx<{ stweg_id: string; label: string }[]>`
			SELECT stweg_id, label FROM unit
			 WHERE id = ${unitId} AND stweg_archiv_wegen(stweg_id) IS NULL
		`;
		if (!einheit) throw new FachlicherFehler('unbekannt', 'Einheit nicht gefunden.', 'unitId');

		const [person] = await tx<{ display_name: string; archived_at: Date | null }[]>`
			SELECT display_name, archived_at FROM person WHERE id = ${personId}
		`;
		if (!person) throw new FachlicherFehler('unbekannt', 'Person nicht gefunden.', 'personId');

		const [vorhanden] = await tx<{ id: string; archived_at: Date | null }[]>`
			SELECT id, archived_at FROM party WHERE stweg_id = ${einheit.stweg_id} AND person_id = ${personId}
		`;
		const geschichte = await tx<
			{
				id: string;
				party_id: string;
				display_name: string;
				valid_from: Date | string;
				valid_to: Date | string | null;
			}[]
		>`
			SELECT o.id, o.party_id, p.display_name, o.valid_from, o.valid_to
			  FROM unit_ownership o JOIN party p ON p.id = o.party_id
			 WHERE o.unit_id = ${unitId}
			 ORDER BY o.valid_from
		`;
		const zuordnungen: Eigentumszeile[] = geschichte.map((z) => ({
			id: z.id,
			partyId: z.party_id,
			name: z.display_name,
			validFrom: tag(z.valid_from),
			validTo: z.valid_to ? tag(z.valid_to) : null
		}));
		// Für die Vorschau genügt eine Kennung, die von jeder fremden Partei
		// verschieden ist. Angelegt wird die echte Zeile erst nach Bestätigung.
		const zielParteiId = vorhanden?.id ?? `person:${personId}`;
		const plan = planeZuordnung(zuordnungen, zielParteiId, ab);
		/*
		 * **Nur fremde Zeilen sind eine Verdrängung** (01.09.2026).
		 *
		 * Wer den Stichtag **derselben** Person berichtigt, verdrängt sich selbst.
		 * Beim Kappen war das schon berücksichtigt, beim Entfernen nicht: Die
		 * Rückfrage nannte dann die Zielperson als jemanden, dessen Zuordnung
		 * entfällt, und schloss mit «Sollen beide zusammen Eigentümer sein?» —
		 * eine Frage nach zwei Personen, wo nur eine steht.
		 *
		 * Der Eigentümerweg unterscheidet das seit dem 26.08.2026 über
		 * `fremdeBetroffen`. Hier fehlte dieselbe Unterscheidung; die Klasse ist
		 * damit an beiden Wegen geschlossen.
		 */
		const fremdeGekappt = plan.zuBeenden.filter((z) => z.partyId !== vorhanden?.id);
		const fremdeEntfernt = plan.zuEntfernen.filter((z) => z.partyId !== vorhanden?.id);
		/*
		 * **Gefragt wird, sobald eine Zeile verschwindet — auch die eigene**
		 * (02.09.2026, aus dem Code-Review; Korrektur meiner Fassung vom Vortag).
		 *
		 * Der Unterschied liegt zwischen Kappen und Entfernen, nicht zwischen
		 * eigen und fremd:
		 *
		 * - **Gekappt** wird eine Zeile, die früher beginnt. Sie bleibt stehen,
		 *   nur ihr Ende wandert. Die eigene zu kappen ist kein Verlust, und dafür
		 *   niemanden zu fragen war und bleibt richtig.
		 * - **Entfernt** wird eine Zeile, die am Stichtag oder danach beginnt. Sie
		 *   ist danach weg, samt ihrer Notiz. `?/zuordnen` am Eigentümerweg fragt
		 *   in genau dieser Lage seit je (`eigentuemer/+page.server.ts`: «nachher
		 *   liesse sich der entfernte Datensatz nicht mehr sehen, nur noch der
		 *   Verlauf»).
		 *
		 * Am 01.09.2026 habe ich hier das Tor gefiltert, wo nur der Text zu
		 * unterscheiden war. Der Einwand stimmte — «Sollen beide zusammen
		 * Eigentümer sein?» ist bei einer Selbstverdrängung sinnlos —, aber die
		 * Seite hat für diesen Fall längst einen eigenen Satz. Die Folge war, dass
		 * `fremdeBetroffen` immer `true` wurde, sein `{:else}`-Zweig unerreichbar,
		 * und die beiden Wege zur selben Handlung verschieden antworteten.
		 */
		/*
		 * **Auch dieser Weg fragt bei gemeinschaftlichem Eigentum zurück**
		 * (Code-Review 06.09.2026, Befund 2).
		 *
		 * Die Rückfrage entstand zuerst am Eigentümerweg (`?/zuordnen` in
		 * `gemeinschaften/[id]/eigentuemer`). Hier führt ein zweiter Schreibweg
		 * auf dieselbe Tabelle — und ausgerechnet den empfiehlt der Hilfetext
		 * dort («Name und Anschrift kommen von dort»). Ohne die Prüfung an
		 * beiden Stellen gälte die Zusage nur da, wo jemand an sie gedacht hat.
		 *
		 * Nur wenn die Person in dieser Gemeinschaft schon eine Zeile hat:
		 * Entsteht sie erst mit dieser Zuordnung, gehört sie noch zu keiner
		 * Gemeinschaft.
		 */
		const huellen = vorhanden
			? await tx<{ display_name: string }[]>`
					SELECT h.display_name
					  FROM party_member m
					  JOIN party h ON h.id = m.huelle_party_id
					 WHERE m.mitglied_party_id = ${vorhanden.id}
					 ORDER BY h.display_name
				`.then((z) => z.map((x) => x.display_name))
			: [];

		const brauchtRueckfrage =
			fremdeGekappt.length > 0 || plan.zuEntfernen.length > 0 || huellen.length > 0;

		if (person.archived_at) {
			throw new FachlicherFehler(
				'person_archiviert',
				`«${person.display_name}» liegt im Archiv. Holen Sie die Person zuerst hervor — ` +
					'wer archiviert ist, darf keine Einheiten halten.',
				'personId'
			);
		}
		if (vorhanden?.archived_at) {
			throw new FachlicherFehler(
				'partei_archiviert',
				`Die Eigentümerzeile von «${person.display_name}» in dieser Gemeinschaft liegt im Archiv. ` +
					'Holen Sie sie zuerst hervor.',
				'unitId'
			);
		}

		if (!bestaetigt && brauchtRueckfrage) {
			const nachId = new Map(zuordnungen.map((z) => [z.id, z]));
			const bisher = zuordnungen.find(
				(z) => z.partyId !== vorhanden?.id && giltAm(z, ab)
			);
			return {
				parteiId: vorhanden?.id ?? null,
				neuAngelegt: false,
				einheit: einheit.label,
				person: person.display_name,
				rueckfrage: {
					einheit: einheit.label,
					person: person.display_name,
					ab,
					teilEinerGemeinschaft: huellen,
					bisherigerEigentuemer: bisher?.name ?? null,
					gekappt: fremdeGekappt.map((z) => {
						const bisherige = nachId.get(z.id)!;
						return {
							name: bisherige.name,
							von: bisherige.validFrom,
							bisherBis: bisherige.validTo,
							neuBis: z.neuesEnde
						};
					}),
					fremdeBetroffen: fremdeGekappt.length > 0 || fremdeEntfernt.length > 0,
					verdraengt: plan.zuEntfernen.map((z) => {
						const bisherige = nachId.get(z.id)!;
						return {
							name: bisherige.name,
							von: bisherige.validFrom,
							bis: bisherige.validTo
						};
					})
				}
			};
		}

		const partei = await parteiAusPerson(handelnder, tx, personId, einheit.stweg_id);
		// Dieser vorhandene Schreibweg berechnet den Plan in der laufenden
		// Transaktion erneut. Schlägt er fachlich fehl, rollt auch eine eben
		// angelegte Eigentümerzeile zurück.
		await schreibeEigentumszuordnung(tx, handelnder, unitId, partei.id, ab, notiz);
		return {
			parteiId: partei.id,
			neuAngelegt: partei.neu,
			einheit: einheit.label,
			person: person.display_name,
			rueckfrage: null
		};
	});
}

/**
 * Alle Einheiten, die eine Person zu einem Stichtag hält — quer über die
 * Gemeinschaften.
 */
export async function einheitenDerPerson(
	operatorId: Id,
	personId: Id,
	stichtag: string
): Promise<
	{ unitId: Id; label: string; gemeinschaft: string; stwegId: Id; ab: string; bis: string | null }[]
> {
	// Der Stichtag kann aus der Adresszeile kommen (`?stichtag=`, Block B2,
	// 16.10.2026); ungeprüft warf er im Treiber und an PostgreSQL.
	verlangeStichtag(stichtag);
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				unit_id: string;
				label: string;
				stweg_id: string;
				stweg_name: string;
				valid_from: Date | string;
				valid_to: Date | string | null;
			}[]
		>`
			SELECT u.id AS unit_id, u.label, s.id AS stweg_id, s.name AS stweg_name,
			       o.valid_from, o.valid_to
			FROM unit_ownership o
			JOIN party p ON p.id = o.party_id
			JOIN unit u  ON u.id = o.unit_id
			JOIN stweg s ON s.id = u.stweg_id
			WHERE p.person_id = ${personId}
			  AND o.valid_from <= ${stichtag}
			  AND (o.valid_to IS NULL OR o.valid_to > ${stichtag})
			ORDER BY s.name, u.label
		`;

		return zeilen.map((z) => ({
			unitId: z.unit_id,
			label: z.label,
			gemeinschaft: z.stweg_name,
			stwegId: z.stweg_id,
			ab: tag(z.valid_from),
			bis: z.valid_to ? tag(z.valid_to) : null
		}));
	});
}

/**
 * Was diese Person **früher** hielt — die Gegenrichtung zur Eigentumshistorie
 * an der Gemeinschaft (Auftraggeber, 01.09.2026).
 *
 * **Eine eigene Funktion statt eines Schalters an der obigen.** Die beiden
 * beantworten verschiedene Fragen: «Was hält sie am Stichtag» trägt die
 * Zuordnungsmaske und die Stimmkraft, «was hielt sie einmal» ist eine Auskunft.
 * Ein gemeinsamer Rückgabewert mit einem Merkmal «gilt noch» hiesse, dass jeder
 * bestehende Aufrufer ihn ab sofort auswerten müsste — und wer es vergisst,
 * zählt eine verkaufte Wohnung mit.
 *
 * Beendet heisst: Das Ende liegt **vor oder auf** dem Stichtag. Die Bereiche
 * stossen aneinander (`[)`), ein Ende am Stichtag ist also bereits Vergangenheit.
 */
export async function frueheresEigentumDerPerson(
	operatorId: Id,
	personId: Id,
	stichtag: string
): Promise<
	{ unitId: Id; label: string; gemeinschaft: string; stwegId: Id; ab: string; bis: string }[]
> {
	// Dieselbe Prüfung wie in `einheitenDerPerson`: Beide Wege hängen an
	// derselben Adresse auf `/personen/[id]`.
	verlangeStichtag(stichtag);
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				unit_id: string;
				label: string;
				stweg_id: string;
				stweg_name: string;
				valid_from: Date | string;
				valid_to: Date | string;
			}[]
		>`
			SELECT u.id AS unit_id, u.label, s.id AS stweg_id, s.name AS stweg_name,
			       o.valid_from, o.valid_to
			FROM unit_ownership o
			JOIN party p ON p.id = o.party_id
			JOIN unit u  ON u.id = o.unit_id
			JOIN stweg s ON s.id = u.stweg_id
			WHERE p.person_id = ${personId}
			  AND o.valid_to IS NOT NULL
			  AND o.valid_to <= ${stichtag}
			-- Das zuletzt Beendete zuerst: Wer nachschlägt, sucht meistens den
			-- jüngsten Wechsel, nicht den ältesten.
			ORDER BY o.valid_to DESC, s.name, u.label
		`;
		return zeilen.map((z) => ({
			unitId: z.unit_id,
			label: z.label,
			gemeinschaft: z.stweg_name,
			stwegId: z.stweg_id,
			ab: tag(z.valid_from),
			bis: tag(z.valid_to)
		}));
	});
}

/**
 * Die Stammangaben einer Person berichtigen.
 *
 * **Warum es das bis zum 22.08.2026 nicht gab**, ist die eigentliche Geschichte:
 * Im ganzen Servercode stand kein einziges `UPDATE person`. Erfassen ging,
 * zuordnen ging, verknüpfen ging — ändern nicht. Ein Tippfehler im Namen blieb
 * für immer stehen, und eine neue E-Mail-Adresse liess sich nicht nachtragen,
 * obwohl genau sie den Zugangscode zur Versammlung trägt. Gefunden hat es der
 * Usability-Prüflauf (Befund A-03); im Betrieb wäre es spätestens im zweiten
 * Jahr aufgeschlagen.
 *
 * **Die Art ändert sich hier nicht.** Ob eine Partei ein Mensch oder eine
 * juristische Person ist, hängt an ihren Zuordnungen und an dem, wer für sie
 * handelt; das ist kein Tippfehler, sondern ein anderer Sachverhalt. Wer sich
 * dort vertan hat, legt neu an.
 */
export async function aenderePerson(
	handelnder: Handelnder & { operatorId: string },
	personId: Id,
	eingabe: Omit<PersonEingabe, 'art'>
): Promise<Person> {
	const name = eingabe.name?.trim() ?? '';
	if (zeichenzahl(name) < 2) {
		throw new FachlicherFehler('name_zu_kurz', 'Der Name fehlt oder ist zu kurz.', 'name');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<Zeile[]>`SELECT * FROM person WHERE id = ${personId}`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Diese Person gibt es nicht.', 'personId');
		}

		const [z] = await tx<Zeile[]>`
			UPDATE person
			   SET display_name = ${name},
			       email = ${eingabe.email?.trim() || null},
			       phone = ${eingabe.telefon?.trim() || null},
			       address = ${eingabe.adresse?.trim() || null},
			       note = ${eingabe.bemerkung?.trim() || null},
			       updated_at = now()
			 WHERE id = ${personId}
			RETURNING *
		`;

		/*
		 * **Die Eigentümerzeilen tragen den Namen ein zweites Mal** (Nachprüfung
		 * 23.08.2026). `party.display_name` ist eine Kopie von
		 * `person.display_name`; wer nur die Person berichtigte, sah den neuen
		 * Namen unter «Eigentümer» und den alten überall sonst — in der
		 * Gemeinschaft, in der Anwesenheitsliste, im Protokollentwurf. Gefunden hat
		 * es die Nachprüfung, nachdem ich «Person ändern ✓» gemeldet hatte.
		 *
		 * **Nur wo der Name nicht eigenständig gepflegt ist.** Eine Partei darf
		 * anders heissen als ihre Person — «Erbengemeinschaft Müller» neben «Hans
		 * Müller». Deshalb wird nur ersetzt, was dem ALTEN Personennamen entspricht;
		 * alles andere hat jemand bewusst so geschrieben.
		 *
		 * **Momentaufnahmen bleiben unberührt.** `snapshot_party` trägt den Stand
		 * vom Tag der Freigabe; ihn nachzuziehen hiesse, ein Protokoll rückwirkend
		 * umzuschreiben. Wer eine alte Schreibweise dort findet, soll sie im
		 * Verlauf zuordnen können — dafür steht der alte Name im Eintrag unten.
		 */
		await tx`
			UPDATE party SET display_name = ${name}, updated_at = now()
			 WHERE person_id = ${personId} AND display_name = ${vorher.display_name}
		`;

		/*
		 * **Der alte Name gehört in den Verlauf**, nicht nur der neue. Wer später
		 * ein Protokoll von damals liest, findet dort eine Schreibweise, die es
		 * heute nicht mehr gibt — und muss sie zuordnen können.
		 */
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.personGeaendert,
				{ art: 'person', id: personId },
				{ name, vorher: vorher.display_name }
			)
		);
		return ausDb(z);
	});
}

/** Eine Eigentümerzeile, die noch keiner Person zugeordnet ist. */
export interface UnverknuepftePartei {
	parteiId: Id;
	name: string;
	stwegId: Id;
	gemeinschaft: string;
	email: string | null;
}

/**
 * Eigentuemerzeilen ohne Person (22.08.2026, Befund A-04).
 *
 * **«Hier wird jeder Eigentümer einmal geführt»** steht über der Liste — und im
 * Prüflauf fand die Suche 4 von 5 Parteien. Die fünfte, ein Ehepaar, war nur als
 * `party` in ihrer Gemeinschaft erfasst und nie mit einer `person` verknüpft;
 * die Liste liest aber ausschliesslich `person`.
 *
 * **Eine Suche, die 4 von 5 findet, ist schlimmer als keine.** Sie antwortet
 * «Niemand passt zu …», wo jemand ist — und wer das liest, legt die Partei ein
 * zweites Mal an.
 *
 * Getrennt geführt statt untergemischt: Diese Zeilen haben keine Personenkennung
 * und damit keine eigene Seite. Sie führen dorthin, wo sie entstanden sind.
 *
 * **Fachlich abgegrenzt (31.08.2026, Block B1).** Die Abfrage nimmt nur noch
 * Zeilen, fuer die eine Personenklammer zulaessig ist: weder eine Huelle
 * gemeinschaftlichen Eigentums (`is_community = true`) noch eine Gemeinschaft als
 * Eigentuemerin (`kind = 'gemeinschaft'`).
 */
/**
 * Nur die Bemerkung einer Person setzen (23.08.2026, Prüflauf I, A-12).
 *
 * **Warum eine eigene Funktion und nicht `aenderePerson`.** Die schreibt Name,
 * E-Mail, Telefon und Adresse mit — wer sie mit einer blossen Bemerkung
 * aufriefe, leerte alles andere. Genau dieser Fehler steckte am selben Tag im
 * Berichtigen der Eigentümerangaben, und er war unsichtbar
 * (`{...bisher, ...geprueft}` überschreibt auch mit `undefined`).
 *
 * **Warum sie hier gebraucht wird.** Der Befund verlangte ein Bemerkungsfeld
 * je Eigentümer und sagte gleich, wohin es gehört: «Vera Probemann kommt nie und
 * bevollmächtigt jedes Jahr denselben Nachbarn — das gehört an die Person.»
 * Die Bemerkung an der Person gibt es seit je; sie stand nur auf der
 * Personenseite, und dorthin kommt niemand, der gerade Eigentümer erfasst. Neu
 * ist allein, dass die Eigentümerzeile sie zeigt und schreiben lässt — dieselbe
 * Bemerkung, an zwei Orten erreichbar, nicht zwei Bemerkungen.
 */
export async function setzePersonenbemerkung(
	handelnder: Handelnder & { operatorId: Id },
	personId: Id,
	bemerkung: string | null
): Promise<void> {
	const text = bemerkung?.trim() || null;
	if (text && zeichenzahl(text) > 500) {
		throw new FachlicherFehler(
			'bemerkung_zu_lang',
			'Die Bemerkung ist länger als 500 Zeichen. Sie ist eine Notiz, keine Akte.',
			'bemerkung'
		);
	}

	await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<{ id: string; note: string | null }[]>`
			SELECT id, note FROM person WHERE id = ${personId}
		`;
		if (!vorher) throw new FachlicherFehler('unbekannt', 'Diese Person gibt es nicht.', 'personId');
		if ((vorher.note ?? null) === text) return;

		await tx`UPDATE person SET note = ${text}, updated_at = now() WHERE id = ${personId}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.personGeaendert, { art: 'person', id: personId }, {
				felder: ['bemerkung']
			})
		);
	});
}

export async function holeUnverknuepfteParteien(
	operatorId: Id,
	/**
	 * Ohne Vorgabe wie die uebrigen Lesewege (25.08.2026). Die Liste bietet
	 * Zeilen zum Verknuepfen an — eine archivierte gehoert nicht dazu, und ohne
	 * Filter zaehlte sie ausserdem gegen «die Liste ist leer», so dass der
	 * Archivhinweis der Personenseite ausblieb.
	 */
	sicht: Sicht
): Promise<UnverknuepftePartei[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ party_id: string; display_name: string; stweg_id: string; stweg_name: string; email: string | null }[]
		>`
			SELECT p.id AS party_id, p.display_name, p.stweg_id, s.name AS stweg_name, p.email
			  FROM party p JOIN stweg s ON s.id = p.stweg_id
			 WHERE p.person_id IS NULL
			   AND NOT p.is_community
			   AND p.kind <> 'gemeinschaft'
			 ${sicht === 'aktiv' ? tx`AND p.archived_at IS NULL AND stweg_archiv_wegen(p.stweg_id) IS NULL` : tx``}
			 ORDER BY p.display_name
		`;
		return zeilen.map((z) => ({
			parteiId: z.party_id,
			name: z.display_name,
			stwegId: z.stweg_id,
			gemeinschaft: z.stweg_name,
			email: z.email
		}));
	});
}


/**
 * Löscht eine Person — samt ihren leeren Eigentümerzeilen.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Personen sollen eine Löschung bekommen,
 * wenn sie keiner Einheit zugeordnet sind.» Bis dahin liess sich eine Person
 * nur archivieren; eine versehentlich doppelt erfasste blieb für immer im
 * Bestand, bloss aus dem Weg geräumt.
 *
 * **Warum die Zeilen mitgehen müssen.** `party.person_id` steht auf `RESTRICT`
 * — solange eine Eigentümerzeile auf die Person zeigt, weist die Datenbank das
 * Löschen ab. Wer «Eigentümer erfassen» benutzt, legt Person und Zeile in einem
 * Zug an; genau der häufigste Fall (die versehentlich erfasste Person) hätte
 * sonst gar keinen Weg. Genannt werden sie in der Rückfrage.
 *
 * **Die Schranke ist dieselbe wie beim Tilgen einer Zeile**, angewandt auf
 * jede: keine Zuordnung (auch keine beendete — sie ist Teil der
 * Eigentümergeschichte), keine Teilnahme an einer Versammlung, keine Weisung,
 * kein Traktandum, keine Mitberechtigung an gemeinschaftlichem Eigentum und
 * keine Vertretung einer solchen (Migration 094). Eine Person, deren Zeile je in einer Momentaufnahme stand,
 * ist damit unlöschbar, und das ist richtig: Ein Protokoll darf nicht ins Leere
 * zeigen. Der Weg für sie heisst archivieren.
 *
 * Anders als beim Archivieren zählt hier **jede** Zuordnung, nicht nur die
 * heute laufende. Archivieren nimmt nichts weg und darf deshalb grosszügiger
 * sein; Löschen ist endgültig.
 */
export async function entfernePerson(
	handelnder: Handelnder & { operatorId: string },
	personId: Id
): Promise<{ name: string; zeilen: string[] }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [person] = await tx<{ display_name: string }[]>`
			SELECT display_name FROM person WHERE id = ${personId}
		`;
		if (!person) {
			throw new FachlicherFehler('unbekannt', 'Diese Person gibt es nicht.', 'id');
		}

		const zeilen = await tx<{ id: string; display_name: string; stweg_name: string }[]>`
			SELECT p.id, p.display_name, s.name AS stweg_name
			  FROM party p JOIN stweg s ON s.id = p.stweg_id
			 WHERE p.person_id = ${personId}
			 ORDER BY s.name, p.display_name
		`;

		for (const z of zeilen) {
			await pruefeZeileTilgbar(tx, z.id, `${z.display_name} (${z.stweg_name})`);
		}

		for (const z of zeilen) {
			await tx`DELETE FROM party WHERE id = ${z.id}`;
		}
		await tx`DELETE FROM person WHERE id = ${personId}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.personGeloescht,
				{ art: 'person', id: personId },
				{
					name: person.display_name,
					zeilen: zeilen.map((z) => `${z.display_name} (${z.stweg_name})`)
				}
			)
		);

		return {
			name: person.display_name,
			zeilen: zeilen.map((z) => `${z.display_name} (${z.stweg_name})`)
		};
	});
}
