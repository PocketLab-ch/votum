/**
 * Lesart L11 in der Datenhaltung (Migration 186, Fassung 2026-11-10).
 *
 * Gemessen wird an L11, was `lesart-zustaendigkeit.test.ts` an L2 misst:
 * Vorgabe und Datenbankschranke, Umstellen mit Verlauf, Absage und Nachziehen
 * vor der Freigabe, Einfrieren bei der Freigabe und die Rechnung im Saal mit
 * Protokollzeile (Konzept Lesarten, Kriterien 1 bis 3, 5, 6 und 8). Dazu die
 * zwei Fälle, die L11 von L2 unterscheiden: ein Traktandum aus der Fassung
 * 2026-11-05, das unter «einfach» nicht mehr freigegeben werden darf, und eine
 * Regel des Reglements, die der Lesart vorgeht.
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
import { erfordernisseNachziehen, erstelleReglementsregel } from '$lib/server/reglement';
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
	betreiber = await pruefbetreiber('Lesart L11');
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

/** Eine Versammlung im Entwurf mit einem Traktandum zur Prozessführung. */
async function versammlung(name: string, datum: string, quoten = [200, 200, 600]) {
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
		titel: 'Bewirtschaftung zur Prozessführung ermächtigen',
		art: 'abstimmung',
		antragswortlaut:
			'Die Bewirtschaftung wird ermächtigt, für die Gemeinschaft gegen die ausführende Unternehmung Klage einzureichen.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-prozessfuehrung',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff nach dem qualifizierten Mehr; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L11 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L11).toBe('qualifiziert');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l11 = 'aller' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l11/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L11 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L11: 'einfach' });
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
			L11: 'einfach',
			L12: 'alle', L13: 'anwesende',
			L15: 'ausserhalb',
			L16: 'neue_erste'
		});
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L11',
			vorher: 'Qualifiziertes Mehr (Vorgabe)',
			nachher: 'Einfaches Mehr',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/Welches Mehr braucht der Beschluss, der die Bewirtschaftung ermächtigt/);
	});
});

describe('Vor und bei der Freigabe (Kriterium 3)', () => {
	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L11 nachziehen', '2027-12-01');
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L11', wahl: 'qualifiziert' });

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L11: 'einfach' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt die Lesart L11 ans Traktandum; die Form dafür kennt erst Migration 186.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einfaches_mehr');
		expect(e?.quotenbasis).toBe('keine');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L11', wahl: 'einfach', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L11).toBe('einfach');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L11).toBe('einfach');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L11).toBe('qualifiziert');
	});
});

/*
 * **Traktanden aus der Fassung davor** (Fassung 2026-11-05): L11 hängt an einem
 * Knoten, den es schon gab. Ein Traktandum aus 2026-11-05 trägt keine Lesart
 * und rechnet nach dem qualifizierten Mehr; solange die Gemeinschaft auf der
 * Vorgabe steht, ist das dasselbe. Nach einer Umstellung auf «einfach» rechnete
 * die Einladung nach dem qualifizierten Mehr, während die Momentaufnahme
 * «einfach» einfriert; die Freigabe sagt deshalb ab (`lesart_veraltet`).
 */
describe('Traktanden aus der Fassung vor L11', () => {
	it('halten die Freigabe auf, sobald die Gemeinschaft auf «einfach» steht', async () => {
		const a = await versammlung('L11 alte Fassung', '2027-12-03');
		const alt = holeRegelwerk('2026-11-05');
		const e = erfordernisAus(alt, laufe(alt, 'a-geld', ['f4-1-prozess']));
		expect(e.gemeinschaftslesart).toBeUndefined();
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, e);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L11: 'einfach' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/Die Lesarten der Gemeinschaft wurden umgestellt, nachdem «Bewirtschaftung zur Prozessführung ermächtigen» sein Mehr bekam/
		);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L11', wahl: 'einfach' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('auf der Vorgabe hält ein Traktandum ohne Lesart die Freigabe nicht auf', async () => {
		const a = await versammlung('L11 alte Fassung, Vorgabe', '2027-12-05');
		const alt = holeRegelwerk('2026-11-05');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			erfordernisAus(alt, laufe(alt, 'a-geld', ['f4-1-prozess']))
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();
	});

	/*
	 * **Unter einer Regel des Reglements**: Das Traktandum rechnet nach der
	 * Regel und trägt bewusst keine Lesart; der Katalog sagt es selbst («Sagt
	 * Ihr Reglement, welches Mehr für diese Ermächtigung gilt, geht es der
	 * Lesart vor»). Die Freigabe darf deshalb nicht absagen, auch wenn die
	 * Gemeinschaft auf «einfach» steht.
	 */
	it('unter einer Regel des Reglements sagt die Freigabe nicht ab', async () => {
		const a = await versammlung('L11 unter Regel', '2027-12-06');
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			geschaeftsart: 'jahresgeschaefte',
			knotenId: null,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 14',
			enthaltungZaehltMit: true
		});
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L11: 'einfach' });
		const e = await erfordernisVon(a);
		expect(e?.quelle).toBe('reglement');
		expect(e?.gemeinschaftslesart).toBeUndefined();
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});
	// Die Schranke `snapshot_lesart_l11` misst hier kein Test: Die Anwendungsrolle
	// darf `snapshot` nicht ändern («permission denied»), und die Freigabe übernimmt
	// den Wert aus `stweg`, dessen Schranke oben gemessen ist.
});

describe('Im Saal (Kriterien 5, 6 und 8)', () => {
	it('rechnet nach der eingefrorenen Lesart und nennt das abweichende Ergebnis im Protokoll', async () => {
		// Zwei kleine Wohnungen Ja, die grosse Nein: einfaches Mehr erreicht, qualifiziertes nicht.
		const a = await versammlung('L11 im Saal', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L11: 'einfach' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereLesart).toMatchObject({
			kennung: 'L11',
			wahl: 'Qualifiziertes Mehr',
			angenommen: false,
			abweichend: true
		});

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Gezählt nach dem einfachen Mehr. Ob die Ermächtigung der Bewirtschaftung zur Prozessführung das qualifizierte Mehr braucht, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet. Die Standardeinstellung wäre das qualifizierte Mehr: Der SVIT-Kommentar verlangt für diese Ermächtigung in der Regel das qualifizierte Mehr, und eine so erteilte Ermächtigung besteht nach beiden Wahlen zum Mehr, einfach oder qualifiziert.'
		);
		expect(text).toMatch(/Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});
});

/*
 * **Das Rückkommen auf eine Ermächtigung der Fassung 2026-11-10** (Codeprüfung
 * E1 L11, Befund 1): `erfordernisFuerRueckkommen` trägt die Lesart des
 * Beschlusses in `requirement_reading_reconsidered`. Ohne L11 in deren
 * Schranke (Migration 181, nachgezogen in 186) endete schon das Stellen des
 * Antrags mit einer Verletzung der Schranke.
 */
describe('Rückkommen auf die Ermächtigung (Migration 186)', () => {
	it('stellt den Antrag und trägt die Lesart des Beschlusses mit', async () => {
		const a = await versammlung('L11 Rückkommen', '2027-12-23');
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
		expect(e?.lesartDesBeschlusses).toMatchObject({ kennung: 'L11', wahl: 'qualifiziert' });
	});
});
