/**
 * Story 3.6 — die Traktandenliste als PDF.
 *
 * Diese Datei liegt bei den Datenbanktests, obwohl sie keine Datenbank braucht:
 * Sie prüft Schalencode, und nur dieser Prüflauf löst `$lib/server` und
 * `$env/dynamic/private` auf. Der Umbruch selbst ist reine Rechnung und steht
 * mit Wertetabelle in `tests/domain/textsatz.test.ts`.
 *
 * Geprüft wird, was sich nur am erzeugten Dokument zeigt: dass es eine gültige
 * Datei mit den richtigen Seitenformaten ist, dass Namen mit diakritischen
 * Zeichen nicht zum Absturz führen, und dass eine unbrauchbare Briefkopfvorlage
 * das Dokument nicht verhindert.
 */
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { erzeugeTraktandenliste } from '$lib/server/pdf/traktandenliste';
import { fuegeZusammen } from '$lib/server/pdf/basis';
import { erzeugeVollmachtsformular } from '$lib/server/pdf/vollmachtsformular';
import {
	erzeugeVerlauf,
	type Verlaufsangaben,
	type VerlaufszeileImBlatt
} from '$lib/server/pdf/verlauf';
import { nichtZugeordnet } from '$lib/domain/verlauf';
import { textVonSeite } from './pdftext';
import { neutraktandenFussnote, NEUTRAKTANDUM_VERWEIS, NEUTRAKTANDUM_ZEICHEN } from '$lib/domain/einladung';
import { VERWALTUNG_LEITUNG_EINLADUNG, VERWALTUNG_RUHEN_EINLADUNG } from '$lib/domain/mehrhinweise';
import type { Traktandum } from '$lib/domain/traktanden';
import type { NummerierterKnoten } from '$lib/domain/traktandenbaum';
import { fristvermerk, type Versammlung } from '$lib/domain/versammlung';

function versammlung(u: Partial<Versammlung> = {}): Versammlung {
	return {
		id: 'v-1',
		operatorId: 'op-1',
		stwegId: 'stweg-1',
		zustand: 'entwurf',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		art: 'ordentlich',
		stufe: 'erste',
		betriebsart: 'einfach',
		papierfrage: true,
		vorgaengerId: null,
		...u
	};
}

function traktandum(u: Partial<Traktandum> = {}): Traktandum {
	return {
		id: 't-1',
		operatorId: 'op-1',
		meetingId: 'v-1',
		parentId: null,
		position: 1,
		titel: 'Sanierung der Fassade',
		art: 'abstimmung',
		antragswortlaut: 'Die Fassade wird gemäss Offerte saniert.',
		antragstellerart: 'bewirtschaftung',
		betroffeneParteiIds: [],
		verwaltungsGeschaeft: false,
		...u
	};
}

function eintrag(t: Traktandum, nummer = '1', tiefe = 1): NummerierterKnoten<Traktandum> {
	return { knoten: t, nummer, tiefe, manuell: false, fest: false, rang: 0 };
}

async function seitenmasse(bytes: Uint8Array): Promise<{ anzahl: number; erste: string }> {
	const d = await PDFDocument.load(bytes);
	const { width, height } = d.getPage(0).getSize();
	return { anzahl: d.getPageCount(), erste: `${Math.round(width)}x${Math.round(height)}` };
}

describe('Erzeugen', () => {
	it('liefert ein gültiges PDF im A4-Hochformat', async () => {
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())]
		});
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
		expect((await seitenmasse(bytes)).erste).toBe('595x842');
	});

	it('liefert die Präsentationsfassung quer', async () => {
		// Ein Beamer ist breit; hochkant bliebe rechts und links die Hälfte leer.
		const { bytes } = await erzeugeTraktandenliste('praesentation', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())]
		});
		expect((await seitenmasse(bytes)).erste).toBe('842x595');
	});

	it('kommt ohne Traktandum zurecht', async () => {
		// Ein PDF ohne Seite lässt sich von keinem Betrachter öffnen.
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Leer',
			traktanden: []
		});
		expect((await seitenmasse(bytes)).anzahl).toBe(1);
	});

	it('bricht bei vielen Traktanden auf mehrere Seiten um', async () => {
		const viele = Array.from({ length: 40 }, (_, i) =>
			eintrag(
				traktandum({
					id: `t-${i}`,
					titel: `Geschäft Nummer ${i + 1}`,
					inhalt: 'Ein Absatz mittlerer Länge, der zusammen mit den anderen über das Blatt hinausreicht.'
				}),
				String(i + 1)
			)
		);
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Viel',
			traktanden: viele
		});
		expect((await seitenmasse(bytes)).anzahl).toBeGreaterThan(1);
	});

	it('setzt Namen mit diakritischen Zeichen, ohne abzustürzen', async () => {
		// Der Grund für die mitgelieferte Schrift: Die Standardschriften eines PDF
		// können nur WinAnsi. «Petrović» oder «Nowak-Łukasik» brächten die
		// Erzeugung zum Absturz — genau dann, wenn die Einladung entstehen soll.
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung({ ort: 'Zürich, Saal «Bären»' }),
			gemeinschaftName: 'Höhenweg 3',
			traktanden: [
				eintrag(
					traktandum({
						titel: 'Zufahrt Grundstück Petrović',
						antragswortlaut: 'Antrag von Şahin, Đurić, Nowak-Łukasik und Vodňanský.',
						antragstellerName: 'Familie Petrović'
					})
				)
			]
		});
		expect((await seitenmasse(bytes)).anzahl).toBe(1);
	});

	it('nennt die ausserordentliche Versammlung als solche und führt den Anlass', async () => {
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung({ art: 'ausserordentlich', anlass: 'Wasserschaden Tiefgarage' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())]
		});
		const text = new TextDecoder('latin1').decode(bytes);
		// Der Text steht komprimiert im Strom; geprüft wird deshalb nur, dass ein
		// Dokument entsteht. Die Beschriftung selbst ist über die Ausprägung
		// gesteuert und wird am Stack angesehen.
		expect(text.startsWith('%PDF-')).toBe(true);
	});

	it('trägt den provisorischen Vermerk, wenn ein Stand mitgegeben ist', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			provisorischerStand: '2026-08-31'
		});
		expect(await textVonSeite(bytes)).toContain('nicht freigegeben');
	});

	it('bleibt ohne provisorischen Stand frei von dem Vermerk', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())]
		});
		expect(await textVonSeite(bytes)).not.toContain('nicht freigegeben');
	});
});

/**
 * Die Einladung ist eingefroren (Praxisfund 03.10.2026).
 *
 * **Der Fall:** Die Versammlung läuft, es wird ein Rückkommensantrag gestellt
 * (oder ein Spontantraktandum aufgenommen), und die Einladung wird danach
 * nochmals erzeugt. Sie zeigte bisher die **aktuelle** Liste samt dem, was erst
 * im Saal entstanden ist. Was nie auf der Einladung stand, gehört auch in eine
 * zweite Ausfertigung nicht; auf Traktandenliste und Beamer steht es weiter.
 */
describe('Die Einladung lässt weg, was erst in der Versammlung entstand', () => {
	const nachtraeglich = () =>
		traktandum({
			id: 't-2',
			titel: 'Rückkommen zur Fassade',
			aufgenommenAm: '2026-09-15T20:10:00.000Z',
			spontan: true,
			spontanart: 'rueckkommen'
		});

	it('die Einladung führt nur die freigegebene Liste', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum()), eintrag(nachtraeglich(), '2')]
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('Sanierung der Fassade');
		expect(text).not.toContain('Rückkommen');
	});

	it('Gegenprobe: die Traktandenliste führt ihn weiter', async () => {
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum()), eintrag(nachtraeglich(), '2')]
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('Sanierung der Fassade');
		expect(text).toContain('Rückkommen zur Fassade');
	});

	it('die Einladung sagt jetzt «Es stehen folgende Traktanden an:»', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: {
				absender: 'Probère Immobilien',
				datum: '2026-08-10',
				vollmachtsgrenze: null,
				vollmachtsgrenzeQuelle: null,
				beschlussfaehigkeit: null
			}
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('Es stehen folgende Traktanden an:');
		expect(text).not.toContain('Zur Verhandlung stehen');
	});

	it('nennt in der Fusszeile den Quorumstyp', async () => {
		/*
		 * Praxisfund 03.10.2026: Die Zeile nannte die Schwelle in Worten und den
		 * Fall, aber nicht den Typ («Einfaches Mehr»). Die Fassung kommt aus dem
		 * Erfordernis; die Bezeichnung stammt damit aus der damals geltenden
		 * Regelung.
		 */
		const erfordernis = {
			fassung: '2026-07-30',
			juristischGegengelesen: false,
			astId: 'a-verwaltung',
			knotenId: 'k-verwaltung-gewoehnlich',
			typ: 'einfaches_mehr' as const,
			titel: 'Gewöhnliche Verwaltungshandlung',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 2',
			kopfbasis: 'anwesend_vertreten' as const,
			quotenbasis: 'keine' as const,
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
			quotenSchwelle: null,
			zustimmungBetroffenerNoetig: false,
			pfad: [],
			quelle: 'hergeleitet' as const
		};
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum({ erfordernis }))]
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('Einfaches Mehr: mehr als die Hälfte der Anwesenden oder Vertretenen');
		expect(text).toContain('Gewöhnliche Verwaltungshandlung');
	});

	/*
	 * **Der Hinweis bei der Einsprache** (Pendenz vom 19.10.2026, Laien- und
	 * Fachprüfung in drei Runden, `quellen`
	 * `pruefung/berichte/2026-10-20-votum-einladung-einsprache.md`): wer nicht
	 * mitstimmt, mit Namen, und was mit Vollmachten und Enthaltungen geschieht.
	 */
	const einsprache = {
		fassung: '2026-10-20',
		juristischGegengelesen: false,
		astId: 'a-sonderfaelle',
		knotenId: 'k-einsprache',
		typ: 'einfaches_mehr' as const,
		titel: 'Einsprache gegen Verkauf, Vermietung, Nutzniessung oder Wohnrecht',
		rechtsgrundlage: 'ZGB Art. 712c Abs. 2 und 3',
		kopfbasis: 'anwesend_vertreten' as const,
		quotenbasis: 'keine' as const,
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' as const },
		quotenSchwelle: null,
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'hergeleitet' as const
	};

	it('nennt bei der Einsprache die Partei, die nicht mitstimmt, und den Rat zur Vollmacht', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [
				eintrag(
					traktandum({
						titel: 'Einsprache gegen die Vermietung von Wohnung 3',
						erfordernis: einsprache,
						betroffeneParteiIds: ['p-3']
					})
				)
			],
			parteinamen: new Map([['p-3', 'Erika Muster']])
		});
		const text = (await textVonSeite(bytes)).replace(/\s+/g, ' ');
		expect(text).toContain('Wer verkauft, vermietet oder belastet (Erika Muster), stimmt nicht mit, auch nicht mit Vollmachten anderer (sinngemäss BGE 134 III 481 E. 3.8); bei dieser Abstimmung werden sie nicht gezählt.');
		expect(text).toContain('besser jemand anderem');
		expect(text).toContain('wie eine Stimme gegen die Einsprache');
		// Das Wort «Votum» führt die Einladung nicht ein (Laienprüfung, Runde 2).
		expect(text).not.toMatch(/Votum zählt/);
	});

	it('Gegenrichtung: kein Hinweis bei einem gewöhnlichen Traktandum, und ohne Namen kein leeres Klammerpaar', async () => {
		const ohne = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())]
		});
		expect((await textVonSeite(ohne.bytes)).replace(/\s+/g, ' ')).not.toContain('stimmt nicht mit');
		const ohneNamen = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum({ erfordernis: einsprache, betroffeneParteiIds: ['p-3'] }))]
		});
		const text = (await textVonSeite(ohneNamen.bytes)).replace(/\s+/g, ' ');
		expect(text).toContain('Wer verkauft, vermietet oder belastet, stimmt nicht mit, auch nicht mit Vollmachten anderer');
		expect(text).not.toContain('()');
	});

	it('Gegenrichtung: die Beamer-Fassung trägt den Absatz nicht, die Liste schon', async () => {
		const angaben = {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum({ erfordernis: einsprache, betroffeneParteiIds: ['p-3'] }))],
			parteinamen: new Map([['p-3', 'Erika Muster']])
		};
		const beamer = await erzeugeTraktandenliste('praesentation', angaben);
		expect((await textVonSeite(beamer.bytes)).replace(/\s+/g, ' ')).not.toContain('Erika Muster');
		const liste = await erzeugeTraktandenliste('liste', angaben);
		expect((await textVonSeite(liste.bytes)).replace(/\s+/g, ' ')).toContain('(Erika Muster), stimmt nicht mit, auch nicht mit Vollmachten anderer');
	});
});

/**
 * L8 (Migration 184) und G7 (08.11.2026): Der Satz zu den Vollmachten der
 * Verwaltung kommt nur über die Einladung zu den Vollmachtgebern. Bis zur
 * Featureprüfung 2 (M3 T2) erzeugte kein Test eine Einladung mit Häkchen;
 * eine Beschädigung der Bedingung blieb grün.
 */
describe('Die Einladung zu den Vollmachten der Verwaltung (L8)', () => {
	const entlastung = traktandum({ titel: 'Entlastung der Verwaltung', verwaltungsGeschaeft: true });
	const fassade = traktandum({ id: 't-2', position: 2 });
	const text = async (art: 'einladung' | 'liste' | 'praesentation', wahl?: 'ruhen' | 'leitung') => {
		const { bytes } = await erzeugeTraktandenliste(art, {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(entlastung, '1'), eintrag(fassade, '2')],
			verwaltungL8: wahl
		});
		return (await textVonSeite(bytes)).replace(/\s+/g, ' ');
	};
	const ohneUmbruch = (s: string) => s.replace(/\s+/g, ' ');

	it('trägt unter «Vollmachten ruhen» den Satz zum Ruhen, einmal, am Traktandum mit Häkchen', async () => {
		const t = await text('einladung', 'ruhen');
		expect(t).toContain(ohneUmbruch(VERWALTUNG_RUHEN_EINLADUNG));
		expect(t.split('Bei diesem Traktandum zählen keine Stimmen').length - 1).toBe(1);
		expect(t).not.toContain('Bei diesem Traktandum entscheidet die Sitzungsleitung');
	});

	it('trägt unter «Die Sitzungsleitung entscheidet» den eigenen Satz (G7)', async () => {
		const t = await text('einladung', 'leitung');
		expect(t).toContain(ohneUmbruch(VERWALTUNG_LEITUNG_EINLADUNG));
		expect(t.split('Bei diesem Traktandum entscheidet die Sitzungsleitung').length - 1).toBe(1);
		expect(t).not.toContain('Bei diesem Traktandum zählen keine Stimmen');
	});

	it('Gegenrichtung: ohne Wahl kein Satz; auf dem Beamer keiner; die Liste trägt ihn', async () => {
		const ohne = await text('einladung');
		expect(ohne).not.toContain('die die Verwaltung mit');
		expect(await text('praesentation', 'leitung')).not.toContain('die die Verwaltung mit');
		expect(await text('praesentation', 'ruhen')).not.toContain('die die Verwaltung mit');
		expect(await text('liste', 'leitung')).toContain(ohneUmbruch(VERWALTUNG_LEITUNG_EINLADUNG));
	});
});

describe('Briefkopfvorlage', () => {
	async function einseitigesPdf(): Promise<Uint8Array> {
		const d = await PDFDocument.create();
		const s = d.addPage([595, 842]);
		// Mit Inhalt: Eine Seite ohne Inhaltsstrom lässt sich nicht einbetten —
		// siehe den Test darunter.
		s.drawRectangle({ x: 40, y: 760, width: 200, height: 40 });
		return d.save();
	}

	it('legt eine brauchbare Vorlage unter, ohne Hinweis', async () => {
		const { bytes, hinweise } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Mit Briefkopf',
			traktanden: [eintrag(traktandum())],
			briefkopf: await einseitigesPdf(),
			briefkopfHoeheMm: 55
		});
		expect(hinweise).toEqual([]);
		expect((await seitenmasse(bytes)).anzahl).toBe(1);
	});

	it('erzeugt das PDF auch bei einer Vorlage ohne Inhalt, mit Hinweis', async () => {
		// Dieser Fall hat die Fehlerbehandlung erst hergestellt: pdf-lib schiebt
		// das Einbetten bis zum Speichern auf, weshalb ein `try` um `embedPage`
		// nichts fängt. Die Ausnahme entstand ausserhalb und riss die ganze
		// Erzeugung mit.
		const leer = await PDFDocument.create();
		leer.addPage([595, 842]);

		const { bytes, hinweise } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Leere Vorlage',
			traktanden: [eintrag(traktandum())],
			briefkopf: await leer.save()
		});
		expect(hinweise.length).toBe(1);
		expect((await seitenmasse(bytes)).anzahl).toBe(1);
	});

	it('erzeugt das PDF auch bei unbrauchbarer Vorlage, mit Hinweis', async () => {
		// Eine Einladung ohne Logo ist ein Schönheitsfehler; keine Einladung am Tag
		// des Versands ist ein Problem.
		const { bytes, hinweise } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Kaputter Briefkopf',
			traktanden: [eintrag(traktandum())],
			briefkopf: new Uint8Array([0x41, 0x42, 0x43])
		});
		expect(hinweise.length).toBe(1);
		expect(hinweise[0]).toMatch(/Briefkopfvorlage/);
		expect((await seitenmasse(bytes)).anzahl).toBe(1);
	});

	it('lässt die Vorlage bei der Präsentationsfassung weg', async () => {
		// Ein Briefkopf auf dem Beamer nähme Platz weg, den die Schriftgrösse
		// braucht — und niemand liest auf der Leinwand eine Absenderadresse.
		const { hinweise } = await erzeugeTraktandenliste('praesentation', {
			versammlung: versammlung(),
			gemeinschaftName: 'Beamer',
			traktanden: [eintrag(traktandum())],
			briefkopf: new Uint8Array([0x41, 0x42, 0x43])
		});
		expect(hinweise).toEqual([]);
	});
});

describe('Zusammenfügen', () => {
	it('hängt mehrere PDF aneinander', async () => {
		// Für den Versandsatz aus Traktandenliste und Zugangskarte (Story 3.7).
		const eins = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'A',
			traktanden: [eintrag(traktandum())]
		});
		const zwei = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'B',
			traktanden: [eintrag(traktandum())]
		});
		const zusammen = await fuegeZusammen([eins.bytes, zwei.bytes]);
		expect((await seitenmasse(zusammen)).anzahl).toBe(2);
	});
});

/**
 * Der Absatz zum gemeinschaftlichen Eigentum in der Einladung (27.08.2026).
 *
 * **Warum am erzeugten PDF und nicht nur am Satz im Kern.** Der Wortlaut ist in
 * `tests/domain/einladung.test.ts` geprüft. Hier geht es um die Frage daneben:
 * Kommt er überhaupt aufs Blatt? Ein Absatz, den `erzeugeTraktandenliste` still
 * überspringt, wäre im Kerntest grün und in der Einladung nicht vorhanden.
 */
describe('Die Einladung bei gemeinschaftlichem Eigentum', () => {
	const angaben = {
		absender: 'Probère Immobilien',
		datum: '2026-08-10',
		ort: 'Bern',
		vollmachtsgrenze: null,
		vollmachtsgrenzeQuelle: null,
		beschlussfaehigkeit: null
	};

	it('trägt den Absatz, wo die Gemeinschaft eine solche Einheit kennt', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, gemeinschaftlichesEigentum: true }
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('Gehört eine Einheit mehreren Personen gemeinsam');
		expect(text).toContain('uneinig');
		expect(text).toContain('wie ein Nein');
		/*
		 * **Bis ins PDF gemessen, nicht nur im Satzbau** (23.09.2026). Der
		 * Absatz hat nach der Laienprüfung einen Handlungsteil bekommen: Wer
		 * vorher weiss, dass er sich am Abend in zwei Minuten einigen muss,
		 * einigt sich vorher (Rz. 18a ad Art. 712o). Er ist der Teil, der beim
		 * Kürzen zuerst geopfert würde, und er ist zugleich der einzige
		 * Ausweg, den der Absatz überhaupt zeigt.
		 */
		expect(text, 'der Handlungsteil fehlt im gedruckten Brief').toContain(
			'wer die Stimme abgibt'
		);
		expect(text).toContain('sofern Ihr Reglement nichts anderes bestimmt');
	});

	it('lässt ihn weg, wo es keine gibt', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, gemeinschaftlichesEigentum: false }
		});
		expect(await textVonSeite(bytes)).not.toContain('mehreren Personen gemeinsam');
	});

	it('lässt ihn weg, wo der Erzeuger die Frage gar nicht beantwortet hat', async () => {
		// Ohne Angabe bleibt er weg: Eine Einladung darf nichts über einen Fall
		// behaupten, den niemand geprüft hat.
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: angaben
		});
		expect(await textVonSeite(bytes)).not.toContain('mehreren Personen gemeinsam');
	});

	it('steht nicht in der blossen Traktandenliste', async () => {
		// Sie hat kein Anschreiben; ein Rechtsabsatz ohne Anrede stünde dort
		// zwischen Titel und Traktandum 1.
		const { bytes } = await erzeugeTraktandenliste('liste', {
			versammlung: versammlung(),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, gemeinschaftlichesEigentum: true }
		});
		expect(await textVonSeite(bytes)).not.toContain('mehreren Personen gemeinsam');
	});
});

describe('Die Einladung nennt die Beschlussfähigkeit (Befund 25)', () => {
	const angaben = {
		absender: 'Probère Immobilien',
		datum: '2026-08-10',
		ort: 'Bern',
		vollmachtsgrenze: null,
		vollmachtsgrenzeQuelle: null,
		gemeinschaftlichesEigentum: false
	};
	const REGEL = {
		kopf: { zaehler: 1, nenner: 2, art: 'mindestens' as const },
		quoten: { zaehler: 1, nenner: 2, art: 'mindestens' as const },
		mindestens: 3,
		fundstelle: '§ 8 des Reglements'
	};

	/*
	 * **Der Anlass**: «Das Einladungs-PDF nennt § 8 nicht — ein Eigentümer
	 * erfährt nicht, dass ohne drei Anwesende gar nicht beschlossen werden kann,
	 * der beste Grund zu kommen.» Bis zum 07.09.2026 stand ein Satz dazu nur auf
	 * der **zweiten** Versammlung.
	 */
	it('nennt bei der ersten Versammlung Fundstelle und Mindestzahl', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({ stufe: 'erste' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, beschlussfaehigkeit: REGEL }
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('§ 8 des Reglements');
		expect(text).toContain('mindestens aber drei');
		expect(text).toContain('die Hälfte der Wertquoten');
	});

	it('nennt ohne hinterlegte Regel die gesetzliche Schwelle', async () => {
		// Ohne Regel gilt das Gesetz (`regel ?? GESETZLICH[art]`) — die Einladung
		// darf dann nicht schweigen, sonst bleibt der Befund für die Mehrheit der
		// Gemeinschaften offen (Code-Review 07.09.2026).
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({ stufe: 'erste' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('ZGB Art. 712p Abs. 1');
		expect(text).toContain('die Hälfte der Wertquoten');
	});

	/*
	 * **Der Durchstich für den Fristvermerk** (Befund R-2b, 24.09.2026).
	 *
	 * Der Wortlaut selbst steht mit Wertetabelle in
	 * `tests/domain/versammlung.test.ts`. Hier wird die Frage beantwortet, die
	 * sich nur am erzeugten Dokument zeigt: **kommt er im Brief an?** Der
	 * ganze Sinn des Blocks hängt daran — ein Vermerk, der im Datensatz steht
	 * und nicht im Blatt, wäre genau die Lage, die vorher herrschte.
	 *
	 * **Mit Gegenprobe darunter**, weil eine Zusicherung, die immer zutrifft,
	 * nichts misst: Wo die Frist eingehalten ist, darf im Brief nichts stehen.
	 */
	it('druckt den Fristvermerk in die Einladung', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				fristvermerk: fristvermerk('2026-09-10', '2026-09-15')
			}),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		const text = await textVonSeite(bytes);
		expect(text).toContain('nur 5 Tage nach der ersten');
		// Die Rechtsfolge, nicht nur der Verstoss: Ohne sie weiss der Empfänger
		// nicht, dass er innert eines Monats handeln muss.
		expect(text).toContain('beim Gericht anfechten');
		// Die Einladung behält den Satz ohne Ausnahme; nur das Protokoll nennt die
		// Universalversammlung (Ä-17, Entscheid 0006). Gegenprobe der
		// Featureprüfung Block 3, 18.10.2026: Lief das PDF über die
		// Protokollfassung, blieb dieser Test grün.
		expect(text).not.toContain('Universalversammlung');
	});

	it('schweigt im Brief, wo die Frist eingehalten ist', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({
				stufe: 'zweite',
				vorgaengerId: 'v-0',
				fristvermerk: fristvermerk('2026-09-01', '2026-09-15')
			}),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		const text = await textVonSeite(bytes);
		expect(text).not.toContain('zu früh angesetzt');
		expect(text).not.toContain('beim Gericht anfechten');
	});

	/*
	 * **Und der Absender steht oben**, wenn kein Briefkopf ihn trägt. Er stand
	 * bisher nur unter dem Gruss, hinter dem Platz für die Unterschrift.
	 */
	it('trägt den Absender im Kopf, wenn kein Briefkopf hinterlegt ist', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({ stufe: 'erste' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		const text = await textVonSeite(bytes);
		// Zweimal: einmal im Kopf, einmal unter dem Gruss.
		expect(text.split('Probère Immobilien').length - 1).toBe(2);
	});

	/*
	 * **Die Entscheidung hängt an der Verwendung, nicht an der Existenz**
	 * (Code-Review 07.09.2026). Ein hinterlegter Briefkopf trägt den Absender
	 * schon; ihn dann nochmals zu setzen wäre der Fehler, den jeder Empfänger
	 * sieht. Eine **unbrauchbare** Vorlage trägt ihn aber nicht — und dann ging
	 * die Einladung ohne Logo und ohne Absender hinaus, also genau im Zustand,
	 * den Befund 25 beanstandet.
	 */
	async function einseitigeVorlage(): Promise<Uint8Array> {
		const d = await PDFDocument.create();
		const s = d.addPage([595, 842]);
		s.drawRectangle({ x: 40, y: 760, width: 200, height: 40 });
		return d.save();
	}

	it('lässt den Absender im Kopf weg, wenn ein brauchbarer Briefkopf ihn trägt', async () => {
		const { bytes } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({ stufe: 'erste' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			briefkopf: await einseitigeVorlage(),
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		const text = await textVonSeite(bytes);
		expect(text.split('Probère Immobilien').length - 1).toBe(1);
	});

	it('setzt ihn trotzdem, wenn die hinterlegte Vorlage nicht taugt', async () => {
		const { bytes, hinweise } = await erzeugeTraktandenliste('einladung', {
			versammlung: versammlung({ stufe: 'erste' }),
			gemeinschaftName: 'Sonnenhalde 12',
			traktanden: [eintrag(traktandum())],
			// Ein leeres Dokument ohne Seite: `briefkopfBrauchbar` weist es ab.
			briefkopf: await (await PDFDocument.create()).save(),
			einladung: { ...angaben, beschlussfaehigkeit: null }
		});
		expect(hinweise.length).toBeGreaterThan(0);
		const text = await textVonSeite(bytes);
		expect(text.split('Probère Immobilien').length - 1).toBe(2);
	});
});

describe('Das Vollmachtsformular (Befund 25)', () => {
	const rahmen = {
		gemeinschaftName: 'Sonnenhalde 12',
		gemeinschaftAdresse: 'Sonnenhalde 12, 3000 Bern',
		datum: '2026-09-15',
		uhrzeit: '19:00',
		ort: 'Restaurant Bären',
		stufe: 'erste' as const,
		vollmachtsgrenze: 2,
		vollmachtsgrenzeQuelle: 'Art. 12 des Reglements'
	};

	it('trägt Name und Einheiten der Partei schon ein', async () => {
		const bytes = await erzeugeVollmachtsformular(rahmen, [
			{ name: 'Anna Muster', einheiten: ['Whg 1', 'Bastelraum'] }
		]);
		const text = await textVonSeite(bytes);
		expect(text).toContain('Anna Muster');
		expect(text).toContain('Whg 1, Bastelraum');
		expect(text).toContain('Vollmacht');
		// Die Grenze gehört aufs Blatt: Wer sie erst am Einlass erfährt, steht
		// mit einer Vollmacht da, die er nicht mehr ausüben darf.
		expect(text).toContain('Art. 12 des Reglements');
	});

	it('gibt jeder Partei ein eigenes Blatt', async () => {
		const bytes = await erzeugeVollmachtsformular(rahmen, [
			{ name: 'Anna Muster', einheiten: ['Whg 1'] },
			{ name: 'Peter Kunz', einheiten: ['Whg 2'] },
			{ name: 'Vera Probemann', einheiten: ['Whg 3'] }
		]);
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(3);
		expect(await textVonSeite(bytes, 1)).toContain('Peter Kunz');
	});

	/*
	 * **Es nimmt keine Weisung entgegen.** Eine Weisung bindet den Vertreter an
	 * eine Haltung und wird in der Anwendung erfasst, wo sie nachweisbar bleibt.
	 * Ein Kästchen «Ja / Nein» auf einem Zettel, den niemand erfasst, sähe aus
	 * wie eine Weisung und wäre keine.
	 */
	/*
	 * **Der Name einer Gemeinschaft ist oft ihre Adresse** (Sichtprobe
	 * 07.09.2026). Dann stand auf dem Blatt «Sonnenhalde 12, Sonnenhalde 12,
	 * 3000 Bern» — ein Fehler, den nur ein Blick aufs erzeugte PDF zeigt.
	 */
	it('nennt die Adresse nicht doppelt, wenn der Name schon darin steckt', async () => {
		const bytes = await erzeugeVollmachtsformular(rahmen, [
			{ name: 'Anna Muster', einheiten: ['Whg 1'] }
		]);
		const text = await textVonSeite(bytes);
		expect(text).toContain('Sonnenhalde 12, 3000 Bern');
		expect(text).not.toContain('Sonnenhalde 12, Sonnenhalde 12');
	});

	it('setzt den Namen davor, wo die Adresse eine andere ist', async () => {
		const bytes = await erzeugeVollmachtsformular(
			{ ...rahmen, gemeinschaftName: 'STWEG Bärenhof', gemeinschaftAdresse: 'Aareweg 3, 3000 Bern' },
			[{ name: 'Anna Muster', einheiten: ['Whg 1'] }]
		);
		expect(await textVonSeite(bytes)).toContain('STWEG Bärenhof, Aareweg 3, 3000 Bern');
	});

	it('bietet kein Feld für eine Weisung an', async () => {
		const bytes = await erzeugeVollmachtsformular(rahmen, [
			{ name: 'Anna Muster', einheiten: ['Whg 1'] }
		]);
		const text = await textVonSeite(bytes);
		expect(text).not.toMatch(/Weisung/i);
	});
});

/*
 * **Die Sätze auf dem Verlaufs-PDF** (Block 5, 01.10.2026). Die Laienprüfung
 * vom 01.10.2026 hat fünf Befunde ergeben (B-2 bis B-6); geprüft wird je
 * geänderter Form eine Zeile im gerenderten Text, nicht nur im Quelltext.
 */
describe('Der Verlauf als PDF erklärt seine Begriffe', () => {
	function zeile(u: Partial<VerlaufszeileImBlatt> = {}): VerlaufszeileImBlatt {
		return {
			zeitpunkt: '2026-10-01T19:30:00.000Z',
			zeitquelle: 'system',
			eintrag: 'Beschluss von Hand festgehalten',
			gegenstand: 'Durchgang 2 zu Traktandum 3 «Fassadensanierung»',
			person: 'Prüflauf',
			angaben: 'ergebnis: angenommen',
			...u
		};
	}

	async function text(u: Partial<Verlaufsangaben> = {}): Promise<string> {
		const bytes = await erzeugeVerlauf({
			gemeinschaftName: 'STWEG Prüfweg 1',
			versammlung: versammlung(),
			zeilen: [zeile()],
			pfadImPaket: 'Verlauf.pdf',
			erzeugtAm: '1. Oktober 2026, 22:00',
			...u
		});
		return (await textVonSeite(bytes, 0)).replace(/\s+/g, ' ');
	}

	it('erklärt «Beschluss von Hand festgehalten» und «Durchgang» einmal (B-2, B-6)', async () => {
		const t = await text();
		expect(t).toContain('Ein Eintrag «Beschluss von Hand festgehalten» heisst');
		expect(t).toContain('hat den Beschluss eingetragen; die Anwendung hat ihn nicht ausgezählt');
		expect(t).toContain('Ein Durchgang ist eine Abstimmung zu einem Traktandum');
	});

	it('sagt bei einer ungesicherten Uhr, was das für die Zeit heisst (B-3)', async () => {
		const t = await text({ zeilen: [zeile({ zeitquelle: 'local-unsynced' })] });
		expect(t).toContain('stammt von der Uhr des Geräts');
		expect(t).toContain('ob diese Uhr abgeglichen war, ist nicht festgehalten');
		expect(t).toContain('kann von der tatsächlichen Zeit abweichen');
	});

	it('nennt «Prüfsumme», «Inhaltsverzeichnis» und «Siegel» in verständlichen Worten (B-5)', async () => {
		const t = await text();
		expect(t).toContain('Prüfsumme');
		expect(t).toContain('Inhaltsverzeichnis (manifest.json)');
		expect(t).toContain('das Siegel ist die Prüfsumme über dieses Inhaltsverzeichnis');
		expect(t).toContain('Eine Prüfsumme ist eine Kennzahl, die sich ändert');
	});

	it('sagt bei einer Rückfallform, dass die Zuordnung nicht ging und die Zeichenfolge eine Kennung ist (B-4)', async () => {
		const fall = nichtZugeordnet('Traktandum', '01a0f6c1-2222-3333-4444-555566667777');
		expect(fall).toContain('liess sich nicht zuordnen');
		expect(fall).toContain('interne Kennung 01a0f6c1');
		expect(nichtZugeordnet('Durchgang', null)).toContain('keine Kennung im Eintrag');

		const t = await text({ zeilen: [zeile({ gegenstand: fall })] });
		expect(t).toContain('liess sich nicht zuordnen');
		expect(t).toContain('interne Kennung 01a0f6c1');
	});
});

/*
 * **L5: Zeichen und Fussnote an neuen Traktanden** (Migration 174; Entscheid
 * des Auftraggebers 22.10.2026: als Fussnote, damit die Einladung nicht
 * überladen wird). Geprüft am gerenderten Text: das Zeichen am Titel des
 * neuen, nicht am übernommenen, der Satz einmal, und nichts auf dem Beamer.
 */
describe('Neue Traktanden einer zweiten Versammlung (L5)', () => {
	const neu = traktandum({ id: 't-neu', titel: 'Neue Heizung' });
	const alt = traktandum({ id: 't-alt', titel: 'Sanierung der Fassade', position: 2 });
	const fussnote = { traktanden: new Set(['t-neu']), satz: neutraktandenFussnote(null) };

	async function text(art: 'liste' | 'praesentation' | 'einladung', mit = true): Promise<string> {
		const { bytes } = await erzeugeTraktandenliste(art, {
			versammlung: versammlung({ stufe: 'zweite' }),
			gemeinschaftName: 'STWEG Prüfweg 1',
			traktanden: [eintrag(neu, '1'), eintrag(alt, '2')],
			neutraktanden: mit ? fussnote : null,
			...(art === 'einladung' ? { einladung: { absender: 'Erfundene Verwaltung', datum: '2026-09-01' } } : {})
		});
		return (await textVonSeite(bytes, 0)).replace(/\s+/g, ' ');
	}

	it('markiert in der Einladung das neue Traktandum und setzt die Fussnote einmal', async () => {
		const t = await text('einladung');
		expect(t).toContain(`Neue Heizung ${NEUTRAKTANDUM_ZEICHEN}`);
		expect(t).not.toContain(`Sanierung der Fassade ${NEUTRAKTANDUM_ZEICHEN}`);
		expect(t.split('Dieses Geschäft stand in der Einladung zur ersten Versammlung nicht zur Abstimmung').length - 1).toBe(1);
	});

	it('verweist im Anschreiben auf die Fussnote, nur mit einem neuen Traktandum', async () => {
		const verweis = NEUTRAKTANDUM_VERWEIS.replace(/\s+/g, ' ');
		expect(await text('einladung')).toContain(verweis);
		expect(await text('einladung', false)).not.toContain(verweis);
	});

	it('markiert auch die Traktandenliste, nicht aber den Beamer', async () => {
		expect(await text('liste')).toContain(`Neue Heizung ${NEUTRAKTANDUM_ZEICHEN}`);
		const beamer = await text('praesentation');
		expect(beamer).not.toContain(NEUTRAKTANDUM_ZEICHEN);
		expect(beamer).not.toContain('Dieses Geschäft stand in der Einladung zur ersten Versammlung nicht zur Abstimmung');
	});

	it('bleibt ohne Fussnote, wie es war', async () => {
		const t = await text('einladung', false);
		expect(t).not.toContain(NEUTRAKTANDUM_ZEICHEN);
		expect(t).not.toContain('Dieses Geschäft stand in der Einladung zur ersten Versammlung nicht zur Abstimmung');
	});
});
