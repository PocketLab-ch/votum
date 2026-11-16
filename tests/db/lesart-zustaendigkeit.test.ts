/**
 * Lesart L2 in der Datenhaltung (Migration 171, Fassung 2026-10-26).
 *
 * Gemessen wird an L2, was `lesarten.test.ts` an L4 misst: Vorgabe und
 * Datenbankschranke, Umstellen mit Verlauf, Absage und Nachziehen vor der
 * Freigabe, Einfrieren bei der Freigabe und die Rechnung im Saal mit
 * Protokollzeile (Konzept Lesarten, Kriterien 1 bis 3, 5, 6 und 8).
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
	setzeGewaehltesErfordernis
} from '$lib/server/traktanden';
import { erfordernisseNachziehen, erstelleReglementsregel, veralteteErfordernisse } from '$lib/server/reglement';
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
	betreiber = await pruefbetreiber('Lesart L2');
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

/** Eine Versammlung im Entwurf mit einem Traktandum zur Zuständigkeitsordnung. */
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
		titel: 'Kleinere Reparaturen nur noch über die Bewirtschaftung',
		art: 'abstimmung',
		antragswortlaut: 'Gewöhnliche Reparaturen an gemeinschaftlichen Teilen gibt nur noch die Bewirtschaftung in Auftrag.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-zustaendigkeit-gewoehnlich',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff nach dem einfachen Mehr; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L2 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L2).toBe('einfach');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l2 = 'aller' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l2/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L2 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L2: 'qualifiziert' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({ L1: 'bleibt', L2: 'qualifiziert', L3: 'je_eigentuemer', L4: 'qualifiziert', L5: 'erste', L6: 'klausel', L7: 'zaehlt', L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L2',
			vorher: 'Einfaches Mehr (Vorgabe)',
			nachher: 'Qualifiziertes Mehr',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/Zuständigkeit für gewöhnliche Verwaltungshandlungen/);
	});
});

describe('Vor und bei der Freigabe (Kriterium 3)', () => {
	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L2 nachziehen', '2027-12-01');
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'einfach' });

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt die Lesart L2 ans Traktandum; die Form dafür kennt erst Migration 171.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('qualifiziertes_mehr');
		expect(e?.quotenbasis).toBe('alle_quoten');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'qualifiziert', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'einfach' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L2).toBe('qualifiziert');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L2).toBe('qualifiziert');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L2).toBe('einfach');
	});
});

/*
 * **Traktanden aus der Fassung davor** (Codeprüfung Block 3, M2): L2 hängt an
 * einem Knoten, den es schon gab. Ein Traktandum aus 2026-10-25 trägt keine
 * Lesart und rechnet wie sein Knoten, hier die Vorgabe; nach dem Ausrollen darf
 * es deshalb nicht als «älteres Erfordernis» erscheinen, solange die
 * Gemeinschaft auf dieser Wahl steht. Nach einer Umstellung erscheint es.
 */
describe('Traktanden aus der Fassung vor L2', () => {
	it('erscheinen erst nach einer Umstellung im Kasten der älteren Erfordernisse', async () => {
		const a = await versammlung('L2 alte Fassung', '2027-12-03');
		const alt = holeRegelwerk('2026-10-25');
		const e = erfordernisAus(alt, laufe(alt, 'a-sonderfaelle', ['f8-1-zustaendigkeit']));
		expect(e.gemeinschaftslesart).toBeUndefined();
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, e);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();

		const vorher = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
			(x) => x.traktandumId === a.traktandum
		);
		expect(vorher).toEqual([]);

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert' });
		const [nachher] = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
			(x) => x.traktandumId === a.traktandum
		);
		expect(nachher?.neu).toMatch(/Lesart: Qualifiziertes Mehr$/);
		// A5, Punkt 1c: «bisher» nennt, womit das Traktandum rechnet: die Wahl
		// seines Knotens, hier die Vorgabe.
		expect(nachher?.bisher).toMatch(/Lesart: Einfaches Mehr \(Vorgabe\)$/);

		// Und die Freigabe sagt ab, wie bei einem Traktandum mit veralteter Wahl
		// (Review DeepSeek Block 3, V1): Sonst rechnete die Einladung nach der
		// Vorgabe, während die Momentaufnahme «qualifiziert» einfröre.
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L2', wahl: 'qualifiziert' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('auf der Vorgabe hält ein Traktandum ohne Lesart die Freigabe nicht auf', async () => {
		const a = await versammlung('L2 alte Fassung, Vorgabe', '2027-12-05');
		const alt = holeRegelwerk('2026-10-25');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			erfordernisAus(alt, laufe(alt, 'a-sonderfaelle', ['f8-1-zustaendigkeit']))
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();
	});

	/*
	 * **Unter einer Regel des Reglements** (Codeprüfung der Behebung, F1): Das
	 * Traktandum rechnet nach der Regel und trägt bewusst keine Lesart; der
	 * Kasten zeigt es nicht. Die Freigabe darf deshalb nicht absagen, auch wenn
	 * die Gemeinschaft auf «qualifiziert» steht.
	 */
	it('unter einer Regel des Reglements sagt die Freigabe nicht ab', async () => {
		const a = await versammlung('L2 unter Regel', '2027-12-06');
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			geschaeftsart: 'verwaltung_gewoehnlich',
			knotenId: null,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 14',
			enthaltungZaehltMit: true
		});
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert' });
		const e = await erfordernisVon(a);
		expect(e?.quelle).toBe('reglement');
		expect(e?.gemeinschaftslesart).toBeUndefined();
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});
	// Die Schranke `snapshot_lesart_l2` misst hier kein Test: Die Anwendungsrolle
	// darf `snapshot` nicht ändern («permission denied»), und die Freigabe übernimmt
	// den Wert aus `stweg`, dessen Schranke oben gemessen ist.
});

describe('Im Saal (Kriterien 5, 6 und 8)', () => {
	it('rechnet nach der eingefrorenen Lesart und nennt das abweichende Ergebnis im Protokoll', async () => {
		// Zwei kleine Wohnungen Ja, die grosse Nein: einfaches Mehr erreicht, qualifiziertes nicht.
		const a = await versammlung('L2 im Saal', '2027-12-02');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L2: 'qualifiziert' });
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
			kennung: 'L2',
			wahl: 'Qualifiziertes Mehr',
			angenommen: false,
			abweichend: true
		});

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			// A5, Punkt 1b: der Grund der Vorgabe statt der Software.
			'Gezählt nach dem einfachen Mehr. Ob ein Beschluss, der die Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regelt, das qualifizierte Mehr braucht, ist umstritten. Das einfache Mehr ist die Standardeinstellung: Der SVIT-Kommentar führt diesen Beschluss überwiegend beim einfachen Mehr auf; an einer Stelle verlangt er das qualifizierte.'
		);
		expect(text).toMatch(/Nach der anderen Lesart \(«Qualifiziertes Mehr»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});
});
