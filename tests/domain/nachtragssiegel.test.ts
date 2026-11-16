/**
 * Die Prüfung der Siegelkette im Kern (Ä-39). Gerechnet wird mit fertigen
 * Prüfsummen; SHA-256 liegt in der Schale (AD-1). Die Datenbankseite misst
 * `tests/db/nachtragssiegel.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	istNachtragsmanifest,
	pruefeKette,
	type Kettenglied,
	type Nachtragsmanifest
} from '$lib/domain/nachtragssiegel';

const GRUND = 'a'.repeat(64);

function glied(nummer: number, vorgaenger: string, ueber: Partial<Kettenglied> = {}): Kettenglied {
	const siegel = String(nummer).repeat(64).slice(0, 64);
	const manifest: Nachtragsmanifest = {
		fassung: 1,
		art: 'nachtragssiegel',
		gemeinschaft: 'Prüfgemeinschaft',
		versammlung: {
			kennung: 'k',
			datum: '2027-01-01',
			uhrzeit: '19:00',
			ort: 'Saal',
			art: 'ordentlich',
			stufe: 'erste',
			geschlossenAm: null
		},
		grundsiegel: GRUND,
		vorgaenger: { siegel: vorgaenger, was: vorgaenger === GRUND ? 'abschlusspaket' : 'protokollfassung', nummer: null },
		protokollfassung: {
			nummer,
			art: 'versandt',
			bemerkung: null,
			festgehaltenAm: '2027-01-02T10:00:00.000Z',
			festgehaltenDurch: 'Prüflauf'
		},
		zeitquelle: 'system',
		eintraege: [{ pfad: `protokoll-fassung-${nummer}.txt`, groesse: 3, pruefsumme: `t${nummer}`, beschreibung: '' }]
	};
	return {
		nummer,
		textPruefsumme: `t${nummer}`,
		manifest,
		manifestPruefsumme: siegel,
		siegel,
		vorgaenger,
		...ueber
	};
}

describe('pruefeKette', () => {
	const eins = glied(1, GRUND);
	const zwei = glied(2, eins.siegel);

	it('hält, wenn jedes Glied auf das vorige zeigt und unverändert ist', () => {
		const b = pruefeKette({ siegel: GRUND, manifestPruefsumme: GRUND }, [zwei, eins]);
		expect(b.haelt).toBe(true);
		expect(b.glieder.map((g) => g.nummer)).toEqual([1, 2]);
		expect(b.satz).toBe(
			'Die Kette hält: das Siegel des Abschlusspakets und die Nachtragssiegel von 2 Fassungen.'
		);
	});

	it('nennt eine Fassung, deren Wortlaut nicht mehr zur Prüfsumme passt', () => {
		const b = pruefeKette({ siegel: GRUND, manifestPruefsumme: GRUND }, [
			eins,
			{ ...zwei, textPruefsumme: 'anders' }
		]);
		expect(b.haelt).toBe(false);
		expect(b.glieder[1].maengel).toEqual(['der Wortlaut weicht von der Prüfsumme im Manifest ab']);
		expect(b.satz).toContain('Fassung Nr. 2: der Wortlaut weicht');
	});

	it('merkt eine herausgenommene Fassung am Verweis der nächsten', () => {
		const drei = glied(3, zwei.siegel);
		const b = pruefeKette({ siegel: GRUND, manifestPruefsumme: GRUND }, [eins, drei]);
		expect(b.glieder[1].maengel).toContain(
			'die Fassung verweist nicht auf das Nachtragssiegel der Fassung Nr. 1'
		);
	});

	it('merkt ein verändertes Manifest und ein verändertes erstes Siegel', () => {
		const b = pruefeKette({ siegel: GRUND, manifestPruefsumme: 'b'.repeat(64) }, [
			{ ...eins, manifestPruefsumme: 'c'.repeat(64) }
		]);
		expect(b.grundsiegelHaelt).toBe(false);
		expect(b.glieder[0].maengel).toContain('das Manifest wurde nach dem Festhalten verändert');
	});

	it('sagt, wenn nach dem Siegel keine Fassung festgehalten wurde', () => {
		expect(pruefeKette({ siegel: GRUND, manifestPruefsumme: GRUND }, []).satz).toBe(
			'Das Siegel des Abschlusspakets hält. Nach ihm wurde keine Protokollfassung festgehalten.'
		);
	});
});

describe('istNachtragsmanifest', () => {
	it('erkennt nur das Manifest eines Nachtragssiegels', () => {
		expect(istNachtragsmanifest(glied(1, GRUND).manifest)).toBe(true);
		expect(istNachtragsmanifest({ fassung: 1, eintraege: [] })).toBe(false);
		expect(istNachtragsmanifest(null)).toBe(false);
	});
});
