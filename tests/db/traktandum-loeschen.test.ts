/**
 * Was beim Löschen eines Traktandums liegen blieb (Befund N4, Codeprüfung
 * Block 3, 17.10.2026; behoben am 18.10.2026).
 *
 * **Der Anlass.** Seit Migration 167 lässt sich ein Ausstand schon im Entwurf
 * erklären. Wurde das Traktandum danach gelöscht, blieben Zeile, Grund und
 * Name in `recusal` stehen: Die Spalte trägt keinen Fremdschlüssel, und keiner
 * der drei Löschwege der Anwendung räumte sie ab. Dasselbe galt für Unterlagen am Traktandum
 * (`attachment`, ohne Fremdschlüssel, weil es auf mehrere Arten von
 * Gegenständen zeigt). Alle übrigen Tabellen hängen per `ON DELETE CASCADE`
 * am Traktandum; gemessen an einer frisch migrierten Datenbank. Beim Löschen
 * der ganzen Versammlung brach `versammlung_loeschen` am Ausstand sogar ab
 * (Migration 168).
 *
 * **Wie hier gemessen wird.** Nicht Tabelle für Tabelle, sondern über jede
 * `uuid`-Spalte des Schemas (`spuren`). Das fängt jede Tabelle, in die die
 * Fälle unten Zeilen schreiben, auch eine, an die beim Abräumen niemand
 * dachte; eine neue Tabelle, die hier niemand befüllt, sieht die Probe nicht.
 * Ausgenommen sind die Nachweise, die bewusst bleiben: der Verlauf (nur
 * anfügbar, AD-5) und der KI-Nachweis (FR-63).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEigentuemer } from '$lib/server/eigentuemer';
import { erstelleVersammlung, loescheVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft, loescheGeschaeft, setzeBeteiligte } from '$lib/server/geschaeft';
import { erstelleTraktandum, loescheTraktandum } from '$lib/server/traktanden';
import { erklaereAusstand } from '$lib/server/ausstand';
import { haengeAn } from '$lib/server/anhaenge';
import { vollmachtsschluessel } from '$lib/domain/vollmacht';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });

/** Die Nachweise, die eine gelöschte Kennung absichtlich behalten. */
const NACHWEISE = ['audit_entry', 'ai_usage'];

/**
 * Jede Zeile ausserhalb der Nachweise, die die Kennung in einer `uuid`-Spalte
 * trägt, als «tabelle.spalte».
 */
async function spuren(id: string): Promise<string[]> {
	const spalten = await admin<{ tabelle: string; spalte: string }[]>`
		SELECT c.table_name AS tabelle, c.column_name AS spalte
		FROM information_schema.columns c
		JOIN information_schema.tables t
		  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
		WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
		  AND c.data_type = 'uuid' AND c.table_name <> ALL(${NACHWEISE})
	`;
	const treffer: string[] = [];
	for (const s of spalten) {
		const [{ n }] = await admin.unsafe<{ n: number }[]>(
			`SELECT count(*)::int AS n FROM "${s.tabelle}" WHERE "${s.spalte}" = $1`,
			[id]
		);
		if (n > 0) treffer.push(`${s.tabelle}.${s.spalte}`);
	}
	return treffer;
}

/** Die Angaben des Ereignisses «Traktandum entfernt» zu dieser Kennung. */
async function entfernt(id: string): Promise<Record<string, unknown>> {
	const [z] = await admin<{ detail: Record<string, unknown> }[]>`
		SELECT detail FROM audit_entry
		WHERE event_type = ${EREIGNISARTEN.traktandumEntfernt} AND subject_id = ${id}
	`;
	return z.detail;
}

async function gemeinschaftMitPartei(name: string) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: `Muster ${name}`,
		isCommunity: false,
		representativeName: null
	});
	return { stweg: g.id, partei: p.id, parteiname: `Muster ${name}` };
}

async function versammlungIm(stwegId: string, datum: string) {
	const v = await erstelleVersammlung(handelnder(), {
		stwegId,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	return v.id;
}

/**
 * Der Ausstand eines Vertreters ohne Partei, direkt angelegt.
 *
 * **Warum nicht über `erklaereAusstand`.** Er verlangt eine Vollmacht der
 * Versammlung, und Vollmachten entstehen erst ab der Freigabe (sie hängen an
 * der Momentaufnahme); mit ihnen lässt sich die Freigabe nicht mehr
 * zurücknehmen. Über die Anwendung gibt es diese Zeile im Entwurf also nicht,
 * im Zustand «freigegeben» aber schon, und dort löschen die Geschäftswege.
 * Geprüft wird hier das Abräumen, und das sieht nur die Zeile.
 */
async function vertreterausstand(meetingId: string, traktandumId: string) {
	await admin`
		INSERT INTO recusal (id, operator_id, meeting_id, agenda_item_id, holder_key, holder_name,
		                     grund, erklaert_durch)
		VALUES (uuidv7(), ${betreiber}, ${meetingId}, ${traktandumId},
		        ${vollmachtsschluessel('Beispielverwaltung AG')}, 'Beispielverwaltung AG',
		        'Es geht um ihren eigenen Auftrag', 'Prüflauf')
	`;
}

function pdf(name: string): File {
	return new File(
		[new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, ...new Array(64).fill(0x41)])],
		name,
		{ type: 'application/pdf' }
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Traktandum löschen');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-loeschen');
});

afterAll(verbindungenSchliessen);

describe('Ein Traktandum im Entwurf löschen', () => {
	it('lässt keinen Ausstand und keine Unterlage zurück, und der Verlauf nennt beide', async () => {
		const s = await gemeinschaftMitPartei('Löschweg 1');
		const v = await versammlungIm(s.stweg, '2027-03-01');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: v,
			titel: 'Ersatz der Waschmaschine',
			art: 'abstimmung',
			antragswortlaut: 'Die Waschmaschine wird ersetzt.',
			antragstellerart: 'bewirtschaftung'
		});
		await erklaereAusstand(handelnder(), v, t.id, s.partei, 'Liefert die Maschine selbst');
		await vertreterausstand(v, t.id);
		await haengeAn(handelnder(), v, 'agenda_item', t.id, pdf('offerte.pdf'));
		expect(await spuren(t.id)).toEqual(
			expect.arrayContaining(['recusal.agenda_item_id', 'attachment.subject_id'])
		);

		await loescheTraktandum(handelnder(), v, t.id);

		expect(await spuren(t.id)).toEqual([]);
		const angaben = await entfernt(t.id);
		expect(angaben.ausstaende).toEqual([
			{ partei: s.parteiname, parteiId: s.partei, grund: 'Liefert die Maschine selbst' },
			{ partei: 'Beispielverwaltung AG', vertreter: true, grund: 'Es geht um ihren eigenen Auftrag' }
		]);
		expect(angaben.anhaenge).toEqual([{ name: 'offerte.pdf', pruefsumme: expect.any(String) }]);
		// Nicht als Rücknahme: Sie ist ein Protokollvorgang und behauptete einen
		// Entscheid (fb0d7eb). Gegenprobe der Featureprüfung Block 3, 18.10.2026:
		// Ein zusätzliches Rücknahme-Ereignis beim Abräumen blieb bis dahin
		// unbemerkt. Die Datei nimmt sonst nirgends einen Ausstand zurück.
		const [{ n }] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM audit_entry
			WHERE event_type = ${EREIGNISARTEN.ausstandZurueckgenommen} AND operator_id = ${betreiber}
		`;
		expect(n).toBe(0);
	});

	it('schreibt ohne Mitgelöschtes keine leeren Listen in den Verlauf', async () => {
		const s = await gemeinschaftMitPartei('Löschweg 2');
		const v = await versammlungIm(s.stweg, '2027-03-02');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: v,
			titel: 'Gartenpflege',
			art: 'kenntnisnahme',
			antragstellerart: 'bewirtschaftung'
		});
		await loescheTraktandum(handelnder(), v, t.id);
		const angaben = await entfernt(t.id);
		expect(angaben).not.toHaveProperty('ausstaende');
		expect(angaben).not.toHaveProperty('anhaenge');
	});

	it('bleibt ausserhalb des Entwurfs gesperrt, und der Ausstand bleibt stehen', async () => {
		const s = await gemeinschaftMitPartei('Löschweg 3');
		const v = await versammlungIm(s.stweg, '2027-03-03');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: v,
			titel: 'Dachsanierung',
			art: 'abstimmung',
			antragswortlaut: 'Das Dach wird saniert.',
			antragstellerart: 'bewirtschaftung'
		});
		await erklaereAusstand(handelnder(), v, t.id, s.partei, 'Ist am Dachdecker beteiligt');
		await imKontext(
			betreiber,
			(tx) => tx`UPDATE meeting SET state = 'freigegeben', released_at = now() WHERE id = ${v}`
		);

		await expect(loescheTraktandum(handelnder(), v, t.id)).rejects.toThrow(/freigegeben/);
		expect(await spuren(t.id)).toEqual(
			expect.arrayContaining(['agenda_item.id', 'recusal.agenda_item_id'])
		);
	});
});

describe('Ein Traktandum über das Geschäft des Abends löschen', () => {
	async function abend(name: string) {
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: `${name}, Abend`,
			datum: '2027-04-01',
			uhrzeit: '18:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			anlass: null
		});
		const haeuser = [];
		for (let i = 0; i < 2; i++) {
			const s = await gemeinschaftMitPartei(`${name}, Haus ${i + 1}`);
			const m = await erstelleVersammlung(handelnder(), {
				stwegId: s.stweg,
				datum: '2027-04-01',
				uhrzeit: '18:00',
				ort: 'Prüfsaal',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'einfach'
			});
			await nimmInTagAuf(handelnder(), tag.id, m.id, i);
			haeuser.push({ ...s, versammlung: m.id });
		}
		const g = await erstelleGeschaeft(handelnder(), tag.id, {
			titel: 'Neue Briefkästen',
			antragswortlaut: 'Die Briefkastenanlage wird ersetzt.',
			meetingIds: haeuser.map((h) => h.versammlung)
		});
		const traktanden = await admin<{ id: string; meeting_id: string }[]>`
			SELECT id, meeting_id FROM agenda_item WHERE business_id = ${g.id}
		`;
		const traktandumIn = (m: string) => traktanden.find((t) => t.meeting_id === m)!.id;
		for (const h of haeuser) {
			const t = traktandumIn(h.versammlung);
			await erklaereAusstand(handelnder(), h.versammlung, t, h.partei, 'Hat die Anlage offeriert');
			await vertreterausstand(h.versammlung, t);
		}
		return { tag: tag.id, geschaeft: g.id, haeuser, traktandumIn };
	}

	it('räumt beim Löschen des Geschäfts in jedem Haus ab', async () => {
		const a = await abend('Geschäft löschen');
		const ids = a.haeuser.map((h) => a.traktandumIn(h.versammlung));

		await loescheGeschaeft(handelnder(), a.tag, a.geschaeft);

		for (const id of ids) {
			expect(await spuren(id)).toEqual([]);
			expect((await entfernt(id)).ausstaende).toHaveLength(2);
		}
	});

	it('räumt ab, wenn ein Haus das Geschäft verlässt, und lässt das andere stehen', async () => {
		const a = await abend('Haus heraus');
		const [bleibt, geht] = a.haeuser;
		const bleibtId = a.traktandumIn(bleibt.versammlung);
		const gehtId = a.traktandumIn(geht.versammlung);

		await setzeBeteiligte(handelnder(), a.tag, a.geschaeft, [bleibt.versammlung]);

		expect(await spuren(gehtId)).toEqual([]);
		expect((await entfernt(gehtId)).ausstaende).toHaveLength(2);
		expect(await spuren(bleibtId)).toEqual(
			expect.arrayContaining(['agenda_item.id', 'recusal.agenda_item_id'])
		);
	});
});

describe('Eine Versammlung im Entwurf mit Ausstand vorab löschen', () => {
	it('geht, statt am Fremdschlüssel des Ausstands abzubrechen (Migration 168)', async () => {
		const s = await gemeinschaftMitPartei('Löschweg 4');
		const v = await versammlungIm(s.stweg, '2027-03-04');
		const t = await erstelleTraktandum(handelnder(), {
			meetingId: v,
			titel: 'Heizungsersatz',
			art: 'abstimmung',
			antragswortlaut: 'Die Heizung wird ersetzt.',
			antragstellerart: 'bewirtschaftung'
		});
		await erklaereAusstand(handelnder(), v, t.id, s.partei, 'Ist Inhaber der Heizungsfirma');

		await loescheVersammlung(handelnder(), v, true);

		expect(await spuren(t.id)).toEqual([]);
		expect(await spuren(v)).toEqual([]);
	});
});
