/**
 * Eine hinterlegte Abweichung ändern (03.09.2026, Punkt 3 der sechs zur
 * Reglementsseite).
 *
 * Geändert werden konnte eine Regel schon vorher: Der Anlegeweg trägt auf dem
 * Schlüssel aus Gemeinschaft, Geschäftsart und Fall ein
 * `ON CONFLICT ... DO UPDATE`. Was fehlte, war ein Weg dorthin und die
 * Unterscheidung im Verlauf. Hier steht, was der neue Schreibweg zusichert und
 * was er verweigert.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import {
	aendereReglementsregelAn,
	erstelleReglementsregel,
	holeReglementsregeln
} from '$lib/server/reglement';
import { imKontext, pruefbetreiber, verbindungenSchliessen } from './helfer';
import type { ReglementsregelEingabe } from '$lib/domain/reglement';
import { FachlicherFehler } from '$lib/domain/fehler';

let betreiberA: string;
let betreiberB: string;
let stwegA: string;
let stwegB: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

/**
 * `jahresgeschaefte` mit Absicht: Die Art hat fünf freie Fälle
 * (`k-jahresrechnung`, `k-erneuerungsfonds-errichten`, `k-erneuerungsfonds`,
 * `k-decharge`, `k-prozessfuehrung`; das Errichten seit der Fassung 2026-11-18). Nur damit lässt sich prüfen, was beim Verschieben auf
 * einen belegten und auf einen freien Schlüssel geschieht.
 */
function regel(
	stwegId: string,
	aenderung: Partial<ReglementsregelEingabe> = {}
): ReglementsregelEingabe {
	return {
		stwegId,
		geschaeftsart: 'jahresgeschaefte',
		knotenId: 'k-jahresrechnung',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Reglement Ziff. 12.3',
		enthaltungZaehltMit: true,
		...aenderung
	};
}

/** Die Eingabe ohne die Gemeinschaft — so nimmt sie der Änderungsweg. */
function ohneStweg(e: ReglementsregelEingabe): Omit<ReglementsregelEingabe, 'stwegId'> {
	const { stwegId: _weg, ...rest } = e;
	return rest;
}

async function aenderungen(operatorId: string, stwegId: string) {
	return imKontext(
		operatorId,
		(tx) => tx`
			SELECT detail FROM audit_entry
			 WHERE event_type = 'bylaw.rule.changed' AND subject_id = ${stwegId}
			 ORDER BY id
		`
	);
}

beforeAll(async () => {
	betreiberA = await pruefbetreiber('Regeländerung A');
	betreiberB = await pruefbetreiber('Regeländerung B');
	const a = await erstelleGemeinschaft(handelnder(betreiberA), {
		name: 'Änderungsweg 1',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const b = await erstelleGemeinschaft(handelnder(betreiberB), {
		name: 'Fremdweg 9',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stwegA = a.id;
	stwegB = b.id;
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Ändern statt aufheben und neu anlegen', () => {
	it('behält die Kennung und schreibt die neuen Werte', async () => {
		const vorher = await erstelleReglementsregel(handelnder(betreiberA), regel(stwegA));

		const { regel: nachher, geaendert } = await aendereReglementsregelAn(
			handelnder(betreiberA),
			stwegA,
			vorher.id,
			ohneStweg(
				regel(stwegA, {
					kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mehr_als' },
					fundstelle: 'Reglement Ziff. 12.9'
				})
			)
		);

		expect(geaendert).toBe(true);
		// **Die Kennung ist der Faden.** Aufheben und neu anlegen zerreisst ihn:
		// Der Verlauf sprach danach über zwei Regeln, wo eine berichtigt wurde.
		expect(nachher.id).toBe(vorher.id);

		const gespeichert = (await holeReglementsregeln(betreiberA, stwegA)).find(
			(r) => r.id === vorher.id
		);
		expect(gespeichert?.kopfSchwelle).toEqual({ zaehler: 3, nenner: 4, art: 'mehr_als' });
		expect(gespeichert?.fundstelle).toBe('Reglement Ziff. 12.9');
	});

	it('hält im Verlauf fest, was vorher dastand', async () => {
		const r = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { knotenId: 'k-decharge', fundstelle: 'Reglement Ziff. 30' })
		);
		await aendereReglementsregelAn(
			handelnder(betreiberA),
			stwegA,
			r.id,
			ohneStweg(
				regel(stwegA, {
					knotenId: 'k-decharge',
					fundstelle: 'Reglement Ziff. 31',
					kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
				})
			)
		);

		const eintraege = await aenderungen(betreiberA, stwegA);
		const letzter = eintraege[eintraege.length - 1].detail as {
			felder: string[];
			vorher: Record<string, string>;
			nachher: Record<string, string>;
		};
		expect(letzter.felder.sort()).toEqual(['fundstelle', 'kopf', 'kopfart']);
		expect(letzter.vorher).toMatchObject({ kopf: '2/3', fundstelle: 'Reglement Ziff. 30' });
		expect(letzter.nachher).toMatchObject({ kopf: '1/2', fundstelle: 'Reglement Ziff. 31' });
	});

	it('sieht auch eine Änderung, die nur die Enthaltung betrifft', async () => {
		// Der Grund für diesen Test: Führte die Merkmalsliste bloss Schwelle und
		// Fundstelle, liefe genau diese Änderung als «nichts geändert» durch —
		// und sie entscheidet über Annahme oder Ablehnung.
		const r = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { knotenId: 'k-prozessfuehrung', fundstelle: 'Reglement Ziff. 40' })
		);
		const { geaendert } = await aendereReglementsregelAn(
			handelnder(betreiberA),
			stwegA,
			r.id,
			ohneStweg(
				regel(stwegA, {
					knotenId: 'k-prozessfuehrung',
					fundstelle: 'Reglement Ziff. 40',
					enthaltungZaehltMit: false
				})
			)
		);

		expect(geaendert).toBe(true);
		const eintraege = await aenderungen(betreiberA, stwegA);
		const letzter = eintraege[eintraege.length - 1].detail as { felder: string[] };
		expect(letzter.felder).toEqual(['enthaltung']);
	});

	it('schreibt kein Ereignis, wenn nichts geändert wurde', async () => {
		const eingabe = regel(stwegA, {
			knotenId: 'k-erneuerungsfonds',
			fundstelle: 'Reglement Ziff. 50'
		});
		const r = await erstelleReglementsregel(handelnder(betreiberA), eingabe);
		const davor = (await aenderungen(betreiberA, stwegA)).length;

		const { geaendert } = await aendereReglementsregelAn(
			handelnder(betreiberA),
			stwegA,
			r.id,
			ohneStweg(eingabe)
		);

		expect(geaendert).toBe(false);
		// Ein Eintrag «geändert: nichts» wäre Rauschen im Beleg, den der Verlauf
		// darstellen soll.
		expect((await aenderungen(betreiberA, stwegA)).length).toBe(davor);
	});
});

describe('Was der Änderungsweg verweigert', () => {
	/*
	 * **Die Nachbargemeinschaft desselben Betreibers ist der eigentliche Fall**
	 * (03.09.2026, aus der Defektprobe).
	 *
	 * Der erste Anlauf dieses Tests nahm einen fremden **Betreiber** — und blieb
	 * gruen, als die Zugehoerigkeitspruefung ausgebaut wurde: Dort greift schon
	 * der Zeilenschutz, die Zeile ist fuer den anderen Betreiber gar nicht da.
	 * Bewacht war damit die Datenbank, nicht der neue Weg. Innerhalb eines
	 * Betreibers sieht die Abfrage die Zeile sehr wohl, und genau hier hat am
	 * 26.08.2026 der Aufhebeweg eine fremde Regel gefunden und geloescht.
	 */
	it('weist die Regel der Nachbargemeinschaft desselben Betreibers ab', async () => {
		const nachbar = await erstelleGemeinschaft(handelnder(betreiberA), {
			name: 'Nachbarweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const fremd = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { knotenId: null, fundstelle: 'Reglement Ziff. 60' })
		);

		await expect(
			aendereReglementsregelAn(
				handelnder(betreiberA),
				nachbar.id,
				fremd.id,
				ohneStweg(regel(nachbar.id, { knotenId: null, fundstelle: 'Nachbar Ziff. 1' }))
			)
		).rejects.toThrow(/gehört nicht zu dieser Gemeinschaft/);

		// Und sie steht unverändert da.
		const gespeichert = (await holeReglementsregeln(betreiberA, stwegA)).find(
			(r) => r.id === fremd.id
		);
		expect(gespeichert?.fundstelle).toBe('Reglement Ziff. 60');
	});

	it('findet die Regel eines fremden Betreibers gar nicht', async () => {
		const beiA = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { geschaeftsart: 'organe', knotenId: null, fundstelle: 'Reglement Ziff. 70' })
		);

		await expect(
			aendereReglementsregelAn(
				handelnder(betreiberB),
				stwegB,
				beiA.id,
				ohneStweg(regel(stwegB, { geschaeftsart: 'organe', knotenId: null, fundstelle: 'F 1' }))
			)
		).rejects.toThrow(FachlicherFehler);

		const gespeichert = (await holeReglementsregeln(betreiberA, stwegA)).find(
			(r) => r.id === beiA.id
		);
		expect(gespeichert?.fundstelle).toBe('Reglement Ziff. 70');
	});

	it('verdrängt keine andere Regel, wenn der Zielschlüssel belegt ist', async () => {
		const eine = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { knotenId: 'k-jahresrechnung', fundstelle: 'Ziff. A' })
		);
		const andere = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { knotenId: 'k-decharge', fundstelle: 'Ziff. B' })
		);

		await expect(
			aendereReglementsregelAn(
				handelnder(betreiberA),
				stwegA,
				eine.id,
				ohneStweg(regel(stwegA, { knotenId: 'k-decharge', fundstelle: 'Ziff. A' }))
			)
		).rejects.toThrow(/schon eine andere Abweichung/);

		// **Die eigentliche Zusicherung:** Ohne die Prüfung hätte das
		// `ON CONFLICT ... DO UPDATE` des Anlegewegs die andere Zeile
		// stillschweigend überschrieben, während die eigene daneben stehen blieb.
		const regeln = await holeReglementsregeln(betreiberA, stwegA);
		expect(regeln.find((r) => r.id === andere.id)?.fundstelle).toBe('Ziff. B');
		expect(regeln.find((r) => r.id === eine.id)?.knotenId).toBe('k-jahresrechnung');
	});

	it('lässt den Fall wandern, wenn der Zielschlüssel frei ist', async () => {
		const r = await erstelleReglementsregel(
			handelnder(betreiberA),
			regel(stwegA, { geschaeftsart: 'verwaltung_wichtig', knotenId: null, fundstelle: 'Ziff. C' })
		);

		const { geaendert } = await aendereReglementsregelAn(
			handelnder(betreiberA),
			stwegA,
			r.id,
			ohneStweg(
				regel(stwegA, {
					geschaeftsart: 'verwaltung_wichtig',
					knotenId: 'k-verwaltung-wichtig',
					fundstelle: 'Ziff. C'
				})
			)
		);

		expect(geaendert).toBe(true);
		const gespeichert = (await holeReglementsregeln(betreiberA, stwegA)).find((x) => x.id === r.id);
		expect(gespeichert?.knotenId).toBe('k-verwaltung-wichtig');
	});
});
