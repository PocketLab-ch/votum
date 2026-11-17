/**
 * Die Lesarten der Gemeinschaft (Migration 169). Der Katalog steht in
 * `domain/lesarten.ts`.
 *
 * **Ein eigener Schreibweg** wie bei den Ausnahmen (`server/ausnahmen.ts`): Die
 * Spalten hängen an `stweg`, und das Angabenformular schreibt dieselbe Zeile
 * ohne sie.
 *
 * **Die Rolle wird hier noch einmal geprüft**, nicht nur am Pfad
 * (`rollen.ts`). Der Pfadwächter lässt die Sitzungsleitung auf
 * `/gemeinschaften/<id>/lesarten` schreiben, damit sie dort umstellen kann,
 * wenn die Gemeinschaft es erlaubt. Ob sie es erlaubt, steht in derselben Zeile,
 * die hier gesperrt wird; geprüft wird deshalb in derselben Transaktion.
 */
import type postgres from 'postgres';
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import {
	darfLesartenUmstellen,
	LESARTEN,
	lesartVon,
	LESARTENRECHT_IN_WORTEN,
	pruefeLesartenrecht,
	pruefeLesartenwahl,
	wahlInWorten,
	type Lesartenrecht,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { FachlicherFehler } from '$lib/domain/fehler';
import type { Rolle } from '$lib/domain/rollen';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import type { Id } from '$lib/domain/types';

/** Die Absage, wenn die Sitzungsleitung umstellen will und es nicht darf. */
export const LESARTEN_DER_VERWALTUNG_VORBEHALTEN =
	'Die Lesarten dieser Gemeinschaft stellt nur die Verwaltung um. Ob auch die Sitzungsleitung ' +
	'das darf, legt die Verwaltung auf der Seite «Reglement und Quoren» fest.';

interface Lesartenzeile {
	reading_l1: Lesartenwahl['L1'];
	reading_l2: Lesartenwahl['L2'];
	reading_l3: Lesartenwahl['L3'];
	reading_l4: Lesartenwahl['L4'];
	reading_l5: Lesartenwahl['L5'];
	reading_l6: Lesartenwahl['L6'];
	reading_l7: Lesartenwahl['L7'];
	reading_l8: Lesartenwahl['L8'];
	reading_l9: Lesartenwahl['L9'];
	reading_l10: Lesartenwahl['L10'];
	reading_l11: Lesartenwahl['L11'];
	reading_l12: Lesartenwahl['L12'];
	reading_l13: Lesartenwahl['L13'];
	reading_l15: Lesartenwahl['L15'];
	reading_l16: Lesartenwahl['L16'];
	reading_l17: Lesartenwahl['L17'];
	reading_changer: Lesartenrecht;
}

type Wahlspalten = Pick<
	Lesartenzeile,
	| 'reading_l1'
	| 'reading_l2'
	| 'reading_l3'
	| 'reading_l4'
	| 'reading_l5'
	| 'reading_l6'
	| 'reading_l7'
	| 'reading_l8'
	| 'reading_l9'
	| 'reading_l10'
	| 'reading_l11'
	| 'reading_l12'
	| 'reading_l13'
	| 'reading_l15'
	| 'reading_l16'
	| 'reading_l17'
>;

function wahlAus(z: Wahlspalten): Lesartenwahl {
	return {
		L1: z.reading_l1,
		L2: z.reading_l2,
		L3: z.reading_l3,
		L4: z.reading_l4,
		L5: z.reading_l5,
		L6: z.reading_l6,
		L7: z.reading_l7,
		L8: z.reading_l8,
		L9: z.reading_l9,
		L10: z.reading_l10,
		L11: z.reading_l11,
		L12: z.reading_l12,
		L13: z.reading_l13,
		L15: z.reading_l15,
		L16: z.reading_l16,
		L17: z.reading_l17
	};
}

/**
 * Die Lesarten, nach denen ein Erfordernis zu bilden ist.
 *
 * **Ab der Freigabe aus der Momentaufnahme**, vorher aus der Gemeinschaft. So
 * rechnet ein Traktandum, das erst im Saal ein Erfordernis bekommt, nach
 * derselben Wahl wie die Einladung, und eine Umstellung nach dem Ergebnis wirkt
 * erst für die nächste Versammlung (Konzept, Abschnitt 3).
 */
export async function holeLesartenIn(
	tx: postgres.TransactionSql,
	wo: { meetingId: Id } | { stwegId: Id }
): Promise<Lesartenwahl> {
	if ('meetingId' in wo) {
		const [s] = await tx<Wahlspalten[]>`
			SELECT reading_l1, reading_l2, reading_l3, reading_l4, reading_l5, reading_l6, reading_l7, reading_l8, reading_l9, reading_l10, reading_l11, reading_l12, reading_l13, reading_l15, reading_l16, reading_l17 FROM snapshot WHERE meeting_id = ${wo.meetingId}
		`;
		if (s) return wahlAus(s);
		const [g] = await tx<Wahlspalten[]>`
			SELECT g.reading_l1, g.reading_l2, g.reading_l3, g.reading_l4, g.reading_l5, g.reading_l6, g.reading_l7, g.reading_l8, g.reading_l9, g.reading_l10, g.reading_l11, g.reading_l12, g.reading_l13, g.reading_l15, g.reading_l16, g.reading_l17 FROM meeting m JOIN stweg g ON g.id = m.stweg_id WHERE m.id = ${wo.meetingId}
		`;
		if (!g) throw new FachlicherFehler('unbekannt', 'Versammlung nicht gefunden.', 'meetingId');
		return wahlAus(g);
	}
	const [g] = await tx<Wahlspalten[]>`
		SELECT reading_l1, reading_l2, reading_l3, reading_l4, reading_l5, reading_l6, reading_l7, reading_l8, reading_l9, reading_l10, reading_l11, reading_l12, reading_l13, reading_l15, reading_l16, reading_l17 FROM stweg WHERE id = ${wo.stwegId}
	`;
	if (!g) throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
	return wahlAus(g);
}

export async function holeLesarten(
	operatorId: Id,
	wo: { meetingId: Id } | { stwegId: Id }
): Promise<Lesartenwahl> {
	return alsBetreiber(operatorId, (tx) => holeLesartenIn(tx, wo));
}

/** Je Lesart: zuletzt geändert von wem und wann, oder nie. */
export interface Lesartaenderung {
	durch: string;
	am: string;
	rolle: Rolle | null;
}

export interface Lesarteneinstellung {
	wahl: Lesartenwahl;
	recht: Lesartenrecht;
	geaendert: Partial<Record<keyof Lesartenwahl, Lesartaenderung>>;
	rechtGeaendert: Lesartaenderung | null;
}

/** Was die Einstellungsseiten zeigen: Wahl, Recht und die letzte Änderung je Lesart. */
export async function holeLesarteneinstellung(operatorId: Id, stwegId: Id): Promise<Lesarteneinstellung> {
	return alsBetreiber(operatorId, async (tx) => {
		const [z] = await tx<Lesartenzeile[]>`
			SELECT reading_l1, reading_l2, reading_l3, reading_l4, reading_l5, reading_l6, reading_l7, reading_l8, reading_l9, reading_l10, reading_l11, reading_l12, reading_l13, reading_l15, reading_l16, reading_l17, reading_changer FROM stweg WHERE id = ${stwegId}
		`;
		if (!z) throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');

		// Der jüngste Eintrag je Lesart; der Verlauf ist die einzige Quelle für
		// «zuletzt geändert», eine eigene Spalte daneben könnte ihm widersprechen.
		const eintraege = await tx<
			{ event_type: string; actor_label: string; occurred_at: Date; detail: Record<string, unknown> }[]
		>`
			SELECT event_type, actor_label, occurred_at, detail
			  FROM audit_entry
			 WHERE subject_type = 'stweg' AND subject_id = ${stwegId}
			   AND event_type IN (${EREIGNISARTEN.lesartGesetzt}, ${EREIGNISARTEN.lesartenrechtGesetzt})
			 ORDER BY occurred_at DESC, id DESC
		`;
		const geaendert: Lesarteneinstellung['geaendert'] = {};
		let rechtGeaendert: Lesartaenderung | null = null;
		for (const e of eintraege) {
			const aenderung: Lesartaenderung = {
				durch: e.actor_label,
				am: e.occurred_at.toISOString(),
				rolle: (e.detail.rolle as Rolle | undefined) ?? null
			};
			if (e.event_type === EREIGNISARTEN.lesartenrechtGesetzt) {
				rechtGeaendert ??= aenderung;
				continue;
			}
			const kennung = e.detail.lesart as keyof Lesartenwahl | undefined;
			if (kennung && lesartVon(kennung) && !geaendert[kennung]) geaendert[kennung] = aenderung;
		}
		return { wahl: wahlAus(z), recht: z.reading_changer, geaendert, rechtGeaendert };
	});
}

/**
 * Stellt Lesarten um. Was die Eingabe nicht nennt, bleibt; was sich nicht
 * ändert, schreibt keinen Verlaufseintrag.
 *
 * Die Rolle kommt vom angemeldeten Konto, nicht aus dem Formular.
 */
export async function speichereLesarten(
	handelnder: Handelnder & { operatorId: string },
	rolle: Rolle,
	stwegId: Id,
	eingabe: Record<string, unknown>
): Promise<Lesartenwahl> {
	let aenderung: Partial<Lesartenwahl>;
	try {
		aenderung = pruefeLesartenwahl(eingabe);
	} catch (f) {
		throw new FachlicherFehler('ungueltig', (f as Error).message, 'lesart');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<Lesartenzeile[]>`
			SELECT reading_l1, reading_l2, reading_l3, reading_l4, reading_l5, reading_l6, reading_l7, reading_l8, reading_l9, reading_l10, reading_l11, reading_l12, reading_l13, reading_l15, reading_l16, reading_l17, reading_changer FROM stweg WHERE id = ${stwegId} FOR UPDATE
		`;
		if (!vorher) throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		if (!darfLesartenUmstellen(rolle, vorher.reading_changer)) {
			throw new FachlicherFehler('nicht_erlaubt', LESARTEN_DER_VERWALTUNG_VORBEHALTEN, 'lesart');
		}

		const bisher = wahlAus(vorher);
		const neu: Lesartenwahl = { ...bisher, ...aenderung };

		await tx`UPDATE stweg SET reading_l1 = ${neu.L1}, reading_l2 = ${neu.L2}, reading_l3 = ${neu.L3}, reading_l4 = ${neu.L4}, reading_l5 = ${neu.L5}, reading_l6 = ${neu.L6}, reading_l7 = ${neu.L7}, reading_l8 = ${neu.L8}, reading_l9 = ${neu.L9}, reading_l10 = ${neu.L10}, reading_l11 = ${neu.L11}, reading_l12 = ${neu.L12}, reading_l13 = ${neu.L13}, reading_l15 = ${neu.L15}, reading_l16 = ${neu.L16}, reading_l17 = ${neu.L17} WHERE id = ${stwegId}`;

		for (const lesart of LESARTEN) {
			const k = lesart.kennung;
			if (bisher[k] === neu[k]) continue;
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.lesartGesetzt,
					{ art: 'stweg', id: stwegId },
					{
						lesart: k,
						frage: lesart.frage,
						// In Worten, wie die Seite sie zeigt: Im Anfechtungsfall zählt,
						// welche Lesart zur Zeit der Freigabe galt.
						vorher: wahlInWorten(k, bisher[k]),
						nachher: wahlInWorten(k, neu[k]),
						rolle
					}
				)
			);
		}
		return neu;
	});
}

/**
 * Legt fest, wer die Lesarten umstellen darf. **Nur die Verwaltung**; die
 * Route liegt unter der Reglementsseite und damit hinter dem Pfadwächter. Die
 * Prüfung hier ist die zweite Linie.
 */
export async function speichereLesartenrecht(
	handelnder: Handelnder & { operatorId: string },
	rolle: Rolle,
	stwegId: Id,
	wert: unknown
): Promise<Lesartenrecht> {
	if (rolle !== 'admin') {
		throw new FachlicherFehler(
			'nicht_erlaubt',
			'Wer die Lesarten umstellen darf, legt nur die Verwaltung fest.',
			'lesartenrecht'
		);
	}
	let recht: Lesartenrecht;
	try {
		recht = pruefeLesartenrecht(wert);
	} catch (f) {
		throw new FachlicherFehler('ungueltig', (f as Error).message, 'lesartenrecht');
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [vorher] = await tx<Pick<Lesartenzeile, 'reading_changer'>[]>`
			SELECT reading_changer FROM stweg WHERE id = ${stwegId} FOR UPDATE
		`;
		if (!vorher) throw new FachlicherFehler('unbekannt', 'Gemeinschaft nicht gefunden.', 'stwegId');
		if (vorher.reading_changer === recht) return recht;

		await tx`UPDATE stweg SET reading_changer = ${recht} WHERE id = ${stwegId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.lesartenrechtGesetzt,
				{ art: 'stweg', id: stwegId },
				{
					vorher: LESARTENRECHT_IN_WORTEN[vorher.reading_changer],
					nachher: LESARTENRECHT_IN_WORTEN[recht],
					rolle
				}
			)
		);
		return recht;
	});
}
