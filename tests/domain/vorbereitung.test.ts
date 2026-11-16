/**
 * Story 6.2 — der geführte Vorbereitungsablauf (FR-65).
 *
 * Die drei Akzeptanzkriterien der Story sind hier je ein eigener Abschnitt:
 * alle Schritte sichtbar, jede Sperre mit Grund, keine erzwungene Reihenfolge
 * zwischen unabhängigen Schritten.
 */
import { describe, expect, it } from 'vitest';
import {
	vorbereitungsfortschritt,
	vorbereitungsschritte,
	type Vorbereitungslage
} from '$lib/domain/vorbereitung';
import { alsPunkt } from '$lib/components/ablaufleiste';

function lage(u: Partial<Vorbereitungslage> = {}): Vorbereitungslage {
	return {
		meetingId: 'v-1',
		stwegId: 'g-1',
		versammlungszustand: 'entwurf',
		datum: '2026-09-15',
		quotenGehenAuf: false,
		anzahlEinheiten: 0,
		anzahlEigentuemer: 0,
		einheitenOhneEigentuemer: 0,
		einheitenErstSpaeter: 0,
		reglementGeprueftAm: null,
		anzahlReglementsregeln: 0,
		anzahlAnwesenheitsregeln: 0,
		anzahlTraktanden: 0,
		traktandenAusVorlage: 0,
		traktandenlisteBestaetigt: false,
		traktandenOhneErfordernis: 0,
		einladungErzeugt: false,
		versandVermerkt: false,
		einberufungsfristTage: null,
		heute: '2026-09-01',
		briefkopfHinterlegt: true,
		ausfallunterlagenGeholt: [],
		ausfallunterlagenNoetig: ['traktanden', 'unterschriften', 'stimmzettel', 'auszaehlung'],
		anzahlZugaenge: 0,
		anzahlStimmberechtigte: 0,
		versiegelt: false,
		protokollnotizen: 0,
		protokollEntwurf: false,
		protokollfassungen: 0,
		vollmachtenOffen: 0,
		vollmachtenWirksam: 0,
		beschluesseGefasst: false,
		...u
	};
}

const KENNUNGEN = [
	'einheiten',
	'eigentuemer',
	// Seit dem 10.08.2026: sichtbar im Ablauf, aber ohne Sperre und ohne
	// Einfluss auf die Freigabe.
	'reglement',
	'beschlussfaehigkeit',
	'traktanden',
	'erfordernis',
	'freigabe',
	'einladung',
	'zugaenge',
	'ausfall',
	'vollmachten',
	'anwesenheit',
	'durchfuehrung',
	'auswertung',
	'siegel',
	'protokoll'
];

describe('Alle Schritte sichtbar', () => {
	it('zeigt bei einer neuen Gemeinschaft jeden Schritt', () => {
		const s = vorbereitungsschritte(lage());
		expect(s.map((x) => x.kennung)).toEqual(KENNUNGEN);
	});

	it('zeigt auch nach dem Schliessen noch jeden Schritt', () => {
		// Die Seite ist dann eine Zusammenfassung. Schritte verschwinden zu lassen,
		// hiesse den Abend nachträglich umzuschreiben.
		const s = vorbereitungsschritte(lage({ versammlungszustand: 'geschlossen' }));
		expect(s.map((x) => x.kennung)).toEqual(KENNUNGEN);
	});
});

describe('Regelwerk: sichtbar, aber ohne Sperre', () => {
	const finde = (l: Parameters<typeof vorbereitungsschritte>[0], kennung: string) =>
		vorbereitungsschritte(l).find((s) => s.kennung === kennung)!;

	it('führt beide Schritte in jedem Zustand ungesperrt', () => {
		// Der Entscheid vom 10.08.2026: nur sichtbar machen. Was die Freigabe
		// verlangt, ändert sich dadurch nicht — sonst hinge eine Versammlung an
		// einem Vermerk, der nichts über ihre Rechtmässigkeit sagt.
		for (const z of ['entwurf', 'freigegeben', 'laufend', 'geschlossen', 'versiegelt'] as const) {
			for (const k of ['reglement', 'beschlussfaehigkeit']) {
				expect(finde(lage({ versammlungszustand: z }), k).zustand).not.toBe('gesperrt');
			}
		}
	});

	it('führt sie auf die Seiten der Gemeinschaft, nicht der Versammlung', () => {
		expect(finde(lage(), 'reglement').pfad).toBe('/gemeinschaften/g-1/reglement');
		expect(finde(lage(), 'beschlussfaehigkeit').pfad).toBe('/gemeinschaften/g-1/beschlussfaehigkeit');
	});

	it('hakt das Reglement am Prüfvermerk ab, nicht an der Zahl der Regeln', () => {
		// «Keine Abweichung» und «noch nie nachgesehen» sind im Bestand beides
		// null Regeln. Nur der Vermerk unterscheidet sie.
		expect(finde(lage({ anzahlReglementsregeln: 3 }), 'reglement').zustand).toBe('offen');
		expect(finde(lage({ anzahlReglementsregeln: 3 }), 'reglement').stand).toBe('noch nie nachgesehen');

		const geprueft = finde(lage({ reglementGeprueftAm: '2026-05-01' }), 'reglement');
		expect(geprueft.zustand).toBe('erledigt');
		expect(geprueft.stand).toBe('nachgesehen am 2026-05-01, keine Abweichung');

		const mitRegeln = finde(
			lage({ reglementGeprueftAm: '2026-05-01', anzahlReglementsregeln: 2 }),
			'reglement'
		);
		expect(mitRegeln.stand).toBe('nachgesehen am 2026-05-01, 2 Abweichungen');
	});

	it('gilt die Beschlussfähigkeit als erledigt, sobald das Reglement nachgesehen ist', () => {
		// Ohne eigene Regel gilt das Gesetz — und zwar bewusst, nicht mangels
		// Wissen. Ein Schritt, der erst mit einer hinterlegten Abweichung abhakt,
		// bliebe bei jeder gesetzestreuen Gemeinschaft für immer offen.
		const ohne = finde(lage(), 'beschlussfaehigkeit');
		expect(ohne.zustand).toBe('offen');
		expect(ohne.stand).toBe('noch nicht nachgesehen — es gilt das Gesetz');

		const nachgesehen = finde(lage({ reglementGeprueftAm: '2026-05-01' }), 'beschlussfaehigkeit');
		expect(nachgesehen.zustand).toBe('erledigt');
		expect(nachgesehen.stand).toBe('nach Gesetz (ZGB Art. 712p)');

		const eigene = finde(lage({ anzahlAnwesenheitsregeln: 1 }), 'beschlussfaehigkeit');
		expect(eigene.zustand).toBe('erledigt');
		expect(eigene.stand).toBe('1 eigene Regel aus dem Reglement');
	});
});

describe('Ein gesperrter Schritt sagt trotzdem, was er weiss', () => {
	const finde = (l: Parameters<typeof vorbereitungsschritte>[0], kennung: string) =>
		vorbereitungsschritte(l).find((s) => s.kennung === kennung)!;

	/*
	 * **Die Fristansage zählt genau dann, wenn der Schritt gesperrt ist**
	 * (02.09.2026, aus dem Code-Review). Sie hängt am Schritt «Einladung
	 * erzeugen», und der ist im Entwurf gesperrt — die Vorbereitungsseite führte
	 * Sperrgrund und Stand in einem `{:else if}` und verschluckte damit die
	 * Ansage. Sichtbar wurde sie erst nach der Freigabe, also nachdem die
	 * Einladung längst draussen sein müsste. Am laufenden System gemessen: null
	 * Treffer auf der ganzen Seite, bei einer Versammlung, deren Frist an
	 * diesem Tag ablief.
	 *
	 * Der Kern setzt beides, und dass er es tut, hält diese Probe fest.
	 */
	it('nennt am gesperrten Einladungsschritt Grund und Frist zugleich', () => {
		const knapp = finde(
			lage({ datum: '2026-09-15', einberufungsfristTage: 14, heute: '2026-09-01' }),
			'einladung'
		);
		expect(knapp.zustand).toBe('gesperrt');
		expect(knapp.sperrgrund).toBeTruthy();
		expect(knapp.stand).toMatch(/letzte Tag, an dem die Einladung bei allen sein soll/);
	});

	/*
	 * **«keine erfasst» ist im Entwurf keine Auskunft, sondern die Definition.**
	 * Eine Vollmacht bezieht sich auf eine Versammlung, deren Stimmberechtigte
	 * feststehen — im Entwurf stehen sie nicht fest. Solange die Seite den Stand
	 * eines gesperrten Schrittes verschluckte, fiel das nicht auf; gemessen
	 * wurde es erst, als sie ihn zeigte.
	 */
	it('schweigt bei den Vollmachten, solange nicht freigegeben ist', () => {
		expect(finde(lage(), 'vollmachten').stand).toBeUndefined();
		expect(finde(lage({ versammlungszustand: 'freigegeben' }), 'vollmachten').stand).toBe(
			'keine erfasst'
		);
	});
});

describe('Jede Sperre nennt ihren Grund', () => {
	it('sperrt vor der Freigabe die davon abhängigen Schritte, jeweils mit Grund', () => {
		const gesperrt = vorbereitungsschritte(lage()).filter((s) => s.zustand === 'gesperrt');
		expect(gesperrt.map((s) => s.kennung)).toEqual([
			'einladung',
			'zugaenge',
			'ausfall',
			'vollmachten',
			'anwesenheit',
			'durchfuehrung',
			'auswertung',
			'siegel',
			'protokoll'
		]);
		for (const s of gesperrt) expect(s.sperrgrund).toBeTruthy();
	});

	it('lässt keinen gesperrten Schritt ohne Grund, in keiner Lage', () => {
		// Eine Sperre ohne Grund ist eine Sackgasse: Wer sie sieht, weiss nicht,
		// was zu tun ist.
		const zustaende = ['entwurf', 'freigegeben', 'laufend', 'geschlossen', 'versiegelt'] as const;
		for (const z of zustaende) {
			for (const s of vorbereitungsschritte(lage({ versammlungszustand: z }))) {
				if (s.zustand === 'gesperrt') expect(s.sperrgrund, `${z}/${s.kennung}`).toBeTruthy();
				else expect(s.sperrgrund, `${z}/${s.kennung}`).toBeUndefined();
			}
		}
	});

	it('schaltet die Einladung und die Zugänge mit der Freigabe frei', () => {
		const s = vorbereitungsschritte(lage({ versammlungszustand: 'freigegeben' }));
		expect(s.find((x) => x.kennung === 'einladung')?.zustand).toBe('offen');
		expect(s.find((x) => x.kennung === 'zugaenge')?.zustand).toBe('offen');
	});

	it('gibt die Auswertung erst mit dem Schliessen frei', () => {
		expect(
			vorbereitungsschritte(lage({ versammlungszustand: 'laufend' })).find(
				(x) => x.kennung === 'auswertung'
			)?.zustand
		).toBe('gesperrt');
		expect(
			vorbereitungsschritte(lage({ versammlungszustand: 'geschlossen' })).find(
				(x) => x.kennung === 'auswertung'
			)?.zustand
		).toBe('offen');
	});
});

describe('Keine erzwungene Reihenfolge', () => {
	it('lässt Traktanden erfassen, bevor die Stammdaten fertig sind', () => {
		// Sachlich unabhängig: Die Geschäfte des Abends stehen fest, lange bevor der
		// letzte Eigentümerwechsel eingetragen ist.
		const s = vorbereitungsschritte(lage({ anzahlEinheiten: 0, anzahlEigentuemer: 0 }));
		expect(s.find((x) => x.kennung === 'traktanden')?.zustand).toBe('offen');
	});

	it('lässt das Mehrheitserfordernis offen, ohne es an die Traktandenliste zu ketten', () => {
		const s = vorbereitungsschritte(lage({ anzahlTraktanden: 0 }));
		const e = s.find((x) => x.kennung === 'erfordernis');
		expect(e?.zustand).toBe('offen');
		expect(e?.sperrgrund).toBeUndefined();
	});

	it('sperrt die Freigabe nicht, auch wenn nichts erledigt ist', () => {
		// Ob freigegeben werden darf, entscheidet die Freigabeprüfung mit ihren
		// eigenen Hindernissen. Eine zweite Sperre hier wäre eine zweite Wahrheit.
		expect(vorbereitungsschritte(lage()).find((x) => x.kennung === 'freigabe')?.zustand).toBe(
			'offen'
		);
	});
});

describe('Erledigt-Kennzeichnung', () => {
	it('gilt bei den Einheiten erst, wenn der Saldo aufgeht', () => {
		const offen = vorbereitungsschritte(lage({ anzahlEinheiten: 5, quotenGehenAuf: false }));
		expect(offen.find((x) => x.kennung === 'einheiten')?.zustand).toBe('offen');
		expect(offen.find((x) => x.kennung === 'einheiten')?.stand).toContain('geht nicht auf');

		const fertig = vorbereitungsschritte(lage({ anzahlEinheiten: 5, quotenGehenAuf: true }));
		expect(fertig.find((x) => x.kennung === 'einheiten')?.zustand).toBe('erledigt');
	});

	it('gilt bei den Eigentümern erst, wenn keine Einheit unzugeordnet ist', () => {
		const offen = vorbereitungsschritte(
			lage({ anzahlEigentuemer: 3, einheitenOhneEigentuemer: 1 })
		);
		expect(offen.find((x) => x.kennung === 'eigentuemer')?.zustand).toBe('offen');
		// Seit 22.08.2026 mit Stichtag: Die Zahl allein ist mehrdeutig, weil die
		// Zuordnungen auf den Versammlungstag geprüft werden und nicht auf heute.
		expect(offen.find((x) => x.kennung === 'eigentuemer')?.stand).toBe(
			'1 Einheit ohne Eigentümer am Versammlungstag'
		);
	});

	it('nennt die Ursache, wenn die Zuordnungen erst nach dem Versammlungstag beginnen', () => {
		/*
		 * **Der teuerste Befund der Bewirtschaftersicht** (05.09.2026): Fünf
		 * Eigentümer waren richtig erfasst, die Zuordnung begann am Erfassungstag,
		 * die Versammlung lag davor. Die Meldung nannte nur die Zahl, und der
		 * Prüfer machte seine Arbeit ein zweites Mal.
		 *
		 * Geprüft werden alle drei Lagen, weil sie Verschiedenes verlangen und der
		 * Satz sie unterscheiden muss.
		 */
		const stand = (u: Partial<Vorbereitungslage>) =>
			vorbereitungsschritte(lage({ anzahlEigentuemer: 3, ...u })).find(
				(x) => x.kennung === 'eigentuemer'
			)?.stand;

		// Alle: die Erfassung ist da, nur zu spät.
		expect(stand({ einheitenOhneEigentuemer: 5, einheitenErstSpaeter: 5 })).toBe(
			'5 Einheiten ohne Eigentümer am Versammlungstag: die Zuordnungen beginnen erst danach'
		);
		// Teils: beides zugleich, und beide Zahlen müssen dastehen.
		expect(stand({ einheitenOhneEigentuemer: 5, einheitenErstSpaeter: 3 })).toBe(
			'5 Einheiten ohne Eigentümer am Versammlungstag, bei 3 beginnt die Zuordnung erst danach'
		);
		// Eine einzige: der Nachsatz steht in der Einzahl. «1 Einheit … die
		// Zuordnungen beginnen» las sich wie ein Fehler und liess an der Zahl
		// zweifeln (Code-Review 06.09.2026).
		expect(stand({ einheitenOhneEigentuemer: 1, einheitenErstSpaeter: 1 })).toBe(
			'1 Einheit ohne Eigentümer am Versammlungstag: die Zuordnung beginnt erst danach'
		);
		// Keine: hier fehlt wirklich Arbeit — die Anwendung behauptet nichts dazu.
		expect(stand({ einheitenOhneEigentuemer: 5, einheitenErstSpaeter: 0 })).toBe(
			'5 Einheiten ohne Eigentümer am Versammlungstag'
		);
	});

	it('setzt bei den Zahlen die Einzahl, wo es eine gibt', () => {
		// «1 Traktanden» liest sich wie ein Fehler und lässt an der ganzen Zahl
		// zweifeln.
		const stand = (u: Partial<Vorbereitungslage>) =>
			vorbereitungsschritte(lage(u)).find((x) => x.kennung === 'traktanden')?.stand;
		expect(stand({ anzahlTraktanden: 1, traktandenlisteBestaetigt: true })).toBe(
			'1 Traktandum, bestätigt'
		);
		expect(stand({ anzahlTraktanden: 2, traktandenlisteBestaetigt: true })).toBe(
			'2 Traktanden, bestätigt'
		);
		expect(stand({ anzahlTraktanden: 1, traktandenAusVorlage: 1 })).toBe(
			'1 Traktandum aus der Vorlage — durchgehen und ergänzen'
		);
	});

	/**
	 * Der Befund vom 01.08.2026: Das Anlegen einer Versammlung setzt die
	 * Pflichttraktanden selbst. Ein Häkchen dafür stand eine Sekunde nach dem
	 * Anlegen, ohne dass jemand die Liste gesehen hätte.
	 */
	it('hakt die Traktandenliste nicht ab, solange nur die Vorlage steht', () => {
		const schritte = vorbereitungsschritte(lage({ anzahlTraktanden: 9, traktandenAusVorlage: 9 }));
		const t = schritte.find((x) => x.kennung === 'traktanden');
		expect(t?.zustand).toBe('offen');
		expect(t?.stand).toMatch(/aus der Vorlage/);
	});

	it('hakt auch eigene Traktanden erst nach der Bestätigung ab', () => {
		const schritte = vorbereitungsschritte(lage({ anzahlTraktanden: 9, traktandenAusVorlage: 4 }));
		const t = schritte.find((x) => x.kennung === 'traktanden');
		expect(t?.zustand).toBe('offen');
		expect(t?.stand).toMatch(/noch nicht als vollständig bestätigt/);
	});

	/**
	 * Die Erfordernisse der Vorlage sind Vorschläge aus der Geschäftsart, keine
	 * Entscheide. Ein Häkchen darauf hiesse, jemand habe je Antrag geprüft.
	 */
	it('hakt die Erfordernisse erst ab, wenn die Liste bestätigt ist', () => {
		const offen = vorbereitungsschritte(
			lage({ anzahlTraktanden: 9, traktandenAusVorlage: 9, traktandenOhneErfordernis: 0 })
		).find((x) => x.kennung === 'erfordernis');
		expect(offen?.zustand).toBe('offen');
		expect(offen?.stand).toBe('wartet auf die bestätigte Traktandenliste');

		const fertig = vorbereitungsschritte(
			lage({ anzahlTraktanden: 9, traktandenlisteBestaetigt: true, traktandenOhneErfordernis: 0 })
		).find((x) => x.kennung === 'erfordernis');
		expect(fertig?.zustand).toBe('erledigt');
	});

	/**
	 * Sonst stünde an jeder freigegebenen Versammlung für immer «noch nicht
	 * bestätigt» — eine Aufforderung zu etwas, das gar nicht mehr geht.
	 */
	it('nimmt die Freigabe als die stärkere Feststellung', () => {
		const schritte = vorbereitungsschritte(
			lage({ versammlungszustand: 'freigegeben', anzahlTraktanden: 3, traktandenAusVorlage: 3 })
		);
		const t = schritte.find((x) => x.kennung === 'traktanden');
		expect(t?.zustand).toBe('erledigt');
		expect(t?.stand).toBe('3 Traktanden');
		expect(schritte.find((x) => x.kennung === 'erfordernis')?.zustand).toBe('erledigt');
	});

	it('kennt keine bestätigte leere Liste', () => {
		const t = vorbereitungsschritte(
			lage({ anzahlTraktanden: 0, traktandenlisteBestaetigt: true })
		).find((x) => x.kennung === 'traktanden');
		expect(t?.zustand).toBe('offen');
		expect(t?.stand).toBe('noch kein Traktandum');
	});

	it('nennt beim Erfordernis, dass es im Saal nachholbar ist', () => {
		// Sonst liest es sich wie ein Hindernis, und jemand verschiebt deswegen die
		// Einladung.
		const s = vorbereitungsschritte(lage({ anzahlTraktanden: 4, traktandenOhneErfordernis: 2 }));
		expect(s.find((x) => x.kennung === 'erfordernis')?.stand).toContain('nachholbar');
	});

	it('vergleicht die Zugänge mit der Zahl der Stimmberechtigten', () => {
		const s = vorbereitungsschritte(
			lage({ versammlungszustand: 'freigegeben', anzahlZugaenge: 5, anzahlStimmberechtigte: 7 })
		);
		expect(s.find((x) => x.kennung === 'zugaenge')?.stand).toBe('5 von 7 Stimmberechtigten');
	});
});

describe('Fortschritt', () => {
	it('zählt gesperrte Schritte nicht mit', () => {
		// Sonst stünde die Anzeige am Anfang jeder Versammlung bei einem Drittel und
		// klebte dort, obwohl gerade viel geschieht.
		const schritte = vorbereitungsschritte(lage());
		const f = vorbereitungsfortschritt(schritte);
		expect(f.moeglich).toBe(schritte.filter((s) => s.zustand !== 'gesperrt').length);
		expect(f.moeglich).toBeLessThan(schritte.length);
	});

	it('meldet null Prozent, solange nichts erledigt ist', () => {
		expect(vorbereitungsfortschritt(vorbereitungsschritte(lage())).anteil).toBe(0);
	});

	it('meldet hundert Prozent, wenn alles Mögliche erledigt ist', () => {
		const schritte = vorbereitungsschritte(
			lage({
				versammlungszustand: 'geschlossen',
				anzahlEinheiten: 2,
				quotenGehenAuf: true,
				anzahlEigentuemer: 2,
				einheitenOhneEigentuemer: 0,
				anzahlTraktanden: 3,
				traktandenlisteBestaetigt: true,
				traktandenOhneErfordernis: 0,
				einladungErzeugt: true,
				anzahlZugaenge: 2,
				anzahlStimmberechtigte: 2,
				reglementGeprueftAm: '2026-05-01',
				// Alle vier Unterlagen der Ausfallsicherung geholt.
				ausfallunterlagenGeholt: [
					'traktanden',
					'unterschriften',
					'stimmzettel',
					'auszaehlung'
				]
			})
		);
		// Drei bleiben offen, und alle drei zu Recht: Die Auswertung gilt erst als
		// erledigt, wenn das PDF erzeugt wurde, das Protokoll erst mit einer
		// festgehaltenen Fassung — ein Häkchen beim blossen Entwurf hiesse, er sei
		// versandt —, und das Siegel erst, wenn es gesetzt ist.
		const f = vorbereitungsfortschritt(schritte);
		expect(f.erledigt).toBe(f.moeglich - 3);
	});

	/**
	 * **Drei oder vier Unterlagen — je nach Abend** (23.08.2026, Prüflauf II,
	 * C-02; Zahlen nachgezogen am 02.09.2026, als die Unterschriftenliste
	 * dazukam).
	 *
	 * Die Auszählmappe entsteht nur, wo es etwas zu rechnen gibt. Wo nicht, gab
	 * es sie nie, und der Schritt blieb trotzdem für immer auf «2 von 3
	 * Unterlagen geholt» stehen — ein Haken, der sich nicht setzen liess.
	 */
	it('ist erledigt, wenn die Unterlagen geholt sind und es keine Mappe gibt', () => {
		const s = vorbereitungsschritte(
			lage({
				versammlungszustand: 'freigegeben',
				ausfallunterlagenGeholt: ['traktanden', 'unterschriften', 'stimmzettel'],
				ausfallunterlagenNoetig: ['traktanden', 'unterschriften', 'stimmzettel']
			})
		).find((x) => x.kennung === 'ausfall')!;
		expect(s.zustand).toBe('erledigt');
		expect(s.stand, 'kein Zwischenstand mehr').toBeUndefined();
		expect(s.beschreibung, 'die Mappe wird gar nicht erst genannt').not.toMatch(/Auszählmappe/);
	});

	/**
	 * **Zwei gleiche Zahlen, zwei verschiedene Mengen** (02.09.2026, aus dem
	 * Code-Review).
	 *
	 * Der Fall, der die Umstellung von Zahlen auf Namen ausgelöst hat: Wer
	 * Traktanden, Stimmzettel und Auszählmappe geholt hat, steht auf «3 von 4».
	 * Wird während der Versammlung das einzige quotenrelevante Traktandum
	 * zurückgezogen, entfällt die Mappe — nötig wären dann 3, geholt sind 3, und
	 * der Schritt hätte «erledigt» gemeldet. Die Unterschriftenliste, das einzige
	 * Blatt, das im Totalausfall die Anwesenheit nachweist, war nie geholt.
	 */
	it('lässt eine weggefallene Unterlage keine fehlende decken', () => {
		const s = vorbereitungsschritte(
			lage({
				versammlungszustand: 'freigegeben',
				// Die Mappe ist geholt und fällt weg; die Unterschriftenliste fehlt.
				ausfallunterlagenGeholt: ['traktanden', 'stimmzettel', 'auszaehlung'],
				ausfallunterlagenNoetig: ['traktanden', 'unterschriften', 'stimmzettel']
			})
		).find((x) => x.kennung === 'ausfall')!;
		expect(s.zustand, 'die Unterschriftenliste fehlt weiterhin').toBe('offen');
		expect(s.stand, 'die geholte Mappe zählt nicht mehr mit').toBe('2 von 3 Unterlagen geholt');
	});

	it('bleibt offen, wenn die Mappe gebraucht wird und fehlt', () => {
		// Die Gegenprobe: Ohne sie hätte die Weiche den Schritt überall grün
		// gemacht.
		const s = vorbereitungsschritte(
			lage({
				versammlungszustand: 'freigegeben',
				ausfallunterlagenGeholt: ['traktanden', 'unterschriften', 'stimmzettel'],
				ausfallunterlagenNoetig: [
					'traktanden',
					'unterschriften',
					'stimmzettel',
					'auszaehlung'
				]
			})
		).find((x) => x.kennung === 'ausfall')!;
		expect(s.zustand).toBe('offen');
		expect(s.stand).toBe('3 von 4 Unterlagen geholt');
		expect(s.beschreibung).toMatch(/Auszählmappe/);
	});

	it('teilt nicht durch null, wenn alles gesperrt wäre', () => {
		expect(vorbereitungsfortschritt([]).anteil).toBe(0);
	});
});

// ── Ein Stichtag, nicht zwei ────────────────────────────────────────────────
//
// **Der Anlass** (Prüflauf 22.08.2026, Befund B-01): Die Versammlung meldete
// «5 Einheiten ohne Eigentümer»; die verlinkte Seite zeigte «5 von 5 · alles
// zugeordnet». Beide hatten recht — die eine rechnete auf den Versammlungstag,
// die andere auf heute. Der Prüfer hielt die Warnung für einen Fehler und zog
// fünf Zuordnungen von Hand nach, die es längst gab.

describe('Der Stichtag reist mit', () => {
	it('gibt den Versammlungstag an die Eigentümerseite weiter', () => {
		const s = vorbereitungsschritte(lage({ datum: '2026-03-12', einheitenOhneEigentuemer: 5 }));
		const eigentuemer = s.find((x) => x.kennung === 'eigentuemer');
		expect(eigentuemer?.pfad).toContain('stichtag=2026-03-12');
	});

	it('nennt den Stichtag auch im Text — eine Zahl allein ist mehrdeutig', () => {
		const s = vorbereitungsschritte(
			lage({ datum: '2026-03-12', anzahlEigentuemer: 3, einheitenOhneEigentuemer: 5 })
		);
		expect(s.find((x) => x.kennung === 'eigentuemer')?.stand).toContain('am Versammlungstag');
	});

	it('sagt bei vollständiger Zuordnung nichts von einem Stichtag', () => {
		// Wo nichts fehlt, gibt es auch nichts einzuordnen — der Zusatz wäre dort
		// bloss Lärm.
		const s = vorbereitungsschritte(
			lage({ datum: '2026-03-12', anzahlEigentuemer: 3, einheitenOhneEigentuemer: 0 })
		);
		expect(s.find((x) => x.kennung === 'eigentuemer')?.stand).not.toContain('Versammlungstag');
	});
});

/**
 * Der Briefkopf in der Zusage (23.08.2026, Prüflauf I, B-14).
 *
 * «Der Seitenleisten-Text verspricht ‹mit Briefkopf der Bewirtschaftung› —
 * unter Betreiber steht ‹Briefkopf hinterlegt: nein›, und an der Stelle, wo
 * ich die Einladung erzeuge, sagt das niemand.»
 */
describe('Einladung: die Zusage zum Briefkopf', () => {
	function einladungsschritt(briefkopfHinterlegt: boolean) {
		return vorbereitungsschritte(lage({ briefkopfHinterlegt })).find(
			(s) => s.kennung === 'einladung'
		)!;
	}

	it('verspricht ihn nur, wenn es ihn gibt', () => {
		expect(einladungsschritt(true).beschreibung).toContain('mit Briefkopf');
	});

	it('sagt es, wenn keiner hinterlegt ist — samt Weg dorthin', () => {
		const ohne = einladungsschritt(false).beschreibung;
		expect(ohne).toContain('kein Briefkopf hinterlegt');
		expect(ohne).toContain('Betreiber');
		// Und verspricht ihn dann nicht doch noch im selben Satz.
		expect(ohne).not.toMatch(/mit Briefkopf der Bewirtschaftung/);
	});
});

/**
 * Die Einberufungsfrist am Schritt (Migration 098).
 *
 * Die Lage rechnet gegen `heute`; die Versammlung des Testhelfers ist am
 * 15.09.2026. Bei dreissig Tagen Frist ist der letzte Versandtag der 16.08.2026
 * — vor dem einen Datum, hinter dem anderen.
 */
describe('Einladung: die Einberufungsfrist', () => {
	function einladung(u: Partial<Vorbereitungslage>) {
		return vorbereitungsschritte(lage(u)).find((s) => s.kennung === 'einladung')!;
	}

	it('nennt den letzten Versandtag, solange Zeit bleibt', () => {
		const s = einladung({ einberufungsfristTage: 30, heute: '2026-08-01' });
		expect(s.stand).toContain('16. August 2026');
		expect(s.warnung).toBeUndefined();
	});

	it('warnt, wenn der Versandtag vorbei ist', () => {
		const s = einladung({ einberufungsfristTage: 30, heute: '2026-08-20' });
		expect(s.warnung).toContain('kann ein Beschluss angefochten werden');
	});

	/*
	 * **Kurz in der Leiste, ganz auf der Seite** (Produktentscheid 06.10.2026):
	 * Die Seite Vorbereitung zeigt `warnung`, die Seitenleiste über `alsPunkt`
	 * die Kurzfassung. Gegen den Stand davor rot: Die Leiste bekam die volle
	 * Fassung mit «nichtig» und dem Satz für Selbstversender.
	 */
	it('gibt der Leiste die Kurzfassung und der Seite die volle Warnung', () => {
		const s = einladung({ einberufungsfristTage: 30, heute: '2026-08-20' });
		expect(s.warnung).toContain('kann er nichtig sein');
		expect(s.warnung).toContain('unten auf dieser Seite den Haken');
		const leiste = alsPunkt(s).warnung!;
		expect(leiste).toBe(
			'Der letzte Tag, an dem die Einladung bei allen sein sollte, war der 16. August 2026. ' +
				'Was jetzt zu tun ist, steht auf der Seite Vorbereitung.'
		);
		expect(leiste).not.toMatch(/nichtig|unten/);
	});

	it('lässt der Leiste die übrigen Warnungen unverändert', () => {
		const ohne = einladung({
			einberufungsfristTage: null,
			heute: '2026-08-20',
			versammlungszustand: 'freigegeben'
		});
		expect(ohne.warnungKurz).toBeUndefined();
		expect(alsPunkt(ohne).warnung).toBe(ohne.warnung);
		// An der geschlossenen Versammlung auch keine Kurzfassung.
		const zu = einladung({
			einberufungsfristTage: 30,
			heute: '2026-08-20',
			versammlungszustand: 'geschlossen'
		});
		expect(zu.warnungKurz).toBeUndefined();
		expect(alsPunkt(zu).warnung).toBeUndefined();
	});

	it('schweigt, sobald die Einladung erzeugt wurde', () => {
		const s = einladung({
			einberufungsfristTage: 30,
			heute: '2026-08-20',
			einladungErzeugt: true
		});
		expect(s.warnung).toBeUndefined();
		expect(s.stand).toBeUndefined();
	});

	it('rechnet ohne hinterlegte Frist nichts aus', () => {
		const s = einladung({ einberufungsfristTage: null, heute: '2026-08-20' });
		expect(s.stand).toBeUndefined();
		// Im Entwurf steht die fehlende Angabe noch nicht als Warnung da: Dort ist
		// sie der Anfang und nicht eine Lücke.
		expect(s.warnung).toBeUndefined();
	});

	it('nennt die fehlende Frist ab der Freigabe', () => {
		const s = einladung({
			einberufungsfristTage: null,
			heute: '2026-08-20',
			versammlungszustand: 'freigegeben'
		});
		expect(s.warnung).toContain('nicht hinterlegt');
	});

	/*
	 * **Nach dem Eröffnen ist die Einberufung Geschichte** (01.09.2026, aus dem
	 * Code-Review). Eine Handlungsaufforderung an einer abgehaltenen Versammlung
	 * bliebe für immer stehen, und einen Ausweg gäbe es nicht.
	 */
	it('warnt an der geschlossenen Versammlung nicht mehr', () => {
		for (const zustand of ['laufend', 'geschlossen', 'versiegelt'] as const) {
			const s = einladung({
				einberufungsfristTage: 30,
				heute: '2026-08-20',
				versammlungszustand: zustand
			});
			expect(s.warnung, zustand).toBeUndefined();
			expect(s.stand, zustand).toBeUndefined();
		}
	});
});
