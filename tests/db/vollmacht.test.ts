/**
 * Vertretung und Vollmacht in der Datenbank (FR-23 bis FR-25).
 *
 * Die beiden Abschnitte, auf die es ankommt:
 *
 *   - **«Die Wirkung auf die Anwesenheit»** — eine bestätigte Vollmacht muss
 *     dazu führen, dass die vertretene Partei mit dem Vertreter eintrifft und
 *     mit ihm geht. Ohne sie zählte die Beschlussfähigkeit falsch.
 *   - **«Was die Datenbank nicht zulässt»** — der Auslöser und der eindeutige
 *     Schlüssel. Wer nachträglich einen anderen Vertreter einträgt, verschiebt
 *     eine abgegebene Stimme auf eine andere Person, und niemand sähe es der
 *     Zeile an (AD-5).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibStimmenAb, oeffneAbstimmung } from '$lib/server/abstimmung';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	bestaetigeAnwesenheit,
	erfasseVerlassenDerVersammlung,
	holeUebersicht,
	lasseDurchDritteEin,
	lasseEinMitVertretungen
} from '$lib/server/anwesenheit';
import {
	bestaetigeVollmacht,
	erfasseVollmacht,
	erfasseVollmachten,
	haengeAbgelegtenNachweisAn,
	haengeNachweisAn,
	holeAusuebbare,
	holeParteien,
	holeVollmachten,
	vermerkeVorlage,
	vermerkeVorlageInTx,
	weiseVollmachtZurueck,
	widerrufeVollmacht
} from '$lib/server/vollmacht';
import { ueberschreitungen } from '$lib/domain/vollmacht';
import { nimmMitberechtigtenAuf } from '$lib/server/mitberechtigte';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { FachlicherFehler } from '$lib/domain/fehler';
import { HOECHSTGROESSE } from '$lib/nachweisgrenze';
import { admin, imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/** Das einfache Mehr — die Grundlage jeder gewöhnlichen Abstimmung. */
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

/** Drei Parteien mit je einer Einheit, Versammlung eröffnet. */
async function aufbau(name: string, datum: string, eroeffnen = true) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const parteien: string[] = [];
	for (const [i, wer] of ['Aebi', 'Bucher', 'Christen'].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 300 },
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
		ort: 'Saal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});

	// Ein Traktandum mit Erfordernis, damit sich in den Stimmproben eine
	// Abstimmung eröffnen lässt.
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		titel: 'Antrag',
		art: 'abstimmung',
		antragswortlaut: 'Der Antrag wird angenommen.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, ERFORDERNIS);

	await gibVersammlungFrei(handelnder(betreiber), v.id);
	if (eroeffnen) await eroeffneVersammlung(handelnder(betreiber), v.id);

	// Die Vollmacht hängt an der Zeile der Momentaufnahme, nicht an der Partei.
	const momentparteien = await holeParteien(betreiber, v.id);
	const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;

	return { stwegId: g.id, versammlung: v.id, traktandum: t.id, parteien, nach };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Vollmacht');
});

afterAll(verbindungenSchliessen);

describe('Erst prüfen, dann aktivieren', () => {
	it('erfasst eine Vollmacht als noch nicht wirksam', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 1', '2026-09-01');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		expect(v.zustand).toBe('erfasst');
		expect(v.bevollmaechtigtName).toBe('Bucher');
		expect(v.bestaetigtAm).toBeNull();
	});

	it('bestätigt erst mit Nachweis', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 2', '2026-09-02');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtName: 'Ruth Kunz'
		});
		await expect(
			bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id)
		).rejects.toThrow(/ohne Nachweis/i);

		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		const b = await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		expect(b.zustand).toBe('bestaetigt');
		expect(b.bestaetigtDurch).toBe('Prüflauf');
	});

	it('weist mit Begründung zurück und verlangt sie', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 3', '2026-09-03');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await expect(
			weiseVollmachtZurueck(handelnder(betreiber), versammlung, v.id, '')
		).rejects.toThrow(/begründen/i);

		const z = await weiseVollmachtZurueck(
			handelnder(betreiber),
			versammlung,
			v.id,
			'Die Unterschrift fehlt.'
		);
		expect(z.zustand).toBe('zurueckgewiesen');
		expect(z.beendetGrund).toBe('Die Unterschrift fehlt.');
	});
});

describe('Die Wirkung auf die Anwesenheit', () => {
	it('bringt die vertretene Partei mit, wenn der Vertreter eintrifft', async () => {
		const { versammlung, parteien, nach } = await aufbau('Vollmachtweg 4', '2026-09-04');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);

		// Vor dem Eintreffen ist niemand da — eine bestätigte Vollmacht allein
		// macht keine Anwesenheit.
		let u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(0);

		const e = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			'von_hand'
		);
		expect(e.mitgebracht).toEqual(['Aebi']);

		u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(2);
		expect(u!.kopfstimmenAnwesend).toBe(2);
		const aebi = u!.staende.find((s) => s.name === 'Aebi')!;
		expect(aebi.zustand).toBe('anwesend');
		expect(aebi.weg).toBe('vertretung');
		expect(parteien).toHaveLength(3);
	});

	it('nimmt sie mit, wenn der Vertreter geht', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 5', '2026-09-05');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');

		const g = await erfasseVerlassenDerVersammlung(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId
		);
		expect(g.mitgenommen).toEqual(['Aebi']);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(0);

		// Die Vollmacht bleibt bestehen: Sie ist nicht widerrufen, der Vertreter
		// ist nur nicht mehr da.
		const [nachher] = await holeVollmachten(betreiber, versammlung);
		expect(nachher.zustand).toBe('bestaetigt');
	});

	it('beendet die Vertretung, wenn die vertretene Person selbst erscheint', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 6', '2026-09-06');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);

		const e = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			nach('Aebi').parteiId,
			'von_hand'
		);
		expect(e.vertretungBeendet).toBe('Bucher');

		const [nachher] = await holeVollmachten(betreiber, versammlung);
		expect(nachher.zustand).toBe('widerrufen');
		expect(nachher.beendetGrund).toMatch(/selbst erschienen/i);

		// Und der Vertreter bringt sie danach nicht mehr mit.
		const b = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			'von_hand'
		);
		expect(b.mitgebracht).toEqual([]);
	});

	it('bringt niemanden mit, solange die Vollmacht nur erfasst ist', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 7', '2026-09-07');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		const e = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			'von_hand'
		);
		expect(e.mitgebracht).toEqual([]);
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(1);
	});

	it('bringt sie auch mit, wenn die Vollmacht erst im Saal bestätigt wird', async () => {
		// Der Vertreter ist schon da, die Vollmacht wird nachgeprüft. Ohne einen
		// zweiten Einlass bliebe die vertretene Partei sonst abwesend.
		const { versammlung, nach } = await aufbau('Vollmachtweg 8', '2026-09-08');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');

		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);

		// Ein zweiter Einlass des Vertreters zieht sie nach — das ist der Weg der
		// Sitzungsleitung, wenn jemand mit der Vollmacht in der Hand am Tisch steht.
		const e = await bestaetigeAnwesenheit(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			'von_hand'
		);
		expect(e.neu).toBe(false);
		expect(e.mitgebracht).toEqual(['Aebi']);
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(2);
	});
});

describe('Was die Datenbank nicht zulässt', () => {
	it('lässt keine zweite offene Vollmacht für dieselbe Partei zu', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 9', '2026-09-09');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Aebi').id,
				bevollmaechtigtId: nach('Christen').id
			})
		).rejects.toThrow(/bereits eine offene oder wirksame/i);
	});

	it('lässt nach dem Beenden eine neue zu', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 10', '2026-09-10');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await weiseVollmachtZurueck(handelnder(betreiber), versammlung, v.id, 'Falscher Vertreter.');
		const neu = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Christen').id
		});
		expect(neu.bevollmaechtigtName).toBe('Christen');
	});

	it('ändert nicht, wer wen vertritt', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 11', '2026-09-11');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		// Die Erwartung umschliesst `imKontext`: Ein Fehler bricht die Transaktion
		// ab, und ein Aufruf, der danach noch etwas täte, scheiterte am Abbruch
		// statt an der Regel.
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE proxy SET holder_id = ${nach('Christen').id} WHERE id = ${v.id}`
			)
		).rejects.toThrow(/nicht geändert/i);
	});

	it('löscht keine Vollmacht', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 12', '2026-09-12');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		/*
		 * Über die privilegierte Rolle, weil der Anwendung das Löschrecht seit
		 * Migration 154 fehlt; sie scheiterte schon am Recht und erreichte den
		 * Auslöser nie. Geprüft wird hier der Auslöser, die zweite Schranke:
		 * Er greift auch für den Eigentümer der Tabelle.
		 */
		await expect(admin`DELETE FROM proxy WHERE id = ${v.id}`).rejects.toThrow(/nicht gelöscht/i);
		await expect(
			imKontext(betreiber, (tx) => tx`DELETE FROM proxy WHERE id = ${v.id}`)
		).rejects.toThrow(/denied|verweigert/i);
	});

	it('belebt eine beendete nicht wieder', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 13', '2026-09-13');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await weiseVollmachtZurueck(handelnder(betreiber), versammlung, v.id, 'Ohne Datum.');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE proxy SET state = 'bestaetigt' WHERE id = ${v.id}`)
		).rejects.toThrow(/lebt nicht wieder auf/i);
	});

	it('erfasst nichts vor der Freigabe und nichts nach dem Schluss', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 14', '2026-09-14');
		await schliesseVersammlung(handelnder(betreiber), versammlung);
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Aebi').id,
				bevollmaechtigtId: nach('Bucher').id
			})
		).rejects.toThrow(/geschlossen/i);
	});

	it('nimmt keine Partei einer fremden Versammlung', async () => {
		const a = await aufbau('Vollmachtweg 15a', '2026-09-15');
		const b = await aufbau('Vollmachtweg 15b', '2026-09-16');
		await expect(
			erfasseVollmacht(handelnder(betreiber), a.versammlung, {
				vertreteneId: a.nach('Aebi').id,
				bevollmaechtigtId: b.nach('Bucher').id
			})
		).rejects.toThrow(/nicht stimmberechtigt/i);
	});
});

describe('Eine Vollmacht gehört ihrer Versammlung', () => {
	/*
	 * **Die Kennung kommt aus dem Formular, die Versammlung aus der Adresse.**
	 *
	 * Gefunden am 06.09.2026 im Sicherheitsdurchgang. Alle fünf Handlungen an
	 * einer Vollmacht nehmen beides entgegen, und bis dahin verglich sie
	 * niemand: `nurVorDemSchluss` prüfte die Versammlung aus der Adresse,
	 * geändert wurde die Vollmacht aus dem Formular.
	 *
	 * Das ist keine Formfrage. Die Schranke, die nach dem Schluss jede
	 * Änderung verbietet, war damit umgehbar — es genügte, irgendeine offene
	 * Versammlung als Adresse zu nehmen. Eine Bewirtschaftung führt viele
	 * Gemeinschaften; die Zeilensicherheit trennt Betreiber, nicht die
	 * Versammlungen darunter.
	 *
	 * Die Probe fährt genau den Weg eines gebauten POST: Sie ruft die
	 * Fachfunktionen mit **fremder** Versammlung und derselben Kennung.
	 */
	async function zweiVersammlungen() {
		const zu = await aufbau('Vollmacht fremd A', '2026-09-20');
		const auf = await aufbau('Vollmacht fremd B', '2026-09-21');
		const v = await erfasseVollmacht(handelnder(betreiber), zu.versammlung, {
			vertreteneId: zu.nach('Aebi').id,
			bevollmaechtigtId: zu.nach('Bucher').id
		});
		// Der Nachweis liegt vor: Woran es scheitern soll, ist die Versammlung,
		// nicht der fehlende Nachweis. Sonst prüfte die Probe die falsche Schranke.
		await vermerkeVorlage(handelnder(betreiber), zu.versammlung, v.id);
		await schliesseVersammlung(handelnder(betreiber), zu.versammlung);
		return { zu, auf, vollmacht: v.id };
	}

	it('lässt sich nicht über eine fremde Versammlung bestätigen', async () => {
		const { zu, auf, vollmacht } = await zweiVersammlungen();

		// Über die eigene, geschlossene Versammlung greift die Schranke wie bisher.
		await expect(
			bestaetigeVollmacht(handelnder(betreiber), zu.versammlung, vollmacht)
		).rejects.toThrow(/geschlossen/i);

		// Und über die fremde, offene ebenfalls — das war der Ausweg.
		await expect(
			bestaetigeVollmacht(handelnder(betreiber), auf.versammlung, vollmacht)
		).rejects.toThrow(/gibt es nicht/i);

		const [nachher] = await holeVollmachten(betreiber, zu.versammlung);
		expect(nachher.zustand).toBe('erfasst');
		expect(nachher.bestaetigtAm).toBeNull();
	});

	it('lässt sich über eine fremde Versammlung auch nicht beenden', async () => {
		const { zu, auf, vollmacht } = await zweiVersammlungen();

		await expect(
			weiseVollmachtZurueck(handelnder(betreiber), auf.versammlung, vollmacht, 'Grund')
		).rejects.toThrow(/gibt es nicht/i);
		await expect(
			widerrufeVollmacht(handelnder(betreiber), auf.versammlung, vollmacht, 'Grund')
		).rejects.toThrow(/gibt es nicht/i);

		const [nachher] = await holeVollmachten(betreiber, zu.versammlung);
		expect(nachher.zustand).toBe('erfasst');
		expect(nachher.beendetAm).toBeNull();
	});

	it('nimmt über eine fremde Versammlung weder Vermerk noch Datei an', async () => {
		const { zu, auf, vollmacht } = await zweiVersammlungen();

		// Beide gehen über `holeEine` und scheitern schon am Lesen.
		await expect(
			vermerkeVorlage(handelnder(betreiber), auf.versammlung, vollmacht)
		).rejects.toThrow(/gibt es nicht/i);

		/*
		 * **Eine echte PDF-Datei, keine behauptete.** Der erste Anlauf schickte
		 * `text/plain`, und die Probe wurde grün aus dem falschen Grund: Die
		 * Formatprüfung liegt vor der Versammlungsprüfung und sagte ab, bevor
		 * die geprüfte Schranke überhaupt an die Reihe kam.
		 */
		const inhalt = new TextEncoder().encode('%PDF-1.4\nVollmacht\n%%EOF\n');
		await expect(
			haengeNachweisAn(
				handelnder(betreiber),
				auf.versammlung,
				vollmacht,
				new File([inhalt], 'nachweis.pdf', { type: 'application/pdf' })
			)
		).rejects.toThrow(/gibt es nicht/i);

		const [nachher] = await holeVollmachten(betreiber, zu.versammlung);
		expect(nachher.anzahlDateien).toBe(0);
	});
});

describe('Die Wege ohne Lesevorgang sagen ebenfalls ab', () => {
	/*
	 * **Zwei Wege lesen die Vollmacht nicht.** `vermerkeVorlageInTx` und
	 * `haengeAbgelegtenNachweisAn` schreiben direkt, und der Einlass mit
	 * Vertretungen ruft sie so. Der Lesegatter in `holeEine` schützt sie
	 * deshalb nicht.
	 *
	 * Der Code-Review vom 06.09.2026 hat sie gefunden, und er hat zugleich
	 * gefunden, warum die erste Fassung dieser Prüfungen fehlte: Der
	 * Drehbuchschritt oben ruft `vermerkeVorlage` — die liest sehr wohl. Der
	 * Kommentar behauptete das Gegenteil, und damit belegten die Prüfungen
	 * dieselbe Schranke zweimal statt zwei verschiedene.
	 *
	 * Beide Wege müssen **absagen**, nicht bloss nichts tun: Ein `UPDATE` ohne
	 * getroffene Zeile sieht von aussen aus wie ein erfolgreiches, und der
	 * Verlaufseintrag dahinter behauptete dann eine Vorlage, die es nicht gab.
	 */
	it('vermerkt keine Vorlage an einer fremden Vollmacht', async () => {
		const zu = await aufbau('Vollmacht ohne Lesen A', '2026-09-22');
		const auf = await aufbau('Vollmacht ohne Lesen B', '2026-09-23');
		const v = await erfasseVollmacht(handelnder(betreiber), zu.versammlung, {
			vertreteneId: zu.nach('Aebi').id,
			bevollmaechtigtId: zu.nach('Bucher').id
		});

		await expect(
			imKontext(betreiber, (tx) =>
				vermerkeVorlageInTx(tx, handelnder(betreiber), auf.versammlung, v.id)
			)
		).rejects.toThrow(/gibt es nicht/i);

		const [nachher] = await holeVollmachten(betreiber, zu.versammlung);
		expect(nachher.nachweisVorgelegt).toBe(false);
	});

	it('hängt keine abgelegte Datei an eine fremde Vollmacht', async () => {
		const zu = await aufbau('Vollmacht ohne Lesen C', '2026-09-24');
		const auf = await aufbau('Vollmacht ohne Lesen D', '2026-09-25');
		const v = await erfasseVollmacht(handelnder(betreiber), zu.versammlung, {
			vertreteneId: zu.nach('Aebi').id,
			bevollmaechtigtId: zu.nach('Bucher').id
		});

		await expect(
			imKontext(betreiber, (tx) =>
				haengeAbgelegtenNachweisAn(tx, handelnder(betreiber), auf.versammlung, v.id, {
					pruefsumme: 'a'.repeat(64),
					name: 'nachweis.pdf',
					art: 'application/pdf',
					groesse: 42
				})
			)
		).rejects.toThrow(/gibt es nicht/i);

		const [nachher] = await holeVollmachten(betreiber, zu.versammlung);
		expect(nachher.anzahlDateien).toBe(0);
	});
});

describe('Der Verlauf', () => {
	it('hält jeden Schritt fest', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 16', '2026-09-17');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await widerrufeVollmacht(handelnder(betreiber), versammlung, v.id, 'Vollmacht zurückgezogen.');

		const arten = await imKontext(betreiber, async (tx) => {
			const zeilen = await tx<{ event_type: string }[]>`
				SELECT event_type FROM audit_entry
				WHERE subject_type = 'proxy' AND subject_id = ${v.id}
				ORDER BY occurred_at, id
			`;
			return zeilen.map((z) => z.event_type);
		});
		expect(arten).toEqual([
			'proxy.recorded',
			'proxy.proof.added',
			'proxy.confirmed',
			'proxy.revoked'
		]);
	});
});

describe('Einlass mit Vollmachten in einem Zug', () => {
	it('erfasst, belegt, bestätigt und lässt ein — alles auf einmal', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 17', '2026-09-18');

		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			{ vertritt: [nach('Aebi').id, nach('Christen').id], nachweisVorgelegt: true }
		);

		expect(e.vollmachten.sort()).toEqual(['Aebi', 'Christen']);
		expect([...(e.mitgebracht ?? [])].sort()).toEqual(['Aebi', 'Christen']);

		// Alle drei sind anwesend, und zwei davon durch Vertretung.
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(3);
		expect(u!.staende.filter((s) => s.weg === 'vertretung')).toHaveLength(2);

		const vollmachten = await holeVollmachten(betreiber, versammlung);
		expect(vollmachten).toHaveLength(2);
		expect(vollmachten.every((v) => v.zustand === 'bestaetigt')).toBe(true);
		expect(vollmachten.every((v) => v.nachweisVorgelegt)).toBe(true);
	});

	/*
	 * **Höchstens fünf Nachweise je Absenden** (Produktentscheid 16.10.2026,
	 * Auftrag Abschluss, B3). Und eine zu grosse Datei ist eine Absage mit
	 * Satz, kein `DateiFehler`: Den übersetzen die Einlasswege nicht, er endete
	 * dort als Fehlerseite.
	 */
	const pdf = (n: number) =>
		new File([new TextEncoder().encode(`%PDF-1.4\nSeite ${n}\n%%EOF\n`)], `seite-${n}.pdf`, {
			type: 'application/pdf'
		});

	it('weist mehr als fünf Nachweise ab, bevor etwas geschieht', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 61', '2026-09-28');
		const versuch = lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true,
			dateien: [1, 2, 3, 4, 5, 6].map(pdf)
		});
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toThrow(/Höchstens 5 Dateien/);
		expect((await holeUebersicht(betreiber, versammlung))!.anzahlAnwesend).toBe(0);
		expect(await holeVollmachten(betreiber, versammlung)).toEqual([]);
	});

	it('nimmt genau fünf Nachweise an', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 62', '2026-09-29');
		await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: false,
			dateien: [1, 2, 3, 4, 5].map(pdf)
		});
		const [v] = await holeVollmachten(betreiber, versammlung);
		expect(v.anzahlDateien).toBe(5);
	});

	it('weist auch bei der Vertretung durch Dritte mehr als fünf ab', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 63', '2026-09-30');
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Erfundene Vertreterin',
				vertritt: [nach('Aebi').id],
				nachweisVorgelegt: true,
				dateien: [1, 2, 3, 4, 5, 6].map(pdf)
			})
		).rejects.toThrow(/Höchstens 5 Dateien/);
		expect((await holeUebersicht(betreiber, versammlung))!.anzahlAnwesend).toBe(0);
	});

	it('sagt zu einer zu grossen Datei einen Satz statt der Fehlerseite', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 64', '2026-10-01');
		const gross = new File([new Uint8Array(HOECHSTGROESSE + 1)], 'scan.pdf', { type: 'application/pdf' });
		const versuch = lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true,
			dateien: [gross]
		});
		await expect(versuch).rejects.toBeInstanceOf(FachlicherFehler);
		await expect(versuch).rejects.toThrow(/grösser als 10 MB/);
	});

	it('lässt ohne Vollmachten ganz normal ein', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 18', '2026-09-19');
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			{ vertritt: [], nachweisVorgelegt: false }
		);
		expect(e.neu).toBe(true);
		expect(e.vollmachten).toEqual([]);
		expect(await holeVollmachten(betreiber, versammlung)).toEqual([]);
	});

	it('weist den ganzen Vorgang ab, wenn der Nachweis fehlt', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 19', '2026-09-20');
		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
				vertritt: [nach('Aebi').id],
				nachweisVorgelegt: false
			})
		).rejects.toThrow(/Ohne Nachweis/i);

		// Und zwar wirklich der ganze Vorgang: Auch die Anwesenheit entsteht nicht.
		// Ein halb erledigter Einlass fiele im Saal niemandem auf.
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(0);
	});

	it('lässt niemanden zweimal ein, zieht die Vertretenen aber nach', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 20', '2026-09-21');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');

		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			{ vertritt: [nach('Aebi').id], nachweisVorgelegt: true }
		);
		expect(e.neu).toBe(false);
		expect(e.mitgebracht).toEqual(['Aebi']);
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(2);
	});

	it('bricht ab, wenn eine der Parteien schon vertreten wird — ohne halbe Wirkung', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 21', '2026-09-22');
		// Christen ist bereits durch Aebi vertreten.
		const bestehend = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Christen').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		expect(bestehend.zustand).toBe('erfasst');

		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
				vertritt: [nach('Christen').id],
				nachweisVorgelegt: true
			})
		).rejects.toThrow(/bereits eine offene oder wirksame/i);

		// Die Transaktion ist zurückgerollt: keine Anwesenheit, keine zweite
		// Vollmacht, und die bestehende ist unverändert.
		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(0);
		const vollmachten = await holeVollmachten(betreiber, versammlung);
		expect(vollmachten).toHaveLength(1);
		expect(vollmachten[0].zustand).toBe('erfasst');
	});
});

describe('Eine beendete Vertretung nimmt die Anwesenheit mit', () => {
	it('lässt die vertretene Partei gehen, wenn sie nur durch die Vertretung da war', async () => {
		// Gefunden am 04.08.2026: Vorher blieb sie als anwesend stehen, obwohl
		// niemand mehr ihre Stimme ausübte — die Beschlussfähigkeit rechnete sie
		// weiter mit.
		const { versammlung, nach } = await aufbau('Vollmachtweg 22', '2026-09-23');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');
		expect((await holeUebersicht(betreiber, versammlung))!.anzahlAnwesend).toBe(2);

		await widerrufeVollmacht(handelnder(betreiber), versammlung, v.id, 'Vollmacht zurückgezogen.');

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(1);
		expect(u!.staende.find((s) => s.name === 'Aebi')!.zustand).toBe('gegangen');
		// Der Vertreter selbst bleibt, wo er ist.
		expect(u!.staende.find((s) => s.name === 'Bucher')!.zustand).toBe('anwesend');
	});

	it('lässt eine selbst erschienene Partei anwesend', async () => {
		// Hier beendet das eigene Eintreffen die Vertretung — die Anwesenheit
		// beginnt gerade, sie endet nicht.
		const { versammlung, nach } = await aufbau('Vollmachtweg 23', '2026-09-24');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');

		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Aebi').parteiId, 'von_hand');

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.staende.find((s) => s.name === 'Aebi')!.zustand).toBe('anwesend');
		expect(u!.anzahlAnwesend).toBe(2);
	});

	it('lässt für eine anwesende Partei gar keine Vollmacht mehr zu', async () => {
		// Hinweis des Auftraggebers vom 04.08.2026: Wer selbst im Saal steht, übt selbst aus.
		// Eine Vollmacht darüber endete im selben Augenblick wieder (FR-25) — sie
		// anzulegen führte in die Irre, statt zu helfen.
		const { versammlung, nach } = await aufbau('Vollmachtweg 24', '2026-09-25');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Aebi').parteiId, 'von_hand');
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Aebi').id,
				bevollmaechtigtId: nach('Bucher').id
			})
		).rejects.toThrow(/bereits anwesend/i);
	});
});

describe('Eine dritte Person übt eine Vollmacht aus', () => {
	it('lässt die vertretene Partei ein, nicht die Person', async () => {
		// Die Lücke, die das schliesst: Eine dritte Person ist keine Partei, kann
		// nicht «eintreffen» — und so kam die vertretene Partei nie in den Saal.
		const { versammlung, nach } = await aufbau('Vollmachtweg 25', '2026-09-26');

		const e = await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Ruth Kunz',
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true
		});
		expect(e.eingelassen).toEqual(['Aebi']);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.anzahlAnwesend).toBe(1);
		const aebi = u!.staende.find((s) => s.name === 'Aebi')!;
		expect(aebi.zustand).toBe('anwesend');
		expect(aebi.weg).toBe('vertretung');

		const [v] = await holeVollmachten(betreiber, versammlung);
		expect(v.zustand).toBe('bestaetigt');
		expect(v.bevollmaechtigtId).toBeNull();
		expect(v.bevollmaechtigtName).toBe('Ruth Kunz');
	});

	it('bestätigt eine schon erfasste Vollmacht, statt eine zweite anzulegen', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 26', '2026-09-27');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtName: 'Ruth Kunz'
		});

		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Ruth Kunz',
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true
		});

		const vollmachten = await holeVollmachten(betreiber, versammlung);
		expect(vollmachten).toHaveLength(1);
		expect(vollmachten[0].zustand).toBe('bestaetigt');
	});

	it('weist ab, wenn dieselbe Partei schon jemand anderes vertritt', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 27', '2026-09-28');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Ruth Kunz',
				vertritt: [nach('Aebi').id],
				nachweisVorgelegt: true
			})
		).rejects.toThrow(/wird bereits durch/i);
	});

	it('nimmt mehrere Vertretene in einem Vorgang', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 28', '2026-09-29');
		const e = await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Ruth Kunz',
			vertritt: [nach('Aebi').id, nach('Christen').id],
			nachweisVorgelegt: true
		});
		expect(e.eingelassen.sort()).toEqual(['Aebi', 'Christen']);
		expect((await holeUebersicht(betreiber, versammlung))!.anzahlAnwesend).toBe(2);
	});

	it('lässt die Vollmacht bestehen, wenn die vertretene Partei nicht selbst kommt', async () => {
		// Gegenprobe zum Fallstrick: Von Hand erfassen hiesse «selbst erschienen»
		// und beendete die Vollmacht. Dieser Weg tut das ausdrücklich nicht.
		const { versammlung, nach } = await aufbau('Vollmachtweg 29', '2026-09-30');
		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Ruth Kunz',
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true
		});
		const [v] = await holeVollmachten(betreiber, versammlung);
		expect(v.zustand).toBe('bestaetigt');
		expect(v.beendetGrund).toBeNull();
	});

	it('verlangt einen Namen und mindestens eine vertretene Partei', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 30', '2026-10-01');
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'K',
				vertritt: [nach('Aebi').id],
				nachweisVorgelegt: true
			})
		).rejects.toThrow(/Name/i);
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Ruth Kunz',
				vertritt: [],
				nachweisVorgelegt: true
			})
		).rejects.toThrow(/wen diese Person vertritt/i);
	});
});


describe('Was die Auswahl gar nicht erst zulässt', () => {
	it('nimmt keine Vollmacht für eine bereits anwesende Partei', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 31', '2026-10-02');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Christen').parteiId, 'von_hand');
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtName: 'Ruth Kunz'
			})
		).rejects.toThrow(/bereits anwesend/i);
	});

	it('lässt eine selbst vertretene Partei keine Vollmacht ausüben', async () => {
		// Wer sich vertreten lässt, ist nicht da — und wer nicht da ist, kann für
		// niemanden die Hand heben.
		const { versammlung, nach } = await aufbau('Vollmachtweg 32', '2026-10-03');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Christen').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);

		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Aebi').id,
				bevollmaechtigtId: nach('Bucher').id
			})
		).rejects.toThrow(/wird selbst durch/i);
	});

	it('lässt eine eben eingetroffene Partei sofort wieder Vollmachten halten', async () => {
		// Die Reihenfolge im Einlass: erst die eigene Vertretung beenden, dann die
		// mitgebrachten Vollmachten. Andersherum wiese die Prüfung genau die
		// Person ab, die eben zur Tür hereinkam.
		const { versammlung, nach } = await aufbau('Vollmachtweg 33', '2026-10-04');
		const eigene = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Christen').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, eigene.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, eigene.id);

		// Bucher kommt doch — und bringt die Vollmacht von Aebi mit.
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			{ vertritt: [nach('Aebi').id], nachweisVorgelegt: true }
		);
		expect(e.vertretungBeendet).toBe('Christen');
		expect(e.vollmachten).toEqual(['Aebi']);

		const u = await holeUebersicht(betreiber, versammlung);
		expect(u!.staende.find((s) => s.name === 'Bucher')!.zustand).toBe('anwesend');
		expect(u!.staende.find((s) => s.name === 'Aebi')!.zustand).toBe('anwesend');
	});
});

describe('Wer vom eigenen Gerät für andere stimmt', () => {
	it('gibt der bevollmächtigten Person ihre eigene Partei und die vertretenen', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 34', '2026-10-05');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);

		const ausuebbar = await holeAusuebbare(betreiber, versammlung, nach('Bucher').parteiId);
		expect(ausuebbar.map((a) => a.name)).toEqual(['Bucher', 'Aebi']);
		expect(ausuebbar[0].eigene).toBe(true);
		expect(ausuebbar[1].eigene).toBe(false);
	});

	it('gibt eine bloss erfasste Vollmacht nicht frei', async () => {
		// Erfasst überträgt nichts (FR-24). Ein Knopf, der eine Stimme abgäbe, die
		// nachher nicht zählt, wäre schlimmer als keiner.
		const { versammlung, nach } = await aufbau('Vollmachtweg 35', '2026-10-06');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		const ausuebbar = await holeAusuebbare(betreiber, versammlung, nach('Bucher').parteiId);
		expect(ausuebbar.map((a) => a.name)).toEqual(['Bucher']);
	});

	it('gibt nach dem Beenden nichts mehr frei', async () => {
		const { versammlung, nach } = await aufbau('Vollmachtweg 36', '2026-10-07');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await widerrufeVollmacht(handelnder(betreiber), versammlung, v.id, 'Zurückgezogen.');

		const ausuebbar = await holeAusuebbare(betreiber, versammlung, nach('Bucher').parteiId);
		expect(ausuebbar.map((a) => a.name)).toEqual(['Bucher']);
	});

	it('hält an der Stimme fest, wer sie ausgeübt hat', async () => {
		// FR-56: Im Streitfall hängt an dieser Angabe die Vertretungsmacht.
		const { versammlung, nach, traktandum } = await aufbau('Vollmachtweg 37', '2026-10-08');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi').id,
			bevollmaechtigtId: nach('Bucher').id
		});
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');

		await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
		await oeffneAbstimmung(handelnder(betreiber), versammlung, traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			versammlung,
			[
				{ parteiId: nach('Bucher').parteiId, wahl: 'yes' },
				{ parteiId: nach('Aebi').parteiId, wahl: 'no', ausgeuebtVon: nach('Bucher').id }
			],
			false
		);

		const zeilen = await imKontext(betreiber, async (tx) => {
			return tx<{ name: string; durch: string | null; choice: string }[]>`
				SELECT p.display_name AS name, a.display_name AS durch, v.choice
				FROM vote v
				JOIN snapshot_party p ON p.id = v.snapshot_party_id
				LEFT JOIN snapshot_party a ON a.id = v.cast_by_party_id
				WHERE v.round_id = (SELECT id FROM voting_round WHERE meeting_id = ${versammlung} AND state = 'offen')
				ORDER BY p.display_name
			`;
		});
		expect(zeilen).toEqual([
			{ name: 'Aebi', durch: 'Bucher', choice: 'no' },
			{ name: 'Bucher', durch: null, choice: 'yes' }
		]);
	});

	it('lässt niemanden für sich selbst als Vertretung eintragen', async () => {
		const { versammlung, nach, traktandum } = await aufbau('Vollmachtweg 38', '2026-10-09');
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Bucher').parteiId, 'von_hand');
		// Christen dazu, sonst ist die Versammlung nicht beschlussfähig (Ä-18).
		await bestaetigeAnwesenheit(handelnder(betreiber), versammlung, nach('Christen').parteiId, 'von_hand');
		await stelleAufTraktandum(handelnder(betreiber), versammlung, traktandum);
		await oeffneAbstimmung(handelnder(betreiber), versammlung, traktandum);
		await expect(
			imKontext(betreiber, async (tx) => {
				const [runde] = await tx<{ id: string }[]>`
					SELECT id FROM voting_round WHERE meeting_id = ${versammlung} AND state = 'offen'
				`;
				const [einheit] = await tx<{ id: string }[]>`
					SELECT id FROM snapshot_unit WHERE snapshot_party_id = ${nach('Bucher').id} LIMIT 1
				`;
				return tx`
					INSERT INTO vote (operator_id, round_id, snapshot_party_id, snapshot_unit_id, choice,
					                  cast_by_party_id)
					VALUES (${betreiber}, ${runde.id}, ${nach('Bucher').id}, ${einheit.id}, 'yes',
					        ${nach('Bucher').id})
				`;
			})
		).rejects.toThrow();
	});
});

describe('Die Grenze des Reglements', () => {
	/*
	 * **Sie sperrt, seit dem 24.09.2026, und zwar beim Erfassen.**
	 *
	 * Produktentscheid im Wortlaut: «Wenn nämlich ein Beschluss zustande kommt,
	 * weil das Reglement nicht eingehalten wird, könnte der Beschluss seine
	 * Gültigkeit verlieren (nichtig oder ungültig) und das Protokoll wird
	 * anfechtbar.» Vorher wurde nur auf der Vollmachtenseite gewarnt, und die
	 * Auszählung wusste von der Grenze nichts — die überzählige Stimme zählte
	 * voll mit.
	 */
	async function mitGrenze(hoechstzahl: number, name: string, datum: string) {
		const auf = await aufbau(name, datum);
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE stweg SET proxy_limit = ${hoechstzahl},
				                 proxy_limit_rule_source = 'Reglement Ziff. 8.2'
				WHERE id = ${auf.stwegId}
			`
		);
		return auf;
	}

	it('lässt die Vollmacht bis zur Grenze zu', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze eins', '2027-09-01');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		expect(v.bevollmaechtigtName).toBe('Aebi');
	});

	it('weist die überzählige Vollmacht ab und nennt die Fundstelle', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze zwei', '2027-09-02');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtId: nach('Aebi').id
			})
		).rejects.toThrow(/wäre die 2\. für Aebi.*Reglement Ziff\. 8\.2/s);
	});

	/*
	 * **Der Weg, den die Maske wirklich benutzt.** Die Erfassungsseite ruft die
	 * Mehrzahl auf, nicht die Einzahl. Eine Schranke, die nur in der Einzahl
	 * sässe, wäre im gebrauchten Weg nicht durchgesetzt und der Prüflauf bliebe
	 * grün. Beide laufen durch `erfasseInTx`, und weil das in **einer**
	 * Transaktion geschieht, zählt die zweite die erste schon mit.
	 */
	it('greift auch beim Erfassen mehrerer auf einmal, und legt dann keine an', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze drei', '2027-09-03');
		await expect(
			erfasseVollmachten(handelnder(betreiber), versammlung, {
				bevollmaechtigtId: nach('Aebi').id,
				vertritt: [nach('Bucher').id, nach('Christen').id]
			})
		).rejects.toThrow(/wäre die 2\. für Aebi/);
		// In einer Transaktion: Bricht die zweite ab, entsteht auch die erste
		// nicht. Sonst stünde die Hälfte da, und niemand sähe der Liste an, welche.
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);
	});

	it('zählt die dritte Person unter demselben Namen mit', async () => {
		// Wie `ueberschreitungen`: über den angezeigten Namen, nicht über die
		// Kennung. Sonst ergäben Warnung und Sperre zwei Zahlen für dieselbe Lage.
		const { versammlung, nach } = await mitGrenze(1, 'Grenze vier', '2027-09-04');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Aebi'
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtId: nach('Aebi').id
			})
		).rejects.toThrow(/wäre die 2\. für Aebi/);
	});

	/*
	 * **Die Schreibweise darf die Sperre nicht öffnen** (Sicherheitsprüfung vom
	 * 24.09.2026, Befund 1).
	 *
	 * Der Name einer dritten Person ist Freitext, auch auf dem Eigentümerpfad
	 * `/z`, der ohne Benutzerkonto erreichbar ist. Gezählt wurde über die exakte
	 * Zeichenkette: «Aebi», «aebi» und «Hans  Aebi» waren drei Zählgruppen. Und
	 * weil `ueberschreitungen` denselben Schlüssel bildete, blieb die Umgehung
	 * **auch ohne Warnung** — die überzähligen Stimmen zählten voll mit.
	 */
	it('lässt sich nicht über Gross- und Kleinschreibung umgehen', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze fünf', '2027-09-06');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Aebi'
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtName: 'aebi'
			})
		).rejects.toThrow(/wäre die 2\./);
	});

	it('lässt sich nicht über doppelte Leerzeichen umgehen', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze sechs', '2027-09-07');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Hans Aebi'
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtName: 'Hans  Aebi'
			})
		).rejects.toThrow(/wäre die 2\./);
	});

	/*
	 * **Das geschützte Leerzeichen** (zweiter Code-Review vom 24.09.2026,
	 * Befund 1). Die erste Behebung bildete die Normalisierung in SQL nach, und
	 * genau daran ist sie gescheitert: `\s` heisst in JavaScript und in Postgres
	 * nicht dasselbe. Postgres behält U+00A0, JavaScript macht ein gewöhnliches
	 * Leerzeichen daraus — nachgemessen als Hex am lebenden System. Wer die erste
	 * Vollmacht so erfasste und die zweite normal, kam durch, und zwar beliebig
	 * oft, weil es viele solche Zeichen gibt.
	 *
	 * Gezählt wird deshalb nur noch an **einer** Stelle, im Kern. Diese Probe ist
	 * der Nachweis, dass keine zweite Umsetzung zurückkommt.
	 */
	it('lässt sich nicht über ein geschütztes Leerzeichen umgehen', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze sieben', '2027-09-10');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Hans\u00A0Aebi'
		});
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Christen').id,
				bevollmaechtigtName: 'Hans Aebi'
			})
		).rejects.toThrow(/wäre die 2\./);
	});

	it('gruppiert in der Warnung genauso wie in der Sperre', async () => {
		/*
		 * **Der eigentliche Nachweis dieses Befundes.** Nicht, dass die Sperre
		 * greift, sondern dass beide Zählungen dieselbe Gruppe bilden: Sagte die
		 * Warnung «zwei Personen mit je einer Vollmacht», wo die Sperre «eine
		 * Person mit zwei» sieht, hätte die Anwendung wieder zwei Zahlen für
		 * dieselbe Lage — und die Leitung glaubte der harmloseren.
		 *
		 * Die zweite Vollmacht entsteht deshalb ohne Grenze und wird erst danach
		 * hinterlegt; anders liesse sie sich gar nicht mehr anlegen.
		 */
		const { versammlung, stwegId, nach } = await aufbau('Warnung gruppiert', '2027-09-08');
		for (const [wer, name] of [
			['Bucher', 'Hans Aebi'],
			['Christen', 'hans  aebi']
		] as const) {
			await erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach(wer).id,
				bevollmaechtigtName: name
			});
		}
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE stweg SET proxy_limit = 1, proxy_limit_rule_source = 'Reglement Ziff. 8.2'
				WHERE id = ${stwegId}
			`
		);
		const w = ueberschreitungen(
			await holeVollmachten(betreiber, versammlung),
			{ hoechstzahl: 1, fundstelle: 'Reglement Ziff. 8.2' }
		);
		expect(w).toHaveLength(1);
		expect(w[0].anzahl).toBe(2);
		// Angezeigt wird die Schreibweise, die zuerst vorkam, nicht der
		// kleingeschriebene Schlüssel.
		expect(w[0].bevollmaechtigt).toBe('Hans Aebi');
	});

	/*
	 * **Der Weg, an dem am meisten hängt** (Code-Review vom 24.09.2026,
	 * Befund 2). `erfasseInTx` hat fünf Aufrufer, nicht drei: dazu kommen
	 * `lasseEinMitVertretungen` und `lasseDurchDritteEin` aus `anwesenheit.ts`.
	 * Dort entstehen Vollmachten und Einlass in **einer** Transaktion.
	 *
	 * Die Sperre wirft also mitten im Einlass, und dann entsteht nichts: Auch
	 * die Person selbst kommt nicht in den Saal. Das ist richtig so — eine halb
	 * ausgeführte Aufnahme wäre schlimmer —, aber es gehört gemessen und
	 * beschrieben, statt sich am Versammlungsabend zu zeigen. Der Weg zurück ist
	 * einfach: noch einmal einlassen, ohne die überzählige Vollmacht.
	 */
	it('rollt beim Einlass alles zurück, auch den Einlass selbst', async () => {
		const { versammlung, stwegId, nach } = await aufbau('Grenze am Einlass', '2027-09-09');
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE stweg SET proxy_limit = 1, proxy_limit_rule_source = 'Reglement Ziff. 8.2'
				WHERE id = ${stwegId}
			`
		);
		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
				vertritt: [nach('Aebi').id, nach('Christen').id],
				nachweisVorgelegt: true
			})
		).rejects.toThrow(/wäre die 2\. für Bucher/);

		// Nichts entstanden: keine Vollmacht, und Bucher steht nicht im Saal.
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);
		expect((await holeUebersicht(betreiber, versammlung))!.anzahlAnwesend).toBe(0);

		// Und der Weg zurück trägt: ohne die überzählige geht es.
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Bucher').parteiId,
			{ vertritt: [nach('Aebi').id], nachweisVorgelegt: true }
		);
		expect(e.vollmachten).toEqual(['Aebi']);
	});

	/*
	 * **Ä-28: Wer von Gesetzes wegen vertritt, zählt nicht mit.**
	 *
	 * Die Zweitprüfung vom 17.09.2026 nimmt Organvertreter juristischer
	 * Personen, gesetzliche Vertreter und Mitberechtigte von der Höchstzahl aus.
	 * Ohne diese Ausnahme wiese die Sperre eine rechtlich einwandfreie
	 * Vertretung ab, und zwar ohne Weg daran vorbei.
	 */
	it('lässt die Vertretung von Gesetzes wegen über die Grenze hinaus zu', async () => {
		const { versammlung, nach } = await mitGrenze(1, 'Grenze acht', '2027-09-11');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Zemp'
		});
		const zweite = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Christen').id,
			bevollmaechtigtName: 'Zemp',
			vertretungsgrund: 'organ'
		});
		expect(zweite.vertretungsgrund).toBe('organ');
	});

	it('zählt sie auch im Bestand nicht mit', async () => {
		// Die Gegenrichtung: Liegt schon eine Vertretung von Gesetzes wegen vor,
		// darf sie die gewöhnliche Vollmacht nicht aufbrauchen.
		const { versammlung, nach } = await mitGrenze(1, 'Grenze neun', '2027-09-12');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Zemp',
			vertretungsgrund: 'gesetzlich'
		});
		const zweite = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Christen').id,
			bevollmaechtigtName: 'Zemp'
		});
		expect(zweite.vertretungsgrund).toBeNull();
	});

	it('lässt alle drei Gründe auch bei einer Partei der Versammlung zu', async () => {
		/*
		 * **Hier stand bis zum 24.09.2026 das Gegenteil**, und die Probe
		 * zementierte eine Absage, die eine zulässige Erfassung verhinderte
		 * (Code-Review desselben Tages, B3). Wer als Organ handelt, ist keine
		 * Eigentümerin der **vertretenen** Einheit — eine eigene kann sie sehr
		 * wohl besitzen. Die Geschäftsführerin der GmbH, der Wohnung 5 gehört,
		 * wohnt selbst in Wohnung 3.
		 *
		 * Der damalige Ausweg machte es schlimmer: Als dritte Person erfasst,
		 * verliert die Zeile die Verknüpfung zur Partei, und im Protokoll bleibt
		 * die eigene Zeile dieser Person leer, während sie im Saal steht und
		 * zwei Stimmen führt.
		 */
		const { versammlung, nach } = await mitGrenze(1, 'Grenze zehn', '2027-09-13');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Aebi').id,
			vertretungsgrund: 'organ'
		});
		expect(v.vertretungsgrund).toBe('organ');
		// Und die Verknüpfung zur Partei bleibt erhalten — das ist der Punkt.
		expect(v.bevollmaechtigtId).toBe(nach('Aebi').id);
	});

	it('weist einen erfundenen Grund ab', async () => {
		// Die Datenbank prüft dasselbe (Migration 120). Hier misst die Probe,
		// dass die Meldung vorher einen Satz nennt und keine Regelverletzung.
		const { versammlung, nach } = await aufbau('Grund erfunden', '2027-09-16');
		await expect(
			erfasseVollmacht(handelnder(betreiber), versammlung, {
				vertreteneId: nach('Bucher').id,
				bevollmaechtigtName: 'Zemp',
				vertretungsgrund: 'erfunden' as never
			})
		).rejects.toThrow(/keiner der drei zulässigen/);
	});

	it('reicht den Grund auch am Einlasstisch durch', async () => {
		/*
		 * **Der Weg, den man beim Arbeiten in `vollmacht.ts` übersieht.** Das Feld
		 * ist an `Vollmachtseingabe` freiwillig; wer es in `anwesenheit.ts`
		 * vergässe, bekäme still die Vorgabe «gewöhnliche Vollmacht», und die
		 * Typprüfung bliebe grün. Genau dort taucht ein Organvertreter aber auf.
		 */
		const { versammlung, stwegId, nach } = await aufbau('Einlass Ä-28', '2027-09-14');
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE stweg SET proxy_limit = 1, proxy_limit_rule_source = 'Reglement Ziff. 8.2'
				WHERE id = ${stwegId}
			`
		);
		/*
		 * **Seit dem 03.11.2026 gilt ein Grund nur für eine Partei**
		 * (Produktentscheid). Hier stand bis dahin die Erwartung, dass «Organ»
		 * alle drei Vertretenen aus der Höchstzahl nimmt; genau das war der
		 * Fehler: Wer für die eigene Firma kam, nahm fremde Vollmachten mit.
		 */
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Zemp',
				vertritt: [nach('Aebi').id, nach('Bucher').id, nach('Christen').id],
				nachweisVorgelegt: true,
				vertretungsgrund: 'organ'
			})
		).rejects.toThrow(/nur für eine einzige Partei/);
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);

		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Zemp',
			vertritt: [nach('Aebi').id],
			nachweisVorgelegt: true,
			vertretungsgrund: 'organ'
		});
		const alle = await holeVollmachten(betreiber, versammlung);
		expect(alle).toHaveLength(1);
		expect(alle[0].vertretungsgrund).toBe('organ');
	});

	it('lässt den Grund nachträglich nicht mehr ändern', async () => {
		/*
		 * **Der Befund, der mir am wichtigsten war** (Code-Review vom 24.09.2026,
		 * B6). Migration 036 zählt die unveränderlichen Spalten einzeln auf und
		 * kannte die neue nicht. Eine überzählige gewöhnliche Vollmacht liesse
		 * sich sonst nachträglich zur Organvertretung machen: Die Sperre hatte
		 * sie schon passiert, die Warnung verstummte, und die Zeile sähe danach
		 * aus wie immer. Migration 121 zieht das nach.
		 */
		const { versammlung, nach } = await aufbau('WORM Ä-28', '2027-09-15');
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtName: 'Zemp'
		});
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE proxy SET representation_basis = 'organ' WHERE id = ${v.id}`
			)
		).rejects.toThrow(/Wer wen vertritt, wird nicht geändert/);
	});

	it('schreibt den Grund in den Protokollentwurf', async () => {
		/*
		 * **Der Durchstich, den die Domänenprobe nicht leistet** (Code-Review vom
		 * 24.09.2026, B4). Jene übergibt den fertigen Satz «Zemp (Organ …)» an
		 * `protokollentwurf` und prüft, dass er wieder herauskommt — sie wäre im
		 * Altzustand grün gewesen und sagt über diesen Block nichts.
		 *
		 * Zusammengesetzt wird der Satz eine Ebene höher, in
		 * `stelleEntwurfZusammen`, und dieser Weg war ungeprüft. Er geht hier
		 * über den **Einlass**, weil eine Vollmacht allein niemanden in den Saal
		 * lässt: Wer nicht eingelassen ist, steht unter «Nicht erschienen», und
		 * dort trägt die Zeile keine Vertretung.
		 */
		const { versammlung, nach } = await aufbau('Protokoll Ä-28', '2027-09-17');
		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Zemp',
			vertritt: [nach('Bucher').id],
			nachweisVorgelegt: true,
			vertretungsgrund: 'organ'
		});

		const entwurf = await stelleEntwurfZusammen(
			betreiber,
			versammlung,
			'2027-09-17T20:00:00.000Z',
			'Prüflauf'
		);
		expect(entwurf).toContain('vertreten durch Zemp (Organ einer juristischen Person)');
	});

	it('prüft nichts, wo keine Grenze hinterlegt ist', async () => {
		// Das Gesetz kennt keine Obergrenze; ohne Reglementswert gibt es nichts
		// durchzusetzen (ZGB Art. 712o schweigt dazu).
		const { versammlung, nach } = await aufbau('Ohne Grenze', '2027-09-05');
		await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Bucher').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		const zweite = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Christen').id,
			bevollmaechtigtId: nach('Aebi').id
		});
		expect(zweite.bevollmaechtigtName).toBe('Aebi');
	});
});

/*
 * **Mitberechtigte an gemeinschaftlichem Eigentum** (Produktentscheid
 * 03.11.2026, Fachprüfung F1 in zwei Runden). Die Domänenproben messen die
 * Regeln; diese messen den Weg: dass `erfasseInTx` die Mitgliedschaft aus
 * `party_member` liest, dass der Einlass den Nachweis je Vertretung verlangt,
 * dass der Vermerk über den Verlauf wieder herauskommt und im Protokoll steht.
 *
 * Aufbau: Aebi, Bucher, Christen, Dürr je mit eigener Wohnung; Whg 5 gehört
 * der gemeinschaftlichen Zeile «Aebi und Bucher», mit beiden als
 * Mitberechtigten. Christen ist nicht mitberechtigt.
 */
describe('Mitberechtigte (Produktentscheid 03.11.2026)', () => {
	async function aufbauMitHuelle(name: string, datum: string, hoechstzahl: number | null) {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name,
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const ids = new Map<string, string>();
		for (const [i, wer] of ['Aebi', 'Bucher', 'Christen', 'Dürr'].entries()) {
			const e = await erstelleEinheit(handelnder(betreiber), {
				stwegId: g.id,
				kind: 'unit',
				label: `Whg ${i + 1}`,
				quotas: { stamm: 200 },
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
			ids.set(wer, p.id);
		}
		const whg5 = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: 'Whg 5',
			quotas: { stamm: 200 },
			countsAsHead: true
		});
		const huelle = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: 'Aebi und Bucher',
			isCommunity: true,
			representativeName: 'Aebi'
		});
		await ordneEigentumZu(handelnder(betreiber), whg5.id, huelle.id, '2020-01-01');
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, ids.get('Aebi')!);
		await nimmMitberechtigtenAuf(handelnder(betreiber), huelle.id, ids.get('Bucher')!);
		if (hoechstzahl !== null) {
			await imKontext(
				betreiber,
				(tx) => tx`
					UPDATE stweg SET proxy_limit = ${hoechstzahl},
					                 proxy_limit_rule_source = 'Reglement Ziff. 8.2'
					WHERE id = ${g.id}
				`
			);
		}
		const v = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: g.id,
			datum,
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await gibVersammlungFrei(handelnder(betreiber), v.id);
		await eroeffneVersammlung(handelnder(betreiber), v.id);
		const momentparteien = await holeParteien(betreiber, v.id);
		const nach = (wer: string) => momentparteien.find((p) => p.name === wer)!;
		return { versammlung: v.id, nach };
	}

	it('leitet «mitberechtigt» je Vertretener her: Hülle frei, drei fremde zählen', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt eins', '2027-11-01', 3);
		const e = await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi').parteiId, {
			vertritt: [nach('Aebi und Bucher').id, nach('Bucher').id, nach('Christen').id, nach('Dürr').id],
			nachweisVorgelegt: true,
			vertretungsgrund: null
		});
		expect(e.vollmachten).toHaveLength(4);
		const alle = await holeVollmachten(betreiber, versammlung);
		const huelle = alle.find((v) => v.vertreteneName === 'Aebi und Bucher')!;
		expect(huelle.vertretungsgrund).toBe('mitberechtigt');
		expect(huelle.mitberechtigung).toBe('eingetragen');
		// Kein Blatt behauptet, das es nicht gibt: Das vorbelegte Häkchen galt
		// den drei fremden Vollmachten.
		expect(huelle.nachweisVorgelegt).toBe(false);
		const fremde = alle.filter((v) => v.vertreteneName !== 'Aebi und Bucher');
		expect(fremde.every((v) => v.vertretungsgrund === null && v.nachweisVorgelegt)).toBe(true);
	});

	it('zählt die drei fremden trotzdem zur Höchstzahl', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt zwei', '2027-11-02', 2);
		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi').parteiId, {
				vertritt: [nach('Aebi und Bucher').id, nach('Bucher').id, nach('Christen').id, nach('Dürr').id],
				nachweisVorgelegt: true,
				vertretungsgrund: null
			})
		).rejects.toThrow(/wäre die 3\. für Aebi/);
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);
	});

	it('lässt die eingetragene Mitberechtigte ohne Nachweis ein', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt drei', '2027-11-03', null);
		const e = await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi').parteiId, {
			vertritt: [nach('Aebi und Bucher').id],
			nachweisVorgelegt: false,
			vertretungsgrund: null
		});
		expect(e.vollmachten).toEqual(['Aebi und Bucher']);
		// Und eine fremde daneben verlangt ihn weiterhin.
		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Christen').parteiId, {
				vertritt: [nach('Dürr').id],
				nachweisVorgelegt: false,
				vertretungsgrund: null
			})
		).rejects.toThrow(/Ohne Nachweis keine Vollmacht/);
	});

	it('nimmt «nicht eingetragen» von Hand für die Hülle an, bestätigt aber nur mit Nachweis', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt vier', '2027-11-04', null);
		const v = await erfasseVollmacht(handelnder(betreiber), versammlung, {
			vertreteneId: nach('Aebi und Bucher').id,
			bevollmaechtigtId: nach('Christen').id,
			vertretungsgrund: 'mitberechtigt'
		});
		expect(v.mitberechtigung).toBe('nicht_eingetragen');
		// Über den Verlauf wieder gelesen, nicht nur aus dem Rückgabewert.
		const gelesen = (await holeVollmachten(betreiber, versammlung)).find((x) => x.id === v.id)!;
		expect(gelesen.mitberechtigung).toBe('nicht_eingetragen');
		await expect(bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id)).rejects.toThrow(
			/Nachweis der Mitberechtigung/
		);
		await vermerkeVorlage(handelnder(betreiber), versammlung, v.id);
		const b = await bestaetigeVollmacht(handelnder(betreiber), versammlung, v.id);
		expect(b.zustand).toBe('bestaetigt');
	});

	it('lässt «nicht im Register» für eine Einzelperson zu, bestätigt aber nur mit Nachweis', async () => {
		/*
		 * Der Erbfall bei Alleineigentum (Fachprüfung 03.11.2026, C6): Dürr ist
		 * verstorben, die Erbin kommt als dritte Person mit Erbbescheinigung.
		 * Bis dahin stand hier die Absage «keine gemeinschaftliche Einheit».
		 */
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt fünf', '2027-11-05', null);
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Zaugg',
				vertritt: [nach('Dürr').id],
				nachweisVorgelegt: false,
				vertretungsgrund: 'mitberechtigt'
			})
		).rejects.toThrow(/Nachweis der Mitberechtigung/);
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);
		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Zaugg',
			vertritt: [nach('Dürr').id],
			nachweisVorgelegt: true,
			vertretungsgrund: 'mitberechtigt'
		});
		const [v] = await holeVollmachten(betreiber, versammlung);
		expect(v.vertretungsgrund).toBe('mitberechtigt');
		expect(v.mitberechtigung).toBe('nicht_eingetragen');
		expect(v.zustand).toBe('bestaetigt');
	});

	it('weist jeden Grund von Hand mit mehreren Vertretenen ab', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt sechs', '2027-11-06', null);
		await expect(
			erfasseVollmachten(handelnder(betreiber), versammlung, {
				bevollmaechtigtId: nach('Christen').id,
				vertritt: [nach('Aebi und Bucher').id, nach('Dürr').id],
				vertretungsgrund: 'mitberechtigt'
			})
		).rejects.toThrow(/nur für eine einzige Partei/);
		await expect(
			lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Christen').parteiId, {
				vertritt: [nach('Aebi').id, nach('Dürr').id],
				nachweisVorgelegt: true,
				vertretungsgrund: 'organ'
			})
		).rejects.toThrow(/nur für eine einzige Partei/);
		expect(await holeVollmachten(betreiber, versammlung)).toHaveLength(0);
	});

	it('lässt eine dritte Person nur mit Nachweis der Mitberechtigung ein und vermerkt es im Protokoll', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt sieben', '2027-11-07', null);
		await expect(
			lasseDurchDritteEin(handelnder(betreiber), versammlung, {
				bevollmaechtigtName: 'Zaugg',
				vertritt: [nach('Aebi und Bucher').id],
				nachweisVorgelegt: false,
				vertretungsgrund: 'mitberechtigt'
			})
		).rejects.toThrow(/Nachweis der Mitberechtigung/);
		await lasseDurchDritteEin(handelnder(betreiber), versammlung, {
			bevollmaechtigtName: 'Zaugg',
			vertritt: [nach('Aebi und Bucher').id],
			nachweisVorgelegt: true,
			vertretungsgrund: 'mitberechtigt'
		});
		const entwurf = await stelleEntwurfZusammen(
			betreiber,
			versammlung,
			'2027-11-07T20:00:00.000Z',
			'Prüflauf'
		);
		expect(entwurf).toContain(
			'vertreten durch Zaugg (mitberechtigt an derselben Einheit, nicht als Mitberechtigte ' +
				'im Register eingetragen, Nachweis der Mitberechtigung)'
		);
	});

	it('sagt der Leitung, wenn eine zweite Mitberechtigte eintrifft', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt acht', '2027-11-08', null);
		const erste = await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi').parteiId, {
			vertritt: [nach('Aebi und Bucher').id],
			nachweisVorgelegt: false,
			vertretungsgrund: null
		});
		expect(erste.mitberechtigte).toEqual([]);
		const zweite = await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, {
			vertritt: [],
			nachweisVorgelegt: false,
			vertretungsgrund: null
		});
		expect(zweite.mitberechtigte).toHaveLength(1);
		expect(zweite.mitberechtigte[0]).toContain('die Stimme führt zurzeit Aebi');
		expect(zweite.mitberechtigte[0]).toMatch(/Die anwesenden Mitberechtigten bestimmen/);
	});

	/*
	 * **Der Hinweis nur, wenn wirklich eine zweite Mitberechtigte da ist**
	 * (Codeprüfung 03.11.2026, M1). Die erste Fassung gab ihn beim zweiten
	 * Einlesen derselben Karte und immer dann, wenn der Eintritt der
	 * gemeinsamen Partei irgendeine Vollmacht beendete.
	 */
	it('schweigt, wenn die Karte der gemeinsamen Partei eine Nachbar-Vollmacht beendet', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt neun', '2027-11-09', null);
		await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Christen').parteiId, {
			vertritt: [nach('Aebi und Bucher').id],
			nachweisVorgelegt: true,
			vertretungsgrund: null
		});
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Aebi und Bucher').parteiId,
			{ vertritt: [], nachweisVorgelegt: false, vertretungsgrund: null }
		);
		expect(e.vertretungBeendet).toBe('Christen');
		expect(e.mitberechtigte).toEqual([]);
	});

	it('schweigt, wenn dieselbe Karte zweimal eingelesen wird', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt zehn', '2027-11-10', null);
		const ohne = { vertritt: [], nachweisVorgelegt: false, vertretungsgrund: null };
		await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi und Bucher').parteiId, ohne);
		const zweimal = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Aebi und Bucher').parteiId,
			ohne
		);
		expect(zweimal.neu).toBe(false);
		expect(zweimal.mitberechtigte).toEqual([]);
	});

	it('meldet, wenn die Karte die Stimmführung einer Mitberechtigten ablöst', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt elf', '2027-11-11', null);
		await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Aebi').parteiId, {
			vertritt: [nach('Aebi und Bucher').id],
			nachweisVorgelegt: false,
			vertretungsgrund: null
		});
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Aebi und Bucher').parteiId,
			{ vertritt: [], nachweisVorgelegt: false, vertretungsgrund: null }
		);
		expect(e.vertretungBeendet).toBe('Aebi');
		expect(e.mitberechtigte).toHaveLength(1);
	});

	it('meldet, wenn bei der Karte schon eine Mitberechtigte mit eigener Einheit da ist', async () => {
		const { versammlung, nach } = await aufbauMitHuelle('Mitberechtigt zwölf', '2027-11-12', null);
		const ohne = { vertritt: [], nachweisVorgelegt: false, vertretungsgrund: null };
		await lasseEinMitVertretungen(handelnder(betreiber), versammlung, nach('Bucher').parteiId, ohne);
		const e = await lasseEinMitVertretungen(
			handelnder(betreiber),
			versammlung,
			nach('Aebi und Bucher').parteiId,
			ohne
		);
		expect(e.mitberechtigte).toHaveLength(1);
	});
});
