/**
 * Der Merker für den Erfordernisvorschlag (Befund 03.10.2026, Punkt 2).
 *
 * Geprüft wird, was die Anzeige von ihm verlangt: dass er einen Vorschlag
 * unverändert zurückgibt und dass er nichts zurückgibt, was die Karte nicht
 * lesen kann. Ob der Vorschlag inhaltlich stimmt, entscheidet der Server.
 */
import { describe, expect, it } from 'vitest';
import {
	aktualisiereVergleich,
	gehoertZuTraktandum,
	holeGemerktenVorschlag,
	istErledigt,
	merkeVorschlag,
	vorschlagMerker,
	type Ablage,
	type VorschlagAnzeige
} from '../../src/lib/vorschlagmerker';

/** Ein Speicher, wie ihn `sessionStorage` im Browser abgibt. */
class Speicher implements Ablage {
	private inhalt = new Map<string, string>();

	getItem(schluessel: string): string | null {
		return this.inhalt.get(schluessel) ?? null;
	}

	setItem(schluessel: string, wert: string): void {
		this.inhalt.set(schluessel, wert);
	}
}

/** Ein Speicher, der jeden Zugriff verweigert — der private Modus. */
class Gesperrt implements Ablage {
	getItem(): string | null {
		throw new Error('gesperrt');
	}

	setItem(): void {
		throw new Error('gesperrt');
	}
}

function ergebnis(): VorschlagAnzeige {
	return {
		vorschlag: {
			astId: 'a1',
			astTitel: 'Bauen und Sanieren',
			knotenId: 'k-erhaltung',
			titel: 'Erhaltung',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1',
			typ: 'einfaches_mehr',
			grenzfall: false,
			schritte: [
				{
					frageId: 'f1',
					frageText: 'Wird etwas ersetzt?',
					antwortId: 'f1-ja',
					antwortText: 'Ja',
					begruendung: 'Im Text steht ein Ersatz.',
					unsicher: false
				}
			]
		},
		grund: null,
		hinausgegangen: 'Titel: Dachsanierung',
		namenGeschuetzt: 0,
		stufe: 'Infomaniak (CH)',
		dauerMs: 1200,
		nutzungId: 'n-1',
		fehlschlaege: []
	};
}

/** Dasselbe für den Fall, in dem das Modell keine Einschätzung lieferte. */
function fehlschlag(): VorschlagAnzeige {
	return {
		vorschlag: null,
		grund: 'Das Modell konnte das Geschäft keinem Einstieg zuordnen.',
		hinausgegangen: 'Titel: Dachsanierung',
		namenGeschuetzt: 0,
		stufe: null,
		dauerMs: 400,
		nutzungId: 'n-2',
		fehlschlaege: ['Infomaniak (CH): antwortete mit 500 Internal Server Error']
	};
}

describe('vorschlagMerker', () => {
	it('trennt je Versammlung und Traktandum', () => {
		expect(vorschlagMerker('v1', 't1')).not.toBe(vorschlagMerker('v1', 't2'));
		expect(vorschlagMerker('v1', 't1')).not.toBe(vorschlagMerker('v2', 't1'));
	});
});

describe('istErledigt', () => {
	it('erkennt den gesetzten Fall', () => {
		expect(istErledigt(ergebnis(), 'k-erhaltung')).toBe(true);
	});

	it('bleibt falsch, solange kein Erfordernis steht', () => {
		expect(istErledigt(ergebnis(), null)).toBe(false);
		expect(istErledigt(ergebnis(), undefined)).toBe(false);
	});

	it('bleibt falsch bei einem anderen Fall', () => {
		expect(istErledigt(ergebnis(), 'k-sanierung')).toBe(false);
	});

	it('gilt nie für einen Fehlschlag', () => {
		expect(istErledigt(fehlschlag(), 'k-erhaltung')).toBe(false);
	});
});

describe('aktualisiereVergleich', () => {
	const gesetztGleich = { knotenId: 'k-erhaltung', typ: 'einfaches_mehr' as const, titel: 'Erhaltung' };
	const gesetztAnders = { knotenId: 'k-sanierung', typ: 'einfaches_mehr' as const, titel: 'Sanierung' };

	it('rechnet den Vergleich gegen den heute gesetzten Fall', () => {
		// Codeprüfung 04.10.2026, mittel 1: Der gemerkte Vergleich stammte vom
		// Tag der Anfrage; nach einer späteren Änderung des Erfordernisses
		// behauptete er etwas über einen Stand, den es nicht mehr gibt.
		const gemerkt = {
			...ergebnis(),
			vergleich: { art: 'gleich' as const, satz: 'Der Vorschlag deckt sich.', auffaellig: false }
		};

		const neu = aktualisiereVergleich(gemerkt, gesetztAnders);

		expect(neu?.vergleich?.satz).not.toBe('Der Vorschlag deckt sich.');
		expect(neu?.vergleich?.art).not.toBe('gleich');
	});

	it('erkennt den unveränderten Stand als deckungsgleich', () => {
		expect(aktualisiereVergleich(ergebnis(), gesetztGleich)?.vergleich?.art).toBe('gleich');
	});

	it('setzt auch einen fehlenden Vergleich', () => {
		// Beim frischen Formularergebnis liefert der Server keinen mehr; die
		// Anzeige ergänzt ihn gegen den heutigen Stand.
		const ohne = { ...ergebnis(), vergleich: null };

		expect(aktualisiereVergleich(ohne, gesetztGleich)?.vergleich).not.toBeNull();
	});

	it('nimmt den Vergleich zurück, wenn kein Erfordernis gesetzt ist', () => {
		expect(aktualisiereVergleich(ergebnis(), null)?.vergleich).toBeNull();
		expect(aktualisiereVergleich(ergebnis(), undefined)?.vergleich).toBeNull();
	});

	it('lässt Fehlschläge unberührt', () => {
		expect(aktualisiereVergleich(fehlschlag(), gesetztGleich)).toEqual(fehlschlag());
	});

	it('bleibt für nichts bei nichts', () => {
		expect(aktualisiereVergleich(null, gesetztGleich)).toBeNull();
	});
});

describe('gehoertZuTraktandum', () => {
	it('erkennt die eigene Kennung', () => {
		expect(gehoertZuTraktandum({ ...ergebnis(), traktandumId: 't1' }, 't1')).toBe(true);
	});

	it('verwirft eine fremde Kennung', () => {
		// Zweitprüfung 04.10.2026, mittel 1: Der Pfadname ist für alle
		// Traktanden derselbe; die Antwort eines Modellaufrufs kann nach einem
		// Wechsel am Nachbarn eintreffen.
		expect(gehoertZuTraktandum({ ...ergebnis(), traktandumId: 't2' }, 't1')).toBe(false);
	});

	it('verwirft einen Eintrag ohne Kennung', () => {
		// Aus einer Fassung vor dieser Prüfung; lieber einmal zu wenig anzeigen
		// als am falschen Ort.
		expect(gehoertZuTraktandum(ergebnis(), 't1')).toBe(false);
		expect(gehoertZuTraktandum(null, 't1')).toBe(false);
	});
});

describe('merken und holen', () => {
	it('gibt den Vorschlag unverändert zurück', () => {
		const ablage = new Speicher();
		const schluessel = vorschlagMerker('v1', 't1');
		const wert = ergebnis();

		merkeVorschlag(ablage, schluessel, wert);

		expect(holeGemerktenVorschlag(ablage, schluessel)).toEqual(wert);
	});

	it('gibt null zurück, wenn nichts gemerkt ist', () => {
		expect(holeGemerktenVorschlag(new Speicher(), 'leer')).toBeNull();
	});

	it('merkt auch einen Fehlschlag — seine Auskünfte überleben das Neuladen', () => {
		// Codeprüfung 04.10.2026, M2: «Keine Einschätzung möglich» ist ein
		// Ergebnis mit Fehlschlägen und dem übermittelten Text, kein leerer Platz.
		const ablage = new Speicher();
		const schluessel = vorschlagMerker('v1', 't1');
		const wert = fehlschlag();

		merkeVorschlag(ablage, schluessel, wert);

		expect(holeGemerktenVorschlag(ablage, schluessel)).toEqual(wert);
	});

	it('merkt den Fehlschlag auch ohne Nutzung — das Traktandum gibt es nicht mehr', () => {
		// Codeprüfung Runde 2, niedrig 3: `holeVorschlag` liefert dort
		// `nutzungId: null`. Die Karte bietet in diesem Zweig keinen Entscheid an.
		const ablage = new Speicher();
		const schluessel = vorschlagMerker('v1', 't1');
		const wert: VorschlagAnzeige = {
			...fehlschlag(),
			nutzungId: null,
			grund: 'Das Traktandum gibt es nicht mehr.'
		};

		merkeVorschlag(ablage, schluessel, wert);

		expect(holeGemerktenVorschlag(ablage, schluessel)).toEqual(wert);
	});

	it('gibt null zurück, wenn der Eintrag kein JSON ist', () => {
		const ablage = new Speicher();
		ablage.setItem('k', 'kein json {');

		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});

	it('gibt null zurück, wenn ein Pflichtfeld der Karte fehlt', () => {
		const ablage = new Speicher();
		const ohneNutzung = { ...ergebnis(), nutzungId: '' };
		ablage.setItem('k', JSON.stringify(ohneNutzung));

		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});

	it('gibt null zurück, wenn ein Schritt unvollständig ist', () => {
		const ablage = new Speicher();
		const kaputt = ergebnis();
		// @ts-expect-error — genau der Fall: ein Eintrag aus einer älteren Fassung.
		kaputt.vorschlag.schritte[0].antwortText = undefined;
		ablage.setItem('k', JSON.stringify(kaputt));

		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});

	it('gibt null zurück, wenn die Kennung des Vorschlags fehlt', () => {
		// Codeprüfung 04.10.2026, niedrig 2: `istErledigt` liest `knotenId`;
		// ohne sie bliebe die Karte nach dem Übernehmen stehen.
		const ablage = new Speicher();
		const kaputt = ergebnis();
		delete (kaputt.vorschlag as { knotenId?: string } | null)!.knotenId;
		ablage.setItem('k', JSON.stringify(kaputt));

		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});

	it('gibt null zurück, wenn der Typ des Vorschlags fehlt', () => {
		// `aktualisiereVergleich` rechnet mit dem Typ; ohne ihn gäbe es keine
		// Vergleichsart.
		const ablage = new Speicher();
		const kaputt = ergebnis();
		delete (kaputt.vorschlag as { typ?: string } | null)!.typ;
		ablage.setItem('k', JSON.stringify(kaputt));

		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});

	it('bleibt ohne Wirkung, wenn der Speicher gesperrt ist', () => {
		const ablage = new Gesperrt();
		expect(() => merkeVorschlag(ablage, 'k', ergebnis())).not.toThrow();
		expect(holeGemerktenVorschlag(ablage, 'k')).toBeNull();
	});
});
