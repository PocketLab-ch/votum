/**
 * Welche Rückgabe von `nimmImSaalAuf` als stehende Warnung reist und welche
 * als Quittung (Codeprüfung Teil 2 zum Nachtrag, 06.10.2026; Auftrag
 * «votum-hinweise-lesbar», Teil 4).
 *
 * **Die Regel:** Verlangt der Text eine Handlung vor der Abstimmung (das Mehr
 * fehlt noch, die Betroffenen sind nicht eingetragen), reist der ganze Text
 * als `warnung`, und `hinweis` fehlt. Sonst `hinweis`, und `warnung` fehlt.
 * Die Seite zeigt `hinweis` in der Quittungsecke, die nach sechs Sekunden
 * räumt; ein Satz, der etwas verlangt, war dann weg, bevor ihn jemand las.
 *
 * Gemessen wird das Feld, nicht der Wortlaut: Die Sätze blieben, wie sie
 * waren. Deshalb prüft jede Probe beide Felder, das eine gesetzt, das andere
 * leer. Gegen den alten Stand werden die vier Warnfälle rot, die Gegenfälle
 * bleiben grün.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import { speichereAusnahmen } from '$lib/server/ausnahmen';
import { holeBetroffene, trageBetroffeneEin } from '$lib/server/betroffene';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { holeTraktanden } from '$lib/server/traktanden';
import { nimmImSaalAuf } from '$lib/server/saalaufnahme';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

function erfordernisVon(knotenId: string): Erfordernis {
	const e = waehleErfordernis(holeRegelwerk(), knotenId).ergebnis;
	if (!e) throw new Error(`Knoten ${knotenId} liefert in der geltenden Fassung kein Erfordernis`);
	return e;
}

/** Nutzungsrechte zuteilen (ZGB Art. 712g Abs. 4): verlangt die Zustimmung Betroffener. */
const NUTZUNGSRECHT = 'k-nutzungsrecht-zuteilung';
/** Das einfache Mehr; es verlangt keine Zustimmung. */
const GEWOEHNLICH = 'k-verwaltung-gewoehnlich';

/**
 * Eine laufende Versammlung mit vier Parteien, alle anwesend, und drei
 * angekündigten Traktanden zur Abstimmung:
 *
 * - `mitMehr`: Nutzungsrecht, das Mehr steht schon in der Einladung (also mit
 *   Untergrenze); es ist aufgerufen, damit sich Betroffene eintragen lassen;
 * - `ohneMehr`: ohne jedes Mehr;
 * - `mehrImSaal`: Nutzungsrecht, das Mehr erst nach der Eröffnung gesetzt,
 *   also ohne Untergrenze (Migration 144); ein Folgeantrag darunter darf das
 *   einfache Mehr wählen.
 *
 * Das Reglement gestattet Beschlüsse über nicht Angekündigtes, damit ein
 * neues Geschäft zur Abstimmung aufgenommen werden kann (Migration 127).
 */
async function laufend(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	await speichereAusnahmen(handelnder(betreiber), g.id, {
		reglementGestattet: true,
		reglementFundstelle: 'Art. 99 Prüfreglement'
	});
	const parteien: string[] = [];
	for (let i = 1; i <= 4; i++) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i}`,
			quotas: { stamm: 250 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `Prüfpartei ${i}`,
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
	const traktandum = (titel: string) =>
		erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel}: Wortlaut für den Prüflauf.`,
			antragstellerart: 'bewirtschaftung'
		});
	const mitMehr = await traktandum('Nutzungsrecht am Prüfgarten');
	const ohneMehr = await traktandum('Ersatz der Prüfbriefkästen');
	const mehrImSaal = await traktandum('Nutzungsrecht am Prüfkeller');
	await haltErfordernisAmTraktandumFest(
		handelnder(betreiber),
		v.id,
		mitMehr.id,
		erfordernisVon(NUTZUNGSRECHT)
	);
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	await haltErfordernisAmTraktandumFest(
		handelnder(betreiber),
		v.id,
		mehrImSaal.id,
		erfordernisVon(NUTZUNGSRECHT)
	);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	await trageBetroffeneEin(handelnder(betreiber), v.id, mitMehr.id, [parteien[3]]);
	await stelleAufTraktandum(handelnder(betreiber), v.id, mitMehr.id);
	return {
		versammlung: v.id,
		mitMehr: mitMehr.id,
		ohneMehr: ohneMehr.id,
		mehrImSaal: mehrImSaal.id,
		parteien
	};
}

/** Das Formular eines Folgeantrags, wie die Leitungsseite es schickt. */
function folgeantrag(
	grundantrag: string,
	titel: string,
	u: { erfordernis?: string; betroffene?: string[] } = {}
) {
	const f = new FormData();
	f.set('spontanart', 'folgeantrag');
	f.set('grundantrag', grundantrag);
	f.set('art', 'abstimmung');
	f.set('titel', titel);
	f.set('antragswortlaut', `${titel}: Wortlaut für den Prüflauf.`);
	if (u.erfordernis) f.set('erfordernis', u.erfordernis);
	for (const b of u.betroffene ?? []) f.append('betroffene', b);
	return f;
}

/** Das Formular eines neuen Geschäfts. */
function neuesGeschaeft(titel: string, art: 'abstimmung' | 'kenntnisnahme', erfordernis = '') {
	const f = new FormData();
	f.set('spontanart', 'neu');
	f.set('art', art);
	f.set('titel', titel);
	f.set('antragswortlaut', `${titel}: Wortlaut für den Prüflauf.`);
	if (erfordernis) f.set('erfordernis', erfordernis);
	return f;
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Saalaufnahme Warnung');
	benutzer = await pruefbenutzer(betreiber, 'saalwarnungsleitung');
});

afterAll(verbindungenSchliessen);

describe('Ein Satz mit Handlung vor der Abstimmung reist als Warnung', () => {
	it('beim neuen Geschäft ohne Mehr: der ganze Text als Warnung, keine Quittung', async () => {
		const s = await laufend('Prüfhaus Saalwarnung 1', '2027-12-01');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			neuesGeschaeft('Anschaffung einer Prüfleiter', 'abstimmung'),
			'versammlung'
		);
		// Quittung und Handlungssatz zusammen, in einem Feld.
		expect(auf.warnung).toBe(
			'«Anschaffung einer Prüfleiter» ist zur Abstimmung aufgenommen, gestützt auf das ' +
				'Reglement. Vor der Abstimmung fehlt noch das Mehrheitserfordernis. Setzen Sie es mit ' +
				'«Erfordernis setzen» am Traktandum.'
		);
		expect(auf.hinweis).toBeUndefined();
	});

	it('beim Folgeantrag ohne gewähltes Mehr', async () => {
		const s = await laufend('Prüfhaus Saalwarnung 2', '2027-12-02');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			folgeantrag(s.ohneMehr, 'Nur defekte Prüfbriefkästen'),
			'versammlung'
		);
		expect(auf.warnung).toBe(
			'«Nur defekte Prüfbriefkästen» ist als Folgeantrag aufgenommen. Er stützt sich auf das ' +
				'angekündigte Traktandum, unter dem er steht. Vor der Abstimmung fehlt noch das ' +
				'Mehrheitserfordernis. Setzen Sie es mit «Erfordernis setzen» in seiner Zeile.'
		);
		expect(auf.hinweis).toBeUndefined();
	});

	it('beim Folgeantrag ohne Mehr und mit gewählten Betroffenen', async () => {
		const s = await laufend('Prüfhaus Saalwarnung 3', '2027-12-03');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			folgeantrag(s.ohneMehr, 'Prüfbriefkästen mit Paketfach', { betroffene: [s.parteien[0]] }),
			'versammlung'
		);
		expect(auf.warnung).toContain('Vor der Abstimmung fehlt noch das Mehrheitserfordernis.');
		expect(auf.warnung).toContain(
			'Verlangt der Inhalt des Folgeantrags die Zustimmung der im Formular ausgewählten Betroffenen'
		);
		expect(auf.warnung).toContain('gespeichert sind sie noch nicht.');
		expect(auf.hinweis).toBeUndefined();
	});

	it('beim Folgeantrag, dessen Mehr keine Zustimmung verlangt, mit gewählten Betroffenen', async () => {
		// Nur dieser Satz verlangt die Handlung: Das Mehr ist gesetzt, der
		// Mehr-Satz fehlt also. Ohne den Betroffenensatz wäre es eine Quittung.
		const s = await laufend('Prüfhaus Saalwarnung 4', '2027-12-04');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			folgeantrag(s.mehrImSaal, 'Prüfkeller nur bis 2030', {
				erfordernis: GEWOEHNLICH,
				betroffene: [s.parteien[3]]
			}),
			'versammlung'
		);
		expect(auf.warnung).toContain('«Prüfkeller nur bis 2030» ist als Folgeantrag aufgenommen.');
		expect(auf.warnung).toContain('verlangt keine Zustimmung von Betroffenen. Prüfen Sie das Erfordernis');
		expect(auf.warnung).not.toContain('fehlt noch das Mehrheitserfordernis');
		expect(auf.hinweis).toBeUndefined();
		expect(await holeBetroffene(betreiber, s.versammlung, auf.traktandumId)).toEqual([]);
	});
});

describe('Ohne Handlung bleibt es die Quittung', () => {
	it('beim neuen Geschäft mit gewähltem Mehr', async () => {
		const s = await laufend('Prüfhaus Saalwarnung 5', '2027-12-05');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			neuesGeschaeft('Anschaffung eines Prüfschranks', 'abstimmung', GEWOEHNLICH),
			'versammlung'
		);
		expect(auf.hinweis).toBe(
			'«Anschaffung eines Prüfschranks» ist zur Abstimmung aufgenommen, gestützt auf das Reglement.'
		);
		expect(auf.warnung).toBeUndefined();
	});

	it('beim Folgeantrag unter einem Grundantrag mit Mehr, ohne eigene Wahl: es wird nicht geerbt', async () => {
		/*
		 * Produktentscheid 08.10.2026: Der Folgeantrag erbt das Erfordernis
		 * nicht mehr. Trägt der Grundantrag eines, steht der Folgeantrag ohne
		 * eigenes da, bis die Leitung es wählt oder herleitet — damit trägt der
		 * Verlauf die richtige Quelle statt eines «gewählt», das niemand wählte.
		 */
		const s = await laufend('Prüfhaus Saalwarnung 6', '2027-12-06');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			folgeantrag(s.mitMehr, 'Prüfgarten nur bis 2030', { betroffene: [s.parteien[3]] }),
			'versammlung'
		);
		expect(auf.warnung).toContain('Vor der Abstimmung fehlt noch das Mehrheitserfordernis.');
		expect(auf.warnung).not.toContain('wurde übernommen');
		const traktanden = await holeTraktanden(betreiber, s.versammlung);
		const folge = traktanden.find((t) => t.knoten.titel === 'Prüfgarten nur bis 2030');
		expect(folge?.knoten.erfordernis).toBeNull();
	});

	it('bei der Kenntnisnahme', async () => {
		const s = await laufend('Prüfhaus Saalwarnung 7', '2027-12-07');
		const auf = await nimmImSaalAuf(
			handelnder(betreiber),
			s.versammlung,
			neuesGeschaeft('Bericht zum Prüfdach', 'kenntnisnahme'),
			'versammlung'
		);
		expect(auf.hinweis).toBe('«Bericht zum Prüfdach» ist zur Kenntnisnahme aufgenommen.');
		expect(auf.warnung).toBeUndefined();
	});
});
