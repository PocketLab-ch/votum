/**
 * Lesart L17 in der Datenhaltung (Migration 196, Fassung 2026-11-20).
 *
 * Gemessen wird an L17, was `lesart-luxurioes.test.ts` an L12 misst: Spalte und
 * Vorgabe, die Datenbankschranke, das Umstellen mit Verlauf, die Absage und das
 * Nachziehen vor der Freigabe, das Einfrieren bei der Freigabe und dass das
 * Traktandum die Lesart trägt, nach der Umstellung mit der Wahl «svit» (die
 * Form `agenda_item_lesart_form` kennt sie erst ab Migration 196). Namen und
 * Adressen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { erstelleTraktandum, holeTraktanden, setzeGewaehltesErfordernis } from '$lib/server/traktanden';
import {
	aendereReglementsregelAn,
	erfordernisseNachziehen,
	erstelleReglementsregel,
	veralteteErfordernisse
} from '$lib/server/reglement';
import { FONDSENTNAHME_VERALTET } from '$lib/domain/freigabe';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { L17_FRAGE } from '$lib/domain/lesarten';
import { ENTNAHME_ID, VEREINBART_ID } from '$lib/rules/quorum-2026-11-20';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L17');
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

/** Eine Versammlung im Entwurf mit einem Traktandum zur Bezahlung aus dem Fonds an der genannten Karte. */
async function versammlung(
	name: string,
	datum: string,
	knotenId: string = ENTNAHME_ID,
	/** Was vor dem Erfordernis an der Gemeinschaft geschieht, etwa eine Regel hinterlegen. */
	vorher?: (stwegId: string) => Promise<unknown>
) {
	const g = await gemeinschaft(name);
	if (vorher) await vorher(g.id);
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
			displayName: ['Erfunden Anna', 'Erfunden Beat'][nummer]!,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Erfundenweg 17',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Dachsanierung aus dem Erneuerungsfonds bezahlen',
		art: 'abstimmung',
		antragswortlaut: 'Die Dachsanierung wird aus dem Erneuerungsfonds bezahlt.',
		antragstellerart: 'gemeinschaft',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(handelnder(betreiber), { meetingId: v.id, stwegId: g.id }, t.id, knotenId, null);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

describe('Spalte, Vorgabe und Umstellen', () => {
	it('steht ohne Eingriff auf «streng»; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L17 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L17).toBe('streng');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l17 = 'einfach' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l17/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L17 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L17: 'svit' });
		expect((await holeLesarten(betreiber, { stwegId: g.id })).L17).toBe('svit');
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L17',
			frage: L17_FRAGE,
			vorher: 'Strengere Auffassung (Vorgabe)',
			nachher: 'Nach dem SVIT-Kommentar',
			rolle: 'admin'
		});
	});
});

describe('Am Traktandum und bei der Freigabe', () => {
	it('trägt die Lesart nach der Vorgabe: qualifiziertes Mehr', async () => {
		const a = await versammlung('L17 Vorgabe', '2027-12-11');
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('qualifiziertes_mehr');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L17', wahl: 'streng', vorgabe: true });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L17).toBe('streng');
	});

	it('sagt nach einer Umstellung ab, zieht nach und friert die Wahl ein', async () => {
		const a = await versammlung('L17 nachziehen', '2027-12-12');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'svit' });
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(
			/das Mehr auf der Seite «Lesarten» der Gemeinschaft/
		);

		// Das Nachziehen schreibt «svit» ans Traktandum; die Form dafür kennt erst Migration 196.
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einfaches_mehr');
		expect(e?.quotenbasis).toBe('keine');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L17', wahl: 'svit', vorgabe: false });

		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'streng' });
		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L17).toBe('svit');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L17).toBe('svit');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L17).toBe('streng');
	});

	it('trägt an der vereinbarten Verwendung nach der Vorgabe die Zustimmung aller', async () => {
		const a = await versammlung('L17 vereinbart', '2027-12-13', VEREINBART_ID);
		const e = await erfordernisVon(a);
		expect(e?.typ).toBe('einstimmigkeit');
		expect(e?.gemeinschaftslesart).toMatchObject({ kennung: 'L17', wahl: 'streng' });
	});
	// Die Schranke `snapshot_lesart_l17` misst hier kein Test, wie bei L12: Die
	// Anwendungsrolle darf `snapshot` nicht ändern, und die Freigabe übernimmt den
	// Wert aus `stweg`, dessen Schranke oben gemessen ist.
});

/*
 * **Unter einer Regel des Reglements** (Codeprüfung L17, A): An den Karten mit
 * L17 entscheidet die Wahl, ob und welche Regel gilt. Das Traktandum speichert
 * dann keine Lesart; nach einer Umstellung muss die Freigabe trotzdem absagen,
 * und der Kasten «Erfordernisse nachziehen» muss es zeigen.
 */
describe('Unter einer Regel des Reglements', () => {
	/** Eine Regel für die wichtigeren Verwaltungshandlungen (erfunden). */
	const regel = (stwegId: string, knotenId: string | null, strenger: boolean) =>
		erstelleReglementsregel(handelnder(betreiber), {
			stwegId,
			geschaeftsart: 'verwaltung_wichtig',
			knotenId,
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: strenger ? { zaehler: 2, nenner: 3, art: 'mindestens' } : { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: strenger ? 'alle_quoten' : 'keine',
			quotenSchwelle: strenger ? { zaehler: 1, nenner: 2, art: 'mehr_als' } : null,
			fundstelle: 'Reglement Art. 97 (erfunden)',
			enthaltungZaehltMit: true
		});

	it('streng nach svit: Die strengere allgemeine Regel fällt weg, die Freigabe sagt ab', async () => {
		const a = await versammlung('L17 Regel allgemein', '2027-12-14', ENTNAHME_ID, (id) => regel(id, null, true));
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'svit' });
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).length).toBe(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.quelle).not.toBe('reglement');
		expect(e?.typ).toBe('einfaches_mehr');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('svit nach streng: Die mildere fallgenaue Regel fällt weg, die Freigabe sagt ab', async () => {
		const a = await versammlung('L17 Regel fallgenau', '2027-12-15', ENTNAHME_ID, async (id) => {
			await speichereLesarten(handelnder(betreiber), 'admin', id, { L17: 'svit' });
			await regel(id, ENTNAHME_ID, false);
		});
		const vorher = await erfordernisVon(a);
		expect(vorher?.quelle).toBe('reglement');
		expect(vorher?.quotenbasis).toBe('keine');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'streng' });
		expect((await veralteteErfordernisse(betreiber, a.gemeinschaft)).length).toBe(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.typ).toBe('qualifiziertes_mehr');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('sagt nach einer bloss geänderten Regel ab, mit eigener Ursache statt «Lesarten umgestellt» (M1)', async () => {
		let regelId = '';
		const a = await versammlung('L17 Regel berichtigt', '2027-12-17', ENTNAHME_ID, async (id) => {
			regelId = (await regel(id, null, true)).id;
		});
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		// Gleiche Lesart, nur die Fundstelle berichtigt.
		await aendereReglementsregelAn(handelnder(betreiber), a.gemeinschaft, regelId, {
			geschaeftsart: 'verwaltung_wichtig',
			knotenId: null,
			kopfbasis: 'anwesend_vertreten',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quotenbasis: 'alle_quoten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			fundstelle: 'Reglement Art. 96 (erfunden)',
			enthaltungZaehltMit: true
		});
		const absage = gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await expect(absage).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.not.toThrow(/Lesarten der Gemeinschaft wurden umgestellt/);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('sagt nicht ab, wenn dieselbe Regel nach beiden Wahlen gilt', async () => {
		// Eine strengere Regel für genau diesen Fall gilt nach beiden Wahlen.
		const a = await versammlung('L17 Regel bleibt', '2027-12-16', ENTNAHME_ID, (id) => regel(id, ENTNAHME_ID, true));
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'svit' });
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});
});
