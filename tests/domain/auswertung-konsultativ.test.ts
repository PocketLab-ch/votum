/**
 * Frühere konsultative Durchgänge im Auswertungs-PDF (Pendenz aus Block 7,
 * Review DeepSeek am Rand). `konsultativFrueher` trug seit Block 7 den Grund
 * nach L5, landete im PDF aber nirgends; das Protokoll nennt ihn. Das PDF
 * nimmt seither denselben Satz wie das Protokoll, ohne zweiten Wortlaut.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { erzeugeAuswertung, type Auswertungsangaben } from '$lib/server/pdf/auswertung';
import { zaehleAus } from '$lib/domain/auszaehlung';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import type { Snapshot } from '$lib/domain/types';
import { textVonSeite } from '../db/pdftext';

const EINFACH: Erfordernis = {
	fassung: '2026-10-29',
	juristischGegengelesen: false,
	astId: 'a-verwaltung',
	knotenId: 'k-verwaltung',
	typ: 'einfaches_mehr',
	titel: 'Einfaches Mehr',
	rechtsgrundlage: 'ZGB Art. 647a Abs. 1',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
	quotenSchwelle: null,
	zustimmungBetroffenerNoetig: false,
	pfad: [],
	quelle: 'hergeleitet'
};

const ZWEI: Snapshot = {
	meetingId: 'v-1',
	takenAt: '2026-10-29T17:00:00.000Z',
	headCountMode: 'per_owner',
	parkingCountsAsHead: true,
	headCountRuleSource: null,
	tieBreak: 'keiner',
	totalQuota: 1000,
	parties: [600, 400].map((quota, i) => ({
		partyId: `p${i + 1}`,
		displayName: `Erfunden ${i + 1}`,
		representativeName: null,
		isCommunity: false,
		units: [{ unitId: `u${i + 1}`, label: `Whg ${i + 1}`, kind: 'unit' as const, countsAsHead: true, quota }]
	}))
};

async function pdfText(neuAnZweiter: boolean, frueherenDurchgaenge = 1): Promise<string> {
	const a = zaehleAus({
		momentaufnahme: ZWEI,
		erfordernis: EINFACH,
		stimmen: [
			{ partyId: 'p1', unitId: 'u1', choice: 'yes', castAt: '2026-10-29T19:10:00.000Z', recordedByChair: false },
			{ partyId: 'p2', unitId: 'u2', choice: 'no', castAt: '2026-10-29T19:10:00.000Z', recordedByChair: false }
		],
		anwesende: ['p1', 'p2']
	});
	const angaben = {
		versammlung: { datum: '2026-11-20', uhrzeit: '19:00', ort: 'Gemeindesaal' },
		gemeinschaftName: 'Erfundenweg 7',
		zaehlweise: null,
		stichentscheid: null,
		erzeugtAm: '20. November 2026, 21:30',
		zeilen: [
			{
				nummer: '3',
				tiefe: 1,
				titel: 'Neue Heizung',
				art: 'abstimmung',
				spontan: false,
				durchgang: 2,
				frueherenDurchgaenge,
				erfordernis: 'Einfaches Mehr',
				rechtsgrundlage: 'ZGB Art. 647a Abs. 1',
				satz: 'Angenommen.',
				protokollsatz: 'Angenommen.',
				satzOhneNamen: 'Angenommen.',
				auszaehlung: a,
				stichentscheid: null,
				konsultativFrueher: [{ nummer: 1, neuAnZweiter, zahlen: { koepfe: a.koepfe, quoten: null } }]
			}
		]
	} as unknown as Auswertungsangaben;
	const bytes = await erzeugeAuswertung(angaben);
	const seiten = (await PDFDocument.load(bytes)).getPageCount();
	return (await Promise.all(Array.from({ length: seiten }, (_, i) => textVonSeite(bytes, i)))).join(' ');
}

describe('Frühere konsultative Durchgänge im Auswertungs-PDF', () => {
	it('nennt Durchgang, Grund nach L5 und Zahlen wie das Protokoll', async () => {
		const text = (await pdfText(true)).replace(/\s+/g, ' ');
		expect(text).toContain('Im 1. Durchgang wurde konsultativ abgestimmt, weil das Traktandum in der Einladung zur ersten Versammlung nicht zur Abstimmung');
		expect(text).toContain('Kopfstimmen: 1 Ja, 1 Nein');
	});

	it('nennt ohne L5 den gewöhnlichen Grund', async () => {
		const text = (await pdfText(false)).replace(/\s+/g, ' ');
		expect(text).toContain('weil die Versammlung nicht beschlussfähig war; ein Beschluss entstand dabei nicht.');
	});

	it('ohne Ordnungszahl, wo es nur diesen einen Durchgang gab, wie das Protokoll', async () => {
		const text = (await pdfText(false, 0)).replace(/\s+/g, ' ');
		expect(text).toContain('Es wurde konsultativ abgestimmt, weil die Versammlung nicht beschlussfähig war');
		expect(text).not.toContain('Im 1. Durchgang');
	});
});
