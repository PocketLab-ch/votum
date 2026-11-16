import { describe, expect, it } from 'vitest';
import { naechsterSchritt } from '../../src/lib/domain/weiterweg';
import type { Schritt, Schrittzustand } from '../../src/lib/domain/vorbereitung';

function schritt(kennung: string, zustand: Schrittzustand, pfad = `/${kennung}`): Schritt {
	return { kennung, titel: kennung, beschreibung: '', zustand, pfad };
}

const ABLAUF: Schritt[] = [
	schritt('einheiten', 'erledigt'),
	schritt('eigentuemer', 'offen'),
	schritt('traktanden', 'offen'),
	schritt('freigabe', 'offen'),
	schritt('zugaenge', 'gesperrt')
];

describe('Der nächste Schritt', () => {
	it('zeigt von einer Seite ausserhalb des Ablaufs auf den ersten offenen', () => {
		const w = naechsterSchritt(ABLAUF, '/versammlungen/1');
		expect(w?.schritt?.kennung).toBe('eigentuemer');
		expect(w?.hierNochOffen).toBe(false);
	});

	it('geht vorwärts, wenn man mitten im Ablauf steht', () => {
		const w = naechsterSchritt(ABLAUF, '/traktanden');
		expect(w?.schritt?.kennung).toBe('freigabe');
	});

	it('merkt sich, dass die eigene Seite noch offen ist', () => {
		expect(naechsterSchritt(ABLAUF, '/traktanden')?.hierNochOffen).toBe(true);
		expect(naechsterSchritt(ABLAUF, '/einheiten')?.hierNochOffen).toBe(false);
	});

	it('zeigt nie auf die Seite, auf der man schon steht', () => {
		const w = naechsterSchritt(ABLAUF, '/eigentuemer');
		expect(w?.schritt?.kennung).not.toBe('eigentuemer');
		expect(w?.schritt?.kennung).toBe('traktanden');
	});

	it('greift auf einen offenen zurück, statt auf Gesperrtes zu zeigen', () => {
		const w = naechsterSchritt(ABLAUF, '/freigabe');
		// Dahinter steht nur noch «zugaenge», und das ist gesperrt.
		expect(w?.art).toBe('weiter');
		expect(w?.schritt?.kennung).toBe('eigentuemer');
	});

	/**
	 * Eine übersprungene Lücke bleibt sonst für immer liegen: Wer bei der
	 * Freigabe steht und die Eigentümer nicht erfasst hat, bekäme kein Ziel mehr
	 * — obwohl genau dort die Arbeit wartet.
	 */
	it('greift zurück, wenn vorwärts nichts mehr offen ist', () => {
		const ablauf = [
			schritt('einheiten', 'offen'),
			schritt('eigentuemer', 'erledigt'),
			schritt('traktanden', 'erledigt')
		];
		expect(naechsterSchritt(ablauf, '/traktanden')?.schritt?.kennung).toBe('einheiten');
	});

	it('nennt den Abschluss, wenn nichts mehr kommt', () => {
		// Früher schwieg die Leiste hier. Ein Satz ist besser: Wer auf der letzten
		// Seite steht, soll lesen können, dass er durch ist.
		const fertig = [schritt('einheiten', 'erledigt'), schritt('eigentuemer', 'erledigt')];
		expect(naechsterSchritt(fertig, '/einheiten')?.art).toBe('abschluss');
	});

	/**
	 * Der Fall, an dem die Führung zuerst endete: Auf der Freigabe ist nichts
	 * anderes offen, weil erst die Freigabe das Weitere freischaltet. Ohne
	 * Ausblick stünde man dort vor einer leeren Seite.
	 */
	it('nennt den gesperrten Schritt, wenn sonst nichts offen ist', () => {
		const ablauf = [
			schritt('traktanden', 'erledigt'),
			schritt('freigabe', 'offen'),
			schritt('zugaenge', 'gesperrt')
		];
		const w = naechsterSchritt(ablauf, '/freigabe');
		expect(w?.art).toBe('ausblick');
		expect(w?.schritt?.kennung).toBe('zugaenge');
		expect(w?.hierNochOffen).toBe(true);
	});

	it('zieht einen offenen Schritt einem gesperrten vor', () => {
		const ablauf = [
			schritt('einheiten', 'offen'),
			schritt('freigabe', 'offen'),
			schritt('zugaenge', 'gesperrt')
		];
		expect(naechsterSchritt(ablauf, '/freigabe')?.art).toBe('weiter');
	});

	/**
	 * Der Befund vom 02.08.2026: Von den Zugängen führte der Weg unmittelbar zur
	 * Sitzungsleitung, und auf der Anwesenheitsseite sogar zurück zur Einladung.
	 * Beides, weil die Anwesenheit damals kein Schritt war, sondern ein Zusatz
	 * der Seitenleiste — die Rechnung kannte sie nicht.
	 *
	 * Geprüft für beide Zustände, in denen der Abschnitt offen ist: nach der
	 * Freigabe und während der Versammlung.
	 */
	it.each(['freigegeben', 'laufend'])('führt in %s vom Zugang zum Eingang', () => {
		const ablauf = [
			schritt('zugaenge', 'offen', '/zugaenge'),
			schritt('anwesenheit', 'offen', '/anwesenheit'),
			schritt('durchfuehrung', 'offen', '/leitung')
		];
		expect(naechsterSchritt(ablauf, '/zugaenge')?.schritt?.kennung).toBe('anwesenheit');
		expect(naechsterSchritt(ablauf, '/anwesenheit')?.schritt?.kennung).toBe('durchfuehrung');
	});

	/** Der Abfrageteil gehört nicht zur Seite — `?zur=…` trägt die Herkunft. */
	it('vergleicht Pfade ohne Abfrageteil', () => {
		const ablauf = [
			schritt('einheiten', 'erledigt', '/gemeinschaften/7/einheiten?zur=42'),
			schritt('eigentuemer', 'offen', '/gemeinschaften/7/eigentuemer?zur=42')
		];
		// Der eigene Schritt zählt nicht — auch nicht mit Abfrageteil in der
		// Adresse. Bliebe der Vergleich daran hängen, führte die Leiste auf die
		// Seite, auf der man schon steht.
		expect(naechsterSchritt(ablauf, '/gemeinschaften/7/eigentuemer')?.art).toBe('abschluss');
	});
});

describe('Am Ende des Ablaufs', () => {
	/**
	 * Gemeldet am 04.08.2026: Vom Protokoll — dem letzten Schritt — führte die
	 * Leiste zurück zu «Einladung erzeugen». Für eine geschlossene Versammlung
	 * ist das keine Führung, sondern eine Irreführung: Die Einladung wäre vor der
	 * Sitzung fällig gewesen.
	 */
	const ablauf: Schritt[] = [
		{ kennung: 'einladung', titel: 'Einladung erzeugen', beschreibung: '', zustand: 'offen', pfad: '/einladung' },
		{ kennung: 'auswertung', titel: 'Auswertung', beschreibung: '', zustand: 'erledigt', pfad: '/auswertung' },
		{ kennung: 'protokoll', titel: 'Protokoll', beschreibung: '', zustand: 'offen', pfad: '/protokoll' }
	];

	it('greift bei geschlossener Versammlung nicht mehr zurück', () => {
		const w = naechsterSchritt(ablauf, '/protokoll', false);
		expect(w?.art).toBe('abschluss');
		expect(w?.schritt).toBeUndefined();
	});

	it('greift zurück, solange die Versammlung läuft', () => {
		// Vorher ist ein übersprungener Schritt eine Lücke, die man schliessen
		// kann — und die sonst für immer liegen bliebe.
		const w = naechsterSchritt(ablauf, '/protokoll', true);
		expect(w?.art).toBe('weiter');
		expect(w?.schritt?.kennung).toBe('einladung');
	});

	it('führt auch bei geschlossener Versammlung vorwärts', () => {
		// Kein Rückgriff heisst nicht: keine Führung. Was danach kommt, bleibt.
		const w = naechsterSchritt(ablauf, '/auswertung', false);
		expect(w?.art).toBe('weiter');
		expect(w?.schritt?.kennung).toBe('protokoll');
	});

	it('endet mit einem Abschluss statt mit Schweigen', () => {
		const fertig: Schritt[] = [
			{ kennung: 'auswertung', titel: 'Auswertung', beschreibung: '', zustand: 'erledigt', pfad: '/auswertung' },
			{ kennung: 'protokoll', titel: 'Protokoll', beschreibung: '', zustand: 'erledigt', pfad: '/protokoll' }
		];
		expect(naechsterSchritt(fertig, '/protokoll')?.art).toBe('abschluss');
	});
});
