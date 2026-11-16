/**
 * Entscheid 0045, Punkt 9 (07.11.2026), im Kern: der Ausweg am Abend über
 * Folgeanträge unter einem Traktandum mit Häkchen. Die Sperre am
 * Grundantrag, sobald ein Folgeantrag zur Wahl oder Abberufung entschieden
 * ist, ihr Satz und der Protokollsatz mit mehreren angenommenen Folgeanträgen.
 * Die Absage an der Abberufung je Lage und die Wirkung an der Datenbank
 * misst `tests/db/lesart-verwaltungsvollmacht.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { pruefeDurchgangsfreigabe, teilentschiedenSatz, type Freigabelage } from '$lib/domain/abstimmung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import type { Erfordernis } from '$lib/domain/entscheidbaum';
import { folgeantraegeAngenommenSatz, ohneErgebnis, teileEntschiedenSatz } from '$lib/domain/protokoll';

const ERFORDERNIS: Erfordernis = {
	fassung: '2026-07-30',
	juristischGegengelesen: false,
	astId: 'verwaltung',
	knotenId: 'k-decharge',
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

function lage(zusatz: Partial<Freigabelage> = {}): Freigabelage {
	return {
		versammlungszustand: 'laufend',
		traktandumart: 'abstimmung',
		traktandumtitel: 'Wiederwahl der Verwaltung zum neuen Honorar',
		erfordernis: ERFORDERNIS,
		offeneDurchgaenge: 0,
		...zusatz
	};
}

function fehler(l: Freigabelage): FachlicherFehler | null {
	try {
		pruefeDurchgangsfreigabe(l);
		return null;
	} catch (f) {
		if (f instanceof FachlicherFehler) return f;
		throw f;
	}
}

describe('Die Sperre am Grundantrag (beim Bau geklärt 07.11.2026)', () => {
	const teil = (titel: string, art: 'wahl' | 'abberufung', angenommen: boolean) => ({
		traktandumId: `t-${titel}`,
		titel,
		art,
		angenommen
	});

	it('sperrt, sobald ein Folgeantrag zur Wahl entschieden ist, mit der Tatsache und dem Verweis ins Handbuch', () => {
		const f = fehler(lage({ teilentschieden: [teil('Wiederwahl', 'wahl', true)] }));
		expect(f?.kennung).toBe('teil_entschieden');
		expect(f?.message).toBe(
			'Die Versammlung hat die Wahl der Verwaltung im Folgeantrag «Wiederwahl» angenommen. Über diesen ' +
				'Antrag stimmen Sie deshalb nicht mehr ab: Er enthält dieselbe Wahl. Ob danach noch ein Teil ' +
				'abzustimmen ist und welcher, hängt am Ergebnis; das steht im Handbuch im Absatz «Was nach dem ' +
				'Folgeantrag noch ansteht».'
		);
	});

	it('nennt das Ergebnis und die Art', () => {
		expect(teilentschiedenSatz([teil('Wahl der Y AG', 'wahl', false)])).toMatch(
			/^Die Versammlung hat die Wahl der Verwaltung im Folgeantrag «Wahl der Y AG» nicht angenommen\. .*Er enthält dieselbe Wahl\. Ging es im Folgeantrag um eine andere Kandidatur, ist die Wahl aus diesem Antrag noch offen\./
		);
		expect(teilentschiedenSatz([teil('Wiederwahl', 'wahl', true)])).not.toContain('andere Kandidatur');
		expect(teilentschiedenSatz([teil('Abberufung per 31.12.', 'abberufung', true)])).toMatch(
			/^Die Versammlung hat die Abberufung der Verwaltung im Folgeantrag «Abberufung per 31\.12\.» angenommen\. .*Er enthält dieselbe Abberufung\./
		);
	});

	it('richtet sich nach dem angenommenen Teil, nicht nach dem ersten (N-M1, R6-4)', () => {
		expect(
			teilentschiedenSatz([teil('Wahl der Y AG', 'wahl', false), teil('Wiederwahl der X AG', 'wahl', true)])
		).toMatch(/^Die Versammlung hat die Wahl der Verwaltung im Folgeantrag «Wiederwahl der X AG» angenommen\./);
		expect(teilentschiedenSatz([teil('A', 'wahl', false), teil('B', 'wahl', false)])).toMatch(/«B» nicht angenommen/);
	});

	it('lässt den Grundantrag ohne entschiedenen Teil und ohne Angabe durch', () => {
		expect(fehler(lage())).toBeNull();
		expect(fehler(lage({ teilentschieden: [] }))).toBeNull();
	});
});

describe('Der Protokollsatz beim gesperrten Grundantrag ohne angenommenen Folgeantrag (M-2)', () => {
	it('sagt, warum nicht abgestimmt wurde, und nennt die Folgeanträge', () => {
		expect(teileEntschiedenSatz([{ nummer: '3.1', titel: 'Wiederwahl', art: 'wahl' }])).toBe(
			'Über diesen Antrag wurde nicht abgestimmt: Er enthält die Wahl der Verwaltung, über die die ' +
				'Versammlung im Folgeantrag 3.1 «Wiederwahl» entschieden hat.'
		);
		expect(
			teileEntschiedenSatz([
				{ nummer: '3.2', titel: 'Wahl der X AG', art: 'wahl' },
				{ nummer: '3.1', titel: 'Wahl der Y AG', art: 'wahl' }
			])
		).toMatch(/in den Folgeanträgen 3\.1 «Wahl der Y AG» und 3\.2 «Wahl der X AG» entschieden hat\.$/);
		expect(
			teileEntschiedenSatz([
				{ nummer: '3.1', titel: 'Wiederwahl', art: 'wahl' },
				{ nummer: '3.2', titel: 'Abberufung', art: 'abberufung' }
			])
		).toContain('Er enthält die Wahl und die Abberufung der Verwaltung');
	});

	it('schliesst die Lage aus «ohne Ergebnis» aus', () => {
		const leer = { art: 'abstimmung', rueckzug: null, satz: null, zahlen: null, folgeantraegeAngenommen: null };
		expect(ohneErgebnis(leer)).toBe(true);
		expect(ohneErgebnis({ ...leer, teileEntschieden: [{ nummer: '3.1', titel: 'Wiederwahl', art: 'wahl' }] })).toBe(
			false
		);
	});
});

describe('Der Protokollsatz mit angenommenen Folgeanträgen', () => {
	it('nennt einen als Folgeantrag, nicht als Gegenantrag', () => {
		expect(folgeantraegeAngenommenSatz([{ nummer: '3.1', titel: 'Wiederwahl' }])).toBe(
			'Über diesen Antrag wurde nicht abgestimmt: Die Versammlung hat den Folgeantrag 3.1 «Wiederwahl» ' +
				'angenommen. Der ursprüngliche Antrag ist damit gegenstandslos.'
		);
	});

	it('nennt mehrere in der Folge ihrer Nummern, auch über 3.9 hinaus', () => {
		expect(
			folgeantraegeAngenommenSatz([
				{ nummer: '3.10', titel: 'Vertrag' },
				{ nummer: '3.2', titel: 'Entschädigung' },
				{ nummer: '3.1', titel: 'Wiederwahl' }
			])
		).toBe(
			'Über diesen Antrag wurde nicht abgestimmt: Die Versammlung hat die Folgeanträge 3.1 ' +
				'«Wiederwahl», 3.2 «Entschädigung» und 3.10 «Vertrag» angenommen. Der ursprüngliche Antrag ist ' +
				'damit gegenstandslos.'
		);
	});
});
