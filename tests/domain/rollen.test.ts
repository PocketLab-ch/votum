import { describe, expect, it } from 'vitest';
import { darfStammdatenAendern, rolleInWorten, verlangtVerwaltung } from '$lib/domain/rollen';

/**
 * Die Rollentabelle.
 *
 * Geprüft wird nicht nur, was verboten ist, sondern vor allem, was erlaubt
 * bleiben muss: Eine zu enge Schranke ist im Saal schlimmer als eine zu weite,
 * weil sie die Sitzungsleitung mitten in der Versammlung stehen lässt.
 */
describe('Wer Stammdaten ändern darf', () => {
	it('erlaubt es der Verwaltung', () => {
		expect(darfStammdatenAendern('admin')).toBe(true);
	});

	it('verwehrt es der Sitzungsleitung', () => {
		expect(darfStammdatenAendern('chair')).toBe(false);
	});

	it('verwehrt es ohne Rolle', () => {
		expect(darfStammdatenAendern(null)).toBe(false);
		expect(darfStammdatenAendern(undefined)).toBe(false);
	});

	it('benennt die Rollen im Klartext', () => {
		expect(rolleInWorten('admin')).toBe('Verwaltung');
		expect(rolleInWorten('chair')).toBe('Sitzungsleitung');
	});
});

describe('Welche Aufrufe die Verwaltung verlangen', () => {
	it('lässt jedes Lesen durch — beide Rollen sehen die Stammdaten', () => {
		for (const pfad of [
			'/gemeinschaften',
			'/gemeinschaften/019f-abc/einheiten',
			'/betreiber',
			'/personen/019f-abc'
		]) {
			expect(verlangtVerwaltung(pfad, 'GET')).toBe(false);
			expect(verlangtVerwaltung(pfad, 'HEAD')).toBe(false);
		}
	});

	it('schützt das Ändern der Stammdaten', () => {
		expect(verlangtVerwaltung('/gemeinschaften/neu', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/einheiten', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/eigentuemer', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/uebernahme', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/betreiber', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/personen/019f-abc', 'POST')).toBe(true);
	});

	it('schützt eine neue Unterseite von selbst', () => {
		// Der Kern der Pfadtabelle: Wer morgen `/gemeinschaften/<id>/versicherung`
		// anlegt und nichts weiter tut, hat sie geschützt.
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/versicherung', 'POST')).toBe(true);
	});

	it('lässt die Sitzungsleitung eine Versammlung ansetzen', () => {
		// Sie liegt im Pfad der Gemeinschaft, gehört aber zur Versammlung. Ohne
		// diese Ausnahme nähme die Rollentrennung der Sitzungsleitung genau das,
		// wofür es sie gibt.
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/versammlungen/neu', 'POST')).toBe(false);
	});

	it('öffnet der Sitzungsleitung nur die Seite der Lesarten, nicht die Reglementsseite', () => {
		// Ob sie dort schreiben darf, prüft `speichereLesarten` an der Einstellung
		// der Gemeinschaft (Migration 169); der Pfad öffnet nur den Weg dorthin.
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/lesarten', 'POST')).toBe(false);
		expect(verlangtVerwaltung('/gemeinschaften/[id=kennung]/lesarten', 'POST')).toBe(false);
		// Wer umstellen darf und die Universalversammlung stehen auf der
		// Reglementsseite und bleiben der Verwaltung.
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/reglement', 'POST')).toBe(true);
		// Keine Unterseite steht still mit offen.
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/lesarten/mehr', 'POST')).toBe(true);
		expect(verlangtVerwaltung('/gemeinschaften/019f-abc/lesartenliste', 'POST')).toBe(true);
	});

	it('lässt die Versammlung selbst unangetastet', () => {
		for (const pfad of [
			'/versammlungen/019f-abc/traktanden',
			'/versammlungen/019f-abc/leitung',
			'/versammlungen/019f-abc/anwesenheit',
			'/versammlungen/019f-abc/zugaenge',
			'/tage/neu',
			'/'
		]) {
			expect(verlangtVerwaltung(pfad, 'POST')).toBe(false);
		}
	});

	it('verwechselt keinen Pfad, der nur gleich anfängt', () => {
		// `/personenabgleich` wäre etwas anderes als `/personen`.
		expect(verlangtVerwaltung('/personenabgleich', 'POST')).toBe(false);
		expect(verlangtVerwaltung('/gemeinschaftsraum', 'POST')).toBe(false);
	});
});
