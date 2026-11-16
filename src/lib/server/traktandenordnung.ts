/**
 * Die gespeicherte Reihenfolge der Standardtraktanden, je Gemeinschaft
 * (Block C2, 31.08.2026).
 *
 * Der Auftraggeber (Praxisdurchlauf 28.08.2026): «Reihenfolge der Standardtraktanden
 * speicherbar machen.» Bis hierher galt die Reihenfolge im Code
 * (`domain/traktandenvorlage.ts`), und eine Gemeinschaft mit anderem Ablauf
 * musste sie bei jeder neuen Versammlung von Hand umsortieren.
 *
 * **Eine Ordnung je Gemeinschaft, keine je Versammlung.** Die Versammlung
 * friert ihre Positionen beim Anlegen ein — sie stehen auf Einladungen und im
 * Protokoll. Diese Ordnung hier sagt nur, in welcher Reihenfolge **künftige**
 * Versammlungen ihre Vorlagen bekommen.
 */
import { alsBetreiber } from './db';
import { schreibeVerlauf, type Handelnder } from './audit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { fremdeGemeinschaft } from '$lib/domain/fehler';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { vorlagenFuer } from '$lib/domain/traktandenvorlage';
import type { Id } from '$lib/domain/types';

/** Die gespeicherte Ordnung als Schlüsselliste, aufsteigend nach Position. `null`: keine gespeichert. */
export async function holeTraktandenordnung(
	operatorId: Id,
	stwegId: Id
): Promise<string[] | null> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<{ template_key: string }[]>`
			SELECT template_key FROM agenda_template_order
			 WHERE stweg_id = ${stwegId}
			 ORDER BY position
		`;
		return zeilen.length > 0 ? zeilen.map((z) => z.template_key) : null;
	});
}

/**
 * Speichert die Ordnung — oder setzt sie zurück.
 *
 * **Löschen und Schreiben in einer Transaktion:** Ein Zwischenzustand mit
 * alter und neuer Ordnung gemischt würde beim nächsten Anlegen einer
 * Versammlung sichtbar.
 *
 * **Leere Liste heisst zurücksetzen**, nicht «alles abgewählt»: Abwählen gibt
 * es nicht — jede neue Versammlung bekommt alle Vorlagen ihrer Art. Wer die
 * Code-Reihenfolge wiederwill, schickt die leere Liste oder ruft
 * `setzeTraktandenordnungZurueck` auf; beides tut dasselbe.
 */
export async function speichereTraktandenordnung(
	handelnder: Handelnder & { operatorId: string },
	stwegId: Id,
	schluessel: string[]
): Promise<void> {
	const erlaubt = new Set(vorlagenFuer('ordentlich').map((v) => v.schluessel));
	const doppelte = schluessel.filter((s, i) => schluessel.indexOf(s) !== i);
	if (doppelte.length > 0) {
		throw new FachlicherFehler(
			'doppelter_schluessel',
			`«${doppelte[0]}» steht zweimal in der Liste. Laden Sie die Seite neu.`,
			'ordnung'
		);
	}
	const fremde = schluessel.filter((s) => !erlaubt.has(s));
	if (fremde.length > 0) {
		throw new FachlicherFehler(
			'fremder_schluessel',
			`«${fremde[0]}» ist keine Standardtraktanden-Vorlage.`,
			'ordnung'
		);
	}
	// Alles auswählen ist dasselbe wie die Schlüssel zu speichern; das Fehlen
	// eines erlaubten Schlüssels ist erlaubt — die Merge-Regel in
	// `ordneVorlagen` hängt ihn hinten an. Die oberen Prüfungen genügen.

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		/*
		 * **Die Gemeinschaft vorweg unter dem eigenen Betreiber suchen.** Ohne
		 * Treffer liefen die Abfragen unter dem Zeilenschutz ins Leere, und der
		 * Verlauf hielt trotzdem einen Eintrag über eine fremde Kennung fest,
		 * unentfernbar (Klasse K2; Durchstich `e2e/fremdbetreiber.mjs`,
		 * 27.10.2026).
		 */
		const [gemeinschaft] = await tx`SELECT 1 FROM stweg WHERE id = ${stwegId}`;
		if (!gemeinschaft) throw fremdeGemeinschaft('stwegId');
		await tx`DELETE FROM agenda_template_order WHERE stweg_id = ${stwegId}`;

		if (schluessel.length > 0) {
			/*
			 * **Je Zeile ein INSERT statt eines Array-Baus.** Acht Zeilen, in
			 * einer Transaktion — die Lesbarkeit gewinnt, und ein
			 * Mehrzeilen-VALUES brächte hier nichts, was die zwei
			 * UNIQUE-Bedingungen nicht ohnehin sicherstellen.
			 */
			let position = 0;
			for (const s of schluessel) {
				position++;
				const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
				await tx`
					INSERT INTO agenda_template_order (id, operator_id, stweg_id, position, template_key)
					VALUES (${id}, ${handelnder.operatorId}, ${stwegId}, ${position}, ${s})
				`;
			}
		}

		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				schluessel.length > 0
					? EREIGNISARTEN.traktandenordnungGespeichert
					: EREIGNISARTEN.traktandenordnungZurueckgesetzt,
				{ art: 'stweg', id: stwegId },
				{ schluessel: schluessel.length > 0 ? schluessel : null }
			)
		);
	});
}

/**
 * Setzt die Ordnung zurück: Die Code-Reihenfolge gilt wieder.
 *
 * Getrennt von `speichereTraktandenordnung` benannt, weil die Reglementseite
 * zwei Knöpfe hat — «Speichern» und «Zurücksetzen» — und die Verlaufsart am
 * Knopf hängen soll, nicht an einer leeren Liste, die auch ein vergessenes
 * Formular liefern könnte.
 */
export async function setzeTraktandenordnungZurueck(
	handelnder: Handelnder & { operatorId: string },
	stwegId: Id
): Promise<void> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const vorhandene = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM agenda_template_order WHERE stweg_id = ${stwegId}
		`;
		if ((vorhandene[0]?.anzahl ?? 0) === 0) {
			throw new FachlicherFehler(
				'nichts_gespeichert',
				'Für diese Gemeinschaft ist keine Reihenfolge gespeichert — es gilt bereits die Standardreihenfolge.',
				'ordnung'
			);
		}

		await tx`DELETE FROM agenda_template_order WHERE stweg_id = ${stwegId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(EREIGNISARTEN.traktandenordnungZurueckgesetzt, { art: 'stweg', id: stwegId }, {})
		);
	});
}
