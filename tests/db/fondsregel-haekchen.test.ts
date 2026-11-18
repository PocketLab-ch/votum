/**
 * Das Häkchen «Begründungsakt oder Zustimmung aller» an einer Reglementsregel in
 * der Datenhaltung (Migration 197, Fassung 2026-11-21; Produktentscheid
 * 17.11.2026, «Häkchen, sonst Hinweis»).
 *
 * Gemessen werden Spalte und Vorgabe, Anlegen und Ändern mit Verlauf in Worten,
 * beide Leser (`reglement.ts` für die Seite, `erfordernisse.ts` für Herleitung,
 * Freigabe und Kasten), und dass Freigabe und Kasten «Erfordernisse nachziehen»
 * ein Traktandum als veraltet erkennen, wenn das Häkchen das Mehr ändert, und
 * seit Migration 198 auch, wenn es nur den Satz an der Karte ändert (strengere
 * Regel, vereinbarte Verwendung). Nach der Freigabe zeigt die Karte den Satz von
 * damals (Entscheid des Auftraggebers vom 18.11.2026, «Auch Häkchen
 * einfrieren»). Namen, Adressen und Fundstellen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, nimmVersammlungsfreigabeZurueck } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	regelanwendungAmTraktandum,
	setzeGewaehltesErfordernis
} from '$lib/server/traktanden';
import {
	aendereReglementsregelAn,
	erfordernisseNachziehen,
	erstelleReglementsregel,
	holeReglementsregeln,
	veralteteErfordernisse
} from '$lib/server/reglement';
import {
	FONDSENTNAHME_MIT_HAEKCHEN,
	FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN,
	haekchenZusatz,
	karteMitReglement,
	type ReglementsregelEingabe
} from '$lib/domain/reglement';
import { FONDSENTNAHME_HAEKCHEN_VERALTET, FONDSENTNAHME_VERALTET } from '$lib/domain/freigabe';
import { ergebniskarte, waehleErfordernis } from '$lib/domain/entscheidbaum';
import { knotenNachLesart, LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { holeRegelwerk } from '$lib/rules';
import { speichereLesarten } from '$lib/server/lesarten';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft, setzeErfordernisAmGeschaeft } from '$lib/server/geschaeft';
import { uebernimmTraktanden } from '$lib/server/vorlagen';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { ENTNAHME_ID, VEREINBART_ID } from '$lib/rules/quorum-2026-11-20';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Häkchen Fondsregel');
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

/** Eine Regel (erfunden): mild ist das einfache Mehr der Köpfe, strenger zwei Drittel und mehr als die Hälfte aller Wertquoten. */
function regelEingabe(stwegId: string, u: { strenger?: boolean; gesichert?: boolean; knotenId?: string | null } = {}) {
	const strenger = u.strenger ?? false;
	return {
		stwegId,
		geschaeftsart: 'verwaltung_wichtig',
		knotenId: u.knotenId === undefined ? ENTNAHME_ID : u.knotenId,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: strenger ? { zaehler: 2, nenner: 3, art: 'mindestens' } : { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: strenger ? 'alle_quoten' : 'keine',
		quotenSchwelle: strenger ? { zaehler: 1, nenner: 2, art: 'mehr_als' } : null,
		fundstelle: 'Reglement Art. 98 (erfunden)',
		enthaltungZaehltMit: true,
		...(u.gesichert === undefined ? {} : { gesichert: u.gesichert })
	} satisfies ReglementsregelEingabe;
}

/** Eine Versammlung im Entwurf mit einem Traktandum zur Bezahlung aus dem Fonds; `vorher` läuft vor dem Erfordernis. */
async function versammlung(name: string, datum: string, vorher?: (stwegId: string) => Promise<unknown>) {
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
			displayName: ['Erfunden Clara', 'Erfunden Dario'][nummer]!,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
	}
	const v = await erstelleVersammlung(handelnder(betreiber), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Erfundenweg 21',
		art: 'ausserordentlich',
		anlass: 'Prüflauf',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(betreiber), {
		meetingId: v.id,
		parentId: null,
		titel: 'Fassadensanierung aus dem Erneuerungsfonds bezahlen',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassadensanierung wird aus dem Erneuerungsfonds bezahlt.',
		antragstellerart: 'gemeinschaft',
		betroffeneParteiIds: []
	});
	await setzeGewaehltesErfordernis(handelnder(betreiber), { meetingId: v.id, stwegId: g.id }, t.id, ENTNAHME_ID, null);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id };
}

async function erfordernisVon(a: { versammlung: string; traktandum: string }) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === a.traktandum);
	return t.knoten.erfordernis;
}

/** Ändert nur das Häkchen einer bestehenden Regel. */
async function setzeHaekchen(stwegId: string, regelId: string, gesichert: boolean, strenger = false) {
	const { stwegId: _s, ...rest } = regelEingabe(stwegId, { strenger, gesichert });
	return aendereReglementsregelAn(handelnder(betreiber), stwegId, regelId, rest);
}

describe('Spalte, Anlegen und Ändern', () => {
	it('steht ohne Angabe auf nein; die Spalte lässt kein leeres Feld zu', async () => {
		const g = await gemeinschaft('Häkchen Vorgabe');
		const r = await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id));
		expect((await holeReglementsregeln(betreiber, g.id))[0].gesichert).toBe(false);
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE bylaw_quorum_rule SET founding_or_unanimous = NULL WHERE id = ${r.id}`)
		).rejects.toThrow(/founding_or_unanimous/);
	});

	it('speichert das Häkchen nur, wo es wirken kann', async () => {
		const g = await gemeinschaft('Häkchen gespeichert');
		await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id, { gesichert: true }));
		await erstelleReglementsregel(handelnder(betreiber), {
			...regelEingabe(g.id, { gesichert: true, knotenId: null }),
			geschaeftsart: 'baulich_notwendig'
		});
		const regeln = await holeReglementsregeln(betreiber, g.id);
		expect(regeln.find((r) => r.geschaeftsart === 'verwaltung_wichtig')?.gesichert).toBe(true);
		expect(regeln.find((r) => r.geschaeftsart === 'baulich_notwendig')?.gesichert).toBe(false);
	});

	it('übernimmt das Häkchen, wenn dieselbe Regel neu hinterlegt wird (`ON CONFLICT`, Featureprüfung 17.11.2026)', async () => {
		const g = await gemeinschaft('Häkchen ersetzt');
		await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id));
		await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id, { gesichert: true }));
		let regeln = await holeReglementsregeln(betreiber, g.id);
		expect(regeln).toHaveLength(1);
		expect(regeln[0].gesichert).toBe(true);
		await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id, { gesichert: false }));
		regeln = await holeReglementsregeln(betreiber, g.id);
		expect(regeln).toHaveLength(1);
		expect(regeln[0].gesichert).toBe(false);
	});

	it('hält die Änderung im Verlauf fest, mit Vorzustand und neuem Wert in Worten', async () => {
		const g = await gemeinschaft('Häkchen Verlauf');
		const r = await erstelleReglementsregel(handelnder(betreiber), regelEingabe(g.id));
		const { geaendert } = await setzeHaekchen(g.id, r.id, true);
		expect(geaendert).toBe(true);
		expect((await holeReglementsregeln(betreiber, g.id))[0].gesichert).toBe(true);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.reglementsregelGeaendert}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			felder: ['gesichert'],
			vorher: { gesichert: 'nicht vermerkt' },
			nachher: { gesichert: 'im Begründungsakt oder mit Zustimmung aller' }
		});
	});
});

describe('Am Traktandum, bei der Freigabe und im Kasten «nachziehen»', () => {
	it('rechnet eine mildere Regel mit Häkchen schon beim Herleiten (Leser `erfordernisse.ts`)', async () => {
		const a = await versammlung('Häkchen vorher', '2027-12-20', (id) =>
			erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { gesichert: true }))
		);
		const e = await erfordernisVon(a);
		expect(e?.fassung).toBe('2026-11-25');
		expect(e?.quelle).toBe('reglement');
		expect(e?.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('Häkchen gesetzt: Die mildere Regel gilt neu, die Freigabe sagt ab, der Kasten zieht nach', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen gesetzt', '2027-12-21', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id))).id;
		});
		expect((await erfordernisVon(a))?.typ).toBe('qualifiziertes_mehr');
		await setzeHaekchen(a.gemeinschaft, regelId, true);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const e = await erfordernisVon(a);
		expect(e?.quelle).toBe('reglement');
		expect(e?.fundstelle).toBe('Reglement Art. 98 (erfunden)');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('Häkchen entfernt: Die mildere Regel fällt weg, die Freigabe sagt ab', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen entfernt', '2027-12-22', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { gesichert: true }))).id;
		});
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		await setzeHaekchen(a.gemeinschaft, regelId, false);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.typ).toBe('qualifiziertes_mehr');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('Ohne Häkchen: Eine strengere Regel kommt nach dem Traktandum dazu, die Freigabe sagt ab (Codeprüfung N1)', async () => {
		// Das Traktandum rechnet nach dem Gesetz; die strengere Regel kommt erst danach.
		const a = await versammlung('Regel danach', '2027-12-24');
		const vorher = await erfordernisVon(a);
		expect(vorher?.quelle).not.toBe('reglement');
		expect(vorher?.typ).toBe('qualifiziertes_mehr');
		await erstelleReglementsregel(handelnder(betreiber), regelEingabe(a.gemeinschaft, { strenger: true }));
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	/**
	 * **Eingefroren ist das gespeicherte Erfordernis** (Entscheid 0057, «Was eingefroren ist
	 * und was live kommt»; Featureprüfung 17.11.2026, bis dahin nur gemessen). Nach der
	 * Freigabe ändert das Häkchen das Erfordernis des Traktandums nicht, in beide Richtungen;
	 * der Kasten zeigt es als veraltet. Eigenen Biss hat die Probe nicht: Auch im Entwurf
	 * ändert das Häkchen kein gespeichertes Erfordernis (Codeprüfung des Nachtrags, N4).
	 */
	it('nach der Freigabe ändert das Häkchen das gespeicherte Erfordernis nicht, gesetzt wie entfernt', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen nach Freigabe', '2027-12-25', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id))).id;
		});
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		const vorher = await erfordernisVon(a);
		expect(vorher?.typ).toBe('qualifiziertes_mehr');
		await setzeHaekchen(a.gemeinschaft, regelId, true);
		expect(await erfordernisVon(a)).toEqual(vorher);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);

		let mitRegel = '';
		const b = await versammlung('Häkchen nach Freigabe entfernt', '2027-12-26', async (id) => {
			mitRegel = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { gesichert: true }))).id;
		});
		await gibVersammlungFrei(handelnder(betreiber), b.versammlung);
		const davor = await erfordernisVon(b);
		expect(davor?.quelle).toBe('reglement');
		await setzeHaekchen(b.gemeinschaft, mitRegel, false);
		expect(await erfordernisVon(b)).toEqual(davor);
		expect(await veralteteErfordernisse(betreiber, b.gemeinschaft)).toHaveLength(1);
	});

	/**
	 * **Seit Migration 198 veraltet, auch bei gleichem Mehr** (Entscheid des
	 * Auftraggebers vom 18.11.2026, «Auch Häkchen einfrieren»). Bis dahin gab es
	 * hier nichts nachzuziehen, und der Satz an der Karte kam live.
	 */
	it('Häkchen an einer strengeren Regel vor der Freigabe: Das Mehr bleibt, das Traktandum ist trotzdem veraltet', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen strenger', '2027-12-23', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true }))).id;
		});
		const vorher = await erfordernisVon(a);
		expect(vorher?.quelle).toBe('reglement');
		expect(vorher?.regelGesichert).toBe(false);
		await setzeHaekchen(a.gemeinschaft, regelId, true, true);
		const kasten = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(kasten).toHaveLength(1);
		expect(kasten[0].bisher).toContain(haekchenZusatz(false));
		expect(kasten[0].neu).toContain(haekchenZusatz(true));
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_HAEKCHEN_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		const nachher = await erfordernisVon(a);
		expect(nachher?.regelGesichert).toBe(true);
		expect(nachher?.kopfSchwelle).toEqual(vorher?.kopfSchwelle);
		expect(nachher?.quotenSchwelle).toEqual(vorher?.quotenSchwelle);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		// Die Abschrift für die Einladung (Migration 144) trägt das Häkchen mit.
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ g: boolean | null }[]>`
				SELECT (released_requirement->>'regelGesichert')::boolean AS g FROM agenda_item WHERE id = ${a.traktandum}
			`
		);
		expect(z.g).toBe(true);
	});

	/**
	 * **Den Grund «haekchen» gibt es auch ohne geändertes Häkchen** (Codeprüfung des
	 * Einfrierens, N1; Laienprüfung L-3): Unter «svit» hängt kein Satz am Häkchen, das
	 * Traktandum trägt keines; zurück auf «streng» hängt wieder einer daran. Die Absage
	 * nennt deshalb einen Zustand, und der Kasten sagt links «nicht vermerkt».
	 */
	it('L17 von «svit» zurück auf «streng» an einer strengeren Regel: veraltet, Häkchen «nicht vermerkt»', async () => {
		const a = await versammlung('Häkchen svit streng', '2027-12-30', async (id) => {
			await speichereLesarten(handelnder(betreiber), 'admin', id, { L17: 'svit' });
			await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true }));
		});
		expect((await erfordernisVon(a))?.quelle).toBe('reglement');
		expect((await erfordernisVon(a))?.regelGesichert).toBeUndefined();
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L17: 'streng' });
		const kasten = await veralteteErfordernisse(betreiber, a.gemeinschaft);
		expect(kasten).toHaveLength(1);
		expect(kasten[0].bisher).toContain(haekchenZusatz(null));
		expect(kasten[0].neu).toContain(haekchenZusatz(false));
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_HAEKCHEN_VERALTET);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.regelGesichert).toBe(false);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	});

	it('die Übernahme in eine andere Versammlung nimmt das Häkchen mit (`kopiereTraktandumIn`, Codeprüfung N5)', async () => {
		const a = await versammlung('Häkchen Übernahme', '2027-12-31', (id) =>
			erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true, gesichert: true }))
		);
		expect((await erfordernisVon(a))?.regelGesichert).toBe(true);
		const ziel = await erstelleVersammlung(handelnder(betreiber), {
			stwegId: a.gemeinschaft,
			datum: '2028-01-14',
			uhrzeit: '19:00',
			ort: 'Erfundenweg 21',
			art: 'ausserordentlich',
			anlass: 'Prüflauf',
			stufe: 'erste',
			betriebsart: 'gefuehrt'
		});
		await uebernimmTraktanden(handelnder(betreiber), ziel.id, [a.traktandum]);
		const kopie = (await holeTraktanden(betreiber, ziel.id)).find((t) => t.knoten.titel.startsWith('Fassadensanierung'));
		expect(kopie?.knoten.erfordernis?.regelGesichert).toBe(true);
	});

	it('Häkchen an der Regel zur vereinbarten Verwendung vor der Freigabe: veraltet', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen vereinbart', '2027-12-27', async (id) => {
			regelId = (
				await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true, knotenId: null }))
			).id;
		});
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			VEREINBART_ID,
			ENTNAHME_ID
		);
		const vorher = await erfordernisVon(a);
		expect(vorher?.typ).toBe('einstimmigkeit');
		expect(vorher?.regelGesichert).toBe(false);
		const { stwegId: _s, ...rest } = regelEingabe(a.gemeinschaft, { strenger: true, knotenId: null, gesichert: true });
		await aendereReglementsregelAn(handelnder(betreiber), a.gemeinschaft, regelId, rest);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);
		await expect(gibVersammlungFrei(handelnder(betreiber), a.versammlung)).rejects.toThrow(FONDSENTNAHME_HAEKCHEN_VERALTET);
	});
});

/**
 * **Nach der Freigabe der Satz von damals** (Migration 198; Entscheid des
 * Auftraggebers vom 18.11.2026: «Das Häkchen kommt beim Freigeben in die
 * Momentaufnahme, und die Karte zeigt danach den damaligen Satz.»). Die Karte
 * entsteht wie auf der Erfordernisseite: `regelanwendungAmTraktandum`, dann
 * `karteMitReglement`.
 */
describe('Nach der Freigabe: Karte, Kasten und Übernehmen mit dem Häkchen von damals', () => {
	async function karteAmTraktandum(a: { gemeinschaft: string; versammlung: string; traktandum: string }) {
		const rw = holeRegelwerk();
		const k = rw.knoten.find((x) => x.id === ENTNAHME_ID)!;
		const hergeleitet = waehleErfordernis(rw, ENTNAHME_ID).ergebnis!;
		const angewandt = await regelanwendungAmTraktandum(
			betreiber,
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			hergeleitet
		);
		const karte = karteMitReglement(
			ergebniskarte(rw, knotenNachLesart(rw, k, LESARTEN_VORGABE)),
			angewandt.regel,
			angewandt.vorbehalt,
			null,
			null,
			angewandt.lesart,
			hergeleitet,
			angewandt.verdraengt,
			angewandt.fondsregel
		);
		return { angewandt, satz: karte.reglementsvorbehalt ?? '' };
	}

	it('ohne Häkchen freigegeben, danach gesetzt und wieder entfernt: H3 bleibt', async () => {
		let regelId = '';
		const a = await versammlung('Damals ohne Häkchen', '2027-12-28', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true }))).id;
		});
		expect((await karteAmTraktandum(a)).satz).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);

		await setzeHaekchen(a.gemeinschaft, regelId, true, true);
		const gesetzt = await karteAmTraktandum(a);
		expect(gesetzt.satz).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(gesetzt.satz).not.toContain(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);

		// «Übernehmen» hält fest, was die Karte zeigt, also das Häkchen von damals.
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, a.traktandum, gesetzt.angewandt.erfordernis);
		expect((await erfordernisVon(a))?.regelGesichert).toBe(false);
		await erfordernisseNachziehen(handelnder(betreiber), a.gemeinschaft);
		expect((await erfordernisVon(a))?.regelGesichert).toBe(false);

		await setzeHaekchen(a.gemeinschaft, regelId, false, true);
		expect((await karteAmTraktandum(a)).satz).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
	});

	it('ein Geschäft des Abends, nach der Freigabe neu gesetzt, behält das Häkchen von damals (Codeprüfung M1)', async () => {
		let regelId = '';
		const a = await versammlung('Häkchen am Abend', '2028-01-05', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true }))).id;
		});
		const tag = await erstelleVersammlungstag(handelnder(betreiber), {
			bezeichnung: 'Häkchen am Abend, erfunden',
			datum: '2028-01-05',
			uhrzeit: '19:00',
			ort: 'Erfundenweg 21',
			art: 'ausserordentlich',
			anlass: 'Prüflauf'
		});
		await nimmInTagAuf(handelnder(betreiber), tag.id, a.versammlung, 0);
		const g = await erstelleGeschaeft(handelnder(betreiber), tag.id, {
			titel: 'Dachsanierung aus dem Erneuerungsfonds bezahlen, erfunden',
			antragswortlaut: 'Die Dachsanierung wird aus dem Erneuerungsfonds bezahlt.',
			art: 'abstimmung',
			erfordernis: ENTNAHME_ID,
			meetingIds: [a.versammlung]
		});
		const amAbend = async () =>
			(
				await imKontext(betreiber, (tx) =>
					tx<{ g: boolean | null }[]>`SELECT requirement_rule_secured AS g FROM agenda_item WHERE business_id = ${g.id}`
				)
			)[0].g;
		expect(await amAbend()).toBe(false);
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await setzeHaekchen(a.gemeinschaft, regelId, true, true);
		await setzeErfordernisAmGeschaeft(handelnder(betreiber), tag.id, g.id, ENTNAHME_ID);
		expect(await amAbend()).toBe(false);
	});

	it('mit Häkchen freigegeben, danach entfernt: H4 bleibt; nach der Rücknahme wieder live', async () => {
		let regelId = '';
		const a = await versammlung('Damals mit Häkchen', '2027-12-29', async (id) => {
			regelId = (await erstelleReglementsregel(handelnder(betreiber), regelEingabe(id, { strenger: true, gesichert: true }))).id;
		});
		await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
		await setzeHaekchen(a.gemeinschaft, regelId, false, true);
		const entfernt = await karteAmTraktandum(a);
		expect(entfernt.satz).toContain(FONDSENTNAHME_MIT_HAEKCHEN);
		expect(entfernt.satz).not.toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toEqual([]);

		// Im Entwurf gilt wieder das Häkchen der Gemeinschaft, und das Traktandum ist veraltet.
		await nimmVersammlungsfreigabeZurueck(handelnder(betreiber), a.versammlung, 'Prüflauf, erfunden');
		expect((await karteAmTraktandum(a)).satz).toContain(FONDSENTNAHME_STRENGER_OHNE_HAEKCHEN);
		expect(await veralteteErfordernisse(betreiber, a.gemeinschaft)).toHaveLength(1);
	});
});
