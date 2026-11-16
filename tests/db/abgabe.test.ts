/**
 * Eine Versammlung an ein anderes Gerät abgeben (Migrationen 116 und 117).
 *
 * **Zwei Dinge werden hier geprüft, und beide sind unsichtbar, wenn sie kaputt
 * sind.**
 *
 *   1. **Die Mandantengrenze im Paket.** Ein Export, der eine fremde Zeile
 *      mitnimmt, sieht genauso aus wie ein richtiger: eine Datei, die sich
 *      öffnen lässt. Deshalb steht daneben ein zweiter Betreiber mit
 *      unverwechselbaren Namen, und das fertige Paket wird danach durchsucht.
 *   2. **Die Sperre.** Sie liegt in der Datenbank, nicht in der Oberfläche.
 *      Geprüft wird deshalb zusätzlich mit rohem SQL unter der Anwendungsrolle:
 *      Wer morgen einen neuen Schreibweg baut, kommt an diesem Auslöser vorbei,
 *      ob er will oder nicht.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erzeugeZugaenge } from '$lib/server/zugaenge';
import { gibAb, holeOffeneAbgabe, nimmAbgabeZurueck } from '$lib/server/abgabe';
import {
	holeEigenesGeraet,
	holeGeheimteile,
	registriereGeraet,
	richteEigenesGeraetEin,
	widerrufeGeraet
} from '$lib/server/geraete';
import { lies } from '$lib/server/dateien';
import {
	alsGeraetecode,
	erzeugeGeraeteschluessel,
	oeffneAlsGeraet,
	type Geraeteschluessel
} from '$lib/server/saalgeraet';
import { entpacke } from '$lib/server/paketpruefung';
import { verschluessleFuerGeraet } from '$lib/server/saalgeraet';
import { randomBytes } from 'node:crypto';
import { FachlicherFehler } from '$lib/domain/fehler';
import { admin, imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
let fremderBetreiber: string;

/**
 * Unverwechselbar: Diese Zeichenketten dürfen in keinem Paket auftauchen.
 *
 * **Zwei Nachbarn, nicht einer.** Der fremde Betreiber prüft die
 * Mandantengrenze, und die hält ohnehin der Zeilenschutz. Der gefährlichere
 * Fall ist der zweite: eine **andere Gemeinschaft desselben Verwalters**. Fehlt
 * in einer der 26 Abfragen das `WHERE stweg_id`, zieht sie deren Zeilen mit,
 * und keine Datenbankregel hält das auf. Auf dem Notebook im Saal stünde dann
 * die Eigentümerliste eines anderen Hauses.
 */
const FREMDE_GEMEINSCHAFT = 'ZZFREMDHAUS-NICHT-INS-PAKET';
const FREMDE_PERSON = 'ZZFREMDPERSON-NICHT-INS-PAKET';
const NACHBARHAUS = 'ZZNACHBARHAUS-NICHT-INS-PAKET';
const NACHBARPERSON = 'ZZNACHBARPERSON-NICHT-INS-PAKET';

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

async function eineVersammlung(operatorId: string, name: string, datum: string, personName: string) {
	const g = await erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const e = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 1000 },
		countsAsHead: true
	});
	const p = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: personName,
		isCommunity: false,
		representativeName: null
	});
	await ordneEigentumZu(handelnder(operatorId), e.id, p.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	return { gemeinschaft: g.id, versammlung: v.id, partei: p.id };
}

async function freigegeben(name: string, datum: string) {
	const v = await eineVersammlung(betreiber, name, datum, 'Aebi');
	await gibVersammlungFrei(handelnder(betreiber), v.versammlung);
	await erzeugeZugaenge(handelnder(betreiber), v.versammlung);
	return v;
}

async function eingetragenesGeraet(name: string): Promise<{ id: string; paar: Geraeteschluessel }> {
	const paar = erzeugeGeraeteschluessel();
	const geraet = await registriereGeraet(handelnder(betreiber), name, alsGeraetecode(paar));
	return { id: geraet.id, paar };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abgabe');
	benutzer = await pruefbenutzer(betreiber, 'abgabeleitung');

	// Der Nachbar, dessen Zeilen nirgends auftauchen dürfen.
	fremderBetreiber = await pruefbetreiber('Abgabe fremd');
	const fremderBenutzer = await pruefbenutzer(fremderBetreiber, 'fremdleitung');
	const merke = benutzer;
	benutzer = fremderBenutzer;
	await eineVersammlung(fremderBetreiber, FREMDE_GEMEINSCHAFT, '2027-03-03', FREMDE_PERSON);
	benutzer = merke;

	// Und der Nachbar im eigenen Haus: derselbe Betreiber, andere Gemeinschaft.
	await eineVersammlung(betreiber, NACHBARHAUS, '2027-04-04', NACHBARPERSON);
});

afterAll(verbindungenSchliessen);

describe('Das Vorbereitungspaket', () => {
	it('lässt sich nur mit dem Schlüssel des Zielgeräts öffnen und trägt die Versammlung', async () => {
		const v = await freigegeben('Abgabehaus 1', '2026-12-01');
		const geraet = await eingetragenesGeraet('Notebook 1');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: 'https://votum.example.ch',
			jetzt: '2026-11-20 10:00:00'
		});

		const abgabe = await holeOffeneAbgabe(betreiber, v.versammlung);
		expect(abgabe).not.toBeNull();

		const datei = await lies(abgabe!.paketPruefsumme);
		const fremdes = erzeugeGeraeteschluessel();
		expect(() => oeffneAlsGeraet(datei, fremdes.encSecret)).toThrow();

		const dateien = entpacke(oeffneAlsGeraet(datei, geraet.paar.encSecret));
		const manifest = JSON.parse(new TextDecoder().decode(dateien.get('manifest.json')!));

		expect(manifest.art).toBe('vorbereitung');
		expect(manifest.versammlung.kennung).toBe(v.versammlung);
		expect(manifest.abgabe).toBe(abgabe!.id);
		expect(manifest.herkunft).toBe('https://votum.example.ch');
		// Ohne Schemastand liesse sich auf der Gegenseite nicht prüfen, ob die
		// Zeilen überhaupt passen.
		expect(manifest.schema.anzahl).toBeGreaterThan(0);
		expect(manifest.schema.pruefsumme).toMatch(/^[0-9a-f]{64}$/);

		// Die Momentaufnahme muss mit: Ohne sie weiss das andere Gerät nicht, wer
		// stimmberechtigt ist.
		const parteien = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/snapshot_party.json')!)
		);
		expect(parteien.length).toBeGreaterThan(0);

		// Und die Zugänge, sonst kommt im Saal niemand mit seiner Karte herein.
		const zugaenge = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/meeting_access.json')!)
		);
		expect(zugaenge.length).toBeGreaterThan(0);
	});

	/*
	 * **Der Test gegen den Fehlalarm** (Produktentscheid 21.09.2026). Seit dem
	 * zweiten Paketbau vergleicht `gibAb` zwei Manifeste. Ein Vergleich, der
	 * immer anschlägt, machte jede Abgabe zur berichtigten und die Anzeige
	 * wertlos. Geprüft wird deshalb beides: dass die Prüfsumme im Leihschein auf
	 * die abgelegte Datei zeigt und dass **kein** Berichtigungsvermerk im
	 * Verlauf steht.
	 */
	it('meldet im Normalfall keine Abweichung', async () => {
		const v = await freigegeben('Abgabehaus 1c', '2026-12-12');
		const geraet = await eingetragenesGeraet('Notebook 1c');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		const abgabe = await holeOffeneAbgabe(betreiber, v.versammlung);
		expect(abgabe).not.toBeNull();

		// Der Leihschein zeigt auf das Paket, und das liegt wirklich da.
		const datei = await lies(abgabe!.paketPruefsumme);
		expect(datei.byteLength).toBe(abgabe!.paketGroesse);

		const berichtigungen = await admin<{ event_type: string }[]>`
			SELECT event_type FROM audit_entry
			 WHERE subject_id = ${v.versammlung}
			   AND event_type = 'meeting.handover.corrected'
		`;
		expect(berichtigungen).toEqual([]);

		// Und die Abgabe selbst steht genau einmal im Verlauf.
		const gegeben = await admin<{ anzahl: string }[]>`
			SELECT count(*) AS anzahl FROM audit_entry
			 WHERE subject_id = ${v.versammlung}
			   AND event_type = 'meeting.handover.given'
		`;
		expect(Number(gegeben[0].anzahl)).toBe(1);
	});

	/*
	 * **Die Gegenprobe, ohne die alles andere nichts beweist.** Sie durchsucht
	 * das ganze Paket, nicht einzelne Dateien: Eine vergessene Bedingung in
	 * irgendeiner der 26 Abfragen soll hier auffallen und nicht erst, wenn ein
	 * fremder Name auf einem fremden Notebook steht.
	 */
	it('enthält weder fremde Betreiber noch die Nachbargemeinschaft', async () => {
		const v = await freigegeben('Abgabehaus 2', '2026-12-02');
		const geraet = await eingetragenesGeraet('Notebook 2');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		const abgabe = await holeOffeneAbgabe(betreiber, v.versammlung);
		const dateien = entpacke(oeffneAlsGeraet(await lies(abgabe!.paketPruefsumme), geraet.paar.encSecret));

		const alles = [...dateien.entries()]
			.filter(([pfad]) => pfad.endsWith('.json'))
			.map(([, inhalt]) => new TextDecoder().decode(inhalt))
			.join('\n');

		expect(alles).not.toContain(FREMDE_GEMEINSCHAFT);
		expect(alles).not.toContain(FREMDE_PERSON);
		expect(alles).not.toContain(fremderBetreiber);

		// Der Fall, den keine Datenbankregel abfängt.
		expect(alles).not.toContain(NACHBARHAUS);
		expect(alles).not.toContain(NACHBARPERSON);
	});
});

describe('Die Sperre', () => {
	it('hält jede Änderung an der Versammlung auf, auch mit rohem SQL', async () => {
		const v = await freigegeben('Abgabehaus 3', '2026-12-03');
		const geraet = await eingetragenesGeraet('Notebook 3');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		/*
		 * Über die Anwendung … und hier steht bewusst nicht dasselbe Muster wie
		 * unten: Der Weg durch die Anwendung trägt den **übersetzten** Satz aus
		 * `uebersetzeSchranke`, die beiden darunter den rohen der Datenbank. Beide
		 * nennen das andere Gerät, und daran wird gemessen.
		 */
		await expect(eroeffneVersammlung(handelnder(betreiber), v.versammlung)).rejects.toThrow(
			/ander(es|en) Gerät/i
		);

		// … und daran vorbei.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE meeting SET location = 'Anderswo' WHERE id = ${v.versammlung}`
			)
		).rejects.toThrow(/abgegeben/i);

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO agenda_item (id, operator_id, meeting_id, position, title, item_kind, proposer_kind)
					VALUES (uuidv7(), ${betreiber}, ${v.versammlung}, 99, 'Später', 'kenntnisnahme', 'verwaltung')
				`
			)
		).rejects.toThrow(/abgegeben/i);
	});

	/*
	 * **Die drei Tabellen, an denen die Sperre zuerst fehlte** (18.09.2026, aus
	 * der zweiten Runde des Code-Reviews). Die erste Liste der Auslöser war aus
	 * Migration 039 übernommen, und das war der Fehler: 039 schützt den Nachweis
	 * nach dem Siegel, 117 die Ausleihe. Die Risikomenge ist das, was im Paket
	 * reist — und dort standen acht Tabellen ohne Sperre, bei dreien mit einem
	 * offenen Weg dorthin.
	 *
	 * **Warum die Zeilen ohne gültige Verweise auskommen:** Ein Fremdschlüssel
	 * ist in Postgres ein nachgelagerter Auslöser, unsere Sperre ein
	 * vorgelagerter. Sie kommt also zuerst — und genau das misst die Probe. Ohne
	 * die Sperre schlüge stattdessen der Fremdschlüssel zu, mit einer anderen
	 * Meldung; deshalb steht hier `VO117` und nicht bloss «wirft».
	 */
	it('hält auch Weisung, Ausstand und Unterlage auf', async () => {
		const v = await freigegeben('Abgabehaus 3c', '2026-12-23');
		const geraet = await eingetragenesGeraet('Notebook 3c');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		const irgendwas = '00000000-0000-7000-8000-000000000001';

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO instruction (operator_id, meeting_id, agenda_item_id, party_id, stance, source_kind)
					VALUES (${betreiber}, ${v.versammlung}, ${irgendwas}, ${irgendwas}, 'ja', 'versammlung')
				`
			)
		).rejects.toMatchObject({ code: 'VO117' });

		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO recusal (operator_id, meeting_id, agenda_item_id, party_id, grund, erklaert_durch)
					VALUES (${betreiber}, ${v.versammlung}, ${irgendwas}, ${irgendwas}, 'Befangen', 'Prüfung')
				`
			)
		).rejects.toMatchObject({ code: 'VO117' });

		// Die Unterlage kennt die Versammlung über `subject_type`/`subject_id`.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					INSERT INTO attachment (operator_id, subject_type, subject_id, checksum, original_name, content_type, size_bytes)
					VALUES (${betreiber}, 'meeting', ${v.versammlung}, ${'a'.repeat(64)}, 'Nachtrag.pdf', 'application/pdf', 1)
				`
			)
		).rejects.toMatchObject({ code: 'VO117' });
	});

	/*
	 * **Die Absage muss lesbar ankommen, nicht nur ankommen** (18.09.2026, aus
	 * dem Code-Review). Die Prüfung darüber passt auf beide Fassungen: Der rohe
	 * Fehler der Datenbank enthält das Wort «abgegeben» genauso wie der
	 * übersetzte. Was sie nicht misst, ist der Unterschied, auf den es ankommt —
	 * ein `PostgresError` wird von keiner Aktion eingefangen und endet als leere
	 * 500er-Seite, ein `FachlicherFehler` als Satz im Formular.
	 *
	 * Erhoben wurde, dass es in der Anwendung keinen Ort gibt, durch den alle
	 * Schreibwege laufen; irgendein Weg bleibt deshalb immer übrig, an dem kein
	 * Knopf weggenommen wurde. Für den ist diese Übersetzung da.
	 */
	it('kommt als lesbare Absage an und nicht als roher Datenbankfehler', async () => {
		const v = await freigegeben('Abgabehaus 3b', '2026-12-13');
		const geraet = await eingetragenesGeraet('Notebook 3b');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		const fehler = await eroeffneVersammlung(handelnder(betreiber), v.versammlung).then(
			() => null,
			(f: unknown) => f
		);

		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect((fehler as FachlicherFehler).message).toMatch(/unterwegs|abgegeben/i);
		// Und kein Schemaname im Satz: Er steht auch auf offenen Pfaden.
		expect((fehler as FachlicherFehler).message).not.toMatch(/meeting|relation|constraint/);
	});

	it('fällt mit der Rücknahme, und die verlangt einen Grund', async () => {
		const v = await freigegeben('Abgabehaus 4', '2026-12-04');
		const geraet = await eingetragenesGeraet('Notebook 4');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: geraet.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		await expect(nimmAbgabeZurueck(handelnder(betreiber), v.versammlung, ' ')).rejects.toThrow(
			FachlicherFehler
		);

		await nimmAbgabeZurueck(handelnder(betreiber), v.versammlung, 'Notebook defekt');

		expect(await holeOffeneAbgabe(betreiber, v.versammlung)).toBeNull();
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE meeting SET location = 'Wieder hier' WHERE id = ${v.versammlung}`
			)
		).resolves.toBeDefined();
	});

	it('lässt keine zweite Abgabe neben einer offenen zu', async () => {
		const v = await freigegeben('Abgabehaus 5', '2026-12-05');
		const eins = await eingetragenesGeraet('Notebook 5a');
		const zwei = await eingetragenesGeraet('Notebook 5b');

		await gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
			geraetId: eins.id,
			herkunft: null,
			jetzt: '2026-11-20 10:00:00'
		});

		await expect(
			gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
				geraetId: zwei.id,
				herkunft: null,
				jetzt: '2026-11-20 10:05:00'
			})
		).rejects.toThrow(/bereits an ein anderes Gerät abgegeben/i);
	});
});

describe('Wann nicht abgegeben wird', () => {
	it('nicht aus dem Entwurf heraus', async () => {
		const v = await eineVersammlung(betreiber, 'Abgabehaus 6', '2026-12-06', 'Aebi');
		const geraet = await eingetragenesGeraet('Notebook 6');

		await expect(
			gibAb(handelnder(betreiber), v.versammlung, { zustand: 'entwurf' }, {
				geraetId: geraet.id,
				herkunft: null,
				jetzt: '2026-11-20 10:00:00'
			})
		).rejects.toThrow(/Entwurf/i);
	});

	it('nicht an ein widerrufenes Gerät', async () => {
		const v = await freigegeben('Abgabehaus 7', '2026-12-07');
		const geraet = await eingetragenesGeraet('Notebook 7');
		await widerrufeGeraet(handelnder(betreiber), geraet.id, 'verloren gegangen');

		await expect(
			gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
				geraetId: geraet.id,
				herkunft: null,
				jetzt: '2026-11-20 10:00:00'
			})
		).rejects.toThrow(/widerrufen/i);
	});

	it('nicht an ein Gerät, das es hier nicht gibt', async () => {
		const v = await freigegeben('Abgabehaus 8', '2026-12-08');
		const [{ id }] = await admin<{ id: string }[]>`SELECT uuidv7() AS id`;

		await expect(
			gibAb(handelnder(betreiber), v.versammlung, { zustand: 'freigegeben' }, {
				geraetId: id,
				herkunft: null,
				jetzt: '2026-11-20 10:00:00'
			})
		).rejects.toThrow(/nicht eingetragen/i);
	});
});

/**
 * Die andere Seite: diese Anwendung als Saalgerät.
 *
 * **Warum das Geheimnis hier gesetzt wird.** Der geheime Teil des
 * Schlüsselpaars liegt verschlüsselt, mit `VERSAMMLUNG_GEHEIMNIS` aus der
 * Umgebung. Ohne es liesse sich kein Gerät einrichten, und der Test prüfte
 * dann nur die Absage. Gesetzt wird ein Wegwerfwert im Prozess des Testlaufs.
 */
describe('Diese Anwendung als Saalgerät', () => {
	beforeAll(() => {
		process.env.VERSAMMLUNG_GEHEIMNIS = randomBytes(32).toString('hex');
	});

	it('richtet sich genau einmal ein und legt den geheimen Teil brauchbar ab', async () => {
		const eigenes = await richteEigenesGeraetEin('Notebook Saal');
		expect(eigenes.name).toBe('Notebook Saal');
		expect(eigenes.code).toContain('.');

		// Ein zweites Paar wäre eine zweite Identität für dasselbe Gerät.
		await expect(richteEigenesGeraetEin('Noch eines')).rejects.toThrow(/bereits eingerichtet/i);
		expect((await holeEigenesGeraet())?.fingerabdruck).toBe(eigenes.fingerabdruck);

		/*
		 * **Die Probe, die zählt:** Ein Paket, das für den angezeigten Code
		 * verschlüsselt wurde, muss sich mit dem abgelegten geheimen Teil öffnen
		 * lassen. Damit ist die ganze Kette geprüft — verschlüsselt ablegen,
		 * wieder öffnen, und beide Hälften gehören zusammen.
		 */
		const inhalt = new TextEncoder().encode('Für genau dieses Gerät.');
		const paket = verschluessleFuerGeraet(inhalt, eigenes.code.split('.')[0]);
		const geheim = await holeGeheimteile();
		expect(geheim).not.toBeNull();
		expect(new TextDecoder().decode(oeffneAlsGeraet(paket, geheim!.encSecret))).toBe(
			'Für genau dieses Gerät.'
		);
	});
});
