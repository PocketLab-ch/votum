/**
 * Die Übersicht über Versammlungen und Abende.
 *
 * Geprüft wird, was die Liste **verschweigt**, nicht nur, was sie zeigt: eine
 * laufende Versammlung, die im falschen Fach landet, ein Abend, der mit seinen
 * Treffern verschwindet, ein Filterknopf, der ins Leere führt. Alles drei fällt
 * beim Durchklicken erst auf, wenn genug Bestand da ist — und dann im Saal.
 */
import { describe, expect, it } from 'vitest';
import {
	abendstand,
	arbeitsstand,
	baueUebersicht,
	filtereGemeinschaften,
	suchwoerter,
	zaehleZustaende,
	type Abendeintrag,
	type Versammlungseintrag
} from '$lib/domain/versammlungsliste';
import type { Versammlungszustand } from '$lib/domain/versammlung';

function v(
	id: string,
	zustand: Versammlungszustand,
	datum: string,
	rest: Partial<Versammlungseintrag> = {}
): Versammlungseintrag {
	return {
		id,
		datum,
		uhrzeit: '19:00',
		ort: 'Saal',
		gemeinschaftName: 'Nirgendweg 5/5a',
		art: 'ordentlich',
		stufe: 'erste',
		anlass: null,
		zustand,
		tagId: null,
		archiviertAm: null,
		gemeinschaftArchiviertSeit: null,
		...rest
	};
}

function abend(id: string, datum: string, rest: Partial<Abendeintrag> = {}): Abendeintrag {
	return { id, bezeichnung: 'Abend Nirgendwerk', datum, uhrzeit: '17:00', ort: 'Nirgendheim', ...rest };
}

/** Das Fach mit dem gesuchten Namen — die Fächer stehen immer alle da. */
function fach(faecher: ReturnType<typeof baueUebersicht>, stand: string) {
	const treffer = faecher.find((f) => f.stand === stand);
	if (!treffer) throw new Error(`Fach ${stand} fehlt`);
	return treffer;
}

describe('Einteilung in Fächer', () => {
	it('ordnet jeden Zustand einem Fach zu', () => {
		expect(arbeitsstand('laufend')).toBe('laufend');
		expect(arbeitsstand('entwurf')).toBe('kommend');
		expect(arbeitsstand('freigegeben')).toBe('kommend');
		expect(arbeitsstand('versiegelt')).toBe('abgeschlossen');
	});

	it('stellt die geschlossene Versammlung zur Nacharbeit, nicht zum Erledigten', () => {
		// Geschlossen heisst: Protokoll und Siegel fehlen noch. Beim Erledigten
		// stünde diese Arbeit zwischen Dutzenden versiegelter Zeilen.
		expect(arbeitsstand('geschlossen')).toBe('nachzuarbeiten');
	});

	it('zeigt alle vier Fächer, auch die leeren', () => {
		const faecher = baueUebersicht([], []);
		expect(faecher.map((f) => f.stand)).toEqual([
			'laufend',
			'kommend',
			'nachzuarbeiten',
			'abgeschlossen'
		]);
		expect(faecher.every((f) => f.zeilen.length === 0)).toBe(true);
	});

	it('klappt nur das Abgeschlossene zu', () => {
		const faecher = baueUebersicht([], []);
		expect(faecher.filter((f) => f.zugeklappt).map((f) => f.stand)).toEqual(['abgeschlossen']);
	});
});

describe('Reihenfolge', () => {
	it('stellt beim Kommenden das Nächste nach oben', () => {
		const faecher = baueUebersicht(
			[v('a', 'entwurf', '2026-11-30'), v('b', 'freigegeben', '2026-09-11')],
			[]
		);
		expect(fach(faecher, 'kommend').zeilen.map((z) => z.schluessel)).toEqual(['b', 'a']);
	});

	it('stellt beim Abgeschlossenen das Jüngste nach oben', () => {
		const faecher = baueUebersicht(
			[v('alt', 'versiegelt', '2025-05-19'), v('neu', 'versiegelt', '2026-05-19')],
			[]
		);
		expect(fach(faecher, 'abgeschlossen').zeilen.map((z) => z.schluessel)).toEqual(['neu', 'alt']);
	});

	it('trennt bei gleichem Datum nach der Uhrzeit', () => {
		const faecher = baueUebersicht(
			[
				v('spaet', 'entwurf', '2026-09-11', { uhrzeit: '20:00' }),
				v('frueh', 'entwurf', '2026-09-11', { uhrzeit: '17:00' })
			],
			[]
		);
		expect(fach(faecher, 'kommend').zeilen.map((z) => z.schluessel)).toEqual(['frueh', 'spaet']);
	});
});

describe('Der Abend als eine Zeile', () => {
	const tag = abend('t-1', '2026-05-19');
	const drin = [
		v('h4', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Haus 4', tagId: 't-1' }),
		v('eh', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Einstellhalle', tagId: 't-1' })
	];

	it('fasst die Versammlungen eines Abends zu einer Zeile zusammen', () => {
		const faecher = baueUebersicht(drin, [tag]);
		const zeilen = fach(faecher, 'abgeschlossen').zeilen;
		expect(zeilen).toHaveLength(1);
		expect(zeilen[0].art).toBe('abend');
		if (zeilen[0].art !== 'abend') return;
		expect(zeilen[0].versammlungen.map((x) => x.id)).toEqual(['h4', 'eh']);
		expect(zeilen[0].gesamt).toBe(2);
	});

	it('zählt die Versammlungen des Abends, nicht den Abend', () => {
		expect(fach(baueUebersicht(drin, [tag]), 'abgeschlossen').anzahl).toBe(2);
	});

	it('hebt den ganzen Abend ins laufende Fach, sobald eine Versammlung läuft', () => {
		// Der wichtigste Fall: Läuft eine von sieben, wird an diesem Abend
		// gearbeitet. Stünde er beim Abgeschlossenen, suchte man ihn im Saal.
		const gemischt = [
			drin[0],
			v('eh', 'laufend', '2026-05-19', { gemeinschaftName: 'Einstellhalle', tagId: 't-1' })
		];
		expect(abendstand(gemischt)).toBe('laufend');
		expect(fach(baueUebersicht(gemischt, [tag]), 'laufend').zeilen).toHaveLength(1);
		expect(fach(baueUebersicht(gemischt, [tag]), 'abgeschlossen').zeilen).toHaveLength(0);
	});

	it('stellt den Abend ohne zugeordnete Versammlung zu den kommenden', () => {
		const faecher = baueUebersicht([], [abend('leer', '2020-01-01')]);
		expect(fach(faecher, 'kommend').zeilen).toHaveLength(1);
		expect(fach(faecher, 'kommend').anzahl).toBe(0);
	});

	it('lässt eine Versammlung nicht verschwinden, deren Abend fehlt', () => {
		// Kommt vor, wenn die Abende gefiltert geladen werden. Die Versammlung
		// steht dann für sich — unsichtbar wird sie nie.
		const faecher = baueUebersicht([v('w', 'entwurf', '2026-09-11', { tagId: 'weg' })], []);
		expect(fach(faecher, 'kommend').zeilen.map((z) => z.schluessel)).toEqual(['w']);
	});
});

describe('Suche', () => {
	const bestand = [
		v('s', 'entwurf', '2026-09-11', { gemeinschaftName: 'Nirgendweg 5/5a', ort: 'Quorumprobe' }),
		v('e', 'versiegelt', '2026-08-09', { gemeinschaftName: 'E2E 20260808190314', ort: 'Prüfsaal' })
	];

	it('findet über den Namen der Gemeinschaft', () => {
		expect(fach(baueUebersicht(bestand, [], { suche: 'nirgendweg' }), 'kommend').zeilen).toHaveLength(1);
		expect(
			fach(baueUebersicht(bestand, [], { suche: 'nirgendweg' }), 'abgeschlossen').zeilen
		).toHaveLength(0);
	});

	it('findet über den Ort', () => {
		expect(fach(baueUebersicht(bestand, [], { suche: 'prüfsaal' }), 'abgeschlossen').zeilen).toHaveLength(1);
	});

	it('findet dasselbe Datum in allen drei Schreibweisen', () => {
		for (const eingabe of ['2026-09-11', '11.09.2026', '11. September 2026', 'september']) {
			expect(fach(baueUebersicht(bestand, [], { suche: eingabe }), 'kommend').zeilen).toHaveLength(1);
		}
	});

	it('verbindet mehrere Wörter mit UND, nicht mit ODER', () => {
		expect(suchwoerter('  Nirgendweg   Entwurf ')).toEqual(['nirgendweg', 'entwurf']);
		// «nirgendweg prüfsaal» gibt es nicht — bei ODER käme hier alles zurück.
		const faecher = baueUebersicht(bestand, [], { suche: 'nirgendweg prüfsaal' });
		expect(faecher.reduce((n, f) => n + f.zeilen.length, 0)).toBe(0);
	});

	it('sucht ohne Rücksicht auf Gross- und Kleinschreibung', () => {
		expect(fach(baueUebersicht(bestand, [], { suche: 'NIRGENDWEG' }), 'kommend').zeilen).toHaveLength(1);
	});

	it('zeigt den Abend mit allen Versammlungen, wenn seine Bezeichnung passt', () => {
		const tag = abend('t-1', '2026-05-19', { bezeichnung: 'Abend Nirgendwerk' });
		const drin = [
			v('h4', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Haus 4', tagId: 't-1' }),
			v('eh', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Einstellhalle', tagId: 't-1' })
		];
		const zeile = fach(baueUebersicht(drin, [tag], { suche: 'nirgendwerk' }), 'abgeschlossen').zeilen[0];
		expect(zeile.art).toBe('abend');
		if (zeile.art !== 'abend') return;
		expect(zeile.versammlungen).toHaveLength(2);
	});

	it('zeigt den Abend mit dem einen Treffer, wenn nur eine Versammlung passt', () => {
		const tag = abend('t-1', '2026-05-19');
		const drin = [
			v('h4', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Haus 4', tagId: 't-1' }),
			v('eh', 'versiegelt', '2026-05-19', { gemeinschaftName: 'Einstellhalle', tagId: 't-1' })
		];
		const zeile = fach(baueUebersicht(drin, [tag], { suche: 'einstellhalle' }), 'abgeschlossen')
			.zeilen[0];
		expect(zeile.art).toBe('abend');
		if (zeile.art !== 'abend') return;
		expect(zeile.versammlungen.map((x) => x.id)).toEqual(['eh']);
		// Die Gesamtzahl bleibt stehen, damit niemand den Abend für zweiteilig hält.
		expect(zeile.gesamt).toBe(2);
	});
});

describe('Filter nach Zustand', () => {
	const bestand = [
		v('a', 'laufend', '2026-08-31'),
		v('b', 'entwurf', '2026-09-11'),
		v('c', 'versiegelt', '2026-08-09')
	];

	it('lässt nur den gewählten Zustand stehen', () => {
		const faecher = baueUebersicht(bestand, [], { zustand: 'entwurf' });
		expect(faecher.reduce((n, f) => n + f.anzahl, 0)).toBe(1);
		expect(fach(faecher, 'kommend').zeilen.map((z) => z.schluessel)).toEqual(['b']);
	});

	it('greift auch innerhalb eines Abends, dessen Name passt', () => {
		const tag = abend('t-1', '2026-05-19');
		const drin = [
			v('offen', 'laufend', '2026-05-19', { tagId: 't-1' }),
			v('fertig', 'versiegelt', '2026-05-19', { tagId: 't-1' })
		];
		const faecher = baueUebersicht(drin, [tag], { suche: 'nirgendwerk', zustand: 'laufend' });
		const zeile = fach(faecher, 'laufend').zeilen[0];
		expect(zeile.art).toBe('abend');
		if (zeile.art !== 'abend') return;
		expect(zeile.versammlungen.map((x) => x.id)).toEqual(['offen']);
	});

	it('blendet den Abend ohne Versammlungen aus, sobald nach einem Zustand gefiltert wird', () => {
		const leer = [abend('leer', '2026-09-11')];
		expect(baueUebersicht([], leer, {}).reduce((n, f) => n + f.zeilen.length, 0)).toBe(1);
		expect(
			baueUebersicht([], leer, { zustand: 'entwurf' }).reduce((n, f) => n + f.zeilen.length, 0)
		).toBe(0);
	});
});

describe('Auswahl der Gemeinschaft beim Anlegen', () => {
	const g = [
		{ id: '1', name: 'Nirgendweg 5/5a', adresse: 'Nirgendweg 5, 9999 Nirgendheim' },
		{ id: '2', name: 'Haus 4', adresse: 'Nirgendwerkstrasse 3, 9999 Nirgendheim' },
		{ id: '3', name: 'Haus 4', adresse: 'Rosenweg 4, 3011 Bern' }
	];

	it('gibt ohne Suche alles zurück, in der Reihenfolge, in der es kam', () => {
		expect(filtereGemeinschaften(g, '').map((x) => x.id)).toEqual(['1', '2', '3']);
		expect(filtereGemeinschaften(g, '   ').map((x) => x.id)).toEqual(['1', '2', '3']);
	});

	it('findet über den Namen', () => {
		expect(filtereGemeinschaften(g, 'nirgendweg').map((x) => x.id)).toEqual(['1']);
	});

	it('unterscheidet zwei gleichnamige Gemeinschaften über die Adresse', () => {
		// Ohne die Adresse in der Suche bliebe hier zweimal «Haus 4» stehen, und
		// die Wahl fiele auf gut Glück.
		expect(filtereGemeinschaften(g, 'haus 4 bern').map((x) => x.id)).toEqual(['3']);
	});

	it('kommt mit fehlender Adresse zurecht', () => {
		const ohne = [{ id: '9', name: 'Ohne Adresse' }];
		expect(filtereGemeinschaften(ohne, 'ohne')).toHaveLength(1);
		expect(filtereGemeinschaften(ohne, 'bern')).toHaveLength(0);
	});
});

describe('Zahlen an den Filterknöpfen', () => {
	const bestand = [
		v('a', 'laufend', '2026-08-31'),
		v('b', 'entwurf', '2026-09-11'),
		v('c', 'versiegelt', '2026-08-09', { gemeinschaftName: 'E2E 1' }),
		v('d', 'versiegelt', '2026-08-06', { gemeinschaftName: 'E2E 2' })
	];

	it('zählt je Zustand und insgesamt', () => {
		const { gesamt, je } = zaehleZustaende(bestand);
		expect(gesamt).toBe(4);
		expect(je).toEqual([
			{ zustand: 'laufend', anzahl: 1 },
			{ zustand: 'entwurf', anzahl: 1 },
			{ zustand: 'versiegelt', anzahl: 2 }
		]);
	});

	it('lässt Zustände ohne Treffer weg — ein Knopf ins Leere ist eine Sackgasse', () => {
		expect(zaehleZustaende(bestand).je.map((z) => z.zustand)).not.toContain('geschlossen');
	});

	it('zählt innerhalb der Suche, damit die Zahlen zum Sichtbaren passen', () => {
		const { gesamt, je } = zaehleZustaende(bestand, 'e2e');
		expect(gesamt).toBe(2);
		expect(je).toEqual([{ zustand: 'versiegelt', anzahl: 2 }]);
	});
});
