import { describe, expect, it } from 'vitest';
import { manifestAlsJson, manifestInWorten, pruefe, zeitstempelInWorten, type Manifest } from '$lib/domain/siegel';
import { L16_SIEGELZEILE } from '$lib/domain/lesarten';

/**
 * Das Manifest und die Prüfung.
 *
 * Geprüft wird das, worauf es im Streitfall ankommt: dass dieselben Daten
 * dieselben Bytes ergeben (sonst liesse sich ein Siegel nicht nachrechnen), und
 * dass eine Abweichung **namentlich** genannt wird — «irgendetwas stimmt nicht»
 * hilft niemandem.
 */
function manifest(u: Partial<Manifest> = {}): Manifest {
	return {
		fassung: 1,
		gemeinschaft: 'STWEG Musterweg 1',
		versammlung: {
			kennung: 'm-1',
			datum: '2026-05-19',
			uhrzeit: '19:00',
			ort: 'Restaurant Sonne',
			art: 'ordentlich',
			stufe: 'erste',
			geschlossenAm: '2026-05-19T19:45:00.000Z'
		},
		versiegeltAm: '2026-05-19 21:30:00',
		versiegeltDurch: 'Prüfer',
		zeitquelle: 'system',
		eintraege: [
			{ pfad: 'daten/b.json', groesse: 20, pruefsumme: 'b'.repeat(64), beschreibung: 'Zweitens' },
			{ pfad: 'daten/a.json', groesse: 10, pruefsumme: 'a'.repeat(64), beschreibung: 'Erstens' }
		],
		nichtEnthalten: [{ was: 'Das Protokoll', grund: 'Es wird getrennt geführt.' }],
		...u
	};
}

describe('Das Manifest', () => {
	it('nennt eine zweite nach L16 und lässt alle anderen Manifeste unverändert (Migration 194)', () => {
		const ohne = manifest();
		expect(manifestAlsJson(ohne)).not.toContain('stufeNachLesart');
		expect(manifestInWorten(ohne, 'c'.repeat(64))).not.toContain(L16_SIEGELZEILE);
		const mit = manifest({
			versammlung: { ...ohne.versammlung, stufe: 'zweite', stufeNachLesart: true }
		});
		expect(manifestInWorten(mit, 'c'.repeat(64))).toContain(L16_SIEGELZEILE);
	});

	it('ordnet die Einträge, damit dieselben Daten dieselben Bytes ergeben', () => {
		// Ohne feste Ordnung liesse sich ein Siegel nicht nachrechnen — und genau
		// das Nachrechnen ist sein Zweck.
		const a = manifestAlsJson(manifest());
		const b = manifestAlsJson(
			manifest({ eintraege: [...manifest().eintraege].reverse() })
		);
		expect(a).toBe(b);
		expect(a.indexOf('daten/a.json')).toBeLessThan(a.indexOf('daten/b.json'));
	});

	it('erklärt sich selbst — samt Anleitung zum Prüfen', () => {
		const t = manifestInWorten(manifest(), 'c'.repeat(64));
		expect(t).toContain('WIE SIE ES PRÜFEN');
		expect(t).toContain('sha256sum');
		expect(t).toContain('certutil');
		expect(t).toContain('c'.repeat(64));
		expect(t).toContain('WAS NICHT ENTHALTEN IST');
		expect(t).toContain('Das Protokoll');
	});

	it('nennt die Anwendung samt Version, und ein Paket von vorher bleibt ohne die Zeile (Entscheid 0053)', () => {
		const mit = manifestInWorten(
			manifest({ anwendung: { name: 'Votum', version: '20261116-0854-854363d4' } }),
			'c'.repeat(64)
		);
		expect(mit).toContain('Anwendung:      Votum, Version 20261116-0854-854363d4');
		const dev = manifestInWorten(manifest({ anwendung: { name: 'Votum', version: null } }), 'c'.repeat(64));
		expect(dev).toContain('Anwendung:      Votum, ohne Versionsangabe');
		expect(dev).not.toContain('Entwicklungsstand');
		// Vorher: kein Feld, keine Zeile, und das JSON bleibt Byte für Byte, wie es war.
		expect(manifestInWorten(manifest(), 'c'.repeat(64))).not.toMatch(/^Anwendung: {6}/m);
		expect(manifestAlsJson(manifest())).not.toContain('anwendung');
	});

	it('nennt die Zeitstempelstelle auch dem, der nur die Worte liest', () => {
		/*
		 * **Der Befund vom 22.09.2026.** Die Angabe stand nur in
		 * `manifest.json`, also in der Fassung für die Maschine. Wer im
		 * Streitfall nach dem Paket greift, ist Anwalt oder Richterin und liest
		 * `MANIFEST.txt`. Genau ihm fehlte, welcher Stelle damals vertraut
		 * wurde.
		 */
		/*
		 * **Die echte Schreibweise, nicht `'d'.repeat(64)`** (Code-Review
		 * 22.09.2026). `fingerabdruckliste` legt die Doppelpunktform in
		 * Grossbuchstaben ab, und das sind 95 statt 64 Zeichen. Mit der kurzen
		 * Fixture konnte die Probe die Zeilenbreite gar nicht beobachten — die
		 * Zeile wäre im Betrieb 111 Zeichen lang gewesen und im Ausdruck
		 * mitten im Abdruck umgebrochen.
		 */
		const abdruck = Array.from({ length: 32 }, (_, i) =>
			i.toString(16).padStart(2, '0').toUpperCase()
		).join(':');
		expect(abdruck).toHaveLength(95);

		const t = manifestInWorten(
			manifest({
				zeitstempelstelle: {
					fingerabdruecke: [abdruck],
					name: 'SwissSign AG',
					url: 'https://tsa.swisssign.net'
				},
				/*
				 * **Eine echte Beschreibung, nicht «Erstens»** (Code-Review
				 * 22.09.2026). Mit zwei Wörtern je Eintrag konnte die Probe die
				 * Breitenregel unten gar nicht beobachten: Im Betrieb sind neun
				 * von zwölf Beschreibungen über 80 Zeichen, die längste mit
				 * Einzug 256.
				 * Eine Fixture, die den Fall nicht enthält, macht die Regel
				 * unbeobachtbar — grün, während das Dokument den Mangel trägt.
				 *
				 * Dies ist der Wortlaut aus `server/siegel.ts` für
				 * `daten/stimmen.json`, der längste im Bestand.
				 */
				eintraege: [
					{
						pfad: 'daten/stimmen.json',
						groesse: 30,
						pruefsumme: 'e'.repeat(64),
						beschreibung:
							'Jede abgegebene Stimme mit Stimmpartei, Einheit, Wahl und Zeitpunkt. Dazu, ob die ' +
							'Sitzungsleitung sie erfasst hat und ob sie gezählt hat — eine Berichtigung lässt ' +
							'die frühere Zeile stehen. Bei einem von Hand gezählten Durchgang steht statt ' +
							'Stimmen die Summe.'
					}
				]
			}),
			'c'.repeat(64)
		);
		expect(t).toContain('DER ZEITSTEMPEL');
		expect(t).toContain('SwissSign AG');
		expect(t).toContain('https://tsa.swisssign.net');
		expect(t).toContain(abdruck);

		/*
		 * **Und die Breite wird gemessen, nicht gehofft.** `MANIFEST.txt` wird
		 * ausgedruckt und danebengelegt; eine Zeile über 80 Zeichen bricht
		 * dabei um. Gemessen über die ganze Datei, damit die Regel auch für
		 * das gilt, was später jemand hinzufügt.
		 *
		 * **Der Abdruck ist die eine Ausnahme, und zwar eine ehrliche.** 95
		 * Zeichen passen in keine 80-Zeichen-Zeile; das lässt sich nicht
		 * beheben, sondern nur eingrenzen. Er steht deshalb allein und am
		 * linken Rand: Dann bricht nur er um, er schiebt nichts anderes
		 * fort, und wer die Zeile kopiert, hat genau den Abdruck. Die
		 * ursprüngliche Fassung stellte ihn hinter ein Etikett und kam auf
		 * 111 Zeichen.
		 */
		for (const zeile of t.split('\n')) {
			/*
			 * **Die Ausnahme trifft die Eigenschaft, nicht die Stelle**
			 * (23.09.2026). Sie lautete «wenn die Zeile der Abdruck ist» — eine
			 * Ausnahme für genau einen Wert, die beim nächsten unteilbaren
			 * Wert von Hand nachgezogen werden müsste und dabei vergessen wird.
			 *
			 * Die tragende Eigenschaft ist: **ein Wort ohne Zwischenraum lässt
			 * sich nicht umbrechen.** Ein Zertifikatsabdruck hat 95 Zeichen und
			 * passt in keine 80-Zeichen-Zeile; ihn zu zerschneiden hiesse, den
			 * Wert unvergleichbar zu machen. Eine Zeile aus mehreren Wörtern
			 * hat diese Entschuldigung nicht.
			 *
			 * **Eine Trennlinie ist kein Wert** (Code-Review 23.09.2026, und
			 * meine erste Behebung reichte nicht). «Zeile ohne Zwischenraum»
			 * nahm auch `'='.repeat(56)` aus. Der Zusatz «und länger als 80»
			 * half nicht: `'='.repeat(120)` ist beides, und die Gegenprobe
			 * blieb grün.
			 *
			 * Die tragende Eigenschaft ist nicht die Länge, sondern die
			 * **Teilbarkeit**: Eine Zeile aus einem einzigen wiederholten
			 * Zeichen lässt sich kürzen, ohne dass etwas verlorengeht — ihre
			 * Breite ist eine Wahl. Ein Zertifikatsabdruck besteht aus vielen
			 * verschiedenen Zeichen und ist genau so lang, wie er ist.
			 */
			const breite = [...zeile].length;
			const einWert = !zeile.trim().includes(' ') && new Set(zeile.trim()).size > 1;
			if (einWert && breite > 80) continue;
			// Zeichen, nicht UTF-16-Einheiten: Auf dem Papier nimmt ein
			// Bildzeichen eine Stelle ein, `\u0000.length` zählte zwei. Dieselbe
			// Zählung wie in `umbrich()`, sonst misst die Probe etwas anderes
			// als die Regel.
			expect(breite, zeile).toBeLessThanOrEqual(80);
		}
		// Und die Ausnahme steht wirklich allein, statt sich hinter einem
		// Etikett zu verstecken — sonst misst die Zeile oben am Ziel vorbei.
		expect(t).toContain(`\n${abdruck}\n`);

		// Und der Vorbehalt reist mit: Die Angabe ist keine Sicherung. Ohne ihn
		// läse sich der Abschnitt wie ein Beweis.
		expect(t).toMatch(/neu versiegelt, schreibt diese Angabe mit/);

		/*
		 * **Vor der Liste, nicht dahinter.** Die Liste ist lang; was erst nach
		 * hundert Zeilen Prüfsummen kommt, findet niemand. Gemessen an der
		 * Reihenfolge, nicht am blossen Vorkommen.
		 */
		expect(t.indexOf('DER ZEITSTEMPEL')).toBeLessThan(t.indexOf('INHALT'));
	});

	it('nennt den Ersatz und spricht von beiden Stellen, wo es zwei gibt', () => {
		/*
		 * **Mit Ersatz kann der Stempel von der zweiten Stelle stammen**
		 * (13.11.2026, K4). Der Text sprach in der Einzahl von «dieser Stelle»;
		 * wer das Paket im Streit vorlegt, läse dann eine Aussage, die auf den
		 * beigelegten Stempel nicht passt.
		 */
		const abdruck = Array.from({ length: 32 }, (_, i) =>
			i.toString(16).padStart(2, '0').toUpperCase()
		).join(':');
		const ersatzabdruck = Array.from({ length: 32 }, (_, i) =>
			(255 - i).toString(16).padStart(2, '0').toUpperCase()
		).join(':');

		const t = manifestInWorten(
			manifest({
				zeitstempelstelle: {
					fingerabdruecke: [abdruck],
					name: 'DigiCert',
					url: 'http://timestamp.digicert.com',
					ersatz: {
						fingerabdruecke: [ersatzabdruck],
						name: 'Free TSA',
						url: 'https://freetsa.org/tsr'
					}
				}
			}),
			'c'.repeat(64)
		);

		expect(t).toContain('Ausserdem war ein Ersatzdienst eingetragen');
		expect(t).toContain('Free TSA');
		expect(t).toContain('https://freetsa.org/tsr');
		expect(t).toContain(ersatzabdruck);
		// **Die Zahl ist die Aussage:** Es sind zwei Stellen.
		expect(t).toMatch(/welche Stellen dafür vorgesehen waren/);
		expect(t).toContain('einer der oben genannten');
		expect(t).toContain('als oben genannt');

		// Dieselbe Breitenregel wie oben, über den ganzen Text.
		for (const zeile of t.split('\n')) {
			const breite = [...zeile].length;
			const einWert = !zeile.trim().includes(' ') && new Set(zeile.trim()).size > 1;
			if (einWert && breite > 80) continue;
			expect(breite, zeile).toBeLessThanOrEqual(80);
		}
	});

	it('führt den Ersatz auch, wenn nur er angeheftet ist', () => {
		/*
		 * **K5** (13.11.2026): Der Ersatz stand nur im Manifest, wenn auch der
		 * Hauptdienst angeheftet war. Ist der Hauptdienst eingetragen, aber nie
		 * angeheftet worden, fehlte damit der Ersatz, obwohl er einspringen
		 * kann. (Nach einem Zertifikatswechsel bleibt der alte Abdruck
		 * angeheftet; diesen Fall deckte das Manifest schon vorher.)
		 */
		const ersatzabdruck = Array.from({ length: 32 }, (_, i) =>
			i.toString(16).padStart(2, '0').toUpperCase()
		).join(':');

		const t = manifestInWorten(
			manifest({
				zeitstempelstelle: {
					fingerabdruecke: [],
					name: 'DigiCert',
					url: 'http://timestamp.digicert.com',
					ersatz: {
						fingerabdruecke: [ersatzabdruck],
						name: 'Free TSA',
						url: 'https://freetsa.org/tsr'
					}
				}
			}),
			'c'.repeat(64)
		);

		expect(t).toContain('für den Hauptdienst kein Zertifikat angeheftet');
		expect(t).toContain('Free TSA');
		expect(t).toContain(ersatzabdruck);
		// Die alte Einzahl-Zusage wäre hier falsch.
		expect(t).not.toContain('Beim Versiegeln war diese Stelle hinterlegt');
	});

	it('sagt ohne hinterlegte Stelle, dass es keine gab — statt zu schweigen', () => {
		const t = manifestInWorten(manifest(), 'c'.repeat(64));
		expect(t).toContain('DER ZEITSTEMPEL');
		expect(t).toContain('keine Stelle mit angeheftetem Zertifikat');

		/*
		 * **Und es behauptet nicht, es sei gar keine angefragt worden**
		 * (Code-Review 22.09.2026). Das Feld fehlt auch bei einem
		 * eingerichteten Dienst **ohne** angeheftetes Zertifikat — ein
		 * vorgesehener Betriebszustand. «Keine Stelle hinterlegt» wäre
		 * gegenüber Anwalt oder Gericht eine unzutreffende Aussage über den
		 * eigenen Entstehungsvorgang, und zwar zulasten dessen, der die Datei
		 * vorlegt.
		 */
		expect(t).toMatch(/kann eine eingerichtet gewesen/);

		// Und kein Verweis nach oben, wo oben keine Stelle steht (Codeprüfung
		// 13.11.2026, N3 und Runde 3).
		expect(t).not.toContain('oben genannt');
		expect(t).toContain('die Antwort der Stelle, die beim');
	});

	it('spricht von einer Stelle, wo nur eine genannt ist', () => {
		/*
		 * **Einzahl und Mehrzahl folgen dem, was oben steht** (Codeprüfung
		 * 13.11.2026, Runde 3). «Einer der oben genannten Stellen» deutete im
		 * häufigsten Fall eine zweite Stelle an, die es nicht gibt.
		 */
		const t = manifestInWorten(
			manifest({
				zeitstempelstelle: {
					fingerabdruecke: ['AB:'.repeat(31) + 'AB'],
					name: 'DigiCert',
					url: 'http://timestamp.digicert.com'
				}
			}),
			'c'.repeat(64)
		);
		expect(t).toContain('die Antwort der oben genannten');
		expect(t).not.toContain('einer der oben genannten');
		expect(t).toContain('welche Stelle dafür vorgesehen war');
	});

	it('trennt den nachgeholten Stempel vom Widerspruch im Paket', () => {
		/*
		 * Die Fallunterscheidung, die der Prüfseite zugrunde liegt, muss auch
		 * dort stehen, wo jemand ohne die Anwendung arbeitet: Ein Stempel
		 * **neben** dem Paket darf eine andere Stelle nennen, einer **im**
		 * Paket nicht.
		 */
		const t = manifestInWorten(manifest(), 'c'.repeat(64));
		expect(t).toMatch(/nachgeholter Stempel darf eine andere Stelle nennen/);

		/*
		 * Der fehlende Stempel hat vier Gründe, nicht einen. «Die Stelle war
		 * nicht erreichbar» klang wie eine Feststellung und war eine Vermutung.
		 */
		expect(t).toMatch(/kein Dienst hinterlegt/);
		expect(t).toMatch(/Anfrage abgelehnt/);
		expect(t).not.toMatch(/war die Stelle beim Versiegeln nicht erreichbar/);
		expect(t).toMatch(/Widerspruch/);
		// Die Anleitung zum Prüfen von Hand: gegen das Siegel, nicht gegen das
		// ZIP. Mit `-data` bekommt man «message imprint mismatch» an einem
		// einwandfreien Stempel.
		expect(t).toContain('openssl ts -verify');
		expect(t).toContain('-digest');
		expect(t).not.toContain('-data');
	});
});

describe('Die Prüfung', () => {
	const m = manifest();
	const gut = new Map([
		['daten/a.json', 'a'.repeat(64)],
		['daten/b.json', 'b'.repeat(64)]
	]);

	it('bestätigt ein unversehrtes Paket', () => {
		const b = pruefe(m, gut, 'siegel', 'siegel');
		expect(b.bestandteileStimmen).toBe(true);
		expect(b.manifestStimmt).toBe(true);
		expect(b.satz).toMatch(/Das Siegel hält:/);
	});

	it('nennt einen abweichenden Bestandteil namentlich', () => {
		const schlecht = new Map(gut);
		schlecht.set('daten/b.json', 'f'.repeat(64));
		const b = pruefe(m, schlecht, 'siegel', 'siegel');
		expect(b.bestandteileStimmen).toBe(false);
		expect(b.abweichungen).toEqual([
			{ pfad: 'daten/b.json', erwartet: 'b'.repeat(64), gefunden: 'f'.repeat(64) }
		]);
		expect(b.satz).toContain('daten/b.json');
	});

	it('nennt einen fehlenden Bestandteil', () => {
		const ohne = new Map([['daten/a.json', 'a'.repeat(64)]]);
		const b = pruefe(m, ohne, 'siegel', 'siegel');
		expect(b.fehlend).toEqual(['daten/b.json']);
		expect(b.satz).toContain('daten/b.json');
	});

	it('trennt die Aussage über das Manifest von der über die Bestandteile', () => {
		// FR-54 verlangt getrennte Auskunft. Ein einziges «nicht in Ordnung» wäre
		// im Streitfall wertlos.
		const b = pruefe(m, gut, 'gefaelscht', 'siegel');
		expect(b.bestandteileStimmen).toBe(true);
		expect(b.manifestStimmt).toBe(false);
		expect(b.satz).toMatch(/Die Bestandteile stimmen, das Manifest nicht/);
	});

	it('meldet Dateien, die das Manifest nicht kennt', () => {
		const mehr = new Map(gut);
		mehr.set('daten/untergeschoben.json', 'e'.repeat(64));
		mehr.set('manifest.json', 'x'.repeat(64));
		const b = pruefe(m, mehr, 'siegel', 'siegel');
		// Das Manifest kann seine eigene Prüfsumme nicht enthalten — es zählt
		// deshalb nicht als Zusatz.
		expect(b.zusaetzlich).toEqual(['daten/untergeschoben.json']);
	});
});

describe('Der Zeitstempel in Worten', () => {
	it('sagt beim Fehlen, dass der Abschluss trotzdem gilt', () => {
		const t = zeitstempelInWorten('ausstehend');
		expect(t).toContain('Abschluss ist vollzogen');
		expect(t).toContain('nachgeholt');
	});

	it('nennt Stelle und Zeitpunkt, wenn er da ist', () => {
		expect(zeitstempelInWorten('vorhanden', 'Prüfstelle', '2026-05-19')).toContain('Prüfstelle');
	});

	it('sagt beim Scheitern, was fehlt — und was trotzdem gilt', () => {
		const t = zeitstempelInWorten('gescheitert');
		expect(t).toContain('Das Siegel gilt trotzdem');
	});
});
