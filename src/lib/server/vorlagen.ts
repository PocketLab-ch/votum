/**
 * Pflichttraktanden erzeugen und Traktanden übernehmen (Story 3.8).
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { holeRegelwerk } from '$lib/rules';
import { erfordernisAusKnoten, type Erfordernis } from '$lib/domain/entscheidbaum';
import { knotenVon } from '$lib/domain/regelwerk';
import { wendeReglementAn, type Enthaltungseinstellung } from '$lib/domain/reglement';
import {
	pruefeUebernahme,
	ordneVorlagen,
	vorlagenFuer,
	type Traktandumvorlage,
	type Uebernahmebefund,
	type Uebernahmequelle
} from '$lib/domain/traktandenvorlage';
import { zieheOrdnungNach } from './geschaeft';
import { holeFassungsabdruck } from './protokoll';
import { datumLang, kalendertag } from '$lib/domain/datum';
import {
	holeEnthaltungseinstellungIn,
	holeReglementsregelnIn,
	schreibeErfordernisIn,
	VERWALTUNGSKNOTEN,
	type Reglementsregeln
} from './erfordernisse';
import { verlangeZustand, type Versammlungsart } from '$lib/domain/versammlung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { holeReglementsregeln } from './reglement';
import type { Id } from '$lib/domain/types';
import type { Lesartenwahl } from '$lib/domain/lesarten';
import { holeLesartenIn } from './lesarten';

/**
 * Baut das Erfordernis zu einer Vorlage.
 *
 * Aus dem Regelwerk der geladenen Fassung, mit angewandter Reglementsabweichung
 * — genau wie bei einer Herleitung von Hand. Fehlt der Knoten in dieser Fassung,
 * entsteht kein Erfordernis: Das Traktandum bekommt dann den üblichen Hinweis,
 * statt still mit einem falschen Wert dazustehen.
 */
function erfordernisZurVorlage(
	vorlage: Traktandumvorlage,
	regeln: Reglementsregeln,
	einstellung: Enthaltungseinstellung | null,
	lesarten: Lesartenwahl
): Erfordernis | null {
	if (!vorlage.knotenId || vorlage.art !== 'abstimmung') return null;

	const rw = holeRegelwerk();
	const knoten = knotenVon(rw, vorlage.knotenId);
	if (!knoten) return null;

	return wendeReglementAn(erfordernisAusKnoten(rw, knoten), regeln, einstellung, lesarten).erfordernis;
}

/**
 * Die gespeicherte Ordnung einer Gemeinschaft, innerhalb einer laufenden
 * Transaktion gelesen (Block C2).
 *
 * Den drei Lesern hier gemeinsam: `null` (nichts gespeichert) ist die
 * häufigste Antwort und gilt als «Code-Reihenfolge».
 */
async function ordnungIn(
	tx: postgres.TransactionSql,
	stwegId: Id
): Promise<string[] | null> {
	const zeilen = await tx<{ template_key: string }[]>`
		SELECT template_key FROM agenda_template_order
		 WHERE stweg_id = ${stwegId}
		 ORDER BY position
	`;
	return zeilen.length > 0 ? zeilen.map((z) => z.template_key) : null;
}

/**
 * Legt die Pflichttraktanden einer neuen Versammlung an.
 *
 * Läuft in derselben Transaktion wie das Anlegen der Versammlung. Eine Vorlage,
 * die erst «angewandt» werden muss, wird beim ersten Mal vergessen — und dann
 * fehlt im Protokoll die Feststellung der Beschlussfähigkeit.
 *
 * bindung: meetingId — Der Aufrufer legt Versammlung und Gemeinschaft im
 *   selben Zug an; die Zuordnung entsteht dort, nicht hier.
 * bindung: stwegId — Der Aufrufer legt Versammlung und Gemeinschaft im selben
 *   Zug an; die Zuordnung entsteht dort, nicht hier.
 */
export async function legePflichttraktandenAn(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	stwegId: Id,
	art: Versammlungsart,
	/** Datum der neuen Versammlung — für die Suche nach der letzten davor. */
	datum: string | null = null
): Promise<number> {
	const regeln = await holeReglementsregelnIn(tx, stwegId);
	const enthaltung = await holeEnthaltungseinstellungIn(tx, stwegId);
	const lesarten = await holeLesartenIn(tx, { stwegId });
	// Die gespeicherte Ordnung der Gemeinschaft sortiert die Vorlagen (C2).
	// Für die ausserordentliche Versammlung gelten nur die zwei festen — die
	// Ordnung darf Jahresgeschäfte nennen, `ordneVorlagen` ignoriert, was in
	// der Vorlagenliste nicht vorkommt.
	const vorlagen = ordneVorlagen(vorlagenFuer(art), await ordnungIn(tx, stwegId));

	/*
	 * **Das Protokoll, das genehmigt werden soll, wird beim Namen genannt**
	 * (22.08.2026).
	 *
	 * «Das Protokoll der letzten Versammlung wird genehmigt» lässt offen, welcher
	 * Text gemeint ist — und ein Jahr später ist genau das die Frage. Steht die
	 * Prüfsumme im Antrag, bezeugt der **Beschluss der Versammlung**, welche
	 * Fassung gilt: gefasst von den Menschen, die im Streitfall Gegenpartei
	 * wären, und damit stärker als jede Bezeugung durch die Bewirtschaftung
	 * selbst.
	 *
	 * Fehlt eine festgehaltene Fassung — weil das Vorprotokoll noch nicht
	 * versandt ist —, bleibt der allgemeine Wortlaut stehen. Ein Antrag mit einer
	 * Lücke darin wäre schlimmer als einer ohne Prüfsumme.
	 */
	const vorprotokoll = datum
		? await abdruckDerLetztenVersammlung(tx, handelnder.operatorId, stwegId, meetingId, datum)
		: null;

	let position = 0;
	for (const v of vorlagen) {
		position++;
		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;

		const wortlaut =
			v.schluessel === 'protokoll' && vorprotokoll
				? `Das Protokoll der Versammlung vom ${datumLang(vorprotokoll.datum)} wird genehmigt. ` +
					`Genehmigt wird die Fassung mit der Prüfsumme ${vorprotokoll.abdruck} (SHA-256), ` +
					`festgehalten am ${datumLang(vorprotokoll.zeitpunkt.slice(0, 10))}.`
				: (v.antragswortlaut ?? null);

		// Die Rechtsgrundlage steht nur dort im Inhalt, wo kein Erfordernis sie
		// trägt — sonst stünde sie zweimal auf der Traktandenliste.
		const inhalt = v.knotenId ? null : (v.rechtsgrundlage ?? null);

		await tx`
			INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
			                         item_kind, body, summary, motion_text, proposer_kind,
			                         from_template)
			VALUES (${id}, ${handelnder.operatorId}, ${meetingId}, NULL, ${position}, ${v.titel},
			        ${v.art}, ${inhalt}, ${v.kurzfassung ?? null},
			        ${v.art === 'abstimmung' ? wortlaut : null},
			        ${v.antragstellerart}, true)
		`;

		const e = erfordernisZurVorlage(v, regeln, enthaltung, lesarten);
		if (e) await schreibeErfordernisIn(tx, handelnder, id, e);
	}

	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			EREIGNISARTEN.pflichttraktandenAngelegt,
			{ art: 'meeting', id: meetingId },
			{
				anzahl: vorlagen.length,
				versammlungsart: art,
				schluessel: vorlagen.map((v) => v.schluessel)
			}
		)
	);

	return vorlagen.length;
}

// ── Mustertraktanden an der gemeinsamen Versammlung ─────────────────────────

/**
 * Welche Mustertraktanden am Abend noch fehlen.
 *
 * Verglichen wird über den Titel, denn er ist es, was auf der Liste steht. Die
 * Vorlagenkennung steht nicht an der Zeile: Sie hätte sich mit dem ersten
 * Bearbeiten überlebt (dieselbe Begründung wie beim Entfernen, `traktanden.ts`).
 */
export async function fehlendeMuster(
	operatorId: Id,
	tagId: Id
): Promise<{ art: Versammlungsart; fehlen: Traktandumvorlage[] }> {
	return alsBetreiber(operatorId, async (tx) => {
		const [tag] = await tx<{ kind: Versammlungsart }[]>`
			SELECT kind FROM meeting_day WHERE id = ${tagId}
		`;
		if (!tag) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'id');

		const da = await tx<{ title: string }[]>`
			SELECT title FROM business WHERE meeting_day_id = ${tagId}
		`;
		const vorhanden = new Set(da.map((z) => z.title.trim().toLocaleLowerCase('de-CH')));

		return {
			art: tag.kind,
			fehlen: vorlagenFuer(tag.kind).filter(
				(v) => !vorhanden.has(v.titel.trim().toLocaleLowerCase('de-CH'))
			)
		};
	});
}

/**
 * Legt fehlende Mustertraktanden als Geschäfte des Abends an (Auftraggeber, 11.08.2026:
 * «Auch können dort die Mustertraktanden übernommen werden … bei der
 * Sammelversammlung»).
 *
 * **Als Geschäft, nicht je Haus.** Genau daher kam der Bruch: Die
 * Pflichttraktanden entstehen beim Anlegen jeder einzelnen Versammlung und
 * kannten den Abend nicht. Hier entstehen sie einmal und tragen in jedem Haus
 * dieselbe Nummer.
 *
 * **Das Erfordernis wird je Gemeinschaft hergeleitet.** Eine Reglementsabweichung
 * gilt für ein Haus, nicht für den Abend: Wo das Reglement für Jahresgeschäfte
 * etwas anderes vorsieht, muss dort auch etwas anderes stehen.
 */
export async function uebernimmMuster(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	schluessel: string[]
): Promise<{ traktanden: number; haeuser: number; titel: string[] }> {
	const { fehlen } = await fehlendeMuster(handelnder.operatorId, tagId);
	const gewaehlt = fehlen.filter((v) => schluessel.includes(v.schluessel));
	if (gewaehlt.length === 0) {
		throw new FachlicherFehler(
			'nichts_gewaehlt',
			'Wählen Sie, welche Mustertraktanden aufgenommen werden sollen.',
			'schluessel'
		);
	}

	const ergebnis = await alsBetreiber(handelnder.operatorId, async (tx) => {
		// Nur was noch nicht eröffnet ist — dieselbe Schranke wie beim Anlegen
		// eines Geschäfts von Hand.
		const haeuser = await tx<{ id: string; stweg_id: string }[]>`
			SELECT m.id, m.stweg_id FROM meeting m
			 WHERE m.meeting_day_id = ${tagId} AND m.state IN ('entwurf', 'freigegeben')
			 ORDER BY m.day_position NULLS LAST
		`;
		if (haeuser.length === 0) {
			throw new FachlicherFehler(
				'keine_versammlung',
				'Keine Versammlung dieses Abends ist noch offen für Traktanden.',
				'schluessel'
			);
		}

		// Die Reglementsregeln je Gemeinschaft, einmal geholt statt je Vorlage.
		const regeln = new Map<string, Reglementsregeln>();
		const enthaltungen = new Map<string, Enthaltungseinstellung | null>();
		for (const h of haeuser) {
			if (!regeln.has(h.stweg_id)) {
				regeln.set(h.stweg_id, await holeReglementsregelnIn(tx, h.stweg_id));
				enthaltungen.set(h.stweg_id, await holeEnthaltungseinstellungIn(tx, h.stweg_id));
			}
		}

		/*
		 * **Die Ordnung jedes Hauses sortiert seine eigenen Zeilen** (C2). Die
		 * Geschäftsliste des Abends behält die Reihenfolge der gewählten
		 * Vorlagen — sie ist dieselbe für alle Häuser, und die Häuser können
		 * verschiedene Ordnungen gespeichert haben. Jedes Haus bekommt seine
		 * Vorlagen deshalb in **seiner** Ordnung an seine Positionen gehängt.
		 */
		const ordnungen = new Map<string, string[] | null>();
		for (const h of haeuser) {
			if (!ordnungen.has(h.stweg_id)) {
				ordnungen.set(h.stweg_id, await ordnungIn(tx, h.stweg_id));
			}
		}

		const [{ stelle }] = await tx<{ stelle: number }[]>`
			SELECT coalesce(max(position), -1) + 1 AS stelle FROM business WHERE meeting_day_id = ${tagId}
		`;

		/*
		 * **Zwei Schritte statt verschachtelter Loops** (C2). Die Geschäfte des
		 * Abends entstehen in der Reihenfolge der gewählten Vorlagen — dieselbe
		 * Liste für alle Häuser. Danach bekommt jedes Haus seine Zeilen in
		 * **seiner** Ordnung; gefunden wird das zugehörige Geschäft über den
		 * Vorlagenschlüssel. Vorher hing `business_id` am äusseren Loop und
		 * wäre für die zweite Ordnungsstelle das falsche gewesen.
		 */
		const geschaeftJeSchluessel = new Map<string, string>();
		let n = Number(stelle);
		for (const v of gewaehlt) {
			const wortlaut = v.art === 'abstimmung' ? (v.antragswortlaut ?? null) : null;
			const inhalt = v.knotenId ? null : (v.rechtsgrundlage ?? null);

			const [g] = await tx<{ id: string }[]>`
				INSERT INTO business (operator_id, meeting_day_id, title, motion_text, body, item_kind,
				                      position)
				VALUES (${handelnder.operatorId}, ${tagId}, ${v.titel}, ${wortlaut}, ${inhalt},
				        ${v.art}, ${n})
				RETURNING id
			`;
			geschaeftJeSchluessel.set(v.schluessel, g.id);
			n++;
		}

		let traktanden = 0;
		for (const h of haeuser) {
			const imHaus = ordneVorlagen(gewaehlt, ordnungen.get(h.stweg_id) ?? null);
			for (const w of imHaus) {
				const geschaeft = geschaeftJeSchluessel.get(w.schluessel);
				if (!geschaeft) {
					// Unerreichbar, solange `w` aus `gewaehlt` stammt — laut statt
					// still, damit ein künftiger Bruch nicht als `business_id = NULL`
					// in die Traktandenliste gerät.
					throw new FachlicherFehler(
						'geschaeft_fehlt',
						`Für «${w.titel}» fehlt das Geschäft des Abends.`,
						'schluessel'
					);
				}
				const [{ pos }] = await tx<{ pos: number }[]>`
					SELECT coalesce(max(position), -1) + 1 AS pos FROM agenda_item
					 WHERE meeting_id = ${h.id} AND parent_id IS NULL
				`;
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
					                         item_kind, body, summary, motion_text, proposer_kind,
					                         from_template, business_id)
					VALUES (${id}, ${handelnder.operatorId}, ${h.id}, NULL, ${Number(pos)}, ${w.titel},
					        ${w.art}, ${w.knotenId ? null : (w.rechtsgrundlage ?? null)},
					        ${w.kurzfassung ?? null},
					        ${w.art === 'abstimmung' ? (w.antragswortlaut ?? null) : null},
					        ${w.antragstellerart}, true, ${geschaeft})
				`;

				const e = erfordernisZurVorlage(
					w,
					regeln.get(h.stweg_id)!,
					enthaltungen.get(h.stweg_id) ?? null,
					await holeLesartenIn(tx, { meetingId: h.id })
				);
				if (e) await schreibeErfordernisIn(tx, handelnder, id, e);
				traktanden++;
			}
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.pflichttraktandenAngelegt,
				{ art: 'meeting_day', id: tagId },
				{
					anzahl: gewaehlt.length,
					haeuser: haeuser.length,
					schluessel: gewaehlt.map((v) => v.schluessel)
				}
			)
		);

		return { traktanden, haeuser: haeuser.length, titel: gewaehlt.map((v) => v.titel) };
	});

	await zieheOrdnungNach(handelnder, tagId);
	return ergebnis;
}

// ── Übernahme aus einer früheren Versammlung ────────────────────────────────

export interface Uebernahmeangebot {
	versammlungId: Id;
	datum: string;
	art: Versammlungsart;
	traktanden: Uebernahmebefund[];
}

/**
 * Was sich aus früheren Versammlungen derselben Gemeinschaft übernehmen lässt.
 *
 * Einzeln wählbar, nicht alles oder nichts: Aus einer Vorjahresversammlung
 * interessieren meist ein oder zwei Geschäfte, und wer alle übernimmt, räumt
 * danach zehn wieder weg.
 *
 * **Spontanes steht nicht im Angebot** (Produktentscheid 02.10.2026, «Ja,
 * weglassen»): Ein Rückkommen oder ein Folgeantrag gehört zum Ablauf der
 * Versammlung, in der er entstanden ist, und ein übernommenes Rückkommen trüge
 * den leeren Knoten, an dem die Reglementseite wirft. Wer den Punkt wieder
 * will, legt ihn neu an. Dasselbe gilt für die Übernahme selbst, und dort als
 * Absage.
 */
export async function holeUebernahmeangebote(
	operatorId: Id,
	meetingId: Id,
	hoechstens = 5
): Promise<Uebernahmeangebot[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const [ziel] = await tx<{ stweg_id: string; meeting_date: Date }[]>`
			SELECT stweg_id, meeting_date FROM meeting WHERE id = ${meetingId}
		`;
		if (!ziel) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');

		// Die Begrenzung zählt nur Versammlungen, die tatsächlich etwas anbieten.
		// Zählte sie alle, verdrängten Versammlungen mit lauter Pflichttraktanden
		// die brauchbaren aus der Liste — und wer «aus dem Vorjahr übernehmen»
		// wollte, sähe nach zwei Jahren Betrieb nichts mehr.
		const fruehere = await tx<{ id: string; meeting_date: Date; kind: Versammlungsart }[]>`
			SELECT m.id, m.meeting_date, m.kind FROM meeting m
			WHERE m.stweg_id = ${ziel.stweg_id}
			  AND m.id <> ${meetingId}
			  AND m.meeting_date <= ${ziel.meeting_date}
			  AND EXISTS (
				SELECT 1 FROM agenda_item a
				WHERE a.meeting_id = m.id AND a.from_template = false
				  -- Ein Angebot ohne Übernehmbares zählt nicht (02.10.2026):
				  -- Versammlungen, deren einzige eigenen Traktanden spontan
				  -- entstanden sind, verdrängen sonst die brauchbaren aus der Liste.
				  AND a.is_spontaneous = false
			  )
			ORDER BY m.meeting_date DESC
			LIMIT ${hoechstens}
		`;

		const aktuelleFassung = holeRegelwerk().fassung;
		const angebote: Uebernahmeangebot[] = [];

		for (const f of fruehere) {
			const zeilen = await tx<
				{
					id: string;
					title: string;
					item_kind: 'abstimmung' | 'kenntnisnahme';
					body: string | null;
					summary: string | null;
					motion_text: string | null;
					proposer_kind: string;
					requirement_version: string | null;
					requirement_title: string | null;
					position: number;
					anhaenge: number;
					from_template: boolean;
				}[]
			>`
				SELECT a.id, a.title, a.item_kind, a.body, a.summary, a.motion_text, a.proposer_kind,
				       a.requirement_version, a.requirement_title, a.position, a.from_template,
				       (SELECT count(*)::int FROM attachment t
				        WHERE t.subject_type = 'agenda_item' AND t.subject_id = a.id) AS anhaenge
				FROM agenda_item a
				WHERE a.meeting_id = ${f.id}
				  -- Kein Spontanes anbieten (Produktentscheid 02.10.2026 «Ja,
				  -- weglassen»): Was im Saal entstanden ist, gehört zum
				  -- Ablauf jener Versammlung, und ein so übernommenes Rückkommen
				  -- trägt den leeren Knoten, an dem die Reglementseite wirft.
				  AND a.is_spontaneous = false
				ORDER BY a.position
			`;

			const traktanden = zeilen
				// Pflichttraktanden nicht anbieten: Sie entstehen in der neuen
				// Versammlung ohnehin, und übernommen stünden sie doppelt.
				.filter((z) => !z.from_template)
				.map((z) => {
					const quelle: Uebernahmequelle = {
						traktandumId: z.id,
						nummer: String(z.position),
						titel: z.title,
						art: z.item_kind,
						inhalt: z.body ?? undefined,
						kurzfassung: z.summary ?? undefined,
						antragswortlaut: z.motion_text ?? undefined,
						antragstellerart: z.proposer_kind as never,
						erfordernisFassung: z.requirement_version ?? undefined,
						erfordernisTitel: z.requirement_title ?? undefined,
						hatAnhaenge: Number(z.anhaenge) > 0,
						// Beschlüsse gibt es erst ab Epic 5; bis dahin gibt es nichts,
						// was zurückbleiben könnte.
						hatBeschluss: false
					};
					return pruefeUebernahme(quelle, aktuelleFassung);
				});

			if (traktanden.length > 0) {
				angebote.push({
					versammlungId: f.id,
					datum: kalendertag(f.meeting_date),
					art: f.kind,
					traktanden
				});
			}
		}

		return angebote;
	});
}

/**
 * Kopiert **ein** Traktandum in eine andere Versammlung — Spalte für Spalte.
 *
 * Das Erfordernis wandert samt Fassungskennung mit. Es neu herzuleiten wäre
 * die stille Änderung, die hier gerade nicht geschehen soll (AD-4).
 *
 * **Die beiden Nebentabellen kommen mit.** `agenda_item_affected` trägt die
 * betroffenen Eigentümer — an ihnen hängt `requirement_needs_affected_consent`,
 * und die Auszählung liest sie beim Schliessen des Durchgangs
 * (`abstimmung.ts`). Bliebe die Liste leer, rechnete die Kopie ohne die
 * Zustimmung, die das Erfordernis verlangt. `agenda_item_proposer` trägt die
 * Namen bei «mehrere Eigentümer»; ohne sie stünde auf der Liste ein Antrag
 * ohne Antragsteller.
 *
 * Was **nicht** mitkommt: Anhänge (eine Offerte von damals ist nicht mehr
 * gültig), der Zustand aus dem Saal (Durchgänge, Protokolltext, Rückzug) und
 * die Kennzeichen `is_spontaneous` / `spontaneous_kind` / `reconsiders_item_id`
 * — sie beziehen sich auf einen Ablauf, der in der Zielversammlung nicht
 * stattgefunden hat. **Spontanes kommt gar nicht erst an**: `uebernimmTraktanden`
 * weist seine Kennung ab, und das Angebot führt es nicht. **Seit Lauf 5
 * (07.11.2026, M-2) auch das Häkchen nicht, wenn das kopierte Erfordernis auf
 * einem der drei Verwaltungsknoten steht** (Wahl, erweiterte Wahl, Abberufung):
 * Die Kombination entsteht von Hand nur nach der Freigabe (Entscheid 8), und
 * die Kopie läge in einer Versammlung im Entwurf, in dem die Absage sie nicht
 * zulässt.
 *
 * **Auch der Vorab-Vermerk nicht** (Migration 124), und nicht, wer im Saal
 * eingetragen hat: Eine vorab schriftlich erteilte Zustimmung gilt dem Antrag
 * in dieser Versammlung. Ob sie für die Zielversammlung weiter gilt, ist eine
 * Frage an die Betroffene, nicht an die Kopie; die Leitung vermerkt sie dort
 * neu. Die Betroffenen selbst kommen mit, wie oben begründet.
 */
async function kopiereTraktandumIn(
	tx: postgres.TransactionSql,
	operatorId: Id,
	quelleId: Id,
	meetingId: Id,
	parentId: Id | null,
	position: number
): Promise<Id> {
	const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;

	/*
	 * M-2 (Lauf 5, 07.11.2026): Das Häkchen kommt nicht mit, wenn das kopierte
	 * Erfordernis auf einem der drei Verwaltungsknoten steht. Die Kombination
	 * entsteht von Hand nur nach der Freigabe (Entscheid 8), und die Kopie
	 * landet in einer Versammlung im Entwurf, in dem die Absage sie gar nicht
	 * zulässt; über die Kopie liesse sie sich einschmuggeln. Der Knoten wird
	 * in JavaScript gegen denselben Satz geprüft, aus dem die Absage liest,
	 * nicht in SQL ein zweites Mal aufgeschrieben.
	 */
	const [quelle] = await tx<{ concerns_management: boolean; requirement_node: string | null }[]>`
		SELECT concerns_management, requirement_node FROM agenda_item WHERE id = ${quelleId}
	`;
	const haekchen =
		quelle?.concerns_management === true &&
		!(quelle.requirement_node && VERWALTUNGSKNOTEN.has(quelle.requirement_node));

	await tx`
		INSERT INTO agenda_item (
			id, operator_id, meeting_id, parent_id, position, title, item_kind, body, summary,
			motion_text, proposer_kind, proposer_party_id, proposer_stweg_id, proposer_name,
			requirement_version, requirement_branch, requirement_node, requirement_type,
			requirement_title, requirement_legal_basis, requirement_head_base,
			requirement_quota_base, requirement_head_numerator, requirement_head_denominator,
			requirement_head_mode, requirement_quota_numerator, requirement_quota_denominator,
			requirement_quota_mode, requirement_business_kind,
			requirement_needs_affected_consent, requirement_source, requirement_reason,
			requirement_risk, requirement_reference, requirement_path,
			requirement_abstention_counts, requirement_affected_consent_form, requirement_reading,
			-- «requirement_reading_reconsidered» ist hier immer NULL: Gesetzt wird sie
			-- nur am Rückkommen, und Rückkommen sind spontan, die beide Aufrufer nicht
			-- kopieren. Mitgenommen wird sie nur, damit die Kopie nicht von der Quelle
			-- abweicht (Featureprüfung F4c, G2).
			requirement_statutory, requirement_reading_reconsidered, requirement_rule_secured,
			copied_from_meeting_id, concerns_management
		)
		SELECT ${id}, ${operatorId}, ${meetingId}, ${parentId}, ${position}, a.title,
		       a.item_kind, a.body, a.summary, a.motion_text, a.proposer_kind,
		       a.proposer_party_id, a.proposer_stweg_id, a.proposer_name,
		       a.requirement_version, a.requirement_branch, a.requirement_node,
		       a.requirement_type, a.requirement_title, a.requirement_legal_basis,
		       a.requirement_head_base, a.requirement_quota_base,
		       a.requirement_head_numerator, a.requirement_head_denominator,
		       a.requirement_head_mode, a.requirement_quota_numerator,
		       a.requirement_quota_denominator, a.requirement_quota_mode,
		       a.requirement_business_kind, a.requirement_needs_affected_consent,
		       a.requirement_source, a.requirement_reason, a.requirement_risk,
		       a.requirement_reference, a.requirement_path,
		       a.requirement_abstention_counts, a.requirement_affected_consent_form, a.requirement_reading,
		       -- Das Häkchen zum Satz an der Karte (Migration 198) wie das Mehr; die Freigabe
		       -- der neuen Versammlung vergleicht es mit der Regel von heute.
		       a.requirement_statutory, a.requirement_reading_reconsidered, a.requirement_rule_secured,
		       a.meeting_id, ${haekchen}
		FROM agenda_item a WHERE a.id = ${quelleId}
	`;

	/*
	 * `stweg_id` kommt aus der ZIELversammlung, nicht aus der Zeile: Beide
	 * Nebentabellen führen sie mit, und übernommen wird ohnehin nur innerhalb
	 * derselben Gemeinschaft — so steht die Herkunft aber nicht nur in der
	 * Annahme, sondern im INSERT.
	 */
	await tx`
		INSERT INTO agenda_item_affected (agenda_item_id, party_id, operator_id, stweg_id)
		SELECT ${id}, b.party_id, ${operatorId}, m.stweg_id
		FROM agenda_item_affected b, meeting m
		WHERE b.agenda_item_id = ${quelleId} AND m.id = ${meetingId}
	`;
	await tx`
		INSERT INTO agenda_item_proposer (agenda_item_id, party_id, operator_id, stweg_id)
		SELECT ${id}, p.party_id, ${operatorId}, m.stweg_id
		FROM agenda_item_proposer p, meeting m
		WHERE p.agenda_item_id = ${quelleId} AND m.id = ${meetingId}
	`;

	return id;
}

/**
 * Übernimmt ausgewählte Traktanden in die Zielversammlung.
 *
 * Übernommen werden Titel, Inhalt, Kurzfassung, Antragswortlaut und das
 * Mehrheitserfordernis **samt Fassungskennung von damals** — unverändert, damit
 * sich nichts still ändert. Der Hinweis auf eine neuere Fassung steht im
 * Angebot; entschieden wird von Hand.
 *
 * Anhänge bleiben zurück: Eine Offerte aus dem Vorjahr ist nicht mehr gültig,
 * und sie mitzunehmen erweckte den Anschein, sie sei es.
 *
 * **Spontanes wird abgewiesen** (Produktentscheid 02.10.2026, «Ja, weglassen»),
 * mit eigener Absage statt stillem Auslassen: Ein im Saal entstandener Punkt
 * gehört zum Ablauf jener Versammlung, und ein übernommenes Rückkommen trüge
 * den leeren Knoten, an dem die Reglementseite wirft.
 *
 * bindung: traktandumIds — `if (q.stweg_id !== ziel.stweg_id) throw` weist
 *   jede Quelle ab, die nicht zur Gemeinschaft der Zielversammlung gehört;
 *   `if (q.is_spontaneous) throw` jede, die im Saal entstanden ist, und
 *   `gefunden` jede, die der Zeilenschutz nicht liefert.
 */
export async function uebernimmTraktanden(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumIds: Id[]
): Promise<number> {
	if (traktandumIds.length === 0) return 0;

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [ziel] = await tx<{ state: string; stweg_id: string }[]>`
			SELECT state, stweg_id FROM meeting WHERE id = ${meetingId}
		`;
		if (!ziel) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
		verlangeZustand({ zustand: ziel.state as never }, ['entwurf'], 'in den Traktanden ändern');

		const quellen = await tx<
			{
				id: string;
				meeting_id: string;
				title: string;
				item_kind: string;
				body: string | null;
				summary: string | null;
				motion_text: string | null;
				proposer_kind: string;
				proposer_party_id: string | null;
				proposer_stweg_id: string | null;
				proposer_name: string | null;
				requirement_version: string | null;
				stweg_id: string;
				meeting_date: Date;
				is_spontaneous: boolean;
			}[]
		>`
			SELECT a.*, m.stweg_id, m.meeting_date
			FROM agenda_item a JOIN meeting m ON m.id = a.meeting_id
			WHERE a.id = ANY(${traktandumIds})
			ORDER BY a.position
		`;

		/*
		 * **Was nicht gefunden wird, wird abgewiesen, nicht still übergangen**,
		 * aus demselben Grund wie beim Spontanen unten. Eine Kennung von
		 * anderswo fiel unter dem Zeilenschutz still aus `quellen`, und die
		 * Aktion leitete weiter wie nach einer Übernahme (Kreuzteil des
		 * Fremdbetreiber-Durchstichs, 28.10.2026). Ebenso ein Traktandum, das
		 * zwischen Laden und Absenden entfernt wurde.
		 */
		const gefunden = new Set(quellen.map((q) => q.id));
		if (traktandumIds.some((t) => !gefunden.has(t))) {
			throw new FachlicherFehler(
				'unbekannt',
				'Eines der gewählten Traktanden gibt es hier nicht. Übernommen wurde deshalb nichts. Laden Sie die Seite neu und wählen Sie noch einmal.',
				'traktandumIds'
			);
		}

		// Nur aus derselben Gemeinschaft. Ein Traktandum einer fremden STWEG
		// brächte deren Antragsteller und deren Reglementslage mit.
		for (const q of quellen) {
			if (q.stweg_id !== ziel.stweg_id) {
				throw new FachlicherFehler(
					'fremde_gemeinschaft',
					'Übernommen werden können nur Traktanden derselben Gemeinschaft.',
					'traktandumIds'
				);
			}
		}

		/*
		 * **Spontanes wird abgewiesen, nicht still übergangen.** Das Angebot
		 * führt es seit dem 02.10.2026 nicht mehr; die Schranke gehört aber in
		 * den Server, weil eine Kennung von Hand gesendet werden kann. Still
		 * auslassen wäre die schlechtere Absage: Wer einen Punkt ankreuzt und
		 * ihn danach nicht findet, weiss nicht, warum.
		 *
		 * **Die Absage nennt den Titel und sagt, dass nichts übernommen wurde**
		 * (Laienprüfung 02.10.2026): Der Wurf verwirft die ganze Auswahl, und
		 * die neu geladene Seite führt den Punkt nicht mehr. Ohne Titel wäre
		 * nicht herauszufinden, welcher gemeint war, und ohne den zweiten Satz
		 * läse sich die Meldung, als seien die übrigen übernommen.
		 */
		for (const q of quellen) {
			if (q.is_spontaneous) {
				throw new FachlicherFehler(
					'spontanes_traktandum',
					`«${q.title}» ist erst während der Versammlung entstanden und lässt sich nicht übernehmen. Übernommen wurde deshalb nichts. Wählen Sie die übrigen Traktanden noch einmal, und legen Sie dieses neu an, wenn es wieder auf die Liste soll.`,
					'traktandumIds'
				);
			}
		}

		const [{ hoechste }] = await tx<{ hoechste: number | null }[]>`
			SELECT max(position) AS hoechste FROM agenda_item
			WHERE meeting_id = ${meetingId} AND parent_id IS NULL
		`;
		let position = (hoechste ?? 0) + 1;

		for (const q of quellen) {
			const id = await kopiereTraktandumIn(
				tx,
				handelnder.operatorId,
				q.id,
				meetingId,
				null,
				position
			);

			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.traktandumUebernommen,
					{ art: 'agenda_item', id },
					{
						versammlung: meetingId,
						ausVersammlung: q.meeting_id,
						// Das Quelltraktandum (C2, F4c): War es an der ersten nur zur
						// Kenntnisnahme traktandiert, gilt die Kopie an der zweiten als neu
						// (`leseNeueTraktandenDerZweitenIn`).
						ausTraktandum: q.id,
						ausDatum: kalendertag(q.meeting_date),
						titel: q.title,
						erfordernisFassung: q.requirement_version
					}
				)
			);

			position++;
		}

		return quellen.length;
	});
}

/**
 * Trägt die **unerledigten** Traktanden einer vertagten Versammlung in ihre
 * Folgeversammlung.
 *
 * **Warum das sein muss** (nachgemessen am 25.08.2026): Die Vertagung legte
 * die zweite Versammlung an, und die bekam ihre acht Pflichttraktanden — sie
 * sah damit vollständig aus. Von den drei angekündigten Sachtraktanden der
 * ersten stand **keines** darin. Genau die sind aber der Grund, warum es die
 * zweite Versammlung gibt: Nach ZGB Art. 712p Abs. 2 wird sie für dieselben
 * Geschäfte einberufen, weil über sie nicht beschlossen werden konnte.
 * Vollständig aussehen und leer sein ist der schlimmere der beiden Zustände —
 * niemand sucht, was er nicht vermisst.
 *
 * Vier Filter, jeder mit einem Grund:
 *
 * * **Pflichttraktanden** (`from_template`) nicht: Die entstehen in der
 *   Folgeversammlung ohnehin neu, und übernommen stünden sie doppelt.
 * * **Spontanes** (`is_spontaneous`) nicht: Ein Antrag, der im Saal
 *   aufgekommen ist, war nicht angekündigt. Ihn in eine einberufene
 *   Traktandenliste zu tragen, hiesse, ihn ohne Einladung zu traktandieren —
 *   das ist gerade das, was ZGB Art. 712m/712n verhindern sollen. Wer ihn
 *   wieder will, stellt ihn erneut.
 * * **Zurückgezogenes** (`withdrawn_at`) nicht: Der Antrag ist weg. Ihn
 *   mitzunehmen liesse ihn wieder auferstehen.
 * * **Entschiedenes** nicht — der wichtigste Filter. Der zweite Fall des Auftraggebers ist
 *   die Versammlung, die mitten im Ablauf beschliesst, sich zu vertagen: Die
 *   Punkte 1 bis 5 sind gefasst, 6 bis 12 nicht. Käme Punkt 3 mit, stünde
 *   dieselbe Sache ein zweites Mal zur Abstimmung, und am Ende gäbe es zwei
 *   Beschlüsse dazu, die einander widersprechen können. Erkannt am
 *   geschlossenen, nicht überholten Durchgang, der nicht konsultativ war
 *   (`entscheidetDasGeschaeft`; H7, Teil D): Nach einer konsultativen
 *   Abstimmung ist nichts entschieden, das Geschäft wandert mit. Anders als
 *   «behandelt» beim Verschieben in `traktanden.ts`, das auch einen
 *   konsultativen Durchgang zählt: Dort geht es um die Reihenfolge, und das
 *   Geschäft war schon dran.
 *
 * Der Baum bleibt erhalten: Ein Unterpunkt wandert nur mit, wenn sein
 * Elternteil mitwandert. Sonst hinge er an einem Traktandum, das es in der
 * Folgeversammlung nicht gibt.
 */
export async function uebertrageOffeneTraktanden(
	tx: postgres.TransactionSql,
	handelnder: Handelnder & { operatorId: string },
	vonMeetingId: Id,
	nachMeetingId: Id
): Promise<number> {
	const quellen = await tx<
		{
			id: string;
			parent_id: string | null;
			position: number;
			title: string;
			requirement_version: string | null;
		}[]
	>`
		SELECT a.id, a.parent_id, a.position, a.title, a.requirement_version
		FROM agenda_item a
		WHERE a.meeting_id = ${vonMeetingId}
		  AND a.from_template = false
		  AND a.is_spontaneous = false
		  AND a.withdrawn_at IS NULL
		  AND NOT EXISTS (
			SELECT 1 FROM voting_round v
			WHERE v.agenda_item_id = a.id
			  AND v.state = 'geschlossen'
			  AND v.superseded_at IS NULL
			  -- Nur konsultativ abgestimmt ist nicht entschieden (H7, Teil D;
			  -- entscheidetDasGeschaeft): Gerade dieses Geschäft gehört auf die
			  -- Versammlung, die nach fehlender Beschlussfähigkeit einberufen wird.
			  AND NOT v.consultative
		  )
		  -- Entschieden ist auch, was ein Folgeantrag nach einem Rückkommen
		  -- ersetzt hat; der Folgeantrag selbst ist spontan und bleibt ohnehin
		  -- hier (Migration 133).
		  AND NOT durch_anderes_traktandum_ersetzt(a.id)
		ORDER BY a.position
	`;
	if (quellen.length === 0) return 0;

	const [herkunft] = await tx<{ meeting_date: Date }[]>`
		SELECT meeting_date FROM meeting WHERE id = ${vonMeetingId}
	`;

	// Hinter den Pflichttraktanden, die schon dastehen.
	const [{ hoechste }] = await tx<{ hoechste: number | null }[]>`
		SELECT max(position) AS hoechste FROM agenda_item
		WHERE meeting_id = ${nachMeetingId} AND parent_id IS NULL
	`;
	let position = (hoechste ?? 0) + 1;

	/*
	 * Elternteile zuerst, dann deren Kinder — schichtweise statt in einer
	 * Schleife über die Reihenfolge der Abfrage. Das ist unabhängig davon, wie
	 * tief der Baum ist, und lässt Waisen liegen: Ein Unterpunkt, dessen
	 * Elternteil weggefiltert wurde, findet nie einen neuen Elternteil und
	 * wandert deshalb nicht mit.
	 */
	const neueKennung = new Map<string, string>();
	const uebrig = [...quellen];
	let uebertragen = 0;

	for (;;) {
		const dran = uebrig.filter((q) => q.parent_id === null || neueKennung.has(q.parent_id));
		if (dran.length === 0) break;

		for (const q of dran) {
			const elternteil = q.parent_id ? (neueKennung.get(q.parent_id) ?? null) : null;
			/*
			 * Oben durchgezählt, unten die Stelle von damals: Die Eindeutigkeit
			 * gilt je Elternteil (`agenda_position_je_elternteil`), und der neue
			 * Elternteil hat noch keine Kinder.
			 */
			const neueId = await kopiereTraktandumIn(
				tx,
				handelnder.operatorId,
				q.id,
				nachMeetingId,
				elternteil,
				elternteil ? q.position : position++
			);
			neueKennung.set(q.id, neueId);
			uebertragen++;

			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.traktandumUebernommen,
					{ art: 'agenda_item', id: neueId },
					{
						versammlung: nachMeetingId,
						ausVersammlung: vonMeetingId,
						// Das Quelltraktandum (C2, F4c), wie bei `uebernimmTraktanden`.
						ausTraktandum: q.id,
						ausDatum: herkunft ? kalendertag(herkunft.meeting_date) : null,
						titel: q.title,
						erfordernisFassung: q.requirement_version,
						// Damit im Verlauf steht, WARUM übernommen wurde — von Hand
						// gewählt oder durch die Vertagung mitgeführt.
						grund: 'vertagung'
					}
				)
			);
		}

		uebrig.splice(0, uebrig.length, ...uebrig.filter((q) => !neueKennung.has(q.id)));
	}

	return uebertragen;
}

/**
 * Datum und Prüfsumme des Protokolls der **letzten Versammlung dieser
 * Gemeinschaft** — der, die jetzt zur Genehmigung ansteht.
 *
 * **Nicht `previous_meeting_id`.** Das Feld meint etwas anderes: die
 * Erstversammlung einer Zweitversammlung, wenn die erste nicht beschlussfähig
 * war (ZGB Art. 712p Abs. 2). Es beim Anlegen der Jahresversammlung zu
 * verwenden, weist die Anwendung zu Recht ab («Nur eine Zweitversammlung hat
 * eine Vorgängerin») — geprüft am 22.08.2026, nachdem genau diese Annahme im
 * Test umfiel.
 *
 * Gesucht wird deshalb die zeitlich letzte Versammlung derselben Gemeinschaft
 * vor dieser. Dass sie ein festgehaltenes Protokoll hat, ist nicht
 * vorausgesetzt: Ohne eines bleibt es beim allgemeinen Wortlaut.
 */
async function abdruckDerLetztenVersammlung(
	tx: postgres.TransactionSql,
	operatorId: Id,
	stwegId: Id,
	dieseId: Id,
	datum: string
): Promise<{ datum: string; zeitpunkt: string; abdruck: string } | null> {
	try {
		const [letzte] = await tx<{ id: string; meeting_date: Date }[]>`
			SELECT id, meeting_date FROM meeting
			 WHERE stweg_id = ${stwegId} AND id <> ${dieseId} AND meeting_date < ${datum}
			 ORDER BY meeting_date DESC, id DESC
			 LIMIT 1
		`;
		if (!letzte) return null;

		const abdruck = await holeFassungsabdruck(operatorId, letzte.id);
		if (!abdruck) return null;

		const tag = letzte.meeting_date.toISOString().slice(0, 10);
		return { datum: tag, zeitpunkt: abdruck.zeitpunkt, abdruck: abdruck.abdruck };
	} catch {
		// Ein Fehlschlag darf das Anlegen nicht aufhalten: Dann steht der
		// allgemeine Wortlaut da, und die Sitzungsleitung kann ihn ergänzen.
		return null;
	}
}
