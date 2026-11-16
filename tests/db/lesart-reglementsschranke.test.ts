/**
 * Lesart L6 in der Datenhaltung (Migration 180, Fassung 2026-11-05).
 *
 * Gemessen wird an L6, was `lesarten.test.ts` an L4 misst: Vorgabe und
 * Datenbankschranke, Umstellen mit Verlauf, Absage und Nachziehen vor der
 * Freigabe, Einfrieren bei der Freigabe und die Rechnung im Saal mit
 * Protokollzeile (Konzept Lesarten, Kriterien 1 bis 3, 5, 6 und 8). Im Saal
 * ist einer von sechs Eigentümern abwesend: Nach der Klausel zählt er wie ein
 * Nein, nach dem Gesetz ist das qualifizierte Mehr erreicht.
 *
 * **Nicht in dieser Sitzung laufen lassen** (Auftrag F4c, Block 1): Die
 * abgebende Sitzung fährt ihn mit dem Prüflauf.
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
import {
	gibStimmenAb,
	holeErgebnis,
	holeMehrheitsvorschau,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import { stelleRueckkommensantrag } from '$lib/server/traktanden';
import { uebersteuere, type Erfordernis } from '$lib/domain/entscheidbaum';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L6');
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

/** Eine Versammlung im Entwurf mit einer Reglementsänderung unter der Klausel. */
async function versammlung(name: string, datum: string, quoten = [200, 180, 170, 160, 150, 140]) {
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
			displayName: ['Erika Beispiel', 'Hans Probe', 'Grosse Wohnung AG', 'Ida Muster', 'Kurt Beispiel', 'Lisa Probe'][nummer] ?? `Partei ${nummer + 1}`,
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
		titel: 'Reglement: Hausordnung nur noch mit Zustimmung aller ändern',
		art: 'abstimmung',
		antragswortlaut: 'Das Reglement wird so geändert, dass die Hausordnung nur noch mit Zustimmung aller Eigentümer geändert werden kann.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-reglement-eigene-schranke',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff nach der Klausel; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L6 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L6).toBe('klausel');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l6 = 'alle' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l6/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L6 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L6: 'gesetz' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toEqual({
			L1: 'bleibt',
			L2: 'einfach',
			L3: 'je_eigentuemer',
			L4: 'qualifiziert',
			L5: 'erste',
			L6: 'gesetz',
			L7: 'zaehlt',
			L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende',
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
			lesart: 'L6',
			vorher: 'Klausel anwenden (Vorgabe)',
			nachher: 'Nach dem Gesetz',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/die Zustimmung aller: Gilt diese Klausel/);
	});
});

describe('Vor und bei der Freigabe (Kriterium 3)', () => {
	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L6 nachziehen', '2027-12-01');
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einstimmigkeit');
		expect(e?.kopfbasis).toBe('alle_eigentuemer');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'klausel' });

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'gesetz' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt die Lesart L6 ans Traktandum; die Form dafür kennt erst Migration 180.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const nach = await erfordernisVon(a);
		expect(nach?.typ).toBe('qualifiziertes_mehr');
		expect(nach?.quotenbasis).toBe('alle_quoten');
		expect(nach?.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'gesetz', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'klausel' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L6).toBe('gesetz');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L6).toBe('gesetz');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L6).toBe('klausel');
	});
});

/*
 * **Traktanden aus der Fassung davor** (wie L2, Codeprüfung Block 3, M2): L6
 * hängt an einem Knoten, den es schon gab. Ein Traktandum aus 2026-11-04 trägt
 * keine Lesart und rechnet wie die Vorgabe; nach dem Ausrollen darf es
 * deshalb nicht als «älteres Erfordernis» erscheinen, solange die Gemeinschaft
 * auf der Vorgabe steht. Nach einer Umstellung erscheint es.
 */
describe('Traktanden aus der Fassung vor L6', () => {
	it('erscheinen erst nach einer Umstellung im Kasten der älteren Erfordernisse', async () => {
		const a = await versammlung('L6 alte Fassung', '2027-12-03');
		const alt = holeRegelwerk('2026-11-04');
		const e = erfordernisAus(alt, laufe(alt, 'a-reglement', ['f3-1-selbst']));
		expect(e.gemeinschaftslesart).toBeUndefined();
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, e);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();

		const vorher = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
			(x) => x.traktandumId === a.traktandum
		);
		expect(vorher).toEqual([]);

		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'gesetz' });
		const [nachher] = (await veralteteErfordernisse(betreiber, a.gemeinschaft)).filter(
			(x) => x.traktandumId === a.traktandum
		);
		expect(nachher?.neu).toMatch(/Lesart: Nach dem Gesetz$/);
		// A5, Punkt 1c: «bisher» nennt, womit das Traktandum rechnet, die Vorgabe.
		expect(nachher?.bisher).toMatch(/Lesart: Klausel anwenden \(Vorgabe\)$/);

		// Und die Freigabe sagt ab, wie bei einem Traktandum mit veralteter Wahl
		// (Review DeepSeek Block 3, V1): Sonst rechnete die Einladung nach der
		// Vorgabe, während die Momentaufnahme «gesetz» einfröre.
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'gesetz' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('auf der Vorgabe hält ein Traktandum ohne Lesart die Freigabe nicht auf', async () => {
		const a = await versammlung('L6 alte Fassung, Vorgabe', '2027-12-05');
		const alt = holeRegelwerk('2026-11-04');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			erfordernisAus(alt, laufe(alt, 'a-reglement', ['f3-1-selbst']))
		);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await erfordernisVon(a))?.gemeinschaftslesart).toBeUndefined();
	});

	/*
	 * **Eine Regel des Reglements greift hier nicht** (anders als bei L2): Die
	 * Karte ist selbst die Reglementsbestimmung und trägt `gesperrt_reglement`
	 * (Fassung 2026-08-15). Eine hinterlegte Regel zur Reglementsänderung
	 * ersetzt das Mehr deshalb nicht; das Traktandum behält die Lesart, und die
	 * Freigabe rechnet nach der Wahl der Gemeinschaft.
	 */
	it('eine Regel zur Reglementsänderung ersetzt die Lesart nicht', async () => {
		const a = await versammlung('L6 unter Regel', '2027-12-06');
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			geschaeftsart: 'reglement',
			knotenId: null,
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: null,
			quotenbasis: 'keine',
			fundstelle: 'Reglement Ziff. 14',
			enthaltungZaehltMit: true
		});
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.quelle).not.toBe('reglement');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'klausel' });
		// Umgestellt und nachgezogen rechnet das Traktandum nach dem Gesetz, nicht nach der Regel.
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'gesetz' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const nach = await erfordernisVon(a);
		expect(nach?.quelle).not.toBe('reglement');
		expect(nach?.gemeinschaftslesart).toMatchObject({ kennung: 'L6', wahl: 'gesetz' });
		expect(nach?.typ).toBe('qualifiziertes_mehr');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});
	// Die Schranke `snapshot_lesart_l6` misst hier kein Test: Die Anwendungsrolle
	// darf `snapshot` nicht ändern («permission denied»), und die Freigabe übernimmt
	// den Wert aus `stweg`, dessen Schranke oben gemessen ist.
});

describe('Im Saal (Kriterien 5, 6 und 8)', () => {
	it('rechnet nach der eingefrorenen Lesart und nennt das abweichende Ergebnis im Protokoll', async () => {
		// Fünf von sechs Eigentümern stimmen zu; der Sechste ist weder da noch
		// vertreten. Eingefroren ist «Nach dem Gesetz»: angenommen (Köpfe 5 von
		// 5, Wertquoten 860 von 1000); nach der Klausel abgelehnt, denn der
		// Abwesende zählt wie ein Nein. Die Gemeinschaft stellt nach der
		// Freigabe zurück, der Saal rechnet trotzdem nach der eingefrorenen Wahl.
		const a = await versammlung('L6 im Saal', '2027-12-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'gesetz' });
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L6: 'klausel' });
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		for (const p of a.parteien.slice(0, 5)) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			a.parteien.slice(0, 5).map((parteiId) => ({ parteiId, wahl: 'yes' })),
			false
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereLesart).toMatchObject({
			kennung: 'L6',
			wahl: 'Klausel anwenden',
			angenommen: false,
			abweichend: true
		});

		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Gezählt nach dem qualifizierten Mehr nach dem Gesetz. Ob eine Klausel gilt, nach der das Reglement nur mit der Zustimmung aller geändert werden kann, ist umstritten. So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.'
		);
		expect(text).toMatch(/Nach der anderen Lesart \(«Klausel anwenden»: .+?\), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen/);
	});
});

/*
 * **Das Rückkommen auf den Beschluss unter «Klausel anwenden»** (Review
 * DeepSeek 05.11.2026, B2; Migration 181): Es trägt die Lesart des Beschlusses
 * durch `agenda_item` bis in `voting_round.requirement_json`, und die Leitung
 * sagt daran denselben Satz wie am Beschluss. Ein von Hand gesetztes Mehr
 * löscht sie.
 */
describe('Rückkommen auf den Beschluss (Migration 181)', () => {
	it('trägt die Lesart des Beschlusses bis in die Abstimmung, ohne zweites Ergebnis', async () => {
		const a = await versammlung('L6 Rückkommen', '2027-12-09');
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
		expect(e?.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel', mitAllen: true });

		// Der Sechste geht: Die Zustimmung aller ist im Saal nicht mehr zu erreichen.
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[5]);
		const vorschau = await holeMehrheitsvorschau(betreiber, a.versammlung, rk.id, e ?? null);
		expect(vorschau?.erreichbarkeitshinweis).toContain(
			'Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern, auch an den abwesenden.'
		);
		expect(vorschau?.erreichbarkeitshinweis).not.toContain('strenge');

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, rk.id);
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ e: Erfordernis }[]>`
				SELECT requirement_json AS e FROM voting_round WHERE agenda_item_id = ${rk.id}
			`
		);
		expect(z.e.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel', mitAllen: true });
		expect(z.e.gemeinschaftslesart).toBeUndefined();
	});

	it('verliert die Lesart, wenn die Leitung das Mehr am Rückkommen von Hand setzt', async () => {
		const a = await versammlung('L6 Rückkommen von Hand', '2027-12-16');
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
		const vorher = await erfordernisVon({ versammlung: a.versammlung, traktandum: rk.id });
		expect(vorher?.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel', mitAllen: true });

		const vonHand = uebersteuere(holeRegelwerk('2026-11-05'), vorher!, 'einstimmigkeit', 'Prüfung: von Hand gesetzt');
		await haltErfordernisAmTraktandumFest(
			handelnder(betreiber),
			a.versammlung,
			rk.id,
			vonHand.ergebnis,
			vonHand.ereignisse
		);
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ r: unknown }[]>`
				SELECT requirement_reading_reconsidered AS r FROM agenda_item WHERE id = ${rk.id}
			`
		);
		expect(z.r).toBeNull();
		expect((await erfordernisVon({ versammlung: a.versammlung, traktandum: rk.id }))?.lesartDesBeschlusses).toBeUndefined();
	});
});
