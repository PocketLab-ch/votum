import { describe, expect, it } from 'vitest';
import { erkenneTrennzeichen, schreibe, zerlege, zerlegePersonen } from '$lib/domain/csv';

describe('erkenneTrennzeichen', () => {
	it('erkennt das Semikolon, das Excel in der Schweiz schreibt', () => {
		expect(erkenneTrennzeichen('voter_ref;display_name;person_names')).toBe(';');
	});

	it('erkennt das Komma', () => {
		expect(erkenneTrennzeichen('voter_ref,display_name,person_names')).toBe(',');
	});

	it('erkennt den Tabulator', () => {
		expect(erkenneTrennzeichen('voter_ref\tdisplay_name\tperson_names')).toBe('\t');
	});

	it('zählt ein Trennzeichen innerhalb von Anführungszeichen nicht mit', () => {
		// Sonst gewänne das Komma, und die Datei würde als einspaltig gelesen —
		// mit der Meldung «Spalten fehlen», die nichts erklärt.
		expect(erkenneTrennzeichen('ref;"Name, mit Komma";quota')).toBe(';');
	});
});

describe('zerlege', () => {
	it('liest Kopfzeile und Werte', () => {
		const e = zerlege('ref;name\n1;Berger\n2;Kunz\n');
		expect(e.spalten).toEqual(['ref', 'name']);
		expect(e.zeilen).toHaveLength(2);
		expect(e.zeilen[0].werte).toEqual({ ref: '1', name: 'Berger' });
	});

	it('nummeriert die Zeilen wie die Datei, mit der Kopfzeile als 1', () => {
		// Die Nummer landet in der Fehlermeldung; zeigt sie auf die falsche Zeile,
		// sucht der Benutzer am falschen Ort.
		const e = zerlege('ref;name\n1;Berger\n2;Kunz\n');
		expect(e.zeilen.map((z) => z.nummer)).toEqual([2, 3]);
	});

	it('entfernt die Byte-Reihenfolge-Marke von Excel', () => {
		// Bleibt sie stehen, heisst die erste Spalte «﻿ref» und wird nirgends
		// gefunden.
		const e = zerlege('﻿ref;name\n1;Berger\n');
		expect(e.spalten[0]).toBe('ref');
	});

	it('liest ein Trennzeichen innerhalb von Anführungszeichen als Inhalt', () => {
		const e = zerlege('ref;adresse\n1;"Musterweg 3, 3600 Thun"\n');
		expect(e.zeilen[0].werte.adresse).toBe('Musterweg 3, 3600 Thun');
	});

	it('liest doppelte Anführungszeichen als eines', () => {
		const e = zerlege('ref;name\n1;"Wohnung ""Seeblick"""\n');
		expect(e.zeilen[0].werte.name).toBe('Wohnung "Seeblick"');
	});

	it('liest einen Zeilenumbruch innerhalb von Anführungszeichen als Inhalt', () => {
		// Kommt bei Adressen regelmässig vor.
		const e = zerlege('ref;adresse\n1;"Musterweg 3\n3600 Thun"\n2;kurz\n');
		expect(e.zeilen).toHaveLength(2);
		expect(e.zeilen[0].werte.adresse).toBe('Musterweg 3\n3600 Thun');
	});

	it('kommt mit Windows-Zeilenenden zurecht', () => {
		const e = zerlege('ref;name\r\n1;Berger\r\n');
		expect(e.zeilen[0].werte.name).toBe('Berger');
	});

	it('übergeht eine leere Schlusszeile', () => {
		// Excel hängt gern eine an.
		const e = zerlege('ref;name\n1;Berger\n;\n');
		expect(e.zeilen).toHaveLength(1);
	});

	it('liest die letzte Zeile auch ohne abschliessenden Umbruch', () => {
		const e = zerlege('ref;name\n1;Berger');
		expect(e.zeilen).toHaveLength(1);
	});

	it('vereinheitlicht Spaltennamen auf Kleinbuchstaben', () => {
		const e = zerlege('Voter_Ref;Display_Name\n1;Berger\n');
		expect(e.spalten).toEqual(['voter_ref', 'display_name']);
	});

	it('füllt fehlende Felder einer kurzen Zeile mit Leer', () => {
		const e = zerlege('ref;name;quota\n1;Berger\n');
		expect(e.zeilen[0].werte.quota).toBe('');
	});

	it('kommt mit einer leeren Datei zurecht', () => {
		expect(zerlege('').zeilen).toEqual([]);
	});
});

describe('zerlegePersonen', () => {
	it('trennt bei senkrechtem Strich, Semikolon und Zeilenumbruch', () => {
		expect(zerlegePersonen('Renate Berger|Peter Kunz;Anna Meier\nHans Muster')).toEqual([
			'Renate Berger',
			'Peter Kunz',
			'Anna Meier',
			'Hans Muster'
		]);
	});

	it('lässt leere Angaben weg', () => {
		expect(zerlegePersonen('Renate Berger||;Peter Kunz')).toEqual(['Renate Berger', 'Peter Kunz']);
	});

	it('gibt bei leerem Feld eine leere Liste', () => {
		expect(zerlegePersonen('')).toEqual([]);
	});
});

describe('schreibe', () => {
	/** Ohne die Marke davor — sie steht immer voran und stört beim Vergleichen. */
	function ohneMarke(text: string): string {
		return text.replace(/^﻿/, '');
	}

	it('stellt die Byte-Reihenfolge-Marke voran', () => {
		// Ohne sie liest Excel die Datei als Codepage 1252, und «Müller» wird zu
		// «MÃ¼ller».
		expect(schreibe([['Müller']]).charCodeAt(0)).toBe(0xfeff);
	});

	it('trennt mit Strichpunkt', () => {
		// Gegen die Norm und trotzdem richtig: Excel öffnet hierzulande eine
		// kommagetrennte Datei als eine einzige Spalte.
		expect(ohneMarke(schreibe([['a', 'b']]))).toBe('a;b\r\n');
	});

	it('fasst Felder ein, die den Trenner oder Anführungszeichen enthalten', () => {
		expect(ohneMarke(schreibe([['Kunz; Meier']]))).toBe('"Kunz; Meier"\r\n');
		expect(ohneMarke(schreibe([['Er sagte "ja"']]))).toBe('"Er sagte ""ja"""\r\n');
		expect(ohneMarke(schreibe([['Zeile\nZeile']]))).toBe('"Zeile\nZeile"\r\n');
	});

	it('entschärft Felder, die als Formel gelesen würden', () => {
		// Ein Feld wie «=1+1» wird beim Öffnen sonst ausgewertet — bei Namen aus
		// fremder Hand ein bekannter Weg, einer Tabellenkalkulation etwas
		// unterzuschieben.
		expect(ohneMarke(schreibe([['=1+1']]))).toBe("'=1+1\r\n");
		expect(ohneMarke(schreibe([['@SUM(A1)']]))).toBe("'@SUM(A1)\r\n");
		expect(ohneMarke(schreibe([['-2']]))).toBe("'-2\r\n");
	});

	it('lässt sich wieder einlesen', () => {
		// Die beiden Richtungen dieses Moduls müssen zueinander passen, sonst
		// stimmt die eine oder die andere nicht.
		const geschrieben = schreibe([
			['Partei', 'E-Mail'],
			['Kunz; Erben', 'kunz@example.ch'],
			['Meier "Hans"', '']
		]);
		const gelesen = zerlege(geschrieben);
		expect(gelesen.trennzeichen).toBe(';');
		expect(gelesen.zeilen.map((z) => z.werte['partei'])).toEqual(['Kunz; Erben', 'Meier "Hans"']);
	});
});
