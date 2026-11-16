import { describe, expect, it } from 'vitest';
import { zeigtHierher } from '$lib/components/seitenleiste';
import {
	ablaufgruppen,
	gemeinschaftsgruppen,
	mitHerkunft,
	ohneDoppelte
} from '../../src/lib/components/ablaufleiste';
import type { Schritt, Schrittzustand } from '../../src/lib/domain/vorbereitung';

const V = 'v-1';
const G = 'g-1';

function schritt(kennung: string, titel: string, pfad: string, zustand: Schrittzustand): Schritt {
	return { kennung, titel, beschreibung: '', zustand, pfad };
}

const SCHRITTE: Schritt[] = [
	schritt('einheiten', 'Einheiten und Wertquoten', `/gemeinschaften/${G}/einheiten`, 'offen'),
	schritt('eigentuemer', 'Eigentümer und Zuordnung', `/gemeinschaften/${G}/eigentuemer`, 'offen'),
	schritt('traktanden', 'Traktandenliste', `/versammlungen/${V}/traktanden`, 'offen'),
	schritt('erfordernis', 'Mehrheitserfordernisse', `/versammlungen/${V}/traktanden`, 'offen'),
	schritt('freigabe', 'Freigeben', `/versammlungen/${V}/freigabe`, 'offen'),
	schritt('einladung', 'Einladung erzeugen', `/versammlungen/${V}/traktandenliste.pdf`, 'gesperrt'),
	schritt('zugaenge', 'Zugänge erzeugen', `/versammlungen/${V}/zugaenge`, 'gesperrt'),
	schritt(
		'anwesenheit',
		'Anwesenheit und Beschlussfähigkeit',
		`/versammlungen/${V}/anwesenheit`,
		'gesperrt'
	),
	schritt('durchfuehrung', 'Versammlung führen', `/versammlungen/${V}/leitung`, 'gesperrt'),
	schritt('auswertung', 'Auswertung', `/versammlungen/${V}/auswertung`, 'gesperrt')
];

function gruppen(zustand = 'entwurf', mitglieder = 0) {
	return ablaufgruppen({
		versammlungId: V,
		versammlungszustand: zustand,
		schritte: SCHRITTE,
		mitgliedsgemeinschaften: mitglieder
	});
}

describe('Die Ablaufleiste', () => {
	it('führt die Kapitel in der Reihenfolge des Abends', () => {
		expect(gruppen().map((g) => g.titel)).toEqual([
			'Vorbereiten',
			'Ausgeben',
			'An der Versammlung',
			'Danach',
			'Jederzeit'
		]);
	});

	/**
	 * Mit Häkchen, anders als die Traktandenliste: Datum, Uhrzeit, Ort und Art
	 * sind beim Anlegen von Hand einzutragen, ohne sie entsteht keine
	 * Versammlung. Es fehlt also nichts — und ein offener Punkt, an dem nichts
	 * zu tun ist, hielte den ganzen Ablauf scheinbar auf.
	 */
	it('setzt die Angaben an den Anfang, erledigt', () => {
		const erster = gruppen()[0].punkte[0];
		expect(erster.titel).toBe('Angaben und Unterlagen');
		expect(erster.zustand).toBe('erledigt');
	});

	it('nennt den Eingang vor der Sitzungsleitung', () => {
		const saal = gruppen().find((g) => g.titel === 'An der Versammlung');
		expect(saal?.punkte.map((p) => p.titel)).toEqual([
			'Anwesenheit und Beschlussfähigkeit',
			'Versammlung führen'
		]);
	});

	/**
	 * Die Anwesenheit kommt seit dem 02.08.2026 aus den Schritten, nicht mehr als
	 * Zusatz der Leiste — sonst übersprang die Weiter-Leiste sie.
	 */
	it('nimmt die Anwesenheit aus den Schritten und sperrt sie mit Grund', () => {
		const p = gruppen().find((g) => g.titel === 'An der Versammlung')?.punkte[0];
		expect(p?.titel).toBe('Anwesenheit und Beschlussfähigkeit');
		expect(p?.zustand).toBe('gesperrt');
		expect(p?.pfad).toBeNull();
	});

	it('zeigt die Weisungen nur, wo es Mitgliedsgemeinschaften gibt', () => {
		const ohne = gruppen('entwurf', 0)[0].punkte.map((p) => p.titel);
		const mit = gruppen('entwurf', 5)[0].punkte.map((p) => p.titel);
		expect(ohne).not.toContain('Weisungen der Häuser');
		expect(mit).toContain('Weisungen der Häuser');
	});

	/**
	 * Der Kern des Befunds vom 01.08.2026: Zwei Schritte liegen bei der
	 * Gemeinschaft. Ohne die Kennung im Abfrageteil wüsste die Seite dort nicht,
	 * für welche Versammlung gearbeitet wird — und die Leiste wechselte die
	 * Identität.
	 */
	it('trägt die Versammlung in die Schritte der Gemeinschaft', () => {
		const vorbereiten = gruppen()[0];
		const einheiten = vorbereiten.punkte.find((p) => p.titel === 'Einheiten und Wertquoten');
		expect(einheiten?.pfad).toBe(`/gemeinschaften/${G}/einheiten?zur=${V}`);
	});

	it('lässt Wege bei der Versammlung unberührt', () => {
		expect(mitHerkunft(`/versammlungen/${V}/freigabe`, V)).toBe(`/versammlungen/${V}/freigabe`);
	});

	it('hängt an einen bestehenden Abfrageteil an, statt ihn zu ersetzen', () => {
		expect(mitHerkunft(`/gemeinschaften/${G}/einheiten?art=alle`, V)).toBe(
			`/gemeinschaften/${G}/einheiten?art=alle&zur=${V}`
		);
	});
});

describe('Doppelte Einträge', () => {
	/**
	 * Sonst stünde «Einheiten und Wertquoten» zweimal in derselben Leiste, und
	 * beide wären als «hier» markiert — sie zeigen ja auf dieselbe Seite.
	 */
	it('entfernt aus den Bereichen, was der Ablauf schon führt', () => {
		const uebrig = ohneDoppelte(gemeinschaftsgruppen(G), gruppen()).flatMap((g) =>
			g.punkte.map((p) => p.titel)
		);
		expect(uebrig).not.toContain('Einheiten und Wertquoten');
		expect(uebrig).not.toContain('Eigentümer und Stimmkraft');
		expect(uebrig).toContain('Nutzniessung');
		expect(uebrig).toContain('Reglement und Quoren');
	});

	/**
	 * «Verlauf» der Gemeinschaft und «Verlauf dieser Versammlung» führen beide
	 * nach `/verlauf` und sind doch zwei Ziele. Wer nur den Pfad ohne Abfrageteil
	 * vergliche, löschte den falschen.
	 */
	it('hält zwei Wege auseinander, die sich nur im Abfrageteil unterscheiden', () => {
		const uebrig = ohneDoppelte(gemeinschaftsgruppen(G), gruppen()).flatMap((g) =>
			g.punkte.map((p) => p.pfad)
		);
		expect(uebrig).toContain(`/verlauf?gemeinschaft=${G}`);
		/*
		 * **Und der Weg dieser Versammlung filtert über die Zugehörigkeit**
		 * (Block 3, 01.10.2026). `?gegenstand=<versammlung>` traf nur Freigabe,
		 * Eröffnung und Schluss; der Verweis trägt den weitesten Filter, und
		 * diese Zusicherung hält ihn fest.
		 */
		const wege = gruppen().flatMap((g) => g.punkte.map((p) => p.pfad));
		expect(wege).toContain(`/verlauf?versammlung=${V}`);
		expect(wege).not.toContain(`/verlauf?gegenstand=${V}`);
	});

	it('lässt eine Gruppe weg, die dabei leer wird', () => {
		const nurStammdaten = [gemeinschaftsgruppen(G)[0]];
		// «Stammdaten übernehmen» steht seit dem 26.08.2026 in dieser Gruppe (vorher
		// unter «Verwaltung») und ist kein Doppel — die Aussage des Tests, dass eine
		// leer gewordene Gruppe verschwindet, prüft die zweite Zusicherung unten.
		expect(ohneDoppelte(nurStammdaten, gruppen())[0].punkte.map((p) => p.titel)).toEqual([
			'Nutzniessung',
			'Stammdaten übernehmen'
		]);

		const ohneNutzniessung = [{ titel: 'Stammdaten', punkte: nurStammdaten[0].punkte.slice(0, 2) }];
		expect(ohneDoppelte(ohneNutzniessung, gruppen())).toEqual([]);
	});
});

describe('Der Weg zum gemeinsamen Abend', () => {
	/**
	 * Gemeldet am 12.08.2026: «Was in den Gemeinschaftsansichten fehlt ist der
	 * Absprung auf die Sammelversammlung, wenn vorhanden. Ich komme von dort nie
	 * wieder zurück auf die Sammelansicht, bzw. nur umständlich.»
	 *
	 * Bisher gab es ihn nur in der Herkunftszeile — und die entsteht erst, wenn
	 * man **mit** `?zur=` gekommen ist.
	 */
	const versammlungen = (gemeinsam: { id: string; bezeichnung: string } | null) => [
		{ id: 'v1', datum: '2026-10-11', zustand: 'entwurf', gemeinsam }
	];

	function versammlungspunkte(offene: Parameters<typeof gemeinschaftsgruppen>[1]) {
		return gemeinschaftsgruppen(G, offene).find((g) => g.titel === 'Versammlungen')!.punkte;
	}

	it('stellt den Abend unmittelbar unter seine Versammlung', () => {
		const punkte = versammlungspunkte(versammlungen({ id: 't1', bezeichnung: 'Herbstrunde' }));
		expect(punkte.slice(0, 2).map((p) => p.pfad)).toEqual(['/versammlungen/v1', '/tage/t1']);
		expect(punkte[1].titel).toContain('Herbstrunde');
	});

	it('sagt, was der zweite Eintrag ist', () => {
		// Ohne den Stand stünden zwei Zeilen untereinander, die beide nach einer
		// Versammlung aussehen.
		const punkte = versammlungspunkte(versammlungen({ id: 't1', bezeichnung: 'Herbstrunde' }));
		expect(punkte[1].stand).toBe('gemeinsamer Abend');
	});

	it('lässt ihn weg, wo die Versammlung allein steht', () => {
		const punkte = versammlungspunkte(versammlungen(null));
		expect(punkte.map((p) => p.pfad)).not.toContain('/tage/t1');
		expect(punkte[0].pfad).toBe('/versammlungen/v1');
	});

	it('führt bei zwei Versammlungen jeden Abend bei seiner eigenen', () => {
		// Eine eigene Gruppe «Gemeinsame Versammlungen» liesse offen, welcher
		// Abend zu welcher Versammlung gehört.
		const punkte = versammlungspunkte([
			{ id: 'v1', datum: '2026-10-11', zustand: 'entwurf', gemeinsam: { id: 't1', bezeichnung: 'Herbst' } },
			{ id: 'v2', datum: '2027-03-04', zustand: 'entwurf', gemeinsam: { id: 't2', bezeichnung: 'Frühling' } }
		]);
		expect(punkte.slice(0, 4).map((p) => p.pfad)).toEqual([
			'/versammlungen/v1',
			'/tage/t1',
			'/versammlungen/v2',
			'/tage/t2'
		]);
	});

	it('behält Historie und Neuanlage am Ende der Gruppe', () => {
		const punkte = versammlungspunkte(versammlungen({ id: 't1', bezeichnung: 'Herbstrunde' }));
		expect(punkte.at(-2)!.pfad).toBe(`/gemeinschaften/${G}/historie`);
		expect(punkte.at(-1)!.pfad).toBe(`/gemeinschaften/${G}/versammlungen/neu`);
	});
});

describe('Welcher Punkt der Leiste ist «hier»', () => {
	/**
	 * Gemeldet am 12.08.2026: «Obwohl ich auf Reglement und Quoren bin, zeigt die
	 * Sitelink Einheiten und Wertquoten an.» Die vier Stammdatenschritte einer
	 * gemeinsamen Versammlung führen alle auf dieselbe Seite.
	 */
	const abfrage = (s: string) => new URLSearchParams(s);

	it('unterscheidet zwei Punkte, die sich nur im Abfrageteil trennen', () => {
		const hier = '/tage/t1/stammdaten';
		const dort = abfrage('thema=reglement');
		expect(zeigtHierher('/tage/t1/stammdaten?thema=reglement', hier, dort)).toBe(true);
		expect(zeigtHierher('/tage/t1/stammdaten?thema=einheiten', hier, dort)).toBe(false);
	});

	it('lässt der Seite weitere Parameter durchgehen', () => {
		// Herkunft und Stichtag stehen oft daneben; sie dürfen die Marke nicht
		// löschen.
		expect(
			zeigtHierher('/gemeinschaften/g1/einheiten', '/gemeinschaften/g1/einheiten', abfrage('zur=v1'))
		).toBe(true);
	});

	it('verlangt umgekehrt jeden Parameter des Punktes', () => {
		expect(zeigtHierher('/verlauf?gegenstand=g1', '/verlauf', abfrage(''))).toBe(false);
		expect(zeigtHierher('/verlauf?gegenstand=g1', '/verlauf', abfrage('gegenstand=g2'))).toBe(false);
		expect(zeigtHierher('/verlauf?gegenstand=g1', '/verlauf', abfrage('gegenstand=g1'))).toBe(true);
	});

	it('bleibt beim Pfad, wenn der Punkt keinen Abfrageteil trägt', () => {
		expect(zeigtHierher('/personen', '/personen', abfrage('suche=meier'))).toBe(true);
		expect(zeigtHierher('/personen', '/personen/p1', abfrage(''))).toBe(false);
	});

	it('markiert nichts bei einem gesperrten Punkt', () => {
		expect(zeigtHierher(null, '/personen', abfrage(''))).toBe(false);
	});
});
