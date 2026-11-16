/**
 * Abstimmungsdurchgänge, Stimmen und Ergebnis (Stories 5.6 bis 5.10).
 *
 * **Was hier eingefroren wird.** Beim Schliessen wandern die Eingaben in den
 * Durchgang: das Mehrheitserfordernis, wie es bei der Freigabe galt (AD-4),
 * und der Stand dieses Augenblicks, also Anwesenheit, Vollmachten und Ausstand
 * (AD-16). Beim Verkünden kommt das **Ergebnis** dazu (seit 25.09.2026,
 * Migration 123): Die Auszählung wird einmal gerechnet und festgeschrieben,
 * danach nur noch gelesen (`ergebnisIn`).
 *
 * Bis dahin wurde das Ergebnis aus den Eingaben gerechnet, sooft es gebraucht
 * wurde, mit der Begründung, ein abgelegtes Ergebnis wäre eine zweite
 * Wahrheit. Das ist es nicht, solange danach nicht mehr gerechnet wird. Die
 * Rechnung von damals hatte dagegen eine Kehrseite, die sich an `6b820d5`
 * zeigte: Eine geänderte Zählregel änderte verkündete Ergebnisse rückwirkend
 * (Produktentscheid 25.09.2026: «nach jeder Abstimmung [soll] das bereits
 * abgestimmte nicht mehr verändert werden können»).
 */
import { ZUORDNUNG_GEAENDERT, zuordnungsmarke, type Zuordnung } from '$lib/domain/freigabezuordnung';
import type { Geschaeftsart } from '$lib/domain/regelwerk';
import postgres from 'postgres';
import { alsBetreiber, istDoppelterSchluessel, nochmalsBeiVerklemmung } from './db';
import { schreibeUebergang, schreibeVerlauf, zeitquelle, type Handelnder } from './audit';
import { holeUebersicht, leseEreignisse } from './anwesenheit';
import { holeAnwesenheitsregeln, leseAnwesenheitsregeln } from './reglement';
import { holeMomentaufnahme } from './freigabe';
import { momentaufnahmeKopf, type Momentaufnahmezeile } from './momentaufnahmekopf';
import {
	zaehleAus,
	zaehleSummenAus,
	mitKeinemBeschluss,
	ergebnislage,
	beschlussGilt,
	summenhindernis,
	summenvermerkNoetig,
	SUMMENVERMERK_MINDESTLAENGE,
	andereDreizahlVon,
	pruefeAndereDreizahl,
	einspracheHaende,
	einspracheZaehlhilfe,
	type Handzaehlung,
	type Auszaehlung,
	type Stichentscheidbefund,
	type Vertretung,
	type Ausschlussgrund,
	ruhendeVertretungenBei,
	vomStimmrechtAusgeschlossen,
	mehrheitsvorschau,
	mitAllenJa,
	type Auszaehlungslage,
	type Mehrheitsvorschau
} from '$lib/domain/auszaehlung';
import { nummeriere } from '$lib/domain/traktandenbaum';
import {
	fortschritt,
	oeffneDurchgang,
	pruefeDurchgangsfreigabe,
	pruefeStellvertretendeStimme,
	pruefeStimmabgabe,
	schliesseDurchgang,
	ueberholeDurchgang,
	brecheDurchgangAb,
	abgebrochen,
	WEG_NACH_DER_VERKUENDUNG,
	type Durchgang,
	type Durchgangszustand,
	type Fortschritt,
	type Freigabelage
} from '$lib/domain/abstimmung';
import {
	ausstandsbefund,
	beteiligungDerAnwesenden,
	standVon,
	type Erfassungsweg
} from '$lib/domain/anwesenheit';
import type { Betriebsart } from '$lib/domain/versammlung';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import {
	stelleBeschlussfaehigkeitFest,
	verlangeBeschlussfaehigkeit,
	warZeitweiseBeschlussfaehig,
	type Beteiligung,
	type Versammlungsstufe
} from '$lib/domain/beschlussfaehigkeit';
import { KONFLIKTSATZ, Schreibkonflikt, veralteteFelder } from '$lib/domain/schreibstand';
import { fremdesTraktandum } from '$lib/domain/fehler';
import {
	folgeantraegeMitEigenemBeschluss,
	verlangeNeuenDurchgangZulaessig,
	type Ersetzungsart
} from '$lib/domain/rueckkommen';
import { verlangeFolgeantragNachRueckkommen } from '$lib/domain/folgeantrag';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { betroffeneStimmenNichtMit, einwandLageAm, EINSPRACHE_KNOTEN, l3Wirkt, type Erfordernis } from '$lib/domain/entscheidbaum';
import { knotenDerFassung } from '$lib/rules';
import { pruefstufeFuerTraktandumIn } from './neutraktanden';
import { holeLesartenIn } from './lesarten';
import { ABBERUFUNGSKNOTEN, VERWALTUNGSKNOTEN, VERWALTUNGSWAHLKNOTEN } from './erfordernisse';
import type { Teilentscheid } from '$lib/domain/abstimmung';
import { AUSSTAND_NICHT_BESCHLUSSFAEHIG, neuAnZweiterGesperrt } from '$lib/domain/mehrhinweise';
import {
	EINSPRACHE_ZAEHLHILFE_VORSATZ,
	einspracheHandzaehlungTexte,
	einsprachelesartVon,
	type Ausstandsbeschlussfaehigkeit,
	type Verwaltungsvollmachtwahl
} from '$lib/domain/lesarten';
import type { Spontanart } from '$lib/domain/traktanden';
import {
	UNIVERSAL_NACH_WIDERSPRUCH,
	nachWiderspruchSchluss,
	universalAmSchluss,
	ueberholungsgrundNachWeggang,
	type Ausnahmegrund,
	gemeinsamImStand,
	type KeinBeschluss,
	type Universalstand
} from '$lib/domain/ausnahmen';
import { KONSULTATIV_UEBERHOLT, verlangeKonsultativZulaessig, KONSULTATIV_UEBERHOLT_NEU, type Konsultativgrund } from '$lib/domain/konsultativ';
import {
	leseGegangenSeit,
	leseGueltigAbgestimmt,
	leseLeitungskreuzSeit,
	leseVertretenSeit,
	leseVertreterBis,
	leseUniversallage,
	leseWidersprueche
} from './universal';
import {
	istVertreterkennung,
	VERTRETERKENNUNG_VORSATZ,
	vertreterkennung,
	vollmachtsschluessel
} from '$lib/domain/vollmacht';
import type { Id, Snapshot, Stichentscheid, Vote, VoteChoice, Zeitpunkt } from '$lib/domain/types';
import type { Verwaltungsangabe } from '$lib/domain/verwaltungsangabe';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { ausFestschreibung, festschreibung } from '$lib/domain/festschreibung';
import { leseBetroffeneIn, type BetroffeneImDurchgang } from './betroffene';
import {
	ERFORDERNIS_VON_HAND,
	auszaehlungVonHand,
	begruendungVonHand,
	verlangeEinwandOhneOffenenDurchgang,
	beschlussVonHandEreignis,
	verlangeVonHandMoeglich,
	type Uebergangen,
	type Ueberholt,
	type VonHandEingabe
} from '$lib/domain/vonhand';
import { verlangeEinladungsmehrBeimAbstimmen } from './einladungsmehr';

type Tx = postgres.TransactionSql;

interface Rundenzeile {
	id: string;
	meeting_id: string;
	agenda_item_id: string;
	ordinal: number;
	state: Durchgangszustand;
	opened_at: Date;
	closed_at: Date | null;
	superseded_at: Date | null;
	supersede_reason: string | null;
	/** Warum ersetzt: fehlerhafter Durchgang oder Beschluss nach Rückkommen (FR-44). */
	supersede_kind: Ersetzungsart | null;
	/** Der angenommene Rückkommensantrag, auf den sich dieser Durchgang stützt. */
	reconsideration_item_id: string | null;
	/** Bei `rueckkommen`: der Durchgang, der diesen ersetzt hat (Migration 131). */
	superseded_by_round_id: string | null;
	result_published_at: Date | null;
	/**
	 * Die beim Verkünden festgeschriebene Auszählung (Migration 123, seit
	 * 25.09.2026). Roh, gelesen wird sie über `ausFestschreibung`.
	 */
	result_json: unknown;
	requirement_json: Erfordernis | null;
	attendance_json:
		| { anwesende: Id[]; vertretungen?: Vertretung[]; ausstand?: Id[]; ausstandVerwaltung?: Id[] }
		| null;
	/** Die beim Schliessen festgeschriebenen Betroffenen (Migration 124). */
	affected_json: BetroffeneImDurchgang[] | null;
	tie_break_choice: 'yes' | 'no' | null;
	tie_break_by: string | null;
	tie_break_reason: string | null;
	tie_break_at: Date | null;
	/** Migration 150: die Person im Vorsitz ist selbst Stockwerkeigentümer. */
	tie_break_by_owner: boolean;
	decision_text: string | null;
	tally_yes: number | null;
	tally_no: number | null;
	tally_abstain: number | null;
	/** Die zweite Zählung der Handzählung an der Einsprache (Migration 172). */
	tally_other_yes: number | null;
	tally_other_no: number | null;
	tally_other_abstain: number | null;
	tally_note: string | null;
	tally_at: Date | null;
	/** Der Stand im Augenblick der Handzählung (Migration 156, `erfasseSummen`). */
	tally_stand_json: Summenstand | null;
	/** Geheime Abstimmung (Migration 141); beim Eröffnen gesetzt und unveränderlich. */
	secret: boolean;
	/** Offener Beschluss der Versammlung zur geheimen Abstimmung (Migration 165); `null`: nicht festgehalten. */
	secret_resolved: boolean | null;
	/** Das Reglement sieht die geheime Abstimmung vor (Migration 166); `null`: nicht festgehalten. */
	secret_by_bylaw: boolean | null;
	/** Konsultative Abstimmung (Migration 158); beim Eröffnen gesetzt und unveränderlich. */
	consultative: boolean;
	/** Warum konsultativ (Migration 174): nach der Sperre von L5; sonst `null`. */
	consultative_reason: Konsultativgrund | null;
	universal_mode: 'persoenlich' | 'vertreten' | null;
	universal_confirmed_at: Date | null;
	universal_confirmed_by: string | null;
	universal_json: Universalstand | null;
}

/**
 * Was die Handzählung beim Erfassen festhält und das Schliessen übernimmt
 * (Migration 156): dieselben Angaben, die sonst erst beim Schliessen nach
 * `attendance_json` und `affected_json` gehen.
 */
interface Summenstand {
	anwesende: Id[];
	vertretungen: Vertretung[];
	ausstand: Id[];
	/** L8 (Migration 184): die Kennungen des Ausstands aus L8, wie `leseSchlussstand`. */
	ausstandVerwaltung: Id[];
	quelle: string;
	betroffene: BetroffeneImDurchgang[];
}

/** Ein Durchgang unter der Universalversammlung (Migration 128). */
export interface Universaldurchgang {
	variante: 'persoenlich' | 'vertreten';
	bestaetigtAm: Zeitpunkt;
	bestaetigtDurch: string;
	/** Beim Schliessen festgeschrieben; null, solange offen. */
	stand: Universalstand | null;
}

export interface Durchgangsstand extends Durchgang {
	/** Wann das Ergebnis verkündet wurde. Null heisst: nur die Sitzungsleitung sieht es. */
	verkuendetAm: Zeitpunkt | null;
	/**
	 * Die Abstimmung ist geheim (Migration 141). Die Anzeigen nennen dann nur
	 * «erreicht» oder «nicht erreicht»; die Zahlen bleiben in der Datenbank und
	 * im versiegelten Abschlusspaket.
	 */
	geheim: boolean;
	/**
	 * Die Leitung hat beim Eröffnen bestätigt, dass die Versammlung offen
	 * beschlossen hat, geheim abzustimmen (Migration 165, Ä-38). `false` bei
	 * offenen Durchgängen und bei geheimen von vor der Migration.
	 */
	geheimBeschlossen: boolean;
	/** Das Reglement sieht die geheime Abstimmung vor (Migration 166, Ä-38). */
	geheimNachReglement: boolean;
	/**
	 * Bei fehlender Beschlussfähigkeit konsultativ eröffnet (Migration 158). Wand
	 * und Telefone sagen es schon während der Abstimmung; das Schliessen ergibt
	 * «kein Beschluss».
	 */
	konsultativ: boolean;
	/** Konsultativ nach der Sperre von L5 (Migration 174): Die Sätze nennen dann diesen Grund. */
	konsultativNeu: boolean;
	/** Das bei der Freigabe geltende Erfordernis, beim Schliessen festgeschrieben. */
	erfordernis: Erfordernis | null;
	/**
	 * Der beim Schliessen festgeschriebene Anwesenheitsstand. Bei einer
	 * Handzählung ist es der Stand beim Zählen, den das Schliessen übernimmt
	 * (Migration 156, `erfasseSummen`); dasselbe gilt für `vertretungen`,
	 * `ausstand` und `betroffene`.
	 */
	anwesende: Id[] | null;
	/**
	 * Ob die Auszählung von der Sitzungsleitung von Hand festgehalten wurde
	 * (Migration 134). Gelesen aus der Festschreibung, ohne sie ganz zu
	 * entpacken; die Migration 139 hängt daran («Neuabstimmung nach Eintritt der
	 * Beschlussfähigkeit»).
	 */
	vonHand: boolean;
	/**
	 * Die beim Schliessen wirksamen Vollmachten — aus demselben Grund
	 * festgeschrieben wie die Anwesenheit (AD-16).
	 *
	 * Leer bei Durchgängen, die vor dem 13.08.2026 geschlossen wurden: Damals
	 * wurde sie nicht mitgeführt. Deren Ergebnis bleibt damit genau das, das im
	 * Saal verkündet wurde — was richtig ist, denn nachträglich anders zu rechnen
	 * hiesse, ein Protokoll zu berichtigen, das niemand berichtigt hat.
	 */
	vertretungen: Vertretung[];
	/**
	 * Wer beim Schliessen im Ausstand war, festgeschrieben wie Anwesenheit und
	 * Vollmachten (AD-16).
	 *
	 * **Seit dem 25.09.2026** (Code-Review 24.09.2026 zu `ausstandswirkung`,
	 * Befund 3). Vorher las das Ergebnis den Ausstand aus `recusal`, wie er
	 * jetzt ist; erklären und zurücknehmen sperrt `server/ausstand.ts` aber nur
	 * bei offenem Durchgang. Ein Ausstand nach dem Schliessen änderte damit das
	 * Ergebnis einer geschlossenen Abstimmung rückwirkend.
	 *
	 * `null` bei Durchgängen, die vorher geschlossen wurden. Für sie bleibt es
	 * beim lebenden Lesen, aus demselben Grund wie bei `vertretungen`: Eine
	 * nachträgliche Rekonstruktion hiesse, ein Ergebnis zu berichtigen, das
	 * niemand berichtigt hat.
	 */
	ausstand: Id[] | null;
	/**
	 * L8 (Migration 184): Die Kennungen des Ausstands, der aus der Einstellung
	 * der Gemeinschaft kommt, nicht aus einer Erklärung — das Merkmal zum
	 * zweiten Ergebnis. Unter «Vollmachten ruhen» stehen sie auch in `ausstand`,
	 * unter «Die Sitzungsleitung entscheidet» nur hier. `null` bei Durchgängen
	 * von vorher, wie bei `ausstand`.
	 */
	ausstandVerwaltung: Id[] | null;
	/**
	 * Wer beim Schliessen als betroffen eingetragen war, samt Vorab-Vermerk
	 * (Migration 124, Block A2).
	 *
	 * **Seit Betroffene sich im Saal eintragen lassen.** Vorher las das
	 * Ergebnis sie aus `agenda_item_affected`, wie sie jetzt stehen; das war
	 * dicht, solange sie sich nur im Entwurf ändern liessen. Der Schreibweg im
	 * Saal sperrt nur bei offenem Durchgang, und eine Änderung danach wirkte
	 * sonst auf einen geschlossenen, noch nicht verkündeten Durchgang zurück
	 * (offener Stichentscheid). Derselbe Grund wie bei `ausstand`.
	 *
	 * `null` bei Durchgängen, die vorher geschlossen wurden. Für sie wird
	 * gelesen, wer jetzt eingetragen ist, und ohne Vorab-Vermerke: Die gab es
	 * damals nicht, und ein später gesetzter soll nicht zurückwirken.
	 */
	betroffene: BetroffeneImDurchgang[] | null;
	/**
	 * Der Entscheid einer Person bei Stimmengleichheit, wo das Reglement ihn
	 * vorsieht. Null, solange keiner nötig war oder keiner vorliegt.
	 */
	stichentscheid: (Stichentscheidbefund & { entschiedenAm: Zeitpunkt }) | null;
	/**
	 * Der angenommene Rückkommensantrag, auf den sich dieser Durchgang stützt
	 * (FR-44). Null beim ersten Durchgang und bei einer Überholung, ausser
	 * ein angenommenes Rückkommen wartet noch auf seinen Durchgang
	 * (`rueckkommenZuEroeffnen`, Migration 131).
	 *
	 * **Wozu die Seite ihn braucht:** Ein Rückkommensbeschluss trägt genau einen
	 * Durchgang. Ohne dieses Feld liesse sich nicht sagen, ob er schon verbraucht
	 * ist — und die Sitzungsleitung erführe erst aus der Absage, dass es einen
	 * neuen Antrag braucht.
	 */
	rueckkommensantragId: Id | null;
	/**
	 * Details, Präzisierungen oder Änderungen zum Beschluss dieses Durchgangs
	 * (Auftraggeber, 09.09.2026). Null, wenn es nichts zu präzisieren gibt.
	 *
	 * **Er setzt nie Annahme oder Ablehnung** — die kommen hart aus der
	 * Auszählung. Er sagt, was am Beschluss darüber hinaus gilt: «zum Kostendach
	 * von CHF 8'000», «unter dem Vorbehalt, dass die Verwaltung CHF 3'150
	 * rückerstattet».
	 */
	beschlusstext: string | null;
	/**
	 * Die von Hand gezählten Summen — oder null, wenn einzeln erfasst wurde.
	 *
	 * **Die beiden Wege schliessen sich aus**, und das ist keine Formalie: Eine
	 * Auszählung, die beides zugleich hätte, könnte zwei verschiedene Ergebnisse
	 * ausweisen. Die Schranke steht in `erfasseSummen` und in `gibStimmenAb`,
	 * nicht in der Datenbank — sie betrifft zwei Tabellen.
	 */
	handzaehlung: {
		ja: number;
		nein: number;
		enthaltung: number;
		/** Die zweite Zählung an der Einsprache (Migration 172), die andere als `ja/nein/enthaltung`. */
		andereJa: number | null;
		andereNein: number | null;
		andereEnthaltung: number | null;
		vermerk: string | null;
		erfasstAm: Zeitpunkt | null;
	} | null;
	/** Stützt sich der Durchgang auf die Universalversammlung, sonst null (Migration 128). */
	universal: Universaldurchgang | null;
}

function ausDb(z: Rundenzeile): Durchgangsstand {
	return {
		id: z.id,
		meetingId: z.meeting_id,
		traktandumId: z.agenda_item_id,
		nummer: Number(z.ordinal),
		zustand: z.state,
		eroeffnetAm: z.opened_at.toISOString(),
		geschlossenAm: z.closed_at?.toISOString() ?? null,
		ueberholtAm: z.superseded_at?.toISOString() ?? null,
		ueberholungsart: z.supersede_kind,
		ueberholungsgrund: z.supersede_reason,
		ersetztDurchId: z.superseded_by_round_id,
		verkuendetAm: z.result_published_at?.toISOString() ?? null,
		geheim: z.secret,
		geheimBeschlossen: z.secret_resolved === true,
		geheimNachReglement: z.secret_by_bylaw === true,
		konsultativ: z.consultative,
		konsultativNeu: z.consultative_reason === 'neu_an_zweiter',
		erfordernis: z.requirement_json,
		anwesende: z.attendance_json?.anwesende ?? null,
		vonHand:
			(z.result_json as { auszaehlung?: { vonHand?: unknown } } | null)?.auszaehlung?.vonHand !==
			undefined,
		vertretungen: z.attendance_json?.vertretungen ?? [],
		ausstand: z.attendance_json?.ausstand ?? null,
		ausstandVerwaltung: z.attendance_json?.ausstandVerwaltung ?? null,
		betroffene: z.affected_json ?? null,
		stichentscheid:
			z.tie_break_choice && z.tie_break_by && z.tie_break_at
				? {
						wahl: z.tie_break_choice,
						wer: z.tie_break_by,
						begruendung: z.tie_break_reason ?? undefined,
						...(z.tie_break_by_owner ? { eigentuemer: true } : {}),
						entschiedenAm: z.tie_break_at.toISOString()
					}
				: null,
		rueckkommensantragId: z.reconsideration_item_id,
		beschlusstext: z.decision_text,
		universal:
			z.universal_mode && z.universal_confirmed_at
				? {
						variante: z.universal_mode,
						bestaetigtAm: z.universal_confirmed_at.toISOString(),
						bestaetigtDurch: z.universal_confirmed_by ?? '',
						stand: z.universal_json
					}
				: null,
		handzaehlung:
			z.tally_yes !== null && z.tally_no !== null && z.tally_abstain !== null
				? {
						ja: Number(z.tally_yes),
						nein: Number(z.tally_no),
						enthaltung: Number(z.tally_abstain),
						andereJa: z.tally_other_yes !== null ? Number(z.tally_other_yes) : null,
						andereNein: z.tally_other_no !== null ? Number(z.tally_other_no) : null,
						andereEnthaltung: z.tally_other_abstain !== null ? Number(z.tally_other_abstain) : null,
						vermerk: z.tally_note,
						erfasstAm: z.tally_at?.toISOString() ?? null
					}
				: null
	};
}

// ── Lesen ───────────────────────────────────────────────────────────────────

/**
 * Über welche Traktanden eines **ganzen Abends** schon entschieden ist.
 *
 * **Der Anlass** (Auftraggeber, 25.08.2026): «und wenn 2.1 bereits abgestimmt, kann ich
 * dort nicht nochmals abstimmen, wie es der button suggeriert.» In der Leitung
 * eines Hauses verschwindet der Knopf seit dem 20.08. am behandelten Geschäft;
 * am Abend stand er weiter da, und jeder Klick endete in derselben roten Absage.
 *
 * **Entschieden** heisst: ein geschlossener, nicht überholter Durchgang —
 * dieselbe Rechnung wie in `traktanden.ts` («behandelt») und in der Leitung des
 * Hauses. Ein überholter zählt nicht: Nach einer angesetzten Neuabstimmung ist
 * die Frage wieder offen.
 *
 * Eine Abfrage über den Abend statt eine je Haus: Die Liste zeigt alle Häuser
 * nebeneinander, und fünf Abfragen für eine Seite sind fünf Gelegenheiten, eine
 * zu vergessen.
 */
export async function holeEntschiedeneAmAbend(operatorId: Id, tagId: Id): Promise<Id[]> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * Dazu die Traktanden, deren Beschluss ein Folgeantrag nach einem
		 * Rückkommen ersetzt hat (Migration 133): Sie haben keinen eigenen
		 * geltenden Durchgang mehr und sind doch entschieden. Ohne sie stand
		 * dort wieder «Abstimmen», und der Server wies es ab (Codeprüfung B1).
		 *
		 * Ohne konsultative Durchgänge (H7, Teil D; `entscheidetDasGeschaeft`):
		 * Nach ihnen ist das Geschäft offen, und der nächste Durchgang überholt
		 * sie. Am Abend entsteht heute keiner, die Frage bleibt dieselbe wie im
		 * Haus.
		 */
		const zeilen = await tx<{ agenda_item_id: string }[]>`
			SELECT DISTINCT v.agenda_item_id
			  FROM voting_round v
			  JOIN meeting m ON m.id = v.meeting_id
			 WHERE m.meeting_day_id = ${tagId}
			   AND v.state = 'geschlossen'
			   AND v.superseded_at IS NULL
			   AND NOT v.consultative
			UNION
			SELECT a.id
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE m.meeting_day_id = ${tagId}
			   AND durch_anderes_traktandum_ersetzt(a.id)
		`;
		return zeilen.map((z) => z.agenda_item_id);
	});
}

export async function holeDurchgaenge(
	operatorId: Id,
	meetingId: Id
): Promise<Durchgangsstand[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE meeting_id = ${meetingId}
			ORDER BY agenda_item_id, ordinal
		`;
		return zeilen.map(ausDb);
	});
}

export async function holeOffenen(
	operatorId: Id,
	meetingId: Id
): Promise<Durchgangsstand | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
		`;
		return z ? ausDb(z) : null;
	});
}

/**
 * Die Stimmen eines Durchgangs, in der Gestalt, die der Kern erwartet.
 *
 * Über die Momentaufnahme aufgelöst: Gespeichert sind die Zeilenkennungen der
 * Momentaufnahme, der Kern rechnet mit den Kennungen aus den Stammdaten, wie
 * sie in der Momentaufnahme als Werte mitgeführt sind (AD-3).
 */
async function leseStimmen(tx: Tx, durchgangId: Id): Promise<Vote[]> {
	const zeilen = await tx<
		{
			party_id: string;
			unit_id: string;
			choice: VoteChoice;
			cast_at: Date;
			recorded_by_chair: boolean;
		}[]
	>`
		SELECT p.party_id, u.unit_id, v.choice, v.cast_at, v.recorded_by_chair
		FROM vote v
		JOIN snapshot_party p ON p.id = v.snapshot_party_id
		JOIN snapshot_unit u ON u.id = v.snapshot_unit_id
		WHERE v.round_id = ${durchgangId}
		ORDER BY v.cast_at, v.id
	`;
	return zeilen.map((z) => ({
		partyId: z.party_id,
		unitId: z.unit_id,
		choice: z.choice,
		castAt: z.cast_at.toISOString(),
		recordedByChair: z.recorded_by_chair
	}));
}

export async function holeStimmen(operatorId: Id, durchgangId: Id): Promise<Vote[]> {
	return alsBetreiber(operatorId, (tx) => leseStimmen(tx, durchgangId));
}

/**
 * Alle Stimmen einer Versammlung, nach Durchgang geordnet — in einer Abfrage.
 *
 * Für das Abschlusspaket (Code-Review 17.09.2026): Eine Abfrage je Durchgang
 * öffnete bei dreissig Durchgängen dreissig Verbindungen gegen einen Vorrat von
 * zehn. Die Ordnung ist dieselbe wie bei `holeStimmen`, damit «die letzte
 * Stimme je Einheit» in beiden Wegen dieselbe ist.
 */
export async function holeStimmenDerVersammlung(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, Vote[]>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				round_id: string;
				party_id: string;
				unit_id: string;
				choice: VoteChoice;
				cast_at: Date;
				recorded_by_chair: boolean;
			}[]
		>`
			SELECT v.round_id, p.party_id, u.unit_id, v.choice, v.cast_at, v.recorded_by_chair
			FROM vote v
			JOIN voting_round r ON r.id = v.round_id
			JOIN snapshot_party p ON p.id = v.snapshot_party_id
			JOIN snapshot_unit u ON u.id = v.snapshot_unit_id
			WHERE r.meeting_id = ${meetingId}
			ORDER BY v.cast_at, v.id
		`;
		const je = new Map<Id, Vote[]>();
		for (const z of zeilen) {
			const liste = je.get(z.round_id) ?? [];
			liste.push({
				partyId: z.party_id,
				unitId: z.unit_id,
				choice: z.choice,
				castAt: z.cast_at.toISOString(),
				recordedByChair: z.recorded_by_chair
			});
			je.set(z.round_id, liste);
		}
		return je;
	});
}

/**
 * Wie viele Stimmzeilen ein Durchgang trägt — für den Ereignisstrom.
 *
 * **Nicht dasselbe wie «wie viele haben abgestimmt».** Eine Berichtigung fügt
 * eine Zeile hinzu (AD-5), ohne dass eine Partei dazukäme. Wer nur die Parteien
 * zählt, sieht eine geänderte Stimme nie — genau daran hing der Befund vom
 * 21.08.2026.
 *
 * Die Zahl trägt weder Namen noch Verteilung: Sie sagt, dass sich etwas geändert
 * hat, nicht was (AD-11).
 */
export async function zaehleStimmzeilen(operatorId: Id, durchgangId: Id): Promise<number> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM vote WHERE round_id = ${durchgangId}
		`;
		return Number(z?.anzahl ?? 0);
	});
}

/**
 * Der Fortschritt einer offenen Abstimmung — ohne Verteilung (Story 5.8).
 *
 * Die Verteilung wird hier gar nicht erst geholt. Was nicht geladen wird, kann
 * keine Sicht versehentlich anzeigen und kein Ereignisstrom versehentlich
 * hinaustragen.
 */
export async function holeFortschritt(
	operatorId: Id,
	meetingId: Id,
	durchgangId: Id
): Promise<Fortschritt> {
	return alsBetreiber(operatorId, async (tx) => {
		/*
		 * **Der volle Stand, nicht nur die Kennungen**: `leseAusstandssperre`
		 * braucht den Erfassungsweg, um zu erkennen, wer allein über eine im
		 * Ausstand stehende Person vertreten ist.
		 */
		const stand = await leseAnwesenheitsstand(tx, meetingId);
		const anwesende = stand.map((a) => a.parteiId);
		const zeilen = await tx<{ party_id: string }[]>`
			SELECT DISTINCT p.party_id
			FROM vote v
			JOIN snapshot_party p ON p.id = v.snapshot_party_id
			JOIN voting_round r ON r.id = v.round_id
			WHERE v.round_id = ${durchgangId} AND r.meeting_id = ${meetingId}
		`;

		/*
		 * **Wer im Ausstand ist, wird nicht erwartet** (Nachprüfung 23.08.2026).
		 * Seit 25.09.2026 ebenso, wer als betroffen nicht mitstimmt
		 * (`betroffeneStimmenNichtMit`); beide kommen aus `leseAusstandssperre`.
		 *
		 * Bis hierher zählte der Fortschritt alle Anwesenden: «0 von 3 haben
		 * abgestimmt», obwohl nur zwei durften. Und beim Schliessen warnte die
		 * Rückfrage «1 von 3 Partei hat noch nicht gestimmt» — und meinte damit
		 * genau die Partei, die nicht stimmen darf. Eine Warnung, die zum Warten
		 * auf etwas auffordert, das nie kommt.
		 *
		 * Die Auszählung nimmt den Ausstand längst heraus (er fällt aus der
		 * Bezugsgrösse); nur die Anzeige daneben tat es nicht.
		 */
		/*
		 * **Beide Arten, nicht nur die eine** (Code-Review 06.09.2026). Der
		 * Ausstand sperrt zweierlei: die Partei selbst und jede, die allein über
		 * sie vertreten ist (`vertretung_ruht`). Die frühere Abfrage hier las
		 * nur `recusal` und zählte die zweite Sorte weiter mit. Das fiel nicht
		 * auf, solange nur eine Zahl dastand — seit die Namen daneben stehen,
		 * riefe die Sitzungsleitung jemanden auf, dessen Stimme der Server
		 * ohnehin abweist. `leseAusstandssperre` kennt beide Fälle und ist
		 * dieselbe Quelle, aus der die Stimmabgabe ihre Absage begründet.
		 */
		const [durchgang] = await tx<{ agenda_item_id: string }[]>`
			SELECT agenda_item_id FROM voting_round
			 WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
		`;
		const sperren = durchgang
			? await leseAusstandssperre(tx, meetingId, durchgang.agenda_item_id, stand)
			: new Map<Id, unknown>();
		const imAusstand = new Set(sperren.keys());

		/*
		 * **Die Namen dazu** (Bedienbarkeitsprüfung 05.09.2026): «Im Saal ruft man
		 * Namen auf, nicht Zahlen.» Genommen aus dem eingefrorenen Stand, nicht
		 * aus `party` — sonst stünde dort ein Name, den die Versammlung nie
		 * gesehen hat, wenn jemand ihn zwischendurch ändert.
		 *
		 * **Nur wenn wirklich jemand fehlt** (Code-Review 06.09.2026). Diese
		 * Funktion läuft bei jeder Anwesenheitsänderung und bei jedem
		 * Verbindungsaufbau eines Beamers oder Telefons; für einen geschlossenen
		 * Durchgang wäre das Ergebnis nur wegzuwerfen.
		 */
		const berechtigte = anwesende.filter((p) => !imAusstand.has(p));
		const habenGestimmt = new Set(zeilen.map((z) => z.party_id));
		const benannt = berechtigte.some((p) => !habenGestimmt.has(p))
			? await tx<{ party_id: string; display_name: string }[]>`
					SELECT party_id, display_name FROM snapshot_party WHERE meeting_id = ${meetingId}
				`
			: [];
		return fortschritt(
			berechtigte,
			zeilen.map((z) => ({ partyId: z.party_id })),
			new Map(benannt.map((b) => [b.party_id, b.display_name]))
		);
	});
}

/**
 * Wer gerade anwesend ist — und **auf welchem Weg**.
 *
 * Der Weg wird für eine einzige Frage gebraucht: Beruht die Anwesenheit allein
 * auf einer Vollmacht? Dann trägt sie nicht mehr, sobald die bevollmächtigte
 * Person in den Ausstand tritt. Wer selbst im Saal steht, ist davon unberührt.
 */
async function leseAnwesenheitsstand(
	tx: Tx,
	meetingId: Id,
	bis?: Zeitpunkt
): Promise<{ parteiId: Id; weg: Erfassungsweg | null }[]> {
	const ereignisse = await leseEreignisse(tx, meetingId);
	const parteien = new Set(ereignisse.map((e) => e.parteiId));
	const anwesende: { parteiId: Id; weg: Erfassungsweg | null }[] = [];
	for (const parteiId of parteien) {
		const stand = standVon(
			ereignisse.filter((e) => e.parteiId === parteiId),
			bis
		);
		if (stand?.zustand === 'anwesend') anwesende.push({ parteiId, weg: stand.weg });
	}
	return anwesende.sort((a, b) => a.parteiId.localeCompare(b.parteiId));
}

/** Wer gerade anwesend ist — die Parteikennungen, aufgelöst aus der Ereignisfolge. */
async function leseAnwesende(tx: Tx, operatorId: Id, meetingId: Id, bis?: Zeitpunkt): Promise<Id[]> {
	return (await leseAnwesenheitsstand(tx, meetingId, bis)).map((a) => a.parteiId);
}

/**
 * Die Vollmachten, auf denen eine Anwesenheit **beruht** — auf die Kennungen der
 * Stammdaten gebracht.
 *
 * **Zwei Kennungen, die man nicht verwechseln darf.** Die Vollmacht hängt an der
 * Zeile des eingefrorenen Stimmberechtigtenstands (`snapshot_party.id`), weil
 * sie für genau eine Versammlung gilt; der Kern und der Ausstand rechnen mit der
 * Kennung der Stammdaten (`party.id`). Übersetzt wird hier, an einer Stelle —
 * sonst prüfte die Auszählung zwei Kennungsarten gegeneinander und fände nie
 * etwas.
 *
 * **Und nur, wo die Anwesenheit wirklich daran hängt.** Erscheint die vertretene
 * Person doch noch selbst, endet die Vollmacht ohnehin; bliebe hier trotzdem
 * eine stehen, nähme der Ausstand ihres früheren Vertreters ihr die eigene
 * Stimme weg. Der Weg `vertretung` sagt es genau: Sie steht in der
 * Anwesenheitsliste, weil jemand anders für sie da ist.
 *
 * **Auch Vollmachten auf eine dritte Person** (seit Migration 167, Ä-26): Sie
 * ist nicht stimmberechtigt, kann aber in den Ausstand treten, und dann ruhen
 * ihre Vollmachten. Sie steht unter `vertreterkennung` und mit ihrem Namen da;
 * bis dahin fehlte sie hier, und ihre Vollmachten zählten immer.
 */
async function leseVertretungen(
	tx: Tx,
	meetingId: Id,
	stand: { parteiId: Id; weg: Erfassungsweg | null }[]
): Promise<Vertretung[]> {
	const ueberVertretungDa = new Set(
		stand.filter((a) => a.weg === 'vertretung').map((a) => a.parteiId)
	);
	if (ueberVertretungDa.size === 0) return [];

	const zeilen = await tx<
		{ vertretene: string; bevollmaechtigt: string | null; holder_name: string | null }[]
	>`
		SELECT rp.party_id AS vertretene, hp.party_id AS bevollmaechtigt, x.holder_name
		FROM proxy x
		JOIN snapshot_party rp ON rp.id = x.represented_id
		LEFT JOIN snapshot_party hp ON hp.id = x.holder_id
		WHERE x.meeting_id = ${meetingId} AND x.state = 'bestaetigt'
		ORDER BY rp.display_name
	`;
	return zeilen
		.filter((z) => ueberVertretungDa.has(z.vertretene))
		.flatMap((z): Vertretung[] => {
			if (z.bevollmaechtigt) return [{ vertreteneId: z.vertretene, bevollmaechtigtId: z.bevollmaechtigt }];
			const name = z.holder_name?.trim();
			// Eine Vollmacht ohne Partei und ohne Namen gibt es nach `pruefeEingabe`
			// nicht; ohne Namen liesse sie sich keinem Ausstand zuordnen.
			return name
				? [{ vertreteneId: z.vertretene, bevollmaechtigtId: vertreterkennung(name), bevollmaechtigtName: name }]
				: [];
		});
}

/**
 * Wer bei diesem Traktandum im Ausstand ist, als Kennungen der Zählung: die
 * Partei, oder bei einem Vertreter ohne Partei dessen Kennung (Migration 167,
 * Ä-26). **Eine Stelle für alle Leser**, damit kein Leser den Vertreter
 * übersieht oder eine leere Partei mitnimmt; sie ruhen seine Vollmachten
 * über `ruhendeVertretungenBei`, sonst nichts: Eine Vertreterkennung ist nie
 * eine Partei der Momentaufnahme.
 *
 * **Seit L8** (Migration 184) steht die Verwaltung dazu, solange die
 * Gemeinschaft «Vollmachten ruhen» gewählt hat: An einem Traktandum mit
 * Häkchen gilt jeder Vertreter mit Verwaltungsvollmacht als im Ausstand,
 * ohne dass jemand ihn erklärt — mit derselben Kennung wie ein erklärter
 * Vertreterausstand. So greifen Stimmsperre, L7 und das Schliessen für ihn
 * wie für einen erklärten Ausstand; das Merkmal, dass es aus L8 kommt,
 * trägt allein der eingefrorene Schlussstand (`ausstandVerwaltung`).
 *
 * **Eine Lesung für alle** (G8, 06.11.2026): `leseSchlussstand` friert
 * dieselben Listen ein und geht deshalb durch denselben Helfer
 * (`leseAusstandMitVerwaltung`) statt den Ausstand ein zweites Mal zu
 * rechnen; zwei Lesungen desselben Standes liefen beim nächsten Umbau
 * auseinander.
 */
async function leseAusstandskennungen(tx: Tx, meetingId: Id, traktandumId: Id): Promise<Id[]> {
	return (await leseAusstandMitVerwaltung(tx, meetingId, traktandumId)).ausstand;
}

/**
 * Der Ausstand dieses Traktandums in beiden Teilen (G8, 06.11.2026): die
 * Kennungen, nach denen gerechnet wird — deklariert, unter «Vollmachten
 * ruhen» dazu die Verwaltung —, und das Merkmal, welche Kennungen aus L8
 * kommen, das auch unter «Die Sitzungsleitung entscheidet» steht, weil das
 * zweite Ergebnis nach der anderen Wahl mit ihm rechnet.
 */
async function leseAusstandMitVerwaltung(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<{ ausstand: Id[]; verwaltung: { kennungen: Id[]; namen: string[] } }> {
	const [deklariert, verwaltung, wahl] = await Promise.all([
		tx<{ party_id: string | null; holder_key: string | null }[]>`
			SELECT r.party_id, r.holder_key
			FROM recusal r
			JOIN agenda_item a ON a.id = r.agenda_item_id
			WHERE r.agenda_item_id = ${traktandumId} AND a.meeting_id = ${meetingId}
			ORDER BY r.party_id, r.holder_key
		`.then((zeilen) => zeilen.map((z) => z.party_id ?? VERTRETERKENNUNG_VORSATZ + (z.holder_key ?? ''))),
		leseVerwaltungsausstandIn(tx, meetingId, traktandumId),
		holeLesartenIn(tx, { meetingId }).then((l) => l.L8)
	]);
	// Aus dem gespeicherten Schlüssel (Codeprüfung, N5). Die Vollmachten bilden
	// ihre Kennung aus dem Namen mit `vollmachtsschluessel`; ändert sich die
	// Funktion je, sind die gespeicherten `holder_key` mitzuführen, sonst passen
	// Ausstand und Vollmacht nicht mehr zusammen.
	return {
		ausstand: wahl === 'ruhen' ? [...deklariert, ...verwaltung.kennungen] : deklariert,
		verwaltung
	};
}

/**
 * L8 (Migration 184): Die Verwaltung als Vertreterin ohne Partei an einem
 * Traktandum mit Häkchen, als Kennungen der Zählung (`vertreter:` +
 * `vollmachtsschluessel` des Namens) und mit dem Namen für die Anzeige.
 *
 * **Entscheid 8 (07.11.2026):** Steht das Erfordernis des Traktandums auf
 * der Wahl oder der erweiterten Wahl der Verwaltung, wirkt das Häkchen
 * nicht: kein Ausstand aus L8, die Vollmachten zählen, kein zweites
 * Ergebnis. Im Entwurf kann die Kombination gar nicht entstehen (die Absage
 * am Häkchen), nach der Freigabe lässt Votum das Erfordernis zu, und
 * `wahlTrotzHaekchen` trägt dieselben Kennungen für den Satz an die Leitung.
 *
 * **Lauf 5 (07.11.2026):** Drei Ergänzungen aus der Prüfung von Lauf 4. Der
 * Knoten kommt aus dem offenen bzw. schliessenden Durchgang, wie die
 * Stimmsperre die Kopfbasis liest (M-1): Das Erfordernis am Traktandum
 * lässt sich während der Runde ändern, gesperrt und gezählt wird mit dem
 * eingefrorenen. Am Rückkommen gilt der Knoten des Ziels (M-3): Bei der
 * abgelehnten Wiederwahl trägt der Antrag das einfache Mehr des
 * Ordnungsantrags, und das geerbte Häkchen wirkt trotzdem nicht. Am
 * Wahlknoten trägt `wahlTrotzHaekchen` auch die Kennungen, deren Ausstand
 * vorab erklärt ist, und `ausstandErklaert` heisst sie beim Namen (R3-3):
 * Der Satz dazu sagt der Leitung, sie nehme den erklärten Ausstand vor der
 * Abstimmung zurück. Die Ausstandsliste bleibt ohne sie.
 *
 * **Nur die nicht erklärten:** Wer für sich schon im Ausstand steht
 * (`recusal.holder_key`, Migration 167), ruht über den erklärten Ausstand;
 * das Merkmal aus L8 trägt, was ohne Erklärung ruht, und der zweite Ergebnis
 * vergleicht sonst einen Ausstand, den es nach der anderen Wahl immer noch
 * gibt.
 *
 * **Nur bestätigte Vollmachten** (Sicherheitsbefund der Prüfung von Lauf 2,
 * 06.11.2026): Eine erfasste, unbestätigte Vollmacht über `/z/` kann jeder
 * Eigentümer mit Zugangscode allein erteilen, und weil der Ausstand je Name
 * gilt, ruhten sonst an jedem Traktandum mit Häkchen alle Vollmachten dieser
 * Person, auch die bestätigten anderer Eigentümer. Die Bestätigung ist der
 * Punkt, an dem die Sitzungsleitung die Vollmacht gesehen hat; erst sie
 * wirkt. Der erklärte Ausstand bindet weiterhin auch erfasste
 * (`erklaereVertreterausstand`): Dort entscheidet die Leitung, und eine
 * erfasste Vollmacht darf sie ausdrücklich in den Ausstand nehmen.
 *
 * **Entdoppelt nach dem normalisierten Schlüssel** (G-2, 07.11.2026), nicht
 * nach `holder_name`: Zwei Schreibweisen desselben Namens sind dieselbe
 * Person, und über die Kennung hängen beide an denselben Vertretenen; in
 * der Liste stünde die Verwaltung sonst zweimal, und die Zahl der ruhenden
 * Vollmachten wäre zu hoch.
 *
 * **Der Schlüssel in JavaScript, nicht in SQL** (`vollmachtsschluessel`):
 * Zwei Umsetzungen derselben Normalisierung liefen auseinander, sobald die
 * Sprachen Leerzeichen verschieden verstehen; die Lehre steht bei
 * `verlangeVollmachtsgrenze` in `server/vollmacht.ts`.
 *
 * bindung: meetingId — `agenda_item` und `proxy` werden mit `meeting_id`
 * gefiltert; ein fremdes Traktandum trägt kein Häkchen und liefert leer.
 */
async function leseVerwaltungsausstandIn(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<{
	kennungen: Id[];
	namen: string[];
	wahlTrotzHaekchen: Id[];
	/** R3-3 (07.11.2026): Am Wahlknoten die Kennungen mit vorab erklärtem Ausstand. */
	ausstandErklaert: Id[];
	/**
	 * Entscheid 0045, Punkt 9 (07.11.2026): Am Knoten der Abberufung die
	 * Kennungen, an denen das geerbte Häkchen nicht von selbst wirkt; ohne die
	 * mit erklärtem Ausstand, denn dort hat die Leitung schon entschieden.
	 */
	abberufungTrotzHaekchen: Id[];
	/**
	 * Entscheid 0045, Punkt 11 (08.11.2026): An einem Folgeantrag mit Angabe
	 * der Leitung (andere Verwaltung, Kündigung) der Grund und die Kennungen,
	 * an denen das geerbte Häkchen deshalb nicht von selbst wirkt; ohne die
	 * mit erklärtem Ausstand, wie an der Abberufung.
	 */
	angabeTrotzHaekchen: { grund: Verwaltungsangabe; kennungen: Id[] } | null;
}> {
	const [t] = await tx<{
		concerns_management: boolean;
		requirement_node: string | null;
		spontaneous_kind: string | null;
		reconsiders_item_id: string | null;
		management_exemption: Verwaltungsangabe | null;
	}[]>`
		SELECT concerns_management, requirement_node, spontaneous_kind, reconsiders_item_id, management_exemption
		FROM agenda_item
		WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
	`;
	const leer = {
		kennungen: [],
		namen: [],
		wahlTrotzHaekchen: [],
		ausstandErklaert: [],
		abberufungTrotzHaekchen: [],
		angabeTrotzHaekchen: null
	};
	if (!t?.concerns_management) return leer;
	const [vertreter, erklaerte] = await Promise.all([
		tx<{ holder_name: string }[]>`
			SELECT x.holder_name
			FROM proxy x
			WHERE x.meeting_id = ${meetingId}
			  AND x.holder_id IS NULL AND x.holder_is_management
			  AND x.holder_name IS NOT NULL
			  AND x.state = 'bestaetigt'
			ORDER BY x.holder_name
		`,
		tx<{ holder_key: string }[]>`
			SELECT r.holder_key
			FROM recusal r
			WHERE r.agenda_item_id = ${traktandumId} AND r.holder_key IS NOT NULL
		`
	]);
	const schonErklaert = new Set(erklaerte.map((z) => z.holder_key));
	const kennungen: Id[] = [];
	const namen: string[] = [];
	// R3-3 (07.11.2026): Am Wahlknoten trägt das Merkmal auch die Kennungen,
	// deren Ausstand vorab erklärt ist; der Satz dazu heisst, die Leitung
	// nehme ihn zurück. Die Ausstandsliste bleibt ohne sie: Der erklärte
	// Ausstand steht in der Tabelle und wirkt über sie.
	const amWahl: Id[] = [];
	const amWahlErklaert: Id[] = [];
	for (const z of vertreter) {
		const name = z.holder_name.trim();
		if (!name) continue;
		const schluessel = vollmachtsschluessel(name);
		if (!schluessel) continue;
		// G-2: Der normalisierte Schlüssel entdoppelt, nicht der Name; die
		// erste Schreibweise alphabetisch gewinnt, weil die Abfrage so sortiert.
		const kennung = VERTRETERKENNUNG_VORSATZ + schluessel;
		if (amWahl.includes(kennung)) continue;
		amWahl.push(kennung);
		if (schonErklaert.has(schluessel)) {
			amWahlErklaert.push(kennung);
			continue;
		}
		kennungen.push(kennung);
		namen.push(name);
	}
	/*
	 * M-1 (Lauf 5, 07.11.2026): Der Knoten des offenen bzw. schliessenden
	 * Durchgangs, wie die Stimmsperre die Kopfbasis liest: Das Erfordernis am
	 * Traktandum lässt sich während einer offenen Runde ändern, gesperrt und
	 * gezählt wird mit dem beim Öffnen eingefrorenen. Ohne offene Runde, also
	 * für die Anzeige vorher, gilt das Traktandum.
	 */
	const [offen] = await tx<{ knoten: string | null }[]>`
		SELECT requirement_json->>'knotenId' AS knoten
		FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId} AND state = 'offen'
	`;
	let knoten = offen?.knoten ?? t.requirement_node ?? null;
	// Entscheid 0045, Punkt 9: Die Abberufung nimmt Votum unter dem Häkchen nur
	// am Folgeantrag an; am Rückkommen zählt, ob das Ziel einer ist.
	let amFolgeantrag = t.spontaneous_kind === 'folgeantrag';
	// Entscheid 0045, Punkt 11: Die Angabe steht nur an einem Folgeantrag
	// (CHECK der Migration 185); am Rückkommen gilt die des Ziels.
	let angabe = t.management_exemption;
	/*
	 * M-3 (Lauf 5, 07.11.2026): Das Rückkommen auf eine Wahl erbt das Häkchen,
	 * aber es wirkt dort nicht, wie am Ziel selbst. Bei der abgelehnten
	 * Wiederwahl trägt der Antrag das einfache Mehr des Ordnungsantrags, sein
	 * eigener Knoten sagt nichts über die Wahl; deshalb prüft die Lesung auch
	 * den Knoten des Ziels. Codeprüfung P9, M-1: ebenso am Rückkommen auf eine
	 * Abberufung als Folgeantrag.
	 */
	if (t.spontaneous_kind === 'rueckkommen' && t.reconsiders_item_id) {
		const [ziel] = await tx<{
			requirement_node: string | null;
			spontaneous_kind: string | null;
			management_exemption: Verwaltungsangabe | null;
		}[]>`
			SELECT requirement_node, spontaneous_kind, management_exemption FROM agenda_item
			WHERE id = ${t.reconsiders_item_id} AND meeting_id = ${meetingId}
		`;
		if (ziel?.requirement_node && VERWALTUNGSKNOTEN.has(ziel.requirement_node)) {
			knoten = ziel.requirement_node;
			amFolgeantrag = ziel.spontaneous_kind === 'folgeantrag';
		}
		// Entscheid 0045, Punkt 11: Das Rückkommen auf einen Folgeantrag mit
		// Angabe tut dasselbe wie der Folgeantrag; es trägt selbst keine.
		angabe = ziel?.management_exemption ?? null;
	}
	// Entscheid 8 (07.11.2026): An den Wahlknoten ruht nichts von selbst;
	// die Kennungen trägt das Merkmal für den Satz an die Leitung weiter.
	if (knoten && VERWALTUNGSWAHLKNOTEN.has(knoten)) {
		return { ...leer, wahlTrotzHaekchen: amWahl, ausstandErklaert: amWahlErklaert };
	}
	/*
	 * Entscheid 0045, Punkt 9 (07.11.2026): An der Abberufung, die Votum nach
	 * der Freigabe nur als Folgeantrag annimmt, ruht nichts von selbst; ob
	 * die Vollmachten ruhen, entscheidet die Leitung über den erklärten
	 * Ausstand (Entscheid 0044, Anhang 3). Der wirkt über die Tabelle
	 * `recusal`, nicht über dieses Merkmal; das Merkmal trägt nur, was noch
	 * nicht erklärt ist, für den Satz an die Leitung. Nur am Folgeantrag
	 * (Sicherheitsprüfung P9): Ein Grundantrag mit Häkchen und Abberufung aus
	 * der Zeit vor der Absage G1 (06.11.2026) behält das Ruhen.
	 */
	if (knoten === ABBERUFUNGSKNOTEN && amFolgeantrag) {
		return { ...leer, abberufungTrotzHaekchen: kennungen };
	}
	/*
	 * Entscheid 0045, Punkt 11 (08.11.2026): Hat die Leitung angegeben, dass
	 * der Folgeantrag eine andere als die bisherige Verwaltung oder die
	 * Kündigung ihres Vertrags betrifft, ruht nichts von selbst; die
	 * Vollmachten zählen, bis die Leitung den Ausstand erklärt (`recusal`,
	 * wie an der Abberufung). Nach den Zweigen zu Wahl und Abberufung: Dort
	 * wirkt die Angabe nicht, und Votum nimmt sie dort nicht an
	 * (`verlangeVerwaltungsangabe`). Weil die Lesung hier nichts liefert,
	 * rechnen Stimmsperre, L7, Vorschau und Schluss ohne die Verwaltung.
	 */
	if (angabe) {
		return { ...leer, angabeTrotzHaekchen: { grund: angabe, kennungen } };
	}
	return { ...leer, kennungen, namen };
}

/**
 * L8 (Migration 184): Der Ausstand der Verwaltung als Eintrag der
 * Ausstandsliste der Leitung und der Vorschau der ruhenden Vollmachten (G7,
 * 06.11.2026): dieselbe Gestalt wie ein erklärter Vertreterausstand, mit dem
 * Zusatz hinter dem Namen, der sagt, dass ihn niemand erklärt hat. Nur unter
 * der Vorgabe «Vollmachten ruhen»; unter «Die Sitzungsleitung entscheidet»
 * ruht nichts von selbst. Ohne Begründung, weil keine gegeben wurde, und
 * ohne Zeile in `recusal`: Der Eintrag lässt sich nicht zurücknehmen, sondern
 * nur über die Einstellung der Gemeinschaft ändern; die Kennung `l8:` vor
 * der Vertreterkennung hält ihn von den Zeilen der Tabelle auseinander.
 */
export async function holeVerwaltungsausstand(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<{ id: Id; parteiId: Id; vertreter: boolean; name: string; grund: string }[]> {
	return alsBetreiber(operatorId, async (tx) => {
		if ((await holeLesartenIn(tx, { meetingId })).L8 !== 'ruhen') return [];
		const verwaltung = await leseVerwaltungsausstandIn(tx, meetingId, traktandumId);
		return verwaltung.kennungen.map((kennung, i) => ({
			id: `l8:${kennung}`,
			parteiId: kennung,
			vertreter: true,
			name: `${verwaltung.namen[i]} (nach der Einstellung Ihrer Gemeinschaft)`,
			grund: ''
		}));
	});
}

/**
 * Wessen Stimme bei diesem Traktandum gar nicht erst entgegengenommen wird.
 *
 * Zwei Fälle, und der zweite folgt aus dem ersten:
 *
 *   1. **Wer selbst ausgeschlossen ist**: im Ausstand (ZGB Art. 68 i.V.m.
 *      Art. 712m Abs. 2) oder, seit dem 25.09.2026, als Betroffene unter
 *      `alle_ausser_betroffene`, etwa der Beklagte bei der Ermächtigung zur
 *      Ausschlussklage (ZGB Art. 649b Abs. 2); ihn seit dem 29.09.2026 unter
 *      jeder Kopfbasis (`betroffeneStimmenNichtMit`), ab Fassung 2026-10-20
 *      auch die Betroffene der Einsprache (Art. 712c Abs. 2). Welche das sind,
 *      sagt `vomStimmrechtAusgeschlossen` im Kern.
 *   2. **Wer nur über eine solche Person vertreten ist** (BGE 134 III 481
 *      E. 3.8; Regel und Beleg bei `ruhendeVertretungenBei`). Sonst gäbe der
 *      Ausschluss die Stimme nur weiter, statt sie zu entziehen. **Nicht**
 *      über Betroffene, die nur eine Reglementsklausel aus der Kopfbasis nimmt
 *      (seit 27.09.2026): Sie stimmen nicht selbst, vertreten aber weiter.
 *
 * Beide Fälle gelten **nur für dieses Traktandum**. Beim nächsten stimmen beide
 * wieder mit — und weil das die Frage ist, die im Saal sofort kommt, steht sie
 * in jedem Satz, der daraus gebaut wird.
 */
export interface Stimmsperre {
	parteiId: Id;
	name: string;
	/**
	 * Selbst im Ausstand, selbst als unmittelbar betroffen ausgenommen
	 * (`betroffeneStimmenNichtMit`), nur über eine ausgeschlossene Person
	 * vertreten, oder auf Papier abstimmend (Migration 107).
	 */
	art: 'selbst' | 'betroffen' | 'vertretung_ruht' | 'papier';
	/** Wer vertritt — nur bei `vertretung_ruht`. */
	ueber: string | null;
	/**
	 * Warum der Vertreter ausgeschlossen ist, nur bei `vertretung_ruht`. Nie
	 * `ausgenommen`: Deren Vollmacht ruht nicht.
	 */
	wegen?: Ausschlussgrund;
	/**
	 * Der Knoten der Runde, nur bei `vertretung_ruht` (19.10.2026): Er sagt,
	 * ob `betroffen` der Beklagte der Ausschlussklage ist oder die Partei, die
	 * bei der Einsprache verkauft, vermietet oder belastet.
	 */
	knotenId?: string;
}

/**
 * Der Satz für den Bildschirm. Aus der Sperre gebaut, damit er nur einmal existiert.
 *
 * **Die dritte Art trägt einen anderen Trost** (09.09.2026). Beide
 * Ausstandssätze enden mit «beim nächsten Traktandum geht es wieder», weil ein
 * Ausstand am einzelnen Geschäft hängt. Der Papiervermerk gilt die ganze
 * Versammlung; derselbe Satz wäre dort schlicht gelogen und liesse jemanden am
 * Telefon auf ein Traktandum warten, das nie kommt.
 */
export function sperreInWorten(s: Stimmsperre): string {
	if (s.art === 'papier') {
		return (
			`«${s.name}» stimmt an dieser Versammlung auf Papier ab. Die Stimmen werden von der ` +
			'Sitzungsleitung übertragen, der ausgefüllte Stimmzettel gilt. Am Telefon ist hier ' +
			'darum nichts zu tun.'
		);
	}
	if (s.art === 'selbst') {
		return (
			`«${s.name}» ist bei diesem Traktandum im Ausstand und stimmt darum nicht mit. Beim ` +
			'nächsten Traktandum geht es wieder.'
		);
	}
	/*
	 * **Neutral, nicht «der Beklagte»** (Code-Review 25.09.2026, Befund 3). Die
	 * Kopfbasis `alle_ausser_betroffene` kann auch ein Reglement für ein anderes
	 * Geschäft setzen; dort wären Rechtsgrund und Fundstelle der Ausschlussklage
	 * falsch. Und eine Partei kann eine Frau, ein Paar oder eine Firma sein.
	 */
	if (s.art === 'betroffen') {
		return (
			`«${s.name}» ist bei diesem Traktandum unmittelbar betroffen und von der Abstimmung ` +
			'ausgenommen. Beim nächsten Traktandum geht es wieder.'
		);
	}
	const vertreter = s.ueber ? `«${s.ueber}»` : 'eine Person';
	/*
	 * `betroffen` erreicht diesen Satz seit 27.09.2026 als Beklagter bei der
	 * Ausschlussklage und ab Fassung 2026-10-20 als Betroffene der Einsprache;
	 * wen ein Reglement ausnimmt, dessen Vollmacht ruht nicht. An der
	 * Einsprache ein Satz über die Zählung (Laien- und Fachprüfung Runde 1).
	 * Dass die Betroffene dort keine Vollmachten ausübt: BGE 134 III 481 E. 3.8
	 * (Regeste), übertragen auf den Ausschluss nach Art. 712c Abs. 2;
	 * Fachprüfung F4a, S5.
	 */
	if (s.wegen === 'betroffen' && s.knotenId === EINSPRACHE_KNOTEN) {
		return (
			`«${s.name}» ist über ${vertreter} vertreten, und diese Person stimmt bei der Einsprache ` +
			'gegen das eigene Geschäft nicht mit; Votum zählt ihre Vollmachten hier nicht. Beim ' +
			'nächsten Traktandum gilt die Vollmacht wieder.'
		);
	}
	const lage =
		s.wegen === 'betroffen'
			? 'ist hier als Beklagter der Ausschlussklage vom Stimmrecht ausgeschlossen'
			: 'ist bei diesem Traktandum im Ausstand';
	return (
		`«${s.name}» ist über ${vertreter} vertreten, und die ${lage}. Wer vom Stimmrecht ` +
		'ausgeschlossen ist, kann auch niemanden vertreten. Beim nächsten Traktandum übt ' +
		'dieselbe Vollmacht wieder aus.'
	);
}

async function leseAusstandssperre(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	stand: { parteiId: Id; weg: Erfassungsweg | null }[]
): Promise<Map<Id, Stimmsperre>> {
	/*
	 * **Seit 25.09.2026 auch die Betroffenen unter `alle_ausser_betroffene`**
	 * (weiter unten), seit 29.09.2026 den Beklagten unter jeder Kopfbasis, ab
	 * Fassung 2026-10-20 die Betroffenen der Einsprache. Sie stimmen wie der
	 * Ausgetretene am einzelnen Traktandum nicht mit und gehören darum hierher;
	 * ihre Vollmachten ruhen seit dem 27.09.2026 nur beim Beklagten der
	 * Ausschlussklage und bei der Betroffenen der Einsprache, wen eine
	 * Reglementsklausel ausnimmt, der vertritt weiter (`vomStimmrechtAusgeschlossen`).
	 * Der Papiervermerk gehört nicht hierher, aus dem Grund, der jetzt folgt.
	 *
	 * **Hier steht kein Papiervermerk, und das ist eine Korrektur** (aus dem
	 * Review, 09.09.2026). Der erste Anlauf mischte den Papiervermerk aus
	 * Migration 107 gleich hier ein. Das sah sparsam aus und war der Anfang
	 * einer Flickenkette: Diese Funktion hat DREI Verbraucher mit drei
	 * verschiedenen Bedürfnissen, und der Vermerk gehört nur bei einem davon
	 * dazu.
	 *
	 *   `holeFortschritt`     darf ihn NICHT sehen. Wer herausgerechnet wird,
	 *                         fehlt in «es fehlen noch» — die Sitzungsleitung
	 *                         schlösse die Abstimmung, obwohl die Zettel noch
	 *                         nicht übertragen sind.
	 *   `holeErfassungsstand` darf ihn nicht zum Filtern benutzen: Die
	 *                         Papierpartei ist genau die, deren Stimme dort
	 *                         eingetragen wird.
	 *   `holeStimmsperren`    braucht ihn, denn dort geht es um das Gerät der
	 *                         Partei.
	 *
	 * Zwei der drei hätte das Einmischen still beschädigt, und beide Male wäre
	 * die Behebung eine Ausnahme im Verbraucher gewesen. Deshalb bleibt diese
	 * Funktion beim Ausschluss vom Stimmrecht, und wer den Vermerk will, holt ihn sich mit
	 * `papierSperren()` dazu.
	 */
	const gesperrt = new Map<Id, Stimmsperre>();

	const ausstand = (await leseAusstandskennungen(tx, meetingId, traktandumId)).map((party_id) => ({
		party_id
	}));
	/*
	 * **Und die Betroffenen** (seit 25.09.2026). Unter `alle_ausser_betroffene`
	 * stimmen sie nicht mit, ohne dass jemand einen Ausstand erklärt; der
	 * Fall dafür ist der Beklagte bei der Ermächtigung zur Ausschlussklage
	 * (ZGB Art. 649b Abs. 2), dazu wen eine Reglementsklausel ausnimmt. Den
	 * Beklagten seit 29.09.2026 unter jeder Kopfbasis, auch wenn eine
	 * hinterlegte Klausel sie ersetzt hat (`betroffeneStimmenNichtMit`); ebenso
	 * ab Fassung 2026-10-20 die Betroffenen der Einsprache (Art. 712c Abs. 2).
	 *
	 * **Die Kopfbasis der offenen Runde, nicht die des Traktandums**
	 * (Code-Review 25.09.2026, Befund 1). Das Erfordernis am Traktandum lässt
	 * sich während einer offenen Runde ändern (`erfordernisAenderbar` sperrt
	 * nur nach dem Schliessen), ausgezählt wird aber mit dem beim Öffnen
	 * eingefrorenen. Sperre und Auszählung müssen dieselbe Basis lesen. Nur ohne
	 * offene Runde, also für die Anzeige vorher, gilt das Traktandum.
	 */
	/*
	 * **Und der Knoten dazu** (seit 27.09.2026): Nur am Knoten der
	 * Ausschlussklage und (ab Fassung 2026-10-20) der Einsprache ruhen die
	 * Vollmachten der Betroffenen; wen eine
	 * Reglementsklausel ausnimmt, der vertritt weiter (`vomStimmrechtAusgeschlossen`).
	 * Aus derselben Zeile wie die Kopfbasis, damit beide zur selben Runde gehören.
	 */
	const [offen] = await tx<{ kopfbasis: string | null; knoten: string | null }[]>`
		SELECT requirement_json->>'kopfbasis' AS kopfbasis,
		       requirement_json->>'knotenId' AS knoten
		  FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId} AND state = 'offen'
	`;
	const [t] = offen
		? [offen]
		: await tx<{ kopfbasis: string | null; knoten: string | null }[]>`
				SELECT requirement_head_base AS kopfbasis, requirement_node AS knoten FROM agenda_item
				WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			`;
	const betroffene =
		t &&
		betroffeneStimmenNichtMit({
			kopfbasis: t.kopfbasis as Erfordernis['kopfbasis'],
			knotenId: t.knoten ?? ''
		})
			? await tx<{ party_id: string }[]>`
					SELECT party_id FROM agenda_item_affected WHERE agenda_item_id = ${traktandumId}
				`
			: [];
	if (ausstand.length === 0 && betroffene.length === 0) return gesperrt;

	const ausgeschlossen = vomStimmrechtAusgeschlossen(
		{ kopfbasis: t?.kopfbasis as Erfordernis['kopfbasis'], knotenId: t?.knoten ?? '' },
		ausstand.map((a) => a.party_id),
		betroffene.map((b) => b.party_id)
	);

	const namen = new Map(
		(
			await tx<{ id: string; display_name: string }[]>`
				SELECT party_id AS id, display_name FROM snapshot_party WHERE meeting_id = ${meetingId}
			`
		).map((z) => [z.id, z.display_name])
	);

	for (const [parteiId, grund] of ausgeschlossen) {
		// Ein Vertreter ohne Partei hat kein Gerät und keine Stimme; was sein
		// Ausstand bewirkt, steht bei den ruhenden Vollmachten darunter.
		if (istVertreterkennung(parteiId)) continue;
		gesperrt.set(parteiId, {
			parteiId,
			name: namen.get(parteiId) ?? parteiId,
			art: grund === 'ausstand' ? 'selbst' : 'betroffen',
			ueber: null
		});
	}

	const ruhend = ruhendeVertretungenBei(
		await leseVertretungen(tx, meetingId, stand),
		ausgeschlossen,
		new Set(stand.map((a) => a.parteiId))
	);
	for (const r of ruhend.values()) {
		gesperrt.set(r.vertreteneId, {
			parteiId: r.vertreteneId,
			name: namen.get(r.vertreteneId) ?? r.vertreteneId,
			art: 'vertretung_ruht',
			ueber: r.bevollmaechtigtName ?? namen.get(r.bevollmaechtigtId) ?? null,
			wegen: r.grund,
			...(t?.knoten ? { knotenId: t.knoten } : {})
		});
	}
	return gesperrt;
}

/**
 * Mischt die Parteien ein, die an dieser Versammlung auf Papier abstimmen.
 *
 * Anders als der Ausstand hängt der Vermerk an der Versammlung und nicht am
 * Traktandum: Er gilt an jedem Geschäft, auch an denen ohne jeden Ausstand, und
 * das sind fast alle.
 *
 * **Er wird ausdrücklich dazugeholt und nie eingebaut.** Wer ihn braucht, ruft
 * diese Funktion; wer sie nicht ruft, sieht nur Ausstände. Die Begründung steht
 * bei `leseAusstandssperre`.
 *
 * Gesetzt wird nur, was noch frei ist: Wer zusätzlich im Ausstand steht, behält
 * den Ausstandssatz. Der ist am einzelnen Traktandum die stärkere Aussage, und
 * er sperrt auch die Sitzungsleitung.
 */
async function papierSperren(
	tx: Tx,
	meetingId: Id,
	gesperrt: Map<Id, Stimmsperre>
): Promise<Map<Id, Stimmsperre>> {
	for (const z of await tx<{ party_id: string; name: string }[]>`
		SELECT s.party_id, s.display_name AS name
		  FROM paper_ballot b
		  JOIN snapshot_party s ON s.id = b.snapshot_party_id
		 WHERE b.meeting_id = ${meetingId}
	`) {
		if (gesperrt.has(z.party_id)) continue;
		gesperrt.set(z.party_id, { parteiId: z.party_id, name: z.name, art: 'papier', ueber: null });
	}
	return gesperrt;
}

/**
 * Wer bei diesem Traktandum nicht mitstimmt — für die Anzeige, bevor abgestimmt
 * wird.
 *
 * Dieselbe Rechnung wie beim Entgegennehmen der Stimmen. Zwei Fassungen liefen
 * auseinander, und dann stünde auf dem Bildschirm etwas anderes, als der Server
 * tut.
 */
export async function holeStimmsperren(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Stimmsperre[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const stand = await leseAnwesenheitsstand(tx, meetingId);
		// Mit Papiervermerk: Diese Liste beantwortet «wer stimmt hier nicht selbst
		// mit» und wird vom Telefon der Partei gelesen.
		const ausstand = await leseAusstandssperre(tx, meetingId, traktandumId, stand);
		return [...(await papierSperren(tx, meetingId, ausstand)).values()];
	});
}

// ── Eröffnen und Schliessen ─────────────────────────────────────────────────

/** Das Traktandum, wie das Eröffnen es liest, mit dem Erfordernis in der Form des Durchgangs. */
interface Eroeffnungstraktandum {
	id: string;
	title: string;
	item_kind: string;
	is_spontaneous: boolean | null;
	spontaneous_kind: string | null;
	unannounced_basis: Ausnahmegrund | null;
	parent_id: string | null;
	instruction_bound: boolean;
	withdrawn_at: Date | null;
	erfordernis: Erfordernis | null;
}

/**
 * Was das Eröffnen über Versammlung und Traktandum liest, und die Lage für
 * `pruefeDurchgangsfreigabe`.
 *
 * **Eigene Funktion, seit zwei Wege dieselben Prüfungen fahren** (Plan
 * `docs/plan-beschluss-von-hand-2026-09-30.md`, Block 1): das Eröffnen wirft
 * die Absage, der Notweg sammelt sie für den Verlauf (`haltBeschlussVonHandFest`).
 * Eine Abschrift dort hätte beim nächsten Umbau des Eröffnens eine Prüfung
 * weniger gekannt, ohne dass es auffällt.
 */
async function leseEroeffnungslage(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	universalBestaetigt: boolean
): Promise<{
	m: { state: string; tier: Versammlungsstufe; stweg_id: string };
	t: Eroeffnungstraktandum;
	lage: Freigabelage;
}> {
	const [m] = await tx<{ state: string; tier: Versammlungsstufe; stweg_id: string }[]>`
		SELECT state, tier, stweg_id FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

	const [t] = await tx<Eroeffnungstraktandum[]>`
		SELECT a.id, a.title, a.item_kind, a.is_spontaneous, a.spontaneous_kind, a.withdrawn_at,
		       a.unannounced_basis, a.parent_id, a.instruction_bound,
		       CASE WHEN a.requirement_type IS NULL THEN NULL ELSE jsonb_build_object(
		         'fassung', a.requirement_version,
		         'juristischGegengelesen', false,
		         'astId', a.requirement_branch,
		         'knotenId', a.requirement_node,
		         'typ', a.requirement_type,
		         'titel', a.requirement_title,
		         'rechtsgrundlage', a.requirement_legal_basis,
		         'kopfbasis', a.requirement_head_base,
		         'quotenbasis', a.requirement_quota_base,
		         'kopfSchwelle', CASE WHEN a.requirement_head_numerator IS NULL THEN NULL
		           ELSE jsonb_build_object('zaehler', a.requirement_head_numerator,
		                                   'nenner', a.requirement_head_denominator,
		                                   'art', a.requirement_head_mode) END,
		         'quotenSchwelle', CASE WHEN a.requirement_quota_numerator IS NULL THEN NULL
		           ELSE jsonb_build_object('zaehler', a.requirement_quota_numerator,
		                                   'nenner', a.requirement_quota_denominator,
		                                   'art', a.requirement_quota_mode) END,
		         'zustimmungBetroffenerNoetig', a.requirement_needs_affected_consent,
		         'betroffenenzustimmung', a.requirement_affected_consent_form,
		         'enthaltungZaehltMit', a.requirement_abstention_counts,
		         'pfad', '[]'::jsonb,
		         'quelle', coalesce(a.requirement_source, 'hergeleitet')
		       )
		       -- Die Lesart nur, wo es eine gibt: Ein Schlüssel mit JSON-null sähe
		       -- für einen Leser mit «in» aus wie eine Lesart (Migration 169).
		       || (CASE WHEN a.requirement_reading IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('gemeinschaftslesart', a.requirement_reading) END)
		       -- Ebenso L1 (Migration 170): Ohne Angabe zählt die Auszählung nach der
		       -- Vorgabe, wie bei jedem Traktandum von vorher.
		       || (CASE WHEN a.requirement_reading_l1 IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('ausstandslesart', a.requirement_reading_l1) END)
		       -- Und L3 (Migration 172): die Zählung an der Einsprache.
		       || (CASE WHEN a.requirement_reading_l3 IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('einspracheLesart', a.requirement_reading_l3) END)
		       -- Und L10 (Migration 189): die Zahl der Angehörigen im Ausstand an
		       -- der Ausschlussklage.
		       || (CASE WHEN a.requirement_reading_l10 IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('angehoerigenlesart', a.requirement_reading_l10) END)
		       -- Und L13 (Migration 192): die Zählweise der Köpfe; die Kopfbasis
		       -- trägt schon, was gerechnet wird, die Wahl steht für die Sätze daneben.
		       || (CASE WHEN a.requirement_reading_l13 IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('kopfzaehlweise', a.requirement_reading_l13) END)
		       -- Und das Mehr aus Gesetz und Reglement, wo die Leitung abgewichen ist
		       -- (Migration 173): das zweite Ergebnis für die Leitung.
		       || (CASE WHEN a.requirement_statutory IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('gesetzlich', a.requirement_statutory) END)
		       -- Am Rückkommen die Lesart des aufgehobenen Beschlusses (Migration 181):
		       -- nur für den Satz der Leitung, kein zweites Ergebnis.
		       || (CASE WHEN a.requirement_reading_reconsidered IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('lesartDesBeschlusses', a.requirement_reading_reconsidered) END)
		       -- Die Begründung einer Abweichung: Woran die Auszählung erkennt, dass die
		       -- Leitung abgewichen ist (1a gilt dann nicht, andereZaehlbasisVon).
		       || (CASE WHEN a.requirement_reason IS NULL THEN '{}'::jsonb
		          ELSE jsonb_build_object('begruendung', a.requirement_reason) END) END AS erfordernis
		FROM agenda_item a
		WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
	`;
	if (!t) {
		throw fremdesTraktandum('traktandum');
	}

	const [offen] = await tx<{ anzahl: number }[]>`
		SELECT count(*)::int AS anzahl FROM voting_round
		WHERE meeting_id = ${meetingId} AND state = 'offen'
	`;
	const [betroffen] = await tx<{ anzahl: number }[]>`
		SELECT count(*)::int AS anzahl FROM agenda_item_affected WHERE agenda_item_id = ${traktandumId}
	`;

	/*
	 * **Die Universalversammlung im Moment des Eröffnens** (Migration 128).
	 * Gelesen in derselben Transaktion wie das Einfügen unten, damit
	 * zwischen Prüfung und Durchgang niemand unbemerkt geht.
	 */
	let universal: Freigabelage['universal'] = null;
	if (t.unannounced_basis === 'universal') {
		/*
		 * **Die Sperre am Geschäft**, dieselbe wie beim Widerspruch vor dem
		 * Eröffnen (`haltWiderspruchFest`, Migration 129). Ohne sie gingen
		 * beide gleichzeitig durch, und der Durchgang wüsste nichts vom
		 * Widerspruch. Nach der Sperre gelesen, damit ein eben
		 * festgehaltener Widerspruch hier schon steht.
		 */
		await tx`
			SELECT 1 FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${meetingId} FOR UPDATE
		`;
		const lage = await leseUniversallage(tx, meetingId);
		const widersprochen = (await leseWidersprueche(tx, meetingId)).has(traktandumId);
		universal = lage
			? {
					variante: lage.einstellung.universalvariante,
					befund: lage.befund,
					bestaetigt: universalBestaetigt,
					fruehererWiderspruch: widersprochen,
					// Für den Schluss der Absage, wie auf der Leitungsseite (Punkt 10).
					fruehererBeschluss: widersprochen && (await beschlussGiltIn(tx, meetingId, traktandumId))
				}
			: null;
	}

	const teilentschieden = await leseTeilentschiedenIn(tx, meetingId, traktandumId);

	return {
		m,
		t,
		lage: {
			versammlungszustand: m.state,
			traktandumart: t.item_kind === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme',
			traktandumtitel: t.title,
			erfordernis: t.erfordernis,
			offeneDurchgaenge: Number(offen?.anzahl ?? 0),
			spontan: t.is_spontaneous ?? false,
			spontanart: (t.spontaneous_kind as Spontanart | null) ?? null,
			ausnahme: t.unannounced_basis,
			universal,
			grundantragId: t.parent_id,
			zurueckgezogen: t.withdrawn_at != null,
			betroffene: Number(betroffen?.anzahl ?? 0),
			teilentschieden
		}
	};
}

/**
 * **Entscheid 0045, Punkt 9 (beim Bau geklärt 07.11.2026):** Unter einem
 * Traktandum mit Häkchen die entschiedenen Folgeanträge zur Wahl oder
 * Abberufung der Verwaltung; ist einer da, sperrt das den Grundantrag
 * (`pruefeDurchgangsfreigabe`, `teilentschiedenSatz`). Entschieden wie bei der
 * Prüfung des Rückkommens auf den Grundantrag eines Folgeantrags
 * (`stelleRueckkommensantrag` in `traktanden.ts`): der massgebende Durchgang
 * geschlossen, nicht konsultativ, nicht nach einem Weggang ohne Beschluss.
 * Anders als `hindernisAlsGrundantrag`, das den Weggang als entschieden
 * zählt (Codeprüfung P9, G-1). Der Knoten kommt aus dem Durchgang, wie die Zählung ihn
 * eingefroren hat, nicht vom Traktandum, dessen Erfordernis sich danach noch
 * stellen liesse.
 *
 * bindung: meetingId — der Grundantrag wird mit `meeting_id` gefiltert, die
 * Folgeanträge hängen an ihm.
 */
export async function leseTeilentschiedenIn(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<Teilentscheid[]> {
	const zeilen = await tx<{ id: string; titel: string; knoten: string; durchgang: string }[]>`
		SELECT c.id, c.title AS titel, v.requirement_json->>'knotenId' AS knoten, v.id AS durchgang
		FROM agenda_item g
		JOIN agenda_item c ON c.parent_id = g.id AND c.spontaneous_kind = 'folgeantrag'
		JOIN voting_round v ON v.id = massgebender_durchgang(c.id)
		WHERE g.id = ${traktandumId} AND g.meeting_id = ${meetingId} AND g.concerns_management
		  AND v.state = 'geschlossen' AND NOT v.consultative
		  AND coalesce(v.universal_json->'keinBeschluss'->>'grund', '') <> 'weggang'
		  AND v.requirement_json->>'knotenId' = ANY(${[...VERWALTUNGSKNOTEN]}::text[])
		ORDER BY c.position, c.id
	`;
	// Laienprüfung Runde 5, R5-8, und Fachprüfung Runde 5, R5-2: Der Satz
	// hängt am Ergebnis; gelesen wie überall aus der Festschreibung.
	const teile: Teilentscheid[] = [];
	for (const z of zeilen) {
		const { auszaehlung } = await ergebnisIn(tx, meetingId, z.durchgang);
		teile.push({
			traktandumId: z.id,
			titel: z.titel,
			art: z.knoten === ABBERUFUNGSKNOTEN ? 'abberufung' : 'wahl',
			angenommen: auszaehlung?.angenommen === true
		});
	}
	return teile;
}

/** Dasselbe für die Leitungsseiten, die den Satz vor dem Eröffnen zeigen. */
export async function holeTeilentschieden(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<Teilentscheid[]> {
	return alsBetreiber(operatorId, (tx) => leseTeilentschiedenIn(tx, meetingId, traktandumId));
}

/**
 * Ob der Grundantrag eines Folgeantrags einen erklärten Ausstand trägt
 * (Laienprüfung Runde 5, R5-4; Produktentscheid 07.11.2026): Der Folgeantrag
 * übernimmt ihn nicht, und die Leitung erklärt ihn dort erneut
 * (`AUSSTAND_NICHT_GEERBT`). Nur die Tatsache, nicht wer: Die Liste am
 * Grundantrag nennt die Namen.
 *
 * bindung: traktandumId — `c.id = traktandumId AND c.meeting_id = meetingId`
 *   in der Abfrage; der Grundantrag ebenso über `g.meeting_id`.
 */
export async function holeAusstandAmGrundantrag(operatorId: Id, meetingId: Id, traktandumId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ da: boolean }[]>`
			SELECT EXISTS (
				SELECT 1 FROM agenda_item c
				JOIN agenda_item g ON g.id = c.parent_id AND g.meeting_id = ${meetingId}
				JOIN recusal r ON r.agenda_item_id = g.id
				WHERE c.id = ${traktandumId} AND c.meeting_id = ${meetingId}
				  AND c.spontaneous_kind = 'folgeantrag'
				  -- Codeprüfung P9, N-G2: nur, was am Folgeantrag nicht schon erklärt ist.
				  AND NOT EXISTS (
				    SELECT 1 FROM recusal r2
				    WHERE r2.agenda_item_id = c.id
				      AND r2.party_id IS NOT DISTINCT FROM r.party_id
				      AND r2.holder_key IS NOT DISTINCT FROM r.holder_key
				  )
				  -- Laienprüfung Runde 6, R6-2: An der Wahl der Verwaltung gilt der
				  -- Ausstand eines Vertreters nicht; dort zählt nur der einer Partei.
				  AND NOT (r.holder_key IS NOT NULL AND c.requirement_node = ANY(${[...VERWALTUNGSWAHLKNOTEN]}::text[]))
			) AS da
		`;
		return z?.da === true;
	});
}

/**
 * Wirft, wenn die Versammlung nicht beschlussfähig ist; die zweite Prüfung beim Eröffnen.
 *
 * **Mit L5** (Migration 174): Verlangt das Traktandum die Beschlussfähigkeit
 * einer ersten Versammlung (`pruefstufeFuerTraktandumIn`), prüft sie das
 * danach, mit eigener Absage. Erst die gewöhnliche Prüfung: Fehlt schon das
 * Drittel, gilt deren Rat («warten Sie auf Nachzügler»), nicht der zum neuen
 * Traktandum.
 *
 * **Mit L7** (Migration 183): Unter «Zählt nicht mit» prüft sie zusätzlich,
 * ob die Versammlung ohne die Personen im Ausstand beschlussfähig ist, mit
 * derselben Stufe wie die übrige Prüfung (auch L5), und weist mit eigener
 * Kennung ab. Der Beschluss von Hand geht an der Prüfung vorbei, wie bei
 * fehlender Beschlussfähigkeit; konsultativ nicht (Entscheid 0043).
 */
async function verlangeBeschlussfaehigkeitFuer(
	operatorId: string,
	meetingId: Id,
	m: { tier: Versammlungsstufe; stweg_id: string },
	pruefstufe: Versammlungsstufe = m.tier,
	/** Ob die Absage nach L5 die konsultative Abstimmung nennt (am Abend nicht). */
	wortlaut: { konsultativ: boolean } = { konsultativ: true },
	/**
	 * L7 (Migration 183): Das Traktandum, dessen Ausstand die Prüfung
	 * zusätzlich liest. Ohne es bleibt es bei der Prüfung der Versammlung.
	 */
	traktandumId?: Id
): Promise<void> {
	verlangeBeschlussfaehigkeit(await stelleBeschlussfaehigkeitFestFuer(operatorId, meetingId, m));
	if (pruefstufe !== m.tier) {
		const streng = await stelleBeschlussfaehigkeitFestFuer(operatorId, meetingId, { ...m, tier: pruefstufe });
		if (!streng.beschlussfaehig) {
			throw new FachlicherFehler(
				'neues_traktandum_gesperrt',
				neuAnZweiterGesperrt(streng.fehlt, wortlaut.konsultativ),
				'beschlussfaehigkeit'
			);
		}
	}
	if (!traktandumId) return;
	const ohneAusstand = await holeBeschlussfaehigkeitOhneAusstand(operatorId, meetingId, m, traktandumId);
	if (ohneAusstand?.wahl === 'zaehlt_nicht' && !ohneAusstand.ohne.beschlussfaehig) {
		throw new FachlicherFehler('ausstand_nicht_beschlussfaehig', AUSSTAND_NICHT_BESCHLUSSFAEHIG, 'beschlussfaehigkeit');
	}
}

/**
 * Die Beschlussfähigkeit dieses Augenblicks, wie sie das Eröffnen prüft. Ohne
 * Momentaufnahme wirft sie: Dann lässt sich nichts feststellen, auch nicht,
 * dass die Beschlussfähigkeit fehlt, und konsultativ wird ebenso wenig
 * abgestimmt wie verbindlich.
 */
async function stelleBeschlussfaehigkeitFestFuer(
	operatorId: string,
	meetingId: Id,
	m: { tier: Versammlungsstufe; stweg_id: string }
): Promise<ReturnType<typeof stelleBeschlussfaehigkeitFest>> {
	/*
	 * **Ohne Beschlussfähigkeit keine verbindliche Abstimmung** (Ä-18,
	 * 17.09.2026). Bis dahin fragte dieser Weg gar nicht danach; die Prüfung
	 * aus Story 4.7 lag ungenutzt im Kern. Gerechnet wird wie auf der
	 * Leitungsseite und am Beamer: dieselbe Übersicht, dieselben Regeln,
	 * dieselbe Kernfunktion. Nach dem Zustand geprüft, damit eine noch nicht
	 * eröffnete Versammlung «noch nicht eröffnet» hört und nicht «nicht
	 * beschlussfähig».
	 *
	 * Die Übersicht liest über eine eigene Verbindung, wie im Loader. Ein
	 * Einlass zwischen dieser Lesung und dem INSERT unten verschiebt nur, ob
	 * eine Abstimmung eine Sekunde früher hätte öffnen dürfen.
	 */
	const [uebersicht, regeln] = await Promise.all([
		holeUebersicht(operatorId, meetingId),
		holeAnwesenheitsregeln(operatorId, m.stweg_id)
	]);
	if (!uebersicht) {
		throw new FachlicherFehler(
			'ohne_momentaufnahme',
			'Für diese Versammlung ist keine Anwesenheitsliste angelegt. Ohne sie lässt sich die Beschlussfähigkeit nicht feststellen, und ohne Beschlussfähigkeit wird nicht abgestimmt.',
			'anwesenheit'
		);
	}
	return stelleBeschlussfaehigkeitFest(
		m.tier,
		{
			eigentuemerGesamt: uebersicht.eigentuemerGesamt,
			eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
			kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
			kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
			gesamtquote: uebersicht.gesamtquote,
			quotenAnwesend: uebersicht.quotenAnwesend,
			einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
		},
		regeln[m.tier] ?? null
	);
}

/**
 * L7 (Migration 183): Die Beschlussfähigkeit ohne die Personen im Ausstand
 * und ob sie an ihnen hängt, am lebenden Stand, mit derselben Kernfunktion
 * wie das Protokoll (`ausstandsbefund`), dazu die eingefrorene Wahl. **Die
 * Stufe entsteht hier** aus der Stufe der Versammlung über
 * `pruefstufeFuerTraktandumIn` (L5), nicht beim Aufrufer: Sonst rechnete die
 * Leitung an einer zweiten Versammlung auf einer anderen Stufe als das
 * Eröffnen (Codeprüfung Block 4, M3). Eine Stelle
 * für beide Wege, das verbindliche Eröffnen und den Satz an die Leitung; das
 * Protokoll rechnet dieselbe Kernfunktion aus dem eingefrorenen
 * `attendance_json`. `null` ohne Momentaufnahme, wie bei
 * `stelleBeschlussfaehigkeitFestFuer`, und ohne Ausstand am Traktandum.
 *
 * bindung: meetingId — `leseAusstandskennungen` wählt den Ausstand mit
 * `agenda_item_id = traktandumId AND meeting_id = meetingId`; ein fremdes
 * Traktandum dieser Versammlung trifft nichts, und die übrigen Leser
 * (`holeMomentaufnahmeIn`, `leseAnwesenheitsstand`, `leseVertretungen`)
 * lesen ohnehin nur diese Versammlung.
 * bindung: stwegId — `leseAnwesenheitsregeln` liest die Regeln dieser
 * Gemeinschaft; der Aufrufer nimmt `stweg_id` aus derselben Versammlungszeile
 * wie `meetingId` (wie `stelleBeschlussfaehigkeitFestFuer`).
 */
export async function holeBeschlussfaehigkeitOhneAusstand(
	operatorId: Id,
	meetingId: Id,
	m: { tier: Versammlungsstufe; stweg_id: Id },
	traktandumId: Id
): Promise<(ReturnType<typeof ausstandsbefund> & { wahl: Ausstandsbeschlussfaehigkeit }) | null> {
	return alsBetreiber(operatorId, async (tx) => {
		// Ohne Ausstand ist «ohne» gleich «mit», und nichts hängt daran
		// (Codeprüfung Runde 2, B2: eine Lesung statt sechs).
		const ausstand = await leseAusstandskennungen(tx, meetingId, traktandumId);
		if (ausstand.length === 0) return null;
		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		if (!momentaufnahme) return null;
		const stand = await leseAnwesenheitsstand(tx, meetingId);
		const [vertretungen, regeln, { L7: wahl }, stufe] = await Promise.all([
			leseVertretungen(tx, meetingId, stand),
			leseAnwesenheitsregeln(tx, m.stweg_id),
			holeLesartenIn(tx, { meetingId }),
			pruefstufeFuerTraktandumIn(tx, meetingId, traktandumId, m.tier)
		]);
		const befund = ausstandsbefund(
			stufe,
			stimmkraftliste(momentaufnahme),
			stand.map((s) => s.parteiId),
			ausstand,
			vertretungen,
			regeln[stufe] ?? null
		);
		return { ...befund, wahl };
	});
}

/**
 * L8 (Migration 184): Die Lage der Verwaltungsvollmachten am aufgerufenen
 * Traktandum, für den Satz an die Leitung vor dem Eröffnen: die eingefrorene
 * Wahl der Gemeinschaft. `null` ohne Häkchen am Traktandum und wenn die
 * Verwaltung keine Vollmacht hält, für die das Ruhen etwas änderte — ein Satz
 * über einen Fall, den es nicht gibt, verlänge die Leitung nur.
 *
 * **Entscheid 8 (07.11.2026):** `wahlTrotzHaekchen` heisst: Das Erfordernis
 * steht nach der Freigabe auf der Wahl oder Wiederwahl der Verwaltung, das
 * Häkchen wirkt dort nicht, und die Leitung bekommt den Satz «Wahl trotz
 * Häkchen» statt des Satzes zur Einstellung.
 *
 * **Nur die nicht erklärten** (`leseVerwaltungsausstandIn`): Hat die
 * Sitzungsleitung den Ausstand der Verwaltung erklärt, ruhen die Vollmachten
 * über ihn, und der Satz zur Einstellung sagt nichts mehr, was die Liste
 * darüber nicht schon sagt.
 *
 * **Nur wo eine wirksame Vertretung daran hängt** (M2, 06.11.2026): Wie im
 * Kern kommt die Frage aus den wirksamen Vertretungen, nicht aus der Tabelle
 * der Vollmachten. Ist die vertretene Partei selbst da, ist die Vollmacht nur
 * erfasst; ist die Verwaltung abwesend, hält sie niemanden. In beiden Fällen
 * ruht nichts, und der Satz bliebe ohne Fall.
 *
 * **Und nur, wo eine tatsächlich ruhen würde** (G-4, Lauf 5, 07.11.2026):
 * Ist die vertretene Partei selbst vom Stimmrecht ausgeschlossen, etwa als
 * Betroffene, stimmt sie nach beiden Wahlen nicht, und der Satz redete über
 * einen Fall, den es nicht gibt; der Kern rechnet das zweite Ergebnis aus
 * demselben Grund nicht (die Regel `n = 0`).
 *
 * **R3-3 (Lauf 5, 07.11.2026):** `ausstandErklaert` heisst, dass ein Ausstand
 * der Verwaltung für dieses Traktandum vorab erklärt ist; das trifft nur an
 * der Wahl trotz Häkchen zu, und die Leitung nennt dazu den Satz, der sie
 * bittet, den Ausstand vor der Abstimmung zurückzunehmen.
 *
 * bindung: meetingId — `agenda_item` und `proxy` werden mit `meeting_id`
 * gefiltert; ein fremdes Traktandum trägt kein Häkchen und liefert `null`.
 */
export async function holeVerwaltungsvollmachtenLage(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<{
	wahl: Verwaltungsvollmachtwahl;
	wahlTrotzHaekchen: boolean;
	/** R3-3 (07.11.2026): Ein Ausstand der Verwaltung ist vorab erklärt. */
	ausstandErklaert: boolean;
	/** Entscheid 0045, Punkt 9: die Abberufung als Folgeantrag unter dem Häkchen. */
	abberufungTrotzHaekchen: boolean;
	/** Codeprüfung P9, G-3: Das Traktandum ist selbst ein Folgeantrag. */
	amFolgeantrag: boolean;
	/**
	 * Entscheid 0045, Punkt 11: die Angabe der Leitung an diesem Folgeantrag
	 * (oder am Ziel des Rückkommens); fehlt, wo keine gemacht ist.
	 */
	angabe?: Verwaltungsangabe;
} | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const verwaltung = await leseVerwaltungsausstandIn(tx, meetingId, traktandumId);
		// Entscheid 8 (07.11.2026): An den Wahlknoten liefert die Lesung keine
		// Kennungen, sondern trägt sie im Merkmal; der Satz gilt denselben
		// wirksamen Vollmachten, nur mit dem anderen Inhalt.
		// Entscheid 0045, Punkt 9: an der Abberufung ebenso; Punkt 11: an der
		// Angabe der Leitung ebenso.
		const da =
			verwaltung.kennungen.length > 0
				? verwaltung.kennungen
				: verwaltung.wahlTrotzHaekchen.length > 0
					? verwaltung.wahlTrotzHaekchen
					: verwaltung.abberufungTrotzHaekchen.length > 0
						? verwaltung.abberufungTrotzHaekchen
						: (verwaltung.angabeTrotzHaekchen?.kennungen ?? []);
		if (da.length === 0) return null;
		const stand = await leseAnwesenheitsstand(tx, meetingId);
		const vertretungen = await leseVertretungen(tx, meetingId, stand);
		const daMenge = new Set(da);
		const wirksame = vertretungen.filter((v) => daMenge.has(v.bevollmaechtigtId));
		if (wirksame.length === 0) return null;
		/*
		 * G-4 (Lauf 5, 07.11.2026): Kein Satz, wenn keine Vertretung der
		 * Verwaltung tatsächlich ruhen würde. Ist die vertretene Partei selbst
		 * vom Stimmrecht ausgeschlossen, etwa als Betroffene, stimmt sie nach
		 * beiden Wahlen nicht, und der Satz redete über einen Fall, den es
		 * nicht gibt; der Kern rechnet das zweite Ergebnis aus demselben Grund
		 * nicht (die Regel `n = 0`). Die Bezugsgrössen kommen aus dem offenen
		 * Durchgang wie bei der Stimmsperre, sonst vom Traktandum.
		 */
		const [offen] = await tx<{ kopfbasis: string | null; knoten: string | null }[]>`
			SELECT requirement_json->>'kopfbasis' AS kopfbasis,
			       requirement_json->>'knotenId' AS knoten
			FROM voting_round
			WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId} AND state = 'offen'
		`;
		const [tr] = offen
			? [offen]
			: await tx<{ kopfbasis: string | null; knoten: string | null }[]>`
				SELECT requirement_head_base AS kopfbasis, requirement_node AS knoten FROM agenda_item
				WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			`;
		const betroffene =
			tr &&
			betroffeneStimmenNichtMit({
				kopfbasis: tr.kopfbasis as Erfordernis['kopfbasis'],
				knotenId: tr.knoten ?? ''
			})
				? await tx<{ party_id: string }[]>`
					SELECT party_id FROM agenda_item_affected WHERE agenda_item_id = ${traktandumId}
				`
				: [];
		const deklariert = await tx<{ party_id: string }[]>`
			SELECT r.party_id FROM recusal r
			WHERE r.agenda_item_id = ${traktandumId} AND r.party_id IS NOT NULL
		`;
		const ausgeschlossen = vomStimmrechtAusgeschlossen(
			{ kopfbasis: tr?.kopfbasis as Erfordernis['kopfbasis'], knotenId: tr?.knoten ?? '' },
			deklariert.map((d) => d.party_id),
			betroffene.map((b) => b.party_id)
		);
		if (!wirksame.some((v) => !ausgeschlossen.has(v.vertreteneId))) return null;
		// Codeprüfung P9, N-G1: Am Rückkommen zählt, ob das Ziel ein Folgeantrag ist.
		const [art] = await tx<{ spontaneous_kind: string | null; ziel_art: string | null }[]>`
			SELECT a.spontaneous_kind, z.spontaneous_kind AS ziel_art
			FROM agenda_item a
			LEFT JOIN agenda_item z ON z.id = a.reconsiders_item_id AND z.meeting_id = ${meetingId}
			WHERE a.id = ${traktandumId} AND a.meeting_id = ${meetingId}
		`;
		return {
			amFolgeantrag:
				art?.spontaneous_kind === 'folgeantrag' ||
				(art?.spontaneous_kind === 'rueckkommen' && art.ziel_art === 'folgeantrag'),
			wahl: (await holeLesartenIn(tx, { meetingId })).L8,
			wahlTrotzHaekchen: verwaltung.wahlTrotzHaekchen.length > 0,
			ausstandErklaert: verwaltung.ausstandErklaert.length > 0,
			abberufungTrotzHaekchen: verwaltung.abberufungTrotzHaekchen.length > 0,
			...(verwaltung.angabeTrotzHaekchen ? { angabe: verwaltung.angabeTrotzHaekchen.grund } : {})
		};
	});
}

/** Wirft, wenn einem weisungsgebundenen Traktandum Weisungen fehlen; die dritte Prüfung. */
async function verlangeWeisungen(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	weisungsgebunden: boolean
): Promise<void> {
	// ── Weisungsbindung (Story 7.3) ────────────────────────────────────
	//
	// Eine MEG-Abstimmung ohne die Weisungen ihrer Mitglieder wäre eine
	// Abstimmung der Vertreter nach eigenem Gutdünken — und damit angreifbar:
	// Art. 7 Ziff. 3 weist die Stimme den beteiligten Stockwerkeigentümern zu
	// und nicht dem Vertreter. Die Meldung nennt die fehlenden Häuser beim
	// Namen; «es fehlen Weisungen» hilft im Saal nicht weiter.
	if (weisungsgebunden) {
		const fehlend = await tx<{ display_name: string }[]>`
			SELECT p.display_name
			FROM party p
			WHERE p.stweg_id = (SELECT stweg_id FROM meeting WHERE id = ${meetingId})
			  AND p.kind = 'gemeinschaft'
			  AND NOT EXISTS (
				SELECT 1 FROM instruction i
				WHERE i.agenda_item_id = ${traktandumId}
				  AND i.party_id = p.id
				  AND i.superseded_by IS NULL
			  )
			ORDER BY p.display_name
		`;
		if (fehlend.length > 0) {
			throw new FachlicherFehler(
				'weisungen_fehlen',
				`Dieses Traktandum ist weisungsgebunden. Es fehlt die Weisung von: ` +
					`${fehlend.map((f) => f.display_name).join(', ')}. Tragen Sie sie ein — oder ` +
					'halten Sie ausdrücklich fest, dass keine vorliegt; dann zählt das Haus als ' +
					'nicht vertreten.',
				'weisung'
			);
		}
	}
}

/**
 * Der Rückkommensantrag, der den nächsten Durchgang trägt, oder null; wirft, wenn
 * ein weiterer Durchgang keinen Grund hat. Die fünfte Prüfung beim Eröffnen.
 */
async function rueckkommenFuerEroeffnung(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	t: Eroeffnungstraktandum
): Promise<string | null> {
	// Ein zweiter Durchgang braucht einen Grund (FR-44), `rueckkommenZuEroeffnen`.
	// Beim Folgeantrag auch der erste, wenn über den Grundantrag schon
	// abgestimmt ist (Produktentscheid 30.09.2026).
	const [grund] =
		t.spontaneous_kind === 'folgeantrag' && t.parent_id
			? await tx<{ id: string; title: string }[]>`
					SELECT id, title FROM agenda_item WHERE id = ${t.parent_id} AND meeting_id = ${meetingId}
				`
			: [];
	return rueckkommenZuEroeffnen(
		tx,
		meetingId,
		traktandumId,
		t.title,
		grund ? { id: grund.id, titel: grund.title } : null
	);
}

export async function oeffneAbstimmung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	/**
	 * Bei einem Geschäft unter der Universalversammlung: Die Leitung bestätigt,
	 * dass sie nach einem Widerspruch gefragt hat und niemand widersprochen hat
	 * (Migration 128). Bei allen anderen Traktanden ohne Wirkung.
	 *
	 * `geheim`: Die Versammlung hat eine geheime Abstimmung verlangt
	 * (Produktentscheid 28.09.2026, Migration 141). Die Anzeigen nennen dann nur
	 * «erreicht» oder «nicht erreicht».
	 *
	 * `konsultativ`: Die Versammlung ist nicht beschlussfähig und stimmt nur
	 * konsultativ ab (Migration 158). Greift nur bei fehlender
	 * Beschlussfähigkeit, seit L5 auch bei fehlender Beschlussfähigkeit einer
	 * ersten an einem neuen Traktandum (Migration 174); ist sie gegeben, weist
	 * das Eröffnen ab, statt still verbindlich abzustimmen.
	 */
	optionen: {
		universalBestaetigt?: boolean;
		geheim?: boolean;
		/**
		 * Die Grundlage der geheimen Abstimmung (Ä-38): Die Versammlung hat offen
		 * beschlossen (Migration 165), das Reglement sieht sie vor (Migration 166),
		 * oder beides. Ohne eine von beiden weist ein geheimes Eröffnen ab.
		 */
		geheimBeschlossen?: boolean;
		geheimNachReglement?: boolean;
		konsultativ?: boolean;
		/**
		 * Eröffnet am gemeinsamen Abend (`oeffneAmAbend`). Nur für den Wortlaut
		 * der Absage nach L5: Am Abend gibt es keine konsultative Abstimmung.
		 */
		amAbend?: boolean;
		/**
		 * Die Marke der Zuordnung, die die Seite über dem Knopf gezeigt hat
		 * (Ä-05, M4; `zuordnungsmarke`). Gesetzt heisst: Die Leitung bestätigt
		 * sie mit diesem Klick. Gilt sie nicht mehr, weist das Eröffnen ab;
		 * fehlt sie, wird eröffnet wie bisher, ohne Bestätigung im Verlauf.
		 */
		zuordnung?: string;
	} = {}
): Promise<Durchgangsstand> {
	return nochmalsBeiVerklemmung(() => alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Erst sperren, dann die Lage lesen** (S9). Zwei gleichzeitige
		 * Eröffnungen lasen sonst beide «keine offen» und dieselbe Ordnungszahl;
		 * der zweite Lauf scheiterte am eindeutigen Schlüssel als rohe 500, oder
		 * er las den eben eröffneten Durchgang als schon abgestimmt und sagte
		 * «bereits abgestimmt, es braucht ein Rückkommen», während die Abstimmung
		 * offen war. Jetzt wartet der zweite Lauf und sagt «schon offen».
		 *
		 * Gesperrt wird die Versammlungszeile, denn «nur eine offene» gilt je
		 * Versammlung, nicht je Traktandum. Das Traktandum davor, in derselben
		 * Reihenfolge wie beim Beschluss von Hand und beim Widerspruch, die
		 * zuerst das Traktandum sperren und danach die Versammlung schreiben;
		 * umgekehrt könnten sich die Wege gegenseitig festhalten.
		 *
		 * **`FOR NO KEY UPDATE`, nicht `FOR UPDATE`** (Codeprüfung H3, Befund
		 * N2). Es stellt zwei Eröffnungen und jeden Weg, der die Versammlung mit
		 * `FOR UPDATE` sperrt (etwa `gibAb`), genauso hintereinander, lässt aber
		 * die Fremdschlüsselprüfungen auf die Versammlung durch: Eine neue Zeile,
		 * die nur auf die Versammlung verweist, wartet nicht auf dieses Eröffnen.
		 * Es ist zudem die Sperre, die das `UPDATE meeting` unten ohnehin nimmt.
		 *
		 * **Eine Reihenfolge bleibt gegenläufig:** `eroeffneVersammlung` sperrt
		 * die Versammlung und schreibt danach Traktanden. Treffen sich die zwei,
		 * bricht PostgreSQL einen Lauf mit einer Verklemmung ab (40P01), meist
		 * diesen, nicht sicher; dann sieht auch das Eröffnen der Versammlung
		 * einen rohen Fehler und lässt sich wiederholen. Das setzt voraus, dass
		 * jemand eine Abstimmung eröffnet, während die Versammlung selbst erst
		 * eröffnet wird. Hingenommen (Codeprüfung H3, Befund N1). Seit dem
		 * 27.10.2026 läuft ein abgebrochenes Eröffnen noch einmal
		 * (`nochmalsBeiVerklemmung`), liest dann «läuft» und eröffnet, wie es ein
		 * Lauf getan hätte, der nur an der Versammlung gewartet hätte.
		 */
		await tx`
			SELECT 1 FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${meetingId} FOR UPDATE
		`;
		await tx`SELECT 1 FROM meeting WHERE id = ${meetingId} FOR NO KEY UPDATE`;
		const { m, t, lage } = await leseEroeffnungslage(
			tx,
			meetingId,
			traktandumId,
			optionen.universalBestaetigt === true
		);
		const universal = lage.universal ?? null;

		// Dieselben fünf Prüfungen, in derselben Reihenfolge, fährt der Notweg
		// trocken (`haltBeschlussVonHandFest`); wer hier eine sechste einfügt, trägt
		// sie dort nach. Die vierte ist das Mehr der Einladung (Migration 144).
		//
		// **Konsultativ statt der zweiten Prüfung** (Migration 158): Die Sperre
		// bleibt, wie sie ist; der konsultative Durchgang verlangt umgekehrt,
		// dass die Beschlussfähigkeit fehlt, und darf weder unter der
		// Universalversammlung noch unter einem Rückkommen laufen. Die übrigen
		// Prüfungen gelten auch für ihn: Er soll dieselbe Frage stellen, die
		// später verbindlich gestellt wird.
		const konsultativ = optionen.konsultativ === true;
		/*
		 * **Geheim nur auf offenen Beschluss** (Produktentscheid 16.10.2026,
		 * Ä-38): «Erste Abstimmung offen, ob geheim ja oder nein; wenn ja, dann
		 * geheime Abstimmung über die Sache.» Das Protokoll nennt den Beschluss
		 * als Grundlage (Pflichtpunkt 8 der Fachprüfung vom 28.09.2026).
		 */
		/*
		 * Oder nach Reglement (Fachprüfung 16.10.2026, Rz. 160 f. ad Art. 712m;
		 * Produktentscheid 16.10.2026: «Warum nicht beides?»).
		 */
		if (
			optionen.geheim === true &&
			optionen.geheimBeschlossen !== true &&
			optionen.geheimNachReglement !== true
		) {
			throw new FachlicherFehler(
				'geheim_ohne_grundlage',
				'Geheim abgestimmt wird nur auf einen offenen Beschluss der Versammlung oder nach ' +
					'Reglement. Kreuzen Sie an, was zutrifft; fehlt beides, lassen Sie zuerst offen ' +
					'darüber abstimmen.',
				'geheimBeschlossen'
			);
		}
		pruefeDurchgangsfreigabe(lage);
		// L5: Ein neues Traktandum an der zweiten Versammlung prüft nach der Vorgabe
		// die Beschlussfähigkeit einer ersten (Migration 174). Konsultativ zählt
		// dieselbe Stufe: Fehlt sie, ist die unverbindliche Abstimmung zulässig
		// (Entscheid des Auftraggebers 22.10.2026, Frage 1).
		const pruefstufe = await pruefstufeFuerTraktandumIn(tx, meetingId, traktandumId, m.tier);
		const beschlussfaehigkeit = konsultativ
			? await stelleBeschlussfaehigkeitFestFuer(handelnder.operatorId, meetingId, { ...m, tier: pruefstufe })
			: null;
		if (!konsultativ) {
			await verlangeBeschlussfaehigkeitFuer(handelnder.operatorId, meetingId, m, pruefstufe, {
				konsultativ: optionen.amAbend !== true
			}, traktandumId);
		}
		/*
		 * **L7: an der Sperre keine konsultative Abstimmung** (Entscheid 0043).
		 * Die Versammlung ist dann beschlussfähig, nur nicht ohne die Personen
		 * im Ausstand; die Sätze zur konsultativen Abstimmung sagten «nicht
		 * beschlussfähig» und stimmten nicht (Codeprüfung Block 4, H1 und M4).
		 * Abgewiesen mit der Absage zu L7, nicht mit «Die Versammlung ist
		 * beschlussfähig, deshalb wird verbindlich abgestimmt»: Verbindlich geht
		 * es eben nicht. Nur wo sie an den Personen im Ausstand hängt; fehlt die
		 * Beschlussfähigkeit auch mit ihnen, gilt die gewöhnliche Regel.
		 */
		if (konsultativ) {
			const ohneAusstand = await holeBeschlussfaehigkeitOhneAusstand(
				handelnder.operatorId,
				meetingId,
				m,
				traktandumId
			);
			if (ohneAusstand?.wahl === 'zaehlt_nicht' && ohneAusstand.haengtAmAusstand) {
				throw new FachlicherFehler('ausstand_nicht_beschlussfaehig', AUSSTAND_NICHT_BESCHLUSSFAEHIG, 'konsultativ');
			}
		}
		// Der Grund am Durchgang: konsultativ, weil nur die Stufe einer ersten
		// fehlt (L5), nicht die Beschlussfähigkeit überhaupt.
		const konsultativgrund: Konsultativgrund | null =
			konsultativ &&
			pruefstufe !== m.tier &&
			(await stelleBeschlussfaehigkeitFestFuer(handelnder.operatorId, meetingId, m)).beschlussfaehig
				? 'neu_an_zweiter'
				: null;
		await verlangeWeisungen(tx, meetingId, traktandumId, t.instruction_bound);
		await verlangeEinladungsmehrBeimAbstimmen(tx, traktandumId, t.erfordernis);
		const rueckkommenId = await rueckkommenFuerEroeffnung(tx, meetingId, traktandumId, t);
		// Die bestätigte Zuordnung (Ä-05, M4): Nach den Prüfungen, damit eine
		// Absage aus ihnen Vorrang hat; vor dem Einfügen, damit eine überholte
		// Bestätigung nichts eröffnet. Den Ausstand sperrt das nicht:
		// `erklaereAusstand` nimmt keine Sperre auf das Traktandum, ein
		// gleichzeitig erklärter Ausstand kann also zwischen Lesen und Einfügen
		// fallen. Das Fenster bestand schon vorher (Codeprüfung M4, N2).
		const zuordnung =
			optionen.zuordnung !== undefined
				? await leseZuordnung(tx, meetingId, traktandumId, t.erfordernis)
				: null;
		if (zuordnung && zuordnung.marke !== optionen.zuordnung) {
			throw new FachlicherFehler('zuordnung_geaendert', ZUORDNUNG_GEAENDERT, 'zuordnung');
		}
		if (beschlussfaehigkeit) {
			verlangeKonsultativZulaessig({
				beschlussfaehig: beschlussfaehigkeit.beschlussfaehig,
				universal: universal !== null,
				rueckkommen: rueckkommenId !== null,
				beschlussGilt: await beschlussGiltIn(tx, meetingId, traktandumId)
			});
		}

		const [letzte] = await tx<{ nummer: number | null }[]>`
			SELECT max(ordinal) AS nummer FROM voting_round WHERE agenda_item_id = ${traktandumId}
		`;
		const nummer = Number(letzte?.nummer ?? 0) + 1;

		/*
		 * **Der Durchgang ohne Beschluss wird überholt** (Codeprüfung Block 3,
		 * zweiter Durchgang). Blieb er stehen, gäbe es zwei nicht überholte,
		 * geschlossene Durchgänge zum selben Geschäft, und Telefon, Auswertung,
		 * Rückkommen und Zähler rechneten mit einem Zustand, den es sonst nicht
		 * gibt. Er bekommt die eigene Art `neueroeffnung`: Das ist keine von der
		 * Leitung angesetzte Neuabstimmung, und wer `korrektur` als solche liest
		 * (Auswertung, Protokoll), darf ihn nicht dafür halten (Migration 130).
		 * Der Grund steht dabei.
		 */
		const ohneBeschluss = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round
			 WHERE agenda_item_id = ${traktandumId} AND superseded_at IS NULL
			   AND (universal_json->'keinBeschluss'->>'grund' = 'weggang' OR consultative)
		`;
		for (const w of ohneBeschluss) {
			// Mit Verlaufseintrag. Die Neueröffnung bekommt das eigene Ereignis
			// «Abstimmung neu eröffnet» statt «Neuabstimmung angesetzt»
			// (Produktentscheid 08.10.2026, siehe `ueberholeDurchgang`).
			// «Während der Abstimmung gegangen» trifft auch die
			// Handzählung und die Stimme über eine Vollmacht, die nicht zählt
			// (Fachprüfung Block 3, Runde 3, Befund 1). War niemand gegangen,
			// sondern nur über die Leitung vertreten, sagt der Grund das
			// (Codeprüfung Block 4a, N-4).
			// Nach einer konsultativen Abstimmung derselbe Weg mit eigenem Grund
			// (Migration 158); sie steht nicht im Stand der Universalversammlung.
			const k = w.universal_json?.keinBeschluss;
			const u = ueberholeDurchgang(
				ausDb(w),
				new Date().toISOString(),
				w.consultative
					? w.consultative_reason === 'neu_an_zweiter'
						? KONSULTATIV_UEBERHOLT_NEU
						: KONSULTATIV_UEBERHOLT
					: ueberholungsgrundNachWeggang(k),
				t.title,
				true
			);
			await tx`
				UPDATE voting_round
				   SET superseded_at = now(), supersede_kind = 'neueroeffnung',
				       supersede_reason = ${u.ergebnis.ueberholungsgrund}
				 WHERE id = ${w.id}
			`;
			await schreibeVerlauf(tx, handelnder, u.ereignisse[0]);
		}

		// Das Erfordernis wandert schon beim Eröffnen mit: Es gilt für **diesen**
		// Durchgang, und eine Änderung am Traktandum darf ihn nicht nachträglich
		// nach einer anderen Regel bewerten (AD-4).
		const [neu] = await tx<Rundenzeile[]>`
			INSERT INTO voting_round (operator_id, meeting_id, agenda_item_id, ordinal, opened_by,
			                          requirement_json, reconsideration_item_id, universal_mode,
			                          universal_confirmed_at, universal_confirmed_by, secret,
			                          secret_resolved, secret_by_bylaw, consultative, consultative_reason)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${traktandumId}, ${nummer},
			        ${handelnder.userId}, ${tx.json(t.erfordernis as never)}, ${rueckkommenId},
			        ${universal ? universal.variante : null},
			        ${universal ? tx`now()` : null}, ${universal ? handelnder.label : null},
			        ${optionen.geheim === true},
			        ${optionen.geheim === true && optionen.geheimBeschlossen === true ? true : null},
			        ${optionen.geheim === true && optionen.geheimNachReglement === true ? true : null},
			        ${konsultativ}, ${konsultativgrund})
			RETURNING *
		`;

		const u = oeffneDurchgang(
			{
				id: neu.id,
				meetingId,
				traktandumId,
				nummer,
				eroeffnetAm: neu.opened_at.toISOString(),
				konsultativ,
				konsultativNachL5: konsultativgrund === 'neu_an_zweiter'
			},
			t.title,
			zuordnung
		);
		await schreibeUebergang(tx, handelnder, u);

		// Die Versammlung stellt sich zugleich auf dieses Traktandum: Beamer und
		// Telefone lesen dasselbe Feld (AD-10), und eine offene Abstimmung zu
		// einem Traktandum, das nirgends angezeigt wird, wäre im Saal nicht zu
		// erklären.
		await tx`
			UPDATE meeting
			   SET current_agenda_item_id = ${traktandumId},
			       current_agenda_item_at = now()
			 WHERE id = ${meetingId}
		`;

		return ausDb(neu);
	}).catch((fehler: unknown) => {
		/*
		 * **Das Netz unter der Sperre.** Die beiden eindeutigen Schlüssel
		 * (Migration 020) halten einen zweiten Durchgang auch dann auf, wenn ein
		 * Schreibweg die Sperre oben einmal umgeht. Dann soll im Saal ein Satz
		 * stehen und keine leere Seite.
		 */
		if (
			istDoppelterSchluessel(
				fehler,
				'voting_round_eine_offene',
				'voting_round_agenda_item_id_ordinal_key'
			)
		) {
			throw new FachlicherFehler(
				'schon_offen',
				'Gleichzeitig wurde eine Abstimmung eröffnet. Laden Sie die Seite neu; zwei Fragen ' +
					'zugleich auf den Telefonen wären im Saal nicht mehr zu klären.',
				'zustand'
			);
		}
		throw fehler;
	}));
}

/**
 * Der Stand, der mit einem Durchgang festgeschrieben wird: Anwesenheit,
 * Vollmachten und Ausstand in diesem Augenblick (AD-16). Eine Stelle für das
 * Schliessen und für den von Hand festgehaltenen Beschluss.
 *
 * **Seit L8** (Migration 184) trägt er zwei Ausstandslisten: `ausstand` ist
 * die, nach der gerechnet wird — deklariert, und unter «Vollmachten ruhen»
 * dazu die Verwaltung —; `ausstandVerwaltung` ist das Merkmal, dass diese
 * Kennungen aus L8 kommen, und steht auch unter «Die Sitzungsleitung
 * entscheidet»: Das zweite Ergebnis rechnet nach der anderen Wahl, und dafür
 * muss der Ausstand aus L8 auch eingefroren sein, wenn er diesmal nicht
 * wirkt.
 */
async function leseSchlussstand(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<{ anwesende: Id[]; vertretungen: Vertretung[]; ausstand: Id[]; ausstandVerwaltung: Id[] }> {
	const stand = await leseAnwesenheitsstand(tx, meetingId);
	const anwesende = stand.map((a) => a.parteiId);
	// Mit derselben Begründung wie die Anwesenheit eingefroren (AD-16): Wer im
	// Ausstand ist, kann niemanden vertreten — und ob er es konnte, entscheidet
	// sich in diesem Augenblick, nicht beim späteren Aufschlagen des Protokolls.
	const vertretungen = await leseVertretungen(tx, meetingId, stand);
	// Und der Ausstand, aus demselben Grund (siehe `Durchgangsstand.ausstand`):
	// deklariert, und die Verwaltung nach der eingefrorenen Wahl von L8. Dieselbe
	// Lesung wie `leseAusstandskennungen` (G8, 06.11.2026), nicht eine zweite.
	const { ausstand, verwaltung } = await leseAusstandMitVerwaltung(tx, meetingId, traktandumId);
	return {
		anwesende,
		vertretungen,
		ausstand,
		ausstandVerwaltung: verwaltung.kennungen
	};
}

/**
 * Der bisher massgebende Durchgang der Sache, auf die das Rückkommen
 * `rueckkommensantragId` zurückkommt, ohne `ausser`; null, wenn keiner gilt.
 * Trägt das Rückkommen einen Durchgang über einen Folgeantrag, liegt er beim
 * Grundtraktandum (Migration 133).
 *
 * Eine Stelle für das Schliessen und für den von Hand festgehaltenen Beschluss:
 * Beide ersetzen nach einem Rückkommen denselben Durchgang.
 */
async function fruehererDerSache(
	tx: Tx,
	rueckkommensantragId: Id,
	traktandumId: Id,
	ausser: Id | null
): Promise<string | null> {
	const [ziel] = await tx<{ reconsiders_item_id: string | null }[]>`
		SELECT reconsiders_item_id FROM agenda_item WHERE id = ${rueckkommensantragId}
	`;
	const [{ id }] = await tx<{ id: string | null }[]>`
		SELECT massgebender_durchgang(${ziel?.reconsiders_item_id ?? traktandumId}, ${ausser}) AS id
	`;
	return id;
}

/** Der Beschluss nach Rückkommen tritt an die Stelle des früheren (FR-44, Migration 131). */
async function ersetzeNachRueckkommen(tx: Tx, frueherId: Id, durchId: Id): Promise<void> {
	await tx`
		UPDATE voting_round
		   SET superseded_at = now(),
		       supersede_kind = 'rueckkommen',
		       supersede_reason = 'Ersetzt durch den Beschluss nach Rückkommen',
		       superseded_by_round_id = ${durchId}
		 WHERE id = ${frueherId}
	`;
}

/**
 * Der zweite Durchgang nach Eintritt der Beschlussfähigkeit tritt an die
 * Stelle des von Hand festgehaltenen (Produktentscheid 03.10.2026, Migration
 * 139).
 *
 * Dieselbe Wirkung wie `ersetzeNachRueckkommen`, nur ohne Rückkommen: Die
 * Versammlung hat neu entschieden, und der neue Beschluss ersetzt den früheren
 * (Rz. 202a ad Art. 712g).
 */
async function ersetzeNachNachQuorum(tx: Tx, frueherId: Id, durchId: Id): Promise<void> {
	await tx`
		UPDATE voting_round
		   SET superseded_at = now(),
		       supersede_kind = 'nachquorum',
		       supersede_reason = 'Ersetzt durch den zweiten Durchgang nach Eintritt der Beschlussfähigkeit',
		       superseded_by_round_id = ${durchId}
		 WHERE id = ${frueherId}
	`;
}

/**
 * Den offenen Durchgang einer Versammlung sperren, **nach** seinem Traktandum
 * (Auftrag Abschluss, C2, 16.10.2026). Gibt nichts zurück, wenn keiner offen ist.
 *
 * **Warum das Traktandum zuerst.** Die Folge des Hauses ist Traktandum,
 * Versammlung, Durchgang (Eröffnen, Beschluss von Hand, Versammlungsschluss).
 * Wer den Durchgang zuerst sperrt und danach etwas schreibt, das aufs
 * Traktandum zeigt, nimmt dort `FOR KEY SHARE` erst über die
 * Fremdschlüsselprüfung, also gegenläufig. Das geschieht unsichtbar: bei einem
 * zweiten `UPDATE` derselben Zeile in derselben Transaktion (auch ohne
 * geänderten Schlüssel) und bei jedem `INSERT` einer Zeile, die aufs
 * Traktandum zeigt. Mit einem Beschluss von Hand am selben Traktandum endete
 * beides mit 40P01 (gemessen: Schliessen der Abstimmung in
 * `tests/db/abschluss-rennen.test.ts`, Widerspruch in
 * `tests/db/abstimmung.test.ts`). Hier wird dieselbe Sperre vorweg genommen.
 *
 * Das Traktandum des offenen Durchgangs wird dafür ungesperrt gelesen, und
 * gesperrt wird nur ein Durchgang **dieses** Traktandums. Ist danach ein
 * anderer offen (geschlossen und neu eröffnet im selben Augenblick), beginnt
 * es einmal neu mit dessen Traktandum, statt dessen Durchgang in der
 * verkehrten Folge zu sperren. Wechselt er ein zweites Mal, ist das ein Satz,
 * keine Schleife.
 */
export async function sperreOffenenDurchgang(tx: Tx, meetingId: Id): Promise<Rundenzeile | undefined> {
	for (let versuch = 0; versuch < 2; versuch++) {
		const [offen] = await tx<{ agenda_item_id: string }[]>`
			SELECT agenda_item_id FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
		`;
		if (!offen) return undefined;
		await tx`SELECT 1 FROM agenda_item WHERE id = ${offen.agenda_item_id} FOR KEY SHARE`;
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round
			 WHERE meeting_id = ${meetingId} AND state = 'offen'
			   AND agenda_item_id = ${offen.agenda_item_id}
			   FOR UPDATE
		`;
		if (z) return z;
	}
	throw new FachlicherFehler(
		'stand_geaendert',
		'Die offene Abstimmung hat eben gewechselt. Laden Sie die Seite neu und versuchen Sie es dann.',
		'durchgang'
	);
}

/**
 * Schliesst die offene Abstimmung und friert die Bezugsgrösse ein.
 *
 * Innerhalb einer Transaktion, weil das Schliessen der Versammlung dasselbe tun
 * muss und bereits in einer steckt.
 */
async function schliesseInTransaktion(
	tx: Tx,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	z: Rundenzeile
): Promise<Durchgangsstand> {
	const [t] = await tx<{ title: string }[]>`
		SELECT title FROM agenda_item WHERE id = ${z.agenda_item_id}
	`;

	/*
	 * **Bei der Handzählung gilt der Stand beim Zählen** (S5, Migration 156).
	 * Die Hände wurden in einem Augenblick gezählt; wer danach ging oder kam,
	 * ändert an dieser Abstimmung nichts. Neu gelesen, warf das Schliessen
	 * «mehr Stimmen als Stimmberechtigte», sobald jemand nach dem Zählen
	 * gegangen war, und mit ihm der Schluss der Versammlung. Ohne
	 * festgehaltenen Stand (Handzählung von vorher) wird gelesen wie bisher.
	 */
	const gezaehlt = z.tally_yes !== null ? z.tally_stand_json : null;
	const { anwesende, vertretungen, ausstand, ausstandVerwaltung } =
		gezaehlt ?? (await leseSchlussstand(tx, meetingId, z.agenda_item_id));
	// Und die Betroffenen samt Vorab-Vermerk (siehe `Durchgangsstand.betroffene`).
	const betroffene = gezaehlt?.betroffene ?? (await leseBetroffeneIn(tx, z.agenda_item_id, z.id));
	const jetzt = gezaehlt?.quelle ?? zeitquelle();

	const u = schliesseDurchgang(ausDb(z), new Date().toISOString(), t?.title ?? '');

	/*
	 * **An den Zustand gebunden** (S2). Die Aufrufer lesen den Durchgang mit
	 * `FOR UPDATE`; diese Bedingung hält auch dann, wenn ein künftiger Aufrufer
	 * das vergisst. Ohne sie setzte ein zweites Schliessen `closed_at` und den
	 * Verkündungszeitpunkt neu, und der ist rechtlich erheblich (ZGB Art. 75
	 * i.V.m. Art. 712m).
	 */
	const [geschlossen] = await tx<Rundenzeile[]>`
		UPDATE voting_round
		SET state = 'geschlossen', closed_at = now(), closed_by = ${handelnder.userId},
		    attendance_json = ${tx.json({ anwesende, vertretungen, ausstand, ausstandVerwaltung, quelle: jetzt } as never)},
		    affected_json = ${tx.json(betroffene as never)}
		WHERE id = ${z.id} AND state = 'offen'
		RETURNING *
	`;
	if (!geschlossen) throw keineOffene();
	await schreibeVerlauf(tx, handelnder, u.ereignisse[0]);

	/*
	 * **Schliessen verkündet** (Produktentscheid 21.08.2026): «Mit dem Schliessen
	 * der Abstimmung, auch wenn nicht alle abgestimmt haben, soll automatisch
	 * verkündet werden. Ich sehe dort den Mehrwert nicht.»
	 *
	 * Der getrennte Knopf war zudem irreführend: Hatten alle abgestimmt, stand
	 * das Ergebnis schon an der Wand, während daneben «Erst danach erscheint es
	 * auf Leinwand und Telefonen» zu lesen war — und der Klick bewirkte sichtbar
	 * nichts.
	 *
	 * **Der Zeitpunkt bleibt.** Er ist rechtlich erheblich: Die Anfechtungsfrist
	 * läuft ab Kenntnis des Beschlusses (ZGB Art. 75 i.V.m. Art. 712m). Nur ist
	 * es jetzt derselbe Augenblick wie das Schliessen, und niemand muss ihn
	 * eigens auslösen.
	 *
	 * **Die eine Ausnahme: der offene Stichentscheid.** Seit dem 28.09.2026
	 * wieder beide Fälle: der Verwalter-Stichentscheid, dessen Entscheid noch
	 * aussteht, und der Quotenstichentscheid über einer Handzählung, aus der
	 * sich nicht ablesen lässt, welche Anteile hinter Ja und Nein stehen.
	 * Verkündet würde sonst ein Ergebnis, das niemand gerechnet hat; den einen
	 * löst der Eintrag des Entscheids, den anderen die Neuabstimmung mit
	 * Einzelerfassung.
	 */
	const auszaehlung = await ergebnisIn(tx, meetingId, z.id);

	/*
	 * **Hat die Universalversammlung gehalten?** (Migration 128). Geprüft in
	 * diesem Augenblick, wie die Anwesenheit: Wer jetzt nicht mehr da ist und
	 * nicht abgestimmt hat, hebt sie auf; ebenso ein Widerspruch nach dem
	 * Eröffnen. Dann wird «kein Beschluss» festgeschrieben, mit den gezählten
	 * Stimmen daneben. Vor der Festschreibung, weil sie danach nicht mehr zu
	 * ändern ist.
	 */
	if (z.universal_mode && z.universal_confirmed_at && auszaehlung.auszaehlung) {
		const lage = await leseUniversallage(tx, meetingId);
		if (lage) {
			/*
			 * **Nach dem UPDATE oben gelesen, nicht vorher** (Codeprüfung Block 3,
			 * M-1). Ein Widerspruch, der gleichzeitig kommt, wartet auf die Sperre
			 * am Durchgang (`haltWiderspruchFest`); diese Abfrage sieht ihn dann.
			 * Nur der während dieses Durchgangs: Einer vor dem Eröffnen hätte das
			 * Eröffnen abgewiesen.
			 */
			const w = (await leseWidersprueche(tx, meetingId)).get(z.agenda_item_id);
			const widerspruch = w && w.durchgangId === z.id ? w : null;
			const handzaehlung = geschlossen.tally_yes !== null;
			const einstellung = {
				universalvariante: z.universal_mode,
				leitungsvollmachtenZaehlen: lage.einstellung.leitungsvollmachtenZaehlen
			};
			const stimmen = handzaehlung
				? null
				: await leseGueltigAbgestimmt(tx, meetingId, z.id, einstellung);
			const kreuzSeit = await leseLeitungskreuzSeit(tx, meetingId);
			const schluss = universalAmSchluss({
				einstellung,
				parteien: lage.parteien,
				abgestimmt: stimmen?.gueltig ?? null,
				mitStimme: stimmen?.mitStimme,
				// Auch bei Einzelstimmen: Dort trennt die Liste, wer ging und wer nur
				// über die Leitung vertreten war (Codeprüfung Block 4a, N-4).
				gegangenWaehrend: await leseGegangenSeit(tx, meetingId, z.opened_at.toISOString()),
				selbstGegangenWaehrend: await leseGegangenSeit(
					tx,
					meetingId,
					z.opened_at.toISOString(),
					true
				),
				vertreterBeimEroeffnen: await leseVertreterBis(tx, meetingId, z.opened_at.toISOString()),
				vertretenSeit: await leseVertretenSeit(tx, meetingId),
				kreuzSeit,
				widerspruch: widerspruch ? { name: widerspruch.name, zeitpunkt: widerspruch.am } : null
			});
			/*
			 * **Seit wann die Leitung den Vertreter führt** (Fachprüfung 30.09.2026,
			 * Befund 2). Das Protokoll nennt die Zeit des Kreuzes, das den
			 * Beschluss zu Fall bringt. Gelesen wird das Kreuz, das jetzt gilt:
			 * Nur dann zählt die Partei beim Schliessen nicht (`ladeUniversalquelle`).
			 */
			if (schluss.keinBeschluss?.nurDurchLeitung) {
				schluss.keinBeschluss.nurDurchLeitung = schluss.keinBeschluss.nurDurchLeitung.map((l) => ({
					...l,
					erfasstAm: kreuzSeit.get(vollmachtsschluessel(l.vertreter)) ?? null
				}));
			}
			const stand: Universalstand = {
				variante: z.universal_mode,
				anzahl: lage.parteien.length,
				vertreten: lage.parteien
					.filter((p) => p.anwesend && p.mitVollmacht)
					.map((p) => ({ name: p.name, vertreter: p.vertreter ?? null })),
				abgestimmtUndGegangen: schluss.abgestimmtUndGegangen,
				gemeinsam: gemeinsamImStand(lage.parteien),
				bestaetigtAm: z.universal_confirmed_at.toISOString(),
				keinBeschluss: schluss.keinBeschluss
			};
			await tx`UPDATE voting_round SET universal_json = ${tx.json(stand as never)} WHERE id = ${z.id}`;
			if (schluss.keinBeschluss) {
				auszaehlung.auszaehlung = mitKeinemBeschluss(auszaehlung.auszaehlung, schluss.keinBeschluss);
			}
		}
	}

	/*
	 * **Konsultativ: kein Beschluss, die Zahlen bleiben** (Migration 158). Am
	 * Merkmal beim Eröffnen, nicht an der Beschlussfähigkeit beim Schliessen:
	 * Kam während der Abstimmung jemand dazu, war die Frage trotzdem als
	 * Meinungsäusserung gestellt, und so haben die Anwesenden abgestimmt.
	 * Ein offener Gleichstand ist damit erledigt (`mitKeinemBeschluss`).
	 */
	if (z.consultative && auszaehlung.auszaehlung) {
		const konsultativ: KeinBeschluss = {
			grund: 'konsultativ',
			namen: [],
			...(z.consultative_reason === 'neu_an_zweiter' ? { neuAnZweiter: true } : {})
		};
		auszaehlung.auszaehlung = mitKeinemBeschluss(auszaehlung.auszaehlung, konsultativ);
	}

	const [neu] = auszaehlung.auszaehlung?.stichentscheidOffen
		? [geschlossen]
		: await tx<Rundenzeile[]>`
			UPDATE voting_round
			SET result_published_at = now(), result_published_by = ${handelnder.userId},
			    result_json = ${festgeschrieben(tx, auszaehlung.auszaehlung)}
			WHERE id = ${z.id}
			RETURNING *
		`;
	if (!auszaehlung.auszaehlung?.stichentscheidOffen) {
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.ergebnisFreigegeben,
				{ art: 'meeting', id: meetingId },
				{
					traktandum: t?.title ?? '',
					durchgang: Number(z.ordinal),
					mitDemSchliessen: true,
					// Nach der Sperre von L5 mit eigenem Feld (Codeprüfung Block 7, R2-N2).
					...(z.consultative
						? z.consultative_reason === 'neu_an_zweiter'
							? { konsultativNachL5: true }
							: { konsultativ: true }
						: {})
				}
			)
		);
	}

	/*
	 * **Der frühere Beschluss gilt bis hierher** (FR-44).
	 *
	 * Stützt sich dieser Durchgang auf einen angenommenen Rückkommensantrag, dann
	 * hat die Versammlung soeben neu entschieden — und erst **jetzt** wird der
	 * frühere Beschluss ersetzt. Nicht schon beim Rückkommensbeschluss: Sonst
	 * entstünde eine Lücke, in der zur selben Frage gar kein Beschluss gälte, und
	 * in dieser Lücke könnte die Abstimmung scheitern.
	 *
	 * Ersetzt heisst nicht gelöscht. Der frühere Durchgang bleibt mit seinen
	 * Zahlen stehen; das Protokoll weist ihn als ersetzt aus, und das
	 * Abschlusspaket führt beide.
	 */
	if (z.reconsideration_item_id) {
		/*
		 * **Nein heisst Nein** (Produktentscheid 30.09.2026, `docs/freigabe.md`,
		 * «Offen: Aus der Prüfung zu ‹Rückkommen, dann Neuabstimmung›», Punkt (a)).
		 * Der angenommene Rückkommensantrag lautet «Die Versammlung beschliesst die
		 * Sache … erneut. Mit dem neuen Beschluss zur Sache, auch mit einer
		 * Ablehnung, wird der bisherige aufgehoben …»; er ist der Beschluss mit
		 * dem erforderlichen Mehr, den Rz. 202a ad Art. 712g für den Widerruf
		 * verlangt. Ersetzt wird deshalb, sobald der
		 * neue Durchgang einen Beschluss ergibt, **angenommen oder abgelehnt**;
		 * eine Ablehnung ist selbst ein Beschluss (BGE 131 III 459, Sachverhalt
		 * und E. 5.2; Rz. 235a ad Art. 712m). Bis dahin blieb der frühere nach
		 * einer Ablehnung stehen: Die Versammlung beschloss das Rückkommen mit
		 * qualifiziertem Mehr, stimmte Nein und hatte danach denselben Beschluss,
		 * weil im Saal nur derselbe Antrag nochmals zur Abstimmung kommt
		 * (Laien- und Fachprüfung 30.09.2026, L1, F-1).
		 *
		 * Ohne Beschluss bleibt der frühere: Die Universalversammlung hielt nicht
		 * (Migration 128).
		 *
		 * **Ein offener Stichentscheid ersetzt nichts** (Fachprüfung 30.09.2026,
		 * F-10 und Reste F-1; `docs/freigabe.md`, «Gebaut: Rückkommen, Reste 1
	 * bis 3», Punkt 3). Offen bleiben seit dem 28.09.2026 zwei Fälle: der
	 * Verwalter-Stichentscheid ohne Entscheid und der Quotenstichentscheid
	 * über einer Handzählung. Aufgehoben wird nach dem Antrag erst
		 * «mit dem neuen Beschluss zur Sache»; solange keiner festgestellt ist,
		 * gilt der frühere, auch wenn die Versammlung vorher endet. Bis dahin
		 * liess Votum den offenen Durchgang stehen, wenn der frühere abgelehnt
		 * war, und überholte ihn, wenn der frühere angenommen war; die
		 * Neuabstimmung war dann gesperrt. Jetzt wird er in beiden Fällen als
		 * Rückkommen ohne Beschluss überholt, und `setzeNeuabstimmungAn` lässt
		 * genau diesen Fall zu: Aus der Überholung wird eine Neuabstimmung, und
		 * das Rückkommen trägt den nächsten Durchgang.
		 */
		const neuLage = ergebnislage(auszaehlung.auszaehlung);
		const neuMitBeschluss = neuLage === 'angenommen' || neuLage === 'abgelehnt';
		const neuOhneBeschluss = neuLage === 'kein_beschluss';

		/*
		 * Der frühere, bisher massgebende Durchgang **der Sache, auf die
		 * zurückgekommen wurde** (Produktentscheid 30.09.2026). Trägt das
		 * Rückkommen einen Durchgang über einen Folgeantrag, liegt der frühere
		 * beim Grundtraktandum, nicht beim Folgeantrag; `superseded_by_round_id`
		 * zeigt dann über zwei Traktanden, und `massgebender_durchgang` folgt
		 * diesem Verweis (Migration 133). Hat früher schon ein Folgeantrag den
		 * Grundantrag ersetzt, ist dessen Durchgang der frühere.
		 */
		const frueherId = await fruehererDerSache(tx, z.reconsideration_item_id, z.agenda_item_id, z.id);
		const frueher = frueherId ? { id: frueherId } : null;

		// **Ohne früheren Durchgang gibt es nichts zu ersetzen und nichts zu
		// erhalten** (Codeprüfung zu Punkt 9, zweiter Durchgang, M-1). Das kommt
		// vor, seit ein angenommenes Rückkommen auch dann am nächsten Durchgang
		// hängt, wenn die Leitung den geltenden überholt hatte. Endete er ohne
		// Beschluss, überholte ihn sonst der Zweig unten mit «der frühere
		// Beschluss bleibt in Kraft», obwohl keiner galt; das Protokoll hätte
		// «nicht abgestimmt» geschrieben. So bleibt er stehen, wie er ist.
		if (!frueher || neuMitBeschluss) {
			// Der neue Durchgang tritt an die Stelle des früheren: Die Versammlung
			// hat neu beschlossen, mit Ja oder mit Nein.
			if (frueher) await ersetzeNachRueckkommen(tx, frueher.id, z.id);
		} else {
			/*
			 * **Rückkommen ohne Beschluss: der frühere Beschluss bleibt in Kraft.**
			 *
			 * Getragen von der Bedingung im Rückkommensantrag selbst: «kommt gar
			 * kein Beschluss zustande, bleibt er in Kraft». Bis zum
			 * 30.09.2026 galt das auch nach einer Ablehnung (siehe oben).
			 *
			 * Die erste Fassung ersetzte hier bedingungslos — damit verschwand ein
			 * gefasster Beschluss auch dann, wenn gar nicht neu beschlossen wurde.
			 *
			 * Der erfolglose Durchgang wird nicht versteckt: Er hat stattgefunden
			 * und ist gezählt. Er bekommt eine eigene Ersetzungsart, damit für die
			 * Auszählung wieder der frühere massgebend ist und das Protokoll den
			 * Vorgang benennen kann.
			 */
			await tx`
				UPDATE voting_round
				   SET superseded_at = now(),
				       supersede_kind = 'rueckkommen_erfolglos',
				       supersede_reason = ${
								neuOhneBeschluss
									? 'Rückkommen ohne Beschluss, die Universalversammlung hielt nicht; der frühere Beschluss bleibt in Kraft'
									: 'Rückkommen ohne festgestellten Stichentscheid; der frühere Beschluss bleibt in Kraft, bis eine Neuabstimmung entscheidet'
							}
				 WHERE id = ${z.id}
			`;
		}
	}

	/*
	 * **Direkte Neuabstimmung nach Eintritt der Beschlussfähigkeit**
	 * (Produktentscheid 03.10.2026, `domain/neuabstimmung.ts`). Dieser
	 * Durchgang wurde ohne Rückkommen eröffnet, weil er den von Hand
	 * festgehaltenen Beschluss ohne Beschlussfähigkeit ersetzt
	 * (`rueckkommenZuEroeffnen`).
	 *
	 * **Ersetzt wird nur, was das Mehr erreicht** (Fachprüfung 03.10.2026;
	 * `quellen` Frage 59, Folgerung aus Rz. 202a ad Art. 712g). Der frühere
	 * Beschluss weicht einem **angenommenen** zweiten Beschluss mit dem
	 * erforderlichen Mehr. Eine Ablehnung und «kein Beschluss» ändern ihn
	 * nicht: Dort bleibt er in Kraft (Rz. 207 ad Art. 712m), anders als im
	 * Rückkommensweg, wo schon der Rückkommensbeschluss der Widerruf mit dem
	 * erforderlichen Mehr ist und «Nein heisst Nein» trägt. Ohne Annahme wird
	 * deshalb der neue Durchgang als `nachquorum_erfolglos` überholt, und der
	 * frühere bleibt massgebend.
	 *
	 * **Erkannt an der Lage, nicht an einer eigenen Spalte:** kein
	 * `reconsideration_item_id`, aber ein früherer, nicht überholter,
	 * geschlossener Durchgang, der von Hand ohne Beschlussfähigkeit
	 * festgehalten wurde. Diese Lage entsteht nur über diesen Weg; das Tor
	 * beim Eröffnen (`direktNachQuorumLage`) lässt sie nur unter denselben
	 * Bedingungen zu.
	 */
	if (!z.reconsideration_item_id) {
		const [frueher] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round
			 WHERE meeting_id = ${meetingId} AND agenda_item_id = ${z.agenda_item_id}
			   AND superseded_at IS NULL AND id <> ${z.id}
			 ORDER BY ordinal DESC
			 LIMIT 1
		`;
		if (frueher && (await istVonHandOhneQuorum(tx, meetingId, frueher))) {
			if (ergebnislage(auszaehlung.auszaehlung) === 'angenommen') {
				await ersetzeNachNachQuorum(tx, frueher.id, z.id);
			} else {
				/*
				 * Ablehnung oder kein Beschluss (auch der offene Stichentscheid,
				 * `ergebnislage` gibt dort «offen»): Der frühere bleibt in
				 * Kraft, bis eine Neuabstimmung entscheidet.
				 * `setzeNeuabstimmungAn` lässt den offenen Fall auch hier zu.
				 */
				await tx`
					UPDATE voting_round
					   SET superseded_at = now(),
					       supersede_kind = 'nachquorum_erfolglos',
					       supersede_reason = 'Der zweite Durchgang nach Eintritt der Beschlussfähigkeit hat den früheren Beschluss nicht angenommen; er bleibt in Kraft'
					 WHERE id = ${z.id}
				`;
			}
		}
	}

	return ausDb(neu);
}

export async function schliesseAbstimmung(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<Durchgangsstand> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **`FOR UPDATE`** (S1, S2). Ein zweites Schliessen wartet hier, findet
		 * danach keinen offenen Durchgang mehr und bekommt den Satz statt eines
		 * zweiten Schliesszeitpunkts. Und jede angefangene Stimme und jeder
		 * angefangene Veto-Entscheid hält die Zeile mit `FOR SHARE`
		 * (`gibStimmenAb`, `erfasseVeto`), bis er festgeschrieben ist; das
		 * Schliessen zählt ihn dann mit. Davor das Traktandum, siehe
		 * `sperreOffenenDurchgang`: `schliesseInTransaktion` schreibt den
		 * Durchgang zweimal.
		 */
		const z = await sperreOffenenDurchgang(tx, meetingId);
		if (!z) throw keineOffene();
		/*
		 * **Nur in einer laufenden Versammlung** (Pentest-Runde M7, Befund
		 * M7-2-01). Der Schluss der Versammlung schliesst offene Durchgänge
		 * selbst mit; findet sich danach noch einer, ist er aus einem Fehler
		 * übrig, und sein Ergebnis trüge einen Zeitpunkt nach dem Schluss.
		 * Einen gewollten Nutzer gibt es nicht (geprüft 15.10.2026): Aufrufer
		 * sind die Leitungsseite und die Abendsteuerung, beide im Saal; der
		 * Beschluss von Hand und der Notweg verlangen selbst «laufend», und die
		 * Pause ist kein eigener Zustand.
		 *
		 * Ohne Sperre gelesen: Der Schluss sperrt die Versammlung und danach
		 * diesen Durchgang. Wer hier zuerst ist, schliesst; der Schluss wartet
		 * am Durchgang und findet ihn danach geschlossen.
		 */
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (m?.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				'Die Versammlung ist geschlossen. Eine Abstimmung lässt sich nur schliessen, solange die Versammlung läuft.',
				'durchgang'
			);
		}
		return schliesseInTransaktion(tx, handelnder, meetingId, z);
	});
}

/**
 * Bricht die laufende Abstimmung ohne Ergebnis ab (H6, `brecheDurchgangAb`).
 *
 * Geschlossen und überholt im selben Augenblick, als `korrektur` mit der
 * Begründung, **ohne Verkündung und ohne Festschreibung**: So erkennen
 * `ergebnisIn`, Protokoll und Auswertung den Abbruch (`abgebrochen`), und
 * alles, was an `korrektur` hängt, gilt ohne Weiteres: Er verbraucht kein
 * Rückkommen (`verbrauchtDenRueckkommensantrag`), und der nächste Durchgang
 * lässt sich eröffnen, weil kein geltender dasteht.
 *
 * Der Stand dieses Augenblicks wird festgehalten wie beim Schliessen, denn ein
 * geschlossener Durchgang verlangt ihn (`voting_round_eingefroren`). Gezählt
 * wird nicht.
 *
 * **`FOR UPDATE` wie beim Schliessen** (S1, S2): Ein gleichzeitiges Schliessen
 * oder eine angefangene Stimme wartet; wer danach kommt, findet keinen offenen
 * Durchgang mehr.
 *
 * **Ohne Schranke auf den Zustand der Versammlung, mit Absicht** (F6). Anders
 * als `schliesseAbstimmung`: Ein Durchgang, der nach dem Schluss offen
 * geblieben ist, lässt sich nur so beenden, und erst danach versiegeln
 * (`erhebeSiegellage`, `docs/installation.md`, Fehlersuche). Der Abbruch
 * verkündet nichts und erzeugt kein Ergebnis.
 */
export async function brecheAbstimmungAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	begruendung: string,
	/**
	 * Nur, wenn genau dieses Traktandum offen ist (am Abend). Geprüft unter der
	 * Sperre, nicht davor: Sonst bräche ein Punkt ab, der zwischen Prüfung und
	 * Abbruch eröffnet wurde (Sicherheitsprüfung H6, Kandidat TOCTOU).
	 */
	nurTraktandum: Id | null = null
): Promise<Durchgangsstand> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
			   FOR UPDATE
		`;
		if (!z) throw keineOffene();
		if (nurTraktandum && z.agenda_item_id !== nurTraktandum) {
			throw new FachlicherFehler(
				'anderer_punkt',
				'Dort läuft die Abstimmung zu einem anderen Punkt.',
				'durchgang'
			);
		}
		const [t] = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item WHERE id = ${z.agenda_item_id}
		`;
		const u = brecheDurchgangAb(ausDb(z), new Date().toISOString(), begruendung, t?.title ?? '');
		const { anwesende, vertretungen, ausstand, ausstandVerwaltung } = await leseSchlussstand(
			tx,
			meetingId,
			z.agenda_item_id
		);
		const [neu] = await tx<Rundenzeile[]>`
			UPDATE voting_round
			   SET state = 'geschlossen', closed_at = now(), closed_by = ${handelnder.userId},
			       attendance_json = ${tx.json({ anwesende, vertretungen, ausstand, ausstandVerwaltung, quelle: zeitquelle() } as never)},
			       superseded_at = now(), supersede_kind = 'korrektur',
			       supersede_reason = ${u.ergebnis.ueberholungsgrund}
			 WHERE id = ${z.id} AND state = 'offen'
			RETURNING *
		`;
		if (!neu) throw keineOffene();
		await schreibeVerlauf(tx, handelnder, u.ereignisse[0]);
		return ausDb(neu);
	});
}

function keineOffene(): FachlicherFehler {
	return new FachlicherFehler('keine_offene', 'Zurzeit ist keine Abstimmung offen.', 'durchgang');
}

/** Beim Schliessen der Versammlung: alle offenen Abstimmungen mitschliessen. */
export async function schliesseOffeneAbstimmungen(
	tx: Tx,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id
): Promise<number> {
	// Gesperrt wie in `schliesseAbstimmung`, aus denselben Gründen.
	const offene = await tx<Rundenzeile[]>`
		SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
		   FOR UPDATE
	`;
	for (const z of offene) {
		await schliesseInTransaktion(tx, handelnder, meetingId, z);
	}
	return offene.length;
}

// ── Beschluss von Hand (Plan 30.09.2026, Block 1) ───────────────────────────

/** Was dem Notweg vorausgeht: was das Eröffnen jetzt sagen würde und was überholt würde. */
export interface VonHandVorschau {
	/** Die Absagen der vier Eröffnungsprüfungen, je die erste, die getroffen hätte. */
	uebergangen: Uebergangen[];
	/** Die Durchgänge, die der Beschluss von Hand überholt oder nach Rückkommen ersetzt. */
	ueberholt: Ueberholt[];
	/**
	 * Der Anwesenheitsstand, den ein Eintrag jetzt einfröre, als die
	 * Bezugsgrössen der Beschlussfähigkeit (Block 6, 02.10.2026).
	 *
	 * **Der Anlass** (Produktentscheid 02.10.2026: «Stand in der Maske zeigen»):
	 * Der Eintrag friert den Stand im Augenblick des Eintragens ein, das
	 * Protokoll sagt «bei diesem Beschluss», und rechtlich zählt die Abstimmung
	 * (Rz. 23 ad Art. 712p). Beim Nachtragen nach einem Ausfall fallen die zwei
	 * Zeitpunkte auseinander. Die Maske zeigt deshalb vor dem Knopf, was
	 * festgehalten wird.
	 *
	 * **Aus derselben Lesung wie der Eintrag** (`leseSchlussstand`) **und mit
	 * derselben Rechnung wie das Protokoll** (`beteiligungDerAnwesenden` über
	 * die Stimmkraft der Momentaufnahme): Was hier steht, rechnet das Protokoll
	 * später aus `attendance_json.anwesende`, sofern sich die Anwesenheit
	 * zwischen Vorschau und Eintrag nicht ändert.
	 *
	 * **Nicht aus der Lesung des Trockenlaufs.** Die Absage «nicht
	 * beschlussfähig» unter `uebergangen` liest über eine eigene Verbindung
	 * (`verlangeBeschlussfaehigkeitFuer`), diese Angabe in der Transaktion der
	 * Vorschau. Beide rechnen mit `beteiligungDerAnwesenden`; ein Einlass genau
	 * zwischen den zwei Lesungen kann sie für einen Seitenaufbau auseinander
	 * zeigen. Massgebend für das Protokoll ist keine von beiden, sondern der
	 * Stand, den der Eintrag selbst einfriert.
	 *
	 * `null` ohne Momentaufnahme; die Maske zeigt dann keine Zahlen.
	 */
	stand: Beteiligung | null;
}

/**
 * Wie überholte Durchgänge begründet werden (`voting_round_ueberholt` verlangt
 * einen Grund). Ohne den Weg zu nennen: Heute gibt keine Ausgabe den Grund bei
 * `notweg` aus, die Auswertung liest ihn nur bei `korrektur`; sollte es eine
 * tun, stünde dort kein Hinweis auf den Weg. Der steht nur im Verlauf.
 */
const UEBERHOLT_VON_HAND = 'Durch einen späteren Beschluss überholt';

/**
 * Fährt die Prüfungen des Eröffnens **trocken**: Jede Absage wird mit Kennung
 * und Satz gesammelt statt geworfen. Die Prüfungen selbst sind dieselben
 * Funktionen wie in `oeffneAbstimmung`, in derselben Reihenfolge.
 *
 * **Je Prüfung die erste Absage, nicht alle.** `pruefeDurchgangsfreigabe`
 * wirft am ersten Hindernis; gesammelt wird, was die Leitung beim Versuch zu
 * eröffnen gelesen hätte. Die Beschlussfähigkeit ist eine eigene Prüfung und
 * steht deshalb immer dabei, wenn sie fehlt; an ihr hängt die Rechtsfolge
 * (Rz. 33 ad Art. 712p).
 *
 * **Mit einem eigenen offenen Durchgang** zählt dieser bei «schon offen» nicht
 * mit, und die Rückkommensprüfung entfällt: Er hat sie beim Eröffnen
 * bestanden, und sie läse ihn sonst als bestehenden Durchgang, der einen
 * zweiten ohne Grund sperrt. **Stützte er sich auf ein Rückkommen, geht es auf
 * den Beschluss von Hand über** (Codeprüfung 01.10.2026, Befund 1): Der offene
 * Durchgang endet ohne Beschluss, und die Versammlung hat das Rückkommen für
 * den nächsten Beschluss zur Sache beschlossen, nicht für einen abgebrochenen
 * Durchgang. Bliebe der Verweis am abgebrochenen, läsen ihn die Sätze zur
 * Ersetzung als den Durchgang, der ersetzt hat, und fragten nach seinem
 * Ergebnis.
 *
 * **Die Universalversammlung gilt als bestätigt.** Die Bestätigung ist ein
 * Häkchen beim Eröffnen und keine Sperre; ohne diese Annahme stünde bei jedem
 * solchen Geschäft «nicht bestätigt» unter «übergangen», auch wenn alle da
 * sind, und die leere Liste wäre dort unerreichbar. Was der Stand im Saal
 * hergibt, prüft `universalgruende` weiter.
 *
 * Gefangen wird nur der fachliche Fehler. Alles andere ist ein Defekt und
 * bricht die Transaktion ab, statt als «übergangen» im Verlauf zu landen.
 */
async function fahreEroeffnungTrocken(
	tx: Tx,
	operatorId: string,
	meetingId: Id,
	traktandumId: Id,
	gelesen: Awaited<ReturnType<typeof leseEroeffnungslage>>,
	eigenerOffener: Rundenzeile | null
): Promise<{ uebergangen: Uebergangen[]; rueckkommenId: string | null }> {
	const { m, t, lage } = gelesen;
	const uebergangen: Uebergangen[] = [];
	const trocken = async <T>(pruefung: () => T | Promise<T>): Promise<T | null> => {
		try {
			return await pruefung();
		} catch (f) {
			if (!(f instanceof FachlicherFehler)) throw f;
			uebergangen.push({ kennung: f.kennung, satz: f.message });
			return null;
		}
	};
	await trocken(() =>
		pruefeDurchgangsfreigabe({
			...lage,
			offeneDurchgaenge: lage.offeneDurchgaenge - (eigenerOffener ? 1 : 0)
		})
	);
	await trocken(async () =>
		verlangeBeschlussfaehigkeitFuer(
			operatorId,
			meetingId,
			m,
			await pruefstufeFuerTraktandumIn(tx, meetingId, traktandumId, m.tier),
			{ konsultativ: true },
			traktandumId
		)
	);
	await trocken(() => verlangeWeisungen(tx, meetingId, traktandumId, t.instruction_bound));
	await trocken(() => verlangeEinladungsmehrBeimAbstimmen(tx, traktandumId, t.erfordernis));
	const rueckkommenId = eigenerOffener
		? eigenerOffener.reconsideration_item_id
		: await trocken(() => rueckkommenFuerEroeffnung(tx, meetingId, traktandumId, t));
	return { uebergangen, rueckkommenId };
}

/** Der Plan ohne die Kennung des Durchgangs, wie er in Vorschau und Verlauf steht. */
function ohneKennung(p: Ueberholt & { id: string }): Ueberholt {
	return {
		durchgang: p.durchgang,
		offen: p.offen,
		art: p.art,
		...(p.traktandumId ? { traktandumId: p.traktandumId } : {})
	};
}

/** Die nicht überholten Durchgänge des Traktandums selbst, offen oder geltend. */
async function leseZuUeberholende(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	/**
	 * Nur der Schreibweg sperrt. Die Vorschau lädt mit der Leitungsseite, und
	 * eine Sperre am offenen Durchgang hielte dort jede Stimmabgabe auf, die
	 * gerade ihre Zeile anfügt (Codeprüfung 01.10.2026).
	 */
	sperren: boolean
): Promise<Rundenzeile[]> {
	return tx<Rundenzeile[]>`
		SELECT * FROM voting_round
		 WHERE meeting_id = ${meetingId} AND agenda_item_id = ${traktandumId}
		   AND superseded_at IS NULL
		 ORDER BY ordinal
		 ${sperren ? tx`FOR UPDATE` : tx``}
	`;
}

/**
 * Welche Durchgänge der Beschluss von Hand überholt, und wie.
 *
 * **Trägt ihn ein angenommenes Rückkommen, ersetzt er den früheren Beschluss
 * der Sache wie ein gezählter Durchgang** (`rueckkommen`, mit Verweis): Die
 * Versammlung hat das Rückkommen beschlossen, und «mit dem neuen Beschluss zur
 * Sache, auch mit einer Ablehnung, wird der bisherige aufgehoben». Der frühere
 * liegt dabei am Grundtraktandum, wenn der Beschluss von Hand am Folgeantrag
 * festgehalten wird (Migration 133). So bleiben `massgebender_durchgang`, die
 * Sätze zur Ersetzung (`domain/folgeantragsersetzung.ts`) und die Neuabstimmung,
 * die den früheren wieder gelten lässt, ohne eigene Regel richtig.
 *
 * **Alles andere am eigenen Traktandum trägt `notweg`**: der geltende
 * Durchgang ohne tragendes Rückkommen und der offene. An einem anderen
 * Traktandum wird ohne Rückkommen nichts überholt (Produktentscheid
 * 01.10.2026); nach einer Ersetzung durch einen Folgeantrag folgen die Sätze
 * dem Stand (`findeErsetzung`; Plan, «Stand Block 2a»).
 *
 * Vor dem Einfügen des neuen Durchgangs zu rufen: Der massgebende der Sache
 * ist dann noch der frühere. Ein offener Durchgang an einem anderen Traktandum
 * wird nicht ersetzt; er bliebe sonst offen und überholt zugleich.
 */
async function planeUeberholung(
	tx: Tx,
	traktandumId: Id,
	rueckkommenId: string | null,
	bisher: Rundenzeile[],
	sperren: boolean
): Promise<(Ueberholt & { id: string })[]> {
	const plan: (Ueberholt & { id: string })[] = bisher.map((z) => ({
		id: z.id,
		durchgang: Number(z.ordinal),
		// zustand-nur-geschlossen: Zustand des Durchgangs, nicht der Versammlung.
		offen: z.state === 'offen',
		art: 'notweg'
	}));
	if (!rueckkommenId) return plan;
	// Ohne den eigenen offenen Durchgang: Er ist der jüngste nicht überholte
	// und wäre sonst selbst «der frühere».
	const frueherId = await fruehererDerSache(
		tx,
		rueckkommenId,
		traktandumId,
		plan.find((p) => p.offen)?.id ?? null
	);
	if (!frueherId) return plan;
	const eigener = plan.find((p) => p.id === frueherId);
	if (eigener) {
		if (!eigener.offen) eigener.art = 'rueckkommen';
		return plan;
	}
	const [f] = await tx<{ ordinal: number; agenda_item_id: string }[]>`
		SELECT ordinal, agenda_item_id FROM voting_round
		 WHERE id = ${frueherId} AND state = 'geschlossen'
		 ${sperren ? tx`FOR UPDATE` : tx``}
	`;
	if (f) {
		plan.push({
			id: frueherId,
			durchgang: Number(f.ordinal),
			offen: false,
			art: 'rueckkommen',
			traktandumId: f.agenda_item_id
		});
	}
	return plan;
}

/**
 * Was vor dem Knopf steht: die Empfehlung des Werkzeugs und was überholt würde.
 * Liest nur; wirft, wo der Notweg gar nicht geht (`verlangeVonHandMoeglich`).
 */
export async function holeVonHandVorschau(
	operatorId: string,
	meetingId: Id,
	traktandumId: Id
): Promise<VonHandVorschau> {
	return alsBetreiber(operatorId, async (tx) => {
		const gelesen = await leseEroeffnungslage(tx, meetingId, traktandumId, true);
		verlangeVonHandMoeglich({
			versammlungszustand: gelesen.m.state,
			traktandumtitel: gelesen.t.title,
			zurueckgezogen: gelesen.t.withdrawn_at != null
		});
		const bisher = await leseZuUeberholende(tx, meetingId, traktandumId, false);
		const { uebergangen, rueckkommenId } = await fahreEroeffnungTrocken(
			tx,
			operatorId,
			meetingId,
			traktandumId,
			gelesen,
			// zustand-nur-geschlossen: Zustand des Durchgangs, nicht der Versammlung.
			bisher.find((z) => z.state === 'offen') ?? null
		);
		const plan = await planeUeberholung(tx, traktandumId, rueckkommenId, bisher, false);
		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		const stand = momentaufnahme
			? beteiligungDerAnwesenden(
					stimmkraftliste(momentaufnahme),
					(await leseSchlussstand(tx, meetingId, traktandumId)).anwesende
				)
			: null;
		return { uebergangen, ueberholt: plan.map(ohneKennung), stand };
	});
}

/**
 * Hält einen Beschluss von Hand fest: an den Sperren beim Eröffnen und an der
 * Auszählung vorbei (Produktentscheid 30.09.2026).
 *
 * **Ein Durchgang, der geschlossen und verkündet entsteht**, mit vollständiger
 * Auszählung in `result_json`. So erreicht ihn jeder Leser über `ergebnisIn`,
 * ohne eigenen Weg, und die Festschreibung gilt wie bei jedem Ergebnis: Ein
 * Tippfehler lässt sich danach nur durch einen weiteren Durchgang berichtigen,
 * von Hand oder über die Neuabstimmung.
 *
 * **Was vorher am Traktandum galt, wird überholt** (Art `notweg`, Migration
 * 134): der geltende Durchgang und ein offener. Der offene wird dabei ohne
 * Auszählung geschlossen; offen und überholt zugleich hielte ihn der Index
 * «eine offene je Versammlung» und jedes Telefon weiter für laufend. Seine
 * Stimmzeilen bleiben stehen (AD-5). Sein Schliessen kann gerade die Sperre
 * sein, an der die Leitung vorbei will, deshalb wird hier nicht ausgezählt.
 *
 * **Rückkommen, am Code geklärt** (`tests/db/beschluss-von-hand.test.ts`;
 * die Regel dazu steht an `planeUeberholung`):
 *
 *   - Wartet ein angenommenes Rückkommen auf seinen Durchgang, trägt es diesen
 *     hier; er verbraucht es und ersetzt den früheren Beschluss der Sache wie
 *     ein gezählter Durchgang (`rueckkommen`), auch vom Folgeantrag aus.
 *   - Gilt ein Beschluss und trägt kein Rückkommen, steht die Absage unter
 *     «übergangen», und der frühere Durchgang am Traktandum wird als `notweg`
 *     überholt.
 *   - War ein Durchgang unter dem Rückkommen offen, geht der Verweis auf den
 *     neuen über (`fahreEroeffnungTrocken`), und der neue ersetzt den früheren
 *     Beschluss wie in der ersten Zeile.
 *   - Ohne tragendes Rückkommen wird an einem anderen Traktandum nichts
 *     überholt (Produktentscheid 01.10.2026: «Entscheid Notwegs: ja, bleibt
 *     dort.»). Nach einer Ersetzung durch einen Folgeantrag stehen dann zwei
 *     Beschlüsse zur selben Sache; die Sätze zur Ersetzung folgen dem Stand
 *     (`findeErsetzung`; Plan, «Stand Block 2a»).
 *
 * **Die Spur schreibt diese Funktion selbst**, in derselben Transaktion
 * (Muster «Leitung weicht ab», Punkt 2): Kein Aufrufer kann sie verlieren.
 */
export async function haltBeschlussVonHandFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	eingabe: VonHandEingabe
): Promise<{ durchgang: Durchgangsstand; uebergangen: Uebergangen[] }> {
	const begruendung = begruendungVonHand(eingabe.begruendung);
	return nochmalsBeiVerklemmung(() => alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Sperre am Traktandum**, wie beim Widerspruch vor dem Eröffnen
		 * (Migration 129): Zwei gleichzeitige Beschlüsse von Hand läsen sonst
		 * beide denselben Stand, und einer überholte den anderen nicht.
		 */
		await tx`
			SELECT 1 FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${meetingId} FOR UPDATE
		`;
		/*
		 * **Die Versammlung gleich danach, vor den Durchgängen**, in derselben
		 * Folge wie `oeffneAbstimmung` und `schliesseVersammlung` (Codeprüfung
		 * F6). Bis dahin nahm dieser Weg die Versammlung erst mit dem
		 * `UPDATE meeting` am Ende und las den Zustand, den
		 * `verlangeVonHandMoeglich` prüft, ohne Sperre: Ein Schluss dazwischen
		 * liess einen Beschluss von Hand nach dem Versammlungsschluss durch.
		 * Jetzt wartet er hier und liest danach «läuft nicht mehr».
		 */
		await tx`SELECT 1 FROM meeting WHERE id = ${meetingId} FOR NO KEY UPDATE`;
		// Die Durchgänge gesperrt, bevor die Lage gelesen wird: Die Zahl der
		// offenen Durchgänge geht in die trockene Prüfung, und ein Schliessen
		// dazwischen schriebe sonst «schon offen» zu Unrecht in den Verlauf.
		const bisher = await leseZuUeberholende(tx, meetingId, traktandumId, true);
		const gelesen = await leseEroeffnungslage(tx, meetingId, traktandumId, true);
		const { t } = gelesen;
		verlangeVonHandMoeglich({
			versammlungszustand: gelesen.m.state,
			traktandumtitel: t.title,
			zurueckgezogen: t.withdrawn_at != null
		});

		// zustand-nur-geschlossen: Zustand des Durchgangs, nicht der Versammlung.
		const offener = bisher.find((z) => z.state === 'offen') ?? null;
		// Der Grund «Eingewendete Bestimmung» setzt ein Ergebnis nach dem Gesetz
		// voraus, und am Abend kommt er ohne Notweg hierher (Entscheid 0046).
		/*
		 * **Nach dem Gesetz angenommen** (Featureprüfung E2, Z2): Der Protokollsatz
		 * sagt, der Antrag hätte das gesetzliche Mehr erreicht. Das muss das geltende
		 * Ergebnis an **diesem** Traktandum sein (nach einer Ersetzung durch einen
		 * Folgeantrag zeigt `massgebender_durchgang` auf dessen Durchgang; Codeprüfung
		 * Fix-Block N3), angenommen, gezählt oder von Hand. Ein früherer Eintrag mit
		 * eingewendeter Bestimmung zählt auch: Er wurde beim Festhalten so geprüft, und
		 * die Quittung lädt zur Berichtigung ein (Fix-Block M2).
		 *
		 * **Ein angenommenes Rückkommen ohne neue Abstimmung** lässt den alten Durchgang
		 * massgebend, und der Eintrag verbraucht das Rückkommen wie beim Notweg
		 * (`fahreEroeffnungTrocken`). Der Protokollsatz bezieht sich dann auf die
		 * Abstimmung vor dem Rückkommen; vertretbar, weil der Saal über das Rückkommen
		 * nicht neu über die Sache entschieden hat (Fix-Block N4).
		 */
		let nachGesetzAngenommen = false;
		if (eingabe.grund === 'eingewendete_bestimmung' && offener == null) {
			const [m] = await tx<{ id: string | null }[]>`SELECT massgebender_durchgang(${traktandumId}) AS id`;
			if (m?.id) {
				const geltend = await ergebnisIn(tx, meetingId, m.id);
				nachGesetzAngenommen =
					geltend.durchgang.traktandumId === traktandumId &&
					(geltend.auszaehlung?.angenommen === true || geltend.auszaehlung?.vonHand?.einwand !== undefined);
			}
		}
		verlangeEinwandOhneOffenenDurchgang({
			grund: eingabe.grund,
			durchgangOffen: offener != null,
			amErfordernis: t.erfordernis != null && einwandLageDesErfordernisses(t.erfordernis) !== null,
			nachGesetzAngenommen
		});
		const { uebergangen, rueckkommenId } = await fahreEroeffnungTrocken(
			tx,
			handelnder.operatorId,
			meetingId,
			traktandumId,
			gelesen,
			offener
		);

		// Vor dem Einfügen: Der massgebende der Sache ist jetzt noch der frühere.
		const plan = await planeUeberholung(tx, traktandumId, rueckkommenId, bisher, true);

		// Der offene Durchgang gibt sein Rückkommen ab, bevor der neue es trägt:
		// «Ein Durchgang je Rückkommen» (Migration 131) liesse beide nicht zu.
		if (offener?.reconsideration_item_id) {
			await tx`UPDATE voting_round SET reconsideration_item_id = NULL WHERE id = ${offener.id}`;
		}

		const auszaehlung = auszaehlungVonHand(
			eingabe,
			// `?.`: Die Form prüft erst `auszaehlungVonHand`; ohne Zahlen soll die
			// fachliche Absage kommen, kein Typfehler.
			eingabe.zahlen?.erfassung === 'parteien' ? await holeMomentaufnahmeIn(tx, meetingId) : null,
			// Für die Wahl je Partei die Zählweise an diesem Traktandum (L3).
			t.erfordernis ?? undefined
		);

		// Der Stand dieses Augenblicks, wie beim Schliessen (AD-16).
		const stand = tx.json({
			...(await leseSchlussstand(tx, meetingId, traktandumId)),
			quelle: zeitquelle()
		} as never);

		const [letzte] = await tx<{ nummer: number | null }[]>`
			SELECT max(ordinal) AS nummer FROM voting_round WHERE agenda_item_id = ${traktandumId}
		`;
		const nummer = Number(letzte?.nummer ?? 0) + 1;

		const [neu] = await tx<Rundenzeile[]>`
			INSERT INTO voting_round (operator_id, meeting_id, agenda_item_id, ordinal, state,
			                          opened_by, closed_at, closed_by,
			                          requirement_json, attendance_json, reconsideration_item_id,
			                          result_published_at, result_published_by, result_json)
			VALUES (${handelnder.operatorId}, ${meetingId}, ${traktandumId}, ${nummer}, 'geschlossen',
			        ${handelnder.userId}, now(), ${handelnder.userId},
			        ${tx.json((t.erfordernis ?? ERFORDERNIS_VON_HAND) as never)}, ${stand},
			        ${rueckkommenId},
			        now(), ${handelnder.userId}, ${festgeschrieben(tx, auszaehlung)})
			RETURNING *
		`;

		for (const p of plan) {
			if (p.art === 'rueckkommen') {
				await ersetzeNachRueckkommen(tx, p.id, neu.id);
			} else if (p.offen) {
				// Geschlossen ohne Auszählung und ohne Verkündung: Es gibt für ihn
				// kein Ergebnis, und `result_json` bleibt leer.
				await tx`
					UPDATE voting_round
					   SET state = 'geschlossen', closed_at = now(), closed_by = ${handelnder.userId},
					       attendance_json = ${stand},
					       superseded_at = now(), supersede_kind = 'notweg',
					       supersede_reason = ${UEBERHOLT_VON_HAND}, superseded_by_round_id = ${neu.id}
					 WHERE id = ${p.id}
				`;
			} else {
				await tx`
					UPDATE voting_round
					   SET superseded_at = now(), supersede_kind = 'notweg',
					       supersede_reason = ${UEBERHOLT_VON_HAND}, superseded_by_round_id = ${neu.id}
					 WHERE id = ${p.id}
				`;
			}
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			beschlussVonHandEreignis({
				durchgangId: neu.id,
				meetingId,
				traktandumId,
				traktandumtitel: t.title,
				nummer,
				auszaehlung,
				begruendung,
				uebergangen,
				ueberholt: plan.map(ohneKennung),
				universalBestaetigungUnterstellt: gelesen.lage.universal != null
			})
		);

		// Wie beim Eröffnen: Wand und Telefone zeigen das Traktandum, zu dem
		// soeben ein Ergebnis verkündet ist (AD-10). **Nicht, solange an einem
		// anderen Traktandum eine Abstimmung offen ist** (Codeprüfung 01.10.2026):
		// Die Wand bliebe bei der offenen, und nach deren Schliessen zeigte sie
		// dieses Ergebnis statt des eben abgestimmten.
		// **Nicht mit dem Grund «Eingewendete Bestimmung»** (Featureprüfung E2, Z3): Die
		// Abstimmung ist geschlossen und war aufgerufen; am gemeinsamen Abend, wo dieser
		// Grund ohne Notweg kommt, stellte der Aufruf sonst Wand und Steuerung des Abends
		// auf diesen Punkt zurück, auch wenn er schon weiter ist.
		if (eingabe.grund !== 'eingewendete_bestimmung') {
			await tx`
				UPDATE meeting
				   SET current_agenda_item_id = ${traktandumId},
				       current_agenda_item_at = now()
				 WHERE id = ${meetingId}
				   AND NOT EXISTS (
				         SELECT 1 FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
				       )
			`;
		}

		return { durchgang: ausDb(neu), uebergangen };
	}));
}

/**
 * Ob am gespeicherten Erfordernis eines Traktandums der Grund «Eingewendete
 * Bestimmung» gilt (`einwandLageAm`). **Das Verhalten steht nicht in der
 * Datenbank:** Das Traktandum speichert das Erfordernis spaltenweise ohne
 * `reglementsverhalten` (`haltErfordernisAmTraktandumFest`); es kommt aus dem
 * Knoten seiner Fassung. Ein Erfordernis, das es mitbringt (frisch aus dem
 * Baum), behält seines. Ohne Knoten (von Hand, Rückkommen) gilt der Grund nicht.
 */
export function einwandLageDesErfordernisses(
	e: Pick<Erfordernis, 'fassung' | 'knotenId' | 'typ'> &
		Partial<Pick<Erfordernis, 'reglementsverhalten' | 'quelle' | 'rechtsgrundlage'>>
): ReturnType<typeof einwandLageAm> {
	const verhalten = e.reglementsverhalten ?? knotenDerFassung(e.fassung, e.knotenId)?.reglementsverhalten;
	return einwandLageAm({ ...e, reglementsverhalten: verhalten });
}

// ── Neuabstimmung (Story 5.10) ──────────────────────────────────────────────

export async function setzeNeuabstimmungAn(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	durchgangId: Id,
	begruendung: string
): Promise<Durchgangsstand> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **`FOR UPDATE`, weil die Schranke an der Verkündung hängt** (H6). Ein
		 * Stichentscheid, der gleichzeitig eingetragen wird, verkündet denselben
		 * Durchgang und sperrt ihn dafür ebenso (`haltStichentscheidFest`). So
		 * sieht der zweite Weg den Stand des ersten: Die Neuabstimmung findet das
		 * Ergebnis verkündet, oder der Stichentscheid findet den Durchgang
		 * überholt.
		 */
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
			   FOR UPDATE
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Durchgang nicht gefunden.', 'durchgang');

		/*
		 * **Nur solange die Versammlung läuft** (Nachzug Block 1c, 03.10.2026;
		 * «Stand Block 6»/«Stand Block 7c», Punkt 5). Die Neuabstimmung ist eine
		 * Korrektur des Ablaufs; nach dem Schluss steht in Protokoll und
		 * Auswertung bereits, was gilt, und ein von Hand gesendeter Aufruf
		 * überholte den Durchgang hinter dem Rücken beider. Bis dahin prüfte
		 * diese Funktion den Versammlungszustand nicht (in der Abnahme
		 * 02.10.2026 gemessen); die beiden Leitungsseiten bieten sie nach dem
		 * Schluss ohnehin nicht mehr an, weil `schliesseVersammlung` das
		 * aufgerufene Traktandum leert.
		 *
		 * Gerichtet nach `verlangeVonHandMoeglich` (`domain/vonhand.ts`), dem
		 * nächsten «nach dem Schluss ist Schluss»-Wächter in derselben Rechnung,
		 * und nach der ersten Absage von `pruefeDurchgangsfreigabe`
		 * (`domain/abstimmung.ts`): nur die laufende Versammlung.
		 */
		const [m] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId}
		`;
		if (m?.state !== 'laufend') {
			throw new FachlicherFehler(
				'nicht_laufend',
				m?.state === 'freigegeben'
					? 'Die Versammlung ist noch nicht eröffnet. Eine Neuabstimmung lässt sich erst ab ' +
						'der Eröffnung ansetzen.'
					: 'Die Versammlung läuft nicht mehr. Eine Neuabstimmung lässt sich nur ansetzen, ' +
						'solange sie läuft.',
				'zustand'
			);
		}

		/*
		 * **Nach einem Widerspruch führt eine Neuabstimmung nirgends hin**
		 * (Codeprüfung Block 3, dritter Durchgang, M1): Das Eröffnen weist danach
		 * ab (`fruehererWiderspruch`). Angesetzt stünde sie als Knopf da, der in
		 * eine Absage führt.
		 *
		 * Der Schluss wie auf der Leitungsseite: Gilt nach einem Rückkommen ein
		 * früherer Beschluss, bleibt er (`docs/freigabe.md`, «Offen: Reste zur
		 * Universalversammlung», Punkt 10).
		 */
		if ((await leseWidersprueche(tx, meetingId)).has(z.agenda_item_id)) {
			throw new FachlicherFehler(
				'nach_widerspruch',
				`${UNIVERSAL_NACH_WIDERSPRUCH} ${nachWiderspruchSchluss(
					await beschlussGiltIn(tx, meetingId, z.agenda_item_id)
				)}`,
				'durchgang'
			);
		}

		const [t] = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item WHERE id = ${z.agenda_item_id}
		`;
		/*
		 * **Nach einem Rückkommen mit offenem Stichentscheid** ist der Durchgang
		 * schon überholt (`rueckkommen_erfolglos`), der frühere Beschluss gilt.
		 * Festgestellt wird der Stichentscheid über die Neuabstimmung mit
		 * Einzelerfassung; deshalb wird aus dieser Überholung eine Neuabstimmung,
		 * und das Rückkommen trägt den nächsten Durchgang (Reste vom 30.09.2026,
		 * Punkt 3). Jeder andere überholte Durchgang bleibt gesperrt.
		 *
		 * **Dasselbe nach Eintritt der Beschlussfähigkeit** (Migration 139):
		 * Endete der zweite Durchgang mit offenem Stichentscheid, ist er als
		 * `nachquorum_erfolglos` überholt, und der von Hand festgehaltene
		 * Beschluss gilt. Die Neuabstimmung holt den Entscheid nach; sie ist
		 * der zweite Durchgang desselben Wegs.
		 */
		const offenerStichentscheid =
			(z.supersede_kind === 'rueckkommen_erfolglos' ||
				z.supersede_kind === 'nachquorum_erfolglos') &&
			(await ergebnisIn(tx, meetingId, z.id)).auszaehlung?.stichentscheidOffen === true;
		const u = ueberholeDurchgang(
			offenerStichentscheid ? { ...ausDb(z), ueberholtAm: null } : ausDb(z),
			new Date().toISOString(),
			begruendung,
			t?.title ?? ''
		);

		await tx`
			UPDATE voting_round
			SET superseded_at = now(), supersede_kind = 'korrektur',
			    supersede_reason = ${u.ergebnis.ueberholungsgrund}
			WHERE id = ${durchgangId}
		`;
		await schreibeVerlauf(tx, handelnder, u.ereignisse[0]);

		/*
		 * **Einen früheren Beschluss stellt die Neuabstimmung nicht mehr her**
		 * (H6). Bis dahin nahm sie hier die Überholung eines früheren Durchgangs
		 * zurück, wenn der überholte ihn nach einem Rückkommen ersetzt hatte
		 * («Früherer Beschluss gilt wieder», Migration 131). Ersetzt wird nach
		 * einem Rückkommen aber nur mit einem Beschluss (`schliesseInTransaktion`,
		 * `haltBeschlussVonHandFest`), und der ist mit dem Schliessen verkündet;
		 * überholen lässt sich seither nur, was nicht verkündet ist. Der Fall
		 * kann nicht mehr entstehen. Einen verkündeten Beschluss ändert nur die
		 * Versammlung, mit einem neuen Rückkommen.
		 */

		// Der neue Durchgang entsteht nicht hier: Die Sitzungsleitung gibt ihn
		// ausdrücklich frei, wenn sie so weit ist. Sonst stünde nach dem Klick
		// sofort wieder eine Frage auf allen Telefonen.
		return ausDb(z);
	});
}

// ── Verkünden (Story 5.9) ───────────────────────────────────────────────────
//
// **Es gibt keinen eigenen Schritt mehr** (Produktentscheid 21.08.2026): «Mit dem
// Schliessen der Abstimmung, auch wenn nicht alle abgestimmt haben, soll
// automatisch verkündet werden. Ich sehe dort den Mehrwert nicht.»
//
// `gibErgebnisFrei` ist deshalb entfallen. Verkündet wird in
// `schliesseInTransaktion`; ein offener Stichentscheid nach Wertquoten wird
// nicht verkündet, sondern über die Neuabstimmung gelöst. Der Zeitstempel bleibt: Die
// Anfechtungsfrist läuft ab Kenntnis des Beschlusses (ZGB Art. 75 i.V.m.
// Art. 712m).

// ── Stichentscheid durch eine Person (Story 7.9) ────────────────────────────

/**
 * Trägt den Entscheid ein, den das Reglement einer Person zuweist.
 *
 * **Die Klausel gilt wieder** (Produktentscheid 28.09.2026: «Wendet es an.
 * Empfohlen wird ablehnen, weil das dem Gesetz entspricht und man nicht Partei
 * ergreifen würde.»). Vom 27.09.2026 bis dahin rechnete das Werkzeug bei
 * Gleichstand nach dem Gesetz; seither hält es an, bis der Entscheid
 * eingetragen ist. Ein Reglement kann etwa sagen: «Bei Stimmengleichheit
 * entscheidet der Verwalter.» Die Anwendung kann ihn nicht ausrechnen; sie
 * nimmt ihn entgegen und hält fest, **wer** entschieden hat. Ohne Namen wäre
 * der Eintrag im Protokoll wertlos, denn angefochten wird genau diese Person
 * und ihre Befugnis (Rz. 187 ad Art. 712m).
 *
 * Vier Schranken:
 *   - erst nach dem Schliessen — vorher stünde der Entscheid vor dem Gleichstand;
 *   - nur, wenn tatsächlich ein Gleichstand vorliegt, den das Reglement dieser
 *     Person zuweist. Sonst wäre es kein Stichentscheid, sondern eine Umgehung
 *     der Abstimmung;
 *   - nur einmal: Ein eingetragener Entscheid verkündet und bleibt, auch gegen
 *     einen zweiten, der zugleich eingetragen wird (Befund S6);
 *   - nicht mehr nach dem Verkünden — dann gilt der Beschluss im Saal; ein
 *     späterer Entscheid ist die Berichtigung eines Beschlusses, und die
 *     steht nur der Versammlung zu (H6, `WEG_NACH_DER_VERKUENDUNG`).
 */
export async function haltStichentscheidFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	durchgangId: Id,
	eingabe: { wahl: 'yes' | 'no'; wer: string; begruendung?: string; eigentuemer?: boolean }
): Promise<Durchgangsstand> {
	const wer = eingabe.wer.trim();
	if (zeichenzahl(wer) < 2) {
		throw new FachlicherFehler(
			'ohne_namen',
			'Wer entschieden hat, gehört ins Protokoll. Tragen Sie den Namen ein.',
			'wer'
		);
	}
	if (eingabe.wahl !== 'yes' && eingabe.wahl !== 'no') {
		throw new FachlicherFehler('unbekannt', 'Unbekannter Entscheid.', 'wahl');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Sperren in der Folge des Hauses: Traktandum, Versammlung,
		 * Durchgang** (Auftrag Abschluss, C2, 16.10.2026). Dieser Weg schreibt
		 * den Durchgang zweimal. Das zweite `UPDATE` trifft eine Zeile, die die
		 * eigene Transaktion schon geschrieben hat, und fährt deshalb die
		 * Fremdschlüsselprüfung aufs Traktandum (`FOR KEY SHARE`), auch ohne
		 * geänderten Schlüssel. Bis dahin sperrte er den Durchgang zuerst und
		 * das Traktandum erst dort; der Beschluss von Hand sperrt umgekehrt, und
		 * beide zugleich am selben Traktandum endeten mit 40P01 (gemessen,
		 * `tests/db/abschluss-rennen.test.ts`, C2). Jetzt nimmt dieser Weg die
		 * Sperre der Fremdschlüsselprüfung gleich am Anfang. Das Traktandum
		 * eines Durchgangs ändert sich nie, es darf also ungesperrt gelesen
		 * werden.
		 */
		const [kopf] = await tx<{ agenda_item_id: string }[]>`
			SELECT agenda_item_id FROM voting_round WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
		`;
		if (!kopf) throw new FachlicherFehler('unbekannt', 'Durchgang nicht gefunden.', 'durchgang');
		await tx`SELECT 1 FROM agenda_item WHERE id = ${kopf.agenda_item_id} FOR KEY SHARE`;
		// Wie beim Text zum Beschluss (Befund D7): Ein laufendes Versiegeln hält
		// die Versammlung; dieser Weg wartet darauf und bekommt danach den Satz
		// statt der rohen Ausnahme des Auslösers.
		const [v] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId} FOR KEY SHARE
		`;
		/*
		 * **`FOR UPDATE`** (Sicherheitsdurchgang 09.10.2026, Befund S6). Ohne
		 * Sperre lasen zwei gleichzeitige Einträge denselben offenen Gleichstand,
		 * beide schrieben, und der zweite überschrieb den ersten still: Im Verlauf
		 * standen zwei Entscheide, im Ergebnis nur der letzte. Jetzt wartet der
		 * zweite hier und findet danach den ersten (Vorbild
		 * `haltBeschlusstextFest`).
		 */
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
			FOR UPDATE
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Durchgang nicht gefunden.', 'durchgang');
		if (v?.state === 'versiegelt') {
			throw new FachlicherFehler(
				'versiegelt',
				'Diese Versammlung ist versiegelt. Ein Stichentscheid änderte den Nachweis und lässt ' +
					'sich danach nicht mehr eintragen.',
				'zustand'
			);
		}
		// zustand-nur-geschlossen: `z` ist hier eine Zeile aus `voting_round`, also
		// ein Abstimmungsdurchgang. Der kennt vier Zustände und kein «versiegelt».
		if (z.state !== 'geschlossen') {
			throw new FachlicherFehler(
				'nicht_geschlossen',
				'Ein Stichentscheid setzt einen Gleichstand voraus, und der steht erst nach dem ' +
					'Schliessen der Abstimmung fest.',
				'zustand'
			);
		}
		// Ein überholter Durchgang trägt keinen Entscheid mehr: Er steht in keinem
		// Protokoll, und ein direkter POST setzte das Ergebnis an einem Durchgang
		// fest, der nicht mehr gilt (dieselbe Schranke wie in
		// `setzeBeschlussvermerk` und `setzeNeuabstimmungAn`).
		if (z.superseded_at) {
			throw new FachlicherFehler(
				'ueberholt',
				'Dieser Durchgang ist überholt. Ein Stichentscheid träte hier in kein Protokoll; ' +
					'entscheiden Sie am geltenden Durchgang.',
				'durchgang'
			);
		}
		// Gegen den Stand **ohne** bereits eingetragenen Entscheid prüfen: Sonst
		// verschwände der Gleichstand durch den ersten Eintrag, und ein zweiter
		// Eintrag hörte «kein Gleichstand» statt «schon entschieden» (unten).
		// Eine Berichtigung gibt es nicht; der Eintrag verkündet (Befund S6).
		//
		// **Und nur, wo das Reglement eine Person benennt** (Nachtrag 04.10.2026):
		// `stichentscheidOffen` entsteht auch beim Quotenstichentscheid über einer
		// Handzählung. Ohne diese Bedingung nähme ein direkter POST einen
		// Entscheid entgegen, den das Reglement den Wertquoten zuweist; der Satz
		// der Absage nennt seit jeher genau diesen Fall.
		const ohne = await ergebnisIn(tx, meetingId, durchgangId);
		const gleichstandOffen =
			(ohne.auszaehlung?.stichentscheidArt === 'verwalter' ||
				ohne.auszaehlung?.stichentscheidArt === 'vorsitz') &&
			(ohne.auszaehlung?.stichentscheidOffen === true ||
				(ohne.auszaehlung?.durchStichentscheid === true && z.tie_break_choice !== null));
		if (!gleichstandOffen) {
			throw new FachlicherFehler(
				'kein_gleichstand',
				'Hier gibt es keinen Gleichstand, den das Reglement einer Person zuweist. Ein ' +
					'Stichentscheid wäre eine Umgehung der Abstimmung.',
				'stichentscheid'
			);
		}
		// Der Vermerk gilt nur beim Vorsitz (Migration 150). Ein Verwalter
		// entscheidet nach seiner Klausel, auch wenn er selbst Eigentümer ist; der
		// Vermerk gehörte dort zu einer Regel, die das Reglement nicht nennt.
		const eigentuemer = eingabe.eigentuemer === true;
		if (eigentuemer && ohne.auszaehlung?.stichentscheidArt !== 'vorsitz') {
			throw new FachlicherFehler(
				'nicht_vorsitz',
				'Den Vermerk «selbst Stockwerkeigentümer» gibt es nur, wo das Reglement den ' +
					'Stichentscheid dem Vorsitz zuweist. Hier entscheidet der Verwalter.',
				'eigentuemer'
			);
		}

		/*
		 * **Ein gefällter Entscheid bleibt** (Befund S6). Er verkündet im selben
		 * Schritt, die Sperre darunter finge ihn also auch. Hier steht er eigens,
		 * weil der Satz dort vom verkündeten Ergebnis spricht, und wer zugleich
		 * mit einem anderen eingetragen hat, wissen muss, wessen Entscheid gilt.
		 */
		if (z.tie_break_choice !== null) {
			throw new FachlicherFehler(
				'schon_entschieden',
				`Der Stichentscheid ist schon eingetragen: ${z.tie_break_by ?? 'ohne Namen'} hat ` +
					`auf ${z.tie_break_choice === 'yes' ? 'Annahme' : 'Ablehnung'} entschieden. Das ` +
					`Ergebnis gilt und ist verkündet. ${WEG_NACH_DER_VERKUENDUNG}`,
				'stichentscheid'
			);
		}

		/*
		 * **Erst hier, nicht davor** (21.08.2026). Seit das Schliessen verkündet,
		 * trägt jeder geschlossene Durchgang ohne Gleichstand einen
		 * Verkündungszeitpunkt — die Sperre stünde sonst vor der Gleichstandsfrage
		 * und beantwortete «hier gibt es gar keinen Gleichstand» mit «das Ergebnis
		 * ist schon verkündet». Was zutrifft, aber nicht das ist, was der Fall ist.
		 *
		 * Was hier bleibt, ist der Fall, für den die Sperre gedacht war: Der
		 * Entscheid steht, er hat verkündet — und soll nachträglich geändert werden.
		 * Seit S6 fängt diesen Fall schon «schon entschieden» oben ab; die Sperre
		 * hier bleibt als Netz für ein verkündetes Ergebnis ohne eingetragenen
		 * Entscheid.
		 */
		if (z.result_published_at) {
			throw new FachlicherFehler(
				'schon_verkuendet',
				'Das Ergebnis ist verkündet. Ein späterer Entscheid änderte einen Beschluss, der im ' +
					`Saal bereits gilt. ${WEG_NACH_DER_VERKUENDUNG}`,
				'zustand'
			);
		}

		/*
		 * **Und damit ist verkündet** (21.08.2026). Seit das Schliessen selbst
		 * verkündet, ist dies die einzige Stelle, an der ein Ergebnis später
		 * sichtbar wird: Beim Gleichstand stand bis zum Entscheid keines fest.
		 * Bliebe die Verkündung hier aus, hinge das Ergebnis für immer in der
		 * Schwebe — an der Wand stünde nichts, und niemand suchte einen Knopf,
		 * den es nicht mehr gibt.
		 */
		await tx`
			UPDATE voting_round
			SET tie_break_choice = ${eingabe.wahl},
			    tie_break_by     = ${wer},
			    tie_break_reason = ${eingabe.begruendung?.trim() || null},
			    tie_break_by_owner = ${eigentuemer},
			    tie_break_at     = now()
			WHERE id = ${durchgangId}
		`;
		/*
		 * **Erst den Entscheid eintragen, dann festschreiben** (25.09.2026). Das
		 * festgeschriebene Ergebnis muss den Stichentscheid schon enthalten, und
		 * `ergebnisIn` liest ihn aus der Zeile. Bis zur Verkündung trägt der
		 * Durchgang keine Festschreibung, also wird hier noch gerechnet.
		 */
		const entschieden = await ergebnisIn(tx, meetingId, durchgangId);
		const [neu] = await tx<Rundenzeile[]>`
			UPDATE voting_round
			SET result_published_at = now(),
			    result_published_by = ${handelnder.userId},
			    result_json = ${festgeschrieben(tx, entschieden.auszaehlung)}
			WHERE id = ${durchgangId}
			RETURNING *
		`;

		const [t] = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item WHERE id = ${z.agenda_item_id}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.stichentscheidGefaellt,
				{ art: 'meeting', id: meetingId },
				{
					traktandum: t?.title ?? '',
					durchgang: Number(z.ordinal),
					entscheid: eingabe.wahl === 'yes' ? 'Annahme' : 'Ablehnung',
					wer,
					begruendung: eingabe.begruendung?.trim() || null,
					...(eigentuemer ? { zweiteStimme: true } : {})
				}
			)
		);
		return ausDb(neu);
	});
}

/**
 * Wie lang der Text zum Beschluss höchstens sein darf.
 *
 * Dieselbe Zahl wie das `maxlength` der Maske. Sie ist nicht geraten, sondern
 * an der Wirkung gemessen: Bei rund 90 Zeichen je Zeile sind 600 Zeichen etwa
 * sieben Zeilen, und dafür ist im Auswertungsblatt Platz gerechnet.
 */
export const BESCHLUSSTEXT_HOECHSTENS = 600;

/**
 * Den Text zum Beschluss eines Durchgangs festhalten (Auftraggeber, 09.09.2026).
 *
 * **Was er ist und was nicht.** «Der Text zum Beschluss führt Details,
 * Präzisierungen oder Änderungen aus. Annahme und Ablehnung erfolgt hart über
 * die Abstimmung.» Er steht also **unter** dem gerechneten Ergebnis, nicht
 * daneben und nicht dagegen: «Angenommen: … Nötig war …» kommt aus der
 * Auszählung (seit F4c B2b, vorher «Angenommen mit …»), «zum Kostendach von
 * CHF 8'000» von hier.
 *
 * **Warum nicht ins Votum** (`agenda_item.minute_text`). Das hält, was gesagt
 * wurde, und kann eine Seite sein. Der Beschluss ist die Essenz daraus, und
 * genau diese Essenz gehört später in eine Pendenz — wer dafür das Votum
 * nimmt, nimmt eine Seite Fliesstext.
 *
 * **Warum am Durchgang und nicht am Traktandum.** Er präzisiert ein Ergebnis
 * und gehört deshalb zu dem Lauf, dessen Ergebnis er präzisiert. Am Traktandum
 * trüge ihn eine Neuabstimmung weiter und stellte ihn unter ein Ergebnis, das
 * inzwischen ein anderes ist.
 *
 * **Nur nach dem Schliessen**, denn vorher gibt es nichts zu präzisieren.
 *
 * **Aber auch nach dem Verkünden** — anders als beim Stichentscheid darüber,
 * und das ist kein Versehen: Der Stichentscheid **setzt** ein Ergebnis, deshalb
 * sperrt er nach der Verkündung. Dieser Text ändert am Ergebnis nichts, und ein
 * Protokoll entsteht nun einmal nach der Sitzung.
 *
 * **Bis zum Siegel, und dort ist Schluss** (Code-Review 09.09.2026). Der erste
 * Anlauf berief sich hier auf die Protokollnotiz, die auch danach offen bleibt.
 * Das trägt nicht: Die Notiz sitzt an `agenda_item` und ist bewusst nicht Teil
 * des Nachweises, dieser Text sitzt am Durchgang und ist es. Der Trigger
 * `voting_round_nach_siegel` (Migration 039) weist jede Änderung ab — ohne die
 * Prüfung hier käme sie als rohe Datenbankausnahme durch und endete auf einer
 * Fehlerseite statt in einem Satz.
 *
 * **Nicht am überholten Durchgang.** Er trägt sein eigenes Ergebnis und bleibt
 * einsehbar, aber was dort noch geschrieben wird, erscheint nirgends — ein
 * Erfolg, den niemand sieht, ist eine Absage mit Verspätung.
 *
 * Der leere Text löscht: Wer sich vertippt hat, muss den Satz wieder wegbekommen.
 */
export async function haltBeschlusstextFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	durchgangId: Id,
	text: string,
	/**
	 * Der Text, den der Absender zuletzt kannte — für die Konfliktprüfung.
	 *
	 * **Wozu** (Code-Review 09.09.2026): Am gemeinsamen Abend steht dasselbe
	 * Feld in zwei Masken offen, in der Leitung des Hauses und in der des
	 * Abends. Ohne diesen Vergleich überschriebe die zweite Absendung die erste
	 * stillschweigend. `undefined` heisst «ungeprüft» und ist der Weg für
	 * Aufrufer ohne bekannten Stand.
	 */
	bisher?: string
): Promise<Durchgangsstand> {
	const wortlaut = text.trim();
	/*
	 * **Die Schranke gehört auch auf den Server** (Sicherheitsprüfung
	 * 09.09.2026). `maxlength` in der Maske ist eine Führung, keine Grenze. Ohne
	 * die hier fiel ein sehr langer Text am Seitenende der `Auswertung.pdf`
	 * **stillschweigend** heraus — aus dem Blatt, das ins Siegelpaket geht. Ein
	 * Text, der im Nachweis fehlt, ohne dass es jemand merkt, ist schlimmer als
	 * einer, der abgewiesen wird.
	 *
	 * `zeichenzahl` und nicht `.length`: JavaScript zählt UTF-16-Einheiten.
	 */
	if (zeichenzahl(wortlaut) > BESCHLUSSTEXT_HOECHSTENS) {
		throw new FachlicherFehler(
			'zu_lang',
			`Der Text zum Beschluss fasst höchstens ${BESCHLUSSTEXT_HOECHSTENS} Zeichen. Was ` +
				'länger ist, gehört ins Votum darüber — dort steht, was gesagt wurde.',
			'text'
		);
	}
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// `FOR UPDATE`: Zwischen Lesen und Schreiben liegt die Konfliktprüfung.
		// Ohne Sperre lesen zwei gleichzeitige Absendungen denselben Stand, beide
		// finden nichts Veraltetes, und die zweite überschreibt die erste still —
		// genau die Überschreibung, die hier verhindert werden soll (dieselbe
		// Überlegung wie in `protokoll.ts`).
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
			FOR UPDATE
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Durchgang nicht gefunden.', 'durchgang');
		// `FOR KEY SHARE` (Befund D7): Ein laufendes Versiegeln hält die
		// Versammlung mit `FOR UPDATE`. Ohne Sperre läse dieser Weg «geschlossen»,
		// und erst der Auslöser wiese ihn nach dem Siegel roh ab; so wartet er und
		// bekommt den Satz darunter.
		const [v] = await tx<{ state: string }[]>`
			SELECT state FROM meeting WHERE id = ${meetingId} FOR KEY SHARE
		`;
		if (v?.state === 'versiegelt') {
			throw new FachlicherFehler(
				'versiegelt',
				'Diese Versammlung ist versiegelt. Der Text zum Beschluss gehört zum Nachweis und ' +
					'lässt sich danach nicht mehr ändern.',
				'zustand'
			);
		}
		if (z.superseded_at) {
			throw new FachlicherFehler(
				'ueberholt',
				'Dieser Durchgang ist überholt. Halten Sie den Text am geltenden Durchgang fest — ' +
					'am überholten stünde er in keinem Protokoll.',
				'durchgang'
			);
		}
		// zustand-nur-geschlossen: `z` ist eine Zeile aus `voting_round`, also ein
		// Abstimmungsdurchgang. Der kennt vier Zustände und kein «versiegelt».
		if (z.state !== 'geschlossen') {
			throw new FachlicherFehler(
				'nicht_geschlossen',
				'Ein Text zum Beschluss setzt einen Beschluss voraus, und der steht erst nach dem ' +
					'Schliessen der Abstimmung fest.',
				'zustand'
			);
		}
		// Eine konsultative Abstimmung ergibt keinen Beschluss, zu dem ein Text
		// gehören könnte (Migration 158; Codeprüfung 14.10.2026, M4).
		if (z.consultative) {
			throw new FachlicherFehler(
				'konsultativ',
				'Über diesen Durchgang wurde nur konsultativ abgestimmt; es gibt keinen Beschluss, zu dem ' +
					'ein Text gehört. Halten Sie Bemerkungen beim Traktandum im Feld «Voten, Begründungen, ' +
					'Ordnungsentscheide» fest.',
				'durchgang'
			);
		}

		const gespeichert = z.decision_text ?? '';
		if (
			bisher !== undefined &&
			veralteteFelder({ text: gespeichert }, { text: bisher }, { text: wortlaut }).length > 0
		) {
			/*
			 * **Der fremde Stand gehört in den Satz** (Code-Review 09.09.2026,
			 * zweiter Durchgang). Der erste Anlauf warf den nackten
			 * `KONFLIKTSATZ`: Die Maske lädt bei einer Absage nicht neu, das
			 * Formular schickte beim zweiten Klick wieder denselben veralteten
			 * Stand mit, und der Konflikt wiederholte sich endlos. Wer den
			 * fremden Text liest und weiss, dass er neu laden soll, kommt heraus.
			 */
			throw new Schreibkonflikt(
				{ text: gespeichert },
				`${KONFLIKTSATZ} Dort steht jetzt: ${gespeichert ? `«${gespeichert}»` : 'nichts'}. ` +
					'Laden Sie die Seite neu und entscheiden Sie, welcher Text gilt.'
			);
		}
		// Nichts geändert, nichts geschrieben — und vor allem kein Verlaufseintrag
		// «null → null», der eine Änderung behauptet, die es nicht gab.
		if (gespeichert === wortlaut) return ausDb(z);

		const [neu] = await tx<Rundenzeile[]>`
			UPDATE voting_round SET decision_text = ${wortlaut || null}
			WHERE id = ${durchgangId}
			RETURNING *
		`;

		const [t] = await tx<{ title: string }[]>`
			SELECT title FROM agenda_item WHERE id = ${z.agenda_item_id}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.beschlusstextErfasst,
				{ art: 'meeting', id: meetingId },
				{
					traktandum: t?.title ?? '',
					durchgang: Number(z.ordinal),
					vorher: z.decision_text,
					nachher: wortlaut || null
				}
			)
		);
		return ausDb(neu);
	});
}

// ── Das Ergebnis ────────────────────────────────────────────────────────────

export interface Durchgangsergebnis {
	durchgang: Durchgangsstand;
	auszaehlung: Auszaehlung | null;
	/** Warum nicht gerechnet werden konnte — etwa weil der Durchgang noch offen ist. */
	grund?: string;
	/**
	 * Das Ergebnis ist festgeschrieben, aber in einem Format, das diese Fassung
	 * nicht lesen kann (seit 25.09.2026). Das kommt nach einer Rücknahme auf
	 * eine ältere Fassung vor, die `docs/installation.md` den Regelfall nennt.
	 * Die Anzeige sagt dann den Grund; wo aus dem Ergebnis etwas folgt, wird
	 * abgewiesen statt «nicht angenommen» anzunehmen (`angenommenIn`).
	 */
	unlesbar?: true;
}

/**
 * Das Ergebnis eines geschlossenen Durchgangs.
 *
 * Trägt er eine Festschreibung (verkündet seit dem 25.09.2026), wird sie
 * gelesen; dann liefert dieselbe Abfrage in einem Jahr dieselbe Zahl, auch
 * wenn seither eine Zählregel geändert wurde. Sonst wird gerechnet (offener
 * Stichentscheid, Altbestand), und zwar auf den **eingefrorenen** Eingaben:
 * Erfordernis von der Freigabe, Stand vom Schliessen. Ein Eigentümerwechsel
 * oder ein geändertes Erfordernis am Traktandum wirkt deshalb auch dort
 * nicht, eine geänderte Zählregel schon.
 */
export async function holeErgebnis(
	operatorId: Id,
	meetingId: Id,
	durchgangId: Id
): Promise<Durchgangsergebnis> {
	return alsBetreiber(operatorId, (tx) => ergebnisIn(tx, meetingId, durchgangId));
}

/**
 * Je Grundantrag die Folgeanträge mit eigenem, angenommenem Beschluss
 * (`folgeantraegeMitEigenemBeschluss`), für den Hinweis beim Rückkommen. Eine
 * Abfrage für Haus und Abend, damit beide dieselben nennen. Ausgezählt werden
 * nur die geltenden Durchgänge von Folgeanträgen; die sind selten.
 */
export async function holeFolgeantragsbeschluesse(
	operatorId: Id,
	meetingId: Id,
	traktanden: {
		knoten: {
			id: Id;
			titel: string;
			parentId: Id | null;
			spontanart?: Spontanart | null;
			rueckkommenZielId?: Id | null;
		};
		nummer: string;
	}[],
	durchgaenge: Durchgangsstand[]
): Promise<Map<Id, { nummer: string; titel: string }[]>> {
	const folgeantraege = new Set(
		traktanden.filter((t) => t.knoten.spontanart === 'folgeantrag').map((t) => t.knoten.id)
	);
	const angenommen = new Set<Id>();
	for (const d of durchgaenge) {
		if (!folgeantraege.has(d.traktandumId) || d.ueberholtAm || d.zustand !== 'geschlossen') continue;
		if ((await holeErgebnis(operatorId, meetingId, d.id)).auszaehlung?.angenommen === true) {
			angenommen.add(d.id);
		}
	}
	const flach = traktanden.map((t) => ({
		id: t.knoten.id,
		nummer: t.nummer,
		titel: t.knoten.titel,
		parentId: t.knoten.parentId,
		spontanart: t.knoten.spontanart ?? null,
		rueckkommenZielId: t.knoten.rueckkommenZielId ?? null
	}));
	const ergebnis = new Map<Id, { nummer: string; titel: string }[]>();
	for (const grund of new Set(traktanden.filter((t) => folgeantraege.has(t.knoten.id)).map((t) => t.knoten.parentId))) {
		if (!grund) continue;
		const gefunden = folgeantraegeMitEigenemBeschluss(grund, flach, durchgaenge, (d) => angenommen.has(d.id));
		if (gefunden.length > 0) ergebnis.set(grund, gefunden);
	}
	return ergebnis;
}

/** Durchgänge, deren Auswertungsfehler schon im Log steht (`holeErgebnisse`). */
const schonGemeldeteDurchgaenge = new Set<string>();

/**
 * Mehrere Ergebnisse in **einer** Transaktion.
 *
 * **Warum es das gibt** (04.09.2026, aus dem Code-Review). Die Eigentümerseite
 * zeigt seit dem 04.09.2026 einen Verlauf der verkündeten Beschlüsse und
 * brauchte dafür je Durchgang ein Ergebnis. Über `holeErgebnis` wäre das je
 * Geschäft eine eigene Transaktion mit voller Auszählung: bei zwanzig
 * Geschäften und hundert Telefonen rund zweitausend Auszählungen im Augenblick
 * des Durchgangswechsels, wo Story 5.6 zwei Sekunden verlangt.
 *
 * **Ein Geschäft, das sich nicht auszählen lässt, reisst die anderen nicht
 * mit.** `zaehleAus` wirft bei einem Grenzfall, bei fehlender Kopfschwelle und
 * wenn eine betroffene Partei nachträglich entfernt wurde. Es steht dann ohne
 * Ergebnis in der Liste, statt die ganze Seite zum Fehler zu machen.
 *
 * bindung: durchgangIds — Die Schleife ruft je Kennung `ergebnisIn(tx,
 *   meetingId, id)`, das über die Versammlung bindet; die Schleifengrösse
 *   verschattet den Parameter.
 */
export async function holeErgebnisse(
	operatorId: Id,
	meetingId: Id,
	durchgangIds: Id[]
): Promise<Map<Id, Durchgangsergebnis>> {
	if (durchgangIds.length === 0) return new Map();
	return alsBetreiber(operatorId, async (tx) => {
		const heraus = new Map<Id, Durchgangsergebnis>();
		for (const id of durchgangIds) {
			try {
				heraus.set(id, await ergebnisIn(tx, meetingId, id));
			} catch (fehler) {
				/*
				 * **Absichtlich still, aber nicht spurlos** (Nachzug-Abnahme,
				 * B4a). Der Aufrufer sieht das fehlende Ergebnis daran, dass die
				 * Kennung nicht in der Karte steht; `/z` und die Eigentümerseite
				 * sollen an einem einzelnen Geschäft nicht scheitern. Beim
				 * Versiegeln hält genau dieses fehlende Ergebnis aber auf, und
				 * die Absage nennt nur Durchgang und Traktandum: Ohne die Zeile
				 * hier stand im Serverlog nichts, und der Betrieb hatte die
				 * Ursache nicht in der Hand. Dieselbe Form wie die übrigen
				 * Logzeilen im Server.
				 *
				 * **Einmal je Durchgang und Prozess** (Codeprüfung Lauf B): `/z`
				 * lädt die Ergebnisse auf jedem Telefon bei jedem Laden; ohne die
				 * Sperre schriebe ein unlesbarer Durchgang den ganzen Abend lang
				 * eine Zeile je Telefon und Aufruf.
				 */
				if (!schonGemeldeteDurchgaenge.has(id)) {
					schonGemeldeteDurchgaenge.add(id);
					const meldung = fehler instanceof Error ? fehler.message : String(fehler);
					console.error(
						`[ergebnis] Durchgang ${id} der Versammlung ${meetingId} liess sich nicht ` +
							`auswerten: ${meldung}`
					);
				}
			}
		}
		return heraus;
	});
}

/**
 * Der Wert für `result_json` beim Verkünden.
 *
 * `null`, wo es nichts auszuzählen gibt (Kenntnisnahme, fehlende
 * Momentaufnahme): Dort liefert `ergebnisIn` einen Grund statt eines
 * Ergebnisses, und der hängt allein am Zustand des Durchgangs.
 */
function festgeschrieben(tx: Tx, auszaehlung: Auszaehlung | null) {
	return auszaehlung ? tx.json(festschreibung(auszaehlung) as never) : null;
}

/** Der jüngste Rückkommensantrag auf ein Traktandum, mit seinem Stand. */
interface Rueckkommenszeile {
	id: string;
	durchgang_id: string | null;
	verbraucht: boolean;
}

/**
 * Der jüngste Rückkommensantrag auf `zielId`, oder `undefined`.
 *
 * **Eine Abfrage für Eröffnen und Aufnehmen.** Das Eröffnen fragt, welches
 * Rückkommen einen Durchgang trägt; das Aufnehmen eines Folgeantrags fragt, ob
 * eines offen ist (`rueckkommenOffenIn`). Rechneten beide je für sich, böte das
 * Aufnehmen einen Folgeantrag an, den das Eröffnen danach abweist.
 */
async function leseRueckkommen(
	tx: Tx,
	meetingId: Id,
	zielId: Id
): Promise<Rueckkommenszeile | undefined> {
	const [r] = await tx<Rueckkommenszeile[]>`
		SELECT a.id,
		       (SELECT v.id FROM voting_round v
		         WHERE v.agenda_item_id = a.id AND v.superseded_at IS NULL
		         ORDER BY v.ordinal DESC LIMIT 1) AS durchgang_id,
		       -- Nicht durch eine Neuabstimmung überholt: dieselbe Regel wie
		       -- «verbrauchtDenRueckkommensantrag» im Kern.
		       EXISTS (
		         SELECT 1 FROM voting_round v
		          WHERE v.reconsideration_item_id = a.id
		            AND v.supersede_kind IS DISTINCT FROM 'korrektur'
		       ) AS verbraucht
		  FROM agenda_item a
		 WHERE a.meeting_id = ${meetingId}
		   AND a.reconsiders_item_id = ${zielId}
		 -- Die Kennung als zweites Merkmal: added_during_meeting_at ist
		 -- now() und damit für zwei rasch gestellte Anträge gleich; eine
		 -- uuidv7 ist selbst zeitsortiert. Dieselbe Ordnung wie in
		 -- stelleRueckkommensantrag — sonst prüfte der eine Weg einen
		 -- anderen Antrag als der andere.
		 ORDER BY a.added_during_meeting_at DESC NULLS LAST, a.id DESC
		 LIMIT 1
	`;
	return r;
}

// **Ob der Rückkommensantrag angenommen ist, steht am Durchgang und wird
// nicht ein zweites Mal abgelegt.** Eine Kopie am Traktandum liefe dem
// Durchgang davon. Seit dem 25.09.2026 ist das verkündete Ergebnis dort
// festgeschrieben (`result_json`); `ergebnisIn` liest es.
async function rueckkommenAngenommen(
	tx: Tx,
	meetingId: Id,
	r: Rueckkommenszeile | undefined
): Promise<boolean> {
	return r?.durchgang_id != null && (await angenommenIn(tx, meetingId, r.durchgang_id));
}

/**
 * Ob auf `zielId` ein angenommenes Rückkommen wartet, das seinen Durchgang noch
 * nicht getragen hat. Für das Aufnehmen eines Folgeantrags
 * (`hindernisAlsGrundantrag`, `rueckkommenOffen`).
 */
export async function rueckkommenOffenIn(tx: Tx, meetingId: Id, zielId: Id): Promise<boolean> {
	const r = await leseRueckkommen(tx, meetingId, zielId);
	// Erst «verbraucht», dann das Ergebnis, wie in `rueckkommenZuEroeffnen`.
	if (!r || r.verbraucht) return false;
	return rueckkommenAngenommen(tx, meetingId, r);
}

/** Die beiden Angaben zum Rückkommen in der Lage einer Auszählung (F4c B2b). */
type Rueckkommenslage = Pick<Auszaehlungslage, 'rueckkommenAufAnnahme' | 'nachRueckkommen'>;

/** Ob ein Durchgang angenommen ist, ohne Wurf bei einem unlesbaren Ergebnis. */
async function angenommenOhneWurf(tx: Tx, meetingId: Id, durchgangId: Id): Promise<boolean> {
	return ergebnislage((await ergebnisIn(tx, meetingId, durchgangId)).auszaehlung) === 'angenommen';
}

/**
 * Die Nummer eines Traktandums, wie die Leitung sie zeigt (`nummeriere`, wie
 * `leseTraktanden` in `traktanden.ts`). Hier eigens gelesen, weil
 * `traktanden.ts` diese Datei einbindet.
 */
async function nummerDesTraktandums(tx: Tx, meetingId: Id, traktandumId: Id): Promise<string | null> {
	const zeilen = await tx<
		{
			id: string;
			parent_id: string | null;
			position: number;
			manual_number: string | null;
			released_number: string | null;
		}[]
	>`
		SELECT id, parent_id, position, manual_number, released_number
		  FROM agenda_item WHERE meeting_id = ${meetingId}
	`;
	const knoten = zeilen.map((z) => ({
		id: z.id,
		parentId: z.parent_id,
		position: z.position,
		nummerManuell: z.manual_number,
		nummerFest: z.released_number
	}));
	return nummeriere(knoten).find((k) => k.knoten.id === traktandumId)?.nummer ?? null;
}

/**
 * `nachRueckkommen` für einen Durchgang, den der Rückkommensantrag `antragId`
 * trägt, oder `undefined`, wenn der Beschluss, auf den zurückgekommen wird,
 * nicht angenommen war. `ausser` ist der Durchgang selbst, sobald es ihn gibt:
 * Der frühere ist der bisher massgebende ohne ihn (`fruehererDerSache`).
 */
async function nachRueckkommenAuf(
	tx: Tx,
	meetingId: Id,
	antragId: Id,
	traktandumId: Id,
	ausser: Id | null
): Promise<Auszaehlungslage['nachRueckkommen']> {
	const frueherId = await fruehererDerSache(tx, antragId, traktandumId, ausser);
	if (!frueherId) return undefined;
	const frueher = await ergebnisIn(tx, meetingId, frueherId);
	if (ergebnislage(frueher.auszaehlung) !== 'angenommen') return undefined;
	const nummer = await nummerDesTraktandums(tx, meetingId, antragId);
	if (!nummer) return undefined;
	// Der geltende Durchgang des Antrags: Nach einer Neuabstimmung am Antrag ist
	// es der jüngste nicht überholte, wie in `leseRueckkommen`.
	const [rk] = await tx<{ id: string }[]>`
		SELECT id FROM voting_round
		 WHERE agenda_item_id = ${antragId} AND meeting_id = ${meetingId} AND superseded_at IS NULL
		 ORDER BY ordinal DESC LIMIT 1
	`;
	const rueckkommen = rk ? (await ergebnisIn(tx, meetingId, rk.id)).auszaehlung : null;
	const beschlussMitAllen = frueher.auszaehlung ? mitAllenJa(frueher.auszaehlung) : undefined;
	const rueckkommenMitAllen = rueckkommen ? mitAllenJa(rueckkommen) : undefined;
	return {
		traktandum: nummer,
		geltenderDurchgang: frueher.durchgang.nummer,
		...(beschlussMitAllen === undefined ? {} : { beschlussMitAllen }),
		...(rueckkommenMitAllen === undefined ? {} : { rueckkommenMitAllen })
	};
}

/**
 * Was die Auszählung zum Rückkommen wissen muss (F4c B2b): ob das Traktandum
 * der Rückkommensantrag auf einen angenommenen Beschluss ist
 * (`rueckkommenAufAnnahme`), und ob sein Durchgang einem angenommenen Rückkommen
 * auf einen angenommenen Beschluss folgt (`nachRueckkommen`). Eine Stelle für
 * die Karte vor dem Eröffnen (`holeMehrheitsvorschau`) und die Rechnung beim
 * Schliessen (`ergebnisIn`), damit alle Aufrufer beider mitkommen.
 *
 * **Mit Durchgang: am Durchgang gelesen, nicht am Stand des Antrags.** Der
 * Durchgang nach dem Rückkommen trägt den Antrag in `reconsideration_item_id`,
 * und genau das verbraucht ihn (`verbrauchtDenRueckkommensantrag`): Beim
 * Schliessen gilt er schon als verbraucht, und `leseRueckkommen` fände ihn
 * nicht mehr als wartend. Der frühere Beschluss ist der bisher massgebende
 * ohne diesen Durchgang; ersetzt wird er erst nach der Auszählung
 * (`schliesseInTransaktion`). `rueckkommenAufAnnahme` bleibt dort weg:
 * `zaehleAus` liest es nicht, nur die Karte, und am festgeschriebenen
 * Ergebnis gälte der Beschluss danach nicht mehr als massgebend.
 *
 * **Ohne Durchgang: wie das Eröffnen** (`rueckkommenZuEroeffnen`): am
 * Folgeantrag, dessen Grundantrag entschieden ist, das Rückkommen auf den
 * Grundantrag, sonst das auf das Traktandum selbst; angenommen und noch nicht
 * verbraucht. Läuft schon ein Durchgang, gilt dessen Antrag.
 */
async function leseRueckkommenslage(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	durchgang: Pick<Rundenzeile, 'id' | 'reconsideration_item_id'> | null
): Promise<Rueckkommenslage> {
	if (durchgang) {
		if (!durchgang.reconsideration_item_id) return {};
		const n = await nachRueckkommenAuf(
			tx,
			meetingId,
			durchgang.reconsideration_item_id,
			traktandumId,
			durchgang.id
		);
		return n ? { nachRueckkommen: n } : {};
	}

	const [t] = await tx<
		{ spontaneous_kind: string | null; parent_id: string | null; reconsiders_item_id: string | null }[]
	>`
		SELECT spontaneous_kind, parent_id, reconsiders_item_id
		  FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
	`;
	if (!t) return {};
	const lage: Rueckkommenslage = {};

	if (t.spontaneous_kind === 'rueckkommen' && t.reconsiders_item_id) {
		// Derselbe Weg wie beim Anlegen (`stelleRueckkommensantrag`): der
		// massgebende Durchgang des Ziels, angenommen oder nicht.
		const [m] = await tx<{ id: string | null }[]>`
			SELECT massgebender_durchgang(${t.reconsiders_item_id}) AS id
		`;
		lage.rueckkommenAufAnnahme = m?.id ? await angenommenOhneWurf(tx, meetingId, m.id) : false;
	}

	const [offen] = await tx<Pick<Rundenzeile, 'id' | 'reconsideration_item_id'>[]>`
		SELECT id, reconsideration_item_id FROM voting_round
		 WHERE agenda_item_id = ${traktandumId} AND meeting_id = ${meetingId} AND state = 'offen'
	`;
	let antragId: Id | null = null;
	if (offen) {
		antragId = offen.reconsideration_item_id;
	} else {
		let r: Rueckkommenszeile | undefined;
		let amGrundantrag = false;
		if (t.spontaneous_kind === 'folgeantrag' && t.parent_id) {
			const sache = await leseMassgebendenDerSache(tx, t.parent_id);
			if (sache && !sache.weggang) {
				amGrundantrag = true;
				r = await leseRueckkommen(tx, meetingId, t.parent_id);
			}
		}
		if (!amGrundantrag) r = await leseRueckkommen(tx, meetingId, traktandumId);
		if (r && !r.verbraucht && r.durchgang_id && (await angenommenOhneWurf(tx, meetingId, r.durchgang_id))) {
			antragId = r.id;
		}
	}
	if (antragId) {
		const n = await nachRueckkommenAuf(tx, meetingId, antragId, traktandumId, offen?.id ?? null);
		if (n) lage.nachRueckkommen = n;
	}
	return lage;
}

/**
 * Ob ein Durchgang die Ja-Stimmen aller Eigentümer hatte (`mitAllenJa`), für
 * das Anlegen des Rückkommens in `traktanden.ts`. `undefined`, wo es sich nicht
 * sagen lässt, auch ohne lesbare Auszählung.
 */
export async function durchgangMitAllenJaInTx(
	tx: Tx,
	meetingId: Id,
	durchgangId: Id
): Promise<boolean | undefined> {
	const a = (await ergebnisIn(tx, meetingId, durchgangId)).auszaehlung;
	return a ? mitAllenJa(a) : undefined;
}

/**
 * Ob zum Geschäft weder ein Beschluss gilt noch ein Rückkommen den nächsten
 * Durchgang trägt, für die Leitungsseite: Sie bietet «konsultativ» nur an, wo
 * der Server es annimmt (Migration 158). Dieselben zwei Fragen wie
 * `oeffneAbstimmung` vor `verlangeKonsultativZulaessig`; die
 * Beschlussfähigkeit fragt die Seite selbst.
 *
 * **Mit dem Rückkommen** (Codeprüfung 14.10.2026, Befund 5): Unter einem
 * angenommenen Rückkommen, wo zum eigenen Traktandum kein Beschluss gilt
 * (Folgeantrag mit entschiedenem Grundantrag, oder nach einer Überholung),
 * stand das Häkchen da, und der Server wies mit `konsultativ_rueckkommen` ab.
 * Wirft die Rückkommensprüfung selbst, gibt es das Häkchen ebenso wenig; die
 * übrigen Prüfungen des Eröffnens (Weisungen, Mehr der Einladung) blenden es
 * nicht aus, sie lassen sich im Saal beheben und nennen ihren Grund.
 *
 * bindung: traktandumId — `beschlussGiltIn` sucht den massgebenden Durchgang
 *   mit `meeting_id = ${meetingId}`, das Traktandum wird mit derselben
 *   Bedingung gelesen; ein fremdes findet keinen und gibt `false`.
 */
export async function holeKonsultativMoeglich(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<boolean> {
	return alsBetreiber(operatorId, async (tx) => {
		const [t] = await tx<Eroeffnungstraktandum[]>`
			SELECT id, title, spontaneous_kind, parent_id
			  FROM agenda_item WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		`;
		if (!t) return false;
		if (await beschlussGiltIn(tx, meetingId, traktandumId)) return false;
		try {
			return (await rueckkommenFuerEroeffnung(tx, meetingId, traktandumId, t)) === null;
		} catch (fehler) {
			// Nur lesend gefragt; ein fachlicher Wurf heisst «Eröffnen weist ab».
			if (fehler instanceof FachlicherFehler) return false;
			throw fehler;
		}
	});
}

/**
 * `rueckkommenOffenIn` ausserhalb einer Transaktion, für die Seite, die das
 * Erfordernis anbietet (H6): Sie zeigt das Formular nur, wenn der Server es
 * annehmen wird (`erfordernisAenderbar`).
 */
export async function holeRueckkommenOffen(
	operatorId: Id,
	meetingId: Id,
	zielId: Id
): Promise<boolean> {
	return alsBetreiber(operatorId, (tx) => rueckkommenOffenIn(tx, meetingId, zielId));
}

/**
 * Der massgebende Durchgang der Sache `traktandumId`, mit dem, was die
 * Sperren daran lesen (Migration 133, `massgebender_durchgang`). Nach einer
 * Ersetzung über einen Folgeantrag liegt er auf einem anderen Traktandum.
 * `weggang` heisst: ohne Beschluss und neu zu eröffnen, nach einem Weggang
 * oder einer konsultativen Abstimmung (Migration 158).
 */
async function leseMassgebendenDerSache(
	tx: Tx,
	traktandumId: Id
): Promise<{ id: string; agenda_item_id: string; state: string; weggang: boolean } | undefined> {
	const [m] = await tx<{ id: string; agenda_item_id: string; state: string; weggang: boolean }[]>`
		SELECT id, agenda_item_id, state,
		       (coalesce(universal_json->'keinBeschluss'->>'grund', '') = 'weggang' OR consultative)
		         AS weggang
		  FROM voting_round
		 WHERE id = massgebender_durchgang(${traktandumId})
	`;
	return m;
}

/**
 * Ob dieser Durchgang von Hand festgehalten wurde, ohne dass die Versammlung
 * beschlussfähig war.
 *
 * **Gerechnet, nicht gespeichert.** Quelle sind der eingefrorene
 * Anwesenheitsstand des Durchgangs (`attendance_json.anwesende`) und die
 * geltende Anwesenheitsregel, mit `stelleBeschlussfaehigkeitFest` und
 * `beteiligungDerAnwesenden` — dieselbe Rechnung wie
 * `beschlussfaehigkeitFehlteAmBeschluss` im Protokoll und wie die Prüfung
 * beim Eröffnen. Die Regel wird heute gelesen, wie bei der Feststellung im
 * Protokoll; sie wechselt nur durch einen Eingriff, der die Seite neu lädt.
 *
 * Ohne lesbares Ergebnis, ohne Anwesenheitsstand oder ohne Momentaufnahme
 * gibt es kein «direkt»: Dann bleibt es beim gewohnten Weg.
 */
async function istVonHandOhneQuorum(
	tx: Tx,
	meetingId: Id,
	durchgang: Rundenzeile
): Promise<boolean> {
	// zustand-nur-geschlossen: Zustand des Durchgangs, nicht der Versammlung.
	if (durchgang.state !== 'geschlossen' || !durchgang.result_json) return false;
	const auszaehlung = ausFestschreibung(durchgang.result_json);
	if (!auszaehlung || auszaehlung.vonHand === undefined) return false;
	const anwesende = durchgang.attendance_json?.anwesende;
	if (!anwesende) return false;
	const [m] = await tx<{ stweg_id: string; tier: Versammlungsstufe }[]>`
		SELECT stweg_id, tier FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) return false;
	const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
	if (!momentaufnahme) return false;
	const regeln = await leseAnwesenheitsregeln(tx, m.stweg_id);
	const befund = stelleBeschlussfaehigkeitFest(
		m.tier,
		beteiligungDerAnwesenden(stimmkraftliste(momentaufnahme), anwesende),
		regeln[m.tier] ?? null
	);
	return !befund.beschlussfaehig;
}

/**
 * Ob die Versammlung an diesem Abend schon beschlussfähig war (C3, F4c): die
 * Regel bei `warZeitweiseBeschlussfaehig`, hier die Spur aus der Datenbank.
 * Gelesen vor dem Schliessen: `schliesseVersammlung` räumt offene Durchgänge
 * auf, und ein offener Durchgang hat die Prüfung beim Eröffnen bestanden.
 * Abgebrochene und ersetzte Durchgänge zählen mit, aus demselben Grund.
 *
 * bindung: meetingId — nur in `WHERE meeting_id`; unter dem Zeilenschutz
 * liefert eine fremde Versammlung keine Zeile und damit `false`.
 */
export async function warZeitweiseBeschlussfaehigIn(tx: Tx, meetingId: Id): Promise<boolean> {
	// Früh abbrechen (Codeprüfung F4c Block 2, N7): `istVonHandOhneQuorum`
	// kostet je Durchgang mehrere Abfragen. Eine festgehaltene
	// Beschlussfähigkeit genügt schon; der Teil der Regel zu den Feststellungen
	// steht deshalb hier in SQL (`is_quorate`), der zu den Durchgängen in
	// `warZeitweiseBeschlussfaehig`. Ändert sich die Regel, beide Stellen.
	const [festgestellt] = await tx<{ ja: boolean }[]>`
		SELECT EXISTS (SELECT 1 FROM quorum_finding WHERE meeting_id = ${meetingId} AND is_quorate) AS ja
	`;
	if (festgestellt?.ja) return true;
	const zeilen = await tx<Rundenzeile[]>`
		SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND NOT consultative
	`;
	for (const z of zeilen) {
		const spur = {
			feststellungen: [],
			durchgaenge: [{ konsultativ: false, vonHandOhneQuorum: await istVonHandOhneQuorum(tx, meetingId, z) }]
		};
		if (warZeitweiseBeschlussfaehig(spur)) return true;
	}
	return false;
}

/** Dasselbe in eigener Transaktion, für die Seiten der Leitung und der Anwesenheit. */
export async function warVersammlungZeitweiseBeschlussfaehig(operatorId: Id, meetingId: Id): Promise<boolean> {
	return alsBetreiber(operatorId, (tx) => warZeitweiseBeschlussfaehigIn(tx, meetingId));
}

/**
 * Die Lage, in der die direkte Neuabstimmung nach Eintritt der
 * Beschlussfähigkeit offensteht: Die Gemeinschaft steht auf «direkt», und der
 * geltende Durchgang wurde von Hand ohne Beschlussfähigkeit festgehalten.
 * Sonst null.
 *
 * bindung: traktandumId — `massgebender_durchgang` wird mit `meeting_id`
 *   verglichen; ein fremdes Traktandum findet keinen Durchgang dieser
 *   Versammlung.
 */
async function direktNachQuorumLage(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id
): Promise<{ durchgangId: Id; nummer: number } | null> {
	const [m] = await tx<{ stweg_id: string }[]>`
		SELECT stweg_id FROM meeting WHERE id = ${meetingId}
	`;
	if (!m) return null;
	const [einstellung] = await tx<{ revote_after_quorum: string }[]>`
		SELECT revote_after_quorum FROM stweg WHERE id = ${m.stweg_id}
	`;
	if (einstellung?.revote_after_quorum !== 'direkt') return null;
	const [z] = await tx<Rundenzeile[]>`
		SELECT * FROM voting_round
		 WHERE id = massgebender_durchgang(${traktandumId})
		   AND meeting_id = ${meetingId}
	`;
	if (!z || !(await istVonHandOhneQuorum(tx, meetingId, z))) return null;
	return { durchgangId: z.id, nummer: Number(z.ordinal) };
}

/**
 * Dieselbe Lage für die Leitungsseite: die Nummer des von Hand festgehaltenen
 * Durchgangs, wenn der direkte Weg offensteht; sonst null.
 *
 * Eine Funktion für Tor und Anzeige, damit der Server nicht etwas anderes
 * abweist, als die Seite anbietet.
 *
 * bindung: traktandumId — `direktNachQuorumLage` liest den Durchgang über
 *   `massgebender_durchgang(traktandumId)` und vergleicht ihn mit
 *   `meeting_id = meetingId`; ein fremdes Traktandum findet keinen Durchgang
 *   dieser Versammlung.
 */
export async function holeDirektNachQuorumLage(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<{ nummer: number } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const lage = await direktNachQuorumLage(tx, meetingId, traktandumId);
		return lage ? { nummer: lage.nummer } : null;
	});
}

/**
 * Ob zu diesem Geschäft ein Durchgang eröffnet werden darf, und über welchen
 * Rückkommensantrag, wenn es nicht der erste ist. Weist sonst mit der Absage
 * aus `verlangeNeuenDurchgangZulaessig` ab.
 *
 * **Eigene Funktion, weil zwei Wege dieselbe Frage stellen** (Fachprüfung
 * Block 4a, Stelle 6): das Eröffnen und der Widerspruch vor dem Eröffnen
 * (`haltWiderspruchFest`). Nach einem angenommenen Rückkommen hat der
 * Widerspruch seinen Ort; rechneten beide Wege je für sich, böte die Seite ein
 * Formular an, das der Server abweist.
 *
 * **`grundantrag` bei einem Folgeantrag** (Produktentscheid 30.09.2026). Ist
 * der Grundantrag schon entschieden, trägt nur ein angenommenes, unverbrauchtes
 * Rückkommen auf ihn den Durchgang über den Folgeantrag, und dieser Durchgang
 * verbraucht es (`verlangeFolgeantragNachRueckkommen`). Bis dahin liess sich
 * ein Folgeantrag nach dem Grundantrag ohne Rückkommen abstimmen (Plan, Ist 3).
 */
export async function rueckkommenZuEroeffnen(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	titel: string,
	grundantrag: { id: Id; titel: string } | null = null
): Promise<string | null> {
	if (grundantrag) {
		const sache = await leseMassgebendenDerSache(tx, grundantrag.id);
		// Wie `bestehend` unten: Ein Durchgang ohne Beschluss nach einem Weggang
		// entscheidet nichts (Migration 128).
		if (sache && !sache.weggang) {
			const r = await leseRueckkommen(tx, meetingId, grundantrag.id);
			/*
			 * Ein eigener geltender Durchgang des Folgeantrags, der nicht der
			 * massgebende der Sache ist: abgestimmt vor dem Grundantrag. Ist er
			 * es, hat der Folgeantrag den Grundantrag schon einmal ersetzt, und
			 * das neue Rückkommen trägt einen Durchgang über ihn wie über den
			 * alten Antrag.
			 */
			const [eigen] = await tx<{ anzahl: number }[]>`
				SELECT count(*)::int AS anzahl FROM voting_round
				 WHERE agenda_item_id = ${traktandumId} AND superseded_at IS NULL
				   AND id <> ${sache.id}
			`;
			verlangeFolgeantragNachRueckkommen(
				r
					? { angenommen: await rueckkommenAngenommen(tx, meetingId, r), verbraucht: r.verbraucht }
					: null,
				grundantrag.titel,
				Number(eigen?.anzahl ?? 0) > 0
			);
			return r!.id;
		}
	}

	/*
	 * **Ein zweiter Durchgang braucht einen Grund** (FR-44).
	 *
	 * Bisher liess sich zu einem behandelten Traktandum einfach nochmals
	 * abstimmen — geprüft wurde nur, ob gerade eine andere Abstimmung offen
	 * ist. Damit hätte die Sitzungsleitung ein unliebsames Ergebnis so oft
	 * wiederholen lassen können, bis es passt.
	 *
	 * Zulässig ist der zweite Durchgang jetzt auf zwei Wegen: Der frühere
	 * wurde als fehlerhaft **überholt** (dann steht dort `superseded_at`), oder
	 * die Versammlung hat das **Rückkommen beschlossen**. Über das eine
	 * entscheidet die Leitung, über das andere die Versammlung — und genau
	 * diese Grenze soll die Anwendung ziehen.
	 */
	/*
	 * **Ausser nach einem Weggang ohne Stimme** (Migration 128). Dann kam
	 * kein Beschluss zustande, und sind wieder alle da, darf neu eröffnet
	 * werden (Fachprüfung Block 3, Frage 3). Ein Ergebnis wird damit nicht
	 * wiederholt, bis es passt: Es gab keines, und die Universalversammlung
	 * wird beim Eröffnen neu geprüft und neu bestätigt. Nach einem
	 * Widerspruch zählt der Durchgang weiter; dort sperrt zudem
	 * `fruehererWiderspruch`. Ebenso nach einer konsultativen Abstimmung
	 * (Migration 158): Sie hat nichts entschieden, und verbindlich wird erst
	 * mit Beschlussfähigkeit abgestimmt, die das Eröffnen wieder verlangt.
	 *
	 * **Und der über einen Folgeantrag ersetzte Beschluss zählt mit** (Plan
	 * Folgeantrag nach Rückkommen, Ist 4; Migration 133). Das Traktandum hat
	 * dann keinen eigenen geltenden Durchgang mehr, ist aber entschieden; ohne
	 * diese Zeile liesse es sich wie zum ersten Mal abstimmen.
	 */
	const [bestehend] = await tx<{ anzahl: number }[]>`
		SELECT (SELECT count(*)::int FROM voting_round
		         WHERE agenda_item_id = ${traktandumId} AND superseded_at IS NULL
		           AND coalesce(universal_json->'keinBeschluss'->>'grund', '') <> 'weggang'
		           AND NOT consultative)
		     + durch_anderes_traktandum_ersetzt(${traktandumId})::int AS anzahl
	`;

	/*
	 * **Den Rückkommensantrag auch dann suchen, wenn gerade kein Durchgang gilt**
	 * (Codeprüfung zu Punkt 9, Befund 1). Hat die Leitung nach einem
	 * angenommenen Rückkommen den geltenden Durchgang als fehlerhaft überholt,
	 * gilt keiner, und der nächste lief bisher ohne Verweis. Der angenommene,
	 * unverbrauchte Antrag blieb dann liegen und trug später einen Durchgang
	 * über einen Beschluss, auf den er sich nie bezog; Protokoll und
	 * Stimmnachweis meldeten ein Rückkommen, das niemand beschlossen hatte.
	 * Jetzt hängt er am nächsten Durchgang seines Ziels.
	 */
	const r = await leseRueckkommen(tx, meetingId, traktandumId);

	if (Number(bestehend?.anzahl ?? 0) > 0) {
		/*
		 * **Ist ein Rückkommensantrag gestellt, entscheidet er.** Ein
		 * angenommener trägt den Durchgang; ein nicht angenommener oder
		 * verbrauchter weist ab. Über ein abgelehntes Rückkommen geht die
		 * Anwendung nicht still hinweg, auch wenn der direkte Weg offenstünde.
		 */
		if (r) {
			verlangeNeuenDurchgangZulaessig(
				{ angenommen: await rueckkommenAngenommen(tx, meetingId, r), verbraucht: r.verbraucht },
				titel
			);
			return r.id;
		}
		/*
		 * **Direkt nach Eintritt der Beschlussfähigkeit** (Produktentscheid
		 * 03.10.2026, `domain/neuabstimmung.ts`): Der geltende Durchgang wurde
		 * von Hand ohne Beschlussfähigkeit festgehalten, und die Gemeinschaft
		 * steht auf «direkt». Dann braucht der zweite Durchgang kein
		 * Rückkommen; er läuft über den gewohnten Weg der Abstimmung.
		 */
		if (await direktNachQuorumLage(tx, meetingId, traktandumId)) return null;
		verlangeNeuenDurchgangZulaessig(null, titel);
	}
	// Erst «verbraucht», dann das Ergebnis: Eine unlesbare Festschreibung
	// sperrt sonst auch dort, wo die Antwort ohnehin null ist (Codeprüfung,
	// zweiter Durchgang, N-4).
	if (!r || r.verbraucht) return null;
	return (await rueckkommenAngenommen(tx, meetingId, r)) ? r.id : null;
}

/**
 * Ob ein Durchgang angenommen wurde, für Stellen, an denen daraus etwas folgt.
 *
 * **Wirft bei einem unlesbaren Ergebnis**, statt «nicht angenommen» zu sagen.
 * Beim Rückkommen entschiede das sonst still, ob ein Beschluss ersetzt wird.
 */
/**
 * Ob zu diesem Geschäft am massgebenden Durchgang ein Beschluss gilt
 * (`beschlussGilt`), innerhalb einer Transaktion. Massgebend ist der jüngste
 * nicht überholte Durchgang, wie `massgebender` im Kern; nach einer Ersetzung
 * über einen Folgeantrag dessen Durchgang (Migration 133).
 *
 * bindung: traktandumId — Der gefundene Durchgang muss `meeting_id = ${meetingId}`
 *   tragen. Eine fremde Kennung liefert Durchgänge einer anderen Versammlung, und
 *   die Kette über `superseded_by_round_id` verlässt sie nicht: Der Verweis
 *   entsteht beim Schliessen zwischen zwei Durchgängen derselben Versammlung.
 */
export async function beschlussGiltIn(tx: Tx, meetingId: Id, traktandumId: Id): Promise<boolean> {
	const [m] = await tx<{ id: string; state: string }[]>`
		SELECT id, state FROM voting_round
		 WHERE id = massgebender_durchgang(${traktandumId}) AND meeting_id = ${meetingId}
	`;
	// zustand-nur-geschlossen: Zustand des Durchgangs (offen oder geschlossen),
	// nicht der Versammlung; «versiegelt» gibt es an `voting_round` nicht.
	if (!m || m.state !== 'geschlossen') return false;
	return beschlussGilt((await ergebnisIn(tx, meetingId, m.id)).auszaehlung);
}

async function angenommenIn(tx: Tx, meetingId: Id, durchgangId: Id): Promise<boolean> {
	const e = await ergebnisIn(tx, meetingId, durchgangId);
	if (e.unlesbar) {
		throw new FachlicherFehler('festschreibung_unlesbar', e.grund ?? '', 'durchgang');
	}
	return e.auszaehlung?.angenommen === true;
}

/**
 * `holeErgebnis` innerhalb einer laufenden Transaktion.
 *
 * Gebraucht, wo vor einer Änderung geprüft werden muss, was gerade herauskäme —
 * etwa beim Verkünden, das einen offenen Stichentscheid nicht überspringen darf.
 * Eine zweite Verbindung dafür zu öffnen hiesse, zwischen Prüfung und Änderung
 * eine Lücke zu lassen.
 */
async function ergebnisIn(
	tx: Tx,
	meetingId: Id,
	durchgangId: Id
): Promise<Durchgangsergebnis> {
	{
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE id = ${durchgangId} AND meeting_id = ${meetingId}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Durchgang nicht gefunden.', 'durchgang');
		const durchgang = ausDb(z);

		/*
		 * **Ein verkündetes Ergebnis wird gelesen, nicht gerechnet** (Produktentscheid
		 * 25.09.2026: «nach jeder Abstimmung [soll] das bereits abgestimmte nicht
		 * mehr verändert werden können»). Bis dahin zählte diese Funktion bei jedem
		 * Lesen neu aus, mit dem Code von heute, und jede Änderung an einer
		 * Zählregel wirkte rückwirkend auf Ergebnis und Protokoll.
		 *
		 * Gerechnet wird weiter, solange nicht verkündet ist (offener
		 * Stichentscheid; die Prüfung des Gleichstands braucht die Rechnung) und
		 * bei Durchgängen, die vor dem 25.09.2026 verkündet wurden.
		 */
		if (z.result_json != null) {
			const gelesen = ausFestschreibung(z.result_json);
			return gelesen
				? { durchgang, auszaehlung: gelesen }
				: {
						durchgang,
						auszaehlung: null,
						unlesbar: true,
						grund:
							'Das Ergebnis dieses Durchgangs ist festgeschrieben, aber in einem Format, das ' +
							'diese Fassung der Anwendung nicht lesen kann. Es stammt von einer neueren ' +
							'Fassung; neu gerechnet wird es nicht.'
					};
		}

		if (durchgang.zustand !== 'geschlossen') {
			return {
				durchgang,
				auszaehlung: null,
				grund: 'Die Abstimmung läuft noch. Ausgezählt wird erst nach dem Schliessen.'
			};
		}
		/*
		 * **Ohne Auszählung beendet heisst: nie ausgezählt** (Codeprüfung
		 * 01.10.2026, Befund 1). Einen offenen Durchgang schliesst der Beschluss
		 * von Hand, ohne zu zählen, und überholt ihn als `notweg`
		 * (`haltBeschlussVonHandFest`). Rechnete diese Funktion ihn später doch,
		 * würfe sie genau dort, wo sein Schliessen geworfen hätte, oder gäbe ein
		 * Ergebnis aus Teilstimmen aus, das nie verkündet wurde.
		 *
		 * **Erkannt daran, dass er im selben Augenblick geschlossen und überholt
		 * wurde** (`now()` ist in der Transaktion derselbe Wert). «Nicht
		 * verkündet» allein träfe auch einen Durchgang mit offenem Stichentscheid,
		 * der gewöhnlich geschlossen und gezählt wurde und den der Beschluss von
		 * Hand danach überholt; der bleibt rechenbar (Codeprüfung 01.10.2026, N2).
		 * Ein geltender, verkündeter Durchgang wird ohnehin oben gelesen.
		 */
		if (
			z.supersede_kind === 'notweg' &&
			z.result_published_at === null &&
			z.closed_at !== null &&
			z.superseded_at !== null &&
			z.closed_at.getTime() === z.superseded_at.getTime()
		) {
			return {
				durchgang,
				auszaehlung: null,
				grund: 'Diese Abstimmung wurde ohne Auszählung beendet; ein Ergebnis gibt es dazu nicht.'
			};
		}
		// Dasselbe für den Abbruch (H6, `brecheAbstimmungAb`): gerechnet gäbe er
		// ein Ergebnis aus Teilstimmen aus, das nie verkündet wurde.
		if (abgebrochen(durchgang)) {
			return {
				durchgang,
				auszaehlung: null,
				grund: 'Diese Abstimmung wurde ohne Ergebnis abgebrochen.'
			};
		}
		if (!durchgang.erfordernis || !durchgang.anwesende) {
			return {
				durchgang,
				auszaehlung: null,
				grund: 'Diesem Durchgang fehlen die eingefrorenen Angaben; er lässt sich nicht auszählen.'
			};
		}

		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		if (!momentaufnahme) {
			return { durchgang, auszaehlung: null, grund: 'Es steht noch nicht fest, wer stimmberechtigt ist.' };
		}

		/*
		 * **Eine Kenntnisnahme hat kein Ergebnis** — und das ist kein Fehler.
		 *
		 * `zaehleAus` wirft hier zu Recht: Es gibt nichts auszuzählen. Nur wurde der
		 * Wurf nicht abgefangen, und die **Sitzungsleitung** bekam beim Laden ihrer
		 * Seite einen 500er — mitten im Saal, nachdem ein zur Kenntnis genommenes
		 * Traktandum geschlossen wurde. Gefunden am 12.08.2026 im Durchspiel-Lauf.
		 *
		 * Denselben Weg wie die drei Fälle darüber: kein Ergebnis, aber ein Grund.
		 * Eine Schranke ist keine Fehlermeldung (docs/gestaltung.md).
		 */
		if (durchgang.erfordernis.typ === 'keine_abstimmung') {
			return {
				durchgang,
				auszaehlung: null,
				grund: 'Dieses Traktandum wird zur Kenntnis genommen; es gibt nichts auszuzählen.'
			};
		}

		// Die Betroffenen, wie beim Schliessen festgeschrieben (seit Migration
		// 124). Nur bei Durchgängen von vorher, die den Stand nicht tragen, wird
		// gelesen, wer jetzt eingetragen ist, ohne Vorab-Vermerke und ohne
		// Veto-Entscheide.
		const betroffene: BetroffeneImDurchgang[] =
			durchgang.betroffene ??
			(
				await tx<{ party_id: string }[]>`
					SELECT party_id FROM agenda_item_affected WHERE agenda_item_id = ${z.agenda_item_id}
				`
			).map((b) => ({ parteiId: b.party_id, vorab: null, veto: null }));

		// Wer bei diesem Traktandum in den Ausstand getreten ist (ZGB Art. 68
		// i.V.m. Art. 712m Abs. 2). Er fällt aus der Bezugsgrösse, nicht bloss
		// aus den Stimmen — die Rechnung dazu steht im Kern.
		//
		// **Der beim Schliessen festgeschriebene Stand**, nicht der jetzige
		// (seit 25.09.2026). Nur bei Durchgängen von vorher, die ihn nicht
		// tragen, wird gelesen, wie er jetzt ist.
		const ausstand =
			durchgang.ausstand !== null
				? durchgang.ausstand.map((party_id) => ({ party_id }))
				: (await leseAusstandskennungen(tx, meetingId, z.agenda_item_id)).map((party_id) => ({
						party_id
					}));

		const gemeinsameLage = {
			momentaufnahme,
			erfordernis: durchgang.erfordernis,
			anwesende: durchgang.anwesende,
			vertretungen: durchgang.vertretungen,
			betroffeneParteiIds: betroffene.map((b) => b.parteiId),
			vorabZustimmungen: betroffene.filter((b) => b.vorab !== null).map((b) => b.parteiId),
			// Die Angabe zur Ausschlussklage, wie beim Schliessen festgeschrieben
			// (Migration 132). Durchgänge von vorher tragen sie nicht; dort gilt
			// «nur eine Person», auch im Lesezweig ohne `affected_json`.
			alleEigentuemerBeklagt: betroffene.filter((b) => b.alleBeklagt).map((b) => b.parteiId),
			// Die Veto-Entscheide, wie beim Schliessen festgeschrieben
			// (`affected_json`, Migration 125). Durchgänge von vorher tragen sie
			// nicht; dort bleibt die Liste leer.
			vetoEntscheide: betroffene.flatMap((b) =>
				b.veto
					? [
							{
								parteiId: b.parteiId,
								entscheid: b.veto.entscheid,
								weg: b.veto.weg,
								durchVertretung: b.veto.durchVertretung
							}
						]
					: []
			),
			imAusstand: ausstand.map((a) => a.party_id),
			// L8 (Migration 184): Das Merkmal zum eingefrorenen Ausstand, aus
			// derselben Zeile wie `imAusstand`. Unter «Vollmachten ruhen» steht
			// der Ausstand aus L8 in beiden, unter «Die Sitzungsleitung
			// entscheidet» nur hier; das zweite Ergebnis rechnet mit ihm.
			ausstandAusVerwaltung: durchgang.ausstandVerwaltung ?? undefined,
			// Geheim ist eine Ausgaberegel; gerechnet wird gleich (Migration 141).
			geheim: durchgang.geheim,
			stichentscheid: durchgang.stichentscheid ?? undefined,
			// Nach einem Rückkommen auf einen angenommenen Beschluss (F4c B2b), am
			// Durchgang gelesen: Gerechnet wird hier beim Schliessen, danach nur
			// noch gelesen (`leseRueckkommenslage`).
			...(await leseRueckkommenslage(tx, meetingId, z.agenda_item_id, z))
		};

		/*
		 * **Von Hand gezählt oder einzeln erfasst — zwei Rechnungen, eine Wahl.**
		 *
		 * Die beiden schliessen sich beim Erfassen gegenseitig aus
		 * (`erfasseSummen`, `gibStimmenAb`), deshalb genügt hier die Frage, ob
		 * eine Handzählung vorliegt. `zaehleSummenAus` rechnet bewusst weniger:
		 * keine Wertquoten, keine Liste der fehlenden Zustimmungen — und sagt das
		 * in seinen Hinweisen, damit die leeren Felder nicht als «null» gelesen
		 * werden.
		 */
		return {
			durchgang,
			auszaehlung: durchgang.handzaehlung
				? zaehleSummenAus(gemeinsameLage, {
						ja: durchgang.handzaehlung.ja,
						nein: durchgang.handzaehlung.nein,
						enthaltung: durchgang.handzaehlung.enthaltung,
						...(durchgang.handzaehlung.andereJa !== null
							? {
									andereJa: durchgang.handzaehlung.andereJa,
									andereNein: durchgang.handzaehlung.andereNein ?? undefined,
									andereEnthaltung: durchgang.handzaehlung.andereEnthaltung ?? undefined
								}
							: {}),
						vermerk: durchgang.handzaehlung.vermerk
					})
				: zaehleAus({ ...gemeinsameLage, stimmen: await leseStimmen(tx, durchgangId) })
		};
	}
}

/**
 * Momentaufnahme innerhalb einer laufenden Transaktion. Exportiert für die
 * Probe, dass beide Leser denselben Kopf liefern (`tests/db/lesarten.test.ts`).
 */
export async function holeMomentaufnahmeIn(tx: Tx, meetingId: Id): Promise<Snapshot | null> {
	// Der Kopf über denselben Weg wie `holeMomentaufnahme`: Bis Migration 169
	// liess dieser Leser die eingefrorenen Ausnahmen weg; gelesen hat sie hier
	// noch niemand, die Lücke wäre beim ersten Leser aufgegangen.
	const [k] = await tx<Momentaufnahmezeile[]>`SELECT * FROM snapshot WHERE meeting_id = ${meetingId}`;
	if (!k) return null;

	const parteien = await tx<
		{ id: string; party_id: string; display_name: string; representative_name: string | null; is_community: boolean }[]
	>`
		SELECT id, party_id, display_name, representative_name, is_community
		FROM snapshot_party WHERE meeting_id = ${meetingId} ORDER BY display_name
	`;
	const einheiten = await tx<
		{
			snapshot_party_id: string;
			unit_id: string;
			label: string;
			kind: 'unit' | 'parking';
			counts_as_head: boolean;
			quota: number;
		}[]
	>`
		SELECT snapshot_party_id, unit_id, label, kind, counts_as_head, quota
		FROM snapshot_unit WHERE meeting_id = ${meetingId} ORDER BY label
	`;

	return {
		...momentaufnahmeKopf(k, k.meeting_id),
		parties: parteien.map((p) => ({
			partyId: p.party_id,
			displayName: p.display_name,
			representativeName: p.representative_name,
			isCommunity: p.is_community,
			units: einheiten
				.filter((u) => u.snapshot_party_id === p.id)
				.map((u) => ({
					unitId: u.unit_id,
					label: u.label,
					kind: u.kind,
					countsAsHead: u.counts_as_head,
					quota: Number(u.quota)
				}))
		}))
	};
}

// ── Stimmabgabe (Stories 5.7 und 5.14) ──────────────────────────────────────

export interface Stimmabgabe {
	/** Kennung der Partei aus den Stammdaten, wie sie die Momentaufnahme führt. */
	parteiId: Id;
	/** Ohne Angabe: alle Einheiten dieser Partei gleich. */
	unitIds?: Id[];
	wahl: VoteChoice;
	/**
	 * Wer die Stimme aufgrund einer Vollmacht ausübt — die Zeilenkennung der
	 * Momentaufnahme, **nicht** die der Partei.
	 *
	 * Leer heisst: die Partei selbst. Gesetzt wird sie nur, wenn eine
	 * bevollmächtigte Person am eigenen Gerät für eine andere stimmt; im
	 * Streitfall hängt daran die Vertretungsmacht (FR-56).
	 */
	ausgeuebtVon?: Id | null;
}

/**
 * Nimmt Stimmen entgegen — vom Eigentümer selbst oder von der Sitzungsleitung.
 *
 * Anfügend, nie ändernd (AD-5): Eine Berichtigung erzeugt neue Zeilen, die
 * alten bleiben stehen, und für das Ergebnis zählt die letzte je Einheit.
 * `durchSitzungsleitung` steht an jeder Zeile, weil im Protokoll ein
 * Unterschied ist zwischen «hat gestimmt» und «wurde so erfasst».
 */
/**
 * Erfasst eine **von Hand gezählte** Abstimmung: drei Zahlen, ohne Zuordnung.
 *
 * **Der Auftrag** (Auftraggeber, 25.08.2026): «Wenn müsste man dort die totale Anzahl
 * an Ja, Nein und Enthaltung eintragen können» — und ausdrücklich zusätzlich zum
 * einzelnen Erfassen: «So bleibt man flexibel, je situation.»
 *
 * **Nur beim einfachen Mehr.** Die Grenze rechnet der Kern
 * (`summenhindernis`); hier wird sie vor dem Schreiben geprüft, damit die
 * Absage kommt, bevor etwas in der Datenbank steht. Der Satz nennt jeweils den
 * Grund — «Wertquoten hängen an der Einheit», nicht «nicht möglich».
 *
 * **Nur solange der Durchgang offen ist.** Nach dem Schliessen steht das
 * Ergebnis; eine nachträglich eingetragene Summe änderte einen verkündeten
 * Beschluss. Wer sich verzählt hat, kann ihn nur noch über ein Rückkommen
 * ändern lassen, wie bei einer falschen Einzelstimme (H6).
 *
 * `null` als Summe nimmt die Handzählung zurück. Das ist der Weg zurück zur
 * Einzelerfassung; ohne ihn wäre die Wahl unumkehrbar, und ein Vertipper
 * kostete einen ganzen Durchgang.
 */
export async function erfasseSummen(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	summe: Handzaehlung | null
): Promise<Durchgangsstand> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ paused_at: Date | null }[]>`
			SELECT paused_at FROM meeting WHERE id = ${meetingId}
		`;
		/*
		 * **In der Pause wird nicht gezählt** (S3), dieselbe Schranke wie bei der
		 * Einzelstimme (`gibStimmenAb`) und beim Veto-Entscheid. Auch die
		 * Rücknahme: Sie ändert, was beim Schliessen gezählt wird, und in der
		 * Pause bleibt der Durchgang, wie er ist.
		 */
		if (m?.paused_at) {
			throw new FachlicherFehler(
				'unterbrochen',
				'Die Versammlung ist unterbrochen. Sobald die Sitzungsleitung fortfährt, lässt sich ' +
					'die Handzählung wieder erfassen oder zurücknehmen.',
				'zustand'
			);
		}

		/*
		 * **`FOR UPDATE`** (S4). Eine angefangene Einzelstimme hält den Durchgang
		 * mit `FOR SHARE` (`gibStimmenAb`); die Handzählung wartet hier, bis sie
		 * festgeschrieben ist, und zählt sie dann unten mit. Ohne Sperre lief die
		 * Zählung der Stimmzeilen an der noch nicht eingefügten Stimme vorbei, und
		 * der Durchgang trug danach Summe und Einzelstimme. Umgekehrt liest eine
		 * Stimme, die erst nach der Handzählung an die Zeile kommt, die Summe und
		 * wird abgewiesen.
		 */
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
			   FOR UPDATE
		`;
		if (!z) {
			throw new FachlicherFehler(
				'keine_offene',
				'Es ist keine Abstimmung offen. Erfasst wird, solange abgestimmt wird.',
				'durchgang'
			);
		}

		if (!summe) {
			const [zurueck] = await tx<Rundenzeile[]>`
				UPDATE voting_round
				   SET tally_yes = NULL, tally_no = NULL, tally_abstain = NULL,
				       tally_other_yes = NULL, tally_other_no = NULL, tally_other_abstain = NULL,
				       tally_note = NULL, tally_by = NULL, tally_at = NULL,
				       tally_stand_json = NULL
				 WHERE id = ${z.id}
				RETURNING *
			`;
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.handzaehlungZurueckgenommen,
					{ art: 'voting_round', id: z.id },
					{ versammlung: meetingId, traktandum: z.agenda_item_id }
				)
			);
			return ausDb(zurueck);
		}

		const [vorhandene] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM vote WHERE round_id = ${z.id}
		`;
		if (Number(vorhandene?.anzahl ?? 0) > 0) {
			throw new FachlicherFehler(
				'stimmen_erfasst',
				`Für diesen Durchgang sind bereits ${vorhandene.anzahl} einzelne Stimmen erfasst. ` +
					'Einzelne Stimmen und Summen zusammen ergäben zwei Ergebnisse.',
				'durchgang'
			);
		}

		/*
		 * Das Erfordernis steht am Durchgang: Es wandert schon beim **Eröffnen**
		 * mit (AD-4), damit eine Änderung am Traktandum den laufenden Durchgang
		 * nicht nachträglich nach einer anderen Regel bewertet. Genau das gilt
		 * auch hier — geprüft wird gegen die Regel, unter der eröffnet wurde.
		 */
		const erfordernis = z.requirement_json;
		if (!erfordernis) {
			throw new FachlicherFehler(
				'ohne_erfordernis',
				'Für dieses Traktandum steht kein Mehrheitserfordernis fest.',
				'erfordernis'
			);
		}
		const hindernis = summenhindernis(erfordernis);
		if (hindernis) throw new FachlicherFehler('summe_unzulaessig', hindernis, 'erfordernis');
		// Bei den Wertquoten gehört ein Vermerk dazu (Block A3c; Begründung bei
		// `summenvermerkNoetig`). Vor dem Schreiben, wie die Grenze oben.
		const vermerkPflicht = summenvermerkNoetig(erfordernis);
		if (
			vermerkPflicht &&
			zeichenzahl(summe.vermerk?.trim() ?? '') < SUMMENVERMERK_MINDESTLAENGE
		) {
			throw new FachlicherFehler('summe_ohne_vermerk', vermerkPflicht, 'vermerk');
		}

		/*
		 * **Vor dem Schreiben durchrechnen.** `zaehleSummenAus` prüft die Zahlen
		 * gegen die Anwesenden — mehr Stimmen als Stimmberechtigte gibt es nicht.
		 * Erst rechnen, dann schreiben: Sonst stünde eine Zahl in der Datenbank,
		 * die beim Schliessen einen Fehler wirft, und die Sitzungsleitung erführe
		 * das im ungünstigsten Augenblick.
		 *
		 * **Gegen den Stand, den das Schliessen übernimmt** (S5, Migration 156).
		 * Gelesen mit denselben Funktionen wie beim Schliessen (`leseSchlussstand`,
		 * `leseBetroffeneIn`) und mit der Zählung festgehalten. Das Schliessen
		 * rechnet mit genau diesen Angaben, statt neu zu lesen; was hier besteht,
		 * besteht dort. Bis dahin las das Schliessen neu, und ein Weggang nach dem
		 * Zählen liess es scheitern. Die Betroffenen und Vollmachten gehören dazu,
		 * weil die Kopfzahl an ihnen hängt (seit 25.09.2026; Code-Review 25.09.2026
		 * zur Handzählung, Befund 1).
		 */
		const schluss = await leseSchlussstand(tx, meetingId, z.agenda_item_id);
		const stand: Summenstand = {
			...schluss,
			quelle: zeitquelle(),
			betroffene: await leseBetroffeneIn(tx, z.agenda_item_id, z.id)
		};
		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		const lage = momentaufnahme
			? {
					momentaufnahme,
					erfordernis,
					anwesende: stand.anwesende,
					imAusstand: stand.ausstand,
					betroffeneParteiIds: stand.betroffene.map((b) => b.parteiId),
					alleEigentuemerBeklagt: stand.betroffene
						.filter((b) => b.alleBeklagt)
						.map((b) => b.parteiId),
					vertretungen: stand.vertretungen
				}
			: null;
		/*
		 * **Die zweite Zählung an der Einsprache** (Migration 172, Kriterium 5).
		 * Zuerst die Pflicht, dann rechnen (Codeprüfung Block 5, M1): Ohne zweite
		 * Dreizahl rechnete `zaehleSummenAus` die erste gegen die Obergrenze der
		 * anderen Zählweise und wies eine richtige Zählung als zu hoch ab, statt
		 * die zweite zu verlangen. Zusammen oder leer; Pflicht genau dann, wenn
		 * eine anwesende stimmberechtigte Partei je Einheit nicht genau eine
		 * Stimme hat (`einspracheZaehlhilfe`), auch 0 bei einem Nebenobjekt ohne
		 * Kopfstimme. Wo L3 nicht wirkt, gibt es keine zweite Zählung (N3): Sie
		 * stünde ohne Bedeutung in Datenbank und Siegel.
		 */
		const l3 = lage !== null && l3Wirkt(erfordernis, lage.momentaufnahme);
		const teilweise =
			(summe.andereJa !== undefined || summe.andereNein !== undefined || summe.andereEnthaltung !== undefined) &&
			andereDreizahlVon(summe) === null;
		if (teilweise) {
			throw new FachlicherFehler(
				'summe_andere_unvollstaendig',
				'Die zweite Zählung braucht alle drei Zahlen, Ja, Nein und Enthaltung.',
				'andereJa'
			);
		}
		if (!l3 && andereDreizahlVon(summe) !== null) {
			throw new FachlicherFehler(
				'summe_andere_unzulaessig',
				// Codeprüfung der Fixes, Niedrig 4: auch an einer älteren Einsprache.
				// Laienprüfung Runde 3, R3-2: ohne «Fassung», mit dem, was zu tun ist.
				'Dieses Traktandum zählt nicht nach der Einstellung zur Einsprache auf der Seite ' +
					'«Lesarten»; eine zweite Zählung gibt es hier nicht. Lassen Sie sie leer.',
				'andereJa'
			);
		}
		if (lage && l3) {
			const hilfe = einspracheZaehlhilfe(lage);
			if (hilfe.length > 0 && andereDreizahlVon(summe) === null) {
				const texte = einspracheHandzaehlungTexte(einsprachelesartVon(erfordernis));
				throw new FachlicherFehler(
					'summe_ohne_andere_zaehlung',
					`${texte.absage} ${EINSPRACHE_ZAEHLHILFE_VORSATZ}${hilfe.join(', ')}.`,
					'andereJa'
				);
			}
		}
		if (lage) {
			zaehleSummenAus(lage, summe);
			// Die zweite Dreizahl für sich, auch bei offenem Stichentscheid
			// (Codeprüfung Block 5, N2; `pruefeAndereDreizahl`).
			pruefeAndereDreizahl(lage, summe);
		}

		const vermerk = summe.vermerk?.trim() || null;
		const andere = andereDreizahlVon(summe);
		const [neu] = await tx<Rundenzeile[]>`
			UPDATE voting_round
			   SET tally_yes = ${summe.ja}, tally_no = ${summe.nein},
			       tally_abstain = ${summe.enthaltung}, tally_note = ${vermerk},
			       tally_other_yes = ${andere?.ja ?? null}, tally_other_no = ${andere?.nein ?? null},
			       tally_other_abstain = ${andere?.enthaltung ?? null},
			       tally_by = ${handelnder.userId}, tally_at = now(),
			       tally_stand_json = ${tx.json(stand as never)}
			 WHERE id = ${z.id}
			RETURNING *
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.handzaehlungErfasst,
				{ art: 'voting_round', id: z.id },
				{
					versammlung: meetingId,
					traktandum: z.agenda_item_id,
					ja: summe.ja,
					nein: summe.nein,
					enthaltung: summe.enthaltung,
					// Die zweite Zählung an der Einsprache gehört in den Nachweis wie die
					// erste (Abnahme Block 5, Migration 172).
					...(andere
						? { andereJa: andere.ja, andereNein: andere.nein, andereEnthaltung: andere.enthaltung }
						: {}),
					vermerk
				}
			)
		);

		return ausDb(neu);
	});
}

/**
 * Die Texte und die Zählhilfe der Handzählung an der Einsprache (Migration 172),
 * für die Leitungsseite — oder `null`, wo L3 nicht wirkt. Gelesen wird der
 * offene Durchgang, denn gezählt wird nur, solange abgestimmt wird.
 */
export async function holeEinspracheZaehlung(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id
): Promise<{
	ueberschrift: string;
	erklaerung: string;
	feldEigentuemer: string;
	feldEinheit: string;
	zusatz: string;
	absage: string;
	/** Welche der beiden Zählungen nach der Einstellung gilt. */
	feldNachEinstellung: 'je_eigentuemer' | 'je_einheit';
	haende: Record<'je_eigentuemer' | 'je_einheit', string[]>;
} | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<{ id: Id; requirement_json: Erfordernis | null }[]>`
			SELECT id, requirement_json FROM voting_round
			 WHERE meeting_id = ${meetingId} AND agenda_item_id = ${traktandumId} AND state = 'offen'
		`;
		const erfordernis = z?.requirement_json;
		if (!erfordernis) return null;
		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		if (!momentaufnahme || !l3Wirkt(erfordernis, momentaufnahme)) return null;
		const schluss = await leseSchlussstand(tx, meetingId, traktandumId);
		const betroffene = await leseBetroffeneIn(tx, traktandumId, z.id);
		const haende = einspracheHaende({
			momentaufnahme,
			erfordernis,
			anwesende: schluss.anwesende,
			imAusstand: schluss.ausstand,
			betroffeneParteiIds: betroffene.map((b) => b.parteiId),
			alleEigentuemerBeklagt: betroffene.filter((b) => b.alleBeklagt).map((b) => b.parteiId),
			vertretungen: schluss.vertretungen
		});
		return { ...einspracheHandzaehlungTexte(einsprachelesartVon(erfordernis)), feldNachEinstellung: einsprachelesartVon(erfordernis), haende };
	});
}

/**
 * Stimmen in diesem Stapel ausschliesslich Parteien ab, die auf Papier stimmen?
 *
 * **Die Frage ist bewusst «alle», nicht «wenigstens eine».** Der Rückgabewert
 * entscheidet, ob die Begründung entfallen darf, und sie hängt an jeder
 * einzelnen Stimme des Stapels. «Wenigstens eine» hiesse, dass eine einzige
 * Papierpartei die Begründung für elf digitale mitentfernt.
 */
async function allePapier(tx: Tx, meetingId: Id, abgaben: Stimmabgabe[]): Promise<boolean> {
	const parteien = [...new Set(abgaben.map((a) => a.parteiId))];
	/*
	 * **Der leere Stapel ist nicht «alle»** (aus dem Review). `0 === 0` wäre
	 * wahr, und die Funktion trüge die Annahme, dass ihr Aufrufer den Fall
	 * vorher abfängt. Heute tut er das; die Annahme steht trotzdem besser hier,
	 * wo die Rechnung ist.
	 */
	if (parteien.length === 0) return false;
	const [z] = await tx<{ anzahl: number }[]>`
		SELECT count(*)::int AS anzahl
		  FROM paper_ballot b
		  JOIN snapshot_party s ON s.id = b.snapshot_party_id
		 WHERE b.meeting_id = ${meetingId} AND s.party_id = ANY(${parteien})
	`;
	return z.anzahl === parteien.length;
}

export async function gibStimmenAb(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	abgaben: Stimmabgabe[],
	durchSitzungsleitung: boolean,
	/**
	 * Warum die Sitzungsleitung erfasst — Pflicht in der geführten Betriebsart.
	 *
	 * Sie wandert an **jede** geschriebene Stimme, nicht nur in den Verlauf: Wer
	 * später eine einzelne Stimme ansieht, muss ihren Grund dort finden, wo sie
	 * steht.
	 */
	begruendung: string | null = null
): Promise<{ durchgangId: Id; zeilen: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string; operation_mode: string; paused_at: Date | null }[]>`
			SELECT state, operation_mode, paused_at FROM meeting WHERE id = ${meetingId}
		`;

		/*
		 * **In der Pause wird nicht abgestimmt** (Migration 073).
		 *
		 * «Pause würde auch eine Abstimmung unterbrechen, wenn diese bspw.
		 * ungeplant ist (notfall, störung oder so)» (Auftraggeber, 21.08.2026). Der
		 * Durchgang bleibt offen und die abgegebenen Stimmen stehen — gesperrt ist
		 * nur das Weiterstimmen. Sonst gäbe jemand mit offener Seite seine Stimme
		 * in die Pause hinein ab, während an der Wand «Pause» steht und niemand im
		 * Saal es sieht.
		 */
		if (m?.paused_at) {
			throw new FachlicherFehler(
				'unterbrochen',
				'Die Versammlung ist unterbrochen. Sobald die Sitzungsleitung fortfährt, lässt sich ' +
					'wieder abstimmen — die bereits abgegebenen Stimmen bleiben stehen.',
				'zustand'
			);
		}

		/*
		 * Die Auflage steht im Kern, nicht hier: Ob eine stellvertretend erfasste
		 * Stimme eine Begründung braucht, ist eine fachliche Frage und keine des
		 * Datenzugriffs.
		 */
		/*
		 * **Alle oder keiner** (Migration 107). Die Prüfung läuft einmal für den
		 * ganzen Stapel und nicht je Partei, denn die Begründung wandert an jede
		 * Stimme darin. Erlassen wird sie deshalb nur, wenn JEDE Partei des
		 * Stapels auf Papier abstimmt.
		 *
		 * Die strenge Richtung ist hier die richtige: Ein gemischter Stapel
		 * enthält mindestens eine Partei, für die das Erfassen ein Eingriff ist,
		 * und der gehört begründet. Wer die Begründung sparen will, erfasst die
		 * Papierparteien für sich — was am Eingang ohnehin geschieht.
		 */
		const aufPapier =
			durchSitzungsleitung && abgaben.length > 0
				? await allePapier(tx, meetingId, abgaben)
				: false;

		const grund = durchSitzungsleitung
			? pruefeStellvertretendeStimme({
					// Ohne Zeile bliebe es bei der strengeren Lesart: Wer keine
					// Betriebsart kennt, verlangt die Begründung.
					betriebsart: (m?.operation_mode as Betriebsart) ?? 'gefuehrt',
					aufPapier,
					begruendung
				})
			: null;
		/*
		 * **Die Stimme hält den Durchgang offen, bis sie steht** (Sicherheitsdurchgang
		 * 09.10.2026, S1). Ohne Sperre las der Stimmweg «offen», das Schliessen lief
		 * dazwischen durch, und die Stimme landete danach im geschlossenen
		 * Durchgang: gespeichert, auf dem Telefon bestätigt, im verkündeten Ergebnis
		 * nicht gezählt. Stimmnachweis und Ergebnis widersprachen sich.
		 *
		 * `FOR SHARE`, nicht `FOR UPDATE`: Stimmen sperren einander nicht, sonst
		 * stünde der ganze Saal in einer Schlange. Das Schliessen nimmt `FOR UPDATE`
		 * und wartet, bis jede angefangene Stimme festgeschrieben ist. Kommt die
		 * Stimme erst nach dem Schliessen an die Zeile, prüft PostgreSQL die
		 * Bedingung `state = 'offen'` an der neuen Fassung neu, die Zeile fällt
		 * heraus, und `pruefeStimmabgabe` weist ab.
		 */
		const [z] = await tx<Rundenzeile[]>`
			SELECT * FROM voting_round WHERE meeting_id = ${meetingId} AND state = 'offen'
			   FOR SHARE
		`;
		/*
		 * **Auch ein leerer Stapel braucht einen offenen Durchgang** (S10). Die
		 * Prüfung lief nur je Abgabe; ohne Abgabe griff die Rückgabe auf `z.id`
		 * eines Durchgangs, den es nicht gab.
		 */
		if (!z) {
			pruefeStimmabgabe({
				durchgangszustand: null,
				versammlungszustand: m?.state ?? '',
				istAnwesend: false
			});
		}

		/*
		 * **Einzeln oder als Summe, nicht beides** (25.08.2026). Liegt am
		 * Durchgang eine Handzählung, ergäbe eine zusätzliche Einzelstimme zwei
		 * Auszählungen desselben Durchgangs — und die Anwendung müsste sich für
		 * eine entscheiden, ohne dass jemand das gewählt hätte.
		 *
		 * Gelesen hinter der Sperre oben: Die Handzählung nimmt den Durchgang mit
		 * `FOR UPDATE` (S4). Eine Stimme, die danach an die Zeile kommt, sieht
		 * hier die Summe; eine, die vorher kam, zählt `erfasseSummen` mit.
		 */
		if (z && z.tally_yes !== null) {
			throw new FachlicherFehler(
				'summe_erfasst',
				'Für diesen Durchgang ist eine Handzählung erfasst. Einzelne Stimmen und Summen ' +
					'zusammen ergäben zwei Ergebnisse. Nehmen Sie die Handzählung zurück, wenn Sie ' +
					'einzeln erfassen wollen.',
				'durchgang'
			);
		}

		const stand = await leseAnwesenheitsstand(tx, meetingId);
		const anwesende = new Set(stand.map((a) => a.parteiId));
		/*
		 * **Der Papiervermerk gilt dem eigenen Gerät, nicht der Sitzungsleitung**
		 * (Migration 107). Er wird deshalb nur für den Selbstweg dazugeholt. Die
		 * erste Fassung holte ihn immer und nahm ihn am Wurf unten wieder aus —
		 * eine Ausnahme, die man beim Lesen übersieht. So sagt der Code, was er
		 * meint: Wer selbst stimmen will, ist gesperrt; wer überträgt, nicht.
		 *
		 * Der Ausstand gilt für beide Wege. Er nimmt das Stimmrecht, und wer es
		 * nicht hat, hat es auch nicht, wenn ein anderer eintippt.
		 */
		let gesperrt: Map<Id, Stimmsperre> = z
			? await leseAusstandssperre(tx, meetingId, z.agenda_item_id, stand)
			: new Map();
		if (!durchSitzungsleitung) {
			gesperrt = await papierSperren(tx, meetingId, gesperrt);
		}

		let zeilen = 0;
		for (const abgabe of abgaben) {
			pruefeStimmabgabe({
				durchgangszustand: z?.state ?? null,
				versammlungszustand: m?.state ?? '',
				istAnwesend: anwesende.has(abgabe.parteiId)
			});

			/*
			 * **Der Ausstand nimmt die Stimme, nicht bloss ihr Gewicht.**
			 *
			 * Die Auszählung liesse eine solche Stimme ohnehin fallen — aber
			 * stillschweigend. Auf dem Telefon stünde «Ihre Stimme ist erfasst», im
			 * Ergebnis käme sie nicht vor, und niemand wüsste warum. Hier abzuweisen
			 * ist der einzige Ort, an dem sich das noch erklären lässt.
			 */
			const sperre = gesperrt.get(abgabe.parteiId);
			if (sperre) {
				throw new FachlicherFehler('im_ausstand', sperreInWorten(sperre), 'partei');
			}

			const [partei] = await tx<{ id: string }[]>`
				SELECT id FROM snapshot_party
				WHERE meeting_id = ${meetingId} AND party_id = ${abgabe.parteiId}
			`;
			if (!partei) {
				throw new FachlicherFehler(
					'unbekannte_partei',
					'Diese Partei ist an dieser Versammlung nicht stimmberechtigt.',
					'partei'
				);
			}

			const einheiten = await tx<{ id: string; unit_id: string }[]>`
				SELECT id, unit_id FROM snapshot_unit WHERE snapshot_party_id = ${partei.id}
				${abgabe.unitIds?.length ? tx`AND unit_id = ANY(${abgabe.unitIds})` : tx``}
				ORDER BY label
			`;
			if (einheiten.length === 0) {
				throw new FachlicherFehler(
					'ohne_einheit',
					'Ohne zugeordnete Einheit besteht kein Stimmrecht.',
					'einheit'
				);
			}
			/*
			 * **Jede genannte Einheit muss der Partei gehören** (S7). Sonst fiel
			 * eine fremde Kennung still aus der Menge: Das Telefon meldete
			 * «gestimmt», die übrigen Einheiten blieben stumm, und bei Wertquoten
			 * fehlten Anteile. Gezählt wird gegen die verschiedenen Kennungen,
			 * denn dieselbe Einheit zweimal genannt ist keine fremde.
			 */
			if (abgabe.unitIds?.length && einheiten.length !== new Set(abgabe.unitIds).size) {
				throw new FachlicherFehler(
					'fremde_einheit',
					'Mindestens eine der genannten Einheiten gehört nicht zu dieser Partei. Es wurde ' +
						'keine Stimme gespeichert. Stimmen Sie ohne Auswahl einzelner Einheiten ab, dann ' +
						'gilt die Stimme für alle Einheiten der Partei.',
					'einheit'
				);
			}

			for (const e of einheiten) {
				await tx`
					INSERT INTO vote (operator_id, round_id, snapshot_party_id, snapshot_unit_id, choice,
					                  recorded_by_chair, recorded_by, cast_by_party_id, chair_reason)
					VALUES (${handelnder.operatorId}, ${z.id}, ${partei.id}, ${e.id}, ${abgabe.wahl},
					        ${durchSitzungsleitung}, ${durchSitzungsleitung ? handelnder.userId : null},
					        ${abgabe.ausgeuebtVon && abgabe.ausgeuebtVon !== partei.id ? abgabe.ausgeuebtVon : null},
					        ${grund})
				`;
				zeilen++;
			}
		}

		if (durchSitzungsleitung && zeilen > 0) {
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.stimmeErfasst,
					{ art: 'meeting', id: meetingId },
					{
						durchgang: Number(z.ordinal),
						parteien: abgaben.length,
						// Der Grund gehört auch in die Chronik: Das Protokoll lässt sich
						// bearbeiten, der Verlauf nicht (AD-5).
						...(grund ? { begruendung: grund } : {})
					}
				)
			);
		}

		return { durchgangId: z.id, zeilen };
	});
}

/**
 * Die Stimmen, die die Sitzungsleitung stellvertretend erfasst hat — mit Grund.
 *
 * **Wofür.** Sie gehören ins Protokoll (20.08.2026: «Das müsste aber
 * dokumentiert sein»). Eine fremde Stimme, für die niemand einen Grund nennen
 * kann, ist keine Stimme, sondern ein Eingriff — und die Frage danach wird
 * Monate später gestellt.
 *
 * **Je Partei einmal**, obwohl je Einheit eine Zeile geschrieben wird: Im
 * Protokoll interessiert die Partei und ihr Grund, nicht dieselbe Zeile
 * viermal. Genommen wird die **letzte** Erfassung — eine Berichtigung erzeugt
 * eine neue Zeile, und für das Ergebnis zählt ebenfalls die letzte.
 *
 * Ohne `chair_reason` (einfache Betriebsart) kommt nichts zurück: Dort erfasst
 * die Sitzungsleitung alles, und der Grund ist die Betriebsart. Sie steht im
 * Protokoll an anderer Stelle.
 */
export async function holeStellvertretendeStimmen(
	operatorId: Id,
	durchgangIds: readonly Id[]
): Promise<Map<Id, { name: string; grund: string }[]>> {
	if (durchgangIds.length === 0) return new Map();
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ round_id: string; display_name: string; chair_reason: string }[]>`
			SELECT DISTINCT ON (v.round_id, v.snapshot_party_id)
			       v.round_id, p.display_name, v.chair_reason
			FROM vote v
			JOIN snapshot_party p ON p.id = v.snapshot_party_id
			WHERE v.round_id = ANY(${durchgangIds as string[]})
			  AND v.recorded_by_chair
			  AND v.chair_reason IS NOT NULL
			ORDER BY v.round_id, v.snapshot_party_id, v.cast_at DESC, v.id DESC
		`;
		const je = new Map<Id, { name: string; grund: string }[]>();
		for (const z of zeilen) {
			const liste = je.get(z.round_id) ?? [];
			liste.push({ name: z.display_name, grund: z.chair_reason });
			je.set(z.round_id, liste);
		}
		return je;
	});
}

/** Was eine einzelne Partei im offenen Durchgang bereits gestimmt hat. */
export async function holeEigeneStimmen(
	operatorId: Id,
	durchgangId: Id,
	parteiId: Id
): Promise<Record<Id, VoteChoice>> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ unit_id: string; choice: VoteChoice; cast_at: Date }[]>`
			SELECT u.unit_id, v.choice, v.cast_at
			FROM vote v
			JOIN snapshot_party p ON p.id = v.snapshot_party_id
			JOIN snapshot_unit u ON u.id = v.snapshot_unit_id
			WHERE v.round_id = ${durchgangId} AND p.party_id = ${parteiId}
			ORDER BY v.cast_at, v.id
		`;
		const je: Record<Id, VoteChoice> = {};
		for (const z of zeilen) je[z.unit_id] = z.choice;
		return je;
	});
}

export { holeMomentaufnahme };

/**
 * Ob ein Durchgang angenommen wurde — innerhalb einer laufenden Transaktion.
 *
 * Gebraucht vom Rückkommensantrag: Ob ein Beschluss vorliegt oder der Antrag
 * abgelehnt wurde, entscheidet über sein Erfordernis und seinen Wortlaut. Das
 * Ergebnis steht **am Durchgang**, festgeschrieben beim Verkünden (seit
 * 25.09.2026), und wird nirgends ein zweites Mal abgelegt; eine Kopie liefe
 * ihm früher oder später davon.
 */
export async function durchgangAngenommenInTx(
	tx: Tx,
	meetingId: Id,
	durchgangId: Id
): Promise<boolean> {
	return angenommenIn(tx, meetingId, durchgangId);
}

/**
 * Warum der Durchgang «kein Beschluss» ergab (Migration 128), innerhalb einer
 * Transaktion; null, wenn er einen Beschluss ergab oder keinen Ausgang hat.
 * Der Grund, weil der Weg danach nach einer konsultativen Abstimmung ein
 * anderer ist (Migration 158).
 */
export async function durchgangOhneBeschlussInTx(
	tx: Tx,
	meetingId: Id,
	durchgangId: Id
): Promise<KeinBeschluss['grund'] | null> {
	const a = (await ergebnisIn(tx, meetingId, durchgangId)).auszaehlung;
	return ergebnislage(a) === 'kein_beschluss' ? (a?.keinBeschluss?.grund ?? null) : null;
}

/**
 * Die Zuordnung eines Traktandums, die die Leitung vor dem Freigeben bestätigt
 * (Ä-05, M4; `domain/freigabezuordnung.ts`).
 *
 * Anwesend zählt, wer nach der Ereignisfolge anwesend ist, gegen die Parteien
 * der Momentaufnahme; dieselbe Zahl, die die Leitungsseite oben als «x von y
 * anwesend» nennt. Ohne Momentaufnahme (Versammlung nicht eröffnet) null von
 * null; eröffnen liesse sich dann ohnehin nicht.
 *
 * **Der Ausstand in derselben Lesung wie die Zählung** (M-1, 07.11.2026):
 * Auch der Ausstand aus L8 steht in der Liste, über
 * `leseAusstandMitVerwaltung` wie bei Ausstandsliste und Schliessen. Ohne ihn
 * sagte die bestätigte Zuordnung «im Ausstand niemand», wo die Verwaltung
 * nach der Einstellung der Gemeinschaft ruht, und der Verlauf der Freigabe
 * hätte eine Zuordnung ohne sie festgehalten.
 */
async function leseZuordnung(
	tx: Tx,
	meetingId: Id,
	traktandumId: Id,
	erfordernis: { fassung?: unknown; knotenId?: unknown; titel?: unknown } | null
): Promise<Zuordnung> {
	const [[traktandum], erklaerte, momentaufnahme, stand, mitVerwaltung] = await Promise.all([
		tx<{ art: Geschaeftsart | null }[]>`
			SELECT requirement_business_kind AS art FROM agenda_item
			WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
		`,
		tx<{ party_id: string | null; holder_name: string | null; holder_key: string | null; name: string | null }[]>`
			SELECT r.party_id, r.holder_name, r.holder_key, p.display_name AS name
			FROM recusal r
			JOIN agenda_item a ON a.id = r.agenda_item_id
			LEFT JOIN party p ON p.id = r.party_id
			WHERE r.agenda_item_id = ${traktandumId} AND a.meeting_id = ${meetingId}
			ORDER BY r.party_id, r.holder_key
		`,
		holeMomentaufnahmeIn(tx, meetingId),
		leseAnwesenheitsstand(tx, meetingId),
		leseAusstandMitVerwaltung(tx, meetingId, traktandumId)
	]);
	const parteien = new Set((momentaufnahme?.parties ?? []).map((p) => p.partyId));
	const geschaeftsart = traktandum?.art ?? null;
	// M-1: Die Namen der Verwaltung hängen an ihren Kennungen; die der
	// erklärten Zeilen an der Tabelle. Beide zusammen, und die erklärten
	// Zeilen in derselben Reihenfolge wie die Zählung (`ORDER BY party_id,
	// holder_key` in `leseAusstandMitVerwaltung`), damit die bestätigte
	// Zuordnung den Ausstand so nennt, wie er gezählt wird; die Verwaltung
	// steht dahinter. G-8 (Lauf 5, 07.11.2026): `erklaert_am` trägt bei
	// mehreren Zeilen einer Transaktion denselben Zeitpunkt und trüge die
	// Reihenfolge nicht.
	const namenJeKennung = new Map(
		erklaerte.map((a) => [
			a.party_id ?? VERTRETERKENNUNG_VORSATZ + (a.holder_key ?? ''),
			a.holder_name ?? a.name ?? a.party_id ?? ''
		])
	);
	mitVerwaltung.verwaltung.kennungen.forEach((kennung, i) =>
		namenJeKennung.set(kennung, mitVerwaltung.verwaltung.namen[i])
	);
	return {
		geschaeftsart,
		erfordernis: erfordernis?.titel ? String(erfordernis.titel) : null,
		imAusstand: mitVerwaltung.ausstand.map((k) => namenJeKennung.get(k) ?? k),
		anwesend: stand.filter((a) => parteien.has(a.parteiId)).length,
		gesamt: parteien.size,
		marke: zuordnungsmarke(erfordernis, geschaeftsart, mitVerwaltung.ausstand)
	};
}

/** `leseZuordnung` für die Leitungsseiten, mit dem Erfordernis, das sie schon geladen haben. */
export async function holeZuordnung(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id,
	erfordernis: Erfordernis | null
): Promise<Zuordnung> {
	return alsBetreiber(operatorId, (tx) => leseZuordnung(tx, meetingId, traktandumId, erfordernis));
}

/**
 * Was dieses Traktandum braucht, um durchzukommen — **bevor** abgestimmt wird.
 *
 * **Warum es diese Funktion überhaupt gibt** (Prüflauf 22.08.2026): Bis dahin
 * stand vor einer Abstimmung nur der Fallname des Erfordernisses da. Die Zahl —
 * «nötig 4 von 5» — erschien erst im Ergebnis, und dann war die Abstimmung
 * vorbei. Ein Traktandum, das an zwei Dritteln aller Eigentümer scheitert, muss
 * das sagen, solange man noch etwas tun kann: vertagen, Vollmachten prüfen,
 * jemanden anrufen.
 *
 * **Dieselbe Lage wie beim Schliessen, nur ohne Stimmen.** Anwesenheit,
 * Vertretungen, Ausstand und unmittelbar Betroffene werden gelesen, wie sie
 * jetzt stehen. Sie ändern sich im Lauf des Abends, und das ist richtig so: Wer
 * dazukommt, verschiebt die Bezugsgrösse der anwesenheitsabhängigen
 * Erfordernisse. Festgeschrieben wird erst beim Schliessen (AD-16).
 *
 * **Das Erfordernis kommt herein, statt hier gelesen zu werden.** Es steht in
 * `agenda_item` über achtzehn Einzelspalten verteilt, und `traktanden.ts` setzt
 * es daraus zusammen; diese Leselogik ein zweites Mal zu schreiben hiesse, sie
 * ein zweites Mal pflegen zu müssen. Die Aufrufer haben das Erfordernis
 * ohnehin — die Leitungsseite aus dem Traktandenbaum, der Stand aus dem
 * Durchgang.
 *
 * Gibt `null` zurück, wo es nichts vorzurechnen gibt — kein Erfordernis oder
 * keine Momentaufnahme (Versammlung noch nicht freigegeben).
 */
export async function holeMehrheitsvorschau(
	operatorId: Id,
	meetingId: Id,
	traktandumId: Id,
	erfordernis: Erfordernis | null
): Promise<Mehrheitsvorschau | null> {
	if (!erfordernis) return null;
	return alsBetreiber(operatorId, async (tx) => {
		const momentaufnahme = await holeMomentaufnahmeIn(tx, meetingId);
		if (!momentaufnahme) return null;

		const stand = await leseAnwesenheitsstand(tx, meetingId);
		const [betroffene, ausstand] = await Promise.all([
			tx<{ party_id: string; alle_eigentuemer_beklagt: boolean }[]>`
				SELECT b.party_id, b.alle_eigentuemer_beklagt
				FROM agenda_item_affected b
				JOIN agenda_item a ON a.id = b.agenda_item_id
				WHERE b.agenda_item_id = ${traktandumId} AND a.meeting_id = ${meetingId}
			`,
			leseAusstandskennungen(tx, meetingId, traktandumId)
		]);

		return mehrheitsvorschau({
			momentaufnahme,
			erfordernis,
			anwesende: stand.map((a) => a.parteiId),
			vertretungen: await leseVertretungen(tx, meetingId, stand),
			betroffeneParteiIds: betroffene.map((b) => b.party_id),
			alleEigentuemerBeklagt: betroffene
				.filter((b) => b.alle_eigentuemer_beklagt)
				.map((b) => b.party_id),
			imAusstand: ausstand,
			// Rückkommensantrag oder Durchgang danach (F4c B2b), wie jetzt steht.
			...(await leseRueckkommenslage(tx, meetingId, traktandumId, null))
		});
	});
}
