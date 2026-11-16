/**
 * Die Angaben zum Rückkommen, die der Kern seit F4c B2b versteht, im Server
 * verdrahtet: `mitAllen` an der Lesart des Beschlusses (beim Anlegen des
 * Rückkommens), `rueckkommenAufAnnahme` und `nachRueckkommen` in der Lage der
 * Vorschau (`holeMehrheitsvorschau`) und der Auszählung beim Schliessen
 * (`ergebnisIn`).
 *
 * **Wie gemessen wird.** Was die Angaben bewirken, steht in Sätzen und im
 * festgeschriebenen Ergebnis; wo ein Satz dafür eine Lage bräuchte, die der
 * Durchgang danach nicht mehr hat (eine unerreichbare Mehrheit), liest die
 * Probe die Lage, die der Server dem Kern gibt, über eine durchgereichte
 * Attrappe von `mehrheitsvorschau` und `zaehleAus`. Gerechnet wird mit dem
 * echten Kern.
 *
 * Gemeinschaft und Namen sind erfunden.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/domain/auszaehlung', async (original) => {
	const echt = await original<typeof import('$lib/domain/auszaehlung')>();
	return { ...echt, mehrheitsvorschau: vi.fn(echt.mehrheitsvorschau), zaehleAus: vi.fn(echt.zaehleAus) };
});

import { mehrheitsvorschau, zaehleAus, type Auszaehlungslage } from '$lib/domain/auszaehlung';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import { erfordernisseNachziehen, erstelleReglementsregel } from '$lib/server/reglement';
import { bestaetigeAnwesenheit, erfasseVerlassenDerVersammlung } from '$lib/server/anwesenheit';
import {
	gibStimmenAb,
	holeErgebnis,
	holeMehrheitsvorschau,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { speichereLesarten } from '$lib/server/lesarten';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Rückkommen mit allen');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(async () => {
	await verbindungenSchliessen();
});
beforeEach(() => {
	vi.mocked(mehrheitsvorschau).mockClear();
	vi.mocked(zaehleAus).mockClear();
});

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-gewoehnliche-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [{ frageId: 'f-1', frageText: 'Frage?', antwortId: 'a-1', antwortText: 'Antwort' }],
	quelle: 'hergeleitet'
};

const NAMEN = ['Anna Beispiel', 'Beat Muster', 'Carla Probe', 'Dora Beispiel', 'Emil Muster', 'Fritz Probe'];

/**
 * Eine eröffnete Versammlung mit allen anwesend und einem Traktandum. Ohne
 * `einfach` eine Reglementsänderung unter L6 (Fassung 2026-11-05) nach der Wahl
 * `l6`, sonst ein einfaches Mehr.
 */
async function versammlung(
	name: string,
	datum: string,
	{ l6 = 'klausel', einfach = false, mitRegel = false }: { l6?: 'klausel' | 'gesetz'; einfach?: boolean; mitRegel?: boolean } = {}
) {
	const quoten = einfach ? [340, 330, 330] : [200, 180, 170, 160, 150, 140];
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (const [i, quote] of quoten.entries()) {
		const e = await erstelleEinheit(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: quote },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(betreiber), {
			stwegId: g.id,
			kind: 'natural',
			displayName: NAMEN[i],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(betreiber), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	if (mitRegel) {
		// Eine eigene Regel zum Rückkommen: Das Erfordernis trägt dann ihren
		// Titel, nicht `RUECKKOMMEN_TITEL` (R2-F-3).
		await erstelleReglementsregel(handelnder(betreiber), {
			stwegId: g.id,
			geschaeftsart: 'rueckkommen',
			kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
			kopfbasis: 'anwesend_vertreten',
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: 'alle_quoten',
			fundstelle: 'Reglement Ziff. 99.1',
			enthaltungZaehltMit: true
		});
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
		titel: einfach ? 'Neuer Anstrich im Treppenhaus' : 'Reglement: Hausordnung nur noch mit Zustimmung aller ändern',
		art: 'abstimmung',
		antragswortlaut: einfach
			? 'Das Treppenhaus wird neu gestrichen.'
			: 'Das Reglement wird so geändert, dass die Hausordnung nur noch mit Zustimmung aller Eigentümer geändert werden kann.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	if (einfach) {
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), v.id, t.id, EINFACHES_MEHR);
	} else {
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: v.id, stwegId: g.id },
			t.id,
			'k-reglement-eigene-schranke',
			null
		);
		if (l6 === 'gesetz') {
			await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L6: 'gesetz' });
			await erfordernisseNachziehen(handelnder(betreiber), g.id);
		}
	}
	await gibVersammlungFrei(handelnder(betreiber), v.id);
	await eroeffneVersammlung(handelnder(betreiber), v.id);
	for (const p of parteien) {
		await bestaetigeAnwesenheit(handelnder(betreiber), v.id, p, 'von_hand');
	}
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

type Lage = Awaited<ReturnType<typeof versammlung>>;

/** Alle Ja, ausser `nein` (Rang in `parteien`). */
async function abstimmen(a: Lage, traktandum: string, nein: number[] = []) {
	await oeffneAbstimmung(handelnder(betreiber), a.versammlung, traktandum);
	await gibStimmenAb(
		handelnder(betreiber),
		a.versammlung,
		a.parteien.map((parteiId, i) => ({ parteiId, wahl: nein.includes(i) ? ('no' as const) : ('yes' as const) })),
		false
	);
	const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	return holeErgebnis(betreiber, a.versammlung, d.id);
}

async function traktandum(a: Lage, id: string) {
	const [t] = (await holeTraktanden(betreiber, a.versammlung)).filter((x) => x.knoten.id === id);
	return t;
}

/** Die Vorschau eines Traktandums und die Lage, die der Server dem Kern dafür gab. */
async function vorschau(a: Lage, id: string) {
	vi.mocked(mehrheitsvorschau).mockClear();
	const t = await traktandum(a, id);
	const v = await holeMehrheitsvorschau(betreiber, a.versammlung, id, t.knoten.erfordernis ?? null);
	const aufrufe = vi.mocked(mehrheitsvorschau).mock.calls;
	expect(aufrufe).toHaveLength(1);
	return { vorschau: v, lage: aufrufe[0][0] as Omit<Auszaehlungslage, 'stimmen'> };
}

/** Die Lesart des Beschlusses am Rückkommen, wie sie in der Spalte steht (Migration 181). */
async function spalte(id: string) {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ r: Record<string, unknown> | null }[]>`
			SELECT requirement_reading_reconsidered AS r FROM agenda_item WHERE id = ${id}
		`
	);
	return z.r;
}

describe('Beim Anlegen des Rückkommens (mitAllen)', () => {
	it('trägt der einstimmige Beschluss «mit allen»', async () => {
		const a = await versammlung('Mit allen einstimmig', '2028-02-01');
		expect((await abstimmen(a, a.traktandum)).auszaehlung?.angenommen).toBe(true);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(rk.erfordernis?.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel', mitAllen: true });
		expect(await spalte(rk.id)).toMatchObject({ kennung: 'L6', wahl: 'klausel', mitAllen: true });
	});

	it('trägt der Beschluss mit nur der Mehrheit «nicht mit allen»', async () => {
		// Nach dem Gesetz genügt das qualifizierte Mehr: fünf von sechs.
		const a = await versammlung('Mit allen Mehrheit', '2028-02-02', { l6: 'gesetz' });
		expect((await abstimmen(a, a.traktandum, [5])).auszaehlung?.angenommen).toBe(true);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(rk.erfordernis?.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'gesetz', mitAllen: false });
		expect(await spalte(rk.id)).toMatchObject({ mitAllen: false });
	});
});

describe('Die Vorschau am Rückkommensantrag (rueckkommenAufAnnahme)', () => {
	it('erkennt das Rückkommen auf den angenommenen Beschluss auch unter einer eigenen Regel', async () => {
		/*
		 * Die Regel verlangt mehr als die Hälfte aller Wertquoten, und zwei von
		 * drei gehen: Die Karte sagt dann,
		 * was eine Ablehnung am Rückkommen bedeutet. Der Titel der Regel trägt
		 * `RUECKKOMMEN_TITEL` nicht; nur die Lage sagt dem Kern, dass es eines ist.
		 */
		const a = await versammlung('Rückkommen mit Regel', '2028-02-03', { einfach: true, mitRegel: true });
		await abstimmen(a, a.traktandum);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(rk.erfordernis?.quelle).toBe('reglement');
		expect(rk.erfordernis?.titel.startsWith('Wie der Beschluss')).toBe(false);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[1]);
		await erfasseVerlassenDerVersammlung(handelnder(betreiber), a.versammlung, a.parteien[2]);

		const { vorschau: v, lage } = await vorschau(a, rk.id);
		expect(lage.rueckkommenAufAnnahme).toBe(true);
		expect(lage.nachRueckkommen).toBeUndefined();
		expect(v?.erreichbarkeitshinweis).toContain('Die Versammlung kann den Rückkommensantrag auf Antrag ans Ende');
		expect(v?.erreichbarkeitshinweis).not.toContain('Lassen Sie abstimmen, ist der Antrag abgelehnt.');

		// Am Beschluss selbst ist es keiner.
		expect((await vorschau(a, a.traktandum)).lage.rueckkommenAufAnnahme).toBeUndefined();
	});
});

describe('Der Durchgang nach dem Rückkommen (nachRueckkommen)', () => {
	it('trägt die Angabe in Vorschau und festgeschriebenem Ergebnis, mit Nummer, Durchgang und Ausgängen', async () => {
		/*
		 * Unter «Nach dem Gesetz»: Der Beschluss hatte die Ja-Stimmen aller, das
		 * Rückkommen nur fünf von sechs. Nach der Klausel wäre schon das Rückkommen
		 * abgelehnt gewesen (B2-F-6), und das zweite Ergebnis im Durchgang danach
		 * sagt das mit der Nummer des Rückkommens.
		 */
		const a = await versammlung('Nach dem Rückkommen', '2028-02-04', { l6: 'gesetz' });
		const erst = await abstimmen(a, a.traktandum);
		expect(erst.auszaehlung?.angenommen).toBe(true);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		// Die Nummer, wie die Leitung sie zeigt; vor dem Traktandum stehen die festen.
		const nummer = (await traktandum(a, rk.id)).nummer;
		expect(nummer).toBe(`${(await traktandum(a, a.traktandum)).nummer}.1`);

		// Vor dem Rückkommen ist der Beschluss noch kein Durchgang danach.
		expect((await vorschau(a, a.traktandum)).lage.nachRueckkommen).toBeUndefined();
		expect((await vorschau(a, rk.id)).lage.rueckkommenAufAnnahme).toBe(true);

		expect((await abstimmen(a, rk.id, [5])).auszaehlung?.angenommen).toBe(true);
		const erwartet = {
			traktandum: nummer,
			geltenderDurchgang: erst.durchgang.nummer,
			beschlussMitAllen: true,
			rueckkommenMitAllen: false
		};
		expect((await vorschau(a, a.traktandum)).lage.nachRueckkommen).toEqual(erwartet);

		// Beim Schliessen, obwohl der Durchgang das Rückkommen da schon verbraucht.
		vi.mocked(zaehleAus).mockClear();
		const zweit = await abstimmen(a, a.traktandum, [5]);
		const amSchliessen = vi.mocked(zaehleAus).mock.calls.map((c) => c[0].nachRueckkommen);
		expect(amSchliessen).toContainEqual(erwartet);
		expect(zweit.auszaehlung?.angenommen).toBe(true);
		expect(zweit.auszaehlung?.andereLesart).toMatchObject({
			kennung: 'L6',
			angenommen: false,
			nachRueckkommen: true,
			schonRueckkommenAbgelehnt: nummer
		});

		// Festgeschrieben: gelesen, nicht neu gerechnet, und nach dem Ersetzen gleich.
		const [z] = await imKontext(betreiber, (tx) =>
			tx<{ r: { andereLesart?: Record<string, unknown> } }[]>`
				SELECT result_json AS r FROM voting_round WHERE id = ${zweit.durchgang.id}
			`
		);
		expect(JSON.stringify(z.r)).toContain(`"schonRueckkommenAbgelehnt":"${nummer}"`);
		// Danach wartet kein Rückkommen mehr.
		expect((await vorschau(a, a.traktandum)).lage.nachRueckkommen).toBeUndefined();
	});

	it('trägt sie auch am Folgeantrag, über den der Durchgang nach dem Rückkommen läuft', async () => {
		const a = await versammlung('Folgeantrag nach Rückkommen', '2028-02-05', { l6: 'gesetz' });
		const erst = await abstimmen(a, a.traktandum);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		await abstimmen(a, rk.id);
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Nur die Gartenordnung',
				art: 'abstimmung',
				antragswortlaut: 'Nur die Gartenordnung wird so geändert.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		// Das Mehr des Grundantrags: Ein milderes liesse die Einladung nicht zu.
		const mehr = (await traktandum(a, a.traktandum)).knoten.erfordernis!;
		await haltErfordernisAmTraktandumFest(handelnder(betreiber), a.versammlung, f.id, mehr);
		const erwartet = {
			traktandum: (await traktandum(a, rk.id)).nummer,
			geltenderDurchgang: erst.durchgang.nummer,
			beschlussMitAllen: true,
			rueckkommenMitAllen: true
		};
		expect((await vorschau(a, f.id)).lage.nachRueckkommen).toEqual(erwartet);

		vi.mocked(zaehleAus).mockClear();
		await abstimmen(a, f.id, [5]);
		expect(vi.mocked(zaehleAus).mock.calls.map((c) => c[0].nachRueckkommen)).toContainEqual(erwartet);
	});

	it('fehlt nach einem Rückkommen auf einen abgelehnten Antrag', async () => {
		const a = await versammlung('Rückkommen auf Ablehnung', '2028-02-06', { einfach: true });
		expect((await abstimmen(a, a.traktandum, [0, 1])).auszaehlung?.angenommen).toBe(false);
		const rk = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, a.traktandum);
		expect((await vorschau(a, rk.id)).lage.rueckkommenAufAnnahme).toBe(false);
		await abstimmen(a, rk.id);
		expect((await vorschau(a, a.traktandum)).lage.nachRueckkommen).toBeUndefined();
	});
});
