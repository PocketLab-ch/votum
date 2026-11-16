/**
 * Die Angabe der Leitung an einem Folgeantrag mit Häkchen im Kern
 * (Entscheid 0045, Punkt 11; Migration 185): die Schranken je Lage, die
 * Angebote, die Sätze an die Leitung und ins Protokoll mit ihrem Wortlaut und
 * die Wörter im Verlauf. Die Wirkung an Stimmsperre, Zählung und Protokoll
 * misst `tests/db/lesart-verwaltungsvollmacht.test.ts`, Block «Entscheid 0045,
 * Punkt 11».
 *
 * Die Wortlaute stehen hier ausgeschrieben, nicht aus den Konstanten
 * abgeschrieben: Sie gehen in die Laien- und Fachprüfung, und eine Änderung
 * soll an dieser Stelle auffallen.
 */
import { describe, expect, it } from 'vitest';
import {
	moeglicheVerwaltungsangaben,
	verlangeVerwaltungsangabe,
	verlangeVerwaltungsangabeZuruecknehmbar,
	verwaltungsangabeImSaal,
	VERWALTUNGSANGABE_ABGESTIMMT,
	VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN,
	VERWALTUNGSANGABE_GRUND_FEHLT,
	VERWALTUNGSANGABE_KEINE,
	VERWALTUNGSANGABE_NICHT_HIER,
	VERWALTUNGSANGABE_OFFEN,
	VERWALTUNGSANGABE_OHNE_ABBERUFUNG,
	VERWALTUNGSANGABE_OHNE_WAHL,
	VERWALTUNGSANGABE_SCHON_GEMACHT,
	type Verwaltungsangabelage
} from '$lib/domain/verwaltungsangabe';
import {
	VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN,
	VERWALTUNG_ANGABE_ANDERE_LEITUNG,
	VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG,
	VERWALTUNG_LEITUNG_LEITUNG,
	VERWALTUNG_RUHEN_LEITUNG,
	verwaltungsangabeAnzeige,
	verwaltungsangabeAngebot,
	verwaltungsangabeProtokollsatz,
	verwaltungssaetzeVorDemEroeffnen
} from '$lib/domain/mehrhinweise';
import { angabenInWorten, beschriftung, EREIGNISARTEN } from '$lib/domain/verlauf';
import { wertwoerter } from '$lib/domain/verlaufswerte';

const WAHL_ANGENOMMEN = { titel: 'Wahl der Neu Verwaltung GmbH', art: 'wahl' as const, angenommen: true };
const ABBERUFUNG_ABGELEHNT = { titel: 'Abberufung der Grossen Verwaltung AG', art: 'abberufung' as const, angenommen: false };

/** Ein Folgeantrag mit Häkchen unter «ruhen», vor dem ersten Durchgang, mit angenommener Wahl daneben. */
const LAGE: Verwaltungsangabelage = {
	folgeantrag: true,
	haekchen: true,
	wahl: 'ruhen',
	verwaltungsknoten: false,
	durchgang: 'keiner',
	gesetzt: null,
	teile: [WAHL_ANGENOMMEN]
};

function absage(f: () => unknown): { kennung: string; message: string } {
	try {
		f();
	} catch (fehler) {
		return fehler as { kennung: string; message: string };
	}
	throw new Error('Die Absage blieb aus.');
}

describe('Die Schranken beim Setzen', () => {
	it('lässt die andere Verwaltung nach angenommener Wahl zu und nennt das tragende Geschwister', () => {
		expect(verlangeVerwaltungsangabe(LAGE, 'andere_verwaltung')).toEqual(WAHL_ANGENOMMEN);
	});

	it('lässt die Kündigung nur nach nicht angenommener Abberufung zu', () => {
		expect(verlangeVerwaltungsangabe({ ...LAGE, teile: [ABBERUFUNG_ABGELEHNT] }, 'kuendigung')).toEqual(
			ABBERUFUNG_ABGELEHNT
		);
		expect(absage(() => verlangeVerwaltungsangabe(LAGE, 'kuendigung'))).toMatchObject({
			kennung: 'geschwister_fehlt',
			message: VERWALTUNGSANGABE_OHNE_ABBERUFUNG
		});
		// Eine angenommene Abberufung trägt die Kündigung nicht.
		expect(
			absage(() =>
				verlangeVerwaltungsangabe({ ...LAGE, teile: [{ ...ABBERUFUNG_ABGELEHNT, angenommen: true }] }, 'kuendigung')
			)
		).toMatchObject({ kennung: 'geschwister_fehlt' });
	});

	it('verlangt für die andere Verwaltung eine angenommene, nicht bloss eine entschiedene Wahl', () => {
		expect(
			absage(() =>
				verlangeVerwaltungsangabe({ ...LAGE, teile: [{ ...WAHL_ANGENOMMEN, angenommen: false }] }, 'andere_verwaltung')
			)
		).toMatchObject({ kennung: 'geschwister_fehlt', message: VERWALTUNGSANGABE_OHNE_WAHL });
		expect(absage(() => verlangeVerwaltungsangabe({ ...LAGE, teile: [] }, 'andere_verwaltung'))).toMatchObject({
			kennung: 'geschwister_fehlt'
		});
	});

	it('sagt ab ohne Folgeantrag, ohne Häkchen und unter «Die Sitzungsleitung entscheidet»', () => {
		for (const lage of [
			{ ...LAGE, folgeantrag: false },
			{ ...LAGE, haekchen: false },
			{ ...LAGE, wahl: 'leitung' as const }
		]) {
			expect(absage(() => verlangeVerwaltungsangabe(lage, 'andere_verwaltung'))).toMatchObject({
				kennung: 'angabe_nicht_hier',
				message: VERWALTUNGSANGABE_NICHT_HIER
			});
		}
	});

	it('sagt am Knoten der Wahl oder Abberufung ab', () => {
		expect(absage(() => verlangeVerwaltungsangabe({ ...LAGE, verwaltungsknoten: true }, 'andere_verwaltung'))).toMatchObject(
			{ kennung: 'angabe_am_verwaltungsknoten', message: VERWALTUNGSANGABE_AM_VERWALTUNGSKNOTEN }
		);
	});

	it('sagt während und nach dem ersten Durchgang ab', () => {
		expect(absage(() => verlangeVerwaltungsangabe({ ...LAGE, durchgang: 'offen' }, 'andere_verwaltung'))).toMatchObject({
			kennung: 'durchgang_offen',
			message: VERWALTUNGSANGABE_OFFEN
		});
		expect(
			absage(() => verlangeVerwaltungsangabe({ ...LAGE, durchgang: 'gewesen' }, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'schon_abgestimmt', message: VERWALTUNGSANGABE_ABGESTIMMT });
	});

	it('sagt ab, wenn schon eine Angabe gemacht ist oder der Grund fehlt', () => {
		expect(
			absage(() => verlangeVerwaltungsangabe({ ...LAGE, gesetzt: 'andere_verwaltung' }, 'andere_verwaltung'))
		).toMatchObject({ kennung: 'schon_gemacht', message: VERWALTUNGSANGABE_SCHON_GEMACHT });
		expect(absage(() => verlangeVerwaltungsangabe(LAGE, ''))).toMatchObject({
			kennung: 'grund_fehlt',
			message: VERWALTUNGSANGABE_GRUND_FEHLT
		});
	});
});

describe('Die Schranken beim Zurücknehmen', () => {
	it('nimmt bis zum ersten Durchgang zurück, auch wenn das Erfordernis seither gewechselt hat', () => {
		expect(verlangeVerwaltungsangabeZuruecknehmbar({ ...LAGE, gesetzt: 'kuendigung', teile: [] })).toBe('kuendigung');
		expect(
			verlangeVerwaltungsangabeZuruecknehmbar({ ...LAGE, gesetzt: 'andere_verwaltung', verwaltungsknoten: true })
		).toBe('andere_verwaltung');
	});

	it('sagt ohne Angabe und nach dem ersten Durchgang ab', () => {
		expect(absage(() => verlangeVerwaltungsangabeZuruecknehmbar(LAGE))).toMatchObject({
			kennung: 'keine_angabe',
			message: VERWALTUNGSANGABE_KEINE
		});
		expect(
			absage(() => verlangeVerwaltungsangabeZuruecknehmbar({ ...LAGE, gesetzt: 'kuendigung', durchgang: 'gewesen' }))
		).toMatchObject({ kennung: 'schon_abgestimmt' });
		expect(
			absage(() => verlangeVerwaltungsangabeZuruecknehmbar({ ...LAGE, gesetzt: 'kuendigung', durchgang: 'offen' }))
		).toMatchObject({ kennung: 'durchgang_offen' });
	});
});

describe('Die Angebote an der Leitung', () => {
	it('bietet je tragendes Geschwister einen Grund an, beide, wenn beide da sind', () => {
		expect(moeglicheVerwaltungsangaben([WAHL_ANGENOMMEN, ABBERUFUNG_ABGELEHNT])).toEqual([
			{ grund: 'andere_verwaltung', titel: WAHL_ANGENOMMEN.titel },
			{ grund: 'kuendigung', titel: ABBERUFUNG_ABGELEHNT.titel }
		]);
		expect(moeglicheVerwaltungsangaben([{ ...WAHL_ANGENOMMEN, angenommen: false }])).toEqual([]);
	});

	it('zeigt das Angebot nur, wo eine Vollmacht der Verwaltung ruhen würde, und die gesetzte Angabe immer', () => {
		expect(verwaltungsangabeImSaal(LAGE, true)).toEqual({
			gesetzt: null,
			angebote: [{ grund: 'andere_verwaltung', titel: WAHL_ANGENOMMEN.titel }]
		});
		expect(verwaltungsangabeImSaal(LAGE, false)).toBeNull();
		expect(verwaltungsangabeImSaal({ ...LAGE, gesetzt: 'andere_verwaltung' }, false)).toEqual({
			gesetzt: 'andere_verwaltung',
			angebote: []
		});
	});

	it('zeigt nichts nach dem ersten Durchgang, am Verwaltungsknoten, unter «leitung» und ohne Lage', () => {
		expect(verwaltungsangabeImSaal({ ...LAGE, durchgang: 'gewesen' }, true)).toBeNull();
		expect(verwaltungsangabeImSaal({ ...LAGE, durchgang: 'offen', gesetzt: 'kuendigung' }, true)).toBeNull();
		expect(verwaltungsangabeImSaal({ ...LAGE, verwaltungsknoten: true }, true)).toBeNull();
		expect(verwaltungsangabeImSaal({ ...LAGE, wahl: 'leitung' }, true)).toBeNull();
		expect(verwaltungsangabeImSaal(null, true)).toBeNull();
	});

	it('baut für die Seite Satz, Knopf und Rückfrage je Grund', () => {
		expect(
			verwaltungsangabeAnzeige({ gesetzt: null, angebote: [{ grund: 'kuendigung', titel: 'Abberufung' }] })
		).toEqual({
			gesetzt: null,
			angebote: [
				{
					grund: 'kuendigung',
					satz: verwaltungsangabeAngebot('kuendigung', 'Abberufung'),
					beschriftung: 'Angeben: Kündigung des Vertrags',
					frage: 'Angeben, dass es in diesem Antrag um die Kündigung des Vertrags geht?',
					folge:
						'Dann zählen die Vollmachten der Verwaltung bei diesem Antrag, bis Sie ihren Ausstand erklären, und ' +
						'das Protokoll nennt Ihre Angabe. Bis zur Abstimmung können Sie sie zurücknehmen.'
				}
			]
		});
		expect(verwaltungsangabeAnzeige(null)).toBeNull();
	});

	it('nennt im Angebot den Titel des tragenden Folgeantrags', () => {
		expect(verwaltungsangabeAngebot('andere_verwaltung', 'Wahl der Neu Verwaltung GmbH')).toBe(
			'Die Versammlung hat die Wahl im Folgeantrag «Wahl der Neu Verwaltung GmbH» angenommen. Ist eine ' +
				'andere als die bisherige Verwaltung gewählt und betrifft dieser Antrag nur die Gewählte, etwa ' +
				'ihre Entschädigung, geben Sie das hier an. Dann ruhen die Vollmachten der bisherigen Verwaltung ' +
				'hier nicht. Nach einer Wiederwahl machen Sie die Angabe nicht. Die Entschädigung der ' +
				'wiedergewählten Verwaltung ist ein Geschäft mit ihr, ihre Vollmachten ruhen dort (abgeleitet aus ' +
				'BGE 134 III 481 E. 3.6 und 3.8). Ist die Gewählte mit der bisherigen verbunden, etwa als Nachfolge- oder ' +
				'Schwesterfirma, ist offen, ob sie ruhen; machen Sie die Angabe dann ebenfalls nicht.'
		);
		expect(verwaltungsangabeAngebot('kuendigung', 'Abberufung der Grossen Verwaltung AG')).toBe(
			'Die Versammlung hat die Abberufung im Folgeantrag «Abberufung der Grossen Verwaltung AG» nicht ' +
				'angenommen. Geht es in diesem Antrag um die Kündigung des Vertrags, geben Sie das hier an. Dann ' +
				'ruhen die Vollmachten der Verwaltung hier nicht von selbst, wie bei der Abberufung. Leitet die ' +
				'Verwaltung die Versammlung, gibt sie den Vorsitz für diesen Folgeantrag ab, bevor jemand die ' +
				'Angabe macht.'
		);
	});
});

describe('Der Satz an die Leitung vor dem Eröffnen', () => {
	const basis = { wahl: 'ruhen' as const, wahlTrotzHaekchen: false, ausstandErklaert: false, abberufungTrotzHaekchen: false };

	it('nennt je Grund den eigenen Satz statt des Satzes zum Ruhen', () => {
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, angabe: 'andere_verwaltung' }, null)).toEqual([
			VERWALTUNG_ANGABE_ANDERE_LEITUNG
		]);
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, angabe: 'kuendigung' }, null)).toEqual([
			VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG
		]);
		// Ohne Angabe der Satz zum Ruhen wie bisher.
		expect(verwaltungssaetzeVorDemEroeffnen(basis, null)).toEqual([VERWALTUNG_RUHEN_LEITUNG]);
	});

	it('nennt den Satz zur Angabe nur unter «ruhen», und die Sperre am Grundantrag geht vor', () => {
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, wahl: 'leitung', angabe: 'andere_verwaltung' }, null)).toEqual([
			VERWALTUNG_LEITUNG_LEITUNG
		]);
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, angabe: 'kuendigung' }, 'Sperre')).toEqual(['Sperre']);
		// Die Abberufung bleibt ihr eigener Satz (die Angabe gibt es dort nicht).
		expect(verwaltungssaetzeVorDemEroeffnen({ ...basis, abberufungTrotzHaekchen: true }, null)).toEqual([
			VERWALTUNG_ABBERUFUNG_TROTZ_HAKEN_RUHEN
		]);
	});

	it('hält den Wortlaut für die andere Verwaltung', () => {
		expect(VERWALTUNG_ANGABE_ANDERE_LEITUNG).toBe(
			'Sie haben angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung betrifft. ' +
				'Votum lässt die Vollmachten der bisherigen Verwaltung hier deshalb nicht ruhen, obwohl die ' +
				'Einladung bei diesem Traktandum sagt, dass sie nicht zählen. Sagen Sie der Versammlung vor der ' +
				'Abstimmung, dass die bisherige Verwaltung von diesem Antrag nicht betroffen ist und ihre ' +
				'Vollmachten deshalb zählen. Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. ' +
				'Sagen Sie dazu: Wer anwesend ist und nichts sagt, kann das Recht verlieren, den Beschluss ' +
				'deswegen anzufechten. Halten Sie eine Beanstandung mit «Rüge festhalten» fest; sagt niemand ' +
				'etwas, vermerken Sie das im Feld «Voten, Begründungen, Ordnungsentscheide». Beanstandet jemand, ' +
				'dass die Vollmachten hier zählen, halten Sie das fest; abstimmen können Sie trotzdem. Betrifft ' +
				'der Antrag doch die bisherige Verwaltung, erklären Sie ihren Ausstand; vor der ersten ' +
				'Abstimmung können Sie die Angabe auch zurücknehmen.'
		);
	});

	it('hält den Wortlaut für die Kündigung, mit dem Teil der Abberufung', () => {
		expect(VERWALTUNG_ANGABE_KUENDIGUNG_LEITUNG).toBe(
			'Sie haben angegeben, dass es hier um die Kündigung des Vertrags nach der nicht angenommenen ' +
				'Abberufung geht. Wie bei der Abberufung ist nicht geklärt, ob die Vollmachten der Verwaltung ruhen. ' +
				'Votum zählt sie, bis Sie den Ausstand der Verwaltung erklären, obwohl die Einladung bei diesem ' +
				'Traktandum sagt, dass sie nicht zählen. Entscheiden Sie, ob sie ruhen, und sagen Sie der ' +
				'Versammlung vor der Abstimmung, dass die Frage nicht geklärt ist und was Sie entschieden haben. ' +
				'Leitet die Verwaltung die Versammlung, gibt sie den Vorsitz für die Behandlung dieses Folgeantrags ' +
				'ab, damit sie nicht selbst über ihre Vollmachten entscheidet. Verlässt die Verwaltung den Raum, ' +
				'erklären Sie ihren Ausstand; mehr dazu im Handbuch unter «Bei der Abberufung der Verwaltung». ' +
				'Fragen Sie vor der Abstimmung, ob jemand diese Zählung beanstandet. Sagen Sie dazu: Wer anwesend ' +
				'ist und nichts sagt, kann das Recht verlieren, den Beschluss deswegen anzufechten. Halten Sie eine ' +
				'Beanstandung mit «Rüge festhalten» fest; sagt niemand etwas, vermerken Sie das im Feld «Voten, ' +
				'Begründungen, Ordnungsentscheide». Beanstandet jemand Ihren Entscheid, halten Sie das fest; ' +
				'abstimmen können Sie trotzdem.'
		);
	});
});

describe('Die Zeile im Protokoll', () => {
	it('nennt je Grund die Angabe und ob die Leitung den Ausstand erklärt hat', () => {
		expect(verwaltungsangabeProtokollsatz('andere_verwaltung', false)).toBe(
			'Die Sitzungsleitung hat angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung ' +
				'betrifft. Anders als die Einladung angekündigt hatte, zählten die Vollmachten der bisherigen ' +
				'Verwaltung hier.'
		);
		expect(verwaltungsangabeProtokollsatz('andere_verwaltung', true)).toBe(
			'Die Sitzungsleitung hat angegeben, dass dieser Antrag eine andere als die bisherige Verwaltung ' +
				'betrifft. Die Vollmachten der bisherigen Verwaltung ruhten trotzdem, weil die Sitzungsleitung ' +
				'ihren Ausstand erklärt hat.'
		);
		expect(verwaltungsangabeProtokollsatz('kuendigung', false)).toBe(
			'Die Sitzungsleitung hat angegeben, dass es bei diesem Antrag um die Kündigung des Vertrags der ' +
				'Verwaltung nach der nicht angenommenen Abberufung ging. Ob ihre Vollmachten dabei ruhen, ist ' +
				'wie bei der Abberufung nicht geklärt. Anders als die Einladung angekündigt hatte, zählten sie ' +
				'hier; die Sitzungsleitung hat ihren Ausstand nicht erklärt.'
		);
		expect(verwaltungsangabeProtokollsatz('kuendigung', true)).toBe(
			'Die Sitzungsleitung hat angegeben, dass es bei diesem Antrag um die Kündigung des Vertrags der ' +
				'Verwaltung nach der nicht angenommenen Abberufung ging. Die Vollmachten der Verwaltung ruhten, ' +
				'weil die Sitzungsleitung ihren Ausstand erklärt hat.'
		);
	});
});

describe('Der Verlauf', () => {
	it('beschriftet beide Ereignisse und schreibt den Grund in Worten', () => {
		expect(beschriftung(EREIGNISARTEN.verwaltungsangabeGemacht)).toBe(
			'Angabe zu den Vollmachten der Verwaltung gemacht'
		);
		expect(beschriftung(EREIGNISARTEN.verwaltungsangabeZurueckgenommen)).toBe(
			'Angabe zu den Vollmachten der Verwaltung zurückgenommen'
		);
		expect(
			angabenInWorten(
				{ traktandum: 'Entschädigung', grund: 'andere_verwaltung', gestuetztAuf: 'Wahl der Neu Verwaltung GmbH' },
				undefined,
				wertwoerter(EREIGNISARTEN.verwaltungsangabeGemacht)
			)
		).toBe(
			'Traktandum: Entschädigung · Grund: Der Antrag betrifft eine andere als die bisherige Verwaltung · ' +
				'Gestützt auf den Folgeantrag: Wahl der Neu Verwaltung GmbH'
		);
		expect(
			angabenInWorten({ grund: 'kuendigung' }, undefined, wertwoerter(EREIGNISARTEN.verwaltungsangabeZurueckgenommen))
		).toBe('Grund: Es geht um die Kündigung des Vertrags nach der nicht angenommenen Abberufung');
	});
});
