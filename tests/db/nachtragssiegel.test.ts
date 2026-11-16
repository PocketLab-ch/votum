/**
 * Das Nachtragssiegel je Protokollfassung an der Datenbank (Ä-39, Migration 161).
 *
 * Gemessen wird, was sich nur hier zeigt: dass jede Fassung nach dem Siegel
 * eines trägt und vorher keine, dass die Kette auf das vorige Siegel zeigt,
 * dass der Auslöser einen Weg an der Anwendung vorbei abweist, dass das
 * Prüfwerkzeug beide Siegel bestätigt und eine von Hand veränderte Fassung
 * meldet, und dass zwei gleichzeitige Fassungen die Kette nicht gabeln.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum } from '$lib/server/traktanden';
import { erzeugeProtokollentwurf, halteFassungFest, speichereProtokoll } from '$lib/server/protokoll';
import { holePaket, holeSiegel, versiegle } from '$lib/server/siegel';
import { holeNachtragspaket, pruefeKetteDerVersammlung } from '$lib/server/nachtragssiegel';
import { entpacke, pruefePaket } from '$lib/server/paketpruefung';
import { packe, dosZeitstempel } from '$lib/domain/archiv';
import type { Nachtragsmanifest } from '$lib/domain/nachtragssiegel';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { halteSperre, warteAufWartende } from './rennen';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

/** Eine geschlossene Versammlung mit Protokollentwurf, auf Wunsch versiegelt. */
async function geschlossen(name: string, datum: string, versiegeln = true) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		tieBreak: 'keiner'
	});
	const e = await erstelleEinheit(handelnder(), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Erika Beispiel',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		parentId: null,
		titel: 'Jahresbericht',
		art: 'kenntnisnahme',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	await schliesseVersammlung(handelnder(), v.id);
	if (versiegeln) await versiegle(handelnder(), v.id, `${datum} 21:30:00`);
	await erzeugeProtokollentwurf(handelnder(), v.id, `${datum}T21:40:00Z`);
	return v.id;
}

async function zeile(meetingId: string, nummer: number) {
	const [z] = await admin<
		{ seal_manifest: string | null; seal_hash: string | null; seal_previous: string | null; body: string }[]
	>`SELECT seal_manifest, seal_hash, seal_previous, body FROM minutes_version
	   WHERE meeting_id = ${meetingId} AND number = ${nummer}`;
	return z;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Nachtragssiegel');
	benutzer = await pruefbenutzer(betreiber, 'nachtragsleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Kette', () => {
	it('lässt eine Fassung vor dem Siegel ohne Nachtragssiegel', async () => {
		const v = await geschlossen('Nachtrag 1', '2027-12-01', false);
		const f = await halteFassungFest(handelnder(), v, 'festgehalten');
		const z = await zeile(v, f.nummer);
		expect(z.seal_hash).toBeNull();
		expect(await pruefeKetteDerVersammlung(betreiber, v)).toBeNull();
	});

	it('siegelt jede Fassung nach dem Siegel und verweist auf das vorige', async () => {
		const v = await geschlossen('Nachtrag 2', '2027-12-02');
		const grund = (await holeSiegel(betreiber, v))!.siegel;

		const erste = await halteFassungFest(handelnder(), v, 'versandt');
		const z1 = await zeile(v, erste.nummer);
		expect(z1.seal_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(z1.seal_previous).toBe(grund);

		await speichereProtokoll(handelnder(), v, `${z1.body}\n\nBerichtigt: Tippfehler.`, z1.body);
		const zweite = await halteFassungFest(handelnder(), v, 'genehmigt');
		const z2 = await zeile(v, zweite.nummer);
		expect(z2.seal_previous).toBe(z1.seal_hash);

		const m = JSON.parse(z2.seal_manifest!) as Nachtragsmanifest;
		expect(m.grundsiegel).toBe(grund);
		expect(m.vorgaenger).toEqual({ siegel: z1.seal_hash, was: 'protokollfassung', nummer: erste.nummer });

		const kette = await pruefeKetteDerVersammlung(betreiber, v);
		expect(kette?.haelt).toBe(true);
		expect(kette?.glieder.map((g) => g.nummer)).toEqual([erste.nummer, zweite.nummer]);
	});

	it('meldet eine von Hand veränderte Fassung (Gegenprobe)', async () => {
		const v = await geschlossen('Nachtrag 3', '2027-12-03');
		const f = await halteFassungFest(handelnder(), v, 'versandt');
		await halteFassungFest(handelnder(), v, 'genehmigt');

		// An allen Schutzschichten vorbei, wie es nur der Betrieb der Datenbank kann.
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`UPDATE minutes_version SET body = body || ' (nachträglich)'
			          WHERE meeting_id = ${v} AND number = ${f.nummer}`;
		});

		const kette = await pruefeKetteDerVersammlung(betreiber, v);
		expect(kette?.haelt).toBe(false);
		expect(kette?.glieder.find((g) => g.nummer === f.nummer)?.maengel).toContain(
			'der Wortlaut weicht von der Prüfsumme im Manifest ab'
		);
		expect(kette?.satz).toMatch(new RegExp(`Fassung Nr\\. ${f.nummer}: der Wortlaut weicht`));
	});
});

describe('Der Auslöser', () => {
	/*
	 * **Grossbuchstaben in der Adresse** (Codeprüfung H8, Teil B, zweiter
	 * Durchgang, M1). Der Matcher nimmt sie an, das erste Siegel schreibt die
	 * Kennung so ins Manifest, und ohne `lower()` im Auslöser liesse sich danach
	 * keine Fassung mehr festhalten.
	 */
	it('nimmt eine Fassung an, auch wenn das Siegel die Kennung gross geschrieben trägt', async () => {
		const v = await geschlossen('Nachtrag Grossbuchstaben', '2027-12-11', false);
		await versiegle(handelnder(), v.toUpperCase(), '2027-12-11 21:30:00');
		const f = await halteFassungFest(handelnder(), v, 'versandt');
		expect((await zeile(v, f.nummer)).seal_hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('weist eine Fassung nach dem Siegel ohne Nachtragssiegel ab, auch am Serverteil vorbei', async () => {
		const v = await geschlossen('Nachtrag 4', '2027-12-04');
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind)
					VALUES (${betreiber}, ${v}, 99, 'An der Kette vorbei', 'festgehalten')
				`
			)
		).rejects.toThrow(/braucht ein Nachtragssiegel/);
	});

	it('weist ein Nachtragssiegel ab, das nicht zum Wortlaut passt', async () => {
		const v = await geschlossen('Nachtrag 5', '2027-12-05');
		const f = await halteFassungFest(handelnder(), v, 'festgehalten');
		const z = await zeile(v, f.nummer);
		// Dasselbe Manifest unter einer neuen Nummer und mit anderem Wortlaut:
		// Vorgänger, Nummer und Prüfsumme passen nicht mehr.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind,
					                             seal_manifest, seal_hash, seal_previous)
					VALUES (${betreiber}, ${v}, ${f.nummer + 1}, 'Anderer Wortlaut', 'festgehalten',
					        ${z.seal_manifest}, ${z.seal_hash}, ${z.seal_hash})
				`
			)
		).rejects.toThrow(/passt nicht zu dieser Fassung/);
	});
});

describe('Das Prüfwerkzeug', () => {
	it('bestätigt das Abschlusspaket und das Nachtragssiegel, und meldet eine veränderte Fassung', async () => {
		const v = await geschlossen('Nachtrag 6', '2027-12-06');
		const f = await halteFassungFest(handelnder(), v, 'versandt');

		const grund = await pruefePaket(betreiber, (await holePaket(betreiber, v))!, null, null);
		expect(grund.inhalt?.bestandteileStimmen && grund.inhalt?.manifestStimmt).toBe(true);
		expect(grund.siegelquelle).toBe('datenbank');

		const paket = (await holeNachtragspaket(betreiber, v, f.nummer))!;
		const nachtrag = await pruefePaket(betreiber, paket, null, null);
		expect(nachtrag.art).toBe('nachtragssiegel');
		expect(nachtrag.siegelquelle).toBe('datenbank');
		expect(nachtrag.inhalt?.bestandteileStimmen && nachtrag.inhalt?.manifestStimmt).toBe(true);
		expect(nachtrag.kette?.haelt).toBe(true);
		expect(nachtrag.satz).toMatch(/Das Nachtragssiegel hält/);

		// Gegenprobe: der Wortlaut im Paket von Hand verändert, neu gepackt.
		const dateien = entpacke(paket);
		const name = `protokoll-fassung-${f.nummer}.txt`;
		const verfaelscht = packe(
			[...dateien].map(([n, inhalt]) => ({
				name: n,
				inhalt: n === name ? new TextEncoder().encode('Ein anderer Wortlaut.') : inhalt
			})),
			dosZeitstempel('2027-12-06 22:00:00')
		);
		const falsch = await pruefePaket(betreiber, verfaelscht, null, null);
		expect(falsch.inhalt?.bestandteileStimmen).toBe(false);
		expect(falsch.inhalt?.abweichungen.map((a) => a.pfad)).toEqual([name]);
		expect(falsch.satz).toMatch(/verändert worden/);

		// Ein anderes Manifest unter Kennung und Nummer einer echten Fassung: Die
		// Kette wird nicht als haltend gemeldet (Sicherheitsprüfung H8, Teil B).
		const manifest = JSON.parse(new TextDecoder().decode(dateien.get('manifest.json'))) as Nachtragsmanifest;
		manifest.protokollfassung.bemerkung = 'untergeschoben';
		const fremd = packe(
			[...dateien].map(([n, inhalt]) => ({
				name: n,
				inhalt: n === 'manifest.json' ? new TextEncoder().encode(JSON.stringify(manifest, null, 2)) : inhalt
			})),
			dosZeitstempel('2027-12-06 22:00:00')
		);
		const untergeschoben = await pruefePaket(betreiber, fremd, null, null);
		expect(untergeschoben.herkunft.stimmtUeberein).toBe(false);
		expect(untergeschoben.kette?.haelt).toBe(false);
	});
});

describe('Das Prüfwerkzeug lässt sich nicht über «art» herabstufen', () => {
	/*
	 * **Codeprüfung H8, Teil B, Befund 2.** Ein Abschlusspaket, dessen Manifest
	 * «art: nachtragssiegel» trägt und neu gerechnet ist, meldete vorher «nicht
	 * (mehr) festgehalten», obwohl die Versammlung hier steht. Jetzt entscheidet
	 * das Siegel der Versammlung, ob sie bekannt ist.
	 */
	it('nennt die Versammlung als bekannt und das Paket als fremd', async () => {
		const v = await geschlossen('Nachtrag Herabstufung', '2027-12-09');
		const dateien = entpacke((await holePaket(betreiber, v))!);
		const manifest = JSON.parse(new TextDecoder().decode(dateien.get('manifest.json'))) as Record<
			string,
			unknown
		>;
		manifest.art = 'nachtragssiegel';
		const gefaelscht = packe(
			[...dateien].map(([n, inhalt]) => ({
				name: n,
				inhalt: n === 'manifest.json' ? new TextEncoder().encode(JSON.stringify(manifest, null, 2)) : inhalt
			})),
			dosZeitstempel('2027-12-09 22:00:00')
		);
		const b = await pruefePaket(betreiber, gefaelscht, null, null);
		expect(b.herkunft.bekannt).toBe(true);
		expect(b.herkunft.stimmtUeberein).toBe(false);
		expect(b.siegelquelle).toBe('datenbank');
		expect(b.satz).toMatch(/hier festgehalten, aber an dieser Stelle/);
		expect(b.kette?.haelt).toBe(false);
	});
});

describe('Der Auslöser prüft das Manifest ganz', () => {
	it('weist ein Manifest mit falschem Vorgänger-Etikett ab', async () => {
		const v = await geschlossen('Nachtrag Etikett', '2027-12-10');
		const grund = (await holeSiegel(betreiber, v))!.siegel;
		const body = 'Wortlaut der Fassung';
		const { createHash } = await import('node:crypto');
		const pruef = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
		const manifest = {
			art: 'nachtragssiegel',
			grundsiegel: grund,
			versammlung: { kennung: v },
			vorgaenger: { siegel: grund, was: 'protokollfassung', nummer: 7 },
			protokollfassung: { nummer: 1 },
			eintraege: [{ pfad: 'protokoll-fassung-1.txt', pruefsumme: pruef(body) }]
		};
		const text = JSON.stringify(manifest);
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind,
					                             seal_manifest, seal_hash, seal_previous)
					VALUES (${betreiber}, ${v}, 1, ${body}, 'festgehalten', ${text}, ${pruef(text)}, ${grund})
				`
			)
		).rejects.toThrow(/passt nicht zu dieser Fassung/);

		// Gegenprobe: dasselbe mit richtigem Etikett geht durch.
		const richtig = JSON.stringify({ ...manifest, vorgaenger: { siegel: grund, was: 'abschlusspaket', nummer: null } });
		await imKontext(
			betreiber,
			(tx) => tx`
				INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind,
				                             seal_manifest, seal_hash, seal_previous)
				VALUES (${betreiber}, ${v}, 1, ${body}, 'festgehalten', ${richtig}, ${pruef(richtig)}, ${grund})
			`
		);
	});
});

describe('Im Rennen', () => {
	/*
	 * **Zwei Fassungen zugleich gabeln die Kette nicht** (H5-Nachtrag zu H8).
	 * Ohne die Sperre in `halteFassungFest` läsen beide dasselbe vorige Siegel;
	 * der eindeutige Index liesse die zweite dann als rohe Ausnahme scheitern.
	 * Mit der Sperre wartet sie und hängt sich hinter die erste.
	 */
	it('reiht zwei gleichzeitige Fassungen hintereinander', async () => {
		const v = await geschlossen('Nachtrag Rennen', '2027-12-07');
		const sperre = await halteSperre(async (tx) => {
			await tx`SELECT 1 FROM meeting WHERE id = ${v} FOR UPDATE`;
		});
		const a = halteFassungFest(handelnder(), v, 'festgehalten', 'erste');
		await warteAufWartende(1);
		const b = halteFassungFest(handelnder(), v, 'festgehalten', 'zweite');
		await warteAufWartende(2);
		await sperre.loesen();
		const [ra, rb] = await Promise.allSettled([a, b]);
		expect(ra.status).toBe('fulfilled');
		expect(rb.status).toBe('fulfilled');
		const kette = await pruefeKetteDerVersammlung(betreiber, v);
		expect(kette?.haelt).toBe(true);
		expect(kette?.glieder).toHaveLength(2);
	});

	it('wartet auf ein laufendes Siegel und hängt sich an es an', async () => {
		const v = await geschlossen('Nachtrag Siegelrennen', '2027-12-08', false);
		const sperre = await halteSperre(async (tx) => {
			await tx`SELECT 1 FROM meeting WHERE id = ${v} FOR UPDATE`;
		});
		const siegel = versiegle(handelnder(), v, '2027-12-08 21:30:00');
		await warteAufWartende(1);
		const fassung = halteFassungFest(handelnder(), v, 'festgehalten');
		await warteAufWartende(2);
		await sperre.loesen();
		const [s, f] = await Promise.allSettled([siegel, fassung]);
		expect(s.status).toBe('fulfilled');
		expect(f.status).toBe('fulfilled');
		const z = await zeile(v, (f as PromiseFulfilledResult<{ nummer: number }>).value.nummer);
		expect(z.seal_previous).toBe((await holeSiegel(betreiber, v))!.siegel);
	});
});
