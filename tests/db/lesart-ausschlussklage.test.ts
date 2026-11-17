/**
 * Lesart L9 in der Datenhaltung (Migration 188, Fassung 2026-11-10).
 *
 * Gemessen wird an L9, was `lesart-prozessfuehrung.test.ts` an L11 misst:
 * Vorgabe und Datenbankschranke, Umstellen mit Verlauf, Absage und Nachziehen
 * vor der Freigabe, Einfrieren bei der Freigabe und die Rechnung im Saal mit
 * Protokollzeile (Konzept Lesarten, Kriterien 1 bis 3, 5, 6 und 8). Dazu die
 * zwei Fälle, die L9 von L11 unterscheiden: ein Traktandum aus der Fassung
 * 2026-11-05, das unter «anwesende» nicht mehr freigegeben werden darf, und
 * das zweite Ergebnis, das hier **1a rechnet** und nicht der allgemeine
 * Lesartenweg.
 *
 * **Mit einem Beklagten.** An der Ausschlussklage nimmt die Kopfbasis den
 * Beklagten aus (ZGB Art. 649b Abs. 2); ohne ihn misst der Test die falsche
 * Zahl. Fünf Eigentümer zu je 200 von 1000, der erste beklagt und abwesend,
 * der letzte abwesend: An den vier übrigen braucht es drei Ja, an den drei
 * Anwesenden zwei.
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
	betreiber = await pruefbetreiber('Lesart L9');
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
 * Eine Versammlung im Entwurf mit einem Traktandum zur Ausschlussklage. Der
 * erste Eigentümer ist der Beklagte; die Freigabe verlangt ihn schon im
 * Entwurf.
 */
async function versammlung(name: string, datum: string, quoten = [200, 200, 200, 200, 200]) {
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
			displayName:
				['Prüfbeklagter', 'Hans Probe', 'Grosse Wohnung AG', 'Ida Muster', 'Kurt Beispiel'][nummer] ??
				`Partei ${nummer + 1}`,
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
		titel: 'Ermächtigung zur Ausschlussklage',
		art: 'abstimmung',
		antragswortlaut:
			'Die Gemeinschaft wird ermächtigt, gegen den beklagten Eigentümer die Ausschlussklage zu erheben.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: [parteien[0]]
		},
	// Entscheid 0050, Antwort 3: Betroffene nimmt das Formular nur mit einem Mehr an,
	// das sie kennt, wie die Route mit dem Feld «erfordernis».
	'k-ausschlussklage');
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-ausschlussklage',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff über alle ohne den Beklagten; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L9 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L9).toBe('alle');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l9 = 'anwesend' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l9/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L9 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L9: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({
			L1: 'bleibt',
			L2: 'einfach',
			L3: 'je_eigentuemer',
			L4: 'qualifiziert',
			L5: 'erste',
			L6: 'klausel',
			L7: 'zaehlt',
			L8: 'ruhen',
			L9: 'anwesende',
			L10: 'bleiben',
			L11: 'qualifiziert',
			L12: 'alle', L13: 'anwesende',
			L15: 'ausserhalb',
			L16: 'neue_erste',
			L17: 'streng'
		});
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L9',
			vorher: 'Alle Eigentümer ohne den Beklagten (Vorgabe)',
			nachher: 'Anwesende und Vertretene ohne den Beklagten',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(
			/An welcher Zahl wird die Mehrheit für die Ermächtigung zur Ausschlussklage gemessen/
		);
	});
});

describe('Vor und bei der Freigabe (Kriterium 3)', () => {
	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L9 nachziehen', '2027-12-01');
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L9', wahl: 'alle' });

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L9: 'anwesende' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt die Lesart L9 ans Traktandum; die Form dafür kennt erst Migration 188.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einfaches_mehr');
		expect(e?.kopfbasis).toBe('anwesend_vertreten');
		expect(e?.quotenbasis).toBe('keine');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L9', wahl: 'anwesende', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L9: 'alle' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L9).toBe('anwesende');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L9).toBe('anwesende');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L9).toBe('alle');
	});
});

/*
 * **Traktanden aus der Fassung davor** (Fassung 2026-11-05): L9 hängt an einem
 * Knoten, den es schon gab. Ein Traktandum aus 2026-11-05 trägt keine Lesart
 * und rechnet über alle Eigentümer ohne den Beklagten; solange die Gemeinschaft
 * auf der Vorgabe steht, ist das dasselbe. Nach einer Umstellung auf
 * «anwesende» rechnete die Einladung über alle, während die Momentaufnahme
 * «anwesende» einfriert; die Freigabe sagt deshalb ab (`lesart_veraltet`).
 */
describe('Traktanden aus der Fassung vor L9', () => {
	it('halten die Freigabe auf, sobald die Gemeinschaft auf «anwesende» steht', async () => {
		const a = await versammlung('L9 alte Fassung', '2027-12-03');
		const alt = holeRegelwerk('2026-11-05');
		const e = erfordernisAus(alt, laufe(alt, 'a-sonderfaelle', ['f8-1-ausschluss']));
		expect(e.gemeinschaftslesart).toBeUndefined();
		expect(e.kopfbasis).toBe('alle_ausser_betroffene');
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, e);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L9: 'anwesende' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «Ermächtigung zur Ausschlussklage» sein Mehr bekam/
		);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L9', wahl: 'anwesende' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('auf der Vorgabe hält ein Traktandum ohne Lesart die Freigabe nicht auf', async () => {
		const a = await versammlung('L9 alte Fassung, Vorgabe', '2027-12-05');
		const alt = holeRegelwerk('2026-11-05');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			erfordernisAus(alt, laufe(alt, 'a-sonderfaelle', ['f8-1-ausschluss']))
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();
	});
});

describe('Im Saal (Kriterien 5, 6 und 8)', () => {
	it('rechnet nach der eingefrorenen Lesart und nennt das abweichende Ergebnis im Protokoll', async () => {
		/*
		 * Fünf Eigentümer zu je 200; der erste ist der Beklagte und abwesend, der
		 * letzte abwesend. Zwei Ja und ein Nein von den drei Anwesenden: an den
		 * vier übrigen zu wenig (drei nötig), an den drei Anwesenden genug (zwei).
		 */
		const a = await versammlung('L9 im Saal', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L9: 'anwesende' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(1, 4)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[1], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'yes' },
				{ parteiId: a.parteien[3], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		// Das zweite Ergebnis rechnet 1a, nicht der allgemeine Lesartenweg.
		expect(auszaehlung?.andereLesart).toBeUndefined();
		expect(auszaehlung?.andereZaehlbasis).toMatchObject({
			kennung: '1a',
			eigeneWahl: 'an den Anwesenden und Vertretenen ausser dem Beklagten',
			wahl: 'an allen Eigentümern ausser dem Beklagten',
			angenommen: false,
			abweichend: true,
			ausLesart: true
		});

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Gezählt nach der Mehrheit der Anwesenden und Vertretenen ohne den Beklagten. Ob die Ermächtigung zur Ausschlussklage die Mehrheit aller Eigentümer ohne den Beklagten braucht oder die Mehrheit der Anwesenden und Vertretenen genügt, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. Die Standardeinstellung wäre die Mehrheit aller Eigentümer ohne den Beklagten: Der Wortlaut des Gesetzes nennt alle Eigentümer ohne den Beklagten, und eine so erteilte Ermächtigung besteht nach beiden Lesarten.'
		);
		expect(text).toMatch(
			/Verkündet ist die Annahme, gezählt an den Anwesenden und Vertretenen ausser dem Beklagten\. Gezählt an allen Eigentümern ausser dem Beklagten, wäre der Antrag abgelehnt gewesen/
		);
	});
});

/*
 * **Das Rückkommen auf eine Ermächtigung der Fassung 2026-11-10** (wie bei L11
 * und L12): `erfordernisFuerRueckkommen` trägt die Lesart des Beschlusses in
 * `requirement_reading_reconsidered`. Ohne L9 in deren Schranke (Migration 181,
 * nachgezogen in 188) endete schon das Stellen des Antrags mit einer Verletzung
 * der Schranke.
 */
describe('Rückkommen auf die Ermächtigung (Migration 188)', () => {
	it('stellt den Antrag und trägt die Lesart des Beschlusses mit', async () => {
		const a = await versammlung('L9 Rückkommen', '2027-12-23');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(1)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await stelleAufTraktandum(handelnder(betreiber), a.versammlung, a.traktandum);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			a.parteien.slice(1).map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			false
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		const e = await erfordernisVon({ versammlung: a.versammlung, traktandum: rk.id });
		expect(e?.gemeinschaftslesart).toBeUndefined();
		expect(e?.lesartDesBeschlusses).toMatchObject({ kennung: 'L9', wahl: 'alle' });
	});
});
