import { describe, expect, it } from 'vitest';
import { FachlicherFehler } from '$lib/domain/fehler';
import {
	anfechtungsfristEnde,
	loeschbarAb,
	monatSpaeter,
	pruefeLoeschung,
	RESERVE_TAGE,
	type Loeschangaben,
	type Loeschlage
} from '$lib/domain/loeschfrist';

describe('monatSpaeter — OR Art. 77 Abs. 1 Ziff. 3', () => {
	it('nimmt denselben Tag im Folgemonat', () => {
		expect(monatSpaeter('2026-03-15')).toBe('2026-04-15');
	});

	it('fällt auf den letzten Tag, wenn der Folgemonat kürzer ist', () => {
		// Nicht der 3. März: So rechnet auch PostgreSQL mit `+ interval '1 month'`.
		expect(monatSpaeter('2026-01-31')).toBe('2026-02-28');
		expect(monatSpaeter('2028-01-31')).toBe('2028-02-29');
		expect(monatSpaeter('2026-03-31')).toBe('2026-04-30');
	});

	it('geht über den Jahreswechsel', () => {
		expect(monatSpaeter('2026-12-20')).toBe('2027-01-20');
	});
});

describe('loeschbarAb', () => {
	it('ist Fristende plus dreissig volle Tage, und dann der Tag danach', () => {
		expect(RESERVE_TAGE).toBe(30);
		expect(anfechtungsfristEnde('2026-03-01')).toBe('2026-04-01');
		// 1. April Fristende, 2. April bis 1. Mai Reserve, ab 2. Mai löschbar.
		expect(loeschbarAb('2026-03-01')).toBe('2026-05-02');
	});
});

const bestaetigt: Loeschangaben = {
	zugestelltAm: '2026-03-01',
	paketArchiviert: true,
	protokollArchiviert: true,
	keineAnfechtung: true
};

const lage: Loeschlage = {
	heute: '2026-05-02',
	spaetesterSchluss: '2026-02-20',
	offenePendenzen: 0,
	nichtGeschlossen: false,
	nichtVersiegelt: false,
	ohneGenehmigung: [],
	ohneFolgeversammlung: []
};

function kennung(a: Partial<Loeschangaben>, l: Partial<Loeschlage> = {}): string | null {
	try {
		pruefeLoeschung({ ...bestaetigt, ...a }, { ...lage, ...l });
		return null;
	} catch (fehler) {
		expect(fehler).toBeInstanceOf(FachlicherFehler);
		return (fehler as FachlicherFehler).kennung;
	}
}

describe('pruefeLoeschung', () => {
	it('lässt am ersten zulässigen Tag löschen', () => {
		expect(kennung({})).toBeNull();
	});

	it('weist am Tag davor ab und nennt das Datum', () => {
		expect(kennung({}, { heute: '2026-05-01' })).toBe('loeschen_frist_laeuft');
		expect(() => pruefeLoeschung(bestaetigt, { ...lage, heute: '2026-05-01' })).toThrow(/2\. Mai 2026/);
	});

	it('verlangt eine geschlossene Versammlung', () => {
		expect(kennung({}, { nichtGeschlossen: true })).toBe('loeschen_noch_offen');
	});

	it('verlangt das Siegel', () => {
		expect(kennung({}, { nichtVersiegelt: true })).toBe('loeschen_nicht_versiegelt');
	});

	it('wartet auf die Genehmigung des Protokolls, auch wenn die Frist längst vorbei ist', () => {
		// Rz. 136 ad Art. 712n: Berichtigung bis zur nächsten Versammlung.
		const spaeter = { heute: '2027-03-01' };
		expect(kennung({}, { ...spaeter, ohneGenehmigung: ['Seeblick'] })).toBe(
			'loeschen_nicht_genehmigt'
		);
		expect(kennung({}, { ...spaeter, ohneFolgeversammlung: ['Seeblick'] })).toBe(
			'loeschen_genehmigung_ohne_versammlung'
		);
		expect(kennung({}, spaeter)).toBeNull();
	});

	it('nennt beim Abend die Gemeinschaften, denen die Genehmigung fehlt', () => {
		expect(() =>
			pruefeLoeschung(bestaetigt, { ...lage, ohneGenehmigung: ['Seeblick', 'Birke', 'Ahorn'] })
		).toThrow(/Protokoll von Seeblick, Birke und Ahorn ist noch nicht genehmigt/);
	});

	it('prüft Siegel und Genehmigung vor dem Datum', () => {
		expect(kennung({ zugestelltAm: '' }, { nichtVersiegelt: true })).toBe(
			'loeschen_nicht_versiegelt'
		);
		expect(kennung({ zugestelltAm: '' }, { ohneGenehmigung: ['Seeblick'] })).toBe(
			'loeschen_nicht_genehmigt'
		);
	});

	it('sperrt, solange eine Pendenz offen ist', () => {
		expect(kennung({}, { offenePendenzen: 2 })).toBe('loeschen_offene_pendenzen');
	});

	it('verlangt ein Zustelldatum, das es gibt', () => {
		expect(kennung({ zugestelltAm: '' })).toBe('loeschen_ohne_zustellung');
		expect(kennung({ zugestelltAm: '2026-02-31' })).toBe('loeschen_ohne_zustellung');
	});

	it('nimmt keine Zustellung in der Zukunft und keine vor dem Schluss', () => {
		expect(kennung({ zugestelltAm: '2026-06-01' })).toBe('loeschen_zustellung_zukunft');
		expect(kennung({ zugestelltAm: '2026-02-19' })).toBe('loeschen_zustellung_vor_schluss');
	});

	it('verlangt jede der drei Bestätigungen einzeln', () => {
		expect(kennung({ paketArchiviert: false })).toBe('loeschen_paket_nicht_archiviert');
		expect(kennung({ protokollArchiviert: false })).toBe('loeschen_protokoll_nicht_archiviert');
		expect(kennung({ keineAnfechtung: false })).toBe('loeschen_anfechtung');
	});
});
