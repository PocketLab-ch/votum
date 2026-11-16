/**
 * Die Prüfung eines vorliegenden Zeitstempels (FR-53, FR-54).
 *
 * **Warum an echten Antworten und nicht an erfundenen Bytes.** Der ganze Sinn
 * dieses Prüfers ist, dass er mit dem zurechtkommt, was Dienste tatsächlich
 * schicken — und die weichen voneinander ab. Erfundene Bytes hätten den Fehler,
 * um den es hier geht, nie gezeigt.
 *
 * (Liegt unter `tests/db`, weil die Prüfung `node:crypto` braucht und deshalb
 * in der Schale steht, nicht im Kern — eine Datenbank braucht sie nicht.)
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { X509Certificate } from 'node:crypto';
import { leseAntwort } from '$lib/domain/rfc3161';
import { SEQUENCE, schreibe, schreibeGanzzahl, verkette } from '$lib/domain/asn1';
import { bezeuge, beurteileZeitstempel, findeUnterzeichner } from '$lib/server/zeitstempel';
import {
	entferneErsatzdienst,
	entferneZeitstempeldienst,
	setzeErsatzdienst,
	setzeZeitstempeldienst
} from '$lib/server/dienste';
import { KETTEN_ANTWORT, KETTEN_PRUEFSUMME } from './zeitstempel-kette.fixture';
import { admin, pruefbenutzer, pruefbetreiber, verbindungenSchliessen } from './helfer';

const antwort = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));

/**
 * Eine Antwort, die die Anfrage **endgültig** abweist (PKIStatus 2).
 *
 * Dieselbe Bauart wie in der Gruppe «Ein misslungener Anlauf wird
 * wiederholt»; hier als Funktion, weil zwei Gruppen sie brauchen. Der
 * Unterschied zu einem 503 ist der Kern des Falls: Wiederholen ändert nichts,
 * also folgt sofort der Ersatz (13.11.2026).
 */
function endgueltigeAbsage(): Uint8Array {
	return schreibe(
		SEQUENCE,
		schreibe(
			SEQUENCE,
			verkette(
				schreibeGanzzahl(2),
				schreibe(SEQUENCE, schreibe(0x0c, new TextEncoder().encode('Richtlinie verbietet das.')))
			)
		)
	);
}

/**
 * Der Zufallswert der **aufgezeichneten** Antwort, für die Ersatzprüfung.
 *
 * **Warum das nötig ist, und was es kostet.** Eine echte Antwort trägt den
 * Zufallswert ihrer Anfrage; `zufallStimmt` weist sie sonst als
 * Wiedereinspielung ab, zu Recht. Damit im Prüflauf überhaupt ein *gültiger*
 * Stempel entsteht, gibt `randomBytes` hier diesen aufgezeichneten Wert zurück.
 * Das ist eine Prüfstandsverkürzung und keine Aussage über den Betrieb: Der
 * Test, der die Wiedereinspielung abwehrt, steht oben und schaltet sie nicht
 * ein.
 */
const pruefZufall = vi.hoisted(() => ({ wert: null as string | null }));

vi.mock('node:crypto', async (importOriginal) => {
	const echt = await importOriginal<typeof import('node:crypto')>();
	return {
		...echt,
		randomBytes: (n: number) =>
			pruefZufall.wert !== null && n === 8
				? Buffer.from(pruefZufall.wert, 'hex')
				: echt.randomBytes(n)
	};
});

describe('Der Unterzeichner in einer Kette', () => {
	it('steht nicht zwingend an erster Stelle', () => {
		// Die Voraussetzung des Tests: Diese Antwort führt mehrere Zertifikate,
		// und das erste ist **nicht** der Unterzeichner. Sonst prüfte er nichts.
		const token = leseAntwort(antwort).token!;
		expect(token.zertifikate.length).toBeGreaterThan(1);

		const gefunden = findeUnterzeichner(token);
		expect(gefunden).not.toBeNull();

		const erstes = new X509Certificate(Buffer.from(token.zertifikate[0]));
		expect(gefunden!.fingerprint256).not.toBe(erstes.fingerprint256);
	});

	it('wird gefunden, und die Beurteilung fällt gültig aus', () => {
		const b = beurteileZeitstempel(antwort, KETTEN_PRUEFSUMME);
		expect(b.gueltig).toBe(true);
		expect(b.lautetAufDiesesManifest).toBe(true);
		expect(b.stelle).toBeTruthy();
		// Der Fingerabdruck muss der des **Unterzeichners** sein — an ihm hängt
		// das Anheften, und ein falscher wiese den richtigen Dienst ab.
		const token = leseAntwort(antwort).token!;
		expect(b.fingerabdruck).toBe(findeUnterzeichner(token)!.fingerprint256);
	});

	it('bemerkt, wenn der Stempel auf ein anderes Manifest lautet', () => {
		const b = beurteileZeitstempel(antwort, 'f'.repeat(64));
		expect(b.gueltig).toBe(false);
		expect(b.lautetAufDiesesManifest).toBe(false);
		expect(b.satz).toMatch(/anderen Manifest/);
	});

	it('nennt eine Datei, die kein Zeitstempel ist, beim Namen', () => {
		const b = beurteileZeitstempel(new TextEncoder().encode('kein DER'), 'a'.repeat(64));
		expect(b.gueltig).toBe(false);
		expect(b.satz).toMatch(/kein lesbarer Zeitstempel/i);
	});
});

/**
 * Wiederholen, wenn ein Anlauf misslingt (Wunsch des Auftraggebers, 04.08.2026).
 *
 * **Warum mit eigenem Dienst statt gegen ein echtes Haus.** Um zu prüfen, dass
 * wiederholt wird, muss der erste Anlauf **sicher** scheitern — und das lässt
 * sich bei einem fremden Dienst nicht bestellen. Der Prüfstand zählt hier
 * mit, wie oft angeklopft wurde; genau darum geht es.
 */
describe('Ein misslungener Anlauf wird wiederholt', () => {
	let dienst: Server | null = null;
	const vorher = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;

	/**
	 * Ein Betreiber ohne eigenen Zeitstempeldienst.
	 *
	 * Seit dem 14.08.2026 fragt `bezeuge` zuerst die Anwendung und fällt auf die
	 * Umgebung zurück. Dieser Prüflauf nimmt genau den Rückfall — er stellt
	 * nichts ein und prüft, dass die Umgebung weiterhin gilt.
	 */
	let betreiber: string;

	beforeAll(async () => {
		betreiber = await pruefbetreiber('Zeitstempel-Prüflauf');
	});

	afterEach(async () => {
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorher;
		if (dienst) await new Promise((f) => dienst!.close(f));
		dienst = null;
	});

	/** Startet einen Dienst, der antwortet, wie die Antwortfolge es vorgibt. */
	async function starte(antworten: ((n: number) => { status: number; koerper?: Uint8Array })[]) {
		const gezaehlt = { anfragen: 0 };
		dienst = createServer((anfrage, antwort) => {
			// Der Rumpf muss gelesen werden, sonst hängt die Verbindung.
			anfrage.on('data', () => {});
			anfrage.on('end', () => {
				const n = ++gezaehlt.anfragen;
				const was = antworten[Math.min(n - 1, antworten.length - 1)](n);
				antwort.writeHead(was.status, { 'content-type': 'application/timestamp-reply' });
				antwort.end(was.koerper ? Buffer.from(was.koerper) : '');
			});
		});
		await new Promise<void>((f) => dienst!.listen(0, '127.0.0.1', f));
		const port = (dienst.address() as { port: number }).port;
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = `http://127.0.0.1:${port}/`;
		return gezaehlt;
	}

	const IRGENDEINE_PRUEFSUMME = 'ab'.repeat(32);

	it('klopft dreimal an, bevor es aufgibt', async () => {
		const gezaehlt = await starte([() => ({ status: 503 })]);

		const ergebnis = await bezeuge(betreiber, IRGENDEINE_PRUEFSUMME);

		expect(gezaehlt.anfragen).toBe(3);
		expect(ergebnis.zustand).toBe('gescheitert');
		// Am Siegel muss stehen, dass es mehrere Anläufe waren — sonst liest sich
		// ein wackelnder Dienst wie ein einmaliger Zufall.
		expect(ergebnis.bemerkung).toMatch(/3 Versuche/);
	}, 30000);

	it('macht nach einem Aussetzer weiter — und prüft den zweiten Anlauf genauso', async () => {
		// Zwei Aussagen in einem Lauf. Erstens: Nach dem 503 wird weitergefragt.
		// Zweitens, und wichtiger: Die Wiederholung senkt die Ansprüche **nicht**.
		// Hier antwortet der Dienst ab dem zweiten Mal mit einer echten, aber
		// **aufgezeichneten** Antwort — genau der Wiedereinspielungsangriff, den
		// der Zufallswert abwehren soll. Sie trägt den Wert von damals, nicht den
		// dieses Anlaufs, und wird deshalb in jedem Anlauf abgewiesen.
		const aufgezeichnet = Uint8Array.from(Buffer.from(KETTEN_ANTWORT, 'base64'));
		const gezaehlt = await starte([
			() => ({ status: 503 }),
			() => ({ status: 200, koerper: aufgezeichnet })
		]);

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		// Weitergefragt wurde — sonst stünde hier 1.
		expect(gezaehlt.anfragen).toBe(3);
		expect(ergebnis.zustand).toBe('gescheitert');
		expect(ergebnis.bemerkung).toMatch(/Zufallswert/);
		expect(ergebnis.bemerkung).toMatch(/3 Versuche/);
	}, 30000);

	it('klopft nicht weiter, wenn der Dienst die Anfrage abweist', async () => {
		// Eine Absage an die Anfrage ändert sich durch Wiederholen nicht.
		// Weiterzuklopfen wäre bloss Lärm — und verzögerte das Versiegeln.
		const gezaehlt = await starte([() => ({ status: 200, koerper: endgueltigeAbsage() })]);

		const ergebnis = await bezeuge(betreiber, IRGENDEINE_PRUEFSUMME);

		expect(gezaehlt.anfragen).toBe(1);
		expect(ergebnis.zustand).toBe('gescheitert');
		expect(ergebnis.bemerkung).toMatch(/nicht angenommen/);
	}, 30000);

	it('lässt einen unerreichbaren Dienst als «nachholen» stehen — nach drei Anläufen', async () => {
		// Kein Dienst am Port: Ohne Netz ist das der Regelfall, und es darf
		// nichts anhalten (AD-9).
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = 'http://127.0.0.1:1/';
		const ergebnis = await bezeuge(betreiber, IRGENDEINE_PRUEFSUMME);
		expect(ergebnis.zustand).toBe('ausstehend');
		expect(ergebnis.bemerkung).toMatch(/3 Versuche/);
	}, 30000);
});

/**
 * Der Ersatzdienst (13.11.2026).
 *
 * **Was hier belegt wird, ist die Ausweichung und ihre Grenze.** Der Ersatz
 * springt ein, wenn der Hauptdienst keinen geprüften Stempel liefert, und er
 * springt **nicht** ein, wenn der Hauptdienst liefert, wenn gar kein
 * Hauptdienst eingetragen ist, oder wenn sein Abdruck nur in der Liste des
 * anderen Hauses steht. Genau diese Grenzen tragen den Beweiswert: Eine
 * Ausweichung, die überall einspringt, ist keine.
 *
 * Die beiden Dienste sind nachgebaute Server (`createServer`), wie oben: Ein
 * fremdes Haus anzurufen wäre im Prüflauf langsam und rot, sobald dort jemand
 * wartet.
 */
describe('Der Ersatzdienst springt ein', () => {
	const token = leseAntwort(antwort).token!;
	/** Der Abdruck des Unterzeichners, also das, was angeheftet gehört. */
	const ABDRUCK = findeUnterzeichner(token)!.fingerprint256;
	/** Ein Abdruck, der zu nichts passt. */
	const FREMD = '11'.repeat(32);
	const TOT = 'http://127.0.0.1:1/';

	let betreiber: string;
	let benutzer: string;
	let dienste: Server[] = [];
	/** Die Umgebung vor jedem Test; einer setzt sie ausdrücklich leer. */
	let vorherUrl: string | undefined;

	function handelnder() {
		return { operatorId: betreiber, userId: benutzer, label: 'Prüflauf' };
	}

	beforeAll(async () => {
		betreiber = await pruefbetreiber('Zeitstempel-Ersatz');
		benutzer = await pruefbenutzer(betreiber, 'Prüflauf');
	});

	beforeEach(async () => {
		// Ohne den aufgezeichneten Zufallswert entstünde kein gültiger Stempel;
		// siehe `pruefZufall` oben. Nur diese Gruppe schaltet ihn ein.
		pruefZufall.wert = token.zufall;
		vorherUrl = process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		await admin`
			UPDATE operator SET
				tsa_url = NULL, tsa_name = NULL, tsa_fingerprints = NULL,
				tsa_fallback_url = NULL, tsa_fallback_name = NULL, tsa_fallback_fingerprints = NULL
			WHERE id = ${betreiber}
		`;
	});

	afterEach(async () => {
		pruefZufall.wert = null;
		if (vorherUrl === undefined) delete process.env.VERSAMMLUNG_ZEITSTEMPEL_URL;
		else process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = vorherUrl;
		for (const d of dienste) await new Promise((f) => d.close(f));
		dienste = [];
		await entferneZeitstempeldienst(handelnder());
		await entferneErsatzdienst(handelnder());
	});

	/** Ein nachgebauter Dienst, der zählt, wie oft er gefragt wurde. */
	async function dienstAn(
		antworten: ((n: number) => { status: number; koerper?: Uint8Array })[]
	): Promise<{ zaehler: { anfragen: number }; url: string }> {
		const zaehler = { anfragen: 0 };
		const server = createServer((anfrage, antwort) => {
			anfrage.on('data', () => {});
			anfrage.on('end', () => {
				const n = ++zaehler.anfragen;
				const was = antworten[Math.min(n - 1, antworten.length - 1)](n);
				antwort.writeHead(was.status, { 'content-type': 'application/timestamp-reply' });
				antwort.end(was.koerper ? Buffer.from(was.koerper) : '');
			});
		});
		await new Promise<void>((f) => server.listen(0, '127.0.0.1', f));
		dienste.push(server);
		const port = (server.address() as { port: number }).port;
		return { zaehler, url: `http://127.0.0.1:${port}/` };
	}

	/** Setzt beide Dienste in der Anwendung; der Weg, den auch die Maske geht. */
	async function richteEin(
		haupt: { url: string; abdruecke: string },
		ersatz: { url: string; abdruecke: string }
	) {
		await setzeZeitstempeldienst(handelnder(), {
			url: haupt.url,
			name: 'DigiCert',
			fingerabdruecke: haupt.abdruecke
		});
		await setzeErsatzdienst(handelnder(), {
			url: ersatz.url,
			name: 'Free TSA',
			fingerabdruecke: ersatz.abdruecke
		});
	}

	const stempelt = () => ({ status: 200, koerper: antwort });

	it('springt auch nach einer endgültigen Absage des Hauptdienstes ein', async () => {
		/*
		 * **Kriterium 1 in der schärfsten Form** (13.11.2026). Eine endgültige
		 * Absage ist der Fall, in dem `mitWiederholung` nach **einem** Anlauf
		 * aufgibt. Bis zur Korrekturrunde war nur der unerreichbare Dienst
		 * geprüft; der Ersatz muss aber gerade auch hier greifen.
		 */
		const haupt = await dienstAn([() => ({ status: 200, koerper: endgueltigeAbsage() })]);
		const ersatz = await dienstAn([stempelt]);

		await richteEin({ url: haupt.url, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: ABDRUCK });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		// Ein Anlauf beim Hauptdienst, nicht drei: Die Absage ist endgültig.
		expect(haupt.zaehler.anfragen).toBe(1);
		expect(ersatz.zaehler.anfragen).toBe(1);
		expect(ergebnis.zustand).toBe('vorhanden');
		expect(ergebnis.stelle).toMatch(/SwissSign/);
		expect(ergebnis.ersatz).toBe(true);
		expect(ergebnis.bemerkung).toMatch(/Bezeugt durch Free TSA \(Ersatz\)/);
		expect(ergebnis.bemerkung).toMatch(/nicht angenommen/);
	}, 30000);

	it('fragt den Ersatz ohne angeheftetes Zertifikat nicht und sagt das', async () => {
		/*
		 * **Die Sicherheitsgrenze** (13.11.2026). DigiCert läuft über http; wer
		 * im Netzweg sitzt, kann den Hauptdienst gezielt scheitern lassen.
		 * Stünde der Ersatz ohne Abdruck da, nähme Votum danach jede Antwort
		 * unter seiner Adresse an. Die Ausweichung darf nicht die schwächere
		 * Prüfung sein.
		 */
		const ersatz = await dienstAn([stempelt]);

		await richteEin({ url: TOT, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: '' });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ersatz.zaehler.anfragen).toBe(0);
		expect(ergebnis.zustand).toBe('ausstehend');
		expect(ergebnis.bemerkung).toMatch(/Ersatzdienst Free TSA wurde nicht gefragt/);
		expect(ergebnis.bemerkung).toMatch(/kein Zertifikat angeheftet/);
	}, 30000);

	it('bezeugt mit dem Ersatz, wenn der Hauptdienst unerreichbar ist, und nennt beide', async () => {
		const ersatz = await dienstAn([stempelt]);

		await richteEin({ url: TOT, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: ABDRUCK });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ergebnis.zustand).toBe('vorhanden');
		expect(ergebnis.stelle).toMatch(/SwissSign/);
		expect(ersatz.zaehler.anfragen).toBe(1);
		// Der Grund des Hauptdienstes steht daneben, nicht nur der Erfolg.
		expect(ergebnis.bemerkung).toMatch(/Bezeugt durch Free TSA \(Ersatz\)/);
		expect(ergebnis.bemerkung).toMatch(/Hauptdienst DigiCert scheiterte/);
		expect(ergebnis.bemerkung).toMatch(/3 Versuche/);
	}, 30000);

	it('bezeugt mit dem Ersatz, wenn der Hauptdienst ein fremdes Zertifikat schickt', async () => {
		// Derselbe Stempel, zwei Listen: Der Hauptdienst hat einen anderen
		// Abdruck hinterlegt und weist ihn ab, der Ersatz hat den richtigen.
		const haupt = await dienstAn([stempelt]);
		const ersatz = await dienstAn([stempelt]);

		await richteEin({ url: haupt.url, abdruecke: FREMD }, { url: ersatz.url, abdruecke: ABDRUCK });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ergebnis.zustand).toBe('vorhanden');
		expect(ergebnis.stelle).toMatch(/SwissSign/);
		expect(haupt.zaehler.anfragen).toBe(3);
		expect(ersatz.zaehler.anfragen).toBe(1);
		expect(ergebnis.bemerkung).toMatch(/nicht hinterlegt/);
		expect(ergebnis.bemerkung).toMatch(/Bezeugt durch Free TSA \(Ersatz\)/);
	}, 30000);

	it('fragt den Ersatz nicht, wenn der Hauptdienst stempelt', async () => {
		const haupt = await dienstAn([stempelt]);
		const ersatz = await dienstAn([stempelt]);

		await richteEin({ url: haupt.url, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: ABDRUCK });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ergebnis.zustand).toBe('vorhanden');
		expect(haupt.zaehler.anfragen).toBe(1);
		// **Die Zahl ist der Test.** Ein Ersatz, der bei jedem Siegel mitläuft,
		// verdoppelte die Anfragen an ein fremdes Haus und stünde am Siegel als
		// beteiligt, obwohl er nichts beigetragen hat.
		expect(ersatz.zaehler.anfragen).toBe(0);
		expect(ergebnis.bemerkung).not.toMatch(/Ersatz/);
	}, 30000);

	it('nennt beide Gründe, wenn beide scheitern', async () => {
		const haupt = await dienstAn([() => ({ status: 503 })]);
		const ersatz = await dienstAn([() => ({ status: 503 })]);

		await richteEin({ url: haupt.url, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: ABDRUCK });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		// Der Zustand folgt dem Ersatzanlauf: Der Hauptdienst hat dreimal
		// geantwortet, der Ersatz einmal.
		expect(ergebnis.zustand).toBe('gescheitert');
		expect(haupt.zaehler.anfragen).toBe(3);
		expect(ersatz.zaehler.anfragen).toBe(1);
		expect(ergebnis.bemerkung).toMatch(/Hauptdienst DigiCert/);
		expect(ergebnis.bemerkung).toMatch(/Ersatzdienst Free TSA/);
		expect(ergebnis.bemerkung.match(/503/g)).toHaveLength(2);
	}, 30000);

	it('fragt auch keinen Ersatz, wenn kein Hauptdienst eingetragen ist', async () => {
		const ersatz = await dienstAn([stempelt]);
		process.env.VERSAMMLUNG_ZEITSTEMPEL_URL = '';

		await setzeErsatzdienst(handelnder(), {
			url: ersatz.url,
			name: 'Free TSA',
			fingerabdruecke: ABDRUCK
		});

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ergebnis.zustand).toBe('ausstehend');
		expect(ergebnis.bemerkung).toMatch(/kein Zeitstempeldienst hinterlegt/);
		expect(ersatz.zaehler.anfragen).toBe(0);
	}, 30000);

	it('lässt den Abdruck des Hauptdienstes den Ersatz nicht decken', async () => {
		const ersatz = await dienstAn([stempelt]);

		// Der Hauptdienst ist unerreichbar, trägt aber den Abdruck, den der
		// Ersatz gleich schickt. Der Ersatz hat einen anderen hinterlegt und
		// muss deshalb ablehnen. Eine gemeinsame Liste machte aus zwei Diensten
		// eine einzige Vertrauensstelle.
		await richteEin({ url: TOT, abdruecke: ABDRUCK }, { url: ersatz.url, abdruecke: FREMD });

		const ergebnis = await bezeuge(betreiber, KETTEN_PRUEFSUMME);

		expect(ergebnis.zustand).toBe('gescheitert');
		expect(ersatz.zaehler.anfragen).toBe(1);
		expect(ergebnis.bemerkung).toMatch(/Ersatzdienst Free TSA/);
		expect(ergebnis.bemerkung).toMatch(/nicht hinterlegt/);
	}, 30000);
});

// Beide Gruppen teilen die Verbindungen; geschlossen wird erst am Ende.
afterAll(verbindungenSchliessen);
