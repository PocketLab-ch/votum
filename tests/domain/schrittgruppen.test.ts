/**
 * Die Bündelung der Schrittfolge zu Abschnitten (Story 6.7).
 *
 * Neun gleich aussehende Punkte untereinander sind eine Liste, keine Führung.
 * Wichtiger als die Reihenfolge ist hier eine Zusage: **kein Schritt geht
 * verloren.** Fällt einer aus der Zuordnung, verschwände er lautlos aus der
 * Navigation, und niemand merkte es — die Seite dahinter gäbe es weiter.
 */
import { describe, expect, it } from 'vitest';
import {
	schrittgruppen,
	vorbereitungsfortschritt,
	vorbereitungsschritte,
	type Schritt,
	type Vorbereitungslage
} from '$lib/domain/vorbereitung';

const LAGE: Vorbereitungslage = {
	meetingId: 'm',
	stwegId: 's',
	versammlungszustand: 'entwurf',
	datum: '2026-09-15',
	quotenGehenAuf: true,
	anzahlEinheiten: 14,
	anzahlEigentuemer: 14,
	einheitenOhneEigentuemer: 0,
	einheitenErstSpaeter: 0,
	reglementGeprueftAm: '2026-05-01',
	anzahlReglementsregeln: 0,
	anzahlAnwesenheitsregeln: 0,
	anzahlTraktanden: 9,
	traktandenAusVorlage: 0,
	traktandenlisteBestaetigt: true,
	traktandenOhneErfordernis: 0,
	ausfallunterlagenGeholt: [],
	ausfallunterlagenNoetig: ['traktanden', 'unterschriften', 'stimmzettel', 'auszaehlung'],
	einladungErzeugt: false,
	versandVermerkt: false,
	einberufungsfristTage: null,
	heute: '2026-09-01',
	briefkopfHinterlegt: true,
	anzahlZugaenge: 0,
	anzahlStimmberechtigte: 14,
	versiegelt: false,
	protokollnotizen: 0,
	protokollEntwurf: false,
	protokollfassungen: 0,
	vollmachtenOffen: 0,
	vollmachtenWirksam: 0,
	beschluesseGefasst: false
};

describe('Abschnitte', () => {
	it('ordnet die vier Abschnitte in der Reihenfolge des Abends', () => {
		const gruppen = schrittgruppen(vorbereitungsschritte(LAGE));
		expect(gruppen.map((g) => g.titel)).toEqual([
			'Vorbereiten',
			'Ausgeben',
			'An der Versammlung',
			'Danach'
		]);
	});

	/*
	 * **Der Versand steht hinter dem Siegel** (Block 8; Nachzug Block 1b).
	 * «versandt» lässt sich erst wählen, wenn die Versammlung versiegelt ist;
	 * der Versand steckt im Schritt «Protokoll», und der stand in der Leiste
	 * vor dem Siegel. Die Reihenfolge folgt jetzt der Regel: Auswertung,
	 * Siegel, Protokoll — dieselbe Folge, in der `vorbereitungsschritte` die
	 * Schritte anlegt.
	 */
	it('führt «Danach» in der Reihenfolge der Regel: erst das Siegel, dann der Versand', () => {
		const gruppen = schrittgruppen(vorbereitungsschritte(LAGE));
		const danach = gruppen.find((g) => g.titel === 'Danach');
		expect(danach?.schritte.map((s) => s.kennung)).toEqual([
			'auswertung',
			'siegel',
			'protokoll'
		]);
	});

	it('lässt keinen Schritt verschwinden', () => {
		const schritte = vorbereitungsschritte(LAGE);
		const gruppiert = schrittgruppen(schritte).flatMap((g) => g.schritte);
		expect(gruppiert.map((s) => s.kennung).sort()).toEqual(
			schritte.map((s) => s.kennung).sort()
		);
	});

	it('sammelt einen unbekannten Schritt sichtbar auf, statt ihn zu verlieren', () => {
		const fremd: Schritt = {
			kennung: 'weisungen',
			titel: 'Weisungen der Häuser',
			beschreibung: '',
			zustand: 'offen',
			pfad: '/irgendwo'
		};
		const gruppen = schrittgruppen([...vorbereitungsschritte(LAGE), fremd]);
		const letzte = gruppen.at(-1);
		expect(letzte?.titel).toBe('Weiteres');
		expect(letzte?.schritte.map((s) => s.kennung)).toEqual(['weisungen']);
	});

	it('lässt einen leeren Abschnitt weg', () => {
		const nurEiner = vorbereitungsschritte(LAGE).filter((s) => s.kennung === 'traktanden');
		const gruppen = schrittgruppen(nurEiner);
		expect(gruppen).toHaveLength(1);
		expect(gruppen[0].titel).toBe('Vorbereiten');
	});

	it('verträgt eine leere Schrittfolge', () => {
		expect(schrittgruppen([])).toEqual([]);
	});
});

describe('Der laufende Schritt', () => {
	it('ist der erste offene, quer über die Abschnitte', () => {
		// Stammdaten stehen, Traktanden fehlen: Der Balken gehört an die
		// Traktandenliste und nicht an den ersten Punkt der Liste.
		const schritte = vorbereitungsschritte({ ...LAGE, anzahlTraktanden: 0 });
		const ersterOffener = schritte.find((s) => s.zustand === 'offen');
		expect(ersterOffener?.kennung).toBe('traktanden');
	});
});

describe('Fortschritt', () => {
	it('zählt gesperrte Schritte nicht mit', () => {
		// Im Entwurf sind Einladung, Zugänge und Durchführung gesperrt; die
		// Auswertung ebenfalls. Bliebe sie in der Rechnung, klebte die Anzeige am
		// Anfang jeder Versammlung bei einem Drittel, während viel geschieht.
		const schritte = vorbereitungsschritte(LAGE);
		const f = vorbereitungsfortschritt(schritte);
		expect(f.moeglich).toBe(schritte.filter((s) => s.zustand !== 'gesperrt').length);
		expect(f.moeglich).toBeLessThan(schritte.length);
	});

	it('steht bei voller Vorbereitung nicht schon auf hundert', () => {
		// Freigeben ist im Entwurf offen und nicht erledigt.
		const f = vorbereitungsfortschritt(vorbereitungsschritte(LAGE));
		expect(f.anteil).toBeLessThan(100);
	});
});
