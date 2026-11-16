/**
 * Datenzugriff auf Nutzniessungen und ihre Nachweise (Story 1.7).
 */
import { alsBetreiber } from './db';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { schreibeUebergang, schreibeVerlauf, type Handelnder } from './audit';
import { EREIGNISARTEN, ereignis } from '$lib/domain/verlauf';
import { legeAb, liesHochgeladene } from './dateien';
import { legeNutzniessungAn, type Nutzniessung, type NutzniessungEingabe } from '$lib/domain/nutzniessung';
import type { Id } from '$lib/domain/types';
import { zeichenzahl } from '$lib/domain/zeichenzahl';
import { istKalendertag } from '$lib/domain/datum';

export interface NutzniessungMitEinheit extends Nutzniessung {
	unitLabel: string;
	/** Prüfsumme und Name des hinterlegten Vertrags, falls vorhanden. */
	nachweis: { pruefsumme: string; name: string } | null;
}

export async function holeNutzniessungen(
	operatorId: Id,
	stwegId: Id
): Promise<NutzniessungMitEinheit[]> {
	return alsBetreiber(operatorId, async (tx) => {
		const zeilen = await tx<
			{
				id: string;
				unit_id: string;
				unit_label: string;
				holder_name: string;
				valid_from: Date;
				valid_to: Date | null;
				has_agreement: boolean;
				contract_on_file: boolean;
				agreement_summary: string | null;
				checksum: string | null;
				original_name: string | null;
			}[]
		>`
			SELECT n.id, n.unit_id, u.label AS unit_label, n.holder_name,
			       n.valid_from, n.valid_to, n.has_agreement, n.contract_on_file, n.agreement_summary,
			       a.checksum, a.original_name
			FROM usufruct n
			JOIN unit u ON u.id = n.unit_id
			LEFT JOIN LATERAL (
				SELECT checksum, original_name FROM attachment
				WHERE subject_type = 'usufruct' AND subject_id = n.id
				ORDER BY uploaded_at DESC LIMIT 1
			) a ON true
			WHERE n.stweg_id = ${stwegId}
			ORDER BY u.label, n.valid_from
		`;

		return zeilen.map((z) => ({
			id: z.id,
			unitId: z.unit_id,
			unitLabel: z.unit_label,
			holderName: z.holder_name,
			validFrom: z.valid_from.toISOString().slice(0, 10),
			validTo: z.valid_to ? z.valid_to.toISOString().slice(0, 10) : undefined,
			hasAgreement: z.has_agreement,
			contractOnFile: z.contract_on_file,
			agreementSummary: z.agreement_summary ?? undefined,
			documentChecksum: z.checksum ?? undefined,
			nachweis: z.checksum ? { pruefsumme: z.checksum, name: z.original_name! } : null
		}));
	});
}

export async function erstelleNutzniessung(
	handelnder: Handelnder & { operatorId: string },
	eingabe: NutzniessungEingabe,
	nachweis?: File
): Promise<Nutzniessung> {
	// Die Datei wird vor der Transaktion abgelegt: Sie ist unveränderlich und
	// wird über ihre Prüfsumme angesprochen. Bricht die Transaktion danach ab,
	// bleibt eine Datei liegen, auf die nichts verweist — das ist harmlos und
	// allemal besser, als eine Transaktion für die Dauer eines Uploads offen zu
	// halten.
	let abgelegt: { pruefsumme: string; name: string; art: string; groesse: number } | null = null;
	if (nachweis && nachweis.size > 0) {
		abgelegt = await legeAb(await liesHochgeladene(nachweis), nachweis.name, nachweis.type);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [einheit] = await tx<{ stweg_id: string }[]>`
			SELECT stweg_id FROM unit WHERE id = ${eingabe.unitId}
		`;
		if (!einheit) throw new Error('Einheit nicht gefunden');

		const [{ id }] = await tx<{ id: string }[]>`SELECT uuidv7() AS id`;
		const u = legeNutzniessungAn(id, {
			...eingabe,
			documentChecksum: abgelegt?.pruefsumme
		});
		const n = u.ergebnis;

		await tx`
			INSERT INTO usufruct (id, unit_id, stweg_id, operator_id, holder_name,
			                      valid_from, valid_to, has_agreement, contract_on_file,
			                      agreement_summary)
			VALUES (${n.id}, ${n.unitId}, ${einheit.stweg_id}, ${handelnder.operatorId},
			        ${n.holderName}, ${n.validFrom}, ${n.validTo ?? null},
			        ${n.hasAgreement}, ${n.contractOnFile ?? false}, ${n.agreementSummary ?? null})
		`;

		if (abgelegt) {
			await tx`
				INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id,
				                        checksum, original_name, content_type, size_bytes, uploaded_by)
				VALUES (${handelnder.operatorId}, ${einheit.stweg_id}, 'usufruct', ${n.id},
				        ${abgelegt.pruefsumme}, ${abgelegt.name}, ${abgelegt.art}, ${abgelegt.groesse},
				        ${handelnder.userId})
			`;
		}

		return schreibeUebergang(tx, handelnder, u);
	});
}


/**
 * Den Namen des Nutzniessers berichtigen (23.08.2026, Prüflauf II).
 *
 * **Der Anlass:** Im Prüflauf stand «Nutzniessung zugunsten von **BNUT**» — der
 * Prüfer hatte in die CSV-Spalte `usufruct_holder` eine Referenz statt eines
 * Namens geschrieben. Die Übernahme nimmt die Spalte wörtlich, und das ist
 * richtig; falsch war, dass es danach keinen Weg zurück gab: kein Ändern, kein
 * Beenden, kein Entfernen, und eine zweite Erfassung wies die Anwendung ab.
 *
 * **Nur der Name.** Zeitraum und Vereinbarung sind der Inhalt des Rechts — wer
 * daran etwas ändert, ändert nicht eine Schreibweise, sondern den Sachverhalt.
 * Dafür gibt es das Beenden und ein Neuerfassen.
 */
export async function berichtigeNutzniesser(
	handelnder: Handelnder & { operatorId: string },
	nutzniessungId: Id,
	name: string
): Promise<{ vorher: string; nachher: string }> {
	const neu = name.trim();
	if (zeichenzahl(neu) < 2) {
		throw new FachlicherFehler(
			'name_zu_kurz',
			'Der Name des Nutzniessers fehlt oder ist zu kurz.',
			'holderName'
		);
	}

	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ holder_name: string; unit_id: string; stweg_id: string }[]>`
			SELECT holder_name, unit_id, stweg_id FROM usufruct WHERE id = ${nutzniessungId}
		`;
		if (!z) {
			throw new FachlicherFehler('unbekannt', 'Diese Nutzniessung gibt es nicht.', 'id');
		}

		await tx`UPDATE usufruct SET holder_name = ${neu} WHERE id = ${nutzniessungId}`;

		/*
		 * **Der alte Name gehört in den Verlauf.** Er steht in jeder
		 * Momentaufnahme, die vor der Berichtigung entstanden ist — wer ein
		 * Protokoll von damals liest, findet dort eine Schreibweise, die es heute
		 * nicht mehr gibt, und muss sie zuordnen können. Momentaufnahmen selbst
		 * bleiben unberührt: Sie nachzuziehen hiesse, ein Protokoll rückwirkend
		 * umzuschreiben.
		 */
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.nutzniessungGeaendert,
				{ art: 'unit', id: z.unit_id },
				{ vorher: z.holder_name, nachher: neu }
			)
		);
		return { vorher: z.holder_name, nachher: neu };
	});
}

/**
 * Eine Nutzniessung beenden oder tilgen.
 *
 * **Zwei Wege, weil es zwei Sachverhalte sind** — dieselbe Unterscheidung wie
 * bei den Eigentumszuordnungen (22./23.08.2026): Wer stirbt oder verzichtet,
 * dessen Nutzniessung **endet** an einem Tag und bleibt für vergangene
 * Versammlungen sichtbar. Wer sie versehentlich erfasst hat, will, dass sie
 * **nie gewesen** ist.
 *
 * Getilgt wird nur, was an keiner freigegebenen Versammlung teilgenommen hat —
 * sonst stünde in einem Protokoll ein Stimmrecht, dessen Grundlage es nicht
 * mehr gibt.
 */
export async function beendeNutzniessung(
	handelnder: Handelnder & { operatorId: string },
	nutzniessungId: Id,
	per: string | null
): Promise<{ getilgt: boolean; name: string }> {
	return alsBetreiber(handelnder.operatorId, async (tx) => {
		const [z] = await tx<{ holder_name: string; unit_id: string }[]>`
			SELECT holder_name, unit_id FROM usufruct WHERE id = ${nutzniessungId}
		`;
		if (!z) {
			throw new FachlicherFehler('unbekannt', 'Diese Nutzniessung gibt es nicht.', 'id');
		}

		if (per) {
			if (!istKalendertag(per)) {
				throw new FachlicherFehler('datum_ungueltig', 'Das Ende ist kein gültiges Datum.', 'per');
			}
			await tx`UPDATE usufruct SET valid_to = ${per} WHERE id = ${nutzniessungId}`;
			await schreibeVerlauf(
				tx,
				handelnder,
				ereignis(
					EREIGNISARTEN.nutzniessungBeendet,
					{ art: 'unit', id: z.unit_id },
					{ name: z.holder_name, per }
				)
			);
			return { getilgt: false, name: z.holder_name };
		}

		const [{ anzahl }] = await tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM snapshot_unit WHERE unit_id = ${z.unit_id}
		`;
		if (anzahl > 0) {
			throw new FachlicherFehler(
				'einheit_in_versammlung',
				'Die Einheit hat an einer freigegebenen Versammlung teilgenommen. Die Nutzniessung ' +
					'lässt sich dann nicht mehr tilgen — sie stand in der Stimmkraft. Setzen Sie ' +
					'stattdessen ein Ende.',
				'id'
			);
		}

		await tx`DELETE FROM usufruct WHERE id = ${nutzniessungId}`;
		await schreibeVerlauf(
			tx,
			handelnder,
			ereignis(
				EREIGNISARTEN.nutzniessungBeendet,
				{ art: 'unit', id: z.unit_id },
				{ name: z.holder_name, getilgt: true }
			)
		);
		return { getilgt: true, name: z.holder_name };
	});
}
