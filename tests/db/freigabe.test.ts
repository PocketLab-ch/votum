/**
 * Story 3.5 — Freigabe und Momentaufnahme in der Datenbank (AD-3).
 *
 * Der wichtigste Test dieser Datei ist der letzte im Abschnitt «Eingefroren»:
 * Er ändert nach der Freigabe die Stammdaten und prüft, dass die Momentaufnahme
 * davon unberührt bleibt. Das ist die ganze Zusage von AD-3, und sie lässt sich
 * nur so belegen — im Kern ist sie nicht prüfbar, weil dort nichts gespeichert
 * wird.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { nimmMitberechtigtenAuf } from '$lib/server/mitberechtigte';
import { erstelleVersammlung, holeVersammlung, zaehleParteien } from '$lib/server/versammlungen';
import {
	erstelleTraktandum,
	holeTraktanden,
	verschiebeTraktandum
} from '$lib/server/traktanden';
import { holeAusArchiv } from '$lib/server/archivieren';
import {
	erhebeFreigabelage,
	gibVersammlungFrei,
	holeMomentaufnahme,
	nimmVersammlungsfreigabeZurueck
} from '$lib/server/freigabe';
import {
	bestaetigeVollmacht,
	erfasseVollmacht,
	holeParteien,
	vermerkeVorlage,
	weiseVollmachtZurueck,
	widerrufeVollmacht,
	zaehleVollmachten
} from '$lib/server/vollmacht';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import type { HeadCountMode } from '$lib/domain/types';
import { imKontext, ohneKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let betreiberB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/**
 * Baut eine vollständige, freigabefähige Gemeinschaft: zwei Einheiten zu je 500,
 * zwei Eigentümer, eine Versammlung mit einem Traktandum.
 */
async function aufbau(
	operatorId: string,
	name: string,
	datum = '2026-09-15',
	zaehlweise: { headCountMode: HeadCountMode; headCountRuleSource?: string } = {
		headCountMode: 'per_owner'
	}
) {
	const g = await erstelleGemeinschaft(handelnder(operatorId), {
		name,
		quotaDenominator: 1000,
		parkingCountsAsHead: false,
		parentStwegId: null,
		...zaehlweise
	});

	const e1 = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 1',
		quotas: { stamm: 500 },
		countsAsHead: true
	});
	const e2 = await erstelleEinheit(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'unit',
		label: 'Whg 2',
		quotas: { stamm: 500 },
		countsAsHead: true
	});

	const p1 = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Anna Muster',
		isCommunity: false,
		representativeName: null
	});
	const p2 = await erstelleEigentuemer(handelnder(operatorId), {
		stwegId: g.id,
		kind: 'natural',
		displayName: 'Beat Beispiel',
		isCommunity: false,
		representativeName: null
	});

	await ordneEigentumZu(handelnder(operatorId), e1.id, p1.id, '2020-01-01');
	await ordneEigentumZu(handelnder(operatorId), e2.id, p2.id, '2020-01-01');

	const v = await erstelleVersammlung(handelnder(operatorId), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});

	await erstelleTraktandum(handelnder(operatorId), {
		meetingId: v.id,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});

	return { gemeinschaft: g.id, versammlung: v.id, einheiten: [e1.id, e2.id], parteien: [p1.id, p2.id] };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Freigabe A');
	betreiberB = await pruefbetreiber('Freigabe B');
});

afterAll(verbindungenSchliessen);

describe('Die Zahl der Parteien, an zwei Stellen', () => {
	/*
	 * **Zwei Aussagen zum selben Ding** (Bedienbarkeitsprüfung 05.09.2026,
	 * Befund 8 der Bewirtschaftersicht): Beim Vorschlag der Abstimmungsweise
	 * stand «7 Parteien erfasst», zwei Klicks weiter meldete die Freigabe
	 * «5 Parteien». Beide sagten «Parteien» und zählten Verschiedenes.
	 *
	 * Die Zahl ist nicht nur Text: Die Schwelle für den Vorschlag liegt bei
	 * fünf, der Unterschied kippte ihn also von «einfach» auf «geführt».
	 *
	 * Geprüft wird deshalb die Zusicherung selbst — beide Stellen zählen
	 * dieselbe Menge —, und zwar an dem Fall, der sie auseinandertrieb: einer
	 * Eigentümergemeinschaft, deren Mitglieder eigene Zeilen haben, aber keine
	 * eigene Einheit.
	 */
	it('zählt an beiden Stellen dieselbe Menge, auch bei gemeinschaftlichem Eigentum', async () => {
		const { versammlung, gemeinschaft, einheiten } = await aufbau(betreiber, 'Parteienzahl 1');

		const eine = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Eine Beteiligte',
			representativeName: null,
			isCommunity: false
		});
		const andere = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Andere Beteiligte',
			representativeName: null,
			isCommunity: false
		});
		const huelle = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Eine und Andere',
			representativeName: null,
			isCommunity: true
		});
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, eine.id);
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, andere.id);

		/*
		 * **Die Hülle muss die Einheit halten** (Code-Review 06.09.2026). Ohne
		 * diese Zeile beschreibt der Test einen Fall, den er nicht durchläuft:
		 * Drei Zeilen ohne jede Einheit fallen aus beiden Zählungen heraus, und
		 * die Frage, ob ein **Mitglied** mitzählt, wird nie gestellt. Der Test
		 * war grün und die Mutantenprobe rot — beides, ohne den beschriebenen
		 * Fall zu berühren.
		 *
		 * Die erste Einheit wechselt dafür zur Gemeinschaft; die zweite bleibt,
		 * wo sie ist, damit die Versammlung freigabefähig bleibt.
		 */
		await ordneEigentumZu(handelnder(betreiber), einheiten[0], huelle.id, '2026-01-01');

		const { lage } = await erhebeFreigabelage(betreiber, versammlung);
		const vorschlagszahl = await zaehleParteien(betreiber, gemeinschaft, '2026-09-15');
		expect(vorschlagszahl).toBe(lage.anzahlParteien);
	});
});

describe('Freigabelage', () => {
	it('meldet eine vollständige Versammlung als freigabefähig', async () => {
		const { versammlung } = await aufbau(betreiber, 'Freigabeweg 1');
		const { befund } = await erhebeFreigabelage(betreiber, versammlung);
		expect(befund.moeglich).toBe(true);
	});

	it('meldet eine Versammlung ohne Traktandum als gesperrt', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Leerweg 2',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum: '2026-09-15',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'einfach'
		});
		// Seit Story 3.8 entstehen Pflichttraktanden von selbst. Wirklich leer wird
		// die Versammlung erst, wenn jemand sie alle entfernt — was zulässig ist
		// und genau dann diese Sperre auslösen muss.
		await imKontext(betreiber, (tx) => tx`
			DELETE FROM agenda_item WHERE meeting_id = ${v.id}
		`);
		const { befund } = await erhebeFreigabelage(betreiber, v.id);
		expect(befund.moeglich).toBe(false);
		expect(befund.hindernisse.map((h) => h.kennung)).toContain('keine_traktanden');
	});

	it('meldet einen unausgeglichenen Wertquotensaldo', async () => {
		const { versammlung, einheiten } = await aufbau(betreiber, 'Schiefweg 3');
		// Eine Einheit auf 400 setzen: Die Summe ergibt 900 statt 1000.
		await imKontext(betreiber, (tx) => tx`
			UPDATE unit_quota SET value = 400
			WHERE unit_id = ${einheiten[0]}
			  AND quota_kind_id IN (SELECT id FROM quota_kind WHERE key = 'stamm')
		`);
		const { befund } = await erhebeFreigabelage(betreiber, versammlung);
		expect(befund.moeglich).toBe(false);
		expect(befund.hindernisse.map((h) => h.kennung)).toContain('quotensaldo');
	});

	it('meldet das fehlende Mehrheitserfordernis als Hinweis, nicht als Hindernis', async () => {
		const { versammlung } = await aufbau(betreiber, 'Hinweisweg 4');
		const { befund } = await erhebeFreigabelage(betreiber, versammlung);
		expect(befund.moeglich).toBe(true);
		expect(befund.hinweise.map((h) => h.kennung)).toContain('ohne_erfordernis');
	});
});

describe('Freigeben', () => {
	it('schreibt die Momentaufnahme und setzt den Zustand', async () => {
		const { versammlung } = await aufbau(betreiber, 'Frostweg 5');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		expect((await holeVersammlung(betreiber, versammlung))?.zustand).toBe('freigegeben');

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.parties).toHaveLength(2);
		expect(m?.totalQuota).toBe(1000);
		expect(stimmkraftliste(m!).summeKopfstimmen).toBe(2);
		expect(stimmkraftliste(m!).summeWertquote).toBe(1000);
	});

	it('liest den Eigentümerstand zum Versammlungsdatum, nicht zu heute', async () => {
		// Wer im Voraus für ein späteres Datum freigibt, will den Stand von dann.
		const { versammlung, einheiten, gemeinschaft } = await aufbau(
			betreiber,
			'Stichtagweg 6',
			'2027-06-01'
		);
		const neu = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Clara Kaeuferin',
			isCommunity: false,
			representativeName: null
		});
		// Verkauf per 1. Januar 2027 — vor der Versammlung, aber nach heute.
		await ordneEigentumZu(handelnder(betreiber), einheiten[0], neu.id, '2027-01-01');

		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.parties.map((p) => p.displayName).sort()).toEqual([
			'Beat Beispiel',
			'Clara Kaeuferin'
		]);
	});

	it('lässt Parteien ohne Einheit weg', async () => {
		// Sie sind an diesem Tag nicht stimmberechtigt; stehenzulassen ergäbe
		// Stimmberechtigte mit null Stimmen, die in jeder Anwesenheitsliste als
		// fehlend erschienen.
		const { versammlung, gemeinschaft } = await aufbau(betreiber, 'Ohneweg 7');
		await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Ohne Einheit',
			isCommunity: false,
			representativeName: null
		});
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.parties.map((p) => p.displayName)).not.toContain('Ohne Einheit');
	});

	it('weist die Freigabe bei einem Hindernis ab', async () => {
		const { versammlung, einheiten } = await aufbau(betreiber, 'Sperrweg 8');
		await imKontext(betreiber, (tx) => tx`
			UPDATE unit_quota SET value = 400 WHERE unit_id = ${einheiten[0]}
			  AND quota_kind_id IN (SELECT id FROM quota_kind WHERE key = 'stamm')
		`);
		await expect(gibVersammlungFrei(handelnder(betreiber), versammlung)).rejects.toThrow(
			/Wertquoten/
		);
		expect(await holeMomentaufnahme(betreiber, versammlung)).toBeNull();
	});

	it('weist eine zweite Freigabe ab', async () => {
		const { versammlung } = await aufbau(betreiber, 'Doppelweg 9');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await expect(gibVersammlungFrei(handelnder(betreiber), versammlung)).rejects.toThrow(
			/freigegeben/
		);
	});

	/*
	 * **Die Falle, die das schliesst** (25.08.2026, aus beiden Reviews): Ein
	 * Entwurf lässt sich archivieren, und freigeben liess sich danach trotzdem.
	 * Ergebnis wäre eine Versammlung, die freigegeben ist — Einladungen draussen
	 * — und zugleich aus Liste, Suche und Startseite verschwunden.
	 */
	it('weist die Freigabe einer archivierten Versammlung ab', async () => {
		const { versammlung } = await aufbau(betreiber, 'Archivweg 3');

		/*
		 * **Der Zustand wird hier von Hand gesetzt, nicht über `archiviere`.**
		 *
		 * Seit dem 25.08.2026 gilt «archiviert wird, was versiegelt ist» (Auftraggeber),
		 * und eine versiegelte Versammlung ist längst freigegeben — über die
		 * Anwendung ist «archiviert und noch freizugeben» damit nicht mehr
		 * herstellbar. Die Schranke in `gibVersammlungFrei` bleibt trotzdem
		 * stehen, und dieser Test hält sie am Leben: Wird die Archivierbarkeit
		 * je gelockert, faellt das Loch nicht lautlos wieder auf.
		 *
		 * Ohne den Test waere die Schranke ein Waechter, den nie jemand aufruft —
		 * und der beim naechsten Umbau als «offenbar unnoetig» verschwaende.
		 */
		const [gesetzt] = await imKontext(betreiber, (tx) =>
			tx<{ archived_at: Date | null }[]>`
				UPDATE meeting SET archived_at = now() WHERE id = ${versammlung}
				RETURNING archived_at
			`
		);
		/*
		 * **Nachmessen, nicht annehmen.** `ohneKontext` — ohne gesetzten Mandanten
		 * — laesst die Zeilenrechte das UPDATE lautlos verwerfen: null Zeilen,
		 * kein Fehler, und der Test waere gruen geworden, ohne je etwas geprueft
		 * zu haben.
		 */
		expect(gesetzt?.archived_at).toBeTruthy();

		await expect(gibVersammlungFrei(handelnder(betreiber), versammlung)).rejects.toThrow(
			/Archiv/
		);

		// Und nach dem Hervorholen geht es wieder — die Schranke sperrt nicht dauerhaft.
		await holeAusArchiv(handelnder(betreiber), 'versammlung', versammlung);
		const v = await gibVersammlungFrei(handelnder(betreiber), versammlung);
		expect(v.zustand).toBe('freigegeben');
	});
});

describe('Eingefroren (AD-3)', () => {
	it('bleibt von einem Eigentümerwechsel nach der Freigabe unberührt', async () => {
		const { versammlung, einheiten, gemeinschaft } = await aufbau(betreiber, 'Wechselweg 10');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		const vorher = await holeMomentaufnahme(betreiber, versammlung);
		expect(vorher?.parties.map((p) => p.displayName).sort()).toEqual([
			'Anna Muster',
			'Beat Beispiel'
		]);

		// Verkauf mit Wirkung vor dem Versammlungsdatum — der ungünstigste Fall:
		// Läse die Auswertung die Stammdaten, änderte sich das Ergebnis
		// rückwirkend.
		const kaeufer = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Doris Danach',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), einheiten[0], kaeufer.id, '2026-01-01');

		const nachher = await holeMomentaufnahme(betreiber, versammlung);
		expect(nachher?.parties.map((p) => p.displayName).sort()).toEqual([
			'Anna Muster',
			'Beat Beispiel'
		]);
		expect(stimmkraftliste(nachher!).summeWertquote).toBe(1000);
	});

	it('bleibt von einer Namensänderung unberührt', async () => {
		// Die Momentaufnahme trägt den Namen selbst und hat keinen Fremdschlüssel
		// auf `party`. Hätte sie einen, stünde später der Name von heute darin und
		// nicht der von damals.
		const { versammlung, parteien } = await aufbau(betreiber, 'Namensweg 11');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		await imKontext(betreiber, (tx) => tx`
			UPDATE party SET display_name = 'Anna Neuname' WHERE id = ${parteien[0]}
		`);

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.parties.map((p) => p.displayName)).toContain('Anna Muster');
		expect(m?.parties.map((p) => p.displayName)).not.toContain('Anna Neuname');
	});

	it('lässt sich nicht ändern', async () => {
		// Ein geänderter Wert darin wäre ein Stand, den es nie gab.
		const { versammlung } = await aufbau(betreiber, 'Starrweg 12');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE snapshot_party SET display_name = 'Gefälscht' WHERE meeting_id = ${versammlung}
			`)
		).rejects.toThrow(/denied|verweigert/i);
	});
});

describe('Rücknahme', () => {
	it('verwirft die Momentaufnahme vollständig', async () => {
		const { versammlung } = await aufbau(betreiber, 'Rueckweg 13');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung, 'Traktandum fehlt');

		expect((await holeVersammlung(betreiber, versammlung))?.zustand).toBe('entwurf');
		expect(await holeMomentaufnahme(betreiber, versammlung)).toBeNull();

		const einheiten = await imKontext(betreiber, (tx) => tx`
			SELECT id FROM snapshot_unit WHERE meeting_id = ${versammlung}
		`);
		expect(einheiten).toHaveLength(0);
	});

	it('setzt den Freigabezeitpunkt zurück', async () => {
		const { versammlung } = await aufbau(betreiber, 'Zeitweg 14');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung);
		const zeilen = await imKontext(betreiber, (tx) => tx<{ released_at: Date | null }[]>`
			SELECT released_at FROM meeting WHERE id = ${versammlung}
		`);
		expect(zeilen[0].released_at).toBeNull();
	});

	it('erzeugt bei erneuter Freigabe eine neue Momentaufnahme', async () => {
		const { versammlung, einheiten, gemeinschaft } = await aufbau(betreiber, 'Neuweg 15');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung);

		const kaeufer = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: gemeinschaft,
			kind: 'natural',
			displayName: 'Emil Erneut',
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), einheiten[0], kaeufer.id, '2026-01-01');

		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.parties.map((p) => p.displayName)).toContain('Emil Erneut');
		expect(m?.parties.map((p) => p.displayName)).not.toContain('Anna Muster');
	});

	it('weist die Rücknahme nach der Eröffnung ab', async () => {
		const { versammlung } = await aufbau(betreiber, 'Offenweg 16');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await imKontext(betreiber, (tx) => tx`
			UPDATE meeting SET state = 'laufend', opened_at = now() WHERE id = ${versammlung}
		`);
		await expect(
			nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung)
		).rejects.toThrow(/laufend/);
	});
});

/**
 * Die Rücknahme der Freigabe bei erfasster Vollmacht (Auftrag E).
 *
 * **Die Ursache ist nicht der Fremdschlüssel.** `proxy.represented_id` und
 * `proxy.holder_id` hängen mit `ON DELETE CASCADE` an `snapshot_party`; die
 * Rücknahme löscht die Momentaufnahme und zieht die Vollmacht mit. Was dann
 * greift, ist `proxy_nur_lebensweg` (Migration 036): Jedes `DELETE` auf `proxy`
 * wirft «Vollmachten werden nicht gelöscht (AD-5)». Aus der Rücknahme wird eine
 * rohe Ausnahme, und die Route reicht alles weiter, was kein
 * `FachlicherFehler` ist; die Leitung sieht einen Serverfehler statt eines
 * Satzes. Vor dem Bau sind diese Proben rot.
 */
describe('Die Rücknahme mit einer Vollmacht', () => {
	/** Die Versammlung freigeben und eine Vollmacht auf den verlangten Stand bringen. */
	async function mitVollmacht(
		name: string,
		zustand: 'erfasst' | 'bestaetigt' | 'zurueckgewiesen' | 'widerrufen'
	) {
		const { versammlung } = await aufbau(betreiber, name);
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		const parteien = await holeParteien(betreiber, versammlung);
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: parteien[0].id,
			bevollmaechtigtId: parteien[1].id
		});
		if (zustand === 'bestaetigt' || zustand === 'widerrufen') {
			await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
			await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		}
		if (zustand === 'zurueckgewiesen') {
			await weiseVollmachtZurueck(handelnder(betreiber), versammlung, v.id, 'Nachweis fehlt.');
		}
		if (zustand === 'widerrufen') {
			await widerrufeVollmacht(handelnder(betreiber), versammlung, v.id, 'Doch nicht.');
		}
		return versammlung;
	}

	it('weist die Rücknahme fachlich ab, statt am Auslöser zu scheitern', async () => {
		const versammlung = await mitVollmacht('Vollmachtweg 1', 'erfasst');
		const fehler = await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung).then(
			() => null,
			(e: unknown) => e
		);
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		expect((fehler as FachlicherFehler).kennung).toBe('vollmachten_haengen');
		// Und die Absage lässt den Stand stehen: freigegeben, mit Vollmacht.
		expect((await holeVersammlung(betreiber, versammlung))?.zustand).toBe('freigegeben');
		expect(await holeMomentaufnahme(betreiber, versammlung)).not.toBeNull();
	});

	it.each(['erfasst', 'bestaetigt', 'zurueckgewiesen', 'widerrufen'] as const)(
		'sperrt auch eine Vollmacht im Zustand %s',
		async (zustand) => {
			const versammlung = await mitVollmacht(`Vollmachtzustand ${zustand}`, zustand);
			await expect(
				nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung)
			).rejects.toThrow(FachlicherFehler);
		}
	);

	/*
	 * **Gezählt wird wie in der Schranke** (Nachzug Block 3, Entscheid E vom
	 * 03.10.2026): alle Vollmachten der Versammlung, in jedem Zustand — auch
	 * eine zurückgewiesene oder widerrufene. Die Leitung braucht die Zahl,
	 * bevor sie die erste erfasst, und die Rücknahmeknöpfe hängen daran.
	 */
	it.each(['erfasst', 'bestaetigt', 'zurueckgewiesen', 'widerrufen'] as const)(
		'zählt eine Vollmacht im Zustand %s mit',
		async (zustand) => {
			const versammlung = await mitVollmacht(`Vollmachtzählung ${zustand}`, zustand);
			expect(await zaehleVollmachten(betreiber, versammlung)).toBe(1);
		}
	);

	it('zählt null, solange keine Vollmacht hängt', async () => {
		const { versammlung } = await aufbau(betreiber, 'Vollmachtzählung leer');
		expect(await zaehleVollmachten(betreiber, versammlung)).toBe(0);
	});
});

/**
 * Die Nummer aus der Einladung (Migration 072).
 *
 * **Der Anlass**, am 21.08.2026: Ein Rückkommensantrag wurde im Saal von Platz
 * 9 auf Platz 8 gezogen — und die «Décharge an die Bewirtschaftung» rutschte
 * dabei von 8 auf 9. Die Nummer wurde aus der Position gerechnet; wer
 * verschob, nummerierte um.
 *
 * Produktentscheid: Die Reihenfolge darf sich ändern, die Nummer nicht.
 */
describe('Festgeschriebene Traktandennummern', () => {
	/** Drei Punkte, damit sich beim Verschieben etwas zeigen kann. */
	async function dreiPunkte(kennung: string, datum: string) {
		const s = await aufbau(betreiber, kennung, datum);
		for (const titel of ['Jahresrechnung', 'Décharge an die Bewirtschaftung']) {
			await erstelleTraktandum(handelnder(betreiber), {
				meetingId: s.versammlung,
				titel,
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung'
			});
		}
		return s;
	}

	function beschriftet(liste: Awaited<ReturnType<typeof holeTraktanden>>) {
		return liste.map((t) => `${t.nummer} ${t.knoten.titel}`);
	}

	it('schreibt die Nummern bei der Freigabe fest', async () => {
		const { versammlung } = await dreiPunkte('Nummernweg 20', '2027-09-20');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		// Die Vorlage bringt Pflichttraktanden mit; wie viele es sind, sagt die
		// Liste selbst — festgeschrieben sein müssen ALLE.
		const liste = await holeTraktanden(betreiber, versammlung);
		const zeilen = await imKontext(betreiber, (tx) => tx<{ released_number: string | null }[]>`
			SELECT released_number FROM agenda_item WHERE meeting_id = ${versammlung}
			 ORDER BY position
		`);
		expect(zeilen.filter((z) => z.released_number === null)).toHaveLength(0);
		expect(zeilen.map((z) => z.released_number)).toEqual(liste.map((t) => t.nummer));
	});

	it('lässt die Nummer stehen, wenn ein Punkt vorgezogen wird', async () => {
		const { versammlung } = await dreiPunkte('Nummernweg 21', '2027-09-21');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		const vorher = await holeTraktanden(betreiber, versammlung);
		const letzter = vorher[vorher.length - 1];
		expect(letzter.nummer).toBe(String(vorher.length));

		// Genau der Handgriff des Auftraggebers: den letzten Punkt an den Anfang ziehen.
		await verschiebeTraktandum(handelnder(betreiber), versammlung, {
			id: letzter.knoten.id,
			neuerElternteil: null,
			stelle: 0
		});

		const nachher = await holeTraktanden(betreiber, versammlung);
		// Die Reihenfolge ist neu …
		expect(nachher.map((t) => t.knoten.titel)).toEqual([
			letzter.knoten.titel,
			...vorher.slice(0, -1).map((t) => t.knoten.titel)
		]);
		// … die Nummern sind dieselben wie vorher.
		expect(nachher.map((t) => `${t.nummer} ${t.knoten.titel}`).sort()).toEqual(
			beschriftet(vorher).sort()
		);
	});

	it('rechnet im Entwurf weiter aus der Reihenfolge', async () => {
		// Vor der Freigabe soll es sich umgekehrt verhalten: Wer dort umstellt,
		// erwartet, dass die Nummern nachrücken — eingeladen wurde noch nicht.
		const { versammlung } = await dreiPunkte('Nummernweg 22', '2027-09-22');
		const vorher = await holeTraktanden(betreiber, versammlung);
		const letzter = vorher[vorher.length - 1];
		await verschiebeTraktandum(handelnder(betreiber), versammlung, {
			id: letzter.knoten.id,
			neuerElternteil: null,
			stelle: 0
		});
		const nachher = await holeTraktanden(betreiber, versammlung);
		expect(nachher[0].nummer).toBe('1');
		expect(nachher[0].knoten.titel).toBe(letzter.knoten.titel);
	});

	it('gibt die Nummern beim Zurücknehmen der Freigabe wieder frei', async () => {
		/*
		 * AD-3: verwerfen, nicht fortschreiben. Bliebe ein Rest stehen, trüge die
		 * Liste nach dem zweiten Anlauf zwei Stände nebeneinander — und ein im
		 * Entwurf eingefügtes Traktandum bekäme eine Nummer, die schon vergeben ist.
		 */
		const { versammlung } = await dreiPunkte('Nummernweg 23', '2027-09-23');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), versammlung, 'Punkt fehlt');

		const zeilen = await imKontext(betreiber, (tx) => tx<{ anzahl: number }[]>`
			SELECT count(*)::int AS anzahl FROM agenda_item
			 WHERE meeting_id = ${versammlung} AND released_number IS NOT NULL
		`);
		expect(zeilen[0].anzahl).toBe(0);
	});
});

describe('Zeilenschutz', () => {
	it('gibt einem fremden Betreiber keine Momentaufnahme heraus', async () => {
		const { versammlung } = await aufbau(betreiber, 'Fremdweg 17');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);
		expect(await holeMomentaufnahme(betreiberB, versammlung)).toBeNull();
	});

	it('liefert ohne Mandantenkontext gar nichts', async () => {
		expect(await ohneKontext((tx) => tx`SELECT meeting_id FROM snapshot`)).toHaveLength(0);
		expect(await ohneKontext((tx) => tx`SELECT id FROM snapshot_party`)).toHaveLength(0);
		expect(await ohneKontext((tx) => tx`SELECT id FROM snapshot_unit`)).toHaveLength(0);
	});
});

/**
 * Die Grundlage der Zählweise (Migration 022).
 *
 * Die Zählweise wird seit jeher eingefroren, ihre Fundstelle im Reglement erst
 * jetzt. Der Unterschied zeigt sich erst nachher: Wird die Fundstelle in den
 * Stammdaten berichtigt, stünde in der Auswertung einer längst gehaltenen
 * Versammlung sonst der heutige Beleg — oder gar keiner.
 */
describe('Fundstelle der Zählweise', () => {
	it('friert die Fundstelle mit der Zählweise ein', async () => {
		const { versammlung } = await aufbau(betreiber, 'Belegweg 20', '2026-09-15', {
			headCountMode: 'per_unit',
			headCountRuleSource: 'Art. 28 Abs. 1 Reglement'
		});
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.headCountMode).toBe('per_unit');
		expect(m?.headCountRuleSource).toBe('Art. 28 Abs. 1 Reglement');
	});

	it('lässt eine spätere Berichtigung der Stammdaten unberücksichtigt', async () => {
		// Der eigentliche Punkt: Was in der Auswertung steht, ist die Grundlage von
		// damals und nicht die von heute.
		const { gemeinschaft, versammlung } = await aufbau(betreiber, 'Wandelweg 21', '2026-09-15', {
			headCountMode: 'per_unit',
			headCountRuleSource: 'Ziff. 14.2'
		});
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		await imKontext(betreiber, (tx) => tx`
			UPDATE stweg SET head_count_rule_source = 'Ziff. 99 (neu)' WHERE id = ${gemeinschaft}
		`);

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.headCountRuleSource).toBe('Ziff. 14.2');
	});

	it('hält die fehlende Fundstelle als fehlend fest', async () => {
		// Nicht heimlich mit irgendeinem Wert füllen: Die Auswertung sagt dann
		// ausdrücklich, dass keine vermerkt ist.
		const { versammlung } = await aufbau(betreiber, 'Lueckenweg 22', '2026-09-15', {
			headCountMode: 'per_unit'
		});
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.headCountRuleSource).toBeNull();
	});

	it('führt bei der gesetzlichen Auffangregel keine Fundstelle mit', async () => {
		// Ein Reglementsverweis, der nichts stützt, wäre irreführend.
		const { versammlung } = await aufbau(betreiber, 'Auffangweg 23');
		await gibVersammlungFrei(handelnder(betreiber), versammlung);

		const m = await holeMomentaufnahme(betreiber, versammlung);
		expect(m?.headCountMode).toBe('per_owner');
		expect(m?.headCountRuleSource).toBeNull();
	});
});
