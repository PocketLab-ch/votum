/**
 * Das Vorbereitungspaket: eine vorbereitete Versammlung auf ein anderes Gerät
 * bringen (Produktentscheid 18.09.2026).
 *
 * **Anders als das Abschlusspaket, und zwar im Zweck.** Jenes ist ein Nachweis:
 * offene Formate, für Menschen lesbar, nie wieder zu Zeilen. Dieses ist eine
 * Übertragung: Zeilen, die auf dem anderen Gerät wieder Zeilen werden, mit
 * denselben Kennungen. Nur so passt das Abschlusspaket nachher zurück auf seine
 * eigene `meeting`-Zeile.
 *
 * **Deshalb Tabellen und keine Ansichten.** Die Lesefunktionen der Anwendung
 * liefern aufbereitete Sichten; die taugen zum Anzeigen und nicht zum
 * Wiedereinsetzen. Hier wird gelesen, was in den Tabellen steht.
 *
 * **Die Mandantengrenze ist die eigentliche Gefahr**, nicht ein Angreifer. Eine
 * Abfrage, die `operator_id` vergisst, zöge fremde Zeilen ins Paket, und
 * niemand sähe es. Zwei Dinge dagegen: Der ganze Export läuft in einer
 * Transaktion unter `alsBetreiber`, der Zeilenschutz greift also auf jede
 * Abfrage. Und `tests/db/vorbereitungspaket.test.ts` legt einen zweiten
 * Betreiber daneben und durchsucht das fertige Paket nach dessen Kennungen.
 * Ohne diese Gegenprobe wäre die Zusicherung eine Behauptung.
 *
 * **Was nicht mitreist** (Vorgabe des Auftraggebers, 18.09.2026): Briefkopf und
 * Betreiberangaben, die Einstellungen zu äusseren Diensten, die Historie der
 * Gemeinschaft. Nur was der Abend braucht. Die Folge ist bekannt und
 * hingenommen: Was im Saal gedruckt wird, trägt keinen Kopf.
 *
 * Entwurf: `docs/plan-notebook-und-protokollzustellung-2026-09-18.md`.
 */
import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { lies } from './dateien';
import { dosZeitstempel, packe } from '$lib/domain/archiv';
import { verschluessleFuerGeraet } from './saalgeraet';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';

/** Ein Bestandteil des Pakets, wie beim Abschlusspaket. */
interface Bestandteil {
	pfad: string;
	inhalt: Uint8Array;
	beschreibung: string;
}

export interface Manifesteintrag {
	pfad: string;
	groesse: number;
	pruefsumme: string;
	beschreibung: string;
}

export interface Vorbereitungsmanifest {
	fassung: number;
	art: 'vorbereitung';
	/** Die Kennung dieser einen Ausleihe. Daran erkennt die Rückgabe sie wieder. */
	abgabe: string;
	/** Wohin zurückzugeben ist. Leer, wenn die Instanz keine feste Adresse kennt. */
	herkunft: string | null;
	erzeugtAm: string;
	gemeinschaft: { kennung: string; name: string };
	versammlung: { kennung: string; datum: string; uhrzeit: string; ort: string };
	/**
	 * Der Schemastand beider Geräte muss gleich sein.
	 *
	 * Das Paket trägt Zeilen, keine Bildschirme. Fehlt dem anderen Gerät eine
	 * Spalte, die hier gefüllt ist, bricht das Einspielen; hat es eine mehr, die
	 * dort Pflicht ist, bricht es ebenso. Beides fiele sonst erst im Saal auf.
	 * Die Prüfsumme deckt auch den Fall, dass eine mittlere Migration fehlt,
	 * während die letzte übereinstimmt.
	 */
	schema: { stand: string; anzahl: number; pruefsumme: string };
	eintraege: Manifesteintrag[];
}

export interface ErzeugtesPaket {
	/**
	 * Das verschlüsselte Archiv, so wie es abgelegt und übertragen wird.
	 *
	 * Verschlüsselt für den öffentlichen Schlüssel des Zielgeräts: Es gibt
	 * keinen Schlüssel zum Mitgeben und keinen zum Verlieren.
	 */
	inhalt: Uint8Array;
	manifest: Vorbereitungsmanifest;
}

function sha256(inhalt: Uint8Array | string): string {
	return createHash('sha256').update(inhalt).digest('hex');
}

function alsJson(wert: unknown): Uint8Array {
	return new TextEncoder().encode(JSON.stringify(wert, null, '\t'));
}

/**
 * Die Tabellen, die mitreisen, **in der Reihenfolge, in der sie eingesetzt
 * werden müssen**. Ein Elternteil steht vor seinem Kind; wer die Reihenfolge
 * ändert, bricht das Einspielen auf dem anderen Gerät.
 *
 * Die Filter stehen hier ausgeschrieben statt in einer Maschinerie aus
 * dynamischem SQL. Das ist länger und dafür lesbar: Wer prüfen will, ob eine
 * Abfrage die Gemeinschaft verlässt, sieht es in derselben Zeile.
 */
async function trageZusammen(
	tx: postgres.TransactionSql,
	stwegId: Id,
	meetingId: Id
): Promise<{ bestandteile: Bestandteil[]; anhaenge: { pruefsumme: string; name: string }[] }> {
	/*
	 * `readonly unknown[]`, weil postgres.js keine gewöhnliche Liste liefert,
	 * sondern eine mit Zusatzangaben. Hier wird ohnehin nur gezählt und
	 * geschrieben.
	 */
	const zeilen = async (name: string, hole: () => Promise<readonly unknown[]>) => ({
		name,
		daten: await hole()
	});

	const tabellen = [
		await zeilen('stweg', () => tx`SELECT * FROM stweg WHERE id = ${stwegId}`),
		await zeilen('quota_kind', () => tx`SELECT * FROM quota_kind WHERE stweg_id = ${stwegId} ORDER BY sort_order`),
		await zeilen('unit', () => tx`SELECT * FROM unit WHERE stweg_id = ${stwegId} ORDER BY label`),
		await zeilen('party', () => tx`SELECT * FROM party WHERE stweg_id = ${stwegId} ORDER BY created_at`),
		await zeilen('unit_quota', () => tx`SELECT * FROM unit_quota WHERE stweg_id = ${stwegId}`),
		await zeilen('unit_ownership', () => tx`SELECT * FROM unit_ownership WHERE stweg_id = ${stwegId} ORDER BY valid_from`),
		await zeilen('usufruct', () => tx`SELECT * FROM usufruct WHERE stweg_id = ${stwegId}`),
		await zeilen('party_member', () => tx`SELECT * FROM party_member WHERE stweg_id = ${stwegId}`),
		await zeilen('representation', () => tx`SELECT * FROM representation WHERE stweg_id = ${stwegId}`),
		await zeilen('bylaw_quorum_rule', () => tx`SELECT * FROM bylaw_quorum_rule WHERE stweg_id = ${stwegId}`),
		await zeilen('bylaw_attendance_rule', () => tx`SELECT * FROM bylaw_attendance_rule WHERE stweg_id = ${stwegId}`),
		await zeilen('bylaw_instruction_rule', () => tx`SELECT * FROM bylaw_instruction_rule WHERE stweg_id = ${stwegId}`),
		await zeilen('agenda_template_order', () => tx`SELECT * FROM agenda_template_order WHERE stweg_id = ${stwegId} ORDER BY position`),

		await zeilen('meeting', () => tx`SELECT * FROM meeting WHERE id = ${meetingId}`),
		await zeilen('agenda_item', () => tx`SELECT * FROM agenda_item WHERE meeting_id = ${meetingId} ORDER BY position`),
		await zeilen('agenda_item_affected', () => tx`
			SELECT a.* FROM agenda_item_affected a
			  JOIN agenda_item i ON i.id = a.agenda_item_id
			 WHERE i.meeting_id = ${meetingId}`),
		await zeilen('agenda_item_proposer', () => tx`
			SELECT p.* FROM agenda_item_proposer p
			  JOIN agenda_item i ON i.id = p.agenda_item_id
			 WHERE i.meeting_id = ${meetingId}`),
		await zeilen('snapshot', () => tx`SELECT * FROM snapshot WHERE meeting_id = ${meetingId}`),
		await zeilen('snapshot_party', () => tx`SELECT * FROM snapshot_party WHERE meeting_id = ${meetingId}`),
		await zeilen('snapshot_unit', () => tx`SELECT * FROM snapshot_unit WHERE meeting_id = ${meetingId}`),
		await zeilen('proxy', () => tx`SELECT * FROM proxy WHERE meeting_id = ${meetingId}`),
		await zeilen('proxy_recommendation', () => tx`
			SELECT r.* FROM proxy_recommendation r
			  JOIN proxy p ON p.id = r.proxy_id
			 WHERE p.meeting_id = ${meetingId}`),
		await zeilen('instruction', () => tx`SELECT * FROM instruction WHERE meeting_id = ${meetingId}`),
		await zeilen('recusal', () => tx`SELECT * FROM recusal WHERE meeting_id = ${meetingId}`),
		await zeilen('meeting_access', () => tx`SELECT * FROM meeting_access WHERE meeting_id = ${meetingId}`)
	];

	/*
	 * **Die Unterlagen hängen an vier verschiedenen Gegenständen** (`attachment`
	 * kennt `subject_type`): an der Versammlung, am Traktandum, an einer
	 * Vollmacht und an einer Nutzniessung. Die letzte gehört der Gemeinschaft
	 * und nicht der Versammlung; sie reist trotzdem mit, weil der Nachweis im
	 * Saal gebraucht wird, wenn jemand eine Nutzniessung bestreitet.
	 */
	const anhangzeilen = await tx<
		{ id: string; checksum: string; original_name: string }[]
	>`
		SELECT * FROM attachment
		 WHERE (subject_type = 'meeting'     AND subject_id = ${meetingId})
		    OR (subject_type = 'agenda_item' AND subject_id IN (SELECT id FROM agenda_item WHERE meeting_id = ${meetingId}))
		    OR (subject_type = 'proxy'       AND subject_id IN (SELECT id FROM proxy       WHERE meeting_id = ${meetingId}))
		    OR (subject_type = 'usufruct'    AND subject_id IN (SELECT id FROM usufruct    WHERE stweg_id  = ${stwegId}))
	`;
	tabellen.push({ name: 'attachment', daten: anhangzeilen });

	/*
	 * **Etliche Verweise zeigen aus dem Paket hinaus, und das ist Absicht**
	 * (18.09.2026, aus dem Code-Review). Wer das Einspielen baut, stolpert sonst
	 * am ersten Fremdschlüssel. Die Regel ist eine einzige, sie gilt für alle:
	 *
	 * **Was nicht im Paket liegt, wird beim Einspielen geleert oder umgesetzt.**
	 * Das Paket ist der Abend, nicht das Haus. Alles, was darüber hinausweist,
	 * gehört zu einer Welt, die auf dem Notebook gar nicht existiert.
	 *
	 * Erhoben am 18.09.2026, damit E3 die Liste nicht selbst zusammensuchen muss:
	 *
	 *   * **In das gemeinsame Register:** `party.person_id`. Der Abend braucht es
	 *     nicht, der Name steht in `party.display_name`. Wird geleert.
	 *   * **Auf andere Versammlungen:** `meeting.previous_meeting_id`,
	 *     `agenda_item.copied_from_meeting_id`. Was daraus gebraucht wird, steht
	 *     im eingefrorenen Erfordernis am Traktandum. Werden geleert.
	 *   * **Auf andere Gemeinschaften:** `stweg.parent_stweg_id`,
	 *     `agenda_item.proposer_stweg_id`. Werden geleert.
	 *   * **Auf Benutzerkonten:** `proxy.created_by`, `proxy.confirmed_by`,
	 *     `proxy.ended_by`, `attachment.uploaded_by`. Die Konten dieser
	 *     Bewirtschaftung reisen ausdrücklich nicht mit; im Saal meldet sich die
	 *     Sitzungsleitung mit einem eigenen lokalen Konto an. Werden geleert, der
	 *     Name daneben bleibt lesbar.
	 *   * **Auf den Betreiber:** jedes `operator_id`. Es wird **nicht** geleert,
	 *     sondern auf den Betreiber des einspielenden Geräts gesetzt — sonst
	 *     griffe dort der Zeilenschutz nicht.
	 *
	 * Das gehört in denselben Block wie das Einspielen und ist dort als
	 * Vorbedingung vermerkt (`docs/plan-notebook-und-protokollzustellung-2026-09-18.md`).
	 */
	const bestandteile: Bestandteil[] = tabellen.map((t) => ({
		pfad: `daten/${t.name}.json`,
		inhalt: alsJson(t.daten),
		beschreibung: `Zeilen der Tabelle «${t.name}» (${t.daten.length}).`
	}));

	return {
		bestandteile,
		anhaenge: anhangzeilen.map((a) => ({ pruefsumme: a.checksum, name: a.original_name }))
	};
}

/** Der Stand der Migrationen, damit beide Geräte denselben haben. */
async function schemastand(
	tx: postgres.TransactionSql
): Promise<{ stand: string; anzahl: number; pruefsumme: string }> {
	const zeilen = await tx<{ name: string; checksum: string }[]>`
		SELECT name, checksum FROM schema_migration ORDER BY name
	`;
	return {
		stand: zeilen.at(-1)?.name ?? '',
		anzahl: zeilen.length,
		pruefsumme: sha256(zeilen.map((z) => `${z.name}:${z.checksum}`).join('\n'))
	};
}

/**
 * Erzeugt das verschlüsselte Vorbereitungspaket.
 *
 * Der Zeitpunkt kommt von aussen (AD-1): Auf dem Notebook kann die Uhr falsch
 * gehen, und im Manifest soll stehen, was diese Instanz für die Zeit hielt.
 */
export async function erzeugeVorbereitungspaket(
	operatorId: Id,
	meetingId: Id,
	angaben: { abgabeId: string; herkunft: string | null; jetzt: string; geraetSchluessel: string }
): Promise<ErzeugtesPaket> {
	/*
	 * **Ein fester Schnitt durch die Daten, nicht sechsundzwanzig Blicke**
	 * (18.09.2026, aus dem Code-Review). Postgres fährt vorgabemässig
	 * `READ COMMITTED`, und dort sieht **jede einzelne** Abfrage den Stand ihres
	 * eigenen Augenblicks. Der Export liest sechsundzwanzig Tabellen
	 * nacheinander; wer in dieser Zeit über den QR-Link eine Vollmacht erteilt,
	 * kann als Weisung ohne Vollmacht im Paket landen oder als Vollmacht ohne
	 * ihre Weisungen. Im Saal wäre das ein Widerspruch, den niemand mehr auflösen
	 * kann, weil die Quelle inzwischen gesperrt ist.
	 *
	 * **Die Stufe gehört an das `BEGIN`, nicht in die Transaktion.** Postgres
	 * nimmt `SET TRANSACTION ISOLATION LEVEL` nur vor der ersten Abfrage an, und
	 * `alsBetreiber` setzt zuerst den Mandantenkontext — als eigene Anweisung
	 * darin wäre sie also immer zu spät. Für einen reinen Leser kostet die Stufe
	 * nichts: Es gibt keine Schreibkonflikte, die zu einem Neuversuch zwängen.
	 */
	return alsBetreiber(operatorId, async (tx) => {
		const [versammlung] = await tx<
			{
				id: string;
				stweg_id: string;
				meeting_date: Date;
				start_time: string;
				location: string;
			}[]
		>`SELECT id, stweg_id, meeting_date, start_time, location FROM meeting WHERE id = ${meetingId}`;
		if (!versammlung) {
			throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		}

		const [gemeinschaft] = await tx<{ id: string; name: string }[]>`
			SELECT id, name FROM stweg WHERE id = ${versammlung.stweg_id}
		`;

		const { bestandteile, anhaenge } = await trageZusammen(tx, versammlung.stweg_id, meetingId);

		/*
		 * **Die Dateien im Original**, unter ihrer Prüfsumme (AD-17). Der Name aus
		 * der Datenbank steht im Manifest, nicht im Archiv: Wer ein Paket
		 * entpackt, soll keinen Pfad aus fremder Hand auf seine Platte bekommen.
		 */
		for (const a of anhaenge) {
			if (bestandteile.some((b) => b.pfad === `dateien/${a.pruefsumme}`)) continue;
			bestandteile.push({
				pfad: `dateien/${a.pruefsumme}`,
				inhalt: await lies(a.pruefsumme),
				beschreibung: `Unterlage «${a.name}» im Original.`
			});
		}

		const eintraege: Manifesteintrag[] = bestandteile.map((b) => ({
			pfad: b.pfad,
			groesse: b.inhalt.byteLength,
			pruefsumme: sha256(b.inhalt),
			beschreibung: b.beschreibung
		}));

		const manifest: Vorbereitungsmanifest = {
			fassung: 1,
			art: 'vorbereitung',
			abgabe: angaben.abgabeId,
			herkunft: angaben.herkunft,
			erzeugtAm: angaben.jetzt,
			gemeinschaft: { kennung: gemeinschaft.id, name: gemeinschaft.name },
			versammlung: {
				kennung: meetingId,
				datum: versammlung.meeting_date.toLocaleDateString('sv-SE'),
				uhrzeit: versammlung.start_time,
				ort: versammlung.location
			},
			schema: await schemastand(tx),
			eintraege
		};

		const archiv = packe(
			[
				{ name: 'manifest.json', inhalt: alsJson(manifest) },
				...bestandteile.map((b) => ({ name: b.pfad, inhalt: b.inhalt }))
			],
			dosZeitstempel(angaben.jetzt)
		);

		return { inhalt: verschluessleFuerGeraet(archiv, angaben.geraetSchluessel), manifest };
	}, 'repeatable read');
}
