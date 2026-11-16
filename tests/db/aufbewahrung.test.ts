/**
 * Aufbewahrung und Löschung (FR-57).
 *
 * **Worauf es ankommt:** Die Sperre gegen zu frühes Löschen liegt in der
 * Datenbank, nicht in der Oberfläche. Geprüft wird deshalb mit rohem SQL unter
 * der Anwendungsrolle — wer morgen einen neuen Löschweg baut, kommt an diesem
 * Auslöser vorbei, ob er will oder nicht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { versiegle } from '$lib/server/siegel';
import {
	erhebeLage,
	loescheBetriebsdaten,
	erhebeLoeschlage,
	loescheNachFrist,
	pruefeLoeschungVorab
} from '$lib/server/aufbewahrung';
import { erfassePendenz } from '$lib/server/pendenz';
import { erstelleTraktandum, loescheTraktandum } from '$lib/server/traktanden';
import { legeInternAb, lies } from '$lib/server/dateien';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';


/**
 * Eine Fassung nach dem Siegel ohne Nachtragssiegel, wie es sie vor
 * Migration 161 gab.
 *
 * **Warum an der Kette vorbei** (H8, Teil B). Seit Migration 161 verlangt der
 * Auslöser für jede Fassung nach dem Siegel ein Nachtragssiegel. Diese
 * Vorrichtung misst die Löschung und die Genehmigung, nicht die Kette, und sie
 * muss Fassungen rückdatieren, was der Anwendungsweg (`halteFassungFest`)
 * nicht kann. Unter `replica` laufen die Auslöser nicht, wie in den
 * Löschfunktionen selbst. Die Kette prüft `tests/db/nachtragssiegel.test.ts`.
 */
async function anDerKetteVorbei(schreibe: (tx: postgres.TransactionSql) => Promise<unknown>) {
	await admin.begin(async (tx) => {
		await tx`SET LOCAL session_replication_role = replica`;
		await schreibe(tx);
	});
}

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

/** Eine Versammlung mit Zugängen, wahlweise geschlossen und versiegelt. */
async function mitZugaengen(
	name: string,
	datum: string,
	bis: 'offen' | 'zu' | 'siegel',
	/**
	 * Ein Griff in den Entwurf, bevor freigegeben wird. Gebraucht für das
	 * entfernte Traktandum: `loescheTraktandum` verlangt den Entwurf.
	 */
	vorFreigabe?: (s: { gemeinschaft: string; versammlung: string; partei: string }) => Promise<void>
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(betreiber), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Aebi',
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	if (vorFreigabe) await vorFreigabe({ gemeinschaft: g.id, versammlung: v.id, partei: p.id });
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await erzeugeZugaenge(handelnder(betreiber), v.id);

	if (bis !== 'offen') {
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		await schliesseVersammlung(handelnder(betreiber), v.id);
	}
	if (bis === 'siegel') {
		await versiegle(handelnder(betreiber), v.id, `${datum} 21:30:00`);
	}

	return { gemeinschaft: g.id, versammlung: v.id };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Aufbewahrung');
	benutzer = await pruefbenutzer(betreiber, 'aufbewahrungsleitung');
});

afterAll(verbindungenSchliessen);

describe('Die Frist', () => {
	it('hält die Datenbank davon ab, ein versiegeltes Paket zu löschen', async () => {
		const { gemeinschaft, versammlung } = await mitZugaengen('Fristweg 1', '2026-11-01', 'siegel');

		// **Zwei Schranken, nicht eine.** Die Anwendungsrolle darf Versammlungen
		// von vornherein nicht löschen (Migration 011) …
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM meeting WHERE id = ${versammlung}`)
		).rejects.toThrow(/permission denied/i);

		// … und wer die Rechte doch hat — Wartung, Migration, Datenbankzugriff von
		// Hand —, läuft in den Auslöser. Genau dafür ist er da.
		await expect(admin`DELETE FROM meeting WHERE id = ${versammlung}`).rejects.toThrow(
			/Anfechtungsfrist/i
		);

		// Und auch nicht auf dem Umweg über die Gemeinschaft.
		await expect(admin`DELETE FROM stweg WHERE id = ${gemeinschaft}`).rejects.toThrow(
			/Anfechtungsfrist/i
		);
	});

	it('greift nur, wo ein Siegel ist — ein Entwurf ist kein Nachweis', async () => {
		const ohne = await mitZugaengen('Fristweg 2', '2026-11-02', 'zu');
		const mit = await mitZugaengen('Fristweg 3', '2026-11-05', 'siegel');

		const [a] = await admin<
			{ laeuft: boolean }[]
		>`SELECT aufbewahrung_laeuft(${ohne.versammlung}) AS laeuft`;
		const [b] = await admin<
			{ laeuft: boolean }[]
		>`SELECT aufbewahrung_laeuft(${mit.versammlung}) AS laeuft`;

		expect(a.laeuft).toBe(false);
		expect(b.laeuft).toBe(true);

		// Die Jahresfrist ist abgeschafft (Migration 114), ihre Rechenfunktion auch.
		await expect(admin`SELECT aufbewahrung_bis(${mit.versammlung})`).rejects.toThrow(
			/does not exist/
		);
	});
});

describe('Die Pakettabelle', () => {
	/*
	 * **Warum dieser Test sein muss** (26.08.2026, aus dem Code-Review): Bis
	 * hierhin las kein einziger Test `lage.pakete` — die Vorrichtung erzeugte
	 * Siegel, und niemand schaute sie an. Damit waeren eine Vertauschung von
	 * Datum und Ort in der Abbildung und eine falsche Typangabe gruen
	 * durchgelaufen. Genau Letzteres war der Fall: `meeting_date` kam als `Date`
	 * heraus, deklariert war `string`.
	 */
	it('fuehrt je Paket Datum, Ort und das versiegelnde Konto', async () => {
		const { versammlung } = await mitZugaengen('Paketweg 1', '2026-11-07', 'siegel');

		const lage = await erhebeLage(betreiber);
		const paket = lage.pakete.find((z) => z.versammlungId === versammlung);
		expect(paket).toBeDefined();

		// **Der Typ, nicht nur der Wert.** Ein `Date` bestuende jeden Vergleich
		// unten und braeche erst beim ersten `split` in der Oberflaeche.
		expect(typeof paket!.datum).toBe('string');
		expect(paket!.datum).toBe('2026-11-07');
		expect(paket!.ort).toBe('Pruefsaal'.replace('Pruef', 'Prüf'));
		expect(paket!.versiegeltDurch).toBe('Prüflauf');

		// Nicht vertauscht: Bezeichnung ist die Gemeinschaft, nicht der Ort.
		expect(paket!.bezeichnung).toBe('Paketweg 1');

		// Ohne festgehaltenen Versand weiss die Seite nicht, ab wann gelöscht
		// werden darf, und sagt das mit `null` statt mit einem erfundenen Datum.
		expect(paket!.versandtAm).toBeNull();
		expect(paket!.loeschbarAb).toBeNull();
		expect(paket!.versiegeltAm.slice(0, 4)).toBe('2026');
	});
});

describe('Betriebsdaten', () => {
	it('verschwinden auf Zuruf — der Nachweis bleibt', async () => {
		const { versammlung } = await mitZugaengen('Löschweg 1', '2026-11-03', 'siegel');

		const vorher = await erhebeLage(betreiber);
		const posten = vorher.offen.find((o) => o.versammlungId === versammlung);
		expect(posten?.zugaenge).toBeGreaterThan(0);

		const befund = await loescheBetriebsdaten(handelnder(betreiber), versammlung);
		expect(befund.zugaenge).toBe(posten!.zugaenge);

		const nachher = await erhebeLage(betreiber);
		expect(nachher.offen.find((o) => o.versammlungId === versammlung)).toBeUndefined();

		// Der Stimmberechtigtenstand — der Nachweis — steht unverändert da.
		const [stand] = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM snapshot_party WHERE meeting_id = ${versammlung}`
		);
		expect(stand.n).toBeGreaterThan(0);

		// Und die Löschung selbst steht im Verlauf, der sie nicht mitlöschen kann.
		const [spur] = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM audit_entry
			            WHERE subject_id = ${versammlung}
			              AND event_type = 'meeting.operational.purged'`
		);
		expect(spur.n).toBe(1);
	});

	it('bleiben, solange die Versammlung läuft', async () => {
		// Sonst nähme man den Anwesenden mitten in der Sitzung die Telefone weg.
		const { versammlung } = await mitZugaengen('Löschweg 2', '2026-11-04', 'offen');
		await expect(loescheBetriebsdaten(handelnder(betreiber), versammlung)).rejects.toThrow(
			/noch nicht geschlossen/i
		);
	});
});

describe('Löschen nach Ablauf der Anfechtungsfrist', () => {
	const alleBestaetigt = { paketArchiviert: true, protokollArchiviert: true, keineAnfechtung: true };

	/**
	 * Eine versiegelte Versammlung, deren Schluss im Januar 2025 liegt.
	 *
	 * **Mit den Zeilen, die die Funktion ohne Fremdschlüsselschutz löscht**:
	 * Vollmacht samt Empfehlung und Anhang, Protokoll und festgehaltene Fassung.
	 * Ohne sie bestünde der Test, auch wenn genau dieser Abschnitt Waisen
	 * hinterliesse. Eingefügt wird vor dem Siegel, danach sperren die Auslöser —
	 * die versandte Fassung ausgenommen: Sie entsteht seit Migration 138
	 * ausdrücklich erst nach dem Siegel und wird deshalb dort angelegt.
	 */
	/** Eine spätere Versammlung derselben Gemeinschaft, freigegeben oder geschlossen. */
	async function folgeversammlung(gemeinschaft: string, datum: string, schliessen = true) {
		const f = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: gemeinschaft,
			datum,
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), f.id);
		if (schliessen) {
			await erzeugeZugaenge(handelnder(betreiber), f.id);
			await eroeffneVersammlung(handelnder(betreiber), f.id);
			await schliesseVersammlung(handelnder(betreiber), f.id);
		}
		return f.id;
	}

	/** Hält eine Fassung «von der Versammlung genehmigt» fest, wie die Protokollseite. */
	async function halteGenehmigtFest(versammlung: string, festgehaltenAm?: string) {
		await anDerKetteVorbei((tx) => tx`
			INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind, frozen_at)
			VALUES (${betreiber}, ${versammlung},
			        (SELECT coalesce(max(number), 0) + 1 FROM minutes_version WHERE meeting_id = ${versammlung}),
			        'Protokoll der Prüfung', 'genehmigt', coalesce(${festgehaltenAm ?? null}::timestamptz, now()))
		`);
	}

	async function genehmigung(versammlung: string): Promise<string> {
		const [z] = await imKontext(
			betreiber,
			(tx) => tx<{ stand: string }[]>`SELECT protokoll_genehmigung(${versammlung}) AS stand`
		);
		return z.stand;
	}

	async function alteVersammlung(
		name: string,
		datum = '2025-01-10',
		{
			genehmigt = true,
			mitEntferntem = false
		}: { genehmigt?: boolean; mitEntferntem?: boolean } = {}
	) {
		let entfernt: string | null = null;
		const v = await mitZugaengen(
			name,
			datum,
			'zu',
			mitEntferntem
				? async (s) => {
						// Im Entwurf anlegen und sogleich entfernen: Der Vorgang bleibt im
						// Verlauf an einer Kennung ohne Zeile stehen.
						const t = await erstelleTraktandum(handelnder(betreiber), {
							meetingId: s.versammlung,
							titel: 'Nicht behandeltes Geschäft',
							art: 'abstimmung',
							antragswortlaut: 'Wird nicht behandelt.',
							antragstellerart: 'bewirtschaftung'
						});
						await loescheTraktandum(handelnder(betreiber), s.versammlung, t.id);
						entfernt = t.id;
					}
				: undefined
		);

		const [partei] = await admin<{ id: string }[]>`
			SELECT id FROM snapshot_party WHERE meeting_id = ${v.versammlung} LIMIT 1
		`;
		const [traktandum] = await admin<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${v.versammlung} ORDER BY id LIMIT 1
		`;
		const [vollmacht] = await admin<{ id: string }[]>`
			INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_name)
			VALUES (${betreiber}, ${v.versammlung}, ${partei.id}, 'Prüfperson Dritt')
			RETURNING id
		`;
		await admin`
			INSERT INTO proxy_recommendation (operator_id, proxy_id, agenda_item_id, choice, wording)
			VALUES (${betreiber}, ${vollmacht.id}, ${traktandum.id}, 'ja', 'Zustimmen')
		`;
		// Eine echte Datei: Das Siegel packt den Anhang ins Paket und liest ihn
		// dafür aus der Ablage. Der Inhalt trägt den Namen, damit jede Versammlung
		// ihre eigene Prüfsumme hat.
		const datei = await legeInternAb(new TextEncoder().encode(`Vollmacht ${name}`));
		await admin`
			INSERT INTO attachment (operator_id, stweg_id, subject_type, subject_id, checksum,
			                        original_name, content_type, size_bytes)
			VALUES (${betreiber}, ${v.gemeinschaft}, 'proxy', ${vollmacht.id}, ${datei.pruefsumme},
			        'vollmacht.txt', 'text/plain', ${datei.groesse})
		`;
		await admin`
			INSERT INTO minutes (operator_id, meeting_id, body)
			VALUES (${betreiber}, ${v.versammlung}, 'Protokoll der Prüfung')
		`;

		await versiegle(handelnder(betreiber), v.versammlung, `${datum} 21:30:00`);
		/*
		 * **Nach dem Siegel, nicht davor** (Migration 138). Seit dem 03.10.2026
		 * weist der Auslöser auf `minutes_version` die Art «versandt» ab, solange
		 * die Versammlung nicht versiegelt ist. Seit Migration 161 verlangt ein
		 * zweiter nach dem Siegel ein Nachtragssiegel; diese Vorrichtung schreibt
		 * deshalb an der Kette vorbei (`anDerKetteVorbei`, Begründung dort).
		 */
		await anDerKetteVorbei((tx) => tx`
			INSERT INTO minutes_version (operator_id, meeting_id, number, body, kind)
			VALUES (${betreiber}, ${v.versammlung}, 1, 'Protokoll der Prüfung', 'versandt')
		`);
		// Geschlossen wird im Test «jetzt». Ohne Rückdatierung liesse sich keine
		// Zustellung angeben, deren Frist schon abgelaufen ist.
		await admin`UPDATE meeting SET closed_at = ${`${datum} 21:00:00+01`} WHERE id = ${v.versammlung}`;

		// Seit Migration 115 erst nach der Genehmigung durch die nächste Versammlung.
		if (genehmigt) {
			await folgeversammlung(v.gemeinschaft, '2025-12-01');
			await halteGenehmigtFest(v.versammlung);
		}
		return { ...v, anhang: datei.pruefsumme, entfernt };
	}

	/**
	 * Zeilen, deren Fremdschlüssel ins Leere zeigt, über die ganze Datenbank.
	 *
	 * Unter `session_replication_role = replica` prüft PostgreSQL keinen
	 * Fremdschlüssel. Was die Funktion in diesem Abschnitt vergisst, bliebe als
	 * Waise liegen, ohne dass irgendetwas scheitert. Nur so wird es sichtbar.
	 */
	async function waisen(): Promise<string[]> {
		const schluessel = await admin<
			{ kind: string; eltern: string; kspalten: string[]; espalten: string[] }[]
		>`
			SELECT c.conrelid::regclass::text AS kind, c.confrelid::regclass::text AS eltern,
			       array(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, i)
			               JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n
			              ORDER BY k.i) AS kspalten,
			       array(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, i)
			               JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n
			              ORDER BY k.i) AS espalten
			  FROM pg_constraint c
			  JOIN pg_namespace ns ON ns.oid = c.connamespace
			 WHERE c.contype = 'f' AND ns.nspname = 'public'
		`;
		const befund: string[] = [];
		for (const fk of schluessel) {
			const gleich = fk.kspalten.map((s, i) => `p."${fk.espalten[i]}" = c."${s}"`).join(' AND ');
			const gesetzt = fk.kspalten.map((s) => `c."${s}" IS NOT NULL`).join(' AND ');
			// Namen aus dem Katalog, nicht aus einer Eingabe.
			const [z] = await admin.unsafe<{ n: number }[]>(
				`SELECT count(*)::int AS n FROM ${fk.kind} c
				  WHERE ${gesetzt} AND NOT EXISTS (SELECT 1 FROM ${fk.eltern} p WHERE ${gleich})`
			);
			if (z.n > 0) befund.push(`${fk.kind} -> ${fk.eltern}: ${z.n}`);
		}
		return befund;
	}

	async function zaehle(tabelle: string, spalte: string, wert: string): Promise<number> {
		const [z] = await admin<{ n: number }[]>`
			SELECT count(*)::int AS n FROM ${admin(tabelle)} WHERE ${admin(spalte)} = ${wert}
		`;
		return z.n;
	}

	it('löscht die ganze Versammlung und hinterlässt an der Gemeinschaft einen Vermerk', async () => {
		const { gemeinschaft, versammlung, anhang } = await alteVersammlung('Fristende 1');
		expect(await zaehle('audit_entry', 'subject_id', versammlung)).toBeGreaterThan(0);

		const ergebnis = await loescheNachFrist(handelnder(betreiber), versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});
		expect(ergebnis.versammlungen).toBe(1);
		expect(ergebnis.zeilen).toBeGreaterThan(5);
		// Anhang und Paket gehen aus der Ablage, weil nichts mehr auf sie zeigt.
		expect(ergebnis.dateienEntfernt).toBeGreaterThanOrEqual(2);
		expect(ergebnis.dateienUebrig).toBe(0);
		await expect(lies(anhang)).rejects.toThrow(/ENOENT/);

		expect(await zaehle('meeting', 'id', versammlung)).toBe(0);
		expect(await zaehle('seal', 'meeting_id', versammlung)).toBe(0);
		expect(await zaehle('proxy', 'meeting_id', versammlung)).toBe(0);
		expect(await zaehle('minutes_version', 'meeting_id', versammlung)).toBe(0);
		expect(await waisen()).toEqual([]);
		expect(await zaehle('snapshot_party', 'meeting_id', versammlung)).toBe(0);
		expect(await zaehle('meeting_access', 'meeting_id', versammlung)).toBe(0);
		// Die eigenen Einträge gehen mit, die Gemeinschaft bleibt.
		expect(await zaehle('audit_entry', 'subject_id', versammlung)).toBe(0);
		expect(await zaehle('stweg', 'id', gemeinschaft)).toBe(1);

		const vermerke = await imKontext(
			betreiber,
			(tx) => tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${gemeinschaft}
				   AND event_type = 'meeting.purged'`
		);
		expect(vermerke).toHaveLength(1);
		expect(vermerke[0].detail.versammlungVom).toBe('2025-01-10');
		expect(vermerke[0].detail.zugestelltAm).toBe('2025-01-20');
		// Der Siegelwert überlebt die Löschung: Ohne ihn hätte das Prüfwerkzeug
		// später keinen Vergleichswert mehr (FR-54, Produktentscheid 17.09.2026).
		expect(vermerke[0].detail.siegel).toMatch(/^[0-9a-f]{64}$/);
		// Keine Namen von Eigentümern im Vermerk.
		expect(JSON.stringify(vermerke[0].detail)).not.toContain('Aebi');
	});

	/**
	 * **Der Verlauf eines entfernten Traktandums geht mit** (Auftrag F,
	 * Produktentscheid 01.10.2026: «Mitlöschen»).
	 *
	 * `versammlungen_endgueltig_loeschen` sammelt die Kennungen der **lebenden**
	 * Traktanden. Ein entferntes hat keine Zeile mehr; Anlegen und Entfernen
	 * bleiben als Einträge an einer Kennung ohne Zeile stehen, während die
	 * Versammlung fort ist. Vor dem Bau der Migration ist diese Probe rot.
	 */
	it('nimmt den Verlauf eines entfernten Traktandums mit', async () => {
		const { versammlung, entfernt } = await alteVersammlung(
			'Fristende entferntes Traktandum',
			'2025-01-13',
			{ mitEntferntem: true }
		);
		expect(entfernt).toBeTruthy();
		expect(await zaehle('audit_entry', 'subject_id', entfernt!)).toBeGreaterThan(0);

		await loescheNachFrist(handelnder(betreiber), versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});

		expect(await zaehle('meeting', 'id', versammlung)).toBe(0);
		expect(await zaehle('audit_entry', 'subject_id', entfernt!)).toBe(0);
	});

	it('lässt die Einträge eines entfernten Traktandums der Nachbarversammlung stehen', async () => {
		const erste = await alteVersammlung('Fristende Nachbar A', '2025-01-14', {
			mitEntferntem: true
		});
		const zweite = await alteVersammlung('Fristende Nachbar B', '2025-01-15', {
			mitEntferntem: true
		});
		expect(erste.entfernt).toBeTruthy();
		expect(zweite.entfernt).toBeTruthy();

		await loescheNachFrist(handelnder(betreiber), erste.versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});

		expect(await zaehle('audit_entry', 'subject_id', erste.entfernt!)).toBe(0);
		expect(await zaehle('audit_entry', 'subject_id', zweite.entfernt!)).toBeGreaterThan(0);
		expect(await zaehle('meeting', 'id', zweite.versammlung)).toBe(1);
	});

	it('greift nicht in die Einträge eines fremden Betreibers', async () => {
		// Der fremde Bestand trägt dieselbe Gestalt wie der eigene: anlegen und
		// entfernen über die Anwendungsfunktionen. Gelöscht wird nur die eigene
		// Versammlung; seine Einträge müssen stehen bleiben.
		//
		// Was diese Probe nicht misst: den Betreiberfilter in der neuen
		// Unterabfrage von Migration 137. Das fremde Entfernen-Ereignis nennt die
		// fremde Versammlung, nie die gelöschte; die Probe bliebe auch ohne den
		// Filter und ohne 137 grün. Der Filter ist Absicherung für ein Ereignis,
		// das die Anwendung nicht schreiben kann (Codeprüfung der Abnahme,
		// 03.10.2026).
		const fremd = await pruefbetreiber('Aufbewahrung fremd entfernt');
		const fremdBenutzer = await pruefbenutzer(fremd, 'fremd-aufbewahrung');
		const fremdHandelnder = { operatorId: fremd, userId: fremdBenutzer, label: 'Prüflauf' };

		const g = await erstelleGemeinschaft(fremdHandelnder, {
			name: 'Fremdweg entfernt',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const fv = await erstelleVersammlung(fremdHandelnder, {
			stwegId: g.id,
			datum: '2025-02-01',
			uhrzeit: '19:00',
			ort: 'Fremdsaal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		const ft = await erstelleTraktandum(fremdHandelnder, {
			meetingId: fv.id,
			titel: 'Fremdes entferntes Geschäft',
			art: 'abstimmung',
			antragswortlaut: 'Wird nicht behandelt.',
			antragstellerart: 'bewirtschaftung'
		});
		await loescheTraktandum(fremdHandelnder, fv.id, ft.id);

		const eigen = await alteVersammlung('Fristende eigener Betreiber', '2025-01-16', {
			mitEntferntem: true
		});
		await loescheNachFrist(handelnder(betreiber), eigen.versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});

		expect(await zaehle('audit_entry', 'subject_id', ft.id)).toBeGreaterThan(0);
		expect(await zaehle('meeting', 'id', fv.id)).toBe(1);
	});

	/**
	 * **Ein Widerspruch an der Universalversammlung hält das Löschen nicht auf**
	 * (Migration 129; Codeprüfung Block 4a, H-1). `versammlungen_endgueltig_loeschen`
	 * kennt `universal_objection` nicht; die Zeile geht über `ON DELETE CASCADE`
	 * mit Geschäft und Durchgang. Ohne die Kaskade bräche das DELETE am
	 * Geschäft ab. Von Hand gesetzt und unter `replica`, weil der gewöhnliche
	 * Weg eine laufende Versammlung verlangt und diese längst versiegelt ist.
	 */
	it('löscht auch eine Versammlung mit festgehaltenem Widerspruch', async () => {
		const { versammlung } = await alteVersammlung('Fristende Widerspruch');
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			await tx`
				INSERT INTO universal_objection
					(agenda_item_id, meeting_id, operator_id, snapshot_party_id, party_name, recorded_by)
				SELECT a.id, a.meeting_id, a.operator_id, p.id, p.display_name, 'Prüflauf'
				  FROM agenda_item a JOIN snapshot_party p ON p.meeting_id = a.meeting_id
				 WHERE a.meeting_id = ${versammlung}
				 ORDER BY a.id, p.id LIMIT 1
			`;
		});
		expect(await zaehle('universal_objection', 'meeting_id', versammlung)).toBe(1);

		await loescheNachFrist(handelnder(betreiber), versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});
		expect(await zaehle('meeting', 'id', versammlung)).toBe(0);
		expect(await zaehle('universal_objection', 'meeting_id', versammlung)).toBe(0);
		expect(await waisen()).toEqual([]);
	});

	/*
	 * **Die Paketdatei einer Ausleihe bleibt nicht liegen** (18.09.2026, aus der
	 * dritten Runde des Code-Reviews). `versammlungen_endgueltig_loeschen` stammt
	 * aus Migration 113 und kennt `meeting_handover` nicht; der Leihschein
	 * verschwindet über `ON DELETE CASCADE`, und ohne das Einsammeln in
	 * `loescheNachFrist` bliebe seine Datei für immer in der Ablage, weil sie
	 * danach niemand mehr findet.
	 *
	 * **Der Leihschein wird hier von Hand gesetzt und gleich zurückgenommen.**
	 * Abgegeben wird eine freigegebene Versammlung; diese hier ist längst
	 * versiegelt, der gewöhnliche Weg führt also nicht mehr dorthin. Gemessen
	 * werden soll ohnehin das Aufräumen und nicht die Abgabe. Zurückgenommen
	 * deshalb, weil ein offener Leihschein das Löschen selbst sperren würde
	 * (`VO117`) — und genau das ist im Betrieb richtig.
	 */
	it('räumt auch die Paketdatei einer früheren Ausleihe weg', async () => {
		const { versammlung } = await alteVersammlung('Fristende Ausleihe');
		const paket = await legeInternAb(new TextEncoder().encode('VOTUMG1 Wegwerfpaket'));

		const [geraet] = await admin<{ id: string }[]>`
			INSERT INTO handover_device (operator_id, name, enc_public_key, sig_public_key, fingerprint)
			VALUES (${betreiber}, 'Notebook Aufräumprobe', ${'A'.repeat(44)}, ${'B'.repeat(44)}, ${'e'.repeat(64)})
			RETURNING id
		`;
		await admin`
			INSERT INTO meeting_handover (
				operator_id, meeting_id, device_id, package_checksum, package_size,
				revoked_at, revoked_reason
			) VALUES (
				${betreiber}, ${versammlung}, ${geraet.id}, ${paket.pruefsumme}, ${paket.groesse},
				now(), 'Probe: der Abend wurde doch hier geführt'
			)
		`;

		// Vorher ist sie da, und sie gilt als verwendet.
		await expect(lies(paket.pruefsumme)).resolves.toBeDefined();
		const [vorher] = await imKontext(
			betreiber,
			(tx) => tx<{ v: boolean }[]>`SELECT pruefsumme_verwendet(${paket.pruefsumme}) AS v`
		);
		expect(vorher.v).toBe(true);

		const ergebnis = await loescheNachFrist(handelnder(betreiber), versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});

		expect(ergebnis.dateienUebrig).toBe(0);
		await expect(lies(paket.pruefsumme)).rejects.toThrow(/ENOENT/);
	});

	it('nennt der Löschseite, was verschwindet, und den Versandtag als Vorschlag', async () => {
		const { versammlung } = await alteVersammlung('Fristende Lage');
		const lage = await erhebeLoeschlage(betreiber, versammlung);

		expect(lage.versammlungen).toHaveLength(1);
		expect(lage.versammlungen[0].gemeinschaft).toBe('Fristende Lage');
		expect(lage.abend).toBeNull();
		expect(lage.zahlen.vollmachten).toBe(1);
		expect(lage.zahlen.dateien).toBe(1);
		// Die Vorrichtung hält die Fassung «versandt» heute fest.
		expect(lage.versandtAm).toBe(lage.heute);

		// Die Pakettabelle rechnet mit demselben Tag.
		const paket = (await erhebeLage(betreiber)).pakete.find((p) => p.versammlungId === versammlung);
		expect(paket?.versandtAm).toBe(lage.heute);
		expect(paket?.loeschbarAb).not.toBeNull();

		// Die Vorabprüfung sagt ab, bevor gefragt wird, und löscht nichts.
		await expect(
			pruefeLoeschungVorab(betreiber, versammlung, { zugestelltAm: lage.heute, ...alleBestaetigt })
		).rejects.toMatchObject({ kennung: 'loeschen_frist_laeuft' });
		const bericht = await pruefeLoeschungVorab(betreiber, versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});
		expect(bericht.zahlen.traktanden).toBeGreaterThan(0);
		expect(await zaehle('meeting', 'id', versammlung)).toBe(1);
	});

	it('weist ab, solange die Frist läuft, im Kern und in der Datenbank', async () => {
		const { versammlung } = await alteVersammlung('Fristende 2');
		const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

		await expect(
			loescheNachFrist(handelnder(betreiber), versammlung, { zugestelltAm: heute, ...alleBestaetigt })
		).rejects.toMatchObject({ kennung: 'loeschen_frist_laeuft' });

		// Wer am Kern vorbei direkt die Funktion ruft, läuft in dieselbe Schranke.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[versammlung]}::uuid[], ${heute}::date, true, true, true)`
			)
		).rejects.toThrow(/Anfechtungsfrist/);

		// Ohne Bestätigungen ebenso.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[versammlung]}::uuid[], '2025-01-20'::date, true, false, true)`
			)
		).rejects.toThrow(/Bestätigungen/);

		expect(await zaehle('meeting', 'id', versammlung)).toBe(1);
	});

	it('sperrt, solange eine Pendenz der Versammlung offen ist', async () => {
		const { versammlung } = await alteVersammlung('Fristende 3');
		const [t] = await admin<{ id: string }[]>`
			SELECT id FROM agenda_item WHERE meeting_id = ${versammlung} ORDER BY id LIMIT 1
		`;
		expect(t).toBeDefined();
		await erfassePendenz(handelnder(betreiber), versammlung, t.id, {
			text: 'Offerte für das Dach einholen',
			fristArt: 'keine'
		});

		await expect(
			loescheNachFrist(handelnder(betreiber), versammlung, { zugestelltAm: '2025-01-20', ...alleBestaetigt })
		).rejects.toMatchObject({ kennung: 'loeschen_offene_pendenzen' });
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			)
		).rejects.toThrow(/offene Pendenzen/);
	});

	it('wartet auf die Genehmigung durch eine spätere Versammlung, im Kern und in der Datenbank', async () => {
		// Rz. 136, 138 ad Art. 712n: Berichtigung bis zur Genehmigung durch die
		// nächste Versammlung, auch nach Ablauf der Anfechtungsfrist.
		const { gemeinschaft, versammlung } = await alteVersammlung('Genehmigung 1', '2025-01-10', {
			genehmigt: false
		});
		const direkt = () =>
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			);
		const ueberKern = () =>
			loescheNachFrist(handelnder(betreiber), versammlung, { zugestelltAm: '2025-01-20', ...alleBestaetigt });
		const paket = async () =>
			(await erhebeLage(betreiber)).pakete.find((p) => p.versammlungId === versammlung);

		// Keine Fassung «genehmigt».
		expect(await genehmigung(versammlung)).toBe('fehlt');
		expect((await erhebeLoeschlage(betreiber, versammlung)).versammlungen[0].genehmigung).toBe('fehlt');
		expect((await paket())?.genehmigung).toBe('fehlt');
		await expect(ueberKern()).rejects.toMatchObject({ kennung: 'loeschen_nicht_genehmigt' });
		await expect(direkt()).rejects.toThrow(/noch nicht genehmigt/);

		// Die Fassung ist da, aber noch keine spätere Versammlung.
		await halteGenehmigtFest(versammlung, '2025-05-01 12:00+02');
		expect(await genehmigung(versammlung)).toBe('ohne_folgeversammlung');
		await expect(ueberKern()).rejects.toMatchObject({ kennung: 'loeschen_genehmigung_ohne_versammlung' });
		await expect(direkt()).rejects.toThrow(/keine spätere geschlossene Versammlung/);

		// Eine spätere Versammlung, die erst nach dem Festhalten stattfand, zählt nicht,
		// und eine, die nicht geschlossen ist, auch dann nicht, wenn sie davor lag.
		await folgeversammlung(gemeinschaft, '2025-06-01');
		await folgeversammlung(gemeinschaft, '2025-04-01', false);
		expect(await genehmigung(versammlung)).toBe('ohne_folgeversammlung');
		await expect(direkt()).rejects.toThrow(/keine spätere geschlossene Versammlung/);

		// Wird die Fassung nach der Versammlung vom 1. Juni noch einmal festgehalten, trägt es.
		await halteGenehmigtFest(versammlung, '2025-06-02 12:00+02');
		expect(await genehmigung(versammlung)).toBe('genehmigt');
		expect((await paket())?.genehmigung).toBe('genehmigt');
		const ergebnis = await ueberKern();
		expect(ergebnis.versammlungen).toBe(1);
		expect(await zaehle('meeting', 'id', versammlung)).toBe(0);
		expect(await waisen()).toEqual([]);
	});

	it('verlangt das Siegel, im Kern und in der Datenbank', async () => {
		const v = await mitZugaengen('Ohne Siegel', '2025-01-10', 'zu');
		await admin`UPDATE meeting SET closed_at = '2025-01-10 21:00:00+01' WHERE id = ${v.versammlung}`;
		await admin`
			INSERT INTO minutes (operator_id, meeting_id, body)
			VALUES (${betreiber}, ${v.versammlung}, 'Protokoll der Prüfung')
		`;
		await folgeversammlung(v.gemeinschaft, '2025-12-01');
		await halteGenehmigtFest(v.versammlung);
		expect(await genehmigung(v.versammlung)).toBe('genehmigt');

		await expect(
			loescheNachFrist(handelnder(betreiber), v.versammlung, { zugestelltAm: '2025-01-20', ...alleBestaetigt })
		).rejects.toMatchObject({ kennung: 'loeschen_nicht_versiegelt' });
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[v.versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			)
		).rejects.toThrow(/nur eine versiegelte Versammlung/);
		expect(await zaehle('meeting', 'id', v.versammlung)).toBe(1);
	});

	it('greift nicht in fremde Betreiber', async () => {
		const { versammlung } = await alteVersammlung('Fristende 4');
		const fremd = await pruefbetreiber('Aufbewahrung fremd');

		// Die eigene Kennung im fremden Kontext …
		await expect(
			imKontext(
				fremd,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${fremd}, ${[versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			)
		).rejects.toThrow(/gibt es nicht/);

		// … und die fremde Kennung im eigenen Kontext.
		await expect(
			imKontext(
				fremd,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			)
		).rejects.toThrow(/gibt es nicht/);

		expect(await zaehle('meeting', 'id', versammlung)).toBe(1);
	});

	it('löscht einen gemeinsamen Abend nur als Ganzes', async () => {
		const a = await alteVersammlung('Abendhaus A', '2025-01-11');
		const b = await alteVersammlung('Abendhaus B', '2025-01-11', { genehmigt: false });
		const [tag] = await admin<{ id: string }[]>`
			INSERT INTO meeting_day (operator_id, label, day_date, start_time, location)
			VALUES (${betreiber}, 'Prüflauf Abend Frist', '2025-01-11', '19:00', 'Prüfsaal')
			RETURNING id
		`;
		await admin`UPDATE meeting SET meeting_day_id = ${tag.id}, day_position = 1 WHERE id = ${a.versammlung}`;
		await admin`UPDATE meeting SET meeting_day_id = ${tag.id}, day_position = 2 WHERE id = ${b.versammlung}`;

		// Verschiedene Versandtage: Die Pakettabelle muss für beide den späteren
		// nennen, wie die Löschseite (Code-Review 17.09.2026).
		await admin.begin(async (tx) => {
			await tx`SELECT set_config('session_replication_role', 'replica', true)`;
			await tx`UPDATE minutes_version SET frozen_at = '2025-01-25 12:00+01' WHERE meeting_id = ${a.versammlung} AND kind = 'versandt'`;
			await tx`UPDATE minutes_version SET frozen_at = '2025-02-15 12:00+01' WHERE meeting_id = ${b.versammlung} AND kind = 'versandt'`;
		});
		const tabelle = (await erhebeLage(betreiber)).pakete;
		for (const v of [a.versammlung, b.versammlung]) {
			expect(tabelle.find((p) => p.versammlungId === v)?.versandtAm).toBe('2025-02-15');
		}
		expect((await erhebeLoeschlage(betreiber, a.versammlung)).versandtAm).toBe('2025-02-15');

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`SELECT * FROM versammlungen_endgueltig_loeschen(
					${betreiber}, ${[a.versammlung]}::uuid[], '2025-01-20'::date, true, true, true)`
			)
		).rejects.toThrow(/ganzen Abend/);

		// Fehlt einer Versammlung die Genehmigung, bleibt der ganze Abend stehen,
		// und die Pakettabelle zeigt für beide den schwächsten Stand.
		for (const v of [a.versammlung, b.versammlung]) {
			expect(
				(await erhebeLage(betreiber)).pakete.find((p) => p.versammlungId === v)?.genehmigung
			).toBe('fehlt');
		}
		await expect(
			loescheNachFrist(handelnder(betreiber), a.versammlung, { zugestelltAm: '2025-01-20', ...alleBestaetigt })
		).rejects.toThrow(/Protokoll von Abendhaus B ist noch nicht genehmigt/);
		await folgeversammlung(b.gemeinschaft, '2025-12-01');
		await halteGenehmigtFest(b.versammlung);

		const ergebnis = await loescheNachFrist(handelnder(betreiber), a.versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});
		expect(ergebnis.versammlungen).toBe(2);
		expect(await zaehle('meeting', 'id', a.versammlung)).toBe(0);
		expect(await zaehle('meeting', 'id', b.versammlung)).toBe(0);
		expect(await zaehle('meeting_day', 'id', tag.id)).toBe(0);
	});

	it('lässt sich löschen, obwohl eine spätere, versiegelte Versammlung Traktanden daraus übernommen hat', async () => {
		// Der Normalfall bei jährlichen Versammlungen (Code-Review 17.09.2026).
		const alt = await alteVersammlung('Fristende Vorjahr', '2025-01-12');
		const spaeter = await mitZugaengen('Fristende Folgejahr', '2025-03-01', 'zu');
		const [uebernommen] = await admin<{ id: string }[]>`
			UPDATE agenda_item SET copied_from_meeting_id = ${alt.versammlung}
			 WHERE id = (SELECT id FROM agenda_item WHERE meeting_id = ${spaeter.versammlung} ORDER BY id LIMIT 1)
			RETURNING id
		`;
		await versiegle(handelnder(betreiber), spaeter.versammlung, '2025-03-01 21:30:00');

		const ergebnis = await loescheNachFrist(handelnder(betreiber), alt.versammlung, {
			zugestelltAm: '2025-01-20',
			...alleBestaetigt
		});
		expect(ergebnis.versammlungen).toBe(1);

		// Die spätere bleibt versiegelt und vollständig, nur der Herkunftsverweis ist leer.
		const [z] = await admin<{ herkunft: string | null }[]>`
			SELECT copied_from_meeting_id AS herkunft FROM agenda_item WHERE id = ${uebernommen.id}
		`;
		expect(z.herkunft).toBeNull();
		expect(await zaehle('seal', 'meeting_id', spaeter.versammlung)).toBe(1);
		expect(await waisen()).toEqual([]);
	});

	it('die Waisenprüfung selbst findet eine Waise', async () => {
		// Ohne diese Probe bewiese ein leeres `waisen()` nichts: Es wäre auch leer,
		// wenn die Abfrage nie eine Zeile träfe. Eine Mutation am Löschweg taugt
		// dafür nicht, weil die Kaskaden im geschützten Teil fast jede Lücke im
		// ungeschützten nachträglich schliessen (am 17.09.2026 ausprobiert).
		const [waise] = await admin.begin(async (tx) => {
			await tx`SELECT set_config('session_replication_role', 'replica', true)`;
			return tx<{ id: string }[]>`
				INSERT INTO proxy_recommendation (operator_id, proxy_id, agenda_item_id, choice, wording)
				VALUES (${betreiber}, gen_random_uuid(), gen_random_uuid(), 'ja', 'Waise')
				RETURNING id
			`;
		});
		try {
			expect((await waisen()).some((z) => z.startsWith('proxy_recommendation'))).toBe(true);
		} finally {
			await admin`DELETE FROM proxy_recommendation WHERE id = ${waise.id}`;
		}
		expect(await waisen()).toEqual([]);
	});

	it('bricht ab und löscht nichts, wenn eine Tabelle auf die Versammlung zeigt, die es nicht kennt', async () => {
		// Die Gegenprobe zum Versprechen im Kopf von Migration 113: Das letzte
		// DELETE läuft unter vollem Fremdschlüsselschutz. Eine künftige Tabelle,
		// die dort fehlt, soll das Löschen scheitern lassen, nicht verwaisen.
		const { versammlung } = await alteVersammlung('Fristende 5');
		await admin`CREATE TABLE pruef_fremder_verweis (meeting_id uuid REFERENCES meeting (id))`;
		try {
			await admin`INSERT INTO pruef_fremder_verweis VALUES (${versammlung})`;
			await expect(
				loescheNachFrist(handelnder(betreiber), versammlung, {
					zugestelltAm: '2025-01-20',
					...alleBestaetigt
				})
			).rejects.toMatchObject({ kennung: 'loeschen_verweis' });
			expect(await zaehle('meeting', 'id', versammlung)).toBe(1);
			expect(await zaehle('seal', 'meeting_id', versammlung)).toBe(1);
			expect(await zaehle('proxy', 'meeting_id', versammlung)).toBe(1);
		} finally {
			await admin`DROP TABLE pruef_fremder_verweis`;
		}
	});

	it('sieht beim Aufräumen der Dateien auch fremde Verweise', async () => {
		const fremd = await pruefbetreiber('Aufbewahrung Briefkopf');
		const summe = 'ab'.repeat(32);
		await admin`UPDATE operator SET letterhead_checksum = ${summe} WHERE id = ${fremd}`;

		// Unter dem Zeilenschutz sieht dieser Betreiber den fremden Briefkopf nicht …
		const [sichtbar] = await imKontext(
			betreiber,
			(tx) => tx`SELECT count(*)::int AS n FROM operator WHERE letterhead_checksum = ${summe}`
		);
		expect(sichtbar.n).toBe(0);
		// … die Funktion sieht ihn doch, und die Datei bleibt.
		const [v] = await imKontext(
			betreiber,
			(tx) => tx`SELECT pruefsumme_verwendet(${summe}) AS verwendet`
		);
		expect(v.verwendet).toBe(true);
	});
});
