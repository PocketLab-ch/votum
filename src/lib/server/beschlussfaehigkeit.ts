/**
 * Die Feststellung der Beschlussfähigkeit festhalten (ZGB Art. 712p).
 *
 * **Der Anlass, am 24.08.2026.** Aus dem Prüflauf am gemeinsamen Abend: «ich
 * habe bei Traktandum 1 auf Abstimmung gedrückt und diese Meldung erhalten. Die
 * Beschlussfähigkeit sollte einfach festgehalten werden können.»
 *
 * Bis hierher rechnete das Protokoll sie beim Erzeugen aus dem **momentanen**
 * Anwesenheitsstand. Wer um neun ging, veränderte damit rückwirkend die Zahl,
 * die um fünf festgestellt worden war — bei einem Traktandum, das genau diese
 * Feststellung zum Gegenstand hat.
 *
 * **Die Rechnung bleibt, wo sie war.** Der Kern stellt fest
 * (`stelleBeschlussfaehigkeitFest`); dieses Modul hält nur fest, was er
 * gerechnet hat. Eine zweite Rechnung hier wäre die Gelegenheit, dass Anzeige
 * und Protokoll verschiedene Zahlen zeigen.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { holeUebersicht } from './anwesenheit';
import { holeAnwesenheitsregeln } from './reglement';
import { holeVersammlung } from './versammlungen';
import {
	stelleBeschlussfaehigkeitFest,
	type Beschlussfaehigkeitsregel,
	type Beteiligung,
	type Feststellung
} from '$lib/domain/beschlussfaehigkeit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdesTraktandum } from '$lib/domain/fehler';
import type { Id } from '$lib/domain/types';

interface Zeile {
	id: string;
	meeting_id: string;
	agenda_item_id: string | null;
	recorded_at: Date;
	recorded_by: string;
	head_present: string;
	head_total: string;
	owner_present: string | null;
	owner_total: string | null;
	quota_present: string;
	quota_total: string;
	is_quorate: boolean;
	basis: 'gesetz' | 'reglement';
	reference: string | null;
	shortfall: string | null;
}

/**
 * `numeric` kommt als Zeichenkette zurück.
 *
 * Ohne diese Umwandlung stünde im Protokoll «5000 von 5000» erst nach einer
 * stillschweigenden Umwandlung durch die Anzeige — und `5000 > 4595` wäre als
 * Zeichenkettenvergleich falsch. Dieselbe Falle wie bei jeder numeric-Spalte.
 */
function zahl(wert: string): number {
	return Number(wert);
}

function ausDb(z: Zeile): Feststellung {
	return {
		id: z.id,
		versammlungId: z.meeting_id,
		traktandumId: z.agenda_item_id,
		zeitpunkt: z.recorded_at,
		durch: z.recorded_by,
		kopfstimmenAnwesend: zahl(z.head_present),
		kopfstimmenGesamt: zahl(z.head_total),
		eigentuemerAnwesend: z.owner_present === null ? null : zahl(z.owner_present),
		eigentuemerGesamt: z.owner_total === null ? null : zahl(z.owner_total),
		quotenAnwesend: zahl(z.quota_present),
		gesamtquote: zahl(z.quota_total),
		beschlussfaehig: z.is_quorate,
		grundlage: z.basis,
		fundstelle: z.reference,
		fehlt: z.shortfall
	};
}

/** Alle Feststellungen einer Versammlung, älteste zuerst. */
export async function holeFeststellungen(
	operatorId: Id,
	meetingId: Id
): Promise<Feststellung[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<Zeile[]>`
			SELECT * FROM quorum_finding WHERE meeting_id = ${meetingId} ORDER BY recorded_at, id
		`;
		return zeilen.map(ausDb);
	});
}

/**
 * Hält fest, was jetzt gilt.
 *
 * **Warum die Versammlung dafür laufen muss.** Vor der Eröffnung gibt es keine
 * Versammlung, deren Beschlussfähigkeit festzustellen wäre — nur einen Saal,
 * der sich füllt. Die Zahl dort ist eine Auskunft für die Sitzungsleitung, kein
 * Befund; sie steht auf der Anwesenheitsseite und braucht keinen Beleg.
 *
 * **Warum mehrere Feststellungen erlaubt sind.** Beschlussfähig ist die
 * Versammlung nicht einmal, sondern für jeden Beschluss. Nach der Pause ist der
 * Stand ein anderer, und vor einem schweren Traktandum will man ihn schwarz auf
 * weiss. Jede Feststellung bleibt stehen (AD-5); das Protokoll zeigt die erste
 * im Kopf und die weiteren im Ablauf.
 */
export async function halteBeschlussfaehigkeitFest(
	handelnder: Handelnder & { operatorId: string },
	meetingId: Id,
	traktandumId: Id | null = null
): Promise<Feststellung> {
	const versammlung = await holeVersammlung(handelnder.operatorId, meetingId);
	if (!versammlung) {
		throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'id');
	}
	/*
	 * Eigener Satz statt `verlangeZustand`: Dessen Vorlage lautet «lässt sich
	 * nicht {handlung}» und ergäbe «lässt sich nicht die Beschlussfähigkeit
	 * festhalten». Und der Weg heraus gehört dazu — im Saal nützt ein «geht
	 * nicht» wenig.
	 */
	if (versammlung.zustand !== 'laufend') {
		throw new FachlicherFehler(
			'nicht_laufend',
			versammlung.zustand === 'freigegeben'
				? 'Die Versammlung ist noch nicht eröffnet. Festgestellt wird ab der Eröffnung — vorher '
					+ 'füllt sich der Saal noch, und die Zahl von jetzt gälte für nichts.'
				: 'Die Versammlung läuft nicht mehr. Was während der Sitzung festgestellt wurde, steht '
					+ 'im Protokoll.',
			'zustand'
		);
	}

	const [uebersicht, regeln] = await Promise.all([
		holeUebersicht(handelnder.operatorId, meetingId),
		holeAnwesenheitsregeln(handelnder.operatorId, versammlung.stwegId)
	]);
	if (!uebersicht) {
		throw new FachlicherFehler(
			'ohne_momentaufnahme',
			'Für diese Versammlung ist keine Anwesenheitsliste angelegt — ohne sie gibt es nichts festzustellen.',
			'anwesenheit'
		);
	}

	const befund = stelleBeschlussfaehigkeitFest(
		versammlung.stufe,
		{
			eigentuemerGesamt: uebersicht.eigentuemerGesamt,
			eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
			kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
			kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
			gesamtquote: uebersicht.gesamtquote,
			quotenAnwesend: uebersicht.quotenAnwesend,
			einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
		},
		regeln[versammlung.stufe] ?? null
	);

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Das Traktandum muss zu dieser Versammlung gehören** (Kernbindungs-
		 * wächter, 08.09.2026). `quorum_finding` schreibt `meeting_id` und
		 * `agenda_item_id` nebeneinander; ohne diese Prüfung entstünde eine
		 * Feststellung dieser Versammlung, die auf ein Traktandum einer anderen
		 * zeigt. Heute kommt die Kennung an beiden Aufrufstellen aus einem
		 * serverseitigen Lesevorgang — die Zusicherung fehlte trotzdem, und der
		 * nächste Aufrufer hätte sie wieder nicht.
		 *
		 * **In derselben Transaktion wie der INSERT** (Code-Review 08.09.2026):
		 * Eine eigene prüfte einen Zustand, den sie beim Schreiben nicht mehr
		 * hält, und kostete in `halteAmAbendFest` eine Transaktion je Haus.
		 */
		if (traktandumId) {
			const [z] = await tx<{ id: string }[]>`
				SELECT id FROM agenda_item
				WHERE id = ${traktandumId} AND meeting_id = ${meetingId}
			`;
			if (!z) {
				throw fremdesTraktandum('traktandum');
			}
		}

		const [neu] = await tx<Zeile[]>`
			INSERT INTO quorum_finding
				(operator_id, meeting_id, agenda_item_id, recorded_by,
				 head_present, head_total, owner_present, owner_total,
				 quota_present, quota_total,
				 is_quorate, basis, reference, shortfall)
			VALUES (
				${handelnder.operatorId},
				${meetingId},
				${traktandumId},
				${handelnder.label},
				${uebersicht.kopfstimmenAnwesend},
				${uebersicht.kopfstimmenGesamt},
				${uebersicht.eigentuemerAnwesend},
				${uebersicht.eigentuemerGesamt},
				${uebersicht.quotenAnwesend},
				${uebersicht.gesamtquote},
				${befund.beschlussfaehig},
				${befund.grundlage},
				${befund.fundstelle ?? null},
				${befund.beschlussfaehig ? null : befund.fehlt}
			)
			RETURNING *
		`;

		await schreibeVerlauf(tx, handelnder, [
			ereignis(
				EREIGNISARTEN.beschlussfaehigkeitFestgestellt,
				{ art: 'meeting', id: meetingId },
				{
					beschlussfaehig: befund.beschlussfaehig,
					// Beides in den Verlauf: Die Beschlussfähigkeit hängt an den
					// Eigentümern, die Mehrheit an den Kopfstimmen.
					eigentuemer: `${uebersicht.eigentuemerAnwesend} von ${uebersicht.eigentuemerGesamt}`,
					kopfstimmen: `${uebersicht.kopfstimmenAnwesend} von ${uebersicht.kopfstimmenGesamt}`,
					wertquoten: `${uebersicht.quotenAnwesend} von ${uebersicht.gesamtquote}`,
					grundlage: befund.grundlage,
					fundstelle: befund.fundstelle ?? null,
					fehlt: befund.beschlussfaehig ? null : befund.fehlt,
					traktandum: traktandumId
				}
			)
		]);

		// Das Merkmal steht nicht in der Zeile; es kommt aus der Momentaufnahme
		// und gilt für den Satz in der Rückmeldung (`docs/entscheide/0016`).
		return { ...ausDb(neu), einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam };
	});
}

/**
 * Ob die Anwesenden schon das Quorum einer ersten Versammlung erreichen
 * (Art. 712p Abs. 1, mit einer erschwerenden Reglementsregel).
 *
 * **Wozu** (Ä-17 B, Fachprüfung 18.10.2026): An einer zweiten Versammlung ist
 * offen, ob für ein neues Traktandum das Drittel genügt. Erreicht der Saal das
 * Quorum der ersten, ist die Frage ohne Folge, und die Leitung zeigt den
 * Hinweis nicht. Ohne Anwesenheitsliste: nein.
 */
export async function erreichtQuorumEinerErsten(operatorId: Id, meetingId: Id): Promise<boolean> {
	const versammlung = await holeVersammlung(operatorId, meetingId);
	if (!versammlung) return false;
	const [uebersicht, regeln] = await Promise.all([
		holeUebersicht(operatorId, meetingId),
		holeAnwesenheitsregeln(operatorId, versammlung.stwegId)
	]);
	return quorumEinerErstenErreicht(uebersicht, regeln.erste ?? null);
}

/**
 * Die Rechnung zu `erreichtQuorumEinerErsten` für einen Aufrufer, der
 * Übersicht und Regeln schon geladen hat (Leitung eines Hauses). Eine Stelle,
 * damit die beiden nicht auseinanderlaufen (Featureprüfung 3b bis 3e).
 */
export function quorumEinerErstenErreicht(
	uebersicht: Beteiligung | null,
	regelErste: Beschlussfaehigkeitsregel | null
): boolean {
	if (!uebersicht) return false;
	return stelleBeschlussfaehigkeitFest(
		'erste',
		{
			eigentuemerGesamt: uebersicht.eigentuemerGesamt,
			eigentuemerAnwesend: uebersicht.eigentuemerAnwesend,
			kopfstimmenGesamt: uebersicht.kopfstimmenGesamt,
			kopfstimmenAnwesend: uebersicht.kopfstimmenAnwesend,
			gesamtquote: uebersicht.gesamtquote,
			quotenAnwesend: uebersicht.quotenAnwesend,
			einzigeParteiGemeinsam: uebersicht.einzigeParteiGemeinsam
		},
		regelErste
	).beschlussfaehig;
}
