/**
 * Abschlusspaket und Siegel in der Datenbank (FR-51 bis FR-55).
 *
 * Der Abschnitt, auf den es ankommt, ist **«Der Schreibschutz greift in der
 * Datenbank»**: FR-55 verlangt ihn ausdrücklich auf Ebene der Datenhaltung und
 * nicht bloss in der Oberfläche. Geprüft wird deshalb mit rohem SQL unter der
 * Anwendungsrolle — wer morgen einen neuen Weg zum Schreiben baut, kommt an
 * diesen Auslösern vorbei, ob er will oder nicht.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	holeVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	loescheTraktandum
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeErgebnisse,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { bestaetigeVollmacht, erfasseVollmacht, vermerkeVorlage } from '$lib/server/vollmacht';
import { setzeProtokollnotiz } from '$lib/server/protokoll';
import {
	erhebeSiegellage,
	hatVerlaufspdf,
	holePaket,
	holeSiegel,
	holeVerlaufspdf,
	versiegle
} from '$lib/server/siegel';
import { holeZeitstempel, holeZeitstempeldatei, findeUnterzeichner } from '$lib/server/zeitstempel';
import {
	entferneErsatzdienst,
	entferneZeitstempeldienst,
	setzeErsatzdienst,
	setzeZeitstempeldienst
} from '$lib/server/dienste';
import { leseAntwort } from '$lib/domain/rfc3161';
import { PaketFehler, pruefePaket } from '$lib/server/paketpruefung';
import { erzeugeVerlauf } from '$lib/server/pdf/verlauf';
import { join } from 'node:path';
import { rename } from 'node:fs/promises';
import { holeStimmnachweis } from '$lib/server/siegel';
import { env } from '$env/dynamic/private';
import { siegelangaben } from '../../src/routes/tage/[id=kennung]/siegel/siegelangaben';
import { manifestAlsJson, pruefe, type Manifest, type Manifesteintrag } from '$lib/domain/siegel';
import { normalisiereFingerabdruck } from '$lib/domain/dienste';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { KETTEN_ANTWORT, KETTEN_PRUEFSUMME } from './zeitstempel-kette.fixture';
import { createServer } from 'node:http';
import { holeBetriebszustand } from '$lib/server/betriebszustand';

/**
 * Der aufgezeichnete Zufallswert für die Ersatzproben (13.11.2026).
 *
 * Dieselbe Prüfstandsverkürzung wie in `zeitstempel.test.ts`: Eine
 * aufgezeichnete Antwort trägt den Zufallswert ihres Aufzeichnungstags. Nur
 * die Ersatzproben schalten sie ein, und nur für die 8-Byte-Nonce.
 */
const pruefZufall = vi.hoisted(() => ({ nonce: null as string | null }));

vi.mock('node:crypto', async (importOriginal) => {
	const echt = await importOriginal<typeof import('node:crypto')>();
	return {
		...echt,
		randomBytes: (n: number) =>
			n === 8 && pruefZufall.nonce !== null
				? Buffer.from(pruefZufall.nonce, 'hex')
				: echt.randomBytes(n)
	};
});

/**
 * Ein gestellter Befund von `bezeuge` für den **Versiegelungsweg**.
 *
 * **Warum gestellt.** Eine aufgezeichnete Antwort lautet auf ihre damalige
 * Prüfsumme; das Siegel einer neuen Versammlung ist eine andere. Ohne
 * Signaturschlüssel lässt sich kein passender Stempel erzeugen. Geprüft
 * werden hier deshalb nicht `bezeuge` (das tun `zeitstempel.test.ts`), sondern
 * die Weitergabe an Siegelzeile und Verlauf. Bleibt der Wert `null`, läuft
 * der echte Weg.
 */
const pruefBezeuge = vi.hoisted(() => ({
	ergebnis: null as null | {
		zustand: 'vorhanden';
		bemerkung: string;
		zeitpunkt: string;
		stelle: string;
		pruefsumme: string;
		ersatz: boolean;
	}
}));

vi.mock('$lib/server/zeitstempel', async (importOriginal) => {
	const echt = await importOriginal<typeof import('$lib/server/zeitstempel')>();
	return {
		...echt,
		bezeuge: async (operatorId: string, pruefsumme: string) =>
			pruefBezeuge.ergebnis ? { ...pruefBezeuge.ergebnis, roh: null } : echt.bezeuge(operatorId, pruefsumme)
	};
});

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

/** Eine vollständig durchgeführte und geschlossene Versammlung. */
async function abgeschlossen(
	name: string,
	datum: string,
	schliessen = true,
	/** Ein zweites Traktandum, über das von Hand gezählt wird. */
	mitHandzaehlung = false,
	/**
	 * Eine Vollmacht: B lässt sich vor dem Einlass von A vertreten. A erscheint
	 * danach selbst, und die Vollmacht endet — der Eintrag bleibt aber im
	 * Verlauf. Für die Paketprobe, die einen Gegenstand «Vollmacht» braucht.
	 */
	mitVollmacht = false,
	/**
	 * Ein Traktandum, das im Entwurf angelegt und wieder entfernt wird. Seine
	 * Zeile lebt nicht mehr; im Verlauf bleibt es über das Entfernen-Ereignis.
	 */
	mitEntferntem = false,
	/**
	 * Die erste Abstimmung ist geheim (Migration 141). Für die Paketprobe, die
	 * die getrennte Datei `daten/geheime-stimmen.json` nachweist.
	 */
	mitGeheim = false
) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 500 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}

	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);

	// Das zweite Traktandum muss vor der Freigabe stehen: Danach ist die
	// Traktandenliste zu (`nurImEntwurf`).
	const zweites = mitHandzaehlung
		? await erstelleTraktandum(handelnder(betreiber), {
				meetingId: v.id,
				titel: 'Dachrinne',
				art: 'abstimmung',
				antragswortlaut: 'Die Dachrinne wird ersetzt.',
				antragstellerart: 'bewirtschaftung'
			})
		: null;
	if (zweites) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, zweites.id, ERFORDERNIS);
	}

	/*
	 * Das entfernte Traktandum entsteht **vor** der Freigabe: Danach ist die
	 * Liste zu (`nurImEntwurf`), und `loescheTraktandum` ginge nicht mehr.
	 */
	let weg: { id: string } | null = null;
	if (mitEntferntem) {
		weg = await erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel: 'Der entfernte Punkt',
			art: 'abstimmung',
			antragswortlaut: 'Der Punkt wird wieder von der Liste genommen.',
			antragstellerart: 'bewirtschaftung'
		});
		await loescheTraktandum(handelnder(betreiber), v.id, weg.id);
	}

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (mitVollmacht) {
		/*
		 * Vor dem Einlass: Die Vollmacht entsteht, solange die Vertretene nicht
		 * da ist (`erfasseVollmacht` weist eine Vollmacht über eine Anwesende
		 * ab). B bleibt danach vertreten und wird von A mitgebracht
		 * (`zieheVertreteneNach`).
		 */
		const momentparteien = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM snapshot_party WHERE meeting_id = ${v.id} ORDER BY display_name
			`
		);
		const vollmacht = await erfasseVollmacht(handelnder(betreiber), v.id, {
			vertreteneId: momentparteien[1].id,
			bevollmaechtigtId: momentparteien[0].id
		});
		// Wirksam wird sie erst bestätigt (`leseWirksame` verlangt den Zustand
		// `bestaetigt`), und bestätigen lässt sie sich nur mit vermerktem
		// Nachweis — der Weg, den auch die Leitung geht.
		await vermerkeVorlage(handelnder(betreiber), v.id, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), v.id, vollmacht.id);
	}
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[0], 'von_hand');
	// Bei einer Vollmacht bleibt B vertreten und erscheint nicht selbst; A
	// bringt sie mit (`zieheVertreteneNach`), und erst das erzeugt den Eintrag
	// an der Momentaufnahme einer Partei.
	if (!mitVollmacht) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, parteien[1], 'von_hand');
	}
	await stelleAufTraktandum(handelnder(betreiber), v.id, t.id);
	await oeffneAbstimmung(handelnder(betreiber), v.id, t.id, {
		geheim: mitGeheim,
		geheimBeschlossen: mitGeheim
	});
	await gibStimmenAb(
		handelnder(betreiber),
		v.id,
		// Die vertretene Partei stimmt nicht selbst: Ihre Anwesenheit beruht auf
		// der Vollmacht, und `gibStimmenAb` liest den Anwesenheitsstand.
		(mitVollmacht ? parteien.slice(0, 1) : parteien).map((parteiId) => ({
			parteiId,
			wahl: 'yes' as const
		})),
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	await schliesseAbstimmung(handelnder(betreiber), v.id);

	if (zweites) {
		await stelleAufTraktandum(handelnder(betreiber), v.id, zweites.id);
		await oeffneAbstimmung(handelnder(betreiber), v.id, zweites.id);
		await erfasseSummen(handelnder(betreiber), v.id, { ja: 2, nein: 0, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(betreiber), v.id);
	}
	if (schliessen) await schliesseVersammlung(handelnder(betreiber), v.id);

	return {
		versammlung: v.id,
		traktandum: t.id,
		traktandumVonHand: zweites?.id ?? null,
		entferntesTraktandum: weg?.id ?? null,
		parteien
	};
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Siegel');
	benutzer = await pruefbenutzer(betreiber, 'siegelleitung');
});

afterAll(verbindungenSchliessen);

describe('Das Abschlusspaket', () => {
	it('entsteht mit Manifest, Prüfsummen und Siegel', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 1', '2026-12-01');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-01 21:30:00');

		expect(s.siegel).toMatch(/^[0-9a-f]{64}$/);
		expect(s.paketPruefsumme).toMatch(/^[0-9a-f]{64}$/);
		expect(s.paketGroesse).toBeGreaterThan(500);
		// Ohne hinterlegten Dienst steht der Zeitstempel aus — und das Siegel gilt
		// trotzdem. Genau das ist die Zusage für den Raum ohne Netz (AD-9).
		expect(s.zeitstempel).toBe(process.env.VERSAMMLUNG_ZEITSTEMPEL_URL ? 'vorhanden' : 'ausstehend');

		const manifest = JSON.parse(s.manifest) as Manifest;
		expect(manifest.fassung).toBe(1);
		expect(manifest.versammlung.datum).toBe('2026-12-01');
		// Die Prüfsumme über das Manifest **ist** das Siegel.
		expect(manifestAlsJson(manifest)).toBe(s.manifest);
	});

	it('führt alles, was den Beschluss trägt — und das Protokoll ausdrücklich nicht', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 2', '2026-12-02');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-02 21:30:00');
		const manifest = JSON.parse(s.manifest) as Manifest;
		const pfade = manifest.eintraege.map((e) => e.pfad).sort();

		expect(pfade).toContain('daten/stimmberechtigte.json');
		expect(pfade).toContain('daten/anwesenheit.json');
		expect(pfade).toContain('daten/vollmachten.json');
		expect(pfade).toContain('daten/abstimmungen.json');
		expect(pfade).toContain('daten/verlauf.json');
		expect(pfade).toContain('daten/stimmen.json');
		expect(pfade).toContain('Entscheidungsweg.txt');
		expect(pfade).toContain('Auswertung.pdf');
		expect(pfade).toContain('Verlauf.pdf');
		expect(pfade.some((p) => p.includes('protokoll'))).toBe(false);
		expect(manifest.nichtEnthalten.map((n) => n.was)).toContain('Das Protokoll');
	});

	it('legt je Traktandum mit Abstimmung ein eigenes Blatt bei (S-2)', async () => {
		/*
		 * **Je Traktandum eine eigene Datei, nicht ein Dokument mit vielen
		 * Seiten.** Das Manifest führt je Bestandteil eine eigene Prüfsumme; nur
		 * so lässt sich ein einzelnes Blatt prüfen, ohne dass die übrigen
		 * herausgehen. Genau das ist der Zweck (Vorgabe des Auftraggebers, 22.09.2026): Im
		 * Klagefall geht ein Blatt heraus, nicht die Versammlung.
		 */
		const { versammlung } = await abgeschlossen('Siegelweg Blatt', '2026-12-08', true, true);
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-08 21:30:00');
		const manifest = JSON.parse(s.manifest) as Manifest;
		const blaetter = manifest.eintraege.filter((e) => e.pfad.startsWith('stimmnachweis/'));

		expect(blaetter.length).toBe(2);
		// Jedes mit eigener Prüfsumme: Das ist die Eigenschaft, an der die
		// Einzelherausgabe hängt.
		expect(new Set(blaetter.map((e) => e.pruefsumme)).size).toBe(2);
		for (const e of blaetter) {
			expect(e.pruefsumme).toMatch(/^[0-9a-f]{64}$/);
			expect(e.groesse).toBeGreaterThan(0);
		}
	});

	/**
	 * **Der Widerspruch reist im Paket mit** (Migration 129; Codeprüfung Block
	 * 4a, M-b). Bis dahin stand er am Durchgang; seit er am Geschäft sitzt,
	 * steht er als eigene Liste in `daten/abstimmungen.json`. Von Hand gesetzt
	 * und unter `replica`, weil der gewöhnliche Weg eine laufende Versammlung
	 * verlangt.
	 */
	it('führt die Widersprüche gegen die Universalversammlung in den Abstimmungsdaten', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Widerspruch', '2026-12-10');
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
		await versiegle(handelnder(betreiber), versammlung, '2026-12-10 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);
		const daten = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/abstimmungen.json') as Uint8Array)
		) as { widersprueche: { name: string; durch: string; durchgangId: string | null }[] };
		expect(daten.widersprueche).toHaveLength(1);
		expect(daten.widersprueche[0]).toMatchObject({ durch: 'Prüflauf', durchgangId: null });
		expect(daten.widersprueche[0].name).toBeTruthy();
	});

	it('trägt auf dem Blatt die Namen, die die Auswertung nicht trägt (NFR-17)', async () => {
		/*
		 * Die beiden Dokumente unterscheiden sich genau hierin, und der
		 * Unterschied ist der Grund, aus dem es zwei sind. Ginge er verloren,
		 * stünden Namen in dem Blatt, das an alle Eigentümer geht.
		 */
		const { versammlung } = await abgeschlossen('Siegelweg Namen', '2026-12-09');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-09 21:30:00');
		const { entpacke } = await import('./zip');
		const { textVonSeite } = await import('./pdftext');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const blattPfad = [...dateien.keys()].find((k) => k.startsWith('stimmnachweis/'));
		expect(blattPfad).toBeDefined();

		const blatt = await textVonSeite(dateien.get(blattPfad as string) as Uint8Array);
		expect(blatt).toContain('Stimmpartei');
		expect(blatt).toContain('nicht zur Verteilung an die');
		expect(blatt).toContain(blattPfad as string);

		/*
		 * **Diese Probe bestand zuerst leer** (Code-Review 22.09.2026): Sie
		 * verneinte «Stimmpartei», und das Wort kommt in `auswertung.ts` in
		 * keinem Fall vor. Sie konnte also nie fehlschlagen und belegte genau
		 * das nicht, was ihr Name behauptet. Geprüft wird jetzt ein **Name**,
		 * und zwar über alle Seiten: `Auswertung.pdf` wird bei mehreren
		 * Traktanden mehrseitig, und `textVonSeite` liest voreingestellt nur
		 * die erste.
		 */
		const { PDFDocument } = await import('pdf-lib');
		const auswertungBytes = dateien.get('Auswertung.pdf') as Uint8Array;
		const seitenzahl = (await PDFDocument.load(auswertungBytes)).getPageCount();
		const auswertung = (
			await Promise.all(
				Array.from({ length: seitenzahl }, (_, i) => textVonSeite(auswertungBytes, i))
			)
		).join('\n');

		const einName = (blatt.match(/Aebi|Bucher/) ?? [])[0];
		expect(einName, 'die Vorgabe legt keine erkennbaren Namen an').toBeDefined();
		expect(auswertung).not.toContain(einName as string);
		expect(auswertung).not.toContain('Stimmpartei');
	});

	it('gibt einer Handzählung kein Blatt mit leerer Tabelle', async () => {
		/*
		 * Von Hand gezählt heisst: keine Einzelstimmen, nur Summen. Eine leere
		 * Tabelle ohne diesen Vermerk läse sich wie «niemand hat gestimmt».
		 */
		const { versammlung } = await abgeschlossen('Siegelweg Hand', '2026-12-10', true, true);
		await versiegle(handelnder(betreiber), versammlung, '2026-12-10 21:30:00');
		const { entpacke } = await import('./zip');
		const { textVonSeite } = await import('./pdftext');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const texte = await Promise.all(
			[...dateien.entries()]
				.filter(([k]) => k.startsWith('stimmnachweis/'))
				.map(async ([k, v]) => [k, await textVonSeite(v)] as const)
		);
		const vonHand = texte.find(([, text]) => text.includes('Von Hand gezählt'));
		expect(vonHand, 'kein Blatt trägt den Vermerk der Handzählung').toBeDefined();
		expect(vonHand?.[1]).not.toContain('Stimmpartei');
	});

	it('legt die einzelnen Stimmen und den Entscheidungsweg bei (Ä-39, Ä-40)', async () => {
		/*
		 * Produktentscheid 17.09.2026: Mit Zahlen allein lässt sich eine bestrittene
		 * Auszählung nicht nachrechnen, und in fünf Jahren erklärt kein JSON, warum
		 * für dieses Geschäft Einstimmigkeit galt.
		 */
		const { versammlung } = await abgeschlossen('Siegelweg Belege', '2026-12-06');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-06 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const stimmen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)
		) as { durchgangId: string; stimmen: { name: string | null; choice: string }[] }[];
		expect(stimmen.length).toBeGreaterThan(0);
		const alle = stimmen.flatMap((d) => d.stimmen);
		expect(alle.length).toBeGreaterThan(0);
		// Der Name steht dabei: Nach dem Löschen der Versammlung gibt es die
		// Stimmpartei nicht mehr, und eine Kennung allein belegt nichts.
		expect(alle.every((v) => typeof v.name === 'string' && v.name.length > 0)).toBe(true);

		// Jede Stimme sagt, ob sie gezählt hat: Eine Berichtigung lässt die frühere
		// Zeile stehen (AD-5), und wer nur summiert, zählte die Einheit doppelt.
		expect(alle.every((v) => typeof (v as { gezaehlt?: boolean }).gezaehlt === 'boolean')).toBe(true);
		// Von Hand gezählte Durchgänge tragen keine Einzelstimmen — das steht dabei.
		expect(stimmen.every((d) => (d as { erfassung?: string }).erfassung !== undefined)).toBe(true);

		const weg = new TextDecoder().decode(dateien.get('Entscheidungsweg.txt') as Uint8Array);
		expect(weg).toMatch(/Entscheidungsweg je Traktandum/);
		expect(weg).toMatch(/Regelwerksfassung: /);
		expect(weg).toMatch(/Rechtsgrundlage: /);
		// Was beim Eröffnen galt, steht je Durchgang dabei (AD-4).
		expect(weg).toMatch(/1\. Durchgang: gezählt nach /);
	});

	it('sagt beim von Hand gezählten Durchgang, dass es keine Einzelstimmen gibt', async () => {
		// Sonst läse sich die leere Liste wie «niemand hat gestimmt» (Code-Review
		// 17.09.2026). Beides zugleich gibt es nicht, `erfasseSummen` weist es ab.
		const a = await abgeschlossen('Siegelweg Handzählung', '2026-12-07', true, true);
		await versiegle(handelnder(betreiber), a.versammlung, '2026-12-07 21:30:00');

		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, a.versammlung)) as Uint8Array);
		const stimmen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)
		) as {
			traktandumId: string;
			erfassung: string;
			handzaehlung: { ja: number } | null;
			stimmen: unknown[];
		}[];

		const vonHand = stimmen.find((d) => d.traktandumId === a.traktandumVonHand);
		expect(vonHand?.erfassung).toBe('handzaehlung');
		expect(vonHand?.handzaehlung?.ja).toBe(2);
		expect(vonHand?.stimmen).toEqual([]);
		const einzeln = stimmen.find((d) => d.traktandumId === a.traktandum);
		expect(einzeln?.erfassung).toBe('einzelstimmen');
		expect(einzeln?.stimmen.length).toBeGreaterThan(0);
	});

	it('packt den Verlauf DIESER Versammlung ein: Traktandum, Durchgang, Vollmacht und Partei (FR-56)', async () => {
		/*
		 * FR-56 verlangt den Verlauf der Versammlung. Das Paket entsteht über
		 * dieselbe Abfrage wie die Anzeige, aber über die **Zugehörigkeit**
		 * (`versammlung`), nicht über den Gegenstand: Mit `gegenstand: meetingId`
		 * trüge es nur, was an der Versammlung selbst hängt (Freigabe, Eröffnung,
		 * Schluss), und liesse alles aus, was an Traktandum, Durchgang, Vollmacht
		 * und Momentaufnahme einer Partei hängt. Das Paket wäre kleiner, das
		 * Siegel hielte, die Prüfung meldete nichts — genau die stille Lücke.
		 *
		 * Der Test verlangt deshalb jede dieser vier Arten im Paket und stellt
		 * zwei Versammlungen nebeneinander, damit auch nichts von der anderen
		 * hineinwandert.
		 */
		const eine = await abgeschlossen('Siegelweg 3a', '2026-12-04', true, true, true);
		const andere = await abgeschlossen('Siegelweg 3b', '2026-12-05');
		await versiegle(handelnder(betreiber), eine.versammlung, '2026-12-04 21:30:00');

		const paket = await holePaket(betreiber, eine.versammlung);
		const { entpacke } = await import('./zip');
		const dateien = entpacke(paket as Uint8Array);
		const verlauf = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/verlauf.json') as Uint8Array)
		) as {
			art: string;
			gegenstandArt: string | null;
			gegenstandId: string | null;
			angaben: Record<string, unknown>;
		}[];

		expect(verlauf.length).toBeGreaterThan(0);
		// Der Eintrag an der Versammlung selbst …
		expect(
			verlauf.some((z) => z.gegenstandArt === 'meeting' && z.gegenstandId === eine.versammlung)
		).toBe(true);
		/*
		 * **Die Rohangaben bleiben roh** (B2, 03.10.2026). `verlauf.json` ist die
		 * Datenfassung des Pakets und wird nicht umgeschrieben; lesbar wird nur,
		 * was ein Mensch liest (`Verlauf.pdf`). Stünde hier die aufgelöste
		 * Fassung, wäre die Datei keine Auskunft mehr über das, was geschrieben
		 * wurde.
		 */
		const angelegt = verlauf.find((z) => z.art === 'meeting.created');
		expect(angelegt, 'kein «Versammlung angelegt» im Rohverlauf').toBeDefined();
		expect(typeof angelegt?.angaben.gemeinschaft).toBe('string');
		expect(String(angelegt?.angaben.gemeinschaft)).toMatch(/^[0-9a-f-]{36}$/);
		expect(angelegt?.angaben.fristvermerk).toBeNull();
		// … und die vier Arten, die erst über die Zugehörigkeit hereinkommen.
		for (const art of ['agenda_item', 'voting_round', 'proxy', 'snapshot_party']) {
			expect(verlauf.some((z) => z.gegenstandArt === art), `kein Eintrag an ${art}`).toBe(true);
		}

		// Nichts aus der anderen Versammlung, an keinem ihrer Gegenstände.
		const fremd = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT ${andere.versammlung}::text AS id
				UNION SELECT id::text FROM agenda_item WHERE meeting_id = ${andere.versammlung}
				UNION SELECT id::text FROM voting_round WHERE meeting_id = ${andere.versammlung}
				UNION SELECT id::text FROM proxy WHERE meeting_id = ${andere.versammlung}
				UNION SELECT id::text FROM snapshot_party WHERE meeting_id = ${andere.versammlung}
			`
		);
		const fremdeIds = new Set(fremd.map((z) => z.id));
		expect(verlauf.some((z) => z.gegenstandId !== null && fremdeIds.has(z.gegenstandId))).toBe(false);
	});

	it('legt den Verlauf als lesbares PDF bei: aufgelöste Gegenstände, in der Reihenfolge des Ablaufs', async () => {
		/*
		 * **Der Verlauf als Gerichtsfassung** (Plan Beschluss von Hand, Block 3).
		 * Das JSON daneben trägt ihn vollständig, aber niemand liest eine
		 * Kennungssuppe. Geprüft wird deshalb am Text: die Auflösung
		 * («Traktandum 1 ‹Fassadensanierung›», «Vollmacht: …», «Stimmberechtigung
		 * von …») und die Richtung (der Abend läuft vorwärts, nicht wie die
		 * Bildschirmanzeige rückwärts).
		 */
		// Mit dem von Hand gezählten zweiten Traktandum: Erst dort hängt ein
		// Eintrag am Durchgang selbst, und ohne ihn bliebe dessen Auflösung im
		// Blatt unbeobachtet.
		const { versammlung } = await abgeschlossen('Siegelweg Verlauf', '2026-12-19', true, true, true);
		await versiegle(handelnder(betreiber), versammlung, '2026-12-19 21:30:00');
		const { entpacke } = await import('./zip');
		const { PDFDocument } = await import('pdf-lib');
		const { textVonSeite } = await import('./pdftext');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const bytes = dateien.get('Verlauf.pdf') as Uint8Array;
		expect(bytes, 'kein Verlauf.pdf im Paket').toBeDefined();
		const seitenzahl = (await PDFDocument.load(bytes)).getPageCount();
		const text = (
			await Promise.all(Array.from({ length: seitenzahl }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');

		expect(text).toContain('Verlauf');
		expect(text).toContain('in der Reihenfolge des Ablaufs');
		// Die Gegenstände sind aufgelöst, nicht roh: Eine Kennung wie
		// «agenda_item 3f2a1b9c» halfe niemandem, der das Blatt liest.
		expect(text).toMatch(/Traktandum \d+ «Fassadensanierung»/);
		expect(text).toContain('Person: Prüflauf');
		expect(text).toContain('Vollmacht: Aebi für Bucher');
		// Eine Benennung des Gegenstands, keine Feststellung über die Person
		// (Laienprüfung 01.10.2026, B-6).
		expect(text).toContain('Stimmberechtigung von Bucher');
		expect(text).toContain('Gegenstand: Die Versammlung');
		expect(text).toMatch(/Gegenstand: Durchgang \d+ zu Traktandum \d+ «/);
		/*
		 * **Die Angaben sind lesbar** (B2, 03.10.2026). Vorher stand im Blatt
		 * «gemeinschaft: 01a0f6c1-…, fristvermerk: null»: eine Kennung statt des
		 * Namens und ein leeres Feld als Wort. Jetzt trägt die Zeile die
		 * Bezeichnung aus der Wörterliste, den aufgelösten Namen, und leere
		 * Werte fallen weg.
		 */
		expect(text).toContain('Gemeinschaft: Siegelweg Verlauf');
		expect(text).toContain('Datum: 2026-12-19');
		expect(text).not.toContain(': null');
		expect(text).not.toContain('fristvermerk: null');
		expect(text).not.toMatch(/Gemeinschaft: [0-9a-f]{8}-/);
		/*
		 * **Kein Scheitern, wo niemand gesucht hat** (Codeprüfung Lauf B,
		 * 03.10.2026). Die erste Fassung schrieb für jede Kennung, die der
		 * Auflöser nicht kannte, «liess sich nicht zuordnen», auch für die eigene
		 * Versammlung. In diesem Bestand ist alles auffindbar.
		 */
		expect(text).toContain('Versammlung: diese Versammlung');
		expect(text).not.toContain('liess sich nicht zuordnen');
		/*
		 * **Die Einleitung erklärt die zwei Begriffe des Blatts** (Block 5,
		 * B-2 und B-6). «Beschluss von Hand festgehalten» heisst in der ganzen
		 * Anwendung so; ohne den Satz liest es sich wie «per Handmehr
		 * abgestimmt». Und der Fuss nennt das Manifest «Inhaltsverzeichnis»
		 * (B-5).
		 */
		expect(text).toContain('Ein Eintrag «Beschluss von Hand festgehalten» heisst');
		expect(text).toContain('Ein Durchgang ist eine Abstimmung zu einem Traktandum');
		expect(text).toContain('Inhaltsverzeichnis (manifest.json)');
		expect(text).toContain('das Siegel ist die Prüfsumme über dieses Inhaltsverzeichnis');

		// Vorwärts: Die Anlage steht vor dem Schluss.
		const angelegt = text.indexOf('Versammlung angelegt');
		const geschlossen = text.indexOf('Versammlung geschlossen');
		expect(angelegt, 'kein «Versammlung angelegt» im Text').toBeGreaterThanOrEqual(0);
		expect(geschlossen, 'kein «Versammlung geschlossen» im Text').toBeGreaterThan(angelegt);

		// Herausgegeben wird genau der versiegelte Stand, mit Prüfsumme.
		const blatt = await holeVerlaufspdf(betreiber, versammlung);
		expect(blatt).not.toBeNull();
		const { createHash } = await import('node:crypto');
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(blatt?.pruefsumme);
		expect(await hatVerlaufspdf(betreiber, versammlung)).toBe(true);

		// Gegenprobe: Vor dem Versiegeln gibt es keine Herausgabe.
		const offen = await abgeschlossen('Siegelweg Verlauf offen', '2026-12-20');
		expect(await holeVerlaufspdf(betreiber, offen.versammlung)).toBeNull();
		expect(await hatVerlaufspdf(betreiber, offen.versammlung)).toBe(false);
	});

	/*
	 * **Die Werte in Worten** (Block mit Laienprüfung, 08.10.2026). Bis dahin
	 * zeigte nur die Verlaufsseite die Codewörter in Worten, das Blatt nicht.
	 * Die Probe trägt einen Eintrag aus Gruppe b (ASCII/Englisch) ein und
	 * verlangt das Wort auf dem Blatt, nicht das Codewort.
	 */
	it('zeigt ein Codewort aus Gruppe b auf dem Verlaufsblatt in Worten', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Wörter', '2026-12-18');

		/*
		 * Ein `meeting.day.bypassed` entsteht sonst nur am gemeinsamen Abend, den
		 * dieser Prüflauf nicht aufbaut; deshalb hier als Verlaufseintrag der
		 * Versammlung gesetzt. `aktion: aufrufen` ist ein Codewort der Gruppe b,
		 * das Wort dazu «Traktandum aufrufen».
		 */
		const h = handelnder(betreiber);
		await imKontext(betreiber, (tx) => tx`
			INSERT INTO audit_entry
				(operator_id, actor_user_id, actor_label, event_type, subject_type, subject_id, detail, clock_source)
			VALUES (${h.operatorId}, ${h.userId}, ${h.label}, 'meeting.day.bypassed', 'meeting',
			        ${versammlung}, ${tx.json({ aktion: 'aufrufen' } as never)}, 'system')
		`);

		await versiegle(handelnder(betreiber), versammlung, '2026-12-18 21:30:00');
		const { entpacke } = await import('./zip');
		const { PDFDocument } = await import('pdf-lib');
		const { textVonSeite } = await import('./pdftext');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const bytes = dateien.get('Verlauf.pdf') as Uint8Array;
		const seitenzahl = (await PDFDocument.load(bytes)).getPageCount();
		const text = (
			await Promise.all(Array.from({ length: seitenzahl }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');

		expect(text).toContain('Aktion: Traktandum aufrufen');
		expect(text).not.toContain('Aktion: aufrufen');
	});

	/*
	 * **Ein Eintrag, der höher ist als eine Seite** (Nachzug Block 2c; «Offen
	 * aus Block 3», Punkt 7). Hier stand ein Umbruch **vor** dem Eintrag; war
	 * der Eintrag selbst höher als das Blatt, lief er unten aus dem Blatt
	 * heraus. Gemessen wird an den **Positionen** der gezeichneten Zeilen
	 * (`platzierungenVonSeite`), nicht am Text: Ein Textleser findet auch, was
	 * unterhalb der Seite steht, und wäre gegen genau diesen Fehler blind.
	 */
	it('bricht einen Eintrag, der höher ist als eine Seite, auf die nächste Seite um', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg langer Eintrag', '2026-12-31');
		const v = await holeVersammlung(betreiber, versammlung);

		const bytes = await erzeugeVerlauf({
			gemeinschaftName: 'Lange Angaben',
			versammlung: v!,
			zeilen: [
				{
					zeitpunkt: '2026-12-31T19:00:00.000Z',
					zeitquelle: 'system',
					eintrag: 'Beschluss von Hand festgehalten',
					gegenstand: 'Traktandum 1 «Fassadensanierung»',
					person: 'Prüflauf',
					/*
					 * **Deutlich mehr als eine Seite.** Im Plan standen «rund
					 * 4 500 Zeichen»; gemessen am 03.10.2026 füllen 5 250 Zeichen
					 * in diesem Satzspiegel noch knapp eine Seite (rund 60 Zeilen
					 * passen zwischen Kopf und Fuss). Für die Probe braucht es
					 * einen Eintrag, der die Seite sicher übersteigt.
					 */
					angaben: `${'Ein sehr langer Wert '.repeat(600)}ENDE-DER-ANGABEN`
				}
			],
			pfadImPaket: 'Verlauf.pdf',
			erzeugtAm: '2026-12-31 21:30'
		});

		const { PDFDocument } = await import('pdf-lib');
		const { platzierungenVonSeite } = await import('./pdftext');
		const seiten = (await PDFDocument.load(bytes)).getPageCount();
		expect(seiten, 'Der Eintrag füllt mehr als eine Seite').toBeGreaterThan(1);

		/*
		 * Die Untergrenze ist der Satzspiegel, nicht der Blattrand: Unter
		 * `rand + mm(14)` (rund 96 pt) steht nur die Fusszeile «Seite N von M»
		 * (bei rund 45 pt). Eine Grenze bei 20 pt bliebe grün, wenn der Text in
		 * die Fusszone liefe.
		 */
		let endeGefunden = false;
		for (let i = 0; i < seiten; i++) {
			for (const p of await platzierungenVonSeite(bytes, i)) {
				if (/^Seite \d+ von \d+/.test(p.text)) continue;
				expect(
					p.y,
					`Zeile in der Fusszone auf Seite ${i + 1}: ${p.text.slice(0, 40)}`
				).toBeGreaterThan(85);
				if (p.text.includes('ENDE-DER-ANGABEN')) endeGefunden = true;
			}
		}
		expect(endeGefunden, 'Das Ende der Angaben steht auf keiner Seite').toBe(true);
	});

	/*
	 * **Ein Eintrag, der auf eine Seite passt, bleibt beisammen** (Abnahme des
	 * Nachzugs, 03.10.2026). Der erste Umbau für überlange Einträge prüfte nur
	 * noch den Kopf; Angaben und Uhrwarnung flossen bei jedem Eintrag über die
	 * Seitengrenze, und eine Folgeseite begann mitten in einem Eintrag, einmal
	 * mit der Uhrwarnung allein, getrennt von der Zeit, der sie gilt. Gemessen
	 * an der ersten Zeile unter dem Seitenkopf jeder Folgeseite: Sie muss die
	 * Zeitzeile eines Eintrags sein.
	 */
	it('beginnt jede Folgeseite mit einem Eintrag, nicht mitten in einem', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Einträge beisammen', '2026-12-30');
		const v = await holeVersammlung(betreiber, versammlung);

		const bytes = await erzeugeVerlauf({
			gemeinschaftName: 'Beisammen',
			versammlung: v!,
			zeilen: Array.from({ length: 30 }, (_, i) => ({
				zeitpunkt: '2026-12-30T19:00:00.000Z',
				// Nicht die Systemuhr: Dann trägt jeder Eintrag die Uhrwarnung.
				zeitquelle: 'handeingabe',
				eintrag: `Eintrag ${i}`,
				gegenstand: 'Traktandum 1 «Fassadensanierung»',
				person: 'Prüflauf',
				// Unterschiedlich lang, damit Seitenwechsel in Einträge fallen.
				angaben: 'Wert '.repeat(60 + (i % 5) * 40)
			})),
			pfadImPaket: 'Verlauf.pdf',
			erzeugtAm: '2026-12-30 21:30'
		});

		const { PDFDocument } = await import('pdf-lib');
		const { platzierungenVonSeite } = await import('./pdftext');
		const seiten = (await PDFDocument.load(bytes)).getPageCount();
		expect(seiten, 'Die Probe braucht Seitenwechsel').toBeGreaterThan(2);
		for (let i = 1; i < seiten; i++) {
			const zeilen = (await platzierungenVonSeite(bytes, i)).sort((a, b) => b.y - a.y);
			// Die oberste Zeile ist der Seitenkopf, die zweite der erste Inhalt:
			// die Zeitzeile eines Eintrags oder der Fuss des Blatts.
			expect(
				zeilen[1]?.text,
				`Seite ${i + 1} beginnt mitten in einem Eintrag`
			).toMatch(/^(\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2} · Eintrag \d+|Erzeugt am )/);
		}
	});

	/*
	 * **Ein fehlendes Paket ist kein «gibt es nicht»** (Nachzug Block 2c;
	 * «Offen aus Block 3», Punkt 6). Fällt die Paketdatei aus der Ablage, ist
	 * das Manifest trotzdem da und führt den Verlauf. Bis dahin stieg ein roher
	 * ENOENT auf, ohne Versammlung und Bestandteil; jetzt ein `PaketFehler`,
	 * dessen Satz im Serverlog sagt, was fehlt.
	 */
	it('nennt eine fehlende Paketdatei einen Schaden am Paket, nicht «gibt es nicht»', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Paket fehlt', '2026-01-02');
		const siegel = await versiegle(handelnder(betreiber), versammlung, '2026-01-02 21:30:00');

		const wurzel = process.env.VERSAMMLUNG_DATEIEN ?? './daten/dateien';
		const datei = join(
			wurzel,
			siegel.paketPruefsumme.slice(0, 2),
			siegel.paketPruefsumme.slice(2, 4),
			siegel.paketPruefsumme
		);
		const versteckt = `${datei}.weg`;
		await rename(datei, versteckt);
		try {
			const verlauf = await holeVerlaufspdf(betreiber, versammlung).then(
				() => null,
				(fehler: unknown) => fehler
			);
			expect(verlauf).toBeInstanceOf(PaketFehler);

			// Und der Stimmnachweis läuft durch dieselbe Prüfung.
			const manifest = JSON.parse(siegel.manifest) as Manifest;
			const blatt = manifest.eintraege.find((e) => e.pfad.startsWith('stimmnachweis/'));
			expect(blatt, 'kein Stimmnachweis im Paket').toBeDefined();
			await expect(
				holeStimmnachweis(
					betreiber,
					versammlung,
					(blatt as Manifesteintrag).pfad.replace('stimmnachweis/', '')
				)
			).rejects.toBeInstanceOf(PaketFehler);

			/*
			 * **B4c** (03.10.2026): Der Download des ganzen Pakets las dieselbe
			 * Datei und warf weiter einen rohen ENOENT. Jetzt dieselbe
			 * Übersetzung wie oben, über eine gemeinsame Hilfsfunktion.
			 */
			const paket = await holePaket(betreiber, versammlung).then(
				() => null,
				(fehler: unknown) => fehler
			);
			expect(paket).toBeInstanceOf(PaketFehler);
			expect(String(paket)).toMatch(/lässt sich nicht herunterladen/);
		} finally {
			await rename(versteckt, datei);
		}
	});

	/*
	 * **Ein unlesbarer Durchgang wird nicht still zu etwas anderem** (Nachzug
	 * Block 2c; «Offen aus Block 3», Punkt 8). `holeErgebnisse` schluckt einen
	 * Durchgang, der sich nicht auswerten lässt; `stimmen.json` fiel dann auf
	 * «einzelstimmen» zurück und behauptete eine Erfassungsart, die zum
	 * Durchgang nicht gehört. Beim Versiegeln wird daraus eine Absage.
	 */
	it('versiegelt nicht, wenn die Festschreibung eines Durchgangs unlesbar ist', async () => {
		const a = await abgeschlossen('Siegelweg Festschreibung', '2026-01-03');
		/*
		 * Der Trigger aus Migration 123 sperrt Änderungen an `result_json`;
		 * deshalb für diese eine Zeile in einer Transaktion mit abgeschalteten
		 * Auslösern — dasselbe Verfahren wie in `festschreibung.test.ts`.
		 */
		await admin.begin(async (tx) => {
			await tx`SET LOCAL session_replication_role = replica`;
			const [d] = await tx<{ id: string }[]>`
				SELECT id FROM voting_round WHERE meeting_id = ${a.versammlung}
			`;
			await tx`UPDATE voting_round
			            SET result_json = ${tx.json({ format: 2, auszaehlung: { anders: true } } as never)}
			          WHERE id = ${d.id}`;
		});

		await expect(
			versiegle(handelnder(betreiber), a.versammlung, '2026-01-03 21:30:00')
		).rejects.toThrow(/Format|Festschreibung/);
		// Und es entsteht kein Siegel, das einen unvollständigen Bestand deckt.
		expect(await holeSiegel(betreiber, a.versammlung)).toBeNull();

		/*
		 * **B4b und B4d** (03.10.2026): Die Siegelseite nennt das Hindernis,
		 * statt den Knopf anzubieten, der in diese Absage führt, und beide
		 * Sätze nennen Durchgang und Traktandum, nicht nur das Format.
		 */
		const lage = await erhebeSiegellage(betreiber, a.versammlung);
		expect(lage.moeglich, 'Die Lage bietet das Versiegeln trotz unlesbarer Festschreibung an').toBe(
			false
		);
		const hindernis = lage.hindernisse.join(' ');
		expect(hindernis).toMatch(/Durchgang 1 zu Traktandum \d+ «Fassadensanierung»/);
		expect(hindernis).toMatch(/Format/);
		const absage = await versiegle(handelnder(betreiber), a.versammlung, '2026-01-03 21:30:00').then(
			() => null,
			(fehler: unknown) => fehler
		);
		expect(String(absage)).toMatch(/Durchgang 1 zu Traktandum \d+ «Fassadensanierung»/);
	});

	/*
	 * **B4a** (03.10.2026): `holeErgebnisse` schluckt einen Durchgang, dessen
	 * Auswertung wirft, mit Absicht — ohne Logzeile hatte der Betrieb nichts in
	 * der Hand. Gemessen mit einer Durchgangskennung, die zu keiner Zeile
	 * gehört: `ergebnisIn` wirft dort «Durchgang nicht gefunden.», genau der
	 * Weg durch den `catch`.
	 */
	it('protokolliert einen Durchgang, dessen Auswertung wirft, mit Versammlung und Fehler', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Logzeile', '2026-01-04');
		const erfunden = '01a0f6c1-9999-4999-8999-999999999999';
		const logeintraege: string[] = [];
		const spion = vi.spyOn(console, 'error').mockImplementation((...teile: unknown[]) => {
			logeintraege.push(teile.map((t) => String(t)).join(' '));
		});
		try {
			const ergebnisse = await holeErgebnisse(betreiber, versammlung, [erfunden]);
			// Der stille Rückfall bleibt: kein Ergebnis in der Karte.
			expect(ergebnisse.has(erfunden)).toBe(false);
		} finally {
			spion.mockRestore();
		}
		expect(
			logeintraege.some(
				(z) => z.includes(`[ergebnis] Durchgang ${erfunden}`) && z.includes(versammlung)
			),
			`keine Logzeile mit Versammlung und Durchgang: ${logeintraege.join(' | ') || '(leer)'}`
		).toBe(true);
	});

	it('nimmt ein entferntes Traktandum mit Titel in den Verlauf auf, im JSON und im PDF', async () => {
		/*
		 * Produktentscheid 01.10.2026: Ein gelöschtes Traktandum erscheint im
		 * versiegelten Verlauf. Bis dahin fielen Anlegen und Entfernen mit der
		 * gelöschten Zeile aus der Zuordnung: Das Paket war kleiner, das Siegel
		 * hielt, die Paketprüfung meldete nichts. Getragen wird der Eintrag vom
		 * Entfernen-Ereignis, das Traktandum und Versammlung nennt; das Blatt
		 * zeigt den Titel aus dessen Angaben, keine Kennung.
		 */
		const a = await abgeschlossen('Siegelweg entfernt', '2026-12-21', true, false, false, true);
		await versiegle(handelnder(betreiber), a.versammlung, '2026-12-21 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, a.versammlung)) as Uint8Array);

		const verlauf = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/verlauf.json') as Uint8Array)
		) as { art: string; gegenstandId: string | null; angaben: Record<string, unknown> }[];

		const meine = verlauf.filter((z) => z.gegenstandId === a.entferntesTraktandum);
		expect(meine.map((z) => z.art).sort()).toEqual(['agenda.item.created', 'agenda.item.removed']);
		const entfernt = meine.find((z) => z.art === 'agenda.item.removed');
		expect(entfernt?.angaben?.titel).toBe('Der entfernte Punkt');

		const { PDFDocument } = await import('pdf-lib');
		const { textVonSeite } = await import('./pdftext');
		const bytes = dateien.get('Verlauf.pdf') as Uint8Array;
		const seitenzahl = (await PDFDocument.load(bytes)).getPageCount();
		const text = (
			await Promise.all(Array.from({ length: seitenzahl }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');
		expect(text).toContain('Traktandum «Der entfernte Punkt» (entfernt)');
	});

	it('ergibt ein Paket, dessen Inhalt gegen das Manifest stimmt', async () => {
		// Das ist die Prüfung, die ein Gericht anstellt: Prüfsumme je Datei bilden
		// und mit dem Manifest vergleichen.
		const { versammlung } = await abgeschlossen('Siegelweg 3', '2026-12-03');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-03 21:30:00');
		const paket = await holePaket(betreiber, versammlung);
		expect(paket).not.toBeNull();

		const { createHash } = await import('node:crypto');
		const { entpacke } = await import('./zip');
		const dateien = entpacke(paket as Uint8Array);

		const gefunden = new Map<string, string>();
		for (const [pfad, inhalt] of dateien) {
			gefunden.set(pfad, createHash('sha256').update(inhalt).digest('hex'));
		}

		const manifestInhalt = dateien.get('manifest.json');
		expect(manifestInhalt).toBeDefined();
		const manifestPruefsumme = createHash('sha256')
			.update(manifestInhalt as Uint8Array)
			.digest('hex');

		const befund = pruefe(
			JSON.parse(s.manifest) as Manifest,
			gefunden,
			manifestPruefsumme,
			s.siegel
		);
		expect(befund.abweichungen).toEqual([]);
		expect(befund.fehlend).toEqual([]);
		expect(befund.bestandteileStimmen).toBe(true);
		expect(befund.manifestStimmt).toBe(true);
		expect(befund.satz).toMatch(/Das Siegel hält/);

		// Und das Manifest liegt auch in Worten bei (FR-52).
		expect(dateien.has('MANIFEST.txt')).toBe(true);
		const worte = new TextDecoder().decode(dateien.get('MANIFEST.txt') as Uint8Array);
		expect(worte).toContain('WIE SIE ES PRÜFEN');
		expect(worte).toContain(s.siegel);
	});

	it('versiegelt nicht zweimal', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 4', '2026-12-04');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-04 21:30:00');
		await expect(
			versiegle(handelnder(betreiber), versammlung, '2026-12-04 21:35:00')
		).rejects.toThrow(/bereits versiegelt/i);
	});

	it('versiegelt nur, was geschlossen ist', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 5', '2026-12-05', false);
		const lage = await erhebeSiegellage(betreiber, versammlung);
		expect(lage.moeglich).toBe(false);
		await expect(
			versiegle(handelnder(betreiber), versammlung, '2026-12-05 21:30:00')
		).rejects.toThrow(/nicht geschlossen|läuft noch/i);
	});
});

describe('Die Zeile der Abend-Siegelseite', () => {
	/*
	 * **Der Wettlauf-Fall** (Code-Review zu `83be988`). `holeSiegel` liest,
	 * während die Abendseite lädt, noch kein Siegel; `erhebeSiegellage` liest
	 * das Siegel selbst und findet eines. `hindernisse` ist dann leer, und
	 * `join(' ')` ergäbe den leeren String: Die Zeile stünde auf «bereit», der
	 * Knopf zählte das Haus mit, und erst der Klick meldete «bereits
	 * versiegelt». Die Probe fährt die Zeilenbildung mit dem echten Siegel aus
	 * `versiegle`, damit die durchgereichte Form nicht erfunden ist.
	 */
	it('zeigt ein im Wettlauf gelesenes Siegel als versiegelt, nicht als bereit', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg Wettlauf', '2026-12-16');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-16 21:30:00');

		const angaben = siegelangaben(null, { moeglich: false, hindernisse: [], siegel: s });

		expect(angaben.siegelkopf).toBe(s.siegel.slice(0, 16));
		expect(angaben.versiegeltAm).toBe(s.versiegeltAm);
		expect(angaben.zeitstempel).toBe(s.zeitstempel);
		expect(angaben.zeitstempelhinweis).toBe(s.zeitstempelBemerkung);
		// Die Zeile trägt den Umstand mit, damit sie ihn zeigen kann (13.11.2026).
		expect(angaben.zeitstempelVomErsatz).toBe(s.zeitstempelVomErsatz);
		// Und wirklich durchgereicht, nicht fest verdrahtet: Hier wäre beides
		// `false` (Featureprüfung 13.11.2026).
		expect(
			siegelangaben(null, {
				moeglich: false,
				hindernisse: [],
				siegel: { ...s, zeitstempelVomErsatz: true }
			}).zeitstempelVomErsatz
		).toBe(true);
		// Ein leeres Hindernis ist keines: Das Siegel ist keines.
		expect(angaben.hindernis).toBeNull();

		// Die Gegenprobe: Ohne Siegel bleibt es beim alten Verhalten.
		const bereit = siegelangaben(null, { moeglich: true, hindernisse: [], siegel: null });
		expect(bereit.siegelkopf).toBeNull();
		expect(bereit.hindernis).toBeNull();

		const gehindert = siegelangaben(null, {
			moeglich: false,
			hindernisse: ['Der Grund.'],
			siegel: null
		});
		expect(gehindert.hindernis).toBe('Der Grund.');
	});
});

describe('Der Schreibschutz greift in der Datenbank (FR-55)', () => {
	/*
	 * **Unter der privilegierten Rolle geprüft**, wie beim Verlauf: Der
	 * Anwendungsrolle fehlt für manche dieser Tabellen ohnehin das Recht, und
	 * dann bewiese der Prüflauf nur das entzogene Recht, nicht den Auslöser.
	 * Zwei Schranken, und geprüft wird hier die zweite.
	 */
	it('weist Stimmen ab', async () => {
		const { versammlung, parteien } = await abgeschlossen('Siegelweg 6', '2026-12-06');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-06 21:30:00');
		const [r] = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`SELECT id FROM voting_round WHERE meeting_id = ${versammlung} LIMIT 1`
		);
		await expect(admin`UPDATE vote SET choice = 'no' WHERE round_id = ${r.id}`).rejects.toThrow(
			/versiegelt/i
		);
		expect(parteien).toHaveLength(2);
	});

	it('weist Anwesenheitsereignisse ab', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 7', '2026-12-07');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-07 21:30:00');
		await expect(
			admin`DELETE FROM attendance_event WHERE meeting_id = ${versammlung}`
		).rejects.toThrow(/versiegelt/i);
	});

	it('weist Vollmachten ab', async () => {
		// Die Zeile entsteht hier unter der privilegierten Rolle, weil es um den
		// **Auslöser** geht und nicht um die fachlichen Regeln des Erfassens: Beide
		// Parteien sind anwesend, und eine Vollmacht über eine Anwesende weist die
		// Anwendung zu Recht ab. Ohne eine Zeile träfe die Änderung nichts, der
		// Auslöser käme nicht zum Zug, und der Prüflauf wäre grün und leer.
		const { versammlung } = await abgeschlossen('Siegelweg 8', '2026-12-08');
		const momentparteien = await imKontext(
			betreiber,
			(tx) => tx<{ id: string }[]>`
				SELECT id FROM snapshot_party WHERE meeting_id = ${versammlung} ORDER BY display_name
			`
		);
		await admin`
			INSERT INTO proxy (operator_id, meeting_id, represented_id, holder_id, state)
			VALUES (${betreiber}, ${versammlung}, ${momentparteien[0].id}, ${momentparteien[1].id},
			        'erfasst')
		`;
		await versiegle(handelnder(betreiber), versammlung, '2026-12-08 21:30:00');

		await expect(
			admin`UPDATE proxy SET state = 'widerrufen' WHERE meeting_id = ${versammlung}`
		).rejects.toThrow(/versiegelt/i);
	});

	it('weist Änderungen am Entscheidbaumpfad ab und nennt die Spalte', async () => {
		const { versammlung, traktandum } = await abgeschlossen('Siegelweg 9', '2026-12-09');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-09 21:30:00');
		await expect(
			admin`UPDATE agenda_item SET requirement_title = 'gefälscht' WHERE id = ${traktandum}`
		).rejects.toThrow(/requirement_title/);
	});

	it('lässt die Protokollnotiz zu — sie ist nicht Teil des Siegels', async () => {
		// PRD §4.11: Ausgenommen sind ausschliesslich das Protokoll und seine
		// Fassungen. Ein Protokoll, das sich nach dem Versiegeln nicht mehr
		// redigieren liesse, wäre unbrauchbar.
		const { versammlung, traktandum } = await abgeschlossen('Siegelweg 10', '2026-12-10');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-10 21:30:00');

		const e = await setzeProtokollnotiz(
			handelnder(betreiber),
			versammlung,
			traktandum,
			'Nachtrag nach dem Versiegeln.'
		);
		expect(e.laenge).toBeGreaterThan(0);
	});

	it('weist auch neue Vollmachten ab, nicht nur Änderungen', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 11', '2026-12-11');
		// Hier über den gewöhnlichen Weg: Die Anwendungsrolle darf Vollmachten
		// anlegen — abgewiesen wird sie vom Auslöser, nicht vom fehlenden Recht.
		await versiegle(handelnder(betreiber), versammlung, '2026-12-11 21:30:00');
		const parteienDerMomentaufnahme = await imKontext(betreiber, (tx) =>
			tx<{ id: string }[]>`SELECT id FROM snapshot_party WHERE meeting_id = ${versammlung} ORDER BY display_name`
		);
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: parteienDerMomentaufnahme[0].id,
				bevollmaechtigtId: parteienDerMomentaufnahme[1].id
			})
		).rejects.toThrow();
	});
});

describe('Das Siegel selbst', () => {
	it('lässt sich nicht ändern und nicht löschen', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 12', '2026-12-12');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-12 21:30:00');
		expect(s.siegel).toHaveLength(64);

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE seal SET manifest_hash = repeat('0', 64) WHERE meeting_id = ${versammlung}`
			)
		).rejects.toThrow(/nicht geändert/i);

		/*
		 * **Zwei Schranken, beide belegt** (Audit B-03, 08.08.2026). Bis dahin gab
		 * es nur den Auslöser; seit Migration 055 fehlt der Anwendungsrolle das
		 * Löschrecht und greift **davor**. Ein Prüfstand, der nur noch die
		 * Rechtemeldung sieht, würde nicht bemerken, wenn der Auslöser fällt —
		 * deshalb wird jede Schranke dort geprüft, wo sie wirkt: die Rechte unter
		 * der Anwendungsrolle, der Auslöser unter der privilegierten (Superuser
		 * umgehen den Rechteentzug, nicht aber einen Auslöser).
		 */
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM seal WHERE meeting_id = ${versammlung}`)
		).rejects.toThrow(/denied|verweigert/i);
		await expect(
			admin`DELETE FROM seal WHERE meeting_id = ${versammlung}`
		).rejects.toThrow(/nicht gelöscht/i);
	});

	it('lässt den Zeitstempel nachkommen — und nicht wieder verschwinden', async () => {
		const { versammlung } = await abgeschlossen('Siegelweg 13', '2026-12-13');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-13 21:30:00');

		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE seal SET timestamp_state = 'vorhanden', timestamp_at = now(),
				                timestamp_hash = repeat('a', 64), timestamp_authority = 'Prüfstelle'
				WHERE meeting_id = ${versammlung}
			`
		);
		expect((await holeSiegel(betreiber, versammlung))?.zeitstempel).toBe('vorhanden');

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE seal SET timestamp_state = 'ausstehend' WHERE meeting_id = ${versammlung}`
			)
		).rejects.toThrow(/nicht zurückgenommen/i);
	});
});

/**
 * Der Zeitstempel (FR-53).
 *
 * **Was hier geprüft wird, ist das Verhalten im Fehlerfall** — denn genau das
 * entscheidet, ob eine Versammlung ohne Netz abgeschlossen werden kann. Der
 * gute Fall gegen einen echten Dienst steht am Ende und läuft nur auf Zuruf;
 * ein Prüflauf, der ein fremdes Haus braucht, ist sonst rot, sobald dort
 * jemand wartet.
 */
describe('Der Zeitstempel', () => {
	const eingestellt = {
		url: process.env.VERSAMMLUNG_ZEITSTEMPEL_URL,
		abdruecke: process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE
	};

	afterAll(() => {
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = eingestellt.url;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE = eingestellt.abdruecke;
	});

	it('bleibt ohne hinterlegten Dienst offen — und sagt warum', async () => {
		delete process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		const { versammlung } = await abgeschlossen('Stempelweg 1', '2026-12-14');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-14 21:30:00');

		const ergebnis = await holeZeitstempel(handelnder(betreiber), versammlung);
		expect(ergebnis.zustand).toBe('ausstehend');
		expect(ergebnis.bemerkung).toMatch(/kein Zeitstempeldienst/i);

		// Der Grund steht am Siegel, nicht nur in der Antwort dieses Aufrufs.
		const s = await holeSiegel(betreiber, versammlung);
		expect(s?.zeitstempel).toBe('ausstehend');
		expect(s?.zeitstempelBemerkung).toMatch(/kein Zeitstempeldienst/i);
		expect(await holeZeitstempeldatei(betreiber, versammlung)).toBeNull();
	});

	it('wertet einen unerreichbaren Dienst als «nachholen», nicht als Fehler', async () => {
		// Der Unterschied ist der ganze Punkt: Im Versammlungsraum ohne Netz ist
		// das der Regelfall und kein Anlass, irgendetwas anzuhalten.
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = 'http://kein-solcher-dienst.invalid/tsr';
		const { versammlung } = await abgeschlossen('Stempelweg 2', '2026-12-15');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-15 21:30:00');

		const ergebnis = await holeZeitstempel(handelnder(betreiber), versammlung);
		expect(ergebnis.zustand).toBe('ausstehend');
		expect((await holeSiegel(betreiber, versammlung))?.zeitstempel).toBe('ausstehend');
	}, 30000);

	it('wertet eine Antwort, die kein Zeitstempel ist, als gescheitert', async () => {
		// Ein Dienst antwortet — aber mit HTML statt DER. Das geht nicht von
		// allein weg und darf deshalb nicht als «nachholen» durchgehen.
		//
		// Der Test bringt seinen Antwortgeber selbst mit, statt auf die
		// Dev-Anwendung unter :3000 zu zeigen: In der CI hört dort niemand,
		// aus «gescheitert» wurde «ausstehend», und der Lauf war rot, obwohl
		// der Code stimmte (erster CI-Lauf, 17.08.2026).
		const { createServer } = await import('node:http');
		const antwortgeber = createServer((_anfrage, antwort) => {
			antwort.writeHead(200, { 'Content-Type': 'text/html' });
			antwort.end('<html><body>kein Zeitstempel</body></html>');
		});
		await new Promise<void>((auf) => antwortgeber.listen(0, '127.0.0.1', auf));
		const adresse = antwortgeber.address();
		if (adresse === null || typeof adresse === 'string') throw new Error('kein Port');
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = `http://127.0.0.1:${adresse.port}/`;
		try {
			const { versammlung } = await abgeschlossen('Stempelweg 3', '2026-12-16');
			await versiegle(handelnder(betreiber), versammlung, '2026-12-16 21:30:00');

			const ergebnis = await holeZeitstempel(handelnder(betreiber), versammlung);
			expect(ergebnis.zustand).toBe('gescheitert');
			expect((await holeSiegel(betreiber, versammlung))?.zeitstempelBemerkung).toBe(
				ergebnis.bemerkung
			);
		} finally {
			antwortgeber.close();
		}
	}, 30000);

	/**
	 * Ein nachgebauter Ersatzdienst, der die aufgezeichnete Antwort liefert.
	 *
	 * Der Hauptdienst ist in diesen Proben tot (`127.0.0.1:1`), damit der Weg
	 * über den Ersatz sicher der ist, der gemessen wird. Die drei Anläufe des
	 * Hauptdienstes kosten rund drei Sekunden; darum die längeren Fristen.
	 */
	async function ersatzAntwortet() {
		const roh = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));
		const token = leseAntwort(roh).token!;
		pruefZufall.nonce = token.zufall;

		const server = createServer((anfrage, antwort) => {
			anfrage.on('data', () => {});
			anfrage.on('end', () => {
				antwort.writeHead(200, { 'content-type': 'application/timestamp-reply' });
				antwort.end(Buffer.from(roh));
			});
		});
		await new Promise<void>((f) => server.listen(0, '127.0.0.1', f));
		const port = (server.address() as { port: number }).port;
		return {
			url: `http://127.0.0.1:${port}/`,
			abdruck: findeUnterzeichner(token)!.fingerprint256,
			schliessen: () => new Promise((f) => server.close(f))
		};
	}

	it('trägt den Ersatz beim Versiegeln in Siegelzeile und Verlauf', async () => {
		/*
		 * **Der Fall aus dem Auftrag** (13.11.2026): Der Hauptdienst DigiCert
		 * liefert nicht, freetsa bezeugt. Geprüft wird die Weitergabe an die
		 * Siegelzeile (`timestamp_authority`, `timestamp_by_fallback`) und an
		 * das Verlaufsereignis (`ersatz: true`). Den Weg dorthin, also
		 * `bezeuge`, prüft `zeitstempel.test.ts`; hier ist er gestellt, weil
		 * eine aufgezeichnete Antwort nicht auf ein neues Siegel lautet.
		 */
		pruefBezeuge.ergebnis = {
			zustand: 'vorhanden',
			bemerkung:
				'Bezeugt durch Free TSA (Ersatz); der Hauptdienst DigiCert scheiterte: ' +
				'Der Dienst DigiCert war nicht erreichbar.',
			zeitpunkt: '2026-12-19T20:30:00.000Z',
			stelle: 'Free TSA',
			pruefsumme: 'ab'.repeat(32),
			ersatz: true
		};
		try {
			const { versammlung } = await abgeschlossen('Stempelweg Ersatz', '2026-12-19');
			const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-19 21:30:00');

			expect(s.zeitstempel).toBe('vorhanden');
			expect(s.zeitstempelVomErsatz).toBe(true);
			expect(s.zeitstempelStelle).toBe('Free TSA');
			expect(s.zeitstempelBemerkung).toMatch(/Bezeugt durch Free TSA \(Ersatz\)/);

			const [zeile] = await admin<
				{ timestamp_authority: string | null; timestamp_by_fallback: boolean }[]
			>`
				SELECT timestamp_authority, timestamp_by_fallback
				  FROM seal WHERE meeting_id = ${versammlung}
			`;
			expect(zeile.timestamp_authority).toBe('Free TSA');
			expect(zeile.timestamp_by_fallback).toBe(true);

			// Und der Verlauf sagt es ohne Satzsuche.
			const [ereignis] = await admin<{ detail: { ersatz?: boolean } }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = 'meeting.sealed' AND subject_id = ${versammlung}
				 ORDER BY id DESC LIMIT 1
			`;
			expect(ereignis.detail.ersatz).toBe(true);

			// Der Betriebszustand sieht es und führt zur richtigen Stelle.
			const z = await holeBetriebszustand(betreiber);
			expect(z.warnungen.join(' ')).toMatch(/Ersatzdienst/);
			expect(z.warnungen.join(' ')).toMatch(/Äussere Dienste/);
		} finally {
			pruefBezeuge.ergebnis = null;
		}
	}, 30000);

	it('warnt nur, solange der Ersatz unter den letzten drei Siegeln bezeugt hat', async () => {
		/*
		 * **Der Gegenfall zur Warnung** (Featureprüfung 13.11.2026). Eine
		 * Fassung, die immer warnte, bliebe im Test oben grün. Die Zeitpunkte
		 * liegen weit vorn, damit die Reihenfolge nicht von den übrigen Siegeln
		 * dieses Betreibers abhängt.
		 */
		const zeile = async (name: string, tag: string, vomErsatz: boolean, am: string) => {
			const { versammlung } = await abgeschlossen(name, tag);
			await admin`
				INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash,
				                  package_hash, package_bytes, sealed_at, timestamp_state,
				                  timestamp_at, timestamp_hash, timestamp_authority,
				                  timestamp_by_fallback)
				VALUES (${betreiber}, ${versammlung}, '{}', ${'c'.repeat(64)},
				        ${'d'.repeat(64)}, 1234, ${am}, 'vorhanden',
				        ${am}, ${'e'.repeat(64)}, ${vomErsatz ? 'Free TSA' : 'DigiCert'},
				        ${vomErsatz})
			`;
		};

		await zeile('Warnweg Ersatz', '2026-12-10', true, '2099-01-01 20:00:00+00');
		expect((await holeBetriebszustand(betreiber)).warnungen.join(' ')).toMatch(/Ersatzdienst/);

		await zeile('Warnweg Haupt 1', '2026-12-11', false, '2099-01-02 20:00:00+00');
		await zeile('Warnweg Haupt 2', '2026-12-12', false, '2099-01-03 20:00:00+00');
		// Zwei Siegel danach: Der Ersatz steht noch unter den letzten drei.
		expect((await holeBetriebszustand(betreiber)).warnungen.join(' ')).toMatch(/Ersatzdienst/);

		await zeile('Warnweg Haupt 3', '2026-12-13', false, '2099-01-04 20:00:00+00');
		expect((await holeBetriebszustand(betreiber)).warnungen.join(' ')).not.toMatch(/Ersatzdienst/);
	});

	it('trägt den Ersatz auch beim Nachholen in die Siegelzeile und den Verlauf', async () => {
		/*
		 * **Der zweite Weg zu einer Siegelzeile** (13.11.2026). Hier läuft der
		 * echte `bezeuge` samt Ersatz: Die aufgezeichnete Antwort lautet auf
		 * `KETTEN_PRUEFSUMME`, deshalb bekommt die Versammlung ein Siegel mit
		 * genau dieser Prüfsumme. Das Paket dazu entsteht nicht; geprüft wird
		 * die Eintragung des nachgeholten Stempels.
		 */
		const ersatz = await ersatzAntwortet();
		const vorherUrl = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';
		try {
			const { versammlung } = await abgeschlossen('Stempelweg Ersatz nachgeholt', '2026-12-20');
			await admin`
				INSERT INTO seal (operator_id, meeting_id, manifest, manifest_hash,
				                  package_hash, package_bytes, timestamp_state)
				VALUES (${betreiber}, ${versammlung}, '{}', ${KETTEN_PRUEFSUMME},
				        ${'b'.repeat(64)}, 1234, 'ausstehend')
			`;

			await setzeZeitstempeldienst(handelnder(betreiber), {
				url: 'http://127.0.0.1:1/',
				name: 'DigiCert',
				fingerabdruecke: 'AB'.repeat(32)
			});
			await setzeErsatzdienst(handelnder(betreiber), {
				url: ersatz.url,
				name: 'Free TSA',
				fingerabdruecke: ersatz.abdruck
			});

			const nach = await holeZeitstempel(handelnder(betreiber), versammlung);
			expect(nach.zustand).toBe('vorhanden');

			const nachher = await holeSiegel(betreiber, versammlung);
			expect(nachher?.zeitstempelVomErsatz).toBe(true);
			expect(nachher?.zeitstempelStelle).toMatch(/SwissSign/);

			const [zeile] = await admin<
				{ timestamp_authority: string | null; timestamp_by_fallback: boolean }[]
			>`
				SELECT timestamp_authority, timestamp_by_fallback
				  FROM seal WHERE meeting_id = ${versammlung}
			`;
			expect(zeile.timestamp_authority).toMatch(/SwissSign/);
			expect(zeile.timestamp_by_fallback).toBe(true);

			const [ereignis] = await admin<{ detail: { ersatz?: boolean } }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = 'meeting.seal.timestamped' AND subject_id = ${versammlung}
				 ORDER BY id DESC LIMIT 1
			`;
			expect(ereignis.detail.ersatz).toBe(true);
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorherUrl;
			pruefZufall.nonce = null;
			await ersatz.schliessen();
			await entferneErsatzdienst(handelnder(betreiber));
			await entferneZeitstempeldienst(handelnder(betreiber));
		}
	}, 30000);

	it.runIf(process.env.VERSAMMLUNG_ZEITSTEMPEL_ECHTLAUF)(
		'holt einen echten Zeitstempel und weist ein fremdes Zertifikat ab',
		async () => {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = eingestellt.url;

			// Zuerst mit einem angehefteten Fingerabdruck, der nicht passt.
			process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE = 'AA:BB:CC';
			const { versammlung } = await abgeschlossen('Stempelweg 4', '2026-12-17');
			await versiegle(handelnder(betreiber), versammlung, '2026-12-17 21:30:00');
			const abgewiesen = await holeZeitstempel(handelnder(betreiber), versammlung);
			expect(abgewiesen.zustand).toBe('gescheitert');
			expect(abgewiesen.bemerkung).toMatch(/nicht hinterlegt/i);

			// Und dann mit dem, was der Dienst tatsächlich schickt.
			process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE = eingestellt.abdruecke;
			const gut = await holeZeitstempel(handelnder(betreiber), versammlung);
			expect(gut.zustand).toBe('vorhanden');
			expect(gut.zeitpunkt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

			const datei = await holeZeitstempeldatei(betreiber, versammlung);
			expect(datei!.byteLength).toBeGreaterThan(1000);

			// Ein zweiter Aufruf holt nicht noch einmal — das Siegel hat seinen
			// Zeitstempel, und ein zweiter wäre eine zweite Aussage.
			const nochmal = await holeZeitstempel(handelnder(betreiber), versammlung);
			expect(nochmal.bemerkung).toMatch(/liegt bereits vor/i);

			// Und wenn es beim Versiegeln klappt, liegt die Antwort **im** Paket
			// (FR-53) — dort, wo sie auch in zehn Jahren noch zu finden ist.
			const zweite = await abgeschlossen('Stempelweg 5', '2026-12-18');
			const versiegelt = await versiegle(
				handelnder(betreiber),
				zweite.versammlung,
				'2026-12-18 21:30:00'
			);
			expect(versiegelt.zeitstempel).toBe('vorhanden');

			const { entpacke } = await import('./zip');
			const dateien = entpacke((await holePaket(betreiber, zweite.versammlung)) as Uint8Array);
			expect(dateien.has('zeitstempel.tsr')).toBe(true);

			// Der Stempel lautet auf das Siegel — genau das prüft ein Dritter.
			const { leseAntwort, lautetAuf } = await import('$lib/domain/rfc3161');
			const token = leseAntwort(dateien.get('zeitstempel.tsr') as Uint8Array).token!;
			expect(lautetAuf(token, versiegelt.siegel)).toBe(true);

			// Und die Prüfung stört sich nicht an ihm: Er kann im Manifest nicht
			// stehen, weil er auf das Manifest ausgestellt ist.
			const { createHash } = await import('node:crypto');
			const gefunden = new Map<string, string>();
			for (const [pfad, inhalt] of dateien) {
				gefunden.set(pfad, createHash('sha256').update(inhalt).digest('hex'));
			}
			const befund = pruefe(
				JSON.parse(versiegelt.manifest) as Manifest,
				gefunden,
				createHash('sha256')
					.update(dateien.get('manifest.json') as Uint8Array)
					.digest('hex'),
				versiegelt.siegel
			);
			expect(befund.zusaetzlich).toEqual([]);
			expect(befund.satz).toMatch(/Das Siegel hält/);
		},
		60000
	);
});

/**
 * Das Prüfwerkzeug (FR-54).
 *
 * **Der Fall, für den es gebaut ist:** Jemand legt in fünf Jahren ein ZIP auf
 * den Tisch. Dann muss sich sagen lassen, ob es unverändert ist — und wenn
 * nicht, **welcher** Bestandteil abweicht.
 */
describe('Ein Paket prüfen', () => {
	/*
	 * **Ein geschlossener Port statt eines fremden Hauses.** `vitest.config.db.ts`
	 * setzt die Zeitstempel-URL ausdrücklich leer, damit kein Versiegeln im
	 * Prüflauf irgendwo anruft. Diese Proben brauchen nur einen `dienst()` mit
	 * Fingerabdrücken, nicht einen erreichbaren. `127.0.0.1:1` gibt sofort
	 * ECONNREFUSED; eine erfundene Adresse liefe in drei Anläufe mit Pausen und
	 * bei einem Auflöser, der NXDOMAIN kapert, ins Zeitlimit.
	 */
	const TOTER_DIENST = 'http://127.0.0.1:1/';
	const ABDRUCK = 'A'.repeat(64);

	/** Setzt den Dienst für die Dauer eines Laufs und gibt die Umgebung zurück. */
	async function mitDienst<T>(lauf: () => Promise<T>): Promise<T> {
		const vorherUrl = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		const vorherAbdruecke = process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = TOTER_DIENST;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE = ABDRUCK;
		try {
			return await lauf();
		} finally {
			// Zurückgeben, nicht löschen: Die Datei setzt an anderer Stelle
			// voraus, dass die Werte aus der Config noch stehen.
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorherUrl;
			process.env.VERSAMMLUNG_ZEITSTEMPEL_FINGERABDRUECKE = vorherAbdruecke;
		}
	}

	it('schreibt die Version der Anwendung ins Manifest, im Entwicklungsstapel ohne Tag (Entscheid 0053)', async () => {
		/*
		 * `env` ist hier der Ersatz aus `tests/db/env-ersatz.ts`, eine Kopie von
		 * `process.env` beim Laden; gesetzt wird deshalb dort, nicht in
		 * `process.env`.
		 */
		const vorher = env.VOTUM_VERSION;
		try {
			env.VOTUM_VERSION = '20261116-0854-854363d4';
			const { versammlung } = await abgeschlossen('Version im Manifest', '2026-12-23');
			const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-23 21:30:00');
			expect((JSON.parse(s.manifest) as Manifest).anwendung).toEqual({ name: 'Votum', version: '20261116-0854-854363d4' });

			env.VOTUM_VERSION = 'latest';
			const zwei = await abgeschlossen('Version ohne Tag', '2026-12-24');
			const t = await versiegle(handelnder(betreiber), zwei.versammlung, '2026-12-24 21:30:00');
			expect((JSON.parse(t.manifest) as Manifest).anwendung).toEqual({ name: 'Votum', version: null });
		} finally {
			env.VOTUM_VERSION = vorher;
		}
	});

	it('schreibt die erwartete Zeitstempelstelle ins Manifest (S-3)', async () => {
		const s = await mitDienst(async () => {
			const { versammlung } = await abgeschlossen('Stempelweg Manifest', '2026-12-22');
			return versiegle(handelnder(betreiber), versammlung, '2026-12-22 21:30:00');
		});
		const manifest = JSON.parse(s.manifest) as Manifest;

		expect(manifest.zeitstempelstelle?.fingerabdruecke).toEqual([ABDRUCK]);
		expect(manifest.zeitstempelstelle?.url).toBe(TOTER_DIENST);
	});

	it('führt den Ersatz im Manifest auch ohne angehefteten Hauptdienst (K5)', async () => {
		/*
		 * **K5** (13.11.2026): Der Hauptdienst ist eingetragen, aber ohne
		 * Abdruck, der Ersatz ist angeheftet. Stand der Ersatz nur im Manifest,
		 * wenn auch der Hauptdienst angeheftet war, meldete die Prüfseite einen
		 * Stempel des Ersatzes als Widerspruch im Paket.
		 */
		const vorher = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';
		try {
			await setzeZeitstempeldienst(handelnder(betreiber), {
				url: 'http://127.0.0.1:1/',
				name: 'DigiCert',
				fingerabdruecke: ''
			});
			await setzeErsatzdienst(handelnder(betreiber), {
				url: 'http://127.0.0.1:1/',
				name: 'Free TSA',
				fingerabdruecke: ABDRUCK
			});

			const { versammlung } = await abgeschlossen('Stempelweg Nur Ersatz', '2026-12-21');
			const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-21 21:30:00');
			const manifest = JSON.parse(s.manifest) as Manifest;

			expect(manifest.zeitstempelstelle?.fingerabdruecke).toEqual([]);
			expect(manifest.zeitstempelstelle?.name).toBe('DigiCert');
			expect(manifest.zeitstempelstelle?.ersatz?.fingerabdruecke).toEqual([
				normalisiereFingerabdruck(ABDRUCK)
			]);
			expect(manifest.zeitstempelstelle?.ersatz?.name).toBe('Free TSA');
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorher;
			await entferneErsatzdienst(handelnder(betreiber));
			await entferneZeitstempeldienst(handelnder(betreiber));
		}
	});

	it('nennt ohne Hauptdienst auch den Ersatz nicht im Manifest', async () => {
		/*
		 * **Gegenstück zu K5** (Codeprüfung 13.11.2026, M1): Ohne Hauptdienst
		 * fragt `bezeuge` niemanden. Ein Manifest, das den Ersatz trotzdem als
		 * einspringende Stelle nennt, beschriebe eine Ausweichung, die es nicht
		 * gab.
		 */
		const vorher = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';
		try {
			await entferneZeitstempeldienst(handelnder(betreiber));
			await setzeErsatzdienst(handelnder(betreiber), {
				url: 'http://127.0.0.1:1/',
				name: 'Free TSA',
				fingerabdruecke: ABDRUCK
			});

			const { versammlung } = await abgeschlossen('Stempelweg Ersatz allein', '2026-12-20');
			const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-20 21:30:00');
			const manifest = JSON.parse(s.manifest) as Manifest;

			expect(s.zeitstempel).toBe('ausstehend');
			expect(manifest.zeitstempelstelle).toBeUndefined();
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorher;
			await entferneErsatzdienst(handelnder(betreiber));
		}
	});

	it('lässt das Feld weg, wo nichts angeheftet war', async () => {
		/*
		 * Ein leeres Feld sähe aus wie eine Zusage und wäre keine. Die Umgebung
		 * wird hier ausdrücklich geleert, statt vorauszusetzen, dass sie leer
		 * ist: Beim Echtlauf fällt die Config-Zeile weg.
		 */
		const vorher = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';
		try {
			const { versammlung } = await abgeschlossen('Stempelweg Leer', '2026-12-23');
			const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-23 21:30:00');
			expect((JSON.parse(s.manifest) as Manifest).zeitstempelstelle).toBeUndefined();
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorher;
		}
	});

	it('lässt die Angabe aus dem Paket die eigene Liste NICHT verdrängen (S-3)', async () => {
		/*
		 * **Der Rückschritt, den die Sicherheitsprüfung gefunden hat.** Die
		 * erste Fassung gab dem Manifest den Vorrang. Damit hätte ein Angreifer,
		 * der ein Paket neu versiegelt, seine eigene Stelle eingetragen und aus
		 * «passt nicht» ein «passt» gemacht. Die Liste des prüfenden Systems ist
		 * die einzige Erwartung, die er nicht schreiben kann; sie bleibt
		 * massgebend, und die Angabe aus dem Paket steht als eigene Aussage
		 * daneben.
		 */
		const paket = await mitDienst(async () => {
			const { versammlung } = await abgeschlossen('Prüfweg Fremd', '2026-12-24');
			await versiegle(handelnder(betreiber), versammlung, '2026-12-24 21:30:00');
			return (await holePaket(betreiber, versammlung)) as Uint8Array;
		});

		// Geprüft ohne hinterlegten Dienst, also in der Lage eines fremden
		// Systems: Die Erwartung stammt dann von niemandem, und das Feld im
		// Paket macht daraus keine.
		const befund = await pruefePaket(betreiber, paket, null, null);
		expect(befund.manifest?.zeitstempelstelle?.fingerabdruecke).toEqual([ABDRUCK]);
		expect(befund.erwartungsquelle).toBe('nur_manifest');
		// Kein Stempel im Paket, weil der Dienst nicht antwortet: Dann gibt es
		// auch keinen Widerspruch zu melden.
		expect(befund.manifesterwartung).toBe('keine');
	});

	it('unterscheidet den nachgeholten Stempel vom Widerspruch im Paket', async () => {
		/*
		 * **Die Fallunterscheidung, die bei S-3 noch fehlte.** «Das Paket nennt
		 * eine andere Stelle als der Stempel» hat zwei Lesarten, und nur eine
		 * ist ernst:
		 *
		 *   - Der Stempel liegt **im** Paket. Er entstand unmittelbar nach dem
		 *     Manifest, aus demselben Vorgang und mit demselben hinterlegten
		 *     Dienst. Dafür gibt es keine harmlose Erklärung.
		 *   - Der Stempel wird **getrennt** eingereicht. So kommt jeder
		 *     nachgeholte (FR-53): Beim Nachholen ist das Paket längst
		 *     geschlossen und wird nicht neu geschrieben, also kann das Manifest
		 *     den späteren Aussteller gar nicht kennen. Ein Dienstwechsel
		 *     dazwischen ist Betrieb, kein Angriff.
		 *
		 * Ohne die Unterscheidung las sich beides gleich scharf — und eine
		 * Warnung, die im harmlosen Fall regelmässig erscheint, wird im ernsten
		 * nicht mehr gelesen.
		 */
		const paket = await mitDienst(async () => {
			const { versammlung } = await abgeschlossen('Prüfweg Nachgeholt', '2026-12-27');
			await versiegle(handelnder(betreiber), versammlung, '2026-12-27 21:30:00');
			return (await holePaket(betreiber, versammlung)) as Uint8Array;
		});

		// Ohne Stempel: keine Herkunft, kein Widerspruch.
		const ohne = await pruefePaket(betreiber, paket, null, null);
		expect(ohne.stempelquelle).toBe('keine');
		expect(ohne.manifesterwartung).toBe('keine');

		/*
		 * Eine **echte** Antwort von SwissSign, getrennt eingereicht. Das
		 * Manifest erwartet `ABDRUCK`, unterschrieben hat SwissSign: Die
		 * Erwartung ist also verletzt — aber sie ist es auf die harmlose Weise,
		 * und genau das muss der Befund hergeben.
		 */
		const nachgeholt = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));
		const mit = await pruefePaket(betreiber, paket, nachgeholt, null);
		expect(mit.stempelquelle).toBe('daneben');
		expect(mit.zeitstempel?.fingerabdruck).toBeTruthy();
		expect(mit.zeitstempel?.fingerabdruck).not.toBe(ABDRUCK);
		expect(mit.manifesterwartung).toBe('verletzt');
	});

	it('meldet keinen Widerspruch, wenn der nicht angeheftete Hauptdienst stempelt', async () => {
		/*
		 * **Der Spiegelfall zu K5** (Codeprüfung 13.11.2026, Runde 3). Der
		 * Hauptdienst ist eingetragen, aber ohne Abdruck; nur der Ersatz ist
		 * angeheftet. Im Regelfall stempelt der Hauptdienst, und sein Aussteller
		 * steht in keiner Liste des Pakets. Das ist kein Widerspruch: Für den
		 * Hauptdienst erwartet das Paket keinen bestimmten Aussteller.
		 */
		const stempel = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));
		const vorherUrl = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';
		try {
			await setzeZeitstempeldienst(handelnder(betreiber), {
				url: TOTER_DIENST,
				name: 'DigiCert',
				fingerabdruecke: ''
			});
			await setzeErsatzdienst(handelnder(betreiber), {
				url: TOTER_DIENST,
				name: 'Free TSA',
				fingerabdruecke: ABDRUCK
			});
			const { versammlung } = await abgeschlossen('Prüfweg Haupt ohne Abdruck', '2026-12-30');
			await versiegle(handelnder(betreiber), versammlung, '2026-12-30 21:30:00');
			const paket = (await holePaket(betreiber, versammlung)) as Uint8Array;

			const befund = await pruefePaket(betreiber, paket, stempel, null);
			expect(befund.manifest?.zeitstempelstelle?.fingerabdruecke).toEqual([]);
			expect(befund.manifest?.zeitstempelstelle?.ersatz?.fingerabdruecke).toEqual([
				normalisiereFingerabdruck(ABDRUCK)
			]);
			// Der Stempel trägt einen Abdruck; sonst wäre «keine» schon der erste
			// Zweig und der Test bliebe ohne den Fix grün.
			expect(befund.zeitstempel?.fingerabdruck).toBeTruthy();
			expect(befund.zeitstempel?.fingerabdruck).not.toBe(normalisiereFingerabdruck(ABDRUCK));
			expect(befund.zeitstempel?.angeheftet).toBe(false);
			expect(befund.manifesterwartung).toBe('keine');
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorherUrl;
			await entferneErsatzdienst(handelnder(betreiber));
			await entferneZeitstempeldienst(handelnder(betreiber));
		}
	});

	it('beurteilt einen Stempel des Ersatzdienstes gegen die Anheftung des Ersatzes', async () => {
		/*
		 * **Der Fall aus dem Anlass** (13.11.2026): Der Hauptdienst DigiCert
		 * liefert keinen geprüften Stempel, freetsa springt ein. Für die
		 * Prüfseite sind zwei Fragen zu trennen, und beide hängen an der
		 * **eigenen** Liste des Ersatzes:
		 *
		 *   1. Gilt der Aussteller hier als angeheftet? (Der Abdruck des
		 *      Hauptdienstes deckt ihn nicht.)
		 *   2. Nennt das Paket ihn als Erwartung? Sonst meldete die Seite einen
		 *      Widerspruch, wo keiner ist, im genau dafür gebauten Fall.
		 */
		const stempel = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));
		const fremderAbdruck = findeUnterzeichner(leseAntwort(stempel).token!)!.fingerprint256;

		// Der Ersatzdienst steht schon beim Versiegeln da; sein Abdruck gehört
		// damit ins Manifest. Die Adresse antwortet nicht, das Paket kommt ohne
		// Stempel zustande, und der wird getrennt eingereicht.
		await setzeErsatzdienst(handelnder(betreiber), {
			url: TOTER_DIENST,
			name: 'Free TSA',
			fingerabdruecke: fremderAbdruck
		});
		const vorherUrl = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		let paket: Uint8Array;
		try {
			paket = await mitDienst(async () => {
				const { versammlung } = await abgeschlossen('Prüfweg Ersatz', '2026-12-29');
				await versiegle(handelnder(betreiber), versammlung, '2026-12-29 21:30:00');
				return (await holePaket(betreiber, versammlung)) as Uint8Array;
			});
			// Der Hauptdienst steht hier nicht in der Umgebung; geprüft wird
			// gegen die Anheftung der Anwendung, und das ist der Ersatz.
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';

			const mit = await pruefePaket(betreiber, paket, stempel, null);
			// Der Ersatz ist angeheftet: Sein Abdruck steht in seiner Liste.
			expect(mit.zeitstempel?.angeheftet).toBe(true);
			expect(mit.erwartungsquelle).toBe('betreiber');
			// Und das Paket nennt ihn, also ist der Stempel keine Überraschung.
			expect(mit.manifesterwartung).toBe('erfuellt');
			expect(mit.manifest?.zeitstempelstelle?.ersatz?.fingerabdruecke).toEqual([fremderAbdruck]);

			/*
			 * **Und die Gegenprobe.** Derselbe Stempel, aber nur der Hauptdienst
			 * angeheftet: Er gilt als fremd. Eine gemeinsame Liste machte aus
			 * zwei Diensten eine Vertrauensstelle.
			 */
			await entferneErsatzdienst(handelnder(betreiber));
			await setzeZeitstempeldienst(handelnder(betreiber), {
				url: TOTER_DIENST,
				name: 'DigiCert',
				fingerabdruecke: ABDRUCK
			});
			const ohne = await pruefePaket(betreiber, paket, stempel, null);
			expect(ohne.zeitstempel?.angeheftet).toBe(false);
		} finally {
			process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorherUrl;
			await entferneErsatzdienst(handelnder(betreiber));
			await entferneZeitstempeldienst(handelnder(betreiber));
		}
	});

	it('lässt die milde Lesart nicht durch eine hochgeladene Datei erzwingen', async () => {
		/*
		 * **Der Befund der Sicherheitsprüfung vom 22.09.2026.** Die erste
		 * Fassung las die Herkunft aus dem **Formularfeld**: Wer eine Datei
		 * getrennt einreichte, bekam `daneben` und damit die Entlastung
		 * «dazwischen kann der Dienst gewechselt haben». Ein Angreifer mit
		 * einem widersprüchlichen Stempel **im** Paket musste ihn also nur
		 * herausziehen und ins zweite Feld legen.
		 *
		 * Gemessen wird jetzt das Paket: Ein nachgeholter Stempel setzt
		 * voraus, dass keiner im Archiv liegt. Diese Probe fährt genau den
		 * Angriffsweg — ein Paket **mit** eigenem Stempel, dazu eine
		 * eingereichte Datei — und verlangt, dass die milde Lesart ausbleibt.
		 */
		const { versammlung } = await abgeschlossen('Prüfweg Ersetzt', '2026-12-28');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-28 21:30:00');
		const original = (await holePaket(betreiber, versammlung)) as Uint8Array;

		const { entpacke: lies } = await import('$lib/server/paketpruefung');
		const { packe, dosZeitstempel } = await import('$lib/domain/archiv');
		const echt = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));

		/*
		 * Das Paket bekommt einen eigenen `zeitstempel.tsr`. Im Prüflauf
		 * antwortet kein Dienst, also wird er hier gelegt — auf die Herkunft
		 * kommt es an, nicht auf seine Gültigkeit.
		 */
		const dateien = [...lies(original)].map(([name, inhalt]) => ({ name, inhalt }));
		dateien.push({ name: 'zeitstempel.tsr', inhalt: echt });
		const mitEigenem = packe(dateien, dosZeitstempel('2026-12-28 21:30:00'));

		// Ohne Beilage: der Stempel des Pakets, und er wird beurteilt.
		const nurPaket = await pruefePaket(betreiber, mitEigenem, null, null);
		expect(nurPaket.stempelquelle).toBe('im_paket');
		expect(nurPaket.zeitstempel).not.toBeNull();

		/*
		 * Mit einer **anderen** Beilage: Das ist kein Nachholen, sondern ein
		 * Austausch. Beurteilt bleibt der Stempel aus dem Paket — sonst liesse
		 * sich ein untauglicher Stempel im Paket durch einen mitgebrachten
		 * tauglichen verdecken.
		 */
		const andere = new Uint8Array(echt);
		andere[andere.length - 1] ^= 0xff;
		const ersetzt = await pruefePaket(betreiber, mitEigenem, andere, null);
		expect(ersetzt.stempelquelle).toBe('ersetzt');
		expect(ersetzt.stempelquelle).not.toBe('daneben');
		expect(ersetzt.zeitstempel?.fingerabdruck).toBe(nurPaket.zeitstempel?.fingerabdruck);

		// Dieselben Bytes noch einmal einzureichen ist kein Austausch.
		const gleich = await pruefePaket(betreiber, mitEigenem, echt, null);
		expect(gleich.stempelquelle).toBe('im_paket');
	});

	it('gibt ein einzelnes Blatt heraus, und nur unterhalb von stimmnachweis/ (S-4)', async () => {
		/*
		 * **Gelesen, nicht neu erzeugt.** Ein zweiter Bau ergäbe andere Bytes
		 * und damit eine andere Prüfsumme als die im Manifest. Genau diese
		 * Prüfsumme ist der Grund für eine Datei je Traktandum.
		 */
		const { versammlung } = await abgeschlossen('Blattweg 1', '2026-12-26');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-26 21:30:00');
		const manifest = JSON.parse(s.manifest) as Manifest;
		const eintrag = manifest.eintraege.find((e) => e.pfad.startsWith('stimmnachweis/'));
		expect(eintrag, 'kein Stimmnachweis im Paket').toBeDefined();

		const dateiname = (eintrag as Manifesteintrag).pfad.replace('stimmnachweis/', '');
		const blatt = await holeStimmnachweis(betreiber, versammlung, dateiname);

		expect(blatt?.pfad).toBe(eintrag?.pfad);
		// Das Blatt löst genau die Prüfsumme ein, die im Manifest steht.
		expect(blatt?.pruefsumme).toBe(eintrag?.pruefsumme);

		expect(blatt?.inhalt?.byteLength).toBeGreaterThan(0);
		expect(blatt?.traktandum).toBe(dateiname.replace(/^T-/, '').replace(/\.pdf$/, ''));

		/*
		 * **Die Schranke, und zwar die richtige Hälfte davon.** Die erste
		 * Fassung dieser Probe nannte nur Namen, die schon am Zeichenfilter
		 * scheitern (`../manifest.json`, `../../etc/passwd`). Sie mass damit
		 * den Filter und nicht die Aussage des Titels. `Auswertung.pdf`
		 * **besteht** den Filter und liegt im Paket, nur eben im Wurzel-
		 * verzeichnis: Nur dieser Fall prüft, dass das feste Präfix
		 * `stimmnachweis/` trägt. Gefunden im Code-Review am 22.09.2026.
		 */
		expect(await holeStimmnachweis(betreiber, versammlung, 'Auswertung.pdf')).toBeNull();
		for (const versuch of ['../manifest.json', 'manifest.json', '../../etc/passwd', 'T-4.txt']) {
			expect(await holeStimmnachweis(betreiber, versammlung, versuch), versuch).toBeNull();
		}
	});

	it('bestätigt ein unverändertes Paket und nennt die Quelle des Vergleichs', async () => {
		const { versammlung } = await abgeschlossen('Prüfweg 1', '2026-12-20');
		const s = await versiegle(handelnder(betreiber), versammlung, '2026-12-20 21:30:00');
		const paket = (await holePaket(betreiber, versammlung)) as Uint8Array;

		const befund = await pruefePaket(betreiber, paket, null, null);
		expect(befund.inhalt?.bestandteileStimmen).toBe(true);
		expect(befund.inhalt?.manifestStimmt).toBe(true);
		expect(befund.gerechnetesSiegel).toBe(s.siegel);
		// Die eigene Datenbank ist der stärkere Vergleich: Sie lässt sich nicht
		// zusammen mit dem Paket fälschen.
		expect(befund.siegelquelle).toBe('datenbank');
		expect(befund.herkunft.bekannt).toBe(true);
		expect(befund.herkunft.stimmtUeberein).toBe(true);
		expect(befund.satz).toMatch(/Das Siegel hält/);
	});

	it('nennt einen veränderten Bestandteil beim Namen', async () => {
		const { versammlung } = await abgeschlossen('Prüfweg 2', '2026-12-21');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-21 21:30:00');
		const paket = (await holePaket(betreiber, versammlung)) as Uint8Array;

		const { entpacke: lies } = await import('$lib/server/paketpruefung');
		const { packe, dosZeitstempel } = await import('$lib/domain/archiv');
		const dateien = [...lies(paket)].map(([name, inhalt]) => ({ name, inhalt }));

		// Eine Zahl in der Auswertung ändern — der Fall, um den es geht.
		const ziel = dateien.find((d) => d.name.endsWith('.json') && d.name !== 'manifest.json');
		expect(ziel).toBeDefined();
		ziel!.inhalt = new TextEncoder().encode(
			new TextDecoder().decode(ziel!.inhalt).replace('"', '" ')
		);

		const gefaelscht = packe(dateien, dosZeitstempel('2026-12-21 21:30:00'));
		const befund = await pruefePaket(betreiber, gefaelscht, null, null);

		expect(befund.inhalt?.bestandteileStimmen).toBe(false);
		expect(befund.inhalt?.abweichungen.map((a) => a.pfad)).toContain(ziel!.name);
		// Das Manifest selbst ist unangetastet — genau diese Trennung verlangt FR-54.
		expect(befund.inhalt?.manifestStimmt).toBe(true);
		expect(befund.satz).toMatch(/verändert worden/);
	});

	it('sagt es, wenn kein Vergleichswert vorliegt', async () => {
		// Die Versammlung ist hier nicht bekannt: Das Manifest kann in sich
		// stimmig und trotzdem ausgetauscht sein. Wer das verschweigt, verkauft
		// eine Sicherheit, die es nicht gibt.
		const { versammlung } = await abgeschlossen('Prüfweg 3', '2026-12-22');
		await versiegle(handelnder(betreiber), versammlung, '2026-12-22 21:30:00');
		const paket = (await holePaket(betreiber, versammlung)) as Uint8Array;

		const { entpacke: lies } = await import('$lib/server/paketpruefung');
		const { packe, dosZeitstempel } = await import('$lib/domain/archiv');
		const dateien = [...lies(paket)].map(([name, inhalt]) => ({ name, inhalt }));

		// Manifest auf eine fremde Kennung umschreiben — dann kennt diese
		// Anwendung die Versammlung nicht.
		const m = dateien.find((d) => d.name === 'manifest.json')!;
		const text = new TextDecoder().decode(m.inhalt);
		m.inhalt = new TextEncoder().encode(
			text.replace(versammlung, '00000000-0000-4000-8000-000000000000')
		);
		const fremd = packe(dateien, dosZeitstempel('2026-12-22 21:30:00'));

		const befund = await pruefePaket(betreiber, fremd, null, null);
		expect(befund.siegelquelle).toBe('keine');
		expect(befund.herkunft.bekannt).toBe(false);
		expect(befund.satz).toMatch(/ohne Vergleichswert von aussen nicht/i);

		// Mit eingetipptem Siegel wird daraus eine Aussage — und eine falsche
		// Eingabe fällt auf.
		const mitFalschem = await pruefePaket(betreiber, fremd, null, 'b'.repeat(64));
		expect(mitFalschem.siegelquelle).toBe('eingegeben');
		expect(mitFalschem.inhalt?.manifestStimmt).toBe(false);
	});

	it('weist zurück, was kein Abschlusspaket ist', async () => {
		const { PaketFehler } = await import('$lib/server/paketpruefung');
		await expect(
			pruefePaket(betreiber, new TextEncoder().encode('Kein ZIP, nur Text.'), null, null)
		).rejects.toThrow(PaketFehler);

		// Ein ZIP ohne Manifest ist lesbar, aber kein Paket — das ist ein Befund,
		// kein Absturz.
		const { packe, dosZeitstempel } = await import('$lib/domain/archiv');
		const leer = packe(
			[{ name: 'irgendwas.txt', inhalt: new TextEncoder().encode('hallo') }],
			dosZeitstempel('2026-12-23 10:00:00')
		);
		const befund = await pruefePaket(betreiber, leer, null, null);
		expect(befund.manifest).toBeNull();
		expect(befund.satz).toMatch(/kein Abschlusspaket/i);
	});
});

/**
 * Die geheime Abstimmung im Abschlusspaket (Produktentscheid 28.09.2026,
 * Migration 141).
 *
 * «Die geheime Abstimmung muss ins Paket, da das Paket der Unveränderbarkeit
 * unterliegt»; getrennt und vertraulich innerhalb des Pakets ist der Entwurf
 * beim Bau. `daten/stimmen.json` trägt deshalb nur die offenen Durchgänge,
 * `daten/geheime-stimmen.json` die geheimen, jede mit eigener Prüfsumme im
 * Manifest.
 */
describe('Geheime Abstimmung im Paket', () => {
	it('trennt die Einzelstimmen in eine eigene Datei und vermerkt die Vertraulichkeit', async () => {
		const { versammlung } = await abgeschlossen(
			'Siegelweg Geheim',
			'2026-12-11',
			true,
			false,
			false,
			false,
			true
		);
		await versiegle(handelnder(betreiber), versammlung, '2026-12-11 21:30:00');
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, versammlung)) as Uint8Array);

		const offen = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)
		) as { geheim?: boolean }[];
		const geheim = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/geheime-stimmen.json') as Uint8Array)
		) as { geheim?: boolean; stimmen: unknown[] }[];

		expect(offen.length, 'die offene Datei trägt den geheimen Durchgang nicht').toBe(0);
		expect(geheim.length).toBe(1);
		expect(geheim[0].geheim).toBe(true);
		expect(geheim[0].stimmen.length).toBeGreaterThan(0);

		const { textVonSeite } = await import('./pdftext');
		const blatt = [...dateien.entries()].find(([k]) => k.startsWith('stimmnachweis/'));
		expect(blatt, 'kein Stimmnachweis im Paket').toBeDefined();
		const text = await textVonSeite(blatt![1]);
		expect(text).toContain('Geheime Abstimmung');
		expect(text).toContain('vertraulich');
	});
});
