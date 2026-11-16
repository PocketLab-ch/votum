/**
 * Der Wächter über den Abzugswächter: die Werkzeug-Umschreibung an einer Karte
 * mit Lesart und die Verweise ins Leere.
 *
 * **Der Anlass** (A6). Die Regeln im Wächter fingen nur «Votum» und «dieses
 * Werkzeug»; eine Umschreibung wie «Der Quorum-Finder rechnet …» an einer
 * Karte mit Lesart ginge durch. Die Fälle fährt der Test mit `--abzug` über eine
 * Fixture, weil die erfundenen Karten im Bestand nicht vorkommen. Ein Fall fährt
 * den Wächter ohne Fixture über den echten Export, damit der Bestand grün ist.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fahreWaechterMit } from './waechterlauf';

const SKRIPT = join(process.cwd(), 'scripts', 'check-abzug.mjs');
const VERZEICHNISSE: string[] = [];

afterAll(() => {
	for (const v of VERZEICHNISSE) rmSync(v, { recursive: true, force: true });
});

/** Ein Abzug mit einer Karte mit Lesart; `begruendung` trägt die Umschreibung. */
function abzug(begruendung: string): object {
	return {
		fassung: 'fixture',
		quelle: 'fixture',
		aeste: [{ id: 'a-verwaltung' }],
		knoten: [
			{
				id: 'k-bewirtschaftung-waehlen-erweitert',
				titel: 'Bewirtschaftung wählen',
				typ: 'einfaches_mehr',
				lesart: 'L4',
				begruendung
			}
		]
	};
}

function fahre(inhalt: object): { rot: boolean; ausgabe: string } {
	const verzeichnis = mkdtempSync(join(tmpdir(), 'abzug-'));
	VERZEICHNISSE.push(verzeichnis);
	const pfad = join(verzeichnis, 'abzug.json');
	writeFileSync(pfad, JSON.stringify(inhalt), 'utf8');
	// Über `waechterlauf`, nicht mit eigener Kopie der Stapelspur-Regel.
	const lauf = fahreWaechterMit(SKRIPT, ['--abzug', pfad]);
	return { rot: lauf.rot, ausgabe: lauf.ausgabe };
}

describe('Der Abzugswächter', () => {
	it('weist eine Umschreibung des Werkzeugs an einer Karte mit Lesart ab', () => {
		const lauf = fahre(abzug('Der Quorum-Finder rechnet hier mit dem qualifizierten Mehr.'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('Umschreibung');
		expect(lauf.ausgabe).toContain('Quorum-Finder');
	});

	it('lässt eine Karte ohne Umschreibung in Ruhe', () => {
		const lauf = fahre(abzug('Die Wahl der Bewirtschaftung gehört zu den Befugnissen der Versammlung.'));
		expect(lauf.rot).toBe(false);
	});

	/*
	 * **Verweise ins Leere** (Meldung der Website-Sitzung vom 15.11.2026): Der
	 * Kasten an Art. 647a Abs. 2 verwies auf «Zu beachten», den Titel in Votum;
	 * der Quorum-Finder hat ihn nicht.
	 */
	function mitVerweis(satz: string, wortlautAbweichung = true): object {
		return {
			fassung: 'fixture',
			quelle: 'fixture',
			aeste: [{ id: 'a-organe', titel: 'Bewirtschaftung und Organe' }],
			fragen: [{ id: 'f2-1', text: 'Worum geht es genau?', antworten: [] }],
			knoten: [
				{
					id: 'k-bewirtschaftung-waehlen-erweitert',
					titel: 'Bewirtschaftung wählen, die schon erweiterte Kompetenzen hat',
					typ: 'qualifiziertes_mehr',
					lesart: 'L4',
					wortlautAbweichung,
					hinweise: ['Ein Hinweis, damit der Abschnitt mit den Hinweisen erscheint.'],
					wortlautErklaerung: satz
				},
				{ id: 'k-bewirtschaftung-waehlen', titel: 'Bewirtschaftung wählen', typ: 'einfaches_mehr' }
			]
		};
	}

	it('weist einen Verweis auf «Zu beachten» ab, mit Karte und Satz', () => {
		const lauf = fahre(mitVerweis('Das Bundesgericht hat hier nicht entschieden; Näheres unter «Zu beachten».'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('kein Titel des Finders');
		expect(lauf.ausgabe).toContain('Karte k-bewirtschaftung-waehlen-erweitert, wortlautErklaerung');
		expect(lauf.ausgabe).toContain('Näheres unter «Zu beachten».');
	});

	it('weist eine Karte ab, die es im Abzug nicht gibt', () => {
		const lauf = fahre(mitVerweis('Dafür gibt es die Karte «Bewirtschaftung bestellen».'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('«Bewirtschaftung bestellen» ist keine Karte des Abzugs');
	});

	it('lässt Abschnitt, Ast, Frage, Karte und den eigenen Titel gelten', () => {
		const lauf = fahre(
			mitVerweis(
				'Mehr unter «Gut zu wissen». Sie finden ihn unter «Bewirtschaftung und Organe». Welches gilt, zeigt ' +
					'unter «Worum geht es genau?» die Antwort. Sonst gilt die Karte «Bewirtschaftung wählen». Im Titel ' +
					'dieser Karte «erweiterte Kompetenzen» steht es.'
			)
		);
		expect(lauf.ausgabe).not.toContain('Titel, den der Quorum-Finder dort nicht zeigt');
		expect(lauf.rot).toBe(false);
	});

	// Codeprüfung N2: Der Titel stimmt, aber die Karte zeigt den Abschnitt nicht.
	it('weist «Wortlaut und Rechtsprechung» an einer Karte ohne Abweichung vom Wortlaut ab', () => {
		const lauf = fahre(mitVerweis('Wie die Köpfe gezählt werden, steht unter «Wortlaut und Rechtsprechung».', false));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('Die Karte zeigt den Abschnitt «Wortlaut und Rechtsprechung» nicht');
	});

	// Codeprüfung N3: «Unter» am Satzanfang, «Kasten», und der eigene Titel.
	it('weist «Unter «Zu beachten»» am Satzanfang ab', () => {
		const lauf = fahre(mitVerweis('Unter «Zu beachten» steht mehr dazu.'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('«Zu beachten» ist kein Titel des Finders');
	});

	it('lässt nach «Kasten» nur einen Abschnitt gelten, keinen Ast', () => {
		const lauf = fahre(mitVerweis('Das steht im Kasten «Bewirtschaftung und Organe».'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('«Bewirtschaftung und Organe» ist kein Abschnitt des Finders');
		expect(fahre(mitVerweis('Das steht im Kasten «Wortlaut und Rechtsprechung».')).rot).toBe(false);
	});

	it('weist «dieser Karte «X»» ab, wenn X nicht im eigenen Titel steht', () => {
		const lauf = fahre(mitVerweis('Die Zustimmenden, im Titel dieser Karte «die übrigen», zahlen.'));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('«die übrigen» ist kein Teil des eigenen Kartentitels');
	});

	it(
		'lässt den echten Abzug in Ruhe',
		() => {
			// Ohne `--abzug`: Der Wächter fährt den Export wie in `npm run pruefen` (rund zwei Sekunden).
			const lauf = fahreWaechterMit(SKRIPT, []);
			expect(lauf.ausgabe).toContain('Abzug in Ordnung');
			expect(lauf.rot).toBe(false);
		},
		60_000
	);

	it('bricht bei `--abzug` ohne Dateinamen ab, statt den Export zu fahren', () => {
		// Ohne die Abweisung führe der Lauf still den Export, statt die Fixture
		// zu prüfen.
		const lauf = fahreWaechterMit(SKRIPT, ['--abzug']);
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain('braucht einen Dateinamen');
	});
});

/*
 * **Jede Bedingung der Tabelle `ABSCHNITT_AN_DER_KARTE`** (zweiter Codedurchgang,
 * N-b): Je Abschnitt eine Karte, die ihn nicht zeigt (rot), und eine, die ihn zeigt
 * (grün). Der Verweis steht in der Begründung, damit er die geprüften Felder nicht
 * selbst füllt.
 */
type Fall = {
	titel: string;
	ohne: Record<string, unknown>;
	mit: Record<string, unknown>;
	abzugOhne?: Record<string, unknown>;
	inFrage?: boolean;
};

const FAELLE: Fall[] = [
	{ titel: 'Wortlaut und Rechtsprechung', ohne: { wortlautAbweichung: false, wortlautErklaerung: 'Erklärung.' }, mit: { wortlautAbweichung: true, wortlautErklaerung: 'Erklärung.' } },
	// N-a: ohne eigene Erklärung zählt die allgemeine des Abzugs, wie in `callback-api/server.js`.
	{ titel: 'Wortlaut und Rechtsprechung', ohne: { wortlautAbweichung: true, wortlautErklaerung: null }, abzugOhne: { wortlautErklaerung: null }, mit: { wortlautAbweichung: true, wortlautErklaerung: null } },
	{ titel: 'Gut zu wissen', ohne: { hinweise: [] }, mit: { hinweise: ['Ein Hinweis.'] } },
	{ titel: 'Wenn eine Zustimmung fehlt', ohne: { einstimmigkeitsweg: null }, mit: { einstimmigkeitsweg: 'Der Weg.' } },
	{ titel: 'Und Ihr Reglement?', ohne: { reglementshinweis: null }, mit: { reglementshinweis: 'Der Kasten.' } },
	{ titel: 'Unsere Empfehlung', ohne: { empfehlung: null }, mit: { empfehlung: 'Die Empfehlung.' } },
	{ titel: 'Beispiele', ohne: { beispiele: [] }, mit: { beispiele: ['Ein Beispiel.'] } },
	{ titel: 'Zahlenbeispiel', ohne: { typ: 'einfaches_mehr' }, mit: { typ: 'qualifiziertes_mehr' } },
	{ titel: 'Zusätzlich nötig', ohne: { zustimmungBetroffenerNoetig: false }, mit: { zustimmungBetroffenerNoetig: true } },
	{ titel: 'Erforderliches Quorum', ohne: { typ: 'grenzfall' }, mit: { typ: 'einfaches_mehr' } },
	{ titel: 'Erforderliches Quorum', ohne: { typ: 'keine_abstimmung' }, mit: { typ: 'qualifiziertes_mehr' } },
	{ titel: 'Was gilt', ohne: { typ: 'einfaches_mehr' }, mit: { typ: 'keine_abstimmung' } },
	// «Mehr dazu» steht nur unter der Hilfe einer Frage.
	{ titel: 'Mehr dazu', ohne: {}, mit: {}, inFrage: true }
];

function abzugMitAbschnitt(fall: Fall, karte: Record<string, unknown>, abzugFelder: Record<string, unknown>, inFrage: boolean): object {
	const satz = `Einzelheiten unter «${fall.titel}».`;
	return {
		fassung: 'fixture',
		quelle: 'fixture',
		wortlautErklaerung: 'Die allgemeine Erklärung.',
		...abzugFelder,
		aeste: [{ id: 'a-organe', titel: 'Bewirtschaftung und Organe' }],
		fragen: [{ id: 'f2-1', text: 'Worum geht es genau?', hilfe: inFrage ? satz : null, antworten: [] }],
		knoten: [
			{ id: 'k-fixture', titel: 'Erfundene Karte', typ: 'einfaches_mehr', begruendung: inFrage ? null : satz, ...karte },
			{ id: 'k-bewirtschaftung-waehlen-erweitert', titel: 'Bewirtschaftung wählen', typ: 'qualifiziertes_mehr', lesart: 'L4' }
		]
	};
}

describe('Der Abzugswächter und die Abschnitte einer Karte', () => {
	it.each(FAELLE.map((f, i) => [`${f.titel} (${i + 1})`, f] as const))('%s: rot, wenn die Karte ihn nicht zeigt', (_, fall) => {
		const lauf = fahre(abzugMitAbschnitt(fall, fall.ohne, fall.abzugOhne ?? {}, false));
		expect(lauf.rot).toBe(true);
		expect(lauf.ausgabe).toContain(`Die Karte zeigt den Abschnitt «${fall.titel}» nicht`);
	});

	it.each(FAELLE.map((f, i) => [`${f.titel} (${i + 1})`, f] as const))('%s: grün, wenn sie ihn zeigt', (_, fall) => {
		const lauf = fahre(abzugMitAbschnitt(fall, fall.mit, {}, fall.inFrage === true));
		expect(lauf.ausgabe).not.toContain('dort nicht zeigt');
		expect(lauf.rot).toBe(false);
	});
});
