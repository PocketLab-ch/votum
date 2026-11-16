import { LESARTEN_VORGABE, wendeLesartAn } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import {
	ausstandMitVollmachten,
	einstimmigkeitAusReglement,
	kopfbasisStreit,
	mehrhinweise,
	VERTRETERGRENZE,
	zirkularbeschlusshinweis,
	ZIRKULARBESCHLUSS_KNOTEN,
	zweitversammlungshinweis,
	neueTraktandenDerZweiten,
	neuAnZweiterHinweis,
	type Traktandenherkunft
} from '$lib/domain/mehrhinweise';
import { erreichbarkeitshinweis, vertreterausstandsmeldung } from '$lib/domain/auszaehlung';
import { uebersteuere, waehleErfordernis, type Erfordernis } from '$lib/domain/entscheidbaum';
import { erfordernisFuerRueckkommen } from '$lib/domain/rueckkommen';
import { erfordernisAusRegel, wendeReglementAn, type Reglementsregel } from '$lib/domain/reglement';
import type { Geschaeftsart } from '$lib/domain/regelwerk';
import { holeRegelwerk, knotenDerFassung } from '$lib/rules';

/**
 * Warnungen am Mehrheitserfordernis (Block 3 der Freigabeliste, 17.10.2026).
 *
 * Gebaut wird mit echten Knoten der aktuellen Fassung, nicht mit erfundenen
 * Erfordernissen: Benennt eine spätere Fassung einen Knoten um oder ändert sie
 * seine Bezugsgrösse, soll die Probe rot werden statt still an einem Nachbau
 * grün zu bleiben.
 */
const RW = holeRegelwerk();
const knoten = (id: string) => waehleErfordernis(RW, id).ergebnis!;
const derFassung = (e: Erfordernis) => knotenDerFassung(e.fassung, e.knotenId);

function regel(geschaeftsart: Geschaeftsart, knotenId: string | null = null): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart,
		knotenId,
		kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
		kopfbasis: 'alle_eigentuemer',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Art. 9',
		enthaltungZaehltMit: true
	};
}

describe('Ä-20: Zirkulationsbeschluss als Traktandum', () => {
	it('gibt es den Knoten in der aktuellen Fassung', () => {
		expect(RW.knoten.some((k) => k.id === ZIRKULARBESCHLUSS_KNOTEN)).toBe(true);
	});

	it('warnt beim Zirkulationsbeschluss, sonst nicht', () => {
		expect(zirkularbeschlusshinweis(knoten('k-zirkularbeschluss'))).toMatch(/schriftlich/);
		expect(zirkularbeschlusshinweis(knoten('k-zirkularbeschluss'))).toMatch(/Rz\. 124, 125 und 128/);
		expect(zirkularbeschlusshinweis(knoten('k-aufhebung'))).toBeNull();
	});
});

describe('Ä-15: Einstimmigkeit aus dem Reglement', () => {
	/*
	 * Über `wendeReglementAn`, nicht über ein nachgebautes Erfordernis: Nur so
	 * zeigt die Probe, dass die Warnung dort steht, wo Votum die Klausel
	 * anwendet, und dort fehlt, wo es sie schon heute nicht anwendet.
	 */
	it('warnt, wo eine frei abänderbare Mehrheit zur Einstimmigkeit wird', () => {
		const e = wendeReglementAn(knoten('k-jahresrechnung'), [regel('jahresgeschaefte')], null, LESARTEN_VORGABE).erfordernis;
		expect(e.quelle).toBe('reglement');
		const satz = einstimmigkeitAusReglement(e, derFassung(e));
		expect(satz).toMatch(/Zustimmung aller Eigentümer; das Gesetz liesse ein Mehr genügen/);
		expect(satz).toMatch(/Rz\. 173 und 196 ad Art\. 712m/);
	});

	it('schweigt, wo Votum die Klausel gar nicht anwendet (vereinbart)', () => {
		const a = wendeReglementAn(knoten('k-baulich-notwendig'), [regel('baulich_notwendig')], null, LESARTEN_VORGABE);
		expect(a.vorbehalt).toBe('einstimmigkeit_ausgeschlossen');
		expect(einstimmigkeitAusReglement(a.erfordernis, derFassung(a.erfordernis))).toBeNull();
	});

	it('schweigt, wo schon das Gesetz die Zustimmung aller verlangt', () => {
		const e = wendeReglementAn(
			knoten('k-zweckbestimmung'),
			[regel('nutzungsaenderung', 'k-zweckbestimmung')],
			null, LESARTEN_VORGABE
		).erfordernis;
		expect(e.quelle).toBe('reglement');
		expect(einstimmigkeitAusReglement(e, derFassung(e))).toBeNull();
	});

	it('schweigt, wo die Zustimmung aller nicht aus dem Reglement kommt', () => {
		// Gegenprobe der Featureprüfung Block 3 (18.10.2026): Die Schranke auf
		// die Quelle war nur über den Knotentyp mitgedeckt.
		const alle = wendeReglementAn(knoten('k-jahresrechnung'), [regel('jahresgeschaefte')], null, LESARTEN_VORGABE).erfordernis;
		expect(einstimmigkeitAusReglement(alle, derFassung(alle))).not.toBeNull();
		expect(einstimmigkeitAusReglement({ ...alle, quelle: 'hergeleitet' as const }, derFassung(alle))).toBeNull();
	});

	it('schweigt bei einem Mehr unter allen und ohne Knoten', () => {
		const zweiDrittel = { ...regel('jahresgeschaefte'), kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' as const } };
		const e = wendeReglementAn(knoten('k-jahresrechnung'), [zweiDrittel], null, LESARTEN_VORGABE).erfordernis;
		expect(einstimmigkeitAusReglement(e, derFassung(e))).toBeNull();
		const alle = wendeReglementAn(knoten('k-jahresrechnung'), [regel('jahresgeschaefte')], null, LESARTEN_VORGABE).erfordernis;
		expect(einstimmigkeitAusReglement(alle, undefined)).toBeNull();
	});
});

describe('Ä-11: Mehrheit aller an einer zweiten Versammlung', () => {
	it('warnt bei den Wertquoten aller', () => {
		const satz = zweitversammlungshinweis(knoten('k-baulich-nuetzlich'), 'zweite');
		expect(satz).toMatch(/misst sich bei den Wertquoten aber an allen Wertquoten der Gemeinschaft/);
		expect(satz).toMatch(/Rz\. 42 ad Art\. 712p/);
		expect(satz).toMatch(/Rz\. 191 ad Art\. 712m/);
		expect(satz).not.toMatch(/Rz\. 124 ad Art\. 712a/);
		expect(satz).not.toMatch(/umstritten/);
		expect(satz).toMatch(/schon vor der Versammlung die Abwesenden, sich vertreten zu lassen/);
	});

	it('warnt bei den Köpfen aller', () => {
		expect(zweitversammlungshinweis(knoten('k-aufhebung'), 'zweite')).toMatch(/Rz\. 197 ad Art\. 712m/);
		// An der Aufhebung herrschende Lehre, kein Streit (Fachprüfung 22.10.2026, F9-2).
		expect(zweitversammlungshinweis(knoten('k-aufhebung'), 'zweite')).toMatch(/so verlangt es die herrschende Lehre/);
		expect(zweitversammlungshinweis(knoten('k-aufhebung'), 'zweite')).not.toMatch(/umstritten/);
		expect(zweitversammlungshinweis(knoten('k-baulich-luxurioes'), 'zweite')).toMatch(
			/Wer die Zustimmung aller Eigentümer hat/
		);
		expect(zweitversammlungshinweis(knoten('k-aufhebung'), 'zweite')).not.toMatch(/Mehrheit aller/);
		// Die Ausschlussklage trägt seit der Fassung 2026-11-10 die Lesart L9: Die
		// Gemeinschaft stellt die Zählbasis ein, und der Satz nennt sie, statt den
		// Streit zu behaupten (E1, Block C).
		expect(zweitversammlungshinweis(knoten('k-ausschlussklage'), 'zweite')).toMatch(
			/nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern ausser dem Beklagten/
		);
		expect(zweitversammlungshinweis(knoten('k-ausschlussklage'), 'zweite')).not.toMatch(/umstritten/);
		// Eine Fassung vor L9 sagt den Streit weiter, wie bisher.
		const alt = waehleErfordernis(holeRegelwerk('2026-11-05'), 'k-ausschlussklage').ergebnis!;
		expect(zweitversammlungshinweis(alt, 'zweite')).toMatch(
			/ausser dem Beklagten.*umstritten \(Wermelinger, Rz\. 214 ad Art\. 712a\)/
		);
	});

	it('schweigt an der ersten Versammlung und bei der Mehrheit der Anwesenden', () => {
		expect(zweitversammlungshinweis(knoten('k-baulich-nuetzlich'), 'erste')).toBeNull();
		expect(zweitversammlungshinweis(knoten('k-verwaltung-gewoehnlich'), 'zweite')).toBeNull();
		expect(zweitversammlungshinweis(knoten('k-kenntnisnahme'), 'zweite')).toBeNull();
	});

	it('schweigt bei Wertquoten der Anwesenden, auch mit Schwelle', () => {
		// Gegenprobe der Featureprüfung Block 3 (18.10.2026): Kein Regelwerk
		// kennt diese Basis mit Schwelle, ein Reglement kann sie setzen; bis
		// dahin blieb der Test grün, wenn die Bedingung auf die Basis fehlte.
		const e = { ...knoten('k-baulich-nuetzlich'), quotenbasis: 'anwesend_vertreten' as const };
		expect(e.quotenSchwelle).toBeTruthy();
		expect(e.kopfSchwelle && e.kopfbasis !== 'anwesend_vertreten').toBeFalsy();
		expect(zweitversammlungshinweis(e, 'zweite')).toBeNull();
	});
});

describe('mehrhinweise', () => {
	it('sammelt in fester Reihenfolge und lässt Leeres weg', () => {
		const z = knoten('k-zirkularbeschluss');
		// Beim Zirkulationsbeschluss nur sein eigener Satz (Codeprüfung, M2).
		expect(mehrhinweise(z, derFassung(z), 'zweite')).toEqual([zirkularbeschlusshinweis(z)]);
		expect(zweitversammlungshinweis(z, 'zweite')).toBeNull();
		// Im Saal ohne den Weg über ein milderes Mehr (Codeprüfung, M1).
		expect(zirkularbeschlusshinweis(z, true)).toMatch(/In Votum lässt sich ein milderes Mehr/);
		expect(zirkularbeschlusshinweis(z, true)).toMatch(/Rz\. 124, 125 und 128/);
		// Nach Beginn auf der Traktandenseite dieselbe Fassung wie im Saal, aber nur
		// mit festgehaltenem Einladungsmehr (M-A; Featureprüfung Block 3, 18.10.2026).
		expect(mehrhinweise(z, derFassung(z), 'zweite', false, true)).toEqual([zirkularbeschlusshinweis(z, true)]);
		expect(mehrhinweise(z, derFassung(z), 'zweite', false)).toEqual([zirkularbeschlusshinweis(z)]);
		expect(zirkularbeschlusshinweis(z, true)).not.toMatch(/ändern Sie die nötige Mehrheit/);
		expect(mehrhinweise(knoten('k-verwaltung-gewoehnlich'), undefined, 'erste')).toEqual([]);
		expect(mehrhinweise(null, undefined, 'zweite')).toEqual([]);
	});
});

describe('Ä-26: Ausstand mit Vollmachten', () => {
	it('nennt die Vertretenen und die Fundstelle', () => {
		const satz = ausstandMitVollmachten('Prüfverwaltung AG', ['Aebi', 'Bucher', 'Christen'])!;
		expect(satz).toContain('«Prüfverwaltung AG» hält Vollmachten von «Aebi», «Bucher» und «Christen».');
		expect(satz).toContain('BGE 134 III 481 E. 3.8');
		expect(ausstandMitVollmachten('Aebi', ['Bucher'])).toContain('Vollmachten von «Bucher».');
		expect(satz).toContain('eine neue Vollmacht gilt in Votum für die ganze Versammlung');
	});

	it('nennt beim Vertreter ohne Eigentum die Ableitung und ihre Grenze', () => {
		const satz = ausstandMitVollmachten('Prüfverwaltung AG', ['Aebi'], true)!;
		expect(satz).toContain('E. 3.8; bei der Entlastung Art. 695 Abs. 1 OR, beides sinngemäss');
		expect(satz).toContain('Bei Wahl und Wiederwahl ruhen sie nach dem Bundesgericht nicht (BGE 134 III 481 E. 3.5 und 3.8)');
		expect(satz).toContain('riskiert die Anfechtung');
		// Abberufung: offen, mit Rz. 24 statt Rz. 25 ad Art. 712r (Fachprüfung
		// zum Handbuch, 18.10.2026, Befund 4.1).
		expect(satz).toContain('Bei der Abberufung ist es für einen Vertreter, der nicht Eigentümer ist, nicht geklärt');
		expect(satz).toContain('erst dann, im Saal, gehört sie in Votum in den Ausstand');
		expect(satz).toContain('Rz. 76a ad Art. 712n');
		expect(satz).toContain('nehmen Sie den Ausstand dann zurück');
		// Die Handlung vor der Grenze (Laienprüfung zum Handbuch, Runde 3).
		expect(satz.indexOf('Sagen Sie es ihnen')).toBeLessThan(satz.indexOf('Abgeleitet ist das Ruhen'));
		expect(satz).toContain('Rz. 24 ad Art. 712r; Donauer, Rz. 741');
		expect(satz).not.toContain('überwiegenden Lehre');
		expect(satz).toContain('nicht für diesen Vertreter arbeitet oder ihm nahesteht');
		expect(ausstandMitVollmachten('Christen', ['Duss'])).toContain('der «Christen» nicht nahesteht');
	});

	it('nennt im Saal erst Vorsitz und Seite, dann die Grenze', () => {
		// Codeprüfung der Featureprüfung Block 3 (18.10.2026), M1: dieselbe
		// Reihenfolge wie in der Vorbereitung.
		const satz = vertreterausstandsmeldung(['Prüfverwaltung AG']);
		expect(satz).toContain(VERTRETERGRENZE);
		expect(satz.endsWith(VERTRETERGRENZE)).toBe(true);
		expect(satz.indexOf('Rz. 35 ad Art. 712m')).toBeLessThan(satz.indexOf('Abgeleitet ist das Ruhen'));
	});

	it('schweigt ohne Vollmachten', () => {
		expect(ausstandMitVollmachten('Aebi', [])).toBeNull();
	});
});

/*
 * **Ä-17 B: Was an einer zweiten Versammlung neu ist** (Produktentscheid
 * 18.10.2026, `docs/entscheide/0012`). Die Probe am echten Vertagen steht in
 * `tests/db/neue-traktanden-zweite.test.ts`.
 */
describe('Ä-17 B: neueTraktandenDerZweiten', () => {
	const t = (u: Partial<Traktandenherkunft> & { id: string }): Traktandenherkunft => ({
		art: 'abstimmung',
		ausVorlage: false,
		ausErsterUebernommen: false,
		spontan: false,
		titel: u.id,
		...u
	});
	const liste = [
		// Übernommen, auch wenn danach bearbeitet: Das sagt der Verlauf (H1).
		t({ id: 'uebertragen', ausErsterUebernommen: true }),
		t({ id: 'von-hand' }),
		t({ id: 'vorlage-gleich', ausVorlage: true, titel: 'Genehmigung des Budgets' }),
		t({ id: 'vorlage-neu', ausVorlage: true, titel: 'Wahl der Revisionsstelle' }),
		t({ id: 'kenntnis', art: 'kenntnisnahme' }),
		// Rückkommen, Saalausnahme: eigene Zulassung (H2).
		t({ id: 'im-saal', spontan: true }),
		// Der Folgeantrag erbt vom Grundantrag (M-a).
		t({ id: 'folge-neu', spontan: true, folgeantragZu: 'von-hand' }),
		t({ id: 'folge-alt', spontan: true, folgeantragZu: 'uebertragen' })
	];

	it('nennt von Hand Angelegtes, neue Pflichttraktanden und Folgeanträge dazu', () => {
		const neu = neueTraktandenDerZweiten('zweite', liste, ['Genehmigung des Budgets']);
		expect([...neu].sort()).toEqual(['folge-neu', 'von-hand', 'vorlage-neu']);
	});

	it('nennt an einer ersten Versammlung nichts', () => {
		expect(neueTraktandenDerZweiten('erste', liste, []).size).toBe(0);
	});

	it('nennt einen Folgeantrag unter einer übernommenen Kenntnisnahme (C2, F4c)', () => {
		// Eine Abstimmung auf dem Knoten der Kenntnisnahme kommt hier als
		// `kenntnisnahme` an (`holeNeueTraktandenDerZweiten`) und lässt einen
		// Folgeantrag zu; der beschliesst über Nichtangekündigtes.
		const neu = neueTraktandenDerZweiten(
			'zweite',
			[
				t({ id: 'bericht', art: 'kenntnisnahme', ausErsterUebernommen: true }),
				t({ id: 'antrag-zum-bericht', spontan: true, folgeantragZu: 'bericht' }),
				t({ id: 'antrag-dazu', spontan: true, folgeantragZu: 'antrag-zum-bericht' })
			],
			[]
		);
		expect([...neu].sort()).toEqual(['antrag-dazu', 'antrag-zum-bericht']);
	});

	it('nennt die Handlung: nur Angekündigtes beschliessen', () => {
		for (const wahl of ['erste', 'drittel'] as const) {
			expect(neuAnZweiterHinweis(wahl, false)).toContain('wenn es in der Einladung zur zweiten steht');
			expect(neuAnZweiterHinweis(wahl, true)).not.toBe(neuAnZweiterHinweis(wahl, false));
		}
	});
});

/*
 * **L6 an der eigenen Schranke** (Fassung 2026-11-05, F4c Block 1): Unter der
 * Lesart ist die Klausel die Regel der Gemeinschaft, der Streit um die
 * Zählbasis also entschieden. Der Satz am Abend nennt die Klausel und nichts
 * Streitiges; der Satz «verkündet Votum nach seiner strengen Lesart trotzdem
 * eine Ablehnung» wäre daneben doppelt und falsch. Ohne L6, bei Traktanden
 * älterer Fassungen, bleibt der Streit mit der milderen Bedingung.
 */
describe('kopfbasisStreit unter L6', () => {
	const LEER = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };

	it('sagt unter L6 die Klausel und nichts Streitiges', () => {
		const e = knoten('k-reglement-eigene-schranke');
		expect(e.gemeinschaftslesart?.kennung).toBe('L6');
		expect(kopfbasisStreit(e)).toEqual({
			satz: 'Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern, auch an den abwesenden. Wer die Zustimmung aller Eigentümer hat, ist auf der sicheren Seite.',
			streitig: false
		});
	});

	it('warnt am Abend ohne die strenge Lesart: die Regel ist jetzt die der Gemeinschaft', () => {
		const e = knoten('k-reglement-eigene-schranke');
		const warnung = erreichbarkeitshinweis(
			e,
			{ koepfe: { ...LEER, ohneAbgabe: 5, nichtAnwesend: 1, basis: 6, schwelle: 6 }, quoten: LEER },
			false
		);
		expect(warnung).toContain('Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern');
		expect(warnung).toContain('Lassen Sie abstimmen, ist der Antrag abgelehnt.');
		expect(warnung).not.toContain('strenge Lesart');
	});

	it('bleibt ohne L6, wie sie war: der Streit mit der milderen Bedingung', () => {
		const alt = waehleErfordernis(holeRegelwerk('2026-11-04'), 'k-reglement-eigene-schranke').ergebnis!;
		expect(alt.gemeinschaftslesart).toBeUndefined();
		expect(kopfbasisStreit(alt)).toMatchObject({ streitig: true, mildereBedingung: 'qualifiziert' });
		expect(kopfbasisStreit(alt)?.satz).toContain(
			'ist umstritten (Wermelinger, Rz. 40 und 125 ad Art. 712g; BGer 5C.50/2004 E. 4.2)'
		);
		// Dasselbe am Knoten der aktuellen Fassung, sobald die Lesart fehlt, etwa nach einer Abweichung der Leitung.
		const ohne = { ...knoten('k-reglement-eigene-schranke'), gemeinschaftslesart: undefined };
		expect(kopfbasisStreit(ohne)).toMatchObject({ streitig: true, mildereBedingung: 'qualifiziert' });
		const warnung = erreichbarkeitshinweis(
			ohne,
			{ koepfe: { ...LEER, ohneAbgabe: 5, nichtAnwesend: 1, basis: 6, schwelle: 6 }, quoten: LEER },
			false
		);
		expect(warnung).toContain('Erreicht der Beschluss das qualifizierte Mehr, verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung');
	});
});

/*
 * **L12 an der luxuriösen Massnahme** (Fassung 2026-11-10, E1 Block B): Die
 * Zählung ist die der Gemeinschaft, und der Satz «verkündet Votum nach seiner
 * strengen Lesart trotzdem eine Ablehnung» fällt weg. Unter der milden Wahl
 * gibt `kopfbasisStreit` von selbst `null`: Dort gibt es nichts zu streiten.
 */
describe('kopfbasisStreit unter L12', () => {
	const LEER = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };

	it('sagt unter L12 die Einstellung der Gemeinschaft und nichts Streitiges', () => {
		const e = knoten('k-baulich-luxurioes');
		expect(e.gemeinschaftslesart?.kennung).toBe('L12');
		expect(kopfbasisStreit(e)).toEqual({
			satz: 'Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern, auch an den abwesenden. Wer die Zustimmung aller Eigentümer hat, ist auf der sicheren Seite.',
			streitig: false
		});
	});

	it('warnt am Abend ohne die strenge Lesart: die Zählung ist jetzt die der Gemeinschaft', () => {
		const e = knoten('k-baulich-luxurioes');
		const warnung = erreichbarkeitshinweis(
			e,
			{ koepfe: { ...LEER, ohneAbgabe: 5, nichtAnwesend: 1, basis: 6, schwelle: 6 }, quoten: LEER },
			false
		);
		expect(warnung).toContain('Votum zählt die Köpfe hier nach der Einstellung Ihrer Gemeinschaft');
		expect(warnung).not.toContain('strenge Lesart');
	});

	it('bleibt ohne L12, wie sie war: der Streit um die Zählung', () => {
		const alt = waehleErfordernis(holeRegelwerk('2026-11-05'), 'k-baulich-luxurioes').ergebnis!;
		expect(alt.gemeinschaftslesart).toBeUndefined();
		expect(kopfbasisStreit(alt)).toMatchObject({ streitig: true });
		expect(kopfbasisStreit(alt)?.satz).toContain(
			'Ob die Zustimmung der Anwesenden und Vertretenen genügt, ist umstritten (Wermelinger, Rz. 197 ad Art. 712m)'
		);
		// Dasselbe am Knoten der aktuellen Fassung, sobald die Lesart fehlt.
		const ohne = { ...knoten('k-baulich-luxurioes'), gemeinschaftslesart: undefined };
		expect(kopfbasisStreit(ohne)).toMatchObject({ streitig: true });
		const warnung = erreichbarkeitshinweis(
			ohne,
			{ koepfe: { ...LEER, ohneAbgabe: 5, nichtAnwesend: 1, basis: 6, schwelle: 6 }, quoten: LEER },
			false
		);
		expect(warnung).toContain('verkündet Votum nach seiner strengen Lesart trotzdem eine Ablehnung');
	});

	it('schweigt unter der milden Wahl, weil dort nichts zu streiten ist', () => {
		const e = wendeLesartAn(knoten('k-baulich-luxurioes'), { ...LESARTEN_VORGABE, L12: 'anwesende' });
		expect(e.kopfbasis).toBe('anwesend_vertreten');
		expect(kopfbasisStreit(e)).toBeNull();
	});
});

/*
 * **Das Rückkommen auf einen Beschluss unter L6** (Review DeepSeek
 * 05.11.2026, B2): Es übernimmt das Mehr ohne die Lesart, also ohne zweites
 * Ergebnis, trägt aber die Lesart des Beschlusses für den Satz der Leitung.
 * Bis dahin sagte die Leitung am Rückkommen den Streit samt «strenger Lesart»,
 * am Beschluss selbst den L6-Satz. Gerechnet mit sechs Eigentümern, einer
 * abwesend, wie in der Prüfdatei.
 */
describe('Rückkommen auf einen Beschluss unter L6', () => {
	const LEER = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };
	const LAGE = { koepfe: { ...LEER, ohneAbgabe: 5, nichtAnwesend: 1, basis: 6, schwelle: 6 }, quoten: LEER };
	const beschluss = () => knoten('k-reglement-eigene-schranke');

	it('trägt die Lesart des Beschlusses ohne zweites Ergebnis', () => {
		const rk = erfordernisFuerRueckkommen(beschluss(), true);
		expect(rk.gemeinschaftslesart).toBeUndefined();
		// Seit B2b mit dem Mehr der anderen Wahl; den Ausgang kennt nur, wer ihn mitgibt.
		expect(rk.lesartDesBeschlusses).toEqual({
			kennung: 'L6',
			wahl: 'klausel',
			andere: expect.objectContaining({ wahl: 'gesetz', typ: 'qualifiziertes_mehr' })
		});
		expect(rk.lesartDesBeschlusses).not.toHaveProperty('mitAllen');
		expect(erfordernisFuerRueckkommen(beschluss(), true, null, true).lesartDesBeschlusses?.mitAllen).toBe(true);
		expect(rk.knotenId).toBe('k-reglement-eigene-schranke');
	});

	it('sagt am Abend denselben Satz wie der Beschluss, ohne die strenge Lesart', () => {
		const e = beschluss();
		const rk = erfordernisFuerRueckkommen(e, true);
		expect(kopfbasisStreit(rk)).toEqual(kopfbasisStreit(e));
		const warnung = erreichbarkeitshinweis(rk, LAGE, false)!;
		// Bis zur Folge, die die Leitung verkündet, derselbe Satz (Laienprüfung B2,
		// B2-L-1); danach Gegenstand und Weg der Aufhebung (B2b, R2-F-1 und R2-F-2).
		const amBeschluss = erreichbarkeitshinweis(e, LAGE, false)!;
		const kopf = amBeschluss.split(' Lassen Sie abstimmen')[0];
		expect(warnung.startsWith(`${kopf} Lassen Sie abstimmen, ist der Rückkommensantrag abgelehnt, und der frühere Beschluss gilt.`)).toBe(true);
		expect(warnung).toContain('auf das Blatt gehört deshalb der Wortlaut der Aufhebung, nicht der Rückkommensantrag');
		expect(warnung).toContain('An einer späteren Versammlung ist die Aufhebung ein eigenes Traktandum, das die Einladung nennen muss');
		expect(warnung).toContain('Unter «Klausel anwenden» braucht sie dort wieder die Zustimmung aller Eigentümer.');
		expect(warnung).not.toContain('ans Ende des Abends oder auf eine spätere Versammlung');
		expect(warnung).not.toContain('ist der Antrag abgelehnt');
		expect(warnung).toContain('Votum zählt die Köpfe hier nach der Klausel an allen Eigentümern');
		expect(warnung).not.toContain('strenge');
		expect(warnung).not.toContain('angefochten');
	});

	it('sagt an einer zweiten Versammlung denselben Satz wie der Beschluss', () => {
		const e = beschluss();
		const rk = erfordernisFuerRueckkommen(e, true);
		const satz = zweitversammlungshinweis(rk, 'zweite');
		expect(satz).toBe(zweitversammlungshinweis(e, 'zweite'));
		expect(satz).toContain('nach der Klausel');
	});

	it('reicht die Lesart beim Rückkommen auf ein Rückkommen weiter', () => {
		const rk = erfordernisFuerRueckkommen(erfordernisFuerRueckkommen(beschluss(), true), true);
		expect(rk.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel' });
		expect(kopfbasisStreit(rk)?.streitig).toBe(false);
	});

	it('bleibt beim Beschluss aus der Fassung vor L6, wie er war', () => {
		const alt = waehleErfordernis(holeRegelwerk('2026-11-04'), 'k-reglement-eigene-schranke').ergebnis!;
		const rk = erfordernisFuerRueckkommen(alt, true);
		expect(rk.lesartDesBeschlusses).toBeUndefined();
		expect(kopfbasisStreit(rk)).toMatchObject({ streitig: true, mildereBedingung: 'qualifiziert' });
		expect(erreichbarkeitshinweis(rk, LAGE, false)).toContain('nach seiner strengen Lesart trotzdem eine Ablehnung');
	});

	it('verliert die Lesart, wenn die Leitung das Mehr von Hand setzt', () => {
		const rk = erfordernisFuerRueckkommen(beschluss(), true);
		const vonHand = uebersteuere(RW, rk, 'einstimmigkeit', 'Prüfung: von Hand gesetzt').ergebnis;
		expect(vonHand.lesartDesBeschlusses).toBeUndefined();
		expect(kopfbasisStreit(vonHand)?.streitig).toBe(true);
	});

	it('behält die Lesart unter einer Reglementsregel zum Rückkommen, die die Einstimmigkeit nicht erreicht', () => {
		// Eine Regel ist ein Reglementsmehr und erreicht die Einstimmigkeit nie
		// (`mindestensSoStreng`); es gilt das Mehr des Beschlusses mit Vorbehalt.
		const rk = erfordernisFuerRueckkommen(beschluss(), true, erfordernisAusRegel(regel('rueckkommen')));
		expect(rk.quelle).toBe('gewaehlt');
		expect(rk.typ).toBe('einstimmigkeit');
		expect(rk.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'klausel' });
		expect(kopfbasisStreit(rk)?.streitig).toBe(false);
	});

	it('verliert die Lesart, wo eine Regel des Reglements das Mehr ersetzt', () => {
		// An der eigenen Schranke ersetzt keine Regel das Mehr (Entscheid 0042);
		// gemessen an einer Karte, an der eine greift.
		const mit = { ...knoten('k-jahresrechnung'), lesartDesBeschlusses: { kennung: 'L6' as const, wahl: 'klausel' } };
		const { erfordernis } = wendeReglementAn(mit, [regel('jahresgeschaefte')], null, LESARTEN_VORGABE);
		expect(erfordernis.quelle).toBe('reglement');
		expect(erfordernis.lesartDesBeschlusses).toBeUndefined();
	});

	it('schweigt unter «Nach dem Gesetz»: Das qualifizierte Mehr hängt an den Anwesenden', () => {
		const e = wendeLesartAn(beschluss(), { ...LESARTEN_VORGABE, L6: 'gesetz' });
		const rk = erfordernisFuerRueckkommen(e, true);
		expect(rk.lesartDesBeschlusses).toMatchObject({ kennung: 'L6', wahl: 'gesetz', andere: { wahl: 'klausel' } });
		expect(kopfbasisStreit(rk)).toBeNull();
		expect(kopfbasisStreit(e)).toBeNull();
	});
});
