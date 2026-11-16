/**
 * Der Einsprachebeschluss nach ZGB Art. 712c Abs. 2 (Fassung 2026-10-20).
 * Je Akzeptanzkriterium aus `.auftraege/2026-10-19-votum-einsprachebeschluss-712c.md`
 * mindestens eine Probe mit Gegenrichtung; die Nummern stehen am Test.
 */
import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { alleFassungen, holeRegelwerk } from '$lib/rules';
import {
	EINSPRACHE,
	EINSPRACHE_BETROFFENE_ANWENDUNG,
	EINSPRACHE_BETROFFENE_WEBSITE,
	EINSPRACHE_KNOTEN_ID,
	SONDERFAELLE_BESCHREIBUNG
} from '$lib/rules/quorum-2026-10-20';
import { erfordernisluecke } from '$lib/domain/abstimmung';
import { mehrhinweise } from '$lib/domain/mehrhinweise';
import { hinweiseZu } from '$lib/domain/traktanden';
import { pruefeFreigabe, type Freigabelage } from '$lib/domain/freigabe';
import { vergleicheMitEinladung } from '$lib/domain/einladungsmehr';
import {
	betroffenenlage,
	betroffeneStimmenNichtMit,
	bezeichnungMitBasis,
	EINSPRACHE_KNOTEN,
	erfordernisAus,
	ergebniskarte,
	laufe,
	mehrheitMitBasis,
	zahlenbeispiel,
	zaehlweiseBeiEinsprache,
	type Erfordernis
} from '$lib/domain/entscheidbaum';
import { bezugsgroessenHinweis, bezugsgroessensatz, pruefeRegelwerk, regelKannGreifen, regelNurFallgenau } from '$lib/domain/regelwerk';
import {
	einordnungGegenGesetz,
	karteMitEnthaltung,
	karteMitReglement,
	regelReichweite,
	wendeReglementAn,
	zahlenbeispielFuerRegel,
	type Reglementsregel
} from '$lib/domain/reglement';
import {
	erfordernisInWorten,
	vomStimmrechtAusgeschlossen,
	zaehleAus,
	zaehleSummenAus,
	type Auszaehlungslage
} from '$lib/domain/auszaehlung';
import { auffangregelStimmrecht, gegenstandAus } from '$lib/domain/nutzniessung';
import type { Snapshot, Vote } from '$lib/domain/types';

const NEU = holeRegelwerk('2026-10-20');
const VOR = holeRegelwerk('2026-10-19');
const knoten = NEU.knoten.find((k) => k.id === EINSPRACHE_KNOTEN)!;
const einsprache = () => erfordernisAus(NEU, laufe(NEU, 'a-sonderfaelle', ['f8-1-einsprache']));
const gewoehnlich = () => erfordernisAus(NEU, laufe(NEU, 'a-verwaltung', ['f7-1-gewoehnlich']));

function regel(u: Partial<Reglementsregel>): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'grundordnung',
		knotenId: EINSPRACHE_KNOTEN,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		fundstelle: 'Reglement Ziff. 7',
		enthaltungZaehltMit: true,
		...u
	};
}

/** Fünf Parteien mit je einer Wohnung und einer Kopfstimme. */
function fuenf(): Snapshot {
	return {
		meetingId: 'v-1',
		takenAt: '2026-10-20T17:00:00.000Z',
		headCountMode: 'per_owner',
		parkingCountsAsHead: true,
		headCountRuleSource: null,
		tieBreak: 'keiner',
		totalQuota: 1000,
		parties: ['Erfunden Verkäuferin', 'Erfunden B', 'Erfunden C', 'Erfunden D', 'Erfunden E'].map(
			(name, i) => ({
				partyId: `p${i + 1}`,
				displayName: name,
				representativeName: null,
				isCommunity: false,
				units: [
					{
						unitId: `u${i + 1}`,
						label: `W${i + 1}`,
						kind: 'unit' as const,
						countsAsHead: true,
						quota: 200
					}
				]
			})
		)
	};
}

function stimme(m: Snapshot, partei: string, wahl: 'yes' | 'no'): Vote {
	const p = m.parties.find((x) => x.partyId === partei)!;
	return {
		partyId: partei,
		unitId: p.units[0].unitId,
		choice: wahl,
		castAt: '2026-10-20T19:10:00.000Z',
		recordedByChair: false
	};
}

function lage(e: Erfordernis, u: Partial<Auszaehlungslage> = {}): Auszaehlungslage {
	const m = fuenf();
	return {
		momentaufnahme: m,
		erfordernis: e,
		// p1 verkauft und stimmt mit Ja, mit ihr p2 und p3; p4 und p5 sagen Nein.
		stimmen: [
			stimme(m, 'p1', 'yes'),
			stimme(m, 'p2', 'yes'),
			stimme(m, 'p3', 'yes'),
			stimme(m, 'p4', 'no'),
			stimme(m, 'p5', 'no')
		],
		anwesende: m.parties.map((p) => p.partyId),
		betroffeneParteiIds: ['p1'],
		...u
	};
}

describe('Einsprache 712c: 1. Antwort und Knoten', () => {
	it('1. f8-1 bietet die Einsprache hinter der Ausschlussklage; sie führt zum einfachen Mehr der Anwesenden ohne Wertquoten', () => {
		const f = NEU.fragen.find((x) => x.id === 'f8-1')!;
		const ids = f.antworten.map((a) => a.id);
		expect(ids.indexOf('f8-1-einsprache')).toBe(ids.indexOf('f8-1-ausschluss') + 1);
		const e = einsprache();
		expect(e.knotenId).toBe(EINSPRACHE_KNOTEN);
		expect(e.typ).toBe('einfaches_mehr');
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(e.quotenbasis).toBe('keine');
		expect(e.quotenSchwelle).toBeNull();
		expect(e.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(e.reglementsverhalten).toBe('nur_verschaerfen');
		expect(e.rechtsgrundlage).toBe('ZGB Art. 712c Abs. 2 und 3');
		expect(knoten.rang).toBe('lehre');
		// «oder» wie die übrige Anwendung (Produktentscheid 08.10.2026).
		expect(knoten.begruendung).toMatch(/einfache Mehr der Anwesenden oder Vertretenen \(Wermelinger, SVIT-Kommentar 2023, Art\. 712c Rz\. 185; Handschin\/Wyttenbach, S\. 68 f\.\)\. Nach Gesetz hat dabei jeder Eigentümer eine Stimme \(Art\. 712m Rz\. 181\)/);
		// Die Fassung führt die Kennung selbst (Daten statt Code); sie muss der des Kerns gleichen.
		expect(EINSPRACHE_KNOTEN_ID).toBe(EINSPRACHE_KNOTEN);
	});

	it('1. Gegenrichtung: die Ausschlussklage bleibt, und das Einführen des Rechts bleibt einstimmig', () => {
		const a = erfordernisAus(NEU, laufe(NEU, 'a-sonderfaelle', ['f8-1-ausschluss']));
		expect(a.knotenId).toBe('k-ausschlussklage');
		expect(a.kopfbasis).toBe('alle_ausser_betroffene');
		// Der Verweis der Hilfe zeigt auf einen Ast mit dieser Antwort.
		const antwort = NEU.fragen.find((x) => x.id === 'f8-1')!.antworten.find((x) => x.id === 'f8-1-einsprache')!;
		expect(antwort.hilfe).toContain('«Grundstück und Grundordnung»');
		const ast = NEU.aeste.find((x) => x.titel === 'Grundstück und Grundordnung')!;
		const vorkauf = erfordernisAus(NEU, laufe(NEU, ast.id, ['f6-1-vorkauf']));
		expect(vorkauf.knotenId).toBe('k-vorkaufsrecht');
		expect(vorkauf.typ).toBe('einstimmigkeit');
	});

	it('1. der Eigentümer stimmt ohne Absprache, nicht der Nutzniesser (Ä-24)', () => {
		expect(knoten.geschaeftsart).toBe('grundordnung');
		expect(auffangregelStimmrecht(gegenstandAus(knoten.geschaeftsart, knoten.id)!)).toBe('eigentuemer');
	});
});

describe('Einsprache 712c: 2. Der Betroffene stimmt nicht mit', () => {
	it('2. zählt ihn nicht in der Bezugsgrösse und nicht bei den Ja-Stimmen', () => {
		const a = zaehleAus(lage(einsprache()));
		expect(a.koepfe.basis).toBe(4);
		expect(a.koepfe.schwelle).toBe(3);
		expect(a.koepfe.ja).toBe(2);
		expect(a.koepfe.nein).toBe(2);
		expect(a.angenommen).toBe(false);
		const text = [...a.hinweise, ...(a.protokollhinweise ?? []).map((p) => p.satz)].join(' ');
		expect(text).toMatch(/«Erfunden Verkäuferin» ist als betroffen eingetragen und zählt hier nicht mit/);
		expect(text).toMatch(/Art\. 712c Abs\. 2/);
		expect(text).not.toMatch(/Beklagt|649b/);
		// Der Satz im Protokoll (Laienprüfung des Nachtrags zur Featureprüfung).
		expect((a.protokollhinweise ?? []).map((p) => p.satz)).toContain(
			'«Erfunden Verkäuferin» zählte nicht mit: Wer verkauft, vermietet oder belastet, stimmt hier nicht mit (Art. 712c Abs. 2 ZGB).'
		);
	});

	it('2. Handzählung (T3): die Verkäuferin fällt heraus, ohne Beklagten', () => {
		const { stimmen: _, ...ohneStimmen } = lage(einsprache());
		const a = zaehleSummenAus(ohneStimmen, { ja: 2, nein: 2, enthaltung: 0 });
		expect(a.koepfe.basis).toBe(4);
		expect(a.angenommen).toBe(false);
		const text = [...a.hinweise, ...(a.protokollhinweise ?? []).map((p) => p.satz)].join(' ');
		expect(text).toMatch(/1 anwesende Partei ist unmittelbar betroffen und zählt hier nicht mit/);
		expect(text).not.toMatch(/Beklagt|649b/);
		// Gegenrichtung: am gewöhnlichen Knoten zählt sie mit.
		const { stimmen: __, ...gewoehnlichOhne } = lage(gewoehnlich());
		expect(zaehleSummenAus(gewoehnlichOhne, { ja: 3, nein: 2, enthaltung: 0 }).koepfe.basis).toBe(5);
	});

	it('2. Gegenrichtung: an einem gewöhnlichen Knoten zählt dieselbe Partei mit', () => {
		const a = zaehleAus(lage(gewoehnlich()));
		expect(a.koepfe.basis).toBe(5);
		expect(a.koepfe.ja).toBe(3);
		expect(a.angenommen).toBe(true);
	});

	it('2. ihre Vertretung zählt nicht, die vertretene Partei gilt dann als abwesend', () => {
		const a = zaehleAus(
			lage(einsprache(), {
				// p2 ist nur über die Verkäuferin vertreten.
				vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }]
			})
		);
		expect(a.koepfe.basis).toBe(3);
		expect(a.koepfe.ja).toBe(1);
		expect(a.ohneZustimmung.find((f) => f.parteiId === 'p2')?.grund).toBe('vertretung_ruht');
		const text = a.hinweise.join(' ');
		expect(text).toMatch(/«Erfunden B» war nur über Erfunden Verkäuferin vertreten/);
		expect(text).toMatch(/bei den übrigen Traktanden gilt die Vollmacht wieder/);
		expect(text).toMatch(/Einsprache gegen das eigene Geschäft nicht mitstimmt; Votum zählt seine Vollmachten hier nicht/);
		expect(text).not.toMatch(/Beklagt|BGE 134 III 481/);
		const protokoll = (a.protokollhinweise ?? []).map((p) => p.satz).join(' ');
		expect(protokoll).toMatch(/stimmte bei der Einsprache gegen das eigene Geschäft nicht mit, und Votum zählte die Vollmacht nicht/);
		expect(protokoll).not.toMatch(/Beklagt|durfte/);
		expect(vomStimmrechtAusgeschlossen(einsprache(), [], ['p1']).get('p1')).toBe('betroffen');
	});

	it('2. Gegenrichtung: an einem gewöhnlichen Knoten bleibt die Vollmacht wirksam', () => {
		const a = zaehleAus(
			lage(gewoehnlich(), { vertretungen: [{ vertreteneId: 'p2', bevollmaechtigtId: 'p1' }] })
		);
		expect(a.koepfe.basis).toBe(5);
		expect(a.ohneZustimmung.find((f) => f.grund === 'vertretung_ruht')).toBeUndefined();
		expect(vomStimmrechtAusgeschlossen(gewoehnlich(), [], ['p1']).size).toBe(0);
	});

	it('2. ohne eingetragene Betroffene sperren Abstimmung und Freigabe, mit Eintrag nicht', () => {
		const luecke = erfordernisluecke(einsprache(), 0);
		expect(luecke?.kennung).toBe('einsprache_ohne_betroffene');
		expect(luecke?.satz).toMatch(/wer verkauft, vermietet oder belastet/);
		expect(luecke?.satz).not.toMatch(/Beklagt|Ausschlussklage/);
		expect(erfordernisluecke(einsprache(), 1)).toBeNull();
		// Gegenrichtung: ein gewöhnliches Mehr braucht keinen Eintrag.
		expect(erfordernisluecke(gewoehnlich(), 0)).toBeNull();

		const lageF = (u: Partial<Freigabelage>): Freigabelage => ({
			versammlungsdatum: '2026-11-20',
			anzahlTraktanden: 1,
			ohneErfordernis: [],
			grenzfaelle: [],
			quotenabweichungen: [],
			einheitenOhneEigentuemer: [],
			anzahlParteien: 5,
			...u
		});
		const b = pruefeFreigabe(lageF({ einspracheOhneBetroffene: [{ nummer: '4', titel: 'Erfunden Einsprache' }] }));
		expect(b.moeglich).toBe(false);
		const h = b.hindernisse.find((x) => x.kennung === 'einsprache_ohne_betroffene')!;
		expect(h.text).toMatch(/wer verkauft, vermietet oder belastet/);
		expect(h.text).not.toMatch(/Beklagt|Ausschlussklage/);
		expect(pruefeFreigabe(lageF({ einspracheOhneBetroffene: [] })).moeglich).toBe(true);
	});

	it('2. der Entwurf sagt es schon, mit Eintrag nicht mehr', () => {
		const t = { inhalt: 'Erfunden Einsprache', kurzfassung: '', art: 'abstimmung' as const };
		const ohne = hinweiseZu(t, einsprache(), []).find((h) => h.feld === 'betroffene');
		expect(ohne?.text).toMatch(/nicht eingetragen, wer verkauft, vermietet oder belastet/);
		expect(ohne?.text).not.toMatch(/Beklagt|Ausschlussklage/);
		expect(hinweiseZu(t, einsprache(), ['p1']).some((h) => h.feld === 'betroffene')).toBe(false);
		expect(hinweiseZu(t, gewoehnlich(), []).some((h) => h.feld === 'betroffene')).toBe(false);
	});

	it('2. die Erfassung der Betroffenen wird angeboten, mit Wörtern ohne Beklagten', () => {
		const e = einsprache();
		expect(betroffeneStimmenNichtMit(e)).toBe(true);
		expect(betroffenenlage(e)).toEqual({ kennt: true, form: null, beklagtenumfang: false, beklagt: false });
		expect(betroffenenlage(gewoehnlich()).kennt).toBe(false);
		expect(betroffenenlage({ ...e, knotenId: 'k-ausschlussklage' }).beklagt).toBe(true);
		expect(bezeichnungMitBasis(NEU, e)).toBe('Einfaches Mehr der anwesenden oder vertretenen, ohne den Eigentümer, der verkauft, vermietet oder belastet');
		expect(erfordernisInWorten(e)).toMatch(/ohne den Eigentümer, der verkauft, vermietet oder belastet/);
		expect(erfordernisInWorten({ ...e, quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } })).toMatch(
			/oder belastet, und mehr als die Hälfte aller Wertquoten$/
		);
		// N2: Der Nebensatz ist vor einem weiteren Teil mit Komma geschlossen.
		expect(mehrheitMitBasis('Qualifiziertes Mehr', { ...e, typ: 'qualifiziertes_mehr', quotenbasis: 'anwesend_vertreten' })).toBe(
			'Qualifiziertes Mehr ohne den Eigentümer, der verkauft, vermietet oder belastet, Wertquoten der anwesenden oder vertretenen'
		);
		expect(mehrheitMitBasis('Qualifiziertes Mehr', { ...e, typ: 'qualifiziertes_mehr', quotenbasis: 'alle_quoten' })).toBe(
			'Qualifiziertes Mehr ohne den Eigentümer, der verkauft, vermietet oder belastet'
		);
		// Gegenrichtung: an der Ausschlussklage bleibt der Beklagte.
		expect(
			bezeichnungMitBasis(NEU, { ...e, knotenId: 'k-ausschlussklage' })
		).toBe('Einfaches Mehr der anwesenden oder vertretenen, ohne den Beklagten');
		const karte = ergebniskarte(NEU, knoten);
		expect(karte.bezugsgroessensatz).toBe(
			'Die Bezugsgrösse sind die anwesenden oder vertretenen Stimmen ohne den Eigentümer, der verkauft, ' +
				'vermietet oder belastet. Er stimmt nicht mit, und Votum zählt auch seine Vollmachten nicht. Wer ' +
				'nicht erschienen ist und niemanden bevollmächtigt hat, zählt nicht mit.'
		);
		expect(karte.bezugsgroessensatz).not.toMatch(/Beklagt|649b/);
		expect(zahlenbeispiel(knoten, { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner', betroffene: 1 })).toBe(
			'Bei 9 Eigentümern ohne den Eigentümer, der verkauft, vermietet oder belastet, wenn alle übrigen erschienen oder vertreten sind: nötig sind 5 Ja-Stimmen.'
		);
	});
});

describe('Einsprache 712c: 3. Reglement nur verschärfend', () => {
	const karte = (r: Reglementsregel) => {
		const a = wendeReglementAn(einsprache(), [r], null, LESARTEN_VORGABE);
		return { a, k: karteMitReglement(ergebniskarte(NEU, knoten), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis) };
	};

	it('3. wendet eine strengere Regel für genau diesen Fall an', () => {
		const { a, k } = karte(regel({}));
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.quelle).toBe('reglement');
		expect(a.erfordernis.kopfSchwelle).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
		expect(k.reglementsvorbehalt).toContain(knoten.reglementsrecht!);
		// Der Betroffene bleibt auch unter der Regel draussen.
		expect(k.bezugsgroessensatz).toMatch(/ohne den Eigentümer, der verkauft, vermietet oder belastet\. Er stimmt nicht mit/);
		const z = zaehleAus(lage(a.erfordernis));
		expect(z.koepfe.basis).toBe(4);
		// Und unter einer Regel aller Eigentümer zählt das Beispiel ohne sie.
		expect(
			zahlenbeispielFuerRegel(
				wendeReglementAn(einsprache(), [regel({ kopfbasis: 'alle_eigentuemer' })], null, LESARTEN_VORGABE).regel!,
				{ kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner', betroffene: 1 },
				a.erfordernis
			)
		).toBe('Bei 9 Eigentümern ohne den Eigentümer, der verkauft, vermietet oder belastet: nötig sind 6 Ja-Stimmen.');
	});

	it('3. wendet eine gleich strenge Regel an: Sie erleichtert nichts', () => {
		const { a } = karte(regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }));
		expect(a.vorbehalt).toBeNull();
		expect(a.erfordernis.quelle).toBe('reglement');
	});

	it('3. wendet eine mildere nicht an, und die Karte sagt warum', () => {
		const { a, k } = karte(regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mindestens' } }));
		expect(a.vorbehalt).toBe('milderung');
		expect(a.erfordernis.typ).toBe('einfaches_mehr');
		expect(a.erfordernis.quelle).toBe('hergeleitet');
		expect(k.reglementsvorbehalt).toMatch(
			/Sie wird hier nicht angewandt: Ihre Regel ist in mindestens einer Hinsicht milder als das Gesetz oder lässt sich nicht eindeutig einordnen\. Ein strengeres Mehr gilt nur/
		);
		expect(k.reglementsvorbehalt).toMatch(/halten Sie den Einwand im Protokoll fest/);
		expect(k.reglementsvorbehalt).toMatch(/Rz\. 183, 186/);
		expect(k.reglementsvorbehalt).toMatch(/Ausgezählt wird nach dem Gesetz/);
	});

	it('3. wendet eine Regel aller übrigen Eigentümer an: Sie ist strenger (Codeprüfung M1)', () => {
		// Die Betroffenen stimmen unter keiner Kopfbasis mit; «die Anwesenden» sind dann
		// eine Teilmenge von «alle ausser den Betroffenen».
		const uebrige = karte(regel({ kopfbasis: 'alle_ausser_betroffene', kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }));
		expect(uebrige.a.vorbehalt).toBeNull();
		expect(uebrige.a.erfordernis.kopfbasis).toBe('alle_ausser_betroffene');
		// «Alle Eigentümer» liest Votum dort als alle ohne die Betroffenen, mit eigenem Satz.
		const alle = karte(regel({ kopfbasis: 'alle_eigentuemer', kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }));
		expect(alle.a.vorbehalt).toBeNull();
		expect(alle.a.erfordernis.kopfbasis).toBe('alle_ausser_betroffene');
		expect(alle.a.lesart).toMatch(/Bei der Einsprache liest dieses Werkzeug das als alle Eigentümer ohne den Eigentümer, der verkauft, vermietet oder belastet, denn er stimmt hier nicht mit/);
		expect(alle.a.lesart).not.toMatch(/Beklagt|649b/);
		expect(alle.k.reglementsvorbehalt).toContain(alle.a.lesart!);
		// Gezählt wird über alle, ohne die Verkäuferin: fünf Wohnungen, Basis vier.
		expect(zaehleAus(lage(alle.a.erfordernis)).koepfe.basis).toBe(4);
		// Und die Einladung: dieselbe Regel gilt als strenger als das gedruckte Gesetz.
		expect(vergleicheMitEinladung(uebrige.a.erfordernis, einsprache())).toBe('strenger');
		// Gegenrichtung: an einem gewöhnlichen Knoten bleibt «alle ausser den Betroffenen» unvergleichbar.
		expect(vergleicheMitEinladung({ ...gewoehnlich(), kopfbasis: 'alle_ausser_betroffene' }, gewoehnlich())).toBe('gemischt');
	});

	it('3. wendet eine nicht vergleichbare nicht an: Enthaltungen draussen', () => {
		// Höherer Bruch, aber ohne Enthaltungen: in einer Hinsicht milder.
		// `regelStrengerAlsGesetz` hielte sie für strenger; deshalb die Einordnung.
		const { a, k } = karte(regel({ enthaltungZaehltMit: false }));
		expect(a.vorbehalt).toBe('milderung');
		// Der Kartentext dazu, nicht nur die Kennung (Featureprüfung T4).
		expect(k.reglementsvorbehalt).toMatch(
			/Sie wird hier nicht angewandt: Ihre Regel ist in mindestens einer Hinsicht milder als das Gesetz oder lässt sich nicht eindeutig einordnen\. Ein strengeres Mehr gilt nur/
		);
		expect(k.reglementsvorbehalt).toMatch(/Ausgezählt wird nach dem Gesetz\. Wird eine abweichende Bestimmung im Saal eingewendet/);
		expect(k.reglementsvorbehalt).toContain(knoten.reglementsrecht!);
	});

	it('3. ohne hinterlegte Regel steht der Stand zuerst (Featureprüfung N5)', () => {
		const k = karteMitReglement(ergebniskarte(NEU, knoten), null, null, null, null, undefined, einsprache());
		expect(k.reglementsvorbehalt).toMatch(
			/^Für diesen Fall ist in dieser Gemeinschaft keine Abweichung hinterlegt; gezählt wird nach dem Gesetz\./
		);
		expect(k.reglementsvorbehalt).toContain(knoten.reglementsrecht!);
		// Gegenrichtung: an einer Karte mit `frei` am Schluss, wie bisher.
		const g = gewoehnlich();
		const kg = karteMitReglement(ergebniskarte(NEU, NEU.knoten.find((x) => x.id === g.knotenId)!), null, null, null, null, undefined, g);
		expect(kg.reglementsvorbehalt).not.toMatch(/^Für diesen Fall/);
		expect(kg.reglementsvorbehalt).toMatch(/keine Abweichung hinterlegt — geprüft wurde also nicht Ihr Reglement/);
	});

	it('3. wendet eine allgemeine Regel der Grundordnung nicht an, auch eine strengere', () => {
		const { a, k } = karte(regel({ knotenId: null }));
		expect(a.vorbehalt).toBe('nur_fallgenau');
		expect(a.erfordernis.quelle).toBe('hergeleitet');
		expect(k.reglementsvorbehalt).toMatch(/Sie wird hier nicht angewandt, weil sie nicht eigens für die Einsprache hinterlegt ist\. Ein strengeres Mehr, das alle vereinbart haben/);
		expect(k.reglementsvorbehalt).not.toMatch(/ziehen Sie danach nach/);
		expect(k.reglementsvorbehalt).not.toMatch(/Zweckbestimmung/);
		expect(regelNurFallgenau(knoten)).toBe(true);
		expect(regelKannGreifen(knoten.reglementsverhalten)).toBe(true);
	});

	it('3. die Einstellung, Enthaltungen nicht zu zählen, erleichtert hier nicht', () => {
		const a = wendeReglementAn(einsprache(), [], { fundstelle: 'Reglement Ziff. 3' }, LESARTEN_VORGABE);
		expect(a.erfordernis.enthaltungZaehltMit).not.toBe(false);
		expect(a.enthaltung?.angewandt).toBe(false);
		const k = karteMitEnthaltung(ergebniskarte(NEU, knoten), a.enthaltung);
		expect(k.stimmwirkung.join(' ')).toMatch(/Enthaltungen zählen bei der Einsprache nach herrschender Lehre mit und wirken damit wie ein Nein; sagen Sie das vor der Abstimmung an/);
		// Gegenrichtung: an der gewöhnlichen Verwaltung nimmt sie sie heraus.
		expect(wendeReglementAn(gewoehnlich(), [], { fundstelle: 'Reglement Ziff. 3' }, LESARTEN_VORGABE).erfordernis.enthaltungZaehltMit).toBe(false);
	});

	it('3. die Reglementsseite nennt die Einsprache mit ihrer Bedingung', () => {
		const satz = regelReichweite(NEU, 'grundordnung')!;
		expect(satz).toMatch(/Bei «Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht» wird nur eine Regel angewandt, die Sie für genau diesen Fall hinterlegen\. Sie muss mit dem Einspracherecht oder später von allen Eigentümern schriftlich vereinbart/);
		expect(satz).toMatch(/schriftlich vereinbart und in keiner Hinsicht milder sein als das Gesetz\. Eine mildere und eine nicht vergleichbare wendet das Werkzeug dort nicht an\./);
		// Eine Regel für die ganze Grundordnung greift weiter nirgends (Codeprüfung N3).
		expect(satz).toMatch(/Eine Regel für alle Geschäfte der Art «Grundstück und Grundordnung» wird zurzeit nirgends angewandt/);
		expect(satz).not.toMatch(/Eine Regel für diese Geschäftsart wird zurzeit nirgends/);
		// Gegenrichtung: in der Vorfassung greift in der Grundordnung keine Regel.
		expect(regelReichweite(VOR, 'grundordnung')).toMatch(/nirgends angewandt/);
	});
});

describe('Einsprache 712c: Wortlaute aus Laien-, Fach- und Codeprüfung', () => {
	const zahlen = { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner' as const, betroffene: 1 };

	it('N1/M2: unter einer angewandten Klausel aller Eigentümer sagt die Karte dasselbe wie das Zahlenbeispiel', () => {
		// Gemessen über die ganze Kette: Regel anwenden, Karte bauen, Zahlenbeispiel aus der gelesenen Regel.
		for (const kopfbasis of ['alle_eigentuemer', 'alle_ausser_betroffene'] as const) {
			const r = regel({ kopfbasis });
			const a = wendeReglementAn(einsprache(), [r], null, LESARTEN_VORGABE);
			expect(a.vorbehalt, kopfbasis).toBeNull();
			const beispiel = zahlenbeispielFuerRegel(a.regel!, zahlen, a.erfordernis)!;
			const k = karteMitReglement(ergebniskarte(NEU, knoten), a.regel, a.vorbehalt, null, beispiel, a.lesart, a.erfordernis);
			expect(k.bezugsgroesse, kopfbasis).toBe(
				'Hier zählen alle Eigentümer ohne den Eigentümer, der verkauft, vermietet oder belastet, unabhängig ' +
					'davon, wer erschienen ist. Wer nicht da ist und niemanden bevollmächtigt hat, wirkt wie ein Nein.'
			);
			// Kein festes «fünf Ja» neben einem Beispiel mit sechs.
			expect(k.bezugsgroesse).not.toMatch(/fünf|zehn/);
			expect(k.zahlenbeispiel, kopfbasis).toBe('Bei 9 Eigentümern ohne den Eigentümer, der verkauft, vermietet oder belastet: nötig sind 6 Ja-Stimmen.');
			expect(k.bezugsgroessensatz, kopfbasis).toMatch(/^Die Bezugsgrösse sind alle Eigentümer ohne den Eigentümer, der verkauft, vermietet oder belastet, unabhängig von der Anwesenheit\. Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit und wirkt wie ein Nein\.$/);
			expect([k.bezugsgroesse, k.bezugsgroessensatz, k.zahlenbeispiel, a.lesart ?? ''].join(' '), kopfbasis).not.toMatch(/Betroffenen/);
			expect([k.bezugsgroesse, k.bezugsgroessensatz, k.zahlenbeispiel].join(' ')).not.toMatch(/Beklagt/);
		}
		// Gegenrichtung: anderswo bleibt der allgemeine Hinweis mit Beispiel.
		expect(bezugsgroessenHinweis({ kopfbasis: 'alle_ausser_betroffene', id: 'k-verwaltung-gewoehnlich' })).toMatch(/fünf Ja-Stimmen/);
		expect(bezugsgroessensatz('alle_eigentuemer')).toBe(
			'Die Bezugsgrösse sind alle Eigentümer, auch die nicht erschienenen. Wer fernbleibt und niemanden bevollmächtigt hat, zählt mit und wirkt damit gegen den Antrag.'
		);
		expect(bezugsgroessenHinweis({ kopfbasis: 'alle_eigentuemer', id: 'k-verwaltung-gewoehnlich' })).not.toMatch(/Betroffenen/);
	});

	it('M3: unter einer angewandten strengeren Regel sagt die Karte, was die Leitung tut, mit der Frist', () => {
		const a = wendeReglementAn(einsprache(), [regel({})], null, LESARTEN_VORGABE);
		const k = karteMitReglement(ergebniskarte(NEU, knoten), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(k.reglementsvorbehalt).toContain(knoten.reglementsrecht!);
		expect(k.reglementsvorbehalt).toMatch(/Wie Ihre Regel zustande kam, kann dieses Werkzeug nicht prüfen/);
		expect(k.reglementsvorbehalt).toMatch(
			/Scheitert die Einsprache nur an Ihrer strengeren Bestimmung, halten Sie im Protokoll fest, ob sie das gesetzliche Erfordernis erreicht hätte/
		);
		expect(k.reglementsvorbehalt).toMatch(/Nach Ablauf der 14 Tage lässt sie sich nicht nachholen\. Klären Sie deshalb vor der Versammlung, ob Ihre Bestimmung gilt, also ob sie im Begründungsakt steht oder von allen Eigentümern unterschrieben ist/);
		// Gegenrichtung: an einer Karte mit `frei` steht der Block nicht.
		const g = gewoehnlich();
		const ag = wendeReglementAn(g, [regel({ geschaeftsart: g.geschaeftsart!, knotenId: g.knotenId })], null, LESARTEN_VORGABE);
		expect(ag.vorbehalt).toBeNull();
		const kg = karteMitReglement(ergebniskarte(NEU, NEU.knoten.find((x) => x.id === g.knotenId)!), ag.regel, null, null, null, ag.lesart, ag.erfordernis);
		expect(kg.reglementsvorbehalt).not.toMatch(/14 Tage|Wie Ihre Regel zustande kam/);
	});

	it('N2: die Rangfolge hängt an der Kennung; die Ausschlussklage bleibt, wie sie war', () => {
		const ak = erfordernisAus(NEU, laufe(NEU, 'a-sonderfaelle', ['f8-1-ausschluss']));
		const anwesend = regel({ geschaeftsart: ak.geschaeftsart!, knotenId: ak.knotenId, kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } });
		expect(einordnungGegenGesetz(anwesend, ak)).toBe('milder');
		expect(einordnungGegenGesetz(regel({ kopfbasis: 'alle_ausser_betroffene' }), einsprache())).toBe('strenger');
		// Gegenrichtung: am gewöhnlichen Knoten ist «alle ausser den Betroffenen» nicht vergleichbar.
		const g = gewoehnlich();
		expect(einordnungGegenGesetz(regel({ kopfbasis: 'alle_ausser_betroffene', geschaeftsart: g.geschaeftsart!, knotenId: g.knotenId }), g)).toBe('gemischt');
	});

	it('N2: Zahlenbeispiel von Gesetz und Regel mit demselben Wortlaut', () => {
		const gesetz = zahlenbeispiel(knoten, zahlen)!;
		const regelsatz = zahlenbeispielFuerRegel(regel({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' } }), zahlen, einsprache())!;
		expect(gesetz).toBe(regelsatz);
		expect(regelsatz).toMatch(/ohne den Eigentümer, der verkauft, vermietet oder belastet, wenn alle übrigen erschienen oder vertreten sind/);
		// Gegenrichtung: die Ausschlussklage behält ihren Satz.
		expect(zahlenbeispielFuerRegel(regel({}), zahlen, { knotenId: 'k-ausschlussklage' })).toMatch(/ohne den Beklagten, wenn alle erschienen/);
	});

	it('Rechtssatz, Begründung, Beispiel und Hilfe der Antwort aus der Prüfung', () => {
		expect(knoten.reglementsrecht).toBe(
			'Ein strengeres Mehr gilt nur, wenn es mit dem Einspracherecht oder später von allen Eigentümern ' +
				'schriftlich vereinbart wurde. Ein milderes gilt nie (Wermelinger, SVIT-Kommentar 2023, ' +
				'Art. 712c Rz. 183, 186; Art. 712g Rz. 83).'
		);
		expect(knoten.begruendung).not.toMatch(/Gezählt wird wie/);
		expect(knoten.begruendung).toMatch(/mit Nutzniessung oder Wohnrecht belastet, stimmt nicht mit/);
		expect(knoten.beispiele).toEqual([
			'Einsprache gegen die Vermietung einer Wohnung an einen Betrieb, der sie tageweise an wechselnde Gäste weitervermietet'
		]);
		const hilfe = NEU.fragen.find((f) => f.id === 'f8-1')!.antworten.find((a) => a.id === 'f8-1-einsprache')!.hilfe!;
		expect(hilfe).toMatch(/alle damaligen Eigentümer es schriftlich vereinbart haben\. Das steht etwa im Begründungsakt beim Grundbuchamt oder in einem von allen unterschriebenen Reglement; ein mit Mehrheit beschlossenes Reglement genügt nicht/);
		expect(hilfe).toMatch(/Gegen Käufer, Mieter oder Berechtigte wirkt es nur, wenn es im Grundbuch vorgemerkt ist \(Grundbuchauszug\)\. Sonst bleibt der Vertrag gültig; erheben Sie die Einsprache trotzdem fristgerecht\. Hält sich der Eigentümer nicht daran, bleibt Schadenersatz\. Bei Miete, Nutzniessung oder Wohnrecht bleibt unter strengen Voraussetzungen auch das Ausschlussverfahren \(Rz\. 180 bis 182, 195 ad Art\. 712c\)/);
		const kasten = ergebniskarte(NEU, knoten).reglementsvorbehalt;
		expect(kasten).toBe(
			`${knoten.reglementsrecht} Dieses Werkzeug wendet eine Regel hier nur an, wenn sie für genau ` +
				'diesen Fall hinterlegt ist und in keiner Hinsicht milder ist als das Gesetz. Hinterlegen Sie nur ' +
				'ein Mehr, das so zustande kam. Kann es eine Bestimmung nicht einordnen, zählt es nach dem ' +
				'Gesetz; ob Ihre Bestimmung trotzdem gilt, klärt das nicht.'
		);
	});
});

describe('Einsprache 712c: Zählweise je Einheit (Entscheid 19.10.2026)', () => {
	const satz =
		'Ihre Gemeinschaft zählt je Einheit; ob das bei der Einsprache gilt, ist nicht geklärt. Votum zählt je ' +
		'Einheit. Zählen Sie im Saal auch nach Köpfen und halten Sie beide Ergebnisse im Protokoll fest. Gehen ' +
		'sie auseinander, ist der Ausgang in beide Richtungen offen. Eine Einsprache, die nur je Einheit ' +
		'durchkommt, kann vor Gericht scheitern, eine, die nur nach Köpfen durchkommt, kann gelten. Auseinandergehen ' +
		'können sie nur, wenn jemand an mehr als einer Einheit beteiligt ist. Klären Sie dann schon vor der ' +
		'Versammlung mit einer Fachperson, ob Sie eine solche Einsprache überbringen.';
	const zahlen = (zaehlweise: 'per_owner' | 'per_unit') => ({ kopfstimmen: 10, gesamtquote: 1000, zaehlweise });
	const verwaltung = NEU.knoten.find((k) => k.id === 'k-verwaltung-gewoehnlich')!;

	it('nennt die Karte den Hinweis nur an der Einsprache und nur je Einheit', () => {
		expect(zaehlweiseBeiEinsprache(EINSPRACHE_KNOTEN, 'per_unit')).toBe(satz);
		expect(ergebniskarte(NEU, knoten, zahlen('per_unit')).hinweise).toContain(satz);
		// Gegenrichtung: je Eigentümer kein Hinweis, und an einem anderen Knoten auch je Einheit keiner.
		expect(ergebniskarte(NEU, knoten, zahlen('per_owner')).hinweise).not.toContain(satz);
		expect(ergebniskarte(NEU, verwaltung, zahlen('per_unit')).hinweise).not.toContain(satz);
		expect(zaehlweiseBeiEinsprache('k-verwaltung-gewoehnlich', 'per_unit')).toBeNull();
		// Unter einer angewandten Regel bleibt er stehen.
		const a = wendeReglementAn(einsprache(), [regel({})], null, LESARTEN_VORGABE);
		const k = karteMitReglement(ergebniskarte(NEU, knoten, zahlen('per_unit')), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(k.hinweise).toContain(satz);
	});

	it('nennt die Leitung ihn bei den Warnungen am Erfordernis, mit derselben Gegenrichtung', () => {
		expect(mehrhinweise(einsprache(), knoten, 'erste', true, false, 'per_unit')).toContain(satz);
		expect(mehrhinweise(einsprache(), knoten, 'erste', true, false, 'per_owner')).not.toContain(satz);
		expect(mehrhinweise(gewoehnlich(), verwaltung, 'erste', true, false, 'per_unit')).not.toContain(satz);
	});
});

describe('Einsprache 712c: 4. Die Karte', () => {
	it('4. nennt Fundstellen, Frist mit Einladungsfrage und wichtigen Grund', () => {
		const k = ergebniskarte(NEU, knoten);
		const alles = [k.begruendung, k.reglementsvorbehalt, ...k.hinweise].join(' ');
		for (const rz of ['Rz. 185', 'Rz. 183, 186', 'Rz. 187', 'Rz. 190', 'Rz. 191', 'Rz. 192', 'Rz. 38 ad Art. 712p']) expect(alles).toContain(rz);
		expect(alles).toMatch(/innert 14 Tagen beim Eigentümer eingehen, der verkauft, vermietet oder belastet; der Beschluss allein genügt nicht/);
		expect(alles).toMatch(/Die Frist beginnt, sobald Ihnen der abgeschlossene Vertrag mitgeteilt wird, auch von der Gegenpartei \(etwa Käufer, Mieter oder Nutzniesser\) und auch wenn die Mitteilung nur bei der Verwaltung eingeht \(Art\. 712t Abs\. 3; Rz\. 190, 41 ad Art\. 712c\)\. Sie lässt sich weder verlängern noch unterbrechen \(Rz\. 190 ad Art\. 712c\)/);
		expect(alles).toMatch(/Legen Sie im Beschluss fest, wer die Einsprache überbringt/);
		// Hinweis 2 nach Runde 6 (gekürzt, ganz ersetzt).
		expect(k.hinweise[1]).toBe(
			'Massgebend ist die Einladungsfrist Ihres Reglements, ohne eine solche eine den Umständen ' +
				'angemessene Frist (Rz. 25 f. ad Art. 712n). Reicht sie nicht für Beschluss und Zustellung in ' +
				'14 Tagen (Rz. 29 ad Art. 712n), bleibt nach dem SVIT-Kommentar eine Universalversammlung ' +
				'(Rz. 191 ad Art. 712c). Nach einer abweichenden Meinung gehen die 14 Tage einer längeren ' +
				'Einladungsfrist vor. Ist die Versammlung nicht beschlussfähig, käme eine zweite zu spät ' +
				'(Rz. 38 ad Art. 712p). Klären Sie das Vorgehen deshalb mit einer Fachperson, sobald Sie ' +
				'hören, dass jemand verkaufen, vermieten oder belasten will, nicht erst nach dem Vertrag.'
		);
		expect(alles).toMatch(/auf Klage des Eigentümers, der verkauft, vermietet oder belastet, das Gericht/);
		expect(alles).toMatch(/weder verlängern noch unterbrechen/);
		expect(alles).toMatch(/Universalversammlung/);
		expect(alles).toMatch(/Nennen Sie ihn im Antrag und in der Einsprache, mit den Folgen für das Haus/);
		expect(k.hinweise).toHaveLength(4);
		expect(alles).toMatch(/wichtigen Grund/);
		expect(alles).toMatch(/Art\. 712c Abs\. 3/);
		expect(k.hinweise).toContain(EINSPRACHE_BETROFFENE_ANWENDUNG);
		expect(k.reglementsvorbehalt).toContain(knoten.reglementsrecht!);
		expect(k.reglementsvorbehalt).toMatch(/nur an, wenn sie für genau diesen Fall hinterlegt ist/);
	});

	it('4. Gegenrichtung: die Karte zum Einführen des Rechts trägt diese Hinweise nicht', () => {
		const vorkauf = ergebniskarte(NEU, NEU.knoten.find((k) => k.id === 'k-vorkaufsrecht')!);
		expect([...vorkauf.hinweise, vorkauf.begruendung].join(' ')).not.toMatch(/14 Tagen|wichtigen Grund/);
	});
});

describe('Einsprache 712c: 5. Fassungsprobe', () => {
	it('5. ändert an der Vorfassung nur f8-1 und die Beschreibung des Asts und fügt den Knoten an', () => {
		// Die Fassung selbst, nicht «die aktuelle»: Seit 2026-10-21 folgt eine weitere.
		expect(NEU.fassung).toBe('2026-10-20');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
		for (const a of VOR.aeste) {
			const n = NEU.aeste.find((x) => x.id === a.id)!;
			if (a.id === 'a-sonderfaelle') {
				expect({ ...n, beschreibung: a.beschreibung }).toEqual(a);
				expect(n.beschreibung).toBe(SONDERFAELLE_BESCHREIBUNG);
				expect(n.beschreibung).toMatch(/Einsprache/);
				expect(a.beschreibung).not.toMatch(/Einsprache/);
			} else {
				expect(n).toEqual(a);
			}
		}
		expect(NEU.aeste.length).toBe(VOR.aeste.length);
		expect(NEU.knoten.slice(0, -1)).toEqual(VOR.knoten);
		expect(NEU.knoten.at(-1)).toBe(EINSPRACHE);
		for (const f of VOR.fragen) {
			const n = NEU.fragen.find((x) => x.id === f.id)!;
			if (f.id === 'f8-1') {
				expect(n.antworten.filter((a) => a.id !== 'f8-1-einsprache')).toEqual(f.antworten);
				expect(n.antworten.length).toBe(f.antworten.length + 1);
			} else {
				expect(n).toEqual(f);
			}
		}
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
	});

	it('5. ältere Fassungen kennen weder Antwort noch Knoten', () => {
		for (const rw of alleFassungen().filter((r) => r.fassung < '2026-10-20')) {
			expect(rw.knoten.some((k) => k.id === EINSPRACHE_KNOTEN), rw.fassung).toBe(false);
			expect(() => laufe(rw, 'a-sonderfaelle', ['f8-1-einsprache']), rw.fassung).toThrow(/gehört nicht zur Frage/);
		}
	});

	it('5. die Karten der übrigen Knoten bleiben, wie sie waren', () => {
		for (const k of VOR.knoten) {
			const vor = ergebniskarte(VOR, k);
			const neu = ergebniskarte(NEU, NEU.knoten.find((x) => x.id === k.id)!);
			expect({ ...neu, freigabevermerk: '' }, k.id).toEqual({ ...vor, freigabevermerk: '' });
		}
		// Und gegen den Aufruf von vorher gemessen, in jeder Fassung: Nur die
		// Einsprache bekommt den Satz ohne die Betroffenen.
		for (const rw of alleFassungen()) {
			for (const k of rw.knoten.filter((x) => x.id !== EINSPRACHE_KNOTEN)) {
				const satz = ergebniskarte(rw, k).bezugsgroessensatz;
				if (satz === null) continue;
				expect(satz, `${rw.fassung} ${k.id}`).toBe(bezugsgroessensatz(k.kopfbasis, false, k.id === 'k-ausschlussklage'));
			}
		}
	});

	it('5. nur_mildern und einordnen an bestehenden Knoten verhalten sich wie bisher', () => {
		const ausweg = erfordernisAus(NEU, laufe(NEU, 'a-bauen', pfadZu(NEU, 'k-baulich-luxurioes-ausweg')));
		expect(ausweg.reglementsverhalten).toBe('nur_mildern');
		const r = (u: Partial<Reglementsregel>) =>
			regel({ geschaeftsart: ausweg.geschaeftsart!, knotenId: ausweg.knotenId, ...u });
		// Strenger: nicht angewandt; milder: angewandt (Spiegelbild der Einsprache).
		expect(wendeReglementAn(ausweg, [r({ kopfSchwelle: { zaehler: 9, nenner: 10, art: 'mindestens' } })], null, LESARTEN_VORGABE).vorbehalt).toBe('verschaerfung');
		const milder = wendeReglementAn(ausweg, [r({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }, quotenbasis: 'keine', quotenSchwelle: null })], null, LESARTEN_VORGABE);
		expect(milder.vorbehalt).toBeNull();
		expect(milder.erfordernis.quelle).toBe('reglement');

		const normal = erfordernisAus(NEU, laufe(NEU, 'a-reglement', ['f3-1-reglement']));
		expect(normal.reglementsverhalten).toBe('einordnen');
		const rn = (u: Partial<Reglementsregel>) => regel({ geschaeftsart: 'reglement', knotenId: null, ...u });
		expect(wendeReglementAn(normal, [rn({ kopfbasis: 'alle_eigentuemer', kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' } })], null, LESARTEN_VORGABE).vorbehalt).toBe('gemischt');
		expect(
			wendeReglementAn(normal, [rn({ kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' }, quotenbasis: 'alle_quoten', quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } })], null, LESARTEN_VORGABE).vorbehalt
		).toBeNull();
		// Eine allgemeine Regel einer anderen Art trifft an diesen Knoten kein `nur_fallgenau`.
		expect(regelNurFallgenau(NEU.knoten.find((k) => k.id === 'k-baulich-luxurioes-ausweg')!)).toBe(false);
		expect(regelNurFallgenau(NEU.knoten.find((k) => k.id === 'k-reglement-normal')!)).toBe(false);
	});
});

/** Die Antwortfolge von einem Ast zu einem Knoten, über eine Breitensuche. */
function pfadZu(rw: typeof NEU, ziel: string): string[] {
	const ast = rw.aeste.find((a) => a.id === 'a-bauen')!;
	const offen: { id: string; pfad: string[] }[] = [{ id: ast.einstieg, pfad: [] }];
	while (offen.length > 0) {
		const { id, pfad } = offen.shift()!;
		if (id === ziel) return pfad;
		const f = rw.fragen.find((x) => x.id === id);
		if (f) for (const a of f.antworten) offen.push({ id: a.ziel, pfad: [...pfad, a.id] });
	}
	throw new Error(`Kein Weg zu ${ziel}`);
}

describe('Einsprache 712c: 6. Website-Export', () => {
	const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
	const quelle = readFileSync(join(wurzel, 'scripts/quorumsbaum-export.mjs'), 'utf-8');

	it('6. führt einen Kurztext, an den Rechtssatz gebunden und ohne Werkzeugsatz', () => {
		const eintrag = quelle.match(/'k-einsprache',\s*\{\s*zu: '([0-9a-f]{12})',\s*text:\s*([\s\S]*?)\n\t\t\}/);
		expect(eintrag, 'Kein Eintrag für k-einsprache in REGLEMENT_WEBSITE').not.toBeNull();
		const summe = createHash('sha256').update(knoten.reglementsrecht!).digest('hex').slice(0, 12);
		expect(eintrag![1]).toBe(summe);
		expect(eintrag![2]).not.toMatch(/Werkzeug/);
		expect(quelle).toMatch(/case 'nur_verschaerfen':/);
	});

	it('6. ersetzt den Werkzeugsatz der Betroffenen auf der Website, und nur ihn', () => {
		expect(quelle).toMatch(/\[EINSPRACHE_BETROFFENE_ANWENDUNG, EINSPRACHE_BETROFFENE_WEBSITE\]/);
		expect(EINSPRACHE_BETROFFENE_ANWENDUNG).toMatch(/Votum zählt sie hier nicht/);
		expect(EINSPRACHE_BETROFFENE_ANWENDUNG).toMatch(/Raten Sie den übrigen Eigentümern, etwa im Begleitschreiben zur Einladung, ihm keine zu geben/);
		expect(EINSPRACHE_BETROFFENE_WEBSITE).not.toMatch(/Werkzeug|Votum|Sitzungsleitung/);
		// Keine Streitfrage: Das Mehr selbst ist nicht umstritten.
		const block = quelle.match(/const STREITFRAGEN = new Set\(\[([\s\S]*?)\]\)/)![1];
		expect(block).not.toContain("'k-einsprache'");
		expect(knoten.gegenmeinung).toBeUndefined();
	});
});
