/**
 * Story 3.8 — Pflichttraktanden und Übernahme in der Datenbank.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { erstelleTraktandum, holeTraktanden } from '$lib/server/traktanden';
import { erstelleReglementsregel } from '$lib/server/reglement';
import { holeUebernahmeangebote, uebernimmTraktanden } from '$lib/server/vorlagen';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { FESTE_TRAKTANDEN, JAHRESGESCHAEFTE } from '$lib/domain/traktandenvorlage';
import type { Versammlungsart } from '$lib/domain/versammlung';
import { AKTUELLE_FASSUNG } from '$lib/rules';

let betreiber: string;
let betreiberB: string;
let stweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

async function versammlung(
	operatorId: string,
	stwegId: string,
	datum: string,
	art: Versammlungsart = 'ordentlich'
) {
	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art,
		stufe: 'erste',
		betriebsart: 'einfach',
		anlass: art === 'ausserordentlich' ? 'Wasserschaden Tiefgarage' : undefined
	});
	return v.id;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Vorlage A');
	betreiberB = await pruefbetreiber('Vorlage B');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Vorlagenweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
});

afterAll(verbindungenSchliessen);

describe('Pflichttraktanden entstehen von selbst', () => {
	it('legt sie beim Anlegen der Versammlung an, ohne Zutun', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-01');
		const liste = await holeTraktanden(betreiber, v);
		expect(liste).toHaveLength(FESTE_TRAKTANDEN.length + JAHRESGESCHAEFTE.length);
		expect(liste[0].knoten.titel).toMatch(/Beschlussfähigkeit/);
		expect(liste.every((t) => t.knoten.ausVorlage)).toBe(true);
	});

	it('nummeriert sie fortlaufend', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-02');
		const liste = await holeTraktanden(betreiber, v);
		expect(liste.map((t) => t.nummer)).toEqual(
			liste.map((_, i) => String(i + 1))
		);
	});

	it('legt bei der ausserordentlichen nur die festen an', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-03', 'ausserordentlich');
		const liste = await holeTraktanden(betreiber, v);
		expect(liste).toHaveLength(FESTE_TRAKTANDEN.length);
		expect(liste.map((t) => t.knoten.titel).join(' ')).not.toMatch(/Jahresrechnung/);
	});

	it('setzt das Mehrheitserfordernis aus dem Regelwerk', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-04');
		const liste = await holeTraktanden(betreiber, v);
		const jahresrechnung = liste.find((t) => t.knoten.titel === 'Jahresrechnung');
		expect(jahresrechnung?.knoten.erfordernis?.typ).toBe('einfaches_mehr');
		// **Die aktuelle Fassung, nicht eine feste.** Geprüft gehört, dass das
	// Erfordernis überhaupt eine Fassungskennung trägt (AD-4) — welche das
	// gerade ist, entscheidet das Regelwerksverzeichnis.
	expect(jahresrechnung?.knoten.erfordernis?.fassung).toBe(AKTUELLE_FASSUNG);
		expect(jahresrechnung?.knoten.erfordernis?.rechtsgrundlage).toMatch(/712m/);
	});

	it('lässt den Pfad leer, weil keine Frage beantwortet wurde', async () => {
		// Ein erfundener Pfad sähe im Protokoll aus wie eine Herleitung, die nie
		// stattfand.
		const v = await versammlung(betreiber, stweg, '2026-03-05');
		const liste = await holeTraktanden(betreiber, v);
		const jahresrechnung = liste.find((t) => t.knoten.titel === 'Jahresrechnung');
		expect(jahresrechnung?.knoten.erfordernis?.pfad).toEqual([]);
	});

	it('setzt bei der Kenntnisnahme kein Erfordernis', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-06');
		const liste = await holeTraktanden(betreiber, v);
		for (const t of liste.filter((x) => x.knoten.art === 'kenntnisnahme')) {
			expect(t.knoten.erfordernis, t.knoten.titel).toBeNull();
		}
	});

	it('schreibt einen Verlaufseintrag mit den Schlüsseln', async () => {
		const v = await versammlung(betreiber, stweg, '2026-03-07');
		const zeilen = await imKontext(betreiber, (tx) => tx<{ detail: { schluessel: string[] } }[]>`
			SELECT detail FROM audit_entry
			WHERE subject_id = ${v} AND event_type = 'agenda.template.applied'
		`);
		expect(zeilen[0].detail.schluessel).toContain('jahresrechnung');
	});
});

describe('Reglementsabweichung greift auch bei den Vorlagen', () => {
	it('wendet eine hinterlegte Regel auf die Jahresgeschäfte an', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Reglementsweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: g.id,
			geschaeftsart: 'jahresgeschaefte',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 9.2',
			enthaltungZaehltMit: true
		});

		const v = await versammlung(betreiber, g.id, '2026-04-01');
		const liste = await holeTraktanden(betreiber, v);
		const jahresrechnung = liste.find((t) => t.knoten.titel === 'Jahresrechnung');

		expect(jahresrechnung?.knoten.erfordernis?.quelle).toBe('reglement');
		expect(jahresrechnung?.knoten.erfordernis?.kopfSchwelle).toEqual({
			zaehler: 2,
			nenner: 3,
			art: 'mindestens'
		});
		expect(jahresrechnung?.knoten.erfordernis?.fundstelle).toBe('Reglement Ziff. 9.2');
	});

	/*
	 * **Der Fund der Nachprüfung vom 23.08.2026.** Die Fallbeschränkung
	 * (Migration 076) wirkte beim von Hand angelegten Traktandum und bei den
	 * Vorlagen **nicht** — zwei Traktanden desselben Falls standen mit
	 * verschiedenen Erfordernissen in derselben Liste.
	 *
	 * Die Ursache war eine zweite Lesestelle: `erfordernisse.ts` holt die Regeln
	 * für die Vorlagen und liess `node_id` weg. Alle Fachtests waren dabei grün —
	 * sie prüfen die Domäne, nicht die Leseschicht. Dieser Test geht durch beide.
	 */
	it('beschränkt eine Regel auch bei den Vorlagen auf ihren Fall', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Reglementsweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: g.id,
			geschaeftsart: 'jahresgeschaefte',
			// Nur der Erneuerungsfonds — nicht Jahresrechnung, Budget, Décharge.
			knotenId: 'k-erneuerungsfonds',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: '§ 15 (nur Erneuerungsfonds)',
			enthaltungZaehltMit: true
		});

		const v = await versammlung(betreiber, g.id, '2026-05-01');
		const liste = await holeTraktanden(betreiber, v);

		const jahresrechnung = liste.find((t) => t.knoten.titel === 'Jahresrechnung');
		expect(jahresrechnung, 'Pflichttraktandum Jahresrechnung fehlt').toBeTruthy();
		expect(
			jahresrechnung?.knoten.erfordernis?.quelle,
			'Die Regel für den Erneuerungsfonds trifft die Jahresrechnung mit'
		).not.toBe('reglement');
	});
});

describe('Übernahme aus einer früheren Versammlung', () => {
	it('bietet nur eigene, frühere Traktanden an — und keine Pflichttraktanden', async () => {
		// Letztere entstehen ohnehin; übernommen stünden sie doppelt.
		const alt = await versammlung(betreiber, stweg, '2025-09-15');
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Sanierung der Fassade',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});

		const neu = await versammlung(betreiber, stweg, '2026-09-15');
		const angebote = await holeUebernahmeangebote(betreiber, neu);
		const ausAlt = angebote.find((a) => a.versammlungId === alt);

		expect(ausAlt?.traktanden.map((t) => t.quelle.titel)).toEqual(['Sanierung der Fassade']);
	});

	/*
	 * **Spontanes kommt nicht mit** (Produktentscheid 02.10.2026, «Ja,
	 * weglassen»). Was im Saal entstanden ist, gehört zum Ablauf jener
	 * Versammlung, und ein übernommenes Rückkommen trägt den leeren Knoten, an
	 * dem die Reglementseite wirft (der Weg dorthin steht in
	 * `erfordernisse-nachziehen.test.ts`, «Ein Rückkommen am angenommenen
	 * Ziel»).
	 *
	 * Die drei Proben hier stellen das Merkmal mit einem `UPDATE` her: Das
	 * Angebot und die Absage sehen nur die Spalte, und den vollen Weg bis zum
	 * Rückkommen geht die Probe in der anderen Datei.
	 */
	it('bietet Spontanes nicht an, das gewöhnliche daneben schon', async () => {
		const alt = await versammlung(betreiber, stweg, '2025-08-01');
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Gartenunterhalt',
			art: 'abstimmung',
			antragswortlaut: 'Der Garten wird unterhalten.',
			antragstellerart: 'bewirtschaftung'
		});
		const spontan = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Spontane Kenntnisnahme',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});
		// `neu` verlangt eine Kenntnisnahme (`agenda_neu_nur_kenntnisnahme`);
		// `rueckkommen` verlangte ein Ziel, `folgeantrag` einen Elternteil. Das
		// Angebot sieht allein auf die Spalte.
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item SET is_spontaneous = true, spontaneous_kind = 'neu',
			                       added_during_meeting_at = now()
			 WHERE id = ${spontan.id}
		`);

		const neu = await versammlung(betreiber, stweg, '2027-05-02');
		// Die Begrenzung hoch setzen: Der Bestand dieser Prüfgemeinschaft wächst
		// mit jedem Test darüber.
		const angebote = await holeUebernahmeangebote(betreiber, neu, 30);
		const ausAlt = angebote.find((a) => a.versammlungId === alt);

		expect(ausAlt?.traktanden.map((t) => t.quelle.titel)).toEqual(['Gartenunterhalt']);
	});

	it('weist von Hand gesendetes Spontanes ab, ohne etwas zu kopieren', async () => {
		const alt = await versammlung(betreiber, stweg, '2025-08-05');
		const spontan = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Nachträglich aufgenommen',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item SET is_spontaneous = true, spontaneous_kind = 'neu',
			                       added_during_meeting_at = now()
			 WHERE id = ${spontan.id}
		`);

		const neu = await versammlung(betreiber, stweg, '2027-05-05');
		// Der Titel steht in der Absage, und dass nichts übernommen wurde: Bei
		// mehreren angekreuzten Punkten wäre sonst nicht erkennbar, welcher
		// gemeint ist und was mit den übrigen geschah.
		await expect(uebernimmTraktanden(handelnder(betreiber), neu, [spontan.id])).rejects.toThrow(
			/^«Nachträglich aufgenommen» ist erst während der Versammlung entstanden .* Übernommen wurde deshalb nichts\./
		);

		const liste = await holeTraktanden(betreiber, neu);
		expect(liste.some((t) => t.knoten.titel === 'Nachträglich aufgenommen')).toBe(false);
	});

	it('lässt eine Versammlung mit nur Spontanem die Begrenzung nicht verbrauchen', async () => {
		/*
		 * Die Abfrage zählt nur Versammlungen, die tatsächlich etwas anbieten.
		 * Ohne die Anpassung verdrängte die mittlere mit ihrem einen spontanen
		 * Punkt die ältere mit dem übernehmbaren: `hoechstens = 1` lieferte
		 * dann gar kein Angebot mehr.
		 */
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'STWEG Begrenzungsweg',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const alt = await versammlung(betreiber, g.id, '2024-01-01');
		await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Altes Geschäft',
			art: 'abstimmung',
			antragswortlaut: 'Es wird beschlossen.',
			antragstellerart: 'bewirtschaftung'
		});
		const mitte = await versammlung(betreiber, g.id, '2024-06-01');
		const spontan = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: mitte,
			titel: 'Nur Spontanes',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item SET is_spontaneous = true, spontaneous_kind = 'neu',
			                       added_during_meeting_at = now()
			 WHERE id = ${spontan.id}
		`);

		const neu = await versammlung(betreiber, g.id, '2027-06-01');
		const angebote = await holeUebernahmeangebote(betreiber, neu, 1);
		expect(angebote.map((a) => a.versammlungId)).toEqual([alt]);
	});

	it('übernimmt Titel, Wortlaut und Erfordernis samt Fassung', async () => {
		const alt = await versammlung(betreiber, stweg, '2025-10-01');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Ersatz der Heizung',
			art: 'abstimmung',
			antragswortlaut: 'Die Heizung wird ersetzt.',
			kurzfassung: 'Die alte Heizung wird durch eine Wärmepumpe ersetzt.',
			antragstellerart: 'bewirtschaftung'
		});
		// Ein Erfordernis aus einer älteren Fassung anhängen.
		await imKontext(betreiber, (tx) => tx`
			UPDATE agenda_item SET
				requirement_version = '2025-01-01',
				requirement_type = 'qualifiziertes_mehr',
				requirement_title = 'Qualifiziertes Mehr',
				requirement_legal_basis = 'ZGB Art. 647d Abs. 1',
				requirement_head_base = 'alle_eigentuemer',
				requirement_quota_base = 'alle_quoten',
				requirement_head_numerator = 1, requirement_head_denominator = 2,
				requirement_head_mode = 'mehr_als'
			WHERE id = ${t.id}
		`);

		const neu = await versammlung(betreiber, stweg, '2026-10-01');
		expect(await uebernimmTraktanden(handelnder(betreiber), neu, [t.id])).toBe(1);

		const liste = await holeTraktanden(betreiber, neu);
		const uebernommen = liste.find((x) => x.knoten.titel === 'Ersatz der Heizung');
		expect(uebernommen?.knoten.antragswortlaut).toBe('Die Heizung wird ersetzt.');
		expect(uebernommen?.knoten.kurzfassung).toMatch(/Wärmepumpe/);
		// Unverändert, samt Fassungskennung von damals (AD-4).
		expect(uebernommen?.knoten.erfordernis?.fassung).toBe('2025-01-01');
		expect(uebernommen?.knoten.erfordernis?.typ).toBe('qualifiziertes_mehr');
	});

	it('kennzeichnet das übernommene Traktandum mit Herkunft und Datum', async () => {
		const alt = await versammlung(betreiber, stweg, '2025-11-01');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Neue Briefkästen',
			art: 'abstimmung',
			antragswortlaut: 'Die Briefkästen werden ersetzt.',
			antragstellerart: 'bewirtschaftung'
		});

		const neu = await versammlung(betreiber, stweg, '2026-11-01');
		await uebernimmTraktanden(handelnder(betreiber), neu, [t.id]);

		const liste = await holeTraktanden(betreiber, neu);
		const uebernommen = liste.find((x) => x.knoten.titel === 'Neue Briefkästen');
		expect(uebernommen?.knoten.uebernommenAus?.datum).toBe('2025-11-01');
	});

	it('nimmt die Anhänge nicht mit', async () => {
		// Eine Offerte aus dem Vorjahr ist nicht mehr gültig.
		const alt = await versammlung(betreiber, stweg, '2025-12-01');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Offerte Gartenpflege',
			art: 'abstimmung',
			antragswortlaut: 'Die Offerte wird angenommen.',
			antragstellerart: 'bewirtschaftung'
		});
		await imKontext(betreiber, (tx) => tx`
			INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id, checksum,
			                        original_name, content_type, size_bytes)
			VALUES (${betreiber}, ${stweg}, 'agenda_item', ${t.id}, ${'a'.repeat(64)},
			        'offerte.pdf', 'application/pdf', 1234)
		`);

		const neu = await versammlung(betreiber, stweg, '2026-12-01');
		await uebernimmTraktanden(handelnder(betreiber), neu, [t.id]);

		const liste = await holeTraktanden(betreiber, neu);
		const neuesId = liste.find((x) => x.knoten.titel === 'Offerte Gartenpflege')?.knoten.id ?? '';
		const anhaenge = await imKontext(betreiber, (tx) => tx`
			SELECT id FROM attachment WHERE subject_type = 'agenda_item' AND subject_id = ${neuesId}
		`);
		expect(anhaenge).toHaveLength(0);
	});

	it('meldet im Angebot, dass Anhänge zurückbleiben', async () => {
		const mitAnhangV = await versammlung(betreiber, stweg, '2025-12-15');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: mitAnhangV,
			titel: 'Offerte Fensterreinigung',
			art: 'abstimmung',
			antragswortlaut: 'Die Offerte wird angenommen.',
			antragstellerart: 'bewirtschaftung'
		});
		await imKontext(betreiber, (tx) => tx`
			INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id, checksum,
			                        original_name, content_type, size_bytes)
			VALUES (${betreiber}, ${stweg}, 'agenda_item', ${t.id}, ${'b'.repeat(64)},
			        'fenster.pdf', 'application/pdf', 999)
		`);

		const neu = await versammlung(betreiber, stweg, '2027-01-15');
		const angebote = await holeUebernahmeangebote(betreiber, neu, 30);
		const mitAnhang = angebote
			.find((a) => a.versammlungId === mitAnhangV)
			?.traktanden.find((x) => x.quelle.titel === 'Offerte Fensterreinigung');
		expect(mitAnhang?.bleibtZurueck.join(' ')).toMatch(/Anhänge/);
	});

	it('weist ein Traktandum einer fremden Gemeinschaft ab', async () => {
		// Es brächte deren Antragsteller und deren Reglementslage mit.
		const fremdeG = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Anderswo 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const fremdeV = await versammlung(betreiber, fremdeG.id, '2025-06-01');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: fremdeV,
			titel: 'Fremdes Geschäft',
			art: 'abstimmung',
			antragswortlaut: 'Etwas anderes.',
			antragstellerart: 'bewirtschaftung'
		});

		const neu = await versammlung(betreiber, stweg, '2027-02-01');
		await expect(uebernimmTraktanden(handelnder(betreiber), neu, [t.id])).rejects.toThrow(
			/derselben Gemeinschaft/
		);
	});

	it('übernimmt nach der Freigabe nicht mehr', async () => {
		const alt = await versammlung(betreiber, stweg, '2025-07-01');
		const t = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: alt,
			titel: 'Zu spät',
			art: 'abstimmung',
			antragswortlaut: 'Etwas.',
			antragstellerart: 'bewirtschaftung'
		});
		const neu = await versammlung(betreiber, stweg, '2027-03-01');
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${neu}
		`);
		await expect(uebernimmTraktanden(handelnder(betreiber), neu, [t.id])).rejects.toThrow(
			/freigegeben/
		);
	});

	it('bietet einem fremden Betreiber nichts an', async () => {
		const neu = await versammlung(betreiber, stweg, '2027-04-01');
		expect(await holeUebernahmeangebote(betreiberB, neu).catch(() => 'nicht gefunden')).toBe(
			'nicht gefunden'
		);
	});

	/*
	 * **Erfolg ohne Wirkung** (Kreuzteil des Fremdbetreiber-Durchstichs,
	 * 28.10.2026). Die Kennung von B fiel unter dem Zeilenschutz still aus der
	 * Quellmenge; die Aktion leitete weiter wie nach einer Übernahme. Mit einer
	 * Kennung von A daneben wurde nur diese übernommen, und niemand erfuhr, dass
	 * die andere fehlte.
	 */
	it('sagt mit einem Traktandum eines anderen Betreibers ab und übernimmt nichts', async () => {
		const gB = await erstelleGemeinschaft(handelnder(betreiberB), {
			name: 'Vorlagenweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const tB = await erstelleTraktandum(handelnder(betreiberB), {
			meetingId: await versammlung(betreiberB, gB.id, '2025-08-01'),
			titel: 'Fremde Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		const tA = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: await versammlung(betreiber, stweg, '2025-08-01'),
			titel: 'Eigene Fassadensanierung',
			art: 'abstimmung',
			antragswortlaut: 'Die Fassade wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		const neu = await versammlung(betreiber, stweg, '2027-05-01');
		const titel = async () => (await holeTraktanden(betreiber, neu)).map((x) => x.knoten.titel);

		await expect(uebernimmTraktanden(handelnder(betreiber), neu, [tB.id])).rejects.toThrow(
			/Übernommen wurde deshalb nichts/
		);
		await expect(uebernimmTraktanden(handelnder(betreiber), neu, [tA.id, tB.id])).rejects.toThrow(
			/gibt es hier nicht/
		);
		expect(await titel()).not.toContain('Eigene Fassadensanierung');

		// Gegenhälfte: dieselbe Auswahl ohne die fremde Kennung geht durch.
		expect(await uebernimmTraktanden(handelnder(betreiber), neu, [tA.id])).toBe(1);
		expect(await titel()).toContain('Eigene Fassadensanierung');
	});
});
