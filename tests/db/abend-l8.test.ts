/**
 * Die Zeilen zu L8 im gemeinsamen Abenddokument (Codeprüfung P11, H1,
 * 08.11.2026).
 *
 * **Der Anlass:** Am gemeinsamen Abend gibt es kein eigenes Hausprotokoll;
 * das Abenddokument ist das Protokoll. Es trug keine der Zeilen zu L8, die
 * das Hausprotokoll trägt: dass die Vollmachten der Verwaltung ruhten
 * (Entscheid 3), Wahl und Abberufung trotz Häkchen (Entscheid 8, Entscheid
 * 0045, Punkt 9) und die Angabe der Leitung am Folgeantrag (Punkt 11). Die
 * Tag-Leitung bietet die Angabe an und sagt dazu «das Protokoll nennt Ihre
 * Angabe»; am Abend nannte sie kein Dokument.
 *
 * Je Fall wird die Zeile des Abenddokuments mit dem Satz verglichen, den das
 * Hausprotokoll derselben Versammlung schreibt (`stelleEntwurfZusammen`),
 * ohne Eigentümernamen, wie die übrigen Zeilen des Abenddokuments.
 *
 * Aufbau wie `abend-folgeantraege.test.ts`: zwei Häuser unter einem Punkt,
 * der Grundantrag ist die Entlastung (`k-decharge`), im ersten Haus mit dem
 * Häkchen «Geschäft der Verwaltung». Drei Eigentümer zu 400, 300 und 300
 * von 1000; im ersten Haus ist Hans Probe nur über die Grosse Verwaltung AG
 * da. Alle Namen sind erfunden.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleEinheit } from '$lib/server/einheiten';
import { erstelleEigentuemer, ordneEigentumZu } from '$lib/server/eigentuemer';
import { eroeffneVersammlung, erstelleVersammlung, schliesseVersammlung } from '$lib/server/versammlungen';
import { erstelleVersammlungstag, nimmInTagAuf } from '$lib/server/versammlungstag';
import { erstelleGeschaeft } from '$lib/server/geschaeft';
import { gibVersammlungFrei } from '$lib/server/freigabe';
import {
	bearbeiteTraktandum,
	holeTraktanden,
	nimmTraktandumAuf,
	setzeGewaehltesErfordernis
} from '$lib/server/traktanden';
import { stelleEntwurfZusammen } from '$lib/server/protokoll';
import { bestaetigeAnwesenheit, lasseDurchDritteEin } from '$lib/server/anwesenheit';
import { erklaereAusstand } from '$lib/server/ausstand';
import { erfasseVollmachten, holeParteien } from '$lib/server/vollmacht';
import { gibStimmenAb, holeErgebnis, oeffneAbstimmung, schliesseAbstimmung } from '$lib/server/abstimmung';
import { speichereLesarten } from '$lib/server/lesarten';
import { gibVerwaltungsangabe } from '$lib/server/verwaltungsangabe';
import { stelleAbendzusammenstellungZusammen } from '$lib/server/gemeinsamesprotokoll';
import { andereLesartInWorten } from '$lib/domain/auszaehlung';
import { vertreterkennung } from '$lib/domain/vollmacht';
import {
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL,
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL
} from '$lib/domain/mehrhinweise';
import { pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let benutzer: string;
const h = () => ({ operatorId: betreiber, userId: benutzer, label: 'Prüflauf' });
const LEITUNG = 'Prüflauf: von der Sitzungsleitung erfasst';
const VERWALTUNG = 'Grosse Verwaltung AG';
const TITEL = 'Entlastung der Verwaltung';
const NAMEN = /Hans Probe|Erika Beispiel|Kurt Beispiel/;

/** Die Sätze zu L8, die das Protokoll führen kann, ausser der Zeile zum Ruhen. */
const L8_SAETZE = [
	VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL,
	VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_PROTOKOLL,
	VERWALTUNG_ANGABE_ANDERE_AUSSTAND_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL,
	VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL
];
const RUHEN_MIT_NAMEN =
	/Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung\. Für (eine vertretene Partei|\d+ vertretene Parteien) \(([^)]*)\) zählte deshalb keine Stimme\./;
const RUHEN = 'Bei diesem Traktandum ruhten nach der Einstellung der Gemeinschaft die Vollmachten der Verwaltung.';

beforeAll(async () => {
	betreiber = await pruefbetreiber('Abend L8');
	benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
});
afterAll(verbindungenSchliessen);

const leer = (s: string) => s.replace(/\s+/g, ' ');

async function haus(name: string, datum: string, tagId: string, stelle: number, wahlL8: 'ruhen' | 'leitung') {
	const g = await erstelleGemeinschaft(h(), {
		name,
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	if (wahlL8 === 'leitung') await speichereLesarten(h(), 'admin', g.id, { L8: 'leitung', L11: 'qualifiziert', L12: 'alle', L13: 'anwesende' });
	const parteien: string[] = [];
	for (const [i, q] of [400, 300, 300].entries()) {
		const e = await erstelleEinheit(h(), {
			stwegId: g.id,
			kind: 'unit',
			label: `Whg ${i + 1}`,
			quotas: { stamm: q },
			countsAsHead: true
		});
		const p = await erstelleEigentuemer(h(), {
			stwegId: g.id,
			kind: 'natural',
			displayName: ['Erika Beispiel', 'Hans Probe', 'Kurt Beispiel'][i],
			isCommunity: false,
			representativeName: null
		});
		await ordneEigentumZu(h(), e.id, p.id, '2020-01-01');
		parteien.push(p.id);
	}
	const v = await erstelleVersammlung(h(), {
		stwegId: g.id,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'gefuehrt'
	});
	await nimmInTagAuf(h(), tagId, v.id, stelle);
	return { gemeinschaft: g.id, name, versammlung: v.id, parteien };
}

type Haus = Awaited<ReturnType<typeof haus>>;

/**
 * Der Abend mit zwei Häusern unter einem Punkt, eröffnet. Im ersten Haus
 * das Häkchen, wenn `haekchen` sagt, und Hans Probe nur über die Verwaltung.
 */
async function abend(name: string, datum: string, o: { haekchen?: boolean; wahlL8?: 'ruhen' | 'leitung' } = {}) {
	const haekchen = o.haekchen ?? true;
	const tag = await erstelleVersammlungstag(h(), {
		bezeichnung: `${name}, Abend`,
		datum,
		uhrzeit: '19:00',
		ort: 'Prüfsaal',
		art: 'ordentlich'
	});
	const a = await haus(`${name} A`, datum, tag.id, 0, o.wahlL8 ?? 'ruhen');
	const b = await haus(`${name} B`, datum, tag.id, 1, 'ruhen');
	await erstelleGeschaeft(h(), tag.id, {
		titel: TITEL,
		antragswortlaut: 'Die Verwaltung wird entlastet.',
		art: 'abstimmung',
		meetingIds: [a.versammlung, b.versammlung]
	});
	const grund: Record<string, string> = {};
	for (const x of [a, b]) {
		grund[x.versammlung] = (await holeTraktanden(betreiber, x.versammlung)).find(
			(t) => t.knoten.titel === TITEL
		)!.knoten.id;
		await bearbeiteTraktandum(
			h(),
			x.versammlung,
			grund[x.versammlung],
			{
				meetingId: x.versammlung,
				titel: TITEL,
				art: 'abstimmung',
				antragswortlaut: 'Die Verwaltung wird entlastet.',
				antragstellerart: 'bewirtschaftung',
				betroffeneParteiIds: [],
				verwaltungsGeschaeft: x === a && haekchen
			},
			'k-decharge'
		);
		await setzeGewaehltesErfordernis(
			h(),
			{ meetingId: x.versammlung, stwegId: x.gemeinschaft },
			grund[x.versammlung],
			'k-decharge',
			null
		);
		await gibVersammlungFrei(h(), x.versammlung);
		await eroeffneVersammlung(h(), x.versammlung);
	}
	const moment = await holeParteien(betreiber, a.versammlung);
	const vertreten = moment.find((p) => p.parteiId === a.parteien[1])!.id;
	await erfasseVollmachten(h(), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [vertreten],
		istVerwaltung: true
	});
	await lasseDurchDritteEin(h(), a.versammlung, {
		bevollmaechtigtName: VERWALTUNG,
		vertritt: [vertreten],
		nachweisVorgelegt: true
	});
	for (const p of [a.parteien[0], a.parteien[2]]) await bestaetigeAnwesenheit(h(), a.versammlung, p, 'von_hand');
	for (const p of b.parteien) await bestaetigeAnwesenheit(h(), b.versammlung, p, 'von_hand');

	return {
		tag: tag.id,
		a,
		b,
		grund: grund[a.versammlung],
		folgeantrag: (titel: string, knoten: string) => folgeantrag(a, grund[a.versammlung], titel, knoten),
		/** Erika Beispiel, Hans Probe über die Verwaltung (wenn sie darf) und Kurt Beispiel. */
		stimme: (traktandumId: string, w: ['yes' | 'no', 'yes' | 'no' | null, 'yes' | 'no']) =>
			stimme(
				a.versammlung,
				traktandumId,
				a.parteien
					.map((parteiId, i) => ({ parteiId, wahl: w[i] }))
					.filter((x): x is { parteiId: string; wahl: 'yes' | 'no' } => x.wahl !== null)
			),
		/** Schliesst beide Häuser und liefert Abenddokument und Hausprotokoll des ersten Hauses. */
		texte: async () => {
			for (const x of [a, b]) await schliesseVersammlung(h(), x.versammlung);
			const z = (await stelleAbendzusammenstellungZusammen(betreiber, tag.id, `${datum}T21:00:00.000Z`, 'Prüferin'))!;
			const hausA = await stelleEntwurfZusammen(betreiber, a.versammlung, new Date().toISOString(), 'Prüflauf');
			const nummern = new Map((await holeTraktanden(betreiber, a.versammlung)).map((t) => [t.knoten.id, t.nummer]));
			return { abend: z.text, hausA, nummern };
		}
	};
}

async function stimme(meetingId: string, traktandumId: string, abgaben: { parteiId: string; wahl: 'yes' | 'no' }[]) {
	await oeffneAbstimmung(h(), meetingId, traktandumId);
	await gibStimmenAb(h(), meetingId, abgaben, true, LEITUNG);
	return schliesseAbstimmung(h(), meetingId);
}

async function folgeantrag(a: Haus, grund: string, titel: string, knoten: string) {
	const f = await nimmTraktandumAuf(
		h(),
		{
			meetingId: a.versammlung,
			parentId: grund,
			titel,
			art: 'abstimmung',
			antragswortlaut: `${titel}: wie beantragt.`,
			antragstellerart: 'bewirtschaftung',
			antragstellerId: null,
			antragstellerIds: [],
			betroffeneParteiIds: []
		},
		'folgeantrag'
	);
	await setzeGewaehltesErfordernis(h(), { meetingId: a.versammlung, stwegId: a.gemeinschaft }, f.id, knoten, null);
	return f.id;
}

/** Ein Block des Abenddokuments unter einer Überschrift, bis zur nächsten. */
function block(text: string, ueberschrift: string): string {
	const von = text.indexOf(`${ueberschrift}\n`);
	expect(von, ueberschrift).toBeGreaterThanOrEqual(0);
	const bis = text.indexOf('\n#', von + ueberschrift.length);
	return leer(text.slice(von, bis < 0 ? undefined : bis));
}

/** Die Zeile des ersten Hauses zum Punkt der Entlastung im Abenddokument. */
function hauszeile(text: string, name: string): string {
	const von = text.indexOf(`${TITEL}\n`);
	expect(von).toBeGreaterThanOrEqual(0);
	const bis = text.indexOf('\n## ', von);
	const punkt = text.slice(von, bis < 0 ? undefined : bis);
	const n = new RegExp(`^### (\\d+)\\.1 ${name} A$`, 'm').exec(punkt)?.[1];
	expect(n, punkt).toBeDefined();
	return block(punkt, `### ${n}.1 ${name} A`);
}

/** Der Abschnitt eines Traktandums im Hausprotokoll, bis zur nächsten Überschrift. */
function hausabschnitt(text: string, nummer: string, titel: string): string {
	const m = new RegExp(`^#+ ${nummer.replace(/\./g, '\\.')} ${titel}$`, 'm').exec(text);
	expect(m, `${nummer} ${titel}`).not.toBeNull();
	const bis = text.indexOf('\n#', m!.index + m![0].length);
	return leer(text.slice(m!.index, bis < 0 ? undefined : bis));
}

/**
 * Die Zeilen zu L8 eines Abschnitts. Die Zeile zum Ruhen in der Fassung des
 * Abenddokuments: Das Hausprotokoll nennt die Vertretenen beim Namen, das
 * Abenddokument nur ihre Zahl.
 */
function l8Zeilen(abschnitt: string): string[] {
	const zeilen = L8_SAETZE.filter((s) => abschnitt.includes(s));
	const ruhen = RUHEN_MIT_NAMEN.exec(abschnitt);
	if (ruhen) zeilen.push(`${RUHEN} Für ${ruhen[1]} zählte deshalb keine Stimme.`);
	else if (abschnitt.includes(RUHEN)) {
		zeilen.push(abschnitt.slice(abschnitt.indexOf(RUHEN)).split('Stimme.')[0] + 'Stimme.');
	}
	return zeilen;
}

/** Abenddokument und Hausprotokoll tragen zu einem Antrag dieselben Zeilen zu L8, ohne Namen. */
function gleicheL8Zeilen(abendblock: string, hausblock: string, erwartet: string[]) {
	expect(l8Zeilen(hausblock)).toEqual(erwartet);
	expect(l8Zeilen(abendblock)).toEqual(erwartet);
	expect(abendblock).not.toMatch(NAMEN);
}

const RUHEN_EINE = `${RUHEN} Für eine vertretene Partei zählte deshalb keine Stimme.`;

describe('Abenddokument: die Zeilen zu L8 wie im Hausprotokoll (Codeprüfung P11, H1)', () => {
	it('Ruhen am Grundantrag: die Tatsache mit der Zahl der Vertretenen, ohne Namen', async () => {
		const r = await abend('Ruheweg 1', '2029-02-01');
		await r.stimme(r.grund, ['yes', null, 'yes']);
		const { abend: text, hausA, nummern } = await r.texte();
		const haus = hausabschnitt(hausA, nummern.get(r.grund)!, TITEL);
		// Das Hausprotokoll nennt den Namen, das Abenddokument die Zahl.
		expect(haus).toContain(`${RUHEN} Für eine vertretene Partei (Hans Probe) zählte deshalb keine Stimme.`);
		const zeile = hauszeile(text, 'Ruheweg 1');
		expect(zeile).toContain(`- ${RUHEN_EINE}`);
		gleicheL8Zeilen(zeile, haus, [RUHEN_EINE]);
		// Unter dem Zahlenteil, vor dem Erfordernis, wie im Hausprotokoll.
		expect(zeile.indexOf(RUHEN_EINE)).toBeLessThan(zeile.indexOf('Angewandtes Erfordernis'));
		// Das zweite Haus ohne Häkchen trägt keine Zeile.
		expect(leer(text).split(RUHEN)).toHaveLength(2);
	});

	it('Wiederwahl als Folgeantrag: «Wahl trotz Häkchen»; am Folgeantrag zur Entschädigung ruhen die Vollmachten', async () => {
		const r = await abend('Ruheweg 2', '2029-02-02');
		const wahl = await r.folgeantrag('Wiederwahl', 'k-bewirtschaftung-waehlen');
		const geld = await r.folgeantrag('Entschädigung', 'k-verwaltung-gewoehnlich');
		await r.stimme(wahl, ['yes', 'yes', 'yes']);
		await r.stimme(geld, ['yes', null, 'yes']);
		const { abend: text, hausA, nummern } = await r.texte();

		const wahlAbend = block(text, `#### Folgeantrag ${nummern.get(wahl)} «Wiederwahl»`);
		expect(wahlAbend).toContain(VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL);
		gleicheL8Zeilen(wahlAbend, hausabschnitt(hausA, nummern.get(wahl)!, 'Wiederwahl'), [
			VERWALTUNG_WAHL_TROTZ_HAKEN_PROTOKOLL
		]);

		const geldAbend = block(text, `#### Folgeantrag ${nummern.get(geld)} «Entschädigung»`);
		gleicheL8Zeilen(geldAbend, hausabschnitt(hausA, nummern.get(geld)!, 'Entschädigung'), [RUHEN_EINE]);

		// Der gegenstandslose Grundantrag trägt keine Zeile zu L8.
		expect(l8Zeilen(hauszeile(text, 'Ruheweg 2'))).toEqual([]);
	});

	it('Abberufung als Folgeantrag ohne erklärten Ausstand: die Zeile wie im Hausprotokoll', async () => {
		const r = await abend('Ruheweg 3', '2029-02-03');
		const ab = await r.folgeantrag('Abberufung', 'k-bewirtschaftung-abberufen');
		await r.stimme(ab, ['yes', 'yes', 'no']);
		const { abend: text, hausA, nummern } = await r.texte();
		const abAbend = block(text, `#### Folgeantrag ${nummern.get(ab)} «Abberufung»`);
		expect(abAbend).toContain(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL);
		gleicheL8Zeilen(abAbend, hausabschnitt(hausA, nummern.get(ab)!, 'Abberufung'), [
			VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL
		]);
	});

	it('Abberufung als Folgeantrag mit erklärtem Ausstand: die Zeile zum Ausstand, aus dem eingefrorenen Durchgang', async () => {
		const r = await abend('Ruheweg 4', '2029-02-04');
		const ab = await r.folgeantrag('Abberufung', 'k-bewirtschaftung-abberufen');
		await erklaereAusstand(h(), r.a.versammlung, ab, vertreterkennung(VERWALTUNG), 'Die Verwaltung verlässt den Raum.');
		await r.stimme(ab, ['yes', null, 'no']);
		const { abend: text, hausA, nummern } = await r.texte();
		const abAbend = block(text, `#### Folgeantrag ${nummern.get(ab)} «Abberufung»`);
		expect(abAbend).toContain(VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL);
		expect(abAbend).not.toContain(VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL);
		gleicheL8Zeilen(abAbend, hausabschnitt(hausA, nummern.get(ab)!, 'Abberufung'), [
			VERWALTUNG_ABBERUFUNG_AUSSTAND_PROTOKOLL
		]);
	});

	it('Angabe «andere Verwaltung» am Folgeantrag: die Zeile zur Angabe, kein Ruhen', async () => {
		const r = await abend('Ruheweg 5', '2029-02-05');
		const wahl = await r.folgeantrag('Wahl der Neu Verwaltung GmbH', 'k-bewirtschaftung-waehlen');
		await r.stimme(wahl, ['yes', 'yes', 'yes']);
		const geld = await r.folgeantrag('Entschädigung der Neu Verwaltung GmbH', 'k-decharge');
		await gibVerwaltungsangabe(h(), r.a.versammlung, geld, 'andere_verwaltung');
		await r.stimme(geld, ['yes', 'yes', 'yes']);
		const { abend: text, hausA, nummern } = await r.texte();
		const geldAbend = block(text, `#### Folgeantrag ${nummern.get(geld)} «Entschädigung der Neu Verwaltung GmbH»`);
		expect(geldAbend).toContain(VERWALTUNG_ANGABE_ANDERE_PROTOKOLL);
		gleicheL8Zeilen(
			geldAbend,
			hausabschnitt(hausA, nummern.get(geld)!, 'Entschädigung der Neu Verwaltung GmbH'),
			[VERWALTUNG_ANGABE_ANDERE_PROTOKOLL]
		);
	});

	it('Angabe «Kündigung» am Folgeantrag nach abgelehnter Abberufung: die Zeile zur Kündigung', async () => {
		const r = await abend('Ruheweg 6', '2029-02-06');
		const ab = await r.folgeantrag('Abberufung', 'k-bewirtschaftung-abberufen');
		await r.stimme(ab, ['no', 'no', 'no']);
		const vertrag = await r.folgeantrag('Kündigung des Verwaltungsvertrags', 'k-decharge');
		await gibVerwaltungsangabe(h(), r.a.versammlung, vertrag, 'kuendigung');
		await r.stimme(vertrag, ['yes', 'yes', 'yes']);
		const { abend: text, hausA, nummern } = await r.texte();
		const vertragAbend = block(text, `#### Folgeantrag ${nummern.get(vertrag)} «Kündigung des Verwaltungsvertrags»`);
		expect(vertragAbend).toContain(VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL);
		gleicheL8Zeilen(
			vertragAbend,
			hausabschnitt(hausA, nummern.get(vertrag)!, 'Kündigung des Verwaltungsvertrags'),
			[VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL]
		);
		gleicheL8Zeilen(
			block(text, `#### Folgeantrag ${nummern.get(ab)} «Abberufung»`),
			hausabschnitt(hausA, nummern.get(ab)!, 'Abberufung'),
			[VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_PROTOKOLL]
		);
	});

	it('Angabe «Kündigung» mit erklärtem Ausstand: die Zeile zum Ausstand und die Tatsache, dass die Vollmacht ruhte', async () => {
		const r = await abend('Ruheweg 7', '2029-02-07');
		const ab = await r.folgeantrag('Abberufung', 'k-bewirtschaftung-abberufen');
		await r.stimme(ab, ['no', 'no', 'no']);
		const vertrag = await r.folgeantrag('Kündigung des Verwaltungsvertrags', 'k-decharge');
		await gibVerwaltungsangabe(h(), r.a.versammlung, vertrag, 'kuendigung');
		await erklaereAusstand(h(), r.a.versammlung, vertrag, vertreterkennung(VERWALTUNG), 'Die Verwaltung verlässt den Raum.');
		await r.stimme(vertrag, ['yes', null, 'yes']);
		const { abend: text, hausA, nummern } = await r.texte();
		const vertragAbend = block(text, `#### Folgeantrag ${nummern.get(vertrag)} «Kündigung des Verwaltungsvertrags»`);
		expect(vertragAbend).toContain(VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL);
		expect(vertragAbend).not.toContain(VERWALTUNG_ANGABE_KUENDIGUNG_PROTOKOLL);
		const haus = hausabschnitt(hausA, nummern.get(vertrag)!, 'Kündigung des Verwaltungsvertrags');
		expect(l8Zeilen(vertragAbend)).toEqual(l8Zeilen(haus));
		expect(l8Zeilen(vertragAbend)).toContain(VERWALTUNG_ANGABE_KUENDIGUNG_AUSSTAND_PROTOKOLL);
	});

	it('Gegenrichtung: ohne Häkchen keine Zeile zu L8, weder im Abenddokument noch im Hausprotokoll', async () => {
		const r = await abend('Ruheweg 8', '2029-02-08', { haekchen: false });
		const wahl = await r.folgeantrag('Wiederwahl', 'k-bewirtschaftung-waehlen');
		const ab = await r.folgeantrag('Abberufung', 'k-bewirtschaftung-abberufen');
		const geld = await r.folgeantrag('Entschädigung', 'k-decharge');
		await r.stimme(wahl, ['yes', 'yes', 'yes']);
		await r.stimme(ab, ['no', 'no', 'no']);
		await r.stimme(geld, ['yes', 'yes', 'yes']);
		const { abend: text, hausA } = await r.texte();
		expect(l8Zeilen(leer(text))).toEqual([]);
		expect(l8Zeilen(leer(hausA))).toEqual([]);
	});
});

describe('Abenddokument: das zweite Ergebnis zu L8 wie im Hausprotokoll (Codeprüfung P11, H1)', () => {
	const ANDERE = 'Nach der anderen Lesart («Vollmachten ruhen';

	it('unter «Die Sitzungsleitung entscheidet» bei gleichem Ergebnis keine Zeile, wie im Hausprotokoll', async () => {
		const r = await abend('Ruheweg 9', '2029-02-09', { wahlL8: 'leitung' });
		const d = await r.stimme(r.grund, ['yes', 'yes', 'yes']);
		const zweites = (await holeErgebnis(betreiber, r.a.versammlung, d.id)).auszaehlung?.andereVerwaltungsvollmacht;
		// Die Rechnung kennt das zweite Ergebnis; es weicht nicht ab.
		expect(zweites).toMatchObject({ feststellbar: true, abweichend: false });
		const { abend: text, hausA, nummern } = await r.texte();
		expect(hausabschnitt(hausA, nummern.get(r.grund)!, TITEL)).not.toContain(ANDERE);
		const zeile = hauszeile(text, 'Ruheweg 9');
		expect(zeile).not.toContain(ANDERE);
		// Unter «leitung» ruht nichts von selbst.
		expect(l8Zeilen(zeile)).toEqual([]);
	});

	it('unter «Die Sitzungsleitung entscheidet» bei abweichendem Ergebnis derselbe Satz wie im Hausprotokoll', async () => {
		const r = await abend('Ruheweg 10', '2029-02-10', { wahlL8: 'leitung' });
		// Die Verwaltung gibt für Hans Probe die entscheidende Stimme: Ohne sie
		// stünde 1 Ja gegen 1 Nein.
		const d = await r.stimme(r.grund, ['yes', 'yes', 'no']);
		const zweites = (await holeErgebnis(betreiber, r.a.versammlung, d.id)).auszaehlung?.andereVerwaltungsvollmacht;
		const satz = zweites ? andereLesartInWorten(zweites, false).protokoll : null;
		expect(zweites?.abweichend || zweites?.feststellbar === false, JSON.stringify(zweites)).toBe(true);
		expect(satz).not.toBeNull();
		const { abend: text, hausA, nummern } = await r.texte();
		expect(hausabschnitt(hausA, nummern.get(r.grund)!, TITEL)).toContain(leer(satz!));
		expect(hauszeile(text, 'Ruheweg 10')).toContain(leer(satz!));
	});
});
