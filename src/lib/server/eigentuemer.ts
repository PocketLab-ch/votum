/**
 * Datenzugriff auf Eigentümer und Eigentum (Story 1.6).
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { verlangeStichtag } from './stichtag';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import {
	aendereEigentuemer,
	kopfgewicht,
	legeEigentuemerAn,
	type Eigentuemer,
	type EigentuemerEingabe
} from '$lib/domain/eigentuemer';
import { kopfstimmenErklaerung, stimmkraftliste } from '$lib/domain/stimmkraft';
import { STAMMQUOTE } from '$lib/domain/einheiten';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { pruefeMitberechtigte, sammelname } from '$lib/domain/mitberechtigte';
import { parteiAusPerson, schreibeKlammer, schreibePerson } from './personen';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { planeZuordnung, type Aenderungsplan, type Zuordnung } from '$lib/domain/historie';
import { kalendertag, istKalendertag } from '$lib/domain/datum';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { HeadCountMode, Id, PartyKind, Snapshot, SnapshotParty, Stichentscheid, UnitKind } from '$lib/domain/types';
import type { Sicht } from '$lib/domain/archivieren';

interface PartyZeile {
	id: string;
	stweg_id: string;
	kind: PartyKind;
	display_name: string;
	representative_name: string | null;
	representative_party_id: string | null;
	is_community: boolean;
	member_stweg_id: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	authentik_subject: string | null;
	archived_at: Date | null;
	archived_note: string | null;
}

function ausDb(z: PartyZeile): Eigentuemer {
	return {
		id: z.id,
		stwegId: z.stweg_id,
		kind: z.kind,
		displayName: z.display_name,
		representativeName: z.representative_name,
		isCommunity: z.is_community,
		memberStwegId: z.member_stweg_id,
		email: z.email ?? undefined,
		phone: z.phone ?? undefined,
		address: z.address ?? undefined,
		authentikSubject: z.authentik_subject,
		archiviertAm: z.archived_at?.toISOString() ?? null,
		archivnotiz: z.archived_note
	};
}

/**
 * Die Eigentümerzeilen einer Gemeinschaft — vorgabemässig **ohne** die
 * archivierten (Migration 086).
 *
 * **Wozu das hier gebraucht wird.** Der Eigentumswechsel ist zeitlich schon
 * abgebildet (`unit_ownership.valid_to`): Wer 2022 verkauft hat, taucht in der
 * Stimmkraft eines späteren Datums nicht mehr auf. Die **Zeile** aber blieb für
 * immer in der Liste stehen — und entfernen liess sie sich nicht, sobald eine
 * Momentaufnahme, eine Weisung oder ein Ausstand daran hing. Zu Recht: Der
 * Nachweis darf nicht ins Leere zeigen. Genau dieser Fall braucht das Archiv.
 *
 * `'alle'` gehört dorthin, wo nachgeschlagen wird — Protokoll, Auswertung,
 * Verlauf und die Momentaufnahme, die ohnehin ihre eigene Kopie führt.
 */
export async function holeEigentuemer(
	operatorId: Id,
	stwegId: Id,
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
): Promise<Eigentuemer[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<PartyZeile[]>`
			SELECT * FROM party
			WHERE stweg_id = ${stwegId}
			  AND ${sicht === 'aktiv' ? tx`archived_at IS NULL` : tx`true`}
			ORDER BY display_name
		`;
		return zeilen.map(ausDb);
	});
}

export async function erstelleEigentuemer(
	handelnder: Handelnder & { operatorId: string },
	eingabe: EigentuemerEingabe
): Promise<Eigentuemer> {
	return alsBetreiber(handelnder.operatorId, (tx) => schreibeZeile(tx, handelnder, eingabe));
}

/** Eine Zeile der Erfassungsmaske: eine Person, die mitberechtigt ist. */
export interface MitberechtigtenEingabe {
	name: string;
	email: string | null;
	/**
	 * Die Telefonnummer (27.08.2026).
	 *
	 * **Der Grund ist die Gleichrangigkeit.** `party` trägt `phone`, der Zweig
	 * für eine einzelne Person erfasst es, und der Berichtigungsweg je
	 * Mitberechtigtem führt es ebenfalls. Es fehlte allein beim Erfassen der
	 * Personenliste — dieselbe Person bekam je nach Eigentumsform verschieden
	 * viel erfasst.
	 */
	telefon?: string | null;
	adresse: string | null;
	/**
	 * Eine bereits erfasste **Person** statt einer neu getippten (27.08.2026).
	 *
	 * **Der Anlass** (der Auftraggeber beim Durchsehen): Die Liste nahm nur Namen entgegen
	 * und legte deshalb **immer** neue Zeilen an. Stand A schon irgendwo, entstand
	 * ein zweites A — formal zwei verschiedene Menschen, von der Datenbank nicht
	 * abgefangen, und am Versammlungstag erkennt niemand mehr, dass es derselbe
	 * ist.
	 *
	 * Ist das Feld gesetzt, entsteht die Mitgliedszeile über `parteiAusPerson`.
	 * Das deckt beide Fälle mit einer Regel:
	 *
	 *   * **Die Person steht in einer anderen Gemeinschaft.** Hier entsteht eine
	 *     neue Zeile, verknüpft mit derselben `person` — ein Einlass für alle,
	 *     kein Duplikat.
	 *   * **Die Person steht in dieser Gemeinschaft.** Dann wird **ihre**
	 *     bestehende Zeile mitberechtigt; `party_person_je_gemeinschaft` lässt
	 *     ohnehin nur eine je Gemeinschaft zu.
	 *
	 * Der Name kommt dann von der Person und nicht aus dem Formular.
	 */
	personId?: Id | null;
	/**
	 * Eine bereits bestehende **Eigentümerzeile** dieser Gemeinschaft.
	 *
	 * Für «Miteigentum eintragen» (`trageMiteigentumEin`): Dort ist A schon da,
	 * hält die Einheit und soll mit Anschrift, Zugang und Vorgeschichte
	 * weiterleben. Über `personId` ginge das nicht — eine Zeile aus der Übernahme
	 * trägt gar keine Personenklammer.
	 */
	parteiId?: Id | null;
}

/**
 * Legt eine gemeinschaftliche Zeile samt ihren Mitberechtigten an.
 *
 * **In einer Transaktion, weil ein Teilerfolg schlimmer wäre als ein
 * Misserfolg.** Bräche es nach der Hülle ab, stünde eine Zeile da, die
 * «Gemeinschaftliches Eigentum» behauptet und niemanden enthält — und die
 * Einladung ginge an eine E-Mail-Adresse, die es dort gar nicht gibt.
 *
 * Die Mitberechtigten sind gewöhnliche Eigentümerzeilen **ohne Einheit**. Sie
 * tragen damit von selbst null Kopfstimmen (`stimmkraft()`), und am Stimmrecht
 * ändert sich nichts: Die eine Stimme hängt an der Hülle, die die Einheit hält.
 *
 * **Jede Zeile kommt über `legeEigentuemerAn`** und nicht über ein rohes
 * `INSERT` (beim Umsetzen abgewichen, der Plan sah rohe Einfügungen vor). Sonst
 * entstünden `1 + n` Eigentümerzeilen ohne einen einzigen Verlaufseintrag, und
 * die Namensprüfung — mindestens zwei, höchstens 200 Zeichen — fiele für die
 * Mitberechtigten aus.
 */
export async function erstelleGemeinschaftlicheZeile(
	handelnder: Handelnder & { operatorId: string },
	eingabe: GemeinschaftlicheZeile
): Promise<{ huelle: Id; name: string; mitglieder: Id[] }> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		schreibeGemeinschaftlicheZeile(tx, handelnder, eingabe)
	);
}

/** Was eine gemeinschaftliche Zeile zum Entstehen braucht. */
export interface GemeinschaftlicheZeile {
	stwegId: Id;
	/** Die Art der Hülle. Die Mitberechtigten sind stets Menschen. */
	kind: PartyKind;
	personen: MitberechtigtenEingabe[];
	/** Welche der Personen die Stimme ausübt — Stellung in `personen`. */
	vertreterIndex: number;
	/**
	 * Der Name der Hülle, wenn ihn eine andere Stelle vorgibt (27.08.2026,
	 * Aufgabe 6).
	 *
	 * Die Erfassungsmaske lässt ihn weg — dort entsteht er aus den Personen. Die
	 * Übernahme aus einer Datei gibt ihn mit: Steht dort eine Spalte
	 * `display_name`, ist sie die Ansage des Menschen, der die Datei geschrieben
	 * hat («Erbengemeinschaft Muster»), und sie zu übergehen hiesse, sie bei
	 * jedem Lauf aufs Neue zu überschreiben.
	 */
	bezeichnung?: string | null;
	/** Fremdkennung aus der Datei, damit ein zweiter Lauf dieselbe Zeile wiederfindet. */
	importRef?: string | null;
	/** Die Authentik-Kennung der Hülle, sofern die Datei eine mitbringt. */
	authentikSubject?: string | null;
}

/**
 * Dieselbe Eigentümerzeile darf nur einmal Mitglied derselben Hülle sein.
 *
 * **Der Anlass** (27.08.2026, aus dem Code-Review). `party_member_einmalig`
 * hält das in der Datenbank, aber als roher Schlüsselbruch. Erreichbar ist der
 * Fall über zwei Wege, die auf dieselbe Zeile zeigen: «Miteigentum eintragen»
 * nennt A's Zeile ausdrücklich und liesse zusätzlich A's **Person** in der Liste
 * darunter wählen. `pruefeMitberechtigte` fängt das nur, wenn beide Namen
 * gleich lauten — und die dürfen auseinanderlaufen («M. Probère» gegen «Markus
 * Probère»), weil `schreibeKlammer` verknüpft, ohne umzubenennen.
 */
function nimmEinmal(bisher: Id[], parteiId: Id, name: string): Id {
	if (bisher.includes(parteiId)) {
		throw new FachlicherFehler(
			'zeile_doppelt',
			`«${name}» steht zweimal in dieser Liste. Zweimal dieselbe Person hiesse zwei Einladungen an dieselbe Adresse.`,
			'mitberechtigte'
		);
	}
	return parteiId;
}

/**
 * Darf diese bestehende Zeile Mitglied einer Hülle werden?
 *
 * Die Datenbank hält dieselben vier Zusagen (Migration 094: `…_stweg_fk`,
 * `…_mitglied_ist_keine_huelle`). Hier stehen sie nochmals, weil eine Absage im
 * Formular einen Satz braucht und keine Schrankenmeldung — und weil die
 * archivierte Zeile von keiner Schranke erfasst wird.
 */
async function pruefeZeileAlsMitglied(
	tx: postgres.TransactionSql,
	parteiId: Id,
	stwegId: Id
): Promise<{ display_name: string }> {
	const [zeile] = await tx<
		{
			display_name: string;
			stweg_id: string;
			is_community: boolean;
			kind: PartyKind;
			archived_at: Date | null;
		}[]
	>`
		SELECT display_name, stweg_id, is_community, kind, archived_at
		  FROM party WHERE id = ${parteiId}
	`;
	if (!zeile) {
		throw new FachlicherFehler(
			'zeile_unbekannt',
			'Diese Eigentümerzeile gibt es nicht. Laden Sie die Eigentümerliste neu.',
			'mitberechtigte'
		);
	}
	if (zeile.stweg_id !== stwegId) {
		throw new FachlicherFehler(
			'fremde_gemeinschaft',
			`«${zeile.display_name}» gehört zu einer anderen Gemeinschaft. Legen Sie die Person in dieser Gemeinschaft an.`,
			'mitberechtigte'
		);
	}
	if (zeile.is_community) {
		throw new FachlicherFehler(
			'mitglied_ist_huelle',
			`«${zeile.display_name}» ist selbst gemeinschaftliches Eigentum. Nehmen Sie die einzelnen Personen auf, nicht eine zweite Hülle.`,
			'mitberechtigte'
		);
	}
	if (zeile.kind === 'gemeinschaft') {
		throw new FachlicherFehler(
			'mitglied_ist_gemeinschaft',
			`«${zeile.display_name}» ist der Anteil einer anderen Gemeinschaft. Mitberechtigt an einer Einheit sind Menschen.`,
			'mitberechtigte'
		);
	}
	if (zeile.archived_at) {
		throw new FachlicherFehler(
			'mitglied_archiviert',
			`«${zeile.display_name}» liegt im Archiv. Holen Sie die Zeile zuerst hervor.`,
			'mitberechtigte'
		);
	}
	return { display_name: zeile.display_name };
}

/**
 * Dieselbe Arbeit in einer **laufenden** Transaktion.
 *
 * **Wozu getrennt** (27.08.2026, Aufgabe 6). `fuehreUebernahmeAus` schreibt
 * eine ganze Datei in einer Transaktion. Riefe sie `erstelleGemeinschaftlicheZeile`
 * auf, öffnete `alsBetreiber` eine **zweite** auf einer anderen Verbindung: Die
 * Hülle bliebe stehen, wenn die Übernahme danach abbricht — und die
 * Mandantengrenze käme aus einem zweiten `SET LOCAL`, das mit der ersten nichts
 * zu tun hat. Beides ist genau die Art Fehler, gegen die die Transaktion da ist.
 */
export async function schreibeGemeinschaftlicheZeile(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	eingabe: GemeinschaftlicheZeile
): Promise<{ huelle: Id; name: string; mitglieder: Id[] }> {
	/*
	 * **Die leeren Zeilen fallen als Ganzes weg, nicht spaltenweise** (beim
	 * Umsetzen berichtigt). Der Plan filterte allein die Namensliste und griff
	 * danach mit demselben Zähler auf `emails[i]` und `adressen[i]` zu. Bleibt
	 * die erste Zeile leer und die zweite gefüllt, verschiebt sich alles um eins:
	 * Die zweite Person bekäme die E-Mail-Adresse der ersten — und der Vertreter
	 * wäre jemand anderes als der angekreuzte.
	 */
	const roh = eingabe.personen.map((p, i) => ({
		...p,
		name: p.name.trim(),
		personId: p.personId?.trim() || null,
		parteiId: p.parteiId?.trim() || null,
		vertritt: i === eingabe.vertreterIndex
	}));

	/*
	 * **Der Name einer gewählten Person kommt von ihr** (27.08.2026).
	 *
	 * Er wird hier aufgelöst und nicht später: Aus den Namen entsteht der
	 * Sammelname der Hülle, und `pruefeMitberechtigte` misst an ihnen die
	 * Mindestzahl und die Doppelung. Bliebe das Feld leer, fiele die gewählte
	 * Person durch den Filter darunter — die Hülle hiesse nach einer Person
	 * weniger, und wer zwei Bestehende wählt, bekäme «zu wenige Mitberechtigte»
	 * mit zwei ausgefüllten Zeilen vor Augen.
	 */
	for (const p of roh) {
		if (p.parteiId) {
			const zeile = await pruefeZeileAlsMitglied(tx, p.parteiId, eingabe.stwegId);
			p.name = zeile.display_name;
		} else if (p.personId) {
			const [person] = await tx<{ display_name: string; archived_at: Date | null }[]>`
				SELECT display_name, archived_at FROM person WHERE id = ${p.personId}
			`;
			if (!person) {
				throw new FachlicherFehler(
					'person_unbekannt',
					'Diese Person gibt es nicht. Laden Sie die Seite neu.',
					'mitberechtigte'
				);
			}
			if (person.archived_at) {
				throw new FachlicherFehler(
					'person_archiviert',
					`«${person.display_name}» liegt im Archiv. Holen Sie die Person zuerst hervor. Wer archiviert ist, hält keine Einheiten.`,
					'mitberechtigte'
				);
			}
			p.name = person.display_name;
		}
	}

	const zeilen = roh.filter((p) => p.name.length > 0);

	const namen = zeilen.map((p) => p.name);
	const vertreterName = zeilen.find((p) => p.vertritt)?.name ?? null;
	pruefeMitberechtigte(namen, vertreterName);

	/*
	 * **Eine juristische Hülle braucht die Vertretung weiterhin** (27.08.2026).
	 *
	 * Seit heute ist sie bei gemeinschaftlichem Eigentum freiwillig; für eine
	 * juristische Person und eine Mitgliedsgemeinschaft bleibt sie Pflicht, und
	 * `party_vertretung_bei_juristisch` hält das auch in der Datenbank. Ohne
	 * diesen Satz käme dort die Absage aus `pruefeEigentuemer` heraus und zeigte
	 * auf ein Feld `representativeName`, das die Personenliste gar nicht führt.
	 */
	if (eingabe.kind !== 'natural' && !vertreterName) {
		throw new FachlicherFehler(
			'vertretung_fehlt',
			'Eine juristische Person handelt nie selbst. Kreuzen Sie an, wer die Stimme ausübt.',
			'vertreter'
		);
	}

	const vorgegeben = eingabe.bezeichnung?.trim() ?? '';
	const bezeichnung = vorgegeben || sammelname(namen);
	/*
	 * Die Maske hat kein Namensfeld für die Hülle — der Name entsteht aus den
	 * Personen. Ohne diese Absage käme die Längenschranke aus `pruefeEigentuemer`
	 * heraus und zeigte auf ein Feld `displayName`, das es auf der Seite nicht
	 * gibt.
	 *
	 * **Nur für den abgeleiteten Namen** (27.08.2026): Gibt eine Datei den Namen
	 * vor, gibt es das Feld sehr wohl — dann ist die Absage aus
	 * `pruefeEigentuemer` die richtige, weil sie auf `display_name` zeigt.
	 */
	if (!vorgegeben && zeichenzahl(bezeichnung) > 200) {
		throw new FachlicherFehler(
			'sammelname_zu_lang',
			'Der Name der Zeile entsteht aus den Personen und wäre länger als 200 Zeichen. Kürzen Sie die Namen — Vorname und Nachname genügen.',
			'mitberechtigte'
		);
	}

	/*
	 * **Erst die Personen, dann die Hülle** (beim Umsetzen berichtigt; der
	 * Plan legte die Hülle zuerst an).
	 *
	 * Migration 006 hält an `party` die Schranke
	 * `party_vertreter_bei_gemeinschaft`: Eine gemeinschaftliche Zeile braucht
	 * einen Vertreternamen von mindestens zwei Zeichen. Entstünde die Hülle
	 * zuerst, schlüge bei einem Namen wie «A» diese Schranke roh zu — als 500
	 * ohne Satz. In dieser Reihenfolge spricht vorher `pruefeEigentuemer` mit
	 * «Der Name fehlt oder ist zu kurz» an, und zwar für die Zeile, die es
	 * betrifft.
	 */
	const mitglieder: Id[] = [];
	for (const person of zeilen) {
		/*
		 * **Eine bestehende Zeile wird selbst mitberechtigt** (27.08.2026).
		 * Kein zweiter Eintrag, keine zweite Person: Sie behält Anschrift,
		 * Zugang und Eigentümergeschichte. Geprüft ist sie oben beim Auflösen
		 * des Namens.
		 */
		if (person.parteiId) {
			mitglieder.push(nimmEinmal(mitglieder, person.parteiId, person.name));
			continue;
		}

		/*
		 * **Eine gewählte Person bekommt genau eine Zeile je Gemeinschaft.**
		 * `parteiAusPerson` gibt die bestehende zurück, wenn es sie hier schon
		 * gibt, und legt sonst eine an. Damit ist der Doppelgänger ausgeschlossen,
		 * gegen den dieser Weg gebaut wurde.
		 */
		if (person.personId) {
			const zeile = await parteiAusPerson(handelnder, tx, person.personId, eingabe.stwegId);
			await pruefeZeileAlsMitglied(tx, zeile.id, eingabe.stwegId);
			mitglieder.push(nimmEinmal(mitglieder, zeile.id, person.name));
			continue;
		}

		// **`natural`, auch wenn die Hülle juristisch ist.** Mitberechtigt an
		// Mit- oder Gesamteigentum sind Menschen; und `pruefeEigentuemer`
		// verlangte von einer juristischen Zeile eine vertretungsberechtigte
		// Person, die es hier nicht gibt.
		const mitglied = await schreibeZeile(tx, handelnder, {
			stwegId: eingabe.stwegId,
			kind: 'natural',
			displayName: person.name,
			representativeName: null,
			isCommunity: false,
			email: person.email ?? undefined,
			phone: person.telefon ?? undefined,
			address: person.adresse ?? undefined
		}).catch((fehler: unknown) => {
			/*
			 * **Die Absage muss sagen, WELCHE Person gemeint ist** (26.08.2026,
			 * aus dem Code-Review). `pruefeEigentuemer` benennt die Felder
			 * `displayName` und `email` — die Maske führt dort aber je Person
			 * ein `mitberechtigterName`. Wer bei der dritten «A» tippt, läse
			 * sonst «Der Name fehlt oder ist zu kurz» ohne einen Hinweis, wo.
			 *
			 * Übersetzt wird nur die Anschrift, nicht der Grund: Der Satz aus
			 * dem Kern bleibt wörtlich stehen, davor kommt die Stellung.
			 */
			if (fehler instanceof FachlicherFehler) {
				throw new FachlicherFehler(
					fehler.kennung,
					`${zeilen.indexOf(person) + 1}. Person: ${fehler.message}`,
					'mitberechtigte'
				);
			}
			throw fehler;
		});

		/*
		 * **Die Personenklammer gleich mit** (Produktentscheid 26.08.2026;
		 * Aufgabe 3 hatte sie vergessen).
		 *
		 * `person` beantwortet die eine Frage, die sich sonst nicht beantworten
		 * lässt: Ist der Mensch hier derselbe wie dort. Ein Mitberechtigter wird
		 * einzeln angeschrieben (Wermelinger, Rz. 50 ad Art. 712n) und darf an der Versammlung
		 * teilnehmen; ohne Klammer wäre er die einzige Eigentümerzeile, die über
		 * die Gemeinschaften hinweg unsichtbar bleibt.
		 *
		 * **Und sie trägt den Doppelfall.** `party_person_je_gemeinschaft` lässt
		 * je Gemeinschaft **eine** Zeile pro Person zu. Mit Klammer wird aus
		 * «Anna hält Whg 1» und «Anna ist mitberechtigt an Whg 2» genau eine
		 * Zeile; ohne Klammer werden es zwei, mit zwei Kopfstimmen, wo ihr eine
		 * zusteht.
		 *
		 * **Die Schranke steht dem nicht im Weg.**
		 * `party_person_nur_bei_einzelnen` (Migration 029) lautet
		 * `person_id IS NULL OR (kind <> 'gemeinschaft' AND is_community = false)`
		 * — sie verbietet die Klammer der **Hülle**, nicht den Mitgliedern. Die
		 * Hülle bekommt hier folgerichtig keine.
		 *
		 * **Immer eine neue Person, nie eine gleichnamige bestehende.** Genauso
		 * macht es der Weg «Eigentümer erfassen» für eine einzelne Zeile: «M.
		 * Probère» und «Markus Probère» sind für die Datenbank zwei Menschen, und
		 * ein geratener Abgleich gäbe irgendwann einem Fremden eine Stimme
		 * (Migration 029).
		 *
		 * **Was das kostet, ausdrücklich** (26.08.2026, aus dem Code-Review):
		 * «Dieselbe Person?» auf der Eigentümerseite schlägt nur Zeilen **ohne**
		 * Personenklammer vor (`verknuepfungsvorschlaege` überspringt
		 * `partei.personId`). Diese Zeilen erscheinen dort also nie — sie sind
		 * ja schon geklammert. Wer zwei Personenzeilen desselben Menschen
		 * zusammenführen will, hat dafür heute keinen Weg; das gilt gleichermassen
		 * für jede über «Eigentümer erfassen» angelegte Zeile und ist keine Folge
		 * dieser Aufgabe. Gemeldet, nicht nebenbei gebaut.
		 */
		const klammer = await schreibePerson(tx, handelnder, {
			art: 'natural',
			name: person.name,
			email: person.email,
			telefon: person.telefon ?? null,
			adresse: person.adresse
		});
		await schreibeKlammer(tx, handelnder, mitglied.id, klammer.id);

		mitglieder.push(mitglied.id);
	}

	const huelle = await schreibeZeile(
		tx,
		handelnder,
		{
			stwegId: eingabe.stwegId,
			kind: eingabe.kind,
			displayName: bezeichnung,
			representativeName: vertreterName,
			isCommunity: true
		},
		{ importRef: eingabe.importRef, authentikSubject: eingabe.authentikSubject }
	);

	for (const [i, person] of zeilen.entries()) {
		await tx`
			INSERT INTO party_member (operator_id, stweg_id, huelle_party_id, mitglied_party_id)
			VALUES (${handelnder.operatorId}, ${eingabe.stwegId}, ${huelle.id}, ${mitglieder[i]})
		`;
		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.mitberechtigterAufgenommen,
				{ art: 'party', id: huelle.id },
				{ mitglied: mitglieder[i], name: person.name, huelle: bezeichnung }
			)
		]);
	}

	/*
	 * **Der Verweis zuletzt.** Seit Migration 095 hält
	 * `party_vertreter_ist_mitglied` dagegen, solange der Vertreter nicht in
	 * `party_member` steht — die Reihenfolge ist damit keine Stilfrage mehr.
	 *
	 * **`null`, wenn niemand bezeichnet ist** (27.08.2026). `findIndex` gibt
	 * dann −1, und `mitglieder[-1]` ist `undefined`; ausdrücklich auf `null`
	 * gebracht, weil `undefined` in einer Abfrage nichts zu suchen hat. Der
	 * zusammengesetzte Fremdschlüssel ist mit `NULL` in einer Spalte erfüllt
	 * (MATCH SIMPLE), die Schranke bleibt für den besetzten Fall wirksam.
	 */
	const vertreterId = mitglieder[zeilen.findIndex((p) => p.vertritt)] ?? null;
	await tx`
		UPDATE party SET representative_party_id = ${vertreterId} WHERE id = ${huelle.id}
	`;

	return { huelle: huelle.id, name: bezeichnung, mitglieder };
}

/** Was «Miteigentum eintragen» braucht. */
export interface MiteigentumEingabe {
	stwegId: Id;
	/** Die Zeile, die die Einheit heute allein hält. Sie wird mitberechtigt. */
	bisherigeZeile: Id;
	/** Welche ihrer Einheiten auf die Hülle wandern. Mindestens eine. */
	einheiten: Id[];
	/** Wer dazukommt: neu erfasst oder eine bereits erfasste Person. */
	weitere: MitberechtigtenEingabe[];
	/** Wer die Stimme ausübt. 0 ist die bisherige Zeile, 1..n sind `weitere`. */
	vertreterIndex: number;
	/** Ab wann die Einheit der Gemeinschaft gehört. */
	ab: string;
}

/**
 * Aus Alleineigentum wird gemeinschaftliches Eigentum, **ab einem Datum**.
 *
 * **Der Auftrag im Wortlaut** (Auftraggeber, 27.08.2026): «wenn A eine Einheit hat und
 * nach einem Jahr B heiratet und Miteigentümerin wird, müsste ich dies ja ohne
 * grossen Aufwand nachführen können.»
 *
 * **Das ist eine Handänderung, keine Korrektur.** Die Vorgeschichte bleibt
 * deshalb unangetastet: In `unit_ownership` steht weiter «A allein, ab 2020»,
 * beendet auf den Stichtag; ab dem Stichtag hält die Hülle. Eine Versammlung von
 * 2024 zeigt danach weiterhin A allein mit seiner Stimme — das ist die
 * Zusicherung, an der hier alles hängt, und sie steht als Test in
 * `tests/db/mitberechtigte.test.ts`.
 *
 * **A bekommt keine zweite Zeile.** `party_person_je_gemeinschaft` hält eine
 * Person je Gemeinschaft auf genau einer Zeile; und selbst ohne diese Schranke
 * wäre eine zweite falsch — A behält Anschrift, Zugang und Geschichte.
 *
 * **Warum der Weg an A's Zeile steht und nicht im Anlegen-Formular.** Dort steht
 * unter «Einheit gleich zuordnen» nur, was am Stichtag **keinen** Eigentümer hat
 * (`stimmkraftAnsicht().einheitenOhneEigentuemer`). A's Wohnung ist dort
 * folgerichtig nicht zu finden, und ein zweiter Weg mit allen Einheiten wäre
 * genau der stille Eigentümerwechsel, den die Anwendung sonst überall mit Datum
 * verlangt.
 *
 * **In einer Transaktion.** Ein Abbruch zwischen Hülle und Zuordnung hinterliesse
 * eine gemeinschaftliche Zeile ohne Einheit, während die Einheit weiter an A
 * hinge — sichtbar erst am Versammlungstag.
 */
export async function trageMiteigentumEin(
	handelnder: Handelnder & { operatorId: string },
	eingabe: MiteigentumEingabe
): Promise<{ huelle: Id; name: string; mitglieder: Id[] }> {
	if (!istKalendertag(eingabe.ab)) {
		throw new FachlicherFehler('datum_ungueltig', 'Das Datum «gültig ab» fehlt.', 'ab');
	}
	if (eingabe.einheiten.length === 0) {
		throw new FachlicherFehler(
			'keine_einheit',
			'Wählen Sie mindestens eine Einheit, die künftig der Gemeinschaft gehört.',
			'unitId'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const bisherige = await pruefeZeileAlsMitglied(tx, eingabe.bisherigeZeile, eingabe.stwegId);

		/*
		 * **Die Einheit muss dieser Zeile am Stichtag gehören.** Sonst entstünde
		 * hier ein Eigentümerwechsel, den niemand gemeint hat: Die Maske zeigt die
		 * Einheiten von A, aber die Kennung kommt aus einem Formularfeld. Und ohne
		 * die Prüfung wäre die Absage aus `planeZuordnung` («keine Lücke») die
		 * einzige Rückmeldung — richtig gerechnet und am Fall vorbei.
		 */
		for (const unitId of eingabe.einheiten) {
			const [gehalten] = await tx<{ label: string; valid_from: Date }[]>`
				SELECT u.label, o.valid_from
				  FROM unit_ownership o
				  JOIN unit u ON u.id = o.unit_id
				 WHERE o.unit_id = ${unitId}
				   AND o.party_id = ${eingabe.bisherigeZeile}
				   AND o.valid_from <= ${eingabe.ab}
				   AND (o.valid_to IS NULL OR o.valid_to > ${eingabe.ab})
			`;
			if (!gehalten) {
				/*
				 * **Die Absage nennt die Einheit** (27.08.2026, aus dem Code-Review).
				 * Angekreuzt sein können mehrere; «diese Einheit» sagte dann nicht,
				 * welche. Die Bezeichnung wird eigens nachgeschlagen, weil die
				 * Abfrage darüber im Fehlerfall gerade nichts liefert.
				 */
				const [einheit] = await tx<{ label: string }[]>`
					SELECT label FROM unit WHERE id = ${unitId}
				`;
				throw new FachlicherFehler(
					'einheit_nicht_gehalten',
					`«${bisherige.display_name}» hält «${einheit?.label ?? 'diese Einheit'}» am ${eingabe.ab} nicht. Prüfen Sie das Datum und die Auswahl.`,
					'unitId'
				);
			}

			/*
			 * **Der Wechsel muss NACH dem Beginn liegen** (27.08.2026, aus dem
			 * Code-Review des Versandagenten). Die Prüfung oben lässt Gleichheit zu,
			 * und `planeZuordnung` kappt nur bei **echt** früherem Beginn
			 * (`domain/historie.ts`: `b.validFrom < abStichtag`). Bei Gleichheit
			 * landet die bestehende Zuordnung in `zuEntfernen` und wird **gelöscht**.
			 *
			 * Wer aus Gewohnheit dasselbe Datum tippt, hätte danach «A allein von
			 * 2020 bis 2027» nicht mehr in `unit_ownership` — und eine Versammlung
			 * von 2024 zeigte rückwirkend die Hülle. Genau die Zusicherung, an der
			 * hier alles hängt, fiele lautlos.
			 *
			 * **Eine Absage und keine Rückfrage.** `?/zuordnen` fragt für denselben
			 * Vorgang nach, weil es dort ein gewollter Fall ist (eine falsch
			 * erfasste Zuordnung berichtigen). Hier ist er es nicht: Eine
			 * Handänderung am Tag des Erwerbs heisst, dass es die Zeit des
			 * Alleineigentums nie gab, und dann ist die Zeile von Anfang an
			 * gemeinschaftlich zu erfassen.
			 */
			const beginn = gehalten.valid_from.toISOString().slice(0, 10);
			if (beginn >= eingabe.ab) {
				throw new FachlicherFehler(
					'datum_nicht_spaeter',
					`«${gehalten.label}» gehört «${bisherige.display_name}» erst seit dem ${beginn}. Wählen Sie ein späteres Datum, sonst verschwindet die Zeit des Alleineigentums aus der Geschichte.`,
					'ab'
				);
			}
		}

		/*
		 * **Die Hülle ist `natural`.** Mitberechtigt an Mit- oder Gesamteigentum
		 * sind Menschen (ZGB Art. 712o Abs. 1); und `pruefeEigentuemer` verlangte
		 * von einer juristischen Zeile eine vertretungsberechtigte Person, die es
		 * hier nicht gibt. Dieselbe Wahl trifft `schreibeGemeinschaftlicheZeile`
		 * für ihre Mitglieder.
		 */
		const ergebnis = await schreibeGemeinschaftlicheZeile(tx, handelnder, {
			stwegId: eingabe.stwegId,
			kind: 'natural',
			personen: [
				{ name: '', email: null, adresse: null, parteiId: eingabe.bisherigeZeile },
				...eingabe.weitere
			],
			vertreterIndex: eingabe.vertreterIndex
		});

		for (const unitId of eingabe.einheiten) {
			await schreibeEigentumszuordnung(tx, handelnder, unitId, ergebnis.huelle, eingabe.ab);
		}

		return ergebnis;
	});
}

/**
 * Eine Eigentümerzeile in der laufenden Transaktion anlegen — mit Prüfung und Verlauf.
 *
 * `herkunft` trägt, was nicht zur Eingabe eines Menschen gehört, sondern zur
 * Datei, aus der die Zeile stammt: die Fremdkennung, an der ein zweiter Lauf sie
 * wiederfindet, und die Authentik-Kennung. Beides steht bewusst **nicht** in
 * `EigentuemerEingabe` — das Formular kennt weder das eine noch das andere, und
 * ein Feld, das dort erscheint, wird irgendwann auch dort gesetzt.
 */
async function schreibeZeile(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	eingabe: EigentuemerEingabe,
	herkunft?: { importRef?: string | null; authentikSubject?: string | null }
): Promise<Eigentuemer> {
	const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
	const u = legeEigentuemerAn(id, eingabe);
	const p = u.ergebnis;

	await tx`
		INSERT INTO party (id, stweg_id, operator_id, kind, display_name,
		                   representative_name, is_community, member_stweg_id,
		                   email, phone, address, import_ref, authentik_subject)
		VALUES (${p.id}, ${p.stwegId}, ${handelnder.operatorId}, ${p.kind}, ${p.displayName},
		        ${p.representativeName}, ${p.isCommunity}, ${p.memberStwegId ?? null},
		        ${p.email ?? null}, ${p.phone ?? null}, ${p.address ?? null},
		        ${herkunft?.importRef ?? null}, ${herkunft?.authentikSubject ?? null})
	`;

	return schreibeUebergang(tx, handelnder, u);
}

/**
 * Darf der Haken «Gemeinschaftliches Eigentum» noch umgelegt werden?
 *
 * **Der Anlass** (26.08.2026, beim Umsetzen von Migration 094 gemessen).
 * `bearbeiteEigentuemer` schreibt `is_community` bei **jedem** Speichern mit —
 * auch wenn niemand den Haken angefasst hat. Sobald an der Zeile
 * Mitberechtigte hängen, hält der Fremdschlüssel dagegen
 * (`party_member_huelle_fk` beziehungsweise `party_member_mitglied_fk`), und
 * was ankam, war eine rohe 500: `uebersetzeSchranke` übersetzt bewusst nur
 * 23514, 22001 und 22021, nicht 23503.
 *
 * **Abgewiesen, nicht stillschweigend mitgenommen.** Den Haken wegzunehmen und
 * die Mitgliedschaften gleich mit zu löschen sähe aus wie ein gelungenes
 * Speichern — und die Miteigentümer stünden ohne Verbindung da, ihre Einladung
 * nach ZGB Art. 712n bliebe aus, ohne dass es jemand sähe. Wer die Zeile
 * wirklich umwidmen will, löst die Zuordnungen zuerst und sieht dabei, was er
 * aufgibt.
 *
 * Beide Richtungen, denn beide brechen: Der Haken **weg** an einer Hülle mit
 * Mitgliedern, und der Haken **hin** an einer Zeile, die selbst Mitglied ist —
 * eine Hülle in der Hülle verbietet Migration 094 aus eigenem Grund.
 */
export async function pruefeHakenUmlegbar(
	tx: postgres.TransactionSql,
	parteiId: Id,
	name: string,
	neuGemeinschaftlich: boolean
): Promise<void> {
	const [zaehlung] = await tx<{ als_huelle: number; als_mitglied: number }[]>`
		SELECT (SELECT count(*) FROM party_member WHERE huelle_party_id = ${parteiId})::int
		         AS als_huelle,
		       (SELECT count(*) FROM party_member WHERE mitglied_party_id = ${parteiId})::int
		         AS als_mitglied
	`;

	if (!neuGemeinschaftlich && zaehlung.als_huelle > 0) {
		throw new FachlicherFehler(
			'huelle_hat_mitberechtigte',
			`An «${name}» hängen ${zaehlung.als_huelle} Mitberechtigte. Nehmen Sie diese zuerst ` +
				'weg; danach lässt sich «Gemeinschaftliches Eigentum» zurücknehmen.',
			'isCommunity'
		);
	}

	if (neuGemeinschaftlich && zaehlung.als_mitglied > 0) {
		throw new FachlicherFehler(
			'mitglied_wird_huelle',
			`«${name}» ist selbst mitberechtigt an gemeinschaftlichem Eigentum und kann deshalb ` +
				'keine Hülle sein. Lösen Sie diese Zuordnung zuerst.',
			'isCommunity'
		);
	}
}

export async function bearbeiteEigentuemer(
	handelnder: Handelnder & { operatorId: string },
	id: Id,
	eingabe: EigentuemerEingabe
): Promise<Eigentuemer> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **`FOR UPDATE`, seit `pruefeHakenUmlegbar` daran hängt** (26.08.2026).
		 * Die Prüfung zählt und schreibt danach — nimmt eine zweite Sitzung
		 * dazwischen einen Mitberechtigten auf, hielte wieder der Fremdschlüssel
		 * dagegen, und heraus käme die rohe 500, gegen die die Prüfung
		 * geschrieben ist. Die Sperre auf der Zeile schliesst das Fenster: Ein
		 * `INSERT INTO party_member` nimmt auf dieselbe Zeile eine
		 * Schlüsselsperre und wartet.
		 */
		const [zeile] = await tx<PartyZeile[]>`SELECT * FROM party WHERE id = ${id} FOR UPDATE`;
		if (!zeile) throw new Error('Eigentümer nicht gefunden');

		/*
		 * **Steht ein Vertreterverweis, führt er den Namen** (26.08.2026, aus der
		 * Sicherheitsprüfung).
		 *
		 * Eine gemeinschaftliche Zeile mit Mitberechtigten trägt zwei Angaben über
		 * dieselbe Sache: `representative_party_id` für die Anwendung und
		 * `representative_name` für die Urkunde. Das Formular schickt den Namen
		 * weiterhin mit — die Maske zeigt ihn dort nur noch verborgen, ein
		 * handgebauter Aufruf setzte aber jeden beliebigen Text. Unterschriftenliste
		 * und Stimmzettel nennten danach jemand anderen, als die Anwendung zählt.
		 *
		 * Deshalb gewinnt hier der Verweis. Wer die Vertretung ändern will, geht
		 * über `setzeVertretung`; das ist der Weg, den auch die Absage in
		 * `entferneMitberechtigten` nennt.
		 */
		let vertreterName = eingabe.representativeName;
		if (zeile.representative_party_id) {
			const [vertreter] = await tx<{ display_name: string }[]>`
				SELECT display_name FROM party WHERE id = ${zeile.representative_party_id}
			`;
			if (vertreter) vertreterName = vertreter.display_name;
		}

		const u = aendereEigentuemer(ausDb(zeile), {
			...eingabe,
			stwegId: zeile.stweg_id,
			representativeName: vertreterName
		});
		const p = u.ergebnis;

		if (zeile.is_community !== p.isCommunity) {
			await pruefeHakenUmlegbar(tx, id, zeile.display_name, p.isCommunity);
		}

		await tx`
			UPDATE party SET
				kind = ${p.kind},
				display_name = ${p.displayName},
				representative_name = ${p.representativeName},
				is_community = ${p.isCommunity},
				member_stweg_id = ${p.memberStwegId ?? null},
				email = ${p.email ?? null},
				phone = ${p.phone ?? null},
				address = ${p.address ?? null}
			WHERE id = ${id}
		`;

		return schreibeUebergang(tx, handelnder, u);
	});
}

// ── Eigentum ────────────────────────────────────────────────────────────────

export interface Eigentum {
	id: Id;
	unitId: Id;
	partyId: Id;
	validFrom: string;
	validTo: string | null;
	note: string | null;
}

/** Liest die Eigentumsgeschichte einer Einheit, aufsteigend nach Beginn. */
async function leseGeschichte(tx: postgres.TransactionSql, unitId: Id): Promise<Zuordnung[]> {
	const zeilen = await tx<
		{ id: string; party_id: string; valid_from: Date; valid_to: Date | null }[]
	>`
		SELECT id, party_id, valid_from, valid_to FROM unit_ownership
		WHERE unit_id = ${unitId} ORDER BY valid_from
	`;
	return zeilen.map((z) => ({
		id: z.id,
		partyId: z.party_id,
		validFrom: z.valid_from.toISOString().slice(0, 10),
		validTo: z.valid_to ? z.valid_to.toISOString().slice(0, 10) : null
	}));
}

/**
 * Zeigt, was eine Zuordnung bewirken würde, ohne sie auszuführen.
 *
 * Getrennt vom Ausführen, weil eine rückwirkende Korrektur eine bestehende
 * Zuordnung kappen oder ganz verdrängen kann. Ohne Vorschau wäre das schwer zu
 * durchschauen — und was verdrängt wurde, liesse sich nachher nicht mehr sehen.
 */
export async function planeEigentumszuordnung(
	operatorId: Id,
	unitId: Id,
	partyId: Id,
	abStichtag: string
): Promise<Aenderungsplan> {
	return alsBetreiber(operatorId, async (tx) => {
		const geschichte = await leseGeschichte(tx, unitId);
		return planeZuordnung(geschichte, partyId, abStichtag);
	});
}

/**
 * Ordnet eine Einheit einer Partei zu, gültig ab einem Stichtag.
 *
 * Läuft zu diesem Zeitpunkt bereits eine Zuordnung, wird sie auf den Stichtag
 * beendet statt überschrieben — der frühere Eigentümer bleibt für vergangene
 * Versammlungen sichtbar (Story 1.8, FR-5). Der Tag des Wechsels gehört dem
 * neuen Eigentümer; die Zeiträume stossen aneinander, ohne sich zu überschneiden.
 *
 * Entstünde eine Zeitspanne ohne Eigentümer, wird die Erfassung abgewiesen. Eine
 * Einheit ohne Eigentümer gibt es im Grundbuch nicht; sie fehlte in jeder
 * Abstimmung dieses Zeitraums, und die Wertquotensumme ginge dort nicht auf,
 * ohne dass ersichtlich wäre, warum.
 */
export async function ordneEigentumZu(
	handelnder: Handelnder & { operatorId: string },
	unitId: Id,
	partyId: Id,
	abStichtag: string,
	notiz?: string
): Promise<Eigentum> {
	return alsBetreiber(handelnder.operatorId, (tx) =>
		schreibeEigentumszuordnung(tx, handelnder, unitId, partyId, abStichtag, notiz)
	);
}

/**
 * Dieselbe Arbeit in einer **laufenden** Transaktion.
 *
 * **Wozu getrennt** (27.08.2026, «Miteigentum eintragen»). Wandert eine Einheit
 * von einer Zeile auf eine frisch gebaute Hülle, gehören beide Schritte in
 * **eine** Transaktion: Bräche es dazwischen ab, stünde eine gemeinschaftliche
 * Zeile ohne Einheit da, und die Einheit hinge weiter an der alten. `alsBetreiber`
 * öffnet aber eine eigene Transaktion auf einer eigenen Verbindung — dieselbe
 * Lehre wie bei `schreibeGemeinschaftlicheZeile` weiter oben.
 */
export async function schreibeEigentumszuordnung(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	unitId: Id,
	partyId: Id,
	abStichtag: string,
	notiz?: string
): Promise<Eigentum> {
	const [einheit] = await tx<{ stweg_id: string; label: string }[]>`
		SELECT stweg_id, label FROM unit WHERE id = ${unitId}
	`;
	if (!einheit) throw new Error('Einheit nicht gefunden');

	/*
	 * **Keine Einheit an eine archivierte Zeile** (25.08.2026, aus dem
	 * Code-Review). Archivieren ist erlaubt, solange die Zeile nichts hält —
	 * über diesen Weg liesse sich derselbe verbotene Zustand von der anderen
	 * Seite herstellen: archivierte Partei, die Einheiten hält und in der
	 * Stimmkraft mitzählt, aber in der Liste fehlt.
	 */
	const [partei] = await tx<
		{ display_name: string; archived_at: Date | null; person_archiviert: Date | null }[]
	>`
		SELECT p.display_name, p.archived_at, pe.archived_at AS person_archiviert
		  FROM party p
		  LEFT JOIN person pe ON pe.id = p.person_id
		 WHERE p.id = ${partyId}
	`;
	/*
	 * **Auch die Person, nicht nur die Zeile** (25.08.2026, zweite
	 * Reviewrunde). `ordneEinheitZuPerson` legt zu einer archivierten Person
	 * eine **neue, nicht archivierte** Partei an und ruft dann hierher — die
	 * Prüfung auf `party.archived_at` allein sah davon nichts. Ergebnis: Eine
	 * archivierte Person hält Einheiten, zählt mit und fehlt in `/personen`.
	 */
	if (partei?.archived_at || partei?.person_archiviert) {
		throw new FachlicherFehler(
			'partei_archiviert',
			`«${partei.display_name}» liegt im Archiv. Holen Sie die Zeile zuerst hervor — ` +
				'wer archiviert ist, hält keine Einheiten.',
			'partyId'
		);
	}

	const geschichte = await leseGeschichte(tx, unitId);
	const plan = planeZuordnung(geschichte, partyId, abStichtag);

	if (plan.luecken.length > 0) {
		const l = plan.luecken[0];
		throw new FachlicherFehler(
			'luecke',
			`Zwischen dem ${l.validFrom} und dem ${l.validTo} hätte die Einheit ${einheit.label} keinen Eigentümer. ` +
				`Eine Einheit ist nie ohne Eigentümer — erfassen Sie zuerst, wem sie in dieser Zeit gehörte.`,
			'ab'
		);
	}

	for (const b of plan.zuBeenden) {
		await tx`UPDATE unit_ownership SET valid_to = ${b.neuesEnde} WHERE id = ${b.id}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.eigentumBeendet,
				{ art: 'unit', id: unitId },
				{ einheit: einheit.label, bisherigePartei: b.partyId, per: b.neuesEnde }
			)
		);
	}

	for (const e of plan.zuEntfernen) {
		/*
		 * **Was verschwindet, wird beim Löschen mitgenommen** (01.09.2026, aus dem
		 * Code-Review).
		 *
		 * Der Eintrag hielt bisher nur fest, **dass** eine Zuordnung verdrängt
		 * wurde — nicht, was in ihr stand. Ihr Zeitraum und ihre Notiz waren
		 * danach nirgends mehr: nicht in der Tabelle, weil die Zeile gelöscht ist,
		 * und nicht im Verlauf, weil er sie nie gelesen hat. AD-5 sagt «der
		 * Datensatz ist weg, der Verlauf bleibt»; er blieb unvollständig.
		 *
		 * Das trifft besonders den Weg über `?/zuordnen`, der eine falsch erfasste
		 * Zuordnung berichtigen soll: Dort verdrängt sich dieselbe Person selbst,
		 * die Rückfrage entfällt zu Recht (sie fragt nach gemeinschaftlichem
		 * Eigentum), und ohne diesen Vermerk verschwände die Notiz still.
		 *
		 * `RETURNING` statt einer zweiten Abfrage: Was gelöscht wurde, weiss der
		 * Löschbefehl am genauesten — eine getrennte Lesung träfe im schlechtesten
		 * Fall schon den Zustand danach.
		 */
		const [weg] = await tx<{ valid_from: Date; valid_to: Date | null; note: string | null }[]>`
			DELETE FROM unit_ownership WHERE id = ${e.id}
			RETURNING valid_from, valid_to, note
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.eigentumBeendet,
				{ art: 'unit', id: unitId },
				{
					einheit: einheit.label,
					bisherigePartei: e.partyId,
					// Ausdrücklich vermerkt: Eine ganze Zuordnung ist verschwunden.
					// Der Datensatz ist weg, der Verlauf bleibt (AD-5).
					verdraengtDurchKorrektur: true,
					per: abStichtag,
					entfernterBeginn: weg ? kalendertag(weg.valid_from) : null,
					entferntesEnde: weg?.valid_to ? kalendertag(weg.valid_to) : null,
					entfernteNotiz: weg?.note ?? null
				}
			)
		);
	}

	const [neu] = await tx<{ id: string }[]>`
		INSERT INTO unit_ownership (unit_id, party_id, stweg_id, operator_id, valid_from, note)
		VALUES (${unitId}, ${partyId}, ${einheit.stweg_id}, ${handelnder.operatorId},
		        ${abStichtag}, ${notiz ?? null})
		RETURNING id
	`;

	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			EREIGNISARTEN.eigentumZugeordnet,
			{ art: 'unit', id: unitId },
			{
				einheit: einheit.label,
				partei: partyId,
				ab: abStichtag,
				// Eine Korrektur mit Wirkung in die Vergangenheit ist zulässig und
				// ändert an einer eingefrorenen Momentaufnahme nichts (AD-3, AD-16).
				// Gerade deshalb muss sie als solche erkennbar sein.
				rueckwirkend: plan.zuBeenden.length > 0 || plan.zuEntfernen.length > 0
			}
		)
	);

	return { id: neu.id, unitId, partyId, validFrom: abStichtag, validTo: null, note: notiz ?? null };
}

// ── Stimmkraft ──────────────────────────────────────────────────────────────

export interface StimmkraftZeile {
	partyId: Id;
	displayName: string;
	isCommunity: boolean;
	representativeName: string | null;
	/**
	 * Art und E-Mail aus den Stammdaten (23.08.2026).
	 *
	 * Für die Stimmkraft ohne Bedeutung — für den Weg zum Berichtigen nötig: Die
	 * Art schickt das Formular unverändert zurück, und die E-Mail ist der Grund
	 * für den ganzen Weg. Sie trägt den Zugangscode zur Versammlung, und nach
	 * einer CSV-Übernahme fehlt sie.
	 */
	kind: string;
	email: string | null;
	/**
	 * Telefon und Adresse — aus demselben Grund (23.08.2026).
	 *
	 * Sie fehlten hier, und weil das Berichtigen alle Felder schreibt, löschte
	 * es beide bei jedem Aufruf. Ändern liessen sie sich ohnehin nie: Nach dem
	 * Anlegen gab es kein Feld dafür.
	 */
	phone: string | null;
	address: string | null;
	einheiten: { unitId: Id; label: string; kind: UnitKind; countsAsHead: boolean; stammquote: number }[];
	kopfstimmen: number;
	wertquote: number;
	/** Wer die Stimme ausübt — bei gemeinschaftlichem Eigentum der Vertreter. */
	ausgeuebtDurch: string;
	/** Woher die Kopfstimmen kommen, in einem Satz für den Saal. */
	erklaerung: string;
}

export interface StimmkraftAnsicht {
	zeilen: StimmkraftZeile[];
	summeKopfstimmen: number;
	/** Die Kopfstimmen je Eigentümer, auch in einer Gemeinschaft je Einheit (L3, Einsprache). */
	summeEigentuemer: number;
	summeWertquote: number;
	headCountMode: HeadCountMode;
	parkingCountsAsHead: boolean;
	/** Einheiten ohne gültige Zuordnung zum Stichtag. Sie fehlen in jeder Zählung. */
	einheitenOhneEigentuemer: { unitId: Id; label: string }[];
}

/**
 * Stimmkraft aller Parteien einer Gemeinschaft zu einem Stichtag.
 *
 * Der Stichtag ist Pflicht, nicht optional: Ohne ihn läse die Abfrage den
 * heutigen Stand, und eine Auswertung zur Februar-Versammlung im April lieferte
 * andere Zahlen als im Februar.
 */
/**
 * **Hier wird NICHT nach dem Archiv gefiltert — mit Absicht** (Migration 086).
 *
 * Diese Funktion rechnet die Stimmkraft, und `freigabe.ts` baut daraus die
 * Momentaufnahme einer Versammlung. Liesse man archivierte Zeilen hier weg,
 * verlöre eine archivierte Partei ihre Stimme — lautlos, mitten in der
 * Vorbereitung, und sichtbar erst am Ergebnis.
 *
 * **Archivieren wirkt auf Listen, nie auf die Rechnung.** Wer eine Zeile aus
 * der Liste nehmen will, an der noch Einheiten hängen, muss zuerst die
 * Zuordnung beenden; das prüft `pruefeEigentuemerArchivierbar` im Kern und
 * sagt es mit einem Satz. Die Eigentümerseite blendet Archiviertes selbst aus.
 */
export async function stimmkraftAnsicht(
	operatorId: Id,
	stwegId: Id,
	stichtag: string
): Promise<StimmkraftAnsicht> {
	// Der Stichtag kann aus der Adresszeile kommen (`?stichtag=`); er geht
	// ungeprüft in die Abfrage darunter (Block B2, 16.10.2026).
	verlangeStichtag(stichtag);
	return alsBetreiber(operatorId, async (tx) => {
		const [gemeinschaft] = await tx<
			{
				head_count_mode: HeadCountMode;
				parking_counts_as_head: boolean;
				head_count_rule_source: string | null;
				tie_break: Stichentscheid | null;
				quota_denominator: number;
			}[]
		>`SELECT head_count_mode, parking_counts_as_head, head_count_rule_source, tie_break,
		         quota_denominator
		  FROM stweg WHERE id = ${stwegId}`;
		if (!gemeinschaft) throw new Error('Gemeinschaft nicht gefunden');

		const zeilen = await tx<
			{
				party_id: string;
				display_name: string;
				is_community: boolean;
				representative_name: string | null;
				authentik_subject: string | null;
				unit_id: string | null;
				label: string | null;
				kind: UnitKind | null;
				counts_as_head: boolean | null;
				stammquote: number | null;
			}[]
		>`
			SELECT p.id AS party_id, p.display_name, p.is_community, p.representative_name,
			       p.authentik_subject,
			       u.id AS unit_id, u.label, u.kind, u.counts_as_head,
			       (SELECT uq.value
			        FROM unit_quota uq
			        JOIN quota_kind qk ON qk.id = uq.quota_kind_id
			        WHERE uq.unit_id = u.id AND qk.key = ${STAMMQUOTE}) AS stammquote
			FROM party p
			LEFT JOIN unit_ownership o
			       ON o.party_id = p.id
			      AND o.valid_from <= ${stichtag}
			      AND (o.valid_to IS NULL OR o.valid_to > ${stichtag})
			LEFT JOIN unit u ON u.id = o.unit_id
			WHERE p.stweg_id = ${stwegId}
			ORDER BY p.display_name, u.label
		`;

		const offen = await tx<{ id: string; label: string }[]>`
			SELECT u.id, u.label
			FROM unit u
			WHERE u.stweg_id = ${stwegId}
			  AND NOT EXISTS (
				SELECT 1 FROM unit_ownership o
				WHERE o.unit_id = u.id
				  AND o.valid_from <= ${stichtag}
				  AND (o.valid_to IS NULL OR o.valid_to > ${stichtag})
			  )
			ORDER BY u.label
		`;

		// Aus den Zeilen wird zuerst eine Momentaufnahme, dann wird gezählt.
		// Ab Epic 3 liefert die Freigabe dieselbe Struktur aus versammlungseigenen
		// Tabellen (AD-3) — es gibt bewusst nur einen Zählweg. Zwei Wege, die
		// dasselbe zählen, laufen früher oder später auseinander, und dann steht
		// Zahl gegen Zahl ohne Möglichkeit zu sagen, welche gilt.
		const jePartei = new Map<string, SnapshotParty>();
		for (const z of zeilen) {
			let eintrag = jePartei.get(z.party_id);
			if (!eintrag) {
				eintrag = {
					partyId: z.party_id,
					displayName: z.display_name,
					isCommunity: z.is_community,
					representativeName: z.representative_name,
					authentikSubject: z.authentik_subject,
					units: []
				};
				jePartei.set(z.party_id, eintrag);
			}
			if (z.unit_id) {
				eintrag.units.push({
					unitId: z.unit_id,
					label: z.label as string,
					kind: z.kind as UnitKind,
					countsAsHead: z.counts_as_head ?? true,
					// Eine Einheit ohne Stammquote gibt es nicht (Schranke aus
					// Migration 005); null käme nur bei einem Datenfehler und darf die
					// Summe nicht zu NaN machen.
					quota: z.stammquote ?? 0
				});
			}
		}

		const momentaufnahme: Snapshot = {
			meetingId: '',
			takenAt: stichtag,
			headCountMode: gemeinschaft.head_count_mode,
			parkingCountsAsHead: gemeinschaft.parking_counts_as_head,
			headCountRuleSource: gemeinschaft.head_count_rule_source,
			tieBreak: gemeinschaft.tie_break ?? 'keiner',
			totalQuota: gemeinschaft.quota_denominator,
			parties: [...jePartei.values()]
		};

		/*
		 * Art und E-Mail aus den Stammdaten — die Momentaufnahme trägt sie nicht,
		 * weil sie für die Stimmkraft ohne Bedeutung sind. Für den Weg zum
		 * Berichtigen werden sie gebraucht (23.08.2026).
		 */
		const stammzeilen = await tx<
			{
				id: string;
				kind: string;
				email: string | null;
				phone: string | null;
				address: string | null;
			}[]
		>`
			SELECT id, kind, email, phone, address FROM party WHERE stweg_id = ${stwegId}
		`;
		const stammdaten = new Map(stammzeilen.map((z) => [z.id, z]));

		const liste = stimmkraftliste(momentaufnahme);

		return {
			zeilen: liste.eintraege.map((e) => ({
				partyId: e.partyId,
				displayName: e.displayName,
				isCommunity: e.isCommunity,
				representativeName: e.representativeName,
				/*
				 * **Art und E-Mail reisen mit** (23.08.2026, Prüflauf II). Die Ansicht
				 * entsteht aus der Momentaufnahme und trug bisher nur, was für die
				 * Stimmkraft nötig ist. Seit die Zeile einen Weg zum Berichtigen hat,
				 * braucht sie beides: die Art, weil das Formular sie unverändert
				 * zurückschickt, und die E-Mail, weil sie der Grund für den ganzen
				 * Weg ist — sie trägt den Zugangscode.
				 */
				kind: stammdaten.get(e.partyId)?.kind ?? 'natural',
				email: stammdaten.get(e.partyId)?.email ?? null,
				/*
				 * **Telefon und Adresse reisen mit** (23.08.2026). Ohne sie schickte
				 * das Formular sie leer zurück, und die Aktion schreibt alle Felder:
				 * Jedes «Berichtigen» löschte beide, ohne dass es jemand sah.
				 *
				 */
				phone: stammdaten.get(e.partyId)?.phone ?? null,
				address: stammdaten.get(e.partyId)?.address ?? null,
				einheiten: e.einheiten.map((u) => ({
					unitId: u.unitId,
					label: u.label,
					kind: u.kind,
					countsAsHead: u.countsAsHead,
					stammquote: u.quota
				})),
				kopfstimmen: e.kopfstimmen,
				wertquote: e.wertquote,
				ausgeuebtDurch: e.ausgeuebtDurch,
				erklaerung: kopfstimmenErklaerung(e, liste)
			})),
			summeKopfstimmen: liste.summeKopfstimmen,
			summeEigentuemer: liste.eintraege.reduce(
				(s, e) => s + kopfgewicht({ units: e.einheiten }, 'per_owner', false),
				0
			),
			summeWertquote: liste.summeWertquote,
			headCountMode: gemeinschaft.head_count_mode,
			parkingCountsAsHead: gemeinschaft.parking_counts_as_head,
			einheitenOhneEigentuemer: offen.map((o) => ({ unitId: o.id, label: o.label }))
		};
	});
}

/**
 * Eine versehentlich erfasste Zuordnung wieder entfernen (23.08.2026, Befund A-13).
 *
 * **Der Unterschied zum Eigentümerwechsel.** Wer verkauft, bekommt einen
 * Nachfolger: `ordneEigentumZu` kappt die alte Zuordnung und setzt die neue
 * dahinter — die alte bleibt für vergangene Versammlungen sichtbar, und das ist
 * richtig so. Was fehlte, war der andere Fall: jemand hat sich vertan, und die
 * Zuordnung soll nicht enden, sondern **nie gewesen sein**.
 *
 * Ohne diesen Weg blieb nur, eine zweite Zuordnung darüberzulegen — und dann
 * steht im Protokoll ein Eigentümerwechsel, den es nie gab.
 *
 * **Zwei Schranken, beide unumgehbar:**
 *
 * 1. **Nur die jüngste Zuordnung einer Einheit.** Eine mittendrin zu entfernen
 *    risse ein Loch in die Kette; eine Einheit ist nie ohne Eigentümer
 *    (`domain/historie.ts`). Der Vorgänger wird dabei wieder offen — genau der
 *    Zustand von vor dem Versehen.
 * 2. **Nichts, worauf schon abgestimmt wurde.** Steht die Einheit in einer
 *    Momentaufnahme, hat ihre Wertquote an einer Abstimmung teilgenommen; wer
 *    die Zuordnung dann tilgt, macht das Protokoll unerklärlich. Dieselbe
 *    Schranke wie beim Entfernen einer Einheit (22.08.2026).
 */
export async function entferneZuordnung(
	handelnder: Handelnder & { operatorId: string },
	zuordnungId: Id
): Promise<{ einheit: string; wiederOffen: string | null }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [zeile] = await tx<
			{ unit_id: string; party_id: string; label: string; stweg_id: string }[]
		>`
			SELECT o.unit_id, o.party_id, u.label, u.stweg_id
			  FROM unit_ownership o JOIN unit u ON u.id = o.unit_id
			 WHERE o.id = ${zuordnungId}
		`;
		if (!zeile) {
			throw new FachlicherFehler('unbekannt', 'Diese Zuordnung gibt es nicht.', 'zuordnungId');
		}

		const [{ anzahl: inVersammlungen }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM snapshot_unit WHERE unit_id = ${zeile.unit_id}
		`;
		if (inVersammlungen > 0) {
			throw new FachlicherFehler(
				'einheit_in_versammlung',
				`«${zeile.label}» hat an einer freigegebenen Versammlung teilgenommen. Eine Zuordnung ` +
					'lässt sich dann nicht mehr tilgen — ihre Wertquote steht in der Auszählung. Erfassen ' +
					'Sie stattdessen den richtigen Eigentümer ab dem Tag, an dem er es wurde.',
				'zuordnungId'
			);
		}

		const geschichte = await leseGeschichte(tx, zeile.unit_id);
		const juengste = geschichte[geschichte.length - 1];
		if (!juengste || juengste.id !== zuordnungId) {
			throw new FachlicherFehler(
				'nicht_die_juengste',
				'Nur die zuletzt erfasste Zuordnung lässt sich entfernen. Eine frühere zu tilgen risse ' +
					'ein Loch in die Kette — eine Einheit ist nie ohne Eigentümer.',
				'zuordnungId'
			);
		}

		await tx`DELETE FROM unit_ownership WHERE id = ${zuordnungId}`;

		/*
		 * **Der Vorgänger wird wieder offen.** Beim Zuordnen hat er ein Ende
		 * bekommen; ohne diesen Schritt endete er weiterhin an einem Tag, an dem
		 * nichts mehr geschieht — und die Einheit stünde ab da ohne Eigentümer da.
		 */
		const vorgaenger = geschichte[geschichte.length - 2];
		if (vorgaenger && vorgaenger.validTo === juengste.validFrom) {
			await tx`UPDATE unit_ownership SET valid_to = NULL WHERE id = ${vorgaenger.id}`;
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.eigentumBeendet,
				{ art: 'unit', id: zeile.unit_id },
				{
					einheit: zeile.label,
					partei: zeile.party_id,
					getilgt: true,
					ab: juengste.validFrom,
					vorgaengerWiederOffen: vorgaenger?.partyId ?? null
				}
			)
		);

		return { einheit: zeile.label, wiederOffen: vorgaenger?.partyId ?? null };
	});
}

/**
 * Die jüngste Zuordnung einer Einheit tilgen — der Weg von der Oberfläche her.
 *
 * Die Ansicht zeigt je Partei ihre Einheiten, nicht die Zuordnungszeilen: Sie
 * entsteht aus einer Momentaufnahme und kennt deren Kennungen nicht. Weil sich
 * ohnehin nur die jüngste tilgen lässt (siehe `entferneZuordnung`), genügt die
 * Einheit als Anhaltspunkt — was angezeigt wird, IST die jüngste.
 */
export async function entferneJuengsteZuordnungDerEinheit(
	handelnder: Handelnder & { operatorId: string },
	unitId: Id
): Promise<{ einheit: string; wiederOffen: string | null }> {
	const id = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ id: string }[]>`
			SELECT id FROM unit_ownership WHERE unit_id = ${unitId}
			 ORDER BY valid_from DESC LIMIT 1
		`;
		return z?.id ?? null;
	});
	if (!id) {
		throw new FachlicherFehler(
			'ohne_zuordnung',
			'Zu dieser Einheit gibt es keine Zuordnung, die sich tilgen liesse.',
			'unitId'
		);
	}
	return entferneZuordnung(handelnder, id);
}

/**
 * Eine Eigentümerzeile tilgen, die es nie hätte geben sollen.
 *
 * **Der Anlassfall** (Prüflauf 23.08.2026): Die Übernahme aus der Tabelle legte
 * «Katharina Zbinden» als Zeile ohne Person an; wer sie danach auf der
 * Personenseite einer Einheit zuordnete, bekam eine **zweite** Zeile desselben
 * Namens. Die erste blieb ohne Zuordnung liegen — sichtbar, zählbar, und ohne
 * jeden Weg, sie loszuwerden. Haus B führte sechzehn Zeilen für vierzehn
 * Einheiten. Dass sie überhaupt entstehen konnte, ist seit heute verhindert
 * (`parteiAusPerson`); dieser Weg räumt weg, was schon dasteht.
 *
 * **Vier Schranken, und zwei davon stehen nicht in der Datenbank.**
 * `snapshot_party.party_id` und `recusal.party_id` tragen keinen
 * Fremdschlüssel — Absicht, denn das Versammlungsgeschehen soll den
 * Stammdatensatz überleben. Ein `DELETE` ginge dort durch und zöge einer
 * Auszählung den Halter unter dem Namen weg. Also prüfen wir selbst.
 *
 * `vote`, `attendance_event` und `meeting_access` fragen wir **nicht** ab: Sie
 * führen keine `party_id`, sondern eine `snapshot_party_id` mit echtem
 * Fremdschlüssel. Ohne Momentaufnahme kann es sie gar nicht geben, die zweite
 * Schranke deckt sie also zwingend mit ab. Dass das so bleibt, hält der Test
 * «kennt jede Tabelle, die auf eine Partei zeigt» fest — er liest die
 * Fremdschlüssel aus dem Katalog und schlägt an, sobald eine neue Tabelle
 * direkt an `party` hängt.
 *
 * Die fünf Schranken:
 *
 * 1. **Nichts gehalten** — keine Zuordnung, auch keine beendete.
 * 2. **An keiner Versammlung dabei gewesen** — keine Momentaufnahme, keine
 *    Stimme, kein Anwesenheitsereignis, kein Zugang, kein Ausstand.
 * 3. **Keine Weisung** und **kein Traktandum**, das sie stellt oder betrifft.
 * 4. **Nicht mitberechtigt** an gemeinschaftlichem Eigentum (Migration 094).
 * 5. **Vertritt keine Gemeinschaft** — übt für keine Hülle deren Stimme aus.
 *
 * **Eine weitere Schranke stand hier und ist wieder gefallen:** «nicht mit
 * einer Person verknüpft». Sie klang vernünftig — die Zeile sei der Anker der
 * Person in dieser Gemeinschaft —, war aber falsch. Der reguläre Weg über
 * «Eigentümer erfassen» legt Person und Zeile in einem Zug an; damit wäre der
 * Knopf ausgerechnet für den häufigsten Fall gesperrt gewesen, den
 * versehentlich angelegten Eigentümer. Im Durchstich sofort aufgefallen: Die
 * frisch angelegte Zeile «Karteileiche» trug keinen Knopf.
 *
 * Getilgt wird ohnehin nur die **Zeile in dieser Gemeinschaft**. Die Person
 * bleibt erfasst, mit allem, was sie anderswo hält — das sagt die Rückfrage
 * auch so.
 *
 * Eine Vertretung (`representation`) fällt per `ON DELETE CASCADE` mit — sie
 * ist ohne die vertretene Zeile ohnehin gegenstandslos.
 */
/**
 * Sagt ab, wenn an einer Eigentümerzeile etwas hängt, das sie unlöschbar macht.
 *
 * **An einer Stelle, weil es zwei Aufrufer gibt** (25.08.2026): das Tilgen der
 * einzelnen Zeile und das Löschen einer Person, die ihre Zeilen mitnimmt
 * (`entfernePerson`). Zwei Abschriften derselben Schranken liefen
 * auseinander, sobald eine davon eine weitere bekommt — und sie kommt, sobald
 * eine neue Tabelle auf `party` zeigt. Genau so geschehen am 26.08.2026: Die
 * Mitberechtigung (Migration 094) trug beiden Wegen je eine neue ein.
 *
 * Die Meldungen nennen den Namen der Zeile, nicht bloss «die Zeile»: Beim
 * Löschen einer Person stehen mehrere zur Auswahl, und dann muss die Absage
 * sagen, welche im Weg steht.
 */
export async function pruefeZeileTilgbar(
	tx: postgres.TransactionSql,
	parteiId: Id,
	name: string
): Promise<void> {
	const [zaehlung] = await tx<
		{
			zuordnungen: number;
			momentaufnahmen: number;
			ausstaende: number;
			weisungen: number;
			traktanden: number;
			mitberechtigte: number;
			mitberechtigung: number;
			vertretungen: number;
		}[]
	>`
		SELECT (SELECT count(*) FROM unit_ownership WHERE party_id = ${parteiId})::int AS zuordnungen,
		       (SELECT count(*) FROM snapshot_party WHERE party_id = ${parteiId})::int AS momentaufnahmen,
		       (SELECT count(*) FROM recusal WHERE party_id = ${parteiId})::int AS ausstaende,
		       (SELECT count(*) FROM instruction WHERE party_id = ${parteiId})::int AS weisungen,
		       (SELECT count(*) FROM agenda_item WHERE proposer_party_id = ${parteiId})::int
		         + (SELECT count(*) FROM agenda_item_proposer WHERE party_id = ${parteiId})::int
		         + (SELECT count(*) FROM agenda_item_affected WHERE party_id = ${parteiId})::int
		         AS traktanden,
		       (SELECT count(*) FROM party_member WHERE huelle_party_id = ${parteiId})::int
		         AS mitberechtigte,
		       (SELECT count(*) FROM party_member WHERE mitglied_party_id = ${parteiId})::int
		         AS mitberechtigung,
		       (SELECT count(*) FROM party WHERE representative_party_id = ${parteiId})::int
		         AS vertretungen
	`;

	if (zaehlung.zuordnungen > 0) {
		throw new FachlicherFehler(
			'haelt_eigentum',
			`«${name}» ist einer Einheit zugeordnet — auch eine beendete Zuordnung ` +
				'zählt, sie ist Teil der Eigentümergeschichte. Entfernen Sie zuerst die Zuordnung; ' +
				'bleibt die Zeile danach leer, lässt sie sich tilgen.',
			'parteiId'
		);
	}

	if (zaehlung.momentaufnahmen + zaehlung.ausstaende > 0) {
		throw new FachlicherFehler(
			'in_versammlung',
			`«${name}» gehört zu einer Versammlung — die Zeile steht auf deren Liste der ` +
				'Stimmberechtigten oder in einem Ausstand. Sie zu tilgen machte Auszählung und ' +
				'Protokoll unerklärlich.',
			'parteiId'
		);
	}

	if (zaehlung.weisungen > 0 || zaehlung.traktanden > 0) {
		throw new FachlicherFehler(
			'haengt_an_traktanden',
			`«${name}» stellt oder betrifft ein Traktandum oder hat eine Weisung ` +
				'erteilt. Lösen Sie das zuerst.',
			'parteiId'
		);
	}

	/*
	 * **Mitberechtigt an gemeinschaftlichem Eigentum** (Migration 094). Der
	 * Fremdschlüssel kaskadiert, und genau darin liegt die Gefahr: Ein Mitglied
	 * hält keine Einheit und steht auf keiner Momentaufnahme — nach jedem
	 * Massstab oben ist die Zeile «leer» und würde kommentarlos getilgt. Die
	 * Hülle stünde danach mit einem Miteigentümer weniger da, und war es der
	 * Vertreter, ohne Verweis auf ihn. Nach ZGB Art. 712n bekäme jemand keine
	 * Einladung mehr, ohne dass es irgendwo auffiele.
	 *
	 * Geprüft wird hier und nicht nur in `entferneEigentuemer`: Der zweite Weg
	 * über `personen.ts` (Person samt ihren Zeilen löschen) führt an derselben
	 * Stelle vorbei.
	 */
	/*
	 * **Eine Hülle mit Mitberechtigten lässt sich nicht tilgen** (Entscheid
	 * Auftraggeber, 26.08.2026; Aufgabe 4).
	 *
	 * Ohne diese Absage kaskadieren die Mitgliedschaften weg
	 * (`party_member_huelle_fk`), und zurück bleiben zwei Personenzeilen ohne
	 * Einheit, ohne Kopfstimme und ohne Quote — genau das Bild, an dem die
	 * Laienprüfung vom 26.08.2026 hängengeblieben ist: Es sieht aus wie eine
	 * halbfertige Erfassung, und jemand räumt es weg. Weg wären dann zwei
	 * Menschen, die nach ZGB Art. 712n eine eigene Einladung bekommen.
	 *
	 * Der Ausweg, den der Satz nennt, steht auf der Eigentümerseite unter
	 * «Mitberechtigte» — dieselbe Handlung, die auch `pruefeHakenUmlegbar`
	 * verlangt, bevor der Haken fällt.
	 */
	if (zaehlung.mitberechtigte > 0) {
		throw new FachlicherFehler(
			'huelle_hat_mitberechtigte',
			`An «${name}» ${zaehlung.mitberechtigte === 1 ? 'hängt eine mitberechtigte Person' : `hängen ${zaehlung.mitberechtigte} Mitberechtigte`}. ` +
				'Nehmen Sie die Mitberechtigten zuerst weg; danach lässt sich die Zeile tilgen.',
			'parteiId'
		);
	}

	if (zaehlung.mitberechtigung > 0) {
		throw new FachlicherFehler(
			'ist_mitberechtigt',
			`«${name}» ist Mitberechtigte oder Mitberechtigter an gemeinschaftlichem ` +
				'Eigentum. Lösen Sie diese Zuordnung zuerst.',
			'parteiId'
		);
	}

	/*
	 * **Übt die Zeile die Stimme einer Hülle aus?** Getrennt gezählt, obwohl der
	 * Vertreter seit Migration 095 immer auch Mitglied ist
	 * (`party_vertreter_ist_mitglied`) und deshalb schon oben hängen bleibt.
	 *
	 * **Berichtigt am 26.08.2026:** Hier stand «die Datenbank verlangt das
	 * nicht» — bis 095 stimmte das, jetzt nicht mehr. Die Absage bleibt trotzdem
	 * stehen, aber als zweite Reihe: Fiele die Schranke einmal weg, setzten
	 * `party_vertreter_fk` und `party_vertreter_ist_mitglied` den Verweis beim
	 * Tilgen still auf NULL, und die Hülle stünde ohne die Zeile da, die nach
	 * ZGB Art. 712o Abs. 1 ihre eine Stimme abgibt.
	 */
	if (zaehlung.vertretungen > 0) {
		throw new FachlicherFehler(
			'vertritt_gemeinschaft',
			`«${name}» übt die Stimme einer Gemeinschaft aus. Bestimmen Sie zuerst ` +
				'eine andere Vertretung.',
			'parteiId'
		);
	}
}

export async function entferneEigentuemer(
	handelnder: Handelnder & { operatorId: string },
	parteiId: Id
): Promise<{ name: string }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [partei] = await tx<
			{ id: string; display_name: string; stweg_id: string; person_id: string | null }[]
		>`
			SELECT id, display_name, stweg_id, person_id FROM party WHERE id = ${parteiId}
		`;
		if (!partei) {
			throw new FachlicherFehler('unbekannt', 'Diese Eigentümerzeile gibt es nicht.', 'parteiId');
		}

		await pruefeZeileTilgbar(tx, parteiId, partei.display_name);

		await tx`DELETE FROM party WHERE id = ${parteiId}`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.eigentuemerGetilgt,
				{ art: 'party', id: parteiId },
				{
					name: partei.display_name,
					gemeinschaft: partei.stweg_id,
					aus_person: partei.person_id
				}
			)
		);

		return { name: partei.display_name };
	});
}

/**
 * Eine Zeile der Eigentumshistorie: wer hielt welche Einheit von wann bis wann.
 */
export interface Verlaufszeile {
	unitId: Id;
	einheit: string;
	partyId: Id;
	eigentuemer: string;
	von: string;
	/** `null` heisst «bis auf Weiteres» — die laufende Zuordnung. */
	bis: string | null;
}

/**
 * Die Eigentumshistorie einer Gemeinschaft (Auftraggeber, 01.09.2026: «Der Gedanke wäre
 * dann eine Historie wer von wann bis wann Eigentümer war»).
 *
 * **Die Tabelle dafür gibt es seit Migration 006**, samt Überschneidungsschutz
 * und dem Stichtagsbezug, mit dem die ganze Anwendung rechnet. Was fehlte, war
 * die Sicht darauf: `valid_from` erschien in keiner einzigen Ansicht, und die
 * Zeiträume tauchten nur in der Rückfrage auf — also erst im Augenblick, in dem
 * man im Begriff war, eine Zuordnung zu verdrängen. Dass es die Geschichte
 * überhaupt gibt, merkte man erst, wenn man sie beschädigte.
 *
 * **Nach Einheit gegliedert und nicht nach Partei.** An der Einheit ist die
 * Reihe lückenlos: Sie hat zu jedem Zeitpunkt genau einen Eigentümer, dafür
 * sorgt `unit_ownership_keine_ueberschneidung`. Die Sicht von der Partei her
 * ist ein Ausschnitt daraus und beantwortet die andere Frage; sie steht auf der
 * Personenseite.
 *
 * **Alle Zeilen, nicht die zum Stichtag.** Genau darin liegt der Zweck: Wer
 * fragt, wem die Wohnung 2024 gehörte, bekommt es sonst nur, indem er den
 * Stichtag der ganzen Seite verstellt.
 */
export async function holeEigentumsverlauf(
	operatorId: Id,
	stwegId: Id
): Promise<Verlaufszeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				unit_id: string;
				einheit: string;
				party_id: string;
				eigentuemer: string;
				valid_from: Date | string;
				valid_to: Date | string | null;
			}[]
		>`
			SELECT o.unit_id, u.label AS einheit, o.party_id, p.display_name AS eigentuemer,
			       o.valid_from, o.valid_to
			  FROM unit_ownership o
			  JOIN unit  u ON u.id = o.unit_id
			  JOIN party p ON p.id = o.party_id
			 WHERE o.stweg_id = ${stwegId}
			 -- Nach Einheit, darin nach Beginn: So liest sich je Einheit eine
			 -- Kette von der ältesten Zuordnung bis zur laufenden.
			 --
			 -- Die Kennung als zweiter Schlüssel (01.09.2026, aus dem Code-Review):
			 -- Die Bezeichnung einer Einheit trägt kein UNIQUE, zwei dürfen gleich
			 -- heissen. Ohne sie verschränkten sich ihre Ketten, und die Anzeige,
			 -- die den Namen nur an der ersten Zeile wiederholt, zeigte eine
			 -- falsche Folge.
			 -- (Kein Gegenzeichen im Kommentar: Er steht in einer
			 --  Vorlagenzeichenkette, und ein Rückwärtsakzent beendete sie mitten
			 --  im SQL — dieselbe Falle wie in uebersicht.ts.)
			 ORDER BY u.label, o.unit_id, o.valid_from
		`;
		return zeilen.map((z) => ({
			unitId: z.unit_id,
			einheit: z.einheit,
			partyId: z.party_id,
			eigentuemer: z.eigentuemer,
			// `date` ohne Zone: als Kalendertag lesen, nicht über `toISOString`.
			von: kalendertag(z.valid_from),
			bis: z.valid_to ? kalendertag(z.valid_to) : null
		}));
	});
}

/**
 * Die Namen der Parteien einer Gemeinschaft, nach Kennung, auch der
 * archivierten: für Sätze, die eine eingetragene Partei nennen (die Einladung
 * bei der Einsprache, `einladungshinweisZu`). Archiviert kann eine Partei sein,
 * die beim Eintrag noch Eigentümerin war.
 */
export async function holeParteinamen(operatorId: Id, stwegId: Id): Promise<Map<string, string>> {
	const alle = await holeEigentuemer(operatorId, stwegId, 'alle');
	return new Map(alle.map((e) => [e.id, e.displayName]));
}
