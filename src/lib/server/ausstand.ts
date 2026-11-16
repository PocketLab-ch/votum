/**
 * Der Ausstand je Traktandum (PRD §13; ZGB Art. 68 i.V.m. Art. 712m Abs. 2).
 *
 * **Was er ist.** Wer über ein Geschäft mitentscheiden soll, das ihn selbst
 * betrifft — ein Rechtsgeschäft oder ein Rechtsstreit zwischen ihm und der
 * Gemeinschaft —, ist von Gesetzes wegen vom Stimmrecht ausgeschlossen. Er
 * stimmt nicht.
 *
 * **Was er an den Zahlen ändert, hängt an der Grösse.** Aus der Kopfbasis fällt
 * er, ausser bei der gemeinsamen Wohnung eines Beklagten und, an der
 * Ausschlussklage, bei Angehörigen des Beklagten (1e). Seine Wertquote fällt
 * unter der Quotenbasis der Anwesenden aus der Bezugsgrösse; unter «alle
 * Wertquoten» bleibt sie nach der Vorgabe von L1 im Nenner, nach «fällt
 * heraus» sinkt der Nenner um sie (Migration 170; Einzelheiten bei
 * `imAusstand`, `kommtInDerZaehlungVor` und `ausstandsabzug` in
 * `domain/auszaehlung.ts`).
 * Für die Beschlussfähigkeit zählt er weiter als anwesend, ebenso wer nur über
 * einen Ausgeschlossenen vertreten ist und dessen Vollmacht deshalb ruht
 * (Wermelinger Rz. 17 ad Art. 712p). Die Feststellung liest weder Ausstand
 * noch ruhende Vollmacht; die Proben in `tests/db/ausstand.test.ts` messen den
 * Ausstand direkt und die ruhende Vollmacht am Beklagten der Ausschlussklage.
 * **Seit L7** (Migration 183) gilt das nach der Vorgabe «Zählt mit»; unter
 * «Zählt nicht mit» prüft das Eröffnen zusätzlich die Beschlussfähigkeit ohne
 * diese Personen (`ausstandsbefund`, `holeBeschlussfaehigkeitOhneAusstand`),
 * die Feststellung selbst bleibt unverändert.
 * Bis zum 16.10.2026 stand hier «er zählt nicht mit» (Erhebung zur Freigabe,
 * Ä-25).
 *
 * **Was er nicht ist.** Keine Enthaltung: Die bleibt in der Bezugsgrösse und
 * wirkt dort wie ein Nein. Und nicht die «unmittelbar Betroffenen» aus dem
 * Entscheidbaum (ZGB Art. 649b Abs. 2, Art. 712e Abs. 2) — deren Zustimmung ist
 * **nötig**, sie sind also gerade nicht ausgeschlossen.
 *
 * **Er wird erklärt, nicht hergeleitet.** Ob ein Geschäft jemanden persönlich
 * betrifft, ist eine Rechtsfrage im Einzelfall; der Entscheidbaum klammert sie
 * aus. Die Sitzungsleitung erklärt den Ausstand mit Begründung, und beides steht
 * im Verlauf und in der Auswertung.
 */
import postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { verlangeZustand } from '$lib/domain/versammlung';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { VERWALTUNG_AUSSTAND_NICHT_ZURUECK } from '$lib/domain/mehrhinweise';
import { fremdesTraktandum } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { abbrechenStattSchliessen } from '$lib/domain/abstimmung';
import {
	istVertreterkennung,
	VERTRETERKENNUNG_VORSATZ,
	vertreterkennung,
	vollmachtsschluessel
} from '$lib/domain/vollmacht';

type Tx = postgres.TransactionSql;

/**
 * Verlangt, dass über dieses Traktandum gerade nicht abgestimmt wird.
 *
 * **Eine Stelle für beide Richtungen** (Code-Review 07.09.2026). Erklären und
 * Zurücknehmen verschieben dieselbe Grösse, nur gegenläufig, und
 * `schliesseAbstimmung` liest die Ausstände beim Zählen frisch aus `recusal`:
 * Wer mitten im Durchgang etwas daran ändert, verschiebt die Bezugsgrösse
 * unter den bereits abgegebenen Stimmen. Bis zum 07.09.2026 stand die Sperre
 * nur beim Erklären.
 *
 * **Der Ausweg gehört in die Absage** und muss es auch geben. «Stimmen Sie neu
 * ab» stand hier und war falsch: `oeffneAbstimmung` weist einen zweiten
 * Durchgang ab, solange kein angenommener Rückkommensantrag vorliegt. Der Weg,
 * den es wirklich gibt, ist der Abbruch ohne Ergebnis (H6,
 * `brecheAbstimmungAb`): Danach gibt die Leitung neu frei. Bis zu H6 hiess er
 * «Neuabstimmung ansetzen»; seither überholt die Leitung kein verkündetes
 * Ergebnis mehr, und das Schliessen verkündet.
 */
async function verlangeKeinenOffenenDurchgang(
	tx: Tx,
	traktandumId: Id,
	folge: string,
	feld: string
): Promise<void> {
	const [offen] = await tx<{ id: string }[]>`
		SELECT id FROM voting_round
		WHERE agenda_item_id = ${traktandumId} AND closed_at IS NULL AND superseded_at IS NULL
	`;
	if (!offen) return;
	throw new FachlicherFehler(
		'durchgang_offen',
		`Über dieses Traktandum wird gerade abgestimmt. ${folge} ` +
			abbrechenStattSchliessen('den Ausstand'),
		feld
	);
}

export interface Ausstand {
	id: string;
	/**
	 * Die Partei im Ausstand, oder bei einem Vertreter ohne Partei dessen
	 * Kennung (`vertreterkennung`, Migration 167). Dieselbe Kennung, die die
	 * Zählung in `imAusstand` führt.
	 */
	parteiId: string;
	/** Ein Vertreter, der nicht Eigentümer ist (Ä-26). */
	vertreter: boolean;
	name: string;
	grund: string;
	erklaertAm: string;
	erklaertDurch: string;
}

/** Wer bei diesem Traktandum im Ausstand ist. */
export async function holeAusstand(operatorId: Id, traktandumId: Id): Promise<Ausstand[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				party_id: string | null;
				holder_name: string | null;
				holder_key: string | null;
				name: string | null;
				grund: string;
				erklaert_am: Date;
				erklaert_durch: string;
			}[]
		>`
			SELECT r.id, r.party_id, r.holder_name, r.holder_key, p.display_name AS name, r.grund,
			       r.erklaert_am, r.erklaert_durch
			FROM recusal r
			LEFT JOIN party p ON p.id = r.party_id
			WHERE r.agenda_item_id = ${traktandumId}
			ORDER BY r.erklaert_am
		`;
		return zeilen.map((z) => ({
			id: z.id,
			parteiId: z.party_id ?? VERTRETERKENNUNG_VORSATZ + (z.holder_key ?? ''),
			vertreter: z.party_id === null,
			// Der Name kommt aus den Stammdaten; fehlt die Partei dort, bleibt die
			// Kennung stehen statt einer leeren Zeile. Beim Vertreter ohne Partei
			// der Name aus der Vollmacht, eingefroren beim Erklären.
			name: z.holder_name ?? z.name ?? z.party_id ?? '',
			grund: z.grund,
			erklaertAm: new Date(z.erklaert_am).toISOString(),
			erklaertDurch: z.erklaert_durch
		}));
	});
}

/**
 * Erklärt den Ausstand einer Partei bei einem Traktandum.
 *
 * **Vor der Abstimmung.** Läuft der Durchgang bereits, wären Stimmen im Spiel,
 * die nachträglich aus der Bezugsgrösse fielen — dann stünde ein Ergebnis da,
 * das mit anderen Zahlen zustande kam als denen, die im Saal an der Wand
 * standen. Der Ausstand gehört davor, und die Absage nennt den Ausweg.
 */
export async function erklaereAusstand(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id,
	parteiId: Id,
	grund: string
): Promise<Ausstand> {
	const begruendung = grund.trim();
	if (zeichenzahl(begruendung) < 3) {
		throw new FachlicherFehler(
			'grund_fehlt',
			'Der Grund des Ausstands ist anzugeben. Er verändert die Zahl, gegen die gemessen wird — ' +
				'ohne ihn liesse sich später nicht sagen, ob das gewollt war.',
			'grund'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand(
			{ zustand: m.state as never },
			['entwurf', 'freigegeben', 'laufend'],
			'einen Ausstand erklären'
		);

		// `FOR KEY SHARE`: `recusal` hat keinen Fremdschlüssel aufs Traktandum,
		// also nimmt der INSERT diese Sperre nicht von selbst. Ohne sie fiele
		// eine Erklärung, die neben dem Löschen läuft, durch dessen Abräumen
		// (`server/traktandenreste.ts`).
		const [t] = await tx<{ id: string; title: string }[]>`
			SELECT id, title FROM agenda_item
			WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			FOR KEY SHARE
		`;
		if (!t) {
			throw fremdesTraktandum('traktandum');
		}

		await verlangeKeinenOffenenDurchgang(
			tx,
			traktandumId,
			'Ein Ausstand jetzt verschöbe die Bezugsgrösse unter den laufenden Stimmen weg.',
			'traktandum'
		);

		if (istVertreterkennung(parteiId)) {
			return erklaereVertreterausstand(tx, handelnder, meetingId, t, parteiId, begruendung);
		}

		/*
		 * **Die Partei muss zu dieser Versammlung gehören** (Kernbindungswächter,
		 * 08.09.2026). Die erste Fassung fragte nur `WHERE id = ${parteiId}`.
		 * `party` trennt der Zeilenschutz nach **Betreiber**, nicht nach
		 * Gemeinschaft — und die Kennung kommt aus dem Formular
		 * (`daten.getAll('partei')` in `leitung/+page.server.ts`). Wer zwei
		 * Gemeinschaften verwaltet, konnte damit eine fremde Partei in dieser
		 * Versammlung in den Ausstand setzen: Die Zeile in `recusal` entstand,
		 * die Stimmsperre rechnete mit ihr, und im Saal stand ein Name, der
		 * nicht dazugehört.
		 *
		 * Gebunden wird über die Gemeinschaft der Versammlung, nicht über die
		 * Momentaufnahme: Der Ausstand wird auch vor der Freigabe erklärt, und
		 * dann gibt es noch keine Momentaufnahme.
		 */
		const [partei] = await tx<{ display_name: string }[]>`
			SELECT p.display_name
			FROM party p
			JOIN meeting m ON m.stweg_id = p.stweg_id
			WHERE p.id = ${parteiId} AND m.id = ${meetingId}
		`;
		if (!partei) {
			throw new FachlicherFehler(
				'unbekannt',
				'Diese Partei gehört nicht zu dieser Versammlung.',
				'partei'
			);
		}

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const [zeile] = await tx<{ erklaert_am: Date }[]>`
			INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, party_id,
			                     grund, erklaert_durch)
			VALUES (${id}, ${handelnder.operatorId}, ${meetingId}, ${traktandumId}, ${parteiId},
			        ${begruendung}, ${handelnder.label})
			ON CONFLICT (agenda_item_id, party_id) DO NOTHING
			RETURNING erklaert_am
		`;
		if (!zeile) {
			throw new FachlicherFehler(
				'schon_erklaert',
				`Für «${partei.display_name}» ist bei diesem Traktandum bereits ein Ausstand erklärt.`,
				'partei'
			);
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.ausstandErklaert,
				{ art: 'agenda_item', id: traktandumId },
				{ partei: partei.display_name, parteiId, traktandum: t.title, grund: begruendung }
			)
		);

		return {
			id,
			parteiId,
			vertreter: false,
			name: partei.display_name,
			grund: begruendung,
			erklaertAm: new Date(zeile.erklaert_am).toISOString(),
			erklaertDurch: handelnder.label
		};
	});
}

/**
 * Der Ausstand eines Vertreters, der nicht Eigentümer ist (Migration 167,
 * Ä-26; Produktentscheid 17.10.2026).
 *
 * **Woran er gebunden wird.** An eine Vollmacht dieser Versammlung, die noch
 * gilt oder gelten kann (erfasst oder bestätigt) und auf jemanden lautet, der
 * keine Partei ist. Dieselbe Bindung wie bei der Partei (Kernbindungswächter):
 * Die Kennung kommt aus dem Formular, und ohne sie entstünde ein Ausstand für
 * einen Namen, den in dieser Versammlung niemand trägt. Gelesen unter dem
 * Zeilenschutz des Betreibers und eingeschränkt auf die Versammlung.
 *
 * **Was er bewirkt**, steht in der Zählung: Die Vollmachten dieses Vertreters
 * ruhen bei diesem Traktandum (`ruhendeVertretungenBei`). Eine eigene Stimme hat
 * er nicht, aus keiner Bezugsgrösse fällt jemand.
 */
async function erklaereVertreterausstand(
	tx: Tx,
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	t: { id: string; title: string },
	kennung: string,
	begruendung: string
): Promise<Ausstand> {
	const namen = await tx<{ holder_name: string }[]>`
		SELECT DISTINCT holder_name FROM proxy
		WHERE meeting_id = ${meetingId} AND holder_id IS NULL AND holder_name IS NOT NULL
		  AND state IN ('erfasst', 'bestaetigt')
		ORDER BY holder_name
	`;
	const treffer = namen.find((n) => vertreterkennung(n.holder_name) === kennung);
	if (!treffer) {
		throw new FachlicherFehler(
			'unbekannt',
			'In dieser Versammlung hält niemand unter diesem Namen eine Vollmacht.',
			'partei'
		);
	}
	const name = treffer.holder_name.trim();

	const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
	const [zeile] = await tx<{ erklaert_am: Date }[]>`
		INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, holder_key, holder_name,
		                     grund, erklaert_durch)
		VALUES (${id}, ${handelnder.operatorId}, ${meetingId}, ${t.id},
		        ${vollmachtsschluessel(name)}, ${name}, ${begruendung}, ${handelnder.label})
		ON CONFLICT (agenda_item_id, holder_key) WHERE holder_key IS NOT NULL DO NOTHING
		RETURNING erklaert_am
	`;
	if (!zeile) {
		throw new FachlicherFehler(
			'schon_erklaert',
			`Für «${name}» ist bei diesem Traktandum bereits ein Ausstand erklärt.`,
			'partei'
		);
	}

	await schreibeVerlauf(
		tx,
		handelnder,
		ereignis(
			EREIGNISARTEN.ausstandErklaert,
			{ art: 'agenda_item', id: t.id },
			{ partei: name, vertreter: true, traktandum: t.title, grund: begruendung }
		)
	);

	return {
		id,
		parteiId: kennung,
		vertreter: true,
		name,
		grund: begruendung,
		erklaertAm: new Date(zeile.erklaert_am).toISOString(),
		erklaertDurch: handelnder.label
	};
}

/**
 * Nimmt einen Ausstand zurück.
 *
 * Kommt vor: Die Sitzungsleitung erklärt ihn, jemand widerspricht, die
 * Versammlung klärt die Frage. Die Rücknahme steht im Verlauf — sie verändert
 * die Bezugsgrösse zurück, und das darf nicht spurlos geschehen.
 *
 * **Gibt zurück, ob ein Ausstand zurückgenommen wurde**, wie
 * `hebePapierabgabeAuf`. Findet sich keiner an dieser Versammlung (zweiter
 * Klick, gleichzeitiges Löschen, eine Kennung von anderswo), ändert sich
 * nichts, und die Aktion darf das nicht als Rücknahme melden (Kreuzteil des
 * Fremdbetreiber-Durchstichs, 27.10.2026: drei Wege meldeten Erfolg).
 */
export async function nimmAusstandZurueck(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	ausstandId: Id
): Promise<boolean> {
	/*
	 * **Der Ausstand aus L8 steht in keiner Zeile der Tabelle** (Lauf 4,
	 * 07.11.2026): Seine Kennung trägt den Vorsatz `l8:` vor der
	 * Vertreterkennung, und die Suche nach einer Zeile fände nichts — die
	 * Absage «kein Ausstand mehr eingetragen» wäre falsch, denn die Liste
	 * zeigt ihn ja. Der Server weist ihn deshalb mit dem eigenen Satz ab,
	 * nicht nur die Maske, die den Knopf nicht anbietet; der Weg, der das
	 * Ruhen wirklich ändert, ist das Häkchen an der Vollmacht.
	 */
	if (ausstandId.startsWith('l8:')) {
		throw new FachlicherFehler(
			'ausstand_aus_einstellung',
			VERWALTUNG_AUSSTAND_NICHT_ZURUECK,
			'ausstand'
		);
	}
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [m] = await tx<{ state: string }[]>`SELECT state FROM meeting WHERE id = ${meetingId}`;
		if (!m) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		verlangeZustand(
			{ zustand: m.state as never },
			['entwurf', 'freigegeben', 'laufend'],
			'einen Ausstand zurücknehmen'
		);

		const [zeile] = await tx<
			{
				agenda_item_id: string;
				party_id: string | null;
				holder_name: string | null;
				grund: string;
				name: string | null;
			}[]
		>`
			SELECT r.agenda_item_id, r.party_id, r.holder_name, r.grund, p.display_name AS name
			FROM recusal r LEFT JOIN party p ON p.id = r.party_id
			WHERE r.id = ${ausstandId} AND r.meeting_id = ${meetingId}
		`;
		if (!zeile) return false;

		/*
		 * **Neu seit dem 07.09.2026.** Hier stand keine Sperre, obwohl die
		 * Rücknahme dieselbe Grösse verschiebt wie das Erklären. Auffällig war
		 * der Weg nicht: Der Knopf «Zurücknehmen» stand in der linken
		 * Ablaufspalte, und die blendet der Saal-Modus bei offener Abstimmung
		 * aus. Das war eine Anzeige, keine Sperre — und mit dem Umzug des
		 * Arbeitsblocks in die rechte Spalte war sie weg.
		 */
		await verlangeKeinenOffenenDurchgang(
			tx,
			zeile.agenda_item_id,
			'Eine Rücknahme jetzt liesse die Bezugsgrösse unter den laufenden Stimmen wachsen.',
			'ausstand'
		);

		// Hat ein gleichzeitiges Löschen des Traktandums die Zeile schon
		// abgeräumt, steht sie dort im Verlauf (`server/traktandenreste.ts`);
		// eine zweite Spur als Rücknahme wäre falsch.
		const weg = await tx`DELETE FROM recusal WHERE id = ${ausstandId} RETURNING id`;
		if (weg.length === 0) return false;

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.ausstandZurueckgenommen,
				{ art: 'agenda_item', id: zeile.agenda_item_id },
				zeile.party_id === null
					? { partei: zeile.holder_name, vertreter: true, grund: zeile.grund }
					: { partei: zeile.name ?? zeile.party_id, parteiId: zeile.party_id, grund: zeile.grund }
			)
		);
		return true;
	});
}

/** Ein Vertreter, der keine Partei ist, mit den Parteien, die er vertritt (Ä-26). */
export interface VertreterOhnePartei {
	/** `vertreterkennung` des Namens; dieselbe Kennung wie in der Zählung. */
	kennung: string;
	name: string;
	vertritt: string[];
}

/**
 * Die Vertreter ohne Partei dieser Versammlung, zur Wahl beim Ausstand
 * (Migration 167, Ä-26). Gezählt werden Vollmachten, die gelten oder gelten
 * können (erfasst oder bestätigt), dieselbe Menge, an die
 * `erklaereVertreterausstand` bindet.
 */
export async function holeVertreterOhnePartei(
	operatorId: Id,
	meetingId: Id
): Promise<VertreterOhnePartei[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ holder_name: string; vertretene: string }[]>`
			SELECT x.holder_name, rp.display_name AS vertretene
			FROM proxy x
			JOIN snapshot_party rp ON rp.id = x.represented_id
			WHERE x.meeting_id = ${meetingId} AND x.holder_id IS NULL AND x.holder_name IS NOT NULL
			  AND x.state IN ('erfasst', 'bestaetigt')
			ORDER BY x.holder_name, rp.display_name
		`;
		const je = new Map<string, VertreterOhnePartei>();
		for (const z of zeilen) {
			const name = z.holder_name.trim();
			if (!name) continue;
			const kennung = vertreterkennung(name);
			const v = je.get(kennung) ?? { kennung, name, vertritt: [] };
			v.vertritt.push(z.vertretene);
			je.set(kennung, v);
		}
		return [...je.values()];
	});
}

/**
 * Welche Vollmachten ein erklärter Ausstand bei diesem Traktandum ruhen lässt,
 * je Ausstand die Namen der Vertretenen (Ä-26, Produktentscheid 17.10.2026:
 * den Ausstand schon vorab erklären).
 *
 * **Nach den Vollmachten, nicht nach der Anwesenheit.** Am Abend nennt die
 * Leitungsseite, was im Augenblick ruht (`ruhendeVertretungenBei`, über den
 * Anwesenheitsstand). Vorher ist niemand anwesend; hier steht, wessen Stimme
 * ruhen wird, wenn die Vollmacht so bleibt. Erfasst und bestätigt zählen,
 * zurückgewiesene und widerrufene nicht.
 */
export async function holeVollmachtenImAusstand(
	operatorId: Id,
	meetingId: Id,
	ausstand: Pick<Ausstand, 'id' | 'parteiId' | 'vertreter'>[]
): Promise<Map<string, string[]>> {
	if (ausstand.length === 0) return new Map();
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{ halter_partei: string | null; holder_name: string | null; vertretene: string }[]
		>`
			SELECT hp.party_id AS halter_partei, x.holder_name, rp.display_name AS vertretene
			FROM proxy x
			JOIN snapshot_party rp ON rp.id = x.represented_id
			LEFT JOIN snapshot_party hp ON hp.id = x.holder_id
			WHERE x.meeting_id = ${meetingId} AND x.state IN ('erfasst', 'bestaetigt')
			ORDER BY rp.display_name
		`;
		const ergebnis = new Map<string, string[]>();
		for (const a of ausstand) {
			const vertretene = zeilen
				.filter((z) =>
					a.vertreter
						? z.halter_partei === null && vertreterkennung(z.holder_name ?? '') === a.parteiId
						: z.halter_partei === a.parteiId
				)
				.map((z) => z.vertretene);
			if (vertretene.length > 0) ergebnis.set(a.id, vertretene);
		}
		return ergebnis;
	});
}
