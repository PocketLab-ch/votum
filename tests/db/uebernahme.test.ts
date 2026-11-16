/**
 * Story 1.9 — Übernahme aus einer CSV, gegen den echten Bestand.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { erstelleGemeinschaft } from '$lib/server/gemeinschaften';
import { erstelleQuotenart, holeEinheiten } from '$lib/server/einheiten';
import { holeEigentuemer, stimmkraftAnsicht } from '$lib/server/eigentuemer';
import { holeMitberechtigte, holeNurMitberechtigte } from '$lib/server/mitberechtigte';
import { fuehreUebernahmeAus, vorschau, vorschauAusTabelle } from '$lib/server/uebernahme';
import { archiviere, holeAusArchiv } from '$lib/server/archivieren';
import { alsArbeitsmappe } from '$lib/domain/xlsx';
import { dosZeitstempel } from '$lib/domain/archiv';
import { zeilenAusMappe } from '$lib/domain/xlsxlesen';
import { ausFeldern } from '$lib/domain/csv';
import { entpacke } from '$lib/server/paketpruefung';
import { holeNutzniessungen } from '$lib/server/nutzniessung';
import { pruefbetreiber, verbindungenSchliessen } from './helfer';

let betreiber: string;
let stweg: string;

function handelnder(operatorId: string) {
	return { operatorId, userId: null, label: 'Prüflauf' };
}

const EIGENTUEMER_CSV = [
	'voter_ref;display_name;person_names;ownership_type;legal_representatives',
	'E1;Renate Berger;;alleineigentum;',
	'E2;Erbengemeinschaft Kunz;Peter Kunz|Anna Kunz;gesamteigentum;Peter Kunz',
	'E3;Muster Immobilien AG;;alleineigentum;Hans Muster'
].join('\n');

const EINHEITEN_CSV = [
	'holding_ref;holding_type;label;owner_voter_ref;quota_units;quota_lift',
	'H1;unit;1.1 Wohnung links;E1;400;60',
	'H2;unit;0.1 Wohnung Erdgeschoss;E2;550;',
	'H3;parking;P1 Einstellplatz;E3;50;40'
].join('\n');

beforeAll(async () => {
	betreiber = await pruefbetreiber('Uebernahme');
	const g = await erstelleGemeinschaft(handelnder(betreiber), {
		name: 'Importweg 9',
		quotaDenominator: 1000,
		headCountMode: 'per_owner',
		parkingCountsAsHead: false,
		parentStwegId: null
	});
	stweg = g.id;
	await erstelleQuotenart(handelnder(betreiber), {
		stwegId: stweg,
		key: 'lift',
		name: 'Aufzug',
		denominator: 100,
		isPrimary: false,
		sortOrder: 1
	});
});

afterAll(async () => {
	await verbindungenSchliessen();
});

describe('Vorschau', () => {
	it('meldet alle Zeilen als neu, solange nichts erfasst ist', async () => {
		const v = await vorschau(betreiber, stweg, EIGENTUEMER_CSV, '2026-09-01');
		expect(v.art).toBe('eigentuemer');
		expect(v.zusammenfassung).toMatchObject({ neu: 3, geaendert: 0, unveraendert: 0, fehlerhaft: 0 });
	});

	it('erkennt die Einheitenliste und ihre Quotensummen', async () => {
		const v = await vorschau(betreiber, stweg, EINHEITEN_CSV, '2026-09-01');
		expect(v.art).toBe('einheiten');
		expect(v.quotensummen.find((q) => q.key === 'stamm')).toMatchObject({
			summe: 1000,
			abweichung: 0
		});
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(false);
	});

	it('meldet eine Datei, die die Stammquote aus dem Gleichgewicht brächte', async () => {
		const schief = EINHEITEN_CSV.replace('550;', '548;');
		const v = await vorschau(betreiber, stweg, schief, '2026-09-01');
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(true);
		expect(v.quotensummen.find((q) => q.key === 'stamm')?.abweichung).toBe(2);
	});
});

describe('Übernahme ausführen', () => {
	it('legt die Eigentümer an', async () => {
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			stweg,
			EIGENTUEMER_CSV,
			'2026-01-01'
		);
		expect(ergebnis).toMatchObject({ angelegt: 3, geaendert: 0, uebersprungen: 0 });

		const parteien = await holeEigentuemer(betreiber, stweg, 'aktiv');
		expect(parteien.map((p) => p.displayName).sort()).toEqual([
			'Anna Kunz',
			'Erbengemeinschaft Kunz',
			'Muster Immobilien AG',
			'Peter Kunz',
			'Renate Berger'
		]);

		const erben = parteien.find((p) => p.displayName === 'Erbengemeinschaft Kunz')!;
		expect(erben.isCommunity).toBe(true);
		expect(erben.representativeName).toBe('Peter Kunz');

		/*
		 * **Peter und Anna Kunz sind eigene Zeilen** (27.08.2026, Aufgabe 6).
		 *
		 * Vorher waren sie ein Stück Text im Namen der Erbengemeinschaft und damit
		 * nicht erreichbar; nach ZGB Art. 712n ist jeder von ihnen einzeln
		 * anzuschreiben. Die Stimme bleibt bei der Hülle, die die Einheit hält —
		 * beide Zeilen halten keine und tragen deshalb null Kopfstimmen.
		 */
		expect((await holeMitberechtigte(betreiber, erben.id)).map((m) => m.displayName)).toEqual([
			'Anna Kunz',
			'Peter Kunz'
		]);
		// In der Eigentümerliste stehen sie unter der Hülle, nicht als eigene
		// Zeilen daneben — genau dafür gibt es diese Menge.
		expect(await holeNurMitberechtigte(betreiber, stweg)).toHaveLength(2);
	});

	/*
	 * **Das Archiv bleibt, und die Übernahme sagt es** (25.08.2026, vierte
	 * Reviewrunde). Die erste Fassung holte archivierte Zeilen still hervor —
	 * damit hätte jede Übernahme das Archivieren wieder aufgehoben, denn eine
	 * ausgezogene Eigentümerin steht in der Quelldatei oft noch monatelang.
	 */
	it('lässt eine archivierte Zeile im Archiv und meldet sie', async () => {
		/*
		 * **Ausdrücklich eine Zeile aus der Datei** (27.08.2026 berichtigt). Vorher
		 * stand hier die erste der Liste — seit die Übernahme Mitberechtigte
		 * anlegt, ist das «Anna Kunz», eine Zeile ohne Fremdkennung. Die Datei
		 * nennt sie nur im Namensfeld der Erbengemeinschaft, und der Test hätte
		 * eine Zeile geprüft, die die Übernahme gar nicht anfasst.
		 */
		const partei = (await holeEigentuemer(betreiber, stweg, 'aktiv')).find(
			(p) => p.displayName === 'Renate Berger'
		)!;
		await archiviere(handelnder(betreiber), 'eigentuemer', partei.id, 'Probe');

		// Eine Angabe ändern, damit die Zeile nicht als «unverändert» übersprungen
		// wird — sonst prüfte der Test einen Weg, den die Übernahme gar nicht geht.
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			stweg,
			EIGENTUEMER_CSV.replace(partei.displayName, `${partei.displayName}-neu`),
			'2026-01-01'
		);
		expect(ergebnis.imArchiv).toBe(1);

		// **Sie liegt weiterhin im Archiv** — «gemeldet» allein bewiese nichts.
		const aktive = await holeEigentuemer(betreiber, stweg, 'aktiv');
		expect(aktive.map((p) => p.id)).not.toContain(partei.id);

		// Zurücknehmen, damit die folgenden Tests denselben Bestand sehen.
		await holeAusArchiv(handelnder(betreiber), 'eigentuemer', partei.id);
		await fuehreUebernahmeAus(handelnder(betreiber), stweg, EIGENTUEMER_CSV, '2026-01-01');
	});

	it('legt die Einheiten mit beiden Quotenarten an und ordnet das Eigentum zu', async () => {
		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			stweg,
			EINHEITEN_CSV,
			'2026-01-01'
		);
		expect(ergebnis.angelegt).toBe(3);

		const einheiten = await holeEinheiten(betreiber, stweg);
		const h1 = einheiten.find((e) => e.label === '1.1 Wohnung links')!;
		const h2 = einheiten.find((e) => e.label === '0.1 Wohnung Erdgeschoss')!;

		expect(h1.quotas).toEqual({ stamm: 400, lift: 60 });
		// Leeres Feld heisst «nicht beteiligt», nicht «null».
		expect(h2.quotas).toEqual({ stamm: 550 });

		const kraft = await stimmkraftAnsicht(betreiber, stweg, '2026-06-01');
		expect(kraft.summeWertquote).toBe(1000);
		expect(kraft.einheitenOhneEigentuemer).toHaveLength(0);
	});

	it('erkennt bei erneuter Übernahme dieselben Datensätze wieder', async () => {
		// Ohne Fremdkennung wäre jede zweite Übernahme eine Verdoppelung.
		const v = await vorschau(betreiber, stweg, EIGENTUEMER_CSV, '2026-09-01');
		expect(v.zusammenfassung).toMatchObject({ neu: 0, geaendert: 0, unveraendert: 3 });

		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			stweg,
			EIGENTUEMER_CSV,
			'2026-01-01'
		);
		expect(ergebnis).toMatchObject({ angelegt: 0, geaendert: 0 });
		// Drei Zeilen aus der Datei, dazu die beiden Mitberechtigten der
		// Erbengemeinschaft. Ein zweiter Lauf legt keine weiteren an — sonst wäre
		// die Übernahme eine Verdoppelung.
		expect(await holeEigentuemer(betreiber, stweg, 'aktiv')).toHaveLength(5);
	});

	it('berichtigt einen geänderten Namen, statt eine zweite Person anzulegen', async () => {
		// Genau der Fall, für den der Name als Kennung untauglich wäre.
		const geheiratet = EIGENTUEMER_CSV.replace('Renate Berger', 'Renate Berger-Stucki');

		const v = await vorschau(betreiber, stweg, geheiratet, '2026-09-01');
		expect(v.zusammenfassung.geaendert).toBe(1);
		expect(v.eigentuemer.find((e) => e.vorgang === 'geaendert')?.aenderungen?.displayName).toEqual({
			vorher: 'Renate Berger',
			nachher: 'Renate Berger-Stucki'
		});

		await fuehreUebernahmeAus(handelnder(betreiber), stweg, geheiratet, '2026-01-01');
		const parteien = await holeEigentuemer(betreiber, stweg, 'aktiv');
		expect(parteien).toHaveLength(5);
		expect(parteien.map((p) => p.displayName)).toContain('Renate Berger-Stucki');
	});

	it('überspringt eine fehlerhafte Zeile und übernimmt die übrigen', async () => {
		const gemischt = [
			'voter_ref;display_name;person_names;person_count',
			'E4;Widerspruch;Anna|Beat;3',
			'E5;Sauber;;'
		].join('\n');

		const ergebnis = await fuehreUebernahmeAus(handelnder(betreiber), stweg, gemischt, '2026-01-01');
		expect(ergebnis).toMatchObject({ angelegt: 1, uebersprungen: 1 });

		const parteien = await holeEigentuemer(betreiber, stweg, 'aktiv');
		expect(parteien.map((p) => p.displayName)).toContain('Sauber');
		expect(parteien.map((p) => p.displayName)).not.toContain('Widerspruch');
	});

	it('übernimmt eine Nutzniessung aus der Datei', async () => {
		const mitNutzniessung = [
			'holding_ref;label;owner_voter_ref;quota_units;usufruct_holder;usufruct_from;usufruct_agreement',
			'H2;0.1 Wohnung Erdgeschoss;E2;550;Hedwig Berger-Stucki;2020-05-01;Stimmrecht verbleibt bei der Eigentümerin'
		].join('\n');

		await fuehreUebernahmeAus(handelnder(betreiber), stweg, mitNutzniessung, '2026-01-01');

		const n = await holeNutzniessungen(betreiber, stweg);
		expect(n).toHaveLength(1);
		expect(n[0]).toMatchObject({
			holderName: 'Hedwig Berger-Stucki',
			validFrom: '2020-05-01',
			hasAgreement: true
		});
	});

	it('hält die Übernahme im Verlauf fest, mit Zahlen', async () => {
		const [eintrag] = await (
			await import('./helfer')
		).imKontext(
			betreiber,
			(tx) => tx`
				SELECT detail FROM audit_entry
				WHERE event_type = 'import.applied' AND subject_id = ${stweg}
				ORDER BY id DESC LIMIT 1
			`
		);
		expect(eintrag.detail).toMatchObject({ art: 'einheiten' });
		expect(eintrag.detail).toHaveProperty('angelegt');
		expect(eintrag.detail).toHaveProperty('uebersprungen');
	});
});

describe('Authentik-Kennung durch den ganzen Weg', () => {
	const KENNUNG = '8f3c1d2a-4b5e-4f60-9a71-2c3d4e5f6a70';
	let eigen: string;

	beforeAll(async () => {
		// Eigene Gemeinschaft, damit die Läufe der anderen Blöcke hier nichts
		// verschieben — die Kennung ist je Gemeinschaft eindeutig.
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Kennungsweg 3',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});
		eigen = g.id;
	});

	async function kennungVon(ref: string): Promise<string | null> {
		const [z] = await (
			await import('./helfer')
		).imKontext(
			betreiber,
			(tx) => tx`
				SELECT authentik_subject FROM party
				WHERE stweg_id = ${eigen} AND import_ref = ${ref}
			`
		);
		return z?.authentik_subject ?? null;
	}

	it('schreibt die Kennung aus der Datei an die Partei', async () => {
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			eigen,
			`voter_ref;display_name;person_authentik\nK1;Renate Berger;${KENNUNG}\n`,
			'2026-08-20'
		);
		expect(await kennungVon('K1')).toBe(KENNUNG);
	});

	it('nimmt sie einer Datei, die die Spalte gar nicht kennt, NICHT wieder weg', async () => {
		/*
		 * Der Fall, der im Betrieb wirklich eintritt: Eine ältere oder von Hand
		 * geschriebene Datei wird ein zweites Mal übernommen. Die Vorschau meldet
		 * die Zeile als unverändert und überspringt sie — aber verlassen darf man
		 * sich darauf nicht: Ändert dieselbe Zeile nebenbei den Namen, läuft der
		 * UPDATE, und ohne COALESCE stünde dann NULL in der Spalte. Der Eigentümer
		 * käme nicht mehr herein, und niemand suchte den Grund in einer Datei, die
		 * von Kennungen nichts weiss.
		 */
		await fuehreUebernahmeAus(
			handelnder(betreiber),
			eigen,
			'voter_ref;display_name\nK1;Renate Berger-Stucki\n',
			'2026-08-20'
		);
		const [z] = await (
			await import('./helfer')
		).imKontext(
			betreiber,
			(tx) => tx`
				SELECT display_name, authentik_subject FROM party
				WHERE stweg_id = ${eigen} AND import_ref = 'K1'
			`
		);
		expect(z.display_name).toBe('Renate Berger-Stucki'); // der UPDATE lief wirklich
		expect(z.authentik_subject).toBe(KENNUNG); // und liess die Kennung stehen
	});

	it('weist eine Kennung ab, die hier schon einer anderen Partei gehört — ohne den Rest mitzureissen', async () => {
		/*
		 * Zwei Parteien mit einer Kennung wären ein Mensch mit zwei Stimmen. Der
		 * Unique-Index verhindert das ohnehin — aber er tut es beim Schreiben, und
		 * die Übernahme läuft in EINER Transaktion: Eine doppelte Kennung nähme
		 * allen anderen Zeilen ihren Lauf, und auf dem Bildschirm stünde ein
		 * Serverfehler statt eines Befundes. Deshalb fängt die Vorschau den Fall
		 * ab, und die Zeile wird übersprungen wie jede andere fehlerhafte.
		 */
		const csv =
			'voter_ref;display_name;person_authentik\n' +
			`K2;Beat Frei;${KENNUNG}\n` +
			'K3;Vera Lang;\n';

		const plan = await vorschau(betreiber, eigen, csv, '2026-09-01');
		expect(plan.zusammenfassung.fehlerhaft).toBe(1);
		expect(plan.befunde[0].spalte).toBe('person_authentik');
		expect(plan.befunde[0].grund).toContain('K1');

		const ergebnis = await fuehreUebernahmeAus(handelnder(betreiber), eigen, csv, '2026-08-20');
		expect(ergebnis.angelegt).toBe(1); // Vera Lang kam durch
		expect(await kennungVon('K2')).toBe(null); // Beat Frei nicht
		expect(await kennungVon('K1')).toBe(KENNUNG); // und Renate behält ihre
	});

	it('weist zwei gleiche Kennungen innerhalb einer Datei ab', async () => {
		const zweite = 'b7e6d5c4-3a2b-4c1d-8e9f-0a1b2c3d4e5f';
		const csv =
			'voter_ref;display_name;person_authentik\n' +
			`K4;Urs Bieri;${zweite}\n` +
			`K5;Nina Hess;${zweite}\n`;

		const plan = await vorschau(betreiber, eigen, csv, '2026-09-01');
		expect(plan.zusammenfassung.fehlerhaft).toBe(1);
		// Die Kopfzeile zählt als Zeile 1 — die Nummer ist die aus der Datei des Menschen.
		expect(plan.befunde[0].grund).toContain('Zeile 2');

		const ergebnis = await fuehreUebernahmeAus(handelnder(betreiber), eigen, csv, '2026-08-20');
		expect(ergebnis.angelegt).toBe(1);
		expect(await kennungVon('K4')).toBe(zweite);
		expect(await kennungVon('K5')).toBe(null);
	});
});


/*
 * **Der Weg aus einer Excel-Datei** (Auftraggeber, 25.08.2026: «und wie kann ich den
 * CSV oder Excel Import machen?»).
 *
 * Geprüft wird der **ganze** Serverweg: eine echte Mappe schreiben, sie lesen,
 * daraus eine Übernahme fahren — und nachmessen, dass dieselben Zeilen
 * entstehen wie aus der CSV. Ein Test nur über den Leser bewiese, dass XML
 * zerlegt wird, nicht dass ein Eigentümer ankommt.
 */
describe('Übernahme aus einer Excel-Datei', () => {
	function alsMappe(csv: string): Uint8Array {
		const zeilen = csv
			.trim()
			.split('\n')
			.map((z) => z.split(';').map((w) => ({ art: 'text', wert: w }) as const));
		return alsArbeitsmappe([{ name: 'Blatt', zeilen }], dosZeitstempel('2026-08-25T12:00:00.000Z'));
	}

	it('liest dieselben Eigentümer wie aus der CSV', async () => {
		const g = await erstelleGemeinschaft(handelnder(betreiber), {
			name: 'Mappenhaus',
			quotaDenominator: 1000,
			headCountMode: 'per_owner',
			parkingCountsAsHead: false,
			parentStwegId: null
		});

		const tabelle = ausFeldern(zeilenAusMappe(entpacke(alsMappe(EIGENTUEMER_CSV))), '\t');
		const plan = await vorschauAusTabelle(betreiber, g.id, tabelle, '2026-09-01');
		expect(plan.art).toBe('eigentuemer');
		expect(plan.zusammenfassung.fehlerhaft).toBe(0);

		const ergebnis = await fuehreUebernahmeAus(
			handelnder(betreiber),
			g.id,
			tabelle,
			'2026-01-01'
		);
		expect(ergebnis.angelegt).toBe(3);

		// **Und die Namen stimmen** — «drei angelegt» bewiese auch ein Leser, der
		// jede Zelle leer liest.
		const parteien = await holeEigentuemer(betreiber, g.id, 'aktiv');
		const ausCsv = await vorschau(betreiber, g.id, EIGENTUEMER_CSV, '2026-09-01');
		const ausDerCsv = ausCsv.eigentuemer
			.map((e) => e.satz?.displayName)
			.filter((n): n is string => Boolean(n));
		expect(ausDerCsv).toHaveLength(3);
		// Verglichen werden die Zeilen der Datei. Die Mitberechtigten der
		// Erbengemeinschaft stehen zusätzlich da und kommen aus keiner Zeile —
		// sie sind der Inhalt einer davon.
		const mitberechtigte = new Set(await holeNurMitberechtigte(betreiber, g.id));
		expect(mitberechtigte.size).toBe(2);
		expect(
			parteien
				.filter((p) => !mitberechtigte.has(p.id))
				.map((p) => p.displayName)
				.sort()
		).toEqual(ausDerCsv.sort());
	});
});
