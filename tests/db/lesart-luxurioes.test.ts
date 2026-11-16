/**
 * Lesart L12 in der Datenhaltung (Migration 187, Fassung 2026-11-10).
 *
 * Gemessen wird an L12, was `lesart-prozessfuehrung.test.ts` an L11 misst:
 * Vorgabe und Datenbankschranke, Umstellen mit Verlauf, Absage und Nachziehen
 * vor der Freigabe, Einfrieren bei der Freigabe und die Rechnung im Saal mit
 * Protokollzeile (Konzept Lesarten, Kriterien 1 bis 3, 5, 6 und 8). Dazu die
 * zwei Fälle, die L12 von L11 unterscheiden: ein Traktandum aus der Fassung
 * 2026-11-05, das unter «anwesende» nicht mehr freigegeben werden darf, und
 * die Zählung selbst: unter «anwesende» ist der Antrag angenommen, obwohl ein
 * eingetragener Eigentümer fehlt, und über alle eingetragenen Eigentümer wäre
 * er abgelehnt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	setzeGewaehltesErfordernis,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import { erfordernisseNachziehen } from '$lib/server/reglement';
import { erfordernisAus, laufe } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { gibStimmenAb, holeErgebnis, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L12');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});

async function gemeinschaft(name: string) {
	return erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
}

/**
 * Eine Versammlung im Entwurf mit einem Traktandum zur luxuriösen baulichen
 * Massnahme. Die Quoten sind so gewählt, dass zwei von drei Parteien die
 * Beschlussfähigkeit tragen (600 von 1000, zwei von drei Köpfen): Nur so lässt
 * sich der Fall messen, in dem ein eingetragener Eigentümer fehlt.
 */
async function versammlung(name: string, datum: string, quoten = [300, 300, 400]) {
	const g = await gemeinschaft(name);
	const parteien: string[] = [];
	for (const [nummer, quote] of quoten.entries()) {
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
			displayName: ['Erika Beispiel', 'Hans Probe', 'Grosse Wohnung AG'][nummer] ?? `Partei ${nummer + 1}`,
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
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Luxuriöse bauliche Massnahme',
		art: 'abstimmung',
		antragswortlaut: 'Im Treppenhaus wird ein Springbrunnen eingebaut.',
		antragstellerart: 'gemeinschaft',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-baulich-luxurioes',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

/** Der Weg im Entscheidbaum zur luxuriösen baulichen Massnahme. */
const WEG_LUXURIOES = ['f1-0-nein', 'f1-1-nein', 'f1-2-nein', 'f1-3-verschoenerung', 'f1-4-ja'];

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff über alle eingetragenen Eigentümer; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L12 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L12).toBe('alle');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l12 = 'alle_eigentuemer' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l12/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L12 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L12: 'anwesende', L13: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({
			L1: 'bleibt',
			L2: 'einfach',
			L3: 'je_eigentuemer',
			L4: 'qualifiziert',
			L5: 'erste',
			L6: 'klausel',
			L7: 'zaehlt',
			L8: 'ruhen',
			L9: 'alle',
			L10: 'bleiben',
			L11: 'qualifiziert',
			L12: 'anwesende', L13: 'anwesende'
		});
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L12',
			vorher: 'Alle eingetragenen Eigentümer (Vorgabe)',
			nachher: 'Alle Anwesenden und Vertretenen',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(
			/Wessen Zustimmung braucht eine luxuriöse bauliche Massnahme/
		);
	});
});

describe('Vor und bei der Freigabe (Kriterium 3)', () => {
	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L12 nachziehen', '2027-12-01');
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L12', wahl: 'alle' });

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L12: 'anwesende', L13: 'anwesende' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt die Lesart L12 ans Traktandum; die Form dafür kennt erst Migration 187.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einstimmigkeit');
		expect(e?.kopfbasis).toBe('anwesend_vertreten');
		expect(e?.quotenbasis).toBe('keine');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L12', wahl: 'anwesende', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L12: 'alle', L13: 'anwesende' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L12).toBe('anwesende');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L12).toBe('anwesende');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L12).toBe('alle');
	});
});

/*
 * **Traktanden aus der Fassung davor** (Fassung 2026-11-05): L12 hängt an einem
 * Knoten, den es schon gab. Ein Traktandum aus 2026-11-05 trägt keine Lesart
 * und rechnet über alle eingetragenen Eigentümer; solange die Gemeinschaft auf
 * der Vorgabe steht, ist das dasselbe. Nach einer Umstellung auf «anwesende»
 * rechnete die Einladung über alle, während die Momentaufnahme «anwesende»
 * einfriert; die Freigabe sagt deshalb ab (`lesart_veraltet`).
 */
describe('Traktanden aus der Fassung vor L12', () => {
	it('halten die Freigabe auf, sobald die Gemeinschaft auf «anwesende» steht', async () => {
		const a = await versammlung('L12 alte Fassung', '2027-12-03');
		const alt = holeRegelwerk('2026-11-05');
		const e = erfordernisAus(alt, laufe(alt, 'a-bauen', WEG_LUXURIOES));
		expect(e.gemeinschaftslesart).toBeUndefined();
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, e);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L12: 'anwesende', L13: 'anwesende' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «Luxuriöse bauliche Massnahme» sein Mehr bekam/
		);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L12', wahl: 'anwesende' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('auf der Vorgabe hält ein Traktandum ohne Lesart die Freigabe nicht auf', async () => {
		const a = await versammlung('L12 alte Fassung, Vorgabe', '2027-12-05');
		const alt = holeRegelwerk('2026-11-05');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			erfordernisAus(alt, laufe(alt, 'a-bauen', WEG_LUXURIOES))
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();
	});
	// Die Schranke `snapshot_lesart_l12` misst hier kein Test: Die Anwendungsrolle
	// darf `snapshot` nicht ändern («permission denied»), und die Freigabe übernimmt
	// den Wert aus `stweg`, dessen Schranke oben gemessen ist.
});

describe('Im Saal (Kriterien 5, 6 und 8)', () => {
	it('nimmt unter «anwesende» an, obwohl ein Eigentümer fehlt, und nennt das abweichende Ergebnis im Protokoll', async () => {
		// Zwei Wohnungen zu 300 Ja, die dritte zu 400 fehlt: unter «anwesende»
		// angenommen, über alle eingetragenen Eigentümer abgelehnt.
		const a = await versammlung('L12 im Saal', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L12: 'anwesende', L13: 'anwesende' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereLesart).toMatchObject({
			kennung: 'L12',
			wahl: 'Alle eingetragenen Eigentümer',
			angenommen: false,
			abweichend: true
		});

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Gezählt nach der Zustimmung aller Anwesenden und Vertretenen. Ob eine luxuriöse bauliche Massnahme die Zustimmung aller eingetragenen Eigentümer braucht oder die aller Anwesenden und Vertretenen genügt, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. Die Standardeinstellung wäre die Zustimmung aller eingetragenen Eigentümer: Die herrschende Lehre verlangt die Zustimmung aller eingetragenen Eigentümer, und ein so gefasster Beschluss besteht nach beiden Lesarten.'
		);
		expect(text).toMatch(/Nach der anderen Lesart \(«Alle eingetragenen Eigentümer»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});

	it('lehnt unter «anwesende» ab, wenn sich ein Anwesender enthält', async () => {
		const a = await versammlung('L12 Enthaltung', '2027-12-04');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L12: 'anwesende', L13: 'anwesende' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 2)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'abstain' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(false);
	});
});

/*
 * **Das Rückkommen auf eine luxuriöse bauliche Massnahme der Fassung
 * 2026-11-10**: `erfordernisFuerRueckkommen` trägt die Lesart des Beschlusses
 * in `requirement_reading_reconsidered`. Ohne L12 in deren Schranke (Migration
 * 181, nachgezogen in 187) endete schon das Stellen des Antrags mit einer
 * Verletzung der Schranke.
 */
describe('Rückkommen auf die luxuriöse Massnahme (Migration 187)', () => {
	it('stellt den Antrag und trägt die Lesart des Beschlusses mit', async () => {
		const a = await versammlung('L12 Rückkommen', '2027-12-23');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			a.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' })),
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		const e = await erfordernisVon({ versammlung: a.versammlung, traktandum: rk.id });
		expect(e?.gemeinschaftslesart).toBeUndefined();
		expect(e?.lesartDesBeschlusses).toMatchObject({ kennung: 'L12', wahl: 'alle' });
	});
});
