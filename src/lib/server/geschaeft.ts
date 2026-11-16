/**
 * Das Geschäft: ein Antrag, mehrere Gemeinschaften (Story 7.5a).
 *
 * Eine gemeinsame Traktandenliste mehrerer Gemeinschaften ist nicht nach
 * Gemeinschaften geordnet, sondern nach Sachfragen — und jede läuft mehrfach:
 *
 *     3. Jahresrechnung
 *        3.1 MEG Umgebung · 3.2 MEG Einstellhalle · 3.3–3.7 die Häuser
 *     8. Allgemeinstrom
 *        8.1–8.5   nur die Häuser, keine MEG
 *
 * Ein Antragstext, ein Mehrheitserfordernis, sieben getrennte Beschlüsse.
 *
 * **Klammer für die Erfassung, nie für das Ergebnis.** Sieben Beschlüsse
 * bleiben sieben, jeder mit eigener Bezugsgrösse, eigener Beschlussfähigkeit und
 * eigener Anfechtungsfrist. Was das Geschäft spart, ist das siebenfache Tippen —
 * und die Abweichung, die dabei entsteht.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import {
	fasseZusammen,
	gemeinsameListe,
	neueReihenfolge,
	neueStellen,
	nummernJeTraktandum,
	type Geschaeftszeile,
	type LosesTraktandum
} from '$lib/domain/gemeinsameliste';
import { holeRegelwerk } from '$lib/rules';
import { waehleErfordernis } from '$lib/domain/entscheidbaum';
import { wendeReglementAn } from '$lib/domain/reglement';
import {
	holeEnthaltungseinstellungIn,
	holeReglementsregelnIn,
	schreibeErfordernisIn
} from './erfordernisse';
import { bezeichnung } from './einladungsmehr';
import { loescheVorabvermerkeNachNeuemWortlaut } from './betroffene';
import { raeumeTraktandenAb } from './traktandenreste';
import { holeLesartenIn } from './lesarten';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';

export interface Geschaeft {
	id: Id;
	titel: string;
	antragswortlaut: string | null;
	inhalt: string | null;
	art: 'abstimmung' | 'kenntnisnahme';
	stelle: number;
	/** Wo es überall als Traktandum steht. */
	traktanden: { traktandumId: Id; meetingId: Id; gemeinschaft: string; nummer: string | null }[];
}

interface Zeile {
	id: string;
	title: string;
	motion_text: string | null;
	body: string | null;
	item_kind: 'abstimmung' | 'kenntnisnahme';
	position: number;
}

export async function holeGeschaefte(operatorId: Id, tagId: Id): Promise<Geschaeft[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM business WHERE meeting_day_id = ${tagId} ORDER BY position, title
		`;
		if (zeilen.length === 0) return [];

		const traktanden = await tx<
			{
				business_id: string;
				id: string;
				meeting_id: string;
				stweg_name: string;
				manual_number: string | null;
			}[]
		>`
			SELECT a.business_id, a.id, a.meeting_id, s.name AS stweg_name, a.manual_number
			FROM agenda_item a
			JOIN meeting m ON m.id = a.meeting_id
			JOIN stweg s   ON s.id = m.stweg_id
			WHERE a.business_id IS NOT NULL AND m.meeting_day_id = ${tagId}
			ORDER BY m.day_position NULLS LAST, s.name
		`;

		return zeilen.map((z) => ({
			id: z.id,
			titel: z.title,
			antragswortlaut: z.motion_text,
			inhalt: z.body,
			art: z.item_kind,
			stelle: Number(z.position),
			traktanden: traktanden
				.filter((t) => t.business_id === z.id)
				.map((t) => ({
					traktandumId: t.id,
					meetingId: t.meeting_id,
					gemeinschaft: t.stweg_name,
					nummer: t.manual_number
				}))
		}));
	});
}

export interface GeschaeftEingabe {
	titel: string;
	antragswortlaut?: string | null;
	inhalt?: string | null;
	art?: 'abstimmung' | 'kenntnisnahme';
	/** In welchen Versammlungen des Abends es laufen soll. */
	meetingIds: Id[];
	/**
	 * Das Mehrheitserfordernis, gleich beim Erfassen gewählt.
	 *
	 * Gemeldet am 11.08.2026: «Das Quorum muss beim Erfassen definiert werden
	 * können. Sonst muss ich immer für jede Gemeinschaft einzeln erfassen.» Bei
	 * sechs Häusern waren das sechs Wege durch den Entscheidbaum für denselben
	 * Antrag.
	 *
	 * Die Kennung ist derselbe Ergebnisknoten des Regelwerks wie bei einer
	 * einzelnen Versammlung. **Hergeleitet wird je Gemeinschaft**: Eine
	 * Reglementsabweichung gilt für ein Haus, nicht für den Abend — dasselbe
	 * Vorhaben kann dort ein anderes Mehr verlangen.
	 */
	erfordernis?: string | null;
}

/**
 * Was Art und Antragswortlaut voneinander verlangen.
 *
 * Die Datenbank weist beides ohnehin ab; hier wird daraus eine Meldung, die
 * sagt, was zu tun ist. Steht an einer Stelle, weil Anlegen und Ändern sonst
 * auseinanderliefen.
 */
function pruefeInhalt(art: 'abstimmung' | 'kenntnisnahme', wortlaut: string | null): void {
	// Über eine Kenntnisnahme wird nicht beschlossen, über eine Abstimmung schon
	// — und dann muss dastehen, worüber.
	if (art === 'abstimmung' && zeichenzahl(wortlaut ?? '') < 3) {
		throw new FachlicherFehler(
			'ohne_wortlaut',
			'Eine Abstimmung braucht den Antragswortlaut — er wird im Saal vorgelesen und steht ' +
				'später im Protokoll.',
			'antragswortlaut'
		);
	}
	if (art === 'kenntnisnahme' && wortlaut) {
		throw new FachlicherFehler(
			'wortlaut_bei_kenntnisnahme',
			'Über eine Kenntnisnahme wird nicht beschlossen; ein Antragswortlaut erzeugte bei der ' +
				'Auswertung einen Beschluss, den niemand fassen wollte.',
			'antragswortlaut'
		);
	}
}

/**
 * Legt ein Geschäft an und erzeugt je beteiligter Versammlung ein Traktandum.
 *
 * Beteiligt sind **nicht** immer alle: Ein Punkt zum Allgemeinstrom läuft in den
 * Häusern, nicht in den Miteigentümerschaften — die haben keinen
 * Allgemeinstrom. Wer das nicht ankreuzen könnte, müsste die überzähligen
 * Traktanden hinterher einzeln löschen.
 */
export async function erstelleGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	eingabe: GeschaeftEingabe
): Promise<Geschaeft> {
	const titel = eingabe.titel?.trim() ?? '';
	if (zeichenzahl(titel) < 3) {
		throw new FachlicherFehler('titel_zu_kurz', 'Der Titel fehlt oder ist zu kurz.', 'titel');
	}
	const art = eingabe.art ?? 'abstimmung';
	const wortlaut = eingabe.antragswortlaut?.trim() || null;
	const erfordernis = eingabe.erfordernis?.trim() || null;
	pruefeInhalt(art, wortlaut);

	if (eingabe.meetingIds.length === 0) {
		throw new FachlicherFehler(
			'ohne_gemeinschaft',
			'Wählen Sie, in welchen Gemeinschaften das Geschäft läuft. Ohne mindestens eine gäbe es ' +
				'nichts zu beschliessen.',
			'meetingIds'
		);
	}

	const angelegt = await alsBetreiber(handelnder.operatorId, async (tx) => {
		// Nur Versammlungen dieses Abends, und nur solche, die noch offen für
		// Traktanden sind. Eine bereits eröffnete Versammlung nachträglich zu
		// ergänzen wäre ein Spontantraktandum und läuft über den dafür
		// vorgesehenen Weg (Story 5.11) — dort entscheidet die Ausnahme
		// (Reglement oder Universalversammlung; Migrationen 127 und 128).
		const erlaubt = await tx<
			{ id: string; state: string; stweg_name: string; stweg_id: string }[]
		>`
			SELECT m.id, m.state, s.name AS stweg_name, m.stweg_id
			FROM meeting m JOIN stweg s ON s.id = m.stweg_id
			WHERE m.meeting_day_id = ${tagId} AND m.id = ANY(${eingabe.meetingIds}::uuid[])
		`;
		if (erlaubt.length !== eingabe.meetingIds.length) {
			throw new FachlicherFehler(
				'fremde_versammlung',
				'Eine der gewählten Versammlungen tagt hier gar nicht mit.',
				'meetingIds'
			);
		}
		const eroeffnet = erlaubt.filter((m) => !['entwurf', 'freigegeben'].includes(m.state));
		if (eroeffnet.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${eroeffnet.map((m) => m.stweg_name).join(', ')}. ` +
					'Nehmen Sie das Geschäft dort als Traktandum während der Sitzung auf. Ob darüber ' +
					'abgestimmt werden darf, entscheidet die Ausnahme: das Reglement oder die ' +
					'Universalversammlung.',
				'meetingIds'
			);
		}

		const [{ stelle }] = await tx<{ stelle: number }[]>`
			SELECT coalesce(max(position), -1) + 1 AS stelle FROM business WHERE meeting_day_id = ${tagId}
		`;

		const [g] = await tx<Zeile[]>`
			INSERT INTO business (operator_id, meeting_day_id, title, motion_text, body,
			                      item_kind, position)
			VALUES (${handelnder.operatorId}, ${tagId}, ${titel},
			        ${wortlaut}, ${eingabe.inhalt?.trim() || null},
			        ${art}, ${Number(stelle)})
			RETURNING *
		`;

		// Je Versammlung ein Traktandum, ans Ende der Liste. Die Nummerierung
		// entsteht wie sonst aus der Position — sie ist die Stellung in der Liste
		// und nicht die Hausnummer.
		for (const m of erlaubt) {
			const [{ pos }] = await tx<{ pos: number }[]>`
				SELECT coalesce(max(position), -1) + 1 AS pos FROM agenda_item
				WHERE meeting_id = ${m.id} AND parent_id IS NULL
			`;
			// Die Kennung wird wie überall vorab geholt: `agenda_item.id` hat
			// bewusst keinen Vorgabewert, damit der Kern sie kennt, bevor
			// geschrieben wird.
			const [{ id: traktandumId }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
			await tx`
				INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
				                         item_kind, motion_text, body, proposer_kind, business_id)
				VALUES (${traktandumId}, ${handelnder.operatorId}, ${m.id}, NULL, ${Number(pos)},
				        ${titel}, ${art}, ${wortlaut},
				        ${eingabe.inhalt?.trim() || null}, 'gemeinschaft', ${g.id})
			`;

			/*
			 * Das Erfordernis **je Gemeinschaft** herleiten, nicht einmal für den
			 * Abend: Eine Reglementsabweichung gilt für ein Haus. Dasselbe Vorhaben
			 * kann bei Haus A das einfache Mehr verlangen und bei Haus B ein
			 * qualifiziertes, weil dessen Reglement es so vorsieht.
			 */
			if (erfordernis && art === 'abstimmung') {
				const regeln = await holeReglementsregelnIn(tx, m.stweg_id);
				const enthaltung = await holeEnthaltungseinstellungIn(tx, m.stweg_id);
				const lesarten = await holeLesartenIn(tx, { meetingId: m.id });
				const gewaehlt = waehleErfordernis(holeRegelwerk(), erfordernis).ergebnis;
				await schreibeErfordernisIn(
					tx,
					handelnder,
					traktandumId,
					wendeReglementAn(gewaehlt, regeln, enthaltung, lesarten).erfordernis
				);
			}
		}

		await ordneHaeuser(tx, tagId);

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftAngelegt,
				{ art: 'meeting_day', id: tagId },
				{ titel, gemeinschaften: erlaubt.map((m) => m.stweg_name) }
			)
		);

		const alle = await holeGeschaefteIn(tx, tagId);
		return alle.find((x) => x.id === g.id)!;
	});

	/*
	 * Die Protokollnummern gehören zum Anlegen, nicht zur Seite. Vorher zog sie
	 * nur die Aktion nach — wer `erstelleGeschaeft` von anderswo aufrief, bekam
	 * ein Traktandum ohne feste Nummer, und die Gemeinschaft zählte dafür still
	 * ihre eigene weiter. Gefunden vom Datenbanktest am 11.08.2026.
	 */
	await schreibeNummern(handelnder, tagId);
	return angelegt;
}

/** Dieselbe Abfrage innerhalb einer laufenden Transaktion. */
async function holeGeschaefteIn(
	tx: Parameters<Parameters<typeof alsBetreiber>[1]>[0],
	tagId: Id
): Promise<Geschaeft[]> {
	const zeilen = await tx<Zeile[]>`
		SELECT * FROM business WHERE meeting_day_id = ${tagId} ORDER BY position, title
	`;
	const traktanden = await tx<
		{ business_id: string; id: string; meeting_id: string; stweg_name: string; manual_number: string | null }[]
	>`
		SELECT a.business_id, a.id, a.meeting_id, s.name AS stweg_name, a.manual_number
		FROM agenda_item a
		JOIN meeting m ON m.id = a.meeting_id
		JOIN stweg s   ON s.id = m.stweg_id
		WHERE a.business_id IS NOT NULL AND m.meeting_day_id = ${tagId}
	`;
	return zeilen.map((z) => ({
		id: z.id,
		titel: z.title,
		antragswortlaut: z.motion_text,
		inhalt: z.body,
		art: z.item_kind,
		stelle: Number(z.position),
		traktanden: traktanden
			.filter((t) => t.business_id === z.id)
			.map((t) => ({
				traktandumId: t.id,
				meetingId: t.meeting_id,
				gemeinschaft: t.stweg_name,
				nummer: t.manual_number
			}))
	}));
}

/**
 * Die Traktandenliste der gemeinsamen Versammlung — Geschäfte samt Häusern.
 *
 * Trägt mehr als `holeGeschaefte`: Titel, Antragswortlaut und Art **wie sie im
 * einzelnen Haus stehen**. Nur so lässt sich zeigen, wo jemand den Inhalt schon
 * angepasst hat — und genau das ist der Sinn der Aufteilung in 3.1 und 3.2.
 */
export async function holeGemeinsameListe(
	operatorId: Id,
	tagId: Id
): Promise<Geschaeftszeile[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM business WHERE meeting_day_id = ${tagId} ORDER BY position, title
		`;
		if (zeilen.length === 0) return [];

		const traktanden = await tx<
			{
				business_id: string;
				id: string;
				meeting_id: string;
				stweg_id: string;
				stweg_name: string;
				title: string;
				motion_text: string | null;
				item_kind: 'abstimmung' | 'kenntnisnahme';
				requirement_node: string | null;
			}[]
		>`
			SELECT a.business_id, a.id, a.meeting_id, m.stweg_id, s.name AS stweg_name,
			       a.title, a.motion_text, a.item_kind, a.requirement_node
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s   ON s.id = m.stweg_id
			 WHERE a.business_id IS NOT NULL AND m.meeting_day_id = ${tagId}
			 ORDER BY a.business_position NULLS LAST, m.day_position NULLS LAST, s.name
		`;

		return zeilen.map((z) => ({
			geschaeftId: z.id,
			titel: z.title,
			antragswortlaut: z.motion_text,
			inhalt: z.body,
			art: z.item_kind,
			stelle: Number(z.position),
			haeuser: traktanden
				.filter((t) => t.business_id === z.id)
				.map((t) => ({
					traktandumId: t.id,
					meetingId: t.meeting_id,
					stwegId: t.stweg_id,
					gemeinschaft: t.stweg_name,
					titel: t.title,
					antragswortlaut: t.motion_text,
					art: t.item_kind,
					erfordernisKnoten: t.requirement_node,
					// Abweichend heisst: Jemand hat es in seinem Haus geändert. Das ist
					// erlaubt und der Zweck der Aufteilung — sichtbar muss es trotzdem
					// sein, sonst hält man die Liste für einheitlich, wenn sie es nicht ist.
					abweichend:
						t.title.trim() !== z.title.trim() ||
						(t.motion_text ?? '').trim() !== (z.motion_text ?? '').trim()
				}))
		}));
	});
}

/**
 * Schreibt die Nummern der gemeinsamen Liste an die einzelnen Traktanden.
 *
 * **Eine Sitzung, eine Nummer** (Produktentscheid 11.08.2026): Was im Saal als
 * «3.1» aufgerufen wird, steht so im Protokoll der Gemeinschaft. Ohne diesen
 * Schritt zählte jedes Haus für sich, und die Leitung müsste im Saal zwei
 * Nummern nebeneinander führen.
 *
 * Geschrieben wird in `manual_number` — dieselbe Spalte, in der auch eine von
 * Hand gesetzte Nummer steht. Die Rechnung im Kern respektiert sie ohnehin
 * (`domain/traktandenbaum.ts`), und damit stimmt die Liste in der einzelnen
 * Versammlung mit der gemeinsamen überein, ohne dass es dort einen zweiten Weg
 * bräuchte.
 */
export async function schreibeNummern(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id
): Promise<number> {
	const nummern = nummernJeTraktandum(gemeinsameListe(await holeGemeinsameListe(handelnder.operatorId, tagId)));
	if (nummern.size === 0) return 0;

	/*
	 * **Ein UPDATE für alle**, nicht eines je Traktandum. Bei sechs
	 * Gemeinschaften und neun Punkten sind das vierundfünfzig Abfragen — und der
	 * Aufruf läuft bei jedem Öffnen der Liste, damit die festen Nummern nicht
	 * hinter der Rechnung zurückbleiben (siehe unten).
	 */
	const paare = [...nummern.entries()];
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Nur solange nicht eingeladen ist** (21.08.2026).
		 *
		 * Ab der Freigabe steht die Nummer fest (`released_number`, Migration 072).
		 * Weil eine von Hand gesetzte Nummer ihr vorgeht und der Abend genau die
		 * schreibt, hebelte ein Schreiben hier die Festschreibung wieder aus: Die
		 * Häuser bekämen andere Nummern, als auf ihren Einladungen stehen — der
		 * Fall, den die Festschreibung verhindern soll.
		 *
		 * Die Bedingung steht in der Abfrage und nicht davor: Auf einem Abend
		 * können Häuser verschieden weit sein, und dann soll das eine nachziehen,
		 * während das andere seine Nummer behält.
		 */
		const zeilen = await tx`
			UPDATE agenda_item a SET manual_number = v.nummer
			  FROM (VALUES ${tx(paare.map(([id, nr]) => [id, nr]))}) AS v(id, nummer)
			 WHERE a.id = v.id::uuid AND a.manual_number IS DISTINCT FROM v.nummer
			   AND EXISTS (
			     SELECT 1 FROM meeting m WHERE m.id = a.meeting_id AND m.state = 'entwurf'
			   )
		`;
		return zeilen.count;
	});
}

/**
 * Das Geschäft **dieses** Abends — die eine Stelle, an der die Bindung geprüft
 * wird (07.09.2026).
 *
 * **Warum sie nötig wurde.** Die Geschäfteseite bekommt den Abend aus der
 * Adresse und das Geschäft aus dem Formular, und keine der fünf Handlungen
 * verglich die beiden. `SELECT * FROM business WHERE id = ${…}` allein findet
 * jedes Geschäft des Betreibers, auch eines von einem anderen Abend. Dieselbe
 * Bauart wie bei den Vollmachten (`69f107c`), den Traktanden (`ec57517`) und
 * den Weisungen; der Prüfbericht
 * `docs/audit/2026-09-07-traktandumsbindung.md` nennt diese Wege ausdrücklich.
 *
 * **In der Abfrage und nicht in der Route**, aus demselben Grund wie dort.
 */
async function leseGeschaeftAn(
	tx: postgres.TransactionSql,
	tagId: Id,
	geschaeftId: Id
): Promise<Zeile & { meeting_day_id: string }> {
	const [g] = await tx<(Zeile & { meeting_day_id: string })[]>`
		SELECT * FROM business WHERE id = ${geschaeftId} AND meeting_day_id = ${tagId}
	`;
	if (!g) {
		throw new FachlicherFehler(
			'fremdes_geschaeft',
			'Dieses Traktandum gehört nicht zu diesem Abend.',
			'id'
		);
	}
	return g;
}

/**
 * Ändert ein Geschäft — und zieht die Häuser mit, die noch mitgehen.
 *
 * **Wer abweicht, bleibt.** Genau dafür gibt es die Aufteilung in 3.1 und 3.2:
 * Beim Budget trägt jede Gemeinschaft ihren eigenen Betrag. Würde das Ändern am
 * Abend alle überschreiben, wäre die Anpassung je Haus jedes Mal verloren — und
 * niemand bemerkte es, weil die Liste danach einheitlich aussähe.
 *
 * Mitgezogen wird deshalb nur, was vorher wörtlich dem Geschäft entsprach. Die
 * Rückgabe sagt beides, damit die Meldung es nennen kann.
 */
export async function bearbeiteGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	geschaeftId: Id,
	eingabe: { titel: string; antragswortlaut: string | null; art: 'abstimmung' | 'kenntnisnahme' }
): Promise<{ mitgezogen: number; geblieben: number }> {
	const titel = eingabe.titel?.trim() ?? '';
	if (zeichenzahl(titel) < 3) {
		throw new FachlicherFehler('titel_zu_kurz', 'Der Titel fehlt oder ist zu kurz.', 'titel');
	}
	const wortlaut = eingabe.antragswortlaut?.trim() || null;
	pruefeInhalt(eingabe.art, wortlaut);

	const ergebnis = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const alt = await leseGeschaeftAn(tx, tagId, geschaeftId);

		// Nur solange keine der beteiligten Versammlungen eröffnet ist: Ab der
		// Eröffnung ist die Liste das, worüber die Versammlung befunden hat.
		const eroeffnet = await tx<{ name: string }[]>`
			SELECT DISTINCT s.name FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s   ON s.id = m.stweg_id
			 WHERE a.business_id = ${geschaeftId} AND m.state NOT IN ('entwurf', 'freigegeben')
		`;
		if (eroeffnet.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${eroeffnet.map((e) => e.name).join(', ')}. ` +
					'Eine eröffnete Versammlung lässt ihre Geschäfte nicht mehr ändern.',
				'id'
			);
		}

		await tx`
			UPDATE business SET title = ${titel}, motion_text = ${wortlaut}, item_kind = ${eingabe.art}
			 WHERE id = ${geschaeftId}
		`;

		const mit = await tx<{ id: string }[]>`
			UPDATE agenda_item SET title = ${titel}, motion_text = ${wortlaut}, item_kind = ${eingabe.art}
			 WHERE business_id = ${geschaeftId}
			   AND btrim(title) = ${alt.title.trim()}
			   AND coalesce(btrim(motion_text), '') = ${(alt.motion_text ?? '').trim()}
			   AND item_kind = ${alt.item_kind}
			RETURNING id
		`;
		// Ein neuer Wortlaut nimmt die Vorab-Zustimmungen mit, wie im
		// Traktandenformular (Fachprüfung A2, V1-1; Code-Review A2b, Befund 4).
		// Dieser Weg schreibt auch in freigegebene Versammlungen, wo sich eine
		// Vorab-Zustimmung bereits vermerken lässt.
		if ((wortlaut ?? '').trim() !== (alt.motion_text ?? '').trim()) {
			for (const t of mit) {
				await loescheVorabvermerkeNachNeuemWortlaut(tx, handelnder, t.id, titel);
			}
		}
		const [{ alle }] = await tx<{ alle: number }[]>`
			SELECT count(*)::int AS alle FROM agenda_item WHERE business_id = ${geschaeftId}
		`;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftGeaendert,
				{ art: 'meeting_day', id: alt.meeting_day_id },
				{ geschaeft: geschaeftId, titel, mitgezogen: mit.count, geblieben: Number(alle) - mit.count }
			)
		);

		return { mitgezogen: mit.count, geblieben: Number(alle) - mit.count, tagId: alt.meeting_day_id };
	});

	// Die Art kann die Gliederung verschoben haben — abweichende Häuser erzeugen
	// jetzt einen Sammelpunkt, und der ändert die Nummern darunter.
	await schreibeNummern(handelnder, ergebnis.tagId);
	return { mitgezogen: ergebnis.mitgezogen, geblieben: ergebnis.geblieben };
}

/**
 * Entfernt ein Geschäft samt seiner Traktanden in allen Häusern.
 *
 * **Die Traktanden müssen mit.** Der Fremdschlüssel setzt beim Löschen eines
 * Geschäfts nur `business_id` auf NULL — die Traktanden blieben in ihren
 * Gemeinschaften stehen und würden beim nächsten Öffnen der gemeinsamen Liste
 * wieder eingesammelt. Aus «entfernen» würde «kurz verschwinden».
 */
export async function loescheGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	geschaeftId: Id
): Promise<{ titel: string; haeuser: number }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const g = await leseGeschaeftAn(tx, tagId, geschaeftId);

		const eroeffnet = await tx<{ name: string }[]>`
			SELECT DISTINCT s.name FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s   ON s.id = m.stweg_id
			 WHERE a.business_id = ${geschaeftId} AND m.state NOT IN ('entwurf', 'freigegeben')
		`;
		if (eroeffnet.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${eroeffnet.map((e) => e.name).join(', ')}. ` +
					'Aus einer eröffneten Versammlung wird ein Traktandum nicht entfernt, sondern ' +
					'zurückgezogen — das bleibt im Protokoll sichtbar.',
				'id'
			);
		}

		// Untertraktanden hängen an ihrem Elternteil und blockieren das Löschen.
		// Sie wortlos mitzulöschen hiesse, Anträge zu entfernen, die niemand
		// gemeint hat.
		const [{ kinder }] = await tx<{ kinder: number }[]>`
			SELECT count(*)::int AS kinder FROM agenda_item k
			 WHERE k.parent_id IN (SELECT id FROM agenda_item WHERE business_id = ${geschaeftId})
		`;
		if (Number(kinder) > 0) {
			throw new FachlicherFehler(
				'hat_untertraktanden',
				`Unter diesem Traktandum stehen ${kinder} Untertraktanden. Entfernen Sie diese zuerst ` +
					'in der Gemeinschaft, in der sie stehen.',
				'id'
			);
		}

		/*
		 * **Je gelöschtem Traktandum ein Entfernen-Ereignis** (Produktentscheid
		 * 01.10.2026). Bis dahin schrieb dieser Weg nur `geschaeftEntfernt` an
		 * den Abend; Anlegen und Ändern der Traktanden hingen danach an
		 * Kennungen ohne Zeile und fielen aus dem Verlauf der Versammlung, in
		 * der Anzeige wie im Siegelpaket. Die Ereignisse tragen dieselben
		 * Schlüssel wie `entferneTraktandum` (`domain/traktanden.ts`); nur so
		 * findet `gehoertZu` die Einträge zurück. Für den Altbestand dieser
		 * Löschstelle gibt es keine Zuordnung.
		 *
		 * **`RETURNING` statt einer Abfrage davor**: Die Ereignisse entstehen
		 * aus genau den Zeilen, die das `DELETE` getroffen hat. Eine Abfrage
		 * davor sähe ein Traktandum nicht, das eine gleichzeitige Änderung der
		 * Beteiligten dazwischen anlegt.
		 *
		 * **`ausVorlage` aus der Zeile, `hinweis` leer.** Auch ein Geschäft kann
		 * aus der Vorlage stammen (`vorlagen.ts` legt die Pflichttraktanden des
		 * Abends mit `from_template` an), und der Verlauf lässt sich nicht
		 * berichtigen. Einen Entfernungshinweis zeigt dieser Weg nicht, also
		 * behauptet der Eintrag auch keinen.
		 */
		const geloescht = await tx<
			{ id: string; meeting_id: string; title: string; from_template: boolean }[]
		>`
			DELETE FROM agenda_item WHERE business_id = ${geschaeftId}
			RETURNING id, meeting_id, title, from_template
		`;
		await tx`DELETE FROM business WHERE id = ${geschaeftId}`;
		const reste = await raeumeTraktandenAb(
			tx,
			geloescht.map((t) => t.id)
		);

		await schreibeVerlauf(
			tx,
			handelnder,
			geloescht.map((t) =>
				ereignis(
					EREIGNISARTEN.traktandumEntfernt,
					{ art: 'agenda_item', id: t.id },
					{
						versammlung: t.meeting_id,
						titel: t.title,
						ausVorlage: t.from_template,
						hinweis: null,
						...reste.get(t.id)
					}
				)
			)
		);

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftEntfernt,
				{ art: 'meeting_day', id: g.meeting_day_id },
				{ geschaeft: geschaeftId, titel: g.title, haeuser: geloescht.count }
			)
		);

		return { titel: g.title, haeuser: geloescht.count };
	});
}

/**
 * Bringt die Traktanden der Häuser in die Reihenfolge des Abends.
 *
 * **Ohne diesen Schritt stimmt die Nummer, aber nicht die Zeile.** Die Liste
 * einer einzelnen Versammlung wird nach `position` sortiert und mit
 * `manual_number` beschriftet. Steht das Budget am Abend an neunter Stelle,
 * bekommt es die «9» — sortiert wird es aber weiter nach der Position, die es
 * beim Anlegen bekam. Im Saal stünde dann «9» zwischen «3» und «4».
 *
 * Nur die oberste Ebene: Untertraktanden hängen an ihrem Elternteil und werden
 * dort mitgezählt (`domain/traktandenbaum.ts`).
 */
async function ordneHaeuser(
	tx: Parameters<Parameters<typeof alsBetreiber>[1]>[0],
	tagId: Id
): Promise<void> {
	const zeilen = await tx<{ id: string; meeting_id: string }[]>`
		SELECT a.id, a.meeting_id
		  FROM agenda_item a
		  JOIN meeting m ON m.id = a.meeting_id
		  LEFT JOIN business b ON b.id = a.business_id
		 WHERE m.meeting_day_id = ${tagId} AND a.parent_id IS NULL
		 ORDER BY a.meeting_id, b.position NULLS LAST, a.position, a.id
	`;

	/*
	 * Beim Umsortieren durchläuft die Liste zwangsläufig Zwischenstände, in denen
	 * zwei Zeilen dieselbe Stelle beanspruchen. Die Eindeutigkeitsbedingung wird
	 * deshalb aufgeschoben und gilt erst beim Commit — dieselbe Begründung wie
	 * beim Verschieben eines Traktandums (`traktanden.ts`). Ohne das scheiterte
	 * jedes Verschieben am Abend mit «duplicate key value».
	 */
	await tx`SET CONSTRAINTS agenda_position_je_elternteil DEFERRED`;

	const stand = new Map<string, number>();
	for (const z of zeilen) {
		const nr = (stand.get(z.meeting_id) ?? 0) + 1;
		stand.set(z.meeting_id, nr);
		await tx`UPDATE agenda_item SET position = ${nr} WHERE id = ${z.id} AND position <> ${nr}`;
	}
}

/** Die Absagen aus `achteEinladungsmehr`, die am Abend je Haus gesammelt werden. */
const ABSAGEN_DER_EINLADUNG = new Set(['versandfrist_vorbei', 'milder_als_einladung']);

/**
 * Die Absage, wenn am gemeinsamen Abend ein Haus oder mehrere das Mehr
 * abweisen: vorn, welche und dass nirgends gesetzt ist, dann jede Begründung
 * einmal mit den Häusern, für die sie gilt, zuletzt der Weg in den übrigen
 * Häusern (Laien- und Codeprüfung 06.10.2026). Je Haus lässt sich das Mehr
 * auf der Erfordernisseite des Traktandums einzeln setzen; das ist erlaubt (`abweichend` in
 * `holeGemeinsameListe`).
 */
function absageAmAbend(
	abgewiesen: { name: string; traktandum: string; fehler: FachlicherFehler }[],
	abstimmend: number
): FachlicherFehler {
	const namen = abgewiesen.map((a) => `«${a.name}»`);
	const mehrere = abgewiesen.length > 1;
	const wer = mehrere
		? `Die Gemeinschaften ${namen.slice(0, -1).join(', ')} und ${namen.at(-1)} weisen`
		: `Gemeinschaft ${namen[0]} weist`;
	const wo = abstimmend > 1 ? 'in keiner Gemeinschaft dieses Traktandums' : 'nicht';
	const teile = [`${wer} das mildere Mehr ab; gesetzt ist es deshalb ${wo}.`];
	/*
	 * **Jede Begründung einmal** (Laienprüfung zwei Sätze, Produktentscheid
	 * «Gesammelt nachbessern», 06.10.2026). Weisen mehrere Häuser aus demselben
	 * Grund ab, stand er je Haus da. Verglichen wird ohne den Vorsatz
	 * «‹Bezeichnung›»: , den die Absage aus `achteEinladungsmehr` trägt: Am Abend
	 * hat dasselbe Geschäft je Haus eine eigene Nummer (etwa 6.1 und 6.2), und
	 * der Satz oben nennt es schon «dieses Traktandum». Abgeschnitten wird genau
	 * die bekannte Bezeichnung des Hauses, nicht ein Muster (Codeprüfung N4,
	 * Korrekturrunde): Ein Titel mit «» oder »: darin bleibt so heil. Fehlt der
	 * Vorsatz, zählt die ganze Absage als Begründung.
	 *
	 * Sagen alle dasselbe, folgt die Begründung einmal ohne Namen, denn der Satz
	 * oben nennt die Häuser. Sonst steht jede Begründung einmal mit den Häusern,
	 * für die sie gilt: die Begründungen in der Folge, in der ihr erstes Haus am
	 * Abend steht, die Häuser darin in der Folge des Abends. Weist nur ein Haus
	 * ab, bleibt die Absage, wie sie ist.
	 */
	if (!mehrere) {
		teile.push(abgewiesen[0].fehler.message);
	} else {
		const begruendungen = new Map<string, string[]>();
		for (const a of abgewiesen) {
			const vorsatz = `«${a.traktandum}»: `;
			const nachricht = a.fehler.message;
			const begruendung = nachricht.startsWith(vorsatz) ? nachricht.slice(vorsatz.length) : nachricht;
			const haeuser = begruendungen.get(begruendung) ?? [];
			haeuser.push(`«${a.name}»`);
			begruendungen.set(begruendung, haeuser);
		}
		for (const [begruendung, haeuser] of begruendungen) {
			if (begruendungen.size === 1) {
				teile.push(begruendung);
				continue;
			}
			const genannt =
				haeuser.length > 1
					? `Gemeinschaften ${haeuser.slice(0, -1).join(', ')} und ${haeuser.at(-1)}`
					: `Gemeinschaft ${haeuser[0]}`;
			teile.push(`${genannt}: ${begruendung}`);
		}
	}
	if (abstimmend > abgewiesen.length) {
		teile.push(
			'In den übrigen Gemeinschaften können Sie das mildere Mehr einzeln setzen: in der ' +
				'Traktandenliste der jeweiligen Versammlung, beim Traktandum mit «Erfordernis ändern».'
		);
	}
	if (abstimmend > 1) {
		teile.push(
			'Ein Verschieben betrifft nur das Traktandum der Gemeinschaft, in der Sie verschieben.'
		);
	}
	return new FachlicherFehler(abgewiesen[0].fehler.kennung, teile.join(' '), abgewiesen[0].fehler.feld);
}

/**
 * Setzt das Mehrheitserfordernis eines bestehenden Traktandums — in allen Häusern.
 *
 * Gemeldet am 11.08.2026: «Was noch gemacht werden muss ist, dass man das Quorum
 * ändern kann, im Bestand.» Beim Erfassen liess es sich wählen; danach führte der
 * Weg nur noch über den Entscheidbaum, je Gemeinschaft einzeln.
 *
 * **Je Gemeinschaft hergeleitet, wie überall.** Gewählt wird der Fall des
 * Regelwerks; was daraus folgt, hängt am Reglement des einzelnen Hauses.
 * Kenntnisnahmen bleiben unberührt — über sie wird nicht beschlossen.
 *
 * bindung: knotenId — Ein Knoten des Regelwerks
 *   (`waehleErfordernis(holeRegelwerk(), knotenId)`), keine Kennung dieses
 *   Abends.
 */
export async function setzeErfordernisAmGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	geschaeftId: Id,
	knotenId: string
): Promise<number> {
	if (!knotenId.trim()) {
		throw new FachlicherFehler('ohne_fall', 'Wählen Sie einen Fall aus dem Regelwerk.', 'erfordernis');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		// Der Rahmen zuerst: Sonst setzte diese Handlung das Erfordernis an einem
		// Geschäft eines fremden Abends, und der Fehlschlag wäre still — die
		// Abfrage darunter fände dessen Häuser ja. Die Zeile wird gleich
		// mitgenommen; sie trägt Titel und Abend für den Verlaufseintrag.
		const geschaeft = await leseGeschaeftAn(tx, tagId, geschaeftId);
		const haeuser = await tx<
			{
				id: string;
				meeting_id: string;
				stweg_id: string;
				stweg_name: string;
				state: string;
				item_kind: string;
				title: string;
				nummer: string | null;
			}[]
		>`
			SELECT a.id, a.meeting_id, m.stweg_id, s.name AS stweg_name, m.state, a.item_kind, a.title,
			       coalesce(a.manual_number, a.released_number) AS nummer
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s   ON s.id = m.stweg_id
			 WHERE a.business_id = ${geschaeftId}
			 ORDER BY a.business_position NULLS LAST, m.day_position NULLS LAST, s.name, a.id
		`;
		if (haeuser.length === 0) {
			throw new FachlicherFehler('unbekannt', 'Das Traktandum gibt es nicht.', 'id');
		}

		/*
		 * Ab der Eröffnung nicht mehr: Nach welchem Mehr ausgezählt wird, muss vor
		 * der Abstimmung feststehen. Es danach zu ändern hiesse, das Ergebnis
		 * rückwirkend an einer anderen Schwelle zu messen.
		 */
		const eroeffnet = haeuser.filter((h) => !['entwurf', 'freigegeben'].includes(h.state));
		if (eroeffnet.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${[...new Set(eroeffnet.map((h) => h.stweg_name))].join(', ')}. ` +
					'Nach welchem Mehr ausgezählt wird, muss vor der Abstimmung feststehen.',
				'erfordernis'
			);
		}

		const gewaehlt = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
		const regeln = new Map<string, Awaited<ReturnType<typeof holeReglementsregelnIn>>>();
		const enthaltungen = new Map<string, Awaited<ReturnType<typeof holeEnthaltungseinstellungIn>>>();
		let gesetzt = 0;

		/*
		 * **Die Absage nennt die Häuser** (Entscheid 06.10.2026, «Mit dem
		 * nächsten Block»). Das Mehr der Einladung ist je Haus festgehalten
		 * (`achteEinladungsmehr`), und seine Absage nennt nur das Traktandum, das
		 * an diesem Abend in jedem Haus gleich heisst. Geprüft wird deshalb jedes
		 * Haus, jedes unter einem Sicherungspunkt, und die Abweisungen werden
		 * gesammelt; geworfen wird einmal am Schluss, mit Kennung und Feld der
		 * ersten. Die Transaktion bricht dann ganz ab, gesetzt ist in keinem Haus.
		 * In der Reihenfolge der Abendseite (`holeGemeinsameListe`), mit der
		 * Kennung als festem Nachrang (Codeprüfung 06.10.2026).
		 */
		const abstimmend = haeuser.filter((x) => x.item_kind === 'abstimmung');
		const abgewiesen: { name: string; traktandum: string; fehler: FachlicherFehler }[] = [];
		for (const h of abstimmend) {
			if (!regeln.has(h.stweg_id)) {
				regeln.set(h.stweg_id, await holeReglementsregelnIn(tx, h.stweg_id));
				enthaltungen.set(h.stweg_id, await holeEnthaltungseinstellungIn(tx, h.stweg_id));
			}
			// Je Versammlung, nicht je Haus: Ist sie freigegeben, gilt die
			// eingefrorene Lesart (Migration 169).
			const e = wendeReglementAn(
				gewaehlt,
				regeln.get(h.stweg_id)!,
				enthaltungen.get(h.stweg_id) ?? null,
				await holeLesartenIn(tx, { meetingId: h.meeting_id })
			).erfordernis;
			try {
				await tx.savepoint((sp) => schreibeErfordernisIn(sp, handelnder, h.id, e));
			} catch (f) {
				// Gesammelt werden nur die Absagen zum Mehr der Einladung; der Vorsatz
				// «weist das mildere Mehr ab» stimmte für andere nicht.
				if (!(f instanceof FachlicherFehler) || !ABSAGEN_DER_EINLADUNG.has(f.kennung)) throw f;
				// Dieselbe Bezeichnung wie in der Absage, damit der Vorsatz genau passt.
				abgewiesen.push({ name: h.stweg_name, traktandum: bezeichnung(h), fehler: f });
				continue;
			}
			gesetzt++;
		}
		if (abgewiesen.length > 0) {
			throw absageAmAbend(abgewiesen, abstimmend.length);
		}


		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftGeaendert,
				{ art: 'meeting_day', id: geschaeft.meeting_day_id },
				{ geschaeft: geschaeftId, titel: geschaeft.title, erfordernis: knotenId, haeuser: gesetzt }
			)
		);
		return gesetzt;
	});
}

/**
 * Ändert, welche Gemeinschaften ein Traktandum führen.
 *
 * Gemeldet am 11.08.2026: «Es sollte möglich sein, Gemeinschaften nachträglich
 * aus einem Traktandum zu entfernen oder hinzuzufügen.» Vorher war die Auswahl
 * beim Anlegen endgültig — wer sich vertan hatte, musste das Traktandum löschen
 * und neu anlegen, und verlor dabei die Anpassungen der übrigen Häuser.
 *
 * **Entfernt wird nur, was noch nichts entschieden hat.** Hängt an einem
 * Traktandum bereits ein Abstimmungsdurchgang, bleibt es stehen: Ein Beschluss
 * ohne Traktandum wäre im Protokoll nicht mehr zuzuordnen.
 *
 * bindung: meetingIds — Beide Hälften sind gebunden, und die Zeile nennt beide
 *   (Sicherheitsprüfung 08.09.2026): Was WEGFÄLLT, wird gegen die Zeilen aus
 *   `WHERE a.business_id = ${geschaeftId}` verglichen; was DAZUKOMMT, gegen
 *   `WHERE m.meeting_day_id = ${g.meeting_day_id} AND m.id = ANY(${neu})` mit
 *   `if (erlaubt.length !== neu.length) throw` dahinter.
 */
export async function setzeBeteiligte(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	geschaeftId: Id,
	meetingIds: Id[]
): Promise<{ dazu: string[]; weg: string[] }> {
	const ergebnis = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const g = await leseGeschaeftAn(tx, tagId, geschaeftId);

		const jetzt = await tx<
			{
				id: string;
				meeting_id: string;
				title: string;
				from_template: boolean;
				stweg_name: string;
				state: string;
			}[]
		>`
			SELECT a.id, a.meeting_id, a.title, a.from_template, s.name AS stweg_name, m.state
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			  JOIN stweg s   ON s.id = m.stweg_id
			 WHERE a.business_id = ${geschaeftId}
		`;
		const habe = new Set(jetzt.map((z) => z.meeting_id));
		const soll = new Set(meetingIds);

		if (soll.size === 0) {
			throw new FachlicherFehler(
				'ohne_gemeinschaft',
				'Mindestens eine Gemeinschaft muss bleiben. Soll das Traktandum ganz weg, nehmen Sie es ' +
					'von der Liste.',
				'meetings'
			);
		}

		// Wer dazukommt, muss an diesem Abend mittagen und noch offen für
		// Traktanden sein — dieselbe Schranke wie beim Anlegen.
		const neu = [...soll].filter((m) => !habe.has(m));
		const erlaubt = neu.length
			? await tx<{ id: string; state: string; stweg_name: string }[]>`
					SELECT m.id, m.state, s.name AS stweg_name
					  FROM meeting m JOIN stweg s ON s.id = m.stweg_id
					 WHERE m.meeting_day_id = ${g.meeting_day_id} AND m.id = ANY(${neu}::uuid[])
				`
			: [];
		if (erlaubt.length !== neu.length) {
			throw new FachlicherFehler(
				'fremde_versammlung',
				'Eine der gewählten Versammlungen tagt hier gar nicht mit.',
				'meetings'
			);
		}
		const eroeffnet = erlaubt.filter((m) => !['entwurf', 'freigegeben'].includes(m.state));
		if (eroeffnet.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${eroeffnet.map((m) => m.stweg_name).join(', ')}. ` +
					'Ein Traktandum kommt dort nur als Spontantraktandum in Betracht.',
				'meetings'
			);
		}

		const streichen = jetzt.filter((z) => !soll.has(z.meeting_id));
		const laufend = streichen.filter((z) => !['entwurf', 'freigegeben'].includes(z.state));
		if (laufend.length > 0) {
			throw new FachlicherFehler(
				'schon_eroeffnet',
				`Diese Versammlungen sind bereits eröffnet: ${laufend.map((z) => z.stweg_name).join(', ')}. ` +
					'Dort wird ein Traktandum nicht entfernt, sondern zurückgezogen — das bleibt im ' +
					'Protokoll sichtbar.',
				'meetings'
			);
		}

		// Was schon entschieden oder untergliedert ist, bleibt.
		for (const z of streichen) {
			const [{ haengt }] = await tx<{ haengt: number }[]>`
				SELECT (
					(SELECT count(*) FROM voting_round v WHERE v.agenda_item_id = ${z.id})
					+ (SELECT count(*) FROM agenda_item k WHERE k.parent_id = ${z.id})
				)::int AS haengt
			`;
			if (Number(haengt) > 0) {
				throw new FachlicherFehler(
					'haengt_daran',
					`Bei ${z.stweg_name} hängt schon etwas daran — eine Abstimmung oder ein ` +
						'Untertraktandum. Diese Gemeinschaft lässt sich nicht mehr herausnehmen.',
					'meetings'
				);
			}
		}

		if (streichen.length > 0) {
			await tx`DELETE FROM agenda_item WHERE id = ANY(${streichen.map((z) => z.id)}::uuid[])`;
			const reste = await raeumeTraktandenAb(
				tx,
				streichen.map((z) => z.id)
			);
			/*
			 * **Je entferntem Traktandum ein Entfernen-Ereignis**
			 * (Produktentscheid 01.10.2026). Die Zeile ist danach fort; nur
			 * dieses Ereignis ordnet ihre Verlaufseinträge noch der Versammlung
			 * zu, mit denselben Schlüsseln wie `entferneTraktandum`. Für den
			 * Altbestand dieser Löschstelle gibt es keine Zuordnung.
			 * `ausVorlage` kommt aus der Zeile, `hinweis` bleibt leer, wie in
			 * `loescheGeschaeft` begründet.
			 */
			await schreibeVerlauf(
				tx,
				handelnder,
				streichen.map((z) =>
					ereignis(
						EREIGNISARTEN.traktandumEntfernt,
						{ art: 'agenda_item', id: z.id },
						{
							versammlung: z.meeting_id,
							titel: z.title,
							ausVorlage: z.from_template,
							hinweis: null,
							...reste.get(z.id)
						}
					)
				)
			);
		}

		for (const m of erlaubt) {
			const [{ pos }] = await tx<{ pos: number }[]>`
				SELECT coalesce(max(position), -1) + 1 AS pos FROM agenda_item
				 WHERE meeting_id = ${m.id} AND parent_id IS NULL
			`;
			const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
			await tx`
				INSERT INTO agenda_item (id, operator_id, meeting_id, parent_id, position, title,
				                         item_kind, motion_text, body, proposer_kind, business_id)
				VALUES (${id}, ${handelnder.operatorId}, ${m.id}, NULL, ${Number(pos)}, ${g.title},
				        ${g.item_kind}, ${g.motion_text}, ${g.body}, 'gemeinschaft', ${geschaeftId})
			`;
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftGeaendert,
				{ art: 'meeting_day', id: g.meeting_day_id },
				{
					geschaeft: geschaeftId,
					titel: g.title,
					dazu: erlaubt.map((m) => m.stweg_name),
					weg: streichen.map((z) => z.stweg_name)
				}
			)
		);

		return {
			dazu: erlaubt.map((m) => m.stweg_name),
			weg: streichen.map((z) => z.stweg_name),
			tagId: g.meeting_day_id
		};
	});

	await zieheOrdnungNach(handelnder, ergebnis.tagId);
	return { dazu: ergebnis.dazu, weg: ergebnis.weg };
}

/**
 * Verschiebt eine Gemeinschaft innerhalb eines Traktandums (Ziffern 3.1, 3.2).
 *
 * **Warum das nötig ist** (Auftraggeber, 11.08.2026): «Kann ja sein, dass die Auswahl
 * uneinheitlich ist oder abweicht von anderen Abstimmungen mit denselben
 * Gemeinschaften.» Muss eine Miteigentümergemeinschaft zuerst entscheiden, damit
 * die Häuser über die Folgen befinden können, gehört sie an die erste Stelle
 * *dieses* Punktes — und nicht an die erste Stelle des ganzen Abends.
 *
 * Vorgabe bleibt der Ablauf des Abends; erst wer von Hand sortiert, schreibt
 * eigene Stellen (`business_position`).
 *
 * bindung: vorId — Die Reihenfolge wird über die Zeilen des Geschäfts gerechnet,
 *   und vor dem Verlauf wird geprüft, dass `bewegt` und `vorId` darin stehen.
 */
export async function verschiebeInGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	geschaeftId: Id,
	bewegt: Id,
	vorId: Id | null
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Der fünfte Weg derselben Klasse** (Code-Review 07.09.2026). Die
		 * Aktion `umordnen` las `params` gar nicht, und der Abend wurde hier aus
		 * der ersten gefundenen Zeile abgeleitet — also aus dem Gegenstand statt
		 * aus dem Rahmen. Damit liess sich die Ziffernfolge eines fremden Abends
		 * umstellen, samt Verlaufseintrag dort.
		 */
		await leseGeschaeftAn(tx, tagId, geschaeftId);
		const zeilen = await tx<{ id: string; stelle: number; meeting_day_id: string }[]>`
			SELECT a.id,
			       coalesce(a.business_position, m.day_position, 0) AS stelle,
			       m.meeting_day_id
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE a.business_id = ${geschaeftId}
			 ORDER BY a.business_position NULLS LAST, m.day_position NULLS LAST, a.id
		`;
		if (zeilen.length === 0) {
			throw new FachlicherFehler('unbekannt', 'Das Traktandum gibt es nicht.', 'id');
		}
		/*
		 * **Auch die bewegte Zeile und `vor` gehören zu diesem Geschäft**, wie
		 * bei `verschiebeGeschaeft`. Eine Kennung von anderswo stand nicht in
		 * `zeilen`, `neueStellen` änderte nichts, und der Verlauf hielt trotzdem
		 * «verschoben» mit ihr fest (Klasse K2; Kreuzteil des
		 * Fremdbetreiber-Durchstichs, 28.10.2026).
		 */
		const hier = new Set(zeilen.map((z) => z.id));
		if (!hier.has(bewegt)) {
			throw new FachlicherFehler('unbekannt', 'Die Gemeinschaft gehört nicht zu diesem Traktandum.', 'traktandum');
		}
		if (vorId && !hier.has(vorId)) {
			throw new FachlicherFehler('unbekannt', 'Die Zielstelle gehört nicht zu diesem Traktandum.', 'vor');
		}

		// Die gelesenen Stellen können Gleichstände enthalten (alle NULL, also die
		// Stelle des Abends). Der Kern rechnet auf der gelesenen **Reihenfolge**,
		// deshalb wird sie hier durchgezählt statt roh übernommen.
		const neu = neueStellen(
			zeilen.map((z, i) => ({ id: z.id, stelle: i })),
			bewegt,
			vorId
		);
		for (const n of neu) {
			await tx`
				UPDATE agenda_item SET business_position = ${n.stelle}
				 WHERE id = ${n.id} AND business_position IS DISTINCT FROM ${n.stelle}
			`;
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftVerschoben,
				{ art: 'meeting_day', id: tagId },
				{ geschaeft: geschaeftId, traktandum: bewegt, vor: vorId, ebene: 'gemeinschaft' }
			)
		);
	});

	// Die Ziffern hinter dem Punkt ändern sich, also auch die Protokollnummern.
	await schreibeNummern(handelnder, tagId);
}

/**
 * Bringt Reihenfolge und Nummern der Häuser auf den Stand des Abends.
 *
 * Für Aufrufer ausserhalb dieser Datei, die Traktanden an Geschäften angelegt
 * haben — die Musterübernahme etwa. Beides gehört zusammen: Die Nummer ohne die
 * Reihenfolge ergäbe eine «9» zwischen «3» und «4».
 */
export async function zieheOrdnungNach(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, (tx) => ordneHaeuser(tx, tagId));
	await schreibeNummern(handelnder, tagId);
}

/**
 * Sammelt lose Traktanden der mittagenden Versammlungen zu Geschäften ein.
 *
 * **Eine Sitzung, eine Liste** (Auftraggeber, 11.08.2026): «Ich ging davon aus, dass es
 * eine Traktandenliste für alle gibt … Auf Ebene Gemeinschaft sollte es dann nur
 * ein Abbild der Sammelversammlung geben. Dieser Kreis muss sich schliessen.»
 *
 * Lose sind sie, weil die Pflichttraktanden beim Anlegen **jeder** Versammlung
 * entstehen — sechs Gemeinschaften, sechsmal «Begrüssung», kein Bezug zum Abend.
 * Hier bekommen sie einen: gleichnamige Traktanden werden ein Geschäft, und die
 * Liste des Abends führt sie von da an.
 *
 * Läuft, wo die Kopplung entsteht (Aufnehmen in den Abend) und beim Öffnen der
 * gemeinsamen Liste — dort ist es die Reparatur des Bestands. Sie ist
 * wirkungslos, sobald nichts mehr lose ist, und rührt nichts an, was schon zu
 * einem Geschäft gehört.
 */
export async function vereinheitlicheListe(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id
): Promise<number> {
	const eingesammelt = await alsBetreiber(handelnder.operatorId, async (tx) => {
		const lose = await tx<
			{
				id: string;
				meeting_id: string;
				title: string;
				motion_text: string | null;
				item_kind: 'abstimmung' | 'kenntnisnahme';
				position: number;
			}[]
		>`
			SELECT a.id, a.meeting_id, a.title, a.motion_text, a.item_kind, a.position
			  FROM agenda_item a
			  JOIN meeting m ON m.id = a.meeting_id
			 WHERE m.meeting_day_id = ${tagId}
			   AND a.business_id IS NULL
			   AND a.parent_id IS NULL
		`;
		if (lose.length === 0) return 0;

		// Was der Abend schon führt — dort schliessen die losen zuerst an.
		const schon = await tx<{ id: string; title: string; besetzt: string[] }[]>`
			SELECT b.id, b.title,
			       coalesce(array_agg(a.meeting_id) FILTER (WHERE a.meeting_id IS NOT NULL), '{}')
			         AS besetzt
			  FROM business b
			  LEFT JOIN agenda_item a ON a.business_id = b.id
			 WHERE b.meeting_day_id = ${tagId}
			 GROUP BY b.id, b.title
		`;

		const { anschluesse, neue } = fasseZusammen(
			lose.map(
				(l): LosesTraktandum => ({
					traktandumId: l.id,
					meetingId: l.meeting_id,
					titel: l.title,
					antragswortlaut: l.motion_text,
					art: l.item_kind,
					stelle: Number(l.position)
				})
			),
			schon.map((s) => ({ geschaeftId: s.id, titel: s.title, besetzt: s.besetzt }))
		);

		for (const a of anschluesse) {
			await tx`
				UPDATE agenda_item SET business_id = ${a.geschaeftId}
				 WHERE id = ANY(${a.traktandumIds}::uuid[])
			`;
		}

		for (const v of neue) {
			const [g] = await tx<{ id: string }[]>`
				INSERT INTO business (operator_id, meeting_day_id, title, motion_text, item_kind, position)
				VALUES (${handelnder.operatorId}, ${tagId}, ${v.titel}, ${v.antragswortlaut},
				        ${v.art}, ${v.stelle})
				RETURNING id
			`;
			await tx`
				UPDATE agenda_item SET business_id = ${g.id} WHERE id = ANY(${v.traktandumIds}::uuid[])
			`;
		}

		/*
		 * Die Reihenfolge des Abends **neu** aus den Häusern ableiten, statt die
		 * Neuen hinten anzuhängen. Sonst stünde das zuerst angelegte gemeinsame
		 * Geschäft vor der Begrüssung, bloss weil es das erste `business` war —
		 * genau die Verdrehung, die «1.1 Budget 2027» unter einer bei 8 endenden
		 * Liste erzeugte. Nur beim Einsammeln: Eine von Hand gezogene Reihenfolge
		 * darf nicht bei jedem Seitenaufruf zurückspringen.
		 */
		const stellen = await tx<{ id: string; schluessel: number }[]>`
			SELECT b.id, coalesce(min(a.position), 0) AS schluessel
			  FROM business b
			  LEFT JOIN agenda_item a ON a.business_id = b.id
			 WHERE b.meeting_day_id = ${tagId}
			 GROUP BY b.id
			 ORDER BY schluessel, b.position, b.id
		`;
		for (const [i, s] of stellen.entries()) {
			await tx`UPDATE business SET position = ${i} WHERE id = ${s.id} AND position <> ${i}`;
		}

		await ordneHaeuser(tx, tagId);

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftAngelegt,
				{ art: 'meeting_day', id: tagId },
				{ eingesammelt: lose.length, geschaefte: neue.length, angeschlossen: anschluesse.length }
			)
		);

		return lose.length;
	});

	/*
	 * **Immer nachziehen, nicht nur nach dem Einsammeln.** Die feste Nummer am
	 * Traktandum ist eine Abschrift der Rechnung; ändert sich die Rechnung, ohne
	 * dass jemand etwas anlegt oder verschiebt, bleibt die Abschrift stehen.
	 * Genau das geschah am 11.08.2026, als die Gliederungsregel zurückgenommen
	 * wurde: Die gemeinsame Liste zeigte «1.1», in der Gemeinschaft stand
	 * weiterhin die «1» — wieder zwei Zählungen nebeneinander.
	 *
	 * Der Aufruf schreibt nur, was abweicht (ein UPDATE, `IS DISTINCT FROM`), und
	 * ist damit im Normalfall wirkungslos.
	 */
	await schreibeNummern(handelnder, tagId);
	return eingesammelt;
}

/**
 * Verschiebt ein Geschäft an eine andere Stelle der Liste.
 *
 * Die Reihenfolge rechnet der Kern (`neueReihenfolge`); hier wird nur
 * geschrieben — und danach die Nummerierung nachgezogen, denn sie hängt an der
 * Stelle. Beides in einem Zug: Eine Liste, deren Nummern eine Sekunde lang
 * falsch stehen, ist im Saal schlimmer als eine, die sich nicht verschieben lässt.
 *
 * bindung: vorId — Die Reihenfolge wird über die Zeilen gerechnet, die `tagId`
 *   geliefert hat; eine fremde Kennung steht nicht darin.
 */
export async function verschiebeGeschaeft(
	handelnder: Handelnder & { operatorId: string },
	tagId: Id,
	bewegt: Id,
	vorId: Id | null
): Promise<void> {
	await alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Den Abend vorweg unter dem eigenen Betreiber suchen.** Sonst fanden
		 * die Abfragen bei einem fremden Abend keine Zeile, und der Verlauf hielt
		 * trotzdem «verschoben» über ihn fest (Klasse K2; Durchstich
		 * `e2e/fremdbetreiber.mjs`, 27.10.2026).
		 */
		const [tag] = await tx`SELECT 1 FROM meeting_day WHERE id = ${tagId}`;
		if (!tag) throw new FachlicherFehler('unbekannt', 'Gemeinsame Versammlung nicht gefunden.', 'tagId');
		const zeilen = await tx<{ id: string; position: number }[]>`
			SELECT id, position FROM business WHERE meeting_day_id = ${tagId} ORDER BY position
		`;
		/*
		 * **Auch das bewegte Geschäft und `vor` gehören zu diesem Abend.** Eine
		 * Kennung von anderswo stand nicht in `zeilen`, `neueReihenfolge` änderte
		 * nichts, und der Verlauf hielt trotzdem «verschoben» mit ihr fest
		 * (Klasse K2; Kreuzteil des Fremdbetreiber-Durchstichs, 27.10.2026).
		 */
		const hier = new Set(zeilen.map((z) => z.id));
		if (!hier.has(bewegt)) {
			throw new FachlicherFehler('unbekannt', 'Das Geschäft gehört nicht zu dieser gemeinsamen Versammlung.', 'geschaeft');
		}
		if (vorId && !hier.has(vorId)) {
			throw new FachlicherFehler('unbekannt', 'Die Zielstelle gehört nicht zu dieser gemeinsamen Versammlung.', 'vor');
		}
		const neu = neueReihenfolge(
			zeilen.map((z) => ({ geschaeftId: z.id, stelle: Number(z.position) })),
			bewegt,
			vorId
		);
		for (const g of neu) {
			await tx`UPDATE business SET position = ${g.stelle} WHERE id = ${g.geschaeftId}`;
		}
		// Die Häuser ziehen mit: Die Nummer allein genügt nicht, sortiert wird dort
		// nach der Position.
		await ordneHaeuser(tx, tagId);
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.geschaeftVerschoben,
				{ art: 'meeting_day', id: tagId },
				{ geschaeft: bewegt, vor: vorId }
			)
		);
	});

	await schreibeNummern(handelnder, tagId);
}
