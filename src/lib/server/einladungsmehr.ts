/**
 * Das Mehr aus der Einladung als Untergrenze, in der Datenbank (Migration 144).
 *
 * Die Regel steht im Kern (`$lib/domain/einladungsmehr`); hier wird
 * festgehalten, verworfen und an jedem Schreibweg des Erfordernisses geprüft.
 *
 * **Warum an der Schreibstelle und nicht an einer Route.** Das Mehr eines
 * Traktandums entsteht auf fünf Wegen (Entscheidbaum und Direktwahl über
 * `haltErfordernisAmTraktandumFest`, das gemeinsame Geschäft, das Nachziehen
 * nach einer Reglementsänderung, Vorlagen, Rückkommen). Drei davon greifen
 * nach der Freigabe noch. Eine Schranke an einer Route liesse die anderen
 * offen.
 */
import type postgres from 'postgres';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Id } from '$lib/domain/types';
import type { Versammlungszustand } from '$lib/domain/versammlung';
import type { Universalvariante } from '$lib/domain/ausnahmen';
import {
	folgeFuerEinladung,
	neuversandVermerkt,
	neuversandHinweis,
	saalhinweisNachMilderung,
	grenzeFuerFolgeantrag,
	untergrenzeBeiFreigabe,
	untergrenzeDesFolgeantrags,
	verlangeMehrDerEinladung,
	warntImSaal,
	verlangeMehrDerEinladungImFolgeantrag
} from '$lib/domain/einladungsmehr';
import { versandfrist } from '$lib/domain/einberufungsfrist';
import type { Enthaltungseinstellung, Reglementsregel } from '$lib/domain/reglement';
import { holeRegelwerk } from '$lib/rules';
import { kalendertag } from '$lib/domain/datum';
import { erfordernisInWorten } from '$lib/domain/auszaehlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/fehler';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
// Derselbe Tag, den die Vorbereitungsseite beim Vermerk anzeigt.
import { hiesigerTag } from './versandvermerk';
import { erfordernisAusZeile, type ErfordernisSpalten } from './erfordernisspalten';
import { holeLesartenIn } from './lesarten';

/** Heute in hiesiger Zeit, wie überall im Haus (`versandvermerk.ts`). */
function heute(): string {
	return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

/**
 * Wie ein Traktandum in Absage und Hinweis heisst, etwa «3 Fassadensanierung».
 * Exportiert für die Absage am Abend (`absageAmAbend` in `geschaeft.ts`), die
 * genau diesen Vorsatz wieder abschneidet.
 */
export function bezeichnung(z: { title: string; nummer: string | null }): string {
	return z.nummer ? `${z.nummer} ${z.title}` : z.title;
}

/**
 * Das angekündigte Traktandum eines Folgeantrags und dessen Untergrenze, über
 * seine Vorfahren (`untergrenzeDesFolgeantrags`, Produktentscheid 06.10.2026,
 * «Ja, dieselbe Untergrenze»), oder `null`.
 *
 * **Die Tiefe ist begrenzt**, weil die Datenbank einen Kreis über `parent_id`
 * nicht ausschliesst und die Abfrage sonst nicht endete. Angelegt wird ein
 * Folgeantrag immer direkt unter einem angekündigten Traktandum
 * (`hindernisAlsGrundantrag`), und `verschiebeTraktandum` lässt ihn seinen
 * Elternteil nicht wechseln (einen Kreis weist dort schon `verschiebe` in
 * `traktandenbaum.ts` ab); zehn Stufen reichen weit darüber hinaus. **Ein
 * Kreis oder eine längere Kette endet still ohne Untergrenze**: Die Suche
 * erreicht dann kein angekündigtes Traktandum.
 */
async function untergrenzeUeberVorfahren(
	tx: postgres.TransactionSql,
	traktandumId: Id
): Promise<{ untergrenze: Erfordernis | null; grundantrag: string } | null> {
	const kette = await tx<
		{
			is_spontaneous: boolean;
			spontaneous_kind: string | null;
			released_requirement: Erfordernis | null;
			title: string;
			nummer: string | null;
		}[]
	>`
		WITH RECURSIVE vorfahren AS (
			SELECT p.id, p.parent_id, 1 AS tiefe
			  FROM agenda_item a JOIN agenda_item p ON p.id = a.parent_id
			 WHERE a.id = ${traktandumId}
			UNION ALL
			SELECT p.id, p.parent_id, v.tiefe + 1
			  FROM vorfahren v JOIN agenda_item p ON p.id = v.parent_id
			 WHERE v.tiefe < 10
		)
		SELECT a.is_spontaneous, a.spontaneous_kind, a.released_requirement, a.title,
		       coalesce(a.manual_number, a.released_number) AS nummer
		  FROM vorfahren v JOIN agenda_item a ON a.id = v.id
		 ORDER BY v.tiefe
	`;
	return untergrenzeDesFolgeantrags(
		kette.map((z) => ({
			spontan: z.is_spontaneous,
			spontanart: z.spontaneous_kind,
			untergrenze: z.released_requirement,
			bezeichnung: bezeichnung(z)
		}))
	);
}

/**
 * Hält bei der Freigabe fest, welches Mehr die Einladung je Traktandum nennt.
 *
 * Aufgerufen in derselben Transaktion wie `schreibeFreigabenummern`, aus
 * demselben Grund: Was ab hier in der Einladung steht, gehört zur
 * Momentaufnahme.
 */
export async function schreibeEinladungsmehr(
	tx: postgres.TransactionSql,
	traktanden: { id: Id; art: string; erfordernis: Erfordernis | null | undefined }[]
): Promise<void> {
	for (const t of traktanden) {
		const u = untergrenzeBeiFreigabe(t.art, t.erfordernis);
		await tx`
			UPDATE agenda_item
			   SET released_requirement = ${u ? tx.json(u as never) : null},
			       released_requirement_relaxed_at = NULL,
			       released_requirement_before = NULL
			 WHERE id = ${t.id}
		`;
	}
}

/**
 * Bei der Rücknahme: Die Untergrenzen verfallen, der Versandvermerk fällt
 * zurück, und der Merker der Erinnerung wird frei.
 *
 * **Produktentscheid 06.10.2026** («Nein, Neuversand verlangen»): Nach Rücknahme
 * und neuer Freigabe vergleicht Votum nicht mit der früheren Einladung. Die
 * neue Freigabe ist eine neue Einladung, und die muss an alle; der Vermerk
 * fällt deshalb zurück, damit Fristwarnung und Hinweis sie verlangen. Die
 * Untergrenze ist danach das Mehr der neuen Einladung. Ein Vergleich mit der
 * früheren hätte an der Kennung des Traktandums gehangen, und Löschen und neu
 * Anlegen im Entwurf hätte ihn umgangen (Codeprüfung, dritter Blick).
 */
export async function loescheEinladungsmehrBeiRuecknahme(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	meetingId: Id
): Promise<void> {
	await tx`
		UPDATE agenda_item
		   SET released_requirement = NULL, released_requirement_relaxed_at = NULL,
		       released_requirement_before = NULL
		 WHERE meeting_id = ${meetingId}
		   AND (released_requirement IS NOT NULL OR released_requirement_relaxed_at IS NOT NULL
		        OR released_requirement_before IS NOT NULL)
	`;
	const zurueck = await tx`
		UPDATE meeting
		   SET invitation_sent_marked_at = NULL, invitation_sent_marked_by = NULL,
		       invitation_reminder_token_hash = NULL
		 WHERE id = ${meetingId} AND invitation_sent_marked_at IS NOT NULL
		RETURNING id
	`;
	/*
	 * **Die Marke fällt bei jeder Rücknahme, auch ohne Vermerk** (Codeprüfung
	 * M1, 06.10.2026; wie bei der Milderung in `achteEinladungsmehr`). Sonst
	 * überlebte der Link einer früheren Erinnerung die Rücknahme und vermerkte
	 * nach der neuen Freigabe den Versand einer Einladung, von der seine Mail
	 * nichts wusste.
	 *
	 * **Und der Merker der Erinnerung mit ihr** (Produktentscheid 06.10.2026,
	 * «Rücknahme setzt den Merker zurück»). Die neue Freigabe ist eine neue
	 * Einladung, und an deren Versand soll wieder erinnert werden, auch wenn
	 * vor der Rücknahme schon eine Erinnerung kam. Dazu gehört, dass «Einladung
	 * erzeugt» nur seit der letzten Rücknahme zählt (Produktentscheid
	 * 06.10.2026, «Seit Rücknahme zählen»; `vermerkt_seit_ruecknahme`,
	 * Migration 147); sonst hielte das Ereignis von vorher die Erinnerung
	 * trotz leerem Merker zurück.
	 *
	 * Damit schliesst sich auch das Fenster «Rücknahme während des
	 * Mailversands»: `legeMarkeAb` in `versandvermerk.ts` legt die Marke einer
	 * gerade verschickten Erinnerung nur ab, wenn der Merker noch so dasteht,
	 * wie der Dienst ihn beansprucht hat. Nach einer Rücknahme ist er leer
	 * (oder schon neu beansprucht), und der Link der laufenden Mail gilt nicht.
	 */
	await tx`
		UPDATE meeting
		   SET invitation_reminder_token_hash = NULL,
		       invitation_reminder_sent_at = NULL,
		       invitation_reminder_kind = NULL
		 WHERE id = ${meetingId}
		   AND (invitation_reminder_token_hash IS NOT NULL
		        OR invitation_reminder_sent_at IS NOT NULL
		        OR invitation_reminder_kind IS NOT NULL)
	`;
	if (zurueck.length > 0) {
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einladungVersandVermerkt,
				{ art: 'meeting', id: meetingId },
				{ gesetzt: false, weg: 'ruecknahme' }
			)
		);
	}
}

/**
 * Prüft ein neues Erfordernis gegen das Mehr der Einladung, bevor es
 * geschrieben wird.
 *
 * Wirft im Saal, wenn das neue Mehr milder ist. Vor Beginn senkt es die
 * Untergrenze, nimmt den Versandvermerk zurück und schreibt den Verlauf; wird
 * vor dem neuen Versand zurückgestellt, kehrt die Untergrenze zurück.
 *
 * **Ausstehend** ist eine Milderung, solange nach ihr kein Versand vermerkt
 * ist. Nur dann gibt es den Rückweg: Ist die berichtigte Einladung hinaus,
 * nennt sie das mildere Mehr, und das ist die Untergrenze.
 *
 * **Die Zeile der Versammlung wird gesperrt**, wo eine Untergrenze besteht:
 * Sonst könnte eine Eröffnung zwischen Prüfung und Schreiben fallen, und die
 * Milderung, die vor Beginn zulässig war, stünde danach im Saal.
 */
export async function achteEinladungsmehr(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	traktandumId: Id,
	neu: Erfordernis
): Promise<void> {
	/*
	 * **Erst die Versammlung sperren, dann die Zeile lesen** (Codeprüfung
	 * 06.10.2026). Las die Prüfung das Traktandum vor der Sperre, verglich sie
	 * nach einer dazwischen gefallenen Eröffnung oder Milderung gegen einen
	 * veralteten Stand. Die Versammlung des Traktandums ändert sich nie.
	 */
	/*
	 * **Sperrfolge: erst das Traktandum, dann die Versammlung** (Codeprüfung,
	 * dritter Blick). Dieselbe Folge wie beim Öffnen einer Abstimmung und beim
	 * Beschluss von Hand, die das Traktandum zuerst sperren; in umgekehrter
	 * Folge verklemmten sich die Wege, nachgestellt mit «deadlock detected».
	 * Die Versammlung nur, wo eine Untergrenze besteht: Im Entwurf gibt es
	 * keine, und dort hätte die Sperre gleichzeitige Vorlagen und Geschäfte
	 * gegeneinander verklemmt. Ein Eröffnen, das die Versammlung schon hält,
	 * kann mit dieser Prüfung verklemmen; dann bricht eine der beiden ab, und
	 * es bleibt kein falscher Stand.
	 */
	const [zuordnung] = await tx<
		{ meeting_id: string; mit: boolean; spontaneous_kind: string | null; title: string; nummer: string | null }[]
	>`
		SELECT meeting_id, released_requirement IS NOT NULL AS mit, spontaneous_kind, title,
		       coalesce(manual_number, released_number) AS nummer
		  FROM agenda_item WHERE id = ${traktandumId}
		   FOR UPDATE
	`;
	if (!zuordnung) return;
	if (!zuordnung.mit) {
		/*
		 * **Der Folgeantrag hält die Untergrenze seines angekündigten
		 * Traktandums** (Produktentscheid 06.10.2026, «Ja, dieselbe
		 * Untergrenze»). Er trägt selbst nie ein festgehaltenes Mehr: Er
		 * entsteht erst im Saal, nach der Freigabe.
		 *
		 * **Ohne Sperre auf die Versammlung und ohne Schreiben.** Folgeanträge
		 * gibt es nur ab «laufend» (`nimmTraktandumAuf`), und ab der Eröffnung
		 * hält die Sperre aus Migration 144 die Untergrenze des Vorfahren fest.
		 * Zwischen Lesen und Schreiben kann sie sich also nicht bewegen, und es
		 * gibt weder Senken noch Rückweg noch Versandvermerk.
		 */
		if (zuordnung.spontaneous_kind === 'folgeantrag') {
			const u = await untergrenzeUeberVorfahren(tx, traktandumId);
			if (u) {
				verlangeMehrDerEinladungImFolgeantrag(neu, u.untergrenze, bezeichnung(zuordnung), u.grundantrag);
			}
		}
		return;
	}
	await tx`SELECT id FROM meeting WHERE id = ${zuordnung.meeting_id} FOR UPDATE`;

	const [t] = await tx<
		{
			meeting_id: string;
			title: string;
			nummer: string | null;
			released_requirement: Erfordernis | null;
			released_requirement_before: Erfordernis | null;
			released_requirement_relaxed_at: Date | null;
		}[]
	>`
		SELECT meeting_id, title, coalesce(manual_number, released_number) AS nummer,
		       released_requirement, released_requirement_before, released_requirement_relaxed_at
		  FROM agenda_item WHERE id = ${traktandumId}
	`;
	if (!t?.released_requirement) return;

	const [m] = await tx<
		{
			state: string;
			meeting_date: Date | string;
			invitation_lead_days: number | null;
			invitation_sent_marked_at: Date | null;
			relax_after_invitation_deadline: boolean;
		}[]
	>`
		SELECT m.state, m.meeting_date, s.invitation_lead_days, m.invitation_sent_marked_at,
		       s.relax_after_invitation_deadline
		  FROM meeting m JOIN stweg s ON s.id = m.stweg_id
		 WHERE m.id = ${t.meeting_id}
	`;
	if (!m) return;

	/*
	 * **Ausstehend nach derselben Bedingung wie Hinweis und Erinnerung**
	 * (`neuversandVermerkt`): Solange nach der Milderung kein Haken gesetzt ist,
	 * bleibt der Rückweg offen, den der Hinweis anbietet. Seit dem
	 * Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») zählt dafür
	 * jeder Haken nach der Milderung; bis dahin hielt ein Haken nach dem letzten
	 * Fristtag den Rückweg offen.
	 */
	const frist = versandfrist(kalendertag(m.meeting_date), m.invitation_lead_days);
	const gemildertAm = t.released_requirement_relaxed_at;
	const vermerkt = m.invitation_sent_marked_at;
	const ausstehend = gemildertAm !== null && !neuversandVermerkt({ vermerkt, gemildertAm });
	const vorher = ausstehend ? t.released_requirement_before : null;

	const folge = folgeFuerEinladung({
		gedruckt: t.released_requirement,
		vorher,
		neu,
		zustand: m.state as Versammlungszustand,
		heute: heute(),
		versandfrist: frist,
		traktandum: bezeichnung(t),
		milderungNachFristZulassen: m.relax_after_invitation_deadline
	});
	if (folge.art === 'frei') return;

	if (folge.art === 'zurueck') {
		await tx`
			UPDATE agenda_item
			   SET released_requirement = released_requirement_before,
			       released_requirement_before = NULL,
			       released_requirement_relaxed_at = NULL
			 WHERE id = ${traktandumId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einladungsmehrZurueckgestellt,
				{ art: 'agenda_item', id: traktandumId },
				{ traktandum: t.title, einladungNennt: erfordernisInWorten(vorher!), neu: erfordernisInWorten(neu) }
			)
		);
		return;
	}

	// Die Einladung, die draussen ist: vor einer ersten Milderung die
	// Untergrenze, bei einer weiteren das Mehr vor der ersten.
	const einladung = vorher ?? t.released_requirement;
	/*
	 * **`clock_timestamp()`, nicht `now()`** (Codeprüfung M1, Korrekturrunde
	 * 06.10.2026). `now()` ist der Beginn der Transaktion, also womöglich vor
	 * der Sperre oben. Wartete diese Milderung auf einen Erinnerungslauf, der die
	 * Zeile hielt, läge ihr Zeitpunkt vor dessen Merker, und die Erinnerung zur
	 * Milderung bliebe aus («schon erinnert»). Nach der Sperre gemessen liegt sie
	 * hinter jedem Merker und jedem Vermerk, die vorher festgeschrieben wurden.
	 * Ein Vermerk, der während der Sperre wartet, trägt den Beginn seiner
	 * Transaktion und zählt damit als vor der Milderung; das ist die vorsichtige
	 * Richtung, denn gesetzt wurde er, bevor die Milderung zu sehen war.
	 */
	await tx`
		UPDATE agenda_item
		   SET released_requirement = ${tx.json(neu as never)},
		       released_requirement_before = ${tx.json(einladung as never)},
		       released_requirement_relaxed_at = clock_timestamp()
		 WHERE id = ${traktandumId}
	`;

	/*
	 * **Was schon als verschickt vermerkt ist, wird vorher abgeschlossen**
	 * (Fachprüfung 06.10.2026, dritter Durchgang, zu T7). Der Vermerk gilt für
	 * die ganze Versammlung. Fiele er zurück, ohne dass die anderen Milderungen
	 * erledigt sind, nach denen er gesetzt war, stünden diese wieder im Hinweis
	 * und in der Erinnerung, obwohl ihre Berichtigung draussen ist. Bis
	 * 07.10.2026 fielen sie zudem beim Eröffnen auf die Einladung davor zurück.
	 * Beim Entfernen des Hakens von Hand bleibt es dagegen beim Wortlaut auf der
	 * Seite: Dann zählt erst ein neuer Haken.
	 */
	if (vermerkt) {
		const andere = await tx<
			{ id: string; released_requirement_relaxed_at: Date }[]
		>`
			SELECT id, released_requirement_relaxed_at FROM agenda_item
			 WHERE meeting_id = ${t.meeting_id} AND id <> ${traktandumId}
			   AND released_requirement_before IS NOT NULL
		`;
		for (const z of andere) {
			if (neuversandVermerkt({ vermerkt, gemildertAm: z.released_requirement_relaxed_at })) {
				await tx`UPDATE agenda_item SET released_requirement_before = NULL WHERE id = ${z.id}`;
			}
		}
	}

	/*
	 * **Der Versandvermerk fällt zurück**, wie beim Entfernen in der Anwendung
	 * (`vermerkeVersand`): Wer ihn danach wieder setzt, sagt, die berichtigte
	 * Einladung sei hinaus. Das bleibt nach dem Produktentscheid 07.10.2026
	 * (Punkt 2a); der Haken steuert seither nur noch Hinweis, Erinnerung und
	 * Verlauf, nicht mehr das Mehr im Saal. Die Marke aus einer früheren Erinnerungsmail wird
	 * dabei verbraucht, sonst bestätigte ihr Link den alten Versand.
	 */
	const zurueck = await tx`
		UPDATE meeting
		   SET invitation_sent_marked_at = NULL,
		       invitation_sent_marked_by = NULL,
		       invitation_reminder_token_hash = NULL
		 WHERE id = ${t.meeting_id}
		   AND invitation_sent_marked_at IS NOT NULL
		RETURNING id
	`;
	/*
	 * **Die Marke fällt bei jeder Milderung, auch ohne Vermerk** (Sicherheits-
	 * prüfung, Korrekturrunde 06.10.2026). Sonst bestätigte der Link aus einer
	 * Erinnerung von vor der Milderung, die bisher unbenutzt blieb, nachher die
	 * berichtigte Einladung, obwohl seine Mail von ihr nichts wusste.
	 */
	await tx`
		UPDATE meeting SET invitation_reminder_token_hash = NULL
		 WHERE id = ${t.meeting_id} AND invitation_reminder_token_hash IS NOT NULL
	`;

	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			EREIGNISARTEN.einladungsmehrGemildert,
			{ art: 'agenda_item', id: traktandumId },
			{
				traktandum: t.title,
				einladungNennt: erfordernisInWorten(einladung),
				// Dasselbe als Vergleichsmass, im Verlauf nicht angezeigt
				// (`NUR_ZUM_RECHNEN`). Beim Eröffnen gelesen, wenn eine spätere
				// Milderung eines anderen Traktandums `released_requirement_before`
				// geleert hat (Codeprüfung Block A, zweite Runde, M1).
				einladungDavorMass: einladung,
				neu: erfordernisInWorten(neu),
				versandvermerkZurueckgenommen: zurueck.length > 0
			}
		)
	);
}

/**
 * Beim Eröffnen: Für jede Milderung nach der Freigabe hält der Verlauf fest,
 * welches Mehr jetzt gilt, was die Einladung davor nannte und ob danach der
 * Haken gesetzt war; die Spalte mit dem Mehr davor wird geleert.
 *
 * **Kein Rückfall mehr** (Produktentscheid 07.10.2026, «Nur noch aufmerksam
 * machen», Punkt 4a). Bis 07.10.2026 fiel hier eine Milderung ohne
 * rechtzeitig vermerkten Neuversand auf die erste Einladung zurück
 * (Produktentscheid 06.10.2026, «Erste Einladung gilt», damit zurückgenommen).
 * Jetzt bleibt das mildere Mehr die Untergrenze, und der Verlaufseintrag trägt
 * die Angaben, aus denen die Leitung im Saal ihre Warnung liest
 * (`holeSaalhinweiseNachMilderung`). Ins Protokoll geht nichts.
 *
 * Aufgerufen in `eroeffneVersammlung`, **bevor** der Zustand auf «laufend»
 * geht: Danach lässt die Sperre aus Migration 144 die Spalten nicht mehr
 * bewegen. `released_requirement` und `released_requirement_relaxed_at`
 * bleiben stehen; der Zeitpunkt der Milderung ist die Spur, an der die Warnung
 * im Saal hängt.
 *
 * **Das Mehr der Einladung davor** steht in `released_requirement_before`.
 * Der Haken leert es nicht; geleert wird es durch die Milderung eines anderen
 * Traktandums nach dem Haken (`achteEinladungsmehr`), den Rückweg, die
 * Rücknahme der Freigabe und hier beim Eröffnen. Im ersten Fall nennt es der
 * letzte Verlaufseintrag der Milderung, in Worten (`einladungNennt`) und als
 * Vergleichsmass (`einladungDavorMass`, Codeprüfung Block A, zweite Runde,
 * M1). Ohne das Mass warnte der Saal dort immer, auch bei strengerem Mehr.
 *
 * **Ob nach der Milderung der Haken gesetzt war**: zuerst der Vermerk, wie er
 * jetzt steht. Eine spätere Milderung eines anderen Traktandums nimmt ihn
 * zurück und schliesst dabei diese ab (`released_requirement_before` leer);
 * dann zählt der letzte Verlaufseintrag zum Vermerk nach der Milderung, wenn
 * er «gesetzt» sagt. Ohne das stünde im Saal «kein Versand vermerkt» bei
 * einem Traktandum, dessen Berichtigung als verschickt vermerkt war.
 * **Der letzte, nicht der erste** (Codeprüfung Block A, 07.10.2026): Nach
 * Entfernen und Neusetzen nannte der erste Eintrag einen zu frühen Tag, und
 * nach einem Entfernen von Hand einen Haken, den es nicht mehr gab. Die
 * Rücknahme durch die Milderung schreibt keinen Vermerk-Eintrag, das Entfernen
 * von Hand und die Rücknahme der Freigabe schon («gesetzt: false»).
 *
 * **Für jede Milderung ein Eintrag, auch wenn das Traktandum beim Eröffnen
 * wieder strenger steht** (Produktentscheid 07.10.2026, «Die Warnung rechnet
 * im Saal laufend nach»). Die Leitung kann im Saal bis auf die Untergrenze
 * zurückgehen, also auf das mildere Mehr; ob gewarnt wird, entscheidet deshalb
 * erst die Ladefunktion im Saal (`holeSaalhinweiseNachMilderung`). Der Eintrag
 * hält dafür das Mehr der Einladung davor als festes Vergleichsmass fest
 * (`einladungDavorMass`, im Verlauf nicht angezeigt). «Mehr beim Eröffnen»
 * (`mehrJetzt`) ist das Mehr, das das Traktandum beim Eröffnen trägt
 * (`erfordernisAusZeile`), nicht die Untergrenze (Codeprüfung Block A).
 * Zwischen der Codeprüfung und diesem Entscheid wurde der Eintrag nur
 * geschrieben, wenn das Traktandum beim Eröffnen milder stand.
 */
export async function regleEinladungsmehrBeimEroeffnen(
	tx: postgres.TransactionSql,
	handelnder: Handelnder,
	meetingId: Id
): Promise<void> {
	const zeilen = await tx<
		(ErfordernisSpalten & {
			id: string;
			title: string;
			released_requirement_before: Erfordernis | null;
			released_requirement_relaxed_at: Date;
			invitation_sent_marked_at: Date | null;
			einladung_nennt: string | null;
			einladung_mass: Erfordernis | null;
			haken_seit: Date | null;
		})[]
	>`
		SELECT a.*, a.released_requirement_before, a.released_requirement_relaxed_at,
		       m.invitation_sent_marked_at,
		       (SELECT e.detail->>'einladungNennt' FROM audit_entry e
		         WHERE e.subject_type = 'agenda_item' AND e.subject_id = a.id::text
		           AND e.event_type = ${EREIGNISARTEN.einladungsmehrGemildert}
		         ORDER BY e.id DESC LIMIT 1) AS einladung_nennt,
		       (SELECT e.detail->'einladungDavorMass' FROM audit_entry e
		         WHERE e.subject_type = 'agenda_item' AND e.subject_id = a.id::text
		           AND e.event_type = ${EREIGNISARTEN.einladungsmehrGemildert}
		         ORDER BY e.id DESC LIMIT 1) AS einladung_mass,
		       (SELECT CASE WHEN e.detail->>'gesetzt' = 'true' THEN e.occurred_at END
		          FROM audit_entry e
		         WHERE e.subject_type = 'meeting' AND e.subject_id = a.meeting_id::text
		           AND e.event_type = ${EREIGNISARTEN.einladungVersandVermerkt}
		           AND e.occurred_at >= a.released_requirement_relaxed_at
		         ORDER BY e.id DESC LIMIT 1) AS haken_seit
		  FROM agenda_item a
		  JOIN meeting m ON m.id = a.meeting_id
		 WHERE a.meeting_id = ${meetingId}
		   AND a.released_requirement_relaxed_at IS NOT NULL
		 ORDER BY a.position
	`;
	for (const z of zeilen) {
		const jetzt = neuversandVermerkt({
			vermerkt: z.invitation_sent_marked_at,
			gemildertAm: z.released_requirement_relaxed_at
		});
		const vermerkt = jetzt
			? z.invitation_sent_marked_at
			: z.released_requirement_before === null
				? z.haken_seit
				: null;
		const nachDerMilderung = vermerkt !== null;
		const mehr = erfordernisAusZeile(z);
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.einladungsmehrBeimEroeffnen,
				{ art: 'agenda_item', id: z.id },
				{
					traktandum: z.title,
					mehrJetzt: mehr ? erfordernisInWorten(mehr) : null,
					einladungDavor: z.released_requirement_before
						? erfordernisInWorten(z.released_requirement_before)
						: z.einladung_nennt,
					// Das feste Vergleichsmass für die Warnung im Saal; im Verlauf
					// nicht angezeigt, die Worte stehen in `einladungDavor`.
					einladungDavorMass: z.released_requirement_before ?? z.einladung_mass,
					gemildertAm: hiesigerTag(z.released_requirement_relaxed_at),
					versandVermerkt: nachDerMilderung,
					vermerktAm: nachDerMilderung && vermerkt ? hiesigerTag(vermerkt) : null
				}
			)
		);
		if (z.released_requirement_before) {
			await tx`UPDATE agenda_item SET released_requirement_before = NULL WHERE id = ${z.id}`;
		}
	}
}

/** Verlangt beim Öffnen einer Abstimmung, dass ihr Mehr die Untergrenze hält. */
export async function verlangeEinladungsmehrBeimAbstimmen(
	tx: postgres.TransactionSql,
	traktandumId: Id,
	mehr: Erfordernis | null | undefined
): Promise<void> {
	const [t] = await tx<
		{
			title: string;
			nummer: string | null;
			released_requirement: Erfordernis | null;
			spontaneous_kind: string | null;
		}[]
	>`
		SELECT title, coalesce(manual_number, released_number) AS nummer, released_requirement,
		       spontaneous_kind
		  FROM agenda_item WHERE id = ${traktandumId}
	`;
	if (!t) return;
	// Der Folgeantrag misst sich an seinem angekündigten Traktandum
	// (`achteEinladungsmehr`). Hier fängt die Prüfung jedes Mehr, das an der
	// Schreibstelle vorbei an ihn kam.
	if (!t.released_requirement && t.spontaneous_kind === 'folgeantrag') {
		const u = await untergrenzeUeberVorfahren(tx, traktandumId);
		if (u) verlangeMehrDerEinladungImFolgeantrag(mehr, u.untergrenze, bezeichnung(t), u.grundantrag);
		return;
	}
	// Bis 07.10.2026 las die Prüfung hier aus dem Verlauf, ob beim Eröffnen
	// zurückgefallen wurde, und sagte dann anders ab. Den Rückfall gibt es seit
	// dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») nicht mehr.
	verlangeMehrDerEinladung(mehr, t.released_requirement, bezeichnung(t));
}

/**
 * Der Hinweis auf der Vorbereitungsseite, solange nach einer Milderung kein
 * Versand vermerkt ist (`neuversandVermerkt`).
 *
 * **Jeder Haken nach der Milderung beendet ihn** (Produktentscheid 07.10.2026,
 * «Nur noch aufmerksam machen»). Vom 06.10.2026 (Laienprüfung, dritter
 * Durchgang, T10) bis 07.10.2026 blieb er nach einem Haken nach dem letzten
 * Fristtag stehen, weil das Eröffnen dann auf die bisherige Einladung
 * zurückfiel. Den Rückfall gibt es nicht mehr.
 */
export async function holeNeuversandHinweis(operatorId: Id, meetingId: Id): Promise<string | null> {
	const lage = await offeneMilderungen(operatorId, meetingId);
	if (!lage) return null;
	return neuversandHinweis(
		lage.offen.map((traktandum) => ({ traktandum })),
		{ versandfrist: lage.frist, heute: heute() }
	);
}

/**
 * Für den Kasten auf der Versammlungsseite (Produktentscheid 06.10.2026,
 * «Verweis auf der Übersicht»): wie viele Traktanden eine berichtigte Einladung
 * brauchen und ob ihr letzter Tag vorbei ist, oder `null`, wenn keine aussteht.
 * Dieselbe Rechnung wie der Hinweis, aus derselben Abfrage.
 */
export async function holeNeuversandLage(
	operatorId: Id,
	meetingId: Id
): Promise<{ anzahl: number; fristVorbei: boolean } | null> {
	const lage = await offeneMilderungen(operatorId, meetingId);
	if (!lage || lage.offen.length === 0) return null;
	return { anzahl: lage.offen.length, fristVorbei: lage.frist !== null && heute() > lage.frist };
}

/** Die Traktanden, nach deren Milderung kein Versand vermerkt ist (`neuversandVermerkt`), und der letzte Fristtag. */
async function offeneMilderungen(
	operatorId: Id,
	meetingId: Id
): Promise<{ offen: string[]; frist: string | null } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				title: string;
				nummer: string | null;
				released_requirement_relaxed_at: Date;
				invitation_sent_marked_at: Date | null;
				meeting_date: Date | string;
				invitation_lead_days: number | null;
			}[]
		>`
			SELECT a.title, coalesce(a.manual_number, a.released_number) AS nummer,
			       a.released_requirement_relaxed_at, m.invitation_sent_marked_at,
			       m.meeting_date, s.invitation_lead_days
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s ON s.id = m.stweg_id
			 WHERE a.meeting_id = ${meetingId}
			   AND m.state = 'freigegeben'
			   AND a.released_requirement_before IS NOT NULL
			 ORDER BY a.position
		`;
		if (zeilen.length === 0) return null;
		const frist = versandfrist(kalendertag(zeilen[0].meeting_date), zeilen[0].invitation_lead_days);
		const offen = zeilen.filter(
			(z) =>
				!neuversandVermerkt({
					vermerkt: z.invitation_sent_marked_at,
					gemildertAm: z.released_requirement_relaxed_at
				})
		);
		return { offen: offen.map((z) => bezeichnung(z)), frist };
	});
}

/**
 * Das Mehr, das die Einladung für ein Traktandum nennt, in Worten, oder
 * `null` ohne Untergrenze. Für die Erfordernisseite, damit die Leitung die
 * Untergrenze vor dem Setzen sieht und nicht erst in der Absage.
 *
 * **Bei ausstehender Milderung die Einladung davor** (Codeprüfung, zweiter
 * Durchgang): Die Untergrenze ist dann schon das mildere Mehr, verschickt ist
 * aber womöglich noch das strengere, und dorthin führt der Rückweg. Bis
 * 07.10.2026 galt dieses ohne rechtzeitigen Vermerk auch beim Eröffnen; seit
 * dem Produktentscheid 07.10.2026 («Nur noch aufmerksam machen») nicht mehr.
 *
 * **Beim Folgeantrag das Mehr seines angekündigten Traktandums**, samt dessen
 * Bezeichnung in `grundantrag` (Produktentscheid 06.10.2026, «Ja, dieselbe
 * Untergrenze»). War dort bei der Freigabe keines eingestellt, ist `worte`
 * `null` und `grundantrag` trotzdem gesetzt, damit die Seite sagen kann,
 * worauf sich der Folgeantrag stützt. Am angekündigten Traktandum selbst ist
 * `grundantrag` `null`.
 */
export async function holeEinladungsmehrInWorten(
	operatorId: Id,
	traktandumId: Id
): Promise<{ worte: string | null; grundantrag: string | null; gemildert: boolean } | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<
			{
				released_requirement: Erfordernis | null;
				released_requirement_before: Erfordernis | null;
				released_requirement_relaxed_at: Date | null;
				invitation_sent_marked_at: Date | null;
				spontaneous_kind: string | null;
			}[]
		>`
			SELECT a.released_requirement, a.released_requirement_before,
			       a.released_requirement_relaxed_at, m.invitation_sent_marked_at,
			       a.spontaneous_kind
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE a.id = ${traktandumId}
		`;
		if (!z) return null;
		if (!z.released_requirement) {
			if (z.spontaneous_kind !== 'folgeantrag') return null;
			const u = await untergrenzeUeberVorfahren(tx, traktandumId);
			if (!u) return null;
			return {
				worte: u.untergrenze ? erfordernisInWorten(u.untergrenze) : null,
				grundantrag: u.grundantrag,
				gemildert: false
			};
		}
		const ausstehend =
			z.released_requirement_before !== null &&
			z.released_requirement_relaxed_at !== null &&
			!neuversandVermerkt({
				vermerkt: z.invitation_sent_marked_at,
				gemildertAm: z.released_requirement_relaxed_at
			});
		return {
			worte: erfordernisInWorten(ausstehend ? z.released_requirement_before! : z.released_requirement),
			grundantrag: null,
			// Für den Satz zum Zurückstellen auf der Erfordernisseite.
			gemildert: ausstehend
		};
	});
}

/** Die Untergrenze eines Grundantrags, wie das Aufnahmeformular sie braucht. */
export interface Folgeantragsgrenze {
	/** Das Mehr der Einladung in Worten. */
	worte: string;
	/** Die wählbaren Knoten, die unter dieser Untergrenze abgewiesen würden. */
	zuMild: string[];
	/** Ob das Mehr, das der Grundantrag jetzt trägt, die Untergrenze nicht hält. */
	geerbtZuMild: boolean;
}

/**
 * Nur, wo ein Einladungsmehr festgehalten ist, ohne Reglement und Vergleich.
 * Für die Saalfassung des Zirkulationshinweises auf der Traktandenseite
 * (`mehrhinweise`, `mehrFest`), wie sie die Leitungsseiten aus
 * `holeEinladungsmehrJeTraktandum` lesen (Featureprüfung Block 3, 18.10.2026).
 */
export async function holeTraktandenMitEinladungsmehr(operatorId: Id, meetingId: Id): Promise<Set<Id>> {
	const zeilen = await alsBetreiber(operatorId, (tx) =>
		tx<{ id: string }[]>`
			SELECT id FROM agenda_item
			 WHERE meeting_id = ${meetingId} AND released_requirement IS NOT NULL
		`
	);
	return new Set(zeilen.map((z) => z.id));
}

/**
 * Das festgehaltene Mehr der Einladung je Traktandum einer Versammlung, samt
 * dem, was unter ihm für einen Folgeantrag zu mild wäre; nur Traktanden, die
 * eines tragen.
 *
 * Für das Aufnahmeformular im Saal (Codeprüfung 1 und Fachprüfung FP-3,
 * zweite Runde M1 und FP2-10 vom 06.10.2026): Wer einen Folgeantrag aufnimmt,
 * sieht die Untergrenze seines Grundantrags und ob das gewählte Mehr sie hält,
 * vor dem Absenden und nicht erst im Hinweis danach. Eine Abfrage je
 * Versammlung; die Rechnung steht im Kern (`grenzeFuerFolgeantrag`).
 *
 * **Reglement und jetziges Mehr kommen vom Aufrufer.** Beide Leitungsseiten
 * haben sie schon geladen, und die Reglementsregeln hier zu lesen hiesse,
 * `reglement.ts` einzubinden, das über `erfordernisse.ts` wieder hierher
 * führt.
 */
export async function holeEinladungsmehrJeTraktandum(
	operatorId: Id,
	meetingId: Id,
	lage: {
		regeln: Reglementsregel[];
		enthaltung: Enthaltungseinstellung | null;
		traktanden: { knoten: { id: Id; erfordernis?: Erfordernis | null } }[];
	}
): Promise<Map<Id, Folgeantragsgrenze>> {
	const { zeilen, lesarten } = await alsBetreiber(operatorId, async (tx) => ({
		zeilen: await tx<{ id: string; released_requirement: Erfordernis }[]>`
			SELECT id, released_requirement FROM agenda_item
			 WHERE meeting_id = ${meetingId} AND released_requirement IS NOT NULL
		`,
		// Die eingefrorene Lesart, wie beim Setzen im Saal (Migration 169).
		lesarten: await holeLesartenIn(tx, { meetingId })
	}));
	const rw = holeRegelwerk();
	const jetzt = new Map(lage.traktanden.map((t) => [t.knoten.id, t.knoten.erfordernis ?? null]));
	return new Map(
		zeilen.map((z) => [
			z.id,
			{
				worte: erfordernisInWorten(z.released_requirement),
				...grenzeFuerFolgeantrag(
					z.released_requirement,
					jetzt.get(z.id),
					rw,
					lage.regeln,
					lage.enthaltung,
					lesarten
				)
			}
		])
	);
}

/**
 * Die stehenden Warnungen im Saal, je Traktandum einer laufenden Versammlung,
 * dessen Mehr nach der Freigabe milder gestellt wurde (Produktentscheid
 * 07.10.2026, «Nur noch aufmerksam machen», Punkt 4a). Für beide
 * Leitungsseiten, die sie über den Baustein `Eingriffe` zeigen.
 *
 * **Bei jedem Laden neu gerechnet** (Produktentscheid 07.10.2026, «Die
 * Warnung rechnet im Saal laufend nach»): das Mehr, das das Traktandum jetzt
 * trägt, gegen das Mehr der Einladung davor aus dem Eintrag (`warntImSaal`).
 * Stellt die Leitung im Saal strenger, verschwindet die Warnung; stellt sie
 * wieder auf das mildere Mehr, erscheint sie.
 *
 * **Aus dem Verlaufseintrag beim Eröffnen** (`einladungsmehrBeimEroeffnen`),
 * weil die Spalte mit dem Mehr davor dann leer ist und der Vermerk sich im Saal
 * nicht mehr bewegt. Fehlt der Eintrag, etwa bei einer Versammlung, die vor
 * Migration 148 eröffnet wurde, gibt es keine Warnung und keinen Fehler.
 *
 * **Die Einstellung zur Universalversammlung aus der Momentaufnahme**
 * (`snapshot.universal_meeting_mode`, Migration 127; Produktentscheid
 * 07.10.2026 zu Fassung 2). Dieselbe Quelle wie die Universalversammlung im
 * Saal (`leseEinstellungIn` in `universal.ts`): Im Saal gilt, was bei der
 * Freigabe galt, nicht eine spätere Änderung an der Gemeinschaft. Ohne
 * Momentaufnahme die Vorgabe «persoenlich», die sichere Lesart; im Saal gibt es
 * sie immer, weil die Freigabe sie schreibt.
 */
export async function holeSaalhinweiseNachMilderung(
	operatorId: Id,
	meetingId: Id
): Promise<Map<Id, string>> {
	const zeilen = await alsBetreiber(operatorId, (tx) =>
		tx<
			(ErfordernisSpalten & {
				id: string;
				detail: {
					einladungDavor?: string | null;
					einladungDavorMass?: Erfordernis | null;
					vermerktAm?: string | null;
				};
				universalvariante: Universalvariante;
				leitungsvollmachten_zaehlen: boolean;
			})[]
		>`
			SELECT a.*, e.detail,
			       COALESCE(s.universal_meeting_mode, 'persoenlich') AS universalvariante,
			       -- Wie leseEinstellungIn in universal.ts (Schlussprüfung, Codeprüfung, 07.10.2026).
			       COALESCE(s.universal_chair_proxies_count, false) AS leitungsvollmachten_zaehlen
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  LEFT JOIN snapshot s ON s.meeting_id = m.id
			  JOIN LATERAL (
			        SELECT detail FROM audit_entry
			         WHERE subject_type = 'agenda_item' AND subject_id = a.id::text
			           AND event_type = ${EREIGNISARTEN.einladungsmehrBeimEroeffnen}
			         ORDER BY id DESC LIMIT 1
			       ) e ON true
			 WHERE a.meeting_id = ${meetingId}
			   AND m.state = 'laufend'
			   AND a.released_requirement_relaxed_at IS NOT NULL
		`
	);
	return new Map(
		zeilen
			.filter((z) => warntImSaal(erfordernisAusZeile(z), z.detail.einladungDavorMass ?? null))
			.map((z) => [
				z.id,
				saalhinweisNachMilderung({
					einladungDavor: z.detail.einladungDavor ?? null,
					vermerktAm: z.detail.vermerktAm ?? null,
					universalvariante: z.universalvariante,
					leitungsvollmachtenZaehlen: z.leitungsvollmachten_zaehlen
				})
			])
	);
}

/** Die beiden Werte des Formulars auf der Seite «Reglement und Quoren». */
const MILDERUNG_NACH_FRIST = { nicht: false, zulassen: true } as const;

/** Wie die Einstellung im Verlauf heisst: in Worten statt «ja» und «nein». */
function milderungNachFristInWorten(zulassen: boolean): string {
	return zulassen ? 'zulassen, mit Hinweis' : 'nicht zulassen';
}

/**
 * Die Einstellung «Mehr nach Ablauf der Einberufungsfrist milder stellen»
 * (Migration 148, Produktentscheid 07.10.2026; Begründung der Vorgabe bei
 * `folgeFuerEinladung`).
 *
 * **Ein eigener Schreibweg**, aus demselben Grund wie `speichereNeuabstimmung`:
 * Die Spalte hängt an `stweg`, und das Angabenformular der Gemeinschaft
 * schreibt dieselbe Zeile ohne sie. Rechte wie die Nachbareinstellungen: der
 * Betreiber über den Zeilenschutz (`alsBetreiber`), eine fremde Gemeinschaft
 * findet die Abfrage nicht.
 */
export async function speichereMilderungNachFrist(
	handelnder: Handelnder,
	stwegId: Id,
	wert: unknown
): Promise<boolean> {
	if (typeof wert !== 'string' || !Object.hasOwn(MILDERUNG_NACH_FRIST, wert)) {
		throw new FachlicherFehler(
			'milderung_nach_frist_unbekannt',
			'Wählen Sie, ob ein milderes Mehr nach Ablauf der Frist zugelassen wird.',
			'milderungNachFrist'
		);
	}
	const zulassen = MILDERUNG_NACH_FRIST[wert as keyof typeof MILDERUNG_NACH_FRIST];
	const operatorId = handelnder.operatorId as string;

	return alsBetreiber(operatorId, async (tx) => {
		const [vorher] = await tx<{ relax_after_invitation_deadline: boolean }[]>`
			SELECT relax_after_invitation_deadline FROM stweg WHERE id = ${stwegId} FOR UPDATE
		`;
		if (!vorher) {
			throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		}
		await tx`
			UPDATE stweg SET relax_after_invitation_deadline = ${zulassen} WHERE id = ${stwegId}
		`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.milderungNachFristGesetzt, { art: 'stweg', id: stwegId }, {
				vorher: milderungNachFristInWorten(vorher.relax_after_invitation_deadline),
				neu: milderungNachFristInWorten(zulassen)
			})
		);
		return zulassen;
	});
}
