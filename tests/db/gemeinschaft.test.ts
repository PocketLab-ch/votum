/**
 * Story 1.4 — Schranken der Gemeinschaft, soweit sie in der Datenbank liegen.
 *
 * Die fachlichen Regeln stehen im Kern und sind dort mit Wertetabellen geprüft.
 * Hier geht es um das, was der Kern nicht garantieren kann: Zeilenschutz,
 * Prüfbedingungen, Fremdschlüssel über Mandantengrenzen, Ringschutz über
 * mehrere Ebenen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	entferneGemeinschaft,
	erstelleGemeinschaft,
	holeGemeinschaft,
	listeGemeinschaften
} from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { imKontext as inKontext } from './helfer';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { GemeinschaftEingabe } from '$lib/domain/gemeinschaft';

let betreiberA: string;
let betreiberB: string;

const GRUNDFALL: GemeinschaftEingabe = {
	name: 'Musterweg 3',
	quotaDenominator: 1000,
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	parentStwegId: null
};

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Gemeinschaft A');
	betreiberB = await pruefbetreiber('Gemeinschaft B');
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Anlegen', () => {
	it('legt an, gibt die Kennung zurück und hält es im Verlauf fest', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), {
			...GRUNDFALL,
			name: 'Sonnenhalde 12'
		});
		expect(g.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(g.operatorId).toBe(betreiberA);

		const [eintrag] = await imKontext(
			betreiberA,
			(tx) => tx`SELECT event_type, detail FROM audit_entry WHERE subject_id = ${g.id}`
		);
		expect(eintrag.event_type).toBe('stweg.created');
		expect(eintrag.detail).toMatchObject({
			name: 'Sonnenhalde 12',
			grundlage: 'gesetzliche_auffangregel',
			fundstelle: null
		});
	});

	it('lässt eine Untergemeinschaft desselben Betreibers zu', async () => {
		const dach = await erstelleGemeinschaft(handelnder(betreiberA), {
			...GRUNDFALL,
			name: 'Überbauung Talacker',
			// Blosse Klammer: Die Quoten liegen vollständig bei den Häusern.
			quotaDenominator: 0
		});
		const haus = await erstelleGemeinschaft(handelnder(betreiberA), {
			...GRUNDFALL,
			name: 'Haus A',
			parentStwegId: dach.id
		});
		expect(haus.parentStwegId).toBe(dach.id);
	});
});

describe('Zeilenschutz je Betreiber (AD-6)', () => {
	it('zeigt einem Betreiber die Gemeinschaften des anderen nicht', async () => {
		await erstelleGemeinschaft(handelnder(betreiberB), { ...GRUNDFALL, name: 'Fremdweg 1' });

		const beiA = await listeGemeinschaften(betreiberA, 'aktiv');
		const beiB = await listeGemeinschaften(betreiberB, 'aktiv');

		expect(beiA.map((g) => g.name)).not.toContain('Fremdweg 1');
		expect(beiB.map((g) => g.name)).toEqual(['Fremdweg 1']);
	});

	it('weist ein Einfügen ohne Mandantenkontext ab', async () => {
		await expect(
			ohneKontext(
				(tx) => tx`
					INSERT INTO stweg (operator_id, name) VALUES (${betreiberA}, 'Ohne Kontext')
				`
			)
		).rejects.toThrow();
	});

	it('verhindert eine Untergemeinschaft über die Betreibergrenze hinweg', async () => {
		// Der Fremdschlüssel geht auf (id, operator_id): Eine Gemeinschaft unter
		// der eines fremden Betreibers wäre über den Zeilenschutz nirgends
		// vollständig sichtbar und ihre Wertquotensumme nirgends prüfbar.
		const [beiA] = await listeGemeinschaften(betreiberA, 'aktiv');

		await expect(
			imKontext(
				betreiberB,
				(tx) => tx`
					INSERT INTO stweg (operator_id, parent_stweg_id, name)
					VALUES (${betreiberB}, ${beiA.id}, 'Untergeschoben')
				`
			)
		).rejects.toThrow();
	});
});

describe('Ringschutz in der Datenbank', () => {
	it('weist den unmittelbaren Selbstbezug ab', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), { ...GRUNDFALL, name: 'Ringweg 1' });
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE stweg SET parent_stweg_id = id WHERE id = ${g.id}`
			)
		).rejects.toThrow();
	});

	it('weist einen Ring über drei Ebenen ab', async () => {
		// Der Kern prüft es ebenfalls. Diese Schranke hält auch dann, wenn ein
		// späterer Codepfad die Prüfung vergisst oder Daten direkt eingespielt
		// werden — und ein Ring wäre eine Endlosschleife in jeder Auszählung.
		const a = await erstelleGemeinschaft(handelnder(betreiberA), { ...GRUNDFALL, name: 'Kette A' });
		const b = await erstelleGemeinschaft(handelnder(betreiberA), {
			...GRUNDFALL,
			name: 'Kette B',
			parentStwegId: a.id
		});
		const c = await erstelleGemeinschaft(handelnder(betreiberA), {
			...GRUNDFALL,
			name: 'Kette C',
			parentStwegId: b.id
		});

		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`UPDATE stweg SET parent_stweg_id = ${c.id} WHERE id = ${a.id}`
			)
		).rejects.toThrow(/Ring/);
	});
});

describe('Prüfbedingungen', () => {
	it('weist einen negativen Nenner ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO stweg (operator_id, name, quota_denominator)
					VALUES (${betreiberA}, 'Negativ', -1)
				`
			)
		).rejects.toThrow(/nenner_nicht_negativ|check/i);
	});

	it('weist eine unbekannte Zählweise ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO stweg (operator_id, name, head_count_mode)
					VALUES (${betreiberA}, 'Unbekannt', 'per_quota')
				`
			)
		).rejects.toThrow(/zaehlweise|check/i);
	});

	it('weist den Nebenobjekt-Zusatz bei der Zählung je Eigentümer ab', async () => {
		// Er ergäbe dort keinen Sinn und wäre irreführend: Bei einer Kopfstimme je
		// Eigentümer ändert die Zahl seiner Einheiten nichts.
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`
					INSERT INTO stweg (operator_id, name, head_count_mode, parking_counts_as_head)
					VALUES (${betreiberA}, 'Widerspruch', 'per_owner', true)
				`
			)
		).rejects.toThrow(/nebenobjekte|check/i);
	});

	it('weist eine leere Bezeichnung ab', async () => {
		await expect(
			imKontext(
				betreiberA,
				(tx) => tx`INSERT INTO stweg (operator_id, name) VALUES (${betreiberA}, '  ')`
			)
		).rejects.toThrow();
	});
});

describe('Änderungszeitpunkt', () => {
	it('wird beim Ändern selbsttätig nachgeführt', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), { ...GRUNDFALL, name: 'Zeitweg 1' });
		const [vorher] = await imKontext(
			betreiberA,
			(tx) => tx`SELECT created_at, updated_at FROM stweg WHERE id = ${g.id}`
		);

		await imKontext(
			betreiberA,
			(tx) => tx`UPDATE stweg SET name = 'Zeitweg 2' WHERE id = ${g.id}`
		);

		const [nachher] = await imKontext(
			betreiberA,
			(tx) => tx`SELECT created_at, updated_at FROM stweg WHERE id = ${g.id}`
		);

		expect(nachher.updated_at.getTime()).toBeGreaterThanOrEqual(vorher.updated_at.getTime());
		expect(nachher.created_at.getTime()).toBe(vorher.created_at.getTime());
	});
});

/**
 * Der Stichentscheid (Migration 023).
 *
 * Er hängt an der Gemeinschaft und wandert mit der Freigabe in die
 * Momentaufnahme — aus demselben Grund wie die Zählweise: Ein später geändertes
 * Reglement darf ein gefasstes Ergebnis nicht mehr verschieben.
 */
describe('Stichentscheid bei Stimmengleichheit', () => {
	it('gilt ohne Angabe als gesetzliche Lage', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), {
			name: 'Gleichstandweg 1',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const gelesen = await holeGemeinschaft(betreiberA, g.id);
		expect(gelesen?.tieBreak).toBe('keiner');
	});

	it('führt die Fundstelle mit, wenn die Wertquoten entscheiden', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiberA), {
			name: 'Gleichstandweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_unit',
			headCountRuleSource: 'Art. 28 Abs. 1',
			parkingCountsAsHead: false,
			parentStwegId: null,
			tieBreak: 'wertquote',
			tieBreakRuleSource: 'Art. 30 Reglement'
		});
		const gelesen = await holeGemeinschaft(betreiberA, g.id);
		expect(gelesen?.tieBreak).toBe('wertquote');
		expect(gelesen?.tieBreakRuleSource).toBe('Art. 30 Reglement');
	});

	it('führt bei der gesetzlichen Lage keine Fundstelle mit', async () => {
		// Ein Reglementsverweis, der nichts stützt, wäre irreführend.
		const g = await erstelleGemeinschaft(handelnder(betreiberA), {
			name: 'Gleichstandweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			tieBreak: 'keiner',
			tieBreakRuleSource: 'Art. 30 Reglement'
		});
		const gelesen = await holeGemeinschaft(betreiberA, g.id);
		expect(gelesen?.tieBreakRuleSource).toBeUndefined();
	});

	it('weist einen unbekannten Wert ab', async () => {
		await expect(
			erstelleGemeinschaft(handelnder(betreiberA), {
				name: 'Gleichstandweg 4',
				quotaDenominator: 1000,
				headCountMode: 'per_owner',
				parkingCountsAsHead: false,
				parentStwegId: null,
				// @ts-expect-error absichtlich falsch
				tieBreak: 'muenzwurf'
			})
		).rejects.toThrow(/Gleichstand/);
	});
});

/**
 * Entfernen ist die einzige Handlung an einer Gemeinschaft, die sich nicht
 * zurücknehmen lässt. Die Schranken sind deshalb der eigentliche Gegenstand
 * dieser Reihe — nicht das Löschen selbst.
 */
describe('Entfernen', () => {
	async function neue(name: string, u: Partial<GemeinschaftEingabe> = {}) {
		return erstelleGemeinschaft(handelnder(betreiberA), { ...GRUNDFALL, name, ...u });
	}

	it('entfernt eine Gemeinschaft samt ihren Einheiten', async () => {
		const g = await neue('Löschweg 1');
		await erstelleEinheit(handelnder(betreiberA), {
			stwegId: g.id,
			kind: 'unit',
			label: '1.1 Wohnung',
			quotas: { stamm: 1000 },
			countsAsHead: true
		});

		await entferneGemeinschaft(handelnder(betreiberA), g.id);

		expect(await holeGemeinschaft(betreiberA, g.id)).toBeNull();
		const [{ anzahl }] = await inKontext(
			betreiberA,
			(tx) => tx`SELECT count(*)::int AS anzahl FROM unit WHERE stweg_id = ${g.id}`
		);
		expect(anzahl).toBe(0);
	});

	/**
	 * **Auch was an der Gemeinschaft hängt, ohne dass eine Maske es zeigt**
	 * (01.09.2026).
	 *
	 * `bylaw_instruction_rule` (Migration 085) und `agenda_template_order`
	 * (097) hängen mit einem Fremdschlüssel ohne `ON DELETE` an der
	 * Gemeinschaft, und beide fehlten in der Löschliste. Eine Gemeinschaft, die
	 * eine davon trug, liess sich nicht mehr entfernen — mit einer rohen 500,
	 * weil 23503 bewusst nicht übersetzt wird.
	 *
	 * Geprüft wird an den Zeilen, nicht an einer Maske: Beide Tabellen werden
	 * hier unmittelbar beschrieben, damit der Test nicht davon abhängt, ob es
	 * gerade einen Weg dorthin gibt.
	 */
	it('entfernt auch Weisungsregeln und die gespeicherte Traktandenordnung', async () => {
		const g = await neue('Löschweg 3');
		await inKontext(betreiberA, async (tx) => {
			await tx`
				INSERT INTO bylaw_instruction_rule
					(operator_id, stweg_id, head_numerator, head_denominator, head_mode, head_base,
					 source_reference)
				VALUES (${betreiberA}, ${g.id}, 1, 2, 'mehr_als', 'anwesend_vertreten', 'Art. 15 Reglement')
			`;
			await tx`
				INSERT INTO agenda_template_order (operator_id, stweg_id, position, template_key)
				VALUES (${betreiberA}, ${g.id}, 1, 'begruessung')
			`;
		});

		await entferneGemeinschaft(handelnder(betreiberA), g.id);

		expect(await holeGemeinschaft(betreiberA, g.id)).toBeNull();
		const [{ regeln }] = await inKontext(
			betreiberA,
			(tx) =>
				tx<{ regeln: number }[]>`SELECT count(*)::int AS regeln FROM bylaw_instruction_rule WHERE stweg_id = ${g.id}`
		);
		const [{ ordnung }] = await inKontext(
			betreiberA,
			(tx) =>
				tx<{ ordnung: number }[]>`SELECT count(*)::int AS ordnung FROM agenda_template_order WHERE stweg_id = ${g.id}`
		);
		expect(regeln).toBe(0);
		expect(ordnung).toBe(0);
	});

	/**
	 * **Ein eingespieltes Abschlusspaket sperrt das Entfernen** (01.09.2026).
	 *
	 * `imported_meeting` hängt am selben Fremdschlüssel wie alles andere, aber
	 * die Schranke «hat Versammlungen» greift dafür nicht: Das Einspielen
	 * schreibt nur diese Tabelle. Ohne eigene Prüfung lief das Entfernen in eine
	 * rohe 500.
	 *
	 * Ein `DELETE` wäre der falsche Ausweg: Ein Auslöser in der Datenbank weist
	 * ihn ab. Der Nachweis überlebt seinen Gegenstand (AD-5), und die Anwendung
	 * sagt es, statt es zu versuchen.
	 */
	it('verweigert das Entfernen bei eingespielten Abschlusspaketen', async () => {
		const g = await neue('Löschweg 4');
		const pruefsumme = 'a'.repeat(64);
		await inKontext(betreiberA, async (tx) => {
			await tx`
				INSERT INTO imported_meeting
					(id, operator_id, stweg_id, meeting_key, seal_hash, manifest,
					 package_checksum, package_size, imported_by)
				VALUES (uuidv7(), ${betreiberA}, ${g.id}, gen_random_uuid(), ${pruefsumme},
				        '{}'::jsonb, ${pruefsumme}, 1, 'Prüflauf')
			`;
		});

		await expect(entferneGemeinschaft(handelnder(betreiberA), g.id)).rejects.toThrow(
			/eingespieltes Abschlusspaket|eingespielte Abschlusspakete/
		);
		// Und die Gemeinschaft steht noch.
		expect(await holeGemeinschaft(betreiberA, g.id)).not.toBeNull();
	});

	/** Der Nachweis überlebt seinen Gegenstand (AD-5). */
	it('lässt den Verlauf stehen und hält das Entfernen darin fest', async () => {
		const g = await neue('Löschweg 2');
		await entferneGemeinschaft(handelnder(betreiberA), g.id);

		const zeilen = await inKontext(
			betreiberA,
			(tx) =>
				tx<{ event_type: string }[]>`
					SELECT event_type FROM audit_entry WHERE subject_id = ${g.id} ORDER BY occurred_at
				`
		);
		const arten = zeilen.map((z) => z.event_type);
		expect(arten).toContain('stweg.created');
		expect(arten).toContain('stweg.removed');
	});

	it('weist eine Gemeinschaft mit Versammlung ab und nennt die Zahl', async () => {
		const g = await neue('Löschweg 3');
		await erstelleVersammlung(handelnder(betreiberA), {
			stwegId: g.id,
			datum: '2027-04-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			vorgaengerId: null,
			betriebsart: 'gefuehrt'
		});

		await expect(entferneGemeinschaft(handelnder(betreiberA), g.id)).rejects.toThrow(
			/eine Versammlung/
		);
		expect(await holeGemeinschaft(betreiberA, g.id)).not.toBeNull();
	});

	it('weist eine Gemeinschaft mit Untergemeinschaften ab', async () => {
		const dach = await neue('Löschweg 4', { quotaDenominator: 0 });
		await neue('Löschweg 4a', { parentStwegId: dach.id });

		await expect(entferneGemeinschaft(handelnder(betreiberA), dach.id)).rejects.toThrow(
			/übergeordnete Gemeinschaft/
		);
	});

	it('kennt die Gemeinschaft eines fremden Betreibers nicht', async () => {
		const g = await neue('Löschweg 5');
		await expect(entferneGemeinschaft(handelnder(betreiberB), g.id)).rejects.toThrow(
			/nicht gefunden/
		);
		expect(await holeGemeinschaft(betreiberA, g.id)).not.toBeNull();
	});
});
