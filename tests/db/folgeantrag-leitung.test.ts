/**
 * Der Folgeantrag nach einem angenommenen Rückkommen, an der Leitung (Plan
 * `docs/plan-folgeantrag-nach-rueckkommen-2026-09-30.md`, Block B2a).
 *
 * **Produktentscheid 30.09.2026:** Nach einem angenommenen Rückkommen darf
 * statt des alten Antrags ein Folgeantrag zur Abstimmung kommen, «statt des
 * alten». Server und Kern können das seit B1
 * (`folgeantrag-nach-rueckkommen.test.ts`). Hier geprüft wird, was die
 * Leitung davon sieht: Die Codeprüfung zu B1 fand den Aufnahmeweg in der
 * Oberfläche unerreichbar, Knöpfe, die in eine Absage führten, und Leser, die
 * das ersetzte Grundtraktandum für unbehandelt hielten.
 *
 * **Gemessen wird an den Loadern beider Leitungsseiten** (Haus und Abend),
 * nicht an einer Nachbildung ihrer Rechnung. Jede Auskunft wird gegen den
 * Server gehalten: Wo die Seite «abstimmbar» sagt, eröffnet er, und wo sie es
 * nicht sagt, weist er mit demselben Satz ab.
 *
 * **Eine Grenze, ausdrücklich** (Codeprüfung B2a, M4). Was die Svelte-Seite
 * des Hauses aus dem Loader rechnet (Auswahl der Grundanträge, «Jetzt
 * möglich»), lässt sich hier nicht laden; `grundantraege()` und `eingriffe()`
 * bilden es nach. Verlöre die Seite die Weitergabe, blieben diese Proben
 * grün. Das deckt erst der Durchstich im Browser (Block B3).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, stelleAufTraktandum } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, holeTafel, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	haltErfordernisAmTraktandumFest,
	holeTraktanden,
	nimmTraktandumAuf,
	ziehAntragZurueck,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	holeEntschiedeneAmAbend,
	holeErgebnis,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { holeHausbeschluesseZumGeschaeft } from '$lib/server/weisungsquellen';
import { leiteWeisungenAbSammel, setzeWeisungsbindung, trageOhneBeschlussEin } from '$lib/server/weisung';
import { taugtAlsGrundantrag } from '$lib/domain/folgeantrag';
import { moeglicheEingriffe } from '$lib/domain/eingriffe';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { load } from '../../src/routes/versammlungen/[id=kennung]/leitung/+page.server';
import type { PageData } from '../../src/routes/versammlungen/[id=kennung]/leitung/$types';
import { load as abendLoad } from '../../src/routes/tage/[id=kennung]/leitung/+page.server';
import type { PageData as Abenddaten } from '../../src/routes/tage/[id=kennung]/leitung/$types';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder() {
	return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
}

const ERFORDERNIS: Erfordernis = {
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

type Wahl = 'yes' | 'no';

/**
 * Eine Gemeinschaft mit drei Parteien, je eine Einheit.
 *
 * Mit `gleichstand` vier Parteien und Stichentscheid nach Wertquoten: 2 zu 2
 * aus einer Handzählung lässt ihn offen, und nur ein solcher Durchgang lässt
 * sich seit H6 noch mit einer Neuabstimmung überholen.
 */
async function gemeinschaft(name: string, gleichstand = false) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		...(gleichstand ? { tieBreak: 'wertquote' as const, tieBreakRuleSource: 'Art. 30 Reglement' } : {})
	});
	const namen = ['Muster A', 'Muster B', 'Muster C', ...(gleichstand ? ['Muster D'] : [])];
	for (const [i, wer] of namen.entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 900 / namen.length },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
	}
	return g.id;
}

/** Das Traktandum «Fassadensanierung»; daneben stehen Punkte aus der Vorlage. */
async function geschaeft(versammlungId: string): Promise<string> {
	const t = (await holeTraktanden(betreiber, versammlungId)).find(
		(x) => x.knoten.titel === 'Fassadensanierung'
	);
	if (!t) throw new Error(`Kein Punkt «Fassadensanierung» in ${versammlungId}`);
	return t.knoten.id;
}

/**
 * Eine laufende Versammlung auf einem Abend, mit einem angekündigten Antrag
 * «Fassadensanierung», noch nicht abgestimmt. Der Abend, damit dieselbe Lage
 * auch die Tafel und den Entscheidstand des Abends zeigt.
 */
async function versammlung(name: string, datum: string, mitMehr = true, gleichstand = false) {
	const stweg = await gemeinschaft(name, gleichstand);
	const tag = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: stweg,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(handelnder(), tag.id, v.id, 0);
	await erstelleGeschaeft(handelnder(), tag.id, {
		titel: 'Fassadensanierung',
		antragswortlaut: 'Die Fassade wird saniert.',
		art: 'abstimmung',
		meetingIds: [v.id]
	});
	const t = await geschaeft(v.id);
	if (mitMehr) await haltErfordernisAmTraktandumFest(handelnder(), v.id, t, ERFORDERNIS);
	await gibVersammlungFrei(handelnder(), v.id);
	await eroeffneVersammlung(handelnder(), v.id);
	const parteien = await imKontext(betreiber, (tx) =>
		tx<{ id: string; party_id: string }[]>`SELECT id, party_id FROM snapshot_party WHERE meeting_id = ${v.id}`
	);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), v.id, p.id);
	const alle = (wahl: Wahl) => parteien.map((p) => ({ parteiId: p.party_id, wahl }));
	return { tag: tag.id, versammlung: v.id, grund: t, alle };
}

type Lage = Awaited<ReturnType<typeof versammlung>>;

async function abstimmen(s: Lage, traktandum: string, wahl: Wahl) {
	await stelleAufTraktandum(handelnder(), s.versammlung, traktandum);
	await oeffneAbstimmung(handelnder(), s.versammlung, traktandum);
	await gibStimmenAb(handelnder(), s.versammlung, s.alle(wahl), true, 'Prüflauf: von der Sitzungsleitung erfasst');
	const d = await schliesseAbstimmung(handelnder(), s.versammlung);
	return holeErgebnis(betreiber, s.versammlung, d.id);
}

async function folgeantrag(s: Lage, mitMehr = true) {
	const f = await nimmTraktandumAuf(
		handelnder(),
		{
			meetingId: s.versammlung,
			parentId: s.grund,
			titel: 'Nur die Wetterseite',
			art: 'abstimmung',
			antragswortlaut: 'Saniert wird vorerst nur die Wetterseite.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	if (mitMehr) await haltErfordernisAmTraktandumFest(handelnder(), s.versammlung, f.id, ERFORDERNIS);
	return f.id;
}

async function rueckkommen(s: Lage, annehmen: boolean | null) {
	const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.grund);
	if (annehmen !== null) await abstimmen(s, r.id, annehmen ? 'yes' : 'no');
	return r.id;
}

/** Was die Leitungsseite des Hauses ausliefert, mit `aufgerufen` als aktuellem Punkt. */
async function leitung(s: Lage, aufgerufen: string) {
	await stelleAufTraktandum(handelnder(), s.versammlung, aufgerufen);
	const daten = await load({
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-folgeantrag-leitung',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: s.versammlung },
		url: new URL('http://pruefung.example/leitung')
	} as never);
	return daten as unknown as Seite;
}

type Seite = PageData;

/** Was die Steuerung des Abends ausliefert, mit `aufgerufen` als aktuellem Punkt des Hauses. */
async function abend(s: Lage, aufgerufen: string): Promise<Abenddaten> {
	await stelleAufTraktandum(handelnder(), s.versammlung, aufgerufen);
	const daten = await abendLoad({
		locals: {
			benutzer: {
				id: benutzer,
				operatorId: betreiber,
				username: 'pruefer-folgeantrag-leitung',
				displayName: 'Prüferin',
				role: 'admin'
			},
			herkunft: null
		},
		params: { id: s.tag },
		url: new URL('http://pruefung.example/tag')
	} as never);
	return daten as unknown as Abenddaten;
}

/** Der einzige geschlossene Durchgang eines Traktandums. */
async function durchgangVon(traktandum: string): Promise<string> {
	const [z] = await imKontext(betreiber, (tx) =>
		tx<{ id: string }[]>`SELECT id FROM voting_round WHERE agenda_item_id = ${traktandum} ORDER BY ordinal DESC LIMIT 1`
	);
	return z.id;
}

/** Die Grundanträge, die das Aufnahmeformular anbietet: dieselbe Rechnung wie `+page.svelte`. */
function grundantraege(d: Seite): string[] {
	const entschieden = new Set([
		...d.ergebnisse.filter((e) => e.zustand === 'geschlossen').map((e) => e.traktandumId),
		...d.traktanden.filter((t) => t.ersetzt).map((t) => t.id)
	]);
	return d.traktanden
		.filter((t) =>
			taugtAlsGrundantrag({
				art: t.art === 'abstimmung' ? 'abstimmung' : 'kenntnisnahme',
				spontan: t.spontan,
				entschieden: entschieden.has(t.id),
				durchgangOffen: d.offen?.traktandumId === t.id,
				zurueckgezogen: t.rueckzug != null,
				rueckkommenOffen: t.rueckkommenOffen
			})
		)
		.map((t) => t.id);
}

/** «Jetzt möglich» am aufgerufenen Punkt: dieselbe Lage wie `jetztlage` in `+page.svelte`. */
function eingriffe(d: Seite): string[] {
	const a = d.aktuelles!;
	const jetzt = d.ergebnisse.find((e) => e.traktandumId === a.id);
	return moeglicheEingriffe({
		art: a.art,
		abgestimmt: jetzt?.zustand === 'geschlossen' || a.ersetzt,
		durchgangOffen: d.offen != null && d.offen.traktandumId === a.id,
		zurueckgezogen: a.rueckzug != null,
		rueckkommenLaeuft: a.rueckkommenLaeuft,
		rueckkommenOffen: a.rueckkommenOffen,
		grundantragEntschieden: a.grundantragEntschieden,
		beschlussAngenommen: (jetzt?.auszaehlung?.angenommen ?? a.sacheAngenommen ?? true) === true,
		hatErfordernis: a.hatErfordernis,
		spontan: a.spontan
	}).map((e) => e.art);
}

async function meldung(p: Promise<unknown>): Promise<string> {
	return p.then(
		() => 'durchgelassen',
		(f: unknown) => (f as Error).message
	);
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Folgeantrag an der Leitung');
	benutzer = await pruefbenutzer(betreiber, 'folgeantrag-leitung');
});

afterAll(verbindungenSchliessen);

describe('Der Aufnahmeweg nach dem Rückkommen (Punkt 1)', () => {
	it('bietet den entschiedenen Grundantrag an, sobald ein angenommenes Rückkommen wartet', async () => {
		const s = await versammlung('Leitungsweg 1', '2027-10-01');
		await abstimmen(s, s.grund, 'yes');

		// Gegenprobe: ohne Rückkommen weder in der Auswahl noch unter «Jetzt möglich».
		const vorher = await leitung(s, s.grund);
		expect(grundantraege(vorher)).not.toContain(s.grund);
		expect(eingriffe(vorher)).not.toContain('gegenantrag');

		await rueckkommen(s, true);
		const d = await leitung(s, s.grund);
		expect(d.traktanden.find((t) => t.id === s.grund)?.rueckkommenOffen).toBe(true);
		expect(grundantraege(d)).toContain(s.grund);
		expect(eingriffe(d)).toContain('gegenantrag');
		// Und der Server nimmt ihn an: Angeboten heisst angenommen.
		expect(await meldung(folgeantrag(s))).toBe('durchgelassen');
	});

	it('bietet ihn nach einem abgelehnten Rückkommen nicht an', async () => {
		const s = await versammlung('Leitungsweg 2', '2027-10-02');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, false);
		const d = await leitung(s, s.grund);
		expect(grundantraege(d)).not.toContain(s.grund);
		expect(eingriffe(d)).not.toContain('gegenantrag');
		expect(await meldung(folgeantrag(s))).toMatch(/^Über den gewählten Grundantrag ist bereits abgestimmt\./);
	});
});

describe('Kein Knopf, der in eine Absage führt (Punkt 2)', () => {
	it('nennt den vorher aufgenommenen Folgeantrag nach dem Grundantrag nicht abstimmbar', async () => {
		const s = await versammlung('Leitungsweg 3', '2027-10-03');
		const f = await folgeantrag(s);
		await abstimmen(s, s.grund, 'yes');

		const d = await leitung(s, f);
		expect(d.rueckkommen?.abstimmbar).toBe(false);
		// Derselbe Satz wie die Absage des Servers.
		expect(d.rueckkommen?.satz).toBe(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f)));
	});

	it('führt zum Rückkommensantrag auf den Grundantrag, solange über ihn nicht abgestimmt ist', async () => {
		const s = await versammlung('Leitungsweg 4', '2027-10-04');
		const f = await folgeantrag(s);
		await abstimmen(s, s.grund, 'yes');
		const r = await rueckkommen(s, null);

		const d = await leitung(s, f);
		expect(d.rueckkommen?.abstimmbar).toBe(false);
		expect(d.rueckkommen?.weg).toBe('antrag_aufrufen');
		expect(d.rueckkommen?.antragId).toBe(r);
		expect(d.rueckkommen?.satz).toBe(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f)));
	});

	it('nennt ihn abstimmbar nach dem angenommenen Rückkommen, und der Server eröffnet', async () => {
		const s = await versammlung('Leitungsweg 5', '2027-10-05');
		const f = await folgeantrag(s);
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);

		const d = await leitung(s, f);
		expect(d.rueckkommen?.abstimmbar).toBe(true);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f))).toBe('durchgelassen');
	});

	it('bietet am ersetzten Grundantrag keinen Durchgang an, und der Server weist ihn ab', async () => {
		const s = await versammlung('Leitungsweg 6', '2027-10-06');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await abstimmen(s, f, 'yes');

		const d = await leitung(s, s.grund);
		expect(d.rueckkommen?.abstimmbar).toBe(false);
		/*
		 * Der Hinweis beim Rückkommen richtet sich nach dem geltenden Beschluss, dem
		 * zum Folgeantrag (Codeprüfung B2a, M-b); vorher las die Seite nur das
		 * eigene Ergebnis und sagte «abgelehnt». Und in der Liste steht kein Rückzug.
		 */
		expect(d.traktanden.find((t) => t.id === s.grund)?.sacheAngenommen).toBe(true);
		expect(d.traktanden.find((t) => t.id === s.grund)?.ersetzt).toBe(true);
		// Und zuerst, was geschah (Soll 6, Block B2b).
		expect(d.rueckkommen?.satz).toMatch(/^Nach dem Rückkommen \(Traktandum [\d.]+\) kam statt dieses Antrags der Folgeantrag/);
		// Unter dem Ergebnis des Folgeantrags, woran er ersetzt.
		expect(d.ergebnisse.find((e) => e.traktandumId === f)?.nachRueckkommen).toMatch(
			/wurde statt über den Antrag zu Traktandum \d+ «Fassadensanierung» abgestimmt\. Dieser Beschluss ersetzt/
		);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, s.grund))).toMatch(
			/Rückkommensantrag/
		);
	});

	it('bietet am Folgeantrag kein Rückkommen an, sobald der Grundantrag entschieden ist', async () => {
		const s = await versammlung('Leitungsweg 7', '2027-10-07');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await abstimmen(s, f, 'yes');

		const d = await leitung(s, f);
		expect(eingriffe(d)).not.toContain('rueckkommen');
		expect(
			await meldung(stelleRueckkommensantrag(handelnder(), s.versammlung, f))
		).toMatch(/Zurückkommen lässt sich in dieser Anwendung dann nur auf den Grundantrag/);
		// Gegenprobe am Grundantrag: Dort steht der Weg.
		expect(eingriffe(await leitung(s, s.grund))).toContain('rueckkommen');
	});
});

describe('Ohne Mehrheitserfordernis am Abend kein «Abstimmen» (Befund N-1)', () => {
	/*
	 * Laienprüfung Runde 3, Befund N-1 (06.10.2026): Ohne Erfordernis liefert
	 * `holeMehrheitsvorschau` keinen Sperrgrund, und die Seite bot den Knopf an,
	 * der in die Absage mit dem Entscheidbaum führt. Die Seite zeigt dann Satz
	 * und Verweis; gemessen wird das Merkmal, das sie dafür liest.
	 */
	it('der aufgenommene Folgeantrag ohne Mehr: kein Knopf, und der Server sagt ab', async () => {
		const s = await versammlung('Leitungsweg 20', '2027-10-20');
		const f = await folgeantrag(s, false);
		const d = await abend(s, f);
		expect(d.aktuellOhneMehr).toBe(true);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f))).toMatch(/Entscheidbaum/);

		// Gegenprobe: Der Grundantrag trägt sein Mehr.
		const g = await abend(s, s.grund);
		expect(g.aktuellOhneMehr).toBe(false);
	});

	it('das angekündigte Traktandum ohne Mehr: ebenso', async () => {
		const s = await versammlung('Leitungsweg 21', '2027-10-21', false);
		const d = await abend(s, s.grund);
		expect(d.aktuellOhneMehr).toBe(true);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, s.grund))).toMatch(
			/Entscheidbaum/
		);
	});

	it('unter «Einzeln führen» steht bei zwei Häusern das Merkmal je Traktandum', async () => {
		// Zeilen je Haus gibt es nur bei einem Geschäft über mehrere Häuser
		// (`gemeinsameListe`); bei einem Haus steht der Punkt nur im Ablauf.
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Leitungsweg 22, Abend',
			datum: '2027-10-22',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich'
		});
		const haeuser: string[] = [];
		for (const [i, name] of ['Leitungsweg 22a', 'Leitungsweg 22b'].entries()) {
			const v = await erstelleVersammlung(handelnder(), {
				stwegId: await gemeinschaft(name),
				datum: '2027-10-22',
				uhrzeit: '19:00',
				ort: 'Prüfsaal',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'gefuehrt'
			});
			await nimmInTagAuf(handelnder(), tag.id, v.id, i);
			haeuser.push(v.id);
		}
		await erstelleGeschaeft(handelnder(), tag.id, {
			titel: 'Fassadensanierung',
			antragswortlaut: 'Die Fassade wird saniert.',
			art: 'abstimmung',
			meetingIds: haeuser
		});
		const [a, b] = haeuser;
		const ta = await geschaeft(a);
		const tb = await geschaeft(b);
		// Nur Haus b bekommt ein Mehr: die Gegenprobe im selben Abend.
		await haltErfordernisAmTraktandumFest(handelnder(), b, tb, ERFORDERNIS);
		for (const v of haeuser) {
			await gibVersammlungFrei(handelnder(), v);
			await eroeffneVersammlung(handelnder(), v);
		}
		await stelleAufTraktandum(handelnder(), a, ta);
		await stelleAufTraktandum(handelnder(), b, tb);
		const d = await abend({ tag: tag.id, versammlung: a, grund: ta, alle: () => [] }, ta);
		expect(d.ohneMehr[ta]).toBe(true);
		expect(d.sperren[ta]).toBeUndefined();
		expect(d.ohneMehr[tb]).toBeUndefined();

		// Zurückgezogen wird nicht abgestimmt; der Satz träfe ihn nicht (Codeprüfung 5).
		await ziehAntragZurueck(handelnder(), a, ta, 'Prüflauf: zurückgezogen');
		const z = await abend({ tag: tag.id, versammlung: a, grund: ta, alle: () => [] }, ta);
		expect(z.ohneMehr[ta]).toBeUndefined();
	});
});

describe('Während über den Folgeantrag abgestimmt wird (Codeprüfung B2a, M1)', () => {
	it('bietet am Grundantrag kein zweites Rückkommen an, und der Server nimmt keines an', async () => {
		/*
		 * Das Rückkommen trägt den offenen Durchgang über den Folgeantrag. Seit der
		 * Verbrauch nicht mehr nur am Ziel zählt, hiess das Rückkommen im Kern
		 * schon verbraucht, und am Grundantrag stand «Nochmals abstimmen». Der
		 * Server nahm den zweiten Antrag an, mit Wortlaut und Mehr eines
		 * Beschlusses, den der offene Durchgang gleich ersetzt.
		 */
		const s = await versammlung('Leitungsweg 10', '2027-10-10');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await stelleAufTraktandum(handelnder(), s.versammlung, f);
		await oeffneAbstimmung(handelnder(), s.versammlung, f);

		const d = await leitung(s, s.grund);
		expect(d.traktanden.find((t) => t.id === s.grund)?.rueckkommenLaeuft).toBe(true);
		expect(eingriffe(d)).not.toContain('rueckkommen');
		expect(await meldung(stelleRueckkommensantrag(handelnder(), s.versammlung, s.grund))).toMatch(
			/läuft bereits ein Rückkommensantrag/
		);
	});
});

describe('Neuabstimmung und zweites Rückkommen nach der Ersetzung', () => {
	it('öffnet nach einer Neuabstimmung auf den Folgeantrag den Weg wieder', async () => {
		// Am offenen Gleichstand (H6): Einen verkündeten überholt die Leitung nicht.
		const s = await versammlung('Leitungsweg 11', '2027-10-11', true, true);
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await stelleAufTraktandum(handelnder(), s.versammlung, f);
		await oeffneAbstimmung(handelnder(), s.versammlung, f);
		await erfasseSummen(handelnder(), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(), s.versammlung);
		await setzeNeuabstimmungAn(handelnder(), s.versammlung, await durchgangVon(f), 'Falsch gezählt');

		// Der frühere Beschluss gilt weiter, das Rückkommen ist nicht verbraucht.
		const g = await leitung(s, s.grund);
		expect(g.traktanden.find((t) => t.id === s.grund)?.ersetzt).toBe(false);
		expect(g.traktanden.find((t) => t.id === s.grund)?.rueckkommenOffen).toBe(true);
		const d = await leitung(s, f);
		expect(d.rueckkommen?.abstimmbar).toBe(true);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f))).toBe('durchgelassen');
	});

	it('trägt nach der Ersetzung ein zweites Rückkommen und einen zweiten Folgeantrag', async () => {
		const s = await versammlung('Leitungsweg 12', '2027-10-12');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await abstimmen(s, f, 'yes');

		await rueckkommen(s, true);
		const d = await leitung(s, s.grund);
		expect(d.traktanden.find((t) => t.id === s.grund)?.rueckkommenOffen).toBe(true);
		expect(grundantraege(d)).toContain(s.grund);
		expect(eingriffe(d)).toContain('gegenantrag');
		// Am ersten Folgeantrag nicht: Er hat die Sache schon einmal getragen,
		// und er tritt wie der alte Antrag wieder an; abstimmbar ist er.
		expect((await leitung(s, f)).rueckkommen?.abstimmbar).toBe(true);
		const f2 = await folgeantrag(s);
		const zweite = await leitung(s, f2);
		expect(zweite.rueckkommen?.abstimmbar).toBe(true);
		expect(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f2))).toBe('durchgelassen');
	});
});

describe('Die Steuerung des Abends (Codeprüfung B2a, M4)', () => {
	it('bietet den Grundantrag nach dem angenommenen Rückkommen an', async () => {
		const s = await versammlung('Leitungsweg 13', '2027-10-13');
		await abstimmen(s, s.grund, 'yes');
		const vorher = await abend(s, s.grund);
		expect(vorher.eingriffe?.rueckkommenOffen).toBe(false);
		expect((vorher.eingriffe?.grundantraege ?? []).map((g) => g.id)).not.toContain(s.grund);

		await rueckkommen(s, true);
		const d = await abend(s, s.grund);
		expect(d.eingriffe?.rueckkommenOffen).toBe(true);
		expect(d.eingriffe?.abgestimmt).toBe(true);
		expect((d.eingriffe?.grundantraege ?? []).map((g) => g.id)).toContain(s.grund);
	});

	it('nennt den vorher aufgenommenen Folgeantrag mit dem Satz des Servers', async () => {
		const s = await versammlung('Leitungsweg 14', '2027-10-14');
		const f = await folgeantrag(s);
		await abstimmen(s, s.grund, 'yes');
		const r = await rueckkommen(s, null);

		const d = await abend(s, f);
		expect(d.rueckkommen?.abstimmbar).toBe(false);
		expect(d.rueckkommen?.antragId).toBe(r);
		expect(d.rueckkommen?.satz).toBe(await meldung(oeffneAbstimmung(handelnder(), s.versammlung, f)));
		expect(d.eingriffe?.grundantragEntschieden).toBe(true);
	});

	it('führt den ersetzten Grundantrag als entschieden', async () => {
		const s = await versammlung('Leitungsweg 15', '2027-10-15');
		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await abstimmen(s, f, 'yes');

		const d = await abend(s, s.grund);
		expect(d.entschiedene).toContain(s.grund);
		expect(d.eingriffe?.abgestimmt).toBe(true);
		expect(d.rueckkommen?.abstimmbar).toBe(false);
	});
});

describe('Das ersetzte Grundtraktandum gilt als behandelt (Punkt 3)', () => {
	it('zählt es nach der Ersetzung auf Leitung, Abend und Tafel als entschieden', async () => {
		const s = await versammlung('Leitungsweg 8', '2027-10-08');
		await abstimmen(s, s.grund, 'yes');
		const r = await rueckkommen(s, true);
		const f = await folgeantrag(s);

		// Die Tafel zählt auch die Punkte aus der Vorlage. Nach dem Durchgang über
		// den Folgeantrag ist einer weniger offen: er selbst. Ohne Migration 133
		// in der Zählung käme das ersetzte Grundtraktandum dafür wieder dazu.
		const vorher = (await holeTafel(betreiber, s.tag))[0].offeneTraktanden;

		await abstimmen(s, f, 'no');

		const d = await leitung(s, f);
		expect(d.traktanden.find((t) => t.id === s.grund)?.ersetzt).toBe(true);
		// Keiner der drei zählt als «ohne Beschluss»; die Vorlagepunkte schon.
		const ohne = d.traktanden.filter(
			(t) => t.art === 'abstimmung' && !t.rueckzug && ![s.grund, r, f].includes(t.id)
		).length;
		expect(d.abschluss.ohneBeschluss).toBe(ohne);
		expect((await holeEntschiedeneAmAbend(betreiber, s.tag)).sort()).toEqual([s.grund, r, f].sort());
		expect((await holeTafel(betreiber, s.tag))[0].offeneTraktanden).toBe(vorher - 1);
	});
});

describe('Der Hausbeschluss als Weisungsquelle (Punkt 3)', () => {
	it('findet nach der Ersetzung den Beschluss zum Folgeantrag', async () => {
		/*
		 * Ein Haus und die Miteigentümergemeinschaft, die das Geschäft führen.
		 * Nach der Ersetzung liegt der geltende Hausbeschluss am Folgeantrag; die
		 * Abfrage suchte ihn am Geschäft und fand keinen.
		 */
		const haus = await gemeinschaft('Leitungsweg 9, Haus');
		const meg = await erstelleGemeinschaft(handelnder(), {
			name: 'Leitungsweg 9, MEG',
			quotaDenominator: 1,
			headCountMode: 'per_unit',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		const anteil = await erstelleEinheit(handelnder(), {
			stwegId: meg.id,
			kind: 'unit',
			label: 'Anteil Haus',
			quotas: { stamm: 1 },
			countsAsHead: true
		});
		const vertretung = await erstelleEigentuemer(handelnder(), {
			stwegId: meg.id,
			kind: 'gemeinschaft',
			displayName: 'Leitungsweg 9, Haus',
			isCommunity: false,
			memberStwegId: haus,
			representativeName: 'Vertretung'
		});
		await ordneEigentumZu(handelnder(), anteil.id, vertretung.id, '2020-01-01');

		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Leitungsweg 9, Abend',
			datum: '2027-10-09',
			uhrzeit: '19:00',
			ort: 'Prüfsaal',
			art: 'ordentlich'
		});
		const versammlungen: string[] = [];
		for (const [i, stweg] of [haus, meg.id].entries()) {
			const v = await erstelleVersammlung(handelnder(), {
				stwegId: stweg,
				datum: '2027-10-09',
				uhrzeit: '19:00',
				ort: 'Prüfsaal',
				art: 'ordentlich',
				stufe: 'erste',
				betriebsart: 'gefuehrt'
			});
			await nimmInTagAuf(handelnder(), tag.id, v.id, i);
			versammlungen.push(v.id);
		}
		await erstelleGeschaeft(handelnder(), tag.id, {
			titel: 'Fassadensanierung',
			antragswortlaut: 'Die Fassade wird saniert.',
			art: 'abstimmung',
			meetingIds: versammlungen
		});
		for (const v of versammlungen) {
			await haltErfordernisAmTraktandumFest(handelnder(), v, await geschaeft(v), ERFORDERNIS);
			await gibVersammlungFrei(handelnder(), v);
			await eroeffneVersammlung(handelnder(), v);
			const staende = await imKontext(betreiber, (tx) =>
				tx<{ id: string }[]>`SELECT id FROM snapshot_party WHERE meeting_id = ${v}`
			);
			for (const p of staende) await bestaetigeAnwesenheit(handelnder(), v, p.id);
		}
		const [hausVersammlung, megVersammlung] = versammlungen;
		const parteien = await imKontext(betreiber, (tx) =>
			tx<{ party_id: string }[]>`SELECT party_id FROM snapshot_party WHERE meeting_id = ${hausVersammlung}`
		);
		const s: Lage = {
			tag: tag.id,
			versammlung: hausVersammlung,
			grund: await geschaeft(hausVersammlung),
			alle: (wahl: Wahl) => parteien.map((p) => ({ parteiId: p.party_id, wahl }))
		};
		const megPunkt = await geschaeft(megVersammlung);

		await abstimmen(s, s.grund, 'yes');
		await rueckkommen(s, true);
		const f = await folgeantrag(s);
		await abstimmen(s, f, 'no');

		const [b] = await holeHausbeschluesseZumGeschaeft(betreiber, megPunkt);
		expect(b?.durchgangId).toBe(await durchgangVon(f));

		/*
		 * **Aber nicht still als Weisung** (Codeprüfung B2a, M3). Der Beschluss
		 * gilt einem anderen Wortlaut als der Punkt der Gemeinschaft; ein Ja zu
		 * «nur die Wetterseite» ist kein Ja zu «die Fassade wird saniert». Die
		 * Sammelableitung nennt das Haus mit Grund, statt eine Weisung zu setzen.
		 */
		await setzeWeisungsbindung(handelnder(), megVersammlung, megPunkt, true);
		const befund = await leiteWeisungenAbSammel(handelnder(), megVersammlung, megPunkt);
		expect(befund.gelungen).toEqual([]);
		expect(befund.offen).toHaveLength(1);
		expect(befund.offen[0].grund).toMatch(/Folgeantrag/);
		// Und «Fehlende nach Reglement» schreibt nicht «ohne Beschluss» hinein.
		const nachReglement = await trageOhneBeschlussEin(handelnder(), megVersammlung, megPunkt);
		expect(nachReglement.gelungen).toEqual([]);
		expect(nachReglement.offen[0]?.grund).toMatch(/Folgeantrag/);
	});
});
