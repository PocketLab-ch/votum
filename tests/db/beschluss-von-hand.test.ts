/**
 * Der von Hand festgehaltene Beschluss am Bestand (Plan
 * `docs/plan-beschluss-von-hand-2026-09-30.md`, Block 1).
 *
 * **Produktentscheid 30.09.2026:** Solange die Versammlung läuft, hält die
 * Sitzungsleitung je Traktandum einen Beschluss von Hand fest, an allen
 * Sperren beim Eröffnen und an der Auszählung vorbei. Der Verlauf hält fest,
 * was übergangen wurde; Wand und Protokoll zeigen den Beschluss ohne Hinweis
 * auf den Weg; das Ergebnis wird festgeschrieben.
 *
 * Die drei Nachweise des Plans stehen hier: Jeder Leser zeigt das Ergebnis,
 * das Protokoll trägt keinen Satz aus dem Verlauf, und ein offener Durchgang,
 * dessen Schliessen wirft, lässt sich so beenden. Dazu das Zusammenspiel mit
 * dem Rückkommen, das der Plan am Code geklärt haben will.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	eroeffneVersammlung,
	erstelleVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import {
	erstelleTraktandum,
	haltErfordernisAmTraktandumFest,
	nimmTraktandumAuf,
	stelleRueckkommensantrag,
	ziehAntragZurueck
} from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	haltBeschlussVonHandFest,
	holeDirektNachQuorumLage,
	holeDurchgaenge,
	holeErgebnis,
	holeOffenen,
	holeVonHandVorschau,
	oeffneAbstimmung,
	schliesseAbstimmung,
	setzeNeuabstimmungAn
} from '$lib/server/abstimmung';
import { abschlussbild, holeAuswertung } from '$lib/server/auswertung';
import { holePaket, versiegle } from '$lib/server/siegel';
import { erzeugeAuswertung } from '$lib/server/pdf/auswertung';
import { AUSWERTUNG_VON_HAND_ABGESTIMMT } from '$lib/domain/protokoll';
import { ermittleStand } from '$lib/server/versammlungsstand';
import {
	holeOhneErgebnisUndVermerk,
	setzeBeschlussvermerk,
	setzeProtokollnotiz,
	stelleEntwurfZusammen
} from '$lib/server/protokoll';
import { erstelleAnwesenheitsregel } from '$lib/server/reglement';
import { speichereNeuabstimmung } from '$lib/server/neuabstimmung';
import { leseVerlauf } from '$lib/server/verlaufsabfrage';
import { ABWEICHUNGSARTEN, beschriftung } from '$lib/domain/verlauf';
import { eingabeAusFormular, vonHandStandSatz, type VonHandEingabe } from '$lib/domain/vonhand';
import { beteiligungDerAnwesenden } from '$lib/domain/anwesenheit';
import { stimmkraftliste } from '$lib/domain/stimmkraft';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
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

const SUMMEN: VonHandEingabe = {
	ergebnis: 'angenommen',
	zahlen: {
		erfassung: 'summen',
		koepfe: { ja: 3, nein: 1, enthaltung: 0 },
		quoten: { ja: 675, nein: 225, enthaltung: 0 }
	}
};

/**
 * Der Stand in der Vorschau, wenn alle vier Parteien eingelassen sind (Block 6):
 * die sechs Grössen, die das Protokoll später aus dem eingefrorenen Stand
 * rechnet. Die Vergleiche über die ganze Vorschau bleiben damit streng.
 */
const ALLE_ANWESEND = {
	eigentuemerGesamt: 4,
	eigentuemerAnwesend: 4,
	kopfstimmenGesamt: 4,
	kopfstimmenAnwesend: 4,
	gesamtquote: 900,
	quotenAnwesend: 900,
	// Vier Parteien, keine einzige gemeinschaftliche (`docs/entscheide/0016`).
	einzigeParteiGemeinsam: false
};

/**
 * Eine Versammlung mit vier Parteien zu je 225 von 900 und einem angekündigten
 * Antrag. `anwesend` sagt, wie viele eingelassen werden: Mit einer von vier
 * ist die Versammlung nicht beschlussfähig.
 */
async function versammlung(
	name: string,
	datum: string,
	optionen: {
		anwesend?: number;
		eroeffnet?: boolean;
		kenntnisnahme?: boolean;
		stichentscheid?: boolean;
	} = {}
) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 900,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null,
		...(optionen.stichentscheid
			? { tieBreak: 'wertquote' as const, tieBreakRuleSource: 'Art. 30 Reglement' }
			: {})
	});
	const parteien: string[] = [];
	for (const [i, wer] of ['Probe Alpha', 'Probe Beta', 'Probe Gamma', 'Probe Delta'].entries()) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 225 },
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
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: v.id,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung'
	});
	await haltErfordernisAmTraktandumFest(handelnder(), v.id, t.id, ERFORDERNIS);
	const kenntnis = optionen.kenntnisnahme
		? await erstelleTraktandum(handelnder(), {
				meetingId: v.id,
				parentId: null,
				titel: 'Jahresbericht',
				art: 'kenntnisnahme',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: []
			})
		: null;
	await gibVersammlungFrei(handelnder(), v.id);
	if (optionen.eroeffnet !== false) {
		await eroeffneVersammlung(handelnder(), v.id);
		for (const p of parteien.slice(0, optionen.anwesend ?? 4)) {
			await bestaetigeAnwesenheit(handelnder(), v.id, p, 'von_hand');
		}
	}
	return {
		versammlung: v.id,
		traktandum: t.id,
		kenntnis: kenntnis?.id ?? null,
		parteien,
		gemeinschaft: g.id
	};
}

type Wahl = 'yes' | 'no';

async function abstimmen(s: { versammlung: string; parteien: string[] }, traktandum: string, wahl: Wahl) {
	await stelleAufTraktandum(handelnder(), s.versammlung, traktandum);
	await oeffneAbstimmung(handelnder(), s.versammlung, traktandum);
	await gibStimmenAb(
		handelnder(),
		s.versammlung,
		s.parteien.map((parteiId) => ({ parteiId, wahl })),
		true,
		'Prüflauf: von der Sitzungsleitung erfasst'
	);
	return schliesseAbstimmung(handelnder(), s.versammlung);
}

interface Zeile {
	id: string;
	ordinal: number;
	state: string;
	supersede_kind: string | null;
	supersede_reason: string | null;
	superseded_by_round_id: string | null;
	reconsideration_item_id: string | null;
	result_published_at: Date | null;
	result_json: unknown;
	requirement_json: { typ: string; knotenId: string } | null;
	attendance_json: { anwesende: string[] } | null;
}

async function zeilen(traktandum: string): Promise<Zeile[]> {
	return imKontext(
		betreiber,
		(tx) => tx<Zeile[]>`SELECT * FROM voting_round WHERE agenda_item_id = ${traktandum} ORDER BY ordinal`
	);
}

async function massgebend(traktandum: string): Promise<string | null> {
	const [m] = await imKontext(
		betreiber,
		(tx) => tx<{ id: string | null }[]>`SELECT massgebender_durchgang(${traktandum}) AS id`
	);
	return m.id;
}

async function protokoll(versammlungId: string): Promise<string> {
	return (
		await stelleEntwurfZusammen(betreiber, versammlungId, new Date().toISOString(), 'Prüflauf')
	).replace(/\s+/g, ' ');
}

/**
 * Der Abschnitt eines Traktandums unter «Verhandlungen», bis zum nächsten.
 * Der Titel allein träfe zuerst die Traktandenliste am Kopf des Protokolls.
 */
function abschnittVon(text: string, titel: string): string {
	const treffer = new RegExp(`#### \\d+(?:\\.\\d+)* ${titel} (.*?)(?= ####| ## Schluss)`).exec(text);
	if (!treffer) throw new Error(`Kein Abschnitt «${titel}» im Protokoll.`);
	return treffer[1];
}

/** Der Verlaufseintrag zum Durchgang, gelesen über den Filter der Versammlung. */
async function eintrag(versammlungId: string, durchgangId: string) {
	const { zeilen: alle } = await leseVerlauf(betreiber, {
		versammlung: versammlungId,
		art: 'vote.decided.by.chair'
	});
	return alle.find((z) => z.gegenstandId === durchgangId);
}

async function absage(p: Promise<unknown>): Promise<{ kennung: string; satz: string } | 'durchgelassen'> {
	return p.then(
		() => 'durchgelassen' as const,
		(f: unknown) => ({ kennung: (f as { kennung: string }).kennung, satz: (f as Error).message })
	);
}

/** Was nach aussen nicht stehen darf: der Weg, das Erfordernis, eine Bezugsgrösse. */
const VERRAETER = /von Hand|übergangen|Notweg|Erforderliche Mehrheit|Hälfte|nötig|ohne Abgabe|\(von \d/;

beforeAll(async () => {
	betreiber = await pruefbetreiber('Beschluss von Hand');
	benutzer = await pruefbenutzer(betreiber, 'beschluss-von-hand');
});

afterAll(verbindungenSchliessen);

describe('Jeder Leser zeigt das Ergebnis', () => {
	it('legt einen geschlossenen, verkündeten Durchgang mit festgeschriebener Auszählung an', async () => {
		const s = await versammlung('Handweg 1', '2027-10-01');
		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		expect(vorschau).toEqual({ uebergangen: [], ueberholt: [], stand: ALLE_ANWESEND });

		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			{ ...SUMMEN, begruendung: 'Probe: neues Urteil zur Zählweise' }
		);
		// Beschlussfähig, angekündigt, kein früherer Durchgang: Das Werkzeug hätte
		// die Abstimmung zugelassen, und die leere Liste sagt genau das.
		expect(uebergangen).toEqual([]);

		const [z] = await zeilen(s.traktandum);
		expect(z.state).toBe('geschlossen');
		expect(z.result_published_at).not.toBeNull();
		expect(z.requirement_json?.knotenId).toBe('k-gewoehnliche-verwaltung');
		expect(z.attendance_json?.anwesende).toHaveLength(4);
		expect(z.supersede_kind).toBeNull();

		// Der eine Weg aller Leser.
		const e = await holeErgebnis(betreiber, s.versammlung, durchgang.id);
		expect(e.auszaehlung?.angenommen).toBe(true);
		expect(e.auszaehlung?.vonHand).toEqual({ erfassung: 'summen' });
		expect(e.auszaehlung?.koepfe.ja).toBe(3);
		expect(e.auszaehlung?.quoten.ja).toBe(675);
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);

		// Wand und Telefon.
		const stand = await ermittleStand(betreiber, s.versammlung);
		const wand = stand?.abstimmung?.ergebnis;
		expect(wand?.angenommen).toBe(true);
		expect(wand?.koepfe).toMatchObject({ ja: 3, nein: 1, enthaltung: 0, schwelle: null });
		expect(wand?.satz).toBe(
			'Angenommen. Kopfstimmen: 3 Ja, 1 Nein, 0 Enthaltung; Wertquoten: 675 Ja, 225 Nein, 0 Enthaltung.'
		);
		expect(wand?.satz).not.toMatch(VERRAETER);

		// Auswertung: die Zeile trägt das Ergebnis und kein Erfordernis.
		const auswertung = await holeAuswertung(betreiber, s.versammlung);
		const zeile = auswertung!.zeilen.find((x) => x.titel === 'Fassadensanierung')!;
		expect(zeile.auszaehlung?.angenommen).toBe(true);
		expect(zeile.erfordernis).toBeNull();
		expect(zeile.fall).toBeNull();
		expect(zeile.rechtsgrundlage).toBeNull();
		expect(zeile.protokollsatz).toBe('Angenommen.');
		expect(zeile.satzOhneNamen).not.toMatch(VERRAETER);
		expect(auswertung!.angenommen).toBe(1);

		/*
		 * **Gegenprobe zu Block 5:** Hier waren alle vier anwesend, die
		 * Versammlung war beschlussfähig. Dann steht der Satz zur fehlenden
		 * Beschlussfähigkeit nicht am Beschluss.
		 */
		const ohne = await protokoll(s.versammlung);
		expect(abschnittVon(ohne, 'Fassadensanierung')).not.toContain('nicht beschlussfähig');
	});

	it('zählt die Wahl je Partei zusammen und schreibt keine Stimmzeile', async () => {
		const s = await versammlung('Handweg 2', '2027-10-02');
		const [a, b, c] = s.parteien;
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			ergebnis: 'abgelehnt',
			zahlen: {
				erfassung: 'parteien',
				stimmen: [
					{ parteiId: a, wahl: 'yes' },
					{ parteiId: b, wahl: 'no' },
					{ parteiId: c, wahl: 'no' }
				]
			}
		});
		const e = await holeErgebnis(betreiber, s.versammlung, durchgang.id);
		expect(e.auszaehlung?.angenommen).toBe(false);
		expect([e.auszaehlung?.koepfe.ja, e.auszaehlung?.koepfe.nein]).toEqual([1, 2]);
		expect([e.auszaehlung?.quoten.ja, e.auszaehlung?.quoten.nein]).toEqual([225, 450]);
		expect(e.auszaehlung?.vonHand?.stimmen).toEqual([
			{ partei: a, wahl: 'yes' },
			{ partei: b, wahl: 'no' },
			{ partei: c, wahl: 'no' }
		]);
		const [{ anzahl }] = await imKontext(
			betreiber,
			(tx) => tx<{ anzahl: number }[]>`SELECT count(*)::int AS anzahl FROM vote WHERE round_id = ${durchgang.id}`
		);
		expect(anzahl).toBe(0);
	});

	it('gibt einer Kenntnisnahme ein Ergebnis', async () => {
		const s = await versammlung('Handweg 3', '2027-10-03', { kenntnisnahme: true });
		const { uebergangen } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.kenntnis!, SUMMEN);
		// Die Absage des Eröffnens steht im Verlauf, nicht im Weg.
		expect(uebergangen.map((u) => u.kennung)).toEqual(['keine_abstimmung']);

		const [z] = await zeilen(s.kenntnis!);
		expect(z.state).toBe('geschlossen');
		expect(z.requirement_json).not.toBeNull();

		const auswertung = await holeAuswertung(betreiber, s.versammlung);
		const zeile = auswertung!.zeilen.find((x) => x.titel === 'Jahresbericht')!;
		expect(zeile.art).toBe('abstimmung');
		expect(zeile.erfordernis).toBeNull();
		expect(auswertung!.angenommen).toBe(1);

		const text = await protokoll(s.versammlung);
		const abschnitt = abschnittVon(text, 'Jahresbericht');
		expect(abschnitt).toMatch(/Angenommen\./);
		expect(abschnitt).not.toMatch(/Zur Kenntnis genommen/);
	});
});

describe('Das Protokoll trägt keinen Satz aus dem Verlauf', () => {
	it('zeigt Ergebnis und Zahlen, aber weder Weg noch Erfordernis, auch bei fehlender Beschlussfähigkeit', async () => {
		const s = await versammlung('Handweg 4', '2027-10-04', { anwesend: 1 });

		// Gegenprobe: Der gewöhnliche Weg ist gesperrt.
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		const zu = await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum));
		expect(zu).toMatchObject({ kennung: 'nicht_beschlussfaehig' });

		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			{ ...SUMMEN, begruendung: 'Probe: Sitzungsleitung entscheidet trotz fehlender Beschlussfähigkeit' }
		);
		// Derselbe Satz, den das Eröffnen geworfen hat, und derselbe wie vor dem Knopf.
		expect(uebergangen).toEqual([zu]);
		expect(vorschau.uebergangen).toEqual(uebergangen);

		/*
		 * **Die Vorschau nennt den Stand, den der Eintrag danach einfriert**
		 * (Block 6, 02.10.2026): dieselben sechs Grössen, die das Protokoll aus
		 * `attendance_json.anwesende` des Durchgangs rechnet. Eine von vier
		 * Parteien zu je 225 von 900 ist eingelassen.
		 */
		const momentaufnahme = await holeMomentaufnahme(betreiber, s.versammlung);
		expect(durchgang.anwesende).toEqual([s.parteien[0]]);
		expect(vorschau.stand).toEqual(
			beteiligungDerAnwesenden(stimmkraftliste(momentaufnahme!), durchgang.anwesende!)
		);
		expect(vorschau.stand).toEqual({
			eigentuemerGesamt: 4,
			eigentuemerAnwesend: 1,
			kopfstimmenGesamt: 4,
			kopfstimmenAnwesend: 1,
			gesamtquote: 900,
			quotenAnwesend: 225,
			einzigeParteiGemeinsam: false
		});
		expect(vonHandStandSatz(vorschau.stand!)).toBe(
			'Festgehalten wird der Anwesenheitsstand von jetzt: 1 von 4 Eigentümern anwesend oder ' +
				'vertreten, mit 225 von 900 Wertquoten. War der Stand bei der Abstimmung ein anderer, ' +
				'stellen Sie zuerst die Anwesenheit auf jenen Stand und erfassen Sie nach dem ' +
				'Festhalten wieder, wer seither gekommen oder gegangen ist.'
		);

		const e = await eintrag(s.versammlung, durchgang.id);
		expect(e?.gegenstandArt).toBe('voting_round');
		expect(e?.angaben).toMatchObject({
			versammlung: s.versammlung,
			traktandumId: s.traktandum,
			traktandum: 'Fassadensanierung',
			durchgang: 1,
			ergebnis: 'angenommen',
			erfassung: 'summen',
			koepfe: { ja: 3, nein: 1, enthaltung: 0 },
			quoten: { ja: 675, nein: 225, enthaltung: 0 },
			begruendung: 'Probe: Sitzungsleitung entscheidet trotz fehlender Beschlussfähigkeit',
			ueberholt: [],
			abweichung: { uebergangen: [zu] }
		});

		const text = await protokoll(s.versammlung);
		const abschnitt = abschnittVon(text, 'Fassadensanierung');
		expect(abschnitt).toMatch(/Angenommen\./);
		expect(abschnitt).toMatch(/Kopfstimmen: 3 Ja, 1 Nein, 0 Enthaltung/);
		// Mit der Einheit aus dem Nenner (Ä-09); diese Gemeinschaft rechnet in 900.
		expect(abschnitt).toMatch(/Wertquoten \(Anteile von 900\): 675 Ja, 225 Nein, 0 Enthaltung/);
		/*
		 * **Die fehlende Beschlussfähigkeit steht am Beschluss** (Produktentscheid
		 * 01.10.2026). Sie wird aus dem beim Durchgang eingefrorenen
		 * Anwesenheitsstand gerechnet, nicht aus dem Verlauf; der Weg steht
		 * weiterhin nirgends, und die übergangene Absage auch nicht.
		 */
		expect(abschnitt).toContain(
			'Die Versammlung war bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p). Wer ihm ' +
				'nicht zugestimmt hat, auch wer nicht dabei war, kann ihn innert eines Monats beim ' +
				'Gericht anfechten (ZGB Art. 75). Die Frist beginnt für Anwesende und Vertretene mit ' +
				'der Versammlung, für alle anderen, sobald sie vom Beschluss erfahren, spätestens mit ' +
				'dem Erhalt dieses Protokolls.'
		);
		expect(abschnitt).not.toMatch(VERRAETER);
		expect(text).not.toContain('Probe: Sitzungsleitung entscheidet');
		expect(text).not.toContain((zu as { satz: string }).satz);
		for (const art of ABWEICHUNGSARTEN) {
			expect(text).not.toContain(art);
			expect(text).not.toContain(beschriftung(art));
		}
	});

	it('nennt die Stelle des Reglements, wo eine eigene Regel hinterlegt ist, und bei «Abgelehnt» beide Hinweise', async () => {
		/*
		 * **Durch den echten Serverweg** (Codeprüfung 01.10.2026): Die Grundlage
		 * kommt aus `stelleBeschlussfaehigkeitFest` mit der hinterlegten Regel,
		 * nicht aus einer Kernprobe mit vorgebautem Feld. Zwei von vier sind
		 * anwesend: Nach dem Gesetz reicht das (die Hälfte der Eigentümer mit der
		 * Hälfte der Wertquoten), nach der Regel der Gemeinschaft (zwei Drittel)
		 * nicht. Art. 712p ist dann nicht verletzt und darf nicht dastehen.
		 */
		const s = await versammlung('Handweg 9', '2027-10-09', { anwesend: 2 });
		await erstelleAnwesenheitsregel(handelnder(), s.gemeinschaft, 'erste', {
			kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
			mindestens: 3,
			fundstelle: 'Art. 18'
		});
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);

		const angenommen = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(angenommen).toContain('bei diesem Beschluss nicht beschlussfähig (Art. 18 des Reglements).');
		expect(angenommen).not.toContain('bei diesem Beschluss nicht beschlussfähig (ZGB Art. 712p)');
		expect(angenommen).toContain('beim Gericht anfechten (ZGB Art. 75)');

		// Ein zweiter Eintrag überholt den ersten; jetzt «Abgelehnt».
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...SUMMEN,
			ergebnis: 'abgelehnt'
		});
		const abgelehnt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abgelehnt).toMatch(/Abgelehnt\./);
		/*
		 * **Beide Hinweise, in dieser Reihenfolge** (Produktentscheid 02.10.2026:
		 * «Beides»): erst neu vorlegen, dann die Anfechtung mit Frist und
		 * Fristbeginn. Der Wortlaut für «Angenommen» steht dort nicht.
		 */
		expect(abgelehnt).toContain(
			'Die Versammlung war bei diesem Beschluss nicht beschlussfähig (Art. 18 des Reglements). Der ' +
				'Antrag kann einer beschlussfähigen Versammlung erneut vorgelegt werden. Wer mit der ' +
				'Ablehnung nicht einverstanden war, auch wer nicht dabei war, kann sie innert eines ' +
				'Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die Ablehnung in der ' +
				'Regel nur auf; angenommen ist der Antrag damit nicht. Die Frist beginnt für Anwesende ' +
				'und Vertretene mit der Versammlung, für alle anderen, sobald sie vom Beschluss ' +
				'erfahren, spätestens mit dem Erhalt dieses Protokolls.'
		);
		expect(abgelehnt).not.toContain('Wer ihm nicht zugestimmt hat');
		// Bei «Angenommen» bleibt der geprüfte Satz, ohne den Hinweis aufs Vorlegen.
		expect(angenommen).toContain('Wer ihm nicht zugestimmt hat, auch wer nicht dabei war, kann ihn');
		expect(angenommen).not.toContain('erneut vorgelegt');
	});

	it('Gegenprobe: Ein gezählter Beschluss nennt im selben Protokoll sein Erfordernis', async () => {
		const s = await versammlung('Handweg 5', '2027-10-05');
		await abstimmen(s, s.traktandum, 'yes');
		const text = await protokoll(s.versammlung);
		expect(abschnittVon(text, 'Fassadensanierung')).toMatch(/Erforderliche Mehrheit: mehr als die Hälfte/);
	});
});

describe('Ein offener Durchgang, dessen Schliessen wirft', () => {
	it('lässt sich so beenden: geschlossen ohne Auszählung, überholt, die Stimmen bleiben', async () => {
		const s = await versammlung('Handweg 6', '2027-10-06');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		const offen = await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		// Das eingefrorene Erfordernis so gestellt, dass die Auszählung wirft: Der
		// Grenzfall hat keine Schwelle. Wie der Durchgang dahin kam, ist hier
		// gleich; geprüft wird der Ausweg.
		await imKontext(
			betreiber,
			(tx) => tx`
				UPDATE voting_round
				   SET requirement_json = jsonb_set(requirement_json, '{typ}', '"grenzfall"')
				 WHERE id = ${offen.id}
			`
		);
		expect(await absage(schliesseAbstimmung(handelnder(), s.versammlung))).toMatchObject({
			kennung: 'grenzfall'
		});
		// Die Absage hat nichts verändert: Der Durchgang ist weiter offen.
		expect((await holeOffenen(betreiber, s.versammlung))?.id).toBe(offen.id);

		expect((await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum)).ueberholt).toEqual([
			{ durchgang: 1, offen: true, art: 'notweg' }
		]);
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			SUMMEN
		);
		// Der eigene offene Durchgang ist kein «schon offen», und die
		// Rückkommensprüfung liest ihn nicht als bestehenden Beschluss.
		expect(uebergangen).toEqual([]);

		expect(await holeOffenen(betreiber, s.versammlung)).toBeNull();
		// Der abgebrochene Durchgang wird nicht nachträglich ausgezählt; genau
		// das würfe hier.
		expect((await holeErgebnis(betreiber, s.versammlung, offen.id)).auszaehlung).toBeNull();
		const [alt, neu] = await zeilen(s.traktandum);
		expect(alt).toMatchObject({
			id: offen.id,
			state: 'geschlossen',
			supersede_kind: 'notweg',
			superseded_by_round_id: durchgang.id,
			result_published_at: null,
			result_json: null
		});
		expect(alt.supersede_reason).not.toMatch(/Hand|Notweg/);
		expect(alt.attendance_json?.anwesende).toHaveLength(4);
		expect(neu.id).toBe(durchgang.id);
		expect(neu.ordinal).toBe(2);
		const [{ anzahl }] = await imKontext(
			betreiber,
			(tx) => tx<{ anzahl: number }[]>`SELECT count(*)::int AS anzahl FROM vote WHERE round_id = ${offen.id}`
		);
		expect(anzahl).toBe(2);

		expect((await eintrag(s.versammlung, durchgang.id))?.angaben).toMatchObject({
			durchgang: 2,
			ueberholt: [{ durchgang: 1, offen: true, art: 'notweg' }]
		});

		// Die Leser kommen am überholten Durchgang vorbei, der sich nicht
		// auszählen lässt.
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
		const stand = await ermittleStand(betreiber, s.versammlung);
		expect(stand?.abstimmung?.ergebnis?.angenommen).toBe(true);
		const auswertung = await holeAuswertung(betreiber, s.versammlung);
		expect(auswertung!.zeilen.find((x) => x.titel === 'Fassadensanierung')?.durchgang).toBe(2);
		const text = await protokoll(s.versammlung);
		const abschnitt = abschnittVon(text, 'Fassadensanierung');
		expect(abschnitt).toMatch(/Angenommen\./);
		expect(abschnitt).not.toMatch(VERRAETER);
		expect((await holeDurchgaenge(betreiber, s.versammlung)).map((d) => d.ueberholungsart)).toEqual([
			'notweg',
			null
		]);

		// Kein Durchgang ist offen geblieben: Das Eröffnen scheitert jetzt an
		// der Rückkommensprüfung und nicht vorher an «schon offen».
		expect(await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum))).toMatchObject({
			kennung: 'ohne_rueckkommen'
		});
	});
});

/** Nimmt einen Folgeantrag zum Grundantrag auf und setzt sein Erfordernis. */
async function folgeantrag(s: { versammlung: string; traktandum: string }) {
	const f = await nimmTraktandumAuf(
		handelnder(),
		{
			meetingId: s.versammlung,
			parentId: s.traktandum,
			titel: 'Nur die Wetterseite',
			art: 'abstimmung',
			antragswortlaut: 'Saniert wird vorerst nur die Wetterseite.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await haltErfordernisAmTraktandumFest(handelnder(), s.versammlung, f.id, ERFORDERNIS);
	return f;
}

async function durchAnderesErsetzt(traktandum: string): Promise<boolean> {
	const [z] = await imKontext(
		betreiber,
		(tx) => tx<{ ja: boolean }[]>`SELECT durch_anderes_traktandum_ersetzt(${traktandum}) AS ja`
	);
	return z.ja;
}

/** Stellt das eingefrorene Erfordernis des offenen Durchgangs so, dass sein Auszählen wirft. */
async function machUnauszaehlbar(durchgangId: string) {
	await imKontext(
		betreiber,
		(tx) => tx`
			UPDATE voting_round
			   SET requirement_json = jsonb_set(requirement_json, '{typ}', '"grenzfall"')
			 WHERE id = ${durchgangId}
		`
	);
}

describe('Ein offener Durchgang unter einem Rückkommen (Codeprüfung 01.10.2026, Befund 1)', () => {
	it('gibt das Rückkommen an den Beschluss von Hand ab, der den früheren ersetzt', async () => {
		const s = await versammlung('Handweg 21', '2027-10-21');
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		const offen = await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		expect(offen.rueckkommensantragId).toBe(r.id);
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'no' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await machUnauszaehlbar(offen.id);
		expect(await absage(schliesseAbstimmung(handelnder(), s.versammlung))).toMatchObject({ kennung: 'grenzfall' });

		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		expect(vorschau).toEqual({
			stand: ALLE_ANWESEND,
			uebergangen: [],
			ueberholt: [
				{ durchgang: 1, offen: false, art: 'rueckkommen' },
				{ durchgang: 2, offen: true, art: 'notweg' }
			]
		});
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...SUMMEN,
			ergebnis: 'abgelehnt'
		});

		const [g1, g2, g3] = await zeilen(s.traktandum);
		expect(g1).toMatchObject({ id: erst.id, supersede_kind: 'rueckkommen', superseded_by_round_id: durchgang.id });
		expect(g2).toMatchObject({
			id: offen.id,
			state: 'geschlossen',
			supersede_kind: 'notweg',
			reconsideration_item_id: null,
			result_json: null
		});
		expect(g3).toMatchObject({ id: durchgang.id, reconsideration_item_id: r.id });
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);

		// Der abgebrochene Durchgang wird nie ausgezählt, auch nicht auf Nachfrage.
		const e = await holeErgebnis(betreiber, s.versammlung, offen.id);
		expect(e.auszaehlung).toBeNull();
		expect(e.grund).toMatch(/ohne Auszählung beendet/);

		expect(await holeAuswertung(betreiber, s.versammlung)).not.toBeNull();
		expect((await ermittleStand(betreiber, s.versammlung))?.abstimmung?.ergebnis?.angenommen).toBe(false);
		expect(abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung')).toMatch(/Abgelehnt\./);
	});

	it('am Folgeantrag: Auswertung, Wand und Protokoll brechen nicht, und die Ersetzung stimmt', async () => {
		const s = await versammlung('Handweg 22', '2027-10-22');
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');
		const f = await folgeantrag(s);
		await stelleAufTraktandum(handelnder(), s.versammlung, f.id);
		const offen = await oeffneAbstimmung(handelnder(), s.versammlung, f.id);
		await machUnauszaehlbar(offen.id);
		expect(await absage(schliesseAbstimmung(handelnder(), s.versammlung))).toMatchObject({ kennung: 'grenzfall' });

		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, f.id, SUMMEN);
		const [f1, f2] = await zeilen(f.id);
		expect(f1).toMatchObject({ id: offen.id, supersede_kind: 'notweg', reconsideration_item_id: null });
		expect(f2).toMatchObject({ id: durchgang.id, reconsideration_item_id: r.id });
		expect((await zeilen(s.traktandum))[0]).toMatchObject({
			id: erst.id,
			supersede_kind: 'rueckkommen',
			superseded_by_round_id: durchgang.id
		});
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);

		// Die Leser, die über die Ersetzung nach dem Ergebnis fragen.
		expect(await holeAuswertung(betreiber, s.versammlung)).not.toBeNull();
		expect((await ermittleStand(betreiber, s.versammlung))?.abstimmung?.ergebnis?.angenommen).toBe(true);
		const text = await protokoll(s.versammlung);
		expect(abschnittVon(text, 'Fassadensanierung')).toMatch(/Er wurde angenommen; sein Beschluss ersetzt den bisherigen/);
		expect(abschnittVon(text, 'Nur die Wetterseite')).toMatch(/Angenommen\./);
	});
});

describe('Ein gezählter Durchgang mit offenem Stichentscheid (Codeprüfung 01.10.2026, N2)', () => {
	it('wird überholt und bleibt rechenbar: Er ist nicht «ohne Auszählung beendet»', async () => {
		// Zwei zu zwei aus einer Handzählung, Stichentscheid nach Wertquoten: Der
		// Durchgang ist geschlossen, gezählt und nicht verkündet. Ein naheliegender
		// Anlass für den Beschluss von Hand.
		const s = await versammlung('Handweg 24', '2027-10-24', { stichentscheid: true });
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await erfasseSummen(handelnder(), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		const gezaehlt = await schliesseAbstimmung(handelnder(), s.versammlung);
		expect(gezaehlt.verkuendetAm).toBeNull();

		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);
		const [alt] = await zeilen(s.traktandum);
		expect(alt).toMatchObject({
			id: gezaehlt.id,
			supersede_kind: 'notweg',
			result_published_at: null,
			superseded_by_round_id: durchgang.id
		});
		const e = await holeErgebnis(betreiber, s.versammlung, gezaehlt.id);
		expect(e.auszaehlung?.stichentscheidOffen).toBe(true);
		expect(e.auszaehlung?.koepfe).toMatchObject({ ja: 2, nein: 2 });
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
	});
});

describe('Während an einem anderen Traktandum eine Abstimmung offen ist', () => {
	it('bleibt die Versammlung beim offenen Traktandum, und der offene Durchgang bleibt offen', async () => {
		const s = await versammlung('Handweg 23', '2027-10-23', { kenntnisnahme: true });
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		const offen = await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);

		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.kenntnis!, SUMMEN);
		expect((await zeilen(s.kenntnis!))[0]).toMatchObject({ id: durchgang.id, state: 'geschlossen' });
		expect((await holeOffenen(betreiber, s.versammlung))?.id).toBe(offen.id);
		const [v] = await imKontext(
			betreiber,
			(tx) => tx<{ current_agenda_item_id: string }[]>`
				SELECT current_agenda_item_id FROM meeting WHERE id = ${s.versammlung}
			`
		);
		expect(v.current_agenda_item_id).toBe(s.traktandum);
	});
});

describe('Rückkommen, am Code geklärt', () => {
	it('überholt den geltenden Durchgang auch ohne Rückkommen und nennt die Absage', async () => {
		const s = await versammlung('Handweg 7', '2027-10-07');
		const erst = await abstimmen(s, s.traktandum, 'no');

		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		expect(vorschau.ueberholt).toEqual([{ durchgang: 1, offen: false, art: 'notweg' }]);
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			SUMMEN
		);
		expect(uebergangen.map((u) => u.kennung)).toEqual(['ohne_rueckkommen']);
		expect(vorschau.uebergangen).toEqual(uebergangen);

		const [alt, neu] = await zeilen(s.traktandum);
		expect(alt).toMatchObject({
			id: erst.id,
			supersede_kind: 'notweg',
			superseded_by_round_id: durchgang.id
		});
		// Das Ergebnis des überholten bleibt festgeschrieben und lesbar.
		expect((await holeErgebnis(betreiber, s.versammlung, erst.id)).auszaehlung?.angenommen).toBe(false);
		expect(neu.reconsideration_item_id).toBeNull();
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);

		// Das Protokoll nennt die Nummer des Durchgangs, ohne den Weg und ohne
		// den Ort, an dem er steht (Produktentscheid 01.10.2026: «Nummer ohne
		// Verweis»).
		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toMatch(/Angenommen\./);
		// `abschnittVon` legt die Zeilen aneinander; die Zeile steht am Schluss.
		expect(abschnitt).toMatch(/- 2\. Durchgang\.$/);
		expect(abschnitt).not.toMatch(/von Hand|übergangen|Notweg|Neuabstimmung|Rückkommen|Verlauf/);
	});

	it('ersetzt unter einem angenommenen Rückkommen den früheren Beschluss wie ein gezählter Durchgang', async () => {
		const s = await versammlung('Handweg 8', '2027-10-08');
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');

		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		expect(vorschau).toEqual({
			stand: ALLE_ANWESEND,
			uebergangen: [],
			ueberholt: [{ durchgang: 1, offen: false, art: 'rueckkommen' }]
		});
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			{ ...SUMMEN, ergebnis: 'abgelehnt' }
		);
		// Die Versammlung hat das Rückkommen beschlossen: Der neue Durchgang ist
		// zulässig, und es gibt nichts zu übergehen.
		expect(uebergangen).toEqual([]);
		const [alt, neu] = await zeilen(s.traktandum);
		expect(neu).toMatchObject({ id: durchgang.id, reconsideration_item_id: r.id });
		expect(alt).toMatchObject({
			id: erst.id,
			supersede_kind: 'rueckkommen',
			supersede_reason: 'Ersetzt durch den Beschluss nach Rückkommen',
			superseded_by_round_id: durchgang.id
		});
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
		expect((await eintrag(s.versammlung, durchgang.id))?.angaben).toMatchObject({
			ueberholt: [{ durchgang: 1, offen: false, art: 'rueckkommen' }]
		});

		// Verbraucht: Ein weiterer Durchgang unter demselben Rückkommen geht nicht.
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		expect(await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum))).toMatchObject({
			kennung: 'rueckkommen_verbraucht'
		});

		// Das Protokoll sagt, was es nach jedem Rückkommen sagt, und nicht, es sei
		// nicht erneut abgestimmt worden.
		const text = await protokoll(s.versammlung);
		expect(text).not.toMatch(/erneut abgestimmt wurde nicht/i);
		expect(abschnittVon(text, 'Fassadensanierung')).toMatch(/Abgelehnt\./);
		expect(abschnittVon(text, 'Fassadensanierung')).not.toMatch(/von Hand|übergangen|Notweg/);
	});

	it('weist eine Neuabstimmung auf den Beschluss von Hand nach Rückkommen ab, er bleibt massgebend', async () => {
		// H6: Der Beschluss von Hand ist mit dem Festhalten verkündet. Bis dahin
		// überholte ihn die Neuabstimmung, und der frühere galt wieder
		// (Migration 131); ändern kann ihn jetzt nur die Versammlung.
		const s = await versammlung('Handweg 17', '2027-10-17');
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...SUMMEN,
			ergebnis: 'abgelehnt'
		});
		expect(durchgang.verkuendetAm).not.toBeNull();
		const neu = setzeNeuabstimmungAn(
			handelnder(),
			s.versammlung,
			durchgang.id,
			'Prüflauf: Zahlen falsch eingetragen'
		);
		await expect(neu).rejects.toMatchObject({ kennung: 'schon_verkuendet' });
		await expect(neu).rejects.toThrow(/Beantragen Sie das Rückkommen/);

		const [alt, gilt] = await zeilen(s.traktandum);
		expect(alt).toMatchObject({
			id: erst.id,
			supersede_kind: 'rueckkommen',
			superseded_by_round_id: durchgang.id
		});
		expect(gilt).toMatchObject({ id: durchgang.id, superseded_at: null, supersede_kind: null });
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
		const eintraege = await imKontext(
			betreiber,
			(tx) => tx`
				SELECT 1 FROM audit_entry
				 WHERE event_type IN ('vote.round.superseded', 'vote.round.reinstated')
				   AND subject_id = ${s.versammlung}
			`
		);
		expect(eintraege).toHaveLength(0);
	});

	it('ersetzt vom Folgeantrag aus den Beschluss des Grundantrags, wenn das Rückkommen ihn trägt', async () => {
		// Migration 133: Nach dem Rückkommen kommt statt des alten Antrags der
		// Folgeantrag; hier wird sein Beschluss von Hand festgehalten.
		const s = await versammlung('Handweg 18', '2027-10-18');
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');
		const f = await folgeantrag(s);

		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, f.id);
		expect(vorschau).toEqual({
			stand: ALLE_ANWESEND,
			uebergangen: [],
			ueberholt: [{ durchgang: 1, offen: false, art: 'rueckkommen', traktandumId: s.traktandum }]
		});
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, f.id, SUMMEN);

		expect((await zeilen(f.id))[0]).toMatchObject({ id: durchgang.id, reconsideration_item_id: r.id });
		expect((await zeilen(s.traktandum))[0]).toMatchObject({
			id: erst.id,
			supersede_kind: 'rueckkommen',
			superseded_by_round_id: durchgang.id
		});
		// Eine Sache, ein Beschluss.
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
		expect(await durchAnderesErsetzt(s.traktandum)).toBe(true);

		// Die Sätze zur Ersetzung stimmen ohne eigene Regel.
		const text = await protokoll(s.versammlung);
		expect(abschnittVon(text, 'Fassadensanierung')).toMatch(
			/kam statt dieses Antrags der Folgeantrag .* zur Abstimmung\. Er wurde angenommen; sein Beschluss ersetzt den bisherigen/
		);
		const beimFolgeantrag = abschnittVon(text, 'Nur die Wetterseite');
		expect(beimFolgeantrag).toMatch(/Angenommen\./);
		expect(beimFolgeantrag).toMatch(/Dieser Beschluss ersetzt den bisherigen/);
		expect(beimFolgeantrag).not.toMatch(VERRAETER);
	});

	it('lässt einen zweiten Beschluss von Hand den ersten überholen', async () => {
		const s = await versammlung('Handweg 9', '2027-10-09');
		const eins = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);
		const zwei = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...SUMMEN,
			ergebnis: 'abgelehnt'
		});
		expect(zwei.uebergangen.map((u) => u.kennung)).toEqual(['ohne_rueckkommen']);
		const [alt] = await zeilen(s.traktandum);
		expect(alt).toMatchObject({ id: eins.durchgang.id, supersede_kind: 'notweg' });
		expect(await massgebend(s.traktandum)).toBe(zwei.durchgang.id);
		expect((await holeErgebnis(betreiber, s.versammlung, zwei.durchgang.id)).auszaehlung?.angenommen).toBe(false);
	});
});

/*
 * **Umfang und Wortlaut sind Soll.** Ohne tragendes Rückkommen überholt der
 * Beschluss von Hand nur am eigenen Traktandum (Produktentscheid 01.10.2026:
 * «Entscheid Notwegs: ja, bleibt dort.»). Wo ein Folgeantrag beteiligt ist,
 * stehen danach zwei Beschlüsse zur selben Sache. Die Sätze zur Ersetzung
 * folgen dem Stand (Produktentscheid 01.10.2026: «Sätze folgen dem Stand»;
 * Plan, «Stand Block 2a»): Die ersten zwei Proben halten es am Protokoll fest,
 * die dritte liest das Protokoll nicht.
 */
describe('Mit einem Folgeantrag, ohne tragendes Rückkommen: nur am eigenen Traktandum', () => {
	/** Grundantrag angenommen, Rückkommen angenommen, Folgeantrag angenommen: Er hat ersetzt. */
	async function nachErsetzung(name: string, datum: string) {
		const s = await versammlung(name, datum);
		const erst = await abstimmen(s, s.traktandum, 'yes');
		const r = await stelleRueckkommensantrag(handelnder(), s.versammlung, s.traktandum);
		await abstimmen(s, r.id, 'yes');
		const f = await folgeantrag(s);
		const folge = await abstimmen(s, f.id, 'yes');
		expect(await massgebend(s.traktandum)).toBe(folge.id);
		expect((await zeilen(s.traktandum))[0]).toMatchObject({ id: erst.id, supersede_kind: 'rueckkommen' });
		return { ...s, erst: erst.id, folgeantrag: f.id, folge: folge.id };
	}

	it('am Grundantrag nach der Ersetzung: Der Durchgang des Folgeantrags bleibt daneben stehen', async () => {
		const s = await nachErsetzung('Handweg 16', '2027-10-16');
		const vorschau = await holeVonHandVorschau(betreiber, s.versammlung, s.traktandum);
		// Am Grundtraktandum gilt kein eigener Durchgang mehr; überholt wird nichts.
		expect(vorschau.ueberholt).toEqual([]);
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			{ ...SUMMEN, ergebnis: 'abgelehnt' }
		);
		// Die Sperre, an der die Leitung vorbeigeht, steht im Verlauf.
		expect(uebergangen.map((u) => u.kennung)).toEqual(['rueckkommen_verbraucht']);

		// Zwei geltende Durchgänge zur selben Sache.
		expect(await massgebend(s.traktandum)).toBe(durchgang.id);
		expect(await massgebend(s.folgeantrag)).toBe(s.folge);
		expect((await zeilen(s.folgeantrag))[0]).toMatchObject({ id: s.folge, supersede_kind: null });
		expect(await durchAnderesErsetzt(s.traktandum)).toBe(true);

		// Die Sätze folgen dem Stand (Produktentscheid 01.10.2026): Jedes
		// Traktandum zeigt sein eigenes Ergebnis, und keiner der Sätze zur
		// Ersetzung steht mehr, weder am Grundantrag noch am Folgeantrag.
		const text = await protokoll(s.versammlung);
		const beimGrundantrag = abschnittVon(text, 'Fassadensanierung');
		expect(beimGrundantrag).toMatch(/Abgelehnt\./);
		expect(beimGrundantrag).not.toMatch(/statt dieses Antrags/);
		const beimFolgeantrag = abschnittVon(text, 'Nur die Wetterseite');
		expect(beimFolgeantrag).toMatch(/Angenommen/);
		expect(beimFolgeantrag).not.toMatch(/ersetzt den bisherigen/);
	});

	it('am Folgeantrag nach der Ersetzung: Die Sache hat danach keinen massgebenden Durchgang', async () => {
		// Etwa um einen Tippfehler am Folgeantrag zu berichtigen.
		const s = await nachErsetzung('Handweg 19', '2027-10-19');
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.folgeantrag,
			{ ...SUMMEN, ergebnis: 'abgelehnt' }
		);
		expect(uebergangen.map((u) => u.kennung)).toEqual(['rueckkommen_verbraucht']);
		expect((await zeilen(s.folgeantrag))[0]).toMatchObject({
			id: s.folge,
			supersede_kind: 'notweg',
			superseded_by_round_id: durchgang.id
		});
		expect(await massgebend(s.folgeantrag)).toBe(durchgang.id);
		// Die Kette vom Grundantrag endet beim überholten Durchgang des
		// Folgeantrags: `massgebender_durchgang` folgt dem Verweis nur bei
		// `rueckkommen`.
		expect(await massgebend(s.traktandum)).toBeNull();
		expect(await durchAnderesErsetzt(s.traktandum)).toBe(true);
		// Die Leser brechen daran nicht.
		expect(await holeAuswertung(betreiber, s.versammlung)).not.toBeNull();
		const text = await protokoll(s.versammlung);
		expect(abschnittVon(text, 'Nur die Wetterseite')).toMatch(/Abgelehnt\./);
		// Die Sätze folgen dem Stand (Produktentscheid 01.10.2026): Am
		// Grundantrag steht das berichtigte Ergebnis des Folgeantrags, nicht
		// mehr das des überholten Durchgangs.
		const beimGrundantrag = abschnittVon(text, 'Fassadensanierung');
		expect(beimGrundantrag).toMatch(/Er wurde abgelehnt/);
		expect(beimGrundantrag).not.toMatch(/Er wurde angenommen/);
	});

	it('am Folgeantrag, während der Grundantrag entschieden ist: zwei Beschlüsse, die Absage im Verlauf', async () => {
		// Die Lücke, die der Plan Folgeantrag (Ist 3) für das Eröffnen geschlossen hat.
		const s = await versammlung('Handweg 20', '2027-10-20');
		const f = await folgeantrag(s);
		const erst = await abstimmen(s, s.traktandum, 'yes');

		await stelleAufTraktandum(handelnder(), s.versammlung, f.id);
		const zu = await absage(oeffneAbstimmung(handelnder(), s.versammlung, f.id));
		expect(zu).not.toBe('durchgelassen');

		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			f.id,
			SUMMEN
		);
		expect(uebergangen).toEqual([zu]);
		expect(await massgebend(f.id)).toBe(durchgang.id);
		expect(await massgebend(s.traktandum)).toBe(erst.id);
		expect((await zeilen(s.traktandum))[0]).toMatchObject({ id: erst.id, supersede_kind: null });
	});
});

describe('Festschreibung und Grenzen', () => {
	it('schreibt das Ergebnis fest: Eine spätere Änderung weist die Datenbank ab', async () => {
		const s = await versammlung('Handweg 10', '2027-10-10');
		const { durchgang } = await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`
					UPDATE voting_round
					   SET result_json = jsonb_set(result_json, '{auszaehlung,angenommen}', 'false')
					 WHERE id = ${durchgang.id}
				`
			)
		).rejects.toThrow(/verkündet und festgeschrieben/);
	});

	it('geht nicht vor der Eröffnung und schreibt dann nichts', async () => {
		const s = await versammlung('Handweg 11', '2027-10-11', { eroeffnet: false });
		expect(
			await absage(haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN))
		).toMatchObject({ kennung: 'nicht_laufend' });
		expect(await absage(holeVonHandVorschau(betreiber, s.versammlung, s.traktandum))).toMatchObject({
			kennung: 'nicht_laufend'
		});
		expect(await zeilen(s.traktandum)).toEqual([]);
	});

	it('nennt beim zurückgezogenen Antrag den Weg, statt an der Datenbank zu scheitern', async () => {
		const s = await versammlung('Handweg 12', '2027-10-12');
		await ziehAntragZurueck(handelnder(), s.versammlung, s.traktandum, 'Prüflauf: Offerte fehlt');
		const a = await absage(haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN));
		expect(a).toMatchObject({ kennung: 'zurueckgezogen' });
		expect((a as { satz: string }).satz).toMatch(/Rückzug zurück/);
		expect(await zeilen(s.traktandum)).toEqual([]);
	});

	it('weist ein Traktandum einer anderen Versammlung ab', async () => {
		const a = await versammlung('Handweg 13', '2027-10-13');
		const b = await versammlung('Handweg 14', '2027-10-14');
		expect(
			await absage(haltBeschlussVonHandFest(handelnder(), a.versammlung, b.traktandum, SUMMEN))
		).not.toBe('durchgelassen');
		expect(await zeilen(b.traktandum)).toEqual([]);
	});

	it('hält fest, was die Maske schickt: die Wahl je Partei aus den Formularfeldern', async () => {
		// Die Kette der Oberfläche: Das Formular der Maske wird in eine
		// `VonHandEingabe` übersetzt und geht unverändert an den Server.
		const s = await versammlung('Handweg 25', '2027-10-25', { anwesend: 1 });
		const daten = new FormData();
		daten.append('traktandum', s.traktandum);
		daten.append('erfassung', 'parteien');
		daten.append(`wahl_${s.parteien[0]}`, 'yes');
		daten.append(`wahl_${s.parteien[1]}`, 'no');
		daten.append('ergebnis', 'angenommen');
		const { durchgang, uebergangen } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			// Die Kennung liest die Route aus dem Formular; hier steht sie direkt.
			s.traktandum,
			eingabeAusFormular(daten)
		);
		expect(uebergangen.map((u) => u.kennung)).toEqual(['nicht_beschlussfaehig']);
		const e = await holeErgebnis(betreiber, s.versammlung, durchgang.id);
		expect(e.auszaehlung?.vonHand).toEqual({
			erfassung: 'parteien',
			stimmen: [
				{ partei: s.parteien[0], wahl: 'yes' },
				{ partei: s.parteien[1], wahl: 'no' }
			]
		});
		expect([e.auszaehlung?.koepfe.ja, e.auszaehlung?.koepfe.nein]).toEqual([1, 1]);
	});

	it('meldet dem Strom «ohne Schwelle», und der gezählte Weg tut das nicht', async () => {
		// Der Kopfspiegel (Block 2): Die Wand zeigt beim von Hand
		// festgehaltenen Ergebnis nur Ja, Nein und Enthaltung; das Merkmal dafür
		// reist im Strom mit, und Erfordernis und Satz der nötigen Mehrheit
		// bleiben leer.
		const s = await versammlung('Handweg 26', '2027-10-26');
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);
		const stand = await ermittleStand(betreiber, s.versammlung);
		expect(stand?.abstimmung?.ergebnis?.ohneSchwelle).toBe(true);
		expect(stand?.abstimmung?.erfordernis).toBe('');
		expect(stand?.abstimmung?.noetig).toBe('');
		expect(stand?.abstimmung?.ergebnis?.koepfe.schwelle).toBeNull();

		// Gegenprobe: Ein gezählter Durchgang trägt weder das Merkmal noch die
		// leeren Angaben.
		const g = await versammlung('Handweg 27', '2027-10-27');
		await abstimmen(g, g.traktandum, 'yes');
		const gezaehlt = await ermittleStand(betreiber, g.versammlung);
		expect(gezaehlt?.abstimmung?.ergebnis?.ohneSchwelle).toBe(false);
		expect(gezaehlt?.abstimmung?.erfordernis).not.toBe('');
	});

	it('schreibt bei ungültigen Zahlen nichts, auch keinen Verlaufseintrag', async () => {
		const s = await versammlung('Handweg 15', '2027-10-15');
		expect(
			await absage(
				haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
					ergebnis: 'angenommen',
					zahlen: { erfassung: 'summen', koepfe: { ja: -1, nein: 0, enthaltung: 0 }, quoten: null }
				})
			)
		).toMatchObject({ kennung: 'zahl_ungueltig' });
		// Ganz ohne Zahlen: die fachliche Absage, kein Typfehler (N3).
		expect(
			await absage(
				haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
					ergebnis: 'angenommen',
					zahlen: null as never
				})
			)
		).toMatchObject({ kennung: 'zahlen_fehlen' });
		expect(await zeilen(s.traktandum)).toEqual([]);
		const { zeilen: verlauf } = await leseVerlauf(betreiber, {
			versammlung: s.versammlung,
			art: 'vote.decided.by.chair'
		});
		expect(verlauf).toEqual([]);
	});
});

/**
 * Punkt 4 aus «Offen aus Block 1», gemessen und behoben in Block 3
 * (Produktentscheid 01.10.2026).
 *
 * **Der Befund vorher:** `daten/stimmen.json` nannte den von Hand
 * festgehaltenen Durchgang «einzelstimmen» und führte eine leere Liste, und der
 * Stimmnachweis schrieb «Zu diesem Traktandum wurde keine Stimme erfasst.»
 * direkt unter die Zahlen. Die Wahl je Partei liegt in der Festschreibung
 * (`vonHand.stimmen`) und nicht in `vote`; die Datei, die dafür gedacht ist,
 * las sich wie «niemand hat gestimmt», und die Wahlen des Durchgangs standen in
 * keiner Datei des Pakets.
 */
describe('Stimmnachweis und Paket zeigen die Wahl je Partei (Block 3, Punkt 4)', () => {
	/** Bis zum versiegelten Paket, damit dessen Dateien geprüft werden können. */
	async function versiegelt(
		name: string,
		datum: string,
		eingabe: (s: Awaited<ReturnType<typeof versammlung>>) => VonHandEingabe
	) {
		const s = await versammlung(name, datum);
		const { durchgang } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			eingabe(s)
		);
		await schliesseVersammlung(handelnder(), s.versammlung);
		await versiegle(handelnder(), s.versammlung, `${datum} 21:30:00`);
		const { entpacke } = await import('./zip');
		const dateien = entpacke((await holePaket(betreiber, s.versammlung)) as Uint8Array);
		return { ...s, durchgang, dateien };
	}

	function stimmenzeile(dateien: Map<string, Uint8Array>, durchgangId: string) {
		const liste = JSON.parse(
			new TextDecoder().decode(dateien.get('daten/stimmen.json') as Uint8Array)
		) as {
			durchgangId: string;
			erfassung: string;
			handzaehlung: unknown;
			vonHand: {
				erfassung: string;
				stimmen: { partei: string; name: string | null; wahl: string }[] | null;
				koepfe: Record<string, number>;
				quoten: Record<string, number> | null;
			} | null;
			stimmen: unknown[];
		}[];
		return liste.find((d) => d.durchgangId === durchgangId);
	}

	async function blatttext(dateien: Map<string, Uint8Array>): Promise<string> {
		const { textVonSeite } = await import('./pdftext');
		const pfad = [...dateien.keys()].find((k) => k.startsWith('stimmnachweis/')) as string;
		return textVonSeite(dateien.get(pfad) as Uint8Array);
	}

	it('führt die Wahl je Partei im Paket und auf dem Stimmnachweis', async () => {
		const r = await versiegelt('Handweg 28', '2027-10-28', (s) => ({
			ergebnis: 'abgelehnt',
			zahlen: {
				erfassung: 'parteien',
				stimmen: [
					{ parteiId: s.parteien[0], wahl: 'yes' },
					{ parteiId: s.parteien[1], wahl: 'no' },
					{ parteiId: s.parteien[2], wahl: 'abstain' }
				]
			}
		}));

		const zeile = stimmenzeile(r.dateien, r.durchgang.id);
		expect(zeile?.erfassung).toBe('von_hand');
		expect(zeile?.handzaehlung).toBeNull();
		expect(zeile?.vonHand).toMatchObject({
			erfassung: 'parteien',
			koepfe: { ja: 1, nein: 1, enthaltung: 1 },
			quoten: { ja: 225, nein: 225, enthaltung: 225 }
		});
		// Mit dem Namen aus der Momentaufnahme: Nach dem Löschen der Versammlung
		// ist die Kennung allein nichts wert.
		expect(zeile?.vonHand?.stimmen).toEqual([
			{ partei: r.parteien[0], name: 'Probe Alpha', wahl: 'yes' },
			{ partei: r.parteien[1], name: 'Probe Beta', wahl: 'no' },
			{ partei: r.parteien[2], name: 'Probe Gamma', wahl: 'abstain' }
		]);
		// Die Tabelle `vote` ist wirklich leer: Die Wahl steht in der Festschreibung.
		expect(zeile?.stimmen).toEqual([]);

		const blatt = await blatttext(r.dateien);
		expect(blatt).toContain('Die Wahl je Partei');
		for (const wer of ['Probe Alpha', 'Probe Beta', 'Probe Gamma']) {
			expect(blatt).toContain(wer);
		}
		expect(blatt).not.toContain('keine Stimme erfasst');
		// Der Weg steht nicht auf dem Blatt, wie nirgends nach aussen.
		expect(blatt).not.toMatch(/von Hand|Notweg|übergangen/i);
	});

	it('weist bei Summen den Durchgang als Summen aus und sagt es auf dem Blatt', async () => {
		const r = await versiegelt('Handweg 29', '2027-10-29', () => SUMMEN);

		const zeile = stimmenzeile(r.dateien, r.durchgang.id);
		expect(zeile?.erfassung).toBe('von_hand');
		expect(zeile?.vonHand).toMatchObject({
			erfassung: 'summen',
			stimmen: null,
			koepfe: { ja: 3, nein: 1, enthaltung: 0 },
			quoten: { ja: 675, nein: 225, enthaltung: 0 }
		});

		const blatt = await blatttext(r.dateien);
		expect(blatt).toContain('Als Summen erfasst');
		expect(blatt).not.toContain('keine Stimme erfasst');
		expect(blatt).not.toMatch(/von Hand|Notweg|übergangen/i);
	});
});

describe('Nach dem Schluss: der Beschluss im Votenfeld (Block 6)', () => {
	/*
	 * **Gemessen, bevor es im Handbuch steht** (Produktentscheid 02.10.2026:
	 * «Handbuch: ins Textfeld»). Der Entscheid vom 30.09.2026 bleibt: Nach dem
	 * Schluss lässt sich kein Beschluss mehr von Hand festhalten. Das Handbuch
	 * schickt die Sitzungsleitung dann ins Votenfeld des Traktandums. Diese
	 * Probe hält fest, was dort geht und was daneben im Protokoll steht.
	 */
	it('nimmt den Text nach dem Schluss und nach dem Versiegeln an, und das Protokoll sagt daneben «nicht abgestimmt»', async () => {
		const s = await versammlung('Handweg 31', '2027-10-31');
		await stelleAufTraktandum(handelnder(), s.versammlung, s.traktandum);
		await schliesseVersammlung(handelnder(), s.versammlung);

		// Der Notweg ist zu, wie am 30.09.2026 entschieden.
		expect(
			await absage(haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN))
		).toMatchObject({ satz: expect.stringContaining('läuft nicht mehr') });

		const eintrag = 'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 1 Nein.';
		await setzeProtokollnotiz(handelnder(), s.versammlung, s.traktandum, eintrag);

		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toContain(eintrag);
		// Votum führt kein Ergebnis; der Entwurf sagt es im selben Abschnitt.
		expect(abschnitt).toContain('Über diesen Antrag wurde nicht abgestimmt.');
		expect(abschnitt).not.toMatch(/Kopfstimmen:/);
		const zeile = (await holeAuswertung(betreiber, s.versammlung))!.zeilen.find(
			(z) => z.titel === 'Fassadensanierung'
		)!;
		expect(zeile.auszaehlung).toBeNull();

		// Auch nach dem Versiegeln: Das Votenfeld ist nicht Teil des Siegels (Migration 039).
		await versiegle(handelnder(), s.versammlung, '2027-10-31 21:30:00');
		const nachtrag = `${eintrag} Anwesend oder vertreten: 4 von 4 Eigentümern.`;
		await setzeProtokollnotiz(handelnder(), s.versammlung, s.traktandum, nachtrag);
		expect(abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung')).toContain(nachtrag);
	});
});

describe('Der Beschlussvermerk am Traktandum (Block 7)', () => {
	/*
	 * **Produktentscheide 02.10.2026.** Der Weg «ins Textfeld» nach dem Schluss
	 * bleibt; mit dem Vermerk schreibt das Protokoll den Satz «Über diesen
	 * Antrag wurde nicht abgestimmt.» nicht, und am gemeinsamen Abend zählt der
	 * Punkt nicht als Lücke. Diese Proben messen das Hausprotokoll, die vier
	 * Schranken des Setzens und das Zusammenspiel mit dem Votenfeld.
	 */

	it('lässt mit dem Vermerk den Satz «nicht abgestimmt» weg und behält den Text der Leitung', async () => {
		const s = await versammlung('Handweg 32', '2027-11-01');
		await schliesseVersammlung(handelnder(), s.versammlung);
		const eintrag = 'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 1 Nein.';
		await setzeProtokollnotiz(handelnder(), s.versammlung, s.traktandum, eintrag);
		await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true);

		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toContain(eintrag);
		// Der Beschluss ist kein Ergebnis; die Zeile, die Votum sonst setzt,
		// entfällt ersatzlos, und es tritt kein neuer Satz an ihre Stelle.
		expect(abschnitt).not.toContain('Über diesen Antrag wurde nicht abgestimmt.');
		expect(abschnitt).not.toMatch(/von Hand|Notweg|Vermerk/i);
	});

	it('Gegenprobe: ohne den Vermerk steht die Zeile', async () => {
		const s = await versammlung('Handweg 33', '2027-11-02');
		await schliesseVersammlung(handelnder(), s.versammlung);
		await setzeProtokollnotiz(
			handelnder(),
			s.versammlung,
			s.traktandum,
			'Beschluss: Die Fassade wird saniert.'
		);
		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toContain('Über diesen Antrag wurde nicht abgestimmt.');
	});

	it('weist die laufende Versammlung ab und nennt den Beschluss von Hand', async () => {
		const s = await versammlung('Handweg 34', '2027-11-03');
		const a = await absage(setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true));
		expect(a).not.toBe('durchgelassen');
		expect((a as { kennung: string }).kennung).toBe('nicht_abgeschlossen');
		expect((a as { satz: string }).satz).toContain('Beschluss von Hand');
	});

	it('weist ein Traktandum mit Ergebnis ab', async () => {
		const s = await versammlung('Handweg 35', '2027-11-04');
		await abstimmen(s, s.traktandum, 'yes');
		await schliesseVersammlung(handelnder(), s.versammlung);
		await setzeProtokollnotiz(
			handelnder(),
			s.versammlung,
			s.traktandum,
			'Beschluss: Die Fassade wird saniert.'
		);
		const a = await absage(setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true));
		expect((a as { kennung: string }).kennung).toBe('hat_ergebnis');
	});

	it('weist das leere Votenfeld ab', async () => {
		const s = await versammlung('Handweg 36', '2027-11-05');
		await schliesseVersammlung(handelnder(), s.versammlung);
		const a = await absage(setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true));
		expect((a as { kennung: string }).kennung).toBe('leer');
		expect((a as { satz: string }).satz).toContain('Votenfeld');
	});

	it('weist ein fremdes Traktandum ab', async () => {
		const a1 = await versammlung('Handweg 37', '2027-11-06');
		const a2 = await versammlung('Handweg 38', '2027-11-07');
		await schliesseVersammlung(handelnder(), a1.versammlung);
		const a = await absage(
			setzeBeschlussvermerk(handelnder(), a1.versammlung, a2.traktandum, true)
		);
		expect((a as { kennung: string }).kennung).toBe('fremdes_traktandum');
	});

	it('nimmt das Leeren des Votenfelds den Vermerk mit', async () => {
		const s = await versammlung('Handweg 39', '2027-11-08');
		await schliesseVersammlung(handelnder(), s.versammlung);
		await setzeProtokollnotiz(
			handelnder(),
			s.versammlung,
			s.traktandum,
			'Beschluss: Die Fassade wird saniert.'
		);
		await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true);
		// Leeren über denselben Weg, der das Feld sichert.
		await setzeProtokollnotiz(handelnder(), s.versammlung, s.traktandum, '');
		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toContain('Über diesen Antrag wurde nicht abgestimmt.');
		// Der Verlauf endet auf «zurückgenommen»: Sonst bliebe das Setzen der
		// letzte Eintrag seiner Art, obwohl der Vermerk weg ist.
		const { zeilen: verlauf } = await leseVerlauf(betreiber, {
			versammlung: s.versammlung,
			art: 'minutes.decision.marked'
		});
		expect(verlauf.map((z) => z.angaben.vermerk).sort()).toEqual([false, true]);
	});

	it('lässt sich nach dem Versiegeln setzen und zurücknehmen; anderes weist das Siegel ab', async () => {
		/*
		 * **Die Ausnahme bleibt schmal** (Block 7). Der Vermerk gehört wie die
		 * Protokollnotiz nicht zum Nachweis (PRD §4.11): Der Beschluss steht im
		 * Votenfeld, und das ist nach dem Versiegeln die einzige Stelle, an der
		 * er noch nachgetragen werden kann. Jede andere Änderung am Traktandum
		 * weist das Siegel weiter ab.
		 */
		const s = await versammlung('Handweg 40', '2027-11-09');
		await schliesseVersammlung(handelnder(), s.versammlung);
		await setzeProtokollnotiz(
			handelnder(),
			s.versammlung,
			s.traktandum,
			'Beschluss: Die Fassade wird saniert.'
		);
		await versiegle(handelnder(), s.versammlung, '2027-11-09 21:30:00');

		expect(
			(await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true)).vermerk
		).toBe(true);
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE agenda_item SET title = 'gefälscht' WHERE id = ${s.traktandum}`
			)
		).rejects.toThrow(/title/);
		// Der Satz der Absage nennt beides, was offen bleibt (Migration 136).
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE agenda_item SET title = 'gefälscht' WHERE id = ${s.traktandum}`
			)
		).rejects.toThrow(/nur noch die Protokollnotiz und der Beschlussvermerk ändern/);
		expect(
			(await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, false)).vermerk
		).toBe(false);
	});
});

describe('Die Auswertung beim Traktandum mit Beschlussvermerk (Block 7b)', () => {
	/*
	 * **Produktentscheid 02.10.2026** («ok, ja»): Die Auswertung geht an die
	 * Eigentümer. Stünde dort «Es wurde nicht abgestimmt.», während das
	 * Protokoll den Beschluss führt, widerspräche das eine Blatt dem anderen.
	 * Gemessen wird die Zeile, die Zählung im Kopf und das PDF.
	 */
	async function pdftext(versammlungId: string): Promise<string> {
		const { textVonSeite } = await import('./pdftext');
		const { PDFDocument } = await import('pdf-lib');
		const a = (await holeAuswertung(betreiber, versammlungId))!;
		const bytes = await erzeugeAuswertung({
			versammlung: a.versammlung,
			gemeinschaftName: 'Prüfgemeinschaft',
			zaehlweise: a.zaehlweise,
			stichentscheid: a.stichentscheid,
			zeilen: a.zeilen,
			erzeugtAm: '1. November 2027, 21:30'
		});
		const seiten = (await PDFDocument.load(bytes)).getPageCount();
		return (
			await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i)))
		).join('\n');
	}

	async function mitText(name: string, datum: string) {
		const s = await versammlung(name, datum);
		await schliesseVersammlung(handelnder(), s.versammlung);
		await setzeProtokollnotiz(
			handelnder(),
			s.versammlung,
			s.traktandum,
			'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 1 Nein.'
		);
		return s;
	}

	it('schreibt mit dem Vermerk den eigenen Satz, in der Zeile und im PDF, und zählt den Punkt nicht als «ohne Abstimmung»', async () => {
		const s = await mitText('Handweg 41', '2027-11-10');
		const vorher = (await holeAuswertung(betreiber, s.versammlung))!;
		await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true);

		const a = (await holeAuswertung(betreiber, s.versammlung))!;
		const zeile = a.zeilen.find((z) => z.titel === 'Fassadensanierung')!;
		expect(zeile.beschlussvermerk).toBe(true);
		// Kein Ergebnis, keine Zahlen: Votum kennt den Ausgang nicht.
		expect(zeile.auszaehlung).toBeNull();
		expect(zeile.satz).toBeNull();
		expect(a.mitBeschlussvermerk).toBe(1);
		expect(a.ohneAbstimmung).toBe(vorher.ohneAbstimmung - 1);
		expect(a.angenommen).toBe(vorher.angenommen);
		expect(a.abgelehnt).toBe(vorher.abgelehnt);

		const text = await pdftext(s.versammlung);
		expect(text).toContain(AUSWERTUNG_VON_HAND_ABGESTIMMT);
		// Die übrigen Traktanden der Vorrichtung sind Kenntnisnahmen oder tragen
		// keinen Vermerk; der alte Satz steht im Blatt nur noch so oft wie zuvor
		// ohne dieses Traktandum.
		const zahl = (t: string) => t.split('Es wurde nicht abgestimmt.').length - 1;
		const ohneVermerk = zahl(
			await (async () => {
				await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, false);
				return pdftext(s.versammlung);
			})()
		);
		expect(zahl(text)).toBe(ohneVermerk - 1);
	});

	it('friert im Abschlusspaket den Stand beim Versiegeln ein: Haken davor im Blatt, Haken danach nicht', async () => {
		/*
		 * **Gemessen für das Handbuch** (Block 7b). `Auswertung.pdf` im Paket
		 * entsteht einmal, beim Versiegeln, aus derselben `holeAuswertung`. Der
		 * Haken lässt sich danach noch setzen, das Paket folgt ihm nicht mehr;
		 * Seite und frisches PDF schon. Dann stehen zwei Sätze nebeneinander.
		 */
		const { entpacke } = await import('./zip');
		const { textVonSeite } = await import('./pdftext');
		const { PDFDocument } = await import('pdf-lib');
		const blattImPaket = async (versammlungId: string) => {
			const dateien = entpacke((await holePaket(betreiber, versammlungId)) as Uint8Array);
			const bytes = dateien.get('Auswertung.pdf') as Uint8Array;
			const seiten = (await PDFDocument.load(bytes)).getPageCount();
			return (
				await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i)))
			).join('\n');
		};

		const davor = await mitText('Handweg 43', '2027-11-12');
		await setzeBeschlussvermerk(handelnder(), davor.versammlung, davor.traktandum, true);
		await versiegle(handelnder(), davor.versammlung, '2027-11-12 21:30:00');
		expect(await blattImPaket(davor.versammlung)).toContain(AUSWERTUNG_VON_HAND_ABGESTIMMT);

		const danach = await mitText('Handweg 44', '2027-11-13');
		await versiegle(handelnder(), danach.versammlung, '2027-11-13 21:30:00');
		await setzeBeschlussvermerk(handelnder(), danach.versammlung, danach.traktandum, true);
		expect(await blattImPaket(danach.versammlung)).not.toContain(AUSWERTUNG_VON_HAND_ABGESTIMMT);
		expect(await pdftext(danach.versammlung)).toContain(AUSWERTUNG_VON_HAND_ABGESTIMMT);
	});

	it('nennt vor dem Versiegeln die Abstimmung ohne Ergebnis, und mit dem Vermerk nicht mehr', async () => {
		/*
		 * Block 7c: Die Liste speist den Hinweis auf den Siegelseiten. Sie folgt
		 * der Bedingung, unter der die Protokollseite den Haken anbietet.
		 */
		const s = await mitText('Handweg 45', '2027-11-14');
		const vorher = await holeOhneErgebnisUndVermerk(betreiber, s.versammlung);
		expect(vorher).toContain('Fassadensanierung');
		await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true);
		const nachher = await holeOhneErgebnisUndVermerk(betreiber, s.versammlung);
		expect(nachher).not.toContain('Fassadensanierung');
		expect(nachher).toHaveLength(vorher.length - 1);
		// Die Zahl, die Wand und Präsentation durchreichen. Dass sie dort steht
		// und «ohne Beschluss» um eins sinkt, misst nur der Durchstich.
		expect((await holeAuswertung(betreiber, s.versammlung))!.mitBeschlussvermerk).toBe(1);
	});

	it('Gegenprobe: ohne den Vermerk bleibt es bei «Es wurde nicht abgestimmt.»', async () => {
		const s = await mitText('Handweg 42', '2027-11-11');
		const a = (await holeAuswertung(betreiber, s.versammlung))!;
		const zeile = a.zeilen.find((z) => z.titel === 'Fassadensanierung')!;
		expect(zeile.beschlussvermerk).toBe(false);
		expect(a.mitBeschlussvermerk).toBe(0);
		const text = await pdftext(s.versammlung);
		expect(text).toContain('Es wurde nicht abgestimmt.');
		expect(text).not.toContain(AUSWERTUNG_VON_HAND_ABGESTIMMT);
	});

	/*
	 * **Die Wand zählt aus derselben Auswertung** (Nachzug Block 2b,
	 * 03.10.2026). `/p` und die Präsentationssicht bauten das Abschlussbild je
	 * selbst — die eine Zahl, die der Durchstich an der Wand misst, entstand
	 * dort zweimal. Seit dem Nachzug bauen beide `abschlussbild`.
	 */
	it('das Abschlussbild nennt den Vermerk getrennt und zählt ihn nicht als «ohne Abstimmung»', async () => {
		const s = await mitText('Handweg 46', '2027-11-15');
		await setzeBeschlussvermerk(handelnder(), s.versammlung, s.traktandum, true);
		const a = (await holeAuswertung(betreiber, s.versammlung))!;
		const bild = abschlussbild(a);

		expect(bild.vonHand).toBe(1);
		expect(bild.angenommen).toBe(a.angenommen);
		expect(bild.abgelehnt).toBe(a.abgelehnt);
		// Der Punkt mit Vermerk ist weder angenommen noch abgelehnt noch
		// «ohne Abstimmung» — er steht als Zeile mit «kein Beschluss» da.
		const mitVermerk = bild.zeilen.find((z) => z.titel === 'Fassadensanierung');
		expect(mitVermerk?.angenommen).toBeNull();
		expect(
			bild.zeilen.filter((z) => z.titel === 'Fassadensanierung' && z.angenommen === null)
		).toHaveLength(1);
	});
});

/*
 * **Die Neuabstimmung nach Eintritt der Beschlussfähigkeit**
 * (Produktentscheid 03.10.2026, Migration 139). Der Fall: Die Versammlung ist
 * nicht beschlussfähig, die Leitung hält einen Beschluss von Hand fest, später
 * am selben Abend wird sie beschlussfähig. Je Gemeinschaft umstellbar, Vorgabe
 * «direkt»; der zweite Durchgang läuft über den gewohnten Weg, beide stehen
 * mit Uhrzeit und Präsenz im Protokoll.
 *
 * Die Proben fahren den Weg der Anwendung: `bestaetigeAnwesenheit` bringt die
 * Versammlung auf den Stand, `oeffneAbstimmung` und `schliesseAbstimmung` sind
 * die gewohnten Schritte, das Protokoll kommt aus `stelleEntwurfZusammen`.
 */
describe('Neuabstimmung nach Eintritt der Beschlussfähigkeit', () => {
	/** Hält den Beschluss von Hand bei einem Anwesenden fest (nicht beschlussfähig). */
	async function ohneQuorum(name: string, datum: string, optionen: { stichentscheid?: boolean } = {}) {
		const s = await versammlung(name, datum, { anwesend: 1, ...optionen });
		const { durchgang } = await haltBeschlussVonHandFest(
			handelnder(),
			s.versammlung,
			s.traktandum,
			SUMMEN
		);
		return { ...s, ersterDurchgang: durchgang.id };
	}

	/** Lässt die übrigen Parteien ein und macht die Versammlung so beschlussfähig. */
	async function aufBeschlussfaehig(s: { versammlung: string; parteien: string[] }, wieViele = 4) {
		for (const p of s.parteien.slice(1, wieViele)) {
			await bestaetigeAnwesenheit(handelnder(), s.versammlung, p, 'von_hand');
		}
	}

	it('lässt den zweiten Durchgang ohne Rückkommen zu, ersetzt den früheren und nennt beide mit Uhrzeit und Präsenz', async () => {
		const s = await ohneQuorum('Nachquorum 1', '2027-12-01');
		expect(await holeDirektNachQuorumLage(betreiber, s.versammlung, s.traktandum)).toEqual({
			nummer: 1
		});

		await aufBeschlussfaehig(s, 2);
		const zweiter = await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		expect(zweiter.rueckkommensantragId ?? null).toBeNull();
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const geschlossen = await schliesseAbstimmung(handelnder(), s.versammlung);
		expect(geschlossen.verkuendetAm).not.toBeNull();

		const [erst, neu] = await zeilen(s.traktandum);
		expect(erst).toMatchObject({
			id: s.ersterDurchgang,
			supersede_kind: 'nachquorum',
			superseded_by_round_id: geschlossen.id
		});
		expect(erst.attendance_json?.anwesende).toHaveLength(1);
		expect(neu.id).toBe(geschlossen.id);
		expect(await massgebend(s.traktandum)).toBe(geschlossen.id);

		const text = await protokoll(s.versammlung);
		const abschnitt = abschnittVon(text, 'Fassadensanierung');
		expect(abschnitt).toMatch(
			/Der 1\. Durchgang wurde um \d{2}:\d{2} Uhr ohne Beschlussfähigkeit festgehalten \(ZGB Art\. 712p\)\./
		);
		expect(abschnitt).toMatch(/Die Sitzungsleitung hat den Beschluss festgehalten\./);
		expect(abschnitt).toMatch(
			/Beim Festhalten waren anwesend oder vertreten: 1 von 4 Stockwerkeigentümern, dazu 1 von 4 Kopfstimmen und 225 von 900 Wertquoten\./
		);
		expect(abschnitt).toMatch(
			/Nachdem die Versammlung beschlussfähig geworden war, wurde im 2\. Durchgang um \d{2}:\d{2} Uhr erneut abgestimmt\./
		);
		expect(abschnitt).toMatch(
			/Beim Schluss des Durchgangs waren anwesend oder vertreten: 2 von 4 Stockwerkeigentümern, dazu 2 von 4 Kopfstimmen und 450 von 900 Wertquoten\./
		);
		expect(abschnitt).toMatch(
			/Dieser Beschluss ersetzt den Beschluss aus dem 1\. Durchgang\./
		);
		// Kein Rückkommen; der zweite Durchgang lief über den gewohnten Weg.
		expect(abschnitt).not.toMatch(/Rückkommen/);
	});

	it('weist «konsultativ» nach einem Beschluss von Hand ohne Beschlussfähigkeit ab (H7, Teil B)', async () => {
		/*
		 * **Konsultativ nur, solange kein Beschluss gilt** (Codeprüfung
		 * 14.10.2026, H1). Hier gilt der von Hand festgehaltene, und der direkte
		 * Weg stünde offen. Liesse das Eröffnen «konsultativ» zu, läse der
		 * Schluss den Durchgang als zweiten nach Eintritt der Beschlussfähigkeit,
		 * und das Protokoll behauptete eine Beschlussfähigkeit, die fehlte.
		 */
		const s = await ohneQuorum('Nachquorum konsultativ', '2027-12-07');
		expect(await holeDirektNachQuorumLage(betreiber, s.versammlung, s.traktandum)).toEqual({
			nummer: 1
		});
		expect(
			await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum, { konsultativ: true }))
		).toMatchObject({ kennung: 'konsultativ_beschluss' });
		expect(await zeilen(s.traktandum)).toHaveLength(1);
	});

	it('Gegenprobe: mit der Einstellung «Rückkommen» bleibt der zweite Durchgang gesperrt', async () => {
		const s = await ohneQuorum('Nachquorum 2', '2027-12-02');
		await speichereNeuabstimmung(handelnder(), s.gemeinschaft, 'rueckkommen');
		expect(await holeDirektNachQuorumLage(betreiber, s.versammlung, s.traktandum)).toBeNull();
		await aufBeschlussfaehig(s, 2);
		expect(await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum))).toMatchObject({
			kennung: 'ohne_rueckkommen'
		});
		expect((await zeilen(s.traktandum))[0].supersede_kind).toBeNull();
	});

	it('Gegenprobe: ein von Hand festgehaltener Beschluss mit Beschlussfähigkeit braucht weiter ein Rückkommen', async () => {
		const s = await versammlung('Nachquorum 3', '2027-12-03', { anwesend: 4 });
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, SUMMEN);
		expect(await holeDirektNachQuorumLage(betreiber, s.versammlung, s.traktandum)).toBeNull();
		expect(await absage(oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum))).toMatchObject({
			kennung: 'ohne_rueckkommen'
		});
	});

	it('lässt bei einem zweiten Durchgang ohne Beschluss den früheren in Kraft und nennt das', async () => {
		const s = await ohneQuorum('Nachquorum 4', '2027-12-04', { stichentscheid: true });
		await aufBeschlussfaehig(s, 4);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await erfasseSummen(handelnder(), s.versammlung, { ja: 2, nein: 2, enthaltung: 0 });
		const zweiter = await schliesseAbstimmung(handelnder(), s.versammlung);
		expect(zweiter.verkuendetAm).toBeNull();

		const [erst, neu] = await zeilen(s.traktandum);
		expect(erst).toMatchObject({ id: s.ersterDurchgang });
		expect(erst.supersede_kind).toBeNull();
		expect(neu).toMatchObject({
			id: zweiter.id,
			supersede_kind: 'nachquorum_erfolglos',
			result_published_at: null
		});
		expect(await massgebend(s.traktandum)).toBe(s.ersterDurchgang);
		expect((await holeErgebnis(betreiber, s.versammlung, zweiter.id)).auszaehlung?.stichentscheidOffen).toBe(
			true
		);

		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toMatch(
			/Ein Beschluss kam im 2\. Durchgang nicht zustande; der Beschluss aus dem 1\. Durchgang bleibt in Kraft\./
		);
		expect(abschnitt).not.toMatch(/Rückkommen/);
		expect(
			(await ermittleStand(betreiber, s.versammlung))?.abstimmung?.ergebnis?.nachRueckkommen
		).toBe(
			'Ein Beschluss kam im 2. Durchgang nicht zustande; der Beschluss aus dem 1. Durchgang bleibt in Kraft.'
		);
	});

	it('lässt bei einer Ablehnung im zweiten Durchgang den früheren in Kraft', async () => {
		/*
		 * **Nur die Annahme ersetzt** (Fachprüfung 03.10.2026): Der frühere
		 * Beschluss weicht einem angenommenen zweiten Beschluss mit dem
		 * erforderlichen Mehr (Rz. 202a ad Art. 712g); eine Ablehnung lässt ihn
		 * in Kraft (Rz. 207 ad Art. 712m). Anders als im Rückkommensweg, wo
		 * schon der Rückkommensbeschluss der Widerruf mit dem erforderlichen
		 * Mehr ist.
		 */
		const s = await ohneQuorum('Nachquorum 5', '2027-12-05');
		await aufBeschlussfaehig(s, 2);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'no' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		const zweiter = await schliesseAbstimmung(handelnder(), s.versammlung);
		expect(zweiter.verkuendetAm).not.toBeNull();

		const [erst, neu] = await zeilen(s.traktandum);
		expect(erst).toMatchObject({ id: s.ersterDurchgang, supersede_kind: null });
		expect(neu).toMatchObject({ id: zweiter.id, supersede_kind: 'nachquorum_erfolglos' });
		expect(await massgebend(s.traktandum)).toBe(s.ersterDurchgang);
		expect((await holeErgebnis(betreiber, s.versammlung, zweiter.id)).auszaehlung?.angenommen).toBe(
			false
		);

		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toMatch(
			/Im 2\. Durchgang wurde der Antrag abgelehnt; der Beschluss aus dem 1\. Durchgang bleibt in Kraft\./
		);
		expect(abschnitt).not.toMatch(/Dieser Beschluss ersetzt/);
		// Und die Wand zeigt denselben Satz, damit das alte «Angenommen» nicht
		// wie das eben geschlossene Ergebnis wirkt.
		expect(
			(await ermittleStand(betreiber, s.versammlung))?.abstimmung?.ergebnis?.nachRueckkommen
		).toBe('Im 2. Durchgang wurde der Antrag abgelehnt; der Beschluss aus dem 1. Durchgang bleibt in Kraft.');
	});

	it('spricht bei einer abgelehnten Festhaltung nicht von einem Beschluss', async () => {
		/*
		 * Die Maske lässt auch «Abgelehnt» von Hand zu; dann war nie ein
		 * Beschluss in Kraft, und der Satz darf keinen nennen (Codeprüfung
		 * 03.10.2026, zweiter Durchgang).
		 */
		const s = await versammlung('Nachquorum 6', '2027-12-06', { anwesend: 1 });
		await haltBeschlussVonHandFest(handelnder(), s.versammlung, s.traktandum, {
			...SUMMEN,
			ergebnis: 'abgelehnt'
		});
		await aufBeschlussfaehig(s, 2);
		await oeffneAbstimmung(handelnder(), s.versammlung, s.traktandum);
		await gibStimmenAb(
			handelnder(),
			s.versammlung,
			s.parteien.slice(0, 2).map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(), s.versammlung);

		const abschnitt = abschnittVon(await protokoll(s.versammlung), 'Fassadensanierung');
		expect(abschnitt).toMatch(/Dieser Beschluss ersetzt die Ablehnung aus dem 1\. Durchgang\./);
		expect(abschnitt).not.toMatch(/ersetzt den Beschluss/);
	});
});
