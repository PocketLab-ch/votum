import { describe, expect, it } from 'vitest';
import {
	erkenneArt,
	erzeugeVorschau,
	istGemeinschaftlich,
	pruefeEigentuemerZeile,
	type Bestand
} from '$lib/domain/uebernahme';

const LEER: Bestand = {
	eigentuemer: [],
	einheiten: [],
	quotenarten: [{ key: 'stamm', denominator: 1000, isPrimary: true }]
};

const MIT_LIFT: Bestand = {
	...LEER,
	quotenarten: [
		{ key: 'stamm', denominator: 1000, isPrimary: true },
		{ key: 'lift', denominator: 100, isPrimary: false }
	]
};

describe('erkenneArt', () => {
	it('erkennt eine Eigentümerliste', () => {
		expect(erkenneArt(['voter_ref', 'display_name'])).toBe('eigentuemer');
	});

	it('erkennt eine Einheitenliste', () => {
		expect(erkenneArt(['holding_ref', 'label', 'quota_units'])).toBe('einheiten');
	});

	it('erkennt die neuen Spaltennamen ebenfalls', () => {
		expect(erkenneArt(['party_ref'])).toBe('eigentuemer');
		expect(erkenneArt(['unit_ref'])).toBe('einheiten');
	});

	it('gibt null bei einer unbekannten Datei', () => {
		expect(erkenneArt(['name', 'adresse'])).toBeNull();
	});
});

describe('istGemeinschaftlich', () => {
	it('behandelt Mit- und Gesamteigentum gleich', () => {
		// Beide bedeuten: mehrere Personen an einer Einheit, zusammen eine Stimme
		// (ZGB Art. 712o Abs. 1). Der Unterschied liegt im Sachenrecht, nicht in
		// der Stimmzählung.
		expect(istGemeinschaftlich('miteigentum')).toBe(true);
		expect(istGemeinschaftlich('gesamteigentum')).toBe(true);
	});

	it('behandelt Alleineigentum als einzeln', () => {
		expect(istGemeinschaftlich('alleineigentum')).toBe(false);
	});
});

describe('Eigentümer übernehmen', () => {
	it('meldet neue Sätze als neu', () => {
		const v = erzeugeVorschau('voter_ref;display_name\nE1;Renate Berger\n', LEER);
		expect(v.art).toBe('eigentuemer');
		expect(v.zusammenfassung).toMatchObject({ neu: 1, geaendert: 0, unveraendert: 0, fehlerhaft: 0 });
	});

	it('meldet einen unveränderten Satz als unverändert', () => {
		const bestand: Bestand = {
			...LEER,
			eigentuemer: [
				{
					ref: 'E1',
					displayName: 'Renate Berger',
					kind: 'natural',
					isCommunity: false,
					representativeName: null,
					authentikSubject: null,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
		const v = erzeugeVorschau('voter_ref;display_name\nE1;Renate Berger\n', bestand);
		expect(v.zusammenfassung.unveraendert).toBe(1);
	});

	it('zeigt bei einer Änderung, was sich ändert', () => {
		const bestand: Bestand = {
			...LEER,
			eigentuemer: [
				{
					ref: 'E1',
					displayName: 'Renate Berger',
					kind: 'natural',
					isCommunity: false,
					representativeName: null,
					authentikSubject: null,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
		const v = erzeugeVorschau('voter_ref;display_name\nE1;Renate Berger-Stucki\n', bestand);
		expect(v.zusammenfassung.geaendert).toBe(1);
		expect(v.eigentuemer[0].aenderungen?.displayName).toEqual({
			vorher: 'Renate Berger',
			nachher: 'Renate Berger-Stucki'
		});
	});

	it('markiert eine widersprüchliche Personenzahl mit Zeilennummer und Grund', () => {
		// Genau der Fall aus den Akzeptanzkriterien.
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_names;person_count\n' +
				'E1;Erbengemeinschaft;Anna Meier|Beat Meier;3\n',
			LEER
		);
		expect(v.zusammenfassung.fehlerhaft).toBe(1);
		expect(v.befunde[0].zeile).toBe(2);
		expect(v.befunde[0].grund).toMatch(/Personenzahl 3 passt nicht zu 2/);
	});

	it('lässt die übrigen Zeilen übernehmbar', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_names;person_count\n' +
				'E1;Erbengemeinschaft;Anna Meier|Beat Meier;3\n' +
				'E2;Renate Berger;;\n',
			LEER
		);
		expect(v.zusammenfassung).toMatchObject({ neu: 1, fehlerhaft: 1 });
		expect(v.eigentuemer[1].satz?.displayName).toBe('Renate Berger');
	});

	it('leitet aus mehreren Personen gemeinschaftliches Eigentum ab', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_names;ownership_type;legal_representatives\n' +
				'E1;Erbengemeinschaft Meier;Anna Meier|Beat Meier;gesamteigentum;Anna Meier\n',
			LEER
		);
		expect(v.eigentuemer[0].satz).toMatchObject({
			isCommunity: true,
			representativeName: 'Anna Meier'
		});
	});

	it('nimmt die erste Person als Vertreter, wenn keiner genannt ist', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_names;ownership_type\n' +
				'E1;Erbengemeinschaft;Anna Meier|Beat Meier;gesamteigentum\n',
			LEER
		);
		expect(v.eigentuemer[0].satz?.representativeName).toBe('Anna Meier');
	});

	it('meldet eine juristische Person ohne Vertretung als fehlerhaft', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;party_type\nE1;Muster Immobilien AG;juristisch\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/vertretungsberechtigte Person/);
	});

	it('meldet eine unbekannte Eigentumsform mit dem gelesenen Wert', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;ownership_type\nE1;Renate Berger;stockwerkeigentum\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/«stockwerkeigentum»/);
	});
});

describe('Einheiten übernehmen', () => {
	it('liest die alte Spalte quota_units als Stammquote', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1 Wohnung;E1;400\n',
			LEER
		);
		expect(v.einheiten[0].satz?.quotas).toEqual({ stamm: 400 });
	});

	it('liest zusätzliche Verteiler aus quota_<schluessel>', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;quota_lift\nH1;1.1 Wohnung;E1;400;60\n',
			MIT_LIFT
		);
		expect(v.einheiten[0].satz?.quotas).toEqual({ stamm: 400, lift: 60 });
	});

	it('lässt ein leeres Verteilerfeld als Nichtbeteiligung stehen', () => {
		// Die Erdgeschosswohnung zahlt nicht an den Aufzug. Eine 0 wäre etwas
		// anderes.
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;quota_lift\nH1;0.1 Wohnung;E1;550;\n',
			MIT_LIFT
		);
		expect(v.einheiten[0].satz?.quotas).toEqual({ stamm: 550 });
	});

	it('meldet einen Tippfehler im Spaltennamen eines Verteilers', () => {
		// Anders als im Formular wird hier gemeldet statt übergangen: In einer
		// Datei ist `quota_lifz` ein Fehler, und die Einheit fiele still aus der
		// Saldoprüfung dieses Verteilers.
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;quota_lifz\nH1;1.1 Wohnung;E1;400;60\n',
			MIT_LIFT
		);
		expect(v.befunde[0].grund).toMatch(/keine Quotenart «lifz»/);
	});

	it('meldet eine fehlende Stammquote', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_lift\nH1;1.1 Wohnung;E1;60\n',
			MIT_LIFT
		);
		expect(v.befunde[0].grund).toMatch(/Stammquote fehlt/);
	});

	it('meldet eine Quote mit Nachkommastellen', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1 Wohnung;E1;400.5\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/ganze Zahl/);
	});

	it('nennt je Zeile mit Nachkommastelle den Weg, mit Komma wie mit Punkt (Ä-10)', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\n' +
				'H1;1.1 Wohnung;E1;123,5\nH2;1.2 Wohnung;E1;876\nH3;1.3 Wohnung;E1;123.5\n',
			LEER
		);
		expect(v.befunde).toHaveLength(2);
		for (const b of v.befunde) expect(b.grund).toMatch(/1235 von 10 000/);
	});

	it('liest «1,000» nicht als 1 (Komma als Tausendertrenner)', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1 Wohnung;E1;1,000\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/ganze Zahl/);
		expect(v.befunde[0].grund).not.toMatch(/Vergrössern/);
	});

	it('nennt den Weg nicht bei Text', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1 Wohnung;E1;abc\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/ganze Zahl/);
		expect(v.befunde[0].grund).not.toMatch(/Vergrössern/);
	});

	it('liest eine Zahl mit Schweizer Tausendertrennung', () => {
		const v = erzeugeVorschau(
			"holding_ref;label;owner_voter_ref;quota_units\nH1;1.1 Wohnung;E1;1'000\n",
			LEER
		);
		expect(v.einheiten[0].satz?.quotas.stamm).toBe(1000);
	});

	it('meldet eine Einheit ohne Eigentümer', () => {
		const v = erzeugeVorschau('holding_ref;label;quota_units\nH1;1.1 Wohnung;400\n', LEER);
		expect(v.befunde[0].grund).toMatch(/Kein Eigentümer/);
	});

	it('erkennt ein Nebenobjekt an der Art', () => {
		const v = erzeugeVorschau(
			'holding_ref;holding_type;label;owner_voter_ref;quota_units\nH1;parking;P1;E1;50\n',
			LEER
		);
		expect(v.einheiten[0].satz?.kind).toBe('parking');
	});

	it('übernimmt eine Nutzniessung mit Vereinbarung', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;usufruct_holder;usufruct_from;usufruct_agreement\n' +
				'H1;1.1 Wohnung;E1;400;Hedwig Berger;2020-05-01;Stimmrecht bei der Eigentümerin\n',
			LEER
		);
		expect(v.einheiten[0].satz?.nutzniessung).toMatchObject({
			holderName: 'Hedwig Berger',
			validFrom: '2020-05-01',
			hasAgreement: true
		});
	});

	it('meldet eine Nutzniessung ohne Beginn', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;usufruct_holder\n' +
				'H1;1.1 Wohnung;E1;400;Hedwig Berger\n',
			LEER
		);
		expect(v.befunde[0].grund).toMatch(/Beginn/);
	});
});

describe('Wertquotensummen nach der Übernahme', () => {
	it('meldet, wenn die Stammquote danach nicht mehr aufginge', () => {
		// Die Story verlangt hier eine zweite Bestätigung. Ein stilles Durchlaufen
		// findet nie statt.
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1;E1;400\nH2;1.2;E2;598\n',
			LEER
		);
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(true);
		expect(v.quotensummen.find((q) => q.key === 'stamm')).toMatchObject({
			summe: 998,
			soll: 1000,
			abweichung: 2
		});
	});

	it('meldet nichts, wenn die Summe aufgeht', () => {
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1;E1;400\nH2;1.2;E2;600\n',
			LEER
		);
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(false);
	});

	it('rechnet bestehende Einheiten mit, die die Datei nicht nennt', () => {
		const bestand: Bestand = {
			...LEER,
			einheiten: [
				{
					ref: 'H9',
					label: 'Bestehend',
					kind: 'unit',
					quotas: { stamm: 600 },
					countsAsHead: true,
					hatNutzniessung: false,
					eigentuemerRef: null
				}
			]
		};
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units\nH1;1.1;E1;400\n',
			bestand
		);
		expect(v.quotensummen[0].summe).toBe(1000);
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(false);
	});

	it('lässt einen Kostenschlüssel ausser Balance, ohne die Übernahme zu blockieren', () => {
		// Nur die Stammquote entscheidet über die Abstimmbarkeit.
		const v = erzeugeVorschau(
			'holding_ref;label;owner_voter_ref;quota_units;quota_lift\nH1;1.1;E1;1000;40\n',
			MIT_LIFT
		);
		expect(v.bringtQuotenAusDemGleichgewicht).toBe(false);
		expect(v.quotensummen.find((q) => q.key === 'lift')?.abweichung).toBe(60);
	});
});

describe('Unbrauchbare Datei', () => {
	it('sagt, was erwartet wird', () => {
		const v = erzeugeVorschau('name;adresse\nBerger;Musterweg 3\n', LEER);
		expect(v.befunde[0].grund).toMatch(/voter_ref/);
		expect(v.befunde[0].grund).toMatch(/holding_ref/);
	});
});

describe('Authentik-Kennung des Eigentümers', () => {
	const KENNUNG = '8f3c1d2a-4b5e-4f60-9a71-2c3d4e5f6a70';
	const ANDERE = 'a1b2c3d4-e5f6-4708-9a1b-2c3d4e5f6071';

	function mitKennung(kennung: string | null): Bestand {
		return {
			...LEER,
			eigentuemer: [
				{
					ref: 'E1',
					displayName: 'Renate Berger',
					kind: 'natural',
					isCommunity: false,
					representativeName: null,
					authentikSubject: kennung,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
	}

	it('nimmt eine Kennung aus der Datei auf', () => {
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Renate Berger;${KENNUNG}\n`,
			LEER
		);
		expect(v.befunde).toEqual([]);
		expect(v.eigentuemer[0].satz?.authentikSubject).toBe(KENNUNG);
	});

	it('schreibt sie klein, damit derselbe Mensch nicht zweimal existiert', () => {
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Renate Berger;${KENNUNG.toUpperCase()}\n`,
			LEER
		);
		expect(v.eigentuemer[0].satz?.authentikSubject).toBe(KENNUNG);
	});

	it('weist zwei Kennungen an einer Zeile ab', () => {
		const v = erzeugeVorschau(
			`voter_ref;person_names;person_authentik\nE1;Anna | Beat;${KENNUNG} | ${ANDERE}\n`,
			LEER
		);
		expect(v.zusammenfassung.fehlerhaft).toBe(1);
		expect(v.befunde[0].spalte).toBe('person_authentik');
	});

	it('weist alles ab, was keine UUID ist — auch eine E-Mail-Adresse', () => {
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_authentik\nE1;Renate Berger;renate@example.ch\n',
			LEER
		);
		expect(v.zusammenfassung.fehlerhaft).toBe(1);
		expect(v.befunde[0].grund).toContain('E-Mail-Adresse');
	});

	it('meldet eine neue Kennung an sonst unveränderter Partei als Änderung', () => {
		// Der Regelfall beim zweiten Lauf nach dem Onboarding: Am Namen ändert
		// sich nichts, nur die Kennung kommt dazu. Gälte die Zeile als
		// unverändert, käme sie nie an.
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Renate Berger;${KENNUNG}\n`,
			mitKennung(null)
		);
		expect(v.zusammenfassung.geaendert).toBe(1);
		expect(v.eigentuemer[0].aenderungen?.authentikSubject).toEqual({
			vorher: null,
			nachher: KENNUNG
		});
	});

	it('lässt eine Datei ohne die Spalte die bestehende Kennung NICHT entfernen', () => {
		// Ältere und von Hand geschriebene Dateien kennen die Spalte nicht. Zählte
		// ihr Schweigen als Löschauftrag, nähme ein harmloser zweiter Lauf der
		// Partei ihren Zugang weg — und niemand suchte den Grund in der Datei.
		const v = erzeugeVorschau('voter_ref;display_name\nE1;Renate Berger\n', mitKennung(KENNUNG));
		expect(v.zusammenfassung.unveraendert).toBe(1);
		expect(v.eigentuemer[0].aenderungen).toBeUndefined();
	});

	it('meldet den Wechsel auf eine andere Kennung', () => {
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Renate Berger;${ANDERE}\n`,
			mitKennung(KENNUNG)
		);
		expect(v.zusammenfassung.geaendert).toBe(1);
	});
});

describe('Eine Kennung gehört einer Partei', () => {
	const KENNUNG = '8f3c1d2a-4b5e-4f60-9a71-2c3d4e5f6a70';

	it('meldet dieselbe Kennung in zwei Zeilen als Befund an der zweiten', () => {
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Anna Roth;${KENNUNG}\nE2;Beat Frei;${KENNUNG}\n`,
			LEER
		);
		// Die erste Zeile bleibt gültig: Sie hat den Anspruch zuerst erhoben, und
		// eine Datei, bei der beide Zeilen durchfallen, sagt nicht, welche gemeint war.
		expect(v.zusammenfassung).toMatchObject({ neu: 1, fehlerhaft: 1 });
		expect(v.eigentuemer[1].befund?.grund).toContain('Zeile 2');
	});

	it('meldet eine Kennung, die im Bestand einer anderen Partei gehört', () => {
		const bestand: Bestand = {
			...LEER,
			eigentuemer: [
				{
					ref: 'E1',
					displayName: 'Anna Roth',
					kind: 'natural',
					isCommunity: false,
					representativeName: null,
					authentikSubject: KENNUNG,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE2;Beat Frei;${KENNUNG}\n`,
			bestand
		);
		expect(v.zusammenfassung.fehlerhaft).toBe(1);
		expect(v.befunde[0].grund).toContain('E1');
	});

	it('lässt dieselbe Partei ihre eigene Kennung behalten', () => {
		// Der Normalfall jeder erneuten Übernahme. Träfe die Eindeutigkeitsprüfung
		// auch hier zu, fiele die Zeile bei JEDEM zweiten Lauf durch.
		const bestand: Bestand = {
			...LEER,
			eigentuemer: [
				{
					ref: 'E1',
					displayName: 'Anna Roth',
					kind: 'natural',
					isCommunity: false,
					representativeName: null,
					authentikSubject: KENNUNG,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
		const v = erzeugeVorschau(
			`voter_ref;display_name;person_authentik\nE1;Anna Roth;${KENNUNG}\n`,
			bestand
		);
		expect(v.zusammenfassung.unveraendert).toBe(1);
	});
});

/*
 * ────────────────────────────────────────────────────────────────────────────
 * Aufgabe 6: die Übernahme aus einer Datei legt eine Hülle an.
 */

describe('Mehrere Personen in einer Zeile', () => {
	it('trägt die Namen einzeln weiter, statt sie einzudampfen', () => {
		const v = pruefeEigentuemerZeile({
			nummer: 2,
			werte: {
				voter_ref: 'P-2',
				person_names: 'Anna Muster; Beat Muster',
				legal_representatives: 'Anna Muster'
			}
		});
		expect(v.vorgang).not.toBe('fehlerhaft');
		expect(v.satz?.personen).toEqual(['Anna Muster', 'Beat Muster']);
		expect(v.satz?.isCommunity).toBe(true);
	});

	it('lässt eine einzelne Person eine einzelne Person bleiben', () => {
		const v = pruefeEigentuemerZeile({
			nummer: 3,
			werte: { voter_ref: 'P-3', person_names: 'Cora Muster' }
		});
		expect(v.satz?.personen).toEqual(['Cora Muster']);
		expect(v.satz?.isCommunity).toBe(false);
	});

	it('benennt die Zeile mit «und», nicht mit einem Komma', () => {
		// Sonst hiesse die Zeile in der Vorschau anders als danach in der Liste:
		// Angelegt wird sie über `erstelleGemeinschaftlicheZeile`, und die nimmt
		// den Sammelnamen. Jeder zweite Lauf meldete sie sonst als «geändert».
		const v = pruefeEigentuemerZeile({
			nummer: 2,
			werte: { voter_ref: 'P-2', person_names: 'Anna Muster; Beat Muster' }
		});
		expect(v.satz?.displayName).toBe('Anna Muster und Beat Muster');
	});

	it('lässt einen vorgegebenen Namen stehen', () => {
		const v = pruefeEigentuemerZeile({
			nummer: 2,
			werte: {
				voter_ref: 'P-2',
				display_name: 'Erbengemeinschaft Muster',
				person_names: 'Anna Muster; Beat Muster'
			}
		});
		expect(v.satz?.displayName).toBe('Erbengemeinschaft Muster');
	});

	it('meldet zweimal denselben Namen, statt die Übernahme abbrechen zu lassen', () => {
		// `erstelleGemeinschaftlicheZeile` weist das ab (Entscheid 26.08.2026).
		// Käme die Absage erst dort, nähme sie allen übrigen Zeilen ihren Lauf.
		const v = pruefeEigentuemerZeile({
			nummer: 4,
			werte: { voter_ref: 'P-4', person_names: 'Anna Muster; Anna Muster' }
		});
		expect(v.vorgang).toBe('fehlerhaft');
		expect(v.befund?.grund).toMatch(/steht zweimal/);
		expect(v.befund?.spalte).toBe('person_names');
	});

	it('meldet einen zu kurzen Personennamen mit seiner Stellung', () => {
		// Jede Mitgliedszeile läuft beim Schreiben durch `pruefeEigentuemer` und
		// braucht dort zwei Zeichen. Stünde die Prüfung nur dort, bräche die ganze
		// Übernahme mitten in der Transaktion ab — der Sammelname «A und Beat
		// Muster» ist lang genug und fiele hier nicht auf.
		const v = pruefeEigentuemerZeile({
			nummer: 7,
			werte: { voter_ref: 'P-7', person_names: 'A; Beat Muster' }
		});
		expect(v.vorgang).toBe('fehlerhaft');
		expect(v.befund?.grund).toMatch(/^1\. Person/);
		expect(v.befund?.grund).toMatch(/zu kurz/);
	});

	it('meldet einen Vertreter, der nicht zu den Genannten gehört', () => {
		const v = pruefeEigentuemerZeile({
			nummer: 5,
			werte: {
				voter_ref: 'P-5',
				person_names: 'Anna Muster; Beat Muster',
				legal_representatives: 'Cora Muster'
			}
		});
		expect(v.vorgang).toBe('fehlerhaft');
		expect(v.befund?.grund).toMatch(/gehört nicht/);
		expect(v.befund?.spalte).toBe('legal_representatives');
	});

	it('lässt eine gemeinschaftliche Zeile ohne Personenliste durch', () => {
		// Der Bestand vor Migration 094 und «Erbengemeinschaft Muster» ohne
		// Namensliste: eine Zeile mit dem Haken und einem Vertreter als Text.
		const v = pruefeEigentuemerZeile({
			nummer: 6,
			werte: {
				voter_ref: 'P-6',
				display_name: 'Erbengemeinschaft Muster',
				ownership_type: 'gesamteigentum',
				legal_representatives: 'Cora Muster'
			}
		});
		expect(v.vorgang).toBe('neu');
		expect(v.satz?.isCommunity).toBe(true);
		expect(v.satz?.representativeName).toBe('Cora Muster');
	});
});

describe('Eine Zeile, an der schon Mitberechtigte hängen', () => {
	const HUELLE: Bestand = {
		...LEER,
		eigentuemer: [
			{
				ref: 'P-2',
				displayName: 'Anna Muster und Beat Muster',
				kind: 'natural',
				isCommunity: true,
				representativeName: 'Anna Muster',
				authentikSubject: null,
				mitberechtigte: ['Anna Muster', 'Beat Muster'],
				vertreterGesetzt: true
			}
		]
	};

	it('gilt beim zweiten Lauf als unverändert', () => {
		const v = erzeugeVorschau(
			'voter_ref;person_names;legal_representatives\nP-2;Anna Muster|Beat Muster;Anna Muster\n',
			HUELLE
		);
		expect(v.zusammenfassung).toMatchObject({ neu: 0, geaendert: 0, unveraendert: 1 });
	});

	it('meldet eine abweichende Personenliste, statt sie stillschweigend zu übergehen', () => {
		const v = erzeugeVorschau(
			'voter_ref;person_names\nP-2;Anna Muster|Beat Muster|Cora Muster\n',
			HUELLE
		);
		expect(v.hinweise).toHaveLength(1);
		expect(v.hinweise[0]).toMatch(/Cora Muster/);
		expect(v.hinweise[0]).toMatch(/bleiben, wie sie sind/);
	});

	it('hält die Zeile deswegen nicht auf', () => {
		// **Melden, nicht sperren.** Wer von Hand einen dritten Miterben aufgenommen
		// hat, den immotool nicht führt, käme sonst nie mehr an eine Berichtigung
		// des Namens heran — die Zeile fiele bei jedem Lauf durch.
		const v = erzeugeVorschau(
			'voter_ref;display_name;person_names\nP-2;Erbengemeinschaft Muster;Anna Muster|Beat Muster|Cora Muster\n',
			HUELLE
		);
		expect(v.zusammenfassung).toMatchObject({ geaendert: 1, fehlerhaft: 0 });
		expect(v.eigentuemer[0].aenderungen?.displayName).toEqual({
			vorher: 'Anna Muster und Beat Muster',
			nachher: 'Erbengemeinschaft Muster'
		});
	});

	it('schweigt, solange die Personen dieselben sind', () => {
		// Die Sichtprobe zum Hinweis: Im guten Zustand darf er nicht erscheinen,
		// sonst stünde er bei jeder Übernahme da und niemand läse ihn mehr.
		const v = erzeugeVorschau(
			'voter_ref;person_names;legal_representatives\nP-2;Beat Muster|Anna Muster;Anna Muster\n',
			HUELLE
		);
		expect(v.hinweise).toEqual([]);
	});

	it('überspringt den Versuch, den Haken wegzunehmen', () => {
		// `pruefeHakenUmlegbar` hielte das beim Schreiben ebenfalls auf — aber mit
		// einer Ausnahme mitten in der Transaktion, die allen übrigen Zeilen ihren
		// Lauf nimmt. Hier fällt die Entscheidung, bevor etwas geschieht.
		const v = erzeugeVorschau(
			'voter_ref;display_name;ownership_type\nP-2;Anna Muster allein;alleineigentum\n',
			HUELLE
		);
		expect(v.zusammenfassung.fehlerhaft).toBe(1);
		expect(v.befunde[0].grund).toMatch(/hängen 2 Mitberechtigte/);
	});

	it('lässt die gewählte Vertretung stehen, wo die Datei keine führt', () => {
		// immotool führt nicht, wer die Stimme ausübt, und fällt auf die
		// erstgenannte Person zurück. Ohne diese Regel setzte jeder Lauf eine von
		// Hand gewählte Vertretung wieder auf Beat zurück — und meldete die Zeile
		// dazu bei jedem Mal als «geändert».
		const mitBeat: Bestand = {
			...HUELLE,
			eigentuemer: [{ ...HUELLE.eigentuemer[0], representativeName: 'Beat Muster' }]
		};
		const v = erzeugeVorschau('voter_ref;person_names\nP-2;Anna Muster|Beat Muster\n', mitBeat);
		expect(v.zusammenfassung.unveraendert).toBe(1);
	});

	it('vergleicht die Vertretung weiter, solange kein Verweis steht', () => {
		// Die Sichtprobe dazu: Eine gemeinschaftliche Zeile aus der Zeit vor
		// Migration 094 trägt den Vertreter als Text — dort ist die Datei die
		// Quelle, und eine Änderung muss ankommen.
		const alt: Bestand = {
			...LEER,
			eigentuemer: [
				{
					ref: 'P-7',
					displayName: 'Erbengemeinschaft Muster',
					kind: 'natural',
					isCommunity: true,
					representativeName: 'Anna Muster',
					authentikSubject: null,
					mitberechtigte: [],
					vertreterGesetzt: false
				}
			]
		};
		const v = erzeugeVorschau(
			'voter_ref;display_name;ownership_type;legal_representatives\n' +
				'P-7;Erbengemeinschaft Muster;gesamteigentum;Beat Muster\n',
			alt
		);
		expect(v.zusammenfassung.geaendert).toBe(1);
		expect(v.eigentuemer[0].aenderungen?.representativeName).toEqual({
			vorher: 'Anna Muster',
			nachher: 'Beat Muster'
		});
	});
});
