/**
 * Befunde der Probeabstimmung Wertquotenmehr am gemeinsamen Abend
 * (17.11.2026, `docs/proben.md`), soweit sie den Kern betreffen.
 *
 * **Warum eine eigene Datei.** Die Befunde liegen in vier Kernmodulen
 * (Abenddokument, Hausprotokoll, Auszählung, Marke); zusammen beschreiben sie
 * einen Fall, und so liest sie auch, wer die Probe nachvollzieht. Jeder Test
 * wird rot, wenn die Umsetzung fehlt: Vorher stand im Abenddokument weder
 * Person noch Zahl, weder der erste Durchgang noch ein Datum statt der Kennung.
 */
import { describe, expect, it } from 'vitest';
import {
	gemeinsamerProtokollentwurf,
	type Abendergebnis,
	type GemeinsamesProtokoll
} from '$lib/domain/gemeinsamesprotokoll';
import { regelfassungSatz, stichentscheidZeile, ersetztNachRueckkommenSatz } from '$lib/domain/protokoll';
import { gleichstandInZahlen, type Auszaehlung } from '$lib/domain/auszaehlung';
import { bezeichnungMitBasis, setzeErfordernis } from '$lib/domain/entscheidbaum';
import { erfordernisAusRegel, type Reglementsregel } from '$lib/domain/reglement';
import { herleitung } from '$lib/domain/auszaehlung';
import { holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk();

const HAUS = 'Prüflauf Hangweg';

function ergebnis(ueber: Partial<Abendergebnis> = {}): Abendergebnis {
	return {
		nummer: '4',
		gemeinschaft: HAUS,
		abweichenderTitel: null,
		satz: 'Abgelehnt: bei Stimmengleichheit hat nach dem Reglement der Verwalter entschieden. Nötig war mehr als die Hälfte der anwesenden oder vertretenen Wertquoten.',
		erfordernis: 'mehr als die Hälfte der anwesenden oder vertretenen Wertquoten',
		rechtsgrundlage: 'Reglement der Gemeinschaft, Art. 1 (Prüflauf, erfunden)',
		rueckzug: null,
		beschlusstext: null,
		pendenzen: [],
		ruegen: [],
		notiz: null,
		art: 'abstimmung',
		...ueber
	};
}

function abend(e: Abendergebnis): GemeinsamesProtokoll {
	return {
		bezeichnung: 'Prüflauf Abend',
		datum: '2036-07-10',
		uhrzeit: '19:00',
		ort: 'Prüflauf Gemeinschaftsraum',
		teilnahme: [],
		punkte: [{ nummer: '4', titel: 'Gartenpflege', antragswortlaut: null, ergebnisse: [e] }],
		erzeugtAm: '17.11.2026, 06:35',
		erzeugtDurch: 'Prüfer'
	};
}

describe('B1: Stichentscheid im Protokoll des Abends', () => {
	const stich = {
		wer: 'Prüflauf Verwaltung Muster',
		wahl: 'no' as const,
		begruendung: 'Prüflauf: Nach dem Gesetz ist der Beschluss nicht gefasst.'
	};

	it('nennt Person, Begründung und den Gleichstand in Zahlen, nach dem Ergebnis und vor dem Erfordernis', () => {
		const text = gemeinsamerProtokollentwurf(
			abend(ergebnis({ stichentscheid: stich, gleichstand: '500 zu 500 Wertquoten, nach denen hier allein gezählt wird' }))
		);
		const zeile =
			'- Bei Stimmengleichheit (500 zu 500 Wertquoten, nach denen hier allein gezählt wird) entschied ' +
			'Prüflauf Verwaltung Muster: Ablehnung. Begründung: Prüflauf: Nach dem Gesetz ist der Beschluss nicht gefasst.';
		expect(text).toContain(zeile);
		expect(text.indexOf(zeile)).toBeGreaterThan(text.indexOf('Abgelehnt: bei Stimmengleichheit'));
		expect(text.indexOf(zeile)).toBeLessThan(text.indexOf('- Angewandtes Erfordernis'));
	});

	it('vermerkt eine Person im Vorsitz, die selbst Eigentümerin ist, mit Namen (Produktentscheid 17.11.2026)', () => {
		const text = gemeinsamerProtokollentwurf(
			abend(ergebnis({ stichentscheid: { ...stich, eigentuemer: true, wahl: 'yes' }, gleichstand: '3 zu 3 Kopfstimmen' }))
		);
		expect(text).toContain(
			'- Bei Stimmengleichheit (3 zu 3 Kopfstimmen) entschied Prüflauf Verwaltung Muster im Vorsitz, selbst ' +
				'Stockwerkeigentümer (der Stichentscheid ist in der Zählung nicht enthalten): Annahme.'
		);
	});

	it('druckt die namensfreien Vermerke zum Ausgang, etwa den Stichentscheid nach Wertquoten', () => {
		const satz = 'Gleichstand bei den Kopfstimmen (2 zu 2). Nach dem Reglement dieser Gemeinschaft entscheidet die Anteilsberechtigung: 600 Wertquoten dafür, 400 dagegen. Der Antrag ist damit angenommen.';
		const text = gemeinsamerProtokollentwurf(abend(ergebnis({ ausgangsvermerke: [satz] })));
		expect(text).toContain(`- ${satz}`);
	});

	it('lässt im Hausprotokoll die Klammer weg; dort stehen die Zahlen im Spiegel', () => {
		expect(stichentscheidZeile(stich)).toBe(
			'- Bei Stimmengleichheit entschied Prüflauf Verwaltung Muster: Ablehnung. Begründung: Prüflauf: Nach dem Gesetz ist der Beschluss nicht gefasst.'
		);
	});

	/** Die Auszählung nur mit den Feldern, die `gleichstandInZahlen` liest. */
	const a = (x: Partial<Auszaehlung> & Record<string, unknown>) =>
		({
			durchStichentscheid: true,
			stichentscheidArt: 'verwalter',
			geheim: false,
			koepfe: { ja: 3, nein: 3, schwelle: 4 },
			quoten: { ja: 500, nein: 500, schwelle: null },
			...x
		}) as unknown as Auszaehlung;

	it('nennt den Gleichstand der Wertquoten, wo allein sie zählen', () => {
		expect(
			gleichstandInZahlen(a({ koepfe: { ja: 2, nein: 4, schwelle: null } as never, quoten: { ja: 500, nein: 500, schwelle: 501 } as never }))
		).toBe('500 zu 500 Wertquoten, nach denen hier allein gezählt wird');
	});

	it('nennt die Köpfe beim Kopfgleichstand und beide bei der Kaskade', () => {
		expect(gleichstandInZahlen(a({}))).toBe('3 zu 3 Kopfstimmen');
		expect(gleichstandInZahlen(a({ wertquotenGleich: { ja: 500, nein: 500 } }))).toBe(
			'3 zu 3 Kopfstimmen und 500 zu 500 Wertquoten'
		);
	});

	it('schweigt bei geheimer Abstimmung, ohne Person und ohne Stichentscheid', () => {
		expect(gleichstandInZahlen(a({ geheim: true }))).toBeNull();
		expect(gleichstandInZahlen(a({ stichentscheidArt: 'wertquote' }))).toBeNull();
		expect(gleichstandInZahlen(a({ durchStichentscheid: false }))).toBeNull();
	});
});

describe('B2: der erste Durchgang nach einem Rückkommen (Produktentscheid 17.11.2026: «Wie im Hausprotokoll»)', () => {
	it('nennt den massgebenden Durchgang und den ersetzten ohne dessen Zahlen', () => {
		const text = gemeinsamerProtokollentwurf(
			abend(
				ergebnis({
					satz: 'Angenommen: 603 Ja von 1000 Wertquoten, nötig 501.',
					durchgangszeile: 2,
					ersetztNachRueckkommen: [{ nummer: 1, ergebnis: 'abgelehnt' }]
				})
			)
		);
		expect(text).toContain(
			'- 2. Durchgang.\n- Auf dieses Traktandum wurde zurückgekommen und erneut abgestimmt. Der Beschluss aus ' +
				'dem 1. Durchgang («abgelehnt») ist damit ersetzt; seine Zahlen gibt auf Anfrage bekannt, wer das ' +
				'Protokoll aufbewahrt.'
		);
		expect(text).not.toContain('494');
	});

	it('nennt den Folgeantrag, der ersetzt hat, wie im Hausprotokoll', () => {
		expect(ersetztNachRueckkommenSatz({ nummer: 1, ergebnis: 'angenommen', folgeantrag: '3.2' })).toContain(
			'ist durch den Folgeantrag zu Traktandum 3.2 ersetzt'
		);
	});
});

describe('B3: kein interner Bezeichner als «Stand»', () => {
	it('nennt ein Datum, auch am Ende einer Kennung, und sonst nichts', () => {
		expect(regelfassungSatz('2026-11-19')).toBe('Berechnungsregeln der Software Votum, Stand 19. November 2026.');
		expect(regelfassungSatz('ordnungsantrag-2026-08-05')).toBe(
			'Berechnungsregeln der Software Votum, Stand 5. August 2026.'
		);
		expect(regelfassungSatz('reglement-rueckkommen')).toBeNull();
	});

	it('lässt den Satz im Abenddokument weg, wo die Fassung eine Regel des Reglements ist', () => {
		const text = gemeinsamerProtokollentwurf(abend(ergebnis({ regelfassung: 'reglement-rueckkommen' })));
		expect(text).toMatch(/^- Angewandtes Erfordernis: .*\(Reglement der Gemeinschaft, Art\. 1 \(Prüflauf, erfunden\)\)$/m);
		expect(text).not.toContain('reglement-rueckkommen');
	});
});

describe('Holperstellen der Probe im Kern', () => {
	const regel: Reglementsregel = {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'rueckkommen',
		kopfSchwelle: null,
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenbasis: 'anwesend_vertreten',
		fundstelle: 'Art. 21 Abs. 6 (Prüflauf, erfunden)',
		enthaltungZaehltMit: true
	} as Reglementsregel;

	it('leitet ein Rückkommen aus dem Reglement als Fall her, nicht als dessen Mehr', () => {
		const e = erfordernisAusRegel(regel);
		expect(e.titel).toBe('Rückkommen auf einen Beschluss');
		expect(herleitung(e.titel, e.rechtsgrundlage)).toBe(
			'hergeleitet als «Rückkommen auf einen Beschluss», Reglement der Gemeinschaft, Art. 21 Abs. 6 (Prüflauf, erfunden)'
		);
	});

	it('nennt ohne Köpfe die Wertquoten in der Marke, nicht eine Kopfbasis und dieselbe Basis zweimal', () => {
		const e = erfordernisAusRegel(regel);
		expect(bezeichnungMitBasis(RW, e)).toBe(
			'Reglementsmehr der anwesenden oder vertretenen Wertquoten; die Köpfe zählen nicht'
		);
		// Mit Köpfen bleibt es, wie es war.
		const mitKoepfen = setzeErfordernis(RW, 'qualifiziertes_mehr').ergebnis;
		expect(bezeichnungMitBasis(RW, mitKoepfen)).toContain('bei den Wertquoten zählen alle');
	});
});
