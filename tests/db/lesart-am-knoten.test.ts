/**
 * Freigabe und Kasten «Erfordernisse nachziehen» bestimmen die Wahl eines
 * Traktandums ohne gespeicherte Wahl am Knoten seiner Fassung, nicht an der
 * Vorgabe des Katalogs (Entscheid 0048, Block A, Kriterien 4 und 6).
 *
 * **Wie gemessen wird.** Ein Traktandum aus der Fassung 2026-10-25 trägt an
 * `k-zustaendigkeit-gewoehnlich` keine Lesart und rechnet das einfache Mehr
 * (wie in `lesart-zustaendigkeit.test.ts`). Die Probe stellt die Vorgabe von
 * L2 auf «qualifiziert», wie Block B es für L4 tut, und zwar nur für die
 * Module ausserhalb des Katalogs: über eine Attrappe von `lesartVon`, die
 * `domain/lesarten.ts` selbst nicht sieht. Genau das ist der Punkt: Fragt die
 * Freigabe oder der Kasten die Rechnung noch am Katalog, ändert die Attrappe
 * die Antwort, und die Probe wird rot. Auf dem Stand vor Block A sind beide
 * Fälle rot (Gegenprobe im Auftrag).
 *
 * Gemeinschaft und Namen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/domain/lesarten', async (original) => {
	const echt = await original<typeof import('$lib/domain/lesarten')>();
	return {
		...echt,
		// Beide Träger der Vorgabe umgestellt (Codeprüfung Block A, Befund 4): Ein
		// Rückfall über `LESARTEN_VORGABE` bliebe sonst grün.
		LESARTEN_VORGABE: { ...echt.LESARTEN_VORGABE, L2: 'qualifiziert' },
		lesartVon: (kennung: string) => {
			const l = echt.lesartVon(kennung);
			return l && kennung === 'L2' ? { ...l, vorgabe: 'qualifiziert' } : l;
		}
	};
});

import { lesartVon } from '$lib/domain/lesarten';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest, holeTraktanden } from '$lib/server/traktanden';
import { veralteteErfordernisse } from '$lib/server/reglement';
import { erfordernisAus, laufe } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { speichereLesarten } from '$lib/server/lesarten';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart am Knoten');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

/** Eine Versammlung im Entwurf mit einem Traktandum aus der Fassung 2026-10-25, ohne Lesart. */
async function versammlung(name: string, datum: string) {
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	for (const [nummer, quote] of [200, 200, 600].entries()) {
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
			displayName: ['Erika Beispiel', 'Hans Probe', 'Grosse Wohnung AG'][nummer],
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
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Kleinere Reparaturen nur noch über die Bewirtschaftung',
		art: 'abstimmung',
		antragswortlaut: 'Gewöhnliche Reparaturen an gemeinschaftlichen Teilen gibt nur noch die Bewirtschaftung in Auftrag.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	const alt = holeRegelwerk('2026-10-25');
	const e = erfordernisAus(alt, laufe(alt, 'a-sonderfaelle', ['f8-1-zustaendigkeit']));
	await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, e);
	const [gespeichert] = (await holeTraktanden(betreiber, v.id)).filter((x) => x.knoten.id === t.id);
	expect(gespeichert.knoten.erfordernis?.gemeinschaftslesart).toBeUndefined();
	expect(gespeichert.knoten.erfordernis?.typ).toBe('einfaches_mehr');
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id };
}

describe('Traktandum ohne Wahl, nachdem die Vorgabe gewechselt hat', () => {
	it('die Attrappe stellt die Vorgabe um', () => {
		expect(lesartVon('L2')?.vorgabe).toBe('qualifiziert');
	});

	it('steht die Gemeinschaft auf seiner Wahl, hält es die Freigabe nicht auf', async () => {
		// Vor Block A galt das Traktandum als «nach der Vorgabe», jetzt
		// «qualifiziert», und die Freigabe sagte ab, obwohl Traktandum und
		// Gemeinschaft dasselbe einfache Mehr rechnen; der Kasten zeigte keinen
		// Weg hinaus.
		const a = await versammlung('Lesart am Knoten, gleich', '2027-12-11');
		const kasten = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter((x) => x.traktandumId === a.traktandum);
		expect(kasten).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('steht sie auf der anderen, erscheint es im Kasten mit seiner Wahl, und die Freigabe sagt ab', async () => {
		// Vor Block A gälte das Traktandum hier als «qualifiziert» wie die
		// Gemeinschaft: Die Freigabe liesse es durch, und die Einladung rechnete
		// still das einfache Mehr, während die Momentaufnahme «qualifiziert»
		// einfröre.
		const a = await versammlung('Lesart am Knoten, andere', '2027-12-12');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert' });
		const [zeile] = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter((x) => x.traktandumId === a.traktandum);
		expect(zeile?.bisher).toMatch(/Lesart: Einfaches Mehr/);
		expect(zeile?.neu).toMatch(/Lesart: Qualifiziertes Mehr/);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);
	});
});
