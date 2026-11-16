/**
 * L13 auf Papier: Auswertung-PDF und Stimmnachweis drucken die Zeile zur
 * Zählweise der Köpfe und das zweite Ergebnis nach der anderen Zählweise
 * (DeepSeek-Review Regel 43, B4). Bis hierher sahen nur Wächter die
 * Zeichenketten in den Dateien; fiel der Druck weg, blieben sie grün.
 *
 * **Ohne Datenbank.** Die Zeile `lesart` setzt `holeAuswertung`
 * (`server/auswertung.ts`) aus `lesartProtokollsatz`,
 * `kopfzaehlweiseProtokollsatz` und `einsprachelesartProtokollsatz` zusammen;
 * dieser Test baut sie gleich und prüft, was die beiden Erzeuger daraus
 * drucken. Ob `holeAuswertung` die Zeile liefert, prüft der Protokolltest in
 * `tests/db/lesart-kopfzaehlweise.test.ts`.
 *
 * Zehn erfundene Eigentümer, sieben da, fünf Ja und zwei Nein, an den
 * notwendigen baulichen Massnahmen (Art. 647c): unter den Anwesenden
 * angenommen, unter allen nicht.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { erzeugeAuswertung, type Auswertungsangaben, type Auswertungszeile } from '$lib/server/pdf/auswertung';
import { erzeugeStimmnachweis, type Stimmnachweisangaben } from '$lib/server/pdf/stimmnachweis';
import {
	andereLesartenVon,
	andereLesartInWorten,
	kopfzaehlweiseProtokollsatz,
	lesartProtokollsatz,
	zaehleAus,
	zweitesErgebnisImProtokoll
} from '$lib/domain/auszaehlung';
import { erfordernisAusKnoten, type Erfordernis } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, type Lesartenwahl } from '$lib/domain/lesarten';
import { wendeReglementAn } from '$lib/domain/reglement';
import { holeRegelwerk } from '$lib/rules';
import type { Snapshot, Vote } from '$lib/domain/types';
import { textVonSeite } from '../db/pdftext';

const RW = holeRegelwerk('2026-11-14');

const M: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-11-20T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: false,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: Array.from({ length: 10 }, (_, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Erfunden ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `p${i + 1}-u`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota: 100 }]
	}))
};
const DA = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const STIMMEN: Vote[] = (['yes', 'yes', 'yes', 'yes', 'yes', 'no', 'no'] as const).map((choice, i) => ({
	partyId: `p${i + 1}`,
	unitId: `p${i + 1}-u`,
	choice,
	castAt: '2026-11-20T19:10:00.000Z',
	recordedByChair: false
}));

function hergeleitet(wahl: Lesartenwahl): Erfordernis {
	const k = RW.knoten.find((x) => x.id === 'k-baulich-notwendig')!;
	return wendeReglementAn(erfordernisAusKnoten(RW, k), [], null, wahl).erfordernis;
}

function zeileZu(e: Erfordernis): Auswertungszeile {
	const a = zaehleAus({ momentaufnahme: M, erfordernis: e, stimmen: STIMMEN, anwesende: DA, imAusstand: [] });
	return {
		nummer: '4',
		tiefe: 1,
		titel: 'Dachsanierung',
		art: 'abstimmung',
		spontan: false,
		durchgang: 1,
		frueherenDurchgaenge: 0,
		erfordernis: e.titel,
		rechtsgrundlage: e.rechtsgrundlage,
		satz: a.angenommen ? 'Angenommen.' : 'Abgelehnt.',
		protokollsatz: a.angenommen ? 'Angenommen.' : 'Abgelehnt.',
		satzOhneNamen: a.angenommen ? 'Angenommen.' : 'Abgelehnt.',
		auszaehlung: a,
		stichentscheid: null,
		// Wie `holeAuswertung`: das Mehr, dahinter L13 (die Einsprache gibt es hier nicht).
		lesart: [lesartProtokollsatz(e), kopfzaehlweiseProtokollsatz(e)].filter((s): s is string => s !== null).join(' ') || null
	} as unknown as Auswertungszeile;
}

async function textVon(bytes: Uint8Array): Promise<string> {
	const seiten = (await PDFDocument.load(bytes)).getPageCount();
	const teile = await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i)));
	return teile.join(' ').replace(/\s+/g, ' ');
}

async function beideBlaetter(e: Erfordernis): Promise<{ auswertung: string; nachweis: string; zeile: Auswertungszeile }> {
	const zeile = zeileZu(e);
	const versammlung = { datum: '2026-11-20', uhrzeit: '19:00', ort: 'Gemeindesaal' };
	const auswertung = await erzeugeAuswertung({
		versammlung,
		gemeinschaftName: 'Erfundenweg 7',
		zaehlweise: null,
		stichentscheid: null,
		erzeugtAm: '20. November 2026, 21:30',
		zeilen: [zeile]
	} as unknown as Auswertungsangaben);
	const nachweis = await erzeugeStimmnachweis({
		gemeinschaftName: 'Erfundenweg 7',
		versammlung,
		zaehlweise: null,
		zeile,
		stimmen: [],
		parteiwahlen: null,
		pfadImPaket: 'stimmnachweise/traktandum-4.pdf',
		erzeugtAm: '20. November 2026, 21:30'
	} as unknown as Stimmnachweisangaben);
	return { auswertung: await textVon(auswertung), nachweis: await textVon(nachweis), zeile };
}

/** Der Satz zum zweiten Ergebnis nach L13, wie das Protokoll ihn schreibt. */
function zweitesErgebnisL13(zeile: Auswertungszeile): string {
	const a = zeile.auszaehlung!;
	const r = andereLesartenVon(a)
		.filter(zweitesErgebnisImProtokoll)
		.find((x) => x.kennung === 'L13');
	const satz = r ? andereLesartInWorten(r, a.geheim).protokoll : null;
	if (!satz) throw new Error('kein zweites Ergebnis nach L13');
	return satz;
}

describe('L13 in Auswertung-PDF und Stimmnachweis (B4)', () => {
	it.each([
		['Alle Eigentümer', { ...LESARTEN_VORGABE, L13: 'alle' } as Lesartenwahl, 'Köpfe gezählt unter allen Eigentümern'],
		['Vorgabe', LESARTEN_VORGABE, 'Köpfe gezählt unter den Anwesenden und Vertretenen']
	])('unter «%s»: die Zeile zur Zählweise und das zweite Ergebnis stehen auf beiden Blättern', async (_, wahl, zeilenanfang) => {
		const { auswertung, nachweis, zeile } = await beideBlaetter(hergeleitet(wahl));
		expect(zeile.lesart).toContain(zeilenanfang);
		expect(auswertung).toContain(zeilenanfang);
		expect(nachweis).toContain(zeilenanfang);
		// Der ganze Satz samt Ausgang und Zahlen (Codeprüfung M3, Lauf 2, L2-1). Der
		// Satz bricht im Blatt um; Silbentrennung gibt es nicht, also genügt es, den
		// Leerraum auf beiden Seiten zu vereinheitlichen.
		const eben = (s: string) => s.replace(/\s+/g, ' ');
		const zweites = eben(zweitesErgebnisL13(zeile));
		expect(zweites).toMatch(/wäre der Antrag (angenommen|abgelehnt) gewesen: \d+ Ja von \d+ Kopfstimmen/);
		expect(eben(auswertung)).toContain(zweites);
		expect(eben(nachweis)).toContain(zweites);
	});
});
