/**
 * Lesart L8 in der Datenhaltung (Migration 184, Einteilung F3b, B4; Lauf 3).
 *
 * Gemessen wird an L8, was `lesart-ausstandsbeschlussfaehigkeit.test.ts` an
 * L7 misst: Vorgabe und Datenbankschranke, Umstellen mit Verlauf, Einfrieren
 * bei der Freigabe, und dazu die zwei Häkchen mit ihren Absagen je Lage (G1,
 * G2, M6, G9) sowie die Wirkung im Saal je Wahl. Dazu die Befunde aus der
 * Prüfung von Lauf 2: der Sicherheitsbefund (nur bestätigte Vollmachten
 * lösen das Ruhen aus), M2 an der Datenbank, das Häkchen beim Einlass durch
 * Dritte mit Verlauf (M3), das Erben des Häkchens in Folgeantrag und
 * Rückkommen (Entscheid 5) und die Handzählung unter «Die Sitzungsleitung
 * entscheidet» (H1). Drei Eigentümer zu 400, 300 und 300 von 1000; Hans Probe
 * (p2) ist nur über die Grosse Verwaltung AG da, die seine Vollmacht hält.
 * Das Traktandum ist ihre Entlastung (`k-decharge`, einfaches Mehr der
 * Anwesenden: mehr als die Hälfte): Erika Beispiel stimmt zu, Kurt Beispiel
 * lehnt ab; die Verwaltung gibt für Hans Probe eine Ja-Stimme ab, wo die
 * Stimmsperre sie annimmt.
 *
 * **Nicht in dieser Sitzung laufen lassen** (Auftrag F4c, Lauf 3): Die
 * abgebende Sitzung fährt ihn mit dem Prüflauf.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, schliesseVersammlung } from '$lib/server/versammlungen';
import { gibVersammlungFrei, holeMomentaufnahme } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	erstelleTraktandum,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis,
	stelleRueckkommensantrag
} from '$lib/server/traktanden';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit, lasseDurchDritteEin } from '$lib/server/anwesenheit';
import { erklaereAusstand, nimmAusstandZurueck } from '$lib/server/ausstand';
import {
	bestaetigeVollmacht,
	erfasseVollmachten,
	holeParteien,
	holeVollmachten,
	kennzeichneVerwaltung,
	vermerkeVorlage
} from '$lib/server/vollmacht';
import { erklaere } from '$lib/server/selbstvollmacht';
import { vertreterkennung } from '$lib/domain/vollmacht';
import {
	brecheAbstimmungAb,
	erfasseSummen,
	gibStimmenAb,
	holeErgebnis,
	holeStimmsperren,
	holeAusstandAmGrundantrag,
	holeDurchgaenge,
	holeTeilentschieden,
	holeVerwaltungsausstand,
	holeVonHandVorschau,
	holeVerwaltungsvollmachtenLage,
	holeZuordnung,
	oeffneAbstimmung,
	schliesseAbstimmung
} from '$lib/server/abstimmung';
import { holeLesarten, holeLesarteneinstellung, speichereLesarten } from '$lib/server/lesarten';
import { uebernimmTraktanden, uebertrageOffeneTraktanden } from '$lib/server/vorlagen';
import {
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL,
	VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG,
	VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN,
	VERWALTUNG_HAKEN_ABSAGE_WAHL,
	VERWALTUNG_KENNZEICHNUNG_GESPERRT
} from '$lib/domain/mehrhinweise';
import { schreibeErfordernisIn, verwaltungsabsageAmWahlknoten } from '$lib/server/erfordernisse';
import {
	gibVerwaltungsangabe,
	holeVerwaltungsangabelage,
	nimmVerwaltungsangabeZurueck
} from '$lib/server/verwaltungsangabe';
import {
	VERWALTUNGSANGABE_ABGESTIMMT,
	VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN,
	VERWALTUNGSANGABE_KEINE,
	VERWALTUNGSANGABE_NICHT_HIER,
	VERWALTUNGSANGABE_OFFEN,
	VERWALTUNGSANGABE_OHNE_ABBERUFUNG,
	VERWALTUNGSANGABE_OHNE_WAHL,
	verwaltungsangabeImSaal
} from '$lib/domain/verwaltungsangabe';
import { waehleErfordernis } from '$lib/domain/entscheidbaum';
import { holeRegelwerk } from '$lib/rules';
import { EREIGNISARTEN } from '$lib/domain/verlauf';
import { imKontext, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: benutzer, label: 'Prüflauf' };
}

beforeAll(async () => {
	betreiber = await pruefbetreiber('Lesart L8');
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

/** Die Begründung, wenn die Sitzungsleitung erfasst (geführte Betriebsart). */
const LEITUNG = 'Prüflauf: von der Sitzungsleitung erfasst';

/** Die Verwaltung, als Vertreterin ohne Partei (Migration 167, Ä-26). */
const VERWALTUNG = 'Grosse Verwaltung AG';

/** Was `versammlung` zurückgibt: die Kennungen für die folgenden Aufrufe. */
interface Versammlungslage {
	gemeinschaft: string;
	versammlung: string;
	traktandum: string;
	parteien: string[];
	/** Dieselben Parteien in der Momentaufnahme, ab `gibFrei`. */
	moment?: string[];
}

/**
 * Eine Versammlung im Entwurf mit vier Eigentümern und der Entlastung der
 * Verwaltung. Das Häkchen am Traktandum trägt sie nur, wenn `haekchen` sagt;
 * das Erfordernis ist die Entlastung (`k-decharge`, einfaches Mehr), an der
 * die Vollmachten nach beiden Wahlen ruhen dürfen. `bestehend` gibt die
 * Gemeinschaft an, etwa für die Übernahme in eine zweite Versammlung.
 */
async function versammlung(
	name: string,
	datum: string,
	haekchen = true,
	bestehend?: string,
	titel = 'Entlastung der Verwaltung'
): Promise<Versammlungslage> {
	const g = bestehend ? { id: bestehend } : await gemeinschaft(name);
	const parteien: string[] = [];
	for (const [nummer, quote] of [400, 300, 300].entries()) {
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
			displayName: ['Erika Beispiel', 'Hans Probe', 'Kurt Beispiel'][nummer],
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
		titel,
		art: 'abstimmung',
		antragswortlaut: 'Die Verwaltung wird entlastet.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: [],
		verwaltungsGeschaeft: haekchen
	});
	await setzeGewaehltesErfordernis(
		handelnder(betreiber),
		{ meetingId: v.id, stwegId: g.id },
		t.id,
		'k-decharge',
		null
	);
	return { gemeinschaft: g.id, versammlung: v.id, traktandum: t.id, parteien };
}

/**
 * Gibt die Versammlung frei und hält die Parteien der Momentaufnahme in
 * `moment` fest: Vollmachten und Einlass verweisen auf `snapshot_party`,
 * Anwesenheit und Stimmen auf die Partei des Bestands (wie `mitVerwaltung` in
 * `ausstand.test.ts`).
 */
async function gibFrei(a: Versammlungslage) {
	await gibVersammlungFrei(handelnder(betreiber), a.versammlung);
	const moment = await holeParteien(betreiber, a.versammlung);
	a.moment = a.parteien.map((id) => moment.find((p) => p.parteiId === id)!.id);
}

/**
 * Die Verwaltung im Saal: Sie hält die Vollmacht von Hans Probe (p2), mit dem
 * Häkchen an der Vollmacht, und lässt ihn damit eintreten; die übrigen zwei
 * sind selbst da. `ohneHäkchenAnDerVollmacht` erfasst dieselbe Vollmacht ohne
 * das Merkmal, für die Gegenfälle.
 */
async function verwaltungDa(a: Versammlungslage, ohneHäkchenAnDerVollmacht = false) {
	await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [a.moment![1]],
		istVerwaltung: !ohneHäkchenAnDerVollmacht
	});
	await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [a.moment![1]],
		nachweisVorgelegt: true
	});
	for (const p of [a.parteien[0], a.parteien[2]]) {
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
	}
}

/** Die Stimmen: Erika stimmt zu, Kurt lehnt ab; die Verwaltung gibt für Hans Probe eine Ja-Stimme ab. */
function entlastungsStimmen(a: Versammlungslage, mitVerwaltungsStimme: boolean) {
	const abgaben = [
		{ parteiId: a.parteien[0], wahl: 'yes' as const },
		...(mitVerwaltungsStimme ? [{ parteiId: a.parteien[1], wahl: 'yes' as const }] : []),
		{ parteiId: a.parteien[2], wahl: 'no' as const }
	];
	return abgaben;
}

describe('Vorgabe und Umstellen (Kriterien 1 und 2)', () => {
	it('rechnet ohne Eingriff nach der Vorgabe; die Datenbank weist eine unbekannte Wahl ab', async () => {
		const g = await gemeinschaft('L8 neu');
		expect((await holeLesarteneinstellung(betreiber, g.id)).wahl.L8).toBe('ruhen');
		await expect(
			imKontext(betreiber, (tx) => tx`UPDATE stweg SET reading_l8 = 'immer' WHERE id = ${g.id}`)
		).rejects.toThrow(/stweg_lesart_l8/);
	});

	it('weist das Häkchen an der Vollmacht bei einer Partei dieser Versammlung ab', async () => {
		const a = await versammlung('L8 Vollmachtsschranke', '2028-01-01');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// Eine Vollmacht von Partei zu Partei, dann das Häkchen von Hand dazu:
		// Die Schranke der Datenbank weist beides zugleich ab.
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtId: a.moment![2],
			vertritt: [a.moment![0]]
		});
		await expect(
			imKontext(betreiber, (tx) => tx`
				UPDATE proxy SET holder_is_management = true
				WHERE meeting_id = ${a.versammlung} AND holder_id IS NOT NULL
			`)
		).rejects.toThrow(/proxy_verwaltung_nur_dritte/);
	});

	it('hält die Umstellung im Verlauf fest, mit Frage und Werten in Worten', async () => {
		const g = await gemeinschaft('L8 Verlauf');
		await speichereLesarten(handelnder(betreiber), 'admin', g.id, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		expect(await holeLesarten(betreiber, { stwegId: g.id })).toMatchObject({ L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'stweg' AND subject_id = ${g.id} AND event_type = ${EREIGNISARTEN.lesartGesetzt}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			lesart: 'L8',
			vorher: 'Vollmachten ruhen (Vorgabe)',
			nachher: 'Die Sitzungsleitung entscheidet',
			rolle: 'admin'
		});
		expect(String(eintraege[0].detail.frage)).toMatch(/Ruhen die Vollmachten der Verwaltung/);
	});
});

describe('Das Einfrieren bei der Freigabe (Kriterium 3)', () => {
	it('friert die Wahl ein; eine Umstellung danach wirkt nicht für diese Versammlung', async () => {
		const a = await versammlung('L8 einfrieren', '2028-02-01');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'ruhen', L9: 'alle', L10: 'bleiben', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });

		expect((await holeMomentaufnahme(betreiber, a.versammlung))?.lesarten?.L8).toBe('leitung');
		expect((await holeLesarten(betreiber, { meetingId: a.versammlung })).L8).toBe('leitung');
		expect((await holeLesarten(betreiber, { stwegId: a.gemeinschaft })).L8).toBe('ruhen');
	});
});

describe('Unter der Vorgabe «Vollmachten ruhen» (Kriterium 6)', () => {
	it('weist die Stimme ab, die die Verwaltung mit der Vollmacht abgibt, und zählt sie nicht', async () => {
		const a = await versammlung('L8 ruhen', '2028-03-01');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);

		// Die Stimmsperre wie bei einem erklärten Vertreterausstand: Die
		// Vollmacht ruht, ohne dass jemand den Ausstand erklärt hat.
		const fehler = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'yes' }],
			true,
			LEITUNG
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });
		expect(String(fehler.message)).toMatch(/«Hans Probe» ist über «Grosse Verwaltung AG» vertreten/);
		expect(String(fehler.message)).toMatch(/ist bei diesem Traktandum im Ausstand/);

		// Ohne die Verwaltungsstimme fehlt das Mehr: 1 Ja von 2, nötig 2.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(false);
		expect(auszaehlung?.koepfe.ja).toBe(1);

		// Das zweite Ergebnis nennt die Grenzen (Entscheid 2, 06.11.2026):
		// Alle Ja hätte den Beschluss gedreht (2 Ja von 3), alle Nein nicht
		// (1 Ja von 3). Die Grenzen tragen das Ergebnis nicht beide, also
		// ist es nicht bestimmbar; die Zahl der ruhenden Vollmachten steht
		// dazu.
		expect(auszaehlung?.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			wahl: 'Die Sitzungsleitung entscheidet',
			ruhendeVollmachten: 1,
			feststellbar: false,
			angenommen: null,
			abweichend: false
		});
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		// Das Protokoll trägt kein zweites Ergebnis, nur die Tatsache mit der
		// Zahl der Vertretenen (Entscheid 3, 06.11.2026).
		expect(text).toContain(
			'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung. ' +
				'Für eine vertretene Partei (Hans Probe) zählte deshalb keine Stimme.'
		);
		expect(text).not.toContain('Nach der anderen Lesart («Die Sitzungsleitung entscheidet»)');
	});

	it('nimmt die Stimme an, wenn das Traktandum kein Häkchen trägt', async () => {
		const a = await versammlung('L8 ruhen, ohne Häkchen am Traktandum', '2028-03-02', false);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.koepfe.ja).toBe(2);
		// Ohne Häkchen am Traktandum rechnen beide Wahlen dasselbe; es gibt
		// kein zweites Ergebnis.
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
	});

	it('nimmt die Stimme an, wenn die Vollmacht das Häkchen nicht trägt', async () => {
		const a = await versammlung('L8 ruhen, ohne Häkchen an der Vollmacht', '2028-03-03');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a, true);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
	});
});

describe('Unter «Die Sitzungsleitung entscheidet» (Kriterium 7)', () => {
	it('zählt die Stimme ohne erklärten Ausstand und nennt das Ergebnis nach der Vorgabe dazu', async () => {
		const a = await versammlung('L8 leitung', '2028-04-01');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.koepfe.ja).toBe(2);

		// Das zweite Ergebnis rechnet mit dem Ausstand aus L8: Die Stimme der
		// Verwaltung zählt dort nicht, und der Antrag wäre abgelehnt.
		expect(auszaehlung?.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			wahl: 'Vollmachten ruhen',
			angenommen: false,
			abweichend: true
		});
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Nach der anderen Lesart («Vollmachten ruhen»: das Ruhen der Vollmachten der Verwaltung), einer Auslegung, die ebenfalls in Frage kommt, wäre der Antrag abgelehnt gewesen'
		);
	});

	it('nimmt die Stimme nicht an, wenn die Leitung den Ausstand der Verwaltung erklärt hat', async () => {
		const a = await versammlung('L8 leitung, erklärt', '2028-04-02');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			vertreterkennung(VERWALTUNG),
			'Es geht um ihre eigene Entschädigung.'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const fehler = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'yes' }],
			true,
			LEITUNG
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });

		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(false);
		// Der erklärte Ausstand wirkt nach beiden Wahlen gleich; es gibt kein
		// zweites Ergebnis zu rechnen.
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
	});
});

describe('Das Häkchen am Traktandum (Kriterium 8, G1, G2, M6)', () => {
	it('weist das Häkchen am Wahlknoten ab, in beiden Richtungen, je Knoten mit eigenem Satz (G1)', async () => {
		const a = await versammlung('L8 Absage', '2028-05-01', false);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		// Richtung 1: Das Erfordernis steht auf der Wahl, das Häkchen käme dazu.
		const fehler = await bearbeiteTraktandum(handelnder(betreiber), a.versammlung, a.traktandum, {
			meetingId: a.versammlung,
			titel: 'Bewirtschaftung wählen',
			art: 'abstimmung',
			antragswortlaut: 'Die Bewirtschaftung wird gewählt.',
			antragstellerart: 'bewirtschaftung',
			betroffeneParteiIds: [],
			verwaltungsGeschaeft: true
		}).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'verwaltungsgeschaeft_am_wahlknoten' });
		expect(String(fehler.message)).toBe(
			'Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht (BGE 134 III 481 E. 3.5). ' +
				'Geht es auch um ihre Entschädigung, stimmen Sie diese in einem eigenen Traktandum ab und setzen ' +
				'Sie das Häkchen nur dort.'
		);

		// Richtung 2: Das Häkchen steht, das Erfordernis käme auf die
		// Abberufung; die Absage nennt deren eigenen Satz.
		const b = await versammlung('L8 Absage, Gegenrichtung', '2028-05-02');
		const fehler2 = await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: b.versammlung, stwegId: b.gemeinschaft },
			b.traktandum,
			'k-bewirtschaftung-abberufen',
			'k-decharge'
		).catch((f) => f);
		expect(fehler2).toMatchObject({ kennung: 'verwaltungsgeschaeft_am_wahlknoten' });
		expect(String(fehler2.message)).toBe(
			'Bei der Abberufung der Verwaltung ist nicht geklärt, ob ihre Vollmachten ruhen, und das Häkchen ' +
				'gilt dort nicht. Bitten Sie die Vertretenen schon mit der Einladung, selbst zu kommen oder eine ' +
				'andere Person zu bevollmächtigen, und schlagen Sie einen Vorsitz für dieses Traktandum vor. Am ' +
				'Abend erklären Sie den Ausstand der Verwaltung, wenn sie den Raum verlässt; mehr dazu im Handbuch ' +
				'unter «Bei der Abberufung der Verwaltung».'
		);
	});

	it('nimmt das Häkchen und das Erfordernis aus einem Formular nicht beide an (G2)', async () => {
		// Das Formular trägt das Häkchen und das neue Erfordernis auf die
		// Wahl; geprüft wird gegen das Erfordernis, das nach dem Speichern
		// gälte, in derselben Transaktion. Bei der Absage bleibt das Häkchen
		// ungespeichert.
		const a = await versammlung('L8 Absage, ein Formular', '2028-05-06', false);
		await expect(
			bearbeiteTraktandum(
				handelnder(betreiber),
				a.versammlung,
				a.traktandum,
				{
					meetingId: a.versammlung,
					titel: 'Bewirtschaftung wählen',
					art: 'abstimmung',
					antragswortlaut: 'Die Bewirtschaftung wird gewählt.',
					antragstellerart: 'bewirtschaftung',
					betroffeneParteiIds: [],
					verwaltungsGeschaeft: true
				},
				'k-bewirtschaftung-waehlen'
			)
		).rejects.toThrow(/Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht/);
		const liste = await holeTraktanden(betreiber, a.versammlung);
		expect(liste.find((x) => x.knoten.id === a.traktandum)?.knoten.verwaltungsGeschaeft).toBe(false);
	});

	it('sagt nach der Freigabe den eigenen Satz an der Abberufung (G1, Entscheid 8)', async () => {
		// Seit Entscheid 8 (Lauf 4) nimmt die Maske nach der Freigabe Wahl
		// und Wiederwahl trotz Häkchen an (der eigene Test unten); abgesagt
		// bleibt die Abberufung, mit dem Satz, der nur noch sie meint.
		const a = await versammlung('L8 Absage, freigegeben', '2028-05-07');
		await gibFrei(a);
		const fehler = await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-abberufen',
			'k-decharge'
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'verwaltungsgeschaeft_am_wahlknoten' });
		// Entscheid 0045, Punkt 9: am Grundantrag weiter abgesagt, mit dem
		// Folgeantrag als Weg.
		expect(String(fehler.message)).toBe(VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN);
	});

	it('greift auch über die gemeinsame Schreibstelle des Erfordernisses (M6)', async () => {
		// Derselbe Weg, den das gemeinsame Geschäft am Abend nimmt
		// (`geschaeft.ts`): `schreibeErfordernisIn` mit dem Erfordernis der
		// Wahl, am Traktandum mit Häkchen.
		const a = await versammlung('L8 Absage, gemeinsames Geschäft', '2028-05-08');
		const gewaehlt = waehleErfordernis(holeRegelwerk(), 'k-bewirtschaftung-waehlen').ergebnis;
		await expect(
			imKontext(betreiber, (tx) => schreibeErfordernisIn(tx, handelnder(betreiber), a.traktandum, gewaehlt))
		).rejects.toThrow(/Bei Wahl und Wiederwahl der Verwaltung ruhen ihre Vollmachten nicht/);
	});

	it('nimmt das Kopieren das Häkchen mit', async () => {
		const alt = await versammlung('L8 Vorlage', '2028-05-04');
		const neu = await versammlung('L8 Übernahme', '2028-05-05', false, alt.gemeinschaft, 'Eigenes Geschäft');
		expect(await uebernimmTraktanden(handelnder(betreiber), neu.versammlung, [alt.traktandum])).toBe(1);

		const liste = await holeTraktanden(betreiber, neu.versammlung);
		const uebernommen = liste.find((x) => x.knoten.titel === 'Entlastung der Verwaltung');
		expect(uebernommen?.knoten.verwaltungsGeschaeft).toBe(true);
	});

	it('nimmt das Häkchen nach der Freigabe nicht mehr an (G9, Entscheid 7)', async () => {
		// Nur freigegeben, noch nicht eröffnet: Die Sperre am Häkchen hängt
		// an der Freigabe, nicht an der Eröffnung. Ginge sie erst mit der
		// Eröffnung zu, liesse sich die Einladung, die sich nach der
		// Kennzeichnung richtet, nachträglich ändern.
		const a = await versammlung('L8 nach der Freigabe', '2028-05-03', false);
		await gibFrei(a);
		await expect(
			bearbeiteTraktandum(handelnder(betreiber), a.versammlung, a.traktandum, {
				meetingId: a.versammlung,
				titel: 'Entlastung der Verwaltung',
				art: 'abstimmung',
				antragswortlaut: 'Die Verwaltung wird entlastet.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: [],
				verwaltungsGeschaeft: true
			})
		).rejects.toThrow(/in den Traktanden ändern/);
	});
});

describe('Der Sicherheitsbefund (Kriterium 8)', () => {
	it('löst eine erfasste Vollmacht mit Häkchen kein Ruhen aus, eine bestätigte schon', async () => {
		// Der Ausstand aus L8 zählt nur bestätigte Vollmachten: Eine erfasste
		// über `/z/` kann jeder Eigentümer mit Zugangscode allein erteilen,
		// und weil der Ausstand je Name gilt, ruhten sonst an jedem
		// Traktandum mit Häkchen alle Vollmachten dieser Person.
		const a = await versammlung('L8 erfasste Vollmacht', '2028-06-01');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		expect(vollmacht.zustand).toBe('erfasst');
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);

		await vermerkeVorlage(handelnder(betreiber), a.versammlung, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, vollmacht.id);
		const ausstand = await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum);
		expect(ausstand).toHaveLength(1);
		expect(ausstand[0].id).toBe(`l8:${vertreterkennung(VERWALTUNG)}`);
		expect(ausstand[0].name).toBe('Grosse Verwaltung AG (nach der Einstellung Ihrer Gemeinschaft)');
	});
});

describe('M2 an der Datenbank: die vertretene Partei selbst da', () => {
	it('rechnet kein zweites Ergebnis und trägt keine Tatsachenzeile, wenn die Partei selbst da ist', async () => {
		const a = await versammlung('L8 selbst da', '2028-06-02');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// Die Vollmacht ist bestätigt und trägt das Häkchen, aber Hans Probe
		// ist selbst da: Seine Anwesenheit beruht nicht auf ihr, und ohne
		// wirksame Vertretung ruht nichts.
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, vollmacht.id);
		for (const p of a.parteien) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		// Kein Satz an die Leitung: Die Vollmacht ist nicht wirksam.
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum)).toBeNull();

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'abstain' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			true,
			LEITUNG
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).not.toContain('Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft');
	});

	it('rechnet kein zweites Ergebnis und nennt keinen Satz, wenn die Verwaltung nicht da ist', async () => {
		// Die Vollmacht ist bestätigt und trägt das Häkchen, aber die
		// Verwaltung ist nicht eingelassen: Sie vertritt niemanden, und erst der
		// Filter gegen die wirksamen Vertretungen (M2) hält Satz und zweites
		// Ergebnis zurück. Der Fall «selbst da» oben endet schon vorher.
		const a = await versammlung('L8 Verwaltung abwesend', '2028-06-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, vollmacht.id);
		for (const p of [a.parteien[0], a.parteien[2]]) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		expect((await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).length).toBe(1);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum)).toBeNull();

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			true,
			LEITUNG
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).not.toContain('Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft');
	});
});

describe('M3: das Häkchen beim Einlass durch Dritte', () => {
	it('trägt das Häkchen der Vollmacht im Verlauf, wenn die Verwaltung die Dritte ist', async () => {
		const a = await versammlung('L8 Einlass', '2028-06-03');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true,
			istVerwaltung: true
		});
		const vollmachten = await holeVollmachten(betreiber, a.versammlung);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'proxy' AND subject_id = ${vollmachten[0].id}
				   AND event_type = ${EREIGNISARTEN.vollmachtErfasst}
			`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({ verwaltung: true });
	});
});

describe('Entscheid 5: Folgeantrag und Rückkommen erben das Häkchen (M4)', () => {
	it('nimmt das Häkchen vom Grundantrag in den Folgeantrag mit', async () => {
		const a = await versammlung('L8 Folgeantrag', '2028-06-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const aufgenommen = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Entlastung nur für das letzte Jahr',
				art: 'abstimmung',
				antragswortlaut: 'Die Verwaltung wird nur für das letzte Jahr entlastet.',
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		expect(aufgenommen.verwaltungsGeschaeft).toBe(true);
	});

	it('nimmt das Häkchen vom Ziel in den Rückkommensantrag mit', async () => {
		const a = await versammlung('L8 Rückkommen', '2028-06-05');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);

		const rueckkommen = await stelleRueckkommensantrag(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum
		);
		expect(rueckkommen.verwaltungsGeschaeft).toBe(true);
	});
});

describe('H1: die Handzählung unter «Die Sitzungsleitung entscheidet»', () => {
	it('sagt, dass sich das zweite Ergebnis aus den Summen nicht bestimmen lässt, und schliesst den Durchgang', async () => {
		const a = await versammlung('L8 Summen', '2028-07-01');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		// Von Hand gezählt: 2 Ja, 1 Nein; die Ja-Stimme der Verwaltung für
		// Hans Probe ist mitgezählt, ohne dass die Dreizahl sagt, wessen Hand
		// es war. Früher warf die zweite Rechnung `summe_zu_hoch` und liess
		// den Durchgang nicht schliessen.
		await erfasseSummen(handelnder(betreiber), a.versammlung, { ja: 2, nein: 1, enthaltung: 0 });
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			feststellbar: false,
			nichtFeststellbarWeil: 'verwaltung_summen',
			angenommen: null,
			abweichend: false
		});
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Nach der anderen Lesart («Vollmachten ruhen») lässt sich das Ergebnis nicht bestimmen: ' +
				'Gezählt wurden nur die Summen, und darin ist nicht getrennt, wie die Verwaltung mit ihren ' +
				'Vollmachten gestimmt hat.'
		);
	});
});

describe('Lauf 4: das Häkchen an der bestehenden Vollmacht (H-1)', () => {
	it('setzt und entfernt die Kennzeichnung an der bestätigten Vollmacht, mit Verlauf in beide Richtungen', async () => {
		const a = await versammlung('L8 kennzeichnen', '2028-08-03');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, vollmacht.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, vollmacht.id);
		expect((await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).length).toBe(1);

		// Die Leitung entfernt das Häkchen; der Ausstand aus L8 verschwindet.
		const ohne = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, vollmacht.id, false);
		expect(ohne.istVerwaltung).toBe(false);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);

		// Und setzt es wieder; der Verlauf trägt beide Richtungen.
		const mit = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, vollmacht.id, true);
		expect(mit.istVerwaltung).toBe(true);
		expect((await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).length).toBe(1);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'proxy' AND subject_id = ${vollmacht.id}
				   AND event_type = ${EREIGNISARTEN.vollmachtVerwaltungGesetzt}
				 ORDER BY id
				`
		);
		expect(eintraege).toHaveLength(2);
		expect(eintraege[0].detail).toMatchObject({ verwaltung: false });
		expect(eintraege[1].detail).toMatchObject({ verwaltung: true });
	});

	it('übernimmt der Einlass durch Dritte das Häkchen an einer schon erfassten Zeile ohne Häkchen', async () => {
		const a = await versammlung('L8 Einlass an erfasster Zeile', '2028-08-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		expect(vollmacht.istVerwaltung).toBe(false);
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true,
			istVerwaltung: true
		});
		const [nachher] = await holeVollmachten(betreiber, a.versammlung);
		expect(nachher.istVerwaltung).toBe(true);
		expect((await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).length).toBe(1);
	});
});

describe('Lauf 4: Entscheid 8, die Wiederwahl nach der Freigabe', () => {
	it('nimmt die Wiederwahl trotz Häkchen an; die Stimme zählt, und die Protokollzeile sagt es', async () => {
		const a = await versammlung('L8 Wiederwahl', '2028-08-05');
		await gibFrei(a);
		// Nach der Freigabe nimmt die Maske die Wiederwahl trotz Häkchen an
		// (Entscheid 8); die Absage gilt seit Lauf 4 nur noch der Abberufung.
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		// An den Wahlknoten liefert die Lesung keine Kennungen für die
		// Ausstandsliste, sondern trägt sie im Merkmal für den Satz.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum)).toEqual({
			wahl: 'ruhen',
			wahlTrotzHaekchen: true,
			ausstandErklaert: false,
			abberufungTrotzHaekchen: false,
			amFolgeantrag: false
		});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		// Die Stimmsperre nimmt die Stimme der Verwaltung an, obwohl das
		// Traktandum das Häkchen trägt: 2 Ja von 3, angenommen.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.koepfe.ja).toBe(2);
		// Ohne Merkmal aus L8 gibt es kein zweites Ergebnis.
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Bei diesem Traktandum ging es um die Wahl der Verwaltung; anders als die Einladung angekündigt ' +
				'hatte, ruhten ihre Vollmachten hier nicht.'
		);
	});

	it('erbt der Folgeantrag das Häkchen und lässt die Vollmacht wieder ruhen', async () => {
		const a = await versammlung('L8 Wiederwahl, Folgeantrag', '2028-08-06');
		await gibFrei(a);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const folge = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel: 'Entschädigung der gewählten Verwaltung',
				art: 'abstimmung',
				antragswortlaut: 'Die Entschädigung wird festgesetzt.',
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		expect(folge.verwaltungsGeschaeft).toBe(true);
		// Der Folgeantrag ist kein Wahlknoten: Das geerbte Häkchen lässt die
		// Vollmacht ruhen, wie an jedem anderen Traktandum mit Häkchen.
		const ausstand = await holeVerwaltungsausstand(betreiber, a.versammlung, folge.id);
		expect(ausstand).toHaveLength(1);
		expect(ausstand[0].id).toBe(`l8:${vertreterkennung(VERWALTUNG)}`);
	});
});

describe('Lauf 4: Anlegen, Zurücknehmen, Entdoppeln, Zuordnung (M-3, G-2, M-1)', () => {
	it('weist das Häkchen mit dem Erfordernis aus einem Formular beim Anlegen ab; kein Traktandum entsteht (M-3)', async () => {
		const a = await versammlung('L8 Anlegen mit Wahl', '2028-08-07');
		const vorher = (await holeTraktanden(betreiber, a.versammlung)).length;
		await expect(
			erstelleTraktandum(
				handelnder(betreiber),
				{
					meetingId: a.versammlung,
					parentId: null,
					titel: 'Bewirtschaftung wählen',
					art: 'abstimmung',
					antragswortlaut: 'Die Bewirtschaftung wird gewählt.',
					antragstellerart: 'bewirtschaftung',
					betroffeneParteiIds: [],
					verwaltungsGeschaeft: true
				},
				'k-bewirtschaftung-waehlen'
			)
		).rejects.toMatchObject({ kennung: 'verwaltungsgeschaeft_am_wahlknoten' });
		expect((await holeTraktanden(betreiber, a.versammlung)).length).toBe(vorher);
	});

	it('weist das Zurücknehmen eines Ausstands aus L8 mit dem eigenen Satz ab', async () => {
		const a = await versammlung('L8 Zurücknehmen', '2028-08-08');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const [eintrag] = await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum);
		expect(eintrag.id).toBe(`l8:${vertreterkennung(VERWALTUNG)}`);
		await expect(
			nimmAusstandZurueck(handelnder(betreiber), a.versammlung, eintrag.id)
		).rejects.toMatchObject({ kennung: 'ausstand_aus_einstellung' });
	});

	it('entdoppelt den Ausstand nach dem normalisierten Schlüssel, nicht nach dem Namen (G-2)', async () => {
		const a = await versammlung('L8 zwei Schreibweisen', '2028-08-09');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// Zwei bestätigte Vollmachten auf dieselbe Verwaltung, verschieden
		// geschrieben und für verschiedene Parteien: Der normalisierte
		// Schlüssel ist derselbe, die Ausstandsliste nennt sie einmal.
		const [erste] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'Grosse Verwaltung AG',
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, erste.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, erste.id);
		const [zweite] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, zweite.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, zweite.id);
		const ausstand = await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum);
		expect(ausstand).toHaveLength(1);
		expect(ausstand[0].name).toBe('Grosse Verwaltung AG (nach der Einstellung Ihrer Gemeinschaft)');
	});

	it('nennt die Zuordnung die Verwaltung im Ausstand, und der Verlauf bestätigt sie (M-1)', async () => {
		const a = await versammlung('L8 Zuordnung', '2028-08-10');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		// Mit dem Erfordernis, wie die Seite es geladen hat (Muster `freigabezuordnung.test.ts`).
		const erfordernis =
			(await holeTraktanden(betreiber, a.versammlung)).find((t) => t.knoten.id === a.traktandum)?.knoten
				.erfordernis ?? null;
		const z = await holeZuordnung(betreiber, a.versammlung, a.traktandum, erfordernis);
		expect(z.imAusstand).toEqual(['Grosse Verwaltung AG']);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum, { zuordnung: z.marke });
		const [eintrag] = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_id = ${a.versammlung} AND event_type = 'vote.round.opened'
				`
		);
		expect(eintrag.detail.zuordnungBestaetigt).toMatchObject({ imAusstand: ['Grosse Verwaltung AG'] });
	});
});

describe('Lauf 5, H-1: die Kennzeichnung ruht, solange an einem Traktandum mit Häkchen abgestimmt wird', () => {
	it('weist das Entfernen ab und nimmt es nach dem Schliessen wieder an', async () => {
		const a = await versammlung('L8 Sperre, entfernen', '2028-09-01');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [vollmacht] = await holeVollmachten(betreiber, a.versammlung);
		const fehler = await kennzeichneVerwaltung(
			handelnder(betreiber),
			a.versammlung,
			vollmacht.id,
			false
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'durchgang_offen' });
		expect(String(fehler.message)).toBe(VERWALTUNG_KENNZEICHNUNG_GESPERRT);

		// Nach dem Schliessen geht es wieder; die Sperre hängt am offenen
		// Durchgang, nicht am Traktandum.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const ohne = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, vollmacht.id, false);
		expect(ohne.istVerwaltung).toBe(false);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);
	});

	it('weist das Setzen ab, mit dem Satz aus dem Auftrag', async () => {
		const a = await versammlung('L8 Sperre, setzen', '2028-09-02');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a, true);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [vollmacht] = await holeVollmachten(betreiber, a.versammlung);
		await expect(
			kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, vollmacht.id, true)
		).rejects.toMatchObject({ kennung: 'durchgang_offen' });
	});

	it('lässt die Kennzeichnung zu, solange nur an einem Traktandum ohne Häkchen abgestimmt wird', async () => {
		// Der Gegenfall: Die Sperre gilt nur, wo das Häkchen steht, denn nur
		// dort liest die Zählung den Ausstand aus L8.
		const a = await versammlung('L8 Sperre, Gegenfall', '2028-09-03', false);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a, true);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const [vollmacht] = await holeVollmachten(betreiber, a.versammlung);
		const mit = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, vollmacht.id, true);
		expect(mit.istVerwaltung).toBe(true);
	});

	it('lässt eine Verwaltung, deren Name noch keine bestätigte Vollmacht hat, während der Abstimmung mit dem Häkchen ein', async () => {
		// Codeprüfung Lauf 5, B2: Eine erfasste Vollmacht trägt noch keine
		// Stimme; ihre Kennzeichnung dreht kein Ergebnis, die Sperre greift
		// deshalb nicht, und die Person steht nicht vor der Tür.
		const a = await versammlung('L8 Sperre, Einlass neu', '2028-09-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		// Erika und Kurt sind selbst da, sonst ist die Versammlung nicht
		// beschlussfähig und der Durchgang geht nicht auf.
		for (const p of [a.parteien[0], a.parteien[2]]) {
			await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, p, 'von_hand');
		}
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true,
			istVerwaltung: true
		});
		const [nachher] = await holeVollmachten(betreiber, a.versammlung);
		expect(nachher.istVerwaltung).toBe(true);
		expect(nachher.zustand).toBe('bestaetigt');
	});

	it('weist den Einlass ab, wenn er eine schon bestätigte Vollmacht desselben Namens änderte, und lässt ihn ohne Häkchen durch', async () => {
		// H-1 mit B3: Die Verwaltung ist ohne Häkchen für Hans Probe da; ein
		// Ja, das sie an der offenen Abstimmung abgibt, zählt. Käme jetzt eine
		// Vollmacht für Kurt mit Häkchen auf denselben Namen dazu, ruhte der
		// Name, und das Ja fiele beim Schliessen still weg.
		const a = await versammlung('L8 Sperre, Einlass Schwester', '2028-09-24');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		const fehler = await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			nachweisVorgelegt: true,
			istVerwaltung: true
		}).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'durchgang_offen' });
		expect(String(fehler.message)).toBe(VERWALTUNG_KENNZEICHNUNG_GESPERRT);
		// Ohne das Häkchen kommt die Vollmacht für Kurt durch und zählt wie
		// die bestätigte Schwester; nichts trägt das Häkchen.
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			nachweisVorgelegt: true
		});
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
		expect(alle.every((v) => v.zustand === 'bestaetigt' && !v.istVerwaltung)).toBe(true);
	});
});

describe('Lauf 5, M-1: das Erfordernis des offenen Durchgangs', () => {
	it('liest den Knoten des offenen Durchgangs; Stimmsperre und Schliessen sind sich einig', async () => {
		const a = await versammlung('L8 offene Runde umgestellt', '2028-09-05');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		// Das Erfordernis am Traktandum lässt sich während der offenen Runde
		// ändern; nach der Freigabe nimmt die Maske die Wahl trotz Häkchen an
		// (Entscheid 8). Der Durchgang zählt mit dem eingefrorenen
		// Erfordernis, der Entlastung.
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		// Die Stimmsperre weist die Stimme der Verwaltung ab: Der Ausstand aus
		// L8 wirkt, weil der Durchgang mit der Entlastung rechnet.
		const fehler = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'yes' }],
			true,
			LEITUNG
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });
		// Und das Schliessen friert denselben Ausstand ein: Die Bezugsgrösse
		// rechnet ohne Hans Probe, und Tatsachenzeile und zweites Ergebnis
		// stehen im Protokoll.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.koepfe.basis).toBe(2);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toMatchObject({
			kennung: 'L8',
			ruhendeVollmachten: 1,
			feststellbar: false
		});
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain('Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft');
	});
});

describe('Lauf 5, M-2: das Kopieren des Häkchens am Verwaltungsknoten', () => {
	// Der Gegenfall steht oben: «nimmt das Kopieren das Häkchen mit» kopiert
	// die Entlastung mit Häkchen, und das Häkchen kommt mit.
	it('nimmt das Häkchen nicht mit, wenn das kopierte Erfordernis auf der Wahl steht (uebernimmTraktanden)', async () => {
		// Die Quelle steht nach der Freigabe auf der Wahl der Verwaltung und
		// trägt das Häkchen (Entscheid 8); die Kopie in einer Versammlung im
		// Entwurf dürfte die Kombination nicht tragen, denn die Absage im
		// Entwurf liesse sich von Hand nicht umgehen.
		const alt = await versammlung('L8 Vorlage Wahl', '2028-09-06');
		await gibFrei(alt);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: alt.versammlung, stwegId: alt.gemeinschaft },
			alt.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		const neu = await versammlung('L8 Übernahme Wahl', '2028-09-07', false, alt.gemeinschaft, 'Eigenes Geschäft');
		expect(await uebernimmTraktanden(handelnder(betreiber), neu.versammlung, [alt.traktandum])).toBe(1);
		const liste = await holeTraktanden(betreiber, neu.versammlung);
		const uebernommen = liste.find((x) => x.knoten.titel === 'Entlastung der Verwaltung');
		expect(uebernommen?.knoten.verwaltungsGeschaeft).toBe(false);
		// Das Erfordernis kommt trotzdem mit, damit die Vorlage sagt, was
		// damals galt.
		expect(uebernommen?.knoten.erfordernis?.knotenId).toBe('k-bewirtschaftung-waehlen');
	});

	it('nimmt das Häkchen bei der Übernahme offener Traktanden ebenso nicht mit (uebertrageOffeneTraktanden)', async () => {
		const alt = await versammlung('L8 Vorlage Wahl, offen', '2028-09-08');
		await gibFrei(alt);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: alt.versammlung, stwegId: alt.gemeinschaft },
			alt.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		const neu = await versammlung('L8 Übernahme Wahl, offen', '2028-09-09', false, alt.gemeinschaft, 'Eigenes Geschäft');
		const anzahl = await imKontext(betreiber, (tx) =>
			uebertrageOffeneTraktanden(tx, handelnder(betreiber), alt.versammlung, neu.versammlung)
		);
		expect(anzahl).toBeGreaterThanOrEqual(1);
		const liste = await holeTraktanden(betreiber, neu.versammlung);
		const uebernommen = liste.find((x) => x.knoten.titel === 'Entlastung der Verwaltung');
		expect(uebernommen?.knoten.verwaltungsGeschaeft).toBe(false);
	});
});

describe('Lauf 5, M-3: das Rückkommen auf die Wiederwahl', () => {
	it('zählt die Vollmachten am Rückkommen auf eine abgelehnte Wiederwahl', async () => {
		const a = await versammlung('L8 Rückkommen auf Wahl, abgelehnt', '2028-09-10');
		await gibFrei(a);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		// Ohne die Stimme der Verwaltung lehnt die Versammlung die Wiederwahl
		// ab: 1 Ja von 3, nötig 2.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const rueckkommen = await stelleRueckkommensantrag(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum
		);
		expect(rueckkommen.verwaltungsGeschaeft).toBe(true);
		// Das Rückkommen trägt das einfache Mehr des Ordnungsantrags; das
		// geerbte Häkchen wirkt an ihm nicht, weil das Ziel eine Wahl ist.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, rueckkommen.id)).toEqual([]);
		const sperren = await holeStimmsperren(betreiber, a.versammlung, rueckkommen.id);
		expect(sperren.some((x) => x.parteiId === a.parteien[1])).toBe(false);
	});

	it('zählt die Vollmachten am Rückkommen auf eine angenommene Wiederwahl', async () => {
		const a = await versammlung('L8 Rückkommen auf Wahl, angenommen', '2028-09-11');
		await gibFrei(a);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		// Mit der Stimme der Verwaltung nimmt die Versammlung die Wiederwahl
		// an: 2 Ja von 3.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const rueckkommen = await stelleRueckkommensantrag(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum
		);
		expect(rueckkommen.verwaltungsGeschaeft).toBe(true);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, rueckkommen.id)).toEqual([]);
		const sperren = await holeStimmsperren(betreiber, a.versammlung, rueckkommen.id);
		expect(sperren.some((x) => x.parteiId === a.parteien[1])).toBe(false);
	});
});

describe('Lauf 5, M-4: die Kennzeichnung je Name', () => {
	it('setzt und entfernt das Häkchen an allen Vollmachten desselben normalisierten Namens, je mit Verlaufseintrag', async () => {
		const a = await versammlung('L8 je Name', '2028-09-12');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [erste] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'Grosse Verwaltung AG',
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, erste.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, erste.id);
		const [zweite] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			istVerwaltung: false
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, zweite.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, zweite.id);

		// Die Kennzeichnung an der einen Zeile trägt das Häkchen an beide;
		// das Merkmal «· Verwaltung» erscheint an allen, und der Ausstand
		// ruht je Name.
		const mit = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, erste.id, true);
		expect(mit.istVerwaltung).toBe(true);
		expect((await holeVollmachten(betreiber, a.versammlung)).every((v) => v.istVerwaltung)).toBe(true);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ subject_id: string; detail: Record<string, unknown> }[]>`
				SELECT subject_id, detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.vollmachtVerwaltungGesetzt}
				   AND subject_id = ANY(${[erste.id, zweite.id]})
				`
		);
		expect(eintraege).toHaveLength(2);
		expect(eintraege.every((e) => e.detail.verwaltung === true)).toBe(true);

		// Und das Entfernen nimmt beide, wieder mit je einem Eintrag; der
		// Ausstand verschwindet mit dem einen Klick.
		const ohne = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, zweite.id, false);
		expect(ohne.istVerwaltung).toBe(false);
		expect((await holeVollmachten(betreiber, a.versammlung)).every((v) => !v.istVerwaltung)).toBe(true);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);
		const eintraegeNachher = await imKontext(betreiber, (tx) =>
			tx<{ subject_id: string; detail: Record<string, unknown> }[]>`
				SELECT subject_id, detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.vollmachtVerwaltungGesetzt}
				   AND subject_id = ANY(${[erste.id, zweite.id]})
				`
		);
		expect(eintraegeNachher).toHaveLength(4);
	});
});

describe('Codeprüfung Lauf 5, B3: das Bestätigen gleicht den Namen an', () => {
	it('übernimmt beim Bestätigen das Häkchen des Namens, mit Verlaufseintrag', async () => {
		const a = await versammlung('L8 Bestätigen übernimmt', '2028-09-25');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [erste] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, erste.id);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, erste.id);
		const [zweite] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse  verwaltung ag',
			vertritt: [a.moment![2]],
			istVerwaltung: false
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, zweite.id);
		const bestaetigt = await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, zweite.id);
		expect(bestaetigt.istVerwaltung).toBe(true);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE event_type = ${EREIGNISARTEN.vollmachtVerwaltungGesetzt}
				   AND subject_id = ${zweite.id}
				 ORDER BY id
			`
		);
		expect(eintraege.map((e) => e.detail.verwaltung)).toEqual([true]);
	});

	it('trägt das Häkchen beim Bestätigen an die Schwestern, und während einer Abstimmung gar nicht', async () => {
		const a = await versammlung('L8 Bestätigen setzt Namen', '2028-09-26');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		// Die Verwaltung ist ohne Häkchen für Hans Probe da, Erika selbst.
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		const [zweite] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			istVerwaltung: true
		});
		await vermerkeVorlage(handelnder(betreiber), a.versammlung, zweite.id);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await expect(
			bestaetigeVollmacht(handelnder(betreiber), a.versammlung, zweite.id)
		).rejects.toMatchObject({ kennung: 'durchgang_offen' });
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			true,
			LEITUNG
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		await bestaetigeVollmacht(handelnder(betreiber), a.versammlung, zweite.id);
		expect((await holeVollmachten(betreiber, a.versammlung)).every((v) => v.istVerwaltung)).toBe(true);
	});
});

describe('Lauf 5, G-4 und R3-3: der Satz an die Leitung', () => {
	it('nennt keinen Satz, wenn die vertretene Partei selbst im Ausstand steht (G-4)', async () => {
		const a = await versammlung('L8 selbst im Ausstand', '2028-09-13');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		// Hans Probe ist selbst im Ausstand: Seine Stimme zählt nach beiden
		// Wahlen nicht, und das Ruhen der Verwaltungsvollmacht änderte an
		// nichts; der Kern rechnet das zweite Ergebnis aus demselben Grund
		// nicht.
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[1],
			'Es geht um sein eigenes Geschäft.'
		);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum)).toBeNull();
	});

	it('nennt an der Wahl trotz Häkchen den Satz zum vorab erklärten Ausstand, unter beiden Wahlen (R3-3)', async () => {
		for (const [wahl, datum] of [
			['ruhen', '2028-09-14'],
			['leitung', '2028-09-15']
		] as const) {
			const a = await versammlung(`L8 Wahl mit erklärtem Ausstand, ${wahl}`, datum);
			if (wahl === 'leitung') {
				await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
			}
			await gibFrei(a);
			await setzeGewaehltesErfordernis(
				handelnder(betreiber),
				{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
				a.traktandum,
				'k-bewirtschaftung-waehlen',
				'k-decharge'
			);
			await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
			await verwaltungDa(a);
			// Der Ausstand der Verwaltung ist vorab erklärt; an der Wahl
			// ruhen ihre Vollmachten trotzdem nicht, und die Leitung soll ihn
			// zurücknehmen.
			await erklaereAusstand(
				handelnder(betreiber),
				a.versammlung,
				a.traktandum,
				vertreterkennung(VERWALTUNG),
				'Vorab erklärt, weil das Häkchen steht.'
			);
			expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum), wahl).toEqual({
				wahl,
				wahlTrotzHaekchen: true,
				ausstandErklaert: true,
				abberufungTrotzHaekchen: false,
				amFolgeantrag: false
			});
		}
	});
});

describe('Lauf 5, G-8: die Reihenfolge der Zuordnung', () => {
	it('nennt den Ausstand in der Reihenfolge der Zählung, nicht der Erklärung', async () => {
		const a = await versammlung('L8 Zuordnung, Reihenfolge', '2028-09-19');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		// Der Ausstand der Verwaltung wird zuerst erklärt, dann der einer
		// Partei. Die Zählung liest die erklärten Zeilen nach Partei und
		// Schlüssel, Parteien vor Vertretern ohne Partei; die bestätigte
		// Zuordnung nennt denselben Ausstand in derselben Reihenfolge, nicht
		// in der der Erklärung.
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			vertreterkennung(VERWALTUNG),
			'Es geht um ihre eigene Entlastung.'
		);
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			a.parteien[0],
			'Es geht um ihr eigenes Geschäft.'
		);
		const erfordernis =
			(await holeTraktanden(betreiber, a.versammlung)).find((t) => t.knoten.id === a.traktandum)?.knoten
				.erfordernis ?? null;
		const z = await holeZuordnung(betreiber, a.versammlung, a.traktandum, erfordernis);
		expect(z.imAusstand).toEqual(['Erika Beispiel', 'Grosse Verwaltung AG']);
	});
});

describe('Lauf 5, G-7: ergänzte Fälle', () => {
	it('kennzeichnet eine Vollmacht, die über den persönlichen Zugang erfasst wurde', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'L8 Kennzeichnung am Zugang',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null,
			proxyByAccess: true,
			proxyByAccessSource: 'Art. 26 Reglement'
		});
		const a = await versammlung('L8 Kennzeichnung am Zugang', '2028-09-16', true, g.id);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const v = await erklaere(betreiber, a.versammlung, a.parteien[1], {
			bevollmaechtigtName: VERWALTUNG
		});
		expect(v.herkunft).toBe('zugang');
		expect(v.zustand).toBe('erfasst');
		// Die Kennzeichnung geht auch an dieser erfassten Zeile: Die Knöpfe
		// stehen bei erfasst (G-1), und der Server nimmt es an.
		const mit = await kennzeichneVerwaltung(handelnder(betreiber), a.versammlung, v.id, true);
		expect(mit.istVerwaltung).toBe(true);
	});

	it('trägt die Übernahme beim Einlass im Verlauf, wenn sie den Wert änderte', async () => {
		const a = await versammlung('L8 Einlass mit Verlauf', '2028-09-17');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		const [vollmacht] = await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: false
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true,
			istVerwaltung: true
		});
		const [nachher] = await holeVollmachten(betreiber, a.versammlung);
		expect(nachher.istVerwaltung).toBe(true);
		const eintraege = await imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'proxy' AND subject_id = ${vollmacht.id}
				   AND event_type = ${EREIGNISARTEN.vollmachtVerwaltungGesetzt}
				`
		);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({ verwaltung: true });
	});

	it('nimmt die Wiederwahl nach der Freigabe auch unter «Die Sitzungsleitung entscheidet» an; die Stimme zählt (Entscheid 8)', async () => {
		const a = await versammlung('L8 Wiederwahl unter leitung', '2028-09-18');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			a.traktandum,
			'k-bewirtschaftung-waehlen',
			'k-decharge'
		);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, a.traktandum)).toEqual({
			wahl: 'leitung',
			wahlTrotzHaekchen: true,
			ausstandErklaert: false,
			abberufungTrotzHaekchen: false,
			amFolgeantrag: false
		});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, entlastungsStimmen(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const { auszaehlung } = await holeErgebnis(betreiber, a.versammlung, d.id);
		expect(auszaehlung?.angenommen).toBe(true);
		expect(auszaehlung?.koepfe.ja).toBe(2);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
	});
});

/**
 * Entscheid 0045, Punkt 9 (07.11.2026): der Ausweg am Abend über
 * Folgeanträge. Der Grundantrag bleibt die Entlastung mit Häkchen
 * (`k-decharge`); die Einladung kündigt für ihn das einfache Mehr der
 * Anwesenden an, dasselbe wie bei Wahl und Abberufung, also sperrt die
 * Untergrenze keinen der Folgeanträge.
 */
describe('Entscheid 0045, Punkt 9: Folgeanträge unter dem Häkchen', () => {
	async function folgeantrag(a: Versammlungslage, titel: string, knoten: string) {
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel,
				art: 'abstimmung',
				antragswortlaut: `${titel}.`,
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			f.id,
			knoten,
			null
		);
		return f;
	}

	/** Alle drei Ja, auch die Verwaltung für Hans Probe: 3 von 3. */
	function alleJa(a: Versammlungslage, mitVerwaltung: boolean) {
		return [
			{ parteiId: a.parteien[0], wahl: 'yes' as const },
			...(mitVerwaltung ? [{ parteiId: a.parteien[1], wahl: 'yes' as const }] : []),
			{ parteiId: a.parteien[2], wahl: 'yes' as const }
		];
	}

	it('zählt die Vollmachten am Folgeantrag zur Wahl, lässt sie am Folgeantrag zur Entschädigung ruhen, sperrt den Grundantrag und nennt beide im Protokoll', async () => {
		const a = await versammlung('L8 P9 Aufteilen', '2028-11-01');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);

		const wahl = await folgeantrag(a, 'Wiederwahl', 'k-bewirtschaftung-waehlen');
		expect(wahl.verwaltungsGeschaeft).toBe(true);
		// Am Folgeantrag zur Wahl wirkt das geerbte Häkchen nicht.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, wahl.id)).toEqual([]);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, wahl.id)).toEqual({
			wahl: 'ruhen',
			wahlTrotzHaekchen: true,
			ausstandErklaert: false,
			abberufungTrotzHaekchen: false,
			amFolgeantrag: true
		});
		expect(await holeTeilentschieden(betreiber, a.versammlung, a.traktandum)).toEqual([]);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		// Die Stimmsperre nimmt die Stimme der Verwaltung an.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, true), true, LEITUNG);
		const d1 = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect((await holeErgebnis(betreiber, a.versammlung, d1.id)).auszaehlung?.koepfe.ja).toBe(3);

		// Danach sperrt der entschiedene Teil den Grundantrag.
		expect(await holeTeilentschieden(betreiber, a.versammlung, a.traktandum)).toEqual([
			{ traktandumId: wahl.id, titel: 'Wiederwahl', art: 'wahl', angenommen: true }
		]);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'teil_entschieden' });
		expect(String(fehler.message)).toMatch(/im Folgeantrag «Wiederwahl» angenommen/);

		// Der zweite Folgeantrag, zur Entschädigung: Dort ruht die Vollmacht.
		const geld = await folgeantrag(a, 'Entschädigung', 'k-decharge');
		const ausstand = await holeVerwaltungsausstand(betreiber, a.versammlung, geld.id);
		expect(ausstand).toHaveLength(1);
		expect(ausstand[0].id).toBe(`l8:${vertreterkennung(VERWALTUNG)}`);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		const abgewiesen = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'yes' }],
			true,
			LEITUNG
		).catch((f) => f);
		expect(abgewiesen).toMatchObject({ kennung: 'im_ausstand' });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, false), true, LEITUNG);
		const d2 = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const zwei = (await holeErgebnis(betreiber, a.versammlung, d2.id)).auszaehlung;
		expect(zwei?.angenommen).toBe(true);
		expect(zwei?.koepfe.ja).toBe(2);

		// Das Protokoll nennt beide angenommenen Folgeanträge beim Grundantrag.
		const nummern = new Map(
			(await holeTraktanden(betreiber, a.versammlung)).map((t) => [t.knoten.id, t.nummer])
		);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			`Über diesen Antrag wurde nicht abgestimmt: Die Versammlung hat die Folgeanträge ` +
				`${nummern.get(wahl.id)} «Wiederwahl» und ${nummern.get(geld.id)} «Entschädigung» angenommen. ` +
				'Der ursprüngliche Antrag ist damit gegenstandslos.'
		);
	});

	it('sperrt den Grundantrag auch, wenn die Wahl im Folgeantrag abgelehnt ist', async () => {
		const a = await versammlung('L8 P9 Wahl abgelehnt', '2028-11-02');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const wahl = await folgeantrag(a, 'Wiederwahl', 'k-bewirtschaftung-waehlen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'no' },
				{ parteiId: a.parteien[1], wahl: 'no' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			true,
			LEITUNG
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung?.angenommen).toBe(false);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'teil_entschieden' });
		expect(String(fehler.message)).toMatch(/im Folgeantrag «Wiederwahl» nicht angenommen/);
		// Codeprüfung P9, M-2: Das Protokoll sagt beim gesperrten Grundantrag,
		// warum nicht abgestimmt wurde.
		const nummer = (await holeTraktanden(betreiber, a.versammlung)).find((t) => t.knoten.id === wahl.id)!.nummer;
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(
			'Über diesen Antrag wurde nicht abgestimmt: Er enthält die Wahl der Verwaltung, über die die ' +
				`Versammlung im Folgeantrag ${nummer} «Wiederwahl» entschieden hat.`
		);
	});

	it('nimmt die Abberufung als Folgeantrag an, ohne dass die Vollmacht von selbst ruht, und hält es im Protokoll fest', async () => {
		const a = await versammlung('L8 P9 Abberufung', '2028-11-03');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const ab = await folgeantrag(a, 'Abberufung per 31.12.', 'k-bewirtschaftung-abberufen');
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, ab.id)).toEqual([]);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, ab.id)).toEqual({
			wahl: 'ruhen',
			wahlTrotzHaekchen: false,
			ausstandErklaert: false,
			abberufungTrotzHaekchen: true,
			amFolgeantrag: true
		});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, ab.id);
		// Ohne erklärten Ausstand nimmt die Stimmsperre die Stimme an.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const auszaehlung = (await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung;
		expect(auszaehlung?.koepfe.ja).toBe(3);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();
		expect(await holeTeilentschieden(betreiber, a.versammlung, a.traktandum)).toEqual([
			{ traktandumId: ab.id, titel: 'Abberufung per 31.12.', art: 'abberufung', angenommen: true }
		]);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL);
	});

	it('zählt die Vollmachten am Rückkommen auf eine abgelehnte Abberufung als Folgeantrag (Codeprüfung P9, M-1)', async () => {
		const a = await versammlung('L8 P9 Rückkommen Abberufung', '2028-11-05');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const ab = await folgeantrag(a, 'Abberufung', 'k-bewirtschaftung-abberufen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, ab.id);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'no' },
				{ parteiId: a.parteien[1], wahl: 'no' },
				{ parteiId: a.parteien[2], wahl: 'yes' }
			],
			true,
			LEITUNG
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const rueckkommen = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, ab.id);
		expect(rueckkommen.verwaltungsGeschaeft).toBe(true);
		// Das Rückkommen trägt das Mehr des Ordnungsantrags; wie an der
		// Abberufung selbst ruht dort nichts von selbst.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, rueckkommen.id)).toEqual([]);
		const sperren = await holeStimmsperren(betreiber, a.versammlung, rueckkommen.id);
		expect(sperren.some((x) => x.parteiId === a.parteien[1])).toBe(false);
	});

	it('sperrt den Grundantrag ohne Häkchen nicht, auch nach einem entschiedenen Folgeantrag zur Wahl (G-5)', async () => {
		const a = await versammlung('L8 P9 ohne Häkchen', '2028-11-06', false);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const wahl = await folgeantrag(a, 'Wahl der Y AG', 'k-bewirtschaftung-waehlen');
		expect(wahl.verwaltungsGeschaeft).toBe(false);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(await holeTeilentschieden(betreiber, a.versammlung, a.traktandum)).toEqual([]);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
	});

	it('führt die Sperre im Notweg als Übergangenes (G-5)', async () => {
		const a = await versammlung('L8 P9 Notweg', '2028-11-07');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const wahl = await folgeantrag(a, 'Wiederwahl', 'k-bewirtschaftung-waehlen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const vorschau = await holeVonHandVorschau(betreiber, a.versammlung, a.traktandum);
		expect(vorschau.uebergangen.map((u) => u.kennung)).toContain('teil_entschieden');
	});

	it('lässt die Vollmacht an der Abberufung ruhen, wenn die Leitung den Ausstand erklärt', async () => {
		const a = await versammlung('L8 P9 Abberufung, Ausstand', '2028-11-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const ab = await folgeantrag(a, 'Abberufung', 'k-bewirtschaftung-abberufen');
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			ab.id,
			vertreterkennung(VERWALTUNG),
			'Die Verwaltung verlässt den Raum.'
		);
		// Mit erklärtem Ausstand trägt das Merkmal nichts mehr; der Satz
		// entfällt, weil die Leitung entschieden hat.
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, ab.id)).toBeNull();
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, ab.id);
		const fehler = await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[{ parteiId: a.parteien[1], wahl: 'yes' }],
			true,
			LEITUNG
		).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });
		// Fachprüfung Runde 5, R5-3: Die Protokollzeile sagt, was die Leitung
		// entschied.
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alleJa(a, false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const text = (
			await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')
		).replace(/\s+/g, ' ');
		expect(text).toContain(VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL);
	});

	it('nennt den nicht übernommenen Ausstand nur am Folgeantrag eines Grundantrags mit erklärtem Ausstand (R5-4)', async () => {
		const a = await versammlung('L8 P9 Ausstand nicht geerbt', '2028-11-08');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		const geld = await folgeantrag(a, 'Entschädigung', 'k-decharge');
		expect(await holeAusstandAmGrundantrag(betreiber, a.versammlung, geld.id)).toBe(false);
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			a.traktandum,
			vertreterkennung(VERWALTUNG),
			'Vorab erklärt.'
		);
		expect(await holeAusstandAmGrundantrag(betreiber, a.versammlung, geld.id)).toBe(true);
		// Am Grundantrag selbst nicht: Er ist kein Folgeantrag.
		expect(await holeAusstandAmGrundantrag(betreiber, a.versammlung, a.traktandum)).toBe(false);
		// Codeprüfung P9, N-G2: nicht mehr, wenn er am Folgeantrag erneut erklärt ist.
		await erklaereAusstand(handelnder(betreiber), a.versammlung, geld.id, vertreterkennung(VERWALTUNG), 'Erneut.');
		expect(await holeAusstandAmGrundantrag(betreiber, a.versammlung, geld.id)).toBe(false);
		// Laienprüfung Runde 6, R6-2: am Folgeantrag zur Wahl gilt der Ausstand
		// eines Vertreters nicht und wird nicht genannt.
		const wahl = await folgeantrag(a, 'Wiederwahl', 'k-bewirtschaftung-waehlen');
		expect(await holeAusstandAmGrundantrag(betreiber, a.versammlung, wahl.id)).toBe(false);
	});
});

describe('Entscheid 0045, Punkt 9: die Absage am Verwaltungsknoten je Lage', () => {
	it('nimmt die Abberufung nach der Freigabe am Folgeantrag an, am Grundantrag nicht', () => {
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-abberufen', false, true)).toBeNull();
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-abberufen', false, false)).toBe(
			VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN
		);
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-abberufen', false)).toBe(
			VERWALTUNG_HAKEN_ABSAGE_FREIGEGEBEN
		);
	});

	it('lässt Wahl und Wiederwahl nach der Freigabe zu und sagt im Entwurf wie bisher ab', () => {
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-waehlen', false, true)).toBeNull();
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-waehlen', false, false)).toBeNull();
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-waehlen', true)).toBe(VERWALTUNG_HAKEN_ABSAGE_WAHL);
		expect(verwaltungsabsageAmWahlknoten('k-bewirtschaftung-abberufen', true)).toBe(
			VERWALTUNG_HAKEN_ABSAGE_ABBERUFUNG
		);
	});
});

describe('Featureprüfung 2, M3 T3: L8 erreicht L7', () => {
	/*
	 * Kein anderer Test kombiniert «Zählt nicht mit» (L7) mit dem Ruhen aus L8:
	 * Liesse die L7-Prüfung die Kennungen aus L8 weg, blieben L7 und L8 je für
	 * sich grün, und die Abstimmung öffnete hier, wo sie abweisen muss.
	 *
	 * Die Rechnung (erste Versammlung, Art. 712p Abs. 1 ZGB: die Hälfte der
	 * Eigentümer, mindestens zwei, und die Hälfte der Wertquoten): Erika
	 * Beispiel (400) ist selbst da, Hans Probe (300) nur über die Grosse
	 * Verwaltung AG, Kurt Beispiel (300) fehlt.
	 * - Mit der Vollmacht: zwei von drei Eigentümern, 700 von 1000; die
	 *   Versammlung ist beschlussfähig, das Eröffnen kommt bis zu L7.
	 * - Ohne sie, weil sie am Traktandum mit Häkchen ruht: einer von drei,
	 *   400 von 1000; nicht beschlussfähig. Die Beschlussfähigkeit hängt also
	 *   genau an der Vollmacht der Verwaltung, und niemand hat einen Ausstand
	 *   erklärt.
	 */
	async function lage(name: string, datum: string, ohneHäkchenAnDerVollmacht: boolean) {
		const a = await versammlung(name, datum);
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibFrei(a);
		expect(await holeLesarten(betreiber, { meetingId: a.versammlung })).toMatchObject({
			L7: 'zaehlt_nicht',
			L8: 'ruhen', L9: 'alle', L11: 'qualifiziert'
		});
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: !ohneHäkchenAnDerVollmacht
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		return a;
	}

	it('weist das Eröffnen unter «Zählt nicht mit» ab, wenn die Beschlussfähigkeit an den ruhenden Vollmachten der Verwaltung hängt', async () => {
		const a = await lage('L8 und L7, nur über die Verwaltung', '2028-09-01', false);
		const fehler = await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'ausstand_nicht_beschlussfaehig' });
		expect(String(fehler.message)).toMatch(
			/Ohne die Personen im Ausstand ist die Versammlung bei diesem Traktandum nicht beschlussfähig/
		);
		expect(await holeDurchgaenge(betreiber, a.versammlung)).toHaveLength(0);
	});

	it('öffnet in derselben Lage, wenn die Vollmacht das Häkchen nicht trägt', async () => {
		// Die Gegenprobe: Ohne Häkchen an der Vollmacht ruht nichts, und die
		// Versammlung bleibt mit zwei von drei und 700 von 1000 beschlussfähig.
		const a = await lage('L8 und L7, Vollmacht ohne Häkchen', '2028-09-02', true);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, a.traktandum);
		expect(await holeDurchgaenge(betreiber, a.versammlung)).toHaveLength(1);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	});
});

/*
 * Entscheid 0045, Punkt 11 (08.11.2026): die Angabe der Sitzungsleitung an
 * einem Folgeantrag mit Häkchen (Migration 185). Der Grundantrag bleibt die
 * Entlastung mit Häkchen; daneben steht je ein entschiedener Folgeantrag zur
 * Wahl oder Abberufung, und der Folgeantrag mit der Angabe trägt das Mehr der
 * Entlastung (`k-decharge`), an dem die Vollmachten ohne Angabe ruhen.
 */
describe('Entscheid 0045, Punkt 11: die Angabe der Leitung am Folgeantrag', () => {
	async function folgeantrag(a: Versammlungslage, titel: string, knoten: string) {
		const f = await nimmTraktandumAuf(
			handelnder(betreiber),
			{
				meetingId: a.versammlung,
				parentId: a.traktandum,
				titel,
				art: 'abstimmung',
				antragswortlaut: `${titel}.`,
				antragstellerart: 'bewirtschaftung',
				antragstellerId: null,
				antragstellerIds: [],
				betroffeneParteiIds: []
			},
			'folgeantrag'
		);
		await setzeGewaehltesErfordernis(
			handelnder(betreiber),
			{ meetingId: a.versammlung, stwegId: a.gemeinschaft },
			f.id,
			knoten,
			null
		);
		return f;
	}

	/** Alle drei gleich, auch die Verwaltung für Hans Probe, wenn sie darf. */
	function alle(a: Versammlungslage, wahl: 'yes' | 'no', mitVerwaltung: boolean) {
		return [
			{ parteiId: a.parteien[0], wahl },
			...(mitVerwaltung ? [{ parteiId: a.parteien[1], wahl }] : []),
			{ parteiId: a.parteien[2], wahl }
		];
	}

	/** Eine laufende Versammlung mit der Verwaltung im Saal. */
	async function lage(name: string, datum: string, haekchen = true) {
		const a = await versammlung(name, datum, haekchen);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		return a;
	}

	/** Ein Folgeantrag zur Wahl, mit allen Stimmen angenommen. */
	async function wahlAngenommen(a: Versammlungslage) {
		const wahl = await folgeantrag(a, 'Wahl der Neu Verwaltung GmbH', 'k-bewirtschaftung-waehlen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		return wahl;
	}

	/** Ein Folgeantrag zur Abberufung, mit allen Stimmen abgelehnt. */
	async function abberufungAbgelehnt(a: Versammlungslage) {
		const ab = await folgeantrag(a, 'Abberufung der Grossen Verwaltung AG', 'k-bewirtschaftung-abberufen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, ab.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'no', true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		return ab;
	}

	async function protokoll(a: Versammlungslage) {
		return (await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf')).replace(
			/\s+/g,
			' '
		);
	}

	async function verlauf(traktandumId: string, art: string) {
		return imKontext(betreiber, (tx) =>
			tx<{ detail: Record<string, unknown> }[]>`
				SELECT detail FROM audit_entry
				 WHERE subject_type = 'agenda_item' AND subject_id = ${traktandumId} AND event_type = ${art}
			`
		);
	}

	async function absage(p: Promise<unknown>) {
		return p.then(
			() => {
				throw new Error('Die Absage blieb aus.');
			},
			(f: unknown) => f as { kennung: string; message: string }
		);
	}

	it('nach einer ohne Ergebnis abgebrochenen Abstimmung lässt sich die Angabe noch machen (Laienprüfung Runde 14, R14-4)', async () => {
		const a = await lage('L8 P11 nach Abbruch', '2028-12-04');
		await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		await brecheAbstimmungAb(handelnder(betreiber), a.versammlung, 'Prüflauf: Angabe vergessen.');
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung');
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, geld.id)).toEqual([]);
		// Ein geschlossener Durchgang sperrt weiter.
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', true), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect(
			await absage(nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id))
		).toMatchObject({ kennung: 'schon_abgestimmt', message: VERWALTUNGSANGABE_ABGESTIMMT });
	});

	it('ein geschlossener, noch nicht verkündeter Durchgang (offener Stichentscheid) sperrt die Angabe (Codeprüfung P11, zweiter Durchgang, H1)', async () => {
		// Der Stichentscheid liegt bei einer Person (Verwalter); bei Gleichstand
		// bleibt der Durchgang geschlossen, aber weder überholt noch verkündet,
		// bis jemand ihn einträgt.
		const a = await versammlung('L8 P11 Stichentscheid offen', '2028-12-05');
		await imKontext(betreiber, (tx) =>
			tx`UPDATE stweg SET tie_break = 'verwalter', tie_break_rule_source = 'Art. 7 Reglement' WHERE id = ${a.gemeinschaft}`
		);
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		// Die Vollmacht für Hans Probe ruht: 1 Ja zu 1 Nein, Gleichstand.
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[2], wahl: 'no' }
			],
			true,
			LEITUNG
		);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const [zustand] = await imKontext(betreiber, (tx) =>
			tx<{ geschlossen: boolean; verkuendet: boolean; ueberholt: boolean }[]>`
				SELECT closed_at IS NOT NULL AS geschlossen, result_published_at IS NOT NULL AS verkuendet,
				       superseded_at IS NOT NULL AS ueberholt
				FROM voting_round WHERE id = ${d.id}
			`
		);
		expect(zustand).toEqual({ geschlossen: true, verkuendet: false, ueberholt: false });
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'schon_abgestimmt', message: VERWALTUNGSANGABE_ABGESTIMMT });
	});

	it('andere Verwaltung: Ohne Angabe ruht die Vollmacht, mit Angabe zählt die Stimme der Verwaltung; Verlauf und Protokoll nennen den Grund', async () => {
		const a = await lage('L8 P11 andere Verwaltung', '2028-12-01');
		const wahl = await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');

		// Ohne Angabe ruht die Vollmacht wie an jedem Folgeantrag mit Häkchen,
		// und die Leitung bekommt das Angebot.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, geld.id)).toHaveLength(1);
		const vorher = await holeVerwaltungsangabelage(betreiber, a.versammlung, geld.id);
		expect(verwaltungsangabeImSaal(vorher, true)).toEqual({
			gesetzt: null,
			angebote: [{ grund: 'andere_verwaltung', titel: 'Wahl der Neu Verwaltung GmbH' }]
		});
		// Ohne ruhende Vollmacht kein Angebot.
		expect(verwaltungsangabeImSaal(vorher, false)).toBeNull();

		// Die Kündigung verlangt eine nicht angenommene Abberufung.
		const ohneAbberufung = await absage(
			gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'kuendigung')
		);
		expect(ohneAbberufung).toMatchObject({ kennung: 'geschwister_fehlt', message: VERWALTUNGSANGABE_OHNE_ABBERUFUNG });
		// Ein Grund, den es nicht gibt.
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'irgendwas'))
		).toMatchObject({ kennung: 'grund_fehlt' });

		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung');
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'schon_gemacht' });
		expect((await holeTraktanden(betreiber, a.versammlung)).find((t) => t.knoten.id === geld.id)?.knoten).toMatchObject(
			{ verwaltungsangabe: 'andere_verwaltung' }
		);
		const eintraege = await verlauf(geld.id, EREIGNISARTEN.verwaltungsangabeGemacht);
		expect(eintraege).toHaveLength(1);
		expect(eintraege[0].detail).toMatchObject({
			traktandum: 'Entschädigung der Neu Verwaltung GmbH',
			grund: 'andere_verwaltung',
			gestuetztAuf: wahl.titel
		});

		// Mit der Angabe ruht nichts von selbst; Satz an die Leitung mit der Angabe.
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, geld.id)).toEqual([]);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, geld.id)).toEqual({
			wahl: 'ruhen',
			wahlTrotzHaekchen: false,
			ausstandErklaert: false,
			abberufungTrotzHaekchen: false,
			amFolgeantrag: true,
			angabe: 'andere_verwaltung'
		});
		expect(
			verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, geld.id), true)
		).toEqual({ gesetzt: 'andere_verwaltung', angebote: [] });
		expect((await holeStimmsperren(betreiber, a.versammlung, geld.id)).some((x) => x.parteiId === a.parteien[1])).toBe(
			false
		);

		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		// Während der Abstimmung lässt sich die Angabe nicht ändern.
		expect(
			await absage(nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id))
		).toMatchObject({ kennung: 'durchgang_offen', message: VERWALTUNGSANGABE_OFFEN });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const auszaehlung = (await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung;
		expect(auszaehlung?.koepfe.ja).toBe(3);
		expect(auszaehlung?.andereVerwaltungsvollmacht).toBeUndefined();

		// Nach dem ersten Durchgang weder zurücknehmen noch neu setzen.
		expect(
			await absage(nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id))
		).toMatchObject({ kennung: 'schon_abgestimmt', message: VERWALTUNGSANGABE_ABGESTIMMT });
		expect(verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, geld.id), true)).toBeNull();

		const text = await protokoll(a);
		expect(text).toContain(VERWALTUNG_ANGABE_ANDERE_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL);

		// Das Rückkommen auf den Folgeantrag mit Angabe tut dasselbe wie er.
		const rueckkommen = await stelleRueckkommensantrag(handelnder(betreiber), a.versammlung, geld.id);
		expect(rueckkommen.verwaltungsGeschaeft).toBe(true);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, rueckkommen.id)).toEqual([]);
		expect(
			(await holeStimmsperren(betreiber, a.versammlung, rueckkommen.id)).some((x) => x.parteiId === a.parteien[1])
		).toBe(false);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, rueckkommen.id)).toMatchObject({
			angabe: 'andere_verwaltung'
		});
		// Am Rückkommen selbst gibt es die Angabe nicht.
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, rueckkommen.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'angabe_nicht_hier', message: VERWALTUNGSANGABE_NICHT_HIER });

		// Nach dem Schliessen der Versammlung nichts mehr.
		await schliesseVersammlung(handelnder(betreiber), a.versammlung);
		expect(
			await absage(nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id))
		).toMatchObject({ kennung: 'zustand_unpassend' });
	});

	it('andere Verwaltung mit erklärtem Ausstand: Die Vollmacht ruht, und das Protokoll sagt es', async () => {
		const a = await lage('L8 P11 andere Verwaltung, Ausstand', '2028-12-02');
		await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung');
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			geld.id,
			vertreterkennung(VERWALTUNG),
			'Die Grosse Verwaltung AG ist am Vertrag der Neuen beteiligt.'
		);
		// Mit erklärtem Ausstand entfällt der Satz zur Angabe; der Ausstand wirkt.
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, geld.id)).toBeNull();
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		const fehler = await absage(
			gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], true, LEITUNG)
		);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const text = await protokoll(a);
		expect(text).toContain(VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ANGABE_ANDERE_PROTOKOLL);
	});

	it('Kündigung: nur nach nicht angenommener Abberufung; die Stimme der Verwaltung zählt, das Protokoll nennt die Kündigung', async () => {
		const a = await lage('L8 P11 Kündigung', '2028-12-03');
		const ab = await abberufungAbgelehnt(a);
		const vertrag = await folgeantrag(a, 'Kündigung des Verwaltungsvertrags', 'k-decharge');
		expect(verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, vertrag.id), true)).toEqual({
			gesetzt: null,
			angebote: [{ grund: 'kuendigung', titel: ab.titel }]
		});
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, vertrag.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'geschwister_fehlt', message: VERWALTUNGSANGABE_OHNE_WAHL });
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, vertrag.id, 'kuendigung');
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, vertrag.id)).toEqual([]);
		expect(await holeVerwaltungsvollmachtenLage(betreiber, a.versammlung, vertrag.id)).toMatchObject({
			angabe: 'kuendigung'
		});
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, vertrag.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', true), true, LEITUNG);
		const d = await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		expect((await holeErgebnis(betreiber, a.versammlung, d.id)).auszaehlung?.koepfe.ja).toBe(3);
		const text = await protokoll(a);
		expect(text).toContain(VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL);
	});

	it('Kündigung mit erklärtem Ausstand: Das Protokoll sagt, dass die Vollmachten ruhten', async () => {
		const a = await lage('L8 P11 Kündigung, Ausstand', '2028-12-04');
		await abberufungAbgelehnt(a);
		const vertrag = await folgeantrag(a, 'Kündigung des Verwaltungsvertrags', 'k-decharge');
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, vertrag.id, 'kuendigung');
		await erklaereAusstand(
			handelnder(betreiber),
			a.versammlung,
			vertrag.id,
			vertreterkennung(VERWALTUNG),
			'Die Verwaltung verlässt den Raum.'
		);
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, vertrag.id);
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const text = await protokoll(a);
		expect(text).toContain(VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL);
	});

	it('nimmt die Angabe bis zum ersten Durchgang zurück; danach ruht die Vollmacht wieder, mit Verlauf', async () => {
		const a = await lage('L8 P11 zurücknehmen', '2028-12-05');
		await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		expect(
			await absage(nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id))
		).toMatchObject({ kennung: 'keine_angabe', message: VERWALTUNGSANGABE_KEINE });
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung');
		await nimmVerwaltungsangabeZurueck(handelnder(betreiber), a.versammlung, geld.id);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, geld.id)).toHaveLength(1);
		expect((await holeTraktanden(betreiber, a.versammlung)).find((t) => t.knoten.id === geld.id)?.knoten.verwaltungsangabe).toBeUndefined();
		const zurueck = await verlauf(geld.id, EREIGNISARTEN.verwaltungsangabeZurueckgenommen);
		expect(zurueck).toHaveLength(1);
		expect(zurueck[0].detail).toMatchObject({ grund: 'andere_verwaltung' });
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		const fehler = await absage(
			gibStimmenAb(handelnder(betreiber), a.versammlung, [{ parteiId: a.parteien[1], wahl: 'yes' }], true, LEITUNG)
		);
		expect(fehler).toMatchObject({ kennung: 'im_ausstand' });
		// Nach dem Eröffnen auch kein neues Setzen.
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'durchgang_offen' });
		await gibStimmenAb(handelnder(betreiber), a.versammlung, alle(a, 'yes', false), true, LEITUNG);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const text = await protokoll(a);
		expect(text).not.toContain(VERWALTUNG_ANGABE_ANDERE_PROTOKOLL);
		expect(text).not.toContain(VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL);
	});

	it('sagt ab: ohne entschiedenen Folgeantrag, am Grundantrag, am Wahlknoten', async () => {
		const a = await lage('L8 P11 Absagen', '2028-12-06');
		const geld = await folgeantrag(a, 'Entschädigung', 'k-decharge');
		// Noch keine Wahl entschieden: kein Angebot, und die Angabe sagt ab.
		expect(verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, geld.id), true)).toBeNull();
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'geschwister_fehlt', message: VERWALTUNGSANGABE_OHNE_WAHL });
		await wahlAngenommen(a);
		// Am Grundantrag gibt es die Angabe nicht.
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, a.traktandum, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'angabe_nicht_hier' });
		// An einem weiteren Folgeantrag zur Wahl nicht, dort ruht ohnehin nichts.
		const zweiteWahl = await folgeantrag(a, 'Wahl der Dritt Verwaltung AG', 'k-bewirtschaftung-waehlen');
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, zweiteWahl.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'angabe_am_verwaltungsknoten', message: VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN });
		expect(
			verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, zweiteWahl.id), true)
		).toBeNull();
		// Ein fremdes Traktandum: die Absage der Bindung.
		const fremd = await lage('L8 P11 Absagen fremd', '2028-12-07');
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), fremd.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'fremdes_traktandum' });
	});

	it('sagt unter «Die Sitzungsleitung entscheidet» ab', async () => {
		const a = await versammlung('L8 P11 leitung', '2028-12-08');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await verwaltungDa(a);
		await wahlAngenommen(a);
		const geld = await folgeantrag(a, 'Entschädigung', 'k-decharge');
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'angabe_nicht_hier', message: VERWALTUNGSANGABE_NICHT_HIER });
		expect(verwaltungsangabeImSaal(await holeVerwaltungsangabelage(betreiber, a.versammlung, geld.id), true)).toBeNull();
	});

	it('rechnet L7 mit der Angabe: Unter «Zählt nicht mit» öffnet die Abstimmung, die ohne Angabe gesperrt ist', async () => {
		// Die Lage aus «Featureprüfung 2, M3 T3»: Erika Beispiel (400) selbst da,
		// Hans Probe (300) nur über die Verwaltung, Kurt Beispiel fehlt. Ruht
		// die Vollmacht, ist die Versammlung beim Traktandum nicht beschlussfähig.
		const a = await versammlung('L8 P11 und L7', '2028-12-12');
		await speichereLesarten(handelnder(betreiber), 'admin', a.gemeinschaft, { L7: 'zaehlt_nicht' });
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		await bestaetigeAnwesenheit(handelnder(betreiber), a.versammlung, a.parteien[0], 'von_hand');
		// Die Wahl zählt die Vollmacht (Entscheid 8) und ist beschlussfähig.
		const wahl = await folgeantrag(a, 'Wahl der Neu Verwaltung GmbH', 'k-bewirtschaftung-waehlen');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, wahl.id);
		await gibStimmenAb(
			handelnder(betreiber),
			a.versammlung,
			[
				{ parteiId: a.parteien[0], wahl: 'yes' },
				{ parteiId: a.parteien[1], wahl: 'yes' }
			],
			true,
			LEITUNG
		);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
		const geld = await folgeantrag(a, 'Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		const fehler = await absage(oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id));
		expect(fehler).toMatchObject({ kennung: 'ausstand_nicht_beschlussfaehig' });
		await gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung');
		await oeffneAbstimmung(handelnder(betreiber), a.versammlung, geld.id);
		await schliesseAbstimmung(handelnder(betreiber), a.versammlung);
	});

	it('sagt ohne Häkchen ab, und die Datenbank hält die Angabe am Folgeantrag mit Häkchen fest', async () => {
		const a = await lage('L8 P11 ohne Häkchen', '2028-12-09', false);
		const geld = await folgeantrag(a, 'Entschädigung', 'k-decharge');
		expect(geld.verwaltungsGeschaeft).toBe(false);
		expect(
			await absage(gibVerwaltungsangabe(handelnder(betreiber), a.versammlung, geld.id, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'angabe_nicht_hier' });
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE agenda_item SET management_exemption = 'andere_verwaltung' WHERE id = ${geld.id}`
			)
		).rejects.toThrow(/agenda_item_verwaltungsangabe_nur_folgeantrag/);
		// Am Traktandum mit Häkchen ebenso, wenn es kein Folgeantrag ist (im
		// Entwurf, wo sich die Zeile ändern lässt).
		const entwurf = await versammlung('L8 P11 Grundantrag Schranke', '2028-12-10');
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE agenda_item SET management_exemption = 'kuendigung' WHERE id = ${entwurf.traktandum} RETURNING id`
			)
		).rejects.toThrow(/agenda_item_verwaltungsangabe_nur_folgeantrag/);
		// Und am Folgeantrag mit Häkchen nur die zwei Werte.
		const b = await lage('L8 P11 Werte', '2028-12-11');
		const mitHaekchen = await folgeantrag(b, 'Entschädigung', 'k-decharge');
		await expect(
			imKontext(
				betreiber,
				(tx) => tx`UPDATE agenda_item SET management_exemption = 'irgendwas' WHERE id = ${mitHaekchen.id}`
			)
		).rejects.toThrow(/agenda_item_verwaltungsangabe_werte/);
	});
});

describe('E3: vorab erfasste Vollmacht und Häkchen beim Einlass durch Dritte', () => {
	it('übernimmt die vorab erfasste Vollmacht auch bei anderer Schreibung des Namens', async () => {
		const a = await versammlung('E3 Einlass vorab, Schreibung', '2028-10-02');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		const e = await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: '  grosse  verwaltung ag ',
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		expect(e.eingelassen).toHaveLength(1);
		const [v] = await holeVollmachten(betreiber, a.versammlung);
		expect(v).toMatchObject({ zustand: 'bestaetigt', istVerwaltung: true });
	});

	it('Gegenprobe: weist eine andere Person an einer vorab erfassten Vollmacht ab', async () => {
		const a = await versammlung('E3 Einlass vorab, andere Person', '2028-10-03');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		const fehler = await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'Erika Beispiel',
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		}).catch((f) => f);
		expect(fehler).toMatchObject({ kennung: 'anderer_vertreter' });
		const [v] = await holeVollmachten(betreiber, a.versammlung);
		expect(v.zustand).toBe('erfasst');
	});

	it('entfernt das abgewählte Häkchen am ganzen Namen, auch an einer neu erfassten Zeile', async () => {
		// Die Verwaltung ist mit Häkchen für Hans Probe da; am Einlass für Kurt
		// stellt sich heraus, dass sie nicht als Verwaltung handelt. Ohne das
		// Entfernen nach dem Bestätigen übernähme die neue Zeile das Häkchen
		// der bestätigten Schwester wieder (B3).
		const a = await versammlung('E3 Häkchen abgewählt', '2028-10-04');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			nachweisVorgelegt: true
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![2]],
			nachweisVorgelegt: true,
			istVerwaltung: false
		});
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
		expect(alle.every((v) => v.zustand === 'bestaetigt' && !v.istVerwaltung)).toBe(true);
		expect(await holeVerwaltungsausstand(betreiber, a.versammlung, a.traktandum)).toEqual([]);
	});

	it('übernimmt an einer neuen Zeile ohne Angabe das Häkchen, das der Name gerade trägt (M1)', async () => {
		// Die Maske gibt bei einem unberührten vorbelegten Kästchen nichts an;
		// die neue Zeile richtet sich nach dem Stand der Datenbank, nicht nach
		// der Seite. Auch eine nur erfasste Schwester zählt.
		const a = await versammlung('E3 Häkchen geerbt', '2028-10-06');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1]],
			istVerwaltung: true
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: 'grosse verwaltung ag',
			vertritt: [a.moment![2]],
			nachweisVorgelegt: true
		});
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle).toHaveLength(2);
		expect(alle.every((v) => v.istVerwaltung)).toBe(true);
	});

	it('Gegenprobe: ein Einlass ohne die Angabe lässt das Häkchen des Namens stehen (B1)', async () => {
		const a = await versammlung('E3 Häkchen ohne Angabe', '2028-10-05');
		await gibFrei(a);
		await eroeffneVersammlung(handelnder(betreiber), a.versammlung);
		await erfasseVollmachten(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1], a.moment![2]],
			istVerwaltung: true
		});
		await lasseDurchDritteEin(handelnder(betreiber), a.versammlung, {
			bevollmaechtigtName: VERWALTUNG,
			vertritt: [a.moment![1], a.moment![2]],
			nachweisVorgelegt: true
		});
		const alle = await holeVollmachten(betreiber, a.versammlung);
		expect(alle.every((v) => v.zustand === 'bestaetigt' && v.istVerwaltung)).toBe(true);
	});
});
