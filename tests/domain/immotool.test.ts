import { describe, expect, it } from 'vitest';
import {
	alsUebernahmedateien,
	parteischluessel,
	schluesselAusName,
	type ImmotoolStammdaten
} from '$lib/domain/immotool';
import { erzeugeVorschau } from '$lib/domain/uebernahme';
import { zerlege } from '$lib/domain/csv';

function stammdaten(teil: Partial<ImmotoolStammdaten> = {}): ImmotoolStammdaten {
	return {
		property: { id: 'lg-1', short_code: 'BUCH', name: 'STWEG Buchenweg 4' },
		stichtag: '2026-08-13',
		distribution_keys: [],
		units: [],
		...teil
	};
}

const HANS = { party_id: 12, name: 'Hans Meier', ownership_form: 'sole' };
const ANNA = { party_id: 47, name: 'Anna Weber', ownership_form: 'co' };

function einheit(teil: Partial<ImmotoolStammdaten['units'][number]> = {}) {
	return {
		id: 'e-1',
		unit_number: '1',
		name: 'Wohnung EG links',
		usage_type: 'Wohnung',
		value_quota: 250,
		quotas: {},
		owners: [HANS],
		...teil
	};
}

/** Liest die erzeugte Datei so, wie die Übernahme sie später liest. */
function alsZeilen(csv: string) {
	return zerlege(csv).zeilen.map((z) => z.werte);
}

describe('schluesselAusName', () => {
	it('macht aus dem Namen den Schlüssel, den ein Mensch tippen würde', () => {
		expect(schluesselAusName('Aufzug')).toBe('aufzug');
		expect(schluesselAusName('Heizung Süd')).toBe('heizungsued');
		expect(schluesselAusName('Lift / Treppenhaus')).toBe('lifttreppenhaus');
	});
});

describe('parteischluessel', () => {
	it('führt mehrere Personen an einer Einheit zu einer Stimme zusammen', () => {
		// ZGB 712o Abs. 1: eine Einheit, eine Stimme.
		expect(parteischluessel([HANS, ANNA])).toBe('p12+p47');
	});

	it('ist von der Reihenfolge unabhängig', () => {
		// Sonst legte dieselbe Gemeinschaft beim zweiten Durchgang eine zweite
		// Partei an, und die Einheit hinge an der neuen.
		expect(parteischluessel([ANNA, HANS])).toBe(parteischluessel([HANS, ANNA]));
	});
});

describe('alsUebernahmedateien', () => {
	it('schreibt Eigentümer und Einheiten in das Schema der CSV-Übernahme', () => {
		const d = alsUebernahmedateien(stammdaten({ units: [einheit()] }), ['stamm']);

		expect(alsZeilen(d.eigentuemer)).toEqual([
			{
				voter_ref: 'p12',
				display_name: '',
				person_names: 'Hans Meier',
				ownership_type: 'alleineigentum',
				person_count: '1',
				// Leer, weil dieser Testbestand keine Authentik-Kennung führt. Die
				// Spalte steht trotzdem da: Ein Kopf, der je nach Datenlage anders
				// aussieht, wäre zwei Schemas mit einem Namen.
				person_authentik: ''
			}
		]);
		expect(alsZeilen(d.einheiten)).toEqual([
			{
				holding_ref: 'e-1',
				label: 'Wohnung EG links',
				holding_type: 'unit',
				owner_voter_ref: 'p12',
				counts_as_head: '1',
				quota_units: '250'
			}
		]);
	});

	it('legt für dieselbe Gemeinschaft an zwei Einheiten nur eine Partei an', () => {
		const d = alsUebernahmedateien(
			stammdaten({
				units: [
					einheit({ id: 'e-1', owners: [HANS, ANNA] }),
					einheit({ id: 'e-2', name: 'Wohnung EG rechts', owners: [ANNA, HANS] })
				]
			}),
			['stamm']
		);

		expect(d.gezaehlt).toEqual({ eigentuemer: 1, einheiten: 2, uebergangen: 0 });
		expect(alsZeilen(d.eigentuemer)[0]).toMatchObject({
			voter_ref: 'p12+p47',
			person_names: 'Hans Meier | Anna Weber',
			ownership_type: 'miteigentum',
			person_count: '2'
		});
	});

	it('erklärt zwei Eigentümer nie zu Alleineigentum, auch wenn immotool das sagt', () => {
		// Gefunden am 13.08.2026: Stand die erste Zeile in immotool noch auf
		// «sole», kam für eine Einheit mit zwei Eigentümern «alleineigentum»
		// heraus — zwei Personen zu einer erklärt, die allein besitzt.
		const d = alsUebernahmedateien(
			stammdaten({
				units: [einheit({ owners: [HANS, { ...ANNA, ownership_form: 'sole' }] })]
			}),
			['stamm']
		);

		expect(alsZeilen(d.eigentuemer)[0].ownership_type).toBe('miteigentum');
		expect(d.hinweise.join(' ')).toContain('in immotool berichtigen');
	});

	it('lässt Gesamteigentum als eine Partei stehen', () => {
		// Eine Erbengemeinschaft steht in immotool als **eine** Partei. Das ist
		// kein Widerspruch, sondern der Normalfall — und kein Hinweis.
		const d = alsUebernahmedateien(
			stammdaten({
				units: [
					einheit({
						owners: [{ party_id: 5, name: 'Erbengemeinschaft Roth', ownership_form: 'joint' }]
					})
				]
			}),
			['stamm']
		);

		expect(alsZeilen(d.eigentuemer)[0].ownership_type).toBe('gesamteigentum');
		expect(d.hinweise.join(' ')).not.toContain('nur eine Person');
	});

	it('meldet Miteigentum mit nur einer eingetragenen Person', () => {
		const d = alsUebernahmedateien(
			stammdaten({ units: [einheit({ owners: [ANNA] })] }),
			['stamm']
		);

		expect(d.hinweise.join(' ')).toContain('nur eine Person');
	});

	it('nimmt Nebenobjekte ohne Kopfstimme auf', () => {
		const d = alsUebernahmedateien(
			stammdaten({ units: [einheit({ usage_type: 'Parkplatz', value_quota: 10 })] }),
			['stamm']
		);

		expect(alsZeilen(d.einheiten)[0]).toMatchObject({
			holding_type: 'parking',
			counts_as_head: '0'
		});
	});

	it('übergeht eine Einheit ohne Eigentümer und sagt, welche', () => {
		// Häufigster Fall ist die Nutzungsart «Gemeinschaft». Ohne Hinweis wäre die
		// Einheit einfach nicht in der Datei — und die Vorschau kann nur zeigen,
		// was drinsteht.
		const d = alsUebernahmedateien(
			stammdaten({ units: [einheit({ name: 'Waschküche', owners: [] })] }),
			['stamm']
		);

		expect(d.gezaehlt.einheiten).toBe(0);
		expect(d.gezaehlt.uebergangen).toBe(1);
		expect(d.hinweise.join(' ')).toContain('«Waschküche»');
	});

	it('nimmt einen bekannten Verteiler als eigene Spalte mit', () => {
		const d = alsUebernahmedateien(
			stammdaten({
				distribution_keys: [{ id: 'v-1', name: 'Aufzug', total_value: 1000, is_default: false }],
				units: [einheit({ quotas: { 'v-1': 300 } })]
			}),
			['stamm', 'aufzug']
		);

		expect(alsZeilen(d.einheiten)[0]).toMatchObject({ quota_aufzug: '300' });
	});

	it('lässt einen unbekannten Verteiler weg und nennt den Schlüssel zum Anlegen', () => {
		// Mitgeschrieben würde jede Einheit an dieser Spalte scheitern — wegen
		// eines Verteilers, den hier niemand angelegt hat.
		const d = alsUebernahmedateien(
			stammdaten({
				distribution_keys: [{ id: 'v-1', name: 'Aufzug', total_value: 1000, is_default: false }],
				units: [einheit({ quotas: { 'v-1': 300 } })]
			}),
			['stamm']
		);

		expect(zerlege(d.einheiten).spalten).not.toContain('quota_aufzug');
		expect(d.hinweise.join(' ')).toContain('«aufzug»');
	});

	it('lässt einen Verteiler mit gebrochenen Werten ganz weg, nicht bloss die eine Zeile', () => {
		const d = alsUebernahmedateien(
			stammdaten({
				distribution_keys: [{ id: 'v-1', name: 'Heizung', total_value: 1000, is_default: false }],
				units: [
					einheit({ id: 'e-1', quotas: { 'v-1': 333.33 } }),
					einheit({ id: 'e-2', name: 'Wohnung OG', quotas: { 'v-1': 300 } })
				]
			}),
			['stamm', 'heizung']
		);

		expect(zerlege(d.einheiten).spalten).not.toContain('quota_heizung');
		expect(d.hinweise.join(' ')).toContain('gebrochenen Wert');
		// Die Einheiten selbst kommen trotzdem mit.
		expect(d.gezaehlt.einheiten).toBe(2);
	});

	it('schreibt die Stammquote nicht zweimal, wenn immotool sie auch als Verteiler führt', () => {
		const d = alsUebernahmedateien(
			stammdaten({
				distribution_keys: [{ id: 'v-1', name: 'Wertquote', total_value: 1000, is_default: true }],
				units: [einheit({ quotas: { 'v-1': 250 } })]
			}),
			['stamm']
		);

		const spalten = zerlege(d.einheiten).spalten;
		expect(spalten.filter((s) => s.startsWith('quota_'))).toEqual(['quota_units']);
	});

	it('erzeugt Dateien, die die Übernahme selbst annimmt', () => {
		// Der eigentliche Nachweis für FR-7: nicht «sieht richtig aus», sondern
		// durch dieselbe Prüfung gelaufen, die eine hochgeladene Datei durchläuft.
		const d = alsUebernahmedateien(
			stammdaten({
				units: [
					einheit({ id: 'e-1', value_quota: 600 }),
					einheit({ id: 'e-2', name: 'Wohnung OG', value_quota: 400, owners: [ANNA] })
				]
			}),
			['stamm']
		);

		const leer = {
			eigentuemer: [],
			einheiten: [],
			quotenarten: [{ key: 'stamm', denominator: 1000, isPrimary: true }]
		};

		const parteien = erzeugeVorschau(d.eigentuemer, leer);
		expect(parteien.art).toBe('eigentuemer');
		expect(parteien.zusammenfassung).toMatchObject({ neu: 2, fehlerhaft: 0 });

		const einheiten = erzeugeVorschau(d.einheiten, leer);
		expect(einheiten.art).toBe('einheiten');
		expect(einheiten.zusammenfassung).toMatchObject({ neu: 2, fehlerhaft: 0 });
		expect(einheiten.bringtQuotenAusDemGleichgewicht).toBe(false);
	});

	it('meldet über die Vorschau, wenn die Stammquote nach der Übernahme nicht aufgeht', () => {
		const d = alsUebernahmedateien(
			stammdaten({ units: [einheit({ value_quota: 250 })] }),
			['stamm']
		);

		const vorschau = erzeugeVorschau(d.einheiten, {
			eigentuemer: [],
			einheiten: [],
			quotenarten: [{ key: 'stamm', denominator: 1000, isPrimary: true }]
		});

		expect(vorschau.bringtQuotenAusDemGleichgewicht).toBe(true);
	});
});

describe('Authentik-Kennung in der Eigentümerdatei', () => {
	const KENNUNG = '8f3c1d2a-4b5e-4f60-9a71-2c3d4e5f6a70';

	it('nimmt die Kennung mit, wo eine Person allein besitzt', () => {
		const dateien = alsUebernahmedateien(
			stammdaten({
				units: [einheit({ owners: [{ ...HANS, authentik_uuid: KENNUNG }] })]
			}),
			[]
		);
		expect(alsZeilen(dateien.eigentuemer)[0].person_authentik).toBe(KENNUNG);
	});

	it('lässt sie weg, wo die Stimme mehreren gehört — und sagt es an', () => {
		const dateien = alsUebernahmedateien(
			stammdaten({
				units: [
					einheit({
						owners: [{ ...HANS, authentik_uuid: KENNUNG }, ANNA],
						value_quota: 500
					})
				]
			}),
			[]
		);

		// Die Kennung EINER von zwei Personen an die gemeinsame Stimme zu hängen
		// hiesse zu entscheiden, wer von beiden sich anmelden darf.
		expect(alsZeilen(dateien.eigentuemer)[0].person_authentik).toBe('');
		expect(dateien.hinweise.some((h) => h.includes('Authentik-Kennung'))).toBe(true);
	});

	it('bleibt leer, wo immotool keine führt — ohne Hinweis', () => {
		const dateien = alsUebernahmedateien(stammdaten({ units: [einheit()] }), []);
		expect(alsZeilen(dateien.eigentuemer)[0].person_authentik).toBe('');
		expect(dateien.hinweise.some((h) => h.includes('Authentik-Kennung'))).toBe(false);
	});

	it('erzeugt eine Datei, die die Übernahme selbst annimmt', () => {
		// Der eigentliche Vertrag zwischen den beiden Dateien: Was hier entsteht,
		// muss drüben ohne Befund durchlaufen. Eine Spalte, die nur eine Seite
		// kennt, fiele sonst erst im Betrieb auf.
		const dateien = alsUebernahmedateien(
			stammdaten({
				units: [einheit({ owners: [{ ...HANS, authentik_uuid: KENNUNG }] })]
			}),
			[]
		);
		const v = erzeugeVorschau(dateien.eigentuemer, {
			eigentuemer: [],
			einheiten: [],
			quotenarten: []
		});
		expect(v.befunde).toEqual([]);
		expect(v.eigentuemer[0].satz?.authentikSubject).toBe(KENNUNG);
	});
});

describe('Dieselbe Partei an mehreren Einheiten', () => {
	const KENNUNG = '8f3c1d2a-4b5e-4f60-9a71-2c3d4e5f6a70';

	it('behält die Kennung, egal an welcher Einheit sie hängt', () => {
		/*
		 * Die Partei entsteht bei der ersten Einheit, an der sie vorkommt; alle
		 * weiteren Einheiten hängen sich an die bestehende. Damit steht und fällt
		 * die Kennung mit der Reihenfolge — solange nicht sicher ist, dass beide
		 * Einheiten denselben Wert tragen.
		 *
		 * Sie tun es: Der Schlüssel einer Partei IST die sortierte Liste ihrer
		 * Personen-Kennungen, und die UUID kommt je Person aus einer Tabelle mit
		 * genau einer Zeile je Person. Dieser Test nagelt das fest, statt es
		 * anzunehmen — im Code steht dafür keine einzige Zeile, und genau deshalb
		 * würde ein Umbau des Endpunkts es lautlos brechen.
		 */
		const owner = { ...HANS, authentik_uuid: KENNUNG };
		const dateien = alsUebernahmedateien(
			stammdaten({
				units: [
					einheit({ id: 'e-1', name: 'Wohnung', owners: [owner], value_quota: 700 }),
					einheit({ id: 'e-2', name: 'Bastelraum', owners: [owner], value_quota: 300 })
				]
			}),
			[]
		);

		const zeilen = alsZeilen(dateien.eigentuemer);
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].person_authentik).toBe(KENNUNG);
	});
});
