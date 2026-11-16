/**
 * Entscheiden statt der Versammlung in der Datenhaltung (Fassung 2026-10-27,
 * C1 und C2a bis C2c, Entscheid 0018 «Fest»).
 *
 * Gemessen wird Kriterium 14 an der Stelle, die ältere Erfordernisse meldet
 * und die Freigabe aufhält (`veralteteErfordernisse`, `gibVersammlungFrei`):
 * Ein Traktandum der Vorfassung an `k-bewirtschaftung-erweitert` oder
 * `k-organ-waehlen` erscheint dort nicht, auch nicht unter einer Regel des
 * Reglements und nicht nach einer Umstellung der Lesarten (Fallen aus Block 3:
 * «Ein bestehender Knoten mit neuem Verhalten trifft alte Traktanden», «Unter
 * einer Regel verhält sich jede neue Prüfung anders»). Dazu der neue Weg C2a:
 * Die Einstimmigkeit bleibt auch unter einer Regel für Organe.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest, holeTraktanden, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import { erfordernisseNachziehen, erstelleReglementsregel, veralteteErfordernisse } from '$lib/server/reglement';
import { speichereLesarten } from '$lib/server/lesarten';
import { erfordernisAus, laufe } from '$lib/domain/entscheidbaum';
import { AKTUELLE_FASSUNG } from '$lib/rules';
import { wendeReglementAn } from '$lib/domain/reglement';
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { holeRegelwerk } from '$lib/rules';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Statt der Versammlung');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

/** Eine Versammlung im Entwurf mit zwei Traktanden für die Organe. */
async function versammlung(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	for (const [nummer, quote] of [400, 600].entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${nummer + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe'][nummer],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const traktandum = (titel: string) =>
		erstelleTraktandum(handelnder(betreiber), {
			meetingId: v.id,
			parentId: null,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel}.`,
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		});
	const erweitert = await traktandum('Bewirtschaftung stellt den Hauswart ein');
	const organ = await traktandum('Wahl des Ausschusses');
	return { gemeinschaft: g.id, versammlung: v.id, erweitert: erweitert.id, organ: organ.id };
}

const ALT = holeRegelwerk('2026-10-26');
const AUS_DER_VORFASSUNG = {
	erweitert: erfordernisAus(ALT, laufe(ALT, 'a-organe', ['f2-1-erweitert'])),
	organ: erfordernisAus(ALT, laufe(ALT, 'a-organe', ['f2-1-organ']))
};

/**
 * Nur die Traktanden dieses Tests: Jede Versammlung erhält die festen
 * Traktanden (Begrüssung, Wahl der Stimmenzähler an `k-organ-waehlen`), und die
 * Stimmenzähler stehen nach einer neuen Regel zu Recht im Kasten.
 */
async function veraltet(a: { gemeinschaft: string; erweitert: string; organ: string }) {
	return (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
		(x) => x.traktandumId === a.erweitert || x.traktandumId === a.organ
	);
}

async function erfordernisVon(versammlungId: string, traktandumId: string) {
	const [t] = (await holeTraktanden(betreiber, versammlungId)).filter((x) => x.knoten.id === traktandumId);
	return t.knoten.erfordernis;
}

describe('Traktanden der Fassung 2026-10-26 (Kriterium 14)', () => {
	it('erscheinen nicht als älteres Erfordernis und halten die Freigabe nicht auf, auch nach einer Umstellung', async () => {
		const a = await versammlung('Statt Versammlung, Vorfassung', '2027-12-10');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.erweitert, AUS_DER_VORFASSUNG.erweitert);
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.organ, AUS_DER_VORFASSUNG.organ);
		expect((await erfordernisVon(a.versammlung, a.erweitert))?.fassung).toBe('2026-10-26');

		expect(await veraltet(a)).toEqual([]);
		// Die Lesarten betreffen diese Karten nicht; auch umgestellt meldet nichts.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert', L4: 'qualifiziert' });
		expect(await veraltet(a)).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a.versammlung, a.erweitert))?.typ).toBe('qualifiziertes_mehr');
	});

	it('unter einer Regel des Reglements für die Organe: die erweiterte Bewirtschaftung seit der Fassung 2026-10-30 als älteres Erfordernis, die Wahl nicht', async () => {
		const a = await versammlung('Statt Versammlung, Vorfassung unter Regel', '2027-12-11');
		const regel = await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			geschaeftsart: 'organe',
			knotenId: null,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 21',
			enthaltungZaehltMit: true
		});
		for (const [traktandum, e] of [
			[a.erweitert, AUS_DER_VORFASSUNG.erweitert],
			[a.organ, AUS_DER_VORFASSUNG.organ]
		] as const) {
			const unterRegel = wendeReglementAn(e, [regel], null, LESARTEN_VORGABE).erfordernis;
			expect(unterRegel.quelle).toBe('reglement');
			await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, traktandum, unterRegel);
		}
		/*
		 * **Seit der Fassung 2026-10-30 greift eine Regel für die ganze
		 * Geschäftsart an der erweiterten Bewirtschaftung nicht mehr** (A4,
		 * Punkt 1): Der Knoten rechnet `vereinbart`, und nur fallgenau. Das
		 * Traktandum, das unter der Regel hergeleitet wurde, ist deshalb ein
		 * älteres Erfordernis, die Wahl der Organe nicht.
		 */
		const alt = await veraltet(a);
		expect(alt.map((x) => x.traktandumId)).toEqual([a.erweitert]);
		expect(alt[0]?.bisher).toContain('2/3 der Anwesenden');
		expect(alt[0]?.neu).toContain('1/2 der Anwesenden');
		// Nachgezogen meldet die Freigabe nichts mehr; das Traktandum rechnet
		// dann nach dem Gesetz, die Stimmenzähler nach ihrer Regel.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect(await veraltet(a)).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});
});

describe('Der neue Weg (Kriterien 11 und 12)', () => {
	it('C1 und C2a verlangen Einstimmigkeit, auch nachgezogen unter einer Regel für die Organe', async () => {
		const a = await versammlung('Statt Versammlung, neu', '2027-12-12');
		const wo = { meetingId: a.versammlung, stwegId: a.gemeinschaft };
		await setzeGewaehltesErfordernis(handelnder(betreiber), wo, a.erweitert, 'k-bewirtschaftung-statt-versammlung', null);
		await setzeGewaehltesErfordernis(handelnder(betreiber), wo, a.organ, 'k-uebertragung-statt-versammlung', null);
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			geschaeftsart: 'organe',
			knotenId: null,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 22',
			enthaltungZaehltMit: true
		});
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		for (const t of [a.erweitert, a.organ]) {
			const e = await erfordernisVon(a.versammlung, t);
			expect(e?.typ, t).toBe('einstimmigkeit');
			expect(e?.kopfbasis, t).toBe('alle_eigentuemer');
			// Nachgezogen heisst: auf die aktuelle Fassung, welche es auch ist.
			expect(e?.fassung, t).toBe(AKTUELLE_FASSUNG);
		}
		// Die Datenbank hält die Karte fest, die gerechnet hat.
		const knoten = await imKontext(betreiber, (tx) =>
			tx<{ requirement_node: string }[]>`
				SELECT requirement_node FROM agenda_item
				 WHERE id IN (${a.erweitert}, ${a.organ}) ORDER BY position
			`
		);
		expect(knoten.map((k) => k.requirement_node)).toEqual([
			'k-bewirtschaftung-statt-versammlung',
			'k-uebertragung-statt-versammlung'
		]);
	});
});
