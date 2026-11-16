/**
 * Das Protokoll eines Versammlungstags in der Datenbank — die Verdrahtung.
 *
 * `tests/domain/gemeinsamesprotokoll.test.ts` prüft, wie der Text gesetzt wird.
 * Hier geht es um den Weg dorthin: Was am Durchgang steht, muss über
 * `holeAuswertung` und die Zuordnung nach Traktandennummer bis in die
 * Abendzusammenstellung kommen.
 *
 * **Warum das einen eigenen Test braucht** (28.08.2026). Beim Protokoll des
 * einzelnen Hauses lag genau hier der Fehler, den der Auftraggeber gemeldet hat: Die
 * Auszählung wusste seit je, dass bei einer Handzählung keine Wertquoten
 * erhoben sind, und das Protokoll fragte es nicht ab. Ein Kerntest sah das
 * nicht, weil er die Zeile selbst baut und zurückliest.
 *
 * Für den Abend gab es bis hierher überhaupt keinen Datenbanktest: Die Kette
 * `stelleAbendzusammenstellungZusammen` → `gemeinsamerProtokollentwurf` war
 * ungedeckt. Der schwache Punkt darin ist die Verbindung über die **Nummer**
 * der Einzelversammlung — greift sie nicht, fehlt das Ergebnis still.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import {
	erstelleVersammlung,
	eroeffneVersammlung,
	schliesseVersammlung,
	stelleAufTraktandum
} from '$lib/server/versammlungen';
import { setzeBeschlussvermerk, setzeProtokollnotiz } from '$lib/server/protokoll';
import { erstelleAnwesenheitsregel } from '$lib/server/reglement';
import { erstelleVersammlungstag, holeTafel, nimmInTagAuf } from '$lib/server/versammlungstag';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import { bestaetigeAnwesenheit } from '$lib/server/anwesenheit';
import { erstelleTraktandum, haltErfordernisAmTraktandumFest } from '$lib/server/traktanden';
import {
	erfasseSummen,
	gibStimmenAb,
	haltBeschlussVonHandFest,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { trageBetroffeneEin } from '$lib/server/betroffene';
import { holeRegelwerk } from '$lib/rules';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { protokollluecke } from '$lib/domain/gemeinsamesprotokoll';
import { vermerkePapierabgabe } from '$lib/server/papierabgabe';
import { waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';
import { erfasseRuege } from '$lib/server/ruege';

let betreiber: string;
let benutzer: string;

const handelnder = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüferin' });

const EINFACHES_MEHR: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung-gewoehnlich',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

beforeAll(async () => {
	betreiber = await pruefbetreiber('Tagprotokoll');
	benutzer = await pruefbenutzer(betreiber, 'pruefer-tagprotokoll');
});

afterAll(verbindungenSchliessen);

/**
 * Ein Abend mit einem Haus, drei Eigentümern und einem Sachtraktandum.
 *
 * **Die Betriebsart ist wählbar, seit die Mischform geprüft wird** (10.09.2026).
 * `nimmInTagAuf` setzt sie nicht um; sie bleibt, wie die Versammlung angelegt
 * wurde. Für den Papiervermerk braucht es `gefuehrt`, denn `vermerkePapierabgabe`
 * weist ihn in `einfach` zu Recht ab.
 *
 * **Und die Parteien kommen mit heraus**, mit ihren Namen. Ein Test, der prüft,
 * dass ein Name NICHT in einem Dokument steht, muss ihn aus der Vorrichtung
 * lesen. Ein zweites Mal hingeschriebenes Literal prüft nur sich selbst.
 */
async function abendMitEinemHaus(
	name: string,
	betriebsart: 'einfach' | 'gefuehrt' = 'einfach',
	erfordernis: Erfordernis = EINFACHES_MEHR
) {
	const tag = await erstelleVersammlungstag(handelnder(), {
		bezeichnung: `${name} — Abend`,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art: 'ordentlich'
	});

	const g = await erstelleGemeinschaft(handelnder(), {
		name: `${name} — Haus`,
		quotaDenominator: 999,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});

	const parteien: string[] = [];
	const namen: string[] = [];
	for (let i = 0; i < 3; i++) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 333 },
			countsAsHead: true
		});
		// Einmal gebildet, zweimal gebraucht: Stünde der Name hier und unten
		// getrennt, prüfte die Zusicherung «dieser Name fehlt im Dokument» am Ende
		// ein Literal, das mit dem angelegten Eigentümer nichts mehr zu tun hat.
		const wer = `Eigentümer ${i + 1}`;
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: wer,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
		namen.push(wer);
	}

	const m = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart
	});
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: m.id,
		parentId: null,
		titel: 'Fassadensanierung',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), m.id, t.id, erfordernis);
	await nimmInTagAuf(handelnder(), tag.id, m.id, 0);
	await gibVersammlungFrei(handelnder(), m.id);
	await eroeffneVersammlung(handelnder(), m.id);
	for (const p of parteien) await bestaetigeAnwesenheit(handelnder(), m.id, p, 'von_hand');

	return { tag: tag.id, versammlung: m.id, traktandum: t.id, parteien, namen };
}

/**
 * Der Abschnitt eines Punktes, bis zur nächsten Überschrift.
 *
 * **Über den ganzen Text zu prüfen ginge daneben**: Die Freigabe legt die
 * Standardtraktanden an, und die tragen kein Ergebnis. Ein `not.toContain`
 * über das ganze Dokument wäre deshalb immer rot, ganz gleich, ob die
 * Verdrahtung greift.
 */
function abschnittZu(text: string, titel: string): string {
	const ab = text.slice(text.indexOf(titel));
	const ende = ab.indexOf('\n## ');
	return ende === -1 ? ab : ab.slice(0, ende);
}

async function entwurfDesAbends(tagId: string): Promise<string> {
	const zusammenstellung = await stelleAbendzusammenstellungZusammen(
		betreiber,
		tagId,
		'19. Mai 2026, 21:30',
		'Prüferin'
	);
	expect(zusammenstellung).not.toBeNull();
	return zusammenstellung!.text;
}

describe('Das Ergebnis des Hauses steht im Protokoll des Abends', () => {
	it('trägt die Wertung des Traktandums, nicht bloss seinen Titel', async () => {
		const a = await abendMitEinemHaus('Tagweg 1');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 0, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(), a.versammlung);

		const text = await entwurfDesAbends(a.tag);
		expect(text).toContain('Fassadensanierung');
		const abschnitt = abschnittZu(text, 'Fassadensanierung');
		expect(abschnitt).toContain('Angenommen');
		// Die Zahlen gehören dazu: Das Abenddokument hat keinen Stimmenspiegel,
		// der Satz ist die einzige Stelle mit ihnen (Codeprüfung A3a, H1).
		expect(abschnitt).toMatch(/\d+ Ja/);
		// Ohne die Verbindung über die Nummer stünde hier «noch kein Ergebnis».
		expect(abschnitt).not.toContain('liegt noch kein Ergebnis vor');
	});

	/**
	 * **Die Handzählung erreicht auch dieses Dokument** (28.08.2026).
	 *
	 * Das Protokoll des Abends führt keinen Stimmenspiegel, sondern nur den
	 * Ergebnissatz — die erfundene Null der Einzelfassung gab es hier also nie.
	 * Es fehlte aber ebenso der Hinweis, dass die Zahlen aus gezählten Händen
	 * stammen und niemandem zugeordnet sind. Genau den braucht, wer später
	 * fragt, warum keine Namen dastehen.
	 */
	it('nennt eine Handzählung samt Vermerk der Sitzungsleitung', async () => {
		const a = await abendMitEinemHaus('Tagweg 2');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, {
			ja: 2,
			nein: 1,
			enthaltung: 0,
			vermerk: 'Handerheben, ausgezählt durch zwei Stimmenzähler'
		});
		await schliesseAbstimmung(handelnder(), a.versammlung);

		const abschnitt = abschnittZu(await entwurfDesAbends(a.tag), 'Fassadensanierung');
		expect(abschnitt).toContain('Von Hand gezählt, ohne Zuordnung zu Personen');
		expect(abschnitt).toContain('Handerheben, ausgezählt durch zwei Stimmenzähler');
	});

	it('schweigt über die Zählweise, wo einzeln erfasst wurde', async () => {
		const a = await abendMitEinemHaus('Tagweg 3');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await schliesseAbstimmung(handelnder(), a.versammlung);

		const text = await entwurfDesAbends(a.tag);
		expect(text).not.toContain('Von Hand gezählt');
	});
});

/**
 * Die Zusammenstellung ist `null`, solange der Abend nicht besteht. Ein
 * Ausrufezeichen an jeder Zusicherung verschöbe die Frage nur; hier steht sie
 * einmal, und der Test sagt selbst, was er voraussetzt.
 */
function behaupteVorhanden(
	z: Awaited<ReturnType<typeof stelleAbendzusammenstellungZusammen>>
): asserts z is NonNullable<typeof z> {
	expect(z, 'Der Abend liefert keine Zusammenstellung').not.toBeNull();
}

describe('Die Betroffenen im Protokoll des Abends (Block A3a)', () => {
	it('nennt die fehlende Zustimmung als Zahl und keinen Eigentümernamen', async () => {
		/*
		 * Zwei Dinge über den ganzen Weg (Codeprüfung A3a, B2 und B4): Der
		 * Server füllt die Betroffenen-Zeilen am Abend, ohne Namen. Und der
		 * Ergebnissatz ist der Leinwandsatz ohne Namen: mit den Zahlen, aber
		 * statt der Fehlenden ihre Anzahl.
		 */
		const nutzungsrecht = waehleErfordernis(holeRegelwerk(), 'k-nutzungsrecht-zuteilung').ergebnis!;
		const a = await abendMitEinemHaus('Tagweg 9', 'einfach', nutzungsrecht);
		await trageBetroffeneEin(handelnder(), a.versammlung, a.traktandum, [a.parteien[2]]);
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' as const },
				{ parteiId: a.parteien[1], wahl: 'yes' as const },
				{ parteiId: a.parteien[2], wahl: 'no' as const }
			],
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(), a.versammlung);

		const abschnitt = abschnittZu(await entwurfDesAbends(a.tag), 'Fassadensanierung');
		expect(abschnitt).toContain('Abgelehnt');
		// Der Grund ohne Namen, aus dem Leinwandsatz (Codeprüfung A3a, H1).
		expect(abschnitt).toContain('die Zustimmung einer betroffenen Person fehlt');
		expect(abschnitt).toContain(
			'- Insgesamt fehlt die nach ZGB Art. 712g Abs. 4 nötige Zustimmung bei 1 betroffenen Partei.'
		);
		for (const wer of a.namen) expect(abschnitt).not.toContain(wer);
	});
});

/**
 * Die Mischform im Protokoll des gemeinsamen Abends (Migration 108).
 *
 * **Warum das hier steht und nicht im Kerntest.** `tests/domain` prüft, wie der
 * Text gesetzt wird, und bekommt dafür eine Wertetabelle. Ein Eigentümername
 * kann dort gar nicht ankommen: `Abendteilnahme.aufPapier` ist eine Zahl. Eine
 * Zusicherung «der Name steht nicht im Text» wäre dort leer, weil der Name nie
 * im Eingang lag (10.09.2026, von website-ab gegengelesen).
 *
 * Hier liegt er im Eingang: Die Vorrichtung legt echte Eigentümer an, der
 * Vermerk hängt an einer echten Partei, und die Zusammenstellung geht durch
 * `src/lib/server/gemeinsamesprotokoll.ts` — genau die Schicht, in der die Namen
 * noch geführt werden und erst `.length` sie wegnimmt.
 *
 * **Der Name kommt aus der Vorrichtung**, nicht aus einem zweiten Literal.
 * Sonst prüfte die Zusicherung wieder nur sich selbst.
 */
describe('Die Rüge im Protokoll des Abends (H8, Ä-06)', () => {
	/*
	 * Erfasst wird am Haus, das Dokument des Abends geht an alle beteiligten
	 * Gemeinschaften: Die Rüge steht beim Traktandum dieses Hauses, aber ohne
	 * den Namen, wer gerügt hat (Codeprüfung H8, N4 und N5).
	 */
	it('nennt die Rüge beim Traktandum des Hauses, ohne den Namen', async () => {
		const a = await abendMitEinemHaus('Rüge im Abendprotokoll', 'gefuehrt');
		await erfasseRuege(handelnder(), a.versammlung, a.traktandum, {
			wortlaut: 'Die Offerte lag der Einladung nicht bei',
			wer: a.namen[1],
			uhrzeit: '17:40',
			entscheid: 'Die Abstimmung findet statt'
		});

		const abschnitt = abschnittZu(await entwurfDesAbends(a.tag), 'Fassadensanierung');
		expect(abschnitt).toContain(
			'Rüge im Saal:\n- 17:40 Uhr: Die Offerte lag der Einladung nicht bei. Vorgehen des ' +
				'Vorsitzes: Die Abstimmung findet statt.'
		);
		expect(abschnitt).not.toContain(a.namen[1]);
	});
});

describe('Stimmabgabe auf Papier', () => {
	it('nennt die Mischform je Haus, aber keinen Eigentümernamen', async () => {
		const a = await abendMitEinemHaus('Papier im Abendprotokoll', 'gefuehrt');
		await vermerkePapierabgabe(handelnder(), a.versammlung, a.parteien[0], 'von_hand');

		const z = await stelleAbendzusammenstellungZusammen(
			betreiber,
			a.tag,
			'19. Mai 2026, 21:30',
			'Prüferin'
		);

		behaupteVorhanden(z);
		expect(z.text).toContain('Stimmabgabe auf Papier');
		expect(z.text).toContain('1 von 3 anwesenden Parteien stimmten auf Papier ab.');

		/*
		 * **Der eigentliche Prüfstein.** Diese Zusammenstellung ist EIN Dokument
		 * für alle beteiligten Gemeinschaften und geht an alle ihre Eigentümer.
		 * Stünde der Name darin, erführen die Eigentümer eines fremden Hauses, wer
		 * hier wohnt und wie diese Person abstimmte. Dieselbe Grenze zieht
		 * `docs/verbund.md` beim Abschlusspaket.
		 */
		expect(z.text).not.toContain(a.namen[0]);
	});

	it('schweigt, wo niemand auf Papier abstimmte', async () => {
		const a = await abendMitEinemHaus('Ohne Papier im Abendprotokoll', 'gefuehrt');
		const z = await stelleAbendzusammenstellungZusammen(
			betreiber,
			a.tag,
			'19. Mai 2026, 21:30',
			'Prüferin'
		);
		behaupteVorhanden(z);
		expect(z.text).not.toContain('Stimmabgabe auf Papier');
	});
});

/**
 * Ein Haus am Abend mit drei Eigentümern zu je 333 von 999 und einem
 * Sachtraktandum mit eigenem Titel. `anwesend` steuert, wie viele der drei
 * eingelassen sind (Vorgabe 2); `regel` hinterlegt die Anwesenheitsregel
 * «zwei Drittel, mindestens drei» mit Fundstelle.
 *
 * **Auf Modulebene, seit dem 04.10.2026:** Der Abend-Block am Dateiende
 * braucht dieselbe Vorrichtung (Neuabstimmung nach Eintritt der
 * Beschlussfähigkeit, mit nur einer anwesenden Partei). Vorher stand sie im
 * Block-6-`describe` und war dort eingeschlossen.
 */
async function haus(
	tagId: string,
	name: string,
	stelle: number,
	regel: boolean,
	anwesend = 2
) {
	const g = await erstelleGemeinschaft(handelnder(), {
		name,
		quotaDenominator: 999,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	const parteien: string[] = [];
	for (let i = 0; i < 3; i++) {
		const e = await erstelleEinheit(handelnder(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: 333 },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(handelnder(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: `${name} Partei ${i + 1}`,
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(handelnder(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	if (regel) {
		await erstelleAnwesenheitsregel(handelnder(), g.id, 'erste', {
			kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
			quoten: { zaehler: 2, nenner: 3, art: 'mindestens' },
			mindestens: 3,
			fundstelle: 'Art. 18'
		});
	}
	const m = await erstelleVersammlung(handelnder(), {
		stwegId: g.id,
		datum: '2026-05-19',
		uhrzeit: '17:00',
		ort: 'Halle der Proben',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach'
	});
	const titel = `Fassade ${name}`;
	const t = await erstelleTraktandum(handelnder(), {
		meetingId: m.id,
		parentId: null,
		titel,
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: []
	});
	await haltErfordernisAmTraktandumFest(handelnder(), m.id, t.id, EINFACHES_MEHR);
	await nimmInTagAuf(handelnder(), tagId, m.id, stelle);
	await gibVersammlungFrei(handelnder(), m.id);
	await eroeffneVersammlung(handelnder(), m.id);
	for (const p of parteien.slice(0, anwesend)) {
		await bestaetigeAnwesenheit(handelnder(), m.id, p, 'von_hand');
	}
	return { versammlung: m.id, traktandum: t.id, titel, parteien };
}

const VON_HAND = {
	zahlen: {
		erfassung: 'summen' as const,
		koepfe: { ja: 2, nein: 0, enthaltung: 0 },
		quoten: { ja: 666, nein: 0, enthaltung: 0 }
	}
};

describe('Die fehlende Beschlussfähigkeit im Protokoll des Abends (Block 6)', () => {
	it('trägt den Satz für das Haus, das nicht beschlussfähig war, und nicht für das andere', async () => {
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Tagweg 9, Abend',
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich'
		});
		/*
		 * **Derselbe Anwesenheitsstand, zwei Regeln.** In beiden Häusern sind
		 * zwei von drei Eigentümern mit 666 von 999 Wertquoten da. Nach dem Gesetz
		 * genügt das; das Haus mit der Regel «mindestens drei» ist damit nicht
		 * beschlussfähig. Trüge der Abend die Regel eines Hauses ins andere oder
		 * rechnete er nur nach dem Gesetz, stünde der Satz bei beiden oder bei
		 * keinem.
		 */
		const streng = await haus(tag.id, 'Tagweg 9a', 0, true);
		const gesetzlich = await haus(tag.id, 'Tagweg 9b', 1, false);
		for (const h of [streng, gesetzlich]) {
			await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		}
		await haltBeschlussVonHandFest(handelnder(), streng.versammlung, streng.traktandum, {
			...VON_HAND,
			ergebnis: 'abgelehnt'
		});
		await haltBeschlussVonHandFest(handelnder(), gesetzlich.versammlung, gesetzlich.traktandum, {
			...VON_HAND,
			ergebnis: 'angenommen'
		});

		const text = await entwurfDesAbends(tag.id);
		const beimStrengen = abschnittZu(text, streng.titel);
		expect(beimStrengen).toMatch(/Abgelehnt/);
		// Derselbe Satz wie im Hausprotokoll, mit dem Namen und der Fundstelle
		// dieses Hauses: Das Dokument lesen auch die Eigentümer des anderen.
		expect(beimStrengen).toContain(
			'Die Versammlung von Tagweg 9a war bei diesem Beschluss nicht ' +
				'beschlussfähig (Reglement dieser Gemeinschaft, Art. 18). Der Antrag kann einer ' +
				'beschlussfähigen Versammlung erneut vorgelegt werden. Wer in dieser Gemeinschaft ' +
				'stimmberechtigt ist und mit der Ablehnung nicht einverstanden war, auch wer nicht dabei ' +
				'war, kann sie innert eines Monats beim Gericht anfechten (ZGB Art. 75). Das Gericht hebt die ' +
				'Ablehnung in der Regel nur auf; angenommen ist der Antrag damit nicht.'
		);
		// Die Tatsache, nicht der Weg.
		expect(beimStrengen).not.toMatch(/von Hand festgehalten|übergangen|Notweg|Sperre/);

		const beimGesetzlichen = abschnittZu(text, gesetzlich.titel);
		expect(beimGesetzlichen).toMatch(/Angenommen/);
		expect(beimGesetzlichen).not.toContain('bei diesem Beschluss nicht beschlussfähig');
		expect(beimGesetzlichen).not.toContain('anfechten');
	});

	it('Gegenprobe: Ein gezählter Beschluss trägt den Satz am Abend nie', async () => {
		const a = await abendMitEinemHaus('Tagweg 10');
		await oeffneAbstimmung(handelnder(), a.versammlung, a.traktandum);
		await erfasseSummen(handelnder(), a.versammlung, { ja: 3, nein: 0, enthaltung: 0 });
		await schliesseAbstimmung(handelnder(), a.versammlung);
		expect(abschnittZu(await entwurfDesAbends(a.tag), 'Fassadensanierung')).not.toContain(
			'bei diesem Beschluss nicht beschlussfähig'
		);
	});
});

/** Die Summe, aus der die Ablaufleiste des Abends «ohne Ergebnis» rechnet. */
function offenAufDerTafel(tafel: { offeneTraktanden: number }[]): number {
	return tafel.reduce((n, z) => n + z.offeneTraktanden, 0);
}

describe('Nach dem Schluss am Abend: der Beschluss im Votenfeld (Block 6)', () => {
	it('steht als Absatz da, der Punkt gilt aber weiter als offen und das Dokument als Entwurf', async () => {
		/*
		 * **Gemessen für das Handbuch** (Produktentscheid 02.10.2026: «Handbuch:
		 * ins Textfeld»). Am gemeinsamen Abend ist dieses Dokument das Protokoll.
		 * Ein Beschluss, der nur im Votenfeld steht, ist für Votum kein Ergebnis:
		 * Der Punkt zählt als Lücke, und ein Dokument mit Lücke trägt den Titel
		 * «Entwurf» und keinen Unterschriftsblock.
		 */
		const a = await abendMitEinemHaus('Tagweg 11');
		await schliesseVersammlung(handelnder(), a.versammlung);
		const stand = () =>
			stelleAbendzusammenstellungZusammen(betreiber, a.tag, '19. Mai 2026, 21:30', 'Prüferin');
		const vorher = await stand();
		const eintrag = 'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 0 Nein.';
		await setzeProtokollnotiz(handelnder(), a.versammlung, a.traktandum, eintrag);

		const z = await stand();
		const abschnitt = abschnittZu(z!.text, 'Fassadensanierung');
		expect(abschnitt).toContain(eintrag);
		expect(abschnitt).toContain('Zu diesem Punkt liegt noch kein Ergebnis vor.');
		// Der Eintrag schliesst keine Lücke: gleich viele offene Punkte wie davor
		// (die Vorrichtung trägt auch die Standardtraktanden ohne Ergebnis).
		expect(vorher!.offeneErgebnisse).toBeGreaterThan(0);
		expect(z!.offeneErgebnisse).toBe(vorher!.offeneErgebnisse);
		expect(z!.luecke).toMatch(/Punkte? ohne Ergebnis$/);
		// Tafel und Leiste zählen ohne Vermerk wie bisher, und dasselbe wie das
		// Protokoll des Abends (Block 7b).
		expect(offenAufDerTafel(await holeTafel(betreiber, a.tag))).toBe(z!.offeneErgebnisse);
	});

	it('mit dem Vermerk entfällt die Zeile, und der Punkt zählt nicht mehr als Lücke', async () => {
		/*
		 * **Produktentscheid 02.10.2026, Block 7.** Am gemeinsamen Abend ist
		 * dieses Dokument das Protokoll. Der Text im Votenfeld hält den
		 * Beschluss fest; der Vermerk nimmt den Punkt aus den offenen
		 * Ergebnissen, damit das Dokument nicht dauerhaft Entwurf bleibt.
		 * Die Probe darüber ist die Gegenprobe: ohne Vermerk wie bisher.
		 */
		const a = await abendMitEinemHaus('Tagweg 12');
		await schliesseVersammlung(handelnder(), a.versammlung);
		const stand = () =>
			stelleAbendzusammenstellungZusammen(betreiber, a.tag, '19. Mai 2026, 21:30', 'Prüferin');
		const vorher = await stand();
		const eintrag = 'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 0 Nein.';
		await setzeProtokollnotiz(handelnder(), a.versammlung, a.traktandum, eintrag);
		await setzeBeschlussvermerk(handelnder(), a.versammlung, a.traktandum, true);

		const z = await stand();
		const abschnitt = abschnittZu(z!.text, 'Fassadensanierung');
		expect(abschnitt).toContain(eintrag);
		expect(abschnitt).not.toContain('Zu diesem Punkt liegt noch kein Ergebnis vor.');
		// Genau eine Lücke weniger als ohne den Vermerk.
		expect(z!.offeneErgebnisse).toBe(vorher!.offeneErgebnisse - 1);
	});

	it('Tafel und Leiste zählen das vermerkte Traktandum nicht mehr, wie das Protokoll des Abends', async () => {
		/*
		 * **Produktentscheid 02.10.2026, Block 7b** («ja. Sonst stimm das was die
		 * Leute wahrnehmen und was im Protokoll steht nicht»). Im Browser
		 * gemessen am selben Tag: Protokoll 11 offene Punkte, Leiste und Tafel
		 * 12. Die Leiste rechnet aus der Summe der Tafel
		 * (`tage/[id]/+layout.server.ts`), deshalb misst die Probe diese Summe.
		 */
		const a = await abendMitEinemHaus('Tagweg 13');
		await schliesseVersammlung(handelnder(), a.versammlung);
		const stand = () =>
			stelleAbendzusammenstellungZusammen(betreiber, a.tag, '19. Mai 2026, 21:30', 'Prüferin');
		await setzeProtokollnotiz(
			handelnder(),
			a.versammlung,
			a.traktandum,
			'Beschluss: Die Fassade wird saniert. Angenommen mit 3 Ja zu 0 Nein.'
		);
		const vorher = offenAufDerTafel(await holeTafel(betreiber, a.tag));
		expect(vorher).toBeGreaterThan(0);
		/*
		 * **Die Leiste, nicht nur die Summe** (B4, Punkt f). Die Ablaufleiste
		 * zeigt die Zahl über `protokollluecke`, gefüllt aus derselben Summe
		 * (`routes/tage/[id]/+layout.server.ts`). Die Probe rechnet den Weg
		 * deshalb nach: Summe aus `holeTafel`, dann die Funktion der Leiste —
		 * vorher N, mit dem Vermerk N-1, danach wieder N.
		 */
		const leiste = (summe: number) =>
			protokollluecke({ versammlungen: 1, offeneErgebnisse: summe, nichtGeschlossen: 0 });
		const leisteVorher = leiste(vorher);
		expect(leisteVorher).toBe(`${vorher} Punkte ohne Ergebnis`);

		await setzeBeschlussvermerk(handelnder(), a.versammlung, a.traktandum, true);
		expect(offenAufDerTafel(await holeTafel(betreiber, a.tag))).toBe(vorher - 1);
		expect(offenAufDerTafel(await holeTafel(betreiber, a.tag))).toBe((await stand())!.offeneErgebnisse);
		expect(leiste(vorher - 1)).toBe(`${vorher - 1} Punkte ohne Ergebnis`);

		// Zurückgenommen zählt der Punkt wieder.
		await setzeBeschlussvermerk(handelnder(), a.versammlung, a.traktandum, false);
		expect(offenAufDerTafel(await holeTafel(betreiber, a.tag))).toBe(vorher);
		expect(leiste(offenAufDerTafel(await holeTafel(betreiber, a.tag)))).toBe(leisteVorher);
	});
});

/**
 * Die Neuabstimmung nach Eintritt der Beschlussfähigkeit im Abendprotokoll
 * (Migration 139; Codeprüfung 03.10.2026, zweiter Durchgang).
 *
 * **Der Anlass:** Am gemeinsamen Abend ist dieses Dokument das Protokoll, das
 * Haus führt kein eigenes. Im Hausprotokoll steht der Satz zu den beiden
 * Durchgängen seit Migration 139; hier fehlte er, und der zweite Durchgang
 * blieb im Dokument unsichtbar. Die Probe fährt den ganzen Weg über
 * `stelleAbendzusammenstellungZusammen`.
 */
describe('Die Neuabstimmung nach Eintritt der Beschlussfähigkeit im Abendprotokoll', () => {
	it('nennt beide Durchgänge mit Uhrzeit und Präsenz', async () => {
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Neuabend 1, Abend',
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich'
		});
		// Eine von drei Parteien: nach dem Gesetz nicht beschlussfähig.
		const h = await haus(tag.id, 'Neuabend 1a', 0, false, 1);
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		await haltBeschlussVonHandFest(handelnder(), h.versammlung, h.traktandum, {
			...VON_HAND,
			ergebnis: 'angenommen'
		});

		// Die beiden übrigen treffen ein; die Versammlung ist beschlussfähig.
		for (const p of h.parteien.slice(1)) {
			await bestaetigeAnwesenheit(handelnder(), h.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(), h.versammlung, h.traktandum);
		await gibStimmenAb(
			handelnder(),
			h.versammlung,
			h.parteien.map((parteiId) => ({ parteiId, wahl: 'yes' as const })),
			true,
			'Prüflauf: von der Sitzungsleitung erfasst'
		);
		await schliesseAbstimmung(handelnder(), h.versammlung);

		const abschnitt = abschnittZu(await entwurfDesAbends(tag.id), h.titel);
		expect(abschnitt).toMatch(
			/Der 1\. Durchgang wurde um \d{2}:\d{2} Uhr ohne Beschlussfähigkeit festgehalten \(ZGB Art\. 712p\)\./
		);
		expect(abschnitt).toContain('Die Sitzungsleitung hat den Beschluss festgehalten.');
		expect(abschnitt).toContain(
			'Beim Festhalten waren anwesend oder vertreten: 1 von 3 Stockwerkeigentümern'
		);
		expect(abschnitt).toMatch(
			/Nachdem die Versammlung beschlussfähig geworden war, wurde im 2\. Durchgang um \d{2}:\d{2} Uhr erneut abgestimmt\./
		);
		expect(abschnitt).toContain(
			'Beim Schluss des Durchgangs waren anwesend oder vertreten: 3 von 3 Stockwerkeigentümern'
		);
		expect(abschnitt).toMatch(/Dieser Beschluss ersetzt den Beschluss aus dem 1\. Durchgang\./);
	});

	it('Gegenprobe: ohne zweiten Durchgang steht der Satz nicht', async () => {
		const tag = await erstelleVersammlungstag(handelnder(), {
			bezeichnung: 'Neuabend 2, Abend',
			datum: '2026-05-19',
			uhrzeit: '17:00',
			ort: 'Halle der Proben',
			art: 'ordentlich'
		});
		const h = await haus(tag.id, 'Neuabend 2a', 0, false, 1);
		await stelleAufTraktandum(handelnder(), h.versammlung, h.traktandum);
		await haltBeschlussVonHandFest(handelnder(), h.versammlung, h.traktandum, {
			...VON_HAND,
			ergebnis: 'angenommen'
		});
		await bestaetigeAnwesenheit(handelnder(), h.versammlung, h.parteien[1], 'von_hand');

		const abschnitt = abschnittZu(await entwurfDesAbends(tag.id), h.titel);
		expect(abschnitt).toMatch(/Angenommen/);
		expect(abschnitt).not.toMatch(/Nachdem die Versammlung beschlussfähig geworden war/);
	});
});
